# POWERS — national flavours as content
**Version**: 1.2.0 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-08 · **Updated**: 2026-10-10
**Status**: **Approved by Caio 2026-10-08** (rounds 1 and 2). Lanes may build from it. § "School briefs" for Arsenal, Coastal, Mountain and Isle approved 2026-10-10 (D14: defaults on 1 and 3; 2: tilted launches are a rail for every school, MIDGAME 1.1.0; 4, the mock-ups, Caio runs in his design session).
**Purpose**: Give every generated power a recognisable identity: how its names sound, its flag, how its hardware and
pads look, how its mission control and newspapers talk, and how it behaves as a rival. Content on top of systems that
already exist (ROADMAP § "Design catalogs"); no new system.

**What's already built** (cite, don't redo): powers are generated (`makePowers`, default 5; NOTES v1.14), with
archetypes as presets on behaviour axes: openness, money, priorities, nationalism (NOTES § "Power flavours", v1.24;
`ARCH` in `sim/program.js`). Industrial independence decides who makes each part (`sourceOf`: home, import ×1.5,
intermediaries ×3). Each power has a hue (`hue`). The backlog line this answers: "a handful of style presets plus
livery" (NOTES § "Backlog — visual flavours").

---

## Decisions (round 1, Caio, 2026-10-08)

1. **Look follows archetype loosely: affinities, not assignments.** An archetype leans towards some hardware schools,
   so design means something, but a world can surprise you. Colour varies even within one archetype.
2. **A part's shape follows its maker; the paint is always yours.** Closed powers tend to fly their own hardware;
   smaller ones fly a hodgepodge of whoever sold it to them. Rides `sourceOf` as it is.
3. **Evocative of real programs, never named after them.** Fans recognise the lineage; no real country appears.

---

## The hardware schools (kits): six national, one commercial

A **school** is a design lineage: the shapes parts take when this school builds them, the pad and buildings it
builds, its flag motifs and the sound of its names. Look only: **a school never changes a part's physics** (mass,
thrust, Isp stay as `PARTS` says; pillar 6).

**What a school may change on a part, and what it may not** (Caio asked, 2026-10-08). The aero model reads each part's
outline (its radii top and bottom, `r0`/`r1` in `aeroPass`), and collisions and the builder's attach points use its
size. So a school **keeps every part's size and outline exactly** and changes what sits on and inside it:
- **may change:** surface detail (ribs, stringers, lattice interstages, weld seams, rivets, hatches), materials and
  finish (white paint, grey-green enamel, bare metal, carbon), the base paint pattern, nozzle bell detail (colour,
  cooling tubes, gimbal hardware), fin edge styling within the same area, decals and the roundel, and the plume's
  look (Arsenal's orange cloud: the effects beat);
- **may not change:** a part's length, diameter, taper or fin area, its attach points, or anything in `PARTS`.

**The big silhouettes come from designs, not parts.** A Steppe rocket's cluster of conical strap-ons is a *design*
built from parts, not a part that looks different. Rival programs' rockets (their news pictures, a rival on a
neighbouring pad) are drawn from **school designs**: each school gets one or two signature stacks built from the
normal parts. **The player's presets stay the same in every school**, only styled by it, because the economy's pay
floor is measured against those presets (NOTES v1.53). A school-specific preset would need its prices re-measured.

