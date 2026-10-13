# Launchpad notes — Look & sound
**Version**: 1.0.3 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-11 (split from NOTES.md v1.21.52, W37) · **Updated**: 2026-10-12
**Purpose**: The build log for hardware looks, schools in the game, plumes, re-entry and air effects, lighting, the sky, sound, the crew's look.
**Status**: live log, oldest first; new sections go at the bottom. Index of every section: [`../NOTES.md`](../NOTES.md).

---

## Part visuals — early-era hardware look (2026-10-07, visuals session, branch `visuals`)

Direction agreed with Caio: **early-era realism**, 1950s–60s hardware to match Epochs 1–2. Later eras can shift the palette.
Everything is procedural in the mesh shader, with no image textures.

### How it works
- **Each part has its own surface frame.** The vertex grew from 10 to 16 floats (`VX=16`): turns around the part's *own*
  axis, height above the part's bottom, the part's nominal radius and height, the detail kind (`KIND`) and the part index.
  `partShape` sets `PK` while a part is built, and `lathe`/`box`/`fin` stamp it into every vertex (`pv`). Scaled 2.5 m parts
  scale the height/radius entries along with the positions, so detail sizes follow the part (`sc = R/0.625`). Side boosters
  get patterns centred on their own axis, which fixes v1.11's off-axis grime. `builder.js` steps by `VX` and only touches
  entries 6–9, so it needed no change.
- **One detail branch per kind in `MESH_FS`,** gated on `uSeam` (ship, debris, the builder's solid ghost). It uses shared
  footprint-filtered helpers (`lin`, `sqw`, `band`, `dots`), so every line, checker and rivet fades to its mean instead of
  shimmering. Footprints are taken once, before the branches. Bump detail tilts the object-space normal along the
  around-axis tangent `T`. `uM` is now read in the fragment shader as well.
- **What each part looks like:**
  - tanks: Saturn/V-2 roll-pattern checker bands top and bottom when taller than 3 m; two opposite black stripes on 1.5–3 m
    tanks; the old orange mid-band is gone. Weld rings, one longitudinal seam, and rivets on the end flanges.
  - engines: the profile is split at the throat into bell and mount. The bell has regen tubes (count fixed by exit radius,
    so they converge toward the throat), heat tint (straw → blue → violet toward the throat), a stiffener at the lip and a
    sooted interior. The interior glows by throttle (`uHot[part index]`, set for active engines each frame). Engines of
    200 kN and up carry a turbopump with an exhaust duct, plus a gas-generator can.
  - capsule: dark corrugated shingles (Mercury), shingle rows with rivets, a framed trapezoid window drawn on the surface
    (replaces the glass puck), a hatch outline.
  - nose cone: fairing split lines with rivets, a scorched tip.
  - decoupler: hazard band, ribbed skirt, separation groove with bolts. The interstage shell has stringers and vent ports.
  - fins: now swept and tapered (`fin()`), white and black alternating, with a bare-metal leading edge.
  - instruments: crinkled gold foil.
  - biocapsule: a porthole and a hatch seam.
  - mass simulator: bolted steel plates (it was yellow like a decoupler).
  - parachute: canister straps and canvas weave.
  - heat shield: ablator honeycomb.
  - adapter: black roll quadrants.
  - radial decoupler: chevrons.
  - reinforcement collars: bolt rows.
- **New reference views in `views.js`:** `refView(4–9)` are part close-ups in the editor (Kestrel/fins, pod, adapter +
  interstage, instruments, Lunar t8, heat shield). `refView(10)` is the Sounding rocket firing, seen from below.
  `refView(1)` now resets `cam.edY`, which the close-ups leave set.

### Measurements
GPU timer queries (`gpuMs`, `RS` pinned to 1), 1280×800 headless Chrome on the RTX 3050. Two alternating rounds against a
`main` snapshot (`34a2317`), three 1.2 s samples per view:

| view | main | visuals |
|---|---|---|
| 4 Kestrel close-up | 3.0–3.4 ms | 2.8–3.0 ms |
| 5 pod close-up | 2.9–3.3 | 2.9–3.7 |
| 2 ascent | 2.2–2.6 | 2.2–2.7 |
| 10 engine from below | 1.2–1.6 | 1.2–1.7 |

The two are the same within noise. The per-part branches are cheap next to the sky and ground shaders.
`test.mjs`: all passed (the pass is render-only).

### What went wrong on the way
- **`render()` + `gl.finish()` timing is meaningless under ANGLE/D3D11.** It reported 0.1–0.2 ms for frames that the timer
  queries put at about 3 ms, so `finish` doesn't wait there. Use `gpuMs`.
- **The first gold foil read as camouflage.** Coarse normal noise on a metal flips its reflection between the sky colour
  and the ground colour (a hard `smoothstep`) in large patches. Fine, shallow crinkles (≈2 cm, ±0.75 tilt) read as foil.
  Albedo noise was the wrong lever.
- **The bell-interior glow is almost never visible.** The plume covers the bell from below, and from the side you see the
  outside of the bell. It costs nothing, so it stays. The version you would actually see is a radiatively cooled nozzle
  extension glowing on vacuum engines (the Petrel), on the *outside* of the bell (open thread).

### Screenshot pipeline (CLI, no app needed)
Headless Chrome on the real GPU (`--use-angle=d3d11`), driven over CDP by a ~30-line Node script (Node 24 has a built-in
WebSocket): navigate, inject `views.js`, `Runtime.evaluate("refView(n)")`, `Page.captureScreenshot`. Claude reads the PNGs
directly. It is `shot.mjs` in this folder (usage in its header).

### Still open (visuals)
- ~~Petrel nozzle extension glowing~~: done ("Flight marks").
- ~~Soot and scorch that build up~~: done, see "Flight marks" below.
  (skin temperatures already exist in the sim).
- Ambient occlusion where parts meet. LOX frost on cryogenic tanks while on the pad.
- Paint schemes per design or era (agency white, company livery), from the same roll-pattern machinery.
- Lettering and flags on tanks: needs a glyph atlas or SDF; skipped for now.

### Parts added after the texture pass (same day)
An audit of `PARTS` against `partBody` and `KIND`: no part falls back to an undetailed shape. Engines carry no `KIND` on
purpose (`engine()` sets bell/mount). Three parts other sessions added after slice 1 had only been mapped onto existing
detail, and got a design pass:
- **Imaging camera:** a bare-aluminium bay, a black optical port, and a lens barrel looking *out* of the side (`tube` along +z).
  The old "lens" was a vertical disc stuck to the hull. A film-return hatch is on the far side.
- **Antenna:** a parabolic dish (focal length 0.15 m) on a mast, its feed horn held at the focus by three struts, two whip antennas.
- **Radial fin:** alternates black/white by part index like the fin ring, with a root bracket on the hull.
- **Docking port, RCS quad, gas bottle** (arrived during this pass): a capture ring with a probe, guide vanes and latches;
  four little heat-tinted bells on an outrigger, on the same thrust axes the physics uses (`RCS_OFF`); a painted bottle
  with a service band, straps, valve and a feed line. `port` now takes the bolted-ring detail (`KIND` 7).
- **Claw:** a drive housing with a hazard band, a turntable and contact plate, three jointed fingers with hinge knuckles,
  hydraulic rams and padded tips, all inside the original envelope.
- **Probe core:** a guidance ring (Agena/Ranger style): foil between bolted rings (`KIND` 7, so the foil crinkles), four
  equipment boxes (two with thermal louvers), a sun sensor, a status lamp, two whips angled clear of whatever sits above.
Re-run the audit when parts are added: list the `PARTS` keys and `big()` bases, and check each against the `case` labels in
`partBody` (tanks use the default) and its `kind` against `KIND`.

## Flight marks — what a flight leaves on the hardware (2026-10-07, visuals session)

Slice 2 of the visuals work, agreed with Caio: the rocket no longer looks factory-new forever. It is render-only. The sim
never reads marks; they live in a `WeakMap` keyed by part object (`MARKS`), so they ride along onto debris and landed
stages, and a new flight starts clean.

### How it works
- **`marksTick()`** runs once per `render()`. Its step is the sim-time delta, capped at 5 s, so warp is roughly right.
  - **Soot:** a burning engine, and the base of the parts up to 3 m above it on its stack line. The rate is ×(1 + 2·(1 −
    p/p₀)) because the plume balloons at altitude and washes back over the base.
  - **Char:** maps the peak skin temperature `p.T` onto 480 K → the part's `Tmax`, so 1 means about to burn up. Its
    direction is the heat-weighted airflow in the ship frame (`qrot(qconj(q), v − v_surface)`). A heat shield blackens from
    ~420 K and also with the ablator it has used.
  - **Frost:** set to 1 on fuelled tanks while landed and before first liftoff (`S.mkLift`). It sheds at
    1/45 s⁻¹ + speed/6000.
  - **Glow:** vacuum engines only (`ispA < ½·ispV`, i.e. the Petrel). It follows the throttle with a 6 s heating and
    12 s cooling time constant.
- **`setMarks(u, parts)`** packs the marks into `uMk[96]` (soot, frost, fuel level, glow) and `uCh[96]` (windward direction,
  char), indexed by part index. It is called for the ship, then per debris, then with `[]` so the editor and builder
  ghosts draw clean. This replaced v-slice-1's `uHot` (the inner-bell glow was invisible under the plume anyway).
- **Shader:**
  - soot climbs streakily from each part's base (engines all over);
  - char first scorches paint yellow-brown, then blackens it, on the windward side, streaked along the flow;
  - frost lies only below each tank's fuel line, in patches that thin as it sheds;
  - the vacuum nozzle extension glows dull red to orange from the exit up.
- **Reference views:** `refView(11)` frost on the pad, `12` soot at 70 s, `13` a biocapsule after an entry from orbit,
  `14` the Petrel 12 s into an orbital burn. The sim loops call `marksTick()` every 0.25–0.5 s, because one render only
  takes up to 5 s of marks.

### What went wrong on the way (worth knowing)
- **"Black" is not black under this light.** The first soot (mix 92 % toward albedo 0.018) didn't show at all. A red test
  colour proved the branch ran: red appeared on the black paint, while white areas stayed white. The sun term is strong
  enough that 8 % of white paint plus 0.018 still lands in the tone curve's shoulder as light grey. Soot and char now go
  to albedo ≈ 0.004 at up to 98.5 % coverage, blacker than black paint. Generalises: in this renderer, judge darkening
  effects on *white* paint.
- **Caps break anything keyed to the around-axis coordinate.** A lathe cap's triangles each span a different angle
  range, so `fwidth(u)` and arc-length noise change per triangle, and the shield face rendered as a pinwheel of wedges.
  Caps now use the planar footprint `fwidth(vO.xz)` and planar noise. This also fixes slice 1's honeycomb filtering on
  the shield face.
- **Integrated char saturates.** Accumulating char over time blackened every part within ~30 s of entry heating. Mapping
  the *peak* temperature against each part's limit reads right: the biocapsule at 853 / 1250 K is scorched, not burnt.
- **Tellus is small.** The first entry test used 7.6 km/s and sailed off to 4,700 km. Use `√(μ/r)`.
- **An unbounded sim loop in a reference view hangs headless Chrome silently.** Bound every `while` (time, `!S.alive`).

### Measurements
GPU timer, alternating against `main` (two rounds): view 4 close-up 2.7–3.8 vs 2.8–3.3 ms, view 2 ascent 2.4–3.3 vs
2.2–3.2 ms. Within the run-to-run spread, at most ≈0.2 ms. `test.mjs` all passed (render-only).

### Still open
- Char on the dark capsule shingles is nearly invisible (it's black on black). A lighter heat-tint or a sheen loss could
  carry it.
- Debris doesn't heat in the sim, so stages falling back don't char. Their marks only cool and shed.
- No soot on the *side* of a core next to a booster's engine (soot only follows the stack line).

## The launch complex (2026-10-07, visuals session)

> Axes: the pad frame is `siteFrame` (x east, y up, **z south**). Early drafts of this section had north and south swapped.

Slice 3 of the visuals work. Next to the detailed rocket, the old pad (a red pole, three white cylinders, a drum) read as
a placeholder. Only the **contents** of the `PAD` mesh changed. Where it is drawn, its height (`siteH`) and the
ground-shader apron (`padGround`) belong to the terrain session and were not touched. Everything sits at or above y = 0
in the pad's frame (x east, y up, z south), so the rocket still stands at the origin on the ground the physics knows.
Each building stands on a concrete slab that `padGround` already paints.

### What's there (early-era Cape style)
- **Launch table:** the concrete disc, a dark steel flame grate under the engines with eight radial bars, four hold-down
  posts at r 3.4 m.
- **Flame channel:** low concrete walls on a sooted floor running south. The ground can't be dug (it is raymarched in the
  sky shader), so the trench is suggested from above ground.
- **Umbilical tower** east of the rocket: an orange lattice, 3 m square and 32 m tall (`lattice()`: corner posts, a girder
  ring every ~2.5 m, zig-zag bracing). It has an elevator shaft, a cap platform, a hammerhead jib with a hook line, a
  lightning mast, and three swing arms retracted along the west face with hoses hanging.
- **Propellant farm** on its slab: a LOX sphere on six legs, a horizontal RP-1 tank on concrete saddles, pipes to the pad.
- **Deluge water tower,** a **domed concrete blockhouse** with a band of periscope slots and an antenna mast (with a cable
  run to the pad), a **compressor building**, and four **floodlight poles** around the apron.
- New helpers `tube(A, B, r)` (a cylinder between two points) and `lattice()`. About 9,800 vertices in all, a static mesh.
- `refView(15)` shows the whole complex from the north-west, `16` the tower and table. In the editor the rocket floats:
  the builder lifts the ship while you build. `refView(11)` shows it standing on the grate in flight.

### Revised layout (same day, after Caio's review)
Caio wasn't sold on the buildings, and the tower was too tall for the rocket. Both changed:
- **The tower is sized to the rocket on the pad:** about 3 m above its top, in whole 2.5 m bays, 12.5–60 m (Orbiter
  17.5 m, Big Lunar 35 m, Sounding 12.5 m). `padSync()` rebuilds the pad mesh when that changes, in the editor or on the
  pad before liftoff. The `PAD` binding is reassigned, so the terrain-owned draw call stays untouched.
- **Spread out the way real complexes are:**
  - The domed **blockhouse** moved up-range, about 230 m west, onto its own mesh slab, with a spur road down to the
    access road and a concrete cable trench to the pad.
  - The **mobile service structure** (four lattice columns on rail trucks, work decks, roof, bridge crane) is rolled back
    80 m north on twin rails that run to the launch table. Its height is the tower's + 6 m.
  - **High-pressure gas bottle racks** sit on the old blockhouse slab.
  - A **ground deluge tank** with a pump house replaces the elevated water tower.
  - **Two lightning masts** with a catenary wire.
  - **Five camera bunkers** at about 90 m and **two camera towers**.
- New helper `strip()` draws flat runs on the ground: roads, rail beds, trenches. The mesh is now ~26k vertices,
  still one static draw. `refView(17)` shows the whole site from high up.
- **The pad holds the rocket.** In the editor the builder hangs the ship 3 m up (`LIFT` in `builder.js`, so parts can go under
  its bottom), and it looked like it was hovering. While a rocket stands on the pad or is being built, `padRig()` now gives
  the pad four hold-down arms from the table posts to clamps above the engines (in the editor they become a launch stool),
  and swing arms reaching from the tower to the widest thing at each arm's height, boosters included. At liftoff the arms
  fold back and the hold-downs go (a pad rebuild keyed on the rig). The builder's code is untouched.
- **Moving parts and night lights.** The swing arms, the hold-downs and the service gantry are now separate meshes in their own frames (`buildRig`), drawn each frame by `drawPadRig` with a matrix:
  - **Gantry:** parked in the editor. A flight that starts on the pad starts with it in service position around the rocket (the open front faces it; its rails moved out to ±10.5 m to clear the tower), and it rolls 80 m back over 14 s.
  - **At liftoff (`S.mkLiftT`):** the arms swing back to the tower face, top first, 1.5 s each, 0.25 s apart, and the hold-downs tip out 0.9 rad in 0.6 s.
  - **Floodlights,** from dusk (sun 4° above the pad horizon) to dawn: four warm point lights in the mesh shader (`uFl`/`uFlI`) light the rocket, tower and buildings; the lamp faces and ground pools are additive discs in the glow pass (`PAD_GLOW`), because the ground belongs to the sky shader.
  - **Hooks in `render()`:** three one-line calls (`padLights`, `drawPadRig`, `drawPadGlow`). The pad's own draw call (terrain's) is unchanged, and the rig uses the same frame (`padPF` reads `WORLD.siteH`).
  - **Pipes:** those crossing the rails became flush covered trenches, so the gantry's trucks can roll over them.
  - `refView(18)` is the gantry in service at t = 0, `19` the same at night.
- **Bare metal reads blue under this sky.** Steel props (bottle racks, decks) reflected the sky gradient and looked
  painted blue. Use painted (non-metal) colours for big plain steel surfaces, and keep metal for thin members.

### Still open
- A real trench and flame bucket would need a cut in the ground (terrain's shader).
- Wide side-booster rockets: the hold-downs at r 3.4 m can poke through boosters of a 2.5 m core. **Fixed 2026-10-08:** § "The hold-downs follow the rocket".

## Engine plumes — a raymarched volume with propellant profiles (2026-10-07, plumes session, branch `plumes`)

Before this, every engine had the same additive cone: a hard-edged pale shape that only changed size. In vacuum it went
almost black and hid the stars. The KSP mod Waterfall (1.3 M installs) is the reference. **What we borrowed from it:**
templates per propellant, not per engine; layered parts of a plume (core, diamonds, mantle, glow); parameters driven by
throttle and air pressure; and deforming the proxy mesh in the vertex shader. **What we did differently:** Waterfall
stacks mesh shells with scrolling noise textures because a Unity mod can't do more. We own the shader, so the plume is
a **volume raymarched inside one proxy mesh per engine** (32 steps). It reads as a body of gas from any angle, with no
shell edges at grazing views.

### The model (`PLUME_VS`/`PLUME_FS`, `plumeShape`, `PROPS`, `PFX`)
- **Shape from the pressure ratio** n = pe/pa (nozzle exit pressure over ambient, both in atm). Over-expanded (n < 1):
  the jet pinches to √n of the exit radius within 1.5 radii. Spread angle: tan θ = 0.03 + 0.52·smoothstep(0, 2.5,
  log₁₀ n). Near-straight at sea level, about 29° from n ≈ 300 up, plus a little turbulent widening in air. Length
  re·(10 + 12·throttle)·(1 + 1.4·(1 − pa)).
- **Thinning:** gas density goes as (re/rb)², and the line of sight through it grows as rb, so emission falls as
  (re/rb)^1.3. That one term is why a vacuum plume is wide and faint and a sea-level one is tight and bright.
  (re/rb)² dimmed the 45 km plume to nothing.
- **Shock diamonds** every Lc = 2.4·re·√n, soft Gaussian cells that fade along the train. Visible only for pa in
  0.02–0.25 and n < 8: they stretch out and vanish with altitude, as on real ascents.
- **Layers:** a white-hot core over the potential-core length (3.5–6 re); an afterburning mantle (fuel-rich exhaust
  burning in air, so it scales with air density); a gas glow; and soot that *absorbs*.
- **Opacity:** output is premultiplied (`ONE, ONE_MINUS_SRC_ALPHA`), so a plume can occlude. A thick region shows its
  colour as emission over opacity. Kerolox is opaque (op 1.2), alcohol translucent (0.8), hypergolic faint (0.25),
  hydrolox nearly clear (0.03).
- **Propellant profiles (`PROPS`)** with an engine table (`PFX`): Kestrel, Condor and Albatross are kerolox at pe
  0.7–0.8 atm; Petrel is kerolox at pe 0.025 (vacuum); Sparrow is alcohol/LOX (V-2-like); Wren is hypergolic at pe 0.12.
  Hydrolox is defined but no engine uses it yet. An engine not in the table defaults to kerolox, with a vacuum nozzle if
  its sea-level Isp is under half its vacuum Isp.
- **Spool:** a render-side `SPOOL` WeakMap lags each plume behind the throttle by ~0.12 s, so ignition grows instead
  of popping. Flicker is two sines on the intensity, phased per engine.
- Smoke puffs are now born at 0.7 of the plume length (`plumeShape`), so they leave from where the flame fades.

### What it took (and what failed)
- **First pass: everything saturated to white.** The gains were ~5× too high; `1 − exp(−C)` clips every channel.
- **Purely additive turned green over grass.** The ground showed through a faint flame. A sooty kerolox flame is
  close to opaque in reality, so opacity was added.
- **Then the kerolox plume read as brown smoke.** The outer gas absorbed more than it emitted, and a thick region's
  colour is its emission/opacity ratio. Fix: only the core and mantle carry opacity.
- **Gamma 2.2 greyed the faint outer gas** (a peach tint on a blue sky reads grey). Gamma 1.5 plus a more saturated
  glow colour kept it orange.
- **Culling:** the lathe's outward faces wind so that `cullFace(FRONT)` keeps the faces nearest the eye. With the
  camera inside the bounds it switches to the far faces and marches from the eye.
- **Measuring against the wrong tree.** The first A/B said +3 to +12 ms. The "main" server on 8778 was another
  process's tree, and 127.0.0.1:8777 had a second listener too. Use explicit `127.0.0.1` URLs on ports you have
  checked with `netstat` (LESSONS candidate).

### Cost
Same-run A/B against a `main` snapshot (`d803a54`): GPU timer queries, `RS` pinned to 1, 1280×800 headless Chrome, two
rounds of three 1.2 s samples.

| view | main | plumes |
|---|---|---|
| 2 ascent (Lunar, 3 km) | 14.1–14.5 ms | 14.4–14.8 |
| 10 Sparrow from below | 5.4–5.9 | 5.9–6.3 |
| 30 (was 17) Orbiter at the pad | 17.8–19.0 | 18.1–19.4 |
| 32 (was 19) Albatross at 45 km | 2.6–3.8 | 3.3–4.0 |
| 33 (was 20) Petrel in vacuum (fills the screen) | 0.8–1.0 | 1.7–2.0 |
| 36 (was 23) Kestrel at 1 km | 10.4–10.8 | 9.9–10.2 |

The first version cost far more. Three changes fixed it:
- the vertex shader bends the proxy lathe to 1.9·rb(s), so pixels outside the plume never march (Waterfall's trick);
- samples outside that radius are skipped before any noise;
- turbulence is read from a 32³ R8 noise texture (two fetches instead of 16 hashes). Marching stops once the ray is opaque.

### Reference views
`refView(30)` Orbiter at the pad, `31` Albatross at 20 km, `32` at 45 km, `33` Petrel in vacuum, `34` Sparrow at 1 km,
`35` Wren in vacuum, `36` Kestrel at 1 km. They teleport the ship (pointing up, climbing), stage and burn 1.5 s.
(Numbered from 30 because `main` took 17 for the launch site meanwhile.) `refView` now funds the program up to 1e6 M
first: since the budget gate, a fresh page refused the Lunar launch and views 2 and 31–35 silently stayed in the editor.

### Still open
- The plume goes into the pad instead of spreading over the deflector. Ground impingement would need the pad or ground
  height in the shader.
- No shutdown tail-off: a plume disappears with `activeEngines`. Ignition is a fast grow, with no start-up flash.
- Plumes don't light anything: no glow on the pad, the smoke or the hull at night.
- At altitude, the plume should wash back over the base (recirculation). Soot marks model that; the plume doesn't show it.
- The Sparrow's alcohol plume still reads whitish-blue against the sea. Real V-2 footage is more yellow.
- RCS puffs could reuse this volume with a small re.

## Re-entry plasma — a raymarched shock layer and wake (2026-10-07, aerofx session, branch `aerofx`)

Before this, re-entry showed one additive half-sphere at the ship's leading end. The heating physics (Sutton–Graves
stagnation flux `S.qHeat`, skin temperatures) was detailed, but its visual was not. Now the plasma is a volume raymarched
in a **flow-aligned frame** (y = upstream), reusing the plume's proxy lathe, culling logic and 32³ noise texture.

### The model (`PLASMA_VS`/`PLASMA_FS`, `hullProfile`, the plasma block in `render()`)
- **Heat level** k = log(q/15 kW/m²) / log(160/15), clamped to 0–1.5. 160 kW/m² is the peak of an orbital capsule entry
  (measured: it peaks at 50 km; glow from ~85 km down to ~30 km). A fast "lunar return" (1.3× circular) reaches
  ~440 kW/m², so k ≈ 1.4. Colour runs deep red → orange → pink-white with k. The wake uses k·0.4, so it is redder.
- **Hull:** the ship's real envelope, `hullProfile(S)`: 32 radius stations along its axis from the parts' lathe profiles
  (radial parts count by their offset). The shader's signed distance is the radial gap, corrected for the profile's
  slope near the surface, with flat end caps. The ray stops at the hull.
- **Shock layer:** a thin sheath, standoff D = 0.12·min(ep, 1.2 rb) + 0.06 m. It glows as exp(−(sd/D)^1.4) on faces
  that meet the flow (the normal's upstream component), so a stage flown at an angle lights its windward side.
- **Wake:** from the hull's downstream edge, a ring of streaks (noise in the azimuth and along the flow, scrolling
  downstream) plus a dim core. Width ~0.8 of the cross-flow extent, growing slowly. Length 5–19 extents with k.
- Additive, no opacity. `PLASMA_FX = false` hides it (GPU A/B).

### What it took
- **Even steps band the thin shell.** 40 steps over a ~15 m ray against a 0.15 m layer gave a screen-door pattern over
  the hull. Steps are now sized by the distance to the hull: 0.35·sd + 0.2 D, at least D/4. Ahead of the hull, clear of
  the layer, the march jumps straight to it (≤ 56 steps).
- **A hull cylinder outlines a can that isn't there:** around a conical capsule the glow traced the core radius. Hence
  the real profile.
- **Arcs and a spike:** the capsule's neck steps from 0.42 to 0.30 m within one station, and dividing the radial gap
  by √(1+slope²) (up to 2.7×) made points 2 m out read as 0.6 m away, inside a 4 cm slab across the hull. Edge-on
  that slab is a spike, obliquely it is arcs. Found by a diagnostic render (emission coloured by the shader's own
  distance), after two wrong guesses (step size; the proxy, ruled out by doubling its radius). Fix: the slope
  correction fades out from D to 4D.

### Cost
`PLASMA_FX` on/off in the same page, GPU timer queries, `RS` pinned to 1, 1280×800, RTX 5050 laptop:

| view | on | off |
|---|---|---|
| 40 capsule at 50 km, side | 7.9–8.1 ms | 7.1–7.2 |
| 41 capsule at 50 km, behind (long wake on screen) | 11.0–11.2 | 9.8 |
| 44 stage at 35° AoA | 7.7–7.9 | 6.9–7.0 |
| 45 fast entry at 55 km | 7.6–8.0 | 6.8–6.9 |

### Reference views
`refView(40)` capsule (chute, bio, shield) at 50 km (peak heating), side; `41` same, from behind; `42` at 75 km
(onset); `43` at 35 km (fading); `44` pod, tank and Petrel turned 35° off the flow at 55 km; `45` a fast entry
(1.3× circular, steeper) at 55 km. They fly the entry from 95 km retro, then turn the ship if asked.

### Still open
- Only the active vessel glows. Debris and spent stages entering (and burning up) would need the same per debris body.
- No light cast on the hull from its own plasma, and no change to the hull shader (`MESH_FS` is the visuals session's).
- The views' "retro" capsule leads with its narrow end (SAS hold during the teleport). The glow follows whatever
  leads, but a shield-first view would be the classic shot.
- Transonic vapor cones (next idea).

### Gated by speed, not just heat (2026-10-08, effects beat, QUEUE Q20 / PLAYTEST #17)
The shell used to draw whenever the stagnation flux passed 15 kW/m². Dense air reaches that at about 1 km/s, so the
Heavy's ordinary climb (Mach 3.5, 20 km, 77 kW/m²) wore a glowing shell. Air at that speed is a few hundred kelvin
behind the shock and doesn't glow; the shock layer lights up at orbital-class speeds. `plasmaHeat(b,r,v,q)` (next
to `drawPlasma` in `app/gl.js`) multiplies the flux by a smoothstep in airspeed over 0.85–1.05 × `PLASMA_V`, the
terrain session's blackout threshold (Q17, 2213 m/s), so the Link blackout and the glow agree. The ship and falling
stages both go through it.
- Measured (`refView`): 40 (50 km, 2.6 km/s) 160 kW/m², glow unchanged; 42 (75 km), 44 and 45 unchanged; **43 (35 km,
  1.55 km/s, 90 kW/m²) now has no shell**, just the charred shield (it used to show a faint one). Stage re-entries
  103/104 run at 3.2 km/s: unchanged. Hot ascents peak at 1.7 km/s (Q17's flown check), under the 1.88 km/s fade start.
- test.mjs `aerofx-1`: the fade numbers, and that both draws in `render.js` go through `plasmaHeat`.
- Not changed: char marks, sparks and the smoke trail on falling stages still key on heat alone (ablation is heating).

### The plasma lights the hull; a shield-first view (2026-10-08, effects beat, QUEUE Q63)
`plasmaLight(camW)` (after `boomLight` in `app/gl.js`) makes the shock layer the scene's one point light (`PLT`, the one
the plumes and explosions use, read by `MESH_FS` and the smoke) while it outshines the plumes; an explosion's flash still
wins. No hull-shader change. The light sits in the sheath, 2 D ahead of the leading face, with a core of 1.2× the
cross-flow extent so the sides get a soft wash, and its colour follows the shell's (deep red → orange → pink-white with
k). Brightness `PLASMA_LK`·k²·extent² (capped at 1.5 m), `PLASMA_LK` = 5; `PLASMA_LIGHT = false` for A/B. No ground pool.
- **First try was 8× too bright**: `PLASMA_LK` 40 per metre blew the capsule's white hull out in view 40. The light is
  under a metre from the hull, so the inverse-square term is large; the plume light's scale (K = 110) assumes metres of
  flame between light and hull. Now ~2 per channel at k = 1 for the capsule: a pink wash on a nose-first capsule (40),
  the stage's windward side at 35° (44), the shield face and its rim when shield-first.
