# Launchpad notes — Space
**Version**: 1.0.2 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-11 (split from NOTES.md v1.21.52, W37) · **Updated**: 2026-10-13
**Purpose**: The build log for orbits and the system on rails, bodies, satellites and the registry, decay, station-keeping, debris, links and data, missions in flight, the automation ladder, stations, rovers.
**Status**: live log, oldest first; new sections go at the bottom. Index of every section: [`../NOTES.md`](../NOTES.md).

---

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

## Plan: data as a volume and the link budget (2026-10-09, space session, QUEUE Q51; plan only)

From LATE_GAME.md § "Comms" (round 4: contact gates automation, solar conjunction, light delay, bandwidth, relays as
nodes), MIDGAME's automation ladder, and Q27's "relay range" (folded in here: range falls out of the link budget).

**What exists, scattered:** the flight's link (`linkOf`: a ground station in view, or a plasma blackout; away from Tellus
"deep space holds"); line of sight for missions (`seesTellus`: the far side, the impactor); rover contact (`rvContact`:
direct with a high-gain antenna, or a relay over its horizon, with light-time delay); imagery's contact share
(`satTick`: the share of time a station sees the satellite, times `IMG_RATE`); image deliveries (`q.pending`, downlinked
at the next contact); the flight's recorder (`R.sfRec`: loads measured out of contact count once the package is home).
None of them has a rate: contact is yes or no, and data has no size.

**The model (lean, pillar 6):**
- **The link budget:** rate = K · P_tx · G_tx · G_rx / d² (bits a second), the free-space law with everything else
  in one constant per era (receivers improve). An antenna part has a gain class (the low-gain whip `ant` today; a
  high-gain dish later, vehicle's part), a ground station a dish class (the pad's, a city station's, a deep-space dish:
  an economy facility). A link exists when there's line of sight (the bodies in the way, the plasma, as now) and the
  rate clears a floor (telemetry); **range is where the rate meets the floor**, so a whip reaches low orbit and the
  moons barely, a dish reaches the planets.
- **Paths:** `pathHome(x, t)`: the best route from a vessel, satellite, lander or rover to a ground station, direct or
  through one relay (any registered or flying vessel with a powered antenna), rate = the weaker hop, delay = the light
  time of both. One function behind `linkOf`, `seesTellus` (where it's about radio), `rvContact` and imagery's share.
- **Data as a volume:** instruments make bits (a camera frame, a spectrum, a panorama, telemetry at a trickle); each
  vessel's recorder holds them (a capacity: a core's small one, a recorder part); contact drains it at the path's rate,
  and data counts (and pays) when it's home. Today's yes/no rules become special cases: the far-side pictures are a
  volume that needs a path home; imagery pays per frame received instead of per share of contact.
