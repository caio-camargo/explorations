# Active Work Coordination

**Purpose**: Prevent concurrent edit conflicts between Claude sessions (or between you and Claude).
**Rule**: Check this file at session start. Claim your scope before working. Clear it when done.

---

## How to Use

**Before starting work:**
1. Read this file
2. Check if anything is already claimed that overlaps your intended work
3. Add your claim below with name, date, and scope
4. If there's a conflict, resolve it before proceeding

**When done:**
1. Remove your claim from the table
2. If you left anything mid-way, note it in the Unresolved section below

---

## Launchpad worktrees (2026-10-07)

Launchpad coding sessions each work in their own git worktree (outside Google Drive), on their own branch, and merge
into `main` when a slice is done. The main clone (`C:/Users/caioa/dev/explorations`, see the move note below) stays on
`main` for planning and docs. **Merging:** `git fetch`, then `node check_numbers.mjs` in `explorations/launchpad/` (renumber anything it reports: a version, TESTING/PLAYTEST row or Q/W/D item `origin/main` also took; QUEUE Q160), merge `origin/main` into your branch in your worktree and test there; then in
the main clone `git pull --ff-only`, `git merge --ff-only <branch>`, `git push origin main` (refused push = `main`
moved on the other machine: pull and repeat). Not every folder below exists on every machine; `git worktree list` in
the main clone shows this machine's.

Lanes since 2026-10-08 ([`ROADMAP.md`](explorations/launchpad/ROADMAP.md) § Lanes; work comes from
[`QUEUE.md`](explorations/launchpad/QUEUE.md)). A lane can run two sessions at once if their items touch different functions;
the folders and branches keep their old names.