- **Shield-first, the back shell stays dark**, as it should: the light is ahead of the shield and faces behind it get
  only the wrap term. There is no shadowing, so a long stage would be lit along its side even where the nose would hide it.
- **New views 46–47**: the capsule turned shield-first at 50 km (`aoa: 'shield'`: whichever end carries the shield goes
  upstream), from the side and from a rear quarter. The old views fly the capsule "retro" but it ends up nose-first
  (Y·v = +0.97): SAS can't hold it against the aero torque.
- **Seen while testing, not fixed:** the entry views spawn a burning parachute as debris (a `chute` piece, boom at
  55 km), so for ~2 s after `refView(40–47)` an explosion's flash owns `PLT` and a smoke cloud hangs above the capsule.
  The ship keeps its own chute. For judging the light, clear `booms` after the view. Not looked into further.
- test.mjs `aerofx-2`.

## Transonic vapor cones (2026-10-07, aerofx session)

Around Mach 1 in humid air, the flow speeds up round each convex corner of the hull, expands and cools, and water
condenses until a shock recompresses it. That's the white collar in max-Q photos. Here it is a lit cloud (alpha
blended, shaded like the smoke) raymarched in the ship's own frame, reusing the plume proxy, the noise texture and the
plasma's `hullProfile`.

- **Where:** `hullShoulders(profile, dir)` walks the 32-station radius profile downstream from the leading end. A
  shoulder is where the radius stops growing after growing ≥ 15 % (the end of a nose cone or a flare), or drops ≥ 10 %
  in one station (a step down). It keeps the three strongest. The Orbiter gets one at the pod's base and two at the
  decoupler/Petrel steps. The Lunar's include the top of the 2.5 m adapter.
- **When:** visibility = smoothstep in Mach 0.84→0.94, fading 1.12→1.28, times humid air below 5 km fading to none at
  15 km. A stand-in for humidity: the world has no humidity field.
- **Shape:** a collar per shoulder, soft at the front (at the shoulder) and sharp at the rear (the shock), whose distance
  aft grows with Mach: zs = r·(1 + 6·(M − 0.86)). The outer radius flares as r·(1.15 + 0.95·√(z/zs)) with noise on the
  edge and the rear line.
- **Light:** brighter on the sun side and toward the sun (forward scattering), the smoke's sun/ambient scaling and the
  same tone curve.
- `VAPOR_FX = false` hides it. Cost: 0.2–0.7 ms while visible (same-page on/off A/B, views 50, 52, 53).
- **First pass too timid:** collars 12 % wider than the hull read as small flaps. Then straight flares read as
  triangles: curved (√) flares and a wider feathered edge fixed it.
- Reference views: `refView(50)` Orbiter at M 0.97, `51` at M 1.08, `52` Lunar at M 1.0, `53` Orbiter close-up from below.

**Still open:** a real humidity field (clouds, coast vs inland); collars on side boosters (the profile only knows the
envelope, so radial stacks' noses don't make their own shoulders); condensation off fin tips at high angle of attack.

### Side boosters make their own collars (2026-10-08, effects beat, QUEUE Q64)
The collars came from one envelope profile of the whole ship, so a booster's nose cone only counted where it stuck out
past everything else. Now `vaporLines(s)` groups the parts that are on by stack line (`p.inst.line`: 0 the core, > 0 a
side stack; surface parts stay with the core, radial decouplers are left out), and `drawVapor` draws one volume per line
on its own axis, with `lineProfile` (radius about that axis) and `hullShoulders` as before. The shader is unchanged.
- Heavy at M 1.0: core shoulders unchanged; each booster gets its nose (station 24 of 31) plus the fins/engine step near
  its base. Big Lunar: the core's 2.5 m adapter shoulder stays; each booster its nose. The Orbiter (one line) gives
  exactly the old shoulders (test.mjs `aerofx-2`, the vapor check).
- A booster's collar is not stopped by the core's hull (each volume only knows its own), so on the inner side it can
  run into the core; the core's mesh still hides what is behind it. It reads fine in views 54–56.
- `VAPOR_SIDE = false`: core only (A/B). Cost (RTX 5050, 1280×800, RS 1, same page on/off, median of 7×15 frames):
  Heavy at M 1.0 (view 54) 6.05 vs 6.06 ms, Big Lunar (55) 6.77 vs 6.51 ms: one more volume per booster, ≤ 0.3 ms.
- New views: `refView(54)` Heavy at M 1.0, `55` Big Lunar, `56` Heavy close-up from below.

## The plume meeting the ground (2026-10-07, aerofx session)

Before this, a plume on the pad went straight into the concrete: the raymarch ignored the ground, so the flame showed
through the deck, and smoke puffs were born underground. Three changes, all render-side:

- **The ground is opaque to the plume.** `groundFrame(camW)` returns the frame of the ground under the ship: the pad's
  own frame (x east, y up, z south down the flame channel) within 300 m of it, else the terrain below. The plume shader
  gets that plane in its local frame (`uGp`) and stops marching at it.
- **An impingement volume** (`IMP_FS`, drawn by `drawImpact` right after the plumes, a box proxy `CUBE`). The draw block
  intersects each burning engine's axis with the ground; jet strength there w = spool · smoothstep(1.15 L, 0.35 L,
  distance), so it fades as the ship climbs out of its own plume. On the pad, most of the flow goes down the flame
  channel (|x| < 3.4 m, from z ≈ 0 to ~38 m), thickening and cooling as it goes: white-hot at the impact, the
  propellant's mantle orange, then soot. Off the pad, a radial splash a few exit radii across. Colours, soot and
  opacity come from the engine's propellant profile (`PROPS`), so kerolox is smoky and hypergolic is faint.
- **A ground cloud of smoke** (`emitGroundSmoke`): while the jet reaches the ground, puffs at 30/s per engine (×
  strength). On the pad, 80 % pour out of the channel's mouth 26–40 m south and the rest spill over the deck round the
  table. Off the pad, they form a ring round the impact. Big, slow, rising puffs with a 40–70 s life. Underground birth
  points of the normal trail are dropped (the ground cloud stands in for them).

`IMPACT_FX = false` hides the volume. Cost, 1280×800, RS 1: the volume ~1 ms GPU on the pad; the ground cloud's puffs
~2 ms more while thick (they overdraw the screen near the camera; the old trail cost about the same once the rocket
climbed). CPU per frame unchanged (0.8–0.9 ms).

Reference views: `refView(60)` 0.6 s after ignition, `61` 12 m up, `62` 35 m up, `63` the Lunar at 3 m, `64` from above.

**Still open:** the channel is fixed to this pad layout (its walls at x = ±3.4, running south): another site's pad
would need its channel as data. No deluge water or steam. The ground cloud doesn't light up from the flame.

## Plume light (2026-10-07, aerofx session)

The burning engines light their surroundings: one soft point light per frame for all plumes (`plumeLight`, `PLT`).
- **Where and how bright:** each engine contributes at a quarter of its plume's length, or at 0.85 of the way to the
  ground when the jet reaches it (so the light sits low in the flame on the pad). Weight = spool × (exit radius / 0.55)²,
  and the light's position is the weighted mean. Colour = 0.4 core + 0.6 mantle from the propellant profile, with the
  plume's flicker. Strength scale 110, dimmed in thin air (×min(1, 4 pa + 0.15)). The core radius (2.5 exit radii)
  softens the 1/d² so nothing blows out next to the nozzle.
