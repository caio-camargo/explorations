# DECISIONS — every design decision, one line each
**Version**: 1.0.10 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-11 · **Updated**: 2026-10-13
**Status**: live, append-only.
**Purpose**: The one place a decision is written in full. Design docs hold the *current* design and link here for the
why and when; QUEUE holds only open questions and live work. Rules: [`ROADMAP.md`](ROADMAP.md) § "Documents".

**How to add one:** a row at the bottom of its section with the question's ID (W, D, or `DEF-` for a default that
never had one), the date, the decision in one line, and **Touches**: every doc and item it changes. Then make those
changes, search the docs for the old wording and fix or mark every hit (the ripple rule). **To change a decision**,
add a new row that names the one it supersedes and strike the old row's decision; never edit it silently.

The full text of every question as it was asked (options, reasons) is in
[`archive/decisions-2026-10.md`](archive/decisions-2026-10.md).

---

## Pillars, milestones, process

| ID | Date | Decision | Touches |
|---|---|---|---|
| W9 | 2026-10-08 | Eight pillars; 1 is "pushing the boundary of what's possible" | ROADMAP § Pillars |
| W10 | 2026-10-08 | The file split done in a freeze Caio called | NOTES § "The file split" |
| W13 | 2026-10-09 | PLAYTEST #9 and #11 don't hold M0; M0 closed when Q74–Q77 landed | ROADMAP M0 |
| P7 | 2026-10-10 | Pillar 7 settled: "Earnest heroism, warm, with dry humour", Thunderbirds played straight | ROADMAP 1.7.0 |
| W16 | 2026-10-11 | Caio plays the first hour himself; the measure is that he enjoys playing it. Supersedes W8's outside player | ROADMAP M1, PLAYROUTE |
| D17.1 | 2026-10-11 | M2's finish line: a routine repeat satellite launch keeps a network up; resupply moves to M3 with crew | ROADMAP M2, Q233, MIDGAME |
| DOC | 2026-10-11 | The documentation system: one home per fact, this log, the ripple rule, `check_docs.mjs`, size budgets, a review per milestone | ROADMAP § Documents, session-roles, QUEUE |
| W37 | 2026-10-11 | NOTES split into `notes/<area>.md` (eight areas, oldest first); NOTES.md the index of every section; versions one series (`check_numbers.mjs` reads them all) | NOTES, ROADMAP § Documents, `check_numbers.mjs`, ACTIVE_WORK merge recipe |
| GFX | 2026-10-11 | Graphics budget: 60 fps on Caio's mid-range machine, 30 fps on integrated graphics; Low/High settings; no high-end requirement | ROADMAP § Graphics budget |

## Flight and physics

| ID | Date | Decision | Touches |
|---|---|---|---|
| DEF-ocomp | 2026-10-08 | Hold modes built into crew capsules; probes need the computer part from the onboard-computer era | `ocomp`, Q34a |
| W5 | 2026-10-08 | Esc pauses, everywhere | Q39 |
| D8 | 2026-10-09 | No air above 100 km in flight (a cutoff, as KSP); decay between flights stays | NOTES v1.64, KSPISMS § 2 |
| D14.2 | 2026-10-10 | Tilted launches are a launch rail for every school (Mountain draws it by default), not Mountain-only physics | MIDGAME § The launch rail, Q228, POWERS |
| D15.1 | 2026-10-11 | Engines get a number of ignitions and a throttle range by era; solids neither throttle nor stop; ullage automatic | Q279; CREW engineer retry, Selene landing, rail timers, W7, presets, `career.mjs` |
| D15.2 | 2026-10-11 | "SAS" renamed by era: rate damping, attitude hold, autopilot | flow, W14's HUD |
| D15.3 | 2026-10-11 | Our own navball and node look; the ball as the era's flight director | look, flow |
| D15.5 | 2026-10-11 | A simulator replaces revert: fly any mission there, free of money and news, revert at will; real flights can't be reverted. Supersedes DEF-revert | Q282, Q257, TESTING 96 and 127, CREW § Skill |
| D17.2 | 2026-10-11 | The simulator flies the program's **believed** numbers and error bars (never the true ratings) and costs **time, not money** | Q282, KSPISMS, CREW § Skill |
| D17.3 | 2026-10-11 | Dispatch repeats an ascent you flew; the rail flies a small uncrewed ascent you never flew | MIDGAME § ladder |
| ~~DEF-revert~~ | 2026-10-08 | ~~Revert and R skip the Debrief: a quick retry~~ (superseded by D15.5) | TESTING 127 |

