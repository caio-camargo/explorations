# Evolution Arena — selection in real time
**Version**: v2.0.0
**Date Created**: 2026-08-11
**Last Updated**: 2026-08-12
**Purpose**: Natural selection, watchable — foragers with heritable mutating genomes on a regrowing field
**Status**: Active — v2 (co-evolving predators: pursuit, surprise, interference)

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

## The engine gene, and the correlation nobody programmed (v1.1)

User feedback: lineage and sense colours were near-monotone even at high mutation, and
"maybe metabolism itself can be an inherited trait that trades off against hunger rate and
speed."

**The colour problems were two separate defects.** Sense mapped the trait's *legal* range
[3,40] to the ramp while the population lived in a ~10% sliver of it — every dot the same
blue. Dots (and histogram bars) now map the population's own running p5–p95, so the full ramp
is always in use; the histogram keeps fixed axes for absolute truth and prints the current
p5–p95 to connect the two views. Lineage hue drift was small and — as the user suspected —
**not connected to the mutation slider at all**; it now scales with it (±10° per birth at the
default σ). The residual monotony that remains is honest: coalescence. Successful families
take over, and hue diversity is pruned exactly the way surnames die out. When lineage mode
looks like one colour, that IS the finding — somebody recently won.

**The engine gene (metabolism as heredity).** Framed as engine size: idle burn scales *up*
with it (hunger rate), movement cost scales *down* (`speed²/engine` — a bigger engine makes
locomotion cheaper). Real physiology, and it makes a falsifiable prediction: minimising total
cost gives an interior optimum

```
engine* = speed · √(SPEED_COST / metabolism)
```

so fast lineages should evolve big engines — a gene–gene correlation that exists nowhere in
the code, only in the economics.

**Measured, meadow, founders at engine 1.0** (over-engined for their speed; predicted optimum
≈ 0.54):

| t | mean engine | corr(speed, engine) |
|---|---|---|
| 2,500 | 0.82 | 0.08 |
| 5,000 | 0.72 | 0.45 |
| 7,500 | **0.64** | **0.57** |

The population walks toward the analytic optimum and *builds the predicted correlation out of
nothing* — selection discovering a theorem. Population stable throughout (≈1,470, zero
extinctions), and the r-strategy drift continues alongside (patience 104 in the meadow).

## Predators (v2) — a selection pressure for speed, itself evolving

User request: "add a selection pressure for speed: predators. let's also model their
evolution." Predators are a full second species: the **same four genes under the same
economy** (so cross-species trait comparisons mean something), income from kills instead of
grass (a kill transfers the prey's energy at 55% + a carcass value — plump dots are literally
more nutritious), and their own mutation, lineage hues (seeded red vs prey's green), division,
and extinction counter. Prey that detect a predator within their *own* sense radius flee —
fear beats hunger — so speed prices escape and sense prices early warning. Rings are
predators; the white histogram outline and the red sparkline are theirs (the sparkline pair is
a live Lotka–Volterra chase).

**Three ecological collapses, each fixed by the honest mechanism:**

1. **Two kills funded a division** → predators boomed 200 → 826 on 92 prey. Fixed with a
   leaner trophic economy (transfer 55%, longer digestion) — energy transfer in real food
   chains is ~10%, and lean is what keeps the chase gentle.
2. **Perfect-information pursuit never closes** on fleeing prey of near-equal speed — prey
   out-evolved the gap in ~1,500 steps (their generations are faster) and predators busted
   257 → 2. Fixed with **surprise**: vigilance is imperfect (notice probability 12%/step, then
   45 steps of alarm). Stalking exists because watching is hard.
3. **Surprise made the numerical response unbounded** — 900 predators on 720 prey, then
   collapse to 1. Fixed with **interference**: each neighbouring predator within 26px levies
   an energy tax. Territory caps a carnivore population even when prey are everywhere.

With all three: prey ~1,300–1,700 and predators 20–200 coexist through 7,000 steps, zero
extinctions, oscillating on both ecological and evolutionary timescales.

**The headline, measured clean** (same build, same meadow, t=4,700):

| | prey mean speed |
|---|---|
| predators OFF | 1.72 (replicates the v1.1 plateau) |
| predators ON | **2.00** |

Predation shifts the speed optimum ~17% above the foraging plateau — the requested selection
pressure, isolated from the confound that grazing alone also buys speed. The arms race is
visible on the other side too: predator speed climbs 2.25 → 2.45 while their prey harden.

**An honest negative:** predation did *not* rescue `sense` (6.0 with predators vs 7.0
without at t=4,700). Fleeing helps whoever flees, but longer whiskers don't buy enough extra
warning at a flat notice probability to pay their per-step bill. The obvious lever — making
notice probability scale with sense, so vigilance quality is the gene — is parked below.

## Things worth trying next

- [ ] **Notice ∝ sense** — make vigilance quality the gene (notice probability scaling with
      sense radius), the missing lever for predation to finally price early warning.
- [ ] **Patchy worlds** — regrowth varying by region (or food dropped in clumps) should make
      `sense` finally worth buying; the meadow/desert sense-selloff is begging for this control.
- [x] ~~Predators as a second evolving species~~ — done in v2, with three measured ecological
      collapses on the way (lean trophic economy, surprise, interference).
- [ ] Speciation watch: with two resource types and a diet gene, lineage hues should split
      bimodally instead of drifting as one cloud.
- [ ] Click-to-paint fertile/barren ground (the participatory lever the other sims have).
- [ ] A phylogeny strip — time on x, lineage hues stacked by abundance; extinctions and
      takeovers would read like geological strata.
