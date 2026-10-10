# CREW — astronauts
**Version**: 0.2.5 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-08 · **Updated**: 2026-10-10
**Status**: **Part 2 (who crew are) approved by Caio 2026-10-08.** Part 1's style chosen 2026-10-09 (stylised human); suits by school and era still open (D9);
the whole file goes to 1.0.0 when it's settled.
**Purpose**: Who flies: what an astronaut is in play, how crew touch the systems already built, and how they look.

**What exists** (cite, don't redo): a crew is two seats in a capsule (`d.crew`), flying once the escape tower is
qualified (the max-q abort; NOTES § "Crew: the escape tower"); limits on g (`G_LIM`), cabin temperature and 10 days
of air; a loss costs opinion and makes the news (`failHit`); crewed rovers need a crewed lander; tourists have
one-line identities (v1.19). Planned: crew rotation (sats plan), crew as one of the four goods and outposts with
crews ([`LATE_GAME.md`](LATE_GAME.md)). The SAS tiers by compute era (NOTES § v1.40): gyro (stability only), analog
autopilot (prograde, retro, normal, radial), guidance computer (manoeuvre, target, docking).

---

## Part 2 — who crew are

### Decisions (round 1, Caio, 2026-10-08)

1. **Level 2: named people with roles.** Not anonymous seats (no weight), not full careers (management) for now.
   Caio likes management: **level 3 must stay buildable on top** of this without rework (§ "Room for careers").
2. **The pilot is the computer.** In the early eras, a pilot aboard flies modes the vessel's computer can't.

### Every astronaut

- **A name** in their power's naming style ([`POWERS.md`](POWERS.md) § schools), a portrait, a one-line background
  ("test pilot, 3,000 hours in rocket planes"; "geologist, the northern ice fields").
- **A role:** pilot, scientist or engineer.
- **A record:** flights, days in space, firsts, bodies walked on. The record is history, not points (pillar 3).
- **Rank 1–3**, earned by flying (below). No visible XP bar.
- **They can die.** A lost astronaut is gone for good, named in the news, and in the program's memorial. No
  respawning (KSP's option); pillar 7: a lost crew weighs.

### The roles

Each role makes **who you send** part of the mission's design (pillar 2), through a system that already exists.

**Pilot: the computer before there are computers.**
- On a crewed vessel, a pilot **provides SAS modes the vessel's computer doesn't have**, as Gemini and Apollo crews flew
  what their machines couldn't. The `ocomp` rule (the guidance computer's modes need a computer part) is waived for
  modes a pilot aboard can fly.
- By rank, using the existing tiers:
  - rank 1: the analog autopilot's modes (prograde, retro, normal, radial);
  - rank 2: + manoeuvre and target;
  - rank 3: + docking, and a **manual landing** hold (hover and descent rate), the Apollo 11 moment.
- **Human limits:** a pilot is slower and less precise than a computer of the same tier (e.g. pointing ~0.5° against
  the guidance computer's 0, lower turn rates). So computers still win when they arrive: the pilot is the early-era
  answer, the computer the later one (pillar 8).
- Uncrewed vessels are unaffected.

**Scientist: makes the surface pay.**
- Works the instruments that exist (NOTES § R4: the spectrometer, panoramas, the seismic network) **better** in person:
  picks samples (a sample return is worth more), takes panoramas without waiting for contact, sets up a seismic station
  in one EVA.
- By rank: the science multiplier on surface work (e.g. ×1.25 / ×1.5 / ×2). Schmitt on Apollo 17 is the model.
- In the late game: an outpost with a scientist earns science per day.

**Engineer: fixes what breaks.**
- **In flight:** one retry of a failed ignition per burn (the know-how roll, `igniteOK`); rank 3, two.
- **At stations and outposts:** production modules need an engineer to run (LATE_GAME: ice plants, greenhouses,
  workshops). Engineers are what make self-sufficiency rise.
- Repairs a part worn by loads or heat (the stress record from refurbishment) on a station, before it fails.

**Passengers and tourists** stay as they are: named in one line, not on the roster.

### Ranks

- Rank goes up by **flying, not by grinding**: a first flight, a first orbit, a first landing on a body, time in
  space past a threshold. **Firsts promote.** Routine flights add days but rarely rank.
- Three ranks only, so the effect stays legible (pillar 1: "a player can say why").

### The astronaut office

- **Classes, not hiring.** Every few years the office selects a **class** (the Mercury Seven, the Group 2 "Next Nine"):
  a handful of new astronauts, their roles following the era (test pilots first, then scientists, then engineers for
  stations and outposts). The class size grows with the program and its facilities.
- **Training is the crew good's bottleneck** (LATE_GAME): classes per year limit how many outposts and cyclers you
  can staff, as pads limit launches.
- **Routines staff themselves.** A routine that needs crew picks from the available roster by role. **You choose crew
  only for flights you fly by hand, and only if you want to** (the default picks for you). No roster chores (pillar 5).

### The hooks into what's built

| Hook | Existing system | What happens |
|---|---|---|
| **Requalification after a loss** | the flight record; the abort-test gates | Crewed flights stay blocked until an **uncrewed qualification flight shows the cause is fixed**: the flight record names it (g, cabin heat, a part, a failed abort), and the test is the same rocket surviving the same moment. A loss costs a flight and a design problem, not a wait (pillars 2, 5). **Not** a timed stand-down: a skippable timer costs nothing, and an unskippable one breaks pillar 5 (Caio, round 2). |
| **The person is gone** | roles and ranks | Losing a rank-3 pilot means the next landing flies with a rookie who can't fly the manual landing hold. The loss is felt in play. |
| **Openness** | open/closed, leaks | **Open:** astronauts are celebrities; a famous crew lifts opinion, a lost one is national grief. **Closed:** a loss is hushed (part of the hit now) and can **leak** later with the leak system; it **may skip requalification** and fly again at once, the cause unfixed and the leak risk growing, the closed program's real temptation. Heroes are announced only after success. |
| **Archetypes** | POWERS.md | Security state: military pilots, few scientists. Frugal: scientist-heavy classes. Resource state: few classes of its own; **buys seats**. |
| **Guest astronauts** | foreign contracts, relations | Fly another power's astronaut, as Intercosmos did: a contract that improves relations. Or buy a seat on a rival's flight for your own. |
| **Defections and career moves** | v1.24 career moves | A famous astronaut defecting is a headline. If your program changes hands, your roster comes with it. |
| **Crew limits** | g, cabin, air | Unchanged, and per person: the news names who was hurt. |
| **Firsts** | missions, the race | Firsts name the crew ("Vela Marisk, first person on Selene"). The race names rivals' crews too. |
| **The late game** | LATE_GAME outposts, cyclers | Outposts have named commanders and crews; "day 400 on Selene Base" is a headline. |

### Room for careers (level 3, later)

Not built now, but nothing here blocks it. Each would add to the astronaut record without changing the roles:
morale and fatigue, retirement and veterans who become flight directors, popularity as its own number, radiation dose
as a lifetime limit, poaching by rivals, personal relationships in a crew. The record and the roster are the base
every one of them needs.

### New system check (ROADMAP § "Systems are complete")

The roster is a new system. It serves pillar 2 (who you send is part of the design), 7 (a loss weighs) and 8 (the
crew tell the era's history).

---

## Part 1 — how crew look

**Decided (Caio, 2026-10-09, W19): (c) stylised human** (1960s illustration, Thunderbirds, Tintin; mock-up
`mockups/crew/`). Not a retread of KSP's cartoon crew, not realistic either: the stylisation is what allows the lighter
tone (pillar 7). Human proportions with simple forms, flat colour bands and ink outlines; faces readable small.

**The puppet direction (D11; Caio's favourite 2026-10-10, mock-ups in progress):** if it wins, "stylised human" here
means **carved, lacquered puppet heads lit like sculpture** (Thunderbirds, art deco relief), replacing the flat colour
and ink outlines above, and `app/crew-look.js` (slice 1) follows. Two rules either way:
- **Faces don't age with the eras.** The people are the game's lens (Tintin stayed Tintin); suits, screens and hardware
  carry pillar 8. No lane "modernises" the faces.
- **A varied roster is a pass/fail check** before any head is approved: every skin tone and the six schools' name
  styles, carved with respect. Carved stylisation of non-European features has a history of caricature; the sheet
  shows it doesn't happen here.
- Crew mostly **stand and sit** (the hatch, portraits); a walkout is a cut or a short pose, never a long walk cycle.

**Suits by school and by era (Caio's idea, 2026-10-09; design open, D9).** Each hardware school (POWERS.md) dresses its
crew in its own suit line, and the line changes with the epochs, as real suits did: Cape from Mercury's silver to
Apollo's white to the Shuttle's orange launch suit to today's sleek one; Steppe from the SK-1 to Sokol, with Orlan
for spacewalks. Draft: three launch-suit generations per school (early pressure suit, the launch-and-entry suit, the
modern one), plus a spacewalk or surface suit once EVA exists; look only, like everything a school touches.

| School | Early | Middle | Late | Spacewalk / surface |
|---|---|---|---|---|
| **Cape** | Mercury's aluminised silver | Apollo's white layers, blue fittings | sleek white-and-black tailored | bulky white with a backpack (EMU) |
| **Steppe** | orange coverall over a pressure suit, lettered white helmet (SK-1) | Sokol: white, blue connectors, soft hood | a refined Sokol | Orlan: rigid torso, rear entry |
| **Arsenal** | olive military flight gear, bare metal fittings | white with red panels | white and red, armoured joints | Feitian-like |
| **Coastal** | Hermes's unflown suits: tidy white, a pastel band | the same with mission patches | slim blue-grey | rounded and modular |
| **Mountain** | slim saffron-and-white | Gaganyaan-like | lightweight, a light visor | compact |
| **Isle** | none (no crewed early era) | black carbon tones | black and white, dark visor | utilitarian, rental-grade |

Generations: early ≈ the first flights, middle ≈ the Selene era, late ≈ after Selene. **Decided (Caio, 2026-10-09): the defaults**:
(1) three generations, not each school's compute eras; (2) a spacewalk suit per school, not one shared; (3) a role
stripe on the shoulder (§ The roles) so crew read apart small. Then a look session mocks up Cape and Steppe across the
three eras in the Q72 scene, and Caio picks.
**Status (2026-10-09):** draft; Caio accepted the defaults on (1)–(3).

### The suit brief, round 2 (Caio, 2026-10-10: round 1 was "too samey across epochs and for the two schools")

**Why round 1 was samey:** one body with colour swaps and a few toggles (hood, backpack, gold visor), and six of the
eight suits white. Real suits differ in **construction**, not paint. Round 2 builds each suit from its own pieces.

**Two axes, read two ways:**
- **Era reads through silhouette and mass.** Early: slim and bloused, a pressure suit worn like clothing. Middle:
  structured, with visible joints (bellows, lacing). Late (launch): padded and bulky, built to survive an ejection, or
  cut close and tailored. Spacewalk: a small spacecraft, rigid and boxy.
- **School reads through how a suit is made.** **Cape:** hard shells and gloss, metal hardware on show, hoses into
  the chest, helmets that are separate rigid objects. **Steppe:** soft canvas, laces and straps, hoods sewn to the suit,
  hoses into the belly, and **a portable ventilator case carried by hand** to the pad (real: Gagarin's and every Sokol
  crew's walkout).

**Colour rules:** within one school, no two generations share a dominant colour; within one era, the two schools
never do. Where real suits are white, the second colour and the shape carry the read.

| Suit | Dominant / second | Silhouette | Helmet | Signature (the one thing only it has) |
|---|---|---|---|---|
| **Cape early** (Mercury) | aluminised silver / gold-anodised connectors | slim, bloused at the knees, laced silver boots | a round hard shell, a small oval faceplate, a mic boom inside | **mirror silver head to toe**; finger-tip lights on the gloves |
| **Cape middle** (Apollo) | white Beta cloth / blue and red connectors | upright, **bellows rings at shoulders, elbows, knees** | the **all-glass bubble**, over a black-and-white **"Snoopy cap"** | the bellows and the Snoopy cap; a row of coloured connectors on the chest, a diagonal zip |
| **Cape late** (Shuttle launch-and-entry) | **international orange** / black boots and gloves | **bulky, padded "pumpkin"**, parachute harness straps over the chest | white, a wide clamshell visor, a neck ring | the orange and the harness; a mirror on the wrist |
| **Cape spacewalk** (EMU) | white / gold visor, red identity stripes on the legs | a **hard upper torso**, a big backpack, a box on the chest | white shell, gold visor, **two helmet lamps and a camera** | the chest control box and the helmet lamps |
| **Steppe early** (SK-1) | orange coverall / white helmet, red lettering | slim coverall, belted, high black boots | white hard shell, red lettering across the brow, a visor that slides up | the **lettered helmet** and the **ventilator case in hand** |
| **Steppe middle** (Sokol) | off-white canvas / **blue everywhere it adjusts** | soft and creased, **blue lacing straps** round every limb, a **V-shaped laced opening** on the chest | **a soft hood sewn to the suit**, a hinged visor ring | the hood and the blue lacing; two hoses into the belly; the ventilator case |
| **Steppe late** | **grey-green** (the school's rocket enamel) / orange flashes | closer cut but still canvas, padded panels at chest and knees | a hard hood, the visor ring kept from Sokol | the grey-green, echoing its rockets; the ventilator case is now a slim shoulder pack |
| **Steppe spacewalk** (Orlan) | white / **red and blue limb stripes** | **a fridge-like rigid body, entered through a door in the back**, short stiff arms | boxy, a large rectangular visor, **lamps on both "ears"** | the back door (seen from behind) and a control panel on a lanyard |

**The sleek tailored white-and-black suit moves to Foundry** (POWERS 1.1.0), where it belongs: it's SpaceX's. Cape late
becomes the Shuttle's orange pumpkin suit. (Default, design desk 2026-10-10; Caio may override.)

**Shared, so they read as one crew:** the stylised-human proportions (W19), flat colour with ink outlines, the role
stripe round the upper arms (D9 3).

**Checks before Caio sees them:**
1. **Silhouette:** all eight as black fills in a row; each must be nameable without colour.
2. **Greyscale squint:** in grey at a third of the size, the two suits of any one era still read apart.
3. **Thumbnail:** each at 48 px tall (how the game shows crew in lists); the signature still visible.
4. A walkout pose too, not only standing, so the props show (the ventilator case, the Snoopy cap under the bubble).

---

## Decisions (round 2, Caio, 2026-10-08)

1. **The role numbers stand in spirit**; the lanes tune them.
2. **Classes every few years**, not hiring at will.
3. **No timed stand-down** (Caio: the player would just fast-forward through it). A loss costs **requalification**,
   an uncrewed flight that shows the cause fixed, and **the person**, whose rank and record are gone. Closed powers
   may skip requalification at a leak risk.
4. **Crew picked automatically** unless you choose for a hand-flown flight.

---

## Version history
- **0.2.5 (2026-10-10):** the puppet direction (D11): faces constant across eras, a varied roster as a pass/fail check,
  no walk cycles.
- **0.2.4 (2026-10-10):** the suit brief, round 2 (construction per school, silhouette per era, colour rules, a
  signature per suit, checks); Cape late becomes the orange launch-and-entry suit, the sleek suit moves to Foundry.
- **0.2.3 (2026-10-09):** D9: Caio took the three defaults.
- **0.2.2 (2026-10-09):** D9 draft: suits by school and era (table, three questions with defaults).
- **0.2.1 (2026-10-09):** part 1: stylised human chosen (W19); suits by school and era opened (D9).
- **0.2.0 (2026-10-08):** part 2 approved; round 2: requalification and the lost person replace the timed stand-down.
- **0.1.0 (2026-10-08):** first draft. Part 2 round 1 (level 2, the pilot is the computer); roles, ranks, the office,
  hooks into existing systems, room for careers. Part 1 waits for Q72.
