# Launchpad notes — Flow
**Version**: 1.0.8 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-11 (split from NOTES.md v1.21.52, W37) · **Updated**: 2026-10-30
**Purpose**: The build log for screens and navigation, the rooms, the HUD and readout, the map's drawing, the Debrief, the logbook.
**Status**: live log, oldest first; new sections go at the bottom. Index of every section: [`../NOTES.md`](../NOTES.md).

---

## The logbook: discovered facts, and an interface that ages (planning branch, 2026-10-07)

**Idea (Caio):** the reference numbers should be *discovered*, derived from real game data. The first flight out of the
atmosphere records the Δv it took; the first orbit, the best Δv for that, keeping the design. The interface changes
by epoch: scrawled notes first, then a monochrome monitor, and so on. Mission planning, with its graphics, can follow.

**Built (first slice):**
- **Facts measured by flights** (`LOGF`, `logNote`): Δv to leave the atmosphere, Δv to low orbit, orbital period (first
  orbit), highest point, Δv to reach Selene, Δv to land on Selene. The flight record now sums the Δv actually spent
  (thrust/mass over every powered step). Each entry keeps *who* (the design's name: a preset's, or a stable short
  "Design XXXX"), *which flight* and *when*. Records only improve; the last three values stay as history.
- **Records keep the design and the flight:** the design is stored with the record, and the app attaches that flight's
  autopilot tape. "Copy this design" / "LOAD DESIGN" puts it in the builder and installs the record flight as that
  design's autopilot (if it has none), so a record can be studied and flown again.
- **The builder's hint reads the logbook:** "Low orbit: 4,412 m/s (best, Orbiter)" once known; "unknown, nobody has made it
  yet" before. The tools only know what the program knows.
- **Eras:**
  - **Program notebook** (graph paper, handwriting, struck-through old records, "???" for the unknown) until something
    orbits.
  - Then **PROGRAM LOG — TERMINAL 1** (green phosphor, scanlines, "NO DATA").
  - A "modern look" checkbox (kept per browser) overrides either.
- Checks (§18, 4 new, 128 total). Seen end to end in the app: a Passenger flight logs space at 3,095 m/s and its
  145 km apex, with its 7-op tape.

