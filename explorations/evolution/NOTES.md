# Evolution Arena — selection in real time
**Version**: v1.0.0
**Date Created**: 2026-08-11
**Last Updated**: 2026-08-11
**Purpose**: Natural selection, watchable — foragers with heritable mutating genomes on a regrowing field
**Status**: Active — v1

---

## The idea

Foragers graze a regrowing field. Each carries a three-gene genome:

- **speed** — px per step; movement costs energy ∝ speed²
- **sense** — whisker reach; attention costs energy ∝ sense
- **patience** — how much energy to hoard before dividing in two

Eat → energy up. Live, move, sense → energy down. Energy gone → death. Energy past `patience`
→ divide, each gene nudged by log-normal mutation, and the child inherits its parent's hue ± a
small drift — so lineages are visible as colour.

That's all. **Nobody tunes the creatures.** The environment sets the prices (regrowth,
richness, metabolism) and selection does the tuning, live. There is deliberately no population
slider: population is an outcome, not a setting.

Run it: open [`index.html`](index.html). Watch the trait histogram slide. Press `m` for a
meteor (kills 90%) and watch recovery re-run selection. Switch environments mid-run — the
creatures stay, and the histogram walks to the new optimum.

## How it maps to code

One file, same skeleton as the other explorations (fixed logical world on a torus, Float32
field, dt-based stepping, per-step sampling). Sensing is the slime-mold whisker rule pointed at
grass instead of trail. New machinery: energy accounting, birth with mutation, death with
array compaction (swap-from-end — order is meaningless), and the histogram/sparkline overlay.

Design decisions:

- **Costs are convex in the traits** (speed², linear sense) so every trait has a genuine
  trade-off and the optimum is environment-dependent rather than "max everything".
- **Extinction is data, not an error** — the world reseeds 60 founders and increments a
  counter shown in the overlay.
- **Eat where you stand** (slime-mold lesson 4 applied preemptively — never gate eating on
  movement outcomes).
- **The refugium.** Grazing cannot strip a cell below 0.03 — a seed bank always survives.
  Without it, consumer-resource lag produces boom-bust limit cycles that bottom out in mass
  starvation (measured: the desert crashed 1,852 → 90 and burned through 2 extinctions in 6k
  steps). With it: same desert, zero extinctions, smooth approach to a stable ~500. One
  constant, and it's the difference between an ecosystem and a doomsday loop.

## What evolved (all measured, identical founders everywhere)

Founders: speed 1.2, sense 14, patience 160. Two environments, 6,000 steps each:

| | population | speed | sense | **patience** |
|---|---|---|---|---|
| **meadow** (rich, fast regrowth) | ~1,200 | 2.03 | 7.0 | **117** |
| **desert** (sparse, slow regrowth) | ~510 | 2.17 | 7.5 | **192** |

Three findings:

1. **Both worlds sell off senses** (14 → ~7). At these whisker prices, smell is a luxury —
   grazed-down fronts are locally smooth, so the gradient signal is weak. (Making sense worth
   its cost — patchier worlds — is the obvious next experiment.)
2. **Both worlds buy speed** (1.2 → ~2.1). Outrunning the grazed-down zone around you pays
   everywhere.
3. **The axis that truly diverges is life history.** The meadow breeds r-strategists — divide
   at 117, cheap and often. The desert breeds bet-hedgers — hoard to 192 before splitting,
   because a crash-prone world punishes small endowments. This is textbook r/K selection,
   and nobody programmed it: the same three cost constants, different grass.

Also verified: variance holds at mutation-selection balance (speed CV ≈ 0.13 — neither
collapsing nor exploding); meteor recovery 1,219 → 96 → 1,045 within 1,500 steps, zero
extinctions in meadow/desert/seasons post-refugium; first meadow run shows the classic
boom–overgraze–crash–recover arc (2,463 → 1,068 → stabilising ~1,400) before settling.

## Things worth trying next

- [ ] **Patchy worlds** — regrowth varying by region (or food dropped in clumps) should make
      `sense` finally worth buying; the meadow/desert sense-selloff is begging for this control.
- [ ] **Predators as a second evolving species** — closes the loop into co-evolution; prey
      speed would stop being a pure foraging trait.
- [ ] Speciation watch: with two resource types and a diet gene, lineage hues should split
      bimodally instead of drifting as one cloud.
- [ ] Click-to-paint fertile/barren ground (the participatory lever the other sims have).
- [ ] A phylogeny strip — time on x, lineage hues stacked by abundance; extinctions and
      takeovers would read like geological strata.
