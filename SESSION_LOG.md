# SESSION LOG
**Purpose**: Persistent record of all work across Claude Code sessions
**Format**: Reverse chronological (newest first)

---

## How to Use This Log

**Claude Code**: At the start of each session, read the **last 3 entries** for recent context (focus on the most recent Next Steps). Create a new entry at the top (below this section). Update it as work progresses. Mark it complete at session end.

**Manual changes**: Add an entry using the template below with `Source: Manual`.

### Entry Template

```
## Session YYYY-MM-DD — [Brief Title]
**Source**: Claude Code | Manual
**User**: [Name]
**AI Model**: [Model used, e.g. claude-opus-4-6]
**Status**: In Progress | Complete

### Summary
[1-3 sentences: what was accomplished and why]

### Decisions Made
- [Key decisions and rationale]

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | [created/edited/moved/deleted] | `filename` | [what changed] |

### Next Steps
- [ ] [Follow-up items for the next session]
```

---

<!-- New entries go here, above the line below -->

## Session 2026-08-10 — Project setup, exploration 1, and publication
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-opus-5
**Status**: Complete

### Summary
Instantiated the `fun` project from the framework template and built the first exploration: a
canvas simulation of dots that each chase one friend and flee one enemy, from a tweet by
@isaacking314. Tuning turned up a real finding — one of the two readings of the rules has no
stable, interesting regime.

### Decisions Made
- **Template instantiated into `fun/` root**, framework clone (`template/`, `shared/`) left in
  place alongside. Chosen by the user over a sibling folder.
- **Own public repo**: [`caio-camargo/explorations`](https://github.com/caio-camargo/explorations),
  published at [caio-camargo.github.io/explorations](https://caio-camargo.github.io/explorations/).
  `template/` and `shared/` are gitignored — they already have their own repo, and a second
  copy would drift. Root `README.md` was replaced with a project README (the framework one is
  still canonical in `../claude-project-framework/`).
- **Coordination Profile A** (file-based) recorded in `docs/coordination.md`.
- **`playbooks/`, `standards/`, `skills/` left dormant.** The template is heavier than a toy
  workshop needs; the rule is written into `PROJECT.md` § Ground Rules so future sessions
  don't manufacture ceremony for one-off toys.
- **Fixed-stride is the default reading of the rules** (see finding below).

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | created | `explorations/dots-friend-enemy/index.html` | Self-contained sim — canvas, no deps, no build. 5 presets, live parameter panel, trails, friend/enemy link overlay |
| 2 | created | `explorations/dots-friend-enemy/NOTES.md` | Rules → code mapping, tuning findings, next ideas |
| 3 | created | `explorations/README.md` | Branch index for explorations + the one-folder-per-idea contract |
| 4 | edited | `PROJECT.md` | Filled in for real: purpose, ground rules, structure, git warning, decisions |
| 5 | edited | `AGENTS.md` | Title; routing-tree pointer to `explorations/` |
| 6 | edited | `INDEX.md` | Added explorations / archive / framework-clone rows |
| 7 | edited | `docs/coordination.md` | Recorded Profile A |
| 8 | moved | `SETUP_CHECKLIST.md` → `archive/` | Setup complete |
| 9 | archived | `.git` → `../ARCHIVE/fun-framework-clone-git-2026-08-10/` | Was a clone of the framework repo. Verified byte-identical to `../claude-project-framework/` (same HEAD `40b1044`, all 8 dirty/untracked files identical) before moving. `WHAT_THIS_IS.md` written alongside. |
| 10 | created | `.gitignore`, `README.md`, `index.html` | Gitignored `template/` + `shared/`; project README; Pages landing page |
| 11 | edited | `skills/README.md`, `INDEX.md` | Replaced local `G:\Meu Drive\...` paths with repo links before going public |
| 12 | created | repo `caio-camargo/explorations` | Public, `main`, 24 files, Pages from root |

### Finding worth keeping
"Large step toward friend / small step away from enemy" has two readings, and they are not
equivalent:

- **Fixed stride** (constant px per step) is bounded by construction — repulsion is capped
  while the centre pull grows with distance. All the structure lives here.
- **Proportional** (a fraction of the gap) makes the update linear, so the whole system is one
  matrix with exactly two fates: when `2·kE > c` it inflates until ~50% of dots jam on the
  floor edge; when `2·kE < c` it contracts to a single point. No bounded middle. The tweet's
  own 0.5% centre pull sits in the inflating regime, which is evidence the original is
  fixed-stride.

Kept the proportional mode as the `linear` preset with a live regime readout, because the
failure explains the design better than a paragraph would.

### Verification
Physics checked programmatically (the preview pane never composited, so no visual confirmation
this session): all 5 presets over 1500–2000 steps — no NaN, nothing pinned to the floor edge
except `linear` by design, motion 0.37–1.05 px/step (alive, not frozen). Friend/enemy tie
invariants hold after 2000 steps at 60 re-rolls/sec. Render path exercised directly: ~25k lit
pixels, no exceptions across `step`/`draw`/links/floor/UI handlers/presets. Size-invariance
confirmed — same preset reaches the same fraction of the floor at 600×400, 1200×800, 3400×1800.

Pre-publication scan for secrets, emails and local paths: first attempt silently matched nothing
(broken shell expansion) and was re-run with a control test. The corrected scan found local Drive
paths in `INDEX.md` and `skills/README.md` — fixed before the repo was created. No credentials.

Post-publish: both URLs return 200, landing-page link resolves, and the sim runs from the live
origin with no console errors.

### Next Steps
- [ ] **Look at it.** Neither the local file nor the published page was ever visually confirmed —
      the preview pane never composited frames, so verification was numeric only.
- [ ] Follow-up ideas listed at the bottom of `dots-friend-enemy/NOTES.md`
