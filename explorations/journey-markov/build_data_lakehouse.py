"""
build_data_lakehouse.py — all-traffic funnel built straight from the warehouse.

Third dataset for the journey-markov exploration, and the only one sourced from
the company's canonical lakehouse rather than a point-in-time file export:

  index.html / sankey.html  — 53 ICP leads, matched+de-anonymised, Jun 1 → Jul 20
  sankey-all.html           — identified-visitor sessions (vendor export)
  sankey-lakehouse.html     — THIS: every marketing-site session in the warehouse

What it can and cannot say, stated once here and repeated on the page:

  * Population: every web analytics session that viewed a marketing-site page.
    Two orders of magnitude more sessions than the ICP file — sample size stops
    being the limiting factor.
  * Outcome is "reached the demo-request form", NOT a booking. Web analytics sees
    only a tiny fraction of real submissions on that page (measured: 32 submit
    events against 4,709 sessions that reached it), so submission and booking are
    genuinely unobservable at this grain. The ICP dataset is where booking lives.
  * Window is bounded by the warehouse's own raw-event history, which starts when
    the export was first connected and cannot be backfilled.

Two documented data traps are honoured here rather than rediscovered:
  * Marketing-site host filter. The analytics property also collects the product
    and auth subdomains, and the marketing site is <9% of pageviews — an
    unfiltered number is a product metric wearing a marketing label.
  * /careers (and /about-us) are excluded: job-seeker traffic over-indexes on
    large companies and pollutes any buying-funnel metric.
  * Locale-prefixed paths (/es/pricing) normalise onto their canonical path, so
    the funnel doesn't fragment across ten locales.

No personal data is read or emitted: the query aggregates to step transitions
inside the warehouse and returns counts only. No identifier ever leaves it.

Usage:
  python build_data_lakehouse.py            # write sankey-lakehouse.html
  python build_data_lakehouse.py --stdout    # print the aggregate JSON

Requires the Databricks CLI, authenticated (OAuth U2M is fine), and a running
SQL warehouse. LAKEHOUSE_WAREHOUSE_ID must be set — the compute id is an
infrastructure identifier and is deliberately not committed here.
"""
import json, os, subprocess, sys, time, collections
from pathlib import Path

HERE = Path(__file__).parent
# Infrastructure identifiers stay out of this repo (it is public). Set
# LAKEHOUSE_WAREHOUSE_ID to the compute id before running.
WAREHOUSE = os.environ.get("LAKEHOUSE_WAREHOUSE_ID", "")
CATALOG = os.environ.get("LAKEHOUSE_CATALOG", "workspace")
EVENTS = f"{CATALOG}.ga4_gold.gold_events"
SITE_HOST = "www.retellai.com"
GATE = "/enterprise-plan"
MAXSTEP = 6
TOPN = 12
LOCALES = "es|de|it|pt|fr|ja|ko|zh|nl|hi|id"
DROP_PAGES = ("/careers", "/about-us")


def sql(statement: str):
    """Run one statement through the SQL Statement API; return list-of-rows."""
    payload = {"warehouse_id": WAREHOUSE, "statement": statement,
               "wait_timeout": "50s", "format": "JSON_ARRAY",
               "disposition": "INLINE"}
    req = HERE / ".lakehouse_query.json"
    req.write_text(json.dumps(payload), encoding="ascii")
    try:
        raw = subprocess.run(
            ["databricks", "api", "post", "/api/2.0/sql/statements",
             "--json", f"@{req}"],
            capture_output=True, text=True, check=True).stdout
    finally:
        req.unlink(missing_ok=True)
    res = json.loads(raw)
    stmt_id = res.get("statement_id")
    # a long scan can exceed wait_timeout — poll rather than fail
    while res.get("status", {}).get("state") in ("PENDING", "RUNNING"):
        time.sleep(3)
        res = json.loads(subprocess.run(
            ["databricks", "api", "get", f"/api/2.0/sql/statements/{stmt_id}"],
            capture_output=True, text=True, check=True).stdout)
    state = res.get("status", {}).get("state")
    if state != "SUCCEEDED":
        raise RuntimeError(f"query {state}: "
                           f"{res.get('status', {}).get('error', {}).get('message')}")
    return res.get("result", {}).get("data_array") or []


