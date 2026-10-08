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
`main` for planning and docs. **Merging:** merge `origin/main` into your branch in your worktree and test there; then in
the main clone `git pull --ff-only`, `git merge --ff-only <branch>`, `git push origin main` (refused push = `main`
moved on the other machine: pull and repeat). Not every folder below exists on every machine; `git worktree list` in
the main clone shows this machine's.

| Session | Folder | Branch | Preview port |
|---|---|---|---|
| builder | `C:/Users/caioa/dev/launchpad-builder` | `builder` | 8772 |
| terrain | `C:/Users/caioa/dev/launchpad-terrain` | `terrain` | 8773 |
| economy | `C:/Users/caioa/dev/launchpad-economy` | `economy` | 8774 |
| planning (parts & missions) | `C:/Users/caioa/dev/launchpad-planning2` (re-created 2026-10-07: the old registration was pruned; the old folder is a stale copy) | `planning` | 8775 |
| visuals (part look & textures) | `C:/Users/caioa/dev/launchpad-visuals` | `visuals` | 8776 |
| ui (screens, navigation, information layout) | `C:/Users/caioa/dev/launchpad-ui` | `ui` | 8795 |
| control (attitude: gimbal, control surfaces, wheels, SAS) | `C:/Users/caioa/dev/launchpad-control` | `control` | 8796 |
| tester (the tester menu, PLAYTEST #1) | `C:/Users/caioa/dev/launchpad-tester` | `tester` | 8797 |
| sound (WebAudio, open thread 7) | `C:/Users/caioa/dev/launchpad-sound` | `sound` | 8798 |
| playtest (the robot playtester for TESTING.md) | `C:/Users/caioa/dev/launchpad-playtest` | `playtest` | 8799 |

> **For every launchpad session, 2026-10-08 (control session, at Caio's request): `explorations/launchpad/TESTING.md`.** Caio
> can't playtest for now, so this lists what nobody has played yet: 107 rows by area (try this / how to get there / looks right
> if / owner). **When you ship something a person should try, add a row** (next free number, your session as owner) in the
> same commit as your NOTES section, and fix rows your changes make wrong. Problems found go to PLAYTEST.md.

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
> commit and push your claim.** Still open: step 6 (freeze: Drive's `.git` → `_backup/`, `MOVED.md`) is Caio's to run
> once the other machine has copied; until then, don't commit in the Drive folder.
> ~~PAUSE ON: the repo is leaving Google Drive now (replaces the 2026-10-07 visuals plan). No work in the
> Drive folder or the worktrees until this note says done.~~ Runbook: [`docs/leaving-drive.md`](docs/leaving-drive.md),
> script `docs/leaving-drive.sh`. New home on each machine: `C:/Users/caioa/dev/explorations` (its own `.git`, synced
> through GitHub); worktrees stay where they are and are re-pointed. **When the pause is called:** commit your work in
> your worktree, merge into `main` the usual way, clear your claim, stop. Afterwards claims and shared docs travel by
> push/pull (runbook § "After the move").

## Currently Active

| Operator | Started | Scope | Files at risk |
|----------|---------|-------|---------------|
| Caio + Claude (sound session) | 2026-10-08 | Launchpad **sound** (open thread 7): WebAudio engine rumble from thrust × air density, staging/separation thunks, explosion boom, wind from dynamic pressure, a mute key. Worktree `launchpad-sound` / branch `sound`, port 8798 | in `launchpad/index.html`: a NEW audio block outside SIM (render-side, reads SIM state only), one call per frame in the frame loop (NOT in `render()`: aerofx's bloom owns its end), one `KEYS` row; a new section at the end of `test.mjs` |
| Caio + Claude (playtest session) | 2026-10-08 | Launchpad **robot playtester**: a new script next to `shot.mjs` that walks TESTING.md rows on the real GPU (scene setup, screenshots, console errors, measurements) and a report. Worktree `launchpad-playtest` / branch `playtest`, port 8799 | new `launchpad/playtest.mjs` (+ an output folder outside git); results written into `TESTING.md` (`#` cells) and new items in `PLAYTEST.md`. No game code changes (a bug found is filed, not fixed) |
> Cleared 2026-10-08: sats session, **rovers R1** (the Rover yard) on `main` (`d620d8b`, not pushed). **Everyone:** a new screen `go('rover')` with `mode='drive'` (`simulate` hands it to `rvTick`; `screenNow()` returns `'rover'`; `KEYS.rover`); the rover block sits just before SIM END (`RV_*`, `rvNew`/`rvStep`/`rvRun`/`rvStats`, `yardOf`); designs in `PROG.rovers`, tested km in `PROG.wheelKm`. **Economy/planning:** rovers overlap the pre-flight mission planner (drive plans as a surface leg, deploy checks at site choice): launchpad NOTES § "R1 built". Rover parts have no prices or era gates yet.
> Cleared 2026-10-08: sats session, **rovers R2** (packed on landers, deployed, driven anywhere, kept in the field) is on `main` (`5b2c8de`, not pushed), merged with everything up to `484105f`; all tests pass. **Everyone:** new parts `rvfold`/`rvdeck` (kind `rover`, node field `rvd`), tape op `['Y', partIndex]`; tape playback now aborts only on a bare `['A']` (arm ops `['A', op]` were replayed as aborts); `missionEnd` calls `rvEnd()`; `PROG.rvOut` holds rovers in the field. The `gaugeRect` swallowed `const r` fix is in both.
> **Heads-up, 2026-10-08, sats session: Selene is now tidally locked, and the moons run on program time** (`main` `df1e6e0`, rovers R3, decided with Caio). **Everyone touching Selene:** `bodyTheta(SELENE,t)` follows its orbit (planet-fixed −X faces Tellus; `bodyOmega` = its mean motion), so its ground moves at up to 5.9 m/s and its frame turns: use `fromPF`/`toPF`, never a planet-fixed vector as a position. `speedRef` is surface-relative near airless ground; the procedure landing and `fly_crewlunar.mjs` null surface-relative velocity. `bodyRel` adds `ORB_T0` (program time at the flight's t = 0: set at lift-off from `day0`; a replayed tape keeps its recorded `orbT0`; 0 headless via `ORB_ABS`), so code that assumes M = n·t + M0 must subtract `ORB_T0` (the procedures' passage timing does). Selene's sky-shader markings turn with it (`uMrot`). **Sats/planning:** a relay in Selene orbit is what the far side needs next (the registry keeps only Tellus orbits). **Bodies:** Nyx doesn't spin yet; eclipses not modelled.
> Cleared 2026-10-08: tester session, **the tester menu** (PLAYTEST #1) on `main` (`3b1a775`, not pushed). Open `launchpad/index.html?tester`; F2 / badge / Esc menu. **Everyone:** one `TEST.*` read sits in each of `khUse`, `certOf`, `toolOK`, `igniteOK` and economy's launch line (`R.prep=TEST.fast?0:…`): keep it if you rework those. A KEYS row may carry `tester:true` (Help shows it only in tester mode). **Economy/bodies:** epoch 3's Weather satellite is now `id:'wxsat'` (it shared `weather` with epoch 1's sounding flight, so that flight also completed it); test.mjs §37 checks mission ids are unique. Worktree `C:/Users/caioa/dev/launchpad-tester` / branch `tester` = main, port 8797. NOTES § "The tester menu".
> Cleared 2026-10-08: tester session, **PLAYTEST #2 gantry clipping** fixed on `main` (`35af798`, not pushed). **Visuals:** in your `buildRig`, the girders across the gantry's open front are gone (side girders instead) and the service position is `RIG.zS` (from `padRig`'s new `zr`, the stack's widest |z| reach); `drawPadRig` rolls from it. test.mjs §38 sweeps the roll-back against every preset: keep the open front clear if you restyle. NOTES § "The gantry no longer clips the rocket".
> Cleared 2026-10-08: tester session, **hold-downs follow the rocket** on `main` (`d10a00d`, not pushed). **Visuals:** the four hold-down posts moved from `buildPad` into the rig (`RIG.posts`, drawn in `drawPadRig`); `holdPlan` (after `padRig`) keeps them on the diagonals unless boosters stand there; presets look exactly as before. test.mjs §39 guards it. TESTING rows 108–109 added.
| Caio + Claude | 2026-08-11 | Landing page rebuild (live-preview cards) for custom-domain launch | `index.html` (ROOT landing page), `README.md` |
| Caio + Claude (economy session) | 2026-10-07 | Launchpad: program/economy (missions, contracts, budget, calendar, powers) | in `launchpad/index.html`: the SIM program block (PRICE … MISSIONS … missionEnd, powers/worldTick, new contracts block), `missionTick`, `renderProgram` + a new program-UI section, HUD `payloadRows`; new checks appended in `test.mjs` §14. Not touching assemble/PRESETS/editor UI. |
| Caio + Claude (visuals session) | 2026-10-07 | Launchpad visuals. Slice 1 (early-era part look) MERGED to `main` (`bee8d79`, docs `40f3ab1`). Slices 2 (flight marks) and 3 (launch complex) MERGED to `main` (`b3ea9f0`, log `2fd14dd`). Pad revisions, animation (gantry roll, arm swing, hold-downs) and floodlights also MERGED and pushed (`a90aa3d`). The rig and lights follow `curSite()` in its `siteFrame`. Idle between slices; backlog: liveries. **Note for terrain:** I only change the CONTENTS of the `PAD` mesh (`const PAD=…`, pad-local frame, everything at or above y=0, buildings kept on your ground-shader slabs at (36,18), (−45,−25), (20,−30)). I am NOT touching the `drawMesh(PAD,…)` call, `uPadL`, `siteH` or `padGround`. Your `siteH` change to the draw transform should merge cleanly. Worktree `launchpad-visuals` / branch `visuals`, port 8776. Render-only: reads SIM state (skin temps, burns, fuel), keeps mark state render-side **(2026-10-08: aerofx is working on PLAYTEST #2/#3/#4 in your pad/marks/floodlight code; see its row.)** | in `launchpad/index.html`: `MESH_VS`/`MESH_FS`, the mesh helpers (`lathe`, `box`/`rbox`, palette `C`), `partShape`, `partsMesh`. Additive in `partShape` (planning may add parts there); will re-check the builder's editor view after each change. Not touching assemble/PRESETS/editor UI, economy, terrain/sky shaders. |
| Caio + Claude (aerofx session) | 2026-10-09 | All prior work MERGED and pushed (last `8efb609`; PLAYTEST #3/#4/#5/#7/#10 done). Worktree `C:/Users/caioa/dev/launchpad-aerofx` (re-pointed at `C:/Users/caioa/dev/explorations` by the move) / branch `aerofx`. NOW: **sun bloom**, a bright-light glow post-pass (the sun, explosions, plumes, lamps). **Note for visuals:** one additive plume-light block in your `MESH_FS` after the floodlight term (`uPl`/`uPlC`); keep it | in `launchpad/index.html`: a new post pass at the end of `render()` (the scene into an offscreen target, then bloom and composite); the start of `render()` binds that target. Everyone's draws are unchanged |
| Caio + Claude (ui session) | 2026-10-07 | Launchpad UI: screens, navigation, what each shows. Spec: launchpad NOTES § "UI: screens and navigation". Slices 1–2 MERGED to `main` (`641a3d7`, not pushed). **The page now opens on the Program screen** (career in tabs, a first-run gate); Assembly is building only, with a thin top strip. **For everyone:** (1) every new key gets a row in `KEYS`, or test.mjs §32 fails; (2) screens change only through `go('program'|'assembly'|'flight'|'map')`, never `mode=`/`view=`/`atHQ=` (§32 checks this); (3) RCS on/off is **V**, the logbook is **F**, `R` in flight only reverts. **Economy/bodies:** keep writing Program sections in `renderProgram` as before. A new `<div class="ep">Heading` needs a line in `progTabOf` (§32 lists any heading that would land in "More"). Thanks for the note above: nothing of yours was moved, the click handlers work as they are. Next: slice 3, Debrief (`missionEnd` → a summary record → screen). Worktree `launchpad-ui` / branch `ui`, port 8795 | when active: `launchpad/index.html` screen/overlay block (`screenNow`, `go`, `KEYS`, `renderHelp`, `renderEsc`, `progLayout`, the shared keydown), the DOM skeleton and CSS of panels |
> Cleared 2026-10-07: **plumes session** closed. Volumetric engine plumes MERGED to `main` (`5e71091`). Worktree
> `C:/Users/caioa/dev/launchpad-plumes` / branch `plumes` equals `main`. Ports 8777/8778 are taken by another process on this
> machine; plumes used 8791. `views.js`: plume views are 30–36, and `refView` now funds the program before launching.
> Cleared 2026-10-07: **builder session** closed. Everything is merged into `main` (`19da7f1`): v1.17 construction screen,
> v1.18 radial fins + make root, v1.20 staging editor, v1.22 canted engines, v1.23 aero interference (shadowing in `aeroPass`).
> Worktree `C:/Users/caioa/dev/launchpad-builder` / branch `builder` is clean and equal to `main`, free for the next builder
> session (its preview config `launchpad-builder`, port 8772, is in both `.claude/launch.json`s). To resume: launchpad
> `NOTES.md` § v1.17–v1.23 and open thread 4 (next: truly tilted bodies; interference terms Newtonian shadowing leaves out).
> Standing notes for other sessions:
> - **economy:** hotfix `480d7c7` restored your program-panel click handler (a misplaced builder line had split
>   `if(ds.start)` / `else if(ds.dk)`; decisions were dead in the editor from v1.17). test.mjs §17 guards it. There is one
>   cross-scope line after your price table: `PRICE.rfin=0.4;`.
> - **terrain:** the editor lifts the ship with `S.pf=[TELLUS.R-S.yBot+LIFT,0,0]` (`changed()` in `builder.js`). It will
>   need the pad height (`WORLD.siteH`) once launch sites have real height.
> - **visuals:** `partsMesh` rotates canted engines (`p.tdir`) about their mount after `partShape`. Keep that block when
>   editing `partsMesh`. The builder's ghost and highlight meshes also go through `partShape`, via `meshOf` in `builder.js`.
> - **anyone merging:** test.mjs §17's merge guard fails if the builder's render hooks leave `render()`. Never move hunks
>   between trees with zero-context patches (LESSONS #17).
| Caio + Claude (bodies session, machine `pc_de_varginha`) | 2026-10-07 | Launchpad: more bodies. Body tree + Nyx MERGED (`61ff6a1`); 6b perturbations near Nyx MERGED (`cba2d3e`). Selene perturber + per-orbit gating + nodes MERGED (`60b1b7b`). "Out there" missions (epochs 4–5) MERGED (`9b191b3`); epoch 3 utility missions MERGED; crew + escape tower + abort tests + crewed Selene missions MERGED (`9c821b3`); Crewed Lunar flown end to end MERGED; **procedures** (automation that adapts) + tape fingerprint MERGED (`e0d79ba`); **procedures v2, whole missions** MERGED; Nyx missions + flyby/free-return procedures MERGED; free returns aimed at the way home + debris tides MERGED (`e2d3807`). Idle. **For sats/economy:** registered satellites ride pure Kepler; under the moons' tides a stationary one drifts 10,750 km in 30 days, so tides in the registry need a station-keeping/lifetime mechanic (launchpad NOTES, "Registered satellites still ride pure Kepler"). **For economy: dispatch is yours to design with Caio**, brief and six questions in launchpad NOTES § "Procedures: automation that adapts, and a dispatch brief" (part 3). Also: your timeline check (§35) now deals a fresh board if the inherited one is empty; it had depended on the business cycle earlier sections left behind. **For plumes:** the escape tower (`les`) fires during `s.lesT>0` with no plume yet. **For visuals:** `partBody` has new cases `les` and `crew` (crew draws as the pod). **For sats/builder:** Backspace = abort; tape op `A`. **For economy:** `missionEval`'s payout is now `missionComplete(M,rec)` (same behaviour), and `worldTick` ends with `utilTick(d)` (TV income, world missions). Mission content for later epochs gets built here (Caio's call). **For economy:** additive only: new entries appended to `MISSIONS` (ep 4–5), new `R` fields, one `outThere()` call at the end of `missionTick`, new `LOGF` facts in "Out there", `renderProgram` epoch labels; `RACE` untouched. **For economy:** Nyx missions spec in launchpad NOTES § "Nyx missions — spec" (yours to build; I touched one of your checks: satellite precision now tolerates 1e-3 M, the tides nudge test orbits). **For sats:** craft now feel the moons' tides (low orbit drifts metres a month); `satAt` is still pure Kepler. **Repo:** `receive.autogc=false` set in the Drive repo (pushes from this machine could auto-prune worktrees it can't see). **Note for planning:** your era map's body loop now iterates `BODIES` (Nyx gets drawn); new perturbation code is `pertAcc`/`coastPlan`/`coastStep` near `soiAt`. Local clone `C:/Users/caioa/dev/launchpad-bodies`, branch `bodies` (= main), port 8777. **Anyone on this machine:** do NOT `git worktree prune`, the 'prunable' worktrees are live on the other machine | when active: in `launchpad/index.html` SIM, the body tree (`addBody`, `bodyRel`, `soiAt`, `NYX`), `checkSOI`, rails step limits, `predictFrom`/`escTime`; render `MOON_FS`/`drawMoons` and the map's body loops. **For all:** iterate `BODIES` instead of naming `SELENE`; use `soiAt(b,t)`, not `b.soi` (Nyx's SOI breathes; `b.soi` is its max) |
| Caio + Claude (control session) | 2026-10-08 | Launchpad attitude control. MERGED to `main`, not pushed: **v1.40** (`45dd447`) real per-engine gimbal, steerable fins (`cfin`/`cfins`/`cfins25`), SAS lag zone + rate integral; **v1.43** (`1866aba`) wheels that saturate (pod 40 → 10 kN·m, `rwheel` part, unloading) and the builder's Control block; **v1.46** (`42adc71`) avionics generations (gyro → analog → guidance computer by computing era). Idle; nothing queued on this line. **For visuals:** draw `p.gv` (nozzle) and `p.fd` (fin plates); `rwheel` uses the default drum. **For career flight scripts:** before year 3 in a program, `sasMode='pro'` holds the attitude; wheel-only turns in vacuum are 2–4× slower than before v1.43. Worktree `launchpad-control` / branch `control`, port 8796 | when active: `ctrlAuthority`/`ctrlAuthRoll`/`ctrlAccel`, `gimSteer`/`finCols`/`wheelGive`, the control lines at the top of `physStep`, `controlReport`/`controlHTML`, `AV`/`avNow`/`avOf`, `renderSAS`, the fin loop in `aeroPass`; test.mjs §35–37 |
> Cleared 2026-10-08: sats session, **E: moonbases** on `main` (`bb66a6d`, not pushed; GitHub has `9fa0357`). **Everyone:** `satsUp()` is now orbit-only; landed objects are `landedUp()` (`q.landed`, `q.bodyName`, `q.pf`, `q.ql`). `contactStep` runs on any body (landed objects immovable). `stationTick` covers bases through `crewTick`. **Economy:** with A–E built, the stations plan waits on contracts (stations, bases, retrieval, crew rotation) and the rules for flights from orbit; specs in launchpad NOTES § "Phase C built" and after.
> Cleared 2026-10-08: sats session, **D: the arm** on `main` (`9fa0357`; GitHub had `785429c` pushed by another session before this). New: `arm` part, `armOp`/`armStep` (moving a held body keeps s.r and s.v), passengers of kind `'arm'` and `'bay'`, HUD *Arm* row, tape op `['A', op]`, `railsOK` false while the arm moves, booms drawn per frame next to the ship draw (**visuals:** yours to restyle).
> Cleared 2026-10-08: sats session, **A2: vessels flyable across flights** on `main` (`785429c`, not pushed). Registry entries now keep `stack` (design), `vst` (state) and shape `oi`; `vesselOf(q,T)` rebuilds; `flyEntry` starts a flight from orbit (`R.fromOrbit`, `OPS_FIX` charged). **Economy:** decide whether flights from orbit pay operations and whether they may complete orbit contracts (`R.fromOrbit`). **Bodies:** switching to a vessel with crew aboard sets `R.crewed/crewOK/crewInit` so your crew rules apply. **Everyone:** separated vessels' parts carry `p.oi`/`p.oseg` (design indices).
> Cleared 2026-10-08: sats session, **stations Phase C** on `main` (`3688099`, not pushed): radial ports (`rport`, `portGeom`), habitat and lab modules, `sup` resource, `shapeOf` (shapes keep resources and crewed capsules), `stationOf`/`stationTick` (called first thing in `satTick`), a station line in `satsHTML`. The Docking SAS mode now returns an attitude (`{q}`), which `ctrlAccel` and the rails attitude snap understand; other modes unchanged. **Economy:** six station contract types proposed for you to price and build, in launchpad NOTES § "Phase C built" (first station milestones, resupply, lab time, crew rotation after A2, expansion, reboost). `PROG.labDays` and per-station `q.labDays` are there to read.
> Cleared 2026-10-07: sats session, **cargo bay** (stations Phase B) on `main` (`ca9782f`, not pushed). A stale empty `.git/index.lock` (21:00:31) was removed with Caio's OK after 8+ minutes; `git fsck --connectivity-only` clean afterwards. New: `bay` part, `p.inBay` (set in `assemble`), `shielded(p)`/`profOf(p)` in `rebuildShape` (**aero**: enclosed parts leave the airflow while the doors are shut), hollow contact (`bayGeo`), `detach(...,asVessel)`, tape op `['B', op]`, key B. **Visuals:** the bay doors (`bayDoor`) read a little oddly mid-swing; yours if you want them.
> Cleared 2026-10-07: sats session, **vessel-to-vessel docking** on `main` (`705fcb8`, not pushed). **FLAG for everyone:** `main` had gone backwards to `4f6bdb9` (a bodies merge that did not contain the Phase A merge `1caf1cb`; most likely Drive sync replacing the ref, see lesson #25), leaving Phase A's `builder.js` as a stray "local change" in the Drive folder. Restored by fast-forwarding to `705fcb8`, which contains both. **If you merged `main` between `4f6bdb9` and now, your branch lacks Phase A (`vesselFrom`, `FLEET`): merge `main` again.** Docking: `dockPair(s,q,B)` takes a vessel or an entry; `tgtOf` can return a vessel (`T.ves`); controls record the target (`tg`).
> Cleared 2026-10-07: sats session, **several vessels in a flight** (stations Phase A) on `main` (`1caf1cb`, not pushed). **Everyone:** `S` is still the vessel you fly; the others are in `FLEET`. Separations that include a pod or the new probe core make a vessel (`vesselFrom`), not debris. Controls reach only S via `inpOf(s)` (use it, not `INP`, in any per-vessel sim code). `physStep` advances the clock, so other vessels are stepped with it held (`fleetPhys`). Wheels are any part's `torque`. `missionEnd` calls `fleetEnd`. Next for this session: the cargo bay (Phase B) or vessel-to-vessel docking.
> Cleared 2026-10-07: sats session, **the claw** on `main` (`d4cc109`, not pushed). `dock` now calls a shared `join`; joints rated per part (`jF`/`jM` on `port` and `claw`); `PRICE.claw` after `PRICE.port` (**economy**); `partBody` case `claw` (**visuals**); test.mjs §26 also checks the whole page script parses (**everyone**: a syntax error in UI code now fails the suite).
> Cleared 2026-10-07: sats session, **docking port** on `main` (`bc5b3ab`, not pushed). `geom` now adds docked bodies (`s.att`); `satRegister` writes `attached`; `missionEnd` calls `dockEnd`; `satTick` and the satellite loops use `satsUp()` (skips docked entries); one `PRICE.port` after the RCS prices (**economy**); `partBody` case `port` (**visuals**); tape op `['D', id]`. Next: the claw (NOTES § "Docking port", Not yet).
> Cleared 2026-10-07: sats session, **RCS** on `main` (`d5a2e9c`, not pushed). New parts `rcs`/`gas` + `RES.gas`; `PRICE.rcs/gas` after `PRICE.rfin` (**economy**); `partBody` cases `rcs`/`gas` (**visuals**); `ctrlAccel(s,rcs)` and an RCS call before the force sum in `physStep`; `controls`/`setControls` carry `tx/ty/tz/rcs`. Next for this session: the docking port (NOTES § "Docking and related parts: plan").
> Cleared 2026-10-07: sats session. Satellites in 3D, rendezvous and **contact** are on `main` (`484ba1d`, not pushed). Contact adds a block next to the registry (`contactStep`, `satSpin`, `hitNear`, …), `contactStep` in `advPhys`, and `&&!hitNear(s)` in `railsOK` (physics within 5 km of a satellite). Docking plan with open questions: launchpad NOTES § "Docking and related parts: plan".
> Cleared 2026-10-07: neuromechfly slowed-CPG slice shipped (folder + README/INDEX cells + lesson #24).
> `satRegister` now also stores `shape`/`qo`/`cm` (render-only) and sets `rec.satId`; test.mjs §20 appended. **Anyone committing
> on `pc_de_varginha`:** neither the Drive repo nor a fresh clone has a git identity here; use `git -c user.name=… -c user.email=…`.
> Cleared 2026-10-08: terrain session, **v1.48 geography in play (slices C–E)** merged to `main` (`d32081c`, not pushed). **Planning/sats:** contact in `satTick` is now `gsSees(st, pf)` (horizon masks from the terrain), not the sea-level elevation test. **Economy:** `missionEnd` merges the telemetry recorder `R.sfRec` into `R.sf` only if the package came home; the refurbishment refund is scaled by `recoveryOf(s, R).factor` (sea beyond reach, a hostile neighbour's land); `CT` gained `field` and `aurora` (science), which shifts seeded offer boards; disasters now pick cities by geography (`disCities`). NOTES § v1.48, TESTING rows 110–113.
> Cleared 2026-10-08: terrain session, **v1.45 launch-site follow-ups** merged to `main` (`98723b1`, not pushed). **Economy:** a sea platform site (`kind:'sea'`, power null) is open by default in `siteAccessOf`; price or gate it in your `siteAccess`. The weather hold is one hook in your `missionTick` launch line (`weatherHold(s)`). **Visuals:** the sea platform's deck has to cover the whole `PAD` mesh; a sea-specific complex (tower and table only) would let it shrink to a realistic size.
> Cleared 2026-10-08: terrain session, **v1.39 real ground contact** merged to `main` (`e6f6a50`, not pushed). **All sessions:** `s.landed` now turns true once a vessel is at rest (it can be leaning); `s.touchV` is the measured touchdown speed and `s.touchHit` what boulders/trees added. **Planning (parts):** landing legs would be the natural next part: without them tall stacks tip on ~7–12° slopes; `footPoints` takes the feet of any part within 0.5 m of the lowest point.
> Cleared 2026-10-08: terrain session, **v1.37 surfaces** merged to `main` (`884a1ed`, not pushed). **Economy:** `s.landSurface` = `{name, id, hit}` is set at touchdown, for your mission record.
> Cleared 2026-10-07: terrain session, **v1.29 ground awareness** merged to `main` (`dee4b28`, not pushed): main chute by height above the ground, predictor alike, warp drop and HUD radar altitude. Worktree `launchpad-terrain` = main.
> Cleared 2026-10-07: **terrain session, v1.27 launch sites** merged to `main` (`baa19ba`, not pushed). Worktree `launchpad-terrain` / branch `terrain` = main, free for the next terrain session (NOTES § v1.27 "Next on this line", then slices C–E in § v1.25).
> Standing notes from terrain:
> - **economy:** define `siteAccess(site)` → `{ok, why, fee}` in the program block; `siteAccessOf` already calls it on Launch and in the picker (until then: home sites only). Record `R.site` (the flight has `S.site`). Overflight politics: `site.downrange.over` (two of Haval's sites launch over Fenfen). One line of yours changed: `makePowers` seeds power 0 at `SITES[0].u` (still +X). Bug for you: the ballistic contract's target is `rg/600` radians from +X, i.e. the old 600 km radius (ranges 2.1× long) and not from the flight's site.
> - **builder:** the site picker lives in `index.html` (`renderSites`, `#sitePick` above LAUNCH), not in `builder.js`; move it if the construction screen grows a place for it. `changed()` now hangs the ship over `S.site`.
> - **planning / sats:** the pad's ground station is `padGS()` (the chosen site); the `PAD_GS` constant is gone.
> Cleared 2026-10-07: terrain session, v1.25 merged to `main` (`ccb136e`, not pushed). The worktree `launchpad-terrain` / branch `terrain` stays for the next terrain session; start at NOTES § v1.25 "Next session". `builder.js` and the foreign-station test each got one small change (see the session log).
> Cleared 2026-10-07: neuromechfly foot-landing slice shipped (folder + README/INDEX cells).
> Cleared 2026-10-07: neuromechfly measured-contact slice shipped (folder + README/INDEX cells).
> Cleared 2026-10-07: neuromechfly breaking-point sweep shipped (folder + one README row + one INDEX row + lesson #20).
> Cleared 2026-10-06: launchpad exploration v1.0 shipped (new folder + one README row + one INDEX row).
> Cleared 2026-10-01: pulse-loop exploration v1.0 shipped (new folder + one README row).
> Cleared 2026-09-10: exploration 6 shipped. flygym venv lives OUTSIDE the sync boundary at
> `C:/Users/caioa/.venvs/flygym` — not in this folder, by design. Main finding and the open
> threads are in `explorations/neuromechfly/NOTES.md`.
> Cleared 2026-08-12: warehouse gravity graph shipped. `index.html` (the exploration's, not
> the root landing page) gained an additive `REACH` branch keyed on `meta.graphMode`; the ICP
> graph was re-verified unregressed. `build_data_lakehouse.py` now writes BOTH
> `sankey-lakehouse.html` and `index-lakehouse.html` from one payload, and still needs
> `LAKEHOUSE_WAREHOUSE_ID` in the environment.
> Cleared 2026-08-12: the warehouse funnel shipped (`53891ed`). Its `sankey.html` change was
> an additive third `SK.mode` branch plus one header link; the ICP and identified-traffic
> branches were re-verified unregressed (conservation + rendered labels) before pushing.
> Note for any session regenerating data: `build_data_lakehouse.py` now requires
> `LAKEHOUSE_WAREHOUSE_ID` in the environment — the compute id is deliberately not committed.
> Note for the landing-page session: `explorations/journey-markov/` shipped 2026-08-12 and is
> live but not yet linked from the landing page — add its card when rebuilding.

> Resolved 2026-08-11: the unclaimed `dots-friend-enemy` changes were the V2.4 influences work
> (wandering attractor + predator). Committed by that session. The miss was real — it edited a
> shared-workspace file without filing a claim row first, which is exactly what left the fireflies
> session guessing. Claim before writing, even when you expect to be the only one working.

---

## Unresolved (mid-flight work from interrupted sessions)

*Nothing currently unresolved.*

> Resolved 2026-08-12: the sankey v1.5 NOTES/SESSION_LOG entries were written by the
> graph-spacing session that held those files (NOTES bumped to 1.5.0, §"The funnel view"
> extended, SESSION_LOG "v1.5" entry covers both pages).
