# Workspace Architecture Principles

**Version**: v1.0.0 · **Date**: 2026-07-30 · **Status**: Active
**Origin**: Distilled from the RetellAI workspace architecture review (2026-07-30), after ~6 months of multi-session accretion produced a 1.1 GB drop-box, five competing navigation layers, and a triage queue nobody could drain. These are the rules that prevent that.

The scarcest resource in an agent-operated workspace is the **operator's attention**. Second is the **opening-context token budget**. Disk and database are effectively free. Every rule below trades a cheap resource for a scarce one.

---

## 1. Everything downstream of the root

The workspace has exactly **one root operating contract** — `AGENTS.md` — and every durable file must be reachable by following pointers from it: root → domain index → file.

- The opening context is a **routing map, not a database**. Not every datum is loaded, but the agent must always know *where to look* without discovery greps.
- The root layer holds rules + one-line pointers. Depth lives in **branch indexes**, each owning one subtree with an add-a-row contract (a catalog owns `scripts/`, an index owns `projects/`, etc.).
- **A needed grep is a bug report** — the missing pointer gets added to the owning branch index before the session ends. The map converges through use, not through maintenance sessions.
- Reachability is **mechanically checkable**, in both directions: everything reachable from the root (no orphans), every pointer resolving (no dangling links). Audit it periodically; don't promise "complete inventory" by hand — that promise is unkeepable and was observed to fail.
- Platform files (`CLAUDE.md`, `SOUL.md`, editor configs) are **thin shims** pointing at the root. Rules are edited in the root only — a shim that accretes rules recreates the multiple-roots failure.

**Failure mode this prevents**: five navigation layers, four stale, each claiming authority; sessions grepping to find things; a hand-maintained "complete" index covering 1% of files.

## 2. Machine drains, not human drains

**Every accumulator needs a drain, and any queue whose drain is "the human reviews it" is a bug.**

Accumulators are everywhere: an intake folder, a flag/issue queue, a session log, the root contract itself, the memory index. Each either gets:
- a **mechanical drain** — TTL sweeps to dated archive folders, auto-generated digests, auto-expiry proposals; or
- a **human drain sized to actual capacity** — which in practice means: batched, pre-digested decisions ("approve/skip this list") rather than open-ended triage.

Filing/logging liberally is correct and cheap. The design work is always on the draining side.

**Failure mode this prevents**: a drop-box where the first file ever deposited is still there six months later; 73 open flags of which 44 are "high" (a severity that no longer signals anything).

## 3. The right thing must be the lazy thing

Sessions under time pressure take the path of least resistance. If the convenient path violates a convention, the convention loses — silently, at scale. So: fix defaults, not discipline.

- Output goes to the right place because the rule is short, written where sessions look, and the wrong place is explicitly forbidden — not because sessions are diligent.
- Conventions that require remembering are backed by protocol hooks (startup checklist, closing checklist) or automation, not by hoping.

## 4. Additive first, destructive later

In a workspace with concurrent sessions (there is never a moment with zero active sessions):

- Every structural change ships as **new convention + old paths still working**, then old paths retire lazily.
- Never rename or move files that other code globs/reads until the readers are patched.
- Deprecations get a **tombstone** (a README at the old location pointing to the new) rather than a void.
- Every migration phase must leave the workspace working if interrupted.

## 5. Shared mutable state goes to a database; files hold deliverables

Two sessions appending to the same file on a sync layer (Drive, Dropbox) is a race — sync engines resolve conflicts by forking or clobbering, silently.

- Anything two sessions might write concurrently (logs, claims, registries, queues, job state) belongs in a **database** when one is available (see `coordination.md`, Profile B).
- When no database is guaranteed (client work, air-gapped, simple projects), use the **file-based coordination profile** (Profile A) — single-writer files, claim-before-write, append-only conventions — and keep contention low by design.
- Files remain the right home for **deliverables and human-authored content** — documents the operator reads, edits, and ships.

## 6. Context budget is a first-class resource

Every KB in the root contract, the memory index, and the always-read orientation files is paid by **every future session**, forever.

- Something earns a place in the always-loaded layer by **routing frequency**, not importance. If a typical session doesn't need the pointer, it lives one hop down.
- **Correctness beats coverage**: a wrong pointer costs more than a missing one, because the agent trusts it and doesn't verify.
- Logging cost accounting (measured): DB *writes* are ~1–2 s and ~200 tokens each — log liberally. The cost center is **reads of unbounded views**: a full dump of a mature registry can be 20× a session's entire write budget. Tier the views: brief mode (one line per item) as the default, per-item detail on demand.

## 7. Archive over delete

Text content is never deleted — moved to `archive/` folders instead ("move and mostly forget" is the desired end state). Text is cheap and repeatedly saves hasty implementations.

- Deletion is reserved for **externally-sourced media** (downloads, screenshots, drops, unzip residue) after an aging period, with explicit approval.
- **Session-produced artifacts** (generated diagrams, SVGs, figures) are archived, never deleted, regardless of age.
- Automated jobs archive only; at most they *list* deletion candidates for a human-approved pass.

## 8. Projects have a lifecycle

Project folders are born easily and never die on their own. Institute:

- `projects/_archive/` for cold projects (untouched N weeks — the periodic audit flags candidates; the human approves the batch).
- A 1–2-file "project" is a document, not a project — it lives in `docs/notes/` until it earns a directory.
- "Finished" projects get declared finished *in writing* (in their README), so later sessions don't half-revive them.

---

## The meta-rule

These principles exist because a workspace operated by many agent sessions **grows by accretion by default** — every session adds and almost none removes, because adding is part of the task and removing is nobody's task. The principles make removal, routing, and coordination *somebody's* task: usually the machine's, occasionally the operator's in pre-digested batches, and never "whoever notices".
