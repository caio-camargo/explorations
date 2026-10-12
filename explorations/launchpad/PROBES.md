# PROBES — payload parts, asymmetry, pointing
**Version**: 0.1.0 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-12 · **Updated**: 2026-10-12
**Status**: **D20 answered 2026-10-12 (Caio): approved, the defaults, and pointing added.** Lanes build from § 3–5.
**Purpose**: Caio (2026-10-12), building a satellite: the science parts are all cylinders in the stack; KSP's fun is
making parts fit and asymmetric craft; the antenna sits on top, can't plausibly survive the air and should start
tucked in; cameras and radar should differ as parts; a fairing that protects the payload and is dropped or opens;
"dealing with the shift in center of mass itself can be a mechanic"; Voyager's asymmetry (the dish, long antennas, the
magnetometer, the arms) as the model. Then: "a function to auto-adjust the craft's orientation... cameras that always
point at the planet, or even at another satellite, or later a space station". This doc is the parts and the pointing.

---

## 1. Why Voyager looks like that (the rule for every part here)

Every odd shape has a job, and the jobs fight: the **dish** must face home, so the craft's attitude belongs to it; the
**cameras** then can't point the craft, so they ride a **scan platform** on a boom; the **magnetometer** needs to be
far from the craft's own fields (a 13 m boom); the **RTGs** sit on a boom away from the instruments. **A part earns an
asymmetric place by needing to be somewhere, or point somewhere, the rest of the craft doesn't.** No part here is
decoration.

## 2. What exists (2026-10-12, v1.142)

- **Side mounting works:** `surf` parts (RCS, gas bottle, solar cells and wing, RTG, legs, arm, radial port, folded
  rover) sit on any part's skin at an angle; parts never tilt.
- **The centre of mass is 3D:** `geom()` sums every part's position; thrust off the CoM and aero already turn the craft
  (`cross(s.cm, F)`). An asymmetric craft already flies crooked; nothing shows it in the builder.
- **The science parts are stack slices:** `sci` (instrument package), `cam` (imaging camera), `ant` (a 1.25 m cone).
  Their effect is a count (`antOf`: n × whip gain; `cam` a yes/no); the antenna has no air or heat limit.
- **A deployable to copy:** the solar wing (P to unfold, tracks the sun, tears off above `qMax` while deployed).
- **The link equation** (`sim/space.js`): rate = K·P·Gt·Gr/d². Gains today: whip 1, a rover's high-gain 30.
- **Attitude modes** (`sasTarget`, by era, `AV`): gyro: hold, retro; analog: + prograde, normal, radial in/out;
  guidance computer: + node, target, anti-target, relative velocity, dock. **Every mode aims the craft's nose (+Y).**
- **Satellites between flights** keep their attitude in the orbital frame for the picture only; the sim ignores it.
- **No launch fairing.** The cargo bay (clamshell roof) is an orbital part, not a launch shroud.

## 3. The parts

### 3.1 Two forms for the small boxes
Battery, instrument package, onboard computer and camera each come **inline** (a slice, as now) and **side-mounted**
(a box on the skin, `surf`). Side boxes save stack height and move the CoM. Same numbers, one key each.

### 3.2 Antennas: three, each with a cost

