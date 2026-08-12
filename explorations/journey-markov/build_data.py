"""
build_data.py — anonymized aggregate builder for the Markov journey map.

Reads private journey CSVs (NOT in this repo) and emits an aggregate JSON with
zero PII: page paths, transition counts, dwell sums, and outcome-labeled
session-end counts. Individual visitors and emails never leave this script.

Source data (private, local only, NOT in this repo):
  <JOURNEY_DATA_DIR>/icp-journeys-full-pages.csv
  <JOURNEY_DATA_DIR>/icp-journeys-full.csv
These are point-in-time exports (currently 2026-06-01 -> 2026-07-20). The upstream
source of truth is the company's Databricks lakehouse (as of 2026-08-12); refreshes
should be regenerated from there, not by re-running the old export pipeline. The
internal mapping of sources to lakehouse tables lives in the private workspace's
journey data map, next to the CSVs.

Usage:
  python build_data.py            # rewrites the JSON between the markers in index.html
  python build_data.py --stdout   # print JSON instead
Set JOURNEY_DATA_DIR to point at the private reports folder; defaults to the
sibling workspace layout this project uses locally.
"""
import csv, hashlib, json, os, re, sys, collections
from pathlib import Path
from urllib.parse import urlparse

BASE = Path(os.environ.get("JOURNEY_DATA_DIR",
            Path(__file__).parent / ".." / ".." / ".." / "RetellAI" / "reports"))
HERE = Path(__file__).parent

AGENT_RE = re.compile(r"^(dashboard\.retellai\.com/agents)/agent_[0-9a-f]+$")

def normalize(page: str) -> str:
    page = page.strip()
    m = AGENT_RE.match(page)
    if m:
        return m.group(1) + "/:agent"
    return page

def prop_of(page: str) -> str:
    if page.startswith("dashboard."): return "dashboard"
    if page.startswith("docs."): return "docs"
    return "www"

def build_all_traffic():
    """All-traffic funnel from Warmly identified-visitor exports (sankey-all.html).

    One row = one identified visitor-session with an ordered Pages Viewed list.
    Marketing site only (that's all Warmly instruments). Green means "session's
    last page is the demo-request form" — submission/booking is NOT observable
    at this scale, and the page says so. Person-level fields are never read
    beyond the columns used here; output is aggregate paths + counts only.
    """
    intake = BASE.parent / "intake"
    # ROW-level dedupe: the intake folder holds re-exports of the same window with
    # different byte order (file hashing fails) and a week file that is a subset of
    # a month file. Identical records are export duplicates, never two sessions.
    seen, rows, dup_rows = set(), [], 0
    for fn in sorted(intake.glob("Warm Visitors Export*.csv")):
        with open(fn, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f, delimiter=";"):
                key = hashlib.md5(repr(sorted(r.items())).encode()).hexdigest()
                if key in seen:
                    dup_rows += 1
                    continue
                seen.add(key)
                rows.append(r)

    def origin_of(u):
        s = (u or "").strip().lstrip("?")
        if not s:
            return "untagged / direct"
        m = re.search(r"utm_source=([^,&]+)", s)
        src = (m.group(1) if m else "").lower()
        if src == "adwords": return "google ads"
        if src.startswith("google"): return "google organic"
        if "chatgpt" in src: return "chatgpt"
        if "linkedin" in src: return "linkedin"
        if src in ("brevo", "sendinblue"): return "email"
        return "other tagged"

    MAXSTEP, TOPN, GATE = 6, 12, "/enterprise-plan"

    def paths_of(r):
        out = []
        for u in (r.get("Pages Viewed") or "").split(","):
            u = u.strip()
            if not u:
                continue
            p = urlparse(u)
            if p.netloc != "www.retellai.com":
                continue  # staging/off-site noise
            path = p.path or "/"
            if len(path) > 1 and path.endswith("/"):
                path = path[:-1]
            if not out or out[-1] != path:
                out.append(path)
        return out

    seqs, excluded = [], 0
    for r in rows:
        s = paths_of(r)
        if s:
            seqs.append((s, origin_of(r.get("UTM Params"))))
        else:
            excluded += 1

    freq = collections.Counter(p for s, _o in seqs for p in s)
    top = {p for p, _n in freq.most_common(TOPN)} | {GATE}
    coll = lambda p: "homepage" if p == "/" else (p if p in top else "(other site pages)")

    flows, ends = collections.Counter(), collections.Counter()
    for s, org in seqs:
        sc = [coll(p) for p in s[:MAXSTEP]]
        flows[(0, org, sc[0])] += 1
        for k in range(1, len(sc)):
            flows[(k, sc[k - 1], sc[k])] += 1
        if len(s) > MAXSTEP:
            flows[(MAXSTEP, sc[-1], "__CONTINUES__")] += 1
        else:
            ends[(len(sc), sc[-1], "booked" if s[-1] == GATE else "exit")] += 1

    return {
        "meta": {
            "source": "Warmly identified-visitor sessions, retellai.com marketing site (anonymized aggregate)",
            "date_range": ["2026-06-30", "2026-08-10 (two windows)"],
            "sessions": len(seqs),
        },
        "sankey": {
            "maxstep": MAXSTEP,
            "mode": "all",
            "origins": sorted({o for (c, o, _t) in flows if c == 0}),
            "included": len(seqs),
            "excluded": {"empty or off-site": excluded, "duplicate export rows": dup_rows},
            "appHopsElided": 0,
            "flows": [{"c": c, "from": a, "to": b, "n": n} for (c, a, b), n in sorted(flows.items())],
            "ends": [{"c": c, "from": a, "end": e, "n": n} for (c, a, e), n in sorted(ends.items())],
        },
    }


