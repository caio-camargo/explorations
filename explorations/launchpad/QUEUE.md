# Launchpad — work queue
**Version**: 0.1.4 · **Author**: Caio Camargo + Claude (orchestrator session) · **Created**: 2026-10-08 · **Updated**: 2026-10-08 · **Status**: live
**Purpose**: So that every launchpad session always has a next thing to do, without Caio having to decide it each time.
Kept by the **orchestrator session**, which refreshes it about every 30 minutes (pull, read claims and the log, strike
done items, add follow-ups, push). Sources: NOTES "Next"/"Not yet" lines, [`PLAYTEST.md`](PLAYTEST.md), [`TESTING.md`](TESTING.md),
`SESSION_LOG.md` next steps. This file is the short list; [`ROADMAP.md`](ROADMAP.md) is what refills it (milestones,
lanes, evergreen work); the long tail stays in NOTES.

---

## Next unblockers (ROADMAP rule 6; Caio asks "what are the next unblockers?")

| # | Item | Who | What it frees |
|---|---|---|---|
| 1 | **D1 `SYSTEM.md`**, the star system's catalog | design desk + **Caio approves** | one work package per body across every lane (look, ground, orbits, missions, a tester cheat); M5; PLAYTEST #11/#12 |
| 2 | **Q20** plasma shell on `plasmaOn(s)` (Q17 ✓ `c227ed6`) | look & sound, effects (in progress) | Q29, the re-run that is **M0's finish line** |
| 3 | **Q54** a presets-only playtest route for you | QA | W8, your hands-on pass: M1's human playtest |
| 4 | **D2 `CREW.md`** art direction (pick from mock-ups) | design desk + a look session + Caio | crew visuals, EVA, crew-loss tone |
| 5 | **Q3** UI slice 4 (plan first) | flow | Q43 watch mode, the gauges' final place, PLAYTEST #9 |

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
- **Version numbers:** latest on `main` is v1.53 (economy). Check the latest `## v1.N` on `origin/main` right before numbering.
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
| Q2 | **Slice 3, Debrief**: `missionEnd` → summary record → screen (NOTES § UI "Slices"). Builds on fixes' `flightLeave` | M1 | M | 🖥 | ready |
| Q39 | **Esc pauses** in flight and on every screen (W5 default) | M1 | S | 🖥 | ready |
| Q41 | **First-run:** each career choice explained in one sentence | M1 | S | 🖥 | ready |
| Q42 | A **settings** overlay: volume, graphics quality, tester off (the volume slider itself is Q35) | M1 | S | 🖥 | ready |
| Q40 | **What to do next:** the Program screen always shows one suggested contract and why | M1 | M | 🖥 | ready |
| Q1 | PLAYTEST **#8**: the readout covers the tabs | M0 | S | 🖥 | ✓ fixes (`ae3d4aa`) |
| Q3 | **Slice 4** flight core and cards; place the gauges; closes PLAYTEST #9 | M1 | L | 📝→🖥 | ready (plan first) |
| Q4 | **Slice 5, Rollout**: site picker and launch checks out of Assembly | M1 | M | 🖥 | ready |
| Q62 | Pick a landing site on the map: a click on Selene/Nyx → `site` for the procedure (bodies' `landAt`) | M2 | S | 🖥 | ready |
| Q43 | Watch mode for a dispatched flight (fly the same procedure on screen) | M2 | M | 🖥 | after Q3 |

### economy — program, contracts, money (resume from [`HANDOFF-economy.md`](HANDOFF-economy.md))
Worktree `launchpad-economy` (branch `economy`, port 8774).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q5 | PLAYTEST **#21**: settle `missionEnd` when leaving a finished flight | M0 | S | ⚙ | ✓ fixes (`ae3d4aa`) |
| Q44 | **Epoch 1–2 pacing for a new player** (`career.mjs`: flights and days to first orbit; nothing unaffordable after one failure) | M1 | M | ⚙ | ready |
| Q6 | **`siteAccess(site)` → {ok, why, fee}** and `R.site` | M1 | M | ⚙ | ready |
| Q7 | Ballistic contract target from the flight's site (still `rg/600` from +X) | M1 | S | ⚙ | ready |
| Q8 | Ladder balance: Selene/Nyx firsts above their rocket; nyxfind not free on the farside flight (Caio overrode the W1 default) | M1 | S | ⚙ | ✓ economy v1.53 (Nyx found only by looking; pay floor 1.3×) |
| Q45 | Every offer says **why it appeared**, in one line | M1 | S | ⚙ | ready |
| Q46 | Dry runs as the trajectory office's study: a `procAdopt(stack)` button (days, price), a wider estimate for `prov`, the measured margin cached | M2 | S | ⚙ | ready |
| Q10 | Rover part prices and era gates; price R4's science contracts (NOTES § R4) | M2 | S | ⚙ | ready |
| Q61 | Dispatch to a base: pass the base's `pf` as the landing `site` (procedures land within ~5 m) | M2 | S | ⚙ | ready |
| Q9 | Station, base, relay and rendezvous contracts | M2 | L | 📝 | ready (plan first) |
### vehicle — parts, construction screen, attitude, aero, heating, nodes (was builder + control)
Worktrees `launchpad-builder` (branch `builder`, port 8772), `launchpad-control` (branch `control`, port 8796).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q47 | **The construction screen usable by a newcomer**: walk building an Orbiter from scratch, fix what's unclear; Caio reviews. **Top priority: it blocks Caio's own playtesting** | M1 | M | 🖥 | ready |
| Q48 | The builder **warns before launch**: won't reach the contract's orbit, TWR < 1, no chute on a crewed return | M1 | S | ⚙ | ready |
| Q32 | The escape tower gets its own palette category | M1 | S | 🖥 | ready |
| Q31 | Landing legs part (`footPoints` already takes their feet) | M1 | S | ⚙ | ready |
| Q14 | PLAYTEST #18 + #23 | M0 | S | ⚙ | ✓ `0c2e701` (v1.51.1) |
| Q33 | Maneuver nodes: chains, beyond an SOI change, finite-burn centroid correction | M2 | M | ⚙ | ready |
| Q34 | Onboard-computer, radiator and solar-panel parts | M2 | M | ⚙ | ready |
| Q36 | Heat conduction between parts; heating from an engine's own plume (evergreen) | — | M | ⚙ | ready |
| Q37 | Hypersonic capsule lift in the impact predictor (evergreen) | — | M | ⚙ | ready |

### space — bodies, orbits, registry, procedures, docking, stations, rovers, the link (was bodies + sats + planning)
Worktrees `launchpad-sats` (branch `sats`), `launchpad-bodies` (branch `bodies`, port 8777; on `pc_de_varginha`), `launchpad-planning2` (branch `planning`, port 8775).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q11 | `dispatchRun`: dispatch flown, not rolled; dry runs | M2 | M | ⚙ | ✓ bodies (`a94ea97`) |
| Q12 | Deviation rules + the climb's corridor | M2 | S | ⚙ | ✓ bodies (`c1d7afb`) |
| Q50 | **Station-keeping as a fuel lifetime** (W2 default): propellant at zero → the satellite drifts and its service pauses, never dies | M2 | M | ⚙ | ready |
| Q25 | **Orbital decay** for low satellites (unblocks reboost) | M2 | M | ⚙ | ready |
| Q26 | **Contact with debris** and between satellites (unblocks grabbing debris) | M2 | M | ⚙ | ready |
| Q27 | Relay range and power | M2 | M | ⚙ | ready |
| Q49 | **Missions in flight**: every vessel coasting at flight end joins the registry, on rails across bodies, raising events | M2 | L | 📝 | ready (plan first) |
| Q51 | Data as a volume + the link budget | M2 | L | 📝 | ready (plan first) |
| Q13 | Landing on a chosen crater | M3 | M | ⚙ | ✓ bodies (`site`, `landAt`: 5 m on Selene and Nyx; recorded landings return to their spot) |

### world — the planet, sites, geography, Selene's ground (was terrain)
Worktree `launchpad-terrain` (branch `terrain`, port 8773).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| — | Atlas view (biomes, coasts, borders) | M1 | M | 🖥 | done on branch `76bcdcf`; merge as **v1.52** |
| Q17 | PLAYTEST #17, Link side: blackout gated on airspeed (`PLASMA_V`, `plasmaOn`) | M0 | S | ⚙ | ✓ `c227ed6` |
| Q19 | Cost of low grazing views (8.8 ms over rugged hills): M1 needs a steady frame rate at the default site | M1 | M | 🖥 | ready |
| Q52 | Terrain look: coasts too smooth, the pad terrace, monotone ice ranges, lost salt flats and wetlands (NOTES § v1.25 "Next session" #3) | — | M | 🖥 | ready (evergreen) |
| Q18 | Selene terrain: craters, maria, slopes, shadows, horizons | M3 | L | 📝 | ready (plan only) |

### look & sound — always run as beats, one session each (ROADMAP § Lanes, "Beats")
Collisions between beats: `render()`'s pass order, shared shader helpers, bloom, `views.js` numbering. Changing any of them needs an `ACTIVE_WORK.md` line.

#### beat: parts & pad — `partShape`/`partBody`, textures, marks, the complex and rig · worktree `launchpad-visuals` (branch `visuals`, port 8776)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q23 | Draw the nozzle gimbal (`p.gv`) and steerable fins (`p.fd`); give `rwheel` its own look | M1 | M | 🖥 | ready |
| Q24 | Cargo-bay doors mid-swing; char on dark capsule shingles | — | S | 🖥 | ready |
| Q22 | PLAYTEST #22: `refView(8)`, the rig in close-ups | M0 | S | 🖥 | ✓ fixes (`ae3d4aa`) |

#### beat: effects — plumes, plasma, vapor, dust, explosions, debris re-entry, bloom · worktree `launchpad-aerofx` (branch `aerofx`)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q20 | PLAYTEST #17, plasma side: the shell uses terrain's `plasmaOn(s)` | M0 | S | 🖥 | → aerofx 2026-10-08 |
| Q63 | Plasma lighting the hull; a shield-first reference view (NOTES § "Re-entry plasma") | — | S | 🖥 | ready |
| Q64 | Vapor collars on side boosters (NOTES § "Transonic vapor cones") | — | M | 🖥 | ready |

#### beat: sky & bodies — atmosphere, clouds, stars, how each body looks · worktree `launchpad-sky` (new, branch `sky`, port 8802; create it on first start)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q21 | Vary `WSEED` per world: a different galaxy each playthrough | — | S | 🖥 | ready |
| Q65 | Cloud-volume shadows on the ground; a more varied deck seen from 8 km (NOTES § "Clouds with depth") | — | M | 🖥 | ready |
| — | One look item per body | M5 | — | 🖥 | blocked: D1 approved |

#### beat: sound — the sound block · worktree `launchpad-sound` (branch `sound`, port 8798)
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q35 | **Volume slider** (it sits in flow's settings overlay Q42) | M1 | S | 🖥 | ready |
| Q66 | Per-engine voices (pitch by size) | — | M | 🖥 | ready |
| Q67 | Re-entry plasma crackle tuned against the heating model; spatial audio for other vessels and debris | — | M | 🖥 | ready |

### QA — robot playtester, tester menu, TESTING/PLAYTEST upkeep, balance runs (was playtest + tester)
Worktrees `launchpad-playtest` (branch `playtest`, port 8799), `launchpad-tester` (branch `tester`, port 8797). Playtest intake (Q60) needs no worktree: it edits docs in the main clone.
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q60 | **Standing role, playtest intake:** when Caio pastes raw feedback ("the gantry looks odd at night"), turn it into PLAYTEST items: symptom, a lead, a priority (P1–P3), an owner lane; one line per item under *Proposed* here; a TESTING row's `#` cell pointed at it if one applies. **No game code.** Never closes: start one whenever Caio has feedback | — | S | 📝 | standing |
| Q54 | **A presets-only playtest route for Caio**: the TESTING rows he can reach by flying presets, in a sensible order, so he can play before the builder is fixed. **Top priority** | M1 | S | 📝 | ready |
| Q55 | **The new-career robot run** (M1's finish line): first-run gate → first orbit → debrief, no tester flags. Written first, fails until M1 is done | M1 | M | 🖥🖥 | ready |
| Q28 | `shot.mjs` on the RTX (`--force_high_performance_gpu`) | M0 | S | 🖥 | ready |
| Q16 | Tester cheats: any date, set funds, skip to a compute era, per-mission toggles | M0 | S | ⚙ | ready |
| Q15 | PLAYTEST #15: TESTER badge over "Save as autopilot" | M0 | S | 🖥 | ✓ fixes (`ae3d4aa`) |
| Q29 | Re-run the robot on rows 104, 110, 84, 97 and the #15/#16/#17/#22 shots (M0's finish line) | M0 | S | 🖥🖥 | after Q20 merges (fixes, Q14, Q17 ✓) |
| Q30 | Drivers for untried rows: docking, stations, moons first | M0 | L | 🖥🖥 | ready (plan first; run when few others are in the browser) |

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
| D1 | **`SYSTEM.md`, the star system's catalog**, drafted with Caio (ROADMAP § "The system catalog"): one entry per body or object class: physical, orbit, look brief, ground brief, role, known or discovered. **The top unblocker** | M5 | L | 📝 | ready |
| D2 | **`CREW.md`**: astronaut art direction (cartoony, realistic, stylised): write the trade-offs, ask a look session for 2–3 mock-ups in one scene, Caio picks from pictures | M3 | M | 📝 | ready |
| D3 | **`POWERS.md`**: national flavours as content (name style, flag, hardware look, tone, rival personality) | M1 | M | 📝 | ready |
| Q53 | One visual identity for the screens (PLAYTEST #13; the early-era look), with flow | M1 | L | 📝 | ready |

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

## Waiting on Caio (no default possible)

| # | Question | Unblocks |
|---|---|---|
| W8 | Hands-on: TESTING rows 100, 108–120 and the robot's `~` rows; Q54 gives you a route | M1's human playtest |
| W9 | Edit the pillars (ROADMAP § Pillars, a draft) | what sessions may turn down |
| ~~W10~~ | ~~Pick a freeze window for the file split~~ answered 2026-10-08: Caio stopped all sessions; split done | Q59 ✓ |
| W11 | Should a mission count only on a flight launched while it was open? Today chained firsts complete together: the nyxfind flight also earns nyxfly (460M on one Probe), and a 2 t flight earns lift1 + lift2 | economy balance |

## Proposed (sessions add follow-ups here; the orchestrator ranks them)
