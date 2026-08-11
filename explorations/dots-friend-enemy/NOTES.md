# Dots: friends & enemies
**Version**: v2.6.0
**Date Created**: 2026-08-10
**Last Updated**: 2026-08-11
**Purpose**: A dot swarm driven by three one-line rules — what it does, and what tuning it taught
**Status**: Active — V2.6 (stalking predator + agent appearance styles). V1 archived at [`archive/v1-rainbow-dots.html`](archive/v1-rainbow-dots.html)

---

## The idea

From [a tweet by @isaacking314](https://x.com/isaacking314/status/2086721066106253347). Every dot
picks one friend and one enemy at random. Then, each step, every dot:

1. moves **0.5% closer to the centre** of the floor,
2. takes a **large step toward its friend**,
3. takes a **small step away from its enemy**.

At random intervals, one dot re-rolls its friend and enemy.

That's the whole thing. No forces, no collisions, no neighbourhoods, no physics engine.

Run it: open [`index.html`](index.html) in any browser. No build, no server, no dependencies.

---

## Picking this up cold

Everything is one file, [`index.html`](index.html), ~1000 lines, no build and no dependencies.
Open it in a browser. Roughly 50 lines are the simulation; the rest is rendering and UI.

**Code map** (line numbers drift, names don't):

| Where | What |
|---|---|
| `const P` | every tunable in one object — the UI only ever writes here |
| `PRESETS`, `LOOKS`, `BASIN_HUES` | preset physics, the five looks, basin hue wheel |
| `step()` | **the actual simulation** — the three rules, unchanged since V1 |
| `assign()`, `analyseGraph()` | friend/enemy ties; the O(n) walk that finds cycles and basins |
| `updateAgents()`, `PRED`, `retarget()` | agent movement — the predator's prowl/windup/lunge/recover state machine and cluster targeting |
| `drawAgents()` | the four agent appearance styles (hidden / glow / comet / void) |
| `sampleSpeeds()`, `updateHues()` | per-*step* quantities — never call these per frame (see below) |
| `pushHistory()`, `resetHistory()` | the ribbon ring buffer, `HIST` slots deep |
| `draw()` → `drawRibbons()` / `drawStreaks()` | the two trail engines |
| `frame()` | the loop: fractional stepping, then draw |
| `SLIDERS`, `syncUI()` | control wiring; `data-model` / `data-trail` / `data-needslook` hide rows |

**Controls**, in panel order: look (5), skeleton emphasis, hue drift (basins only), trail style
(ribbons/bloom), trail length, stroke weight, speed→brightness, pulse depth + period,
**influences** (wandering attractor, predator), physics presets, step model + rule sliders,
dot count, steps/frame, links and floor overlays.
Keys: `space` pause, `r` scatter, `t` reroll ties, `l` links, `1`–`5` looks.

**Three traps this file has already fallen into**, all documented in full below — don't re-derive
them:

1. A multiplicative fade on an 8-bit canvas **never reaches the background**; it freezes a few
   levels above it, permanently. That's what `bloom` does at long trail lengths.
2. Anything derived from motion must be sampled **per step, not per frame**, or it breaks the
   moment steps and frames stop being 1:1.
3. Basin *ids* come from scan order and renumber freely; identity must come from the cycle
   itself.

---

## How the rules map to code

All of it lives in `step()`.

```js
px.set(x); py.set(y);              // snapshot — everyone reacts to the same instant

for (let i = 0; i < n; i++) {
  X += cp * (cx - xi);             // rule 1: 0.5% toward the centre
  const fdx = px[friend[i]] - xi;  // rule 2: toward the friend
  const edx = xi - px[enemy[i]];   // rule 3: away from the enemy
  X += kF * fdx / fd;              //   (normalised → constant stride)
  X += kE * edx / ed;
}
```

Three details that matter more than they look:

- **Simultaneous update.** The snapshot into `px/py` is not an optimisation. Updating dots
  in place means dot 400 reacts to an already-moved dot 12, which quietly injects an
  index-ordering bias into a system that is supposed to be symmetric.
- **Friend ≠ enemy ≠ self.** A dot that chases and flees the same target just cancels out
  and sits there.
- **Steps are scaled to the floor size.** The centre pull is a *fraction* of distance while
  the strides are absolute, so the equilibrium radius is roughly `stride / pull`. Without
  scaling, the same parameters produce a full-screen structure on a laptop and a speck on a
  4K monitor.

---

## What tuning actually taught

**"Large step / small step" has two readings, and only one of them works.**

*Fixed stride* (a constant distance per step) is bounded by construction: the repulsion has a
ceiling while the centre pull grows with distance, so there is always a radius where they
balance. All the interesting structure lives here.

*Proportional* (a fraction of the current gap) makes each dot's update linear:

```
p' = (1 - c - kF + kE)·p + c·C + kF·friend - kE·enemy
```

The whole system is then one matrix, and a linear system has exactly two fates. The `-kE·enemy`
term feeds outward and destabilises; the centre pull stabilises. Measured over 1500–2000 steps:

| centre pull `c` vs enemy `kE` | outcome |
|---|---|
| `2·kE > c` (e.g. the tweet's own 0.5% with a 1% enemy step) | inflates until ~50% of dots jam against the floor edge |
| `2·kE < c` | contraction — every dot converges onto the centre point, structure dies |
| `2·kE ≈ c` | knife edge, not a stable regime |

There is no bounded, structured middle. **That's decent evidence the original uses fixed-size
steps** — with proportional steps the tweet's stated 0.5% centre pull cannot produce the video.

The proportional mode is kept anyway (`linear` preset), because watching it fail is the clearest
explanation of why the other reading is right. The panel reads out which regime you're in.

**Run-to-run variance is large and it's not a bug.** Each dot points at one friend, so the
friend graph is a random *functional graph* — every dot's chase path eventually falls into a
cycle. How many cycles there are and how long they are changes the picture completely. Same
preset, same floor: mean radius came out anywhere from 6% to 36% of the floor across runs. Hit
`reroll ties` a few times to resample.

---

## V2 — the rendering, with an aesthetic eye

The physics didn't change. Everything below is about how it's drawn.

**The starting observation: V1's colour encoded nothing.** Dots were coloured `hue = index/n`.
Index has no relationship to anything in the system — dot 7 and dot 8 are neighbours in the
array and nowhere else — and at n=400 the hues sit ~1° apart, so it rendered as a uniform smear
of every hue at once. Going monochrome costs zero information. Every V2 look either drops colour
or spends it on something real.

**Motion is the signal now.** Instead of drawing a dot at a position, V2 draws the segment from
where each dot *was* at the last frame to where it *is* — a velocity streak. Speed then drives
both brightness and stroke weight, against an adaptive reference that tracks the current peak, so
"fast" stays meaningful whatever the sliders say. Measured across the presets, normalised speed
sits at a median of 0.28–0.60 with only 0.1% of dots pinned at the ceiling — real dynamic range,
not a saturated white blob.

**The skeleton.** Because each dot points at exactly one friend, the friend graph is a random
*functional graph*: follow the chase far enough and you always fall into a cycle. An O(n) walk
labels every dot with the cycle it drains into and whether it sits on that cycle. Dots on a cycle
are the attractors the whole picture organises around, so they're drawn brighter and heavier.
`basinCount` is in the corner readout — typically 2–3 for a few hundred dots, matching the
expected ½·ln(n) cycles of a random functional graph.

| Look | Ground | Blend | What colour means |
|---|---|---|---|
| `graphite` | warm paper | multiply | nothing — ink darkening as strokes overlap |
| `noir` | pure black | additive | nothing — white light accumulating |
| `phosphor` | near-black | additive | speed, cyan → white |
| `ember` | near-black | additive | speed, amber → pale yellow |
| `basins` | near-black | additive | **which cycle a dot drains into** — same colour, shared destiny |

`basins` is the one look where colour beats monochrome, because hue finally carries structure.
Its palette is ordered so the *first* entries contrast hardest rather than following the hue
wheel — a random functional graph usually has only 2–3 cycles, and hue-wheel order handed those
to red-orange and amber, which read as a single colour. Expect one basin to dominate: giant
components are the norm in these graphs, so a mostly-one-hue picture is the structure, not a bug.
`graphite` and `noir` are the two monochromes, one on each ground, which is the comparison worth
making: on paper the trails behave subtractively like ink, on black they behave additively like
light.

## The haze was a bug, not a trail

V2's first trail engine accumulated onto the previous frame and veiled it back toward the
background each frame. At long trail lengths that produced a grey web across the whole floor —
which looked like "trails piling up" but wasn't.

The veil is *multiplicative*: `V ← V − (V − bg)·a`. The canvas is 8-bit. So the moment
`(V − bg)·a < 0.5`, the decrement rounds to zero and **the pixel is frozen permanently**. At
trail length 91 (`a = 0.09`) that traps anything within ~5 levels of the background.

Measured, with nothing being drawn at all — just the veil applied 3,400 times:

| | pixels > bg+2 | pixels > bg+8 |
|---|---|---|
| after drawing | 100,091 | 99,965 |
| after 400 veils | 100,088 | 0 |
| after 3,400 veils | 100,088 | 0 |

27% of the canvas stuck at exactly red=11 against a background of 6, and it never moved again.
Every path the dots had ever taken, fossilised. It also explains why the haze vanished around
trail length 30 — there `a = 0.70`, so the floor sits below one level and is invisible.

**Ribbons** fix it by not using the framebuffer as memory at all. Each dot's last K positions are
kept in a ring buffer and redrawn as a real polyline onto a fully cleared canvas, in three age
bands so opacity and weight taper. Nothing accumulates, so nothing can fossilise, and a trail is
exactly K frames long and then gone. Crossing ribbons still brighten each other through the blend
mode — but only within a single frame, so overlaps read as overlaps instead of silting up.

Same teleport test, moving every dot into a corner and rendering 150 more frames:

| | lit while busy | left behind in the vacated area |
|---|---|---|
| bloom | 35,742 | 34,876 |
| ribbons | 5,186 | **0** |

Bloom is kept as an option — it's genuinely nicer at short trail lengths, where the floor is
invisible and the glow is the point.

**Cost, and how it came down.** Ribbons started at 14.2 ms/frame against bloom's 1.0 — 1,500
`stroke()` calls per frame, since canvas stroke overhead is per *call*, not per segment. Bucketing
dots by everything that determines their appearance (quantised speed, on-cycle, basin) and
emitting one path per bucket cut it to 3.9 ms, with the worst case (n=1200, K=128) at 9.6 ms.

## The lightning was three bugs, and one of them is now a feature

The first ribbons build flickered — jagged, unstable, lightning-ish, with a visible strobe when
the simulation was slowed down. Three separate causes, all of them mine:

**1. The strobe: speed sampled per frame instead of per step.** Speed was measured as distance
moved since the last *draw*. At fractional step rates most frames run no step at all, so every dot
read as motionless, the whole field dropped to minimum brightness, and then flared on the frame a
step landed. The giveaway was that the strobe vanished at low Speed → brightness — brightness is
`t = 1 − resp + resp·t_raw`, so at `resp = 0` the speed term drops out entirely and the artifact
has nothing to modulate. Speeds are now sampled inside the step loop and simply persist across
draw-only frames.

**2. The scale was set by a single dot.** `speedRef`, which everything is normalised against, was
an EMA of the *maximum* speed in the field. One dot changing rescaled the brightness of all 500.
It now tracks the mean, which is enormously steadier.

**3. Every ribbon was coloured by its dot's instantaneous speed**, so an entire trail flashed as
one unit on frame-to-frame noise. Each history vertex now stores the speed it was laid down at,
and each age band is shaded by the *average speed during that band*. Steadier, and truer — a
ribbon now shades by its own past, so you can read where a dot sped up.

Measured as frame-to-frame variation in drawn ink, at the settings that exposed the strobe
(0.25 steps/frame):

| | speed→brightness 0% | speed→brightness 100% |
|---|---|---|
| coefficient of variation | 9.7% | 11.4% |

Before, the variation was strongly coupled to that slider — that's exactly what the strobe was.
Now the two are within noise of each other, so what's left is just a swarm being a swarm.

**And the strobe is now a control.** `Pulse depth` and `Pulse period` modulate brightness
deliberately. The phase advances per *simulation step*, not per frame, so the beat stays tied to
the motion instead of to the monitor — slow the sim and the pulse slows with it. Depth 0.8 at
period 20 swings drawn ink from 0.38× to 1.65× of mean; depth 0.4 at period 60 gives a gentler
0.59×–1.27×. Default is off.

One thing that is *not* a bug: at very low steps/frame the geometry genuinely updates only on the
frames a step lands, so the ribbon holds still and then jumps. That's the simulation being slow,
not the renderer stuttering. Smoothing it would mean interpolating positions between steps.

## Basin colour: stable identity, eased hue, optional drift

Basin colours changed abruptly, worst of all when a cluster split in two. Part of that was a
dot genuinely changing basin — but most of it was something dumber.

**Basin ids came from scan order.** `analyseGraph` walks nodes 0…n−1 and numbers cycles in the
order it finds them. Change the graph slightly and the numbering can shift wholesale, so a basin
that was id 0 becomes id 1 and every dot in it changes colour at once — even though the partition
barely moved. Splitting a cluster is exactly the case that renumbers everything after it.

Basins are now ranked by **the smallest node index on their cycle**, which is a property of the
cycle itself rather than of how it was discovered. The giant basin keeps its colour while ties
churn, and distinct basins still always get distinct hues. Verified by recomputing an unchanged
graph 25 times and confirming the slot assignment never moves.

**Colour is a hue angle now, eased per dot.** Each dot carries its own hue and eases toward its
basin's, the short way round the wheel, at ~3.5% per step — a change lands in about a second.
Measured: from 150° away it converges to within 2° in 120 steps with a maximum single-step jump
of 5°, and it takes the short way in both directions including the 179° edge case.

**Hue drift** rotates every basin hue together, in degrees per simulation step, displayed as
seconds per full turn. Zero is the fixed palette. Like the pulse, it advances per *step* rather
than per frame, so slowing the simulation slows the drift.

Cost: settled dots all share their basin's hue, so hue bucketing normally costs nothing — at
defaults only ~5 hue buckets are occupied and it runs at 3.9 ms. Dots mid-transition spread across
buckets, and each occupied bucket is a `stroke()` call, so heavy churn at n=1200/K=128 hit 17 ms
at 48 hue steps. Dropping to 32 steps (11.25°) brought that to 5.3 ms with no visible difference
in the sweep.

## A basin is not a cluster (this looks like a bug and isn't)

You will see two spatially separate groups sharing one basin colour, sometimes on opposite sides
of the floor, joined by a thread of dots. It reads as a stale assignment. It isn't.

Ruled out first, by measurement:

- **Not stale.** Perturbing a settled run with 12 forced re-rolls and stepping one frame:
  `graphDirty` is cleared and membership has already changed *in that frame*. Basins are recomputed
  from scratch the moment any tie changes.
- **Not a palette collision.** `slot = rank % 8`, so >8 basins would reuse a hue. Over 300 random
  graphs at n=500 the count peaked at **7**. Distribution: 1 basin 14%, 2 30%, 3 31%, 4 17%,
  5+ 8%. Collisions never occurred.

What's actually happening — flood-filling dots into spatial clusters and cross-tabbing against
basin, on a settled 500-dot run:

| | basin 0 | basin 1 |
|---|---|---|
| cluster 0 | **277** | 3 |
| cluster 1 | 103 | 3 |
| cluster 2 | — | **100** |
| cluster 3 | 9 | — |

Basin 0 spans three spatial clusters, and the decisive detail: **its cycle — the 11 anchor dots —
sits in cluster 1, not in the 277-dot cluster 0.** The big blob is coloured by a cycle living
somewhere else entirely.

That is correct. A basin is "everything whose chase path eventually drains into this cycle" — a
property of the graph, not of space. Those distant dots genuinely share a destiny with the small
group; they are partway along a chase chain and haven't arrived, held apart meanwhile by enemy
repulsion. Same colour really does mean shared destiny, even across the floor. The small group is
the anchor; the far one is a tributary feeding into it.

**If that ever needs to read differently**, the suggested fix is to shade *lightness* by hop
distance from the cycle while hue stays the basin — anchor bright, tributary dim, meaning
preserved. It's an O(n) pass alongside the existing walk. Not built, because lightness currently
encodes speed and that's a real trade, not a free addition.

## Influences — the centre pull was always a field

The centre pull is not really part of the dot rule; it's an *external field*, the one force that
isn't another dot. Generalise that term and several ideas collapse into one feature:

| | what it is |
|---|---|
| centre | static point attractor — what the tweet describes |
| wandering attractor | the same, with its own position update (an open Lissajous path) |
| predator | a point *repeller*, optionally one that hunts |
| an image (not built) | a *sampled* field instead of an analytic one |

The dot rule is now `friend + enemy + Σ(fields)`, and fields compose.

**The predator hunts by mass, not by nearest dot.** A single nearest target makes it flip-flop
between neighbours; weighting every dot by `1/(1 + d²/r²)` and steering at the weighted centroid
is O(n), needs no sorting, and moves smoothly. The dots flee, so the mass it's chasing keeps
sliding away — that feedback *is* the chase. Measured: starting 361 px from the swarm centroid it
closes to 2 px within ~500 frames and stays locked on.

It really does carve. With the default reach, only **1 dot of 500** sat within half the predator's
radius while all 500 were within two radii — 0.2% where a uniform distribution would give 6.25%,
a 30× depletion. Leave "Show them" off and you read the predator entirely from that hole and the
wake behind it, which is more interesting than drawing a circle.

**Repulsion falls off linearly to zero at the radius**, so it's capped. That matters: the centre
pull grows with distance and the repulsion doesn't, which is the whole reason the system stays
bounded. Verified at maximum settings — attractor at max pull and speed, predator at max push,
reach and speed, both together — nothing pinned to the floor edge, no NaN.

**One degenerate combination**, and the panel warns about it: centre pull at zero, predator on,
attractor off. Nothing is left holding the swarm in, so the repeller drives everything outward
and **52% of dots jam against the floor edge**. Either field restores the leash. The attractor
alone is enough — with the centre pull at zero it gathers the swarm to a mean radius of 134 px,
and dots collect on it (mean distance 23 px to the attractor versus 127 px to the centre).

Cost at the worst case measured (n=1200, K=128): 8.64 ms without agents, 9.88 ms with both, and
`updateAgents()` itself is 0.03 ms/step. The difference is stroke calls, not the hunt loop —
agents make dots more varied, so occupied colour buckets go from 43 to 62 per frame.

## The bow shock — disturbance as a colour axis

The agents worked but looked like nothing: hairline wireframe circles in a piece that contains no
other hard edges. The fix follows the rule everything else here already obeys — **things are
visible through what they do to the dots**, never drawn directly.

**Measured before designing.** The density at the predator's rim is ~500× the far field, with the
interior completely empty — the front is razor-sharp, no physics change needed. But the decisive
detail: dots *at* the front have near-zero radial velocity (mean cos ≈ 0.03) — they are **pinned**
against the shock, not fleeing — while dots behind stream back in at cos ≈ −0.30. So a naive
"colour by flee velocity" would leave the most dramatic dots unmarked. Proximity has to carry the
signal; velocity only modulates it.

**One axis, u ∈ [−1, +1]:** +1 = overwhelmed by the predator, −1 = settled on the attractor.
Per-step, eased asymmetrically — fast attack (0.5/step), slow decay (0.035/step) — so heat
lingers on dots the predator has passed: **the warm wake draws itself** out of the easing, no
extra logic. Predator warmth uses quadratic falloff (`1 − (d/r)²`), because linear gave the
pinned front dots — at ~0.75 of the felt radius — the least heat; quadratic nearly doubled it
(mean u 0.25 → 0.48).

**Each look defines what disturbance means**, because hue is already spoken for in `basins`
(same colour = shared destiny) and doesn't exist in the monochromes:

| Look | hot (predator) | cold (attractor) |
|---|---|---|
| graphite / noir | ink pressure — presses harder, wider | lightens, settles |
| phosphor | flares through pink to white | sinks into deep blue |
| ember | burns white | banks down to deep red |
| basins | **hue unchanged** — blows out toward white | deepens, darkens |

`u = 0` is the exact identity — verified against the pre-change colour strings — so with no
agents on, nothing changes, and the ribbon bucketing gains a disturbance dimension (DQ = 7, odd
so one bin centre is exactly 0) at zero cost when the field is undisturbed.

The "Show them" diagnostic is now a soft radial glow in the look's own blend mode instead of
wireframe. First implementation rebuilt the radial gradient every frame and cost ~30 ms; cached
as a 128px sprite and drawImage-scaled it costs ~1.6 ms.

Every control also carries a hover tooltip now — the panel had accumulated sliders whose names
only make sense if you already know the internals.

## The predator learns to stalk (and the agents get bodies)

**Why the two agents moved together:** the old hunt steered at the soft centroid of *all* dots
(`1/(1+d²/r²)` weights). With the attractor on, it owns most of the mass — so that centroid *is*
the attractor's pile, and the predator parks on it. Structural, not incidental.

**The hunt is a state machine now.** The predator commits to one *cluster* at a time:

- **prowl** — variable pace (0.35–0.95× the slider) with lateral wander; a route, not a beeline
- **windup** — the coil: nearly still for ~a quarter second
- **lunge** — 4.5× burst straight through where the cluster *was* (the aim is locked at the coil,
  so fleeing dots make it overshoot — which reads predatory)
- **recover** — spent; drifts, then chooses a new cluster

Cluster choice: bin dots into a coarse 14×10 grid (O(n)), pick among cells ≥35% of the densest,
weighted by population × *squared* distance from the attractor — a mild bias still handed it the
same pile every time. A minimum-prowl counter (80–220 steps) stops the cycle collapsing into
windup/lunge/recover; the first tune lunged every 1.6 s with 1% of time spent stalking.

Measured after tuning: 70% prowl / 6% coil / 5% lunge / 19% recover, a lunge every ~4 s, step
size p10 0.8 px → lunge 10 px (strongly bimodal, as intended), and median predator–attractor
distance 0.21 of the floor (p10 0.09 — decoupled, not glued). The current state shows in the
stats line. **Cost went down**: O(n) binning every 12 steps replaces O(n) weighting every step.

**Agent appearance is a four-way workshop** (`Their appearance` in the panel):

| Style | What it is |
|---|---|
| `hidden` | The purist setting — the hole, the hot rim, and the warm wake are the predator |
| `glow` | Soft radial fields in the look's own light (sprite-cached) |
| `comet` | The agents draw their own ribbon, like the dots. A lunge stretches into a dash |
| `void` | The predator is an *absence* — a bg-coloured soft hole gliding through the light (verified: centre luminance 27 vs 54 on its rim). The attractor is a pinprick star |

## Presets

All measured for "stays on the floor, stays in motion, doesn't collapse to a dot".

| Preset | Model | Friend | Enemy | Re-choices/s | Character |
|---|---|---|---|---|---|
| `tweet` | fixed | 4.0 | 1.5 | 2 | The literal reading — large step / small step |
| `orbits` | fixed | 4.0 | 2.6 | 2 | Spread out, wide slow structures |
| `swarm` | fixed | 2.5 | 1.9 | 25 | Constant churn, ties never settle |
| `knot` | fixed | 1.3 | 0.9 | 0 | Frozen ties — tight shimmering cluster |
| `linear` | prop | 3.0% | 1.0% | 2 | The failure case, on purpose |

Centre pull is 0.5% everywhere, as stated in the tweet.

---

## Things worth trying next

Open threads, in rough order of how ready they are to pick up:

- [ ] **Image as a sampled field** — the other half of the influences idea, and the next thing up.
      Dots attracted to dark regions of an image that is never drawn, so the picture is only
      *suggested* by where they pool. The approach: rasterise to an offscreen canvas (a generated
      shape and a real upload go through byte-identical code), build a ~5-level pyramid, and take
      the potential as a coarse-weighted sum across levels — a dot in a large empty region has no
      gradient at full resolution and would never find the shape, but at the coarsest level a
      gradient exists everywhere. Precompute `∇Φ` into two Float32Arrays; per dot it's a bilinear
      lookup, O(1). Two things known in advance: dots pool in dark areas and additive blending
      makes pooled dots bright, so the image renders *inverted* (offer a polarity toggle); and the
      interesting regime is where the image is barely legible, which means friend/enemy churn has
      to stay strong enough to keep smearing it. Everything stays client-side.

- [ ] **Lightness by hop-distance from the cycle** (see "A basin is not a cluster"). Best-specified
      item here; trades away speed→lightness.
- [ ] **`HUE_EASE` as a slider.** It's a constant at 0.035/step (~1s). Fine in practice, but the
      transition speed is the sort of thing worth feeling out rather than fixing.
- [ ] **Sub-step position interpolation.** At low steps/frame the geometry updates only on frames
      a step lands, so ribbons hold still then jump. Honest, but smoothable.
- [ ] An "artifact" mode: no fade, thousands of dots, very low per-stroke alpha, export to PNG.
      Everything since V2 optimises for *watching*; accumulation makes a different thing.
- [x] ~~Colour by which friend-graph cycle a dot drains into~~ — done in V2, the `basins` look.
- [ ] Two enemies, or a friend-of-friend term.
- [ ] Asymmetric: let popularity be uneven (some dots chosen as friend by many).
- [ ] 3D, or on a torus (wrap the floor) so there is no centre pull at all.
- [ ] Record the friend graph's cycle census alongside the visual — does cycle count predict
      how spread out the result is?
