# PROGRESSION — the loop, unlocks, contact and the tables
**Version**: 0.1.7 · **Author**: Caio Camargo + Claude (review 2 session, Fable 5.2) · **Created**: 2026-11-11 · **Updated**: 2026-11-11
**Status**: **Direction approved by Caio 2026-11-11** (DECISIONS D28). The tables in § 2–§ 5 are a first draft: each
has a plan or mock-up item in QUEUE that measures it and brings the open questions (§ 7) back to Caio.
**Purpose**: How the game keeps moving forward between flights: what a finished mission gives you, what you have to
build before you can do the next thing, and where you stand when you are not flying. Written because the game reached
five epochs of content while the feeling of progress stayed a list of missions.

**Built on:** [`ROADMAP.md`](ROADMAP.md) pillars 1, 3, 4, 5, 8; [`MIDGAME.md`](MIDGAME.md) (the automation ladder);
[`LATE_GAME.md`](LATE_GAME.md) § Comms; [`UI.md`](UI.md) § 4.1 (the identity); the model desk (`app/model-desk.js`).

---

## 1. What was wrong (measured 2026-11-11, v1.302)

- **Epochs are a label.** They group the 29 missions on a tab. Nothing happens when one ends.
- **Almost nothing is locked.** 68 of 84 parts are open on day one, all 11 engines among them. `PART_GATE` holds 13
  parts; three more wait for a computing era.
- **One unlock, at flight four.** The beeper opens 5 missions, 8 contract types and 7 parts at once, the far side of
  Selene included. After it a mission opens the next rung and pays.
- **Money does not shape the opening.** `PACE=1 node career.mjs`: most starts reach orbit in 4 flights with funds
  never under 56 M of 80 M.
- **Infrastructure matters only to automation.** Contact gates dispatch, ground-commanded burns, rover driving and
  data return (`entryLink`, `rvContact`, `linkOf`). A vessel flown by hand is never limited, so a player who flies
  everything never needs a station or a relay.
- **Everything outside flight is a list on paper**, except the design table.

Q547, Q548, Q569 and Q570 (v1.304–v1.307) fixed the first half of the loop: the flight says what it is for, when it is
done and what it opened. This document is the second half.

## 2. The loop, in one line

**A need → a design → a test → the flight → it stays → it grants something you can see.**

**Any flight can fulfil any mission** (D29): missions and contracts are criteria on what a flight did, never an
assignment. Ticking a job in the Assembly aims the checks; it never decides what pays.

Each step has a place (§ 5) and each grant has a ceremony (§ 3). "It grants" is one of four things: a part, a room or
building, a reach (where you can command, how far you can go), or a routine (something that now runs itself).

## 3. Unlocks (Caio: "this game needs more gamification")

**The rule.** A part opens with the mission that first proves the thing it is for. It arrives **unproven**: know-how
and certification stay exactly as they are, so the test stand and the first flights of a new part have a job. Unlock,
then prove. The proving can be a **qualification mission** (W50, Q588): one per part family, each a different thing
to do, met by any flight that carries the part. No new mechanism: `PART_GATE` grows, `partOpen` and `partLaunchWhy` already refuse a launch, the builder
already lists a closed part dimmed with its reason (Q190).

**The overlay** (Caio: "very visible: you end the mission, they appear as an overlay, *Part unlocked!*, with a picture
of the part"). After the flight report, one card per grant, in order of weight:
- the part as a turning scale model in the design table's style, its name, one line on what it makes possible, and a
  button that goes to the design table with it in hand;
- the same card for a building or a room ("Mission control opens"), a reach ("Contact over the eastern ocean") and a
  routine;
- several grants queue; any key moves on; the list stays in the report's **Opened** block (Q570's `opensOf`).

**What the map closes** (DECISIONS D34): which parts exist. A closed part can't be bought abroad for now; know-how,
production lines and buying abroad keep how well and how cheaply an open part is made.

**Chapters.** An epoch becomes a chapter with a question, a visible finish and a grant. The map of which part opens
with which mission is planned and measured in [`notes/economy.md`](notes/economy.md) § "Plan: the unlock map and
chapters" (Q573); this is its summary.

