# Launchpad notes — Platform & QA
**Version**: 1.0.7 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-11 (split from NOTES.md v1.21.52, W37) · **Updated**: 2026-11-11
**Purpose**: The build log for tests and shards, the tester menu, the robot playtester, the file split, saves, numbering, the session recorder, platform direction.
**Status**: live log, oldest first; new sections go at the bottom. Index of every section: [`../NOTES.md`](../NOTES.md).

---

## Platform direction: native desktop later, the browser for now (Caio, 2026-10-08)

**Decision.** The finished game is a **native desktop** app; the browser was the experimental start. For now, keep the
single HTML file with no build step: rapid iteration and the parallel sessions matter more than raw speed at this
stage. Note the port's considerations here, don't act on them yet.

**Where the time goes today** (RTX 3050, 1024×768, measured 2026-10-07):
- **The GPU dominates.** The sky and terrain shader costs ~3–9 ms a frame (worst: low views across rugged terrain);
  ~2–2.6 ms without terrain. That's GLSL and algorithm-bound. A native port helps only through what a native GPU API
  allows (compute shaders, bindless textures, async compute), not through the CPU language.
- **CPU per frame** is ~0.3–2 ms.
- **The CPU costs that hurt are bursty:**
  - page load ~1.5–1.8 s (world generation, sites, cities);
  - prediction and warp loops;
  - the test suite.

**Cheap wins before any port:**
- world generation in a worker, or baked on the GPU, and cached;
- no small-array allocations in the vector maths of hot loops (`add`/`sub` return new arrays: GC churn);
- typed arrays in hot loops.

**When native pays:**
- the simulation becomes the bottleneck: many vessels, n-body everywhere, part-level physics, big debris fields,
  long warps with physics on;
- a real desktop build. Likely Rust with wgpu, which also opens compute shaders for terrain and generation.

