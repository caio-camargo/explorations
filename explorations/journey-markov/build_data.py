"""
build_data.py — anonymized aggregate builder for the Markov journey map.

Reads private journey CSVs (NOT in this repo) and emits an aggregate JSON with
zero PII: page paths, transition counts, dwell sums, and outcome-labeled
session-end counts. Individual visitors and emails never leave this script.

Source data (private, local only, NOT in this repo):
  <JOURNEY_DATA_DIR>/icp-journeys-full-pages.csv
  <JOURNEY_DATA_DIR>/icp-journeys-full.csv

Usage:
  python build_data.py            # rewrites the JSON between the markers in index.html
  python build_data.py --stdout   # print JSON instead
Set JOURNEY_DATA_DIR to point at the private reports folder; defaults to the
sibling workspace layout this project uses locally.
"""
import csv, json, os, re, sys, collections
from pathlib import Path

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

def main():
    # outcome per visitor
    outcome = {}
    with open(BASE / "icp-journeys-full.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            e = (r.get("email") or "").strip().lower()
            if not e: continue
            s = (r.get("status") or "").strip()
            # "Cancelled" means a meeting WAS scheduled (then cancelled) — the booking
            # event happened, so it counts as booked. BOOKED = "meeting scheduled",
            # nothing stronger (held-rate is not measured in the source data).
            outcome[e] = "booked" if s in ("Meeting Scheduled", "Cancelled") else "lost"

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
    }

    js = json.dumps(out, separators=(",", ":"))
    if "--stdout" in sys.argv:
        print(js)
        return

    html_path = HERE / "index.html"
    html = html_path.read_text(encoding="utf-8")
    start, end = "/*DATA-START*/", "/*DATA-END*/"
    i, j = html.index(start) + len(start), html.index(end)
    html_path.write_text(html[:i] + js + html[j:], encoding="utf-8")
    print(f"injected {len(js)} bytes into index.html — "
          f"{len(out['pages'])} pages, {len(out['edges'])} edges, "
          f"{n_sessions} sessions, {all_visitors} visitors ({booked_visitors} booked)")

if __name__ == "__main__":
    main()
