# BEAUTY — the beauty pass
**Version**: 0.2.1 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-12 · **Updated**: 2026-10-12
**Status**: **D18 answered 2026-10-12 (Caio): the defaults and the order** (§ 7). Lanes build from § 4–6.
**Purpose**: Caio (2026-10-11): "beautify the game some more", on what the player sees most and the biggest moments:
launch to space, the planet and other bodies seen from above, the craft, the flames, the air effects, re-entry, the
sky. Detail without weight. This doc is what's wrong today (stills and frame times), what to change, in what order, at
what cost. Budget and Low/High rules: [`ROADMAP.md`](ROADMAP.md) § "Graphics budget". Lanes build from § 6.

Before stills (78, RTX 3050, full resolution): `output/launchpad/beauty/before/` (`vNNN-*.png` are `refView(n)`;
`p1`–`p4` Tellus at 200 / 4,000 / 20,000 km and Selene at 50 km). Each phase ends with the same shots as "after".

---

## 1. What we found

**The short version**
1. **The most-seen moments already run at half resolution.** The adaptive scaler keeps the GPU under ~7 ms; on the
   pad with smoke, in the clouds, with vapor on side boosters and with an engine seen from below, the full-res frame is
   17–30 ms, so the game draws them at **45–55 %** resolution. Any new beauty there is paid in blur. **Buy frame time
   back first.**
2. **No HDR.** Each shader tone-maps itself at a fixed exposure (×0.85, ACES fit). So bloom catches only near-white,
   the plume and plasma can't outshine daylight, and nothing adapts between the sunlit planet and the night sky.
3. **The craft are lit as if in a brown room.** In orbit the "ground" light is a constant brown below the ship and the
   reflection a two-colour gradient: no blue planet beside the ship, no limb, no Earthshine. No self-shadowing.
4. **Silhouettes are faceted:** every engine bell is one straight cone, the nose five straight segments, normals flat
   along each profile segment. The surface detail itself (weld rings, rivets, shingles, foil, soot, frost) is good and
   procedural.
5. **The space sky is not an image:** galaxy, stars and sun are computed per pixel every frame inside `SKY_FS`, the
   shader whose link is most of the 86 s first load (Q19). The galaxy shows smeared streaks and repeated blobs (v097).
6. **Tellus from mid orbit is a cloud swirl** with no continents (p2), and its limb looks cut out. From 200 km it's
   good (p1). **Selene** repeats identical crater stamps from orbit (p4) and is a flat grey plane on the ground
   (v112–113); its craters alias from Tellus orbit (Q250).
7. **Vacuum plumes read as brown fog** (v032–035), sea-level cores as a flat green-white tube (v002, v030).
   **Re-entry is the best-looking effect** already, but the hull never glows and the wake is a uniform dotted cone.
8. **Stale reference views:** views 1, 4–9 and 114–126 now render on the Assembly desk, not the pad; an "impact · 9 m"
   debug label shows in 60–72; explosion views 90–93 miss the fireball. Fix before using them as before/after.

**Frame times (GPU ms at full res, RTX 3050):** builder < 1 · orbit 3–6 · re-entry 5–8 · ascent at 3 km 9.4 ·
plumes 4–13 · pad plume 11–23 · ignition 11–13 · vapor 9–15 (side boosters 25–30) · clouds 17–27 · explosions 10–15.

## 2. The look we're aiming at

- **1960s press photography, grounded.** The reference is a NASA photo of the period, not a render: warm highlights,
  deep blue-black shadows, slightly crushed blacks, a little grain; the big moments framed like Robert McCall
  paintings (warm light, a big world behind the craft). Thunderbirds played straight, never neon sci-fi.
- **Physics makes the beauty:** the plume widens as the air thins, diamonds when the nozzle is off-design, vapor
  collars at Mach ~1, re-entry colours by heat, few stars in sunlight. Every effect teaches something true.
- **Spend where the eye is** (ROADMAP): the rocket and plume at launch, the horizon on the climb, the planet from
  orbit, the first sight of a body, re-entry. Elsewhere, style is cheaper than detail.
- **Detail in shaders, not triangles;** silhouettes from a few well-placed vertices.

## 3. Rules for every item

1. **Measured, both settings.** Before/after stills and GPU ms on the reference views, High and Low, the 3050 and
   the iGPU, with `node refset.mjs <dir> [views]` (`REF_Q=low|high`, `SHOT_IGPU=1`; NOTES look § v1.134). An item that lowers the adaptive resolution in its moment needs a reason in its NOTES.
