# Session Coordination — choose a profile at setup

**Version**: v1.0.0 · **Date**: 2026-07-30 · **Status**: Active
**Decision required**: pick Profile A or B during project setup (see `SETUP_CHECKLIST.md`) and record the choice HERE, in this file, under "This project uses". Sessions read this file to know which mechanism applies.

> **This project uses: ☑ Profile A (file-based) ☐ Profile B (DB-backed)**
> Recorded 2026-08-10. Single operator, personal project, no infrastructure worth provisioning.
> Claims go in `ACTIVE_WORK.md`; the log is `SESSION_LOG.md`.

One template, two coordination profiles. They solve the same problems — *who is working where* (claims), *what happened* (logging), *what was found but not handled* (flags/parked threads) — with different substrates. Profile A has zero dependencies and works anywhere, including client environments where you cannot provision infrastructure. Profile B is strictly better under real concurrency but requires a database you control.

**Why not two templates?** Two near-identical templates drift apart silently — this exact failure was observed (a standalone template and a framework-embedded copy diverged within weeks, and determining which was canonical required forensics). One template, one pluggable layer.

---

## Profile A — file-based (default; zero dependencies)

Use when: client projects, no infrastructure guaranteed, single operator with occasional concurrency, air-gapped work.

| Concern | Mechanism |
|---|---|
| Claims | `ACTIVE_WORK.md` — claim scope at session start (name, date, scope, files at risk), clear at close. Startup protocol reads it before any work. |
| Activity log | `SESSION_LOG.md` — one closing entry per session (summary, files changed, next steps). |
| Parked threads / flags | `SESSION_LOG.md` entries prefixed `PARKED:` / `FLAG:` — greppable, reviewed when planning. |
| Registries (publish gates, job state) | A dedicated `.md` table per domain, single-writer by convention: claim the file in `ACTIVE_WORK.md` before editing it. |

Rules that keep Profile A honest:
- **Claim before write** on any shared file. The claim file itself is the only file two sessions may both touch, and only in their own row.
- **Append-only** for logs — never rewrite others' entries.
- **Low contention by design**: if two sessions regularly need the same file, split the file by domain or upgrade to Profile B.
- On a sync layer (Drive/Dropbox), know the failure mode: concurrent edits fork or clobber *silently*. Profile A is a convention, not a guarantee — it works because sessions follow protocol, and it degrades visibly (conflicted copies) when they don't.

## Profile B — DB-backed (Supabase/Postgres or any REST-reachable store)

Use when: you control infrastructure, multiple concurrent sessions are routine, multiple machines or operators, or any Profile A file shows contention.

| Concern | Mechanism |
|---|---|
| Claims | `claims` table — scope, operator, files-at-risk, opened/closed. A CLI helper (`worklog.py` pattern) makes claim/close one command. |
| Activity log | `sessions` / log table — writes are ~1–2 s, ~200 tokens; log liberally. Render a human-readable digest file *on demand* rather than maintaining one by hand. |
| Flags / parked threads | `flags` table with lifecycle `open → promoted \| dismissed`, plus **session links** (every session that touches an item records itself) — this is what catches scope that spans sessions. |
| Domain registries | One table per contended domain, following the **registry pattern**: (1) sessions *declare* work rows; (2) a *preflight* command merges declared rows with a **live scan of the external system** where possible, so unregistered work still surfaces; (3) hard gates exit non-zero (blocked) rather than warn; (4) truly exclusive resources take an explicit `claim` row. |
| Batch/async jobs | `jobs` table: register on submit, check before starting overlapping work (exit non-zero if active), close when applied. |

Design rules learned the hard way:
- **A registry that relies on every session remembering to log will drift** — pair declarations with live scans of ground truth wherever the external system allows it.
- **Tier the read views.** The full "everything open" dump of a mature system can be 100+ KB (≈ tens of thousands of tokens). Default view = one line per item; detail per-item on demand.
- **The write side is never the bottleneck; the triage side is.** Pair any flag/queue table with a periodic digest that clusters, detects self-resolved items, and presents batched approve/skip decisions (see `architecture-principles.md` §2).

## Upgrade path A → B

1. Stand up the store (Supabase free tier suffices; one instance can serve many projects).
2. Migrate claims + log first (highest contention), keeping the Profile A files as generated *read-only renders* with a tombstone note.
3. Add domain registries only where contention or invisible-staged-work actually exists — each registry is a product; don't build them speculatively.
4. Update the checkbox at the top of this file, and the startup protocol pointer if the helper commands changed.

## What stays file-based in BOTH profiles

Deliverables, docs, playbooks, standards, human-authored content, and anything the operator reads/edits directly. The database holds **coordination state**, not content (principle §5).
