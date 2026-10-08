# Leaving Google Drive — runbook for moving the repo out
**Version**: v1.0.1 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-08 · **Updated**: 2026-10-08
**Purpose**: Move the git repository out of `G:/Meu Drive/CLAUDE/fun` into a local clone on each machine, synced through
GitHub, in one short pause. **Status**: run on this machine 2026-10-08 (steps 1–5, 7, 8 done; step 6, the freeze, still Caio's). Script: [`leaving-drive.sh`](leaving-drive.sh).

---

## Why

A live `.git` in a synced folder has bitten three times: Drive zero-filled loose objects (LESSONS #19), renamed one to
`.corrupt-`, and served half-arrived objects to the other machine mid-merge (LESSONS #25). Since 2026-10-07 coding happens
in worktrees outside Drive anyway; only `main`, the shared docs, and the repo data still live here.

**Decided (Caio, 2026-10-08):** sync through GitHub (`github.com/caio-camargo/explorations`, **public**: what's pushed
is published, and `main` feeds the landing page). New home on each machine: `C:/Users/caioa/dev/explorations`. The
Drive folder is frozen afterwards (no `.git`, a `MOVED.md`), deleted later by hand.

## What the move does

The script **copies `.git` out of Drive** on each machine instead of cloning from GitHub. That keeps every local branch
(14, all merged into `main`), the stash, config and reflogs, and the worktree registrations, so the existing
`launchpad-*` worktrees stay where they are: `git worktree repair` re-points them at the copy (rehearsed in a sandbox,
including a worktree with uncommitted changes, which survive).

| Thing | Where it ends up |
|---|---|
| Repo data (`.git`, ~106 MB) | `C:/Users/caioa/dev/explorations/.git` on each machine, its own copy |
| `main`'s files | checked out in `C:/Users/caioa/dev/explorations` |
| Untracked and ignored files (`template/`, `shared/`, `.claude/launch.json`, neuromechfly `out/raw/` 237 MB, the dragon `.mp4`) | copied across by `copy`; `launch.json`'s Drive paths rewritten |
| `PLAYTEST.md`, `TECH_SCOUTING.md`, `explorations/pulse-loop/` (untracked today, but linked from tracked docs) | committed by `commit` |
| `launchpad-*` worktrees | stay at their paths; re-pointed by `repair`. Each machine repairs its own; the other's registrations are pruned from that copy only |
| Claude Code memory (`~/.claude/projects/G--Meu-Drive-CLAUDE-fun/memory`) | copied to the new folder's key, so sessions started there keep it |
| The Drive folder | `.git` moved to `C:/Users/caioa/dev/_backup/drive-git-<date>`; files stay as a snapshot with `MOVED.md` |

Not moved: the parent `G:/Meu Drive/CLAUDE/CLAUDE.md` (JURIDICO's instructions) stops loading into these sessions,
which is right: it's unrelated.

## The pause, step by step

Machine names below: **A** = the machine that commits and freezes (either one), **B** = the other (`pc_de_varginha`
or this one). Run everything in Git Bash from the Drive folder: `cd "G:/Meu Drive/CLAUDE/fun"`. Every changing step
prints what it would do without `--go`; run it that way first.

1. **Stop all sessions on both machines.** Each session commits its work in its worktree, merges into `main` the usual
   way, clears its claim. Dev servers can stay up.
2. **Both machines:** `bash docs/leaving-drive.sh check` until it says READY (or every warning is understood).
   It reads only. It shows fsck, uncommitted files, what copy will carry, each worktree (this machine's / the other's),
   and how far `main` is ahead of GitHub. Untracked `.claude/` folders in worktrees are fine.
3. **A:** `bash docs/leaving-drive.sh commit --go` commits the shared docs and the three untracked items on `main`.
   Wait until **B**'s `check` prints the same HEAD (Drive sync), then go on.
4. **Both machines** (any order, both before step 6): `bash docs/leaving-drive.sh copy`, then `copy --go`. It refuses
   if `C:/Users/caioa/dev/explorations` exists, if anything is uncommitted on `main`, or if fsck fails; it verifies
   HEAD and fsck on the copy before touching worktrees. Nothing in Drive is modified.
   - **B, if it has git identity problems** (LESSONS #22: none on `pc_de_varginha`): now set it once in the new repo,
     `git -C C:/Users/caioa/dev/explorations config user.name …`; that config no longer syncs, so it's safe there.
   - **B's separate clone** `C:/Users/caioa/dev/launchpad-bodies`: check `git -C … remote -v`. If a remote points at
     the Drive path, re-point it: `git remote set-url <name> C:/Users/caioa/dev/explorations` (or GitHub).
5. **Push** (A, your call, it publishes): `git -C C:/Users/caioa/dev/explorations push origin main`.
   **B:** `git -C C:/Users/caioa/dev/explorations fetch origin` and check `git status` says up to date with `origin/main`.
6. **A:** `bash docs/leaving-drive.sh freeze --go --other-machine-copied` moves Drive's `.git` into
   `C:/Users/caioa/dev/_backup/` and writes `MOVED.md`. Drive syncs the removal to B; B's copy doesn't care.
7. **Start sessions from the new home:** `cd C:/Users/caioa/dev/explorations` then `claude`. Worktree sessions start
   in their worktree folders as before. Preview configs: the root `.claude/launch.json` was rewritten by `copy`.
8. **Update the contract** (first session in the new home, one commit, push): the edits in "After the move" below.
9. **Later, when sure:** delete the frozen Drive folder; keep `_backup/drive-git-<date>` a while longer.

**Rollback.** Before step 6 nothing in Drive changed except step 3's commit: to go back, run
`git -C "G:/Meu Drive/CLAUDE/fun" worktree repair <each worktree path>` and set the new folder aside. After step 6:
move `_backup/drive-git-<date>` back to `G:/Meu Drive/CLAUDE/fun/.git` and repair the same way.

## After the move: how working changes

The Drive folder used to share `ACTIVE_WORK.md` and `SESSION_LOG.md` between machines live, uncommitted. Now each
machine has its own copy, and they meet only through GitHub:

- **Claims:** `git pull` before reading `ACTIVE_WORK.md`; commit and push your claim (and its clearing). A claim that
  isn't pushed is invisible to the other machine.
- **Merging into `main`** (replaces LESSONS #22's "ff-only in the Drive folder"): merge `origin/main` into your branch in
  your worktree, test, then in the main clone `git pull --ff-only` and `git merge --ff-only <branch>`, then
  `git push origin main`. If the push is refused, `main` moved on the other machine: pull and repeat.
- **Shared docs** (`SESSION_LOG.md`, `ACTIVE_WORK.md`, `INDEX.md`, `TESTING.md`, `PLAYTEST.md`) are committed with the
  work, never left uncommitted for the other machine to see. Their merge conflicts are append-only: keep both sides.
- Pushing publishes (public repo). Work in progress that shouldn't be public stays unpushed in its worktree's branch.

**Text edits for step 8:** `docs/coordination.md` (Profile A: claims travel by push/pull, as above); `ACTIVE_WORK.md`
(the worktree section's "The Drive folder stays on `main`" → the main clone; the 2026-10-07 "repo move PLANNED" note →
done, with the date); `LESSONS_LEARNED.md` #22 (its procedure, as above); `PROJECT.md`/`AGENTS.md` only if they name the
Drive path (they don't today); the Claude memory note `shared-docs-commit-procedure` (it speaks of "the Drive repo").
