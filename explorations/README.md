# Explorations — branch index
**Purpose**: Inventory of every exploration. One folder per idea; add a row here when you start one.
**Status**: Active

---

An exploration is a small self-contained thing built to answer "what happens if…". It is done
when it's interesting, not when it's finished. Nothing here needs to become a product.

## Contract

- One folder per exploration: `explorations/<slug>/`
- Every folder has a `NOTES.md` — the idea, how it works, and **what it taught**. The notes
  are the point; the code is the byproduct.
- Prefer a single self-contained file that opens with no build step and no dependencies.
- Add a row to the table below when you start. That is the only bookkeeping required.

## Index

| Exploration | Started | What it is | Status |
|---|---|---|---|
| [`dots-friend-enemy/`](dots-friend-enemy/) | 2026-08-10 | Dots that chase one friend and flee one enemy — [notes](dots-friend-enemy/NOTES.md), [run it](dots-friend-enemy/index.html) | **v2.6** — ribbon trails, 5 looks, friend-graph basins, bow-shock influences, stalking predator, 4 agent styles. Resume from "Picking this up cold" in the notes |
| [`fireflies/`](fireflies/) | 2026-08-11 | Pulse-coupled fireflies — sync emerging from flashes alone (Mirollo–Strogatz) — [notes](fireflies/NOTES.md), [run it](fireflies/index.html) | v1.3 — parameter atlas, live regime label, soft glow, depth-of-field + pond |
| [`slime-mold/`](slime-mold/) | 2026-08-11 | Physarum transport networks — veins from three whiskers and a scent trail (Jones 2010) — [notes](slime-mold/NOTES.md), [run it](slime-mold/index.html) | v1.2 — food: emission plumes, depletion (~2000-step source lives), rain, commuters; click to feed |
| [`evolution/`](evolution/) | 2026-08-11 | Evolution arena — foragers with heritable mutating genomes; selection tunes them live — [notes](evolution/NOTES.md), [run it](evolution/index.html) | v2.1 — co-evolving predators; +17% speed optimum under predation (A/B); heritable vigilance + sprint escape (sense punishment → neutrality; encounter rate identified as next constraint) |
| [`journey-markov/`](journey-markov/) | 2026-08-12 | Journey Gravity — absorbing Markov chain over real (anonymized) site journeys; per-page P(ends booked) — [notes](journey-markov/NOTES.md), [run it](journey-markov/index.html) | v1.5 — 53-visitor ICP cohort; two absorption lenses that invert the ranking (booking event: marketing lane leads; visitor fate: product depth leads); [ICP funnel](journey-markov/sankey.html) + [all-traffic funnel](journey-markov/sankey-all.html) sibling pages — ICP converts ~39%, full identified traffic reaches the form 1.8%. Third dataset [warehouse funnel](journey-markov/sankey-lakehouse.html) — 225k sessions straight from the lakehouse, 1.54% reach the form. Refinement log for transfer: [journey-viz-refinements](../docs/research/journey-viz-refinements.md). Published with Caio's sign-off 2026-08-12 (aggregate data only) |
