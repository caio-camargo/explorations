# NeuroMechFly — driving EPFL's fly digital twin locally

**Version**: v1.0.0
**Author**: Caio Camargo + Claude (Opus 5)
**Date Created**: 2026-09-10
**Last Updated**: 2026-09-10
**Purpose**: Exploration notes — what NeuroMechFly v2 is, how to run it here, and what
the controller × terrain matrix taught
**Status**: Active — matrix complete, open threads listed at the bottom

---

## The idea

[NeuroMechFly](https://neuromechfly.org/) is not a toy. It is a *digital twin* of an adult
female *Drosophila melanogaster*, built by EPFL's Neuroengineering Lab from a micro-CT scan
of a real fly: 42 actuated leg degrees of freedom, compound-eye vision on a hexagonal
ommatidial lattice, odour sensing at the antennae and maxillary palps, tarsal adhesion pads,
and a control architecture deliberately split into brain and ventral nerve cord — the insect
analogue of brain and spinal cord.

Every other exploration in this folder is a system I wrote from scratch and then tuned until
it did something. This one inverts that: the model is somebody else's, it is anatomically
real, and the interesting question is not "what did I build" but **"what does it do when you
change one thing".**

The one thing worth changing first: **how the six legs decide when to step.**

---

## What is actually being varied

All three controllers below drive the *same* single-leg step trajectories
(`PreprogrammedSteps`, extracted from real recorded fly kinematics). None of them invents a
different way of moving a leg. They differ only in **what decides the timing of each leg's
step** — and, crucially, in whether the ground can influence that decision at all.

| Controller | Coordination mechanism | Sees the ground? |
|---|---|---|
| **CPG** | Six coupled phase oscillators, phase-locked into a tripod (12 Hz intrinsic, coupling 10.0) | **No** — open loop |
| **Walknet (rule-based)** | Each leg decides locally from its neighbours' states via three Cruse rules: a swinging leg inhibits its rostral neighbour; a leg in early stance excites rostral neighbours; a leg in late stance excites caudal and contralateral neighbours | **No** — open loop |
| **Hybrid** | Tripod CPG *plus* local retraction and stumbling corrections driven by leg proprioception and contact | **Yes** — closed loop |

The prediction from the NeuroMechFly papers is sharp and falsifiable: on flat ground all
three should walk fine, because there is nothing to react to. The moment the ground stops
being flat, the two open-loop schemes should degrade and the closed-loop one should not.

That is a real experiment with a real possible negative result, which is the only kind worth
running.

### Terrains

| Terrain | What it is |
|---|---|
| `flat` | Featureless plane |
| `gapped` | Alternating floor blocks and transverse gaps (0.3 mm gaps, 2 mm deep, 1 mm blocks) |
| `blocks` | Tiled blocks of alternating height (1.3 mm tiles, ±0.35 mm) |
| `mixed` | Three bands in sequence: blocks, then gaps, then flat |

For scale: the fly's whole body is about 3 mm long. A 0.35 mm block step is roughly a tenth
of a body length — a kerb, at fly scale.

### Method

- 2.0 s of simulated time per run, 0.1 ms physics timestep (20 000 steps).
- 3 seeds per cell. The seed drives the controller's initial state, and is *passed to* the
  terrain as `rand_seed` — but see "Caveat on the seeds" below: the terrain does not actually
  vary. Every controller met the identical world, so the comparison is properly paired; it
  just isn't sampling terrains.
- Measured per run: forward displacement of the thorax, lateral drift, total planar path
  length, straightness (net forward ÷ path length), and thorax height mean/σ (a proxy for
  how much the body is being thrown around).
- Straightness matters as much as speed. A fly that thrashes in place travels a long path and
  gets nowhere; speed alone cannot tell that apart from standing still.

---

## Running it here

The install is **not** in this folder and not on Google Drive, deliberately — a venv is
thousands of small files and putting it inside a synced folder is how you burn an afternoon
on sync conflicts.

```
venv:   C:\Users\caioa\.venvs\flygym       (machine-local, outside the sync boundary)
python: 3.13.14
stack:  flygym 2.1.0 + mujoco 3.9.0, Windows 11, CPU only
```

Recreate it with:

```bash
python -m venv C:/Users/caioa/.venvs/flygym && C:/Users/caioa/.venvs/flygym/Scripts/python.exe -m pip install "flygym[examples]==2.1.0"
```

Then:

```bash
C:/Users/caioa/.venvs/flygym/Scripts/python.exe baseline.py
```

### Files

| File | What it does |
|---|---|
| `baseline.py` | One CPG fly on flat ground, rendered to mp4. Smoke test. |
| `run_matrix.py` | The controller × terrain matrix; writes `out/<tag>.json` and per-run thorax traces to `out/raw/` |
| `plot_matrix.py` | Turns that json into `out/<tag>.png` |

---

## Results

### The install reproduces the published result exactly

The first thing worth checking on any borrowed model is whether it is actually the same model.
`baseline.py` on flat ground, tripod CPG, 2 s:

```
forward displacement : 27.34 mm over 2.0s  (13.7 mm/s)
```

EPFL's own published tutorial output for the same configuration: **27.34 mm**. Identical to
the two decimals they print. MuJoCo is deterministic given the same model, timestep and seed,
and nothing about this machine perturbed it — so everything measured below is a property of
the model, not of this laptop.

Worth noting what did *not* transfer: throughput. The docs report 1.03× realtime for this run;
here it was **0.24×**, about 4× slower. Same physics, different silicon. Numbers about
*behaviour* transfer across machines; numbers about *speed* do not.

### The matrix

36 runs — 3 controllers × 4 terrains × 3 seeds, 2 s each. Mean ± sd over seeds.
Figure: [`out/matrix.png`](out/matrix.png). Raw: [`out/matrix.json`](out/matrix.json).

| Terrain | | CPG (open loop) | Walknet (open loop) | Hybrid (closed loop) |
|---|---|---|---|---|
| **flat** | speed mm/s | **14.0 ± 0.2** | 7.2 ± 0.4 | 13.5 ± 0.2 |
| | straightness | 0.70 ± 0.01 | 0.62 ± 0.06 | 0.69 ± 0.01 |
| **gapped** | speed mm/s | 0.9 ± 0.2 | 5.5 ± 0.5 | **8.3 ± 2.6** |
| | straightness | 0.06 ± 0.01 | 0.43 ± 0.03 | 0.40 ± 0.13 |
| **blocks** | speed mm/s | 1.1 ± 0.5 | 1.7 ± 0.3 | **3.6 ± 4.2** |
| | straightness | 0.05 ± 0.03 | 0.14 ± 0.02 | 0.17 ± 0.20 |
| **mixed** | speed mm/s | 5.1 ± 2.3 | 3.6 ± 0.0 | **8.4 ± 0.7** |
| | straightness | 0.23 ± 0.10 | 0.31 ± 0.00 | 0.39 ± 0.03 |

### Caveat on the seeds — the terrain did not vary

The script *intends* the seed to pick both the controller's initial state and the terrain
realization. Checked rather than assumed, and it does not:

```
blocks rand_seed 0/1/2 : ['d77187bf1f64', '86c076b8a77c', '86c076b8a77c']   <- 1 and 2 identical
mixed  rand_seed 0/1/2 : ['f91a3cdbafc1', '3e70671f2d70', '3e70671f2d70']   <- same
```

Two causes. The default `height_range=(0.35, 0.35)` is degenerate — both bounds equal, so
the "random" block height is a constant — and `GappedTerrainWorld` takes no seed at all.
Even with a genuine range, `rand_seed` collides (0 and 1 gave identical geometry).

So **the ± columns above are controller-initialization variance on a fixed world, not
terrain variance.** The comparison across controllers is still properly paired — every
controller met exactly the same ground — which is what the headline claims rest on. But
nothing here says anything about robustness *across* terrain realizations.

---

## What it taught

### 1. The closed loop is nearly free, and it is not what saves the fly

On flat ground the hybrid controller costs about 3% of speed against the pure CPG
(13.5 vs 14.0 mm/s). The corrections stay quiet when there is nothing to correct — feedback
that only fires on stumbles doesn't tax you when you don't stumble.

On rough ground the hybrid wins everywhere: 8.3 vs 0.9 on gaps, 8.4 vs 5.1 on mixed. That
much was the expected result and it held.

What did **not** hold is the reason. The tidy story going in was "open loop fails on rough
ground, closed loop survives." But Walknet is *just as blind as the CPG* — no ground contact
reaches its coordination layer either — and on gapped terrain it beats the CPG six-fold
(5.5 vs 0.9 mm/s) and gets within a whisker of the closed-loop controller's straightness
(0.43 vs 0.40). Blindness is not the problem.

### 2. The CPG doesn't slow down on gaps. It falls in.

This is the finding the summary statistics hide, and the reason it was worth recording
thorax height at all:

| CPG on gapped | z min | z mean |
|---|---|---|
| seed 0 | 0.40 | 0.84 |
| seed 1 | **−0.58** | **−0.04** |
| seed 2 | **−0.72** | **−0.27** |

Normal thorax height is ~1.0 mm and the gaps are 2 mm deep. A *mean* below zero means the
body spent most of the run down inside a gap. Two runs in three, the fly fell in and never
got out. Walknet's minimum across the same three runs never goes below 0.61 mm; the hybrid's
never below 0.17.

So "0.9 mm/s" is not a slow walk. It is a fly in a hole. Average speed alone would have
reported this as a mild degradation, which is exactly wrong — and is why straightness
(0.06: pure thrashing) and body height earn their place in the metrics.

Side by side on the identical terrain, same seed 2 — [`out/cpg_gapped.mp4`](out/cpg_gapped.mp4)
(1.18 mm travelled) against [`out/hybrid_gapped.mp4`](out/hybrid_gapped.mp4) (11.80 mm).

### 3. The hypothesis this leaves: it's about duty factor, not feedback

The pattern that fits all three columns is **how many legs are on the ground at once.**

The CPG is a clock. Six oscillators phase-locked at 12 Hz in a strict tripod: three legs
down, three legs up, on schedule, forever. Over a gap, the schedule lifts a supporting leg
anyway, and a tripod missing a foot is a tripod on two points.

Walknet has no clock. A leg steps when its neighbours' *states* permit — timing is relative
and emergent, so the gait sits in a more conservative, wave-like regime with more legs
planted at any instant. That costs speed on flat ground (7.2 vs 14.0 mm/s — it is the *slowest*
controller there by half) and buys static support over a hole.

This is a **hypothesis, not a measurement.** The matrix never recorded stance/swing state, so
duty factor is inferred from the gait's known structure, not observed. The experiment that
would settle it: log per-leg stance fraction across the same runs and check whether Walknet's
exceeds the CPG's by the margin this story needs. Until then it stays a story that fits.

If it holds, the moral is nicer than the one I expected: on this terrain what rescued the
blind controller was not sensing the ground, but **never committing to a schedule that
assumes it.**

### 4. Blocks beat everything

At ±0.35 mm — a tenth of a body length, a kerb at fly scale — all three controllers are near
their breaking point: 1.1 / 1.7 / 3.6 mm/s against 14.0 on flat. The hybrid's ±4.2 sd is
larger than its own mean, and one of its three runs travelled **backwards** (−4.65 mm,
straightness −0.10). Reporting "hybrid: 3.6 mm/s" for that cell would be close to fiction.
A mean is only a summary when the thing has a central tendency; here it's a coin flip.

### 5. Behaviour transfers across machines; throughput does not

The baseline reproduced EPFL's published displacement to the digit (27.34 mm), while running
at 0.24× realtime against their reported 1.03× — about 4× slower on this laptop. Determinism
in MuJoCo means the physics is portable; the performance numbers in anyone's docs are not.

---

## Open threads

- **Vision.** The fly has simulated compound eyes. Nothing here uses them. A phototaxis or
  looming-avoidance run would exercise the part of this model that is genuinely unusual.
- **Olfaction.** Same — odour gradients at the antennae, unused so far.
- **Adhesion ablation.** Tarsal adhesion is on for every run above. Turning it off is a
  one-flag experiment and the papers suggest it matters a lot on non-flat ground.
- **Terrain difficulty sweep.** `run_matrix.py --difficulty` already takes the roughness knob
  (gap width, block height). The interesting number is the *breaking point* per controller,
  not the fixed-difficulty comparison.
- **Turning.** `HybridTurningController` exists in the demo package; descending commands as a
  2-vector is the brain/VNC interface the model is really built around.
- **GPU.** flygym 2.x has a Warp/MJWarp backend claiming ~60× realtime. Untested here.
