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
| planning (parts & missions) | `C:/Users/caioa/dev/launchpad-planning` | `planning` | 8775 |
| visuals (part look & textures) | `C:/Users/caioa/dev/launchpad-visuals` | `visuals` | 8776 |

> **Heads-up, 2026-10-07 (planning): the planet was rescaled on `main` (`ae0fd7b`). Merge `main` before your next slice.**
> Tellus is now 1,274 km (a fifth of Earth), 9.81 m/s², an 8 h day (`DAY_S` follows the rotation), 100 km of air (scale
> height 7.5 km); Selene is 348 km at 38,440 km. Heating gain ×3 → ×1. Lunar, Big Lunar and Passenger presets resized.
> Tests now use `LEO` / `ATM` / `VENT` from the planet instead of 600 km literals: use them in new checks. **Terrain:**
> your baked map's texels double in km, and anything tuned in metres on the old radius needs a look. Details:
> launchpad NOTES, "The planet's size".

Snapshot of the Drive folder's uncommitted work at the switch (builder + terrain hunks mixed in `index.html`/`test.mjs`,
plus `builder.js`): `C:/Users/caioa/dev/handoff/`. Each session moves its own hunks to its worktree, commits there,
then removes them from the Drive folder.

## Currently Active

| Operator | Started | Scope | Files at risk |
|----------|---------|-------|---------------|
| Caio + Claude | 2026-08-11 | Landing page rebuild (live-preview cards) for custom-domain launch | `index.html` (ROOT landing page), `README.md` |
| Caio + Claude (economy session) | 2026-10-07 | Launchpad: program/economy (missions, contracts, budget, calendar, powers) | in `launchpad/index.html`: the SIM program block (PRICE … MISSIONS … missionEnd, powers/worldTick, new contracts block), `missionTick`, `renderProgram` + a new program-UI section, HUD `payloadRows`; new checks appended in `test.mjs` §14. Not touching assemble/PRESETS/editor UI. |
| Caio + Claude (visuals session) | 2026-10-07 | Launchpad visuals. Slice 1 (early-era part look) MERGED to `main` (`bee8d79`, docs `40f3ab1`). Slices 2 (flight marks) and 3 (launch complex) MERGED to `main` (`b3ea9f0`, log `2fd14dd`). NOW: pad follow-ups (lights, swing arms, tower height) and revisiting the buildings around the pad. **Note for terrain:** I only change the CONTENTS of the `PAD` mesh (`const PAD=…`, pad-local frame, everything at or above y=0, buildings kept on your ground-shader slabs at (36,18), (−45,−25), (20,−30)). I am NOT touching the `drawMesh(PAD,…)` call, `uPadL`, `siteH` or `padGround`. Your `siteH` change to the draw transform should merge cleanly. Worktree `launchpad-visuals` / branch `visuals`, port 8776. Render-only: reads SIM state (skin temps, burns, fuel), keeps mark state render-side | in `launchpad/index.html`: `MESH_VS`/`MESH_FS`, the mesh helpers (`lathe`, `box`/`rbox`, palette `C`), `partShape`, `partsMesh`. Additive in `partShape` (planning may add parts there); will re-check the builder's editor view after each change. Not touching assemble/PRESETS/editor UI, economy, terrain/sky shaders. |
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
| Caio + Claude (bodies session, machine `pc_de_varginha`) | 2026-10-07 | Launchpad: **more bodies** (open thread 6): generalize the one-moon SOI code to a body tree. Local CLONE (not a worktree; this machine can't see the others' `C:/Users/caioa/dev`) at `C:/Users/caioa/dev/launchpad-bodies`, branch `bodies`, pushed back to the Drive repo per slice. Port 8777 | in `launchpad/index.html` SIM block: `TELLUS`/`SELENE` body definitions, SOI enter/exit, the patched-conic planner/predictor, rails, body lookup in render (moon drawing, map). **Controllers session:** if you touch SOI transitions or `body` handling in the stepper, ping here first. **Anyone on this machine:** do NOT `git worktree prune`, the 'prunable' worktrees are live on the other machine. |
> Cleared 2026-10-07: sats session, registered satellites drawn in 3D, merged to `main` (`d803a54`, not pushed). **Economy:**
> `satRegister` now also stores `shape`/`qo`/`cm` (render-only) and sets `rec.satId`; test.mjs §20 appended. **Anyone committing
> on `pc_de_varginha`:** neither the Drive repo nor a fresh clone has a git identity here; use `git -c user.name=… -c user.email=…`.
> Cleared 2026-10-07: terrain session, v1.25 merged to `main` (`ccb136e`, not pushed). The worktree `launchpad-terrain` / branch `terrain` stays for the next terrain session; start at NOTES § v1.25 "Next session". `builder.js` and the foreign-station test each got one small change (see the session log).
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
