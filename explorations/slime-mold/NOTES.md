# Slime Mold — Physarum transport networks
**Version**: v1.3.0
**Date Created**: 2026-08-11
**Last Updated**: 2026-08-11
**Purpose**: Organic vein networks from three whiskers and a scent trail — the Jones (2010) Physarum model, built for watching
**Status**: Active — v1.3 (tendrils regime default; drift understood as emergent)

---

## The idea

Each agent, every step: **sense** the trail field at three whisker points (ahead, and at
±sensor-angle); **steer** toward the strongest reading; **move** a fixed stride; **deposit**
trail where it lands. The field itself diffuses a little and evaporates a little each step.

Agents never see each other — only the field. Everything the network does (veins forming,
competing, merging, being reabsorbed) is *stigmergy*: the environment is the communication
channel. This is the Jones (2010) model of *Physarum polycephalum*, the slime mold that
famously reproduced the Tokyo rail network.

Run it: open [`index.html`](index.html) in any browser. No build, no dependencies.

**What to do first**: let `veins` run a couple of minutes from a cleared field — a uniform
haze condenses into filaments, filaments compete, and a hierarchy of trunk lines emerges.
Then try `ink` (the network as a drawing) and hit `c` to watch it rebuild from nothing.

---

## How it maps to code

One file. The whole simulation is `stepSim()`: the agent loop (~25 lines) and the field pass
(~20 lines). Everything else is display and panel.

Design decisions, several inherited as lessons from the first two explorations:

- **The field is a fixed 640×400 Float32 torus.** Fixed: physics is identical on every monitor
  (dots lesson — never mix screen-dependent and screen-independent units). Float32: evaporation
  actually reaches zero, so the 8-bit fossil trap from dots *cannot exist here by construction* —
  the canvas is a pure view, fully redrawn from the field every frame. Torus: networks wrap
  seamlessly instead of colliding with walls.
- **dt-based stepping from day one** (lesson 11) — render cost cannot leak into sim speed.
- **Sequential agent updates are fine here**, unlike dots. Dots needed a simultaneous snapshot
  because agents exert direct forces on each other; Physarum agents interact only through a
  field that diffusion delays by a step anyway, so update order injects no meaningful bias.
- **The field pass is branch-free and division-free** — edge columns peeled out of the inner
  loops, the 3×3 mean carried as sums with the /9 folded into the blend constant. The naive
  version cost ~85% of the whole step.
- **There is deliberately no deposit-strength slider.** Agents steer by *comparing* readings,
  so scaling every deposit by a constant changes nothing — the system is scale-free in trail
  units. The panel says so; the real parameters are the ones that change *relative* structure:
  population, evaporation, diffusion, and the sensor geometry.

## The four anatomies (measured)

Coverage = fraction of cells above 15% of peak (how much of the world carries real trail);
contrast = peak/mean (how concentrated); churn = |Δfield|/mass over 150 steps (how restless).

| Preset | What it looks like | cov | contrast | churn |
|---|---|---|---|---|
| `veins` | the classic — hierarchical trunk lines | 2.5–3.5% | ~60–70 | 0.91 |
| `filigree` | fine nervous mesh (short sensors → small structure) | 3.2% | ~67 | — |
| `cells` | broad soft compartments, honeycomb-ish | 7.5% | ~26 | — |
| `storm` | sparse, harsh, constantly rewiring | 0.6% | ~194 | 1.39 |

`storm` vs `veins` is the temporal contrast: 53% more churn — same mechanism, permanently
unsettled. `cells` vs `storm` is the spatial one: 12× the coverage at an eighth of the
contrast. One honest gap: `veins` and `filigree` overlap on these metrics — their difference
is the *scale* of the structure (sensor reach 9 vs 4), which coverage and contrast are blind
to. A spatial-autocorrelation length would separate them; parked below.

**Network formation is itself measurable**: from a cleared field under `veins`, coverage
collapses 9.5% → 2.5% while contrast climbs 20 → 71 over ~1800 steps. That trajectory — mass
concentrating into thin bright structure — *is* vein formation, before you ever see it.

## The collapse, and the rule that stops it (v1.1)

User feedback on v1: "it starts off wonderfully complex, but it simplifies rather quickly."
Correct, and it's the classic Physarum failure mode — rich-get-richer. The strongest trail
recruits more agents, who deposit more, while every competitor evaporates, until the whole
lace collapses into one glowing river.

Measured with a junction count (bright cells with ≥3 bright neighbours — a cheap branching
metric) under `veins`:

| | t=1000 | t=3500 | t=7000+ |
|---|---|---|---|
| **v1 (no crowding)** — junctions | 2,448 | **105** | 2,256 |
| **v1.1 (crowding)** — junctions | 15,966 | 14,534 | 11,856 |

