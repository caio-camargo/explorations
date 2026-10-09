# Session roles
**Version**: 1.2.0 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-08 · **Updated**: 2026-10-09 · **Status**: live
**Purpose**: Standing briefs for named sessions. When Caio says "you are the <role> session", find the role here and
follow its brief after the normal AGENTS.md startup. Add a section when a new standing role appears.

| Role | Say | Brief |
|---|---|---|
| A launchpad lane (flow, economy, vehicle, space, world, look & sound, QA, platform) | "you are the launchpad **space** session"; look & sound also names a beat: "…**look & sound** session, beat: effects" | [`explorations/launchpad/QUEUE.md`](../explorations/launchpad/QUEUE.md): its kickoff line; lanes in [`ROADMAP.md`](../explorations/launchpad/ROADMAP.md) |
| Orchestrator | "you are the orchestrator"; ask it "what are the next unblockers?" | Its row in `ACTIVE_WORK.md`, the top of `QUEUE.md`, and ROADMAP § "Keeping the queue full" (incl. *Next unblockers*) |
| Design desk | "you are the design desk" | [below](#design-desk) |
| Playtest intake | "you are the playtest feedback session" | [below](#playtest-intake) |
| Studio | "you are the studio session" | [below](#studio) |

---

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

Owns the design catalogs in ROADMAP § "Design catalogs": `SYSTEM.md` (the star system), `POWERS.md` (national flavours as
content), `CREW.md` (astronauts, starting with the open art-direction question), and the visual identity plan (Q53).
For each one:
1. Read what NOTES already decided (cite the sections) and ROADMAP § Pillars.
2. Interview Caio in short rounds: options with trade-offs and a recommendation, never a blank page. When a choice is
   visual, ask a look session for mock-ups, so Caio picks from pictures.
3. Write the catalog in `explorations/launchpad/`, marked draft until Caio approves it. Then flag the orchestrator to fan
   out the build items, one per body, power or crew piece.

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
