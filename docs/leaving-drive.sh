#!/usr/bin/env bash
# Moving the repo out of Google Drive. Runbook: docs/leaving-drive.md (read it first).
# Git Bash on Windows. Every step that changes something needs --go; without it, it only says what it would do.
#
#   leaving-drive.sh check            read-only: is this machine ready? (run on BOTH machines)
#   leaving-drive.sh commit [--go]    commit the Drive folder's pending files on main (ONE machine, once)
#   leaving-drive.sh copy   [--go]    copy .git out of Drive into the new home, check it out, carry untracked and
#                                     ignored files over, re-point this machine's worktrees, copy Claude's memory
#                                     (BOTH machines, each once, before freeze)
#   leaving-drive.sh freeze [--go] --other-machine-copied
#                                     move Drive's .git into a local backup and leave MOVED.md (ONE machine, last)
#
# Paths can be overridden: DRIVE (the Drive checkout; default: this script's repo), NEW (default ~/dev/explorations),
# BACKUP (default ~/dev/_backup).
set -u
HOME_W=$(cygpath -m "${USERPROFILE:-$HOME}")
DRIVE=${DRIVE:-$(cd "$(dirname "$0")/.." && pwd)}; DRIVE=$(cygpath -m "$DRIVE")
NEW=${NEW:-$HOME_W/dev/explorations}
BACKUP=${BACKUP:-$HOME_W/dev/_backup}
STAMP=$(date +%Y-%m-%d)
cmd=${1:-check}; shift || true
GO=0; OTHER=0; for a in "$@"; do case $a in --go) GO=1;; --other-machine-copied) OTHER=1;; *) echo "unknown option $a"; exit 2;; esac; done
say(){ printf '%s\n' "$*"; }
warn(){ printf 'WARN  %s\n' "$*"; WARNS=$((WARNS+1)); }
stop(){ printf 'STOP  %s\n' "$*"; exit 1; }
run(){ if [ $GO = 1 ]; then say "+ $*"; "$@" || stop "failed: $*"; else say "(would) $*"; fi; }
WARNS=0
G(){ git -C "$DRIVE" "$@"; }
# a worktree is "ours" (this machine's) if its folder exists here and its .git file points into the Drive repo
ours(){ [ -f "$1/.git" ] || return 1; local g d; g=$(tr '\\' / < "$1/.git"); g=${g,,}; d="${DRIVE,,}/.git/worktrees/"; [[ $g == *"$d"* ]]; }
# Claude Code keeps per-folder memory under ~/.claude/projects/<path with every non-alphanumeric char as '-'>
ckey(){ printf '%s' "$(cygpath -w "$1")" | sed 's/[^A-Za-z0-9]/-/g'; }
worktrees(){ G worktree list --porcelain | sed -n 's/^worktree //p' | tail -n +2; }

case $cmd in
check)
  say "Drive checkout: $DRIVE"; say "New home:       $NEW"; say "Backup:         $BACKUP"; say
  [ -d "$DRIVE/.git" ] || stop "no .git in $DRIVE (already frozen?)"
  [ -e "$NEW" ] && warn "$NEW already exists: copy refuses to run over it"
  [ -e "$DRIVE/.git/index.lock" ] && warn "$DRIVE/.git/index.lock exists: a git command is running (or crashed); see LESSONS #25"
  say "-- integrity (fsck, connectivity)"; G fsck --connectivity-only --no-dangling >/dev/null 2>"$TEMP/ld_fsck.txt" && say "ok" || { cat "$TEMP/ld_fsck.txt"; warn "fsck reported problems (LESSONS #19 has the recovery)"; }
  say "-- Drive checkout: branch $(G branch --show-current), HEAD $(G rev-parse --short HEAD)"
  m=$(G status --porcelain --untracked-files=no | wc -l); [ "$m" = 0 ] && say "no tracked changes" || { G status --short --untracked-files=no; warn "$m tracked file(s) changed: 'commit' takes them"; }
  u=$(G ls-files --others --exclude-standard); [ -n "$u" ] && { say "untracked (commit takes the ones worth keeping; copy carries all of them):"; G status --short | grep '^??'; }
  say "ignored files copy will carry over (not in git):"; G status --ignored --short | grep '^!!' | sed 's/^!! /  /'
  if G rev-parse -q --verify origin/main >/dev/null; then say "-- GitHub: main is $(G rev-list --count origin/main..main) commit(s) ahead of origin/main (as of the last fetch)"; else warn "no origin/main: GitHub is how the machines will sync afterwards"; fi
  say "-- worktrees"
  while IFS= read -r w; do
    if [ ! -d "$w" ]; then say "  other machine: $w (it repairs its own)"; continue; fi
    if ! ours "$w"; then warn "  $w exists here but isn't linked to this repo: check it by hand"; continue; fi
    # repair only rewrites the worktree's .git pointer: its files (and its index, inside the copied .git) come along as
    # they are, so uncommitted work survives; committing it first is still the clean way to pause
    b=$(git -C "$w" branch --show-current); c=$(git -C "$w" status --porcelain --untracked-files=no | wc -l); n=$(git -C "$w" ls-files --others --exclude-standard | wc -l)
    mg=$(G merge-base --is-ancestor "$(git -C "$w" rev-parse HEAD)" main && echo "in main" || echo "has commits main lacks")
    say "  this machine: $w [${b:-detached}] $c tracked change(s), $n untracked, $mg"
    [ "$c" = 0 ] || warn "  $w has uncommitted tracked changes: better committed in that session before the pause"
  done < <(worktrees)
  say "-- processes that may be sessions or dev servers"; tasklist 2>/dev/null | grep -i -E "^(node|python|claude)" | awk '{print $1}' | sort | uniq -c
  say; [ $WARNS = 0 ] && say "READY on this machine." || say "$WARNS warning(s): resolve them, then run check again."
  ;;