2. **Never grow `SKY_FS`'s `main`** without a matching cut (Q19). Prefer passes of their own; items that *shrink*
   `SKY_FS` are welcome.
3. **Low keeps the floor:** each costly effect has a Low path (fewer steps, half-res, off).
4. **Two settings, as ROADMAP says.** `app/settings.js` has Low/Medium/High today; folding to Low/High is in B0.

## 4. The plan, in phases

### B0 — foundations: frame time and light (first; everything after looks better for it)
1. **Half-resolution offscreen buffers** for the smoke, the near-cloud slab, vapor and the impingement volume, with a
   depth-aware upsample. Biggest frame-time cost today; goal: pad, clouds and vapor views back above 75 % scale.
2. **An HDR scene** (RGBA16F target, tone-mapped once in the composite). Every shader stops tone-mapping itself.
   Tone curve **AgX** (ACES turns fire into flat orange and skews hues).
3. **Auto-exposure:** the mean luminance from bloom's smallest level, eased over ~1 s, one uniform for all. Gives the
   stars fading in on the night side, glare at the plume, an over-bright re-entry.
4. **Bloom on HDR** (the existing 4 levels, thresholded on real brightness) and **one grade** in the composite: a
   small 3D LUT (32³) with a vignette and a little grain; **a LUT per era** later (the period film look ages with the
   game, a lever for W14's identity).
5. **Refresh the reference views** (desk vs pad, the debug label, explosions re-aimed) and add the moments this pass
   targets: liftoff at T+2 s, max-q, staging at 60 km, orbit sunrise, Tellus at 4,000 km, Selene from 100 km.
6. Settings to Low/High.

### B1 — the craft
1. **Silhouettes:** contoured bells (a Rao profile, 6–8 points, per engine family), ogive noses (8 points), smooth
   normals along the profile except at real edges. CPU only, ~+30 % vertices, ~0 GPU.
2. **Light from the world:** a *planet disc* term (direction, angular size, lit fraction, colour of the body below)
   for the fill light and the reflection: the blue-white planet and its limb seen in the hull, Earthshine on the
   shadow side, Selene grey near the Moon. ~10 ALU, no `SKY_FS`.
3. **Self-shadowing, High only:** a small shadow map fitted to the ship (boosters on the core, fins, the tower);
   ambient occlusion baked per vertex at joints and steps (free).
4. **Surface pass** on the existing procedural detail: stringers and ribbing on interstages and skirts, a roughness
   breakup so paint reads as metal, darker ends at joints, soot that climbs with burn time, a **roll pattern** paint
   option per school (POWERS). Fixes Q259's soft paint if it's sampling, not mesh.
5. **Greebles: small details in real geometry** (Caio, 2026-10-12: self-shadowing "would suggest some appropriate
   greebling"). Shader detail stays for what is flat (seams, rivets, paint); a short kit of real meshes for what stands
   proud of the skin, because only geometry casts shadows and breaks the silhouette:
   - **along tanks:** cable raceways (the long tunnels down a Saturn's side), exposed feed lines between stages,
     umbilical plates and their doors;
   - **at interstages and skirts:** ullage and retro motors, separation springs, stringer ribs on open trusses;
   - **on engines:** the turbopump, the gas-generator exhaust duct (the F-1's), feed lines into the bell, gimbal
     actuators (Q23 draws the gimbal);
   - **on capsules and probes:** handrails, antennas, thruster quads with their nozzles, hatch hinges, vents.

   Rules: chosen per part from the part's data (no random scatter), styled **per school and era** (POWERS: Steppe's
   exposed plumbing, Cape's clean raceways, Isle's commercial fairings); a few hundred vertices per part, dropped
   beyond a distance (they read only up close); ambient occlusion baked under each (free), and the High shadow map
   (B1.3) gives the raceway its shadow line down the tank. Placed on the part, so the builder's attach rules ignore them.
6. **Cryogenic frost and the ice fall:** frost on LOX/LH₂ tanks on the pad (marks have frost already), a vent wisp,
   ice sheets falling at ignition (the Apollo slow-motion look). The single most "1960s launch" detail.

### B2 — the flames
1. **Sunlight on the plume:** the gas scatters sunlight, so at altitude and twilight the plume glows against a dark
   sky: the "jellyfish". A few ALU per step in `PLUME_FS`.
2. **Vacuum plumes:** faint, wide, transparent, the colour of the propellant, never brown fog; the soot term fades
   with altitude. Sea-level cores with structure (scrolling noise, a soft edge), not a tube.
3. **Shock diamonds** stronger, with a Mach disk at the first cell; they come and go with off-design pressure.
4. **Propellant palettes reviewed** against photos: kerosene orange with dark soot and the F-1's dark exhaust curtain
   at the nozzle, hydrolox nearly invisible blue with crisp diamonds, solids blinding with white smoke, hypergolic
   pale orange with a brown puff at ignition.
5. **Light:** the plume as a flickering light on the hull, pad and smoke (exists: brighten in HDR); one light per
   cluster side for wide rockets.
6. **Smoke at half-res** (B0) pays for a **longer contrail** (white, kinked by wind, golden at twilight) and a fuller
   pad cloud. **Heat haze** behind the nozzle in air, High only.

### B3 — the air
1. **Vapor collars:** several thin stacked rings with sharp trailing edges that flicker, at Mach 0.8–1.2 behind every
   shoulder (they're small puffs today).
2. **Max-q:** a subtle camera shake and buffet; the leading edges warming faintly at high Mach (the re-entry ramp, low).
3. **Q250, clouds at liftoff:** jitter or footprint-fade the cloud march (touches `SKY_FS`: pair it with a cut).

### B4 — re-entry
1. **The hull glows:** the windward skin and shield emit by temperature (dull red → orange → yellow-white), from the
   heat the marks already carry; the char stays after landing.
2. **The plasma in HDR:** it outshines daylight and blooms; colours white-yellow at the stagnation point, lavender and
   magenta at the edge (Orion's and Dragon's footage).
3. **The wake:** ragged flickering streamers and sparks of ablator (existing `fxPuff`), not a dotted cone.
4. **The mood:** warm flicker on everything, shake, the radio blackout as silence (with sound). This is the heroic
   moment: let it be too bright.

### B5 — the space sky
1. **Bake the galaxy to a cube map once per program** (`PROG.gseed`), at load or behind the first screen: far more
   detail than the per-frame version can afford (dust filaments, a proper bright core, a few faint nebulae), then one
   texture read per pixel. Moves the galaxy out of `SKY_FS`'s main (a small link-time win, not the Q19 fix).
2. **Stars stay sharp:** the analytic star layers stay (a cube map blurs single stars), or ~10,000 catalogue-like
   stars as points with colour by temperature.
3. **Exposure decides the stars** (B0): few when the sunlit planet or the sun is in view, a flood in shadow. Never
   none (a game, not a camera): a floor.
4. **The sun:** a tiny blinding disc, glare and a soft star from the lens, the bloom doing the rest; the four fixed
   spikes go.
5. Mock-ups first (Q253), the galaxy's character is a taste call (D18.4).

### B6 — Tellus, Selene and the bodies from above
1. **Tellus from mid orbit shows its continents:** clouds thinner and patchier in the clear belts, less streaky warp;
   the land legible from 1,000–10,000 km (p2 is the target shot).
2. **The limb:** a thin bright blue band (the air is ~1.5 % of the radius) fading to black; a coloured terminator; a
   faint green **airglow** line on the night limb. A **transmittance table** baked once replaces `scatter`'s inner
   loop and `sunTrans`: better and *shrinks* `SKY_FS`.
3. **The sea (Q268):** Fresnel, sky reflection, a wide sunglint; swell close up.
4. **Night lights** with mipmaps (no shimmer from orbit), a sodium tint, lightning in storms (later).
5. **Selene out of `SKY_FS`** into the moon pass Nyx already uses, its craters filtered by footprint (fixes Q250) and
   not repeated (rotated, sized and placed per cell); **opposition surge** (bright, flat at full phase); earthshine
   from Tellus's lit fraction; a harsh terminator. Shrinks `SKY_FS`.
6. **Selene's ground up close** (v112–113 is a flat plane): GROUND's relief should show; check why the lander scene
   lacks it (world). *Answered (Q324, 2026-10-30): GROUND G3 isn't built, so Selene is still the moon pass's sphere;
   the fix is G3 (notes/look.md § Q324).*

## 5. Cost table (estimates until measured)

| Item | GPU on High | Low | `SKY_FS` | Owner (beat) |
|---|---|---|---|---|
| B0.1 half-res FX buffers | **saves** 5–15 ms in heavy views | same | slab moves out (shrinks) | effects + sky |
| B0.2–4 HDR, AgX, exposure, bloom, LUT | +0.3–0.5 ms | bloom off | one uniform | effects (pipeline) |
| B1.1 bells, noses, normals | ~0 | same | — | parts & pad |
| B1.2 planet-disc light | ~0.05 ms | same | — | parts & pad |
| B1.3 ship shadow map | 0.3–0.6 ms | off | — | parts & pad |
| B1.4, 1.6 surface pass, frost, ice | ~0.1 ms + particles | fewer particles | — | parts & pad |
| B1.5 greebles (geometry) | ~0.1–0.3 ms (vertices, shadow pass) | dropped sooner | — | parts & pad |
| B2 plume scatter, palettes, diamonds | +0.1–0.3 ms | fewer steps | — | effects |
| B2.6 contrail, heat haze | 0.2–0.4 ms | haze off | — | effects |
| B3 vapor rings, buffet | ~0.1 ms | off (as today) | Q250 fix touches it | effects |
| B4 hull glow, HDR plasma, wake | ~0.1 ms | same | — | effects |
| B5 baked galaxy, stars, sun | **saves** a little per frame; bake ~10–50 ms once | 512² faces | shrinks | sky & bodies |
| B6.2 transmittance table | **saves** | same | shrinks | sky & bodies |
| B6.1, 3, 4 continents, sea, lights | ~0.1 ms | same | grows a little: pay with B6.2 | sky & bodies + world |
| B6.5 Selene's own pass | ~0 | same | shrinks | sky & bodies |

## 6. Order

1. **B0** (frame time, HDR, exposure, views). Without it every later item is paid in resolution.
2. **B1.1–1.2 and B4.1–2** (silhouettes, planet light, hull glow, plasma in HDR): small, seen in every flight.
3. **B5 and B6.2/6.5** (the sky and the bodies, shrinking `SKY_FS` as they go), mock-ups first.
4. **B2** (flames), **B1.3–1.6** (shadows, surface, greebles, frost), **B3**, **B6.1/6.3/6.4**.

Each item ships with before/after stills for Caio, its GPU ms on both GPUs, and a TESTING row.

## 7. The calls (D18), defaults if silent

*Answered 2026-10-12, Caio: "yes, agreed with your priorities": the defaults below, and the order in § 6.*

1. **The register.** (a) **1960s press photography** (grounded, warm, a light film grade; McCall framing in big
   moments); (b) painterly (Bonestell/McCall posters: saturated, dramatic, less real); (c) neutral modern render.
   **Default: (a)**, with a LUT per era so the look ages (Kodachrome → 70s Ektachrome → modern digital).
2. **Stars.** (a) **set by exposure, with a floor** (few in sunlight, a flood in shadow); (b) always a rich starfield;
   (c) photographic (none in sunlight). **Default: (a).**
3. **HDR first.** (a) **B0's HDR and exposure before any effect** (touches every shader's output once; the effects
   lane's week); (b) per-effect tweaks in today's pipeline. **Default: (a)**: the plume, plasma and stars all depend on it.
4. **The galaxy's character.** (a) **subtle**: a Milky-Way band, dust lanes, one or two faint nebulae per program;
   (b) a showpiece: colourful nebulae, a big satellite galaxy. **Default: (a)**, mock-ups of both before building (Q253).
5. **Mock-ups or stills.** (a) **before/after stills of the game for most items; standalone mock-ups only for the
   sky and the planet from orbit** (taste); (b) mock-ups for every phase. **Default: (a).**

## Version history
- 0.1.0 (2026-10-12): first draft: audit, before stills, research, plan B0–B6, D18.
- 0.2.0 (2026-10-12): D18 answered (defaults, the order); B1.5 greebles in real geometry (Caio).
- 0.2.1 (2026-10-12): § 3 names `refset.mjs`, the measuring tool (Q312).

## Sources
Research and audit 2026-10-12 (design desk). Photography: NASA Earth Observatory "Where are the stars?"
(earthobservatory.nasa.gov/blogs/earthmatters/2011/09/28/where-are-the-stars), ISS airglow (nasa.gov, svs.gsfc.nasa.gov
12963), sunglint (earthobservatory.nasa.gov/images/150321), Black Marble city lights (svs.gsfc.nasa.gov 12573), Atlantis
re-entry from the ISS (spaceflightnow.com/shuttle/sts135/reentry), Orion re-entry colours (spaceflightnow.com 2014-12-20),
Apollo 11 slow-motion launch, shock diamonds (universetoday.com/94123), twilight plumes, Ares I-X vapor collars
(universetoday.com). Techniques: Hillaire 2020 atmosphere LUTs (diglib.eg.org 10.1111/cgf14050), Elite Dangerous
galaxy generation (80.lv), Spacescape/skyboxeditor layer bakes, KSP2 dev insights #2 and #11 on plumes, Waterfall and
Scatterer (KSP mods), AgX vs ACES on fire (blenderartists.org), the opposition effect (aanda.org 2011). Style: Outer
Wilds' art (80.lv), Chesley Bonestell, Robert McCall.
