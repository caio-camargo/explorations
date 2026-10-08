# Launchpad — a lean rocket/orbit sandbox
**Version**: v1.21.1 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-06 · **Status**: prototype, playable
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
- Wide side-booster rockets: the hold-downs at r 3.4 m can poke through boosters of a 2.5 m core.

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

**Tests** (§35, 4 checks): one Sparrow pitches a wheel-less probe but can't roll it, nozzle ≤ 3° at ≤ 15 °/s; the
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
- A sea-launch platform (`kind:'sea'`).
- Per-site weather scrubs (`cloudAt`).
- Range safety and drop zones per site and heading (they already follow the flight, but nothing warns about a
  downrange over a neighbour before launch).
- Then slices C–E (§ v1.25).

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
0. ~~**Ground awareness**~~ done in v1.29 (§ v1.29); ~~surface properties by biome~~ done in v1.37 (§ v1.37). Next: the slice-B follow-ups in § v1.27, then slices C–E.
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
4. **Stations with terrain (C), recovery (D), biome science (E):** see the plan above.
5. **The world map / atlas view:** biomes and borders as an overlay on the map view would make the geography legible
   in play.

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
- **R4. Instruments and science** (each hinging on something the sim computes): samples by terrain unit, brought to the
  lander or an ascent vehicle (sample return); a spectrometer on rocks; camera panoramas (sun angle); seismometers set
  out as an array (spacing is what gives an interior map); ground-penetrating radar along a traverse; a drill or
  heat-flow probe (depth, power); a magnetometer traverse; ice in permanently shadowed polar craters (hard on power).
  Contract types proposed to economy.
- **R5. Drive plans:** waypoints a rover carries out *between flights*, with results arriving as news (as the imaging
  satellites already work): no hours of real-time driving.

**Needed from others:** Selene's terrain (craters, maria and highlands, boulders, slopes) from the terrain session:
today Selene is a smooth sphere apart from the regolith model; power (R3) is new everywhere.

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

## UI: screens and navigation — spec (2026-10-07, ui session with Caio; nothing built yet)

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

---

## Picking this up cold

- **Direction:** native desktop eventually, the browser for now (§ "Platform direction"). Keep the SIM pure: it is what ports.
- Everything in the `// ==== SIM BEGIN … SIM END` block is pure, with no DOM or GL. `test.mjs`
  extracts it with `new Function` and drives it headless. Keep that boundary.
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
  Launch sites: `SITES` (plain data), `curSite()`/`homeSites()`, `newShip(stack, site)`; see § v1.27.
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
7. **Sound**, a WebAudio rumble driven by thrust × density.
