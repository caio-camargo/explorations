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
into `main` when a slice is done. The Drive folder stays on `main` for planning and docs.

| Session | Folder | Branch | Preview port |
|---|---|---|---|
| builder | `C:/Users/caioa/dev/launchpad-builder` | `builder` | 8772 |
| terrain | `C:/Users/caioa/dev/launchpad-terrain` | `terrain` | 8773 |
| economy | `C:/Users/caioa/dev/launchpad-economy` | `economy` | 8774 |
| planning (parts & missions) | `C:/Users/caioa/dev/launchpad-planning2` (re-created 2026-10-07: the old registration was pruned; the old folder is a stale copy) | `planning` | 8775 |
| visuals (part look & textures) | `C:/Users/caioa/dev/launchpad-visuals` | `visuals` | 8776 |
| ui (screens, navigation, information layout) | `C:/Users/caioa/dev/launchpad-ui` | `ui` | 8795 |
| control (attitude: gimbal, control surfaces, wheels, SAS) | `C:/Users/caioa/dev/launchpad-control` | `control` | 8796 |

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

> **2026-10-07 — git repo move PLANNED, not done (visuals session).** The repository data will move from this Drive folder
> to `C:/Users/caioa/dev/explorations-git` (Drive zero-filled git objects; LESSONS #19). Normal work is fine for now; a
> short pause will be announced here when it happens. Paths won't change.

## Currently Active

| Operator | Started | Scope | Files at risk |
|----------|---------|-------|---------------|
| Caio + Claude | 2026-08-11 | Landing page rebuild (live-preview cards) for custom-domain launch | `index.html` (ROOT landing page), `README.md` |
| Caio + Claude (economy session) | 2026-10-07 | Launchpad: program/economy (missions, contracts, budget, calendar, powers) | in `launchpad/index.html`: the SIM program block (PRICE … MISSIONS … missionEnd, powers/worldTick, new contracts block), `missionTick`, `renderProgram` + a new program-UI section, HUD `payloadRows`; new checks appended in `test.mjs` §14. Not touching assemble/PRESETS/editor UI. |
| Caio + Claude (visuals session) | 2026-10-07 | Launchpad visuals. Slice 1 (early-era part look) MERGED to `main` (`bee8d79`, docs `40f3ab1`). Slices 2 (flight marks) and 3 (launch complex) MERGED to `main` (`b3ea9f0`, log `2fd14dd`). Pad revisions, animation (gantry roll, arm swing, hold-downs) and floodlights also MERGED and pushed (`a90aa3d`). The rig and lights follow `curSite()` in its `siteFrame`. Idle between slices; backlog: liveries. **Note for terrain:** I only change the CONTENTS of the `PAD` mesh (`const PAD=…`, pad-local frame, everything at or above y=0, buildings kept on your ground-shader slabs at (36,18), (−45,−25), (20,−30)). I am NOT touching the `drawMesh(PAD,…)` call, `uPadL`, `siteH` or `padGround`. Your `siteH` change to the draw transform should merge cleanly. Worktree `launchpad-visuals` / branch `visuals`, port 8776. Render-only: reads SIM state (skin temps, burns, fuel), keeps mark state render-side | in `launchpad/index.html`: `MESH_VS`/`MESH_FS`, the mesh helpers (`lathe`, `box`/`rbox`, palette `C`), `partShape`, `partsMesh`. Additive in `partShape` (planning may add parts there); will re-check the builder's editor view after each change. Not touching assemble/PRESETS/editor UI, economy, terrain/sky shaders. |
| Caio + Claude (aerofx session) | 2026-10-08 | All FX + volumetric clouds MERGED and pushed (`218364e`). NOW: FX for new features: escape-tower motor plume (solid propellant), landing dust on airless bodies, explosions (PLAYTEST #5). Worktree `C:/Users/caioa/dev/launchpad-aerofx` / branch `aerofx`. Render-only. **Note for visuals:** one additive plume-light block in your `MESH_FS` after the floodlight term (`uPl`/`uPlC`); keep it | in `launchpad/index.html`: plume/impact draw blocks, `PROPS`/`PFX`, `spoolOf`/`plumeEngines`, smoke emitters, the boom draw (`booms`, `HOOK.boom` body only, not its callers), new dust/explosion shaders. Reads `S.lesT` (bodies' abort), does not change the abort sim |
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
| Caio + Claude (bodies session, machine `pc_de_varginha`) | 2026-10-07 | Launchpad: more bodies. Body tree + Nyx MERGED (`61ff6a1`); 6b perturbations near Nyx MERGED (`cba2d3e`). Selene perturber + per-orbit gating + nodes MERGED (`60b1b7b`). "Out there" missions (epochs 4–5) MERGED (`9b191b3`); epoch 3 utility missions MERGED; crew + escape tower + abort tests + crewed Selene missions MERGED (`9c821b3`); Crewed Lunar preset MERGED; flown end to end (`fly_crewlunar.mjs`, test §27) MERGED. Idle. **For plumes:** the escape tower (`les`) fires during `s.lesT>0` with no plume yet. **For visuals:** `partBody` has new cases `les` and `crew` (crew draws as the pod). **For sats/builder:** Backspace = abort; tape op `A`. **For economy:** `missionEval`'s payout is now `missionComplete(M,rec)` (same behaviour), and `worldTick` ends with `utilTick(d)` (TV income, world missions). Mission content for later epochs gets built here (Caio's call). **For economy:** additive only: new entries appended to `MISSIONS` (ep 4–5), new `R` fields, one `outThere()` call at the end of `missionTick`, new `LOGF` facts in "Out there", `renderProgram` epoch labels; `RACE` untouched. **For economy:** Nyx missions spec in launchpad NOTES § "Nyx missions — spec" (yours to build; I touched one of your checks: satellite precision now tolerates 1e-3 M, the tides nudge test orbits). **For sats:** craft now feel the moons' tides (low orbit drifts metres a month); `satAt` is still pure Kepler. **Repo:** `receive.autogc=false` set in the Drive repo (pushes from this machine could auto-prune worktrees it can't see). **Note for planning:** your era map's body loop now iterates `BODIES` (Nyx gets drawn); new perturbation code is `pertAcc`/`coastPlan`/`coastStep` near `soiAt`. Local clone `C:/Users/caioa/dev/launchpad-bodies`, branch `bodies` (= main), port 8777. **Anyone on this machine:** do NOT `git worktree prune`, the 'prunable' worktrees are live on the other machine | when active: in `launchpad/index.html` SIM, the body tree (`addBody`, `bodyRel`, `soiAt`, `NYX`), `checkSOI`, rails step limits, `predictFrom`/`escTime`; render `MOON_FS`/`drawMoons` and the map's body loops. **For all:** iterate `BODIES` instead of naming `SELENE`; use `soiAt(b,t)`, not `b.soi` (Nyx's SOI breathes; `b.soi` is its max) |
| Caio + Claude (control session) | 2026-10-08 | Launchpad attitude control. **v1.40 MERGED** to `main` (`45dd447`, not pushed): real per-engine gimbal, steerable fins (`cfin`/`cfins`/`cfins25`), SAS lag zone + rate integral. Idle. **For visuals:** `p.gv` (nozzle deflection) and `p.fd` (fin plate angles) are there to draw (NOTES v1.40 "For other sessions"). **For anyone tuning SAS or scripted kicks:** prograde tracking is now exact, so a fixed kick pitches over a little later (§12's tape kick went 0.95 → 1.2 s). Next: builder control-authority readout, weaker saturating wheels. Worktree `launchpad-control` / branch `control`, port 8796 | when active: `ctrlAuthority`/`ctrlAuthRoll`/`ctrlAccel`, `gimSteer`/`finCols`, the control lines at the top of `physStep`, the fin loop in `aeroPass`; engine/fin PARTS fields; test.mjs §35 |
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
