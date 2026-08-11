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

## Session 2026-08-11 — V2.3: stable basin identity, eased hues, hue drift
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-opus-5
**Status**: Complete

### Summary
User likes the basins look but found colour transitions abrupt, "especially when a cluster splits
into two basins", and asked for slowly cycling hues with a speed slider where zero is the current
behaviour. Most of the abruptness turned out not to be dots changing basin at all.

### The finding
Basin **ids come from scan order** — `analyseGraph` numbers cycles in the order the 0…n−1 walk
finds them. Any graph change can renumber wholesale, so an entire basin's colour flips even when
the partition barely moved; splitting a cluster renumbers everything after it, which is exactly
the case the user noticed. Basins are now ranked by the smallest node index **on their cycle**, a
property of the cycle rather than of discovery order.

### Decisions Made
- Basin colour is a **hue angle**, not a palette entry — which is what makes both easing and
  drift expressible. `BASIN_PALETTE` (hex) → `BASIN_HUES` (degrees); basins look emits `hsla()`.
- Per-dot eased hue at 3.5%/step (~1s), shortest way round the wheel.
- `Hue drift` in degrees per *simulation step*, shown as seconds per turn, 0 = fixed. Advances
  per step like the pulse, so slowing the sim slows the drift.
- Ribbon bucketing keys on quantised hue instead of basin id.

### Verification
Slot assignment distinct per basin, and unchanged across 25 recomputes of an identical graph —
the renumbering bug. Easing measured deterministically from ±150° and +179° offsets: max single
step 5–6°, converges within 2° in 120 steps, takes the short way in both directions. Drift exact
(9° over 30 steps at 0.3°/step); drift 0 leaves the offset untouched. Fossil test still 0. All 5
looks × both trail modes × drift + pulse + 40 re-rolls/sec + fractional stepping: no exceptions.