| School | Echoes | Rocket shapes | Pad and buildings | Flag motifs | Names sound like |
|---|---|---|---|---|---|
| **Cape** | 1960s US | tall, slim, stacked stages; white with a black roll pattern; fairings with ribbed skirts | a tall fixed service tower with swing arms, a crawlerway, a blocky assembly hall | stripes, a field of small stars | short hard syllables: *Tor, Haven, Bruk* |
| **Steppe** | Soviet | conical clusters of strap-on boosters, grey-green, lattice interstages | **horizontal rollout on rails**, a flame trench over a pit, a launch table whose arms fall back | one large star or emblem on a plain field | long vowels and soft endings: *Velorya, Marisk* |
| **Arsenal** | missile-derived (early China, Israel, the DPRK) | squat, olive and bare metal, **hypergolic look** (a reddish-orange exhaust cloud at lift-off; look only), stubby fins | a cramped pad dug into a hillside, bunkers, camouflage | a bold emblem, chevrons, a disc | clipped syllables, doubled consonants: *Kattar, Dunn* |
| **Coastal** | Europe / French Guiana | rounded and tidy, white with a pastel band, big solid boosters | a jungle-coast pad, a **mobile gantry that rolls away**, smart low buildings | tricolour bands, a disc on bands | lilting, many vowels: *Alessa, Ourelle* |
| **Mountain** | Japan / India (solid-fuel lineage) | slender, many solid stages, launched off a rail at an angle in the early era | a pad cut into a ridge or a cove, a tidy rail launcher | a sun disc, rays, mountains | measured, open syllables: *Kanora, Isuma* |
| **Isle** | New Zealand / small commercial launchers | compact, black carbon, small electric-pump engines, lots of decals | a tiny pad on a remote peninsula, a hangar and a shed | a constellation, a southern cross | friendly two-syllable names: *Lyra, Pava* |
| **Foundry** (commercial, late) | SpaceX's Starship and Starbase; retrofuturist, the 1950s pulp rocket made real | huge, **one diameter top to bottom**, bare stainless steel with weld rings, a black tiled belly, **flaps** where others have fins (same area: look only) | a factory beside the pad, a tower whose arms **catch boosters**, tank farms | none: the company's logo | bold single words, a founder's sci-fi taste: *Ironworks, Starward* |

