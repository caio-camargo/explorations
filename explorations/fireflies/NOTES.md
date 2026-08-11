# Fireflies — pulse-coupled sync
**Version**: v1.2.0
**Date Created**: 2026-08-11
**Last Updated**: 2026-08-11
**Purpose**: Synchrony emerging from flashes alone — Mirollo–Strogatz pulse-coupled oscillators, built for watching
**Status**: Active — v1.2 (parameter atlas + soft glow sprites)

---

## The idea

Every firefly has an internal clock (phase 0→1) ticking at its own natural rate. When the clock
strikes 1, it **flashes** and resets. Every neighbour within sight of a flash gets its own clock
**nudged forward** — and if the nudge pushes a clock past 1, that firefly fires immediately too,
which can cascade.

That's the entire mechanism. Nobody is told the time. Synchrony — or travelling waves, or
stubborn dissent — emerges from flashes alone. This is (a spatial, watchable version of) the
Mirollo–Strogatz pulse-coupled oscillator model, which is also roughly how real *Pteroptyx*
fireflies do it.

Run it: open [`index.html`](index.html) in any browser. No build, no dependencies.

**What to do first**: let the default load run for a minute — it twinkles, struggles, and locks
into unison at around 50 seconds (measured: sync r every 750 steps goes 0.52, 0.26, 0.71, 0.75,
then 1.0). Then hit `desync` and watch it happen again. Then try the `waves` preset in the
`phase` look, where you can see a wave arriving as a colour gradient before it flashes.

---

## How it maps to code

One file; the simulation is ~80 lines of it. Structure and habits inherited from
[`dots-friend-enemy`](../dots-friend-enemy/NOTES.md) — fractional stepping, per-step sampling,
full-clear rendering, panel wiring.

- `stepSim()` — wander, clocks tick, natural flashes, propagation, glow decay, order parameter
- `propagate()` — the cascade: a queue that can grow while it's walked. A fly flashes at most
  once per step (`flashedNow`), which is both the refractory period and the loop bound.
- `buildGrid()` — uniform spatial grid (counting sort) so a flash only checks nearby cells, not
  all n. Without it, full sync at high n means n flashers × n candidates in a single step.
- The nudge is **concave**: `ε·(0.25 + 0.75·θ)` — a fly late in its cycle jumps further than one
  that just fired. That's the Mirollo–Strogatz condition that makes absorption stick rather than
  clocks endlessly circling each other.
- Natural flashes keep their phase remainder (`θ -= 1`); cascade-forced flashes reset to 0.

**The sync meter** shows the Kuramoto order parameter r = |mean phase vector|: 0 = scattered
blinking, 1 = perfect unison. It's the one number that summarises the whole field, and watching
it climb (or fail to) is half the point. Presets restart its trace.

---

## What the regimes are (all measured)

| Preset | What happens | Numbers |
|---|---|---|
| `twinkle` | Control case — no coupling, random blinking forever | r ≈ 0.03 ≈ 1/√n after 3000 steps |
| `unison` | Full sync, slowly enough to watch | r > 0.9 at ~1600 steps (~27s) |
| `waves` | Local agreement, global disagreement — travelling fronts | local r 0.56 vs global 0.18 after 5000 steps |
| `stubborn` | Sync that keeps forming and collapsing | mean r 0.69, swinging 0.31–0.94 |
| `avalanche` | Strong coupling, chain-reaction fronts | cascades routinely engulf the whole field in one step |

**Cascades are far stronger than per-flash arithmetic suggests.** The first "stubborn" attempt
used an 18% clock spread against a 3% nudge and confidently expected partial sync — it synced to
r ≈ 0.9 anyway. A single flash rarely matters; a flash that triggers a flash that triggers a
flash is a wave of absorption. Getting a genuinely partial regime took cutting the nudge to
0.6% per flash. The interesting boundary (the Kuramoto transition) lives at far weaker coupling
than intuition puts it.