## Program, economy, rivals

| ID | Date | Decision | Touches |
|---|---|---|---|
| W1 | 2026-10-08 | Only a flight launched while nyxfind is open tracks Nyx; every Selene/Nyx first pays ≥ 1.3× its proven rocket | NOTES v1.53 |
| W3 | 2026-10-08 | Flights from orbit pay a reduced operations fee and may complete orbit contracts accepted before they started | economy |
| W4 | 2026-10-08 | Selene firsts are in the race; rivals no earlier than epoch 4 | economy, POWERS |
| W7 | 2026-10-08 | Development makes variants (a Mk2 palette entry), not upgrades in place | economy; check against D15.1 |
| W11 | 2026-10-08 | A mission counts only on a flight launched while it was open | economy (v1.81.1) |
| W12 | 2026-10-08 | The sponsor pays back 75 % of the first lost flight aimed at an open first, once per epoch | `coverLoss` (v1.55) |
| W22 | 2026-10-09 | Station contracts: firsts; resupply deadline when supplies run out; retrieval refunds parts. Rivals' satellites can be **retrieved**, with consequences, on satellite hacking's stealth rules | Q9, Q187 |
| W23 | 2026-10-09 | Overflight: judged on the track flown; any foreign land, scaled by the relationship; overflight rights a decision from the start, and rivals may refuse | NOTES § overflight politics |
| W25 | 2026-10-09 | Capacity costs ×1.6 the last; new home sites buildable; **the hall's bays parked** until Caio playtests (he likes going back to the build screen) | Q123 |
| W26 | 2026-10-09 | **Rivals are programs from epoch 1** (simplified early); scarce places held by building first; mood eras from tension and date; commercial rivals undercut pay | Q138, Q188 |
| W27 | 2026-10-09 | Routines: ordered each time at first; a route may repeat after 3 clean runs, when the ladder allows; cargo physical; self-sufficiency the lowest share; depots sell by relationship | Q110, MIDGAME |
| W28 | 2026-10-09 | Missions per body: epochs as SYSTEM has them; flyby → orbit → landing first; the 1.3× floor; Erebus found by a survey | Q88 |
| D7 | 2026-10-09 | Supply runs to a Selene base are gated by compute era | v1.74 `BASE_ERA` |
| D10 | 2026-10-09 | A seventh school, Foundry (commercial, late), and a commercial giant as its own rival kind; players may buy its parts | POWERS 1.1.0, Q205, Q206 |
| D17.4 | 2026-10-11 | **A missed deadline costs a wait**: the offer is lost and returns later, no standing or opinion loss. Harm to people stays costly | economy, `sim/contracts.js`, pillar 5 |
| D17.5 | 2026-10-11 | Satellite aging stays; **its news nag goes**; obsolescence shows in the Fleet tab and as replacement offers | economy, flow, MIDGAME § Satellites |
| D17.8 | 2026-10-11 | Money sinks for rich programs (prestige projects, aid, capstones) planned by economy, so money never beats flying | economy plan |

## Satellites, space, the world

