# Journey Gravity — absorbing Markov chain over real site journeys
**Version**: 1.2.0
**Author**: Caio Camargo + Claude
**Date Created**: 2026-08-12
**Last Updated**: 2026-08-12
**Purpose**: Model + visualization of where a website's pages pull their visitors — toward a booked meeting or toward leaving
**Status**: Active

---

## The idea

Take real page-by-page journeys of ICP leads across three properties (marketing site,
product dashboard, docs), fit an **absorbing Markov chain** over them, and ask each page a
question no per-page analytics view answers: *if a visitor is standing here, what is the
probability their story ends in a booked meeting?* We call that the page's **gravity**.

This is the first utilitarian exploration — the data is real work data, the math is the fun.

## Data and anonymization contract

- Source: `icp-journeys-full-pages.csv` (page-level journeys: 53 visitors, 245 sessions,
  1,199 pageviews, 2026-06-01 → 2026-07-20) joined with `icp-journeys-full.csv`
  (per-visitor outcome: Meeting Scheduled / Cancelled / Not Scheduled), both in a private
  workspace outside this repo (`JOURNEY_DATA_DIR` — see `build_data.py`).
  **Neither file is in this repo.**
- [`build_data.py`](build_data.py) reads them and injects an aggregate JSON into
  [`index.html`](index.html) between `/*DATA-START*/ … /*DATA-END*/` markers. The aggregate
  contains **page paths, transition counts, dwell sums, and fate-labeled counts only** — no
  emails, no identities. Dashboard agent URLs are collapsed to `…/agents/:agent`.
- The build script PII-scans were done at build time (regex for emails and `agent_…` ids —
  clean). Anything committed here is aggregate-only by construction.

## The model

**States.** Every page is a transient state. Two absorbing states: `BOOKED` and `LOST`.
A virtual `START` state feeds session entry pages.

**Transitions.** Consecutive pageviews within a session are counted as transitions. The
*last page of each session* transitions to the visitor's eventual fate: `BOOKED` if that
visitor ever scheduled a meeting, `LOST` otherwise. This is **fate labeling**: all of a
booked visitor's sessions end in `BOOKED`, even early exploratory ones — see caveats.

**Smoothing.** Prior strength κ adds κ pseudo-transitions from every page to the absorbing
states, split by the global base rate. κ=0 trusts a 2-visit page's luck completely; large κ
shrinks everything to base. Default κ=2. The slider exists because with n=53 visitors the
interesting question is *which rankings survive shrinkage*.

**Quantities** (all solved by Jacobi iteration in the page, live under the κ slider):

- Gravity: `g = b + Q·g`, where `Q` is the transient transition matrix and `b` the direct
  probability of absorbing into `BOOKED`.
- Expected remaining pageviews: `t = 1 + Q·t`.
- Expected remaining time: `T = w + Q·T`, with `w` = mean dwell per visit (semi-Markov:
  each state has a holding time).

**Self-loops** (page reloads) are kept in the counts but the display hides them by default —
they provably don't change absorption probabilities, only expected times. The toggle's
tooltip states this; it's the kind of fact the model teaches for free.

## What it showed (κ=2, min 8 visits)

Base rate: **75.1%** session-weighted (81% visitor-level, 43/53 — booked visitors browse
more sessions, which drags the session-weighted base down). Model start-of-session
prediction: 74.5% — consistent with base, a sanity check that the chain is coherent.

**High gravity — the road to booked (~+6–8 pp over base):**

| Page | Gravity | Reading |
|---|---|---|
| `docs…/reliability/debug-call-disconnect` | 83% | Debugging a real call = already invested |
| `dashboard…/call-history` | 83% | Inspecting real calls — the product is in use |
| `dashboard…/knowledgeBase` | 81% | Building an actual agent |
| `dashboard…/live-monitoring` | 81% | Watching production traffic |
| `/enterprise-plan` | 80% | Self-qualifying on the marketing side |

**Low gravity — attention sinks (~−2–13 pp under base):**

| Page | Gravity | Reading |
|---|---|---|
| `dashboard…/billing` | 62% | Cost-checking without commitment |
| `dashboard…/` (root) | 63% | Landed in the product but going nowhere |
| `/` (homepage) | 71% | Lingering on marketing ≠ intent |
| `dashboard…/analytics` | 72% | — |
| `/pricing` | 73% | High-traffic, slightly below base |