| Chapter | The question | Opens along the way | Capstone → grant |
|---|---|---|---|
| 1 Sounding rockets | can we reach space and bring it back? | biocapsule, tank 4 t, steerable fins (*Above the weather*); boosters (*Range certification*); pod, heat shield (*the hop*) | *Structural test flight* → **the orbital kit**: Kestrel, Petrel, tank 8 t, reaction wheel |
| 2 Once around | can we stay up? | crew capsule, escape tower (*one orbit*); **Condor** (*Heavy lift I*); **Albatross and the 2.5 m family** (*Heavy lift II*) | *The beeper* → **mission control, the globe, the satellite bench** (20 parts, one card) |
| 3 Satellites that work | can what we launch earn its place? | solar wing, boom antenna, apogee engine, kick motors (*Weather satellite*) | *TV for the capital* → **docking**: ports, RCS, the habitat |
| 4a A house in the sky | can people live up there? | arm, cargo bay (*A station*); laboratory (*A crew aboard*); crews fly (the max-q abort) | *Thirty days aboard* → **the yard** (LATE_GAME § Yards) |
| 4b Selene | can we reach another world? | landing legs, Wren, rovers (*The far side*); base beacon (*Soft landing*) | *Crew on Selene* → **bases** |
| 5 Nyx | what else is out there? | RTG, onboard computer (their eras) | *An orbit that lasts* → LATE_GAME § "The arc after Selene" |

The start is twelve parts: a Sparrow, two tanks, fins, a nose cone, a parachute, an instrument package, a decoupler.
Chapters 4a and 4b run side by side, both after chapter 3 (stations after TV; the far side after the weather satellite
and Heavy lift II); a base needs both. First orbit now needs the structural test. **Measured:** the scripted player
already flew it, so first orbit stays at 4.2 flights on average (max 6).

**Chapters as events.** The Missions tab shows the current chapter's finish and its grant. A capstone gets the poster
headline (Q479) before its unlock cards. The desk wall (it already holds the firsts, `app/desk.js:41`) is the trophy
case.

## 4. Contact limits uncrewed flight (Caio: "makes sense, fully")

Planned and measured in [`notes/space.md`](notes/space.md) § "Plan: contact limits uncrewed flight" (Q574); this is
its summary.

**The rule.** An uncrewed vessel answers the stick only while mission control can reach it: a ground station in view,
the launch range, or a relay. A vessel with a crew aboard always answers: the pilot is the computer (CREW.md). The
biocapsule's passenger and the capsule's test dummies are not a crew.

**Out of contact the last command stands** (throttle, hold mode), and the vessel flies what was stored in it. The
stored command is **an armed node**, by the avionics the vessel launched with:

| Avionics | An armed node, out of contact | How many |
|---|---|---|
| Gyro autopilot | burns at the attitude it is holding, cuts off at the node's Δv, **then stages N times** (drop the stage, arm the chute) | one |
| Analog autopilot | the same, and may turn to one of its hold modes first | the next three |
| Guidance computer | points and flies every node | all |

**Measured** (flown headless, a new program's default site, the pad's station alone):
- Every first-orbit burn is out of the pad's sight: the Beeper's circularising burn falls 576–608 km downrange, 78 s
  after the horizon takes the link at 385 km. The player has 64–107 s after the ascent cutoff to store it.
- A stored, timed burn at a held attitude circularises as well as a guided one (108 × 109 km against 103 × 109 km).
- *Passenger: one orbit* needs a burn and two stagings with nobody listening: hence "then stage N".
- Six buildable ground stations give 23 % contact at 150 km over the equator (the pad alone: 12 %). Stations shorten
  the wait; they do not give control.

**So the rule comes with two things:**
- **A launch range** (W51, answered: yes): the pad plus a tracking ship 700 km downrange. Eastward launches then stay in
  contact through insertion, the first orbit plays as today, and the rule first bites on the passenger's return, the
  weather satellite's polar insertion and the TV transfer. Hard has no ship; Easy never limits.
- **Relays that reach.** Today a relay is one hop, whip to whip, about 300 km. The dish (Q338) and relay chains (Q217)
  are what make a comms constellation the answer to a gap; until then the answers are a stored command, a crew or an
  onboard computer.

**Also fixed by the plan:** plasma on the way up never refuses a command (the link word reads "plasma blackout" for
23–42 s around the ascent cutoff on all four flights); away from Tellus the question is honest (nothing is commanded
behind Selene, or without an antenna), where today's link assumes deep-space antennas always reach.

