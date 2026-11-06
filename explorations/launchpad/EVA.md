# EVA — astronauts outside
**Version**: 0.1.1 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-11-06 · **Updated**: 2026-11-06
**Status**: approved 2026-11-06 (D27: W45's defaults, and a test ground first, as E0).
**Purpose**: Scope EVA, which has not been designed or built: what crew do outside, how they move, and in what order to build it.
Parent: [`CREW.md`](CREW.md) (who crew are, the roles, the suits). Decisions go to [`DECISIONS.md`](DECISIONS.md).

**What exists** (cite, don't redo):
- **No EVA anywhere in the code.** Crew are seats in a capsule (`d.crew`). A landing counts as a body walked on
  (`rec.walked`), but nobody steps out.
- **Spacewalk suits are designed for every school but not drawn** (CREW § suits, D9, D13; Q229 left them "for EVA").
- **Rovers are physical and driven by hand** (`sim/rovers.js`): one rigid body on the ground, wheel springs, grip from
  the ground's friction, tipping. `]` switches from the lander to a rover and `[` switches back. A rover can carry a crew
  seat (`RV_IT.seat`, 185 kg).
- **The roles already assume EVA.** The scientist sets up a seismic station "in one EVA" (CREW § roles), the record
  counts "a first EVA" as seniority, and Q467 (repairing damage, M3, blocked) names "a crew EVA" as one way to repair.
- CREW § look says crew "never" get a long walk cycle. EVA overturns that rule, so the rule moves here: walking is
  procedural, not animated by hand (§ 4).

---

## 1. What EVA is for

Each use below comes from a real one. The movement design only has to serve these.

| Where | What crew do | Real precedent | What it hooks into |
|---|---|---|---|
| Orbit | **The first spacewalk**: out of the hatch, a few minutes on a tether | Leonov 1965 (12 min; his suit ballooned and he had to vent it to get back in) | a world first in the race (rivals' dates, #124) |
| Orbit | **Hull work**: reach a part and repair it, or fetch a film canister | Skylab 2 freed the jammed solar wing (1973); Worden fetched film cassettes on the way home from the Moon (1971) | Q467 repair; film-return science |
| Orbit | **Crossing between two vessels** | Soyuz 4/5 (1969), crew crossed outside | crew rotation (M3), docking (Q213) |
| Surface | **First steps and a flag** | Apollo 11 | the landing milestone, seen rather than counted |
| Surface | **Work at a spot**: take samples, set up a station, take a panorama | the Apollo science packages; Schmitt's geology | the scientist role, R4 instruments |
| Surface | **Walking to a rover and driving it** | Apollo 15–17 | rovers (`]`), the crew seat |
| Late | **Flying free** with a jet pack | MMU 1984, SAFER | servicing satellites, building in orbit (LATE_GAME) |

## 2. The question: how astronauts move

There are three ways to approach it:

| | **A. Abstract** | **B. Direct control** (KSP) | **C. One body, two inputs** (recommended) |
|---|---|---|---|
| What the player does | picks "EVA: repair the tank"; a timer runs; the figure is posed at the hatch | WASD walking, a jetpack, climbing ladders | clicks where to go or what to work on, **or** takes the keys, as with a rover |
| What moves the astronaut | nothing; the result is rolled | a hand-tuned character controller | **the same physics as everything else**: a small body with contact, gravity and push-off |
| Fun | weak: the first steps are not seen | high, but it's a toy beside the management game | the moments are seen, and long walks run under time warp |
| Cost | S | L–XL: a character controller, animation, collision with any vessel's shape | M per slice; the inputs are cheap once the body exists |
| Fits the game | management yes, emergent physics no | a KSP-ism (KSPISMS.md would call it "kept") | both, as Caio likes |

**The key point: the expensive part is the body, not the controls.** Once an astronaut is a physical body that takes a
*wanted motion* (a heading and a speed, or a point to reach), clicking a target and pressing keys only feed it
differently. So the control question is a matter of taste (W45 1), and the build doesn't depend on the answer.

## 3. The physics (emergent, as rovers are)

**On the ground: a body that pushes off.** Treat the astronaut as one rigid body, like a rover with a single contact.
Each stride pushes off the ground with a capped force, and between pushes the body is ballistic. The gait is not chosen
by hand. It follows from the gravity:
- People change from walking to running at a **Froude number** v²/(g·L) ≈ 0.5, with L the leg length (Kram et al.
  1997 measured this in reduced gravity). With L ≈ 0.9 m, that is about 2.1 m/s on Tellus and about **0.85 m/s at the
  Moon's 1.6 m/s²**. Above that speed, crew lope and skip, as the Apollo crews did.
- **On a small body the same push becomes a long float.** A step that is a hop on Selene lasts minutes on an asteroid,
  and a hard push can exceed escape velocity. Nobody has to write that rule.
- **Falls:** the backpack raises the centre of mass, so a fast turn, a slope or a rock can tip the astronaut over, as
  happened on Apollo 16. Getting up takes time, or a crewmate's help. A fall that tears the suit ends the EVA (§ 5).
- The ground is the rovers' ground (`rvGroundR`, `rvSurface`, `rvRock`), so it needs no new terrain code.

**On the hull: along handholds, not free physics.** Real spacewalkers move hand over hand along rails. The astronaut
follows a path over the vessel's parts at a rate that depends on the era. The physics only applies when they let go:
- **A tether** is a spring with a length set by the era: Leonov's was about 5 m, Gemini's umbilical 7.6 m.
- **Drifting** follows the orbit relative to the vessel, so a dropped tool or a loose astronaut drifts as orbital
  mechanics says (Ed White's lost glove, 1965).
- **The vessel must hold still.** On a tumbling vessel the hull path is too fast to hold, so EVA needs SAS or a calm
  vessel. Repairing a tumbling wreck becomes a two-step job.

**Workload by era** (the history to mine): early EVAs exhausted crews because there was nothing to brace against
(Gemini 9's visor fogged; Cernan was spent). Gemini 12 solved it with handholds, foot restraints and underwater
training. In game terms, an early hull path is slow and tiring and burns consumables faster. Later handholds and foot
restraints (a tech item, or a part property) make it routine.

**Consumables:** a backpack's time (early ones about 4 h, the late Apollo ones about 7–8 h), shown as a ring. On the
surface this gives the **walkback rule** the Apollo planners used: a rover may drive only as far as the crew could walk
back if it broke down. The rule is shown on the map as a circle that shrinks as the backpack runs down, and it falls
out of the physics rather than needing a scripted limit.

## 4. The figure

- **Rigid pieces with procedural joints** (head, torso and pack, upper and lower arms and legs, boots): about 10 meshes
  from `crew-look.js`'s builder, posed by a few angles. Stride length and rate come from the body's speed and gravity,
  so a lope and a moonwalk come out of the same code. There are no hand-made animation clips.
- **The spacewalk and surface suits are already designed** (CREW § suits), and EVA is what finally draws them.
- **The head is the ligne-claire head** (D26), so the face reads at a distance through the visor. With a gold visor
  down, the suit's identity stripes do the job, as on real spacewalks.
- **The camera** follows the walker like the rover drive camera, and the same cycling works: `]` goes lander → rover
  → astronaut, and `[` goes back.

## 5. Risk (pillar 5: forgiving)

**Default:** falls, a stuck hatch or a torn glove cost time and the rest of the EVA. A crew member is lost only by the
player's own action, untethered beyond reach: free flight with too little Δv to get back, or a jump off a small body.
Neglect never kills anyone. This is W45 2.

Early-era events, all from history, each costing time:
- the suit balloons and won't fit back through the hatch (Leonov);
- the visor fogs and the crew member tires (Gemini 9);
- the hatch won't close (Gemini 4).

## 6. Slices

| # | Slice | What it contains | Size | Lane |
|---|---|---|---|---|
| **E1** | **Out of the hatch** | an EVA button on a crewed vessel in orbit with a hatch (`gl.js` already draws one); the spacewalk suit, tethered beside the hatch; a backpack or umbilical timer; the first spacewalk as a world first; the era events in § 5. No hull path yet. | S–M | space + look (parts & pad) |
| **E2** | **On the ground** | down the ladder (a short pose), the push-off body in § 3, click-to-go and keys, the flag, a sample or a package at a spot, boarding a rover seat, the walkback circle, falls | M–L | space (rovers are its code) + look |
| **E3** | **Hull work** | paths over the parts, the tether, drifting off, repair (Q467), fetching a canister, crossing to a vessel within tether reach | M | space + vehicle |
| **E4** | **Free flight** | a jet pack with a Δv budget, flown with the docking keys (MMU era) | M | space |

**Order:** **E0, the test ground** (§ 6a), before anything ships. Then E1, because it is the cheapest and gives the 1965 race moment. E2 comes next, because it is
M3's finish line (crew on Selene). E3 follows, and it unblocks Q467. E4 waits for the late eras.

## 6a. E0: the test ground (Caio, 2026-11-06)

Caio: "i've never worked with this. we need testing grounds for astronaut movement, which includes different gravity
conditions and room for things like climbing stairs and zero-g simulation. this doesn't have to be realistic in terms
of a simulator, i just need to be able to easily test astronaut movement."

So movement gets a test ground before any slice ships. It is a **developer's tool, not a training simulator**. It
needs to be quick to open, quick to reset, and to show why the astronaut did what it did.

**What it is:** a screen built from the real movement code (`sim/eva.js`, the same code the slices use), opened
straight from a URL flag (`?eva-lab`) and from the Rover yard's menu. It works the way the Rover yard does for rovers,
and later it can become the program's astronaut training ground.

**Gravity:**
- every body in the game, read from the body table, plus a slider from 0 to 1.5 g;
- **0 g**;
- a **spinning hull** (slow to fast) to test grabbing on a tumbling vessel.

The gravity can be switched mid-walk.

**The course**, stations in a row, each reached by a key:

| Station | What it tests |
|---|---|
| flat pad, a 50 m straight with distance marks | gait, speed, the walk-to-lope change, stopping, turning |
| slopes at 5°, 10°, 20°, 30°, up and down | push-off, sliding, falls downhill |
| rough ground: rocks, a crater rim, loose soil | stumbles, tipping, picking a path for click-to-go |
| **stairs** (risers of 15, 25 and 40 cm) and a **ladder** (a lander leg's) | stepping up, climbing, coming down in low g |
| a gap and a ledge (0.5, 1 and 2 m) | jumps; on small bodies, floating off |
| a lander mock with a hatch and porch, a rover with a seat | getting out, down and back in; boarding a rover |
| **a 0 g hall**: a capsule and a station module with handrails, a hatch, tether points, a second vessel a few metres away | hand over hand, the tether, drifting off, crossing, the jet pack later |

**The tools:**
- **time:** pause, ×0.25 slow motion, step one frame, reset to the station;
- **camera:** follow, side, top;
- **debug drawing** (on and off): contact points, centre of mass, push-off forces, the tip angle, footprints and a trail;
- **readout:** speed, Froude number, gait, contact, tether tension, backpack time;
- **a tweak panel:** push force, leg length, height of the centre of mass, turn rate, grip, with *Copy values* to paste
  them into a note;
- **record and replay:** saves the inputs, so a bad moment can be replayed and sent as a file.

**Feel over accuracy:** the constants are tuned until it feels right in play. § 3's physics is where the tuning
starts, not something to defend.

**A headless twin**, so sessions can tune without Caio: scripted runs on the same course at each gravity (walk 50 m,
climb the stairs and the ladder, cross the 0 g hall by rail, let go and drift), with times, falls and failures logged as
a test section and a `study_eva.mjs` table.

## 7. Decided (D27, Caio 2026-11-06: "yes on defaults")

1. **Controls:** (a) click a target **and** keys, as with rovers (**default**); (b) click only; (c) keys only.
2. **Can EVA lose a crew member?** Only by the player's own action, free and out of reach (**default**); never; or
   also by bad luck.
3. **Order:** E1 → E2 → E3 → E4 (**default**); or surface first (E2 before E1).

## Version history
- **0.1.1 (2026-11-06):** approved (D27): W45's defaults; E0 the test ground (§ 6a), at Caio's request.
- **0.1.0 (2026-11-06):** first draft (design desk, Caio: "EVA needs to be scoped; how can we approach astronaut
  movement?"). Approaches A/B/C, recommending C; physics; the figure; risk; slices E1–E4; W45.