| Lane | Folder | Branch | Preview port |
|---|---|---|---|
| **flow** (screens, navigation, HUD layout, onboarding) | `C:/Users/caioa/dev/launchpad-ui` | `ui` | 8795 |
| **economy** (program, contracts, money) | `C:/Users/caioa/dev/launchpad-economy` | `economy` | 8774 |
| **vehicle** (parts, construction screen, attitude, aero, heating, nodes) | `C:/Users/caioa/dev/launchpad-builder` | `builder` | 8772 |
| | `C:/Users/caioa/dev/launchpad-control` | `control` | 8796 |
| **space** (bodies, orbits, registry, procedures, docking, stations, rovers, link) | `C:/Users/caioa/dev/launchpad-sats` | `sats` | — |
| | `C:/Users/caioa/dev/launchpad-bodies` (machine `pc_de_varginha`) | `bodies` | 8777 |
| | `C:/Users/caioa/dev/launchpad-planning2` (the old `launchpad-planning` folder is a stale copy) | `planning` | 8775 |
| **world** (planet, sites, geography, Selene's ground) | `C:/Users/caioa/dev/launchpad-terrain` | `terrain` | 8773 |
| **look & sound** (part look, pad, FX, sky, sound) | `C:/Users/caioa/dev/launchpad-visuals` | `visuals` | 8776 |
| | `C:/Users/caioa/dev/launchpad-aerofx` | `aerofx` | — |
| | `C:/Users/caioa/dev/launchpad-sky` (beat sky & bodies; create on first start) | `sky` | 8802 |
| | `C:/Users/caioa/dev/launchpad-sound` | `sound` | 8798 |
| **QA** (robot playtester, tester menu, TESTING/PLAYTEST, playtest intake) | `C:/Users/caioa/dev/launchpad-playtest` | `playtest` | 8799 |
| | `C:/Users/caioa/dev/launchpad-tester` | `tester` | 8797 |
| **platform** (file split, test speed, saves, perf) | `C:/Users/caioa/dev/launchpad-platform` | `platform` | 8801 |
| *design desk* (catalogs with Caio: SYSTEM, CREW, POWERS; docs only) | the main clone | `main` | — |
| *fixes* (one-off PLAYTEST sweep, 2026-10-08) | `C:/Users/caioa/dev/launchpad-fixes` | `fixes` | 8800 |
| *orchestrator* (QUEUE.md upkeep, docs only) | `C:/Users/caioa/dev/launchpad-orchestrator` | `orchestrator` | — |
| *retired:* plumes (now look & sound) | `C:/Users/caioa/dev/launchpad-plumes` | `plumes` | 8791 |

> **For every launchpad session, 2026-10-11 (wildcard, platform lane, QUEUE Q68): `test.mjs` IS SPLIT. Merge `main` before
> adding a test.** The 171 sections moved unchanged into `explorations/launchpad/tests/<lane>.mjs` (`core` = the numbered
> suite; then `flow`, `economy`, `vehicle`, `space`, `world`, `look`, `qa`, `platform`). New sections go at the end of
> your lane's file. `node test.mjs` and every option work as before (the full run now goes through `shards.mjs` too).
> A branch with a section added to the old `test.mjs`: keep `main`'s `test.mjs` in the conflict, move your section to
> your lane's file. NOTES § "Test shards".

> **For every launchpad session, 2026-10-11 (design desk, in the window Caio called, W37): `NOTES.md` IS SPLIT.** The
> build log is now `explorations/launchpad/notes/<area>.md` (foundations, vehicle, space, economy, world, flow, look,
> platform), oldest first; `NOTES.md` is the index of every section. **Add your section at the bottom of your lane's
> file** and its heading as one line in the index. Versions are still one series: `node check_numbers.mjs` reads all
> the files. A branch from before the split: in the conflict keep `main`'s `NOTES.md`, then move your new sections
> (and any lines you added inside an old section) into the area file that holds it. **Economy:** your Q188 branch has
> `## v1.128 — rivals as programs` and a `### Q188 amendment` inside "Plan: rivals as programs": both go to
> `notes/economy.md` (and v1.128 is taken: renumber).

> **For every launchpad session, 2026-10-08 (control session, at Caio's request): `explorations/launchpad/TESTING.md`.** Caio
> can't playtest for now, so this lists what nobody has played yet: 107 rows by area (try this / how to get there / looks right
> if / owner). **When you ship something a person should try, add a row** (next free number, your session as owner) in the
> same commit as your NOTES section, and fix rows your changes make wrong. Problems found go to PLAYTEST.md.

> **For every launchpad session, 2026-10-08 (platform, in the freeze Caio called): `index.html` IS SPLIT. Merge `main`
> before your next edit.** Its script is now 21 classic scripts: `explorations/launchpad/sim/*.js` (the pure SIM) and `app/*.js`
> (render, UI), loaded in order by `index.html`. Same code, same order, cut at the existing section headers. Find your code
> with `grep -n "function name" sim/*.js app/*.js`. The map (file → what's in it → usual lane) and the rules are in launchpad
> NOTES § "The file split". In short:
> (1) code that runs at load time may only call functions from its own or an earlier file;
> (2) a new file needs its `<script>` line in `index.html` and `'use strict'`. Test `platform-1` checks both.
> Node tools read the page through `page.mjs` (`pageSource()`), never `readFileSync('index.html')`.
> Tests: `node test.mjs --smoke --jobs 4` (~25 s) while working; `--only <label|#n|word>` for your area; the full
> `node test.mjs` before merging (NOTES § "Test shards"). Also merged into `main` for the split: economy v1.53, terrain v1.52 +
> Q17, and bodies Q13 (pushed during the freeze, re-split into `sim/procedures.js`). TESTING rows renumbered: atlas → 123–124,
> bodies' landing → 125.

> **For every launchpad session, 2026-10-08 (orchestrator, at Caio's request): pick your work from
> [`explorations/launchpad/QUEUE.md`](explorations/launchpad/QUEUE.md).** Top `ready` item in your lane, or overflow; mark it
> taken there and push, then claim here as usual. Follow-ups go under its *Proposed* section. Before running the game in
> Chrome, check the courtesy lock `C:/Users/caioa/dev/.game-busy` (QUEUE.md § Load): two game runs at once hang or crash.

> **Heads-up, 2026-10-07 (planning): the planet was rescaled on `main` (`ae0fd7b`). Merge `main` before your next slice.**
> Tellus is now 1,274 km (a fifth of Earth), 9.81 m/s², an 8 h day (`DAY_S` follows the rotation), 100 km of air (scale
> height 7.5 km); Selene is 348 km at 38,440 km. Heating gain ×3 → ×1. Lunar, Big Lunar and Passenger presets resized.
> Tests now use `LEO` / `ATM` / `VENT` from the planet instead of 600 km literals: use them in new checks. **Terrain:**
> your baked map's texels double in km, and anything tuned in metres on the old radius needs a look. Details:
> launchpad NOTES, "The planet's size".

Snapshot of the Drive folder's uncommitted work at the switch (builder + terrain hunks mixed in `index.html`/`test.mjs`,
plus `builder.js`): `C:/Users/caioa/dev/handoff/`. Each session moves its own hunks to its worktree, commits there,
then removes them from the Drive folder.

> **2026-10-07, economy session — worktree registry restored.** `.git/worktrees/` had been emptied (most likely git on
> another machine that shares this Drive repo and can't see `C:/Users/caioa/dev`, so it treated every worktree as
> missing). Re-registered on their branches with no changes to their files: `launchpad-builder` (builder),
> `launchpad-terrain` (terrain), `launchpad-visuals` (visuals), `launchpad-economy` (economy). Each folder's index was
> rebuilt from its branch tip; all were clean. The old `launchpad-planning` folder is registered **detached** at `da4c1a3`
> (planning now lives in `launchpad-planning2`); it's a clean, stale copy and can be removed. `launchpad-plumes` is
> registered but its folder isn't on this machine: left alone. **On any machine that can't see these folders: never
> run `git worktree prune`.**

> **Economy, 2026-10-07 (v1.29 know-how): one cross-scope line in `stage()`.** Before marking a segment ignited it asks
> `igniteOK(s, k)` (economy's know-how: an unfamiliar engine can fail to light; a failed pure-ignition event rolls back
> `evIdx` so it can be retried). It only acts once a program has started (`khOn()`), so plain physics and the physics tests
> are unaffected. Builder / staging and bodies sessions: keep the call if you rework `stage()`.
> **Economy → UI session, 2026-10-08:** the Program panel's economy sections for your tabs: `contractsHTML()`,
> `ownershipHTML()`, `facilitiesHTML()` are self-contained functions; Know-how, Production, Test stand and Development
> are inline blocks in `renderProgram` (each starts with `{const …` and appends to `html`). Move them freely; buttons
> work through `data-*` attributes and the document click handler (`ds.start/dk/line/stand/test/dev/fac`).
> The Drive repo now has `gc.worktreePruneExpire = never` (set 2026-10-07 at Caio's request), so git's automatic cleanup
> won't remove worktrees any more. An explicit `git worktree prune` still would.

> **Economy → planning, sats, builder, bodies (2026-10-08): design only, nothing built.** Launchpad NOTES has a new
> section, "Rich programs: projects, waste heat and routine runs", with a "Compute — a resource across eras" part.
> It has proposed owners per piece:
> - **planning:** compute gating of tools and prediction precision, with eras driven by the world date (with nudges)
>   instead of milestones;
> - **builder:** radiator, panel and onboard-computer parts;
> - **sats:** depots;
> - **bodies:** Selene and heliocentric projects.
> Read it before building anything in those areas. Nothing is claimed yet.

> **2026-10-07, bodies session: Drive repo object repaired.** Google Drive renamed the loose object of commit `d28aa2d` (an aerofx merge in `main`'s history) to `.git/objects/d2/8aa2d….corrupt-`, so fetches from the Drive repo failed ("possible repository corruption"). `git fsck --connectivity-only` showed it was the only missing object; it was re-written from the bodies clone's intact copy (same hash, additive) and fsck is clean. The `.corrupt-` file is left in place. If a fetch or merge ever says an object can't be read, run that fsck first and restore from any clone or worktree that has it.

> **2026-10-08 — PAUSE OVER: the repo has left Google Drive (step 8 done 2026-10-08).** Work from
> `C:/Users/caioa/dev/explorations` and its worktrees, never from the Drive folder. **Pull before reading this file;
> commit and push your claim.** Step 6 done 2026-10-08 (tester session): the Drive folder is frozen, with no `.git` and a
> `MOVED.md`; its repo data is at `C:/Users/caioa/dev/_backup/drive-git-2026-10-08` on the first machine. The move is complete.
> ~~PAUSE ON: the repo is leaving Google Drive now (replaces the 2026-10-07 visuals plan). No work in the
> Drive folder or the worktrees until this note says done.~~ Runbook: [`docs/leaving-drive.md`](docs/leaving-drive.md),
> script `docs/leaving-drive.sh`. New home on each machine: `C:/Users/caioa/dev/explorations` (its own `.git`, synced
> through GitHub); worktrees stay where they are and are re-pointed. **When the pause is called:** commit your work in
> your worktree, merge into `main` the usual way, clear your claim, stop. Afterwards claims and shared docs travel by
> push/pull (runbook § "After the move").


> Archived 2026-11-10 (review R24): clearing notes from before 2026-11-03 moved to [`archive/active-work-cleared-2026-11.md`](archive/active-work-cleared-2026-11.md). Claim rows are untouched.

## Currently Active

| Operator | Started | Scope | Files at risk |
|----------|---------|-------|---------------|
| Caio + Claude (platform, Opus) | 2026-11-11 | **R10** a bad save must not brick the page: `raceSchedule()`/`ensureBoard()` inside the try, a backup of an unparsable save, quota errors surfaced, a two-tab guard. Worktree `launchpad-r10`, branch `r10` | `app/state.js` (load/save), `tests/platform.mjs` |
| Caio + Claude (economy, Opus) | 2026-11-11 | **R15** the government top-up mid-flight; a funds gate at launch in the sim. Worktree `launchpad-r15`, branch `r15` | `sim/contracts.js` (`floorCheck`, `econTick`), `sim/program.js` (launch debit), `tests/economy.mjs` |
| Caio + Claude (faces, Fable) | 2026-11-10 | **The 3D face creator, diagnosed and rebuilt** (Caio's ask; the parked D12 face engine, not the ligne-claire head). A new lab beside the old one: one subdivided control cage instead of glued SDF solids. Worktree `launchpad-faces`, branch `faces`. The old lab stays untouched | `explorations/launchpad/mockups/faces2/` (new), `mockups/README.md` § faces, `FACES.md` (a diagnosis section). Reads `intake/` (never commits it) |
| Caio + Claude (look & sound, parts & pad) | 2026-11-10 | **Q565** the solar wing's surface (cell texture for `wpanel`, `bpanel`). Worktree `launchpad-visuals`, branch `visuals`, port 8776 | `app/gl.js` (MESH_FS: a new kind branch; `wpanel`/`bpanel` cases; `KIND`), `tests/look.mjs` |
| Caio + Claude (look & sound, astronauts) | 2026-11-07 | **Idle.** Q535 ✓ v1.268 on `main` (the game's suits on the EVA lab's walker). **Space session:** `eva-lab.html` gained a script before yours (`pv`/`tube`/`lathe` for crew-look), `app/crew-look.js`, `buildRig`/`drawSuit` after `figure()`, and a Suit/person picker in `panel()`; `figure()` draws `drawSuit(o,J)` unless the box figure is picked. Your pose code is untouched: keep `J`'s fields (hip, sh, tu, R, F, hips, knees, feet, shs, elb, hands) and `drawSuit` follows. `aerofx-50` reads `legIK…lerpJ` and `SUIT_SCH…prints` from the lab. **Everyone:** `crewFigure` returns `o.rig` (standing skeleton, `pins`) | — |
| Caio + Claude (launchpad space session, EVA) | 2026-11-06 | **Q531 EVA E0**: E0a ✓ **v1.263, v1.265, v1.266 on `main`** (v1.266: no invisible walls, footholds, sliding); E0b rough ground ✓ **v1.267 on `main`** (rubble lane, crater, loose/firm banks, rock walls, scrambling; Shift speeds up at once) (v1.265 = Caio's first feel pass: turning, foot strike, jump/lope legs, falls and getting up) (`eva-lab.html`, `sim/eva.js`; open `index.html?eva-lab`). **Next:** the rest of E0b (stairs, ladder, gaps, mocks); Caio's feel pass on rough ground welcome. Worktree `launchpad-sats`, branch `sats` = main. **Everyone:** `sim/eva.js` is in the SIM block with one global `EVA`; E1 (Q533) builds on it | `sim/eva.js`, `eva-lab.html`, `tests/space.mjs` (space-33+), notes/space.md |
| Caio + Claude (launchpad vehicle session) | 2026-11-11 | **R21** the drag cache goes stale at fairing jettison and bay doors (`dragTable`, `sim/flight.js:687`): key it on each part's outline, not the part count. Worktree `launchpad-builder`, branch `vehicle` (= main at start; v1.247/v1.248 already on main) | `sim/flight.js` (`dragTable`), `tests/vehicle.mjs` (vehicle-41), `test.mjs` api list |
| Caio + Claude (world session, machine `Charlinho`) | 2026-10-31 | **Idle.** Q494 ✓ v1.251 on `main` (Selene's craters vary). **Sky & bodies:** `cratG(p,s)` takes the cell's size in `uNdt` (the body's simple → complex size, set in `drawMoons`), and `CM` is −.0022; its profile is `crProf`, which must stay equal to sim/ground.js's `craterProf` (test ground-10 reads the GLSL). Q19 still parked on branch `terrain` (pushed, needs the quiet-machine A/B). Worktree `launchpad-terrain2`, branch `terrain2` = main, free | — |
> Cleared 2026-11-10: generic worker, **v1.300 R14** on `main`: a dispatch's contract settles on `{...recNew(), orb, dv, dispatched}`. **Everyone:** a new `CT` check may read any `recNew()` field on a dispatched flight; test `econ-35`. Worktree `launchpad-r14` removed.
> Cleared 2026-11-10: generic worker, **v1.299 Q202** on `main`: the Hopper and the Beeper presets carry two fin rings (Rollout stable). **Everyone:** test `vehicle-40` fails if any preset rolls out unstable; the Beeper leaves 1,468 m/s in orbit (vehicle-39's pin). Worktree `launchpad-q202` removed.
> Cleared 2026-11-10: review fixes (Opus), **v1.296 R1c** on `main`: `progJSON()`/`progRestore(j)` (sim/program.js) are the only way to save or snapshot `PROG`. **Everyone:** don't `JSON.stringify(PROG)` or `jclone(PROG)` (test platform-6 fails); in tester mode the save names any value JSON would lose (R16's `sel.core.hi` Infinity is the known one). Worktree `launchpad-review` / branch `review` = main, free.

> Cleared 2026-11-10: look & sound (parts & pad), **v1.294 Q565** on `main`: the solar wing's cells. **Everyone:** `rboxUV` (app/gl.js) draws a box with kind `SOLAR_K` = 17 and panel-local metres in the u/v slots; don't give a part kind 17. **v1.297:** `DEP_S.wing` is 6 s (was 4); **vehicle**, your branch moved `DEP_S` into sim/flight.js: keep 6 when you merge. Worktree `launchpad-visuals` / branch `visuals` = main, free.
> Cleared 2026-11-10: review fixes (Opus), **v1.293 R1b** on `main`: `programNew(set)` (sim/program.js) is the one reset: `resetProgram` and `career.mjs` call it; nothing from the old career survives (R17 ✓). **Everyone:** don't reset `PROG` by hand (no field lists); **economy:** `career.mjs` numbers moved (rows independent now; new baseline in notes/economy.md). Worktree `launchpad-review` / branch `review` = main, free.

> Cleared 2026-11-10: review fixes (Opus), **v1.292 R1a** on `main`: `PROG_SCHEMA` + `progFresh` in sim/program.js (no behaviour change). **Everyone: a new `PROG` field needs a row in `PROG_SCHEMA`** (default, keep, why), or test platform-6 fails; a `PROG.x||<literal>` read must use the row's default. Worktree `launchpad-review` / branch `review` = main, free.

> Cleared 2026-11-08: flow session (transitions), **Q555 mock-up** on `main` (no game code): `mockups/transitions/` for Caio to try. **Look & sound:** its sounds are Web Audio stand-ins (door, paper, thump, press, rumble, dawn) to replace when the build lands.
> Cleared 2026-11-09: review fixes (Opus), **v1.289 R4** on `main`: five lines a `//` comment had swallowed, split back out. **Everyone:** the Inbox badge shows again (`progInbox`), the active SAS mode button is lit, Erebus's blade mask `B` is baked (ground-7 checks it). Worktree `launchpad-review` / branch `review` = main, free.

| Caio + Claude (launchpad test bench, machine `PC_de_Varginha`, shared, not the quiet second computer) | 2026-10-13 | **STALE** (orchestrator 2026-10-14 02:05: last commit 15:47; free to reclaim, resume the work where it sits). QA lane, **test bench** loop (`docs/session-roles.md` § Test bench): guard `main` from v1.180 (`--smoke`, `playtest.mjs m1`), Q358, Q359, Q215, Q233, then the robot pass over untried TESTING rows. **Timing A/Bs (Q19, Q349, Q373) wait for a quiet machine.** No game code. Respects `.game-busy`.  **Guarded: v1.180 ✓** (`--smoke` all passed 1m42 s, `m1` ok 49 s). Q358 rechecked (still so), Q359 → PLAYTEST #93, Q215 → PLAYTEST #94, **fixed** (`PT.Wpos`). **Q233 ✓**: robot row `m2` (M2's finish line) → PLAYTEST #102–#105. Worktree `C:/Users/caioa/dev/launchpad-testbench` (branch `testbench`, port 8811). Timing A/Bs done: **Q19 passed** (world merges `q19-hdr`), Q349 ✓, Q373 ✓ (NOTES platform § "Test bench timings"). TESTING robot pass: ~90 rows judged, 161–295 mostly done (PLAYTEST #112–#118 filed); left: rows under 160 and the hard ones (sound, debris, flights by hand). | `TESTING.md`, `PLAYTEST.md`, QUEUE item states and *Proposed* lines |
| Caio + Claude (world session) | 2026-10-17 | **STALE** (orchestrator 18:05: Q19 ported on `terrain` 14:18, not merged; pad-view A/B pending; both branches took v1.228; free to reclaim, merge from the branch). Launchpad **Q19**: merge `q19-hdr` (the terrain G-buffer pass PTERR) onto today's `main`, with Q105's `uPadK`/`ub`/`m = 1` and Q445's march changes; **Where it sits (14:25):** ported on branch `terrain` (pushed; merged with main at v1.227); `--smoke` passes but the two flagged checks; new test `terr-1`. A/B vs main: timing level or faster; pixels identical on every still view **except the pad views, whose round compared against a main that moved mid-run (v1.227)**: re-run views 1, 15–17, 116–119, 145–151 on the same base, then merge as v1.228. Last run stopped for low memory (<1 GB free). Then Q251 + Q365 (the stale 2026-10-13 WIP is saved on branch `q251-wip`, `3eeaf8d`). Worktree `launchpad-terrain`, port 8773 | `app/gl.js` (SKY_FS main, march, PDEPTH/PTERR), `app/render.js` (sky passes), `tests/world.mjs` |
| Caio + Claude (economy session) | 2026-10-13 | **STALE** (orchestrator 16:35: claimed 10:27, no commit on `economy` since 03:16; free to reclaim; economy-2 is the live economy session). Launchpad **Q296** satellite aging without the nag (D17.5) | `sim/program.js` (obsTick, Fleet line), `app/program-ui.js`, `tests/economy.mjs` (econ-11) |
| Caio + Claude (look & sound, sky & bodies, 2nd session, `launchpad-sky2`) | 2026-10-13 | **STALE** (orchestrator 2026-10-14 02:05: wip on `sky2`, last commit 22:17; free to reclaim, resume the work where it sits). (reclaimed 22:16 after the stale mark: wip on `sky2`, stills pending) Launchpad **Q364**: the sea draws the swell the SIM heaves craft on (`SEA_SWELL`, `seaPose`), a foam patch and a dye marker where a craft came down. Branch `sky2`. Touches the sea shading in `SKY_FS` main and `tellus()`'s sea, `app/render.js` (splash uniforms). **World:** your sea; `seaPose` read only. | `app/gl.js`, `app/render.js`, `views.js`, `tests/look.mjs` |
| Caio + Claude (look & sound, effects beat, 2nd session) | 2026-10-18 | **Idle.** Q447 ✓ v1.232 (villages and the site's town lit at night). **Everyone:** the night term in `SKY_FS` main now adds `NIGHT_VIL × gLit`, a shader global any ground painter can add lamps to (`lampPools`); reset in main before `tellus`. Worktree `C:/Users/caioa/dev/launchpad-aerofx`, branch `aerofx`. | — |
| Caio + Claude (look & sound, heads → faces) | 2026-10-10 | **STALE** (orchestrator 2026-10-11 23:45: no commit since 2026-10-10 22:59 (Q234 pass 4); Caio: free to reclaim. A new look & sound session replaces this row). Launchpad **Q220 puppet rounds 4–5**, then **D12 face lab F0–F1** (FACES.md § 4: round 5's head as genes, sliders, DNA, breeding grid). Worktree `launchpad-visuals`, branch `visuals`. | `explorations/launchpad/mockups/heads/`, `mockups/faces/` (new), `mockups/README.md` § heads/faces, `FACES.md` (status lines). Reads `intake/` (never commits it: copyrighted refs, public repo) |
| Caio + Claude (vehicle session, unattended) | 2026-10-09 | Launchpad **QUEUE Q152**: a Selene Lander preset (the Probe with legs) flown to a Selene site by its procedure, legs down by themselves. Worktree `launchpad-builder`.  **PARKED** (memory): built and committed on `builder` (`vehicle-10` passes: lands 5 m off at 1.2 m/s, legs down), not merged; its full-suite run was stopped by the machine running low on memory. Resume: run `node test.mjs` in the worktree, then merge. | `sim/vessel.js` `PRESETS`; a check appended to `test.mjs` |
| Caio + Claude (orchestrator session, machine `PC_de_Varginha`) | 2026-10-08 (resumed 2026-10-10; new session 2026-10-12; **new session 2026-11-11, main clone on `main`**) | Launchpad **work queue**: keeps `explorations/launchpad/QUEUE.md` current (~30 min refresh), hands out kickoff lines. Pushes coordination docs only; never merges or pushes code. Works in the main clone on `main` (no `launchpad-orchestrator` worktree on this machine) | `explorations/launchpad/QUEUE.md` (sessions may change their own item's state and append under *Proposed*) |
| Caio + Claude | 2026-08-11 | Landing page rebuild (live-preview cards) for custom-domain launch | `index.html` (ROOT landing page), `README.md` |
| Caio + Claude (economy session) | 2026-10-07 | Launchpad program/economy. RESUMED 2026-10-08 in worktree `launchpad-economy` (branch `economy`, port 8774); handoff [`HANDOFF-economy.md`](explorations/launchpad/HANDOFF-economy.md). Latest: v1.47 dispatch, v1.50 deviation handover. NOW: the bodies session's nyxfind/selimp balance note (Nyx/Selene mission completion and payouts). | `MISSIONS` entries for selimp/nyxfind and their completion checks; `career.mjs`; owns the SIM program block (missions, contracts, industry, facilities, compute, timeline, staged pay, dispatch) |
| Caio + Claude (visuals session) | 2026-10-07 | Launchpad visuals. Slice 1 (early-era part look) MERGED to `main` (`bee8d79`, docs `40f3ab1`). Slices 2 (flight marks) and 3 (launch complex) MERGED to `main` (`b3ea9f0`, log `2fd14dd`). Pad revisions, animation (gantry roll, arm swing, hold-downs) and floodlights also MERGED and pushed (`a90aa3d`). The rig and lights follow `curSite()` in its `siteFrame`. Idle between slices; backlog: liveries. **Note for terrain:** I only change the CONTENTS of the `PAD` mesh (`const PAD=…`, pad-local frame, everything at or above y=0, buildings kept on your ground-shader slabs at (36,18), (−45,−25), (20,−30)). I am NOT touching the `drawMesh(PAD,…)` call, `uPadL`, `siteH` or `padGround`. Your `siteH` change to the draw transform should merge cleanly. Worktree `launchpad-visuals` / branch `visuals`, port 8776. Render-only: reads SIM state (skin temps, burns, fuel), keeps mark state render-side **(2026-10-08: aerofx is working on PLAYTEST #2/#3/#4 in your pad/marks/floodlight code; see its row.)** **(2026-10-09: aerofx is doing the design pass on hab/lab/bay/arm/rover meshes, Caio's call; see its row.)** | in `launchpad/index.html`: `MESH_VS`/`MESH_FS`, the mesh helpers (`lathe`, `box`/`rbox`, palette `C`), `partShape`, `partsMesh`. Additive in `partShape` (planning may add parts there); will re-check the builder's editor view after each change. Not touching assemble/PRESETS/editor UI, economy, terrain/sky shaders. |
| Caio + Claude (flow session) | 2026-10-07 (resumed 2026-10-09; again 2026-10-11, 2026-10-12 23:30) | **Idle 2026-10-31.** Q482 v1.250 done (**everyone:** `turnGuide`'s climb ◇ keeps q·α under `GUIDE_QA` = 36 kPa·° of the surface prograde, faded in over Mach 2.5–3 (`GUIDE_M`); a test that flies the raw `ascentPitch` past Mach 2.5 sees the ◇ off the nose by design). Q476 v1.240 done (**everyone:** `LEVELS`, `lvl()`, `lvlKey()` in sim/core.js; the career's level is `PROG.lvl`, absent = Normal; `engineMdot` and every thrust line read `lvl().isp`, `aeroPass` the body's air at `lvl().air`, `igniteOK` `lvl().fail`, `acceptOffer` `lvl().due`, `pilotMargin` `lvl().pilot`, `revertOK()` (app/state.js) `lvl().revert`; tapes carry `tapeV()` (TAPE_V + `:easy`/`:hard`), `studyKey` `@easy`/`@hard`, logbook entries `lvl`; `setLevel(k)` in app/settings.js; `study_pilot.mjs -l=easy`). Before: idle. Q434–Q436 v1.234–v1.236 done (**everyone:** `ascentPitch(b,h)` and `turnGuide(s)` in sim/flight.js are the standard ascent and the navball's ◇; `speedRef` blends surface → orbit over `navBand` and returns `w`, `s.navRef` holds a frame and rides the tape as `controls().ref`; `velFrame(s)` (sim/vessel.js) is what the SAS's velocity modes hold; **`speedRef`, `sasTarget`, `velFrame` are in TAPE_V: older tapes replay stale**; `SAS_MARK`/`sasIcon` in app/render.js draw every SAS mode's mark, for Q477). Earlier: Q444 v1.233 done (**everyone:** range safety's verdict is `rangeVerdict(site,b,pf)` in sim/world.js: a site's own support town counts only when the impact is over it; drops still use `dropVerdict`). Q415 v1.230 done (**everyone:** `routeCtl(r)` draws a route's state and controls; the Fleet tab's *Routines with nothing up*, `routesBareHTML`). Q438 + Q432 done (`ae6b11c`: smoke green; Help's T row on the Design table; two source scans follow Q420 and Q368). Q384 v1.224 done (hover terms: `TERMS` in app/terms.js; `termTipHTML(el)`; touch taps). Done 2026-10-13: Q340 v1.179, Q293 v1.182, Q286 v1.186 + v1.189, Q391 v1.192, Q400 v1.199, Q405 v1.202, Q271 v1.208 (**everyone:** H and L bars by the navball, `hlGauges()` in `app/cockpit.js`; a new red condition goes in `cautions()`), Q277 v1.216 (`modelScaleHTML()` in `app/model-desk.js`, in `#hqStrip`). Next for flow: the queue's next flow item | `app/*.js` screen/overlay code (`screenNow`, `go`, `KEYS`, `renderHelp`, `renderEsc`, `progLayout`, `flightLeave`, the shared keydown), a new debrief screen + its CSS in `index.html`; `missionEnd` gets one call to record the summary (economy: additive only); new checks appended to `test.mjs`. Formerly: `launchpad/index.html` screen/overlay block (`screenNow`, `go`, `KEYS`, `renderHelp`, `renderEsc`, `progLayout`, the shared keydown), the DOM skeleton and CSS of panels |
| Caio + Claude (bodies session, machine `pc_de_varginha`) | 2026-10-07 | Launchpad: more bodies. Body tree + Nyx MERGED (`61ff6a1`); 6b perturbations near Nyx MERGED (`cba2d3e`). Selene perturber + per-orbit gating + nodes MERGED (`60b1b7b`). "Out there" missions (epochs 4–5) MERGED (`9b191b3`); epoch 3 utility missions MERGED; crew + escape tower + abort tests + crewed Selene missions MERGED (`9c821b3`); Crewed Lunar flown end to end MERGED; **procedures** (automation that adapts) + tape fingerprint MERGED (`e0d79ba`); **procedures v2, whole missions** MERGED; Nyx missions + flyby/free-return procedures MERGED; free returns aimed at the way home + debris tides MERGED (`e2d3807`); **the Selene and Nyx ladders flown from the pad by procedure** (Probe and Sample Return presets, transfer options side/sunFar/retro, the tide in the trim, deorbit before landing) MERGED; **dispatch flown, not rolled** (Q11: `dispatchRun`, `procFly`, deviations `procDev`, dry runs `procAdopt`) MERGED. Idle. **For economy:** dry runs need your study button and price, and a wider estimate for `prov` procedures (NOTES § "Dispatch, the physics side"). nyxfind completes for free on a Selene flight, and selimp/nyxfind pay less than a Probe costs (launchpad NOTES § "The ladders, proven with real rockets"). **For sats/economy:** registered satellites ride pure Kepler; under the moons' tides a stationary one drifts 10,750 km in 30 days, so tides in the registry need a station-keeping/lifetime mechanic (launchpad NOTES, "Registered satellites still ride pure Kepler"). **For economy: dispatch is yours to design with Caio**, brief and six questions in launchpad NOTES § "Procedures: automation that adapts, and a dispatch brief" (part 3). Also: your timeline check (§35) now deals a fresh board if the inherited one is empty; it had depended on the business cycle earlier sections left behind. **For plumes:** the escape tower (`les`) fires during `s.lesT>0` with no plume yet. **For visuals:** `partBody` has new cases `les` and `crew` (crew draws as the pod). **For sats/builder:** Backspace = abort; tape op `A`. **For economy:** `missionEval`'s payout is now `missionComplete(M,rec)` (same behaviour), and `worldTick` ends with `utilTick(d)` (TV income, world missions). Mission content for later epochs gets built here (Caio's call). **For economy:** additive only: new entries appended to `MISSIONS` (ep 4–5), new `R` fields, one `outThere()` call at the end of `missionTick`, new `LOGF` facts in "Out there", `renderProgram` epoch labels; `RACE` untouched. **For economy:** Nyx missions spec in launchpad NOTES § "Nyx missions — spec" (yours to build; I touched one of your checks: satellite precision now tolerates 1e-3 M, the tides nudge test orbits). **For sats:** craft now feel the moons' tides (low orbit drifts metres a month); `satAt` is still pure Kepler. **Repo:** `receive.autogc=false` set in the Drive repo (pushes from this machine could auto-prune worktrees it can't see). **Note for planning:** your era map's body loop now iterates `BODIES` (Nyx gets drawn); new perturbation code is `pertAcc`/`coastPlan`/`coastStep` near `soiAt`. Local clone `C:/Users/caioa/dev/launchpad-bodies`, branch `bodies` (= main), port 8777. **Anyone on this machine:** do NOT `git worktree prune`, the 'prunable' worktrees are live on the other machine | when active: in `launchpad/index.html` SIM, the body tree (`addBody`, `bodyRel`, `soiAt`, `NYX`), `checkSOI`, rails step limits, `predictFrom`/`escTime`; render `MOON_FS`/`drawMoons` and the map's body loops. **For all:** iterate `BODIES` instead of naming `SELENE`; use `soiAt(b,t)`, not `b.soi` (Nyx's SOI breathes; `b.soi` is its max) |
| Caio + Claude (control session) | 2026-10-08 | Launchpad attitude control. v1.40/v1.43/v1.46 pushed; **v1.51 spin stabilisation** MERGED to `main` (`2ae61aa`, not pushed): Euler's gyroscopic term in `integrateRot` (RK4 substeps, exact attitude step), `spin` part (spin-up motors, `spinFire` from `stage`), `s.spun` (SAS leaves the roll), spin kept through warp, HUD *Spin* row. **v1.51.1** MERGED (`0c2e701`): PLAYTEST #18 (wheels won't turn a vessel past `WHEEL_W` = 1 / 3 / 1 rad/s) and #23 (builder wording). Idle. Worktree `launchpad-control` / branch `control`, port 8796 | when active: `integrateRot`, `ctrlAccel`, `wheelGive`, `controlReport`/`controlHTML`, `AV`; test.mjs sections `control-1`..`control-4` |

---

## Unresolved (mid-flight work from interrupted sessions)

*Nothing currently unresolved.*

