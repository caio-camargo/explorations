# Night Storm — notes
**Version**: 1.2.0 · **Author**: Caio + Claude (Opus 5.5) · **Created**: 2026-09-25 · **Updated**: 2026-09-25 · **Status**: Active
**Purpose**: Pixel art in the style of early-90s point-and-click adventures (LucasArts VGA era): a stormy night on a coast, with a lighthouse, a dead tree and a working verb interface.

## The idea
Caio loves the look of the old LucasArts adventures. The goal was a stormy night landscape in
that idiom. It had to be a real indexed-colour VGA screen, not "retro-flavoured" modern art.

## How it works: the period tricks, done the period way
- **320×200, indexed colour.** The framebuffer is an array of palette indices (`Uint16Array`, see v1.1). RGB only
  exists at the very end, via one palette lookup per frame. Nothing is drawn in RGB.
- **Ramps plus ordered dithering.** The palette is named ramps (SKY, CLOUD, SEA, ROCK, …), each
  dark→light. Every surface is shaded with a float and a 4×4 Bayer dither into its ramp. That
  is what gives the cross-hatched gradients in the sky and clouds.
- **Tall pixels.** VGA mode 13h pixels were 1:1.2, so the screen scales ×5 wide and ×6 tall
  (1600×1200) and displays at 4:3. Scaled square, it looks subtly wrong.
- **Lightning is a palette swap, not a redraw.** Every colour except the lamp and UI is mixed
  toward pale blue-white, on a flicker sequence `[2,2,0,1,2,1,0,0,1]`. The bolt is a jagged
  random walk with side branches, drawn *behind* the mountains.
- **Lighthouse beam = light that stays inside the palette.** It lifts each pixel up its *own*
  ramp, so it never introduces a new colour, the way the originals had to (see v1.2 for how).
- **Scene composition** is one per-pixel priority pass: hill → cliff → sea → mountains → sky,
  with clouds, moon and bolt inside the sky. A parallel `idb` buffer records which object owns
  each pixel, so hover and click hit-testing is exact and free.
- **Tree:** a recursive branch structure with relative angles, so wind sways it from the root
  outward. Each segment is drawn twice (offset 1 px left in a lighter tone) to give a moonlit rim.
- **UI:** the classic 9-verb grid, sentence line, inventory boxes, cycling crosshair and a
  hand-drawn variable-width bitmap font (caps rows 0–5, x-height 2–5, descenders 6–7).
  Look at / Pick up / Talk to / … on each object gives a line of dialogue.

## v1.1 — the "painted VGA" pass
Prompted by the question "did Full Throttle have this same resolution?" It did (320×200, 256
colours). The difference was painted art, long palette ramps, very little dithering, and CRT blur.
- **Two palette modes from the same anchor colours (V).** *Dithered* uses the anchors
  themselves, 74 colours with full Bayer dithering: v1.0's look. *Painted* interpolates every
  ramp to 8–32 steps, 214 colours. There, the Bayer threshold is squeezed toward .5, so it
  mostly rounds to the nearest shade and only dithers at the seam between two.
- **Static relief layer.** The hill, cliff, boulders and mountains are shaded once at startup
  into a per-pixel (ramp, shade, id) table. Each frame only dithers it, so the mode toggle is
  free and the foreground costs nothing.
- **Cliff = lit Voronoi facets.** Jittered cells, wider than tall to suggest bedding. Each cell
  is a flat plane with a random tilt, lit by `n·L` from the moon. Only some block boundaries
  are open cracks. Moss sits on up-facing facets. There are wet streaks and a darker wet base.
- **Hill:** a grass layer that is lit by the slope of the ground, exposed rock/earth below lit
  from a heightfield normal, sphere-lit mossy **boulders** (clickable, with their own lines),
  and wind-blown grass blades along the hill and cliff tops.
- **CRT (C).** The image is blurred horizontally only: a 320→1600 smooth resample into a
  1600×200 buffer, then nearest-scaled ×6 vertically. A 6-row scanline pattern is multiplied
  over it, aligned to the source rows, then a blurred additive glow and a vignette.

## v1.2 — the beam turns to face you
- **Smooth beam.** v1.0's beam jumped two fixed steps with raw Bayer dithering, even in painted
  mode. Now `lift(i, e)` raises a pixel by a *fraction of its ramp's length*, and dithers the
  remainder exactly like `dith()`. That gives a smooth falloff in painted mode and a crunchy
  one in dithered mode.
- **The lamp rotates in 3D.** `c = cos` is the sideways part (on-screen beam length) and
  `s = sin` is the part toward the viewer. On the far half of the turn, the beam and the lamp
  dim. On the near half they strengthen, and the cone gets short and fat as it swings round.
- **Facing the viewer** (`face = max(0, s)^6`, about 1.5 s per 9 s turn):
  - a bloom up to ~100 px that washes over the tower
  - an anamorphic horizontal glare streak across the whole screen, plus a short vertical spike
  - the lamp at full white
  - the whole palette (UI excluded) mixed 13% toward warm white, reusing the lightning trick
    in a different colour
- The beam now draws after the rain, so drops glitter as it passes.

## Controls
Click a verb, then something in the scene · V painted/dithered · C CRT · L forces lightning · space pauses · R records 10 s of webm.

## What it taught
- **Per-column slope lighting on a noisy ridge makes vertical stripes.** Measure the slope
  over ±3 px. Also give the ridge a 1-px lighter rim, or distant mountains vanish into a
  night sky that is nearly the same value.
- **A dead tree needs sparse branching.** At 2–3 children to depth 6 it read as a bush. At
  depth 5, with frequent single children and wider angles, it reads as gnarled.
- **Two palettes sharing one index space overflow a byte.** 74 + 214 + UI = 276 entries, so a
  `Uint8Array` framebuffer silently wrapped index 276 to 20. The symptom was a purple UI and
  washed-out colours, with no error. Each *mode* stays under 256; the combined table doesn't.
- **Don't name a global `top`.** `const top = …` at script top level collides with `window.top`
  and kills the whole script at parse time. The only symptom was a black page.
- **Rock realism came from structure, not texture.** Heightfield strata read as wood grain or
  dunes, small Voronoi cells with every joint drawn read as a cobblestone wall. Large,
  horizontally stretched facets with sparse cracks read as rock.
- **A flare that lasts a few frames and is one step bright doesn't register.** The facing
  moment needed to be long (a power-6 window rather than a hard threshold), large, and to
  touch the whole frame (the palette warm) before it read as an event.
- **Click handlers should compute their own coordinates.** Reusing the last mousemove position
  failed when a click arrived without a preceding move (touch, synthetic events).

## Ideas not done
A walking character (the obvious next step, and a big one); thunder with a delay after the
flash; rain streaks lit inside the beam; a candle-lit cottage window; parallax as the view
scrolls wider than 320 px (those games' rooms often did).
