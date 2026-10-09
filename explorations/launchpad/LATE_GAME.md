# LATE_GAME — what a mature program is
**Version**: 1.2.0 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-08 · **Updated**: 2026-10-08
**Status**: **Approved by Caio 2026-10-08 as the base** (rounds 1–5). Details stay revisable at the margins; **the
numbers in round 4's sections are placeholders, open to playability and to simplification** (Caio).
**Purpose**: The shape of the game after Selene: where it goes, what the player does once the program is big, how far
the technology reaches, and what "settlement" means. It ties together pieces already designed elsewhere; it doesn't
redo them.

**Built on** (cite, don't redo): NOTES § "Rich programs" (the ladder of projects, waste heat, routine runs, pads as
the scarce resource, compute eras, consortia), § "Time, long missions" (missions in flight, passive flybys, paying
along the way), [`SYSTEM.md`](SYSTEM.md) (where you can go), [`POWERS.md`](POWERS.md) (rivals' personalities),
[`MIDGAME.md`](MIDGAME.md) (the bridge: how routines begin, the automation ladder, windows), [`TECH_SCOUTING.md`](TECH_SCOUTING.md), ROADMAP § Pillars (1 the boundary, 3 what you launch stays, 5 forgiving,
8 an era into the near future).

---

## Decisions (round 1, Caio, 2026-10-08)

1. **Open-ended, with capstones.** A handful of grand firsts mark the arc; the game carries on after each.
   **Like Factorio, you can always push further:** more, larger structures, a more complex network.
2. **Outposts grow toward self-sufficiency; no population simulation.** One legible number per outpost.
3. **The credible near future (~2080s), no further.** An **interstellar probe** is allowed only if near-future
   technology can plausibly build it, which means it takes centuries: **we never see it arrive.** It's a project to
   build, not a destination.

## Decisions (round 2, Caio, 2026-10-08)

1. **Four goods** (propellant, supplies, crew, hardware). *Round 4 split hardware: now five, below.*
2. **The network screen is the late game's main screen, but flight stays in play.** Long trips mean long gaps
   between manoeuvres, and **flights forgotten as time passes are a risk** to design against (§ "Keeping flight in
   play").
3. **Rivals build networks too,** coarsely: scripted growth, not simulated routines.
4. **Push harder on the interplanetary network** in the last stages (§ "The interplanetary network").
5. **Fusion isn't excluded.** Caio flagged the 2026 news (TECH_SCOUTING § Propulsion: Pulsar Fusion's *Sunbird*
   exhaust test, DIU's 2027 orbital prototype). Near-term fusion **propulsion** is in, at the plausible end (below).

## Decisions (round 4, Caio, 2026-10-08: logistics in detail)

Caio's picture: relay networks are crucial for communication across the system; a well-flown flight becomes the
template for a logistics run, so gains compound; asteroid and lunar mining give building materials already out of
the wells, hence orbital construction; habitats are sized by energy, heat and supplies, and life support is tied to
energy ("people can't survive on a dark station").
1. **Five goods:** hardware splits into **hardware** (manufactured, from Tellus) and **materials** (bulk, mined).
2. **Contact gates automation:** relays come before routes (§ "Comms").
3. **Habitats are sized by a per-person budget** of power, heat, shielding and volume, with food closure traded
   against energy (§ "Habitats").
4. **Licensing templates to other powers: later,** not now.
5. **Every number in these sections is a placeholder** for playability, and any mechanic may be simplified. **The
   shielding mechanic especially gets a look before it's deployed** (Caio).


## Decisions (round 5, Caio, 2026-10-09: money and pressure)

1. **Money buys scaling power:** capacity late, flights early; hardware is the money sink; capacity gets dearer.
2. **Debris: objects for big pieces, density bands for fragments**; tracking as a mechanic. Caio's concern (the
   compute to track it all) measured: § "Debris and Kessler".
3. **Debris may destroy an uncrewed satellite**; crewed nodes are always warned.
4. **A cascade can make a high band unusable for decades,** with warnings ahead.
5. **Solar storms, light.**
6. **Every pressure is a game option** (off / light / real per world), so a punishing one is tuned down or switched
   off without refactoring.
---

## The principle: you design the network by flying it

- **Every new route is flown by hand the first time.** That flight is a first or a hard problem (pillar 2).
- **Then it becomes a routine** that flies itself on a schedule (NOTES § "Routine runs": design + procedure + site +
  target; resolved from the measured result, with risk from know-how and wear).
- **The player lives at the edge** (pillar 1): the next first, a route nobody has flown, a bottleneck, a failure or
  an opportunity that needs a decision. Everything behind the edge runs itself.

This is the Factorio loop in spaceflight form. **Routes are the belts**: you don't place conveyors, you fly a route
once and it runs.

## The network

**Nodes** are things you've built: launch sites and pads, stations, **depots**, **outposts**, datacenters, the mass
driver, solar power stations. **Edges** are routines between them.

**Goods: few, so the network stays legible** (pillar 1, "a player can say why"):

| Good | Made by | Used by |
|---|---|---|
| **Propellant** | Tellus (launched), ice mines + plants (Selene's poles, Astraea, Enyo's caps, Eos) | every vehicle; depots store and sell it |
| **Supplies** (food, air, water, spares) | Tellus; outposts' greenhouses and recyclers | crewed stations and outposts |
| **Crew** | Tellus (training, the astronaut office: [`CREW.md`](CREW.md)) | stations, outposts, crewed firsts |
| **Hardware** (manufactured: engines, electronics, life support, panels, reactors) | **Tellus only**; very late, orbital factories | building and growing every node |
| **Materials** (bulk: structure, radiation shielding, tankage) | **Selene** (the mass driver) and **asteroids** (capture and mining) | yards, habitats, shielding |

**The ratio is the point** (round 4). A big structure is mostly materials by mass and a small share of hardware. So
mining doesn't replace Tellus: it **takes the bulk off the launches**. Tellus ships the precious few per cent that
are hard to make; space supplies the heavy rest, already out of the gravity wells.

Power, compute and data stay where NOTES puts them: power and compute are properties of a node (panels, reactors,
radiators, the waste-heat solve), and data flows over the link budget. **They aren't freight.**

**Chains, Factorio-style.** Each tier feeds the next, and each moves where the hard part is:
1. *Launched from Tellus:* everything comes up the well. Pads and launch windows are the limit.
2. *Refuelled in orbit:* depots fed from Tellus. Δv stops being per-rocket; depot throughput is the limit.
3. *Made on Selene:* ice → propellant → depots; regolith → the mass driver → structure in space. Leaving Selene takes about 1/20 the energy of leaving Tellus
   (escape speeds 1.06 vs 5.0 km/s). Outpost self-sufficiency is the limit.
4. *Made out there:* Astraea's water, Enyo's caps, a Hyperion moon's ice. Windows and transfer times are the limit:
   the network's tempo is the planets' synodic periods.
5. *Built in space:* structures too big to launch (solar power, solar-orbit stations, the interstellar probe's
   array). Waste heat and compute are the limits.

**The bottleneck must always be visible.** A network screen (a map of nodes and routes, tonnes per year on each
route) names the limiting thing: "Depot L1 is short of propellant: Selene's plant makes 40 t/y, routines draw 55."
This is the late game's main screen, beside the pad calendar (NOTES § "Routine runs": the Gantt view).

**Always further** (decision 1): records stay open-ended: tonnes per year, the largest structure, megawatts in orbit,
outposts, the most self-sufficient one, the deepest probe. They're headlines and rivals compete on them, but they
aren't points (pillar 3): each is something that exists in the world.

**No upkeep misery** (pillar 5, as NOTES already rules for projects): a node without its supply **pauses**. A depot
runs dry, a datacenter stops selling, an outpost goes dormant. Nothing is destroyed by neglect.

## Outposts (decision 2)

- **An outpost** is a surface or orbital node with crew, built module by module by flying them there (NOTES: "built by
  flying them there, piece by piece").
- **Self-sufficiency**: for each good the outpost consumes to *keep running* (supplies, propellant), the share it
  makes itself. Shown as one number, the lowest share, because that's what the resupply runs depend on. **Hardware is
  for growth, not upkeep:** a self-sufficient outpost sustains itself, but grows with hardware from Tellus.
  - A greenhouse or recycler raises supplies (at a cost in power: § "Habitats"); an ice plant raises propellant.
  - Each module you add cuts the routine runs it needs; at 100 % the outpost needs none.
- **An outpost can export** what it makes beyond its needs: propellant to a depot, materials to an orbital yard. Then
  it's a node in the chain, not a cost.
- **Cut off,** an outpost goes dormant: the crew evacuates on its return vehicle, or the outpost holds in a safe
  mode. No deaths from neglect. (Crew loss in a flight is still possible; that's a flight, not upkeep.)
- **No population:** no births, no growth curve, no politics inside it. Crew count = the berths you flew there.
- **Settlement as the arc's end:** a **self-sufficient outpost** is a capstone. Several, linked by trade, are as far as
  "settlement" goes.

## Comms: the network's nervous system (round 4)

Built or planned: the link and relays (rovers already compute contact and light-time delay, `rvContact`), Q51 (data
as a volume + the link budget), and the compute rule that a node out of contact can only do what its own computer can
(NOTES § Compute).
- **Contact gates automation.** A routine flies its burns only where it has contact, or where its onboard computer's
  tier can fly them alone. **The relay network decides how far logistics can reach**, so comms are built before the
  routes they serve.
- **Problems it poses** (pillar 2):
  - **Solar conjunction:** every ~2 years Enyo passes behind Helios and the direct link is cut; a relay at a Lagrange
    point or off the plane fixes it.
  - **Light delay:** about 0.5–2 minutes to Enyo and 4–5 to Hyperion in our scaled system. Remote driving gets
    awkward and onboard autonomy pays.
  - **Bandwidth:** dish arrays at home and the relays' link budget set how much science and data come back.
- **Relays are nodes** on the network screen, with coverage drawn; a route through a gap is flagged.

## Templates: gains compound (round 4)

Half of it exists: a procedure is **kept only if a new flight beats the stored one** (less Δv), and every automated
flight then uses the better one (NOTES § Procedures).
- **A template is a route flown well.** A better hand-flown flight replaces it: less Δv means more payload on the same
  rocket, **on every run after**. The network screen shows it: "this route delivers 14 t a launch, up from 9."
- **Gravity-assist templates follow their alignment.** A Hesper-assist route to Enyo is valid only when the planets
  line up again; the routine knows its window family and runs when one comes round. A brilliant one-off flight can
  open a route that runs every few years.
- **Later:** licensing a template to another power (selling know-how). Not now (decision 4).

## Yards: orbital construction (round 4)

A **yard** is a node that turns **materials + hardware** into structures too big to launch: habitats, depots, solar
power stations, the interstellar probe's array. Yards sit where materials arrive cheaply: Selene orbit, the
Tellus–Selene Lagrange points, near a captured asteroid. Building takes materials, hardware, power and crew time
(engineers, [`CREW.md`](CREW.md)).

## Habitats: sized by physics; life support is energy (round 4)

**Placeholders, open to playability and simplification** (decision 5). The waste-heat model (NOTES § "Waste heat")
anchors them:

| A person needs | Placeholder | Why it matters |
|---|---|---|
| **Power** | ~3 kW with food shipped in; **~25 kW growing their own** (greenhouse lighting) | **self-sufficiency costs energy**: every share of food not shipped needs power |
| **Radiators** | all power becomes heat: ~1.2 m² per kW at 300 K | ten self-fed crew need ~300 m² |
| **Panels** | ~300 W/m² at Tellus, ~130 at Enyo, ~40 at the belt, ~11 at Hyperion | **solar fails past the belt**: outer outposts need fission reactors, a technology step (pillar 8) |
| **Shielding** | beyond Tellus's field, ~5 t of regolith per m² of hull | **where materials matter**: a 1,000 m² hull needs ~5,000 t, impossible to launch, easy to scoop on Selene. **To be reviewed before it's deployed** (Caio); a simpler form, e.g. a shielding class per hull, may do. |
| **Volume** | ~25–50 m³ for a long stay | sets the structure's size |

**A dark station can't keep people** (Caio):
- power out means life support out: the crew has hours on batteries;
- so **every crewed node keeps return berths for all its crew** (the ISS's Soyuz rule), checked in the builder;
- a dark node evacuates and goes dormant (pillar 5: no deaths from neglect; a design constraint, not a punishment).

The builder computes the steady state ("12 people, 340 kW, 410 m² of radiators, 4,800 t of shielding"). Bigger
means more power, more materials, more yards: the Factorio climb, with physics as the recipe book.

## The technology ceiling (decision 3)

**In:** fully reusable heavy launchers, propellant depots, ISRU (water → hydrolox, CO₂ → methalox on Enyo),
nuclear-thermal and nuclear-electric propulsion (bounded by radiators: NOTES § "Waste heat"), solar sails, the Selene
mass driver, space solar power, orbital datacenters, aerobraking and aerocapture, deep-space dish arrays.

**Fusion propulsion, the plausible kind (Caio, round 2):** a late-era engine with very high Isp and **modest thrust**,
heavy with shielding, power plant and radiators (TECH_SCOUTING § Propulsion: *Sunbird*, DIU). It shortens the long
trips (PLAYTEST #12, #14) without making them trivial: thrust is low, so it needs the low-thrust propagation that
nuclear-electric needs too, and waste heat still limits it. It arrives late in the eras (pillar 8), probably first as
a military-funded first (TECH_SCOUTING § Patterns).

**Out:** fusion *torch* ships (high thrust and high Isp at once, the Expanse kind), antimatter, warp, artificial
gravity beyond spin, uploading, terraforming.

### The interstellar probe: a project, not a destination

The most ambitious thing a program can build. Its trip takes centuries, so the game never shows the arrival.
**The building is the game.**
- **Candidate designs** (all with near-future physics; the space and vehicle lanes measure which works in our
  system):
  - **a solar sail sundiver:** a dive close to Helios for an Oberth kick and sunlight pressure, then out. The design
    problem is heat at perihelion (pillar 2);
  - **a beamed sail:** a phased laser array, fed by your space solar power, pushes a light sail. The array is the
    megaproject; it needs the chain above at full scale (Starshot, scaled down to plausible);
  - **nuclear-electric:** slow and heavy, radiators the limit.
- **What the player gets:** the build as a staged project (a bill of modules, each flown), the launch as a capstone
  headline, then **reports for decades** while your dish arrays can still hear it. The last signal is a headline
  too. Its distance keeps counting in the records.
- **Not:** a target star system, an arrival, or anything after.

## The interplanetary network (round 2: push further)

The late game's real megastructure isn't one object; it's **the network between planets**. Each piece is real,
near-future practice, and each is a route flown once by hand, then routine.
- **Depots at every stop:** in low orbit at Enyo, at Selene, at a Hyperion moon. A ship carries only enough
  propellant for the next leg, so the rockets stay buildable.
- **Propellant made where you arrive.** Water ice → hydrolox on Selene, Astraea, Eos; CO₂ + water → methalox on Enyo
  (Sabatier). **A return trip with no Tellus propellant** is a capstone.
- **Cyclers.** A big ship on a periodic orbit that swings by Tellus and Enyo forever, never stopping; small taxis meet
  it at each pass, and the crew live aboard in transit. Tellus–Enyo is the real Earth–Mars ratio (1.52 TU), so
  Aldrin's cycler geometry carries over; the space lane measures it on our rails.
- **Tugs.** Reusable nuclear-electric (later fusion) tugs haul cargo slowly between depots while crew go fast. Cargo
  and crew split onto different routes: the classic logistics trade.
- **Relays.** Dish arrays and relays at Enyo and Hyperion are part of the network: a node out of contact can only do
  what its own computer can (NOTES § Compute).
- **Convoy seasons.** Windows set the tempo: at every Tellus–Enyo window (2.14 years) a fleet leaves together. The pad
  calendar fills up before each window; the network screen shows the next window's departures.
- **Trade between outposts.** Enyo's propellant sold to Astraea's miners; a Hyperion moon's ice station fuelling the
  probes that pass it. Nodes come to depend on each other, not only on Tellus.

**How far it grows** (always further, decision 1): from one depot to a network where **any node is reachable with
refuelling at every stop** (a capstone, "the highway"), then more cyclers, larger tugs, more outposts, more
throughput. Interplanetary tonnes per year is the headline record.

## Keeping flight in play (round 2)

Long trips mean long gaps between manoeuvres. Two risks: the player sits through dead time, or forgets a vessel while
time passes. NOTES § "Time, long missions" already covers part of it (one event timeline, time stops at anything that
needs you, passive flybys, paying along the way). This adds:
- **Flights in flight are always on screen.** A fleet strip on the network screen and the pad calendar: every vessel
  in flight, its next event and the time to it. Nothing coasts out of sight.
- **No silent misses.** A planned burn, closest approach or window **stops time**, as the timeline already rules. A
  vessel with nothing planned that is about to pass something worth a burn (an SOI entry, a periapsis at a body)
  stops it too, once. Missing it costs a wait (pillar 5), but it never slips by unannounced.
- **Dead time is someone else's busy time.** The program is concurrent (routines, the pad calendar), so a cruise's
  months fill with other flights: the next launch, a landing elsewhere, a convoy forming. The late-game cadence is
  **many vessels; advance to the next event; fly what it is.**
- **Every long trip has something to fly on the way:** course corrections (the era's prediction error, NOTES
  § Compute), flybys and assists, instruments that must point, aerobraking passes, a cycler rendezvous. A trip with
  nothing to fly is a routine, and then it shouldn't need you at all.
- **Hand it off, or fly it.** Any coast can go to mission control (already designed); any event can be flown by hand.
  The player chooses where attention goes.

## Money in a mature program: it buys scaling power (round 5)

**Early, money buys flights; late, money buys capacity** (Caio): pads, sites, yards, factories, production lines,
astronaut classes, dish arrays, compute. Flights build what capacity makes possible; pillar 3's "money alone is never
enough" holds.
- **Hardware is the late money sink.** Materials cost flights (mining); hardware costs money (Tellus). The five goods
  already split the two currencies.
- **Capacity gets dearer as you grow:** each new pad, site or yard costs more (land, permits, remoteness), so money
  stays the throttle on the growth rate, Factorio-style, instead of piling up.
- **Late revenue:** propellant sold at depots (rivals included), power beamed down, compute, leasing relays,
  orbital tourism, powers' contracts for big projects.
- **No daily overhead** (decided, v1.41): money never drains while you're away.

## Debris and Kessler (round 5)

**Measured cost** of propagating N objects on exact Kepler rails (Node, this machine, 2026-10-09; the same maths as the
rails): 1,000 → 0.3 ms · 10,000 → 3 ms · 30,000 (about the real tracked catalogue) → 10 ms · 100,000 → 33 ms ·
1,000,000 (real debris over 1 cm) → 317 ms per full update. Tens of thousands of objects are affordable once per
program-day tick, not per frame; a million aren't affordable as objects at all; all-pairs collision checks never are
(30,000² ≈ 9 × 10⁸). Caio's concern (the compute to track it all) is real at the top end, so:
- **Big pieces are objects:** spent stages, dead satellites, a broken-up tank. Hundreds to a few thousand, on rails,
  grabbable (Q26). Checked against **active vessels only** (about a hundred), never against each other.
- **Fragments are a density per altitude band** (the ESA MASTER approach): collision risk = density × cross-section ×
  relative speed. Cost is per band, whatever the cloud's size.
- **Drag cleans low bands** (decay, v1.64) within years; high bands keep junk for decades. That's the real Kessler
  asymmetry, and a real choice of where to put things.
- **The cascade:** collisions in a dense band make fragments; past a threshold the band feeds itself. **A high band
  can become unusable for decades**, with warnings well ahead of the threshold.
- **Tracking is a mechanic** (pillar 4): untracked debris is a statistical risk; radar + compute (by era) turn it into
  conjunction warnings you dodge with a small burn.
- **Debris may destroy an uncrewed satellite:** physics, not neglect, so a deliberate exception to "pauses, never
  dies". **Crewed nodes are always warned in time**; no surprise deaths.
- **What the player does:** leave a deorbit reserve on stages (design), fly cleanup missions (paid by worried powers),
  dodge tracked conjunctions, avoid crowded bands. A security state's anti-satellite test can foul a band overnight
  (POWERS.md).

## Events: pressure that makes decisions, not chores (round 5)

| Pressure | What it asks | Ties into |
|---|---|---|
| **Debris and Kessler** | above | decay, Q26, POWERS, compute |
| **Solar storms** (light) | a warning (earlier with a solar observatory) stops time: crew beyond Tellus's field shelter, satellites safe-mode, links black out | the habitat budget (shielding review first), pillar 4 |
| **Routine failures** | a lost cargo run: refly, reroute or accept the gap | know-how rolls, routines |
| **Opportunities** | a comet's window, a visitor, **a rival's crew in distress** (a rescue for diplomacy), a gravity-assist family opening | seeded objects, POWERS, CREW |
| **Politics** | sanctions cut a supplier, an election moves the budget, a consortium partner leaves mid-build, a rival claims a capstone | existing systems |

**Pacing:** events cluster at the edge; only those needing a decision stop time; a quiet network is fine.

**Every pressure is a game option** (Caio, round 5): debris and Kessler, solar storms, and later ones each have a
world setting (**off / light / real**, chosen at world creation). Each lives in its own code path behind its setting,
so it can be tuned down or switched off without refactoring. Default: light.

## The arc after Selene (epochs 6+; proposed, the economy session balances)

| Epoch | The edge moves to | Capstones (grand firsts; rivals race for them) |
|---|---|---|
| **6, the near planets** | probes to Hesper and Enyo; the first depot; a crewed station that stays | a lander on Hesper's surface; a rover on Enyo; **propellant made off Tellus** (Selene ice → a depot) |
| **7, the outer system and Selene's industry** | Astraea and Hyperion; a Selene outpost growing; the mass driver | **a self-sufficient outpost**; the first payload thrown by the mass driver; a probe in orbit at Hyperion |
| **8, the edge** | Erebus, the giant's moons, visitors; crewed Enyo; a depot at Enyo | **people on Enyo and home again**; a probe past Erebus; a sample from Eos's plumes; **an interstellar visitor intercepted** |
| **9, the interplanetary network** | cyclers, tugs, propellant made on Enyo and the moons, trade between outposts, convoy seasons; fusion tugs late | **a return trip with no Tellus propellant**; **the first cycler**; **the highway** (any node reachable, refuelling at every stop) |
| **10 and on, open** | megaprojects and the network's scale | **the first megawatt from space** sold on Tellus; **the interstellar probe launched**; then the records, open-ended (interplanetary tonnes per year first) |

Epochs stay what the program design made them: offers and missions open by era, not walls (pillar 8).

---

## What's new here and what it needs

| Piece | New system? | Pillars | Owner (proposed) |
|---|---|---|---|
| The network screen (nodes, routes, tonnes/y, the bottleneck named) | yes: a view over routines | 1, 3 | flow, with economy |
| Goods (five) on routines | extends routine runs | 1, 3 | economy |
| Contact gating automation; relays as nodes | extends the link (Q51) and compute | 1, 2, 4 | space + economy |
| Templates that compound; window families | extends procedures | 1, 3, 4 | space |
| Yards | content on staged projects | 1, 3 | economy + space |
| The habitat budget (power, heat, shielding, volume, return berths) | extends the steady-state thermal solve (Q34b) | 2, 5, 8 | vehicle (builder) + economy; **shielding reviewed first** |
| Outposts and self-sufficiency | **yes** | 1, 3, 5, 8 | space (modules) + economy (goods) |
| Exports from outposts | extends depots | 1, 3 | economy |
| Capstones and records | content on missions | 1, 8 | economy |
| The interstellar probe | content on staged projects | 1, 2, 8 | space + vehicle, studies first |
| Cyclers, tugs, convoy seasons | content on routines + heliocentric rails | 1, 2, 3 | space (a cycler study first) + economy |
| The fleet strip and "no silent misses" | extends the event timeline | 5 | flow + space |
| Fusion propulsion (plausible) | a part family; needs low-thrust propagation | 2, 8 | vehicle + space |

The order is set by what exists first: routines and the pad calendar (economy, NOTES § "Proposed order"), then
depots, then outposts. Nothing here is M1–M2 work; it's the target M4–M5 and beyond build toward.

---

## Decision (round 3, Caio, 2026-10-08)

Approved as the base.

---

## Version history
- **1.2.0 (2026-10-09):** round 5: money buys capacity (hardware the sink, capacity dearer as you grow); debris as
  objects + density bands (measured propagation cost), tracking as a mechanic, cascades; events that make decisions;
  every pressure a game option (off / light / real).
- **1.1.0 (2026-10-08):** round 4, logistics in detail: five goods (materials split from hardware; the ratio),
  comms gating automation, templates that compound, yards, the habitat budget and the dark-station rule. Numbers
  are placeholders; shielding reviewed before it's deployed.
- **1.0.0 (2026-10-08):** approved by Caio as the base.
- **0.2.0 (2026-10-08):** round 2: fusion propulsion at the plausible end; the interplanetary network (depots at
  every stop, ISRU, cyclers, tugs, relays, convoy seasons, trade, the highway); keeping flight in play; epoch 9 the
  network, 10+ open.
- **0.1.0 (2026-10-08):** first draft. Round-1 decisions; the principle; the network (nodes, four goods, chains, the
  visible bottleneck); outposts; the ceiling and the interstellar probe; epochs 6+ with capstones.
