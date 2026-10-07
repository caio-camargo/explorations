# NeuroMechFly — driving EPFL's fly digital twin locally

**Version**: v1.0.1
**Author**: Caio Camargo + Claude (Opus 5, Opus 5.5)
**Date Created**: 2026-09-10
**Last Updated**: 2026-10-07
**Purpose**: Exploration notes — what NeuroMechFly v2 is, how to run it here, and what
the controller × terrain matrix and the breaking-point sweep taught
**Status**: Active — matrix and breaking-point sweep complete, open threads listed at the bottom

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
| `sweep_difficulty.py` | Breaking-point sweep: gap width and block height × 3 controllers × 3 seeds, in parallel processes; writes `out/sweep.json` |
| `plot_sweep.py` | Breaking points, trapped-in-gap counts, `out/sweep.png` |

### The machine got stricter (2026-10-07)

Between September and October the venv and Python 3.13 disappeared and **Windows Smart App
Control** was on. Rebuilt on Python 3.12 with the same pins. Smart App Control blocks a few
unsigned compiled files. Some cleared after a few load attempts (its reputation check seems
to need a first look); four stayed blocked. None is on the locomotion path:

| Blocked | Needed here? |
|---|---|
| `mujoco/plugin/sensor.dll` | No, but MuJoCo loads every bundled plugin at import, so **it is moved aside** to `C:/Users/caioa/.venvs/flygym/_blocked_plugins/` (a README there says how to restore it) |
| `mujoco/_render…pyd` | Only for video. **No mp4s on this machine until it clears** |
| `numba/_dynfunc…pyd` | Only `flygym.vision` (the retina). Blocks the vision thread |
| `pandas`, `fontTools` parts | Not imported |

The rebuilt setup reproduces six September matrix cells to four decimals (27.3426 mm etc.),
so Python 3.12 against 3.13 changes nothing measurable.

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

> **Tested 2026-10-07: half right.** Duty factor explains Walknet beating the CPG, but the
> hybrid survives best with the *fewest* legs down. See §8 under "Breaking points".

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

## Breaking points (2026-10-07)

The matrix asked who copes at one fixed roughness. This sweep asks **how much roughness each
controller can take.** 144 runs: 2 terrains × 8 levels × 3 controllers × 3 seeds, 2 s each,
in 12 parallel processes (26 min). Figure: [`out/sweep.png`](out/sweep.png). Raw:
[`out/sweep.json`](out/sweep.json).

- **Gapped**: 1 mm blocks, 2 mm deep gaps, gap width 0 → 0.8 mm (the matrix used 0.3).
- **Blocks**: a checkerboard with every other tile raised by h, h = 0 → 0.5 mm (matrix: 0.35).
  h = 0 is flat ground, so every curve carries its own control.

**Criterion, fixed before looking at the data:** a controller *breaks* at the lowest level
where its median speed drops below 50 % of its own median speed at level 0. On gaps a run is
also *trapped* if the thorax goes below the block tops while still over the terrain.

Median speed in mm/s (each T = one of three runs trapped in a gap):

| gap width (mm) | 0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.8 | **breaks at** |
|---|---|---|---|---|---|---|---|---|---|
| CPG | 12.7 | 4.9 | 4.4 T | 1.0 TT | 2.6 TT | 1.0 TTT | 1.4 TTT | −2.2 TTT | **0.1** |
| Walknet | 6.6 | 5.8 | 6.8 | 5.8 | 1.1 TTT | 2.3 TTT | −1.2 TTT | 1.1 TTT | **0.4** |
| Hybrid | 12.8 | 13.2 | 10.3 | 7.2 | 6.9 T | 1.6 TTT | 5.2 TT | −1.1 TTT | **0.5** |

| block step h (mm) | 0 | 0.05 | 0.1 | 0.15 | 0.2 | 0.25 | 0.35 | 0.5 | **breaks at** |
|---|---|---|---|---|---|---|---|---|---|
| CPG | 11.8 | 3.2 | 1.2 | −0.8 | 2.3 | 4.0 | 0.9 | 0.9 | **0.05** |
| Walknet | 6.7 | 7.2 | 3.4 | 1.6 | 4.0 | 1.4 | 1.5 | 2.1 | **0.15** |
| Hybrid | 12.1 | 12.0 | 11.2 | 5.0 | 0.0 | 5.7 | 5.9 | 6.1 | **0.15** |

Commanded duty factor (the fraction of time a leg's adhesion is on; every controller switches
it on exactly when the leg is outside its swing window), averaged over all 48 runs each:

