# Launchpad — work queue
**Version**: 0.1.0 · **Author**: Caio Camargo + Claude (orchestrator session) · **Created**: 2026-10-08 · **Updated**: 2026-10-08 · **Status**: live
**Purpose**: So that every launchpad session always has a next thing to do, without Caio having to decide it each time.
Kept by the **orchestrator session**, which refreshes it about every 30 minutes (pull, read claims and the log, strike
done items, add follow-ups, push). Sources: NOTES "Next"/"Not yet" lines, [`PLAYTEST.md`](PLAYTEST.md), [`TESTING.md`](TESTING.md),
`SESSION_LOG.md` next steps. This file is the short list; the long tail stays in NOTES.

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
> You are the launchpad **<lane>** session. Follow AGENTS.md's startup, then read `explorations/launchpad/QUEUE.md` and take
> the top ready item in your lane (overflow if none). Worktree and port: `ACTIVE_WORK.md` table.

---

## Flags (read before merging)

- **Orchestrator, 2026-10-08 (roadmap session, decided with Caio): restructure this queue from [`ROADMAP.md`](ROADMAP.md) on your next refresh.** (1) Regroup the lanes into the eight there (flow, economy, vehicle, space, world, look & sound, QA, platform), keeping item numbers. (2) Add a platform lane (worktree `launchpad-platform`, port 8801; not created yet). (3) W1–W7 now have defaults sessions build on (ROADMAP § Defaults): unblock Q8 and move them to a "Defaulted" list Caio can override. (4) Refill per ROADMAP § "Keeping the queue full": current milestone M0, next M1 (the first hour).
- **The fixes session** (worktree `launchpad-fixes`, branch `fixes`, port 8800) is sweeping PLAYTEST #15, #16, #19, #20, #21, #22.
  Q5, Q15, Q22 and parts of Q1 and Q17 are its own; ui and terrain, merge `main` after it lands.
- **Version-number collision, 2026-10-08:** control's spin stabilisation and terrain's atlas both call themselves
  **v1.51**. Control reached the main clone first (not yet pushed when this was written). **Terrain: renumber to v1.52 at
  merge.** Check the latest `## v1.N` on `origin/main` right before numbering.

---

## Lanes

States: `ready` · `→ session date` (taken) · `✓ commit` (done) · `blocked: <on what>`.
Sizes: S (hours) · M (a slice) · L (several slices; plan first).

### ui — screens, navigation, layout
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q1 | PLAYTEST **#8**: the readout covers the tabs (#16 and #20 are with the fixes session; check its merge first) | S | 🖥 | after fixes merge |
| Q2 | **Slice 3, Debrief**: `missionEnd` → summary record → screen (NOTES § UI "Slices"). Do it with Q5 | M | 🖥 | ready |
| Q3 | **Slice 4**: flight core and cards; place the aerofx gauges (`gaugeRect`); closes PLAYTEST #9 | L | 🖥 | ready |
| Q4 | **Slice 5, Rollout**: the site picker and launch checks move out of Assembly | M | 🖥 | after Q1 |