# One statement does the whole reduction inside the warehouse: normalise paths,
# drop consecutive repeats (a reload is not a step), number the steps, fold the
# long tail, then emit origin/step/end rows as counts.
FUNNEL_SQL = f"""
WITH pv AS (
  SELECT concat(user_pseudo_id, '|', CAST(ga_session_id AS STRING)) AS sk,
         event_ts,
         CASE WHEN p = '' OR p IS NULL THEN '/' ELSE p END AS path
  FROM (
    SELECT user_pseudo_id, ga_session_id, event_ts,
           CASE WHEN length(lp) > 1 AND endswith(lp, '/')
                THEN left(lp, length(lp) - 1) ELSE lp END AS p
    FROM (
      SELECT user_pseudo_id, ga_session_id, event_ts,
             regexp_replace(page_path, '^/({LOCALES})(/|$)', '/') AS lp
      FROM {EVENTS}
      WHERE device_web_hostname = '{SITE_HOST}'
        AND event_name = 'page_view'
        AND ga_session_id IS NOT NULL
        AND page_path IS NOT NULL
    ) a
  ) b
),
kept AS (
  SELECT * FROM pv WHERE path NOT IN ({",".join(f"'{p}'" for p in DROP_PAGES)})
),
src AS (
  SELECT concat(user_pseudo_id, '|', CAST(ga_session_id AS STRING)) AS sk,
         min_by(CASE
           WHEN gclid IS NOT NULL AND gclid <> '' THEN 'google ads'
           WHEN lower(coalesce(nullif(param_source, ''),
                               nullif(traffic_source_source, ''), '')) LIKE '%chatgpt%'
                THEN 'chatgpt'
           WHEN lower(coalesce(nullif(param_source, ''),
                               nullif(traffic_source_source, ''), '')) LIKE '%google%'
                THEN 'google organic'
           WHEN lower(coalesce(nullif(param_source, ''),
                               nullif(traffic_source_source, ''), '')) LIKE '%linkedin%'
                THEN 'linkedin'
           WHEN coalesce(nullif(param_source, ''),
                         nullif(traffic_source_source, ''), '(direct)') IN ('(direct)', '(none)')
                THEN 'direct / untagged'
           ELSE 'other referral' END, event_ts) AS origin
  FROM {EVENTS}
  WHERE device_web_hostname = '{SITE_HOST}' AND ga_session_id IS NOT NULL
  GROUP BY 1
),
dedup AS (
  SELECT sk, path, event_ts FROM (
    SELECT sk, path, event_ts,
           LAG(path) OVER (PARTITION BY sk ORDER BY event_ts) AS prev
    FROM kept
  ) w WHERE prev IS NULL OR prev <> path
),
stepped AS (
  SELECT sk, path,
         ROW_NUMBER() OVER (PARTITION BY sk ORDER BY event_ts) AS step,
         COUNT(*) OVER (PARTITION BY sk) AS steps_total
  FROM dedup
),
topn AS (
  SELECT path FROM (
    SELECT path, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rn
    FROM dedup GROUP BY path
  ) t WHERE rn <= {TOPN}
),
labeled AS (
  SELECT s.sk, s.step, s.steps_total,
         CASE WHEN s.path = '/' THEN 'homepage'
              WHEN s.path = '{GATE}' THEN '{GATE}'
              WHEN s.path IN (SELECT path FROM topn) THEN s.path
              ELSE '(other site pages)' END AS node,
         s.path AS raw_path
  FROM stepped s
)
SELECT 'origin' AS kind, 0 AS c, x.origin AS a, l.node AS b, COUNT(*) AS n
  FROM labeled l JOIN src x ON x.sk = l.sk
  WHERE l.step = 1 GROUP BY 1,2,3,4
UNION ALL
-- strictly < MAXSTEP: the last real step lands in column MAXSTEP, and the column
-- after it belongs to outcomes alone. Letting step MAXSTEP flow onward puts page
-- nodes inside the outcome column, which is how the first run rendered a stack of
-- stray page labels next to BOOKED/EXIT.
SELECT 'flow', a.step, a.node, b.node, COUNT(*)
  FROM labeled a JOIN labeled b ON a.sk = b.sk AND b.step = a.step + 1
  WHERE a.step < {MAXSTEP} GROUP BY 1,2,3,4
UNION ALL
SELECT 'continues', {MAXSTEP}, node, '__CONTINUES__', COUNT(*)
  FROM labeled WHERE step = {MAXSTEP} AND steps_total > {MAXSTEP} GROUP BY 1,2,3,4
UNION ALL
SELECT CASE WHEN raw_path = '{GATE}' THEN 'end_gate' ELSE 'end_exit' END,
       step, node, '', COUNT(*)
  FROM labeled WHERE step = steps_total AND steps_total <= {MAXSTEP}
  GROUP BY 1,2,3,4
"""