- **Meshes** (hull, pad, tower): a block in `MESH_FS` beside the floodlights: albedo × colour × (0.85 n·l + 0.15 wrap)
  / (d² + r₀²). This is the one cross-scope edit (the visuals session's shader), additive and self-contained.
- **Smoke:** per-vertex in `SMOKE_VS`, gain 0.18 with a wider core. At 0.55 the puffs by the flame saturated to white in
  daylight.
- **Ground:** the ground is the sky shader's, so a light pool is an additive disc just above it (`POOL_FS`, `drawPlumePool`),
  like the floodlight pools: irradiance from the light's height, faded at the edge, and scaled by darkness at the ship
  (0.12 in full sun → 1 at night), since it is added on already-lit ground.
- `PLUME_LIGHT = false` turns it off. Cost: ~0.5–1 ms GPU on the pad (same-page A/B, views 60 and 65).
- Reference views: `refView(65)` night, just after ignition; `66` night, 12 m up; `67` night, close on the rocket's base.

**Still open:** one light for all engines (a wide Heavy is lit from its centroid); no shadows (the tower's far side
gets 15 % wrap light); the ground pool is a flat disc, so off-pad slopes take it roughly.

## Engine ignition (2026-10-07, aerofx session)

An engine used to fade in over 0.12 s. Now it lights the way 1950s–60s engines did. The model is render-side, keyed on
a per-engine ignition clock: `spoolOf` stamps `sp.ig` whenever the spool starts from (near) zero with the throttle up, so
staging, relights and throttling up from zero all count.
- **Igniter flash** (`PROPS[...].ig`, `igT`): kerolox engines lit with TEA-TEB, a pyrophoric mix that flashes vivid
  green (the F-1's start). Here it is [0.25, 1, 0.35], decaying over 0.3 s. Alcohol has a short orange pyrotechnic
  flash, hypergolics a faint pink pop, hydrolox a dim blue spark. While it flashes, its colour replaces (not adds to)
  the young flame's, in the plume, the flame-channel volume and the plume light (× (1 − 0.8 gf)). Added on top, the
  flash only tinted a saturated yellow-white and never read as green.
- **Fuel-rich start** (`rich` s): for ~0.7 s on kerolox, the plume balloons near the nozzle (rb × up to 2.7), goes
  orange and lumpy, its shock diamonds off, and makes soot. The plume's length follows max(spool, 0.6 richness), so the
  start is a burst instead of a slow grow, and the spool's lag is 0.3 s while starting.
- `ignOf(e, P)` returns [flash colour × strength, richness] for the plume, impingement and light code.
- Reference views `refView(68–71)`: the Orbiter's Kestrel 0.04, 0.12, 0.3 and 0.7 s after ignition. `72`: 0.06 s at
  night. They wait 15 s on the pad first, since the service gantry rolls back over 14 s from the start of a flight
  (`padSync`, visuals), and they render every step so the render-side clock starts on time. Then they freeze the sim
  for the capture (`window.simulate` is stubbed; the next `refView` restores it), because the page's live frame loop
  otherwise ran the sim ~0.2 s on before the screenshot.
- Bug on the way: an inline `//` comment inserted mid-line swallowed the end of a `for` body (`R0=…}`), and the page
  went black with "Identifier 'W' has already been declared". Check one-line code edits with
  `node --check` on the extracted script.

**Still open:** shutdown tail-off (the plume still vanishes at cutoff) and staging puffs, both proposed with this.

## Engine shutdown and staging (2026-10-07, aerofx session)

**Shutdown tail-off.** A plume used to vanish the frame its engine left `activeEngines`. Now `plumeEngines()` also
returns stopped engines (still on the ship) whose spool has not decayed, and `spoolOf(e, on)` drives them to zero
with a 0.22 s lag. The moment an engine's target drops to zero (cutoff, flameout, throttle to zero) stamps `sp.off`:
- `ignOf` adds a **tail-off richness** (`PROPS[...].tail`, decaying over 0.5 s), so the dying flame goes orange, lumpy and
  sooty, the same look as the fuel-rich start. Its length follows the spool only (not the start's burst), so it shrinks.
- **cutoffPuff**: a handful of puffs of unburnt propellant leave the nozzle, sootier and more numerous for kerolox.
- The start/stop soot is confined to ~6–14 exit radii from the nozzle. At first it filled the plume's whole length
  and read as a long brown smoke trail.

**Staging.** `HOOK.debris` now calls `sepFx(d)`: when the dropped piece holds a decoupler, a ring of 18 gas puffs vents
radially from the seam (a stack decoupler's top face, a radial decoupler's mount) and 26 sparks spray out (tiny, glowing,
0.25–0.7 s). Breakups without a decoupler get nothing here (`booms` covers those). In thin air the gas spreads wider and
thinner (grow +3·(1 − pa), opacity × (0.25 + 0.75 pa)). Opaque, it ballooned into a white cloud at 30 km.

**Moving puffs:** cutoff and separation puffs travel with a velocity (`fxPuff`: inertial, Tellus-centred, ballistic)
instead of hanging in the air like the smoke trail, so they keep up with the ship for their short lives. `drawSmoke`
takes both kinds, and `hot` sets a puff's glow (sparks ~1.6).

Reference views: `refView(73)` the Orbiter's Kestrel 0.15 s after cutoff at 3 km, `74` 0.6 s after; `75` staging at 3 km;
`76` staging at 30 km; `77` the Heavy dropping its side boosters. They climb unrendered, reset the engines' ignition
clocks (else the first render would replay their ignition), then render every step through the action and freeze.

## Performance pass: all the engine and air FX together (2026-10-07, aerofx session)

Each effect had been measured alone. The heaviest scene: the Heavy at night, ~10 m up (three plumes on the pad, the
ground cloud, plume light, floodlights). 1280×800, RS 1. **Correction (2026-10-08):** headless Chrome was on the Intel
iGPU for these, not the RTX 5050 (`GPU_NAME` was never checked; `--force_high_performance_gpu` picks the RTX). The
before/after comparisons are valid (same GPU throughout), but the absolute times are iGPU times; the same scenes take
4–6 ms on the RTX. The same likely holds for the per-effect costs quoted in the sections above from this session. Frame frozen; each configuration removes one
effect; the configurations are interleaved over 4 rounds (alternating order) after a 6 s warm-up; median of the middle two.

| configuration | before | after |
|---|---|---|
| all on | 30.0 ms | 25.9 ms |
| without plume light | 29.7 | 25.7 |
| without the impingement volume | 24.0 | 24.2 |
| without smoke | 27.6 | 23.7 |
| without plumes (and so impingement) | 23.0 | 23.2 |
| all off | 20.9 | 21.1 |

- **The fix:** the impingement volume was drawn once per engine, and on the pad every copy's box spans the whole 38 m
  flame channel, so the Heavy marched the channel three times (~6 ms). Now one volume holds up to 4 impact points
  (`uIP[4]`: x, z, jet strength); the splashes sum, the channel takes the strongest jet (× 0.7 + 0.3 per extra engine,
  capped), the propellant is the strongest engine's. Then 40 → 28 steps, with no visible change (side-by-side at view 60):
  ~6 → 1.7 ms.
- Total for the FX in this scene: 9.1 → 4.8 ms. What's left: smoke ~2.2 ms (big puffs overdrawing near the camera; the
  trail predates this session), plumes ~1 ms for three, impingement 1.7, plume light ~0.2.
- **Measuring on this laptop:** the GPU idles at 0 MHz and ramps its clock under load, so back-to-back samples drifted by
  ±10 ms and removing an effect could read slower. A warm-up plus interleaved rounds gave spreads under 0.5 ms.

## Moving parts: the gimbal, steerable fins, a reaction wheel (2026-10-08, effects beat, QUEUE Q23)

The control session's engine gimbal (`p.gv`) and steerable fin plates (`p.fd`) steered the rocket but never showed: the
ship mesh is built once per design. Now they move in the vertex shader, with no mesh rebuild.
- **`MESH_VS` has a small table** `uMv[48]`: up to 16 moving parts, three vec4s each: (pivot, part index), (mode, axis,
  ring radius), (rotation). `setMoves(u, parts)` fills it from `setMarks`, so every mesh draw that sets marks (the ship,
  fleet, debris, satellites) also sets its moving parts; parts at rest are left out, so most draws send zeros.
  Mode 1: an engine's bell vertices (kind 2) turn about the throat by the quaternion from `tdir` to `tdir + gv`; the throat
  height is read once per engine from its own mesh (`bellThroat`). Canted engines: the pivot is tilted with the mount.
  Mode 2: a fin ring's plates (kind 6 beyond 1.02× the ring radius) turn about their radial axes `FIN4[j]` through
  mid-chord by `fd[j]`. Mode 3: a radial fin, the whole part about its radial axis. Same sign as the sim's plate normal.
- **The plume follows**: `plumeFrame(e)` gives the exhaust's tilt and exit for both the plume draw and `plumeLight`.
  It also fixes canted engines' exit point, which was the untilted one (off by sin(cant)·h, ~0.2 m on a 10° Kestrel).
  Escape-tower nozzles have no `h`: their exit stays at their mount.
- **The reaction wheel** (`rwheel`) had the default drum; now a machined steel housing between bolted flanges, a
  gold-foil band and four motor pods.
- `MOVES_FX = false` freezes bells and plates (A/B). Views: `refView(105)` the Orbiter's Kestrel at its full 5°,
  `106` a steerable fin ring at ±20°, `107` the reaction wheel (all builder close-ups; pass the career gate first).
- **A/B pitfall:** an expression that sets a toggle off, renders, and sets it back on in one go photographs the "on"
  state: the page's own loop redraws before the screenshot. Leave the toggle off until the picture is taken.
- test.mjs `aerofx-2` (moving parts): the exit swings 0.065 m for 5° on a 0.75 m throat height, opposite the thrust's
  tilt; the plume axis follows; the wiring (`uMv`, `setMoves`, `plumeFrame` in both places, the `rwheel` case).

## Clouds with depth near the camera (2026-10-08, aerofx session)

Caio: the clouds look good from space, but at launch they are a flat layer. The deck was one infinitely thin shell at
3 km. Now, below ~20 km, the deck within 40 km is a raymarched slab from 2 to 5.5 km. The shell still draws beyond that
and from orbit, so space views are unchanged.

- **Coverage is unchanged, only given height.** The volume reads `cloudCovF`, the same function the shell uses and that
  `cloudAt` ports to the CPU for satellite imaging, so pictures and the drawn sky still agree. It is baked into a 512²
  texture over ±50 km round the point under the camera (gnomonic; `COV_FS` is sliced out of `SKY_FS`'s own source, so
  there is one copy of the noise), re-baked after 5 km of travel or noticeable weather drift. Calling `cloudCovF` per
  step would cost 15 value-noise calls × 40+ steps per pixel.
- **Shape (`cloudDens`):** a column's top height rises with its cover (thin cover makes low puffs, thick cover towers),
  times a km-scale noise so neighbouring columns differ; flat bases; two octaves of 3D noise (650 m, 230 m,
  planet-fixed, drifting with the weather) erode it into billows.
- **March:** 72 steps, spaced as x² so they are dense near the camera; the volume hands over to the shell between 50 %
  and 100 % of 40 km. Extinction 1/180 m⁻¹ at full density; the sky depth is written where the cloud passes 50 %
  opacity (meshes behind it hide).
- **Light:** two steps toward the sun (250 m, 800 m) for self-shadowing, plus a multiple-scattering stand-in
  (max(e^(−2.2 d), 0.4 e^(−0.35 d))); without it the inside of a cloud was mid-grey instead of bright grey-white. Tops
  brighter than bellies; sky ambient; aerial perspective as the shell's.
- `CLOUD_VOL = false` restores the flat shell everywhere. `CLOUD_DT` shifts the *drawn* weather in time for reference
  views only (`cloudAt` ignores it). Views 80–83 search it for ~60 % cover under the rocket.
- **Cost:** no measurable change on the RTX 5050 (pad 4.1 vs 4.4 ms, 3 km 5.6 vs 5.6, 8 km 5.4 vs 5.7, on vs off):
  within 40 km it replaces the shell's near-detail term. Also no worse on the Intel iGPU.

**Bugs on the way:** (1) the bake's centre used the transpose of the shader's `uProt` (planet rotation), so the texture
sat over the wrong place and the volume saw zero cover: the clouds just vanished. (2) the first reference views found
clear sky: the weather at the pad was simply clear, hence `CLOUD_DT`; then the 8 km view was clear because the rocket is
downrange of the pad by then, so the search is now under the rocket. (3) bank tops against the sky were sawtoothed at
48 uniform steps (grazing rays 40 km long); x² spacing and 72 steps fixed it.

Reference views: `refView(80)` on the pad, `81` 3 km, `82` 8 km looking down, `83` 25 km (shell only).

**Still open:** no cloud shadows from the volume onto the ground (the shell's `cloudShadow` still applies); no rain or
anvils; the deck from 8 km is still fairly uniform in brightness.

### The volume's own shadows; a less uniform deck (2026-10-09, effects beat, QUEUE Q65)
- **Shadows:** `cloudShadowV(p)` marches 5 steps from the ground point toward the sun through the 2–5.5 km slab with
  `cloudDens` (the volume's extinction, 1/180 m⁻¹; floor 0.25 for skylight) and blends that into the shell's
  `cloudShadow` by `uVk` and a fade at the bake's edge (36–47 % of its half-width). The cumulus over the sea in view 82
  now cast their own dark patches, offset away from the sun; the shell's smeared shadow stays beyond 40 km and from
  orbit. `CLOUD_SHADOW_V = false` for A/B. Cost: +0.3 ms at 3 km (view 81: 11.05 vs 10.73 ms), +0.75 ms on the pad
  (view 80: 8.68 vs 7.93 ms), RTX 5050.
- **Variety from 8 km:** the deck saturated to one white. Now a 9 km swell in each column's top height, a lower
  multiple-scattering floor (0.4 → 0.28, so billows shade) and a ±15 % brightness swell over ~7 km. Better, still
  modest: with a high sun a deck from above is mostly white. `CLOUD_VARY = false` for A/B; no measurable cost.
- `cloudAt` (the CPU port for imaging) reads coverage, not `cloudDens`, so pictures and the sky still agree.
- **Measuring pitfall:** the first timing loop of a page reported ~1 ms (warm-up); time each setting twice and use
  the repeat.

## Effects for the new features: escape tower, landing dust, explosions (2026-10-08, aerofx session)

Other sessions had added things with no visuals of their own: the crew escape tower (bodies), crewed Selene landings
(bodies), and PLAYTEST #5 (the explosion was one additive half-sphere).

**Escape tower motor.** While `S.lesT` burns (the bodies session's abort: 150 kN for 3 s), the tower's motor shows as
four nozzles (`lesNozzles`: 1.33 m up the tower, r 0.26 m, canted 35° outward) drawn as plumes. A new `solid` propellant
profile: white-yellow, nearly opaque, few diamonds. The nozzles go through the normal plume path (spool, ignition flash,
tail-off, plume light), and `emitLesSmoke` lays a dense white column (spaced by distance like the main trail; spaced by
time it broke into beads at speed). Views 84–86.

**Landing dust (airless bodies).** On a body without air, the jet that reaches the ground draws `DUST_FS` instead of the
hot-gas splash: a sheet of dust 0.45 m + 9 % of the distance thick, thrown radially outward in noise streaks, sunlit
and forward-scattering, with a patch swept clear under the nozzle. It starts 30–40 m up and thickens as the nozzle
descends. The first sheet (0.12 m thick) was invisible: 40 steps over a 60 m ray never landed in it. Albedo 0.78, above
the ground's, so the streaks read against the regolith. Views 87–89 hover a Wren over Selene.

**Explosions (PLAYTEST #5).** `HOOK.boom` (callers unchanged) now also records the air density, sprays sparks and
fragments (`fxPuff`, hot), and the draw is `BOOM_FS`: a raymarched fireball (three noise octaves for billows; white-yellow
core → orange → red) that turns into a rising smoke cloud, black soot greying over ~6 s, lasting 14 s in air. In vacuum it
flashes and thins out in ~3 s. Radius sz·(2 + 12√t) for the first 1.2 s, then a slower spread; the cloud rises
sz·3.5·t^1.2. The flash takes over the scene's point light (`boomLight`: brighter than the plumes for ~0.3 s, then a
1 s glow), so it lights the pad, the hull and the ground pool. Views 90–93 (they backdate the boom clock, which is wall
time).
- First look: a pale ball with a blue rim. Light smoke under sunlight swamped a weak fire. Darker soot, fire emission
  ×2.7, and the soot building over 0.6 s instead of 0.3 s fixed it.

**A box-proxy bug in all three box volumes.** The explosion was invisible: the mesh helpers' `box()` is not wound
consistently, so `cullFace(BACK)` dropped some of the box's near faces. The impingement and dust volumes had used the same
proxy and only worked because the reference cameras sat inside their boxes. Now `VBOX` (built by hand, wound outward on
every face) is the proxy for all three, and the shaders compute the ray's entry and exit analytically, so they don't
depend on which face rasterised. An intermediate fix (draw every face, march only from the far one) broke when the far
face lay under the ground (the depth test cut it).

**Cost on the RTX 5050** (on/off, same frame): explosion 0.55 ms at 1.2 s (the cloud filling a third of the screen),
landing dust 0.3 ms, escape motor within noise.

**Still open:** explosions are round; a ground-level fireball has no ground-hugging spread. Fragments don't trail smoke.
The escape motor's jets don't strike the capsule. The dust doesn't settle on anything and has no effect on visibility.

## HUD gauges (2026-10-08, aerofx session; PLAYTEST #9's graphics)

PLAYTEST #9 asks for gauges, atmosphere indicators included. The flight HUD's layout belongs to the ui session (its
slice 4: a core plus cards), so the split agreed with Caio is: this session builds the instruments as self-contained
widgets, slice 4 decides where they sit.

- **`drawGauges(x, y, s)`** draws a 318×150 strip on the 2D overlay (`octx`), top-left at (x, y), scale s. Nothing in the
  HUD's DOM changed. **`gaugeRect()`** is a placeholder position: right of `#navwrap`, or left of it when the window is
  narrow. Slice 4 replaces that one call. `GAUGES = false` hides the strip.
- **Altitude tape:** a scale scrolling round the current altitude (span 1.4 × altitude, 1.5–600 km), a lit window with
  the value, and radar altitude under it when low. Marks: AIR at the top of the atmosphere, the cloud deck (2–5.5 km) as a
  white band, Ap and Pe as red pointers.
- **Air:** a column filled to the ambient pressure on a log scale (1 → 10⁻⁴ atm), with the value or VAC.
- **q dial:** dynamic pressure 0 → max(40 kPa, 1.15 × peak), the needle, a red pointer held at the flight's max-q
  (`GQ`, render-side, per vessel), and MAX below. The **Mach drum** turns amber through the transonic band (0.85–1.25).
- **Heat:** the hottest part relative to its limit (skin K over `Tmax`), green → amber → red, with a redline at 85 % and
  the part's name.
- Look: cream dial faces, black ink, red limits, amber cautions on a dark panel; Bahnschrift / DIN / Arial Narrow type.
  A first step toward PLAYTEST #13 (the generic look).
- Reference views `refView(94)` the Lunar at max-q (10 km), `95` at 40 km, `96` capsule entry at peak heating. They
  leave the HUD on (other views hide it).

**For slice 4:** the widgets can split into separate cards (the tape in the core, q/Mach/heat in the Ascent card): each
block in `drawGauges` is independent, with its own offsets inside the strip.

## PLAYTEST #7: the planet flashing in space (2026-10-08, aerofx session)

**Symptom (Caio):** the planet sometimes flashes when the camera moves while looking down at it from space.

**Cause:** `depthTarget(w, h)` (the terrain's half-resolution depth pre-pass) reallocates its texture when the canvas size
changes, and bound it on whichever texture unit was active. At that point in `render()` that is unit 0, where the sky pass
had just been given the city-lights texture (`uCity`). For that one frame the sky shader read the depth buffer as city
lights, so the night side's land turned solid white (in daylight the change was smaller but present). The canvas size
changes whenever adaptive resolution (`RS`, v1.1) steps, and it steps when the GPU load changes, typically while the
camera moves: hence "sometimes, while moving".

**How it was found:** a sweep of 3,240 frames of camera motion (yaw steps of 0.025 rad; pitches 0.3–1.56; distances
15 m to 20 km; 40 km to 20,000 km; day and night), with adaptive resolution off, found no flash. Then each resolution step
was rendered twice: the first render after a step differed from an identical second one every time (night side at
150 km: mean brightness 19.3 vs 3.9), and never without a step. Reproducing the bad frame by hand (depth texture on unit
0, sky redrawn) showed the night-side land lit white.

**Fix:** `depthTarget` binds on unit 5, the depth texture's own unit (where the sky reads it), and restores unit 0. After the
fix, first and second renders match at every step. Lesson: anything that (re)allocates a texture mid-frame must not bind
on the active unit (LESSONS #33).

Also: the HUD gauges now hide with the HUD (`.ui` visibility), so the bare reference views stay clean.

## The sky from space: home galaxy, stars, sun (2026-10-08, aerofx session; PLAYTEST #10)

The space background was single-size white stars and a soft sun glow. Now, in `SKY_FS` (the background branch only:
`galaxy`, `starsAt`, `sunAt`):
- **A home galaxy generated from the world seed** (Caio's idea: each world's sky different). `GAL` (JS, `rng(WSEED·7919 +
  101)`) picks a great-circle band (normal `gx`), its centre `gc`, the band's width, bulge size, dust and arm contrast, a
  tint, a **satellite galaxy** (a small pale smudge) and a **nebula** (a pink patch). The band widens toward the centre and
  has a warm bulge, dark dust lanes along its midplane, and clumps stretched along it. Everything is sampled on the sphere
  (no angle coordinates): an `atan`-based first pass had a seam and stripes. Inertial directions, so the sky doesn't turn
  with the planet.
- **Stars:** two layers (220 and 560 cells per radian), colours by temperature (blue-white → orange-red), a few bright and
  many faint, and denser along the band.
- **The sun:** a limb-darkened disc of the right size (0.27°), a corona and a wide glow, and four camera-fixed diffraction
  spikes. The old glow was cut off at cos θ = 0.9, which showed as a hard circle once the glow was wider.
- **Dither:** the sky's output gets ±½ of an 8-bit step of per-pixel noise. Dark gradients (the galaxy, night skies) banded.
- Reference views `refView(97)` the galactic centre, `98` along the band, `99` the sun, `100` the band over a sunlit limb.
- Not done: a different galaxy per world needs `WSEED` to vary (it is a constant today); bloom on the sun (a post pass);
  the planets as points of light (PLAYTEST #11, a star-centred system).

**Also: a regression and its hotfix.** The PLAYTEST #7 commit (`807c1dd`) put a `// comment` mid-line in `gaugeRect`,
which swallowed a declaration: `render()` threw every frame while the HUD was up. `node --check` and `test.mjs` passed
(a runtime error), and the reference screenshots hide the HUD. Hotfix `8e070fc` pushed within the hour. Since then every
commit of this session first runs a live-flight smoke test with the HUD up (3 s of flight plus the map), which fails on any
console exception (LESSONS #34).

### A galaxy per program (2026-10-09, effects beat, QUEUE Q21)
`GAL` came from `WSEED`, the planet's seed, a constant: every playthrough had the same sky. The planet should stay fixed
(sites, coasts, powers all hang on it), so the galaxy gets its own seed instead: `PROG.gseed`, drawn the first time the
sky is drawn (`galaxy()`, called from `render()`) and saved with the program. `makeGal(seed)` is the old recipe.
- A program reset clears it (`gseed:null` in the reset in `app/editor.js`), so a new playthrough gets a new sky; the
  tester's sandbox is a separate saved program, so it has its own. An old save without the field draws one on load.
- Reference views set `PROG.gseed = WSEED` (13), so views 97–100 stay the pictures they were tuned on.
- Seen: `refView(97)` (aimed at seed 13's centre) shows the band; seeds 424242 and 99 put their galaxies elsewhere.
- test.mjs `aerofx-3`.

## PLAYTEST #3 and #4: a new rocket that looks new, and the pad at night (2026-10-08, aerofx session; visuals' code)

Taken with a note in the visuals session's claim (it was idle). PLAYTEST #2 (gantry clipping) had already been fixed by
the tester session.

**#3, "the rocket starts out looking beat up":** it was the LOX frost. A fuelled tank on the pad has frost = 1, and the
frost was opaque white blotches with the paint showing through as black specks, which reads as peeling paint. Now it is a
fine translucent rime: 12–38 % cover below the fuel line, a little thicker toward the bottom, with a soft ragged edge and
faint run-off streaks. The roll pattern stays crisp and the black squares read as frosted grey. Found by rendering the
same fresh rocket with frost forced to 0.

**#4, the pad at night and the buildings' surfaces:**
- **Floodlights** were four point lights with almost no falloff inside 30 m and no direction, so lit buildings came out
  flat white and the rest black. Now each is a spotlight from its 16 m pole aimed at the launch table (`uFlC`), with a soft
  cone (cos 0.5–0.86) and inverse-square falloff (420 / (d² + 60)), plus a faint spill (5 %) within ~150 m of the pad.
  The first gain (1500) saturated the red gantry, where the four cones overlap.
- **Surface detail for the launch complex** (`uPadM`, set only while `PAD` and the rig draw): from the pad-local
  position and material class. Concrete: formwork seams (1.2 m × 3 m), mottling, rain stains running down. White paint
  (tanks, LOX sphere, water tower): weld rings every 2.4 m with rust weeping below them. Steel: mill mottling and rust
  spots. Everything darkens toward its foot. Fades with distance.
- A diagnostic trap, for the record: overriding a top-level function from the page (`window.padLights = …`) did not take
  effect, so a "floodlights off" test proved nothing; logging the uniforms per draw call showed the floodlights were on.

## Sound (2026-10-08, sound session; open thread 7)

All synthesised in WebAudio, no samples: looped noise buffers (white, brown, and a sparse "pop" buffer for crackle)
through filters, two low sine tones for the sub-bass, a 6.5 Hz LFO for buffet, and one-shot filtered bursts with a
falling thump for events. A compressor on the master. **F4** toggles (remembered per browser); the context starts on
the first click or key, as browsers require. Render-side only: `sndTick(dtR)` is one call in `frame()` after `emitSmoke`,
outside `render()`, reading SIM state and diffing it frame to frame. No SIM changes.

**The model: the listener rides the ship, like the crew.** Two paths reach them:
- **Through the air:** loudness ∝ (thrust / 4 MN)^0.3 (Stevens' law on an acoustic power ∝ thrust), × √(ρ/ρ₀) (the
  same source power in thinner air makes a smaller pressure swing), × a ground-reflection boost below 150 m, × a Mach
  factor that drops 80 % between Mach 0.9 and 1.3 (the exhaust's noise can't run forward faster than sound). Its lowpass
  closes from ~3.6 kHz at sea level to ~550 Hz at ρ/ρ₀ = 0.05: thin air sounds dark before it sounds quiet.
- **Through the structure:** a 110 Hz-lowpassed rumble whenever an engine burns, at any altitude. In vacuum that is all
  there is. Apollo crews described the engines as felt more than heard; this is that.

Plus: wind from dynamic pressure (bandpass rising with airspeed, full at 40 kPa), buffet (the wind amplitude-modulated
near Mach 1, Gaussian in M with σ = 0.12), a high hiss when the hottest part passes 35 % of its limit under q, an RCS
hiss while jets fire, crackle weighted to solid motors (escape tower included).

**Events** (diffed, so they need no hooks in the SIM): fewer parts on → separation thunk; an engine burning that wasn't
→ ignition (a sharp crack for solids, a soft whoomp for liquids); `chuteA` crossing 1 (drogue) and 7 (main) m² → chute;
`landed` turning true → touchdown thump scaled by `touchV`; a new entry in `booms` → a blast, through `sndBoom`: our own
ship is heard through the structure even in vacuum, anything else only through air, **late by d/340 s**, with gain
∝ √air · 250/(250+d) and its highs eaten with distance. Switching ship, reverting or a new flight resets quietly.

**Measured** (test.mjs sound-1, an Orbiter ascent on the SIM, the mix sampled every second): roar 0.41 at the pad →
0.25 at Mach 1 (5.8 km, buffet 1.0) → 0.04 at 10.5 km (supersonic) → 0.01 at 30 km → 0 by 70 km; wind 0.82 at Mach 1,
0.89 at max-q (33 kPa, T+52), 0.53 at 30 km, 0.05 at 70 km. A blast 5 km away: 0.03 of its 100 m gain, 14.7 s late,
lowpass 417 Hz. In headless Chrome on the real page: the context runs, the Orbiter at full thrust on the pad measures
−23 dBFS RMS at the master (silent at idle, −73 dB after cutoff); ignition, both stages' ignitions, separation and a
blast all fire; F4 mutes (master to 0.001) and back; leaving flight fades to 0; the map plays at 35 %.

**Negative result worth keeping:** counting active engines misses the upper stage's ignition (one engine out, one in:
the count stays 1). Events are diffed by engine identity (`p.i`) instead.

**Not judged:** whether it sounds *good*. That needs ears (TESTING row 114). Levels are first guesses: the layer gains
in `sndTick` are the knobs.

### Per-engine voices (2026-10-09, effects session for the sound beat, QUEUE Q66)
Every engine used to sum into one roar. Now each kind of engine burning gets its own band of noise (`sndVoices`, in the
pure mix block), centred on its jet's peak frequency f ≈ St·U/D (Strouhal 0.2, exhaust ~2.5 km/s, D the exit diameter):
Wren 1000 Hz, Sparrow 833, Kestrel 455, Petrel 417, Condor 403, Albatross 227. Same-kind engines are one voice (a
Heavy's three Kestrels: one voice at 455 Hz); up to four, the biggest thrust shares first; gain ∝ √share × the airborne
level, so the total power stays put. Four white-noise bandpass layers (Q 1.4) carry them (`AUD.V`); the broad roar
drops to 0.8 while voices play. `AUD.VOICES = false` for A/B.
- Checked live in the page (`AUD.lastV`); not judged by ear (no speakers on an unattended run): TESTING row 158.
- test.mjs `aerofx-3` (engine voices).


### Re-entry plasma by the heating model; sounds from elsewhere (2026-10-09, effects session for the sound beat, QUEUE Q67)
- **Plasma:** `sndPlasma(qh, va, pv)` uses the drawn shell's own rule: the stagnation flux on its log scale (15 → 160
  kW/m², capped 1.2) times the same airspeed gate around `PLASMA_V` (0.85–1.05). It plays a low rumble (brown noise
  under 260 Hz) and a crackle (the pop buffer at 1.4 kHz, ∝ level²), heard through the hull, so it doesn't thin with
  the air. Measured: a hot climb (77 kW/m² at 1 km/s) 0; onset (20 kW/m² at 2.6 km/s) 0.12; view 40 (160 kW/m²) 1.00.
  The old skin-temperature hiss stays (hot metal ticking, a different thing).
- **Elsewhere:** `sndOthers` takes other vessels burning within 30 km (the own roar's loudness law) and debris tearing
  through the air (a whoosh from its dynamic pressure, from 0.5 kPa), each falling as 250/(250+d) and needing air at
  both ends; highs fade with distance; one brown-noise layer through a stereo panner, panned by the power-weighted
  direction against the ship's right. A Heavy's dropped boosters at 18 km: 0.068. No delay for distance yet (the
  explosions have one). `AUD.Q67 = false` turns both off.
- test.mjs `aerofx-3` (plasma sound / elsewhere). Not judged by ear: TESTING row.

### The volume slider (2026-10-09, effects session for the sound beat, QUEUE Q35)
In the Settings overlay's Sound row (flow's `#setSound`): 0–100 % in steps of 5, `AUD.vol` live, kept in
`localStorage['launchpad-volume']` and read at start. `renderSettings` calls `sndSettings(el)` (one additive line in flow's
`app/settings.js`). F4 still mutes. Checked in the page (40 % → `AUD.vol` 0.4, saved) and the robot's `m1` route passes.

## Legs and power parts get their looks (2026-10-09, effects beat for parts & pad, QUEUE Q97)

The vehicle session's landing leg (v1.61) and power parts (Q34a) were placeholders: a strut and a box, a dark plate, and
the battery and computer fell through to the default 1.25 m drum. `partBody` now draws each:
- **Landing leg.** Stowed: the shock strut along the skin (steel cylinder, chrome piston), the brace beside it, the
  footpad folded flat at the bottom, hinge and lower-mount fittings. Deployed: hinge → cylinder → piston → ball joint
  → dished footpad, the foot exactly at the sim's `legFoot` (reach out, drop below the leg's bottom), and a brace from
  the lower mount to the strut's middle. The pose changes with the mesh rebuild on Y (no swing animation yet).
- **Solar wing.** Stowed: a folded pack of four panels under a cover. Deployed: boom and yoke, four framed panels of
  cells, edge spars; the wing's plane still holds the outward direction and y, as `power.js` assumes.
- **Body cells.** 4×4 cell tiles on a steel backing that follow a 0.625 m hull's curve (on a 2.5 m hull they sit a
  centimetre proud at the edges).
- **Battery:** a ribbed ring of cells, an orange band, two terminal boxes. **Computer:** a dark equipment ring with six
  gold-foil and black avionics boxes and a cable run.
- Views `refView(108)`–`(111)`: a lander's legs stowed and deployed, a satellite stowed and with its wings out.
- test.mjs `aerofx-3` (part looks). Not yet: legs swinging down over a second, wings unfolding.

## Fill light on airless bodies (2026-10-09, effects beat, QUEUE Q116, PLAYTEST #32)

`lightEnv(p)` only knew Tellus's air: on Selene its "height" is the distance from Tellus, so sky and ground light were
zero and a lander with the sun behind it was pure black against bright regolith. `airlessFill(p)` (checked first) finds
an airless body within 4 radii and returns its own lighting: the sun unfiltered, `up` = that body's local up, and a
ground term = 5 · albedo (0.12 unless the body says otherwise) · sun elevation, fading over 0.6 R of height; a token sky.
- Measured: on Selene's day side with the sun 20° up the ground term is 0.195 (Tellus's daytime ground is ~0.18); 0 at
  night; 0.108 one radius up. Earthshine (~1e-4 of the sun) is left out.
- `refView(113)` (back-lit, shadow toward the camera): the tank reads grey, the dark pod stays dark; `FILL_FX = false`
  gives the old black silhouette. `112` is the same lander from the sunny side.

## Bay doors and char on dark shingles (2026-10-09, effects beat for parts & pad, QUEUE Q24)

- **Bay doors mid-swing** read as paper-thin white eggshells: both faces were the paint colour and nothing held them.
  `bayDoor` now gives the inside grey insulation and puts three hinge brackets on each rim, so a half-open door
  reads as a door.
- **Char on the capsule's black shingles** was invisible: char darkens toward black, and black can't get darker. On
  dark paint (luma under ~0.1, `dk`) char now heat-tints instead, from bronze to blue-grey by noise, streaked like
  the rest of the char (up to 80 %, less where it is fully burnt). Mercury's René 41 shingles came back looking like
  this. The first try (tint at ~0.3 albedo) turned the whole pod pale bronze; the tint is now ~0.1.
- Seen in the builder (bay at 45 % open; pod char 0 / 0.5 / 1). test.mjs `aerofx-3`.

## Reference views swept (2026-10-09, effects beat; ROADMAP look & sound evergreen)

All of `refView(1..113)` rendered in one page per 20–25 views (`refView` from a fresh page past the career gate):
74 views exist, none throws or hangs. One thing looked wrong: since the Debrief screen, a view that leaves a flight
for the editor passes through Debrief, and its panel covered the close-ups and complex views (4–9, 15–17) and
anything after a flight. `bare()` in `views.js` now hides `#deb` too (the robot playtester's shots go through it).
Re-checked 4, 15, 17. Contact sheets were looked over; the HUD views (94–96) show the HUD on purpose.
Known, not fixed: the entry views fly nose-first (SAS "retro" loses to the aero torque) and burn the capsule's
parachute off at ~55 km (a boom and smoke in 40–47); the shield-first views 46–47 turn the capsule afterwards.

## Hardware schools in the game: the plan (2026-10-09, effects beat, QUEUE Q102; mock-ups Q89, `mockups/schools/`)

POWERS.md: a school may change a part's surface detail, finish, paint, bell detail, fin edges, decals and roundel, never
its outline or anything in `PARTS`. Each part draws in its **maker's** school (decision 2), the paint ties a mixed
rocket together, and the player's presets stay the same designs in every school. Cape is today's look. Built in steps,
each one merged and tested on its own:

1. **Which school.** `schoolOf(power)` from POWERS.md's affinity weights (the highest, seeded per world so two Cape
   powers stay Cape), and `partSchool(p)`: the maker's school (a part bought abroad, `sourceOf`, is the seller's), else
   the program's. A tester toggle forces one school for screenshots.
2. **Carry it in the mesh, not in uniforms.** `MESH_FS` already spends 192 of ANGLE's ~221 fragment vectors on
   per-part marks, so a per-part school array won't fit. Encode it in the vertex's kind instead: `PK.k + 32·school`
   (kinds stay below 32), decoded in `MESH_FS` as `k = mod(kind, 32)`, `sch = kind / 32`. Free, and a rebuild already
   happens whenever the parts change. Check: Cape (0) leaves every vertex byte-identical to today (`partsMesh` hash).
3. **Paint and finish (`MESH_FS`, by `sch`).** Cape: as now (white, the black roll pattern, bare-metal bells). Steppe:
   grey-green enamel panel by panel with dark seams instead of the roll bands; olive bells with cooling-tube ribs. A
   power's own hue tints the school's accent (the roll band, the seams), as POWERS.md § Livery says.
4. **The interstage cover (`partsMesh`).** Where an engine sits exposed between a decoupler below and a tank above, draw
   a cover around it at the stack radius, outline unchanged: Cape a closed ribbed skirt, Steppe an open lattice of
   tubes (the engine shows through). It's drawing only: `noAero`, no mass, nothing in `PARTS`.
5. **The roundel.** A disc decal on the uppermost tank, from the power's flag motif (stripes and a star field; one big
   star on a plain field), drawn in `MESH_FS` like the roll pattern (no texture), coloured by the power.
6. **Signature designs for rivals.** One or two stacks per school from normal parts (Cape: tall three-stage with
   skirts; Steppe: a core with four conical strap-ons on cones), as designs the rivals' news pictures and pads use,
   never offered as the player's presets (the pay floor is measured against those, NOTES v1.53).
7. **The pad per school (the largest step, last).** Cape: today's fixed tower and swing arms. Steppe: horizontal
   rollout on rails, raised over a flame pit, the launch table's four arms falling back at lift-off: a new rig in
   `buildRig`/`drawPadRig` with its own animation, and the rollout screen's camera.

Steps 1–3 make every existing rocket look right for its maker; 4–5 are what makes a school recognisable at a glance;
6–7 are content for rivals and the pad. Defaults if Caio stays silent on W20: build in this order, Cape first (no
visible change), then Steppe.

### Steps 1–3 built (2026-10-09, effects beat)
- `schoolOf(i)`: the power's school drawn from `SCHOOL_AFF` (POWERS.md's weights by archetype key), seeded by `WSEED` and
  the power, so it is fixed for a world; schools without a look yet fall back to Cape. `partSchool(p)`: the seller's
  school for an imported part (`sourceOf`), else the program's; `SCHOOL_FORCE` overrides (views pin Cape).
- The school rides in the vertex's kind: `pv` writes `PK.k + 32·PK.sch`; `MESH_VS` decodes with `% 32`, `MESH_FS`
  as `sch = k/32`. Every helper that rewrites `PK.k` (engine bells, mounts) keeps `PK.sch` by spreading `PK`.
- **Cape is byte-identical to before:** a hash of `partShape`'s output for Orbiter, Heavy, Big Lunar and Crewed Lunar
  on the old tree and the new one (Cape forced) matches exactly. The default world's own school is Cape.
- Steppe in `MESH_FS`: no roll pattern (tanks and the nose cone's checker), white paint becomes grey-green enamel with
  a ±6 % panel-to-panel shade, dark seams every 1.3 m and every eighth of the way round, rougher and not metallic; bells
  olive-tinted. `refView(114)` Cape, `(115)` Steppe.
- test.mjs `aerofx-3` (hardware schools): 69 % of closed superpowers draw Steppe (weight 0.7), open superpowers never.
- **Step 4 built:** the interstage cover. A decoupler with an engine sitting right on top of it draws a cover round that
  engine at the stack radius, with the decoupler's part index and school, so it falls away with the lower stage and the
  upper engine fires bare (checked in `refView(75)`, staging). Cape: a closed black skirt with 24 ribs. Steppe: two rings
  and 24 crossing tubes, the bell visible through them. **This changes Cape's look** (today's Orbiter on the pad showed
  its Petrel; now a ribbed skirt covers it, as POWERS.md's Cape brief has it). `INTERSTAGE_FX = false` brings back the bare
  engine. Not drawn: canted engines.
- **Step 5 built:** the roundel, a disc decal drawn in `MESH_FS` (no texture) on the side of an upper-stage tank (1.5–3
  tank-radii tall, between Cape's two side stripes): Cape red and white stripes with a blue canton of small stars,
  Steppe one gold star on red (`sdStar5`), both with a white rim. It is laid on after the school's paint (the first
  try put it before, and Steppe's enamel pass repainted the gold star green). Views 114/115 now face it.
- **Livery built:** the maker's `hue` (POWERS, 10° steps) rides in the vertex kind too (`k + 32·school + 256·hue`; the
  `% 32` decoders still work). Cape's roll band is the hue at the old near-black brightness (`hsv(h, .55, .16)`, the same
  luminance as before, tinted); the roundel's stripes are the hue, its canton the hue + 200°; Steppe's disc is the hue,
  the star stays gold. Seen at hue 20 (the default world's home: warm red stripes) and 220 (blue). **Cape is no longer
  byte-identical** from here on: that's the livery POWERS.md asks for.
- Next: 6 (signature designs for rivals); 7 built below.

### Step 7 built: the Steppe pad (2026-10-09, effects beat, QUEUE Q159)
Built on W21's default (Caio said go). **A site's pad is in its owner's school** (`padSchoolOf(t)`: the site's power, a sea
platform home's; `SCHOOL_FORCE` wins), so every site draws its own (`padFor(t)` in `render()`'s site loop) and the current
one is sized to the rocket as before (`padSync`'s key now carries the school). **Nothing changes in the default world**:
home is Cape there, and Cape's `buildPad`/`buildRig` code paths are untouched (tests 38 and 39 still sweep them).
- **Static (`steppeTable`):** no tower. A flame pit 13 m wide (`PIT_W` 6.5) under the rocket, opening south down a
  sooted slope: the ground can't be dug, so its mouth is a near-black floor inside parapet walls with guard rails, as
  Cape's flame channel. The erector's rail line (ballast, rails, sleepers) runs north to a horizontal assembly hall
  (26 × 60 m, its door facing the pad). The propellant farm, gas racks, deluge, masts, bunkers and blockhouse are shared.
- **Rig (`steppeRig`, drawn by `drawSteppeRig`):** a table ring round the rocket on two girders over the pit; four
  support arms ("the tulip") pivoting on it at Cape's hold-down angles (so they miss the boosters), leaning in to clamp
  the rocket 30 % up (2.5–18 m), falling back outward 66° in 1.4 s from 0.1 s after lift-off; two cable masts north of
  the ring with an arm to the rocket's side, falling back north at lift-off; two service halves (one mesh, drawn east
  and turned 180° west), lattice columns on the pit's edge with open grating decks every 5 m reaching to the rocket,
  closed when a flight starts on the pad and folding down to the ground over 14 s from 2 s in (Cape's gantry takes 14 s
  to roll away), down in the editor; the transporter-erector, its car on the rails and its boom with cradle arms, **up
  in the editor and on the Rollout screen** (the rocket has just been stood up) and down on its car in flight.
- Solid decks were tried first: folded down they stood up as grey walls. Radial decouplers are left out of the rig's
  reach sums (`padRig`'s `pb`): they are brackets, and as stack-radius cylinders they bent the Heavy's arms.
- Views 116 (complex, editor), 117 (a flight's start), 118 (1 s after lift-off), 119 (the table from above).
  test.mjs `aerofx-4`: for every preset the arms clamp within 0.16 m of the skin without passing through anything, the
  masts' arms, the cradle arms and the closed halves stop short, the ring clears the base; the school per site.
- **Not built:** the rocket lying on the erector during the rollout itself (a horizontal rocket needs the Rollout screen
  to draw the stack on its side: flow's screen, proposed; **built v1.111, Q193**); a tester switch for `SCHOOL_FORCE` (console only, as Q102).

### The other four schools (2026-10-10, effects beat, QUEUE Q228; POWERS.md § "School briefs", mock-ups Q227, Caio's go W34)

`SCHOOL_IDS` now has all six: Cape 0, Steppe 1, Arsenal 2, Coastal 3, Mountain 4, Isle 5. A power whose affinity draws
one of the four now builds in it, not Cape (open superpowers: Cape .6, Coastal .2, Mountain .2; closed: Steppe .7,
Arsenal .3). Each repaints the white base in `MESH_FS` after Steppe's pass, the same way:
- **Arsenal:** matte olive lower stage, bare-metal upper stage panel by panel; a stencilled four-digit serial on each
  tank (`serial()`, a 3×5 font, from the part index); a striped band at the separation plane in the livery's hue;
  heat-stained bells (bronze to blue-purple at the lip, thick rings). Its cover is a skirt with eight **vent windows**
  (`discard`), so the upper engine shows through (hot staging).
- **Coastal:** satin white; one pastel band (the hue at low saturation) round the upper stage; pastel pin-stripes at
  each tank joint; silver bells with a dark throat. Its cover is smooth white with a pastel stripe and round vent ports.
- **Mountain:** terracotta lower stage, white upper; saffron at every joint; gold-tinted bells. Its cover is white with
  a ring of separation bolts and four spin rockets (small tubes, mesh).
- **Isle:** matte black carbon, the weave showing in raking light; mission patches on each tank; a hue band under the
  top of the upper stage; copper bells printed in layers. Its cover is flush carbon with a hue stripe.
- **No roll pattern** outside Cape (tanks, adapters).
- **Roundels:** `app/flags.js` `roundelBody`'s designs, in the shader (absorbs Q223): Arsenal a chevron and a gold
  disc; Coastal rings; Mountain a sun with eight rays; Isle four stars. A is the power's hue, B its dark complement.

**Upper stage.** A part is upper when it sits above a decoupler on its own stack line (`upperOf`, built once per
`partsMesh`). The flag rides in the kind as +16384 and is decoded as `up=hq>=64`. It is set only for schools 2–5, so Cape
and Steppe vertices stay byte-identical.

**Views:** `refView(123)`–`(126)` are the Orbiter in the builder as Arsenal, Coastal, Mountain, Isle (114 Cape, 115
Steppe). test.mjs `aerofx-3` now expects open superpowers to be mostly Cape, else Coastal or Mountain.

**Not built yet:**
- These schools' pads and signature designs: they use Cape's pad for now (Q102 steps 6–7; the mock-ups have them).
- Coastal's lettering and Isle's rocket names. A font now exists in `MESH_FS` (`serial`'s digits).
- The fins' coloured tips (Mountain saffron, Isle hue): the shader has no radial coordinate on the fin mesh.

### The four schools' pads (2026-10-10, look & sound parts & pad beat, QUEUE Q231, Q102 step 7; POWERS.md § "School briefs", mock-ups Q227)

A site's pad is built in its owner's school (as Q159), so Arsenal, Coastal, Mountain and Isle sites now have their own
complexes. In `buildPad`, `arsenalPad`/`coastalPad`/`mountainPad`/`islePad` replace Cape's complex; Cape's buildings
(propellant farm, gas racks, deluge tank, masts, blockhouse) are now drawn only for Cape and Steppe. The floodlight poles
stay for everyone, because `padLights` lights from them. The moving parts are `schoolRig`, drawn by `drawSchoolRig`:
- **Arsenal:** a terrace slab with a retaining wall, the hill rising behind it to the north (a mesh heightfield, `hfield`;
  the two north floodlight poles stand on it). The flame chute runs south. A camouflaged lattice tower (`camoLattice`)
  stands east. *Rig:* one umbilical mast north of the rocket, its arm on the upper stage; it falls back north at
  lift-off. Also: the road transporter-erector parked west with its beam down, two earth bunkers with blast doors, a
  blockhouse with periscopes, the hall under a camouflage net, hypergolic tanks in a revetment.
- **Coastal:** a towerless pad: four lightning masts with wires between their tops, the twin rails north to a tall
  assembly building, the deluge water tower, low white buildings with a pastel band, a glass control centre,
  cryogenic spheres. *Rig:* the mobile launch table round the engines (on bogies over the rails), with two short
  umbilical masts on its west side; their arms swing clear at lift-off.
- **Mountain:** terraces step up a ridge to the north, with railings; a tidy hall on top with a saffron band, a control
  house up-range, motor stores. *Rig:* **the rail launcher** for a small uncrewed single stack (≤ 24 m, no side
  boosters; MIDGAME § The launch rail): a turntable ring and the boom, raised to vertical beside the rocket with
  hangers and struts. It is look only until Q230 tilts it. **The shelter** for anything else: two halves, closed round the rocket
  when a flight starts on the pad and swinging open from 2 s to 12 s (as Cape's gantry rolls back; open in the editor).
  They are hinged at the east ends of their outer walls, so they swing outward. Also an umbilical tower east, with
  Cape's swing arms.
- **Isle:** a tiny pad, a gravel track north to the hangar (a sign; no lettering yet), a shed, a container office, one
  mast, eleven sheep. *Rig:* a strongback north of the rocket on its trailer, clamped on, tilting back 4° at lift-off.

**Shared with Cape** (`swingArms`, `crewArm`, `holdDowns`, split out of `buildRig`, same geometry):
- The hold-downs, wherever the rocket stands on a table (not on Mountain's rail).
- The crew access arm, wherever a tower stands at x = 7: Arsenal's tower and Mountain's umbilical tower. Coastal and
  Isle put up a slim crew tower there for a crewed rocket, so their suits (Q229) still show in the Assembly.

`padRig` gained `side` (any part off the axis). `padSync`'s key carries the stack's shape for every school but Cape.
All of it stays on the sea platform's deck.

**Views:** `refView(145)`–`(151)`: Arsenal, Coastal, Mountain's rail, Mountain's shelter open with a crewed rocket, Isle;
Mountain's shelter closed at a flight's start; Arsenal 1 s after lift-off. test.mjs `aerofx-6`:
- Every preset in each of the four schools: the table, masts, arms, rail launcher, closed shelter and strongback stop
  short of the rocket.
- Mountain picks the rail or the shelter as above; a crew arm appears if and only if the rocket is crewed.
- The four complexes build inside the deck.

Stills: `output/launchpad/q231-pads/`.

**Not built yet:**
- ~~The sites' ground~~ **built** (world, v1.193, Q105; notes/world.md § v1.193): the ground now carries Arsenal's hill
  (the mesh hill is gone), Coastal's clearing, Mountain's ridge, Isle's headland. `padGround` (the apron, slabs and road)
  is still Cape's layout for every school.
- Rollouts: the truck erector driving in and raising the rocket, the table rolling out, the trailer and strongback
  raising it. Only Steppe's is animated (flow's `rollPhase`).
- The rail tilting (Q230), and lettering on the hangar and the assembly buildings.

## Wind-scoured ranges (2026-10-09, effects beat, QUEUE Q52 shader part)

The high ranges were one white cap: above ~7 km the snow term (`sn`) and the ice term are both 1 on any gentle slope. Now,
in `tellus()`'s colour only, an outcrop mask (value noise at ~4 km and ~1.2 km, more on steeper ground, none on flat ice
sheets) lets rock show through both terms; snow takes patches of old blue glacier ice in flat hollows and a ±10 % tone.
The ground's height and `biomeAt` are untouched, so the physics and biome science see the same planet. `ICE_VARY = false`
for A/B. Seen over an 8.5 km range at 41°N from 12 km up.
- **Two wrong first tries**, both measured, not guessed: the noise was at ~0.6 km (invisible from altitude: `pf` is a unit
  vector, so `vn(pf·k)` has features of R/k), and only the ice term was masked while `sn` was already 1, so `max(sn, ice)`
  didn't move. The A/B picture was pixel-identical until both were fixed.
- Not done here (world lane): the coast's smoothness and the pad's terrace are in the heightfield shared with `terrainH`;
  the salt flats and wetlands are biome masks the CPU also uses.

## Bloom (2026-10-09, aerofx session)

Bright lights now glow. The frame is drawn into an offscreen target (`sceneTarget`: 4× multisampled colour + depth/stencil,
so the MSAA the canvas had is kept), resolved, and its near-white pixels are shrunk through ½, ¼, ⅛ and 1/16 resolution
(a 4-tap box each step, so the chain blurs them; `BLOOM_FS`), then added back while the frame is copied to the screen
(`COMP_FS`, tent-filtered on the small levels). `bloomBegin` / `bloomEnd` wrap `render()`'s 3D part; passes that render
elsewhere mid-frame (the cloud coverage bake, the depth pre-pass) return to `sceneFB()` instead of the screen.

- **The catch:** the scene is already tone-mapped, so a bright daytime sky is as near-white as the sun. The first version
  (threshold 0.8) turned the horizon haze into a white band on every daytime ascent. Now the threshold is 0.93 on the max
  channel, and the glow is added in proportion to (1 − luminance)^1.6 of the frame under it: strong over space, night and
  the dark side of things, faint over bright sky. A true HDR pipeline (float targets, tone mapping once at the end) would
  do this properly; it would mean touching every shader's output.
- Cost on the RTX 5050 at 1280×800: +0.1–0.2 ms (pad view, A/B). `BLOOM = false` draws straight to the screen.
- What glows: the sun in space, explosions, ignition flashes and plume cores at night, the floodlight lamps.

## Fin-tip vapor (2026-10-09, aerofx session)

In a hard turn in humid low air, a loaded fin's tip vortex condenses into a white streak. `finTipTick` records each fin
tip's path (planet-fixed, so the trail stays in the air) with a strength: the cross-flow along the fin's normal (in a
pitch turn, two fins of a ring trail and two don't), × angle of attack (smoothstep 1–7°), × dynamic pressure (3–15 kPa),
× humid air (below 5 km, gone by 11) and Mach 0.25–1.8. `drawFinTips` draws each trail as a camera-facing ribbon that
widens and fades over ~1.2 s, lit like the smoke. Fin rings and radial fins both. `FINTIP_FX = false` turns it off.

- **Drawn after the plumes.** The ribbons don't write depth, so drawn before the plume (with the smoke) they vanished
  behind the exhaust even where they ran in front of it; they run beside it, a fin span out, so drawing them after is
  the lesser error.
- The trail lies along the flight path, and the rocket points up to 15° off it, so trails split away from the exhaust
  only in a real turn. In a straight climb (AoA ~0) there are none, as it should be.
- Reference views `refView(101)` an 8° pull and `102` a 15° pull at 1.5 km, the camera square to the turn. They hold the
  attitude, since the sim weathervanes back within a second.

## Spent stages re-entering (2026-10-09, aerofx session)

Dropped stages (debris) now heat up and glow on the way down, render-side (`debrisHeat`, `DEBH`): a stagnation heat flux
per piece from its speed through the air (Sutton–Graves with its widest radius as the nose, the same `SG`/`HEAT_GAIN` as
the ship), smoothed over 0.5 s. Above 15 kW/m² it gets:
- **the ship's plasma**, now a function, `drawPlasma(VP, camW, body, pos, q, all)`, drawn per hot piece within 20 km (the
  piece's geometry from `debrisGeo`; `hullProfile(s, all)` takes detached parts);
- **char** on its parts (the flight-marks `char`, windward), so a recovered or photographed stage is scorched;
- **sparks** shed from it (`fxPuff`) and a **dark smoke trail** (planet-fixed puffs, thin at altitude).

What you see depends on the case. A stage dropped during the climb is far below and behind by the time it heats, and
debris more than 40 km from the ship is removed, so mostly you won't. A stage dropped just before re-entry (a tank or
service module shed above the atmosphere) comes in beside the capsule. A light empty tank brakes much harder than a
capsule: in the reference case it is 55 m away at 82.5 km, 360 m at 78 km and 1.8 km at 72 km, while its heating rises
from 34 to 67 kW/m². Hot and close only briefly.

Reference views `refView(103)` (82.5 km, the stage 55 m behind) and `104` (80 km), the camera beyond the capsule looking
back along the capsule→stage line.

**Still open:** a breakup that changes the sim (pieces burning up into smaller debris) is not done: debris is sim
state, and this pass is render-only.

## Design pass: station modules, the arm, the rover (2026-10-09, aerofx session; visuals' and sats' code, Caio's call)

The station parts, the arm and the rover had come in from other sessions as plain shapes. Same early-era look as the rest:
- **Hab and lab** get their own detail branch (`KIND` 16, `MESH_FS`): meteoroid-shield panels on the pressure hull (eight
  around, 0.55 m tall), seams, a bolt at each panel corner, a slight per-panel tint and pillowing. Geometry: chamfered
  berthing rings at both ends, yellow handrails on standoffs (`stationTrim`), portholes in dark frames and two radiators on
  standoffs (hab), a round bolted science window (`labWindow`) and experiment boxes on the gold band (lab).
- **The arm's base** becomes a turret with a drive ring. **The booms** (drawn per frame, sats' code) get joint drums at
  the shoulder and elbow, dark bands near each end, and an end effector (a snare drum with a camera).
- **The rover**: a dark tub inside a tubular frame (rails, uprights, cross-tubes), a floor of panels, fenders as an arc of
  overlapping plates, and titanium chevrons on the mesh tyres.

**And two bloom fixes** found on the way. The composite sampled the ¼ and ⅛ blur levels with the 1/16 level's texel
spacing (4× and 2× too wide), so each glow had ghost copies up to 64 px apart: long streaks beside any bright edge. And the
downsample is now a 3×3 tent, the threshold 0.965. Sunlit white paint is still as bright as the sun once tone-mapped; the
glow around it is now a soft rim instead of streaks.

**The first-run gate** (ui session) now covers the page on load, so screenshot scripts must click `[data-start]` first
(as `playtest.mjs` does). The older reference views that start in the editor don't, yet.

## The crew's look, slice 1 (2026-10-09, effects beat, QUEUE Q195)
Caio, 2026-10-09: **stylised human** (W19) and **suits that vary by school and epoch** (D9), "start with the default and
we'll work from there" (his go lifts the M3 gate for this). Built:
- **`app/crew-look.js`** (new, after `app/gl.js`): `crewFigure(suit, pose, k)` rebuilds the Q72 mock-up's style (c)
  astronaut as a mesh (superellipsoids `blob`, tapered `limb`s, the helmet a shell open at the faceplate and underneath,
  with a rim; skull, square jaw, nose, ears, hair cut at a hairline, eyes, brows, mouth), 1.78 m, feet at the origin,
  facing +z; poses `stand` and `wave`. Person `k` picks one of four skin and hair tones, so two crew aren't twins.
  The mock-up's flat light bands and ink outlines aren't here: the mesh shader has neither (a later look item if wanted).
- **Suits:** `SUITS[school][gen]` with `suitOf(sch, gen)` falling back to `SUIT_DEFAULT`, the mock-up's pale layered suit
  with red fittings and boots. D9's lines (CREW.md § Part 1's table: early, middle, late, spacewalk) fill it school by
  school; the generation from the epoch isn't wired yet (nothing to choose between).
- **Where they show:** a **crew access arm** on Cape's tower (`buildRig`: a grey walkway with orange railings at 30 % of
  the capsule's height, ending 0.15 m short of it; a swing arm within 1.6 m stands down). In the Assembly and on the
  Rollout the two crew stand on it at the hatch, one facing the capsule, one turned out and waving (`drawPadCrew`, drawn
  without the pad's concrete detail); in flight the arm is swung back and the crew are aboard. Steppe's rig has no crew
  access yet (its crew would ride the service half's lift).
- Views 120 (the Crewed Lunar's arm), 121 (the two on a small crewed rocket), 122 (their faces from the south).
  test.mjs `aerofx-5`: the figure's size, feet, wave and face; the default suit; the arm at the hatch for every crewed
  design, short of it, the swing arm standing down, none without crew or on Steppe; TESTING 184.
- Next: the walk-out and boarding (proposed in QUEUE; the crew cross the arm and go in during the flight's first
  seconds, or the countdown), crew on Steppe's pad; D9's suit lines are Q199 (mock-ups first, then a build per school).

### The suits by school and generation (2026-10-10, effects beat, QUEUE Q229; CREW.md suit briefs, mock-ups Q219/Q226, Caio's go W32)

`SUITS[school][gen]` in `app/crew-look.js` now holds every national school's three launch suits (6 × 3). Each is built
from its own pieces by `crewFigure`, not one body recoloured, following the mock-ups:
- **Cape:** Mercury chrome with bloused knees, gold connectors and finger-tip lights; Apollo's bellows, connector row and
  zip, the Snoopy cap under a glass bubble (its back half; the face shows through the open front); the Shuttle's orange
  pumpkin with harness, buckle, chest hose, wrist mirror and the helmet's big pivots.
- **Steppe:** SK-1 belted with high boots, the visor slid up, a red brow band, the ventilator case in hand with its two
  belly hoses; Sokol's sewn hood and visor ring, blue lacing on every limb, the laced V, the case; late grey-green with a
  hard hood, padded chest, knee pads, orange flashes and the shoulder pack.
- **Arsenal:** a bone dome with the visor pushed up, a rubber oxygen mask hosed to the hip, capstan tubes, a G-harness and
  leg loops; sand with red quilting, pockets and the visor frame up; gunmetal with plates and a gold sun strip.
- **Coastal:** teal with a white yoke, an egg helmet, the round connector; Hermes's appliance shoulders, the helmet
  growing out of the suit, one band; blue-grey with shoulder and hip pads and a teal seam.
- **Mountain:** narrow quilting (saffron-banded early), the sun disc on every crown, the hose over the shoulder; green
  pull-tabs on white straps; the slim late suit in an open cap.
- **Isle:** surplus navy with patches, tape, rolled sleeves and a hand-painted helmet; a climbing harness and a dark
  visor; black with hi-vis side panels, sponsor decals and a helmet decal. Each school's hose sits where the brief puts it.

**Generation:** `crewGen()` is early until an epoch 4 mission is done, middle through the Selene era, and late once
`crewland` is done. The rig's cache key carries it, so the crew change suits when it does. `CREW_GEN_FORCE` pins it for
views.

**Views:** `refView(127)`–`(144)` show school s, generation g at 127 + 3s + g, framed as view 121. Steppe's pad has no
crew arm yet, so 130–132 show none (its suits are in the mock-up). test.mjs `aerofx-5`: six schools × three suits, no two
generations of a school sharing a dominant colour; the figure's height and face checks as before. Stills:
`output/launchpad/q229-suits/`.

**Not built yet:**
- The spacewalk suits and Foundry's: nothing draws them yet (EVA; the commercial giant's crews).
- The role stripes: crew have no roles in the SIM yet.
- The mock-ups' lettering and fleet numbers.

## v1.132 — the desk's polish (2026-10-12, parts & pad beat, QUEUE Q276; from Q242, v1.115)
Everything is in `deskMesh` (`app/model-desk.js`). The builder, the camera and the lamp are unchanged.
- **The drafting board** stands behind the model, tilted 20° toward the default view on two steel legs. It has a pale green
  drafting cover and a pencil ledge. The table is now deeper to hold it (z −0.78…0.55 model metres) and its back legs
  moved with it. The lamp's base sits to the left of the board.
- **The drawing on it** is the design's general arrangement, taped at the corners. Its elevation is drawn from the
  built parts: each part's outline (`p.pos[0] ± p.d.r`, `p.y0 … +p.h`) at the drawing's own scale, nose up, with a
  dashed centre line. It's a block diagram, so nose cones come out as rectangles.
- **The title block** (lower right) is lettered with the design's name and `SCALE 1:N`. The name is the player's own if
  this design is saved under one (`PROG.designs.saved`, matched by `designKey`, v1.129); otherwise it's `designName`
  (a preset's name, or "Design XXXX"), in capitals, cut to 24 characters. The font is a 5×7 bitmap (`DESK_FONT`: A–Z,
  0–9, `: - . /`). Each row's run of pixels is one thin ink box, and a long name shrinks to fit. Characters outside
  the font leave a blank space. `deskName` caches its answer per built ship, because it runs every frame.
- **The T-square** has its dark head hooked over the board's left edge and its blade across the foot of the drawing.
  **The eraser** (pink) lies by the pencil.
- **The scale figure** on the base plate is one of our crew now, not a man in a white coat: `crewFigure` in the
  program's school (`schoolOf(0)`) and suit generation (`crewGen()`), a real 1.8 m like before. With crew-look.js
  missing, the old figure comes back.
- **The cache key** (`deskKey`) is scale | name | school | generation | part count | length. Editing the design or
  saving it under a name rebuilds the desk once; the last four builds stay cached as before.
- **Checks:** test `aerofx-7` (the font covers what a name and scale need, with distinct glyphs; the saved name comes
  first; the key; the crew figure). `flow-11` still passes. Stills are in `output/launchpad/q276/`: `before_*`, then
  `after2_*` (Orbiter 1:48, Crewed Lunar 1:96), `named_1` (a saved "Kestrel One"), `fig_*` (the figure).
- **Not done:** a set square and lettering on the plan sheet under the model. The panels as paperwork are flow's R5
  (Q241) and vehicle's Q237/Q238. The strip's "model 1:48" is flow's Q277. From behind (yaw ≈ 2.4) the camera looks
  down onto the board's face, so the lettering reads upside down there. That's fine: it's a real board.

## v1.134 — the reference views, `refset.mjs`, graphics Low/High (2026-10-12, effects beat, QUEUE Q312; BEAUTY B0.5–0.6)
The first item of the beauty pass (BEAUTY.md § 4, D18). It makes the before/after honest and measured before anything
changes the look.
- **The views were shooting the wrong scene.** Every view that enters the builder only clicked *Editor* when it wasn't
  already in editor mode. The Program desk is editor mode too, and a room covers the window and stops the 3D draw
  (Q239), so views 1, 4–9 and 114–126 shot the Program's paperwork. That's also why their GPU time read `null` in the
  design desk's log. A `toBuilder()` helper now goes to the Assembly screen (11 call sites). The Assembly's model desk
  (v1.115) is off for every view except **152**: `DESK_FX = n === 152` at the top of `refView`.
- **The "impact · 9 m" label** is drawn on the overlay canvas, which `bare()` never hid. `bare()` now hides `#ov`, and
  each view shows it again at the start (94–96 keep their HUD).
- **The explosions (90–93) missed the fireball.** A boom ages on the wall clock, and the view backdated it before a
  capture that takes ~0.3 s or more, so a 0.1 s fireball had burned out. There's now an effects clock,
  `HOOK.fxT ?? performance.now()`, read by render.js's effects block and `boomLight`. Views 90–93 pin it at the
  boom's age and `refView` releases it. Play is unchanged (`HOOK.fxT` is null).
- **New views 152–158**, the moments the pass targets: 152 the Assembly's desk, 153 liftoff at ~T+2 s (wide and low),
  154 the Lunar at max-q (flown until q turns down: 31.4 kPa at 10.4 km, Mach 1.52), 155 the Lunar's staging at 60 km,
  156 an orbit sunrise (200 km, the sun rising over the limb behind the ship), 157 Tellus from 4,000 km, 158 Selene from
  100 km.
- **`refset.mjs`** shoots the reference set (default: 1–10, 30–36, 40–47, 50–56, 60–77, 80–83, 90–93, 97–104, 112–115,
  123–126, 152–158) into one folder. Each view is shot at full resolution, and its GPU time is measured twice: at the
  scale the game's own scaler settles on from the setting's cap (~2.4 s), then at full scale. Rows go to
  `timings.log` as `[n, label, 'adaptive', ms, scale, 'full', ms]`. `REF_Q=low|high` picks the setting and
  `SHOT_IGPU=1` the Intel GPU. Every BEAUTY item measures its before and after with it.
- **The iGPU wasn't being measured.** Windows pins `chrome.exe` to the RTX on this machine (`UserGpuPreferences`,
  `GpuPreference=2`), so Chrome's GPU flags never reached the Intel UHD, and `shot.mjs`'s `SHOT_IGPU` shot on the
  RTX. Both tools now run **Edge** with `--force_low_power_gpu` for the iGPU (checked: the renderer reads Intel UHD).
- **Graphics: Low and High** (ROADMAP § "Graphics budget"). Medium is gone, for these reasons. On the iGPU every heavy
  view sits at the 35 % resolution floor whatever the setting (full resolution there is 43–159 ms). At that floor,
  Medium's Heavy vapor view (54) took 37.7 ms against Low's 21.5. So Medium missed the 30 fps floor, and Low is the
  setting that holds it (pad 16.7, ascent 13.0, clouds 13.4, orbit 7.3 ms). Low keeps today's Low effects (flat clouds;
  no bloom, plume light, ground glow or vapor) and its 60 % cap. A saved `medium` reads as Low (`QUAL_OLD`), because
  the player picked it to go faster.
- **Baseline for B0** (RTX 3050, High, the whole set): `output/launchpad/beauty/b0-base-rtx-high/`. 81 views, no nulls. **37 of 81 sit below the 75 % scale target.** The heaviest at full resolution: the
  Heavy's staging 77 (23.1 ms) and 74 (22.8), clouds on the pad 80 (21.7, at 45 %), explosion 92 (18.6), the engine from below 10
  (17.6), the Lunar on the pad 63 (16.1).
- **What it says for the next items:** **the plain pad is already over budget.** The close-ups 4–9 and the school views 114–126 have no smoke,
  plume or vapor, yet they take 10–12.6 ms at full resolution and settle at 67 %. So half-res effect buffers alone
  won't bring the pad views back above 75 %: the pad scene itself (the sky, the ground, the complex) needs measuring
  by pass. That belongs in Q313's plan. On the iGPU (Low) every view sits at the 35 % floor (pad 16.7 ms there); half-res effect buffers (Q313) are what
  could lift that floor.
- **Checks:** test `aerofx-8` (views on the pad with the desk only in 152; the Assembly route; overlay; the pinned clock;
  152–158; Low/High with medium → Low). TESTING 216.

## v1.135 — the cloud deck at half resolution; a pass profiler (2026-10-12, effects beat, QUEUE Q313; BEAUTY B0.1)
BEAUTY's plan was half-resolution buffers for the smoke, the near-cloud slab, vapor and impingement. Measured first,
then built only the part that pays.
- **A pass profiler.** `profMark(name)` in `render()` (19 marks: setup, cloud bake, sky depth, cloud slab, sky, moons,
  pads, rig, cities, ship, others, smoke, vapor, glow, plume pool, plumes, fins/plasma, booms, bloom) chains GPU timer
  queries. It's off unless `PROF.on`, and the frame's own timer stands aside while it runs (queries can't nest).
  `REF_PROF=1 node refset.mjs …` adds each view's per-pass ms at full resolution.
- **What it found (RTX 3050, full resolution):** the **sky pass is 70–75 % of every frame**: 5–7 ms on the pad,
  4.5 on the climb, 2.8 in orbit, 10–14.5 under clouds. Smoke, plumes, vapor, impingement and the pad's meshes are
  each under 0.3 ms. So **half-res buffers for smoke, vapor and impingement would buy nothing; not built** (a negative
  result). An A/B with `CLOUD_VOL` off split the sky: the **cloud slab** cost 5.6–9.7 ms whenever the camera is in or
  near the deck (views 80–81), and the base sky (terrain, sea, air) the rest.
- **The views' weather was unpinned.** The sky's cost follows the cloud cover, which moved with each view's sim time
  and each run's day: the same view measured 6 and 17 ms. `bare()` now pins the drawn weather to one program time
  (`REF_WX`: `CLOUD_DT = REF_WX − tNow()`). Views 80–83 keep the moment they search for. Run to run the sky now agrees
  within ~10 %. `refset.mjs` prints the home site; it's the same each fresh career (Dunnzar Cape).
- **The deck in its own pass** (`PSLAB`: the sky shader's functions + `SLAB_MAIN`). It runs after the depth pre-pass
  (half resolution, which already holds the ground hit) and before the sky. It marches the same 72 steps × 3 density
  lookups as before into two targets: A = (light, transmittance) RGBA16F, B = (mean depth, depth where it turns
  opaque, the ground hit it marched to) RGBA32F. The sky upsamples it from the four nearest texels, weighted
  bilinearly and by how well each texel's ground hit matches this pixel's (log distance, so no bleeding over a ridge
  or past the rocket). It then applies the air between at the deck's mean depth, with the pixel's own transmittance
  and in-scatter. Before, the air was applied per step; at the mean depth the difference doesn't show in the stills.
  The opaque depth still sets the pixel's depth, so meshes behind thick cloud stay hidden. No pass (no
  `EXT_color_buffer_float`) means no volume (the flat shell), which already applied to the depth pre-pass.
- **`SKY_FS`'s main is smaller** (the march left it), as BEAUTY's Q19 rule asks. The head's output now has an
  explicit location (`layout(location=0)`), since the slab pass adds a second.
- **Measured, the same moments back to back** (the previous commit served from a scratch worktree): views 80–83 at
  full resolution 12.8 → 7.9, 17.7 → 8.1, 15.8 → 7.9, 13.4 → 4.8 ms. Stills
  `output/launchpad/beauty/q313-before/` and `q313-after/`, and `q313-ab-08x.png` stacked. They look the same. If
  anything the deck's edges are cleaner, since the old full-res march left a speckle of its jitter, which the 4-tap
  upsample smooths. Full set after: `q313-after-rtx-high/`: **7 of 81 views below 75 % scale (37 in the baseline).**
  That comparison also includes the weather pin, so it's not all the slab: the editor close-ups have no volume and
  still moved ~2.5 ms. Low has no volume, so the iGPU is unchanged.
- **Still below 75 %:** the pad close-ups 4–7, the Lunar on the pad 63, clouds on the pad 80, fin vapor 101. What's
  left there is the **base sky at the pad (~5–6 ms: terrain, sea and air ray-cast)**. That's Q322's transmittance table
  (`scatter`'s inner loop) and world's Q19 (the terrain pass); filed under QUEUE *Proposed* as a measured split.
- **Checks:** test `aerofx-9` (the march out of the sky's main; the pass and its two outputs; depth → slab → sky;
  volume needs the pass; the profiler off by default). TESTING 217.

## v1.137 — the HDR scene: AgX, auto-exposure, bloom on real light, a grade (2026-10-12, effects beat, QUEUE Q314; BEAUTY B0.2–0.4)
Every shader used to tone-map itself (×0.85, the ACES fit, gamma), so blending happened on display values and bloom
could only catch near-white. Now the frame is light, and the camera is one place.
- **Linear light everywhere.** The sky, the moons, the meshes, smoke, vapor, dust, the fireball and the fin trails write
  scene-referred linear colour. The emission volumes (plume, plasma, impingement) pass their radiance as it is, scaled by
  `FXK` (0.8), instead of `1 − e^−C` in display space: a plume core is now many times brighter than sunlit paint.
  The additive glows (lamps, windows, RCS puffs, the desk bulb) are `pow(vC·uGlow, 2.2)`, so uGlow > 1 reads as a
  light. The desk's clear colour is linearised. Map lines are UI: `pow(vC, 2.2) / E` (`uLk`), seen as drawn.
- **The target.** RGBA16F, multisampled, on **both** settings (Low used to draw straight to the canvas): `HDR_RT`
  (EXT_color_buffer_float; without it RGBA8, light above 1 clips). The resolve, the ½…1/16 chain and the composite are
  half-float too.
- **Bloom without a threshold.** A share of every pixel's light spreads (`GRADE.K`·¼ over the four levels), so only what
  is far brighter than paint (the sun, plume cores, fireballs, lamps at night) shows a glow. The first downsample weights
  its taps by 1/(1 + exposed luminance) (Karis), so a lone hot pixel doesn't flicker. Low: no glow; the 1/16 level is
  made in one sparse pass, for the exposure only.
- **Auto-exposure** (`EXPO`). The 1/16 level is read back through a pixel-pack buffer and a fence (a frame or two late,
  never a stall). It gives the centre-weighted log-mean luminance L (each pixel floored at 0.03, so black space or a dark
  room counts as dim, not as nothing) and the 98th percentile H. E = (0.35 / L)^0.55, at most 2.4 / H (highlight
  priority: a sunlit planet in black space, the paper under the desk lamp), within 0.25–4, eased in log over ~1 s.
  Partial adaptation (the 0.55): night stays darker than day, and the plume's glare still darkens the sky. L and H are
  read before E, so there is no feedback loop. `expoNow()` settles E at once (a blocking read), for `bare()` in the
  reference views; never in play. `refset.mjs` logs `{E, L, H}` per view.
- **The composite** (`COMP_FS`): bloom added in linear light, ×E, a vignette (−20 % in the corners), **AgX** (Sobotka's
  curve, Wrensch's fit; fire keeps its colour on its way to white, where ACES went flat orange), then the **grade**, a
  32³ LUT built from `gradeFn` (D18.1, 1960s press photography: a per-channel logit S of 1.4 puts the contrast back into
  AgX's soft curve, saturation ×1.12, highlights warm, shadows toward blue-black), then **grain** (triangular, mostly in
  the mid-tones, 3.5 %), which also dithers the 8-bit output (the sky's own dither is gone). One LUT for now; a LUT per
  era later (`GRADE`).
- **A NaN guard.** A couple of mesh pixels come out NaN (a degenerate normal somewhere); the old clamp hid them, the HDR
  chain spread them into 1/16-size black squares. `fin()` zeroes NaN and ∞ by their bits (D3D compiles `isnan` away) in
  the bloom taps and the composite, and the mesh output is `max(c, 0)`. The source isn't found; it's one black pixel now.
- **Stills** (RTX 3050, High): before `output/launchpad/beauty/q314-before/` (31 views on the previous main); trials
  `q314-try3/` and the sheets `q314-ab-try3-*.png` (before left, after right). Daylight reads as before, a touch softer and
  grainier; the night pad shows its floodlit apron (E = 4); the fireball keeps its colour instead of a white disc; the desk
  and the orbit views hold their highlights; Selene's ground is a lighter grey. **The final tuning (98th-percentile H,
  FXK 0.8, saturation) was not shot**: the full after set was stopped for low memory at 4 of 31 views. Still to measure:
  Low on the iGPU (Low now pays a float target and the composite) and the map view's lines.
- **Checks:** test `aerofx-10` (no shader tone-maps itself; the RGBA16F target on both settings; one composite with
  AgX, the LUT, exposure and grain; the exposure read back without a stall; map lines and `bare()`). TESTING 219.

## v1.149 — re-entry: the hull glows, the plasma in HDR (2026-10-12, effects beat, QUEUE Q318; BEAUTY B4.1–4.2)
- **What drives the glow: the skin, not the part.** A headless study (three entries, scratch, 2026-10-12) found the
  sim's `p.T` never gets near glowing: it is the part's bulk, a lumped thermal mass. Peaks: a heat shield 700 K (Selene
  return), a bare pod 922 K (low orbit); a blackbody is invisible below ~1,000 K. Real shield *surfaces* run 1,500–2,800 K.
  So the glow follows the plasma's heat level k (`plasmaHeat`'s scale: about 1 at the peak of a low-orbit return, 1.5
  coming back from Selene, above 0.05 for 340–380 s of a low-orbit return and 95 s of a lunar one). A new mark,
  **`hot`**, holds the windward skin's surface temperature, `wallT(k) = 700 + 1000·k` K (290 K without plasma). It heats
  over ~2 s and cools over ~6 s (`hotTo`), on the ship (`marksTick`) and on falling stages (`debrisHeat` keeps `g.k`).
  The plasma's k also feeds the char direction `cd`, so a part whose bulk stays cool still knows its windward side.
- **The shader** (`MESH_FS`, the marks block): `uHt[24]` = four parts' `hot` per vec4. The local temperature is `hot`
  on the face meeting the flow, half of it on the sides (`dot(vNo, cd)`), ±5 % noise streaked like the char. Emission
  is a blackbody in the scene's units: 1 = 8,150 cd/m², because the sun in space is 5 and sunlit white paint ≈ 4. Per
  channel it is a Wien fit to Planck → CIE → linear sRGB, `exp(a − x/T)` (a = 16.46, 17.03, 20.83; x = 23,014, 26,819,
  41,004 K), within 1 % (r) and 10 % (g) over 1,000–2,800 K. Blue is loose but tiny below 2,000 K. ×0.85 emissivity.
  It is steep, as the physics is: 1,000 K is 3e-4 (nothing), 1,200 K 0.015 (a dull red only the night shows), 1,700 K
  5.5 (out-glows sunlit paint, orange), 2,200 K 150 (yellow-white, blooms). It costs one exp per pixel on hot parts only.
- **The plasma's colours** (`PLASMA_FS`): `core(k)` at the stagnation point, orange at low k turning white-yellow; `edge(k)`
  off the hull, rose turning lavender as it heats (Orion's and Dragon's footage); the wake leaves the hull in the
  ablator's orange and turns rose to lavender within 0.3 of its length. Brightness: the sheath ×7 (was 3) and the wake
  ×0.5 (was 0.35), `PLASMA_SH`/`PLASMA_WK`, so a lunar return's sheath blooms against the day. `plasmaLight` takes
  `core(k)`'s colour.
- **The reference views heat the skin:** the entry views (40–47) fly the descent with `advPhys` and freeze the clock, so
  `marksTick` never ran (the skin sat at 202 K). They now run four 5 s mark ticks before the shot.
- **What you see:** shield-first and seen from upstream, the shield is a white-yellow disc in a bloom. From the side the
  sheath is warm at the hull and the trail lavender. Nose-first at 35° (view 44), the windward flank glows orange. In
  view 45, at ~50° to the flow, the shield sits on the lee side and stays dark, which is right. High up (view 103, k ≈ 0.3)
  the trail is rose where it was orange.
- **Stills and cost** (RTX 3050): `output/launchpad/beauty/q318/`, with the before/after sheets `cmp_*.png` (views 40, 44–47,
  103), `a2_grid.png`, the upstream shots `f46_grid.png`, and `prof-{before,after}-{high,low}.out`. Full-res frame 4.4–6.8 ms
  either way; the ship pass 0.01–0.03 ms and the plasma 0.2–0.6 ms before and after (noise). Not tried on the iGPU.
- **Checks:** test `aerofx-11` (wallT, the wiring, the blackbody's luminance and colour at 1,000/1,200/1,700/2,200 K, the
  plasma's core colour). TESTING 231.

## v1.150 — the craft's quick wins: bells, noses, smooth normals, the planet's light (2026-10-12, parts & pad beat, QUEUE Q315)

BEAUTY B1.1–1.2. All in `app/gl.js` (mesh build and `MESH_FS`'s lighting), plus the two places that set the mesh's light
(`render.js`, `deskLight`). Drawing only: the sim's outlines (`PARTS[...].prof`, `fairProf`) are untouched.

- **Smooth normals along the profile** (`latheN`, used by every `lathe`). Where two profile segments meet at under
  `SMOOTH_DEG` (24°), the vertex normal is their average; above it the edge stays hard (a shoulder, a flange, a cap). A
  duplicated point for a colour band doesn't break the curve. Every lathed part benefits: the gas bottle's domes, the
  fairing's shell (its seven points already curve), the capsule. `SMOOTH_FX = false` for an A/B.
- **Rao bells** (`raoBell`, in `engine`). The bell is a quadratic Bézier (a parabola) from the throat to the lip,
  tangent at the lip at θe, through a control point at height f of the bell, so it opens steeply below the throat
  (45–60°) and runs nearly straight at the exit. Per family `BELL_RAO` [f, θe°]: Wren [.55, 12], Sparrow [.6, 10],
  Petrel [.72, 8] (the vacuum bell flares hardest), Kestrel [.6, 9], Condor [.62, 7]. 8 points; same exit radius and
  throat as the part, so the plume, the gimbal (`setMoves`) and the bell's shader detail are unchanged. The colour and
  material blend lip → throat as the two-point bell's did. `BELL_FX = false`: the cone.
- **Ogive nose** (`ogive`, the `cone` part and `cone25`). A tangent ogive (tangent to the hull at its base, a point at
  1.6 m), 8 points plus the scorched tip's colour band; within ~2 cm of the old faceted cone, so the outline reads the
  same, only round. Only Beeper, Passenger Orbiter and the side boosters carry it; the capsules' cones are conical by
  design. `OGIVE_FX = false`: the old cone.
- **The planet as a disc of light** (`lightEnv` → `dsk`, `limb`; `diskOf`; `MESH_FS`). The ambient used to be a brown
  hemisphere below the craft at every height (the "ground" in orbit). Now the body below is a disc: `uDsk` = (sin α,
  cos α, the rim's width in the reflection) for its angular radius α, and its share of the light on a normal is
  sin²α·cos θ, wrapped past the rim ((cos θ + sin α)/(1 + sin α), clamped). At the pad (α ≈ 90°) that is exactly the
  old hemisphere, and the ground colour is the old one (test `aerofx-12`: 0.285 both). With height the colour blends,
  with the air's own scale (22 km), into **Tellus from above**, blue-white [.2, .26, .36] × the lit share (from the
  local sun at the pad to half the disc lit when it's small). In the hull's **reflection** the planet ends at its rim,
  blurred by roughness (rough metal sees it past its rim), with a thin **blue limb** (`uLimb`). From LEO the disc
  is 0.864 sin α, from 4,000 km 0.24. Near an airless body (`airlessFill`) the same disc in its grey. `PLANET_FX = false`
  brings the old brown hemisphere back (A/B).
- **Rough metal spreads the sun** (`c += sun·ndl·F0·metal·rough·0.6`). Found in the first after-shot: the Petrel's
  bell in orbit nearly vanished. Metals get no diffuse light, so its exterior showed only what it reflected, and it had
  been reflecting the brown hemisphere. Now it reflects black space and the planet below; the extra lobe keeps a sunlit
  bell legible. On the pad this brightens sunlit metal slightly.
- **Seen** (RTX 3050, High; `output/launchpad/beauty/q315-before/`, `q315-after/`, sheets in `q315-compare/`, before
  left): the bells are bell-shaped at the pad (`bell-cape-3x.png`, view 114) and from below (view 10); in orbit the
  shadow side takes a blue-white earthshine instead of brown, the Petrel bell reads (`orbit-3x.png`, `glow.png`, views
  3 and 14). Pad, max-q and booster views (1, 54, 56, 77, 154) look the same apart from the bells.
- **Measured** (RTX, full resolution, old code against new, back to back): pad 11.9 → 12.7 ms High, 11.3 → 11.4 Low;
  orbit 3.9 → 4.4 / 4.9 → 4.5; the Cape view 12.5 → 12.9 / 12.5 → 12.4. Within the run-to-run noise (±1 ms on a busy
  machine): no measurable cost, as BEAUTY § 5 expected. **Not measured: the iGPU** (low memory). Vertices: the bells
  go from 2 profile points to 8 (32 around), the nose from 6 to 10, nothing else changes count.
- **Not done:** self-shadowing, the surface pass and greebles are Q316; frost Q317. Picking (`hitPart`) and the shoulder
  sampling for vapor (`app/gl.js` ~702, ~721) still read the sim's outline (`prof`): the drawn bell bulges a few cm past it.
- **Checks:** test `aerofx-12` (the bell's shape and ends, the ogive, hard and smooth profile normals, the shader's disc
  and its uniforms on both setters, the pad's light unchanged, blue and smaller from orbit); `look`'s airless-fill test
  now builds `diskOf` too. TESTING 232.

## v1.153 — the flames, slice 1: vacuum plumes, sunlit exhaust, turbulent cores, Mach disks, a longer contrail (2026-10-12, effects beat, QUEUE Q319; BEAUTY B2)
- **Vacuum plumes stop being brown fog (B2.2).** The gas glow term (`uVa`) was as bright 20 m down a vacuum plume as at
  the nozzle, so a wide plume read as an orange-brown cone. The gas cools as it expands, so its own glow now falls as
  `(re/rb)^1.6` unless air mixes in and burns (`cool = mix(…, 1, uS.w)`): a vacuum plume glows only near the nozzle.
- **Sunlight on the exhaust (B2.1).** What you see of the rest is sunlight scattered by droplets, soot and alumina.
  The phase is half Henyey–Greenstein (g 0.7) and half isotropic, 18× brighter forward than back, so a plume between you
  and the sun lights up: the twilight "jellyfish" in miniature. It is `PLUME_SC` (0.5; 2 read as white fog) × density,
  coloured by `lightEnv(p).sun` and zero in a planet's shadow (`lit(p)`). At sea level the flame outshines it.
- **The sea-level core (B2.2)** brightens and dims with eddies scrolling down at jet speed (one more noise fetch), which
  also fray its edge; it no longer reads as a tube.
- **Shock diamonds (B2.3)** are ×1.6 and scaled by how far off design the nozzle runs (`clamp(|ln n|·0.8, 0.25, 1)`); the
  first cell has a Mach disk, a bright flat disc across the axis. Near design at sea level they stay faint, as they should.
- **Palettes (B2.4).** Kerolox wears a stronger dark curtain round the flame's root (the F-1's turbine exhaust: 2.2× over
  4.5 exit radii, was 0.8× over 3). Hypergolics puff brown at a fuel-rich start: `PROPS.hypergolic.pf` 1.6, with soot
  that absorbs blue (`so` 0.35, 0.75, 1.4); a steady hypergolic flame stays clean. No engine burns hydrolox yet, so its
  palette is untouched.
- **The plume light (B2.5)** is `PLUME_LK` 175 (was 110, set when the flame was capped at display white).
- **The contrail (B2.6)** runs to ρ = 0.006 (~33 km, was 0.02, ~26 km), with up to 4,000 puffs (was 2,500, which cut the
  trail short on a climb: 2,457 → 3,957 puffs at T+100 s). Puffs live 110–170 s (was 70–120). The wind turns with height
  (`h/6000 + 0.8 sin(h/2300)` rad about the local up) and peaks ×2.6 in a jet stream near 11 km, so the column kinks
  and shears. It was one step at 8 km.
- **Stills and cost** (RTX 3050): `output/launchpad/beauty/q319/`. `before/` and `t1`/`t2` are views 30–36 (`t1_cmp.png` with
  PLUME_SC 2, `t2_grid.png` at 0.5), `sc_cmp.png` the sea-level close-ups, `n_cmp.png` the pad, `ct_cmp.png` the contrail,
  `p-{before,after}-{high,low}/` the profiles. The plume pass costs +0.02–0.15 ms; smoke +0.0–0.7 ms with the longer
  trail (view 31, High). The whole frame in the vacuum views read 1.5–3 ms higher, all in bloom and untracked time (the
  GPU was shared with another session): measure again on a quiet machine.
- **Not done (QUEUE *Proposed*):** heat haze (High), one light per cluster side, hydrolox's palette (when an engine burns
  it), and a reference view of a long contrail at twilight.
- **Seen on the way:** views 60–67 (the plume on the pad) shoot the rocket over bare grass, with the floodlit apron far off
  at night; views 154–155 (max-q, staging) never leave the ground ("max-q 0.0 kPa at 0.2 km"). Both are on `main` as it
  was; QUEUE *Proposed*.
- **Checks:** test `aerofx-13`. TESTING 235.

## v1.154 — the air and the wake: vapor rings, the buffet, sparks, a ragged wake (2026-10-12, effects beat, QUEUE Q320; BEAUTY B3.1–3.2, B4.3–4.4)
- **Vapor collars as stacked rings (B3.1).** Each shoulder's collar is now four or five thin rings across its length
  (`fract(z / 0.2·zs)`), each with a soft front and a sharp trailing edge, and each ring's density flickers on its own (a
  noise fetch by ring index and time, ×0.45–1.55). Before, it was one smooth puff.
- **The camera shakes (B3.2, B4.4)** (`camShake`, applied to the flight camera's direction in `render()`): a buffet of
  0.0022 rad × q from 8 to 30 kPa, ×2.5 at Mach 1 (a Gaussian, σ 0.15), plus 0.0035 rad × the plasma's heat level in
  re-entry. Sines at 13–83 Hz on sim time, so the reference views stay repeatable and a pause holds it still. Off in the map,
  out of flight, and with `SHAKE_FX = false`. 0.003 rad at max-q near Mach 1, 0.0012 at Mach 2.
- **Sparks from the ship (B4.3)**, as falling stages already shed them: from the hot face, 45/s × k with a working ablator
  (hotter, `hot` 2.2) or 12/s of paint flakes without (1.4), at most 40 per tick, `fxPuff` 0.025–0.06 m. The smoke cap
  is 4,000 for these too.
- **The wake (B4.3)** flickers in ragged streamers: a noise ×0.55–1.45 scrolling down it at 11 per second.
- **The plasma light flickers (B4.4)** ×0.86 ± 0.14 (two sines), so the sheath's warm light on the hull, smoke and stages
  shimmers.
- **Not done:** the leading edges warming faintly at high Mach on the ascent (B3.2: the hull glow's skin temperature only
  follows the plasma); the radio blackout as silence (sound beat); Q250's clouds stay in Q250.
- **Stills and cost** (RTX 3050, High): `output/launchpad/beauty/q320/cmp.png` (views 46, 50, 51, 54 before | after). The
  vapor pass on view 50 was 0.5 → 0.19 ms and the plasma 0.58 → 0.57 ms on view 46: noise, as one fetch per sample was added.
- **Checks:** test `aerofx-14` (the rings, the shake's shape and repeatability, the wiring). TESTING 236.

## v1.155 — a structural failure shows: shards, a venting tank, a fireball (2026-10-12, effects beat, QUEUE Q294; PLAYTEST #75)
- **The sim** gains one hook and one log line at a failure (`sim/vessel.js`, before `detach`): `logEv('structure', …)` with
  the joint, the kind of load and how far over it went, and `HOOK.crack(s, p)` (a no-op by default in `sim/core.js`).
  Nothing else in the sim changes.
- **The page** (`HOOK.crack`, `app/state.js`): at the broken joint (p's base), 25 sparks and 20 grey shards fly out at
  6–30 m/s. A tank on either side of the joint breaks open. If it still holds over a fifth of its load and the air is over
  5 % of sea level, it bursts into a fireball, `HOOK.boom` sized `∛(kg/500)` within 0.5–3 (a full 8 t tank: 2.5). Either
  way it vents what's left as a white plume from its broken end (`VENTS`, `ventTick` from `marksTick`): over ~6 s,
  puffs at 15–40 m/s with the vessel's velocity. In air they linger 4–8 s; in vacuum they flash out over a second. It
  is render-side: the sim keeps the propellant where it was.
- **The tumble** was there already (`detach` spins the broken-off part at 1.5 rad/s).
- **Still to do:** the crack-and-groan sound (sound beat, QUEUE *Proposed*).
- **Stills:** `output/launchpad/beauty/q294/crack_row.png` (an Orbiter's 8 t tank broken off its decoupler at T+35 s, at
  0.2, 2 and 5 s; at 300 m/s the fireball is left behind the camera's frame within a fraction of a second).
- **Checks:** test `aerofx-15` (the sim calls the hook on a real break, core's broadside Orbiter at 600 m/s; the page's
  wiring). TESTING 237.

## v1.156 — a splash at splashdown (2026-10-13, effects beat, QUEUE Q267; PLAYTEST #67)
- **When:** the frame the sim sets `s.wet` (`seaCheck`'s splash verdict), once per flight (`S.mkSplash`), from `marksTick`.
- **What** (`splashFx`, `app/state.js`): 90–365 spray puffs thrown up at 3–12 m/s·k and out at 2–8 m/s·k, living
  0.6–1.5 s; and a ring of 64 puffs racing across the water at 5–8 m/s·√k for 2–3 s, half sunk in the sea so they read
  as surf. k = v/8 · √(m / 3 t) within 0.3–2.5, so a 3 t capsule at 8 m/s is 1. The puffs are inertial `fxPuff`s with
  no gravity, which is why they're short-lived.
- **Tried and dropped: a foam patch** of planet-fixed smoke puffs. Billboards can't lie flat: from above, one stood
  over the capsule like a small cloud. A foam patch and a dye marker belong in the sea's shading, with the swell the SIM
  heaves craft on (`SEA_SWELL`), which the sea doesn't draw yet. Both grow `SKY_FS` (the Q19 rule: pay with a cut), so
  they're QUEUE *Proposed* for sky & bodies / world.
- **Stills:** `output/launchpad/beauty/q267/sq_row.png` (a capsule at 12.5 m/s: 0.3 s, 1.2 s, 10 s); `sp_row.png` is the
  first, coarser try.
- **Checks:** test `aerofx-16`. TESTING 238.

## v1.158 — heat haze behind the nozzles (2026-10-13, effects beat, QUEUE Q319 B2.6)
- **What:** the air behind a nozzle firing in air shimmers. On High only (`HAZE_FX` in `QUAL.high`; Low's description
  says so). The composite (`COMP_FS`) reads the scene a little off where it falls on a jet. Bloom isn't shifted.
- **How:** while the plumes draw, `hazeAdd` projects each jet (up to four) into a screen segment. The segment runs from
  half an exit radius behind the nozzle to 1.1 plume lengths down, in aspect-corrected NDC, 2.4 exit radii wide at the
  top and 1.3 of the plume's widest radius at the bottom. Its strength is throttle × min(1, 3·p/p₀), so it fades out with
  the air. In the composite, inside a segment, the offset is two sine ripples, one across the jet and half as much along
  it, scrolling down it on sim time (still when paused, so the reference views stay repeatable). The amplitude is 5 %
  of the local half-width × (1 − d/w)², faded in over the first 8 % of the segment and out over its last 30 %.
- **Limits:** it shifts whatever is in front of the jet too (a tower in front of the flame shimmers a little); no depth test.
- **Cost** (RTX 3050, High, views 30, 34, 36 with `REF_EVAL` on and off): bloom plus composite 0.69–0.93 ms either way, which
  is noise. Stills: `output/launchpad/beauty/q319-haze/haze_sheet.png` (on | off | difference ×8; row 1 is frame-identical,
  rows 2–3 differ elsewhere because of random smoke and motion).
- **Checks:** test `aerofx-17`. TESTING 240.

## v1.159 — no bands at the terminator (2026-10-13, effects beat, QUEUE Q352; PLAYTEST #87)
- **Seen:** from orbit, a few broad stripes parallel to the terminator in the blue air just before the night side
  (reproduced 800 km up over the day/night line, looking down; stills `output/launchpad/beauty/q352/term_*.png`).
- **Not the sun-transmittance integral:** `sunTrans` at 24 samples instead of 6 drew the same bands
  (`t6_vs_t24.png`). Not the output either: 8-bit quantisation after AgX and the LUT makes many fine steps, and these
  were few and broad.
- **The cause:** `scatter` marches each view ray in 12 fixed steps and skips a step in the planet's shadow. Every pixel
  sampled the same fractions of its ray, so across the terminator the count of lit steps changed one at a time
  everywhere at once: up to 12 levels, drawn as stripes.
- **The fix:** each pixel starts its steps at its own offset (interleaved gradient noise, as the plume and plasma marches
  already do). The stripes become a fine static dither that the grain hides (`before_after_crop.png`). Two ALU in
  `SKY_FS`'s `scatter`; the sky pass measured the same in two alternating A/B rounds against `main` (views 97, 156,
  157: 1.45–2.02 ms on both). No step was added (the Q19 rule).
- **Checks:** test `aerofx-18`. TESTING 241.

## Q351 diagnosed — why mountains look bad from space (2026-10-13, effects beat, overflow; PLAYTEST #86)
- **Seen:** from 1,000 km over Tellus's highest ground (8.9 km), the range reads as crumpled white paper: lumpy grey
  shading on solid white, with a hard outline where it meets the cloud deck. Stills in
  `output/launchpad/beauty/q351/` (`m_col.png`, zoom `m2_zoom.png`). Found with a scratch view: the ship over the highest
  `terrainH` point, looking down.
- **The cause is the snow mask, not the lighting.** In `tellus()` (`SKY_FS`), snow and ice hold only on gentle ground:
  `steep = sst(.12,.3,slope)` keeps faces steeper than ~35° as bare rock, which is what gives a range its relief. But
  `slope` comes from `npf`, the normal from the height differences over `eps = max(fw·1.5, 1)`, filtered to the pixel's
  footprint. From orbit a pixel covers hundreds of metres, every slope averages out to gentle, the steep-face test never
  fires, and the whole range above the snow line turns snow. The relief shading left on it is the crumple.
- **Not the cloud edge:** the shell is drawn only in front of the ground (`tC < tH`), so peaks above it cut a hard
  contour. Letting the cloud lap 1,200 m up the ground at the hit point (tried, reverted) changed nothing visible here:
  these peaks stand 4–7 km above the deck, and the white is snow.
- **The fix belongs to world** (with Q251, relief normals at distance): carry how steep the ground is *inside* a pixel.
  For example, bake a slope-variance channel with the world texture and let `steep` use `max(slope, expected sub-pixel
  steepness)` as the footprint grows, so ridges stay rock and valleys and gentle shelves hold the snow. It grows
  `SKY_FS`, so pay with a cut (Q19) or fold it into Q323 (Tellus from above). QUEUE *Proposed*.

## v1.162 — a plume light per side of a wide rocket (2026-10-13, effects beat, QUEUE Q319 B2.5)
- **Before:** every burning engine fed one point light at their weighted middle, so a rocket with boosters lit its flanks
  and the pad as if from its axis.
- **Now** (`plumeLight`): when the engines spread over 2.5 m (a Heavy's boosters, a broad cluster), they split across
  their widest spread into two lights, `PLT.p/c` and `PLT.p2/c2`. Engines within 0.35 of the half-spread of the middle
  (the core) feed both at half weight, so the Heavy splits evenly (67 / 68 in view 54, was all in one). A single-core
  rocket keeps one light. `MESH_FS` and `SMOKE_VS` take the second light; the ground pool takes the total; an
  explosion's flash or the re-entry plasma, taking over the light when brighter, clears the second.
- **Seen on the way:** in the scripted reference views the kerolox igniter's green flash (`ignOf`) is sometimes still on
  at T+19 s, on `main` too, run to run: its timing there doesn't follow sim time. So the plume light reads green in some
  shots. A view nit, not touched.
- **Stills:** `output/launchpad/beauty/q319-lights/v56_ab.png` (main | this, by day; the light matters at night and on the pad).
- **Checks:** test `aerofx-19`. TESTING 244.

## Reference views 159–161 (2026-10-13, effects beat; no version: tooling)
- **159** view 46's shield-first entry from upstream: the shield's glowing face (Q318; views 40–47 never showed it).
- **160** the terminator 800 km up, looking down along the day/night line (Q352's bands).
- **161** a mountain range from 1,000 km: the ship over Tellus's highest ground, found on a 0.02 rad search (Q351;
  8,924 m today). Stills `output/launchpad/beauty/views159/`.
- **Not built: the ascent's leading-edge warmth** (BEAUTY B3.2, Q320's leftover). The skin stays near 400–600 K on a
  climb, and a blackbody there is invisible even at night (1,000 K is 3e-4 of sunlit paint, `aerofx-11`). Only a stylised
  tint would show it, against the doc's rule that every effect teaches something true. Left out on purpose.

## v1.166 — the space sky: the galaxy baked, sharp stars that twinkle, a small sun (2026-10-13, sky & bodies beat, QUEUE Q321)

BEAUTY B5, from the mock-ups `mockups/sky/` (Q253) and W39's picks and levels (Caio, 2026-10-12–13). `app/gl.js`,
`app/render.js`, `views.js`, `refset.mjs`.

- **The galaxy, a nebula and a spiral, baked once per program** (`GAL_FS`, `galBake`). A cube map (512² a face on
  High, 256² on Low; RGBA16F, or RGBA8 holding sqrt(20c) without float targets), mipmapped, on texture unit 12, drawn
  when the program's seed or the setting changes (~10 ms once). `SKY_FS`'s `galaxy()` is now one `texture()` call: the
  noise that was in its main per pixel is gone (Q19's rule: the sky shader shrinks). The bake is the mock-up's code at
  Caio's levels: the band 100 % (star clouds, dust lanes, a warm bulge, a few pink nebulae and blue clusters), the
  **nebula** at 7.5 % in the Hubble palette, the **spiral** at 4.5 %, both galaxies in one palette. Alpha holds the
  band's density, which the stars read.
- **Where the sights sit** (`galSights`, appended to `makeGal`, so every old seed keeps its band): the nebula 22° off
  the band's midline at a seeded point along it (nebulae lie along the band; Orion is ~20° off), the spiral 40° off
  (the zone of avoidance), a seeded noise offset and the spiral's roll. Each program has its own.
- **Stars** (`starsAt`): three layers on hashed cells, ~40 bright, ~300 medium, ~1,500 faint in a 60° frame, more
  along the band; brightness by a power law, colour by temperature, each a small sharp disc at least a pixel wide, a
  soft halo on the brightest. **The floor** (D18.2): `uStK = max(1, 1.2 / E)` lifts them when the exposure is low, so in
  daylight only the brightest stay. **The twinkle, on purpose** (Caio: "the stars currently twinkle, maybe we can
  preserve that"; the old twinkle was one-pixel stars shimmering, which sharp stars would lose): each star's brightness
  drifts on its own seed, ±35 %, a couple of times a second (`uStT`, `HOOK.fxT` in reference views).
- **The sun** (`sunAt`): a limb-darkened 0.27° disc, a tight glare and a faint veil; the four screen-fixed spikes are
  gone. The mock-up's 900× disc bloomed into a soft ball in the game (the composite's bloom has no threshold), so the
  disc is 250× and the glare smaller.
- **A/B:** `SKY_B5 = false` compiles the old galaxy, stars and sun back in (the shader recompiles; no bake).
- **Views:** 159 the program's nebula, 160 its spiral, each over the limb from the night side; `refset.mjs`'s set now
  ends at 160. (**Renumbered 172, 173** in Q392: these shadowed the effects beat's 159–160 in `views.js`, which came later.)
- **Seen** (RTX, High; `output/launchpad/beauty/q321-before/`, `q321-after/`, Low `q321-after-low/`): views 97–100 show
  the band with lanes and a bulge instead of a smooth smear, a field of coloured stars where there were almost none, the
  sun small; 156 the same over the limb; 159 the nebula a faint copper veil beside the band, 160 a small spiral alone.
- **Measured** (full resolution, before → after, ms): 3 5.1 → 3.8, 97 3.2 → 2.3, 98 2.8 → 2.8, 99 3.7 → 3.8, 100
  3.5 → 3.5, 156 3.3 → 4.6, 157 3.4 → 4.2, 158 6.6 → 7.4, pad 12.4 → 11.8: noise on a busy machine, no clear cost or
  gain. **Not measured:** the iGPU; the first-load time (`SKY_FS` lost its galaxy noise but gained three star layers).
- **Checks:** test `aerofx-22` (the nebula 22° and the spiral 40° off the band for five seeds; the bake, its unit and
  wiring; the new stars and sun; the old code behind `SKY_B5`); the galaxy-per-program test builds `galSights` too.
  TESTING 248.

## v1.168 — the vapor collar, calmer: one thin sheet, not bands (2026-10-13, effects beat; PLAYTEST #88)
- **Caio:** the air effects on ascent "look like several separate bands that show up for a short while", and are
  probably too white.
- **Why:** two things stacked. v1.154's rings (Q320) cut each collar into thin bands with gaps; and `hullShoulders`
  finds up to three shoulders per stack (the Orbiter: stations 27, 21 and 23, two of them nearly on top of each other),
  so the collars stacked down the body. Each collar was also near-opaque white and puffy: up to 2.1 hull radii wide with
  a lumpy rim.
- **Now:** one shoulder per stack, the strongest, plus others only if as strong (≥ 90 %) and over 4 stations apart.
  The collar is one sheet, 1.06–1.66 hull radii (rim noise ±8 %, was ±30 %), streaked round its circumference along the
  flow and flickering as a whole. It is a thin mist: density ×1 (was ×3), colour 0.86–0.92 at 0.95 of the sun (was
  0.95–0.98 at 1.25). The Mach window is unchanged (0.84–1.28 below 15 km): it is a few seconds of the climb, as in
  life.
- **Stills:** `output/launchpad/beauty/pt88/` (`z53b.png` close: before | after; `ab_50_54.png` wide; `after/` is the
  first try, one collar per shoulder with streaks, still two bands).
- **Checks:** test `aerofx-14` now checks the single streaked sheet, the thinner mist and the shoulder filter. TESTING 250.

## Q326 — where the sky's time goes at the pad (2026-10-13, sky & bodies beat; measurement, no game change)

The question (Q313's profiler): the base sky is ~5–6 ms of a 7–12 ms frame at the pad; which part, so Q322's table and
Q19's terrain pass aim at the bigger one. **Method:** one part of `SKY_FS`'s main stubbed at a time, the sky program
rebuilt in the running page (`REF_EVAL`), the sky pass timed by `REF_PROF=1 node refset.mjs` on views 4–7, 63, 80, 101
(RTX 3050, High, full resolution). The driver and its eleven variants: `output/launchpad/beauty/q326/` (`variants.txt`,
one log each). Noise between runs ≈ ±0.2 ms.

| Stubbed | Sky pass, mean ms | Saved |
|---|---|---|
| nothing (base) | 7.37 | — |
| **the ground: march + all its shading** (`tP = 1e30`) | 2.70 | **4.68** |
| the volume cloud shadow on the ground (`cloudShadowV`) | 6.02 | **1.36** |
| the ground's albedo (`tellus()`) | 6.33 | 1.04 |
| the terrain normal (two extra `terr` samples) | 6.95 | 0.42 |
| `scatter` (the air's in-scatter loop) | 7.01 | 0.36 |
| the cloud deck's shell | 7.09 | 0.29 |
| scrub and pad, detail, cities, sun transmittance | 7.3–7.6 | ~0 (noise) |

- **The ground is 4.7 of 7.4 ms.** Its shading parts add to ~2.8, so **the march itself is ~1.9 ms**.
- **`cloudShadowV` is the second biggest single part (1.4 ms):** five steps toward the sun through the cloud volume
  for every ground pixel (Q65). It changes slowly; baking it into a 2D texture with the coverage (`covBake`) once a
  frame, or every few, would make it a lookup.
- **`scatter` is small at the pad (0.4 ms).** Q322's transmittance table is still worth it for the limb, the night side
  and moving Selene out of `SKY_FS`, but it won't buy the pad's frame time back.
- The rest of the pass without the ground (~2.7 ms: the air along the whole ray, the sky, the stars, the deck) is the
  floor a terrain pass can't touch.
- **Aim:** Q19's terrain pass at the march (it moves the march into its own full-resolution pass; that pays for the
  link time, not by itself for the frame: the march needs to get cheaper there, e.g. coarser steps far away or half
  resolution with a depth-aware upsample like the cloud slab's); a new item for the volume shadow's bake; Q322 keeps its
  place for the look, not the pad's time.
- Not measured: Low, the iGPU (the shares should hold, the totals won't).

## v1.170 — an incoming fragment and its strike; no more black puffs in vacuum (2026-10-13, effects beat, QUEUE Q302)
- **The fragment** (`HOOK.fragIn`, `FRAGS`, `fragDraw`): the sim rolls a hit 3 s ahead and hands over its size, crossing
  speed and direction (space's Q200). A centimetre fragment kilometres off is invisible, so it's drawn as what an eye
  might catch: a sunlit glint streaking in on its path, a line 0.06 s of its travel long (≈ 500 m at 9 km/s), brighter
  for a bigger piece (×0.25–2 by size against 4 cm) and as it closes (×0.3 → 3), dark in a planet's shadow, drawn with
  the line shader in the additive pass after the plasma. At the strike: a flash (a hot puff 0.5–1.1 m, 0.12 s) and
  20–44 sparks off the face it hit. A strike while nobody's looking (the map) is dropped, not flashed late.
- **Found on the way: every smoke puff in vacuum rendered black.** Reference views (and any frame before the first physics
  step, e.g. after a load) have `S.qHeat` unset, so `plasmaHeat` returned NaN, and `plasmaLight`'s `qE <= 1.5e4` let
  NaN through. That made the shared plume/plasma light (`PLT.c`) NaN. The mesh shader skips it by accident (NaN > 0 is
  false); the smoke vertex shader doesn't, and the composite's NaN guard painted each puff black (staging sparks, a
  venting tank, a strike flash in orbit). `plasmaHeat` now treats an unset flux as 0, and `plasmaLight` tests
  `!(qE > 1.5e4)`.
- **Stills:** `output/launchpad/beauty/q302/k_row.png` (the streak side-on from 5 km at 0.5 s and 0.2 s out; the flash on
  the struck face); `alt_ab.png` (the black puffs at 200 km against bright ones at 50 km, before the fix).
- **Checks:** test `aerofx-20`. TESTING 252.

## v1.172 — a falling stage under its chutes, its splash, and the waterline (2026-10-13, effects beat, QUEUE Q335)
- **Canopies over a falling stage** (`debrisCanopies`, from the debris draw in `render()`): while the sim's `d.chA` is open
  (Q300, v1.142: chute parts among a spent stage's parts open by themselves), one canopy per chute part. Each is sized
  from its share of `d.chA` (a 600 m² main is ~28 m across) and trails up the airflow from its chute on risers ~1.3
  diameters long, spread a little apart when there are several. The ship's own canopy is unchanged.
- **A stage that comes down in the sea splashes** (Q267's `splashFx`) once, at the speed it had the step before it
  floated (`d.mkV`).
- **The waterline:** anything afloat (a spent stage, `d.float`; the ship, `S.water`) laps the sea round its hull with small
  white puffs half sunk at the surface, ~12 a second, living ~2 s, round an ellipse the hull's length long when it
  lies on its side (`surfFx`).
- **Stills:** `output/launchpad/beauty/q335/c_ab.png` (a 1 t stage under its 600 m² main at 2.2 km; the same stage
  afloat with its surf).
- **Checks:** test `aerofx-21`. TESTING 254.

## v1.174 — the effects' sounds: a crack and groan, a venting hiss, the splash, the blackout's edges (2026-10-13, effects beat as sound overflow, QUEUE Q363, Q362)
- **One-shots from the page** (`FXSND`, played by `sndFx` in `sndTick`, heard like booms with `sndBoom`'s law: through our
  own structure at full, else through the air at the source, late (d/340) and duller with distance):
  - a **structural failure** (`HOOK.crack`): a 0.18 s high crack with a 90 Hz thump, and a metal **groan** (`sndGroan`: a
    sawtooth sliding 95 → 48 Hz under a lowpass, a 7 Hz wobble, ~0.9 s). Sized by √(mass / 5 t).
  - a **splash** (`splashFx`, the capsule's and a stage's): a 1.3 s whoomp of brown noise sweeping down to 120 Hz on a
    38 Hz thump, sized by the splash's k.
- **A venting tank** (Q294's `VENTS`) hisses (a 2.6 kHz highpass layer, `AUD.VH`). Its level is `sndVent` in the pure mix
  block: √(what's left of the first flow), through our structure even in vacuum, from elsewhere only through the air
  (×250/(250+d)).
- **The radio blackout (Q362):** the game has no radio bed to fall silent, so the blackout sounds at its edges, from
  `plasmaOn(S)` (world's link rule). Going in: a 0.45 s burst of band-passed static that cuts dead. Coming out: a short
  squelch and a 0.25 s **Quindar tone** at 2,525 Hz (the beep that keyed Apollo's voice loop).
- **Checks:** test `sound-2` (the vent's levels and the wiring); in the browser every path ran without an error with
  `sndInit()` forced (the headless audio context stays suspended, so nothing was heard there). TESTING 256.

## v1.176 — Tellus from above, slice 1: clouds you can see through, the sea's sheen, lights without shimmer (2026-10-13, sky & bodies beat, QUEUE Q323)

BEAUTY B6.1, 6.3, 6.4 (and Q268's sea from altitude). `app/gl.js` (`cloudCovF`, `tellus()`'s sea, `SKY_FS` main's sea
and lights, the city texture), `sim/space.js` (`cloudAt`), `views.js` (view 80's search).

- **Why Tellus was a white swirl from mid orbit (p2, view 157).** At full detail the planet is ~87 % clear
  (`cloudAt`, the CPU copy: mean cover 0.11). The far-field filter in `cloudCovF` widens the threshold window as a
  pixel's footprint grows, but lopsidedly (its low edge fell 0.3, its high edge rose 0.12), so a blurred pixel came out
  about 4× cloudier than the ground under it; and it started widening at 60× the footprint, which at 4,000 km
  flattened weather cells ~30 pixels wide. Now it widens **evenly** about the same centre, starting at 15× (when the
  finest octave, ~1/220 of the radius, is under a pixel).
- **The cover itself:** a milder stretch (×1.25 along y, not ×1.8: fewer east–west streaks), a large-scale patchiness
  term (clear holes between systems), **mild latitude belts** (a wetter equator, clearer subtropics, the storm tracks).
  **`cloudAt` carries the same formula**, so scrubs and photo windows follow the drawn weather. Measured on 3,000
  points × 5 times: mean cover 0.11 → 0.12; clear (< 0.35) by |latitude| 0–12° 86 → 81 %, 12–33° 87 → 94 %, 33–58°
  87 → 81 %, 58–90° 87 → 81 %; **scrub odds** (cover > 0.9) at 5° 5 → 8 %, 15° 3 → 1 %, 28° 3 → 2 %, 45° 5 → 5 %,
  62° 4 → 10 %. A balance change for high-latitude and equatorial pads (FLAG for economy in QUEUE *Proposed*).
- **The sea** (Q268's first half): Fresnel sky light (brighter toward the limb) and a Beckmann sunglint (slope 0.18, a
  wide patch, not a pin); colder seas a little greener. **Not seen in the stills:** no view puts the glint in frame
  under the current exposure (below); the swell and whitecaps close up stay with Q268.
- **Night lights:** the city texture has mips now, read at the pixel's footprint (`textureLod`, a texel is ~3.9 km),
  so they don't shimmer from orbit and have no seam where `atan` wraps; a warmer sodium colour.
- **View 80** (clouds from the pad): its weather search now starts one step in. At step 0 nothing has moved since
  setup and the near deck shows a stale coverage bake (clear sky under a 0.72 cover); at the next step it's right.
- **Seen** (`output/launchpad/beauty/q323-before/`, `q323-after/`): p2 shows separate weather systems with clear sea
  between them instead of a white veil; from 200 km (view 3) clear gaps and the land at the edge of the deck; the pad
  and the deck views unchanged in look. GPU ms within noise.
- **What still stops p2 reading as a planet: the exposure.** Sunlit cloud is ~4.6 in scene units, so the frame wants
  E ≈ 0.3–0.4; the meter reads the 1/16 bloom level, where a disc on black space is diluted (H ≈ 0.9), and sets
  E ≈ 2.7. The disc is ~7× overexposed: the sea goes pale, every cloud clips. Tried: halving the air's in-scatter
  (exposure compensates, E 2.74 → 3.03, no change); lowering the highlight cap (E 1.37, slightly darker, clouds still
  clipped). The fix is in the meter (effects, Q314's `EXPO`): a highlight reading at full resolution, or the disc's own
  brightness. QUEUE *Proposed*.
- **Checks:** test `aerofx-23` (the shader's and `cloudAt`'s formulas alike, the even filter, the sea and the lights);
  core 16's cloud check holds (mean 0.12, clear at 345/400, moving). TESTING 258.

## v1.180 — the exposure reads the brightest spot, not the blur: a planet on black exposed for its clouds (2026-10-13, sky & bodies beat, QUEUE Q385)

Effects' Q314 meter (`app/gl.js`: `BLOOM_FS`, `bloomEnd`, `EXPO`, `expoMean`), taken by this beat while effects was idle.

- **The fault (Q323):** the highlight term H (the brightest 2 % of the frame may not pass hi/E) was read from the 1/16
  bloom level, a blur. A disc of small bright clouds over a dark sea blurs to ~0.9 there, so view 157 (Tellus from
  4,000 km) was exposed at E 2.74: the sea pale, the clouds clipped.
- **Now:** the chain's alpha carries the brightest spot down to 1/16 (the first step takes the luminance of the 2×2
  full-resolution texels under it, each later step the max of its 2×2 alphas; the Low pass's single step a 4×4 grid of
  its 16×16 block), and H is the 98th percentile of that. **hi 2.4 → 2** with it.
- **Measured on 29 views** (`output/launchpad/beauty/q385-meas/`, old H and the brightest-spot H at once): the new H only
  binds where something bright sits on black or fills the frame's top: view 3 (200 km) E 1.38 → 0.78, 156 (orbit
  sunrise) 1.96 → 1.20, **157 2.74 → 0.93**, 90 (a fireball) 0.70 → 0.48. The pad, the complex, ascent, max-q, fin
  vapor, the clouds, entry, night, the desk, Selene and the space sky keep their E (their limit is above the E they use).
- **Seen** (`q385-meas/` before, `q385-after/`): p2's sea is blue and the clouds have shape; from 200 km the limb and
  the deck no longer wash out; the fireball keeps its core and the sky behind it deepens. Fixed E 0.5 and 0.75 for
  comparison in `q385-E0.5/`, `q385-E0.75/` (0.75 a little deeper still: a taste call if wanted, `EXPO.hi`).
- **Cost:** four `texelFetch` per bloom texel (sixteen on Low's one pass); within the GPU noise.
- **Check:** test `aerofx-24` (the chain's alpha, and `expoMean`/`expoTarget` on a synthetic frame: a disc blurred
  0.9, brightest 2.2, on black → E = 2/2.2). TESTING 262.

## v1.181 — the sunglint at full strength, and a view that shows it (2026-10-13, sky & bodies beat, QUEUE Q387)

- **View 162** (`views.js`): the ship 400 km over open sea (≥ 1 km deep, the clearest sky on a 0.02 rad ring) with the
  sun 40° up, the camera behind and above looking down toward the sun, where the sea mirrors it.
- **Found:** v1.176's Beckmann glint carried a stray ×0.25, so the patch rose barely above the air's in-scatter and no
  still showed it. Without it the glint is the BRDF × cos on the same scale as the diffuse sea (both leave out π): a
  wide silvery sheen on the open sea, as in photos from orbit. Views 1, 3, 146 unchanged; p2 (157) gains a soft
  highlight on the disc. Stills `output/launchpad/beauty/q387/`.
- **Check:** test `aerofx-25`. TESTING 263.

## v1.183 — Q322 slice 1: the air's transmittance from a table, and airglow on the night limb (2026-10-13, sky & bodies beat; BEAUTY B6.2)

`app/gl.js` (`SKY_FS`: `trL`, `sunTrans`, `scatter`; `TRL_TEX`; `drawMoons`), `app/render.js` (the uniform), `views.js` (163).

- **The table:** `TRL_TEX`, 256 (μ) × 64 (r) RGBA16F on texture unit 13, baked once in JS at load (64 midpoint steps
  per texel, the shader's Rayleigh and Mie coefficients), in Bruneton's layout (r by the distance to the horizon ρ, μ by
  the distance to the top of the air), so the horizon gets most of the texels. `trL(r, μ)` reads it; `sunTrans` is one
  read (was 6 steps), and `scatter`'s light toward the sun is one read per view step (was 4 steps × 12). Below the
  horizon (μ < −ρ/r) the ground hides the sun, faded over its half-width.
- **More exact, not only cheaper:** against a 20,000-step integral the table agrees to 0.001 at every height and sun
  angle tried; the old 6-step march let 3–7 % too much light through near the ground (h 20 m, sun 40°: blue 0.727 old,
  0.674 table, 0.673 exact). Lit ground and clouds are a touch dimmer and warmer; side by side the views look the same.
- **Sky pass, ms** (RTX 3050, High, full resolution, before → after in the same session): pad 6.81 → 6.58, ascent
  4.19 → 3.58, 200 km 4.50 → 3.58, night pad 6.62 → 6.26, clouds 0.2 km 6.32 → 6.05, 8 km 4.57 → 4.07, max-q 4.02 → 3.78,
  sunrise 2.66 → 2.19, the spiral 3.12 → 1.85, sunglint 5.15 → 3.20. As Q326 said, the pad gains little (the ground
  dominates there); in flight and in orbit 0.3–1.9 ms.
- **Airglow:** oxygen's green line from a layer ~85 km up (5 km wide above, a 3 km fade below), from the ray's closest
  approach: a ray grazing the layer looks along ~20× its thickness, one looking down crosses it once (a floor of 0.05);
  only where the layer is in the night. **View 163** (the night limb from 400 km): a thin green line over the dark
  limb with black between, as in the photos from orbit. Day views unchanged.
- **Left for slice 2:** Selene out of `SKY_FS` into the moon pass (Q250's aliasing from low orbit, opposition surge,
  earthshine, a harsh terminator). Seen in passing: the night side from orbit is fairly bright at the exposure's
  ceiling (E 3.86: the ground's ambient term), not this item's.
- **Stills:** `output/launchpad/beauty/q322-before/`, `q322-after/`. **Check:** test `aerofx-26`. TESTING 265.

## v1.187 — the bright stars' halo no longer cut at a cell's border (2026-10-13, sky & bodies beat, QUEUE Q399, PLAYTEST #96)

- **Cause** (design desk's reading, confirmed): `starsAt` (Q321) shades each pixel from the star in its own hashed cell;
  the brightest layer's halo (e-fold 5 px) reached past the cell into cells that never draw it, so it ended in a
  straight line on one side.
- **Fix:** the halo is drawn from the 2×2×2 cells nearest the pixel (`floor(d·90 − 0.5)`), each star kept by the band
  at its own place (one `textureLod` of the baked sky, only for the rare candidate cells), and fades to nothing within
  half a cell, which those eight cells always cover. The disc is untouched. A first try with 3×3×3 cells and a 1.2-cell
  fade cost ~0.45 ms in star views (97, 99); the eight-cell form is within noise (A/B in one session, 1.1–1.4 → 1.25–1.3).
- **Seen** at E 12 (to make halos plain): before, halos cut square on one side; after, round and soft
  (`output/launchpad/beauty/pt96-before/`, `pt96-after/`; at normal exposure `pt96-normal/`).
- **Check:** test `aerofx-27`. TESTING 269.

## v1.190 — clouds at liftoff without the crawl: the day sky's hatch gone, cloud detail filtered by size (2026-10-13, effects beat, QUEUE Q250, PLAYTEST #48)

`app/gl.js` (`SKY_FS`: `scatter`, `cloudDens`, the shell's billow detail; `SLAB_MAIN`).

- **How it was measured:** the Orbiter's liftoff under ~45 % and ~60 % cover, the default chase camera, frames rendered
  in pairs 1/30 s apart (grain off) and differenced, at 0.4, 0.9, 1.7, 2.4 and 3 km. Stills only show some of it: the
  crawl is in the motion.
- **The biggest crawl today, mine (v1.159, Q352; two days after the report, so not what Caio saw on 10-10):** `scatter`'s 12 view-ray steps each start at a per-pixel offset. From the
  ground the first step is tens of km long and spans most of the air's density, so the offset drew a fixed diagonal
  hatch over the whole day sky (clear or cloudy), which crawled as the rocket climbed. Now the offset only applies from
  15–50 km up (`smoothstep` on the camera's height); lower, every pixel starts mid-step as before Q352. The terminator
  from orbit (what Q352 fixed) is unchanged. Sky flicker between paired frames at 0.4 km: 3.8 → 1.5 (mean, 8-bit),
  at 0.9 km 1.4 → 1.0; the hatch is gone from view 1's sky.
- **The deck's billow detail by footprint:** the shell's two near octaves (2.5 km, 820 m) fade once a pixel's footprint
  on the deck outgrows each (`fm`), keeping their mean, so a deck seen edge-on far away doesn't draw sub-pixel lumps.
- **The volume's finest noise by step length:** `cdLod`, set per step in `SLAB_MAIN`, fades `cloudDens`'s 230 m octave
  where the march's steps pass 230–700 m (far along a grazing ray). The clouds look the same up close; far edges are a
  touch softer. `cloudShadowV` keeps the full noise (cdLod 0).
- **What the report saw is not settled:** the two filters above are the clouds' own aliasing as measured, and they are
  small. #48 stays open for a look in play (TESTING 272).
- **Not the clouds, filed:** (1) thin slivers that pop above the hazy horizon from ~1.5 km stay with the clouds and the
  shell off: far terrain grazing the horizon (world). (2) Inside the deck at 2–3 km, a bright band at the horizon with
  2×2 stair edges: the volume fading out at `uVD` and the half-resolution upsample. (3) The white specks past the coast
  are the buildings of a town, not clouds.
- **Harness note:** `tNow()` jumps to the launch day at the first `advPhys` after launch (`S.rec.day0`), so a script
  that picks the weather before flying must re-pin `CLOUD_DT` after the first step (views 81–83 pick it after).
- **Stills:** `output/launchpad/beauty/Q250/` (`liftoff_before/after`, `flicker_before/after`: the frame-pair
  differences ×6, `view1_before/after`). **Check:** test `aerofx-28` (and `aerofx-18` amended). TESTING 272.

## v1.191 — the igniter flashes when the engine lights, not when it is first drawn (2026-10-13, effects beat, QUEUE Q368)

`app/gl.js` (`spoolOf`, `SPOOL_F`, `spoolFrame`), `app/render.js` (`render` keeps the frame clock).

- **Why it flashed at T+19 s:** the plume's spool, which stamps the ignition time the igniter flash and the fuel-rich
  start read (`ignOf`), only moves when a frame draws the plume. The reference views step the physics to T+19 s (or
  T+30 s) without drawing, so the first drawn frame met an engine it took for just lit. Whether the page's own loop
  happened to draw a frame in between varied run to run. View 56 also inherited view 54's last frame: a new flight
  starts the clock again, and 54 and 56 end at nearly the same sim time.
- **Now:** `render()` keeps the previous drawn frame's sim time; a spool unseen for more than 0.5 s of sim time (or
  new since then) takes its target directly, with no flash, rich start or cutoff puff, and the clock going back forgets
  the last frame. In play every frame draws, so a launch flashes as before; an engine lit while the map was open no
  longer flashes late on return.
- **Measured** (flash or richness at capture, two runs each): views 54, 56, 2, 55 were 1.6 / 1.1 / 1.4 / 1.0, now 0
  (view 56 every run); 60, 61, 153 are 0; the ignition views 68–72 (drawn every step on purpose) still flash and fade
  with age: 2.1, 1.6, 0.9, 0.2, and 2.0 at night.
- **Check:** test `aerofx-29`.

## v1.194 — Q322 slice 2: Selene out of the sky shader, filtered craters, regolith light and earthshine (2026-10-13, sky & bodies beat; BEAUTY B6.5, Q250's Selene half)

- **What moved:** `SKY_FS`'s main still intersects Selene (one `sph`: the air in front and the depth need it) but no
  longer shades it. It writes the air in front and, in the scene's alpha (unused until now), how much of Selene the
  clouds let through (`vis`, multiplied by the shell's and the slab's cover). The moon pass (`MOON_FS`, `drawMoons`, which
  drew only Nyx) now shades Selene too (`uSel`) and adds it on top with `blendFuncSeparate(DST_ALPHA, ONE, ZERO, ONE)`,
  depth untouched; its air is the transmittance table (`trL`, a chord through the air = `trL(closest, 0)²`). Nyx
  stays opaque and depth-tested. With no scene target the default framebuffer's alpha is reset to 1 after the pass.
- **Aliasing (PLAYTEST #49):** from Tellus Selene is a 12–13 px disc, and its two crater octaves (18 and 55 cells per
  radius) and the relief's fixed 1.4 km finite difference were all far finer than a pixel. Now every crater octave and
  fbm octave fades to its mean once its cells near a pixel (`smoothstep(.25,.6, footprint × frequency)`, footprint in
  radii, stretched by 1/μ toward the limb), and the octaves go on down close up (`MOON_OCT`: Selene 5 from 12.6 cells
  per radius ×3, Nyx 4). The seas are filtered loosely (`w·.6`): they are what a small disc shows.
- **The old night side was lit:** the relief term added `slope·0.8` with `ndl` clamped to 0, so every crater rim on
  the night side caught the sun (views 164–166 before: a speckled night side; at 13 px, the shimmer). Now the relief
  lights only within ~7° past the terminator (`smoothstep(-.12,.05,e)`): a harsh terminator.
- **Cost:** a first form (6 octaves of `crat`, 27 cells, a second evaluation for the slope) cost 5–6 ms with Selene
  filling the screen, for 2.7 ms saved in the sky pass. `cratG` returns the crater height and its gradient in one pass
  over the 2×2×2 nearest cells (radii .12–.34 of a cell so the rim stays under half a cell; cells 1.43× larger so the
  craters keep their size): sky + moon pass at 158 3.97 → ~2.7–3.3 ms, 112 3.10 → ~2.6–2.8, 166 4.47 → ~2.9–3.2
  (RTX 3050, full resolution, a busy machine: ±0.5). Views without Selene unchanged (1, 3, 157: twinkle-level diffs).
- **Light:** McEwen's lunar-Lambert (L(g) cubic in the phase angle; a full Selene is a flat disc), an opposition surge
  (B0 .6, width .05: the bright patch round the craft's antisolar point in 112 and 158), earthshine from Tellus's lit
  face by its phase as seen from the ground, with the relief. Real earthshine is ~1/4000 of the sun, under what
  `EXPO` (×4 at most) can show, so it's ×100: a night side under a full Tellus is a dim grey (view 166). The mesh fill
  (`airlessFill`) still has a constant sky term, not earthshine: a lander there is darker than its ground (*Proposed*).
- **Not checked by eye:** clouds in front of Selene (168 found no cloud on its ray); the alpha path is by construction.
- **Views:** 164 from 1,000 km over the terminator, 165 from low Tellus orbit (12 px), 166 the night side by
  Tellus-light, 167 setting through the limb's air, 168 full from under the deck at night. Stills
  `output/launchpad/beauty/q322s2-before/`, `q322s2-after/`, regression `q322s2-reg-*`. Test `aerofx-30`. TESTING 275.

## v1.195 — the Steppe rollout's sound: the erector's rumble, rail joints, the boom's pump, the clunks (2026-10-13, effects beat as sound overflow, QUEUE Q222)

`app/sound.js` (`sndRoll` in the mix block, `sndRollEvents`, `AUD.RR`/`AUD.RH`, `SHOT.clack`/`clunk`, `sndTick`).

- **On the Rollout screen at a Steppe pad** (where `rollPhase()` runs; the master gain now opens there too), on the
  same clock the drawing uses (7 s on the rails, 5 s for the boom, 1.5 s for the arms):
  - **the car's rumble**, a brown-noise lowpass at 45–140 Hz, loudest mid-way, as the car is fastest (the drawing's
    smoothstep: still at both ends);
  - **rail joints**: a wheel crosses one every 12.5 m (9 over the ~118 m), a double clack each (a bogie's two axles);
  - **the boom's pump**: a sawtooth through a bandpass with a little hiss, climbing 120 → 230 Hz as the boom raises
    the rocket; the arms' rams after it, quieter at 260 Hz;
  - **clunks**: as the car reaches the buffers, the boom locks upright (the heaviest) and the arms close.
- Leaving the screen or restarting the rollout (another site) resets quietly. The levels sit under the engines'
  (rumble 0.5, pump 0.07 of the master) but **are not ear-checked**: headless Chrome runs no audio. TESTING 276.
- **Not touched:** whether the rocket reads right lying ~10 m up on the boom's cradle arms (Q222's other half, a look
  at the Q159 boom's geometry): it read fine in the earlier rollout stills; reopen if it looks off in play.
- **Check:** test `sound-3`.

## v1.196 — lettering on the pads: Coastal's agency over its assembly building's door, Isle's company on its hangar (2026-10-13, effects beat, QUEUE Q245)

`app/gl.js` (`FONT57`, `padText`, `padName`; `coastalPad`, `islePad`, `buildPad`, `padFor`, `padSync`).

- **The font:** 5×7 capitals A–Z and a hyphen (35 bits a letter, base 36), built as geometry: one slim box per run of
  lit pixels on a row, 2.5 cm proud of the wall, so the letters take the building's light, shadow and night like the
  wall. Accents are dropped (NFD); anything else is a space; a line break stacks lines (7 pixels tall, 2 apart); the
  size is the largest that fits the given height and width. (`MESH_FS`'s 3×5 font is digits only, for the serials.)
- **The names, from the site's owner** (`padName`): Coastal, "CENTRE SPATIAL / <root>" in navy, two lines between
  the door and the pastel band (~1.6 m letters); Isle, "<root> LAUNCH CO" in white on the hangar's black sign (~1 m),
  replacing the five placeholder blocks. The other schools carry none yet. A pad is now built and cached per school and
  owner (`PADX[school:power]`; the current site's rebuilds when its owner changes), so two Coastal sites of different
  powers each show their own name.
- **Taste calls, defaults taken:** the wording (French for Coastal's agency, a plain company name for Isle) and the
  colours. Easy to change in `padName`.
- **Stills:** `output/launchpad/beauty/Q245/` (`coastal`, `isle`, and crops; views 146 and 149 with the camera
  turned to the buildings). **Check:** test `aerofx-31` (and the school-pad tests' dispatch patterns amended). TESTING 277.

## v1.197 — the volume cloud shadow baked, a lookup per ground pixel (2026-10-13, sky & bodies beat, QUEUE Q379)

Q326 found `cloudShadowV` (Q65's shadow of the cloud volume on the ground) the biggest single part of the pad's sky pass
after the march: 5 `cloudDens` toward the sun for every ground pixel, 1.4 ms of 7.4.

- **Now:** `SHD_FS` bakes, on the coverage bake's own grid (512², ±50 km gnomonic round the point under the camera,
  planet-fixed), the light reaching the slab's base (2 km) through the slab toward the sun: the same 5 steps, the same
  extinction and floor. A ground point walks its sun ray up to 2 km and reads the bake there, which is the same integral
  for any ground below 2 km (above it, inside the slab, the shadow is slightly too deep). Re-baked with the coverage or
  when the sun has turned 0.1° over the ground (~8 s); texture unit 14.
- **Sky pass, ms** (RTX 3050, High, full resolution, A/B in one session): pad 7.44 → 6.52, complex 7.37 → 6.83, clouds
  from the pad (80) 6.85 → 5.15, 3 km (81) 3.60 → 2.37, 8 km (82) 4.23 → 2.93; 25 km (83, above the volume) unchanged.
  The bake costs ~0.3 ms the frames it runs.
- **Seen:** views 1, 15, 80–83 before and after alike (no pixel differs by more than grain; `output/launchpad/beauty/
  q379-before/`, `q379-after/`).
- **Check:** test `aerofx-32`; the Q65 check in look.mjs now looks for the march in the bake. TESTING 278.

## v1.200 — the planets in the sky, a moon under a pixel, stars by the sky's contrast, a faint airglow (2026-10-13, sky & bodies beat, QUEUE Q374, Q395, Q407; PLAYTEST #11, #92, #103)

- **Q374, read as:** the planets were only the map's 2D dots (UI on a ring "direction only, not to scale": left as they
  are, flow's), and absent from the 3D sky; a moon under a pixel flickered out between pixel centres. Now:
  - **The planets** (`planetSky(T)`, app/gl.js): each one's magnitude from Tellus, m = −26.74 − 2.5 log10(p (R/Δ)²
    (TU/r)² Φ(α)) with geometric albedos `PLANET_ALB` (Hesper .7, Enyo .17, Astraea .09, Hyperion .5, Erebus .5) and a
    Lambert sphere's phase, put on the stars' scale (their brightest, br 2.45, taken as m −1.5), capped at br 8.
    `SKY_FS`'s `planetsAt` draws them as the stars' discs, steady, under the same floor `uStK`. On day 0 (view 169):
    Hesper m −5.6 and Hyperion −3.4 (both at the cap), Enyo −0.4 (br 0.9, a bright star), Astraea and Erebus too faint
    to draw. The renderer's sun is still fixed (`SUN`) while the planets move with the year, so their phases drift from
    what the sky shows over a long program (the system's slice 3).
  - **A moon under 1.5 px** is the moon pass's point: the disc's solid angle × its mean radiance at that phase, spread
    over a 0.7 px Gaussian, so it shrinks into a dot continuously (view 170: Selene from 600,000 km, a faint star). The sky
    pass lets Selene's point through its alpha as it does the disc (`uMR` is uploaded again for it).
- **Q395 (PLAYTEST #92), the eye's contrast:** stars, planets and the galaxy each lose `SKY_CK` (30) × the luminance of
  the sky in front of them, after the exposure floor; faint ones and the halos go first. Day (view 18): none (a few
  showed before); dusk, the sun 5.8° down (new view 171): a few bright ones high up, none in the twilight band (dozens
  before); night (19) and space (97, 163): as before. `SKY_CK` is baked into the shader (0 = the old look).
- **Q407 (PLAYTEST #103):** the airglow's line is a quarter as bright (.012 → .003): a faint thin line on the night limb
  (view 163).
- **Cost:** within noise (a 6-entry loop per sky pixel that sees space; the point mode only near a sub-pixel moon).
- **Views:** 169 the planets, 170 Selene under a pixel, 171 the pad at dusk. Stills `output/launchpad/beauty/q374-after/`,
  `q395-before/`, `q395-after/`, `q374-merged/`. Test `aerofx-33`. TESTING 281.

## v1.201 — a display rod under a hanging model on the desk (2026-10-13, effects beat, QUEUE Q330)

`app/model-desk.js` (`deskMesh`, `deskKey`).

- Since Q327 (v1.139) a design whose lower parts were removed hangs over the desk's base plate (`BLD.foot`). Now a
  steel rod (4 mm at model scale) rises from the plate's pin to the design's bottom (`S.yBot`), into the nozzle as a
  kit model's stand does, with a collar where it leaves the pin. Only when the gap is over 6 mm at model scale; the
  desk mesh's key carries the gap, so it is rebuilt as parts are added or removed.
- The lamp's shadow on the paper is still the model's only (the rod casts none); a nit, left.
- **Stills:** `output/launchpad/beauty/Q330/` (`standing`, `hanging_8m`: view 152 with the foot 8 m below). **Check:**
  test `aerofx-34`. TESTING 282.

## v1.203 — a calmer camera shake, and a switch for it (2026-10-13, effects beat, QUEUE Q360)

`app/gl.js` (`camShake`), `app/settings.js` (the switch).

- **Caio (2026-10-13):** "it's not only the switch, it's the shake itself, which is too intense and unpleasant to
  watch". Q320's shake (v1.154) was a sum of sines at 13–83 rad/s (2–13 Hz): near the frame rate it strobed rather
  than shook, and it reached ~0.45° of view direction at Mach 1's max-q (~0.4° at a re-entry's peak).
- **Now:** the same shape (a max-q buffet worst near Mach 1, the re-entry rumble by the plasma's heat), as a sway at
  9–26 rad/s (1.5–4 Hz), at most ~0.12° at max-q and ~0.14° at re-entry's peak: about a quarter. Still deterministic on
  sim time (still when paused), off in the map.
- **The switch:** Settings › Screens › "camera shake (the max-q buffet, re-entry)", kept per browser
  (`launchpad-shake`). **Flow:** one row added to your `renderSettings` and its change handler, nothing else.
- Not seen moving in a browser here (the GPU was another session's); the numbers are the test's. **Check:** test
  `aerofx-35` (and `aerofx-14`). TESTING 284.

## v1.205 — the camera shake as PLAYTEST #98 asked: only round transonic and peak q, short jolts, Off / Gentle / Full (2026-10-13, effects beat, QUEUE Q402)

`app/gl.js` (`camShake`, `SHK`, `SHAKE_LV`), `app/settings.js`.

- **Builds on v1.203** (the slow 1.5–4 Hz sway at about a quarter the strength). Now also:
  - **a narrower envelope:** the buffet starts at 15 kPa (was 8), so it is the transonic stretch and peak q only;
  - **jolts:** a damped knock (~4 Hz, gone in ~0.4 s) as the ship goes through Mach 1 (in air over 5 kPa) and at each
    staging (fewer parts on the same ship): ~0.06° on Gentle;
  - **Off / Gentle / Full** in Settings › Screens (replacing v1.203's checkbox; Full doubles it), default Gentle, kept
    per browser (`launchpad-shake`: a saved '1' from v1.203 reads as Gentle, '0' as Off).
- **Flow:** the shake row in `renderSettings` is now three buttons, handled in the click listener beside the quality's.
- Not seen moving in a browser (numbers from the test). **Check:** tests `aerofx-35` (rewritten), `aerofx-14`. TESTING 286.

## v1.206 — effects stop with the pause (2026-10-13, effects beat, QUEUE Q393, PLAYTEST #90)

`app/gl.js` (`FXT`, `fxNow`), `app/loop.js` (`frame` advances it), `app/render.js`, `app/state.js`.

- **Caio (PLAYTEST #90):** "the boosters' effect keeps playing when the game is paused". The plume, plasma, dust,
  impact and composite shaders, explosions' ages and light, and the stars' twinkle all took their time from
  `performance.now()`, so a paused frame kept moving (flames flickering, fireballs growing and fading).
- **Now one effects clock**, `fxNow()` (ms): `frame()` adds real time to it only while the game isn't paused (the Esc
  menu or Settings open), so a pause holds every effect still and they carry on from there. It keeps real-time pace under
  time warp (a flame flickers at its own rate; sim-time effects such as smoke already follow the sim). Reference views
  still pin it with `HOOK.fxT`.
- Left on the wall clock on purpose: the exposure's easing (`expoTick`: the picture holds still anyway), the prediction
  caches and HUD timers (not looks).
- Not seen in a browser here (the GPU was another session's); the wiring is the test's. **Check:** test `aerofx-36`
  (and the views test's clock pattern amended). TESTING 287.

## v1.209 — the haze without dither (2026-10-13, sky & bodies beat, QUEUE Q392, PLAYTEST #89)

Caio: "the diffusion effect in atmosphere or whatever it is has visible dithering". **Measured, not bisected:** the
fine-grain noise in a smooth hazy sky (luminance minus a 7×7 blur, std in grey levels over the flat regions), with
each suspect switched off in the running page (`output/launchpad/beauty/q392/V0`–`V3`):

| | pad | ascent 3 km | max-q 10 km | 200 km | sunrise | terminator 800 km |
|---|---|---|---|---|---|---|
| main (v1.197) | 4.58 | 3.38 | 3.23 | 4.19 | 1.95 | 4.47 |
| grain off | 3.24 | 0.85 | 0.79 | 3.90 | 1.55 | |
| + `scatter`'s jitter off | 3.24 | 0.85 | 0.79 | 1.41 | 1.23 | |
| + the cloud slab's jitter off | 3.25 | 0.81 | 0.79 | 1.41 | 1.22 | |
| **fixed** | 3.45 | 1.46 | 1.38 | 1.54 | 1.33 | 1.94 |

(The pad's ~3.2 that stays is the ground's texture inside the "flat" mask, not noise.)

- **The composite's grain** (Q314, `GRADE.gr`) was most of it low and mid air: triangular noise, ~3.7 grey levels in
  the mid-tones, new every frame. **.035 → .012**: still dithers the 8-bit output, a trace of the press-photo grain.
  A taste knob if Caio wants more.
- **`scatter`'s per-pixel jitter** (Q352) was most of it from orbit. It's there to hide the bands a fixed step count
  draws where a ray crosses the planet's shadow; now it applies only on such rays (the shadow state at the ray's start,
  middle and end differs). The terminator from 800 km (view 160) shows no bands, with less noise.
- The cloud slab's jitter doesn't matter (V3).
- **Views 172, 173:** Q321's nebula and spiral were numbered 159 and 160, and their branch came first in `views.js`,
  so the effects beat's 159 (the shield from upstream) and 160 (the terminator) never ran. Renumbered; `refset.mjs`'s
  set takes 172–173.
- **Check:** test `aerofx-37`; aerofx-18's and Q250's checks updated to the jitter's new form. TESTING 290.

## v1.212 — farmland round settled land, a scrub range round each pad, coasts without the staircase (2026-10-13, sky & bodies beat, QUEUE Q401, Q403; PLAYTEST #95, #99)

- **Q401, farmland** (`farmSettle`, `farmland`, in `tellus()`): the old faint tint of 260 m squares within 4 km of the
  camera is gone. How much ground is farmed = climate (green, mild, flat, under ~1,800 m, not rugged; the wet tropics
  about half, as clearings and plantations) × settlement (0.35 everywhere, plus the city texture read at mips 5 and 7, a
  blur of ~100–400 km, plus each pad's town within 40 km). A ~3–6 km noise against that fraction says which land is farmed.
  The fields: two grid orientations (300 m and 430 m fields) switching along a wandering line, which is also a road; some
  fields split into strips; five crops (greens, ripe yellow, ochre, ploughed brown, drier with less rain); hedges on 70 %;
  crop rows close up; woods in ~3 km patches; country roads on a warped ~3 km grid; villages in some 5 km cells by the
  settled fraction. Every part fades with the footprint to its mean (`fline`: a filtered line), so from 35 km and orbit
  farmland is a mottled regional tint. `FARM_FX = false` compiles the old look.
  - First tries, measured: the largest city (Fenor Falls) is in a desert, so view 175 picks the largest city in
    farmable climate (Kamar); the Cape pad's wetness is 1.49 (the climate map goes past 1), which a ceiling of .95
    excluded; a field size varying in place sheared the grid (gx is millions of metres).
- **The pad's range:** fields stop 2.5–4 km from every pad; within 6 km the ground is cleared scrub (dark brush and dry
  pale grass in ~20–80 m patches, muted) instead of the flat lawn (views 17, 177).
- **Q403, coasts:** `tellus()` blends sea and land over ±½ of the height's change across the pixel (`fwidth(hT)` taken in
  `main`, where control flow is uniform; zero at a silhouette, where the hit distance jumps), and the shallow fringe and
  the beach widen with it. From 4,000 km an island's single-pixel specks smooth into a line (view 157). The coast's shape
  is the height's, as before (the detail octaves already fractal it up close).
- **Cost:** interleaved A/B, two rounds: the sky pass +0.2 to +0.8 ms in wide aerial views (175, 176), +0.2 at 177,
  −0.3 at the pad (17).
- **Views:** 175 farmland from 6 km near a city, 176 from 35 km, 177 the Cape pad from 3 km (each searches the weather
  clock for clear air over the target). They were 172–174 until a merge: the galaxy views took 172–173 the same hour.
  Stills `output/launchpad/beauty/q401-before1/2`, `q401-after1/2` (A/B), `q401-after/` (final), `q403-before/`,
  `q401-merged/`. Test `aerofx-38`. TESTING 293.
- **Not done:** village lights at night; a land-use map texture (the noise and the city blur stand in); fields don't
  follow terrain contours.

## v1.214 — no bright band at the horizon from inside the deck (2026-10-13, sky & bodies beat, QUEUE Q420)

Seen in Q250's ascent at 2.4 km under ~60 % cover: inside the deck a cream band ran along the horizon between grey cloud
above and below, with 2×2 stairs (the half-resolution slab's upsample along it).

- **Cause:** the cloud volume fades out over `uVD`/2–`uVD` (20–40 km). From inside the slab, a level ray outlives it and
  meets the shell (at 3 km, ~39 km off for a camera at 2.4 km) lit like a sunlit top, or far ground past the volume's
  reach: a bright line where everything near is fog.
- **Fix** (`SKY_FS` main, after the shell): with the camera in the slab (2.2–5 km, fading to 1.5 and 6 km), a ray that
  stays in the slab past `uVD`/2 is fogged, by how far past, in the volume's own mean colour along it (`vAvg`, the
  half-res slab's colour over its opacity, kept where the volume reached opacity 0.05); through a gap, the far deck at
  half brightness. Selene's alpha (`vis`) follows.
- **Measured** (paired renders, the same view list, so the same weather): the band's peak over the rows around it
  178: 26 → 17, 179: 32 → 9 grey levels; views 81 (3 km), 82 (8 km), 2 unchanged.
- **Left:** in 178 part of the streak stays: the volume's own sunlit clouds in its fading ring (20–40 km), not the
  shell. QUEUE *Proposed*.
- **Views 178, 179** (new): 2.4 km in the deck, the camera level, looking along the horizon two ways.
- **Check:** test `aerofx-39`. TESTING 295. Stills `output/launchpad/beauty/q420-A/` (before), `q420-C/` (after).

## v1.218 — the new parts' look: the octagonal bus, side boxes, antennas, fairing rails, fins by size (2026-10-13, effects beat on parts & pad's behalf, QUEUE Q396; PROBES § 7)

`app/gl.js` (`partBody`: `oct`/`octl`, `scam`/`ssci`/`sbatt`/`scomp`, `whip`, `bant`, `fair` + `fairSeams`, `rfin`/`cfin`;
`C.AG`; `KIND` frame and comp → 7; `MESH_FS`'s foil crinkle).

- **The octagonal frame:** was eight flat gold faces. Now a bus of eight bays between dark machined end rings: six in
  silver foil, two opposite as black radiator panels with louvre blades; bare aluminium posts at the corners and a belt
  round the middle, proud of the faces so they cast shadows.
- **Side boxes, each with its own outline at a glance:** the camera a silver box behind a black lens hood with a white
  radiator plate; the instruments gold foil with a sensor's round mouth and a radiator strip; the battery dark with five
  cell ribs, an orange band and two red terminals; the computer grey with six heat-sink fins and a cable into the hull.
  All still within `off + r` of the skin (the fairing fit, v1.148).
- **Antennas:** the whip on a foot and a three-turn spring, tapering to a ball; the boom antenna's hinge, and out, a
  thin three-longeron lattice (bays every ~0.3 m) rising a little, a crossed dipole on a white hub at its tip.
- **Fairing:** dark separation rails along both seams (angles 0 and π), on the closed shell and on each falling half.
- **Fins:** the root doubler and the plate's thickness grow with the size (0.9 / 1.35 / 2 m, Q348); the 1.35 m and 2 m
  plates carry a stiffener rib on both faces.
- **Foil:** a silver foil (`C.AG`, material 5 like the gold); the frame and the computer now take kind 7, so their foil
  crinkles like the instruments'. Silver mottles more than gold (its normal tilts read little against the sky).
- **Not done here:** the stack camera (`cam`) is unchanged; era-dependent foil (polished 60s vs gold 70s) waits on the
  era ladder; deploy animation is Q411.
- **Stills:** `output/launchpad/beauty/Q396/` (`bus_ab`: before | after; the Satellite preset on the pad, fairing off;
  `boom_fins_*` with a boom antenna and 2 m / 1.35 m fins swapped in). **Check:** test `aerofx-40`. TESTING 299.

## v1.219 — deploying animates: wings unfold panel by panel, the boom antenna swings out and extends, legs swing down (2026-10-13, effects beat, QUEUE Q411)

`app/gl.js` (`DEP_S`, `depF`, `depKey`; `wpanel`, `bant`, `leg` in `partBody`), `app/render.js` and `app/program-ui.js` (the
mesh keys), `sim/power.js` (`wingOp`) and `sim/flight.js` (`legOp`): one stamp each.

- **Caio (2026-10-13):** folding parts snapped. Now they move, on the bay doors' pattern (`doorT`/`doorF`): the sim stamps
  `p.depT = simT` when a wing, boom antenna or leg starts out or back, and the drawing follows `depF(p)` (0 stowed … 1 out)
  in sim time, so it pauses with the game and runs fast under warp. Without a stamp (set in the Assembly, a loaded save,
  a ship seen for the first time) it is at once.
  - **Solar wing (4 s):** the boom slides out (first quarter), then the four panels unfold one after another, an accordion
    hinged at alternate edges; the edge spars appear once it is flat.
  - **Boom antenna (3 s):** swings from along the skin up and out (first third), then the lattice extends; the dipole's
    arms open at the end.
  - **Leg (1.6 s):** the foot swings from its stowed place down to `legFoot`'s, strut and brace following.
  - While a fraction moves, the ship's (and the fleet's) mesh is rebuilt each frame (the key carries the fractions, as
    the bay doors' does): a few seconds of rebuilds per deploy.
- **The sim still counts a part as out at once** (power, the antenna's gain, the legs' feet, `qMax` tear-off): Q411's
  "the sim counts a part out only at 1" is the vehicle session's (a Proposed line). **Vehicle:** the two stamps
  (`p.depT=simT`) in `wingOp` and `legOp` are mine; nothing else in the sim changed.
- **Stills:** `output/launchpad/beauty/Q411/deploy_sequence.png` (0.6, 1.4, 2.2, 3.0, 4.2 s; the Satellite on the pad,
  its fairing off, a boom antenna swapped in) and the frames `dq_*`. **Check:** test `aerofx-41` (and aerofx-3's leg
  pattern amended). TESTING 300.
