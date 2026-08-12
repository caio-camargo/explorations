# Journey Gravity — absorbing Markov chain over real site journeys
**Version**: 2.2.0
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
- These CSVs are **point-in-time exports**; since 2026-08-12 the upstream source of truth
  is the company's Databricks lakehouse, and refreshes should be regenerated from there
  (the source→table mapping is documented in the private workspace, not here). The chart
  header always shows the window the current data actually covers.
- [`build_data.py`](build_data.py) reads them and injects an aggregate JSON into
  [`index.html`](index.html) between `/*DATA-START*/ … /*DATA-END*/` markers. The aggregate
  contains **page paths, transition counts, dwell sums, and fate-labeled counts only** — no
  emails, no identities. Dashboard agent URLs are collapsed to `…/agents/:agent`.
- The build script PII-scans were done at build time (regex for emails and `agent_…` ids —
  clean). Anything committed here is aggregate-only by construction.

## The model

**States.** Every page is a transient state. Two absorbing states: `BOOKED` and `LOST`.
A virtual `START` state feeds session entry pages.

**Transitions.** Consecutive pageviews within a session are counted as transitions. What a
session's *last page* absorbs into is a modeling choice, and v1.3 exposes it as a toggle
(this was born from Caio spotting that v1.2 drew BOOKED edges from pages you cannot book on):

- **Visitor fate** (the original): every session end absorbs into the visitor's eventual
  outcome — `BOOKED` if they ever scheduled, `LOST` otherwise. All of a booked visitor's
  sessions end in `BOOKED`, even early exploratory ones. Answers *"is this page's visitor
  the booking kind?"*
- **Booking event** (default since v1.3, the strict semantics): booking mechanically happens
  only at the gate, so only gate session-ends by scheduled visitors absorb into `BOOKED`;
  every other session end — including a booked visitor's other sessions — is a neutral
  `EXIT`. Answers *"does this walk reach the form and book?"* In this mode the map shows a
  single green edge, gate → BOOKED, which is the truth of the mechanism.

`BOOKED` means **meeting scheduled**, nothing stronger — held-rate is not measured in the
source data. `Cancelled` visitors count as booked (the scheduling event happened); in the
current 53-visitor cohort this reclassification changes nothing (no `Cancelled` visitors
present), but the rule is in `build_data.py` for future refreshes.

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

### The denominator was the story all along (v2.2)

The Sankey's refinements came back to the graph via
[`docs/research/journey-viz-refinements.md`](../../docs/research/journey-viz-refinements.md).
The consequential one was **the inclusion rule**: event-mode gravity was being computed over
*all* 245 sessions, including 132 that never leave the product and 16 docs-only ones. Those
sessions cannot reach the form — counting them as non-bookings measures the wrong thing.

Restricted to the 97 sessions that touch the marketing site at least once, the base rate goes
from **16.7% → 42.3%**, and every page's gravity moves with it (the gate reads 69%, pricing
48%, homepage 44%). Same data, same model, honest denominator: the funnel is far less leaky
than the first reading suggested. Both denominators ship as a toggle with the exclusion counts
printed on the page — a denominator is a modeling decision and should be visible, not implied.

Three further transfers changed what the picture *claims*:

- **`→ APP` is now its own absorbing state.** Ending a session inside the product is not
  "lost" — it's a handoff. 15 of the 97 site-touching sessions end that way (155 of 245 in
  all-sessions scope, which is exactly why that denominator drowned everything). The model
  still counts them as non-bookings; the chart no longer calls them failures.
- **`START` became the origin channels.** An "every session begins" node carries zero
  information; self-reported origin carries some. chatgpt (26), other/unlisted (24),
  google (23), app dashboard (14), recommendation (10) — each with its own predicted
  P(booked), all within a few points of each other, and each tooltip carrying the
  under-attribution caveat.
- **Outcome nodes are sized by what they absorb**, with counts and shares printed beneath.
  Their radius is now the outcome distribution — previously they were fixed-size chrome.

### The two lenses disagree — and that's the finding (v1.3)

Switching to booking-event semantics **inverts the ranking**. Under event mode (base 16.7%
of sessions book): `/pricing` 38% and the homepage 34% lead, while the whole dashboard drops
to ~5–7% (call-history 5.0%, agent builder 5.8%). Under fate mode those same dashboard pages
are the top predictors.

