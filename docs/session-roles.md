# Session roles
**Version**: 1.4.1 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-08 · **Updated**: 2026-10-13 · **Status**: live
**Purpose**: Standing briefs for named sessions. When Caio says "you are the <role> session", find the role here and
follow its brief after the normal AGENTS.md startup. Add a section when a new standing role appears.

| Role | Say | Brief |
|---|---|---|
| A launchpad lane (flow, economy, vehicle, space, world, look & sound, QA, platform) | "you are the launchpad **space** session"; look & sound also names a beat: "…**look & sound** session, beat: effects" | [`explorations/launchpad/QUEUE.md`](../explorations/launchpad/QUEUE.md): its kickoff line; lanes in [`ROADMAP.md`](../explorations/launchpad/ROADMAP.md) |
| Orchestrator | "you are the orchestrator"; ask it "what are the next unblockers?" | Its row in `ACTIVE_WORK.md`, the top of `QUEUE.md`, and ROADMAP § "Keeping the queue full" (incl. *Next unblockers*) |
| Test bench | "you are the launchpad **test bench**" (Caio's second computer) | [below](#test-bench) |
| Design desk | "you are the design desk" | [below](#design-desk) |
| Playtest intake | "you are the playtest feedback session" | [below](#playtest-intake) |
| Studio | "you are the studio session" | [below](#studio) |

**Every launchpad session follows ROADMAP § "Documents"** (2026-10-11): one home per fact; a decision is one line in
`DECISIONS.md`, never restated; changing one ripples through every doc in the same commit; replaced text goes to
`archive/`; headers and version histories stay true. Answered questions leave QUEUE.

---

## Test bench

Launchpad, QA lane, on **Caio's second computer**, left running. **No game code.** It runs the browser work that queues up
on the main machine, where the GPU is shared and two game runs at once hang it: it has its own GPU and its own
`.game-busy` lock, so it never waits for one.

**Setup, once:** clone from GitHub to `C:/Users/<you>/dev/explorations` on that machine (never into Google Drive), Node 22+,
Chrome, Python. Serve with the threaded server (QUEUE Flags, "Flaky page loads"); set `PT_OUT` to a folder outside the repo.
Its claim row names the machine (`hostname`). Work in the clone's `main` for docs; a worktree only if it ever builds.

**Loop** (self-paced `/loop`, ~30 min when idle): `git pull`, then the first of these that has work:
1. **Guard `main`:** for each new `## v1.N` since its last pass, `node test.mjs --smoke`, `node playtest.mjs m1`, and after an M2 merge `node playtest.mjs m2` (Q233). A
   failure is a PLAYTEST item (P1 if `m1` broke) naming the version and the commit, and a line under QUEUE *Proposed*.
2. **QA items marked 🖥🖥 or "quiet machine"** (Q19's timing A/B on its branch, Q215's flake, Q233's M2 robot run): claim
   in QUEUE, run, report. A timing A/B is valid here as a *relative* number; say the machine and GPU beside it.
3. **The robot pass over untried TESTING rows**, newest first: set each up as `playtest.mjs` rows do, judge what a robot
   can (layout, text, numbers, timings, a broken scene), mark it `✓ n (robot)`, `✗ n → P#m (robot)` or
   `~ n (robot): needs a human`. Feel, difficulty and fun stay Caio's.
4. **Before/after stills** for look & sound merges (`node refset.mjs`), into `output/launchpad/`, linked from the item.

Pull before each edit; commit and push TESTING / PLAYTEST / QUEUE changes in small commits; take numbers from
`node check_numbers.mjs`. Never merge or push code. If the queue gives it nothing for two passes, say so in its claim row
and slow down to hourly; the orchestrator refills it.

## Playtest intake

Launchpad, QA lane. **No game code.**

Caio gives raw playtest observations in any shape: a list, a ramble, screenshots. For each one:
1. Check PLAYTEST.md (open and done) and TESTING.md for the same thing. If it's already there, add to that item instead.
2. Write a PLAYTEST.md item: the symptom in Caio's terms, a lead (where in the code, a likely cause, after a quick look),
   priority P1–P3 (the file's own scale), and the owner lane per ROADMAP.md § Lanes.
3. Add a one-line follow-up under QUEUE.md's *Proposed* (`lane — what — PLAYTEST #n`). The orchestrator ranks it.
4. If an observation is about design rather than a bug (it isn't fun, it's confusing, I wanted X), check it against
   ROADMAP.md § Pillars and file it as a P3 design item with the pillar it touches.

Ask Caio only when a note is ambiguous. Pull before each edit, and commit and push doc changes as you go (PLAYTEST.md,
QUEUE.md, the session log). You can stay open alongside every other session: you only touch docs.

## Design desk

Launchpad's game design, the part only Caio can approve. **No game code.**

Owns the design catalogs in ROADMAP § "Design catalogs" (every design doc is listed there) and `DECISIONS.md`.
For each one:
1. Read what NOTES already decided (cite the sections) and ROADMAP § Pillars.
2. Interview Caio in short rounds: options with trade-offs and a recommendation, never a blank page. When a choice is
   visual, ask a look session for mock-ups, so Caio picks from pictures.
3. Write the catalog in `explorations/launchpad/`, marked draft until Caio approves it. Then flag the orchestrator to fan
   out the build items, one per body, power or crew piece.
4. **When Caio answers,** write the decision as one line in `DECISIONS.md` (with *Touches*), apply it to every doc it
   touches (the ripple rule), and take the question out of QUEUE.
5. **At each milestone's end**, run a project review (ROADMAP § Documents rule 8; the method in
   [`playbooks/project-review.md`](../playbooks/project-review.md)).

A proposal that needs a new system goes to *Waiting on Caio* with the pillar it serves (ROADMAP § "Systems are complete").
**Kick-backs first:** a D-item marked *back to design* (ROADMAP § "Keeping the queue full", rule 8) is a contradiction
some lane found between built work and a catalog or pillar. Settle it with Caio before starting a new catalog, update the
catalog it touches, and flag the orchestrator to unblock the items waiting on it.
Pull before editing, push as you go.

## Studio

The process that builds games, not any one game. **No game code.**

**Goal:** with Caio, build a new home folder for game development (Caio creates it in Google Drive). It holds a reusable
playbook and a template for starting a new game, however different from Launchpad. The folder is **a template to copy
from, never a place to run work from.**

**Source material** (in this workspace): AGENTS.md, `docs/coordination.md`, `docs/architecture-principles.md`,
LESSONS_LEARNED.md, SESSION_LOG.md, and in `explorations/launchpad/`: QUEUE.md, ROADMAP.md, PLAYTEST.md, TESTING.md,
`playtest.mjs`, the tester menu (NOTES § "The tester menu"), and the ACTIVE_WORK.md history.

**What the playbook covers:**
- cutting lanes around goals, not code;
- the queue and its refill rules;
- milestones with finish lines a robot can check;
- design pillars and closing the set of systems;
- defaults-if-silent for blocked decisions;
- the standing roles (orchestrator, playtest intake, studio);
- the robot playtester and the tester menu as standard parts of any game;
- worktrees, claims and merging;
- the coordination failures already hit (lost merges, version-number collisions, Drive sync corrupting git), each with
  what prevents it.

**Continuous improvement:** decide with Caio what to measure (lanes running dry, how long items sit ready, merge
conflicts per day, how often a session waits on Caio, how much Caio has to type to start one). Hold a short retrospective
now and then that turns the numbers into changes to the playbook, and backport those changes to this workspace.

**Must go in the folder's README, near the top:** *Never run git or code from Google Drive.* Copy the template to
`C:/Users/caioa/dev/<game>/`, and sync through GitHub. Drive sync renamed a loose git object and rolled `main` backwards
here (the explorations repo, 2026-10-07; it left Drive on 2026-10-08, runbook `docs/leaving-drive.md`). Docs in Drive
are fine; repos and worktrees are not.

**Start** by interviewing Caio about what worked and what didn't. Propose a structure before writing anything.
