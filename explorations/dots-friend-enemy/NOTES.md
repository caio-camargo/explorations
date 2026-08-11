# Dots: friends & enemies
**Version**: v1.0.0
**Date Created**: 2026-08-10
**Last Updated**: 2026-08-10
**Purpose**: A dot swarm driven by three one-line rules — what it does, and what tuning it taught
**Status**: Active

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

- [ ] Colour by which friend-graph cycle a dot drains into, instead of by index — should make
      the cluster structure visible directly rather than inferring it from hue bands.
- [ ] Two enemies, or a friend-of-friend term.
- [ ] Asymmetric: let popularity be uneven (some dots chosen as friend by many).
- [ ] 3D, or on a torus (wrap the floor) so there is no centre pull at all.
- [ ] Record the friend graph's cycle census alongside the visual — does cycle count predict
      how spread out the result is?