Perf, each measured in its own call: defaults 3.89 ms with only ~5 hue buckets occupied (settled
dots share their basin's hue, so hue bucketing is normally free). Churn at n=1200/K=128 hit
17.4 ms at 48 hue steps because each occupied bucket is a `stroke()` call; HQ 48 → 32 brought it
to 5.33 ms, back to parity with V2.2, with no visible change to the sweep.

### Next Steps
- [ ] `HUE_EASE` (0.035/step) is a constant — promote to a slider if the transition speed wants tuning
- [ ] Sub-step interpolation and accumulation/artifact mode both still parked

## Session 2026-08-11 — V2.2: ribbon flicker was three bugs; strobe promoted to a control
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-opus-5
**Status**: Complete

### Summary
User reported ribbons looking "jerky and unstable — lightning-like", with a visible strobe when
slowed down, and asked whether the strobe could become a deliberate pulse. Three independent
causes, all introduced in V2/V2.1. Fixed all three; added Pulse depth + period as real controls.

### The three causes
1. **Strobe** — speed measured per *frame* (distance since last draw) rather than per *step*. At
   fractional step rates most frames run no step, so every dot read as motionless and the field
   collapsed to minimum brightness, flaring when a step landed. The user's own observation that it
   vanished at low Speed → brightness pinned it exactly: brightness is `t = 1 − resp + resp·t_raw`,
   so `resp = 0` removes the term the artifact modulates.
2. **Global brightness swings** — `speedRef` was an EMA of the field *maximum*, so one dot rescaled
   all 500. Now tracks the mean.
3. **Whole-ribbon flashing** — each ribbon coloured by its dot's instantaneous speed. Each history
   vertex now carries the speed it was laid down at, and each age band shades by the mean speed
   *during that band*.

### Decisions Made
- Pulse phase advances per **simulation step**, not per frame, so the beat stays tied to the
  motion rather than the monitor. Default off.
- Kept the discrete geometry updates at low step rates — that's the simulation being slow, not a
  rendering fault. Smoothing it would need sub-step interpolation; noted, not built.

### Verification
Frame-to-frame variation in drawn ink (background-subtracted) at 0.25 steps/frame: 9.7% CV at
speed→brightness 0% vs 11.4% at 100%. Previously the variation was strongly coupled to that
slider; now the two are within noise, which is the fix. Pulse measured working: depth 0.8/period
20 swings ink 0.38×–1.65×, depth 0.4/period 60 gives 0.59×–1.27×.

Fossil test still 0 pixels left behind for ribbons. All 5 looks × both trail modes × pulse on:
no exceptions. Stress (fractional rate → scatter → n 180→520 → 8 steps/frame) clean.

### PARKED: benchmarking harness is unreliable
Sequential benches inside a single `javascript_tool` call degrade progressively — bloom measured
0.94 ms, then 44 ms, then 128 ms for the *same* config as the call went on. Isolated in its own
call it is 1.66 ms. Sustained synchronous work in the pane throttles rasterisation. **Only trust
the first bench in a call, or measure one config per call.** This nearly had me chase a
non-existent 55× regression. Real numbers, measured in isolation: bloom ~1 ms, ribbons ~2–5 ms at
defaults, worst case (n=1200, K=128) 5.2 ms after subsampling the band-average (was 18 ms).

### Next Steps
- [ ] Sub-step position interpolation, if the low-step-rate judder ever bothers anyone
- [ ] Accumulation/artifact mode still parked

## Session 2026-08-10 — V2.1: the trail haze was a rounding bug
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-opus-5
**Status**: Complete

### Summary
User reported long trails collapsing into "an undifferentiated blob in the background", and asked
for a fractional steps/frame slider. The blob turned out to be a fixed-point artifact of 8-bit
compositing, not an aesthetic property of long trails. Replaced the trail engine.

### The finding
The bloom veil is multiplicative — `V ← V − (V − bg)·a` — on an 8-bit canvas. Once
`(V − bg)·a < 0.5` the decrement rounds to zero and the pixel freezes permanently. Measured with
**nothing being drawn at all**, just the veil applied 3,400 times: 100,088 pixels (27% of canvas)
stuck at red=11 against bg=6, identical at 400 and 3,400 passes. That fossil — every path ever
taken — was the grey web. It also explains the user's own observation that it vanishes near trail
length 30: there `a = 0.70` and the floor drops below one level.

### Decisions Made
- **Ribbons as the new default trail engine.** Per-dot ring buffer of the last K positions,
  redrawn as real polylines onto a fully cleared canvas in 3 age bands. Nothing accumulates, so
  nothing fossilises; trail length is exact; overlapping streaks stay legible as overlaps.
- **Bloom kept**, because it's genuinely better at short trail lengths where the floor is
  invisible. The panel now says plainly why long bloom trails haze.
- **Fractional steps/frame** via an accumulator: below 1 it runs a step every 1/rate frames.
- **Basin palette reordered** so the first entries contrast hardest. Random functional graphs
  usually have 2–3 cycles, and hue-wheel order gave those red-orange + amber, reading as one
  colour. Caught by finally seeing a screenshot.

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | edited | `explorations/dots-friend-enemy/index.html` | Ring-buffer history, `drawRibbons`/`drawStreaks` split, bucketed batching, fractional stepping, trail-style switch, palette reorder |
| 2 | edited | `.../NOTES.md` | v2.1.0; "The haze was a bug, not a trail" with the measurements |

### Verification
Fossil test (render, teleport every dot into a corner, render 150 more frames, count what's left
in the vacated area): bloom leaves 34,876 of 35,742 lit pixels; **ribbons leave 0**. Re-run after
the batching refactor: bloom 25,839, ribbons 0.

Fractional stepping exact at 0.05/0.25/1/2.5/8 (5, 10, 40, 100, 320 steps per 40 frames). No
origin streak in the first 10 frames (ring-buffer head off-by-one caught and fixed before
testing). Basins still multi-hued after batching (50 distinct quantised colours); noir still
perfectly monochrome (0 chroma pixels). All 5 looks render under ribbons; heavy rerolling at
60/sec with a changing basin count doesn't over-index the bucket arrays.

Perf: ribbons were a real regression at 14.2 ms/frame vs bloom's 1.0 — 1,500 `stroke()` calls,
and canvas stroke cost is per-call. Bucketing dots by quantised speed × on-cycle × basin and
emitting one path per bucket brought defaults to **3.9 ms** and worst case (n=1200, K=128) to
**9.6 ms**.

**Saw it this time.** The preview pane composited, so the result was confirmed visually as well
as numerically — which is how the palette problem was spotted.

### Next Steps
- [ ] Bloom's floor could be pushed below visibility by clamping its minimum fade; currently just
      documented in the panel instead.
- [ ] Accumulation/artifact mode still parked (see `NOTES.md`)

## Session 2026-08-10 — Dots V2: rendering rewrite
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-opus-5
**Status**: Complete

### Summary
Rebuilt the rendering layer of the dots simulation around motion, after the user asked for a V2
with "a more aesthetic eye — maybe black and white even". Physics untouched. Five switchable
looks so the aesthetic call can be made by looking rather than by argument.

### Decisions Made
- **V1's colour encoded nothing** (`hue = index/n`; index relates to nothing in the system, and
  at n=400 hues sit ~1° apart, so it read as a uniform smear). Monochrome therefore costs zero
  information — the user's instinct was right. Every V2 look either drops colour or spends it on
  speed or graph structure.