### economy — program, contracts, money (session paused: resume from [`HANDOFF-economy.md`](HANDOFF-economy.md))
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q5 | PLAYTEST **#21**: settle `missionEnd` when the player leaves a finished flight, not at the next launch (with ui's `go`) | S | ⚙ | → fixes 2026-10-08 |
| Q6 | **`siteAccess(site)` → {ok, why, fee}** and `R.site`. Unblocks sea-platform pricing, overflight politics, site closures | M | ⚙ | ready |
| Q7 | Ballistic contract target: still `rg/600` from +X (old radius, not the flight's site) | S | ⚙ | ready |
| Q8 | Ladder balance: selimp/nyxfind pay less than a Probe costs; nyxfind completes free on a Selene flight | S | ⚙ | blocked: Caio W1 |
| Q9 | Station, base, relay and rendezvous contracts (first station, resupply, lab time, crew rotation, far-side relay) | L | ⚙ | ready (plan first) |
| Q10 | Rover part prices and era gates | S | ⚙ | ready |

### bodies — body tree, procedures, missions out there
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q11 | **`dispatchRun(D, v, c)`**: a headless, seeded procedure run → {ok, orb, dv, why} or a deviation. Unblocks dispatch on real physics, watch mode, dry runs | M | ⚙ | ✓ bodies (dispatch flown; dry runs `procAdopt`; NOTES § "Dispatch, the physics side") |
| Q12 | Deviation rules in `procStep`: Δv-to-go vs Δv left ✓ (bodies, `procDev`); still open: a corridor around the recorded profile | S | ⚙ | ready |
| Q13 | Landing on a chosen crater: the capture picks its plane and periapsis longitude | M | ⚙ | ready |

### control — attitude
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q14 | PLAYTEST **#18**: a held pitch key spins the upper stage apart (size wheel storage to the vessel, or rate-limit manual input) + **#23** wording nits | S | ⚙ | → control 2026-10-08 |

### tester — the tester menu
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q15 | PLAYTEST **#15**: the TESTER badge covers "Save as autopilot" | S | 🖥 | → fixes 2026-10-08 |
| Q16 | More cheats: any date, set funds, skip to a compute era, per-mission toggles (the robot playtester wants them too) | S | ⚙ | ready |

### terrain — the world
| # | Item | Size | Load | State |
|---|---|---|---|---|
| — | Atlas view (biomes, coasts, borders) | M | 🖥 | → terrain 2026-10-08 (on branch, renumber v1.52) |
| Q17 | PLAYTEST **#17, Link side**: gate `linkOf`'s blackout on speed too; agree the threshold with Q20. (#19 is with the fixes session) | S | ⚙ | → terrain 2026-10-08 |
| Q18 | **Selene terrain**: craters, maria, slopes, shadows, horizons. Unblocks rovers on real ground | L | 🖥 | ready (plan first) |
| Q19 | Cost of low grazing views (8.8 ms over rugged hills) | M | 🖥 | ready |

### aerofx — engine and air effects
| # | Item | Size | Load | State |
|---|---|---|---|---|
| — | Spent stages re-entering | M | 🖥 | → aerofx 2026-10-08 |
| Q20 | PLAYTEST **#17, plasma side**: gate the plasma shell on speed or Mach (same threshold as Q17) | S | 🖥 | ready |
| Q21 | Vary `WSEED` per world; plasma lighting the hull | S | 🖥 | ready |

### visuals — part look, pad
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q22 | PLAYTEST **#22**: `refView(8)` throws; hide the pad rig in close-ups 4–9 | S | 🖥 | → fixes 2026-10-08 |
| Q23 | Draw the nozzle gimbal (`p.gv`) and steerable fins (`p.fd`); give `rwheel` its own look | M | 🖥 | ready |
| Q24 | Cargo-bay doors mid-swing; char on dark capsule shingles | S | 🖥 | ready |

### sats — registry, docking, stations, rovers
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q25 | **Orbital decay** for low satellites. Unblocks the reboost contract | M | ⚙ | ready |
| Q26 | **Contact with debris** and between two satellites. Unblocks the claw and arm grabbing debris | M | ⚙ | ready |
| Q27 | Relay range and power (economy's far-side relay contract wants it) | M | ⚙ | ready |

### playtest — the robot playtester
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q28 | `shot.mjs` still renders on the iGPU: add `--force_high_performance_gpu` | S | 🖥 | ready |
| Q29 | Re-run the robot on the rows the fixes touch (104, 110, 84, 97, plus the #15/#16/#17/#22 shots) **once Q1/Q5/Q14/Q15/Q17/Q20/Q22 are merged** | S | 🖥🖥 | blocked: those merges |
| Q30 | Drivers for the untried rows: docking, stations, moons first; then city flights and builder mouse work | L | 🖥🖥 | ready (run when few others are in the browser) |

### builder / planning — parts and tools
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q31 | Landing legs part (`footPoints` already takes their feet): tall stacks stop tipping on 7–12° slopes | S | ⚙ | ready |
| Q32 | The escape tower gets its own palette category (it sits under "Other") | S | 🖥 | ready |
| Q33 | Maneuver nodes: chains, nodes beyond an SOI change, a finite-burn centroid correction | M | ⚙ | ready |
| Q34 | Onboard-computer, radiator and solar-panel parts (the compute and waste-heat plans need them) | M | ⚙ | ready |

### sound
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q35 | A volume slider, then per-engine voices (pitch by size) | M | 🖥 | ready |

### Overflow — any spare session (headless, light on the GPU)
| # | Item | Size | Load | State |
|---|---|---|---|---|
| Q36 | Heat conduction between neighbouring parts; heating from an engine's own plume | M | ⚙ | ready |
| Q37 | Hypersonic capsule lift in the impact predictor | M | ⚙ | ready |
| Q38 | Native-port cheap wins: world generation in a worker, typed arrays in hot loops (claim the functions you touch) | M | ⚙ | ready |

---

## Waiting on Caio (batch these: each answer unblocks something)

| # | Question | Unblocks |
|---|---|---|
| W1 | Should nyxfind come free on a Selene flight, or need a deliberate high orbit / a higher threshold? | Q8 |
| W2 | Station-keeping and satellite lifetimes: a stationary satellite drifts 10,750 km a month under the tides. Add a lifetime/fuel mechanic? | servicing missions, reboost |
| W3 | Flights from orbit: do they pay the operations fee, and may they complete orbit contracts? | economy contracts |
| W4 | Selene and far-side firsts in the race against rivals? (shifts rival schedules and the v1.28 balance) | economy race |
| W5 | Does the Esc menu pause the game, as in KSP? | ui |
| W6 | A smaller sea-specific launch complex (tower and table only)? | visuals |
| W7 | Development: variants, or upgrades in place? | development goals, gimbal as an upgrade |
| W8 | Hands-on: TESTING rows 100, 108–118, and the robot's `~` rows (feel needs a human) | — |

## Proposed (sessions add follow-ups here; the orchestrator ranks them)

- economy — dry runs as the trajectory office's study: a button calling `procAdopt(stack)` (days, price); widen `dispatchEstimate` for a `prov` procedure; cache the dry run's measured margin as the estimate's — NOTES § "Dispatch, the physics side"
- economy — nyxfind completes for free on a Selene flight; selimp and nyxfind pay less than a Probe costs — NOTES § "The ladders, proven with real rockets"
- ui — watch mode for a dispatched flight (procFly runs headless today; a watched one would fly the same procedure on screen) — NOTES § dispatch brief

