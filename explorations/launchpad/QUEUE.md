# Launchpad — work queue
**Version**: 0.1.2 · **Author**: Caio Camargo + Claude (orchestrator session) · **Created**: 2026-10-08 · **Updated**: 2026-10-08 · **Status**: live
**Purpose**: So that every launchpad session always has a next thing to do, without Caio having to decide it each time.
Kept by the **orchestrator session**, which refreshes it about every 30 minutes (pull, read claims and the log, strike
done items, add follow-ups, push). Sources: NOTES "Next"/"Not yet" lines, [`PLAYTEST.md`](PLAYTEST.md), [`TESTING.md`](TESTING.md),
`SESSION_LOG.md` next steps. This file is the short list; [`ROADMAP.md`](ROADMAP.md) is what refills it (milestones,
lanes, evergreen work); the long tail stays in NOTES.

---

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
> You are the launchpad **<lane>** session (one of: flow, economy, vehicle, space, world, look & sound, QA, platform). Follow AGENTS.md's startup, then read `explorations/launchpad/QUEUE.md` and take
> the top ready item in your lane (overflow if none). Worktrees and ports: the heading of your lane below, or the `ACTIVE_WORK.md` lane table.

For the **playtest intake** role: *You are the launchpad QA session, playtest intake. Read QUEUE.md § QA, Q60, then turn
the feedback I paste into PLAYTEST items.*

---

## Flags (read before merging)