**The waves signature is measurable, not just visible**: with a small sight radius, mean local
order (within each fly's neighbourhood) sits at 0.56 while global order is 0.18. Locally
everyone agrees; globally the field can't — so agreement propagates as fronts instead.

## Verification

- Control case stays at noise level (r = 0.034 ≈ 1/√500) over 3000 steps — no phantom coupling.
- Cascade safety: at nudge 0.5, radius 0.45, the queue peaks at exactly n (everyone fires once)
  and terminates. No NaN across any tested regime.
- Degenerate floor: coupling disables when the pixel radius collapses below 1 (hidden-pane boot),
  and positions re-scatter on the first real resize.
- Perf, measured in isolation: n = 2000 with **all 2000 glowing** (post-sync worst case) is
  1.7 ms/frame. No draw batching needed.
- DOM asserted, not assumed (dots lesson #10): all 3 look buttons, 5 presets, 9 sliders, and
  6 buttons visible under every look; presets apply parameters and desync; no empty value labels.
- Not visually confirmed this session — the preview pane never composited. Numbers only.

## The parameter atlas (v1.1)

User feedback after playing: finding interesting patterns took finicky fiddling, and roughly the
upper half of the sight-radius slider produced nothing but unison — "something I think you can
measure with metrics, not requiring visual rendering." Correct. So: sweep the space headless,
classify every cell, and let the map drive the controls.

Two 7×7 sweeps of radius × nudge (n=400, period 140, 1500 settle + 900 measure steps per cell;
global order mean/sd + local order per cell). Legend: `·` incoherent, `~` waves, `◐` partial /
metastable, `●` unison.

**Clock diversity ±3%:**

| radius \ nudge | 0.4% | 0.8% | 1.5% | 3% | 6% | 12% | 20% |
|---|---|---|---|---|---|---|---|
| 4%  | · | ~ | ~ | · | · | ~ | ~ |
| 8%  | · | · | · | · | ~ | ~ | ~ |
| 12% | · | · | · | ~ | ~ | ~ | ● |
| 18% | · | · | ◐ | ● | ● | ● | ● |
| 26% | · | ◐ | ● | ● | ● | ● | ● |
| 36% | ◐ | ● | ● | ● | ● | ● | ● |
| 45% | ◐ | ● | ● | ● | ● | ● | ● |

**Clock diversity ±12%:**

| radius \ nudge | 0.4% | 0.8% | 1.5% | 3% | 6% | 12% | 20% |
|---|---|---|---|---|---|---|---|
| 4%  | · | ~ | ~ | ~ | ~ | ~ | ~ |
| 8%  | · | · | · | · | ~ | ~ | ~ |
| 12% | · | · | · | · | ~ | ● | ● |
| 18% | · | · | · | ◐ | ● | ● | ● |
| 26% | · | ◐ | ● | ● | ● | ● | ● |
| 36% | · | ● | ● | ● | ● | ● | ● |
| 45% | · | ● | ● | ● | ● | ● | ● |

Two structural facts fall out:

1. **Everything above radius ~25% is a unison wall** (except the very weakest nudges). The user's
   "half the upper range of sight radius produces unison" is exactly right — nearly half the
   slider's travel was spent past the boundary.
2. **Nudge is perceptually logarithmic.** The entire transition — incoherent to waves to unison —
   happens between 0.4% and ~3%. On a linear 0–20% slider that's 5% of the travel, which is
   precisely why tuning felt finicky: the interesting region was a sliver.

### What changed because of the map

- **Sight radius now runs 2–30%** instead of 2–45%. The unison wall sits at about two-thirds of
  the travel — still reachable on purpose, no longer half the slider.
- **Nudge is log-scaled**: position 0 is a true off-detent, then the scale runs 0.3% → 20%.
  Mid-travel lands at ~2.4%, inside the transition, where before it landed at 10% (deep unison).
- **A live regime label** — the same classifier that read the sweep runs continuously (slow-EMA
  global order + variance, plus a periodic local-order sample) and names the current state in
  the stats line and the sync meter: *no coupling / incoherent / waves / partial sync / unison*.
  Verified against all five presets: twinkle reads "no coupling", waves reads "waves"
  throughout, unison passes through "partial sync" while forming (true) then locks, and
  stubborn narrates its own metastability — mostly "partial sync" with honest excursions to
  "unison" at the peak of each swing. The unison label requires *low variance as well as high
  order*, otherwise metastable peaks masquerade as lock.
- **Tooltips on every slider** (hover the dotted labels), stating what each knob does physically
  and, where it matters, where its interesting range lives.

### On freedom vs steering

The resolution this exploration settled on: **recalibrate the ranges so slider travel is spent
where the physics is, and instrument the state rather than fencing the input.** Nothing is
forbidden — you can still drive into the unison wall, and sometimes you want to — but the ranges
stop wasting half their travel inside it, the label tells you which regime you're in the moment
you cross a boundary, presets are named landmarks, and this atlas is the map. Steering by
information, not by constraint.

## Soft glow (v1.2)

User feedback: the blink radius was too sharply marked — and it was. Flashes were drawn as
flat-alpha filled circles, which read as hard-rimmed coins, not light.

Each look now defines gradient *stops* — a hot centre easing through the look's colour to fully
transparent at the rim, keeping the same RGB throughout so the fade never passes through grey.
The gradient is rendered **once** per (look, hue-bucket) into a 64px offscreen sprite and blitted
from then on; per-fly per-frame gradients are the expensive way to get this effect. The `phase`
look, where every fly carries its own hue, gets a bank of 32 hue-bucketed sprites (11.25° —
measured invisible as banding back in the dots exploration). Cache tops out at 34 canvases.

Measured radial luminance profile of a full flash after the change: 674 → 547 → 345 → … → 34 →
24 → background, a smooth glide with no step at any rim (the only steep gradient is the hot core,
which is the point). Idle bodies use the same sprite small and dim, so they lost their rims too.

Cost: one blit per flash (the sprite carries its own hot centre) plus one for the idle body,
skipped when a strong flash sits on top of it. Worst case — n=2000, *every* fly glowing at
sync — is 19.6 ms/frame; the default n=700 fully synced runs 4.35 ms. First cut used three
blits per glowing fly and hit 27 ms, hence the consolidation. And because the sims now advance
by wall-clock time, even a heavy frame slows only the frame rate, never the physics.

## Things worth trying next

- [ ] **Chimera hunting**: with a mid-size radius, look for stable coexisting synced + desynced
      regions (the meter would hover while patches lock). May need nonlocal coupling (ring or
      shell-shaped sight) rather than a disc.
- [ ] Bidirectional (Kuramoto continuous) coupling — lets clocks slow down as well as advance;
      different transition character.
- [ ] Obstacles / masks the light can't cross — waves should diffract around them.
- [ ] Sound: a click per flash, sync made audible (Web Audio, quantised to avoid 500 clicks/frame).
- [ ] A "frequency = hue" look — would show whether fast clocks end up leading the synced flash.
