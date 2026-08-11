# explorations

Small self-contained experiments — simulations, toys, visual things. Built because they're
interesting, not because they're needed. Each one is a single file you can open in a browser,
plus notes on what it taught.

**→ [caio-camargo.github.io/explorations](https://caio-camargo.github.io/explorations/)**

---

## What's here

| Exploration | What it is | |
|---|---|---|
| **[dots-friend-enemy](explorations/dots-friend-enemy/)** | Every dot picks one friend and one enemy, then chases one and flees the other. Three rules, no physics engine. | [run](https://caio-camargo.github.io/explorations/explorations/dots-friend-enemy/) · [notes](explorations/dots-friend-enemy/NOTES.md) |

## The one interesting result so far

The dots simulation comes from [a tweet](https://x.com/isaacking314/status/2086721066106253347):
each dot moves 0.5% toward the centre, takes a *large step* toward its friend, and a *small
step* away from its enemy.

"Large step / small step" has two plausible readings, and only one of them works.

**Fixed stride** (a constant distance per step) is bounded by construction — the repulsion is
capped while the centre pull grows with distance, so there's always a radius where they
balance. All the structure lives here.

**Proportional** (a fraction of the current gap) makes each dot's update linear:

```
p' = (1 - c - kF + kE)·p + c·C + kF·friend - kE·enemy
```

The whole system becomes one matrix, and a linear system has exactly two fates. Measured over
1500–2000 steps: when `2·kE > c` it inflates until ~half the dots jam against the floor edge;
when `2·kE < c` it contracts to a single point. There's no bounded, structured middle — just a
knife edge between the two. The tweet's own 0.5% centre pull sits in the inflating regime,
which is decent evidence the original is fixed-stride.

The proportional mode ships anyway, as the `linear` preset, with a live readout naming which
regime you're in. Watching it fail explains the design better than a paragraph does.

## Conventions

- One folder per exploration under [`explorations/`](explorations/), indexed by
  [`explorations/README.md`](explorations/README.md)
- Every folder has a `NOTES.md` — the idea, how it works, and what it taught. The notes are the
  point; the code is the byproduct.
- Single self-contained file where possible. No build step, no dependencies, no package manager.
- Tune with measurements, not vibes. Negative results get written down.

## Repo layout

`AGENTS.md`, `PROJECT.md`, `INDEX.md`, `SESSION_LOG.md` and `LESSONS_LEARNED.md` are the
workspace's operating contract and running memory — this project is built with an AI agent as a
collaborator, and those files are how it stays oriented between sessions. They come from
[claude-project-framework](https://github.com/caio-camargo/claude-project-framework).