The v1 numbers also reveal the collapse isn't even stable — it oscillates between river and
partial recovery. The v1.1 network coarsens gently (15.9k → 11.9k over 7000 steps), which is
what mature Physarum networks genuinely do, but it never collapses.

**The fix is not a patch — it's the missing piece of the original model.** Jones's agents may
only move into an *unoccupied* cell; a blocked agent stays put, re-orients randomly, and
deposits nothing. That one constraint (`occ`, a Uint8 grid rebuilt per step) is what sustains
reticulation: a trunk cannot absorb every agent, because there is no room on it. v1 left it
out; the user's eye found exactly the consequence.

Crowding also promotes **population to the main density lever** — hence the agents slider now
reaching 40,000 (~16% occupancy). Measured at t=1200 under `veins` settings: n=6,000 → 25%
coverage, ~16k junctions (distinct veins); n=15,000 → 41%, ~26k (dense foam, nearly too much).
The `filigree` preset now runs 14,000 agents to exploit this.

## Food (v1.2) — changes that generate change

User feedback on v1.1: the sustained lace "ends up pretty static after a while — changes that
generate change are good." The food system is that engine: sources anchor the network, deplete
under exploitation, and rain replaces them elsewhere — discover, exploit, exhaust, rewire,
forever. Click the canvas to drop food by hand; `x` clears it.

Getting it working took four measured iterations, each one a wrong assumption caught by a
number:

1. **Sensed food is invisible beyond whisker reach.** First build added food to the whisker
   readings. Two sources 320px apart: corridor/background trail ratio **1.1** — nothing. A
   9px whisker can't smell across a field. Fix: sources **emit into the diffusing trail
   field** (folded into the existing field pass at zero extra cost), building a real gradient.
   Corollary: with a 60-step half-life, the plume's diffusion length is √(0.4·86) ≈ **6px** —
   long-range gradients are physically impossible here, so food anchors at plume range and
   large-scale structure follows from anchoring, not smelling.
2. **Emission + auto-exposure = feedback loop.** Injection scaled by exposure while exposure
   tracked the plume it fed → divergence for appetite > ~0.6. The exposure scan now excludes
   emitting cells; it tracks veins, never plume.
3. **Sources were agent traps.** With emission working, trail at sources hit 60× background —
   and the corridor between two sources measured **0.19×** background: emptier than nowhere.
   Every whisker near a source points inward; agents orbit and the surroundings evacuate. Fix:
   **satiation** — an agent that eats has a small chance per step to go full, ignore all
   gradients, and dash straight through and out (still depositing). Corridor ratio 0.19 → 0.96,
   ~90 commuters live at steady state.
4. **Two timescale bugs in the eating itself.** Eating only fired on successful moves — but a
   packed source blocks every move (crowding), so the agents ON the food were exactly the ones
   that couldn't eat: 1 satiated agent in a 6000-agent run. And a 130-step dash exiled
   commuters 130px (7% eating duty cycle, ~10k-step source lifetimes). Eat-where-you-stand +
   45-step dashes: a source now lives **~2,000 steps** under exploitation (78% eaten by
   t=1200, dead by 2400) and its hub cools back to network baseline after.

At the default rain (3 sources/1000 steps) and lifetime (~2000 steps), the equilibrium is
**~6 concurrent sources** — enough that somewhere is always igniting and somewhere always
starving.

**A metric limitation, logged honestly**: whole-field churn (|Δ|/mass) could not distinguish
food-on from food-off at any window length — it saturates on filigree flicker, and a
brightness-thresholded "backbone" variant collapses onto the plume cells instead. The
lifecycle is verified piecewise (anchor / deplete / die / cool / commute / rain); a layout-
level metric (tracking vein topology, not pixels) is an open thread. The visible judgment —
green blobs igniting, veins snapping to them, hubs starving out — is the user's.

## The fade while feeding (v1.2.1) — real economics, not a bug

User: "the mold seems to fade the more it eats… I guess it returns to normal once it's
depleted." Correct on both counts, and finding out *why* killed two plausible hypotheses first:

