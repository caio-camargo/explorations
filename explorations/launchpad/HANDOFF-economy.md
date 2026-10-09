# Economy session — handoff

**Version**: v1.0.0 · **Author**: Caio Camargo + Claude (economy session) · **Created**: 2026-10-08 · **Updated**: 2026-10-08
**Purpose**: Let a new Claude session pick up the Launchpad economy work after the repo left Google Drive.
**Status**: current as of `main` = `economy` = `6b6f30b` (pushed).

---

## Start here

1. **Where:**
   - Start Claude in the worktree `C:/Users/caioa/dev/launchpad-economy` (branch `economy`).
   - The main clone is `C:/Users/caioa/dev/explorations`, synced through GitHub `caio-camargo/explorations`. It's
     **public: pushing publishes**.
   - The Drive folder `G:/Meu Drive/CLAUDE/fun` is frozen. Never work there.
2. **Read:**
   - `AGENTS.md` and `PROJECT.md`;
   - `git pull` in the main clone, then `ACTIVE_WORK.md`;
   - the last entries of `SESSION_LOG.md`;
   - this file;
   - `explorations/launchpad/NOTES.md` from `## v1.50` down to `## v1.30` (the economy's versions), and the design
     sections listed below.
3. **Preview:** `.claude/launch.json` in the worktree serves it on port **8774** (`preview_start` name
   `launchpad-economy`). The browser pane stalls timers when hidden; run JS checks without `await setTimeout`.
4. **Tests:** `node test.mjs` in `explorations/launchpad`. It takes **~8 minutes** now and must print `all passed`.

## Git workflow since the move (runbook `docs/leaving-drive.md` § "After the move")

- Commit on `economy` in the worktree.
- Merge `origin/main` (and the main clone's local `main` if it's ahead), **one branch at a time** (an octopus merge
  can't take conflicts), then test.
- In the main clone: `git pull --ff-only`, `git merge --ff-only economy`.
- **Ask Caio before pushing**, then `git push origin main economy`. A refused push means GitHub moved: merge, test and
  repeat. On 2026-10-08 it took three rounds; the other machine pushes often.
- **Shared docs are committed with the work, on the branch:** the `SESSION_LOG.md` line, the
  `explorations/README.md` launchpad row, `ACTIVE_WORK.md`, `INDEX.md`. In their conflicts keep both sides (or each
  session's newer row).
- **Version numbers collide across sessions.** Check the latest `## v1.N` on `origin/main` right before numbering, and
  again at merge. Deviation was renumbered v1.49 → v1.50 because sound took v1.49.
- **Test section numbers (`// 3x.`) collide too.** They're comment labels only; leave them.
- **Never:** `git worktree prune`, bare `git stash`, `git checkout --` on a shared doc with someone else's edits.
- **Edit gotchas:**
  - A mid-line `//` comment silently comments out the code after it. It happened twice this session, once in
    `test.mjs`.
  - Python heredocs with apostrophes break in the Bash tool, so write the script to a scratch file instead.
  - Write files with LF (`newline='\n'`).

## What the economy owns (`index.html`, SIM block)

| Area | Versions | Key names |
|---|---|---|
| Missions, contracts, budget, calendar, powers, ownership, race, career moves, flavours | ≤ v1.26 | `MISSIONS`, `CT`, `econTick`, `ARCH`/`flav`, `own()` |
| Industry: sources, know-how, production lines | v1.27–v1.31 | `sourceOf`, `khUse`/`khLearn`/`igniteOK`, `prodLine`/`startProdLine` |
| Test stand, development, facilities | v1.33–v1.35 | `PROG.stand2`, `devQuote`/`startDev`, `FAC` (hall, fleet, centre, pads), `facilitiesHTML` |
| Balance pass 3 (money sinks) | v1.36 | `career.mjs` with the `all` variant, `INV=` ablation |
| Compute eras and trajectory studies | v1.38 | `COMP_ERAS`, `compLag`, `compEra`, `orderStudy`, `predErr`, `computeHTML` |
| No daily overhead | v1.41 | `OVERHEAD = OVERHEAD_CAP = 0` (Caio: idle time neutral) |
| Event timeline | v1.42 | `upcoming`, `advanceTo`, `timelineHTML` ("Coming up", Inbox) |
| Staged pay for long missions | v1.44 | `STAGE_PAY`, `M.to`/`M.crew`, `stagedTick`, `stagePaid` |
| Dispatch | v1.47 | `dispatchEstimate`, `dispatchQuote`, `orderDispatch`, `padsFree`/`padWait`, `dispatchTick`, `dispatchRoll` (interim), `dispatchLine` |
| Deviation handover | v1.50 | `devState`, `devWaiting`, `loseDeviation`; app: `takeDeviation`, `R.noRevert` |

**Cross-scope lines, flagged in NOTES:**
- `predictImpact` adds the compute error;
- the app's impact spread;
- `progTabOf` mappings ("Compute" → Industry, "Coming up" → Inbox);
- the launch line in `missionTick` (studies, pads, stacking);
- `igniteOK` and `wearOf` hooks;
- the Revert guard.

## Decisions with Caio (detail in NOTES)

- **Rich programs:** projects built by flying them; waste heat as physics; routine runs; pads as the scarce resource.
  NOTES § "Rich programs: projects, waste heat and routine runs".
- **Compute:** eras by world date with nudges, and studies add days. § "Compute — a resource across eras".
- **Time:**
  - time passes only when you choose; nothing launched is lost to time; long missions pay along the way;
  - passive flybys;
  - the year will be Tellus's orbit once there's a sun;
  - no upkeep.
  
  § "Time, long missions and communication", which also covers instruments that point, data as a volume, the link
  budget and forgiving contact.
- **Planning before the flight:** "the study is the plan"; gravity assists solved, not nudged (goals, aim-point
  targeting on the B-plane, a solver, sensitivity). Same §, subsections "Planning before the flight" and "Gravity
  assists".
- **Dispatch:**
  - repeats only, never firsts, and always after a manual run-through (part of a run may be automated if it was flown
    by hand before);
  - same pay; improvements are player-led, with no automatic discounts;
  - risk comes from part data, which also narrows the estimate;
  - auto-resolve and watch modes give the same outcome under a fixed seed;
  - deviation hands the flight over, often in a crisis, and there is no revert;
  - part changes: development never invalidates a procedure; physics changes are dry-run as a study and become
    provisional.
  
  § "Dispatch — the economy's answers", inside the bodies session's "Procedures" section.
- **Weather and auto-resolve:** every random factor must come from the world seed (time, place) or the dispatch seed.
  v1.47 notes.

## Open threads, in suggested order

1. **The bodies session's balance note** (in its `ACTIVE_WORK.md` row): "nyxfind completes for free on a Selene
   flight, and selimp/nyxfind pay less than a Probe costs" (NOTES § "The ladders, proven with real rockets").
   Economy to fix. Planned next.
2. **The career runner using dispatch:** how pads and dispatch change the balance (`career.mjs`).
3. **`dispatchRun` from the bodies session:** a headless procedure run with a seed, returning
   `{ok, orb, dv, why}` or `{deviation: {kind, why, entry}}`. Hand-off prompt given to Caio on 2026-10-08; status
   unknown, so check NOTES and `ACTIVE_WORK.md`. Until then `dispatchRoll` is the interim resolver.
4. **Deviation flight rules** (bodies' side): Δv-to-go vs Δv left, a corridor around the recorded profile, events.
   Thresholds could later be a player setting (hand over / abort / carry on).
5. **Pre-flight planner and gravity assists:** hand-off prompt for the planning session given to Caio; status
   unknown.
6. **The time model's second half:** missions in flight in the background (sats registry); cruise science; staged pay
   paid there too.
7. **Later, from the design notes:**
   - routine runs on the pad calendar (pads exist now);
   - projects (depots, datacenters with steady-state heat);
   - data as a volume and the link budget;
   - datacenter revenue on the compute price index.
8. **Small:**
   - `career.mjs` resets: add `dispatch: []` next to `staged: {}` when the runner starts dispatching;
   - the README launchpad row is long and getting longer.

## Tools

- `career.mjs`: `node career.mjs [years] [seeds] [base|lines|support|all] [starts]`.
  - `SPEND=1` prints a compact spending line;
  - `INV=hall|fleet|test|dev` runs one money sink at a time;
  - `RESERVE=` sets the investor's cash floor (default 250M).
  - `PACE=1` prints the epoch 1–2 pacing report; `FAILFIRST=orbit` fails the first orbital attempt (NOTES § "Epoch 1–2
    pacing", Q44).
  - The scripted player withdraws a contract it can't afford when its slots are full (v1.77); `TRACE=1`, `SEED0=`, `ARCHS=` narrow a run.

  Noise between policies is roughly ±400M at 5 seeds.
- Claude memory for this project (key `G--Meu-Drive-CLAUDE-fun`): `shared-docs-commit-procedure`,
  `repo-leaving-drive`. A session started in the new folder may use a different memory key. The move runbook says the
  memory is copied across.
