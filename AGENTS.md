# Agent Instructions — fun

> **This is the platform-agnostic root operating contract for this workspace.** `CLAUDE.md` and `SOUL.md` are thin per-platform shims pointing here; edit THIS file, never the shims. Everything in the workspace must be reachable by following pointers from this file (see Routing Tree below).

Read [`PROJECT.md`](PROJECT.md) for project orientation — goals, structure, contacts, and current focus. Read it every session before anything else.

---

## Session Startup Protocol

When starting a new session:
1. Read `./PROJECT.md` — full project context
2. Check for concurrent work that might conflict — see [`docs/coordination.md`](docs/coordination.md) for which mechanism this project uses (file-based `ACTIVE_WORK.md` or DB-backed claims)
3. Read the last 3 entries in `SESSION_LOG.md` — understand recent context
4. Check `intake/` for any new files the user has dropped in
5. Claim your scope (mechanism per `docs/coordination.md`)
6. Wait for user confirmation before proceeding with any work

## Session Closing Protocol

Before ending any session:
1. Clear your claim
2. Add a closing entry to `SESSION_LOG.md` with summary, files changed, and next steps
3. Update `INDEX.md` if any files were created, renamed, or deleted

## Tangent Rule

The startup protocol fires at the *start* of work; this rule fires at *scope shifts*. When a session pivots away from its original objective mid-flight, it must immediately: (a) record the abandoned thread (a task/flag entry per `docs/coordination.md`, or a `SESSION_LOG.md` "PARKED:" line) with a one-line "parked at: <state>" note, and (b) say so in the reply. Tangents are fine; silently dropped threads are not.

## Operator Identification

Only needed when a workspace is shared with more than one person. Identify who is operating
before anything that depends on it: tone, access to personal data, and attribution in
`SESSION_LOG.md`.

**Identity markers must live outside the sync boundary.** A file inside the shared folder
syncs to everyone, so it identifies the *folder*, not the person at the keyboard. A
`_meta.txt` sitting in the project root will confidently misidentify every collaborator as
its author, and the failure is silent.

Resolve in this order, stopping at the first that works:

| # | Signal | Why it holds |
|---|---|---|
| 1 | `%USERPROFILE%\_meta.txt` (Windows) or `~/.config/<project>/meta` — `USER: FULL NAME` | machine-local, never syncs |
| 2 | OS username (`$env:USERNAME` / `$USER`), matched against a table of known operators | zero setup, machine-local |
| 3 | Ask once, then write the answer to #1 | asking every session is how a workspace becomes annoying |

Never infer identity from the folder path shape. It depends on how each person mounted the
share, whether they made a shortcut, and whether they renamed anything.

**Weak identity gates the sensitive action, not the conversation.** Greeting someone without
knowing who they are is fine. Opening files with personal data, or writing a name into a log,
is not: confirm first.

## Routing Tree — everything downstream of this file

The opening context is a *routing map*, not a database. Every durable file in the workspace
must be reachable by following pointers from this file: root → domain index → file. A session
should very rarely need to grep to find something.

- This file holds **rules + one-line pointers**; depth lives in branch indexes (`INDEX.md`,
  `scripts/CATALOG.md` if the project grows one, per-domain READMEs), each owning its subtree
  with an add-a-row contract.
- **The work lives in [`explorations/`](explorations/)** — one folder per idea, each with a
  `NOTES.md`. [`explorations/README.md`](explorations/README.md) is its branch index and owns
  that subtree: starting an exploration means adding a row there. Project-specific working
  rules (single-file bias, measure don't guess, record negative results) are in
  [`PROJECT.md`](PROJECT.md) under "Ground Rules".
- **A needed grep is a bug report**: if you had to search to locate something, add the missing
  pointer to the owning branch index before finishing the session.
- **Index on creation**: whenever you create, rename, move, or delete a durable file — update
  `INDEX.md` (or the owning branch index) immediately.

## File Lifecycle — archive over delete

- Text content is **never deleted** — move it to an `archive/` folder instead. Text is cheap
  and has repeatedly saved hasty implementations. "Move and mostly forget" is the desired
  end state.
- Media (images, video, zips) may be deleted, but only after an aging period and with explicit
  approval. **Session-produced artifacts** (generated diagrams, SVGs, figures) are archived,
  never deleted — deletion applies only to externally-sourced media (downloads, screenshots,
  drops, unzip residue).
- Automated cleanup jobs archive only; at most they *list* deletion candidates for a human pass.

## Intake / Output Routing

- **`intake/` is write-once by humans, read-only for code.** The user drops files here for
  processing; check at session start. Scripts must never create files in `intake/` — a
  drop-box that code writes into becomes an unbounded accumulator.
- **Machine-generated artifacts** → `output/<domain>/` subfolders, never loose in `output/`
  root, never in `intake/`.
- **Session-authored deliverables** (reports, drafts, specs) → the owning project folder or
  `output/<domain>/`. Tell the user what you placed where and what source it derives from.
- **Intermediates and scratch** → the platform's session scratchpad, NOT the workspace. If
  it's worth keeping, it's a deliverable; otherwise it dies with the session.
- Every accumulating folder needs a *drain* (see `docs/architecture-principles.md` §2) —
  periodically sweep consumed intake files and aged outputs into dated `archive/` subfolders.

## File Format Policy

**Internal files (source of truth):**
- Structured data → YAML or JSON
- Unstructured content → Markdown (.md)

**Export files (derived products):**
- DOCX, XLSX, PDF — generated only when needed for external consumption
- Always produced from the internal source; place in `output/`
- Never treat an export as the source of truth

## Playbook Protocol

Before starting any repeatable task, check `playbooks/` for a relevant playbook. If none exists and the workflow is repeatable, note it for extraction. Run `/research-workflow` before writing any new skill or playbook.

After completing a task, check: was this repeatable? Log improvements in `LESSONS_LEARNED.md`.

## Document Standards

All documents follow `standards/document_control.md`:
- Metadata headers on every doc (version, author, dates, purpose, status)
- Semantic versioning (MAJOR.MINOR.PATCH)
- The agent auto-increments PATCH on minor edits; asks before MINOR or MAJOR bumps

## Working Principles

Full architecture principles (with rationale): [`docs/architecture-principles.md`](docs/architecture-principles.md). The short form:

- **Ask before assuming** — clarify scope and intent before producing deliverables
- **Machine drains, not human drains** — any queue whose drain is "the human reviews it" is a bug; accumulators get sweeps, TTLs, and digests
- **The right thing must be the lazy thing** — fix defaults, not discipline
- **Additive first, destructive later** — when sessions run concurrently, ship new conventions alongside old paths, retire lazily
- **Context budget is a first-class resource** — every KB added to this file is paid by every future session
- **Archive over delete** — see File Lifecycle above
- **Improve the system** — when you find a better way, update the playbook, standard, or this contract (in `AGENTS.md`, never in a shim)
