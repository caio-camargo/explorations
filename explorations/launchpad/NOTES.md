# Launchpad — a lean rocket/orbit sandbox
**Version**: v1.21.21 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-06 · **Status**: prototype, playable
**Purpose**: See how small a KSP-like core can be when it's built for leanness from the start.

[Run it](index.html) (WebGL2, any modern browser). Headless checks: `node test.mjs`.

---

## The idea

Kerbal Space Program is the inspiration, not the template. The question is what you get by
building from the ground up for leanness. KSP's well-known pain points (the Kraken, wobbly
rockets, slow loading, heavy CPU per part) mostly come from one source: a general-purpose game
engine running float32 rigid-body physics on every part. So the prototype makes the opposite
choices on purpose:

| KSP pain | Root cause | What Launchpad does instead |
|---|---|---|
| Kraken / jitter far from origin | float32 physics + floating-origin hacks | All state is **float64** (JS numbers). The GPU only ever gets **camera-relative** positions, computed on the CPU in doubles. There's no origin to shift. |
| Orbits drift, warp is restricted | numerical integration everywhere | Coasting outside the atmosphere is **on rails**: exact Kepler propagation (universal variables), so ellipses, hyperbolae and SOI changes all fall out of one function. Warp to 100 000× costs about 4–10 µs a frame. |
| Wobbly rockets | every part is a rigid body joined by springs | The vessel is **one rigid body**. Parts only matter for mass, CoM, fuel, staging and looks. |
| Terrain LOD / loading cost | planets are huge meshes | Planets and moons are **ray-cast in one full-screen shader**, with analytic spheres and procedural colour. No meshes, no LOD, nothing to load. |
| Depth fighting across huge scales | standard depth buffer | **Logarithmic depth**, written in every shader. One depth buffer covers 4 m to 10¹² m. |

The whole thing is one 62 KB HTML file (24 KB gzipped), 826 lines, with no dependencies and no build step.

## What's in v1.0

- **Assembly**: a single stack of parts (pod, chute, 4 tanks, decoupler, 4 engines), presets
  (Hopper / Orbiter / Lunar), and live per-stage Δv (vac & sea level), TWR and burn time.
  Decouplers split the stack into stages automatically.
- **Flight**: thrust with pressure-dependent Isp; drag with an angle-of-attack term; a
  weathervane torque (rockets fly nose-first, a bare pod flies shield-first); a 2-stage
  parachute; planet rotation (you get ~174 m/s free going east); landing and crash detection;
  dropped stages tumble away as debris.
- **SAS**: stability, prograde/retro, normal/anti-normal, radial in/out. With SAS on, the keys
  command a rotation *rate* (fly-by-wire). With SAS off they apply raw torque.
- **Navball**: drawn per pixel into a 180² ImageData, in the aircraft convention.
- **Map**: patched-conic prediction up to three legs (orbit → Selene encounter → escape back to
  Tellus), with Ap/Pe/encounter/escape labels, a ghost SOI at the encounter, and Selene's orbit
  and SOI ring.
- **The system**: Tellus (R 600 km, g 9.81, 70 km atmosphere with a 5.6 km scale height, 6 h day) and
  Selene (R 200 km, orbit 12 000 km, SOI 2 430 km). The atmosphere uses single scattering
  (Rayleigh + Mie, 12×4 samples), lit from a fixed sun.

## Measurements (2026-10-06, RTX 3050 laptop, Chrome)

| What | Number |
|---|---|
| GPU time per frame, near the pad | 3.9 ms @ 1920×1080, 13.2 ms @ 2880×1620 (timer query). My first figure, 0.35 ms, was measured in a tiny preview pane and was misleading. |
| GPU time per frame, map view | 0.7 ms @ 1080p, 1.4 ms @ 2880×1620 |
| CPU per frame, warm (render + navball + HUD) | ~1.7 ms |
| CPU per frame, first navball version | 11.6 ms → see "negative results" |
| Kepler: one period of an ellipse returns home | 2×10⁻⁹ m error |
| Kepler: 10-day low orbit, energy drift | 2.8×10⁻¹⁴ (relative) |
| Same orbit integrated with symplectic Euler at 50 Hz | 9.7×10⁻¹⁰ drift, **19 m radius error**, 7.9 s CPU for 43 M steps |
| 30 days at 100 000× warp, change in Ap / Pe | 3×10⁻⁷ m |
| Scripted gravity turn, Orbiter preset → 81 × 72 km orbit | 3 253 m/s spent, 1 647 left, max q 25 kPa, max 4.1 g |
| Predicted Selene SOI entry vs actual (on rails) | 5.53 h vs 5.54 h |
| Hohmann TMI from 80 km | 856 m/s |
| Preset Δv (vac) | Hopper 1 682 · Orbiter 4 967 · Lunar 6 664 m/s |

The Euler line is the argument for rails. A step-integrated orbit stays visibly accurate for
days, but you pay 43 million steps for it, and it still drifts. Kepler is exact and free.

## Negative results / things that went wrong

- **Navball with per-pixel trig was the entire frame budget.** `asin` + `atan2` per pixel for
  32 k pixels came to 11.6 ms. Rewritten with no trig, it costs about 1.5 ms. Elevation lines are tests
  on |sin el| directly. Heading lines are 4 great circles through the poles (`|de|`, `|dn|`,
  `|de±dn|` against a width scaled by the horizontal length). Packed `Uint32Array` writes.
  The GPU was never the problem.
- **The navball convention was wrong on the first try.** Pitching east put the horizon on the
  *left* of the ball. The fix is the aircraft convention: on the pad the rocket's belly faces
  east, so W pitches over toward east, the horizon drops to the bottom, and heading reads 090.
- **Raw-torque keys are unflyable.** One 2.5 s press of W at liftoff spun the Orbiter at
  1.5 rad/s and put it horizontal at 500 m. With SAS on, keys now command 0.3 rad/s. Then one
  0.8 s tap of W followed by prograde-hold flies a clean gravity turn (79° → 34° over two
  minutes).
- **A chute that only opens under 250 m/s never opens.** A dense 2.5 t Hopper falling from
  80 km peaks around 1 000 m/s and still hits the ground at 540 m/s, because the thin atmosphere (H = 5.6 km)
  doesn't slow it in time. Fixed with a semi-deploy (6 m², below ~20 km) before full deploy
  (600 m²). Full canopy descent is ~9 m/s, and the crash threshold is 12 m/s.
- **Ground looked like flat haze from altitude.** The first Mie coefficient (2.1×10⁻⁵) whitewashed
  everything. It's now 5×10⁻⁶, with brighter ground and two more noise scales (pf·90, pf·420).

## v1.1 — sluggishness report (2026-10-06)

Caio: "controls are laggy, and so is the zoom". Zoom being slow too means the frame rate is low, not that the rocket turns slowly.
(Separately, the turning *is* slow: the Orbiter coasting takes 1.4 s to spin up to 0.3 rad/s and 1.4 s to stop.)
- The ground shader costs about 4 ms per 1080p frame on the RTX 3050. At high-DPI fullscreen that's about 13 ms, and the Windows
  browser may be running on the integrated GPU instead.
- Added: async GPU timer queries (they never stall the pipeline), plus **adaptive resolution** that keeps GPU time under ~7 ms (35–100 % of
  the 1.5×-capped DPR, with hysteresis). The perf readout is now legible and names the GPU the browser actually got.
- Zoom: about 1.28× per wheel notch (was 1.13×).
- **Result on Caio's laptop:** the Intel iGPU runs at 31 fps with 17.5 ms GPU at the 35 % floor. The RTX 3050 runs at 80 fps with 5.1 ms GPU at 75 %.
  Both feel smooth ("comparable to the game"). The cause was the browser defaulting to the iGPU, combined with a fixed full-res render.
  On the iGPU, scaling is pinned at the floor and still over budget, so per-pixel shader cost is the next lever there
  (atmosphere 12×4 samples, 6-octave fbm ×3, near-field detail).


## v1.2 — aerodynamics from shape, structural loads, exact physics warp (2026-10-06)

Decided with Caio before building: keep **one rigid body** (no part joints, no wobble), compute **per-joint loads**
inside it, and make the vessel a **tree of parts** now so that radial parts later don't force a rewrite.

### How it works
- **Data model.** Parts form a tree rooted at the pod, and each part has a position, its own fuel and an `on` flag. Staging and failures
  both go through `detach()`, which turns a branch into one debris body carrying its centre-of-mass velocity, spin included.
- **One per-part pass per step** (`aeroPass`), body frame:
  - *Newtonian impact pressure* on every upstream-facing surface element of the merged outer profile, sampled 8 times around each ring.
    The stagnation coefficient rises with Mach (1 + 0.28M² subsonic, 1.84 − 0.56/M² supersonic) and has a transonic bump at M ≈ 1.05.
  - *Axial shadowing*: an upstream-facing face only counts beyond the widest radius in front of it. So engine bells
    tucked under a tank don't drag, and the boat-tail around a bell gets base suction.
  - *Slender-body normal force* `q·sin2α·dS` where the cross-section changes. It's linear in α, so small-angle
    stability exists at all (Newtonian alone is ∝ sin²α, which gives almost nothing near zero). It only applies when length/diameter > 1.5.
  - *Cavities*: a surface recessed below the radius on both sides (a Petrel bell in an interstage gap) gets no
    slender-body lift and only 30% of the impact pressure.
  - *Fins* as flat plates: CN = 3.5·sinα·cosα + 1.2·sin²α, i.e. about 6 m²/rad for the ring, matching Barrowman with body interference.
  - Base suction on exposed rear faces (×0.25 behind a burning engine), skin friction, and the parachute at its attach point.
- **Loads** (`structLoads`): for each joint, (inertial demand of the branch) − (external forces on it) = what the
  joint carries. That's split into compression/tension and bending, compared against the weaker part's rating, and low-passed over
  about 3 steps. Over 100% detaches the branch. Control torque goes to the pod's reaction wheels first, and the rest becomes an engine-gimbal
  *side force*, which also pushes the vessel (see the bug below).
- **Builder readout** (`probe`): CoM/CoP markers, a stability margin in calibers (full, stage-1 dry, M 1.6), and
  worst-joint load at liftoff and at a trimmed 25 kPa / M 1.2 / 5° max-q.
- **Exact physics warp up to 100×**: the fixed step stays 0.02 s, with more steps per frame. Warp drops to 1× on any event message, within 4 s of
  ground contact, or when a joint passes 70%. Capped to 4× within 15 s of the ground.

### Measurements
| What | Number |
|---|---|
| Stability margin (calibers), full / stage-1 dry / M1.6 | Orbiter **+0.88 / +1.91 / +0.62**; Lunar +1.46 / +3.33 / +0.96 |
| Same without the fin ring | Orbiter −3.35, Lunar −4.34 |
| Orbiter with a pointed nose cone instead of the chute | **−0.39**. The cone adds lift far forward. Less drag, less stable, same as real rocketry. |
| Real-dynamics ascent (0.8 s W tap, prograde hold), worst joint | Orbiter 20 % (max q 26.8 kPa); Lunar 51 % (max q 50 kPa) |
| Lunar, 2 s / 3 s hard pitch at max-q | 91 % survives / **snaps at Tank 8 t – Decoupler** (bending 101 %) |
| Orbiter, 3–8 s hard pitch at max-q | never above 41 %: short and stout |
| Coast at 450 m/s, SAS off, 3° nudge | fins: max AoA 2.2° · no fins: **tumbles to 178°** |
| Bare pod re-entry from 75 km at 2.3 km/s | 100 % shield-first, max 8.4 g, lands at 5 m/s under the chute |
| 1× vs 100× physics warp | bit-identical position and attitude after 160 s |
| Cost per physics step, 13-part Lunar | 11–27 µs (JIT-dependent) → 100× costs 1–2.3 ms per 60 Hz frame |

### What it taught (including two bugs)
- **With SAS on, fins hardly matter while the engine burns.** A 7 % gimbal on the Kestrel gives ~113 kN·m, against a
  destabilizing aero moment of ~20 kN·m at 5°, so unstable rockets fly fine under power (like the finless Saturn V). Fins earn their place
  when the engine *isn't* steering: coasting, SAS off, or flying back through the air. That fell out of the model;
  nobody wrote a rule for it.
- **Stable at speed means hard to abuse.** Holding W for 10 s at Mach 2.8 could only force 6.5° AoA on the Lunar rocket,
  because the aero restoring moment beats the controls. You break rockets by yanking early and low, around 15–25 kPa, before the
  rocket has fully weathervaned.
- **Bug: the gimbal force was in the joints but not in the acceleration.** The Lunar stack snapped 0.1 s into its first
  steering input, at low speed, from a phantom 900 kN·m. That's because the side force was applied to the structure but never accelerated the body,
  so the joints "absorbed" an unbalanced force. The check that catches this kind of thing: the branch sums over the whole vessel must
  come to zero.
- **Bug: the first fins were half-strength** (2.8 against Barrowman's ≈6 m²/rad), and the open interstage gap
  produced a 600 N spurious nose-like force. Together they made *every* preset unstable. Per-part force breakdowns
  (`Fx` and point of action by part) found both in one look.
- **The bare pod was neutrally stable and re-entered nose-first**, and then the chute ripped off. A capsule needs its
  mass low: CoM at 25 % of height (it was 38 %) makes it flip to shield-first on its own. The main chute also has to wait for
  thick air (~3 km). Opening it at 15 km meant a 4 000 s float.


## v1.3 — radial attachment: side boosters and side tanks (2026-10-06)

Step 5 of the agreed plan. The v1.2 tree model held up: what changed was mostly generalising things that had
assumed "everything sits on the axis".

### How it works
- **Design format.** The core stack (top→bottom) as before, where an entry may be `{k, rad:{n, dec, stack}}`: *n* symmetric
  copies of a side stack beside that core part, bottoms level with it, at 1.5 m from the axis. In the builder, ⊕ on a row
  adds a side stack, the group header picks ×2/×3/×4 and decoupler on/off, and the palette adds to whichever
  stack is selected.
- **Tree.** Each side stack hangs at its mid-height: core part → radial decoupler → the side part at that height, with the rest
  of the side stack chained from there. Without a decoupler, the side part joins the core directly and stays for good.
- **Joint frames.** Every joint now carries its own point and axis (`jP`, `jA`, parent → child). Stack joints are
  vertical and side joints radial. Loads are read in that frame: along the axis → compression/tension, across it → **shear**
  (new rating `S`, default 0.5·C), moment across it → bending. A booster's thrust reaches the core as *shear* through
  the radial decoupler, which is rated as the usual pair of attach points (S 500 kN, B 500 kN·m).
- **Aero per stack line.** Parts are grouped by axis position (core and each side stack). Each line gets its own merged
  profile, shadowing, cavities and slender-body factor. Lines don't shade each other (no interference).
- **Off-axis everything.** `geom` computes the inertia diagonal with x/z offsets. Thrust acts at each engine's own mount, and
  gimbal authority uses the 3D lever. The gimbal side-force is shared by all burning engines. Meshes, plumes, debris and the
  CoM marker take a full 3D offset.
- **Staging events** are explicit: `{decouple:[segs], ignite:[segs], radial?, chute?}`. Side groups with
  decouplers are their own segments. They light with their host core segment and drop just before it. Separation kicks
  boosters outward (2.5 m/s) and stages backward.
- **Δv with parallel burns** (`dvPlan`): the event list is played forward, burning every ignited segment together and
  staging whenever the segments the next event drops have run dry. The same planner drives the builder table and the HUD.

### Measurements
| What | Number |
|---|---|
| Heavy preset (Orbiter core + 2 boosters of cone/4 t/fins/Kestrel) | 24.5 t, TWR 2.59, Δv 1758 + 1447 + 2465 = **5671 m/s** (Orbiter alone: 4894) |
| Heavy stability margin, ×2 / ×3 / ×4 (no decoupler) | +0.77 / +0.64 / +0.54 cal |
| Heavy liftoff, worst joint | 13 % **shear**, Tank 4 t / Radial decoupler (booster thrust going into the core) |
| Heavy flight, worst joint | 23 % (side-joint shear, at booster burnout) |
| Booster separation | 47.7 s; debris leaves at (±2.5, −0.5, 0) m/s in the body frame. The core burns on to 95.3 s |
| Lunar 3 s / 4 s yank at max-q | 100 % survives / 103 % snaps (was 3 s in v1.2; see below) |

### What it taught
- **Where the gimbal pivots matters to the structure.** Moving the gimbal lever from the nozzle exit to the engine mount (where a
  real gimbal sits) cut the Condor's steering authority by ~1.5 m of lever. The Lunar yank test went from breaking at 3 s to
  breaking at 4 s. I moved the test, not the physics.
- **Identical boosters are pointless.** The first Heavy used the core's own tank on the boosters, so everything burned out
  together and separate staging bought nothing (one 3376 m/s stage). With smaller booster tanks they burn out at 48 s and
  the core flies on: three stages, and +830 m/s over the plain Orbiter at a far higher TWR.
- **Booster nose cones destabilise.** The first Heavy came out at −1.11 cal: cones on the boosters add lift well ahead of the
  CoM. Fins on the boosters bring it to +0.77.


## v1.4 — maneuver nodes (2026-10-06)

### How it works
- **A node** is `{t, dv:[prograde, normal, radial-out]}` on the current leg of the trajectory (before any SOI change;
  an SOI change clears it). The frame comes from the Kepler state *at the node's time*: prograde = v̂, normal = ĥ, and radial-out = v̂ × ĥ, the same as the SAS modes.
- **Placing it:** click your orbit in map view (the leg is sampled into 361 points carrying their times, projected
  each frame), drag the node along the orbit to move it, or press **N** for the next apoapsis.
- **Editing:**
  - Six handles on the map node. Drag outward along one; the change is a *rate* that grows with drag distance, 0.02·px² m/s per second.
  - Or the panel: ± buttons at 0.1–100 m/s steps, and time shifts of ±5 s, ±1 min and ±1 orbit.
- **The plan:** `predictFrom()` (what `predict()` became) runs from the post-burn state and draws dashed, with its own
  Ap/Pe/encounter labels marked "▸plan".
- **Flying it:**
  - The burn time comes from the rocket equation with the current (or next-stage) engines.
  - **Warp to burn** auto-steps the warp level down so it lands exactly on t − burn/2 − 15 s. Rails sub-steps are clamped to the target.
  - **SAS → Maneuver** and a blue navball marker point at the remaining Δv.
  - When thrust starts inside the burn window, the world-frame Δv *freezes*, and every m/s the engines deliver is subtracted from it. When it's used up (or overshot), the node clears and the throttle cuts.

### Measurements
| What | Number |
|---|---|
| Planned +856 m/s prograde from 80 km | Ap exactly 12 000.0 km (Selene's orbital radius, the textbook Hohmann) |
| Planned 200 m/s normal | inclination 5.015° (atan(200/2279) = 5.015°) |
| Burn-time estimate vs actual (Petrel upper stage, 856 m/s) | 40.0 s vs 40.0 s |
| Flown burn (SAS on node, centred on the node) | Ap 11 902 km vs plan 12 000 km: **0.82 % short** |
| Browser run: warp-to-burn | 104 frames up to 10 000×, arrived at T+1989.3 s for a 1989 s target |
| Browser run: Selene periapsis flown vs planned | 773 km vs 658 km |

### What it taught
- **A 40-second burn isn't an impulse.** Spread over ±20 s around the node, the burn loses ~0.8 % of apoapsis (gravity
  losses plus the thrust direction lagging the moving node vector). At a 12 000 km transfer that's ~100 km of
  Selene periapsis, which is exactly why real missions (and KSP players) plan a mid-course correction.
- **Bug: the node froze its Δv from itself.** `nodeBurn` set `burning = true` *before* asking `nodeInfo` for the Δv to
  freeze, and `nodeInfo` then took the "already burning" branch with nothing frozen yet. The headless burn test
  crashed on the first thrust step. The order of two assignments was the whole fix.
- **Test expectations are code too.** The first plan check "failed" because I'd written the transfer apoapsis
  as r₀ + a instead of a. The simulation was right to the metre.


## v1.5 — structural design: joint reinforcement, interstages, the 2.5 m class (2026-10-06)

Step 1 of the "parts beyond KSP" scoping (life support set aside). The idea: KSP never knew what a joint carried,
so its only structural tool was "add struts until the wobble stops". Here every joint's load is known, so structure
can be *designed*.

### What's in it
- **Per-joint reinforcement** stored on the joint (`{k, j}` on the child entry, `rad.j` for a side group):
  standard ×1, reinforced ×2 (+60 kg), heavy ×4 (+180 kg), with the mass scaled by (joint radius / 0.625 m)².
  The builder shows every joint's worst load across the liftoff and max-q cases *between the rows*, with a button to cycle the
  setting. Reinforced joints get a dark collar on the model (two for heavy).
- **Interstage decoupler.** A decoupler whose shell (0.1 t/m) reaches up around the engine above it:
  - The aero profile is filled out to the shell radius, so the cavity disappears.
  - Joint limits skip the enclosed engine's rating, because the shell carries the load from the tank above to the stage below.
  - It drops with the lower stage, as any decoupler does.
- **2.5 m class**, as the 1.25 m shapes scaled ×2: Tank 16 t / 32 t, decoupler, fin ring, nose cone, the Albatross engine
  (1100 kN), and a 2.5 → 1.25 m adapter.
  - Tanks hold 8× (volume). Compression/tension/shear ratings ×4 (wall area), bending ×8 (section modulus ∝ r²·wall, wall ∝ r).
  - Every place that assumed one radius now uses the part's own `d.r`: inertia, fins, side-stack spacing, joint points.
- **New preset, Big Lunar**: the Lunar upper stages on an interstage, adapter, Tank 32 t, 2.5 m fins and an Albatross. 48 t,
  TWR 2.14, 7581 m/s.
- `analyze()` moved into the tested core, see the bug below.

### Measurements — fixing the Lunar stack's 4 s max-q yank
| Fix | Added mass | Result |
|---|---|---|
| none | — | snaps at Tank 8 t / Decoupler (bending 103 %) |
| reinforce that joint | +60 kg | **snaps one joint up** at Decoupler / Petrel (102 %) |
| reinforce both joints | +120 kg | survives, worst 91 % |
| interstage instead of the decoupler | +130 kg | survives, worst **69 %** |

Other numbers: Big Lunar stability +0.66 cal (on 2.5 m), worst in flight 32 % (T32 / adapter bending). The interstage closes the Orbiter's
engine cavity (cavity edges 3 → 1), and max-q worst drops from 16 % to 10 %.

### What it taught
- **Reinforcement moves the failure; it doesn't remove it.** Strengthening the joint that broke exposed the next-weakest one
  immediately. That's the real loads-engineering loop, and it fell out of the model with no extra rules.
- **The interstage is the efficient fix** because it changes the load *path* (around the engine), not a joint's strength.
  Better margin for about the same mass as two reinforcements.
- **The interstage barely changes drag** (15.62 vs 15.73 kN at M 0.9 / 20 kPa, α = 0): the gap surfaces were already in
  the shadow of the tank ahead. Its aero value is at angle of attack (no cavity normal forces), not in drag. Recorded, not tuned.
- **Bug: a misplaced brace in `analyze()` broke the page on load**, and the 25 headless checks all passed, because `analyze`
  lived in the UI code. It now lives in the tested core, and a check runs it on every preset. (Lesson: the test
  boundary has to follow the logic, not the file layout.)
- **Another wrong-index slip in my own experiment:** I "reinforced" Lunar's index 8, which replaced the decoupler with a second
  8 t tank (+8 t). The mass column caught it.


## v1.6 — resources and crossfeed (2026-10-06)

Step 2 of the scoping: the foundation that power and life support would later sit on, made useful now through fuel crossfeed.

### How it works
- **Resources.** Every part holds `res {name: amount}` up to `cap`, and mass = dry + Σ amount × density (`RES` registry).
  Only `fuel` exists (in tonnes). A new resource is a registry entry plus producers and consumers.
- **Flow follows the tree.** Fuel crosses every joint except a decoupler's own (decoupler ↔ the part it holds on to), unless
  that decoupler is set to **crossfeed** (`{k:'dec', x:true}` on a core decoupler, `rad.x` on a side group). The connected
  pieces are flow groups, recomputed when parts come off.
- **Drain order = drop order.** Each engine draws from its whole flow group. The tanks whose segment the event list
  drops soonest go first, proportionally within that tier (`dropRank`, `drawFuel`). With crossfeed, boosters feed the core
  engine too and empty first, so the core is still full when they go.
- **One model for flight and plan.** `physStep` and `dvPlan` call the same `flowGroups`/`drawFuel`. The planner steps
  exactly from tier-empty to tier-empty: proportional draining empties a whole tier at once, so no time step is needed.
  A segment is "ready to drop" when *its own tanks* are empty (with crossfeed its engines would run on).
- **In flight**, a crossfed group that empties says "boosters empty — stage to drop them". With several side groups they're
  lettered A, B, … and each later group is turned by half a step so they don't overlap.
- **New preset, Asparagus**: Orbiter core + two crossfed booster pairs.

### Measurements
| Design | No crossfeed | Crossfeed |
|---|---|---|
| Heavy | 5671 m/s | **5949** (+278) |
| Asparagus | 6050 m/s | **6638** (+588), 4 stages: 688 / 1055 / 2429 / 2465 |
| Asparagus, crossfeed on pair B only | | 6461 |
| Asparagus, crossfeed on pair A only | | **6050** (no gain at all) |

Flight: pair A runs dry at T+19.1 s, with the core and pair B at 100 %.

### What it taught
- **Crossfeed only pays if the crossfed tanks are also the first to drop.** With crossfeed on pair A only, pair B (fed by itself
  *and* the core engine) empties at 32 s. But staging order says A goes first, and A isn't dry until 48 s, so B's dead
  boosters ride along and keep draining the core for 16 s. Nothing is shed early, and the Δv comes out *exactly* equal to no
  crossfeed. The model enforces the real asparagus rule without anyone writing it down.
- **Bug: segments that are never dropped got drain rank ∞**, and the "lowest rank first" search never matches ∞. So the upper
  stage *never drained*. The planner lost the whole upper-stage Δv, and in flight the stage burned at constant mass (the node burn
  took 45 s instead of 40 and missed by 1.01 %). A finite sentinel fixed both. The old per-stage numbers then came back
  **identical** (4894 / 5671 / 6639 m/s), which is now a test: without crossfeed, the new flow model must reproduce the old one.


## v1.7 — re-entry heating (2026-10-06)

### How it works
- **Heat in.** Sutton–Graves stagnation heating, q = k·√(ρ/r_nose)·v³ with k = 1.83e-4 for air, applied to every upstream-facing surface
  element in the same loop as the Newtonian pressure (each element gets q·|cos|). So **shadowing works for heat too**:
  whatever rides behind a wider shield stays cool.
- **Skin temperature per part.** The heat capacity is a 6 kg/m² metal skin over the part's wetted area, and the skin radiates εσ(T⁴ − T∞⁴) from all
  of it. Each kind has a limit (pod 1250 K, chute 1000 K, tanks 1300 K, engines 1500 K). A part past its limit is destroyed:
  its branch comes off, or the flight ends if it's the pod. Parts cool exponentially on rails.
- **Heat shield** (r 0.66 m, wider than the stack) carries **40 kg of ablator as a resource**, the resource system's second user.
  Above 700 K ablation soaks up 2.5 MJ/kg and pins the shield there until the ablator is gone. The backing structure fails at 1700 K.
- **Heating gain ×3 (`HEAT_GAIN`)**, chosen by sweep, see below. Plus a plasma glow on the upstream side scaled by heat flux, and a
  HUD "Heat" row with the hottest part (relative to its limit) and ablator left.
- **Big Lunar** now has a heat shield under the pod, with a decoupler beneath it to drop the lander before re-entry.

### Measurements — choosing the gain (entries set up from real orbits, periapsis 30 km unless noted)
| Gain | Low-orbit return, bare pod | Selene return, bare pod | Selene return + shield |
|---|---|---|---|
| 1 (pure Sutton–Graves) | 53 % of limit | 66 % | 21 % (ablator untouched) |
| 2 | 69 % | 90 % | 21 % |
| **3 (chosen)** | **80 %** | **burns up at 1250 K** | pod 29 %, **48 % ablator left** |
| 4 | 87 % | burns up | pod 28 % |

Also with gain 3: three Selene returns on one shield go 47 % → 0 % → *burned through*. Ascent peak heating is 41–52 % of the hottest part's limit
(Orbiter / Lunar / Big Lunar). Peak flux on a Selene return is about 700 kW/m² at 32 km (Mach 8.6).

### What it taught
- **A small planet re-enters gently.** Orbital speed here is 2.3 km/s, about a third of Earth's, and heating goes as v³. Pure physics makes
  even a Selene return harmless for a bare pod (66 %), so a gain is needed for the shield to mean anything. KSP faces the
  same issue with its own heating multiplier. I chose ×3 by measurement: the smallest gain where "orbit: survivable bare,
  Moon: needs a shield" holds.
- **A shield needs a weak backing, or the ablator is decorative.** At 3300 K the spent shield survived any number of
  returns on radiation alone. The ablator only became a budget once the shield's structure could fail (1700 K).
- **The first ablator was 100× too much** (200 kg at 15 MJ/kg against ~40 MJ of heat per Selene return). Sizing it to the actual
  heat load (40 kg × 2.5 MJ/kg) gives about one comfortable return per shield.
- **Bug (old, now caught): 2.5 m tanks inherited the 1.25 m tanks' fuel load** once tank contents moved into `res0`. The
  Big Lunar flight check failed with the rocket at 23 t instead of 48 t, and the scaled-part clone now recomputes its contents.

## Ideas from KSP's most popular mods (research, 2026-10-06)

Sources: download counts from CKAN's `download_counts.json` (parsed 2026-10-06; it undercounts mods hosted elsewhere, e.g.
MechJeb has ~3.8 M downloads on CurseForge), plus "must-have" threads on r/KerbalSpaceProgram and the KSP forum. The pattern is what players had to add:

| Player need | Top mods (CKAN downloads) | Launchpad status / idea |
|---|---|---|
| **Numbers to plan with** | Kerbal Engineer Redux 1.9 M, Alarm Clock 1.3 M, Trajectories 1.1 M, BetterBurnTime 0.6 M, Transfer Window Planner | Δv/TWR, burn time, node countdown: done. **Next: an impact/landing prediction with drag** (Trajectories), **alarms**, and **transfer-window plots** (the planner's patched conics already run fast enough) |
| **Not flying the same launch by hand forever** | MechJeb (~3.8 M CurseForge), kOS 0.4 M | **Autopilots unlocked by doing it once by hand** (players' own compromise). The sim is deterministic, so a *recorded* ascent could replay exactly |
| **Deeper physics** | FAR 1.0 M, Deadly Reentry 0.5 M, KJR 1.4 M, Principia, RSS/RO/RP-1 | Shape aero, heating, no-wobble structure: done. **Next: n-body (Principia-style) as an option**, since float64 + Kepler make it cheap-ish |
| **Long missions mattering** | TAC-LS 0.8 M, Kerbalism 0.7 M, USI-LS 0.6 M | Scoped and parked. The forums' main complaint is **bookkeeping without decisions**, which matches our own prerequisite |
| **Part freedom** | TweakScale 1.5 M, Procedural Parts 1.1 M, B9PartSwitch 2.0 M, Procedural Wings | 2.5 m class done. **Parametric tanks** (length/diameter/wall) are the natural next step: meshes and aero are already procedural |
| **Wonder** | EVE 4.4 M (top overall), Scatterer 2.7 M, Parallax 2.1 M, Waterfall 1.3 M | Scattering atmosphere done. **Clouds, terrain relief, better plumes** are the most-installed mods of all |
| **Goals** | Contract Configurator 1.5 M, Community Tech Tree 1.5 M, StageRecovery 0.4 M, RemoteTech 0.7 M | Nothing yet. **Missions / challenges** are the biggest missing layer. Stage recovery fits the reusable-booster idea |


## v1.8 — impact prediction, record-and-replay autopilot (2026-10-06)

The two ideas taken from the mod research: a Trajectories-style landing prediction, and MechJeb's job done the way players
said they wanted it (fly it yourself once, then let it repeat).

### Impact prediction (`predictImpact`)
- A point mass flown forward from now. Vacuum legs are **exact Kepler**, including vacuum arcs *between* air passes: a rocket
  climbing out of the atmosphere coasts to its next entry. In the air it uses RK2 with a step that is ≤ 0.3 / (drag rate), see the bug below.
- The drag is the vessel's own: a CdA(Mach) table measured by `aeroPass` at the angle the vessel is holding to the airflow
  right now (5° bins, drag component only), plus the parachute rules. The path is stored planet-fixed, so it rotates with
  Tellus and ends on the impact marker. The HUD gives time and speed ("safe" under 12 m/s), the map draws the red path and an X,
  and the flight view marks the spot on the ground.

| Case | Error |
|---|---|
| Ballistic Hopper, predicted at apex 121 s out | **0.23 km, 0.1 s**, impact speed 477 vs 477 m/s |
| Unpowered fall onto airless Selene, 332 s | **3 m, 0.01 s** |
| Re-entering pod under its parachute, from 25 km | 1.4 km, 10 s, touchdown 5.3 vs 5.3 m/s |
| Same pod, from 74 km (760 km to go) | ~40 km (5 %): **lift isn't modelled** |

### Autopilot = flight tapes (`tapeNew` / `tapePhys` / `tapeRails` / `tapeStage` / `tapePlay`)
- All flight advancement now goes through `advPhys` (one fixed step) and `advRails(dt, warp)`. A tape records every such
  call plus every control change before it (throttle, keys, SAS on/mode, the maneuver node) and every staging. Physics steps
  are run-length encoded. Played back from the pad, it reproduces the flight **bit for bit**: the planet's spin and Selene's
  position depend only on time, which starts at 0.
- Every flight records from launch. **"Save as autopilot"** stores the tape in browser storage, keyed by the exact design
  and a sim version (`TAPE_V`, since a tape only replays on the sim that made it). On the pad, a matching design offers **▶ Autopilot**.
  Warp sets how many steps per frame it plays, any control key takes over mid-tape (and recording continues from there), and
  the tape running out hands control back.
- Measured: a hand-flown Orbiter flight to orbit (W tap, prograde hold, staging, warped rails coasts, circularization) is
  **31 ops / 1 KB for 248 s**, and replays bit-identically in chunks of 7 or 1000 steps. In the browser, a 109 s flight recorded through the
  real key handling replays to an identical state.

### What it taught
- **Determinism was already there; the tape just had to capture *everything* that moves time.** That included the rails jumps
  with their exact lengths (frame-rate dependent) and attitude sub-steps during low warp. Recording the calls, not the
  frames, made exact replay fall out with nothing to tune.
- **Bug: the predictor's explicit integrator rang under the main chute.** 600 m² of chute at 175 m/s is a drag rate of
  ~35 /s, and a 2 s step reversed the velocity every step, so the point mass bounced between 3 and 4 km for 17 000 s. Limiting the
  step to 0.3 / (drag rate) fixed it. It's the same stiffness the physics step guards against with its drag clamp.
- **Bug: the predictor gave up on rockets still climbing out of the air.** It now coasts the vacuum arc.
- **A capsule trimmed at 165° flies as a weak lifting body.** Using the true trim angle for drag didn't help, and the residual
  hypersonic error is lift. Modelling it needs the lift direction, which depends on roll: a later refinement.
- **Two test-harness slips worth remembering:** a loop that stopped on `landed` never started for a rocket that begins landed,
  and a "touchdown speed" read *after* landing is 0.


## v1.9 — a populated world: cities, drop zones, headlines (2026-10-06)

First slice of the "program with consequence" direction (see the design section below). The tone is deliberately left open,
for gameplay to decide; the headline ticker carries a light voice that can be turned up or down without touching systems.

### How it works
- **Land mask on the CPU.** A float32 port of the planet shader's continents (`h3`/`vn`/`fbm` with `Math.fround` at each step),
  so the CPU and GPU agree on coastlines. Cities are only placed where `landValue ≥ 0.58` (the coast is 0.52), a margin wide
  enough that float differences can't put one at sea.
- **27 cities**, deterministic from a seed: inland, ≥ 160 km from the pad, ≥ 260 km apart, 87k–1.3M people, with radius
  ∝ √population and syllable names. They are data in the SIM block, so the tests can see them.
- **Rendering in three tiers, all cheap:**
  - A 1024×512 equirectangular texture (r = built-up, g = lights) read once per planet pixel: urban colour by day, warm lights
    on the night side.
  - Up close, a 90 m street grid comes from the same texture, and at night the lights gather onto the streets.
  - Within 60 km of the camera, each city gets one merged mesh of 160–900 boxes in its tangent plane (dropped by the curvature,
    taller toward the centre), built on first approach and cached, plus a faint additive "windows" pass at night.
- **Drop zones.** Every dropped stage gets a predicted landing at separation (`debrisImpact`, the same `fall()` integrator as the
  vessel's predictor, refactored out). The landing is settled when its time comes, even though the debris left the simulation
  long before, and reported as a city hit, near a city, open land or at sea (`dropVerdict`).
- **Range safety.** While climbing under power, the instantaneous impact point is checked against the cities. Over or near one, you get a
  warning, a HUD flag and a headline.
- **Headlines.** A three-line news ticker (`HOOK.news`).

### Measurements
| What | Number |
|---|---|
| City generation (plus the SIM load) | 34 ms, once |
| Dropped-stage landing, predicted at separation vs flown independently | **0–50 m**, 0.0–0.1 s (Orbiter, Heavy, Asparagus) |
| Standard eastward launches | every stage lands 1–600 km downrange on open land or at sea, 140–250 km from the nearest city |
| GPU at 1080p, pad view, same session | v1.8 6.4–6.6 ms · v1.9 5.5–6.2 ms (no measurable cost); over a city 5.2 ms by day, 4.3 ms by night |

### What it taught
- **Drop zones only matter if you aim at a city.** The default eastward launch is already safe, which is right: the
  mechanic should bite when you choose a different azimuth or a different staging, not on every flight.
- **The mesh shader has no tone map**, so mid-grey buildings came out black against the gamma-corrected ground. Lighter concrete fixed it.
  Also, an additive pass over *the same geometry* needs `LEQUAL`, or every fragment fails the depth test and the pass silently does nothing.
- **A smooth light texture is a floodlight up close.** It looks right from orbit and wrong at 300 m, so near the camera the lights move onto the streets.
- **Measuring a regression needs the baseline in the same session.** "3.9 ms → 7.6 ms" looked like a regression, but the committed page
  measured 6.4–6.6 ms on the same run. The GPU's power state had changed between sessions.
- **Test-harness slips, again:** stepping only `physStep` froze the debris mid-air, and the "drop" test that never circularized
  produced no drops at all, just a nose-first re-entry. Each bad harness looked like a game bug for a moment.

## v1.10 — graphics pass (2026-10-06)

Everything was a placeholder: flat-shaded parts, a smooth green/brown ball, a cone for a plume. One pass over each, judged
with three fixed reference scenes (`views.js`: `refView(1)` the Orbiter on the pad, `2` the Lunar rocket at 3 km, `3` the upper
stage in a 200 km orbit; each rebuilds the same scene deterministically, so screenshots from different versions line up).

- **Parts:** a material channel in the vertex format (paint, metal, matte, glass). The mesh shader has normalized Blinn–Phong
  plus Fresnel and an environment gradient. Light comes from `lightEnv`: the sun colour through the real atmosphere (reddens
  at low sun), plus hemispheric sky and ground ambient. Sky and meshes share one ACES tone curve. Before this, white paint
  clipped flat and grey concrete rendered black.
- **Ground shadow:** the ship is flattened onto the ground along the sun, stencil-masked so the shadow doesn't double-darken.
  It appears below 150 m.
- **Ground:** the coastline is unchanged (the CPU land mask and the cities depend on it). Land is now biomes from temperature
  and moisture (grass, forest, desert, tundra, rock, snow, beaches, a turquoise shelf). Ridged mountains shade via a relief
  normal only, so physics still sees a sphere. Field patchwork appears near the camera.
- **Clouds:** a shell 3 km up. Domain-warped and stretched coverage, drifting with the planet, with shadows cast onto the
  ground. Up close, a detail term carves the deck into lumps and holes.
- **Plume:** its own shader with a white-hot core cooling to orange, shock diamonds that fade with altitude, and flicker. It
  widens and goes pale blue in vacuum.
- **Smoke:** camera-facing puffs anchored to the planet, spaced by distance flown (not time) so the trail doesn't bead.
  Puffs have lumpy edges, wind drift, and thin out with air density. Visual only: not in the sim or the tapes.

Cost (same-session A/B against v1.9 at 1024×768, RTX 3050, `render()`+`finish`): pad ≈ same, orbit 1.4 vs 1.4–1.5 ms,
ascent 2.2 vs 1.55 ms. The first version of the smoke cost **3.3 ms of CPU** per frame for ~950 puffs: vector temporaries
per puff and per corner. Rewritten into reused typed arrays, it costs about 0.3 ms. `test.mjs` still 44/44 (the pass is
render-only).

Still rough: the edge-on cloud shell draws a thin bright line at the horizon. The ground right around the pad is plain. Parts
have no panel seams, soot or AO. Big smoke puffs read as blobs at the plume tip.

## v1.11 — graphics rough spots (2026-10-07)

- **Cloud rim at the horizon:** where the shell is seen edge-on, one pixel covers kilometres of cloud, and the hard
  coverage threshold aliased into a bright line. Now coverage is filtered by the pixel's footprint on the shell: far
  and grazing samples widen the threshold toward the mean. Opacity also fades as the view ray goes tangent. The rim is
  now a soft haze band.
- **Smoke "blobs" were a contrast problem, not a spacing one.** Puffs were ~8 m apart and ~18 m wide, so the column
  was solid. But flat-shaded white puffs vanish against the white deck, and only the denser low puffs showed, as
  blobs. Each puff is now lit as a lumpy sphere (sun direction in the quad's frame), so the column has a lit side and a
  shadow side.
- **The streaks on the ground near the pad were coordinates, not noise.** Fields and city streets used `loc.xz`, and at
  the pad the planet-fixed x axis points straight up. Ground patterns now use longitude/latitude in metres. The finest
  detail octaves are also filtered by footprint.
- **Launch complex:** painted into the ground shader in the pad's own frame, exact because the pad is passed in the same
  re-centred frame as `loc`. A concrete apron with 6 m expansion joints and stains, slabs under the tanks, soot around
  the pad, and an access road with a centre dash and gravel shoulders. Scrub bushes everywhere on land, clumped by
  low-frequency noise and sparser in deserts.
- **Hull detail:** ship and debris only (`uSeam`). Weld rings every 1.25 m on the sides, a slightly different shade per
  ring of panels, faint vertical grime. Filtered with `fwidth`, so they fade out with distance instead of shimmering.

Cost: same-run A/B against v1.10 at 1280 px wide (flight mode): pad 1.4, ascent 1.9, orbit 1.4 ms on both, within
noise. (In editor mode `render()` isn't the drawing path, so the pad must be timed in flight.) `test.mjs` 44/44.

Still open: no soot on the parts themselves (the shader doesn't know where engines are); the vertical grime is laid
around the stack axis, so it's slightly off on side boosters; no ambient occlusion at part joints.

## Part visuals — early-era hardware look (2026-10-07, visuals session, branch `visuals`)

Direction agreed with Caio: **early-era realism**, 1950s–60s hardware to match Epochs 1–2. Later eras can shift the palette.
Everything is procedural in the mesh shader, with no image textures.

### How it works
- **Each part has its own surface frame.** The vertex grew from 10 to 16 floats (`VX=16`): turns around the part's *own*
  axis, height above the part's bottom, the part's nominal radius and height, the detail kind (`KIND`) and the part index.
  `partShape` sets `PK` while a part is built, and `lathe`/`box`/`fin` stamp it into every vertex (`pv`). Scaled 2.5 m parts
  scale the height/radius entries along with the positions, so detail sizes follow the part (`sc = R/0.625`). Side boosters
  get patterns centred on their own axis, which fixes v1.11's off-axis grime. `builder.js` steps by `VX` and only touches
  entries 6–9, so it needed no change.
- **One detail branch per kind in `MESH_FS`,** gated on `uSeam` (ship, debris, the builder's solid ghost). It uses shared
  footprint-filtered helpers (`lin`, `sqw`, `band`, `dots`), so every line, checker and rivet fades to its mean instead of
  shimmering. Footprints are taken once, before the branches. Bump detail tilts the object-space normal along the
  around-axis tangent `T`. `uM` is now read in the fragment shader as well.
- **What each part looks like:**
  - tanks: Saturn/V-2 roll-pattern checker bands top and bottom when taller than 3 m; two opposite black stripes on 1.5–3 m
    tanks; the old orange mid-band is gone. Weld rings, one longitudinal seam, and rivets on the end flanges.
  - engines: the profile is split at the throat into bell and mount. The bell has regen tubes (count fixed by exit radius,
    so they converge toward the throat), heat tint (straw → blue → violet toward the throat), a stiffener at the lip and a
    sooted interior. The interior glows by throttle (`uHot[part index]`, set for active engines each frame). Engines of
    200 kN and up carry a turbopump with an exhaust duct, plus a gas-generator can.
  - capsule: dark corrugated shingles (Mercury), shingle rows with rivets, a framed trapezoid window drawn on the surface
    (replaces the glass puck), a hatch outline.
  - nose cone: fairing split lines with rivets, a scorched tip.
  - decoupler: hazard band, ribbed skirt, separation groove with bolts. The interstage shell has stringers and vent ports.
  - fins: now swept and tapered (`fin()`), white and black alternating, with a bare-metal leading edge.
  - instruments: crinkled gold foil.
  - biocapsule: a porthole and a hatch seam.
  - mass simulator: bolted steel plates (it was yellow like a decoupler).
  - parachute: canister straps and canvas weave.
  - heat shield: ablator honeycomb.
  - adapter: black roll quadrants.
  - radial decoupler: chevrons.
  - reinforcement collars: bolt rows.
- **New reference views in `views.js`:** `refView(4–9)` are part close-ups in the editor (Kestrel/fins, pod, adapter +
  interstage, instruments, Lunar t8, heat shield). `refView(10)` is the Sounding rocket firing, seen from below.
  `refView(1)` now resets `cam.edY`, which the close-ups leave set.

### Measurements
GPU timer queries (`gpuMs`, `RS` pinned to 1), 1280×800 headless Chrome on the RTX 3050. Two alternating rounds against a
`main` snapshot (`34a2317`), three 1.2 s samples per view:

| view | main | visuals |
|---|---|---|
| 4 Kestrel close-up | 3.0–3.4 ms | 2.8–3.0 ms |
| 5 pod close-up | 2.9–3.3 | 2.9–3.7 |
| 2 ascent | 2.2–2.6 | 2.2–2.7 |
| 10 engine from below | 1.2–1.6 | 1.2–1.7 |

The two are the same within noise. The per-part branches are cheap next to the sky and ground shaders.
`test.mjs`: all passed (the pass is render-only).

### What went wrong on the way
- **`render()` + `gl.finish()` timing is meaningless under ANGLE/D3D11.** It reported 0.1–0.2 ms for frames that the timer
  queries put at about 3 ms, so `finish` doesn't wait there. Use `gpuMs`.
- **The first gold foil read as camouflage.** Coarse normal noise on a metal flips its reflection between the sky colour
  and the ground colour (a hard `smoothstep`) in large patches. Fine, shallow crinkles (≈2 cm, ±0.75 tilt) read as foil.
  Albedo noise was the wrong lever.
- **The bell-interior glow is almost never visible.** The plume covers the bell from below, and from the side you see the
  outside of the bell. It costs nothing, so it stays. The version you would actually see is a radiatively cooled nozzle
  extension glowing on vacuum engines (the Petrel), on the *outside* of the bell (open thread).

### Screenshot pipeline (CLI, no app needed)
Headless Chrome on the real GPU (`--use-angle=d3d11`), driven over CDP by a ~30-line Node script (Node 24 has a built-in
WebSocket): navigate, inject `views.js`, `Runtime.evaluate("refView(n)")`, `Page.captureScreenshot`. Claude reads the PNGs
directly. It is `shot.mjs` in this folder (usage in its header).

### Still open (visuals)
- ~~Petrel nozzle extension glowing~~: done ("Flight marks").
- ~~Soot and scorch that build up~~: done, see "Flight marks" below.
  (skin temperatures already exist in the sim).
- Ambient occlusion where parts meet. LOX frost on cryogenic tanks while on the pad.
- Paint schemes per design or era (agency white, company livery), from the same roll-pattern machinery.
- Lettering and flags on tanks: needs a glyph atlas or SDF; skipped for now.

### Parts added after the texture pass (same day)
An audit of `PARTS` against `partBody` and `KIND`: no part falls back to an undetailed shape. Engines carry no `KIND` on
purpose (`engine()` sets bell/mount). Three parts other sessions added after slice 1 had only been mapped onto existing
detail, and got a design pass:
- **Imaging camera:** a bare-aluminium bay, a black optical port, and a lens barrel looking *out* of the side (`tube` along +z).
  The old "lens" was a vertical disc stuck to the hull. A film-return hatch is on the far side.
- **Antenna:** a parabolic dish (focal length 0.15 m) on a mast, its feed horn held at the focus by three struts, two whip antennas.
- **Radial fin:** alternates black/white by part index like the fin ring, with a root bracket on the hull.
- **Docking port, RCS quad, gas bottle** (arrived during this pass): a capture ring with a probe, guide vanes and latches;
  four little heat-tinted bells on an outrigger, on the same thrust axes the physics uses (`RCS_OFF`); a painted bottle
  with a service band, straps, valve and a feed line. `port` now takes the bolted-ring detail (`KIND` 7).
- **Claw:** a drive housing with a hazard band, a turntable and contact plate, three jointed fingers with hinge knuckles,
  hydraulic rams and padded tips, all inside the original envelope.
- **Probe core:** a guidance ring (Agena/Ranger style): foil between bolted rings (`KIND` 7, so the foil crinkles), four
  equipment boxes (two with thermal louvers), a sun sensor, a status lamp, two whips angled clear of whatever sits above.
Re-run the audit when parts are added: list the `PARTS` keys and `big()` bases, and check each against the `case` labels in
`partBody` (tanks use the default) and its `kind` against `KIND`.

## Flight marks — what a flight leaves on the hardware (2026-10-07, visuals session)

Slice 2 of the visuals work, agreed with Caio: the rocket no longer looks factory-new forever. It is render-only. The sim
never reads marks; they live in a `WeakMap` keyed by part object (`MARKS`), so they ride along onto debris and landed
stages, and a new flight starts clean.

### How it works
- **`marksTick()`** runs once per `render()`. Its step is the sim-time delta, capped at 5 s, so warp is roughly right.
  - **Soot:** a burning engine, and the base of the parts up to 3 m above it on its stack line. The rate is ×(1 + 2·(1 −
    p/p₀)) because the plume balloons at altitude and washes back over the base.
  - **Char:** maps the peak skin temperature `p.T` onto 480 K → the part's `Tmax`, so 1 means about to burn up. Its
    direction is the heat-weighted airflow in the ship frame (`qrot(qconj(q), v − v_surface)`). A heat shield blackens from
    ~420 K and also with the ablator it has used.
  - **Frost:** set to 1 on fuelled tanks while landed and before first liftoff (`S.mkLift`). It sheds at
    1/45 s⁻¹ + speed/6000.
  - **Glow:** vacuum engines only (`ispA < ½·ispV`, i.e. the Petrel). It follows the throttle with a 6 s heating and
    12 s cooling time constant.
- **`setMarks(u, parts)`** packs the marks into `uMk[96]` (soot, frost, fuel level, glow) and `uCh[96]` (windward direction,
  char), indexed by part index. It is called for the ship, then per debris, then with `[]` so the editor and builder
  ghosts draw clean. This replaced v-slice-1's `uHot` (the inner-bell glow was invisible under the plume anyway).
- **Shader:**
  - soot climbs streakily from each part's base (engines all over);
  - char first scorches paint yellow-brown, then blackens it, on the windward side, streaked along the flow;
  - frost lies only below each tank's fuel line, in patches that thin as it sheds;
  - the vacuum nozzle extension glows dull red to orange from the exit up.
- **Reference views:** `refView(11)` frost on the pad, `12` soot at 70 s, `13` a biocapsule after an entry from orbit,
  `14` the Petrel 12 s into an orbital burn. The sim loops call `marksTick()` every 0.25–0.5 s, because one render only
  takes up to 5 s of marks.

### What went wrong on the way (worth knowing)
- **"Black" is not black under this light.** The first soot (mix 92 % toward albedo 0.018) didn't show at all. A red test
  colour proved the branch ran: red appeared on the black paint, while white areas stayed white. The sun term is strong
  enough that 8 % of white paint plus 0.018 still lands in the tone curve's shoulder as light grey. Soot and char now go
  to albedo ≈ 0.004 at up to 98.5 % coverage, blacker than black paint. Generalises: in this renderer, judge darkening
  effects on *white* paint.
- **Caps break anything keyed to the around-axis coordinate.** A lathe cap's triangles each span a different angle
  range, so `fwidth(u)` and arc-length noise change per triangle, and the shield face rendered as a pinwheel of wedges.
  Caps now use the planar footprint `fwidth(vO.xz)` and planar noise. This also fixes slice 1's honeycomb filtering on
  the shield face.
- **Integrated char saturates.** Accumulating char over time blackened every part within ~30 s of entry heating. Mapping
  the *peak* temperature against each part's limit reads right: the biocapsule at 853 / 1250 K is scorched, not burnt.
- **Tellus is small.** The first entry test used 7.6 km/s and sailed off to 4,700 km. Use `√(μ/r)`.
- **An unbounded sim loop in a reference view hangs headless Chrome silently.** Bound every `while` (time, `!S.alive`).

### Measurements
GPU timer, alternating against `main` (two rounds): view 4 close-up 2.7–3.8 vs 2.8–3.3 ms, view 2 ascent 2.4–3.3 vs
2.2–3.2 ms. Within the run-to-run spread, at most ≈0.2 ms. `test.mjs` all passed (render-only).

### Still open
- Char on the dark capsule shingles is nearly invisible (it's black on black). A lighter heat-tint or a sheen loss could
  carry it.
- Debris doesn't heat in the sim, so stages falling back don't char. Their marks only cool and shed.
- No soot on the *side* of a core next to a booster's engine (soot only follows the stack line).

## The launch complex (2026-10-07, visuals session)

> Axes: the pad frame is `siteFrame` (x east, y up, **z south**). Early drafts of this section had north and south swapped.

Slice 3 of the visuals work. Next to the detailed rocket, the old pad (a red pole, three white cylinders, a drum) read as
a placeholder. Only the **contents** of the `PAD` mesh changed. Where it is drawn, its height (`siteH`) and the
ground-shader apron (`padGround`) belong to the terrain session and were not touched. Everything sits at or above y = 0
in the pad's frame (x east, y up, z south), so the rocket still stands at the origin on the ground the physics knows.
Each building stands on a concrete slab that `padGround` already paints.

### What's there (early-era Cape style)
- **Launch table:** the concrete disc, a dark steel flame grate under the engines with eight radial bars, four hold-down
  posts at r 3.4 m.
- **Flame channel:** low concrete walls on a sooted floor running south. The ground can't be dug (it is raymarched in the
  sky shader), so the trench is suggested from above ground.
- **Umbilical tower** east of the rocket: an orange lattice, 3 m square and 32 m tall (`lattice()`: corner posts, a girder
  ring every ~2.5 m, zig-zag bracing). It has an elevator shaft, a cap platform, a hammerhead jib with a hook line, a
  lightning mast, and three swing arms retracted along the west face with hoses hanging.
- **Propellant farm** on its slab: a LOX sphere on six legs, a horizontal RP-1 tank on concrete saddles, pipes to the pad.
- **Deluge water tower,** a **domed concrete blockhouse** with a band of periscope slots and an antenna mast (with a cable
  run to the pad), a **compressor building**, and four **floodlight poles** around the apron.
- New helpers `tube(A, B, r)` (a cylinder between two points) and `lattice()`. About 9,800 vertices in all, a static mesh.
- `refView(15)` shows the whole complex from the north-west, `16` the tower and table. In the editor the rocket floats:
  the builder lifts the ship while you build. `refView(11)` shows it standing on the grate in flight.

### Revised layout (same day, after Caio's review)
Caio wasn't sold on the buildings, and the tower was too tall for the rocket. Both changed:
- **The tower is sized to the rocket on the pad:** about 3 m above its top, in whole 2.5 m bays, 12.5–60 m (Orbiter
  17.5 m, Big Lunar 35 m, Sounding 12.5 m). `padSync()` rebuilds the pad mesh when that changes, in the editor or on the
  pad before liftoff. The `PAD` binding is reassigned, so the terrain-owned draw call stays untouched.
- **Spread out the way real complexes are:**
  - The domed **blockhouse** moved up-range, about 230 m west, onto its own mesh slab, with a spur road down to the
    access road and a concrete cable trench to the pad.
  - The **mobile service structure** (four lattice columns on rail trucks, work decks, roof, bridge crane) is rolled back
    80 m north on twin rails that run to the launch table. Its height is the tower's + 6 m.
  - **High-pressure gas bottle racks** sit on the old blockhouse slab.
  - A **ground deluge tank** with a pump house replaces the elevated water tower.
  - **Two lightning masts** with a catenary wire.
  - **Five camera bunkers** at about 90 m and **two camera towers**.
- New helper `strip()` draws flat runs on the ground: roads, rail beds, trenches. The mesh is now ~26k vertices,
  still one static draw. `refView(17)` shows the whole site from high up.
- **The pad holds the rocket.** In the editor the builder hangs the ship 3 m up (`LIFT` in `builder.js`, so parts can go under
  its bottom), and it looked like it was hovering. While a rocket stands on the pad or is being built, `padRig()` now gives
  the pad four hold-down arms from the table posts to clamps above the engines (in the editor they become a launch stool),
  and swing arms reaching from the tower to the widest thing at each arm's height, boosters included. At liftoff the arms
  fold back and the hold-downs go (a pad rebuild keyed on the rig). The builder's code is untouched.
- **Moving parts and night lights.** The swing arms, the hold-downs and the service gantry are now separate meshes in their own frames (`buildRig`), drawn each frame by `drawPadRig` with a matrix:
  - **Gantry:** parked in the editor. A flight that starts on the pad starts with it in service position around the rocket (the open front faces it; its rails moved out to ±10.5 m to clear the tower), and it rolls 80 m back over 14 s.
  - **At liftoff (`S.mkLiftT`):** the arms swing back to the tower face, top first, 1.5 s each, 0.25 s apart, and the hold-downs tip out 0.9 rad in 0.6 s.
  - **Floodlights,** from dusk (sun 4° above the pad horizon) to dawn: four warm point lights in the mesh shader (`uFl`/`uFlI`) light the rocket, tower and buildings; the lamp faces and ground pools are additive discs in the glow pass (`PAD_GLOW`), because the ground belongs to the sky shader.
  - **Hooks in `render()`:** three one-line calls (`padLights`, `drawPadRig`, `drawPadGlow`). The pad's own draw call (terrain's) is unchanged, and the rig uses the same frame (`padPF` reads `WORLD.siteH`).
  - **Pipes:** those crossing the rails became flush covered trenches, so the gantry's trucks can roll over them.
  - `refView(18)` is the gantry in service at t = 0, `19` the same at night.
- **Bare metal reads blue under this sky.** Steel props (bottle racks, decks) reflected the sky gradient and looked
  painted blue. Use painted (non-metal) colours for big plain steel surfaces, and keep metal for thin members.

### Still open
- A real trench and flame bucket would need a cut in the ground (terrain's shader).
- Wide side-booster rockets: the hold-downs at r 3.4 m can poke through boosters of a 2.5 m core. **Fixed 2026-10-08:** § "The hold-downs follow the rocket".

## Engine plumes — a raymarched volume with propellant profiles (2026-10-07, plumes session, branch `plumes`)

Before this, every engine had the same additive cone: a hard-edged pale shape that only changed size. In vacuum it went
almost black and hid the stars. The KSP mod Waterfall (1.3 M installs) is the reference. **What we borrowed from it:**
templates per propellant, not per engine; layered parts of a plume (core, diamonds, mantle, glow); parameters driven by
throttle and air pressure; and deforming the proxy mesh in the vertex shader. **What we did differently:** Waterfall
stacks mesh shells with scrolling noise textures because a Unity mod can't do more. We own the shader, so the plume is
a **volume raymarched inside one proxy mesh per engine** (32 steps). It reads as a body of gas from any angle, with no
shell edges at grazing views.

### The model (`PLUME_VS`/`PLUME_FS`, `plumeShape`, `PROPS`, `PFX`)
- **Shape from the pressure ratio** n = pe/pa (nozzle exit pressure over ambient, both in atm). Over-expanded (n < 1):
  the jet pinches to √n of the exit radius within 1.5 radii. Spread angle: tan θ = 0.03 + 0.52·smoothstep(0, 2.5,
  log₁₀ n). Near-straight at sea level, about 29° from n ≈ 300 up, plus a little turbulent widening in air. Length
  re·(10 + 12·throttle)·(1 + 1.4·(1 − pa)).
- **Thinning:** gas density goes as (re/rb)², and the line of sight through it grows as rb, so emission falls as
  (re/rb)^1.3. That one term is why a vacuum plume is wide and faint and a sea-level one is tight and bright.
  (re/rb)² dimmed the 45 km plume to nothing.
- **Shock diamonds** every Lc = 2.4·re·√n, soft Gaussian cells that fade along the train. Visible only for pa in
  0.02–0.25 and n < 8: they stretch out and vanish with altitude, as on real ascents.
- **Layers:** a white-hot core over the potential-core length (3.5–6 re); an afterburning mantle (fuel-rich exhaust
  burning in air, so it scales with air density); a gas glow; and soot that *absorbs*.
- **Opacity:** output is premultiplied (`ONE, ONE_MINUS_SRC_ALPHA`), so a plume can occlude. A thick region shows its
  colour as emission over opacity. Kerolox is opaque (op 1.2), alcohol translucent (0.8), hypergolic faint (0.25),
  hydrolox nearly clear (0.03).
- **Propellant profiles (`PROPS`)** with an engine table (`PFX`): Kestrel, Condor and Albatross are kerolox at pe
  0.7–0.8 atm; Petrel is kerolox at pe 0.025 (vacuum); Sparrow is alcohol/LOX (V-2-like); Wren is hypergolic at pe 0.12.
  Hydrolox is defined but no engine uses it yet. An engine not in the table defaults to kerolox, with a vacuum nozzle if
  its sea-level Isp is under half its vacuum Isp.
- **Spool:** a render-side `SPOOL` WeakMap lags each plume behind the throttle by ~0.12 s, so ignition grows instead
  of popping. Flicker is two sines on the intensity, phased per engine.
- Smoke puffs are now born at 0.7 of the plume length (`plumeShape`), so they leave from where the flame fades.

### What it took (and what failed)
- **First pass: everything saturated to white.** The gains were ~5× too high; `1 − exp(−C)` clips every channel.
- **Purely additive turned green over grass.** The ground showed through a faint flame. A sooty kerolox flame is
  close to opaque in reality, so opacity was added.
- **Then the kerolox plume read as brown smoke.** The outer gas absorbed more than it emitted, and a thick region's
  colour is its emission/opacity ratio. Fix: only the core and mantle carry opacity.
- **Gamma 2.2 greyed the faint outer gas** (a peach tint on a blue sky reads grey). Gamma 1.5 plus a more saturated
  glow colour kept it orange.
- **Culling:** the lathe's outward faces wind so that `cullFace(FRONT)` keeps the faces nearest the eye. With the
  camera inside the bounds it switches to the far faces and marches from the eye.
- **Measuring against the wrong tree.** The first A/B said +3 to +12 ms. The "main" server on 8778 was another
  process's tree, and 127.0.0.1:8777 had a second listener too. Use explicit `127.0.0.1` URLs on ports you have
  checked with `netstat` (LESSONS candidate).

### Cost
Same-run A/B against a `main` snapshot (`d803a54`): GPU timer queries, `RS` pinned to 1, 1280×800 headless Chrome, two
rounds of three 1.2 s samples.

| view | main | plumes |
|---|---|---|
| 2 ascent (Lunar, 3 km) | 14.1–14.5 ms | 14.4–14.8 |
| 10 Sparrow from below | 5.4–5.9 | 5.9–6.3 |
| 30 (was 17) Orbiter at the pad | 17.8–19.0 | 18.1–19.4 |
| 32 (was 19) Albatross at 45 km | 2.6–3.8 | 3.3–4.0 |
| 33 (was 20) Petrel in vacuum (fills the screen) | 0.8–1.0 | 1.7–2.0 |
| 36 (was 23) Kestrel at 1 km | 10.4–10.8 | 9.9–10.2 |

The first version cost far more. Three changes fixed it:
- the vertex shader bends the proxy lathe to 1.9·rb(s), so pixels outside the plume never march (Waterfall's trick);
- samples outside that radius are skipped before any noise;
- turbulence is read from a 32³ R8 noise texture (two fetches instead of 16 hashes). Marching stops once the ray is opaque.

### Reference views
`refView(30)` Orbiter at the pad, `31` Albatross at 20 km, `32` at 45 km, `33` Petrel in vacuum, `34` Sparrow at 1 km,
`35` Wren in vacuum, `36` Kestrel at 1 km. They teleport the ship (pointing up, climbing), stage and burn 1.5 s.
(Numbered from 30 because `main` took 17 for the launch site meanwhile.) `refView` now funds the program up to 1e6 M
first: since the budget gate, a fresh page refused the Lunar launch and views 2 and 31–35 silently stayed in the editor.

### Still open
- The plume goes into the pad instead of spreading over the deflector. Ground impingement would need the pad or ground
  height in the shader.
- No shutdown tail-off: a plume disappears with `activeEngines`. Ignition is a fast grow, with no start-up flash.
- Plumes don't light anything: no glow on the pad, the smoke or the hull at night.
- At altitude, the plume should wash back over the base (recirculation). Soot marks model that; the plume doesn't show it.
- The Sparrow's alcohol plume still reads whitish-blue against the sea. Real V-2 footage is more yellow.
- RCS puffs could reuse this volume with a small re.

## Re-entry plasma — a raymarched shock layer and wake (2026-10-07, aerofx session, branch `aerofx`)

Before this, re-entry showed one additive half-sphere at the ship's leading end. The heating physics (Sutton–Graves
stagnation flux `S.qHeat`, skin temperatures) was detailed, but its visual was not. Now the plasma is a volume raymarched
in a **flow-aligned frame** (y = upstream), reusing the plume's proxy lathe, culling logic and 32³ noise texture.

### The model (`PLASMA_VS`/`PLASMA_FS`, `hullProfile`, the plasma block in `render()`)
- **Heat level** k = log(q/15 kW/m²) / log(160/15), clamped to 0–1.5. 160 kW/m² is the peak of an orbital capsule entry
  (measured: it peaks at 50 km; glow from ~85 km down to ~30 km). A fast "lunar return" (1.3× circular) reaches
  ~440 kW/m², so k ≈ 1.4. Colour runs deep red → orange → pink-white with k. The wake uses k·0.4, so it is redder.
- **Hull:** the ship's real envelope, `hullProfile(S)`: 32 radius stations along its axis from the parts' lathe profiles
  (radial parts count by their offset). The shader's signed distance is the radial gap, corrected for the profile's
  slope near the surface, with flat end caps. The ray stops at the hull.
- **Shock layer:** a thin sheath, standoff D = 0.12·min(ep, 1.2 rb) + 0.06 m. It glows as exp(−(sd/D)^1.4) on faces
  that meet the flow (the normal's upstream component), so a stage flown at an angle lights its windward side.
- **Wake:** from the hull's downstream edge, a ring of streaks (noise in the azimuth and along the flow, scrolling
  downstream) plus a dim core. Width ~0.8 of the cross-flow extent, growing slowly. Length 5–19 extents with k.
- Additive, no opacity. `PLASMA_FX = false` hides it (GPU A/B).

### What it took
- **Even steps band the thin shell.** 40 steps over a ~15 m ray against a 0.15 m layer gave a screen-door pattern over
  the hull. Steps are now sized by the distance to the hull: 0.35·sd + 0.2 D, at least D/4. Ahead of the hull, clear of
  the layer, the march jumps straight to it (≤ 56 steps).
- **A hull cylinder outlines a can that isn't there:** around a conical capsule the glow traced the core radius. Hence
  the real profile.
- **Arcs and a spike:** the capsule's neck steps from 0.42 to 0.30 m within one station, and dividing the radial gap
  by √(1+slope²) (up to 2.7×) made points 2 m out read as 0.6 m away, inside a 4 cm slab across the hull. Edge-on
  that slab is a spike, obliquely it is arcs. Found by a diagnostic render (emission coloured by the shader's own
  distance), after two wrong guesses (step size; the proxy, ruled out by doubling its radius). Fix: the slope
  correction fades out from D to 4D.

### Cost
`PLASMA_FX` on/off in the same page, GPU timer queries, `RS` pinned to 1, 1280×800, RTX 5050 laptop:

| view | on | off |
|---|---|---|
| 40 capsule at 50 km, side | 7.9–8.1 ms | 7.1–7.2 |
| 41 capsule at 50 km, behind (long wake on screen) | 11.0–11.2 | 9.8 |
| 44 stage at 35° AoA | 7.7–7.9 | 6.9–7.0 |
| 45 fast entry at 55 km | 7.6–8.0 | 6.8–6.9 |

### Reference views
`refView(40)` capsule (chute, bio, shield) at 50 km (peak heating), side; `41` same, from behind; `42` at 75 km
(onset); `43` at 35 km (fading); `44` pod, tank and Petrel turned 35° off the flow at 55 km; `45` a fast entry
(1.3× circular, steeper) at 55 km. They fly the entry from 95 km retro, then turn the ship if asked.

### Still open
- Only the active vessel glows. Debris and spent stages entering (and burning up) would need the same per debris body.
- No light cast on the hull from its own plasma, and no change to the hull shader (`MESH_FS` is the visuals session's).
- The views' "retro" capsule leads with its narrow end (SAS hold during the teleport). The glow follows whatever
  leads, but a shield-first view would be the classic shot.
- Transonic vapor cones (next idea).

### Gated by speed, not just heat (2026-10-08, effects beat, QUEUE Q20 / PLAYTEST #17)
The shell used to draw whenever the stagnation flux passed 15 kW/m². Dense air reaches that at about 1 km/s, so the
Heavy's ordinary climb (Mach 3.5, 20 km, 77 kW/m²) wore a glowing shell. Air at that speed is a few hundred kelvin
behind the shock and doesn't glow; the shock layer lights up at orbital-class speeds. `plasmaHeat(b,r,v,q)` (next
to `drawPlasma` in `app/gl.js`) multiplies the flux by a smoothstep in airspeed over 0.85–1.05 × `PLASMA_V`, the
terrain session's blackout threshold (Q17, 2213 m/s), so the Link blackout and the glow agree. The ship and falling
stages both go through it.
- Measured (`refView`): 40 (50 km, 2.6 km/s) 160 kW/m², glow unchanged; 42 (75 km), 44 and 45 unchanged; **43 (35 km,
  1.55 km/s, 90 kW/m²) now has no shell**, just the charred shield (it used to show a faint one). Stage re-entries
  103/104 run at 3.2 km/s: unchanged. Hot ascents peak at 1.7 km/s (Q17's flown check), under the 1.88 km/s fade start.
- test.mjs `aerofx-1`: the fade numbers, and that both draws in `render.js` go through `plasmaHeat`.
- Not changed: char marks, sparks and the smoke trail on falling stages still key on heat alone (ablation is heating).

### The plasma lights the hull; a shield-first view (2026-10-08, effects beat, QUEUE Q63)
`plasmaLight(camW)` (after `boomLight` in `app/gl.js`) makes the shock layer the scene's one point light (`PLT`, the one
the plumes and explosions use, read by `MESH_FS` and the smoke) while it outshines the plumes; an explosion's flash still
wins. No hull-shader change. The light sits in the sheath, 2 D ahead of the leading face, with a core of 1.2× the
cross-flow extent so the sides get a soft wash, and its colour follows the shell's (deep red → orange → pink-white with
k). Brightness `PLASMA_LK`·k²·extent² (capped at 1.5 m), `PLASMA_LK` = 5; `PLASMA_LIGHT = false` for A/B. No ground pool.
- **First try was 8× too bright**: `PLASMA_LK` 40 per metre blew the capsule's white hull out in view 40. The light is
  under a metre from the hull, so the inverse-square term is large; the plume light's scale (K = 110) assumes metres of
  flame between light and hull. Now ~2 per channel at k = 1 for the capsule: a pink wash on a nose-first capsule (40),
  the stage's windward side at 35° (44), the shield face and its rim when shield-first.
- **Shield-first, the back shell stays dark**, as it should: the light is ahead of the shield and faces behind it get
  only the wrap term. There is no shadowing, so a long stage would be lit along its side even where the nose would hide it.
- **New views 46–47**: the capsule turned shield-first at 50 km (`aoa: 'shield'`: whichever end carries the shield goes
  upstream), from the side and from a rear quarter. The old views fly the capsule "retro" but it ends up nose-first
  (Y·v = +0.97): SAS can't hold it against the aero torque.
- **Seen while testing, not fixed:** the entry views spawn a burning parachute as debris (a `chute` piece, boom at
  55 km), so for ~2 s after `refView(40–47)` an explosion's flash owns `PLT` and a smoke cloud hangs above the capsule.
  The ship keeps its own chute. For judging the light, clear `booms` after the view. Not looked into further.
- test.mjs `aerofx-2`.

## Transonic vapor cones (2026-10-07, aerofx session)

Around Mach 1 in humid air, the flow speeds up round each convex corner of the hull, expands and cools, and water
condenses until a shock recompresses it. That's the white collar in max-Q photos. Here it is a lit cloud (alpha
blended, shaded like the smoke) raymarched in the ship's own frame, reusing the plume proxy, the noise texture and the
plasma's `hullProfile`.

- **Where:** `hullShoulders(profile, dir)` walks the 32-station radius profile downstream from the leading end. A
  shoulder is where the radius stops growing after growing ≥ 15 % (the end of a nose cone or a flare), or drops ≥ 10 %
  in one station (a step down). It keeps the three strongest. The Orbiter gets one at the pod's base and two at the
  decoupler/Petrel steps. The Lunar's include the top of the 2.5 m adapter.
- **When:** visibility = smoothstep in Mach 0.84→0.94, fading 1.12→1.28, times humid air below 5 km fading to none at
  15 km. A stand-in for humidity: the world has no humidity field.
- **Shape:** a collar per shoulder, soft at the front (at the shoulder) and sharp at the rear (the shock), whose distance
  aft grows with Mach: zs = r·(1 + 6·(M − 0.86)). The outer radius flares as r·(1.15 + 0.95·√(z/zs)) with noise on the
  edge and the rear line.
- **Light:** brighter on the sun side and toward the sun (forward scattering), the smoke's sun/ambient scaling and the
  same tone curve.
- `VAPOR_FX = false` hides it. Cost: 0.2–0.7 ms while visible (same-page on/off A/B, views 50, 52, 53).
- **First pass too timid:** collars 12 % wider than the hull read as small flaps. Then straight flares read as
  triangles: curved (√) flares and a wider feathered edge fixed it.
- Reference views: `refView(50)` Orbiter at M 0.97, `51` at M 1.08, `52` Lunar at M 1.0, `53` Orbiter close-up from below.

**Still open:** a real humidity field (clouds, coast vs inland); collars on side boosters (the profile only knows the
envelope, so radial stacks' noses don't make their own shoulders); condensation off fin tips at high angle of attack.

### Side boosters make their own collars (2026-10-08, effects beat, QUEUE Q64)
The collars came from one envelope profile of the whole ship, so a booster's nose cone only counted where it stuck out
past everything else. Now `vaporLines(s)` groups the parts that are on by stack line (`p.inst.line`: 0 the core, > 0 a
side stack; surface parts stay with the core, radial decouplers are left out), and `drawVapor` draws one volume per line
on its own axis, with `lineProfile` (radius about that axis) and `hullShoulders` as before. The shader is unchanged.
- Heavy at M 1.0: core shoulders unchanged; each booster gets its nose (station 24 of 31) plus the fins/engine step near
  its base. Big Lunar: the core's 2.5 m adapter shoulder stays; each booster its nose. The Orbiter (one line) gives
  exactly the old shoulders (test.mjs `aerofx-2`, the vapor check).
- A booster's collar is not stopped by the core's hull (each volume only knows its own), so on the inner side it can
  run into the core; the core's mesh still hides what is behind it. It reads fine in views 54–56.
- `VAPOR_SIDE = false`: core only (A/B). Cost (RTX 5050, 1280×800, RS 1, same page on/off, median of 7×15 frames):
  Heavy at M 1.0 (view 54) 6.05 vs 6.06 ms, Big Lunar (55) 6.77 vs 6.51 ms: one more volume per booster, ≤ 0.3 ms.
- New views: `refView(54)` Heavy at M 1.0, `55` Big Lunar, `56` Heavy close-up from below.

## Moving parts: the gimbal, steerable fins, a reaction wheel (2026-10-08, effects beat, QUEUE Q23)

The control session's engine gimbal (`p.gv`) and steerable fin plates (`p.fd`) steered the rocket but never showed: the
ship mesh is built once per design. Now they move in the vertex shader, with no mesh rebuild.
- **`MESH_VS` has a small table** `uMv[48]`: up to 16 moving parts, three vec4s each: (pivot, part index), (mode, axis,
  ring radius), (rotation). `setMoves(u, parts)` fills it from `setMarks`, so every mesh draw that sets marks (the ship,
  fleet, debris, satellites) also sets its moving parts; parts at rest are left out, so most draws send zeros.
  Mode 1: an engine's bell vertices (kind 2) turn about the throat by the quaternion from `tdir` to `tdir + gv`; the throat
  height is read once per engine from its own mesh (`bellThroat`). Canted engines: the pivot is tilted with the mount.
  Mode 2: a fin ring's plates (kind 6 beyond 1.02× the ring radius) turn about their radial axes `FIN4[j]` through
  mid-chord by `fd[j]`. Mode 3: a radial fin, the whole part about its radial axis. Same sign as the sim's plate normal.
- **The plume follows**: `plumeFrame(e)` gives the exhaust's tilt and exit for both the plume draw and `plumeLight`.
  It also fixes canted engines' exit point, which was the untilted one (off by sin(cant)·h, ~0.2 m on a 10° Kestrel).
  Escape-tower nozzles have no `h`: their exit stays at their mount.
- **The reaction wheel** (`rwheel`) had the default drum; now a machined steel housing between bolted flanges, a
  gold-foil band and four motor pods.
- `MOVES_FX = false` freezes bells and plates (A/B). Views: `refView(105)` the Orbiter's Kestrel at its full 5°,
  `106` a steerable fin ring at ±20°, `107` the reaction wheel (all builder close-ups; pass the career gate first).
- **A/B pitfall:** an expression that sets a toggle off, renders, and sets it back on in one go photographs the "on"
  state: the page's own loop redraws before the screenshot. Leave the toggle off until the picture is taken.
- test.mjs `aerofx-2` (moving parts): the exit swings 0.065 m for 5° on a 0.75 m throat height, opposite the thrust's
  tilt; the plume axis follows; the wiring (`uMv`, `setMoves`, `plumeFrame` in both places, the `rwheel` case).

## Legs and power parts get their looks (2026-10-09, effects beat for parts & pad, QUEUE Q97)

The vehicle session's landing leg (v1.61) and power parts (Q34a) were placeholders: a strut and a box, a dark plate, and
the battery and computer fell through to the default 1.25 m drum. `partBody` now draws each:
- **Landing leg.** Stowed: the shock strut along the skin (steel cylinder, chrome piston), the brace beside it, the
  footpad folded flat at the bottom, hinge and lower-mount fittings. Deployed: hinge → cylinder → piston → ball joint
  → dished footpad, the foot exactly at the sim's `legFoot` (reach out, drop below the leg's bottom), and a brace from
  the lower mount to the strut's middle. The pose changes with the mesh rebuild on Y (no swing animation yet).
- **Solar wing.** Stowed: a folded pack of four panels under a cover. Deployed: boom and yoke, four framed panels of
  cells, edge spars; the wing's plane still holds the outward direction and y, as `power.js` assumes.
- **Body cells.** 4×4 cell tiles on a steel backing that follow a 0.625 m hull's curve (on a 2.5 m hull they sit a
  centimetre proud at the edges).
- **Battery:** a ribbed ring of cells, an orange band, two terminal boxes. **Computer:** a dark equipment ring with six
  gold-foil and black avionics boxes and a cable run.
- Views `refView(108)`–`(111)`: a lander's legs stowed and deployed, a satellite stowed and with its wings out.
- test.mjs `aerofx-3` (part looks). Not yet: legs swinging down over a second, wings unfolding.

## Fill light on airless bodies (2026-10-09, effects beat, QUEUE Q116, PLAYTEST #32)

`lightEnv(p)` only knew Tellus's air: on Selene its "height" is the distance from Tellus, so sky and ground light were
zero and a lander with the sun behind it was pure black against bright regolith. `airlessFill(p)` (checked first) finds
an airless body within 4 radii and returns its own lighting: the sun unfiltered, `up` = that body's local up, and a
ground term = 5 · albedo (0.12 unless the body says otherwise) · sun elevation, fading over 0.6 R of height; a token sky.
- Measured: on Selene's day side with the sun 20° up the ground term is 0.195 (Tellus's daytime ground is ~0.18); 0 at
  night; 0.108 one radius up. Earthshine (~1e-4 of the sun) is left out.
- `refView(113)` (back-lit, shadow toward the camera): the tank reads grey, the dark pod stays dark; `FILL_FX = false`
  gives the old black silhouette. `112` is the same lander from the sunny side.

## Bay doors and char on dark shingles (2026-10-09, effects beat for parts & pad, QUEUE Q24)

- **Bay doors mid-swing** read as paper-thin white eggshells: both faces were the paint colour and nothing held them.
  `bayDoor` now gives the inside grey insulation and puts three hinge brackets on each rim, so a half-open door
  reads as a door.
- **Char on the capsule's black shingles** was invisible: char darkens toward black, and black can't get darker. On
  dark paint (luma under ~0.1, `dk`) char now heat-tints instead, from bronze to blue-grey by noise, streaked like
  the rest of the char (up to 80 %, less where it is fully burnt). Mercury's René 41 shingles came back looking like
  this. The first try (tint at ~0.3 albedo) turned the whole pod pale bronze; the tint is now ~0.1.
- Seen in the builder (bay at 45 % open; pod char 0 / 0.5 / 1). test.mjs `aerofx-3`.

## Reference views swept (2026-10-09, effects beat; ROADMAP look & sound evergreen)

All of `refView(1..113)` rendered in one page per 20–25 views (`refView` from a fresh page past the career gate):
74 views exist, none throws or hangs. One thing looked wrong: since the Debrief screen, a view that leaves a flight
for the editor passes through Debrief, and its panel covered the close-ups and complex views (4–9, 15–17) and
anything after a flight. `bare()` in `views.js` now hides `#deb` too (the robot playtester's shots go through it).
Re-checked 4, 15, 17. Contact sheets were looked over; the HUD views (94–96) show the HUD on purpose.
Known, not fixed: the entry views fly nose-first (SAS "retro" loses to the aero torque) and burn the capsule's
parachute off at ~55 km (a boom and smoke in 40–47); the shield-first views 46–47 turn the capsule afterwards.

## Hardware schools in the game: the plan (2026-10-09, effects beat, QUEUE Q102; mock-ups Q89, `mockups/schools/`)

POWERS.md: a school may change a part's surface detail, finish, paint, bell detail, fin edges, decals and roundel, never
its outline or anything in `PARTS`. Each part draws in its **maker's** school (decision 2), the paint ties a mixed
rocket together, and the player's presets stay the same designs in every school. Cape is today's look. Built in steps,
each one merged and tested on its own:

1. **Which school.** `schoolOf(power)` from POWERS.md's affinity weights (the highest, seeded per world so two Cape
   powers stay Cape), and `partSchool(p)`: the maker's school (a part bought abroad, `sourceOf`, is the seller's), else
   the program's. A tester toggle forces one school for screenshots.
2. **Carry it in the mesh, not in uniforms.** `MESH_FS` already spends 192 of ANGLE's ~221 fragment vectors on
   per-part marks, so a per-part school array won't fit. Encode it in the vertex's kind instead: `PK.k + 32·school`
   (kinds stay below 32), decoded in `MESH_FS` as `k = mod(kind, 32)`, `sch = kind / 32`. Free, and a rebuild already
   happens whenever the parts change. Check: Cape (0) leaves every vertex byte-identical to today (`partsMesh` hash).
3. **Paint and finish (`MESH_FS`, by `sch`).** Cape: as now (white, the black roll pattern, bare-metal bells). Steppe:
   grey-green enamel panel by panel with dark seams instead of the roll bands; olive bells with cooling-tube ribs. A
   power's own hue tints the school's accent (the roll band, the seams), as POWERS.md § Livery says.
4. **The interstage cover (`partsMesh`).** Where an engine sits exposed between a decoupler below and a tank above, draw
   a cover around it at the stack radius, outline unchanged: Cape a closed ribbed skirt, Steppe an open lattice of
   tubes (the engine shows through). It's drawing only: `noAero`, no mass, nothing in `PARTS`.
5. **The roundel.** A disc decal on the uppermost tank, from the power's flag motif (stripes and a star field; one big
   star on a plain field), drawn in `MESH_FS` like the roll pattern (no texture), coloured by the power.
6. **Signature designs for rivals.** One or two stacks per school from normal parts (Cape: tall three-stage with
   skirts; Steppe: a core with four conical strap-ons on cones), as designs the rivals' news pictures and pads use,
   never offered as the player's presets (the pay floor is measured against those, NOTES v1.53).
7. **The pad per school (the largest step, last).** Cape: today's fixed tower and swing arms. Steppe: horizontal
   rollout on rails, raised over a flame pit, the launch table's four arms falling back at lift-off: a new rig in
   `buildRig`/`drawPadRig` with its own animation, and the rollout screen's camera.

Steps 1–3 make every existing rocket look right for its maker; 4–5 are what makes a school recognisable at a glance;
6–7 are content for rivals and the pad. Defaults if Caio stays silent on W20: build in this order, Cape first (no
visible change), then Steppe.

## The plume meeting the ground (2026-10-07, aerofx session)

Before this, a plume on the pad went straight into the concrete: the raymarch ignored the ground, so the flame showed
through the deck, and smoke puffs were born underground. Three changes, all render-side:

- **The ground is opaque to the plume.** `groundFrame(camW)` returns the frame of the ground under the ship: the pad's
  own frame (x east, y up, z south down the flame channel) within 300 m of it, else the terrain below. The plume shader
  gets that plane in its local frame (`uGp`) and stops marching at it.
- **An impingement volume** (`IMP_FS`, drawn by `drawImpact` right after the plumes, a box proxy `CUBE`). The draw block
  intersects each burning engine's axis with the ground; jet strength there w = spool · smoothstep(1.15 L, 0.35 L,
  distance), so it fades as the ship climbs out of its own plume. On the pad, most of the flow goes down the flame
  channel (|x| < 3.4 m, from z ≈ 0 to ~38 m), thickening and cooling as it goes: white-hot at the impact, the
  propellant's mantle orange, then soot. Off the pad, a radial splash a few exit radii across. Colours, soot and
  opacity come from the engine's propellant profile (`PROPS`), so kerolox is smoky and hypergolic is faint.
- **A ground cloud of smoke** (`emitGroundSmoke`): while the jet reaches the ground, puffs at 30/s per engine (×
  strength). On the pad, 80 % pour out of the channel's mouth 26–40 m south and the rest spill over the deck round the
  table. Off the pad, they form a ring round the impact. Big, slow, rising puffs with a 40–70 s life. Underground birth
  points of the normal trail are dropped (the ground cloud stands in for them).

`IMPACT_FX = false` hides the volume. Cost, 1280×800, RS 1: the volume ~1 ms GPU on the pad; the ground cloud's puffs
~2 ms more while thick (they overdraw the screen near the camera; the old trail cost about the same once the rocket
climbed). CPU per frame unchanged (0.8–0.9 ms).

Reference views: `refView(60)` 0.6 s after ignition, `61` 12 m up, `62` 35 m up, `63` the Lunar at 3 m, `64` from above.

**Still open:** the channel is fixed to this pad layout (its walls at x = ±3.4, running south): another site's pad
would need its channel as data. No deluge water or steam. The ground cloud doesn't light up from the flame.

## Plume light (2026-10-07, aerofx session)

The burning engines light their surroundings: one soft point light per frame for all plumes (`plumeLight`, `PLT`).
- **Where and how bright:** each engine contributes at a quarter of its plume's length, or at 0.85 of the way to the
  ground when the jet reaches it (so the light sits low in the flame on the pad). Weight = spool × (exit radius / 0.55)²,
  and the light's position is the weighted mean. Colour = 0.4 core + 0.6 mantle from the propellant profile, with the
  plume's flicker. Strength scale 110, dimmed in thin air (×min(1, 4 pa + 0.15)). The core radius (2.5 exit radii)
  softens the 1/d² so nothing blows out next to the nozzle.
- **Meshes** (hull, pad, tower): a block in `MESH_FS` beside the floodlights: albedo × colour × (0.85 n·l + 0.15 wrap)
  / (d² + r₀²). This is the one cross-scope edit (the visuals session's shader), additive and self-contained.
- **Smoke:** per-vertex in `SMOKE_VS`, gain 0.18 with a wider core. At 0.55 the puffs by the flame saturated to white in
  daylight.
- **Ground:** the ground is the sky shader's, so a light pool is an additive disc just above it (`POOL_FS`, `drawPlumePool`),
  like the floodlight pools: irradiance from the light's height, faded at the edge, and scaled by darkness at the ship
  (0.12 in full sun → 1 at night), since it is added on already-lit ground.
- `PLUME_LIGHT = false` turns it off. Cost: ~0.5–1 ms GPU on the pad (same-page A/B, views 60 and 65).
- Reference views: `refView(65)` night, just after ignition; `66` night, 12 m up; `67` night, close on the rocket's base.

**Still open:** one light for all engines (a wide Heavy is lit from its centroid); no shadows (the tower's far side
gets 15 % wrap light); the ground pool is a flat disc, so off-pad slopes take it roughly.

## Engine ignition (2026-10-07, aerofx session)

An engine used to fade in over 0.12 s. Now it lights the way 1950s–60s engines did. The model is render-side, keyed on
a per-engine ignition clock: `spoolOf` stamps `sp.ig` whenever the spool starts from (near) zero with the throttle up, so
staging, relights and throttling up from zero all count.
- **Igniter flash** (`PROPS[...].ig`, `igT`): kerolox engines lit with TEA-TEB, a pyrophoric mix that flashes vivid
  green (the F-1's start). Here it is [0.25, 1, 0.35], decaying over 0.3 s. Alcohol has a short orange pyrotechnic
  flash, hypergolics a faint pink pop, hydrolox a dim blue spark. While it flashes, its colour replaces (not adds to)
  the young flame's, in the plume, the flame-channel volume and the plume light (× (1 − 0.8 gf)). Added on top, the
  flash only tinted a saturated yellow-white and never read as green.
- **Fuel-rich start** (`rich` s): for ~0.7 s on kerolox, the plume balloons near the nozzle (rb × up to 2.7), goes
  orange and lumpy, its shock diamonds off, and makes soot. The plume's length follows max(spool, 0.6 richness), so the
  start is a burst instead of a slow grow, and the spool's lag is 0.3 s while starting.
- `ignOf(e, P)` returns [flash colour × strength, richness] for the plume, impingement and light code.
- Reference views `refView(68–71)`: the Orbiter's Kestrel 0.04, 0.12, 0.3 and 0.7 s after ignition. `72`: 0.06 s at
  night. They wait 15 s on the pad first, since the service gantry rolls back over 14 s from the start of a flight
  (`padSync`, visuals), and they render every step so the render-side clock starts on time. Then they freeze the sim
  for the capture (`window.simulate` is stubbed; the next `refView` restores it), because the page's live frame loop
  otherwise ran the sim ~0.2 s on before the screenshot.
- Bug on the way: an inline `//` comment inserted mid-line swallowed the end of a `for` body (`R0=…}`), and the page
  went black with "Identifier 'W' has already been declared". Check one-line code edits with
  `node --check` on the extracted script.

**Still open:** shutdown tail-off (the plume still vanishes at cutoff) and staging puffs, both proposed with this.

## Engine shutdown and staging (2026-10-07, aerofx session)

**Shutdown tail-off.** A plume used to vanish the frame its engine left `activeEngines`. Now `plumeEngines()` also
returns stopped engines (still on the ship) whose spool has not decayed, and `spoolOf(e, on)` drives them to zero
with a 0.22 s lag. The moment an engine's target drops to zero (cutoff, flameout, throttle to zero) stamps `sp.off`:
- `ignOf` adds a **tail-off richness** (`PROPS[...].tail`, decaying over 0.5 s), so the dying flame goes orange, lumpy and
  sooty, the same look as the fuel-rich start. Its length follows the spool only (not the start's burst), so it shrinks.
- **cutoffPuff**: a handful of puffs of unburnt propellant leave the nozzle, sootier and more numerous for kerolox.
- The start/stop soot is confined to ~6–14 exit radii from the nozzle. At first it filled the plume's whole length
  and read as a long brown smoke trail.

**Staging.** `HOOK.debris` now calls `sepFx(d)`: when the dropped piece holds a decoupler, a ring of 18 gas puffs vents
radially from the seam (a stack decoupler's top face, a radial decoupler's mount) and 26 sparks spray out (tiny, glowing,
0.25–0.7 s). Breakups without a decoupler get nothing here (`booms` covers those). In thin air the gas spreads wider and
thinner (grow +3·(1 − pa), opacity × (0.25 + 0.75 pa)). Opaque, it ballooned into a white cloud at 30 km.

**Moving puffs:** cutoff and separation puffs travel with a velocity (`fxPuff`: inertial, Tellus-centred, ballistic)
instead of hanging in the air like the smoke trail, so they keep up with the ship for their short lives. `drawSmoke`
takes both kinds, and `hot` sets a puff's glow (sparks ~1.6).

Reference views: `refView(73)` the Orbiter's Kestrel 0.15 s after cutoff at 3 km, `74` 0.6 s after; `75` staging at 3 km;
`76` staging at 30 km; `77` the Heavy dropping its side boosters. They climb unrendered, reset the engines' ignition
clocks (else the first render would replay their ignition), then render every step through the action and freeze.

## Performance pass: all the engine and air FX together (2026-10-07, aerofx session)

Each effect had been measured alone. The heaviest scene: the Heavy at night, ~10 m up (three plumes on the pad, the
ground cloud, plume light, floodlights). 1280×800, RS 1. **Correction (2026-10-08):** headless Chrome was on the Intel
iGPU for these, not the RTX 5050 (`GPU_NAME` was never checked; `--force_high_performance_gpu` picks the RTX). The
before/after comparisons are valid (same GPU throughout), but the absolute times are iGPU times; the same scenes take
4–6 ms on the RTX. The same likely holds for the per-effect costs quoted in the sections above from this session. Frame frozen; each configuration removes one
effect; the configurations are interleaved over 4 rounds (alternating order) after a 6 s warm-up; median of the middle two.

| configuration | before | after |
|---|---|---|
| all on | 30.0 ms | 25.9 ms |
| without plume light | 29.7 | 25.7 |
| without the impingement volume | 24.0 | 24.2 |
| without smoke | 27.6 | 23.7 |
| without plumes (and so impingement) | 23.0 | 23.2 |
| all off | 20.9 | 21.1 |

- **The fix:** the impingement volume was drawn once per engine, and on the pad every copy's box spans the whole 38 m
  flame channel, so the Heavy marched the channel three times (~6 ms). Now one volume holds up to 4 impact points
  (`uIP[4]`: x, z, jet strength); the splashes sum, the channel takes the strongest jet (× 0.7 + 0.3 per extra engine,
  capped), the propellant is the strongest engine's. Then 40 → 28 steps, with no visible change (side-by-side at view 60):
  ~6 → 1.7 ms.
- Total for the FX in this scene: 9.1 → 4.8 ms. What's left: smoke ~2.2 ms (big puffs overdrawing near the camera; the
  trail predates this session), plumes ~1 ms for three, impingement 1.7, plume light ~0.2.
- **Measuring on this laptop:** the GPU idles at 0 MHz and ramps its clock under load, so back-to-back samples drifted by
  ±10 ms and removing an effect could read slower. A warm-up plus interleaved rounds gave spreads under 0.5 ms.

## Clouds with depth near the camera (2026-10-08, aerofx session)

Caio: the clouds look good from space, but at launch they are a flat layer. The deck was one infinitely thin shell at
3 km. Now, below ~20 km, the deck within 40 km is a raymarched slab from 2 to 5.5 km. The shell still draws beyond that
and from orbit, so space views are unchanged.

- **Coverage is unchanged, only given height.** The volume reads `cloudCovF`, the same function the shell uses and that
  `cloudAt` ports to the CPU for satellite imaging, so pictures and the drawn sky still agree. It is baked into a 512²
  texture over ±50 km round the point under the camera (gnomonic; `COV_FS` is sliced out of `SKY_FS`'s own source, so
  there is one copy of the noise), re-baked after 5 km of travel or noticeable weather drift. Calling `cloudCovF` per
  step would cost 15 value-noise calls × 40+ steps per pixel.
- **Shape (`cloudDens`):** a column's top height rises with its cover (thin cover makes low puffs, thick cover towers),
  times a km-scale noise so neighbouring columns differ; flat bases; two octaves of 3D noise (650 m, 230 m,
  planet-fixed, drifting with the weather) erode it into billows.
- **March:** 72 steps, spaced as x² so they are dense near the camera; the volume hands over to the shell between 50 %
  and 100 % of 40 km. Extinction 1/180 m⁻¹ at full density; the sky depth is written where the cloud passes 50 %
  opacity (meshes behind it hide).
- **Light:** two steps toward the sun (250 m, 800 m) for self-shadowing, plus a multiple-scattering stand-in
  (max(e^(−2.2 d), 0.4 e^(−0.35 d))); without it the inside of a cloud was mid-grey instead of bright grey-white. Tops
  brighter than bellies; sky ambient; aerial perspective as the shell's.
- `CLOUD_VOL = false` restores the flat shell everywhere. `CLOUD_DT` shifts the *drawn* weather in time for reference
  views only (`cloudAt` ignores it). Views 80–83 search it for ~60 % cover under the rocket.
- **Cost:** no measurable change on the RTX 5050 (pad 4.1 vs 4.4 ms, 3 km 5.6 vs 5.6, 8 km 5.4 vs 5.7, on vs off):
  within 40 km it replaces the shell's near-detail term. Also no worse on the Intel iGPU.

**Bugs on the way:** (1) the bake's centre used the transpose of the shader's `uProt` (planet rotation), so the texture
sat over the wrong place and the volume saw zero cover: the clouds just vanished. (2) the first reference views found
clear sky: the weather at the pad was simply clear, hence `CLOUD_DT`; then the 8 km view was clear because the rocket is
downrange of the pad by then, so the search is now under the rocket. (3) bank tops against the sky were sawtoothed at
48 uniform steps (grazing rays 40 km long); x² spacing and 72 steps fixed it.

Reference views: `refView(80)` on the pad, `81` 3 km, `82` 8 km looking down, `83` 25 km (shell only).

**Still open:** no cloud shadows from the volume onto the ground (the shell's `cloudShadow` still applies); no rain or
anvils; the deck from 8 km is still fairly uniform in brightness.

### The volume's own shadows; a less uniform deck (2026-10-09, effects beat, QUEUE Q65)
- **Shadows:** `cloudShadowV(p)` marches 5 steps from the ground point toward the sun through the 2–5.5 km slab with
  `cloudDens` (the volume's extinction, 1/180 m⁻¹; floor 0.25 for skylight) and blends that into the shell's
  `cloudShadow` by `uVk` and a fade at the bake's edge (36–47 % of its half-width). The cumulus over the sea in view 82
  now cast their own dark patches, offset away from the sun; the shell's smeared shadow stays beyond 40 km and from
  orbit. `CLOUD_SHADOW_V = false` for A/B. Cost: +0.3 ms at 3 km (view 81: 11.05 vs 10.73 ms), +0.75 ms on the pad
  (view 80: 8.68 vs 7.93 ms), RTX 5050.
- **Variety from 8 km:** the deck saturated to one white. Now a 9 km swell in each column's top height, a lower
  multiple-scattering floor (0.4 → 0.28, so billows shade) and a ±15 % brightness swell over ~7 km. Better, still
  modest: with a high sun a deck from above is mostly white. `CLOUD_VARY = false` for A/B; no measurable cost.
- `cloudAt` (the CPU port for imaging) reads coverage, not `cloudDens`, so pictures and the sky still agree.
- **Measuring pitfall:** the first timing loop of a page reported ~1 ms (warm-up); time each setting twice and use
  the repeat.
## Effects for the new features: escape tower, landing dust, explosions (2026-10-08, aerofx session)

Other sessions had added things with no visuals of their own: the crew escape tower (bodies), crewed Selene landings
(bodies), and PLAYTEST #5 (the explosion was one additive half-sphere).

**Escape tower motor.** While `S.lesT` burns (the bodies session's abort: 150 kN for 3 s), the tower's motor shows as
four nozzles (`lesNozzles`: 1.33 m up the tower, r 0.26 m, canted 35° outward) drawn as plumes. A new `solid` propellant
profile: white-yellow, nearly opaque, few diamonds. The nozzles go through the normal plume path (spool, ignition flash,
tail-off, plume light), and `emitLesSmoke` lays a dense white column (spaced by distance like the main trail; spaced by
time it broke into beads at speed). Views 84–86.

**Landing dust (airless bodies).** On a body without air, the jet that reaches the ground draws `DUST_FS` instead of the
hot-gas splash: a sheet of dust 0.45 m + 9 % of the distance thick, thrown radially outward in noise streaks, sunlit
and forward-scattering, with a patch swept clear under the nozzle. It starts 30–40 m up and thickens as the nozzle
descends. The first sheet (0.12 m thick) was invisible: 40 steps over a 60 m ray never landed in it. Albedo 0.78, above
the ground's, so the streaks read against the regolith. Views 87–89 hover a Wren over Selene.

**Explosions (PLAYTEST #5).** `HOOK.boom` (callers unchanged) now also records the air density, sprays sparks and
fragments (`fxPuff`, hot), and the draw is `BOOM_FS`: a raymarched fireball (three noise octaves for billows; white-yellow
core → orange → red) that turns into a rising smoke cloud, black soot greying over ~6 s, lasting 14 s in air. In vacuum it
flashes and thins out in ~3 s. Radius sz·(2 + 12√t) for the first 1.2 s, then a slower spread; the cloud rises
sz·3.5·t^1.2. The flash takes over the scene's point light (`boomLight`: brighter than the plumes for ~0.3 s, then a
1 s glow), so it lights the pad, the hull and the ground pool. Views 90–93 (they backdate the boom clock, which is wall
time).
- First look: a pale ball with a blue rim. Light smoke under sunlight swamped a weak fire. Darker soot, fire emission
  ×2.7, and the soot building over 0.6 s instead of 0.3 s fixed it.

**A box-proxy bug in all three box volumes.** The explosion was invisible: the mesh helpers' `box()` is not wound
consistently, so `cullFace(BACK)` dropped some of the box's near faces. The impingement and dust volumes had used the same
proxy and only worked because the reference cameras sat inside their boxes. Now `VBOX` (built by hand, wound outward on
every face) is the proxy for all three, and the shaders compute the ray's entry and exit analytically, so they don't
depend on which face rasterised. An intermediate fix (draw every face, march only from the far one) broke when the far
face lay under the ground (the depth test cut it).

**Cost on the RTX 5050** (on/off, same frame): explosion 0.55 ms at 1.2 s (the cloud filling a third of the screen),
landing dust 0.3 ms, escape motor within noise.

**Still open:** explosions are round; a ground-level fireball has no ground-hugging spread. Fragments don't trail smoke.
The escape motor's jets don't strike the capsule. The dust doesn't settle on anything and has no effect on visibility.

## HUD gauges (2026-10-08, aerofx session; PLAYTEST #9's graphics)

PLAYTEST #9 asks for gauges, atmosphere indicators included. The flight HUD's layout belongs to the ui session (its
slice 4: a core plus cards), so the split agreed with Caio is: this session builds the instruments as self-contained
widgets, slice 4 decides where they sit.

- **`drawGauges(x, y, s)`** draws a 318×150 strip on the 2D overlay (`octx`), top-left at (x, y), scale s. Nothing in the
  HUD's DOM changed. **`gaugeRect()`** is a placeholder position: right of `#navwrap`, or left of it when the window is
  narrow. Slice 4 replaces that one call. `GAUGES = false` hides the strip.
- **Altitude tape:** a scale scrolling round the current altitude (span 1.4 × altitude, 1.5–600 km), a lit window with
  the value, and radar altitude under it when low. Marks: AIR at the top of the atmosphere, the cloud deck (2–5.5 km) as a
  white band, Ap and Pe as red pointers.
- **Air:** a column filled to the ambient pressure on a log scale (1 → 10⁻⁴ atm), with the value or VAC.
- **q dial:** dynamic pressure 0 → max(40 kPa, 1.15 × peak), the needle, a red pointer held at the flight's max-q
  (`GQ`, render-side, per vessel), and MAX below. The **Mach drum** turns amber through the transonic band (0.85–1.25).
- **Heat:** the hottest part relative to its limit (skin K over `Tmax`), green → amber → red, with a redline at 85 % and
  the part's name.
- Look: cream dial faces, black ink, red limits, amber cautions on a dark panel; Bahnschrift / DIN / Arial Narrow type.
  A first step toward PLAYTEST #13 (the generic look).
- Reference views `refView(94)` the Lunar at max-q (10 km), `95` at 40 km, `96` capsule entry at peak heating. They
  leave the HUD on (other views hide it).

**For slice 4:** the widgets can split into separate cards (the tape in the core, q/Mach/heat in the Ascent card): each
block in `drawGauges` is independent, with its own offsets inside the strip.

## PLAYTEST #7: the planet flashing in space (2026-10-08, aerofx session)

**Symptom (Caio):** the planet sometimes flashes when the camera moves while looking down at it from space.

**Cause:** `depthTarget(w, h)` (the terrain's half-resolution depth pre-pass) reallocates its texture when the canvas size
changes, and bound it on whichever texture unit was active. At that point in `render()` that is unit 0, where the sky pass
had just been given the city-lights texture (`uCity`). For that one frame the sky shader read the depth buffer as city
lights, so the night side's land turned solid white (in daylight the change was smaller but present). The canvas size
changes whenever adaptive resolution (`RS`, v1.1) steps, and it steps when the GPU load changes, typically while the
camera moves: hence "sometimes, while moving".

**How it was found:** a sweep of 3,240 frames of camera motion (yaw steps of 0.025 rad; pitches 0.3–1.56; distances
15 m to 20 km; 40 km to 20,000 km; day and night), with adaptive resolution off, found no flash. Then each resolution step
was rendered twice: the first render after a step differed from an identical second one every time (night side at
150 km: mean brightness 19.3 vs 3.9), and never without a step. Reproducing the bad frame by hand (depth texture on unit
0, sky redrawn) showed the night-side land lit white.

**Fix:** `depthTarget` binds on unit 5, the depth texture's own unit (where the sky reads it), and restores unit 0. After the
fix, first and second renders match at every step. Lesson: anything that (re)allocates a texture mid-frame must not bind
on the active unit (LESSONS #33).

Also: the HUD gauges now hide with the HUD (`.ui` visibility), so the bare reference views stay clean.

## The sky from space: home galaxy, stars, sun (2026-10-08, aerofx session; PLAYTEST #10)

The space background was single-size white stars and a soft sun glow. Now, in `SKY_FS` (the background branch only:
`galaxy`, `starsAt`, `sunAt`):
- **A home galaxy generated from the world seed** (Caio's idea: each world's sky different). `GAL` (JS, `rng(WSEED·7919 +
  101)`) picks a great-circle band (normal `gx`), its centre `gc`, the band's width, bulge size, dust and arm contrast, a
  tint, a **satellite galaxy** (a small pale smudge) and a **nebula** (a pink patch). The band widens toward the centre and
  has a warm bulge, dark dust lanes along its midplane, and clumps stretched along it. Everything is sampled on the sphere
  (no angle coordinates): an `atan`-based first pass had a seam and stripes. Inertial directions, so the sky doesn't turn
  with the planet.
- **Stars:** two layers (220 and 560 cells per radian), colours by temperature (blue-white → orange-red), a few bright and
  many faint, and denser along the band.
- **The sun:** a limb-darkened disc of the right size (0.27°), a corona and a wide glow, and four camera-fixed diffraction
  spikes. The old glow was cut off at cos θ = 0.9, which showed as a hard circle once the glow was wider.
- **Dither:** the sky's output gets ±½ of an 8-bit step of per-pixel noise. Dark gradients (the galaxy, night skies) banded.
- Reference views `refView(97)` the galactic centre, `98` along the band, `99` the sun, `100` the band over a sunlit limb.
- Not done: a different galaxy per world needs `WSEED` to vary (it is a constant today); bloom on the sun (a post pass);
  the planets as points of light (PLAYTEST #11, a star-centred system).

**Also: a regression and its hotfix.** The PLAYTEST #7 commit (`807c1dd`) put a `// comment` mid-line in `gaugeRect`,
which swallowed a declaration: `render()` threw every frame while the HUD was up. `node --check` and `test.mjs` passed
(a runtime error), and the reference screenshots hide the HUD. Hotfix `8e070fc` pushed within the hour. Since then every
commit of this session first runs a live-flight smoke test with the HUD up (3 s of flight plus the map), which fails on any
console exception (LESSONS #34).

### A galaxy per program (2026-10-09, effects beat, QUEUE Q21)
`GAL` came from `WSEED`, the planet's seed, a constant: every playthrough had the same sky. The planet should stay fixed
(sites, coasts, powers all hang on it), so the galaxy gets its own seed instead: `PROG.gseed`, drawn the first time the
sky is drawn (`galaxy()`, called from `render()`) and saved with the program. `makeGal(seed)` is the old recipe.
- A program reset clears it (`gseed:null` in the reset in `app/editor.js`), so a new playthrough gets a new sky; the
  tester's sandbox is a separate saved program, so it has its own. An old save without the field draws one on load.
- Reference views set `PROG.gseed = WSEED` (13), so views 97–100 stay the pictures they were tuned on.
- Seen: `refView(97)` (aimed at seed 13's centre) shows the band; seeds 424242 and 99 put their galaxies elsewhere.
- test.mjs `aerofx-3`.
## PLAYTEST #3 and #4: a new rocket that looks new, and the pad at night (2026-10-08, aerofx session; visuals' code)

Taken with a note in the visuals session's claim (it was idle). PLAYTEST #2 (gantry clipping) had already been fixed by
the tester session.

**#3, "the rocket starts out looking beat up":** it was the LOX frost. A fuelled tank on the pad has frost = 1, and the
frost was opaque white blotches with the paint showing through as black specks, which reads as peeling paint. Now it is a
fine translucent rime: 12–38 % cover below the fuel line, a little thicker toward the bottom, with a soft ragged edge and
faint run-off streaks. The roll pattern stays crisp and the black squares read as frosted grey. Found by rendering the
same fresh rocket with frost forced to 0.

**#4, the pad at night and the buildings' surfaces:**
- **Floodlights** were four point lights with almost no falloff inside 30 m and no direction, so lit buildings came out
  flat white and the rest black. Now each is a spotlight from its 16 m pole aimed at the launch table (`uFlC`), with a soft
  cone (cos 0.5–0.86) and inverse-square falloff (420 / (d² + 60)), plus a faint spill (5 %) within ~150 m of the pad.
  The first gain (1500) saturated the red gantry, where the four cones overlap.
- **Surface detail for the launch complex** (`uPadM`, set only while `PAD` and the rig draw): from the pad-local
  position and material class. Concrete: formwork seams (1.2 m × 3 m), mottling, rain stains running down. White paint
  (tanks, LOX sphere, water tower): weld rings every 2.4 m with rust weeping below them. Steel: mill mottling and rust
  spots. Everything darkens toward its foot. Fades with distance.
- A diagnostic trap, for the record: overriding a top-level function from the page (`window.padLights = …`) did not take
  effect, so a "floodlights off" test proved nothing; logging the uniforms per draw call showed the floodlights were on.

## Bloom (2026-10-09, aerofx session)

Bright lights now glow. The frame is drawn into an offscreen target (`sceneTarget`: 4× multisampled colour + depth/stencil,
so the MSAA the canvas had is kept), resolved, and its near-white pixels are shrunk through ½, ¼, ⅛ and 1/16 resolution
(a 4-tap box each step, so the chain blurs them; `BLOOM_FS`), then added back while the frame is copied to the screen
(`COMP_FS`, tent-filtered on the small levels). `bloomBegin` / `bloomEnd` wrap `render()`'s 3D part; passes that render
elsewhere mid-frame (the cloud coverage bake, the depth pre-pass) return to `sceneFB()` instead of the screen.

- **The catch:** the scene is already tone-mapped, so a bright daytime sky is as near-white as the sun. The first version
  (threshold 0.8) turned the horizon haze into a white band on every daytime ascent. Now the threshold is 0.93 on the max
  channel, and the glow is added in proportion to (1 − luminance)^1.6 of the frame under it: strong over space, night and
  the dark side of things, faint over bright sky. A true HDR pipeline (float targets, tone mapping once at the end) would
  do this properly; it would mean touching every shader's output.
- Cost on the RTX 5050 at 1280×800: +0.1–0.2 ms (pad view, A/B). `BLOOM = false` draws straight to the screen.
- What glows: the sun in space, explosions, ignition flashes and plume cores at night, the floodlight lamps.

## Fin-tip vapor (2026-10-09, aerofx session)

In a hard turn in humid low air, a loaded fin's tip vortex condenses into a white streak. `finTipTick` records each fin
tip's path (planet-fixed, so the trail stays in the air) with a strength: the cross-flow along the fin's normal (in a
pitch turn, two fins of a ring trail and two don't), × angle of attack (smoothstep 1–7°), × dynamic pressure (3–15 kPa),
× humid air (below 5 km, gone by 11) and Mach 0.25–1.8. `drawFinTips` draws each trail as a camera-facing ribbon that
widens and fades over ~1.2 s, lit like the smoke. Fin rings and radial fins both. `FINTIP_FX = false` turns it off.

- **Drawn after the plumes.** The ribbons don't write depth, so drawn before the plume (with the smoke) they vanished
  behind the exhaust even where they ran in front of it; they run beside it, a fin span out, so drawing them after is
  the lesser error.
- The trail lies along the flight path, and the rocket points up to 15° off it, so trails split away from the exhaust
  only in a real turn. In a straight climb (AoA ~0) there are none, as it should be.
- Reference views `refView(101)` an 8° pull and `102` a 15° pull at 1.5 km, the camera square to the turn. They hold the
  attitude, since the sim weathervanes back within a second.

## Spent stages re-entering (2026-10-09, aerofx session)

Dropped stages (debris) now heat up and glow on the way down, render-side (`debrisHeat`, `DEBH`): a stagnation heat flux
per piece from its speed through the air (Sutton–Graves with its widest radius as the nose, the same `SG`/`HEAT_GAIN` as
the ship), smoothed over 0.5 s. Above 15 kW/m² it gets:
- **the ship's plasma**, now a function, `drawPlasma(VP, camW, body, pos, q, all)`, drawn per hot piece within 20 km (the
  piece's geometry from `debrisGeo`; `hullProfile(s, all)` takes detached parts);
- **char** on its parts (the flight-marks `char`, windward), so a recovered or photographed stage is scorched;
- **sparks** shed from it (`fxPuff`) and a **dark smoke trail** (planet-fixed puffs, thin at altitude).

What you see depends on the case. A stage dropped during the climb is far below and behind by the time it heats, and
debris more than 40 km from the ship is removed, so mostly you won't. A stage dropped just before re-entry (a tank or
service module shed above the atmosphere) comes in beside the capsule. A light empty tank brakes much harder than a
capsule: in the reference case it is 55 m away at 82.5 km, 360 m at 78 km and 1.8 km at 72 km, while its heating rises
from 34 to 67 kW/m². Hot and close only briefly.

Reference views `refView(103)` (82.5 km, the stage 55 m behind) and `104` (80 km), the camera beyond the capsule looking
back along the capsule→stage line.

**Still open:** a breakup that changes the sim (pieces burning up into smaller debris) is not done: debris is sim
state, and this pass is render-only.

## Design pass: station modules, the arm, the rover (2026-10-09, aerofx session; visuals' and sats' code, Caio's call)

The station parts, the arm and the rover had come in from other sessions as plain shapes. Same early-era look as the rest:
- **Hab and lab** get their own detail branch (`KIND` 16, `MESH_FS`): meteoroid-shield panels on the pressure hull (eight
  around, 0.55 m tall), seams, a bolt at each panel corner, a slight per-panel tint and pillowing. Geometry: chamfered
  berthing rings at both ends, yellow handrails on standoffs (`stationTrim`), portholes in dark frames and two radiators on
  standoffs (hab), a round bolted science window (`labWindow`) and experiment boxes on the gold band (lab).
- **The arm's base** becomes a turret with a drive ring. **The booms** (drawn per frame, sats' code) get joint drums at
  the shoulder and elbow, dark bands near each end, and an end effector (a snare drum with a camera).
- **The rover**: a dark tub inside a tubular frame (rails, uprights, cross-tubes), a floor of panels, fenders as an arc of
  overlapping plates, and titanium chevrons on the mesh tyres.

**And two bloom fixes** found on the way. The composite sampled the ¼ and ⅛ blur levels with the 1/16 level's texel
spacing (4× and 2× too wide), so each glow had ghost copies up to 64 px apart: long streaks beside any bright edge. And the
downsample is now a 3×3 tent, the threshold 0.965. Sunlit white paint is still as bright as the sun once tone-mapped; the
glow around it is now a soft rim instead of streaks.

**The first-run gate** (ui session) now covers the page on load, so screenshot scripts must click `[data-start]` first
(as `playtest.mjs` does). The older reference views that start in the editor don't, yet.

## Program design — direction and parking lot (2026-10-06)

**Direction agreed with Caio:** every payload *serves a need* and keeps doing so once it's in the right orbit. Services change
what's possible next, the world reacts (headlines, city growth, mood), and progression comes from infrastructure and
discovery rather than a points grind. Tone: lighter than "serious", possibly more than KSP. Not locked; gameplay decides.

**Next slices, in order:**
1. ~~World layer + drop zones + range safety + headlines~~ (v1.9).
2. A world clock and a light budget, then the **TV satellite** (stationary orbit at ~2,870 km; coverage → audience → support,
   with launches broadcast live) and **disaster surveillance** (storms, fires, floods, volcanoes on the planet; early
   warning reduces damage).
3. Weather sats (polar or sun-synchronous orbit: a plane change from an equatorial pad). They forecast the upper-level winds that load
   rockets at max-q.
4. The telescope as a *fragile* payload (g, joint-load and angular-rate limits), which reveals what's hidden (below).
5. Stations: depot, crew rotation, assembly. These need two fully simulated vessels at once (docking).

**Parking lot (spitballed, needs thinking through):**
- **A second, eccentric moon.** Physically fine on rails: its orbit is a fixed Kepler ellipse, like Selene's circle. With n-body later,
  pick an orbit that avoids close passes with Selene (or sits in a resonance such as 2:1) so it stays put. It's a natural
  *discovery*: small, dark, found by the telescope. It's cheap to reach only near periapsis, its sphere of influence varies along
  its orbit, and it gives you launch windows driven by *its* phase rather than Selene's.
- **Eras / ambient tech.** The world's technology advances on its own, partly nudged by the program. The elegant
  mapping: the **features we already built become avionics generations**. Early guidance computers have stability-only SAS. Later ones add
  prograde/node modes, maneuver-node planning, the impact predictor, then the autopilot. Satellites age: their service degrades as
  the standard moves on (TV goes "HD", old satellites lose their audience), which creates **servicing or replacement missions**,
  as Hubble had. That makes for consequence over time without a tech-tree grind. It needs care so it doesn't become chores.
- **Military contracts / a space race.** Secret, well-paying payloads with reputation risk if exposed, and a rival
  agency whose launches appear in the news, competing for firsts. Big. Parked.
- **N-body gravity** (assessed in chat): feasible, with Lagrange points (Selene/Tellus = 1.8 % < 3.85 %, so L4/L5 are stable).
  Costs: numerical rails and numerical map lines. Bearings and SAS are unaffected. Best as a setting.

## v1.67 — Astraea's ground on the CPU (2026-10-09, world session, GROUND.md G7)

The belt's dwarf planet (SYSTEM.md § Astraea, Ceres), built and measured headless like Enyo and Hesper. **Not live:** it's
on a stub body (`GROUND_STUBS.Astraea`: R 94 km, g 0.28) until the space lane adds Astraea; then it takes
`ground: ASTRAEA_GROUND`.

**A crust factor.** By the 1/g rule alone, Astraea's craters would stay simple bowls up to ~100 km, and a 100 km bowl is
20 km deep on a 94 km body. Ceres doesn't look like that. Its ice-rich crust is weak: Dawn saw craters turn complex at
~7.5–12 km, and its big ones have relaxed shallow. So a recipe can scale the transition by its crust (`crust` 0.12:
**12.5 km**), and above that the complex depth law keeps the big ones a few km deep. No change to the crater code: the
recipe passes its own transition size.

**What's there:**
- **Dark cratered regolith:** c 0.03 (between Mars's 0.02 and the Moon's 0.055: Ceres is heavily cratered but short of
  big craters), crisp (freshness hash²). Eight craters of 20 km and more; the biggest is 43 km.
- **A gentle swell** (±1.5 km). There's no lump: Ceres is near-spherical.
- **Ahuna Mons, the lonely mountain:** 4.6 km above its foot, 20 km across, a flat top (2°), flanks up to 39°.
- **The young bright crater (Occator):** 18 km, its rim 2.5 km above its floor, its central peak collapsed into a pit, and
  salt on its floor in blotches. It's the one bright spot on a charcoal-grey world, and its own surface
  (`salt deposits`) for anything that lands there.
- Surfaces: dark regolith (μ 0.6), salt deposits (0.5, smooth), salty ice rubble on the mountain.

**Measured** (`node study_ground.mjs astraea`, ~2 s):

| What | Number |
|---|---|
| Bake, sample | 80 ms (512×256, 1.15 km a texel); one height 3 µs |
| Relief | −3.0…+4.5 km (recipe `top` 6 km) |
| Craters N(>D) per km², measured / target | ≥20 km 7.2e-5 / 7.5e-5 · ≥2 km 7.6e-3 / 7.5e-3 · ≥0.2 km 0.75 / 0.75 |
| Slopes, regolith | median 2.6°, p90 17°, p99 32°, past TOPPLE 4.3 %, under 5° 71 % |
| Seams | steepest 0.5 m step on cube edges 48° (anywhere: 49°) |

Landing here is "closer to docking" (SYSTEM.md): escape is 229 m/s. The ground's part is that 29 % of it is over 5°.

**Negative results:**
- **At 18 km, Occator sits just past the size where a crater grows a central peak,** so the 600 m "central pit" only
  dented the peak and stood 200 m above the floor. The pit is now 1.5 km into the peak, 300 m below the floor.

**Tests:** `ground-5`, 5 checks:
- not live;
- counts, the 12.5 km transition and the biggest crater shallow (0.87 km, not a 20 km bowl), within top;
- the mountain (height, flanks 25–45°, a flat top);
- the bright crater (rim over floor, a pit, salt on the floor, regolith outside);
- no seams.

Mutations caught: no weak crust, no salt, no mountain. Full suite 506 pass, 0 fail.

**Next, in GROUND.md's order:** Hyperion's moons (Theia's lava plains and calderas; Eos's ridged ice; Tethys's lakes, dunes
and channels under haze; Phoebe, a cratered lump), then Erebus.

## v1.66 — rover prices and gates; Selene science contracts (2026-10-09, economy session, QUEUE Q10)

**Rover parts** (`sim/program.js`, `RV_PRICE`, `RV_GATE`):
- Prices (M): chassis small 4, medium 9, large 20; wheels 0.5 / 1.5 / 3 each (hub motor included); deck items: battery
  1, crew seat 3, camera mast 2, antenna 3, sample arm 5, spectrometer 6, seismometer pack 4, drill 8. The default
  two-seater (medium chassis, four wire-mesh wheels, two seats, battery, camera) is 24M; a small yard cart 9M.
  `partPrice` adds `rvPrice(p.dn.rvd)` to the folded rover part, so vessel cost, refurbishment and the debrief see it.
- **Gates by firsts:** small chassis and wheels, battery and camera from the start; antenna with *The beeper*;
  medium chassis, wire-mesh wheels, sample arm, spectrometer and seismometers with *The far side* (the Selene
  program); crew seats with *Passenger: one orbit*; the large chassis, heavy wheels and the drill with *Soft landing
  on Selene*.
- **The yard stays free:** design and test-drive anything at home. The gate is at LAUNCH (`rvLaunchWhy(parts)`, one
  line in `app/editor.js`): a rocket can't carry a rover with a part not yet open. The yard shows *Price* and *Can't
  fly yet: …* (one line in `app/rover-yard.js`). Both flagged for vehicle and space.

**Selene science contracts** (the sats session's R4 proposals, `sim/contracts.js`, science clients, after *Soft
landing on Selene*). Judged **between flights** by `selTick` (in `econTick`) on what has reached home **since the
contract was taken** (`c.base = selN()` at accept), and paid with news like a flight's (science yield applies):
- *Read Selene's dark plains / bright uplands*: 3–6 spectrometer readings of that unit;
- *A panorama of Selene, Q %*: one received at that quality or better (60–95 %);
- *A seismic network on Selene*: 4 seismometers set out (offered while there are fewer than 4);
- *Locate N moonquakes* (offered once 3 stations stand), *Bound Selene's core to 300 km* (after the first located quake);
- *Science from Selene's far side*: 1–2 far-side readings (it needs a relay). `sciGot` (sats' code, one field) now
  marks each spectrometer reading `far` (planet-fixed +X, Selene's far side).
Pay before the client multipliers: readings (20 + 10n)·1.6, panorama (40 + 120(Q − 0.6))·1.6, network 192, quakes
(30 + 15n)·1.6, core 240, far side (60 + 25n)·1.6. CT entries may now carry `open()` (offered only when true) and
`sel`/`done(c, N)` (judged by state, not a flight). Test `econ-6` (4 checks; "since taken" mutation-tested).

**Traps hit:** a mid-line `//` comment in `sciGot` swallowed the rest of the line (the handoff's warning, again); the
medium chassis and wire-mesh wheels share the key `m`, so a de-duplication by key alone lost one.

**Not yet:** the career runner doesn't fly rovers, so these prices are unmeasured against income; sample-arm and drill
contracts wait for their science (R4's next slice).

## v1.65 — Hesper's ground on the CPU (2026-10-09, world session, GROUND.md G7)

The second planet (SYSTEM.md § Hesper, Venus), built and measured headless like Enyo (v1.62). **Not live:** it's on a
stub body (`GROUND_STUBS.Hesper`: R 1,210 km, g 8.87) until the space lane adds Hesper; then it takes
`ground: HESPER_GROUND`. Landers and radar are all that ever see this ground, so the detail is modest: a 7.4 km map plus a
little procedural texture.

**What makes it Venus:**
- **Craters are few, fresh and never small.** The 90 bar air burns up small impactors, and the surface is young.
  - c 3e-5, against the Moon's 0.055 and Mars's 0.02. Venus has under a thousand craters in all; at Hesper's size that's
    **~140 over 2 km**.
  - Only the three coarsest bands run, so the smallest crater is 1.3 km. There's no thinning (Venus's craters are
    scattered at random), and freshness is uniform.
  - Simple turns complex at 3.3 km.
- **Basalt plains**, 85 % of the planet: −0.5 ± 0.4 km, with low wrinkle ridges (~110 m, ~30 km apart).
- **Slab rock** (Venus's tesserae), 11 %: blocks raised 2 km, with crossing ridged texture at 12, 5.5 and 2.5 km. It's
  the roughest ground on the planet.
- **One massif** (Maxwell Montes) to 8.9 km.
- **Four broad, gentle shields** (Maat Mons and kin): 150–200 km across, 3.3–5.7 km above their foot, flanks ~2°.
- **Three coronae:** rings, with the rim ~1.2 km above both the sagged centre and the moat outside.
- **A cluster of pancake domes:** 25 km across, 0.7 km high, flat tops. At this map's scale they're blobs.
- **Lava channels**, procedural: troughs ~1.5–3 km wide at half depth and ~80–110 m deep, along the isolines of a warped
  noise, in some of the plains. They're narrow enough that a lander can miss them.

**Surfaces by unit** (the lander that lasts minutes lands on one of these):

| Unit | Surface | μ |
|---|---|---|
| plains | basalt plains | 0.7 |
| slab rock, mountains | slab rock | 0.75, rough |
| shields, domes | lava flows | 0.7 |
| corona | fractured basalt | 0.7 |
| lava channel | channel floor | 0.65, smooth |

**Measured** (`node study_ground.mjs hesper`, ~2 s):

| What | Number |
|---|---|
| Bake, sample | 0.6 s; one height 2 µs |
| Relief | −1.1…+8.9 km (recipe `top` 12 km) |
| Craters, N(>D) per km² | ≥2 km 7.5e-6 (target 7.5e-6) · ≥5 km 1.1e-6 (1.2e-6) · none under 1.3 km |
| Slopes, plains | median 0.2°, 99.9 % under 5° |
| Slopes, slab rock | median 3.8°, p99 11° |
| Slopes, shields | median 1.7° |
| Seams | steepest 0.5 m step on cube edges 15° |

Nowhere on Hesper is past TOPPLE at this scale. The hazard is the surface's own roughness (`rough` 0.4 on slab rock), and
the heat and pressure, which aren't ground.

**Negative results:**
- **Slab rock first covered 25 % and was smooth** (max 4.7°): its threshold was too low, and its ridges too broad and too
  gentle. Raised to ~11 %, with ridges from 12 km down.
- **Plains with no texture are glass** (median 0.0°). Wrinkle ridges fixed that, and they're also what Venus's radar
  shows.
- **A noise-isoline channel's width is not the threshold over the noise's wavelength.** The first channels came out
  ~5 km wide for an intended 2 km (the gradient estimate was off ~2.5×). Measured cross-sections, then narrowed.
- **A test for a trough can't ask for "higher on most sides":** along the channel the ground is level, and the channels
  meander, so 3 km along the tangent leaves them. The check is now across (3 km, both sides) against along (1 km), the
  median of five channel points.

**Tests:** `ground-4`, 7 checks:
- not live;
- the craters (few, none small, within top);
- plains against slab rock;
- the massif and the shields;
- coronae as rings;
- channels as troughs;
- surfaces and seams.

Mutations caught: letting small craters through, no channels, smooth slab rock. Full suite 497 pass, 0 fail.

**Next, in GROUND.md's order:** Astraea (the belt's dwarf: a bright-floored crater, a lonely mountain), then Hyperion's
moons, Erebus.

## v1.77.1 — dispatched flights launch from their procedure's site and pay its lease (2026-10-09, economy session, QUEUE Q95)

A dispatched flight used to launch from home whatever its procedure (`dispatchRun` passed no site to `procFly`). Now
`procSiteOf(stack)` is the site the design's procedure was flown from (`proc.site`), or home:
- `dispatchQuote` and `baseRunQuote` refuse when `siteAccessOf` refuses that site, and add its lease (v1.56) to the
  price (`fee`, `site` on the quote);
- `dispatchTick` stands a queued dispatch down if the site has closed to us since (relations, sanctions), checks that
  site's weather for scrubs, and charges the lease with operations;
- `dispatchRun` (bodies' code, one argument) and `baseRun` fly from that site.
Test `econ-10` (mutation-tested): home 49M, the same dispatch from a leased site abroad 55M, refused when hostile.

## The career runner flies the real orbit presets (2026-10-09, economy session, QUEUE Q144; runner only)

`career.mjs`'s own stacks for the first orbits were stand-ins: the `passOrbit` one (biocapsule, pod, shield, no
decoupler) would bury its shield under the tank in real physics (NOTES § v1.73). It now prices the vehicle lane's
proven presets: **Beeper** for an instrument package in orbit (56M) and **Passenger Orbiter** for a biocapsule's orbit
(58M), down from the stand-ins' 71M and 74M; heavier lifts still add ballast to the Orbiter or the Heavy.
**Re-measured** (`PACE=1`, 2 years, 5 seeds): **first orbit in 4 flights for every start, in every run** (day 110–166);
with the first orbit attempt lost, 5–8 flights, and every start reaches orbit but one frugal-company run in five.

## Rovers in the career runner: v1.66's prices measured (2026-10-09, economy session, QUEUE Q130; runner only)

`career.mjs` now flies to Selene. The Selene firsts (*The far side*, *Impactor*, *Soft landing*) are abstract Probe
flights (p = 0.8; `fly_ladder.mjs` shows the Probe can fly them), and with `ROVERS=1` a **science rover** (medium
chassis, wire-mesh wheels, battery, camera, antenna, spectrometer, seismometers: v1.66 price 34M plus the deck) goes
on a Probe once the soft landing is done and there's 60M to spare (two tries at most). While it lives (`RV_LIFE` =
400 days, an assumption: D5 may change how rovers end) it sends a spectrometer reading every 3 days (a tenth from the
dark plains, 15 % from the far side) and a panorama each Selene day, through the game's own `sciGot`; its four
seismometers are set out on the near side and **the game's own seismic code** locates quakes and bounds the core. The
runner accepts Selene science contracts while the rover lives; `selTick` judges them. `SELENE=1` prints the summary.

**Measured** (4 years, 2 seeds, `SELENE=1 ROVERS=0/1`): the rover program costs 100–280M (the Probe and rover; a
failed landing doubles it) and its contracts pay **200–570M** over its life (5–10 contracts). Final funds against the
same worlds without rovers: **+90M on average**, from +835M (open-superpower consortium) to −140M (frugal and resource
agencies, whose soft landing comes in year 3 and can't absorb a lost rover). **Verdict:** v1.66's prices and the
Selene contracts' pay stand: a rover is a sound investment for a program that can afford it, not a lifeline. Noise
is large at 2 seeds (±400M, as the handoff warns).

**Found on the way:** a **company in a frugal world ends four years at 25M**, never reaching Selene (with or without
rovers); it reaches orbit (v1.77) but stagnates. A follow-up under *Proposed*.

## v1.78 — G3.0: the crater cells on shared trigonometry (2026-10-09, world session, QUEUE Q107)

The first step of GROUND.md § "G3: the port plan", allowed before the milestone gate. Headless, and no visible change.
The crater bands placed their crater centres with `Math.tan`, and found a point's cell with `Math.atan`. GLSL's built-ins
are good to ~1e-5 rad, which would put the shader's craters up to 3.5 m from the CPU's on Selene. Both sides now use one
formula:
- **`ptan`:** a Padé form on ±π/4, good to **1.9e-13**. It places the centres.
- **`patanJ`:** SKY_FS's own `patan`, ported to JS, good to **2.3e-8 rad** (under 1 cm on Selene). It only picks a point's
  cell, where a flip is harmless (the half-cell margin).
- **λ** (a cell's chance of a crater) is now the float32 the shader will compare with (`Math.fround`).

**Measured:** Selene's 3,000 reference heights moved by at most **2.7e-8 m**, against a 1 cm budget, and no crater
appeared or vanished. Crater counts and seams in `study_ground.mjs` are unchanged.

**Tests:** `ground-9` checks the approximations' accuracy, that `craterBands` calls neither `Math.tan` nor `Math.atan`
(putting one back is caught), and that λ is a float32. `ground-3`'s λ-scaling check now allows float32 rounding (1e-6).
Full suite 544 pass, 0 fail.

**Also checked, on this machine's GPU (now allowed):**
- **TESTING 131:** Selene from 900 km over its near side, nearly full. The maria are on the near side, a large dark patch
  over about a third of the face. They're subtle (the shader darkens them by 0.07); the look lane may want them darker.
- **TESTING 146:** can't be judged by eye. At seed 13 Tellus's north pole is open sea, and the south pole never sees the
  fixed sun. The pole fix stays covered by `ground-6`'s CPU check; the north pole renders cleanly.

## v1.77 — pay floors and withdrawing a contract; the first hour re-measured (2026-10-09, economy session, Q93, Q118)

**Q118, re-running `PACE=1 node career.mjs 2 5` on today's main** (after v1.55's cover, v1.73's Beeper presets and
everyone's changes): rich worlds reach first orbit in 4 flights. But **a private company in a poorer world (frugal,
resource, security) got stuck in 1 run of 5 with no forced failure**, waits up to 590 days. The trace: two orbiter
attempts lost the ordinary way left it at 29M, just above the 25M floor (no rescue; a company has no budget day),
both contract slots holding hops it could no longer afford, and the cheap work on the board barely breaking even.
That is Q93's problem in its sharpest form.

**Q93, built** (`sim/contracts.js`):
- **A pay floor.** Every offer pays at least `FLOOR_K` = 1.3 × the net cost of the cheapest preset that can fly it
  (`payFloor(type)`: the preset's price less the refurbishment a recovered flight brings back, `FLOOR_BACK`), applied
  after every multiplier, in any world, standing or cycle. Floors in a frugal company world: sounding work 13M,
  qualification tests 28M, hops 24M, satellites 84M. Selene science and lifts have no floor.
- **Withdrawing a taken contract** (`withdrawContract(id)`): the slot comes free now, for what a missed deadline costs
  later (−10 standing with that source, −3 the client's opinion). A *Withdraw* button on taken contracts
  (`app/program-ui.js`, one line and a `data-wd` handler, flagged for flow).

**The runner** (`career.mjs`) got three fixes, so its numbers move a little:
- it withdraws the dearest taken contract it can't afford when its slots are full and nothing is worth flying;
- it accepts only work it can pay for now (it used to count on the pay arriving after the flight);
- its what-if flight record now carries the program's site, so ballistic tests count again (v1.57 made them count
  only from their site, and the runner's hypothetical had none: it ignored a 62M ballistic offer at 25M).

**Result** (2 years, 5 seeds): with no forced failure, **every start reaches orbit in every run, in 4–6 flights**
(the frugal company was 4/5); with the first orbit attempt lost, 5–9 flights and every start but one frugal-company
run makes it (was three starts at 3–4 of 5, waits to 290 days). **Ablation:** without the floor, the frugal company
misses orbit in 1 of 5 runs with no failure, and after a lost orbit attempt the resource company misses one too and
the frugal company waits 68 days. Two-year funds are in the same range as before (the poorest worlds up, the frugal
company 112M → 290M; the richest unchanged, within the ±400M noise).

Test `econ-9` (3 checks; the floor mutation-tested).

**The intended number of flights (M1's finish line):** proposed as *4–6 flights to first orbit for a prudent player,
and no start stuck after one failed orbit attempt*, which `career.mjs` now shows (but for one frugal-company run in
five, which a person would get out of by withdrawing and flying samples).

## v1.76 — debris, slice 1: spent stages stay in orbit (2026-10-09, space session, QUEUE Q26)

Slice 1 of § "Plan: debris and Kessler" (below): **big pieces are objects.** In `sim/space.js` after the registry.
- `junkNote` (one call in `detach`, vehicle's `sim/vessel.js`): every piece a program flight drops is noted with its state,
  shape and mass, sim-side, so headless flights see it too (the app's `debris` list only keeps a piece for 240 s).
- `junkRegister(R)` at flight end, after `satRegister`: pieces of 100 kg or more (`JUNK_MIN`) in a closed orbit clear of the
  air (a moon's: clear of its highest ground) and well inside the SOI (Tellus: under half the nearest moon's distance)
  join the registry as **Debris** (`q.junk`, named after the stage's engine, e.g. *Kestrel booster (debris)*). One news line.
- They're registry entries, so what exists already works on them: drawn when near, **G targets them**, contact in flight,
  the arm grapples them. Never flyable (no command part), never held (`adrift` from birth, no propellant spent).
- Between flights they ride their rails plus decay (v1.64), no tidal stepping (cheap for hundreds); a moon's still uses its
  stepper. Low ones re-enter quietly (no warning, no news).
- The Program screen sums them in one line under *In orbit* (count, tonnes) instead of listing each.
- `procFly` saves and restores the list, so dry runs and dispatched flights leave none (dispatched debris: later).

**In practice** a normal ascent drops its booster suborbital (nothing registered); debris comes from staging after
orbit is reached, upper stages left in orbit, and anything dropped on the way to Selene that stays in a closed orbit.

Test `space-3` (3 checks; mutations caught: never noted, no orbit check, loud re-entry, no size floor, any flight's
pieces). Full suite passes. TESTING row 148. Next: slice 2, conjunctions between flights (active entries only).

## v1.75 — the seeded small bodies' ground, a recipe factory (2026-10-09, world session, GROUND.md G7)

The last piece of the per-body ground: SYSTEM.md's seeded classes (near-Tellus asteroids, belt bodies, trojans, comets,
interstellar visitors). None of them exists in the game yet (the space lane makes them, M4/M5), so this is a factory for
the space lane to call: **`smallBodyGround({kind, R, seed})`** returns a recipe (`gen: 'small'`) for a body's `ground`.
R is the mean radius; the seed should come from `WSEED` and the body's index, so a world keeps its rocks.
`SB_CLASSES` says which kinds each class draws from; the space lane may change the mix.

**Kinds** (`SB_KINDS`):

| Kind | Density (kg/m³) | Shape | Surface |
|---|---|---|---|
| stony | 2,000 | ellipsoid, b/a 0.6–0.95 | cratered (c 0.03), some boulders; stony regolith |
| carbonaceous | 1,400 | ellipsoid | the same, dark |
| metal | 5,300 | ellipsoid | iron-nickel, hard (soft −3) |
| rubble pile | 1,200 | near-round, a spinning-top ridge on the equator (Bennu, Ryugu) | covered in boulders, few craters |
| comet | 500 | 60 % are contact binaries (two overlapping spheres, a waist, like 67P) | dusty ice, steep-walled pits, few craters |
| visitor | 2,000 | a needle, ~4–8:1 (ʻOumuamua) | no craters |

**How it works:**
- **Shape** is computed exactly per point, not baked: a triaxial ellipsoid (the shortest axis is the spin axis, Y), or the
  union of two overlapping spheres. Both are star-shaped from the centre, so a radial height works (no overhangs).
- **Gravity** is G·(4/3)πρR: 1.7e-4 m/s² on a 500 m rubble pile, 7.8e-3 on a 20 km carbonaceous body.
- **Craters** use the bands that fit the body (the first whose largest crater is under R/4) and are baked below that
  (`bigCraters`' smallest size). There are none on very small bodies, where boulders take over.
- **Boulders and pits** are generated per 3D cell. Only cells whose point lies within half a cell of the surface hold one,
  and that point is projected onto the surface.
- One height costs 1–6 µs.

**Known simplification (the space lane's call):** slopes, and the physics' gravity, point at the centre, not along the
body's own lumpy gravity. So an elongated asteroid reads 15–22° of median tilt that its real gravity would mostly
straighten, and a two-lobed comet reads 24 % of its ground past TOPPLE.

**Measured** (`node study_ground.mjs small:<kind>:<R>:<seed>`, or the probe in the test):

| Body | Shape | Relief | Notes |
|---|---|---|---|
| stony, 5 km | 0.77–1.26 R | ±1.3 km | median tilt 15° |
| rubble pile, 500 m | near-round | −67…+80 m | ridge +29 m; boulders under 9 % of the ground; median 11°, but under 1 % past TOPPLE |
| comet, 2 km (two lobes) | — | — | pits 2 % |
| visitor, 200 m | 8.5:1 | — | — |

Crater counts match the target where the numbers are big enough (Phoebe, re-run: ≥2 km 1.33e-2 against 1.38e-2).

**Negative results:**
- **A visitor first came out 32:1.** Its third axis was drawn as a fraction of the second, which multiplied two small ratios.
  Now c/b is 0.75–1 for every kind.
- **Boulders and pits placed in 3D cells mostly float off the surface** (3 % and 2 points where ~8 % and dozens were
  meant). Projecting each onto the surface fixes the count, but a point projected from further than half a cell can be seen
  from one point and not the next: **3,697 missed features** at 20,000 points without the half-cell limit, **0** with it.
  A random-step test missed those steps, because they sit only at rare cell boundaries. The check that catches them
  compares a 27-cell search with a 125-cell one.
- **A ridge check that ignores the shape** passed with no ridge, because a flattened body is already wider at its equator.
  It now measures the ridge alone.
- **`study_ground.mjs` ignored a tiny body's starting band,** so it listed and counted bands the body never runs. That
  includes Phoebe's in v1.70, but v1.70 quoted no Phoebe crater counts.

**Tests:** `ground-8`, 6 checks:
- a seed reproduces a rock and another seed another; gravity from density;
- every kind at 0.2, 2 and 20 km is finite, under its top, the same through `groundAlt`, with its own surface;
- the shapes (a needle, a contact binary with a waist, a ridge);
- boulders and pits present, and none on a visitor;
- boulders and pits continuous (the 27-against-125 cells check);
- the crater bands across the seams.

Mutations caught: no ridge, gravity off by 10 %, projection without the half-cell limit. Full suite 533 pass, 0 fail.

**That completes GROUND.md G7 on the CPU:** every hand-made body and the seeded classes have ground. What's left is the
space lane's real bodies (Q87, M4/M5) and the shader (G3, which needs the GPU and the milestone gate).

## v1.74.1 — the sponsor's cover skips a flight that reached orbit (2026-10-09, economy session, Q122)

PLAYTEST #33: an Orbiter left in a 200 km orbit, the priciest rocket yet and completing nothing (no instrument
package for *The beeper*), drew "+42M Sponsor covers the failed attempt". The rocket worked; what it lacked was the
payload. `coverLoss` now also requires the flight **not to have reached orbit** (`R.orbit`), so the word "failed" stays
true. The Debrief's days line says "1 day passing" in the singular (`sim/debrief.js`, one line, flow's file). Test
`econ-1` gains a check (mutation-tested).

## v1.74 — staged pay only for missions flown for; supply runs wait for onboard computers (2026-10-09, economy session, Q112, D7)

- **Staged pay (QUEUE Q112, PLAYTEST #28).** A probe parked at Nyx collected the first two shares (20 % + 20 %) of
  every later Nyx mission as each one unlocked: `stagedMission` gave the shares to the first *open* mission bound for
  the body, so a mission that opened mid-flight was "on course" and "arrived" at once. The launch now records which
  missions were open (`R.open0`, in `missionTick`'s launch line), and a share goes only to one of those. Flights from
  older saves (no `R.open0`) behave as before. Test `econ-8` (2 checks, mutation-tested). `R.open0` is also what
  W11's broader rule (a mission counts only on a flight launched while it was open) would read, if it's built.
- **Supply runs follow the automation ladder (D7, Caio: option a).** MIDGAME.md: uncrewed runs to the moons arrive
  with onboard computers. `baseRunQuote` refuses before that era (`BASE_ERA`): "needs onboard computers". `econ-7`
  now checks the refusal and moves the date to the era (day ~3,010 in its world) before flying the run.

## v1.72 — Erebus's ground on the CPU, the last hand-made body (2026-10-09, world session, GROUND.md G7)

The icy dwarf at the edge (SYSTEM.md § Erebus, Pluto), built and measured headless like the others. **Not live:** it's on a
stub body (`GROUND_STUBS.Erebus`: R 238 km, g 0.62) until the space lane adds Erebus. With it, **every hand-made body in
SYSTEM.md has ground on the CPU** (Hyperion has none by design).

**What's there:**
- **The nitrogen-ice basin (Sputnik Planitia):** 200 km across, the same share of the globe as Pluto's. Its glacier floor
  is flat at −2.5 km (2.6 km below the land round it), and it has no craters (it renews itself).
  - It's broken into convection cells ~25 km across, with troughs along their edges 116 m below their middles (G-ice's
    Worley network, reused).
  - Surface: nitrogen ice, μ 0.2.
- **Water-ice mountains:** a dozen angular blocks on the basin's western margin, 10–20 km in radius and 2.5–4.5 km high
  (the tallest 6.5 km above the basin floor at its foot). Flanks p90 40°; water-ice bedrock.
- **Bladed terrain (Tartarus Dorsa):** ridges ~400 m high, ~5 km apart, east of the basin; methane-ice blades.
- **The dark tholin highlands (Cthulhu):** old crust, so every band crater survives there, against half on the uplands and
  none on the ice. They're the most cratered ground: 18 craters ≥ 1 km per 1,000 km², against 10 on the uplands.
- **Uplands of methane frost** everywhere else.
- **An icy crust** (0.4, as Tethys and Eos): simple turns complex near 19 km. That's an assumption: Pluto's own transition
  isn't pinned down.

**Measured** (`node study_ground.mjs erebus`, ~4 s):

| What | Number |
|---|---|
| Bake, sample | 0.6 s; one height 2.5 µs |
| Relief | −3.4…+4.6 km (recipe `top` 6 km) |
| Units | uplands 88 %, tholin 5.9 %, nitrogen ice 3.5 %, blades 2.0 %, mountains 0.7 % |
| Slopes, nitrogen ice | median 0.3–0.6°, p99 4°: the flattest landing ground in the system |
| Slopes, mountains | median 20°, 43 % past TOPPLE |
| Slopes, blades | p90 17° |
| Seams | 36° on cube edges |
| Pole | 19° (ground-6's pole check now includes Erebus) |

**Negative results:**
- **Overlapping mountain blocks summed their heights:** up to 10 km, past the recipe's bound. Overlaps now take the
  taller block.
- **Narrow blocks were cliffs** (p90 58°, max 68°). They're wider now, with longer flanks: p90 40°, max 51°, still
  bedrock-steep.
- **A unit mask that includes the shore isn't the floor.** "Nitrogen ice" first took in the basin's 14° shore, then the
  outer flanks of blocks standing in the basin (p99 10.7°). It's now the glacier floor only (p99 4°).

**Tests:** `ground-7`, 6 checks:
- not live;
- the basin (depth, a flat floor, within top, nitrogen ice);
- the convection cells;
- the mountains;
- the tholin highlands most cratered (by the thinning, and rougher);
- no seams.

Mutations caught: no basin, no convection cells, uniform crater thinning. Full suite 526 pass, 0 fail.

**Next:** the seeded small bodies (one lump recipe, its parameters from `WSEED`); and, for every body here, the space
lane's real body in the tree (Q87), then the shader (G3).

## Plan: debris and Kessler (2026-10-09, space session, QUEUE Q26)

Builds LATE_GAME.md § "Debris and Kessler" (round 5, Caio): big pieces are objects, fragments are a density per band,
drag cleans low bands, a cascade can foul a high band for decades with warning, tracking is a mechanic, debris may destroy
an uncrewed satellite but crewed nodes are always warned, and the whole pressure is a world setting (off / light / real,
default light).

**What exists:** contact in flight between the vessel and registered satellites (sats session: signed-distance parts,
`HIT_NEAR` stepping). **What doesn't:** a spent stage lives only in the app's `debris` list for 240 s and is gone at
flight end (headless flights never see one); nothing collides between flights; no bands; no setting.

**Slices:**
1. **Big pieces are objects** (this session). `detach` notes every dropped piece of `JUNK_MIN` = 100 kg or more; at flight
   end the ones in a closed orbit clear of the air (and well inside the SOI) join the registry as *Debris* entries
   (`q.junk`): drawn, targetable, grabbable by the arm, hit in flight like any satellite; never flyable, never held.
   They ride their rails plus decay (v1.64), with no tidal stepping, so hundreds stay cheap; low ones re-enter quietly.
2. **Conjunctions between flights,** big objects against **active** entries only (with a job, a station, anything
   crewed), never object against object (LATE_GAME's measured costs). Each object is smeared over its orbit's shell
   (Öpik/Kessler flux): risk a day = Σ density × cross-section × relative speed. A seeded roll. **Tracked** (radar +
   compute by era) → a warning and an automatic dodge for a small Δv from its tanks; untracked → a statistical risk.
   Crewed nodes are always warned and dodge. A hit destroys an uncrewed satellite and the object, and feeds slice 3.
3. **Fragments as bands** (ESA MASTER style): 50 km bands to 2,000 km; each holds a fragment density that drag clears
   (lifetime from `thinAir`), collisions add to it, and past a threshold the band feeds itself (the cascade), with news
   well ahead. A security state's anti-satellite test fouls a band (POWERS.md hook).
4. **The world setting** (off / light / real) on slices 2–3, each in its own code path; the map's band view; cleanup
   contracts (economy, paid by worried powers).

**Defaults (Caio may override):** `JUNK_MIN` 100 kg (smaller pieces go to the bands in slice 3); debris on rails + decay
only (no tides: cheap, and nobody's slot depends on a spent stage); *light* = a tenth of the real collision rates;
dispatched routine flights leave no debris yet (`procFly` restores the list); fairings and small pieces are slice 3.

## v1.71 — station-keeping re-tuned: a good satellite outlasts its era (2026-10-09, space session, MIDGAME § Satellites)

[`MIDGAME.md`](MIDGAME.md) § Satellites (Caio, 2026-10-09): lifetime is a design choice made once, a well-built satellite
outlasts its era, replacement is for upgrades, and maintenance as a chore is out. v1.60's numbers made a TV satellite with
100 m/s of tanks last ~270 days, i.e. careless by default. Re-tuned, still on the real physics:

- **Holding pays the orbit's size and shape, not its tilt.** About 70 % of v1.60's cost was the plane. Real geostationary
  satellites late in life stop holding it too and fly on inclined. `slotRate` now pays the net change in size and shape
  between one-orbit means 20 days apart (`SK_D` 5 → 20, so Nyx's 4.2-day and Selene's 13-day pulls mostly cancel); the
  tilt rate is kept as `q.skTilt`.
- **The tilt really wanders.** `tiltStep` turns a held orbit's angular momentum by the tide's torque averaged over one orbit
  (24 points, steps of half a day), keeping size, shape and phase. Against the full RK4 after 20 days: a stationary orbit
  tilts 0.165° (RK4 0.175°), the normals 0.017° apart. Orbits tilting under `TILT_MIN` (~0.7° a year: low ones) are left alone.
- **TV pays while the capital sees it 15° up all day** (six times through the day), not only under 3°. The mission that
  sets it up still asks for under 2°.
- `SK_MIN` 0.1 → 0.02 m/s a day (size and shape cost less than the old total).

**Measurements** (`node study_slot.mjs`, part C: a TV satellite held over the capital, 42°S, plenty of propellant):

| year | 1 | 2 | 4 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|
| tilt | 3.6° | 7.4° | 14.9° | 23.1° | 27.1° | 31.2° |
| TV days | 100 % | 100 % | 100 % | 100 % | 8 % | 0 % |
| m/s spent | 89 | 177 | 354 | 531 | 620 | 708 |

The tilt peaks near 37° in year 10 and turns back: the plane precesses about Nyx's (30° inclined; Tellus has no
oblateness to hold it near the equator). Hold costs: ~0.1–0.2 m/s a day stationary (the start phase matters about 2×), ~0.04
at 3,000 km, nothing in low orbit. So **a TV satellite with ~500 m/s in its tanks (a fifth of its mass at Isp 300) keeps
TV about six years**, and then its tilt ends the job anyway: the natural moment for MIDGAME's upgrade. One with 50 m/s
lasts about eight months.

**Negative results.** (1) Paying every swing in size (read every 2 days) gave 0.35 m/s a day: it paid for Nyx's 4-day
wobble, which hardly moves the satellite along its orbit. (2) A deadband controller on the full physics (burn to reverse
the drift when it strays 5°/20°/40° in longitude) gave 120–460 m/s a year, but its burns pumped the eccentricity to
0.2–0.6, so it measured a bad controller, not the need. The orbit's size does swing ±40 km over months with no trend (no
secular change, as averaging theory says), and its eccentricity grows steadily (~0.03 a year stationary). A proper
controller would be the better measure, later.

**Not changed:** a dry satellite still drifts (full RK4) and, if low, decays (v1.64). Whether a dry one should re-enter at
all is **W17** (default: yes). The builder lifetime readout is a vehicle + space follow-up.

`space-1` reworked (5 checks: the held orbit keeps size and shape exactly while its tilt moves; a held TV satellite past 3°
still pays for 800 days; mutations caught: no tilt step, TV under 3° again, the plane paid again). Full suite 512 pass.

## v1.64 — orbital decay: low orbits come down (2026-10-09, space session, QUEUE Q25)

The air the flight flies through stops at 100 km. Above it, **a thin upper atmosphere now drags on registered orbits
between flights**: a satellite with propellant pays to hold its orbit, and a dry one sinks and re-enters. In `sim/space.js`,
after v1.60's station-keeping, which it extends.

**How it works.**
- `thinAir(h)`: Vallado's exponential model (CIRA-72, moderate sun), 100–1,000 km, its last scale height carried to 2,000 km.
  Tellus is a fifth of Earth but its air is Earth's height (7.5 km scale height, top at 100 km), so the table carries over.
  **The flight doesn't use it yet**, and that's a real gap at the bottom: coasting with Cd·A/m 0.01, the thin air takes
  20 m/s an hour at 110 km, 1.7 at 130 km, 0.4 at 150 km, 0.05 at 200 km (measured with `dragRates`). So a flight that
  parks at 110 km for hours is too kind; between flights the same orbit is gone in under an hour. Proposed as a follow-up
  (it changes how long parking orbits last mid-flight, so it wants a look at the presets' ascents first).
- `dragK(q)`: Cd·A/m. Tumbling, so A is the mean projected area of one cylinder around every part (a quarter of its
  surface, Cauchy's theorem), Cd 2.2; docked modules count in area and mass. Preset payloads come out at 0.005–0.014 m²/kg,
  like real satellites.
- `dragRates(a, e, K)`: Gauss's equations for drag along the velocity, averaged over one orbit (36 points evenly in time).
  `decayAE` steps (a, e) on the rails, the apsides fixed and the mean anomaly carried along, in steps that keep the
  periapsis change under 5 % of its height above the air (at least one orbit). Below 100 km it's gone.
- **Holding** (`holdRate` = v1.60's tide rate + `dragRate`, the orbit-mean drag × a day): a satellite with propellant stays
  on its rails and pays both. Dry (`q.adrift`), a Tellus orbit with a real tide drifts as in v1.60; any other decays
  (`decayStep`). Air rotation is ignored (the air turns at 278 m/s against 3.2 km/s of orbit: about 15 % less drag).
- **Warned, then gone.** One news line *X is sinking into the upper air: it will re-enter within N days*, looked up across
  the whole jump, so a long wait between flights can't skip it; then *X has re-entered … and burned up*. The Program line
  reads *nothing to hold it up: re-enters in about N days*, or *holds its orbit N more years, then re-enters in about …*.

**Measurements** (`node study_decay.mjs`; game days of 8 h, years of 400 days; circular orbits):

| altitude | Cd·A/m 0.005 | 0.01 (a typical payload) | 0.02 |
|---|---|---|---|
| 110 km | 1.4 h | 0.7 h | 0.7 h |
| 150 km | 10 days | 5 days | 2.7 days |
| 200 km | 139 days | 69 days | 35 days |
| 250 km | 1.8 years | 363 days | 182 days |
| 300 km | 6.6 years | 3.3 years | 1.7 years |
| 400 km | 53 years | 27 years | 13 years |

Per game day, an orbit loses height ~33× more slowly than the same height on Earth per Earth day (slower orbits, a smaller
planet, shorter days), so 200 km lasts weeks here, not days. The averaged rails agree with a direct RK4 with the same drag
to 1 % (150 → 120 km: 4.52 days against 4.47; the test checks 150 → 130 km to 5 %).

**What it changes in play** (Pillar 2: a design problem): the usual parking orbit, ~110 km, now lasts under an hour once a
flight ends. Anything meant to stay (a docking target for the next flight, an imaging satellite, a station) goes above
~200 km, or keeps some propellant: a dry Probe at 200 km lasts ~80 days; with fuel it holds itself up at ~0.09 m/s a day.
Robot docking scenes are within one flight and unaffected; the full suite and `career.mjs` are unchanged.

**Not yet:** reboost contracts (economy; v1.60 proposed servicing), the solar cycle (density swings ×10 at 400 km), air
rotation, and drag on a moon (none has air). Spy satellites (NOTES § Military): lower is sharper but now really decays faster.

Test `space-2` (4 checks; mutations caught: holding ignores drag, the warning not looking ahead, never removed, half the
decay rate, Cd·A/m in the wrong units). Full suite 475 pass. TESTING row 140.

## v1.60 — station-keeping: a satellite's life is its propellant (2026-10-08, space session, QUEUE Q50, W2)

W2's default, built: **a satellite holds its orbit by spending its own propellant against the moons' tides; when the tanks
are dry it drifts off its slot, and nothing is destroyed for running out.** In `sim/space.js`, after the moon-orbit stepper.

**How it works.**
- `slotRate(q)`: the m/s a day it costs to hold this orbit, measured once (cached `q.skRate`) by stepping the orbit under
  `pertAcc` for `SK_D` = 5 days and reading how far its plane, size and shape have moved (one orbit's mean, so the wobble
  within an orbit cancels). Phase is free: fixing it only needs a slightly different size for a while.
- Orbits the flight treats as unperturbed (`pertNear`), or that cost under `SK_MIN` = 0.1 m/s a day (low Tellus orbits,
  which drift a few km a month), pay nothing and never drift. Decay (Q25) will be their lifetime instead.
- What it can burn (`skProp`): tank fuel through its best engine's vacuum Isp, then RCS gas (Isp 70). `skDv(q)` is what's
  left; `skSpend` takes the propellant out of the entry's own `shape[].res` and lowers `q.mass` (kg; tanks hold tonnes), so
  a satellite flown again later has the fuel it really has left.
- `orbTick(T0, T1)` replaces `moonOrbTick` in `advanceDays`. A held orbit stays on its exact Kepler rails and pays
  `rate × days`. When the tanks run out mid-tick, it leaves its rails at the moment they ran dry (`q.adrift` = that day),
  with one news line (none for a satellite that never had propellant), and from then on the tide steps it between flights
  like every orbit about a moon (`moonOrbStep`, which now also covers Tellus: the floor is the top of the air there).
- **The same rule around the moons:** a Selene orbiter with propellant now holds its orbit too. Before, every moon orbit
  drifted; test 40's tide check now uses dry relays, and `space-1` shows the 2,000 km polar orbit that falls in by day 41
  holding at 3.5 m/s a day.
- A flight that flies or docks with the satellite re-registers it (`s.reg`): a new slot, a fresh rate, its tanks as they are.
- Program screen: each satellite line says *holds its orbit 240 more days (0.37 m/s a day)* or *adrift since day N*.

**Measurements** (`node study_slot.mjs`, circular orbits, 8 h days; the m/s to put plane + size + shape back, per day):

| orbit | tide (max) | off its rails after 1 / 5 / 20 days | to hold, m/s a day |
|---|---|---|---|
| low 300 km, equatorial | 1.0e-5 m/s² | 0.0 / 0.1 / 0.6 km | 0.037 (ignored: under `SK_MIN`) |
| polar 1,000 km | 1.7e-5 | 0.6 / 2.6 / 10.6 km | 0.031 (ignored) |
| navigation 3,000 km, 60° | 2.7e-5 | 3 / 17 / 56 km | 0.27–0.31 |
| stationary (TV) | 6.1e-5 | 5 / 4 / 509 km | 0.34–0.42 |

So a TV satellite pays ~150 m/s a year (real geostationary satellites pay ~50 m/s a year; Nyx is close and heavy). 100 m/s
of tanks holds it ~270 days. Plane drift dominates everywhere, as for real geostationary satellites.

**Negative result:** the first measure, "chase the Kepler rail" (a correction every τ costing |δv| + 2|δr|/τ), said a low
orbit costs 0.3 m/s a day and a stationary one 3–26, depending on τ. It was paying to follow the wobble within each orbit,
which no satellite needs to. Only the secular drift (the elements, averaged over an orbit) is a real cost.

**Decisions (defaults; Caio may override):**
- *Service pauses* is read physically: drifting doesn't switch anything off; whatever needed the slot stops because the
  geometry says so. TV goes grey when it leaves the capital's sky (the existing check: a dry stationary satellite placed
  over the capital does on day 87, measured); navigation coverage and imagery
  carry on from wherever the satellite is, as real Transit satellites did without station-keeping.
- So Q34a's power-flat pause has no shared field to join yet: when it lands it adds `q.off` (why) and gates TV pay in
  `utilTick`, `navCover`'s list and the imaging contact on it. This slice didn't build an empty field ahead of it.

**Not yet:** reboost and servicing contracts (economy), refuelling by docking (propellant transfer doesn't exist yet), a
held satellite's slot shown on the map, and the stepping for Tellus orbiters skipped during flights (a dry satellite rides
Kepler from its last tick until the flight ends, as moon orbiters already do).

Test `space-1` (4 checks; mutations caught: no spending, dry Tellus orbits not stepped, no `SK_MIN`, news for a satellite
that never had propellant, moons never holding). Full suite 466 pass. TESTING row 134.

## v1.59 — every offer says why it appeared (2026-10-08, economy session, QUEUE Q45)

`whyOf(type, src, client)` in `sim/contracts.js` picks **the strongest true reason** when `genOffer` makes the offer, and
stores it as `o.why` (one line; old offers have none and expire within 50 days). In order:
1. *New since you did “⟨first⟩”*: the type's `req` was done in the last 60 days (`WHY_NEW`);
2. military work: *⟨client⟩ is nervous about its neighbours* (`tensionOf` > 0.4);
3. commercial work: *Boom times* (cycle > 0.45) or *A rare order in a recession* (< −0.45);
4. tourism: the tourism standing;
5. government work from home: *Your government wants results*;
6. *⟨client⟩ cares about ⟨science/commerce/…⟩* (that priority ≥ 0.35 in its flavour);
7. *Your ⟨source⟩ standing (N) brings work* (≥ 70);
8. else *Routine ⟨source⟩ work from ⟨client⟩*.

The Contracts tab (`app/program-ui.js`, one line, flagged for flow) shows *Why: …* above the brief, on offers and taken
contracts. Test `econ-4` (5 checks, mutation-tested). On a sample board most lines are *Routine* or the cycle: if the
board reads as noise, the thresholds are the knobs (TESTING 133 asks).

## v1.58 — Selene's ground on the CPU, and the maria on the near side (2026-10-08, world session, GROUND.md G2)

Slice G2 of [`GROUND.md`](GROUND.md): Selene's height function, built and measured headless. It is **not live in
play**: `SELENE.ground` stays unset until the sky shader draws the same relief (G3); until then a ship would land on hills
nobody can see. Tests and `study_ground.mjs` switch it on in their own SIM copies. What did change in play: **the maria
moved to the near side.**

**The maria** (decision 1, default held). `selMare` and the shader's mare term both gained `−MARE_NEAR·n.x` (0.24; −X faces
Tellus). Swept against the Moon's shares (31 % of the near side, 2 % of the far side, 16 % in all): **30 % near, 1 % far,
15.3 % in all**; it was 5 % near, 11 % far, 8.4 % in all. Geology follows, since it reads the same mask. Test §42 moved
with it: its spots are now a near-side mare (direct contact) and a far-side highland (needs the relay). Its sample
points were broken too, see below.

**The recipe** (new `sim/ground.js`, after `rovers.js`, now holding SIM END). Height = a baked map + procedural crater
bands.
- **The map**, 1024×512 (2.1 km a texel), baked on first use (0.8–1.1 s, never at load):
  1. highland swell, ±0.9 km (integer-hash fbm);
  2. the old big craters stamped in (inside the rim the crater replaces the ground, outside its ejecta adds);
  3. the maria flooded to a gently domed plain about 1.4 km down;
  4. the young big craters (15 %) on top of everything.
  209 craters ≥ 20 km (N(>D) = 0.055·D⁻² per km², the Moon's highlands), up to 150 km.
- **The bands:** six, from 20 km down to 80 m, each running down to the next. The cells are on an equiangular cube, one
  crater per cell at most (λ 0.38). A crater reaches D from its centre and D ≤ 0.8 of a cell's arc, so a point sees
  every crater touching it in the 3×3 cells around it, on each face whose cells come near (up to three at a corner).
  Integer hash only, so G3 can port it.
  - On mare, 85 % fewer (weighted like the flooding).
  - Freshness is `hash³`: most craters are degraded.
- **Shapes:**
  - simple below GR_DT/g (18 km on Selene); complex above: a flat floor, a steeper wall, a central peak past 1.4×;
  - depth 0.2 D (simple), 0.138·Dt·(D/Dt)^0.301 (complex, Pike's lunar fit); rim 0.036 D;
  - ejecta rim·r⁻³, faded by r = 2.
- **Cost:** one height 3–6 µs on the CPU.

**Measured** (`node study_ground.mjs`, ~30 s):

| What | Number |
|---|---|
| Relief | map −4.0…+1.6 km; sampled p0.1 −3.2 km, median −50 m, max 1.3 km (recipe `top` 4 km) |
| Crater counts, N(>D) per km² vs the target (before mare thinning) | ≥20 km 1.37e-4 / 1.37e-4 · ≥5 km 1.95e-3 / 2.20e-3 · ≥1 km 4.86e-2 / 5.50e-2 · ≥0.2 km 1.21 / 1.37 (the gap is the mare thinning) |
| Craters ≥ 1 km per 1,000 km² | highland 55, mare 12.5 (4.4× fewer; ~10× was the plan: partly flooded mare edges count as mare) |
| Slopes over ±15 m, mare | median 1.0°, p99 27°; past TOPPLE (24°) 1.8 %; under 5° 76 % |
| Slopes over ±15 m, highland | median 4.2°, p99 35°; past TOPPLE 6.9 %; under 5° 54 % |
| Cube-face seams | the steepest 0.5 m step on the edges (47°) is no worse than anywhere (53°) |
| Never sunlit (fixed sun 6.8° above the equator), 2 m above the ground | 8 % at 70°S, 23 % at 75°S, 100 % from 80°S |

**Negative results:**
- **A paraboloid bowl is too steep.** The rim wall of `−d + (d+rim)·r²` is 43°, and up to 58° where craters overlap. Real
  fresh walls stand near the angle of repose (~35°). r^1.6 gives 37° at the rim; the highland p99 went from 39° to 35°.
- **Thinning mare craters by the raw mask** left them only 2.75× sparser: edges have a weak mask but are counted as mare.
  Weighting by the flooding weight made it 4.4×.
- **Bands sized from a guessed safety factor** left a gap between the procedural craters (up to 7 km) and the baked ones
  (from 20 km). The bands are now defined by their largest crater, and each runs down to the next.
- **Test §42's sample points all lay on one curve.** z came from the golden fraction as well as the angle (both
  `frac(0.618·i)`), so 3,000 "spread" points traced a single spiral. It read 9.7 % mare for a true 8.4 %, and 32 % for a
  true 15 % after the move. It's now a Fibonacci lattice (`z = 1 − (2i+1)/N`) (LESSONS #36).

**Tests:** `ground-2`, 5 checks:
- not live, baked lazily;
- relief within bounds, and the counts (baked = GR_C·area/400; band cells filled at λ within 3 %);
- no seams (under 60°);
- maria low and smooth against rough highlands;
- in the physics: a pod rests on a 0.9° mare flat at the ground's height (gap 0.00 m), and slides 164 m off a 34° wall.

Mutations caught: the recipe live at load, only the point's own cube face (a 90° cliff at the seams), and no flooding.
§42 updated as above. Full suite: 457 pass, 0 fail. TESTING row 131: the maria seen from Tellus (the one change you can
see).

**Not yet** (GROUND.md):
- G3: the shader draws this relief (then `geoAt` reads the bake, and the recipe goes live);
- per-recipe surfaces (`surfaceAt` is still `SURF_MOON` everywhere off Tellus);
- the polar dark floors as an R4 deposit mask (G5).

## v1.57 — the ballistic test aims from the program's site (2026-10-08, economy session, QUEUE Q7)

`CT.ballistic` used to place its target `rg/600` radians from planet-fixed +X: the old 600 km radius (every range 2.1×
longer than stated) and from no particular pad. Now:
- the target is `alongAz(site.u, az, rg·1000/R)` from **the program's current site** (`curSite()`) when the offer is
  made: at sea, 300–900 km away, the stated distance exact (test: within 0.5 km);
- the contract keeps `p.site` and `p.sname`; the brief says "Launch from ⟨site⟩"; it **counts only when flown from
  that site** (`R.site`, v1.56): a ballistic test belongs to its range. Saved contracts without `p.site` count from
  anywhere;
- if no sea target is found in 200 tries (an inland site deep in a continent), there is no offer: `genOffer` now skips
  a generator that returns null. The old fallback put a target at a fixed point regardless of the site.

Test `econ-3` (3 checks, mutation-tested). The map marker (`app/render.js`) reads `c.p.u` as before.

## v1.56 — who may launch where: siteAccess (2026-10-08, economy session, QUEUE Q6)

The terrain session's launch gate (`siteAccessOf`, `sim/world.js`) now finds economy's **`siteAccess(site)` → `{ok, why,
fee, how}`** in `sim/program.js`:
- **our sites:** free;
- **a sea platform:** open to anyone, `SEA_FEE` = 4M a launch (a service);
- **a consortium member's site:** shared, free;
- **any other power's site:** leased, `LEASE` = 6M × (1 − ½ relation): 3M with the best friends, 6M at neutral,
  refused below relation −0.25 (`LEASE_REL`), and closed while that power sanctions the program (or home does);
- **nobody's land** (`power` null, not sea): refused, there is nobody to lease it from.

**Charged at launch** on `missionTick`'s launch line with hardware and operations; the record keeps `R.site` (the id)
and `R.siteFee`. The debrief lists *Site lease*, and now also *Sponsor covers the failed attempt* (v1.55's `R.cover`).
Two lines in `app/editor.js` (flagged for vehicle/flow): the over-budget check counts the fee, and the picker shows how
you'd use the site and the fee ("leased from X: 6M a launch"). Test `econ-2` (6 checks, mutation-tested).

**Not yet:**
- dispatched flights (`orderDispatch`) don't charge a lease: procedures fly from where they were recorded; when a
  procedure's site is abroad, charge it there;
- overflight politics (`site.downrange.over`), westward launches, sites closed by a war (relations already cover the
  slow version), a lease line on budget day for a standing lease;
- contracts that name a site (Q7 is next: the ballistic target from the flight's site).

## v1.55 — a failed attempt at the next step is mostly covered (2026-10-08, economy session, W12)

Caio answered W12 with option 1 (below). **Built:** `coverLoss(s,R)` in `sim/program.js`, called in `missionEnd`'s books
after refurbishment and before the floor check. A flight gets `COVER` = 75 % of its loss (price − refurbishment) back when:
- it flew **the priciest rocket yet** (`PROG.recs.maxCost`): that's how the game tells an attempt at the next step,
  since nothing names a flight's target (the proposal's "the flight names its first" turned out to need a target picker
  that doesn't exist);
- it came to nothing: no first, no contract, under a quarter back as refurbishment;
- the sponsor hasn't covered one in this epoch yet. The epoch is **the newest one with firsts open**, not the oldest:
  epoch-1 firsts (air, range) stay open while you go for orbit, and keying to them let an early lost loads flight use up
  the orbit's cover (caught by the runner, `WHY=1`).

The sponsor is named in the news: the home government, investors, or the member states. State in `PROG.recs.cover`
(a new game already resets `recs`; no app change). Test `econ-1`, mutation-tested (the epoch key, the first rule).

**Measured** (`PACE=1 FAILFIRST=orbit node career.mjs 2 5`; before → after): flights to orbit 6–10 → 5–8; bailouts before
orbit 1.0–4.6 → 0.2–2.0; companies in poor worlds reach orbit in 4 of 5 runs (were 2–3 of 5). The runs that still don't
are repeated orbital losses (only the first is covered) in a frugal or resource world, where cheap work barely pays:
the *pay floors by world* follow-up. With no forced failure: 4–6 flights to orbit, as before.

## Epoch 1–2 pacing for a new player, measured (QUEUE Q44, 2026-10-08, economy session)

No game code changed: this is a measurement, a runner fix, and a proposal waiting on Caio (QUEUE **W12**).

**The runner's new pacing report.** `PACE=1 node career.mjs 2 5` prints, per archetype × start: runs that reach
first orbit (beeper or passenger orbiter), flights and days to it, the longest stretch with nothing worth flying,
bailouts before orbit, and the lowest funds. `FAILFIRST=orbit` makes the first orbital attempt fail (the worst single
failure: ~75–85M, nothing comes home); `FAILFIRST=1` fails the first try at every first. `TRACE=1` prints the
pre-orbit decisions; `SEED0`, `ARCHS` and the starts argument narrow a run. Two experiment knobs, runner-only:
`BONUS=` adds to the starting funds, `KEEP=` refunds that share of a failed first's cost.

**A runner fix that changes its old numbers a little.** The scripted player valued a flight as pay − price and ignored
refurbishment (65 % of what lands whole). It turned down sounding contracts that really break even, and a company at
the floor waited for ever. It now learns the average refund per kind of flight from its own flights.

**The numbers (2 years, 5 seeds, prices: weather 18M, hop 28M, beeper 71M, orbiter 74M; start 80/90/80M):**

| | flights to orbit | day | bailouts before orbit | worst case |
|---|---|---|---|---|
| no forced failure | 4–6 | 119–255 | 0.6–2.0 (agency, consortium) | resource company 6 flights, day 639 |
| **first orbital attempt fails** | 6–10 | 184–428 | 1.0–4.6 | **frugal company: 2 of 5 runs never reach orbit in two years** (wait 160 d); resource company 3 of 5 |
| …with `BONUS=80` | 5–9 | 163–377 | 0–2.8 | frugal company still 3 of 5 |
| …with `KEEP=0.5` | 5–8 | 163–340 | 0.4–2.2 | frugal company 3 of 5 |
| …with `KEEP=0.75` | **5** (frugal company 7) | 163–349 | 0.2–1.0 | frugal company 5 of 5, wait 60 d |

**What it says:**
- With no failures the first hour is fine: about five flights to orbit.
- **One failed orbit attempt breaks it.** The orbital flight costs 90 % of the starting money and nothing comes back.
  Agencies are bailed out again and again; the bailout tops up to the 25M floor, which is not enough for any
  orbital flight. A company's rescue loan also lifts it only to 25M, and then the sounding work it can afford
  barely breaks even, so in a poor world (frugal, resource) it grinds for months or never gets back.
  The QUEUE criterion "nothing unaffordable after one failure" fails.
- **More starting money doesn't fix it.** The player spends it on the earlier steps, and still arrives at the orbital
  attempt with about one flight's worth.
- **Covering most of a failed first fixes it.** With 75 % back, every start reaches orbit in five flights except the
  frugal company (seven).

**Proposed (W12, default if Caio is silent: the first option):**
1. *A failed first is mostly covered, once.* The first time a flight aimed at an open first is lost, the sponsor pays
   back 75 % of its price: the government for an agency ("the program learns, the minister signs"), investors for a
   company (an insurance-like milestone clause), members for a consortium. Once per first, with news. Needs the
   flight to name the first it's going for (the builder's target picker, or the open first the stack can satisfy).
2. *The rescue lifts to the next step,* not to the 25M floor: lend the price of the cheapest open first. Bigger debts.
3. *Leave it hard,* and say so on the screen before the attempt ("a loss leaves you X").

The frugal company's grind (cheap work that doesn't pay in a poor world) is a second, smaller problem: contract
pay floors by world. A follow-up under *Proposed*.

## v1.54 — the ground of every body, slice G1: the layer, no new relief (2026-10-08, world session)

The first slice of [`GROUND.md`](GROUND.md) (QUEUE Q86 + Q18's plan). Every "is this Tellus?" test of the ground is now a
lookup of the body's **`ground` recipe**, so Selene, Nyx and the SYSTEM.md bodies can get relief with no further edits to
the physics. Nothing changes in play: Tellus is as before, and every other body is still a smooth sphere.

- **The recipe** (`sim/world.js`, before `groundAlt`): `b.ground = {gen, top, sea}`. `gen` names a height function in
  `GROUND_GEN` (metres above `b.R` at a planet-fixed point), `top` bounds it from above, and `sea` is an optional
  liquid level: what comes down below it floats. No recipe means a smooth sphere. `TELLUS.ground = {gen:'tellus',
  top:TERR_TOP, sea:0}`.
- **New:**
  - `bodyH(b, pf)`: the solid ground, sea floor included;
  - `bodyTop(b)`;
  - `seaAt(b, pf)`;
  - `groundAlt` is now `max(sea, bodyH)` when the recipe has a sea, `bodyH` otherwise. That allows ground below `b.R`
    (crater floors).
- **Now dispatched:**
  - `terrainSlope` and `groundNormal` (and `b.R` instead of `TELLUS.R`);
  - the sea checks in contact and splashdown (`seaAt`), and the rover's spot check;
  - the early-outs in `groundContact`, `groundCheck`, debris and `fall` (`bodyTop(b)` instead of `TERR_TOP`);
  - `MOON_PE`, now a margin above the moon's `bodyTop`;
  - the camera clamp and the ship's shadow plane (app/render.js).
- **Left on purpose:**
  - `surfaceAt` (the moons' `SURF_MOON`) and the biome code: G2 gives recipes their own surfaces.
  - The radar readout's 20 km band (`TERR_TOP + 20000`, UI only).
  - The shader: G3.

**Tests:** `ground-1`, 3 checks:
- neutral: Tellus's ground matches `terrainH` clamped at the sea at 2,000 points, and every other body is a sphere;
- live: a test recipe on Selene (a 500 m plateau rising north at 20°) holds a pod at 500.00 m, and reads 20.00° as slope
  and as the normal's tilt;
- a recipe's liquid level.
Three mutations (a Tellus-only `groundNormal` or `terrainSlope`, a contact early-out without `bodyTop`) each fail it.
Full suite: 436 pass, 0 fail.

**Next:** G2, Selene's baked map and crater bands on the CPU (GROUND.md § Slices).

## v1.53 — the ladder's balance: Nyx is found by looking; the pay floor (2026-10-08, economy session)

This answers the bodies session's note in "The ladders, proven with real rockets" (QUEUE Q8, W1). Both choices were Caio's.

**Why nyxfind came free.** Nyx orbits *inside* Selene's orbit (8,100–27,900 km), so a lunar transfer crosses its region.
The question was how long each kind of flight spends above the 1e-3 residual on the Tellus leg (scratch measurement,
procedure-flown ladder flights, 3 days each):

| Flight | Time ≥ 1e-3 | Longest stretch | Peak |
|---|---|---|---|
| farside (slow, sun-timed transfer) | 22.7 h | 21.3 h | 1.5e-2 |
| selimp, selland (~18 h transfers) | 0 | 0 | 8e-4 |
| nyxfind (to Nyx) | 17.7 h + time inside Nyx's SOI | 8.8 h | 0.23 |

Circular orbits over 72 h, across 8 Nyx phases, spend 8–18 h above 1e-3 at 15,000 km, 21–43 h at 25,000 km and 29–52 h
at 30,000 km. **No threshold or duration separates a slow lunar flight from a deliberate high orbit**: they cover the same
ground. Raising the hours to 24 would have excluded farside by 1.3 h, which is too fragile.

**The rule: Nyx is found only by looking.** A flight is tracked closely enough only if it was launched while "Something
out there" was open: `R.nyxLook`, set in the launch line from `missionOpen`. The farside flight launches before nyxfind
opens, so it can't find Nyx in passing. Any flight launched after farside can, including a slow lunar flight flown with
that goal. One condition was added to `outThere`'s tracking line (bodies' code, flagged there).

**The pay floor.** The full cost of a flight is vehicle + `OPS_FIX` + `OPS_FRAC`·vehicle. At fresh-program prices:
Probe 175M, Sample Return 242M, Crewed Lunar 334M. Epochs 2–3 pay about 1.5× (orbiter 100 for 65). Five of the
epoch 4–5 firsts paid *less* than the rocket proven to fly them:

| Mission | Was | Ratio | Now | Ratio |
|---|---|---|---|---|
| farside | 150 | 0.86 | 230 | 1.31 |
| selimp | 120 | 0.69 | 230 | 1.31 |
| nyxfind | 120 | 0.69 | 230 | 1.31 |
| nyxfly | 150 | 0.86 | 230 | 1.31 |
| crewaround | 300 | 0.90 | 440 | 1.32 |

The others already cleared the floor: selland and nyxorb 1.43, nyxland 1.71, selsample 1.65, crewland 1.80. **Rule:
each first pays at least 1.3× the full cost of the cheapest proven vehicle, fresh.** test.mjs §23 checks it for every
Selene and Nyx mission against the preset that flies it. A new mission, or a price change that breaks the floor, fails
there. The ladder is flatter at the bottom now (four missions at 230), because they all fly on the same Probe. A
smaller impactor or flyby preset would let the rule spread them out again.

**Found while checking:** the nyxfind ladder flight also completes **nyxfly**. It enters Nyx's SOI with a camera and
antenna before the 12 h of tracking finish; once nyxfind is done, nyxfly opens and `R.nyxFly` is already set. That is
two firsts, 460M, on one Probe. It is the same pattern as above, generalised: chained missions completing on one flight
(lift1 + lift2 on a 2 t flight does it too). It is left as it is, pending Caio: should a mission count only on a flight
launched while it was open?

## v1.52 — the atlas: biomes, borders and coasts on the map (2026-10-08, terrain session)

Open thread 5 of § v1.25: make the generated geography readable in play. **C** in the map cycles biomes → powers → off
(remembered in `localStorage` `launchpad-atlas`). Tests in `test.mjs` §37e.

- **The grid** (SIM, `ATLAS`): biome id and power of every point on a 1024×512 equirectangular grid, the city
  texture's layout (x = `atan2(z, x)` from −π, y = latitude from the south pole; `atlasU`/`atlasXY` convert).
  `biomeAt` + `powerAt` cost ~5 µs a point, so the bake is ~1 s in node and ~1.5 s in the page. It runs on first use,
  6 ms a frame (`atlasBake(ms)`), with "Atlas: surveying n %" on the map meanwhile.
- **Lines** (`atlasLines`): marching squares on every 2nd grid point. In each cell, the edges whose corners differ
  (land/sea for coasts, two powers' land for borders); two such edges make a segment, any other number meet at the
  centre (triple points, a border reaching the coast). 10,335 coast and 616 border segments on the default world.
- **Names**: each power's name sits on its own land nearest the area-weighted centroid of that land (the plain
  centroid can fall at sea or in a neighbour, for crescent-shaped land).
- **Rendered map** ("modern look"): the planet shader samples `uAtlas` (texture unit 3) and mixes it over the
  ground *after* the clouds, which thin to 15 % under it (`uAtl`). It's lit 50–100 % by the sun so the night side
  stays readable. The texture is rebuilt from the grid when the mode changes (`atlasTex`): biome colours
  (`BIOME_INK`) with light borders, or power colours (their `hue`) with dark borders; coasts dark in both. There's a
  biome legend bottom-right.
- **Notebook and terminal maps**: coasts in the main ink, borders dashed in the second ink (`atlasInk`, one call in
  `drawEraMap`). The planet must be at least 25 px across. Points are culled in the planet frame (u·cam > R) and
  `fromPF` is inlined: ~2 ms a frame for ~3k visible segments (4.6 ms before inlining).
- **Readout**: point at the ground and a box names the biome, the power (or "unclaimed") and the height, or the sea's
  depth, with latitude and longitude. It uses the live `atlasAt(pf)`, not the grid. The pointer is kept in CSS pixels
  because the canvas resizes with the render scale (`RS`): stored canvas pixels drifted ~20 % from the pointer.
- **Checked in the page:** at the pad (0°, 0°) the readout says rainforest · United Provinces of Fenfen · 157 m,
  the same as headless `atlasAt`.

**Negative results / limits**
- A raster border is ~3.7 km a pixel: crisp from orbit, but it steps when zoomed onto a coast. The ink maps use the
  smoother marching-squares lines.
- Overlay text sizes follow `devicePixelRatio`, not `RS`, like every other map label. When the render scale drops,
  the legend and names grow on screen. That's shared with the existing labels; not fixed here.
- Ice dominates the poles and high ranges (§ v1.25 open thread 3), and the atlas makes that obvious.

**Next on this line:** pencil hatching for biomes on the notebook map; contracts and site picking that use the
readout (click to choose a station site, § v1.48 next item 2).

## v1.51 — spin stabilisation (2026-10-08, control session)

The fourth slice of the control review. The rotation step applied τ/I and nothing else: Euler's equations were missing
their gyroscopic term (ω×Iω). So a spinning stage turned to every torque as if it weren't spinning, never wobbled, and
kept its angular momentum only to ~1 %. Spin is how stages were held before guidance could (Explorer 1's cluster, the
Vanguard and Delta third stages, the PAM kick stages), so in the gyro era it is a real tool.

**What changed**
- **Euler's equations** (`integrateRot`): in the body frame I·dω/dt = τ − ω×(I·ω), integrated RK4, cut into substeps of
  ≤ 0.05 rad (`ROT_STEP`) when spinning fast; the attitude turns exactly by each substep's ω (it was a first-order
  quaternion step). The rails attitude step goes through the same function.
- **Spin-up motors** (`spin`, *Control*, 0.03 t, 1 M): a ring of small solids, 4,000 N·m·s in 1 s about the axis, ~2 rev/s
  on a 1.25 m kick stage. They fire with the event that lights their stage, or, on a stage without engines, the
  separation that releases it: whichever leaves it the bottom stage (`spinFire`, from `stage`). Never at a booster
  separation.
- **SAS on a spun stage** (`s.spun`, set when the motors fire): the rate loop leaves the roll alone, so it damps the
  wobble (a nutation damper) instead of eating the spin. A roll key under SAS hands the roll back and SAS spins it down;
  below 0.5 rad/s it is an ordinary vessel again.
- **Time warp past 4×** keeps a spin about the axis (spun, or SAS off and ≥ 1 rad/s): the wobble is dropped and the axis
  stays put. Everything else still stops turning on rails, as before.
- **HUD** row *Spin* (rpm, the wobble's cone angle). **Builder:** the Control block gives each spin motor's rpm on what
  is left when it fires (tanks full), and warns under 60 rpm.

**Measured** (`study_spin.mjs`: a Probe core + Tank 1 t + Petrel kick stage in orbit, its thrust 0.5° off the axis,
burned to empty, 46 s)

| Spin | before: axis off at burnout · Δv off | now: axis off · Δv off | now, SAS on |
|---|---|---|---|
| none | 119° · 49° (tumbles) | 121° · 44° | — |
| 0.5 rev/s | 85° · 2.8° | 12° · 5.5° | |
| 1 rev/s | 74° · 0.54° | 3.2° · 1.3° | 0.9° · 0.01° |
| 2 rev/s | 61° · 0.11° | 1.1° · 0.34° | 0.26° · 0.00° |
| 4 rev/s | 41° · 0.03° | 0.2° · 0.09° | |

Free spin at 2 rev/s for 60 s: angular momentum kept to 0.017 % (was 0.83 %); the wobble turns at 6.186 rad/s in the body
frame, Euler's (I_axis − I_side)/I_side × spin to four figures (was 0). Spin motors on that stage: the builder says 121
rpm, flown 122. Physics step: no change beyond noise (Lunar / Heavy 73–81 / 82–89 µs, back to back).

**What it taught**
- **Spin already half-worked without the physics, which hid the gap.** A body-fixed torque that turns with the stage
  averages out, so before the change the Δv still went roughly straight at 2–4 rev/s while the axis itself wandered
  40–60°. Only measuring the axis, not just the Δv, showed the gyroscopic term was missing.
- **The wheels' stored momentum had to stay out of the gyroscopic term.** With it in (the textbook ω×(Iω + H)), three
  capsule checks failed: a max-q abort, a crew landing on Nyx, and a plateau landing at 146 m/s under a full main. A pod's
  100 kN·m·s is a gameplay budget (v1.43), about twenty ISS gyroscopes; as a real gyroscope it pinned the capsule against
  its chute. Real pod numbers (~1–5 kN·m·s) would make it harmless, but that is a v1.43 retune, not this slice. The cost:
  angular momentum isn't conserved while wheels hold momentum, as before.
- **The SAS rate integral leaked the spin away.** It sums in the inertial frame, and on a coning stage that sum picks up
  a roll part: 22 % of a 1 rev/s spin went into the wheels over one burn. The SAS's roll output is now zeroed whole on a
  spun stage, integral included.
- **SAS on a spun stage helps more than spin alone** while the engine burns: the rate loop damps the wobble and steers
  the gimbal, so the Δv error falls from 1.3° to 0.01° at 1 rev/s.

**Not modelled:** energy dissipation, so no Explorer 1 flat spin (a spin about the long axis is stable here forever);
yo-yo despin; spinning anything but about the long axis; products of inertia (the diagonal is kept, as before).

**Tests** section `control-4` (3 checks): a free spin keeps its angular momentum and wobbles at Euler's rate; the
misaligned kick stage tumbles unspun and flies within ½° spun, and SAS keeps the spin; the motors fire at the right
separation, at the builder's rpm, warp keeps the spin, a roll key takes it back. Mutation-tested: dropping the gyroscopic
term fails the first two; dropping the roll guard fails the second.

**For other sessions**
- **everyone flying scripted vessels:** `integrateRot` changed (exact attitude step, gyroscopic term). Every check still
  passes; tapes are retired by the fingerprint as usual (`spinFire` added to it).
- **visuals:** `spin` draws as the default banded drum; it could have its nozzles. A spinning stage now actually spins on
  screen at up to several rev/s.
- **economy:** `PRICE.spin = 1`, `tierOf` gives it 1.
- **builder:** `spin` is in *Control* by kind.

### v1.51.1 — the wheels won't spin a vessel apart (PLAYTEST #18, #23)

The robot playtester held a pitch key with SAS off: the Orbiter's upper stage reached 23 rad/s in 9 s and tore the pod off
its tank, with the wheels only 89 % full. A bare pod: 66 rad/s in 2 s, chute torn off; without the fix it goes on to
500 rad/s. 100 kN·m·s of storage (v1.43) is tens of rad/s on a light stage, so storage never ran out before the structure.

- **The wheels' controller won't drive the vessel past `WHEEL_W`** = 1 rad/s in pitch and yaw, 3 rad/s in roll (body
  axes; `wheelGive`). Torque that would turn it faster that way is cut to what reaches the limit exactly (at a pod's
  55 rad/s² a plain cut-off overshot to 1.3 rad/s); slowing down is never refused. In effect the storage is sized to the
  vessel (≤ I·WHEEL_W from rest), which is the playtest's first suggestion, without per-vessel magic. SAS never asks for
  more than 0.6 rad/s, so nothing it flies changes; big stacks still run out of storage first (Orbiter 0.512 rad/s, full).
- Gimbal, fins and RCS are not limited: they spin a stage only while burning, in air, or on gas.
- **Builder wording (#23):** the negative-stability note shows only when a margin is negative, and now names steerable
  fins too; "Roll nothing" drops the kN·m.
- Tests: section `control-5` (1 check, mutation-tested: without the limit, 60 and 503 rad/s).
- The wheels' momentum is still left out of the gyroscopic term: the limit bounds what the keys put in, not what SAS
  stores against a steady aero torque (a capsule under its chute), which is where it did harm.

**Next on this line:** energy dissipation (flat spin) and yo-yo despin if spun payloads become a thing; the gimbal and fin
deflections drawn (visuals); a pitch programmer for the gyro era if row 101 says ascents are a chore.

## v1.50 — deviation: a dispatch that can't meet its goal hands the flight to you (2026-10-08, economy session)

The handover from "Dispatch — the economy's answers". Deviation instead of bare failure: the flight calls for you.

- **The state is a registry entry** (stack, the parts still on with their propellant, staging state, r, v, epoch,
  attitude), the format `vesselOf` already rebuilds for flyable vessels (sats session, A2). The physics side's
  `dispatchRun` returns `{deviation: {kind, why, entry}}`; tests and tools can stand in through `HOOK.dispatchRun`.
- **Time stops for it.**
  - A deviated dispatch shows at the top of the Inbox's "Coming up": "⚠ … [Take control] [Let it go]".
  - `advanceTo` won't move while one waits, and stops as soon as one appears.
  - If time moves on anyway (a hand-flown launch), it's lost: "nobody was at the console".
  - The contract stays open either way.
- **Take control** (`takeDeviation`, app): the flight is rebuilt **at the moment it deviated** (not rounded to a whole
  day, unlike `flyEntry`). It's yours from there; flying it to the contract's orbit pays as usual.
- **No revert** on a handed-over flight (`R.noRevert`): the Revert button (and the Esc menu's, which calls it) refuses,
  so dispatches can't be re-rolled. Caio: more punishing than KSP, on purpose.
- **The interim resolver now deviates too**, until the physics side's real runs:
  - The estimate keeps its parts: margin, structure, the ascent's ignitions, and the top stage's relight.
  - A structural break-up or an ascent ignition failure is a loss.
  - **Fuel short of the margin** and **a failed relight** are deviations. `devState` builds their state: the top
    stage alone at apoapsis on the ascent's transfer orbit, periapsis 30 km (in the air), with the propellant to
    circularise plus its margin ('relight') or 60% of what's needed ('short').
  - Measured: 150 km apoapsis needs 74 m/s; relight case 2,249 m/s aboard, short case 45.
  - With an unknown Petrel and everything else well known, 400 seeds: 348 in orbit, 27 handed over, 25 lost.
- **Checked in the app:** a deviation in the Inbox; waiting refuses; Take control puts the top stage at 150 km
  (periapsis 30 km) on the flight screen; Revert answers "No revert: this flight was handed over from a dispatch". No
  console errors.

`test.mjs` §39: 4 new checks: the handed-over state; time stops and won't move; ignored, it's lost; the interim
resolver's handovers.

## v1.48 — geography in play: stations on real ground, recovery, disasters and field science (2026-10-08, terrain session)

Slices C–E of the geography plan (§ v1.25). All SIM-side; tests in `test.mjs` §37b–37d.

**C. Ground stations on real ground.**
- `gsMask(st)`: each station's horizon, cached per station. 36 azimuths, the highest elevation of the ground out to
  `GS_REACH` = 300 km (24 samples, with the planet's curve), seen from a `GS_MAST` = 20 m mast on the station's ground.
  `gsSees(st, pf)`: above `STA_MIN` *and* above the mask in that direction. A valley station loses the sky behind its
  mountains; a hilltop one sees more. This replaces the sea-level sphere test everywhere contact is decided: imagery
  contact time and downlinks in `satTick` (planning/sats code: the two `gsSees` calls are the only change there).
- `linkOf(s)`: the flight's own link. Deep space counts as linked (no deep-space network yet), on the ground too;
  re-entry plasma (`qHeat > BLACKOUT_Q` = 5e4) blacks it out; otherwise the first station in view. HUD row "Link"
  (the station, or the reason and "· recorder").
  **Fix (QUEUE Q17, PLAYTEST #17):** the heat alone blacked out ordinary climbs. Dense air reaches 50 kW/m² at only
  ~1 km/s (the Heavy at Mach 3.5, 20 km). Now `plasmaOn(s)` also needs airspeed over `PLASMA_V` = 0.65 × circular
  speed at the top of the air (~2.2 km/s; the shuttle's blackout ended near 5 of 7.8 km/s). Measured headless: hot
  ascents peak at 1.1–1.7 km/s (Orbiter, Heavy, Asparagus); an orbital entry is hot from 3.1 down to 1.1 km/s and
  still blacks out for its fast part. aerofx's plasma shell (Q20) can use `plasmaOn`/`PLASMA_V` for the same line.
  test.mjs §37f.
- Telemetry follows the link. Strain data (`R.sf`, the certification feed) is written only while linked; out of
  contact it goes to the recorder `R.sfRec`, which `missionEnd` merges into `R.sf` only if the instrument package came
  home (`R.recSci`). Economy: that one line before the cert loop is the only change in `missionEnd`'s certification.

**D. Recovery.** `recoveryOf(s, R)` → `{factor, kind, why}` for a landed ship on Tellus:
- At sea: recovered if within reach of the launch point: `RECOVER_LOCAL` = 200 km of local boats, or the economy's
  recovery fleet range `FAC.fleet.range[lv]` when built. Beyond that, lost (factor 0).
- On land: home or unclaimed land, fine. Another power's land: relation ≥ 0 returns it; −0.2…0 returns it worn (0.8);
  worse, they keep it.
- Hook (economy code, `missionEnd`'s refurbishment block): the refund is scaled by `rc.factor`, `R.recovery` = the kind,
  and a news line explains it. Not modelled: recovery taking days.

**E. Geography in the work.**
- Disasters follow the land: `cityGround(c)` samples the biome at a city and on rings at 25/60/120 km; `HAZ` says which
  disasters fit (floods: coast within 60 km, wetland or very wet; wildfire: taiga, temperate forest or savanna;
  volcano: volcanic ground; storm: warm coast; locusts: steppe, grassland, savanna or hot desert). `disCities(dis)`
  memoises the eligible cities; `satTick` now picks a disaster kind that has cities, then one of its cities (same two
  `R()` draws as before). On seed 13: floods 20/32, wildfire 26, volcano 5, storm 8, locusts 28.
- Two science contracts in `CT` (additive; economy owns the table):
  - `field`: land an instrument package on a given biome and recover it. `fieldBiomes()` lists ice, cold desert,
    rainforest, hot desert, alpine, volcanic, salt flat and wetland if one lies within 1,200 km of the first site (not
    the pad's own biome), with the distance; pay 10 + km/25. Uses `R.landBiome`, set at landing in `missionTick`.
  - `aurora`: an instrument package above `AURORA_ALT` = 100 km poleward of `AURORA_LAT` = 55°, recovered (`R.aurora`,
    set in `missionTick`). Pay 14 + (km to the zone)/40: from home that's a 1,200 km lob, or a high-latitude site.
- Adding CT types shifts every seeded offer board (more types to draw from). One of my tests read `news[0]`; it now
  searches the news. If another session's test pins a specific offer, that is why.

**Next on this line:** recovery that takes days and a recovery ship to send; stations bought at a chosen site (the mask
makes the choice a real trade-off); ~~the atlas view~~ (done, § v1.52).

## v1.47 — dispatch, the economy side (2026-10-08, economy session)

The first slice of dispatch (decisions: "Dispatch — the economy's answers"). A contract flown by a stored procedure,
without you.

- **What can be dispatched:**
  - satellite and recon contracts (`DISPATCH_TYPES`), for a design with an orbit procedure in `PROG.procs` (so it
    flew to orbit by hand);
  - the design must be able to do the contract (its payload), checked with the contract's own `ok`;
  - missions (the firsts) are never dispatched.
- **The risk estimate** (`dispatchEstimate`), from the part data:
  - **margin:** the design's vacuum Δv − the procedure's Δv − the extra for this target (circular-speed difference
    from the procedure's orbit, plus the lost rotation boost for inclination), through a logistic around 40 m/s;
  - **ignition:** every engine's odds as `igniteOK` computes them (know-how, development, line maturity); the top
    stage lights twice;
  - **loads:** 2% × (1 − certification) per part.

  The range widens with average uncertainty (1 − certification, 1 − know-how). Measured: unknown parts 90%
  (67–100%), well-known 100% (99–100%).
- **Pads are reservations** (`padsFree`, `padWait`):
  - one pad, plus the new **Launch pads** facility (80M then 160M: 2, then 3 pads);
  - a dispatch takes the earliest free pad and stacks for the same days as a hand-flown launch;
  - **a hand-flown launch waits for a free pad too** (`R.padWait`, before stacking).

  Measured: two dispatches on one pad launch on days 36 and 63, and a hand-flown launch would wait 53 days; with a
  second pad the third goes at once.
- **Resolution** (`dispatchTick`, on the timeline as "Dispatched launch"):
  - on launch day the weather can scrub it, a day at a time, as for any launch (`siteWeather`);
  - if money is short it's held 10 days;
  - otherwise it pays the same launch costs, counts as a flight, uses production-line units and teaches know-how;
  - the flight comes from `dispatchRun(D, vessel, contract)` if the physics side has defined it;
  - success builds a flight record with the orbit and runs `contractEval` (same pay, same precision bonus);
  - a contract already completed by another flight stands the dispatch down (one orbit can complete several).
- **The seed** is fixed when the dispatch is ordered, so the same state gives the same outcome; no re-rolls.
- **Interim resolver** (`dispatchRoll`): until `dispatchRun` exists, the estimate is rolled with the seed, and the orbit
  is scattered by 3 km + 40 km × `predErr` (the compute era).
- **UI:** each active contract shows its best dispatch option ("success ~90% (67–100%), launches in N d on pad 1, cost
  [Dispatch]"), or why there's none. News on ordering, launch and outcome.

**For the physics side (bodies):** `dispatchRun(D, v, c)` should return `{ok, orb:{pe, ap, inc, sci, cam}, dv, why}`,
or a deviation (planned: `{deviation: {t, why, state}}`, which the economy will turn into a timeline stop that hands
you the flight). `D` carries `stack`, `seed`, `launch` and `pad`.

**Weather and auto-resolve** (Caio's concern). Weather here is deterministic: `cloudAt(place, time)` from the world seed,
and today it only scrubs launches. A dispatch launching on a given day sees the same weather whether watched or
auto-resolved. The rule that keeps it so: **every random factor in a flight is a function of the world seed, time and
place, or of the dispatch's seed**, never a fresh random number. Winds aloft, if they come, would follow the same rule
and the procedure would fly through them in both modes.

**Deviation, and whether "can't meet its goal" is computable** (Caio). It mostly is, with flight rules: thresholds at
checkpoints, as real missions use.
- **Δv to go vs Δv left** (`dvRemaining` already gives the latter): if what's left can't reach the goal from the
  current orbit, it deviates.
- **A corridor around the procedure's own recorded profile** (velocity and flight-path angle against altitude): leaving
  it beyond a threshold deviates.
- **Events:** an engine that didn't light, staging out of order, structural failure.
- A failure is just the extreme of deviation. Since the run *is* the simulation, the deviation happens inside it, at a
  time, with a state; nothing is rolled separately. The thresholds set how forgiving it is. A threshold the player sets
  ("hand over / abort / carry on") is a possible later option.

`test.mjs` §38: 3 new checks: estimate from part data; pads; outcome, pay and seed.

## v1.46 — avionics generations: SAS grows with the computing eras (2026-10-08, control session)

The third slice of the control review. The NOTES' eras idea ("early guidance computers have stability-only SAS") on the
compute eras of v1.38. Caio's choice: **two steps by era**.

| Avionics | Comes with | SAS modes | Loop (gain · fastest turn · deadband) |
|---|---|---|---|
| Gyro autopilot | human computers (year 0) | Stability only | 2/s · 0.3 rad/s · 0.5° |
| Analog autopilot | mainframes (year 3) | + Prograde, Retro, Normal, Anti-normal, Radial in/out | 3/s · 0.45 rad/s · 0.2° |
| Guidance computer | onboard computers (year 7) | + Maneuver, Target, Anti-target, Relative pro/retro, Docking | 4/s · 0.6 rad/s · 0 |

- The program's era is `compEra()`, so a power that lags in computing gets each step later (up to 4 years).
- `s.av` is fixed when the vessel is made (`avNow()`), and a vessel split off keeps its parent's. With no program running
  (sandbox, physics tests: `khOn()` false) it is the guidance computer, and so are ground-guided procedures (`s.proc`):
  nothing that existed before changes outside a career.
- A mode the avionics lack holds the attitude (`sasTarget`). In flight those buttons are dimmed, with a tooltip naming the
  generation and era that bring them; *SAS → node* explains instead of switching. The builder's Control block opens with
  the flight's avionics and what comes next.

**Measured** (90° turn in vacuum under SAS; how tight it holds after settling)

| | gyro | analog | computer |
|---|---|---|---|
| Bare pod (wheels) | 5.6 s | 3.7 s | 2.8 s |
| Orbiter, first stage lit (gimbal) | 5.1 s | 4.0 s | 3.5 s |
| Orbiter on wheels alone | 11.2 s, ±0.30° | 11.4 s, ±0.11° | 11.5 s, ±0 |
| Lunar on wheels alone | 53.9 s | 54.1 s | 54.2 s |

**What it taught**
- **The loop only shows where authority is spare.** Big stacks on wheels turn at the limit of their torque and wheel
  storage (peak 0.23 rad/s on the Orbiter, under even the gyro's 0.3), so all three generations turn them alike and the
  difference is how tightly they hold. On a pod or under a gimbal the generations separate 2×.
- **The modes are the real gate.** In the first three years an orbit is flown on Stability plus the pitch keys
  (re-aim the hold as the flight path bends), and a capsule comes home shield-first because it is stable, not because
  SAS holds retrograde. That is how Vostok and Mercury flew.

**Tests** section `control-3` (3 checks; numbered §37, then §39, until v1.46.2): the generation follows the era (and the sandbox gets the best); the mode table, "prograde on a
gyro holds", the pod's turn time ratio and the gyro's deadband; a gyro-era satellite loaded back from the register
still flies its gyro. 315 pass.

**For other sessions**
- **economy / planning:** `AV`, `avNow()`, `avOf(s)`. A facility, import or purchase that buys better avionics early
  would set `s.av` (or move `avNow`). Registered vessels keep theirs (`vstOf` stores `av`, `vesselOf` restores it;
  entries from before v1.46.1 get today's).
- **tester:** *All tools* also gives the best avionics (`avNow`); the epoch picker doesn't move the date, so without it
  a tester at epoch 4 flies a gyro.
- **ui:** locked SAS buttons are `disabled` with a `title`; the SAS toggle's title names the avionics.
- **anyone writing career flight scripts:** in a program before year 3, `sasMode='pro'` holds the attitude.

## v1.45 — launch-site follow-ups: the sea platform, weather scrubs, the downrange warning (2026-10-08, terrain session)

The three follow-ups listed in § v1.27.

- **The sea platform** (`kind:'sea'`, "Sea Platform"): one per world, on the equator in open ocean.
  - **Placement:** ≥ 300 km from any land, over ≥ 500 m of water, the spot nearest the home site. On seed 13: 4,751 m
    of water, 100% water downrange.
  - **It floats:** nothing is levelled under it (`terrainH` and the shader's `uSites` take land pads only), so there's
    no instant island. The deck is `SEA_DECK` = 12 m above the water.
  - **Drawn** as a deck on columns and pontoons (`seaHull`), with the launch complex on it. The deck covers the whole
    `PAD` mesh (x −256…86, z −194…80 m), so it's a big platform. A sea-specific complex (tower and table only) would
    be smaller; that's the visuals session's call.
  - **Who may use it:** the sea is no one's, so by default the platform is open to any program (a service, like Sea
    Launch). Economy's `siteAccess`, when it exists, can price or refuse it.
  - **Why it matters:** a power with no equatorial land (Ordun, Haval) can still reach the equator.
- **Weather scrubs:**
  - `siteWeather(site, T)` reads the cloud field the sky draws (`cloudAt`).
  - On the launch day `weatherHold(s)` slips the launch a day at a time while the pad is under storm-grade cloud
    (> 0.9), up to `SCRUB_MAX` = 5 days, with a news line.
  - It's called from economy's `missionTick` launch line, one hook: `{const n=weatherHold(s);if(n){R.day0=PROG.day;R.scrubs=n}}`.
  - The picker shows today's sky at the site.
  - At the home site storms scrub 18 of 400 days (4.5%).
- **The downrange warning** (`downrangeWarning(site)`) names the powers whose land lies under the site's corridor,
  other than ours and the host's (the host's own land is the host's business). Shown in the picker, and in the news at
  launch as a warning, not a block: the politics are economy's. On seed 13 one site is warned: Selhav Field II, over
  the Republic of Fentor.
- **Tests:** `test.mjs` §36, 3 checks (299 total after merging):
  - the platform's placement, deck and access;
  - a 2-day storm slips the launch exactly 2 days, while a clear day launches on time;
  - the warning names only other powers.

  §23 now levels land pads only.
- **Trap:** a weather slip moves the shared world seed (`PROG.wseed`) for every later test. §35 (the event timeline)
  had relied on a contract offer arriving by chance and failed; the bodies session hit the same fragility and made the
  same fix (rebuild the board if it's empty).
- **Next on this line:**
  - a movable sea platform (sail it to any latitude: polar launches from the sea);
  - weather by season and region (the storm belts of the climate map), not only the drifting cloud field;
  - winds aloft for max-q loads per site.

## v1.44 — staged pay for long missions (2026-10-08, economy session)

Long missions pay along the way (design: "Time, long missions and communication").

- **Missions to another body** carry a destination (`M.to`: the Selene missions, and Nyx flyby, orbit and landing;
  `M.crew` on the two crewed ones). Each pays:
  - **20% on course:** the flight's predicted trajectory enters the body's sphere of influence. Checked every 30 s
    of flight, and only once the apoapsis reaches 30% of the way out, so `predict` isn't run for ordinary orbits.
  - **20% on arrival:** inside the sphere of influence. If you arrive without the on-course share, both are paid.
  - **The rest on completion.** `missionComplete` pays its usual amount (race bonus and all) less what was paid
    along the way, never below zero. The total is unchanged.
- **Who gets the shares:** the first open mission bound for that body, in mission order. Crewed missions only on a
  crewed flight. Each share is paid once per mission, and an advance is kept if the flight then fails (forgiving).
- **State:** `PROG.staged[id] = {bound, arrive, paid}`, reset with a new program (and in the career runner).
- **UI:** news when a share is paid; the mission list shows "pays 20% on course, 20% on arrival (N paid)".
- **Later:** when missions fly in the background (sats registry), the same shares pay there, and cruise science and
  public interest join them. Long contracts can use `STAGE_PAY` the same way once there are contracts beyond Tellus.

`test.mjs` §36: 2 new checks.
- The Far Side pays +30M on course, +30M on arrival, 150M in all (the same as unstaged).
- Nothing is paid for a flight not bound anywhere, nor for crewed missions on an uncrewed flight.

## v1.43 — reaction wheels that saturate; the builder's control readout (2026-10-08, control session)

The second slice of the control review (v1.40). The pod's wheels were 8× a KSP Mk1 pod and never filled up, so they
steered everything. Now they are a resource.

**What changed**
- **Wheels store what they give** (`wheelGive`): the vessel gets τ and the wheels' momentum H (body frame) changes by
  −τ·dt. Past `hmax` they can't push that way. Pod and crew capsule 40 → **10 kN·m**, 100 kN·m·s; probe core 4 → **2 kN·m**,
  20 kN·m·s; parts without `hmax` store 10 s of their torque (`WHEEL_S`). The rails attitude step goes through the same
  limit.
- **They unload** whenever something else can hold the vessel while they spin down (time constant `WHEEL_DUMP` = 4 s,
  at most half that channel's authority). A burning gimbal or steerable fins unload them for free from 2 %. RCS spends
  gas, so it only keeps them usable: from 80 % down to 60 %. When there's no gimbal or fins channel, RCS also covers what
  saturated wheels can't give.
- **A reaction wheel part** (`rwheel`, *Control*, 0.12 t, 15 kN·m, 150 kN·m·s, 5 M) to stack where turning big things
  matters.
- **HUD row** `Wheels n% saturated` once they hold ≥ 5 %, with the hint of what unloads them.
- **Builder: a Control block.** Holding 5° off the airflow at max-q (25 kPa, M1.2), burning and coasting: what it takes
  against wheels + gimbal + fins + RCS, as **holds** / **weathervanes** (short of authority but stable) / **flips**
  (short and unstable). Roll authority by source. A 90° turn in vacuum on wheels (capped at storage ÷ inertia) and with
  the first stage lit (`controlReport`, `turnTime`). The old "controls can't hold 5°" line moved here and now counts fins.
  The no-wheels warning says what still steers.
- **Bug fixed from v1.40:** `partBody` picks meshes by part key, so `cfin`/`cfins` drew as plain cylinders. They now draw
  as the fins they are.

**Numbers**

| | v1.40 | v1.43 |
|---|---|---|
| 90° turn in vacuum on wheels, Orbiter / Heavy / Lunar / Crewed Lunar (readout; flown) | 5.5 / 7.3 / 21 / 38 s | **11.1 / 14.6 / 56 / 151 s** (flown 11.5 / 15.3 / 54 / 145) |
| Same with the first stage lit (gimbal) | 3.4 / 3.3 / 4.9 s | 3.5 / 3.4 / 5.0 s |
| Orbiter, pitch key held 30 s, SAS off | spins up without limit | levels off at hmax/I = 0.512 rad/s |
| Unloading from 90 %, holding attitude, 45 s | — | nothing: 90 % · burning gimbal: 2 %, within 0.31° · cold-gas RCS: 73 % for all 30 kg |
| Coasting at max-q, Orbiter: need / have | 18 / 40 kN·m (holds) | 18 / 10 on wheels (weathervanes); 264 with a steerable ring |
| Physics step, Lunar / Heavy (back to back) | 37 / 55 µs | 39 / 58 µs |

**What it taught**
- **Quartering the wheels broke no check.** Every scripted flight (ascents, aborts, the crewed Selene mission,
  docking, re-entries) steers on the gimbal while burning, and the capsules are aerodynamically stable shield-first. The
  wheels had been doing almost nothing the tests could see. Where they do matter is turning in vacuum, now 2–4× slower,
  and holding off the airflow while coasting.
- **Wheel storage, not torque, sets a big stack's turn rate.** With 100 kN·m·s on a 192 t·m² Orbiter the turn tops out
  at 0.51 rad/s; on the Crewed Lunar at ~0.03 rad/s, a 2½-minute 90°. The readout has to cap by storage or it is 3×
  optimistic for the big stacks.
- **Cold gas is a poor way to unload a pod's wheels**: 90 → 60 % (30 kN·m·s) is ~29 kg at Isp 70 with this lever. Hence
  the 80 → 60 % band: RCS keeps the wheels usable rather than emptying them, and a short burn is the cheap way.
- **Saturation in the air is hard to isolate.** Holding a rocket off the airflow, the airflow swings round to meet the
  nose (the vessel's own lift), so the needed torque fades and the wheels level off short of full. The clean tests are in
  vacuum.

**Tests** section `control-2` (3 checks; numbered §36, then §38, until v1.46.2): the saturated rate equals storage ÷ inertia; unloading by nothing / gimbal / RCS; the
readout's turn times within 10 % of flown ones, and the coasting max-q case on wheels vs a steerable ring. 280 pass.

**For other sessions**
- **ui:** the `Wheels` HUD row sits before the RCS row (`wheelRows`). The Control block is in `editorChanged`
  (`controlHTML`).
- **builder:** `rwheel` is in *Control* (one edit to `CAT`). It draws with the default banded drum.
- **visuals:** `rwheel` could use a look of its own.
- **economy:** `PRICE.rwheel = 5`, `tierOf` gives it 1.
- **anyone scripting flights in vacuum with big stacks:** turns on wheels alone are slow now; light the engine (the
  gimbal) or add RCS / a wheel part.

**Next on this line:** ~~era-gated SAS quality~~ (done, v1.46); the gimbal and
fin deflections drawn (visuals); a "kill rotation" / unload-now control if playtests want one.

## v1.42 — the event timeline (2026-10-08, economy session)

The first piece of the time model (design: "Time, long missions and communication"). Until now time only moved when
you launched: there was no way to wait for a building, a study or budget day.

- **`upcoming()`** gathers everything dated in the program:
  - trajectory studies, facility levels, the test stand and its campaigns, the design bureau, production lines;
  - budget days (every 100 days), elections, sanctions lapsing, the next computing era;
  - a day's warning before each contract deadline and each decision's expiry.
- **`advanceTo(day)`** (or the next event) moves the calendar event by event, so each one happens in turn. It stops
  early at events marked *stop* (deadline and decision warnings, elections) or when a new decision appears.
  - It steps a hair past each event (1e-9 days), so the event's own tick fires despite rounding.
- **UI:** a self-contained `timelineHTML()` section, "Coming up", mapped to the Inbox tab in `progTabOf`. It shows the
  next eight events with a Wait / Wait until then button each (`data-adv`).

  Checked in the app: from day 62, waiting until budget day landed on day 100 with the study done, the redesign done,
  the 17M budget in and new offers on the board, with no console errors.
- **Idle time is neutral** (v1.41): waiting costs nothing; funds only rise on budget days.
- **Not yet:**
  - launch windows and missions in flight (planning, sats, bodies);
  - a timeline view in the UI's own style (the section is a plain list for now);
  - offers expiring are deliberately left out (noise).

`test.mjs` §35: 4 new checks: listed in order; wait goes to the next event and it happens; a long wait stops a day
before a contract deadline; waiting never lowers funds.

## v1.41 — no daily overhead (2026-10-08, economy session)

Caio: idle time should be roughly neutral, with no upkeep. `OVERHEAD` and the new `OVERHEAD_CAP` (per unit of capacity)
are both 0 (were 0.06 and 0.015 M/day); the code path stays, so it can be tuned later.

Career runner (agency, 6 years, 5 seeds), lines-only:
- final funds rise by ~300–800M;
- top-ups roughly halve (resource 9.4 → 2.8, frugal 9.8 → 4.6, rising 6.6 → 3.0).

With the investor (`all`), strong programs still put 1.5–2.9B into sinks and end at 0.6–1.5B. Weak programs end
safer (frugal 911, resource 504).

## v1.40 — attitude control: a real gimbal, steerable fins, a SAS that holds (2026-10-08, control session)

Caio's review: stability and attitude control are a big part of KSP and felt undercooked here. They weren't missing
(wheels, gimbal, RCS and passive fins all existed), but control was an **abstract torque budget that was always spent
perfectly**. Every engine had the same 7 % "gimbal" as a number, nothing ever turned, the controller's acceleration
was added to the dynamics as is, and a single engine on the axis could roll the vessel. This slice makes the actuators
physical. `study_control.mjs` measures the control budget (`node study_control.mjs`).

**What changed**
- **Engine gimbal is a nozzle that turns.** Each engine has a range `gim` (°) and a slew rate `gimR` (°/s): Sparrow 3°/15,
  Wren 6°/20, Petrel 3°/10, Kestrel 5°/10, Condor 4°/8, Albatross 4°/8 (other sessions' engines default to 4°/10).
  `p.gv` is the deflection; the thrust points along `tdir + gv`, so the steering torque, the side force and the joint
  loads all come from the turned thrust. The structural code's separate "gimbal side force" path is now only used by
  the builder's what-if `probe`.
- **One allocator** (`gimSteer`): the wheels give what they can of the control law's torque as a pure torque, and the
  rest is shared out by least squares over every engine's two deflection axes and every steerable plate. An engine on
  the axis has no roll column, so it can't roll anything. Roll authority (`ctrlAuthRoll`) counts only engines off the
  axis (side boosters, clusters).
- **Steerable fins**: `cfin` (radial, 1.2 M), `cfins` (ring, 4.5 M), `cfins25` (2.5 m ring, 11 M). The same plates as
  the passive ones, all-moving, ±20° at 40 °/s. A plate's normal turns about its span (n' = n·cosδ − Y·sinδ) in the
  existing flat-plate model. Their columns (`finCols`) are linearised each step at the current airflow, so their
  authority grows with q, is gone in vacuum, and they roll. They use the existing fin kinds, so palette, mesh, damage and
  aero all pick them up. Tier 1 in `tierOf` (they have actuators).
- **SAS**: (1) while lagging actuators carry the load (engines burning, or steerable fins with > 25 % of the wheels'
  authority), the rate demand is linear near the target with Tc = `SAS_LAG` × the slowest actuator's full swing. (2) The
  rate loop then also integrates (`SAS_TI` = 1 s), clamped to the authority and **frozen while the command saturates**.
  Wheel- and RCS-only flight is untouched: no zone, no integral.

**Before / after** (same scripted inputs)

| | main | v1.40 |
|---|---|---|
| Lunar, pitch/yaw rate t 20–90 s under SAS prograde (rms) | 0.63 °/s | 0.61 °/s |
| Heavy, same (rms) | 1.56 °/s | 1.37 °/s |
| Lone Condor + "balance" cant, max tilt in 50 s (test §22) | 2.2° | **1.3°** |
| Lunar, 4 s SAS yank at q > 15 kPa, peak joint (test §5) | 100 %, snaps | 88 %, holds |
| Probe dart (core 4 kN·m) at 300 m/s, 30° turn: passive ring / steerable ring | 11.6 s / — | 11.6 s / **5.5 s** |
| Steerable ring pitch authority, 150 → 300 m/s at 5 km | — | 7.2 → 28.9 kN·m (∝ q) |
| Physics step, Lunar / Heavy | 34 / 52 µs | 40 / 53 µs |

**What it taught**
- **The square-root law limit-cycles with any lag.** √(α·θ) has unbounded gain at zero error. With an instant
  actuator that was invisible; with a nozzle taking 0.5 s to swing, the Lunar wobbled at ~0.5 Hz (rms rate 4.8 °/s,
  0.9 nozzle reversals a second). A linear zone of Tc = 1× the swing time cures it; 0.5× doesn't.
- **A rate loop can't fight a steady moment, and the old one hid it.** The linear zone left a standing error against
  thrust off the CoM (canted test: 2.2° → 10.1°). Worse, the steerable fins never moved at all: the loop's largest request
  (gain 4 × 0.6 rad/s × inertia) was 3.6 kN·m on the dart, less than its 4 kN·m wheel, so it never asked the fins for
  anything while the passive aero moment won. A rate integral fixes both.
- **…and windup is the integral's whole failure mode.** Clamped to full authority but integrating while saturated, it
  made the Lunar oscillate at rms 9.8 °/s whatever its time constant (0.5–2 s). Freezing it while the command saturates
  (conditional integration) took it back to 0.61 °/s. Clamping it at 30 % instead also stopped the wobble, but halved
  what the fins could do.
- **The old gravity turns were partly a controller artifact.** The sqrt law trailed prograde with a small standing
  error on the kick's side, which sped up the pitch-over (34° at 40 s). Exact tracking gives a slower, pure gravity turn
  (29°), so scripted 0.95 s kicks now need ~1.2 s for the same trajectory. Test §12's tape kick was retuned. Human
  pilots will notice nothing but slightly lazier turns after a kick.
- **The magic roll was real but rare**: it only showed when roll was commanded (roll key, roll disturbances). The
  scripted ascents never asked for roll, so the study's counter read 0 before and after.

**Tests** (section `control-1`, numbered §35 until v1.46.2; 4 checks): one Sparrow pitches a wheel-less probe but can't roll it, nozzle ≤ 3° at ≤ 15 °/s; the
nozzle centres when the throttle is cut; the Heavy's boosters add roll authority, the Orbiter's one engine none; the
steerable dart turns 30° in < 0.6× the passive time, plates within range and rate; fin authority ∝ q and none in vacuum,
and they roll a wheel-less dart. Changed: §5's yank check now asks for a joint ≥ 80 % (was "snaps", at exactly 100 %);
§12's tape kick 0.95 → 1.2 s. 247 checks pass on the slice, 262 after merging main (sats Phase C).

**For other sessions**
- **visuals:** `p.gv` (engine, vessel frame, |gv| = sin of the deflection) and `p.fd` (steerable fin, one angle per
  plate, rad; ring plates in `FIN4` order) are there to draw: nozzles that swivel, fins that turn. `cfin`/`cfins` draw as
  the passive fins for now.
- **builder:** the steerable fins sit in "Aero & recovery" by kind. The "no control torque" warning still looks only
  for wheels; a wheel-less design can now steer with gimbals or steerable fins.
- **economy / planning:** prices above; `tierOf` returns 1 for `d.ctl`. Engine gimbal ranges could become a variant
  or an upgrade axis.

**Next on this line** (the rest of the review, in order): the builder readout (control authority per axis vs the aero
moment at max-q; time for a 90° turn in vacuum, both of which `study_control.mjs` already computes); weaker wheels
that saturate (pod 40 → ~5–10 kN·m, a wheel part, momentum dumped with RCS); era-gated SAS quality. The wheels are
still 8× a KSP Mk1 pod and dominate everything but the biggest stacks: in the study the Orbiter's steady ascent never
needs its gimbal once the kick is done.

## v1.39 — real ground contact; snow and Selene boulders (2026-10-08, terrain session)

The three things v1.37 left out. Vessels no longer snap upright when they touch: they slide, tip, bounce and come to
rest.

**Contact dynamics** (`footPoints`, `groundNormal`, `groundContact`, `touchdown`, `groundCheck`):
- **Contact points:** 4 per part whose foot is within 0.5 m of the lowest point, around that part's own axis. So side
  boosters widen the footprint.
- **Ground force per point:** a spring-damper along the terrain normal. Stiffness gives 2 cm of static deflection at
  Earth gravity on *every* body; with local gravity, tiny Nyx would let a 2 m/s touchdown sink over a metre. ζ 0.6.
- **Friction:** Coulomb, μ from the surface under that point, regularised to stop within ~2 steps.
- **They are part forces:** they go into `p.F`/`p.L` like aero and thrust, so landing loads reach the joints and the
  structural checks.
- **The speed verdict** (`touchdown`) happens at first touch and is judged under the vessel's centre. Its base spans
  more than one boulder cell, so judging at the first rim point made the result depend on timing.
- **Outcomes:**
  - tilting past 60° while touching: "Toppled over on a 12° slope of taiga";
  - the nose in the ground: a crash;
  - at rest (< 0.15 m/s, < 0.03 rad/s) for 0.5 s, and not while the engines push (a slow liftoff is not a landing):
    landed, pinned in the attitude it came to rest in ("leaning 19°");
  - the sea keeps the old upright splashdown.
- **Measured:**
  - a pod set down on a 13° ice slope slid 65 m in 10 s; theory g(sin θ − μ cos θ) gives 62 m;
  - a pod on 19° taiga comes to rest leaning 19°;
  - the Orbiter (1.25 m base, CoM ~5 m up) set down at 1 m/s stands on the flat but topples on a 12° slope, as
    atan(r/h) predicts;
  - a TWR-1.05 liftoff climbs without being re-landed.
  - Every flown landing already in the suite (chutes, Selene, Nyx, the plateau drop) passes unchanged.
- **The ship's ground shadow** lies on the terrain's own plane, so it reads correctly on slopes.

**Snow** is a surface where the shader paints it: a non-ice biome colder than ~−3 °C at that height, on slopes under
~38° (μ 0.3, +3 m/s, boulders mostly buried). **Selene regolith** has boulders in 15% of cells.

**`touchV` is the measured speed again.** v1.37 had made it the effective one, boulders included, and mission rules
read it: Nyx's "under 3 m/s" saw 5.6. Now `s.touchHit` holds what boulders or trees added, and only the refurbishment's
wear adds it in (`missionEnd`, one token in economy code).

**What it means for play:** without landing legs a tall rocket's footprint is its bottom rim, so it tips on slopes of
roughly atan(r/h_cm): ~7–12° for an upper stage, ~30° for a squat pod. That's real, and it makes **landing legs** a
natural next part (a wider footprint is just more contact points: `footPoints` would pick up a leg part's feet). Parts
are the planning session's domain; suggest it there.

**Tests:** `test.mjs` §25 rewritten for emergent outcomes, 5 checks (243 total after merging):
- ice and steep snow slide (distance);
- grippy ground holds, leaning with the slope;
- speed limits;
- boulder share;
- the Orbiter stands on the flat and topples on a slope.

**Not yet:** legs; bouncing debris (debris still dies on contact); wheels and rolling; Selene's boulders as terrain
(they only change the verdict); a contact sound and dust.

## v1.38 — compute eras and trajectory studies (2026-10-08, economy session)

The first slice of "Compute — a resource across eras" (design in "Rich programs" below).

- **Eras follow the world date** (`COMP_ERAS`), by program year:
  - human computers;
  - mainframes (3);
  - onboard computers (7);
  - cheap compute (14);
  - the AI boom (25).
  
  Each era has a world price index `cpi` (100 → 20 → 5 → 1 → 4: scarce, abundant, scarce again), shown now and to
  be used by datacenters later. A news item marks each new era reaching the program.
- **Access lag by power** (`compLag`), like parts sourcing: own industry (4 yr × (1 − industry)), else a friendly
  supplier (0.5 + 1.5 × (1 − openness) yr), else the grey market (4 yr). A sanction shuts the supplier's door.
  Measured at world year 4.5: the open superpower is on mainframes (lag 0), the resource state still on human
  computers (lag 1.6 yr).
- **Nudges:** a **computing centre** (a new facility: 40M / 90 days, then 120M / 180 days) makes studies ×0.6 / ×0.4
  as long and puts the program 1 / 2 years ahead of its power. Every level also nudges the world forward by 0.25 yr
  (the program contributes to the frontier).
- **Trajectory studies** (`orderStudy`), per exact design (part counts, like autopilot tapes):
  - **cost and time** come from the era, ×√(cost/50M) clamped to 0.5–3. An Orbiter with human computers: 3.5M, 28 days;
  - **one at a time**, in order (`PROG.studyQ`);
  - **a launch waits for its own design's study, then stacks** (`R.studyWait`), so studies add days. One ordered
    ahead, while other things fly, costs none: planning ahead pays.
- **What a study buys: precision.**
  - Unstudied, a design's predictions carry the era's raw error: ±30% with human computers, ±15% with mainframes,
    ±5% with onboard computers, exact after that.
  - Studied, they carry the era's studied error: ±10%, ±4%, exact.
  - The impact predictor reads it as a drag-model error (`predErr`, added to the unsampled-band ±25%). The landing
    spread widens, and range safety takes the whole spread. So an unstudied early flight near cities is constrained.
    Measured on a fully sampled atmosphere: ±7.2 km unstudied, ±2.2 km studied, 0 with cheap compute.
- **Compute never blocks flying:** you can always fly unstudied.
- **Cross-scope lines (flagged):**
  - `predictImpact` adds `pe`;
  - the app's spread no longer vanishes on a sampled atmosphere while `predErr(S)` > 0;
  - `progTabOf` maps the new "Compute" heading to Industry (UI session's map).
- **UI:**
  - Assembly shows "Trajectory: unstudied ±30% [Study 3.5M, 28 d → ±10%]", or "in the office, ready in N d", or
    "studied";
  - a self-contained `computeHTML()` section (era, the world, lag, predictions, the office queue);
  - the centre appears in Facilities.
  
  Checked in the app: ordering charges the cost and the line changes, with no console errors.
- **Not yet:**
  - planning's tool gating and map error bars, which read `predErr` / `compEra()`;
  - onboard computers as parts (builder);
  - the career runner ordering studies;
  - datacenter revenue on `cpi`.

`test.mjs` §34: 5 new checks. §14's spread check now gives its probe an exact study, so it measures only the air.

## v1.37 — surfaces: what the ground is like to land on (2026-10-08, terrain session)

The touchdown verdict used to be the same everywhere: under 12 m/s and tilted < 34° → landed, unless the slope was
over 24°. Now it depends on the biome under the ship (`SURF`, indexed like `BIOMES`).

| Surface | μ | Stands up to | Softness (m/s) | Boulders/trees (share of cells) |
|---|---|---|---|---|
| sea | — | — | +2 | 0 |
| ice | 0.10 | 5.7° | 0 | 0 |
| tundra | 0.45 | 24° | +1 | 5% |
| taiga | 0.50 | 24° | 0 | 35% (trees) |
| steppe | 0.55 | 24° | +1 | 3% |
| temperate forest | 0.50 | 24° | 0 | 40% (trees) |
| grassland | 0.55 | 24° | +1 | 2% |
| cold desert | 0.55 | 24° | +1 | 8% |
| rainforest | 0.50 | 24° | 0 | 60% (trees) |
| savanna | 0.55 | 24° | +1 | 5% |
| hot desert (sand) | 0.45 | 24° | +3 | 2% |
| alpine | 0.60 | 24° | 0 | 30% |
| volcanic (basalt) | 0.70 | 24° | −2 | 30% |
| salt flat | 0.60 | 24° | 0 | 0 |
| wetland | 0.30 | 16.7° | +4 | 5% |
| launch pad (within 2 km of a site) | 0.80 | 24° | 0 | 0 |
| Selene regolith | 0.60 | 24° | +1 | 0 (for now) |

- **Slope:** a vessel stands on slopes up to atan(μ), never past `TOPPLE` (24°). Steeper ground: "Slid down a 13° slope
  of ice and toppled" (or the old "Toppled over" past 24°).
- **Speed:** the crash limit is `TOUCH_MAX` (12 m/s) plus the softness.
- **Boulders and trees** (`surfaceHit`): a cell (~20 m) of rough ground adds 2–6 m/s to the effective touchdown speed.
  It is decided by an integer hash of the cell, so it's deterministic and tapes replay the same. The effective speed is
  what `touchV` (and so the refurbishment's wear) sees. 2–6 m/s, not more: a normal parachute landing (~5 m/s) on rough
  ground mostly costs wear; a fast one crashes.
- **Reported:** the landing message names the surface (and trees or boulders when hit), the HUD's radar altitude says
  what's below ("above hot desert"), and `s.landSurface` = `{name, id, hit}` is set at touchdown for the economy's
  mission record (biome science, recovery).
- **Tests:** `test.mjs` §25, 3 checks (236 total):
  - ice at 13° slides where taiga holds at 19°;
  - sand forgives 13.7 m/s, basalt not 11;
  - rainforest has trees in 59% of 2,000 cells against its 60% roughness, deterministically.
- **Not yet:** ~~contact dynamics, snow cover, Selene boulders~~, all done in v1.39 (§ v1.39).

## v1.36 — balance pass 3: the money sinks in simulated careers (2026-10-08)

`career.mjs` now plays the stand, development and facilities. Variant `all` = lines + a prudent investor (`invest()`):
- it builds the hall, the fleet and the stand;
- it qualifies the least-known of its six most-used parts while that part is under 70% know-how;
- it develops parts it has flown ≥ 5 times (cheaper → reliable → durable);
- it always keeps a 250M reserve (`RESERVE=`).

Other runner changes:
- `INV=hall|fleet|test|dev` runs one sink at a time;
- drops now carry their parts and a sea impact point, so the fleet is simulated.

Agency starts, 6 years, 5 seeds. Final funds are in M, and the noise is roughly ±400M between policies.

**Results**

| archetype   | lines only | all (old) | all (tuned) | hall only | tests only | dev only |
|---|---|---|---|---|---|---|
| openSuper   | 1193 | 293  | 785  | 759  | 1106 | 1240 |
| closedSuper | 1744 | 986  | 1094 | 3039 | 1663 | 2221 |
| rising      | 1565 | 333  | 553  | 1581 | 731  | 1016 |
| frugal      | 861  | 622  | 313  | 825  | 470  | 542  |
| resource    | 908  | 1003 | 477  | 1218 | 1158 | 549  |
| security    | 2914 | 2944 | 1594 | 4010 | 2718 | 2159 |

(The hall, test and dev columns are after tuning.)

- **The pile-up is absorbed.** Strong programs put 1.4–2.6B into sinks over six years and end at 0.8–1.6B instead
  of 1.2–2.9B. Weak programs stay solvent: frugal and resource end at 300–500M, with as many top-ups as without
  investing.
- **What the money buys:**
  - flights: closedSuper 68 → 106, security 79 → 99 (the hall);
  - fewer failures for the weak: frugal 13 → 9%, resource 14 → 10%;
  - more contracts done.
- **Before tuning, the hall was a money machine.** Time is a busy program's bottleneck: +1,900M back for 210M.
- **Before tuning, tests and development were near-pure losses:**
  - qualification taught ~1% on a part already flown (a stand run counted as "seen before", exactly like a flight);
  - development cost 5 × price × (1 + tier) × (1 + level) against a 12% price cut, so it rarely paid back.
- **The fleet is about neutral.** Salvage roughly pays for the ships. Left as is.

**Tuning**

- **Hall:** 90M / 220M (was 60 / 150); stacking ×0.8 / ×0.65 (was ×0.75 / ×0.55). It still pays well for busy
  programs (+1,100 to +1,300M), and is neutral for weak ones.
- **Stand learning:** a campaign never counts for less than half a fresh regime (`STAND_NOV=0.5`; `khLearn` takes
  `novMin`). A qualification on a well-flown part now teaches ~3–4% instead of ~1%. Fewer runs are needed, since the
  runner's runs fell from 61 to 52 for closedSuper.
- **Development:** costs ~3 × price × (1 + tier) × (1 + level) (was 5). A workhorse part's cheaper level now breaks even
  around 25 × (1 + tier) units. Its net effect is roughly neutral for superpowers and a cost for weak programs.

**Emergent loop.** A redesign costs know-how (−0.1), the runner then requalifies the part on the stand, and then
develops it again. That's how real programs work: a new mark means a new qualification. Average know-how sits ~10
points lower in programs that keep redesigning.

**Open:**
- the runner is one prudent policy, not a good player; weak programs would do better being choosier;
- support packages still provisional;
- sinks for the very rich (prestige projects, ground stations) are still on the backlog.

`test.mjs`: the hall check now reads `FAC.hall.eff[1]` instead of a literal.

## v1.35 — facilities: integration hall and recovery fleet (2026-10-08)

One-off investments you upgrade, with no upkeep (`FAC`, `buildFac`, `facTick`). While an upgrade is being built, the
facility keeps working at its old level.

- **Integration hall:** level 1 is 60M / 60 days, stacking ×0.75; level 2 is 150M more / 120 days, stacking ×0.55 (as
  if two vehicles were stacked side by side). Measured: an Orbiter's stacking time, 36.4 → 27.3 days at level 1.
- **Recovery fleet:** level 1 is 50M / 90 days (800 km, 35%); level 2 is 120M more / 120 days (1,500 km, 60%). Ships
  salvage spent stages that come down at sea within range of the launch point (`R.launchPf`), for that share of
  their dry price × REFURB × load/heat wear (not the splash: they're salvaged for parts), minus 2M ship time each. A
  little know-how too (the "land" regime at 0.3 weight). Measured: a Kestrel stage 127 km out, +2.3M at level 1. A
  stage on land, or one 1,001 km out, is lost.
- **Plumbing:** the app's debris hook now passes the dropped parts and their impact point to `missionDrop`. The career
  runner's drops carry no parts, so the fleet isn't simulated there yet.
- **UI:** `facilitiesHTML()`, a self-contained section called once from `renderProgram`, so the UI session can move it
  into a tab (flagged in ACTIVE_WORK).

`test.mjs` §33: 2 new checks.

## v1.34 — development projects (2026-10-07)

The design bureau improves parts the program makes. The variants-vs-upgrades decision is still on hold, so this slice
uses only goals that don't touch shared part definitions or physics.

- **Goals** (`DEV_GOALS`), up to three levels each, stored in `PROG.dev[k]`:
  - *cheaper*: unit price −12% per level (`devPriceK`, for home-made and own-line parts);
  - *more reliable* (engines only): ignition failures ×0.6 per level;
  - *more durable*: wear ×0.75 per level, so more of the value comes back after a hard flight. Measured at 90% load:
    44% → 72% at mark 2.
- **Who can develop:** only parts we make (home industry or our own line). Not imports, and not licensed lines (the
  design belongs to the licensor). That's the "develop only what you build" option from the design notes, easy to
  relax later.
- **Needs:** know-how of the part ≥ 50 / 65 / 80% for levels 1 / 2 / 3 (a Kestrel off a brand-new own line: 41%, not
  yet). Cost ~5 × price × (1 + tier) × (1 + level) (3× since v1.36); 30 + 20·tier days × (1 + 0.5·level); one project at a time
  (`PROG.devJob`, ticked daily).
- **A redesign is a new design:** certification −0.1 (floor 50%) and know-how −0.1, to be won back by flying or testing.
- **UI:** a Development section in the Program panel with the running project, or the three goals per part we make,
  with cost, days and the reason when a goal isn't possible.
- **Not yet:**
  - performance goals (thrust, Isp, mass), pending the variants decision;
  - licensing our designs to others;
  - the career runner using development;
  - stand data counting directly toward a project (today it counts through know-how).

`test.mjs` §31: 3 new checks; 226 total.

## v1.33 — the test stand (2026-10-07)

A first capital investment: a one-off facility with no upkeep, chosen by the player.

- **Building it:** 40M and 60 days (`buildStand`), stored in `PROG.stand2` (`PROG.stand` already holds the contract
  sources' standing).
- **Campaigns** (`startTest`, ticked daily by `standTick`), one at a time. Each buys a unit of the part at its current
  sourced price and burns 1.5M a day.
  - *Qualification run* (10 + 10·tier days): the regimes a stand can reproduce (fly, structural load, heat, and burn for
    engines), learned at 60% of a flight's weight; certification rises as if the part had been loaded to 60%. A stand
    never teaches vacuum or orbit. Measured: a frugal power's Kestrel, 48M over 20 days → know-how 20 → 29% (a flight
    through the same regimes: +14.5 points), certified 70 → 85%.
  - *Test to destruction* (5 + 5·tier days): certified 100% (true limits known), a little know-how, the unit destroyed.
    A Condor: 60M over 15 days.
- `khLearn(R, w)` takes a weight; ground tests use 0.6.
- **UI:** a Test stand section in the Program panel: build, construction progress, the running campaign, and Qualify /
  To destruction buttons for parts in the current design or already known.
- **Not yet:** the career runner doesn't use the stand, so its effect on balance is untested. Development projects (the
  next sink) can build on it: stress data from the stand counts toward a part's history.

`test.mjs` §30: 3 new checks; 223 total.

## v1.32 — balance pass 2: know-how, lines and support in simulated careers (2026-10-07)

`career.mjs` now plays the new systems:
- upper-stage ignitions can fail by know-how (a first-stage failure is a scrub);
- each abstracted flight records the regimes its parts went through, so the game's own `khLearn` runs;
- three policies, picked with `node career.mjs [years] [seeds] [base|lines|support] [starts]`:
  - *base:* buy everything;
  - *lines:* license or build a line for any part flown three times, if 120M stays in reserve;
  - *support:* a runner-only model of support packages (fee 1.5× the part's price on first purchase; that part
    starts at 45% use).

**What it found:**
1. **Know-how grew far too fast.** Each regime added its own step, and an orbital flight passes through about nine, so
   one flight took a part from 20% to ~85% (90–96% for every program after a year; zero ignition failures). My v1.30
   check only exercised three regimes, which hid it. Now **one step per flight**: Δuse = (1 − use)·(1 −
   e^(−0.05·Σ novelty)). Measured on a Kestrel through the same three regimes ten times: +11, +5, +3 … +0.8 points, 48%
   after ten. Varied orbital flights reach the high 70s in about ten. (This supersedes the v1.30 numbers.)
2. **Weak agencies bled.** Running costs exceeded a neutral budget day, so frugal/resource agencies needed 7–22 top-ups
   in 3 years: the upkeep misery Caio warned about. Running costs are now 0.06 + 0.015·capacity M/day, the budget day
   15M per 100 days, and the agency and consortium starts 80M. Top-ups in 3 years: 0.7–4.7 (frugal leanest).
3. **Lines didn't pay back.** At 8× price setup they never did within 3 years. Now 4× price × (1 + tier), and
   maturity +12% per unit. Over 6 years (2 seeds), agencies' final funds without → with lines: rising 1,668 → 1,854M;
   frugal 356 → 661M (it affords 59 flights instead of 32); security 1,698 → 2,488M; but resource 1,174 → 698M. A
   resource state with no industry is better off buying. That's the archetype doing its job, and buying and building
   coexist as designed.
4. **Support packages are a real trade-off** (3 years): resource 332 → 737M and frugal 367 → 455M, but rising
   830 → 579M and security 885 → 571M. Good for import-dependent programs, a drain for others. It stays provisional,
   now with evidence that it's a choice and not a dominant strategy.

**Still open:** superpowers reach 2,400–3,300M by year 6. Money sinks for the strongest programs are the next job:
test stands and development projects.

## v1.31 — production lines (2026-10-07)

The second visible number per part: production. Learning to manufacture a part is different from buying it.

- **Setting up a line** (`prodQuote`, `startProdLine`): about 8 × the part's price × (1 + tier), and 40 + 30·tier days to
  tool up.
  - *Own line* (reverse-engineering): needs real know-how of the part (use ≥ 40%), so you have to fly it first.
  - *License*: from a supplier that makes it, is friendly (relation > 0.2) and isn't sanctioning us. 60% of the cost,
    70% of the time, starts at 30% maturity instead of 5%, and pays the licensor 10% royalty per unit (their opinion
    rises).
  - Measured, Kestrel for a frugal power: own line 192M / 70 days; license from Ordun 115M / 49 days.
- **Maturity** (the learning curve, `prodUnits`): every unit built at launch adds 8%·(1 − m). Price per unit runs from
  ×1.25 (new line) to ×0.75 (mature), plus 0.1 if licensed (`prodLineK`). Measured: pod + tank + Kestrel imported
  38.9M → first line units 35.6M → after 25 units 30.6M (88% maturity).
- **Quality:** an immature line's engines fail to ignite more often (×(2 − m)). A first, simple form of the part-quality
  idea.
- **Building it teaches it:** line parts start with more know-how (+0.2 + 0.2·m) and certification (CERT0 − 0.2·(1 − m)).
- **Lines belong to the country:** `sourceOf` prefers a working line of ours, so sanctions don't touch it (a license keeps
  running), and after a defection the old home's lines are no longer ours.
- **UI:** a Production section in the Program panel lists our lines (tooling up / maturity / units / price) and, for each
  part bought abroad in the current design, "Own line" and "License from …" buttons with cost, days and the reason when
  it isn't possible. Know-how labels show "own line, maturity N%" or "licensed line".
- **Found while building:** my first `lineOf` collided with the builder's `lineOf(nd)` (a JS function declaration
  silently replaces an earlier one with the same name), which broke `assemble()`. Mine are now `prodLine`,
  `prodLineK`, `prodQuote`, `startProdLine`, `prodUnits`.
- **Not yet:** the career runner doesn't build lines yet; supplier quality beyond line maturity; vertical integration
  across tiers.

`test.mjs` §26: 3 new checks.

## v1.30 — know-how (2026-10-07)

The first slice of the parts-progression design ("The whole parts system, assessed"): owning a part is not knowing how
to use it.

- **Two facets per part type:**
  - *use* (`PROG.kh[k].use`): operational familiarity, new;
  - *limits*: certification (`PROG.cert`), unchanged.

  The player sees one bar: 0.6·use + 0.4·(certification's progress from 50% to 100%).
- **Starting use** (`use0`): 0.5 structure and tanks, 0.2 small engines, 0.1 big engines and avionics. A part built at
  home starts +0.3 × the home industry's self-sufficiency higher (the engineers made it): a superpower's own Kestrel
  50%, an imported one 20%.
- **Learning** (`khMark`, `khLearn`): every physics step records the regimes each part goes through: flown, max-q
  > 15 kPa, vacuum, orbit, hot (T/Tmax > 0.5), landed, burning, vacuum burn, failure. At flight end each regime teaches
  0.18·(1 − use)/(1 + times seen). Measured on a Kestrel flown the same way ten times: +36 points the first flight,
  under 1 point by the tenth, 85% after ten.
- **Effects: risk, time and yield, never stat cuts.**
  - *Risk:* each engine ignition can fail, with probability 0.08·(1 − use)² (5.8% at zero know-how, 0.3% at 0.9).
    Deterministic per flight, kick and part. A failed pure-ignition event can be retried (at lift-off it's a scrub).
    A failure teaches too.
  - *Time:* stacking takes up to ×1.5 for an unfamiliar vehicle (price-weighted familiarity; an unfamiliar Orbiter
    takes ×1.35).
  - *Yield:* science contracts pay, and certification gains accrue, × (0.5 + 0.5·use of the instrument package).
- **Starts with the program:** effects apply once a start is chosen or a flight is flown, so plain physics in the sim
  (and its tests) is unaffected. Know-how is in `PROG`, so it carries over in a defection (the team's).
- **One cross-scope line:** `stage()` asks `igniteOK(s, k)` before marking a segment ignited (flagged in ACTIVE_WORK).
  Autopilot tapes replay the same rolls only while know-how is unchanged; once the team has learned more, a replay can
  differ, as a real flight would.
- **UI:** the builder's cost line lists parts that are "New to us" (under 35% use); the Program panel shows a
  Know-how section (bars, plus home-made / from <supplier> / grey market).
- **Not yet:** ground testing (test stands), production lines (the second visible number), support packages
  (provisional, pending the career runner and playtesting), supplier quality.

`test.mjs` §22: 5 new checks; 182 total. Two older checks updated (stacking time, science pay).
## v1.29 — ground awareness (2026-10-07, terrain session)

The fixes listed in § v1.27 "Next on this line". With real ground up to ~9 km, landing-related decisions now measure
height from the ground under the ship, not from the sea.

- **The main chute** opens below **3 km above the ground** (`MAIN_AGL`), under 250 m/s. It used air denser than
  0.7 kg/m³, which since the rescale (scale height 7.5 km) is ~4.2 km above the *sea*. The impact predictor uses the
  same rule: `fall()`'s drag callback now also receives `r` and `t`, so it can ask about the ground.
- **Measured.** Drop a chute-and-pod from 25 km over a 4.89 km plateau (air 0.64 kg/m³):
  - with the old rule, only the 6 m² drogue ever opened, and it hit at **63 m/s**;
  - now the 600 m² main opens and it lands at **6.9 m/s**;
  - the predictor said 6.9 m/s, 20 m off.
- **Time-warp auto-drop** uses `groundGap(s)`, the ship's bottom above the ground under it.
- **The HUD** shows **Radar alt** (height above the ground or sea) below ~32 km, next to the sea-level altitude.
- **Helpers:** `aglAt(b,r,t)`, `mainChuteOK(b,h,r,t)`, `groundGap(s)` (SIM, next to `groundR`).
- **Left alone, deliberately:** atmosphere thresholds (`physAlt`, drag, the air's top) stay sea-level based. The
  plume's ground interaction (`groundFrame`, plumes session) already used `groundR`.
- **Tests:** `test.mjs` §24, 2 checks (the plateau drop with prediction; the ground gap). 185 total after merging.

## v1.28 — balance pass with simulated careers (2026-10-07)

**Tool:** `career.mjs` (`node career.mjs [years] [seeds]`) plays whole programs through the real economy code: contracts,
budget days, decisions, the race, sanctions, opinion, career offers. Flights are abstracted. A scripted player picks a
design (sounding rocket at any apex, Kestrel qualification shot, passenger hop with a gentle variant, orbiter to an
altitude and inclination with optional ballast, passenger orbit, ballistic shot), pays its real price (real presets,
real sourcing for the archetype), and gets the flight record that design produces, succeeding 80–93% of the time.
Everything after the flight is the game's own code. The player takes the best-paying offers it has a design for,
avoids certain home sanctions, flies whatever is worth most (contract pay plus firsts, which are valued above their
reward because they unlock things), takes a loan when rescued, and declines optional decisions. It runs 6 archetypes ×
3 starts × 3 seeds; 3 years takes about 2 minutes.

**What it found (before tuning, 1 year):** money exploded. Every program ended year one between 320M and 3,000M from a
60–90M start: a recovered sounding rocket cost about 4M net after 80% refurbishment and completed 10–25M contracts every
four days. Orbit came by day 15–19 because stacking took 2 + cost/8 days, so the race was no contest. Two real bugs: a
leak's sanctions could shrink the active-contract list during `contractEval` (crash), and the floor was only checked at
flight end, so once running costs existed a program that couldn't fly bled with no rescue.

**Changes:**
- **Stacking takes real time:** `prepDays` = 5 + cost/2 (sounding 14 d, Orbiter 33 d, Heavy 53 d).
- **Launch operations fee:** 3M + 10% of the vehicle, every launch (`OPS_FIX`, `OPS_FRAC`; `R.ops`).
- **Running costs:** 0.1M/day + 0.03M/day per unit of contract capacity, from the first launch on (a program that hasn't
  flown has nothing to run). An agency's budget day roughly covers this at neutral opinion; a company has to earn it.
- **Refurbishment** 80% → 65%. **Contract pay** ×0.7.
- **Rivals race at a human pace:** each first takes (100–220 days) / speed. The strongest rival in the current world is
  expected on days 83 / 176 / 245.
- **Career offers:** "excelling" offers half as often (1/900 per day). "Badness" counts *recent* top-ups (`bailRecent`,
  fading over ~300 days) instead of lifetime top-ups, which had made a recovered program look desperate forever (13–20
  offers in 3 years → 0–8).
- **Fixes:** `contractEval` skips entries removed mid-loop; `floorCheck` also runs in the daily tick.

**After (3 years × 3 seeds):**

| | flights in 3 y | first orbit (day) | funds after 3 y | top-ups | career offers |
|---|---|---|---|---|---|
| superpowers | 32–44 | ~130 | 790–1,210M | 0 | 0–2 |
| rising power | 21–36 | ~147 | 176M (company) to 690M | 0–0.3 | 2–5 |
| frugal middle power | 24–34 | 158 (company 234) | 137M (company, in debt) to 630M | 2.7 (state-run) | 2–8 |
| resource state | 17–36 | ~170 | 344M (company) to 1,245M (consortium) | 0.7–1.3 | 2–8 |
| security state | 30–36 | 163–175 | 650–800M | 0–0.3 | 0–6 |

Failure rates 7–15%. The weaker the archetype, the leaner the times: state-run frugal and resource programs need 1–3
top-ups; a frugal company ends in debt. All nine firsts get done within 3 years everywhere except the frugal and
resource companies (8.3–8.7). Race: the runner's player goes for the passenger firsts before the beeper (they pay more),
so it always loses the beeper to the strongest rival (~day 83) and wins hop and orbiter. A player who goes straight
for the satellite can contest it.

**Still open:** strong programs reach ~1,000M by year 3 with nothing to spend it on. That's a content gap more than a
tuning one: the economy needs **sinks** (stations, bigger programs, infrastructure such as the planning session's
ground stations, R&D). Imaging contracts are outside the runner (they need a camera satellite). The runner's flight
outcomes are fixed per design and don't come from physics; re-check them when designs change.

## v1.27 — launch sites as data (2026-10-07, terrain session, slice B)

Slice B of the geography plan (§ v1.25), built to the economy session's hand-off. Every power now has launch sites
suited to its own geography. A flight starts from the site you pick, and the site's latitude and downrange are real.
Economy rules (leases, fees, sanctions, politics) are deliberately left to the economy session.

### What a site is
`SITES` is plain data in the SIM world block, one entry per pad:

| Field | Meaning |
|---|---|
| `id`, `name`, `kind` | `kind` is `'pad'`; a sea platform would be `'sea'` later. Names are the power's root plus Cape / Field / Polar Range. |
| `u`, `lat` | Planet-fixed unit vector; latitude in degrees. |
| `h` | Pad height. The pad is levelled to `h` (flat to 2 km, blended out by 4.5 km). |
| `power` | Index from `powerAt(u)`, or null. |
| `coastal`, `maxDia` | Coastal means water within 30 km. Stages up to 10 m come by barge; inland, 3.9 m by rail (a real loading gauge). |
| `downrange` | `{az, sea, over}`: of the eastward headings (45–135°), the one with the most water over the first 1,000 km, favouring due east (the most free speed). `over` lists the powers whose land lies under it. |
| `polar` | `'S'`, `'N'`, `'NS'` or null: a corridor that way with ≥ 60% water and only the site's own land. |
| `role` | `home`, `eq`, `polar` or `inland`. |
| `rot`, `minInc` | Free eastward speed at sea level (ω·R·cos lat); the lowest inclination reachable without a plane change (\|lat\|). |

**How they're generated.**
1. The home site is found as before: equatorial, flat, low, a coast to the east. The world is still turned so it sits
   at planet-fixed +X. It is `SITES[0]`, power 0's home.
2. Once the powers exist, `extendSites()` screens candidates on a 6-texel grid (~47 km) of the baked map:
   - flat (ruggedness < 0.15), 5–1,500 m up, |lat| < 70°;
   - on a power's land, ≥ 40 km from cities;
   - with cheap water fractions east and toward the poles.
3. Each power gets up to three sites, ≥ 250 km apart (`SITE_GAP`):
   - its most equatorial, weighted toward open water east (`eq`; power 0 already has its home site);
   - one with a clear polar corridor (`polar`);
   - its most equatorial inland one (`inland`).
4. `finishSite` measures every site on the real terrain and territory: exact `isLand`/`powerAt` along 1,000 km great
   circles every 20 km.
5. Cost: ~150–300 ms at load.

**Seed 13 has 15 sites** (3 per power; ⟂ = polar corridor):

| Site | Role | Lat | Pad m | Free m/s | | Downrange | ⟂ |
|---|---|---|---|---|---|---|---|
| Fenfen Cape | home | 0.0N | 157 | 278 | coast | 90° 94% water | S |
| Fenfen Polar Range | polar | 26.9N | 140 | 248 | coast | 90° 100% | SN |
| Fenfen Field | inland | 7.9N | 66 | 275 | inland | 135° 88% | S |
| Selhav Field | eq | 0.5S | 175 | 278 | inland | 90° 90% | S |
| Selhav Polar Range | polar | 18.5N | 368 | 264 | coast | 120° 50% | S |
| Selhav Field II | inland | 10.0N | 282 | 274 | inland | 90° 88%, over Fentor | S |
| Ordun Field | eq | 17.4S | 307 | 265 | inland | 105° 88% | N |
| Ordun Polar Range | polar | 15.3S | 393 | 268 | coast | 45° 82% | N |
| Ordun Field II | inland | 15.3S | 621 | 268 | inland | 60° 90% | N |
| Haval Cape | eq | 14.2N | 424 | 269 | coast | 105° 100% | S |
| Haval Polar Range | polar | 29.0N | 999 | 243 | inland | 135° 66%, over Fenfen | S |
| Haval Field | inland | 22.7N | 1332 | 256 | inland | 90° 48%, over Fenfen | — |
| Fentor Field | eq | 1.6N | 851 | 278 | inland | 90° 92% | — |
| Fentor Polar Range | polar | 43.8N | 682 | 201 | inland | 135° 38% | S |
| Fentor Field II | inland | 0.5S | 615 | 278 | inland | 105° 60% | — |

What the table says:
- Ordun's best site is at 15.3°S and Haval's at 14.2°N. Neither can reach an equatorial orbit without a plane change.
  To the stationary orbit that costs ~370–400 m/s more than from the equator.
- Two of Haval's sites have their downrange over *our* land. That's the "launching over a neighbour" politics economy
  plans to add.

### A site per flight
- `newShip(stack, site = curSite())` puts the ship on that site's pad in the site's own frame (nose up, belly east).
- The choice is `PROG.site` (saved). `curSite()` falls back to the first home site.
- Home sites are `homeSites()`, recomputed from `HOME` every call, because `HOME` changes on defection.
- Tapes record their site (`tape.site`), and the autopilot flies a tape from where it was recorded. The logbook copies
  and saved tapes carry it too.

**The launch gate** (on Launch, after the budget check):
1. `siteAccessOf(site)` calls economy's `siteAccess(site)` → `{ok, why, fee}` if it exists. Until then: home sites
   only, free; a foreign site is refused with "⟨power⟩ won't let us launch from ⟨site⟩".
2. `siteFits(site, parts)`: no stage wider than `maxDia`.

**The picker** is in the construction screen's right panel, above LAUNCH. It lists our sites, then those abroad (⛔ when
refused). For the chosen site it shows latitude, free speed, lowest inclination, pad height, downrange and water
share, the powers overflown, the polar corridor, rail or barge, and the reason it's refused. Picking a site moves the
ship onto that pad (`builder.js` `changed()` now hangs it over `S.site`).

**Rendering.**
- `terr()` in the sky shader levels the 4 sites nearest the camera (`uSites[4]`, `uNS`). `terrainH` levels all of
  them; sites are ≥ 250 km apart, so the nearest is the only one that can matter.
- The pad mesh is drawn at every site within 300 km of the camera, in its own frame.
- The painted launch complex (`padGround`) follows the nearest site's frame (`uPadE`, `uPadS`).

**+X assumptions replaced:**
- `makeCities` and `makePowers` (one line, per the hand-off) use the home site's `u`.
- The recovery distance `landDist` is measured from the flight's own site.
- The pad's ground station is now `padGS()`, the chosen site; planning's `PAD_GS` constant is gone.

### Measurements
- Agreement around a non-home site (Fenfen Polar Range, 1,024 points within 8 km): GPU vs CPU median 2 mm, max 2.5 cm.
  260 points sit on the flat 2 km disc.
- **The Orbiter flown from Haval Polar Range (29.0°N)** reaches 121×102 km at **28.97°**. Latitude now sets the
  orbit's plane.
- **Free speed:** 278 m/s at the equator, 248 at 26.9°, 201 at 43.8°.
- **Tests:** `test.mjs` §23, 5 checks (157 total with everything merged):
  - fields and generation;
  - a ship on a far pad: position, attitude, free speed, plane;
  - `PROG.site` and tapes;
  - access and rail gauge;
  - the latitude flight.

### Traps hit
- **`typeof X` on a `const` in its temporal dead zone throws.** `mkSite` takes its id from the caller instead.
- **An edit that turns a one-line handler into two lines moves "after this line".** The picker was inserted after the
  Launch handler's *first* line, i.e. inside it, and `renderSites` was undefined at load.
- **A merge can fail on an object that Drive hasn't finished syncing** ("unable to read sha1 file"). It leaves the
  new files it had already written as untracked files in the worktree. The object was readable a minute later. Move
  the strays aside and merge again.

### Left for others (also in ACTIVE_WORK)
- **Economy:**
  - define `siteAccess(site)` → `{ok, why, fee}` (leases, sanctions, closures) and record `R.site`;
  - westward and overflight politics can read `site.downrange.over`;
  - the ballistic contract still places its target `rg/600` radians from +X: the old 600 km radius (ranges 2.1× long
    now), and from +X rather than the flight's site.
- **Builder:** the site picker lives in `index.html` (`renderSites`, `#sitePick`), not in the construction screen's
  own UI. Move it if the screen grows a place for it.

### Next on this line
- ~~**Ground awareness**~~ done in v1.29 (§ v1.29). The original note: A few systems still measure height from sea level,
  which the real ground (up to ~9 km) breaks:
  1. **The main parachute never opens over high ground.** In `physStep` the main opens on air density
     (`sp<250&&rho>0.7`), not on height above the ground. With the rescaled air (scale height 7.5 km), ρ = 0.7 is about
     4.2 km above sea level, so over a plateau higher than that a capsule comes down under the drogue alone and crashes.
     The impact predictor (`predictImpact`'s drag function) copies the same rule, so change both together. Open the
     main by height above the ground (the arming message says "main below 3 km"), e.g. `h − groundAlt(b, pf) < 3000`,
     with density only as a floor.
  2. **Time-warp auto-drop estimates time to the ground from sea level** (in the main loop, `hb=len(S.r)-S.body.R+
     S.yBot`). Over mountains it drops out of warp late. Use `groundAlt` under the ship.
  3. **The flight HUD shows only altitude above sea level** (`rows` → `'Altitude'`). Add a radar altitude (height above
     the ground or sea under the ship, `h − groundAlt`) when below a few km. You need it to land on terrain.
  4. While there, check anything else that compares `len(r)−R` with a ground-related threshold. Atmosphere thresholds
     (`physAlt`, `h<b.atm`, drag bands) are correctly sea-level based; touchdown, chutes and warp are not.
  - Tests to add: a capsule coming down over a 4–5 km plateau lands under its main; warp drops before ground contact
    over a range.
- ~~A sea-launch platform, per-site weather scrubs, a pre-launch downrange warning~~: done in v1.45 (§ v1.45).
- (original note) Range safety and drop zones per site and heading (they already follow the flight, but nothing warns about a
  downrange over a neighbour before launch).
- ~~Then slices C–E (§ v1.25)~~: done in v1.48 (§ v1.48).

## v1.26 — industrial independence (2026-10-07)

The fourth flavour axis. Each archetype has a **self-sufficiency** level (`ind`): superpowers 1.0, security state 0.55,
rising power 0.5 (+day/1500, capped at 0.9), frugal middle power 0.4, resource state 0.1.

- **Three tiers of parts** (`tierOf`): structure and tanks (0); small engines and 2.5 m structure (1); big engines
  (≥ 300 kN) and complex payloads (pod, biocapsule, instruments, camera, antenna) (2). A power makes the tiers its
  level reaches (0 / 0.45 / 0.8).
- **Sourcing** (`sourceOf`): home-made ×1; otherwise imported at ×1.5 from the most capable supplier (self-sufficiency ×
  economy) that isn't hostile to home (relation > −0.2) and isn't sanctioning us; with no such supplier, **grey market
  ×3** through intermediaries (with a headline at launch). That's how **sanctions reach hardware**: lose your supplier
  and you switch to the next (Kestrel: Maros → Venka) or pay triple. Prices flow through `partPrice`, so refurbishment
  refunds follow too. Buying abroad grumbles a little at home, scaled by nationalism.
- **Young-industry certification** (`cert0`): home-made parts start at CERT0 − 0.2 × (1 − self-sufficiency) (a frugal
  power's own tank: 58%); imports arrive at the usual 70%.
- **Shown** on the builder's cost line ("Imports: Kestrel booster, Petrel vacuum (Venka ×1.5) · Command pod (grey market
  ×3)") and as one industry line in the world section.
- **Measured:** an Orbiter costs 49.8M for a superpower, 66.8M for a resource state with willing suppliers, and 85M in
  the generated world, where the only avionics maker is tense with home (pod via the grey market).
- **Balance note:** a resource state can't afford an Orbiter from the 60M start. It earns its way up through sounding
  flights or rides a commodity boom. Fine for asymmetry; revisit with real play.

`test.mjs` §20: 4 new checks; 128 total.
## v1.25 — terrain and geography: a generated world with real height (2026-10-07, terrain session)

Tellus used to be a perfect sphere with a noise coastline and shading-only biomes. Now it's a generated world with real
height: plates, mountain ranges, climate and biomes. The physics lands on it, and the sky shader ray-marches the same
height function, so what you see is where you touch down (to millimetres near the camera). This is **slice A** of the
geography plan below. Slices B–E (launch sites, stations, recovery, biome science) are designed but not built.

### The plan agreed with Caio (geography → gameplay)
Decisions: **real height** (not shading only); **regenerate the world freely**; **terrain first, then launch sites**;
after the rescale, **keep features at their km size** and use **20 plates**.

- **A. Terrain (done here).** One height function shared by CPU and GPU; biomes; mountains, fjords, volcanoes, salt
  flats, wetlands; the physics uses the height.
- **B. Launch sites as data (next).** Several sites per power, generated to suit the geography: flat, coastal, with a
  clear downrange. The chosen site sets the start position, the pad, the rotation bonus and the minimum inclination.
  Numbers at today's scale (R 1,274 km, 8 h day, µ = 1.592e13):
  - Free rotation speed east: **278 m/s × cos(lat)**.
  - A westward launch (when a neighbour lies downrange, like Israel's) costs about **2 × 278 m/s more**.
  - Stationary orbit at **5,670 km**, where orbital speed is 1,515 m/s. The plane change from latitude φ costs
    2·1515·sin(φ/2): **264 m/s from 10°, 369 from 14°, 395 from 15°, 604 from 23°, 1,257 from 49°**.
  - Other levers:
    - Downrange safety reuses the existing range safety and drop-zone incidents.
    - Polar launches need a clear corridor to the south.
    - Inland sites can't take stages wider than rail allows; coastal sites get big stages by barge.
    - An equatorial site can be leased from another power, depending on relations; later, a sea-launch platform ("the
      sea is no one's").
    - Site weather can scrub launches (the cloud field is real data: `cloudAt`).
  - Code that needs generalising: the pad is hard-wired at planet-fixed +X in about six places (`newShip`, pad
    drawing, `uPadL`, `PAD_GS`, `makeCities`, and `makePowers`, which is the economy session's code). The world is
    currently *turned* so that the one site lands at +X. Several sites need a `SITES` list and a site per flight.
- **C. Ground stations with terrain.** Main already has stations (planning branch; see "Ground stations" below).
  Contact is an elevation test against the sea-level sphere: `dot(norm(sub(pf, st.u·R)), st.u) ≥ STA_MIN` in the
  daily tick. To add:
  - Stations at their ground height, `st.u·(R+terrainH)`.
  - **Horizon masking** by sampling `terrainH` along the line of sight (mountain-top stations see more).
  - Plasma blackout during re-entry (the glow already exists).
  - A station's site choice becomes a real trade-off.
- **D. Recovery.** Splashdowns are already flagged (`s.water`).
  - Sea recovery needs a ship near your coast and costs days.
  - Land landings need a softer touchdown.
  - Landing in another power's territory means they keep or return the hardware, depending on relations.
  - Recovery distance feeds refurbishment.
- **E. Biome science and events.** `biomeAt(pf)` gives `{id,name,h,T,wet}`.
  - Ground tracks matter: imaging a latitude needs an inclination at least that high.
  - Aurora sounding rockets favour high-latitude powers.
  - Precision landers into a biome: glacier, volcano, salt flat.
  - Cyclones only over warm sea; fires in dry forest; floods on deltas; eruptions on volcanic arcs.
  - Hand these to the economy session's contract board rather than writing contracts here.

### How it works
**The baked map (CPU, at load).** `makeWorld(seed)` fills 1024×512 equirectangular Float32 fields, about 8 km per
texel at the equator:
- `E`: base height in metres.
- `M`: ruggedness 0–1.
- `V`: volcanism.
- `S`: salt flat.
- `T`: °C at the surface of `E`.
- `W`: wetness.
- `U`: an upper bound on the final height, dilated ±2 texels.

The steps:
1. **Plates.** `NPLATES`=20 seeds, 45% continental, each rotating about a random Euler pole. Each texel finds its
   nearest plate after a noise warp, and the distance to the nearest bisector. Precomputed pair normals make that a
   dot product per plate.
2. **Boundaries.** Converging continent–continent makes a high range plus a plateau behind it. Ocean under continent
   makes a coastal range with volcanoes. Ocean–ocean makes an island arc. Diverging makes a rift (or a mid-ocean
   ridge). Plus old worn ranges from ridged noise. Every boundary width is in the 600 km planet's radians times
   `WK` = 600 km / R, so **features keep their km size whatever R is**.
3. **Low-frequency fields.** The warp, the continent noise and the worn ranges live on a half-resolution grid and
   are interpolated. That cut generation from 2.7 s to 0.4–0.75 s.
4. **Climate.**
   - `T` = 27 − 52·(|lat|/90)^2.2 − 6.5 K/km. That is about Earth's zonal means: 27 °C at the equator, 13 at 45°,
     3 at 60°, −25 at the pole.
   - Wetness: air is carried along each latitude row by the prevailing wind (easterly below 30° and above 60°,
     westerly between). **East is decreasing `atan2(z,x)`**: the surface moves toward −Z. Air picks up moisture over
     the sea (300 km e-fold), dries inland (3,500 km) and rains out going uphill (rain shadows).
   - All of that is scaled by the big circulation: a wet equator, dry ~25°, stormy ~47°, dry poles.
   - Then 5 smoothing passes.
5. **Masks.** Salt flats are dry, flat basins below their 5×5 mean. `U` is the base plus the most the detail can add.

**The height at a point.** `hgtGen(g)` on the CPU and `hgtG(g,k)` in GLSL:
- The map's E/M/V/S read with a **quadratic B-spline** over 3×3 texels. Bilinear gave 8 km lighting facets; see the
  negative results.
- Plus 9 octaves of integer-hash value noise from 25 km down to 90 m (`HF0`), used two ways from the same octaves:
  - ridged multifractal, `RIDGE_A`=4200 m × ruggedness, crests over valleys `VALLEY`=1800 m deep;
  - plain fbm hills, ±380 m, ±880 m near coasts, so the coastline is fractal.
- Fjords: glacial valleys at |lat| > ~45° in rugged, low coastal ground. A warped noise isoline is carved 1,500 m
  deep, so it floods near the coast and leaves a valley inland.
- Volcano cones: one per ~42 km cell (`VOLF`), ~5 km radius, 1.8–3.4 km high, with a summit crater.

`terrainH(pf)` adds the pad levelling (flat to 2 km, blended out by 4.5 km). `groundAlt`/`groundR` give the ground
under a point (the sea where h < 0). `biomeAt` classifies with the same thresholds the shader blends between.

**CPU/GPU agreement is designed in, not hoped for:**
- The hash is integer (`ih3`, Math.imul / uint), so the lattice values are bit-identical.
- The map is read with `texelFetch` and the same weights. Hardware filtering has 8-bit weights.
- GLSL `atan`/`asin` are replaced by `patan`, a range-reduced series good to ~1e-7 rad. The built-ins are good to
  ~1e-5, which moved the texel lookup by decimetres, and metres on steep slopes.
- `sst()` replaces GLSL `smoothstep` wherever edges are reversed. That's undefined in the spec, though NVIDIA happens
  to do the obvious thing.
- Feature constants are rounded once (`toFixed(5)`) and injected into the shader from the SIM values.

**Physics.**
- `newShip` stands on the levelled pad.
- `groundCheck` tests both ends of the vessel against `groundR`. Above `TERR_TOP` + length it returns at once.
- Landing on a slope over `TOPPLE` (0.42 rad, 24°) topples the vessel: a crash.
- `s.water` is set on splashdown.
- `stepDebris` and `fall()` (the impact predictor and drop zones) stop at the ground.
- `TERR_TOP` comes from the data (max of `U`, 12.1 km for seed 13).
- Selene is still a smooth sphere.

**Rendering, in the sky shader.** `march(d,hh,tS)`:
1. Intersect the shell from sea level to R+`TERR_TOP`.
2. Step in clear air with only the `U` bound. That's one filtered fetch, no terrain evaluation, so most sea and sky
   pixels are cheap.
3. Near the ground, evaluate `terr()` with only as many octaves as needed:
   - an octave bound `(m·2730+300)·2^(1−k)` covers what the dropped octaves could add;
   - octaves finer than ~2 pixels are dropped, and so are those beyond 2 km (`octT`: 9 octaves within 2 km, easing
     to 5 by 20 km);
   - step lengths trust the local ruggedness, since lowland slopes are gentle;
   - then 5 bisection steps.
4. Altitude along the ray is `(t²−2tb+cc)/(|p|+R)`, with `cc` from the CPU in float64, so it's centimetre-accurate.
5. A quarter-resolution **pre-pass** (`PDEPTH`, R32F target) marches first. The full-res pass starts just short of the
   nearest coarse hit among its 3×3 neighbours.

Shading:
- Normals come from the height field over ~1.5 pixels.
- Biome colours blend over the climate map (`uClim`, RGBA16F: T, W, U).
- Rock on steep faces; snow and ice only below ~35°; basalt on volcanic arcs; salt pans; wetlands; beaches.
- The sea is coloured by real depth.

**Placement on the ground.**
- The pad mesh and the launch complex stand at `WORLD.siteH`.
- City buildings stand on the terrain under each one (none in the water).
- The ship's ground shadow and the camera clamp use the real ground.
- The construction screen (`builder.js`, one line) hangs the ship over the pad's height.

### The world (seed 13, R 1,274 km)
- **Land:** 37% of the surface, with 20 plates.
- **Heights:** peaks to ~9.3 km; the base map ranges from −5.8 to +9.3 km.
- **The pad:** at 157 m on the tip of an equatorial peninsula. The coast is 25–50 km east, then open ocean for 700+
  km. The world is turned so the pad is at planet-fixed +X; it's at longitude −79.6° in the generator's own frame.
- **Biomes:** sea 63% · grassland 7.5 · tundra 4.9 · taiga 4.1 · ice 4.0 · hot desert 3.8 · savanna 3.3 · cold desert
  2.7 · temperate forest 2.4 · rainforest 1.9 · steppe 1.1 · alpine 1.1 · volcanic 0.3. Salt flats and wetlands
  are effectively 0 since the wetter climate (open thread).
- **Powers** (the economy session's `makePowers`, on this land):
  - Ordun's land starts at 10°S and Haval's at 14°N: **two powers can't reach the equator**.
  - The other three straddle it.
  - Territories are still big Voronoi cells. Smaller ones, or land owned by no one, would sharpen the asymmetry.
    That's the economy session's call.
- **Seed choice:** surveyed seeds 1–30 for an equatorial east-coast site and powers cut off from the equator. Seed 12
  was the runner-up.

### Measurements
- **CPU vs GPU height** (`terrainProbe()`, 4,096 random directions plus 1,024 near the pad plus 1,024 in mountains):
  - global: median 1.7 mm, p99 3 cm, max 14 cm;
  - near the pad: max 2 cm;
  - mountains: max 10 cm.
  - Before `patan`: 0.1–0.4 m, more on steep slopes.
  - Before the integer hash, a float hash could disagree by whole lattice values: tens of metres.
- **GPU cost**, RTX 3050 laptop, 1024×768 canvas, the game's own timer (`gpuMs`), whole frame:
  - pad view 4.2 ms;
  - coast from 1.5 km 3.2 ms;
  - rugged hills at a grazing angle 8.8 ms;
  - orbit about 2.5 ms;
  - without terrain: ~2.0–2.6 ms.
  - So terrain roughly doubles the sky pass near the ground, and more in grazing rugged views.
  - Timings in the hidden in-app pane swing ±15% between identical runs; compare only within one session.
- **Generation:** `makeWorld` 0.4–0.85 s; the SIM loads in 0.8–1.4 s (it was 0.7 s at 600 km with the old land mask).
- **Tests:** 116/116, including the existing suites, unchanged in what they check.

### Negative results and traps (worth reading before touching this)
- **A float hash can't be shared between CPU and GPU.** `fract(sin…)`-style hashes depend on whether the GPU fuses
  multiply-adds, so whole lattice values differ. The old land mask survived only because coastline margins hid it.
  Height can't hide it: use integer hashes.
- **GPU `atan`/`asin` are approximate (~1e-5 rad).** That moved texel lookups enough for decimetre errors. A
  hand-written `atan2` fixed it at no measurable cost.
- **Bilinear height → visible facets.** It's continuous, but its slope kinks at every texel edge, and lighting shows
  slope. Two attempts at a fix:
  - A **cubic** B-spline over 4×4 texels with loops and dynamic `vec4` indexing **doubled the frame cost**.
  - A **quadratic** B-spline (C1 is enough for normals), 9 fetches, unrolled, costs nothing measurable. It never
    overshoots, so the `U` bound stays valid.
- **The march is bounded by its slowest pixel group, not by octave count.** Cutting octaves (level of detail ×6 or
  ×12) barely moved the cost. Warp divergence near the horizon dominates, where some rays creep along just above the
  ground. What worked:
  - the clear-air bound;
  - ruggedness-aware step lengths;
  - longer minimum steps at distance;
  - the pre-pass (about 10%).
  - The hash finalizer and the 9th octave were within noise.
- **The near-field detail had an old 15% brightness step.** Ground colour was multiplied by `.85+.3·det·fade`
  inside 4 km and not at all outside. It only became visible as a large arc on the new flat plains. The bug dated
  from v1.10; it's now ×1 at fade 0.
- **Climate first came out far too cold.** 2 °C at 44° snowed over every hill. It's now fitted to Earth's zonal means.
  Mid-latitude interiors also came out mostly desert until inland drying slowed (2,200 → 3,500 km) and base wetness
  rose.
- **A uniform 8 km snow dome reads as a white blob.** Snow on steep faces plus 0.8 albedo through the tone curve
  erased the relief. Rock now shows on faces over ~35° and snow is 0.6. The relief itself was too gentle: 22° at
  most over 100 m, now `RIDGE_A` 4200.
- **East is decreasing longitude** in this codebase's `atan2(z,x)`. The first winds and site search had it backwards.
- **Tests can depend on geography without saying so.** After the regeneration, the foreign-station lease test's first
  foreign city belonged to a power drifting hostile within the 100 days. It now picks a city of a friendly power.
- **The merge with main** needed main's new `cloudAt` back on the float `h3/vn/fbm` port, which the terrain had
  replaced. They're restored next to `cloudAt`.
- **Tooling traps in the in-app preview:**
  - When the pane is hidden, `computer` screenshots return a stale frame and `requestAnimationFrame` stalls. Capture
    the canvas yourself instead (`toDataURL`, then POST to a local endpoint).
  - Nesting your own `TIME_ELAPSED` query inside the game's breaks its timer. Read `gpuMs` instead.
  - The first frame after swapping a shader program is garbage.
  - The browser caches `builder.js`: fetch with `{cache:'reload'}` after editing it.

### Files and tools
- `index.html`:
  - SIM: "the world" block (`ih3`/`tn`, `makeWorld`, `wSpl`/`wBil`, `hgtGen`, `siteSearch`, `terrainH`,
    `groundAlt`/`groundR`, `biomeAt`, `TERR_TOP`/`terrainSlope`).
  - `groundCheck`, `stepDebris`, `fall`.
  - SKY_FS: `patan`, `wTexUV`, `hgtG`, `terr`, `octF`/`octT`, `march`, `coarseStart`, `tellus`.
  - JS: `WORLD_TEX`, `PDEPTH`/`depthTarget`, the sky-pass setup in `render()`, `cityMesh`, pad and shadow placement.
- `terrain-probe.js` (load it into the page like `views.js`):
  - `terrainProbe()` measures CPU/GPU height agreement. Rerun it after any change to the height function on either
    side.
  - `overView(lat, lon, alt, yaw, pitch, dist, hour)` puts the camera over any spot at a local hour.
  - `gpuTime()` times frames, but conflicts with the game's own timer; prefer reading `gpuMs` after ~20 renders.
- **Seed survey:** load the SIM block in node with `WSEED` replaced. Report `WORLD.siteFound`/`siteH`, each power's
  latitude range via `powerAt` on a 2–4° grid, and biome shares via `biomeAt`. Render maps from `biomeAt` per pixel.
  The scripts lived in the session scratchpad, so rebuild them from this description: about 30 lines each.

### Next session: where to pick up
0. ~~**Ground awareness**~~ done in v1.29 (§ v1.29); ~~surface properties by biome~~ done in v1.37 (§ v1.37). ~~the slice-B follow-ups~~ (v1.45) and ~~slices C–E~~ (v1.48) done too.
1. ~~**Launch sites (slice B).**~~ Done in v1.27 (§ v1.27). The original brief, kept for reference: see the plan above for the design and numbers. Start with a `SITES` list in the world
   block, generated by a generalised `siteSearch`: flat, low, a coast within ~150 km, open water downrange, any
   latitude. Then a site per flight, and replace the +X assumptions.
   - The pad levelling becomes per site: `terrainH` and the shader's `terr` (a uniform array of sites).
   - Coordinate with the builder session (the site picker in the construction screen) and the economy session
     (`makePowers` and `PAD_GS` assume the pad at +X; site ownership and leases).
   - **Hand-off from the economy session (2026-10-07): what the economy layer needs from launch sites.** Geography is
     the last power-flavour axis, and Caio chose to build it as slice B here first, with economy on top afterwards. The
     economy side will add site ownership, foreign leases priced by relations, loss of access under sanctions, and the
     politics of launching over a neighbour. To keep that a thin layer, please:
     - **`SITES` as plain data in the SIM block,** one entry per site: `id`, `name`, `u` (planet-fixed unit vector),
       `lat`, `h` (pad height), `power` (index, from `powerAt(u)`; null at sea), `coastal` (bool), `maxDia` (largest stage
       diameter it can take: rail limit inland, barge at the coast), `downrange` (azimuth plus the powers whose land lies
       under the first ~1,000 km of the ascent), `polar` (a clear corridor south or north), and `kind` (`'pad'`, later
       `'sea'`).
     - **The chosen site lives on the flight** (`S.site` or `newShip(stack, site)`), so missions, incidents and the
       flight record can read it. Economy will record `R.site`.
     - **One gate economy owns:** before a launch, call `siteAccess(site)` → `{ok, why, fee}`. Economy defines it in the
       program block: own sites ok, foreign ones leased or refused, sanctions block. Until it exists, default to "home
       sites only, free". The builder's site picker should show `why` when `ok` is false.
     - **Power homes:** `makePowers` seeds power 0 at planet-fixed +X, the current pad. If the world stops being turned to
       put the home site at +X, seed power 0 at the home site's `u` (a one-line change in economy code; go ahead, and
       say so in the log). `HOME` can change at runtime (defection), so home sites are always `SITES.filter(s =>
       s.power === HOME)`, never a stored list.
     - **Other +X assumptions on the economy side:** `PAD_GS` (the pad ground station, planning's code) and the
       recovery-demonstration contract (`landDist` is measured from +X). Point them at the flight's site; the
       contract's text already says "the pad".
     - **Leave economy rules out of slice B:** no fees, ownership politics or sanction checks. Sites should be able to
       exist abroad from day one; a foreign site is simply refused until economy's `siteAccess` arrives. Economy then
       adds leases, a lease line on the budget, sites closed when relations sour (as ground stations already are),
       westward-launch politics, and site choice in contracts.
2. **Cost of low grazing views** (8.8 ms at 1024×768 over rugged hills).
   - Ideas: a temporal reuse of last frame's depth; a cheaper hash (exactness only matters near the camera, so
     distant octaves could come from a 3D noise texture with hardware filtering); fewer octaves beyond ~5 km.
   - Check in a real browser; the in-app pane's timings are noisy.
3. **Look.**
   - The coast is smoother than wanted.
   - The pad's levelled disc shows as a faint terrace from altitude.
   - High ranges are almost all ice (right at 7–8 km, but monotonous).
   - Salt flats and wetlands vanished with the wetter climate (re-tune their masks).
   - Distant land is washed out by the haze of the rescaled atmosphere (that's the visuals/rescale side).
   - A soft curved shading edge remains on the 44°S plain. It's not the distance level of detail; probably a real
     slope (unconfirmed).
4. ~~**Stations with terrain (C), recovery (D), biome science (E)**~~: done in v1.48 (§ v1.48), with what's left listed there.
5. ~~**The world map / atlas view:** biomes and borders as an overlay on the map view would make the geography legible
   in play.~~ Done in v1.52 (§ v1.52).

## v1.24 — power flavours, first slice (2026-10-07)

The design is in "Power flavours" in the program-design section. This slice covers openness, money, priorities,
nationalism, the start choice and the security state's regime change. Industry and geography come later.

- **Archetypes** (`ARCH`): open superpower, closed superpower, rising power, frugal middle power, resource state,
  security state. Generated worlds: the two biggest economies (economy × tech) become one open and one closed
  superpower, decided by their second alignment axis. The rest follow what they have: rich and low-tech → resource
  state, strongly aligned → security state, high tech → rising, otherwise frugal or rising. **Start:** pick your
  power's archetype in the Program panel, or "Random world" (whatever the launch site's power was generated as).
  `flav(i)` follows `HOME` through defections.
- **Openness:**
  - Open programs (≥ 0.6) take failures in full and hold **elections** every 400 days. Popularity on election day sets
    the budget for the term (×1.25 above 55 opinion, ×0.7 below 40), with a warning 50 days before.
  - Closed programs take 40–50% of a failure's hit at once ("Officially, nothing happened"). The rest, ×1.5, is
    deferred as **leak** risk, which grows with each hidden failure.
  - Closed programs also get **spectacular demands**: a first or a 40M+ contract within 60 days. Delivered: +8 opinion
    (+30M under patronage). Missed: −10.
- **Money** (`moneyK`, multiplying each shareholder's budget day):
  - taxes: by opinion and the business cycle;
  - commodity: its own ~500-day price cycle, measured at ×1.64 in a boom vs ×0.36 in a bust;
  - patronage: half-size budget days, plus lump sums for firsts and spectaculars;
  - military: grows with the power's worst tension (×0.70 calm → ×1.33 tense);
  - rising powers' budgets grow ×(1 + day/800), capped at ×2.
- **Priorities:** home's priorities set offer rates per source (×0.4 to ×1.6). A client's priorities set what it pays.
  Rivals race faster the more they want prestige. A first in the world is worth 1 + 2 × home's prestige appetite
  (1.7× for an open superpower, 2× for a closed one).
- **Nationalism** (`natOf`): starts at the archetype's level and moves toward that level + 0.3 × the power's worst
  tension (200-day time constant). Measured: 0.30 → 0.55 over 400 days of a standing feud. It scales home's reaction
  to foreign stakes (×3.4 from 0.1 to 0.9), hostile clients, private hires, losing a race, and winning one. Foreign
  contracts done raise home opinion when it's low and cost some when it's high.
- **Regime change** (security states, mostly-state program, home opinion < 35, ~1/600 per day): the program is
  cancelled. Two offers replace any pending career offers: a power takes the team, or it goes private as "… Space
  Collective". Ignore both and it goes private anyway.
- **Resource states are the natural buyers** of teams in career moves (scored ×1.6).
- **One-line flavour** in the world section; rivals tagged by archetype.
- **Found while testing:** the leak was applied with the wrong sign (a scandal raised opinion), now fixed. Cancellation
  now replaces pending career offers instead of adding to them.

`test.mjs` §19: 8 new checks; 118 total. Two older checks were pinned to an archetype, because the generated home is a
closed superpower (patronage budget, 2× firsts).
## Procedures: automation that adapts, and a dispatch brief (2026-10-08, bodies session)

Caio wants missions that can run themselves, so repetitive flights are optional, with **a better hand-flown flight improving every
automated one after it**, and exact replay can't do that everywhere. The v1.8 tapes record every input and replay **open-loop**:
perfect when nothing differs, blind when anything does (an ignition failure the recording didn't have, a moved docking
target, a contract's different orbit, any design change, a chaotic leg, a physics change).

**1. Tapes can't go stale any more.** `TAPE_V` was the hand-bumped `'lp-1.12'`, unchanged through a dozen physics changes since,
so a saved tape would have replayed against new physics and silently diverged. It's now a fingerprint (`hashStr`) of the
functions and data that move a craft (`physStep`, `rails`, `coastStep`, `pertAcc`, `aeroPass`, `thermal`, `structLoads`,
`stage`, `detach`, `abort`, `igniteOK`, `procStep`, …, plus `PARTS` and the bodies). Any change to them retires old tapes. A
logbook record whose tape predates the current physics says so when loaded.

**2. Procedures: a flight's intent, not its keypresses** (`procSample`, `procKeep`, `procStart`, `procStep`, `PROG.procs`).
v1 covers the ascent to orbit, the flight repeated most.
- *Recorded* from every flight off the pad (sampled in `advPhys`): pitch above the horizon and throttle against altitude, the
  heading, staging done before a tank ran dry, the first cut-off, and the orbit it ends in.
- *Kept* per design once the craft is in a stable orbit with its engines off, **only if it beats the stored one** (less Δv
  spent to orbit). A better hand-flown ascent becomes the procedure, with a news line, and every automated flight after uses it.
- *Flown* by `procStep` through **SAS `stab` holds** (real torque, real staging), cutting off on **goals** (the ascent's own
  cut-off apoapsis, then periapsis at the circularisation), not times. A target override retargets the cut-off and the
  heading (inclination from the site's latitude). In the game: **▶ Procedure** on the pad; any control key takes over; the
  coast to the burn warps; a procedure-flown flight can't be saved as a tape (it's already automated).

| Check (§28) | Result |
|---|---|
| a hand-flown Orbiter ascent → procedure | 448 pitch points, heading 90°, 102 × 118 km, 4,445 m/s |
| the procedure flies the same design | 103 × 111 km for **4,446 m/s** (hand-flown 4,445) |
| retargeted to a contract's 180 km | 180 × 184 km for 4,538 m/s |
| a heavier variant (4 t upper tank: +2 t, TWR 1.41 vs 1.63) | 103 × 110 km for 4,507 m/s |
| a variant that can't make orbit (+0.5 t, 4,329 m/s in all) | never claims success |
| a lazier hand flight (4,778 m/s) | doesn't replace the 4,445 procedure |

In the browser: ▶ Procedure → ascent → coast (warp) → circularisation → in orbit at T+287 s.

**What it taught:**
- **A procedure is a technique tuned to its design.** On a design with much lower thrust-to-weight (+0.5 t payload *and* a 4 t
  tank: TWR 1.37), the Orbiter's pitch curve reaches space but ends 42 × 102 km, about 70 m/s short after 4,898 m/s. It works,
  but it wastes Δv. So procedures stay per design, and a new design earns its own by being flown.
- **The ascent's cut-off isn't the final apoapsis.** The first version aimed the ascent at the final orbit's apoapsis (118 km;
  the circularisation had raised it from 110), kept burning past the end of its pitch table and fell back. It also stored the
  cut-off as a 0 throttle setting. Both are fixed: the cut-off apoapsis is kept, and only powered samples go into the tables.
- **A landed craft with its engines off is on rails,** where `advPhys` never runs, so the first in-game version sat on the pad.
  The procedure now lights the engines when started, and the game loop keeps a procedure on physics except during its coast.

### Procedures v2: whole missions (2026-10-08)

A mission procedure is the ascent plus a list of **phases**, each a guidance law with the parameters the flight chose:
`transfer {to, pass}`, `capture {pe, ap}`, `land`, `surface {t}`, `ascend {stage, pitchH, pe, ap}`, `return {perigee}`. They are
ported from `fly_crewlunar.mjs` but **steered through SAS** (`aimAt`: a burn waits until the nose is on its direction).
Corrections are impulses found with the predictor (`solveDv`). Coasts set a wake time, so the game warps to them.

**Extraction.** After the ascent, the recorder keeps a mission log (`procMission`, sampled in `advPhys` *and* `advRails`):
- SOI entries and exits;
- the pass, as the osculating periapsis right after SOI entry or the last trim (what the executor's trim aims at);
- the last closed orbit before landing (the capture);
- landing, take-off, and the stages dropped on the surface;
- the orbit after take-off;
- the **vacuum perigee the craft came in on** at the top of the air.

When the craft is home and well (the crew alive, if crewed), that becomes a procedure for the design and the mission
(`Selene:land`, `Selene:orbit`), kept only if it spent less Δv in all. The pad shows one button per procedure of the design.

**Measured** (§27): the hand-written flight is recorded as `transfer 39.8 km → capture 30×220 → land → 600 s → ascend 15×18 →
return 45.7 km` (8,672 m/s). The executor flies it through SAS: crew on Selene and home in 1.85 days, 4.0 g, splashdown 6.5
m/s. Its 8,600 m/s **replaces** the hand-flown 8,672, so the procedure improves itself. In the browser the "Selene land" button
flies ascent → transfer → capture → landing → take-off through the game loop.

**What it taught:**
- **Record where the decision is measured, not where its effect ends up.** Two recorder mistakes would each have killed the crew:
  the "pass" read near closest approach (12 km, after three hours of Tellus's tide) instead of right after the trim (39.8); the
  return "perigee" taken as the lowest point of the entry, which is the ground (0.55 km → 26 g). The fix is the quantity the
  executor itself targets, measured at the moment it targets it.
- **A search needs a slope.** Twice, an objective clamped at the ground (the integrated path's lowest point on an impact leg) left
  the optimiser nothing to follow: a 2 m/s "correction" into a −0.6 km perigee, 8 g. On impact legs the osculating perigee
  (negative) gives it one.
- **Choose the smallest burn that's good enough, within what's aboard.** The return scan weighted 1 m/s against 20 m of perigee
  error, picked 620 m/s with 554 aboard, and stranded the crew. Now it takes the smallest burn within 90 % of the fuel that gets
  within 50 km (the correction does the rest).
- **In the game, engines-off in orbit is on rails:** the recorder runs in `advRails` too, or it would never see an ascent end.
  It runs *after* each physics step, so it sees a landing in the step that made it. Starting from the first second off the
  ground, it also covers flights that light their engines before their first step.
- **Circularise toward a circular-orbit velocity, not "hold the horizon until periapsis".** Started a little late, the old law
  raised apoapsis to 805 km; the new one is robust to timing.

**To Nyx through the same phases (2026-10-08).** Nyx is tilted 30° and eccentric, so the transfer meets it at a **node** (where it
crosses our equatorial plane; `transferNode`), taking the far one (20,355 km, where Nyx is slower) on a Hohmann-like ellipse,
leaving on the parking-orbit pass nearest the ideal time. The leftover timing is the mid-course correction's job, and when the
predictor shows no encounter yet, the correction minimises the closest approach (`passScore`), with up to three passes. The
return scan for an eccentric moon covers a wider burn range (200–1,500 m/s), counts **everything aboard** (an empty stage drops
on the way), and only accepts trajectories that reach perigee within **2.5 days**.

Crewed Lunar, flown by a "Nyx land" phase list (§27): wait 29 h for Nyx's node passage, burn, a 10 m/s correction, capture
(~470 m/s), land at **1.2 m/s**, ascend, burn home (425 m/s, dropping the empty lander mid-burn), correct 131 m/s to a 44 km
perigee, splash down at 6.5 m/s: **3.35 days**, 4.1 g, crew fine, 7,479 m/s in all. It records itself as a "Nyx land" procedure.

What the Nyx flight found (the Selene flights had hidden all of these):
- **Count parking-orbit passes on the real orbit.** Picking the departure pass by 2πr/v from the current radius drifted by tens of
  degrees over a 29 h wait (the orbit is 102 × 111 km); the burn left Nyx's node 61° off and the corrections chased a
  17,000 km miss. `timeToNu` on the actual elements: 2.6°.
- **On rails, a SAS hold doesn't turn the craft.** After a long coast the stack wakes pointing where it was. Burns now wake
  `ALIGN` (600 s) early to turn, then fire on time (`X.tBurn` vs `X.wake`).
- **The suicide burn must count only the upward thrust.** Falling 100 km in Nyx's weak gravity, the stack's nose wandered
  15–50° on its wheels; the trigger assumed all the thrust pointed up and hit at 120 m/s. Now: the vertical component of
  thrust, and 30 % in hand.
- **"Don't stage the capsule loose" must not mean "never stage".** The guard also blocked staging to a full return stage; it now
  stops only when the current stage is the last with an engine.
- **The cheapest way home can take 18 days.** It flew outward first; the crew ran out of air at day 10.

**Flybys and free returns (2026-10-08).** A new phase, `home {perigee}` (the back half of `return`: out of the moon's SOI, a
correction to the perigee, shed the stage, entry, chute). The recorder keeps a flight that passes a moon without capturing as a
`B:flyby` procedure at the SOI exit (`transfer` only, with its pass), and, if it then lands home well, as `B:free-return`
(`transfer`, `home`). Crewed Lunar on `transfer Selene 400 km → home 45 km` completes **"Crew around Selene"** in 1.33 days and
records both. Its home correction is 286 m/s: whether a pass returns by itself depends on which *side* of the moon it goes,
and the transfer phase only aims for an altitude. A hand-flown free return that needs less will replace it.

**Aiming a free return (2026-10-08).** When the phase after a transfer is `home`, its corrections (and the trim inside the moon's
SOI) aim at **the perigee it will come home on after the flyby** (`homePe`, read off the predictor's chained legs), with the
pass allowed anywhere within half its planned height. The same free return as before now needs **4.9 m/s** on the way home
instead of 286 (two mid-course corrections of ~50 m/s set up a pass that comes back by itself); 5,812 m/s in all instead of
6,025.

**Debris** near the moons now feels their tides too (`stepDebris`, the same pointwise test as `physStep`).

**Registered satellites still ride pure Kepler, deliberately, for now.** Measured against the integrated orbit:

| orbit | off the Kepler path after 30 days | Ap / Pe change |
|---|---|---|
| low, 300 km | 5 km | ±0.2 km |
| polar, 1,000 km | 39 km | ±0.75 km |
| navigation, 3,000 km | 500 km | ±6 km |
| **stationary (TV)** | **10,750 km** | +31 / −144 km |

Nyx is heavy and close, much more so than the Moon is to Earth, so a stationary satellite would really drift a quarter of the way
round in a month. Giving the registry the tides would make the TV mission pay for days unless satellites carry propellant
to hold their slot. That's the design notes' "satellites age" idea: **a satellite's life = station-keeping propellant ÷
drift rate**, with servicing or replacement missions after. It's a gameplay decision for Caio with the sats and economy
sessions, not a physics fix to slip in.

**Open:** station-keeping and satellite lifetimes (above); dispatch
(economy) can now run whole missions headless.

**3. Dispatch: a brief for the economy session** (Caio: "dispatch designed with the economy session"). Not built. Whatever
the economy decides, this is what the physics side offers:
- **Real outcomes, cheaply.** A procedure flown headless is the game's own physics: ~1 s of CPU for an ascent; 15 s for the
  whole crewed Selene mission (`fly_crewlunar.mjs`). A dispatched flight can run between flights and come back with a real
  result (orbit reached or not, Δv spent, an ignition failure, a breakup), not a dice roll.
- **What a procedure can promise:** the orbit it was proven to, retargetable within its design's margin (it reports failure
  rather than faking success). Today that means orbit only; transfer, landing and return procedures would follow the phases
  `fly_crewlunar.mjs` already uses.
- **Questions for the economy:**
  1. Which contracts can be dispatched? Those whose target a stored procedure can reach, for its design.
  2. Does an automated flight earn the same? (A pilot's precision bonus, opinion for a first done "by hand"?)
  3. Time and cost: the same stacking days and launch fees as a flown launch? Can several be queued?
  4. Risk shown before dispatch (from the procedure's margin and the parts' know-how)?
  5. How results reach the player: a news line, the logbook, a short replay?
  6. Should a first in the world ever be dispatchable, or only repeats?

**Dispatch — the economy's answers, decided with Caio (2026-10-08, economy session).** Dispatch is what routine runs (§
"Rich programs") are built on: a stored procedure flown on the game's own physics, not a dice roll.

1. **What can be dispatched:** contracts whose target a stored procedure has proven it can reach with that design. Only
   ever **repeats**: every kind of flight needs a manual run-through first. A player may automate *part* of a run they
   previously flew by hand (below).
2. **Same pay as a flight flown by hand,** including any precision bonus, which comes from the real result. The
   incentive to keep playing (possible, never required) is a more efficient procedure: a better hand-flown flight
   replaces it.
3. **Same stacking days, launch fees and studies** as a flown launch. Dispatches queue on the timeline and take pad
   slots. **No automatic improvement with repetition** (Caio: improvements are player-led). What gets better is the
   success chance, through part data the player earned.
4. **Risk shown before dispatch,** from all the part data, not just ignition:
   - the procedure's margin;
   - know-how (ignition, stacking);
   - certification (how well the loads are known);
   - test-stand and flight data.

   **Good part data narrows the estimate** (a tight range instead of a wide one) **and raises the chance of success.**
   This deepens what part data is worth.
5. **Results:** a timeline event, a news line and a logbook entry. **Two modes, as in Bannerlord's battles:**
   - **auto-resolve:** headless, about a second for an ascent;
   - **watch:** the same flight rendered, which you can **jump into** while it's in progress.

   The random factors (ignition rolls are already deterministic per flight, kick and part) are **fixed by a seed at
   dispatch**, so watching and auto-resolving give the same outcome as long as you don't touch anything. No re-rolls.
   **Taking control breaks the dispatch:** the rest of that mission is manual.
6. **Firsts in the world are never dispatched.** Only repeats.

**From these, the parts that make it a game:**
- **Deviation, not bare failure.** When a procedure can't meet its goal (an engine that didn't light, Δv short, the
  compute era's guidance error), it doesn't just fail. The flight deviates and **calls for you**:
  - time stops with the flight at that moment (a timeline stop, like a deadline);
  - you take over, sometimes in a crisis: a stage that didn't light, an orbit decaying.

  With auto-resolve, the headless run stops at the moment of deviation and the game drops you into that same state.
- **No revert on a dispatched or taken-over flight.** Otherwise you'd re-roll the launch until it went well. More
  punishing than KSP, deliberately (Caio).
- **Partial dispatch, both ways:**
  - dispatch *up to* a point (e.g. to parking orbit), then hand over;
  - fly the first part yourself and hand a later phase to a procedure, but only a phase that design has flown by hand
    before.

  Each handover is a timeline event.

**How much change to a part or design needs a new run-through?** (open, Caio unsure) Proposal:
- **Development that doesn't touch physics never invalidates a procedure.** The v1.34 goals (cheaper, more reliable,
  more durable) change price, ignition odds and wear, not the trajectory. The stack and its parts are unchanged, so
  `procKey` already keeps the procedure.
- **Anything that changes the physics** (a different part, mass, thrust, staging) makes a new design. Rather than a fixed
  rule, **measure it:**
  - The trajectory office **dry-runs** the old design's procedure on the new design, headless. That dry run is a
    trajectory study (v1.38): the era's days and money.
  - If it reaches the goal with margin, the procedure becomes **provisional** for the new design: dispatchable, with a
    wider risk estimate.
  - Flying the new design by hand once makes it the design's own.
  - A dry run that fails, or a change in staging structure (stage count, engine roles), needs a manual run-through.
- The §28 checks show this is the right shape: the Orbiter's procedure flies a +2 t variant to orbit, but a much lower
  thrust-to-weight variant arrives ~70 m/s short. Margin is measurable; a rule would be guesswork.

**Owners:**
- economy: the dispatch order, pad calendar, risk estimate, pay, the deviation stop on the timeline, no-revert;
- bodies: headless dispatch runs, deviation detection in `procStep`, phases and partial procedures, the dry run;
- UI / app: watch mode, jumping in, the handover.

### The ladders, proven with real rockets (2026-10-08)

Every epoch 4–5 uncrewed mission has now been flown from the pad by the procedure executor. Each flight starts with only
that mission's prerequisites done, and the mission's own check decides whether it counts. The flights are in
`fly_ladder.mjs` (`node fly_ladder.mjs [ids] [-v]`), and test.mjs § bodies-1 runs them all in about a minute.

**Presets** (both in `PRESETS`):
- **Probe**: antenna, camera, instruments and a core on t4 t4 + Petrel, carried by the Lunar launcher. It has
  ~1,900 m/s to spare past a transfer.
- **Sample Return**: chute, pod, instruments and shield, on a t2 + Wren return stage. Below that, a t4 t4 t2 + Petrel
  transfer-and-descent stage, carried by the Big Lunar launcher with two radial boosters.

| Mission (pay) | Preset | Phases | Δv in all | Left | Days |
|---|---|---|---|---|---|
| farside (150) | Probe | transfer: far side, sunlit on arrival, 150 km pass | 5,837 | 2,926 | 2.8 |
| selimp (120) | Probe | transfer: near side, pass −0.4 R (an impact) | 5,789 | — | 0.8 |
| selland (250) | Probe | transfer (near) · capture 20×200 km · land | 7,129 | 1,634 | 0.8 |
| selsample (400) | Sample Return | transfer · capture 15×100 · land · surface · ascend · return | 8,389 | ~300 at the burn home | 1.3 |
| nyxfind (120) | Probe | transfer to Nyx (tracked on the way) | 5,740 | 3,023 | 2.7 |
| nyxfly (150) | Probe | transfer, 200 km pass | 5,713 | 3,050 | 1.5 |
| nyxorb (250) | Probe | transfer (retrograde) · capture 30×80 km | 6,201 | 2,561 | 4.3 |
| nyxland (300) | Probe | transfer · capture · land | 6,601 | 2,161 | 1.7 |

The Probe costs 127–156M and the Sample Return 188–217M. Price depends on program state: fresh, or with know-how and
production.

**New transfer options.** These are phase fields, scored as penalties on the predicted pass:
- `side: 'near'|'far'`: which side of the moon holds periapsis, as seen from its parent. For an impact, it is the
  impact point.
- `sunFar`: wait for a departure that arrives with the moon on the sun's side, so the far side is lit.
- `retro: true|false`: whether the pass runs against or with the moon's orbit.

Landing-site targeting is near side or far side for now. A specific crater would need the capture phase to choose its
plane and periapsis longitude; that is still open.

**What broke, and the fixes.** All are in the executor or the predictor, so every procedure benefits.
- `passScore` crashed on any predicted miss. A `const` had been swallowed onto a comment line. This was latent on
  `main`.
- The trim scored the osculating periapsis at SOI entry. Tellus's tide moves it by tens of km over the ~3 h to
  periapsis: a 31 km aim became 114 km flown, and a 15 km aim became −20 km, an impact. The trim and the corrections now
  score the integrated pass. A path that hits the ground is scored by the osculating periapsis at impact, which gives a
  search a slope to follow.
- The capture and landing burns re-time themselves on waking, 10 min out, because the tide shifts when periapsis comes
  too.
- The landing deorbits first: a small burn at apoapsis brings periapsis down to 5 km (`ph.pe`). Braking at 30–40 km and
  then falling cost ~√(2gh), about 300 m/s. This saved 130–150 m/s on the probes. The crewed v2 mission now reaches its
  burn home with 955 m/s aboard instead of 525.
- Braking hysteresis. At 15 m/s of drift, the descent kept flipping back into braking, which holds the throttle while it
  aligns. A Probe fell 2 km that way and crashed at 80 m/s. It now brakes once and tilts out whatever drift is left.
  The braking uses main's velocity over the ground (Selene now rotates).
- The ascent leaves behind a stage that can't reach orbit by itself, when there is one under it that can. A lander
  stage that finished the descent itself, with no high drop, had tried to lift a crew on 136 m/s.

**Found while flying (for the economy session):** (answered in v1.53: Nyx is found only by a flight launched to look
for it, and every first pays at least 1.3× its rocket)
- **nyxfind comes free.** A probe with instruments and an antenna, flying to Selene, collects its 12 h of residual
  ≥ 1e-3 on the way, so nyxfind completes on the farside flight. Either that is fine (the first lunar probes discover
  Nyx), or the threshold should be higher, or tracking should need a deliberate high orbit.
- **Two missions pay less than the rocket costs.** selimp (120) and nyxfind (120) each take a 127–156M Probe plus
  operations. A smaller impactor would do, since it needs no capture or landing Δv, but no preset is sized for it yet.
  selland (250) and nyxland (300) clear their cost; selsample (400) pays about twice its rocket.
- **"Watch which way round you go" is real.** The same 30×80 km Nyx orbit lasts two Nyx periods when retrograde. Forced
  prograde (`retro: false`), it hits Nyx 61 h after capture. A 100×300 km orbit is stripped within 27 h either way,
  because Nyx's SOI shrinks to ~260 km altitude at Nyx's periapsis.

### Dispatch, the physics side: flown, not rolled (2026-10-08)

This is the bodies half of the dispatch brief (part 3 above). The economy's dispatch (§38–39) left a slot for it:
`dispatchRun(D, v, c)`. That slot is now filled, so a dispatched contract is **flown** by its procedure. Test § bodies-2
covers it.

**Deviations in the executor** (`procDev`). A procedure that can't meet its goal now stops, says why, and hands over the
craft. Before, it flew on and never claimed success. `s.procDev = {kind, why, t, phase}` records what happened. The
watched game shows "Procedure stopped: … You have control". The kinds:
- `short`, in the climb: everything burned and apoapsis still low.
- `short`, at engine cut-off above the air: the propellant aboard is below the circularisation burn. This is the
  earliest point it's knowable, and the craft is handed over while coasting up to apoapsis, as the economy's
  deviation state (`devState`) assumed.
- `short`, while circularising: everything burned with periapsis still below target.
- `relight`: rolled from part data, not flown (see below).
- `offcourse`: three mid-course corrections and still no encounter.
- `nohome`: no burn home within what's aboard. This used to end the procedure silently.
- `lost`: the procedure's time limit ran out.

**The corridor (Q12)** (`procCorridor`, during the ascent). These rules catch a climb that has already failed, while the
craft is still alive and somewhere a pilot can act. They're kept loose on purpose: a heavier variant flies lower and
slower and is still fine, so there's no tight band around the recorded profile. The recorder now keeps speed against
height (`proc.vel`).
- `control`: the nose more than 20° off the commanded climb for 5 s. A 2 s tumble the SAS recovers from doesn't count;
  an 8 s one does.
- `falling`: coming down under power below the cut-off. The +2 t Orbiter variant used to burn up three minutes later;
  it is now handed over alive at 58 km.
- `slow`: above 10 km, under 70 % of the recorded speed at that height.

**`procFly(stack, proc, target, opt)`** flies a procedure headless. It runs the same executor and physics as a watched
flight, but in isolation:
- Whatever is in progress is set aside and put back afterwards: S, the clock, the fleet, debris, the moons' clock
  (`ORB_T0`) and the hooks.
- Its record is closed (no costs, missions or logbook), and it records no procedure (`s.noRec`).
- It launches from the home site at the start of the current day, so the ground under it is where it should be.

It returns one of:
- `{ok, orb, dv}` in orbit;
- `{dev, entry}` on a deviation, where `entry` is a registry entry of the craft at that moment and `vesselOf`
  rebuilds it exactly (position and propellant);
- `{ok:false, why}` if lost (the reason comes from the flight's last "Destroyed"/"burned up" message).

An ascent takes 0.4–0.7 s of wall time headless, so `dispatchTick` can fly dispatches inline.

**`dispatchRun`**. What the parts data models but the physics doesn't stays a roll, with the dispatch's own seed and in
the same order as the interim resolver:
- break-up (certification);
- an engine that won't light in the ascent (know-how, lines, development);
- the upper stage's relight. A failed relight is flown up to the circularisation and handed over there.

Running short is no longer rolled from a margin: the physics decides, and the orbit reached is the one flown, not a
scatter. The same seed flies the same flight. A stored procedure with no guidance to fly falls back to the roll (an old
save, or the economy's test stubs).

**Dry runs** (`dryRun`, `procAdopt(stack)`). A new design with no procedure of its own tries every stored orbit
procedure of the same engine-stage count, headless:
- A different staging structure needs a hand-flown run-through.
- A borrowed procedure isn't lent on, so there are no chains of borrowing.

The cheapest one that reaches orbit becomes the design's own, **provisional** (`prov: true, from`), with its Δv measured
on this design. It is dispatchable at once. The design's first real flight replaces it whatever it spends: records only
improve, but a borrowed one always gives way.

The tests show why this is measured, not ruled:
- An Orbiter with a tonne more on the upper stage borrows the Orbiter's climb, with 786 m/s to spare.
- With two tonnes more it has Δv to spare on paper, yet the same climb kills it: lower thrust-to-weight keeps it low
  and fast, and the pod burns up.

**For the economy:**
- `procAdopt` is the trajectory office's study. Its days and price are yours: nothing calls it yet, and it needs a
  button (assembly, or the contract's dispatch line when there's no procedure: "Try our procedures on this design").
- A provisional procedure should widen the estimate in `dispatchEstimate`. It's marked `prov`, but I left your
  formula alone.
- `dispatchEstimate`'s margin is still the formula on the procedure's Δv. A dry run per estimate would cost ~0.5 s per
  design per contract per render, too slow for the board. Caching a dry run's measured margin per design and target,
  as part of the study, would make the estimate a measurement.
- Deviations from real flights now come in more kinds than `relight`/`short`. `takeDeviation` works with any entry.

### Landing on a chosen point (2026-10-08, QUEUE Q13)

A phase field `site` is a point in the body's own frame, the frame landed objects are kept in (`q.pf`). It works for
"this crater" and for "next to Base 1" alike. A base takes in whatever lands within 500 m (`BASE_R`). Test § bodies-3.

1. **Plane, during the transfer.** The corrections and the trim also score the site's distance from the arrival
   orbit's plane, at the expected landing time (`siteOff`). A transfer still off-plane by more than 3 km counts as off
   course, so it gets corrected again. The plane is taken at the low point of the integrated pass: on the way into a
   near-polar site, Tellus's tide twists a hyperbola's plane by ~5°, about 29 km on the ground.
2. **Down to a low orbit.** If the capture left it high, it brings periapsis down at apoapsis, then apoapsis down at
   periapsis, to about 10×20 km.
3. **The pass.** It scans the next day for the pass that comes closest to the site (the moon turns under the orbit)
   and waits for it.
4. **Powered descent at the point** (`landAt`). The horizontal velocity it wants is the one that would stop it at the
   site under 60 % of its thrust, pointed at the site. Close in, it switches to distance / 8 s, so it doesn't chatter
   across the point. Braking starts when the site is a braking distance ahead along the track; if the site has
   passed, it plans the next pass. Along-track and cross-track errors are steered out alike. Over the site, the usual
   suicide burn takes it down, steering out the drift; a lander that can't finish drops off high.

**Results.**

| Site | Off target | Left (untargeted) |
|---|---|---|
| Selene 20°N 15°E | 5 m | 1,507 (1,628) |
| Selene 60°N | 5 m | 1,503 (1,628) |
| Selene 85°N | 5 m | 1,568 (1,628) |
| Selene far side | 5 m | 1,475 (1,628) |
| Nyx (two sites) | 5 m, 9 m | 2,138 (2,161) |
| Crewed Lunar | 2 m | — |

**Back to the same spot.** A recorded landing mission now keeps where it landed (`land.pf`), and its re-flight goes
there. The §27 crewed procedure lands 12 m from the hand-flown spot. It also spends less than the hand flight
(8,411 against 8,657 m/s), so it becomes the procedure. Automated flights to a base land at the base.

**Not yet.**
- Terrain on the moons is flat. When relief arrives, the descent's ground height is read at the site, but the low
  orbit (10 km) and the pass scan don't look at mountains.
- The site is fixed when the procedure is recorded. A dispatched "supply Base 1" would pass the base's `pf` as its
  site, which is the economy's to wire.

## Crew: the escape tower, abort tests, people to Selene (2026-10-07, bodies session)

The rest of epoch 4 from the economy's plan: "abort tests (pad, then max-q) qualify an escape tower before crew fly".

- **Parts.** *Crew capsule* (`crew`): a pod-kind part (so it's a command part, the root of the tree and drawn as the pod)
  with `crew: 2`, 1.4 t, 30M. *Escape tower* (`les`): a solid motor, 150 kN for 3 s, 0.6 t, 6M. Its thrust was picked so a
  pad abort stays under the 8 g limit: (150 kN on ~2.1 t) ≈ 7 g.
- **Abort** (Backspace, recorded on the autopilot tape as `['A']`): everything below the capsule is dropped (`detach`), the
  tower's thrust goes into `physStep`'s force sum along the axis, and at burnout it's jettisoned and the chute armed. On a
  nominal flight, the tower is jettisoned at the first staging above 30 km.
- **Crew rule.** Flight safety puts **people** aboard only once the tower is qualified (the max-q abort); before that the
  capsule flies test dummies, whose g and cabin are measured all the same. Crew limits are the passenger's (8 g averaged
  over 1 s, cabin 330 K), plus 10 days of air. A lost or hurt crew is a big opinion hit (`failHit −20`), and a closed regime
  hushes it up.

| Mission | Pays | Needs | What the sim checks |
|---|---|---|---|
| Pad abort test | 60M | passenger orbit | abort under 200 m, capsule lands intact, < 8 g |
| Max-q abort test | 90M | pad abort | abort at **≥ 15 kPa**, capsule lands intact, < 8 g; qualifies the tower |
| Crew around Selene | 300M | max-q abort, far side | crewed capsule in Selene's SOI, then home safe |
| Crew on Selene | 600M | crew around, soft landing | crewed landing on Selene (< 4 m/s), then home safe |

**Measured** (§25, 6 checks):

| Abort | Conditions | Apex | Peak g | Landing |
|---|---|---|---|---|
| Pad | 4 m up | 840 m | 6.8 | 6.4 m/s under the chute |
| Max-q | 18 kPa, 1.9 km up (straight up at full throttle) | 4.5 km | 6.1 | 6.4 m/s |

Also checked: no abort without a tower; the automatic jettison above 30 km; after qualification the capsule is crewed and a
trip into Selene's SOI and home completes "Crew around Selene"; a crashed crewed capsule loses its crew. The Big Lunar preset
(lander, heat shield, return) is the natural base for the crewed landing: swap its pod for a crew capsule and add a tower.

### The Crewed Lunar preset (2026-10-08)

`PRESETS['Crewed Lunar']`: Big Lunar with a crew capsule (+0.56 t) under an escape tower, a 2 t return tank, a 12 t lander
(t8 + t4), a stretched core (T32 + T32) and four boosters; 127.6 t. Sized by **flying candidates to orbit** with the test
ascent and a swept gravity turn, then reading what's left per stage. The budget it has to meet: Hohmann arrival at Selene
v∞ ≈ 470 m/s, so landing ≈ √(470² + 1,061²) ≈ 1,160 m/s plus losses (~1,250), and the return is the same.

| design (best turn) | to orbit | left: lander / return | verdict |
|---|---|---|---|
| Big Lunar (pod, no crew) | 4,289 | 2,698 / 1,456 | the reference |
| crew + t2 return, t4t4 lander, 2 boosters | 4,308 | 1,808 / 1,832 | lander short |
| crew + t2 return, t8t4 lander, 4 boosters | never reaches orbit | | 61 kPa max-q, short core |
| crew + t2 return, t8t4 lander, 2 boosters, T32T32 | never reaches orbit | | |
| **crew + t2 return, t8t4 lander, 4 boosters, T32T32** | **4,358** | **2,817 / 1,832** | ✔ ~800 m/s spare |
| same + 1 t more lander tank | 4,361 | 2,889 / 1,832 | +72 m/s, not worth a part |

Lessons from the sizing:
- **The turn matters as much as the tanks.** The Orbiter-tuned ascent spends 7,289 m/s getting Big Lunar to orbit. Turning
  from 200 m and flat by 38 km spends 4,358. A crewed Selene mission is a piloting problem as much as a design one.
- **The builder's TWR column is sea-level thrust.** The Petrel lander reads 0.10 there but is 0.61 in vacuum (≈ 3.7 in Selene's
  gravity), so landing isn't a thrust problem.

Checks (§26): orbit for 4,358 m/s at 31.6 kPa and 3.5 g, the tower gone, 2,817 / 1,832 m/s left; stable (1.31 cal) with the crew
capsule as root. It also passes the preset-wide checks (stage maths, loads analysis).

### Flown end to end: a crew to Selene and home (2026-10-08)

`fly_crewlunar.mjs` (run it on its own for the log; `test.mjs` §27 checks it) flies Crewed Lunar through the game's own physics
from the pad to a splashdown. Attitude is set directly; everything else (thrust, staging, aero, heating, both moons' pull, rails,
the predictor, crew limits) is the game's. It completes **"Crew on Selene"** in **2.4 days**:

| leg | result |
|---|---|
| ascent (vertical to 200 m, flat by 38 km) | 102 × 111 km, 2,817 / 1,832 m/s left, tower gone, cabin 311 K |
| transfer at the Hohmann phase angle (+1,321) | apoapsis at Selene's distance, aimed at its centre |
| mid-course correction found with the predictor | 33 m/s → a 38 km pass |
| capture at periapsis, then periapsis raised at apoapsis | low orbit, 1,087 m/s left in the lander |
| braking, then a suicide burn | lander dropped at 28.8 km (short for the descent), the return stage lands: **1.2 m/s, upright**, 1,435 m/s left |
| ascent (pitch over by 3 km) | 15 × 20 km, 553 m/s left |
| burn home (scan of burn point × size for a 45 km perigee), correction 11 m/s at the integrated lowest point | one clean entry, shield first |
| entry, chute | splashdown **6.5 m/s**, peak **4.1 g**, cabin 250 K; crew fine |

**What flying it found** (each was wrong until the flight tried it):
1. **The crew cooked on the way up.** After the tower goes at 30 km the capsule is the nose; its skin reaches 520 K, and the
   animal capsule's 10-minute cabin lag put the cabin at 387 K. The crew capsule now has `ins: 3600` (cabin lags the skin by an
   hour, insulated and cooled as real ones were): 311 K.
2. **A hovering descent is a fuel sink.** Easing down from 30 km at a few m/s spent the whole return stage (0 m/s left). A
   suicide burn (fall until stopping needs 85 % of full thrust) is the efficient way.
3. **Stage on need, not on empty.** The lander ran dry 1.6 km up mid-burn and the craft hit at 28 m/s. Comparing what's left with
   what the descent needs (≈ 1.15·√(2gh + v²)) when braking ends drops it at 28.8 km instead.
4. **No air on Selene: pitch over at once.** A 12 km pitch program spent 1,034 m/s reaching orbit; 3 km spends ~880.
5. **A periapsis snapshot isn't where you'll be.** The return correction first aimed with the osculating perigee; the moons'
   tides moved it ~33 km over the next day, and the capsule **aerobraked through nine passes at 70–78 km** before coming down
   (alive, at 4.4 days). Aiming at the predictor's integrated path (`minR`) gives one pass.
6. Small ones: the capture burn's cutoff must not depend on reaching a near-circular orbit (it burned through everything);
   automatic staging must stop at the last engine stage (it staged the capsule loose and popped the chute in vacuum).

**Open:** the tower's motor has no plume (plumes session); no tower option in the builder's palette categories (it shows under
"Other"); crew transfer and EVA; the flight script's attitude is set directly (a piloted version, or an autopilot from it, is open).

## Epoch 3 missions: satellites that work (2026-10-07, bodies session)

Built from the economy's epoch plan: utility satellites that keep doing a job. Weather and TV are flight missions (read by
`outThere`). Disaster watch and navigation are **world missions** (`world:true`, `okW()`), checked between flights by
`utilTick(d)`, one call at the end of `worldTick`. The payout moved out of `missionEval` into `missionComplete(M, rec)` so
world missions pay the same way; the behaviour is unchanged (all prior checks, and `career.mjs` runs).

| Mission | Pays | What the sim checks |
|---|---|---|
| Weather satellite | 80M | camera + antenna in a stable orbit inclined **80–100°** (from an equatorial pad: a plane change) |
| TV for the capital | 120M + **0.4M/day** | antenna in a **stationary orbit** (period = one day to 0.2 %, e < 0.01, i < 2°) at least **15° up in the capital's sky**; it pays daily while it stays there (`isTV`, a looser 1 % tolerance) and the news says when it drifts out |
| Disaster watch | 60M | disaster pictures delivered **within 12 h** of the call (`imageDone` now records the delivery time) |
| Navigation constellation | 150M | Transit-style: from **95 %** of (place, moment), a satellite with an antenna passes **≥ 10° up within 30 min** |

- **Stationary orbit after the rescale.** The old notes said "about 2,870 km". For the 8 h day it's r = 6,942 km, **5,668 km up**.
  The capital is the home power's biggest city (Kamar, 42° S, in the default world). From there the satellite sits ~40° up.
- **Drift is the maintenance.** A satellite 0.2 % off in speed (0.6 % in period) doesn't count for the mission, and it leaves the
  capital's sky after **25 days** (`isTV` allows 1 %). A precise insertion pays for much longer.
- **Navigation metric, measured.** "Three in view everywhere 95 % of the time" (a GPS-like fix) needs **~12 satellites** in 4
  planes at 3,000 km (93 %); 9 in 3 planes gets 71 %. That's too much for one-satellite-per-flight 1960s play. Transit (the
  real 1960s system) fixed from a single pass, so the metric is the wait for a pass. Polar orbits at 1,000 km, fix within 30 min:

  | satellites | coverage |
  |---|---|
  | 1 | 40 % |
  | 2 in 2 planes | 68 % |
  | 3 in 3 planes | 78 % |
  | 5 in 5 planes | 83 % |
  | **4 in 2 planes, 2 per plane, half an orbit apart** | **99.4 %** |
  | 6 in 3 planes at 500 km | 100 % |

  With a 1 h wait, three at 1,000 km already give 99.9 % (too easy on a planet this small). **Phasing within a plane matters more
  than adding planes**, which is a lesson the mission teaches by itself.

**Checks** (`test.mjs` §24, 4):
- polar weather counts, equatorial doesn't
- TV from a stationary orbit over Kamar pays 4.0M in 10 days; the sloppy one isn't counted and drifts out after 25 days
- disaster pictures delivered 0.9 h after the call (polar camera at 300 km, a city near the pad)
- navigation: 2 satellites give 60 %, 4 phased in two planes give 99.8 %

**Open:** weather forecasts of upper winds at max-q (the plan's idea; there's no wind model yet); sun-synchronous orbits (no J2);
launching several satellites in one flight (the registry registers one vessel per flight; a dispenser part would make
constellations practical); TV audience by city size.

## "Out there" missions: the Selene ladder and Nyx (2026-10-07, bodies session)

Caio: the economy session works at the high level, so specific missions get built here, from its epoch plan. This slice is epochs
4 (Selene) and 5 (the second moon). Epoch 3 (utility) is still open. All of it is additive: entries appended to `MISSIONS`, flight-record
fields filled by `outThere(s,dt)` (one call at the end of `missionTick`), facts in the logbook's "Out there" section, and epoch
labels in the Program panel. `RACE` is untouched, so rival schedules and the career balance runs don't move.

| Mission (id) | Pays | Needs | What the sim checks |
|---|---|---|---|
| The far side (`farside`) | 150M | beeper | camera within 3 R of Selene over **sunlit ground facing away from Tellus**; then an antenna **in line of sight to Tellus** (Selene blocks it while you're behind), or the camera landed home |
| Impactor (`selimp`) | 120M | far side | crash with instruments + antenna **on the near side**; on the far side "nobody heard a thing" |
| Soft landing on Selene (`selland`) | 250M | impactor | landed with instruments + antenna, **< 4 m/s**, near side (far side: "no way to phone home") |
| Sample return (`selsample`) | 400M | soft landing | instruments landed on Selene, then recovered on Tellus |
| Something out there (`nyxfind`) | 120M | far side | instruments + antenna tracked **12 h where Nyx's pull minus Tellus's reflex is ≥ 1e-3 of Tellus's pull**; logs Nyx's mass |
| Nyx flyby (`nyxfly`) | 150M | something out there | in Nyx's SOI with camera + antenna |
| An orbit that lasts (`nyxorb`) | 250M | flyby | instruments in Nyx's SOI, unbroken, for **two Nyx orbits (67 h)**: retrograde does it, prograde gets wrecked (6b) |
| Landing on Nyx (`nyxland`) | 300M | flyby | landed with instruments, **< 3 m/s** |

**Nyx is discovered by tracking, as Neptune was.** At 8,100–27,900 km and 0.7–2° across, Nyx can't be hidden from the eye, so what's
unknown is its orbit and mass. Until the `nyx` fact is in the logbook, the map shows it as "?" with no orbit line or SOI ring,
and encounter forecasts into it stop at the edge with a question mark (`knownBody`, `gateLegs`). The body is still drawn and
still pulls on everything. Weighing it unlocks all of that. The 12 h runs where `nyxResidual(r)` ≥ 1e-3, i.e. where flying
without Nyx in the model would leave visible residuals: high orbits (beyond ~1.3× Nyx's distance) or near Nyx. New logbook
facts: the second moon (mass and orbit), Δv to reach Nyx, Δv to land on Nyx.

**Checks** (`test.mjs` §23, 6, each flown through `advRails`/`advPhys` → `missionTick` → `missionEval`):
- the far side photographed 1 min into a 1.5 R orbit and downlinked 17 min later, when Tellus came into view
- impactor heard on the near side, not on the far side
- landing from 3 m (3.1 m/s) counts; from 10 m (5.7 m/s) doesn't
- Nyx weighed after exactly 12 h of tracking at 30,000 km around its periapsis time
- the 200 km retrograde orbit completes 67 h; its prograde twin crashes at 17 h
- landing on Nyx at 2.0 m/s

The first versions of the landing checks were wrong: the craft's centre was put 1.5 m up, so its base started *in* the ground and
"landed" at 0.0 m/s.

**Open:** crew on Selene (needs the abort tests and crew parts of epoch 4); contracts that repeat these (economy's board); the
`RACE` question (should the far side or a Selene landing be a race for firsts? It would shift rival schedules and the v1.28
balance); prices are untested by `career.mjs`, which doesn't fly past epoch 2.

## 6b — third-body perturbations near Nyx (2026-10-07, bodies session)

Patched conics called every orbit around Nyx stable. This slice integrates the real three-body problem where it matters.

**Model, and a correction to the earlier study.** In the game Nyx follows a fixed Kepler path about Tellus. The only n-body
model that agrees with that is one where the pair's relative orbit uses μ_Tellus + μ_Nyx (now `b.n` for a `pert` body) and the
Tellus frame carries Tellus's reflex toward Nyx. `study_nyx.mjs` mixed the two: a μ_Tellus-only path *with* the reflex, which is
inconsistent at m/M = 5.6e-4. In a chaotic case that is enough to change the outcome: the 100 km prograde orbit crashes at
0.52 P there and at 1.51 P in the consistent model. Every other verdict in the study's table stands (prograde wrecked from
~100 km up, retrograde survives).

**Where** (superseded in part 2 below: per-orbit gating, 2e-6). `pertAcc(b,r,t)`: inside Nyx's SOI, Tellus's tide (its pull on the craft minus its pull on Nyx), always on. In
Tellus's frame, Nyx's pull minus Tellus's reflex, wherever that is ≥ `PERT_MIN` = 1e-3 of Tellus's pull. A threshold sweep
against n-body (flybys at Nyx's pe and ap, v∞ 300/800 m/s, error one day later):

| perturbed where | flyby error a day later |
|---|---|
| nowhere outside the SOI (patched conics) | 170–10,200 km |
| within 3 / 10 / 50 × SOI of Nyx, direct pull only, no reflex term | 50–4,800 / 25–1,800 / 4–1,900 km (worse at 50: wrong model, see above) |
| ratio ≥ 1e-2 | 60–2,900 km |
| **ratio ≥ 1e-3** (and 1e-4…1e-6, identical) | **0.1–0.6 km** |

The ratio has to include the reflex term. With the direct pull alone the game came out 14 km off on the slow flyby. The reflex
grows past ~1.3× Nyx's distance, so craft out at Selene's distance are perturbed too. **A real effect, measured:** a
Selene-bound transfer that misses Selene comes back after one 39 h revolution with its perigee 110 km lower, into the ground (n-body:
−24 km). Nyx is 5.6e-4 of Tellus, proportionally a twentieth of our Moon, and it moves high perigees by about 100 km a revolution, as
the Moon does to HEO orbits. Low Tellus orbit sees 2e-6 and keeps exact rails (`30 days at 100000×` unchanged to 1e-8 m).

**How.** `pertNear(b,el)` is an orbit-level prefilter: Nyx's direct pull reaches 1e-3 only within kap·r of it, kap =
1.05·√((m/M)/1e-3) = 0.79, so the orbit must pass between rMin/(1+kap) and rMax/(1−kap). `coastPlan` is the step planner
shared by rails, the predictor and `fall()`: the old event limits plus the edge of the perturbed region, and a step cap when
perturbed (1/200 of the osculating period, 0.02·d^1.5/√μ to the perturber, 1/400 of Nyx's period). `coastStep` is exact
Kepler, or kick–drift–kick with Kepler drift about the frame's body (symplectic, Wisdom–Holman style). `physStep` adds
`pertAcc` to gravity. The predictor's perturbed legs are numeric (`numLeg`): a path for the map, ending at an SOI change, at
the ground ('impact'), or at a horizon of two Nyx orbits inside its SOI (one revolution outside). Impact prediction on Nyx uses
the same stepper.

**Map.** Perturbed legs draw as their integrated path, with the closest pass and "Impact in … (perturbed)". A numeric
prediction takes 12–27 ms, so it is cached while the craft stays on it (`predStill`: within a km or 0.1 % of r) and redone at
most 4× a second while thrusting. The node plan has the same cache. The era map's body loop now iterates `BODIES` (it was
`[TELLUS, SELENE]`), so Nyx gets its pencil and wireframe outline too.

**Checks** (`test.mjs` §21, 5 new, against an independent RK4 n-body):
- a 200 km prograde orbit started at Nyx's apoapsis: n-body down at 0.493 P, rails 0.493 P, predicted 0.493 P
- the retrograde twin is bound after 2 P, and predicted bound
- one Nyx orbit flown in 60 s chunks vs 1 h chunks: 133 m apart, 0.27 km from n-body
- the slow flyby at Nyx's periapsis: 0.57 km from n-body a day later
- 123 µs per warp frame at 100,000× in a 60 km orbit

§20's stripping check now expects the perturbed answer: the 150–971 km retrograde orbit is pumped out at +5.7 h, not the
patched-conic +12.9 h. Predicted and flown agree.

**Not yet:** node positions still come from Kepler (`nodeInfo`), so a node far ahead on a perturbed leg sits slightly off the
drawn path. Selene perturbs nothing, though at 0.0123 of Tellus it would matter more than Nyx: making it `pert` is one flag, but
it changes every Selene trajectory and the tests built on them. Debris near Nyx ignores the tide.

### 6b, part 2: Selene perturbs too; gating per orbit; nodes (2026-10-07)

- **Selene is `pert:true`.** Its relative orbit uses μ_T + μ_S. That shortens its period by 0.6 %: the textbook encounter
  moved from 15.5 h to 15.2 h, and every Selene test still passes.
- **A per-point threshold breaks warp.** With the 1e-3 per-point test, a long Kepler step that started below the threshold
  skipped stretches where the force should have been on. 30 days of low orbit at 100,000× came out **472 km** from the same
  30 days in 60 s chunks. The fix is to gate **per orbit**: `pertNear` estimates an orbit's largest tidal ratio (for orbits
  well inside a moon's, 2.4·(m/M)·(ap/(rMin−ap))³; anything reaching out toward a moon counts), and within a gated orbit the
  force is always on, with the step cap. Now warp and small steps end **0.4 m** apart after 30 days. `physStep` keeps a
  pointwise test, since physics runs in short spans.
- **PERT_MIN 1e-3 → 2e-6**, by sweep on a translunar coast through Selene's SOI (two days, pass 270 km up, vs Tellus+Selene
  n-body): 1e-3 → 1,354 km off · 1e-5 → 121 · 3e-6 → 19 · **2e-6 → 6.8** · 1e-6 → 6.8 · 1e-7…1e-9 → 4.6 km (the floor; 10× finer
  steps change nothing, so it's the close pass). At 2e-6, Selene's tide on low orbit (1.2e-6) stays out, but **Nyx's (~1e-5) is
  in**: low orbit now drifts ~10–200 m a month (real), and warp there costs ~0.4 ms a frame instead of 3 µs.
- **Checks are per moon.** The moons ride fixed paths, so an n-body with both on would have Selene pull a craft orbiting Nyx but
  not Nyx itself. The game keeps only Tellus's tide inside Nyx's SOI, which is the more physical choice. §21 runs Nyx's checks
  with Selene's perturbation off; §22 runs Selene's with Nyx's off: 100 km lunar orbit **10 m** off n-body after a day;
  translunar coast **4.7 km** off after two days.
- **Nodes:** `nodeInfo` integrates to the node on a perturbed orbit (`coastTo`), memoised on the node until `kickN` changes
  (thrust or aero in `physStep`, staging, separation). Node 4 h ahead around Nyx: **0 m** from where rails take the craft; Kepler
  alone was 16.5 km off.
- Test changes outside this scope: the 30-day warp check (§3b) now tests warp *invariance* plus a bound on tidal drift; the
  economy's satellite-precision check allows 1e-3 M (a "perfectly centred" test orbit now gets nudged by the tides).

### Nyx missions — spec for the economy session (superseded: built here, see "Out there" missions above)

Per the program design (epoch 5 "Discovery"), Nyx is found by the player's own telescope after the Selene ladder. Until then
it's in the sky (drawn, perturbing) but nameless and unmarked on the map. A suggested ladder, with the physics already in place:

| Mission | Win condition (headless-checkable) | Why it's interesting here |
|---|---|---|
| **Discovery** (telescope) | telescope payload in orbit for N days → Nyx gets its name, map marker and orbit line | the telescope is your instrument opening the chapter |
| **Flyby** | enter Nyx's SOI (`s.body===NYX`) with a camera | inclined 30°, eccentric: the plane change and *when* to meet it dominate the cost |
| **Impactor** | crash on Nyx while sending (antenna on board) | cheap, and a prograde low orbit does it for you (that's the joke) |
| **Orbit that lasts** | stay in Nyx's SOI below 300 km for 2 Nyx orbits (67 h) | prograde orbits from ~100 km up get wrecked at Nyx's periapsis; **retrograde survives**; the map shows it ("Impact in … (perturbed)") |
| **Lander** | landed on Nyx, upright, under 3 m/s | g 0.40, escape speed 346 m/s: easy to land, easy to bounce |
| **Sample return** | landed on Nyx, then landed on Tellus with the sample part | |

Rough Δv (equatorial transfer, so optimistic by a plane change): meet Nyx **at apoapsis** (27,900 km), 1,290 m/s from low
orbit, a 12 h trip, arrival v∞ ~730 m/s, capture into 100 km ~590 m/s. **At periapsis** (8,100 km), 1,040 m/s and 2.3 h,
but v∞ ~2,470 m/s and capture ~2,290 m/s. So the cheap way in is slow and at apoapsis, where Nyx's SOI is also largest
(1,401 km vs 407). Landing from 100 km: ~190 m/s. Logbook facts that fit planning's "Out there" section: Δv to reach Nyx,
Nyx orbital period (first orbit), surface gravity (first lander), and "prograde orbits don't last" (the first wrecked orbit).

## More bodies: the body tree and Nyx (2026-10-07, bodies session, branch `bodies`)

Open thread 6. A local clone at `C:/Users/caioa/dev/launchpad-bodies` (a different machine from the other sessions).

**Slice 1: the body tree, with no change in behaviour.** `BODIES`, built by `addBody(b,parent)`. Each moon carries Kepler elements about
its parent (`orb: {a, e, i, lan, argp, M0}`, angles in the XZ equator with +Y north, so prograde runs +X → −Z), and
`bodyRel(b,t)` solves Kepler's equation for its position and velocity. `checkSOI`, the step limits in `rails`, and `predictFrom`
walk the tree: a leg ends at the earliest of entering any moon's SOI (scan, then bisection) or leaving the body's own.
`moonPos`/`moonVel` are kept as wrappers. The map (orbits, SOI rings, encounter and escape labels), Tab focus, the shadow test and
the body labels iterate `BODIES`. **Check:** a fingerprint of 40 aimed Selene transfers (19 encounters), 14 rails runs through SOI
changes, a prediction from inside Selene's SOI and a Selene impact was **byte-identical** before and after. The circular,
equatorial case of the general formula reduces exactly (multiplying by ±0 and 1 is exact).

**Nyx.** Caio's idea: a second moon, inclined and very eccentric. An n-body study (RK4, Tellus-centred frame with the
indirect term; `node study_nyx.mjs [small|mid|selene]`) chose the size:

| Candidate | pe–ap | SOI (Laplace × distance) | Hill radius at pe | Verdict |
|---|---|---|---|---|
| R 90 km, g 0.25, a 16,000 km, e 0.7 | 4,800–27,200 km | 133 km at pe (43 km above ground), 752 at ap | 167 km | hardly orbitable |
| **R 150 km, g 0.4, a 18,000 km, e 0.55, i 30°** | **8,100–27,900 km** | **407–1,401 km** | 464 km | **chosen** |

Period 33.4 h, escape speed 346 m/s. Apoapsis plus the largest SOI clears Selene's SOI by 2,516 km.

What the study showed:
- **Which SOI rule.** Flybys at pe and ap, v∞ 300/800 m/s, three miss distances, patched conics against n-body one day later.
  **Laplace radius × the moon's current distance** was best or tied in nearly every case. A fixed SOI from `a` is far too big at
  periapsis. One fixed at periapsis misses most encounters near apoapsis. Patched conics are off by hundreds to thousands of km a
  day after a pass, *for Selene too* (the same metric gives 2,000–8,000 km), so Nyx is no worse than what we already have.
- **What patched conics can't show (a negative result, kept).** In n-body, *prograde* circular orbits about Nyx started at its
  apoapsis are wrecked at the next periapsis pass (crash or ejection) from ~100 km altitude up. *Retrograde* ones survive at every
  altitude tried up to 600 km. Patched conics call all of them stable. Showing this would need third-body perturbations (Encke) in
  rails and the predictor for Nyx. **Caio chose patched conics for now**; this is open thread 6b.

So Nyx's **SOI breathes**: `soiAt(b,t) = |r_moon(t)| × (m/M)^0.4` for a moon with e > 0 (Selene keeps its constant `b.soi`
exactly). `b.soi` is the largest value and `b.soiMin` the smallest, both for conservative tests; `b.soiRate` bounds how fast the
SOI moves, which goes into rails' step size. The predictor's escape for a breathing SOI is `escTime`: an outbound leg is scanned up
to where it crosses the largest SOI; a bound orbit that reaches past `soiMin` is scanned over three Nyx orbits, then bisected.
**Patched-conic stripping:** an orbit whose apoapsis is above the periapsis-time SOI gets dropped back into Tellus orbit when Nyx
swings in. That is the patched-conic shadow of the real effect, and it's predicted on the map.

Side effect on Selene flights: rails' speed bound now includes Nyx's speed, so steps near SOI edges are finer. Selene SOI switches
moved by under 0.4 s, all closer to the predicted times (e.g. predicted 28,090.85 s: 28,091.23 → 28,091.10).

**Drawing.** Selene lives in `SKY_FS`, which belongs to the terrain session, so Nyx gets its own pass: `MOON_FS` = `SKY_FS` up to its
`main()` (so `sph`, `scatter`, `crat`, `fbm`, `detail` are shared) plus a main that ray-casts one sphere. It's drawn after the sky
pass, depth-tested against it, and writes the same log depth. Seen from the ground it's ~0.7–2° across (bigger than our Moon)
and takes the air's colour like a daytime moon. Look: three crater scales and a dark, brown carbonaceous albedo
(`NYX.alb`) so it doesn't read as a second Selene. Any further non-Selene moon goes through the same pass.

Checks (`test.mjs` §20, 5 new): orbit and SOI geometry; an approach finds the encounter and rails switch in on time, then out; a
150–971 km retrograde orbit is predicted to be stripped at +12.9 h and is; a 100 km orbit is never stripped; a fall onto Nyx is
predicted to 2 m.

**Not yet:** missions and contracts for Nyx (the economy's scope); perturbations (6b); eclipses of and by Nyx in the lighting
(`lit()` already shadows meshes); a non-spherical shape (it's a captured rock, and an SDF would suit it).

## v1.23 — aero interference: shadowing between stack lines (2026-10-07)

Until now every stack line (core, each booster) flew as if it were alone. The interference that follows from the model the
sim already uses is **Newtonian shadowing**:
- An upstream-facing surface sample gets no impact pressure, and no stagnation heat, if the ray from it back up the flow
  crosses another line's body first.
- Lines are cylinders of their widest radius over their own height.
- Slender-body lift and skin friction are left unshadowed.

At small angles of attack the upstream ray climbs steeply (1/tan α metres up per metre across, about 11 at 5°), so
side-by-side boosters barely shade each other on ascent. At high α the leeward lines go dark. Broadside, the Heavy's three
bodies are in a row along the flow, and the leeward booster tank's pressure falls from 70 kN (windward) to 0.9 kN (its
skin friction). That's extreme, as Newtonian always is, but it matches tandem cylinders this close (centres 1.2
diameters apart), where the downstream one sees almost no drag.

| Normal force at q 20 kPa, M 0.6 | 0° | 5° | 20° | 60° | 90° |
|---|---|---|---|---|---|
| Orbiter (1 line) | unchanged | unchanged | unchanged | unchanged | unchanged |
| Heavy (3 lines) | unchanged | 54.0 → 51.1 kN | 247 → 210 | 668 → 456 | 584 → **304** |
| Asparagus (5 lines) | unchanged | 69.0 → 66.1 | 317 → 282 | 876 → 684 | 787 → 552 |
| Nested 3×2 (10 lines) | unchanged | 24.8 → 24.3 | 146 → 124 | 568 → 355 | 641 → 476 |

Stagnation heating on shadowed faces drops with it (Heavy at 60°: 0.06 → 0.02 MW). In the builder's design case (4–5°):
- stability rises by 0.02–0.03 calibers on the booster designs, because the upper booster sections are shaded slightly
  more and the centre of pressure moves aft
- max-q joint loads move by 1–2 %

So on a normal ascent this is a small correction. It matters in tumbles, aborts and broadside re-entries.

**Cost:** about 3–12 µs more per step (5–20 %, noisy) with 3–10 lines. That is roughly 3 ms of a frame at 100× physics warp for
the Heavy. `AERO_SHADOW` switches it off for A/B measurements (tests §19).

**Two measurement traps on the way:**
- **Cold timings.** The first timing (160–270 µs per step) was a cold JIT. Warmed up and best of 5 it is 26–40 µs, the same
  as v1.8. Always warm up and take the best of several runs.
- **The bisect that "found" a 5× higher apogee.** It came from my own script, which still used the old 600 km radius.
  The planet had been rescaled to 1 274 km on `main` (d5cc27e) in the meantime. Measure altitude from `TELLUS.R`, never
  a literal.

**Also seen:** an unfaired design (boosters and side tanks with flat tops) has 288 kN of drag at 0°, against 32 kN for the
Heavy with its nose cones. Newtonian impact pressure on blunt faces is what it should be. Fairings matter.

## v1.22 — canted engines (2026-10-07)

**Model.** An engine on a radial line may cant its nozzle outward by θ, in its own radial plane, so its thrust leans in toward the
axis: d = cos θ·ŷ − sin θ·n̂. It is set per design node, so all symmetric copies share it, and it ranges from −30° to +30°. Everything
that assumed axial thrust now uses d:
- physics (the force on the mount) and the builder's what-if probe
- the Δv planner and TWR, as vector sums, so a symmetric canted pair honestly pays its cosine
- the maneuver-node burn time
- the plume, and the engine mesh, rotated about its mount

Uncanted engines carry no direction at all and run the old axial code unchanged (all 112 checks).

**Getting "balance" right.** My first version pointed *this* engine's thrust line through the CoM. That is the wrong target:

| Lone Kestrel booster beside a Kestrel core | Thrust torque about CoM | Max tilt, 40 s climb under SAS |
|---|---|---|
| uncanted | 34.6 kN·m (the two equal engines nearly balance already) | 1.9° |
| booster aimed through the CoM (26°) | **155 kN·m**, ×4.5 | flipped, lost |
| total thrust balanced (5.05°) | 0.16 kN·m | 4.4°, worse than uncanted |

"Balance" now picks the cant at which all engines burning when this one fires push with zero net torque about the CoM of
what is still attached then (full tanks). It searches −30…30° on a 0.05° grid, and ties go to the smallest |θ|, so a symmetric
pair stays at 0°.

The last row is the real lesson. **Canting trades a torque for a side force.** The engine gimbal cancels the torque
almost for free. The side force (sin 5° × 230 kN ≈ 20 kN here) is never cancelled: it builds a crosswind angle that the fins
then fight. So cant pays only when the off-axis thrust is beyond what the gimbal can hold:

| Stack (core + lone booster) | Balance cant | Uncanted | Balanced |
|---|---|---|---|
| Sparrow + Condor | 15.0° | flips at T+4 s, lost | 4.9° max tilt, 14 km at T+50 s |
| Kestrel + Condor | 7.75° | 41.7° max tilt | 3.2° |
| Sparrow + Kestrel | 10.15° | 95.5° | 1.1° |
| Kestrel + Kestrel | 5.05° | 1.9° | 4.4° (don't) |

A symmetric pair canted 10° gives up 1.0 % of first-stage Δv. That is less than the booster's cosine (1.5 %), because the
core engine isn't canted.

**Not modelled:** a canted nozzle's plume hitting the core (plume impingement), and a cant that changes as the CoM moves
during the burn. Real stacks gimbal their boosters for that.

## v1.21 — career moves: defection and private hire (2026-10-07)

From the backlog (Caio): when the program does badly, the people in it get offers. They can also come when it does very
well, as a step up.

- **When:** between flights, at most one career offer at a time, open for 30 days. *Badness* counts one each for: two
  or more top-ups, home opinion < 35, sanctioned by home, in debt, below the floor. Offers arrive at a rate of
  badness/150 per day when in trouble, or 1/450 when excelling (≥ 5 firsts, home opinion > 60), and never in ordinary
  times.
- **Defection:** the most interested power that isn't friendly with home (relation < 0.2; scored by economy × tech ×
  its opinion of us) wants the whole team: signing money of 40M + 30% of valuation (50% when excelling). Accept and
  **`HOME` changes**: the new power owns 100%, so every home-relative rule follows (budget day, government work, drop
  incidents, ground stations, the race against the new set of rivals). The old home's opinion drops to 10, relations
  between the two powers fall 0.3, it sanctions the program for 400 days (cancelling its contracts), and everyone else
  trusts us a little less (−5).
- **Private hire:** a generated company ("Brutor Orbital") buys the program: 50M + 25% of valuation (45% when
  excelling), debts paid off, government contracts dropped, home opinion −8 ("brain drain"). It's named after the
  company from then on.
- **What carries over:** certified ratings, the atmosphere data, the firsts flown, the contract record. Not money,
  ownership or government standing. The panel keeps a **history** line per move.
- **Not yet:** the pad stays where it is (the program flies under lease) until the terrain work provides launch sites
  per power. Nothing yet stops a later move back home.
- **Merge accident:** the misplaced `HOOK.edOverlay(octx)` line (in the ownership click handler since 86e67a6) was found and fixed
  independently here and in the builder's v1.20 (which added a guard test); the merge kept one copy, in `render()`.

`test.mjs`: 4 new checks (§18), 103 total.
## v1.20 — the staging editor (2026-10-07)

**Model.** The automatic event list (v1.17's segment-tree rule) is split into *atoms*:
- one per decoupling placement, with all its symmetric copies
- one per ignited group
- the chute

An atom is named by its decoupler's design-node id (`d:7`, `i:7`, `i:root`, `c`). A design may carry `stg`, a list of stages in
firing order, each a list of atom ids; `stageAtoms` turns it into events.
- **Late parts:** atoms the order doesn't mention (parts added later) keep their automatic place relative to the rest, so
  editing the rocket never loses staging.
- **Drops carry what hangs off them:** in a custom order a drop takes everything hanging from the segment, so the core
  can go before its boosters without leaving them attached to nothing. A segment an earlier stage already dropped is not
  dropped again.

The automatic order written out as a custom one reproduces the events exactly (test §17). Node ids are assigned on the
first edit, copies get fresh ones, and duplicates are repaired.

**UI.** The panel sits under the build toolbar: stages in firing order, each action a chip (orange drop, green
ignition, blue chute).
- ◀ ▶ move a chip one stage earlier or later; off either end makes a new stage. ⤵ gives it a stage of its own.
- "automatic" forgets the custom order.
- Hovering a chip lights its parts on the rocket: the whole segment for a drop, the engines for an ignition.
- The flight HUD, Space, the Δv planner and autopilot tapes all read the same events, so nothing else needed changing.

| What | Number |
|---|---|
| Heavy, boosters held on until the core drops (one fewer stage) | Δv 1 758 + 1 447 + 2 465 → **2 670 + 2 465 m/s**: carrying two empty boosters for the core's burn costs **535 m/s** |
| Same, flown: Space for real, then physics stepped from the page | boosters burn out at T+48 s and stay on ("boosters empty — stage to drop them"); core + boosters drop together at T+96 s; 129 km at T+120 s, worst joint 24 % |
| `test.mjs` after merging `main` (economy v1.19) | 106 / 106 |

**Two bugs found by the browser, not the tests.**
- **Atom ids on unedited presets.** These have no node ids yet, so atoms named `d:undefined` merged: "drop core 1"
  vanished into the booster drop. The fix names them by design-node object instead (by segment at first, which split
  the booster pair). There is now a test for it.
- **A stuck highlight.** Rebuilding the panel removes the hovered chip, and a removed element never fires `mouseleave`.

### The misplaced hooks (fixed on `main` as `480d7c7` before this slice)
Moving the v1.17 hunks into this worktree used zero-context patches (`git apply --unidiff-zero`). Those place a *pure
insertion* by line number, and the terrain session's 92 lines were in the source diff but not in the worktree. Two
insertions landed in the wrong place:
- `HOOK.edDraw` went inside `drawMap`, so from v1.17 on the builder drew **no placement ghost, hover or selection glow**.
- `HOOK.edOverlay` went between `if(ds.start)` and `else if(ds.dk)` in the economy's program-panel click handler, so in the
  editor **program decisions never resolved**.

All behavioural tests passed throughout: nothing in them looks at *where* a hook is called from. My v1.17/v1.18 browser
checks drove the placement logic and read state ("ghost hard to make out") instead of looking at the ghost. It surfaced
only when a hover highlight that should have existed didn't. Now:
- a **merge guard** in test.mjs §17 checks that each render hook is called once, from inside `render()`, and that the click
  handler's if/else-if chain is intact. Run against the broken commit, the guard fails, as it should.
- **Never move hunks between diverged trees with zero-context patches.** Use a 3-way merge or a patch with context.

## v1.19 — tourism, military, sanctions, the race (2026-10-07)

Slice 6, on the `economy` branch (worktree `C:/Users/caioa/dev/launchpad-economy`).

- **Tourism** (a source of its own): *tourist flight to space* (g limit 4.5–6) once the passenger hop is done; *orbital
  holiday* once the passenger orbit is. Pays 55–130M. The passenger is a named tourist ("a retired dentist", "a very
  excited grandmother"). The offer rate goes with (tourism standing / 50)², so **one hurt tourist** (−40 standing,
  −10 home opinion) all but empties the board for a long time.
- **Military** (60% home as client, otherwise any power, including home's enemies):
  - *reconnaissance orbit* (110–180 km, 60–90°);
  - *ballistic test*: an instrument package down at sea within 40 km of a target 300–900 km downrange, marked on the
    map. This exercises the impact predictor. The flight record now keeps where the flight ended (landed or crashed)
    and whether the instruments were aboard;
  - *classified payload* to orbit.
  
  Pay ×1.6. Each completed military contract **may leak** (25%, 40% for a foreign client). A leak costs home opinion,
  and every power hostile to the client takes −15 opinion and sanctions us.
- **Sanctions** (`sanction(i, days, why)`): that power sends no offers, cancels its active contracts and withholds its
  budget-day share until the sanction lapses. **Home sanctions too:** military work for home's enemy (always found out:
  250 days), and commercial work for a power with relation < −0.75 (export controls: 120 days). For a state agency
  that means losing government contracts and the budget day, which is the "working with the enemy" mechanic. Offers
  show the risk before you take them ("⚠ Maros sanctions us at once · Venka if it leaks (40%)").
- **The race** for the first satellite, the first passenger to space and the first passenger orbit. Rivals' schedules
  are seeded from their tech × √economy (first world: the strongest rival is expected around days 86 / 184 / 278).
  First in the world pays 1.5× (+8 home opinion); second pays half. A rival's win makes the news, and costs home
  opinion if that rival is unfriendly. The Program panel shows the race.

`test.mjs`: 5 new checks (80).

Still open: career moves and power flavours (backlog). Sanctions don't yet reach launch-site access or parts (export
controls on hardware).
## The logbook: discovered facts, and an interface that ages (planning branch, 2026-10-07)

**Idea (Caio):** the reference numbers should be *discovered*, derived from real game data. The first flight out of the
atmosphere records the Δv it took; the first orbit, the best Δv for that, keeping the design. The interface changes
by epoch: scrawled notes first, then a monochrome monitor, and so on. Mission planning, with its graphics, can follow.

**Built (first slice):**
- **Facts measured by flights** (`LOGF`, `logNote`): Δv to leave the atmosphere, Δv to low orbit, orbital period (first
  orbit), highest point, Δv to reach Selene, Δv to land on Selene. The flight record now sums the Δv actually spent
  (thrust/mass over every powered step). Each entry keeps *who* (the design's name: a preset's, or a stable short
  "Design XXXX"), *which flight* and *when*. Records only improve; the last three values stay as history.
- **Records keep the design and the flight:** the design is stored with the record, and the app attaches that flight's
  autopilot tape. "Copy this design" / "LOAD DESIGN" puts it in the builder and installs the record flight as that
  design's autopilot (if it has none), so a record can be studied and flown again.
- **The builder's hint reads the logbook:** "Low orbit: 4,412 m/s (best, Orbiter)" once known; "unknown, nobody has made it
  yet" before. The tools only know what the program knows.
- **Eras:**
  - **Program notebook** (graph paper, handwriting, struck-through old records, "???" for the unknown) until something
    orbits.
  - Then **PROGRAM LOG — TERMINAL 1** (green phosphor, scanlines, "NO DATA").
  - A "modern look" checkbox (kept per browser) overrides either.
- Checks (§18, 4 new, 128 total). Seen end to end in the app: a Passenger flight logs space at 3,095 m/s and its
  145 km apex, with its 7-op tape.

**The map follows the era too** (same branch, same day):
- **Notebook:** graph paper; each body a hand-drawn circle (a steady "tremor" so it doesn't shimmer) with the equator
  pencilled in and the night side hatched; every map line in ink, with warm ones (impacts, encounters) in red pencil;
  handwritten labels.
- **Terminal:** black with scanlines; glowing vector wireframe globes (latitude and longitude every 30°, back side
  hidden); phosphor-green lines and text.
- How: every map line already goes through one buffer (`drawMap`/`drawPatches` → `out`). In an era map that buffer is
  kept (`MAPSEGS`) and drawn on the 2D overlay after an opaque sheet, instead of the GL line pass; labels get the era's
  font and ink. Camera, picking, nodes and handles are untouched.
- Cost: +0.4–0.5 ms a frame (map at 1280 px: modern 2.2 ms, terminal 2.6, notebook 2.7). "Modern look" keeps the
  rendered map.
- Also: a Δv record of 0 is ignored (a placed vessel, not a flight), found by placing one by script.

**More facts** (same day): 15 now, in four sections.
- **Getting up:** Δv to space, Δv to orbit, highest dynamic pressure flown through (logged at flight end if the vessel
  is still alive).
- **In orbit:** the first orbital period; the best ground-station contact a satellite has had (reported between flights
  by the satellite itself, named after it; no design).
- **Coming back** (logged on an intact landing on Tellus): fastest re-entry survived (air-relative speed on the way down
  after reaching space), hottest skin survived (K, with the part), the hardest ride a passenger came home from (g),
  the closest landing to the pad after a trip to space.
- **Out there:** farthest from Tellus (replaces "highest point"; counts the Selene leg), Δv to reach Selene, the first
  orbital period around Selene, Δv to land on Selene, and Selene's surface gravity as the first lander measures it.
- Facts may hold objects (`key` picks the number compared); `logNote(null, …, by)` lets the registry report.
- A Passenger hop logs: max-q 29.9 kPa, entry 1,274 m/s, hottest skin 401 K (the parachute), 6.7 g, landing 25.8 km
  from the pad. Checks §19 (3 new, 136 total).

**Tools gated by what's known** (same day). `TOOLS` maps each tool to the fact it depends on; `toolOK(k)`:
- **Impact prediction** (HUD row, map trace, ground marker, spread) ← *farthest from Tellus* (any flight that has come
  down). Before that the HUD reads "no trajectory data yet". Range safety still uses the prediction underneath: only the
  display is gated.
- **Maneuver planning** (placing a node by click or N, and so the panel and warp-to-burn) ← *Δv to low orbit*. Refused
  with "No maneuver planning yet: it needs 'Δv to low orbit' in the logbook". Autopilot tapes still replay their nodes.
- **Encounter forecasts** (the predicted path inside another body's sphere of influence, encounter labels) ← *Δv to
  reach Selene*. Before that the map's path stops at the edge with "? Nyx: what its pull does next, no data yet" (any
  body: the bodies session added Nyx).
- The logbook says what each fact unlocks ("→ will unlock: maneuver planning" / "→ unlocked: …").
- Fixes found on the way: the gated forecast first crashed the map (the encounter label looks ahead to the next leg,
  so the gated leg now keeps its end but drops its encounter tag); and a *placed* vessel (one that spent no Δv) now
  reports nothing to the logbook. Placing one by script had logged an orbital period.
- Check §21 (1 new, 142 total).

**Next along this line:**
- More facts: lost limits (what broke, and at how much), max-q survived, Selene's gravity, ground-station contact.
- More eras: typewritten reports with stamps, early colour.
- **The map's look following the era:** pencil trajectories on graph paper, then vector CRT. Mission planning UI
  follows the same arc.
- Gating tools by what is known: a transfer planner that needs a measured Selene transfer first.

## The planet's size: a scale study and the rescale (2026-10-07)

**The question (Caio):** was Tellus too small? It was a copy of Kerbin's numbers (600 km, 9.81 m/s², 6 h day, 70 km
of air; Selene was the Mun).

**What players say** (KSP forums): Squad shrank Kerbin to 1/10 Earth for gameplay (easier rockets, frequent transfer
windows, less warp). Among rescale mods, **2.5×** is the most-cited sweet spot ("2.5–3.7× the perfect sweet spot of
challenge versus casual play"); JNSQ (2.7×) adds ~1,400 m/s to orbit; 3.2× (~6,000 m/s) is "a solid difficulty level
without making it a hindrance". Real scale (RSS) is a big adjustment many players leave. The usual complaints at
larger scales are rebalancing (the planets are easy, the rest of the game isn't) and slow ascents and warp limits. Our
exact Kepler rails remove the warp problem.

**The study** (a harness that loads the sim core with Tellus rescaled, surface gravity kept, atmosphere ×(1+0.25(k−1)),
and flies the same scripted missions):

| | 1× | 2× | 2.5× |
|---|---|---|---|
| Δv to low orbit | 3,060–3,180 | 4,000–4,180 | 4,390–4,600 |
| Orbiter preset reaches orbit with | 1,643 spare | 720 | 217 |
| Lunar preset | orbit | lost (overheats on ascent) | lost |
| Peak ascent heating (heating ×3) | 68–85% | 96–100% | 90–100% |
| Pod + shield back from orbit, ablator left | 63% | 4% | 0% |
| Polar 300 km satellite contact, pad → 5 stations | 10% → 53% | 5% → 32% | 4% → 19% |
| Mean distance to the nearest city | 295 km | 368 | 446 |

Findings: Δv grows less than the forums suggest (the 6 h day's spin helps); **heating, not Δv, was the wall**. The ×3
heating gain had been compensating for the small planet's slow orbits. The world gains real room: area ×4 at 2×.

**Decision (Caio): about 2×, pegged to Earth rather than to "2× Kerbin":**

| | Value | Peg |
|---|---|---|
| Radius | 1,274 km | a fifth of Earth's (~2.1× Kerbin) |
| Surface gravity | 9.81 m/s² | Earth's |
| Day | 8 h | a third of Earth's |
| Atmosphere | top 100 km (Kármán line), scale height 7.5 km, sea-level density 1.225 | Earth-like |
| Selene | radius 348 km, surface gravity 1.62, orbit 38,440 km | the Moon's size ratio and gravity; a tenth of the Moon's distance |

**As built** (measured):
- Orbit costs 4,244–4,454 m/s; low-orbit speed is 3.4 km/s; the period at 300 km is 52 min; the equator spins at
  278 m/s.
- **Heating gain ×3 → ×1** (plain Sutton–Graves). That restores the old balance exactly: ascents peak at 35–76% of
  part limits; a shielded pod comes back from orbit with 69% ablator; a bare pod survives a low-orbit return (74%) but
  not a Selene one.
- **Presets resized:**
  - Lunar moves to a 2.5 m first stage (orbit with ~4,070 m/s left).
  - Big Lunar gains tankage and two Kestrel boosters (~4,100 left).
  - Passenger gets a 4 t tank (142 km apex, 6.6 g).

  A Selene landing and return is about 8,200 m/s in all: 4,300 to orbit plus ~3,900 (transfer 1,321, a 2.4-day trip).
- The program calendar follows the planet: a program day is 8 h (`DAY_S` derives from the rotation, so the launch
  window still matches a whole day). Air sampling has 10 bands. The sky shader and CPU light model take their scale
  heights from `TELLUS.H`. Map camera distances are in planet radii. The city texture is 2048×1024, keeping ~3.7 km
  texels.
- **Tests now take their geometry from the planet** (`LEO`, `ATM`, `VENT` at the top of test.mjs) instead of 600 km
  literals. Changes worth knowing:
  - The node burn tolerance is 1.5% (a 58 s burn to Selene).
  - The structural yank checks use a fixed 1.25 m test rocket, and "survived" means intact a minute after the yank.
  - The broadside failure check sets its speed through the air, not inertially (the faster spin was hiding it).
  - The tape check's pitch kick is retuned (8.95 s).

  106 checks pass.

**Other branches:** terrain (not yet merged) bakes a world map whose texels double in km and generates plate and
climate features over the unit sphere, so it needs a look when it merges. Economy and builder only pick up preset and
number changes.

## Ground stations (planning branch, 2026-10-07)

- **Sites:** the pad, plus stations bought at cities, each power's two biggest. **At home** 10M. **Abroad** 20M plus a 2M
  lease every 100 days, and only with permission: relations with home must be friendly (> 0.2) and their opinion of us
  ≥ 45. The panel gives the reason when they refuse. **If relations turn tense (< −0.2), they shut the station**
  ("…and keeps the furniture").
- **What they're for, measured.** On a planet this small one pass comes soon: a station at the target only brought
  one picture down 0.3 h sooner, because at 300 km a satellite sees a cap ~40° across and the pad is in view on most
  orbits. The real value is **contact time**. A polar satellite at 300 km has the pad in view 9–10% of the time;
  with five well-spread stations, ~54% (equatorial 200 km: 20% → 34%; polar 800 km: 18% → 79%). So **imagery sales
  now follow contact time:** 0.12M per day at full contact, about 4M a year with the pad alone versus 26M with a
  network. A foreign station (20M + 8M a year) pays for itself, and the network becomes a map of your foreign
  relations.
- Pictures for contracts come down at whichever station is in view first; the headline names it. Stations are drawn
  on the map (squares).
- Checks (§17, 4 new, 91 total): build rules and costs, the lease and the closure, delivery via a nearer station,
  contact time with and without a network.

## Orbital registry: persistent satellites, camera and antenna (planning branch, 2026-10-07)

The first slice of the parts-and-missions plan: things left in orbit stay there and keep working.

- **One absolute frame and clock.** Program time T = day × DAY_S; Tellus's angle = th0 + rot·T. **Lift-off waits for the
  daily launch window** (stacking ends, then the next whole day), so every flight's own frame (clock from 0) *is* the
  absolute frame, because a Tellus day is exactly one rotation. That makes persistence consistent with no change to
  flight physics: a satellite registered at the end of one flight sits over the right ground in the next (checked:
  3e-10 m). Selene's phase still restarts per flight; nothing in the registry depends on it yet.
- **Registry:** when a flight ends with the vessel alive in a stable Tellus orbit (periapsis above the air), it's
  registered (`PROG.sats`): state at its epoch plus its kit (camera, antenna, instruments, ballast, passenger). Named by
  kit: Lookout N, Beeper N, Boilerplate N, Ark N. Propagated on exact Kepler rails across program time. Listed in the
  Program panel ("In orbit"); drawn on the map as an orbit line plus a marker.
- **Parts:** *Imaging camera* (8M; ~10 µrad, so 2 m from 200 km, 3 m from 300 km) and *Antenna* (3M).
- **Imaging, between flights** (`satTick`, from the world tick). Every 30 s of program time, a camera satellite checks each
  accepted imaging contract. The target must be within 30° off nadir, slant range × IFOV ≤ the required resolution,
  the sun above 10° at the target, and cloud cover < 0.35 there. Then the picture waits on board until the satellite
  passes over a ground station (only the pad so far, elevation ≥ 5°) **with an antenna**.
- **Clouds on the CPU:** the sky shader's `cloudCovF`, ported like the land mask (same hash and noise). The shader's
  cloud drift now runs on program time, so the clouds you see are the clouds the satellites see. Mean cover ≈ 9%, in
  large systems.
- **Contracts:** a new `image` type (science, commercial and government clients; unlocks with the beeper): photograph a
  city at 2, 3, 5 or 8 m.
- **Disasters:** floods, wildfires, volcanoes, storms, locusts. About one per 45 days, always as a headline. If a camera
  satellite with an antenna is up, the affected power offers a short, well-paid imaging job; if not, the headline
  adds "(if only someone had a camera up there)".
- **Imagery sales:** each working camera satellite earns ~0.03M per day, shaded by the business cycle.
- Checks (`test.mjs` §16, 7 new, 81 total): frame consistency, the launch window, CPU cloud statistics, a polar
  300 km satellite delivering a 5 m image on day 2 while a 1 m request stays out of reach, no antenna means no delivery,
  and disasters plus income.

**Not yet:** ground stations beyond the pad (more stations = faster downlinks: politics, since they're on someone's
land); film return capsules; power and eclipses; orbital decay for low satellites;
rivals' satellites and visibility (the spy layer).

### Satellites in 3D (sats session, 2026-10-07)

Registered satellites used to exist only on the map; now you can fly past one.

- **Registration keeps a look.** New registry entries also store `shape` (each part still on: part key, position,
  `y0`, `h`, plus `phi`/`tdir`/`shell` when set), `cm`, and `qo`, the attitude in the orbital frame (prograde, orbit
  normal, radial: `orbQ`). Render-only; the sim never reads them. Saves are JSON, so plain arrays only.
- **Attitude rides the orbital frame,** not inertial space: world attitude = `orbQ(r,v)·qo`. A camera left looking down
  still looks down days later, which is what a real imaging satellite does (and stands in for the attitude control we
  don't simulate). The inertial alternative would tumble it once per orbit relative to the ground.
- **Drawing:** next to the debris, within 100 km of the camera, in flight mode. The mesh is rebuilt once per entry
  (`satMesh`, a WeakMap keyed on the entry, so a reloaded save just builds fresh). The satellite this very flight registered is skipped (`rec.satId`), since it's still `S` on screen.
- **Finding one:** in the flight view, satellites within 200 km get a diamond and `name · distance`; inside 300 m the
  mesh speaks for itself and the marker goes.
- **It keeps its flight marks.** Marks are render-side (`MARKS`, keyed on part objects) and the registry is sim-side, so
  `satRegister` hands the shape to a render hook, `HOOK.satLook`, which writes `mk = [soot, char, char direction]` onto
  each marked shape entry (rounded to 3 places, it goes into the save). `satMesh` puts them back into `MARKS` for the
  rebuilt parts, and the draw calls `setMarks` like the debris does. Each entry keeps its part index `i`, which is the
  shader's mark slot. Frost and nozzle glow aren't kept: they fade within a minute of flight.
- **Old saves:** entries registered before this have no `shape`. They get the marker but no mesh.
- Check (`test.mjs` §20): shape kept and JSON-safe, the marks hook gets the parts in shape order (fails if the hook call
  is removed); nose-down at registration is still exactly nose-down a quarter orbit
  and 2.6 orbits later. Screenshots (headless Chrome, RTX 3050): a Lookout 25 m off an Orbiter, a Beeper's marker at 3 km.

### Rendezvous (sats session, 2026-10-07)

Seeing a satellite isn't the same as reaching one. Now you can pick one as the target and fly to it.

- **Choosing:** click a satellite's marker on the map (click again to clear), or **G** to cycle through the registry and
  back to none. The target is per flight (`S.target`, the registry id); a revert or a new flight starts without one.
- **Sim side** (`tgtOf`, `approach`, `progT`, next to the registry): `tgtOf(s)` is the target's state at program time and
  the relative position and velocity. `approach(q, r, v, t0, span)` finds the closest approach between a Kepler state and
  the target: a 240-step scan, then golden-section on the best bracket. The span is two of our orbits; sub-orbital or
  escaping trajectories get none.
- **Autopilot:** four more modes, shown only while there's a target: *Target*, *Anti-tgt* (toward/away), *Rel pro*, *Rel ret*
  (along/against our velocity relative to it; *Rel ret* plus throttle is how you kill the last few m/s).
- **Map:** the target's orbit in orange and always labelled; the closest approach on the current orbit (green: our point,
  orange: its point, a line between them, distance and time) and on the plan after a maneuver node (white, `▸plan`).
  Recomputed at most 4× a second of real time (`tgtCA`, cached by target and node), or at once when the node moves.
- **HUD:** *Target* (distance, relative speed, closing or opening) and *Closest* (distance, time, relative speed there,
  and the plan's). **Navball:** orange marks for the target and anti-target, pink for relative prograde and retrograde.
  **Flight view:** the target's diamond shows at any distance, not just within 200 km.
- Checks (`test.mjs` §21, on its own sim instance): the closest approach to a 320 km, 2° target matches a 0.5 s
  brute-force scan (104.69 vs 104.72 km, same second), and the four modes point exactly where they say, falling back to
  the hold when the target is gone. In the browser: a synthetic click on the map marker sets the target.
- **Not yet:** docking (contact came next, see below); target-relative closest approach beyond
  two orbits (phasing over many revolutions); targeting the moon or debris; contracts that need a rendezvous
  (inspection, repair, retrieval). Those are the natural next slices.

### Contact: collisions with satellites (sats session, 2026-10-07)

Flying through a satellite is no longer possible. Bump it and it moves; hit it hard and things break.

- **Shapes:** every part is a signed distance field built from its profile (`d.prof`, radius by height, revolved), so
  cones, bells and flat discs are their real shape; the fin ring is its swept disc. Each part's surface is a cloud of
  sample points (rings every 0.2 m, ~0.25 m apart, plus the end caps). A point of one body inside the other is a
  contact: the depth-weighted point and normal over all such points, the deepest depth, and the part on each side most
  involved. Bounding spheres cull per body and per part pair first.
- **Response:** one impulse at the contact point, restitution 0.3, Coulomb friction 0.4, full rigid bodies on both sides
  (the vessel's `I`; the satellite's from its parts, masses as shares of its registered mass), after pushing the two
  apart by the depth. Momentum is conserved to 1e-27 relative.
- **No tunnelling:** within 5 km of a satellite the flight runs in physics steps even at 1× (rails would step past it,
  and in orbit without thrust it's always on rails). Each step is re-checked along the relative motion at 5 cm
  offsets (up to 400), from the start of the step, and the earliest touch is the one resolved. A 2 km/s pass moves
  40 m a step and is still caught.
- **Damage:** a part breaks when the closing speed exceeds its tolerance: 3 m/s for delicate parts (camera, antenna,
  instruments, chute, fins), 8 m/s for the rest (`d.tol` overrides). On the vessel it's `partLost`, as for burn-up. On a
  satellite a delicate part breaks off as debris and the satellite carries on without it (kit counts, mass and centre
  of mass updated); anything else breaking destroys the satellite (every part becomes debris, the registry entry goes).
  Above 150 m/s both are destroyed outright.
- **After a hit** the satellite gets new rails (state at that moment) and a free spin (`q.spin`: attitude and world
  angular velocity at a time); `satSpin` gives its attitude either way, and the renderer uses it. Torque-free spin is
  taken as a constant world axis (exact only about a principal axis; fine for a tumble you watch for minutes).
- **Measured:** a 0.5 m/s nose-to-nose bump between an Orbiter-class pod stack and a 660 kg Lookout leaves the
  satellite spinning at 0.2 rad/s. Not a bug: until it's hit, the satellite turns with its orbital frame (once per
  orbit) and the vessel holds still in inertial space, so after 2 s the flat faces meet 0.002 rad apart and the first
  touch is on the rim, 12 cm off the axis. A real flat-on-flat contact does the same.
- Checks (`test.mjs` §22, own sim instance): the 0.5 m/s bump (momentum, bounce at 0.24 of the closing speed, nothing
  breaks); 5 m/s (the satellite's antenna breaks off, both carry on); 2 km/s (caught, both destroyed); physics within
  5 km, rails at 20 km. In the browser: a 1 m/s bump bounces the satellite away; at 6 m/s its antenna and the Orbiter's
  own chute (its top part, also 3 m/s) come off as debris.
- **Not yet:** contact with debris (spent stages) or between two satellites; resting contact is a stream of small
  impulses (fine for bumps, not for pushing something for minutes); one contact point per step.

### Docking and related parts: plan (2026-10-07, not built; decisions for Caio)

**The blocker first.** A part has a position, an angle round the axis (`phi`) and, for engines, a cant. It can't be
upside down or tilted (open thread 4, "truly tilted bodies"). Two vessels docked nose to nose have opposite axes, so
merging their parts into one design doesn't fit the part model. **Proposal: a docked vessel is a rigid passenger.** The
vessel keeps its own parts; each docked body is a sub-body (shape, mass, centre of mass, inertia, relative transform)
fixed to it. Physics sums mass and inertia; contact, rendering and the registry carry the sub-bodies along; thrust,
aero and staging stay with the main vessel's parts. Undocking hands the sub-body back to the registry as a satellite
with the current state. A registry entry with sub-bodies is also how a **station** built from several launches persists.

**What docking needs, roughly in order:**

1. **RCS and translation control** (a prerequisite, not optional). With only a main engine, closing at 0.1 m/s means
   turning around for every correction. An RCS block (four nozzles, small thrust, its own monopropellant via a new `RES`
   entry), translation keys (KSP's I J K L H N), and a "kill relative velocity" SAS mode. Probably also a docking
   camera or a reticle that shows alignment with the target port.
2. **Docking port** (1.25 m class first). Two ports capture when they're within ~0.2 m, axes opposed within ~10°, and
   closing under ~0.5 m/s. A short magnetic pull, then a latch that makes the target a rigid passenger. Undock pushes
   it off at ~0.3 m/s. Contracts follow naturally: inspection (come within 50 m), service (dock, wait, undock), crew
   rotation (a biocapsule docks to a station).
3. **Grabber/claw** (KSP's "Klaw"). Latches onto any surface at under ~1 m/s, at the contact point and the current
   relative attitude (passengers can have any transform, so this is cheap once 2 exists). Retrieval and deorbiting
   junk, and catching a satellite that has no port.
4. **Robotic arm.** A real arm (joints, inverse kinematics, control) is a big slice. A cheap version: an arm part that
   captures a free-drifting target within ~10 m at under 0.1 m/s and berths it onto a port in a scripted 30 s motion.

**Also relevant:** fuel transfer between docked bodies; a cargo bay (retrieve a satellite and bring it home); lights for
docking on the night side; and contact with debris (also needed before the claw can grab a spent stage).

**Questions for Caio:** (a) is the "rigid passenger" model OK (docked things can't share fuel or be re-staged until we
add that explicitly)? (b) RCS fuel: a separate monopropellant, or draw from the main tanks? (c) which first after RCS:
the port or the claw?

**Decisions (Caio, 2026-10-07):** docked spacecraft stay separate bodies fixed together (a "superstructure", as in the
simulator Orbiter): each subsystem runs per body (thrust from every body, aero and heating per body, a load limit on the
port, contact, rendering, saving), and fuel crosses only through an explicit transfer or crossfeed. RCS has its own
propellant, starting with cold gas and moving through the eras; thrusters pulse. Order: RCS, then the docking port, then
the claw.

### RCS (sats session, 2026-10-07)

Translation control, and attitude control that doesn't need reaction wheels. The docking port needs it.

- **Parts** (palette: *Control*): *RCS quad (cold gas)*, a surface part (like the radial fin, with symmetry) with four
  nozzles: up and down the vessel's axis and both ways round it, 0.15 kN each, Isp 70 s (nitrogen). *Gas bottle*, a
  surface part holding 15 kg of nitrogen in a 30 kg bottle. New resource `gas`; every bottle aboard feeds every quad.
  Costs 1.5M and 0.8M. Quads are delicate in a collision (3 m/s). Thirty kilograms on a 4 t stage is ~5 m/s: modest,
  as cold gas is, and plenty for docking.
- **Real forces.** Every pulse is `addF` at the nozzle, so placement matters exactly as it should: a translation from
  quads off the centre of mass turns the vessel unless other nozzles cancel it.
- **Jet selection.** For each of the 12 signed axes (± force x, y, z; ± torque x, y, z), the non-negative nozzle duties
  that give that axis alone as nearly as the layout allows, scaled so the busiest nozzle is at 1. Solved exactly (Lawson–
  Hanson active-set non-negative least squares, with a small ridge term) once per layout and centre of mass (to 5 cm),
  then cached. A command is a sum of those, clipped to [0, 1]. This is how real jet-select tables work, and it means
  one ring of quads 1.4 m above the centre of mass still translates sideways without turning: it fires the up/down
  nozzles on either side to cancel the torque (at 157 N of sideways capacity, against 546 N for two rings).
- **Pulses.** Nozzles are on or off. A sigma-delta modulator per nozzle, started half-way, turns duty into whole 20 ms
  pulses (one physics step), so the minimum impulse bit is 0.15 kN × 20 ms = 3 N·s, and fractional duties leave a
  bounded jitter of a few mrad/s (a real thruster's limit cycle). Starting the modulators at 0 instead of ½ doubled it.
- **Attitude.** The control law now asks for the authority of wheels + gimbal + RCS (`ctrlAccel(s, true)`): the wheels
  and gimbal give their part as before, and the RCS fires real pulses for the rest. With RCS off nothing changes (the
  old call is untouched, and all earlier checks pass unchanged). A vessel with no pod (no wheels) now holds prograde on
  RCS alone: 0.001 rad after 60 s, against 0.51 rad with RCS off.
- **Controls:** **R** toggles RCS in flight (revert keeps R when crashed or landed). **I/K** forward/back along the nose,
  **J/L** and **U/O** sideways on the vessel's two other axes (KSP's H/N clash with Help and Node here). An RCS button
  under SAS; a HUD row with gas, its Δv and how many nozzles are firing. White puffs at nozzles that fired in the last
  80 ms. Tapes record the translation keys and the RCS switch; old tapes play back with RCS off.
- **Physics, not rails,** while RCS is on with SAS on or any control key held: thrusters can't fire on rails.
- **Mistake on the way:** the first solver was accelerated projected gradient. Opposed nozzles at the same spot cancel
  exactly, so the problem has no unique answer, and it fired both of a pair at ~10 %: forward thrust gave 90 % of the Δv for
  108 % of the gas. The ridge term picks the least-effort answer and the active-set solver gets it exactly.
- Checks (`test.mjs` §23): pure forward translation (Δv within 0.2 %, gas within 0.01 kg of Isp 70 s, no cross motion
  or spin); sideways across two rings (jitter under 5 mrad/s); one ring balanced; RCS-only attitude hold in whole pulses;
  physics while on. In the browser: the palette, both parts in the editor, a stage translating in orbit with puffs.
- **Not yet:** monopropellant and later thrusters for the later eras; a fine-control mode; exhaust hitting other
  spacecraft; ullage; reaction wheels that saturate; station-keeping. (See the RCS answer in the docking plan.)

### Docking port (sats session, 2026-10-07)

The first docking. Two ports meet, latch, and the satellite rides along; undock and it's itself again.

- **Part:** *Docking port* (1.25 m, palette *Structure*), a stack part whose top face is the port; a port is free when
  nothing is stacked on it and it isn't in use. 3M.
- **Capture:** two free ports latch when the faces are within 15 cm along our axis and 10 cm across it, their axes are
  opposed within 10°, and the port points close at under 0.5 m/s (checked each physics step before contact, so a good
  approach latches instead of bumping). The latch pulls the target's port onto ours (turned so the faces oppose, moved
  so they meet: at most 15 cm and 10°), and the joined vessel takes the pair's total momentum and angular momentum
  exactly. Too fast or too skewed and the ports just bump (contact).
- **Passengers (the decided model).** The vessel keeps its own parts; each docked body is an entry in `s.att` with its
  registry entry, its centre of mass and attitude in the vessel frame, the body it's docked to and both ports' part
  indices. `geom` adds their mass and inertia (each body's own inertia rotated into the vessel frame, diagonal kept as
  the vessel's own is). Contact sees their parts (part records can sit at a transform); rendering draws them; RCS and
  aero stay with the vessel's own parts for now (docked stacks live in vacuum, and a passenger's thrusters are a later
  slice).
- **Port loads:** each step every port works out the force and bending moment that make everything beyond it follow the
  vessel (non-gravitational acceleration plus rotation), against a rating of 30 kN and 20 kN·m. Above it the body breaks
  loose with its momentum. A 0.7 t satellite on an Orbiter-class stage: 7 % of the rating at 5 % throttle, broken at
  full throttle (about 4 g).
- **Undocking** (a button in the HUD's *Docked* row; recorded on the flight tape as `['D', id]`): the body, and anything
  docked through it, leaves on its own rails, pushed apart at 0.3 m/s along the port axis with momentum shared. It goes
  back into the registry as itself (name, kit, marks), spinning with the vessel's rotation. Ports don't recapture for 5 s.
- **The registry:** a docked satellite stays in `PROG.sats` flagged `docked` (skipped by everything that looks at
  satellites in orbit) until the flight ends, so a reload mid-flight can't lose it (the flag is cleared on load, which
  puts it back where it was before the flight). A flight that ends docked in orbit registers one stack: the new entry
  carries the others in `attached`, its own `mass`/`cm` are its own body's, and `satMP` gives the combined mass, centre
  of mass, inertia and parts. Landing docked brings them home (headline); a crash loses them.
- **Guidance:** with a target within 500 m, the HUD shows *Port* (distance between the ports, angle between their axes,
  closing speed, green when inside the capture limits) and *Line up*: the target port's offset and our drift in the
  RCS keys that fix them (L/J, U/O). SAS mode *Docking* holds the nose against the target port's axis (needs a target).
- **Fixed on the way:** satellite meshes were cached per satellite, so one that lost its antenna in a collision kept
  drawing it; they're keyed by shape now. And one edit of mine had swallowed the marks hand-off call into a comment;
  §20's check caught it.
- Checks (`test.mjs` §25): capture at 0.2 m/s, 4 cm and 3° off (momentum exact, faces 7e-16 m apart, masses summed); no
  latch at 1 m/s or 20°; the Docking mode lines up from 15° to 0.00°; port load held at 5 %, broken at full throttle;
  undocking (0.3000 m/s, momentum to 1e-16, position exact, no recapture); a flight ending docked registers one stack.
  In the browser: the approach with the HUD guidance, the latch, and undocking by the button.
- **Not yet:** docking to a port on a body that's itself docked to the target (only the target's own ports for now);
  passengers' thrusters, aero and heating; fuel transfer; a body whose port sits on a part that's staged away; the
  passengers' own rotational inertia in the port's moment; a soft-capture animation (the latch snaps the last ≤15 cm).

### The claw (sats session, 2026-10-07)

Grab anything, port or not, wherever you touch it.

- **Part:** *Claw* (palette *Structure*), a stack part with three jaws on top. 4M.
- **Grab:** when contact is found and the vessel's own claw (not one already holding something) is the part most
  involved, the contact is within 35 cm of its tip, and the contact points close at under 1 m/s, it grabs instead of
  bouncing. The target is moved out of the overlap along the contact normal and then held at exactly the attitude it
  had: nothing snaps, because a passenger can sit at any transform. The jaws close on whatever they reach: in the test
  they straddle the waist between a satellite's camera and its engine, 14 cm from the jaws' centre.
- **One join:** docking is now `dock` (work out where the ports put the target) plus `join` (two bodies become one,
  momentum and angular momentum kept), and the claw uses `join` directly. Attachments carry a `kind` ('port' or 'claw')
  through flattening, registration and undocking.
- **Joint ratings per part** (`jF`, `jM`): a port 30 kN / 20 kN·m, the claw 15 kN / 8 kN·m. A 0.7 t satellite in the claw:
  13 % of the grip at 5 % throttle, torn loose at full throttle.
- **Release** (HUD button): 0.1 m/s along the claw, momentum shared; back in the registry as itself; no regrab for 5 s.
- **HUD:** *Claw* row with a target near: the jaws' distance to the target's surface (its parts' distance fields,
  `bodyDist`) and the closing speed, green under 1 m/s. SAS *Target* points the claw at it.
- **A bug the sim checks couldn't see:** the claw's HUD row declared `cl`, and the port rows already had a `cl` in the
  same function, so the page didn't load at all, while every check passed (they only load the sim core). `test.mjs`
  now also checks that the whole page script parses. Also on the way (my mistake, not the code's): restoring a
  deliberately broken line with `git checkout -- index.html` threw away the uncommitted claw work; the edit script
  re-applied it. Commit before mutation-testing.
- Checks (`test.mjs` §26): a portless satellite grabbed at 0.4 m/s at its own 90° attitude, momentum kept; no grab at
  2 m/s or with a port touching instead; the grip holds at 5 % and tears at full throttle; release at 0.1 m/s with no
  regrab; the page parses. In the browser: approach with the *Claw* row, the grab, and release by the button.
- **Not yet:** grabbing debris (spent stages: contact with debris comes first); a free pivot so the held body can be
  turned to line up; arming/disarming (it grabs whatever its jaws touch slowly).

## Stations, modules and moonbases: plan (2026-10-07, sats session with Caio; Phase A built)

**Decisions (Caio):** stations first, then moonbases. Modules reach a station either as their own rockets or carried in a
**cargo bay**; once out, **both** you fly them yourself (RCS) **and**, as the more advanced option, an **arm** berths them.
A winged runway shuttle is a later project of its own; the bay comes first and works on any rocket. **One vessel per
flight is to be revisited** now, since flying a released module yourself needs it.

**What a station is:** a registry stack (an entry with docked bodies, already built for docking), grown over flights.
Modules are parts with jobs: habitat (crew capacity), lab (science per crewed day), hub (side-facing ports), power,
depot (fuel for Selene missions). Its abilities are what's docked. Assembly in orbit gets past what survives max-q.

**Phases:**
- **A. Several vessels in a flight.** `S` stays the vessel you fly; `FLEET` holds the others. A separation that takes a
  command part (pod, or a new probe core) makes a vessel, not debris. Every vessel is stepped (physics or rails
  together), they collide with each other, and you switch with `[` / `]` (a tape op). Controls only reach the vessel
  you fly; each keeps its own throttle, SAS and RCS. At the end of the flight every vessel left in orbit is registered.
  Measured before starting: the sim core already takes the vessel as a parameter (16 global `S` references, 3
  functions read the controls), so this is additive; the 448 `S` references in render/UI mean "the vessel you fly".
- **A2. Vessels that persist as vessels:** registry entries keep their design and state, so a later flight can take
  control of a registered vessel (a station's tug, a module waiting in orbit).
- **B. Cargo bay:** a hollow stack section with doors; contents shielded from air and heat; doors open in orbit; the
  payload is released (a vessel if it has a command part) or picked out by the arm.
- **C. Station modules and station state:** habitat, lab, hub (side ports), power, depot; station state from its docked
  modules; contract types proposed to the economy session (flagship "First station" in milestones; resupply, crew
  rotation, client experiments, tourists; reboost once orbits decay).
- **D. The arm:** captures within reach, berths onto a port along a computed path.
- **E. Moonbase:** objects resting on a body as registry entries (planet-fixed), modules landed near a beacon forming a
  base, surface functions (science, fuel).

### Phase A built: several vessels in a flight (sats session, 2026-10-07)

- **Probe core** (palette *Command & payload*): a command part without crew, with small reaction wheels (4 kN·m). Wheels
  are now any part's `torque` (pod or core): the control authority, the structural reaction point and the editor's
  "no control torque" warning all follow that. The root of a design is a pod, else a probe core, else as before.
- **Separation makes a vessel** when the parts leaving include a command part (pod or core); otherwise debris, exactly as
  before. The new vessel is built from clones of those parts (the originals stay off in the vessel they left),
  re-indexed, with their own part tree, segments and the staging events that concern only them, in the same vessel
  frame, so it starts exactly where the parts were. Their marks carry over. The separation push now goes both ways:
  momentum and centre of mass are kept to 1e-20 / 1e-16 m (debris still gets the old one-sided push).
- **`S` is the vessel you fly; `FLEET` holds the others.** Every tick the others step first from the same instant (the
  clock is S's to advance; `physStep` advances it, so it's held for them), then S, then every pair is checked for
  contact. Rails: all coast together, each exactly as it would alone (the bodies session's perturbations included);
  physics as soon as any vessel needs it. Controls reach only S (`inpOf`); the others keep their own throttle, SAS and
  RCS.
- **Switching** with `]` / `[` (cycling through all), recorded on the tape (`['V', i]`); the flight record follows the
  pilot. Vessels get names when there are two: *Capsule N*, *Probe N*.
- **The end of the flight** registers every other vessel left in a stable orbit (with anything docked to it).
- **Shown:** the other vessels drawn (with their docked bodies), a marker with name and distance in the flight view,
  their orbits and labels on the map, and a HUD *Vessels* row.
- Checks (`test.mjs` §27): separation (momentum, centre of mass, parts); one clock for both, controls only to the flown
  one; switching hands over the record; rails exactly as alone; vessel-on-vessel contact (momentum to 2e-16, parting);
  registration at the end. Browser: separation in orbit, the HUD row, switching with `]`, the map.
- **Not yet:** ~~docking two vessels of the same flight to each other~~ (done, below);
  a vessel that keeps its controllability after the flight (A2); fleet vessels' plumes and RCS puffs aren't drawn;
  a vessel far away is still fully simulated (fine for a few).

### Docking vessels of one flight (sats session, 2026-10-07)

Two halves launched together (or a module you just released) can now dock to each other, and come apart as vessels.

- **Latch** as with a saved satellite (same capture limits, same `join`), checked each tick for every pair of vessels
  before contact. The vessel you fly is the host; between two you aren't flying, the earlier one is. The other becomes
  a passenger through a registry-style entry built from its parts (`entryOf`: shape, own mass and centre of mass, kit,
  whatever it already carries), with its live vessel kept beside the entry out of sight of the save (not enumerable),
  so a stack registered at the end of a flight serialises normally.
- **Undock** gives the vessel back: flyable, in the fleet, with anything docked through it, pushed off at 0.3 m/s with
  momentum kept. The claw grabs vessels too.
- **Targets:** a vessel of the flight can be the target (`G` cycles satellites, then this flight's vessels, then none);
  closest approach, the Port / Line-up guidance and the *Docking* SAS mode all work against it.
- **Tapes now record the target** (`tg` in the controls), so an autopilot mode that depends on it replays the same. That
  was a gap since rendezvous.
- **A bug the checks missed:** near another vessel of the same flight the game coasted on rails (the 5 km physics rule
  only looked at saved satellites), so in play two vessels passed through each other and never docked, while every
  check passed, because the checks step physics directly. Now `fleetNear` keeps the flight in physics within 5 km of
  another vessel, and the Phase A check asserts it.
- Checks (`test.mjs` §28, plus the §27 rails check tightened): latch (momentum exact, mass summed, the vessel kept);
  undock gives a flyable vessel at 0.3000 m/s; two vessels you aren't flying dock (the earlier hosts); the Docking mode
  aims at a vessel's port; a stack carrying a vessel registers and serialises (0.9 kB, no hidden vessel in it). Browser:
  target with `G`, guidance, latch, undock by the button, fly the module.
- **Not yet:** a vessel docked into a stack and saved at the end of the flight comes back next time as a passive part of
  the stack (A2: vessels that stay flyable across flights).

### Phase B built: the cargo bay (sats session, 2026-10-07)

- **Part:** *Cargo bay* (palette *Structure*): a floor (its stack height, 0.25 m), walls 4 m tall (1.6 m across, 1.4 m
  inside: room for 1.25 m modules), and a clamshell roof of two doors. Payloads stack on its floor the ordinary way, so
  the editor needed nothing new; a part on top of the bay sits *inside* it. Its centre of mass is up the walls (`cm`).
- **Enclosure** (`assemble`, next to the interstage's): a part is in the bay (`p.inBay`) if it sits on the floor within
  the walls and under the roof; anything sticking out stays exposed. Geometric, so it doesn't matter where the root is.
- **Shielding:** while the doors are shut, enclosed parts are out of the airflow entirely (no air load, no heating; the
  bay's outline is its whole closed shape, roof included). From the moment the doors are told to open until they're
  shut again, the payload is exposed and the bay's outline has no roof. Measured: 0 vs 123 kN on the payload at 400 m/s,
  8 km up. (First version left it shielded after opening: the outline was rebuilt at 0 % open.)
- **Doors:** 2 s to open or close on the flight clock (deterministic, recorded: tape op `['B', op]`); key **B** or the
  HUD's *Bay* row. A reversal mid-swing continues from where the doors are. The mesh is rebuilt while they move.
- **Release** (HUD button, doors fully open): the payload leaves through the top along the bay's axis at 0.3 m/s,
  momentum shared, as a vessel whether or not it has a command part (*Payload N* otherwise, so a satellite released
  from a bay doesn't vanish as debris). Refused with the doors shut, or if the vessel's own command part is inside.
- **Contact:** the bay is hollow (walls, floor, a roof only while shut), so the payload slides out without touching it:
  15 s later it's still parting at 0.3006 m/s, its base clear of the rim.
- Checks (`test.mjs` §29): enclosure; shielding shut vs open; release refused shut, then a vessel at 0.3000 m/s with
  momentum exact; a clean exit; a payload without a command part is a vessel; the hollow contact shape. Browser: the
  bay in the editor, doors opening, release, the payload leaving.
- **Not yet:** the arm taking a payload out (Phase D), or putting one back in for the trip home (retrieval); a side-
  opening shuttle-style bay (needs an "inside" attach in the editor); a 2.5 m bay; the doors' look (they read a little
  oddly mid-swing, for the visuals session); the editor doesn't yet say whether a payload fits.

### Phase C built: modules, side ports and station state (sats session, 2026-10-08)

**Caio: keep it modular, ports placeable on any structure.** So there's no hub module: any part with radial ports is a hub.

- **Radial docking port** (palette *Structure*): a surface part (with symmetry, like an RCS quad) that faces out from the
  side of whatever it's mounted on, its face 0.3 m off the skin. Every port now has its own face and axis (`portGeom`:
  a stack port faces up its line, a radial one outward), and docking, port loads, undocking, the Port / Line-up rows and
  the Docking mode all use it. A radial port's contact shape is its cylinder turned onto the radial axis.
- **The Docking mode now commands a whole attitude**, roll included. Aiming the nose can't bring a side port round when
  the turn needed is a roll about the nose itself (it sat at 90° doing nothing). It now asks for the minimal rotation
  that puts our port's axis onto the target port's, and the attitude controller drives the full rotation error. A nose
  port is unchanged; every other SAS mode keeps its old code path. Measured: a side port 90° off locks on in 10 s and
  then tracks the target port as it turns with its own orbit (an early check compared against the port's starting
  direction and read 4.6° after 40 s: that was the target moving, 0.0011 rad/s).
- **Line up** shows the offset and drift on the two body axes across *our* port's axis, in the RCS keys that fix them
  (L/J for X, I/K for Y, U/O for Z): a side port's approach distance is no longer reported as a sideways offset.
- **Modules:** *Habitat module* (berths for three, 300 kg of supplies: 60 crew-days) and *Laboratory module* (palette
  *Station*). New resource `sup` (supplies).
- **Crew** builds on the bodies session's crew capsule: a capsule counts if it flew real people (the escape tower
  qualified), not dummies. Registered shapes now keep each part's resources and mark crewed capsules (`shapeOf`).
- **A station** is a registry stack with a habitat or a lab (`stationOf`): berths, crew (people in crewed capsules
  docked to it, up to the berths; each capsule stays as its crew's lifeboat), labs, supplies (pooled across the stack),
  free ports. **Between flights** (`stationTick`, from `satTick`): the crew uses 5 kg per crew-day; labs work at up to
  two people each and add lab-days to the station and the program (`PROG.labDays`). Supplies low (under 10 days) and out
  make headlines; out of supplies, the lab stops (nobody is harmed or evacuated by fiat). The Program panel shows a
  line per station.
- Checks (`test.mjs` §30): radial port geometry; a module docking onto a hub's side at right angles; the side port's
  load and undocking along its axis (0.300000000 m/s); the Docking mode bringing a side port round from 90°; station
  state (3 berths, crew 2, 1 lab, 30 days); 40 days between flights (supplies out after 30, 60 lab-days, the headline);
  dummies bring no crew. §28's Docking-mode check updated for the attitude target. Browser: four side ports on a hub,
  a lab module docking onto one.
- **Bringing a crew home needs A2** (a capsule left at a station has to be flyable in a later flight). That's next.
- **Not yet:** power; transferring supplies or fuel explicitly (supplies pool across a station; fuel doesn't cross);
  a port facing down a stack (parts can't be flipped; side ports and top ports cover most needs).

**Contract types proposed to the economy session** (for them to price and schedule; nothing built on the contract board):
1. **First station** (flagship, milestone payments): a habitat in a stable orbit with two free ports → a crew visits
   (a crewed capsule docks) → a lab added → 30 crewed days.
2. **Resupply** (repeatable, generated from a station's supply days): deliver N kg of supplies to station X before it
   runs out (dock a module carrying `sup`). Urgency rises as the days fall.
3. **Lab time** (science or commercial client): N lab-days on station X within D days. Pays per lab-day.
4. **Crew rotation** (needs A2): bring the crew home and replace them before the supplies or their tour runs out.
5. **Expansion** (a client's module): dock a module of a given type to station X (e.g. a commercial lab, a hotel
   habitat once tourism exists).
6. **Reboost** (once orbits decay): raise station X's periapsis above a floor.

### A2 built: vessels that stay flyable across flights (sats session, 2026-10-08)

- **What a registry entry keeps now:** its design (`q.stack`), its state (`q.vst`: which of the design's stage segments
  have ignited, SAS mode, RCS, chute) and, per shape part, its index in that design (`o.oi`). Vessels that separated keep
  their parts' design indices (`p.oi`, `p.oseg`), so any descendant of a design rebuilds the same way. Entries from before
  this have no design and stay passive (no Fly button).
- **Rebuilding** (`vesselOf`): assemble the design again, switch off the parts the entry no longer has, restore
  resources (fuel, supplies), crew aboard (`p.crewAboard`) and flight marks, find the next staging event from what's left
  (the first with something still to drop, a segment not yet lit, or a chute), carry whatever is docked, and place it on
  its rails at that moment. Staging is *derived*, not stored as an index, because a separated vessel's stage list is a
  re-indexed subset of its design's.
- **Fly** (Program panel, a flyable vessel in the satellites list): a flight that starts in orbit on the next whole day.
  No hardware to buy; the fixed operations fee (`OPS_FIX`) is charged as for any flight (**economy:** your call). The
  flight record says `fromOrbit` (and its tape can't be saved as an autopilot: tapes replay from the pad).
- **In a flight:** `]` / `[` also reach your flyable vessels within 2.5 km, loading them into the flight as you switch
  (tape op `['L', id]`). Undocking a body that can be flown gives a flyable vessel, not a passive satellite. A vessel that
  came from the register goes back on it as itself (id, name, history: images, lab-days).
- **Crew:** a capsule keeps its crew across flights. Switching to a vessel with crew aboard makes them this flight's crew
  (the bodies session's crew rules then apply: air, g, cabin, home safe). So **crew rotation works**: fly the station,
  undock the crewed capsule, switch to it, bring it home; a new crew docks theirs.
- Checks (`test.mjs` §31): rebuild through a save (parts, fuel, mass, place, staging); a separated vessel rebuilds with
  its engine still lit; identity on re-registration; a station flown again undocks its crewed capsule as a flyable
  vessel with its crew of 2; a nearby flyable vessel loads into the flight and returns as itself. Browser: the Fly button
  and a flight starting at 300 km.
- **For economy:** a flight from orbit could complete orbit contracts with something already up (`R.fromOrbit` lets you
  rule that out), and whether to charge operations for it is yours.
- **Not yet:** a design changed in the builder after launch doesn't affect what's in orbit (each entry keeps its own
  copy), but a part definition changed by an update (heights, masses) shifts a rebuilt vessel slightly from its saved
  shape; temperatures restart cold.

### D built: the arm (sats session, 2026-10-08)

- **Part:** *Robotic arm* (palette *Station*): a base on the side of any structure; two 5 m booms (10 m reach) drawn each
  frame by two-link inverse kinematics from the shoulder to the grapple point, folded along the hull when free. Its
  grip is weak (3 kN / 4 kN·m): a hard burn while it holds something tears the body loose.
- **Grapple** (HUD *Arm* row; tape op `['A', op]`): the nearest body within reach moving under 0.5 m/s relative to us
  (a satellite, a vessel of this flight, or the payload in our own open bay, which leaves the vessel's parts and is held
  at once) is held where it is, as a passenger (`kind 'arm'`), gripped where the line from the shoulder meets its
  bounding sphere.
- **Berth:** the closest pair of free ports (one of ours, not on the held body or anything docked through it; one of
  its) decides the goal; the arm carries the body (with anything docked through it, rigidly) at 0.15 m/s and 3°/s to a
  stand-off 0.5 m out, aligned, then straight in, and it latches as a docking (`kind 'port'`). Both poses must be within
  reach. Physics, not rails, while it moves.
- **Stow:** into an open, empty cargo bay, its own axis up the bay's, centred, its base on the floor (`kind 'bay'`):
  from above the rim, then down. Close the doors and fly it home (retrieval: a satellite brought back intact). A stowed
  body is released from the *Docked* row.
- **Release:** let go with no push.
- **Moving a held body is internal motion:** the stack's centre of mass and velocity stay put; the rest of the stack
  moves the other way. Measured in one step: the hub moved 1.471 mm for the module's 1.5 mm, exactly the mass ratio.
- Checks (`test.mjs` §32): grapple a lab and berth it on a hub's side port (faces 2e-16 m apart, 58 s); the centre-of-mass
  bookkeeping; out of reach refused; a payload taken out of the carrier's own bay and berthed on its side port; release
  without a push (4.5e-13 m/s), grapple again, stow on the bay floor. Browser: the arm reaching, carrying, berthing.
- **Not yet:** the arm passing through the stack's own structure on its way (no self-collision for held bodies); a
  manual mode (joint-by-joint or end-effector keys); grappling debris; the arm taking a held body into a bay that is
  part of a docked module rather than our own parts.

### E built: moonbases (sats session, 2026-10-08)

- **Landed objects persist.** A vessel that ends a flight resting on a body other than home is registered in that
  body's frame (`q.landed`, `q.bodyName`, `q.pf` its centre of mass, `q.ql` its attitude), with its shape, design and
  state like any entry. It's drawn when near, labelled on the map, listed in the Program panel under *On the surface*
  (Fleet tab), and flyable: **Fly** starts the flight standing where it stood, and it lifts off under power. The
  register's orbit-only code (`satsUp`) no longer sees landed objects; they have their own list (`landedUp`).
- **Bases:** a *Base beacon* (palette *Station*) makes a landing site a base (named *Selene Base N*); everything landed
  within 500 m of it, along the surface, on the same body belongs to it. Berths, crew (crewed capsules landed there, up
  to the berths), labs and supplies add up across the members, and between flights a base works exactly as a station
  does (one shared `crewTick`): supplies used, lab-days earned, headlines when low or out.
- **Landing on a target:** a landed object can be the target (`G` cycles those on the body you're at). The HUD's
  *Landing* row gives the distance along the surface, the bearing, and how far the predicted impact point is from it
  (green inside the base's 500 m); the flight view marks it.
- **Contact** now runs on any body: landed objects are immovable (and, for now, take no damage); the orbital register is
  still only around Tellus. A capsule dropping onto a habitat at 1 m/s rebounds at 0.33 m/s; the habitat doesn't move.
- Checks (`test.mjs` §33): saved in Selene's frame (and out of the orbit lists); flown again from the surface and lifting
  off; a base of four with a fifth habitat 2 km away left out; 10 days at the base (20 lab-days, 200 kg used) and a day
  of the orbit code with landed objects present; the bounce off a module; a base as the target. Another session's guard
  (every Program heading must have a tab) caught my new heading; it's in the Fleet tab. Browser: a base of four on
  Selene seen from the beacon lander, and its Program panel lines.
- **Not yet:** surface docking or rovers between modules; damage to landed modules; landed objects on Tellus away from
  home (a vessel landing at home is recovered, as before); power and in-situ fuel at a base.

**The stations plan is built end to end** (A, A2, B, C, D, E). What it needs next is mostly the economy session's:
contracts for stations, bases, retrieval and crew rotation, and the rules for flights from orbit.

## Rovers: plan (2026-10-08, sats session with Caio; nothing built yet)

**The problem (Caio):** in KSP rovers are a chore. Taking one already assembled on a mission is awkward, assembling one
on another body is worse, and just getting it right side up is a job in itself. The pain is mostly **packaging and
deployment**, not driving: rovers are built in a rocket editor, ride bolted sideways onto a lander, and arrive by
"decouple and hope". Real rovers solve it with **deploy mechanisms** (Apollo's rover unfolded off the lander's side,
Lunokhod drove down ramps, Curiosity was lowered on cables) that make "upright on its wheels" a designed outcome.

**Decisions (Caio):**
1. **A rover designer of its own**, not the rocket builder (rovers are horizontal; our parts can't tilt). A chassis with
   slots: wheels, power, a mast (camera, antenna), an arm (sampler), instrument bays. Live stats: mass, top speed,
   steepest climb, **tip-over angle** (centre of mass height against track and wheelbase).
2. **Wheel-contact physics:** a rigid body with per-wheel suspension (spring and damper), traction limited by the
   surface's friction and the wheel's load, rolling resistance from soft ground, bumps from rough ground (the terrain
   session's `SURF` per biome, and `SURF_MOON` regolith), motor power and torque, steering, brakes. Tipping and
   low-gravity bouncing are real; no magic self-righting (the designer states the tip angle; later an arm or a crew may
   right a small rover).
3. **Start with R1** (below): build and test-drive rovers at home before any spaceflight.

**Slices:**
- **R1. Designer, driving, test drive at home.** The designer and its stats; the rover as its own kind of vessel with
  its own step; "Test drive" puts it at the launch site on real Tellus terrain (biomes drive differently); an option
  for lunar weight (NASA trained Apollo crews on a 1/6-g rover, "Grover"). Test drives are engineering data: wheels
  qualified by distance and slope, a design's measured climb limit and tip angle.
- **R2. Stowed package and deployment.** In the rocket builder a rover is one part (its stowed size and mass) with a
  mounting style: folded on a lander's side, on deck with ramps, in a cargo bay; later a sky crane. **"Deploy rover"**
  on a landed lander checks the ground at the deploy spot and, if it's fit, ends with the rover upright on its wheels
  after a short scripted unfold or drive-off; if not, it refuses and says why. Then driving on other bodies; rovers
  persist as landed, flyable vessels (A2/E machinery).
- **R3. Power and contact:** solar panels and batteries (Selene's day and night), line of sight to the lander, a relay or
  home (hills block it).
- **R4. Instruments and science** (first slice built: "R4 built" below) (each hinging on something the sim computes): samples by terrain unit, brought to the
  lander or an ascent vehicle (sample return); a spectrometer on rocks; camera panoramas (sun angle); seismometers set
  out as an array (spacing is what gives an interior map); ground-penetrating radar along a traverse; a drill or
  heat-flow probe (depth, power); a magnetometer traverse; ice in permanently shadowed polar craters (hard on power).
  Contract types proposed to economy.
- **R5. Drive plans:** waypoints a rover carries out *between flights*, with results arriving as news (as the imaging
  satellites already work): no hours of real-time driving.

**Needed from others:** Selene's terrain (craters, maria and highlands, boulders, slopes) from the terrain session:
today Selene is a smooth sphere apart from the regolith model; power (R3) is new everywhere.

### R1 built: the Rover yard (sats session, 2026-10-08)

- **Screen.** *Rover yard*, from a button in the Program header (`go('rover')`, `mode='drive'`). On the left is the
  designer; on the right a readout: speed, heading, pitch and roll against the tip angles, ground, battery, this drive.
  Designs live in `PROG.rovers` (name, chassis `ch`, wheels `wh`, count `n` 4/6, springs set for `spr` Tellus/Selene,
  deck `slots`).
- **Parts.** Three chassis (`RV_CH`: 3/5/8 slots), three wheels with hub motors (`RV_WH`; the wire-mesh one is the lunar
  rover's: 0.82 m, 190 W), and deck items (`RV_IT`): battery, crew seat (occupant included), camera mast, high-gain
  antenna, sample arm, spectrometer, seismometer pack, drill. Instruments are only mass and height until R4.
- **On paper** (`rvStats`), for Tellus on grass and Selene on regolith:
  - centre-of-mass height;
  - tip angles sideways, forward and back;
  - steepest climb and what limits it (traction, motors, tipping backwards);
  - top speed (gearing or power against rolling resistance);
  - the speed at which a full-lock turn tips or slides it;
  - range on the flat.
- **Physics** (`rvNew`/`rvStep`/`rvRun`, in the SIM block, 1/240 s steps, in the planet's frame):
  - one rigid body;
  - per-wheel spring and damper along the chassis's down axis (compression rate from the mount's approach speed);
  - grip solved over four passes, each wheel's impulse kept inside its friction circle (μ × load);
  - hub motors limited by torque, power and gearing;
  - a parking brake when stopped;
  - rolling resistance `rvCrr` (soft ground, eased by bigger wheels);
  - bumps on rough ground (value noise, a quarter of the biome's `rough` in metres);
  - the chassis corners, deck-item tops and hubs touch the ground too, so tipping over is real and nothing rights it;
  - a battery, drained by the motors and 30 W of electronics.
- **Where to drive:**
  - the **test yard**, 320 m east of the pad (`yardOf`, `RV_YARD`): ramps of 10°, 20° and 30° and side slopes of 20°
    and 35°, all 2.5 m high and made of gravel (μ 0.65, so 35° is past its grip);
  - **open country** (`countryOf`): gentle land 5–8 km out, on the biome's real ground;
  - either at Tellus's gravity or as a **lunar trainer** (Selene's gravity on Tellus's ground).

  The sea ends a drive. Off the pad itself the levelled ground drives as grass.
- **Records.** Each drive's record is kept per design and per gravity (`d.test.T` / `.S`): km, steepest climb, top
  speed, tip-overs. Each wheel kind also accumulates its tested km (`PROG.wheelKm`), for R2's reliability.
- **What it shows:**
  - The default two-seat rover is sized like Apollo's. At home it climbs only 7° and stalls on the 20° ramp: its hub
    motors are sized for a sixth of the weight, as the real one's were; it couldn't carry its crew on Earth.
  - As a lunar trainer it tops all three ramps; the 30° one is at the edge of the gravel's grip.
  - At Selene's gravity a full-lock turn lets go at under half the speed it does at home.
  - A top-heavy rover (three crew on a small chassis, 38° on paper) tips on the 35° slope. The springs lean it a few
    degrees past the rigid figure: keep a margin.
- **Checks:** `test.mjs` §34, 7 checks:
  - the stats;
  - settling where the designer says;
  - the designer's top speed (2.14 against 2.15 m/s);
  - the ramp at home against the trainer;
  - holding on 20° and sliding on 35°;
  - a top-heavy rover tipping where a low one doesn't;
  - no battery, no drive, and the record folding.

  Mutation-tested: dropping the friction circle, solving grip in one pass, removing the body contacts or ignoring the
  battery each fails a check.
- **Not yet:**
  - science (R4);
  - deployment (R2);
  - power generation (R3);
  - trees as obstacles (rough ground is only bumps);
  - a shadow under the rover;
  - era gating and prices for rover parts (economy).

**Overlap with "Planning before the flight"** (economy's spec, above):
- **R5's drive plans are a surface leg of the mission plan,** not a system of their own. A traverse is waypoints on the
  same timeline (v1.42), executed between flights at the era's error, with results arriving as events.
- **The deploy check (R2) belongs to the planner too.** Choosing a landing site there should already say whether the
  rover can deploy and drive away. That draws on its *tested* climb and tip figures from R1, much as the trajectory
  study sets a trajectory's precision.
- **Traverse planning needs a map of the ground.** How well a route can be planned depends on how well the site has
  been imaged from orbit, which ties the imaging satellites to surface work, as Lunar Orbiter's photos did for Apollo.
- **Rover instruments (R4) use the same pointing and activity timeline** as orbital instruments (Owners and order, item 3).

### R2 built: packed, deployed, driven anywhere, kept in the field (sats session, 2026-10-08)

- **Two mounts** (palette *Surface*):
  - **Rover, folded (side mount)** (`rvfold`): a surface part, the lunar rover's way. Only small and medium chassis fold.
  - **Rover deck with ramps** (`rvdeck`): a stack part, Lunokhod's way, for rovers up to 3.8 m long.
- **Packing.** A new mount packs the rover selected in the Rover yard. Its part options (right-click) choose another or
  none. The node keeps a copy of the design (`nd.rvd`), and its mass is added as the part's `xm`. A large rover has no
  mount yet: a cargo bay or a sky crane would be next.
- **Deploying.** The HUD's *Rover* row has a **deploy** button once landed (`tapeRover`, tape op `Y`). Otherwise it
  says why not (`rvDeployCheck`):
  - the lander is moving or not landed;
  - the rover doesn't fit its mount;
  - a crewed rover with nobody aboard;
  - the lander leaning more than 15°;
  - at the spot where the rover would end up:
    - sea;
    - a slope over min(20°, the rover's side tip angle − 15°);
    - a rover-sized rock (on rough ground a share of 4 m cells has one; regolith is rough, so one side can be blocked
      and the other clear);
  - for a deck, ramps steeper than min(25°, the rover's forward tip angle − 10°).

  The deck tries all four sides and takes the gentlest ramps that pass. The ramps telescope 6 m, so a deck on top of a
  short lander works (24° in the check) and one on a tall stack doesn't (50°).
- **What a deploy does.** It takes the rover's mass off the lander, keeping the lander where it stands (its centre of
  mass moves, not the lander). Then a scripted pose, 8 s for an unfold or 10 s down the ramps, ends with the rover
  physical, upright on its wheels, square to the ground. Nothing in the deploy depends on the player's driving.
- **Driving in a flight.** `]` from the lander drives a deployed rover (then the next); `[` goes back. W S A D and Space
  go to the rover, not the lander (the lander's keys are blocked while you drive). The camera follows, and a readout
  panel shows on the right. The rover steps on any body in that body's frame. Landed vessels are obstacles: upright
  cylinders the rover's footprint box can't enter. A rover not driven and at rest sleeps.
- **Kept in the field.** At the flight's end, every rover that isn't in the sea stays where it is (`PROG.rvOut`). A
  later flight on that body within 2.5 km takes it back in. The lander's saved shape remembers its rover is gone (`rvOut`).
- **Driving from home.** The Program screen's *Rovers in the field* (Fleet tab) lists them. An uncrewed one has
  **Drive from home**, which opens the drive screen wherever it is, as Lunokhod was driven from Earth. A crewed one is
  driven by its crew, from a lander there.
- Fixed on the way: autopilot tapes replayed arm operations (`['A', op]`) as aborts. Playback now aborts only on a bare
  `['A']`.
- Checks: `test.mjs` §35, 6 checks:
  - mass and refusals;
  - the side deploy (lighter, unmoved lander, rover upright beside it);
  - backing into the lander;
  - kept in the field, taken back, and the saved lander without it;
  - deck ramps short against tall;
  - a leaning lander.

  Mutation-tested: no obstacles, a shape that forgets the rover is gone, no packed mass, no lean check, or a lander that
  isn't held in place each fails a check.

  Browser: on Selene at noon, one side was blocked by a rock and the other deployed. The rover unfolded, drove, and the
  view went back to the lander. It was then kept in the field and driven from home. The deck with its rover showed in
  Assembly with its part options.
- **Not yet:**
  - a cargo bay or sky crane for large rovers;
  - an unfold animation that looks folded (the scripted pose moves the whole rover);
  - time passing while you drive from home (the clock is held);
  - Selene's real terrain (it is still a smooth sphere with bumps and rocks);
  - power, contact and the signal's delay (R3);
  - science (R4);
  - drive plans (R5).


### R3 built: Selene tidally locked; rover power and contact (sats session, 2026-10-08)

**Selene is tidally locked (decided with Caio).** Before this, Selene didn't turn and the sun never moves, so each spot
on Selene was in permanent day or permanent night, and Tellus circled the sky of every spot once an orbit. Now
`bodyTheta(SELENE, t)` follows its orbit (`lockTh`). Its planet-fixed −X always faces Tellus (the near side), and
`bodyOmega` is its mean motion.
- **A day lasts an orbit:** 104 h, so a 52 h night (about 6.5 Tellus days each way).
- **Its ground moves:** the equator at 5.9 m/s.
- **Speeds near an airless body's ground are now against the surface** (`speedRef` below 3 % of the radius; the navball
  says SURFACE).
- **Landings adjusted.** The procedure executor's landing and the crewed-lunar test script now null surface-relative
  velocity. Tests that drop a vessel start it at rest over the ground. The moonbase test takes a module's position from
  `fromPF`.
- **Selene's markings turn with it** in the sky shader (`uMrot`; detail in its own frame, `uMdet` rotated).

**The moons run on program time.** `ORB_T0`, the program time at the flight's t = 0, is added inside `bodyRel`:
- set at lift-off from `day0`, and for flights from orbit;
- a replayed autopilot tape keeps the `orbT0` it was recorded with (older tapes have none: 0, the old fixed start), so
  replays still meet Selene where they did;
- headless it stays 0 (`ORB_ABS` is false without a document), so every flown test is unchanged;
- the procedures' passage timing subtracts it.

This was a bodies-session matter; done here because R3 needs it. Selene's position on a given day is now the same in
every flight, and a lunar day's time of day carries across flights.

**Power** (`rvPowerStep`; between flights `rvFieldTick`, from `advanceDays`, half an hour at a time):
- New deck items: **Solar panels** (330 W at the sun overhead, 18 kg; output follows the sun's height over the deck,
  nothing once the sun is down) and an **RTG** (60 W steady, 35 kg).
- Draw: 30 W awake, 10 W asleep. On an airless body at night, a 25 W heater, unless an RTG keeps it warm.
- **A battery that runs flat in the night with no RTG: it froze**, and it is lost (a headline between flights).
- The designer's *Power and contact* box says whether the battery carries the heater through Selene's night.

**Contact** (`rvContact`; the relays come from `rvRelays`):
- On Tellus, always.
- Elsewhere, directly with the high-gain antenna (deck item) while Tellus is over the rover's horizon.
- Otherwise through a relay in sight: a lander in the flight, or a landed object of yours, with an antenna, that sees
  Tellus itself, within radio horizon √(2Rh₁)+√(2Rh₂) (rover 1.2 m with the high-gain, 0.8 m without). On Selene,
  about 2.4 km to a 4 m lander.
- A crew riding it needs none.
- **Commands arrive a light-time round trip late** (0.25 s from Tellus; `rvCommand`). Out of contact the rover holds
  still.
- The Program list shows the delay and the relay, or *out of contact*; it offers no Drive button without contact.
- The far side has no contact until a relay can orbit Selene: the registry keeps only Tellus orbits. That relay is the
  next thing for the orbital registry (sats/planning).

**Checks:** `test.mjs` §39, 6 checks:
- the lock (near side within 1e-6°, a 104 h day, the ground's speed);
- program time;
- power by day, freezing, the RTG;
- 40 days between flights with and without panels;
- contact (direct, far side, relay at 1 km against 6 km);
- commands (held out of contact; a round trip late in it).

The lock's knock-on changes are covered by the existing lunar-landing checks, which failed until the landings used the
surface.

**Not yet:**
- terrain shadows and horizons (Selene is still smooth: hills will block both sun and radio);
- ~~a relay in Selene orbit~~ (built: "The Selene relay" below);
- the clock running while you drive from home;
- eclipses by Tellus;
- Nyx's spin.

### The Selene relay built: orbits about a moon in the registry (sats session, 2026-10-08)

R3 left the far side without contact because the registry kept only Tellus orbits. Now a vessel left in orbit
around a moon stays on the register in that moon's frame, and one with an antenna relays for rovers.

**The registry** (`satRegister`, `orbBody`, `moonSats`):
- An orbit about a moon is kept with `q.bodyName`, and its `r`/`v` relative to that moon. `satAt` uses the moon's μ.
- It is accepted if its periapsis is at least 5 km up (`MOON_PE`: airless, and no relief yet) and its apoapsis is inside
  the SOI (`soiMin`).
- **`satsUp()` is still Tellus orbits only**, so none of its ~30 callers changed. Moon orbiters come from `moonSats(b)`.
- An orbiter whose only payload is an antenna is named *Relay N*.
- Flying it again (`vesselOf`) starts the flight around its moon.
- `stationTick` includes moon orbiters: a crew left in Selene orbit eats supplies.
- They show in the flight view (markers and meshes), on the map (orbit lines, labels), and under *In orbit around
  Selene* in the Program's Fleet tab.

**Between flights the tide moves them** (`moonOrbStep`, from `advanceDays`). The orbit is stepped with Tellus's tide
(`pertAcc`, RK4 at 1/120 of an orbit), on program time. The reason is a measurement. Two-body Kepler would keep any
orbit forever, but Tellus pumps the eccentricity of a high, steeply inclined orbit (Lidov–Kozai):

| Orbit (circular at the start; days are Tellus days of 8 h) | Fate |
|---|---|
| 1,000 km, in Selene's orbital plane | keeps its shape: 1,002–1,019 km after 45 days |
| 1,000 km, 60° | 941–1,054 km after 90 days |
| 1,500 km, 75° | meets the ground on day 79.5 |
| 2,000 km, polar | meets the ground on day 41.3 |
| 3,000 km, polar | leaves Selene's SOI on day 20.9 and orbits Tellus (it moves to Tellus's registry, with news) |

- **Hitting the ground is judged on the path, not on the osculating periapsis.** A first version called an orbit lost
  when its osculating periapsis dipped below the ground. On the 2,000 km polar orbit that happened 4 days early: the
  osculating value read −6 km on a pass that really cleared the ground. Now, on an inbound leg, the Kepler time to
  r = R is compared with the step.
- **Against a 5 s RK4 reference** that stops at real contact, every fate above agrees to within one step (e.g.
  41.25 vs 41.34 days). Positions: 0.36 km off after 21 days at 1,000 km, 3 km off at 100 km (along-track).
- **Cost:** 5 orbiters × 30 days took 56 ms.
- **Inside a flight they still ride Kepler from their last state.** Over 24 h of flight that is 18 km along-track at
  100 km and 320 km at 1,000 km. That's fine for markers and relays; it would matter for rendezvous (Not yet).

**Contact through an orbiting relay** (`rvContact`, `rvRelays`). The relay must be over the rover's horizon (1°), and
the line from it to Tellus must clear Selene. The delay is a round trip over rover → relay → Tellus. Registered
orbiters with an antenna count, and so does any vessel of the current flight in orbit around that body that carries
an antenna. The relays have no range or power limit yet.

For a rover at the centre of the far side, with one relay in Selene's orbital plane (3 orbits sampled):

| Relay height | Time in contact | Round trip |
|---|---|---|
| 100 km | 0 % (needs ≳ 145 km: it must see both the rover and, past the limb, Tellus) | — |
| 300 km | 13 % | ≤ 263 ms |
| 600 km | 26 % | ≤ 267 ms |
| 1,000 km | 35 % | ≤ 272 ms |
| 2,000 km | 46 % | ≤ 285 ms |
| 4,000 km | 45 % | ≤ 312 ms |

A single relay can't reach half the time: it has to be on the rover's side and past the limb as Tellus sees it. More
relays, phased, fill in the gaps. A far-side relay should also be equatorial; the high polar orbits are the ones the
tide brings down.

**Checks:** `test.mjs` §40, 3 checks:
- registration (frame, name, the two refusals, flown again around Selene);
- far-side contact (none alone, about a third via a 1,000 km relay, none at 100 km, the relay's extra leg in the delay,
  a vessel of the flight relaying);
- the tide over 45 days (the equatorial orbit holds, 2,000 km polar comes down, 3,000 km polar moves to Tellus).

Mutation-tested: each of 10 deliberate breaks fails at least one check. The breaks: no tide, no Selene occlusion, no
rover horizon, `satsUp` including moon orbits, the direct delay, no ground contact, no SOI exit, no SOI gate,
flight vessels not relaying, `vesselOf` on Tellus. Browser: two orbiters listed under *In orbit around Selene*; the
far-side rover's *Drive from home* button appears in its windows (268 ms via Lookout 1); flying one shows the other's
marker 2.7 km away; no console errors.

**Not yet:**
- ~~rendezvous and docking with a registered moon orbiter~~ (built: "Rendezvous with moon orbiters" below);
- cameras in Selene orbit (`satTick` is Tellus's);
- relay range and power;
- Nyx orbits work in code but are untested;
- **economy:** a contract for a far-side relay (or a relay network: share of the far side covered).

#### Rendezvous with moon orbiters (sats session, 2026-10-08)

A flight meets the registered orbiters of the body it is at. `orbitsAt(b)` gives `satsUp()` at Tellus and
`moonSats(b)` at a moon. Everything that was gated to Tellus goes through it:
- targets (`tgtOf`, target cycling);
- contact and capture (`contactStep`, `hitNear`: physics instead of rails near one);
- the arm's grab and loading (`nearbyFlyable`);
- collision debris and explosions, on that body.

`approach` takes the μ both orbit, and the closest-approach readout uses the flight's body. Undocking writes the entry
back in the frame it leaves in (`bodyName` follows `s.body`). A Tellus satellite can't be targeted from Selene's SOI,
and vice versa. Cross-SOI targeting would need patched-conic closest approach; not built.

**Checks:** `test.mjs` §41, 3 checks: §25's docking scene moved to a 100 km Selene orbit.
- **Target:** found; a constructed 300 m pass is found at 300.0 m and 1,000 s, the same as a 0.5 s scan; a Tellus
  satellite isn't a target.
- **Capture:** latches with momentum kept to 4e-27; rails held off; loadable.
- **Undocking:** a flyable entry leaves as a vessel of the flight around Selene, 0 m from where it was; at 1 m/s the
  ports bump.

Each of 7 deliberate breaks fails a check. The breaks: Tellus-only target, every orbit a target, Tellus μ in
`approach`, Tellus-only `hitNear`, contact and loading, undock dropping the body. Not checked in the browser: the
approach readout and target cycling (UI code; only the whole-page parse check covers them).

### R4 built, first slice: Selene's geology, a spectrometer, panoramas, a seismic network (sats session, 2026-10-08)

Scope decided with Caio: the geology, then three instruments, each hinging on something the sim computes. Results go
into the logbook (a new **On Selene** section) and *What we know*. No money: contract types are proposed below for the
economy session to price. The sample arm, drill, radar, magnetometer and polar ice come later.

**Geology is what's drawn** (`selMare`, `geoAt`). The sky shader darkens Selene's maria with
`smoothstep(.5,.65,fbm(n·1.6+3))` in Selene's own frame. The CPU's `h3`/`vn`/`fbm` are that same noise (the clouds'
port), and the shader's `MB()` is `toPF`. So the CPU's mask *is* the drawn one: the test recomputes it at 3,000 points
and they all agree.
- **Where the line is.** Mare starts where a patch has visibly darkened (`MARE_M` = 0.2, about 8 % darker). The first
  try used 0.5, the patches' dark cores, which left only 3.8 % of Selene as mare.
- **What it gives:** 9.7 % of Selene is mare. Its hidden composition varies smoothly within each unit: mare FeO ≈ 11 %
  on average, up to 16 %, with TiO₂ from 0.5 to 11.5 %; highland FeO ≈ 5 % and Al₂O₃ 25–30 %. The two mix across a
  patch's edge.
- **Visuals/bodies:** as drawn, the maria lie mostly at high northern latitudes on the far side, with a small patch near
  the sub-Tellus point. Only 1.2 % of the near side is mare, the reverse of our Moon (31 %). Moving them is an art
  decision; the geology follows whatever the shader draws.

**The instruments** are HUD buttons, greyed with the reason when they can't work (no instrument, not on Selene,
moving, out of action, no seismometers left). That's in both the remote-drive and in-flight HUDs. Each result waits in
the rover (`R.data`, kept in field entries) until there is contact, home or a relay; a crew's rover waits too. A rover
left in the field sends at the first half hour it has contact between flights (`rvFieldSci`).
- **Spectrometer** (`spec`): reads the rock under a stopped rover, once per 30 m. Each reading has noise: FeO ±1, TiO₂
  ±0.6, Al₂O₃ ±1.2 wt %. The logbook keeps each unit's mean, with FeO's standard error and the number of readings.
- **Panorama** (camera mast): its quality is the sun's height. Long shadows show the relief: 100 % from 3° to 20°. A
  high sun flattens it, down to 30 %. At night it refuses. Measured: 100 % at 15°, 45 % at 75°.
- **Seismometers** (`seis`): a pack sets out 4 stations, kept in `PROG.sel.seis`. Between flights (`seisTick`):
  - deep moonquakes, about 0.75 a day, 40–60 % of the way out;
  - each station records P and, unless its straight path crossed the liquid core, S;
  - stations send when they have contact.
  With 4 stations' P times home, `seisLocate` fits (x, y, z, t₀) by least squares, restarting from 26 directions. If
  the fit's σ is over 15 km, the array is too small to place the quake. A located quake brackets the core: an S that
  arrived passed outside it, a missing S went through. Each bound is loosened by 2σ.

**Measured** (60 days, 4 stations, about 45 quakes):

| Array (one station at the sub-Tellus point, 3 around it) | Located | Core bracket (truth 90 km, hidden) |
|---|---|---|
| 2 km apart | 0 | — |
| 30 km | 0 | — |
| 150 km | 9 (σ 7–15 km) | 0–159 km |
| 400 km | 45 (σ 2.5–8 km) | 78–98 km |
| 400 km on the far side, no relay | 0 (180 records waiting) | — |

Spacing is what makes the map, as the plan wanted. 30 days of the network costs ~30 ms.
- **First version's mistake:** without the 2σ margins, location errors crossed the bounds (90–89 km).

**Simplifications:**
- straight rays and uniform velocities (P 8 km/s, S 4.5 km/s);
- P crosses the core at mantle speed (only S is blocked);
- the scientists know the velocities;
- stations need no power.

**Checks:** `test.mjs` §42, 5 checks:
- the geology against the shader's mask;
- the spectrometer: a stopped rover, once a spot, counting only when sent, near-side highland FeO 4.7 % against 5.2 %;
- a far-side reading held without contact, then home through a relay between flights; entries keep it;
- panoramas by sun angle;
- the arrays: tight, far side without a relay, wide.

Each of 10 deliberate breaks fails a check. Not run in the browser: the HUD buttons and the *What we know* line. They
are UI code, and only the whole-page parse check covers them (TESTING row 117).

**Contracts proposed to economy** (not built; prices are yours):
- *Read the dark plains / the bright uplands*: N spectrometer readings of a unit, received.
- *A panorama of Selene* above a quality.
- *A seismic network on Selene*: 4 stations; then *locate N moonquakes*; then *bound the core* to a width.
- *Far-side science*: any result from the far side (needs a relay).

**Not yet:** the sample arm and sample return (rover to lander), drill or heat flow, ground-penetrating radar,
magnetometer, ice in shadowed polar craters (needs relief), seismometer power and lifetime, curved rays, and science on
Nyx.

## v1.18 — radial fins and make-root (2026-10-07)

First slice built in the `launchpad-builder` worktree (branch `builder`), merged to `main` when done.

**Radial fin** (`rfin`). It is one flat plate, the same plate as one of the fin ring's four (0.9 × 0.9 m, CN = 3.5·sinα·cosα +
1.2·sin²α). It is *surface-attached* (`surf`): it sits on the host's skin at the profile radius for that height (`profR`), and it
has no stack line, so nothing attaches to it and it never gets a radial decoupler. This is the cheap and honest version
of "tilted parts". The physics already modelled fins as flat plates, so a radial fin is just one plate at its own angle φ.
Its joint is radial, so the plate's normal force reaches the host as shear plus bending at the root (rated S 150 kN,
B 60 kN·m).

| What | Number |
|---|---|
| 4 radial fins on a 1.25 m body vs the ring's 4 plates (plates alone, M 0.6, 4°, 20 kPa) | force **99.4 %**, lever arm identical (1.750 m). The 0.6 % gap is the 1.2·sin²α term, which depends on plate orientation (45° off the ring's here). The linear term doesn't: Σ n nᵀ = 2I for any 4 orthogonal plates |
| Orbiter, ring swapped for radial fins at the tank's bottom: none / ×3 / ×4 | **−3.35 / 0.03 / 0.52** calibers (ring: 0.88; without the ring's 0.9 m body the plates sit closer to the CoM). Three plates give 1.5 I, not 2 I: 75 % of the restoring force |
| Orbiter ring + 4 radial fins on the tank (flown, SAS on) | 1.63 cal; 3.2 km at T+30 s, max AoA 0.27°, busiest fin root ≈ 1 % of its rating |

**Make root.** "make root" in a part's options re-hangs the design tree from that part, flipping each stack joint on the path
(`'u'` ↔ `'d'`); a joint's reinforcement moves with it. It is limited to stack paths: reversing a radial joint isn't exact,
because the side-by-side clearance formula is asymmetric, and a symmetric copy would have to become a single parent. The
point is picking things up: with the core engine as root, clicking the upper stage picks up Petrel + tank + pod + chute
in one go. The assembled vessel doesn't change at all (test §16: same joints, reinforcement and stages, compared by stage label
because segment *numbers* follow part creation order, which a re-root changes).

**Merging.** `main` had moved: the orbital registry, which added a camera and an antenna. One conflict, the price table line next
to `PRICE.rfin`. It also exposed a palette bug: categories were a fixed list of kinds, so the two new parts didn't show.
The palette now puts any unclaimed kind under "Other". `test.mjs` 90/90 after the merge.

**Headless builder.** `builder.js` loads into the same `new Function` sandbox as the sim core: it touches no DOM until `init()`.
So tree operations like `reroot` are tested directly.

## v1.17 — the construction screen: free placement, radial on anything (2026-10-07)

Built in a session running in parallel with the economy work (v1.13–v1.16), so the UI lives in its own file,
[`builder.js`](builder.js). That kept the two sessions' hunks apart in `index.html`. It can be folded back into
the single file once nobody else is editing it.

**What you do.** Pick a part from the palette (now grouped: command, tanks, engines, structure, aero) and it follows
the cursor as a ghost:
- **Stack nodes**: every free top or bottom node glows. Near one (34 px), the ghost snaps its bottom onto a top node, or its top under a bottom node.
- **Surface**: otherwise it attaches **radially** to whatever the cursor is over, at that height and angle. Symmetry is ×1/2/3/4/6/8 [X], snapped to 15°, and the
  line's ends are pulled onto the host's part boundaries within 0.35 m [C]. Radial decoupler on/off [R].
- **Validity**: the ghost is green when it fits and red (`blocked`) when any copy would overlap a part.
- **Picking up**: click a placed part to pick it up with everything hanging from it, all symmetric copies included. Ctrl-click takes a copy, Shift-click places one and keeps holding.
- **Options**: right-click a part for joint load and reinforcement, crossfeed, copies, decoupler, ±0.1 m and ±15° nudges, pick up / copy / delete.
- **Overlay**: joint loads are drawn on the rocket itself, replacing the strips between list rows.
- **Editing**: undo/redo. In the editor the ship hangs 3 m above the pad, as in a VAB, so parts can go under its bottom. The camera no longer auto-spins; Shift+wheel or middle-drag moves the view up and down.

**Design format v2: a tree** (`toV2`, `layoutDesign`, `assemble` in the SIM block). A node is `{k, at, j, x, c}`.
`at` is `'u'` (on the parent's top), `'d'` (under its bottom), or radial `{y, a, n, cy, dec, x}`. Parts never tilt, so a
radial child starts a new vertical stack line at distance (widest host-line radius over the child's extent) + 0.25 m +
(child line radius). The physics already flies exactly that: stack lines for aero, joint frames for loads. So
nothing in flight changed. Symmetric copies replicate the whole subtree, and nested radials are measured in their
host's rotated frame, so boosters on boosters come out symmetric. The old `{stack, rad}` format converts losslessly.
Presets stay in it, and so does any unedited design, so saved autopilot tapes keep matching.

**Staging generalised.** Segments now form a tree: a segment's parent holds its decoupler. The *chain* runs from the
root's segment down through the stack decouplers below it. Everything else hangs off a chain segment, burns with
it, and drops before it does: deepest first, then highest first. For the old designs this reproduces the old rule
exactly. For nested boosters it gives *side tanks → boosters → core*.

### Measurements
| What | Number |
|---|---|
| All 8 presets, new `assemble` vs old | **byte-identical** fingerprint: parts order, positions, parents, joint axes/points, reinforcement, segments, events, labels, Δv |
| 3 boosters × 2 nested side tanks, no crossfeed → crossfeed | 4 593 → **6 215 m/s**. The engineless side tanks are dead weight until they crossfeed |
| Same design flown straight up for 80 s | side tanks drop at T+23.9 s, boosters at 71.6 s, 58.5 km, worst joint 21 % |
| Single ×1 radial Tank 1 t on a Tank 4 t | assembles, CoM 0.21 m off the axis |
| `test.mjs` | 81 checks, all passing (6 new in §15) |

### What went wrong on the way
- **A dropped line that only one test could see.** The rewrite lost the reinforcement-mass line (`jm`). The preset
  fingerprint can't catch that, because no preset reinforces a joint. The v1.5 test "reinforcing the joint that snapped" caught it (+0 kg
  instead of +60 kg). Fingerprint *and* behavioural tests: each covered the other's blind spot.
- **Test heuristic vs geometry.** "Nearest booster = host" was wrong for a nested tank that sits 1.49998 m from a
  neighbouring booster against 1.5 m from its own. The test now reads the host from the joint tree.
- **Line endings.** `index.html` and `test.mjs` are CRLF in the working tree (`core.autocrlf=true`). A splice that
  wrote LF lines, and a `sed -i` that silently converted a whole file to LF, both had to be repaired. Edit through
  something that keeps the file's own line endings.

**Not done:** parts that tilt, so no radial fins or angled engines; that needs a per-part orientation in aero and loads. Re-rooting
(picking up the root). Drag-to-reorder staging. Aero interference between side-by-side lines is still not modelled.
The crossfeed note in flight says "side empty" for side-tank groups, which is the label's first word.

## v1.16 — ownership: what the program is (2026-10-07)

Slice 5. The program is a set of shares that sum to 1: state stakes by power (`own().st`) plus private capital
(`own().pv`). Its label follows the shares (national agency / agency, part-privatized / consortium / company with a
state stake / private company).

- **Starting points,** chosen in the Program panel before the first flight (older saves default to a national agency):
  - *national agency*: home 100%, 60M;
  - *private company*: private 100%, 90M of investor capital;
  - *transnational consortium*: home 40% plus its two friendliest powers at 30% each, 60M.
- **Everything scales with the shares,** so mixed programs sit in between:
  - Budget day comes from every state shareholder, by stake × that power's opinion of us × √(its economy relative to
    home). A consortium gets contributions itemised in the news; private capital pays nothing.
  - Government offers come from the state shareholders, at a rate of 0.3 + 1.2 × total state share.
  - Commercial offers (×0.8 + 0.6 × private share) and commercial pay (+15% × private share).
  - Working for a power hostile to home costs home opinion only in proportion to home's stake.
- **Below the floor:**
  - A mostly-state program is topped up by its biggest shareholder (opinion −2). From the third top-up on, it takes 10%
    of any private stake: the safety net is the road to nationalization.
  - A mostly-private program gets a *rescue* decision instead: either the friendliest power puts in what's needed + 30M
    for 30%, or investors lend what's needed, repaid ×1.3 from half of all future income.
- **Between-flight decisions,** which expire if ignored:
  - *Privatization:* investors offer 25% of the valuation for a 25% stake, to programs at least 40% state with two firsts
    done. Home opinion rises or falls with home's economic alignment.
  - *Foreign stake:* a friendly power offers 15% of the valuation for 15%. Their budget share and contracts come with it;
    their rivals' opinion drops and home's dips.
  - Valuation = 80M + 40M per first + 6M per contract.
- `test.mjs`: 6 new checks (75). UI lives in the program-UI section (`ownershipHTML`); the builder session's editor code
  is untouched.

Not yet: career moves (defection, private hire) and power flavours are in the backlog; slice 6 (tourism, military,
sanctions, races) is next in the build order.

## v1.15 — the contract board (2026-10-07)

Slice 4. Firsts (`MISSIONS`) stay one-time; **contracts** are repeatable and generated, so they never run out.

- **Sources:** science and commercial clients can be any power (weighted by economy); government contracts come from
  home. Seven types, parameterised by a seeded RNG:
  - sounding experiment (apex band, recovered);
  - air sample (a given band, recovered);
  - part qualification (fly part K through max-q ≥ X kPa, instrumented);
  - recovery demonstration (land within N km of the pad after passing 20 km);
  - biology flight (biocapsule to space under a tighter g limit);
  - satellite (periapsis/apoapsis window and inclination window, plus up to 30% for precision);
  - mass to orbit.
  The last three unlock with the matching firsts (hop, beeper, Heavy lift I).
- **Overlap:** every accepted contract is checked against every flight's record, so one flight can complete several (a
  check flies a sounding rocket that completes two contracts plus a first). **Capacity:** 2 at once, +1 per 3 contracts
  done, up to 6.
- **Offers** arrive over program time per source (science fastest, government slowest), scaled by our *standing* with
  that source, and expire after 50 days. The board holds at most 6. Accepting a contract from a power hostile to home
  costs home opinion ("Opposition asks why…"). A missed deadline costs 10 standing and the client's opinion.
- **Business cycle:** a slow oscillation (~700 days) with noise. Commercial pay ±35% and commercial offer rate ±50%; it
  also shades the budget. Headlines at boom and recession.
- **Budget day** every 100 days: 12M × (home opinion / 50) × (1 ± 25% cycle). The national-agency income, before
  ownership exists.
- **Records:** cheapest net trip to orbit (cost minus refurbishment), announced when beaten.
- **UI:** contracts and offers (Take / Pass) at the top of the Program panel, in their own program-UI section, so the
  builder session's editor code is untouched; a HUD row lists contracts done this flight and the ones still open.

`test.mjs`: 7 new checks (69).

Next in the build order: ownership (starting choice, the national-agency path, privatization, bailout-for-equity). Then
tourism, military, sanctions and races. Career moves and power flavours are in the backlog.

## v1.14 — M units, stress refurbishment, the calendar, the powers (2026-10-07)

Slices 1–3 of the economy build order (see "Overlap, powers and what the program is" below).

- **Money in M** (relabelled from k, same numbers): Sounding 15M, Orbiter 50M, Heavy 90M.
- **Refurbishment pegged to stress.** Every physics step keeps each part's peak load against its *true* rating (both
  sides of each joint) and its peak T/Tmax; landing records the touchdown speed. Value kept = (1 − 0.7·load
  fatigue above 50%) × (1 − 0.7·heat above 50%) × (touchdown: full up to 6 m/s, down to 40% at 12 m/s). The refund
  headline names the worst-off part ("came back as scrap"). Cost: two comparisons per part per step, well below the
  timing noise.
- **The program calendar,** in Tellus days (6 h, one turn), 400-day years. Stacking takes 2 + cost/8 days (Sounding
  3.9, Orbiter 8.2, Heavy 13), and the flight adds its own duration. Each advance ticks the world.
- **Powers as data:** `makePowers(seed, n)`, any n (default 5; checked for 2, 3, 5 and 8). Each has a generated name
  (government forms not repeated), a home region, economy size, tech and a 2-D alignment. Power 0's home is the launch
  site. Land goes to the nearest home region, weighted by economy (a power diagram); **the sea is no one's**. Cities take
  their power, and the map draws city names in its colour.
- **Relations** for every pair drift toward what the alignments suggest (150-day time constant) with noise, plus
  occasional crises (likelier when relations are already poor) and treaties, all in the news. Deterministic from a
  seed kept in the save. **Opinion of the program** per power: missions raise it (most at home); a harmed passenger
  or a town hit at home lowers it; memory fades toward neutral.
- **Incidents:** a stage landing on another power's land costs that power's opinion and the home–power relation (×3
  on a town) and 1.5× damages, with a headline. At home it's a local matter (opinion only).

Seen in the first generated world: the home power is small (2 cities) next to bigger neighbours (5–7). Over a simulated
year, two pairs drifted to hostile (about −0.7) and one became allied; after halving the crisis rate, none pins at
−1 any more. `test.mjs`: 6 new checks (62).

Not yet: none of this pays or blocks anything beyond incidents. Contracts tied to powers, opinion-driven grants and
the business cycle are slice 4.

## v1.13 — the budget (2026-10-07)

Money in thousands of credits ("k"), all in the SIM core (`PRICE`, `vesselCost`, settled in `missionTick` and `missionEnd`):
- **Launches are paid for:** parts (engines and pods dear, tanks and structure cheap; reinforcement adds by joint size)
  plus fuel at full tanks (0.2k/t, so fuel is a rounding error, as in reality). Charged at liftoff.
- **Refurbishment:** whatever is still attached and landed intact on Tellus when the flight ends returns 80% of its dry
  price. A recovered Sounding flight nets 3.2k of 15.2k; a dropped stage is gone. Reuse and recovery pay.
- **Missions pay** on completion, 15k to 100k (420k across both epochs), shown in the Program panel.
- **Damages:** a dropped stage that lands in a town costs 40k, near one 8k.
- **Floor:** below 25k after a flight, the government tops the program up (with a headline, counted in the panel). There
  are no dead ends, but the floor only covers cheap flights (Sounding 15.2k, Passenger 21.4k).
- **Gate:** the builder shows cost, funds and the refundable share. The button reads OVER BUDGET and won't launch
  what you can't afford.

Starting funds 60k buy one Orbiter attempt (49.8k). Heavy (90k), Asparagus (128k) and Big Lunar (115k) have to be
earned. Saved v1.12 programs get 60k on load. `test.mjs`: 2 new checks (56).

Not yet: recurring income. That waits for the world clock (satellite services paying per day).

## v1.12 — the program, first slice: Epochs 1–2 (2026-10-07)

Built from the mission design below. Everything mission-side lives in the SIM core and is tested headlessly
(`test.mjs` §14, 10 new checks, 54 total).

- **Parts:** *Instrument package* (telemetry plus air samples), *Biocapsule* (a passenger with limits: 8 g averaged over 1 s, a
  330 K cabin that lags the skin by ~10 min, 4 h of air), *Mass simulator 0.5 t*, and the **Sparrow** sounding engine
  (60 kN, 0.3 t). Presets: *Sounding*, *Passenger*.
- **Nine missions** in two epochs. They read a flight record that `advPhys`/`advRails` tick, and they never write to the
  flight, so tapes still replay bit-identically. Prerequisites gate them. Progress is saved in browser storage
  (`launchpad-program-v1`); the Program panel in the builder lists missions and "What we know", with a reset.
- **Certified ratings.** The physics keeps the true rating. The builder and HUD show joint loads against a *certified*
  rating that starts at 70% of true. Each flight with an instrument package shrinks the 30% reserve by up to half,
  in proportion to how hard each part was loaded (40% of its rating counts fully). A failure certifies the broken
  part at 100%.
- **Atmosphere knowledge.** Each 10 km band carries ±25% density uncertainty until a recovered package has sampled
  it. The impact predictor flies two extra predictions (air thinner and thicker in the unknown bands) once a second
  (0.6 ms each). The HUD shows "± km", the map marks both ends, and range safety checks the whole spread.

**What the first flights taught (each was a real bug or a real design lesson):**
- **The Kestrel is the wrong sounding engine.** It empties a 1 t tank in 12 s, and its 1.3 t at the tail makes the empty
  hull unstable (−0.30 cal); with no pod for torque it tumbles and drag kills the climb (5.8 km apex). Hence the Sparrow.
- **My first certification rule certified nothing.** "Certified up to the worst load survived" needs flights that load
  parts past 70% of their rating, which no sane flight does. The reserve-shrinking model rewards every instrumented
  flight and rewards hard ones more.
- **Supersonic drogue: 17 g.** The drogue opened at 20 km whatever the speed, so a hop deployed it at Mach 3. Now it waits
  for 400 m/s (~Mach 1.3).
- **Chute opening shock: 18 g.** With the old instant opening, the main came out at 250 m/s. Real canopies are *reefed*, so
  now the open area is capped so the chute's own drag stays ≤ 3 g (`CHUTE_G`), and the predictor uses the same cap.
  Landing speeds are unchanged.
- **A capsule hung at 500 K under its chute.** The thermal model only radiated. Convective cooling now applies once the skin
  is hotter than the flow's recovery temperature (h ≈ 12·√(ρv)), so peak re-entry heating is unchanged.
- **The parachute was the vessel.** Without a pod, the root of the part tree was the top part, so a burnt chute "lost the
  vessel". `rootIdx`: pod, else biocapsule, else instruments, else top.
- **Design lessons the sim now teaches by itself:**
  - A Kestrel-powered hop crushes the passenger (8.1 g).
  - Keeping the spent booster on overheats the cabin, since 1.3 t falls fast and hot.
  - Dropping the booster at burnout: 98 km, 7.1 g, cabin 283 K, home safe.
  - From orbital speed, a bare capsule tumbles and cooks its passenger; held shield-first by a pod on SAS retrograde,
    it lands at 4.3 g with a 269 K cabin.
- **Balance:** the starter Sounding rocket (1 t tank) reaches 14 km, enough for *Above the weather*. *Measure the air* needs
  the 2 t version (99 km). The 25 kPa structural test needs a punchy Kestrel build (66–78 kPa). One preset flight no
  longer clears the epoch.

**Physics changes** (drogue gate, reefing, convection): `TAPE_V` → `lp-1.12`, so autopilot tapes saved by older versions
no longer offer to replay. The pod impact-prediction check is relaxed from 3 to 5 km: with no supersonic drogue, more
of the descent is fast, which is where the unmodelled trim lift accumulates.

**Open:** flight safety rarely blocks a preset (builder max-q case 10–57% certified), so certification bites mainly on
designs trimmed for mass. Missions give no reward beyond progress and headlines yet (no budget). The beeper's
city-pass headlines are a first taste of "the world listens".

## Parts and mission types — planning (2026-10-07, brainstorm with Caio; nothing built)

**Through-line:** every part or mission hinges on something the sim computes (orbits, sun angle, line of sight, loads,
heat, drag, mass). That keeps even the sci-fi end grounded. **Tone:** physics serious, world wry. Consequences arrive
as headlines and politics, never body counts; a little more serious than KSP.

**Science instruments.** Each wants a different flight:
- air sampler (exists): pass through bands, be recovered;
- camera: nadir pointing, daylight, no cloud, resolution ∝ 1/altitude; for maps, crops, weather, recon, disasters;
- radar: heavy and power-hungry, but works at night and through cloud;
- radiation counter: discovers the radiation belts, which then set crew dose limits;
- magnetometer: on a boom, needs latitude coverage (inclination); the field model explains the belts;
- telescope: pointing stability, away from the sun; for discoveries (second moon, asteroids, visitors);
- seismometer: soft landing on Selene, upright; several make an interior map, so it's a multi-lander campaign;
- gravity-mapping pair: two satellites in formation (GRACE-like);
- spectrometer: asteroid composition, i.e. mining targets.

Data comes home either by transmitting (antenna + power + line of sight to a ground station owned by some power) or
physically: film canisters caught mid-air by a plane (a Corona nod). Support parts: antennas, solar panels, batteries
(eclipses from the existing sun direction), reaction wheels, booms, fairings.

**Space stations:**
- **Assembly in orbit gets past what you can't launch:** a truss that would snap at max-q is fine assembled in orbit.
  That's a direct use of the structural sim.
- **Modules with jobs:** habitat (crew capacity), lab (science per crew-day), power truss, docking hub, fuel depot
  (cheaper Selene missions), construction yard (assembles big vehicles), later a hotel.
- **A growing station is still one rigid body.** Reboost burns load long trusses, docking shocks propagate, and
  attitude control has to grow with the mass. Expansion is a structural design problem.
- **Upkeep becomes repeatable contracts generated from the station's state:** orbital decay → reboost; resupply; crew
  rotation.

**Military, kept light; weapons are mostly political objects:**
- **Spy satellites and visibility.** Lower is sharper but decays faster; targets need daylight and clear skies; you plan
  the ground track. Real physics: **a satellite is visible from the ground when it's sunlit and the observer is in
  darkness** (dawn and dusk), so rivals see your passes and the news notices. Passing in Tellus's shadow is stealthy but
  blind.
- **Early-warning satellites** (high orbits) see launches, so rival launches become news you've earned.
- **Satellite hacking (Caio):** pull up alongside a rival's satellite at night and work undetected. Stealth rules: do
  the approach and the work in Tellus's shadow; inside a set distance, burns must stay minimal, since a visible plume
  or a big Δv gets you spotted. It works only *before the rival has radar*, which makes it a tech-era window: the same
  approach that is invisible to optical tracking is caught once radar exists. A precision-rendezvous minigame with
  political stakes (caught means an incident, sanctions, lost contracts).
- **Anti-satellite weapons** = rendezvous with a high closing speed. The consequence is **debris**: a lasting field that
  threatens everyone's satellites, yours included, and costs opinion with every power (Kessler as world state).
- **Lasers:** grounded first (power- and range-limited, dazzling sensors rather than destroying). More sci-fi with
  nuclear power later.
- **Tungsten rods:** de-orbit a dense rod; the impact predictor already models it. **Accuracy depends on your own
  atmosphere science** (the ±25% band uncertainty is your error). Used as tests on empty ranges, treaty politics
  (Outer Space Treaty-style bans that cost you to break), deterrence and arms races. Never cities.

**Asteroids:**
- **Start near home:** small objects temporarily captured into Tellus orbit (mini-moons), found by the telescope and
  reachable with today's physics, before the interplanetary layer exists.
- **Mining:** new resources (ore, water turned into propellant at a cost in power). Refuelling away from home changes
  mission design.
- **Moving one is a momentum budget:** asteroid mass × Δv against thrust × time. That brings ion engines and low-thrust
  propagation on rails.
- **Planetary defence as a world event:** a rock on a collision course with N days of warning; the impact ellipse
  (already built for rockets) shrinks as tracking improves; earlier action needs less Δv. Kinetic impactor (DART), gravity
  tractor, or mining it (which pushes it as a side effect). Do the powers cooperate? Who pays? Wry headlines if it hits.
  Redirecting asteroids on purpose is the sci-fi weapon end, and politically radioactive.

**Alien life and public relations (Caio):**
- **Life research:** mostly microscopic traces (chemistry in Selene samples, ambiguous biosignatures from a telescope,
  later microbes on another world). Each result has a *real* confidence level that more missions raise or collapse.
- **PR as a direct dynamic:** how the program *presents* a result is a choice. A **dry scientific tone** builds scientific
  standing slowly and safely. **Leaning into the little-green-men hype** brings a burst of opinion, funding and tourism
  interest now, but costs **credibility** if the result is later overturned. Credibility then discounts the hype on the
  *next* announcement, so the boy who cried alien gets less of a bump. Science clients care about credibility; the
  public and politicians care about excitement. Fits the tone: a press-conference choice with wry headlines either way.
- This generalises: PR choices on failures (own it or spin it), on passenger flights, on military work (deny or
  disclose).

**Infrastructure this all needs** (in order of what it unlocks):
1. **Persistent objects on rails across program time**: satellites that keep serving, stations, debris, rivals'
   hardware, asteroids. The keystone, and cheap, since Kepler rails are exact.
2. **Several vessels in physics at once:** rendezvous, docking, anti-satellite intercepts, formations, hacking.
3. **Cheap geometry:** sun and shadow, line of sight, ground stations, who can see what; plus a CPU cloud map (a port of
   the shader's clouds, the way the land mask was ported).
4. **Power:** solar panels, batteries, eclipses.
5. **Low-thrust propagation,** then the star-centred system for real asteroids and interplanetary travel.

**A first slice that tests the idea:** persistent satellites + camera + antenna. Imaging contracts (weather, crops,
disasters, recon) with daylight, cloud and ground-track planning: the first time the world reacts to things that *stay
up*.

## Mission design — epochs, archetypes, convergence (2026-10-07)

**Method (Caio):** iterate between levels (mission types, long arcs, craft parts) and home in on where they become
coherent with each other. Variety is what makes it replayable.

**The lens: missions are questions the world needs answered.** A good mission (1) tests something the sim already
models (loads, g, heating, drop zones, phasing), so it's a design problem and not just "go to X"; (2) leaves something
behind: a working satellite, data, a qualified part, or a discovery; (3) changes what comes next.

**Epochs, with representative missions:**
1. *Sounding rockets.* **Above the weather:** an instrument package past the cloud deck, recovered under a chute.
   **Measure the air:** each recovered sample of an altitude band shrinks the impact predictor's uncertainty, so your own
   science makes your tools better. **Range certification:** three flights in a row with every spent stage landing clear,
   needed before bigger rockets fly near cities.
2. *First orbit, animals aboard (a nod to Laika).* **The beeper:** reach a stable orbit; cities hear it pass overhead.
   **Passenger:** an animal on a suborbital hop, then an orbit and back. Peak g, cabin heat and recovery are the
   constraints, all already simulated. **Heavy lift benchmarks:** 500 kg, 2 t, 5 t to orbit (records; a rival would make
   them races).
3. *Utility.* **Weather satellite:** clouds are real data in the world, and coverage wants a polar orbit, so inclination
   becomes a design driver from an equatorial pad. **TV for the capital:** stationary orbit at about 2,870 km, which needs
   a transfer, an upper-stage restart and an antenna; it pays while it works. **Disaster watch:** a flood in the ticker,
   an imaging pass within 12 h (phasing with maneuver nodes). **Navigation constellation.**
4. *Crew and Selene.* **Abort tests** (pad, then max-q) qualify an escape tower before crew fly, which is testing that
   makes sense. **Rendezvous and docking.** **The Selene ladder:** flyby (far-side photos), impactor, soft lander,
   sample return, crew.
5. *Big projects.* **Space telescope:** a fragile payload with acceleration and vibration limits across the whole
   flight. **Station:** assembled over flights, then a fuel depot that makes later missions cheaper. **Discovery:** the
   telescope finds the second, eccentric moon, so your own instrument opens the next chapter.
6. *Interplanetary (long term, Caio 2026-10-07).* Other planets around the star, like KSP, and **intercepting extrasolar
   objects passing through** (an 'Oumuamua-style visitor on a hyperbolic path): spotted by the telescope, with a closing
   window to launch an interceptor. That's a one-off event, so every playthrough gets different ones.

**Archetypes (variety):** benchmark (records, rival timing) · qualification (fly a part through a target envelope) ·
service contract (target orbits, client cities) · event (disaster, visitor; when and where vary) · science/discovery
(what you look at first).

**Convergence:**
1. **Uncertainty your own missions reduce:** part ratings, the atmosphere model, what's out there. Progression comes
   from knowing more, not from a points shop.
2. **Payloads stay in the world:** visible in the ticker and over the cities.
3. **The constraints we already simulate** (g, loads, heating, drop zones) make each mission a design problem. That's
   our edge over KSP.

**Parts implied:** instrument package, animal capsule (g limit plus a short air supply; a small slice, not full life
support), mass simulator, escape tower, fairing, antenna (line of sight to ground stations), solar panel and battery,
restartable upper stage, docking port.

**Economy and mission sources (Caio, 2026-10-07):**
- **No global cap on missions.** *Firsts* are one-time milestones; *contracts* are repeatable and generated with variation
  (target bands, orbits, masses, limits), like KSP rescues from different orbits. No grinding is required, but replaying
  pays. The budget makes doing the same mission more efficiently worth it (profit = pay − cost + refurbishment), plus
  records and precision bonuses.
- **Money in M** (relabel k → M; Orbiter ≈ 50M, near real small launchers).
- **Refurbishment pegged to stress:** each part's peak load fraction, peak T/Tmax and touchdown speed set its refund.
  It's cheap: the structural and thermal passes already compute these every step, so it's one max per part per step.
  Later, inventory: reused parts carry their fatigue between flights.
- **Mission sources / tracks:** pure science, commercial/industrial, tourism, government/transnational agency,
  military. Each has its own contract shapes and its own standing with the program.
- **A roughly simulated economy:** public opinion feeds grants and government contracts; a business cycle (lean times)
  moves commercial demand and budgets. Light-touch scalars updated per program day, not an econ sim.
- **Competing powers (bigger, later):** geopolitical tension; working for one side can bring sanctions or the loss of the
  other's government contracts when competition is intense; a space race for firsts. Mostly a balancing problem; it
  makes the money and prestige layer interesting.
- **The backbone this needs: a program calendar.** Today `simT` restarts at 0 every flight. Satellites earning per day,
  opinion drifting, cycles and tension all need dates: launch prep time per vehicle, flight time advancing the
  calendar, the world ticking between flights.

**Overlap, powers and what the program is (Caio, 2026-10-07):**
- **Overlapping contracts:** one well-planned flight can satisfy several. They come almost free, since every mission reads
  the same flight record. The limit worth having is a *program capacity* (how many contracts you can hold at once) that
  grows with the program.
- **Multipolar powers, unparked:** N powers generated from a seed (the number is flexible), each with economy size, tech
  level, an alignment on a couple of axes, and a relation with every other power that drifts. **Cities belong to powers,
  so the map has territory:** a stage landing in another power's land is a diplomatic incident, and overflight
  matters. Tension drives sanctions, export controls, embargoes and races for firsts.
- **What the program is: an ownership mix, not a type.** State shares (from which power or powers) versus private
  capital. Starting points: *national agency* (a legislature funds it; opinion and firsts matter; rival contracts are off
  limits; cautious), *private company* (investors want results; contracts from anyone, subject to sanctions and export
  controls; no safety net), *transnational consortium* (several powers, neutral, politics over priorities). The mix moves
  through decisions with trade-offs: **privatization** (cash now, lose grants, gain freedom); **bailouts with strings**
  (the floor top-up becomes a state stake or board seat, so the safety net is the road to nationalization); a
  **commercial spin-off**; **military work** pulling you toward one power and away from others.
- **Guardrails:** flying stays the centre. The economy creates missions worth flying and occasional between-flight offers
  in the game's lighter tone, never menus to manage. Keep the numbers few and legible: a player should be able to say
  why an offer appeared.
- **Build order:**
  1. M units and stress refurbishment.
  2. The program calendar.
  3. Powers as data: territory, relations and tension, incidents.
  4. The contract board: overlap, capacity, sources tied to powers, opinion, business cycle.
  5. Ownership: starting choice, the national-agency path, then privatization and bailout-for-equity.
  6. Tourism, military, sanctions, races.

**Backlog ideas (Caio, 2026-10-07):**
- **Career moves when things go badly** (a more common condition than "win"): besides bailout or buyout, the program's
  people can be **poached by another power** (a political defection, with a big reputation hit at home) or **hired by a
  private company**, with some carryover from the original program (knowledge, certified parts, reputation in some
  form). That's either a step up in the player's career or a hail mary. It fits the ownership-mix model: a defection is
  a jump to another power's program; a private hire is a jump to the private-capital end.
- **Powers with flavours:** different powers play differently. Superpower programs alongside more marginal ones (think
  of the range from the US and USSR to China, Brazil, South Africa, an Arab state). Flavours constrain a power to
  previously designed archetypes, so features and details are TBD. Today powers are generic generated data.

**Power flavours (design with Caio, 2026-10-07).** A flavour is a setting on a few **axes**, each wired to an existing
system; named **archetypes** are presets on those axes, so any number of powers can be generated and mixed. The test
for an axis: it changes what you fly or what you decide, not just a number.
- *Who you answer to* (open ↔ closed): open means failures are public and elections swing the budget; closed means
  failures are hushed up (but leaks come later, worse), successes are trumpeted, and the leadership demands
  spectaculars by a date.
- *Money:* taxes (steady, by opinion), commodity (a resource price cycle of its own: lavish booms, brutal busts),
  patronage (small budget days, lump sums for prestige), military (grows with tension).
- *Priorities* (prestige / security / commerce / science): which contracts this power offers and how much it pays, how
  hard it races, and what a first is worth.
- *Nationalism,* a **mood, not a setting:** each archetype starts at a level, it rises with tension and crises and
  fades in calm years. It multiplies the domestic reaction to everything foreign: stakes, foreign clients, hires,
  defections, the race. Not redundant with openness (who you answer to) or priorities (what they want): it's how they
  feel about foreigners, and it moves.
- Later axes: *industrial independence* (import markups; sanctions cutting off parts; a young industry's parts start
  less certified) and *geography* (inland ranges drop stages at home; latitude), the latter with the terrain work.
- Archetypes: open superpower, closed superpower, rising power (budget grows, long plans), frugal middle power
  (commerce, records, partnerships), resource state (commodity money, buys teams and stakes), security state (military
  money, sanctions-prone, a regime change can cancel the program, which turns into a career move).
- **Asymmetry is wanted** (Caio). Countermeasure for the secrecy shield: hidden failures still cost some standing at
  once, and the leak risk grows with each one.
- **Start:** both. Pick your power's archetype, or play a random world where the launch site's power has whatever it
  was generated with.
- Each power shows its flavour in one line (home in full, rivals as a tag).

**Backlog — visual flavours (Caio, 2026-10-07; for the visuals session):** ship and environment design flavour per
power. Can't be sliders, so a handful of **style presets plus livery** (paint scheme, markings, pad and building
style) would give visible variety that reflects each power's flavour.

**Spending money: development, investments, flagships (design with Caio, 2026-10-07).** The balance pass (v1.28) showed
strong programs ending year 3 with ~1,000M and nothing to spend it on. The fix is things worth buying, not more
pressure.
- **No tech tree of unlocks.** Parts can already be bought abroad, so locking them behind research would be
  inconsistent. Instead, what a program owns is **its own designs and how well it knows them**.
- **Engineering history per part:** every part type accumulates a record across your flights (loads survived, burn
  time at sea level and in vacuum, re-entry heating, restarts). Certification is already a first case of this.
- **Development projects:** a part + a goal (thrust or Isp, mass, cost, reliability) costs **money and time** and
  requires **that part's own history** (you can't build a better Kestrel without having flown Kestrels hard). Stress
  tests on a test stand can supply some of that data for money instead of flights. The result starts less certified
  (a new design has to be re-qualified): better on paper, untrusted until flown. That's the drama.
- **Engineering data ≠ the logbook.** Engineering data lives on parts and is about *your hardware* (feeds development
  and certification). The planning session's logbook is about *the world* (facts discovered, used to plan missions).
  Both come from flying, but they answer different questions; atmosphere knowledge belongs on the logbook side. They
  might share plumbing if it serves both purposes; not decided.
- **Sinks without upkeep misery** (Caio: upkeep as the main sink makes for miserable play). Running costs stay small
  and steady. The main sinks are **chosen investments that last**:
  1. development projects;
  2. capital construction, one-off with little or no upkeep: integration halls (faster stacking, bigger vehicles,
     parallel campaigns), a recovery fleet (stages recovered at sea), test stands (ground certification, stress
     data), production lines (domestic tiers), pads at launch sites (with terrain);
  3. flagship projects (stations, telescope, a lunar program): mission content with the planning session, with economy
     pricing them and paying for them over time;
  4. payloads that cost more as ambitions grow.
- **Open — buying abroad vs developing at home** (Caio: development sits uncomfortably with buying parts abroad;
  solvable, needs more thought). Directions:
  - **Part quality you can tell:** suppliers' parts differ in quality (reliability, tolerances, performance spread). It
    starts hidden and is revealed by your own engineering data, so data matters even for imports: you learn whose
    Kestrels are good.
  - **Domestic production and vertical integration get cheaper:** once you build a tier yourself, and more so as you
    integrate the chain, parts cost less than imports, repaying the setup cost.
  - Together these let both paths coexist: imports are quick and proven (of known or unknown quality); home production
    is slower to set up, cheaper in the long run, and developable.
  - Earlier idea, not adopted: development only for parts you build. Kept as an option.
- **Open — variants vs upgrades in place:** does development produce a new part next to the old one (a "Kestrel B" in
  the palette), or improve the part itself (with fresh certification)? On hold. It touches the builder's palette and the
  planning session's parts.
- **The whole parts system, assessed (2026-10-07).** Per part, the program faces seven questions, each a mechanic:
  - *Can we get it?* — the market (built: industrial independence).
  - *Is this batch any good?* — supplier quality, hidden until our data reveals it.
  - *Can we use it well?* — **know-how**.
  - *Do we know its limits?* — certification (built).
  - *Can we make it?* — a production line plus a learning curve.
  - *Can we change it?* — development.
  - *Where is the world?* — a world technology frontier, with experimental parts beyond it (Caio: there is a tech tree
    in the world, and you can contribute to it and reach experimental parts first).

  Decisions:
  1. **Know-how is the core (yes).** Engineering history becomes per-part know-how: owning a part ≠ knowing how to use
     it (Caio's example: an expensive science instrument you don't know how to use; testing it is costly, wears it,
     and doesn't get the most out of it). Low know-how bites through **risk, time and yield, never fake stat cuts**:
     ignition failures, slower stacking and checkout, instruments returning less, conservative certification.
     Certification folds in as the "limits" facet. Gained by flying (by novelty, with diminishing returns), ground
     testing (money, wear), building it yourself (a domestic line starts with higher know-how), and possibly support
     packages. Know-how belongs to the team (it carries over in a defection); production lines belong to the country.
  2. **Two visible numbers per part (yes):** know-how (one bar) and production (none / licensed / own line, with
     maturity), plus a supplier-quality label once learned. The rest stays under the hood.
  3. **Support packages** (buying training and the supplier's engineers with a part, at the price of dependence):
     **provisional**, pending simulation and then playtesting.
  4. **The world frontier is a later layer (yes),** designed with the planning session. Build order: know-how →
     production lines → the frontier.
  - No hard locks anywhere: everything stays buyable and flyable. The frontier and know-how only change how well, and
    at what risk.

**What interplanetary means for the architecture (for later, not now):**
- Tellus is the root body today (`soi: Infinity`) and the sun is a fixed direction (`SUN`). A star becomes the root;
  planets ride Kepler rails around it, each with its own SOI. The patched-conic code already handles one level of
  hierarchy (Tellus → Selene), so this is about generalising it to a tree.
- The sun direction then comes from the star's position (lighting, day/night, the light budget).
- Float64 at AU scale is fine: 1.5e11 m × 1e-16 ≈ 15 µm. Rendering is already camera-relative.
- Interplanetary and intercept planning want a Lambert solver (porkchop plots for windows). Visitors are hyperbolic
  Kepler legs through the star's SOI, so the propagator already handles them.
- Warp: transfers take months; rails warp is exact at any rate, but the top step (1e5×) may need another notch.

## Rich programs: projects, waste heat and routine runs — design (2026-10-08, economy session with Caio; nothing built)

**The problem.** The v1.36 balance pass made sinks absorb strong programs' money, but sinks aren't goals. A rich program
stays fun only if money isn't enough. It should need flights, logistics, time and physics it has to solve. So
megaprojects are **built by flying them there, piece by piece**, never bought with a button. Wealth becomes launch
rate, and launch rate is the core game.

### A ladder of projects (near → far)

1. **Ground:**
   - ground stations and antenna arrays. These exist on the planning branch, where contact time drives imagery
     sales; arrays for deep space come next.
   - more pads and launch sites (terrain did sites; the economy's site-access hook is still to build);
   - factories, which tie into production lines.
2. **Tellus orbit:**
   - propellant depots (reach through launch rate: fuel up in orbit, go further);
   - large stations from modules (the sats session's plan, phases A–E);
   - **orbital datacenters**, a revenue stream that brings in waste heat (below).
3. **Selene and beyond** (bodies session):
   - colonies, where windows and transfer times turn money into planning;
   - mining resources on site: water becomes propellant and feeds the depots;
   - a mass driver on Selene (the O'Neill step: material up cheaply).
4. **Heliocentric** (the steps short of a Dyson sphere):
   - asteroid capture and mining (material that never fought Tellus's well);
   - building in space (structures too big to launch);
   - space solar power beamed down (sold to the world);
   - large stations in solar orbit for power or compute, a miniature swarm.

### Waste heat — the physics that scales with ambition

In space, heat leaves only by radiation: P = εσAT⁴.
- **Radiators:** at 300 K a two-sided radiator sheds ~0.8 kW/m², so 1 MW of compute needs ~1,200 m².
- **Solar panels:** at Tellus's distance they give ~300 W/m² of electricity, so the same 1 MW needs ~3,300 m².
- **A datacenter is therefore mostly panels and radiators.** Its mass, and so its launch count, is set by thermal
  design.
- **Running hotter shrinks radiators as 1/T⁴,** but chips get worse: a real trade-off with a sweet spot to find.
- **Attitude and orbit matter:**
  - radiators must face away from the sun;
  - a dawn-dusk sun-synchronous orbit avoids eclipse (no batteries);
  - closer to the sun there's more power but it's harder to stay cool. That's the heliocentric stations' core tension.
- **The same limit comes back everywhere:**
  - nuclear-electric propulsion is bounded by its radiators;
  - habitats dump life-support heat;
  - deep-space probes need heaters instead.

**Mechanic, in steps:**
1. A **steady-state temperature per vessel**, calculated directly with no time stepping:
   - heat in: absorbed sunlight α·A·S/r² plus internal power;
   - heat out: εσAT⁴;
   - parts get operating ranges (electronics, crew, propellant boil-off);
   - radiators and solar panels are parts with area and mass per m²;
   - the builder shows "this design runs at 340 K, above the chips' limit".
2. A **transient model** later (heat capacity, eclipses, burns).

The flight sim already has a per-part skin thermal pass for re-entry (radiation, plus convection since the capsule fix).
Orbital thermal is a separate, slower system, but it can share the radiation term.

### Routine runs — automation, and pads as the scarce resource

Refuelling a station or resupplying a datacenter is fun once and tedious the tenth time. **A route you've flown
becomes a routine run** that the program flies on a schedule, with no player in the loop.

What exists:
- **autopilot tapes**, one per exact design and sim version, replaying a recorded flight deterministically ("tapes
  replay identically");
- the **logbook** keeps a record flight's design and tape.

Both still need you watching in real time. What doesn't exist is concurrency. **The program is serial today:** each
launch advances the one calendar by its stacking days (`R.prep`), so pads aren't a resource yet.

**Proposal:**
- **A routine** = design + tape + site + target, valid while the design and sim version match. It's created from a
  flight that completed the job.
- **Resolved without the physics (cheap).** The tape's measured result (cargo delivered, Δv margin) is the outcome, and
  risk comes from what isn't deterministic: ignition rolls from know-how, certification and part wear. A failure costs
  the vehicle and the cargo, never the destination.
- **Optional:** a full headless re-simulation as an audit when something changes (new sim version, rescaled planet).
- **Launch windows.** A rendezvous needs the target's phase and plane, so a routine's slots follow its target's window
  cycle. Windows times pads is a scheduling puzzle.
- **Pads become slots on a calendar.** Each launch occupies a pad for stacking, launch and pad turnaround (bigger
  rockets wear the pad more). Manual flights and routines compete for the same pads.
  - The integration hall becomes stacking capacity (bays), separate from pads.
  - More pads, more sites and faster turnaround are what rich programs buy.
  - The UI wants a Gantt view of the pads (UI session).
- **No upkeep misery.** A project left without its routine **pauses** (stops earning or producing); it never decays
  or dies. Routines are how a project earns, not a tax on owning it.
- **Routine operations get cheaper** with repetition (ops know-how, like production-line maturity) and earn little
  prestige, so firsts stay manual and memorable.
- **Contracts too.** Repeatable contracts (satellite deployments, resupply, crew rotation from the sats plan) can be
  handed to a routine once flown once.

### Compute — a resource across eras (decided with Caio, 2026-10-08)

First slice built in v1.38: eras, access lag, the computing centre, trajectory studies.


Compute is the cause behind two existing ideas:
- "the tools only know what the program knows" (the planning branch's logbook and era maps);
- the avionics generations from the parking lot.

Today both are gated by milestones. With compute behind them, eras have a cause and the economy has something to trade.

**The arc: scarce, then abundant, then scarce again.**
1. **Human computers.** A trajectory study is an order: money **and days** (it adds to prep time, since timing is a
   core mechanic), with coarse precision. The map shows only what has been computed, with wide error bars, and a
   changed plan means a new study.
2. **Mainframes.** A computing centre is a facility, time-shared and queued but faster and more precise. Compute can
   also be rented abroad, so sanctions reach it.
3. **Onboard computers** (the Apollo guidance computer step):
   - compute on the vessel, at a cost in mass and power;
   - out of contact with a ground station, a vessel can only do what its own computer can, which gives ground
     stations a second job;
   - onboard autonomy gates the autopilot features and routine runs.
4. **Abundance.** Planning is instant and precise: the modern UI.
5. **The AI era.** World demand explodes and compute is scarce again, at a world price. Ground datacenters hit limits
   on power, cooling and permits, and **space datacenters become viable** for programs whose cost per kg to orbit is
   low enough. That threshold isn't scripted: it falls out of the player's reusability, lines and pads, and the
   waste-heat physics sets the kg needed per MW.

**Decided:**
- **What drives the eras:** the **world date**, with nudges. The world's technology advances on its own; the program
  can speed it up (contributing to the frontier), and powers differ (closed powers push domestic compute, open ones buy
  abroad, frugal ones live longer in careful hand-planning).
- **Studies add days,** not only money and precision.

**Rules:**
- **Compute never blocks flying.** You can always fly without a study and accept bigger error bars, which is how the
  early era should feel.
- **Compute is a facility and a market, not a fourth wallet** next to money, data and know-how.
- **Chips are an industrial good** with home, import or grey-market sources, like parts. Export controls on compute are
  a lever between powers.
- **Automation arrives with compute,** so a career changes feel from hands-on to managed.

**Owners:**
- **planning:** tool gating, prediction precision and error bars, the era look;
- **economy:** the computing centre, study orders and their days, the world compute price, chip sourcing and
  sanctions, datacenter revenue;
- **builder:** onboard computers as parts.

### How the economy plugs in

- **Projects are staged construction:** a bill of modules, each delivered by a flight to the right orbit or surface.
  Progress stops when deliveries stop.
- **Some projects earn:** datacenters sell compute (by uptime, power and temperature), space solar sells power, depots
  sell fuel, including to other powers.
- **Consortia.** Big projects can be co-funded by several powers: shares, defections, and sanctions that freeze a
  half-built station.
- **Prestige for the firsts:** first depot, first colony, first megawatt in orbit.

### Proposed order and owners

0. **Compute eras** (below the ladder in time, but they gate routines and datacenters): the world compute era and study
   orders first, with planning.
1. **Economy: the routine and the pad calendar.** This changes the time model from serial to concurrent; the career
   runner and the UI need to follow.
2. **Ground antenna arrays** for deep space (planning).
3. **The orbital datacenter with steady-state thermal:**
   - radiator and panel parts (builder);
   - the thermal solve (physics: builder's or a new session);
   - revenue (economy).
4. **Depots** (sats Phase C), then Selene mining and heliocentric projects (bodies).

## Time, long missions and communication — design (2026-10-08, economy session with Caio; nothing built)

**The problem.** In KSP time barely matters, because nothing in the world changes with it. Here it does: budget
years, elections, the race, sanctions, the compute eras. And our calendar is serial: a flight's time is added to it,
and only Tellus orbits survive the end of a flight.

Measured scale:
- a program day is one Tellus rotation (8 h); a year is 400 days;
- Selene is ~2.4 days away by Hohmann transfer, Nyx ~0.8;
- stacking an Orbiter takes ~36 days, so about ten flights a year.

With a sun and planets, transfers would take hundreds of days to years. A probe would either freeze the program for
years or be lost when the flight ends. Managing time must be forgiving, not a chore.

### Principles

1. Time passes only when you choose (already true).
2. Nothing you launch is lost to time: long flights continue in the background.
3. A long mission pays along the way, not only at the end.
4. Waiting is one click, and nothing slips past you.
5. Missing something costs a wait, never a failure: windows come round again, and deadlines on long missions are
   generous or absent.
6. The world changes while you wait, but waiting doesn't punish you. **Decided:** idle time roughly neutral, no daily
   overhead (v1.41).

### Mechanics

- **Missions in flight.** Any vessel coasting when you leave its flight joins the registry with its trajectory,
  around any body or between them. It moves on exact Kepler rails with transitions between bodies' gravity, and
  raises events: entering another body's gravity, closest approach, planned burns.
  - "Leave it to mission control" hands a coast off; only the time you actively flew counts on the calendar.
- **Passive flybys (decided).** A flyby needs no piloting. Its science is worked out from the trajectory and the
  instrument timeline (below). Only burns need you, or an uploaded burn plan:
  - with the era's error early on (`predErr`), so you arrive off target and need a correction;
  - precise once onboard computers come.
- **One event timeline:**
  - arrivals and launch windows;
  - studies and buildings finishing;
  - budget years and elections;
  - later, routine runs and pad slots.

  "Advance to next event", or to one you pick. Time stops automatically at anything that needs you, and background
  events that don't resolve on their own (the KSP Alarm Clock mod idea, built in).
- **Paying along the way:**
  - prestige at launch and escape;
  - public interest during the cruise;
  - cruise science per day (fields and particles);
  - the encounter payout, then an extended mission.

  Long contracts pay in stages: a share at launch, the rest at arrival.
- **The world moving is story:**
  - a probe launched with human computers arrives in the mainframe era, and the news says so;
  - probes in flight stay with the program through ownership changes;
  - a rival's probe can beat yours to a target.
- **Windows:**
  - nearby targets come round often;
  - planetary windows are the one rare timing decision, and off-window launches cost Δv instead of being refused;
  - "wait for the window" is one click.
- **The year (decided):** once there's a sun (bodies session), the year **is** Tellus's orbital period. Era lengths and
  the budget cycle are then tuned so a long probe spans about one era, not three.

### Instruments that have to look, and data that has to come home

**Instruments with pointing** (Caio): a moment of data collection should need the instrument to face what it measures.
- **Camera:** narrow field, must point at the target, needs light. Resolution comes from distance and aperture
  (today's camera is ~10 µrad).
- **Radar:** side-looking or straight down, works at night and through cloud, heavy on power.
- **Spectrometer:** points like a camera.
- **Fields and particles:** no pointing; cruise science.
- **In-situ sensors:** must be inside the thing (an atmosphere probe).

**Pointing in the background.** A probe on rails doesn't simulate its attitude. It follows a **pointing timeline**:
sun-pointing, home-pointing, target-pointing, or an uploaded sequence ("camera on Nyx from T−1 h to T+1 h, then the
dish home").

The real tension, as for Voyager and Galileo, is that the camera and the high-gain dish want different directions.
Imaging time is time you're not downlinking.

**Data is a volume.** Instruments fill an onboard recorder; contact drains it at the link rate. **Pay comes on data
received, not collected.** A flyby is a burst of capture, then days of downlink.

**The link, from physics:**
- Rate goes as transmit power × both antennas' gains ÷ distance².
- A dish's gain grows with its area, so big dishes pay: the ground arrays.
- Distance squared is what makes deep space hard: Selene is ~16,000× weaker than a 300 km orbit (38,000 km vs 300 km).
- Omni whips work near home. Deep space needs a dish on the probe, pointed home, and big dishes on the ground.

**The home network:**
- ground stations at home and abroad (built: contact time already drives imagery sales; foreign sites need relations);
- relay satellites, which extend contact for low orbits;
- deep-space dish arrays at three sites ~120° apart, so one always sees the sky. That's the "antenna arrays" idea, and
  the diplomacy needed to place them abroad.

**Control is forgiving.** Losing contact never makes a vessel uncontrollable or dead. You just can't upload new plans
until it's back: the vessel follows its last sequence (and onboard autonomy, by era), and data waits on the recorder.

**How KSP does it, for reference** (from memory of the game, not checked against the docs):
- **CommNet:** a vessel needs a chain of antennas back to home ground stations. Range comes from both ends' antenna
  power; a weak signal slows science transmission; with no connection, an uncrewed probe loses most control.
- **KerbNet:** a separate feature, a scanning overlay on the map (terrain, biomes, anomalies) from probe cores and
  scanners with a field of view.

Ours keeps the network and drops the loss of control.

### Planning before the flight (Caio, 2026-10-08)

For long missions there's little to no manual flying, so planning has to be much more involved than in KSP. That
means a **mission planning screen before the flight**: the maneuver-node idea moved ahead of launch.

**What KSP does,** from memory, not checked against the docs:
- **Stock:** maneuver nodes are placed on the vessel's current trajectory, in flight, in the map view. You can drop
  one while sitting on the pad, but there's no pre-flight mission planner.
- **Mods:**
  - Transfer Window Planner: porkchop plots of departure date against travel time;
  - Kerbal Alarm Clock;
  - MechJeb: ascent guidance and a maneuver planner that executes nodes;
  - Principia: a flight plan, a sequence of burns planned ahead and integrated.

  Players build this workflow out of mods.

**Proposal: the study is the plan.** A mission plan is made on the planning screen:
- target and window (a porkchop plot);
- ascent profile;
- burn sequence;
- the instrument pointing timeline.

The trajectory study (v1.38) is the trajectory office computing that plan. It takes the era's days and money and comes
back with the era's precision. The plan then drives:
- the automated flight (the autopilot work in another session) for the ascent and burns;
- missions in flight on the timeline for the long coasts, with burns executed at the era's error until onboard
  computers come;
- events on the timeline: window opens, burn, arrival.

In the human-computer era, planning is the slow, deliberate core of a deep-space mission. Later it becomes instant,
and the screen is where the player spends their time either way.

**Gravity assists without trial and error** (Caio): slingshotting off Selene (and later planets) should be something
the planner *solves*, not something you nudge nodes at for an hour as in KSP.

Why KSP is hard here: the outcome of a flyby depends on *where* you pass the moon (the aim point) to a few km, and you
control it only indirectly through a node hours or days earlier. Real mission design inverts this. You choose the
flyby, and a solver finds the burn.

- **Goals, not nodes.** The player states what they want after the flyby: raise apoapsis to X, escape Tellus, change
  inclination to Y°, return to Tellus with periapsis Z (a free-return), or reach Nyx. The planner shows which flybys
  can deliver it.
- **B-plane targeting** (the real method). The flyby is described by its aim point on the plane through the moon,
  perpendicular to the approach. Where you aim sets how far and which way the trajectory is turned.
  - The screen shows that plane with the aim point you'd hit now and the region that achieves the goal.
  - Dragging the aim point updates the outgoing orbit live.
- **A solver.** Unknowns are the departure burn (Δv components and time). Targets are the aim point (or the goal's
  elements directly). Use Newton iteration with finite differences on `predictFrom` (patched conics are smooth enough
  away from grazing passes), from a Hohmann-like first guess. Show "no solution" and the closest one, never a silent
  failure.
- **Sensitivity made visible.** A fan of outcomes for small errors in the burn shows how touchy a flyby is. With the
  compute era's error (`predErr`) it becomes an error ellipse on the aim plane, and correction burns (mid-course,
  days later, small) are planned in. In the human-computer era a slingshot needs corrections; later it doesn't.
- **Multi-leg plans.** Legs chain: depart, correct, flyby, burn at periapsis (the Oberth trick), next encounter.
  Each leg is an event on the timeline.
- **Windows.** For Selene, the phase angle at departure; for planets, porkchop plots (departure date × travel time,
  coloured by Δv). A gravity assist adds a dimension, so show the best few routes rather than a full grid.
- **Execution.** The solved plan goes to the autopilot (ascent and burns) and, on long coasts, to missions in flight
  with burns executed at the era's error. The study (v1.38) is what computing this plan costs in days and money.

**Owners:**
- the screen: UI;
- nodes, maps, porkchop: planning;
- execution: autopilot session, sats registry;
- studies (cost, days, precision): economy.

### Owners and order

1. **The time model:** the event timeline (economy + UI view; first slice built in v1.42) and missions in flight in the registry (sats, planning).
   It comes before routine runs, which are just another source of events.
2. **Data as a volume plus the link budget** (planning: stations, antennas; economy: pay on received data).
3. **Instruments with pointing and the pointing timeline** (builder: parts; planning or sats: the timeline).
4. **The sun, planets and the year** (bodies).

## Platform direction: native desktop later, the browser for now (Caio, 2026-10-08)

**Decision.** The finished game is a **native desktop** app; the browser was the experimental start. For now, keep the
single HTML file with no build step: rapid iteration and the parallel sessions matter more than raw speed at this
stage. Note the port's considerations here, don't act on them yet.

**Where the time goes today** (RTX 3050, 1024×768, measured 2026-10-07):
- **The GPU dominates.** The sky and terrain shader costs ~3–9 ms a frame (worst: low views across rugged terrain);
  ~2–2.6 ms without terrain. That's GLSL and algorithm-bound. A native port helps only through what a native GPU API
  allows (compute shaders, bindless textures, async compute), not through the CPU language.
- **CPU per frame** is ~0.3–2 ms.
- **The CPU costs that hurt are bursty:**
  - page load ~1.5–1.8 s (world generation, sites, cities);
  - prediction and warp loops;
  - the test suite.

**Cheap wins before any port:**
- world generation in a worker, or baked on the GPU, and cached;
- no small-array allocations in the vector maths of hot loops (`add`/`sub` return new arrays: GC churn);
- typed arrays in hot loops.

**When native pays:**
- the simulation becomes the bottleneck: many vessels, n-body everywhere, part-level physics, big debris fields,
  long warps with physics on;
- a real desktop build. Likely Rust with wgpu, which also opens compute shaders for terrain and generation.

**How to keep the port cheap, starting now:**
- **The SIM block stays pure** (no DOM/GL). It is the part that ports mechanically.
- **The headless checks are the oracle.** A port of `physStep`, `kepler` or `makeWorld` must reproduce their numbers.
  Golden fingerprints of world generation and flights (LESSONS #16) make that exact.
- **Shaders:** GLSL ES 3.00 translates to WGSL/SPIR-V almost line by line. Keep shader logic in plain functions, as
  the terrain code is (`hgtG`, `terr`, `march`).
- **CPU/GPU parity tricks carry over unchanged.** Integer hashes, `texelFetch` with your own weights, a hand-written
  `atan2`, float64 on the CPU with camera-relative float32 on the GPU (§ v1.25).
- **Piecemeal is possible even before the full port.** A hot kernel can move to WebAssembly behind the same function
  signature, with the JS version kept as the reference.

## Precision tricks worth keeping

- **Ray–sphere in float32 at 2 m above a 600 km planet.** The CPU sends `cc = (d−R)(d+R)` in
  double precision. The shader uses the stable quadratic: `t = cc / (b + √(b²−cc))` for the near
  root. Error at the launch pad is about 2 cm.
- **Near-field ground detail without a seam.** Detail noise is evaluated in a local frame whose
  origin the CPU snaps to the nearest 1 km. Each octave's lattice period divides 1 000 m
  (`mod(i, P)` in the hash), so re-centring never visibly pops.
- **Log depth** is written per fragment (`gl_FragDepth = log2(1+w)·Fc/2`). The vertex shader writes
  a matching log z, so nothing gets near/far clipped.

## UI: screens and navigation — spec (2026-10-07, ui session with Caio; slices 1–3 built below)

**The problem.** The app has two screens (`mode` = editor/flight) plus a `view` toggle for the map. Everything else
was added to whichever panel was nearest when it got built. The whole career (ownership, contracts, race, ground stations,
satellites, 5 epochs, world, know-how) sits in the Assembly left panel, above the parts. The career start and choices
that expire are mixed into that same panel, and nothing stops a launch. A flight has no debrief: `missionEnd` results
only show up as truncated `#news` lines. `#info` can grow past 20 rows and run into `#stages`. `#help` and `#nodep` share
a spot. Revert and Assembly leave a flight with no confirmation. `R` does three things depending on context. Many actions
can only be done with a key. `#news` and `#perf` are visible on every screen.

**Decisions (Caio, 2026-10-07):** Program becomes its own screen. Rollout becomes a checkpoint before launch. The flight
HUD is a core plus cards that appear on demand.

### The map
```
 Program (HQ) ──▶ Assembly ──▶ Rollout ──▶ Flight ⇄ Map
     ▲   ◀────────────┘   ◀────────┘          │
     └──────────── Debrief ◀──────────────────┘
 Overlays on any screen: Logbook (L) · Help (H, shows the current screen's keys) · Esc menu
```
One state variable, `screen` ∈ `program | assembly | rollout | flight | map | debrief`, with a single `go(screen)` that
shows and hides layers and decides which keys work. `mode`/`view` stay as derived aliases until every caller has been
switched over (additive first). Overlays are a stack: Esc closes the top one; with nothing open, Esc opens the Esc menu.

### What each screen shows (and doesn't)
- **Program**, the home screen, entered at load:
  - Header: date, funds, standing, and an Inbox badge.
  - Tabs: **Inbox** (decisions with their deadlines, contract offers, news since the last visit), **Missions** (epochs),
    **Contracts** (active, board, race), **Fleet** (satellites in orbit, ground stations, docked craft), **World**
    (powers, relations, sanctions, election), **Know-how** (bars plus "What we know"), **Company** (ownership, shares, reset).
  - First run: a full-screen "Whose program?" then "How does it start?" choice. It must be made before anything else.
  - Exits: **Build** goes to Assembly; **Logbook**.
  - *Not here:* parts, the ship.
- **Assembly**, building only:
  - A thin strip at the top: funds, date, Inbox count, ← Program.
  - Left: the parts palette and presets. Right: the toolbar, staging, and the selected part's options. Below that, a
    short summary (Δv and TWR per stage, total, cost against funds). Stability, loads and the long aero text fold into a
    collapsed "Aero & structure" block.
  - Exit: **Roll out ▶**.
  - *Not here:* contracts, missions, the site picker.
- **Rollout**, the checkpoint (it can be a panel over the ship on the pad):
  - Site picker and its description.
  - The contracts and missions this flight can satisfy.
  - Cost, days to stack, and the ops fee.
  - Warnings: over budget, site refused or doesn't fit, TWR < 1, unstable, unanswered decisions.
  - Exits: **Launch** or ← Assembly.
  - Owns `renderSites`, which leaves Assembly (as NOTES § v1.27 asked).
- **Flight**:
  - Fixed core (top left): MET, altitude (radar altitude when low), vertical speed, speed, Ap/Pe, stage and total Δv.
  - Bottom: navball, throttle, SAS. Bottom left: stages.
  - Cards appear in a right-hand column while their condition holds, and each can be pinned:
    - **Ascent** (Mach, AoA, q, heat, structure), while in air with q above a threshold or heat rising;
    - **Target** (target, closest approach, line-up, docking), while a target is set;
    - **Payload** (passenger, instruments, contracts), during payload events and on demand;
    - **Fleet** (vessels, switching), when more than one vessel exists;
    - **Bay/Claw/Port**, while armed.
  - The column is capped in height; the oldest unpinned card collapses first.
  - Top right: Map, warp (shown *and* clickable), ☰ (the Esc menu).
  - *Gone from the HUD:* Revert, Assembly, Save tape and Logbook, which move to the Esc menu.
- **Map**:
  - Orbit information (Ap/Pe, period, inclination, SOI, encounter), the node panel, target info, and a focus body picker
    (clickable as well as Tab).
  - The navball shrinks to a heading readout; the cards hide except Target.
- **Debrief**, entered when a flight ends (landed, crashed, in orbit and you choose "End flight", or Revert/Assembly
  from the Esc menu):
  - Sections, in order: outcome, pay, refurbishment, damages, certifications, records, incidents, and the know-how gained.
  - Exits: **Program**, **Assembly** (same design), **Fly again**.
  - `missionEnd` returns a summary record and Debrief renders it, instead of results going to `#news`.

### Overlays and keys
- **Esc menu:** Resume, Revert to launch, Back to Assembly, End flight (a confirmation shows what you lose), Save
  autopilot tape, Settings (modern look, perf readout off by default, which keys).
- **Help** is generated from one key table per screen, so it can't drift from the handlers. One table, two consumers.
- **Keys:**
  - `L` logbook.
  - `R` is only revert, after landing or a crash. RCS moves to `V`. The editor's radial decoupler keeps `R` (screens
    don't share keys).
  - `F5` quicksave stays out of scope.
- **`#news`:** shown in Flight and Program only. In Program its lines go into the Inbox.

### Slices
1. The `screen` state, `go()`, the overlay stack and Esc, and per-screen key tables that feed Help. No visible changes
   apart from Help and Esc.
2. The Program screen: move the `renderProgram` sections into tabs, with the first-run gate. Needs the **economy** and
   **bodies** sessions told; they own those render functions. The HTML they produce moves into tabs; their code stays.
3. Debrief: `missionEnd` → summary record → screen.
4. Flight cards and the core; the Map trims the HUD.
5. Rollout: the site picker and checks move out of Assembly; then trim the Assembly right panel.

Each slice merges to `main` on its own. test.mjs gets a check per slice: every screen reachable from every other along
the arrows, and every key in the handlers present in its Help table.

### Slice 1 built (2026-10-07): screen state, overlays, keys
- `screenNow()` names the screen (`assembly | flight | map` so far). `go(s)` is now the only code that assigns
  `mode`/`view`: LAUNCH, Assembly, Revert, `R` and `M` all go through it. test.mjs §32 fails if a `mode=`/`view=`
  assignment appears anywhere else.
- `KEYS` holds one table per screen plus `all`; each row is `{k: e.key names, l: label, d: what it does}`. The Help
  overlay (`#help`, now centred and outside `#hud`, so it no longer covers `#nodep`) is generated from it, for
  whichever screen you're on. Map shows its own rows, then Flight's. §32 reads every `k==='…'` and `keys.has('…')` in the
  flight, shared and builder key handlers and fails if one isn't listed, or if a key means two things on one screen.
  **Anyone adding a key: add its row to `KEYS`.**
- Overlays (`escm`, `help`, `logbook`) stack. Esc closes the top one; with none open it opens the Esc menu (`#escm`,
  also the ☰ button). In Assembly, a part in hand or a selected part keeps Esc for the builder. The menu has Close, and
  during a flight Revert, Back to Assembly and Save as autopilot, then Logbook, Keys, and a performance-readout checkbox
  (`#perf` is now off by default; localStorage `launchpad-perf`). Revert and Back to Assembly ask twice while
  the ship is in the air; on the pad or after landing they act at once.
- Keys: `H` help and `F` logbook work on every screen. **The logbook is on F, not L as planned: L is held for RCS
  translate.** RCS on/off moved from R to **V**; `R` in flight is only revert.
- Not done yet: the top bar still has Revert/Assembly/Logbook/Save as autopilot (slice 4 takes them off). The Esc menu
  does not pause the game. That's still open: KSP pauses, and here warp would have to drop to 1× and then come back.

### Slice 2 built (2026-10-08): the Program screen
- The page opens on **Program** (`#prog`), a panel over the ship waiting on the pad. Header: date and funds, Logbook,
  **BUILD ▶** (or `B`). Assembly gets back with `P`, the "← Program" button in its new top strip (date, funds, Inbox
  count), or the Esc menu. Internally `mode` stays `'editor'` and `atHQ` hides the Assembly panels. Only `go()` sets it
  (§32), and builder.js's key handler ignores keys while `atHQ` is set.
- Rows in `KEYS` can carry `go:'<screen>'`; the shared key handler acts on them, so screen keys need no handler code.
- **How sections reach tabs.** `renderProgram` (economy/bodies) is unchanged and still writes one column into a hidden
  `#program`. A wrapper calls `progLayout()` after it, which moves each section into a tab according to its heading
  (`progTabOf`):
  - Inbox: decisions with deadlines (always first), contract offers.
  - Missions: the epochs.
  - Contracts: active contracts, standing, the race.
  - Fleet: ground stations, in orbit.
  - World.
  - Industry: know-how, test stand, facilities, development, production, what we know.
  - Company: ownership, shares, history, reset.

  A heading it doesn't know goes to a "More" tab. **§32 fails if any `class="ep">Heading` literal in the page would land
  there.** Whoever adds a section adds its heading to `progTabOf`. Click handlers are delegated on `document`, so moving
  the nodes doesn't break them.
- **First run gate:** while "Whose program?" / "How does it start?" are showing, Program shows only that choice and Build
  is disabled (and `go('assembly')` refuses). This closes "nothing makes you choose before launching".
- Not yet: Inbox doesn't collect news (the `#news` ticker still runs as before); the Assembly right panel is untouched
  (slice 5); the CoM/CoP markers still draw behind the Program panel.

### Slice 3 built (2026-10-08, flow session, QUEUE Q2): Debrief
- **The record is SIM data** (`sim/debrief.js`). `missionTick` takes a snapshot just before liftoff (`R.deb0 = debSnap()`:
  funds, date, know-how, missions done, satellite count, the orbit record). `missionEnd`, once the flight is settled, builds
  `R.debrief = debriefOf(s, R, ups)`, keeps it in `DEBRIEF_LAST` and returns it as `.debrief` beside `{ups, streak}`.
  It never throws: a record that fails to build is `null` and the flight still settles.
  - Outcome: landed (distance from the pad, recovery), lost (the apex), in orbit (pe × ap; "registered in the fleet" when
    `satRegister` took it), landed on / in orbit of a moon, escaping, or ended in flight (written off). A passenger's fate.
  - Money: hardware, launch operations, every pay item, refurbishment, damages, then **"N days passing"**: the rest of
    the funds change (budget days, upkeep, debt) during the stacking and flight days. The lines add up to the net, which is
    `PROG.funds` after minus before (test `flow-1` checks the sum).
  - Missions, telemetry certifications (`ups`), logbook records set on this flight (with the old value), incidents
    (stages on or near towns, on another power's land; a passenger lost), know-how gained per part.
  - **Pay items need one call each where money is paid** (economy, additive): `debPaid(R, kind, label, pay)` in
    `missionComplete` (`rec`), `contractEval` and `stagePay` (which now takes `R`). **A new kind of flight pay should add
    its own `debPaid` line**, or it shows up inside "days passing". Missing lines never break the sum, only its detail.
- **The screen** (`app/debrief.js`, `#deb`): a panel over the pad like Program; header with flight number, design, date and
  time flown; sections in two columns (headings use class `dh`, not `ep`, so §32's Program-tab check ignores them).
  Exits: **Program [P]**, **Assembly [B]** (same design), **Fly again [A]** (Assembly → the usual LAUNCH with its checks;
  disabled for a flight that started in orbit). The one you were heading to is highlighted.
- **How you get there.** `go()`: leaving flight or map for Program or Assembly settles the flight (as before) and, if that
  flight has a record not shown yet, goes to `debrief` instead, remembering where you were going. So the toolbar's
  Assembly, ☰ → Back to Assembly and `go('program')` all pass through it. New: ☰ → **End flight: debrief** (asks twice in
  the air), and an **End flight ▸** button in the flight toolbar once the vessel has landed or is lost (`debEndBtn`, from
  `hudLayout`). Program has **Last flight** to see it again (not kept across reloads). Rover yard skips it.
- **Revert and `R` skip the Debrief on purpose**: they are the quick retry, and the record is still kept (Last flight).
  TESTING row 127 asks whether that's right.
- `atDeb` joins `atHQ`: builder.js ignores keys on Debrief, and render.js no longer draws the builder's CoM/CoP markers
  and `edOverlay` behind either panel (they showed `NaN%` behind Program after a flight). §32 now counts `atDeb=` too.
- Robot: rows that `go('program')` after a flight now land on Debrief first; the next `go('program')` goes on to Program.
  Probed in Chrome (Sounding landed, Orbiter lost, a climb ended from the Esc menu, the Assembly button): screenshots in
  `C:/Users/caioa/dev/playtest-out/flow/`.
- Not yet: the `#news` lines still also run during the flight (the spec moves results off the ticker; they now
  duplicate the Debrief); Inbox doesn't collect them yet.

### Esc pauses; two more lanes; identity mock-ups (2026-10-08, flow session, QUEUE Q39, Q75, Q76, Q73)
- **Esc pauses** (W5, Q39). `gamePaused()` (screens.js) is "the Esc menu is open". While it is, `frame()` skips `simulate`
  (flight, warp, the rover), `sndTick` treats the flight as not live (the mix goes quiet), and the flight key handler
  returns at once, so Space, throttle and the rest do nothing; the shared keys (Esc, H, F) still work. Closing the menu
  carries on at the same warp: nothing drops to 1×, because nothing ran. The menu's title says "· paused" in flight, map
  and rover; its first button is now **Resume [Esc]**. Help and the logbook don't pause (look things up while flying).
  Robot `m1`: 2.5 s with the menu open, `simT` moved 0 s.
- **The builder's key strip** (PLAYTEST #25, Q75): `bldLayout()` puts `#bldhelp` between the two assembly panels, centred
  and wrapping (two lines at 1280×800), instead of across both; hidden below a 160 px gap. Its CSS stays in builder.js;
  the place is set from app/state.js (`hudLayout` and resize), next to the news lane.
- **`#msg` gets a lane** (PLAYTEST #26, Q76): `msgLayout()` (from `HOOK.msg`, `hudLayout`, resize) centres it between the
  readout and the right-hand panels (`#nodep`, `#rvFHud`), drops it below the toolbar or the news where they meet, and
  under the readout when there's less than 200 px beside it. Off the flight screens it goes back to its CSS place.
- Robot `m1` (QA's M1 finish line: gate → Sounding → first orbit → Debrief) passes in full on branch `ui`: Debrief after
  both flights, Esc pause 0 s, no box covering another at 1280×800 on any screen.
- **Visual identity mock-ups** (Q73 → Q53, PLAYTEST #13): three directions, paperwork, instrument panel and
  mid-century poster, on the Program screen and the flight HUD with the real layout over real game frames, plus a later
  era for each: [`mockups/identity/`](mockups/identity/index.html), stills in `output/launchpad/mockups/identity/`, the
  options and trade-offs in [`mockups/README.md`](mockups/README.md). For Caio to pick (or mix: office screens in one,
  cockpit in another); Q53 builds the pick.
- **First run explained** (Q41): the gate's two questions each open with one line on what the choice decides (the power:
  how the money arrives, what the public wants, what a failure costs; the start: who owns the program and who you
  answer to), and every option is a row with its own sentence on screen (it used to be a hover tooltip for the powers,
  so only the chosen power's line showed). "Random world" names what it rolled. The consortium's blurb became one
  sentence. Same buttons and `data-arch` / `data-start` attributes, so the robot rows and handlers are unchanged.
- **Settings** (Q42): ☰ → Settings (`app/settings.js`, `#settings`, loaded last). Sound on/off (same switch as F4;
  `#setSound` is the empty slot for the volume slider, Q35), graphics quality, the performance readout (moved out of the
  Esc menu), the flight gauges, the era look ("modern look", the same switch as the logbook's), and leaving tester mode.
  Each kept per browser (`launchpad-quality`, `-gauges`, and the existing `-sound`, `-perf`, `-modern-ui`). **Quality**
  is a preset over aerofx's A/B flags plus a cap on the adaptive resolution (`RS_MAX` in render.js, which `adaptRes`
  never climbs past): High = everything; Medium = flat clouds (`CLOUD_VOL`), no plume ground glow (`IMPACT_FX`), up to
  80 %; Low = also no bloom, plume light or vapor cones, up to 60 %. The re-entry plasma stays at every level: it tells
  you something. Settings open pauses the game like the Esc menu. **Look & sound:** a new costly effect should get a
  line in `QUAL`.
- **What to do next** (Q40): one line above the Program tabs, **NEXT**, with why and, when a preset is known to fly it,
  which. `nextStep()` (`sim/next.js`, pure, test `flow-2`) picks, in order: a decision waiting for an answer (soonest
  deadline); an accepted contract (soonest deadline); an open mission, preferring ones a preset flies (`NEXT_PRESET`:
  weather and loads → Sounding, beeper → Orbiter with an instrument package, hop → Passenger; all flown by the robot)
  within one epoch of the earliest open one, then the earliest epoch, then the smallest pay; else the best offer. The
  why names the pay, what it opens, and "be first" for a race mission nobody has won. Its button opens the right tab.
  **Economy/bodies:** a mission a preset can fly may get a line in `NEXT_PRESET` (only when a flight has proved it).
- **Results off the ticker; news in the Inbox** (Q99): `missionEnd` is wrapped app-side (`settling`), and headlines raised
  while a flight settles (refurbishment, telemetry, records, missions completed at the end) skip the `#news` ticker:
  the Debrief shows them. Headlines during the flight still show live. Every headline goes to `NEWS` (last 40, with the
  day); the Inbox ends with a **News** section, the ones since you last left the Program marked.
  **Caught on the way (the split's rule 1, app side):** the Program layout runs at start-up, at the end of
  `program-ui.js`, so anything it calls must live in that file or an earlier one. A first cut kept `newsHTML` in
  `debrief.js` (later): the page stopped at load, on the Assembly with a black view. `platform-1` only checks the SIM
  files; robot `m1` on the plain page (no `?tester`) caught it.
- **Map labels no longer pile up** (PLAYTEST #31, Q115). Not labels at the origin: from a camera at Selene, Tellus is a
  dot near the screen's corner, and every city, satellite and fleet name on it was drawn there, because names were gated
  on the camera's distance to its *focus* (`cam.mDist`), not to the body they sit on. City names now need the camera
  within 4.3 R of Tellus, satellite names within 10 R of the body they orbit. And the map places label texts after the
  marks, most useful first (orbit and encounter labels, impacts, then ships, then stations and satellites, then cities),
  skipping any text that would overlap one already placed. Probed on the robot's far-side flight: the pile is gone, the
  orbit labels unchanged.

### Slice 4 plan: the flight core and cards (2026-10-08, flow session, QUEUE Q3; plan only, build after Caio reads it)
**Today.** One `#info` table: 13 rows always (MET, Body, Altitude, Radar alt, Speed, Apoapsis, Periapsis, Mass, Δv, Aero,
Impact, Heat, Structure, Link) plus up to 16 more from ten helpers owned by six sessions (`spinRows`, `wheelRows`,
`rcsRows`, `tgtRows`, `dockRows`, `fleetRows`, `bayRows`, `armRows`, `rvRows`, `payloadRows`). At ~25 rows it runs into
the stages (PLAYTEST #9, TESTING 98). Aerofx's gauge strip (`drawGauges`: altitude tape, air depth, q with max-q, Mach,
heat) sits right of the navball as a placeholder (`gaugeRect`). The toolbar has seven buttons.

**1. The core** (top left, fixed, never more than 6 lines; the spec's list):
- `MET` and the situation on one line: `T+04:12 · Tellus · flying · link Fenfen Cape` (the Link row folds in here; blackout
  in amber).
- `Altitude` (it becomes *radar* altitude, labelled so, below `TERR_TOP` + 20 km while descending), with the vertical speed
  beside it as today.
- `Speed`: one number, surface speed in the air and orbital speed above it (the label says which).
- `Ap / Pe` on one line, each with its time.
- `Δv`: stage · total · TWR.

**2. The gauges are the instrument panel**: they stay bottom centre beside the navball (gauges | throttle | navball |
SAS), shown while the Ascent condition holds (in the air with q > 1 kPa, or skin heating rising), hidden in space, so the
cluster narrows. `gaugeRect` moves to the HUD layout (flow), the drawing stays aerofx's.

**3. Cards**, a right-hand column under the toolbar. Each card: a title bar, its rows, a pin (📌 keeps it open). A card
shows while its condition holds; the column is capped at the window height, and the oldest unpinned card folds to its
title bar first. Today's rows, mapped:

| Card | Shows while | Rows (from) |
|---|---|---|
| Ascent | the gauges show | Structure, Heat (the part, ablator) — the numbers the gauges don't draw |
| Descent | descending with an impact predicted, or landed | Impact (+ spread, range safety), landing (`payloadRows` landing line) |
| Target | a target is set | `tgtRows`, `dockRows` |
| Payload | payload events, or opened from the core | `payloadRows` (passenger, instruments, contracts) |
| Fleet | more than one vessel | `fleetRows` |
| Vehicle | spinning, wheels saturating, RCS on, or opened | Mass · g, `spinRows`, `wheelRows`, `rcsRows` |
| Hardware | a bay, arm or claw armed | `bayRows`, `armRows` |
| Rover | driving | `rvRows` |

**For the other sessions (additive): a card registry.** `HUD_CARDS.push({id, title, when: () => bool, rows: () =>
[[label, html], …]})`. Today's helpers become `rows` unchanged, so their owners change nothing; new HUD content
registers a card instead of appending to `updateHUD`'s list. A static check (like §32) fails if `updateHUD` gains a row
outside the core.

**4. Toolbar**: Map, warp (shown and clickable: ◀ ×N ▶), ☰. Revert, Assembly, Logbook, Keys and Save as autopilot
leave it (all in the Esc menu; End flight ▸ appears when the flight is over, slice 3). The news and `#msg` lanes
(`hudLayout`) take the card column's left edge as their right limit.

**5. Map view**: the core stays; the navball shrinks to a heading line; gauges and cards hide except Target; the node
panel as now.

**Slices**, each merged alone and checked by robot `m1` (no box over another at 1280×800 and 1000×700) plus TESTING 98
(a busy docking flight): **4a** the core, the toolbar trim and the card frame with the helpers mapped (same content,
new places); **4b** the gauges placed and the Ascent/Descent cards (closes PLAYTEST #9); **4c** the map trims.

**Defaults, for Caio to override** (W15): gauges beside the navball, not in a card · one speed that switches at the
top of the air · Keys leaves the toolbar (H and the menu still have it) · pins remembered per browser.

### Slice 5 built (2026-10-09, flow session, QUEUE Q4): Rollout
- **A checkpoint between the Assembly and the launch** (`app/rollout.js`, `#roll`): a panel beside the ship on the pad,
  like the spec's "a panel over the ship". The Assembly's foot keeps the one-line site summary and gets **ROLL OUT ▶**
  (`#bRoll`); the Rollout has the launch site (the picker, `renderSites`, moved here from the Assembly as § v1.27 asked),
  **Checks**, **The flight** (hardware, ops fee, site fee, funds after, what comes back if it all lands, days until it
  can fly: stacking as `missionTick` reckons it, plus a study and a free pad), **In play** (the NEXT line, accepted
  contracts), then ← Assembly [B] and **LAUNCH**.
- **Checks** (`rollChecks()`): ⛔ over budget, site refused, stages don't fit, stage-1 TWR < 1, unstable with nothing to
  steer; ⚠ the ops fee goes below zero, downrange over another power, weather that may scrub, sluggish TWR < 1.15,
  unstable but steerable, a joint past its certified rating, flight safety refusing a passenger, decisions waiting.
  LAUNCH dims while a ⛔ holds; its own checks (editor.js) still decide. **Vehicle, Q48:** the builder's pre-launch
  warnings (contract orbit out of reach, no chute on a crewed return) belong in `rollChecks`, one line each.
- **`#launch` kept its id** and moved into the Rollout, so every scripted `$('launch').click()` (views.js, the robot's
  `PT.launch`, Fly again) still launches straight away. Only real clicks changed: robot `m1` now clicks ROLL OUT then
  LAUNCH (and shoots the Rollout), and its `PICK` helper opens the Rollout first. `atRoll` joins `atHQ`/`atDeb` (builder
  keys off, builder markers off; §32 counts it). Robot rows m1, 25 and 26 pass.
- Not yet (the spec's "then trim the Assembly right panel"): the cost, days and study lines still also show in the
  builder's panel (vehicle's), so they repeat here.

### Landing where you click (2026-10-09, flow session, QUEUE Q62)
- In the map, a click that misses orbits and satellites is cast onto the bodies (`surfacePick` in `sim/sitepick.js`, pure,
  test `flow-3`): the first moon it meets gives a site in that body's own frame (`pf`, what bodies' `landAt` flies to). If
  the design has a recorded procedure that lands on that moon (`procLandsOn`), it becomes `landPick`: a "landing site" ✕
  on the map, the ▶ Procedure button says "→ 14.0°N 160.9°E", and starting it flies `procWithSite(pr, body, pf)`: the same
  procedure with the transfer aiming its plane at the site and the descent landing on it (NOTES § "Landing on a chosen
  point"). A design with no landing procedure there gets "land there once by hand". Picking again replaces it.
- **The start buttons stay while the craft is on the pad** (`prelaunch()`): ▶ Procedure and ▶ Autopilot showed only at
  `simT === 0`, but time runs on the pad, so they went away a few frames after LAUNCH. They now stay until liftoff.
- Probed in Chrome on a Probe with a Selene landing procedure: the site is picked, marked and named on the button.
  Not flown end to end here: `landAt` itself is bodies' and tested there (§ bodies-3, 5 m from any site).
- **The Program sits over the pad again after a flight** (Q145, PLAYTEST #27's second half): opening the Program while the
  ship is a flown one (`S.rec.launched`) rebuilds the design on the pad (`editorChanged`), so the backdrop is the pad,
  not the stage in orbit or the landing site. The Debrief still shows where the flight ended. Probed: an Orbiter left at
  40 km, Debrief, then Program: the pad.
- **Evergreen (walking the screens as a new player).** (1) Over the notebook-era map, the map every new career sees on
  M, the HUD's glass buttons and white messages vanished on the cream paper: `body.paper` (set while that map shows)
  turns them to ink, with the "on" buttons in red pencil. (2) Keyboard paths: **L** rolls out from the Assembly and
  launches from the Rollout (the buttons say so), **1–8** pick the Program tabs; `KEYS` rows can carry `act` (called
  with the key) as well as `go`. **Enter** ends a flight that is over (landed or lost), like the End flight ▸ button.

### Network screen plan (2026-10-09, flow session, QUEUE Q111; plan only)
LATE_GAME.md (approved) makes the network screen the late game's main screen: nodes you built, routes that fly
themselves, tonnes a year on each, the bottleneck named, beside the pad calendar, with every vessel in flight on screen
(§ "The network", § "Keeping flight in play", NOTES § "Routine runs": "the UI wants a Gantt view of the pads").

**What it shows.**
- **A schematic, not the orbital map.** Bodies as columns, left to right outward (Tellus, Selene, Nyx, then the
  planets as SYSTEM.md opens them); within a column, surface at the bottom and orbits above it, by altitude band.
  Nodes sit in their slot: sites and pads, stations, depots, outposts and bases, datacenters, relays (with a coverage
  bar), the mass driver. Distances aren't to scale; the real map is one key away for that.
- **Routes as lines between nodes**, thickness by tonnes a year, colour by good (propellant, supplies, crew, hardware,
  materials), a dashed line for a route waiting on its window (with "next window in 214 d"). A route through a comms gap
  is flagged (LATE_GAME § Comms).
- **The bottleneck line**, always at the top: one sentence naming the limiting thing ("Depot L1 is short of
  propellant: Selene's plant makes 40 t/y, routines draw 55"), with a button to the node.
- **The fleet strip**: every vessel in flight, its next event and the time to it; nothing coasts out of sight.
- **The pad calendar** under it: one row per pad (and per stacking bay once the hall becomes bays), bars for each
  launch's stacking, launch and turnaround, manual flights and routines in different colours, windows as shaded bands.

**Clicks.** A node opens its panel: stock and needs per good, routes in and out, what it's waiting for, and the
honest next action ("fly a supply run here by hand", "build a second pad"). A route opens its template: design,
procedure, Δv, tonnes per launch (up from what, LATE_GAME § Templates), its window family, recent runs and failures.
A bar on the calendar opens that launch. Every node, route and bar names what it is in words, never only a colour.

**How it reads the game: one pure SIM function** owned by the economy (with space for the orbits), so the screen
draws and never computes: `netModel()` → `{nodes: [{id, kind, body, slot, name, stock, need, paused?}], routes: [{id,
from, to, goods: {good: t/y}, runsPerYear, window?, gap?}], bottleneck: {text, node, good} | null, fleet: [{name, next,
t}], pads: [{pad, bars: [{from, to, kind, title}]}]}`. Test: the model's sums (what routes deliver equals what nodes
receive), the bottleneck picked by the largest shortfall, and a static check that the screen file calls no SIM
function but `netModel`.

**Slices.**
1. **N1, now (M2):** the pad calendar and the fleet strip from what exists: `padsFree`, the dispatch queue
   (`PROG.dispatch`, base runs), the timeline (`upcoming`), registered craft (`satsUp`, `landedUp`, moon satellites).
   A compact pad calendar also goes in the Program's Fleet tab.
2. **N2:** the schematic with today's nodes (sites, pads, satellites by orbit band, bases, relays) and no routes yet.
3. **N3, when the economy builds routines and depots:** routes, goods and the node panels.
4. **N4:** the bottleneck line, then rivals' networks drawn coarsely (LATE_GAME § Rivals) and the era's look (notebook,
   terminal, modern, as the map does).

**Defaults, for Caio to override** (W16): its own screen (key N from the Program, shown once the program has a
second node beyond the pad), not a Program tab · a schematic, not drawn on the orbital map · the pad calendar on the same
screen, below, plus a compact copy in the Fleet tab.

---

## Picking this up cold

- **Direction:** native desktop eventually, the browser for now (§ "Platform direction"). Keep the SIM pure: it is what ports.
- **Tests:** `node test.mjs --smoke --jobs 4` (~25 s) while working; `node test.mjs --only <your area>` for one area; the full
  `node test.mjs` (~5 min) before merging. § "Test shards".
- **The code is split** into `sim/*.js` (the pure SIM) and `app/*.js` (render, UI), classic scripts loaded in order by
  `index.html`; § "The file split" has the map and the rules. The SIM (`SIM BEGIN … SIM END`, across `sim/`) is pure,
  with no DOM or GL. `test.mjs` reads it through `page.mjs` and drives it headless with `new Function`. Keep that boundary.
- The construction screen is `builder.js` (object `BLD`), loaded before the main script and driven by it through
  `renderEditor`/`editorChanged` and `HOOK.edDraw`/`HOOK.edOverlay`/`HOOK.view`. Designs are v2 trees (§ v1.17);
  `assemble(toV2(old))` is how the old format still flies.
- Frames: the vessel state is `(body, r, v)` relative to the body it orbits (patched conics). Bodies form a tree (`BODIES`,
  `addBody`); `bodyRel` gives a moon relative to its parent, `bodyPos` relative to the root, `soiAt` the (possibly breathing) SOI.
  Tellus spins about +Y; `fromPF/toPF` convert to and from planet-fixed. The launch site is
  planet-fixed +X.
- Vessel axes: Y = nose, X = belly (east on the pad), Z = south on the pad. The navball shows
  screen-up = −X and screen-right = +Z.
- The world: `WORLD` (baked maps) + `terrainH(pf)` (metres above the sea; the sea is the sphere R) + `biomeAt(pf)`.
  The sky shader marches the *same* height (`hgtG`/`terr`); after any change to the height function on either side,
  load `terrain-probe.js` and rerun `terrainProbe()`. See § v1.25 for how, and for the geography plan (slices B–E).
  Launch sites: `SITES` (plain data), `curSite()`/`homeSites()`, `newShip(stack, site)`; see § v1.27. Station horizons,
  the flight's link, recovery and geographic disasters/contracts: § v1.48.
  The map's atlas (biomes, powers, coasts, borders; the C key; `ATLAS`/`atlasBake`/`atlasAt`): § v1.52.
- In the in-app preview pane, `requestAnimationFrame` barely ticks while the pane is hidden.
  Drive the sim from `javascript_tool` (call `physStep` / `rails` / `render` directly), or open
  the page in a real browser.

## Open threads (best-specified first)

1. ~~Maneuver nodes~~ done in v1.4. Next on that line: several nodes in a chain, nodes beyond an SOI change, and a
   finite-burn correction (aim the burn so its *centroid* hits the impulse) to recover the 0.8 %.
2. ~~Re-entry heating~~ done in v1.7. Next on that line: conduction between neighbouring parts, and heating on an engine's own plume.
3. ~~Terrain height~~ done in v1.25 (generated world, shared CPU/GPU height, physics on it). Next on that line: launch
   sites as data, stations with horizon masking, recovery, biome science (§ v1.25 "Next session"), and the cost of
   low grazing views.
4. ~~Radial attachment~~ done in v1.3, ~~crossfeed~~ done in v1.6, ~~asymmetric and nested attachment~~ done in v1.17
   (the construction screen), ~~radial fins~~ and ~~re-rooting~~ done in v1.18, ~~a staging editor~~ done in v1.20, ~~canted
   engines~~ done in v1.22, ~~core↔booster aero interference~~ (Newtonian shadowing) done in v1.23. Next on that line: truly
   tilted bodies; and on interference, the parts Newtonian shadowing leaves out (wake suction behind a body, gap-flow drag
   at zero α, shadowing of fin plates).
5. ~~Physics warp > 4×~~ done in v1.2: exact up to 100×. Optional next: *drawn* flex, bending the mesh by the computed moment.
6. ~~More bodies~~ done (body tree + Nyx, § "More bodies"); ~~6b perturbations~~ done for Nyx and Selene, nodes included (§ "6b").
   Selene and Nyx missions built (§ "Out there" missions). Next on that line: debris near the moons ignores tides;
   registered satellites (`satAt`) are still pure Kepler; more moons are one `addBody` each.
7. ~~**Sound**~~ first pass done (§ "Sound", 2026-10-08). Next on that line: per-engine voices (pitch by size), spatial audio for
   other vessels and debris, re-entry plasma crackle tuned against the heating model, a volume slider.

## The tester menu (2026-10-08, tester session; PLAYTEST #1)

Cheats for playtesting. Open the page with **`?tester`** in the URL (`index.html?tester`); a yellow TESTER badge shows at
the top, and **F2**, the badge or the Esc menu open the menu. Without the flag nothing changes: no badge, no key, no row
in Help.

**Never touches the career.** In tester mode the program saves to its own slot, `launchpad-program-tester`
(`PROG_KEY` follows `TEST.on`); `launchpad-program-v1` is neither read nor written. The menu can copy the career into the
sandbox or wipe the sandbox (both click twice, then reload). The cheat switches persist per browser in
`launchpad-tester-flags`.

| Control | What it does | Where it acts |
|---|---|---|
| Infinite money | funds never below 100,000M | `testTopUp()`: each frame, at load, after every menu action |
| Full know-how and certification | every part at use 1 and certified 100 %; flight safety signs off | `khUse`, `certOf` |
| All tools | impact prediction, maneuver planning, encounter forecasts without the logbook facts | `toolOK` |
| No ignition failures | engines always light | `igniteOK` |
| Instant stacking | a launch takes no preparation days | `R.prep` in `missionTick` |
| Epoch 1–5 | marks every mission of the earlier epochs done (`done[id].test=true`), clears later ones; range streak to 3 | `testEpoch(n)` |
| World date +1 d … +1 year | a day at a time through `advanceDays`, so budget, elections, rivals, eras and news all run | `testAdvance(d)` |
| Finish every job | facilities, design bureau, test stand, production lines, trajectory studies done now | `testFinishJobs()` |

Epoch and date are disabled during a flight (the flight's clock owns the date then).

**For other sessions.** The rules live in the SIM tester block after `advanceDays` (`TEST`, `testTopUp`, `testEpoch`,
`testAdvance`, `testFinishJobs`); the menu is after the shared keydown handler (`renderTester`). Each cheat is one read of
a `TEST` flag in your code: keep it if you rework `khUse`, `certOf`, `toolOK`, `igniteOK` or the `R.prep` line. A new
cheat = a flag in `TEST`, a row in `TEST_FLAGS`, one read where the rule lives, a check in test.mjs §37. KEYS rows can
carry `tester:true` (Help shows them only in tester mode).

**Found on the way: two missions shared an id.** Epoch 3's "Weather satellite" was `id:'weather'`, the same as epoch 1's
"Above the weather". `PROG.done` is keyed by id, so the sounding flight also ticked off the satellite and opened
Disaster watch early. Now `wxsat` (Disaster watch's `req` and the §-epoch-3 checks follow). §37 checks every mission id is
unique. Careers saved before this keep `done.weather` (the epoch 1 flight) and see the satellite as not done yet, which
is right.

**Added 2026-10-08 (QA session, QUEUE Q16):** *Go to day* N (forward runs every day's rules through `testAdvance`;
back moves only the calendar, so what happened stays and deadlines and jobs are further off), *Set funds* to any number,
negative included (it turns *Infinite money* off, or the top-up would undo it), a button per **computing era** (the date
runs on a day at a time until `compEra()` reaches it: the era follows the date and the power's lag as in play, it never
overrides them), and a folded **Missions** list with one checkbox per mission (marked `test:true` like the epoch
picker's). SIM: `testGoto`, `testFunds`, `testEra`, `testMission` after `testFinishJobs`; checks in test.mjs `qa-1`. All
of them wait while a flight is on, like epoch and date.

## The gantry no longer clips the rocket (2026-10-08, tester session; PLAYTEST #2)

**Cause.** The service gantry rolls back toward −z, open front first, yet two girders spanned that open front (at a
third and two thirds of its height). Over the 14 s roll they swept straight through every rocket, wide or narrow. A
second, smaller one: the service position was a fixed −3.3 m, so the work decks' front edge sat at z = −2.3 m, inside
any stack reaching further than that (the Crewed Lunar's boosters reach 2.75 m).

**Fix** (`buildRig`, `padRig`, `drawPadRig`): no girders across the open front; side girders along each pair of columns
instead. The service position follows the stack: `RIG.zS = min(−3.3, −(zr + 1.5))`, where `padRig` now measures `zr`,
the widest |z| reach of any part (boosters included), so the decks stop 0.5 m short of it. Narrow rockets keep −3.3 m.
test.mjs §38 runs the page's own `buildRig`/`padRig` with stubs that record every box and sweeps the whole roll-back
against each preset's envelope; on the old code it fails (the front girder reaches the Orbiter at −5.2 m).

**For visuals:** the gantry is yours. If you restyle it, keep the open front clear; §38 will tell you.

## The hold-downs follow the rocket (2026-10-08, tester session)

The open item from "The launch complex": four hold-down posts stood fixed on the pad's diagonals at 3.4 m, with arms to
the core's base, so boosters on a diagonal (radial ×4 at 45°, or three at 120° steps) had an arm through them and a post
under them. Now the posts are part of the rig (`buildRig`, mesh `RIG.posts`, drawn in `drawPadRig`) and `holdPlan`
(next to `padRig`) places them: on the diagonals if those are clear (every preset: nothing changes), otherwise the set of
four turns, 1° steps, to the angle with the most room between the parts down at clamp height. Each arm clamps the
outermost part on its line (the core, or a booster if one is still in the way) and its post stands 1.2 m beyond, never
inside 3.4 m. The pad mesh keeps no posts.

Bug on the way: the room measure first skipped only the core engine, so the core's own fins and tank (also on the axis)
counted as obstacles at every angle and nothing ever turned. It now skips everything centred on the axis.

test.mjs §39 checks arms (to 90 % of their length, short of the clamp) and posts against every part's cylinder, for the
presets and for Asparagus/Crewed Lunar with their boosters turned 45° (and one with three boosters). It fails on the
old code: an arm through the turned Asparagus's booster engine. TESTING rows 108 (gantry) and 109 (hold-downs).

## Sound (2026-10-08, sound session; open thread 7)

All synthesised in WebAudio, no samples: looped noise buffers (white, brown, and a sparse "pop" buffer for crackle)
through filters, two low sine tones for the sub-bass, a 6.5 Hz LFO for buffet, and one-shot filtered bursts with a
falling thump for events. A compressor on the master. **F4** toggles (remembered per browser); the context starts on
the first click or key, as browsers require. Render-side only: `sndTick(dtR)` is one call in `frame()` after `emitSmoke`,
outside `render()`, reading SIM state and diffing it frame to frame. No SIM changes.

**The model: the listener rides the ship, like the crew.** Two paths reach them:
- **Through the air:** loudness ∝ (thrust / 4 MN)^0.3 (Stevens' law on an acoustic power ∝ thrust), × √(ρ/ρ₀) (the
  same source power in thinner air makes a smaller pressure swing), × a ground-reflection boost below 150 m, × a Mach
  factor that drops 80 % between Mach 0.9 and 1.3 (the exhaust's noise can't run forward faster than sound). Its lowpass
  closes from ~3.6 kHz at sea level to ~550 Hz at ρ/ρ₀ = 0.05: thin air sounds dark before it sounds quiet.
- **Through the structure:** a 110 Hz-lowpassed rumble whenever an engine burns, at any altitude. In vacuum that is all
  there is. Apollo crews described the engines as felt more than heard; this is that.

Plus: wind from dynamic pressure (bandpass rising with airspeed, full at 40 kPa), buffet (the wind amplitude-modulated
near Mach 1, Gaussian in M with σ = 0.12), a high hiss when the hottest part passes 35 % of its limit under q, an RCS
hiss while jets fire, crackle weighted to solid motors (escape tower included).

**Events** (diffed, so they need no hooks in the SIM): fewer parts on → separation thunk; an engine burning that wasn't
→ ignition (a sharp crack for solids, a soft whoomp for liquids); `chuteA` crossing 1 (drogue) and 7 (main) m² → chute;
`landed` turning true → touchdown thump scaled by `touchV`; a new entry in `booms` → a blast, through `sndBoom`: our own
ship is heard through the structure even in vacuum, anything else only through air, **late by d/340 s**, with gain
∝ √air · 250/(250+d) and its highs eaten with distance. Switching ship, reverting or a new flight resets quietly.

**Measured** (test.mjs sound-1, an Orbiter ascent on the SIM, the mix sampled every second): roar 0.41 at the pad →
0.25 at Mach 1 (5.8 km, buffet 1.0) → 0.04 at 10.5 km (supersonic) → 0.01 at 30 km → 0 by 70 km; wind 0.82 at Mach 1,
0.89 at max-q (33 kPa, T+52), 0.53 at 30 km, 0.05 at 70 km. A blast 5 km away: 0.03 of its 100 m gain, 14.7 s late,
lowpass 417 Hz. In headless Chrome on the real page: the context runs, the Orbiter at full thrust on the pad measures
−23 dBFS RMS at the master (silent at idle, −73 dB after cutoff); ignition, both stages' ignitions, separation and a
blast all fire; F4 mutes (master to 0.001) and back; leaving flight fades to 0; the map plays at 35 %.

**Negative result worth keeping:** counting active engines misses the upper stage's ignition (one engine out, one in:
the count stays 1). Events are diffed by engine identity (`p.i`) instead.

**Not judged:** whether it sounds *good*. That needs ears (TESTING row 114). Levels are first guesses: the layer gains
in `sndTick` are the knobs.

### Per-engine voices (2026-10-09, effects session for the sound beat, QUEUE Q66)
Every engine used to sum into one roar. Now each kind of engine burning gets its own band of noise (`sndVoices`, in the
pure mix block), centred on its jet's peak frequency f ≈ St·U/D (Strouhal 0.2, exhaust ~2.5 km/s, D the exit diameter):
Wren 1000 Hz, Sparrow 833, Kestrel 455, Petrel 417, Condor 403, Albatross 227. Same-kind engines are one voice (a
Heavy's three Kestrels: one voice at 455 Hz); up to four, the biggest thrust shares first; gain ∝ √share × the airborne
level, so the total power stays put. Four white-noise bandpass layers (Q 1.4) carry them (`AUD.V`); the broad roar
drops to 0.8 while voices play. `AUD.VOICES = false` for A/B.
- Checked live in the page (`AUD.lastV`); not judged by ear (no speakers on an unattended run): TESTING row 158.
- test.mjs `aerofx-3` (engine voices).
### Re-entry plasma by the heating model; sounds from elsewhere (2026-10-09, effects session for the sound beat, QUEUE Q67)
- **Plasma:** `sndPlasma(qh, va, pv)` uses the drawn shell's own rule: the stagnation flux on its log scale (15 → 160
  kW/m², capped 1.2) times the same airspeed gate around `PLASMA_V` (0.85–1.05). It plays a low rumble (brown noise
  under 260 Hz) and a crackle (the pop buffer at 1.4 kHz, ∝ level²), heard through the hull, so it doesn't thin with
  the air. Measured: a hot climb (77 kW/m² at 1 km/s) 0; onset (20 kW/m² at 2.6 km/s) 0.12; view 40 (160 kW/m²) 1.00.
  The old skin-temperature hiss stays (hot metal ticking, a different thing).
- **Elsewhere:** `sndOthers` takes other vessels burning within 30 km (the own roar's loudness law) and debris tearing
  through the air (a whoosh from its dynamic pressure, from 0.5 kPa), each falling as 250/(250+d) and needing air at
  both ends; highs fade with distance; one brown-noise layer through a stereo panner, panned by the power-weighted
  direction against the ship's right. A Heavy's dropped boosters at 18 km: 0.068. No delay for distance yet (the
  explosions have one). `AUD.Q67 = false` turns both off.
- test.mjs `aerofx-3` (plasma sound / elsewhere). Not judged by ear: TESTING row.
## The robot playtester (2026-10-08, playtest session)

Caio can't playtest for now, so this session built a machine that walks as many TESTING.md rows as a machine can judge:
`playtest.mjs`. One headless Chrome on the real GPU, driven over CDP like `shot.mjs`, but persistent: many rows per run.
A Claude session then read every screenshot against the row's "Looks right if".

**How it works.** `ROWS[n]` in `playtest.mjs` is the row table: `steps` (a string is JS evaluated in the page and its value
logged; `{shot}` captures `r<n>_<name>.png`; `{wait}`, `{key}` and `{hold}` send real key events through CDP; `{click}`
clicks an element's centre), then `checks` (expressions evaluated at the end) and `expect` (a failed one fails the row).
Before each row the page's storage is wiped, the tester flags are written by a script that runs before the page's own
(`Page.addScriptToEvaluateOnNewDocument`), the page loads with `?tester`, and `views.js` plus a helper object `PT` are
injected. Unless the row asks for the gate, `PT.start()` picks the first career start and goes to the Assembly. `PT` has
`preset`, `launch`, `fly(cond, tmax, {ascent, autostage, each})` (advPhys in a loop: kick at 8 s, then Prograde, staging
on burnout), `alt/agl/aoaDeg/orbit`, `look(yaw, pitch, dist)` (HUD back on, camera set), `log` (every `HOOK.msg` and
`HOOK.news` with its sim time), `hud()`, `msg()`. A row that needs the game's own frame step (tape recording, warp,
keys) uses `SIM`: the live loop is frozen and `simulate(1/60)` is called by hand. Exceptions thrown in the page fail
the row. Output goes outside the repo: `C:/Users/caioa/dev/playtest-out/` (PNGs, `results.json`), `PT_OUT` to change it,
`PT_IGPU=1` for the integrated GPU. `node playtest.mjs --eval "<js>" …` is a probe: a fresh tester page, each expression
evaluated and screenshotted.

**Coverage.** 58 of the 113 rows judged: 37 ✓, 4 ✗ (104, 110, 84, 97), 17 ~ (mostly "the numbers are right, the feel
needs a human"). Skipped, and why: the hand-flying and feel rows (1, 12–16, 101, 69, 71, 73, 76, 78, 89, 99); mouse work in
the builder (17–21, 24); docking, stations, rovers in the field and the moons (49, 50, 53–74 apart from 51), each a
long multi-flight setup worth its own driver; city and range-safety flights (16, 32, 111–113); the HUD with everything at
once (98). Rows 23, 31, 45, 80, 81, 83, 92, 94 were left for lack of a reliable setup in the time-box.

**What it found** (PLAYTEST #15–#23): the TESTER badge over "Save as autopilot" (#15); the news box over the flight
readout's altitude (#16); "plasma blackout" and a plasma shell on an ordinary ascent at Mach 3.5 (#17); holding a pitch key
with SAS off spins the Orbiter's upper stage until it tears apart before the wheels fill (#18); the Link row says "no
station in view" for 2 s after liftoff (#19); LAUNCH and the site picker below the fold of the assembly panel (#20); a
landed flight isn't settled until the next launch, so refund, know-how and logbook news arrive late (#21); `refView(8)`
throws and the gantry blocks close-ups 4, 6, 9 (#22); two builder wording nits (#23). No page exceptions anywhere else.

**Measurements** (RTX 5050 laptop, headless, 1280×800). Page load to first row ~35 s on a fresh profile (shader
compiles), then 4–12 s a row; the whole table in ~7 min. A 1,360 s parachute hop runs in about a second of advPhys.
Heavy at night, engines lit on the pad: RTX median frame 8.3 ms (vsync 120 Hz, GPU 4.7 ms); Intel iGPU median 36.6 ms,
p95 39.4, adaptive resolution still at 100 % after 3 s (TESTING row 47 had ≈26 ms). Physics numbers are in the rows'
*Robot:* notes (turn times match the builder within 10 %; boosters leave at 2.4 m/s; polar launch 27.2°; the impact
predictor lands within 50 m; an autopilot replay lands on the recorded position to 0 m).

**Negative results and traps.**
- `shot.mjs`'s flags (`--use-angle=d3d11 --enable-gpu`) put headless Chrome on the **Intel iGPU** on this laptop (GPU_NAME
  "Intel", 24 fps idle). `--force_high_performance_gpu` gets the RTX (120 fps). `playtest.mjs` adds it by default;
  `shot.mjs` still doesn't, so its screenshots have been iGPU renders.
- In `--headless=new` requestAnimationFrame ticks at full rate (unlike the hidden preview pane), but long flights are
  still driven with advPhys loops. That skips what the frame loop does: tape recording (`tapePhys` lives in `simulate`),
  message timers (a stale "Liftoff!" stays on screen), the HUD's impact row (computed on frames: it shows "—"), and the
  gantry's roll-back clock, which starts at the first render after launch. Render once right after launch, and use the
  `SIM` helper when the row is about those.
- Every launch moves the world date (prep, pad wait, the next whole day), so weather differs between launches. Separate
  climbs to 36 and 44 km looked like the cloud deck vanished at the hand-over; the same moment rendered from 36–44 km
  shows no change. Compare renders at one moment.
- The Program and tester panels re-render on every click, so a saved element reference goes stale after one click:
  query again each time. `go('program')` while already there is a no-op, so the header isn't refreshed after a
  `testAdvance` called from JS.
- Escapes inside the row table's template literals get eaten (`'\n'` became a real newline, `\s` became `s`): use
  `String.fromCharCode(10)` and `[^]`.
- Reading screenshots costs context: 2×2 half-size contact sheets with a crop for details made ~300 images reviewable.

**Rerun.** `python -m http.server 8799 --directory <repo>/explorations`, then from `explorations/launchpad`:
`node playtest.mjs` (all rows) or `node playtest.mjs 104 110` (some). Add a row: a `ROWS[n]` entry next to its area's
rows; a row that needs two setups can use a string key (`'82b'`).

## PLAYTEST sweep #15–#22 (2026-10-08, fixes session)

Six items the robot playtest filed (PLAYTEST #15, #16, #19, #20, #21, #22), plus #8, which turned out to be the same
layout bug as #15. Code commit `5eb1bd4` on branch `fixes`. Checks: test.mjs § `fixes-1` (all four checks fail on the old
page, pass on the new one), and the robot rows 4, 9, 25, 35, 48, 77, 84, 96, 110 rerun on the RTX (screenshots in
`C:/Users/caioa/dev/playtest-out/fixes/`, outside the repo).

- **#8 and #15: the toolbar and the TESTER badge.** The flight toolbar `.tr` never had a `position`, so its `right/top`
  did nothing: it sat in the page flow at the top left, half under the readout, and the badge (top centre) landed on
  its last button. `.tr` is now absolute at the top right (wraps when the window is narrow, keeps 290 px clear for the
  readout). `hudLayout()` moves the badge into the toolbar as its last item in flight, and back to the top centre on the
  other screens (Program, Assembly, Rover yard leave it free).
- **#16: the news box over the readout.** The news was centred at a fixed `top`; a readout with long rows grows to
  ~510 px and reached under it. `hudLayout()` (each HUD update at 10 Hz, each headline, each screen change) gives the
  news a lane: centred if that clears everything, otherwise from 10 px right of the readout to 10 px left of the
  maneuver-node or rover panel, and below the toolbar where they overlap. With less than 240 px beside the readout it
  goes under it. Off the flight screens the CSS position is restored. Checked on a landed capsule (Passenger row) and a
  Lunar climb, at 1280×800 and 1000×700.
- **#19: "no station in view" for 2 s after liftoff.** Not the terrain mask but the minimum elevation: the pad's
  station is the pad itself, its antenna `GS_MAST` = 20 m up, so a rocket still below the mast top is at negative
  elevation, under `STA_MIN` (5°). The elevation limit and the horizon mask describe long paths that graze distant
  ground; within `GS_NEAR` = 2 km of the antenna the path is direct, so `gsSees` returns true there. Measured: Link
  "on the ground" → "Fenfen Cape" at T+0 (first airborne step 7 m up); before, "no station in view" until T+2.0, 19 m.
  `gsSees` also serves satellite downlinks; nothing in orbit comes within 2 km of a station.
- **#20: LAUNCH below the fold.** The assembly's right panel scrolled LAUNCH to y ≈ 1,160–1,350 px. LAUNCH and a
  one-line site summary (`#siteLine`: site · latitude · weather, a ⛔ when access or size refuses it, a downrange
  note) now sit in `#edFoot`, `position: sticky; bottom` inside the same scroller, so nothing else in the panel moved
  (the robot's `#editor .right` scroll still works). Measured at 1280×800: LAUNCH at y 735–773 for all 11 presets,
  Crewed Lunar included.
- **#21: a landed flight settled only at the next launch.** `missionEnd` ran from `resetShip` (LAUNCH, Revert) and,
  through `editorChanged`, on entering the Assembly; going to the Program left the flight open. Now `go()`, leaving
  flight or map for any other screen, calls `flightLeave(S)` (in the SIM: the player leaving a flight ends it there;
  it is `missionEnd`). `missionEnd` already returns at once for a settled flight (`R.ended`), so Revert, a second
  leave and the next launch pay nothing more. test.mjs: a Sounding flight landed and left pays its refund (+13M), counts
  the flight and raises Sparrow know-how 0.20 → 0.35 at once; then revert + leave + relaunch leave funds, flights and
  know-how exactly as they were. The robot's Sounding now reads `settledAtProgram: true`, funds 80 → 103.7M at the
  Program. **Economy (paused):** nothing inside `missionEnd` changed; it is now also reached from `go()`. The planned
  Debrief screen (§ "UI: screens and navigation") can hang off `flightLeave`.
- **#22: reference close-ups.** `views.js` view 8 asked for the Lunar's `t8`, gone since the resize; it centres on
  `T16` now, and a close-up whose part is missing throws a message naming it. Close-ups 4–9 set `HOOK.noRig` (checked
  at the top of `drawPadRig`; every `refView` call clears it), so the gantry, swing arms and hold-downs are hidden, and
  4, 6, 8, 9 look from the west (yaw < 0): the umbilical tower stands east of the rocket (`+X`, the arms at x = 5.5 m), so
  it is now behind or beside the part instead of in front of it.

Seen on the way, not fixed: in the robot's headless Chrome the flight readout can stay empty for ~30 s after a long
synchronous `PT.fly`, because the first `requestAnimationFrame` timestamp comes out ~30 s *before* the script's
`last = performance.now()`, so `dtR` is negative and `hudT` climbs instead of counting down. Same on the old page;
probably harness-only, but `frame()` could clamp `dtR` at 0.

## Test shards (2026-10-08, platform session; ROADMAP § Platform lane, step 1)

`test.mjs` had grown to 82 sections (84 after merging `main`), and every session paid for all of them on each edit. `node test.mjs` with no
arguments still runs everything in one process, exactly as before: **merges run that**. With arguments, `test.mjs`
hands over to `shards.mjs`, which cuts the file into sections and runs a chosen subset in a child process:

| Command | What it runs |
|---|---|
| `node test.mjs --list` | every section: position, label, line, title |
| `node test.mjs --only 12,#53,docking` | by label (every section carrying it), by `#position` from `--list`, or by a word in the header comment |
| `node test.mjs --skip 27,bodies-1` | everything but these (combines with `--only`) |
| `node test.mjs --smoke --jobs 4` | everything but the five long flights (`SLOW` in `shards.mjs`): **22 s** in 4 processes, ~55–75 s in one |
| `node test.mjs --times [--jobs 4]` | the full suite with the seconds per section |
| `node test.mjs --isolation --jobs 4 [--only …]` | each section alone vs the same section in a full run; lists any whose checks change |

**What a section is.** A comment at column 0, `// 12. Title` or `// control-3. Title`, up to the next one. Everything
before the first (the SIM, `api`, `check`) and everything after `// ==== END OF SECTIONS` (the summary, the exit code)
runs in every shard. **New sections go above that line.** A section using a top-level function another section declares
is run with it (`fly` lives in §3, so 10 sections pull §3 in). Labels repeat (§25 is four sections) because lanes
numbered in parallel; that's why selectors also take words. Renumbering would break the "§N" references in this file.

**Which sections cover what** (the lane words work as selectors: `--only "sats session"`):

| Area | Selector | Sections |
|---|---|---|
| orbits, flight, aero, heating, staging (the oldest core) | `--only 1,2,3,4,5,6,7,8,9,10,11,12,13` | 13 |
| the program, contracts, money | `"(economy"` plus `14` | 15 |
| bodies, missions out there, procedures, dispatch | `"bodies session"` (`procedure` for the procedure ones) | 9 (+§3) |
| registry, rendezvous, docking, stations, rovers | `"sats session"` (`docking`, `station`, `rover`) | 18 |
| attitude control | `"control session"` | 5 |
| the world, sites, ground stations, recovery | `"terrain session"` | 7 |
| logbook, ground stations, registry (planning) | `"planning branch"`, `logbook` | 3 |
| builder trees, staging editor, canted engines | `#16,#18,#19,#21` | 4 |
| tester menu, gantry, hold-downs | `"tester session"` | 3 |
| screens and keys (KEYS ↔ Help, `go()`) | `"ui session"` (§32 at `#53`) | 1 |
| sound | `sound-1` | 1 |

**Measured (2026-10-08, other sessions running).** The full suite takes **286 s**, not 8 min; 74 % of it is two
sections: the crewed Selene landing (§27, 111 s) and the ladders (bodies-1, 102 s). Then §14 the program (9 s),
bodies-2 (6 s), §28 procedures (5 s); the other 77 sections take 53 s together, most under a second. In one process
there is ~30 % run-to-run noise from machine load.

**Every section stands alone, after two fixes.** `--isolation` ran each of the 82 sections by itself: 81 matched the full
run. §14's *budget day* check failed alone (+16.5M where it needs > 16.5M): `worldTick` seeds its dice from
`PROG.wseed` and the cycle's phase `PROG.cyc` carries over, and §14's `fresh()` resets neither, so the grant depended on
what earlier sections had drawn. The check now pins both (`P.wseed = 4242; P.cyc = π/2`). That was a latent flake in the
full run as well: any section added above §14 that drew from the world's dice could have tipped it. **Economy:** the
check is yours; the pin is test-only. **Everyone:** a new section should pass alone; `node test.mjs --isolation --only
<it>` checks that in a few seconds.

The second fix came from `--jobs` itself: a full run in 4 processes failed §18 *career offers* ("ordinary: hire"), a
check that had passed both alone and in the full run. Its `fresh()` pins `wseed` but kept the PROG fields it doesn't
name (`cyc`, `bailRecent`, …), so its outcome depended on which sections ran before it in the same process. `fresh()` now
deletes every PROG key first (as §24–§28 do when they restore a save). Alone-vs-full can't catch this kind; a parallel
run (different neighbours) can. After both fixes, a full run passes sequentially and in 4 processes (286 s → 136 s;
§27 alone bounds it at ~110 s).

**Shared state is the thing to watch.** The SIM keeps one `PROG`, one `HOME`, one `api.S`/`api.t` per process, and
sections hand them on. A check that sets only the fields it cares about is betting on its neighbours. Start from a
whole reset, or use an own SIM instance (`new Function(src + …)`, as the sats and tester sections do). The file split
(ROADMAP step 3) should give tests a `freshSim()` that makes the second the easy way.

**Negative result.** "One quick section per area" was the plan for `--smoke`; measuring showed the cheap sections are so
cheap that "all but the five slow flights" covers 77 sections for the same minute, so smoke is defined by exclusion.

## The file split (2026-10-08, platform session; ROADMAP § Platform lane, steps 3–4)

`index.html` was one 6,700-line, 780 KB script that every lane edited, so every merge conflicted inside it. Its script is
now **21 classic scripts** in `sim/` and `app/`, loaded in order by `index.html`. Nothing else changed: the same code,
in the same order, cut at existing section headers. There's still no build step, and the page still opens from `file://`.

**Why classic scripts and not ES modules (the ROADMAP said modules).** Modules would need an import and an export for
every name used across files, and imported bindings are read-only: the many `let`s reassigned from other parts of the
code (`simT`, `S`, `HOME`, `mode`, …) would break. That's a rewrite, not a split. Classic scripts share one global
scope exactly as the single script did, so the split is mechanical and its oracle is exact. Modules can still come
later, one area at a time, once an area's cross-file names are few.

**How it was done.** `archive/launchpad-split-2026-10-08.mjs` (one-time; kept for the record) cut at header lines found
by their text, gave each file after the first a two-line prelude and `'use strict'`, and pointed the Node tools at
`page.mjs`. Checks, all passed:
- `page.mjs` puts the files back into one text, and that text was the old `index.html` plus the preludes, byte for byte.
- The full suite on the split tree passed (the oracle).
- Every SIM file loads as its own script, in page order. That is test `platform-1`, which stays.
- The robot playtester walked every row on the split page, comparing console errors against the pre-split page.

| File | Lines | Holds | Usual lane |
|---|---|---|---|
| `sim/core.js` | 155 | vectors/quaternions, the body tree, perturbations, Kepler (opens with `SIM BEGIN`) | space |
| `sim/vessel.js` | 748 | parts, design v2, resources, the vessel, avionics, wheels, aero, structure, gimbal, heat | vehicle |
| `sim/flight.js` | 241 | SOI changes, ground contact, abort, legs, maneuver nodes, impact prediction | vehicle / space |
| `sim/world.js` | 282 | the world, launch sites, recovery, ground stations, plasma blackout | world |
| `sim/program.js` | 643 | missions, budget, calendar, tester menu, out there, staged pay, powers, industry, know-how, stand, development, facilities, compute, timeline, dispatch, deviation, production | economy |
| `sim/atlas.js` | 40 | the atlas grid | world |
| `sim/contracts.js` | 243 | contracts, sanctions, the race, ownership, decisions | economy |
| `sim/space.js` | 647 | registry, rendezvous, contact, docking, fleets, bay, stations, arm, moonbases, moon orbits, RCS | space |
| `sim/logbook.js` | 49 | the logbook, tools gated by it | economy |
| `sim/debrief.js` | 40 | the flight's debrief record (`debSnap`, `debriefOf`, `debPaid`) | flow |
| `sim/procedures.js` | 338 | stepping, flight tapes, procedures, headless flights | space |
| `sim/rovers.js` | 349 | rovers (ends with `SIM END`) | space |
| `app/gl.js` | 1,532 | WebGL2, shaders, meshes, planet/sky/plume/pad drawing | look & sound |
| `app/state.js` | 111 | app state | flow |
| `app/editor.js` | 127 | the editor UI | vehicle |
| `app/input.js` | 30 | input | flow |
| `app/screens.js` | 160 | `go`, `KEYS`, Help, overlays | flow |
| `app/rover-yard.js` | 195 | the Rover yard | space |
| `app/sound.js` | 81 | sound (the pure `SOUND MIX` block is inside) | look & sound |
| `app/loop.js` | 43 | `frame()` | flow |
| `app/render.js` | 347 | `render()`, bloom | look & sound |
| `app/program-ui.js` | 345 | the Program screen: contract board, satellites, logbook, era map; the start-up calls at the end | economy / flow |
| `app/debrief.js` | 30 | the Debrief screen (`renderDebrief`, Fly again, the End flight button) | flow |

**Working in split files: the rules.**
- **Find a function** with `grep -n "function name" sim/*.js app/*.js`. Markers (`SIM BEGIN/END`, `SOUND MIX`) are where
  they were.
- **The SIM stays pure:** `sim/` files touch no DOM or GL. The tests run them headless, as before.
- **Order matters across files.** Function declarations are hoisted only within their own file, so code that *runs at
  load time* (a top-level `const x = f()`) may only call functions from its own file or earlier files. Calls inside
  functions that run later are fine, whichever file they're in. `platform-1` catches a breach in `sim/`. In `app/`, the
  page throws on load, and the robot's console errors will show it.
- **A new file** gets the two-line prelude, `'use strict';`, and a `<script src>` line in `index.html` in the right
  place. `platform-1` fails if a file isn't loaded or isn't strict. Prefer a new file over growing `app/gl.js`.
- **Node tools read the page through `page.mjs`**: `pageSource()` is the old one-file text (the scripts inlined in page
  order), so `html.indexOf('// ==== SIM BEGIN')` and the regexes over page code work as before. `pageScripts()` lists
  the files.
- **Work from before the split:** every lane branch was merged into `main` before the split, so there should be none.
  If a stray pre-split change turns up anyway, don't hand-port it. Run the split script on that branch's `index.html`
  (it cuts at the same headers). The result is that branch's own `sim/`/`app/` files. Then three-way merge each file
  (`git merge-file`), with the split of the merge base as the base. This was done once, for bodies' Q13, pushed during the
  freeze. The quicker equivalent: three-way merge the *old-style* pages (`git merge-file` on the branch's, the base's and
  the pre-split `index.html`, all LF), then split the result. Its 53 changed lines landed cleanly in `sim/procedures.js`.

## The new-career robot run: M1's finish line (2026-10-08, QA session; QUEUE Q55)

`node playtest.mjs m1` plays a **new career with no tester flags**, the way ROADMAP § M1 words the finish line: it clicks
through the first-run gate (agency, the default power), flies a **Sounding** for *Above the weather*, leaves the flight
for the Program, then flies the **beeper** to orbit and leaves that flight too. It's written ahead of M1, so it fails
until M1 is done. Each expectation names the item that makes it pass:

| Check | Passes when | First run (`5ed4bf2`) |
|---|---|---|
| `tester` | the page isn't in tester mode | ✓ |
| `weather`, `beeper` | both missions are done after two flights | ✓ (day 57, 157M left) |
| `escPauses` | the sim clock doesn't move for 2.5 s with the Esc menu open | ✗ 2.5 s ran (flow Q39) |
| `debrief` | a debrief screen shows after each flight is left | ✗ none yet (flow Q2) |
| `boxes` | no two visible panels overlap by ≥ 40 px² on the program, assembly, flight, orbit and after screens at 1280×800 | ✗ PLAYTEST #25 (builder key strip), #26 (`#msg` over the readout) |

What it found on the way: **no preset can fly the beeper** or the passenger orbit (PLAYTEST #24, P1 for the
presets-only route), so the robot swaps the Orbiter's pod for an instrument package, which is what `career.mjs` assumes.
The Program after a flight draws the flown ship with "NaN%" joint labels (PLAYTEST #27).

**How it judges.** The ascent is `fly_ladder.mjs`'s `handAscent` run in the page (`PT.ascent`): it sets the attitude
directly, so the run proves the career path and the screens, not that a person can fly it on gyro-era SAS (TESTING row
101 stays a human row). The box check (`PT.boxes`) takes every visible positioned element with text, drops the
full-screen layers (`#hud`, `#prog`), keeps the outermost ones and lists each overlapping pair. `PT.debrief` accepts a
screen named `debrief` or any visible element with `debrief` in its id or class: **flow, name Q2's screen that way** or
change the check with it. Shots in `C:/Users/caioa/dev/playtest-out/` (`rm1_*.png`). A run takes about a minute.

**The M0 re-run (QUEUE Q29, same session).** `node playtest.mjs 104 110 84 97 122 5 96 48 9 35` after fixes, Q14, Q17 and
Q20: every fix holds (PLAYTEST #15, #16, #17, #18, #21, #22). Two new rows: **97** ends a flight three ways (landed,
crashed, left in orbit) and checks each is settled when you leave it; **122** flies the Heavy and the Asparagus through
max heating and records the Link row and `plasmaHeat` (no blackout, shell 0; heat peaks at 1.0–1.4 km/s, the shell
starts at 1.9). The one thing still in the way is a line, not a box: `#msg` is drawn over the readout (PLAYTEST #26).

## Vehicle parts: landing legs (Q31) and power, computer, radiator (Q34) — plan (2026-10-08, vehicle session; nothing built)

Planned without running the game (Caio: no heavy GPU for now). Both are ⚙ work: physics plus headless checks; the look
beat draws the new parts afterwards. Numbers marked *tune* are starting points to measure, not results.

### Q31 — landing legs

**Why now.** § v1.37's contact model already makes legs worth having: with no legs a stack's footprint is its bottom
rim, so the Orbiter (1.25 m base, CoM ~5 m up) topples on a 12° slope (atan(r/h)). Legs are only a wider footprint,
plus a place for landing loads to go.

**The part.**
- `leg`: `kind:'leg'`, `surf:true`, `noAero:true`. It mounts on a part's side like `rfin`, so the builder's radial
  count (`at.n`, 3 or 4) gives a symmetric set for free (`layoutDesign`'s surface-part branch).
- Geometry: the root is on the host's skin; the foot sits `reach` out along the mount's normal and `drop` below the
  root. *Tune:* reach 0.9 m, drop 0.8 m, so 4 legs on a 1.25 m body put the feet at r ≈ 1.5 m, 0.8 m below the rim.
- Mass 0.04 t each. Price 1.5. `complexity` tier 1 (`sim/program.js:317`).
- Joint ratings sized so a set of 4 survives ~6 m/s vertical at the stack's design mass and snaps a leg around ~9
  (*tune* by measurement). Then a hard landing breaks a leg and the stack tips over, with no special rule: the
  contact forces are already part forces (`p.F`/`p.L`) that the structural check reads.
- **Deployable:** stowed for launch, deployed by a key (flow picks a free one; `G` if it's free). Stowed legs add no
  feet. **Default:** deployable. Fixed legs would also need the pad and the rig to clear them.

**Contact changes (`sim/flight.js` `footPoints`, one function):**
- A deployed leg adds **one** contact point, at its foot, instead of the 4 rim points every other part gets.
- `yb` (the lowest point) is taken over the feet as well as the rims, so with legs down the rims (≥ 0.8 m higher)
  drop out by the existing 0.5 m rule.
- The cache key adds each leg's deployed flag next to `p.on`.
- Keep the spring-damper per point as it is (2 cm static deflection, ζ 0.6). A softer leg stroke is a later
  refinement, and the verdict (`touchdown`, `TOUCH_MAX` 12 m/s + softness) doesn't change. Legs help by spreading the
  footprint and by breaking, not by a speed bonus.
- `rvFootR` (rovers) reads `footPoints`, so a lander's legs also widen the area a rover is placed around. Check that.

**Checks for `test.mjs` (a new section at the end):**
1. The Orbiter with 4 legs deployed stands on a 12° slope (it topples today) and on a slope up to atan(1.5/5) ≈ 17°.
2. The same stack with the legs stowed topples as before (no regression).
3. A 9 m/s vertical touchdown snaps at least one leg (`partLost`); 3 m/s snaps none.
4. A Selene lander (Wren + legs) lands on regolith at 15°.
5. `footPoints` with legs down returns only feet (4 points for 4 legs).

**Others:** the look beat draws the leg (folded and deployed). Until then, a placeholder box at the foot. The
TESTING row goes in when it's built: "land the Orbiter with legs on a slope".

### Q34 — onboard computer, solar panels, battery, radiator

**What exists.**
- Rovers have a power model (`sim/rovers.js` R3: panels, an RTG, a battery, a night heater). Vessels have none.
- Avionics come from the world's compute era alone (`avNow()`; v1.46). `s.av` is set at launch, so nothing on board
  decides it.
- The flight thermal pass (`thermal()`, `sim/vessel.js`) is the per-part skin model for re-entry. Orbital
  steady-state thermal is a named M2–M5 system (§ "Rich programs", step 3) with no code yet.
- The sun is fixed in the absolute frame (`SUN_DIR`), so a polar orbit whose plane is square to the sun is dawn-dusk
  forever, with no J2 needed. That's convenient for the "no eclipse" case.

**Scale (worked out from the constants; not run):** LEO here is r = 1,384 km (`TELLUS.R` + air + 10 km). That gives
a 43-minute period and a shadow half-angle of acos(√(r²−R²)/r) = 67°, so **37% of each orbit is in eclipse (16 min)**
at β = 0. A 50 W load needs 13 Wh through each eclipse. Batteries are cheap here; the panel area, generation ÷
(1 − 0.37), is what costs.

**Split into two slices (recommendation):**

*Q34a — computer, panels, battery (M2, ⚙).*
- **Parts:**
  - `ocomp` Onboard computer: inline, 0.03 t, 50 W (the Apollo guidance computer: 32 kg, 55 W). Price 8, tier 2.
  - `bpanel` Body-mounted solar cells: surface part, fixed, 0.01 t. *Tune:* 40 W in full sun, ×0.32 averaged over a
    tumbling or spinning body (Vanguard, Explorer).
  - `wpanel` Deployable solar wing: surface part, 0.03 t. *Tune:* 300 W in full sun, tracks the sun about its own
    axis (×0.9). **Deployed, it snaps above ~1 kPa of dynamic pressure** (when to deploy is a design problem,
    Pillar 2).
  - `batt` Battery: inline or surface, 0.02 t, 1 kWh (silver-zinc, ~50 Wh/kg).
- **Loads**, a `W` field on parts that draw power: computer 50, antenna 20 while it transmits, camera 15, crewed pod
  150 (a cabin). A pod or core carries its own small battery (0.5 kWh) so short flights never need to think about it.
- **The budget is a steady state first** (the lean pillar, like thermal step 1). For a design and an orbit: orbit-
  average generation (with the eclipse fraction from the orbit's β), load, and the battery needed to cross the
  eclipse. The builder shows one line: `Power +85 W / −70 W · eclipse 16 min needs 19 Wh (battery 1 kWh ✓)`.
- **In flight:** the instantaneous version, integrated like the rovers' `R.E` (`gen − use`, clamped; sunlit from
  `SUN_DIR` and the planet's shadow cylinder). One line in the step, no new state beyond `s.E`.
- **Running flat never kills (Pillar 5):** the computer drops to the analog autopilot, the antenna and camera stop,
  and on the registry the service **pauses** (the W2/Q50 pattern) until the budget is positive again. This differs
  from rovers, which freeze to death at night; leave them alone, they're the space lane's call.
- **The computer and avionics (Caio decided 2026-10-08: built into crew capsules, a part for probes):** from the
  onboard-computer era on, the **Guidance computer** generation (`AV[2]`) needs a computer on board.
  - **Crew capsules have one built in** (parts with `crew`, like Apollo's command module and lunar module). No mass
    change: it's in the capsule's mass.
  - **Everything else needs an `ocomp`, powered:** probe cores, biocapsules, instrument packages. Without one, a
    vessel flies the analog autopilot.
  - It's a pilot aid, not autonomy: the player flies either way; the computer decides which SAS hold modes exist.
  - Before that era the part isn't offered, and nothing changes.
  - Sandbox, physics tests and procedures (`s.proc`) keep the best avionics, as now (`avOf`).
  - **What it breaks:** uncrewed presets and the robot's probe designs flown after year 7 lose the target and docking
    modes unless they get the part. Update those presets in the same commit, and tell QA (`career.mjs`). Crewed presets
    are unaffected.
  - It gives the space lane a hook, `hasComputer(s)` (a crew capsule or a powered `ocomp`), for onboard autonomy out
    of contact (§ "Compute", era 3). Their Q27 and the link budget read it; Q34a doesn't build autonomy.
  - Rejected: a part for everyone (crewed ships historically had theirs built in, and every crewed preset would
    break); built into every command part (the part would only matter later, for autonomy).
- **Checks:**
  1. The steady-state budget for a LEO satellite with a wing, against a hand calculation;
  2. In flight, the battery drains through the shadow and refills in sun, and over one orbit the steady state and the
     integration agree to within 5%;
  3. A deployed wing snaps at max-q, and one deployed after fairing separation survives;
  4. Running flat drops avionics to analog and pauses a satellite's service; recharging restores both;
  5. Era ≥ onboard computers: a probe with no `ocomp` has no docking mode; a crew capsule without one has it.

*Q34b — radiators and the steady-state thermal solve (M2–M3, with the economy's orbital datacenter).*
- `rad`: a deployable surface panel. Its mass per m² and emissivity give εσAT⁴. Like the wing, it snaps in air.
- **The solve** (§ "Waste heat", step 1): heat in is α·A·S + internal power, heat out is εσAT⁴; solve for T per
  vessel. Parts get operating ranges (electronics 270–330 K). The builder shows "runs at 340 K, over the computer's
  limit".
- **Why wait:** until the datacenter exists, nothing on a vessel makes enough heat for a radiator to matter (a 50 W
  computer on a 1.25 m bus runs a few kelvin warm). Build it when the economy starts datacenter revenue (that
  section's order, step 3), so the part ships with a reason to fly.
- In the flight's `thermal()`, a radiator is only a skin part with a low `Tmax`, so re-entry with it deployed burns
  it off. The orbital solve is a separate function that shares only the radiation term.

**Overlaps (so nobody builds the same thing twice):**
- space Q27 "relay range and power": reads the power budget and `hasComputer`; it doesn't build its own.
- space Q50: power-flat pauses service the same way fuel-flat does. One "paused because…" field, shared. *(Space, v1.60: fuel-flat turned out to be physical drift, not a switch, so there is no field yet; Q34a adds `q.off`, see § v1.60 "Decisions".)*
- economy: chip sourcing (§ "Compute") can later price `ocomp` by `compLag`, like any part.
- Q10 era gates: as far as I found, parts aren't era-gated yet. `ocomp` needs its gate (`compEra() ≥ 2`) whichever
  session builds the gating.

## Plan: robot drivers for docking, stations and moons (2026-10-08, QA session; QUEUE Q30)

The rows nobody has driven are mostly ones a person can't reach quickly either: two vessels in orbit, a station, a moon.
The page has every function `test.mjs` uses (the SIM is the same globals), so **each driver copies its setup from the
test section that already proves the mechanism**, steps it with `advPhys`/`advRails`, measures the row's "looks right if"
numbers, and takes one to three shots. It doesn't fly there: setups are placed (`r`/`v`/`q` set directly), as §21–§42 do.
Feel stays a human row (59 "minutes, not an hour", 69 "learnable", 73 "fun"); the robot adds numbers and shots.

**Shared helpers** (in `PT`, next to `PT.ascent`): `orbitAt(body, km)` (the flown ship in a circular orbit, nose
prograde; §23 `craft()`, §40 `put()`), `twin(stack, offset, {fleet|registered})` (a second vessel beside it: a `FLEET`
member per §27/§28, or a registered entry per §21/§25 via `satRegister`), `dockTo()` (Docking SAS plus a proportional RCS
controller on `tgtOf(S).dr/dv`, the scripted closer §25 uses), `boxes()` (already there, for row 98).

| Slice | Rows | Setup borrowed from | Measures |
|---|---|---|---|
| 1 moons | 68, 72, 121, 73, 55, 54, 13, 125, 92 | `fly_ladder.mjs` LADDER + `procStart` phases; `flySite`; §23 nyxfind | each mission's news and pay (staged pay, row 92), Nyx's reveal text, prograde vs retrograde "Impact … (perturbed)" on the map, landing miss distance; shots of the map forecast and each landing |
| 2 docking | 56, 58, 59, 60, 61, 62, 63, 116 | §21 Rendezvous, §24 RCS, §25 Docking, §26 Claw, §22 Contact, §27/§28 fleet, §29 bay, §41 moon orbiters | time to close from 2 km and to latch, gas used, latch snap distance, push-off speeds, bump spin at 1 and 6 m/s, door swing frames, `[`/`]` labels; HUD shots |
| 3 stations | 64, 65, 66, 67, 115, 117, 98 | §30 Stations, §31 flyable vessels, §32 Arm, §33 Moonbases, §40 relay, §42 rover science | station line (crew, supplies, lab-days) after `stationTick`, Fleet → Fly round trip, arm berth/stow time, base listing, relay contact fraction over an orbit, science buttons' greyed reasons; row 98 = docked + RCS + target + three vessels, then `PT.boxes()` |

Each slice is a few rows of `playtest.mjs` (1–3 min of browser each, run as one batch when the lock is free) and the usual
write-back: robot notes in TESTING, problems in PLAYTEST. Order: moons first (the ladder is already scripted end to end,
so it's mostly reading results), then docking (the controller is the only new code), then stations (builds on both).
Not covered: anything that needs the builder to make the design (row 118's kick stage), and rows only a person can judge.

## v1.63 — dry runs as the trajectory office's study (2026-10-08, economy session, QUEUE Q46)

The bodies session's `procAdopt(stack)` (dry runs: a design with no procedure borrows a stored one if a headless run
reaches orbit) now has the economy around it, in `sim/program.js`:
- **`dryQuote(stack)`** → `{ok, why, n, cost, days}`. Priced like a trajectory study: the computing era's study cost
  × `DRY_K` = 1.5 × (1 + ¼ per extra procedure tried); days = the era's study days × the centre's speed × (½ + ¼ per
  procedure). Hand computers, one procedure: 18 days, 4.5M. Refused for a design with a procedure (its own or
  borrowed), with none stored to try, or no design.
- **`orderDryRun(stack)`** pays, lets the days pass (as launching does: you chose to wait), runs `procAdopt`, and
  **keeps the measured margin** on the provisional procedure (`proc.margin`, `proc.mT`). A failed dry run is news:
  the money is spent, the design needs a run-through by hand.
- **`dispatchEstimate`** uses the cached margin when there is one (minus the target change, as before), and a
  provisional procedure's spread is `PROV_UNC` = 0.15 wider (e.g. 43–100 % against 56–100 % for the design's own).
- **The button:** the contract's dispatch line offers *Try our procedures on ⟨design⟩* for the design in Assembly,
  whenever that design has no procedure and something is stored to try. `dispatchLine(c, stack)` takes the stack;
  `app/program-ui.js` passes `stackDef` and handles `data-dry` (two lines, flagged for flow).

Test `econ-5` (5 checks; the spread mutation-tested). A trap: in the full suite a budget day lands inside the 18 days,
so "funds went down by the price" is not a check; the test checks the price and a refusal when short instead.

## v1.62 — Enyo's ground on the CPU, the first planet (2026-10-08, world session, GROUND.md G7)

Enyo (Mars, SYSTEM.md § Enyo), built and measured headless like Selene in v1.58, at Caio's request. **Not live:** no
Enyo exists in the body tree yet (space lane, Q87), so the recipe hangs on a stub in `sim/ground.js` (`GROUND_STUBS.Enyo`:
R 678 km, g 3.72, SYSTEM.md's numbers). When the space lane adds the body, it takes `ground: ENYO_GROUND`.

**Shared first.** The crater bands now take a body's radius, crater density `c`, a hash salt (so bodies don't share
craters), an erosion exponent (freshness = hash^frPow) and `thin(centre)`, the chance a crater is missing there. Selene's
recipe runs through the same code **bit-identically** (3,000 heights before and after, 0 differ). A recipe can now carry
its own surfaces: `surfaceAt` asks `b.ground.surf(pf)` off Tellus, and falls back to `SURF_MOON`.

**Enyo's map**, in order (heights above R, the datum):
1. southern highlands, +1.2 ± 1.2 km, with old, worn craters: c 0.02, Mars's highlands, a third of the Moon's. Simple
   turns complex at 7.8 km (Mars: ~7 km).
2. Hellas, 520 km.
3. The northern lowlands flooded to −3.2 km over a warped dichotomy line.
4. The Tharsis bulge (+4.5 km), with:
   - the giant shield: 340 km across, 14 km above its plains on a 3 km basal scarp, a summit caldera;
   - three shields in a line, and Elysium.
5. The canyon: a great circle 1,400 km long (a third of the way round) at 12°S, up to 5.5 km deep, its walls terraced in
   550 m layers (the layered sediment). It cuts the highlands, then opens into the lowlands, as Valles Marineris does
   into Chryse.
6. The young craters.
7. The polar caps: a 2.6 km ice dome in the north, a smaller one in the south.
8. Dune fields (400 m apart, up to 25 m high, a steep lee) in an erg round the north cap, on Hellas's floor and in the
   canyon. They're procedural, aligned to one fixed 3D direction so they have no longitude seam.

Surfaces by unit:

| Unit | Surface | μ | Notes |
|---|---|---|---|
| polar ice | water ice | 0.25 | |
| dunes | dune sand | 0.5 | soft |
| volcanic | basalt | 0.7 | |
| canyon | layered sediment | 0.6 | |
| lowland plains | dusty plains | 0.6 | |
| highlands | dusty regolith | 0.6 | |

**Measured** (`node study_ground.mjs enyo`, ~5 s):

| What | Number |
|---|---|
| Bake, sample | 1.2 s (4.2 km a texel); one height 3 µs |
| Relief | −5.3…+12.3 km (recipe `top` 15 km) |
| Units | highlands 51 %, lowland plains 37 %, volcanic 6.7 %, canyon 1.9 %, polar ice 1.7 %, dunes 1.1 % |
| Craters ≥ 1 km per 1,000 km² | highlands 19.6 (Mars: ~10–20), lowlands 5.5, volcanic 1.1, ice 0.9 |
| Slopes, highlands | median 0.9°, p99 29°, past TOPPLE 2.0 % |
| Slopes, lowlands | median 0.2°, 95 % under 5° (the landing ground) |
| Slopes, canyon | p90 25°, past TOPPLE 11 % (terraced walls) |
| Slopes, polar ice | p99 9.6° |
| Seams | steepest 0.5 m step on cube edges 35° (anywhere: 40°) |

**Negative results:**
- **East is decreasing longitude** (NOTES § v1.25 warned). The canyon set off "east" along `cross(Y, start)` and ran into
  Tharsis, which filled half of it in. It now heads away from Tharsis.
- **A canyon along the dichotomy line is half a canyon.** At 6°S the warped lowland edge reached the equator, and for
  ~700 km one wall was lowland plain. The canyon is now at 12°S and the warp is gentler. The test measures depth below the
  higher wall, since at its mouth one wall *is* lowland, as on Mars.
- **One unit can hide another.** The canyon's floor is a dune field, and dunes were classified first, so the canyon came
  out as 0 % of the globe. It has its own channel now.

**Tests:** `ground-3`, 7 checks:
- not live, baked lazily;
- bounds and counts (c scales λ);
- the dichotomy;
- the giant shield;
- the canyon (3+ km below its higher wall for 1,220 km);
- the caps and surfaces (Selene still lands on regolith);
- no seams.

Mutations caught: no surfaces, the canyon pointed back into Tharsis, no shield. Full suite 478 pass, 0 fail.

**Not yet:**
- Enyo in the body tree (space);
- its look (Q81, after Caio's picks from Q71); the shader (G3);
- dust storms (weather, not ground);
- the caps' spiral troughs, and seasonal CO₂ frost (M5 seasons).
- **Next planets, in GROUND.md's order:** Hesper, Astraea, Hyperion's moons, Erebus.

## v1.61 — landing legs, and a contact model that holds wide feet (2026-10-08, vehicle session, QUEUE Q31)

Built to the plan above (§ "Vehicle parts", Q31). Headless only; nobody has seen it drawn yet (TESTING row 135).

**The part** (`PARTS.leg`, `sim/vessel.js`): a surface part, mounted in sets with the builder's radial count. 0.05 t,
price 1.5, complexity tier 1, palette *Surface*. Stowed for launch; **Y** in flight puts all legs down or up (`legOp`,
recorded on autopilot tapes as op `G`). Deployed, the foot stands 1.5 m out from the skin and 1.0 m below the leg's
bottom. Joint ratings C 900 · T 600 · S 240 · B 80. The legs have no drag and no animation yet. The mesh in `app/gl.js`
is a placeholder (a strut along the skin, or two struts and a pad), for the parts & pad beat to replace.

**Contact** (`footPoints`): a deployed leg is one point, at its foot; a stowed one is none. The lowest point counts the
feet, so with legs down the rims (a metre higher) drop out by the existing 0.5 m rule.

**Measured** (pod + 1 t tank + Wren, 2.3 t, four legs on the tank: feet at r 2.1 m, centre of mass 2 m above them):

| Ground | Bare (rim of the Wren) | With legs |
|---|---|---|
| flat, 1 m/s | lands | lands |
| taiga 13°, 15°, 20° | topples on all three | lands, leaning 13° / 16° / 21° |
| flat, 8 m/s | — | lands, leg load 0.9 of rating |
| flat, 9.4–11 m/s | — | legs snap, it goes over |

The full Orbiter (13 t, centre of mass 7.6 m above its feet) gains little on slopes from legs on the Kestrel: its
footprint can't beat atan(1.3/7.6) ≈ 10°. On the flat, standard joints snap at 4 m/s, reinforced ones too, and
**heavy** joints (×4) take 4.6 m/s. So legs are a lander's part, and a heavy stack pays for heavy joints.

### The contact model needed three fixes for wide feet (terrain session: please read)

All three are in `groundContact` (`sim/flight.js`). Every contact point used **a quarter of the vessel's mass**
(`mPer`) to size its spring, damper and friction cap. That is right for the stack moving as a whole. It is wrong for
a point far off the axis, where the mass that point actually moves (rotation included) is much smaller: ~73 kg
instead of 578 kg for the lander's feet. Each point now uses its **effective mass** along the normal (`mN`) and along
the slip (`mT`): 1 / (n · (1/M + |r × t|² / I)).

1. **Friction pumped a yaw spin.** The old cap (stop the slip in ~2 steps through `mPer`) overshot every step for an
   off-axis point and rectified into a steady spin. It was there before legs: the bare Orbiter given 0.3 rad/s slowed
   to 0.001 and spun back up to 0.27. With legs (feet 7× farther out) it started on its own at touchdown and never
   stopped (0.31 rad/s).
2. **The normal damper overshot.** c·dt/m was ~4 for the lander's feet, so it chattered until it toppled on the flat.
   The spring and damper are now capped at 0.5·mN/dt² and 0.5·mN/dt. The halving matters: under a tall stack the
   normal and friction forces both push on pitch, and at full gain each was stable alone but together they rang at a
   two-step period (`s.w` flipping sign every step while the attitude stood still).
3. **Stiction.** Friction was viscous with a cap, so anything on a slope crept. With the old, too-large cap the creep
   was a few mm/s and passed as rest. With a correct cap it was 0.5 m/s. Each point now holds a planet-fixed anchor
   where it first touched: a tangential spring (≤ 0.25·mT/dt²) plus a damper (≤ 0.5·mT/dt), capped at μ·Fn. Past
   the cap the point slides and the anchor follows, so a slide is Coulomb as before. The anchor clears when the point
   leaves the ground.

For a stack on its own narrow rim almost nothing changes (mN ≈ mPer there). The §25 checks (ice slides, snow, sand
and basalt verdicts, the Orbiter toppling on 12–17°) still pass.

**Tests:** `test.mjs` section `vehicle-1`, 5 checks: feet replace rims; the lander topples bare and stands with legs
on 13° and 20°; 8 m/s holds and 11 m/s snaps; spun at 0.3 rad/s, the Orbiter and the lander both land; a tape replays
the legs.

**Not yet:**
- legs going down by themselves in procedures (`landAt`), and in the robot's landings;
- a softer leg stroke (a crush-core damper) for a speed bonus;
- a deployed state that survives a vessel leaving the flight (`vesselOf`'s `vst`; landed vessels are pinned, so it
  only shows if one is re-flown);
- drag on deployed legs;
- sizes (a 2.5 m class leg).

**Q30 slice 1, moons: done (QA session).** `node playtest.mjs 68 72 55 73 125` (about 3½ min in all). The page fetches
`fly_ladder.mjs`, cuts its Node-only tail, imports it from a blob URL and runs `flyLadder`/`flySite` with an `api` made of
page globals and a dummy `HOOK`, so the real HUD, news and map show what a player would see. Every ladder mission passes.
Staged pay reads right (TESTING 92 ✓), the Nyx reveal works, the prograde Nyx control is wrecked in 2.5 days, and a
twice-flown landing comes down 6.7 m from its point. Found: staged pay for a mission nobody flew (PLAYTEST #28), weighing
and flying past Nyx pay together (#29), Selene's first orbital period is logged mid-capture (#30), map labels pile up at
the top-left corner (#31), and a sun-behind lander on Selene is a black silhouette (#32). Slices 2 (docking) and 3
(stations) are still open.

**`shot.mjs` on the RTX (QUEUE Q28).** It now passes `--force_high_performance_gpu` like `playtest.mjs`: WebGL reports the
"NVIDIA GeForce RTX 5050 Laptop GPU" by default and the Intel iGPU with `SHOT_IGPU=1` (`SHOT_FLAGS` still overrides).

**Q30 slice 2, docking: done (QA session).** `node playtest.mjs 59 60 61 56 62 63`. The scenes are §22/§25/§27/§29's,
placed in the page, and `PT.dockIn` is a scripted pilot: Docking SAS plus bang-bang RCS on the target's position in the
ship's frame. It latches from 50 m in 3.5 min on 6.5 kg of gas. Bumps, undocking, vessel switching and the bay all behave
(TESTING 56, 58–63). Worth knowing: the RCS budget is 4.8 m/s of Δv, so a 300 m approach at 2 m/s uses 85 % of it.
Row 116 (docking at Selene) and the claw are left for slice 3. Run the slice by itself: when two sessions' Chromes started
together, row 62 stalled for minutes; alone it takes 49 s.

**Q30 slice 3, stations: done for rows 60 (claw), 64, 66, 67, 98 (QA session).** `node playtest.mjs 60c 64 66 67 98`.
The setups are §26, §30, §32 and §33, and the Program's Fleet tab is read after the flight is left. Everything works as
specified (TESTING notes). Still undriven: 65 (crew rotation), 115/117 (relay and rover science on Selene), 116 (docking
at Selene). Each needs a rover or crew set up on another body, and is the next driver if Q30 is extended.

## The tester's "go to body" view (2026-10-08, QA session; QUEUE Q79)

So the look items for SYSTEM.md's bodies (Q80–Q85) have something to paint before M5 puts the planets in the sky. Tester
menu → **Go to body** (or `refView(200 + 3·i + k)`, i in `BODY_CAT` order, k 0/1/2 = near at 1.6 R, whole disc at 4.5 R,
far at 30 R). ◀ ▶ change body, 1 2 3 change distance, drag turns the camera, Esc returns.

**How.** `app/bodyview.js` (new, loaded last). `render()` hands it the frame while it's open (one line at the top), so
`gl.js` isn't touched. One full-screen fragment shader ray-traces the body in body radii: an ellipsoid (flattening along
the spin axis), the spin axis tilted about X, a ring annulus in the equatorial plane with the planet's shadow on it and
its shadow on the clouds, latitude bands and a limb haze. `BODY_CAT` holds SYSTEM.md's radius and tilt for all 11 bodies,
and test.mjs `qa-2` reads SYSTEM.md and checks them. **Placeholders:** Hyperion's flattening 0.08 (SYSTEM.md gives none;
from its 3.3 h day), and every colour, band and haze value. Those belong to the look items. When a body gets a real look,
it should move into the main renderer (or this shader), and its row here should stay the place its numbers come from
until the space lane gives the catalogue a home in `sim/` at M5.

**Not yet:** no ground detail, no moons beside their planet, no star in the frame, and one fixed sun direction (from the
camera's right).

**Selene rows 115 and 117 (QA session, the Q30 follow-up).** `node playtest.mjs 115 117` puts a rover in `PROG.rvOut` at
ground height (`groundR`, or it spawns in mid-air and the science buttons say "stop first"), and for 115 an antenna-only
Probe registered at 1,000 km around Selene. The Program's Fleet tab and "Drive from home" then work as for a player.
Contact over a relay orbit is sampled by moving `PROG.day`: `rvFieldContact` is pure. The science buttons listen for
`pointerdown`, so a driver needs real mouse events (`{click:…}`), not `element.click()`. Rows 65 (crew rotation) and 116
(docking at Selene) are still undriven.

## v1.70 — Hyperion's moons on the CPU; no more steps at the poles (Tellus too) (2026-10-09, world session, GROUND.md G7)

Hyperion's four moons (SYSTEM.md § Hyperion), built and measured headless like the planets. **Not live:** each is on a
stub body (`GROUND_STUBS`, SYSTEM.md's radius and gravity; Phoebe's gravity isn't there, so it's real Phoebe's 0.049).
And a bug found on the way, which **is live, on Tellus.**

**Every map had a step at the poles.** The equirectangular maps' first and last rows are rings round the poles (on Tellus
~4 km across). At a pole the samplers read only that row, so two points 0.5 m apart there read it at opposite
longitudes. Measured within 2 km of the poles: **a 0.5 m step of 77–90° on every body**, against 14–56° at
mid-latitudes. On Tellus that's in play: a star-shaped seam at both poles, in the physics and on screen (the GPU reads the
same texture).
- **Fix** (`polesFix`, sim/world.js): one value per polar row, its mean (a bound's max, for `U`). At a pole the samplers
  then read a constant, so the field is continuous there. It's applied in `makeWorld` and at the end of every body's
  bake. It's data only, and the GPU reads the same texture, so CPU and GPU still agree with no shader change.
- **After:** the steepest step near any pole is 0–48°, no worse than that body's own slopes: Tellus 31°, Selene 35°,
  Phoebe 48°.
- **Not seen in a browser** (this machine stays off the GPU): TESTING row 146.
- Heights change only within about a texel of each pole; Selene's 3,000-point reference is unchanged.

**Small bodies** (found on Phoebe, R 20 km):
- **Faces.** The crater bands skipped any cube face more than 60° from the point. That's safe when a crater reaches a few
  degrees, but on Phoebe a 12 km crater reaches 36°. A face is now skipped only beyond its corner (54.7°) plus the band's
  reach, which is unchanged (|u| < 0.5) on every larger body.
- **Coarsest bands.** A tiny body can also start its bands lower (`b0`) and bake the bigger craters instead
  (`bigCraters`' smallest size).

**The moons:**

| Moon | Character | What's there |
|---|---|---|
| **Theia** (Io) | no impact craters at all | sulphur-frost plains; 30 paterae (irregular, 20–80 km, flat floors of fresh lava, median 1.26 km deep); six tilted blocks of crust (to 4.3 km above their foot) |
| **Eos** (Europa + Enceladus) | flat young ice (relief 0.6 km), ~25 craters over 1 km | double ridges on a Worley-edge network at two scales (the new G-ice: crests 160 m above their centre lines); chaos patches of flat-topped blocks; the tiger stripes near the south pole (four rifts, 35 km apart, ~500 m deep, frosted: where a sample can be flown through the plumes) |
| **Tethys** (Titan) | few craters (c 3e-4) | methane lakes and seas, 4.7 %, nearly all in the north. The recipe has `sea: 0`, so a craft splashes down as on Tellus's sea. Linear dunes in equatorial patches (15 %, crests east–west, 2 km apart, 100 m high); a rugged bright highland (Xanadu); drainage channels |
| **Phoebe** | a lump, saturated with craters | the first G-lump (relief 21 % of R); 53 % of it over 10° |

Surfaces per moon:
- **Theia:** fresh lava, tilted crust, sulphur frost.
- **Eos:** fresh plume frost, ice blocks, ridged ice.
- **Tethys:** methane (the liquid), organic sand, icy highland rock, rounded ice cobbles (as Huygens saw), damp organic
  sediment.
- **Phoebe:** regolith.

**Measured** (`node study_ground.mjs theia|eos|tethys|phoebe`):

| Moon | Relief | Slopes | One height |
|---|---|---|---|
| Theia | −1.5…+7.4 km | plains p99 0.7°; mountains p99 36° | ~2 µs |
| Eos | −0.2…+0.4 km | ridged ice p90 11°; chaos p90 16–19°, 5 % past TOPPLE | — |
| Tethys | −0.7…+2.0 km | dunes median 5°; highland p90 6° | — |
| Phoebe | −1.9…+1.6 km | median 9.5°, 9 % past TOPPLE | — |

Tethys's craters are on target at every size. Eos's are few, as meant.

**Negative results:**
- **The polar rows**, above. No test sampled within a texel of a pole, which is how a near-vertical seam on Tellus went
  unnoticed since v1.25 (LESSONS #40).
- **Big craters on a tiny body cross the face cutoff**, above.
- **Eos's first chaos was smooth** (cubed value noise: median 1.1°). Blocks need steep sides: thresholded noise at two
  sizes.
- **Tethys's first dunes covered the whole equatorial belt** (44 %), and its lakes 7 %. Titan's dunes are patchy (~15 %);
  lakes now 4.7 %.

**Tests:** `ground-6`, 6 checks:
- not live;
- Theia (no craters, paterae, mountains);
- Eos (flat, double ridges, chaos rougher, the stripes);
- Tethys (lakes as a liquid, mostly north; dunes east–west);
- Phoebe (lump, saturated);
- **no step at any body's poles, Tellus included.**

Mutations caught: no pole fix, no liquid level on Tethys, no tiger stripes. Full suite 519 pass, 0 fail.

**Next:** Erebus, the last hand-made body; then the seeded small bodies (one lump recipe, parameters from `WSEED`).

## v1.69 — dispatch to a base: supply runs (2026-10-09, economy session, QUEUE Q61)

A **supply run** sends a design to a base, unflown by hand, and what lands joins the base (`sim/program.js`):
- **The flight** is built, not recorded: the design's own ascent procedure, then the bodies session's mission phases
  as `fly_ladder.mjs`'s `flySite` uses them: a transfer aimed through the base, a low capture, and `landAt` on the
  beacon's `pf` (`baseRunProc`). It ends on the surface: no ascent or return. `procFly` flies it for real, so a
  design without the Δv is lost or doesn't land. Measured: the Probe lands **1 m** from the beacon.
- **What it brings:** the lander is registered where it stands (`landRegister`) and joins the base if within
  `BASE_R` (500 m): its supplies, berths and labs count. Crew aboard aren't counted as arrived yet (the headless flight
  has no crew record).
- **Rules:** repeats only, as dispatch: refused before the body's landing first (`selland`, `nyxland`), for a design
  with no ascent procedure, and while a run to that base is queued. Pads, stacking days and price as any dispatch
  (`baseRunQuote`; the Probe: 175M, launch in ~113 days of stacking). No contract pays it: it keeps a base alive.
  A deviation hands over like any dispatch's.
- **The button:** each base's line in the Fleet tab (*On the surface*) offers *Supply run with ⟨design in Assembly⟩*
  or says why not (`baseRunLine`; one line and a `data-baserun` handler in `app/program-ui.js`, flagged for space/flow).
  Queued runs are dispatch entries with `base` instead of `cid`; `dispatchTick` settles them with news.

Test `econ-7` (2 checks, 9 s; an untargeted landing, mutation, ends 819 km away and fails).

**Not yet:** crew rotation (crew arriving, the old crew flying home); a supply contract (Q9) that pays for this;
supplies as cargo you choose (today: whatever supply parts the design carries).

## v1.68 — power: the onboard computer, solar cells and wings, batteries (2026-10-09, vehicle session, QUEUE Q34a)

Built to the plan in § "Vehicle parts" (Q34a), with Caio's call on the computer: **built into crew capsules, a part for
probes**. Headless only: nobody has seen the parts drawn or the builder's power line yet (TESTING row 144).

**Parts** (`sim/vessel.js`; palette *Power*):

| Part | Kind | Mass | Power | Notes |
|---|---|---|---|---|
| Onboard computer `ocomp` | inline | 0.03 t | −50 W | offered from the onboard-computer era (`era: 2`); price 8, tier 2 |
| Battery 1 kWh `batt` | inline | 0.02 t | stores 1 kWh | price 2 |
| Solar cells (body) `bpanel` | surface, fixed | 0.01 t | 40 W in full sun × 0.32 | price 2, tier 1 |
| Solar wing `wpanel` | surface, folds out (**P**) | 0.03 t | 300 W in full sun × 0.9 | tears off deployed above 1 kPa; price 5, tier 1 |

A probe core has 0.5 kWh of its own; the antenna draws 5 W and the camera 10 W. Crew capsules run on their own fuel
cells (their 10 days of life support) and draw nothing.

**The model** (new `sim/power.js`, loaded before `ground.js` so it's inside the SIM block):
- One store per vessel, `s.E`, up to its batteries (`powCap`). The loads (`powLoad`) draw on it, and the panels fill it
  while the vessel is out of its body's shadow.
- **The shadow** is a cylinder behind the body, since the sun is fixed and far (`SUN_DIR`).
- **Panels in flight:**
  - body cells give their average share whatever the attitude;
  - a wing turns about its own arm, so it gives √(1 − (arm·sun)²) of its best.
- **Stepping:**
  - each physics step (`advPhys`), and rails steps up to 60 s, use the sun right now;
  - longer rails steps use the orbit's average, with the shadow share taken from its elements (`eclFrac` with the
    orbit's β).
- **The builder's line** (`powerLine` in `app/editor.js`) appears only for designs with something electric. It shows a
  low Tellus orbit's average against the load, and the battery against one shadow, for example
  `Power +339 W / −55 W · shadow 16 min needs 15 Wh (battery 1500 Wh)`. It turns red and says "it runs flat" when
  the panels can't keep up.
- **Running flat never kills (Pillar 5):** the onboard computer goes off ("Power flat: the onboard computer is off,
  analog autopilot only…") and comes back once the panels catch up ("Power back").
- **Avionics** (`avOf` takes the lower of `s.av` and `avCap(s)`): from the onboard-computer era, the guidance
  computer's modes need `hasComputer(s)`, meaning a crew capsule, or an `ocomp` with power. Sandbox, physics tests,
  the tester's tools and procedures keep everything, as before.
  - **Presets:** no preset flies a probe that needs the guidance modes. The robot's docking pilot (`PT.dockIn`) flies
    in a test scene. So nothing needed the part added. **QA:** a robot career past year 7 that wants target or docking
    modes on a probe now needs an `ocomp` on it.
- **Era gate:** the builder hides a part with `era` until the program's `compEra()` reaches it (not with the tester's
  tools, and not in the sandbox). It's the first era-gated part, and the gate is the general one Q10 can reuse.

**Measured** (a probe: core, computer, battery, antenna, 1 t tank, Petrel, two wings):
- **Low orbit** (r 1,384 km, β 0): 37.2% of the 42.7-minute orbit is in shadow (15.9 min). The panels give 540 W
  peak and 339 W on average against 55 W of load, so one shadow needs 14.6 Wh of the 1.5 kWh on board.
- **Integrated along one orbit** on rails in 20 s steps: +204 Wh, with 14.4 Wh drained in the shadow. One long rails
  step gives +202 Wh, and the steady state says +202 Wh.
- A wing deployed at 10 km and 300 m/s (14.2 kPa) tears off.

**Tests:** `test.mjs` section `vehicle-2`, 5 checks: the budget by hand; one orbit, stepped and in one step, against
the steady state; a wing in thick air; the computer (a probe with and without it, a crew capsule, running flat and
coming back); a tape replays the wings.

**Not yet:**
- what a flat battery does to the antenna and camera, and to a satellite's service on the registry (space lane, Q27
  and the power side of Q50; they read `powerBudget`, `hasComputer`, `s.E`/`s.pwrOut`);
- an RTG;
- a builder choice of the orbit for the budget (it always assumes low Tellus orbit, β 0);
- the look of the parts (placeholders in `app/gl.js`, Q97);
- battery charge carried across a flight's end (each flight starts full).

## v1.73 — M0: presets for the first orbit missions, the Program screen's stray labels, and the palette v1.68 broke (2026-10-09, vehicle session, QUEUE Q74, Q77)

**Q74, PLAYTEST #24 (P1): two presets.** No preset could fly *The beeper* or *Passenger: one orbit*, so a presets-only
player stopped at the end of epoch 1. Both now use the Orbiter's launcher with the payload in the pod's place, plus a
reaction wheel to steer it (the wheel is 0.12 t, the pod 0.84 t):
- **Beeper:** cone, instrument package, wheel. It reaches orbit (periapsis 102 km) with 1,556 m/s to spare.
- **Passenger Orbiter:** chute, biocapsule, wheel. It reaches orbit with 715 m/s spare, goes once round, deorbits,
  and lands at 4.2 g with a ~256 K cabin.
- **Rejected:** keeping the pod. With the biocapsule, the pod and a shield under a decoupler, the rocket didn't make
  orbit. With the pod plus the package, only 319 m/s was left.
- **Without the wheel:** the plain swap (the payload for the pod, no wheel) also flies, at 6.4 g, but it can only turn
  while an engine burns.
- `career.mjs`'s own `passOrbit` stack (biocapsule, pod, shield, no decoupler) would bury the shield under the tank in
  real physics. It isn't touched here (QA's file).

**Q77, PLAYTEST #27: "NaN%" on the Program screen.** `builder.js` `overlay()` now also returns on the Program screen
(`atHQ`, where `S` is still the flown vessel), and it skips a load fraction that isn't finite.

**The palette v1.68 broke.** Q34a's era-gate line in `palette()` ended with a `//` comment that swallowed the next
statement (`const b=document.createElement('button')`). So from v1.68 to here **the construction screen listed no
parts**. The headless suite only checks that the page parses; the robot's `m1` run caught it at once. Fixed.
Lesson (LESSONS_LEARNED): run `node playtest.mjs m1` before pushing anything that touches a screen, as the QUEUE flag says.

**Checked:** `playtest.mjs m1` passes in full on this branch (the gate, a Sounding, the beeper to orbit, two debriefs,
no boxes overlapping). `test.mjs` section `vehicle-3`: the Beeper in orbit; the Passenger Orbiter once round and home
under 8 g and 330 K.

## v1.79 — warnings before launch, legs by themselves, the escape tower's own shelf (2026-10-09, vehicle session, QUEUE Q48, Q121, Q32)

**Q48: the Rollout screen warns.** `launchWarnings(stack, aims)` (`sim/vessel.js`, after `stageStats`) adds lines to
flow's `rollChecks()` with one call (flagged: `app/rollout.js` is flow's file). Every line is ⚠ or ✔, never ⛔: the
player may know better, and the flight is how they find out.
- **What the flight is aimed at** (`flightAims()`): accepted *Satellite to N km* and *Image* contracts, and the suggested
  next mission if it's an orbit one (beeper, orbiter, lift1, lift2).
- **Δv:** the stages' Δv against the program's best flight to orbit (the logbook's `orbit` fact, which keeps the least
  Δv any flight has taken). Before anyone has reached orbit, it uses ~4,500 m/s, a good ascent (the Orbiter in §2 spends
  4,446). A contract's altitude adds a Hohmann climb from low orbit (`dvToAlt`: +307 m/s to 400 km). Three outcomes:
  - **short:** the vacuum total doesn't reach the need;
  - **tight:** only the vacuum total does, while the first stage's sea-level Δv plus the rest doesn't;
  - **ok:** it does even counting the first stage at sea level.
- **Measured on the presets** (before anyone has reached orbit), for the beeper and for a 400 km satellite:

  | Preset | The beeper | 400 km satellite |
  |---|---|---|
  | Beeper | ok (5,745 m/s) | ok |
  | Orbiter | ok (4,663) | tight (4,894 vacuum vs 4,807) |
  | Passenger Orbiter | ok (5,058) | ok |
  | Hopper | short (1,560) | short |
  | Passenger | short (3,210) | short |
- **No parachute:** a crew capsule or a biocapsule aboard with no chute gets "No parachute: the crew (the passenger)
  can't come home". TWR < 1 and the passenger safety review were already in `rollChecks`.
- **The next-step hint** (`NEXT_PRESET`, `sim/next.js`) now names the Beeper for *The beeper* and the Passenger Orbiter
  for *Passenger: one orbit*. The "Orbiter with an instrument package in place of the pod" text is gone.

**Q121: legs by themselves.**
- `autoLegs(s)` (`sim/flight.js`) puts the legs down while a procedure is flying the vessel (`s.proc`) and it's
  descending within 1.5 km of the ground. It's called right after `procStep` in `advPhys`. A hand-flown landing stays
  the player's call (Y).
- **What's remembered:** legs and wings left deployed are in the vessel's saved state (`vstOf` adds `dep`, the indices
  of deployed parts; `vesselOf` restores them). So a lander registered on Selene still stands on its legs when loaded
  back, and a satellite keeps its wings out.
- **Not yet:** none of the ladder's presets (Probe, Sample Return) has legs, so `fly_ladder.mjs` doesn't exercise this
  end to end.

**Q32: the escape tower** is in a *Crew escape* palette category of its own (it was under *Other*).

**Checked:**
- `test.mjs` sections `vehicle-4` (warnings: the table above, the logbook's best, the climb against a hand Hohmann, the
  parachute) and `vehicle-5` (auto legs at 3 km / 1.2 km / climbing / by hand; legs and wings through the register);
- the full suite, 527/527;
- the robot's `m1` run passes; a tester probe shows the Hopper's "Short of orbit for The beeper" and a chute-less Passenger Orbiter's "No parachute" in the Rollout panel.

## v1.80 — a Docking preset; power's second slice: an RTG, the budget at the flight's aim, charge kept (2026-10-09, vehicle session, QUEUE Q78, Q131)

**Q78: the Docking preset.** A docking head on the Orbiter's launcher, so the docking rows (TESTING 58–67, 98, 116) can
be flown without the builder: a port on top, a probe core with an onboard computer (Docking SAS needs one on a probe,
v1.68) and a battery, two rings of four RCS quads and two gas bottles on the upper 2 t tank. It's the first preset built
as a v2 tree (surface parts), made at the end of `sim/vessel.js` once `toV2` exists.
- **Measured:** it reaches orbit (periapsis 103 km) with 646 m/s spare and its 30 kg of gas untouched.
- **To dock:** launch it twice, one as the target, or chase any satellite with a port. Docking SAS comes in the
  onboard-computer era (or with the tester's tools).

**Q131: power, second slice** (`sim/power.js`):
- **An RTG** (`rtg`, surface part, 35 kg, 60 W day and night, price 15; *Power* palette): `powRTG` is added in the
  physics step, in long rails steps and in the steady state. The battery only has to cover the load the RTGs don't.
  Placeholder mesh: a dark finned drum on a strut.
- **The budget at the flight's aim:** the builder's power line works out the orbit the flight is aimed at (the highest
  accepted satellite contract, `flightAims` from v1.79), else low Tellus orbit. It still assumes the sun in the orbit's
  plane (β 0), the longest shadow, and says so. At 1,000 km the shadow is 19% of the orbit, against 37% low down.
- **The charge is kept:** the vessel's saved state (`vstOf`) carries `E`, and `vesselOf` restores it, so a satellite
  loaded back has the battery it was left with (each new flight still starts full).

**Checked:** `test.mjs` sections `vehicle-6` (the Docking preset to orbit: quads, gas, port, Docking SAS with its
computer) and `vehicle-7` (RTG at night, the higher orbit's shorter shadow, the charge through the register); the full
suite 541/541 with Q78; the smoke shard and the power, legs and docking sections after Q131; `playtest.mjs m1` passes;
in the page, a core + antenna + RTG reads "Power +60 W / −5 W (low orbit average, the sun in its plane) · shadow 16 min
needs 0 Wh".

**Not yet:** a choice of β or orbit in the builder itself; what a flat battery does to a satellite's service (space, Q27).
