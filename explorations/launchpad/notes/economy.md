# Launchpad notes — Economy
**Version**: 1.0.7 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-11 (split from NOTES.md v1.21.52, W37) · **Updated**: 2026-10-13
**Purpose**: The build log for the program, contracts, money, know-how, industry, powers and rivals, dispatch, crew plans, mission design, balance runs.
**Status**: live log, oldest first; new sections go at the bottom. Index of every section: [`../NOTES.md`](../NOTES.md).

---

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

## v1.41 — no daily overhead (2026-10-08, economy session)

Caio: idle time should be roughly neutral, with no upkeep. `OVERHEAD` and the new `OVERHEAD_CAP` (per unit of capacity)
are both 0 (were 0.06 and 0.015 M/day); the code path stays, so it can be tuned later.

Career runner (agency, 6 years, 5 seeds), lines-only:
- final funds rise by ~300–800M;
- top-ups roughly halve (resource 9.4 → 2.8, frugal 9.8 → 4.6, rising 6.6 → 3.0).

With the investor (`all`), strong programs still put 1.5–2.9B into sinks and end at 0.6–1.5B. Weak programs end
safer (frugal 911, resource 504).

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

## Why a company in a poor world stagnates (2026-10-09, economy session, QUEUE Q150; runner only, no game change)

Re-measured on today's code (`SELENE=1 node career.mjs 4 3 base company`): after v1.77's floors and W11, a private
company in a frugal world ends four years at **187M** (was 25M), a resource-world company at **64M**, while companies
elsewhere end at 700–1,400M; funds sit flat (~72–75M) through years 1–2. **What it lacks is recurring income**: a
company has no budget day, so it lives on contracts and firsts, and a poor world's work only just pays.

**The game already offers the remedy:** a friendly power's **stake** (`decisionTick`: 15 % of the valuation in cash,
plus a share of that power's budget days and its contracts), offered after the first first. The runner's scripted
player declined everything but a rescue loan, so it never took one. With `ACCEPT=stake` (new runner switch) it accepts
2–3 stakes in four years and the frugal company ends at **392M**, the resource company at **415M** (others 1.0–1.9 G).

**Verdict:** no game change. A company in a poor world is the hard start, by design, and climbs out by taking
partners, which is the archetype's story (POWERS.md: the frugal power "doesn't race; partners"). The runner stays
conservative by default, so its numbers are a floor; `ACCEPT=stake,ipo` measures a player who takes offers.

## Plan: missions per body from SYSTEM.md (2026-10-09, economy session, QUEUE Q88; M5, nothing built)

SYSTEM.md (approved) gives each body a **role**: its epoch, the design problems its missions pose (pillar 2) and what
it gives back. This turns those roles into `MISSIONS` entries, built the way the Selene and Nyx ladders are: flight
record flags set by the flight (`R.farSent`, `R.selLand`…), `req` chains, staged pay for long missions (v1.44),
W11 (a mission counts only on a flight launched while it was open), and the pay floor (v1.53): **each first pays at
least 1.3× the full launch cost of the cheapest preset proven to fly it**, measured by a ladder run when the space
lane builds the presets (as `fly_ladder.mjs` did for Selene and Nyx).

| Body (epoch) | Ladder | The signature problem (pillar 2) | Gives back |
|---|---|---|---|
| **Hesper** (6) | flyby → orbit (aerocapture allowed) → entry probe → lander | **a lander that lasts minutes**: surface data for 20 min before the heat and pressure win (`R.hespSurfT`); radar mapping as a world mission accumulating coverage % (like *Navigation*) | science, the surface map (pillar 4) |
| **Enyo** (6), Pavor, Metus | flyby → orbit → landing → rover 10 km → relay coverage | **air too thin to stop you**: a landing needs chutes and a retro burn (`R.enyoLand` with touchdown under 4 m/s); a relay orbiter that stays (pillar 3); Pavor as a cheap staging landing | polar water (ISRU, Q110), rover science (R4-style contracts), the crewed goal (epoch 8 capstone) |
| **Astraea** and the belt (7) | flyby → orbit → landing | **landing where gravity barely holds you** (closer to docking: `R.astrLand` at under 0.5 m/s), a 10° plane change | water and salts for a depot (Q110) |
| **Hyperion** (7), Theia, Eos, Tethys, Phoebe | flyby (passive, staged, years) → capture → entry probe → moon tour → Tethys landing → Eos plume sample | **the entry probe** (~26 km/s, the hardest heating: data until it dies), **Tethys, where parachutes do everything**, **a sample through Eos's plumes** | the big discoveries (Eos's ocean), the assist to Erebus |
| **Erebus** (8) | found by a telescope survey (like Nyx: pillar 4) → passive flyby with a Hyperion assist (5 years, staged) | the long mission across a compute era (pillar 5: it flies in the background) | the edge of the system; the capstone probe |

