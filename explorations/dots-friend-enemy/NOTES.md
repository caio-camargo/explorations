# Dots: friends & enemies
**Version**: v2.3.0
**Date Created**: 2026-08-10
**Last Updated**: 2026-08-10
**Purpose**: A dot swarm driven by three one-line rules — what it does, and what tuning it taught
**Status**: Active — V2.3 (eased, driftable basin hues). V1 archived at [`archive/v1-rainbow-dots.html`](archive/v1-rainbow-dots.html)

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

## How the rules map to code

Roughly 40 lines of the file are the simulation; the rest is UI and rendering.

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

- [x] ~~Colour by which friend-graph cycle a dot drains into~~ — done in V2, the `basins` look.
- [ ] Two enemies, or a friend-of-friend term.
- [ ] An "artifact" mode: no fade at all, thousands of dots, very low per-stroke alpha, and an
      export-to-PNG button. V2 optimises for watching; accumulation makes a different thing.
- [ ] Asymmetric: let popularity be uneven (some dots chosen as friend by many).
- [ ] 3D, or on a torus (wrap the floor) so there is no centre pull at all.
- [ ] Record the friend graph's cycle census alongside the visual — does cycle count predict
      how spread out the result is?
