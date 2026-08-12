# Journey-viz refinements — the Sankey iteration log, written for transfer
**Version**: 1.0.0
**Author**: Caio Camargo + Claude
**Date Created**: 2026-08-12
**Last Updated**: 2026-08-12
**Purpose**: Every refinement made across sankey.html v1.4 → v2.0, with the principle behind it and its applicability to the gravity graph (`explorations/journey-markov/index.html`) or any future visualization
**Status**: Active

---

Each row: what changed, why it mattered, and whether it transfers to the gravity graph.
"Applies" means worth doing there; "done" means the graph already has it; "decision" means
it would change the graph's meaning and needs a call.

## 1. Structural refinements (change what the chart *is*)

| # | Refinement (version) | Principle | Gravity graph? |
|---|---|---|---|
| 1 | **Terminal outcomes as comparable heights** (v1.6) — outcomes became stacked terminal nodes; their heights ARE the outcome distribution | Fragmented ends answer *where*; aggregated terminals answer *how much*. Keep both: per-departure labels + terminal magnitude | **Applies**: BOOKED/LOST/EXIT nodes have fixed radius; sizing them by absorption counts would make outcome magnitude readable at a glance |
| 2 | **The app at the edges, never the middle** (v1.7→v1.9) — app pages collapsed, then moved to origin (session starts in product) + outcome (marketing hands off to product) | The audience's question defines the resolution. For a marketing question, in-app movement is noise but app entry/exit is signal | **Decision**: the graph's visitor-fate mode *needs* app pages (product depth predicts who books — its core finding). A "marketing view" toggle that collapses the dashboard could sharpen event mode, but must not become the only view |
| 3 | **The inclusion rule / explicit denominator** (v2.0) — only sessions touching ≥1 www page count; exclusions printed in the header | A funnel's denominator is a modeling decision; the wrong one hides the conclusion (39% conversion was invisible under the polluted denominator) | **Applies, high impact**: the graph's event-mode base rate (16.7%) still includes pure-app sessions. Recomputing gravity over www-touching sessions only would change every number — probably toward the same "less leaky than it looks" reframe. The most consequential transfer on this list |
| 4 | **Info-free structural nodes must earn their space** (v1.8) — START split into self-reported origin channels, caveat printed | If a node carries zero information, replace it with a segmentation the audience cares about — with its reliability caveat attached | **Applies**: the graph's START node is the same mute bar; the same origin split (with the same caveat) works there |
| 5 | **Measure before restructuring** (v1.9) — bounce-back rate quantified (29/245, 11 ending at the gate) before deciding app treatment; the counterexamples shaped the design | A structural simplification proposed from intuition gets one cheap measurement first; the exceptions usually contain the story (the 11 were the product-lane bookings) | General practice — applies to every structural edit anywhere |

## 2. Semantic refinements (change what the chart *claims*)

| # | Refinement | Principle | Gravity graph? |
|---|---|---|---|
| 6 | **Strict event semantics** (inherited from graph v1.3, kept throughout) — green exists only where the mechanism exists | A chart must not draw transitions that are mechanically impossible | **Done** (originated there) |
| 7 | **Caveats printed on the chart, not just in notes** (v1.8–v2.0) — self-report warning, spliced-hop count, exclusion count all visible on the page | The share-target audience never reads NOTES.md; the chart must carry its own honesty | **Partially applies**: the graph's caveats (n=53, κ) live in tooltips and the panel; the base-rate/inclusion caveat would need surfacing if #3 is applied |
| 8 | **Outcome vocabulary discipline** — BOOKED defined as "meeting scheduled (held-rate not measured)" everywhere; EXIT ≠ handed-to-product | Distinct fates get distinct names; a catch-all "lost" bucket erases the difference between leaving and converting-elsewhere | **Applies**: the graph's LOST (fate mode) conflates "never booked" with "went to product and lives there." An APP-absorbing state in fate mode is the same v1.9 move |

## 3. Legibility refinements (change how fast the chart reads)

| # | Refinement | Principle | Gravity graph? |
|---|---|---|---|
| 9 | **Human labels at the point of reading** (v1.5→v2.0) — counts printed at ribbon departures; `/` → "homepage"; "(other www)" → "(other site pages)" | Labels answer the reader's question where their eyes already are; raw paths and internal jargon are debt | **Applies**: the graph shows `/` and raw paths too; same renames, and MEANING tooltips could become visible labels for the top nodes |
| 10 | **Anchor-adjacent ordering beats generic size-sorting** (v1.5) — with the gate pinned top, its feeder lane stays adjacent; tested both ways | Generic best practices assume free layout; a pinned anchor changes the rule. Test, don't assume | Graph equivalent is the pinned START/BOOKED/LOST + fate layout — already anchor-driven |
| 11 | **Soften the mass, bold the story** (v1.5, v1.9) — non-story flows at ~half opacity; z-order exit < flows < story | Emphasis is a layer decision, not just a color decision | **Applies**: in the graph, edges are weighted by traffic only; weighting opacity by story-relevance (paths toward the gate) in event mode would echo this |
| 12 | **Disambiguation air** (v1.8) — space below the gate after a wide neighbor ribbon was misread as gate→gate | If a viewer misreads geometry, the geometry is wrong — even when the data is right. Fix the layout, don't explain | General practice; the graph's label-decollision pass was the same class of fix |
| 13 | **Table twin for precise numbers** (v1.5) | A Sankey (or force graph) is bad at exact values; ship the table it's bad at | **Done** in the graph (sortable data table) |

## 4. Process refinements (how the iteration itself worked)

- **Conservation checked programmatically after every structural change** (origin column sum = outcome column sum = session count). Caught nothing only because it was checked.
- **Every version screenshotted before shipping** (headless Chrome when the pane won't composite). Layout bugs were only ever caught by looking.
- **Domain knowledge injected at each step changed the model, not just the cosmetics** — the gate datum (v1.2), the booking-mechanism challenge (v1.3), the marketing-view framing (v1.7–v2.0) each came from Caio, not the data. A viz iterated without the domain owner converges on pretty; with them, on true.
- **The best-practices research paid off double**: once as the v1.5 checklist, once as the vocabulary for arguing about the v1.6 terminal-aggregation question (stubs vs terminals was already written up when the question arrived).

## Suggested application order for the gravity graph

1. #3 inclusion rule (event mode) — biggest impact, changes the numbers honestly
2. #8 APP absorbing state in fate mode — dissolves the LOST conflation
3. #4 origin split of START
4. #1 size terminal nodes by absorption
5. #9 renames + visible labels