Read together, they describe the company's actual product-led motion (corroborated by an
internal demand-gen readout, qualitatively): there is a **marketing lane** (homepage →
pricing → gate) where booking *happens*, and a **product lane** (build → run calls →
inspect) that shapes *who* books. Product sessions rarely end at the form — people book in a
separate, shorter, marketing-shaped session. Neither lens alone tells the truth; the toggle
is the insight.

### The funnel view ([sankey.html](sankey.html), v1.4 → v1.5)

The same aggregate, step-indexed: each Sankey column is one step into a session (consecutive
reloads collapsed), ribbons flow left to right, bookings leave as green stubs at the step
where they happen (event semantics — green exists only at the gate), everything else exits
or pools into "still browsing" past the last column.

**v1.5 best-practice pass** (per the research doc, applied by the parallel Sankey session):
the full-width terminal BOOKED/EXIT bands were replaced with **per-column stubs** — the
convention for drop-off funnels, and the fix for the arcs that were manufacturing crossings;
node ordering became gate-anchored to cut crossings further; the non-booking mass was
softened so the story flows stay loudest; a **table twin** closed the accessibility gap; and
the scale became gap-aware. (Both pages now cross-link — a "funnel"/"graph" button in the
header.)

**v2.1 — the all-traffic funnel** ([sankey-all.html](sankey-all.html)). Same page code as
the ICP funnel — `build_data.py` byte-copies `sankey.html` and injects a different dataset;
`SK.mode` drives the wording, so the two can never drift. Data: Warmly identified-visitor
exports from the private intake (row-level deduped — the folder holds re-exports of the
same window in different byte order plus a week file inside a month file; 10,085 duplicate
rows dropped, and the 10k-row export cap is printed as a caveat). 22,804 identified
sessions across two windows; marketing site only (all Warmly instruments); `Pages Viewed`
order treated as chronological (59% of multi-page rows start at the homepage; sequences
read narratively). **Green here means "session's last page is the demo-request form" —
submission/booking is not observable at this scale**, and the page says so. Origins from
UTM tags (85% untagged/direct — the attribution hole, printed). The pair of funnels is the
finding: ICP leads convert ~39%; full identified traffic reaches the form 1.8% of the time
(411/22,804, still peaking at steps 2–3), with a 22,020-session EXIT wall of single-page
visits. Same site, same weeks — the difference between the two charts is what
"qualified" means.

**v2.0 — the inclusion rule** (Caio: every user shown must have passed through at least one
www page). The funnel's population is now defined, not inherited: 97 marketing sessions;
132 pure-app and 16 docs-only sessions excluded (counted in the header). All 38 bookings
retained by construction — booking requires the gate, a www page. Docs pages stay as steps
inside qualifying journeys (which pages feed them, where they lead). Also: `/` renamed
**homepage**, "(other www)" → **"(other site pages)"** ("(other docs pages)" likewise).
The reframe this produced is the strongest single finding of the series: **BOOKED·38 vs
EXIT·36 — the marketing funnel converts ~39% of its true sessions.** The "leak" in every
earlier version was app traffic that was never the marketing funnel's to lose. A funnel's
denominator is a modeling decision, and it was hiding the conclusion.

**v1.9 — the app is an origin and an outcome, never a middle step** (Caio's structural
insight, checked against the data first). Bounce-back is the minority he suspected: of 245
sessions, 132 are pure-app, 71 never touch the app, 13 dive in and stay, and only 29 return
from app to marketing — but 19 of those simply *start* in the app, and 11 of the 29 end at
the gate (the product-lane booking path), so returns are preserved structurally rather than
spliced: leading app-runs become the **app dashboard origin** (151 sessions), trailing runs
the **app dashboard outcome** (153), pure-app sessions one direct origin→outcome ribbon,
and only 23 interior marketing→app→marketing hops are elided (counted on the chart). Side
effects that made the model better: BOOKED found a 38th session and "still browsing"
dropped 28→10 — most "long" journeys were only long inside the app; their marketing part is
short. EXIT shrank to 44: the marketing funnel leaks far less than the app-blind view
implied. The v1.7 expand-toggle retired (the restructure needs session sequences, so it
lives in `build_data.py`, not the page).

