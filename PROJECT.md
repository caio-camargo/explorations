# fun — Project Context
**Version**: v1.0.0
**Author**: Caio Camargo
**Date Created**: 2026-08-10
**Last Updated**: 2026-08-10
**Purpose**: LLM-agnostic project context — read by any AI assistant at session start
**Status**: Active

---

## What This Project Does

**Purpose:** A workshop for small, self-contained explorations — simulations, toys, visual
experiments, "what happens if…" questions. Things built because they're interesting, not
because they're needed.

**Working Mode:** Build fast, tune until it's interesting, write down what it taught. The
notes outlive the code.

**Current Phase:** Open-ended. First exploration built 2026-08-10.

---

## Ground Rules

This project runs the full framework template, which is heavier than it needs to be. The parts
that earn their keep here:

- **`explorations/` and its README index** — the actual work, and the one thing to keep current
- **`SESSION_LOG.md`** — so a session six months from now knows what already happened
- **`LESSONS_LEARNED.md`** — where cross-exploration patterns accumulate

The parts that are dormant unless the project grows into needing them: `playbooks/`,
`standards/`, `skills/`, `docs/skill-*`. Don't invent ceremony for them. **Do not** open a
playbook, a standard, or a skill registry entry for a one-off toy.

Bias for this project specifically:

- **A single self-contained file beats a project scaffold.** No build step, no dependencies,
  no package manager, unless the idea genuinely can't be expressed without one.
- **Tune with measurements, not vibes.** If a parameter is "wrong", sweep it and record the
  numbers. Half the interest in these things is in *why* a setting fails.
- **Write down the negative results.** A reading of the rules that degenerates is worth more
  in `NOTES.md` than another pretty screenshot.

---

## File Structure

```
fun/
├── AGENTS.md              ← operating contract (rules + routing) — the root
├── PROJECT.md             ← this file — project context
├── CLAUDE.md / SOUL.md    ← platform shims, point at AGENTS.md
├── INDEX.md               ← file inventory
├── ACTIVE_WORK.md         ← concurrent-session claims (Profile A)
├── SESSION_LOG.md         ← what happened, per session
├── LESSONS_LEARNED.md     ← patterns worth repeating
│
├── explorations/          ← THE WORK — one folder per idea, README.md is its index
│   └── dots-friend-enemy/ ← friend/enemy dot simulation
│
├── intake/                ← drop files here for the AI to process
├── output/                ← generated artifacts
├── logs/                  ← skill execution logs
├── docs/                  ← framework reference material
├── playbooks/ standards/ skills/   ← dormant; see Ground Rules
│
├── index.html             ← GitHub Pages landing page, links to explorations
├── README.md              ← public repo front page
├── template/ shared/      ← the claude-project-framework clone this project was
│                             instantiated from — gitignored (see below)
└── archive/               ← completed one-time docs (archive over delete)
```

### About `template/` and `shared/`

The project files above were instantiated from `template/` in place, so the
[`claude-project-framework`](https://github.com/caio-camargo/claude-project-framework) source
still sits alongside them locally.

**Both folders are gitignored.** They already have their own repo; republishing a copy of them
here would create a second source of truth that drifts. The canonical working copy is
`../claude-project-framework/`. Edit the framework there, not here.

The original `.git` in this folder was a clone of the framework repo. It was archived to
`../ARCHIVE/fun-framework-clone-git-2026-08-10/` on 2026-08-10 after every file was verified
byte-identical to the canonical clone (same HEAD, `40b1044`), and this folder was re-initialised
as its own repo.

---

## How to Work Together

### Session Start

1. Read this file
2. Check `ACTIVE_WORK.md` for concurrent claims
3. Read the last 3 entries in `SESSION_LOG.md`
4. Check `intake/` for new files
5. Confirm the current focus before starting work

### Where Things Go

- **A new exploration** → `explorations/<slug>/`, plus a row in `explorations/README.md`
- **Findings and dead ends** → that exploration's `NOTES.md`
- **Patterns that span explorations** → `LESSONS_LEARNED.md`
- **Scratch and intermediates** → the session scratchpad, not this folder

---

## What the AI Can Help With

- Building the explorations end to end
- Sweeping parameters and reporting what each regime does
- Explaining why a system behaves the way it does — the maths behind the picture
- Keeping `NOTES.md` and the index honest

## What Requires Human Input

- Which ideas are worth building at all
- Whether the result is actually interesting (the only real success criterion here)
- Anything published or shared outside this folder

---

## Current Focus

### Active
- [x] Instantiate the project from the template
- [x] Exploration 1 — friend/enemy dots ([`explorations/dots-friend-enemy/`](explorations/dots-friend-enemy/))

- [x] Own GitHub repo + published page — [caio-camargo/explorations](https://github.com/caio-camargo/explorations), live at [caio-camargo.github.io/explorations](https://caio-camargo.github.io/explorations/)

- [x] Dots reached V2.3 and is **paused, not finished** — documented to be resumed cold. Start
      from "Picking this up cold" in [`NOTES.md`](explorations/dots-friend-enemy/NOTES.md).

- [x] Exploration 2 — fireflies ([`explorations/fireflies/`](explorations/fireflies/)) — pulse-coupled sync, 5 measured regimes
- [x] Exploration 3 — slime mold ([`explorations/slime-mold/`](explorations/slime-mold/)) — Physarum networks, Float32 field, 4 measured anatomies

### Up Next
- [ ] Fireflies open threads (chimeras, Kuramoto coupling, sound) at the bottom of `fireflies/NOTES.md`
- [ ] Dots open threads, best-specified first, at the bottom of `dots-friend-enemy/NOTES.md`

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-10 | Instantiate the template into `fun/` root, keeping the framework clone alongside | Chosen over a sibling folder; single-folder result. |
| 2026-08-10 | Own public repo `caio-camargo/explorations`; framework clone gitignored | Resolves the remote pointing at the framework repo. Public is required for Pages on a free plan. |
| 2026-08-10 | Coordination Profile A (file-based) | Single operator, personal project, zero infrastructure worth provisioning. |
| 2026-08-10 | Keep `playbooks/`, `standards/`, `skills/` dormant | The template is heavier than a toy workshop needs; ceremony would cost more than it returns. |
| 2026-08-10 | Fixed-stride reading of "large step / small step" is the default | The proportional reading has no bounded structured regime — measured, see `NOTES.md`. |

---

## Version History

**v1.0.0 (2026-08-10):**
- Project instantiated from `claude-project-framework` template
- First exploration built and tuned
