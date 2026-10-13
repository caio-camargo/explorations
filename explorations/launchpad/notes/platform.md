# Launchpad notes — Platform & QA
**Version**: 1.0.1 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-11 (split from NOTES.md v1.21.52, W37) · **Updated**: 2026-10-13
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
  a low orbit; the Satellite has ~490) → PLAYTEST #101;
- **three clean runs**: ordering one is refused, "153 m/s short for this orbit" (the design's procedure to 300 km
  polar). A route made from a raised orbit (716 km) instead flew one run, which "broke up in the climb" → PLAYTEST #102;
- **kept up**: the route counts its satellite 0 of 1 up from the moment it's made: `routeSats` needs 30 days of
  station-keeping (`skLife`), and a satellite with no fuel "holds 0 d" though it stays up 1,034 d → PLAYTEST #103;
- **repeating, a run by itself, earning**: these follow from the three above. 41 waits took the calendar from day 178
  to 4,000 (~90 days a wait).

Also seen: once a route's satellites have all come down, its Fleet line is gone, and with it *Order a run* → PLAYTEST #104.
