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

## Currently Active

| Operator | Started | Scope | Files at risk |
|----------|---------|-------|---------------|
| Caio + Claude (vehicle session) | 2026-10-09 | Launchpad **QUEUE Q34a: onboard computer, solar panels, battery, power budget** (plan: NOTES § "Vehicle parts"; computer built into crew capsules, a part for probes). Worktree `C:/Users/caioa/dev/launchpad-builder` / branch `builder`; headless only. | new `sim/power.js` (+ its `<script>` line in `index.html`); `PARTS` entries in `sim/vessel.js` and `avOf`; one call each in `physStep` and the rails step; `PRICE`/tier lines in `sim/program.js`; a palette category and a power line in `builder.js`; placeholder meshes in `app/gl.js`; a key in `app/input.js` + `app/screens.js`; tape op in `sim/procedures.js`; new checks appended to `test.mjs`. **Space:** I won't touch registry service; Q27/Q50 read the budget |
| Caio + Claude (world session) | 2026-10-09 | Launchpad **world lane**: GROUND.md G7, **Hesper's ground on the CPU** (QUEUE Q92's CPU half, not live; stub body). Worktree `launchpad-terrain` / branch `terrain`. | `sim/ground.js` (appending Hesper); `study_ground.mjs`; new checks appended to `test.mjs` |
| Caio + Claude (design desk) | 2026-10-08 | Launchpad **design catalogs** with Caio (docs only, no game code): first `SYSTEM.md`, then `CREW.md` / `POWERS.md` / Q53 identity as Caio picks. Main clone, branch `main`. | new `explorations/launchpad/SYSTEM.md` (and the other catalogs); a flag line in `QUEUE.md` when one is approved |
| Caio + Claude (look & sound, beat: effects) | 2026-10-08 | Launchpad **effects beat**, unattended run: Q20 ✓ (`be4ff2c`, on main); Q63 + Q64 done on branch `aerofx` (`66995cd`, merging after a cost measurement); now **Q23** (overflow from parts & pad: gimbal/fin deflection in `MESH_VS` via a small per-part uniform table, `rwheel` in `partBody`; visuals is idle), then, Q64 and whatever else is ready in the beat. Worktree `C:/Users/caioa/dev/launchpad-aerofx` / branch `aerofx`. | `launchpad/app/gl.js` plasma/vapor shaders and their draw code, the render-side effect state (`emitSmoke` neighbourhood); new checks appended to `test.mjs`; `views.js` (appending views only) |
| Caio + Claude (orchestrator session) | 2026-10-08 (resumed 2026-10-08 late, main clone) | Launchpad **work queue**: keeps `explorations/launchpad/QUEUE.md` current (~30 min refresh), hands out kickoff lines. Pushes coordination docs only; never merges or pushes code. Worktree `C:/Users/caioa/dev/launchpad-orchestrator` / branch `orchestrator` | `explorations/launchpad/QUEUE.md` (sessions may change their own item's state and append under *Proposed*) |
| Caio + Claude (economy session) | 2026-10-09 | Launchpad **economy lane**: QUEUE **Q10** rover part prices and era gates; price R4's science contracts. Worktree `C:/Users/caioa/dev/launchpad-economy` / branch `economy`. | rover prices/gates in `sim/` (`RV_*` tables or a price map beside `PRICE`), R4 contract types in `sim/contracts.js`; new checks appended to `test.mjs` |
| Caio + Claude (space session) | 2026-10-08 | Launchpad **space lane**: QUEUE **Q25** orbital decay for low satellites (drag from a thin upper atmosphere on registry orbits between flights; re-entry ends them). Headless. Worktree `C:/Users/caioa/dev/launchpad-sats` / branch `sats`. | `sim/space.js` (`orbTick`, a decay step), possibly the air model's upper tail (`density`) if it needs one; `app/program-ui.js` (`slotLine`); new checks appended to `test.mjs` |
> Cleared 2026-10-08: world session, **v1.62 Enyo's ground on the CPU** on `main` (`9cf7323`, pushed; not live). **Space (Q87):** when you add Enyo to the body tree, give it `ground: ENYO_GROUND` and drop `GROUND_STUBS.Enyo` (sim/ground.js); radius and gravity are SYSTEM.md's. **Everyone:** `surfaceAt` off Tellus now asks the body's recipe (`b.ground.surf`) before falling back to regolith; `craterBands` takes per-body density, salt and erosion (Selene unchanged, bit for bit).
> Cleared 2026-10-08: world session, **the G3 port plan** in `GROUND.md` 0.1.3 (docs only, pushed). **Space:** going live re-seats landed things on Selene (needs Q57), and Selene tapes need the ground recipe in `TAPE_V`'s fingerprint (procedures.js:13), since a recipe is data, not code. **Look & sound (sky & bodies):** Selene's colour moves into a `selCol` hook in SKY_FS, replacing `crat()` on Selene once G3 lands.
> Cleared 2026-10-08: world session, **v1.58 GROUND.md G2** on `main` (`dd8f459`, pushed). **Everyone:** SIM END now closes the new `sim/ground.js` (Selene's ground recipe, `SELENE_GROUND`; **not live**: `SELENE.ground` stays unset until G3 draws it). **Look & sound (sky & bodies):** Selene's maria moved to the near side; the shader's mare term in SKY_FS gained `-${MARE_NEAR}*nb.x` (one token, kept equal to `selMare`); not seen in a browser yet (TESTING 131). **Space (rovers R4):** test §42's spots swapped (near-side mare direct, far-side highland via relay) and its sample points are now a real Fibonacci lattice (they lay on one spiral: LESSONS #36). Worktree `launchpad-terrain` / branch `terrain` = main.
> Cleared 2026-10-08: world session, **v1.54 GROUND.md G1** on `main` (`5cdf43d`, pushed). **Everyone:** test the ground with `b.ground` (a body's recipe), not `b===TELLUS`: `bodyH(b,pf)`, `bodyTop(b)` (instead of `TERR_TOP` for a body's highest ground), `seaAt(b,pf)` (instead of `terrainH<0`), and `groundAlt` may go **below 0** once a recipe has craters (G2). **Vehicle (Q31 legs):** `groundNormal` and `groundContact`'s early-out/sea line in `sim/flight.js` changed by one token each; `footPoints` untouched. **Space:** `MOON_PE` is now a margin above `bodyTop(B)` (5 km while moons are smooth). Worktree `launchpad-terrain` / branch `terrain` = main.
> Cleared 2026-10-08: economy session, **v1.59 offer reasons** on `main`. **Flow:** one line in `contractsHTML` (`app/program-ui.js`): a dim *Why: ⟨c.why⟩* line above each contract's brief; restyle freely.
> Cleared 2026-10-08: economy session, **v1.56 `siteAccess`** on `main`. **Vehicle/flow:** two lines in `app/editor.js`: the LAUNCH over-budget check adds the site fee, and the site picker shows how a site is used and its fee (`a.how`, `a.fee`). **Flow:** the debrief has two new money lines, *Site lease* and *Sponsor covers the failed attempt*.
> Cleared 2026-10-08: fixes session, **PLAYTEST sweep** on `main` (pushed): #8, #15, #16, #19, #20, #21, #22 fixed (NOTES § "PLAYTEST sweep", test.mjs `fixes-1`). **UI session:** two small things in your code: `go()` now calls `flightLeave(S)` when leaving flight/map for another screen (#21), and every screen change, HUD update and headline runs `hudLayout()` (the TESTER badge sits in the flight toolbar; the news keeps a lane beside the readout); the flight toolbar `.tr` is `position:absolute` top-right (fixed #8 too, revert if you'd rather own it). **Economy (paused):** a flight is now settled when the player leaves it (`missionEnd` via `flightLeave`), not at the next launch; `R.ended` keeps it to once. **Builder:** LAUNCH and a one-line site summary are a sticky footer (`#edFoot`, `#siteLine`). **Terrain:** `gsSees` sees anything within `GS_NEAR` = 2 km of the antenna.
> Cleared 2026-10-09: **aerofx session** closed. Everything merged and pushed (last `917132d`). Worktree `C:/Users/caioa/dev/launchpad-aerofx` / branch `aerofx` = main, free. **Visuals:** one additive plume-light block sits in your `MESH_FS` after the floodlight term (`uPl`/`uPlC`); hab/lab are `KIND` 16 with their own branch. **Everyone:** `bloomBegin`/`bloomEnd` wrap `render()`; a pass that renders to another framebuffer mid-frame must rebind `sceneFB()`, not `null`.
> Cleared 2026-10-08: platform session, **test shards (Q56) and the file split (Q58/Q59)** on `main`. See the notice at the top. Worktree `launchpad-platform` / branch `platform` (= `main`), port 8801. Next for platform: Q57 save versions.
> Cleared 2026-10-08: sound session, **v1.49 sound** on `main` (`09a9e85`, pushed). **Everyone:** a render-side block before the main loop (`AUD`, `sndMix`/`sndBoom` between `// ==== SOUND MIX BEGIN/END`, `sndTick`), one `sndTick(dtR)` in `frame()` after `emitSmoke`, F4 in `KEYS.all`. Events are diffed from state (parts on, engines burning by `p.i`, `chuteA`, `landed`, `booms`): no SIM hooks to keep. **Note:** the sim's `SND(h)` is the speed of sound; the audio object is `AUD`. Worktree `launchpad-sound` = main.
> Cleared 2026-10-08: playtest session, **the robot playtester** on `main` (`a6e7169`, pushed): `launchpad/playtest.mjs` walks TESTING rows in headless Chrome on the RTX (`--force_high_performance_gpu`; note `shot.mjs`'s flags land on the Intel iGPU). First pass: 58 of 113 rows judged (37 ✓, 4 ✗, 17 ~), PLAYTEST #15–#23 filed. **Owners, your items:** tester #15 · builder UI #16 #20 · terrain #17 #19 (with aerofx on #17) · control #18 #23 · economy+UI #21 · visuals #22. Output (not in git): `C:/Users/caioa/dev/playtest-out/`.
> Cleared 2026-10-08: sats session, **rovers R1** (the Rover yard) on `main` (`d620d8b`, not pushed). **Everyone:** a new screen `go('rover')` with `mode='drive'` (`simulate` hands it to `rvTick`; `screenNow()` returns `'rover'`; `KEYS.rover`); the rover block sits just before SIM END (`RV_*`, `rvNew`/`rvStep`/`rvRun`/`rvStats`, `yardOf`); designs in `PROG.rovers`, tested km in `PROG.wheelKm`. **Economy/planning:** rovers overlap the pre-flight mission planner (drive plans as a surface leg, deploy checks at site choice): launchpad NOTES § "R1 built". Rover parts have no prices or era gates yet.
> Cleared 2026-10-08: sats session, **rovers R2** (packed on landers, deployed, driven anywhere, kept in the field) is on `main` (`5b2c8de`, not pushed), merged with everything up to `484105f`; all tests pass. **Everyone:** new parts `rvfold`/`rvdeck` (kind `rover`, node field `rvd`), tape op `['Y', partIndex]`; tape playback now aborts only on a bare `['A']` (arm ops `['A', op]` were replayed as aborts); `missionEnd` calls `rvEnd()`; `PROG.rvOut` holds rovers in the field. The `gaugeRect` swallowed `const r` fix is in both.
> **Heads-up, 2026-10-08, sats session: Selene is now tidally locked, and the moons run on program time** (`main` `df1e6e0`, rovers R3, decided with Caio). **Everyone touching Selene:** `bodyTheta(SELENE,t)` follows its orbit (planet-fixed −X faces Tellus; `bodyOmega` = its mean motion), so its ground moves at up to 5.9 m/s and its frame turns: use `fromPF`/`toPF`, never a planet-fixed vector as a position. `speedRef` is surface-relative near airless ground; the procedure landing and `fly_crewlunar.mjs` null surface-relative velocity. `bodyRel` adds `ORB_T0` (program time at the flight's t = 0: set at lift-off from `day0`; a replayed tape keeps its recorded `orbT0`; 0 headless via `ORB_ABS`), so code that assumes M = n·t + M0 must subtract `ORB_T0` (the procedures' passage timing does). Selene's sky-shader markings turn with it (`uMrot`). **Sats/planning:** a relay in Selene orbit is what the far side needs next (the registry keeps only Tellus orbits). **Bodies:** Nyx doesn't spin yet; eclipses not modelled.
> Cleared 2026-10-08: sats session, **the Selene relay** on `main` (pushed). **Everyone:** the registry now keeps orbits about a moon, in that moon's frame (`q.bodyName`, `r`/`v` relative to it); **`satsUp()` is still Tellus orbits only** (moon orbiters: `moonSats(b)`; `orbBody(q)` gives the body; `satAt` uses its μ). Code that walks `PROG.sats` directly must skip `bodyName` entries unless it means them. Between flights `advanceDays` → `moonOrbTick` steps them with Tellus's tide: high polar orbits come down or leave the SOI (into Tellus's registry), with news. `vesselOf` flies one around its moon; `stationTick` covers them. `rvRelays` adds relays in orbit (`at:` a position function). **Economy:** a far-side relay contract is open (NOTES § "The Selene relay", Not yet). **Planning/docking:** rendezvous with moon orbiters is not built (`tgtOf`, `contactStep`, `nearbyFlyable` are Tellus-only).
> Cleared 2026-10-08: sats session, **rendezvous with moon orbiters** on `main` (pushed). **Everyone:** use `orbitsAt(s.body)` (Tellus: `satsUp()`; a moon: `moonSats(b)`) for anything a flight can meet; `tgtOf`, `hitNear`, `contactStep`, `nearbyFlyable`, the arm and `cycleTarget` do. `approach(q,r0,v0,t0,span,mu)` takes the body's μ (default Tellus). `undock` sets the entry's `bodyName` from the vessel's body.
> Cleared 2026-10-08: sats session, **rovers R4 science (first slice)** on `main` (pushed). **Everyone:** the sim now has a function `radioAt(b,pf,hg,T)` (contact for a ground point at program time T); don't confuse it with the physics `groundContact(s,dt)`. `PROG.sel` holds Selene science (readings, panoramas, seismometers, quakes, the core bracket); `advanceDays` also runs `rvFieldSci` and `seisTick`. LOGF has a new *On Selene* section (`semare`, `sehigh`, `sepano`, `secore`). Rover field entries carry `data`, `seisLeft`, `reads`. **Economy:** R4 contract types proposed in launchpad NOTES § "R4 built, first slice" (not priced). **Visuals/bodies:** the drawn maria are mostly on Selene's far side (1.2 % of the near side); geology follows the shader, so moving them moves the science.
> Cleared 2026-10-08: tester session, **the tester menu** (PLAYTEST #1) on `main` (`3b1a775`, not pushed). Open `launchpad/index.html?tester`; F2 / badge / Esc menu. **Everyone:** one `TEST.*` read sits in each of `khUse`, `certOf`, `toolOK`, `igniteOK` and economy's launch line (`R.prep=TEST.fast?0:…`): keep it if you rework those. A KEYS row may carry `tester:true` (Help shows it only in tester mode). **Economy/bodies:** epoch 3's Weather satellite is now `id:'wxsat'` (it shared `weather` with epoch 1's sounding flight, so that flight also completed it); test.mjs §37 checks mission ids are unique. Worktree `C:/Users/caioa/dev/launchpad-tester` / branch `tester` = main, port 8797. NOTES § "The tester menu".
> Cleared 2026-10-08: tester session, **PLAYTEST #2 gantry clipping** fixed on `main` (`35af798`, not pushed). **Visuals:** in your `buildRig`, the girders across the gantry's open front are gone (side girders instead) and the service position is `RIG.zS` (from `padRig`'s new `zr`, the stack's widest |z| reach); `drawPadRig` rolls from it. test.mjs §38 sweeps the roll-back against every preset: keep the open front clear if you restyle. NOTES § "The gantry no longer clips the rocket".
> Cleared 2026-10-08: tester session, **hold-downs follow the rocket** on `main` (`d10a00d`, not pushed). **Visuals:** the four hold-down posts moved from `buildPad` into the rig (`RIG.posts`, drawn in `drawPadRig`); `holdPlan` (after `padRig`) keeps them on the diagonals unless boosters stand there; presets look exactly as before. test.mjs §39 guards it. TESTING rows 108–109 added.
| Caio + Claude | 2026-08-11 | Landing page rebuild (live-preview cards) for custom-domain launch | `index.html` (ROOT landing page), `README.md` |
| Caio + Claude (economy session) | 2026-10-07 | Launchpad program/economy. RESUMED 2026-10-08 in worktree `launchpad-economy` (branch `economy`, port 8774); handoff [`HANDOFF-economy.md`](explorations/launchpad/HANDOFF-economy.md). Latest: v1.47 dispatch, v1.50 deviation handover. NOW: the bodies session's nyxfind/selimp balance note (Nyx/Selene mission completion and payouts). | `MISSIONS` entries for selimp/nyxfind and their completion checks; `career.mjs`; owns the SIM program block (missions, contracts, industry, facilities, compute, timeline, staged pay, dispatch) |
| Caio + Claude (visuals session) | 2026-10-07 | Launchpad visuals. Slice 1 (early-era part look) MERGED to `main` (`bee8d79`, docs `40f3ab1`). Slices 2 (flight marks) and 3 (launch complex) MERGED to `main` (`b3ea9f0`, log `2fd14dd`). Pad revisions, animation (gantry roll, arm swing, hold-downs) and floodlights also MERGED and pushed (`a90aa3d`). The rig and lights follow `curSite()` in its `siteFrame`. Idle between slices; backlog: liveries. **Note for terrain:** I only change the CONTENTS of the `PAD` mesh (`const PAD=…`, pad-local frame, everything at or above y=0, buildings kept on your ground-shader slabs at (36,18), (−45,−25), (20,−30)). I am NOT touching the `drawMesh(PAD,…)` call, `uPadL`, `siteH` or `padGround`. Your `siteH` change to the draw transform should merge cleanly. Worktree `launchpad-visuals` / branch `visuals`, port 8776. Render-only: reads SIM state (skin temps, burns, fuel), keeps mark state render-side **(2026-10-08: aerofx is working on PLAYTEST #2/#3/#4 in your pad/marks/floodlight code; see its row.)** **(2026-10-09: aerofx is doing the design pass on hab/lab/bay/arm/rover meshes, Caio's call; see its row.)** | in `launchpad/index.html`: `MESH_VS`/`MESH_FS`, the mesh helpers (`lathe`, `box`/`rbox`, palette `C`), `partShape`, `partsMesh`. Additive in `partShape` (planning may add parts there); will re-check the builder's editor view after each change. Not touching assemble/PRESETS/editor UI, economy, terrain/sky shaders. |
| Caio + Claude (flow session) | 2026-10-07 (resumed 2026-10-08 late, unattended run) | Q2 Debrief, Q39 Esc pause, Q75/Q76 lanes, Q73 identity mock-ups MERGED (`fe098f0`). Q41 MERGED, Q3 plan written (W15). **NOW: QUEUE Q42, a settings overlay (sound, graphics quality, tester off): `app/screens.js` overlays, a quality preset over aerofx's FX flags and `adaptRes`'s cap.** Launchpad UI: screens, navigation, what each shows. Spec: launchpad NOTES § "UI: screens and navigation". Slices 1–2 MERGED to `main` (`641a3d7`, not pushed). **The page now opens on the Program screen** (career in tabs, a first-run gate); Assembly is building only, with a thin top strip. **For everyone:** (1) every new key gets a row in `KEYS`, or test.mjs §32 fails; (2) screens change only through `go('program'|'assembly'|'flight'|'map')`, never `mode=`/`view=`/`atHQ=` (§32 checks this); (3) RCS on/off is **V**, the logbook is **F**, `R` in flight only reverts. **Economy/bodies:** keep writing Program sections in `renderProgram` as before. A new `<div class="ep">Heading` needs a line in `progTabOf` (§32 lists any heading that would land in "More"). Thanks for the note above: nothing of yours was moved, the click handlers work as they are. Next: slice 3, Debrief (`missionEnd` → a summary record → screen). Worktree `launchpad-ui` / branch `ui`, port 8795 | `app/*.js` screen/overlay code (`screenNow`, `go`, `KEYS`, `renderHelp`, `renderEsc`, `progLayout`, `flightLeave`, the shared keydown), a new debrief screen + its CSS in `index.html`; `missionEnd` gets one call to record the summary (economy: additive only); new checks appended to `test.mjs`. Formerly: `launchpad/index.html` screen/overlay block (`screenNow`, `go`, `KEYS`, `renderHelp`, `renderEsc`, `progLayout`, the shared keydown), the DOM skeleton and CSS of panels |
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
| Caio + Claude (bodies session, machine `pc_de_varginha`) | 2026-10-07 | Launchpad: more bodies. Body tree + Nyx MERGED (`61ff6a1`); 6b perturbations near Nyx MERGED (`cba2d3e`). Selene perturber + per-orbit gating + nodes MERGED (`60b1b7b`). "Out there" missions (epochs 4–5) MERGED (`9b191b3`); epoch 3 utility missions MERGED; crew + escape tower + abort tests + crewed Selene missions MERGED (`9c821b3`); Crewed Lunar flown end to end MERGED; **procedures** (automation that adapts) + tape fingerprint MERGED (`e0d79ba`); **procedures v2, whole missions** MERGED; Nyx missions + flyby/free-return procedures MERGED; free returns aimed at the way home + debris tides MERGED (`e2d3807`); **the Selene and Nyx ladders flown from the pad by procedure** (Probe and Sample Return presets, transfer options side/sunFar/retro, the tide in the trim, deorbit before landing) MERGED; **dispatch flown, not rolled** (Q11: `dispatchRun`, `procFly`, deviations `procDev`, dry runs `procAdopt`) MERGED. Idle. **For economy:** dry runs need your study button and price, and a wider estimate for `prov` procedures (NOTES § "Dispatch, the physics side"). nyxfind completes for free on a Selene flight, and selimp/nyxfind pay less than a Probe costs (launchpad NOTES § "The ladders, proven with real rockets"). **For sats/economy:** registered satellites ride pure Kepler; under the moons' tides a stationary one drifts 10,750 km in 30 days, so tides in the registry need a station-keeping/lifetime mechanic (launchpad NOTES, "Registered satellites still ride pure Kepler"). **For economy: dispatch is yours to design with Caio**, brief and six questions in launchpad NOTES § "Procedures: automation that adapts, and a dispatch brief" (part 3). Also: your timeline check (§35) now deals a fresh board if the inherited one is empty; it had depended on the business cycle earlier sections left behind. **For plumes:** the escape tower (`les`) fires during `s.lesT>0` with no plume yet. **For visuals:** `partBody` has new cases `les` and `crew` (crew draws as the pod). **For sats/builder:** Backspace = abort; tape op `A`. **For economy:** `missionEval`'s payout is now `missionComplete(M,rec)` (same behaviour), and `worldTick` ends with `utilTick(d)` (TV income, world missions). Mission content for later epochs gets built here (Caio's call). **For economy:** additive only: new entries appended to `MISSIONS` (ep 4–5), new `R` fields, one `outThere()` call at the end of `missionTick`, new `LOGF` facts in "Out there", `renderProgram` epoch labels; `RACE` untouched. **For economy:** Nyx missions spec in launchpad NOTES § "Nyx missions — spec" (yours to build; I touched one of your checks: satellite precision now tolerates 1e-3 M, the tides nudge test orbits). **For sats:** craft now feel the moons' tides (low orbit drifts metres a month); `satAt` is still pure Kepler. **Repo:** `receive.autogc=false` set in the Drive repo (pushes from this machine could auto-prune worktrees it can't see). **Note for planning:** your era map's body loop now iterates `BODIES` (Nyx gets drawn); new perturbation code is `pertAcc`/`coastPlan`/`coastStep` near `soiAt`. Local clone `C:/Users/caioa/dev/launchpad-bodies`, branch `bodies` (= main), port 8777. **Anyone on this machine:** do NOT `git worktree prune`, the 'prunable' worktrees are live on the other machine | when active: in `launchpad/index.html` SIM, the body tree (`addBody`, `bodyRel`, `soiAt`, `NYX`), `checkSOI`, rails step limits, `predictFrom`/`escTime`; render `MOON_FS`/`drawMoons` and the map's body loops. **For all:** iterate `BODIES` instead of naming `SELENE`; use `soiAt(b,t)`, not `b.soi` (Nyx's SOI breathes; `b.soi` is its max) |
| Caio + Claude (control session) | 2026-10-08 | Launchpad attitude control. v1.40/v1.43/v1.46 pushed; **v1.51 spin stabilisation** MERGED to `main` (`2ae61aa`, not pushed): Euler's gyroscopic term in `integrateRot` (RK4 substeps, exact attitude step), `spin` part (spin-up motors, `spinFire` from `stage`), `s.spun` (SAS leaves the roll), spin kept through warp, HUD *Spin* row. **v1.51.1** MERGED (`0c2e701`): PLAYTEST #18 (wheels won't turn a vessel past `WHEEL_W` = 1 / 3 / 1 rad/s) and #23 (builder wording). Idle. Worktree `launchpad-control` / branch `control`, port 8796 | when active: `integrateRot`, `ctrlAccel`, `wheelGive`, `controlReport`/`controlHTML`, `AV`; test.mjs sections `control-1`..`control-4` |
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
