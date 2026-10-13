# PROBES — payload parts, asymmetry, pointing
**Version**: 0.1.4 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-12 · **Updated**: 2026-10-13
**Status**: **D20 and D21 answered 2026-10-12 (Caio):** the parts and pointing (D20); booms, the era ladder, beauty rules, tooltips (D21). Lanes build from § 3–8.
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

### 3.4 Booms and masts: a building part (D21)
Caio: "the arms that hold instruments... can come in as a building mechanic"; "the two options that exist on Voyager:
folding and telescoping". One structural part with a **mount at its tip** for anything (RTG, scan platform,
magnetometer, antenna, camera), on any side, **length set in the builder**.

| Kind | Like | Length | Carries | Launch → space |
|---|---|---|---|---|
| **Folding boom** | Voyager's science and RTG booms | short (1–4 m, steps) | heavy things: an RTG, the scan platform | hinged flat against the side; swings out on deploy |
| **Telescoping mast** | Voyager's 13 m magnetometer mast (a lattice that extends out of its can) | long (2–15 m), featherlight | sensors only (a weak tip load) | stowed in its can; extends on deploy |

- **Deploy** is a staging event (or P with the wings). Folded, everything must fit inside the fairing: the fitting
  puzzle. Too long, too wide: a bigger fairing, a folding dish, another layout.
- **Load limit:** a hard burn with a boom out can snap it (its root joint, as legs and wings already work). Burn
  first, deploy after.
- **Tilt (D21):** a boom deploys to a fixed angle, **90° or 45°** from the side; what sits on its tip stays square to
  the boom. Nothing else tilts.
- **Uses:** the **magnetometer** (a good reading only beyond a distance from the craft's electronics: the mast's
  length is the trade); the **RTG** away from the particle instruments (too close and their data degrades).
- **Deploying moves the CoM and the inertia.** A spun craft that unfolds booms starts to wobble and ends up tumbling
  about its widest axis (Explorer 1's lesson, real physics we already simulate).

**Other new parts:**
- **Control moment gyroscope** (station era): a fast wheel on a gimbal; tilting it gives far more torque per kilogram
  than a reaction wheel (Skylab, the ISS). Heavy and power-hungry; what turns a station the small wheels can't.
  Naming: the *gyro* in today's "Gyro autopilot" is the era's **sensor** (it feels rotation), not an actuator; Q280
  renames the eras *rate damping*, *attitude hold*, *autopilot*, so "gyro" names only this part.

### 3.5 The payload fairing
A shell on the stack that encloses what's above it to its own radius: no aero and no heating inside (the interstage's
enclosure logic, put at the nose). Jettisoned by staging, as two halves that fall away.
- Too early: the folded dish and booms meet thick air and tear off.
- Too late: dead mass carried up.
- Sizes 1.25 and 2.5 m, length chosen in the builder (a few steps).
- Crewed and reusable craft use the cargo bay that already opens in orbit.