def main():
    # outcome + self-reported origin per visitor
    def origin_of(s):
        return {"google_search": "google", "chatgpt": "chatgpt",
                "recommendation": "recommendation"}.get((s or "").strip(), "other / unlisted")

    outcome, origin = {}, {}
    with open(BASE / "icp-journeys-full.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            e = (r.get("email") or "").strip().lower()
            if not e: continue
            s = (r.get("status") or "").strip()
            # "Cancelled" means a meeting WAS scheduled (then cancelled) — the booking
            # event happened, so it counts as booked. BOOKED = "meeting scheduled",
            # nothing stronger (held-rate is not measured in the source data).
            outcome[e] = "booked" if s in ("Meeting Scheduled", "Cancelled") else "lost"
            # heard_about is self-reported and incomplete (known under-attribution);
            # it still beats an information-free START bar
            origin[e] = origin_of(r.get("heard_about"))

    # journeys
    rows = []
    with open(BASE / "icp-journeys-full-pages.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            e = (r.get("email") or "").strip().lower()
            rows.append({
                "email": e,
                "session": r["session"],
                "ts": r["ts_utc"],
                "page": normalize(r["page"]),
                "dwell": int(r["dwell_s"]) if r["dwell_s"] else 0,
            })

    rows.sort(key=lambda r: (r["email"], r["session"], r["ts"]))

    # group into sessions
    sessions = collections.defaultdict(list)
    for r in rows:
        sessions[(r["email"], r["session"])].append(r)

    pages = collections.defaultdict(lambda: {
        "visits": 0, "dwell": 0, "visitors": set(),
        "visits_booked": 0, "visits_lost": 0,
        "entries": 0, "exits_booked": 0, "exits_lost": 0,
    })
    edges = collections.Counter()

    n_sessions = 0
    dates = []
    for (email, _sid), evs in sessions.items():
        oc = outcome.get(email, "lost")
        n_sessions += 1
        dates.append(evs[0]["ts"][:10])
        for i, ev in enumerate(evs):
            p = pages[ev["page"]]
            p["visits"] += 1
            p["dwell"] += ev["dwell"]
            p["visitors"].add(email)
            p["visits_" + oc] += 1
            if i == 0:
                p["entries"] += 1
                edges[("__START__", ev["page"])] += 1
            if i == len(evs) - 1:
                p["exits_" + oc] += 1
                edges[(ev["page"], "__BOOKED__" if oc == "booked" else "__LOST__")] += 1
            else:
                edges[(ev["page"], evs[i + 1]["page"])] += 1

    booked_visitors = sum(1 for e in {r["email"] for r in rows} if outcome.get(e) == "booked")
    all_visitors = len({r["email"] for r in rows})

    # ---- step-indexed flows for the Sankey (sankey.html) ----
    # A marketing funnel: the app dashboard is an ORIGIN (session starts in the
    # product) and an OUTCOME (marketing hands the visitor to the product), never
    # a middle step. Leading app-runs become the "app dashboard" origin; trailing
    # app-runs the "app dashboard" outcome; pure-app sessions one direct
    # origin→outcome ribbon; rare interior hops (marketing→app→marketing) are
    # spliced out and counted. Columns 1..MAXSTEP are marketing/docs steps only.
    # Ends use booking-event semantics: BOOKED only when a scheduled visitor's
    # session ends at the gate.
    MAXSTEP = 6
    TOPN = 12
    GATE_PAGES = {"/enterprise-plan"}
    APP_ORIGIN = "app dashboard"
    is_app = lambda p: p.startswith("dashboard.")
    is_www = lambda p: prop_of(p) == "www"
    top_pages = set(sorted((p for p in pages if not is_app(p)),
                           key=lambda p: -pages[p]["visits"])[:TOPN]) | GATE_PAGES
    OTHER_LBL = {"www": "(other site pages)", "docs": "(other docs pages)"}
    def collapse(p):
        if p == "/":
            return "homepage"
        return p if p in top_pages else OTHER_LBL[prop_of(p)]

    flows = collections.Counter()   # (col_from, from, to)
    ends = collections.Counter()    # (col_from, from, "booked"|"exit"|"app")
    app_hops_elided = 0
    n_included = 0
    excluded = collections.Counter()  # sessions that never touch the marketing site
    for (email, _sid), evs in sessions.items():
        seq = []
        for ev in evs:
            if not seq or seq[-1] != ev["page"]:
                seq.append(ev["page"])
        # inclusion rule: a session belongs to the marketing funnel only if it
        # touches at least one www page; pure app / docs-only sessions are out
        if not any(is_www(p) for p in seq):
            excluded["pure app" if all(is_app(p) for p in seq) else "docs, no site"] += 1
            continue
        n_included += 1
        starts_app = is_app(seq[0])
        ends_app = is_app(seq[-1])
        mid = [p for p in seq if not is_app(p)]  # marketing/docs steps only
        # interior hop = an app run that is neither the leading nor the trailing run
        i = 0
        while i < len(seq):
            if is_app(seq[i]):
                j = i
                while j + 1 < len(seq) and is_app(seq[j + 1]):
                    j += 1
                if i > 0 and j < len(seq) - 1:
                    app_hops_elided += 1
                i = j + 1
            else:
                i += 1
        org = APP_ORIGIN if starts_app else origin.get(email, "other / unlisted")
        oc = ("booked" if (outcome.get(email) == "booked" and mid[-1] in GATE_PAGES and not ends_app)
              else "app" if ends_app else "exit")
        seq_c = [collapse(p) for p in mid[:MAXSTEP]]
        flows[(0, org, seq_c[0])] += 1
        for k in range(1, len(seq_c)):
            flows[(k, seq_c[k - 1], seq_c[k])] += 1
        if len(mid) > MAXSTEP:
            flows[(MAXSTEP, seq_c[-1], "__CONTINUES__")] += 1
        else:
            ends[(len(seq_c), seq_c[-1], oc)] += 1

    out = {
        "meta": {
            "source": "ICP lead journeys, retellai.com properties (anonymized aggregate)",
            "date_range": [min(dates), max(dates)],
            "visitors": all_visitors,
            "visitors_booked": booked_visitors,
            "sessions": n_sessions,
            "pageviews": len(rows),
        },
        "pages": [
            {
                "id": name,
                "prop": prop_of(name),
                "visits": p["visits"],
                "dwell": p["dwell"],
                "visitors": len(p["visitors"]),
                "visitsBooked": p["visits_booked"],
                "visitsLost": p["visits_lost"],
                "entries": p["entries"],
            }
            for name, p in sorted(pages.items(), key=lambda kv: -kv[1]["visits"])
        ],
        "edges": [
            {"from": a, "to": b, "n": n}
            for (a, b), n in sorted(edges.items(), key=lambda kv: -kv[1])
        ],
        "sankey": {
            "maxstep": MAXSTEP,
            "mode": "icp",
            "origins": sorted({o for (c, o, _t) in flows if c == 0} | {APP_ORIGIN}),
            "appHopsElided": app_hops_elided,
            "included": n_included,
            "excluded": dict(excluded),
            "flows": [
                {"c": c, "from": a, "to": b, "n": n}
                for (c, a, b), n in sorted(flows.items())
            ],
            "ends": [
                {"c": c, "from": a, "end": e, "n": n}
                for (c, a, e), n in sorted(ends.items())
            ],
        },
    }

    js = json.dumps(out, separators=(",", ":"))
    if "--stdout" in sys.argv:
        print(js)
        return

    def inject(html_path, payload):
        start, end = "/*DATA-START*/", "/*DATA-END*/"
        html = html_path.read_text(encoding="utf-8")
        if start not in html:
            return
        i, j = html.index(start) + len(start), html.index(end)
        html_path.write_text(html[:i] + payload + html[j:], encoding="utf-8")
        print(f"injected {len(payload)} bytes into {html_path.name}")

    inject(HERE / "index.html", js)
    inject(HERE / "sankey.html", js)
    # sankey-all.html is a byte copy of sankey.html (same code, forever in sync);
    # only the injected DATA differs — SK.mode drives the wording
    out_all = build_all_traffic()
    (HERE / "sankey-all.html").write_text(
        (HERE / "sankey.html").read_text(encoding="utf-8"), encoding="utf-8")
    inject(HERE / "sankey-all.html", json.dumps(out_all, separators=(",", ":")))
    a = out_all["sankey"]
    print(f"{len(out['pages'])} pages, {len(out['edges'])} edges, "
          f"{len(out['sankey']['flows'])} sankey flows, {len(out['sankey']['ends'])} ends, "
          f"{n_sessions} sessions, {all_visitors} visitors ({booked_visitors} booked)")
    print(f"all-traffic: {a['included']} sessions, {len(a['flows'])} flows, "
          f"{len(a['ends'])} ends, excluded {a['excluded']}")

if __name__ == "__main__":
    main()
