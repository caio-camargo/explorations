# Launchpad — work queue
**Version**: 0.1.7 · **Author**: Caio Camargo + Claude (orchestrator session) · **Created**: 2026-10-08 · **Updated**: 2026-10-08 · **Status**: live
**Purpose**: So that every launchpad session always has a next thing to do, without Caio having to decide it each time.
Kept by the **orchestrator session**, which refreshes it about every 30 minutes (pull, read claims and the log, strike
done items, add follow-ups, push). Sources: NOTES "Next"/"Not yet" lines, [`PLAYTEST.md`](PLAYTEST.md), [`TESTING.md`](TESTING.md),
`SESSION_LOG.md` next steps. This file is the short list; [`ROADMAP.md`](ROADMAP.md) is what refills it (milestones,
lanes, evergreen work); the long tail stays in NOTES.

---

## Next unblockers (ROADMAP rule 6; Caio asks "what are the next unblockers?")

| # | Item | Who | What it frees |
|---|---|---|---|
| 1 | **M0's last bugs**: Q74 (#24, P1), Q77 (#27), Q75 and Q76 (#25, #26). Q29's re-run was clean (`e75d8d5`) | vehicle (Q74, Q77), flow (Q75, Q76, in progress) | **M0 done** (finish line: no open P1/P2; see W13), M1 becomes current |
| 2 | **M1's robot run** (`node playtest.mjs m1`): still fails on Q39, Q75, Q76 (flow, in progress) | flow | M1's finish line; your W8 pass on PLAYROUTE sitting 1 |
| 3 | **Mock-ups → your picks**: Q71 bodies, Q72 crew, Q73 screen identity, Q89 hardware schools | effects and flow tonight, then you | Q80–Q85, D2 `CREW.md`, Q53, Q102 |
| 4 | **Q34a** the power budget (computer, solar, battery) | vehicle | Q27, Q50 (space), Q97 (drawing the parts), Q98 |
| 5 | **Q79** the tester's "go to body" view | QA | Q80–Q85, then GROUND G7+ (Q92) |

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
- **Version numbers:** latest on `main` is v1.59 (economy). Check the latest `## v1.N` on `origin/main` right before numbering.
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
- **The milestone gate (ROADMAP):** code only for **M0 (stabilize, current)** and **M1 (the first hour, next)**, plus the
  space lane's M2 groundwork. M3+ items (crater landing, Selene terrain, crew) are 📝 plan items only.

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
| Q41 | **First-run:** each career choice explained in one sentence | M1 | S | 🖥 | → flow 2026-10-08 |
| Q42 | A **settings** overlay: volume, graphics quality, tester off (the volume slider itself is Q35) | M1 | S | 🖥 | ready |
| Q40 | **What to do next:** the Program screen always shows one suggested contract and why | M1 | M | 🖥 | ready |
| Q1 | PLAYTEST **#8**: the readout covers the tabs | M0 | S | 🖥 | ✓ fixes (`ae3d4aa`) |
| Q3 | **Slice 4** flight core and cards; place the gauges; closes PLAYTEST #9 | M1 | L | 📝→🖥 | ready (plan only tonight; build after Caio reads it) |
| Q4 | **Slice 5, Rollout**: site picker and launch checks out of Assembly | M1 | M | 🖥 | ready |
| Q62 | Pick a landing site on the map: a click on Selene/Nyx → `site` for the procedure (bodies' `landAt`) | M2 | S | 🖥 | ready |
| Q43 | Watch mode for a dispatched flight (fly the same procedure on screen) | M2 | M | 🖥 | after Q3 |
| Q99 | Flight results off the `#news` ticker now that the Debrief shows them; the Inbox collects what's left (NOTES § UI "What each screen shows") | M1 | S | 🖥 | ready |
| Q100 | Keep the last Debrief across reloads (`PROG.lastDebrief`) | M1 | S | ⚙ | after Q57 (save versions) |
| Q98 | A key to deploy legs and wings (`G` if free) | M1 | S | 🖥 | after Q31 |
| Q104 | Flags and roundels in the UI (the world section, the race, news), from [`POWERS.md`](POWERS.md) | M1 | M | 🖥 | after Q103; with Q53 |

### economy — program, contracts, money (resume from [`HANDOFF-economy.md`](HANDOFF-economy.md))
Worktree `launchpad-economy` (branch `economy`, port 8774).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q5 | PLAYTEST **#21**: settle `missionEnd` when leaving a finished flight | M0 | S | ⚙ | ✓ fixes (`ae3d4aa`) |
| Q44 | **Epoch 1–2 pacing for a new player** (`career.mjs`: flights and days to first orbit; nothing unaffordable after one failure) | M1 | M | ⚙ | ✓ measured `d6792f2`: ~5 flights to orbit, but one failed orbit attempt breaks it → **W12** |
| Q6 | **`siteAccess(site)` → {ok, why, fee}** and `R.site` | M1 | M | ⚙ | ✓ v1.56 `876a197` (leases by relations, sea 4M, members free; fee on the debrief) |
| Q7 | Ballistic contract target from the flight's site (still `rg/600` from +X) | M1 | S | ⚙ | ✓ v1.57 `d9badbc` (from the program's site; counts only from there) |
| Q8 | Ladder balance: Selene/Nyx firsts above their rocket; nyxfind not free on the farside flight (Caio overrode the W1 default) | M1 | S | ⚙ | ✓ economy v1.53 (Nyx found only by looking; pay floor 1.3×) |
| Q45 | Every offer says **why it appeared**, in one line | M1 | S | ⚙ | ✓ v1.59 `b18db73` (`whyOf`: the strongest true reason, kept on the offer) |
| Q46 | Dry runs as the trajectory office's study: a `procAdopt(stack)` button (days, price), a wider estimate for `prov`, the measured margin cached | M2 | S | ⚙ | ready |
| Q10 | Rover part prices and era gates; price R4's science contracts (NOTES § R4) | M2 | S | ⚙ | ready |
| Q61 | Dispatch to a base: pass the base's `pf` as the landing `site` (procedures land within ~5 m) | M2 | S | ⚙ | ready |
| Q9 | Station, base, relay and rendezvous contracts | M2 | L | 📝 | ready (plan first) |
| Q88 | 📝 Missions per body from [`SYSTEM.md`](SYSTEM.md) (each body's *role*): firsts, science, the race, which epoch opens each | M5 | M | 📝 | ready (plan only) |
| Q103 | **Powers as content** from [`POWERS.md`](POWERS.md): school and government forms in `makePowers` (+ People's Republic, Emirate, Sultanate, State), syllable sets per school, rival news rules and headline tone per archetype | M1 | M | ⚙ | ready |
| Q93 | Contract pay floors by world: in a frugal world a company at the floor can't earn its way back with sounding work (NOTES § Epoch 1–2 pacing) | M1 | S | ⚙ | ready |
| Q95 | Dispatched flights from a site abroad pay its lease (`orderDispatch`; procedures fly from their recorded site) (NOTES v1.56) | M2 | S | ⚙ | ready |
| Q96 | 📝 Overflight politics: launching over a neighbour (`site.downrange.over`) costs opinion or needs consent. Check it against ROADMAP § Pillars first | M2 | M | 📝 | ready (plan only) |
### vehicle — parts, construction screen, attitude, aero, heating, nodes (was builder + control)
Worktrees `launchpad-builder` (branch `builder`, port 8772), `launchpad-control` (branch `control`, port 8796).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q74 | **PLAYTEST #24 (P1): Beeper and Passenger Orbiter presets** (the Orbiter with `sci` / `bio` for `pod`): the presets-only first hour can't fly the first orbit missions without them. **Top** | M1 | S | ⚙ | ready |
| Q77 | PLAYTEST #27: `builder.js` `overlay()` draws "NaN%" joint labels on the Program screen after a flight (missing `atHQ` check) | M1 | S | 🖥 | ready |
| Q47 | **The construction screen usable by a newcomer**: walk building an Orbiter from scratch, fix what's unclear; Caio reviews. **Top priority: it blocks Caio's own playtesting** | M1 | M | 🖥 | ready |
| Q48 | The builder **warns before launch**: won't reach the contract's orbit, TWR < 1, no chute on a crewed return | M1 | S | ⚙ | ready |
| Q32 | The escape tower gets its own palette category | M1 | S | 🖥 | ready |
| Q31 | Landing legs part (`footPoints` already takes their feet) | M1 | S | ⚙ | → vehicle 2026-10-08 |
| Q78 | A **Docking** preset (probe core, port, RCS quads, gas): makes TESTING 58–67, 98, 116 reachable without the builder (PLAYROUTE § Not on this route) | M2 | S | ⚙ | ready |
| Q14 | PLAYTEST #18 + #23 | M0 | S | ⚙ | ✓ `0c2e701` (v1.51.1) |
| Q33 | Maneuver nodes: chains, beyond an SOI change, finite-burn centroid correction | M2 | M | ⚙ | ready |
| Q34a | Onboard computer, solar panels (body cells + a deployable wing), battery, and a steady-state power budget in the builder; running flat pauses, never kills. From the onboard-computer era, SAS modes need an `ocomp` on board (defaulted, Caio may override); presets and the robot get one (NOTES § "Vehicle parts") | M2 | M | ⚙ | ready |
| Q34b | Radiators + the steady-state orbital thermal solve; build alongside economy's orbital datacenter (NOTES § "Vehicle parts") | M2 | M | ⚙ | after Q34a |
| Q36 | Heat conduction between parts; heating from an engine's own plume (evergreen) | — | M | ⚙ | ready |
| Q37 | Hypersonic capsule lift in the impact predictor (evergreen) | — | M | ⚙ | ready |

### space — bodies, orbits, registry, procedures, docking, stations, rovers, the link (was bodies + sats + planning)
Worktrees `launchpad-sats` (branch `sats`), `launchpad-bodies` (branch `bodies`, port 8777; on `pc_de_varginha`), `launchpad-planning2` (branch `planning`, port 8775).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q11 | `dispatchRun`: dispatch flown, not rolled; dry runs | M2 | M | ⚙ | ✓ bodies (`a94ea97`) |
| Q12 | Deviation rules + the climb's corridor | M2 | S | ⚙ | ✓ bodies (`c1d7afb`) |
| Q50 | **Station-keeping as a fuel lifetime** (W2 default): propellant at zero → the satellite drifts and its service pauses, never dies | M2 | M | ⚙ | → space 2026-10-08 (reads Q34a's power budget once it lands) |
| Q25 | **Orbital decay** for low satellites (unblocks reboost) | M2 | M | ⚙ | ready |
| Q26 | **Contact with debris** and between satellites (unblocks grabbing debris) | M2 | M | ⚙ | ready |
| Q27 | Relay range and power | M2 | M | ⚙ | after Q34a (reads its power budget and `hasComputer(s)`; one shared "paused because…" field) |
| Q49 | **Missions in flight**: every vessel coasting at flight end joins the registry, on rails across bodies, raising events | M2 | L | 📝 | ready (plan first) |
| Q51 | Data as a volume + the link budget | M2 | L | 📝 | ready (plan first) |
| Q87 | 📝 **The system on rails** from [`SYSTEM.md`](SYSTEM.md): Helios as the root (today Tellus is), each planet's orbit and SOI, time scales; and the cheap early part, the other planets on the map from epoch 1 (PLAYTEST #11) | M5 | L | 📝 | ready (plan only) |
| Q13 | Landing on a chosen crater | M3 | M | ⚙ | ✓ bodies (`site`, `landAt`: 5 m on Selene and Nyx; recorded landings return to their spot) |

### world — the planet, sites, geography, Selene's ground (was terrain)
Worktree `launchpad-terrain` (branch `terrain`, port 8773).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| — | Atlas view (biomes, coasts, borders) | M1 | M | 🖥 | ✓ merged as v1.52 (`c227ed6`) |
| Q17 | PLAYTEST #17, Link side: blackout gated on airspeed (`PLASMA_V`, `plasmaOn`) | M0 | S | ⚙ | ✓ `c227ed6` |
| Q19 | Cost of low grazing views (8.8 ms over rugged hills): M1 needs a steady frame rate at the default site | M1 | M | 🖥 | ready |
| Q52 | Terrain look: coasts too smooth, the pad terrace, monotone ice ranges, lost salt flats and wetlands (NOTES § v1.25 "Next session" #3) | — | M | 🖥 | ready (evergreen) |
| Q18 | Selene terrain: craters, maria, slopes, shadows, horizons | M3 | L | 📝 | ✓ plan: [`GROUND.md`](GROUND.md) (with Q86) |
| Q86 | 📝 Ground per body from [`SYSTEM.md`](SYSTEM.md)'s ground briefs: which generator each needs (craters, dunes, ice, none for Hesper and Hyperion), shared with Q18 | M5 | L | 📝 | ✓ plan: [`GROUND.md`](GROUND.md) (with Q18) |
| — | GROUND.md **G1**, the body-ground layer (no new relief) | M3 | M | ⚙ | ✓ v1.54 `5cdf43d` |
| Q90 | GROUND.md **G2**: Selene's baked map + crater bands on the CPU, `study_ground.mjs` (`geoAt` on the bake moved to G3) | M3 | M | ⚙ | ✓ v1.58 `dd8f459` |
| Q91 | GROUND.md **G3–G6**: the march on Selene, shadows, consumers (with space for `landAt`), Nyx | M3 | L | 🖥 | after G2; **milestone gate**: code waits until M2 is current (M3 is next then) |
| Q92 | GROUND.md **G7+**: per-planet ground (Enyo → Hesper → Astraea → Hyperion's moons → Erebus → seeded lumps) | M5 | L | 🖥 | after Q91 and Q79 |
| Q105 | The pad site per school (cove, ridge, coast, steppe), if it touches terrain ([`POWERS.md`](POWERS.md)) | M1 | S | 🖥 | after Q102 |

### look & sound — always run as beats, one session each (ROADMAP § Lanes, "Beats")
Collisions between beats: `render()`'s pass order, shared shader helpers, bloom, `views.js` numbering. Changing any of them needs an `ACTIVE_WORK.md` line.

#### beat: parts & pad — `partShape`/`partBody`, textures, marks, the complex and rig · worktree `launchpad-visuals` (branch `visuals`, port 8776)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q23 | Draw the nozzle gimbal (`p.gv`) and steerable fins (`p.fd`); give `rwheel` its own look | M1 | M | 🖥 | ready |
| Q72 | **Crew mock-ups for D2**: one scene (the capsule hatch on the pad walkway), three astronaut styles in the same pose: **cartoony** (Kerbal-like), **realistic**, **stylised human** (1960s illustration, Thunderbirds, Tintin); a wide still and a helmet close-up each. Trade-offs: ROADMAP § "Design catalogs". As standalone page(s) in `explorations/launchpad/mockups/` (never loaded by `index.html`, so no game code and no merge risk), stills to `output/launchpad/mockups/<topic>/`, one line per option in `mockups/README.md`; Caio picks from pictures. Any look beat may take it | M3 | M | 🖥 | ready (effects overflow, after Q63) |
| Q89 | **School mock-ups for [`POWERS.md`](POWERS.md)**: one Orbiter preset styled **Cape** and **Steppe** side by side (same parts and outlines, different surface detail, finish, paint and roundel), plus one signature design per school (Steppe's strap-on cluster) and each school's pad in a still. Standalone page in `mockups/`, stills to `output/launchpad/mockups/schools/`; Caio picks from pictures. Any look beat | M1 | M | 🖥 | ready (effects overflow, after Q71) |
| Q24 | Cargo-bay doors mid-swing; char on dark capsule shingles | — | S | 🖥 | ready |
| Q102 | **Hardware schools** from [`POWERS.md`](POWERS.md): a school as a style parameter in `partShape`/`partBody` (outline unchanged), Cape first then Steppe; one or two signature designs per school; livery and roundel from the roll-pattern machinery; the pad per school | M1 | L | 🖥 | after Q89 (mock-ups); plan first |
| Q97 | Draw the landing leg (stowed and deployed), solar wing, body cells, battery, computer | M1 | M | 🖥 | after Q31 (legs), Q34a (the rest) |
| Q22 | PLAYTEST #22: `refView(8)`, the rig in close-ups | M0 | S | 🖥 | ✓ fixes (`ae3d4aa`) |

#### beat: effects — plumes, plasma, vapor, dust, explosions, debris re-entry, bloom · worktree `launchpad-aerofx` (branch `aerofx`)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q20 | PLAYTEST #17, plasma side: the shell uses terrain's `plasmaOn(s)` | M0 | S | 🖥 | ✓ `be4ff2c` (`plasmaHeat`; Q29 can run) |
| Q63 | Plasma lighting the hull; a shield-first reference view (NOTES § "Re-entry plasma") | — | S | 🖥 | → aerofx 2026-10-08 |
| Q64 | Vapor collars on side boosters (NOTES § "Transonic vapor cones") | — | M | 🖥 | → aerofx 2026-10-08 (Q63 also in progress, verified, not merged) |

#### beat: sky & bodies — atmosphere, clouds, stars, how each body looks · worktree `launchpad-sky` (new, branch `sky`, port 8802; create it on first start)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q21 | Vary `WSEED` per world: a different galaxy each playthrough | — | S | 🖥 | ready |
| Q65 | Cloud-volume shadows on the ground; a more varied deck seen from 8 km (NOTES § "Clouds with depth") | — | M | 🖥 | ready |
| Q71 | **Body mock-ups from [`SYSTEM.md`](SYSTEM.md)**: a still per body from its look brief, beside its two real references: Hesper, Enyo (+ Pavor), Astraea, Hyperion with rings (close, and from Tellus's sky), Theia, Eos, Tethys (haze at the limb), Erebus. As standalone page(s) in `explorations/launchpad/mockups/` (never loaded by `index.html`, so no game code and no merge risk), stills to `output/launchpad/mockups/<topic>/`, one line per option in `mockups/README.md`; Caio picks from pictures; flags what each would need from the planet shader | M5 | M | 🖥 | ready (effects overflow, after Q72) |
| Q80 | Hesper's look: the cloud world (SYSTEM.md § Hesper) | M5 | M | 🖥 | after Q79; after Caio picks from Q71 |
| Q81 | Enyo's look, with Pavor and Metus | M5 | M | 🖥 | after Q79; after Caio picks from Q71 |
| Q82 | Astraea's look, and the belt as seen from it | M5 | M | 🖥 | after Q79; after Caio picks from Q71 |
| Q83 | Hyperion's look: banding and rings, close and from Tellus's sky | M5 | M | 🖥 | after Q79; after Caio picks from Q71 |
| Q84 | Hyperion's moons: Theia, Eos, Tethys (haze at the limb), Phoebe | M5 | M | 🖥 | after Q79; after Caio picks from Q71 |
| Q85 | Erebus's look: the icy dwarf at the edge | M5 | S | 🖥 | after Q79; after Caio picks from Q71 |

#### beat: sound — the sound block · worktree `launchpad-sound` (branch `sound`, port 8798)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q35 | **Volume slider** (it sits in flow's settings overlay Q42) | M1 | S | 🖥 | after Q42 |
| Q66 | Per-engine voices (pitch by size) | — | M | 🖥 | ready |
| Q67 | Re-entry plasma crackle tuned against the heating model; spatial audio for other vessels and debris | — | M | 🖥 | ready |

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
| Q30 | Drivers for untried rows: docking, stations, moons first | M0 | L | 🖥🖥 | plan ✓; slice 1 moons ✓ `90f36a1` (rows 68, 72, 55, 73, 125); slices 2 docking, 3 stations ready |
| Q79 | Tester **"go to body" view**: a `views.js` entry per [`SYSTEM.md`](SYSTEM.md) body, drawn alone from its physical row (radius, flattening, tilt, rings) at three distances, with no orbit or SOI yet. Unblocks Q80–Q85 | M5 | M | 🖥 | ready (the milestone gate allows it: SYSTEM.md § fan-out) |
| Q101 | Robot row for TESTING 127 (the Debrief): land, crash, End flight from orbit, the Assembly button; a shot of each | M1 | S | 🖥🖥 | ready |
| Q106 | A tester view that cycles the six schools on one rocket, for screenshots | M1 | S | 🖥 | after Q102 |

### platform — file split, test speed, saves, perf (new)
Worktree `launchpad-platform` (branch `platform`, port 8801).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q56 | Test shards: `node test.mjs --only …` and `--smoke` under a minute | M0 | S | ⚙ | ✓ `0bf85c2` (NOTES § "Test shards": `--smoke --jobs 4` ~25 s) |
| Q57 | Save versions: schema version + migration chain on `launchpad-program-v1`, a test that loads an old save (independent of Q56: a second platform session may take it) | M1 | S | ⚙ | ready |
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
| D2 | **`CREW.md`**: astronaut art direction (cartoony, realistic, stylised): write the trade-offs, ask a look session for 2–3 mock-ups in one scene, Caio picks from pictures | M3 | M | 📝 | after Q72 (mock-ups) |
| D3 | **`POWERS.md`**: national flavours as content (name style, flag, hardware look, tone, rival personality) | M1 | M | 📝 | ✓ v1.0.0, approved by Caio 2026-10-08 ([`POWERS.md`](POWERS.md)); fanned out as Q102–Q106 |
| D4 | **`LATE_GAME.md`**: the shape after Selene: the network (Factorio-like, routes as belts), outposts and self-sufficiency, the tech ceiling and the interstellar probe, epochs 6+ and capstones | M4–M5 | M | 📝 | ✓ v1.0.0, approved by Caio 2026-10-08 ([`LATE_GAME.md`](LATE_GAME.md)); orchestrator: fan out (its § "What's new here") |
| Q53 | One visual identity for the screens (PLAYTEST #13; the early-era look), with flow | M1 | L | 📝 | after Q73 (mock-ups) |

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
| — | `ocomp` for SAS modes? | Yes, from the onboard-computer era on (→ Q34a) |

## Waiting on Caio (no default possible)

| # | Question | Unblocks |
|---|---|---|
| W8 | Hands-on: TESTING rows 100, 108–120 and the robot's `~` rows; [`PLAYROUTE.md`](PLAYROUTE.md) is your route (Q54 ✓); sitting 1 once flow's Q2, Q39–Q41 land (QA will ping) | M1's human playtest |
| ~~W9~~ | ~~Edit the pillars~~ **answered 2026-10-08 (design desk)**: ROADMAP 1.5.0, eight pillars; 1 is now "pushing the boundary of what's possible" (the economy counts), 8 "an era, into the near future" is new, 7 tone is provisional | what sessions may turn down |
| ~~W10~~ | ~~Pick a freeze window for the file split~~ answered 2026-10-08: Caio stopped all sessions; split done | Q59 ✓ |
| W11 | **Defaulted 2026-10-08 (design desk; Caio silent, may override): yes, a mission counts only on a flight launched while it was open**, as W1's rule for nyxfind. Was: should a mission count only on a flight launched while it was open? Today chained firsts complete together: the nyxfind flight also earns nyxfly (460M on one Probe), and a 2 t flight earns lift1 + lift2 | economy balance |
| W13 | M0's finish line says no open P1/P2, but #9 (the gauges) and #11 (other planets on the map) are P2 features, scoped as Q3 (M1) and Q87 (M5). **Default: they don't hold M0**; M0 closes when Q74–Q77 land | marking M0 done |
| ~~W12~~ | ~~A failed first is mostly covered, once?~~ **answered 2026-10-08: yes, option (1)**, the sponsor pays back 75 % of the first lost flight aimed at an open first; ✓ v1.55 (`coverLoss`: the priciest rocket yet stands for the attempt; once per epoch) | Q44's fix |
| W14 | **Pick a visual identity** from the mock-ups: (a) paperwork, (b) instrument panel, (c) mid-century poster, or a mix (office screens in one, cockpit in another). Open `mockups/identity/index.html` or the stills in `output/launchpad/mockups/identity/`; trade-offs in [`mockups/README.md`](mockups/README.md) | Q53, PLAYTEST #13 |

## Proposed (sessions add follow-ups here; the orchestrator ranks them)
- world — GROUND.md G3.0: `ptan`/`patan` in the crater bands' cube-cell geometry and `fround(λ)`, CPU only (heights move < 1 cm); the first step of Q91, headless, so it could go before the gate (orchestrator's call) — GROUND.md § G3: the port plan
- platform → world — Q57 (save versions) is a prerequisite for Selene's ground going live: landed things on Selene need re-seating onto the relief, keyed on a save version — GROUND.md § G3, going live
- space — **Q49's plan** (missions in flight) should include LATE_GAME.md § "Keeping flight in play": the fleet strip and "no silent misses" (an unplanned chance worth a burn stops time, once) — LATE_GAME.md
- space — 📝 a **cycler study**: a Tellus–Enyo cycler on our rails (Aldrin geometry at 1.52 TU), Δv to maintain it, taxi rendezvous Δv — LATE_GAME.md § "The interplanetary network" (M5)
- vehicle + space — 📝 plausible **fusion propulsion** as a late part family, sharing low-thrust propagation with NEP — LATE_GAME.md § ceiling, TECH_SCOUTING (M5+)
- economy — 📝 **goods on routines** (propellant, supplies, crew, hardware), outposts' self-sufficiency and exports, capstones and records for epochs 6–10 — LATE_GAME.md (M4–M5)
- flow — 📝 the **network screen** (nodes, routes, t/y, the named bottleneck) beside the pad calendar — LATE_GAME.md (M4+)
- economy — PLAYTEST #28 (P2): staged pay goes to a mission nobody flew (a craft already at the body collects shares as missions unlock) — PLAYTEST #28
- economy — PLAYTEST #29 (P3): weighing Nyx and the flyby pay on one flight; design call — PLAYTEST #29
- space — PLAYTEST #30 (P3): first moon orbital period logged mid-capture — PLAYTEST #30
- space/flow — PLAYTEST #31 (P2): map labels pile up at the top-left corner — PLAYTEST #31
- look & sound — PLAYTEST #32 (P3): sun-behind lander on Selene is a black silhouette (no fill light) — PLAYTEST #32
- QA — robot `m1` now passes in full on `main` (Debrief, Esc pause, no overlapping boxes): M1's robot finish line; rerun after merges that touch screens — NOTES § "Esc pauses; two more lanes"
- QA/orchestrator — TESTING has two rows numbered 131 (Selene views, line 174; Esc pause, line 213): renumber one — economy noticed