| ID | Date | Decision | Touches |
|---|---|---|---|
| W2 | 2026-10-08 | Satellites have a fuel lifetime; at zero the service pauses, never dies | MIDGAME § Satellites, Q50 |
| W6 | 2026-10-08 | A sea-specific launch complex later; the land complex is reused on the platform | look evergreen |
| DEF-ground | 2026-10-08 | GROUND: maria on the near side; G1–G2 before M3; relief in real metres | GROUND |
| D5 | 2026-10-09 | A rover whose battery runs flat at night goes dormant and wakes in the sun; no other cost | Q189, `sim/rovers.js` |
| D6 | 2026-10-09 | A dry satellite parked too low still re-enters, warned ahead (closes W17) | MIDGAME 1.0.1, Q125 |
| W20 | 2026-10-09 | The bodies' round-2 twists and Erebus's companion Aether | SYSTEM 1.1.0, Q207 |
| D19 | 2026-10-12 | **The slow world** (Caio's idea): the reserved innermost slot, Mercury's 3:2 (~97 program days of sun, 97 of night), airless, built with the planets at M5; its rules may be tried on Selene first | SYSTEM 1.1.3 |
| D20 | 2026-10-12 | **Payload parts, asymmetry, pointing** (Caio): side forms of the small boxes; antennas whip / boom / dish; narrow and wide cameras, radar, a scan platform; magnetometer and RTG booms; a payload fairing; the CoM and trim readout in the builder; **an attitude law that points any part at any target** (nadir, home, sun, a vessel or station, a site) with a second part for roll; **strict pointing**; slices S1 fit and shield → S2 point → S3 Voyager | PROBES.md, QUEUE Proposed (S1–S3), ROADMAP catalog |
| D20 (amended) | 2026-10-12 | Pointing costs **power only**: no wheel-momentum or gas bookkeeping for holding a law, in flight or between flights; in-flight saturation under big torques stays as built, with its automatic dump (Caio: "maybe power is enough tradeoff here") | PROBES 0.1.1 § 5–6, QUEUE Proposed S2 |
| D21 | 2026-10-12 | Probes, round 2 (Caio): **booms as a building part, folding and telescoping** (Voyager's two), tip mount, length set, fold to fit the fairing, load limit, tilt to 90° or 45° only (folding boom in S1); the era ladder per function (draft); attitude sensors (sun, horizon, star tracker) gate pointing (S2); beauty rules for probes; **a tooltip system**: terms, part cards, warnings that explain themselves | PROBES 0.1.3 § 3.4, 3.6, 5–9, UI.md rule 9, Q287, QUEUE Proposed |
| D22 | 2026-10-12 | **The builder's right panel** (Caio: "much too long... very confusing, and this is a matter for better design, not more explanation"): build tools become a toolbar on the 3D view; the panel becomes **three tabs**: **Checks** (default: a GO/NO-GO board for the mission, each row a plain verdict and its fix, its numbers on click), **Stages** (the staging list, Δv/TWR/burn per stage; hovering a stage dims the rest, #81), **Part** (opens on selecting a part: what it's for, options, loads, pairs; replaces right-click). Writing rules: a verdict in plain words then the fix; no jargon as a label; show it on the rocket. The desk draws a clickable mock-up first | UI.md 0.1.4 (Assembly row, rule 14), Q237, Q286, Q340, `mockups/builder/` |
| D23 | 2026-10-12 | **The aim** (Caio: "how does it know what its target is?... the player should be able to determine what the objective is"): a line atop the Checks tab opens an **overlay** over the Assembly: a job (contracts and program missions, target filled in) or **your own aim in up to three legs** (orbit / hop / flyby / land / meet a craft; then another leg, e.g. come home), defaults for every detail (lowest safe orbit at the pad's tilt; anywhere on the near side, or a spot on a globe); saved with the design, marked on the stages, fed to procedures, Rollout and Dispatch. **Every Δv need is the program's guess** (Caio: "best guess needs to be an actual guess, not ± 1700 from the known right answer"): the true need off by a hidden error drawn once per program, destination and knowledge level, inside the stated bound (the compute era's, wider where nobody has been); a study or a flight redraws it tighter; flown, it's known | UI.md 0.1.5 (Assembly row, § 3.1), `mockups/builder/` (the aim), QUEUE Proposed |
| D24 | 2026-10-13 | **Satellites: parts, not products, built on their own bench** (Caio, on `mockups/satellites/`: "they look good, but i don't want to take away the player design experience by having them be too readymade... they're kind of like the rover in that they probably need to be designed separately from the rocket and then tucked in somewhere"). No part is a whole satellite: **the bus is one adjustable frame** (shape, size 0.3–3 m, a skin per face); smaller stacks and a kick motor; signature shapes are parts that jobs ask for. **The payload bench**: designed apart like the Rover yard, its own Checks (power in shadow, link, pointing, temperatures, balance, fairing fit), then one block on the rocket inside the fairing; flies on any rocket, copies by route. Smaller payloads help stability. Default if silent: customers' commercial payloads come ready-made | PROBES 0.1.4 § 6 (rules 5–6), § 6.1; `mockups/satellites/`; QUEUE Proposed |
| Q200 | 2026-10-09 | Debris: big pieces on rails; fragments as density per band, spawned as objects only near a monitored flight | LATE_GAME § Debris |

## Crew

| ID | Date | Decision | Touches |
|---|---|---|---|
| W19 | 2026-10-09 | Crew are stylised humans, not KSP's cartoon, not realistic | CREW Part 1 |
| W24 | 2026-10-09 | The roster: first class when the abort tests open; a class every 2 years; names in the home school's style; crewed flights blocked until requalification after a loss | Q133–Q137 |
| D9 | 2026-10-09 | Suits by school: three generations, a spacewalk suit per school, a role stripe | CREW § suits |
| W30, W32 | 2026-10-10 | The round-2 suit brief (era by silhouette, school by construction); "suits look good" → build | CREW § suit brief, Q219, Q229 |
| D12 | 2026-10-10 | A face engine (hybrid; recruits generated, player can edit; portraits baked), provisional on performance; breeding mode; pushed extremes | FACES |
| D13 | 2026-10-11 | Suit briefs for Arsenal, Coastal, Mountain, Isle, Foundry; Isle early a surplus suit; crew always wear their home school's suits | CREW § the other five schools, Q226, Q229 |
| D15.4 | 2026-10-11 | Crew titles by era and school; skill from simulator qualifications and time in type, not ranks; seniority from firsts | CREW § Skill, Q133–Q137, Q134, Q182, NOTES § roster plan |
| D17.6 | 2026-10-11 | **The head is the carved puppet** (closes D11 and W31) | CREW Part 1, FACES |

## Look, screens, UI

| ID | Date | Decision | Touches |
|---|---|---|---|
| W14 | 2026-10-10 | Visual identity (default, Caio leaning that way): paperwork for the office, instrument panel for the cockpit, poster headings for big moments, all varying by era | Q53, UI.md rule 13 |
| W15 | 2026-10-09 | Flight HUD slice 4: gauges beside the navball; one speed switching at the top of the air; Keys off the toolbar; pins per browser | Q3 |
| W21, W34 | 2026-10-09/10 | Cape and Steppe hardware as mocked up; the other four schools built on the same plan | POWERS, Q102, Q228 |
| D14 | 2026-10-10 | Rocket briefs for Arsenal, Coastal, Mountain, Isle; Coastal's pad a vertical rollout to lightning masts; Isle decals show the client | POWERS 1.2.0 |
| W35 | 2026-10-10 | Real screens: the Program as a desk; no 3D behind the rooms; mission control after the first orbit; **the Assembly a scale model on a desk** | Q239–Q242 |
| D17.7 | 2026-10-11 | **The network view lives in mission control** (supersedes W18's separate screen) | Q111, MIDGAME |
| ~~W18~~ | 2026-10-09 | ~~The network screen its own screen, key N~~ (superseded by D17.7) | Q111 |
| D15.6 | 2026-10-11 | KSP's names out: *Asparagus* → *Crossfeed*, no "Kerbol"; "on rails" out of player text | vehicle, SYSTEM |
| D16 | 2026-10-11 | UI hierarchy: three reads per screen, dark cockpit, reserved colours, master caution, GO/NO-GO boards, one kit; the board answers for the picked mission; the caution buzzes; pinnable readout lines | UI.md, Q53, Q239 |
| D18 | 2026-10-12 | The beauty pass: 1960s press photography with a grade per era; stars set by exposure with a floor; HDR and exposure first; a subtle galaxy (mock-ups of both); game stills, mock-ups only for the sky and the planet; order B0 → quick wins → sky and bodies → the rest; **greebles in real geometry** for the shadows (Caio) | BEAUTY.md, QUEUE Proposed (B0–B6), Q253, Q268, Q250, Q259 |
| W36 | 2026-10-11 | Heat and stress: needles that wake at 50 % and redline at 90 %, with the master caution; glowing parts later | Q271 |
| W40 | 2026-10-13 | The commercial giant on the defaults: arrives world year 18–21; takes 40 % of the commercial market over four years; sells us only parts we can't make, automatically, cheaper than imports | Q206 (v1.161) |
| W41 | 2026-10-13 | Rivals' satellites as targets: real objects; an unspotted retrieval raises suspicion; hacking pays the contract if a contract, the service if our own; hacks include a **tap** (indefinite, until the owner notices: our imagery, relay, TV and nav count it) and a **data theft** (science pays per bit; a spy satellite's data reveals its owner's program). Radar as layers (optical → ground radar → space surveillance) is the default, Caio unsure | Q187, NOTES § Q187 amendment |
| W42 | 2026-10-13 | The simulator on the defaults: a day per simulated hour (at least half a day a run, warp free); each run draws its own believed world; ignition failures on at the believed rate; revert gone from real flights; the same simulator every era | Q282, Q449–Q451 |
| W44 | 2026-10-13 | The slow world on the defaults: eccentricity Mercury's real 0.2056 (the sun backs up 1.1° near perihelion); a rover on an airless body's night with no heat sleeps and wakes at dawn, each unheated night costing a third of its battery (the cold does the damage, not the empty battery); drive orders between flights abstract; Selene's fixed sun left at 6.8° until Q177 | Q331 (notes space § "Plan: the slow world") |