| | duty factor | legs down (mean) | time with < 3 legs down |
|---|---|---|---|
| CPG | 0.65 | 3.9 | 0.7 % |
| Walknet | 0.71 | 4.3 | 0.0 % |
| Hybrid | **0.53** | **3.2** | 2.4 % |

### 6. The CPG breaks at the first notch of the knob

The tripod CPG loses more than half its speed at a **0.1 mm gap** and at a **0.05 mm step**:
a thirtieth and a sixtieth of its body length. There is no rough regime in which it copes.
The matrix's 0.3 mm gaps and 0.35 mm blocks were far past its failure, which is why it looked
like a cliff. It is not a cliff; the CPG fails at the first imperfection.

### 7. Walknet doesn't degrade. It holds, then drops

On gaps Walknet's speed is flat from 0 to 0.3 mm (6.6, 5.8, 6.8, 5.8) and no run falls in. At
0.4 mm every run falls in. It pays half its flat speed for that plateau. The hybrid degrades
smoothly instead (13.2 → 10.3 → 7.2 → 6.9) but stays faster than Walknet at every width up to
its own break. By *retention* Walknet is the most robust up to 0.3 mm (88 % against the
hybrid's 56 %); by *speed* the hybrid wins everywhere. Which is "better" depends on which you
mean, and the single-difficulty matrix could not tell those apart.

### 8. Duty factor explains half of it (hypothesis 3, tested)

The prediction was that Walknet beats the CPG because it keeps more legs down. It does: 4.3
legs on average against 3.9, and never fewer than three. That fits the CPG-vs-Walknet gap.

But the hybrid, the most robust controller, has the **lowest** duty factor of the three (0.53,
3.2 legs down, under three legs 2.4 % of the time); its swing extension keeps feet up longer.
So §3's moral ("never committing to a schedule that assumes the ground") is not the whole
story. There are **two separate routes to robustness**: a static one (more feet planted,
Walknet) and a reactive one (fewer feet planted, but a leg that misses is caught and
re-placed, the hybrid). The CPG has neither.

Caveat: this is *commanded* stance, not measured contact. Contact sensors are off on rough
terrain (`ROUGH_KWARGS`), so a foot commanded down over a gap still counts as down.

### 9. Past the break, the curves stop meaning anything

Above each breaking point the medians bounce (hybrid on blocks: 5.0, 0.0, 5.7, 5.9, 6.1),
seeds spread from −3 to +9 mm/s, and the hybrid seems to *recover* on tall blocks. With three
seeds that is noise until shown otherwise. Read the tables up to the break column, not past it.

### Measurement traps found on the way

- **The worlds end at x = 25 mm.** A fly at full speed covers ~25 mm in 2 s and walks off the
  far edge: on gaps it drops to the 2 mm floor; on blocks there is no floor at all and it falls
  to z = −75 mm. So a run's `z_min` cannot tell "fell into a gap" from "finished the course".
  The trapped check uses the raw thorax trace restricted to x < 24 mm. The edge also caps
  level-0 progress, so level-0 speeds (≈ 12 mm/s) read lower than the matrix's flat 14.
  The matrix's "the CPG falls in" result is unaffected: at 0.9 mm/s it never reached the edge.
- **On rough terrain the body has no collision.** Only tibia and tarsus touch the ground, so a
  fly that tips over sinks its thorax through the tiles (z ≈ −0.2 mid-terrain on blocks). That
  is a real failure, not a solver bug.
- **Walknet ignores most of its seed.** Seeds 0 and 2 gave bit-identical runs in several
  cells, so its effective n is below 3.

---

## Open threads

- **Vision.** The fly has simulated compound eyes. Nothing here uses them. A phototaxis or
  looming-avoidance run would exercise the part of this model that is genuinely unusual.
- **Olfaction.** Same — odour gradients at the antennae, unused so far.
- **Adhesion ablation.** Tarsal adhesion is on for every run above. Turning it off is a
  one-flag experiment and the papers suggest it matters a lot on non-flat ground.
- ~~**Terrain difficulty sweep.**~~ Done 2026-10-07, see "Breaking points".
- **Measured duty factor.** Turn tarsal contact sensors on and compare actual stance with
  commanded stance, especially for the hybrid over gaps.
- **Hybrid without swing extension.** If its low duty factor is the price of clearance,
  removing the extension should hurt it on gaps; if incidental, nothing changes.
- **Longer worlds.** The 25 mm terrain edge caps progress near flat; pass a larger `x_range`
  to the worlds before comparing speeds at low difficulty.
- **Turning.** `HybridTurningController` exists in the demo package; descending commands as a
  2-vector is the brain/VNC interface the model is really built around.
- **GPU.** flygym 2.x has a Warp/MJWarp backend claiming ~60× realtime. Untested here.
