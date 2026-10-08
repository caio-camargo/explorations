# Pulse Loop — notes
**Version**: 1.4.0 · **Author**: Caio + Claude (Opus 5.5) · **Created**: 2026-10-01 · **Status**: Active
**Purpose**: Programmatic video loops, the kind a DJ projects behind the decks. Pulsing, hypnotic, tempo-locked, and seamless when they loop.

## The idea
Generate VJ-style loops from code instead of keyframes. The loops should pulse on the beat, feel
vaguely hypnotic, and record to a file that loops with no visible seam.

## How it works
- **One WebGL fragment shader, six scenes.** tunnel (one ring arrives per beat), spiral (two
  counter-wound log-polar spirals, so the zoom never ends), moiré (two ring families from
  orbiting centres), kaleido (6-fold folded domain-warp plasma), squares (twisted square tunnel),
  dots (a breathing halftone grid with a polar wave).
- **Everything is a function of loop phase `P ∈ [0,1)`.** Each time dependency has a whole
  number of cycles per loop: `s = 2πP` times an integer, `P·BEATS` times ½ or 1 (BEATS is always
  a multiple of 4), and palette hue shifts by `+P`, whose period is 1. As a result `P=1` renders
  the same image as `P=0`. The loop is **seamless because of how the maths is built**, not
  because of a crossfade.
- **The pulse** is a kick envelope `exp(-5·fract(beat))` with a 1.25× accent on each bar's
  downbeat. It drives a whole-frame zoom "breath", a chromatic RGB split (the scene is rendered
  3× at slightly different scales), and per-scene effects such as ring flashes, spiral
  thickness, moiré frequency and dot size.
- **Tempo** accumulates beats (`beatPos += dt·bpm/60`) instead of computing `t·bpm`. Changing
  BPM live therefore never makes the phase jump. Tap tempo averages the intervals between taps
  and snaps the downbeat to the latest tap.
- **Recording:** R resets the phase to 0, switches the canvas to 1920×1080, and records exactly
  `bars × 4` beats through `MediaRecorder`. It stops *before* drawing the frame at
  `beatPos == beats`, because that frame is identical to the first one and would play twice at
  the seam.

## v1.1 — the organic set (scenes 7–0)
Asked for "more pulsing, sensuous, vaguely biological". Four scenes on a different rendering
model: **lit height fields** instead of flat patterns.

- **cells:** Voronoi tissue. Seeds orbit on loops, each cell swells as a heartbeat wave
  crosses it outward from the centre, membranes flash as the wave passes, and the nucleus shows
  through the cytoplasm.
- **flesh:** a folded membrane made of domain-warped fbm, with slow peristaltic rings. Thin
  valleys glow on the beat.
- **veins:** backlit tissue (like holding a hand over a torch). Ridged noise gives the vessels,
  which absorb the light until the surge passes through them.
- **anemone:** two layers of tendrils swaying in a travelling wave, a pulse running from base
  to glowing tip, and marine snow drifting up.

Machinery that makes this work:
- **Noise that loops.** This is 3-D gradient noise whose lattice wraps in z (`mod(i.z, per)`),
  sampled at `z = P·per`, so over one loop the field *evolves* and then returns exactly to its
  starting state. Each octave doubles both its spatial frequency and its z period, so fine
  detail churns faster than coarse detail, which is what makes it look alive.
- **Wet shading from one evaluation.** Normals come from `dFdx/dFdy` of the height field
  (`OES_standard_derivatives`), so a heavy fbm field is computed once per pixel instead of 3×.
  The shading has wrapped diffuse (light bleeds round forms), a tight specular highlight for
  wetness plus a broad sheen, a Fresnel rim, emissive "light inside", and a soft tone curve. The
  palettes become materials: iridescent (thin-film sheen), abyss (bioluminescent), flesh, jelly
  and pearl.
