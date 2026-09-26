# Night Storm — notes
**Version**: 1.0.0 · **Author**: Caio + Claude (Opus 5.5) · **Created**: 2026-09-25 · **Status**: Active
**Purpose**: Pixel art in the style of early-90s point-and-click adventures (LucasArts VGA era): a stormy night on a coast, with a lighthouse, a dead tree and a working verb interface.

## The idea
Caio loves the look of the old LucasArts adventures. The goal was a stormy night landscape in
that idiom. It had to be a real indexed-colour VGA screen, not "retro-flavoured" modern art.

## How it works: the period tricks, done the period way
- **320×200, indexed colour.** The framebuffer is a `Uint8Array` of palette indices. RGB only
  exists at the very end, via one palette lookup per frame. Nothing is drawn in RGB.
- **Ramps plus ordered dithering.** The palette is named ramps (SKY, CLOUD, SEA, ROCK, …), each
  dark→light. Every surface is shaded with a float and a 4×4 Bayer dither into its ramp. That
  is what gives the cross-hatched gradients in the sky and clouds.
- **Tall pixels.** VGA mode 13h pixels were 1:1.2, so the screen scales ×5 wide and ×6 tall
  (1600×1200) and displays at 4:3. Scaled square, it looks subtly wrong.
- **Lightning is a palette swap, not a redraw.** Every colour except the lamp and UI is mixed
  toward pale blue-white, on a flicker sequence `[2,2,0,1,2,1,0,0,1]`. The bolt is a jagged
  random walk with side branches, drawn *behind* the mountains.
- **Lighthouse beam = a "lighten" lookup table.** Each index maps two steps up its own ramp.
  The beam never introduces a new colour, so it stays inside the palette the way the originals
  had to. When the beam swings toward the viewer it becomes a short flare.
- **Scene composition** is one per-pixel priority pass: hill → cliff → sea → mountains → sky,
  with clouds, moon and bolt inside the sky. A parallel `idb` buffer records which object owns
  each pixel, so hover and click hit-testing is exact and free.
- **Tree:** a recursive branch structure with relative angles, so wind sways it from the root
  outward. Each segment is drawn twice (offset 1 px left in a lighter tone) to give a moonlit rim.
- **UI:** the classic 9-verb grid, sentence line, inventory boxes, cycling crosshair and a
  hand-drawn variable-width bitmap font (caps rows 0–5, x-height 2–5, descenders 6–7).
  Look at / Pick up / Talk to / … on each object gives a line of dialogue.

## Controls
Click a verb, then something in the scene · L forces lightning · space pauses · R records 10 s of webm.

## What it taught
- **Per-column slope lighting on a noisy ridge makes vertical stripes.** Measure the slope
  over ±3 px. Also give the ridge a 1-px lighter rim, or distant mountains vanish into a
  night sky that is nearly the same value.
- **A dead tree needs sparse branching.** At 2–3 children to depth 6 it read as a bush. At
  depth 5, with frequent single children and wider angles, it reads as gnarled.
- **Click handlers should compute their own coordinates.** Reusing the last mousemove position
  failed when a click arrived without a preceding move (touch, synthetic events).

## Ideas not done
A walking character (the obvious next step, and a big one); thunder with a delay after the
flash; rain streaks lit inside the beam; a candle-lit cottage window; parallax as the view
scrolls wider than 320 px (those games' rooms often did).