- **Orchestrator, 2026-10-08 (roadmap session, Caio's call): look & sound runs as several sessions by beat** (ROADMAP § Lanes, "Beats"): parts & pad, effects, sky & bodies (new worktree `launchpad-sky`, port 8802), sound. Tag each look item with its beat, keep at least 2 ready per beat, and add the beat to the kickoff line.
- **Fixes × terrain, same functions:** the fixes session (#19) and terrain (Q17) both edit near `linkOf`/`gsSees`. Whoever
  merges second: merge `main` first and re-run test.mjs's link sections.
- **Q20 waits for Q17:** terrain is adding `PLASMA_V` / `plasmaOn(s)` next to `linkOf`. Aerofx: use that for the plasma
  shell instead of a second threshold.
- **Version numbers:** control took **v1.51** (and v1.51.1). Terrain's atlas is labelled v1.51 on its branch: **renumber to
  v1.52 at merge.** Check the latest `## v1.N` on `origin/main` right before numbering.
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
| Q2 | **Slice 3, Debrief**: `missionEnd` → summary record → screen (NOTES § UI "Slices"). Builds on fixes' #21 | M1 | M | 🖥 | ready |
| Q39 | **Esc pauses** in flight and on every screen (W5 default) | M1 | S | 🖥 | ready |
| Q41 | **First-run:** each career choice explained in one sentence | M1 | S | 🖥 | ready |
| Q42 | A **settings** overlay: volume, graphics quality, tester off (the volume slider itself is Q35) | M1 | S | 🖥 | ready |
| Q40 | **What to do next:** the Program screen always shows one suggested contract and why | M1 | M | 🖥 | ready |
| Q1 | PLAYTEST **#8**: the readout covers the tabs (#16/#20 are in fixes' sweep: check after it merges) | M0 | S | 🖥 | after fixes merge |
| Q3 | **Slice 4** flight core and cards; place the gauges; closes PLAYTEST #9 | M1 | L | 📝→🖥 | ready (plan first) |
| Q4 | **Slice 5, Rollout**: site picker and launch checks out of Assembly | M1 | M | 🖥 | after Q1 |
| Q43 | Watch mode for a dispatched flight (fly the same procedure on screen) | M2 | M | 🖥 | after Q3 |

### economy — program, contracts, money (resume from [`HANDOFF-economy.md`](HANDOFF-economy.md))
Worktree `launchpad-economy` (branch `economy`, port 8774).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q5 | PLAYTEST **#21**: settle `missionEnd` when leaving a finished flight | M0 | S | ⚙ | → fixes 2026-10-08 |
| Q44 | **Epoch 1–2 pacing for a new player** (`career.mjs`: flights and days to first orbit; nothing unaffordable after one failure) | M1 | M | ⚙ | ready |
| Q6 | **`siteAccess(site)` → {ok, why, fee}** and `R.site` | M1 | M | ⚙ | ready |
| Q7 | Ballistic contract target from the flight's site (still `rg/600` from +X) | M1 | S | ⚙ | ready |
| Q8 | selimp/nyxfind pay above the cheapest proven Probe; nyxfind stays free (W1 default) | M1 | S | ⚙ | ready |
| Q45 | Every offer says **why it appeared**, in one line | M1 | S | ⚙ | ready |
| Q46 | Dry runs as the trajectory office's study: a `procAdopt(stack)` button (days, price), a wider estimate for `prov`, the measured margin cached | M2 | S | ⚙ | ready |
| Q10 | Rover part prices and era gates; price R4's science contracts (NOTES § R4) | M2 | S | ⚙ | ready |
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
| Q13 | Landing on a chosen crater | M3 | M | ⚙ | → bodies 2026-10-08 (claimed before the gate reached this queue; Caio may let it run or redirect to Q50/Q25) |

### world — the planet, sites, geography, Selene's ground (was terrain)
Worktree `launchpad-terrain` (branch `terrain`, port 8773).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| — | Atlas view (biomes, coasts, borders) | M1 | M | 🖥 | done on branch `76bcdcf`; merge as **v1.52** |
| Q17 | PLAYTEST #17, Link side: blackout gated on airspeed (`PLASMA_V`, `plasmaOn`) | M0 | S | ⚙ | → terrain 2026-10-08 |
| Q19 | Cost of low grazing views (8.8 ms over rugged hills): M1 needs a steady frame rate at the default site | M1 | M | 🖥 | ready |
| Q52 | Terrain look: coasts too smooth, the pad terrace, monotone ice ranges, lost salt flats and wetlands (NOTES § v1.25 "Next session" #3) | — | M | 🖥 | ready (evergreen) |
| Q18 | Selene terrain: craters, maria, slopes, shadows, horizons | M3 | L | 📝 | ready (plan only) |

### look & sound — part look, pad, FX, sky, sound (was visuals + aerofx + sound)
Worktrees `launchpad-visuals` (branch `visuals`, port 8776), `launchpad-aerofx` (branch `aerofx`), `launchpad-sound` (branch `sound`, port 8798).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q20 | PLAYTEST #17, plasma side: the shell uses terrain's `plasmaOn(s)` | M0 | S | 🖥 | after Q17 |
| Q35 | **Volume slider** (part 1; it sits in flow's settings overlay Q42), then per-engine voices | M1 | S | 🖥 | ready |
| Q23 | Draw the nozzle gimbal (`p.gv`) and steerable fins (`p.fd`); give `rwheel` its own look | M1 | M | 🖥 | ready |
| Q21 | Vary `WSEED` per world; plasma lighting the hull | — | S | 🖥 | ready |
| Q24 | Cargo-bay doors mid-swing; char on dark capsule shingles | — | S | 🖥 | ready |
| Q22 | PLAYTEST #22: `refView(8)`, the rig in close-ups | M0 | S | 🖥 | → fixes 2026-10-08 |
| Q53 | 📝 One visual identity for the screens (PLAYTEST #13; the early-era look), with flow | M1 | L | 📝 | ready (plan first) |

### QA — robot playtester, tester menu, TESTING/PLAYTEST upkeep, balance runs (was playtest + tester)
Worktrees `launchpad-playtest` (branch `playtest`, port 8799), `launchpad-tester` (branch `tester`, port 8797). Playtest intake (Q60) needs no worktree: it edits docs in the main clone.
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q60 | **Standing role, playtest intake:** when Caio pastes raw feedback ("the gantry looks odd at night"), turn it into PLAYTEST items: symptom, a lead, a priority (P1–P3), an owner lane; one line per item under *Proposed* here; a TESTING row's `#` cell pointed at it if one applies. **No game code.** Never closes: start one whenever Caio has feedback | — | S | 📝 | standing |
| Q54 | **A presets-only playtest route for Caio**: the TESTING rows he can reach by flying presets, in a sensible order, so he can play before the builder is fixed. **Top priority** | M1 | S | 📝 | ready |
| Q55 | **The new-career robot run** (M1's finish line): first-run gate → first orbit → debrief, no tester flags. Written first, fails until M1 is done | M1 | M | 🖥🖥 | ready |
| Q28 | `shot.mjs` on the RTX (`--force_high_performance_gpu`) | M0 | S | 🖥 | ready |
| Q16 | Tester cheats: any date, set funds, skip to a compute era, per-mission toggles | M0 | S | ⚙ | ready |
| Q15 | PLAYTEST #15: TESTER badge over "Save as autopilot" | M0 | S | 🖥 | → fixes 2026-10-08 |
| Q29 | Re-run the robot on rows 104, 110, 84, 97 and the #15/#16/#17/#22 shots (M0's finish line) | M0 | S | 🖥🖥 | after fixes, Q17, Q20 merge (Q14 ✓) |
| Q30 | Drivers for untried rows: docking, stations, moons first | M0 | L | 🖥🖥 | ready (plan first; run when few others are in the browser) |

### platform — file split, test speed, saves, perf (new)
Worktree `launchpad-platform` (branch `platform`, port 8801).
| # | Item | M | Size | Load | State |
|---|---|---|---|---|---|
| Q56 | Test shards: `node test.mjs --only …` and `--smoke` under a minute | M0 | S | ⚙ | → platform 2026-10-08 |
| Q57 | Save versions: schema version + migration chain on `launchpad-program-v1`, a test that loads an old save (independent of Q56: a second platform session may take it) | M1 | S | ⚙ | ready |
| Q58 | 📝 The split plan: modules (`sim/*.js` first, then render, ui, builder), how test.mjs loads the same files, a mechanical split script, a freeze window (Caio picks it) | M1 | M | 📝 | ready |
| Q59 | The split, on the plan, in the freeze window (one commit, the full suite as the oracle) | M1 | M | ⚙ | blocked: Q58 + Caio's window (W10) |
| Q38 | Cheap wins: world generation in a worker and cached, typed arrays in hot loops | — | M | ⚙ | ready |

---

## Defaulted (work proceeds on these; Caio may override any; full reasons in ROADMAP § Defaults)

| # | Question | Default |
|---|---|---|
| W1 | nyxfind free on a Selene flight? | Keep it free; raise selimp/nyxfind pay above the cheapest Probe (→ Q8) |
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
| W10 | Pick a freeze window for the file split, once Q58's plan is written | Q59 |

## Proposed (sessions add follow-ups here; the orchestrator ranks them)