| Part | Mount | Launch | Gain | Pointing |
|---|---|---|---|---|
| **Whip** (today's `ant`, moved to the side) | side | survives the air | 1 | none |
| **Boom antenna** | side | folded; deploys (P); tears off above `qMax` like the wing | ~5 | none |
| **High-gain dish** | side or top | folded; deploys; tears off | ~300 (era 2) → 3,000 (later) | **must face the receiver** (cone ~5° → ~1°) |

The dish is what lets a Selene or Nyx probe send pictures home at a useful rate; pointing it is the Voyager problem.
The inline cone `ant` stays for old saves and presets, labelled as the whip's early form.

### 3.3 Seeing: cameras, radar, the scan platform

- **Narrow camera:** sharp (today's ~10 µrad), a small footprint; **must point at the target** to take a picture.
- **Wide camera:** coarse (~10× worse), a wide swath, forgiving pointing (a ~20° cone); weather work.
- **Radar:** sees at night and through cloud, which the image contracts' "daylight, clear skies" rule out today;
  draws heavy power (~10× a camera), so it pulls in batteries, wings or an RTG. Later, a landing altimeter.
- **Scan platform** (era 2+): a two-axis turret on a boom that carries one camera and points it on its own, so the
  craft can keep its dish on home. It arrives with the dish, the problem it solves.

### 3.4 Booms
- **Magnetometer:** the field reading is good only beyond a distance from the craft's electronics; the boom length
  is the trade (mass and its swing against data quality). Feeds field contracts in space.
- **RTG boom:** the RTG at a distance; too close and the instruments' data degrades.
- **Deploying a boom moves the CoM and the inertia.** A spun craft that unfolds booms starts to wobble and ends up
  tumbling about its widest axis (Explorer 1's lesson, real physics we already simulate).

### 3.5 The payload fairing
A shell on the stack that encloses what's above it to its own radius: no aero and no heating inside (the interstage's
enclosure logic, put at the nose). Jettisoned by staging, as two halves that fall away.
- Too early: the folded dish and booms meet thick air and tear off.
- Too late: dead mass carried up.
- Sizes 1.25 and 2.5 m, length chosen in the builder (a few steps).
- Crewed and reusable craft use the cargo bay that already opens in orbit.

## 4. The centre of mass as a mechanic

The builder shows **the CoM marker, the thrust line, and their miss**, and a **trim** readout: the share of gimbal (or
wheel torque) spent just holding course at full thrust. Green under 20 %, amber under 60 %, red beyond (can't hold).
The player's options, all real: balance across the axis, add a counterweight, live with the trim, burn with the booms
folded and deploy after. Docking an off-centre module does the same in orbit (the data is already there).

## 5. Pointing: the attitude law

Caio: "a function to auto-adjust the craft's orientation... cameras that always point at the planet, or even at
another satellite, or later a space station". Today every mode aims the nose; the change is **pick the part, pick the
target, and optionally a second part for the roll.**

- **Primary: a part's boresight → a target.** Parts with a boresight: camera, dish, scan platform, radar, docking
  port, engine, and the nose as today. Targets: **the ground below** (nadir), **home** (Tellus, or the craft's
  ground station), **the sun**, **a vessel or registry satellite or station**, **a ground site** (track a city while
  passing), plus today's orbital directions.
- **Secondary (roll):** a second part toward a second target as far as the first allows: wings to the sun while the
  camera looks down; the dish to home while the craft burns.
- **By era:** gyro: none (spin or nothing). Analog: **nadir and sun only, nose or one chosen part** (as radial in/out
  are today). Guidance computer: any part, any target, both axes. A passive **gravity-gradient boom** (era 1, no power,
  no computer: nadir within ~5°, slow to settle) is the cheap way to look down, as the 1960s did.
- **Costs:** the reaction wheels saturate (`hmax` is already there) under steady torques (gravity gradient, drag, an
  off-centre burn), and **dumping them spends RCS gas**. A satellite's pointing life is its gas, which W2 already makes
  its service life. Power: the computer and the wheels draw (`sim/power.js` loads).
- **Between flights:** a registered satellite keeps its law (it's stored with it), so its camera stays on the ground
  and its dish on home, and the gas drain counts in its service life. A craft without the avionics for its law keeps
  only what it had (or spins).
- **Strict pointing (D20):** the narrow camera, the dish and radar do nothing unless their boresight is inside their
  cone. A spun craft gets the whip, the boom antenna and the wide camera only, until it can despin.
- **UI:** the attitude panel's mode list gains *Point …* with a part picker (click the part on the craft) and a target
  picker (the same targets the map already offers). Contracts and the Debrief say why a picture failed: "camera
  pointed 34° off the ground".

## 6. Slices (D20: this order)

1. **S1, fit and shield:** the payload fairing; the boom antenna; side forms of camera, battery, instrument package
   and computer; the inline antenna becomes the whip (side); the CoM, thrust-line and trim readout in the builder.
2. **S2, point:** the attitude law (§ 5) with nadir, home, sun and target; the dish; the two cameras with strict
   cones; radar; the gravity-gradient boom; satellites keep their law between flights; wheel saturation and the gas.
3. **S3, Voyager:** the scan platform; the magnetometer and RTG booms; boom deployment changes the inertia; a
   grand-tour contract that needs dish, platform and booms at once.

Lanes: vehicle (parts, builder readout, attitude law), space (link gains, satellites between flights, contracts' cones),
economy (contracts that want radar or the magnetometer), look & sound (parts & pad: the meshes, fold and deploy).

## 7. Decisions

D20 (2026-10-12, [`DECISIONS.md`](DECISIONS.md)): the direction approved; slices S1 → S3; strict pointing; Caio added
the attitude law ("cameras that always point at the planet, or even at another satellite, or later a space station").
