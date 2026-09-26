# Night Storm — notes
**Version**: 1.6.0 · **Author**: Caio + Claude (Opus 5.5) · **Created**: 2026-09-25 · **Updated**: 2026-09-25 · **Status**: Active
**Purpose**: Pixel art in the style of early-90s point-and-click adventures (LucasArts VGA era): a stormy night on a coast with a lighthouse, and since v1.6 the keeper's room inside it, where Claude lives. Two rooms, a verb interface, an inventory and one small puzzle.

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

## v1.3 — me, walking around
Caio asked for a character that walks where you click, as a representation of Claude. It's
a small hooded figure in a terracotta raincoat carrying a lantern: a warm light in the
storm, echoing the lighthouse. It's deliberately a character, not a logo.
- **Sprite:** 12×20 ASCII frames (idle, stride, passing), with a 1-px bob on passing frames.
  The coat is shaded *at draw time* from each pixel's neighbours, so the moonlit edge stays
  on the moon's side whichever way the figure faces (mirroring a pre-shaded sprite would
  put the rim light on the wrong side). The face is in hood shadow, with one lantern-lit
  cheek pixel.
- **SCUMM-style depth scaling:** ×0.9 at the back of the hill up to ×1.4 at the front, with
  nearest-neighbour scaling, like the originals.
- **Walk area** = the hill's grass/earth pixels, minus boulders. Clicking the sea, cliff or sky
  walks to the nearest reachable point. Movement is a straight line that slides along
  obstacles. Depth moves at 0.8× speed.