META_SQL = f"""
SELECT CAST(MIN(event_date) AS STRING), CAST(MAX(event_date) AS STRING),
       COUNT(DISTINCT concat(user_pseudo_id, '|', CAST(ga_session_id AS STRING))),
       COUNT(*)
FROM {EVENTS}
WHERE device_web_hostname = '{SITE_HOST}' AND event_name = 'page_view'
  AND ga_session_id IS NOT NULL
"""


def main():
    if not WAREHOUSE:
        sys.exit("Set LAKEHOUSE_WAREHOUSE_ID to your SQL warehouse id first "
                 "(not committed: this repo is public).")
    first_day, last_day, all_sessions, pageviews = sql(META_SQL)[0]
    rows = sql(FUNNEL_SQL)

    flows, ends = collections.Counter(), collections.Counter()
    for kind, c, a, b, n in rows:
        c, n = int(c), int(n)
        if kind in ("origin", "flow", "continues"):
            flows[(c, a, b)] += n
        elif kind == "end_gate":
            ends[(c, a, "booked")] += n   # "booked" slot = reached the form
        else:
            ends[(c, a, "exit")] += n

    included = sum(n for (c, _a, _b), n in flows.items() if c == 0)
    reached = sum(n for (_c, _a, e), n in ends.items() if e == "booked")

    out = {
        "meta": {
            "source": "Warehouse web-analytics sessions, marketing site only "
                      "(aggregate; no identifiers read or emitted)",
            "date_range": [first_day, last_day],
            "sessions": included,
            "pageviews": int(pageviews),
        },
        "pages": [], "edges": [],
        "sankey": {
            "maxstep": MAXSTEP,
            "mode": "lakehouse",
            "origins": sorted({a for (c, a, _b) in flows if c == 0}),
            "included": included,
            "excluded": {"sessions with no qualifying page view":
                         int(all_sessions) - included},
            "appHopsElided": 0,
            "reachedForm": reached,
            "flows": [{"c": c, "from": a, "to": b, "n": n}
                      for (c, a, b), n in sorted(flows.items())],
            "ends": [{"c": c, "from": a, "end": e, "n": n}
                     for (c, a, e), n in sorted(ends.items())],
        },
    }

    js = json.dumps(out, separators=(",", ":"))
    if "--stdout" in sys.argv:
        print(js)
        return

    # same trick as build_data.py: the page is a byte copy of sankey.html, so the
    # two never drift; only the injected DATA and SK.mode differ
    src = (HERE / "sankey.html").read_text(encoding="utf-8")
    dst = HERE / "sankey-lakehouse.html"
    dst.write_text(src, encoding="utf-8")
    html = dst.read_text(encoding="utf-8")
    s, e = "/*DATA-START*/", "/*DATA-END*/"
    i, j = html.index(s) + len(s), html.index(e)
    dst.write_text(html[:i] + js + html[j:], encoding="utf-8")
    # ASCII only: the default Windows console codepage cannot encode arrows
    print(f"wrote {dst.name}: {included:,} sessions, {reached:,} reached the form "
          f"({reached / included * 100:.2f}%), {first_day} -> {last_day}, "
          f"{len(out['sankey']['flows'])} flows")


if __name__ == "__main__":
    main()