**v1.8 — origins replace the mute START bar** (Caio: "the big START bar gives us no
information"). Column 0 now splits sessions by the visitor's self-reported discovery
channel: google · 57, chatgpt · 38, recommendation · 11, other/unlisted · 139
(session-weighted; per-visitor it's 16/16/6/15). Directional only — `heard_about` is
self-reported and known to under-attribute (caveat printed on the chart and in tooltips).
What it shows immediately: google/chatgpt sessions feed the marketing lane, while the
other/unlisted mass is dominated by returning app sessions — the heavy product users are
exactly the ones attribution can't see. Also in v1.8: "dashboard app" renamed to
**app dashboard**; extra air below gate nodes after Caio mis-read the homepage→gate ribbon
(31 sessions, the biggest marketing transition) as a gate→gate self-flow — verified no
same-page step-transitions exist (reload-collapsing holds; only "(other …)" buckets
self-flow, which is different tail pages sharing a bucket).

**v1.7 — the app as one lane** (Caio: this is a marketing view; who enters and leaves the
dashboard matters, where they go inside it doesn't). All `dashboard.*` pages collapse into a
single "dashboard app" node per column — the app becomes one calm river along the bottom
(narrowing as sessions exit, feeding "still browsing"), marketing↔app crossovers stay
visible as strands between the lanes, and the marketing story owns the top half. A header
toggle expands the detail (51 nodes/155 ribbons collapsed ↔ 91/297 expanded; conservation
verified at 245 both ways). Audience framing beats completeness: the collapsed default is
the honest chart *for the question being asked*.

**v1.6 — terminal outcome column** (Caio: "shouldn't book aggregate into one band at the
end? The vertical aggregate height lets us compare that to other outcomes"). Correct, and
the research supports it: stubs answer *where* sessions end but fragment the totals; the
classic Sankey/alluvial answer to *how much ends where* is terminal nodes whose heights
compare directly. Now the last column is the outcome distribution — BOOKED·37,
still browsing·28, EXIT·180 stacked — while per-departure counts stay printed on each green
ribbon, keeping both answers (the hybrid is written up in the research doc §"Per-stage
stubs vs. terminal aggregation"). Unlike the rejected v1.4 band, outcomes are nodes in the
flow's grain: rightward ribbons, exit mass painted at the back, the green story on top.

What the step indexing adds that the graph can't show: **the modal booked session is two
steps long** — of 37 booking sessions, 16 book at step 2 and 9 more at step 3; it's
land → form → book, not a wander. Meanwhile the sessions that survive to step 6+ are almost
entirely dashboard sessions heading for "still browsing", not for the form. The funnel and
the two-lens finding agree: booking is a short marketing-lane errand, often by people whose
long sessions happened elsewhere.

Conservation checked programmatically: 245 sessions in; 37 booked + 180 exits +
28 still-browsing out; every column's inflow equals its outflow.

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
2. **Fate labeling over-credits** (visitor-fate mode only). Every session of a booked
   visitor ends `BOOKED`, including sessions before they booked. The booking-event mode
   (v1.3) is the strict alternative; the remaining refinement — absorbing only the final
   pre-booking session — is an open thread.
3. **Correlation, not causation.** Call-history doesn't *make* people book; serious people
   visit call-history. Don't reroute the nav based on this alone.
4. **ICP-filtered cohort** — already qualified leads, hence the high fate-mode base. A
   general-traffic chain would look completely different (see the all-traffic funnel).
4b. **The denominator is a choice, and it dominates.** Event-mode gravity reads 16.7% base
   over all sessions and 42.3% over site-touching ones. Neither is wrong; quoting either
   without saying which is. The toggle and its exclusion counts are on the page for this
   reason.
4c. **Origin channels are self-reported** (asked at form fill) and under-attribute several
   real discovery paths — the origin split is a segmentation, not an attribution model.
5. Dwell is missing on ~30% of pageviews (treated as 0), so expected-time figures
   underestimate. Relatedly, very short bounce sessions are systematically
   under-represented by the session-matching pipeline that produced the source data.
6. **Some gate EXITs are technical, not motivational.** Known form/scheduler failure modes
   (no submit acknowledgement; the embedded scheduler failing to load for some visitors)
   mean a session ending at the gate without a booking may be a *broken* booking rather
   than lost intent. The gate's detail panel carries this warning.
7. **Right-edge truncation.** Outcome classification degrades near the export's end date,
   so late-window "not scheduled" visitors may simply be unclassified.
8. **`heard_about` is self-reported and incomplete** — a caveat waiting for the per-channel
   open thread: channel labels under-attribute several real discovery paths.

(Caveats 5–8 paraphrase an internal domain brief; precise figures live outside this repo.)

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

**v2.2** — the refinement log applied (see "The denominator was the story all along").
Mechanically: `build_data.py` gained three additive keys — `edgesWww` (the same chain over
site-touching sessions only), `entryOrigins` (entries split by channel, per scope), and
`inclusion` (session counts + exclusion reasons); every visit read in the page routes
through a scope accessor so one toggle re-denominates the whole model. Verified: absorption
totals conserve to the session count in both scopes (41 + 41 + 15 = 97; 41 + 49 + 155 = 245),
origin entries sum to the scope's session count, and green edges still originate only at the
gate. Human labels landed too — `/` reads "homepage", dashboard paths read `app/…`, and the
folded nodes are "(other site/app/docs pages)".

**v1.5** — spacing pass on the graph, applying
[`docs/research/dataviz-sankey-best-practices.md`](../../docs/research/dataviz-sankey-best-practices.md)
Part 1 to the force layout (the research was produced for the Sankey; its general
principles transfer):

- **Fold minors into "Other"** (§2.2, the anti-spaghetti rule): pages below the threshold no
  longer float as ghost dots — they collapse into one dashed `(other www / dashboard / docs)`
  node per property that **carries their traffic with it**, so edge weight is conserved
  (verified: 1,199 in = 1,199 out). At the default threshold that's 67 pages folded into 3
  nodes; 117 pages → 56 visible marks, 442 → 341 drawn transitions. The slider unfolds them.
- **Rank-spaced fate axis**: height now encodes gravity *rank*, evenly spaced, instead of the
  raw value. The event-mode distribution is heavily skewed (a long low tail, a few leaders),
  so a linear axis piled two-thirds of the pages into one band — the ranking was invisible
  precisely where it mattered. Colour still carries the true value, so the pair reads as
  "order by height, magnitude by hue".
- **Pairwise collision resolution**: no two visible nodes may overlap, and nodes big enough to
  carry a label claim extra room. Verified 0 overlapping pairs after settling.
- Legend gained the "height = gravity rank · colour = gravity" caption and an `(other …)` key.

**v1.3.1** (design notes from Caio): the layout pre-settles ~1200 ticks and boots cold, so
the first paint is a still map instead of a settling scramble. Dragging became meaningful:
**dropping a node pins it** (small white pin dot; double-click releases one, re-layout
releases all) — the map is customizable. And the gate moved flush against BOOKED with an
x-clamp on free pages, so **nothing stands between the form and the meeting**.

**v1.4**: sibling page [`sankey.html`](sankey.html) — hand-rolled SVG Sankey over
step-indexed flows (`build_data.py` now emits `sankey.flows`/`sankey.ends` and injects into
every marker-bearing HTML in the folder). Top pages keep names; the tail folds into
"(other <prop>)" per property; ends use event semantics. Hover highlights a node's ribbons
(matched by column+id, not substring). Cross-linked with the graph page.

**v1.3**: absorption-semantics toggle (booking event vs visitor fate — see The model),
human page meanings on tooltips and the detail panel, mode-aware legends and ranked-list
framing, gate failure-mode warning. Display edges are rebuilt per mode, so the graph itself
tells the chosen story (event mode: one green edge).

## Open threads

- [ ] **Session-level credit assignment** — within visitor-fate mode, absorb only the last
      pre-booking session into `BOOKED`; earlier sessions end neutral. The middle ground
      between the two v1.3 lenses.
- [ ] **Edge-level fate coloring** — paint each transition by the fate mix of walks using it;
      would show *routes*, not just pages.
- [ ] **Per-channel chains** — `heard_about` is in the source data; a chatgpt-referred chain
      vs a google-search chain would answer whether channels shape journeys or just volume.
- [ ] **Betweenness on booked paths** — which pages are bridges rather than destinations.
- [ ] Re-run monthly as the journey exports refresh; the build script is one command.
