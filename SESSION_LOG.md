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

## Session 2026-08-11 — v2.6.2: corona tune (darker, crisp inner edge)
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-fable-5
**Status**: Complete

### Summary
User: corona purple should be darker, and it shouldn't be diffuse on the inside. Sprite stops
reshaped — hard step at 0.695→0.71 of radius, skirt only outward — and tints dropped from
185,130,255-family to 120,70,200-family (60,40,110 ink on graphite). Measured radial profile on
noir over empty black: 0 luminance through 65% of radius, 215 at the rim (was 301), 74 at 85%,
0 outside. The horizon is an edge now.

### Next Steps
- [ ] Image as a sampled field — still specced, still next

## Session 2026-08-11 — V2.6.1: void corona + eased lunge
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-fable-5
**Status**: Complete

### Summary
User feedback on V2.6: the void is invisible on black backgrounds ("maybe a black hole with a
purple corona"), and the lunge is a little jerky. Both fixed.

### Decisions Made
- **Corona**: the bg-coloured core only occludes light, so over empty black it's nothing. Added a
  thin violet ring sprite (transparent centre, peak at 0.72 of radius) drawn in the look's blend
  mode over the core; per-look tints (violet family on dark grounds, dark ink on graphite).
  Measured on noir over an emptied region: centre 0, ring 301, outside 0 — the event horizon
  exists everywhere now.
- **Lunge jerk had two sources**: velocity stepped 0.12×→4.5× in one frame, and the heading was
  recomputed every step, so it flipped 180° when passing the mark. Now: velocity eases at
  0.4/step (~4 steps to 90%, still explosive) and the lunge heading locks at the coil. Max
  per-step speed change halved (9.9 → 4.46 px) with the same 10.2 px peak; rhythm intact
  (64/6/9/21, 17 lunges per 4000 steps).

### Verification
Jerk + rhythm measured headless over 4000 steps; corona pixel-tested on noir over pure black;
all 5 looks × void render clean; bounded, no NaN. No screenshot — pane didn't composite.

### Concurrency
Slime-mold session active concurrently (new exploration); its hunks in `explorations/README.md`
and `index.html` left unstaged, dots files committed surgically.

### Next Steps
- [ ] Judge corona width/brightness by eye — the sprite stops are one block to tune
- [ ] Image as a sampled field — still specced, still next

## Session 2026-08-11 — Exploration 3: slime mold (Physarum)
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-fable-5
**Status**: Complete

### Summary
Third exploration, chosen from the remaining brainstorm options (over RPS swarm and gravity).
Jones (2010) Physarum: agents sense a trail field with three whiskers, steer toward the
strongest reading, move, deposit; the field diffuses and evaporates. Networks emerge by
stigmergy. New infrastructure: a continuous Float32 field alongside point agents.

### Decisions Made
- **Fixed 640×400 Float32 torus field.** Fixed → monitor-independent physics (lesson 3);
  Float32 → evaporation reaches zero, the 8-bit fossil trap is impossible by construction
  (lesson 6); torus → networks wrap instead of hitting walls. Canvas is a pure view, cover-fit.
- **No deposit-strength slider, on purpose**: agents steer by comparing readings, so scaling all
  deposits cancels — the system is scale-free in trail units. Panel says so.
- **Sequential agent updates** are safe here (unlike dots): interaction is only through a field
  that diffusion delays by a step, so order bias is negligible. Noted in code.
- All prior lessons applied from day one: dt-based stepping, per-step sampling, tooltips,
  auto-exposure display, DOM assertions.
- Field pass rewritten branch-free/division-free (edge columns peeled, /9 folded into the blend
  constant) after profiling showed it at ~85% of step cost.

### Verification
Network formation measured, not eyeballed: from a cleared field under `veins`, coverage
collapses 9.5%→2.5% while contrast climbs 20→71 over 1800 steps. Four presets measurably
distinct: storm churns 53% more than veins at 3× the contrast; cells is 12× storm's coverage
at an eighth of its contrast. (Honest gap: veins vs filigree differ in structure *scale*,
which these metrics can't see — autocorrelation length parked as next.) Torus containment and
NaN checks clean across all presets. dt arithmetic exact at 60/20 fps and fractional rates.
DOM: 3 looks, 4 presets, 8 tooltipped sliders all live.

### PARKED: harness CPU throttling, now confirmed
The hidden pane throttles JS ~10× — a branch-free 512k-op loop benched at 65 Mops/s, which is
not a real number. This retro-explains every "perf regression" scare in earlier sessions
(lesson 8's degradation was throttling, not JIT decay). Absolute costs from this harness are
unusable; only ratios (field ≈ 2× agents at n=6000) and deltas within a call carry information.
Real frame cost needs a visible page. Levers if heavy live: half-res field, or diffusion every
other step — both documented in NOTES.

### Concurrency
Claimed before writing. Fireflies v1.2 session ran concurrently (soft glow sprites) with
overlapping claims on SESSION_LOG.md and explorations/README.md; checked its committed state
and diffs before staging — my hunks are disjoint (new row, new entry).

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | created | `explorations/slime-mold/index.html` | The sim — one file, no deps |
| 2 | created | `explorations/slime-mold/NOTES.md` | Mechanism, design decisions, measured anatomies, perf caveat, open threads |
| 3 | edited | `explorations/README.md` | Slime-mold row |
| 4 | edited | `index.html` | Landing-page card |
| 5 | edited | `PROJECT.md` | Current Focus |

### Next Steps
- [ ] **Look at it** — `veins` from a cleared field for two minutes, then `ink`
- [ ] Report real fps from a visible page; apply the documented levers if heavy
- [ ] Open threads: food sources (Tokyo rail), autocorrelation metric, obstacles, relief look

## Session 2026-08-11 — Fireflies v1.2: soft glow sprites
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-fable-5
**Status**: Complete

### Summary
User: the blink radius is too sharply marked, wants diffuse edges, unsure of the perf cost.
Flashes were flat-alpha filled circles — hard-rimmed coins, not light. Replaced with cached
radial-gradient sprites; the perf answer is that done right it's *cheap*, not costly.

### Decisions Made
- Gradient stops per look, hot centre → look colour → transparent, same RGB throughout (no grey
  in the fade). Rendered once per (look, hue-bucket) into a 64px sprite, blitted thereafter.
- `phase` look gets 32 hue-bucketed sprites (11.25°, the banding-invisible quantum from dots).
  Cache tops out at 34 canvases.
- First cut: 3 blits per glowing fly → 27 ms at the n=2000 all-glowing extreme. Consolidated to
  one blit per flash (hot centre baked into the sprite, stops re-tuned hotter) + idle body
  skipped under a strong flash → 19.6 ms extreme, **4.35 ms at default n=700 fully synced**.
- Wall-clock stepping (previous session) means heavy frames now cost smoothness only, never
  physics speed — the two fixes compose.

### Verification
Radial luminance profile of a full flash: 674→547→345→…→34→24→bg, smooth glide, no rim step
anywhere (steepest gradient is the hot core, as intended). Idle profile likewise (131→56→32→bg).
All 3 looks render clean post-change; sprite cache bounded at 34. Perf first-bench per call.
No screenshot — pane never composited; profiles are pixel-measured, so edge softness is
verified numerically even without eyes on it.

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | edited | `explorations/fireflies/index.html` | LOOKS → gradient stops; sprite cache + blit rendering; idle-skip; v1.2 |
| 2 | edited | `explorations/fireflies/NOTES.md` | "Soft glow (v1.2)" section with profiles and costs |
| 3 | edited | `explorations/README.md` | Fireflies row → v1.2 |

### Next Steps
- [ ] Judge the softness by eye — stops are trivially tunable if the skirt is too wide/narrow
- [ ] Open threads unchanged (chimeras, Kuramoto coupling, obstacles, sound)

## Session 2026-08-11 — V2.6: stalking predator + agent appearance workshop
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-fable-5
**Status**: Complete

### Summary
User: agents co-move too much, hunt is too static — wants variable speed, lunges, cluster
targeting ("not sure how mathematically costly that is" — answer: cheaper than what it replaced),
and to workshop agent looks. Rebuilt the hunt as a state machine; agent appearance is now a
four-way switch (hidden / glow / comet / void).

### Why they co-moved
The hunt steered at the soft centroid of ALL dots; the attractor owns most of the mass, so that
centroid IS the attractor's pile. Structural. Fix: commit to one *cluster* (coarse 14×10 grid,
O(n) binning every 12 steps — replaces O(n) weighting every step, so net cheaper), chosen with a
*squared* attractor-distance bias (mild bias still handed it the same pile).

### The state machine
prowl (variable pace + wander) → windup (the coil, near-still) → lunge (4.5×, aim locked at the
coil so fleeing dots make it overshoot) → recover → retarget. First tune collapsed into
lunge-every-1.6s with 1% prowling; a minimum-prowl counter (80–220 steps) restored the stalk.
Final rhythm: 70/6/5/19% across states, lunge every ~4s, step size bimodal (p10 0.8 px → 10 px),
predator–attractor distance median 0.21 of floor (p10 0.09, was glued at ~0.06 before the bias).
State shows in the stats line.

### Agent styles
`hidden` (purist default), `glow` (sprite fields), `comet` (agents get their own ribbons — a
lunge stretches into a dash), `void` (predator as a bg-coloured absence — verified occlusion,
centre luminance 27 vs 54 at its rim; attractor as a pinprick star). All 4 × all 5 looks: no
exceptions. showAgents checkbox replaced by the style row; no stale references (grepped).

### Verification
Behaviour measured headless via step() (3000–4000 steps): states, lunge cadence, bimodal speeds,
decoupling, boundedness, no NaN. One measured "bug" was a harness artifact: a 137px max step was
the leash-snap of a stale corner position after page reload, not a real jump (real max = lunge
10px). DOM: 4 style buttons visible+titled, looks 5/5, stats line shows predator state (verified
via a manual frame() call — draw()-driven harnesses never exercise frame()). Perf first-bench:
17.8 ms worst case (n=1200, K=128, hunt + comet), in line with the ~15–17 ms session baseline.

### Note
Built on top of the wall-clock stepping fix (9c24532) from the concurrent session; read its diff
before editing. Claimed scope first; no overlap conflicts this time.

### Next Steps
- [ ] User workshops the four agent styles by eye — that's the point of the switch
- [ ] Image as a sampled field — still specced, still next
- [ ] If the lunge cadence feels wrong live, the constants are all in one place (PRED block)

## Session 2026-08-11 — Hotfix both sims: render cost was leaking into physics speed
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-fable-5
**Status**: Complete

### Summary
User: "dot size changes the movement speed. this also happened in the other one." Real, and the
mechanism is shared: both sims advanced the simulation per *frame*, so anything that raises draw
cost (dot size, stroke weight, population) lowers fps and slows the whole world in wall-clock
terms. Measured: fireflies draw cost spans 8–30 ms across the dot-size range — right across the
16.7 ms frame budget, so fps (and therefore world speed) genuinely tracked dot size.

### Fix
Advance by wall-clock time: `stepAcc += stepsPerFrame · min(dt,100)/16.7ms` in both frame loops.
"Steps/frame" semantics preserved at 60 fps; a 100 ms stall clamp prevents backgrounded-tab
replay. Applied identically to `fireflies/index.html` and `dots-friend-enemy/index.html`.

### Verification
Monkey-patched the step functions and drove `frame()` with synthetic timings in both sims:
2 s of wall-clock yields 119–120 steps at 60, 30, and 20 fps alike (was 120/60/40 before);
fractional 0.25× over 4 s yields exactly 60; a single 5-second stall frame runs 6 steps, not 300.
No console errors on either page after the patch.

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | edited | `explorations/fireflies/index.html` | dt-based stepping |
| 2 | edited | `explorations/dots-friend-enemy/index.html` | dt-based stepping (frame loop only — V2.5 code untouched otherwise) |
| 3 | edited | `LESSONS_LEARNED.md` | Lesson 11: per-frame stepping couples render cost into physics |

### Next Steps
- [ ] Confirm by feel: dot size / stroke weight should no longer change apparent speed

## Session 2026-08-11 — Fireflies v1.1: parameter atlas, log nudge, live regime label
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-fable-5
**Status**: Complete

### Summary
User feedback: interesting patterns needed finicky fiddling, ~half the sight-radius range was all
unison, sliders needed tooltips — and "you can measure this with metrics, not visual rendering."
Did exactly that: two 7×7 headless sweeps of radius × nudge (at ±3% and ±12% clock diversity),
classified every cell, and let the map drive the controls.

### The findings
- **The unison wall starts at radius ~25%** (at any nudge ≥ 0.8%) — the user's estimate was
  exactly right; nearly half the old 2–45% slider sat past the boundary.
- **Nudge is perceptually logarithmic**: the whole incoherent→waves→unison transition lives
  between 0.4% and 3% — a 5% sliver of the old linear 0–20% slider. *That* was the finicky
  feeling, more than the radius.

### Decisions Made (freedom vs steering)
Recalibrate ranges so travel is spent where the physics is; **instrument the state instead of
fencing the input**. Radius now 2–30% (wall at ~⅔ travel, still reachable on purpose). Nudge
log-scaled with a true off-detent (mid-travel = 2.4%, inside the transition; was 10%, deep
unison). A live regime classifier — same thresholds that read the sweep — names the current
state in the stats line and meter: no coupling / incoherent / waves / partial sync / unison.
Tooltips on every slider. Atlas published in NOTES.md.

### Verification
Log mapping round-trips at all test values including the NG_MIN boundary (first cut collapsed
0.3% into the off-detent — off-by-one at the detent edge, fixed by starting the scale at the
next step). Classifier census over all five presets: twinkle "no coupling", waves "waves"
throughout, unison passes "partial sync" while forming then locks, stubborn narrates its
metastability (mostly partial, honest excursions to unison at swing peaks — which required the
unison label to demand low variance as well as high order). DOM asserted: 9/9 sliders carry
real tooltips, new ranges live, drag simulation confirms slider→P wiring through the transforms,
off-detent works.

### Concurrency
Claimed before writing; dots V2.5 session ran concurrently with overlapping claims on
SESSION_LOG.md and explorations/README.md — checked diffs for foreign hunks before staging.

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | edited | `explorations/fireflies/index.html` | Log nudge slider + off-detent, radius 2–30%, regime classifier + label, tooltips, slider transform machinery |
| 2 | edited | `explorations/fireflies/NOTES.md` | v1.1 — "The parameter atlas" with both maps, what changed and why, the freedom-vs-steering position |
| 3 | edited | `explorations/README.md` | Fireflies row → v1.1 |

### Next Steps
- [ ] Feel the difference live — nudge mid-travel should now sit in the transition, and the
      regime label should flip as you cross boundaries
- [ ] Open threads unchanged: chimera hunting, Kuramoto coupling, obstacles, sound

## Session 2026-08-11 — V2.5: bow-shock disturbance rendering + tooltips
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-fable-5
**Status**: Complete

### Summary
User said the agents "don't look like much" — correct: they were wireframe debug circles in a
piece with no other hard edges. Brainstormed four directions, chose bow shock (agents visible
only through what they do to the dots), measured before designing, built it. Also added hover
tooltips to every control (user request mid-session).

### The measurement that shaped the design
Density at the predator's rim is ~500× the far field with an empty interior — the front is
razor-sharp already. But dots AT the front have near-zero radial velocity (cos 0.03): they're
**pinned**, not fleeing; the returning wake behind runs cos −0.30. So colouring by flee-velocity
would leave the most dramatic dots unmarked. Design: proximity carries the heat, velocity
modulates, and an asymmetric ease (attack 0.5/step, decay 0.035/step) makes the warm wake draw
itself. Quadratic falloff instead of linear because the pinned front sits at ~0.75 of the felt
radius — heat there nearly doubled (mean u 0.25 → 0.48).

### Decisions Made
- One signed axis u ∈ [−1, +1]: predator = hot, attractor = cold. Expressed **per look** because
  hue is spoken for in `basins` — there, hot blows out toward white with hue unchanged (shock
  without lying about identity); monochromes use ink pressure; phosphor/ember shift temperature.
- u = 0 is the exact identity (verified against pre-change colour strings) and sits at a bin
  centre (DQ = 7, odd), so undisturbed fields cost nothing extra in the ribbon bucketing.
- "Show them" redone as soft radial glows in the look's blend mode. First cut rebuilt gradients
  per frame: ~30 ms. Cached 128px sprite + drawImage: ~1.6 ms.
- Tooltips via one TIPS map assigned to rows/labels in a single pass; dynamic buttons (looks,
  trails, presets) get titles at creation. First draft assigned titles before the buttons
  existed — caught by checking creation order, moved to creation sites.

### Verification
Identity: agents off → max|dst| = 0, colour strings byte-match the old formulas. Channel: hot
mean +0.48 inside the felt zone, cold −0.52 on the attractor, ~0 far field (measured with each
agent alone — the first combined scenario was degenerate: attractor gathers everyone, predator
parks on top, all 400 dots in one zone). All 5 looks × both trails × glow: no exceptions. DOM:
all 31 controls + 12 buttons carry non-empty titles; look buttons still 5/5 visible. Perf, first
bench per call only: 17.1 ms worst case with glow vs 15.2 baseline in the same environment
(cross-session absolutes drifted ~5 ms; deltas are what count).

### Concurrency
Claimed scope in ACTIVE_WORK **before** editing this time. A concurrent fireflies session is
active with its own claim; shared files checked for foreign hunks before staging.

### Next Steps
- [ ] Image as a sampled field — still the specced next thing
- [ ] Look at the shock live: predator on, hunts on, `basins` or `ember`, Show them off

## Session 2026-08-11 — Exploration 2: fireflies (pulse-coupled sync)
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-fable-5
**Status**: Complete

### Summary
User wanted a second exploration reusing the dots infrastructure. Chose fireflies from four
pitched options (fireflies / rock-paper-scissors / slime mold / gravity). Built
`explorations/fireflies/` — Mirollo–Strogatz pulse-coupled oscillators: clocks flash at
midnight, flashes nudge neighbours' clocks, nudges past midnight cascade. Sync emerges from
flashes alone. Reuses the dots discipline (fractional stepping, per-step sampling, full-clear
rendering, panel) but is a fresh single file, not a fork.

### Decisions Made
- **Concave nudge** `ε·(0.25+0.75θ)` — the M–S condition that makes absorption stick.
- **Spatial grid** (counting sort) for flash propagation — at full sync every fly flashes in one
  step, so naive neighbour checks would be n² in that step.
- **Sync meter** shows the Kuramoto order parameter r with a scrolling trace; presets restart it.
- **Presets tuned by measurement**: unison at ~1600 steps to r>0.9 (first attempt synced in <600 —
  too fast to watch); "stubborn" needed nudge cut to 0.6%/flash after 3%-with-18%-spread synced
  anyway. Finding: **cascades make effective coupling far stronger than per-flash arithmetic
  suggests**; the partial-sync boundary lives at much weaker coupling than intuition puts it.
- Default load tuned to a ~50s twinkle→struggle→lock arc (r: 0.52, 0.26, 0.71, 0.75, 1.0).

### Verification
Control (nudge 0) stays at r≈0.034≈1/√n. Waves: local order 0.56 vs global 0.18 — the
travelling-front signature, measured. Cascade at nudge 0.5: queue peaks at exactly n, terminates,
no NaN. Perf isolated: n=2000 with all 2000 glowing = 1.7 ms/frame. DOM asserted per dots lesson
#10: 3 looks × 5 presets × 9 sliders × 6 buttons all visible under every look; presets apply and
desync. Degenerate 1×1 canvas disables coupling (radius guard) and re-scatters on real resize.
**Not visually confirmed** — pane never composited; numbers only.

### Concurrency note
`dots-friend-enemy/index.html` had uncommitted changes from outside this session (an "Influences"
group: attractor/predator) with no ACTIVE_WORK claim. Claimed fireflies scope in ACTIVE_WORK.md,
left the dots file untouched and **uncommitted**, and committed surgically (fireflies + doc rows
only, no `git add -A`).

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | created | `explorations/fireflies/index.html` | The sim — one file, no deps |
| 2 | created | `explorations/fireflies/NOTES.md` | Mechanism, measured regimes, cascade finding, open threads |
| 3 | edited | `explorations/README.md` | Fireflies row |
| 4 | edited | `index.html` | Landing-page card |
| 5 | edited | `PROJECT.md` | Current Focus |
| 6 | edited | `ACTIVE_WORK.md` | Claim + note about unclaimed dots changes; cleared at close |

### Next Steps
- [ ] **Look at it** — the ~50s default arc, then `waves` in the `phase` look
- [ ] Open threads in `fireflies/NOTES.md`: chimera hunting, Kuramoto coupling, obstacles, sound
- [ ] The dots "Influences" work is still uncommitted on disk — whoever owns it should commit or claim it

## Session 2026-08-11 — V2.4: influences (wandering attractor + hunting predator)
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-opus-5
**Status**: Complete

### Summary
User proposed two extensions: extra entities (predator, a movable version of the centre
attractor), and an image the dots trace without it being drawn. Observed that **both are the same
feature** — the centre pull is already an external field — so built one generalised influences
layer and the two entities on top of it. Image field is specced and next, not built.

### Decisions Made
- Dot rule is now `friend + enemy + Σ(fields)`. The centre stays as the leash rather than being
  replaced, because boundedness depends on it (repulsion capped, centre term grows with distance).
- Predator steers toward **nearby mass**, weighting every dot by `1/(1 + d²/r²)` — O(n), no
  sorting, no flip-flopping between nearest neighbours. Dots flee, so the target slides away;
  that feedback is the chase.
- Predator repulsion falls off **linearly to zero** at its radius, so it stays capped.
- Agents **invisible by default** — the hole and the wake are more interesting than a circle.

### Verification
Predator hunts: closes from 361 px to 2 px from the swarm centroid over ~500 frames and stays
locked. Carves: 1 dot of 500 within half its radius vs all 500 within two radii — 0.2% observed
against 6.25% for a uniform distribution, a 30× depletion. Attractor gathers: mean distance 23 px
to the attractor vs 127 px to the centre. Orbit mode travels 173 px.

Boundedness held at maximum settings for attractor, predator, and both together — nothing pinned,
no NaN. **One degenerate case found**: centre pull 0 + predator on + attractor off leaves nothing
holding the swarm in and pins 52% on the floor edge. Now warned in the panel (same pattern as the
`linear` regime readout); either field restores the leash.

DOM checked alongside physics this time — agent rows appear/disappear with their toggles, all
five look buttons remain visible in every state. That was the regression from last session.

### PARKED: perf harness bit again
First measurement said agents cost 15.4 ms vs 5.3 ms — a 3× regression. Stroke-call counts only
went 43 → 62, which couldn't explain it, so I re-measured one config per call: **8.64 ms agents
off, 9.88 ms on**, with `updateAgents()` itself at 0.03 ms/step. The 15.4 ms was harness drift.
Absolute timings are not comparable across calls; only same-call, same-methodology ones are.

### Next Steps
- [ ] **Image as a sampled field** — specced in full at the top of NOTES.md's "Things worth
      trying next", including the pyramid approach and the two things known in advance (inverted
      rendering; the interesting regime is barely-legible)

## Session 2026-08-11 — "Sticky basins" investigated (not a bug); docs made resumable
**Source**: Claude Code
**User**: Caio
**AI Model**: claude-opus-5
**Status**: Complete

### Summary
User saw two spatially separate groups sharing a basin colour and suspected the basin recompute
was "too sticky". Measured: it isn't. Then did a documentation pass so the exploration can be
picked up cold in a later session.

### The investigation
Two hypotheses ruled out by measurement:
- **Staleness** — perturbed a settled run with 12 forced re-rolls, stepped one frame: `graphDirty`
  cleared and membership had already changed within that frame. Recompute is immediate.
- **Palette collision** (`slot = rank % 8`) — over 300 random graphs at n=500 the basin count
  peaked at 7. Distribution: 1 basin 14%, 2 30%, 3 31%, 4 17%, 5+ 8%. Never collides.

What's real: **a basin is a graph property, not a spatial one.** Flood-filling into spatial
clusters and cross-tabbing on a settled 500-dot run, basin 0 spanned three clusters (277 / 103 / 9
dots) and its *cycle* — the 11 anchor dots — sat in the 103-dot cluster, not the 277-dot one. The
big blob is coloured by a cycle living elsewhere. Correct: those dots share a destiny, they just
haven't arrived. Written up in NOTES.md as "A basin is not a cluster".

Offered but **not built**: lightness by hop-distance from the cycle (anchor bright, tributary
dim), because lightness currently encodes speed and that's a real trade. User's call.

### Actions Taken
| # | Action | File(s) | Detail |
|---|--------|---------|--------|
| 1 | added | `.../NOTES.md` | "Picking this up cold" — code map, controls list, and the three traps already fallen into |
| 2 | added | `.../NOTES.md` | "A basin is not a cluster" — the investigation above, with the crosstab |
| 3 | edited | `.../NOTES.md` | Consolidated open threads into "Things worth trying next", ordered by readiness; deduped; refreshed Last Updated |
| 4 | edited | `PROJECT.md` | Current Focus reflects a paused, documented exploration |

### State at close
Working tree clean, pushed, Pages live. `explorations/dots-friend-enemy/` is self-contained:
`index.html` (V2.3, no build), `NOTES.md` (idea → findings → open threads), `archive/v1-*.html`.
Nothing in flight; nothing parked mid-edit.

### Next Steps
- [ ] User is moving to a new exploration; dots is paused, not finished
- [ ] Open threads live at the bottom of `dots-friend-enemy/NOTES.md`, best-specified first

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

### Shipped broken, then fixed (same day)
The hue-drift row was tagged `data-look="basins"`, and `syncUI` hid every `[data-look]` element
not matching the current look. The look *buttons* already use `dataset.look` for their identity —
set in JS, so it never appears as `data-look=` in the source and grep wouldn't have caught it —
so the selector hid four of the five look buttons. With phosphor as default, phosphor became the
only reachable look, and hue drift (basins-only) was therefore unreachable too. Renamed to
`data-needslook`.

**The gap**: every verification round tested physics, rendering, graph correctness and perf, and
all of them passed on a build whose control panel was broken. Canvas output is not app output.
Now assert on the DOM — which controls are visible under each look and trail mode.

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