- **Pulse shapes** (B): kick, **heart** (lub-dub, with the dub 0.2 beat later at 70%), and
  **swell** (a slow breath every 2 beats with a fast rise and slow fall). The pulse is
  evaluated as `wave(beat − delay)`, so it **travels through space**. There are two attack
  widths: hard for the beat itself and soft (0.09 beat) for travelling fronts. A hard attack
  that travels shows up as a sharp ring cut across the image.

What went wrong first:
- **`pow(x, 2.)` with negative x → NaN.** GLSL leaves `pow` undefined for x<0. The anemone
  tendril cross-section used `pow(fx/w, 2.)` with signed `fx`, and alternate captures came out
  black with one surviving streak. It wasn't a steady half-missing image, and that flicker is
  how the bug shows itself (NaN also spreads through `dFdx` within each 2×2 pixel quad).
  Fixed with `x*x`.
- **Fine ridged noise on the bump map gives glitter, not veins.** Pixel-scale ridges plus an
  80-exponent specular produced sparkle everywhere and read as intestine. The vessels moved
  from the height field into the emissive term ("under the surface, not on it"), and the ridge
  exponent went from 7 to 16 for thinner vessels.
- First cells had flat-topped domes and dimpled nuclei, which read as rubber tiles or buttons.
  Fixed with `b·(2−b)` domes, and the nucleus became a colour change rather than a dent.

Cost, measured at 1920×1080 on this machine (GPU time per frame, forced with readPixels):
geometric scenes 1.1–1.6 ms; cells 7.5, flesh 6.9, veins 8.7, anemone 1.8 ms. That fits in
60 fps here, but a weak laptop GPU or a 4K output could drop frames. A render-scale option is
the fix if that happens.

## v1.2 — psychedelic colour on the organic set
Feedback: cells, flesh and veins are the right direction, but the colours were too literal (red
flesh). Caio asked for pinks and blues and more psychedelia.

- **Hue is a field, not a material.** Each scene computes a hue coordinate
  `t = P + PSY·(field terms)`. Cells use their identity hash (a full turn, so neighbours can be
  any hue), plus dome height and the passing wave. Flesh uses fold height and the warp vector.
  Veins use tissue density and radius, which gives concentric hue rings that the surge drags
  outward. The palette is read at three offsets: body at `t`, inner glow at `t+.15`, and
  shadows at the opposite hue `t+.5`. The sheen is read at `t + surface angle`, which gives
  thin-film rainbow edges.
- **New cyclic 4-stop palettes:** candy (hot pink / electric blue / magenta / cyan, the new
  default), lagoon, orchid (pastels). acid, spectrum and flesh are kept. The geometric scenes
  use the same palettes.
- **The psy slider** scales how far `t` wanders. At 0 the frame is one hue drifting once per
  loop; at 1.5 every fold and cell differs.

What went wrong first: **stacked hues average to grey.** The first pass (glow at a quarter-turn,
pale lilac/sky stops, narrow `t` ranges) rendered as milky lavender. Body, glow, shadow and
sheen each brought a different hue, and their sum came out desaturated. The fixes were: keep
the glow close to the body hue (`+.15`, not `+.25`); use fully saturated palette stops; widen
`t` so each frame spans at least half the cycle and pink and blue are both on screen; and add a
luminance-preserving saturation push of `1 + .5·PSY` after the tone curve.

## v1.2.1 — rounded cells
Caio asked to remove the pointed corners of the cells. Voronoi `d2−d1` contours are straight
polygons, so the domes had sharp corners. The fix replaces `d2−d1` with a **smooth minimum of
the gap to every neighbour**, `edge = −log Σ exp(−K·(dⱼ−d₁)) / K`, computed in a second 3×3 pass
once the nearest seed is known. At a junction two gaps are small at once, the soft-min dips,
and the membrane widens there, which rounds the corners the way packed cells and bubbles look.
K=6 gave loose, egg-like cells with wide gaps; K=9 packs them tighter.

