# Launchpad — roadmap
**Version**: 1.9.2 · **Author**: Caio Camargo + Claude (roadmap session) · **Created**: 2026-10-08 · **Updated**: 2026-10-11 · **Status**: live
**Purpose**: Where the game is going, in milestones, so that [`QUEUE.md`](QUEUE.md) can always be refilled without Caio
choosing each item. QUEUE is the short list sessions take work from; this is what refills it. NOTES keeps the design depth.

---

## Why this exists (diagnosis, 2026-10-08)

- **Features ship much faster than anyone plays them.** In three days, twelve lanes made ~400 commits and a 6,500-line
  `index.html`. Over 100 TESTING rows haven't been played, and Caio can't playtest for now.
- **The open PLAYTEST items sit where two lanes meet:** plasma on an ordinary ascent (terrain × aerofx), a landed flight
  settled only at the next launch (economy × ui), boxes covering boxes. Nobody owned the player's whole path.
- **The lanes grew out of the code, not the goals.** Narrow lanes run dry (tester, sound, control) while others pile up.
- **Caio's attention is the scarce resource.** Decisions waiting on him stall work, so most now get a written default.

Decided with Caio (2026-10-08): **M1 "the first hour" comes next**; lanes consolidate to the eight below; a platform
lane splits the file (still no build step); blocked decisions proceed on a default unless Caio overrides.

---

## Pillars (reviewed with Caio 2026-10-08, design desk; 7 settled 2026-10-10)

What the game is about. A feature has to serve at least one; a session can turn down or reshape work that serves none
without asking. Each line points at where NOTES already said it.

1. **Pushing the boundary of what's possible.** The game lives at the edge of what your program can do: a first orbit,
   a first landing, or a logistics network nobody has built before. Flying and the economy both serve that edge; the
   economy is part of the game, not a menu between flights. However big the program gets, a player can say why something
   happened (an offer, a failure, a payout). (Caio, 2026-10-08; replaces "Flying is the centre"; § "Overlap, powers…",
   guardrails)
2. **Every mission is a design problem, posed by physics we really simulate:** loads, heating, g, drop zones, windows.
   That's the edge over KSP. "Go to X" alone isn't a mission. (§ "Mission design", the lens)
3. **What you launch stays and matters.** Payloads serve a need and keep doing so; the world reacts. Progression comes from
   infrastructure and discovery, not points, and money alone is never enough: big things get built by flying them up.
   (§ "Program design — direction", § "Rich programs")
4. **Knowing more is progress.** Your own missions shrink the uncertainty: part ratings, the air, the tools' error bars,
   what's out there. (§ "Mission design", convergence 1; § "Compute")
5. **Forgiving with time and failure.** Missing something costs a wait, never a failure; nothing decays into chores; losing
   contact never kills a vessel. (§ "Time, long missions", principles; § "Routine runs")
6. **Lean and exact** (the engineering pillar; a **constraint**: it can refuse a feature, never justify one). Float64 state, exact rails, one rigid body, a pure SIM block: no Kraken,
   cheap warp, a port that stays cheap. (§ "The idea", § "Platform direction")
7. **Earnest heroism, warm, with dry humour** (Caio, 2026-10-10; was "lighter than serious, never a joke", provisional).
   The physics is real and the stakes are felt; the people are brave, competent and a little funny, never slapstick.
   A lost crew weighs; a tourist's excitement is charming. The model is Thunderbirds played straight (D11's puppet
   direction), not KSP's minion comedy. (§ "Program design — direction"; CREW.md's art direction hangs on it)
8. **You live through an era, into the near future.** Tools, looks and the world move on with the date: the program
   starts on paper and slide rules and grows into interplanetary travel, and possibly settlement. (Caio, 2026-10-08;
   § "Compute — a resource across eras", the logbook's ageing interface, § "Early-era realism"; SYSTEM.md)

## Systems are complete (2026-10-08)

Caio's read: systems are close to saturation, and the work now is **integration**. So the set of systems is closed:
what's built, plus those this roadmap already names for M2–M5 (the time model, routine runs, the link budget,
steady-state thermal, the sun and planets). **A new system needs a pillar and Caio's yes**; put it in *Waiting on Caio*
with the pillar it serves. Everything else is integration, content (missions, parts, balance) and polish.

## Milestones

