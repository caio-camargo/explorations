# Project Index
**Purpose**: Complete navigable inventory of all project files — update whenever files are created, renamed, or deleted
**Status**: Active

---

## System Files

| File | Purpose |
|------|---------|
| [`README.md`](README.md) | Public repo front page ([caio-camargo/explorations](https://github.com/caio-camargo/explorations)) |
| [`index.html`](index.html) | GitHub Pages landing page — links to each exploration |
| [`AGENTS.md`](AGENTS.md) | **Platform-agnostic root operating contract** — rules + routing map; edit this, never the shims |
| [`PROJECT.md`](PROJECT.md) | Project context (goals, contacts, scope) — read every session |
| [`CLAUDE.md`](CLAUDE.md) | Platform shim for Claude Code (auto-inlines AGENTS.md via `@` import) |
| [`SOUL.md`](SOUL.md) | Platform shim for OpenClaw (points to AGENTS.md) |
| [`INDEX.md`](INDEX.md) | This file — file inventory (depth-1 layer of the routing tree) |
| [`ACTIVE_WORK.md`](ACTIVE_WORK.md) | Concurrent work coordination (Profile A — see `docs/coordination.md`) |
| [`SESSION_LOG.md`](SESSION_LOG.md) | Cross-session persistence log |
| [`LESSONS_LEARNED.md`](LESSONS_LEARNED.md) | Running log of what works and what doesn't |
| [`archive/SETUP_CHECKLIST.md`](archive/SETUP_CHECKLIST.md) | One-time setup steps — completed 2026-08-10, archived |

## Folders

| Folder | Purpose |
|--------|---------|
| [`explorations/`](explorations/) | **The work** — one folder per exploration; [`explorations/README.md`](explorations/README.md) is its branch index |
| [`archive/`](archive/) | Completed one-time docs (archive over delete) |
| `template/`, `shared/` | Local only — the [claude-project-framework](https://github.com/caio-camargo/claude-project-framework) clone this project was instantiated from. **Gitignored**; canonical working copy is `../claude-project-framework/` |
| [`intake/`](intake/) | Drop files here for the AI to process |
| [`output/`](output/) | AI-generated files for retrieval |
| [`logs/`](logs/) | Skill execution logs (`skill-executions.jsonl`, append-only) |
| [`docs/`](docs/) | Reference material and skill framework docs |
| [`docs/research/`](docs/research/) | Best-practice research that outlives one exploration — [`docs/research/README.md`](docs/research/README.md) is its branch index |
| [`playbooks/`](playbooks/) | Reusable workflow SOPs |
| [`standards/`](standards/) | Project standards and conventions |
| [`skills/`](skills/) | Project-specific skill definitions |

---

## Explorations

Owned by [`explorations/README.md`](explorations/README.md) — add rows there, not here.

| Exploration | Purpose |
|------|---------|
| [`explorations/dots-friend-enemy/`](explorations/dots-friend-enemy/) | Dots that chase one friend and flee one enemy — [`NOTES.md`](explorations/dots-friend-enemy/NOTES.md), [`index.html`](explorations/dots-friend-enemy/index.html) |
| [`explorations/sky-floor/`](explorations/sky-floor/) | Lo-fi surreal room with a sky for a floor and a bobbing black orb — [`NOTES.md`](explorations/sky-floor/NOTES.md), [`index.html`](explorations/sky-floor/index.html) |
| [`explorations/pulse-loop/`](explorations/pulse-loop/) | DJ-style hypnotic tempo-locked shader loops, seamless 1080p recorder — [`NOTES.md`](explorations/pulse-loop/NOTES.md), [`index.html`](explorations/pulse-loop/index.html), [`archive/`](explorations/pulse-loop/archive/) (earlier versions) |
| [`explorations/night-storm/`](explorations/night-storm/) | LucasArts-style VGA pixel art: stormy coast, lighthouse, verb UI — [`NOTES.md`](explorations/night-storm/NOTES.md), [`index.html`](explorations/night-storm/index.html) |
| [`explorations/wuthering-heights/`](explorations/wuthering-heights/) | *Wuthering Heights* ch. I as a point-and-click scene — [`NOTES.md`](explorations/wuthering-heights/NOTES.md), [`index.html`](explorations/wuthering-heights/index.html) |
| [`explorations/danya-collage/`](explorations/danya-collage/) | Danya's collage animated in the lo-fi glitch style — [`NOTES.md`](explorations/danya-collage/NOTES.md), [`index.html`](explorations/danya-collage/index.html), [`build.py`](explorations/danya-collage/build.py) |
| [`explorations/dragon-ouroboros/`](explorations/dragon-ouroboros/) | Danya's spinning dragon re-animated in layers (ripple, trailing whiskers, flapping wings) — [`NOTES.md`](explorations/dragon-ouroboros/NOTES.md), [`index.html`](explorations/dragon-ouroboros/index.html), [`build.py`](explorations/dragon-ouroboros/build.py); preview server config in [`.claude/launch.json`](.claude/launch.json) |
| [`explorations/fireflies/`](explorations/fireflies/) | Pulse-coupled fireflies, sync from flashes alone — [`NOTES.md`](explorations/fireflies/NOTES.md), [`index.html`](explorations/fireflies/index.html) |
| [`explorations/slime-mold/`](explorations/slime-mold/) | Physarum transport networks — [`NOTES.md`](explorations/slime-mold/NOTES.md), [`index.html`](explorations/slime-mold/index.html) |
| [`explorations/evolution/`](explorations/evolution/) | Evolution arena, heritable genomes under live selection — [`NOTES.md`](explorations/evolution/NOTES.md), [`index.html`](explorations/evolution/index.html) |
| [`explorations/journey-markov/`](explorations/journey-markov/) | Journey Gravity — migrated to [caio-camargo/retell-viz](https://github.com/caio-camargo/retell-viz); frozen [`NOTES.md`](explorations/journey-markov/NOTES.md) + redirect stubs |
| [`explorations/launchpad/`](explorations/launchpad/) | Lean KSP-inspired rocket/orbit sandbox, raw WebGL2 — [`NOTES.md`](explorations/launchpad/NOTES.md), [`index.html`](explorations/launchpad/index.html), [`terrain-probe.js`](explorations/launchpad/terrain-probe.js), [`test.mjs`](explorations/launchpad/test.mjs) (headless sim checks), [`views.js`](explorations/launchpad/views.js) (fixed reference scenes for graphics before/after), [`builder.js`](explorations/launchpad/builder.js) (the 3D construction screen: placement, radial symmetry, part options), [`shot.mjs`](explorations/launchpad/shot.mjs) (headless-GPU screenshots of the live page, for judging graphics from the CLI) |
| [`explorations/neuromechfly/`](explorations/neuromechfly/) | EPFL's *Drosophila* digital twin driven locally via flygym/MuJoCo — [`NOTES.md`](explorations/neuromechfly/NOTES.md), [`run_matrix.py`](explorations/neuromechfly/run_matrix.py), [`sweep_difficulty.py`](explorations/neuromechfly/sweep_difficulty.py) + [`plot_sweep.py`](explorations/neuromechfly/plot_sweep.py) (breaking-point sweep → `out/sweep.json`/`.png`) |

---

## Standards

| File | Purpose |
|------|---------|
| [`standards/document_control.md`](standards/document_control.md) | Metadata, versioning, lifecycle, file format policy |

## Playbooks

| File | Purpose |
|------|---------|
| [`playbooks/README.md`](playbooks/README.md) | Playbook system guide and format template |

## Skill Framework

| File | Purpose |
|------|---------|
| [`skills/README.md`](skills/README.md) | Points to shared meta-skills; explains what goes here |
| [`docs/skill-registry.yaml`](docs/skill-registry.yaml) | Canonical skill registry — versions, status, changelog |
| [`docs/skill-versioning.md`](docs/skill-versioning.md) | When and how to version skills |
| [`docs/skill-logging.md`](docs/skill-logging.md) | How to add execution logging to any skill |

## Reference

| File | Purpose |
|------|---------|
| [`docs/architecture-principles.md`](docs/architecture-principles.md) | The 8 workspace architecture principles (routing tree, machine drains, archive over delete, …) |
| [`docs/coordination.md`](docs/coordination.md) | Session coordination profiles — A (file-based) vs B (DB-backed); choice recorded at setup |
| [`docs/claude-configuration.md`](docs/claude-configuration.md) | Multi-surface Claude configuration patterns (Desktop, Code, Projects) |

## Shared Meta-Skills

Meta-skills are maintained centrally in
[claude-project-framework](https://github.com/caio-camargo/claude-project-framework/tree/main/shared/skills)
and shared across all projects. (Locally they sit alongside this folder in the framework clone.)

| Skill | Purpose |
|-------|---------|
| `skill-status` | List all registered skills with version and manifest health |
| `skill-health` | Full skill audit — validate files, detect manifest drift |
| `research-workflow` | Research best practices before building any workflow |

---

<!-- Add project-specific sections below as the project grows.

## Research
| File | Status | Purpose |
|------|--------|---------|
| `docs/research/topic-best-practices.md` | Active | Best practices for [topic] |

## Project Skills
| Skill | Version | Purpose |
|-------|---------|---------|
| `skills/my-skill/` | v1.0.0 | What it does |

-->
