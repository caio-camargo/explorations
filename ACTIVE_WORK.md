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
`main` for planning and docs. **Merging:** `git fetch`, then `node check_numbers.mjs` in `explorations/launchpad/` (renumber anything it reports: a version, TESTING/PLAYTEST row or Q/W/D item `origin/main` also took; QUEUE Q160), merge `origin/main` into your branch in your worktree, run `node test.mjs --smoke --jobs 4` there, then **push the branch and wait for CI's full run** (`gh run watch`, or `gh run list --branch <branch>`; `.github/workflows/launchpad-tests.yml` runs `check_numbers.mjs` and the full `node test.mjs` on every push, since 2026-11-11: no full run on the shared machine); green, then in
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
| Caio + Claude (orchestrator, machine of the worker branches; not orchestrating: `PC_de_Varginha` keeps the queue) | 2026-11-12 | **Landing the playtest-fix worker branches**, one at a time (merge main in, renumber, smoke, merge, push): **Q544** `origin/q544-retrograde-near-ground` → **Q543+Q546** `origin/q543-q546-dust-and-terminal-night` → **Q545** `origin/q545-thrust-on-the-ground`. Q550 stays parked (W53). Worktrees `.claude/worktrees/agent-*` | `app/` SAS, plume dust, era maps, ground contact; notes/*.md version headers, TESTING rows |
| Caio + Claude (launchpad session, Opus 5.5) | 2026-11-12 | Merges and finishes, in order: **momentum3** (v1.324) → **R5** (CI red on `r5`, the shared map) → **R28** (`vehicle`) → **R22**'s 4th fix (`r22-detach`, the long scripted flights made robust) → **R29 + R29b** (reload/Revert from a flight from orbit, by level) → docs cleanup (Q592, stale rows here, Q604). Worktrees `launchpad-momentum`, `launchpad-r5`, `launchpad-builder`, `launchpad-r22d`, a new `launchpad-r29` | `tests/*.mjs` (shared world map), `app/builder.js`, `sim/vessel.js` (`detach`), scripted flights (Q383, procedures v2, Nyx ladder), `app/state.js` (revert/reload), `sim/core.js` (`LEVELS` text), `DECISIONS.md`, `QUEUE.md`, `TESTING.md` |
| Caio + Claude (platform, Opus) | 2026-11-12 | **R5** smoke back to its budget: `SLOW` in `shards.mjs` refreshed from measured times, the documented times fixed, an economy section kept in smoke. Branch `r5`, worktree `launchpad-r5` | `shards.mjs`, `test.mjs` (docs only), `NOTES.md`/notes § Test shards |
| Caio + Claude (platform, Opus, R3) | 2026-11-12 | **R3**: a lint section in `--smoke` (swallowed code after `//`, `no-undef` across the classic scripts' shared scope, unset shader uniforms); fixes what it finds (R25's five lines) or lists them. Branch `r3`, worktree `launchpad-r3`. Not touching `shards.mjs` (R5's) | `tests/platform.mjs` (a new section), `views.js:78`, `tests/core.mjs` (four restores), a new lint script |
| Caio + Claude (faces, Fable) | 2026-11-10 | **The 3D face creator, diagnosed and rebuilt** (Caio's ask; the parked D12 face engine, not the ligne-claire head). A new lab beside the old one: one subdivided control cage instead of glued SDF solids. Worktree `launchpad-faces`, branch `faces`. The old lab stays untouched | `explorations/launchpad/mockups/faces2/` (new), `mockups/README.md` § faces, `FACES.md` (a diagnosis section). Reads `intake/` (never commits it) |
| Caio + Claude (look & sound, astronauts) | 2026-11-07 | **Idle.** Q535 ✓ v1.268 on `main` (the game's suits on the EVA lab's walker). **Space session:** `eva-lab.html` gained a script before yours (`pv`/`tube`/`lathe` for crew-look), `app/crew-look.js`, `buildRig`/`drawSuit` after `figure()`, and a Suit/person picker in `panel()`; `figure()` draws `drawSuit(o,J)` unless the box figure is picked. Your pose code is untouched: keep `J`'s fields (hip, sh, tu, R, F, hips, knees, feet, shs, elb, hands) and `drawSuit` follows. `aerofx-50` reads `legIK…lerpJ` and `SUIT_SCH…prints` from the lab. **Everyone:** `crewFigure` returns `o.rig` (standing skeleton, `pins`) | — |
| Caio + Claude (launchpad space session, EVA) | 2026-11-06 | **Q531 EVA E0**: E0a ✓ **v1.263, v1.265, v1.266 on `main`** (v1.266: no invisible walls, footholds, sliding); E0b rough ground ✓ **v1.267 on `main`** (rubble lane, crater, loose/firm banks, rock walls, scrambling; Shift speeds up at once) (v1.265 = Caio's first feel pass: turning, foot strike, jump/lope legs, falls and getting up) (`eva-lab.html`, `sim/eva.js`; open `index.html?eva-lab`). **Next:** the rest of E0b (stairs, ladder, gaps, mocks); Caio's feel pass on rough ground welcome. Worktree `launchpad-sats`, branch `sats` = main. **Everyone:** `sim/eva.js` is in the SIM block with one global `EVA`; E1 (Q533) builds on it | `sim/eva.js`, `eva-lab.html`, `tests/space.mjs` (space-33+), notes/space.md |
| Caio + Claude (launchpad vehicle session) | 2026-11-12 | **R28**: the builder acts only on the Assembly (mouse, keys, `update()`, `draw()` behind one `screenNow()==='assembly'` test), on branch `vehicle` in `launchpad-builder`. `detach()`'s momentum stays PARKED on branch `r22-detach` | `app/builder.js`, `tests/` (a new check) |
| Caio + Claude (world session, machine `Charlinho`) | 2026-10-31 | **Idle.** Q494 ✓ v1.251 on `main` (Selene's craters vary). **Sky & bodies:** `cratG(p,s)` takes the cell's size in `uNdt` (the body's simple → complex size, set in `drawMoons`), and `CM` is −.0022; its profile is `crProf`, which must stay equal to sim/ground.js's `craterProf` (test ground-10 reads the GLSL). Q19 still parked on branch `terrain` (pushed, needs the quiet-machine A/B). Worktree `launchpad-terrain2`, branch `terrain2` = main, free | — |
> Cleared 2026-11-12: loop slices (Opus), **v1.324** (the unlock cards' follow-ups, Q370) on `main`, merged by the launchpad session. **Everyone:** each part has its own `PART_WHY` line (`partWhy` reads the family first; the card reads the part's); `sndUnlock(k)` (app/sound.js) plays a card's cue, counted in `AUD.ev.unlock`; a career under way goes from the title to the desk at the window's `load`, the Esc menu's *Title screen* brings the title back. Worktree `launchpad-momentum`, branch `momentum3` = main.
> Cleared 2026-11-12: economy (Opus), **v1.321 R19** on `main`. **Everyone:** a launch's operations fee is `opsOf(cost)`, its stacking days `stackDays(cost, v)`, an engine's odds of not lighting `ignFail(k)` (sim/program.js), and the pay premiums `PAY_MIL`/`PAY_FAR` (sim/contracts.js): call them, don't copy them (`econ-43` fails on a copy in the sim, Rollout or career.mjs). `LATE=1 node career.mjs` plays the late game (registry, satellite income, dispatch, studies, routines). Worktree `launchpad-r19` removed.
> Cleared 2026-11-12: loop slices (Opus), **v1.320 Q479** on `main`. **Everyone:** `HOOK.news(t, cls, big)` takes an optional poster `{kick, hl, rival?}`: only for a first, a rival's first, a chapter closed, a new computing era (routine news, none); the desk's paper prints one from the last 30 days as a poster; `posterEra()` (app/desk.js) gives the era's poster palette class (pe1–pe3). `node playtest.mjs cards` flies m1 with the unlock cards checked (passed). vehicle-43 now clears `kh`/`dev`/`lines` for its ignition roll (it failed in a smoke shard after an earlier section). Worktree `launchpad-momentum` removed.
> Cleared 2026-11-12: loop slices (Opus), **v1.318 Q579, Q578, Q572, Q576** on `main`. **Everyone:** `PART_FAMILY`, `partWhy`, `CHAPTERS`/`chapterOf`/`chaptersNow`, `stackWaits`, `closedParts` (sim/program.js); `unlockCards(ids,pay)` and `capstoneOf` (sim/debrief.js); `PROG.cardQ` is a new schema row (missions done between flights, shown at the desk). **D34:** `startTest`, `devQuote`, `prodQuote` refuse a closed part: a test that lines up, develops or stands a Kestrel/Condor must open it first (`PROG.done.loads`/`lift1`). The Missions tab is by chapter (`progTabOf` takes *Chapter*). The unlock overlay is `app/unlock.js`; its model renderer `pmStart`/`pmDraw` is in app/model-desk.js (rooms only). Worktree `launchpad-momentum` removed.
> Cleared 2026-11-12: vehicle, **v1.315 R22** (3 of 4) on `main` (after v1.301 R21, v1.303 R26). **Everyone:** `stage()` returns early when a pure ignition fails to light (the event stays next; chute, fairing, spin motors and groups wait for the retry); `fall()` returns null when the crossing is behind the craft (outbound on an escape); `ascentRun` no longer multiplies by `lvl().air` (`aeroPass` does). The fourth fix, `detach()` keeping momentum, is on branch `r22-detach`: it moves the craft ~1 m/s at staging and three long scripted flights (Crewed Lunar, procedures v2, the Nyx ladder) fail with it; whoever lands it makes those robust first.
> Cleared 2026-11-11: economy (Opus), **v1.313 R18** and **v1.314 R16** on `main` (after v1.302 R15). **Everyone:** satellite income goes through `mktShare(n)` (sim/program.js: each further satellite in a market adds half the one before; TV in `utilTick`, imagery in `satTick`); two new `PROG_SCHEMA` rows, `PROG.ipoSold` and `PROG.stakeBy` (the privatization once, a stake once per power; reset by `careerMove`); an unbounded Selene core bracket is `hi:null`, never `Infinity` (JSON turns it into null). Open for Caio: should a defection carry the debt (`careerMove` zeroes it). Worktrees `launchpad-r16` / `launchpad-r18` removed.
> Cleared 2026-11-12: platform (Opus), **v1.319 Q600** on `main` (a flow item, D42): the Mission card is in `CP_CARDS`, short in a critical phase (`mcShort`), lists every mission the vessel could meet, keeps its first order (`mcOrder`) so a job done turns green in place. **Everyone:** in flight `HOOK.done` is a `#msg` line and `sndDone` (app/notice.js `doneFlight`), never the centred box; `doneHeld` is gone; `#done` is for the desk. `hudCardsOn()` (app/hud.js) is the list of cards on screen; `debPaid` records a contract's id. Worktree `launchpad-q600` removed.
> Cleared 2026-11-12: platform (Opus), **v1.316 Q599** on `main`: Esc › Settings › Saved program exports and imports a save. **Everyone:** `importSave(text)` (app/state.js) is the one way a file becomes the program (migrateSave + progLoad; the replaced one kept as `<key>-before-import`; the page reloads); `exportSave()` (app/fault.js) the one way out. Worktree `launchpad-saveio` removed.
> Cleared 2026-11-11: platform (Opus), **Q591** on `main` (test only): aerofx-54 draws the staging puffs from `rng(1)`. **Everyone:** CI has no known flake now; a red run is yours (a branch from before Q591: merge `main`). A check on an effect that uses `Math.random` should seed it the same way (swap `Math.random` for `rng(n)` around the call, restore in `finally`).
> Cleared 2026-11-11: platform (Opus), **v1.308 R10, v1.310 R1d, v1.312 R9** on `main`. **Everyone:** `progLoad(j,home)` (sim/program.js) is the one loader, the page's and the replay's; it fills a save from `PROG_SCHEMA` (a missing field gets its default, unknown fields are kept and logged); a save that won't load is copied to `<key>-bad` and the game starts fresh. `frame()` (app/loop.js) is only the try/catch: game code goes in `frameBody`. Any thrown error or lost promise goes through `gameFault` (app/fault.js, loaded first of the app scripts): a panel with Reload, Export save and the old save. Worktrees `launchpad-r10`, `launchpad-r1d`, `launchpad-r9` removed.
> Cleared 2026-11-11: review 2 (Fable), the plans for **Q573** (the unlock map: `notes/economy.md`, build Q577–Q580, W50) and **Q574** (contact limits: `notes/space.md`, build Q581–Q587, W51), docs only on `main`; `PROGRESSION.md` 0.1.2 carries both. **Economy:** Q577 changes six `req`s and moves 7 parts in `PART_GATE`. **Space:** the plan asks to rank Q338's dish and Q217 with the contact rule. **QA:** `playtest.mjs m1` gains a flight under Q577 (Q580).
> Cleared 2026-11-11: review 2 (Fable), docs only on `main`: [`REVIEW-2026-11-11.md`](explorations/launchpad/REVIEW-2026-11-11.md), tasks **R25–R34** in QUEUE *Proposed*, plans for R2 and R3, scripts in `explorations/launchpad/review/2026-11-11/`. **Vehicle:** R26 (RCS adds back the aero moment the gimbals cancel) is a P1 and changes `TAPE_V`. **Everyone:** the page loads headless (`review/2026-11-11/app/harness.cjs`); run your screen in it before a merge until R34 makes it a test. Worktree `launchpad-audit` removed, branch `audit` = main.
> Cleared 2026-11-11 (orchestrator): economy (Opus), **v1.302 R15** on `main` (no government top-up while a flight is open); the session went on to R16 and left this row. Worktree `launchpad-r15` / branch `r15`.
> Cleared 2026-11-10: generic worker, **v1.300 R14** on `main`: a dispatch's contract settles on `{...recNew(), orb, dv, dispatched}`. **Everyone:** a new `CT` check may read any `recNew()` field on a dispatched flight; test `econ-35`. Worktree `launchpad-r14` removed.
> Cleared 2026-11-10: generic worker, **v1.299 Q202** on `main`: the Hopper and the Beeper presets carry two fin rings (Rollout stable). **Everyone:** test `vehicle-40` fails if any preset rolls out unstable; the Beeper leaves 1,468 m/s in orbit (vehicle-39's pin). Worktree `launchpad-q202` removed.
> Cleared 2026-11-10: review fixes (Opus), **v1.296 R1c** on `main`: `progJSON()`/`progRestore(j)` (sim/program.js) are the only way to save or snapshot `PROG`. **Everyone:** don't `JSON.stringify(PROG)` or `jclone(PROG)` (test platform-6 fails); in tester mode the save names any value JSON would lose (R16's `sel.core.hi` Infinity is the known one). Worktree `launchpad-review` / branch `review` = main, free.

> Cleared 2026-11-10: look & sound (parts & pad), **v1.294 Q565** on `main`: the solar wing's cells. **Everyone:** `rboxUV` (app/gl.js) draws a box with kind `SOLAR_K` = 17 and panel-local metres in the u/v slots; don't give a part kind 17. **v1.297:** `DEP_S.wing` is 6 s (was 4); **vehicle**, your branch moved `DEP_S` into sim/flight.js: keep 6 when you merge. Worktree `launchpad-visuals` / branch `visuals` = main, free.
> Cleared 2026-11-10: review fixes (Opus), **v1.293 R1b** on `main`: `programNew(set)` (sim/program.js) is the one reset: `resetProgram` and `career.mjs` call it; nothing from the old career survives (R17 ✓). **Everyone:** don't reset `PROG` by hand (no field lists); **economy:** `career.mjs` numbers moved (rows independent now; new baseline in notes/economy.md). Worktree `launchpad-review` / branch `review` = main, free.

> Cleared 2026-11-10: review fixes (Opus), **v1.292 R1a** on `main`: `PROG_SCHEMA` + `progFresh` in sim/program.js (no behaviour change). **Everyone: a new `PROG` field needs a row in `PROG_SCHEMA`** (default, keep, why), or test platform-6 fails; a `PROG.x||<literal>` read must use the row's default. Worktree `launchpad-review` / branch `review` = main, free.

> Cleared 2026-11-08: flow session (transitions), **Q555 mock-up** on `main` (no game code): `mockups/transitions/` for Caio to try. **Look & sound:** its sounds are Web Audio stand-ins (door, paper, thump, press, rumble, dawn) to replace when the build lands.
> Cleared 2026-11-09: review fixes (Opus), **v1.289 R4** on `main`: five lines a `//` comment had swallowed, split back out. **Everyone:** the Inbox badge shows again (`progInbox`), the active SAS mode button is lit, Erebus's blade mask `B` is baked (ground-7 checks it). Worktree `launchpad-review` / branch `review` = main, free.

| Caio + Claude (review 2 session, Fable) | 2026-11-12 | **Q603, the copy pass** (D43): text only, one screen a slice. Slices 1 and 2 (the design table, the flight) are v1.322. **Now slice 3, the Program** (contracts, missions, mission control), worktree `launchpad-copy`, branch `copy`. **Everyone:** a string you add follows UI.md § 2.1; a test that reads a user-facing sentence may need its words updated after a slice (none did in slice 1) | user-facing strings in `sim/contracts.js`, `sim/program.js`, `app/program-ui.js`, `app/mission.js` (no logic); `UI.md` § 2.1; `TESTING.md` |
| Caio + Claude (look & sound, effects beat, 2nd session) | 2026-10-18 | **Idle.** Q447 ✓ v1.232 (villages and the site's town lit at night). **Everyone:** the night term in `SKY_FS` main now adds `NIGHT_VIL × gLit`, a shader global any ground painter can add lamps to (`lampPools`); reset in main before `tellus`. Worktree `C:/Users/caioa/dev/launchpad-aerofx`, branch `aerofx`. | — |
| Caio + Claude (orchestrator session, machine `PC_de_Varginha`) | 2026-10-08 (resumed 2026-10-10; new session 2026-10-12; **new session 2026-11-11, main clone on `main`**) | Launchpad **work queue**: keeps `explorations/launchpad/QUEUE.md` current (~30 min refresh), hands out kickoff lines. Pushes coordination docs only; never merges or pushes code. Works in the main clone on `main` (no `launchpad-orchestrator` worktree on this machine). **A second orchestrator runs on the other computer** (Caio, 2026-11-11): pull right before each QUEUE edit, small commits, push at once; it keeps the review (R) ranking it started | `explorations/launchpad/QUEUE.md` (sessions may change their own item's state and append under *Proposed*) |
| Caio + Claude | 2026-08-11 | Landing page rebuild (live-preview cards) for custom-domain launch | `index.html` (ROOT landing page), `README.md` |
| Caio + Claude (flow session) | 2026-10-07 (resumed 2026-10-09; again 2026-10-11, 2026-10-12 23:30) | **Idle 2026-10-31.** Q482 v1.250 done (**everyone:** `turnGuide`'s climb ◇ keeps q·α under `GUIDE_QA` = 36 kPa·° of the surface prograde, faded in over Mach 2.5–3 (`GUIDE_M`); a test that flies the raw `ascentPitch` past Mach 2.5 sees the ◇ off the nose by design). Q476 v1.240 done (**everyone:** `LEVELS`, `lvl()`, `lvlKey()` in sim/core.js; the career's level is `PROG.lvl`, absent = Normal; `engineMdot` and every thrust line read `lvl().isp`, `aeroPass` the body's air at `lvl().air`, `igniteOK` `lvl().fail`, `acceptOffer` `lvl().due`, `pilotMargin` `lvl().pilot`, `revertOK()` (app/state.js) `lvl().revert`; tapes carry `tapeV()` (TAPE_V + `:easy`/`:hard`), `studyKey` `@easy`/`@hard`, logbook entries `lvl`; `setLevel(k)` in app/settings.js; `study_pilot.mjs -l=easy`). Before: idle. Q434–Q436 v1.234–v1.236 done (**everyone:** `ascentPitch(b,h)` and `turnGuide(s)` in sim/flight.js are the standard ascent and the navball's ◇; `speedRef` blends surface → orbit over `navBand` and returns `w`, `s.navRef` holds a frame and rides the tape as `controls().ref`; `velFrame(s)` (sim/vessel.js) is what the SAS's velocity modes hold; **`speedRef`, `sasTarget`, `velFrame` are in TAPE_V: older tapes replay stale**; `SAS_MARK`/`sasIcon` in app/render.js draw every SAS mode's mark, for Q477). Earlier: Q444 v1.233 done (**everyone:** range safety's verdict is `rangeVerdict(site,b,pf)` in sim/world.js: a site's own support town counts only when the impact is over it; drops still use `dropVerdict`). Q415 v1.230 done (**everyone:** `routeCtl(r)` draws a route's state and controls; the Fleet tab's *Routines with nothing up*, `routesBareHTML`). Q438 + Q432 done (`ae6b11c`: smoke green; Help's T row on the Design table; two source scans follow Q420 and Q368). Q384 v1.224 done (hover terms: `TERMS` in app/terms.js; `termTipHTML(el)`; touch taps). Done 2026-10-13: Q340 v1.179, Q293 v1.182, Q286 v1.186 + v1.189, Q391 v1.192, Q400 v1.199, Q405 v1.202, Q271 v1.208 (**everyone:** H and L bars by the navball, `hlGauges()` in `app/cockpit.js`; a new red condition goes in `cautions()`), Q277 v1.216 (`modelScaleHTML()` in `app/model-desk.js`, in `#hqStrip`). Next for flow: the queue's next flow item | `app/*.js` screen/overlay code (`screenNow`, `go`, `KEYS`, `renderHelp`, `renderEsc`, `progLayout`, `flightLeave`, the shared keydown), a new debrief screen + its CSS in `index.html`; `missionEnd` gets one call to record the summary (economy: additive only); new checks appended to `test.mjs`. Formerly: `launchpad/index.html` screen/overlay block (`screenNow`, `go`, `KEYS`, `renderHelp`, `renderEsc`, `progLayout`, the shared keydown), the DOM skeleton and CSS of panels |

---

## Unresolved (mid-flight work from interrupted sessions)

*Nothing currently unresolved.*

