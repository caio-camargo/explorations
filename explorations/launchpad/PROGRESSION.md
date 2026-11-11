# PROGRESSION — the loop, unlocks, contact and the tables
**Version**: 0.1.0 · **Author**: Caio Camargo + Claude (review 2 session, Fable 5.2) · **Created**: 2026-11-11 · **Updated**: 2026-11-11
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

Each step has a place (§ 5) and each grant has a ceremony (§ 3). "It grants" is one of four things: a part, a room or
building, a reach (where you can command, how far you can go), or a routine (something that now runs itself).

## 3. Unlocks (Caio: "this game needs more gamification")

**The rule.** A part opens with the mission that first proves the thing it is for. It arrives **unproven**: know-how
and certification stay exactly as they are, so the test stand and the first flights of a new part have a job. Unlock,
then prove. No new mechanism: `PART_GATE` grows, `partOpen` and `partLaunchWhy` already refuse a launch, the builder
already lists a closed part dimmed with its reason (Q190).

**The overlay** (Caio: "very visible: you end the mission, they appear as an overlay, *Part unlocked!*, with a picture
of the part"). After the flight report, one card per grant, in order of weight:
- the part as a turning scale model in the design table's style, its name, one line on what it makes possible, and a
  button that goes to the design table with it in hand;
- the same card for a building or a room ("Mission control opens"), a reach ("Contact over the eastern ocean") and a
  routine;
- several grants queue; any key moves on; the list stays in the report's **Opened** block (Q570's `opensOf`).

**Chapters.** An epoch becomes a chapter with a question, a visible finish and a grant. First draft, for the economy
plan (Q573) to measure against the M1 finish line (first orbit in 4–6 flights) and the presets:

| Chapter | The question | Starts with | Opens along the way | Capstone → grant |
|---|---|---|---|---|
| 1 Sounding rockets | can we reach space and bring it back? | Sparrow, tanks 1–4 t, fins, nose cone, parachute, instrument package, decoupler | biocapsule (*Above the weather*) | *Structural test flight* → **Kestrel, tank 8 t, steerable fins** |
| 2 Once around | can we stay up? | | Petrel and the reaction wheel (*Passenger: the hop*); pod and heat shield | *The beeper* → **mission control opens; the satellite bench** (probe cores, batteries, body cells, cameras, whip antenna, fairing); **the globe table** |
| 3 Satellites that work | can what we launch earn its place? | | solar wing, boom antenna, apogee engine, kick motors, spheres (*Weather satellite*); **Condor** (*Heavy lift I*) | *TV for the capital* or *Navigation constellation* → **routines** (dispatch of a flown ascent); **docking ports, RCS** |
| 4a A house in the sky | can people live up there? | | habitat; crew capsule and escape tower (the abort tests); arm and cargo bay; laboratory | *Thirty days aboard* → **the yard** (assembly in orbit, LATE_GAME § Yards) |
| 4b Selene | can we reach another world? | **Albatross and the 2.5 m family** (*Heavy lift II*) | landing legs, Wren (*The far side*); rover parts as today (`RV_GATE`) | *Soft landing* → **the base beacon**; with 4a, *Crew on Selene* → **bases** |
| 5 Nyx and beyond | | | RTG, onboard computer (their eras, as today) | as LATE_GAME § "The arc after Selene" |

Chapters 4a and 4b run side by side; a base needs both. The two Heavy lift missions, which today only pay, become the
gates for the big engines.

**Chapters as events.** The Missions tab shows the current chapter's finish and its grant. A capstone gets the poster
headline (Q479) before its unlock cards. The desk wall (it already holds the firsts, `app/desk.js:41`) is the trophy
case.

## 4. Contact limits uncrewed flight (Caio: "makes sense, fully")

**The rule.** An uncrewed vessel answers the stick only while it has a link home: a ground station in view or a relay
(`linkOf`, `entryRelay`). A crewed vessel always answers: the pilot is the computer (CREW.md).

**Out of contact**, by the avionics it launched with (`AV`, `sim/vessel.js:665`):

| Avionics | What it does alone |
|---|---|
| Gyro autopilot (era 0) | holds its attitude; flies **one stored command**, set while in contact: a burn at a held attitude for a set time, or a staging on a timer (a clock, as the launch rail's sequencer in MIDGAME) |
| Analog autopilot (era 1) | the same, in any of its hold modes, and a short list of stored commands |
| Guidance computer (era 2 on) | every planned burn, guided (`blind: 'board'` in `sim/procedures.js`) |

- **Nothing is lost** (pillar 5): the vessel coasts, warp works, and one key warps to the next contact.
- **What it makes worth building:** ground stations (already buildable, `buildStation`), relay satellites, a crew, an
  onboard computer. Each changes what you can do at the stick.
- **The first hour is the risk.** The beeper's circularising burn may fall beyond the pad station's horizon. The plan
  (Q574) measures that first. If it does, the first orbit becomes "store the burn before you lose contact", taught by
  the Mission card, and the level decides how hard it bites (default: Easy never limits; Normal and Hard do).
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
   player's funds, so Caio can play the middle of the game now.
2. **The unlock overlay** (Q572) on today's 13 gated parts.
3. **Plans**: the unlock map and chapters (Q573), contact limits (Q574). **Mock-up**: the tables (Q575).
4. Builds, after Caio's answers and W48's freeze: the map's data and presets, chapters as events (Q576), contact
   limits, then the tables one at a time (site model first).

## 7. Open questions (each with a default; the named item brings it back)

| # | Question | Default | Item |
|---|---|---|---|
| 1 | Does an engine unlock outright, or as a development program (opens *on paper*, qualified after stand firings)? | outright, arriving unproven | Q573 |
| 2 | Is first orbit still 4–6 flights with chapter 1's gate in front of the Kestrel? | yes: hold the finish line, move the gate if not | Q573 |
| 3 | Does contact limit the first orbit on Normal? | yes if a stored burn can be taught in the Mission card; else from chapter 3 | Q574 |
| 4 | Does a design saved with a part that is no longer open (an old save) still fly? | yes: parts already flown stay open | Q573 |
| 5 | The globe: a textured sphere from the era map, or the real planet shader in a small viewport? | the textured sphere | Q575 |

---

## Version history
- **0.1.0 (2026-11-11):** written from Caio's review of the loop (the same day's conversation): visible unlocks with
  an overlay, contact limits on uncrewed flight, chapters with capstones, the office as three tables; W35's "no 3D
  behind the rooms" superseded (D28).
