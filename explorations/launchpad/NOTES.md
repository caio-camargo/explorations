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
4. ~~Radial attachment~~ done in v1.3, ~~crossfeed~~ done in v1.6. Next on that line: asymmetric attachment (a single side stack: the physics already
   takes off-axis mass and thrust, but the builder only offers ×2–4 and it is untested), and core↔booster aero interference.
5. ~~Physics warp > 4×~~ done in v1.2: exact up to 100×. Optional next: *drawn* flex, bending the mesh by the computed moment.
6. **More bodies.** The SOI code is written for exactly one moon. Generalize it to a tree.
7. **Sound**, a WebAudio rumble driven by thrust × density.