Side effect: per-cell hue extended into the gaps right up to the old Voronoi boundary, so faint
polygons showed between the rounded cells. Fixed by blending to one shared hue
(`.7·r − .2·pulse`) wherever `edge < .12`. The second pass costs ~1.5 ms: cells went from 7.5 to
9.1 ms per 1080p frame.

## v1.3 — abstracted cells, languid pulse
Caio asked for less distinct edges, a more languorous pulse, and "abstract it considerably".
The v1.2.1 cells are archived at `archive/index-v1.2.1.html`.

- **No membranes.** Each pixel's colour is a soft-weighted blend of all 9 neighbouring cells
  (`Σ col·exp(−7g) / Σ exp(−7g)`, where g is the gap to the nearest), so hues bleed into each
  other. Density fades gently toward where cells meet (with a floor of .15), so nothing turns
  black.
- **Three translucent layers** at scales 2.2 / 3.6 / 6, each drifting on its own closed orbit
  and added together. They read as out-of-focus forms passing over each other. Only the middle
  layer gets light: a broad sheen and a thin-film tint, with no glints.
- **The languid pulse** (now the default): one slow swell per bar, `sin²(π·f^0.8)`. It travels
  outward at 2.6 beats per screen unit, so a swell takes most of a bar to cross the frame.
- The layer loop stores neighbour distances in arrays and does one evaluation pass instead of
  two (GLSL ES 1.0 allows loop-index array access).

What went wrong first: **too soft a kernel shows the grid.** With blend sharpness 4–4.5, cells
outside the 3×3 neighbourhood still carry weight, and leaving them out produced straight dark
seams along lattice lines. Sharpness has to stay at about 7 or above (e^−4 ≈ 2% at the
truncation distance), so the softness has to come from the density ramp, not the kernel. The
first pass was also too dark (like bokeh in a night photo); layer weights went up.

Cost: 12.5 ms per 1080p frame (3 layers × 9 neighbours, each with a palette lookup and a pulse
evaluation). The live canvas is now capped at 1 render px per CSS px, because HiDPI would have
quadrupled that. Recording stays fixed at 1920×1080.

## v1.4 — zoom: infinite zoom, cybernetic, EDM
Caio asked for an infinite zoom toward the centre: the same organic and psychedelic
inspirations plus something vaguely cybernetic, leaning into the hypnotic and toward EDM
visualizers. The new scene is `zoom` (key `-`), now the default, with the kick pulse.

- **Log-polar makes the zoom a scroll.** `v = log2(r) − zoom`, `x = angle/2π`. One octave of
  scale is one unit of v, so zooming in is just v sliding. The loop covers `BEATS/2` whole
  octaves, and every hash is taken mod that count, so octave k+Z is octave k again: seamless.
- **The zoom rushes on the beat:** `zoom = mix(beat, floor(beat) + ease(fract(beat)), rush)·½`
  with `ease = 1−(1−f)³`. It surges forward on each kick, then glides (the rush amount follows
  pump). Speed streaks fire with the rush velocity `3(1−f)²`.
- **Layers:**
  - Organic: soft colour-bleeding cells in log-polar. Because log-polar is conformal, choosing
    N ≈ 2πM/ln2 columns keeps them round at every depth (M=2 rows per octave, N=18).
  - Cybernetic HUD per octave: main ring + halo, 64 ticks, long ticks every ⅛ turn, 12 arc
    segments counter-rotating by octave parity, and a comet on the main ring.
  - Circuit traces in the outer band of each octave, with data flowing along them.
  - The light at the end: a core glow flashing on the kick.
  - An EDM spectrum ring: 36 mirrored bars at a fixed screen radius with new heights each beat,
    scaled by the kick.
- **Anti-aliasing without fwidth.** Lines get thinner toward the centre (an octave shrinks
  geometrically), so line coverage uses analytic pixel footprints:
  `fwx = 1.4/(r·R.y·2π)`, `fwv = 1.4/(r·R.y·ln2)`. fwidth would blow up on the atan seam. Fine
  structure fades out once an octave gets thinner than ~11 px.
- Cost: 2.6 ms per 1080p frame, cheap because there's no fbm.

