# Fireflies — pulse-coupled sync
**Version**: v1.0.0
**Date Created**: 2026-08-11
**Last Updated**: 2026-08-11
**Purpose**: Synchrony emerging from flashes alone — Mirollo–Strogatz pulse-coupled oscillators, built for watching
**Status**: Active — v1

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

## Things worth trying next

- [ ] **Chimera hunting**: with a mid-size radius, look for stable coexisting synced + desynced
      regions (the meter would hover while patches lock). May need nonlocal coupling (ring or
      shell-shaped sight) rather than a disc.
- [ ] Bidirectional (Kuramoto continuous) coupling — lets clocks slow down as well as advance;
      different transition character.
- [ ] Obstacles / masks the light can't cross — waves should diffract around them.
- [ ] Sound: a click per flash, sync made audible (Web Audio, quantised to avoid 500 clicks/frame).
- [ ] A "frequency = hue" look — would show whether fast clocks end up leading the synced flash.