The single sentence the picture earns: **depth of product engagement predicts booking far
better than marketing-page attention — and the billing page is where intent goes to die.**
Directionally unsurprising; the value is that it's now *quantified per page* with a model
whose knobs are visible, rather than a hunch.

### The gate (domain datum from Caio, v1.2)

`/enterprise-plan` is not just another page — it hosts the demo-request form, so it is the
mechanical gate every booking passes through. The data agrees it's special:

- `/enterprise-plan → BOOKED` is the **largest single absorbing edge**: 41 of 184 booked
  session-ends (22.3%) happen there.
- When a session ends on it, it ends booked 41:8 (84%) — far above its 80% gravity.
- It is a destination, not a landing page: 74 of its 78 visits arrive from other pages
  (only 4 session entries).

The layout now encodes this: the gate is **pinned in the doorway** between the graph and
BOOKED (exempt from the fate force — its position states its role), drawn with a dashed
ring in BOOKED's green and a permanent GATE label. Domain gates live in a one-line
`GATES` set at the top of the script.

## Caveats — read before believing

1. **n = 53 visitors.** Everything above survives κ up to ~10, but this is a cohort sketch,
   not a measurement instrument. The κ slider is the honesty control.
2. **Fate labeling over-credits.** Every session of a booked visitor ends `BOOKED`,
   including sessions before they booked. Gravity is therefore closer to "P(this page's
   visitor is the booking kind)" than "P(this visit leads to booking)". Proper credit
   assignment (only the final pre-booking session ends `BOOKED`) is the top open thread.
3. **Correlation, not causation.** Call-history doesn't *make* people book; serious people
   visit call-history. Don't reroute the nav based on this alone.
4. **ICP-filtered cohort** — already qualified leads, hence the 75% base. A general-traffic
   chain would look completely different.
5. Dwell is missing on ~30% of pageviews (treated as 0), so expected-time figures
   underestimate.

## How it's built

Single self-contained `index.html` (no deps, no build): hand-rolled force layout (O(n²)
repulsion, log-weighted springs, pinned START/BOOKED/LOST anchors), canvas renderer with
traffic particles along edges, the Markov solver re-runs live on κ changes.

**v1.1 legibility pass** (from looking at v1 and squinting):
- **Fate layout** (default on): each page is pulled vertically toward
  `y = lerp(LOST.y, BOOKED.y, gravity)` — height becomes the model's output, so the picture
  reads without hovering. Vertical center-gravity is nearly disabled while it's on (the two
  fought; the fate force must own the axis). ~300 physics ticks run synchronously at boot so
  the first paint is already a formed map.
- **Focus mode**: hovering/selecting dims everything outside the node's direct neighborhood;
  particles only travel lit edges.
- **Ghost tail**: pages under the "min visits (map)" threshold render as faint, edgeless,
  unlabeled dots — the long tail stays visible as texture without shouting.
- Contrast: sqrt easing on the diverging ramp (near-base differences register) and sqrt
  scaling on edge width/alpha (mid-traffic edges stop vanishing); canvas labels get a dark
  halo and greedy vertical decollision. Dark-mode
palette validated with the dataviz six-checks validator (categorical trio all-pairs pass on
`#0b0d12`; diverging blue↔red for gravity; status green/red reserved for the absorbing
states). Hover tooltips, click-to-inspect detail panel (outgoing distribution per page),
sortable full-data table for accessibility.

## Verification

- Model: no NaNs; all gravities in [0.50, 0.88]; κ→large shrinks toward base monotonically
  (checked `/changelog`: 78.8% at κ=2 → 76.5% at κ=20); start-of-session ≈ base.
- UI: detail panel, table sort, color-mode switches, legend swaps — exercised via scripted
  DOM checks in the embedded browser.
- Visual: verified from headless-Chrome screenshots (the preview pane wouldn't composite
  again); layout fixes (panel-aware anchors, label halos, stronger repulsion) came from
  actually looking, which numeric checks would never have caught.

## Open threads

- [ ] **Proper credit assignment** — only the last pre-booking session absorbs into
      `BOOKED`; earlier sessions end in a neutral `EXIT`. Compare rankings.
- [ ] **Edge-level fate coloring** — paint each transition by the fate mix of walks using it;
      would show *routes*, not just pages.
- [ ] **Per-channel chains** — `heard_about` is in the source data; a chatgpt-referred chain
      vs a google-search chain would answer whether channels shape journeys or just volume.
- [ ] **Betweenness on booked paths** — which pages are bridges rather than destinations.
- [ ] Re-run monthly as the journey exports refresh; the build script is one command.