commit)
  [ "$(G branch --show-current)" = main ] || stop "the Drive checkout is not on main"
  say "Commits on main in $DRIVE: tracked changes plus these untracked files:"
  K=(explorations/launchpad/PLAYTEST.md explorations/launchpad/TECH_SCOUTING.md explorations/pulse-loop)
  for k in "${K[@]}"; do [ -e "$DRIVE/$k" ] && say "  $k"; done
  say "(.claude/launch.json stays untracked: it holds this machine's paths; copy carries it.)"
  run git -C "$DRIVE" add -u
  for k in "${K[@]}"; do [ -e "$DRIVE/$k" ] && run git -C "$DRIVE" add -- "$k"; done
  run git -C "$DRIVE" commit -m "Shared docs and untracked work, before the repo leaves Google Drive" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  say "Then wait until the other machine's Drive shows this commit (its 'check' prints HEAD) before it runs copy."
  ;;
copy)
  [ -e "$NEW" ] && stop "$NEW already exists"
  [ -e "$DRIVE/.git/index.lock" ] && stop "index.lock in the Drive repo: something is running"
  [ "$(G status --porcelain --untracked-files=no | wc -l)" = 0 ] || stop "tracked changes in the Drive checkout: run 'commit' first (on one machine)"
  G fsck --connectivity-only --no-dangling >/dev/null 2>&1 || stop "fsck failed on the Drive repo: repair first (LESSONS #19)"
  H=$(G rev-parse HEAD); say "Drive HEAD $H ($(G branch --show-current))"
  run mkdir -p "$NEW"
  run cp -a "$DRIVE/.git" "$NEW/.git"
  run git -C "$NEW" reset -q --hard HEAD
  if [ $GO = 1 ]; then
    [ "$(git -C "$NEW" rev-parse HEAD)" = "$H" ] || stop "HEAD differs after the copy"
    git -C "$NEW" fsck --no-dangling >/dev/null 2>&1 || stop "fsck failed on the copy: nothing in Drive was touched; remove $NEW and retry"
    say "copy verified: HEAD $H, fsck clean"
  fi
  # untracked and ignored files: not in git, so carried over by hand (framework copy, raw outputs, local config…)
  while IFS= read -r f; do f=${f%/}; run mkdir -p "$NEW/$(dirname "$f")"; run cp -a "$DRIVE/$f" "$NEW/$f"; done < <(G ls-files --others --exclude-standard --directory; G ls-files --others --ignored --exclude-standard --directory)
  [ -f "$NEW/.claude/launch.json" ] && run sed -i "s#$DRIVE#$NEW#g" "$NEW/.claude/launch.json"
  # this machine's worktrees point at the copy; the other machine's registrations are dropped from this copy only
  while IFS= read -r w; do [ -d "$w" ] && ours "$w" && run git -C "$NEW" worktree repair "$w"; done < <(worktrees)
  run git -C "$NEW" worktree prune -v
  # Claude Code memory for the new folder (sessions started there read it)
  OM="$HOME_W/.claude/projects/$(ckey "$DRIVE")/memory" NM="$HOME_W/.claude/projects/$(ckey "$NEW")/memory"
  if [ -d "$OM" ] && [ ! -e "$NM" ]; then run mkdir -p "$(dirname "$NM")"; run cp -a "$OM" "$NM"; else say "memory: nothing to copy ($OM → $NM)"; fi
  [ $GO = 1 ] && { say; git -C "$NEW" worktree list; say; say "Done on this machine. Next: the other machine runs check and copy; then push and freeze (runbook)."; }
  ;;
freeze)
  [ $OTHER = 1 ] || stop "freeze removes .git from Drive for BOTH machines: pass --other-machine-copied once the other machine's copy is verified"
  [ -d "$NEW/.git" ] || stop "no copy at $NEW on this machine"
  [ "$(git -C "$NEW" rev-parse HEAD)" = "$(G rev-parse HEAD)" ] || warn "the copy's HEAD differs from Drive's (new commits since the copy are fine; check it's not the other way round)"
  [ "$(G rev-list --count "$(git -C "$NEW" rev-parse HEAD)"..HEAD 2>/dev/null || echo 1)" = 0 ] || stop "Drive has commits the copy lacks: fetch them into the copy first"
  run mkdir -p "$BACKUP"
  run mv "$DRIVE/.git" "$BACKUP/drive-git-$STAMP"
  if [ $GO = 1 ]; then cat > "$DRIVE/MOVED.md" <<EOF
# This folder is a frozen snapshot

On $STAMP the repository moved out of Google Drive (a live .git in a synced folder corrupted objects: LESSONS #19, #25).

- Work happens in each machine's own clone: \`C:/Users/caioa/dev/explorations\`, synced through GitHub
  (https://github.com/caio-camargo/explorations).
- The Drive repo's \`.git\` is kept at \`$BACKUP/drive-git-$STAMP\` on the machine that froze it.
- Nothing here is updated any more. Don't edit; delete the folder once you're sure (the runbook's last step).
EOF
  say "wrote $DRIVE/MOVED.md"; fi
  ;;
*) sed -n '2,15p' "$0"; exit 2;;
esac