**The map follows the era too** (same branch, same day):
- **Notebook:** graph paper; each body a hand-drawn circle (a steady "tremor" so it doesn't shimmer) with the equator
  pencilled in and the night side hatched; every map line in ink, with warm ones (impacts, encounters) in red pencil;
  handwritten labels.
- **Terminal:** black with scanlines; glowing vector wireframe globes (latitude and longitude every 30°, back side
  hidden); phosphor-green lines and text.
- How: every map line already goes through one buffer (`drawMap`/`drawPatches` → `out`). In an era map that buffer is
  kept (`MAPSEGS`) and drawn on the 2D overlay after an opaque sheet, instead of the GL line pass; labels get the era's
  font and ink. Camera, picking, nodes and handles are untouched.
- Cost: +0.4–0.5 ms a frame (map at 1280 px: modern 2.2 ms, terminal 2.6, notebook 2.7). "Modern look" keeps the
  rendered map.
- Also: a Δv record of 0 is ignored (a placed vessel, not a flight), found by placing one by script.

**More facts** (same day): 15 now, in four sections.
- **Getting up:** Δv to space, Δv to orbit, highest dynamic pressure flown through (logged at flight end if the vessel
  is still alive).
- **In orbit:** the first orbital period; the best ground-station contact a satellite has had (reported between flights
  by the satellite itself, named after it; no design).
- **Coming back** (logged on an intact landing on Tellus): fastest re-entry survived (air-relative speed on the way down
  after reaching space), hottest skin survived (K, with the part), the hardest ride a passenger came home from (g),
  the closest landing to the pad after a trip to space.
- **Out there:** farthest from Tellus (replaces "highest point"; counts the Selene leg), Δv to reach Selene, the first
  orbital period around Selene, Δv to land on Selene, and Selene's surface gravity as the first lander measures it.
- Facts may hold objects (`key` picks the number compared); `logNote(null, …, by)` lets the registry report.
- A Passenger hop logs: max-q 29.9 kPa, entry 1,274 m/s, hottest skin 401 K (the parachute), 6.7 g, landing 25.8 km
  from the pad. Checks §19 (3 new, 136 total).

**Tools gated by what's known** (same day). `TOOLS` maps each tool to the fact it depends on; `toolOK(k)`:
- **Impact prediction** (HUD row, map trace, ground marker, spread) ← *farthest from Tellus* (any flight that has come
  down). Before that the HUD reads "no trajectory data yet". Range safety still uses the prediction underneath: only the
  display is gated.
- **Maneuver planning** (placing a node by click or N, and so the panel and warp-to-burn) ← *Δv to low orbit*. Refused
  with "No maneuver planning yet: it needs 'Δv to low orbit' in the logbook". Autopilot tapes still replay their nodes.
- **Encounter forecasts** (the predicted path inside another body's sphere of influence, encounter labels) ← *Δv to
  reach Selene*. Before that the map's path stops at the edge with "? Nyx: what its pull does next, no data yet" (any
  body: the bodies session added Nyx).
- The logbook says what each fact unlocks ("→ will unlock: maneuver planning" / "→ unlocked: …").
- Fixes found on the way: the gated forecast first crashed the map (the encounter label looks ahead to the next leg,
  so the gated leg now keeps its end but drops its encounter tag); and a *placed* vessel (one that spent no Δv) now
  reports nothing to the logbook. Placing one by script had logged an orbital period.
- Check §21 (1 new, 142 total).

**Next along this line:**
- More facts: lost limits (what broke, and at how much), max-q survived, Selene's gravity, ground-station contact.
- More eras: typewritten reports with stamps, early colour.
- **The map's look following the era:** pencil trajectories on graph paper, then vector CRT. Mission planning UI
  follows the same arc.
- Gating tools by what is known: a transfer planner that needs a measured Selene transfer first.

## UI: screens and navigation — spec (2026-10-07, ui session with Caio; slices 1–3 built below)

**The problem.** The app has two screens (`mode` = editor/flight) plus a `view` toggle for the map. Everything else
was added to whichever panel was nearest when it got built. The whole career (ownership, contracts, race, ground stations,
satellites, 5 epochs, world, know-how) sits in the Assembly left panel, above the parts. The career start and choices
that expire are mixed into that same panel, and nothing stops a launch. A flight has no debrief: `missionEnd` results
only show up as truncated `#news` lines. `#info` can grow past 20 rows and run into `#stages`. `#help` and `#nodep` share
a spot. Revert and Assembly leave a flight with no confirmation. `R` does three things depending on context. Many actions
can only be done with a key. `#news` and `#perf` are visible on every screen.

**Decisions (Caio, 2026-10-07):** Program becomes its own screen. Rollout becomes a checkpoint before launch. The flight
HUD is a core plus cards that appear on demand.

### The map
```
 Program (HQ) ──▶ Assembly ──▶ Rollout ──▶ Flight ⇄ Map
     ▲   ◀────────────┘   ◀────────┘          │
     └──────────── Debrief ◀──────────────────┘
 Overlays on any screen: Logbook (L) · Help (H, shows the current screen's keys) · Esc menu
```
One state variable, `screen` ∈ `program | assembly | rollout | flight | map | debrief`, with a single `go(screen)` that
shows and hides layers and decides which keys work. `mode`/`view` stay as derived aliases until every caller has been
switched over (additive first). Overlays are a stack: Esc closes the top one; with nothing open, Esc opens the Esc menu.

### What each screen shows (and doesn't)
- **Program**, the home screen, entered at load:
  - Header: date, funds, standing, and an Inbox badge.
  - Tabs: **Inbox** (decisions with their deadlines, contract offers, news since the last visit), **Missions** (epochs),
    **Contracts** (active, board, race), **Fleet** (satellites in orbit, ground stations, docked craft), **World**
    (powers, relations, sanctions, election), **Know-how** (bars plus "What we know"), **Company** (ownership, shares, reset).
  - First run: a full-screen "Whose program?" then "How does it start?" choice. It must be made before anything else.
  - Exits: **Build** goes to Assembly; **Logbook**.
  - *Not here:* parts, the ship.
- **Assembly**, building only:
  - A thin strip at the top: funds, date, Inbox count, ← Program.
  - Left: the parts palette and presets. Right: the toolbar, staging, and the selected part's options. Below that, a
    short summary (Δv and TWR per stage, total, cost against funds). Stability, loads and the long aero text fold into a
    collapsed "Aero & structure" block.
  - Exit: **Roll out ▶**.
  - *Not here:* contracts, missions, the site picker.
- **Rollout**, the checkpoint (it can be a panel over the ship on the pad):
  - Site picker and its description.
  - The contracts and missions this flight can satisfy.
  - Cost, days to stack, and the ops fee.
  - Warnings: over budget, site refused or doesn't fit, TWR < 1, unstable, unanswered decisions.
  - Exits: **Launch** or ← Assembly.
  - Owns `renderSites`, which leaves Assembly (as NOTES § v1.27 asked).
- **Flight**:
  - Fixed core (top left): MET, altitude (radar altitude when low), vertical speed, speed, Ap/Pe, stage and total Δv.
  - Bottom: navball, throttle, SAS. Bottom left: stages.
  - Cards appear in a right-hand column while their condition holds, and each can be pinned:
    - **Ascent** (Mach, AoA, q, heat, structure), while in air with q above a threshold or heat rising;
    - **Target** (target, closest approach, line-up, docking), while a target is set;
    - **Payload** (passenger, instruments, contracts), during payload events and on demand;
    - **Fleet** (vessels, switching), when more than one vessel exists;
    - **Bay/Claw/Port**, while armed.
  - The column is capped in height; the oldest unpinned card collapses first.
  - Top right: Map, warp (shown *and* clickable), ☰ (the Esc menu).
  - *Gone from the HUD:* Revert, Assembly, Save tape and Logbook, which move to the Esc menu.
- **Map**:
  - Orbit information (Ap/Pe, period, inclination, SOI, encounter), the node panel, target info, and a focus body picker
    (clickable as well as Tab).
  - The navball shrinks to a heading readout; the cards hide except Target.
- **Debrief**, entered when a flight ends (landed, crashed, in orbit and you choose "End flight", or Revert/Assembly
  from the Esc menu):
  - Sections, in order: outcome, pay, refurbishment, damages, certifications, records, incidents, and the know-how gained.
  - Exits: **Program**, **Assembly** (same design), **Fly again**.
  - `missionEnd` returns a summary record and Debrief renders it, instead of results going to `#news`.

### Overlays and keys
- **Esc menu:** Resume, Revert to launch, Back to Assembly, End flight (a confirmation shows what you lose), Save
  autopilot tape, Settings (modern look, perf readout off by default, which keys).
- **Help** is generated from one key table per screen, so it can't drift from the handlers. One table, two consumers.
- **Keys:**
  - `L` logbook.
  - `R` is only revert, after landing or a crash. RCS moves to `V`. The editor's radial decoupler keeps `R` (screens
    don't share keys).
  - `F5` quicksave stays out of scope.
- **`#news`:** shown in Flight and Program only. In Program its lines go into the Inbox.

### Slices
1. The `screen` state, `go()`, the overlay stack and Esc, and per-screen key tables that feed Help. No visible changes
   apart from Help and Esc.
2. The Program screen: move the `renderProgram` sections into tabs, with the first-run gate. Needs the **economy** and
   **bodies** sessions told; they own those render functions. The HTML they produce moves into tabs; their code stays.
3. Debrief: `missionEnd` → summary record → screen.
4. Flight cards and the core; the Map trims the HUD.
5. Rollout: the site picker and checks move out of Assembly; then trim the Assembly right panel.

Each slice merges to `main` on its own. test.mjs gets a check per slice: every screen reachable from every other along
the arrows, and every key in the handlers present in its Help table.

### Slice 1 built (2026-10-07): screen state, overlays, keys
- `screenNow()` names the screen (`assembly | flight | map` so far). `go(s)` is now the only code that assigns
  `mode`/`view`: LAUNCH, Assembly, Revert, `R` and `M` all go through it. test.mjs §32 fails if a `mode=`/`view=`
  assignment appears anywhere else.
- `KEYS` holds one table per screen plus `all`; each row is `{k: e.key names, l: label, d: what it does}`. The Help
  overlay (`#help`, now centred and outside `#hud`, so it no longer covers `#nodep`) is generated from it, for
  whichever screen you're on. Map shows its own rows, then Flight's. §32 reads every `k==='…'` and `keys.has('…')` in the
  flight, shared and builder key handlers and fails if one isn't listed, or if a key means two things on one screen.
  **Anyone adding a key: add its row to `KEYS`.**
- Overlays (`escm`, `help`, `logbook`) stack. Esc closes the top one; with none open it opens the Esc menu (`#escm`,
  also the ☰ button). In Assembly, a part in hand or a selected part keeps Esc for the builder. The menu has Close, and
  during a flight Revert, Back to Assembly and Save as autopilot, then Logbook, Keys, and a performance-readout checkbox
  (`#perf` is now off by default; localStorage `launchpad-perf`). Revert and Back to Assembly ask twice while
  the ship is in the air; on the pad or after landing they act at once.
- Keys: `H` help and `F` logbook work on every screen. **The logbook is on F, not L as planned: L is held for RCS
  translate.** RCS on/off moved from R to **V**; `R` in flight is only revert.
- Not done yet: the top bar still has Revert/Assembly/Logbook/Save as autopilot (slice 4 takes them off). The Esc menu
  does not pause the game. That's still open: KSP pauses, and here warp would have to drop to 1× and then come back.

### Slice 2 built (2026-10-08): the Program screen
- The page opens on **Program** (`#prog`), a panel over the ship waiting on the pad. Header: date and funds, Logbook,
  **BUILD ▶** (or `B`). Assembly gets back with `P`, the "← Program" button in its new top strip (date, funds, Inbox
  count), or the Esc menu. Internally `mode` stays `'editor'` and `atHQ` hides the Assembly panels. Only `go()` sets it
  (§32), and builder.js's key handler ignores keys while `atHQ` is set.
- Rows in `KEYS` can carry `go:'<screen>'`; the shared key handler acts on them, so screen keys need no handler code.
- **How sections reach tabs.** `renderProgram` (economy/bodies) is unchanged and still writes one column into a hidden
  `#program`. A wrapper calls `progLayout()` after it, which moves each section into a tab according to its heading
  (`progTabOf`):
  - Inbox: decisions with deadlines (always first), contract offers.
  - Missions: the epochs.
  - Contracts: active contracts, standing, the race.
  - Fleet: ground stations, in orbit.
  - World.
  - Industry: know-how, test stand, facilities, development, production, what we know.
  - Company: ownership, shares, history, reset.

  A heading it doesn't know goes to a "More" tab. **§32 fails if any `class="ep">Heading` literal in the page would land
  there.** Whoever adds a section adds its heading to `progTabOf`. Click handlers are delegated on `document`, so moving
  the nodes doesn't break them.
- **First run gate:** while "Whose program?" / "How does it start?" are showing, Program shows only that choice and Build
  is disabled (and `go('assembly')` refuses). This closes "nothing makes you choose before launching".
- Not yet: Inbox doesn't collect news (the `#news` ticker still runs as before); the Assembly right panel is untouched
  (slice 5); the CoM/CoP markers still draw behind the Program panel.

### Slice 3 built (2026-10-08, flow session, QUEUE Q2): Debrief
- **The record is SIM data** (`sim/debrief.js`). `missionTick` takes a snapshot just before liftoff (`R.deb0 = debSnap()`:
  funds, date, know-how, missions done, satellite count, the orbit record). `missionEnd`, once the flight is settled, builds
  `R.debrief = debriefOf(s, R, ups)`, keeps it in `DEBRIEF_LAST` and returns it as `.debrief` beside `{ups, streak}`.
  It never throws: a record that fails to build is `null` and the flight still settles.
  - Outcome: landed (distance from the pad, recovery), lost (the apex), in orbit (pe × ap; "registered in the fleet" when
    `satRegister` took it), landed on / in orbit of a moon, escaping, or ended in flight (written off). A passenger's fate.
  - Money: hardware, launch operations, every pay item, refurbishment, damages, then **"N days passing"**: the rest of
    the funds change (budget days, upkeep, debt) during the stacking and flight days. The lines add up to the net, which is
    `PROG.funds` after minus before (test `flow-1` checks the sum).
  - Missions, telemetry certifications (`ups`), logbook records set on this flight (with the old value), incidents
    (stages on or near towns, on another power's land; a passenger lost), know-how gained per part.
  - **Pay items need one call each where money is paid** (economy, additive): `debPaid(R, kind, label, pay)` in
    `missionComplete` (`rec`), `contractEval` and `stagePay` (which now takes `R`). **A new kind of flight pay should add
    its own `debPaid` line**, or it shows up inside "days passing". Missing lines never break the sum, only its detail.
- **The screen** (`app/debrief.js`, `#deb`): a panel over the pad like Program; header with flight number, design, date and
  time flown; sections in two columns (headings use class `dh`, not `ep`, so §32's Program-tab check ignores them).
  Exits: **Program [P]**, **Assembly [B]** (same design), **Fly again [A]** (Assembly → the usual LAUNCH with its checks;
  disabled for a flight that started in orbit). The one you were heading to is highlighted.
- **How you get there.** `go()`: leaving flight or map for Program or Assembly settles the flight (as before) and, if that
  flight has a record not shown yet, goes to `debrief` instead, remembering where you were going. So the toolbar's
  Assembly, ☰ → Back to Assembly and `go('program')` all pass through it. New: ☰ → **End flight: debrief** (asks twice in
  the air), and an **End flight ▸** button in the flight toolbar once the vessel has landed or is lost (`debEndBtn`, from
  `hudLayout`). Program has **Last flight** to see it again (not kept across reloads). Rover yard skips it.
- **Revert and `R` skip the Debrief on purpose**: they are the quick retry, and the record is still kept (Last flight).
  TESTING row 127 asks whether that's right.
- `atDeb` joins `atHQ`: builder.js ignores keys on Debrief, and render.js no longer draws the builder's CoM/CoP markers
  and `edOverlay` behind either panel (they showed `NaN%` behind Program after a flight). §32 now counts `atDeb=` too.
- Robot: rows that `go('program')` after a flight now land on Debrief first; the next `go('program')` goes on to Program.
  Probed in Chrome (Sounding landed, Orbiter lost, a climb ended from the Esc menu, the Assembly button): screenshots in
  `C:/Users/caioa/dev/playtest-out/flow/`.
- Not yet: the `#news` lines still also run during the flight (the spec moves results off the ticker; they now
  duplicate the Debrief); Inbox doesn't collect them yet.

### Esc pauses; two more lanes; identity mock-ups (2026-10-08, flow session, QUEUE Q39, Q75, Q76, Q73)
- **Esc pauses** (W5, Q39). `gamePaused()` (screens.js) is "the Esc menu is open". While it is, `frame()` skips `simulate`
  (flight, warp, the rover), `sndTick` treats the flight as not live (the mix goes quiet), and the flight key handler
  returns at once, so Space, throttle and the rest do nothing; the shared keys (Esc, H, F) still work. Closing the menu
  carries on at the same warp: nothing drops to 1×, because nothing ran. The menu's title says "· paused" in flight, map
  and rover; its first button is now **Resume [Esc]**. Help and the logbook don't pause (look things up while flying).
  Robot `m1`: 2.5 s with the menu open, `simT` moved 0 s.
- **The builder's key strip** (PLAYTEST #25, Q75): `bldLayout()` puts `#bldhelp` between the two assembly panels, centred
  and wrapping (two lines at 1280×800), instead of across both; hidden below a 160 px gap. Its CSS stays in builder.js;
  the place is set from app/state.js (`hudLayout` and resize), next to the news lane.
- **`#msg` gets a lane** (PLAYTEST #26, Q76): `msgLayout()` (from `HOOK.msg`, `hudLayout`, resize) centres it between the
  readout and the right-hand panels (`#nodep`, `#rvFHud`), drops it below the toolbar or the news where they meet, and
  under the readout when there's less than 200 px beside it. Off the flight screens it goes back to its CSS place.
- Robot `m1` (QA's M1 finish line: gate → Sounding → first orbit → Debrief) passes in full on branch `ui`: Debrief after
  both flights, Esc pause 0 s, no box covering another at 1280×800 on any screen.
- **Visual identity mock-ups** (Q73 → Q53, PLAYTEST #13): three directions, paperwork, instrument panel and
  mid-century poster, on the Program screen and the flight HUD with the real layout over real game frames, plus a later
  era for each: [`mockups/identity/`](mockups/identity/index.html), stills in `output/launchpad/mockups/identity/`, the
  options and trade-offs in [`mockups/README.md`](mockups/README.md). For Caio to pick (or mix: office screens in one,
  cockpit in another); Q53 builds the pick.
- **First run explained** (Q41): the gate's two questions each open with one line on what the choice decides (the power:
  how the money arrives, what the public wants, what a failure costs; the start: who owns the program and who you
  answer to), and every option is a row with its own sentence on screen (it used to be a hover tooltip for the powers,
  so only the chosen power's line showed). "Random world" names what it rolled. The consortium's blurb became one
  sentence. Same buttons and `data-arch` / `data-start` attributes, so the robot rows and handlers are unchanged.
- **Settings** (Q42): ☰ → Settings (`app/settings.js`, `#settings`, loaded last). Sound on/off (same switch as F4;
  `#setSound` is the empty slot for the volume slider, Q35), graphics quality, the performance readout (moved out of the
  Esc menu), the flight gauges, the era look ("modern look", the same switch as the logbook's), and leaving tester mode.
  Each kept per browser (`launchpad-quality`, `-gauges`, and the existing `-sound`, `-perf`, `-modern-ui`). **Quality**
  is a preset over aerofx's A/B flags plus a cap on the adaptive resolution (`RS_MAX` in render.js, which `adaptRes`
  never climbs past): High = everything; Medium = flat clouds (`CLOUD_VOL`), no plume ground glow (`IMPACT_FX`), up to
  80 %; Low = also no bloom, plume light or vapor cones, up to 60 %. The re-entry plasma stays at every level: it tells
  you something. Settings open pauses the game like the Esc menu. **Look & sound:** a new costly effect should get a
  line in `QUAL`.
- **What to do next** (Q40): one line above the Program tabs, **NEXT**, with why and, when a preset is known to fly it,
  which. `nextStep()` (`sim/next.js`, pure, test `flow-2`) picks, in order: a decision waiting for an answer (soonest
  deadline); an accepted contract (soonest deadline); an open mission, preferring ones a preset flies (`NEXT_PRESET`:
  weather and loads → Sounding, beeper → Orbiter with an instrument package, hop → Passenger; all flown by the robot)
  within one epoch of the earliest open one, then the earliest epoch, then the smallest pay; else the best offer. The
  why names the pay, what it opens, and "be first" for a race mission nobody has won. Its button opens the right tab.
  **Economy/bodies:** a mission a preset can fly may get a line in `NEXT_PRESET` (only when a flight has proved it).
- **Results off the ticker; news in the Inbox** (Q99): `missionEnd` is wrapped app-side (`settling`), and headlines raised
  while a flight settles (refurbishment, telemetry, records, missions completed at the end) skip the `#news` ticker:
  the Debrief shows them. Headlines during the flight still show live. Every headline goes to `NEWS` (last 40, with the
  day); the Inbox ends with a **News** section, the ones since you last left the Program marked.
  **Caught on the way (the split's rule 1, app side):** the Program layout runs at start-up, at the end of
  `program-ui.js`, so anything it calls must live in that file or an earlier one. A first cut kept `newsHTML` in
  `debrief.js` (later): the page stopped at load, on the Assembly with a black view. `platform-1` only checks the SIM
  files; robot `m1` on the plain page (no `?tester`) caught it.
- **Map labels no longer pile up** (PLAYTEST #31, Q115). Not labels at the origin: from a camera at Selene, Tellus is a
  dot near the screen's corner, and every city, satellite and fleet name on it was drawn there, because names were gated
  on the camera's distance to its *focus* (`cam.mDist`), not to the body they sit on. City names now need the camera
  within 4.3 R of Tellus, satellite names within 10 R of the body they orbit. And the map places label texts after the
  marks, most useful first (orbit and encounter labels, impacts, then ships, then stations and satellites, then cities),
  skipping any text that would overlap one already placed. Probed on the robot's far-side flight: the pile is gone, the
  orbit labels unchanged.

### Slice 4 plan: the flight core and cards (2026-10-08, flow session, QUEUE Q3; plan only, build after Caio reads it)
**Today.** One `#info` table: 13 rows always (MET, Body, Altitude, Radar alt, Speed, Apoapsis, Periapsis, Mass, Δv, Aero,
Impact, Heat, Structure, Link) plus up to 16 more from ten helpers owned by six sessions (`spinRows`, `wheelRows`,
`rcsRows`, `tgtRows`, `dockRows`, `fleetRows`, `bayRows`, `armRows`, `rvRows`, `payloadRows`). At ~25 rows it runs into
the stages (PLAYTEST #9, TESTING 98). Aerofx's gauge strip (`drawGauges`: altitude tape, air depth, q with max-q, Mach,
heat) sits right of the navball as a placeholder (`gaugeRect`). The toolbar has seven buttons.

**1. The core** (top left, fixed, never more than 6 lines; the spec's list):
- `MET` and the situation on one line: `T+04:12 · Tellus · flying · link Fenfen Cape` (the Link row folds in here; blackout
  in amber).
- `Altitude` (it becomes *radar* altitude, labelled so, below `TERR_TOP` + 20 km while descending), with the vertical speed
  beside it as today.
- `Speed`: one number, surface speed in the air and orbital speed above it (the label says which).
- `Ap / Pe` on one line, each with its time.
- `Δv`: stage · total · TWR.

**2. The gauges are the instrument panel**: they stay bottom centre beside the navball (gauges | throttle | navball |
SAS), shown while the Ascent condition holds (in the air with q > 1 kPa, or skin heating rising), hidden in space, so the
cluster narrows. `gaugeRect` moves to the HUD layout (flow), the drawing stays aerofx's.

**3. Cards**, a right-hand column under the toolbar. Each card: a title bar, its rows, a pin (📌 keeps it open). A card
shows while its condition holds; the column is capped at the window height, and the oldest unpinned card folds to its
title bar first. Today's rows, mapped:

| Card | Shows while | Rows (from) |
|---|---|---|
| Ascent | the gauges show | Structure, Heat (the part, ablator) — the numbers the gauges don't draw |
| Descent | descending with an impact predicted, or landed | Impact (+ spread, range safety), landing (`payloadRows` landing line) |
| Target | a target is set | `tgtRows`, `dockRows` |
| Payload | payload events, or opened from the core | `payloadRows` (passenger, instruments, contracts) |
| Fleet | more than one vessel | `fleetRows` |
| Vehicle | spinning, wheels saturating, RCS on, or opened | Mass · g, `spinRows`, `wheelRows`, `rcsRows` |
| Hardware | a bay, arm or claw armed | `bayRows`, `armRows` |
| Rover | driving | `rvRows` |

**For the other sessions (additive): a card registry.** `HUD_CARDS.push({id, title, when: () => bool, rows: () =>
[[label, html], …]})`. Today's helpers become `rows` unchanged, so their owners change nothing; new HUD content
registers a card instead of appending to `updateHUD`'s list. A static check (like §32) fails if `updateHUD` gains a row
outside the core.

**4. Toolbar**: Map, warp (shown and clickable: ◀ ×N ▶), ☰. Revert, Assembly, Logbook, Keys and Save as autopilot
leave it (all in the Esc menu; End flight ▸ appears when the flight is over, slice 3). The news and `#msg` lanes
(`hudLayout`) take the card column's left edge as their right limit.

**5. Map view**: the core stays; the navball shrinks to a heading line; gauges and cards hide except Target; the node
panel as now.

**Slices**, each merged alone and checked by robot `m1` (no box over another at 1280×800 and 1000×700) plus TESTING 98
(a busy docking flight): **4a** the core, the toolbar trim and the card frame with the helpers mapped (same content,
new places); **4b** the gauges placed and the Ascent/Descent cards (closes PLAYTEST #9); **4c** the map trims.

**4a built 2026-10-09: § v1.101; 4b: § v1.106; 4c: § v1.110 (Q3 done).** **Defaults, for Caio to override** (W15): gauges beside the navball, not in a card · one speed that switches at the
top of the air · Keys leaves the toolbar (H and the menu still have it) · pins remembered per browser.

### Slice 5 built (2026-10-09, flow session, QUEUE Q4): Rollout
- **A checkpoint between the Assembly and the launch** (`app/rollout.js`, `#roll`): a panel beside the ship on the pad,
  like the spec's "a panel over the ship". The Assembly's foot keeps the one-line site summary and gets **ROLL OUT ▶**
  (`#bRoll`); the Rollout has the launch site (the picker, `renderSites`, moved here from the Assembly as § v1.27 asked),
  **Checks**, **The flight** (hardware, ops fee, site fee, funds after, what comes back if it all lands, days until it
  can fly: stacking as `missionTick` reckons it, plus a study and a free pad), **In play** (the NEXT line, accepted
  contracts), then ← Assembly [B] and **LAUNCH**.
- **Checks** (`rollChecks()`): ⛔ over budget, site refused, stages don't fit, stage-1 TWR < 1, unstable with nothing to
  steer; ⚠ the ops fee goes below zero, downrange over another power, weather that may scrub, sluggish TWR < 1.15,
  unstable but steerable, a joint past its certified rating, flight safety refusing a passenger, decisions waiting.
  LAUNCH dims while a ⛔ holds; its own checks (editor.js) still decide. **Vehicle, Q48:** the builder's pre-launch
  warnings (contract orbit out of reach, no chute on a crewed return) belong in `rollChecks`, one line each.
- **`#launch` kept its id** and moved into the Rollout, so every scripted `$('launch').click()` (views.js, the robot's
  `PT.launch`, Fly again) still launches straight away. Only real clicks changed: robot `m1` now clicks ROLL OUT then
  LAUNCH (and shoots the Rollout), and its `PICK` helper opens the Rollout first. `atRoll` joins `atHQ`/`atDeb` (builder
  keys off, builder markers off; §32 counts it). Robot rows m1, 25 and 26 pass.
- Not yet (the spec's "then trim the Assembly right panel"): the cost, days and study lines still also show in the
  builder's panel (vehicle's), so they repeat here.

### Landing where you click (2026-10-09, flow session, QUEUE Q62)
- In the map, a click that misses orbits and satellites is cast onto the bodies (`surfacePick` in `sim/sitepick.js`, pure,
  test `flow-3`): the first moon it meets gives a site in that body's own frame (`pf`, what bodies' `landAt` flies to). If
  the design has a recorded procedure that lands on that moon (`procLandsOn`), it becomes `landPick`: a "landing site" ✕
  on the map, the ▶ Procedure button says "→ 14.0°N 160.9°E", and starting it flies `procWithSite(pr, body, pf)`: the same
  procedure with the transfer aiming its plane at the site and the descent landing on it (NOTES § "Landing on a chosen
  point"). A design with no landing procedure there gets "land there once by hand". Picking again replaces it.
- **The start buttons stay while the craft is on the pad** (`prelaunch()`): ▶ Procedure and ▶ Autopilot showed only at
  `simT === 0`, but time runs on the pad, so they went away a few frames after LAUNCH. They now stay until liftoff.
- Probed in Chrome on a Probe with a Selene landing procedure: the site is picked, marked and named on the button.
  Not flown end to end here: `landAt` itself is bodies' and tested there (§ bodies-3, 5 m from any site).
- **The Program sits over the pad again after a flight** (Q145, PLAYTEST #27's second half): opening the Program while the
  ship is a flown one (`S.rec.launched`) rebuilds the design on the pad (`editorChanged`), so the backdrop is the pad,
  not the stage in orbit or the landing site. The Debrief still shows where the flight ended. Probed: an Orbiter left at
  40 km, Debrief, then Program: the pad.
- **Evergreen (walking the screens as a new player).** (1) Over the notebook-era map, the map every new career sees on
  M, the HUD's glass buttons and white messages vanished on the cream paper: `body.paper` (set while that map shows)
  turns them to ink, with the "on" buttons in red pencil. (2) Keyboard paths: **L** rolls out from the Assembly and
  launches from the Rollout (the buttons say so), **1–8** pick the Program tabs; `KEYS` rows can carry `act` (called
  with the key) as well as `go`. **Enter** ends a flight that is over (landed or lost), like the End flight ▸ button.
- **Rollout checks stay short** (Q151): a check's closing parenthesis (where a number comes from, e.g. vehicle's "your best
  flight to orbit took 4,446 m/s") folds into an ⓘ with the text as its tooltip, and the panel is 340 px wide, so the
  long Δv warning takes two lines instead of four.

### Network screen plan (2026-10-09, flow session, QUEUE Q111; plan only)
LATE_GAME.md (approved) makes the network screen the late game's main screen: nodes you built, routes that fly
themselves, tonnes a year on each, the bottleneck named, beside the pad calendar, with every vessel in flight on screen
(§ "The network", § "Keeping flight in play", NOTES § "Routine runs": "the UI wants a Gantt view of the pads").

**What it shows.**
- **A schematic, not the orbital map.** Bodies as columns, left to right outward (Tellus, Selene, Nyx, then the
  planets as SYSTEM.md opens them); within a column, surface at the bottom and orbits above it, by altitude band.
  Nodes sit in their slot: sites and pads, stations, depots, outposts and bases, datacenters, relays (with a coverage
  bar), the mass driver. Distances aren't to scale; the real map is one key away for that.
- **Routes as lines between nodes**, thickness by tonnes a year, colour by good (propellant, supplies, crew, hardware,
  materials), a dashed line for a route waiting on its window (with "next window in 214 d"). A route through a comms gap
  is flagged (LATE_GAME § Comms).
- **The bottleneck line**, always at the top: one sentence naming the limiting thing ("Depot L1 is short of
  propellant: Selene's plant makes 40 t/y, routines draw 55"), with a button to the node.
- **The fleet strip**: every vessel in flight, its next event and the time to it; nothing coasts out of sight.
- **The pad calendar** under it: one row per pad (and per stacking bay once the hall becomes bays), bars for each
  launch's stacking, launch and turnaround, manual flights and routines in different colours, windows as shaded bands.

**Clicks.** A node opens its panel: stock and needs per good, routes in and out, what it's waiting for, and the
honest next action ("fly a supply run here by hand", "build a second pad"). A route opens its template: design,
procedure, Δv, tonnes per launch (up from what, LATE_GAME § Templates), its window family, recent runs and failures.
A bar on the calendar opens that launch. Every node, route and bar names what it is in words, never only a colour.

**How it reads the game: one pure SIM function** owned by the economy (with space for the orbits), so the screen
draws and never computes: `netModel()` → `{nodes: [{id, kind, body, slot, name, stock, need, paused?}], routes: [{id,
from, to, goods: {good: t/y}, runsPerYear, window?, gap?}], bottleneck: {text, node, good} | null, fleet: [{name, next,
t}], pads: [{pad, bars: [{from, to, kind, title}]}]}`. Test: the model's sums (what routes deliver equals what nodes
receive), the bottleneck picked by the largest shortfall, and a static check that the screen file calls no SIM
function but `netModel`.

**Slices.**
1. **N1, now (M2):** the pad calendar and the fleet strip from what exists: `padsFree`, the dispatch queue
   (`PROG.dispatch`, base runs), the timeline (`upcoming`), registered craft (`satsUp`, `landedUp`, moon satellites).
   A compact pad calendar also goes in the Program's Fleet tab.
2. **N2:** the schematic with today's nodes (sites, pads, satellites by orbit band, bases, relays) and no routes yet.
3. **N3, when the economy builds routines and depots:** routes, goods and the node panels.
4. **N4:** the bottleneck line, then rivals' networks drawn coarsely (LATE_GAME § Rivals) and the era's look (notebook,
   terminal, modern, as the map does).

**Defaults, for Caio to override** (W16): its own screen (key N from the Program, shown once the program has a
second node beyond the pad), not a Program tab · a schematic, not drawn on the orbital map · the pad calendar on the same
screen, below, plus a compact copy in the Fleet tab.

### Network screen, N1 built (2026-10-09, flow session, QUEUE Q155)
- **Network [N]** in the Program's header (and the N key) once something of ours is out there (`netOpen()`: a registered
  craft or a dispatch), W18's default. `app/network.js`, `#net`, a panel over the pad like the Program.
- **The fleet**: every registered craft (not debris, not docked) with its kind, where it is and what it does next
  ("holds its orbit 212 more days", "adrift: out of propellant", "on the surface"), and every queued dispatch ("launches
  in 12 days"), soonest first.
- **The pads**: one row per pad over the next 180 days, a bar per booking (stacking from the order to the launch), 30-day
  ticks, and a row of the timeline's dated events (`upcoming()`), each with its text on hover and the next four listed.
- **Reads `netModel()` when it exists** (economy's Q154); until then `netFallback()` builds the same `{fleet, pads}` from
  the registry, the dispatch queue, `padsN` and `upcoming`. **Economy:** when `netModel` lands, its `fleet` and `pads`
  replace the fallback with no change here; delete `netFallback` then.
- Not yet (N2–N4): the schematic of nodes and routes, goods, the bottleneck line, the compact copy in the Fleet tab.

### `netModel()` built (2026-10-09, economy session, QUEUE Q154; v1.89.1)
The network screen's one SIM function, in `sim/program.js` beside dispatch, in the plan's shape
`{nodes, routes, bottleneck, fleet, pads}`:
- **fleet** and **pads**: exactly what `netFallback` built (registered craft with their next event; queued dispatches;
  each pad's bookings), plus **dispatches waiting for you** after a deviation ("needs you: …", time 0, so first).
  The screen already prefers `netModel()` (`netData`), so it switched over with no change. **Flow:** `netFallback` can
  go now, as your note says.
- **nodes** (N2's groundwork, today's things): our launch sites, ground stations, every registered craft by body and
  slot (`surface`, or the orbit band: `low` under 2,000 km, `high`, `stationary` past 20,000 km), stations and bases
  (a base's members fold into it) with **stock and need** in kg of supplies, days left, and `paused` (adrift, or out
  of supplies).
- **routes**: empty until routines exist (N3).
- **bottleneck**: the crewed node with the fewest days of supplies once under 30 ("Selene Base 1 has 10 days of supplies
  left"); the largest-shortfall rule across goods comes with routes.
Test `econ-14` (3 checks; the bottleneck mutation-tested).

---

### Plan: real screens, not panels over the pad (2026-10-10, flow session, QUEUE Q239, PLAYTEST #6; plan only)
**Caio, 2026-10-10 playtest:** the Program, the Assembly and maybe mission control should be screens of their own, not
UI over the flight view. The Program matters most: it should give the program weight. **Today** `go(screen)` (slice 1)
switches between screens, but Program, Debrief, Network and Rollout are all a panel (`#prog`, `#deb`, `#net`, `#roll`)
over the 3D pad, and `mode` stays `'editor'` behind them (`app/screens.js` 6–31). Mock-ups:
[`mockups/screens/`](mockups/screens/index.html), stills in `output/launchpad/mockups/screens/` (`<screen>.png`, 1280×800).

**The rule: a screen is a place.** If the ship is the subject (Assembly, Rollout, Flight, Map), the 3D view stays and
the screen gets its own setting. Every other screen is a room that fills the window, and the 3D view isn't drawn behind
it. That's also a GPU saving: today the pad renders at full rate behind the Program. Looks follow W14's default: the
**office is paperwork**, the **cockpit and mission control are instrument panels**, and **big moments get poster
headings**.

| Screen | The place | What carries the weight | Mock-up |
|---|---|---|---|
| **Title / first run** | A founding charter on a dimmed night pad; New / Continue / Settings / Tester at the left | The game's name; you sign the charter; the program's seal | `title` |
| **Program** | **The director's desk**, seen from above | Letterhead with the flag and name; a desk calendar for the date; funds on a ledger slip; the **in-tray** (decisions as memos with deadline stamps, offers as folders, news clippings); the **open folder** (tabs as folder tabs, flown missions struck through in red); a **pinned photo** of the last flight (a real frame captured at liftoff), a newspaper cutting for standing, framed certificates for firsts; NEXT as a sticky note | `program` |
| **Debrief** | A typed **flight report** on the same desk, with the photo and the next day's paper beside it | A poster headline for a first ("FIRST IN SPACE"), money as a ledger with a double-underlined net, a FILED stamp, a signature | `debrief` |
| **Mission control** | **A control room**: a ground-track wall screen with stations' circles, clocks and pads beside it, and a row of consoles | Every craft in flight on one screen: FLIGHT (vessels and next events: watch, fly it, warp to), NETWORK (stations, links, gaps), TRAJECTORY (planned burns: move to the next pass, hand off, fly by hand), RECOVERY · DISPATCH | `mission` |
| **Assembly** | **The assembly hall**: a high bay, a gantry crane, floodlights, the ship on a stand (still the 3D view, a new scene instead of the pad) | Blueprint sheets: a **parts catalogue** by category with pictures (Q238), the **specification** in groups (Q237: mass and cost, stages and Δv, for this flight, flight qualities), radial mounts shown when a radial part is held (Q236), Clear (Q235) | `assembly` |
| Rollout | Stays on the pad: the pad is its point. Later its panel becomes a clipboard checklist | — | none |
| Network | Becomes mission control's NETWORK console and wall (N2's schematic is the wall's second page) | — | (in `mission`) |

**Mission control's content already exists**, spread around: the fleet strip (N1), stations and links (`coverOf`,
v1.109), planned burns and hand-offs (`nodeHandOff`, v1.93; Q196 moves them), dispatch and pads (`padsFree`, the pad
calendar), and watch mode (Q43). This is where those flow items get a home, instead of more Program tabs. It opens once
something is in orbit, the same rule as `netOpen()`. **C** opens it from the Program. During a flight, it's one key away
for any craft other than the one you're flying.

**How it's built.**
- **R0, the room layer:** `go()` gets a `ROOMS` set (`title`, `program`, `debrief`, `mission`, later `network`). Entering
  a room shows one full-window `#room` container with its own background, and `frame()` skips the 3D draw (the sim
  keeps running, so time still passes on the Program). Leaving rebuilds nothing: the ship is still on the pad. Panel
  content keeps its render functions: `renderProgram`/`progLayout`, `renderDebrief` and `renderNetwork` fill the room's
  slots instead of a panel. Economy and bodies change nothing (the same rule as slice 2). Tests: robot `m1`, §32 (go-only
  screen changes), and a new check that no room screen calls the 3D draw. Measure the GPU time on Program before and
  after.
- **R1, Program as the desk:** the letterhead (`powerMark` from `app/flags.js`), the in-tray (Inbox), the folder with tab
  sheets (the other tabs), the right-hand wall (photo, clipping, certificates). The photo is the **last flight's liftoff
  frame**, captured from the canvas when `missionTick` sees liftoff, kept as a small JPEG in `PROG` (a first flight shows
  the empty pad). Fonts: bundle Special Elite, Courier Prime and Bebas Neue (all OFL, ~150 KB of woff2), as Q53 allows.
- **R2, Debrief as the report:** the same desk; `debriefOf` already has every line. The poster headline only for a
  first, a record or a loss.
- **R3, Title and first run as the charter:** the gate becomes the title screen. Continue skips it.
- **R4, Mission control:** the room and its four consoles from today's functions. This takes Q43, Q167, Q196, Q203
  and N2 (Q170) with it: build those into it, not into Program tabs.
- **R5, the assembly hall** (with **vehicle**, whose Q235–Q238 fill the panels, and **look & sound**, whose hall interior
  replaces the pad scene in the Assembly): a scene switch in `render.js` and the blueprint panels. The hall's 3D is look &
  sound's item; the panels' new layout waits for Q237's sketch and Q238's plan, so the vehicle lane's work lands in this
  layout.
- **Later eras:** each room shifts the way the identity mock-ups do. The desk goes from typewriter to printouts to
  monitors; mission control from amber to green to colour glass. That's one class on `body` per era, as the map already
  does.

**Defaults, for Caio to override (W35):**
1. **The Program is the desk seen from above** (flat, cheap, readable, holds a lot), not an illustrated office in
   perspective.
2. **No 3D behind the rooms.** The pad shows up as the pinned photo, not as a live window. A live picture-in-picture of
   the pad could come later.
3. **Mission control is its own screen**, opened after the first orbit, and the Network screen folds into it.
4. **The Assembly moves into a hall** (a new 3D scene) with blueprint panels, rather than staying on the pad.
5. **Order:** R0 → R1 (**built: § v1.114**, Q240) → R2 (**built: § v1.116**, Q241) → R3 → R4 (**built: § v1.131**, Q241), then R5 once vehicle's Q237/Q238 land. R0+R1 are one M1 slice; the rest is M1 polish
   or M2 (R4).

**Caio, 2026-10-10 (playtest, PLAYTEST #45): W35 closed; (4) overridden, the Assembly is a model on a desk, not a hall.**
The design is a scale model on a drafting table, not the real rocket; the player clicks *Build and launch*, and the
rollout shows the real one on the pad. Consequences: no hall scene (Q242 becomes the desk scene, look & sound parts &
pad); R5 is the desk room around the model (flow), with the builder's panels as paperwork on the desk (vehicle's
Q237/Q238); the model can sit anywhere in its frame (PLAYTEST #44 pinning is easier); defaults 1, 2, 3, 5 stand.

## v1.99 — the planets on the map (2026-10-09, flow session, QUEUE Q175 = Q87 slice 1's drawing; closes PLAYTEST #11)

Helios and the five other planets are on the map from epoch 1, on a dashed **ring in the ecliptic** around the map's
centre. Each one sits at its ecliptic longitude that day, with its real distance in the label (`Enyo · 2.36 TU`), as a
disc sized by class: Hyperion 6 px, Hesper and Enyo ~2.5, Astraea and Erebus at the 2 px floor, and Helios a 7 px sun
with rays. The ring's radius is 0.3 × the camera distance, so it stays on screen at every zoom. Marks behind Tellus are
hidden. It works in all three map styles: notebook (era ink), terminal, and modern (GL ring, depth-tested behind the planet).
- `planetMarks(T)` (end of `sim/system.js`, additive; space's file): `{name, p, u, d, R, color, px}`. `p` from
  `fromTellus`, `u` = `p`'s direction laid into the ecliptic (`eclFrame().N` removed), `d` in TU. Drawn in `drawMap`
  (`app/render.js`), before the GL line pass so the ring is in `MAPSEGS` too; new mark `planet`, text priority 5 (lowest).
- **Negative result: their real places don't work on this map.** Drawn at infinity in their true directions, all six
  were 99–137° from the default map camera's axis, behind it. The map looks down on Tellus at 26°, so the ecliptic's
  horizon is above the top of the screen. That's why there's a ring: it shows the true longitudes (which matter for windows and the sun's side) and drops
  the ±23° of latitude.
- Test `flow-4` (1 check; mutation caught: `u` not laid into the ecliptic). Stills (local, gitignored):
  `output/launchpad/q175-planets/`.
- **Open:** two planets close on the ring (a conjunction) lose one label to the overlap rule (#31); the dot stays. The
  sky's sun still sits at the fixed `SUN_DIR` while the map's Helios moves with the year (slice 3, space). In the era
  maps the ring is drawn over Tellus, as all their lines are (no depth on the overlay).

## v1.101 — the flight readout: a core and cards (2026-10-09, flow session, QUEUE Q3, UI slice 4a; W15's defaults)

The readout top left is now the **core**, 5 lines that never grow: `MET · body · situation · link` (the Link row folded
in), `Altitude` (it becomes `Radar alt`, with the biome, below `TERR_TOP` + 20 km while descending), `Speed` (one number:
surface in the air or landed, orbital above it), `Ap · Pe` with their times, and `Δv` (stage · total · TWR). Everything
else is a **card** in a column on the right, under the toolbar (and under the maneuver node panel or the rover's panel when
one is open):

| Card | Shows while | Rows |
|---|---|---|
| Ascent | in the air, or the skin above 30 % of its limit | Aero, Heat, Structure |
| Descent | coming down with an impact predicted, or any time range safety warns | Impact |
| Target | it has rows (a target, a docking, a landed target) | `tgtRows`, `dockRows` |
| Payload | it has rows | `payloadRows` |
| Fleet | more than one vessel, or flyable ones nearby | `fleetRows` |
| Vehicle | spinning, wheels saturating, or RCS on | Mass · g, `spinRows`, `wheelRows`, `rcsRows` |
| Hardware | a bay or an arm | `bayRows`, `armRows` |
| Rover | driving | `rvRows` |

- A 📌 keeps a card open (pins remembered per browser, `launchpad-hud-pins`); a click on a title folds that card. When
  the column is taller than the window, the oldest unpinned cards fold to their title bars first (`cardFolds`, pure).
  On the map only the Target card stays.
- **For other sessions:** new HUD content is a card: `HUD_CARDS.push({id, title, when?, rows})` in the new
  `app/hud.js`. The row helpers are unchanged, their owners change nothing. Test `flow-5` fails if `updateHUD`'s core
  passes 6 rows or calls a helper, or a helper has no card.
- **Toolbar:** Map, warp as `◀ N× ▶` (clickable; amber when warping), End flight, ☰. Revert, Assembly, Logbook, Keys
  and Save as autopilot are in the Esc menu only. Their buttons stay in the DOM, hidden, since the menu and the robot click them.
- **Layout fixes found on the way:** the news box overran its lane by its padding (`max-width` leaves it out), which
  the column made visible; `#msg` is placed again after the news, since it used to dodge the news's old place.
- Robot `m1` and row 98 (the busy docking flight) pass with no overlapping boxes at 1280×800 and 1000×700. `PT.hud()`
  reads the core and the cards. Test `flow-5` (2 checks; mutations caught: a 7th core row, a helper back in the core).
  Stills (local): `output/launchpad/q3-slice4a/`.
- **Next, 4b:** the gauges placed as the instrument panel beside the navball and hidden in space (today aerofx's strip
  also shows in orbit), with the Ascent card trimmed to what they don't draw. Closes PLAYTEST #9. **4c:** the map trims.

## v1.103 — every node of a chain on the map (2026-10-09, flow session, QUEUE Q157; v1.85's "not yet")

- The map draws every node of a chain at its place from `nodePlan`. The node the panel has selected (◀ node k of n ▶)
  carries the drag handles; the others get a ring marker. With more than one node, each is labelled
  `node k · Δv m/s · in T`. These labels are placed before any other, so a Pe/Ap label can't hide them.
- **A click on a marker selects that node** (the panel follows), and its handles edit that node's Δv. Moving a node in
  time by dragging it along the orbit still works for the first node only, because the map's pick only knows the current leg.
- A node on another body's leg is drawn by that body where it will be at the node's time, as the plan's legs are.
- Checked in the page (a 200 km orbit, three nodes from N's `nodeAddNext`): markers at the planned places; selecting node
  2 moves the handles to it; a 0.8 s drag on its normal handle changed node 2 only (normal 0 → 25.8 m/s), nodes 1 and 3
  unchanged. Robot `m1`, 51 (the map, tools refused) and 98 pass.
- Two nodes at the same point (a burn at apoapsis that doesn't circularise leaves the next apoapsis where it was) draw
  on top of each other, and the later label is skipped.

## v1.106 — the gauges are the instrument panel (2026-10-09, flow session, QUEUE Q3, UI slice 4b; closes PLAYTEST #9)

- aerofx's gauge strip (altitude tape, air depth, q with max-q, Mach, heat) now has its own place: `#gslot`, the left of
  the bottom cluster, **gauges | throttle | navball | SAS**. The cluster stays centred, so it narrows in space and the
  navball moves over. (I tried a fixed navball with the gauges hung to its left; at 1000×700 they'd sit on the stages panel.)
  `gaugeRect` (gl.js) reads the slot and scales the strip to it (254 px wide on small windows).
- **Shown while the Ascent condition holds** (`ascentOn`, app/hud.js): in the air with q over 1 kPa or below 20 km (the
  climb's start, and a landing's radar tape), low (under 20 km) over an airless body, or the skin above 30 % of its
  limit. Held 3 s after it ends, so it doesn't flicker. Hidden on the pad, in space and on the map. Settings' "flight
  gauges" off hides it, as before.
- **The Ascent card** shows with the gauges and keeps only what they don't draw: AoA, Heat (the part, ablator),
  Structure. With the gauges off it shows the Aero row (Mach, AoA, q) again.
- Checked in the page: hidden on the pad, shown 5 s into a climb, hidden 3.6 s after reaching orbit (the cluster 334 px
  wide). Robot `m1` and 98 pass at 1280×800 and 1000×700. Stills (local): `output/launchpad/q3-slice4b/`.
- **Next, 4c:** the map trims (the navball shrinks to a heading line on the map).

## v1.107 — the crew in the Debrief (2026-10-09, flow session, QUEUE Q191; closes PLAYTEST #34)

- A crewed flight (people, once the escape tower is qualified; not the test dummies before it) gets a line in the
  Debrief's outcome block: **"Crew of 2 home safe after 2.5 days"** (green; the days only from one day up), **"Crew of 2
  aboard, all well"** (still flying), or **"The crew of 2 were lost"** / "…were hurt by 9.1 g" / "…overheated (cabin
  340 K)" / "…ran out of air" (red; the same reason the news gives).
- The crew block in `missionTick` (`sim/program.js`, additive) now keeps the seats at liftoff (`R.crewN`) and the
  reason for a loss (`R.crewWhy`). The record has `D.crew = {n, ok, home, days, line}` (`sim/debrief.js`).
- Test `flow-6` (1 check: home after 2.5 days, lost, aboard, dummies with no line). Robot row 65 (the crew rotation)
  shows "Crew of 2 home safe". One run of row 65 lost the capsule 12 s in; the next passed, so it looks like a flake.
- **Not yet (space):** (done in v1.124, Q214) for a rotation, the days the crew spent aboard the station. The Debrief only knows this flight's
  time; the station's `crewDays` is per station, not per person.

## v1.110 — the map trims the navball to a heading line (2026-10-10, flow session, QUEUE Q3, UI slice 4c; closes Q3)

- **On the map the navball is one line**: `HDG 090°  PITCH -2°  ORBIT  THR 0%` in a small panel beside the SAS buttons,
  which stay (SAS → node is a map action). The ball and the throttle bar hide; the line carries the throttle instead.
  `body.mapv` (set in `render()` when the map opens in flight, like `body.paper`) does it in CSS; on the notebook paper the
  line is a dark pill like the other panels. The core, the Target card and the node panel stay; the gauges and the other
  cards already hid on the map (4a, 4b).
- Test `flow-7` (static: the CSS, the toggle, the throttle in the line, cards and gauges off on the map). Robot row `m1`
  gained a map step after the orbit (`orbit_map` shot, `PT.boxes()`): no box over another at 1280×800 and 1000×700.
- Seen in the stills, not fixed (Q175's labels): with Helios close in the sky, a planet's label can sit on another
  planet's disc (Hesper's "0.40 TU" under its own disc beside Enyo's label).

## v1.111 — the rollout lying down (2026-10-10, flow session with look & sound's pad, QUEUE Q193; Q159's "not built")

- **On a Steppe pad the Rollout is a rollout**: the screen opens with the rocket on its side on the transporter-erector at
  the assembly hall's door, 120 m north; the car rolls it down the rails to the pit (7 s), the boom raises it (5 s), then
  the four support arms and the two cable masts, standing open until then, close on it (1.5 s). A Cape pad is unchanged.
- The clock is `rollPhase()` in `app/rollout.js` (`ROLL_S`; null unless the Rollout is open on a Steppe pad); it
  restarts on entering the Rollout (`go` clears `rollSite`) or on picking another site. In `app/gl.js` (additive):
  `drawSteppeRig` moves the car (`rollDz`), turns the boom and holds the arms open from it, and `rollTilt(camW, M)`
  turns the ship's model matrix with the boom about its hinge and carries it with the car (`render()`'s `Mship`, so the
  shadow follows).
- LAUNCH isn't held back: launching mid-rollout stands the rocket up at once (the flight's rig starts as before).
- The rocket lies on top of the boom's cradle arms, ~10 m up: the boom (Q159) stands beside the rocket with arms reaching
  across, so laid down they hold it that high. A real erector carries it just above the boom; that's look & sound's
  mesh if it reads wrong.
- Test `flow-8` (the clock's three phases in turn, none on a Cape pad, a new site restarts it; the wiring). TESTING 190.
  Stills: `output/launchpad/q193-rollout/` (rolling, at the pit, rising, closed). Robot `m1` (a Cape rollout) passes.
- **Not yet (look & sound):** a sound for it (the car's rumble, the boom's hydraulics); the camera stays where the
  Rollout puts it, so the car is small at the hall's door for the first seconds.

## v1.112 — flags and roundels in the UI (2026-10-10, flow session, QUEUE Q104; POWERS.md § Schools "Flag motifs")

- **Every power has a flag and a roundel** (`app/flags.js`, SVG), from its hardware school's motifs in its own hue
  (`p.hue`), with one of four variants per power (from its name), so two powers of one school fly cousins:
  Cape stripes and a starred canton; Steppe one gold star on a plain field; Arsenal chevrons and a disc; Coastal
  tricolour bands, some with a disc; Mountain a sun disc, rays or mountains; Isle a constellation by a hoist band. A
  resource state flies its contractor's hardware but **its own flag**: a crescent and star for an Emirate or Sultanate,
  a lozenge for a Kingdom. The roundel is the flag as a disc with a white rim; Cape's and Steppe's match the rockets'
  (gl.js's GLSL `roundel`); the other four schools' discs are new here, for look & sound to follow on the hulls.
- **Where:** the world section (home's flag by its name, a small flag by each other power), the race (a roundel by the
  rival who's expected or got there first), the Program's News (the roundel of the first power a line names,
  `newsMark`). Contracts, ownership shares and the map's cities still show only the power's colour.
- Test `flow-9` (every school × variant × hue draws a well-formed flag and roundel in the hue; this world's five
  powers fly five different flags; the resource state's isn't its contractor's; news gets the first named power).
  TESTING 191. Stills: `output/launchpad/q104-flags/` (the sheet of every school, variant and three hues; the world;
  the news).
- Some draws come close to real flags (a red Steppe flag, a white Mountain one with a red disc, a red crescent). The
  schools echo real programmes on purpose (POWERS.md), but a hue rule could steer away from the closest matches if
  Caio wants.

## v1.114 — the Program as the director's desk, the first room (2026-10-10, flow session, QUEUE Q240 = Q239 R0+R1; PLAYTEST #6)
- **Rooms (R0).** `ROOMS` and `inRoom()` in `app/screens.js`. A room is a screen that is a place of its own, not a panel
  over the pad. So far only `program` is one. While a room shows, `frame()` skips `adaptRes` and `render()`. The sim
  still runs, so days still pass. `go()` sets `body.room`. Measured headless on the RTX: the
  Program's frame was 0.02 ms of CPU and no GPU. The same pad scene in the Assembly costs 0.39 ms of CPU and 5.9 ms of
  GPU, which is roughly what the Program cost while the pad was drawn behind it.
- **The desk (R1), `app/desk.js`**, laid out by `deskLayout(box, gate)` from `progLayout` (the sections are sorted into
  tabs as before, so economy and bodies change nothing):
  - The **letterhead**: the home power's flag (`flagSVG`), the program's name, "Office of the Director", the kind and the
    power, funds, and a desk calendar (year, day).
  - The **in-tray** (left) is the Inbox: decisions, offers, what's coming up, the news. It isn't a folder tab any more.
    Its label **IN · n** is the `data-ptab="inbox"` button, so NEXT's "Inbox ▸" and the robot rows still work: asking for
    the Inbox flashes the tray.
  - The **folder** (centre) has the other tabs as folder tabs and a paper sheet. Flown missions are struck through in
    red. NEXT is a sticky note above it. Keys 1–8 now count from Missions.
  - The **wall** (right): **the last flight's photo**. `deskPhotoTick()` reads the canvas 2.5 s after liftoff, in the
    same task as the draw, so no `preserveDrawingBuffer`. It's kept per browser (`launchpad-photo`, not game state), and
    shown only for the same program and flight count. Below it, a cutting from *The <home> Herald* (our own news first,
    then the latest headline that isn't a warning), and certificates for the race firsts we won (the latest two).
  - The exits: Logbook, Last flight, Network, Rover yard, and **TO THE ASSEMBLY HALL ▶ [B]** (`#bBuild`, same id).
- **The look** follows W14's paperwork: the CSS vars are redefined inside `#prog`, so the economy's markup reads in ink on
  paper. Power colours meant for dark glass are darkened on paper by a filter. **Fonts are bundled** in `fonts/`
  (Special Elite under Apache-2.0, Courier Prime and Bebas Neue under OFL; 105 KB of woff2, latin subset, licences
  beside them), loaded with `@font-face` and falling back to Courier/Impact.
- **Checks:** test `flow-10` (the gated draw is the only `render()` call; rooms, `body.room`, no Inbox folder tab, the
  tray button, fonts). Robot row **`desk`** flies a Sounding in real frames, so `frame()` takes the photo as it does in
  play, then shoots the desk: photo, clipping and in-tray present, no overlapping boxes. `m1` passes in full.
- **Not yet:** the first-run gate still sits in the folder (R3 makes it the charter). Debrief and Network are still
  panels over the pad (R2, R4: Q241). The Assembly's hall is R5. The in-tray's offers are long: a memo could fold to its
  title line.

## v1.115 — the Assembly as a scale model on a drafting table (2026-10-10, flow session at Caio's ask, QUEUE Q242; PLAYTEST #45)
- **Caio's call (PLAYTEST #45, W35 (4) overridden):** the design is a scale model on a 1960s drafting table, not a real
  rocket on the pad. The builder is untouched: its camera, picking, markers and panels are the same, and only what's
  around the design changes. `app/model-desk.js`, loaded after `gl.js`.
- **The scale is a kit scale.** `deskScaleFor(len)` picks the smallest of 1:20, 24, 32, 48, 72, 96, 144, 200, 288, 400
  and 500 that keeps the model under 45 cm: the Orbiter (14.5 m) is 1:48, a 120 m rocket 1:288. The
  desk is built in the ship's own frame (`modelQ(S.q, …, [-cm, yBot, -cm])`, the model's foot at the origin) and scaled
  up by N. Everything around the model is N times its real size; the little figure on the base plate is a real 1.8 m
  person. Meshes are cached per scale (the last four).
- **The desk:** a walnut table on legs with a foot rail; an A2 drawing under the model (its border, a title block and a
  few construction lines); a scale rule and a pencil; a black base plate with its pin; an architect's lamp (base, brass
  post and arm, green shade, the bulb drawn with `uGlow`); a figure in a white coat; the office floor. There are no
  walls, because the orbit camera passes through where they would be. The background is a dim warm room
  (`DESK_BG`, the clear colour).
- **`render()` in the Assembly** (`deskScene()`: editor mode on the `assembly` screen): no sky ray-cast or moons, pads,
  pad rig and crew, cities or floodlights (`uFlI` 0). Light comes from the lamp: `uSun` is the lamp's direction in the
  ship's frame, with warm sun, sky and bounce colours (`deskLight`). `lit()` is 1, so there's no night and no eclipse
  on the desk. The model's shadow falls on the drawing along the lamp (`deskShadowM`, the pad's projection onto the
  table plane). `DESK_FX = false` puts the Assembly back on the pad (A/B).
- **Look & sound:** the pad crew (Q229's suits on Cape's crew arm) now show in the **Rollout**, not in the Assembly, because
  the desk has no pad. The figure on the base plate stands in for them there; a suited one could be yours.
- **Build and launch:** the Assembly's button now reads **BUILD AND LAUNCH ▶ [L]** (`#bRoll`, same id and key). It goes to
  the Rollout, which stays on the real pad with the real rocket, so building it for real is the hand-over.
- **Cost:** about the same as the pad. Headless on the RTX, the Assembly ran at 133 fps on the desk against 104 on the
  pad. The GPU timer read 7.6 ms against 6.8 ms, but the model fills more of the frame up close.
- **Checks:** test `flow-11` (the scale picks, the Assembly-only switch, every skip, the lamp light and its shadow).
  Robot `m1` and `desk` pass, with no overlapping boxes.
- **Not yet:** the panels are still the builder's dark glass (vehicle's Q237/Q238 and flow's R5, Q241, make them
  paperwork on the desk). There's no title-block text with the design's name and scale yet; the scale could go in the
  strip. A tilting drafting board, a T-square and an eraser would be look & sound's polish.

## v1.116 — the Debrief as the flight report on the desk (2026-10-10, flow session, QUEUE Q241 R2; PLAYTEST #6)
- **The Debrief is a room** (`ROOMS` has `debrief`): it fills the window on the same wooden desk as the Program, and
  `frame()` draws no 3D behind it. The old panel over the pad is gone. `go()`, the keys (P, B, A) and the button ids
  (`bDebProg`, `bDebAsm`, `bDebAgain`) are unchanged; their row is `#debActs` at the foot of the report.
- **The report** (`renderDebrief`, `app/debrief.js`; it still only renders `debriefOf`'s record):
  - A typed header line: FLIGHT REPORT · No. n, the design, the date, the time flown. A red FILED stamp.
  - **The headline is a poster only when it's news**, in this order: a crew lost ("Crew lost", in black), a first in the
    world (the mission's name, kicker FIRST IN THE WORLD), the vehicle lost, a beaten record (kicker NEW RECORD). Any
    other flight gets its outcome typed ("Landed", "In orbit"). The lead line carries the outcome's detail, the crew and
    a passenger.
  - Two columns. Left: **money as a ledger**, losses in red, *Net for the program* ruled and double-underlined; then the
    logbook. Right: missions (✓, "first" in red), certified by telemetry, know-how, incidents, the clean streak.
  - The foot: "Filed by flight control" with the date and a signature, and the exits: Fly again, Assembly, **To the
    office ▶ [P]**. The one `debNext` points to is the dark button.
- **The wall beside it:** this flight's own photo (`deskPhoto()`, only when its flight number is this report's; a flight
  that began in orbit says "no liftoff") and the papers' cutting from the days it flew (`deskNews` on the news since
  `D.day0`). `app/desk.js` now shares `deskPhotoCard`, `deskNews` and `deskClipping` between the Program's wall and the
  report's.
- **Checks:** test `flow-10` (the Debrief is a room; its exits and wall). Robot row `desk` shoots the report after a real
  Sounding flight (photo pinned, no overlapping boxes); row 127 (the Debrief after each way a flight ends) passes, its
  selectors moved to `#debActs`.
- **Not yet:** the signature is "Flight Control": there's no named staff until the roster (Q133). The mock-up's "What
  it opens" section needs a list of what a flight unlocks, which the record doesn't keep. A long report scrolls inside
  the paper.

## v1.128 — small playtest fixes: the toolbar, Recover vessel, node delete, the map's arcs, the Design table (2026-10-11, flow session; QUEUE Q273, Q263, Q255, Q260, Q266, Q256, Q272, Q269, Q254, Q258)
- **Q273 (PLAYTEST #73), the toolbar on a bright sky:** flight HUD buttons and the warp readout sit on an opaque dark
  plate (`#hud button`, `#hud #warp`); the navball's heading line has a dark text shadow. The notebook map's ink
  (`body.paper`) still wins there.
- **Q263 (#63), Recover vessel:** landed or splashed at home and still, *End flight ▸* reads **Recover vessel ▸ [Enter]**
  in green (`debRecover()`, `debEndBtn` in `app/debrief.js`), and the Esc menu says the same. Landed on a moon, it stays
  *End flight*. The Debrief already counts the recovery.
- **Q255 (#54), deleting a node:** the cause was in the node panel's click handler: any action starting with `d` was
  read as a Δv nudge (`d0+`…), so the **Delete** button's `del` never reached the delete. Only the Del key worked. Now
  the nudges match `/^d[012][+-]$/`, and Delete (button or key, `nodeDelSel()`) removes **the selected node** (it used
  to drop the active one whichever was selected) and says which went and how many are left.
- **Q260 (#60), two arcs and two impacts:** Tellus's legs are numeric paths, so the predicted orbit was drawn whole
  through the air beside the impact predictor's path, with its own *Impact in* label. Now, with the predictor on, the
  current leg stops where it **enters the air from above** (climbing through the air, the arc and apoapsis still show;
  falling inside it, only the predictor's path does), and the leg drops its Pe/Impact labels. The conic branch (other
  bodies) does the same. The spread marks are circles labelled *spread ±N km*, not more X's; a dropped stage's mark
  says *<stage> falls*.
- **Q266 (#66), paths round the planet:** `fall()` keeps each point's time (`pathT`) and flags a run that used up its
  40,000 steps still in the air (`capped`). `predictImpact` treats a capped run as **no impact** (it used to give the
  last point as one). When there is an impact, the map draws **only its last revolution**, and the label says *after ~N
  orbits*. `debrisImpact` is unchanged.
- **Q256 (#55), the planets' ring:** it sits outside the moons' orbits whenever they're in view (1.25 × the farthest
  moon's apoapsis), and a label says *the planets: direction only, not to scale*. Zoomed in close it's the old compass.
- **Q272 (#72), the Design table:** every name a player reads (buttons, keys, the Esc menu, the screen name, the desk's
  exit **TO THE DESIGN TABLE ▶ [B]**, the Debrief, the supply-run and dry-run lines), PLAYROUTE and the TESTING steps.
  The screen id stays `assembly`, and the pads' assembly halls keep their name.
- **Q269 (#69), first-run choices:** the chosen archetype is a dark ticked button with a red bar (the desk's paper
  buttons had flattened `.on`), and a note above the start options says what's chosen and that picking a start begins the
  career. Decisions (`data-dk`) answer on the click, so they need no selected state.
- **Q254 (#53, #57), the navball:** shown on the map too (130 px, beside its heading line). Pitch marks every 10° (30°
  and 60° stronger), heading marks every 30° (the quarters stronger), and **N** in red with E, S, W on the horizon.
- **Q258 (#58), the terminal looked low-res:** the overlay canvas (labels, the era maps, the gauges) had the 3D view's
  adaptive resolution and was upscaled. It is now sized at device pixels (up to 2×), and drawing stays in the 3D view's
  pixels through a transform (`OV_K`). The glow's `shadowBlur` is scaled by hand, since it ignores the transform.
- **Checks:** test `flow-12` (`tests/flow.mjs`). Probes: the delete, Recover vessel, the arcs at 61 km and 137 km
  periapsis, the terminal map, an ascent on the map. Robot `m1`, 127, `desk`.

## v1.131 — mission control, a room (2026-10-12, flow session, QUEUE Q241 R4; § "Plan: real screens"; Q203)
- **Mission control is a room** (`ROOMS` has `mission`; `go('mission')`, `atMC`) and takes the Network screen's place:
  the old `#net` panel and `renderNetwork` are gone. **C** opens it from the Program (N still does), and the Program's
  exit reads *Mission control [C]* (`bMC`). Same opening rule as before (`netOpen()`: something of ours out there, or a
  dispatch queued); before that, C says so. In the room: **P** back to the office, **N** waits until the next event,
  **W** flips the wall. `app/mission.js`; the CSS sits above the Debrief's in `index.html`.
- **The look** follows the mock-up (`mockups/screens/`, `mission`) and W14: a dark control room, a wall of three CRT
  screens over four consoles, amber text and a green ground track in VT323 (OFL, bundled in `fonts/` with its licence),
  scan lines, lamps under each console (green nominal, amber worth a look, red needs you). The consoles go two by two
  under 1000 px.
- **The wall.** Left, clocks: the date as Y/D and a 24-hour clock of the day, the next event and when, the next planned
  burn. Right, the pads: booked or free, the booking's launch (and whether it waits for its window), the launch site.
  The middle screen has two pages:
  - **Ground track · Tellus**: Tellus as a map (east to the right, the launch site in the middle) from the world's own
    elevation grid (`WORLD.E`, 360×180, coasts lit). Each station's circle is where a satellite at 300 km is in view,
    found along 36 bearings with `gsSees`, so a mountain's mask shows in the outline. Every craft of ours in Tellus orbit
    gets half an orbit behind it (dashed) and one and a half ahead (solid), drawn red when its next burn falls out of
    contact (`netLinks`' flag), and NO CONTACT by its name when it has none now.
  - **Pads · next 180 days**: N1's calendar (`netCalHTML`, the old screen's drawing kept in `app/network.js`).
- **The consoles** draw from `netModel()` and the registry and change nothing themselves: their buttons are the
  Program's (`data-fly`, `data-mc`, `data-devtake`, `data-devlose`, `data-adv`), so they act as they did there, and the
  room redraws after any click in it.
  - **Flight**: the fleet, soonest event first; *Fly* where it can be flown, *Take it / Let go* on a dispatch that
    needs you; a cruise entry says what it does next (`cruiseNext`).
  - **Network**: the stations, each craft's link home over the next day (in contact now, share, longest gap, relays,
    the out-of-contact burn flag), each body's coverage.
  - **Trajectory**: planned burns (Δv, when, how many more), who flies each, *Hand to mission control / Take it back* or
    why not (`handOffWhy`: the era, contact).
  - **Dispatch**: deviated dispatches first, the queue (pad, launch, waiting for a window), the last four results.
- **netModel (economy's, additive):** fleet rows carry `id` (a registry entry) or `dev` (a dispatch), so a console row
  can act on its craft. **Q203:** a craft without station-keeping that decays now says "re-enters in about N days" (as
  Fleet does), and one that keeps its orbit says "holds its orbit N more, then re-enters"; never "0 more days".
- **Checks:** test `flow-13` (the room, its parts and buttons, the font, ids, Q203 on a real Probe at 200 km with its
  tanks emptied); `flow-10` lists `mission` among the rooms; core §32's go-only check reads `atMC`. Robot row 164 now
  opens mission control with C. Seen in headless Chrome with two satellites, two stations, a planned burn and a
  dispatch: wall, ground track, calendar, consoles, Wait, W, Help.
- **Not yet** (each is a queue item that now has its home here): watch mode (Q43, a *Watch* key on Flight), moving a
  burn to the next pass (Q196, Trajectory), N2's node schematic (Q170, a third page on the wall), cruise entries'
  payments along the way (Q167), a recovery line (ships at sea). Mission control during a flight, for the other craft,
  is still to come; today it opens from the Program. The calendar's labels overlap when a booking and its window are
  both short.

## v1.138 — a planned burn moved to the next contact (2026-10-12, flow session, QUEUE Q196)
Since v1.102, before onboard computers a planned burn that no station sees is refused at hand-off, so it could only be
flown by hand. Mission control's **Trajectory** console now offers **Fly at the next contact** in its place, with where
and when: "No station sees it at the burn. Next contact: 7 orbits later (+6 h), over Dunnzar Cape."
- **Why whole orbits:** on its rails a craft is back at the same place in its orbit every period, and a burn's Δv is in
  the orbit's own frame, so the same burn k orbits later does the same thing (a raise is the same raise; Tellus has
  turned under it, which is the point). `nodeNextPass(q)` (`sim/space.js`, next to `handOffWhy`) tries k = 1, 2, … up to
  30 days ahead and takes the first time `entryLink` is good; it never moves a burn earlier. In orbit only: a cruise
  entry's burns are checked when they come (v1.102), so it has nothing to offer there.
- `nodeToPass(id)` moves **all** the entry's burns by the same time, so a chain (raise, then circularize half an orbit
  on) keeps its spacing, and hands the first to mission control; news says how far it moved and over which station.
  Refused with the reason (the era, or no contact in 30 days) as `nodeHandOff` is.
- **For space:** two functions added beside `handOffWhy`, nothing of yours changed. A burn timed for a moon's phase
  (a Selene transfer from low orbit) drifts by the moon's motion over the orbits it waits: ~0.8° per 90-minute orbit,
  well inside a mainframe's 2 % execution error for a few orbits, but a long wait wants a correction.
- **Measured** (test): a Probe at 300 km with a 20 m/s prograde burn out of view moves 7 orbits (6.0 h) to Dunnzar
  Cape, and mission control's burn there raises *a* by 19.6 km (planned 19.8). Worst case for the console: 480 link
  checks (30 days of 90-minute orbits) take ~3 ms, only for burns that were refused for contact.

Test `flow-14` (refused, found a whole number of orbits later with a station in view, later burns keep their spacing,
handed over, same raise; the button and its handler). TESTING row 220.

## v1.140 — watch mode for a dispatched flight (2026-10-12, flow session, QUEUE Q43; economy § "Dispatch — the economy's answers" 5)
The dispatch brief's second mode, next to auto-resolve: **watch** the same flight on screen, and jump in if you want.
- **In mission control** (Flight and Dispatch consoles), a queued contract dispatch has **Watch**. Watching stops the
  clock at its launch (`upcoming` gives the event `stop`), and there the row turns red: **Watch now** or **Let it fly**.
  It waits half a day (`WATCH_WAIT`, in `dispatchTick`, after its scrub, money and site checks, so a weather scrub still
  slips it a day and it waits again); past that, nobody watched and it flies itself as before.
- **Watch now** (`watchStart`, `app/mission.js`) puts the dispatch's design on its procedure's pad (as `resetShip`, with
  the dispatch's stack) and starts its procedure, as the ▶ Procedure button does, then goes to the flight.
  - **The same outcome as auto-resolve, left alone.** `watchPlan(D, c)` (`sim/procedures.js`, beside `dispatchRun`)
    draws from the dispatch's seed in `dispatchRun`'s order: a break-up or a dead engine (rolled, not flown) ends the
    flight in the climb with the headless reason, at a time from a draw of its own; a failed relight stops it at the
    circularisation (`procStep` now checks `X.noRelight`, as `procFly` checks its `opt.noRelight`). The physics is the
    same executor.
  - **Its liftoff charges what a dispatch charges** (the design, operations, the site's fee: the same sums) but adds no
    stacking, pad or study wait (`R.watch` in `missionTick`'s launch line): it was stacked in the queue.
  - **Any control key takes over** (the procedure goes off, as for any procedure): the dispatch is broken, the rest of
    the flight is yours, with no revert (`rec.noRevert`). A deviation hands it to you the same way.
- **What happens to the dispatch** (`watchTick`, every frame from `loop.js`): flown (the procedure finished; the contract
  settles as any flight's, when you leave it), lost (with the reason), or *handed to you*. A watched flight that's no
  longer on screen goes back on the pad if it never lifted off (you left the pad, or reloaded), else it was yours.
- **Not yet:** watching a supply run (days of flight: `watchPlan` refuses it); a watched flight shown on the Program's
  timeline beyond the stop's text; a "watch every dispatch" setting.

Test `flow-15` (the stop and the wait; on screen 156.8×159.1 km against the headless 157.3×159.8: the test flies every
step on physics where the page coasts on rails like `procFly`; a failed relight stops at the circularisation; on 200
seeds with poor part data, all 36 rolled break-ups and dead engines give the headless reason; the buttons, the frame
hook and the liftoff's skipped waits). TESTING row 222.

## v1.143 — missions in flight pay along the way (2026-10-12, flow session, QUEUE Q167; Q49 slice 4 with economy)
Since v1.44 a mission to another body pays 20 % when the flight is on course and 20 % on arrival, but only during the
flight. Since v1.90 a vessel still coasting at flight end carries on between flights. Until now, one that reached Selene
between flights paid nothing on arrival. Now it does:
- **Arriving pays.** When a vessel in flight enters a moon's sphere between flights (`cruiseStep`), `stagedCruise(q, B)`
  (in `sim/program.js` beside `stagedTick`) pays both shares still owed: news "Arrived at Selene: … pays its second
  share". The completion share is unchanged: a mission still completes in a flight.
- **Only for what it was launched for (W11).** `satRegister` keeps the flight's open missions on every registry entry
  (`q.open0`, `q.crewed`), and `stagedMission` reads them as it reads `R.open0`. Entries registered before v1.143 have
  none and count for any open mission.
- **Shown before it happens.** `cruisePayNote(q, B)` gives "The far side pays 96M on arrival". Mission control's Flight
  row shows it in green under the vessel's next event (`cruiseNext` now returns the moon it's heading into as `to`),
  and the timeline's arrival event carries it ("Lookout 1 enters Selene's sphere of influence: The far side pays 96M on
  arrival"; `cruiseEvents`' arrival has `to`).
- **Checks:** test `flow-16`: a Probe left on a Selene transfer is listed with the note, pays 96 M (0.4 × 240 M) on
  entering Selene's sphere at the stop, and a vessel whose flight wasn't launched for the mission pays nothing. Full
  suite passes. Seen in headless Chrome: the green line on the Flight row and the timeline; Wait to the arrival paid 96 M
  and the line went away.
- **Not yet:** public interest and cruise science per day during a cruise (economy's design, "Paying along the way");
  a flyby completing in the background (passive flybys); the Flight row's "where" still says "Selene orbit" for a vessel
  only passing through (`netModel`'s wording, economy).

## v1.151 — the network's nodes on mission control's wall (2026-10-12, flow session, QUEUE Q170, network N2)
N2 of the network plan (§ "Network screen plan"), built where Q241 R4 put the network: mission control's wall.
- **A third page on the wall**, *Network · nodes* (W cycles ground track → pads → nodes; `MC_PAGES` in `app/mission.js`,
  `#mcNet` in `index.html`). It draws `netModel().nodes` with `netNodesHTML(N)` (`app/network.js`): a schematic, not the
  orbital map. Bodies as columns (Tellus first, then the others in the model's order), and rows by netModel's slot,
  stationary at the top, then high orbit, low orbit and the surface. Each node is a box: its name, its kind in words
  (site, ground station, the craft's kind, station, base); a crewed node adds supplies, what it eats a day and days
  left (red under 30); a paused one says so (out of supplies or adrift); a craft out of contact says "no contact now"
  (from `N.links`).
- **The bottleneck line on top** (`N.bottleneck`, economy's rule: the crewed node with the fewest days under 30), and
  its node framed in red. With none: "No bottleneck: no crewed node is short of supplies".
- **`netFallback` is gone**; `netData()` is `netModel()`. Economy's `econ-14` check now asserts that instead of the old
  `typeof netModel` switch (one line in `tests/economy.mjs`).
- **Checks:** test `flow-17`: the page is wired; a Probe at 300 km sits in Tellus's low-orbit row and every site and
  station in the surface row; with a crewed Selene base at 10 days added, the columns run Tellus then Selene, the
  bottleneck line names it, its box is framed, its supplies read "400 kg · eats 40 kg/d". TESTING row 233; robot row
  `playtest.mjs 233` (seen on the RTX at 1280×800: both pages fit, the base framed in red).
- **Not yet:** routes (N3, with routines), clicking a node for its panel (N3), the plan's coverage bar on relays
  (Q218 draws coverage on the map), rivals and the era's look (N4).

## v1.163 — the title screen and the founding charter (2026-10-13, flow session, QUEUE Q241 R3)
R3 of the real-screens plan (§ "Plan: real screens"; mock-up `mockups/screens/?s=title`).
- **The page opens on the title screen**, a room (`title` in `ROOMS`, `go('title')`, `#ttl`, `app/title.js`): a dimmed
  night pad (CSS: stars, a tower's silhouette), the menu at the left, the program's charter on it.
- **A new career fills in the charter**: Article 1 *Whose program?* (the archetypes and Random world, `data-arch`),
  Article 2 *How does it start?* (`START`, `data-cstart`; the first is ticked), the signature and the seal with the name
  it will have (`charterName`, progName's rule), and **Found the program ▶** (`#bFound`, `data-start`: `chooseStart`, then
  the desk). This replaces the first-run gate in the Program's folder (Q41, Q269): `ownershipHTML` returns nothing
  before the charter, and its `data-arch`/`data-start` handlers moved to `app/title.js`.
- **No desk before the charter:** `needCharter()` (not chosen, no flights); `go('program')` lands on the title while it
  holds, and `progGate` is now `needCharter()`.
- **A career under way** shows its charter signed: its choices ticked, the rest faded, an *In force* stamp, nothing to
  click. **Continue** (Enter) goes to the desk; **New program** asks twice, then resets (`resetProgram()`, factored out
  of the Program's *reset program*, which now lands on the title). Settings, Tester (tester mode) beside them; the Esc
  menu has *Title screen*.
- **Cross-lane:** `tests/core.mjs`'s merge guard reads the Program's click chain from `ds.dk` (its `ds.start` head moved);
  `flow-10` counts the title among the rooms. **Robot:** `PT.start(k)` signs the charter (ticks k, then Found); rows m1,
  desk and 156 click `[data-cstart="agency"]` then `#bFound`; row 75 uses `PT.start`.
- **Checks:** test `flow-18` (the wiring; an open charter lists every archetype and start with Found on the ticked one;
  ticking company names it Aerospace; after `chooseStart` the charter is signed, with no buttons). Robot row `charter`
  (sees the charter, ticks a power and the consortium, signs, the desk opens; back on the title it's signed and Enter
  continues) and `m1` pass. TESTING row 245.
- **Every load now stops on the title**, one Enter from the desk (the plan's "Continue skips it": the charter, not the
  screen). If that's a click too many, skipping the title for a save is one line in program-ui's start-up.
- **Not yet:** the director's own name on the signature (a typed name, saved); the program's real seal (`powerMark`)
  instead of the red wax; the era's look on the title.

## v1.167 — the map's layers (2026-10-13, flow session, QUEUE Q261; PLAYTEST #61)
Caio, 2026-10-10: the map gets too busy; toggles for what it shows.
- **Layers** beside *Map [M]* (map view only, `#bLay`) opens a panel (`#mapLay`, `app/map-layers.js`): cities, ground
  stations, contract targets, our satellites and landers, debris and spent stages, links home, the moons' orbits and
  spheres of influence, the planets and Helios, names. Then *Defaults*.
- **Every `drawMap` pass asks `mapShow(k)`** (`app/render.js`); *names* blanks the text of cities, satellites, bases,
  bodies and planets but keeps their marks. Always drawn, whatever the layers: your ship, its orbit, the plan, nodes,
  impacts, the closest approach, and **the target** (a satellite or lander you target shows even with its layer off).
- **Defaults by era, remembered per browser:** a layer you set is kept (`localStorage['launchpad-map-layers']`, only
  what you changed); one you never touched reads *auto* and follows `mapLayDefault`: before the first orbit (the
  beeper) cities on, planets and debris off; after it, cities off, satellites, debris and planets on. *Defaults* forgets
  your settings. **Defaults are mine, for Caio to override.**
- **Checks:** test `flow-19` (every pass gated; the era's defaults; a set layer wins). Robot row `layers` (the panel
  over the map; all on, then only our satellites and links; it hides when you leave the map) and `m1` pass. TESTING row 249.
- **Not yet:** ground tracks on the map (the plan named them; today they're mission control's wall, not the map);
  Q192's merged planet labels; a key for the panel.

## v1.169 — what the map is centred on (2026-10-13, flow session, QUEUE Q262; PLAYTEST #62)
Caio, 2026-10-10: centre the map on something else, like KSP. It existed only as Tab, unlabelled, over the bodies.
- **A Focus list** beside *Layers* (map view only, `#mapFocus`): the ship, each known body, our satellites and landers
  (registry, not debris or docked), and this flight's other vessels (`FLEET`), each in words. Picking one centres the
  map on it at a distance that frames its orbit.
- **Double-click** a body (its disc, at least 14 px) or a craft (within 12 px) on the map centres on it, with a message
  naming it and how to come back. **Tab** cycles the same list. **Home** returns to the ship.
- **Not Backspace**, which the item named (KSP's key): in flight Backspace is *abort*, and a slip would end the flight.
- **How:** `cam.focus` stays the ship (0) or a body (index + 1); `mapFoc` names a craft (`{sat: id}` or `{ves}`);
  `mapFocusPos()` (`app/map-layers.js`) is the map camera's centre in `render.js`. A craft that's gone (re-entered,
  docked, junk, lost) hands the focus back to the ship. Entering the map resets to the ship, as before.
- **Checks:** test `flow-20` (the list; centred on a satellite; Tab; gone → ship); robot row `focus` (the list to the
  satellite, a double-click on Selene, Home back). TESTING row 251.
- **Not yet:** focus on a rival's satellite (economy's Q187 makes them targets); remembering the focus when the map is
  left and reopened.

## v1.175 — hover terms: the glossary (2026-10-13, flow session, QUEUE Q287; UI.md rule 9, D16)
- **One glossary, one tooltip** (`app/terms.js`): `TERMS` holds each term's name and a two- or three-sentence
  explanation; `term(k, text)` marks a word (dotted underline, help cursor); one `#termTip` shared by every screen shows
  it under the word (above when there's no room). One level deep: an explanation has no terms inside. It follows the
  pointer, so the HUD's per-frame redraw doesn't drop it.
- **The terms:** Δv, TWR, max-q, apoapsis, periapsis, know-how, stability margin. Know-how's text follows economy's
  v1.30 design (ignition failures, stacking time, science yield; flights, the stand and development raise it).
- **Marked:** the HUD's *Ap · Pe* and *Δv* rows and its TWR, the node panel's Δv, the Instruments card's max-q; the
  builder's stage rows (Δv, TWR), *Total Δv*, *Stability*, *Max-q* and the control block's max-q; the rollout's TWR
  checks; the Program's and the Debrief's *Know-how* headings.
- **A sub-line went:** the builder's "Stability (CoM ahead of CoP, calibers)" is now *Stability* (a term) "in calibers".
- **For everyone:** new jargon on any screen: add it to `TERMS` and write `term('k')`. Q340's part cards and
  self-explaining warnings are this same tooltip grown (flow, with vehicle).
- **Checks:** test `flow-21` (every term used on screen, none nested, the sites marked, the sub-line gone); robot row
  `terms` (the tooltip over the builder's Δv and the live HUD's Ap; gone when the pointer leaves); `m1` passes.
  TESTING row 257.
- **Not yet:** more terms as screens need them (SOI, prograde, inclination, specific impulse); touch (a tap shows it).

## v1.179 — warnings that explain themselves; part cards (2026-10-13, flow session, QUEUE Q340; PROBES § 8, D21, D22)
- **Warnings explain themselves:** every amber or red mark in the Assembly's readout is now hoverable (dotted, like a
  term). The one tooltip (`#termTip`) says what's wrong (in the mark's colour), why it matters, and the fixes, in the
  shape of D22's Checks rows (a verdict, then *Fix:*). Marks that are fine stay plain.
- **The marks:** each stage's TWR (stage 1 can't lift / climbs slowly; an upper stage under 1), the cost when over budget,
  power (panels can't keep up; the battery can't last the night), lifetime under a year, no reaction wheels / no control,
  stability (full, stage-1 dry, M1.6), the liftoff and max-q joints (fixes from `jointFix`), trim (PROBES' example),
  touchdown, the Control block's burning and coasting rows, and each later stage lit in the air (`airWhy`/`airFix`).
- **New check, fit:** a part standing on a fairing's ring, under its nose, but not inside the shell gives *Fairing: N parts
  outside the shell* (red), naming them; fixes: fold it for launch (if deployed), a longer fairing, a narrower part.
- **New term:** *Trim* (the share of steering spent holding an off-centre thrust).
- **Part cards:** the parts list's card and the hover over a part on the craft end with *Pairs with* (`PART_PAIRS` in
  `builder.js`, by key, base or kind: "a camera: an antenna to send the pictures, and power..."); the card shows a part's
  computing era when it has one.
- **How:** `whyMark(cls, html, {t, d, fix}, tag)` in `app/terms.js` (plain text only, escaped; `fix` a sentence or a list,
  joined "a; b; or c."). **For everyone:** a new amber or red mark in the builder goes through `whyMark`, a new part gets a
  `PART_PAIRS` line (flow-22 fails otherwise).
- **Checks:** test `flow-22` (the helper and its escaping; no unexplained mark left in the readout; the fairing fit; every
  part has a pairs line, shown on the card and the craft); robot row `explain` (over budget hovered: the tooltip; the
  camera's card ends with *Pairs with*); `m1` passes. TESTING row 261.
- **Not yet:** the palette card and the craft hover are still their own elements (`#partcard`, `#bldtip`), not `#termTip`;
  a missing-sensor warning (PROBES S2) and a boom's load (S1's folding boom) when those parts land; the Rollout's
  warnings and the builder's joint chips in the part panel.

## v1.182 — losses explained (2026-10-13, flow session, QUEUE Q293; REVIEW-2026-10-11 § 3 gap 1)
- **The failures on the way:** a flight keeps what went wrong, in order, with the flight time and the height
  (`debFail(s, k, why)`, `sim/debrief.js`; `s.rec.fails`): a joint that broke (`sim/vessel.js`, structural failure), a part
  that burned up (thermal), an engine that failed to light (`igniteOK`, with its know-how). The end itself was already
  kept since Q264 (`s.lossWhy`).
- **The Debrief, for a loss:** a *What happened* section first: each failure (T+, km), the end in red, then *What would
  help* (one line by what went wrong first: `debHelp`; a joint, heat, ignition, a topple, a sinking, a crash, a
  collision). A flight that got home lists its failures as incidents instead.
- **Money named:** the "N days passing (budget, upkeep, debt)" lump is gone. A ledger (`PROG.led`, `ledAdd(k, v)`) keeps
  running totals by kind, and the Debrief shows the difference since liftoff: budget day, government top-up, running the
  program, ground station leases, satellite income, contracts completed between flights, pay for other flights
  (dispatches), debt repaid from income, dispatched flights launched, recovery fleet salvage, the leadership's reward.
  `income(x, k)` takes the line (default `paid`: the flight's own pay is taken back out of it). What no line names yet
  shows as *Other* (an old save's first flight, for one); the lines still add up to the net.
- **For economy and space:** a new way money moves between flights wants a `ledAdd` line (and a label in `LED_L`), or it
  shows as *Other*. Running costs are 0 today (`OVERHEAD`), so that line doesn't show.
- **Checks:** test `flow-23` (a loss with a broken joint: its chain, end and help; a landed flight with a failed ignition:
  an incident; 120 days with a budget day and a debt: named lines that add up, no lump, no *Other*; it puts the program
  back after, since a started program turns know-how on for later sections); robot row `loss` (the Debrief of a Sounding
  rocket lost after a joint broke); `m1`, flow-1, the economy sections pass. TESTING row 264.
- **Not yet:** a cause for a crew lost while the vehicle survives (the crew line has its own); the chain on the Program's
  flight history; the Rollout warning that would have caught it, linked from *What would help*.

## v1.186 — the dark cockpit (2026-10-13, flow session, QUEUE Q286 slice 1; UI.md § 3 Flight row, D16)
- **The phase** (`cpPhase()`, new `app/cockpit.js`): *ascent* (in the air, climbing or burning), *burn* (an engine lit
  out of the air), *landing* (coming down through the air or low over an airless body), or quiet. It uses the Ascent
  card's own condition (`ascentOn`), so the gauges, the cards and the cockpit agree.
- **News held:** in a phase the ticker is hidden (`#news.held`); headlines still arrive and come back, the latest three,
  once things are quiet. The Program's Inbox keeps every one as before.
- **Only the phase's cards:** in a phase only Ascent, Descent and Target show; Payload, Fleet, Vehicle, Hardware and
  Rover fold away unless pinned (`CP_CARDS`, `renderCards`).
- **MASTER CAUTION:** one red box under the readout, its width, naming whatever is red: a part over 90 % of its heat
  limit, a joint over its certified rating, the impact point over a town (`cautions()`). Nothing red, no box.
- **Hold modes:** a mode the avionics can't fly isn't shown any more (it was greyed out); the SAS button's title says
  which come next and with which era.
- **Ap · Pe:** not shown landed (it was "—"); a periapsis under the ground reads *under the surface*, not "−1270 km".
- **Checks:** test `flow-24` (the phases, the cautions, the wiring, the hidden modes, Ap · Pe); robot row `cockpit` (a
  Sounding climb: no ticker, only the Ascent card; a forced 95 % heat and the range warning in the caution; landed, the
  news back and no caution); `m1` passes (its overlap check caught the caution crossing the centre message: it's now the
  readout's width). TESTING row 268.
- **Not in this slice:** a phase card that changes by phase (landing: height and descent rate big; burn: Δv to go); the
  help bar was already behind the menu. **Slice 2:** the Program (NEXT card, offers one line each, the letterhead, locked
  missions as a count) and the map (labels by importance, days instead of TU). The Assembly's GO/NO-GO board is D22's
  Checks tab, built with Q237 (vehicle).

## v1.189 — the Program and the map decluttered (2026-10-13, flow session, QUEUE Q286 slice 2; UI.md § 3 Program and Map rows)
- **Offers, one line each:** name, pay, days left, Take and Pass, and ⚠ when taking it risks sanctions. A click on the
  line opens the rest (client, *Why*, the brief, the risk); a `<details>` row in `contractsHTML` (`app/program-ui.js`).
  Taken contracts keep their full rows (their Withdraw and dispatch lines are things you act on).
- **Missions:** an epoch past the next one, with nothing open or done in it, is one line: "🔒 8 missions, once first
  orbit is under way" (`renderProgram`, `app/editor.js`). The current and next epochs list everything as before.
- **The wall:** no empty photo frame ("no flights yet") until the first flight's photo exists (`deskWall`); the Debrief
  still pins its own.
- **The letterhead:** the program's name 22 px instead of 30: a letterhead, so the NEXT card and the funds lead.
- **The map:** a planet's label gives the trip, half a transfer orbit from Tellus's, in days ("Enyo · ~280 days there"),
  not its distance in TU, a unit nobody knows (`xferDays`, `app/render.js`). The label declutter by importance was
  already there (PLAYTEST #31).
- **Checks:** test `flow-25`; robot row `declutter` (four one-line offers, one opened; the far epochs counted; no empty
  frame); `m1` passes (its orbit map shows the planets in days; its SAS shows only the modes the probe can fly, slice 1).
  Every flow and economy section passes. The full smoke run was stopped by Claude Code for low memory and not re-run.
  TESTING row 271.
- **Q286 is done** except the Assembly's GO/NO-GO board, which is D22's Checks tab: Q237 (vehicle, with flow). Not done
  from UI.md's rows: a phase card that changes by phase (landing: height and descent rate; burn: Δv to go).

## v1.192 — one tooltip (2026-10-13, flow session, QUEUE Q391; UI.md rule 9, after Q340)
- **One element:** the builder's part card (beside the parts list) and the hover over a part on the craft (at the
  pointer) now show in `#termTip`, like the terms and the self-explaining warnings; `#partcard` and `#bldtip` are gone.
- **How:** `tipShow(own, html, at)` / `tipHide(own)` in `app/terms.js`. `own` names the use ('term', 'card', 'craft'), so
  moving off one never closes another's; `at` is `{r: rect}` (under it, above when there's no room), `{r, side: true}`
  (beside it) or `{x, y}` (at the pointer); it always stays inside the window. A part card gets the `card` class (270 px,
  the spec table). **For everyone:** a new tooltip goes through `tipShow`, not a new floating element.
- **The Rollout explains itself:** each warning and stop can carry `W` (`warn(t, W)`, `bad(t, W)`; rendered with
  `whyMark`): over budget, the account below zero, a part not open yet, a site that won't take it, stages over towns, the
  weather, the liftoff TWR, instability, a joint past its rating,
  decisions waiting. `launchWarnings` (vehicle) keeps its own wording, which already says the fix.
- **The joint chip** in the part panel (right-click a part) explains itself past 70 %: what, why, `jointFix`.
- **A catch on the way:** flow-8 cuts `app/rollout.js` up to `
function rollChecks`; a comment line above it broke the
  cut, so the comment sits on the function's line. The Rollout's icon rule (`.rc span`) now targets the icon only.
- **Checks:** test `flow-26` (placement beside, at the pointer and under, clamped; the owners; no old elements; ten
  explained Rollout checks); robot row `explain` (the stage-2 TWR mark, the camera's card in `#termTip`, the Rollout's
  over-budget check hovered); `m1` passes; every flow section and the builder's core sections pass. TESTING row 273.

## v1.199 — how folded parts deploy (2026-10-13, flow session, QUEUE Q400's remainder; PLAYTEST #97)
- **Already done by vehicle:** the flight-bar buttons (Unfold wings / antennas (P) v1.184, Legs (Y) and Bay (B) v1.188).
- **The part panel** (right-click a part) gives a deployable part an *In flight:* line under its deployed toggle: the
  key, the flight-bar button, and when (wings and booms once the air is thin and the fairing is off, they tear off in
  thick air; legs before touchdown; the bay once the air is thin). **The part card** gets a *deploys* row (the key and
  the button). One table, `DEP_HOW` in `builder.js`, next to `DEPW`.
- **A first-time hint:** the first time a craft is out of the thick air, nothing critical is happening (`cpPhase()`),
  and it carries folded parts no fairing still covers (or a shut bay), one message says how to deploy them and lights
  the button for six seconds (`button.hint`). Once per browser (`launchpad-hint-deploy`, a convenience); `depHint()` in
  `app/cockpit.js`.
- **Checks:** test `flow-27` (the hint: in space yes; in the air, in a burn, already out, seen before, or still inside a
  fairing: no; after the fairing drops: yes; a shut bay; the panel's line and the card's row); robot row `deploy` (the
  Satellite's wing selected: the *In flight:* line; parked in orbit, fairing dropped: the message and the lit button);
  `m1` passes. TESTING row 280.

## v1.202 — the camera looks straight down (2026-10-13, flow session, QUEUE Q405; PLAYTEST #101)
- **The pitch reaches ±90°** in flight and in the Assembly (it stopped at ±1.45 rad, `app/screens.js`'s drag).
- **No flip at the pole:** the view's right-hand vector comes from the yaw (`cross(up, the camera's horizontal
  direction)`, then square to the view) instead of `Fw × up`, which vanishes looking straight down. At every other angle
  it is the same vector as before (flow-28 checks three), so nothing else moves; the camera shake uses the same rule.
  Turning the yaw while looking down turns the picture about the axis, as it should.
- **T in the Assembly:** a top view, straight down the axis, where the CoM and CoP markers show any offset; T again goes
  back. It holds the design still while it's on (a turning top view spins) and survives a reframe. It's on the key strip.
- **Not done:** a Top button next to the CoM readout (the key strip names it; D22's toolbar can carry it, Q237).
- **Checks:** test `flow-28` (the same basis at other angles; orthonormal and continuous at the pole; the clamp; the T
  key); robot row `topview` (the Satellite from above in the Assembly; the Satellite climbing, seen from straight above);
  `m1` passes. TESTING row 283.

## v1.208 — heat and load you notice (2026-10-13, flow session, QUEUE Q271; PLAYTEST #71, W36's default)
- **Two bars beside the navball**, H (heat: the hottest part against its limit) and L (load: the most loaded joint
  against its certified rating), in every phase of a flight, not only the Ascent card's climb: re-entry, a burn, a
  landing. Faint under 50 %, amber from 50 %, red (glowing) from 90 %; ticks at 50 % and 90 %; hovering one names the part
  and the number. `hlGauges()` in `app/cockpit.js`, `#hlg` in the bottom cluster (between the navball and SAS).
- **The master caution** (v1.186) now blinks for three seconds when its reasons change (`#mcau.new`), then stays lit.
- **Look & sound's half** (the hot part glowing on the rocket itself) isn't in this item.
- **Checks:** test `flow-29` (the fractions, the colour thresholds, the wiring, the blink); robot row `gauges` (a climb:
  faint; the nose forced to 70 %: amber; to 95 %: red, and the caution blinking with the reason); `m1` passes (its
  overlap check passes with the bars in the cluster). TESTING row 289.

## v1.216 — the model's scale in the Assembly strip (2026-10-13, flow session, QUEUE Q277; from Q242)
- **The Assembly's program line** (`#hqStrip`, under the letterhead) now names the model's scale and the real height:
  "model 1:48 · 14.5 m" for the Orbiter, "model 1:96" for Crewed Lunar, 1:288 for a 120 m rocket. It is the same kit
  scale the drafting board's title block prints (`deskScaleFor`, v1.115/v1.132), so the two always agree.
- **Hover "model 1:N"** for the term `scale` (app/terms.js): what a scale model means, why a bigger design sits at a
  smaller scale, and that the table, lamp and figure are drawn at the same scale.
- `modelScaleHTML()` in `app/model-desk.js`; empty without the desk (`DESK_FX` off) or a design. The strip is rebuilt on
  every design change (`editorChanged` → `renderProgram` → `progLayout`).
- **Not done:** the Assembly panels as paperwork on the desk stay with R5 (Q241) and vehicle's Q237/Q238.
- **Checks:** test `flow-30` (the text at 14.5 m and 120 m, empty without the desk, the wiring); robot row `scale`
  (the Orbiter, then Crewed Lunar, hovering the term). TESTING row 297.

## v1.224 — more hover terms, and a tap on touch (2026-10-13, flow session, QUEUE Q384; from Q287 v1.175)
- **Seven new terms** in `TERMS` (app/terms.js): `soi` (sphere of influence), `pro`, `retro`, `nrm` (normal and
  anti-normal), `rad` (radial out and in), `inc` (inclination), `spin` (the ground's free speed east).
- **Where they're marked:** the SAS mode buttons (Prograde, Retro, Normal, Anti-nrm, Rad out, Rad in: `SASM_TERM` in
  app/editor.js sets `data-term`); the readout's "escaping" and "escape" (SOI); the site picker's "free … m/s east" and
  "lowest inclination".
- **Isp is a gloss, not a term:** the part card is itself the tooltip, and a term inside a tooltip can't be hovered
  (one level deep), so the engine card's Isp line says "(higher: more Δv from a tank)". flow-21's rule that every term
  is used on screen now also counts the SAS map.
- **Touch:** a tap on a term shows it; a tap on it again, or anywhere else, closes it (`pointerdown` with a non-mouse
  pointer; the mouseover a tap fires just after is ignored for 0.9 s). A button that is a term (the SAS modes) keeps its
  tap for its job and shows the term on hover only. `termTipHTML(el)` is the one place a tooltip's text is made.
- **Checks:** test `flow-31` (the terms, where they're marked, the tap handler, the gloss); `flow-21` still passes;
  robot row `terms` (the site picker's inclination on hover, Prograde on the SAS hover in a climb, a touch tap on Ap
  opening then closing). TESTING row 304.

## v1.230 — a routine with nothing up keeps its controls (2026-10-17, flow session, QUEUE Q415; PLAYTEST #105)
- **The gap:** a route's controls (*n of N up*, *keep N*, *Order a run*, *Repeat by itself*, *End*) were only the Fleet
  line under one of its satellites (`routeLine(q)`). Once its satellites had all come down (a failed first run, a
  re-entry) the route still lived in `PROG.routes` but nothing on screen could order a run or end it: the robot's `m2`
  stopped there (Q233).
- **Now:** `routeCtl(r)` (sim/program.js, split out of `routeLine`, same output) draws a route's state and controls, and
  the Fleet tab ends with **Routines with nothing up**: a line per route no listed satellite carries
  (`routesBareHTML(L)`, app/program-ui.js; `data-route-line`). `progTabOf` sorts the heading into Fleet (it fell into
  More first, which the robot probe caught).
- **Checks:** test `flow-32` (the bare lines with their buttons, none for a route with a satellite up, the wiring);
  `econ-25` still passes; a probe on the GPU (a route, nothing up: the line in the Fleet tab, *Order a run* answering).
  TESTING row 310.

## v1.233 — range safety and the site's own town (2026-10-18, flow session, QUEUE Q444; PLAYTEST #116)
- **The cause:** range safety warns when the predicted impact point is in a city or within 15 km of one (`dropVerdict`'s
  *near*). Dunnzar Cape's support town Kaos Beach (Q270, v1.144) is 15 km from the pad, so the pad itself read as near it,
  and a climb's first impact points (the pad, then just downrange) set off RANGE SAFETY and the master caution on every
  Cape launch. No other pad: their towns are 25–35 km off.
- **Now:** `rangeVerdict(site, b, pf)` (sim/world.js, beside `dropVerdict`) is the range check's verdict: from its own
  site, a support town counts only when the impact is over it (*city*); any other town keeps its 15 km margin. The town
  stays where it is (the road out to it is v1.227's). Drops of spent stages still use `dropVerdict` unchanged.
- **Checks:** test `flow-33` (no pad near its own town; over Kaos Beach still a city; near another site's town still
  near; the wiring); a scan of every pad's first 30 km downrange: clear; on the GPU, a Sounding from the Cape to 3.4 km:
  no warning in 20 s, where the old reading said "near Kaos Beach" from T+1 s. TESTING row 313.

## v1.234 — teach the gravity turn (2026-10-30, flow session, QUEUE Q434; PLAYTEST #109)
- **The gap:** "the rocket mostly goes straight up, is this correct?" Nothing taught the turn, and SAS Prograde from the pad
  holds it vertical forever (prograde *is* up). The robot, the tests and `ascentRun` all fly one profile (vertical to 286 m,
  flat by 54 km on Tellus: `200·AS` and `38000·AS`, AS = air/70 km), each with its own copy of the formula.
- **Now:** `ascentPitch(b, h)` (sim/flight.js) is that profile, and `ascentRun` uses it (same numbers). `turnGuide(s)` is where
  the nose should be now: that pitch, toward where the craft already goes over the ground (from 20 m/s across), else where the
  nose leans, else east; only while climbing, until the apoapsis is out of the air (past 54 km it stays level: the probe
  flew the ◇ by hand to 54 km with the apoapsis still at 81 km, and the ◇ used to vanish there). The navball draws it as an open
  diamond ◇ and the heading line adds its pitch (`PITCH 84° ◇71°`). Not gated by a logbook tool: it teaches.
- **The hint** (app/cockpit.js `turnHint`, like v1.199's deploy hint): on a hand-flown climb by a rocket with 2.5 km/s or more
  in vacuum (no hint for a sounding rocket), once past 30 m/s: "To reach orbit, turn: by about 100 m/s tap W to lean the nose a
  few degrees east, then pick SAS Prograde…" (with the gyro autopilot, a new program's, there is no Prograde: "…keep tapping W
to keep it on the ◇"; the GPU probe caught the first wording asking for a mode the player doesn't have); once more if the nose is still above 85° when the profile is under 75°. Ten
  seconds each. It stops for good (localStorage `launchpad-hint-turn`) after a flight from this browser gets its apoapsis out
  of the air with 1 km/s across the ground. W leans east from the pad's attitude (belly east), as the robot's kick does.
- **Not done:** the pitch programmer part (gyro era, notes/vehicle.md 717) is vehicle's: a Proposed line. Whether the presets'
  tapes fly this profile: the procedures already do (`fly_ladder`), not re-checked here.
- **Checks:** test `flow-34` (the profile equals the old formula at nine heights; flown on it the marker is on the nose and
  goes once the apoapsis is out of the air; flown straight up it sits 21° above the horizon, east, under a 90° nose; the wiring). TESTING row 314.
  On the GPU (headless Chrome, `?tester`, a new program, the Orbiter): the hint at 110 m/s / 1 km, `PITCH 90° ◇83°`; the
  heading line now grows upward (`bottom:`), since the ◇ figure wrapped it onto the ball.

## v1.235 — the navball's surface → orbit blend (2026-10-30, flow session, QUEUE Q435; PLAYTEST #110)
- **The cause:** `speedRef` switched from the ground's speed to the orbit's at half the air (50 km), and the orbit's adds the
  ground's spin, so prograde, and a SAS holding it, jumped: 6.3° at once on flow-35's climb (900 m/s up, 1400 across).
- **Now:** a blend through `navBand(b)` (40–60 % of the air; 2–4 % of an airless body's radius, which used to switch at 3 %):
  `v − (1 − w)·surfVel`, w a smoothstep, so the marker slides (0.05° per 100 m on the same climb) and the SAS follows it.
  `speedRef` returns `w`; `srf` is w < ½. `s.navRef` ('srf' / 'orb', null = auto) holds one frame: the label under the
  heading line (`#navref`) cycles auto → surface → orbit on a click and reads SURFACE, SURFACE ▸ ORBIT, ORBIT, or
  "… (held)". The choice rides on the tape in `controls()` as `ref` (only when held, so old control records are unchanged).
- **Tapes:** `speedRef`, `sasTarget` and v1.236's `velFrame` joined TAPE_V's hash: the SAS now steers differently in the
  band, so tapes recorded before replay as stale (procedures survive, as with every physics change).
- **Checks:** test `flow-35` (the step per 100 m, w monotonic, 0 below 40 km and 1 above 60, the SAS on the blend, both held
  frames, the controls round trip, the wiring). TESTING row 315.

## v1.236 — SAS buttons as symbols (2026-10-30, flow session, QUEUE Q436; PLAYTEST #111)
- **Now:** `SAS_MARK` (app/render.js) holds each mode's mark as SVG path data in a ±14 box: one drawing for the navball
  (`Path2D`, `mkPath`) and the buttons (`sasIcon`, inline SVG). Prograde: circle and three ticks; retrograde: circle and X
  (yellow-green); normal / anti-normal: a triangle up / down with a dot (violet); radial out / in: a ring with spokes out / in
  (cyan); maneuver: the blue cross ring; target / anti-target and relative pro / retro: prograde's and retrograde's shapes
  in orange and pink, as the ball drew them; stability: a gyro ring; docking: ring and square (green).
- **The buttons:** four to a row (`#sas` grid, `button.mk`), SAS and RCS still full width; the word as `aria-label` and on hover
  (the v1.224 hover term where there is one, else `title`); Help (H) in flight has a *SAS marks* row with every mark and its
  name (`sasLegend`). Names lengthened (Retrograde, Anti-normal, Radial out…) now that they don't take the button's room.
- **The ball** draws normal, anti-normal and radial marks too (thinner), from `velFrame(s)` (sim/vessel.js, split out of
  `sasTarget`: the same directions the SAS holds), once the frame turns orbital (w > 0): they come from the orbit, and at
  liftoff radial out sat beside the surface prograde (the GPU probe).
- **Checks:** test `flow-36` (every mode has a distinct mark, paired colours, the SAS holds where the marks are, the wiring);
  `playtest.mjs`'s cockpit probe reads the buttons' `aria-label`. TESTING row 316. Next: Q477 (the HUD as the instrument
  panel) builds on these keys.

## v1.239 — Easy / Normal / Hard (2026-10-30, flow session, QUEUE Q476; DECISIONS D25, PLAYTEST #119 slice 3)
- **Now:** `LEVELS` and `lvl()` / `lvlKey()` (sim/core.js) are the three rows; the career keeps its level in `PROG.lvl`
  (absent = Normal, so every save from before plays as it did). Picked on the charter's **Article 3 · How hard?** (title
  screen, a new program; the signed charter shows it ticked) and changeable in **Settings → Difficulty** off a flight
  (`setLevel`, app/settings.js: a news line once the career has flown, and the Assembly's budget redrawn). A flight flies the
  level it lifted off with: Settings greys the buttons in the flight screen.
- **Easy:** `engineMdot` divides the flow by 1.15 and every thrust line multiplies the exhaust speed by it (`physStep`, `dvPlan`,
  `probe`; `skProp`'s station-keeping gas too), so the push is the same and the Δv ×1.15. `aeroPass` takes the body's panels
  (drag, lift, heating) at ×0.75 of the air; fins and the chute feel the true air, so steering and landings are unchanged.
  `thermal`'s stagnation readout and `ascentRun`'s drag follow. `igniteOK` never fails. `acceptOffer` sets deadlines at
  ×1.5 the contract's duration.
- **Hard:** `pilotMargin` returns 0 (the budget is "flown well" only; v1.237's line reads the same number twice), and
  `revertOK()` (app/state.js) refuses a revert once a flight has lifted off: R, the hidden HUD button and the Esc menu's
  item (gone from the menu). A simulator run still resets, and a flight not yet launched still goes back to the pad.
- **What carries the level:** a tape's `v` is `tapeV()`, TAPE_V plus `:easy` or `:hard` (Normal keeps the bare fingerprint),
  so an autopilot replays only on its level and the stored tape key splits by level; `studyKey` gains `@easy` / `@hard`; a
  logbook entry set on Easy or Hard has `lvl`, shown as "· on Easy" after who set it. Saves carry `PROG.lvl`; `resetProgram`
  keeps it, as it keeps the archetype, so the next charter starts on the last choice.
- **Tapes:** `physStep`, `aeroPass` and `thermal` changed text, so TAPE_V's fingerprint moved: tapes saved before v1.239 replay
  as stale on every level (procedures survive). On Normal the numbers are bit-identical (×1 everywhere).
- **Measured** (`study_pilot.mjs Orbiter -l=easy`, a new `-l=` flag; the Orbiter as on `main` before #121's tank): Normal
  4,894 m/s, the script spends 4,390, 425 spare; **Easy 5,628, the script 4,337, 1,213 spare**. The typical pilot +93 → +111
  and fits easily; the late kick (`srflate`) ran dry 96 m/s short on Normal and reaches orbit on Easy (+573). **Negative:**
  turning flat by 36 km (`shallow`) still burns the pod up on Easy (1,250 K at 39 km, 109×39 km): the extra push makes the
  flat climb faster low in the air, which outruns ×0.75 heating. Easy doesn't forgive the heat cliff; Q483's warning does.
- **Checks:** test `flow-37` (Δv ×1.15 on Easy and = Normal on Hard; a step's propellant ×1/1.15 at the same thrust; the
  body's aero ×0.75 exactly; the margin 150 / 0; 0 ignition failures in 200 rolls on Easy against 9 on Normal; deadlines
  ×1.5; tape, study and record tagged; the wiring). TESTING row 319.

