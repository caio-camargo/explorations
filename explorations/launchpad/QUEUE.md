# Launchpad — work queue
**Version**: 0.1.23 · **Author**: Caio Camargo + Claude (orchestrator session) · **Created**: 2026-10-08 · **Updated**: 2026-10-09 · **Status**: live
**Purpose**: So that every launchpad session always has a next thing to do, without Caio having to decide it each time.
Kept by the **orchestrator session**, which refreshes it about every 30 minutes (pull, read claims and the log, strike
done items, add follow-ups, push). Sources: NOTES "Next"/"Not yet" lines, [`PLAYTEST.md`](PLAYTEST.md), [`TESTING.md`](TESTING.md),
`SESSION_LOG.md` next steps. This file is the short list; [`ROADMAP.md`](ROADMAP.md) is what refills it (milestones,
lanes, evergreen work); the long tail stays in NOTES.

---

## Next unblockers (ROADMAP rule 6; Caio asks "what are the next unblockers?")

| # | Item | Who | What it frees |
|---|---|---|---|
| 1 | **W16: a person who isn't you plays the first hour**: M1's last finish line (robot `m1`, no overlaps, pacing all ✓) | you | **M1 done**; M2 becomes current |
| 2 | **Q201: the Passenger Orbiter overheats Biscuit on every robot ascent** (PLAYTEST #35, P2), a first-hour preset; plus Q190 (late parts buyable from flight 1) | vehicle (**no session**) | a clean first hour for W16's player |
| 3 | **Q19: the first load takes 86–88 s** on Windows (71 s linking the sky shader); fix built on branch `terrain`, needs its timing A/B on a **quiet machine** and the merge | world | every player's first visit |
| 4 | **W14: the screen identity** (leaning: instrument panel in flight, paperwork for the Program, both by era) | you | Q53, Q3 4b–4c's styling, Q104 |
| 5 | **Q164** presets with an antenna make their own power; **Q160** the duplicate-number check | vehicle; platform (**no session**) | Q27 and relays; no renumbering after merges |

## How a session uses this

1. **Start:** `git pull` in the main clone, then read `ACTIVE_WORK.md` and this file.
2. **Pick:** the top `ready` item in **your lane**. If your lane has nothing ready, take the top `ready` item of a lane whose
   session isn't running (check the claims), or an *Overflow* item: that's allowed, as long as you claim it.
3. **Claim:** set the item's state to `→ <session> <date>`, add your `ACTIVE_WORK.md` row (files at risk, as before),
   commit and push both. A one-line state change is the only edit you make to this file at start.
4. **Finish:** set the state to `✓ <commit>`, and add any follow-ups as new lines under *Proposed* at the bottom (one line
   each, `lane — what — src`). The orchestrator ranks them into the lanes. Then the usual closing (log, TESTING row, claim).
5. **Stuck on a decision?** Add it to *Waiting on Caio* and take your next item. Don't wait idle.

**Load** (the machine is shared, and two game runs at once hang or crash):
- 🖥 = verifying it needs the game running in Chrome on the GPU (preview, `playtest.mjs`, `shot.mjs`).
- ⚙ = headless only: `node test.mjs` (about 8 min of CPU) and reading code.
- 📝 = docs or design, no runs.

**Courtesy lock for 🖥 runs (per machine, not in git):** before you start Chrome on the game, look for
`C:/Users/caioa/dev/.game-busy`. If it's there and less than 20 minutes old, do ⚙ work first and check again. Otherwise
write your session name and the time into it, and delete it when your browser run ends. It's a convention, not a guarantee.

**Kickoff line Caio can paste into a fresh session:**
> You are the launchpad **<lane>** session (one of: flow, economy, vehicle, space, world, look & sound, QA, platform; for look & sound add the beat: parts & pad,
> effects, sky & bodies, or sound). Follow AGENTS.md's startup, then read `explorations/launchpad/QUEUE.md` and take
> the top ready item in your lane (overflow if none). Worktrees and ports: the heading of your lane below, or the `ACTIVE_WORK.md` lane table.

For the **design desk** role: *You are the launchpad design desk session. Follow `docs/session-roles.md` § Design desk;
start with D1 in QUEUE.md.* For the **playtest intake** role: *You are the launchpad QA session, playtest intake. Read QUEUE.md § QA, Q60, then turn
the feedback I paste into PLAYTEST items.*

---

## Flags (read before merging)

- **The file split landed** (`00e3e31`): the script is now `sim/*.js` and `app/*.js`. **Every branch: merge `main` before
  your next edit**; a branch cut before the split re-applies its changes into the new files (NOTES § "The file split").
- **Fixes landed** (`ae3d4aa`). **Flow:** the toolbar `.tr` is now absolute top-right (fixes' call; revert if you own it differently).
- **Q17 landed** (`c227ed6`): `PLASMA_V` / `plasmaOn(s)` in `sim/world.js`. Effects (Q20): use it for the plasma shell, no
  second threshold.
- **Flaky page loads in previews = the server, not your code** (effects, 2026-10-09): since the split the page loads ~30 scripts at once, and `python -m http.server` listens with a backlog of 5, so some scripts get `ERR_CONNECTION_REFUSED` and the rest cascade (`editorChanged is not defined`, `gl.getExtension is not a function`, `refView` returning `{}`). Workaround: serve with `ThreadingHTTPServer` and `request_queue_size = 128` (a 6-line script), and use `127.0.0.1`.
- **`.gitattributes` landed** (effects, 2026-10-09, Q156): `*.md *.js *.mjs *.html` are stored and checked out as LF everywhere. Merge `main` as usual; a worktree that shows every file modified afterwards needs `git add --renormalize .` once (it shouldn't: no file on `main` had CRs).
- ~~**`--smoke` fails one check on `main` (2026-10-09, seen by effects at `9270580`): vehicle-4's "launch warnings"** reads the Beeper short of orbit (4,894 m/s against the logbook's 5,600) when it runs inside the smoke shard; `--only vehicle-4` alone passes. Order-dependent state (likely a logbook best left by an earlier section). **Vehicle:** yours; until then a smoke failure on that one check isn't your merge.~~ **Fixed** (vehicle, v1.73.1 `c1e5d1f`): the check put the logbook back before two readings; `--smoke` passes.
- **Version numbers:** latest on `main` is v1.89.5 (economy). Check the latest `## v1.N` on `origin/main` right before numbering.
- **Overnight run (2026-10-08 → 09): flow, QA and look & sound (effects) are unattended, and all three use the GPU.**
  Respect the `.game-busy` lock: while another session holds it, do ⚙/📝 work (QA: Q54 and Q16 first). Don't idle.
  **Effects:** after Q20, Q63, **Q72, Q71, Q89** (design desk, Caio's request) and Q64, the other beats have no session tonight, so overflow in this order: Q23 (M1), Q65,
  Q21, Q24, Q66, Q67, then the look & sound evergreen list. Claim each item and keep to its beat's files.
  **Flow:** after Q2, **Q73** (design desk, Caio's request). Q3 is **plan only tonight** (default, Caio may override): write the plan in NOTES and don't build it. Take Q4
  and Q62 next. **QA:** Q29 becomes ready as soon as Q20 is on `main`; it is M0's finish line, so it jumps the QA queue.
- **Design desk, 2026-10-08 (Caio asked for work for the unattended sessions):** `SYSTEM.md` is **approved** (v1.0.0). New items:
  **Q72** crew mock-ups and **Q71** body mock-ups (look & sound: **effects takes them right after Q63**, before Q64),
  **Q73** identity mock-ups (**flow takes it right after Q2**, before Q3's plan). All three are mock-ups for Caio to pick
  from, not game code, so the milestone gate doesn't hold them. **Orchestrator:** ✓ fanned out as Q79–Q88; was: fan SYSTEM.md out into per-body items
  (its § "After approval"); the per-body look and ground items need a tester "go to body" view first.
- **New flight pay goes through `debPaid(R, kind, label, pay)`** (economy, every lane): otherwise the Debrief hides it in "days passing" (NOTES § UI "Slice 3 built").
- **POWERS.md approved** (v1.0.0): fanned out as Q102–Q106; Cape and Steppe first (its round-2 decision 1).
- **M0 is done (2026-10-09); M1 is current, M2 next** (ROADMAP rule 4). **The builder palette was empty on `main` from v1.68 to v1.73** (NOTES § v1.73): anything judged on the construction screen in that window needs a second look.
- **Effects: Q71, then Q89, before anything else** (Caio's picks wait on them).
- **World and anyone touching ground contact:** read NOTES § v1.61 "The contact model needed three fixes": `groundContact` sizes each point by its effective mass and holds with stiction (anchors).
- **The robot's `m1` run passes in full on `main`** (QA): any merge that touches screens reruns `node playtest.mjs m1` before pushing.
- **Design desk, 2026-10-09: [`MIDGAME.md`](MIDGAME.md) approved.** **Space (station-keeping, decay) and economy: read § Satellites before more satellite work**: lifetime is a design choice that a good satellite outlasts its era with, and replacement is for upgrades, not wear. Automation is opt-in per route and climbs with the compute eras.
- **Line endings are pinned** (Q156 ✓, `.gitattributes`). A NOTES merge that still conflicts on every line: `git merge -X ignore-space-at-eol`, or `git add --renormalize .` in a worktree that shows every file modified.
- **Q3's build opens on W15's defaults** (orchestrator, 2026-10-09: Caio silent; flow's lane had drained). Build 4a first; Caio may still override from the plan.
- **Memory:** two runs stopped for low memory on 2026-10-09 (vehicle's full suite, world's Q19 A/B). Use `--jobs 2` for the full suite when 4+ sessions are open, and leave 🖥🖥 items (Q19's A/B) for a quiet machine.
- **New flight-HUD content is a card** (flow, Q3 4a, v1.101): `HUD_CARDS.push({id, title, when?, rows})` in `app/hud.js`; `updateHUD`'s core is capped at 6 rows (test flow-5).
- **The milestone gate (ROADMAP):** code for **M1 (current)** and **M2 (next)**, any lane. M3+ items (crater landing, Selene terrain, crew) are 📝 plan items only,
  except where an item says the orchestrator allowed it (Q107, Q92's CPU half).

---

## Lanes (the eight in [`ROADMAP.md`](ROADMAP.md) § Lanes; item numbers kept)

States: `ready` · `→ session date` (taken) · `✓ commit` (done) · `after Qn` · `blocked: <on what>`.
Sizes: S (hours) · M (a slice) · L (several slices: enters as a 📝 plan item first). Milestone in the M column.
A lane with nothing ready: take the top line of its **evergreen** list in ROADMAP before going to another lane.

### flow — screens, navigation, HUD layout, onboarding (was ui)
Worktree `launchpad-ui` (branch `ui`, port 8795).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q2 | **Slice 3, Debrief**: `missionEnd` → summary record → screen (NOTES § UI "Slices"). Builds on fixes' `flightLeave` | M1 | M | 🖥 | ✓ `4f0adfc` (NOTES § UI "Slice 3 built"; TESTING 127) |
| Q73 | **Visual identity mock-ups (Q53)**: three directions on the same two screens (the Program screen and the flight HUD, real layout, static): (a) **paperwork**: mission-control forms, typewriter type, stamps, like the notebook map; (b) **instrument panel**: phosphor CRT and backlit legends, like the terminal map; (c) **mid-century poster**: flat colour, bold geometric type. Note how each would shift by era (NOTES: "later eras can shift the palette"). As standalone page(s) in `explorations/launchpad/mockups/` (never loaded by `index.html`, so no game code and no merge risk), stills to `output/launchpad/mockups/<topic>/`, one line per option in `mockups/README.md`; Caio picks from pictures | M1 | M | 🖥 | ✓ `a25c119` ([`mockups/README.md`](mockups/README.md); waiting on W14) |
| Q75 | PLAYTEST #25: the builder key strip `#bldhelp` overlaps both assembly panels at 1280×800 (fails `playtest.mjs m1`) | M1 | S | 🖥 | ✓ `a25c119` (`bldLayout`) |
| Q76 | PLAYTEST #26: `#msg` ("Mission complete") over the flight readout: give it a lane in `hudLayout()` (fails `playtest.mjs m1`) | M1 | S | 🖥 | ✓ `a25c119` (`msgLayout`) |
| Q39 | **Esc pauses** in flight and on every screen (W5 default) | M1 | S | 🖥 | ✓ `a25c119` (robot m1: 0 s while paused) |
| Q41 | **First-run:** each career choice explained in one sentence | M1 | S | 🖥 | ✓ `31cace4` |
| Q42 | A **settings** overlay: volume, graphics quality, tester off (the volume slider itself is Q35) | M1 | S | 🖥 | ✓ `f0133e4` |
| Q40 | **What to do next:** the Program screen always shows one suggested contract and why | M1 | M | 🖥 | ✓ `f0133e4` |
| Q1 | PLAYTEST **#8**: the readout covers the tabs | M0 | S | 🖥 | ✓ fixes (`ae3d4aa`) |
| Q3 | **Slice 4** flight core and cards; place the gauges; closes PLAYTEST #9 | M1 | L | 📝→🖥 | plan ✓ (NOTES § UI "Slice 4 plan"); **4a ✓ `75e443f`** (v1.101: a 5-line core + cards, `HUD_CARDS` in `app/hud.js`); **4b → flow 2026-10-09** (the gauges as the instrument panel, hidden in space; closes PLAYTEST #9), then 4c (map trims) |
| Q4 | **Slice 5, Rollout**: site picker and launch checks out of Assembly | M1 | M | 🖥 | ✓ `de08668` |
| Q62 | Pick a landing site on the map: a click on Selene/Nyx → `site` for the procedure (bodies' `landAt`) | M2 | S | 🖥 | ✓ `415cef1` |
| Q43 | Watch mode for a dispatched flight (fly the same procedure on screen) | M2 | M | 🖥 | after Q3 |
| Q99 | Flight results off the `#news` ticker now that the Debrief shows them; the Inbox collects what's left (NOTES § UI "What each screen shows") | M1 | S | 🖥 | ✓ `f0133e4` |
| Q115 | PLAYTEST #31 (P2): map labels pile up in the top-left corner (holds M0) | M1 | S | 🖥 | ✓ `46ac525` |
| Q145 | After a flight the Program screen's backdrop is the flown stage (in orbit, or the landing site), not the pad (PLAYTEST #27's second half) | M1 | S | 🖥 | ✓ `827eed7` |
| Q153 | The flight toolbar and `#msg` are hard to read over the notebook-era map (cream paper, pale buttons, white text): give them the era's ink | M1 | S | 🖥 | ✓ `960cd84` (body.paper: ink buttons and messages) |
| Q151 | Rollout: the long Δv warning (vehicle's `launchWarnings`, Q48) wraps to four lines at 1280×800; shorten or fold it | M1 | S | 🖥 | ✓ `d35e9bf` |
| Q155 | Network screen **N1**: the pad calendar (Gantt) and the fleet strip from what exists (pads, dispatch, timeline, registry), with economy's Q154 (NOTES § UI "Network screen plan"; W18's defaults) | M2 | M | 🖥 | ✓ `d35e9bf` |
| Q157 | Draw queued maneuver nodes on the map (markers, maybe handles); today only the active node has them (NOTES § v1.85) | M2 | S | 🖥 | ✓ `3f2d857` (v1.103: every node drawn; a click selects it, its handles edit it) |
| Q170 | Network screen N2: draw `netModel()`'s nodes (kind, body, slot, stock, need, days, paused) and `M.bottleneck`; delete `netFallback` in `app/network.js` (NOTES § "netModel() built") | M2 | M | 🖥 | ready |
| Q175 | Q87 slice 1, the map: the planets as discs with labels where they are that day, from epoch 1 (`SYSTEM_BODIES`, `helioPos` in `sim/system.js`). Closes PLAYTEST #11 (P2) | M1 | S | 🖥 | ✓ `3a8db1e` (v1.99: on a ring in the ecliptic, their real places sit behind the map's camera; NOTES § v1.99) |
| Q191 | **PLAYTEST #34 (P2): the Debrief says nothing about the crew** (home safe, or lost) | M1 | S | 🖥 | → flow 2026-10-09 (after Q3 4b) |
| Q192 | The map's planet labels: two planets close on the ring lose one label to the overlap rule; merge them (`Hesper, Astraea`) (NOTES § v1.99) | M2 | S | 🖥 | ready |
| Q196 | **Move a planned burn from the Program screen** (or "fly at the next contact"): since v1.102 a burn out of every station's view in the mainframe era can only be flown by hand | M2 | S | 🖥 | ready |
| Q203 | PLAYTEST #37 (P3): Network says "holds its orbit 0 more days" where Fleet says "re-enters in …" | M2 | S | 🖥 | ready |
| Q193 | **The rollout lying down** (with look & sound): on a Steppe pad the Rollout screen shows the rocket on its side on the transporter-erector, rolling along the rails, then raised | M1 | M | 🖥 | ready |
| Q167 | Q49 slice 4 (with economy): cruise entries on the fleet strip (N1 ✓); paying along the way — same plan | M2 | S | 🖥 | ready (slice 2 ✓) |
| Q100 | Keep the last Debrief across reloads (`PROG.lastDebrief`) | M1 | S | ⚙ | ✓ `618c587` (space overflow: the last Debrief survives a reload) |
| Q98 | A key to deploy legs and wings (`G` if free) | M1 | S | 🖥 | ✓ vehicle: Y legs (v1.61), P solar wings (v1.68), taped and in the key list; flow may still move the keys |
| Q104 | Flags and roundels in the UI (the world section, the race, news), from [`POWERS.md`](POWERS.md) | M1 | M | 🖥 | ready (Q103 ✓ v1.89; restyle with Q53 later) |
| Q111 | 📝 The **network screen** (nodes, routes, t/y, the named bottleneck) beside the pad calendar ([`LATE_GAME.md`](LATE_GAME.md)) | M4 | M | 📝 | plan ✓ (NOTES § UI "Network screen plan"); N1 buildable now, N3 waits on routines (W16) |

### economy — program, contracts, money (resume from [`HANDOFF-economy.md`](HANDOFF-economy.md))
Worktree `launchpad-economy` (branch `economy`, port 8774).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q112 | PLAYTEST #28 (P2): staged pay goes to a mission nobody flew (a craft already at the body collects shares as missions unlock). **Holds M0: take first** | M1 | S | ⚙ | ✓ v1.74 `029df7a` (`R.open0`: shares only for missions open at launch) |
| Q118 | Re-run `career.mjs` PACE/FAILFIRST after v1.55: does a prudent player still reach first orbit in the intended flights, with one failure? (M1's finish line) | M1 | S | ⚙ | ✓ v1.77 `cac945f` (4–6 flights to orbit everywhere; a poor-world company stuck 1 in 5 → fixed by Q93) |
| Q144 | `career.mjs` `passOrbit`'s stack (bio, pod, shield, no decoupler) would bury its shield in real physics: fix the stack (NOTES § v1.73) | M1 | S | ⚙ | ✓ `da830d3` (Beeper, Passenger Orbiter; 4 flights to orbit everywhere) |
| Q5 | PLAYTEST **#21**: settle `missionEnd` when leaving a finished flight | M0 | S | ⚙ | ✓ fixes (`ae3d4aa`) |
| Q44 | **Epoch 1–2 pacing for a new player** (`career.mjs`: flights and days to first orbit; nothing unaffordable after one failure) | M1 | M | ⚙ | ✓ measured `d6792f2`: ~5 flights to orbit, but one failed orbit attempt breaks it → **W12** |
| Q6 | **`siteAccess(site)` → {ok, why, fee}** and `R.site` | M1 | M | ⚙ | ✓ v1.56 `876a197` (leases by relations, sea 4M, members free; fee on the debrief) |
| Q7 | Ballistic contract target from the flight's site (still `rg/600` from +X) | M1 | S | ⚙ | ✓ v1.57 `d9badbc` (from the program's site; counts only from there) |
| Q8 | Ladder balance: Selene/Nyx firsts above their rocket; nyxfind not free on the farside flight (Caio overrode the W1 default) | M1 | S | ⚙ | ✓ economy v1.53 (Nyx found only by looking; pay floor 1.3×) |
| Q45 | Every offer says **why it appeared**, in one line | M1 | S | ⚙ | ✓ v1.59 `b18db73` (`whyOf`: the strongest true reason, kept on the offer) |
| Q46 | Dry runs as the trajectory office's study: a `procAdopt(stack)` button (days, price), a wider estimate for `prov`, the measured margin cached | M2 | S | ⚙ | ✓ v1.63 `1312d39` (`dryQuote`/`orderDryRun`; margin cached; provisional estimates wider) |
| Q10 | Rover part prices and era gates; price R4's science contracts (NOTES § R4) | M2 | S | ⚙ | ✓ v1.66 `812476b` (prices, gates at LAUNCH; six Selene science contracts) |
| Q61 | Dispatch to a base: pass the base's `pf` as the landing `site` (procedures land within ~5 m) | M2 | S | ⚙ | ✓ v1.69 `1c546dd` (supply runs: ascent procedure + landAt on the beacon; joins the base) |
| Q9 | Station, base, relay and rendezvous contracts | M2 | L | 📝 | plan ✓ `ef69f28`; slices 1–3 ✓ (v1.89.3 stations, v1.89.4 station firsts, v1.89.5 bases); slice 4 is Q180 |
| Q88 | 📝 Missions per body from [`SYSTEM.md`](SYSTEM.md) (each body's *role*): firsts, science, the race, which epoch opens each | M5 | M | 📝 | ✓ plan `1d24934` (NOTES § "Plan: missions per body…"; W item) |
| Q103 | **Powers as content** from [`POWERS.md`](POWERS.md): school and government forms in `makePowers` (+ People's Republic, Emirate, Sultanate, State), syllable sets per school, rival news rules and headline tone per archetype | M1 | M | ⚙ | ✓ v1.89 `bd6bd30` (schools one source of truth; names by school and form; rivals announce/rumour/tone) |
| Q122 | PLAYTEST #33 (P3): "Sponsor covers the failed attempt" on a flight that reached orbit; "1 days passing" | M1 | S | ⚙ | ✓ v1.74.1 `b8854b3` (no cover in orbit; "1 day") |
| Q126 | **Replacement for upgrades**: service quality by the satellite's era (obsolescence); servicing contracts only for valuable assets; check TV's daily pay (v1.71: the capital sees it all day, tilt free) against it — MIDGAME.md § Satellites | M2 | M | ⚙ | ✓ v1.81 `417d96e` (earnings 1/(1+0.35·eras behind); service contracts by docking; TV pay checked) |
| Q130 | The career runner flies rovers (a Selene science program): measure v1.66's rover prices and R4 pay against income | M2 | S | ⚙ | ✓ `af3a6c6` (rover program +90M over 4 y on average; prices stand) |
| Q123 | 📝 **Money buys capacity**: pads, sites and yards dearer as you grow; hardware as the late money sink; late revenue ([`LATE_GAME.md`](LATE_GAME.md) § Money) | M4 | M | 📝 | ✓ plan `7ed4ba3` (NOTES § "Plan: money buys capacity"; W item) |
| Q133 | 📝 CREW part 2: **the roster and the astronaut office's classes** (with flow for the screen) — [`CREW.md`](CREW.md) § Part 2 | M3 | M | 📝 | ✓ plan `ce6b69a` (NOTES § "Plan: the roster, …"; 5 slices; W item) |
| Q135 | 📝 CREW part 2: **requalification after a loss** (replaces the timed stand-down) | M3 | S | 📝 | ✓ plan `ce6b69a` (NOTES § "Plan: the roster, …"; 5 slices; W item) |
| Q136 | 📝 CREW part 2: **the scientist's and engineer's hooks** (with space) | M3 | S | 📝 | ✓ plan `ce6b69a` (NOTES § "Plan: the roster, …"; 5 slices; W item) |
| Q137 | 📝 **Crew rotation by dispatch**: a crewed supply run lands crew at a base and brings the old crew home (needs a crew record in headless flights; D7's ladder: the first resupply is crewed) — NOTES v1.69 | M3 | M | 📝 | ✓ plan `ce6b69a` (NOTES § "Plan: the roster, …"; 5 slices; W item) |
| Q138 | 📝 **Rivals as programs**: budget → capacity → progress per capstone (replacing seeded schedules late); scarce places held by building first — [`LATE_GAME.md`](LATE_GAME.md) 1.4.0 | M4 | M | 📝 | ✓ plan `88c07f7` (NOTES § "Plan: rivals as programs…"; W item) |
| Q113 | PLAYTEST #29 (P3): weighing Nyx and the flyby pay on one flight: propose a rule (a design call; W11's rule may already cover it) | M2 | S | 📝 | ✓ v1.81.1 `58784ca` (W11 built: missions count only on a flight launched while open) |
| Q93 | Contract pay floors by world: in a frugal world a company at the floor can't earn its way back with sounding work (NOTES § Epoch 1–2 pacing) | M1 | S | ⚙ | ✓ v1.77 `cac945f` (floors 1.3× a preset's net cost; Withdraw) |
| Q150 | A private company in a frugal world stagnates: reaches orbit (v1.77) but ends 4 years at 25M, never reaching Selene (`SELENE=1 node career.mjs 4 2`); find what it lacks (budget day, contract mix, investors) | M2 | S | ⚙ | ✓ `bc691b7` (no recurring income; stakes fix it: frugal 187M → 392M; no game change) |
| Q154 | `netModel()`: one pure function the network screen draws from (nodes, routes, goods, bottleneck, fleet, pads), with space; shape in NOTES § UI "Network screen plan". Flow's Q155 needs it | M2 | S | ⚙ | ✓ v1.89.1 `00e0e3a` (fleet, pads, nodes with stock/need, supplies bottleneck; the screen switched over) |
| Q165 | Q103's next slice: the program's own news and mission control in its archetype's voice; rising powers copy claimed firsts, frugal ones partner in the race schedule (with Q138) — POWERS.md § archetypes | M2 | M | ⚙ | ✓ v1.89.2 `a151fc4` (frugal partners, rising copies then catches up; OWN_TONE) |
| Q180 | Q9 slice 4: rendezvous and retrieval contracts (a near-pass check during a flight; retrieval brings a satellite home, its parts' value back: W22 default 4) | M2 | M | ⚙ | ✓ v1.98 `33a14aa` (rendezvous: 100 m under 1 m/s during the flight; retrieval after `stationcrew`, only landed in a closed bay, hardware refunded; the part gate is proposed for vehicle) |
| Q188 | **Rivals as programs from epoch 1** (W26.1, Caio): amend Q138's plan for a coarse early version (budget → capacity → progress) replacing the seeded schedules; tune so the early race keeps today's pacing | M2 | M | ⚙ | ready (plan the re-scope first) |
| Q206 | **The commercial giant** as a rival kind in Q138/Q188 (commercial era, undercuts prices, sells parts) — D10, POWERS.md 1.1.0 | M2 | M | ⚙ | after Q188 |
| Q187 | 📝 **Rivals' satellites as targets** (W22.3, with space): rendezvous, retrieval (home or into your bay) and hacking under one stealth model (shadow, burn size…), with consequences (incident if spotted, sanctions, lost contracts, opinion) | M2 | M | 📝 | ready (plan only) |
| Q181 | Q96's slice: overflight by the track flown (`R.over` in `missionTick`), tense neighbours' opinion and relation in `missionEnd`, the Debrief line, a test (W23's defaults) | M2 | S | ⚙ | ready |
| Q184 | Q110 slice 1: **routines**, a repeating supply run to a base (its window, its pad-calendar row, `netModel().routes`) (W27's defaults; ROADMAP § M2 lists "the routine run") | M2 | M | ⚙ | ready |
| Q182 | Crew slice 1: the roster (data, names, the first class, automatic picking, record and ranks, the loss named) (W24's defaults) | M3 | M | ⚙ | blocked: milestone gate (M3) |
| Q183 | Crew slice 2: requalification after a loss (crewed launches refused until an uncrewed flight shows the cause fixed; the closed power's skip) | M3 | S | ⚙ | blocked: milestone gate (M3) |
| Q162 | Q9 slice 1: state-judged station contracts (resupply, lab time, expansion) — NOTES § "Plan: station, base, relay and rendezvous contracts" (W22's defaults) | M2 | M | ⚙ | ✓ v1.89.3 `18d6da4` (resupply, lab time, expansion; state-judged) |
| Q163 | Q9 slice 2: the first-station firsts (`station1` → `stationcrew` → `stationlab` → `station30`) — same plan | M2 | S | ⚙ | ✓ v1.89.4 `62ee02c` (four world firsts; crewed days counted) |
| Q95 | Dispatched flights from a site abroad pay its lease (`orderDispatch`; procedures fly from their recorded site) (NOTES v1.56) | M2 | S | ⚙ | ✓ v1.77.1 `5530b7e` (from the procedure's site; lease on the price; stood down if refused) |
| Q96 | 📝 Overflight politics: launching over a neighbour (`site.downrange.over`) costs opinion or needs consent. Check it against ROADMAP § Pillars first | M2 | M | 📝 | ✓ plan `660a522` (NOTES § "Plan: overflight politics"; W item for Caio) |
| Q110 | 📝 **Goods on routines** (propellant, supplies, crew, hardware), outposts' self-sufficiency and exports, capstones and records for epochs 6–10 ([`LATE_GAME.md`](LATE_GAME.md)) | M4 | L | 📝 | ✓ plan `9dcbbd9` (NOTES § "Plan: goods on routines…"; W item) |
### vehicle — parts, construction screen, attitude, aero, heating, nodes (was builder + control)
Worktrees `launchpad-builder` (branch `builder`, port 8772), `launchpad-control` (branch `control`, port 8796).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q74 | **PLAYTEST #24 (P1): Beeper and Passenger Orbiter presets** (the Orbiter with `sci` / `bio` for `pod`): the presets-only first hour can't fly the first orbit missions without them. **Top** | M1 | S | ⚙ | ✓ v1.73 (Beeper, Passenger Orbiter; TESTING 147) |
| Q77 | PLAYTEST #27: `builder.js` `overlay()` draws "NaN%" joint labels on the Program screen after a flight (missing `atHQ` check) | M1 | S | 🖥 | ✓ v1.73 (robot m1 passes) |
| Q47 | **The construction screen usable by a newcomer**: walk building an Orbiter from scratch, fix what's unclear; Caio reviews. **Top priority: it blocks Caio's own playtesting** | M1 | M | 🖥 | ready |
| Q48 | The builder **warns before launch**: won't reach the contract's orbit, TWR < 1, no chute on a crewed return | M1 | S | ⚙ | ✓ v1.79 (Rollout: Δv for the aim, parachute; TESTING 152) |
| Q32 | The escape tower gets its own palette category | M1 | S | 🖥 | ✓ v1.79 (*Crew escape*) |
| Q31 | Landing legs part (`footPoints` already takes their feet) | M1 | S | ⚙ | ✓ `0d1da8d` (v1.61) |
| Q78 | A **Docking** preset (probe core, port, RCS quads, gas): makes TESTING 58–67, 98, 116 reachable without the builder (PLAYROUTE § Not on this route) | M2 | S | ⚙ | ✓ v1.80 (TESTING 160) |
| Q14 | PLAYTEST #18 + #23 | M0 | S | ⚙ | ✓ `0c2e701` (v1.51.1) |
| Q33 | Maneuver nodes: chains, beyond an SOI change, finite-burn centroid correction | M2 | M | ⚙ | ✓ v1.85 (chains, past an SOI change, the lead; TESTING 167) |
| Q34a | Onboard computer, solar panels (body cells + a deployable wing), battery, and a steady-state power budget in the builder; running flat pauses, never kills. From the onboard-computer era, the guidance computer's SAS modes come built into crew capsules and need an `ocomp` part on probes (Caio decided 2026-10-08); uncrewed presets and the robot's probes get one (NOTES § "Vehicle parts") | M2 | M | ⚙ | ✓ v1.68 |
| Q34b | Radiators + the steady-state orbital thermal solve; build alongside economy's orbital datacenter (NOTES § "Vehicle parts") | M4 | M | ⚙ | 📝 plan only (M4 under the gate: steady-state temperature and the datacenter are M4) |
| Q121 | Legs go down by themselves in procedures (`landAt`) and the robot's landings; a deployed state that survives leaving the flight (`vesselOf` `vst`) (NOTES § v1.61) | M1 | S | ⚙ | ✓ v1.79 (procedures; through the register; TESTING 153) |
| Q131 | Builder power line: pick the orbit (today low Tellus, β 0); battery charge carried past a flight's end; an RTG (NOTES § v1.68) | M2 | S | ⚙ | ✓ v1.80 (RTG; the aim's orbit; charge kept; TESTING 161) |
| Q201 | **PLAYTEST #35 (P2): the Passenger Orbiter overheats Biscuit on any robot ascent**; test vehicle-3 tracks its own cabin from 290 K after the orbit and misses it. A first-hour preset: **top** | M1 | S | ⚙ | ✓ v1.73.1 `c1e5d1f` (a nose cone over the chute: cabin ~300 K at orbit, 665 m/s spare; `vehicle-3` reads `S.rec` from liftoff; browser row 147 to re-run) |
| Q204 | vehicle-4's "launch warnings" fails inside `--smoke` on `main` (reads the Beeper short of orbit, 4,894 against 5,600 m/s); passes alone: order-dependent (Flags) | M1 | S | ⚙ | ✓ v1.73.1 `c1e5d1f` (the check restored the logbook before two of its readings; smoke passes) |
| Q202 | PLAYTEST #36 (P3): the stock Hopper shows the unstable warning at roll out | M1 | S | ⚙ | ready |
| Q164 | **Presets that carry an antenna make their own power** (Probe, and Q152's lander: body cells or a wing; the builder's power line green). Unblocks Q27, whose service gating would end Probe satellites after ~4 days | M2 | S | ⚙ | ✓ v1.105 (space overflow: three body-cell panels on the Probe, 24 W vs 15 W in low orbit; four moon firsts 230 → 240M for the pay floor; NOTES § v1.105; TESTING 185) |
| Q190 | **Era gates for vehicle parts**: only rover parts are gated today (`rvPartOpen`), so the cargo bay and the arm are buyable from the first flight. Gate `bay`, the arm and other late parts by era (from economy, Q180 v1.98) | M1 | S | ⚙ | ready |
| Q189 | **D5: a rover frozen in the night goes dormant**, never dies: `R.dead` on a flat cold battery becomes `R.dormant`; it wakes when its panels see the sun (in flight `rvTick`, between flights the field tick); the lost night is the only price | M2 | S | ⚙ | ready |
| Q197 | A **high-gain dish** part (a gain class, ~×100 over the whip) so a high camera satellite can earn again after v1.100 (pay per bit: at 2,000 km a whip drains 5 kbit/s) | M2 | S | ⚙ | ready |
| Q152 | A legged lander preset (or legs on Probe/Sample Return) so `fly_ladder.mjs` exercises the legs end to end (Q121 is checked unit-level) | M2 | S | ⚙ | parked by vehicle (full suite stopped for low memory); resume from `builder` |
| Q134 | 📝 CREW part 2: **the pilot's SAS modes by rank**: CREW's ranks don't line up with the `AV` generations (rank 2 has target, not docking), so `avOf` needs per-mode gating | M3 | S | 📝 | ✓ plan (NOTES § \"The pilot's SAS modes by rank\"); build after the roster |
| Q141 | The builder shows a satellite's **lifetime** ("holds its slot 12 years at 0.37 m/s a day") beside the power line (with space; v1.71) — MIDGAME.md § Satellites | M2 | S | 🖥 | ✓ v1.81 (Lifetime line; TESTING 165) |
| Q119 | 📝 The **habitat budget** in the builder on top of Q34b's steady-state solve (power per person with food closure, radiators, panels by distance, return berths; habitat and lab modules get power loads, "a dark station can't keep people"; solar output by distance from Helios at M5); **shielding gets a design review with Caio before it's built** ([`LATE_GAME.md`](LATE_GAME.md) 1.1.0) | M4 | M | 📝 | after Q34b (plan only) |
| Q36 | Heat conduction between parts; heating from an engine's own plume (evergreen) | — | M | ⚙ | ready |
| Q37 | Hypersonic capsule lift in the impact predictor (evergreen) | — | M | ⚙ | ready |

### space — bodies, orbits, registry, procedures, docking, stations, rovers, the link (was bodies + sats + planning)
Worktrees `launchpad-sats` (branch `sats`), `launchpad-bodies` (branch `bodies`, port 8777; on `pc_de_varginha`), `launchpad-planning2` (branch `planning`, port 8775).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q11 | `dispatchRun`: dispatch flown, not rolled; dry runs | M2 | M | ⚙ | ✓ bodies (`a94ea97`) |
| Q12 | Deviation rules + the climb's corridor | M2 | S | ⚙ | ✓ bodies (`c1d7afb`) |
| Q50 | **Station-keeping as a fuel lifetime** (W2 default): propellant at zero → the satellite drifts and its service pauses, never dies | M2 | M | ⚙ | ✓ v1.60 `60a7660` (TESTING 134) |
| Q25 | **Orbital decay** for low satellites (unblocks reboost) | M2 | M | ⚙ | ✓ `21bbfa1` (v1.64: `thinAir`, `dragK`, `decayStep`; NOTES § v1.64; TESTING 140) |
| Q26 | **Contact with debris** and between satellites (unblocks grabbing debris) | M2 | M | ⚙ | slice 1 ✓ `7918837` (v1.76: spent stages in orbit become registry Debris; plan in NOTES § "Plan: debris and Kessler"); slices 2–4 are Q146–Q148 |
| Q146 | Debris slice 2: conjunctions between flights, big objects vs active entries only (Öpik flux, seeded roll; tracked → warned and dodged from the tanks; crewed always warned) | M2 | M | ⚙ | ✓ `25b6d34` (v1.82: `conjTick`, `pairRate`, checked against a Monte Carlo; big objects almost never collide, the pressure is Q147's fragments) |
| Q147 | Debris slice 3: fragments as density per 50 km band (drag clears, collisions feed, the cascade with warnings; POWERS' anti-satellite test) | M2 | M | ⚙ | ✓ `94192f4` (v1.83: fragment bands by NASA's breakup model, drag drain, dead hulks, 40 J/g to shatter, the cascade as R0 ≥ 1 due within 50 years, `asatTest`) |
| Q148 | Debris slice 4 (with flow, economy): the world setting off / light / real (default light; with platform's Q124); the map's band view; cleanup contracts | M2 | M | 🖥 | after Q147 |
| Q149 | Dispatched routine flights leave no debris yet (`procFly` restores the list) | M2 | S | ⚙ | ✓ `dff3e5d` (v1.86: `procFly` keepJunk, `junkAdd`; the dispatched payload itself is Q49) |
| Q27 | Relay range and power; the power side: what a flat battery does to the antenna, camera and a registered satellite's service (`powerBudget`, `hasComputer`, `s.E`/`s.pwrOut` in `sim/power.js`; NOTES § v1.68) | M2 | M | ⚙ | blocked: the presets with an antenna make no power of their own (the Probe: core battery 0.5 kWh, 15 W of antenna and camera, flat in ~33 h). Gating service or the link on power now would end Probe TV/imaging service after ~4 days and Probe antenna missions on long flights. Needs the vehicle item under *Proposed* first; relay range folds into Q51's link budget (space, 2026-10-09) |
| Q49 | **Missions in flight**: every vessel coasting at flight end joins the registry, on rails across bodies, raising events | M2 | L | 📝 | plan ✓; slice 1 ✓ `fe9834e` (v1.90: cruise entries on rails across bodies, *In flight* list); slice 2 ✓ `1f2eb35` (cruise events on the timeline, no silent misses); slices 3–4 are Q166, Q167 |
| Q166 | Q49 slice 3 (with vehicle): maneuver nodes carried with a cruise entry; executed by mission control at the era's error, or flown — NOTES § "Plan: missions in flight" | M2 | M | ⚙ | ✓ `87f8588` (v1.93: nodes carried, a stop 3 h ahead, mission control at the era's error, missed ones dropped) |
| Q168 | The dispatched payload as a cruise entry or satellite (`dispatchRun` still drops `f.s`) (NOTES v1.86, v1.90) | M2 | S | ⚙ | ✓ `c364972` (a dispatched flight's payload stays up) |
| Q51 | Data as a volume + the link budget | M2 | L | 📝 | plan ✓ (NOTES § "Plan: data as a volume and the link budget"); slices are Q171–Q174 |
| Q171 | Q51 slice 1: `pathHome` and the link budget (gain classes, station dishes, line of sight, one relay hop, rate and delay); `linkOf`, `rvContact` and imagery's contact share call it; today's behaviour as tests | M2 | M | ⚙ | ✓ `96d98dc` (v1.96: rate and light delay on every link; whip over the pad 333 kbit/s, at Selene 20.5 bit/s) |
| Q172 | Q51 slice 2 (with economy): data as a volume (instruments → recorders → downlink at the path's rate); pay on data received | M2 | M | ⚙ | ✓ `df49ab1` (v1.100: recorders, downlinks, imagery paid per bit received; NOTES § v1.100; TESTING 176) |
| Q173 | Q51 slice 3 (with flow): relays as nodes, coverage drawn, routes through gaps flagged; relay power | M2 | M | 🖥 | after Q172 and Q164 |
| Q174 | Q51 slice 4: solar conjunction and light delay at the planets | M5 | S | ⚙ | after Q87's slices; blocked: milestone gate (M5) |
| Q87 | 📝 **The system on rails** from [`SYSTEM.md`](SYSTEM.md): Helios as the root (today Tellus is), each planet's orbit and SOI, time scales; and the cheap early part, the other planets on the map from epoch 1 (PLAYTEST #11) | M5 | L | 📝 | plan ✓ (NOTES § "Plan: the system on rails"); slice 1 → space (sim ✓ `55d8115`, `sim/system.js`), its map drawing is flow's Q175; slices 2–4 are Q176–Q178 (M5) |
| Q176 | Q87 slice 2: Helios as the root, the Tellus-centred absolute frame, `SUN_DIR(t)`, Tellus's finite sphere, heliocentric legs | M5 | L | ⚙ | blocked: milestone gate (M5) |
| Q177 | Q87 slice 3 (with look, vehicle): the moving sun: seasons (23°), panels and eclipses by `SUN_DIR(t)`, the sun dimmer outward | M5 | M | ⚙ | blocked: milestone gate (M5) |
| Q178 | Q87 slice 4 (with economy): warp to ~10⁶× on heliocentric legs; launch windows on the timeline | M5 | M | ⚙ | blocked: milestone gate (M5) |
| Q114 | PLAYTEST #30 (P3): the first moon's orbital period is logged mid-capture | M2 | S | ⚙ | ✓ `9a8ca1a` (v1.87: the period is logged once the engines stop; PLAYTEST #30 fixed) |
| Q125 | **Re-tune station-keeping (v1.60) and decay (v1.64)** so a well-designed satellite outlasts its era (Caio 2026-10-09: maintenance as a chore is out) — MIDGAME.md § Satellites | M2 | S | ⚙ | ✓ `a9b2a09` (v1.71: the tilt is let go and really wanders; TV keeps ~6 years on ~500 m/s; decay already fits above ~300 km; dry re-entry is D6) |
| Q128 | The flight's own coast feels the thin air above 100 km (20 m/s an hour at 110 km): today it's free mid-flight. Check the presets' parking orbits first (NOTES v1.64) | M2 | S | ⚙ | closed: D8 (a), the air cuts off in flight as now; decay between flights stays |
| Q142 | A proper deadband controller on the full physics, to check v1.71's hold cost (a crude one pumped the eccentricity) | M2 | S | ⚙ | ✓ (study, `study_slot.mjs` part D, NOTES § "station-keeping checked against a real controller": 46–67 m/s a year vs the model's 89; no change) |
| Q139 | 📝 At M5: add **Helios's tide** to the Tellus system (Tellus–Helios L1/L2) with 6b's machinery; Selene's L4/L5 already hold (`study_lagrange.mjs`) | M5 | S | 📝 | ✓ plan (NOTES § "Plan: Helios's tide on the Tellus system": per-orbit like the moons' children, above ~2,500 km; the moons stay on rails; with Q87 slice 2) |
| Q140 | 📝 **Asteroid capture and mining** (with economy): epoch 7 capture with solar-electric tugs, 8–9 mining in place, type → yield, deflection as a pressure — LATE_GAME.md § Asteroids | M5 | M | 📝 | ✓ plan (NOTES § "Plan: asteroid capture and mining, the space side": seven steps on LATE_GAME's design; needs Q87 slice 2 and a low-thrust stepper shared with Q109) |
| Q127 | 📝 **The automation ladder** (with economy): which routines each compute era permits (dispatch → deployments → uncrewed docking → Selene → planets); crewed routines before onboard computers; templates store a window rule — [`MIDGAME.md`](MIDGAME.md) | M2 | M | 📝 | plan ✓; slice 1 ✓ `1522cb0` (v1.95: `autoAllowed`, the ladder as one table); slices 2–3 are Q185, Q186 |
| Q185 | Q127 slice 2 (with economy): window rules recorded with procedures; `nextWindow(rule, T)`; routines launch at their next window | M2 | M | ⚙ | ✓ v1.104 `caa9676` (`windowRule`/`nextWindow`: any, plane, light; supply runs land in daylight, up to 6.7 d wait; the pad calendar shows the wait) |
| Q186 | Q127 slice 3: contact gates automation (a routine burns only in contact or within its computer's tier) | M2 | S | ⚙ | ✓ v1.102 (`entryLink`, `handOffWhy`; a burn out of contact is refused or passes before onboard computers; NOTES § v1.102; TESTING 181) |
| Q200 | **Debris that exists only as you pass** (Caio 2026-10-09): during a monitored flight through a band, roll a few seconds ahead from density × cross-section × speed; on a hit, spawn the fragment on a collision course | M2 | M | ⚙ | ready |
| Q198 | **Rover science as volumes** (spectrometer and camera readings through `rvContact`'s rate); imagery and contract frames sharing one pass budget (NOTES § v1.100) | M2 | S | ⚙ | ready |
| Q108 | 📝 A **cycler study**: a Tellus–Enyo cycler on our rails (Aldrin geometry at 1.52 TU), Δv to keep it, taxi rendezvous Δv ([`LATE_GAME.md`](LATE_GAME.md) § network) | M5 | M | 📝 | ✓ study (`study_cycler.mjs`, NOTES § "Q108: a Tellus–Enyo cycler": ballistic with Tellus flybys under ~800 km on our scale; taxis 1,702 / 2,022 m/s) |
| Q109 | 📝 Plausible **fusion propulsion** as a late part family, sharing low-thrust propagation with NEP (with vehicle; TECH_SCOUTING) | M5 | M | 📝 | ✓ plan (NOTES § "Plan: low thrust on rails": ~2e-3 m/s² halves the Enyo trip, i.e. ~50 W of jet per kg of craft; NEP is for tugs; thrust on rails, arcs between flights, Edelbaum for routines) |
| Q13 | Landing on a chosen crater | M3 | M | ⚙ | ✓ bodies (`site`, `landAt`: 5 m on Selene and Nyx; recorded landings return to their spot) |

### world — the planet, sites, geography, Selene's ground (was terrain)
Worktree `launchpad-terrain` (branch `terrain`, port 8773).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| — | Atlas view (biomes, coasts, borders) | M1 | M | 🖥 | ✓ merged as v1.52 (`c227ed6`) |
| Q17 | PLAYTEST #17, Link side: blackout gated on airspeed (`PLASMA_V`, `plasmaOn`) | M0 | S | ⚙ | ✓ `c227ed6` |
| Q19 | Cost of low grazing views (8.8 ms over rugged hills): M1 needs a steady frame rate at the default site | M1 | M | 🖥🖥 | parked (world, 2026-10-09): fix built on branch `terrain` (`3a9cda2`: the terrain march in its own G-buffer pass; pixel-identical to main), **timing A/B not yet run** (stopped twice: machine out of memory); NOTES § "Q19, round 2" |
| Q169 | After Q19 merges: the rest of the sky shader's link time on ANGLE/D3D11 (first load target well under 20 s); players' first visit and Caio after every update (NOTES § "Q19, round 2") | M1 | M | 🖥 | after Q19 |
| Q52 | Terrain look: coasts too smooth, the pad terrace, monotone ice ranges, lost salt flats and wetlands (NOTES § v1.25 "Next session" #3) | — | M | 🖥 | shader part ✓ `5ac7ce0` (wind-scoured ranges, `ICE_VARY`); the coast, the pad terrace (heightfield, shared with `terrainH`) and the salt-flat/wetland masks stay with world |
| Q18 | Selene terrain: craters, maria, slopes, shadows, horizons | M3 | L | 📝 | ✓ plan: [`GROUND.md`](GROUND.md) (with Q86) |
| Q86 | 📝 Ground per body from [`SYSTEM.md`](SYSTEM.md)'s ground briefs: which generator each needs (craters, dunes, ice, none for Hesper and Hyperion), shared with Q18 | M5 | L | 📝 | ✓ plan: [`GROUND.md`](GROUND.md) (with Q18) |
| — | GROUND.md **G1**, the body-ground layer (no new relief) | M3 | M | ⚙ | ✓ v1.54 `5cdf43d` |
| Q90 | GROUND.md **G2**: Selene's baked map + crater bands on the CPU, `study_ground.mjs` (`geoAt` on the bake moved to G3) | M3 | M | ⚙ | ✓ v1.58 `dd8f459` |
| Q91 | GROUND.md **G3–G6**: the march on Selene, shadows, consumers (with space for `landAt`), Nyx | M3 | L | 🖥 | after G2 ✓; Q107 first; going live needs Q57; **milestone gate**: the rest waits until M2 is current |
| Q107 | GROUND.md **G3.0**: `ptan`/`patan` in the crater bands' cube-cell geometry and `fround(λ)`, CPU only (heights move < 1 cm). Allowed before the gate (orchestrator): headless, no visible change | M3 | S | ⚙ | ✓ v1.78 (heights moved 2.7e-8 m) |
| Q92 | GROUND.md **G7+**: per-planet ground (Enyo → Hesper → Astraea → Hyperion's moons → Erebus → seeded lumps) | M5 | L | 🖥 | CPU half under way (world): **Enyo ✓ v1.62** (`9cf7323`), **Hesper ✓ v1.65** (`8d8ce03`), **Astraea ✓ v1.67** (`6dcda41`), **Hyperion's moons ✓ v1.70** (`3e775b8`), **Erebus ✓ v1.72** (`976b759`), **seeded small bodies ✓ v1.75** (`aa2a263`, `smallBodyGround`): **the CPU half is complete**, nothing live, Hyperion's moons, Erebus. Drawing still after Q91 and Q79 |
| Q105 | The pad site per school (cove, ridge, coast, steppe), if it touches terrain ([`POWERS.md`](POWERS.md)) | M1 | S | 🖥 | after Q102 |

### look & sound — always run as beats, one session each (ROADMAP § Lanes, "Beats")
Collisions between beats: `render()`'s pass order, shared shader helpers, bloom, `views.js` numbering. Changing any of them needs an `ACTIVE_WORK.md` line.

#### beat: parts & pad — `partShape`/`partBody`, textures, marks, the complex and rig · worktree `launchpad-visuals` (branch `visuals`, port 8776)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q23 | Draw the nozzle gimbal (`p.gv`) and steerable fins (`p.fd`); give `rwheel` its own look | M1 | M | 🖥 | ✓ `2a6d719` (`setMoves` in `MESH_VS`, `plumeFrame`; views 105–107) |
| Q72 | **Crew mock-ups for D2**: one scene (the capsule hatch on the pad walkway), three astronaut styles in the same pose: **cartoony** (Kerbal-like), **realistic**, **stylised human** (1960s illustration, Thunderbirds, Tintin); a wide still and a helmet close-up each. Trade-offs: ROADMAP § "Design catalogs". As standalone page(s) in `explorations/launchpad/mockups/` (never loaded by `index.html`, so no game code and no merge risk), stills to `output/launchpad/mockups/<topic>/`, one line per option in `mockups/README.md`; Caio picks from pictures. Any look beat may take it | M3 | M | 🖥 | ✓ `57b6541` (`mockups/crew/`; waiting on Caio's pick, W19) |
| Q89 | **School mock-ups for [`POWERS.md`](POWERS.md)**: one Orbiter preset styled **Cape** and **Steppe** side by side (same parts and outlines, different surface detail, finish, paint and roundel), plus one signature design per school (Steppe's strap-on cluster) and each school's pad in a still. Standalone page in `mockups/`, stills to `output/launchpad/mockups/schools/`; Caio picks from pictures. Any look beat | M1 | M | 🖥 | ✓ `c6bf611` (`mockups/schools/`; waiting on Caio, W20) |
| Q24 | Cargo-bay doors mid-swing; char on dark capsule shingles | — | S | 🖥 | ✓ `7aa705c` (bay door inside + hinges; dark-paint char heat-tint) |
| Q102 | **Hardware schools** from [`POWERS.md`](POWERS.md): a school as a style parameter in `partShape`/`partBody` (outline unchanged), Cape first then Steppe; one or two signature designs per school; livery and roundel from the roll-pattern machinery; the pad per school | M1 | L | 🖥 | ✓ steps 1–5 (`90f0013`: school per part, Steppe paint, interstage cover, roundel, livery hue); steps 6–7 proposed below |
| Q159 | Q102 step 7: the **Steppe pad**: horizontal rollout on rails over a flame pit, the launch table's arms (`buildRig`/`drawPadRig`; flow's rollout screen: coordinate first) | M1 | M | 🖥 | ✓ effects beat, 2026-10-09, on W21's default (`steppeTable`, `steppeRig`; a pad per site in its owner's school; views 116–119; NOTES § "Step 7 built"; TESTING 178) |
| Q205 | **The Foundry school** (D10, POWERS 1.1.0): steel, weld rings, a tiled belly, flaps in `partShape`/`partBody`; its signature design and the catching tower | M1 | L | 🖥 | ready (plan first) |
| Q158 | Q102 step 6: signature designs per school for rivals (Cape tall stack, Steppe cluster on conical strap-ons) | — | M | 🖥 | blocked: nothing draws rivals' rockets yet |
| Q195 | **Crew look slice 1** (Caio 2026-10-09: W19 stylised human, suits by school and epoch, "start with the default"; Caio's go lifts the M3 gate for it): the astronaut figure as a mesh from the Q72 mock-up's stylised proportions, in the default suit (`SUITS` keyed by school and generation, only the default filled); two crew on a new crew access arm at the capsule's hatch on Cape's tower in the Assembly and Rollout, the arm swung back in flight; reference views | M3 | M | 🖥 | ✓ effects beat, 2026-10-09 (`app/crew-look.js`; Cape's crew arm; views 120–122; NOTES § "The crew's look, slice 1"; TESTING 184) |
| Q199 | **Suit mock-ups** (D9): Cape and Steppe, three eras each, the stylised-human crew in the Q72 scene; then one build item per school | M3 | M | 🖥 | ✓ mock-ups, effects beat 2026-10-09 (`mockups/suits/`; eight suits + role stripes; waiting on Caio, **W29**) |
| Q97 | Draw the landing leg (stowed and deployed), solar wing, body cells, battery, computer | M1 | M | 🖥 | ✓ `719d69f` (leg, wing, cells, battery, computer; views 108–111) |
| Q22 | PLAYTEST #22: `refView(8)`, the rig in close-ups | M0 | S | 🖥 | ✓ fixes (`ae3d4aa`) |

#### beat: effects — plumes, plasma, vapor, dust, explosions, debris re-entry, bloom · worktree `launchpad-aerofx` (branch `aerofx`)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q20 | PLAYTEST #17, plasma side: the shell uses terrain's `plasmaOn(s)` | M0 | S | 🖥 | ✓ `be4ff2c` (`plasmaHeat`; Q29 can run) |
| Q63 | Plasma lighting the hull; a shield-first reference view (NOTES § "Re-entry plasma") | — | S | 🖥 | ✓ `66995cd` (`plasmaLight`; views 46–47) |
| Q64 | Vapor collars on side boosters (NOTES § "Transonic vapor cones") | — | M | 🖥 | ✓ `66995cd` (`vaporLines`; views 54–56) |

#### beat: sky & bodies — atmosphere, clouds, stars, how each body looks · worktree `launchpad-sky` (new, branch `sky`, port 8802; create it on first start)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q21 | Vary `WSEED` per world: a different galaxy each playthrough | — | S | 🖥 | ✓ `9efd54e` (`PROG.gseed`, `galaxy()`) |
| Q65 | Cloud-volume shadows on the ground; a more varied deck seen from 8 km (NOTES § "Clouds with depth") | — | M | 🖥 | ✓ `7859a55` (`cloudShadowV`, `CLOUD_VARY`; +0.3–0.75 ms) |
| Q116 | PLAYTEST #32 (P3): a lander on Selene with the sun behind it is a black silhouette: a fill light (earthshine / sky) | — | S | 🖥 | ✓ `ab72a13` (`airlessFill`; views 112–113; re-run robot row 68) |
| Q71 | **Body mock-ups from [`SYSTEM.md`](SYSTEM.md)**: a still per body from its look brief, beside its two real references: Hesper, Enyo (+ Pavor), Astraea, Hyperion with rings (close, and from Tellus's sky), Theia, Eos, Tethys (haze at the limb), Erebus. As standalone page(s) in `explorations/launchpad/mockups/` (never loaded by `index.html`, so no game code and no merge risk), stills to `output/launchpad/mockups/<topic>/`, one line per option in `mockups/README.md`; Caio picks from pictures; flags what each would need from the planet shader | M5 | M | 🖥 | ✓ `92abb68` (`mockups/bodies/`; waiting on Caio, W19) |
| Q207 | **Body mock-ups, round 2** from SYSTEM.md 1.1.0 § each body "Look, round 2": Hesper day and **night side**, Enyo (redder, the volcano), Astraea (lopsided, the polar basin), Hyperion (blue winter hemisphere, hexagon, ring gap and braided ring; close and from Tellus), Eos (cycloids, tiger stripes), Tethys (thin haze, the lake glint), Erebus (backlit blue haze) **with Aether**. Same page, `mockups/bodies/` | M5 | M | 🖥 | **claimed** (sky & bodies beat, 2026-10-09); Caio picks, then Q80–Q85 |
| Q80 | Hesper's look: the cloud world (SYSTEM.md § Hesper) | M5 | M | 🖥 | **after Q207** (SYSTEM.md 1.1.0 changed the look briefs; build from the round-2 mock-ups) |
| Q81 | Enyo's look, with Pavor and Metus | M5 | M | 🖥 | **after Q207** (SYSTEM.md 1.1.0 changed the look briefs; build from the round-2 mock-ups) |
| Q82 | Astraea's look, and the belt as seen from it | M5 | M | 🖥 | **after Q207** (SYSTEM.md 1.1.0 changed the look briefs; build from the round-2 mock-ups) |
| Q83 | Hyperion's look: banding and rings, close and from Tellus's sky | M5 | M | 🖥 | **after Q207** (SYSTEM.md 1.1.0 changed the look briefs; build from the round-2 mock-ups) |
| Q84 | Hyperion's moons: Theia, Eos, Tethys (haze at the limb), Phoebe | M5 | M | 🖥 | **after Q207** (SYSTEM.md 1.1.0 changed the look briefs; build from the round-2 mock-ups) |
| Q85 | Erebus's look: the icy dwarf at the edge | M5 | S | 🖥 | **after Q207** (SYSTEM.md 1.1.0 changed the look briefs; build from the round-2 mock-ups) |

#### beat: sound — the sound block · worktree `launchpad-sound` (branch `sound`, port 8798)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q35 | **Volume slider** (it sits in flow's settings overlay Q42) | M1 | S | 🖥 | ✓ `ce44e42` (`sndSettings` in Settings, saved) |
| Q66 | Per-engine voices (pitch by size) | — | M | 🖥 | ✓ `d358a50` (`sndVoices`: St·U/D per kind of engine) |
| Q67 | Re-entry plasma crackle tuned against the heating model; spatial audio for other vessels and debris | — | M | 🖥 | ✓ `0458c99` (`sndPlasma`, `sndOthers`) |

### QA — robot playtester, tester menu, TESTING/PLAYTEST upkeep, balance runs (was playtest + tester)
Worktrees `launchpad-playtest` (branch `playtest`, port 8799), `launchpad-tester` (branch `tester`, port 8797). Playtest intake (Q60) needs no worktree: it edits docs in the main clone.
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q60 | **Standing role, playtest intake:** when Caio pastes raw feedback ("the gantry looks odd at night"), turn it into PLAYTEST items: symptom, a lead, a priority (P1–P3), an owner lane; one line per item under *Proposed* here; a TESTING row's `#` cell pointed at it if one applies. **No game code.** Never closes: start one whenever Caio has feedback | — | S | 📝 | standing |
| Q54 | **A presets-only playtest route for Caio**: the TESTING rows he can reach by flying presets, in a sensible order, so he can play before the builder is fixed. **Top priority** | M1 | S | 📝 | ✓ [`PLAYROUTE.md`](PLAYROUTE.md) (seven sittings, the first hour first) |
| Q55 | **The new-career robot run** (M1's finish line): first-run gate → first orbit → debrief, no tester flags. Written first, fails until M1 is done | M1 | M | 🖥🖥 | ✓ `b21ae52` (`node playtest.mjs m1`; fails on Q2, Q39, PLAYTEST #25/#26 until M1 lands) |
| Q28 | `shot.mjs` on the RTX (`--force_high_performance_gpu`) | M0 | S | 🖥 | ✓ `90f36a1` (RTX by default, `SHOT_IGPU=1` for the Intel) |
| Q16 | Tester cheats: any date, set funds, skip to a compute era, per-mission toggles | M0 | S | ⚙ | ✓ `6434d62` (go to day, set funds, era skip, mission toggles; TESTING row 126) |
| Q15 | PLAYTEST #15: TESTER badge over "Save as autopilot" | M0 | S | 🖥 | ✓ fixes (`ae3d4aa`) |
| Q29 | Re-run the robot on rows 104, 110, 84, 97 and the #15/#16/#17/#22 shots (M0's finish line) | M0 | S | 🖥🖥 | ✓ `e75d8d5` (clean: #15–#18, #21, #22 hold; new robot rows 97, 122; only #26 left on screen) |
| Q30 | Drivers for untried rows: docking, stations, moons first | M0 | L | 🖥🖥 | ✓ `d35f99a`: moons (68, 72, 55, 73, 125), docking (56, 58–63), stations (60 claw, 64, 66, 67, 98); left: 65, 115, 116, 117 (Proposed) |
| Q79 | Tester **"go to body" view**: a `views.js` entry per [`SYSTEM.md`](SYSTEM.md) body, drawn alone from its physical row (radius, flattening, tilt, rings) at three distances, with no orbit or SOI yet. Unblocks Q80–Q85 | M5 | M | 🖥 | ✓ (tester → Go to body, `refView(200+)`; `app/bodyview.js`; TESTING 138). Q80–Q85 can start on it |
| Q101 | Robot row for TESTING 127 (the Debrief): land, crash, End flight from orbit, the Assembly button; a shot of each | M1 | S | 🖥🖥 | ✓ `b4fc3eb` (`node playtest.mjs 127`: four ways out, exits and money checked; PLAYTEST #33) |
| Q117 | TESTING has two rows numbered 131 (Selene views; Esc pause): renumber one, fix references | — | S | 📝 | ✓ (131, 133 and 134 were each doubled: 136, 137, 138 now; next free 139) |
| Q120 | Robot driver for the last undriven station row: 65, crew rotation (Q30's leftover) | M2 | S | 🖥🖥 | ✓ `20a87e2` (`playtest.mjs 65`: crew home safe; PLAYTEST #34) |
| Q161 | A tester button for `asatTest` (and a breakup at a chosen height), so a person can see the fragment line, warnings and the cascade (v1.83) | M2 | S | 🖥 | ✓ (tester → Debris, with the off/light/real setting; TESTING 178) |
| Q129 | Parking orbits for anything meant to last (docking targets, PLAYROUTE's satellites) go above ~200 km or keep fuel: check PLAYROUTE and the presets' briefs against v1.64 decay | M1 | S | 📝 | ✓ effects 2026-10-09 (PLAYROUTE 0.1.4: sitting 6 parks at 250–300 km; contracts complete in flight, so low recon orbits still pay) |
| Q143 | PLAYROUTE sitting 1 past step 4: use the new **Beeper** and **Passenger Orbiter** presets (v1.73) | M1 | S | 📝 | ✓ effects 2026-10-09 (PLAYROUTE 0.1.3: sitting 1 flies Beeper and Passenger Orbiter; ROLL OUT) |
| Q132 | TESTING rows 139, 140, 142 are each used twice: renumber. And a robot career past year 7 wanting target/docking SAS on a probe now needs an `ocomp` (v1.68) | — | S | 📝 | ✓ effects 2026-10-09: rows renumbered (162/163 → 165/166); the `ocomp` half needs nothing today: `avCap` (sim/power.js) waives the computer under `TEST.tools` (the robot's docking rows) or with crew, and `career.mjs` sets no SAS mode. A future robot career flying target/dock SAS on an uncrewed probe must add an `ocomp` |
| Q106 | A tester view that cycles the six schools on one rocket, for screenshots | M1 | S | 🖥 | picker ✓ (tester → Hardware school; TESTING 179); the four unbuilt schools light up by themselves after Q102 steps 6–7 |

### platform — file split, test speed, saves, perf (new)
Worktree `launchpad-platform` (branch `platform`, port 8801).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q56 | Test shards: `node test.mjs --only …` and `--smoke` under a minute | M0 | S | ⚙ | ✓ `0bf85c2` (NOTES § "Test shards": `--smoke --jobs 4` ~25 s) |
| Q156 | **`.gitattributes`** (`*.md *.js *.mjs *.html text eol=lf`) and one normalising commit, announced in this file's Flags first (every branch merges `main` right after, like the split) | M1 | S | ⚙ | ✓ effects 2026-10-09: `.gitattributes` (md, js, mjs, html → LF); no file on `main` had CRs, so no normalising commit was needed |
| Q160 | **A duplicate-number check before push** (`node check_numbers.mjs`: fails on a repeated `## v1.N` in NOTES or a repeated TESTING row; in the merge recipe, or a pre-push hook). Every lane renumbers after merges today | M1 | S | ⚙ | ready (**top**) |
| Q57 | Save versions: schema version + migration chain on `launchpad-program-v1`, a test that loads an old save (independent of Q56: a second platform session may take it) | M1 | S | ⚙ | ✓ `9ca68fd` (`SAVE_V`, `MIGRATE`, `migrateSave`; test.mjs `platform-2`) |
| Q124 | **World settings for pressures** (debris, solar storms, later ones: off / light / real, chosen at world creation, saved with the world) — LATE_GAME.md § Events | M2 | S | ⚙ | ready (debris Q146–Q147 and Q57 ✓; with Q148) |
| Q58 | 📝 The split plan: modules (`sim/*.js` first, then render, ui, builder), how test.mjs loads the same files, a mechanical split script, a freeze window (Caio picks it) | M1 | M | 📝 | ✓ with Q59 |
| Q59 | The split, on the plan, in the freeze window (one commit, the full suite as the oracle) | M1 | M | ⚙ | ✓ `00e3e31` (21 classic scripts in `sim/`, `app/`; NOTES § "The file split". **Everyone: merge `main` before your next edit**) |
| Q68 | `test.mjs` into per-area files (`tests/*.mjs`, same runner and shards): every lane appends to it, the next conflict hotspot (NOTES § "The file split") | M1 | M | ⚙ | ready |
| Q69 | Split `app/gl.js` (1,532 lines) by what it draws: setup, shaders, meshes, planet/sky, plume, pad | — | M | ⚙ | after Q20 (effects is in the shaders) |
| Q70 | 📝 ES modules, one area at a time, once an area's cross-file names are few (ROADMAP § Platform step 4) | — | L | 📝 | ready (plan only) |
| Q38 | Cheap wins: world generation in a worker and cached, typed arrays in hot loops | — | M | ⚙ | ready |

### design desk — catalogs only Caio can approve (role: `docs/session-roles.md` § Design desk; docs in the main clone, no worktree)
The desk drafts by interviewing Caio; once he approves a catalog, the orchestrator fans out its build items into the lanes.

| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| D1 | **`SYSTEM.md`, the star system's catalog**, drafted with Caio (ROADMAP § "The system catalog"): one entry per body or object class: physical, orbit, look brief, ground brief, role, known or discovered. **The top unblocker** | M5 | L | 📝 | ✓ v1.0.0, approved by Caio 2026-10-08 (names are placeholders) |
| D2 | **`CREW.md`**: astronaut art direction (cartoony, realistic, stylised): write the trade-offs, ask a look session for 2–3 mock-ups in one scene, Caio picks from pictures | M3 | M | 📝 | part 2 approved; **part 1 style decided 2026-10-09: stylised human** (W19, CREW.md 0.2.1); suits open as D9 |
| D3 | **`POWERS.md`**: national flavours as content (name style, flag, hardware look, tone, rival personality) | M1 | M | 📝 | ✓ v1.0.0, approved by Caio 2026-10-08 ([`POWERS.md`](POWERS.md)); fanned out as Q102–Q106 |
| D4 | **`LATE_GAME.md`**: the shape after Selene: the network (Factorio-like, routes as belts), outposts and self-sufficiency, the tech ceiling and the interstellar probe, epochs 6+ and capstones | M4–M5 | M | 📝 | ✓ v1.0.0, approved by Caio 2026-10-08 ([`LATE_GAME.md`](LATE_GAME.md)); orchestrator: fan out (its § "What's new here") |
| Q53 | One visual identity for the screens (PLAYTEST #13; the early-era look), with flow | M1 | L | 📝 | after Q73 (mock-ups) |
| D5 | **Back to design: a rover dies when its battery runs flat at night** (`sim/rovers.js` R3: "the rover froze: it is lost"; news line `rvFieldTick`). Against **pillar 5** ("forgiving with time and failure… nothing decays into chores"), LATE_GAME § Habitats ("a dark node evacuates and goes dormant: no deaths from neglect") and v1.68's power rule (running flat never kills). Options: (a) a frozen rover goes **dormant** and wakes in the sun with a cost (lost science days, an instrument damaged); (b) keep the death, as the one deliberate exception (a cold Selene night is the rover's design problem, pillar 2), warned a day ahead; (c) death only without an RTG on airless nights, as now, but never between flights (`rvFieldTick`). **Recommend (a)**: the night stays a design problem without punishing the player for leaving a rover out | M3 | S | 📝 | **answered 2026-10-09 (Caio, design desk): dormant, no extra cost.** A rover whose battery runs flat on a cold night goes dormant and wakes when the sun returns; the night it lost is the only price. The design problem stays (an RTG or a big enough battery keeps it driving and doing science through the ~52 h night). → vehicle: build it (Proposed) |
| D6 | **Back to design: W17, a dry satellite that decays.** MIDGAME § Satellites (approved): running dry "pauses, never destroys"; v1.64 burns a dry low satellite up (warned 10 days ahead); W17 defaulted to keeping the re-entry, which makes the catalog's sentence false. Options as in W17. **Recommend:** keep the re-entry and change MIDGAME's line to "running dry pauses; only a satellite parked too low to hold its orbit comes down, warned ahead", since the builder's lifetime readout will make it a visible design choice | M2 | S | 📝 | **answered 2026-10-09 (Caio): keep the re-entry**; MIDGAME 1.0.1 now says "running dry pauses; only a satellite parked too low to hold its orbit comes down, warned ahead". W17 closed; Q125 proceeds |
| D7 | **Back to design: supply runs (v1.69) skip the automation ladder.** v1.69 lets an **uncrewed** supply run land at a Selene base from the first era, as soon as Selene was landed on by hand (`baseRunQuote`, NOTES § v1.69). [`MIDGAME.md`](MIDGAME.md) § The automation ladder (approved): Selene runs arrive with **onboard computers** (~year 7), and **the first resupply is crewed** (pilots before computers). Building on v1.69 would make the ladder false. Options: (a) **gate base runs by compute era** (`compEra()` ≥ onboard computers): one line in `baseRunQuote`, the run says "needs onboard computers"; crewed rotation stays future work; (b) keep v1.69 and amend the ladder: a landing flown by hand may be repeated in any era, like an ascent; (c) allow it early at a cost (a wider failure roll, or the trajectory office's study days scaled by era). **Recommend (a)**: it keeps "automation arrives with compute" true and costs one line; Q127 then folds it into the ladder's table. Also for Q127: today's satellite dispatch (sat/recon contracts) runs from year 0, which reads as the ladder's row 1 ("repeating an ascent"), but row 2 puts "deploying satellites to orbits you've flown" at Mainframes; say which. | M2 | S | 📝 | **answered 2026-10-09: (a)** (Caio): gate base runs by compute era; ✓ built v1.74 `029df7a` (`BASE_ERA`) |
| D8 | **Back to design (rule 8): thin air in the flight itself?** With it, every preset's 110 km parking orbit comes down within 1.4 h of flight; parking at 150 km costs +48 m/s and lasts 7.5 days. (a) as now, decay between flights only (**default**); (b) thin air in flight, presets park at 150 km, tests/robot/PLAYROUTE follow (space, NOTES § "Assessed: thin air in the flight itself") | M2 | S | 📝 | **answered 2026-10-09 (Caio): (a), like KSP, a cutoff for the air in flight**, which is what the game does now (no air above 100 km in flight). Decay between flights stays (v1.64, D6). Nothing to build; the HUD note "decays in N h after the flight" stays optional |
| D9 | **Suits by school and by era** (Caio, 2026-10-09; CREW.md § Part 1): each of the six schools gets its own suit line, changing with the epochs as real ones did (Cape: Mercury silver → Apollo white → Shuttle orange → sleek modern; Steppe: SK-1 → Sokol, Orlan for EVA). **Draft:** three launch-suit generations per school + one EVA/surface suit when EVA exists; then a look session mocks up Cape and Steppe across the eras, Caio picks, the rest follow | M3 | M | 📝 | **answered 2026-10-09 (Caio): defaults on all three** (three generations, a spacewalk suit per school, a role stripe); next: the suit mock-ups (Proposed) |
| D10 | **A seventh school and a commercial giant** (Caio, 2026-10-09): Starship-like hardware fits none of the six schools (POWERS.md). **Draft:** school **Foundry** (placeholder): bare stainless steel with weld rings, a black tiled belly, flaps instead of fins (same area: look only), huge, one diameter top to bottom; the pad is a factory beside a tower that catches boosters; retrofuturist (the 1950s pulp rocket, made real; it suits the Tintin-like crew). Plus a **commercial giant** as a rival kind: a company, not a power; iterates in public (prototypes blow up as news), undercuts launch prices, races for capstones. Questions with defaults: (1) Foundry arrives with the commercial era, late (default) or earlier; (2) the giant is its own rival kind on top of POWERS' archetypes (default) or a commercial archetype for a power; (3) the player can adopt Foundry parts when they buy from the giant (default: yes, as mixed rockets already allow) | M4 | S | 📝 | ✓ **approved 2026-10-09 (Caio): defaults**; POWERS.md 1.1.0. Orchestrator: fan out (Proposed) |

---

## Defaulted (work proceeds on these; Caio may override any; full reasons in ROADMAP § Defaults)

| # | Question | Default |
|---|---|---|
| W1 | nyxfind free on a Selene flight? | **Overridden by Caio 2026-10-08:** only a flight launched while nyxfind is open tracks Nyx; every Selene/Nyx first pays ≥ 1.3× its proven rocket (NOTES v1.53, Q8 ✓) |
| W2 | Satellite lifetimes? | Yes, a fuel lifetime; at zero the service pauses, never dies (→ Q50) |
| W3 | Flights from orbit: fee and contracts? | A reduced ops fee; may complete orbit contracts accepted before that flight |
| W4 | Selene firsts in the race? | Yes, rivals no earlier than epoch 4; re-run the v1.28 balance |
| W5 | Esc pauses? | Yes, everywhere (→ Q39) |
| W6 | Sea-specific complex? | Later (look & sound evergreen) |
| W7 | Variants or upgrades in place? | Variants (a Mk2 palette entry) |
| — | Revert and R skip the Debrief? | Yes: quick retry; the record stays under Last flight (TESTING 127) |
| — | GROUND.md decisions | All three defaults hold: maria on the near side, G1–G2 before M3, relief in real metres |
| — | `ocomp` for SAS modes? | **Caio decided 2026-10-08:** built into crew capsules; probes need the part, from the onboard-computer era on (→ Q34a) |

## Waiting on Caio (no default possible; **number W rows from the highest in this table, after a pull**)

| # | Question | Unblocks |
|---|---|---|
| W8 | Hands-on: TESTING rows 100, 108–120 and the robot's `~` rows; [`PLAYROUTE.md`](PLAYROUTE.md) is your route (Q54 ✓); sitting 1 once flow's Q2, Q39–Q41 land (QA will ping) | M1's human playtest |
| ~~W9~~ | ~~Edit the pillars~~ **answered 2026-10-08 (design desk)**: ROADMAP 1.5.0, eight pillars; 1 is now "pushing the boundary of what's possible" (the economy counts), 8 "an era, into the near future" is new, 7 tone is provisional | what sessions may turn down |
| ~~W10~~ | ~~Pick a freeze window for the file split~~ answered 2026-10-08: Caio stopped all sessions; split done | Q59 ✓ |
| ~~W11~~ | **Built v1.81.1 (economy, `58784ca`).** **Defaulted 2026-10-08 (design desk; Caio silent, may override): yes, a mission counts only on a flight launched while it was open**, as W1's rule for nyxfind. Was: should a mission count only on a flight launched while it was open? Today chained firsts complete together: the nyxfind flight also earns nyxfly (460M on one Probe), and a 2 t flight earns lift1 + lift2 | economy balance |
| W13 | M0's finish line says no open P1/P2, but #9 (the gauges) and #11 (other planets on the map) are P2 features, scoped as Q3 (M1) and Q87 (M5). **Default: they don't hold M0**; M0 closes when Q74–Q77 land | marking M0 done |
| ~~W12~~ | ~~A failed first is mostly covered, once?~~ **answered 2026-10-08: yes, option (1)**, the sponsor pays back 75 % of the first lost flight aimed at an open first; ✓ v1.55 (`coverLoss`: the priciest rocket yet stands for the attempt; once per epoch) | Q44's fix |
| W14 | *Caio leaning (2026-10-09, still deciding):* the instrument panel for the flight HUD, perhaps paperwork for the Program screen, both varying by era. **Pick a visual identity** from the mock-ups: (a) paperwork, (b) instrument panel, (c) mid-century poster, or a mix (office screens in one, cockpit in another). Open `mockups/identity/index.html` or the stills in `output/launchpad/mockups/identity/`; trade-offs in [`mockups/README.md`](mockups/README.md) | Q53, PLAYTEST #13 |
| W15 | **Read the slice 4 plan** (NOTES § UI "Slice 4 plan": the flight core, gauges, cards, toolbar). Defaults if silent: gauges beside the navball · one speed that switches at the top of the air · Keys leaves the toolbar · pins remembered per browser | Q3 build (4a–4c), PLAYTEST #9 |
| W18 | **Network screen** (NOTES § UI "Network screen plan"). Defaults if silent: its own screen (key N from the Program, once there is a second node) · a schematic, not the orbital map · the pad calendar below it, plus a compact copy in the Fleet tab | Q111 N1–N4 |
| ~~W20~~ | **Answered 2026-10-09 (Caio): yes to every round-2 twist and the companion** (SYSTEM.md 1.1.0, § each body "Look, round 2"); mock-ups round 2 = Q207. *Round 1 (Caio, 2026-10-09):* Hesper too featureless (recent images are fresher); Enyo's volcano reads as a perfect ring, redder overall; Astraea too much like the Moon; Hyperion too much like Saturn; Eos's lines unclear; Tethys featureless; Erebus needs something distinctive. Twists proposed in chat (design desk), SYSTEM look briefs to follow. **Look at the bodies** (SYSTEM.md look briefs → Q80–Q85): `explorations/launchpad/mockups/bodies/index.html`, ten views, one proposal per body with its real references and what the planet shader would need. Pick or say what to change. Defaults if silent: build from these |
| W16 | **A person who isn't you plays the first hour** (M1's finish line): PLAYROUTE sitting 1, or the new career; QA writes where they got stuck in PLAYTEST | M1 done |
| ~~W17~~ | **Answered 2026-10-09 as D6: re-entry stays.** **→ sent back to design as D6 (rule 8).** **A dry satellite that decays: re-entry, or never comes down?** MIDGAME § Satellites says running dry "pauses, never destroys"; v1.64 burns a dry low satellite up when its orbit sinks into the air (warned 10 days ahead). **Default: re-entry stays**, as the visible result of a careless design (too low, no fuel), now that a good design lasts its era (the re-tune) and the builder will show the lifetime. Override: dry satellites stop sinking at a floor and only pause | v1.64's re-entry; the builder lifetime readout |
| ~~W19~~ | **Answered 2026-10-09 (Caio): (c) stylised human**, "not a retread of KSP, but still not realistic, which allows for a lighter tone" (CREW.md 0.2.1). Was: **Pick the astronauts' look** (D2 / CREW.md part 1): open `explorations/launchpad/mockups/crew/index.html` (or the stills in `output/launchpad/mockups/crew/` on the effects machine): (a) cartoony, (b) realistic, (c) stylised human. Defaults if silent: (c), the middle the roadmap expects |
| ~~W22~~ | **Answered 2026-10-09 (Caio, design desk):** 1, 2, 4 defaults. **3 overridden:** rivals' satellites are fair game, and not only for rendezvous: **retrieving a rival's satellite** is an option, with consequences (an incident if spotted, sanctions, lost contracts, opinion), on the same stealth rules as satellite hacking (NOTES § "Satellite hacking": Tellus's shadow, small burns near the target, a window that closes when that rival gets radar). → Proposed. Was: **Station contracts (Q9's plan)**, four questions with defaults: (1) the first station as **firsts** (default) or a contract chain; (2) a resupply deadline **when supplies run out** (default) or a fixed window; (3) rendezvous with rivals' satellites **only once rivals have stations** (default) or never; (4) retrieval gives **its parts' value back** (default) or the pay only. Silence keeps the defaults | Q9's slices 1–6 (NOTES § "Plan: station, base, relay and rendezvous contracts") |
| ~~W21~~ | **Answered 2026-10-09 (Caio): both look good**; Q102 builds from them. Was: **Look at the hardware schools** (POWERS.md → Q102): `explorations/launchpad/mockups/schools/index.html`: the Orbiter as Cape and as Steppe, a signature design and the pad for each. Pick or say what to change. Defaults if silent: build Q102 from these, Cape first |
| ~~W23~~ | **Amended 2026-10-09 (Caio, to the economy session; replaces "all defaults"):** (1) the track flown (default); (2) **any foreign land, the reaction scaled by the relationship**; (3) **overflight rights as a decision from the beginning**, and rivals may refuse outright. Was: **Overflight politics (Q96's plan)**, three questions with defaults: (1) judge by the **track actually flown** (default) or the site's planned downrange; (2) **tense neighbours only** (relation < 0; default) or any foreign land; (3) overflight rights as a paid decision **later** (default) or now. Silence keeps the defaults | one ⚙ slice (S): `R.over`, the cost, the debrief line (NOTES § "Plan: overflight politics") |
| ~~W24~~ | **Answered 2026-10-09 (Caio): all defaults.** Was: **The roster (crew plan: Q133, Q135–Q137)**, four questions with defaults: (1) the first class when **the abort tests open** (default) or from the first passenger hop; (2) a class every **2 program years**, 3 people + 1 per centre level (default); (3) names as **given + family name** in home's school style (default); (4) crewed flights **blocked until requalification** after a loss (default), with the closed power's skip decision. Silence keeps the defaults | the roster's 5 slices (NOTES § "Plan: the roster, the astronaut office, requalification…") |
| ~~W25~~ | **Answered 2026-10-09 (Caio): all defaults.** **(3) the hall's bays: PARKED until Caio playtests it** (he likes going back to the build screen, KSP's loop; bays as capacity could take that away). Q123's bay slice waits; ×1.6 and home sites stand. Was: **Money buys capacity (Q123's plan)**, three questions with defaults: (1) each new unit of capacity costs **×1.6** the last (default) or ×1.3; (2) **new home sites** buildable (default) or leases only; (3) the hall's parallel **bays** as capacity (default). Silence keeps the defaults | Q123's slices (M4) |
| ~~W26~~ | **Answered 2026-10-09 (Caio):** 2, 3, 4 defaults. **1 overridden: rivals are programs from the start**, simplified early if need be (a coarse budget → capacity → progress from epoch 1, replacing the seeded schedules; keep the early race's pacing as the tuning target). Was: **Rivals as programs (Q138's plan)**, four questions with defaults: (1) programs replace the seeded schedules **from epoch 6 only** (default) or the whole race; (2) scarce places **held by building first** (default) or a claims lottery; (3) the world's mood eras **from tension and the date** (default) or a fixed sequence; (4) commercial rivals **undercut contract pay** (default) or race for firsts only. Silence keeps the defaults | Q138's slices (M4) |
| ~~W27~~ | **Amended 2026-10-09 (Caio, to the economy session; replaces "all defaults"):** (1) routines as repeating dispatches, **ordered each time at first; a route may repeat after 3 clean hand-ordered runs and when the automation ladder allows its kind in the computing era**; (2) physical cargo, measured (default, confirmed); (3) lowest share (default); (4) depots sell to rivals **depending on the depot owner's relationship with that rival**. Was: **Goods on routines (Q110's plan)**, four questions with defaults: (1) routines as **repeating dispatches with a period and a window** (default) or ordered each time; (2) goods **as physical cargo, measured** (default) or abstract tonnage; (3) self-sufficiency as **the lowest share** (default) or an average; (4) depots **sell to rivals from the start** (default) or only in the commercial era. Silence keeps the defaults | Q110's slices (M3–M4) |
| ~~W28~~ | **Answered 2026-10-09 (Caio): all defaults.** Was: **Missions per body (Q88's plan)**, four questions with defaults: (1) epochs as SYSTEM.md has them (**6 near planets, 7 belt and Hyperion, 8 the edge**); (2) every body gets the **flyby → orbit → landing** ladder before its signature problem; (3) pay by the **1.3× proven-rocket floor** (v1.53); (4) Erebus **found by a survey** like Nyx. Silence keeps the defaults | Q88's slices (M5) |
| W29 | **Look at the suits** (D9 → Q199): `explorations/launchpad/mockups/suits/index.html`, or the stills in `output/launchpad/mockups/suits/` (`sheet-wide.png`, `sheet-close.png`, `role-*.png`): Cape and Steppe, early / middle / late / spacewalk, and the role stripes (pilot blue, scientist green, engineer yellow; blue is weak on the Sokol). Pick or say what to change. Defaults if silent: build these into `SUITS`, Cape then Steppe | the per-school suit build (after Q199) |

## Proposed (sessions add follow-ups here; the orchestrator ranks them)
- space — **Q27 and Q173 are unblocked** by v1.105 (the Probe makes its own power): rank them (space, 2026-10-09)
- vehicle — **Q152's lander** (on `builder`, unmerged) is "the Probe with legs": rebuild it from v1.105's v2 Probe (body cells on its upper tank) when you resume — NOTES § v1.105 (space, 2026-10-09)

- QA — re-run `node playtest.mjs 147` (the steep and the gentle ascent) on the Passenger Orbiter's nose cone; tick TESTING 147 and PLAYTEST #35 — Q201 v1.73.1
- look & sound (from effects, Q195) — **the crew walk out and board**: in a crewed flight's countdown (or its first seconds on the pad) the two cross the access arm and go in through the hatch, then the arm swings back; and **crew access on Steppe's pad** (the service half's lift and deck). The suit lines themselves are Q199's (mock-ups, then a build item per school). M, 🖥

- ~~QA — Q194: a tester switch for the hardware school~~ already done as Q106's picker (tester → Hardware school, TESTING 179)
- flow (Q157, v1.103) — drag a queued node in time along its own leg (today only the first node; the map's pick knows the current leg only) — NOTES § v1.103
- flow (from economy, Q185 v1.104): the pad calendar's new `kind 'window'` bar (a dispatch waiting for its window, the pad held) has no `.cbar.window` style, and `app/network.js`'s fallback still builds one bar per dispatch (NOTES § v1.104)
- platform (from economy, 2026-10-09): **version numbers collide like TESTING rows did** — v1.102 and v1.103 were each taken twice within the hour (space/economy/flow). A qa-3-style check (NOTES `## v1.N` headings unique) would catch it at merge time
