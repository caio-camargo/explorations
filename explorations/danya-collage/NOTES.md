# Danya Collage — notes
**Version**: 1.0.0 · **Author**: Caio + Claude (Opus 5.5) · **Created**: 2026-09-25 · **Status**: Active
**Purpose**: Bring a still collage by Caio's friend Danya to life in the same lo-fi / glitch register as [`sky-floor`](../sky-floor/NOTES.md).

> **The artwork is Danya's** (`source/collage.webp`, and inlined as data URIs in `index.html`).
> Don't publish or push this folder without Danya's OK.

## The collage
A saturated, pink-shifted photo of succulents. Overlaid on it are a black circle (upper right),
a blown-out white panel with green streaks (bottom), and a black rectangle sitting on the
panel's left end. The source was a screenshot with an app avatar icon in the bottom-left. That
icon is not part of the art and is painted out.

## How it works
- **`build.py` cuts the layers.** Measured geometry: circle (391, 256), r≈60; rect
  x117 y414 103×152; panel x59 y415 469×187. It fills the holes the shapes leave:
  - circle and avatar: a feathered copy of texture from above them
  - rect: the streaky white just to its right

  It then inlines the background and panel as JPEG data URIs between `@@ASSETS` markers in
  `index.html`. **Re-run `python build.py` after changing geometry or the source.**
- Each collage element gets **its own kind of time**:
  - **Photo:** breathes like wind. A coarse 24 px displacement grid is bilinearly interpolated
    per pixel, and gusts come from a cubed sine.
  - **White panel:** a strip of film sliding past. It wraps horizontally, skips now and then,
    and flickers overexposed.
  - **Rectangle:** stop-motion. It holds for 1.5–5 s, then snaps to a new spot along the
    panel, with a hand-placed judder.
  - **Circle:** drifts lazily on two sines around its original position.
- The glitch pipeline is the one from sky-floor (chroma bleed, datamosh, macroblocks, tears,
  5-bit colour with grain, 12 fps with dropped frames). Block counts are scaled up for the
  larger 582×602 frame.

Keys: G glitch level (clean / lo-fi / broken) · space pause · R record 10 s webm.

## What it taught
- **Moving a baked-in shape means inpainting it first.** Without OpenCV, a feathered copy of
  nearby texture is enough. Busy foliage hides the patch, and the glitch pass hides the rest.
- **Anti-aliased edges leave seams.** Filling exactly the measured rect left 1 px grey outlines;
  the fill had to be widened by ±3 px.
- **Keep it one file.** A separate `assets.js` rendered blank in the in-app preview, which
  snapshots a single file. Data URIs inline in the page also avoid `file://` canvas tainting
  (the warp needs `getImageData`).
- Giving each collage element a *different kind of motion* (continuous, scrolling, stop-motion,
  drifting) makes it read as a collage coming apart rather than one image wobbling.

## Ideas not done
The circle as a lens (plants inside it lag a few seconds behind); the rect leaving a
"paper shadow" where it used to be; the panel's streaks bleeding up into the plants.
