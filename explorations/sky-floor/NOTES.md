# Sky Floor — notes
**Version**: 1.0.0 · **Author**: Caio + Claude (Opus 5.5) · **Created**: 2026-09-25 · **Status**: Active
**Purpose**: First try at lo-fi / glitchy / vaguely surreal animation — an empty room whose floor is a drifting sky, with a black orb bobbing in it.

## The idea
Caio saw a clip (x.com/i/status/1848091368775700939, not AI-made): a pale room, a sky scrolling
sideways where the floor should be, and a black circle floating lazily up and down. The goal was
the *vibe*, not a copy. It was meant to be short, just something to play with.

## How it works
- **Everything is procedural, in one file, with no assets.** The room is a one-point perspective
  drawing on a 240×216 buffer. The floor is inverse-perspective texture mapping: for each pixel
  below the back wall, `X = (x-vx)·D/(y-vy)` and `Z = (y-vy)/D`, then look up a tileable cloud
  texture (periodic value-noise fbm plus speckle) scrolled along X. The window samples the same
  texture flat and at a different speed, so the sky is both lying down and standing up.
- **Curtain:** 44 vertical strips. Fold shading travels along them, and the bottom corners are
  offset by a slow sway, so each strip becomes a skewed quad.
- **Orb:** just a black disc on two out-of-phase sines. It has no shadow, which makes it read
  as "wrong" in a good way.
- **Lo-fi comes from the pipeline, not from filters on top.** The main source is the low
  internal resolution with a *smoothed* upscale. The other layers are chroma bleed, 5-bit colour
  with grain, 12 fps stepping, and occasional dropped frames (time advances but the picture holds).
- **Glitch (G cycles clean / lo-fi / broken):**
  - datamosh: 8×8 blocks keep the previous frame's pixels, dragged ±2 px
  - macroblocking: some blocks are flattened to their average
  - horizontal tears
  - random "bursts" of the heavy mode for a few frames

## Controls
G glitch level · space pause · R records 10 s of webm (browser download) · S reseeds the sky.
To convert the recording to mp4 for posting:
`ffmpeg -i sky-floor-XXXX.webm -c:v libx264 -pix_fmt yuv420p -crf 18 sky-floor.mp4`

## What it taught
- **Bit-masking quantization needs clamping first.** `(v + noise) & 0xf8` wraps out-of-range
  values: `-3 → 248` and `260 → 0`. Near-black and near-white pixels turned into single-channel
  specks (yellow on the orb, then yellow in the window). `Uint8ClampedArray` only clamps on
  *store*, not inside the expression.
- The floor's cloud/sky balance is very sensitive to the texture threshold. Threshold .28 was
  a solid blue carpet and .40 was white fog; .34 matches the reference.

## Ideas not done
Orb reflecting or occluding the sky; the room slowly breathing (FOV drift); sound (tape hiss);
the orb leaving a datamosh trail when it moves.
