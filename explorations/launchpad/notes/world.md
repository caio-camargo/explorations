# Launchpad notes — World
**Version**: 1.0.2 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-11 (split from NOTES.md v1.21.52, W37) · **Updated**: 2026-10-13
**Purpose**: The build log for terrain and each body's ground, launch sites, geography, the sea, the planet's scale, frame-time studies.
**Status**: live log, oldest first; new sections go at the bottom. Index of every section: [`../NOTES.md`](../NOTES.md).

---

## The planet's size: a scale study and the rescale (2026-10-07)

**The question (Caio):** was Tellus too small? It was a copy of Kerbin's numbers (600 km, 9.81 m/s², 6 h day, 70 km
of air; Selene was the Mun).

**What players say** (KSP forums): Squad shrank Kerbin to 1/10 Earth for gameplay (easier rockets, frequent transfer
windows, less warp). Among rescale mods, **2.5×** is the most-cited sweet spot ("2.5–3.7× the perfect sweet spot of
challenge versus casual play"); JNSQ (2.7×) adds ~1,400 m/s to orbit; 3.2× (~6,000 m/s) is "a solid difficulty level
without making it a hindrance". Real scale (RSS) is a big adjustment many players leave. The usual complaints at
larger scales are rebalancing (the planets are easy, the rest of the game isn't) and slow ascents and warp limits. Our
exact Kepler rails remove the warp problem.

**The study** (a harness that loads the sim core with Tellus rescaled, surface gravity kept, atmosphere ×(1+0.25(k−1)),
and flies the same scripted missions):

| | 1× | 2× | 2.5× |
|---|---|---|---|
| Δv to low orbit | 3,060–3,180 | 4,000–4,180 | 4,390–4,600 |
| Orbiter preset reaches orbit with | 1,643 spare | 720 | 217 |
| Lunar preset | orbit | lost (overheats on ascent) | lost |
| Peak ascent heating (heating ×3) | 68–85% | 96–100% | 90–100% |
| Pod + shield back from orbit, ablator left | 63% | 4% | 0% |
| Polar 300 km satellite contact, pad → 5 stations | 10% → 53% | 5% → 32% | 4% → 19% |
| Mean distance to the nearest city | 295 km | 368 | 446 |

Findings: Δv grows less than the forums suggest (the 6 h day's spin helps); **heating, not Δv, was the wall**. The ×3
heating gain had been compensating for the small planet's slow orbits. The world gains real room: area ×4 at 2×.

**Decision (Caio): about 2×, pegged to Earth rather than to "2× Kerbin":**

| | Value | Peg |
|---|---|---|
| Radius | 1,274 km | a fifth of Earth's (~2.1× Kerbin) |
| Surface gravity | 9.81 m/s² | Earth's |
| Day | 8 h | a third of Earth's |
| Atmosphere | top 100 km (Kármán line), scale height 7.5 km, sea-level density 1.225 | Earth-like |
| Selene | radius 348 km, surface gravity 1.62, orbit 38,440 km | the Moon's size ratio and gravity; a tenth of the Moon's distance |

**As built** (measured):
- Orbit costs 4,244–4,454 m/s; low-orbit speed is 3.4 km/s; the period at 300 km is 52 min; the equator spins at
  278 m/s.
- **Heating gain ×3 → ×1** (plain Sutton–Graves). That restores the old balance exactly: ascents peak at 35–76% of
  part limits; a shielded pod comes back from orbit with 69% ablator; a bare pod survives a low-orbit return (74%) but
  not a Selene one.
- **Presets resized:**
  - Lunar moves to a 2.5 m first stage (orbit with ~4,070 m/s left).
  - Big Lunar gains tankage and two Kestrel boosters (~4,100 left).
  - Passenger gets a 4 t tank (142 km apex, 6.6 g).

  A Selene landing and return is about 8,200 m/s in all: 4,300 to orbit plus ~3,900 (transfer 1,321, a 2.4-day trip).
- The program calendar follows the planet: a program day is 8 h (`DAY_S` derives from the rotation, so the launch
  window still matches a whole day). Air sampling has 10 bands. The sky shader and CPU light model take their scale
  heights from `TELLUS.H`. Map camera distances are in planet radii. The city texture is 2048×1024, keeping ~3.7 km
  texels.
- **Tests now take their geometry from the planet** (`LEO`, `ATM`, `VENT` at the top of test.mjs) instead of 600 km
  literals. Changes worth knowing:
  - The node burn tolerance is 1.5% (a 58 s burn to Selene).
  - The structural yank checks use a fixed 1.25 m test rocket, and "survived" means intact a minute after the yank.
  - The broadside failure check sets its speed through the air, not inertially (the faster spin was hiding it).
  - The tape check's pitch kick is retuned (8.95 s).

  106 checks pass.

**Other branches:** terrain (not yet merged) bakes a world map whose texels double in km and generates plate and
climate features over the unit sphere, so it needs a look when it merges. Economy and builder only pick up preset and
number changes.

## v1.25 — terrain and geography: a generated world with real height (2026-10-07, terrain session)

Tellus used to be a perfect sphere with a noise coastline and shading-only biomes. Now it's a generated world with real
height: plates, mountain ranges, climate and biomes. The physics lands on it, and the sky shader ray-marches the same
height function, so what you see is where you touch down (to millimetres near the camera). This is **slice A** of the
geography plan below. Slices B–E (launch sites, stations, recovery, biome science) are designed but not built.

### The plan agreed with Caio (geography → gameplay)
Decisions: **real height** (not shading only); **regenerate the world freely**; **terrain first, then launch sites**;
after the rescale, **keep features at their km size** and use **20 plates**.

- **A. Terrain (done here).** One height function shared by CPU and GPU; biomes; mountains, fjords, volcanoes, salt
  flats, wetlands; the physics uses the height.
- **B. Launch sites as data (next).** Several sites per power, generated to suit the geography: flat, coastal, with a
  clear downrange. The chosen site sets the start position, the pad, the rotation bonus and the minimum inclination.
  Numbers at today's scale (R 1,274 km, 8 h day, µ = 1.592e13):
  - Free rotation speed east: **278 m/s × cos(lat)**.
  - A westward launch (when a neighbour lies downrange, like Israel's) costs about **2 × 278 m/s more**.
  - Stationary orbit at **5,670 km**, where orbital speed is 1,515 m/s. The plane change from latitude φ costs
    2·1515·sin(φ/2): **264 m/s from 10°, 369 from 14°, 395 from 15°, 604 from 23°, 1,257 from 49°**.
  - Other levers:
    - Downrange safety reuses the existing range safety and drop-zone incidents.
    - Polar launches need a clear corridor to the south.
    - Inland sites can't take stages wider than rail allows; coastal sites get big stages by barge.
    - An equatorial site can be leased from another power, depending on relations; later, a sea-launch platform ("the
      sea is no one's").
    - Site weather can scrub launches (the cloud field is real data: `cloudAt`).
  - Code that needs generalising: the pad is hard-wired at planet-fixed +X in about six places (`newShip`, pad
    drawing, `uPadL`, `PAD_GS`, `makeCities`, and `makePowers`, which is the economy session's code). The world is
    currently *turned* so that the one site lands at +X. Several sites need a `SITES` list and a site per flight.
- **C. Ground stations with terrain.** Main already has stations (planning branch; see "Ground stations" below).
  Contact is an elevation test against the sea-level sphere: `dot(norm(sub(pf, st.u·R)), st.u) ≥ STA_MIN` in the
  daily tick. To add:
  - Stations at their ground height, `st.u·(R+terrainH)`.
  - **Horizon masking** by sampling `terrainH` along the line of sight (mountain-top stations see more).
  - Plasma blackout during re-entry (the glow already exists).
  - A station's site choice becomes a real trade-off.
- **D. Recovery.** Splashdowns are already flagged (`s.water`).
  - Sea recovery needs a ship near your coast and costs days.
  - Land landings need a softer touchdown.
  - Landing in another power's territory means they keep or return the hardware, depending on relations.
  - Recovery distance feeds refurbishment.
- **E. Biome science and events.** `biomeAt(pf)` gives `{id,name,h,T,wet}`.
  - Ground tracks matter: imaging a latitude needs an inclination at least that high.
  - Aurora sounding rockets favour high-latitude powers.
  - Precision landers into a biome: glacier, volcano, salt flat.
  - Cyclones only over warm sea; fires in dry forest; floods on deltas; eruptions on volcanic arcs.
  - Hand these to the economy session's contract board rather than writing contracts here.

### How it works
**The baked map (CPU, at load).** `makeWorld(seed)` fills 1024×512 equirectangular Float32 fields, about 8 km per
texel at the equator:
- `E`: base height in metres.
- `M`: ruggedness 0–1.
- `V`: volcanism.
- `S`: salt flat.
- `T`: °C at the surface of `E`.
- `W`: wetness.
- `U`: an upper bound on the final height, dilated ±2 texels.

The steps:
1. **Plates.** `NPLATES`=20 seeds, 45% continental, each rotating about a random Euler pole. Each texel finds its
   nearest plate after a noise warp, and the distance to the nearest bisector. Precomputed pair normals make that a
   dot product per plate.
2. **Boundaries.** Converging continent–continent makes a high range plus a plateau behind it. Ocean under continent
   makes a coastal range with volcanoes. Ocean–ocean makes an island arc. Diverging makes a rift (or a mid-ocean
   ridge). Plus old worn ranges from ridged noise. Every boundary width is in the 600 km planet's radians times
   `WK` = 600 km / R, so **features keep their km size whatever R is**.
3. **Low-frequency fields.** The warp, the continent noise and the worn ranges live on a half-resolution grid and
   are interpolated. That cut generation from 2.7 s to 0.4–0.75 s.
4. **Climate.**
   - `T` = 27 − 52·(|lat|/90)^2.2 − 6.5 K/km. That is about Earth's zonal means: 27 °C at the equator, 13 at 45°,
     3 at 60°, −25 at the pole.
   - Wetness: air is carried along each latitude row by the prevailing wind (easterly below 30° and above 60°,
     westerly between). **East is decreasing `atan2(z,x)`**: the surface moves toward −Z. Air picks up moisture over
     the sea (300 km e-fold), dries inland (3,500 km) and rains out going uphill (rain shadows).
   - All of that is scaled by the big circulation: a wet equator, dry ~25°, stormy ~47°, dry poles.
   - Then 5 smoothing passes.
5. **Masks.** Salt flats are dry, flat basins below their 5×5 mean. `U` is the base plus the most the detail can add.

**The height at a point.** `hgtGen(g)` on the CPU and `hgtG(g,k)` in GLSL:
- The map's E/M/V/S read with a **quadratic B-spline** over 3×3 texels. Bilinear gave 8 km lighting facets; see the
  negative results.
- Plus 9 octaves of integer-hash value noise from 25 km down to 90 m (`HF0`), used two ways from the same octaves:
  - ridged multifractal, `RIDGE_A`=4200 m × ruggedness, crests over valleys `VALLEY`=1800 m deep;
  - plain fbm hills, ±380 m, ±880 m near coasts, so the coastline is fractal.
- Fjords: glacial valleys at |lat| > ~45° in rugged, low coastal ground. A warped noise isoline is carved 1,500 m
  deep, so it floods near the coast and leaves a valley inland.
- Volcano cones: one per ~42 km cell (`VOLF`), ~5 km radius, 1.8–3.4 km high, with a summit crater.

`terrainH(pf)` adds the pad levelling (flat to 2 km, blended out by 4.5 km). `groundAlt`/`groundR` give the ground
under a point (the sea where h < 0). `biomeAt` classifies with the same thresholds the shader blends between.

**CPU/GPU agreement is designed in, not hoped for:**
- The hash is integer (`ih3`, Math.imul / uint), so the lattice values are bit-identical.
- The map is read with `texelFetch` and the same weights. Hardware filtering has 8-bit weights.
- GLSL `atan`/`asin` are replaced by `patan`, a range-reduced series good to ~1e-7 rad. The built-ins are good to
  ~1e-5, which moved the texel lookup by decimetres, and metres on steep slopes.
- `sst()` replaces GLSL `smoothstep` wherever edges are reversed. That's undefined in the spec, though NVIDIA happens
  to do the obvious thing.
- Feature constants are rounded once (`toFixed(5)`) and injected into the shader from the SIM values.

**Physics.**
- `newShip` stands on the levelled pad.
- `groundCheck` tests both ends of the vessel against `groundR`. Above `TERR_TOP` + length it returns at once.
- Landing on a slope over `TOPPLE` (0.42 rad, 24°) topples the vessel: a crash.
- `s.water` is set on splashdown.
- `stepDebris` and `fall()` (the impact predictor and drop zones) stop at the ground.
- `TERR_TOP` comes from the data (max of `U`, 12.1 km for seed 13).
- Selene is still a smooth sphere.

**Rendering, in the sky shader.** `march(d,hh,tS)`:
1. Intersect the shell from sea level to R+`TERR_TOP`.
2. Step in clear air with only the `U` bound. That's one filtered fetch, no terrain evaluation, so most sea and sky
   pixels are cheap.
3. Near the ground, evaluate `terr()` with only as many octaves as needed:
   - an octave bound `(m·2730+300)·2^(1−k)` covers what the dropped octaves could add;
   - octaves finer than ~2 pixels are dropped, and so are those beyond 2 km (`octT`: 9 octaves within 2 km, easing
     to 5 by 20 km);
   - step lengths trust the local ruggedness, since lowland slopes are gentle;
   - then 5 bisection steps.
4. Altitude along the ray is `(t²−2tb+cc)/(|p|+R)`, with `cc` from the CPU in float64, so it's centimetre-accurate.
5. A quarter-resolution **pre-pass** (`PDEPTH`, R32F target) marches first. The full-res pass starts just short of the
   nearest coarse hit among its 3×3 neighbours.

Shading:
- Normals come from the height field over ~1.5 pixels.
- Biome colours blend over the climate map (`uClim`, RGBA16F: T, W, U).
- Rock on steep faces; snow and ice only below ~35°; basalt on volcanic arcs; salt pans; wetlands; beaches.
- The sea is coloured by real depth.

**Placement on the ground.**
- The pad mesh and the launch complex stand at `WORLD.siteH`.
- City buildings stand on the terrain under each one (none in the water).
- The ship's ground shadow and the camera clamp use the real ground.
- The construction screen (`builder.js`, one line) hangs the ship over the pad's height.

### The world (seed 13, R 1,274 km)
- **Land:** 37% of the surface, with 20 plates.
- **Heights:** peaks to ~9.3 km; the base map ranges from −5.8 to +9.3 km.
- **The pad:** at 157 m on the tip of an equatorial peninsula. The coast is 25–50 km east, then open ocean for 700+
  km. The world is turned so the pad is at planet-fixed +X; it's at longitude −79.6° in the generator's own frame.
- **Biomes:** sea 63% · grassland 7.5 · tundra 4.9 · taiga 4.1 · ice 4.0 · hot desert 3.8 · savanna 3.3 · cold desert
  2.7 · temperate forest 2.4 · rainforest 1.9 · steppe 1.1 · alpine 1.1 · volcanic 0.3. Salt flats and wetlands
  are effectively 0 since the wetter climate (open thread).
- **Powers** (the economy session's `makePowers`, on this land):
  - Ordun's land starts at 10°S and Haval's at 14°N: **two powers can't reach the equator**.
  - The other three straddle it.
  - Territories are still big Voronoi cells. Smaller ones, or land owned by no one, would sharpen the asymmetry.
    That's the economy session's call.
- **Seed choice:** surveyed seeds 1–30 for an equatorial east-coast site and powers cut off from the equator. Seed 12
  was the runner-up.

### Measurements
- **CPU vs GPU height** (`terrainProbe()`, 4,096 random directions plus 1,024 near the pad plus 1,024 in mountains):
  - global: median 1.7 mm, p99 3 cm, max 14 cm;
  - near the pad: max 2 cm;
  - mountains: max 10 cm.
  - Before `patan`: 0.1–0.4 m, more on steep slopes.
  - Before the integer hash, a float hash could disagree by whole lattice values: tens of metres.
- **GPU cost**, RTX 3050 laptop, 1024×768 canvas, the game's own timer (`gpuMs`), whole frame:
  - pad view 4.2 ms;
  - coast from 1.5 km 3.2 ms;
  - rugged hills at a grazing angle 8.8 ms;
  - orbit about 2.5 ms;
  - without terrain: ~2.0–2.6 ms.
  - So terrain roughly doubles the sky pass near the ground, and more in grazing rugged views.
  - Timings in the hidden in-app pane swing ±15% between identical runs; compare only within one session.
- **Generation:** `makeWorld` 0.4–0.85 s; the SIM loads in 0.8–1.4 s (it was 0.7 s at 600 km with the old land mask).
- **Tests:** 116/116, including the existing suites, unchanged in what they check.

### Negative results and traps (worth reading before touching this)
- **A float hash can't be shared between CPU and GPU.** `fract(sin…)`-style hashes depend on whether the GPU fuses
  multiply-adds, so whole lattice values differ. The old land mask survived only because coastline margins hid it.
  Height can't hide it: use integer hashes.
- **GPU `atan`/`asin` are approximate (~1e-5 rad).** That moved texel lookups enough for decimetre errors. A
  hand-written `atan2` fixed it at no measurable cost.
- **Bilinear height → visible facets.** It's continuous, but its slope kinks at every texel edge, and lighting shows
  slope. Two attempts at a fix:
  - A **cubic** B-spline over 4×4 texels with loops and dynamic `vec4` indexing **doubled the frame cost**.
  - A **quadratic** B-spline (C1 is enough for normals), 9 fetches, unrolled, costs nothing measurable. It never
    overshoots, so the `U` bound stays valid.
- **The march is bounded by its slowest pixel group, not by octave count.** Cutting octaves (level of detail ×6 or
  ×12) barely moved the cost. Warp divergence near the horizon dominates, where some rays creep along just above the
  ground. What worked:
  - the clear-air bound;
  - ruggedness-aware step lengths;
  - longer minimum steps at distance;
  - the pre-pass (about 10%).
  - The hash finalizer and the 9th octave were within noise.
- **The near-field detail had an old 15% brightness step.** Ground colour was multiplied by `.85+.3·det·fade`
  inside 4 km and not at all outside. It only became visible as a large arc on the new flat plains. The bug dated
  from v1.10; it's now ×1 at fade 0.
- **Climate first came out far too cold.** 2 °C at 44° snowed over every hill. It's now fitted to Earth's zonal means.
  Mid-latitude interiors also came out mostly desert until inland drying slowed (2,200 → 3,500 km) and base wetness
  rose.
- **A uniform 8 km snow dome reads as a white blob.** Snow on steep faces plus 0.8 albedo through the tone curve
  erased the relief. Rock now shows on faces over ~35° and snow is 0.6. The relief itself was too gentle: 22° at
  most over 100 m, now `RIDGE_A` 4200.
- **East is decreasing longitude** in this codebase's `atan2(z,x)`. The first winds and site search had it backwards.
- **Tests can depend on geography without saying so.** After the regeneration, the foreign-station lease test's first
  foreign city belonged to a power drifting hostile within the 100 days. It now picks a city of a friendly power.
- **The merge with main** needed main's new `cloudAt` back on the float `h3/vn/fbm` port, which the terrain had
  replaced. They're restored next to `cloudAt`.
- **Tooling traps in the in-app preview:**
  - When the pane is hidden, `computer` screenshots return a stale frame and `requestAnimationFrame` stalls. Capture
    the canvas yourself instead (`toDataURL`, then POST to a local endpoint).
  - Nesting your own `TIME_ELAPSED` query inside the game's breaks its timer. Read `gpuMs` instead.
  - The first frame after swapping a shader program is garbage.
  - The browser caches `builder.js`: fetch with `{cache:'reload'}` after editing it.

### Files and tools
- `index.html`:
  - SIM: "the world" block (`ih3`/`tn`, `makeWorld`, `wSpl`/`wBil`, `hgtGen`, `siteSearch`, `terrainH`,
    `groundAlt`/`groundR`, `biomeAt`, `TERR_TOP`/`terrainSlope`).
  - `groundCheck`, `stepDebris`, `fall`.
  - SKY_FS: `patan`, `wTexUV`, `hgtG`, `terr`, `octF`/`octT`, `march`, `coarseStart`, `tellus`.
  - JS: `WORLD_TEX`, `PDEPTH`/`depthTarget`, the sky-pass setup in `render()`, `cityMesh`, pad and shadow placement.
- `terrain-probe.js` (load it into the page like `views.js`):
  - `terrainProbe()` measures CPU/GPU height agreement. Rerun it after any change to the height function on either
    side.
  - `overView(lat, lon, alt, yaw, pitch, dist, hour)` puts the camera over any spot at a local hour.
  - `gpuTime()` times frames, but conflicts with the game's own timer; prefer reading `gpuMs` after ~20 renders.
- **Seed survey:** load the SIM block in node with `WSEED` replaced. Report `WORLD.siteFound`/`siteH`, each power's
  latitude range via `powerAt` on a 2–4° grid, and biome shares via `biomeAt`. Render maps from `biomeAt` per pixel.
  The scripts lived in the session scratchpad, so rebuild them from this description: about 30 lines each.

### Next session: where to pick up
0. ~~**Ground awareness**~~ done in v1.29 (§ v1.29); ~~surface properties by biome~~ done in v1.37 (§ v1.37). ~~the slice-B follow-ups~~ (v1.45) and ~~slices C–E~~ (v1.48) done too.
1. ~~**Launch sites (slice B).**~~ Done in v1.27 (§ v1.27). The original brief, kept for reference: see the plan above for the design and numbers. Start with a `SITES` list in the world
   block, generated by a generalised `siteSearch`: flat, low, a coast within ~150 km, open water downrange, any
   latitude. Then a site per flight, and replace the +X assumptions.
   - The pad levelling becomes per site: `terrainH` and the shader's `terr` (a uniform array of sites).
   - Coordinate with the builder session (the site picker in the construction screen) and the economy session
     (`makePowers` and `PAD_GS` assume the pad at +X; site ownership and leases).
   - **Hand-off from the economy session (2026-10-07): what the economy layer needs from launch sites.** Geography is
     the last power-flavour axis, and Caio chose to build it as slice B here first, with economy on top afterwards. The
     economy side will add site ownership, foreign leases priced by relations, loss of access under sanctions, and the
     politics of launching over a neighbour. To keep that a thin layer, please:
     - **`SITES` as plain data in the SIM block,** one entry per site: `id`, `name`, `u` (planet-fixed unit vector),
       `lat`, `h` (pad height), `power` (index, from `powerAt(u)`; null at sea), `coastal` (bool), `maxDia` (largest stage
       diameter it can take: rail limit inland, barge at the coast), `downrange` (azimuth plus the powers whose land lies
       under the first ~1,000 km of the ascent), `polar` (a clear corridor south or north), and `kind` (`'pad'`, later
       `'sea'`).
     - **The chosen site lives on the flight** (`S.site` or `newShip(stack, site)`), so missions, incidents and the
       flight record can read it. Economy will record `R.site`.
     - **One gate economy owns:** before a launch, call `siteAccess(site)` → `{ok, why, fee}`. Economy defines it in the
       program block: own sites ok, foreign ones leased or refused, sanctions block. Until it exists, default to "home
       sites only, free". The builder's site picker should show `why` when `ok` is false.
     - **Power homes:** `makePowers` seeds power 0 at planet-fixed +X, the current pad. If the world stops being turned to
       put the home site at +X, seed power 0 at the home site's `u` (a one-line change in economy code; go ahead, and
       say so in the log). `HOME` can change at runtime (defection), so home sites are always `SITES.filter(s =>
       s.power === HOME)`, never a stored list.
     - **Other +X assumptions on the economy side:** `PAD_GS` (the pad ground station, planning's code) and the
       recovery-demonstration contract (`landDist` is measured from +X). Point them at the flight's site; the
       contract's text already says "the pad".
     - **Leave economy rules out of slice B:** no fees, ownership politics or sanction checks. Sites should be able to
       exist abroad from day one; a foreign site is simply refused until economy's `siteAccess` arrives. Economy then
       adds leases, a lease line on the budget, sites closed when relations sour (as ground stations already are),
       westward-launch politics, and site choice in contracts.
2. **Cost of low grazing views** (8.8 ms at 1024×768 over rugged hills).
   - Ideas: a temporal reuse of last frame's depth; a cheaper hash (exactness only matters near the camera, so
     distant octaves could come from a 3D noise texture with hardware filtering); fewer octaves beyond ~5 km.
   - Check in a real browser; the in-app pane's timings are noisy.
3. **Look.**
   - The coast is smoother than wanted.
   - The pad's levelled disc shows as a faint terrace from altitude.
   - ~~High ranges are almost all ice (right at 7–8 km, but monotonous).~~ Varied 2026-10-09 (effects beat, Q52): see
     § "Wind-scoured ranges". The terrace and the coast are geometry (`terrainH` is the physics' ground too): world's call.
   - Salt flats and wetlands vanished with the wetter climate (re-tune their masks).
   - Distant land is washed out by the haze of the rescaled atmosphere (that's the visuals/rescale side).
   - A soft curved shading edge remains on the 44°S plain. It's not the distance level of detail; probably a real
     slope (unconfirmed).
4. ~~**Stations with terrain (C), recovery (D), biome science (E)**~~: done in v1.48 (§ v1.48), with what's left listed there.
5. ~~**The world map / atlas view:** biomes and borders as an overlay on the map view would make the geography legible
   in play.~~ Done in v1.52 (§ v1.52).

## v1.27 — launch sites as data (2026-10-07, terrain session, slice B)

Slice B of the geography plan (§ v1.25), built to the economy session's hand-off. Every power now has launch sites
suited to its own geography. A flight starts from the site you pick, and the site's latitude and downrange are real.
Economy rules (leases, fees, sanctions, politics) are deliberately left to the economy session.

### What a site is
`SITES` is plain data in the SIM world block, one entry per pad:

| Field | Meaning |
|---|---|
| `id`, `name`, `kind` | `kind` is `'pad'`; a sea platform would be `'sea'` later. Names are the power's root plus Cape / Field / Polar Range. |
| `u`, `lat` | Planet-fixed unit vector; latitude in degrees. |
| `h` | Pad height. The pad is levelled to `h` (flat to 2 km, blended out by 4.5 km). |
| `power` | Index from `powerAt(u)`, or null. |
| `coastal`, `maxDia` | Coastal means water within 30 km. Stages up to 10 m come by barge; inland, 3.9 m by rail (a real loading gauge). |
| `downrange` | `{az, sea, over}`: of the eastward headings (45–135°), the one with the most water over the first 1,000 km, favouring due east (the most free speed). `over` lists the powers whose land lies under it. |
| `polar` | `'S'`, `'N'`, `'NS'` or null: a corridor that way with ≥ 60% water and only the site's own land. |
| `role` | `home`, `eq`, `polar` or `inland`. |
| `rot`, `minInc` | Free eastward speed at sea level (ω·R·cos lat); the lowest inclination reachable without a plane change (\|lat\|). |

**How they're generated.**
1. The home site is found as before: equatorial, flat, low, a coast to the east. The world is still turned so it sits
   at planet-fixed +X. It is `SITES[0]`, power 0's home.
2. Once the powers exist, `extendSites()` screens candidates on a 6-texel grid (~47 km) of the baked map:
   - flat (ruggedness < 0.15), 5–1,500 m up, |lat| < 70°;
   - on a power's land, ≥ 40 km from cities;
   - with cheap water fractions east and toward the poles.
3. Each power gets up to three sites, ≥ 250 km apart (`SITE_GAP`):
   - its most equatorial, weighted toward open water east (`eq`; power 0 already has its home site);
   - one with a clear polar corridor (`polar`);
   - its most equatorial inland one (`inland`).
4. `finishSite` measures every site on the real terrain and territory: exact `isLand`/`powerAt` along 1,000 km great
   circles every 20 km.
5. Cost: ~150–300 ms at load.

**Seed 13 has 15 sites** (3 per power; ⟂ = polar corridor):

| Site | Role | Lat | Pad m | Free m/s | | Downrange | ⟂ |
|---|---|---|---|---|---|---|---|
| Fenfen Cape | home | 0.0N | 157 | 278 | coast | 90° 94% water | S |
| Fenfen Polar Range | polar | 26.9N | 140 | 248 | coast | 90° 100% | SN |
| Fenfen Field | inland | 7.9N | 66 | 275 | inland | 135° 88% | S |
| Selhav Field | eq | 0.5S | 175 | 278 | inland | 90° 90% | S |
| Selhav Polar Range | polar | 18.5N | 368 | 264 | coast | 120° 50% | S |
| Selhav Field II | inland | 10.0N | 282 | 274 | inland | 90° 88%, over Fentor | S |
| Ordun Field | eq | 17.4S | 307 | 265 | inland | 105° 88% | N |
| Ordun Polar Range | polar | 15.3S | 393 | 268 | coast | 45° 82% | N |
| Ordun Field II | inland | 15.3S | 621 | 268 | inland | 60° 90% | N |
| Haval Cape | eq | 14.2N | 424 | 269 | coast | 105° 100% | S |
| Haval Polar Range | polar | 29.0N | 999 | 243 | inland | 135° 66%, over Fenfen | S |
| Haval Field | inland | 22.7N | 1332 | 256 | inland | 90° 48%, over Fenfen | — |
| Fentor Field | eq | 1.6N | 851 | 278 | inland | 90° 92% | — |
| Fentor Polar Range | polar | 43.8N | 682 | 201 | inland | 135° 38% | S |
| Fentor Field II | inland | 0.5S | 615 | 278 | inland | 105° 60% | — |

What the table says:
- Ordun's best site is at 15.3°S and Haval's at 14.2°N. Neither can reach an equatorial orbit without a plane change.
  To the stationary orbit that costs ~370–400 m/s more than from the equator.
- Two of Haval's sites have their downrange over *our* land. That's the "launching over a neighbour" politics economy
  plans to add.

### A site per flight
- `newShip(stack, site = curSite())` puts the ship on that site's pad in the site's own frame (nose up, belly east).
- The choice is `PROG.site` (saved). `curSite()` falls back to the first home site.
- Home sites are `homeSites()`, recomputed from `HOME` every call, because `HOME` changes on defection.
- Tapes record their site (`tape.site`), and the autopilot flies a tape from where it was recorded. The logbook copies
  and saved tapes carry it too.

**The launch gate** (on Launch, after the budget check):
1. `siteAccessOf(site)` calls economy's `siteAccess(site)` → `{ok, why, fee}` if it exists. Until then: home sites
   only, free; a foreign site is refused with "⟨power⟩ won't let us launch from ⟨site⟩".
2. `siteFits(site, parts)`: no stage wider than `maxDia`.

**The picker** is in the construction screen's right panel, above LAUNCH. It lists our sites, then those abroad (⛔ when
refused). For the chosen site it shows latitude, free speed, lowest inclination, pad height, downrange and water
share, the powers overflown, the polar corridor, rail or barge, and the reason it's refused. Picking a site moves the
ship onto that pad (`builder.js` `changed()` now hangs it over `S.site`).

**Rendering.**
- `terr()` in the sky shader levels the 4 sites nearest the camera (`uSites[4]`, `uNS`). `terrainH` levels all of
  them; sites are ≥ 250 km apart, so the nearest is the only one that can matter.
- The pad mesh is drawn at every site within 300 km of the camera, in its own frame.
- The painted launch complex (`padGround`) follows the nearest site's frame (`uPadE`, `uPadS`).

**+X assumptions replaced:**
- `makeCities` and `makePowers` (one line, per the hand-off) use the home site's `u`.
- The recovery distance `landDist` is measured from the flight's own site.
- The pad's ground station is now `padGS()`, the chosen site; planning's `PAD_GS` constant is gone.

### Measurements
- Agreement around a non-home site (Fenfen Polar Range, 1,024 points within 8 km): GPU vs CPU median 2 mm, max 2.5 cm.
  260 points sit on the flat 2 km disc.
- **The Orbiter flown from Haval Polar Range (29.0°N)** reaches 121×102 km at **28.97°**. Latitude now sets the
  orbit's plane.
- **Free speed:** 278 m/s at the equator, 248 at 26.9°, 201 at 43.8°.
- **Tests:** `test.mjs` §23, 5 checks (157 total with everything merged):
  - fields and generation;
  - a ship on a far pad: position, attitude, free speed, plane;
  - `PROG.site` and tapes;
  - access and rail gauge;
  - the latitude flight.

### Traps hit
- **`typeof X` on a `const` in its temporal dead zone throws.** `mkSite` takes its id from the caller instead.
- **An edit that turns a one-line handler into two lines moves "after this line".** The picker was inserted after the
  Launch handler's *first* line, i.e. inside it, and `renderSites` was undefined at load.
- **A merge can fail on an object that Drive hasn't finished syncing** ("unable to read sha1 file"). It leaves the
  new files it had already written as untracked files in the worktree. The object was readable a minute later. Move
  the strays aside and merge again.

### Left for others (also in ACTIVE_WORK)
- **Economy:**
  - define `siteAccess(site)` → `{ok, why, fee}` (leases, sanctions, closures) and record `R.site`;
  - westward and overflight politics can read `site.downrange.over`;
  - the ballistic contract still places its target `rg/600` radians from +X: the old 600 km radius (ranges 2.1× long
    now), and from +X rather than the flight's site.
- **Builder:** the site picker lives in `index.html` (`renderSites`, `#sitePick`), not in the construction screen's
  own UI. Move it if the screen grows a place for it.

### Next on this line
- ~~**Ground awareness**~~ done in v1.29 (§ v1.29). The original note: A few systems still measure height from sea level,
  which the real ground (up to ~9 km) breaks:
  1. **The main parachute never opens over high ground.** In `physStep` the main opens on air density
     (`sp<250&&rho>0.7`), not on height above the ground. With the rescaled air (scale height 7.5 km), ρ = 0.7 is about
     4.2 km above sea level, so over a plateau higher than that a capsule comes down under the drogue alone and crashes.
     The impact predictor (`predictImpact`'s drag function) copies the same rule, so change both together. Open the
     main by height above the ground (the arming message says "main below 3 km"), e.g. `h − groundAlt(b, pf) < 3000`,
     with density only as a floor.
  2. **Time-warp auto-drop estimates time to the ground from sea level** (in the main loop, `hb=len(S.r)-S.body.R+
     S.yBot`). Over mountains it drops out of warp late. Use `groundAlt` under the ship.
  3. **The flight HUD shows only altitude above sea level** (`rows` → `'Altitude'`). Add a radar altitude (height above
     the ground or sea under the ship, `h − groundAlt`) when below a few km. You need it to land on terrain.
  4. While there, check anything else that compares `len(r)−R` with a ground-related threshold. Atmosphere thresholds
     (`physAlt`, `h<b.atm`, drag bands) are correctly sea-level based; touchdown, chutes and warp are not.
  - Tests to add: a capsule coming down over a 4–5 km plateau lands under its main; warp drops before ground contact
    over a range.
- ~~A sea-launch platform, per-site weather scrubs, a pre-launch downrange warning~~: done in v1.45 (§ v1.45).
- (original note) Range safety and drop zones per site and heading (they already follow the flight, but nothing warns about a
  downrange over a neighbour before launch).
- ~~Then slices C–E (§ v1.25)~~: done in v1.48 (§ v1.48).

## v1.29 — ground awareness (2026-10-07, terrain session)

The fixes listed in § v1.27 "Next on this line". With real ground up to ~9 km, landing-related decisions now measure
height from the ground under the ship, not from the sea.

- **The main chute** opens below **3 km above the ground** (`MAIN_AGL`), under 250 m/s. It used air denser than
  0.7 kg/m³, which since the rescale (scale height 7.5 km) is ~4.2 km above the *sea*. The impact predictor uses the
  same rule: `fall()`'s drag callback now also receives `r` and `t`, so it can ask about the ground.
- **Measured.** Drop a chute-and-pod from 25 km over a 4.89 km plateau (air 0.64 kg/m³):
  - with the old rule, only the 6 m² drogue ever opened, and it hit at **63 m/s**;
  - now the 600 m² main opens and it lands at **6.9 m/s**;
  - the predictor said 6.9 m/s, 20 m off.
- **Time-warp auto-drop** uses `groundGap(s)`, the ship's bottom above the ground under it.
- **The HUD** shows **Radar alt** (height above the ground or sea) below ~32 km, next to the sea-level altitude.
- **Helpers:** `aglAt(b,r,t)`, `mainChuteOK(b,h,r,t)`, `groundGap(s)` (SIM, next to `groundR`).
- **Left alone, deliberately:** atmosphere thresholds (`physAlt`, drag, the air's top) stay sea-level based. The
  plume's ground interaction (`groundFrame`, plumes session) already used `groundR`.
- **Tests:** `test.mjs` §24, 2 checks (the plateau drop with prediction; the ground gap). 185 total after merging.

## v1.37 — surfaces: what the ground is like to land on (2026-10-08, terrain session)

The touchdown verdict used to be the same everywhere: under 12 m/s and tilted < 34° → landed, unless the slope was
over 24°. Now it depends on the biome under the ship (`SURF`, indexed like `BIOMES`).

| Surface | μ | Stands up to | Softness (m/s) | Boulders/trees (share of cells) |
|---|---|---|---|---|
| sea | — | — | +2 | 0 |
| ice | 0.10 | 5.7° | 0 | 0 |
| tundra | 0.45 | 24° | +1 | 5% |
| taiga | 0.50 | 24° | 0 | 35% (trees) |
| steppe | 0.55 | 24° | +1 | 3% |
| temperate forest | 0.50 | 24° | 0 | 40% (trees) |
| grassland | 0.55 | 24° | +1 | 2% |
| cold desert | 0.55 | 24° | +1 | 8% |
| rainforest | 0.50 | 24° | 0 | 60% (trees) |
| savanna | 0.55 | 24° | +1 | 5% |
| hot desert (sand) | 0.45 | 24° | +3 | 2% |
| alpine | 0.60 | 24° | 0 | 30% |
| volcanic (basalt) | 0.70 | 24° | −2 | 30% |
| salt flat | 0.60 | 24° | 0 | 0 |
| wetland | 0.30 | 16.7° | +4 | 5% |
| launch pad (within 2 km of a site) | 0.80 | 24° | 0 | 0 |
| Selene regolith | 0.60 | 24° | +1 | 0 (for now) |

- **Slope:** a vessel stands on slopes up to atan(μ), never past `TOPPLE` (24°). Steeper ground: "Slid down a 13° slope
  of ice and toppled" (or the old "Toppled over" past 24°).
- **Speed:** the crash limit is `TOUCH_MAX` (12 m/s) plus the softness.
- **Boulders and trees** (`surfaceHit`): a cell (~20 m) of rough ground adds 2–6 m/s to the effective touchdown speed.
  It is decided by an integer hash of the cell, so it's deterministic and tapes replay the same. The effective speed is
  what `touchV` (and so the refurbishment's wear) sees. 2–6 m/s, not more: a normal parachute landing (~5 m/s) on rough
  ground mostly costs wear; a fast one crashes.
- **Reported:** the landing message names the surface (and trees or boulders when hit), the HUD's radar altitude says
  what's below ("above hot desert"), and `s.landSurface` = `{name, id, hit}` is set at touchdown for the economy's
  mission record (biome science, recovery).
- **Tests:** `test.mjs` §25, 3 checks (236 total):
  - ice at 13° slides where taiga holds at 19°;
  - sand forgives 13.7 m/s, basalt not 11;
  - rainforest has trees in 59% of 2,000 cells against its 60% roughness, deterministically.
- **Not yet:** ~~contact dynamics, snow cover, Selene boulders~~, all done in v1.39 (§ v1.39).

## v1.39 — real ground contact; snow and Selene boulders (2026-10-08, terrain session)

The three things v1.37 left out. Vessels no longer snap upright when they touch: they slide, tip, bounce and come to
rest.

**Contact dynamics** (`footPoints`, `groundNormal`, `groundContact`, `touchdown`, `groundCheck`):
- **Contact points:** 4 per part whose foot is within 0.5 m of the lowest point, around that part's own axis. So side
  boosters widen the footprint.
- **Ground force per point:** a spring-damper along the terrain normal. Stiffness gives 2 cm of static deflection at
  Earth gravity on *every* body; with local gravity, tiny Nyx would let a 2 m/s touchdown sink over a metre. ζ 0.6.
- **Friction:** Coulomb, μ from the surface under that point, regularised to stop within ~2 steps.
- **They are part forces:** they go into `p.F`/`p.L` like aero and thrust, so landing loads reach the joints and the
  structural checks.
- **The speed verdict** (`touchdown`) happens at first touch and is judged under the vessel's centre. Its base spans
  more than one boulder cell, so judging at the first rim point made the result depend on timing.
- **Outcomes:**
  - tilting past 60° while touching: "Toppled over on a 12° slope of taiga";
  - the nose in the ground: a crash;
  - at rest (< 0.15 m/s, < 0.03 rad/s) for 0.5 s, and not while the engines push (a slow liftoff is not a landing):
    landed, pinned in the attitude it came to rest in ("leaning 19°");
  - the sea keeps the old upright splashdown.
- **Measured:**
  - a pod set down on a 13° ice slope slid 65 m in 10 s; theory g(sin θ − μ cos θ) gives 62 m;
  - a pod on 19° taiga comes to rest leaning 19°;
  - the Orbiter (1.25 m base, CoM ~5 m up) set down at 1 m/s stands on the flat but topples on a 12° slope, as
    atan(r/h) predicts;
  - a TWR-1.05 liftoff climbs without being re-landed.
  - Every flown landing already in the suite (chutes, Selene, Nyx, the plateau drop) passes unchanged.
- **The ship's ground shadow** lies on the terrain's own plane, so it reads correctly on slopes.

**Snow** is a surface where the shader paints it: a non-ice biome colder than ~−3 °C at that height, on slopes under
~38° (μ 0.3, +3 m/s, boulders mostly buried). **Selene regolith** has boulders in 15% of cells.

**`touchV` is the measured speed again.** v1.37 had made it the effective one, boulders included, and mission rules
read it: Nyx's "under 3 m/s" saw 5.6. Now `s.touchHit` holds what boulders or trees added, and only the refurbishment's
wear adds it in (`missionEnd`, one token in economy code).

**What it means for play:** without landing legs a tall rocket's footprint is its bottom rim, so it tips on slopes of
roughly atan(r/h_cm): ~7–12° for an upper stage, ~30° for a squat pod. That's real, and it makes **landing legs** a
natural next part (a wider footprint is just more contact points: `footPoints` would pick up a leg part's feet). Parts
are the planning session's domain; suggest it there.

**Tests:** `test.mjs` §25 rewritten for emergent outcomes, 5 checks (243 total after merging):
- ice and steep snow slide (distance);
- grippy ground holds, leaning with the slope;
- speed limits;
- boulder share;
- the Orbiter stands on the flat and topples on a slope.

**Not yet:** legs; bouncing debris (debris still dies on contact); wheels and rolling; Selene's boulders as terrain
(they only change the verdict); a contact sound and dust.

## v1.45 — launch-site follow-ups: the sea platform, weather scrubs, the downrange warning (2026-10-08, terrain session)

The three follow-ups listed in § v1.27.

- **The sea platform** (`kind:'sea'`, "Sea Platform"): one per world, on the equator in open ocean.
  - **Placement:** ≥ 300 km from any land, over ≥ 500 m of water, the spot nearest the home site. On seed 13: 4,751 m
    of water, 100% water downrange.
  - **It floats:** nothing is levelled under it (`terrainH` and the shader's `uSites` take land pads only), so there's
    no instant island. The deck is `SEA_DECK` = 12 m above the water.
  - **Drawn** as a deck on columns and pontoons (`seaHull`), with the launch complex on it. The deck covers the whole
    `PAD` mesh (x −256…86, z −194…80 m), so it's a big platform. A sea-specific complex (tower and table only) would
    be smaller; that's the visuals session's call.
  - **Who may use it:** the sea is no one's, so by default the platform is open to any program (a service, like Sea
    Launch). Economy's `siteAccess`, when it exists, can price or refuse it.
  - **Why it matters:** a power with no equatorial land (Ordun, Haval) can still reach the equator.
- **Weather scrubs:**
  - `siteWeather(site, T)` reads the cloud field the sky draws (`cloudAt`).
  - On the launch day `weatherHold(s)` slips the launch a day at a time while the pad is under storm-grade cloud
    (> 0.9), up to `SCRUB_MAX` = 5 days, with a news line.
  - It's called from economy's `missionTick` launch line, one hook: `{const n=weatherHold(s);if(n){R.day0=PROG.day;R.scrubs=n}}`.
  - The picker shows today's sky at the site.
  - At the home site storms scrub 18 of 400 days (4.5%).
- **The downrange warning** (`downrangeWarning(site)`) names the powers whose land lies under the site's corridor,
  other than ours and the host's (the host's own land is the host's business). Shown in the picker, and in the news at
  launch as a warning, not a block: the politics are economy's. On seed 13 one site is warned: Selhav Field II, over
  the Republic of Fentor.
- **Tests:** `test.mjs` §36, 3 checks (299 total after merging):
  - the platform's placement, deck and access;
  - a 2-day storm slips the launch exactly 2 days, while a clear day launches on time;
  - the warning names only other powers.

  §23 now levels land pads only.
- **Trap:** a weather slip moves the shared world seed (`PROG.wseed`) for every later test. §35 (the event timeline)
  had relied on a contract offer arriving by chance and failed; the bodies session hit the same fragility and made the
  same fix (rebuild the board if it's empty).
- **Next on this line:**
  - a movable sea platform (sail it to any latitude: polar launches from the sea);
  - weather by season and region (the storm belts of the climate map), not only the drifting cloud field;
  - winds aloft for max-q loads per site.

## v1.48 — geography in play: stations on real ground, recovery, disasters and field science (2026-10-08, terrain session)

Slices C–E of the geography plan (§ v1.25). All SIM-side; tests in `test.mjs` §37b–37d.

**C. Ground stations on real ground.**
- `gsMask(st)`: each station's horizon, cached per station. 36 azimuths, the highest elevation of the ground out to
  `GS_REACH` = 300 km (24 samples, with the planet's curve), seen from a `GS_MAST` = 20 m mast on the station's ground.
  `gsSees(st, pf)`: above `STA_MIN` *and* above the mask in that direction. A valley station loses the sky behind its
  mountains; a hilltop one sees more. This replaces the sea-level sphere test everywhere contact is decided: imagery
  contact time and downlinks in `satTick` (planning/sats code: the two `gsSees` calls are the only change there).
- `linkOf(s)`: the flight's own link. Deep space counts as linked (no deep-space network yet), on the ground too;
  re-entry plasma (`qHeat > BLACKOUT_Q` = 5e4) blacks it out; otherwise the first station in view. HUD row "Link"
  (the station, or the reason and "· recorder").
  **Fix (QUEUE Q17, PLAYTEST #17):** the heat alone blacked out ordinary climbs. Dense air reaches 50 kW/m² at only
  ~1 km/s (the Heavy at Mach 3.5, 20 km). Now `plasmaOn(s)` also needs airspeed over `PLASMA_V` = 0.65 × circular
  speed at the top of the air (~2.2 km/s; the shuttle's blackout ended near 5 of 7.8 km/s). Measured headless: hot
  ascents peak at 1.1–1.7 km/s (Orbiter, Heavy, Asparagus); an orbital entry is hot from 3.1 down to 1.1 km/s and
  still blacks out for its fast part. aerofx's plasma shell (Q20) can use `plasmaOn`/`PLASMA_V` for the same line.
  test.mjs §37f.
- Telemetry follows the link. Strain data (`R.sf`, the certification feed) is written only while linked; out of
  contact it goes to the recorder `R.sfRec`, which `missionEnd` merges into `R.sf` only if the instrument package came
  home (`R.recSci`). Economy: that one line before the cert loop is the only change in `missionEnd`'s certification.

**D. Recovery.** `recoveryOf(s, R)` → `{factor, kind, why}` for a landed ship on Tellus:
- At sea: recovered if within reach of the launch point: `RECOVER_LOCAL` = 200 km of local boats, or the economy's
  recovery fleet range `FAC.fleet.range[lv]` when built. Beyond that, lost (factor 0).
- On land: home or unclaimed land, fine. Another power's land: relation ≥ 0 returns it; −0.2…0 returns it worn (0.8);
  worse, they keep it.
- Hook (economy code, `missionEnd`'s refurbishment block): the refund is scaled by `rc.factor`, `R.recovery` = the kind,
  and a news line explains it. Not modelled: recovery taking days.

**E. Geography in the work.**
- Disasters follow the land: `cityGround(c)` samples the biome at a city and on rings at 25/60/120 km; `HAZ` says which
  disasters fit (floods: coast within 60 km, wetland or very wet; wildfire: taiga, temperate forest or savanna;
  volcano: volcanic ground; storm: warm coast; locusts: steppe, grassland, savanna or hot desert). `disCities(dis)`
  memoises the eligible cities; `satTick` now picks a disaster kind that has cities, then one of its cities (same two
  `R()` draws as before). On seed 13: floods 20/32, wildfire 26, volcano 5, storm 8, locusts 28.
- Two science contracts in `CT` (additive; economy owns the table):
  - `field`: land an instrument package on a given biome and recover it. `fieldBiomes()` lists ice, cold desert,
    rainforest, hot desert, alpine, volcanic, salt flat and wetland if one lies within 1,200 km of the first site (not
    the pad's own biome), with the distance; pay 10 + km/25. Uses `R.landBiome`, set at landing in `missionTick`.
  - `aurora`: an instrument package above `AURORA_ALT` = 100 km poleward of `AURORA_LAT` = 55°, recovered (`R.aurora`,
    set in `missionTick`). Pay 14 + (km to the zone)/40: from home that's a 1,200 km lob, or a high-latitude site.
- Adding CT types shifts every seeded offer board (more types to draw from). One of my tests read `news[0]`; it now
  searches the news. If another session's test pins a specific offer, that is why.

**Next on this line:** recovery that takes days and a recovery ship to send; stations bought at a chosen site (the mask
makes the choice a real trade-off); ~~the atlas view~~ (done, § v1.52).

## v1.52 — the atlas: biomes, borders and coasts on the map (2026-10-08, terrain session)

Open thread 5 of § v1.25: make the generated geography readable in play. **C** in the map cycles biomes → powers → off
(remembered in `localStorage` `launchpad-atlas`). Tests in `test.mjs` §37e.

- **The grid** (SIM, `ATLAS`): biome id and power of every point on a 1024×512 equirectangular grid, the city
  texture's layout (x = `atan2(z, x)` from −π, y = latitude from the south pole; `atlasU`/`atlasXY` convert).
  `biomeAt` + `powerAt` cost ~5 µs a point, so the bake is ~1 s in node and ~1.5 s in the page. It runs on first use,
  6 ms a frame (`atlasBake(ms)`), with "Atlas: surveying n %" on the map meanwhile.
- **Lines** (`atlasLines`): marching squares on every 2nd grid point. In each cell, the edges whose corners differ
  (land/sea for coasts, two powers' land for borders); two such edges make a segment, any other number meet at the
  centre (triple points, a border reaching the coast). 10,335 coast and 616 border segments on the default world.
- **Names**: each power's name sits on its own land nearest the area-weighted centroid of that land (the plain
  centroid can fall at sea or in a neighbour, for crescent-shaped land).
- **Rendered map** ("modern look"): the planet shader samples `uAtlas` (texture unit 3) and mixes it over the
  ground *after* the clouds, which thin to 15 % under it (`uAtl`). It's lit 50–100 % by the sun so the night side
  stays readable. The texture is rebuilt from the grid when the mode changes (`atlasTex`): biome colours
  (`BIOME_INK`) with light borders, or power colours (their `hue`) with dark borders; coasts dark in both. There's a
  biome legend bottom-right.
- **Notebook and terminal maps**: coasts in the main ink, borders dashed in the second ink (`atlasInk`, one call in
  `drawEraMap`). The planet must be at least 25 px across. Points are culled in the planet frame (u·cam > R) and
  `fromPF` is inlined: ~2 ms a frame for ~3k visible segments (4.6 ms before inlining).
- **Readout**: point at the ground and a box names the biome, the power (or "unclaimed") and the height, or the sea's
  depth, with latitude and longitude. It uses the live `atlasAt(pf)`, not the grid. The pointer is kept in CSS pixels
  because the canvas resizes with the render scale (`RS`): stored canvas pixels drifted ~20 % from the pointer.
- **Checked in the page:** at the pad (0°, 0°) the readout says rainforest · United Provinces of Fenfen · 157 m,
  the same as headless `atlasAt`.

**Negative results / limits**
- A raster border is ~3.7 km a pixel: crisp from orbit, but it steps when zoomed onto a coast. The ink maps use the
  smoother marching-squares lines.
- Overlay text sizes follow `devicePixelRatio`, not `RS`, like every other map label. When the render scale drops,
  the legend and names grow on screen. That's shared with the existing labels; not fixed here.
- Ice dominates the poles and high ranges (§ v1.25 open thread 3), and the atlas makes that obvious.

**Next on this line:** pencil hatching for biomes on the notebook map; contracts and site picking that use the
readout (click to choose a station site, § v1.48 next item 2).

## v1.54 — the ground of every body, slice G1: the layer, no new relief (2026-10-08, world session)

The first slice of [`GROUND.md`](GROUND.md) (QUEUE Q86 + Q18's plan). Every "is this Tellus?" test of the ground is now a
lookup of the body's **`ground` recipe**, so Selene, Nyx and the SYSTEM.md bodies can get relief with no further edits to
the physics. Nothing changes in play: Tellus is as before, and every other body is still a smooth sphere.

- **The recipe** (`sim/world.js`, before `groundAlt`): `b.ground = {gen, top, sea}`. `gen` names a height function in
  `GROUND_GEN` (metres above `b.R` at a planet-fixed point), `top` bounds it from above, and `sea` is an optional
  liquid level: what comes down below it floats. No recipe means a smooth sphere. `TELLUS.ground = {gen:'tellus',
  top:TERR_TOP, sea:0}`.
- **New:**
  - `bodyH(b, pf)`: the solid ground, sea floor included;
  - `bodyTop(b)`;
  - `seaAt(b, pf)`;
  - `groundAlt` is now `max(sea, bodyH)` when the recipe has a sea, `bodyH` otherwise. That allows ground below `b.R`
    (crater floors).
- **Now dispatched:**
  - `terrainSlope` and `groundNormal` (and `b.R` instead of `TELLUS.R`);
  - the sea checks in contact and splashdown (`seaAt`), and the rover's spot check;
  - the early-outs in `groundContact`, `groundCheck`, debris and `fall` (`bodyTop(b)` instead of `TERR_TOP`);
  - `MOON_PE`, now a margin above the moon's `bodyTop`;
  - the camera clamp and the ship's shadow plane (app/render.js).
- **Left on purpose:**
  - `surfaceAt` (the moons' `SURF_MOON`) and the biome code: G2 gives recipes their own surfaces.
  - The radar readout's 20 km band (`TERR_TOP + 20000`, UI only).
  - The shader: G3.

**Tests:** `ground-1`, 3 checks:
- neutral: Tellus's ground matches `terrainH` clamped at the sea at 2,000 points, and every other body is a sphere;
- live: a test recipe on Selene (a 500 m plateau rising north at 20°) holds a pod at 500.00 m, and reads 20.00° as slope
  and as the normal's tilt;
- a recipe's liquid level.
Three mutations (a Tellus-only `groundNormal` or `terrainSlope`, a contact early-out without `bodyTop`) each fail it.
Full suite: 436 pass, 0 fail.

**Next:** G2, Selene's baked map and crater bands on the CPU (GROUND.md § Slices).

## v1.58 — Selene's ground on the CPU, and the maria on the near side (2026-10-08, world session, GROUND.md G2)

Slice G2 of [`GROUND.md`](GROUND.md): Selene's height function, built and measured headless. It is **not live in
play**: `SELENE.ground` stays unset until the sky shader draws the same relief (G3); until then a ship would land on hills
nobody can see. Tests and `study_ground.mjs` switch it on in their own SIM copies. What did change in play: **the maria
moved to the near side.**

**The maria** (decision 1, default held). `selMare` and the shader's mare term both gained `−MARE_NEAR·n.x` (0.24; −X faces
Tellus). Swept against the Moon's shares (31 % of the near side, 2 % of the far side, 16 % in all): **30 % near, 1 % far,
15.3 % in all**; it was 5 % near, 11 % far, 8.4 % in all. Geology follows, since it reads the same mask. Test §42 moved
with it: its spots are now a near-side mare (direct contact) and a far-side highland (needs the relay). Its sample
points were broken too, see below.

**The recipe** (new `sim/ground.js`, after `rovers.js`, now holding SIM END). Height = a baked map + procedural crater
bands.
- **The map**, 1024×512 (2.1 km a texel), baked on first use (0.8–1.1 s, never at load):
  1. highland swell, ±0.9 km (integer-hash fbm);
  2. the old big craters stamped in (inside the rim the crater replaces the ground, outside its ejecta adds);
  3. the maria flooded to a gently domed plain about 1.4 km down;
  4. the young big craters (15 %) on top of everything.
  209 craters ≥ 20 km (N(>D) = 0.055·D⁻² per km², the Moon's highlands), up to 150 km.
- **The bands:** six, from 20 km down to 80 m, each running down to the next. The cells are on an equiangular cube, one
  crater per cell at most (λ 0.38). A crater reaches D from its centre and D ≤ 0.8 of a cell's arc, so a point sees
  every crater touching it in the 3×3 cells around it, on each face whose cells come near (up to three at a corner).
  Integer hash only, so G3 can port it.
  - On mare, 85 % fewer (weighted like the flooding).
  - Freshness is `hash³`: most craters are degraded.
- **Shapes:**
  - simple below GR_DT/g (18 km on Selene); complex above: a flat floor, a steeper wall, a central peak past 1.4×;
  - depth 0.2 D (simple), 0.138·Dt·(D/Dt)^0.301 (complex, Pike's lunar fit); rim 0.036 D;
  - ejecta rim·r⁻³, faded by r = 2.
- **Cost:** one height 3–6 µs on the CPU.

**Measured** (`node study_ground.mjs`, ~30 s):

| What | Number |
|---|---|
| Relief | map −4.0…+1.6 km; sampled p0.1 −3.2 km, median −50 m, max 1.3 km (recipe `top` 4 km) |
| Crater counts, N(>D) per km² vs the target (before mare thinning) | ≥20 km 1.37e-4 / 1.37e-4 · ≥5 km 1.95e-3 / 2.20e-3 · ≥1 km 4.86e-2 / 5.50e-2 · ≥0.2 km 1.21 / 1.37 (the gap is the mare thinning) |
| Craters ≥ 1 km per 1,000 km² | highland 55, mare 12.5 (4.4× fewer; ~10× was the plan: partly flooded mare edges count as mare) |
| Slopes over ±15 m, mare | median 1.0°, p99 27°; past TOPPLE (24°) 1.8 %; under 5° 76 % |
| Slopes over ±15 m, highland | median 4.2°, p99 35°; past TOPPLE 6.9 %; under 5° 54 % |
| Cube-face seams | the steepest 0.5 m step on the edges (47°) is no worse than anywhere (53°) |
| Never sunlit (fixed sun 6.8° above the equator), 2 m above the ground | 8 % at 70°S, 23 % at 75°S, 100 % from 80°S |

**Negative results:**
- **A paraboloid bowl is too steep.** The rim wall of `−d + (d+rim)·r²` is 43°, and up to 58° where craters overlap. Real
  fresh walls stand near the angle of repose (~35°). r^1.6 gives 37° at the rim; the highland p99 went from 39° to 35°.
- **Thinning mare craters by the raw mask** left them only 2.75× sparser: edges have a weak mask but are counted as mare.
  Weighting by the flooding weight made it 4.4×.
- **Bands sized from a guessed safety factor** left a gap between the procedural craters (up to 7 km) and the baked ones
  (from 20 km). The bands are now defined by their largest crater, and each runs down to the next.
- **Test §42's sample points all lay on one curve.** z came from the golden fraction as well as the angle (both
  `frac(0.618·i)`), so 3,000 "spread" points traced a single spiral. It read 9.7 % mare for a true 8.4 %, and 32 % for a
  true 15 % after the move. It's now a Fibonacci lattice (`z = 1 − (2i+1)/N`) (LESSONS #36).

**Tests:** `ground-2`, 5 checks:
- not live, baked lazily;
- relief within bounds, and the counts (baked = GR_C·area/400; band cells filled at λ within 3 %);
- no seams (under 60°);
- maria low and smooth against rough highlands;
- in the physics: a pod rests on a 0.9° mare flat at the ground's height (gap 0.00 m), and slides 164 m off a 34° wall.

Mutations caught: the recipe live at load, only the point's own cube face (a 90° cliff at the seams), and no flooding.
§42 updated as above. Full suite: 457 pass, 0 fail. TESTING row 131: the maria seen from Tellus (the one change you can
see).

**Not yet** (GROUND.md):
- G3: the shader draws this relief (then `geoAt` reads the bake, and the recipe goes live);
- per-recipe surfaces (`surfaceAt` is still `SURF_MOON` everywhere off Tellus);
- the polar dark floors as an R4 deposit mask (G5).

## v1.62 — Enyo's ground on the CPU, the first planet (2026-10-08, world session, GROUND.md G7)

Enyo (Mars, SYSTEM.md § Enyo), built and measured headless like Selene in v1.58, at Caio's request. **Not live:** no
Enyo exists in the body tree yet (space lane, Q87), so the recipe hangs on a stub in `sim/ground.js` (`GROUND_STUBS.Enyo`:
R 678 km, g 3.72, SYSTEM.md's numbers). When the space lane adds the body, it takes `ground: ENYO_GROUND`.

**Shared first.** The crater bands now take a body's radius, crater density `c`, a hash salt (so bodies don't share
craters), an erosion exponent (freshness = hash^frPow) and `thin(centre)`, the chance a crater is missing there. Selene's
recipe runs through the same code **bit-identically** (3,000 heights before and after, 0 differ). A recipe can now carry
its own surfaces: `surfaceAt` asks `b.ground.surf(pf)` off Tellus, and falls back to `SURF_MOON`.

**Enyo's map**, in order (heights above R, the datum):
1. southern highlands, +1.2 ± 1.2 km, with old, worn craters: c 0.02, Mars's highlands, a third of the Moon's. Simple
   turns complex at 7.8 km (Mars: ~7 km).
2. Hellas, 520 km.
3. The northern lowlands flooded to −3.2 km over a warped dichotomy line.
4. The Tharsis bulge (+4.5 km), with:
   - the giant shield: 340 km across, 14 km above its plains on a 3 km basal scarp, a summit caldera;
   - three shields in a line, and Elysium.
5. The canyon: a great circle 1,400 km long (a third of the way round) at 12°S, up to 5.5 km deep, its walls terraced in
   550 m layers (the layered sediment). It cuts the highlands, then opens into the lowlands, as Valles Marineris does
   into Chryse.
6. The young craters.
7. The polar caps: a 2.6 km ice dome in the north, a smaller one in the south.
8. Dune fields (400 m apart, up to 25 m high, a steep lee) in an erg round the north cap, on Hellas's floor and in the
   canyon. They're procedural, aligned to one fixed 3D direction so they have no longitude seam.

Surfaces by unit:

| Unit | Surface | μ | Notes |
|---|---|---|---|
| polar ice | water ice | 0.25 | |
| dunes | dune sand | 0.5 | soft |
| volcanic | basalt | 0.7 | |
| canyon | layered sediment | 0.6 | |
| lowland plains | dusty plains | 0.6 | |
| highlands | dusty regolith | 0.6 | |

**Measured** (`node study_ground.mjs enyo`, ~5 s):

| What | Number |
|---|---|
| Bake, sample | 1.2 s (4.2 km a texel); one height 3 µs |
| Relief | −5.3…+12.3 km (recipe `top` 15 km) |
| Units | highlands 51 %, lowland plains 37 %, volcanic 6.7 %, canyon 1.9 %, polar ice 1.7 %, dunes 1.1 % |
| Craters ≥ 1 km per 1,000 km² | highlands 19.6 (Mars: ~10–20), lowlands 5.5, volcanic 1.1, ice 0.9 |
| Slopes, highlands | median 0.9°, p99 29°, past TOPPLE 2.0 % |
| Slopes, lowlands | median 0.2°, 95 % under 5° (the landing ground) |
| Slopes, canyon | p90 25°, past TOPPLE 11 % (terraced walls) |
| Slopes, polar ice | p99 9.6° |
| Seams | steepest 0.5 m step on cube edges 35° (anywhere: 40°) |

**Negative results:**
- **East is decreasing longitude** (NOTES § v1.25 warned). The canyon set off "east" along `cross(Y, start)` and ran into
  Tharsis, which filled half of it in. It now heads away from Tharsis.
- **A canyon along the dichotomy line is half a canyon.** At 6°S the warped lowland edge reached the equator, and for
  ~700 km one wall was lowland plain. The canyon is now at 12°S and the warp is gentler. The test measures depth below the
  higher wall, since at its mouth one wall *is* lowland, as on Mars.
- **One unit can hide another.** The canyon's floor is a dune field, and dunes were classified first, so the canyon came
  out as 0 % of the globe. It has its own channel now.

**Tests:** `ground-3`, 7 checks:
- not live, baked lazily;
- bounds and counts (c scales λ);
- the dichotomy;
- the giant shield;
- the canyon (3+ km below its higher wall for 1,220 km);
- the caps and surfaces (Selene still lands on regolith);
- no seams.

Mutations caught: no surfaces, the canyon pointed back into Tharsis, no shield. Full suite 478 pass, 0 fail.

**Not yet:**
- Enyo in the body tree (space);
- its look (Q81, after Caio's picks from Q71); the shader (G3);
- dust storms (weather, not ground);
- the caps' spiral troughs, and seasonal CO₂ frost (M5 seasons).
- **Next planets, in GROUND.md's order:** Hesper, Astraea, Hyperion's moons, Erebus.

## Q19 in progress: where a grazing frame's time goes (2026-10-09, world session; parked, no code changed)

QUEUE Q19 (the cost of low grazing views). Measured on this machine's RTX 3050 6 GB Laptop GPU, in headless Chrome
(`shot.mjs`) at 1262×704, with `adaptRes` off and `RS` = 1. **Parked:** the session's background run was stopped because
the machine ran critically low on memory, which other sessions were using (about 0.5 GB free of 16). Resume from here.

**Baseline, the whole frame (the game's own `gpuMs`):**

| View | ms | v1.25's number |
|---|---|---|
| Pad | 14.4 | 4.2 |
| Coast from 1.5 km | 24.3 | 3.2 |
| Rugged hills, 40 m up, grazing (the most rugged land: 52°S 121°E, alpine, 3.7 km) | **54.5** | 8.8 |
| Hills at 300 m | 50.5 | — |
| Orbit | 6.1 | 2.5 |

v1.25's numbers were 1024×768 on the same GPU model; these are far worse, and the next findings say why only partly.

**What I found:**
- **The GPU is thermally throttled while it works:** 85 °C, 1,290 of 2,100 MHz. One early run read 22.9 ms for the hills
  and was never repeated. **Compare only A/B within one session, interleaved.** Across sessions numbers can differ 2×.
- **Clouds don't matter at the hills view.** Volumetric clouds off/on, five interleaved rounds: 55.2 against 55.2 ms.
- **The sky shader is the frame.** A per-draw GPU profile (each draw call in its own timer query; the game's frame timer
  off, since the queries can't nest) gives:
  - sky shader 43–44 ms;
  - its depth pre-pass 5.0 ms;
  - everything else under 1.5 ms (meshes, bloom, composite).
- **With the march removed**, the sky shader is 18.3 ms. So the march plus terrain shading is ~25 ms of the 43.
- **Recompiling the sky shader takes ~36 s** (ANGLE/D3D11, sky + depth pass). Each A/B variant therefore costs a browser
  session of about a minute, and the plan has to be few, well-chosen experiments.

**Tools (in the session scratchpad; rebuild from this description):**
- a bench (views via `overView`, `gpuMs` median over 1.2 s);
- `profFrame` (per-draw timer queries grouped by shader);
- `swapSky(src, depth)`: relink `PSKY`/`PDEPTH` from an edited `SKY_FS` and refresh `P.u`'s locations;
- `oneAB(name)`: base then variant, in one session.

Worth promoting into `terrain-probe.js` when resumed.

**Next, in order:**
1. A/B the shading pieces at the hills view, one per session: normals at ≤5 octaves; no cloud shadow; no near-field
   detail; no `tellus()` fbm.
2. A/B the march: octaves capped at 6; and using the pre-pass's 3×3 hits as a bracket, a short bisection where all nine
   hit close together instead of the full step loop.
3. Then the 18 ms that isn't terrain at all (the atmosphere's `scatter`?), which is the look lane's code: hand it over
   with numbers.

### Q19, round 2 (2026-10-09): the cost is the march inlined into the sky shader; a fix is built, not yet timed

All A/B pairs below were measured in one browser session each, base first. The sky pass in ms at the grazing-hills view
is the median of three per-draw profiles. The GPU was throttled throughout (~57 ms base).

**What each experiment saved:**
- cheaper normals (≤5 octaves): 0.6
- no near-field detail: 0.6
- terrain shading skipped: 0.8
- octaves capped at 6: 1.75
- the step loop halved: 0.7
- one map fetch instead of nine: 1.2
- a bracket from the pre-pass: 0.0
- loops with non-constant bounds: 0.2
- the cloud loop the same way: 0.4
- **no march at all: 28.7**
- **march kept but never run: 20.3**
- **sky shader reads the pre-pass hit instead of marching (three `terr` calls left): 10.3**

Counted per pixel with a heat-map variant: 13.5 march steps (p90 34; the warp maximum 16) and 17 terrain evaluations,
rising from 11 at the bottom of the screen to 25 at the top.
- **The bracket fails at grazing views:** neighbouring coarse hits differ by more than the 3 % it needs (a pixel's angle
  over the grazing angle).

**What that means:** no part of the march is the cost on its own. Its *presence* in the sky shader's long `main` is.
- With the march compiled in, the shader is slow even where it never runs (register pressure: about 10 ms of 57).
- Running it costs far more than its evaluations add up to.

**First-load time is the bigger finding.** A fresh profile (no shader cache) loads in **86–88 s** on this machine. The
sky shader's link takes **71.3 s** of that; its depth pre-pass, the same functions with a small `main`, links in 2.6 s.
Every sky-shader variant with the march inlined took 60–99 s to compile; without it, 20–43 s. Every first visit, and every
visit after the shader code changes, pays this (Caio, after each update).

**The fix, built on branch `terrain`** (`app/gl.js`, `app/render.js`; not merged: timing unmeasured):
- **A terrain G-buffer pass, `PTERR`:** the pre-pass's prefix with a `main` that marches from the coarse start (as the sky
  shader did) and writes (hit distance, height, ground normal octahedral-encoded) to an RGBA32F target at full
  resolution.
- **The sky shader reads it** (`uTerr`, `texelFetch`) and contains no `march` or `terr` calls, so the compiler drops
  them.
- **Without `EXT_color_buffer_float`,** the sky shader is built as before (`TERR_GB`).

**Checked:** screenshots of five views against `main`, pixel by pixel.
- Dusk hills and the coast match (max 6 and 1 levels).
- Hills, pad and orbit differ only as much as `main` differs from itself (clouds and animation).
- **Negative result:** the first version put the G-buffer on texture unit 4, which bloom's composite also binds (units
  0–4). That left a soft bright patch in the sky at dusk (+19 levels). It's on unit 9 now.

**Not yet measured:** the frame time and the load time, `main` against the branch, interleaved. That run was stopped
twice by the machine running out of memory (other sessions). To finish:
- serve `main` on one port and the branch on another;
- alternate four runs of the bench (load time from `performance.getEntriesByType('navigation')[0].loadEventEnd`, then
  the views);
- merge if the branch is no slower at the pad and faster to load.
The expected gain is load time (the 71 s link should drop to ~20–40 s, plus PTERR's own ~3 s), and maybe ~10 ms at
grazing views from register pressure, minus PTERR's full-resolution march.

## v1.65 — Hesper's ground on the CPU (2026-10-09, world session, GROUND.md G7)

The second planet (SYSTEM.md § Hesper, Venus), built and measured headless like Enyo (v1.62). **Not live:** it's on a
stub body (`GROUND_STUBS.Hesper`: R 1,210 km, g 8.87) until the space lane adds Hesper; then it takes
`ground: HESPER_GROUND`. Landers and radar are all that ever see this ground, so the detail is modest: a 7.4 km map plus a
little procedural texture.

**What makes it Venus:**
- **Craters are few, fresh and never small.** The 90 bar air burns up small impactors, and the surface is young.
  - c 3e-5, against the Moon's 0.055 and Mars's 0.02. Venus has under a thousand craters in all; at Hesper's size that's
    **~140 over 2 km**.
  - Only the three coarsest bands run, so the smallest crater is 1.3 km. There's no thinning (Venus's craters are
    scattered at random), and freshness is uniform.
  - Simple turns complex at 3.3 km.
- **Basalt plains**, 85 % of the planet: −0.5 ± 0.4 km, with low wrinkle ridges (~110 m, ~30 km apart).
- **Slab rock** (Venus's tesserae), 11 %: blocks raised 2 km, with crossing ridged texture at 12, 5.5 and 2.5 km. It's
  the roughest ground on the planet.
- **One massif** (Maxwell Montes) to 8.9 km.
- **Four broad, gentle shields** (Maat Mons and kin): 150–200 km across, 3.3–5.7 km above their foot, flanks ~2°.
- **Three coronae:** rings, with the rim ~1.2 km above both the sagged centre and the moat outside.
- **A cluster of pancake domes:** 25 km across, 0.7 km high, flat tops. At this map's scale they're blobs.
- **Lava channels**, procedural: troughs ~1.5–3 km wide at half depth and ~80–110 m deep, along the isolines of a warped
  noise, in some of the plains. They're narrow enough that a lander can miss them.

**Surfaces by unit** (the lander that lasts minutes lands on one of these):

| Unit | Surface | μ |
|---|---|---|
| plains | basalt plains | 0.7 |
| slab rock, mountains | slab rock | 0.75, rough |
| shields, domes | lava flows | 0.7 |
| corona | fractured basalt | 0.7 |
| lava channel | channel floor | 0.65, smooth |

**Measured** (`node study_ground.mjs hesper`, ~2 s):

| What | Number |
|---|---|
| Bake, sample | 0.6 s; one height 2 µs |
| Relief | −1.1…+8.9 km (recipe `top` 12 km) |
| Craters, N(>D) per km² | ≥2 km 7.5e-6 (target 7.5e-6) · ≥5 km 1.1e-6 (1.2e-6) · none under 1.3 km |
| Slopes, plains | median 0.2°, 99.9 % under 5° |
| Slopes, slab rock | median 3.8°, p99 11° |
| Slopes, shields | median 1.7° |
| Seams | steepest 0.5 m step on cube edges 15° |

Nowhere on Hesper is past TOPPLE at this scale. The hazard is the surface's own roughness (`rough` 0.4 on slab rock), and
the heat and pressure, which aren't ground.

**Negative results:**
- **Slab rock first covered 25 % and was smooth** (max 4.7°): its threshold was too low, and its ridges too broad and too
  gentle. Raised to ~11 %, with ridges from 12 km down.
- **Plains with no texture are glass** (median 0.0°). Wrinkle ridges fixed that, and they're also what Venus's radar
  shows.
- **A noise-isoline channel's width is not the threshold over the noise's wavelength.** The first channels came out
  ~5 km wide for an intended 2 km (the gradient estimate was off ~2.5×). Measured cross-sections, then narrowed.
- **A test for a trough can't ask for "higher on most sides":** along the channel the ground is level, and the channels
  meander, so 3 km along the tangent leaves them. The check is now across (3 km, both sides) against along (1 km), the
  median of five channel points.

**Tests:** `ground-4`, 7 checks:
- not live;
- the craters (few, none small, within top);
- plains against slab rock;
- the massif and the shields;
- coronae as rings;
- channels as troughs;
- surfaces and seams.

Mutations caught: letting small craters through, no channels, smooth slab rock. Full suite 497 pass, 0 fail.

**Next, in GROUND.md's order:** Astraea (the belt's dwarf: a bright-floored crater, a lonely mountain), then Hyperion's
moons, Erebus.

## v1.67 — Astraea's ground on the CPU (2026-10-09, world session, GROUND.md G7)

The belt's dwarf planet (SYSTEM.md § Astraea, Ceres), built and measured headless like Enyo and Hesper. **Not live:** it's
on a stub body (`GROUND_STUBS.Astraea`: R 94 km, g 0.28) until the space lane adds Astraea; then it takes
`ground: ASTRAEA_GROUND`.

**A crust factor.** By the 1/g rule alone, Astraea's craters would stay simple bowls up to ~100 km, and a 100 km bowl is
20 km deep on a 94 km body. Ceres doesn't look like that. Its ice-rich crust is weak: Dawn saw craters turn complex at
~7.5–12 km, and its big ones have relaxed shallow. So a recipe can scale the transition by its crust (`crust` 0.12:
**12.5 km**), and above that the complex depth law keeps the big ones a few km deep. No change to the crater code: the
recipe passes its own transition size.

**What's there:**
- **Dark cratered regolith:** c 0.03 (between Mars's 0.02 and the Moon's 0.055: Ceres is heavily cratered but short of
  big craters), crisp (freshness hash²). Eight craters of 20 km and more; the biggest is 43 km.
- **A gentle swell** (±1.5 km). There's no lump: Ceres is near-spherical.
- **Ahuna Mons, the lonely mountain:** 4.6 km above its foot, 20 km across, a flat top (2°), flanks up to 39°.
- **The young bright crater (Occator):** 18 km, its rim 2.5 km above its floor, its central peak collapsed into a pit, and
  salt on its floor in blotches. It's the one bright spot on a charcoal-grey world, and its own surface
  (`salt deposits`) for anything that lands there.
- Surfaces: dark regolith (μ 0.6), salt deposits (0.5, smooth), salty ice rubble on the mountain.

**Measured** (`node study_ground.mjs astraea`, ~2 s):

| What | Number |
|---|---|
| Bake, sample | 80 ms (512×256, 1.15 km a texel); one height 3 µs |
| Relief | −3.0…+4.5 km (recipe `top` 6 km) |
| Craters N(>D) per km², measured / target | ≥20 km 7.2e-5 / 7.5e-5 · ≥2 km 7.6e-3 / 7.5e-3 · ≥0.2 km 0.75 / 0.75 |
| Slopes, regolith | median 2.6°, p90 17°, p99 32°, past TOPPLE 4.3 %, under 5° 71 % |
| Seams | steepest 0.5 m step on cube edges 48° (anywhere: 49°) |

Landing here is "closer to docking" (SYSTEM.md): escape is 229 m/s. The ground's part is that 29 % of it is over 5°.

**Negative results:**
- **At 18 km, Occator sits just past the size where a crater grows a central peak,** so the 600 m "central pit" only
  dented the peak and stood 200 m above the floor. The pit is now 1.5 km into the peak, 300 m below the floor.

**Tests:** `ground-5`, 5 checks:
- not live;
- counts, the 12.5 km transition and the biggest crater shallow (0.87 km, not a 20 km bowl), within top;
- the mountain (height, flanks 25–45°, a flat top);
- the bright crater (rim over floor, a pit, salt on the floor, regolith outside);
- no seams.

Mutations caught: no weak crust, no salt, no mountain. Full suite 506 pass, 0 fail.

**Next, in GROUND.md's order:** Hyperion's moons (Theia's lava plains and calderas; Eos's ridged ice; Tethys's lakes, dunes
and channels under haze; Phoebe, a cratered lump), then Erebus.

## v1.70 — Hyperion's moons on the CPU; no more steps at the poles (Tellus too) (2026-10-09, world session, GROUND.md G7)

Hyperion's four moons (SYSTEM.md § Hyperion), built and measured headless like the planets. **Not live:** each is on a
stub body (`GROUND_STUBS`, SYSTEM.md's radius and gravity; Phoebe's gravity isn't there, so it's real Phoebe's 0.049).
And a bug found on the way, which **is live, on Tellus.**

**Every map had a step at the poles.** The equirectangular maps' first and last rows are rings round the poles (on Tellus
~4 km across). At a pole the samplers read only that row, so two points 0.5 m apart there read it at opposite
longitudes. Measured within 2 km of the poles: **a 0.5 m step of 77–90° on every body**, against 14–56° at
mid-latitudes. On Tellus that's in play: a star-shaped seam at both poles, in the physics and on screen (the GPU reads the
same texture).
- **Fix** (`polesFix`, sim/world.js): one value per polar row, its mean (a bound's max, for `U`). At a pole the samplers
  then read a constant, so the field is continuous there. It's applied in `makeWorld` and at the end of every body's
  bake. It's data only, and the GPU reads the same texture, so CPU and GPU still agree with no shader change.
- **After:** the steepest step near any pole is 0–48°, no worse than that body's own slopes: Tellus 31°, Selene 35°,
  Phoebe 48°.
- **Not seen in a browser** (this machine stays off the GPU): TESTING row 146.
- Heights change only within about a texel of each pole; Selene's 3,000-point reference is unchanged.

**Small bodies** (found on Phoebe, R 20 km):
- **Faces.** The crater bands skipped any cube face more than 60° from the point. That's safe when a crater reaches a few
  degrees, but on Phoebe a 12 km crater reaches 36°. A face is now skipped only beyond its corner (54.7°) plus the band's
  reach, which is unchanged (|u| < 0.5) on every larger body.
- **Coarsest bands.** A tiny body can also start its bands lower (`b0`) and bake the bigger craters instead
  (`bigCraters`' smallest size).

**The moons:**

| Moon | Character | What's there |
|---|---|---|
| **Theia** (Io) | no impact craters at all | sulphur-frost plains; 30 paterae (irregular, 20–80 km, flat floors of fresh lava, median 1.26 km deep); six tilted blocks of crust (to 4.3 km above their foot) |
| **Eos** (Europa + Enceladus) | flat young ice (relief 0.6 km), ~25 craters over 1 km | double ridges on a Worley-edge network at two scales (the new G-ice: crests 160 m above their centre lines); chaos patches of flat-topped blocks; the tiger stripes near the south pole (four rifts, 35 km apart, ~500 m deep, frosted: where a sample can be flown through the plumes) |
| **Tethys** (Titan) | few craters (c 3e-4) | methane lakes and seas, 4.7 %, nearly all in the north. The recipe has `sea: 0`, so a craft splashes down as on Tellus's sea. Linear dunes in equatorial patches (15 %, crests east–west, 2 km apart, 100 m high); a rugged bright highland (Xanadu); drainage channels |
| **Phoebe** | a lump, saturated with craters | the first G-lump (relief 21 % of R); 53 % of it over 10° |

Surfaces per moon:
- **Theia:** fresh lava, tilted crust, sulphur frost.
- **Eos:** fresh plume frost, ice blocks, ridged ice.
- **Tethys:** methane (the liquid), organic sand, icy highland rock, rounded ice cobbles (as Huygens saw), damp organic
  sediment.
- **Phoebe:** regolith.

**Measured** (`node study_ground.mjs theia|eos|tethys|phoebe`):

| Moon | Relief | Slopes | One height |
|---|---|---|---|
| Theia | −1.5…+7.4 km | plains p99 0.7°; mountains p99 36° | ~2 µs |
| Eos | −0.2…+0.4 km | ridged ice p90 11°; chaos p90 16–19°, 5 % past TOPPLE | — |
| Tethys | −0.7…+2.0 km | dunes median 5°; highland p90 6° | — |
| Phoebe | −1.9…+1.6 km | median 9.5°, 9 % past TOPPLE | — |

Tethys's craters are on target at every size. Eos's are few, as meant.

**Negative results:**
- **The polar rows**, above. No test sampled within a texel of a pole, which is how a near-vertical seam on Tellus went
  unnoticed since v1.25 (LESSONS #40).
- **Big craters on a tiny body cross the face cutoff**, above.
- **Eos's first chaos was smooth** (cubed value noise: median 1.1°). Blocks need steep sides: thresholded noise at two
  sizes.
- **Tethys's first dunes covered the whole equatorial belt** (44 %), and its lakes 7 %. Titan's dunes are patchy (~15 %);
  lakes now 4.7 %.

**Tests:** `ground-6`, 6 checks:
- not live;
- Theia (no craters, paterae, mountains);
- Eos (flat, double ridges, chaos rougher, the stripes);
- Tethys (lakes as a liquid, mostly north; dunes east–west);
- Phoebe (lump, saturated);
- **no step at any body's poles, Tellus included.**

Mutations caught: no pole fix, no liquid level on Tethys, no tiger stripes. Full suite 519 pass, 0 fail.

**Next:** Erebus, the last hand-made body; then the seeded small bodies (one lump recipe, parameters from `WSEED`).

## v1.72 — Erebus's ground on the CPU, the last hand-made body (2026-10-09, world session, GROUND.md G7)

The icy dwarf at the edge (SYSTEM.md § Erebus, Pluto), built and measured headless like the others. **Not live:** it's on a
stub body (`GROUND_STUBS.Erebus`: R 238 km, g 0.62) until the space lane adds Erebus. With it, **every hand-made body in
SYSTEM.md has ground on the CPU** (Hyperion has none by design).

**What's there:**
- **The nitrogen-ice basin (Sputnik Planitia):** 200 km across, the same share of the globe as Pluto's. Its glacier floor
  is flat at −2.5 km (2.6 km below the land round it), and it has no craters (it renews itself).
  - It's broken into convection cells ~25 km across, with troughs along their edges 116 m below their middles (G-ice's
    Worley network, reused).
  - Surface: nitrogen ice, μ 0.2.
- **Water-ice mountains:** a dozen angular blocks on the basin's western margin, 10–20 km in radius and 2.5–4.5 km high
  (the tallest 6.5 km above the basin floor at its foot). Flanks p90 40°; water-ice bedrock.
- **Bladed terrain (Tartarus Dorsa):** ridges ~400 m high, ~5 km apart, east of the basin; methane-ice blades.
- **The dark tholin highlands (Cthulhu):** old crust, so every band crater survives there, against half on the uplands and
  none on the ice. They're the most cratered ground: 18 craters ≥ 1 km per 1,000 km², against 10 on the uplands.
- **Uplands of methane frost** everywhere else.
- **An icy crust** (0.4, as Tethys and Eos): simple turns complex near 19 km. That's an assumption: Pluto's own transition
  isn't pinned down.

**Measured** (`node study_ground.mjs erebus`, ~4 s):

| What | Number |
|---|---|
| Bake, sample | 0.6 s; one height 2.5 µs |
| Relief | −3.4…+4.6 km (recipe `top` 6 km) |
| Units | uplands 88 %, tholin 5.9 %, nitrogen ice 3.5 %, blades 2.0 %, mountains 0.7 % |
| Slopes, nitrogen ice | median 0.3–0.6°, p99 4°: the flattest landing ground in the system |
| Slopes, mountains | median 20°, 43 % past TOPPLE |
| Slopes, blades | p90 17° |
| Seams | 36° on cube edges |
| Pole | 19° (ground-6's pole check now includes Erebus) |

**Negative results:**
- **Overlapping mountain blocks summed their heights:** up to 10 km, past the recipe's bound. Overlaps now take the
  taller block.
- **Narrow blocks were cliffs** (p90 58°, max 68°). They're wider now, with longer flanks: p90 40°, max 51°, still
  bedrock-steep.
- **A unit mask that includes the shore isn't the floor.** "Nitrogen ice" first took in the basin's 14° shore, then the
  outer flanks of blocks standing in the basin (p99 10.7°). It's now the glacier floor only (p99 4°).

**Tests:** `ground-7`, 6 checks:
- not live;
- the basin (depth, a flat floor, within top, nitrogen ice);
- the convection cells;
- the mountains;
- the tholin highlands most cratered (by the thinning, and rougher);
- no seams.

Mutations caught: no basin, no convection cells, uniform crater thinning. Full suite 526 pass, 0 fail.

**Next:** the seeded small bodies (one lump recipe, its parameters from `WSEED`); and, for every body here, the space
lane's real body in the tree (Q87), then the shader (G3).

## v1.75 — the seeded small bodies' ground, a recipe factory (2026-10-09, world session, GROUND.md G7)

The last piece of the per-body ground: SYSTEM.md's seeded classes (near-Tellus asteroids, belt bodies, trojans, comets,
interstellar visitors). None of them exists in the game yet (the space lane makes them, M4/M5), so this is a factory for
the space lane to call: **`smallBodyGround({kind, R, seed})`** returns a recipe (`gen: 'small'`) for a body's `ground`.
R is the mean radius; the seed should come from `WSEED` and the body's index, so a world keeps its rocks.
`SB_CLASSES` says which kinds each class draws from; the space lane may change the mix.

**Kinds** (`SB_KINDS`):

| Kind | Density (kg/m³) | Shape | Surface |
|---|---|---|---|
| stony | 2,000 | ellipsoid, b/a 0.6–0.95 | cratered (c 0.03), some boulders; stony regolith |
| carbonaceous | 1,400 | ellipsoid | the same, dark |
| metal | 5,300 | ellipsoid | iron-nickel, hard (soft −3) |
| rubble pile | 1,200 | near-round, a spinning-top ridge on the equator (Bennu, Ryugu) | covered in boulders, few craters |
| comet | 500 | 60 % are contact binaries (two overlapping spheres, a waist, like 67P) | dusty ice, steep-walled pits, few craters |
| visitor | 2,000 | a needle, ~4–8:1 (ʻOumuamua) | no craters |

**How it works:**
- **Shape** is computed exactly per point, not baked: a triaxial ellipsoid (the shortest axis is the spin axis, Y), or the
  union of two overlapping spheres. Both are star-shaped from the centre, so a radial height works (no overhangs).
- **Gravity** is G·(4/3)πρR: 1.7e-4 m/s² on a 500 m rubble pile, 7.8e-3 on a 20 km carbonaceous body.
- **Craters** use the bands that fit the body (the first whose largest crater is under R/4) and are baked below that
  (`bigCraters`' smallest size). There are none on very small bodies, where boulders take over.
- **Boulders and pits** are generated per 3D cell. Only cells whose point lies within half a cell of the surface hold one,
  and that point is projected onto the surface.
- One height costs 1–6 µs.

**Known simplification (the space lane's call):** slopes, and the physics' gravity, point at the centre, not along the
body's own lumpy gravity. So an elongated asteroid reads 15–22° of median tilt that its real gravity would mostly
straighten, and a two-lobed comet reads 24 % of its ground past TOPPLE.

**Measured** (`node study_ground.mjs small:<kind>:<R>:<seed>`, or the probe in the test):

| Body | Shape | Relief | Notes |
|---|---|---|---|
| stony, 5 km | 0.77–1.26 R | ±1.3 km | median tilt 15° |
| rubble pile, 500 m | near-round | −67…+80 m | ridge +29 m; boulders under 9 % of the ground; median 11°, but under 1 % past TOPPLE |
| comet, 2 km (two lobes) | — | — | pits 2 % |
| visitor, 200 m | 8.5:1 | — | — |

Crater counts match the target where the numbers are big enough (Phoebe, re-run: ≥2 km 1.33e-2 against 1.38e-2).

**Negative results:**
- **A visitor first came out 32:1.** Its third axis was drawn as a fraction of the second, which multiplied two small ratios.
  Now c/b is 0.75–1 for every kind.
- **Boulders and pits placed in 3D cells mostly float off the surface** (3 % and 2 points where ~8 % and dozens were
  meant). Projecting each onto the surface fixes the count, but a point projected from further than half a cell can be seen
  from one point and not the next: **3,697 missed features** at 20,000 points without the half-cell limit, **0** with it.
  A random-step test missed those steps, because they sit only at rare cell boundaries. The check that catches them
  compares a 27-cell search with a 125-cell one.
- **A ridge check that ignores the shape** passed with no ridge, because a flattened body is already wider at its equator.
  It now measures the ridge alone.
- **`study_ground.mjs` ignored a tiny body's starting band,** so it listed and counted bands the body never runs. That
  includes Phoebe's in v1.70, but v1.70 quoted no Phoebe crater counts.

**Tests:** `ground-8`, 6 checks:
- a seed reproduces a rock and another seed another; gravity from density;
- every kind at 0.2, 2 and 20 km is finite, under its top, the same through `groundAlt`, with its own surface;
- the shapes (a needle, a contact binary with a waist, a ridge);
- boulders and pits present, and none on a visitor;
- boulders and pits continuous (the 27-against-125 cells check);
- the crater bands across the seams.

Mutations caught: no ridge, gravity off by 10 %, projection without the half-cell limit. Full suite 533 pass, 0 fail.

**That completes GROUND.md G7 on the CPU:** every hand-made body and the seeded classes have ground. What's left is the
space lane's real bodies (Q87, M4/M5) and the shader (G3, which needs the GPU and the milestone gate).

## v1.78 — G3.0: the crater cells on shared trigonometry (2026-10-09, world session, QUEUE Q107)

The first step of GROUND.md § "G3: the port plan", allowed before the milestone gate. Headless, and no visible change.
The crater bands placed their crater centres with `Math.tan`, and found a point's cell with `Math.atan`. GLSL's built-ins
are good to ~1e-5 rad, which would put the shader's craters up to 3.5 m from the CPU's on Selene. Both sides now use one
formula:
- **`ptan`:** a Padé form on ±π/4, good to **1.9e-13**. It places the centres.
- **`patanJ`:** SKY_FS's own `patan`, ported to JS, good to **2.3e-8 rad** (under 1 cm on Selene). It only picks a point's
  cell, where a flip is harmless (the half-cell margin).
- **λ** (a cell's chance of a crater) is now the float32 the shader will compare with (`Math.fround`).

**Measured:** Selene's 3,000 reference heights moved by at most **2.7e-8 m**, against a 1 cm budget, and no crater
appeared or vanished. Crater counts and seams in `study_ground.mjs` are unchanged.

**Tests:** `ground-9` checks the approximations' accuracy, that `craterBands` calls neither `Math.tan` nor `Math.atan`
(putting one back is caught), and that λ is a float32. `ground-3`'s λ-scaling check now allows float32 rounding (1e-6).
Full suite 544 pass, 0 fail.

**Also checked, on this machine's GPU (now allowed):**
- **TESTING 131:** Selene from 900 km over its near side, nearly full. The maria are on the near side, a large dark patch
  over about a third of the face. They're subtle (the shader darkens them by 0.07); the look lane may want them darker.
- **TESTING 146:** can't be judged by eye. At seed 13 Tellus's north pole is open sea, and the south pole never sees the
  fixed sun. The pole fix stays covered by `ground-6`'s CPU check; the north pole renders cleanly.

## v1.122 — the sea is a fluid (2026-10-11, world session, QUEUE Q274; PLAYTEST #74)

A splashdown used to be snapped upright with its bottom at sea level and frozen as landed: no waterline, no float, no
motion (Caio: "a craft landing in water stays there as if on land"). Now the water holds a vessel up by its own buoyancy.

**The numbers first** (before building; `study_sea.mjs` re-measures them). The parts are dense for their size: the command
pod is 840 kg in ~0.8 m³ of outline. With every tank empty, each preset's returning piece (everything above its top
decoupler) against the water its hull displaces:

| Piece | Mass | Hull | Density | Without bags |
|---|---|---|---|---|
| Probe (stage, tanks, core) | 1.75 t | 11.3 m³ | 155 kg/m³ | floats high |
| Beeper, Passenger Orbiter, Sounding, Docking (stage + package) | 0.8–1.5 t | 3.2–5.0 m³ | 220–330 | floats |
| Orbiter, Heavy, Asparagus, Lunar (pod + stage), Hopper (whole) | 1.2–2.7 t | 2.4–4.8 m³ | 460–570 | floats |
| Passenger (biocapsule) | 0.55 t | 0.9 m³ | 608 | floats |
| Sample Return, Big Lunar (pod + heat shield) | 1.1 t | 1.2–1.75 m³ | 660–900 | floats, barely (Big Lunar 12 % dry if fully loaded) |
| **Crewed Lunar** (crew capsule + shield, tower gone) | 1.64 t | 1.2 m³ | **1,370** | **sinks** |

So an honest sea sinks the crewed capsule. Real ones had flotation: Apollo's three uprighting bags at the apex. **Default:**
the pod and the crew capsule carry **flotation bags** (`float: 1.0` m³, `PARTS.pod`, `PARTS.crew`) that inflate at
splashdown, on top of the capsule. Caio may override (heavier bags, a separate part, or let crewed capsules sink).

**How it works** (`sim/flight.js` § "the sea"; one call each in `physStep` and `syncLanded`):
- **Buoyancy.** Each stack line's outer profile (`s.lines`, the aero's) is cut into slices up to 0.5 m tall, each slice a
  disc sampled at 8 points on the ring of radius r/√2 (that ring keeps the disc's waterplane moment, so the righting moment
  is right). A point under the water pushes up with ρ·g·(its share of the volume), smoothed over its own vertical extent
  so the force doesn't step. The bags are four more points above the capsule. Cached per shape (`seaPts`).
- **Open volumes.** An engine is an open bell: 35 % of its outline holds air (`SEA_KEEP`). Everything else is sealed.
- **Drag.** Each wet point drags against the water: quadratic (Cd 0.5 on its volume's face) plus a linear term for the
  waves it makes (500 N·s/m per m³), capped by its share of the mass as the ground's contact is. A capsule bobs 3–5 times.
- **The liquid's density** is the body's: a recipe's `rho` (Tethys's methane lakes, 450 kg/m³: almost everything sinks
  there), else sea water's 1,025.
- **Splash** (`seaCheck`, from `groundCheck`, which now looks at the sea before the "nose hit" test: a top dipping under
  the surface is not the nose in the ground): the touchdown verdict as before (speed against the sea's limit, 12 + 2 = 14 m/s);
  the bags go out; the main chute is cut. The old "sideways, destroyed" rule is gone: tipping is what water does.
- **Sinking at once:** fully under, still too dense, and deeper than its own length: "Sank — went straight to the bottom".
- **At rest** (under 0.3 m/s and 0.05 rad/s for 2 s) the vessel is **afloat** (`afloat`): `landed`, `s.water`, and
  `s.float` holds the rest pose, the wind's heading there, the share of the hull above water and `sinkAt`. From then on
  it's kinematic, so it holds on rails and at warp (`seaPose`, called by `syncLanded`): it heaves on two crossing swells
  (0.8 m, 8 s and 5.8 s; ~1.6 m peak to peak), rocks with their slope (less for a long hull), and drifts downwind at
  0.25 m/s. Staging or lighting an engine afloat clears it and the physics takes over again.
- **Flooding** (`sinkTime`): parts flood after `SEA_FLOOD` hours (engines at once, decouplers 2, adapters 6, tanks,
  instruments and probe cores 24, capsules 72, others 12). `sinkAt` is when what's still dry can't hold the vessel up.
  Then "Sank — flooded and went down", and the Debrief says "sank at sea".
- **Recovery** (`recoveryOf`, `sim/world.js`): the ships sail at 10 m/s after an hour's notice. If the vessel sinks before
  they arrive, it's lost (`kind: 'sank'`). Within the 200 km local reach that takes at most 6.6 h, and nothing floods
  that fast yet, so this bites only with the recovery fleet's longer range, or a leakier part.
- **SAS still works afloat.** The pod's wheel (10 kN·m) can hold a stage upright against a 2.5 kN·m righting moment until
  it saturates. Physical, so it stays.

**Measured** (`node study_sea.mjs [tilt] [v]`, SAS off, 7 m/s, so 9.5 m/s at the surface): every piece comes to rest in
6–23 s. Stages lie on their side (70–88°), 54–85 % dry. The Hopper floats upright, engine down, 53 % dry, if it comes down upright; tilted 30° or more it ends on its side. Big Lunar's
capsule floats upright, or at 24° when it hits tilted (a second stable pose of that hull, kept with the drag almost off).
The crew capsule floats upright on its bags, 28 % dry. The biocapsule (a cone, no bags) floats **apex down**, 41 % dry:
Apollo's "Stable 2", without the bags that righted it. A Hopper with 50 t in its tank sinks within 1 s. Sinks after: 24 h
(stages: the tank floods and the engine can't be held up) to 72 h (capsules).

**Checked:** test `sea-1` (`tests/world.mjs`): the Orbiter's piece on its side 65 % dry, the crew capsule upright, the
overweight piece sinks; afloat it heaves 1.6 m peak to peak and drifts 0.25 m/s, sinks at `sinkAt`; ships 51 km out
recover it 2 h later; a hull that floods in an hour is lost before they arrive. Full suite 630 PASS, 0 FAIL after two
fixes to flights that end in the sea: the pod's impact-prediction check now compares the predicted speed with the splash's
(`s.touchV`), not the last step before it is afloat; and `fly_crewlunar.mjs` stops forcing the capsule retrograde once it's
wet (`point` set the attitude and zeroed the spin every step, so it could never come to rest).
**Not seen in a browser yet** (TESTING 204).

**Not yet:**
- **The sea is drawn flat**, so the heave shows as a craft bobbing on still water. Q268 (the sea's look) should draw the
  same swell: `SEA_SWELL`, `SEA_SWELL_T`, and the 1.37 ratio between the two in `seaPose`.
- Q267's splash plays at `seaCheck`'s first contact (`s.wet` turns true there).
- Debris (spent stages that fell off) still end at the sea floor with a boom: `stepDebris` doesn't float them.
- Shallow water: the seabed doesn't hold anything up; a craft in 2 m of water floats as in deep water.
- Flooding is by part kind, not by damage: a hard splash doesn't hole the hull.
- Other landed vessels in the registry (not the one you fly) don't drift or sink.

## v1.142 — spent stages at sea, the seabed, holed hulls (2026-10-12, world session, QUEUE Q300 + Q301)

v1.122's "not yet" list, three of its lines: debris ended at the sea with a boom; a craft in 2 m of water floated as in
deep water; flooding was by part kind only.

**The numbers first** (`node study_sea.mjs debris`: every preset's dropped stages, empty, from 3 km at 120 m/s). Every
spent stage would float (they're 690–890 kg/m³ empty), but a bare stage comes down tumbling at **45–227 m/s**, three to
fifteen times the sea's 14 m/s limit. Real ones broke up (Saturn's S-IC, every expended Falcon 9). So an honest sea
breaks a bare stage, and **what brings one down slowly enough to float is a parachute**: the Shuttle's boosters (23 m/s
on three chutes) and Electron's first stage (~10 m/s). One 600 m² canopy brings most stages down at 6–9 m/s:

| Stage (empty) | Bare | 1 chute | 2 chutes |
|---|---|---|---|
| Orbiter's core, 2.5 t | 132 m/s, breaks up | 8 m/s, afloat on its side (84°), 77 % dry | 6 m/s |
| Heavy's side booster, 2.2 t | 124 | 8, side 65°, 70 % | 5 |
| Asparagus booster, 1.95 t | 116 | 7, side 42°, 68 % | 5 |
| Lunar's core, 12.9 t | 227 | 19: **breaks up** | 13, side 86°, 83 % (holed) |
| Big Lunar's small stage, 0.31 t | 45 | 3, upright, 83 % | 2 |

They all sink 24 h after they come down (the engine floods at once, the tanks at 24 h).

**How it works** (`sim/flight.js` § "spent stages at sea"; `shapeLines` lifted out of `rebuildShape` in `sim/vessel.js`,
behaviour unchanged):
- **Chutes on a stage.** A stage with chute parts among its parts opens them by itself, on the vessel's rules (drogue
  under 400 m/s, main below 3 km and under 250 m/s, reefed to `CHUTE_G`), one 600 m² canopy per chute part. It stops
  tumbling under a canopy. A chuted stage isn't dropped at 240 s (an hour instead) so it can reach the water; the 40 km
  limit from your craft still culls it.
- **The splash** (`debAfloat`): at or past the sea's limit it breaks up (the boom, as before). Slower, its hull is the
  vessel's (`shapeLines` + `seaPts` on its parts), and it lies the way Archimedes puts it (`debRest`): over the hull's
  tilt in the plane it came down in, the pose of least potential energy m·g·z_G − ρ·g·∫z dV, with the waterline where
  buoyancy equals weight. Checked against v1.122's full dynamics on every preset's returning piece: the same tilt within
  3° and dry share within 1 % for every stage. It differs where a hull has a second stable pose (the Hopper upright,
  Big Lunar's capsule at 24°, the biocapsule apex-down, the crew capsule on its bags), where the dynamics stop in the
  nearer one; for a stage, the deepest one is fine.
- **Afloat**, it rides the same swell and drift as a vessel (`seaBob`, lifted out of `seaPose`), until `sinkTime`.
  Too dense: it sinks at once, without a boom.

**Holed hulls** (Q301): a splash past `SEA_HOLE` (3/4) of the sea's limit holes the parts that hit the water first
(`seaForces` notes them before the splash is judged): they flood in `SEA_HOLE_H` (1 h) at 10.5 m/s, falling linearly
to 3 minutes at the limit. Only parts it speeds up count, so an engine bell taking the hit (it floods at once anyway)
holes nothing. A crew capsule's heat shield at 13.5 m/s: floods in 6 min; at 12 m/s in 39 min, and with the pod holed
too it sinks within the hour (before any ship arrives: `recoveryOf` says *sank*). The splash message says what's holed.

**The seabed** (Q301): `groundContact` now treats the seabed as ground under the sea (`bodyH`, not the sea level), so in
water shallower than the draft the craft stands on it; while wet, the hull's outline (`seaPts(s).hull`, 4 points per
slice) joins the foot points, so a hull on its side rests on the bottom too. A splash already judged isn't judged again
on the seabed. At rest touching it, the craft is **aground** (`aground`): landed in the sea, no swell, no drift, no
sinking; under the water entirely, it has sunk where it lies. An afloat craft that **drifts** into water shallower than
its draft (`F.draft`, its lowest wet point at rest) runs aground there: the pose latches and `sinkAt` becomes Infinity.
Measured: a crew capsule and the Hopper dropped at 9 m/s into 0.4–0.6 m of water rest aground (the Hopper leaning 83°);
the Orbiter's returning piece, on its side, draws less than 0.4 m and floats there.

**Checked:** test `sea-2` (`tests/world.mjs`): a capsule aground in 0.6 m of water; holed at 13.5 m/s and not at 9; the
drift latch; a bare stage breaks up at 132 m/s, a chuted one comes down at 8 m/s, floats at 84°, 77 % dry, moves on the
swell and is gone at `sinkAt`. `sea-1` unchanged.

**Not yet:**
- **The drop prediction** (`debrisImpact`, the drop-zone verdict) still falls with 2.5 m² of drag and no chute: a chuted
  stage lands near the predicted point but later, drifting with no wind. Every bare stage also falls with the same 2.5 m²
  whatever its size; from its outline (tumbling, mean projected area = surface/4) a big stage would drag more. Nothing
  judged here turns on it (all far over 14 m/s), but the drop zones would shift: a vehicle/world item if wanted.
- **Recovering a stage** is a sight only: no ship goes out, no refund (economy: a recovered stage could refund part of
  its price, as `recoveryOf` does for a returning vessel). And a floating stage is forgotten once you're 40 km away.
- **The canopy isn't drawn** on a falling stage (look & sound).
- **Can a stage carry a chute?** The Assembly may only allow one at the top of the stack; check whether a side
  booster's nose can take one (vehicle).
- The drift latch samples the pose: at high warp a craft can drift a little past where it would have grounded.

## v1.144 — a support town by every pad (2026-10-12, world session, QUEUE Q270; PLAYTEST #70)

Caio wanted a city in sight of the pad, seen from the air on the way up. `makeCities` placed 32 random cities, each at
least 160 km from the first site (and `extendSites` keeps later sites 40 km from them), so none was ever near. Real pads
have their towns close: Titusville and Cocoa Beach 15–20 km from LC-39, Leninsk ~35 km from Baikonur's pads.

**How** (`supportTowns`, `sim/world.js`, called at the end of `extendSites` once every site and its corridors exist):
for each pad (not the sea platform), a search over bearings every 10° and distances 15–60 km every 5 km:
- **Never under the corridor:** the bearing is at least 90° off the downrange heading and any polar one (`t.polar`'s S
  or N); 60° if nothing fits (no pad needed it).
- **Its ground:** land with a margin (`landValue` ≥ 0.545, and land 3 km out each way), under 1,200 m, clear of every
  city by its radius + 15 km and of every other pad by 15 km.
- **Score:** nearest 25 km, low, gentle, up-range over beside, a little seeded jitter.
- **Size and name:** 12–35 k people (rad 3.1–4.0 km, the cities' formula), a seeded name from the same syllables
  (" Beach" on a coast).
- **Appended** to `CITIES` after the random ones, which keep their order and indices (stations and contracts store
  indices); the town carries `town` (its site's id), `km` and `az`. So the city texture, night lights, the near-city
  buildings, `dropVerdict` and the map's city layer all have it with no change there.

**Result:** 15 pads, 15 towns, 15–35 km (twelve at 15–25), 90–160° off their corridors, all in their pad's country.
Home's Dunnzar Cape gets **Kaos Beach**, 15 km north-northwest on the coast (110° off the eastward corridor).

**Checked:** test `town-1` (`tests/world.mjs`); core test 13's "cities clear of the pad" now looks at the random cities
only. **Not seen in a browser** (TESTING 226).

**Side effect:** `CITIES` is 47 long instead of 32, so anything that picks a random city (image contracts, disasters)
picks differently for the same seed. It found a latent bug in core test 24's disaster watch: "the city nearest the pad"
is now Kaos Beach, whose pictures came in during the test's extra day (still within 12 h), and the next try cleared
`disDone` before reading it (and `!got` would also have looped on a 0 h delivery). The test now reads the qualifying
delivery whenever the goal is met: 5.3 h. `node career.mjs 3 3` prints the same table on `main` and with the towns.

**Not yet:**
- Towns don't grow with the era (Leninsk was a camp before it was a city); fixed 12–35 k.
- A town isn't drawn differently from a city (no launch-viewing crowds, no causeway).
- A rollout warning when a stage's drop zone nears a town: `dropVerdict` already knows, and towns are never downrange,
  so only an abort or a dogleg would find one.

## v1.189 — each school's pad site has its own ground (2026-10-13, world session, QUEUE Q105)

Q231 built the four schools' complexes on flat ground (notes/look.md § "The four schools' pads"), with Arsenal's hill
as a mesh. Q105 gives each site the ground its brief describes (POWERS.md § "School briefs", mock-ups Q227).

**How.** `siteShape(k, x, z, lo, wet)` (`sim/world.js`) is a height offset from the pad's own height, in the pad's frame
(x east, z south, metres, as the pad meshes). `terrainH` adds it within `SHAPE_R` (1.7 km) of a pad, inside the 2 km
levelled zone. Physics, landing, `seaAt`, the map and the shader all see the same ground. In the sky shader, `siteShapeG`
mirrors it term for term for the pad nearest the camera (`uSites[0]`; uniform `uPadK` = school, `lo`, wet). Change both
together. The school comes from `SITE_SCHOOL(t)`: the owner's school from `POWERS` in the SIM, set to `padSchoolOf` by
`app/gl.js`, so the ground follows the drawn pad (the program's own archetype, the tester's `SCHOOL_FORCE`).
- **Arsenal (2):** the hill behind the retaining wall (z −11). Behind the wall it matches the old mesh hill (4.6 → 12.6 m),
  then rises to 42 m by 260 m north and falls back by 1.4 km. Its flanks ease out past the wall's ends: narrow on the
  west, where the hall stands; wide on the east. The mesh hill (`hfield` in `arsenalPad`) is gone.
- **Coastal (3):** flat. A clearing of cut grass (r ~70 m, plus the rails and the assembly building), then dark, mottled
  jungle canopy, as colour only. The site's own colour is already rainforest at the equator, and only the contrast
  makes a treeline. The sea behind the pad (380 m south) only when wet.
- **Mountain (4):** the ridge climbs north past the terraces (9 m at their top, 37 m by 280 m). The ground falls away
  south of z 45 and east of x 70, by `lo`.
- **Isle (5):** a headland about 150 m wide, open to the north (the neck). The ground falls `lo` to the east, south and
  west over 70 m, with a wavy edge. Pasture-green colour on top.
- **`lo` and wet.** Pads stand on their levelled plateau at 66–1,332 m (seed 13; home 157 m). A sea next to the pad
  would need a cliff of hundreds of metres. So the fall reaches the sea (`lo = −(h+8)`) only on a **coastal site under
  60 m** (`SITE_WET`). Elsewhere it falls 45 m (`SHAPE_DROP`, less on a pad under 48 m): an escarpment above lower
  land, which rises back to the plateau by 1.7 km. *Default taken, not asked:* moving sites to real coastlines would
  touch the site search and economy's site rules; ask Caio if the sea matters more.
- **Everything else is unchanged.** Every complex's footprint stays flat (test), and so do Cape and Steppe. Past 1.7 km
  nothing changes, so neither do the 2–4.5 km blend, towns, rover spots (5–8 km) or the ground stations' horizon masks
  (first sample 1.84 km).

**The shader needed four things:**
1. **The march's air bound:** `ub` comes from the climate texel's maximum, which a hill above the plateau can exceed.
   Near the shaped pad, `terr` and the march's skip branch raise it to the pad height + 50 m.
2. **Step length:** inside the shaped zone, `m = 1`, so the march takes shorter steps on the steeper ground.
3. **The pad's paint:** `padGround`, Cape's apron and access road for every school, fades out where the ground is
   shaped by more than ~0.3 m. Before that, it painted concrete and asphalt up Arsenal's hill.
4. **Relief shading:** on the shaped ground the relief normal is halved toward the vertical. The sky shader's ambient
   is ~1 % of direct light, so the cut bank facing away from a low sun was pitch black.

**Two wrong first tries, measured:**
1. Copying the mesh hill's flanks exactly (0 → 8 m within 11 m past the wall's ends) gave slopes of 3.4. They drew as a
   rock-coloured band (view 151) and a black face (view 145).
2. A single hill whose foot line slides north beside the wall was worse (3.7): a short rise that moves sideways is a
   steep flank.
The kept form peaks at 1.3 in the two cut corners by the wall's ends, and is ≤ 1 elsewhere.

**Checked:**
- Test `site-1` (`tests/world.mjs`): footprints flat, past 1.7 km unchanged, Arsenal within 0.7 m of the mesh hill
  behind the wall, Mountain and Isle as above, and the wet cases are sea.
- Core 23's "pads levelled" now samples 10 m and 1.8 km (it sampled 1.5 km, inside the shape). Its `terrainSlope` at
  the pad allows 0.2 for Arsenal: that function differences ±15 m, which reaches the hill behind the wall (z −11).
  `groundNormal` (physics) uses ±1 m, so a rocket on the pad is untouched; only `toppleWhy`'s message would quote it.
- `--smoke` all passed with that fix.
- Stills of views 145–151, before and after: `output/launchpad/q105/` (RTX 3050, High). The shaders compile; frame
  times look the same within noise (5–7 ms).

**Not yet:**
- `padGround` is still Cape's layout for every school (Isle sits on Cape's 40 m apron, slabs and road). A per-school
  ground layout is the parts & pad beat's.
- Arsenal's access road now stops at the hill.
- The wet case isn't in any view: the home pad is 157 m up.
- Branch `q19-hdr` (Q19) has its own copy of the terrain march (`PTERR`). Merging it needs `uPadK` and the `ub`/`m`
  changes above.