**Livery** (the paint, always the power's own): the school's base pattern, tinted with the power's `hue`: the roll
pattern's dark band, the stripe on a Coastal fairing, the decal colour on an Isle rocket. Each power also gets a
**roundel** (its flag simplified to a disc) for the side of the vehicle. Two Cape powers in one world look like
cousins in different colours, not like the same power.

**Mixed rockets.** Each part draws in its maker's school (decision 2), and the paint ties it together. A resource
state's first rocket might be a Steppe core with Cape upper stages, all in its gold and green. That *is* its story.


### School briefs: Arsenal, Coastal, Mountain, Isle (design desk, 2026-10-10; draft, D14)

Cape and Steppe were mocked up (Q89) and approved (W21); these four had only their row in the table above. Each brief
fills **the slots the build already has** (NOTES § "Hardware schools in the game": paint and finish and bells in
`MESH_FS`, the interstage cover in `partsMesh`, the roundel, signature designs, the pad), so a look session can build
from it directly. Same limits as all schools: outlines, sizes and `PARTS` never change.

**A school is recognised at a glance by four things**: the paint, the interstage, the bells and the pad. Each brief
makes all four its own:

| | Paint and finish | Interstage cover | Bells | Pad, in one line |
|---|---|---|---|---|
| Cape | gloss white, black roll pattern | closed black skirt, 24 ribs | bare metal | fixed tower, swing arms, gantry rolls away |
| Steppe | grey-green enamel, dark panel seams | open lattice of tubes | olive, cooling-tube ribs | horizontal rollout on rails, the tulip arms over a pit |
| **Arsenal** | olive and bare metal, matte, stencils | **vented skirt** (hot staging) | dark, heat-stained | a **truck erector** on a terrace cut into a hill |
| **Coastal** | satin white, one pastel band | **smooth white skirt, a pastel stripe** | silver, dark throat; black solid nozzles | **vertical rollout** to a bare pad ringed by four lightning masts |
| **Mountain** | white upper stages, **terracotta lower stage** | **a cone with separation bolts and small spin rockets** | solid nozzles with a dark flex boot | early a **tilting rail launcher**; later a shelter whose doors swing open |
| **Isle** | matte black carbon weave, decals everywhere | flush black carbon, no ribs | small, many, copper 3D-printed | a **strongback** on a tiny pad, a hangar and sheep |

#### Arsenal (missile-derived: early China, Israel, the DPRK)
- **Paint and finish:** matte, never gloss. Lower stages **olive drab**, upper stages **bare metal** (satin aluminium,
  panel to panel shade like Steppe's ±6 %). **White stencils**: a serial number on every tank, "NO STEP" arrows, lifting
  points. A **striped band** at each separation plane. *Livery hue:* the separation bands and the roundel's disc.
- **Interstage:** a **solid skirt with a ring of rectangular vent windows** (hot staging: the upper engine lights before
  separation and vents through them; look only). Darkened round the vents.
- **Bells:** dark, **heat-stained** (bronze to blue-purple toward the lip), thick reinforcing rings.
- **Fins:** stubby and thick, a bolted edge strip, stencilled.
- **Nose:** a blunt ogive with visible clamp bands.
- **Plume:** the reddish-orange hypergolic cloud at lift-off (already in the table; effects beat).
- **Signature designs:** (1) the **missile**: a squat two-stage stack, four stubby fins, no boosters; (2) a core with
  **four cylindrical liquid strap-ons with pointed ogive noses** (Long March 2E-like; Steppe's are cones).
- **Pad:** a **terrace cut into a hillside**, the hill rising behind; the flame chute a concrete channel running
  downhill out of the side (the ground can't be dug, as Steppe's pit). A **fixed lattice tower in camouflage paint**
  with **one hinged umbilical mast** that swings away at lift-off. The rocket arrives on a **road transporter-erector
  truck** (the missile heritage), which drives onto the apron, raises the rocket onto the table and drives off.
  Earth-covered bunkers with blast doors, a blockhouse with periscopes, a **camouflage net** over the assembly hall.

#### Coastal (Europe / French Guiana)
- **Paint and finish:** **satin white**, few panel lines, **one pastel band** round the upper stage and a thin
  pin-stripe at each stage joint; tidy agency lettering. Solid boosters white with their segment joints as rings.
  *Livery hue:* the pastel band (the hue at low saturation, high value) and the pin-stripes.
- **Interstage:** a **smooth closed white skirt** with the pastel stripe and a small row of round vent ports (Cape's
  is black and ribbed).
- **Bells:** liquid bells **silver with a dark throat ring**; solid motors' nozzles **black carbon** with a grey lip.
- **Fins:** thin, rounded edges.
- **Nose:** a rounded **bullet fairing** with its vertical split line showing and a big agency logo.
- **Plume:** the solid boosters' dense white column (effects beat, shared with Mountain's solids).
- **Signature designs:** (1) a core with **two big solid boosters** (Ariane 5-like); (2) the early **slim three-stage**
  (Diamant-like).
- **Pad:** the rocket is stacked upright in a tall assembly building and **rolls out standing up on a mobile launch
  table**, along twin rails, to a pad with **no tower: four tall lightning masts** round it and short umbilical masts.
  Beside it the giant **deluge water tower**, jungle to the treeline, the sea behind. Smart low white buildings, a glass
  control centre.

#### Mountain (Japan / India, the solid-fuel lineage)
- **Paint and finish:** **white upper stages**; the first stage and its boosters in warm **terracotta** (the colour of
  insulation and bare composite cases), a **saffron band** at every joint. Neat, sparse markings. *Livery hue:* the joint
  bands.
- **Interstage:** a **cone with a ring of separation bolts and four tiny spin rockets** (the early solids were spin
  stabilised; look only).
- **Bells:** solid nozzles with **a dark flex-joint boot** at the throat (a rubber bellows: how solids steer); liquid
  bells gold-tinted.
- **Fins:** early stacks carry big tail fins (same area), square-cut tips painted saffron.
- **Nose:** a slim, long pointed ogive.
- **Signature designs:** (1) the early **rail-launched four-stage solid** (Lambda / Mu-like): slim, finned; (2) a core
  with **six small strap-on solids** (PSLV-like; Steppe has four cones, Coastal two big ones).
- **Pad:** early: a **tilting rail launcher**, a boom on a turntable on a ridge above the sea (Uchinoura-like). Later:
  a pad in a cove, the rocket inside a **tower-shaped shelter whose two halves swing open like doors** before launch,
  plus a fixed umbilical tower. Terraced ground, a tidy assembly hall on the ridge.

#### Isle (New Zealand / small commercial launchers)
- **Paint and finish:** **matte black carbon**, the weave visible in raking light; **decals everywhere**: the rocket's
  own name in big letters (each Isle rocket is named, with a joke), mission patches, the customer's logo. *Livery hue:*
  the decals and a thin band under the fairing.
- **Interstage:** a **flush black carbon cylinder**, no ribs, a hue stripe.
- **Bells:** **small and many** (a cluster under every stage), **copper-coloured, 3D-printed** matte.
- **Fins:** tiny or none; thin carbon with a hue tip.
- **Nose:** a black **clamshell fairing** with a white band and the customer's logo.
- **Signature designs:** (1) a **slim black two-stage launcher** with a kick stage showing (Electron-like); (2) later, a
  **medium black rocket with a wide fairing**.
- **Pad:** a **tiny pad on a remote green peninsula**, sea on three sides. The rocket rolls out lying on a trailer
  from a **hangar with the company's name**, and a **strongback** (one lattice arm) raises it, stays leaning on it
  and tilts back a few degrees at lift-off. A shed, a container office, one mast. Sheep.

**Questions, defaults if silent:**
1. **Coastal's pad changes from the table's "mobile gantry that rolls away"** to **vertical rollout on a table to a
   towerless pad with lightning masts** (default): Cape's gantry already rolls away (NOTES § Step 7), so the table's
   version wouldn't be told apart.
2. **Answered (Caio, 2026-10-10): a launch rail for every school** (MIDGAME 1.1.0 § The launch rail, Q228); Mountain draws it by default. Was: **Mountain's rail launcher is look only** (default): the player's rocket sits on the rail raised to vertical, so
   the flight is the same as anywhere (a school never changes physics); only rivals' news pictures show it tilted. Or
   (b) a real tilted launch for small solids, a small physics change.
3. **Isle's decals show the contract's client** when a flight has one (default), and each Isle rocket gets a joke name
   drawn from a list.
4. **A mock-up round** for the four, as Q89 did for Cape and Steppe: the Orbiter preset in all six schools side by
   side, each school's two signature designs, each pad in a still (default: yes).

---

## The archetypes: tone, rival personality, affinities

What each archetype already *does* in play is built (NOTES v1.24). This adds how it *sounds* and *behaves*, plus the
school affinities. Weights are draw probabilities when a world is generated.

### Open superpower
- **School affinity:** Cape 0.6 · Coastal 0.2 · Mountain 0.2.
- **Mission control:** calm, procedural, on an open loop the press can hear ("Roger, Tellus. You are go for staging.").
- **News:** live coverage, named reporters; failures are on the front page with a photo.
- **As a rival:** **announces everything in advance**, including the date. Visible failures (its own scrubs and
  explosions make your news). Races hard for "firsts with people".
- **Name forms:** *# Union*, *United Provinces of #*, *# Commonwealth*.

### Closed superpower
- **School affinity:** Steppe 0.7 · Arsenal 0.3. Flies its own hardware almost always (high industry).
- **Mission control:** terse, codenames, numbers instead of names ("Object 4 is on the planned orbit.").
- **News:** a short TASS-style bulletin **after** the fact; nothing before; a failed flight is "a scheduled test".
- **As a rival:** **announces only successes, after they happen.** Its first is a surprise headline. Rumours precede
  big attempts (a "probable lunar attempt" line from the open press). Leans to spectaculars on political dates.
- **Name forms:** *# Federation*, *# Union*, *People's # Republic* (new form).

### Rising power
- **School affinity:** Arsenal 0.4 · Mountain 0.4 · Steppe 0.2 (a former client of the closed superpower).
- **Mission control:** formal, proud, a little stiff; a minister in the room.
- **News:** national-milestone tone ("The nation has joined the space age.").
- **As a rival:** **copies, then catches up.** Targets the firsts others have already claimed ("the second power to…"
  pays at home), and its schedule speeds up as its industry grows (`grow`).
- **Name forms:** *Republic of #*, *# Republic*.

### Frugal middle power
- **School affinity:** Coastal 0.5 · Mountain 0.3 · Isle 0.2.
- **Mission control:** dry humour, small team, everyone on first-name terms.
- **News:** science-desk tone, cost-per-kilo pride ("for less than a new motorway bridge").
- **As a rival:** **doesn't race; partners.** Offers joint missions and cheap rides; competes only on commercial
  launches and records of efficiency.
- **Name forms:** *Kingdom of #*, *# Confederacy*, *Free State of #*.

### Resource state
- **School affinity:** none of its own at first: **its hardware is whoever sold it** (low industry, decision 2). Its
  pad is built by a foreign contractor in that contractor's school.
- **Livery:** lavish: metallic gold or chrome accents on the power's hue, the ruler's emblem on the fairing.
- **Mission control:** imported experts in a brand-new building; announcements in grand terms.
- **News:** prestige, record-breaking claims ("the largest launch pad in the world").
- **As a rival:** **buys its way in**: stakes, teams, foreign rides with its own passenger. A burst of activity in a
  commodity boom, quiet in a bust.
- **Name forms:** *Kingdom of #*, *Emirate of #* (new), *Sultanate of #* (new).

### Commercial giant (not a power; D10, 2026-10-09)
A **company**, the one rival that isn't a nation: no territory, no flag, no relations of its own; it is based in a
power and answers to its law (sanctions on that power reach it).
- **School:** Foundry, always. It arrives with the **commercial era** (LATE_GAME § Rivals, rule 5), never earlier.
- **Mission control:** a crowd in matching shirts, cheering in a factory; the founder posts the news before the press does.
- **News:** iteration in public: prototypes blow up as headlines ("rapid unscheduled disassembly"), then fly. Launch
  prices announced as a challenge to everyone else.
- **As a rival:** **undercuts and out-builds.** Lowers launch and contract prices (W26 4), races for the capstones,
  sells rides and parts to anyone, you included.
- **For the player:** buying from it puts Foundry parts in your rockets, drawn in its school and your paint (mixed
  rockets, decision 2).
- **Name forms:** *# Industries*, *# Space*, *#works* (a company name, not a state).

### Security state
- **School affinity:** Arsenal 0.6 · Steppe 0.3 · Mountain 0.1.
- **Mission control:** military ranks, short orders, "the site" rather than a name.
- **News:** state media; launches described as "satellite tests" whatever they were.
- **As a rival:** **secretive and provocative.** Launches without notice, sometimes over its neighbours; payloads are
  often classified. Its tests make tension headlines.
- **Name forms:** *Republic of #*, *# State* (new).

---

## Generation rules (so it stays legible)

1. A power's **school** is drawn from its archetype's affinities with the world seed (`WSEED`).
2. **The two superpowers always get different schools** (as the generator already forces different archetypes).
3. **No two powers share both school and hue band** in one world; the hue moves if they would.
4. **Names come from the school's syllable set** (today one shared `SYL` list in `sim/world.js`), and the *form* of
   government from the archetype's list.
5. **Home's pad and buildings use home's school**; a resource state's use its contractor's.
6. **A part draws in its maker's school; the paint and roundel are the flying power's.**

---

## What it changes in play

Mostly look and words, by design. The play changes ride systems that exist:
- the **rival news rules** (who announces before, who only after, who copies) shape the race as you experience it,
  using the race's existing seeded schedules;
- **mixed rockets** make industrial independence visible (`sourceOf`), with no new mechanics;
- **tone** is the headline and mission-control text the game already writes, varied per archetype.

**Not proposed here (each would be a new system, so needs a pillar first):** voiced mission control; school-specific
part *performance*; diplomacy actions.

---

## After approval: the fan-out

- **look & sound, parts & pad:** a school as a style parameter in `partShape`/`partBody`, outline unchanged (Cape
  first, since it's today's look; then Steppe); one or two signature designs per school for rivals; livery and the roundel from the roll-pattern machinery (NOTES § "Paint schemes per
  design or era"); the pad per school.
- **economy:** school and name forms in `makePowers`; syllable sets per school; rival news rules per archetype;
  headline tone per archetype.
- **flow:** flags and roundels in the UI (the world section, the race, news).
- **world:** the pad site per school (cove, ridge, coast, steppe), if it touches terrain.
- **QA:** a tester view that cycles the six schools on one rocket, for screenshots.

---

## Decisions (round 2, Caio, 2026-10-08)

1. **The six schools stand; build Cape and Steppe first** (the two superpowers' looks), then the rest one at a time.
2. **The affinity weights stand as written.**
3. **Add the new government forms:** People's Republic, Emirate, Sultanate, State.
4. **The six rival personalities stand as written.**

---

## Version history
- **1.1.0 (2026-10-09):** D10, approved by Caio: a seventh school, **Foundry** (commercial, late; Starship-like), and
  the **commercial giant**, a company rival in the commercial era that can sell you its parts.
- **1.0.0 (2026-10-08):** approved by Caio; round-2 decisions; what a school may change on a part (outline fixed),
  and the big silhouettes as school designs.
- **0.1.0 (2026-10-08):** first draft. Round-1 decisions; six schools; tone, rival personality and affinities per
  archetype; generation rules; fan-out.