- **Power:** a transmitter draws its antenna's load while sending (Q27's power side, once presets are powered, Q164).
- **Automation:** a routine flies a burn only with a path home, or with an onboard computer of the tier the burn needs
  (Q127's ladder): the relay network sets how far routines reach.

**Slices:**
1. **`pathHome` and the link budget** (space): gain classes, station dishes, line of sight, one relay hop, rate and
   delay; `linkOf`, `rvContact` and imagery's contact share become calls to it, with today's behaviour as tests (the
   same contact shares, the same far-side relay results) so nothing changes in play yet.
2. **Data as a volume** (space + economy): instruments → recorders → downlink at the path's rate; imagery and science
   pay on data received (economy's M2 item "pay on data received"); the far-side pictures and the recorder rule become
   volumes.
3. **Relays as nodes** (space + flow): coverage (the share of time a body or region has a path home, as `navCover`
   does for navigation), drawn on the map and the network screen; a route through a gap is flagged; relay power (Q27).
4. **Solar conjunction and light delay at the planets** (space): once Helios is the root (Q87), the Sun blocks paths;
   a relay off the line fixes it.

**Defaults (Caio may override):** one relay hop (no chains) until relays are nodes; rates tuned so a whip from low
orbit to the pad's dish moves a few kbit/s (a 1960s TV frame per pass, so a day's pictures need several stations, as
imagery's contact share already says), a dish ×100, a deep-space dish ×10 on the ground; the floor is a telemetry
trickle (100 bit/s).

**Tests to write first** (slice 1): the contact shares `satTick` measures today (polar 300 km and the pad ~10 %, a
five-station network ~50 %) come out of `pathHome`; the far-side rover cases of test 40 (alone 0 %, through the 1,000 km
relay ~35 %, the extra light time) hold; a whip at Nyx's distance falls under the floor; plasma still blacks out.

## Plan: low thrust on rails, for nuclear-electric and plausible fusion (2026-10-09, space session with vehicle, QUEUE Q109; plan only, M5)

LATE_GAME (round 2): fusion propulsion at the plausible end, very high Isp and **modest thrust**, heavy with shielding,
power plant and radiators, late in the eras and probably a military-funded first (TECH_SCOUTING § Propulsion:
*Sunbird*, DIU); nuclear-electric (NEP) before it; torch ships out. Both need the same thing from the space lane:
**thrust on rails**.

**The number that makes it worth having:** at constant acceleration a, a trip of distance d takes t = 2√(d/a) (turn
over halfway). Tellus–Enyo at its closest is 0.52 TU (8.2 Gm):

| craft acceleration | trip | against a Hohmann (283 days) |
|---|---|---|
| 2e-4 m/s² (good NEP) | ~444 game days | slower: NEP is for cargo tugs |
| 1e-3 m/s² | ~200 days | a little faster |
| 2e-3 m/s² | ~140 days | half: what "shortens the long trips" means |

A jet of exhaust speed v_e gives a = 2 P / (m v_e), so 1e-3 m/s² at v_e 100 km/s (Isp ~10,000 s) needs **~50 W of jet per
kg of whole craft**: that's the fusion part's specific power, shielding and radiators included. NEP's ~1 W/kg at Isp
4,000 s gives ~5e-5 m/s²: years-long spirals, cheap in propellant (tugs, LATE_GAME's "cargo slow, crew fast").

**What the space lane builds:**
1. **Thrust on rails:** a vessel whose low-thrust engine is running stays on rails, integrated (RK4, steps from the
   orbit's period and the thrust's time scale) with a steering law: prograde (spiral out), retrograde (spiral in), hold
   an inertial direction, or follow a planned arc; its mass falls as it burns; warp stays exact enough at ×10⁵. Today
   a running engine forces physics stepping; low thrust mustn't.
2. **Arcs between flights:** a cruise entry (v1.90) carries a thrust arc (steering, start, duration) as it carries
   impulsive nodes (v1.93), executed on the same integrator; mission control flies arcs from the right era (Q127).
3. **A planner for routines:** Edelbaum's approximation for spirals (Δv ≈ difference of circular speeds, with a plane
   change) to price routine tug runs without integrating them.
4. **With vehicle:** the parts (NEP: reactor + ion engines; fusion: the plausible drive), each with power, Isp, thrust,
   mass, and its waste heat for the radiators (Q34b); era gates; the military-first contract (economy).

**Measure first:** a spiral from a 300 km Tellus orbit to escape at 5e-5 and 1e-3 m/s² (time, Δv against Edelbaum);
the Enyo trip at 2e-3 m/s² on real heliocentric rails (Q87 slice 2), against the brachistochrone estimate above.

## Q108: a Tellus–Enyo cycler, measured (2026-10-09, space session; study, `study_cycler.mjs`)

LATE_GAME's network wants cyclers (routes as belts). Enyo sits at 1.52 TU with a synodic period of 2.14 years, like
Mars, so an Aldrin cycler keeps Aldrin's shape in TU: a 1.60, e 0.393 (perihelion 0.971 TU, aphelion 2.229 TU, period
2.02 years). What our scaling changes is speed (Tellus moves at 8.61 km/s, not 29.8) against each planet's pull.

| | ours | the real Earth |
|---|---|---|
| v∞ at Tellus | 1.90 km/s | 6.54 km/s |
| turn needed each cycle (inbound to outbound branch) | 84.7° | 84.7° (same geometry) |
| a flyby at 300 km turns up to | **94.9°** | 71.3° |

**On our scale the cycler is ballistic**: a Tellus flyby under ~800 km (99° at 100 km, 95° at 300 km; at 1,000 km it
falls 2.2° short) turns it as far as each cycle needs, where Aldrin's real one pays Δv every cycle. So a cycler, once
placed, costs only corrections, which makes it a natural LATE_GAME route ("routes as belts").
- **Taxis:** from a 300 km orbit at Tellus onto the cycler's hyperbola, **1,702 m/s** (a Hohmann departure to Enyo:
  1,396); at Enyo, v∞ 2.82 km/s, 2,022 m/s from a 30 km orbit (Enyo's thin air can take part of it by aerobraking).
- **Simplifications** (to check on real rails, Q87 slice 2): circular, coplanar planet orbits (Enyo's e is 0.09, which
  shifts the encounters); the turn needed is estimated from the cycler's crossing at 1 TU (inbound to outbound), not from
  a full multi-revolution solution; no Enyo flyby used. Expect corrections of tens of m/s a cycle rather than zero.

## Plan: asteroid capture and mining, the space side (2026-10-09, space session, QUEUE Q140; plan only, M4–M5)

The design is LATE_GAME.md § "Asteroids: capture and mining" (round 6, approved): types by spectra, the ARM-style
capture of a small rock or a boulder, mining in place in the belt, products into the five goods, the era order (capture
in epoch 7 with solar-electric tugs, mining in 8–9), parking at Selene's L4/L5 (measured stable), planetary defence as a
pressure. This is the space lane's build order on top of it, with what each step needs.

1. **Seeded near-Tellus rocks** (needs Q87 slice 2: heliocentric rails): SYSTEM.md's seeded class as small bodies on
   Helios-centred Kepler orbits close to Tellus's (`WSEED`), each with a size, a type (C ~75 %, S, M), a spin; a few
   pass through Tellus's sphere (temporary captures, real). A survey telescope (economy: a facility) finds them; until
   found they aren't on the map (pillar 4).
2. **The rock as an object:** a registry entry with no parts: a rubble-pile shape (world's seeded small-body ground,
   G7, gives the surface), mass from size and type, spin. A flyby with the spectrometer (R4) confirms the type; contact,
   grappling and docking reuse the arm and claw (stations plan, Q30's robot rows), so "take a boulder" is the arm on
   the surface.
3. **Low thrust on rails** (shared with Q109's NEP and fusion): a continuous-thrust stepper for vessels on rails (the
   Edelbaum average for routines, integrated for flights); a solar-electric tug part (vehicle). **The cost is time:** a
   2 N tug on a 500 t rock accelerates at 4e-6 m/s², so 200 m/s takes ~5e7 s, about 1,700 program days (~4 game years).
   That's a routine's job, not a player's.
4. **Despin and the combined centre of mass:** the rock and the tug are one rigid body once docked (the stations
   model); despinning spends RCS or the tug's own thrust off-axis; the tug's thrust goes through the pair's centre of
   mass or it turns them (the hard part LATE_GAME names, physics as it is).
5. **Parking** at Selene's L4/L5 (stable today, `study_lagrange.mjs`) or a distant retrograde orbit; a parked rock is
   a node (the network screen) that a mining routine draws from.
6. **Mining in place** (with economy and world): a landed base on a belt body (landRegister on small bodies, G7's
   ground), producing propellant or materials by type, shipped by routines.
7. **Deflection** (with economy; a pressure, so a world setting): a seeded rock on a path that meets Tellus (the
   predictor's impact, at heliocentric scale) becomes a contract; a kinetic impactor changes its velocity by β·m·v/M
   (DART's β ~3.6); rivals try too (LATE_GAME: failing is embarrassment and money).

**Measure first:** the Δv to "easily retrievable" rocks in our scaled system (ARM: under 500 m/s with the Moon's help;
here with Selene's), once heliocentric rails exist; a tug's real transfer time on the low-thrust stepper.

## Plan: the automation ladder (2026-10-09, space session with economy's parts, QUEUE Q127; plan only)

From [`MIDGAME.md`](MIDGAME.md) (approved: decision 2, automation arrives with compute; decision 3, every routine has a
window) and CREW.md (pilots come first). **What exists:** dispatch (an ascent flown by its recorded procedure, any era);
the economy's supply runs, refused before onboard computers (`baseRunQuote`, `BASE_ERA`, D7); mission control flying a
vessel's planned burns (v1.93, any era today). Three places, three rules, none of them named.

**One question every routine asks:** `autoAllowed(kind, ctx) → {ok, why, era}`, with the ladder as data:

| kind | from | why (the refusal the UI shows) |
|---|---|---|
| `ascent`: repeat a flown ascent (dispatch) | human computers (0) | — |
| `burn`: mission control flies a planned burn | mainframes (1) | "burns are computed by hand: fly it yourself" |
| `deploy`: put a satellite in an orbit you've flown | mainframes (1) | "needs a mainframe to command the deployment" |
| `dock-crewed`: rendezvous and dock with a crew aboard | mainframes (1) | the pilot flies the last metres (CREW.md) |
| `dock`: uncrewed rendezvous and docking (resupply) | onboard computers (2) | "needs onboard computers" |
| `moon`: runs to Selene or Nyx | onboard computers (2) | as now for supply runs |
| `planet`: interplanetary routes | cheap compute (3) | "needs cheap compute" (and M5) |
| `assist`: gravity-assist families | the AI boom (4) | — |

The economy's `BASE_ERA` and my mission control become calls to it; the thresholds stay in one table, so balancing
the ladder is one edit.

**Slices:**
1. **`autoAllowed` and the table** (space, economy's call sites flagged): dispatch quotes, supply runs, and mission
   control's burns (`nodeHandOff` refuses before mainframes, with the reason) ask it.
2. **Window rules** (with economy and planning): a procedure records its rule when it's flown (plane over the site ·
   target phase · lighting at the site · planetary alignment); `nextWindow(rule, T)` finds the next valid one; a
   dispatched routine launches at its next window, and the pad calendar shows them (MIDGAME's table: near space waits
   hours, Selene a few days, the planets years).
3. **Contact gates automation** (after Q51 slice 1): a ground-commanded step (a mission-control burn, a deployment)
   needs a path home at its time; with an onboard computer of the step's tier it may run out of contact.
4. **Crewed routines first** (with economy and crew): crew rotation carrying cargo as the first resupply routine.

**Defaults (Caio may override):** the table above (MIDGAME's, with mission-control burns from mainframes, since
before them burns were worked out by hand); refusals say why and which era unlocks it; nothing already ordered is
cancelled when a rule changes.

## Plan: Helios's tide on the Tellus system (2026-10-09, space session, QUEUE Q139; plan only, M5)

Comes with Q87 slice 2 (Helios as the root). Measured with `sim/system.js` (TU 15.78 Gm, μ 1.17e18): Helios's tide
2μr/D³ against Tellus's own pull at radius r:

| where | Helios's tide | share of Tellus's pull |
|---|---|---|
| low orbit, 300 km | 9.4e-7 m/s² | 1.5e-7 |
| stationary | 4.1e-6 | 1.3e-5 (Nyx's tide there is ~15× more) |
| Nyx's distance, 18,000 km | 1.1e-5 | 2.2e-4 |
| Selene, 38,440 km | 2.3e-5 | 2.1e-3 (the Sun on the Moon: 5.6e-3) |
| 100,000 km | 6.0e-5 | 3.7e-2 |
| L1 / L2, 261,000 km (the Hill radius) | 1.6e-4 | 0.66 |

**The trap:** the moons get their parent's tide by `b.pert` (always on inside their spheres). Doing that for Tellus would
put every Tellus orbit, low ones included, on numerical integration instead of exact Kepler rails, for a force of 1e-7
of gravity there. So:
- **Per orbit, like the moons' children** (`pertNear`'s threshold, PERT_MIN = 2e-6 of the central pull): Helios's tide
  counts on an orbit whose apoapsis feels it above the threshold, i.e. above ~2,500 km of altitude; below, exact rails as
  now. `pertAcc` adds it in Tellus's frame (Helios's pull minus Tellus's), as it adds Nyx's and Selene's.
- **Selene and Nyx stay on their fixed rails** (the tide would precess them over years; their phases are the game's
  clock, so they don't move).
- **What it does:** station-keeping (v1.60+) measures it with the rest (it adds a little to high orbits); it shapes
  orbits that reach far out (Lidov–Kozai on high inclined ones, as Tellus does to Selene's); **L1 and L2** exist (halo
  orbits for a relay or an observatory: Q51 slice 4, "a relay off the line fixes it"); a cruise entry leaving Tellus
  feels it on the way out.
- **Measure first** (study, as `study_lagrange.mjs` did for Selene's L4/L5): a halo orbit's station-keeping at L1/L2;
  how much stationary and navigation orbits' hold cost change; that a Tellus escape's energy still matches the
  heliocentric leg it becomes.

**Defaults (Caio may override):** per-orbit threshold as above; the moons unperturbed; no seasonal effects on low orbits.

## Plan: the system on rails (2026-10-09, space session, QUEUE Q87; plan only)

From [`SYSTEM.md`](SYSTEM.md) (approved v1.0.0: the bodies, Helios μ 1.17e18 (play length; D15.6), the year of 400 days, Tellus
at 15.8 Gm, its Hill sphere 261,000 km, Tellus's 23° tilt with seasons built at M5) and PLAYTEST #11 (the other planets
on the map from the start).

**What the code assumes today** (measured with grep, 2026-10-09):
- the body tree's root is Tellus, at the origin: `bodyPos` returns [0,0,0] for the root; Tellus's `soi` is Infinity, so
  leaving it leads nowhere; about 8 places treat "no parent" as "the origin";
- the sun is fixed in the absolute frame: `SUN_DIR`, used 11 times (power and shadows, the rovers' sun, imagery
  daylight, the clouds' and satellites' lighting, the renderer's sun);
- the planet turns in that frame (`absTh`, 6 uses), and flights start on whole days so a flight's frame is it;
- ~300 literal `TELLUS` uses, but nearly all mean "home" (stations, cities, the air, missions), not "the root".

**The design (lean, pillar 6):** Helios becomes the root of the body tree; Tellus, Hesper, Enyo, Astraea, Hyperion and
Erebus are its children (Kepler elements from SYSTEM.md, names in one table so a rename is one edit), the moons theirs.
But **the absolute frame stays centred on Tellus**: `bodyPos(b, t)` is the body's heliocentric position minus Tellus's.
Everything near home (rendering, stations, the planet's turn, every flight so far) keeps its numbers; the sun becomes a
body that moves: `SUN_DIR(t)` = the direction to Helios, so its 11 uses take a time. Leaving Tellus's sphere (its
Laplace radius, 177,000 km at μ 1.17e18) gives a heliocentric leg, as leaving Selene's gives a Tellus one today; the
predictor's legs (three today) go to five (Tellus → Helios → Enyo, and back).

**Slices** (space unless noted):
1. **The planets on the map, from epoch 1** (with flow; PLAYTEST #11): `SYSTEM_BODIES` (names, elements, sizes, colours
   from SYSTEM.md) and `helioPos(name, t)`, analytic Kepler, no physics; the map's zoomed-out view shows them as discs
   with labels where they really are that day (and *Helios* as the sun's direction). Cheap, and it makes the year and
   the system visible long before anyone can go.
2. **Helios as the root** (M5): the tree and the Tellus-centred absolute frame; `SUN_DIR(t)`; Tellus's finite sphere;
   heliocentric legs in the predictor and on rails (cruise entries carry them, v1.90); the cruise events for planetary
   arrivals come for free (v1.91). Tests first: every existing check holds with Helios added (near Tellus nothing moves
   but the sun); a Tellus escape becomes a heliocentric orbit with the right energy; a Hohmann to Enyo arrives when the
   predictor says (the SYSTEM.md table: 283 days).
3. **The moving sun** (with look and vehicle): seasons from the 23° tilt (Tellus's orbit inclined to its equator),
   eclipses and panels by `SUN_DIR(t)`, the sun smaller and dimmer outward (1/27 at Hyperion), the renderer's sun.
4. **Time at the planets** (with economy): warp on heliocentric legs to ~10⁶×; launch windows on the timeline (a
   porkchop per target, the window every 1.57 years for Hesper, 2.14 for Enyo); transfers flown on rails as cruise entries.
5. **Helios's tide** (Q139): Tellus–Helios L1/L2 with 6b's machinery.

**Defaults (Caio may override):** the Tellus-centred absolute frame (keeps every flight's numbers; the alternative, a
Helios-centred frame, moves every position by 15.8 Gm for no gain near home); planets as children of Helios with no
mutual perturbation (patched conics; the tide comes with slice 5); the planets drawn from epoch 1 but unreachable (no
heliocentric legs) until M5.

**Precision:** float64 at 1.6e10 m keeps ~2 µm; the renderer already subtracts the camera in float64 before float32.
Kepler at heliocentric radii is exact as today.

## Plan: missions in flight (2026-10-09, space session, QUEUE Q49; plan only)

From NOTES § "Time, long missions" (*Missions in flight*, passive flybys, one event timeline) and LATE_GAME.md § "Keeping
flight in play" (the fleet strip, no silent misses). The pieces that exist: the registry and its rails (`satAt`,
`moonOrbStep` with SOI exits, v1.60–v1.88's holding, decay and debris), the predictor's patched-conic legs
(`predictFrom`, `numLeg` for perturbed legs), `vesselOf`/`flyEntry` (fly a registered vessel again), and the economy's
timeline (`upcoming`, `advanceTo`, stops at events marked *stop*).

**What changes for the player:** leaving a flight never loses a vessel. Anything still coasting (a transfer to Selene,
an escape to Nyx, a capsule on its way home, a probe on a flyby) carries on between flights, shows in a list with its
next event, and time stops before anything that needs a decision.

**Who is "in flight":** at flight end (`missionEnd`), the flown vessel and each FLEET vessel that isn't landed or
destroyed and isn't a satellite by `satRegister`'s rule (a closed orbit clear of the air, inside the SOI). Today those
are dropped silently; they become **cruise entries** (`q.cruise`), registry entries with a trajectory.

**Slices** (space unless noted):
1. **Cruise entries on rails across bodies.** Registered at flight end with their state, shape, design and kit (as
   satellites are, A2: flyable again). Between flights `orbTick` moves them leg by leg: Kepler in the current body's
   frame up to the next SOI change (found as the predictor finds it), re-framed there (`bodyRel`); perturbed legs by the
   RK4 stepper (`moonOrbStep`'s, generalised). A leg that becomes a closed orbit clear of the air turns the entry into an
   ordinary satellite (the v1.60+ rules then apply). One that meets the ground or the air is the next slice's event.
   The dispatched payload (Q149's note) registers here too: `dispatchRun` keeps `f.s`. Lists: *In flight* in the
   Program screen (name, where it is, next event and when).
2. **Events and stops** (with economy for `upcoming`): each cruise entry adds its next event: entering a body's gravity,
   periapsis at a body (the closest approach), entering an atmosphere, meeting the ground. Rules, "no silent misses":
   time **stops** before an atmosphere entry and before an impact, and once (the first time) before an SOI entry or a
   periapsis that nothing is planned for. At the stop: **Fly it** (`flyEntry`, a flight that starts there) or **Let it
   go**: an impact crashes it (logged, no surprise: it was announced); an atmosphere entry is flown headless by the
   game's own physics (as `procFly` flies a dispatch) with the vessel's chute/shield, and lands or burns as physics says.
3. **Planned burns carried** (with vehicle's nodes): maneuver nodes left on a vessel at flight end travel with its
   entry. A node is an event that stops time (fly it), or, handed to mission control, is executed at the era's error
   (`predErr`; exact with onboard computers), leaving a correction for later. This is "hand it off, or fly it".
4. **The fleet strip** (flow) and **paying along the way** (economy): every vessel in flight with its next event and the
   time to it, on the network screen and the pad calendar; prestige and public interest during a cruise (NOTES).

**Defaults (Caio may override):**
- a "Let it go" atmosphere entry is flown headless, not rolled: the result is what the vessel's design earns;
- an SOI entry or periapsis with nothing planned stops time **once per entry per body** (then the player can ignore
  it), as LATE_GAME asks;
- cruise entries don't hold or decay; only satellites do (they keep the v1.60+ rules once their orbit closes);
- debris pieces (v1.76) never become cruise entries: a spent stage on an escape trajectory is dropped, as now.

**Costs** (to measure in slice 1): a cruise leg is Kepler (exact, one evaluation per SOI check) unless perturbed; the
predictor already finds SOI changes in milliseconds. A few dozen vessels in flight cost nothing per day.

**Tests to write first** (slice 1): a Selene transfer left at flight end arrives at Selene's SOI when the predictor said
and its state matches a flight flown through (to the predictor's error); an escape from Tellus ends up around the root
frame's body; a capsule on a return becomes "in flight" and re-entry is its next event; a closed orbit still registers
as a satellite.

## Assessed: thin air in the flight itself (2026-10-09, space session, QUEUE Q128; not built)

Between flights a 110 km orbit decays in under an hour (v1.64); in flight the air stops at 100 km, so the same orbit is
free. Measured with `dragRates`/`decayAE` for an Orbiter's payload (Cd·A/m 0.0068), if the flight felt the thin air:

| parking orbit | lost an hour | down after | from 110 km (Hohmann) |
|---|---|---|---|
| 110 km (every preset's procedure today) | 13.6 m/s | 1.4 h | — |
| 130 km | 1.2 m/s | 10 h | — |
| 150 km | 0.28 m/s | 60 h (7.5 game days) | +48 m/s |
| 200 km | 0.04 m/s | 815 h (~100 game days) | +105 m/s |

So turning it on is not a physics fix to slip in: a craft warping in a 110 km parking orbit (waiting for a window, a
rendezvous) would come down within the flight. It needs the presets' procedures to park at ~150 km (+48 m/s), the
tests' `LEO`, the robot routes and PLAYROUTE to follow, and the "orbit" missions to keep their definition. That's every
lane, so it goes to design (ROADMAP rule 8). **Default if silent: as now** (no air above 100 km in flight; decay
between flights only), noted in the flight's HUD later as "decays in N h after the flight" if wanted.

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

## v1.82 — debris, slice 2: conjunctions between flights (2026-10-09, space session, QUEUE Q146)

Slice 2 of § "Plan: debris and Kessler". `conjTick` runs at the end of `orbTick` (each `advanceDays`), Tellus orbits only.
- **Who meets whom:** big objects (Debris) against active entries (everything else in Tellus orbit), never object against
  object. Each orbit is smeared over 38 bands of 50 km from the top of the air to 2,000 km (`resid`: the share of its
  period in each, sampled evenly in time; cached per orbit).
- **The rate** (`pairRate`, hits a day): Σ over shared bands of share_a · share_o · Rs² v / (2π r² W cos(Δi/2)), Rs the
  two bounding radii added, Δi their mutual inclination. Derivation: at a node they hit if their offsets across the band
  and along the track fall in an ellipse of area π Rs²/cos(Δi/2). My first version used the bounding rectangle (4/π too
  high); an event-driven Monte Carlo caught it (`study_debris.mjs`, part A, 200,000 pairs × 20 days, Rs 1 km):

  | Δi | 90° | 60° | 30° | 10° |
  |---|---|---|---|---|
  | Monte Carlo / formula | 0.99 | 0.94 | 0.93 | 0.92 |

  (±5 % statistical.) The usual "smear over a spherical shell" estimate is close at steep crossings but goes to zero at
  small Δi, where the real rate is highest.
- **A hit** (a seeded roll per entry and day, Poisson): a crewed entry is always warned and moves (LATE_GAME: no
  surprise deaths); a tracked one (from the mainframe era, `debrisTracked`) with `DODGE_DV` = 0.5 m/s in its tanks dodges
  and pays it; anything else is destroyed with the object, and the breakup goes into `PROG.breakups` for Q147.
- **The setting:** `pressureOf('debris')` reads `PROG.pressures.debris` (off / light / real, default light = a tenth of
  real); platform's Q124 can adopt the accessor for world creation.

**What it means** (part B): a satellite sharing a band at 400 km with N spent stages, crossing at 60°, real rates:
N = 10 → one hit in ~110,000 years; 100 → ~11,000; 1,000 → ~1,100. **Big objects almost never hit each other**, as in
reality (the first accidental satellite–satellite collision, Iridium–Cosmos, came 52 years into the space age). The
pressure LATE_GAME wants comes from fragments: slice 3 (Q147) turns breakups and anti-satellite tests into band densities
of thousands of pieces, where the same formula (with the fragment's tiny radius) gives real odds.

Test `space-4` (3 checks; mutations caught: the old formula, "off" ignored, crew not warned, never tracked, no breakup
record). Full suite 557 pass. No TESTING row: a hit is too rare to try by hand, and there's no UI for the setting yet (Q148).

## v1.83 — debris, slice 3: fragment bands and the cascade (2026-10-09, space session, QUEUE Q147)

Slice 3 of § "Plan: debris and Kessler": fragments as a density per band (ESA MASTER style), `fragTick` after `conjTick`.
- **Sources** (`breakup(h, kg)`): slice 2's collisions, fragments shattering big objects, and `asatTest(name, h)` (the
  POWERS hook for a security state's test). Fragments of 1 cm and more by NASA's standard breakup model,
  N = 0.1 M^0.75 Lc^-1.71 (a 1 t breakup: 46,774), spread as a normal of 100 km around the height; below the air is lost.
- **Drain:** each band loses 1 − e^(−dt/τ) to the one below a day, τ the time a centimetre fragment (Cd·A/m 0.2) takes
  to sink through it. Drag is physics, so it runs with the setting off too.
- **Hits** (4 n R² v a day: slice 2's pair rate averaged over random crossings, the fragment's size negligible):
  an uncrewed entry is killed, not tracked (nobody tracks 1 cm): it goes silent and **stays up as a dead hulk**, a big
  object (`junk`, *(dead)*). Only a fragment that brings 40 J per gram of the target (NASA's catastrophic threshold, a
  fragment's mass from a 1,000 kg/m³ sphere) shatters it into more fragments: a 2 t stage at 2.7 km/s needs ~35 cm and
  up, ~0.2 % of fragments. Crewed entries are never hit by surprise: one warning when their band passes one hit in
  1,000 years. My first version let every 1 cm fragment shatter a 2 t stage, and 20 stages fouled their band within 20
  years; the threshold is what real breakups need.
- **The cascade** (Kessler's chain reaction): a band is critical when one breakup's fragments are expected to shatter
  at least one more of its big objects before drag clears them, R0 = N · (their shattering rate) · τ ≥ 1. High bands
  clear so slowly that R0 > 1 comes easily; what makes it news is the next breakup being due soon: R0 ≥ 1 and due within
  50 years → *the band now feeds itself* (once); R0 ≥ ½ and within 200 → a warning. (Two cheaper tests failed first:
  "growth beats drag" fires at 800 km for any population, since drag there takes centuries; "e-folding within 50 years"
  was dominated by the expectation of rare huge breakups and fired with nothing due for centuries.) `CASC_STAT[b]`
  keeps R0 and the wait per band for views (Q148), unsaved.
- The Program screen adds one line: fragments of 1 cm and more, the thickest band, a 2 m satellite's odds there, and any
  band feeding itself.

**Measurements** (`node study_debris.mjs`, part C; real rates; game years of 400 days):
- A centimetre fragment sinks through the 300–350 km band in 0.28 years and is down from there in 0.43; from 400 km in
  2.9 years; 500 km 15; 600 km 72; 800 km ~930; 1,000 km ~4,700. The Kessler asymmetry, on this planet.
- One 1 t breakup at 400 km: 46,774 fragments, 9,043 in the thickest band (a 2 m satellite there: 3 × 10⁻³ hits a year);
  27,000 left after a year, 12,000 after 5, 1,100 after 50. The same at 800 km: 44,900 still there after 50 years.
- Spent stages (2 t) at 800–850 km plus one 1 t breakup: 100 stages R0 ≈ 10, the next breakup due in ~350 years (quiet);
  400 → R0 ≈ 39, ~90 years (the warning); 1,500 → R0 ≈ 150, ~23 years (*feeds itself*). On the light setting (a tenth),
  ten times the clutter for the same.

Test `space-5` (6 checks; mutations caught: no catastrophic threshold, crew hit, no flow down, no R0, double count).
Full suite 572 pass. No TESTING row yet: nothing in the UI makes fragments by hand (Q148's band view and a tester ASAT).

## v1.86 — dispatched flights leave debris too (2026-10-09, space session, QUEUE Q149)

A dispatched flight (`dispatchRun`, flown headless by `procFly`) used to leave nothing: `procFly` restores the noted
pieces so dry runs stay clean. Now `procFly(…, {keepJunk: true})` hands back what its own flight dropped (`out.junk`,
with `out.T0`, the program time it lifted off), and `dispatchRun` passes it to `junkAdd(list, T0)`, the same
registration a hand-flown flight's end uses (`junkRegister` is now `junkAdd` over that flight's pieces). Dry runs and
supply runs don't ask for it, so they still leave none. In practice the presets' boosters fall back, so dispatches
rarely leave anything; designs that stage in orbit do.

Not done here: the dispatched **payload** itself still isn't registered (only its contract is settled). That's Q49,
"missions in flight". Test `space-6` (1 check; mutations caught: nothing handed back, pieces leaking into the global
list); the one-line call in `dispatchRun` isn't driven by a test (a full dispatch needs a contract and a dispatch record).

## v1.87 — the orbital period waits for the engines to stop (2026-10-09, space session, QUEUE Q114, PLAYTEST #30)

`missionTick` noted the first orbital period (around Tellus, `period`; around Selene, `sorbit`) the moment the orbit was
bound with its periapsis clear, which is partway through the burn that closes it: the robot's Selene probe logged
"1,521.9 min at 3,112 km" for a 200 × 20 km capture. Now both wait for a coast (`coast`: no engine burning); the Δv to
low orbit is still noted when the orbit closes, since that's what it measures. Test `space-7` (mutation: no coast gate).

## v1.88 — station-keeping checked against a real controller (2026-10-09, space session, QUEUE Q142; study only)

v1.71 charges a held orbit the net change in its size and shape over 20 days; a crude controller (one burn to reverse
the drift) had pumped the eccentricity, so it measured nothing. `study_slot.mjs` part D now flies a TV satellite over the
capital on the full physics for 3 years, its tilt free as in v1.71, with a proper controller:
- **Shape:** e held under 0.01 (TV needs < 0.02) by a retrograde burn at perigee and a prograde one at apogee (no net
  change of size): 12–15 m/s a year.
- **Size, so the longitude:** every 13 days, the mean size (daily samples at the same phase, averaged over 13 days)
  is aimed at the value that brings the longitude back to its slot over τ days, by a pair of along-track burns half an
  orbit apart (that changes the size without pumping the shape).

| τ | Δv a year | worst off the slot, after the first 120 days |
|---|---|---|
| 20 days | 67 | 25° |
| 40 days | 54 | 40° |
| 80 days | 46 | 63° |

v1.71's `slotRate` for the same satellite: 0.221 m/s a day = **89 m/s a year**, so the model is in the right range and
on the conservative side (1.3–1.9× a controller that keeps it within 25–60°). No change to the game. Negative results
on the way: reversing the measured daily drift chases the moons' periodic swing (the size swings ±40 km with Selene's
13-day period, the longitude ±6°) and cost ~3,000 m/s a year; reversing a 26-day drift with a cooldown overshot by 100°+.
The controller's first 13 days are open loop (60° off before it acts).

## v1.90 — missions in flight, slice 1: nothing coasting is lost at flight end (2026-10-09, space session, QUEUE Q49)

Slice 1 of § "Plan: missions in flight" (below).
- **Settled or in flight** (`settled(B, el)`): a satellite's orbit is closed, clear of the air or ground, inside its
  body's SOI and now also **short of every moon's** (apoapsis under the moon's closest approach less its smallest SOI).
  A Selene transfer used to register as a Tellus satellite and ride Kepler rails straight through Selene; now it's in
  flight. Stationary orbits stay satellites (Nyx's sphere never comes inside ~7,700 km; stationary is 6,942).
- **Cruise entries** (`q.cruise`): `satRegister` registers anything not settled but above the air at flight end as an
  entry in flight (same record: flyable again, kit, shape). The flown vessel and FLEET vessels alike. In the air at
  flight end: dropped, as before.
- **Between flights** (`cruiseStep` in `orbTick`): leg by leg with the predictor (`predictFrom`, program time): into a
  moon's sphere (news), out of one, Kepler or integrated where a moon perturbs. When its orbit settles it becomes an
  ordinary satellite (news; the v1.60+ rules then apply). Before an atmosphere it stops at the top and **waits there,
  flyable** (news; time doesn't move it, a stopgap until slice 2 stops the clock first); on an airless body it's lost
  (news).
- `satsUp`/`moonSats` leave cruise entries out (no TV, contact, conjunctions or targeting while in flight).
- **Program screen:** *In flight* (Fleet tab; `progTabOf` gets the heading, flow's file, one word): each entry, its height
  over its body, what's next (`cruiseNext`: heading into a moon's pull, leaving, falling into the air, on course to
  strike) and when; **Fly** where flyable.

Test `space-8` (2 checks; mutations caught: moon reach ignored, no cruise entries, halt not held, `satsUp` including
cruise entries). Test 40 updated: the two Selene orbits it refused (3 km periapsis, apoapsis past the SOI) are now in
flight, still not satellites. Full suite 583 pass; `career.mjs` unchanged. TESTING row 168.

## v1.91 — missions in flight, slice 2: on the timeline, no silent misses (2026-10-09, space session, QUEUE Q49)

`cruiseEvents(T)` gives each vessel in flight its next event, and the economy's `upcoming()` lists them (one line in
`sim/program.js`, flagged), so *Coming up* shows them with a Wait button and `advanceTo` stops at them:
- **reaching an atmosphere**: always stops time (then the vessel waits at the top, flyable, as in slice 1);
- **an impact course** (an airless body): always stops, 3 h ahead (`CRUISE_LEAD`), so it can be flown;
- **entering a moon's sphere**, and **the closest approach** there (3 h ahead: the moment for a capture burn): stop
  time **once per vessel and body** (`q.seen`, set by `advanceTo` through `cruiseSeen`), then only show, as LATE_GAME
  asks ("stops it too, once").
Leaving a body's pull is shown but never stops (nothing to decide).

Measured on a Selene transfer: listed on day 0 as *enters Selene's sphere* on day 1.69; Wait stops on day 1.686; the
next stop is *passes 1,721 km above Selene: the moment for a capture burn*, 2.9 h before periapsis. A capsule falling
home from 5,000 km stops when it reaches the air (day 0.198) and waits there.

**Not yet:** *Let it go* (an atmosphere entry flown headless with the vessel's chute and shield, an impact left to happen
with a button rather than by waiting): today waiting past an impact stop crashes it (announced), and a vessel at the top
of the air waits until flown. Test `space-9` (2 checks; mutations caught: `advanceTo` not marking seen, never stopping,
seen ignored, no lead).

## v1.92 — a dispatched flight's payload stays up (2026-10-09, space session, Q49 follow-up)

`dispatchRun` settled the contract and dropped the vessel (pillar 3: what you launch stays). It now registers `f.s`
like a hand-flown flight's end does: a satellite if its orbit is settled, else a vessel in flight (v1.90). `satRegister`
takes `R.T` for the epoch when the flight's own clock isn't `simT` (a headless flight's, restored by `procFly`).
`career.mjs` is unchanged (its flights are abstracted). `bodies-2`'s "same seed, same flight" now restores the registry
between its two runs: the first payload sat on the second's path, and flying near it is physics, not rails.

## v1.93 — planned burns travel with a vessel in flight (2026-10-09, space session, QUEUE Q166, Q49 slice 3)

- **Carried:** at flight end, the vessel's maneuver nodes still ahead (`s.node`, `s.nodeQ`) go with its registry entry
  as `q.nodes` (program time `T`, Δv in the node's frame, the body whose leg it's on); `vesselOf` gives them back in the
  next flight's time, so flying it again shows the plan where it was left.
- **On the timeline** (`nodesEvents`, one line in the economy's `upcoming()`, flagged): each planned burn always stops
  time, 3 h ahead: *a planned burn (50 m/s): fly it, or hand it to mission control*.
- **Mission control** (`nodeHandOff`; the *In flight* line's button): at its time the burn is flown as an impulse from
  the vessel's own tanks (`skSpend`), with the computing era's execution error (`BURN_ERR`: 5 % with human computers,
  2 % with mainframes, 0.2 % with onboard computers, on size and direction), so an early arrival needs a correction. A
  burn the tanks can't cover is flown as far as they go (news). Measured: a 50 m/s raise from 300 km in the first era
  came out at 52.3 m/s (353.9 km instead of 349.5).
- **Missed:** passed with nobody at the controls, a burn is dropped (news); the vessel carries on (pillar 5).
- A burn that leaves a satellite's orbit puts it in flight (v1.90 rules from there); one that settles a vessel in flight
  makes it a satellite at its next step.

**Not yet:** mission control needing contact (Q51: a burn out of contact needs an onboard computer of the right tier),
finite burns (they're impulses), and burns on a leg after an SOI change (they're flown on whatever leg the entry is on at
their time). Test `space-10` (3 checks; mutations caught: never fired, missed ones fired, a burn way off, no events,
not carried). Full suite 600 pass.

## v1.94 — the star system on paper (2026-10-09, space session, QUEUE Q87 slice 1, sim half)

New `sim/system.js` (after `sim/space.js`): the planets of [`SYSTEM.md`](SYSTEM.md) where they really are, for the map
from epoch 1 (PLAYTEST #11). Positions only: no physics, no heliocentric legs (that's slice 2, at M5).
- `SYSTEM_BODIES`: one table (name, a in TU, e, i, node, perihelion, phase, radius, gravity, a map colour), so a rename
  is one edit (SYSTEM.md: names are placeholders). Nodes, perihelia and phases aren't in the catalog: fixed defaults;
  Erebus's 2:1 phasing with Hyperion is a later refinement.
- `TU()`: what makes Tellus's year exactly 400 program days at Helios's μ 1.17e18: **15.78 Gm** (SYSTEM.md: 15.8).
- The ecliptic is tilted 23° to Tellus's equator (SYSTEM.md decision 3) and turned so that **on day 0 the real
  direction to Helios is the renderer's fixed `SUN_DIR`**: the map and the sky agree at the start (they part as the year
  turns, until slice 3 moves the renderer's sun). Tellus is placed by its true anomaly (by its mean one the sun was
  1.9° off).
- `helioPos(name, T)` (heliocentric, Tellus's axes), `fromTellus(name, T)` (and `'Helios'`), `planetPeriod(name)`.

Measured: periods Hesper 0.61 y (244 d), Enyo 1.87, Astraea 4.61, Hyperion 11.86, Erebus 23.70 years, as SYSTEM.md;
Enyo's closest approaches 2.12, 2.15, 2.19 years apart (its windows: 2.14). Test `space-11` (2 checks; mutations
caught: the wrong year, the wrong tilt, Tellus by mean anomaly). The drawing (discs and labels on the map's zoomed-out
view) is flow's, proposed in QUEUE.

## v1.95 — the automation ladder as one table (2026-10-09, space session, QUEUE Q127 slice 1)

`autoAllowed(kind) → {ok, why, era}` in `sim/procedures.js`, with `AUTO_LADDER` (the plan's table: § "Plan: the
automation ladder"): a flown ascent from the start; mission-control burns, deployments and crewed docking from
mainframes; uncrewed docking and moon runs from onboard computers; planets from cheap compute; assists from the AI boom.
- The economy's supply runs ask it (`baseRunQuote`, one line, flagged; same refusal text as before: "needs onboard
  computers: uncrewed runs to the moons arrive with them"); `BASE_ERA` stays for its other readers.
- Mission control's hand-off (`nodeHandOff`, v1.93) asks it: before mainframes it's refused, "Mission control needs
  mainframes: until then burns are worked out by hand, so fly it yourself", and the *In flight* line shows that instead of
  the button.
- In a bare sim the eras fall on day ~1,500 (mainframes) and ~3,000 (onboard computers).

Test `space-12` (1 check; mutations caught: burns from the start, the hand-off ungated); `space-10` moves to day 2000 so
its hand-offs are allowed. `career.mjs` unchanged.

## v1.96 — the link budget: every link has a rate and a light delay (2026-10-09, space session, QUEUE Q171, Q51 slice 1)

`sim/space.js` (next to the ground stations): rate = `LINK_K` · P · Gt · Gr / d² bit/s, the free-space law with the
era's receivers in one constant; gains `G_WHIP` 1 (the `ant` part), `G_RVHG` 30 (a rover's high-gain dish), `G_STATION`
3e4 (a station's 26 m-class dish); radios `P_RADIO` 5 W (the antenna's load, v1.68), `P_ROVER` 20 W; a vessel with no
antenna is a 1 W beacon. `LINK_FLOOR` 10 bit/s is telemetry's floor.
- **Measured:** a whip 300 km straight over the pad, **333 kbit/s**; around Selene, **20.5 bit/s** at 38.3 Mm with a
  255 ms round trip, still above the floor, so the moon missions keep their link as before.
- **Where it shows** (additions only; which links exist is unchanged): `linkOf` (the flight's link, world's file,
  flagged) returns `rate`, `d`, `delay`; imagery's contact share also records `q.rate`, the mean rate while in contact;
  `rvContact` returns `rate`, the weaker hop when a relay carries the path.
- Slice 2 turns data into volumes drained at these rates; slice 3 draws coverage; the automation ladder's contact gate
  (Q127 slice 3) reads `pathHome` once relays are nodes.

Test `space-13` (1 check; mutation caught: 1/d instead of 1/d²). The rover and imagery rates aren't driven by a test
yet (both need their heavier setups); slice 2's tests will drain volumes through them.

## v1.97 — the last Debrief survives a reload (2026-10-09, space session as overflow, QUEUE Q100)

- `debriefOf` also keeps the record in `PROG.lastDebrief`, so it's saved with the program; `debRestore()` (sim) brings
  it back into `DEBRIEF_LAST` after a save loads (`app/state.js`, one call, flagged for flow). The *Last flight* button
  works after a reload.
- `debOutcome`: a vessel registered **in flight** (v1.90: above the air, in no lasting orbit) reads **In flight:
  carries on between flights**, not "Ended in flight: written off" (which still applies to one left in the air).
Test `space-14` (1 check; mutations caught: not saved, written off again). TESTING row 172.

## v1.100 — data as a volume: recorders, downlinks, pay on data received (2026-10-09, space session, QUEUE Q172, Q51 slice 2)

Instruments make bits, a recorder holds them, a link drains them at its rate (v1.96's budget), and data counts once it's
home. Constants next to the link budget in `sim/space.js`: `CAM_BPS` 100 kbit/s (a survey camera's take: about one
1960s TV frame, `IMG_FRAME` 1.5 Mbit, every 15 s), `REC_CAP` 360 Mbit (an hour of it on tape), `FAR_BITS` 20 kbit (the
far side as slow-scan), `TLM_BITS` 1 kbit (a telemetry reading). A registry entry's radio is now its antenna count
(`satRadio`: 5 W a whip), no longer read off its render shape.
- **Imagery sales** (`satTick`): every 2-minute sample the camera fills `q.rec`; in contact the pass drains it at the
  link's rate; the sale is `IMG_RATE` per day's take received (`q.got`, all time). `q.contact` is still measured (the
  logbook, `contracts.js`'s upgrade offer and the Fleet line read it).
- **Measured** (pad only, 20 days, polar): 300 km, contact 5.8 % at 79 kbit/s → **4.9 %** of the take home (sales as
  before, within ~15 %); 2,000 km, contact 21 % at 5.4 kbit/s → **1.0 %** (before v1.98 it earned 21 %). Earlier
  measurement with five stations: 300 km 31 % contact at ~100 kbit/s, 800 km 75 % at 22 kbit/s, 2,000 km 98 % at 5 kbit/s.
  **The balance change:** with a whip, higher is slower by 1/d², so imaging pays low; a high orbit needs a dish (vehicle,
  a gain class) to earn. Retune with `CAM_BPS` (where the take saturates) or `IMG_RATE`.
- **Contract pictures:** a picture is a frame; a pass downlinks as many as its rate allows in each 30 s step, oldest
  first (`q.pendB` carries a part-sent frame); undelivered ones wait for the next pass (before: all at once on any pass).
  At 300 km that's ~1.5 frames a step, so nothing changes in play; slow links now queue.
- **The far side** (`outThere`): in sight of Tellus the pictures trickle down at the link's rate (`R.farGot`): **16 min**
  from Selene on one whip at 20 bit/s; carried home they still count. Before: on the first moment in sight.
- **The flight's recorder:** readings logged out of contact (v1.x, terrain session) now **play back once the link
  returns** at `TLM_BITS` each (`R.recB`), in flight or on rails; landing with the package still brings them all.
  So a blackout's strain readings certify after the blackout, not only on a recovered package.
- **Flow:** the Fleet line (`app/program-ui.js`, one template) adds the rate and the recorder fill after "in contact".
- **Not in this slice:** rovers' science volumes (they already wait for contact: `rvSciSent`); imagery and contract frames
  draw on separate budgets (a pass downlinks both in full); the transmitter's power draw (Q27, after Q164).

`career.mjs` unchanged, bit for bit (its robot flies no camera satellites). Test `space-15` (2 checks; mutations they catch, reasoned not run: drain without the rate (2,000 km earns its contact share), the far
side sent on sight, no playback). Tests 23, the stations section and telemetry unchanged. TESTING row 176.

## v1.102 — contact gates automation (2026-10-09, space session, QUEUE Q186, Q127 slice 3)

Before onboard computers a command needs a station in contact: mission control flies a planned burn (v1.93) only if it
can reach the craft at the burn's time. From onboard computers the craft runs stored commands, out of contact too.
- `entryLink(q, T, r)` (`sim/space.js`, next to the link budget): a registry entry's link home. Around Tellus, a ground
  station in view; elsewhere, Tellus not hidden behind the body and v1.96's rate above `LINK_FLOOR`. So at Selene a whip
  is heard except from behind the moon, and a craft with no antenna (a 1 W beacon) is too far for its radio.
- The ladder (`AUTO_LADDER`, `sim/procedures.js`) gains `blind: 'board'`: a ground-commanded step run out of contact.
- `handOffWhy(q)`: the era (Q127), then contact. A satellite on its rails has a known place at the burn, so a hand-off
  that would be out of reach is **refused up front**: "can't reach Lookout 1 at the burn (no station in view);
  onboard computers could fly it out of contact: fly it yourself, or build a station under it". A cruise entry's place
  isn't predicted, so it's checked when the burn comes. `nodesTick`: a handed burn with no link at its time **passes
  unflown** (news says why), as a missed burn does: a wait, never a failure.
- **What it means in play:** with only the pad's station, a low satellite is in view ~5 % of the time, so in the
  mainframe era most burns in Tellus orbit are yours to fly unless stations cover them; burns on the way to Selene are
  nearly always in reach.
- **Flow:** the burn line in the Fleet list (`app/program-ui.js`, one template) shows `handOffWhy`'s reason in place of
  the button, as it already did for the era.
- **Not in this slice:** deployments (dispatched flights are abstracted, with no time to check); rovers already wait for
  contact; planned burns can't be moved from the Program screen yet, so a refused one can only be flown.

Tests `space-16` (2 checks: refused at hand-off; passes when handed over anyway; flown blind with onboard computers;
Selene's shadow and the beacon); `space-10` and `space-12` now put their burns where a station sees them, and space-10's
orbit check uses exact vis-viva bounds (its linear guess missed ~0.14 %, which the moved burn's error then exceeded).
TESTING row 181.

## v1.105 — the Probe makes its own power (2026-10-09, space session as vehicle overflow, QUEUE Q164)

The Probe is the only preset with an antenna: 15 W of antenna and camera on a probe core's 0.5 kWh, flat in ~33 h, which
blocked Q27 (gating a satellite's service on power would have ended every Probe satellite after a few days).
- `PRESETS.Probe` is now a v2 design (as `PRESETS.Docking`): the same stack with **three body-cell panels** (`bpanel`,
  40 Wp each, a third of it on a skin) on its upper tank, the stage it keeps to the end. +30 kg, +6M. Its place in the
  preset list is kept (a `Probe: null` key, set after `toV2`).
- **Measured** (`powerBudget`): low orbit 24.1 W average against 15 W (eclipse 37 %), 1,000 km 31.1 W, Selene 27.5 W;
  each eclipse needs ~4–5 Wh of the 500. Ten days on rails never dip below a full battery.
- **Economy (flagged):** the +6M put farside, selimp, nyxfind and nyxfly at 1.27× the Probe's full cost, under the
  1.3× pay floor (NOTES v1.53 / v1.77), so they pay **240M** instead of 230 (1.33×). And three checks refused any
  design that isn't a v1 part list (`Array.isArray`): `baseRunQuote` ("no design in Assembly"), `dryQuote`, and the
  dispatch candidates from `PROG.procs`; they now accept v2 designs too.
- **Saves and tapes:** the Probe's design key changed, so an ascent procedure recorded for the old Probe no longer
  matches it (re-fly the ascent once). Q152's lander (on `builder`, unmerged) is the Probe with legs: it should start
  from this v2 Probe.

Test `space-17` (1 check: budget positive in low orbit and at Selene, cells on the antenna's stage, ten days on rails
never flat). Tests 23 (the pay floor) and econ-7 (supply runs) pass again after the two fixes. `career.mjs` (10 seeds, 3 years): final funds 702 → 659M on average (most starts −5 to −20 %, frugal ones richer), firsts and bailouts unchanged; Caio took it as is. TESTING row 185.

## v1.108 — power gates a satellite's service (2026-10-09, space session, QUEUE Q27)

v1.68 put power on vessels and left "what a flat battery does to their service" to the space lane; v1.105 made the
Probe power-positive, so this no longer ends every Probe satellite.
- **At registration** (`satPowInit`, `sim/power.js`): the entry keeps `powerBudget` for its own orbit (`q.pw`: average
  generation, load, eclipse share, battery and what one eclipse needs, peak, RTG) and its charge (`q.Ewh`).
- **Between flights** (`satPowTick`, first thing in `satTick`): a power-negative design drains its battery. `satDuty(q)`
  is the share of the time it can work: 1 on the battery; once flat, the sunlit share as far as its cells (and RTGs)
  cover the load; 0 with no cells. A design whose battery can't cross an eclipse loses the rest of each one. News when it
  first drops: "batteries are flat: it works only in sunlight now, 60 % of the time" / "has gone quiet".
- **What it gates:** the camera's take and every downlink (imagery sales, contract frames), TV income, `entryLink`
  (a flat, cell-less satellite can't be reached: mission control and rover relays), and navigation (a fix needs power
  round the clock, so `navCover` counts only `satDuty` = 1). Collisions, decay, station-keeping: unchanged.
- **Measured** (300 km, inclined): the pre-v1.105 Probe (no cells, 15 W on 500 Wh) is flat between day 3 and day 12 and
  silent after; with one panel (9.0 W average) it ends at 60 %; the v1.105 Probe (26.9 W) never runs down.
- **Saves:** entries registered before this have no `q.pw` and work as before.
- **Made visible, not a trap:** a satellite with no power source at all (an antenna on a tank and an engine, which earned
  TV and imagery money before) is silent from day one. So the weather, TV and navigation briefs now say "it needs power
  between flights: the battery in a probe core lasts days, solar cells keep it going" (economy's table, flagged), and the
  registration news warns: "its battery lasts about 4 days; then it goes quiet (solar cells would keep it going)", "it
  has no power of its own", or "its battery can't cross an eclipse" (`satPowNote`).
- **Flow:** the Fleet line (`app/program-ui.js`, one template) adds "batteries flat: works N % of the time, in sunlight"
  or "silent".
- **Not in this slice:** landed entries (bases, landers: their crews and RTGs are another budget); recharging a flat
  battery by servicing; a relay's own transmit draw (Q173).

Test `space-18` (1 check: three designs, flat in days, sunlight-only, never; no pictures and no link once silent; the
news and the registration warning). Test 24's TV and disaster-watch satellites (an antenna on a tank, no power) now carry
a probe core and three panels of cells. `career.mjs` (10 seeds) identical: its robot registers no powered services.
TESTING row 188.

## v1.109 — relays as nodes: one hop, coverage, links home on the network screen and the map (2026-10-09, space session, QUEUE Q173, Q51 slice 3)

Slice 1 gave every link a rate; this lets a registered satellite reach home through another one, measures coverage,
and shows both.
- **One relay hop** (`entryLink` → `entryDirect`, then `entryRelay`, `sim/space.js`): an entry out of contact goes
  through any registered satellite with an antenna (`relayEntries`) that is powered at that moment and has its own
  direct link, when no body is in the way (`losClear`) and the hop clears the telemetry floor by v1.96's budget. The
  rate is the weaker hop; the result says `via`. So mission control (`handOffWhy`, `nodesTick`) reaches through relays.
- **Measured:** a whip hears a whip out to ~316 km (11 bit/s at 300 km, 1 bit/s at 1,000 km), so between satellites
  relays work only in a close formation until there's a dish (vehicle's proposed part: the code reads the gain from
  `satRadio`, so a dish only changes that). Rovers and landers on a moon (`rvContact`) already relayed, with their
  own high-gain antennas.
- **Relay power** (`satOn(q,T,r)`, Q27's other half): a satellite on its battery is always on; a flat one only for its
  `satDuty` share, in sunlight (spread over the hours), so a flat relay relays nothing in shadow, and a silent one
  never. `rvRelays` asks it for each moon relay.
- **Coverage** (`coverOf(B,T)`, memoised per day): Tellus, the share of a low (300 km) satellite's sky with a station in
  view: 10 % with the pad alone. A moon, a lander or rover with a high-gain antenna anywhere on its ground, over the next
  day, near and far sides apart: Selene alone 100 % / 0 %; one polar relay at 1,000 km, far side 37 % (test 40's
  ~35 %); two relays 47 %.
- **Links home** (`netLinks(T)`): each orbiting entry over the next day: share with a link, longest gap, relays used,
  and a flag when mission control holds its next burn and it falls in a gap ("mission control can't reach it at its
  burn in 0.3 days": the burn would pass). `netModel` (economy's, one line flagged) returns `links` and `cover`.
- **Flow (flagged, restyle freely):** the network screen gains *Links home* (`netLinksHTML`, `app/network.js`, one call
  in `renderNetwork`); the map draws each satellite's link right now (`mapLinks`, `app/render.js`, one call in
  `drawMap`): a line to the station that hears it (or to Tellus's limb from a moon), or to its relay; the paper map
  inks it like the orbits. Checked in Chrome: two Selene relays and a Tellus pair, both screens as described.
- **Not in this slice:** chains of relays; imagery through relays (its pass loop still asks stations; whips wouldn't
  reach anyway); a relay's transmit draw beyond its antenna's 5 W; coverage drawn as an area on the map.

Test `space-19` (1 check: the hop and its rate, none through a flat relay; Selene's far side 0 → ~35 % with a relay,
0 with a flat one; the flagged burn). `career.mjs` (10 seeds): identical to `main` (its robot registers no relays). TESTING row 189.

## v1.123 — a revert discards the flight (2026-10-11, space session, QUEUE Q257; PLAYTEST #56)

Caio reverted a flight and found its rocket in the registry as "Object 1". `resetShip` began with `missionEnd(S)`, so a
revert *settled* the flight like *End flight*: the coasting vessel joined the registry, the pay and the logbook were
written, the flight was counted. A revert now goes back to launch, as KSP's does:
- **`REVERT0`** (`sim/program.js`): the moment a flight lifts off (`missionTick`'s launch block, before it charges the cost,
  the ops and the site fee or passes the prep days), `JSON.stringify(PROG)` is kept with the flight's record `R`. It lives
  beside the record, never on it: `satRegister` and the cruise entries keep `R`, and a snapshot there would nest in every
  save. `flyEntry` (flying a registry entry) takes it before the entry leaves the registry and the ops are paid.
- **`missionDiscard(s)`**: restores `PROG` in place from that snapshot and marks the record ended (`R.reverted`), so
  `missionEnd` does nothing afterwards. Without a snapshot (a save loaded mid-flight) the flight is dropped unsettled:
  nothing registered or paid, nothing given back.
- **`revertFlight()`** (`app/state.js`): the one revert, used by the button (Esc menu) and the R key. The R key used to
  skip the "handed over from a dispatch, no revert" check; it doesn't now. It saves after restoring.
- **Unchanged:** a flight already settled (left for another screen, PLAYTEST #21) can't be reverted into; loading a design
  or starting a procedure or a tape still settles the flight in progress, as before.
- **Test:** `space-20` (`tests/space.mjs`): an Orbiter 40 s into its climb, discarded: the program is byte-identical to its
  liftoff state and `missionEnd` returns null after.
- **Next:** D15 (5) replaces revert with a simulator for real flights; this is the revert that simulator will wrap.

## v1.124 — a rotation's days in space in the Debrief (2026-10-11, space session, QUEUE Q214; v1.107's "Not yet")

A crew brought home from a station read "home safe after 2.1 days": the Debrief knew only the flight that brought them
down. Now each crewed capsule carries **the day its crew went up**:
- **`shapeOf`** writes `o.up` beside `o.crew`: the part's `crewUp` if it has one, otherwise `PROG.day`, which during a
  flight is that flight's liftoff day (days pass only when it settles). **`vesselOf`** reads it back as `p.crewUp`. Those
  two are the only ways a crew goes into and comes out of the registry (flying an entry, loading one, undocking), so the
  day survives any number of round trips.
- **The Debrief** (`sim/debrief.js`): the earliest `crewUp` aboard (never later than this flight's `day0`) gives
  `D.crew.before`, the days in space before this flight; the line becomes **"Crew of 2 home safe after 33 days in
  space"**. A crew launched this flight reads as before ("…after 2.5 days"). Older saves have no `up`: as before.
- Per capsule, not per person: crews don't move between capsules and habitats yet. The station's own `crewDays` (the
  "people live in space" milestone) is unchanged.
- **Test:** `space-21`: a capsule registered on day 10, flown home from day 40 for 2.5 days.

## v1.125 — rover science as volumes; one pass budget for a satellite (2026-10-11, space session, QUEUE Q198; v1.100's "Not in this slice")

v1.100 made satellite data a volume; rover readings still went home whole the moment there was contact.
- **Readings are bits** (`sim/rovers.js`, `RV_BITS`): a spectrum 20 kbit (~1,000 channels), a panorama one survey frame
  (`IMG_FRAME`, 1.5 Mbit). `rvDrain(data, contact, dt, by)` sends them oldest first at the contact's rate and hands each
  finished one to `sciGot`; a part-sent reading keeps what's left in `x.b`. `rvSciSend(R, c, dt)` (the driven rover, each
  step) and `rvFieldSci` (rovers in the field between flights, half-hour steps through `radioAt`) both use it. No rate
  (home on Tellus): at once. Readings in older saves have no `b`: at once, as before. A crew aboard still keeps them.
- **Measured** (test `space-22`, from Selene's near side): the high-gain dish direct to Tellus **2,481 bit/s**: a
  panorama in **10 min**, a spectrum in 8 s. A **whip through a relay 1,000 km up: 4 bit/s** (the rover-to-relay hop
  has no station dish; v1.109's model): a panorama **4.3 days**, a spectrum 83 min. So the dish is the imaging choice and a
  whip rover is a spectrometer rover. If that feels harsh in play, the lever is a dish on the relay (Q217), not the bits.
- **The message** after a reading says how long it will take ("· sending, 10 min") instead of nothing.
- **One pass budget** (`sim/space.js`): a satellite's contract frames and its imagery shared nothing (a pass downlinked
  both in full). Now each frame sent is owed (`q.owe`) and the next imagery drain pays it first. A frame is 1.5 Mbit,
  about 16 s of a 300 km pass at ~95 kbit/s: imagery sales barely move (test `space-15` unchanged).
- **Tests:** `space-22` (new); section 42 gives its send a minute of contact.

## v1.126 — landers' power; a flown satellite keeps its charge; docking recharges (2026-10-11, space session, QUEUE Q213; v1.108's "Not in this slice")

- **Landed entries** (`landPowInit`, `sim/space.js`, called by `landRegister`): a lander or base keeps `q.pw` and `q.Ewh`
  as a satellite does, with its site's night for the eclipse. One of its body's days is sampled at its spot (48 points):
  the cells' mean is the sun's height averaged (`landLit`), the night the share below the horizon, the battery's `need`
  that night's load. `satPowTick`, `satDuty` and `satOn` then work unchanged (`satOn` asks `landLit` instead of the
  orbit's shadow). Only Tellus and the locked moons turn on our rails; a lander elsewhere keeps the light it landed in.
- **Measured** (`space-23`, the Probe set down on Selene's near-side equator): a 104 h day, night 50 %, cells 32 % of
  peak on average (1/π, as a flat panel should); load 15 W against 12.1 W: flat after 22 days, then it works by day
  only (50 %).
- **What it gates:** a lander's antenna as a rover relay (`rvRelays`: skipped when silent, otherwise only while powered,
  `on`, as orbiting relays since v1.109). Bases' crews and supplies are unchanged (LATE_GAME's dormant node is later).
- **Flying an entry** (`vesselOf`): the battery as it is now (`q.Ewh`), not as it was registered. Before, a satellite
  that had run flat between flights came back full when flown.
- **Servicing** (`dockCharge`, in `dockTryV`): two vessels docking share charge: the fuller tops up the emptier, keeping
  half its own. Undocked or flown home, the serviced one is registered with that charge (`satPowInit` reads `s.E`).
  A message says so ("batteries charged to 100 % from …"). Docking a composite that stays together: still only the
  host's own parts count for its power (the v1.108 limit).
- **Tests:** `space-23` (new); `space-18`, `space-19`, 42, docking and stations unchanged.

## v1.127 — debris that exists only as you pass (2026-10-11, space session, QUEUE Q200; Caio 2026-10-09)

Fragments (v1.83) were a density per band that hit registered entries between flights; a flight flew through them untouched.
- **`fragPass(s, dt)`** (`sim/space.js`, from `missionTick` each step, physics or rails): in orbit of Tellus, inside a
  band with fragments, the same rate as between flights, λ = 4 n R² v (R the craft's half length, v the band's orbital
  speed), scaled by the debris setting. Seeded per flight (`R.fragRng`), so tapes and procedures repeat.
- **A hit is rolled `FRAG_LEAD` (3 s) ahead:** `s.fragIn` holds the fragment on its way (size by the L^-1.71 law from
  1 cm, capped at 50 cm; a crossing speed 0.3–1.7 × v; a direction in the local horizontal) and **`HOOK.fragIn(s, x)`**
  is there for a view to draw it coming (no view yet: Proposed for look & sound).
- **`fragStrike`**: it strikes one part, chosen by size (mass^⅔). Solar cells and antennas are lost to any piece;
  anything else only to 40 J per gram of the part (v1.83's shattering rule): a 1 cm piece at 10 km/s brings 26 kJ and
  dents a tank, a 50 cm one (3.3 GJ) destroys even a full 32 t tank (30 cm, 0.7 GJ, doesn't). A message says which.
- **Crewed craft are warned, not struck** (as between flights, pillar 5): one message a flight when the band passes
  `CREW_WARN`, "about one hit in N years".
- **The odds** (test `space-24`): after one 1 t breakup at 400 km, the Probe stack through the thickest band: **0.14
  hits a year**, about one in 70,000 flight-hours. Strikes come with a cascade or an anti-satellite test, as they should.
- **Not yet:** a hit that punctures a tank (a leak) or damages instead of breaking; the fragment drawn (HOOK.fragIn).

## v1.210 — a debris hit holes a tank or damages a part (2026-10-13, space session, QUEUE Q303; v1.127's "Not yet")

v1.127's strike had two outcomes: a part lost, or "dented, no harm done". Now a hit can be in between (`fragStrike`,
`sim/space.js`):
- **A tank is holed** (fuel or the gas bottle's gas) when the piece gets through its wall: crater depth
  0.91 L (vn / 7 km/s)^⅔ (a 1 g/cm³ piece into aluminium, the thin-plate rule's shape), holed past 1.8 × a 3 mm wall;
  vn is the speed along the wall's normal, cos θ from a cosine-weighted roll. So a 1 cm piece holes a tank if it meets
  the wall faster than ~3.2 km/s; a glancing one dents it. The hole is about the piece's size.
- **The leak** (`leakTick`, from `missionTick` each step): the orifice law, fuel at 3 bar (**a 1 cm hole: 1.15 kg/s**,
  an 8 t tank in ~2 hours), gas from 200 bar falling as the bottle empties (choked: 2.2 kg/s at first, a 15 kg bottle
  mostly gone in ~10 s). **The jet pushes and turns the craft** through the hole's normal (the side the piece came
  from), about the centre of mass: fuel's jet is ~25 m/s (28 N for a 1 cm hole: 0.18 m/s and ~0.02 rad/s on a 9.5 t
  stack in a minute), gas's ~400 m/s (a kick of ~900 N). In physics steps only: on rails it only drains. A message says
  the rate and the time to empty; another when it's dry.
- **At flight end** a tank still leaking joins the registry empty (`leakDry` in `satRegister`), so station-keeping
  sees what's left.
- **A solar wing loses a string**: a quarter of its output (more for a big piece), lost once nothing is left; the power
  budget reads `p.dmg` (`sim/power.js`). Antennas are still lost to any piece.
- **Anything else gathers damage**: its share of the shattering energy (below a tenth: a dent), lost once that adds to
  one. **Not yet:** damage does nothing else (a hit engine burns as new: Proposed); a leak's jet drawn; holes on the
  registry's satellites between flights (they are struck by `fragTick`, lost or not).
- Test `space-25`.

## v1.2XX — a docked composite's power counts its passengers (2026-10-13, space session, QUEUE Q304; v1.126's limit)

Docked, only the host's own parts counted for power: a satellite brought to a station drew nothing and gave nothing.
- **One store** (`sim/power.js`, `powEach`): `powCap`, `powLoad`, `powRTG`, `powSun` and `powPeak` walk the vessel's
  parts and every passenger's registry shape (`s.att`). A passenger's wings are out unless it was left with them folded
  (its `vst.dep`); its cells see the sun through its attitude on the vessel (`a.q`), so a wing on a passenger docked
  crosswise is lit as that wing is turned, not as the host's.
- **Charge:** at `join` the passenger brings what it holds (`storeOf`: a vessel's `E`, an entry's `Ewh`, or its `vst.E`;
  full if nothing says). At `undock` the store is split by battery capacity (`battCap`), so both leave at the same
  share of full; the entry keeps it as `Ewh` (and `vst.E`), a vessel as `E`. `dockCharge` (v1.126) still runs first and
  its message still says what moved; with the shared store, what each side leaves with is the split.
- **Registration:** a composite registered at flight end gets one power budget for all of it (`satPowInit` →
  `powerBudget` now counts passengers); the docked entries ride in its `attached`, as before.
- **Solar damage** (v1.210 `p.dmg`) is kept in the shape (`o.dmg`) and restored by `vesselOf`.
- **Not yet:** a passenger's computer for the composite's avionics (`hasComputer` is still the host's), and its crew.
- Test `space-26`.
