# Dragão Ouroboros, re-animated — notes
**Version**: 1.0.0 · **Author**: Caio + Claude (Opus 5.5) · **Created**: 2026-09-26 · **Status**: Active
**Purpose**: Take Danya's *Dragão Ouroboros* and replace its rigid spin with layered motion. The green lines become their own layer, and the rest moves more fluidly.

> **The artwork is Danya's**, shared as a claude.ai artifact
> (claude.ai/artifact/2xyUihE4RsSyQersSRPDBB). Caio has her permission to work on it.
> The source video lives in `source/` and is git-ignored. `index.html` embeds layers cut from it.
> Published to GitHub Pages 2026-09-26 with Danya's OK. Credit Danya when sharing.

## What the original was
The artifact is a page wrapping one video, `dragao_ouroboros.mp4`: 764×806, 30 fps, a 24 s
loop. The whole dragon ring rotates 360° counter-clockwise as a single rigid image, and 7
line-drawn clouds drift right behind it. No layered source was available, so the layers had to
be recovered from the video itself.

## How the layers were recovered (`build.py`)
1. **Spin centre.** Counter-rotating frames and minimising the error against frame 0 gives
   CCW rotation about **(383.5, 357.5)** at exactly 3° per frame at 5 fps. The ring's own
   centre is (391, 365), about 10 px off the spin centre. That offset is the slight wobble in
   the original.
2. **Clean dragon.** A per-pixel median of the 120 counter-rotated frames. Every cloud passes
   through each pixel for only a few frames, so the clouds vanish completely.
3. **Paper.** A plain median over the frames gives the static paper with its speckles. The
   ring smears into a blur in the middle, which is blanked (the dragon covers it anyway).
4. **Clouds.** On the space-time diagram all tracks are parallel at **~41 px/s** and wrap about
   every 984 px (one pass per loop), but a few drift at slightly different speeds. Four sprites
   are cut from frames where they're unobstructed. The two that never clear the dragon come
   from a motion-compensated median of the unwrapped strip.
5. **Layers.** "Different from paper" gives the silhouette. Small enclosed holes are filled so
   the white wing interiors stay solid, while the 209k-px ring hole stays open.
   - The **body** is the largest warm (pink/orange) region after an opening, then closed.
   - Everything in the silhouette outside the body is an appendage:
     - the two big pale pieces are the **wings**
     - pieces that are ≥10% green, or small, are **flex**: whiskers, mane, tongue/tail tips
   - Green marks lying on the body are a thin **green-on-body** layer. The body under them is
     inpainted from neighbouring pixels.
   - A **weight field** (distance from the body: 0 at the body, 1 about 70 px out, blurred)
     drives the secondary motion.

## The motion (`index.html`, one WebGL fragment shader)
Everything is periodic in 24 s, so the recorded loop is seamless. Per pixel:
- **Spin with surge.** θ(t) = 2πt/24 + 0.07·sin(4πt/24). The dragon speeds up and eases off
  twice per turn instead of turning like a turntable.
- **Body ripple.** A radial wave travels around the ring: 3 lobes, 7 px, 3 s per cycle. It
  fades to zero near the head, so the face never distorts.
- **Whiskers and mane.** They trail behind the spin (drag grows with the weight field and with
  the surge) and flutter with a wave that travels out toward the tips. Where they attach to the
  head, the weight is ~0, so there are no gaps or tearing.
- **Wings.** Each flaps about its hinge (the nearest body point) with a 2 s beat: a
  foreshortening along the wing's axis plus a small tilt. The two wings are slightly out of
  phase.
- **Green scale marks** slide a hair against the body (1.2 px shimmer).
- **Clouds.** Danya's own sprites, each wrapping once per loop at its own speed, with a gentle
  bob.

The **Fluid motion** button (or F) switches back to the rigid original for A/B comparison.
**Record 24 s loop** saves a webm.

## What it taught
- **A rigid-spin video is easy to un-bake.** Knowing the exact rotation turns the median of
  counter-rotated frames into a perfect "remove everything else" filter. The same trick with
  x − vt recovers the clouds.
- **Hue alone can't separate green lines.** The whiskers are green fill inside dark outlines,
  so the useful split is *spatial*: outside the body vs on it. Colour only decides which
  outside pieces are whiskers and which are wings.
- **A centroid is not a seed.** The wing centroids fall outside the curvy wing shapes, so wings
  are picked as the nearest big component.
- **Negative slice starts wrap in numpy.** `a[y-8:...]` with y=3 silently returns an empty or
  odd crop; clamp with `max(0, …)`.
- **Tooling:** the in-app preview couldn't open this ~1 MB file as a snapshot, so it's served
  by `python -m http.server` (`.claude/launch.json`, config "explorations"). Also,
  requestAnimationFrame doesn't fire while the pane is hidden, so `render()` is split from the
  loop and can draw any time on demand (handy for side-by-side checks from the console).

## Ideas not done
The body sliding *along* its own path (scales travelling around the ring) instead of rotating
as a unit; the jaw opening and closing on the tail; whiskers as true spring chains (verlet)
instead of a displacement field; separating the thin outer circle outline so it lags like a halo.