- **Velocity streaks, not dots.** Draw the segment from last-frame position to current, with
  speed driving brightness and weight. Motion becomes the primary signal, which is what the user
  asked for ("definitely watch, movement is key").
- **Adaptive speed reference** rather than a fixed constant, so "fast" stays meaningful across
  any parameter set.
- **Friend-graph basins.** O(n) walk labels each dot with the cycle it drains into. Cycle members
  drawn brighter — they're the attractors the picture is organised around.
- **V1 archived**, not deleted, per the project's archive-over-delete rule.

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | archived | `explorations/dots-friend-enemy/archive/v1-rainbow-dots.html` | V1 preserved before rewrite |
| 2 | rewrote | `explorations/dots-friend-enemy/index.html` | Looks system, velocity streaks, `analyseGraph()`, skeleton emphasis, speed→brightness, keys 1–5 |
| 3 | edited | `.../NOTES.md` | v2.0.0; new "V2 — the rendering" section; basins follow-up checked off; artifact-mode idea added |
| 4 | edited | `explorations/README.md` | Status row |

### Verification
`analyseGraph()` tested against hand-built graphs (single 2-cycle with tails, two disjoint cycles,
self-loop, pure cycle) plus 40 random trials asserting structural invariants: every dot shares a
basin with its friend, no unlabelled dots, every basin contains ≥1 cycle member, and following
`friend` from any cycle member returns to itself. All pass. `basinCount` ≈ 2–3 for n≈200–1400,
matching the expected ½·ln(n) for a random functional graph.

Rendering exercised across all 5 looks plus streaks-off / skeleton-off / flat-speed / no-fade /
heavy-weight variants, plus n changed mid-flight (450→37→1400) and 400 frames at 60 re-rolls/sec:
no exceptions, no array desync, basin labelling stayed consistent. Speed distribution has real
dynamic range (median 0.28–0.60, 0.1% at ceiling). Perf: 800 dots at 5.9 ms/frame (2.8× headroom
at 60 fps), 2000 at 12.7 ms.

### PARKED / not done
- **No visual confirmation, again.** The preview pane never composites frames in this environment.
  I tried rendering a 5-look contact sheet offscreen and extracting it as base64 to look at
  directly; the transport truncated the string twice (13.3 KB of an expected 19.9 KB, then both
  split chunks short on write) and I stopped rather than keep paying for it. Parked at: numeric
  and structural verification complete, appearance unjudged. If this comes up again, write the
  image from the page via a download or a local server rather than piping base64 through tool
  output.

### Next Steps
- [ ] Pick a look (keys 1–5 switch live). `graphite` vs `noir` is the monochrome comparison.
- [ ] Follow-ups at the bottom of `dots-friend-enemy/NOTES.md`, incl. the accumulation/artifact mode

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