**Science contracts per body** (as R4's for Selene, v1.66): Hesper's radar coverage, Enyo's rover readings and polar
ice, Eos's plume chemistry, judged on data received (the link budget, Q51). **The race:** the capstones among these
(LATE_GAME § "The arc after Selene": a lander on Hesper, a rover on Enyo, people on Enyo, a probe past Erebus, Eos's
sample) are raced by rivals' programs (Q138), not by schedules.

**Questions for Caio** (numbered, with defaults): (1) epochs as SYSTEM.md has them (**6 near planets, 7 belt and
Hyperion, 8 the edge**; default); (2) every body gets the **flyby → orbit → landing** ladder before its signature
problem (default) or only the signature missions; (3) pay by the **1.3× proven-rocket floor** (default, v1.53's rule);
(4) Erebus **found by a survey** like Nyx (default).

**Slices (⚙, M5, after the heliocentric rails):** Hesper's and Enyo's ladders with their flags and ladder runs → their
science contracts → Astraea → Hyperion and its moons → Erebus.

## Plan: goods on routines, outposts' self-sufficiency and exports, capstones and records (2026-10-09, economy session, QUEUE Q110; nothing built)

LATE_GAME § "The network", § "Outposts" and § "The arc after Selene" (approved), on what exists now: supply runs to
bases (v1.69: a design's ascent procedure + transfer + `landAt`, flown for real by `procFly`, the lander joins the
base), station state and station work (v1.89.3), the network model (`netModel`, v1.89.1: nodes with stock and need,
routes empty), the automation ladder (MIDGAME, D7: uncrewed runs to the moons need onboard computers).

**1. Routines are repeating dispatches** (the Factorio belt). A **routine** = a template (design + procedure + site +
destination node) + a **window rule** (MIDGAME § Windows: plane over the site, target phase, lighting, planetary
alignment) + a period. `PROG.routines = [{id, stack, site, to, every, window, next, runs, fails, cargo}]`; each run is a
dispatch (pads, stacking days, price, the lease, physics by `procFly`, the deviation hand-over) queued at the next valid
window after `next`. **A route is flown by hand the first time**, then any dispatchable flight can be made a routine
("Repeat this run every 60 days"). They appear in `netModel().routes` with tonnes a year per good.

**2. Goods are what the design carries** (the five: propellant, supplies, crew, hardware, materials), measured, not
abstract: a run's cargo is the modules and resources that arrive (supplies in a habitat's `sup`, propellant in a
tank's resources, hardware as named modules, crew from the roster plan). A routine's tonnes a year = cargo per run ×
runs a year (its window and the pads permitting). Node **stock** per good comes from its registry entries' resources;
**need** from its crew (supplies, v1.60's `SUP_DAY`) and its routines (propellant a depot hands out).

**3. Outposts and self-sufficiency.** An outpost is a base or station with **production modules** (vehicle and space
lanes build the parts; economy runs them): a **greenhouse** or **recycler** makes supplies (costing power: the habitat
budget, Q119), an **ice plant** makes propellant at Selene's poles, Astraea or Enyo's caps (from the ground model). Each
module's output per day enters the node's stock in `utilTick`. **Self-sufficiency** = for each good it consumes to keep
running, the share it makes; **one number, the lowest share** (LATE_GAME). At 100 % it needs no routine; cut off it
goes dormant (pillar 5), never dies.

**4. Exports.** An outpost's surplus is a routine's cargo the other way: Selene's propellant to an orbital **depot**,
materials (the mass driver, later) to a yard. **Depots** are stations with tanks: they sell propellant to our flights
(a refuel docking counts as a purchase from stock) and to **rivals** (Q138), at a price by the cycle.

**5. Capstones and records** (epochs 6–10, LATE_GAME's table): capstones as **firsts** with rivals racing for them
(Q138's programs): a lander on Hesper, a rover on Enyo, propellant made off Tellus, a self-sufficient outpost, the
mass driver's first payload, people on Enyo and home, a cycler, the highway, the first megawatt sold, the interstellar
probe launched. **Records** in the logbook (open-ended, `LOGF`): tonnes a year through the network, the largest
structure, megawatts in orbit, the most self-sufficient outpost, the deepest probe. Headlines, not points (pillar 3).

**Questions for Caio** (numbered, with defaults): (1) routines as **repeating dispatches with a period and a window**
(default) or a run you order each time; (2) goods **as physical cargo, measured** (default) or abstract tonnage per run;
(3) self-sufficiency as **the lowest share** (default, LATE_GAME) or an average; (4) depots **sell to rivals** from
the start (default) or only in the commercial era.

**Slices (⚙, M3–M4):** routines (a repeating supply run to a base, its window, its row on the pad calendar and in
`netModel().routes`) → goods accounting per route and node → production modules and self-sufficiency (with vehicle
and space for the parts) → depots and propellant sales → exports → capstones → records.

## Plan: rivals as programs, scarce places, the world's mood, commercial rivals (2026-10-09, economy session, QUEUE Q138; nothing built)

LATE_GAME § "Rivals in the late game" (round 7, approved as proposed). **Today:** rivals are seeded schedules
(`raceSchedule`: a day per race first per power, the earliest wins), with personalities since v1.89.2 (frugal powers
don't race; rising ones copy then catch up; the open superpower announces, the closed one surprises).

**1. Rivals as programs** (coarse, never flown):
- Each other power keeps `{budget, capacity: {pads, depots, outposts, stations}, progress: {capstone: 0–1}}`, stepped
  in `worldTick`: budget = its economy × its archetype's money (tax, patronage, commodity, military, as `moneyK`) ×
  the world's mood; it spends on capacity first, then on progress toward the capstones its priorities favour
  (prestige → crewed firsts; science → probes; commerce → stations, depots; security → its own constellations), sped by
  its tech and its computing era (v1.38's lag per power).
- **The early race keeps its schedules** (they work and are tested); programs take over for **epoch-6 capstones and
  after** (LATE_GAME § "The arc after Selene"): a rival can overtake you, stall in a bust (commodity prices), or lose a
  crew (a news line and a set-back).
- **What you do moves it:** propellant sold to it speeds its progress; a sanction stalls it; a race won costs it opinion
  and budget at home.
- Its stations and outposts become registry objects on rails (the space lane), so you can meet one, rescue its crew,
  or sell it propellant; on the network screen they're drawn in its colour (`netModel` gains `rivals`).

**2. Scarce places: the race gets a map.** A registry of contested places (`PROG.claims`): stationary-orbit slots
(a fixed number around the ring), Selene's polar ice craters (a handful, from the ground model), Selene's L4 and L5,
Enyo's caps, prime landing sites. **Whoever builds there first holds it** (a station, base or satellite registered
within its radius); a holder's neighbours pay a lease or route round it (v1.56's leases). Rivals claim by progress.

**3. The world's mood has eras**, driven by tensions and the date (`worldMood()`, not scripted): **race** (high
tension, early: firsts pay ×2, secrecy up), **détente** (tension falling: joint missions offered, guest astronauts),
**consortium** (many friendly pairs: shared stations, big joint projects), **commercial** (late, private companies:
undercut prices), **a new race** (tension back up). Each era shifts pay multipliers, offer mixes and the news tone.

**4. No combat, ever.** Conflict stays below war: sanctions, anti-satellite tests that foul a band (the debris lane),
poaching people (the roster, level 3), claim disputes, cutting a supplier, propaganda.

**5. Commercial rivals** in the commercial era: private companies with the coarse model above, **undercutting launch
prices** (commercial contracts' pay falls by their share of the market, floored by v1.77's pay floor) and buying
from you (propellant, relays, later templates).

**Questions for Caio** (numbered, with defaults): (1) programs **replace schedules only from epoch 6** (default) or
the whole race; (2) scarce places **held by building first** (default, the Artemis-Accords way) or a lottery of
claims; (3) mood eras **from tension and the date** (default) or a fixed historical sequence; (4) commercial rivals
**undercut contract pay** (default) or only compete for firsts.

**Slices (⚙, M4):** the coarse rival program state and its tick (no effect yet; a debug view) → capstone progress
and news → claims registry for stationary slots → mood eras → commercial rivals.

### Q188 amendment: programs from epoch 1 (2026-10-11, economy session; W26.1, Caio: "rivals are programs from the start")

**Measured first (why the schedule has to go):** `raceSchedule()` draws from a fixed `rng(4242)`, so in every world and
every save the same rival wins the same firsts on the same days. With this map, Mirtov (the closed superpower) takes all
three in 4 of 5 homes, on days 83 / 176 / 245 (68 / 144 / 217 from homes 3–4); from home 2 Asaro wins on 112 / 238 / 331.
Nothing the player or the world does moves those days. `career.mjs 4 3` race column: `211` almost everywhere (second on
the beeper, first on the hop and the orbit), `212` / `L1L` in frugal and resource worlds.

**The coarse early program** (one state per rival, `PROG.riv`, stepped in `econTick` as `rivTick(d, R)`):
- Each rival works on the race's firsts **in order** (`k`, the next one), with **progress** `p` from 0 to 1 and the
  **work** that first takes, `w` (drawn 0.75–1.25 when the rival starts it, from the world's seed: worlds differ now).
- **Its rate per day** = `speed / 150 × money × spur`. `speed` is the schedule's: tech × √economy × (0.6 + 1.6 × prestige
  appetite), so the mean pacing stays where it is. `money` follows the rival's **own** treasury, by its archetype's money
  (the home budget's `moneyK` reads *our* opinion, so it isn't reused): commodity × (1 + 0.5 × the commodity cycle; a bust
  stalls a resource state), military × (0.8 + 0.4 × its tension), tax and patronage 1.
- **An attempt** when `p` reaches `w`: it succeeds with `0.55 + 0.35 × tech` (capped 0.95). A failure sets `p` back by
  a third of `w`: the open superpower's failures are news, a closed one's only a rumour, and only sometimes.
- **What we do moves it (the lever this slice has):** a first **we** win spurs every rival racing for it. Their budgets get
  `× (1 + ½ × prestige appetite)` for a year (halved after measuring, v1.130), the Sputnik shock run backwards. Winning early makes the next firsts harder.
  Sanctions, sales and the late levers stay in Q138's slices.
- **Personalities as before:** a frugal power doesn't race (its rate is 0, and it partners), and a rising power works
  through the beeper quietly (it copies; its beeper never counts) and then runs at 1.5×.
- **`RIVALS` stays, as the forecast:** per first, the rival expected soonest (from `p`, `w` and its current rate), or the
  real day it got there. The race panel, `raceNews` (announcements 30 days ahead, rumours) and `raceTick` read it
  unchanged. A forecast moves as budgets move, which the panel's "expected around day N" now honestly shows.
- **Saves, defections, a new game:** `raceSchedule()` (the name is kept; every caller already resets through it) rebuilds
  `PROG.riv` when it's missing, when home changed, or when the day went backwards, and fast-forwards it to today at mean
  rates with no rolls. A defection hands the old home's progress to the new rivals, as the schedule did.

**Tuning target:** `career.mjs`'s race column stays mostly `211`, and over 20 worlds the mean day of each rival
first is within ±15 % of the old formula's expectation, with spread between worlds (the old schedule had none). Met: v1.130.

**Questions for Caio** (numbered, with defaults; silence keeps them): (1) **the spur:** a first we win speeds rivals up
for a year (default) or no reaction; (2) **what the race panel shows:** the forecast day for an open rival, "soon" or
nothing for a closed one (default) or exact days for all (today); (3) **the second place:** a rival that gets there
after us makes a small news line, "Asaro also orbits" (default) or stays silent.

**Slices:** (1) `PROG.riv`, `rivTick`, the forecast as `RIVALS`, the spur, news on failures, tests and the runner (⚙,
this item) → (2) the panel shows each rival's progress by openness (with flow) → then Q138's slices from capstone
progress on, which now extend this state instead of replacing a schedule.

## Plan: money buys capacity (2026-10-09, economy session, QUEUE Q123; nothing built)

LATE_GAME § Money (round 5, approved): early, money buys flights; late, it buys **capacity**, and capacity gets dearer
as you grow, so money stays the throttle on growth instead of piling up. Hardware stays the money sink.

**Measured (why):** `SPEND=1 node career.mjs 6 2 all agency` (the runner's investor buys facilities, tests,
development and lines): every facility's two levels are bought out by year 2–3 (220–520M in all), then there's
nothing left to buy; six-year funds end at 270–370M in poor worlds but **1.4–2.1 G in rich ones**. Today's capacity
is capped, not priced.

**Proposed rule (defaults):**
1. **Capacity is counted, not levelled**, for what scales: **pads** (today 1 + 2 levels), **integration bays** (the
   hall's stacking in parallel), **ground stations** (dish arrays, v1.48), **sites of our own** (a new home site, not a
   lease), **computing-centre** steps, **astronaut classes** (the crew plan's class size), and later **yards** and
   **depots**. The *n*-th of each costs **base × 1.6ⁿ⁻¹** (and takes 1.2ⁿ⁻¹ × the days): the 4th pad ~330M, the
   6th ~840M. Facilities that are upgrades in kind (the hall's speed, the recovery fleet's range) keep their levels.
2. **Hardware stays the sink:** rockets are bought per flight as now; production lines (v1.31) make them cheaper with
   every unit, so a program flying more spends more in total but less per tonne. No upkeep (v1.41).
3. **Late revenue arrives with the systems that make it** (each in its own item): propellant sold at depots (rivals
   included), power beamed down, compute (datacenters, v1.38's price index), relay leases, orbital tourism, powers'
   contracts for big projects.
4. **The test:** with the investor policy, a rich world's six-year funds stay within ~2× a poor world's, and capacity
   bought keeps rising year on year (the runner prints capacity per year).

**Questions for Caio** (numbered, with defaults; silence keeps them): (1) growth **×1.6 per unit** (default) or gentler
(×1.3); (2) **new home sites** buildable (default) or leases only; (3) the hall's parallel **bays** as a capacity
(default) or the hall stays one line.

**Slices (⚙):** pads and ground stations counted with the growth price (`FAC` gains a `count` kind) → bays → home
sites → the runner's capacity report; revenue items with their systems (Q110 goods, depots).

## Plan: the roster, the astronaut office, requalification, the roles' hooks, crew rotation (2026-10-09, economy session, QUEUE Q133, Q135, Q136, Q137; nothing built)

> **Superseded in part (2026-10-11, DECISIONS D15.4):** ranks are replaced by qualifications earned in the simulator, time in type and seniority (CREW.md § Skill). Re-plan the rank parts with Q182.

CREW.md part 2 (approved) on top of what exists. **Today:** a crew is anonymous: `R.crewed` is a capsule with crew
(`d.crew`) once the max-q abort test is done; g, cabin and air are judged per flight (`missionTick`), a loss is
`failHit(-20)` and one news line; capsules keep their crew across flights in the registry (rotation works by hand).

### Q133 — the roster and the astronaut office's classes
- **Data:** `PROG.crew = [{id, name, role: 'pilot'|'scientist'|'engineer', rank: 1–3, cls, joined, status:
  'ready'|'flying'|'aboard'|'lost', where (registry id when aboard), rec: {flights, days, firsts: [], walked: []}}]`.
  Level 3 (careers) adds fields to the same record; nothing here needs rework for it.
- **Names** in home's style: a given name and a family name from home's school syllables (v1.89's `SCHOOLS`), on
  their own seeded draws; unique in the program.
- **Classes, not hiring:** the first class is selected **when the abort tests open** (crewed flight becomes possible);
  then one every **2 program years**, 3 people + 1 per computing-centre level; roles follow the era (pilots only in
  epochs ≤ 3; scientists from epoch 4; engineers once a station or base exists) and the archetype (security: pilots
  first; frugal: scientist-heavy; resource: classes of 2, and an offer to **buy a seat** on a friend's flight).
  News: "The second class: Vela Marisk, Ilo Tovvera, …".
- **Crew picked automatically** at launch (`missionTick`'s launch line): seats = the capsules' `d.crew`; the best-ranked
  ready pilot first, then by the mission (a scientist for a landing, an engineer for a station). A hand-flown flight
  can swap them in Assembly (flow's screen) if the player wants (CREW round 2, decision 4). `R.crew` = their ids.
- **At flight end** (`missionEnd`): each flown astronaut's record (flights, days, firsts named in the news: "Vela
  Marisk, first person on Selene"), **rank up on firsts** (a first flight, a first orbit, a first landing on a body,
  60 days in space), status back to ready, or *aboard* when their capsule docked and stayed. A loss: *lost*, named in
  the news and in a memorial list.
- **UI (flow):** a Crew tab or screen: the roster, the classes, the memorial.

### Q135 — requalification after a loss (replaces the anonymous `failHit`)
- On a crew loss, `PROG.requal = {cause, moment, design, day}` from the flight record: g (`cgMax`, when), cabin heat
  (`ccab`), air, a part that failed (the breakup's part), a failed abort.
- **While set, crewed launches are refused** at LAUNCH ("Requalify first: fly this rocket uncrewed through *the
  moment* and show *the cause* is fixed"); everything uncrewed flies as usual.
- **The qualification flight:** an uncrewed flight carrying a crew capsule (a dummy crew) that goes through the
  recorded moment (the same max-q, the same re-entry, the same days) with **the cause inside its limit**. Then news
  ("Requalified: …") and crewed flights resume. A loss costs a flight and a design problem, not a wait.
- **Closed powers** get a decision instead: requalify, or **fly again now**, hushed, the cause unfixed, a leak risk
  that grows with each crewed flight until a qualification flight is flown (the leak system, v1.24).

### Q136 — the scientist's and engineer's hooks (economy's side)
- **Scientist:** surface science counts **×1.25 / ×1.5 / ×2 by rank** for the Selene science contracts (a reading
  taken in person weighs more: `sciGot` records `by` and a weight; `selN` counts weights); in person, no contact
  needed. A sample return with a scientist pays more (the mission's pay ×1.25 by rank).
- **Engineer:** **one retry of a failed ignition per burn** (two at rank 3) in `igniteOK`'s roll, economy's code; at
  stations and outposts, production modules need one (LATE_GAME, later).
- **Pilot** (vehicle's side, noted for them): SAS modes the computer lacks, by rank (CREW § roles), `avOf`.

### Q137 — crew rotation by dispatch
- Needs the roster (Q133) and **a crew record in headless flights** (`procFly` gets `R.crew`).
- **The rotation run** is two linked dispatches: up, a crewed capsule docks at the station (a docking procedure;
  crewed docking is open to a rank-2 pilot before onboard computers, MIDGAME's ladder: the first routine is crewed);
  down, the old crew's capsule undocks and lands home (a flight from orbit, `R.fromOrbit`, with a deorbit procedure).
  The space lane owns the procedures (docking and deorbit as recorded phases); economy owns the schedule (both on the
  pad calendar), the crew assignment and the pay (Q9's *Crew rotation for X* contract).

### Slices (⚙, in order)
1. The roster: data, names, the first class, automatic picking, the record and ranks, the loss named (Q133).
2. Requalification (Q135).
3. Classes over time and the archetype mixes; the memorial (Q133's rest).
4. The scientist's and engineer's hooks (Q136).
5. Crew rotation by dispatch (Q137), with space's docking and deorbit procedures.

### Questions for Caio (numbered, with defaults; silence keeps them)
1. The first class when **the abort tests open** (default) or from the first passenger hop?
2. A class every **2 program years**, 3 people + 1 per centre level (default)?
3. Names as **given + family name** in home's school style (default) or one name?
4. Crewed flights **blocked until requalification** after a loss (default), with the closed power's skip decision
   (default, CREW round 2)?

## Plan: overflight politics (2026-10-09, economy session, QUEUE Q96; nothing built)

**What exists:** a spent stage that falls on a foreign power's land costs that power's opinion (−5, a town ×3), the
relation (−0.06) and damages (v1.13, `missionEnd`'s drops); the site picker warns when a site's planned downrange
crosses a neighbour (`downrangeWarning`). **What's missing is the overflight itself**: a rocket climbing over a
neighbour's land without dropping anything. Real programs bend their trajectories for it (Israel launches west, over
the sea, retrograde, to avoid its neighbours).

**Against the pillars:** it is a **design problem posed by real physics** (pillar 2: the ascent's ground track is
flown, not chosen from a menu) and it feeds the world's reaction (pillar 3). It must not become a chore (pillar 5): no
penalty from friends, no repeated nagging, and the site picker says it before you launch.

**Proposed rule (defaults):**
1. **Judged on the track actually flown**: while the vessel is below 150 km and within 1,000 km of its site, record
   the powers whose land is under it (`powerAt`, sampled each second of the ascent): `R.over`.
2. **Only tense neighbours mind**: for each power in `R.over` other than home and the site's host, with relation < 0:
   its opinion −2 and the relation −0.02, a **security state** ×2 (POWERS.md: touchy); one news line per power per
   program year ("*X* protests a rocket over its territory"); friends (relation ≥ 0.25) and the neutral say nothing.
3. **The picker and the debrief say it**: the site line warns of a tense neighbour under the planned downrange (today's
   warning, coloured by relation), and the debrief lists "flew over *X*" with the cost.
4. **Later, overflight rights**: a decision to buy a year's consent from a tense neighbour (a fee by relation), once
   leases (v1.56) and stakes show how players use such deals.

**Questions for Caio** (numbered, with defaults; silence keeps them): (1) judge by the **track flown** (default) or
by the site's planned downrange; (2) **tense neighbours only** (default) or any foreign land; (3) overflight rights as
a paid decision **later** (default) or now. One ⚙ slice when answered (S): `R.over` in `missionTick`, the cost in
`missionEnd`, the debrief line, a test.

## Plan: station, base, relay and rendezvous contracts (2026-10-09, economy session, QUEUE Q9; nothing built)

**What exists to build on:** stations from docked modules with berths, crew, labs and supplies (`stationOf`, Phase C);
lab-days earned between flights (`q.labDays`); moonbases (`baseOf`, E); flights from orbit (`R.fromOrbit`) and crew
kept aboard across flights (rotation works by hand); the Selene relay and moon orbits in the registry; docking
(`s.att`); supply runs to bases (v1.69) and the automation ladder (MIDGAME, D7). Contracts can now be judged on
**state between flights** (`sel`/`done`, v1.66) or **by a flight** (`ok`), and take an `after` (v1.81).

**The contract types** (the space session's five from Phase C, plus base, relay and rendezvous):

| Type | Offered when | Done when | Judged | Pay (before multipliers) |
|---|---|---|---|---|
| **Resupply station X** | X has crew and < 40 days of supplies | X's supplies rise by N kg since taken (a module with `sup` docks) | state | 30 + 0.12/kg, ×1.5 under 15 days |
| **Lab time on X** (sci, com) | X has a lab | N lab-days earned on X since taken | state | 4 per lab-day |
| **Expansion of X** (com) | X has a free port | a module of the client's kind (lab, habitat) docked to X | state (X's `attached`) | the module's price × 1.3 + 40 |
| **Crew rotation for X** | X's crew has served 120 days | a crewed capsule that left X lands home safe while X still has crew aboard | flight (`fromOrbit`, crew home) | 60 |
| **Base resupply / base lab time** | as for stations, with `baseOf` | as above, on the base's members | state | as above |
| **Relay coverage of Selene's far side** (sci, gov) | a far-side rover or station exists, or Selene science contracts are open | far-side contact ≥ 60 % of a day (`radioAt`, sampled each tick) for 30 days | state | 120 |
| **Rendezvous** (gov, com) | a registry object the client cares about (a derelict, a rival's satellite) | a flight within 100 m of it, relative speed under 1 m/s | flight | 80 |
| **Retrieval** (gov) | a valuable dead satellite (v1.81's `serviceTarget` rule, but dead) | it's docked and brought home (lands with it attached) | flight + `after` | 150 + its parts' value |

**The first station as firsts, not contracts** (the space session's flagship): `station1` a habitat in a stable orbit
with two free ports → `stationcrew` a crew docks → `stationlab` a lab added → `station30` 30 crewed days; epoch 3,
paid like the epoch-3 firsts (80–120M), and not in the race (the race is Selene's). They give the contracts above a
station to be about.

**Rules carried over:** pay floors (v1.77) by the cheapest preset that can do it (the Docking preset for station work);
W11 (a mission counts only on a flight launched while it was open) for the firsts; `whyOf` reasons: "*X* is down to
12 days of supplies", "*X* has a free port". **Routines** follow MIDGAME's ladder: crewed rotation is the first
routine (pilots), uncrewed resupply waits for onboard computers (D7's rule), so the resupply contract is flown by hand
until then, which is what makes it a job early and a routine later.

**Build order** (each a ⚙ slice):
1. State-judged station work: resupply, lab time, expansion (no new flight checks; `selTick`'s pattern).
2. The first-station firsts.
3. Bases: the same three, on `baseOf`.
4. Flight-judged: rendezvous, retrieval (needs the near-pass check during a flight).
5. Relay coverage (a daily contact sample on Selene's far side).
6. Crew rotation, after Q137's crew record in headless flights.

**Questions for Caio** (numbered, with defaults; silence keeps the default):
1. First station as **firsts** (default) or as a contract chain?
2. Supplies running out at a station: today the crew goes on rations and labs stop (pillar 5). Should a resupply
   contract's deadline be **when they run out** (default) or a fixed window?
3. Rendezvous with **rivals' satellites**: allowed as a contract (default: only once rivals have stations, LATE_GAME
   round 7), or never?
4. Retrieval brings a satellite home whole: **its parts' value back as refurbishment** (default) or the pay only?

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

## v1.74.1 — the sponsor's cover skips a flight that reached orbit (2026-10-09, economy session, Q122)

PLAYTEST #33: an Orbiter left in a 200 km orbit, the priciest rocket yet and completing nothing (no instrument
package for *The beeper*), drew "+42M Sponsor covers the failed attempt". The rocket worked; what it lacked was the
payload. `coverLoss` now also requires the flight **not to have reached orbit** (`R.orbit`), so the word "failed" stays
true. The Debrief's days line says "1 day passing" in the singular (`sim/debrief.js`, one line, flow's file). Test
`econ-1` gains a check (mutation-tested).

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

## v1.77.1 — dispatched flights launch from their procedure's site and pay its lease (2026-10-09, economy session, QUEUE Q95)

A dispatched flight used to launch from home whatever its procedure (`dispatchRun` passed no site to `procFly`). Now
`procSiteOf(stack)` is the site the design's procedure was flown from (`proc.site`), or home:
- `dispatchQuote` and `baseRunQuote` refuse when `siteAccessOf` refuses that site, and add its lease (v1.56) to the
  price (`fee`, `site` on the quote);
- `dispatchTick` stands a queued dispatch down if the site has closed to us since (relations, sanctions), checks that
  site's weather for scrubs, and charges the lease with operations;
- `dispatchRun` (bodies' code, one argument) and `baseRun` fly from that site.
Test `econ-10` (mutation-tested): home 49M, the same dispatch from a leased site abroad 55M, refused when hostile.

## v1.81 — obsolescence and servicing: satellites replaced for upgrades (2026-10-09, economy session, QUEUE Q126)

MIDGAME.md § Satellites (approved): lifetime is a design choice; **replacement is for upgrades**; servicing is special,
for valuable assets. Built in `sim/program.js` and `sim/contracts.js`:
- **A satellite keeps its era.** `satEra(q)` stamps the computing era at its first day up (`q.era`; satellites from
  older saves get today's). **What it earns drops for each era it falls behind**: `satQual(q)` = 1 / (1 + 0.35 × eras
  behind): 74 % one behind, 59 % two. Applied to TV's daily pay (`utilTick`) and imagery sales (`satTick`, the space
  lane's line, one factor). When a new era arrives, each satellite that earns gets one news line: "*N* generations
  behind, earns *x* %. A new one would earn it all, or service it" (`obsTick`).
- **Servicing contracts** (`CT.service`, government or commercial): offered for **one of ours that's valuable and
  behind**: TV in the capital's sky, or an imager with 30 % contact or more, at least an era behind, not already on
  the board (`serviceTarget`). Pay 96M per era behind (before multipliers). **A flight that docks with it** (it's in
  `s.att`) completes it, and the satellite is brought up to date (`after`: `q.era` = now). `contractEval` now calls an
  optional `CT[type].after(c, s)` on completion.

**TV's pay against it** (the queue asked): `TV_RATE` 0.4M a day while in the capital's sky, which v1.71 made all day:
160M a program year. A stationary TV satellite on a Beeper-class launcher costs ~60–80M, so it pays back in half a
year. One era behind it loses ~42M a year; a new one pays back the loss in under two years, and eras are years 3,
7, 14, 25: **replacing once per era is worth it, as MIDGAME wants.** Servicing (96M from its users, plus the earnings
back) is the better deal for an expensive satellite. TV's rate is left as it is; the career runner doesn't fly TV yet,
so a measurement waits for that.

Test `econ-11` (3 checks; the era cut mutation-tested).

## v1.81.1 — a mission counts only on a flight launched while it was open (2026-10-09, economy session, W11, Q113)

W11 (defaulted by the design desk, Caio silent) built: `missionEval` skips a mission that wasn't open when the flight
launched (`R.open0`, recorded since v1.74; older saves' flights as before). Chained firsts no longer pay together on
one flight: a 2 t lift earned Heavy Lift I and II at once, and the tracking flight that weighs Nyx also earned *Nyx
flyby* (PLAYTEST #29, +460M on one Probe). The flyby, Heavy Lift II and the like now need a flight of their own.
Career runner: first orbit still 4 flights everywhere (5–8 with a lost attempt, every start reaching it); two-year
funds a little lower (mean 423M). Test `econ-12` (mutation-tested).

## v1.89 — powers as content: schools, names, rivals' news (2026-10-09, economy session, QUEUE Q103, POWERS.md)

POWERS.md's economy fan-out, in `sim/program.js` (after the archetypes) and `sim/contracts.js` (the race's news):
- **A school per power** (`p.school`): drawn from its archetype's affinities (`SCHOOL_W`, POWERS.md's weights) with
  **exactly the draw the look lane's `schoolOf` used** (`rng(WSEED·7907 + i·131 + 17)`), so every rocket keeps the look
  it had; `schoolOf` (`app/gl.js`, one line) now reads `POWERS[i].school` first: one source of truth. A **resource
  state** has none of its own: it takes its **contractor's**, the power whose alignment is nearest (`p.contractor`).
  The superpowers' affinities don't overlap, so their schools differ; two powers sharing a school get hues 120° apart.
- **Names from the school** (`SCHOOLS[k].syl`, syllable counts per school: Cape and Arsenal 1–2, Steppe and Coastal
  2–3, Mountain 3, Isle 2) and **the form of government from the archetype** (`ARCH_FORMS`, with the new People's
  Republic, Emirate, Sultanate and State), unique within the world, on their own seeded draws after the archetypes: the
  world's places, economies and relations are unchanged, and the launch sites take the new roots (`extendSites` runs
  after). This build's world: *Dunnzar Republic* (home, rising, Arsenal), *Asaro Commonwealth* (open superpower,
  Coastal), *Mirtov Federation* (closed superpower, Steppe), *Republic of Dunndag* (rising, Arsenal), *Sultanate of
  Natovtov* (resource state, Mirtov's Steppe). Names aren't saved, so old saves show the new names.
- **Rivals' news by archetype** (`raceNews`, `RIVAL_WIN`): the open superpower **announces each attempt 30 days
  ahead**; the closed superpower's attempts are preceded by **rumours from the open press** 10 days before, and its
  wins come as a state bulletin; the others launch unannounced; each archetype wins in its own tone (live coverage; a
  bulletin; "joins the front rank"; "on a shoestring"; "claims a world record"; a "satellite test"). The race's
  schedule is unchanged (rising powers copying, frugal ones partnering: a later slice, with LATE_GAME round 7's rivals).

**Not yet:** headline tone for the program's *own* news by archetype (mission control's voice); the home name doesn't
follow a different archetype chosen at a career's start (the look does, as before); flags and roundels (flow, look).
Test `econ-13` (4 checks; the announcements mutation-tested). Traps hit, again: a mid-line `//` comment in `gl.js`
swallowed `const aff=` (the suite's page-parse check caught it), and an apostrophe in a heredoc ("People's").

## v1.89.2 — rivals' personalities in the race; our own voice (2026-10-09, economy session, QUEUE Q165)

Q103's next slice (POWERS.md § archetypes):
- **The race schedule** (`raceSchedule`): a **frugal** power doesn't race (it partners: its offers and stakes, v1.24,
  are how it shows up); a **rising** power **copies, then catches up**: it never goes for the first of the race's firsts
  (the beeper) and runs the later ones half again as fast. Every power's draws are still made in the same order, so the
  others' dates don't move. In this build's world (no frugal power), a fast rising power took the hop and the orbiter
  in the test, leaving the beeper to the closed superpower.
- **Our own voice:** the "FIRST IN THE WORLD" headline ends with a line in the home archetype's voice (`OWN_TONE`):
  live coverage (open superpower), the after-the-fact bulletin (closed), the nation among the leaders (rising), the
  science desk's motorway bridge (frugal), the palace's world record (resource), the site's successful test
  (security).
Test `econ-15` (2 checks; the schedule rule mutation-tested). **Not yet:** mission control's in-flight voice (app
messages, flow's); "the second power to…" news when a rising power repeats a claimed first.

## v1.89.3 — station work: resupply, lab time, expansion (2026-10-09, economy session, QUEUE Q162; Q9 plan slice 1)

Three contract types for **our stations** (`sim/contracts.js`), judged between flights on the station's state since
they were taken (`baseOf` sets the baseline at acceptance; `selTick` judges, as for Selene science):
- **Resupply *X*** (government, commercial): offered when a crewed station has under 40 days of supplies (`ST_LOW`).
  It asks for 60 days' worth (two crew: 600 kg), **due when its supplies run out** (W22 default 2), pays
  (30 + 0.12/kg)·1.6, ×1.5 under 15 days. Done when the station's supplies have risen by that much since (a module
  carrying `sup` docks: a habitat brings 300 kg).
- **N lab-days on *X*** (science, commercial): a station with a lab and a crew; 10–40 lab-days at 4M each (·1.6); done on
  `q.labDays` earned since taken.
- **A lab or habitat module for *X*** (commercial): a station with a free port; pays the module's price × 1.3 + 40
  (·1.6); done when one more of that module kind is part of the station.
Each gives its own reason line (`CT[type].why(p)`: "Station 1 has 35 days of supplies left", "has a free port").
**Fixed on the way:** `selDone` applied the science yield to every state-judged contract; now only to science
clients, as `contractEval` does. Test `econ-16` (3 checks; "since taken" mutation-tested).
**Next:** slice 2, the first-station firsts (Q163); bases get the same three in slice 3.

## v1.89.4 — the first station as firsts (2026-10-09, economy session, QUEUE Q163; Q9 plan slice 2)

Four epoch-3 firsts (W22 default 1: firsts, not contracts; not in the race), **world missions** judged between flights
on the registry's stations (`stFind` over `stationOf`), so a station built over several flights counts:
- *A station* (80M, after *The beeper*): a habitat module in a stable orbit with **two free docking ports**;
- *A crew aboard* (100M): a crew living on it;
- *A lab in orbit* (90M): a laboratory module on the crewed station;
- *Thirty days aboard* (120M): thirty **crewed days**, counted in `utilTick` while a station has crew and supplies
  (`q.crewDays`; the mission shows "*n* of 30 days" as progress).
They open the station contracts of v1.89.3 in play. Test `econ-17` (crewed-day counting mutation-tested). A note for
tests: a stub station needs real port geometry (an axial `port` is free only with nothing on its top face; a radial
`rport` is always free).

## v1.89.5 — base work: the station contracts for bases (2026-10-09, economy session, Q9's plan slice 3)

The three station contracts of v1.89.3 (resupply, lab time, a module) now also come for **our bases**: the offer picker
walks landed beacons too, and a base's state is read with `baseOf` (everything landed within 500 m of the beacon:
the same fields as `stationOf`), through one accessor `stOf(q)`. A base's resupply is met by **landing** a module that
carries supplies within 500 m (the brief says so; 4 km away doesn't count), its module contract by landing one there;
lab-days are the beacon's (`crewTick` keeps them there). Supply runs (v1.69) are how a base is fed by dispatch once
onboard computers arrive. Test `econ-18` (2 checks; bases ignored, mutation, fails).

## v1.98 — rendezvous and retrieval contracts (2026-10-09, economy session, QUEUE Q180, Q9's plan slice 4)

- **Rendezvous** (gov, com; after `beeper`): for spent hardware (`q.junk`) or a satellite of ours that has **gone
  quiet** (an era behind and not earning: no TV in view, an imager under 30 % contact; no crew, nothing docked).
  Done by a **near pass during the flight**: `rdvTick` (called from `missionTick`) samples each tick for being within
  `RDV_D` = 100 m at under `RDV_V` = 1 m/s, in the target's frame as `tgtOf` does; a target loaded into the flight as
  a vessel (`loadEntry`, within 2.5 km) counts through `s.reg`. Recorded in `R.rdv[id]`. Pays 80 (×1.6).
- **Retrieval** (gov; after **`stationcrew`**, the first docking): for a quiet satellite with at least `RETR_MIN` = 8M
  of hardware at refurbishment value. **Done only when the flight lands at home with it stowed in a cargo bay with the
  doors shut** (`att` kind `bay`, `doorF` 0). Held on a port or by the claw doesn't count: the bay is the dependency
  (Caio, 2026-10-09). Pays 150 (×1.6), and in `after` **its hardware comes back** (W22 4's default): the shape's
  prices × `REFURB`, its own Debrief line (`refurb`). `dockEnd` already takes it off the registry ("brought home").
- **Not yet:** rivals' satellites as targets (W22 3: once rivals have stations, Q138); a vehicle-part era gate. The
  bay and the arm are buyable from the first flight, since only rover parts have gates (`rvPartOpen`). The *contract*
  waits for `stationcrew`, but the parts don't. Proposed for vehicle: gate `bay` and `arm` on the first docking
  (QUEUE *Proposed*).
Test `econ-19` (3 checks: offers and the gate; near/far/fast passes; bay closed/open/port).

## v1.104 — windows: a dispatch launches at its next valid window (2026-10-09, economy session, QUEUE Q185, Q127 slice 2)

MIDGAME § Windows, decision 3. In `sim/program.js` beside the dispatch code:
- **`windowRule(kind, o)`**: `'any'` (an orbit by inclination alone: the calendar picks the slot); `'plane'` (a given
  orbital plane, normal `n`, passing over the launch site); `'light'` (daylight at a surface site when the run
  arrives: the sun ≥ 5° up, `lead` days after launch = the ascent and a Hohmann coast, 2.7 days to Selene).
  Planetary alignment waits for planet routes (M5).
- **`nextWindow(rule, T)` → {day, wait, why}**, in program days, sampled every 15 minutes (plane passes bisected to
  the exact moment). Measured: Selene's day is its 13-day orbit, so a surface run waits up to 6.7 days and half of
  them go at once. A 30° plane passes over the equatorial pad twice a rotation (≤ 0.49 d).
- **Recorded with procedures:** `procWindow(proc, kind, o)` keeps the rule on the procedure that flies it
  (`proc.wins`), and every dispatch carries its `rule` and `ready` day. Derived when quoted, not at fly time: the
  procedure recorder is the space lane's code. Moving it there later changes nothing downstream.
- **Who waits:** supply runs to bases (`baseRunQuote`) take the `'light'` rule. Contract dispatches take `'any'`
  (contracts set an inclination only, so there's no wait). `'plane'` is ready for station routines, Q110's work. A
  weather scrub or a money hold re-finds the window rather than adding a day. The news and the base's Fleet line say
  "(waits 3.2 d for daylight at Selene Base 1)".
- **The pad calendar** (`netModel().pads`): a dispatch is now two bars, stacking (`kind 'dispatch'`) and then the
  wait for its window (`kind 'window'`, the pad held). **Flow:** `.cbar.window` has no style yet, and
  `app/network.js`'s fallback still builds one bar.
Tests: `econ-20` (2 checks: light and any; plane), one check added to `econ-7` (the supply run's quote lands in daylight).

## v1.130 — rivals as programs from epoch 1 (2026-10-11, economy session, QUEUE Q188; W26.1)

Caio's W26.1: rivals are programs from the start, not seeded schedules. The plan is in § "Plan: rivals as programs…" →
"Q188 amendment". This is its first slice (`sim/contracts.js`, after `RACE`).
- **`PROG.riv`**: per rival, the next first `k`, progress `p` toward that first's work `w` (0.75–1.25, from the world's
  seed), `got` (the days it really got there), and a spur. **`rivTick(d, R)`** runs in `econTick` before `raceTick`: the
  rate is `speed / 150 × money × spur`, where `speed` is the old schedule's (tech × √economy × (0.6 + 1.6 × prestige
  appetite)). `money` is the rival's **own** treasury: a resource state follows the commodity cycle (×0.5 in a bust,
  ×1.5 in a boom), a security state its tension, the rest 1. Reaching `w` is an attempt, which succeeds with
  0.55 + 0.35 × tech. A failure sets the rival back a third: news if it's open (≥ 0.6), a rumour 40 % of the time if not.
  A rival that gets there after us makes a small "gets there too" line.
- **`RIVALS` is now the forecast**, recomputed every tick: per first, the real day a rival got there, or the soonest
  projected one (never today, so a first is lost only after an attempt has really succeeded). `raceTick`, `raceNews` and
  the race panel read it unchanged, so its "expected around day N" now moves as budgets move.
- **The spur:** a first we win (`missionComplete` → `rivSpur`) speeds every rival still racing for it by
  × (1 + ½ × prestige appetite) for 365 days.
- **`raceSchedule()`** keeps its name and callers. It rebuilds the state when it's missing (old saves), when home changed
  or when the day went backwards (a new game), fast-forwarding to today at mean rates with no rolls. A defection keeps
  the rivals' programs and enters the old home with the race firsts we flew for it.

**Measured** (scripts in the session's scratchpad; numbers here):
- **Pacing kept.** Over 20 worlds per home, with no player and 5-day ticks, the winning rival's day for beeper / hop /
  orbiter is, from home 0: **82±12 / 160±12 / 240±16** (the old formula, averaged over its draws: 79±16 / 163±24 /
  246±30); home 2: 111±21 / 197±15 / 284±26 (old 106 / 194 / 282); home 3: 82±20 / 164±22 / 243±26 (old 79 / 160 /
  242). The old game only ever used one of those draws (`rng(4242)`): Mirtov on 83 / 176 / 245 in every world. Now
  winners vary: from home 0 Mirtov takes 53 of 60 firsts, Asaro 5, Natovtov 2; from home 2 Dunnzar 29, Asaro 23,
  Natovtov 8.
- **`career.mjs 4 8`** (144 runs): how often the runner was **not first** to orbit: old schedule **19**, programs with
  no spur 17, **with the ½ spur 27**. The full spur (× 1 + prestige) made it 11 of 18 in `career.mjs 4 3` (from 3), so
  it was halved. The hop barely changes (4 in every variant). The beeper is always lost, because the runner never
  rushes it, as before. `PACE=1` is unchanged (it's the player's side).
- **Negative result worth keeping:** the seeded schedule made the race identical in every world and every save. That
  was invisible from inside one game, and plain the moment you print it per home.

Tests: `econ-21` (5 checks: forecast and worlds differ; an attempt fails then succeeds and the race is lost; the spur;
commodity money; old save and defection). `econ-13` and `econ-15` pass unchanged. **Waiting on Caio:** W38 (spur,
panel by openness, second-place news; defaults built).

## v1.161 — the commercial giant (2026-10-13, economy session, QUEUE Q206; D10, POWERS.md § Commercial giant)

**What it is:** a company, the one rival that isn't a nation (`PROG.giant`, `sim/contracts.js` beside the rivals). It
has no entry in `POWERS`, `RIVALS` or the race; it is based in a power and answers to its law.
- **Arrival** (`giantTick`, from `econTick` after `rivTick`): when the world's computing year (`worldCompYear`, so a
  computing centre brings it a little sooner) passes **18–21**, drawn per world (`giantYear`, from `wseed`). Its base is
  drawn by economy × (0.4 + openness), home included; its name from Foundry's forms (*# Industries*, *# Space*, *#works*,
  *#ward*). News: a steel prototype on a live stream, orbit promised within a year.
- **Prototypes** for 320–480 days: up to two "rapid unscheduled disassembly" headlines; it sells nothing yet.
- **Orbit**, then the market: its share (`giantShare()`) grows from 0 to **40 % over four years**; every **commercial**
  offer's pay is × (1 − share) in `genOffer`, never under `payFloor`. A price-cut headline each of those four years.
- **It sells parts to anyone, us included** (`giantSells()`): `sourceOf` returns `{how:'giant', k, from, name}` for any
  part home can't make, before imports: k = 1.2 falling to 1.0 with its share (an import is ×1.5). Not while its power
  sanctions us or is hostile (relation ≤ −0.2), as imports. Bought abroad, it costs the same opinion at home as an import
  (`importNews`). Its parts arrive certified like imports; we can start our own line for one (not a licence).
- **UI:** the builder's source line reads "from *Name* (*Power*)"; the imports line on rollout "*Name* ×1.2".
  `partMaker` (`app/gl.js`) draws its parts in our school until Foundry exists (Q205).

**Measured** (`econ-22`): in world 1000 it arrives at year 19.6 in Dunnzar, orbits 432 days later after two RUDs; a
capsule a resource state imported at ×1.5 comes from it at ×1.2. At the full 40 % share, 40 commercial offers pay
**1460 → 1176M (−19 %, not −40 %)**: the pay floor holds the cheap jobs (sounding, test, beeper), so the giant bites the
big commercial work and leaves a floor to climb from. No effect on `career.mjs` (4 years; it arrives around year 20).

**Not yet:** racing for the capstones (Q138's later slices: the race has only the three early firsts); Foundry's look on
its parts (Q205); choosing its part over one we make (a builder choice: decision 2's mixed rockets); it as a customer for
our depots and relays (LATE_GAME rule 5); launch rides sold to us.

Tests: `econ-22` (3 checks: arrival, prototypes, orbit, sales cheaper than an import; share, pay and floor, news, price
to ×1.0; sanctions from its power stop its sales). **Waiting on Caio:** W40 (three defaults, built).

## v1.165 — a missed deadline costs a wait (2026-10-13, economy session, QUEUE Q295; DECISIONS D17.4)

**Before:** a missed deadline (and a withdrawal, priced the same since Q93) cost −10 standing with the source and −3 of
the client's opinion. **Now** (`contractLost`, `backTick` in `sim/contracts.js`): the job is lost and nothing else; the
client asks again **60–120 days later** (seeded per contract) as a fresh offer for the same job and pay, with "Asked
again: *client* still needs it" as its reason and a *Back on offer* news line. It drops instead if its type's mission is
no longer done, the client sanctions us, or the job's reason is gone (types with `open()`: a satellite to service, a
station's need; those regenerate their target and keep the pay). A full board makes it wait for a free line. Harm to
people keeps its own costs (losses and crew rules don't go through here). The withdraw button's tooltip says so.

**Measured** (`career.mjs 4 8`, 144 runs, before → after): flights 37.8 → 40.1, contracts done 29.9 → 33.2, final
opinion 49.5 → 53.8, final funds 903 → 872M (−3 %, inside the runner's seed noise), lowest funds 61 → 60M, bailouts 1.3
→ 1.1. The poor-world companies end lower (frugal 203 → 129M, resource 516 → 269M) though their lowest funds and
bailouts don't move; with 8 seeds that's not separable from noise, so I'm noting it, not tuning for it.

Tests: `econ-23` (2 checks: no loss, the same job comes back with its reason; a full board waits, a sanctioning client or
a vanished target drops it); `econ-9`'s withdraw check and core's missed-deadline check rewritten to the new rule. Test
fixtures that reset `offers`/`active` reset `back` too.

## Plan: rivals' satellites as targets (2026-10-13, economy session, QUEUE Q187; W22.3, with space; nothing built)

**Today:** rivals are progress counters (`PROG.riv`, v1.130); no rival satellite exists as an object. Rendezvous and
retrieval contracts (v1.98) target our own quiet satellites and spent hardware (`rdvTick`, the bay retrieval). The pieces
a stealth model needs exist: `inShadow(b, r)` (`sim/power.js`), per-power computing lag (`compLag(i)`), sanctions
(`sanction(i, days, why)`), opinion and relations (`opAdd`, `relOf`), the Debrief's incidents, the military offers' leak
rule (`offerRisk`, `LEAK_P`). The design is vehicle notes § "Satellite hacking" (Caio) and W22.3 (retrieval on hacking's
stealth rules).

**1. Rival satellites as objects** (space + economy). A rival that has reached orbit (`PROG.riv[i].got.orbiter`)
launches satellites by its budget and priorities: security → spy and early warning, commerce → comms, science →
weather and science; a handful each (cap ~6), replaced as they age. They live in their own list, `PROG.rsats` (not
`PROG.sats`, so our earnings, power, aging and servicing never touch them), on rails, with `owner`, `kind`, `era`,
`value` (refurbishment worth), a generic shape by the owner's school, and the owner's colour on the map. `satAt` places
them; `tgtOf` and `loadEntry` accept them as targets so a flight can approach and dock with one like any registry
object. Coarse: they don't manoeuvre or decay.

**2. One stealth model: exposure.** During a flight, `stealthTick(s, R)` (beside `rdvTick`) accumulates **exposure**
to each owner whose satellite is within `STEALTH_D` = 5 km:
- **Sunlight:** the craft sunlit adds exposure each second (`SUN_K`); in Tellus's shadow nothing (optical trackers
  see a sunlit craft against a dark sky: the dawn and dusk rule, simplified to "sunlit is seen").
- **Plume:** every burn inside `STEALTH_D` adds exposure by its Δv (`PLUME_K` per m/s), shadow or not: a big burn
  close in gives you away.
- **Radar:** once the owner tracks small objects by radar, exposure grows inside `STEALTH_D` at a steady rate whatever
  the light: the window closes. The owner's radar era = its own computing era (world year − `compLag(i)`) reaching
  *Onboard computers* (year 7 for a superpower, later for others): a tech-era window, as Caio's note asks.
- **Time:** the work itself (holding for an inspection, the hack's minutes) multiplies what accumulates, so long jobs
  must be done in shadow.

Spotted with p = 1 − e^(−exposure) (a security state ×1.5), rolled once at the flight's end (seeded, like other
flight rolls). An unspotted operation can still **leak** later at `LEAK_P`/2 within a year (the military offers' rule).
The player sees exposure live, honestly: a HUD line *"Seen by Mirtov: low · sunlit · burn 3 m/s"* (flow's, one call)
and the Debrief says whether anyone noticed.

**3. Three operations, one model, rising stakes (k):**
- **Inspection** (k = 1): within 100 m under 1 m/s for 60 s (the rendezvous rule with a hold). From a government or
  military client whose relation with the owner is below −0.3; pays like rendezvous ×1.5. Opens once rivals have
  satellites.
- **Hacking** (k = 2, Caio's): hold within 20 m for minutes set by our computing era (hand 20, mainframe 10, onboard
  3), carrying an antenna and a computer part. Payoff: the satellite's service is ours for ~30 days (a comms satellite's
  pay, a spy satellite's imagery for our image contracts), or a client's job delivered. Opens with the first docking
  (`stationcrew`), as retrieval does.
- **Retrieval** (k = 3, W22): the existing bay retrieval on a rival satellite: home with it in a shut bay; its
  hardware's value back as refurbishment (W22.4), and it leaves `PROG.rsats`. The owner always knows it is gone: if
  unspotted, "lost, cause unknown", and suspicion falls on the powers able to dock (a small relation dip, shared).

**4. Consequences when spotted** (× k): an **incident** (headline, Debrief line); the owner's opinion −8k and relation
−0.1k; at k ≥ 2 with relation under −0.3, a **sanction** of 120k days (which cancels its contracts and its budget share,
as today); its close friends (relation > 0.5) −2k opinion; tension rises with it. **At home:** a job for home's own
military is quietly approved (+2 home opinion); our own initiative embarrasses an open home (−3k) and pleases a
security state's (+2). Not spotted: the client pays a secrecy premium and nothing else happens. **No combat:** nothing
here destroys anything. The anti-satellite test and its debris stay Q148's.

**Questions for Caio** (numbered, with defaults; silence keeps them):
1. **Rival satellites as real objects** on rails, a few per rival, drawn and flyable (default), or abstract targets in a
   contract only?
2. **Radar closes the window** at the owner's *Onboard computers* era (default), at *Mainframes* (a short window), or
   never (stealth always possible)?
3. **An unspotted retrieval:** the owner knows it's gone, cause unknown, suspicion shared among docking powers (default),
   or no reaction at all?
4. **Hacking's payoff:** its service is ours for ~30 days, or the client's job (default), or the contract pay only?

**Slices** (⚙ unless marked; M2–M3):
1. `PROG.rsats` from rival programs, on rails, on the map in their colours, approachable as targets (space + economy).
2. `stealthTick`, the roll at the end, consequences and the Debrief incident; the HUD exposure line (🖥, with flow).
3. Inspection contracts on rival satellites (rendezvous with a hold, from hostile-leaning clients).
4. Retrieval of rival satellites (the bay rule; the owner's loss; suspicion).
5. Hacking: the hold, the era's minutes, the payoff.
Measure before tuning: fly the stock Docking preset to a rival satellite in shadow and in sunlight, with and without a
final burn, and set `SUN_K`/`PLUME_K` so a careful night approach is ~10 % spotted and a sunlit one ~70 %.

### Q187 amendment: Caio's answers (W41, 2026-10-13)

1. **Real satellites** (as planned, slice 1).
2. **Radar, proposed as layers** (Caio: "suggestions?"; this is the default unless he picks otherwise). Each layer of the
   owner's tracking has its own counter, so the window narrows by era instead of slamming shut:
   - **Optical** (from the start): sees a sunlit craft. Counter: work in Tellus's shadow.
   - **Ground radar** (the owner's *Mainframes* era): sees anything inside `STEALTH_D`, lit or not, but **only while the
     work is above the horizon of the owner's sites** (its pads, cities and ground stations; radar is on the ground).
     Counter: do the job on the far side of the world from the owner. `stealthTick` tests the owner's sites against the
     craft's position, as `entryLink` does for ground stations.
   - **Space surveillance** (once the owner flies an early-warning satellite of its own, a `PROG.rsats` kind, normally
     its *Onboard computers* era): sees you anywhere. Counter: none by hiding; only a short job and a small burn.
     Tapping that satellite first (below) is how you'd know where it is looking: a nice reason to hack in order.
3. **An unspotted retrieval raises suspicion:** the owner knows the satellite is gone; suspicion lands on every power
   able to dock (a relation dip, shared), and grows with each further unexplained loss (`PROG.susp[i]`, decaying over a
   year). Enough suspicion makes the next spotting count double.
4. **Hacking's payoff:** **contract pay if it's a contract; the satellite's service if it's our own initiative.** Caio
   adds two kinds of hack, and both fit mechanics we already have:
   - **A tap (indefinite):** it keeps working for its owner and also sends to us. It joins our network as if it were
     ours, through the existing code: a camera satellite's take fills its recorder and our ground stations drain it into
     **imagery sales** (`satTick`, `IMG_RATE`, v1.100) and can deliver **image contracts**; a comms satellite becomes a
     **relay** in `netLinks` and counts for TV and navigation coverage. A flag on the `PROG.rsats` entry (`tap: 'us'`)
     is the whole change in those functions. It lasts until the owner notices: each month a small chance, higher with
     its computing era and with our use (bits taken), and then the spotted consequences apply as for a hack (k = 2),
     with the tap cut.
   - **A data theft (one-off):** download what its recorder holds. A science or weather satellite's data pays as
     **science data received** (the same per-bit pay); a **spy or military satellite's** data reveals its owner's
     program: its race progress and next first become exact on the race panel for a year (Q307's panel shows a closed
     rival as "soon" or nothing; stolen data shows the forecast day), and the next military offer against that owner
     pays more. Quicker than a tap (the download time at the link's rate, in the hold), so less exposure.
   Choosing among inspect / steal data / tap / take its service for a client happens at the hold (a HUD choice, flow).

## v1.171 — overflight: flying low over a neighbour (2026-10-13, economy session, QUEUE Q181; W23)

**Low flight only** (Caio, 2026-10-13: "flying over, we mean low, right? not orbiting?"). `overTick` (from `missionTick`,
beside `rdvTick`) samples about once a second, while the vessel is **below 150 km**, **not in orbit** (its periapsis
inside the atmosphere: an ascent, a hop, a descent) and **within 1,000 km of its launch point**, whose land is under it
(`powerAt`): `R.over`. Home and the site's host don't count. Orbit is free at any height: the stock Orbiter circles at
100–120 km, so a height rule alone would have charged it on later passes near the pad, hence the periapsis test.

**The cost** (`overEnd`, in `missionEnd` before the drops), W23's rule, any foreign land scaled by the relationship:
k = (0.5 − relation)/1.5, clamped 0–1 (an ally at ≥ 0.5 pays nothing, relation 0 a third, −1 all), × 2 for a security
state; opinion −3k, relation −0.03k. One protest headline per power per program year. A stage that **falls** on its land
still costs more (−5, −0.06, damages). The Debrief lists each: "Flew low over *X*: it protests (opinion −2.0)" or "…, a
friend: no objection".

**Measured:** on the default map, 1 of 16 launch sites has foreign land within 1,000 km due east (s5 over Natovtov,
relation 0.25, k 0.17): the rule bites by choice of site and heading (polar and retrograde launches cross more), as the
plan wanted, and is never a nag from friends.

**Not yet:** overflight rights (W23: a decision from the start, rivals may refuse; QUEUE *Proposed*); dispatched flights
(they repeat an ascent without `missionTick`'s samples) don't record overflight; the site picker's warning
(`downrangeWarning`) doesn't yet colour by relation.

Tests: `econ-24` (2 checks: recorded low and climbing, not in orbit at 120 km, not above 150 km, not over home; an ally
shrugs, a rival protests once a year, a security state double).

## v1.177 — routines: a route keeps N satellites up (2026-10-13, economy session, QUEUE Q184, Q110 slice 1; W27, D17.1)

**Scope:** Q184 named "a repeating supply run to a base", written before D17.1 moved resupply to M3 with crew and made
M2's finish line "a routine repeat satellite launch keeps a network up". So this slice is the satellite routine; base
and station resupply routes are the next slice, at M3.

**A route** (`PROG.routes`, `sim/program.js` beside dispatch) keeps `keep` satellites of one design up in one orbit (its
height and inclination taken from the satellite it was made from). **Made** from the Fleet tab: a satellite in Tellus orbit
whose design (`q.stack`) has an ascent procedure shows *Make a routine*. **Its runs are dispatches with no contract**
(`orderRoute`; `routeC` stands in for the contract so `dispatchQuote`, the pads, the windows, the weather scrubs and the
money hold all apply unchanged); `dispatchRun` flies the procedure headless and registers what it puts up, now keeping
the new satellite's id on the dispatch (`D.satId`, one line in `sim/procedures.js`) so the route tags it (`q.route`).
**A clean run** reached the route's orbit (within 15 % of its height, 2° of its plane) and left a satellite up.

**W27's ladder:** runs are ordered by hand at first; after **3 clean runs in a row** and once the automation ladder allows
deployments (`autoAllowed('deploy')`, mainframes), *Repeat by itself* is offered (opt-in per route, MIDGAME decision 1).
Then `routeTick` (end of `econTick`) orders one run whenever fewer than `keep` of the route's satellites are **up**:
not junk, not adrift, and able to hold their orbit and stay out of the air for more than **30 days** (`ROUTE_LEAD`),
so a replacement is on its way before one is lost. A failed or off-orbit run resets the clean count and pauses the
repeating until a clean one. A route waits while one of its runs is queued or needs you.

**Shown:** the Fleet line under each of the route's satellites (*n of N up*, the next run, *keep N±1*, *Order a run*,
*Repeat by itself* with the reason it's not yet allowed, *End*); `netModel().routes` (id, name, from site, to band,
keep, up, auto, why, next launch, runs, clean) for the network page; the pad calendar's bars carry `route` (flow can
style a routine's bar).

**Measured** (`econ-25`): three Beeper runs to its hand-flown 106 km orbit all fly clean headless. At that height
most re-enter within 30 days, so only 1 of 4 counts as up: a low route keeps re-ordering, which is the honest cost of a
low orbit (the Fleet line shows it). Mainframes allow repeating from day ~1455 in that world.

**Not yet:** resupply routes to stations and bases (M3, D17.1; `baseRun` exists for one-off supply runs); replacing a
satellite for an era upgrade (D17.5's replacement offers); a cost-per-year line for a route; the network page drawing
routes (flow).

Tests: `econ-25` (2 checks: made from a satellite, three hand-ordered runs fly clean and join the route; repeating
waits for mainframes, then orders exactly one run when short, on the network model and the pad calendar).

## v1.204 — a dry satellite counts as up by its real lifetime (2026-10-13, economy session 2, QUEUE Q414, PLAYTEST #104)

The robot's `m2` run (Q233) made a route from a weather satellite at 293 × 301 km with no station-keeping propellant:
it would stay up ~1,034 days, but `routeSats` asked for 30 days of holding *and* 30 of decay, so the route read 0 of 1
from the moment it was made and, repeating, would re-order at once.

**The rule** (`routeLife(q)` in `sim/program.js`, beside `routeSats`): what holding buys depends on the orbit.
- A **slot the tides move** (`slotRate(q) > 0`: high orbits, stationary): dry, it drifts out of the place it was put
  for, so it serves `min(skLife, decayLife)`, as before.
- A **low orbit** (`slotRate` 0): holding only fights drag. Dry or drifting it still serves while it sinks, so it
  serves `skLife + decayLife` (holds while its tanks last, then decays from that orbit).
`q.adrift` no longer excludes by itself: an adrift low satellite has `skLife` 0 and counts by its decay. A route still
counts one as gone `ROUTE_LEAD` (30) days before its end.

**Measured** (`econ-26`): a dry Beeper at 300 km decays in ~4,800 days and counts; dry at 106 km (0 days) and dry at
3,000 km (tides 0.03 m/s a day, can't hold) don't.

**Not yet:** the Fleet line doesn't say which of these a route's satellite is counted by (Q296's Fleet line is being
reworked by the other economy session; a one-clause follow-up there).

Tests: `econ-26` (1 check).

## Q386 measured: launch scrubs under the cloud belts (2026-10-13, economy session 2; no code change)

v1.176 (Q323) gave `cloudAt` latitude belts (the shader's `belt` term). Scrubs (cover > `SCRUB_CLOUD` 0.9, a day's slip
each, up to `SCRUB_MAX` 5) only cost days, and `career.mjs` doesn't fly through `weatherHold`, so a career re-run can't
see them; measured directly instead: 72 longitudes × 400 days per latitude, with the belts and with `belt` set to 0.

| lat | days that scrub, belts / none | slip days per launch, belts / none | worst site |
|---|---|---|---|
| 0° | 8.2 % / 4.9 % | 0.091 / 0.052 | 0.14 |
| 5° | 5.9 / 4.7 | 0.065 / 0.051 | 0.12 |
| 15° | 1.5 / 4.5 | 0.015 / 0.048 | 0.04 |
| 28° | 1.4 / 4.3 | 0.014 / 0.045 | 0.04 |
| 45° | 5.3 / 4.8 | 0.057 / 0.051 | 0.10 |
| 62° | 7.2 / 5.1 | 0.080 / 0.055 | 0.13 |

**Kept** (Q386's default): Earth's pattern (the wet equator, clear subtropics, stormy subpolar belts), and the cost is
small everywhere: at worst ~0.14 days per launch, a few days a year for a busy program. No site scrubs out of its share,
so nothing retuned. If scrubs should ever matter (a pressure that favours subtropical sites), the lever is
`SCRUB_CLOUD`, not the belts.

## v1.211 — recovering a spent stage (2026-10-13, economy session 2, QUEUE Q332, from Q300 v1.142)

v1.142 (world) let a stage with chutes among its parts come down slowly and float for ~24 h, but nothing could fetch it,
and once it was 40 km from your craft it was culled and forgotten. Now:

- **Its fate is judged at the drop** (`dropRecord(d)`, `sim/flight.js`, called from `HOOK.debris` in `app/state.js`
  instead of building the record inline): for a stage with chutes whose predicted impact is at sea, the sea-level
  sink rate under its canopies (√(2 m g / (ρ₀ · 600 m² · n))) against the sea's limit; past it, it breaks up; under it,
  its hull as `debAfloat` judges it (`debSea`, factored out of `debAfloat`: the holed parts, the rest pose, `sinkTime`),
  hanging nose up. The record carries `sea: {fate: 'afloat'|'sank'|'broke', sp, afloat}`. If the stage does come down
  in view, `debAfloat` overwrites the record with what happened.
- **The ships fetch it** (`stageRecover(R)`, `sim/program.js`, in `missionEnd` before `fleetSalvage`): the same ships
  as `recoveryOf` (local boats to 200 km, the recovery fleet's range when built, 10 m/s from an hour's notice). Still
  afloat when they arrive: refurbished like a vessel, `partPrice × REFURB × wearOf(p, splash speed)` per part, less 2M
  of ship time; news line, ledger `stages` ("Spent stages recovered" in the Debrief). Beyond reach or sunk first: a news
  line, and the recovery fleet (if built) still salvages it for parts as before. A bare stage is unchanged (the fleet's).

**Measured** (`econ-27`): the Orbiter's empty first stage under one chute: predicted 8.2 m/s and 24.0 h afloat at the
drop; flown down in view 8.1 m/s and 24.0 h. Fetched from the launch point's sea: +8.9M (its parts at 65 % × 0.8 wear,
less ship time).

**Not yet:** the impact point is still the ballistic prediction (`debrisImpact` ignores the canopies; drift under
them is a few km at most); the builder doesn't say that chutes on a stage make it recoverable (vehicle/flow); the
Debrief shows the money, not which stage came back.

Tests: `econ-27` (1 check: judged afloat at the drop and the same in view; local ships fetch and refurbish; beyond
reach lost; a bare stage left to the fleet).

## v1.213 — overflight rights (2026-10-13, economy session 2, QUEUE Q380; W23)

v1.171 (Q181) charged opinion and relation for flying low over a neighbour that minds (`overK`: none from an ally,
up to the whole from a hostile power, ×2 for a security state). W23 asked for the way out from the start: buying
consent, which rivals may refuse.

- **`overQuote(i)`** (`sim/program.js`, beside `overEnd`): `{ok, why, fee, have}`. Not needed when `overK(i)` is 0;
  refused under sanctions either way, at relation ≤ `OVER_NO` (−0.5), and by a **rival in the race** (`PROG.riv[i]`)
  at any relation below 0. Fee `OVER_FEE·(1 + 3c)` M for a year: 2M at relation 0, 4M at −1, 7M from a hostile
  security state (a launch's lease is 6M; the protest it saves is opinion −1 to −6 per flight).
- **`buyOver(i)`**: pays (ledger `over`, "Overflight rights" in the Debrief), `PROG.overR[i]` = a year from today,
  a news line. **`overEnd`** skips a power with consent (`R.overK[i] = −1`); the Debrief says "with its consent".
- **The site picker** (`renderSites`, `app/editor.js`): under the downrange line, for each foreign power under the
  planned downrange, a *A year's consent · fee* button, or why not (refused, sanctions, consent until day N). Flow:
  one block, restyle freely, or move it to a decision card.

**Not yet:** consent is offered only for the powers under the site's planned downrange (the cost is judged on the
track flown); a renewal reminder; the rival's refusal as a news beat. Not checked in the browser (the game lock was
held); TESTING row.

Tests: `econ-28` (1 check: an ally needs none; 2M at relation 0, on the ledger, free overflight for a year then the
cost again; refused at −0.6, by a rival at −0.2 but not a non-rival, under sanctions).

## Plan: the simulator replaces revert (2026-10-13, economy session 2, QUEUE Q282; D15.5, D17.2; nothing built)

**The decisions:** D15.5: fly any mission in a simulator, free of money and news, revert at will; real flights can't
be reverted. D17.2: the simulator flies the program's **believed** numbers and error bars, never the true ratings, and
costs **time, not money**. CREW § Skill: simulator time is what trains crew qualifications (M3).

**What exists to build on:**
- **The discard path** (Q257, v1.123): at liftoff `missionTick` snapshots the program (`REVERT0 = {R, prog}`) and
  `missionDiscard(s)` restores it whole: no registry entry, no pay, no log. `revertFlight` (`app/state.js`, the R key
  after a crash or landing, and the button) is that plus `resetShip`. A flight from orbit snapshots the same way
  (`app/program-ui.js`).
- **Belief versus truth** in the sim today: joints are judged by the builder against the **certified** rating
  (`certOf`, 70 % of the true one rising to it with telemetry) while the physics uses the true one; each 10 km band
  of air carries ±25 % density uncertainty until sampled (shown as the landing spread; the physics flies the true air);
  ignition failures roll on know-how (`igniteOK`, `khUse`); Δv needs are the program's guess (D23, `predErr`).
- Liftoff charges hardware, operations and the lease, waits prep and pad days and the weather, and from then on news,
  know-how, certification, records, contracts, the registry and procedures all write into `PROG`.

**The shape: a believed world inside a discarded flight.** A simulator run is a normal flight with `R.sim` set:
1. **Start** (*Simulate* beside *Launch*): snapshot `PROG` (`REVERT0`, as now), mute `HOOK.news` and `HOOK.save`
   (collected into the run's log; a crash mid-run reloads the save from before it). No hardware, ops, lease, prep,
   pad wait or weather hold: the liftoff block skips its charges and waits when `R.sim`.
2. **The believed world**, drawn once per run from a seed (each run differs, none is the truth):
   - each part's strength: true × (cert + (1 − cert)·u), u uniform in [0, 1]: inside the engineers' reserve, never
     above the truth, equal to it only for a fully certified part;
   - each unsampled 10 km band's density × (1 + 0.25·(2u − 1)); sampled bands as flown;
   - ignitions roll as now (the know-how rate is already what the program believes), on the run's seed.
   The physics reads these through one indirection (`simK(p)` on the joint check, `simAir(h)` on `density`), 1 outside
   the simulator, so real flights and tapes are untouched.
3. **Revert at will** inside a run: back to the pad with a fresh draw (or the same draw: an option on the HUD).
4. **End** (the run ends, the player leaves, or reverts): `missionDiscard` restores `PROG` whole; then apply the only
   two things a run keeps: **time** (`advanceDays`, below) and **simulator hours** per design (`PROG.simH[procKey]`,
   for CREW's qualifications in M3 and for a "flown in the simulator" mark on the design). A short **simulator
   debrief**: how far it got, margins (Δv left, peak load as a share of the believed rating, landing speed), what broke
   and why, and the line "these are the program's believed numbers".
5. **Real flights can't be reverted**: the R key and the button go (the tester keeps them, `TEST`). Before liftoff
   nothing is charged, so leaving the pad stays free. *End flight* and recovery are unchanged.

**Time, not money (default):** a run costs one calendar day per hour of simulated flight, at least half a day per
start from the pad (a revert starts a new run). An ascent to orbit is about half a day; a week-long Selene mission
flown through in warp is not a week of sim hours, because warped time isn't simulator time (only time at 1×–4×
counts). Deadlines and dispatches keep running, so practice competes with flying.

**Why it's not a free pass (pillar 7 kept):** the sim is pessimistic where the engineers are (strength) and uncertain
where the air is, and failures still roll; a design that flies clean in five runs is likely, not certain, to fly. The
true margin only shows in a real flight, and a real loss stays.

**Slices:**
1. **The core** (economy + space, ⚙): `R.sim`, the skipped charges, muted news and save, the believed draws behind
   `simK`/`simAir`, `simEnd` (discard + time + `simH`). Test: a run leaves `PROG` byte-identical except `day` and
   `simH`; a joint loaded between its believed and true ratings breaks in the sim and not in a real flight; no money.
2. **The screen** (flow, 🖥): *Simulate* beside *Launch* (and in Rollout), a SIMULATOR banner on the HUD, revert on R
   inside it, the simulator debrief, *Leave the simulator*.
3. **Revert retired** from real flights (flow + QA): the key and button gone outside the tester; PLAYROUTE, TESTING 96
   and 127, and the robot (`playtest.mjs`) paths that revert updated.
4. **Simulate a leg** (space + flow): start in orbit beside a ghost copy of a registry object (rendezvous, docking,
   landing practice), from `R.fromOrbit`'s path.
5. **Qualifications** (M3, with Q283): `simH` per vessel type and per skill (rendezvous, docking, landing) become the
   crew's badges.

**Questions for Caio (W42; defaults if silent):** (1) the time cost: a day per simulated hour, half a day at least per
run (**default**), or a flat day per run; (2) each run draws its own believed world (**default**), or always the
pessimistic edge (the certified rating, the densest air); (3) ignition failures in the sim at the believed rate
(**default**), or a "no failures" practice switch; (4) revert gone from real flights entirely (**default**, D15.5), or
kept for the first N flights of a new program as a tutorial crutch; (5) the simulator the same in every era (**default**),
or cheaper in time with compute (from the mainframes on). The error bars stay knowledge, never compute.