### 3.6 Voyager's parts we don't have yet (besides § 3.2–3.4)
Most of Voyager's instruments point **away** from where its dish points (the dish faces Earth all mission, so the
planet-watchers ride the scan platform); the booms keep things **apart** (RTG radiation from the particle detectors,
the craft's magnetism from the magnetometer). One instrument looks roughly along the dish's line: the plasma detector
faces the sun for the solar wind. The dish also shades the bus.

| Part | What it adds |
|---|---|
| **The bus:** a many-sided drum (8 or 10 faces) with **bays** in its sides | the structure; boxes (battery, computer, instruments) slot into bays instead of the skin; the sides become mounting faces |
| **Plasma-wave wire antennas** (two, ~10 m, at right angles) | radio-science contracts (a planet's radio noise, its magnetosphere) |
| **Particle detectors** (cosmic rays, plasma, charged particles) | need distance from noise (the RTG) rather than pointing; the plasma one faces the sun; Explorer 1 found the radiation belts with one: an early contract |
| **Attitude sensors:** sun sensor, horizon sensor, star tracker | gate pointing (§ 5) |
| **Hydrazine thrusters** | the step up from cold gas (Isp ~220 s against 70) |
| **The golden record** | flavour: mass, no function, some prestige |

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
- **Sensors (D21):** a pointing law needs the sensor for its target on board: a **sun sensor** for the sun, a
  **horizon sensor** for the ground below, a **star tracker** for anything else (home, a vessel, a site). The avionics
  era sets which laws the computer can run; the sensors set what it can see.
- **By era:** gyro: none (spin or nothing). Analog: **nadir and sun only, nose or one chosen part** (as radial in/out
  are today). Guidance computer: any part, any target, both axes. A passive **gravity-gradient boom** (era 1, no power,
  no computer: nadir within ~5°, slow to settle) is the cheap way to look down, as the 1960s did.
- **The cost is power, not momentum (D20, Caio: saturation "may be annoying, or too punishing").** The law draws the
  computer's and the wheels' power (`sim/power.js` loads), more for tracking a moving target than for holding nadir or
  the sun. In shadow on a flat battery, pointing lapses and the strict parts stop: that's the tension, and it pulls in
  bigger batteries, wings that track, or an RTG. **No momentum bookkeeping for pointing:** in flight the wheels keep
  saturating as now under big torques (an off-centre burn), with today's automatic dump through the gimbal or RCS, but
  holding a law costs no gas, in flight or between flights.
- **Between flights:** a registered satellite keeps its law (it's stored with it), so its camera stays on the ground
  and its dish on home, while its power budget (Q27) covers the law's draw; short of power, it points only in sun. A craft without the avionics for its law keeps
  only what it had (or spins).
- **Strict pointing (D20):** the narrow camera, the dish and radar do nothing unless their boresight is inside their
  cone. A spun craft gets the whip, the boom antenna and the wide camera only, until it can despin.
- **UI:** the attitude panel's mode list gains *Point …* with a part picker (click the part on the craft) and a target
  picker (the same targets the map already offers). Contracts and the Debrief say why a picture failed: "camera
  pointed 34° off the ground".

## 6. Variety across the ages (D21)

**1. Each era changes how a part works, not only its numbers.** One ladder per function (draft for Caio to mark up):

| Function | Early | Middle | Late |
|---|---|---|---|
| Pictures | film capsule dropped home and caught (Corona: it counts only if recovered) | TV camera, radioed down | CCD, a big telescope |
| Talking home | whip | boom antenna, dish | folding mesh dish, relays |
| Power | silver-zinc battery | solar cells, wings | RTG, big tracking arrays |
| Knowing where you point | spin + a sun sensor | horizon sensor (nadir) | star tracker (anything) |
| Holding attitude | spin-up motors, gravity-gradient boom | reaction wheels | control moment gyroscopes |
| Thrusters | cold gas | hydrazine | bipropellant, ion |
| Structure | round drum | the many-sided bus with bays | truss frames, open lattice |
| Shielding the payload | none (tough parts only) | the fairing | the fairing, big; the cargo bay |

**2. Sidegrades, not straight upgrades.** Old parts stay useful: cheap and proven (know-how and certification already
reward a qualified part).
**3. Adjustable parts multiply forms without a long catalog:** boom and mast length, dish size, fairing length, truss
length, bus faces. Six adjustable parts give hundreds of shapes.
**4. Schools style everything** (POWERS.md): a Steppe probe and a Cape probe doing the same job look like different
countries built them.

**5. Parts, not products (D24).** Caio (2026-10-13): "i don't want to take away the player design experience by having
them be too readymade." The craft in `mockups/satellites/` are what a player *could* build, never catalog items: no part
is a whole satellite. The **bus is one adjustable frame**: its shape (sphere, faceted ball, drum, 4 to 10 faces, box,
open truss), its size (0.3 to 3 m) and a skin per face (polished, gold or silver foil, cells, white, thermal checks,
black blanket); everything else is a part that mounts on it. Smaller stacks (0.3, 0.6 m) and a kick motor come with it.
Example designs only as a copy-and-change starter on the bench (two: the first beacon, and one of the era's), never as
parts.
**6. Signature shapes come from jobs** (the dish farm, the radar plank, the helix ring, the sunshade tube, the mesh dish,
the gravity boom): each is a part a contract or a law asks for, so a player who takes the job builds the shape.

### 6.1 The payload bench (D24)

Caio: "they're kind of like the rover in that they probably need to be designed separately from the rocket and then
tucked in somewhere. what's good is this will definitely help stability, since the satellites will end up much smaller."
- **Its own place, like the Rover yard** (`app/rover-yard.js`: designs in `PROG.rovers`, mounted by the `rvfold` and
  `rvdeck` parts): designs live in the program's **payloads**; the bench works at satellite scale (small parts, a close
  camera, the craft on a stand), with its own Checks tab (D22's form): *has power in shadow · can talk home · can point
  what it must · stays in its temperatures · balanced (CoM) · fits the fairing you chose*.
- **On the rocket it's one block**: mounted on an adapter inside the fairing, its mass, CoM and outline counted; the
  rocket builder shows it, doesn't edit it (open it on the bench from there). The same payload flies on any rocket; a
  route (Q184) launches copies.
- **Folded for launch, as designed**: the bench shows the stowed and the deployed shape; the fairing check uses the
  stowed one; deploying in orbit animates (QUEUE Proposed, 2026-10-13).
- **Stability**: payloads shrink (a 0.6 m bus, not a 1.25 m stack of round parts), so rockets get less top-heavy.
- **Customers' payloads** (default, Caio to confirm): a commercial launch contract brings its satellite ready (you
  only fly it: mass, size, orbit, a deadline); your own program's satellites you design.
- **Today's rocket-builder probe parts** (Q337's side parts, the octagonal frame) move to the bench; saved designs that
  carry them on the rocket keep working (a design with probe parts stacked is read as an implicit payload).

## 7. Keeping them beautiful (D21)

What makes Voyager beautiful, as rules:
- **A compact core, long thin lines reaching out.** Booms and masts drawn as real lattice and thin geometry, never
  fat cylinders; the dish big and white against them.
- **Real materials, each with a reason:** crinkled gold and silver blankets (thermal), white dishes, black radiator
  panels, bare aluminium truss; per era (polished and striped in the 60s, gold foil in the 70s).
- **Every part readable at a glance:** a distinct outline at 50 px.
- **Detail in geometry where it casts a shadow:** the bus's bays, cable runs, thruster quads ([`BEAUTY.md`](BEAUTY.md)
  B1.5, the greebles).

## 8. Explainers in the builder (D21)

Caio: "we now need a tooltip system to help players understand how to play". One system (UI.md rule 9, Q287's), three
uses in the builder:
- **Terms:** Δv, TWR, trim, boresight, gain, fairing: a hover, one level deep (Q287 as queued).
- **Part cards:** hovering a part (in the list or on the craft) shows what it does, why you'd want it, what it costs
  (mass, power), its era and limits (`qMax`, tip load, pointing cone), and what it pairs with ("a dish needs pointing:
  a star tracker and the autopilot").
- **Warnings that explain themselves:** every amber or red mark in the builder says why and the fixes on hover:
  trim ("thrust misses the CoM by 0.4 m: balance the other side, add a counterweight, or deploy the boom after the
  burn"), fit ("the folded mast pokes out of the fairing: a longer fairing"), a missing sensor, a boom's load.

## 9. Slices (D20, D21: this order)

1. **S1, fit and shield:** the payload fairing; the boom antenna; the **folding boom** (an RTG on an arm needs it); side forms of camera, battery, instrument package
   and computer; the inline antenna becomes the whip (side); the CoM, thrust-line and trim readout in the builder.
2. **S2, point:** the attitude law (§ 5) with nadir, home, sun and target; the dish; the two cameras with strict
   cones; radar; the gravity-gradient boom; **the attitude sensors**; satellites keep their law between flights; its cost in power.
3. **S3, Voyager:** the scan platform; the **telescoping mast**; the magnetometer and RTG on booms; the bus with bays;
   plasma-wave wires and particle detectors; hydrazine thrusters; the control moment gyroscope; boom deployment changes the inertia; a
   grand-tour contract that needs dish, platform and booms at once.

Lanes: vehicle (parts, builder readout, attitude law), space (link gains, satellites between flights, contracts' cones),
economy (contracts that want radar or the magnetometer), look & sound (parts & pad: the meshes, fold and deploy).

## 10. Decisions

D24 (2026-10-13): parts, not products; the payload bench (§ 6 rules 5–6, § 6.1).

D20 (2026-10-12, [`DECISIONS.md`](DECISIONS.md)): the direction approved; slices S1 → S3; strict pointing; Caio added
the attitude law ("cameras that always point at the planet, or even at another satellite, or later a space station");
then pointing costs power only, no wheel-momentum or gas drain ("maybe power is enough tradeoff here").
D21 (2026-10-12): booms as a building part in Voyager's two kinds, folding and telescoping (Caio's pick); booms tilt to
90° or 45° only; the era ladder (§ 6) as a draft to mark up; attitude sensors gate pointing (S2); the beauty rules
(§ 7); a tooltip system with part cards and self-explaining warnings (§ 8).