1. **Not an exposure artifact.** Suspected auto-exposure chasing the plume skirt (cells just
   outside the food disc carry huge injected trail but aren't excluded from the scan). Measured:
   exposure held 14.8 → 14.6 with a live source, and its argmax sat 406px away. Dead.
2. **Not local thinning either.** With one source, the far quadrant was slightly *brighter*
   during feeding (mean trail 1.62 vs 1.40 after). Dead.

The real mechanism is **systemic and economic**. One source garrisons ~444 agents (7.4% of
6,000) within 70px. The default rain equilibrium runs ~6 sources — and measured at the default
config, the lace loses **67% of its junctions** (13,574 → 4,523) and two-thirds of its coverage
(21.4% → 7.2%). Direct capture is only 17% of agents, so the rest is steering competition:
every whisker that clips a plume edge gets funneled sourceward, and the lace loses its
self-reinforcement across the plumes' whole catchment. Sources tax the workforce; a source
dying refunds it — which is exactly the "returns to normal once depleted" the user saw.

**The fix is the density lever we already own.** Crowding made population the reticulation
knob, so pay the tax up front: defaults are now **n = 11,000 with appetite 1.2** (was 6,000 /
1.5). Measured at equilibrium with the full food lifecycle running: **16,029 junctions at
25.3% coverage — richer than the foodless n=6,000 baseline** (13,574 / 21.4%). The lace and
the hub economy coexist; the ebb around a hungry hub is still visible, as it should be — it's
real dynamics, just no longer a collapse.

## The drift, and the tendrils regime (v1.3)

Two more field reports from play, one of each kind: a suspected bug that turned out to be
physics, and a hand-tuned discovery that measurement confirmed and promoted to the default.

**"Strands slowly drift to the left" — spontaneous symmetry breaking, not a bug.** A fixed
leftward bias would have been an indexing defect (and there was a real suspect: sensing rounds
while deposits truncate). Measured across three independent runs, the drift vector came out
(−0.17, +0.02), (+0.05, −0.06), (−0.01, +0.07) px/step — **direction is random per run and
wanders within a run**. The pattern spontaneously elects a travelling direction and persists;
one long session just happened to elect left. This is genuine collective motion of the kind
active-matter systems produce, so it stays.

**The tendrils regime — user-discovered, measured, now the default.** Playing found that a low
sensor angle produces "adventurous tendrils" that seek food out instead of waiting to drift
into it, helped by more agents, *specifically* move speed ≈ 1.25, and lower diffusion. All
confirmed with a food-discovery-latency protocol (mature a network at n=6,000, drop a source
into the *emptiest* region, count steps until 40% eaten):

| geometry | steps to find & eat a dead-zone source |
|---|---|
| veins (25°, speed 1.0, diffusion 0.6) | 3,900 |
| **tendrils (12°, speed 1.25, diffusion 0.35)** | **~1,150** |
| tendrils but speed 1.5 | 2,900 |

~3× faster discovery, with no complexity cost (15,093 junctions — same range as ever). And the
user's speed sweet spot is *genuinely non-monotonic*: both 1.0 and 1.5 are 2.5–3× worse than
1.25. Hypothesis (unproven): a growing tendril's tip must follow its own just-laid, ~1px-wide
filament — too slow and crowding jams the tip, too fast and it overshoots its own trail and
the tendril dissolves. The narrow sensor angle points the whiskers *along* the filament rather
than across it, which is why it explores instead of thickening.

`tendrils` is now the first preset and the load default; `veins` remains for the classic
thick-trunk look.

## Verification

- All four presets: agents in bounds after thousands of steps on the torus, no NaN anywhere.
- dt-stepping: 2 s of wall-clock = 120 steps at 60 and at 20 fps alike; fractional rates exact.
- DOM asserted: 3 looks, 4 presets, 8 tooltipped sliders, all buttons visible; presets apply.
- **Perf caveat, honestly**: the hidden preview pane CPU-throttles the harness (~10× — a
  branch-free 512k-op loop benched at 65 Mops/s, which is not a real number for JIT'd JS).
  Measured *ratios*: field pass ≈ 2× the agent loop at n=6000. Absolute frame cost on a
  visible page is unverified from here; if it's heavy live, the two documented levers are
  halving the field resolution or running diffusion every other step.
- Not visually confirmed this session — the pane never composited. The formation *numbers*
  are unambiguous; the aesthetics are yours to judge.

## Things worth trying next

- [x] ~~Food~~ — done in v1.2 (emission-based, with depletion + rain). The full Tokyo-rail
      *corridor selection* between distant sources remains out of reach at these diffusion
      lengths; a dedicated long-range chemoattractant field (long half-life, multiple blur
      passes) is the upgrade path if we ever want true Steiner behaviour.
- [ ] A layout-level change metric (vein topology, not pixel churn) — the food A/B needs it.
- [ ] Spatial-autocorrelation length as the third metric — separates filigree from veins, and
      would complete a proper parameter atlas (the fireflies method) over sensor angle × reach.
- [ ] Obstacle masks — walls the agents bounce off and the trail can't cross.
- [ ] A "relief" look — light the field as a heightmap (cheap normal from neighbours).
- [ ] Per-agent hue by heading or by age, deposited into an RGB field — coloured currents
      inside shared veins.