- **Nothing is lost** (pillar 5): the vessel coasts, warp works, and one key warps to the next contact.
- Light delay stays where it is (rovers) until M5's distances.

## 5. The office as three tables (supersedes W35's "no 3D behind the rooms")

**You plan with models; you fly the real thing.**

| Table | On it | From it |
|---|---|---|
| **The design table** | the rocket as a scale model (built, Q242) | the Assembly |
| **The site model** | an architect's model of the launch site: office, integration hall, test stand, computing centre, mission control, pads, the tracking dish, the harbour, the town | click a building to enter its room; a facility level changes its building; a new one is placed with its unlock card |
| **The globe and the orrery** | Tellus as a desk globe with miniatures (ground stations, the recovery fleet, bases); the moons and planets as an orrery with craft on their orbits | click a miniature: its **diorama** fills the table (an antenna array's dishes and hut; a station's modules as flown), its numbers on a typed card beside it; **Visit** puts the camera at the real place |

- **Coverage is drawn on the globe** as shaded caps, relays included; a gap in contact is bare globe (§ 4 made visible).
- **Lists stay as the index.** A row turns the globe to its object; a miniature highlights its row. The model is for
  seeing, the list for finding. Satellites in the dozens group into shells on the orrery, opened by a click.
- **By era** (pillar 8, UI § 4.1): wood, card and brass first; later a light table, then a screen wall.
- **Feasibility (read, not built):** the desk is a mesh of `box` / `lathe` / `rbox` primitives in the ship's frame
  (`deskMesh`), and parts draw through the ordinary part renderer. Buildings and dishes are more meshes of the same
  kind; picking them needs a small ray-against-box test, since the builder's picking is for parts. The globe is the
  unknown: the planet is ray-cast full screen (`SKY_FS`), not a mesh. The likely route is a lathe sphere textured from
  the era map's canvas (`drawEraMap`), which is already a pencil chart. The mock-up (Q575) settles it.

## 6. Order of work

1. **Chapter starts** (Q571): saves at *first orbit done*, *first station up*, *landed on Selene*, with a prudent
   player's funds, so Caio can play the middle of the game now. ✓ v1.309: the title's *Start at* line (`node chapters.mjs` remakes them).
2. **The unlock overlay** (Q572) on today's 13 gated parts.
3. **Plans**: the unlock map and chapters (Q573), contact limits (Q574). **Mock-up**: the tables (Q575).
4. Builds, after Caio's answers and W48's freeze: the map's data and presets, chapters as events (Q576), contact
   limits, then the tables one at a time (site model first).

## 7. Open questions (each with a default; the named item brings it back)

| # | Question | Default | Where |
|---|---|---|---|
| 6 | The globe: a textured sphere from the era map, or the real planet shader in a small viewport? | the textured sphere | Q575 |

**Answered by Caio (W50, 2026-11-11):** engines open outright and a qualification mission proves them (Q588); the
structural test's bar is 20 kPa; the map's order stands; the Petrel opens with the Kestrel. **W51:** contact limits the first orbit on Normal, with the tracking ship.

**Answered by the plans:** first orbit stays 4–6 flights with the gate (Q573, measured); a part already flown stays
open, so old saves keep what they have used (Q573, rule 1).


---

## Version history
- **0.1.0 (2026-11-11):** written from Caio's review of the loop (the same day's conversation): visible unlocks with
  an overlay, contact limits on uncrewed flight, chapters with capstones, the office as three tables; W35's "no 3D
  behind the rooms" superseded (D28).
- **0.1.1 (2026-11-11):** § 3's chapter table and § 7 from Q573's plan (measured): the hop in chapter 1, the Petrel with
  the Kestrel, the Heavy lift missions in chapter 2, stations after TV, Selene after Heavy lift II.
- **0.1.2 (2026-11-11):** § 4 from Q574's plan (measured): the stored command is an armed node with a staging tail, the
  launch range, plasma never refuses a command, relays need the dish to matter.
- **0.1.3 (2026-11-11):** D29 (any flight can fulfil any mission); W50 answered (qualification missions, Q588).
- **0.1.5 (2026-11-11):** W51 answered (the launch range).
- **0.1.7 (2026-11-11):** D34 in § 3: the map closes which parts exist; no import of a closed part for now.