**How to keep the port cheap, starting now:**
- **The SIM block stays pure** (no DOM/GL). It is the part that ports mechanically.
- **The headless checks are the oracle.** A port of `physStep`, `kepler` or `makeWorld` must reproduce their numbers.
  Golden fingerprints of world generation and flights (LESSONS #16) make that exact.
- **Shaders:** GLSL ES 3.00 translates to WGSL/SPIR-V almost line by line. Keep shader logic in plain functions, as
  the terrain code is (`hgtG`, `terr`, `march`).
- **CPU/GPU parity tricks carry over unchanged.** Integer hashes, `texelFetch` with your own weights, a hand-written
  `atan2`, float64 on the CPU with camera-relative float32 on the GPU (§ v1.25).
- **Piecemeal is possible even before the full port.** A hot kernel can move to WebAssembly behind the same function
  signature, with the JS version kept as the reference.

## The tester menu (2026-10-08, tester session; PLAYTEST #1)

Cheats for playtesting. Open the page with **`?tester`** in the URL (`index.html?tester`); a yellow TESTER badge shows at
the top, and **F2**, the badge or the Esc menu open the menu. Without the flag nothing changes: no badge, no key, no row
in Help.

**Never touches the career.** In tester mode the program saves to its own slot, `launchpad-program-tester`
(`PROG_KEY` follows `TEST.on`); `launchpad-program-v1` is neither read nor written. The menu can copy the career into the
sandbox or wipe the sandbox (both click twice, then reload). The cheat switches persist per browser in
`launchpad-tester-flags`.

| Control | What it does | Where it acts |
|---|---|---|
| Infinite money | funds never below 100,000M | `testTopUp()`: each frame, at load, after every menu action |
| Full know-how and certification | every part at use 1 and certified 100 %; flight safety signs off | `khUse`, `certOf` |
| All tools | impact prediction, maneuver planning, encounter forecasts without the logbook facts | `toolOK` |
| No ignition failures | engines always light | `igniteOK` |
| Instant stacking | a launch takes no preparation days | `R.prep` in `missionTick` |
| Epoch 1–5 | marks every mission of the earlier epochs done (`done[id].test=true`), clears later ones; range streak to 3 | `testEpoch(n)` |
| World date +1 d … +1 year | a day at a time through `advanceDays`, so budget, elections, rivals, eras and news all run | `testAdvance(d)` |
| Finish every job | facilities, design bureau, test stand, production lines, trajectory studies done now | `testFinishJobs()` |

Epoch and date are disabled during a flight (the flight's clock owns the date then).

**For other sessions.** The rules live in the SIM tester block after `advanceDays` (`TEST`, `testTopUp`, `testEpoch`,
`testAdvance`, `testFinishJobs`); the menu is after the shared keydown handler (`renderTester`). Each cheat is one read of
a `TEST` flag in your code: keep it if you rework `khUse`, `certOf`, `toolOK`, `igniteOK` or the `R.prep` line. A new
cheat = a flag in `TEST`, a row in `TEST_FLAGS`, one read where the rule lives, a check in test.mjs §37. KEYS rows can
carry `tester:true` (Help shows them only in tester mode).

**Found on the way: two missions shared an id.** Epoch 3's "Weather satellite" was `id:'weather'`, the same as epoch 1's
"Above the weather". `PROG.done` is keyed by id, so the sounding flight also ticked off the satellite and opened
Disaster watch early. Now `wxsat` (Disaster watch's `req` and the §-epoch-3 checks follow). §37 checks every mission id is
unique. Careers saved before this keep `done.weather` (the epoch 1 flight) and see the satellite as not done yet, which
is right.

**Added 2026-10-08 (QA session, QUEUE Q16):** *Go to day* N (forward runs every day's rules through `testAdvance`;
back moves only the calendar, so what happened stays and deadlines and jobs are further off), *Set funds* to any number,
negative included (it turns *Infinite money* off, or the top-up would undo it), a button per **computing era** (the date
runs on a day at a time until `compEra()` reaches it: the era follows the date and the power's lag as in play, it never
overrides them), and a folded **Missions** list with one checkbox per mission (marked `test:true` like the epoch
picker's). SIM: `testGoto`, `testFunds`, `testEra`, `testMission` after `testFinishJobs`; checks in test.mjs `qa-1`. All
of them wait while a flight is on, like epoch and date.

## The gantry no longer clips the rocket (2026-10-08, tester session; PLAYTEST #2)

**Cause.** The service gantry rolls back toward −z, open front first, yet two girders spanned that open front (at a
third and two thirds of its height). Over the 14 s roll they swept straight through every rocket, wide or narrow. A
second, smaller one: the service position was a fixed −3.3 m, so the work decks' front edge sat at z = −2.3 m, inside
any stack reaching further than that (the Crewed Lunar's boosters reach 2.75 m).

**Fix** (`buildRig`, `padRig`, `drawPadRig`): no girders across the open front; side girders along each pair of columns
instead. The service position follows the stack: `RIG.zS = min(−3.3, −(zr + 1.5))`, where `padRig` now measures `zr`,
the widest |z| reach of any part (boosters included), so the decks stop 0.5 m short of it. Narrow rockets keep −3.3 m.
test.mjs §38 runs the page's own `buildRig`/`padRig` with stubs that record every box and sweeps the whole roll-back
against each preset's envelope; on the old code it fails (the front girder reaches the Orbiter at −5.2 m).

**For visuals:** the gantry is yours. If you restyle it, keep the open front clear; §38 will tell you.

## The hold-downs follow the rocket (2026-10-08, tester session)

The open item from "The launch complex": four hold-down posts stood fixed on the pad's diagonals at 3.4 m, with arms to
the core's base, so boosters on a diagonal (radial ×4 at 45°, or three at 120° steps) had an arm through them and a post
under them. Now the posts are part of the rig (`buildRig`, mesh `RIG.posts`, drawn in `drawPadRig`) and `holdPlan`
(next to `padRig`) places them: on the diagonals if those are clear (every preset: nothing changes), otherwise the set of
four turns, 1° steps, to the angle with the most room between the parts down at clamp height. Each arm clamps the
outermost part on its line (the core, or a booster if one is still in the way) and its post stands 1.2 m beyond, never
inside 3.4 m. The pad mesh keeps no posts.

Bug on the way: the room measure first skipped only the core engine, so the core's own fins and tank (also on the axis)
counted as obstacles at every angle and nothing ever turned. It now skips everything centred on the axis.

test.mjs §39 checks arms (to 90 % of their length, short of the clamp) and posts against every part's cylinder, for the
presets and for Asparagus/Crewed Lunar with their boosters turned 45° (and one with three boosters). It fails on the
old code: an arm through the turned Asparagus's booster engine. TESTING rows 108 (gantry) and 109 (hold-downs).

## The robot playtester (2026-10-08, playtest session)

Caio can't playtest for now, so this session built a machine that walks as many TESTING.md rows as a machine can judge:
`playtest.mjs`. One headless Chrome on the real GPU, driven over CDP like `shot.mjs`, but persistent: many rows per run.
A Claude session then read every screenshot against the row's "Looks right if".

**How it works.** `ROWS[n]` in `playtest.mjs` is the row table: `steps` (a string is JS evaluated in the page and its value
logged; `{shot}` captures `r<n>_<name>.png`; `{wait}`, `{key}` and `{hold}` send real key events through CDP; `{click}`
clicks an element's centre), then `checks` (expressions evaluated at the end) and `expect` (a failed one fails the row).
Before each row the page's storage is wiped, the tester flags are written by a script that runs before the page's own
(`Page.addScriptToEvaluateOnNewDocument`), the page loads with `?tester`, and `views.js` plus a helper object `PT` are
injected. Unless the row asks for the gate, `PT.start()` picks the first career start and goes to the Assembly. `PT` has
`preset`, `launch`, `fly(cond, tmax, {ascent, autostage, each})` (advPhys in a loop: kick at 8 s, then Prograde, staging
on burnout), `alt/agl/aoaDeg/orbit`, `look(yaw, pitch, dist)` (HUD back on, camera set), `log` (every `HOOK.msg` and
`HOOK.news` with its sim time), `hud()`, `msg()`. A row that needs the game's own frame step (tape recording, warp,
keys) uses `SIM`: the live loop is frozen and `simulate(1/60)` is called by hand. Exceptions thrown in the page fail
the row. Output goes outside the repo: `C:/Users/caioa/dev/playtest-out/` (PNGs, `results.json`), `PT_OUT` to change it,
`PT_IGPU=1` for the integrated GPU. `node playtest.mjs --eval "<js>" …` is a probe: a fresh tester page, each expression
evaluated and screenshotted.

**Coverage.** 58 of the 113 rows judged: 37 ✓, 4 ✗ (104, 110, 84, 97), 17 ~ (mostly "the numbers are right, the feel
needs a human"). Skipped, and why: the hand-flying and feel rows (1, 12–16, 101, 69, 71, 73, 76, 78, 89, 99); mouse work in
the builder (17–21, 24); docking, stations, rovers in the field and the moons (49, 50, 53–74 apart from 51), each a
long multi-flight setup worth its own driver; city and range-safety flights (16, 32, 111–113); the HUD with everything at
once (98). Rows 23, 31, 45, 80, 81, 83, 92, 94 were left for lack of a reliable setup in the time-box.

**What it found** (PLAYTEST #15–#23): the TESTER badge over "Save as autopilot" (#15); the news box over the flight
readout's altitude (#16); "plasma blackout" and a plasma shell on an ordinary ascent at Mach 3.5 (#17); holding a pitch key
with SAS off spins the Orbiter's upper stage until it tears apart before the wheels fill (#18); the Link row says "no
station in view" for 2 s after liftoff (#19); LAUNCH and the site picker below the fold of the assembly panel (#20); a
landed flight isn't settled until the next launch, so refund, know-how and logbook news arrive late (#21); `refView(8)`
throws and the gantry blocks close-ups 4, 6, 9 (#22); two builder wording nits (#23). No page exceptions anywhere else.

**Measurements** (RTX 5050 laptop, headless, 1280×800). Page load to first row ~35 s on a fresh profile (shader
compiles), then 4–12 s a row; the whole table in ~7 min. A 1,360 s parachute hop runs in about a second of advPhys.
Heavy at night, engines lit on the pad: RTX median frame 8.3 ms (vsync 120 Hz, GPU 4.7 ms); Intel iGPU median 36.6 ms,
p95 39.4, adaptive resolution still at 100 % after 3 s (TESTING row 47 had ≈26 ms). Physics numbers are in the rows'
*Robot:* notes (turn times match the builder within 10 %; boosters leave at 2.4 m/s; polar launch 27.2°; the impact
predictor lands within 50 m; an autopilot replay lands on the recorded position to 0 m).

**Negative results and traps.**
- `shot.mjs`'s flags (`--use-angle=d3d11 --enable-gpu`) put headless Chrome on the **Intel iGPU** on this laptop (GPU_NAME
  "Intel", 24 fps idle). `--force_high_performance_gpu` gets the RTX (120 fps). `playtest.mjs` adds it by default;
  `shot.mjs` still doesn't, so its screenshots have been iGPU renders.
- In `--headless=new` requestAnimationFrame ticks at full rate (unlike the hidden preview pane), but long flights are
  still driven with advPhys loops. That skips what the frame loop does: tape recording (`tapePhys` lives in `simulate`),
  message timers (a stale "Liftoff!" stays on screen), the HUD's impact row (computed on frames: it shows "—"), and the
  gantry's roll-back clock, which starts at the first render after launch. Render once right after launch, and use the
  `SIM` helper when the row is about those.
- Every launch moves the world date (prep, pad wait, the next whole day), so weather differs between launches. Separate
  climbs to 36 and 44 km looked like the cloud deck vanished at the hand-over; the same moment rendered from 36–44 km
  shows no change. Compare renders at one moment.
- The Program and tester panels re-render on every click, so a saved element reference goes stale after one click:
  query again each time. `go('program')` while already there is a no-op, so the header isn't refreshed after a
  `testAdvance` called from JS.
- Escapes inside the row table's template literals get eaten (`'\n'` became a real newline, `\s` became `s`): use
  `String.fromCharCode(10)` and `[^]`.
- Reading screenshots costs context: 2×2 half-size contact sheets with a crop for details made ~300 images reviewable.

**Rerun.** `python -m http.server 8799 --directory <repo>/explorations`, then from `explorations/launchpad`:
`node playtest.mjs` (all rows) or `node playtest.mjs 104 110` (some). Add a row: a `ROWS[n]` entry next to its area's
rows; a row that needs two setups can use a string key (`'82b'`).

## PLAYTEST sweep #15–#22 (2026-10-08, fixes session)

Six items the robot playtest filed (PLAYTEST #15, #16, #19, #20, #21, #22), plus #8, which turned out to be the same
layout bug as #15. Code commit `5eb1bd4` on branch `fixes`. Checks: test.mjs § `fixes-1` (all four checks fail on the old
page, pass on the new one), and the robot rows 4, 9, 25, 35, 48, 77, 84, 96, 110 rerun on the RTX (screenshots in
`C:/Users/caioa/dev/playtest-out/fixes/`, outside the repo).

- **#8 and #15: the toolbar and the TESTER badge.** The flight toolbar `.tr` never had a `position`, so its `right/top`
  did nothing: it sat in the page flow at the top left, half under the readout, and the badge (top centre) landed on
  its last button. `.tr` is now absolute at the top right (wraps when the window is narrow, keeps 290 px clear for the
  readout). `hudLayout()` moves the badge into the toolbar as its last item in flight, and back to the top centre on the
  other screens (Program, Assembly, Rover yard leave it free).
- **#16: the news box over the readout.** The news was centred at a fixed `top`; a readout with long rows grows to
  ~510 px and reached under it. `hudLayout()` (each HUD update at 10 Hz, each headline, each screen change) gives the
  news a lane: centred if that clears everything, otherwise from 10 px right of the readout to 10 px left of the
  maneuver-node or rover panel, and below the toolbar where they overlap. With less than 240 px beside the readout it
  goes under it. Off the flight screens the CSS position is restored. Checked on a landed capsule (Passenger row) and a
  Lunar climb, at 1280×800 and 1000×700.
- **#19: "no station in view" for 2 s after liftoff.** Not the terrain mask but the minimum elevation: the pad's
  station is the pad itself, its antenna `GS_MAST` = 20 m up, so a rocket still below the mast top is at negative
  elevation, under `STA_MIN` (5°). The elevation limit and the horizon mask describe long paths that graze distant
  ground; within `GS_NEAR` = 2 km of the antenna the path is direct, so `gsSees` returns true there. Measured: Link
  "on the ground" → "Fenfen Cape" at T+0 (first airborne step 7 m up); before, "no station in view" until T+2.0, 19 m.
  `gsSees` also serves satellite downlinks; nothing in orbit comes within 2 km of a station.
- **#20: LAUNCH below the fold.** The assembly's right panel scrolled LAUNCH to y ≈ 1,160–1,350 px. LAUNCH and a
  one-line site summary (`#siteLine`: site · latitude · weather, a ⛔ when access or size refuses it, a downrange
  note) now sit in `#edFoot`, `position: sticky; bottom` inside the same scroller, so nothing else in the panel moved
  (the robot's `#editor .right` scroll still works). Measured at 1280×800: LAUNCH at y 735–773 for all 11 presets,
  Crewed Lunar included.
- **#21: a landed flight settled only at the next launch.** `missionEnd` ran from `resetShip` (LAUNCH, Revert) and,
  through `editorChanged`, on entering the Assembly; going to the Program left the flight open. Now `go()`, leaving
  flight or map for any other screen, calls `flightLeave(S)` (in the SIM: the player leaving a flight ends it there;
  it is `missionEnd`). `missionEnd` already returns at once for a settled flight (`R.ended`), so Revert, a second
  leave and the next launch pay nothing more. test.mjs: a Sounding flight landed and left pays its refund (+13M), counts
  the flight and raises Sparrow know-how 0.20 → 0.35 at once; then revert + leave + relaunch leave funds, flights and
  know-how exactly as they were. The robot's Sounding now reads `settledAtProgram: true`, funds 80 → 103.7M at the
  Program. **Economy (paused):** nothing inside `missionEnd` changed; it is now also reached from `go()`. The planned
  Debrief screen (§ "UI: screens and navigation") can hang off `flightLeave`.
- **#22: reference close-ups.** `views.js` view 8 asked for the Lunar's `t8`, gone since the resize; it centres on
  `T16` now, and a close-up whose part is missing throws a message naming it. Close-ups 4–9 set `HOOK.noRig` (checked
  at the top of `drawPadRig`; every `refView` call clears it), so the gantry, swing arms and hold-downs are hidden, and
  4, 6, 8, 9 look from the west (yaw < 0): the umbilical tower stands east of the rocket (`+X`, the arms at x = 5.5 m), so
  it is now behind or beside the part instead of in front of it.

Seen on the way, not fixed: in the robot's headless Chrome the flight readout can stay empty for ~30 s after a long
synchronous `PT.fly`, because the first `requestAnimationFrame` timestamp comes out ~30 s *before* the script's
`last = performance.now()`, so `dtR` is negative and `hudT` climbs instead of counting down. Same on the old page;
probably harness-only, but `frame()` could clamp `dtR` at 0.

## Test shards (2026-10-08, platform session; ROADMAP § Platform lane, step 1)

> **Since 2026-10-11 (QUEUE Q68): the sections live in `tests/<lane>.mjs`, not in `test.mjs`.** Every lane appended to
> one 5,200-line file, the next conflict hotspot after the script split. Now `test.mjs` is the prelude (the SIM as `api`,
> `check`, the planet's `LEO`/`ATM`/`VENT`) and the summary, with a `// ==== SECTIONS: tests/` line between them; the
> 171 sections moved unchanged to `tests/core.mjs` (the 78 numbered ones, and `fixes-1`) and one file per lane:
> `flow`, `economy` (`econ-`), `vehicle` (`vehicle-`, `control-`), `space` (`space-`, `bodies-`), `world` (`ground-`),
> `look` (`aerofx-`, `sound-`), `qa`, `platform`. `shards.mjs` splices them back in `TEST_FILES` order and runs the result
> as one module, so **every run, the full one too, is the shard runner's**: `node test.mjs` with no arguments builds the
> whole suite and runs it in one child process (the same scope, the same `PASS`/`FAIL` lines). Labels, selectors,
> `--smoke`, `--jobs`, `--isolation` are unchanged; `--list` shows `file:line`.
> - **A new section:** at the end of your lane's file, `// <lane>-<n>. Title` at column 0, then a `{ … }` block. A new
>   lane file needs its name in `TEST_FILES`. The files aren't modules on their own (they use `api` and `check`).
> - **A branch cut before the split** that added a section to `test.mjs`: merging `main` conflicts in `test.mjs`. Keep
>   `main`'s `test.mjs` and move your section to the end of your lane's file. A section left inline above `END OF
>   SECTIONS` still runs (first), so a half-done move doesn't silently drop checks.
> - **Checked:** the full run after the split has the same 629 `PASS` names as before it (sorted; the order across files
>   changed, which `--isolation` had already shown is safe), 0 `FAIL`; `--list` has the same 171 sections.

`test.mjs` had grown to 82 sections (84 after merging `main`), and every session paid for all of them on each edit. `node test.mjs` with no
arguments still runs everything in one process, exactly as before: **merges run that**. With arguments, `test.mjs`
hands over to `shards.mjs`, which cuts the file into sections and runs a chosen subset in a child process:

| Command | What it runs |
|---|---|
| `node test.mjs --list` | every section: position, label, line, title |
| `node test.mjs --only 12,#53,docking` | by label (every section carrying it), by `#position` from `--list`, or by a word in the header comment |
| `node test.mjs --skip 27,bodies-1` | everything but these (combines with `--only`) |
| `node test.mjs --smoke --jobs 4` | everything but the five long flights (`SLOW` in `shards.mjs`): **22 s** in 4 processes, ~55–75 s in one |
| `node test.mjs --times [--jobs 4]` | the full suite with the seconds per section |
| `node test.mjs --isolation --jobs 4 [--only …]` | each section alone vs the same section in a full run; lists any whose checks change |

**What a section is.** A comment at column 0, `// 12. Title` or `// control-3. Title`, up to the next one. Everything
before the first (the SIM, `api`, `check`) and everything after `// ==== END OF SECTIONS` (the summary, the exit code)
runs in every shard. **New sections go at the end of your lane's file in `tests/`** (since Q68; was: above that line). A section using a top-level function another section declares
is run with it (`fly` lives in §3, so 10 sections pull §3 in). Labels repeat (§25 is four sections) because lanes
numbered in parallel; that's why selectors also take words. Renumbering would break the "§N" references in this file.

**Which sections cover what** (the lane words work as selectors: `--only "sats session"`):

| Area | Selector | Sections |
|---|---|---|
| orbits, flight, aero, heating, staging (the oldest core) | `--only 1,2,3,4,5,6,7,8,9,10,11,12,13` | 13 |
| the program, contracts, money | `"(economy"` plus `14` | 15 |
| bodies, missions out there, procedures, dispatch | `"bodies session"` (`procedure` for the procedure ones) | 9 (+§3) |
| registry, rendezvous, docking, stations, rovers | `"sats session"` (`docking`, `station`, `rover`) | 18 |
| attitude control | `"control session"` | 5 |
| the world, sites, ground stations, recovery | `"terrain session"` | 7 |
| logbook, ground stations, registry (planning) | `"planning branch"`, `logbook` | 3 |
| builder trees, staging editor, canted engines | `#16,#18,#19,#21` | 4 |
| tester menu, gantry, hold-downs | `"tester session"` | 3 |
| screens and keys (KEYS ↔ Help, `go()`) | `"ui session"` (§32 at `#53`) | 1 |
| sound | `sound-1` | 1 |

**Measured (2026-10-08, other sessions running).** The full suite takes **286 s**, not 8 min; 74 % of it is two
sections: the crewed Selene landing (§27, 111 s) and the ladders (bodies-1, 102 s). Then §14 the program (9 s),
bodies-2 (6 s), §28 procedures (5 s); the other 77 sections take 53 s together, most under a second. In one process
there is ~30 % run-to-run noise from machine load.

**Every section stands alone, after two fixes.** `--isolation` ran each of the 82 sections by itself: 81 matched the full
run. §14's *budget day* check failed alone (+16.5M where it needs > 16.5M): `worldTick` seeds its dice from
`PROG.wseed` and the cycle's phase `PROG.cyc` carries over, and §14's `fresh()` resets neither, so the grant depended on
what earlier sections had drawn. The check now pins both (`P.wseed = 4242; P.cyc = π/2`). That was a latent flake in the
full run as well: any section added above §14 that drew from the world's dice could have tipped it. **Economy:** the
check is yours; the pin is test-only. **Everyone:** a new section should pass alone; `node test.mjs --isolation --only
<it>` checks that in a few seconds.

The second fix came from `--jobs` itself: a full run in 4 processes failed §18 *career offers* ("ordinary: hire"), a
check that had passed both alone and in the full run. Its `fresh()` pins `wseed` but kept the PROG fields it doesn't
name (`cyc`, `bailRecent`, …), so its outcome depended on which sections ran before it in the same process. `fresh()` now
deletes every PROG key first (as §24–§28 do when they restore a save). Alone-vs-full can't catch this kind; a parallel
run (different neighbours) can. After both fixes, a full run passes sequentially and in 4 processes (286 s → 136 s;
§27 alone bounds it at ~110 s).

**Shared state is the thing to watch.** The SIM keeps one `PROG`, one `HOME`, one `api.S`/`api.t` per process, and
sections hand them on. A check that sets only the fields it cares about is betting on its neighbours. Start from a
whole reset, or use an own SIM instance (`new Function(src + …)`, as the sats and tester sections do). The file split
(ROADMAP step 3) should give tests a `freshSim()` that makes the second the easy way.

**Negative result.** "One quick section per area" was the plan for `--smoke`; measuring showed the cheap sections are so
cheap that "all but the five slow flights" covers 77 sections for the same minute, so smoke is defined by exclusion.

## The file split (2026-10-08, platform session; ROADMAP § Platform lane, steps 3–4)

`index.html` was one 6,700-line, 780 KB script that every lane edited, so every merge conflicted inside it. Its script is
now **21 classic scripts** in `sim/` and `app/`, loaded in order by `index.html`. Nothing else changed: the same code,
in the same order, cut at existing section headers. There's still no build step, and the page still opens from `file://`.

**Why classic scripts and not ES modules (the ROADMAP said modules).** Modules would need an import and an export for
every name used across files, and imported bindings are read-only: the many `let`s reassigned from other parts of the
code (`simT`, `S`, `HOME`, `mode`, …) would break. That's a rewrite, not a split. Classic scripts share one global
scope exactly as the single script did, so the split is mechanical and its oracle is exact. Modules can still come
later, one area at a time, once an area's cross-file names are few.

**How it was done.** `archive/launchpad-split-2026-10-08.mjs` (one-time; kept for the record) cut at header lines found
by their text, gave each file after the first a two-line prelude and `'use strict'`, and pointed the Node tools at
`page.mjs`. Checks, all passed:
- `page.mjs` puts the files back into one text, and that text was the old `index.html` plus the preludes, byte for byte.
- The full suite on the split tree passed (the oracle).
- Every SIM file loads as its own script, in page order. That is test `platform-1`, which stays.
- The robot playtester walked every row on the split page, comparing console errors against the pre-split page.

| File | Lines | Holds | Usual lane |
|---|---|---|---|
| `sim/core.js` | 155 | vectors/quaternions, the body tree, perturbations, Kepler (opens with `SIM BEGIN`) | space |
| `sim/vessel.js` | 748 | parts, design v2, resources, the vessel, avionics, wheels, aero, structure, gimbal, heat | vehicle |
| `sim/flight.js` | 241 | SOI changes, ground contact, abort, legs, maneuver nodes, impact prediction | vehicle / space |
| `sim/world.js` | 282 | the world, launch sites, recovery, ground stations, plasma blackout | world |
| `sim/program.js` | 643 | missions, budget, calendar, tester menu, out there, staged pay, powers, industry, know-how, stand, development, facilities, compute, timeline, dispatch, deviation, production | economy |
| `sim/atlas.js` | 40 | the atlas grid | world |
| `sim/contracts.js` | 243 | contracts, sanctions, the race, ownership, decisions | economy |
| `sim/space.js` | 647 | registry, rendezvous, contact, docking, fleets, bay, stations, arm, moonbases, moon orbits, RCS; since v1.60: station-keeping, decay, debris (objects, conjunctions, fragment bands), missions in flight, planned burns | space |
| `sim/system.js` | 40 | the star system on paper (v1.94): `SYSTEM_BODIES`, `TU`, the ecliptic, `helioPos`, `fromTellus` | space |
| `sim/logbook.js` | 49 | the logbook, tools gated by it | economy |
| `sim/debrief.js` | 40 | the flight's debrief record (`debSnap`, `debriefOf`, `debPaid`) | flow |
| `sim/procedures.js` | 338 | stepping, flight tapes, procedures, headless flights | space |
| `sim/rovers.js` | 349 | rovers (ends with `SIM END`) | space |
| `app/gl.js` | 1,532 | WebGL2, shaders, meshes, planet/sky/plume/pad drawing | look & sound |
| `app/crew-look.js` | 77 | the astronauts' look (Q195): `crewFigure`, `SUITS`/`suitOf`, the crew on the access arm (`drawPadCrew`) | look & sound |
| `app/state.js` | 111 | app state | flow |
| `app/editor.js` | 127 | the editor UI | vehicle |
| `app/input.js` | 30 | input | flow |
| `app/screens.js` | 160 | `go`, `KEYS`, Help, overlays | flow |
| `app/rover-yard.js` | 195 | the Rover yard | space |
| `app/sound.js` | 81 | sound (the pure `SOUND MIX` block is inside) | look & sound |
| `app/loop.js` | 43 | `frame()` | flow |
| `app/render.js` | 347 | `render()`, bloom | look & sound |
| `app/program-ui.js` | 345 | the Program screen: contract board, satellites, logbook, era map; the start-up calls at the end | economy / flow |
| `app/flags.js` | 40 | flags and roundels as SVG (`flagSVG`, `roundelSVG`, `powerMark`, `newsMark`), from a power's school and hue (§ v1.112). Loads before `state.js` | flow |
| `app/hud.js` | 40 | the flight readout's cards (`HUD_CARDS`, `renderCards`, `cardFolds`, pins); new HUD content registers a card here (§ v1.101). Loads after `program-ui.js`: nothing at start-up calls it | flow |
| `app/debrief.js` | 30 | the Debrief screen (`renderDebrief`, Fly again, the End flight button) | flow |

**Working in split files: the rules.**
- **Find a function** with `grep -n "function name" sim/*.js app/*.js`. Markers (`SIM BEGIN/END`, `SOUND MIX`) are where
  they were.
- **The SIM stays pure:** `sim/` files touch no DOM or GL. The tests run them headless, as before.
- **Order matters across files.** Function declarations are hoisted only within their own file, so code that *runs at
  load time* (a top-level `const x = f()`) may only call functions from its own file or earlier files. Calls inside
  functions that run later are fine, whichever file they're in. `platform-1` catches a breach in `sim/`. In `app/`, the
  page throws on load, and the robot's console errors will show it.
- **A new file** gets the two-line prelude, `'use strict';`, and a `<script src>` line in `index.html` in the right
  place. `platform-1` fails if a file isn't loaded or isn't strict. Prefer a new file over growing `app/gl.js`.
- **Node tools read the page through `page.mjs`**: `pageSource()` is the old one-file text (the scripts inlined in page
  order), so `html.indexOf('// ==== SIM BEGIN')` and the regexes over page code work as before. `pageScripts()` lists
  the files.
- **Work from before the split:** every lane branch was merged into `main` before the split, so there should be none.
  If a stray pre-split change turns up anyway, don't hand-port it. Run the split script on that branch's `index.html`
  (it cuts at the same headers). The result is that branch's own `sim/`/`app/` files. Then three-way merge each file
  (`git merge-file`), with the split of the merge base as the base. This was done once, for bodies' Q13, pushed during the
  freeze. The quicker equivalent: three-way merge the *old-style* pages (`git merge-file` on the branch's, the base's and
  the pre-split `index.html`, all LF), then split the result. Its 53 changed lines landed cleanly in `sim/procedures.js`.

## The new-career robot run: M1's finish line (2026-10-08, QA session; QUEUE Q55)

`node playtest.mjs m1` plays a **new career with no tester flags**, the way ROADMAP § M1 words the finish line: it clicks
through the first-run gate (agency, the default power), flies a **Sounding** for *Above the weather*, leaves the flight
for the Program, then flies the **beeper** to orbit and leaves that flight too. It's written ahead of M1, so it fails
until M1 is done. Each expectation names the item that makes it pass:

| Check | Passes when | First run (`5ed4bf2`) |
|---|---|---|
| `tester` | the page isn't in tester mode | ✓ |
| `weather`, `beeper` | both missions are done after two flights | ✓ (day 57, 157M left) |
| `escPauses` | the sim clock doesn't move for 2.5 s with the Esc menu open | ✗ 2.5 s ran (flow Q39) |
| `debrief` | a debrief screen shows after each flight is left | ✗ none yet (flow Q2) |
| `boxes` | no two visible panels overlap by ≥ 40 px² on the program, assembly, flight, orbit and after screens at 1280×800 | ✗ PLAYTEST #25 (builder key strip), #26 (`#msg` over the readout) |

What it found on the way: **no preset can fly the beeper** or the passenger orbit (PLAYTEST #24, P1 for the
presets-only route), so the robot swaps the Orbiter's pod for an instrument package, which is what `career.mjs` assumes.
The Program after a flight draws the flown ship with "NaN%" joint labels (PLAYTEST #27).

**How it judges.** The ascent is `fly_ladder.mjs`'s `handAscent` run in the page (`PT.ascent`): it sets the attitude
directly, so the run proves the career path and the screens, not that a person can fly it on gyro-era SAS (TESTING row
101 stays a human row). The box check (`PT.boxes`) takes every visible positioned element with text, drops the
full-screen layers (`#hud`, `#prog`), keeps the outermost ones and lists each overlapping pair. `PT.debrief` accepts a
screen named `debrief` or any visible element with `debrief` in its id or class: **flow, name Q2's screen that way** or
change the check with it. Shots in `C:/Users/caioa/dev/playtest-out/` (`rm1_*.png`). A run takes about a minute.

**The M0 re-run (QUEUE Q29, same session).** `node playtest.mjs 104 110 84 97 122 5 96 48 9 35` after fixes, Q14, Q17 and
Q20: every fix holds (PLAYTEST #15, #16, #17, #18, #21, #22). Two new rows: **97** ends a flight three ways (landed,
crashed, left in orbit) and checks each is settled when you leave it; **122** flies the Heavy and the Asparagus through
max heating and records the Link row and `plasmaHeat` (no blackout, shell 0; heat peaks at 1.0–1.4 km/s, the shell
starts at 1.9). The one thing still in the way is a line, not a box: `#msg` is drawn over the readout (PLAYTEST #26).

## Plan: robot drivers for docking, stations and moons (2026-10-08, QA session; QUEUE Q30)

The rows nobody has driven are mostly ones a person can't reach quickly either: two vessels in orbit, a station, a moon.
The page has every function `test.mjs` uses (the SIM is the same globals), so **each driver copies its setup from the
test section that already proves the mechanism**, steps it with `advPhys`/`advRails`, measures the row's "looks right if"
numbers, and takes one to three shots. It doesn't fly there: setups are placed (`r`/`v`/`q` set directly), as §21–§42 do.
Feel stays a human row (59 "minutes, not an hour", 69 "learnable", 73 "fun"); the robot adds numbers and shots.

**Shared helpers** (in `PT`, next to `PT.ascent`): `orbitAt(body, km)` (the flown ship in a circular orbit, nose
prograde; §23 `craft()`, §40 `put()`), `twin(stack, offset, {fleet|registered})` (a second vessel beside it: a `FLEET`
member per §27/§28, or a registered entry per §21/§25 via `satRegister`), `dockTo()` (Docking SAS plus a proportional RCS
controller on `tgtOf(S).dr/dv`, the scripted closer §25 uses), `boxes()` (already there, for row 98).

| Slice | Rows | Setup borrowed from | Measures |
|---|---|---|---|
| 1 moons | 68, 72, 121, 73, 55, 54, 13, 125, 92 | `fly_ladder.mjs` LADDER + `procStart` phases; `flySite`; §23 nyxfind | each mission's news and pay (staged pay, row 92), Nyx's reveal text, prograde vs retrograde "Impact … (perturbed)" on the map, landing miss distance; shots of the map forecast and each landing |
| 2 docking | 56, 58, 59, 60, 61, 62, 63, 116 | §21 Rendezvous, §24 RCS, §25 Docking, §26 Claw, §22 Contact, §27/§28 fleet, §29 bay, §41 moon orbiters | time to close from 2 km and to latch, gas used, latch snap distance, push-off speeds, bump spin at 1 and 6 m/s, door swing frames, `[`/`]` labels; HUD shots |
| 3 stations | 64, 65, 66, 67, 115, 117, 98 | §30 Stations, §31 flyable vessels, §32 Arm, §33 Moonbases, §40 relay, §42 rover science | station line (crew, supplies, lab-days) after `stationTick`, Fleet → Fly round trip, arm berth/stow time, base listing, relay contact fraction over an orbit, science buttons' greyed reasons; row 98 = docked + RCS + target + three vessels, then `PT.boxes()` |

Each slice is a few rows of `playtest.mjs` (1–3 min of browser each, run as one batch when the lock is free) and the usual
write-back: robot notes in TESTING, problems in PLAYTEST. Order: moons first (the ladder is already scripted end to end,
so it's mostly reading results), then docking (the controller is the only new code), then stations (builds on both).
Not covered: anything that needs the builder to make the design (row 118's kick stage), and rows only a person can judge.

## The tester's "go to body" view (2026-10-08, QA session; QUEUE Q79)

So the look items for SYSTEM.md's bodies (Q80–Q85) have something to paint before M5 puts the planets in the sky. Tester
menu → **Go to body** (or `refView(200 + 3·i + k)`, i in `BODY_CAT` order, k 0/1/2 = near at 1.6 R, whole disc at 4.5 R,
far at 30 R). ◀ ▶ change body, 1 2 3 change distance, drag turns the camera, Esc returns.

**How.** `app/bodyview.js` (new, loaded last). `render()` hands it the frame while it's open (one line at the top), so
`gl.js` isn't touched. One full-screen fragment shader ray-traces the body in body radii: an ellipsoid (flattening along
the spin axis), the spin axis tilted about X, a ring annulus in the equatorial plane with the planet's shadow on it and
its shadow on the clouds, latitude bands and a limb haze. `BODY_CAT` holds SYSTEM.md's radius and tilt for all 11 bodies,
and test.mjs `qa-2` reads SYSTEM.md and checks them. **Placeholders:** Hyperion's flattening 0.08 (SYSTEM.md gives none;
from its 3.3 h day), and every colour, band and haze value. Those belong to the look items. When a body gets a real look,
it should move into the main renderer (or this shader), and its row here should stay the place its numbers come from
until the space lane gives the catalogue a home in `sim/` at M5.

**Not yet:** no ground detail, no moons beside their planet, no star in the frame, and one fixed sun direction (from the
camera's right).

**Selene rows 115 and 117 (QA session, the Q30 follow-up).** `node playtest.mjs 115 117` puts a rover in `PROG.rvOut` at
ground height (`groundR`, or it spawns in mid-air and the science buttons say "stop first"), and for 115 an antenna-only
Probe registered at 1,000 km around Selene. The Program's Fleet tab and "Drive from home" then work as for a player.
Contact over a relay orbit is sampled by moving `PROG.day`: `rvFieldContact` is pure. The science buttons listen for
`pointerdown`, so a driver needs real mouse events (`{click:…}`), not `element.click()`. Rows 65 (crew rotation) and 116
(docking at Selene) are still undriven.

## Save versions (2026-10-09, effects session for the platform lane, QUEUE Q57)

The career lives in `localStorage['launchpad-program-v1']` (the tester's sandbox in `…-tester`) as `JSON.stringify(PROG)`.
It had no version, so a change to `PROG`'s shape could only be absorbed by fix-ups scattered through the loader. Now
(`app/state.js`): `SAVE_V` (1), `MIGRATE[n]` (version n → n+1, pure) and `migrateSave(j)`, run on load. A save without
`ver` is version 0; step 0 → 1 holds the loader's old fix-ups (drop `docked` flags, fill `rel`/`op`, a broken day → 0, a
broken balance → the default). Saving stamps `ver`, never lowering it, so an older game can't make a newer save
re-migrate. A save from a newer game loads as it is, with a message, not a guess.
- **To change PROG's shape:** bump `SAVE_V`, add the step to `MIGRATE`, and a fixture to test.mjs `platform-2`.
- Checked in the page: a planted version-0 save loads as version 1 (`docked` gone, `rel` filled); the robot's `m1` passes.

## Numbering: the duplicate-number check (2026-10-11, wildcard session for the platform lane, QUEUE Q160)

Every lane takes "the next number" in shared files: `## v1.N` here, rows in TESTING and PLAYTEST, Q/W/D items in QUEUE.
Two branches that do it at once merge **without a conflict** (the lines land in different places), so nothing stops the
repeat: v1.102 and v1.103 were each taken twice within an hour on 2026-10-09, and two items were both Q228 on 2026-10-10.
`check_numbers.mjs` finds both shapes of it:
- **Repeats** in this tree (a number on two lines of one file): what a merge leaves. test.mjs **`platform-3`** runs this
  half, so `--smoke` and the full suite catch it with no extra step.
- **Collisions** with `origin/main` (or `--against <ref>`): a number both sides added since their merge base, with
  different text. That catches it *before* the merge, while renumbering is still one line in your own branch.
- It ends with the **next free numbers** (`next free: v1.117 · TESTING 199 · PLAYTEST #69 · Q269 · W36 · D15`), over this
  tree and the ref together. Take yours from that line right after a `git fetch`, not from the last heading you saw.

**In the merge recipe** (ACTIVE_WORK § Launchpad worktrees): `git fetch` then `node check_numbers.mjs` in your worktree,
before merging `origin/main` in; renumber anything it reports; again after the merge (the test suite does it too).
Exit 1 on any finding. Checked: a synthetic branch off a day-old commit that also took v1.116 and Q268 is reported as two
collisions; a planted second TESTING row 12 as a repeat; today's `main` is clean. **Fixed 2026-10-11 (v1.117's session):** TESTING rows
someone has played are marked (`| ✓ 115 (robot) |`, `| ✗ 12 → P#15 |`), and the first pattern skipped them, 93 of 198
rows; it now uses test `qa-3`'s pattern. TESTING also keeps a "Next free number" line that `qa-3` checks: bump it with your row. Not done: a pre-push hook
(`core.hooksPath` is per clone, so every machine would have to opt in; the recipe and the suite need nothing).

## Plan: record and replay a whole session (2026-10-11, wildcard session for the platform lane, QUEUE Q225; plan only)

**The ask** (Caio, 2026-10-10): watch a recorded play, a person's or the robot's, at 1×; pause, scrub, share the file.
The viewer plays; it never hands control over.

**What already exists.** Flights record a tape from launch (§ "Autopilot = flight tapes"): every `advPhys`, `advRails(dt,
warp)`, control change and discrete action (stage, abort, legs, wings, arm, bay, rover, load, switch, undock), and it
replays **bit for bit** on the same `TAPE_V`. The ignition dice are deterministic (`igniteOK` hashes `PROG.flights`, the
kick count and the part), and the world's daily dice come from `PROG.wseed`. Saves are versioned (`SAVE_V`, `migrateSave`).
`?tester` already gives the page its own storage slot. The robot (`playtest.mjs`) already drives the page with semantic
steps: `{key}`, `{hold, ms}`, `{click:'#sel'}`, `{wait}`, `{say}`, JS strings.

**What a flight tape misses for a whole session** (read from the code, 2026-10-11):
1. **The starting state:** `launchpad-program-v1` (or the tester slot), and the other keys the page reads: `launchpad-atlas`,
   `-hud-pins`, `-modern-ui`, `-perf`, `-progtab`, `-sound`, `-volume`, `-tester-flags`, plus the saved autopilot tapes.
2. **Everything between flights.** About 40 DOM handlers change `PROG` (contracts, facilities, the bureau, production,
   dispatch, the tester menu), `go(screen)` and the overlays change what's on screen, and the Assembly's edits are
   pointer drags on a canvas. None of it is recorded today, and replaying it as input would need every one of those paths
   to be deterministic and every layout to stay put.
3. **How each flight starts:** the design stack and site are on the tape, but not the program around it: the day
   (`advanceDays` to a whole day before a flight from orbit), `FLEET` and other vessels, `ORB_T0`, a flight handed over
   from a dispatch (`recTape.fromOrbit`).
4. **The camera:** `cam` (yaw, pitch, dist, map yaw/pitch/dist, focus), `view` (flight or map), the map's selection.
5. **Pacing:** the tape records calls, not frames. Replaying at 1× needs the wall time of each frame's batch of ops (how
   many physics steps it ran, when), or the replay runs at the replay machine's frame rate, which is "1×" only on average.
6. **One random number in the SIM:** a detached part's tumble (`sim/vessel.js:656`, `Math.random` in the debris spin).
   Harmless for the tape today (debris leaves the sim), but a replay check that hashes the scene would trip on it.
   Visual-only randomness (smoke, booms, sparks, sound in `app/`) makes a replay look slightly different, never diverge.

**Recommendation: keyframes, not keystrokes.** Two ways to record:

| | A. Record input, replay it | **B. Record state, replay flights (recommended)** |
|---|---|---|
| Between flights | every key, click, drag; replayed into the live UI | the save as it changes (a diff at each `HOOK.save`), the screen, the design stack at each edit |
| Flights | the tape (exists) | the tape (exists), plus its starting conditions |
| Breaks when | any UI path isn't deterministic, a layout moves, a handler changes between versions | the SIM's flight code changes (`TAPE_V`): then that flight shows its path and outcome from the snapshots, not a re-flight |
| Cost to build | every handler audited, canvas pointer events mapped | a recorder at three hooks (`HOOK.save`, `go`, the tape) and a small JSON diff |

B needs nothing new to be deterministic: only flights re-simulate, and those already do. **Inputs are still logged in
B, but for display**: a key or a click on a `data-*` button becomes a caption or a ripple in the viewer ("pressed L",
"accepted *Weather sat*"), and the same log exports as a **robot row** (`{key}`, `{click}` steps), so a person's session
can become a regression test (slice R4).

**The file** (JSON, gzipped with `CompressionStream` for export):
`{v, game: {TAPE_V, SAVE_V, built}, start: {prog, store: {key: value}}, events: [{t, k, …}]}`, `t` in wall ms from the
start. Kinds: `screen` (go), `prog` (a diff of the save: key paths set or deleted), `design` (the stack, at each
Assembly edit, debounced), `cam` (10 Hz while it moves), `ui` (a key or a `data-*` click, display only),
`flightStart` (stack, site, day, `ORB_T0`, the other vessels), `ops` (one frame's tape ops, at its `t`), `path` (the vessel's position and
speed at 1 Hz, for a flight the viewer can't re-fly), `flightEnd`
(`stateHash(S)` and the settled `PROG` hash). Size to measure in R1: one hand-flown orbit is 1 KB of tape; the save
diffs are the unknown.

**The viewer** (`?replay`, like `?tester`): opens a file, loads `start` into a slot of its own and turns `HOOK.save` off,
so a career or the sandbox is never touched. It applies events by time; flights run `tapePlay` with each frame's recorded
op budget; the camera follows the samples, interpolated. Controls: play/pause, 1×/4×/16×, chapters (one per screen visit
and per flight), scrub. **Scrubbing** between flights jumps to the nearest `prog` state and applies diffs forward;
inside a flight it re-runs the tape headless from the flight's start to `t` (measure: a 248 s orbit flight is at most
~12,400 physics steps at `DT` 0.02 s, fewer with rails coasts; if that takes more than ~0.5 s, keep a vessel snapshot every 30 s of flight).

**Checking determinism.** At each `flightEnd` the recorder stores a hash of the vessel (position, velocity, parts, fuel)
and of the settled save; the viewer recomputes both and marks a chapter that diverged instead of playing on silently.
A headless test (`tests/platform.mjs`): record a Sounding and an Orbiter flight in one SIM instance, serialise, load
into a **fresh instance** (`new Function(src …)`, as the sats sections do: the "across a reload" case), replay, compare
hashes. Seed the debris tumble from the vessel (`s.kickN`, the part index) first.

**Slices** (each S unless marked):
- **R1 recorder core** (⚙): the diff, the event log, `flightStart`/`flightEnd` with hashes, the debris seed, the
  cross-instance test. A `TEST.record` tester flag turns it on; a download button like the log's.
- **R2 viewer, M** (🖥): `?replay`, load a file, play/pause/speed, chapters, flights re-flown on the real renderer.
- **R3** (🖥): scrub, the camera path, captions and click ripples from `ui` events.
- **R4** (⚙): export a recording's `ui` steps as a `playtest.mjs` row; record the robot's own runs (`PT_RECORD`).

**Defaults, for Caio to override** (one line each):
1. Recording is **off for players**, on with the tester flag or a Settings switch; while on it keeps the whole session
   (no ring buffer) until the tab closes or *Download*.
2. Sharing is **a file** (download, open in `?replay`), not a link.
3. The viewer shows **the player's camera**; a free camera is later.
4. A recording made on an older `TAPE_V` **still plays**: flights it can't re-fly show their recorded path and outcome.
5. **No "take over from here"** (the ask says the viewer never hands control over); the autopilot already covers that for
   one flight.

## v1.117 — the tester's verbose log (2026-10-11, wildcard session for the platform lane, QUEUE Q265; PLAYTEST #65)

Caio landed a rocket and had nothing to read back: no `console.log` anywhere. Now, with `?tester`, the tester menu has a
**Verbose log** flag (saved with the other flags). On, a panel at the bottom left scrolls the lines, each one is mirrored
to the console as `[launchpad] [day 29.00 · t 750.0 s] contact   touchdown on Tellus (launch pad) at 4.8 m/s, limit 12.0`,
and **Download** saves them as text with the page, the world and terrain seeds, the day and the browser.
- **The SIM half** (`sim/program.js`, by `TEST`): `logEv(kind, text)` keeps up to 5,000 lines in `LOG` and hands each to
  `HOOK.log`. Off, it returns before doing anything, so it can be called anywhere. Its own calls: `stage` (each staging
  event: groups dropped, engines lit of those asked, height, speed), `contact` (every touchdown: speed against the
  surface's limit, and what the trees or boulders took off it), `heat` (a part passing 80 % of its `Tmax`, once per part),
  `pay` (every `debPaid` line).
- **The page half** (`app/testlog.js`, loaded last): it taps `HOOK.msg`, `HOOK.news` and `HOOK.save`, so every player
  message is a line: ignition, failed ignitions, flame-out, separation, chutes, burn-ups, and **destruction with its
  cause** (a message starting "Destroyed" or "Vessel lost" gets the kind `destroyed`). A watcher twice a second logs
  `money` (funds before → after), `contract` (accepted, closed) and `mission` (done), so money that moves anywhere shows
  up without a call at each site.
- **Adding to it:** call `logEv('kind', text)` where something happens that no message says. Keep the text built only
  where it's rare (a template string is evaluated even when the log is off) or guard with `TEST.log` as `thermal` does.
- **Checked:** test `platform-4` (silent when off; on, a Sounding flight leaves its staging, touchdown against the limit,
  and pay). In the page (`?tester`): the menu's checkbox turns it on and the flag survives a reload; +10 days and Set
  funds log news, saves, the tester message and the money; a Sounding flight logs ignition → liftoff → mission pay →
  flameout → chute → touchdown 4.8 m/s of 12.0 → landing → money → missions done, all on the console; the download's
  header and lines read back. Robot `m1` passes (no overlapping boxes).
- **Not yet:** no game version in the download (the page has no version constant; a `GAME_V` would have to be bumped with
  every `## v1.N`, which `check_numbers.mjs` could check). Part failures other than ignition don't exist yet; when they
  do, their message is logged already.

## v1.121 — the session recorder (2026-10-11, wildcard session for the platform lane, QUEUE Q275 = Q225 R1)

The first slice of "Plan: record and replay a whole session": the recorder. With `?tester`, **Record this session** in
the tester menu records keyframes, not keystrokes: the starting save, a diff of the save at each save, the screen, the
design on the Assembly, the camera, and each flight's tape between a start and an end that carry a hash of the vessel.
**Download recording** (in the tester menu while it records) saves gzipped JSON. The viewer is R2.
- **`sim/record.js` (SIM, pure):** `REC`, `recStart(store, game)`, `recEv(kind, data)`, `recProg()` (the save since the
  last keyframe, as `jdiff` ops), `recFlightStart(s, tape)` / `recFlightEnd(s, tape)`, `recStop()`, `recFile()` (a
  flight still flying is closed in the copy, marked `open`), `recProgAt(file, t)` (the save at any time: R3's scrub),
  `recLoad(start)`, `stateHash(s)`, `jdiff`/`jpatch`.
- **`app/record.js`:** starts and stops with the flag, gives `REC` the clock, taps `HOOK.save`, samples at 10 Hz the
  screen, the camera and the flight's pace (tape seconds flown), at 1 Hz the path and the design; logs keys and clicks as
  `ui` events (display only, never replayed as input). The start's `store` is the page's other `launchpad-*` settings.
- **Hooks in other files, one line each:** `resetShip` ends the flight in progress and opens the next; the two flights
  from orbit in `app/program-ui.js` do the same; `recTapeNow()` (`app/state.js`) is the autopilot's played tape while it
  flies, else the pilot's. A detached part's tumble (`sim/vessel.js`) is seeded from the time, not `Math.random`.
- **What it found:** a replay can't start from a bare `Object.assign(PROG, save)`. The page's load also sets `HOME`
  from the save, rebuilds the rivals' schedule and fills the offer board; without that, the fresh SIM's `missionTick`
  crashed in `relOf`. `recLoad` does what `app/state.js` does after `migrateSave`, and the start records `HOME`.
  **Platform:** `app/state.js` could call `recLoad` itself, so there's one load path (not done: it's the page's boot).
- **Checked:** test `platform-5` records a Sounding flight in one SIM instance and replays it in a **fresh instance**
  from the file: the vessel's hash at both ends and the save after it settles match exactly, the start plus every diff
  rebuilds the final save, and `jdiff`/`jpatch` round-trip. In Chrome (`?tester`): the menu's checkbox starts it; a pad
  flight through `resetShip` and the tape calls records flight start/end, 19 pace, 5 path and 5 save events; the
  download is **3.2 KB gzipped** (9.9 KB JSON, the sandbox's save is 2.1 KB of it); decompressed and re-flown in a fresh
  SIM the page built from `sim/*.js`, both hashes match. Robot `m1` passes (no overlapping boxes).
- **Not yet:** the viewer (R2), scrubbing and the camera path (R3), robot rows from a recording (R4). A flight that was
  already flying when recording started isn't recorded as a flight (its tape began before the recording); its path is.

## The satellite-network robot run: M2's finish line (2026-10-13, test bench, QUEUE Q233)

`node playtest.mjs m2`, written first like `m1` (Q55): it **fails until M2 lands**, and each failed check names what's
missing (the comment beside each `expect` says whose it is). A new career plays all of `m1`'s steps (no tester flags, nothing
seeded), then what a player would do in epoch 3:
- **a weather satellite**: the Satellite preset (v1.178) flown 3° east of north, so the planet's spin helps instead of being
  cancelled (~82°), then raised to ~300 km so it lasts;
- **a routine** made from it in the Fleet tab (*Make a routine*), three runs ordered there by hand, and *Repeat by itself*
  switched on the first time it's allowed;
- **TV for the capital**: the same preset east to a low orbit, then raised to the stationary orbit and circularised onto
  the equator;
- **then years at [N] only**: mission control's *Wait* button, until the routine has repeated by itself for a year or the
  calendar passes day 4,000 (12 steps of ≤ 150 waits). A decision is declined (its last option) and a deviation let go;
  both are listed in the output.

Before each flight it presses [N] until the program can pay for the rocket (a refused Rollout otherwise "flies" a ship
that never launched). The flights are the robot's own (`PT.ascentAz`, `PT.raise`: attitude set directly, like `PT.ascent`),
so they prove the career path, not that the rocket is flyable by hand.

**Robot lessons.** Circularise along the path you're flying, not a compass heading: by apoapsis a polar flight is at 47°
latitude, where "5° east of north" is ~10° off its real heading, and that plane change (~570 m/s) emptied the tank. The
first due-north try also ran dry: going north cancels the pad's 278 m/s of spin (~290 m/s more than going east).

**First result on `main` (v1.184), 52 s:** `m1` ✓, weather satellite ✓ (293 × 301 km, 82.3°, flown dry), routine made
("Lookouts at 297 km, 82°"); fails on:
- **TV**: the Satellite runs dry raising its apoapsis at 1,323 km (the stationary orbit is 5,668 km up: ~1,640 m/s past
  a low orbit; the Satellite has ~490) → PLAYTEST #102;
- **three clean runs**: ordering one is refused, "153 m/s short for this orbit" (the design's procedure to 300 km
  polar). A route made from a raised orbit (716 km) instead flew one run, which "broke up in the climb" → PLAYTEST #103;
- **kept up**: the route counts its satellite 0 of 1 up from the moment it's made: `routeSats` needs 30 days of
  station-keeping (`skLife`), and a satellite with no fuel "holds 0 d" though it stays up 1,034 d → PLAYTEST #104;
- **repeating, a run by itself, earning**: these follow from the three above. 41 waits took the calendar from day 178
  to 4,000 (~90 days a wait).

Also seen: once a route's satellites have all come down, its Fleet line is gone, and with it *Order a run* → PLAYTEST #105.

## Test bench timings: Q19's A/B, Q315 and Q321 on the iGPU (2026-10-13, test bench, QUEUE Q19, Q349, Q373)

Measured on `PC_de_Varginha` (RTX 5050 Laptop and Intel Graphics, 16 GB; no other sessions, Chrome closed, ~6.5 GB free).
Each comparison is two detached worktrees served side by side, `refset.mjs` alternating A and B, a fresh browser profile
every run. "Load" is refset's *ready in* (page load to the views being ready); the GPU driver keeps its own shader cache,
so loads are shorter than the 86–88 s in Q19's notes and only the A/B difference means anything. GPU ms is refset's
full-resolution figure, the median over the runs. Pixels: A against B judged against A against A (the grain and animated
flames differ run to run: up to ~17 levels on ~7 % of pixels, much more around plumes).

**Q19, the terrain G-buffer (branch `q19-hdr` `04bc59b` against its base `3eac3f9`, v1.142).** 28 views (1–3, 15–19, 60,
80–83, 97–100, 116–119, 145–151).

| | load A → B | GPU ms, sum of 28 views | pixels |
|---|---|---|---|
| RTX, High (3 rounds) | 28 → **14 s** | 116.2 → 107.9 (−7 %; 24 of 28 faster; pad 3.89 → 3.69) | within noise on every view |
| RTX, Low (2 rounds) | 28 → **14 s** | 107.2 → 106.0 (even: night −0.7, but sky 97 1.2 → 2.8, orbit 3.0 → 3.6) | within noise on every view |
| iGPU, High (1 round) | 24 → **13 s** | 789 → 666 (**−16 %**; pad 29.0 → 25.5, night 35.8 → 27.7, Steppe lift-off 38.9 → 31.1) | — |

Q19's own bar (NOTES § "Q19, round 2": "merge if the branch is no slower at the pad and faster to load") is met on both
GPUs. At Low on the RTX, views with little ground on screen pay for PTERR's own full-resolution pass: Low could run it at
the half resolution Low already uses elsewhere.

**Q315, the craft's quick wins (v1.150 `5b213d1` against `e6838a1`, the claim before its branch), on the iGPU.** 28 views
(1–10, 30–36, 97–100, 152–158). High (2 rounds): 562.1 → 563.2 ms (+0.2 %); Low (1 round): 522.2 → 523.9 (+0.3 %); no view
over +0.4 ms but the desk at Low (+1.3, one round). Load 25 → 24 s. **Q315 costs nothing on the iGPU.** Its after set
(81 views, RTX High, v1.150) is in `output/launchpad/q315-after-v1150-rtx-high/` on that machine (`output/` isn't in git).

**Q321, the space sky (v1.166 `54d993b` against `43aa7a0`, `main` just before it), on the iGPU.** 14 views (1, 3, 19, 97–100,
155–161). High (3 rounds): 214.3 → 176.6 ms (**−18 %**): the pad −1.9, every sky view −1.5, night −2.8; Low (1 round):
204.1 → 167.9. Views 159–160 also moved (−10, −8 ms) but Q321 re-aimed them, so they aren't like for like. **Load 24 → 25 s
(+1 s, within a second over 3 rounds)**: the three star layers cost about what the galaxy noise saved.

**Seen on the way: Low barely helps on the iGPU.** At full resolution the pad is ~31 ms at High and ~30.5 at Low (~33 fps
either way), a lift-off ~36 vs ~32: Low saves ~7 % there. Most of what Low saves must come from the resolution scale, so
this is worth a look on a machine whose only GPU is the Intel one (the platform lane's perf work).

## v1.278 — the tester's infinite fuel and starts in orbit (2026-11-07, orchestrator worker, QUEUE Q542; PLAYTEST #148)

Caio: "an infinite fuel mode for testing, plus some starting points like in orbit of different bodies", for practising
rendezvous and satellite missions. Both live in the tester menu (`?tester`, F2).

**Infinite fuel** (`TEST.fuel`, a flag like the others, saved per browser): one check where each propellant is taken.
`physStep` adds no draw for a liquid engine's flow group (the thrust is unchanged, the tanks stay full, the mass too),
and `rcsStep` takes no gas out of the bottles. A solid kick motor still burns out (it is held at full thrust until it is
empty, so an endless one could never be stopped); batteries, a holed tank's leak and EVA are real. The HUD's TESTER tag
reads **TESTER · ∞ FUEL** while it's on.

**Start in orbit** (a section of the menu, out of flight only): a body (Tellus, Selene, Nyx), where (*In orbit*, *Beside a
target*, *Landed*, *Entering its sphere*; the last two on a moon), altitude and inclination (or latitude and longitude
landed), the stages to drop, *Start*. One placement function, `placeCraft(s, spec)` in `sim/space.js`, works on a fresh
`newShip` (Q452 can reuse it):
- **Stages dropped**: `placeSteps` reads the design's Δv steps (`dvPlan`, the first at sea level); `placeNeed` is the Δv
  spent before that point (the logbook's orbit, else `DV_ORBIT_EST`; for a moon + a Hohmann transfer, + the capture onto
  the orbit asked, + the descent landed); `placeAuto` drops every stage whose Δv is all spent by then and keeps the one
  burning when it's reached (full: the tester's fuel isn't rationed), never the last. The picker overrides it ("drop 2:
  from stage 3 (1,632 m/s)"). `placeDrop` fires those staging events as staging would (parts off, the next stage lit,
  fairings dropped) without debris. Measured: the Orbiter drops its booster for Tellus orbit; the Lunar keeps its Petrel
  stage for Selene orbit (drop 1) and only the Wren lander landed (drop 2).
- **In orbit**: circular at the altitude, inclination, node and argument of latitude (`placeCirc`, addBody's convention),
  nose prograde, SAS on. Refused under the air / the highest ground, or past 80 % of a moon's smallest sphere.
- **Beside a target**: a registry object round that body (the menu lists them, debris left out), or a fresh **Docking
  dummy** (the Docking preset minus its first stage, registered by `satRegister` as "Target dummy N"); the craft 3 km
  (settable) behind it on the same orbit (`kepler` back by 3 km of arc), targeted. Co-orbital: still 3 km apart an hour on.
- **Landed**: upright at the latitude and longitude (180° E: Selene's near side), legs down, pinned as landed (`syncLanded`).
- **Entering its sphere**: a hyperbola about the moon with a Hohmann transfer's arrival speed and the periapsis asked
  (default 100 km), its plane the moon's orbit tilted by the inclination, started 100 km outside the sphere in the parent's
  frame: on Selene it crosses in ~3 min with a 100.5 km periapsis.

**No credit.** The flight starts as `flyEntry`'s from orbit (`testStart`, `app/program-ui.js`: a whole day, `ORB_T0`) with
`R.tester` (the spec) and the program snapshotted (REVERT0) before any dummy is registered. `missionTick` runs only the
world's hazards for it (a leak, debris passes): no staged pay, rendezvous or overflight contracts, logbook or missions;
`missionEnd` discards it whole (`missionDiscard`): no flight counted, no registry entry, the dummy gone, the program as it
was, no debrief. Revert starts the same placement again (also on Hard). The start isn't saved, so a reload mid-flight
keeps no dummy.

**Tests** (`tests/qa.mjs`): qa-6, a 30 s burn in orbit leaves the tanks full with the flag (the craft still gains ~440 m/s)
and drains 576 kg without; qa-7, Tellus 250 km 51.6° and Selene 40 km polar to 0.01 km / 0.01°, stages dropped auto and as
asked, three refusals; the dummy 3,000 m ahead, 3,000 m after an hour, the end leaves the program as it was; landed on
Selene upright at 10° N and still standing 5 s on; the sphere entered after 190 s, periapsis 100.5 km. Screenshots (RTX):
the menu with the Lunar on the table, and the Lunar's Petrel + Wren in a 40 km polar Selene orbit, tanks full after a 3 s burn.

**Left**: no keep-it switch (a satellite placed this way can't stay in the sandbox's register); RCS gas isn't in the tests
(no preset carries RCS); no "landed elsewhere on Tellus" start; *Entering its sphere* is a flyby, not a captured free return.

## v1.289 — five lines a `//` comment swallowed (2026-11-09, review fixes, QUEUE R4; REVIEW-2026-11-09)

A note on the end of a line, then live code with no line break: the code was part of the comment. Each split back
onto its own line, nothing else changed:
- `app/editor.js` (since v1.236, Q436): the SAS mode button in use gets `.on` again.
- `app/screens.js` (since v1.160): `progInbox` is counted again, so the Inbox badge (the tab, the HQ strip) shows.
- `app/render.js`: `uSeam` and `setMarks` are reset after the debris pass, before the satellites and the rest.
- `builder.js`: `overlay()` runs `o.save()` and sets its font again (`o.restore()` had run without a save).
- `sim/ground.js`: Erebus's blade mask (`B`) is baked again; before, the channel stayed 0 and no ground read *blades*.
  Erebus isn't live (stub body), so nothing flown changes.
- Test: `ground-7` gained a blades check (79 of 4000 points; fails on the old line: B max 0). The four browser lines
  have no test of their own; R3's lint (a `//` comment followed by statements) is the guard for the kind.

## Plan: one `PROG` schema (2026-11-09, review fixes, QUEUE R1; REVIEW-2026-11-09; plan only)

**The ask** (the review's R1): one table of `PROG`'s fields, their defaults and which survive a new program, that
`resetProgram`, the save and its migration, `missionDiscard`'s snapshot and `career.mjs`'s reset all derive from; and a
check that fails when code uses a field the table lacks.

**What's there today** (read from the code at v1.289, a scratch inventory over `sim/`, `app/`, `builder.js`, `career.mjs`):
- **87 fields** are used as `PROG.x`. `PROG` starts as a 10-field literal (`sim/program.js:53`); the rest appear on first
  write, and **302 reads** guard with `PROG.x||default` (the review counted 279 with a narrower pattern). No code reaches
  `PROG` through an alias; the only bracket uses are the whole-object restores below.
- **Four places rebuild it, each with its own list:**
  | Where | How | Gap |
  |---|---|---|
  | `resetProgram` (`app/editor.js:47`), the title's *New program* and More's *reset program* | `Object.assign` of 44 fields; `HOME=0`, `RIVALS`, `ensureBoard` | **43 fields survive** (R17): `sats, stations, procs, routes, sanc, raceLost, log, led, riv, back, cseq, giant, casc, frag, …` |
  | `career.mjs` `run()` (line 168) | its own `Object.assign` of 48 | misses `cseq, bailRecent, back, giant, led, riv, …` (a row's numbers depend on the rows before it); has `sats, stations, procs, sanc, raceLost, sel` that `resetProgram` lacks; lacks `dispatch, gseed` |
  | the loader (`app/state.js:187`) | `Object.assign(PROG, migrated save)`, then fixes `funds, day, rel, op` | a field the save lacks stays absent: the 302 `||` reads absorb it |
  | `missionDiscard` (`sim/program.js:439`), the simulator, flights from orbit (`app/program-ui.js:70,81`), the recorder (`sim/record.js:50`) | whole-object `JSON.stringify` / `jclone` snapshot and restore | complete, but lossy: `Infinity` becomes `null` (R16's 132 M core payout) and nothing says so |
- `SAVE_V=1`, one migration (0 → 1, the loader's old fix-ups).

**The design.**
1. **`PROG_SCHEMA`** in `sim/program.js`, next to `PROG`: one row per field, `{d, keep, why}`.
   - `d` is the default: a JSON value (cloned on use), a function (`wseed: freshSeed`), or `undefined` = **absent is
     meaningful** (`lvl` absent is Normal; `giant`, `site`, `frag`, `navCov`, `gseed` are built on first use).
   - `keep` says what *New program* does with it: `'career'` (back to `d`; 81 fields), `'library'` (survives: the
     player's designs, see question 1), `'pref'` (survives as the charter's preselection: `lvl`), `'transient'` (never
     saved: `newerSave`), `'meta'` (`ver`, written by the save).
   - `why` is the field's one-line meaning, the comment that today is scattered over 23 files.
   The defaults come from the `||` reads (they agree today wherever they're a literal; the ones the scratch pass couldn't
   read, marked `?`, get looked at by hand in slice 1).
2. **`progFresh(keepFrom)`**: a new program object from the schema; with `keepFrom`, the `library`/`pref` fields are
   carried over. **`programNew(opts)`** = clear `PROG`, assign `progFresh(PROG)`, then the world globals (`HOME=0`,
   `RIVALS=raceSchedule()`, `ensureBoard()`). `resetProgram` becomes `programNew(); HOOK.save(); editorChanged()`;
   `career.mjs`'s `run()` calls `api.programNew()` and then sets only what a row varies (`homeArch`, `wseed`, the start).
   The initial `PROG` is `progFresh()` too, so a first career and a reset one start alike.
3. **One serializer, `progJSON()` / `progRestore(json)`**, used by the save, `REVERT0`, the simulator, flights from orbit
   and the recorder. It drops `transient` fields, and **in tester mode and in tests it walks the object and reports any
   non-JSON value** (`Infinity`, `NaN`, `undefined` in an array, a function, a `Map`/`Set`) with its path: R16's sweep,
   and a guard for the next one. In the plain game it only serializes.
4. **The loader fills from the schema:** `Object.assign(PROG, progFresh(), migrated)`, so an old save gets every field's
   default and the reads stop needing `||`. Unknown keys in a save are kept (question 2). No `SAVE_V` bump: filling
   defaults changes nothing a save means; the bump stays for when a field changes meaning, as now.
5. **The check** (a new `platform-N` section, in smoke):
   (a) static: every `PROG.<name>` in `sim/`, `app/`, `builder.js` and `career.mjs` is a schema row, and every row is
   used somewhere; (b) static: a `PROG.x||<literal>` read whose literal differs from the row's `d` fails; (c) dirty a
   program (fly the robot's career a few hundred days in the SIM), `programNew()`, and `PROG` deep-equals `progFresh()`
   except the `library`/`pref` fields (R17's repro: `sanctioned(1)`, `raceLost('beeper')`); (d) the same dirty program
   through `progJSON` reports no non-JSON values; (e) `career.mjs` with the same row twice in one process gives the same
   numbers (today 408 / 346 / 277 M depend on the rows before).

**Slices** (platform lane; Opus is enough for each):
- **R1a** the schema, `progFresh`, `why` for each row, checks (a), (b); no behaviour change (the initial `PROG` is
  already a subset). Decide the `?` defaults by hand.
- **R1b** `programNew` for `resetProgram` and `career.mjs` (fixes **R17**); checks (c), (e). `career.mjs`'s table
  changes, since rows stop inheriting the ones before: re-measure and write down the new baseline (NOTES economy).
- **R1c** `progJSON`/`progRestore` everywhere a snapshot is taken; the non-JSON report; check (d). It finds R16's
  `core.hi:Infinity` (R16 fixes the value; R1c only reports).
- **R1d** the loader fills from the schema. Then, lazily and by lane (additive first), retire `||` reads as files are
  touched; check (b) keeps the ones left honest.

**Fits with:** R2 (test sections run isolated) gets its fresh program from `progFresh()`/`programNew()`; R16 and R17
are found or fixed on the way; R19's shared formulas are separate.

**Questions for Caio** (silence keeps the default):
1. **Do the player's designs survive *New program*?** (`designs.saved`, `payloads`, `rovers`.) *Default: yes,* like a
   craft library outside the save; the new program's design history (`designs.launched`) starts empty.
2. **A save with fields this game doesn't know** (from a newer build, or one since removed): *default: kept as they are*
   (no data loss when going back and forth between builds); the tester's log lists them.
3. **Difficulty on *New program*:** *default: the charter preselects the last one and still asks* (today's behaviour,
   since `lvl` already survives).

## v1.292 — the `PROG` schema, first slice (2026-11-10, review fixes, QUEUE R1a; § "Plan: one `PROG` schema")

`PROG_SCHEMA` in sim/program.js, after `freshSeed`: all 87 fields, one row each, `[default, keep, why]`, grouped (money,
world, missions, know-how, fleet, logbook, Selene, library). `progFresh(keepFrom)` builds a fresh program from it and
carries the `library` (designs, payloads, rovers) and `pref` (lvl) fields over from `keepFrom`. Nothing calls it yet:
no behaviour changes (R1b moves `resetProgram` and `career.mjs` onto it).
- **Everyone: a new `PROG` field needs a row**, or test platform-6 fails. A `PROG.x||<literal>` read must use the row's
  default unless that default is null or absent.
- Defaults: a field `resetProgram` sets keeps its reset value; the other 43 take their `||` reads' default, or stay
  absent (`riv, giant, frag, navCov, site, sel, lastDebrief, electionWarned`): built on first use, or meaningful absent.
- Found by the check: the desk's ledger read `PROG.funds||0` (the table: 60). The guard could never fire (the loader
  repairs `funds`), so it went.
- Test platform-6: every field used is a row and every row used; the `||` defaults agree; PROG's starting literal and
  `resetProgram`'s agree with the table; `progFresh` gives fresh objects and carries the library over. Mutations
  caught: a row removed, a default changed (both the `??` read and `resetProgram` disagree).

## v1.293 — one reset for New program and career.mjs (2026-11-10, review fixes, QUEUE R1b; fixes R17)

`programNew(set)` (sim/program.js, after `progFresh`): every field back to the table's default (it clears `PROG` first,
so nothing from the old career survives), the player's designs and the level carried over (`designs.launched`
emptied), then `HOME`, `RIVALS`, `REVERT0`, `DEBRIEF_LAST` and the board. `set` is for fields chosen before the world is
built. `resetProgram` (the title's New program, More's reset program) is now `programNew(); HOOK.save(); editorChanged()`;
`career.mjs`'s `run()` calls `api.programNew({homeArch, wseed})` instead of its own 48-field list.
- **R17 fixed:** before, 43 fields survived a reset: satellites, stations, sanctions, lost races, procedures, routines,
  the logbook, the ledger, the rivals, contracts due back, the commercial giant, debris. Also gone now: the launch site
  picked (back to home's) and the last Debrief.
- **career.mjs rows are independent:** frugal/agency ended at 408 M in the full table, 346 M alone, 345 M after one
  other row. Now a row is the same wherever it runs. The new baseline (`node career.mjs 3 3`): mean final funds
  654 M (was 691), lowest row 100 M (resource/company, was 147), mean flights 25.3 (same), failure rate 19.9 % (was 19.3).
  Rows move both ways (rising/agency 799 → 717, resource/agency 397 → 701): before, each row started from whatever the
  rows before had left (their sanctions, races, contracts due back), so no single old number was "right".
- Tests: platform-6 gains two checks: New program after 300 days of play equals a new program in a fresh SIM (same
  seed), the designs and level aside; and a career.mjs row alone equals the same row after others (mutations caught:
  the old career.mjs reset, a programNew that doesn't clear first). Three source-text checks that read resetProgram's
  old list now check the table and programNew: economy's *cover kept in PROG.recs*, econ-34 (*Reset draws a seed*),
  look's *a reset draws a new galaxy*.

## v1.296 — one serializer for the save and every snapshot (2026-11-10, review fixes, QUEUE R1c)

`progJSON()` / `progRestore(j)` (sim/program.js, after `programNew`) replace the six ways `PROG` was copied: the save
(`HOOK.save`), the revert/simulator snapshot at liftoff (`REVERT0`) and `missionDiscard`'s restore, the two flights from
orbit (app/program-ui.js), and the recorder (`recStart`, `recProg`, `recLoad`, `progHash`). `progJSON` leaves out
`transient` fields (`newerSave`); `progRestore` clears `PROG` first, so a field the snapshot lacks goes.
- **What JSON loses**, listed by path by `progLossy(v)`: Infinity and NaN (they come back null), functions, Maps, Sets,
  Dates, typed arrays, holes (undefined) in arrays. **In tester mode** `progJSON` says each new one once ("Tester: the
  save loses PROG.sel.core.hi=Infinity") and warns in the console. In the plain game it only serializes.
- It doesn't fix values: R16 (`sim/rovers.js:359`, `core.hi:Infinity`) is still there, now named in the tester's
  messages the first time Selene's core gets a bound.
- Test platform-6: no snapshot of `PROG` taken any other way (a mutation putting the save back on
  `JSON.stringify(PROG)` is caught); `progLossy` finds all seven kinds planted; 300 days of play lose nothing; the
  tester is told once about R16's bound; a restore drops a field added after the snapshot, and `newerSave` isn't written.

## v1.308 — a bad save no longer bricks the page (2026-11-11, platform, QUEUE R10)

The review (2026-11-09 § 2) found three saves that threw on every reload with no reset reachable: `{"ver":1,"home":99}`,
`{"done":null}`, `{"rel":null}`. Reproduced headless: each loaded, then threw on the first world tick (`align` of an
undefined power, `Object.keys(null)`, `null['0-1']`); so do `offers: 5` and `active: null`.
- **`progLoad(j, home)`** (sim/program.js, after `progRestore`) is the one loader; the page and the recorder's `recLoad`
  both call it. (1) The save goes onto `PROG_BASE` (PROG's starting literal, so a save missing `done`/`cert`/`atm` gets
  them, as the old `Object.assign` did). (2) `progRepair`: a field whose kind differs from its `PROG_SCHEMA` default is
  put back to the default (object, array, finite number, string, boolean; a null default takes anything), and a `home`
  that is no power goes to 0. `PROG_REPAIRED` names them; the page says "Parts of the saved program were damaged and are
  reset: done (null)". (3) `progDerive`: HOME, the rivals, the board, the old finite fix-ups. (4) **`progProbe`**: one day of
  the world on the save with news, messages and saves muted, then put back exactly (transient fields kept aside), so a
  save that would throw in the first frame throws here. Any throw: `PROG` becomes a new program and the error comes back.
  A played save (200 days) loads exactly as a plain restore, and 30 days on from it match: the probe leaves no trace.
  Cost: under 1 ms.
- **The page** (app/state.js): a save that won't parse, isn't a program, or fails `progLoad` is copied to
  `launchpad-program-v1-bad` (`-tester-bad` in tester mode) **before** anything can save over it; a new program starts and
  the player is told (message and a *bad* news line). With no room for the copy, the tab never saves (`progHeld`), so the
  old save stays.
- **Saving**: `HOOK.save` no longer swallows a failure: "Could not save: browser storage is full…" (quota) or the error,
  at most once a minute, and not at all where storage was unreadable at boot (private windows).
- **Two tabs**: the browser's `storage` event tells a tab when another one wrote the save; that tab stops saving and says
  so ("reload it to carry on here"). Whichever tab saves first keeps the program; the other can't write an older program
  over it.
- Not done: no way in the game to download the `-bad` copy (R9's *Export save* is the place); `offers` (null default) isn't
  kind-checked, the probe catches it. R1d (fill a save from the schema) is still open; `progRepair` only fixes kinds.
- Test platform-7 runs the page's own load/save block against the SIM with a fake `localStorage`: the five broken shapes
  load repaired and play 3 days; `sats:[5]`, `offers:5`, non-JSON and a bare string are kept as `-bad` and a new program
  starts; storage full holds the save; quota said once; another tab's write stops this tab's saves; the played-save
  equality above. platform-2's slice of the page now ends at `// Loading (R10)`.
## v1.309 — chapter starts: begin at first orbit, the first station or Selene (2026-11-11, QA, QUEUE Q571; PROGRESSION § 6)

- **Why:** Caio can't playtest stations and bases because every playtest starts at hour one.
- **On the title menu:** under New program, a *Start at* line: **First orbit done**, **First station up**, **Landed on
  Selene**. Picking one loads `starts/<id>.js` (a script tag, so it works from a file too), writes its save into its own
  slot (`CHAPTER_KEY`, `launchpad-program-chapter`; `PROG_SLOT` in app/state.js, read from `launchpad-slot`) and reloads; the career's
  save is never read or written. In that slot Continue says *a chapter start* and New program becomes **Back to your
  career**. The player's library and level (`PROG_SCHEMA`'s `library`/`pref` fields) come along. In tester mode a start
  replaces the tester's program instead, flags and all; outside it there are no tester flags.
- **How they're made:** `node chapters.mjs` plays one career with career.mjs's scripted player (the prudent one: a reserve,
  declines offers but a rescue loan) through the game's own economy, race, opinion and calendar, and snapshots `progJSON`
  at each milestone, so each start carries on from the one before. career.mjs is now also a module: `run(arch, start,
  seed, opts)` with `until`, `days`, `keep` (carry on), `goals` (missions it goes for, a bonus on their value: *Measure the
  air* and, after orbit, the escape tower's two tests, the station and the Selene firsts) and `registry` (what an orbit
  leaves, its last stage, is posed on its orbit and the Selene lander on the near side, then the game's own `satRegister`
  files them). New plans: `PLANS.abort` (a crew capsule under its tower on the Passenger's booster) and `PLANS.station`
  (a habitat, a port on top and one on its side, a probe core, on the Heavy). The default rows are unchanged
  (`PACE=1 node career.mjs 3 2` prints the same before and after). Deterministic: the same files every run.
- **What they hold (seed 1, a random world that came out a rising power, a national agency):** *First orbit done* day 60,
  2 flights, 180M, the weather, the air and the beeper done, Beeper 1 up. *First station up* day 494, 12 flights, 172M,
  10 firsts (the hop and one orbit, the tower qualified), Beeper 1 and the habitat (the game names it *Object 1*).
  *Landed on Selene* day 805, 15 flights, 581M, 13 firsts (the far side, the impactor, the soft landing), *Selene lander 1*.
  The flights are abstracted as career.mjs always has (a record per plan, a success probability): fast and cheap next
  to a person's career, and contracts are few (1–3).
- **When the save schema moves:** `node chapters.mjs` and commit `starts/`. `--dry` prints the summary only.
- **Test** `qa-8`: each start loads as the page loads a save, carries only `PROG_SCHEMA` fields and nothing `progLossy`
  flags, survives a `progJSON` round trip, has its milestones without a tester mark, its registry (a beeper up; a habitat
  with two free ports by `stFind`; a lander on Selene), runs 40 days, and launches what its next mission takes (the
  *Structural test flight* on the Sounding preset; *Heavy lift I* on the scripted player's Orbiter with ballast: no
  `NEXT_PRESET` for it). The title menu lists the same three, into their own slot.
- **Seen in a browser** (headless Chrome on the GPU, by script): each start from the title, Continue to the desk (NEXT, the
  Missions tab with the done firsts struck, the registry), the career save byte-for-byte untouched, Back to your career.
  In the desktop Chrome the tab froze after the station start once, while the local server was starved (4.6 s per file);
  with the server restarted it loaded in 1 s at 8 ms a frame headless. Not played by hand (TESTING 368).

## v1.310 — the loader fills a save from the schema (2026-11-11, platform, QUEUE R1d)

The last slice of the `PROG` schema plan (step 4). `progLoad` (v1.308) now builds a save on `progFresh()` (every row's
default), then PROG's starting literal, then the save. An old save gets every field; a field read with `||default` no
longer needs the `||`. The literal goes second so a save from before `wseed` keeps world 12345, which it always loaded
with (`progFresh` would draw a new world). No `SAVE_V` bump: filling defaults changes nothing a save means.
- **The audit first** (a scratch script over `sim/`, `app/`, `builder.js`, `career.mjs`): for each row with a non-null
  default, every read that could tell absent from the default (`!PROG.k`, `== null`, `=== undefined`, `'k' in PROG`,
  `&&`, a ternary, `if(PROG.k)`). 13 fields, ~25 reads; all read the same either way (0 and false are falsy like absent;
  `{}`/`[]` reads are `PROG.k&&PROG.k.sub` or `.length`). The one difference: `home` is now always set, so the load always
  computes the rivals' forecast (it did once a home was chosen; `rivTick` would build it on the first day anyway).
  Null-default rows: the two `!= null` reads (`cyc`, `commPh`) treat null as absent. Nothing iterates over `PROG`'s keys
  but the serializer.
- **Fields the game doesn't know** are kept as they are (the plan's question 2, default) and named in the tester's
  verbose log (`PROG_UNKNOWN`, a `save` line).
- **Not done (by design):** the `||` reads stay. Retire them lazily, by lane, when a file is touched; platform-6 keeps the
  ones left equal to the table.
- Test platform-8: a sparse save (`funds: 5` and an unknown field) loads with every row that has a default present and of
  its default's kind, funds 5, world 12345, the unknown field kept and logged; a save's own values (`done`, `bailouts`,
  `wseed`) are kept. platform-7's played-save check (a played save loads as a plain restore would) still passes: a
  program from `programNew` already has every field.

## v1.312 — a frame that throws no longer ends the game (2026-11-11, platform, QUEUE R9)

Before: `frame()` (app/loop.js) called `requestAnimationFrame(frame)` as its last line, so one exception anywhere in a
frame (the sim, the HUD, the render) skipped it and the game froze for good, with nothing on screen; the page had no
error handler at all (review 2026-11-09 § 2).
- `frame(now)` is now `try{frameBody(now)}catch(e){gameFault(e,'frame')}requestAnimationFrame(frame)`: the next frame
  is scheduled whatever happened. `frameBody` is the old body.
- **`app/fault.js`** (new, loaded first of the app scripts, so it also catches an app script that throws while loading):
  `window` `error` and `unhandledrejection` handlers and `gameFault(e, src)`. A panel at the bottom: "Something went wrong.
  The game is still running but may misbehave; export your save before you reload", the message, where (`app/loop.js:53`,
  from the stack), how many times; *Reload*, *Export save* (`progJSON()` as `launchpad-save-day<N>.json`), *Export the old
  save* when R10 kept an unloadable one (`launchpad-save-unloadable.json`), *Keep playing* (hides it until an error it
  hasn't shown). The first time each error is seen it goes to the console; every fault goes to the tester's log
  (`logEv('error', …)`).
- `saveFile(text, name)` is the download helper; `exportSave()` can go on a menu later (Import came in v1.316, Q599; before, a save
  file goes back by `localStorage.setItem` in the console).
- Not done: a frame that throws every time keeps throwing (the panel counts it); no automatic pause.
- **Checked in the page, headless** (scratch run of `review/2026-11-11/app/harness.cjs`, the R34 harness, 64 s boot on
  the shared machine): boot 0 errors; `testTopUp` made to throw, 5 frames: 5 faults, none escaped, the next frame
  scheduled each time, the panel shows "boom in a frame · app/loop.js:53 · 5×" with its buttons; restored, the game runs
  on; a window `error` and a rejected promise both reach it; *Keep playing* hides it.
- Test platform-9: the static shape of `frame`/`frameBody` and the script order; `app/fault.js` run against a stub
  document (the panel's content, the count, Keep playing, a new error bringing it back, the old-save button only with a
  `-bad` copy).

## v1.316 — export and import a save from Settings (2026-11-12, platform, QUEUE Q599)

R9 gave the fault panel an *Export save*, but only a crash could show it, and nothing put a file back (it took
`localStorage.setItem` in the console). Settings (Esc › Settings) now has a **Saved program** section:
- *Export save*: `progJSON()` as `launchpad-save-day<N>.json` (fault.js's `exportSave`), any time, mid-flight too.
  *Export the unloadable save* shows when R10 kept one (`<key>-bad`).
- *Import save…*: asks twice ("Click again: choose the file"; the line under it says the file replaces the career, a
  chapter start or the tester's sandbox, whichever slot the page has open), then a file picker. Disabled during a flight
  or a drive (the page reloads after an import, and a flight in progress doesn't survive a reload). Closing Settings
  disarms it.
- `importSave(text)` (app/state.js, after the `storage` listener, so platform-7's slice of the page runs it): the file
  must be a JSON object with a `day` (asked before migrating, which would add one), then the boot's path: `migrateSave`,
  `progLoad` (repair, derive, probe). One that isn't a program or stops the game: the program is reloaded from its own
  text and nothing is written. One that loads: the program it replaces goes to `<key>-before-import` (when there is
  room; it says so when there isn't), the import is written to the slot, `progHeld` is set so this tab can't save the
  old program back, and the page reloads. What the import said (its date, damaged parts reset, a newer game's save, no
  room for the old one) is told after the reload (`sessionStorage` 'launchpad-import-said').
- **Checked in the page, headless** (`review/2026-11-11/app/harness.cjs`, a scratch script): boot 0 errors; the section
  renders; Export hands `saveFile` the program; Import arms on one click, picks on the second, disarms when Settings
  closes; a 30-days-on program through a fake file input: the day goes 0 → 30, the slot holds it, `-before-import`
  kept, the tab held, a reload asked for; a `{"funds":5}` file: "can't be imported: the file is not a saved program.
  Your program is as it was"; 0 errors.
- Test platform-10: a played program's file into another tab (slot replaced, old kept, held, the next boot opens it);
  bad JSON, a string, an array, an object without a day and a save that stops the game, and a full storage, all
  leave the program and the store unchanged; the static shape of the Settings section.
- Not done: no drag-and-drop; the Esc menu itself has no entry (Settings is one click in).