Each milestone has a **finish line the robot playtester can check**. Only the current and the next milestone get code.
Anything further out gets 📝 design items only, so breadth keeps moving without piling up unplayed systems.

| | Milestone | Finish line | State |
|---|---|---|---|
| M0 | **Stabilize** | No open P1/P2 in PLAYTEST; the robot has judged every TESTING row it can drive; Q29's re-run is clean | ✓ **done 2026-10-09** (Q29 clean; last bugs Q74, Q77, Q112 in v1.73–v1.74; #9, #11 left to M1/M5 by W13's default) |
| M1 | **The first hour** | A scripted *new career* (`playtest.mjs`) goes from the first-run gate to first orbit and its debrief with no tester flags; `career.mjs` says a prudent player reaches first orbit in **4–6 flights**, and no start is stuck after one failed orbit attempt (default 2026-10-09 from v1.77's measurement; Caio may override); no box covers another at 1280×800; **Caio plays the first hour as a new player would** (a fresh career, no tester flags; 2026-10-11: there's no outside player, and the game's measure is that Caio enjoys playing it), and where he got stuck or bored is written in PLAYTEST | **current** (since 2026-10-09); **robot run ✓ 2026-10-09** (QA: `playtest.mjs m1` passes on the Beeper preset: Esc pauses, a Debrief after each flight, no box overlaps); pacing ✓ (Q118, Q93, Q144; re-run after Q188 and Q279); still open: Caio's first hour |
| M2 | **Satellites that work** (epoch 3) | A robot career reaches a weather + TV network that earns over time, **kept up by a routine repeat satellite launch** (a dispatch; resupply moves to M3 with crew, DECISIONS D17.1), using "advance to next event" only | **next** (code open since 2026-10-09) |
| M3 | **Crew and Selene** (epoch 4) | Crew to a chosen Selene crater and home, a rover driven on real Selene ground, all from contracts | design only |
| M4 | **Big projects** (epoch 5) | A depot and a datacenter built over several flights, sized by waste heat, earning | design only |
| M5 | **Sun and planets** (epoch 6) | A probe to another planet planned on a porkchop, coasting in the background while the program carries on | design only |

### M1 — the first hour (by lane)

| Lane | Items |
|---|---|
| flow | UI slice 3 **debrief** (Q2) · slice 4 **flight core and cards** (Q3, closes PLAYTEST #9) · slice 5 **rollout** (Q4) · **what to do next**: the Program screen always shows one suggested contract and why · **first-run**: the career choices explained in a sentence each · **Esc pauses** in flight (W5) · a **settings** overlay (volume, graphics quality, tester off) · 📝 then build **one visual identity** for the screens (PLAYTEST #13; the hardware's early-era look) with the look lane |
| economy | Epoch 1–2 **pacing for a new player** (`career.mjs`: flights and days to first orbit; nothing unaffordable after one failure) · `siteAccess` (Q6) · the ballistic target from the flight's site (Q7) · Selene/Nyx pay floor (Q8 ✓ v1.53; W1 overridden by Caio) · every offer says **why it appeared** in one line |
| vehicle | **The construction screen usable by a newcomer** (first: it blocks Caio's own playtesting; walk building an Orbiter from scratch, fix what's unclear, Caio's review) · Q14 / PLAYTEST #18 · builder wording (#23) · escape-tower category (Q32) · landing legs (Q31) · the builder **warns before launch** (won't reach the contract's orbit, TWR < 1, no chute on a crewed return) |
| space | No M1 items: works on M2 groundwork (below) |
| world | Q17 · merge the atlas · grazing-view cost (Q19): M1 needs a steady frame rate on the default site |
| look & sound | Q20 · Q21 · nozzle gimbal and fin drawing (Q23) · **volume slider** (Q35, part 1) · identity with flow |
| QA | **A presets-only playtest route for Caio** (the TESTING rows he can reach by flying presets, in a sensible order, so he can play before the builder is fixed) · `shot.mjs` on the RTX (Q28) · Q29 re-run · **the new-career robot run** (M1's finish line, written first so it fails until M1 is done) · tester cheats (Q16) · drivers for untried rows (Q30) |
| platform | See its own section: test shards, save versions, the file split |

### M2 — satellites that work (groundwork can start now)

- **space:** missions in flight (every vessel coasting at flight end joins the registry, on rails across bodies, raising
  events) · orbital decay (Q25) · station-keeping as a fuel lifetime (W2) · debris contact (Q26) · relay range and power
  (Q27) · `dispatchRun` (Q11) then deviation rules (Q12) · data as a volume plus the link budget.
- **economy:** the routine run and the pad calendar (serial → concurrent time) · station, base and relay contracts (Q9) ·
  pay on data received · flights from orbit (W3).
- **flow:** the event timeline screen ("advance to next event", stops at anything that needs you) · the pad Gantt view ·
  a satellite/network panel.
- **vehicle:** onboard-computer, radiator and solar-panel parts (Q34) · maneuver-node chains and the finite-burn
  correction (Q33).
- **look:** satellites and constellations readable on the map; ground tracks.
- **QA:** a robot career past epoch 3 (M2's finish line).

### The system catalog (an unblocker, now)

**Why now:** what the star system holds is the one design decision that lets the most work run in parallel. Once each
body is fixed on paper, it becomes its own work package, and every lane can take a slice of it without waiting on the
others. Today the game has Tellus, Selene and Nyx, all rooted at Tellus; no document says what else exists.

**The item** (📝, L, the **design desk** with the space lane's input, **Caio approves the list**): `SYSTEM.md` in this folder, one entry
per body or object class, each with:
- **physical:** mass, radius, rotation (or tidal lock), axial tilt, atmosphere (surface pressure, scale height, makeup),
  surface (rock, ice, ocean, none), rings, magnetic field;
- **orbit:** parent, semi-major axis, eccentricity, inclination, SOI, transfer Δv and time from Tellus, window period;
- **look brief:** a paragraph and two real-world references, enough for a sky & bodies session to start;
- **ground brief:** what the world lane builds there (craters, maria, dunes, ice, ocean, nothing to land on);
- **role:** the epoch it belongs to, the missions it poses (which physics makes them design problems), what it gives
  back (science, resources, a discovery), and the pillar it serves;
- **known at start or discovered** (PLAYTEST #11: the planets are known from epoch 1, as in reality; Nyx is found).

**Object kinds to decide on:** the star · rocky planets · a gas giant (and its moons) · an ice world · major moons ·
captured moons · dwarf planets · an asteroid belt and near-Tellus asteroids (M4's capture and mining) · comets ·
interstellar visitors (M5, generated per playthrough) · Lagrange-point trojans (Selene's L4/L5 are stable, NOTES
§ "Program design").

**Constraints it must respect:**
- Tellus's scale (a fifth of Earth, 9.81 m/s², an 8 h day, NOTES § "The planet's size"); other bodies are scaled in
  the same spirit;
- the year is Tellus's orbital period, tuned so a long probe spans about one compute era (NOTES § "Time, long
  missions");
- every orbit stable on rails (resonances and spacing; n-body stays a setting);
- **default, Caio may override:** the planets and major moons are **hand-made and the same in every world**, so content
  can be built on them; minor bodies, comets and visitors are **seeded per world** (`WSEED`), for replay variety.

**What it unblocks:** each approved body becomes a package:
- **look:** a sky & bodies session per body (several bodies, several sessions);
- **world:** its ground;
- **space:** its orbit, SOI and rails;
- **economy:** its missions and contracts;
- **QA:** a tester "go to body" cheat.

Look and ground for a body may be built **before M5** against that tester view. It's content inside systems that already
exist (ray-cast bodies, generated terrain), so the milestone gate doesn't hold it back. Heliocentric rails and the year
wait for M5.

### Design catalogs (the design desk, with Caio)

Design that only Caio can approve, written as catalogs so lanes can fan out from them. The **design desk** session
(`docs/session-roles.md`) drafts them by interviewing Caio; the orchestrator fans out the build items once he approves.
**Every design doc is listed here** (a new one adds its row); each holds the current design only, and its decisions are
lines in [`DECISIONS.md`](DECISIONS.md).

| Doc | What it settles |
|---|---|
| [`SYSTEM.md`](SYSTEM.md) | the star system: bodies, orbits, looks, roles |
| [`POWERS.md`](POWERS.md) | national flavours: schools (hardware, pads), archetypes, rivals, the commercial giant |
| [`CREW.md`](CREW.md) | astronauts: who they are, skill and qualifications, the office, how they look, suits |
| [`FACES.md`](FACES.md) | the face engine behind the crew's heads |
| [`MIDGAME.md`](MIDGAME.md) | from single flights to routines: the automation ladder, the launch rail, windows, satellites |
| [`LATE_GAME.md`](LATE_GAME.md) | the network, outposts, the tech ceiling, capstones, debris |
| [`GROUND.md`](GROUND.md) | every body's ground: generators, recipes, slices |
| [`UI.md`](UI.md) | UI hierarchy: rules and each screen's reads |
| [`BEAUTY.md`](BEAUTY.md) | the beauty pass: what's weak today, the plan B0–B6, costs |
| [`KSPISMS.md`](KSPISMS.md) | what came from KSP: kept, changed |
| [`TECH_SCOUTING.md`](TECH_SCOUTING.md) | real space tech mined for ideas |
| [`mockups/README.md`](mockups/README.md) | the mock-up pages and Caio's picks |
| [`DECISIONS.md`](DECISIONS.md) | every decision, one line each |
| Reviews: [`REVIEW-2026-10-11.md`](REVIEW-2026-10-11.md) | a whole-project review (one per milestone) |

### M3–M5 — design only for now (📝 items, any lane)

- **M3:** Selene terrain plan (Q18) · landing on a chosen crater (Q13) · rovers on real ground · crew rotation · the
  pre-flight **mission planner**, first slice (Selene windows and the free return; NOTES § "Planning before the flight").
- **M4:** steady-state vessel temperature (NOTES § "Waste heat") · depots · the datacenter · Selene ISRU · the AI compute
  era · consortia.
- **M5:** the star-centred system and the year (built from `SYSTEM.md`, above) · heliocentric rails · porkchops and the B-plane flyby solver · deep-space
  dish arrays · interstellar visitors · late propulsion and low-thrust propagation ([`TECH_SCOUTING.md`](TECH_SCOUTING.md)) ·
  PLAYTEST #11/#12.

---

## Lanes (consolidated 2026-10-08)

A lane is a scope of code and a kind of work. A lane can host two sessions at once if their items touch different
functions. The old worktrees are reused; new names are just labels in QUEUE.

**Beats: one lane, several sessions.** A lane can be split into *beats*, sub-areas whose code barely overlaps, each run
by its own session. **look & sound is always split** (Caio, 2026-10-08): it's the heaviest lane and the most splittable,
so one session on it would be the bottleneck. Its beats:

| Beat | Covers | Worktree |
|---|---|---|
| **parts & pad** | `partShape`/`partBody`, textures, flight marks, the launch complex and rig | `launchpad-visuals` |
| **effects** | plumes, plasma, vapor, dust, explosions, debris re-entry, bloom | `launchpad-aerofx` |
| **sky & bodies** | atmosphere, clouds, stars and galaxy, how each planet and moon looks (colour and light; **world** owns height and geography) | `launchpad-sky` (new, port 8802) |
| **sound** | everything in the sound block | `launchpad-sound` |

More beats as the game grows: a beat per new planet's look, or per part family. QUEUE tags each look item with its
beat; the kickoff names it ("the launchpad look & sound session, beat: effects").

Where beats do collide: `render()`'s pass order, shared shader helpers, bloom, and the numbering in `views.js`. Changing
any of them needs a line in `ACTIVE_WORK.md` for the other beats.

**The real limit is the GPU, not the code.** Look work is nearly all 🖥, and two game runs at once on one machine hang
or crash (QUEUE § Load). Several look sessions on one machine take turns through the courtesy lock. They do their
writing and reasoning while another holds it, batch their screenshots into one run (`shot.mjs` takes a list of views),
and keep runs short. Spreading look sessions across both machines doubles the real throughput.

| Lane | Was | Owns | Worktrees |
|---|---|---|---|
| **flow** | ui, career pacing | screens, navigation, HUD layout, onboarding, the player's path through a career | `launchpad-ui` |
| **economy** | economy | program, contracts, money, time model's economy side | `launchpad-economy` |
| **vehicle** | builder, control, parts side of planning | parts, the construction screen, attitude control, aero, heating, nodes | `launchpad-builder`, `launchpad-control` |
| **space** | bodies, sats, planning | bodies, orbits, registry, procedures and dispatch, docking, stations, rovers, the link | `launchpad-sats`, `launchpad-planning2` |
| **world** | terrain | the planet, sites, geography, Selene's ground | `launchpad-terrain` |
| **look & sound** | visuals, aerofx, sound | parts' look, pad, FX, sky, sound | one per beat (below) |
| **QA** | playtest, tester | the robot playtester, tester menu, TESTING/PLAYTEST upkeep, balance runs | `launchpad-playtest`, `launchpad-tester` |
| **platform** | new | file split, test speed, saves, perf, port readiness | `launchpad-platform` (new, port 8801) |

### Evergreen work (when a lane's milestone items are all taken)

These never run out. A session with nothing ready takes the top one of its lane before going to another lane.

- **flow:** walk one screen as a new player with `shot.mjs` and fix what's unclear; trim text; keyboard paths for
  every mouse action.
- **economy:** a `career.mjs` sweep with a new player profile; record the numbers in NOTES.
- **vehicle:** the long tail of NOTES open threads 1, 2 and 4 (finite burns, conduction, interference terms).
- **space:** NOTES open thread 6 (tides on debris near moons, perturbed registry satellites).
- **world:** biome detail, coasts, the cost of views.
- **look & sound:** reference views (`views.js`) that look wrong; per-engine voices; plasma crackle.
- **QA:** a driver for the next untried TESTING row; re-judge `~` rows; keep PLAYTEST priorities honest.
- **platform:** profile one hot path and remove allocations; shave seconds off the slowest test sections.

---

## Platform lane

The bottleneck for twelve parallel sessions is one 6,500-line file and an 8-minute test suite. The project's
single-file bias is relaxed for Launchpad only: **plain scripts loaded by the page (classic scripts since the split, step 4; ES modules later), still no bundler, no packages,
no build step.** GitHub Pages serves them as they are.

In order:
1. ✓ 2026-10-08 (NOTES § "Test shards": `--smoke --jobs 4` ~25 s; full suite ~5 min, ~2.5 with `--jobs 4`). **Test shards** (⚙, S): `node test.mjs --only 12,17,26` and a `--smoke` set under a minute; NOTES says which
   sections cover what. Merges still run the full suite.
2. **Save versions** (⚙, S): the program save (`launchpad-program-v1`) gets a schema version and a migration chain,
   with a test that loads an old save. Eight lanes change `PROG`'s shape; a new player's save must survive it.
3. ✓ 2026-10-08, done with the split during a freeze Caio called (all lanes merged first). **The split plan** (📝, M): which modules (`sim/*.js` for the pure SIM block, then render, ui, builder), how
   `test.mjs` loads the same files, and a **freeze window**: everyone merges to `main`, platform splits in one commit
   with a mechanical script and the full suite as the oracle, everyone merges `main` before their next edit. Caio
   picks the window.
4. ✓ 2026-10-08: **the split**. `index.html`'s script is now 21 classic scripts in `sim/` and `app/` (not ES modules: imported
   bindings are read-only, and the code reassigns shared `let`s across areas). The map and the rules are in NOTES § "The file split".
   Later, per area: ES modules once an area's cross-file names are few.
5. **Cheap wins** (Q38): world generation in a worker and cached, typed arrays and no small-array allocation in hot
   loops. Cold load is ~1.5–1.8 s today.

### Graphics budget (Caio, 2026-10-11: playability over realism, but find the best point)

What exists: adaptive resolution holds GPU time under ~7 ms (35–100 % of a 1.5×-capped DPR), GPU timer queries, the
perf readout (NOTES § v1.1); `views.js` reference scenes for before/after.
- **Targets.** 60 fps at 1080p on a mid-range discrete GPU (Caio's RTX 3050 stands in) at a resolution scale of 75 % or
  better; **30 fps on integrated graphics** (Caio's Intel iGPU) as the floor. A change that drops either, measured on
  the reference scenes, needs a reason in its NOTES entry.
- **Spend the beauty where the eye is:** the rocket and its plume at launch, the horizon and atmosphere on the climb,
  the planet from orbit, the first sight of a new body. Elsewhere the style does the work (puppet heads, paperwork,
  the pencil map): stylised looks are cheap and age well.
- **No high-end requirement** (Caio, 2026-10-11): his mid-range machine is the ceiling, not the floor. **High** is what
  runs well on it; nothing is built for hardware above it.
- **Two graphics settings, Low and High**, from the start of any costly effect: High may spend more, Low keeps the iGPU
  floor. Beauty never costs a player who can't run it.
- **The desktop app** (the long-term plan) raises the ceiling: no shader translation layer (first loads, Q169), better
  drivers, compute shaders, more memory. It moves the budget; it doesn't remove it.

---

## Documents: one home per fact (Caio, 2026-10-11; DECISIONS "DOC")

Docs drifted because one decision was written in up to four places, replaced text stayed printed, status lines were
kept by hand, and NOTES grew without order. The rules:
1. **Each kind of doc has one job.** Design catalogs (above): the design *as it is now*, edited in place. **DECISIONS.md:**
   every decision, one line, append-only. **QUEUE.md:** live work and open questions only. **NOTES:** how things were
   built, one file per area in `notes/` (NOTES.md is their index). **ROADMAP.md:** pillars, milestones, lanes, rules. **INDEX.md:** where each doc is and what it's for (no
   versions or statuses: those live in the doc's own header).
2. **One home per fact.** Elsewhere, a one-line summary and a link, never a restatement.
3. **The ripple rule.** Changing a decision: add its DECISIONS row with *Touches*, then search the docs for the old
   wording and fix or mark every hit, in the same commit.
4. **Replaced text moves to `archive/`** (archive over delete), with a one-line pointer where it was. Nothing stays
   printed next to the text that replaced it.
5. **Headers stay true:** a doc's version, date and status change with every edit; its version history gets a line.
6. **Size budgets:** a design doc under ~400 lines, QUEUE under ~300; over budget, split it. NOTES is a log, split by
   area (W37, 2026-10-11) rather than budgeted.
7. **A machine checks it** (`check_docs.mjs`, platform; QUEUE): headers vs histories, INDEX coverage, broken links,
   "waits for Qn" when Qn is done, QUEUE rows naming answered questions, sizes. It runs with `--smoke`.
8. **A review per milestone** (the 2026-10-11 review's method: milestones and blockers, pillars against the build,
   design debt and doc health), saved as `REVIEW-<date>.md` and linked above.

## Keeping the queue full (rules for the orchestrator)

1. **Refill:** when a lane has fewer than 3 `ready` items in QUEUE, move the next ones for that lane from the current
   milestone here, then the next milestone's, then 📝 items of later milestones, then the lane's evergreen list.
2. **Plan before L:** every L item enters QUEUE as a 📝 plan item first (any lane can take it); the build items follow
   the plan.
3. **Milestone gate:** code only for the current and next milestone. Later ones get 📝 items only.
4. **Finish lines move milestones:** when QA's run of a finish line passes, mark the milestone done here and promote
   the next one.
5. **Ship with a way to check it:** a new TESTING row, and a robot driver when it's cheap. Otherwise QA gets a line
   in Proposed.
6. **Next unblockers:** keep a short *Next unblockers* list at the top of QUEUE. It holds the items and decisions that
   free the most other work: count the `after` / `blocked` states pointing at each, and add the design catalogs and the
   *Waiting on Caio* answers. Caio can ask "what are the next unblockers?" and get the top three with what each frees.
7. **Defaults:** a question for Caio goes to *Waiting on Caio* **with a recommended default**. Work proceeds on the
   default, and the item is marked "default, Caio may override". A real override goes in NOTES with its consequences.
8. **Kick back to design** (Caio, 2026-10-09): when any session finds that built code, a queue item or one catalog
   **contradicts an approved catalog or a pillar in intent** (building on would make one of them false), it doesn't pick
   a side and doesn't default it. It adds a **D-item under QUEUE § design desk**: what conflicts, both sources with
   their sections, the cheapest resolutions, and a recommendation. It marks the affected items `blocked: D<n>` and
   carries on with other work. The design desk takes kick-backs before new catalogs, settles each with Caio, and
   updates the catalog; then the orchestrator unblocks. Wording drift and stale references are fixed in place, and a
   choice the catalogs leave open stays a rule-7 default. Only a contradiction of intent goes back.

---

## Defaults for the open questions

Moved to [`DECISIONS.md`](DECISIONS.md) (2026-10-11); the original table with its reasons is in [`archive/decisions-2026-10.md`](archive/decisions-2026-10.md).
