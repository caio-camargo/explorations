# Slime Mold — Physarum transport networks
**Version**: v1.1.0
**Date Created**: 2026-08-11
**Last Updated**: 2026-08-11
**Purpose**: Organic vein networks from three whiskers and a scent trail — the Jones (2010) Physarum model, built for watching
**Status**: Active — v1.1 (crowding rule: complexity is sustained now)

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

- [ ] **Food**: click to drop attractant sources the field can't evaporate — the Tokyo-rail
      experiment. Needs a second field summed into sensing only.
- [ ] Spatial-autocorrelation length as the third metric — separates filigree from veins, and
      would complete a proper parameter atlas (the fireflies method) over sensor angle × reach.
- [ ] Obstacle masks — walls the agents bounce off and the trail can't cross.
- [ ] A "relief" look — light the field as a heightmap (cheap normal from neighbours).
- [ ] Per-agent hue by heading or by age, deposited into an RGB field — coloured currents
      inside shared veins.
