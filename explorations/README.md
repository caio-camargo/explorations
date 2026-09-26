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
| [`dots-friend-enemy/`](dots-friend-enemy/) | 2026-08-10 | Dots that chase one friend and flee one enemy — [notes](dots-friend-enemy/NOTES.md), [run it](dots-friend-enemy/index.html) | **v2.7** — ribbon trails, 5 looks, friend-graph basins, stalking predator, 4 agent styles, and a hidden image the dots betray (`ouija`). Resume from "Picking this up cold" in the notes |
| [`fireflies/`](fireflies/) | 2026-08-11 | Pulse-coupled fireflies — sync emerging from flashes alone (Mirollo–Strogatz) — [notes](fireflies/NOTES.md), [run it](fireflies/index.html) | v1.3 — parameter atlas, live regime label, soft glow, depth-of-field + pond |
| [`slime-mold/`](slime-mold/) | 2026-08-11 | Physarum transport networks — veins from three whiskers and a scent trail (Jones 2010) — [notes](slime-mold/NOTES.md), [run it](slime-mold/index.html) | v1.2 — food: emission plumes, depletion (~2000-step source lives), rain, commuters; click to feed |
| [`evolution/`](evolution/) | 2026-08-11 | Evolution arena — foragers with heritable mutating genomes; selection tunes them live — [notes](evolution/NOTES.md), [run it](evolution/index.html) | v4 — predation EVOLVES: the predator species dissolved into a carnivory gene; carrion is the bridge (control without corpses: zero carnivores in 5k steps; with: a trophic pyramid and 24k kills); adaptive radiation + phylogeny strip |
| [`sky-floor/`](sky-floor/) | 2026-09-25 | Lo-fi surreal loop — an empty room whose floor is a drifting sky, a black orb bobbing in it, datamosh/macroblock glitch — [notes](sky-floor/NOTES.md), [run it](sky-floor/index.html) | v1.0 — 3 glitch levels, 10 s webm recorder |
| [`night-storm/`](night-storm/) | 2026-09-25 | LucasArts-era VGA pixel art — stormy coast, lighthouse beam, palette-swap lightning, working 9-verb interface — [notes](night-storm/NOTES.md), [run it](night-storm/index.html) | v1.6 — painted mode (214-colour long ramps) vs dithered (74), lit Voronoi cliff, boulders, wind-blown grass, CRT toggle; lighthouse lamp rotates in 3D with a bloom + glare when it faces you; v1.3 adds a walking lantern-carrying character (Claude) with SCUMM depth scaling and speech; v1.4 a swaying rope bridge + stairs to the lighthouse's (locked) door, via walk-box routing; v1.5 perspective-correct bridge + BFS pathfinding; **v1.6 the keeper's room inside the lighthouse** (Claude's bedroom: round ray-cast room, computed lamp/lantern/window lighting, 29 interactables with Claude-lore jokes, inventory + paperclip→drawer→key→door puzzle linking both rooms) |
| [`wuthering-heights/`](wuthering-heights/) | 2026-09-26 | *Wuthering Heights* ch. I as a LucasArts-style point-and-click: Lockwood's arrival, Heathcliff at the gate, the dogs, the frying pan — [notes](wuthering-heights/NOTES.md), [run it](wuthering-heights/index.html) | v1.0 — standalone fork of the night-storm engine grown into rooms/actors/async scripts/dialogue trees; two rooms, horse-at-the-gate puzzle, six-dog attack, playable start to end card; Brontë's text quoted verbatim |
| [`journey-markov/`](journey-markov/) | 2026-08-12 | Journey Gravity — absorbing Markov chain over real (anonymized) site journeys; per-page P(ends booked) — [notes](journey-markov/NOTES.md), [run it](journey-markov/index.html) | **Migrated 2026-08-14** to [caio-camargo/retell-viz](https://github.com/caio-camargo/retell-viz) (pages, build scripts, living notes — this folder keeps frozen notes + redirect stubs). Final state here: v1.5 — 53-visitor ICP cohort; two absorption lenses that invert the ranking (booking event: marketing lane leads; visitor fate: product depth leads); [ICP funnel](journey-markov/sankey.html) + [all-traffic funnel](journey-markov/sankey-all.html) sibling pages — ICP converts ~39%, full identified traffic reaches the form 1.8%. Third dataset [warehouse funnel](journey-markov/sankey-lakehouse.html) — 225k sessions straight from the lakehouse, 1.54% reach the form. Refinement log for transfer: [journey-viz-refinements](../docs/research/journey-viz-refinements.md). Published with Caio's sign-off 2026-08-12 (aggregate data only) |
