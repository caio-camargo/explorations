# Launchpad — a lean rocket/orbit sandbox
**Version**: v1.9.0 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-06 · **Status**: prototype, playable
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
land); film return capsules; power and eclipses; orbital decay for low satellites; flying past a registered satellite
in a flight (it isn't drawn in 3D yet); rivals' satellites and visibility (the spy layer).

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

**What interplanetary means for the architecture (for later, not now):**
- Tellus is the root body today (`soi: Infinity`) and the sun is a fixed direction (`SUN`). A star becomes the root;
  planets ride Kepler rails around it, each with its own SOI. The patched-conic code already handles one level of
  hierarchy (Tellus → Selene), so this is about generalising it to a tree.
- The sun direction then comes from the star's position (lighting, day/night, the light budget).
- Float64 at AU scale is fine: 1.5e11 m × 1e-16 ≈ 15 µm. Rendering is already camera-relative.
- Interplanetary and intercept planning want a Lambert solver (porkchop plots for windows). Visitors are hyperbolic
  Kepler legs through the star's SOI, so the propagator already handles them.
- Warp: transfers take months; rails warp is exact at any rate, but the top step (1e5×) may need another notch.

## Precision tricks worth keeping

- **Ray–sphere in float32 at 2 m above a 600 km planet.** The CPU sends `cc = (d−R)(d+R)` in
  double precision. The shader uses the stable quadratic: `t = cc / (b + √(b²−cc))` for the near
  root. Error at the launch pad is about 2 cm.
- **Near-field ground detail without a seam.** Detail noise is evaluated in a local frame whose
  origin the CPU snaps to the nearest 1 km. Each octave's lattice period divides 1 000 m
  (`mod(i, P)` in the hash), so re-centring never visibly pops.
- **Log depth** is written per fragment (`gl_FragDepth = log2(1+w)·Fc/2`). The vertex shader writes
  a matching log z, so nothing gets near/far clipped.

## Picking this up cold

- Everything in the `// ==== SIM BEGIN … SIM END` block is pure, with no DOM or GL. `test.mjs`
  extracts it with `new Function` and drives it headless. Keep that boundary.
- The construction screen is `builder.js` (object `BLD`), loaded before the main script and driven by it through
  `renderEditor`/`editorChanged` and `HOOK.edDraw`/`HOOK.edOverlay`/`HOOK.view`. Designs are v2 trees (§ v1.17);
  `assemble(toV2(old))` is how the old format still flies.
- Frames: the vessel state is `(body, r, v)` relative to the body it orbits (patched conics).
  Tellus spins about +Y; `fromPF/toPF` convert to and from planet-fixed. The launch site is
  planet-fixed +X.
- Vessel axes: Y = nose, X = belly (east on the pad), Z = south on the pad. The navball shows
  screen-up = −X and screen-right = +Z.
- In the in-app preview pane, `requestAnimationFrame` barely ticks while the pane is hidden.
  Drive the sim from `javascript_tool` (call `physStep` / `rails` / `render` directly), or open
  the page in a real browser.

## Open threads (best-specified first)

1. ~~Maneuver nodes~~ done in v1.4. Next on that line: several nodes in a chain, nodes beyond an SOI change, and a
   finite-burn correction (aim the burn so its *centroid* hits the impulse) to recover the 0.8 %.
2. ~~Re-entry heating~~ done in v1.7. Next on that line: conduction between neighbouring parts, and heating on an engine's own plume.
3. **Terrain height.** The planet is a perfect sphere. A height function shared by CPU (contact)
   and GPU (ray-march only near the surface) is the next real engineering problem.
4. ~~Radial attachment~~ done in v1.3, ~~crossfeed~~ done in v1.6, ~~asymmetric and nested attachment~~ done in v1.17
   (the construction screen), ~~radial fins~~ and ~~re-rooting~~ done in v1.18, ~~a staging editor~~ done in v1.20, ~~canted
   engines~~ done in v1.22, ~~core↔booster aero interference~~ (Newtonian shadowing) done in v1.23. Next on that line: truly
   tilted bodies; and on interference, the parts Newtonian shadowing leaves out (wake suction behind a body, gap-flow drag
   at zero α, shadowing of fin plates).
5. ~~Physics warp > 4×~~ done in v1.2: exact up to 100×. Optional next: *drawn* flex, bending the mesh by the computed moment.
6. **More bodies.** The SOI code is written for exactly one moon. Generalize it to a tree.
7. **Sound**, a WebAudio rumble driven by thrust × density.