- **Verbs walk first, then act** (SCUMM's convention). Lines are spoken above the head, in a
  warm speech colour, kept on screen. "Walk to" only speaks where a line exists (the sea,
  the lighthouse).
- **Occlusion:** the figure is drawn before or after the tree depending on its y, and
  boulders store their base line (`stZ`), so a boulder whose base is nearer hides the legs.
- **Lantern:** a flickering `lift()` glow on the ground and rain around it. It's drawn before
  the figure, so it lights the surroundings, not the coat. The figure is lit by lightning
  and the lighthouse beam like everything else. Clicking the character gets
  self-referential lines ("I'm already in use.").

## v1.4 — a rope bridge to the lighthouse
- **Geometry forced a staircase.** The hill peaks at y≈129 and the cliff top is at y≈64. A
  bridge straight from the grass would be a 30° rope ramp. Instead, rickety stairs climb to a
  braced landing at y≈100, and the bridge sags from there up to the cliff edge. (The small
  boulder that sat under the landing moved to x=58.)
- **Bridge:** the deck and the hand rope are both sagging curves between anchor posts.
  The sag breathes with the wind gust, and a Gaussian dip follows the character's position
  along the deck (weight). The deck is seen edge-on, with plank seams and planks missing
  where a hash says so. There are suspender ropes every 6 px. The *near* hand rope and the
  suspenders draw after the character, so it walks between the ropes.
- **Walk boxes.** SCUMM rooms were walk boxes joined at edges. Here there are two: the
  open hill (2D, as before) and a 1-D route indexed by `k` (stairs → landing → bridge → cliff
  top → door), each point carrying its own depth scale (see v1.5). A walk is a list of legs, and crossing between areas goes through the stair foot
  `E`. Deck points get their y from the live deck curve every frame, so the character rides
  the sway.
- **Clicks:** the route objects (bridge, stairs, cliff, lighthouse, door) target the nearest
  route point. The door and the lighthouse go straight to the door. "Use" on the bridge
  crosses to the other side.
- **The door:** arched, planked, a brass handle pixel, locked. Every verb has a line
  ("Push: it's locked. Pushing doesn't change its mind.").

## v1.5 — the bridge recedes
Caio: the figure looked too big next to the door, and the bridge had no depth.
- **Perspective-correct bridge.** The far end is `BK = 2.4`× further away. `u` is the world
  position along the bridge, and the screen fraction is `bf(u) = uK / ((1-u) + uK)`. That is
  the standard perspective-correct interpolation, so the near half fills ~70% of the span.
  Sag, rail height, deck thickness (3 px → 1 px), plank seams, missing planks and suspender
  spacing are all defined in world units and scaled by `bs(u) = 1 / ((1-u) + uK)`. They
  bunch up toward the cliff on their own.
- **The character follows the same depth.** Route points on the bridge are sampled evenly in
  world `u`, so a constant walking speed slows down on screen as the figure recedes. It
  shrinks from ×0.82 at the landing to ×0.34 on the cliff top: 7 px tall next to the 9 px
  door. Along the cliff top the walk speed scales down to match.
- **Real pathfinding on the hill.** The straight-line walk with "slide along obstacles"
  oscillated forever behind the big boulder: slides never counted as stuck. It was replaced
  with a BFS distance field over the walkable pixels (8-connected, computed per hill leg,
  about 2.5k cells). The walker aims 4 cells down the gradient so diagonals come out smooth.

## v1.6 — inside the lighthouse: Claude's room
Caio asked for an indoor scene: Claude's bedroom, still a stormy night, with more detail and
interactable objects, and jokes about p(doom), paperclips and Claude lore. We chose to put the
room **inside the lighthouse**, so Claude is the keeper. That settles who keeps the lamp lit,
and it explains why the outside door was "bolted from the inside".

**The story now starts at home.** Try to open the desk drawer: locked. Pick up the one
paperclip ("Just the one. I know how this story goes."), use it on the drawer ("Paperclips
have exactly one good use, and this is it."), and take the spare key ("DO NOT LOSE. AGAIN.").
Use the key on the front door, open it, and you step out onto the cliff top of the original
scene. The outside door now lets you back in.

**How the room is built:**
- **A cut-away cylinder.** The round room is a cylinder (radius 9, centred behind the back
  wall) seen through a pinhole camera: eye height 6, focal 68 px, horizon row 16. Each screen
  column hits the wall at one angle, found once by bisection, so walls and floor are ray-cast
  per pixel. Stone courses, the rug and the floorboards are computed in world coordinates, so
  they curve and recede correctly.
- **Wall decorations live in (angle, height) space.** Each one is a small procedural texture:
  - the arched window with curtains, a rod and a view outside
  - the arched door with iron straps, a ring pull and a keyhole
  - the calendar
  - the p(doom) barometer, whose needle twitches with lightning and jumps if you tap it
  - the "Attention Is All You Need" poster, drawn as the Transformer diagram
  - the Helpful·Honest·Harmless sampler, as real 17×9 cross-stitch
  - a three-shelf bookcase whose special spines are separate hotspots: the *Opus / Sonnet /
    Haiku* family albums (shrinking), *You're Absolutely Right!* and *The Constitution*
- **Furniture is world-space boxes and quads** splatted into one depth buffer with the walls,
  the props and the character: the bed with a patchwork quilt, the nightstand, the desk and
  its drawer (which really slides out), a chair, the old terminal with a blinking prompt, the
  wardrobe (open it: seven identical raincoats), and a 20-step spiral staircase with a helical
  handrail rising to the lamp room.
- **Props are little sprites standing in the world:** the lamp, diary, duck, paperclip, tip
  jar and key.
- **Lighting is computed, not painted.** There are three lights: the bedside lamp (which you
  can switch off), the lantern Claude carries, and the storm through the window. Every indoor
  material ramp runs cold-dark → warm-light, so shadow reads as moonlight and lamplight reads as
  amber without any hue maths. Lightning indoors is *not* a palette flash. The light arrives
  through the window: a cold wash on the walls and the window's shape thrown across the floor,
  with the mullion cross as a shadow in it. Warm light spills down the stairwell, pulsing as the
  lens turns overhead.
- **The view out of the window** is the outside scene, far away: the hill, the dead tree, the
  rope bridge, the sea, clouds and lightning. Rain beads slide down the glass.
- **Per-room palettes, like the originals.** Indoors uses 226 colours in painted mode,
  outdoors 242. Each room stays under 256; the HUD shows the current room's count.
- **The character gets an indoor sprite:** 16×34, with toggle buttons, and it is not the
  outdoor sprite blown up. It scales with true perspective (`5.2 / depth`), is depth-tested
  against furniture, and is lit by whatever light the room has at its position.
- **SCUMM habits kept:** a walk point per object, placed *beside* the object and never in front
  of it; the character turns to face what it's using; "Use X with Y" through the inventory; a
  line for every verb on every object (29 objects × 9 verbs, all checked).

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
- **Hidden preview panes throttle requestAnimationFrame to ~1 fps.** The walk looked
  "stuck" while testing; stepping `updateMe()` manually proved the logic was fine.
- **Scale a receding object in world units, not screen units.** Linear-in-screen
  interpolation (v1.4) made the bridge look flat and the figure too big at the far end.
  Defining everything along the bridge in world `u` and projecting once gets the bunching,
  thinning and slowing for free.
- **A "slide along obstacles" walker needs a stuck detector that counts slides.** Otherwise
  it can oscillate between two slides forever. Better still, use a distance field.
- **Check furniture against a curved wall in world space.** The nightstand sat 0.9 units
  outside the room's radius. The depth buffer hid it silently, and it took the room's main
  light with it, so the whole room was dark for a reason that had nothing to do with lighting.
- **Walk points go beside objects.** Standing in front of the desk hid the paperclip and the
  drawer, the very things being used, so a scripted test "couldn't find" them.
- **Indoor lightning reads better as directional light than as a palette flash.** The palette
  swap that works outdoors flattened the room. Light through the window, and nothing else, is
  what makes it dramatic.
- **Testing a paused animation loop:** a paused loop still redraws every frame and overwrites
  hand-drawn test frames. Copy the frame to an overlay canvas instead. Don't stub out
  `requestAnimationFrame`: screenshot tools wait on it.
- **Click handlers should compute their own coordinates.** Reusing the last mousemove position
  failed when a click arrived without a preceding move (touch, synthetic events).

## Ideas not done
The lamp room at the top of the stairs (a third room); a use for the rubber duck; thunder with a delay after the
flash; rain streaks lit inside the beam; a candle-lit cottage window; parallax as the view
scrolls wider than 320 px (those games' rooms often did).