### The compile-time wall
Adding zoom **hung the page on load**: a white page, a dead main thread, and nothing in the
console. Measured per scene: zoom took 4.4 s to compile and cells **21.9 s**. WebGL on Windows
goes through Direct3D's compiler, and the old design (one shader branching on a `SCENE` uniform)
compiled all eleven scenes together. Fixes:
1. **One program per scene**, with `#define SCENE n` and `#if` dispatch. A constant-false
   `if(SCENE==7) return flesh(uv);` still references `flesh`, so the preprocessor has to remove
   it.
2. **No local arrays.** The v1.3 two-pass soft-min stored `float d[9]; vec3 cc[9]`, and cells
   inlined that three times. One pass is exact: `Σ e^{−K(dⱼ−d₁)} = e^{K·d₁}·Σ e^{−K·dⱼ}`, and
   the colour blend's normalisation cancels d₁. Cells went from 21.9 s to 1.3 s and zoom from
   4.4 s to 1.1 s. Cells also got a little faster to *run* (12.5 to 11 ms).
3. **Background compiling** with `KHR_parallel_shader_compile`. All 11 programs are queued at
   load, nothing queries `COMPILE_STATUS` early (that forces a synchronous compile), and the
   draw loop keeps showing the current scene until the newly chosen one reports
   `COMPLETION_STATUS_KHR`, so switching scenes never freezes the picture.

Not verified this round: the recorder. The hidden preview pane stopped running
`requestAnimationFrame` entirely (a raced rAF probe got no callback in 2 s), so nothing draws
and nothing records there. The record path itself didn't change, and it was verified in v1.0.

## Controls
1–9,0,- scene · P palette (candy / lagoon / orchid / acid / spectrum / flesh) · psy slider = colour wander · B pulse shape (kick / heart / swell / languid) · T tap tempo · S strobe (invert on
each beat) · F fullscreen · space pause · H hide panel · R record one loop. The panel fades after
3 s without mouse movement. The pump slider sets how hard the kick hits, and warp sets how much
geometry wobbles.

Convert the recording for VJ software (fixed 60 fps, so the browser's variable-rate timestamps
are flattened):
`ffmpeg -i pulse-loop_X.webm -r 60 -c:v libx264 -pix_fmt yuv420p -crf 16 pulse-loop_X.mp4`
For Resolume and similar, HAP plays more smoothly: `-c:v hap -format hap_q` (requires an ffmpeg
built with snappy).

## What it taught
- **A `MediaRecorder` on a canvas can return an empty file if it starts in a tab that hasn't
  painted yet.** On a freshly opened tab the first attempts produced 110 B and then 0 B. The
  same call a few seconds later produced 535 KB for a 2 s loop, a valid 1920×1080 VP9. It also
  needs a timeslice (`start(250)`) to be robust. The webm has no duration header (`duration =
  Infinity`), so the ffmpeg remux above is required, not optional.
- The first "acid" cosine palette (`a + b·cos(2π(t+d))`) came out **orange** in the tunnel. A
  four-parameter cosine palette is hard to steer toward a specific two-colour identity. A plain
  `mix(magenta, cyan, ½+½cos 2πt)` gets there directly.
- The first kaleidoscope (thin `pow(1-|v|, 8)` lines on a 25%-bright base) was murky. It needed
  real tonal range: the body is scaled by `|v|^0.6` and the lines are a contrasting hue.

## Not verified
Only stills were checked (the preview pane captures single frames), so **the motion and the
pulse feel have not been seen.** Run it full-screen with a track playing.

## Ideas
- Mic or line-in beat detection, so it follows the DJ without tap tempo.
- Feedback trails. These break exact loops, but they converge, so a pre-roll of one loop before
  recording would hide that.
- Scene morphing on phrase boundaries (every 8 or 16 bars).
- Offline exact-frame render (step `P = i/N`, read pixels, and pipe them to ffmpeg) for a
  perfectly constant frame rate.
