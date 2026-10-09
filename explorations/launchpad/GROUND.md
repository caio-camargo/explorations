# GROUND — the ground of every body (plan)
**Version**: 0.1.3 · **Author**: Caio Camargo + Claude (world session) · **Created**: 2026-10-08 · **Updated**: 2026-10-08
**Status**: **Plan, not built.** QUEUE Q86 (ground per body, from [`SYSTEM.md`](SYSTEM.md)'s ground briefs) and Q18
(Selene's terrain) written as one plan, because Selene is the first user of the layer every other body needs.
**Purpose**: What the world lane builds so that each body has real ground: which shared generators, which body uses
which, how Selene gets craters, maria, slopes, shadows and horizons, and the slices to build it in.

Sources: NOTES § v1.25 (Tellus terrain, its CPU/GPU rules and negative results), § v1.37/v1.39 (surfaces, contact),
§ "Landing on a chosen point" (Q13), § R3/R4 (Selene locked; its geology), SYSTEM.md (ground briefs), ROADMAP M3/M5.

---

## Where it stands (code survey, 2026-10-08)

**Only Tellus has relief.** Every other body is a smooth sphere at `b.R`, in the physics and on screen. The places that
say so are the work list for slice G1:

| Where | Today, for a body other than Tellus |
|---|---|
| `groundAlt` / `groundR` / `aglAt` / `groundGap` (sim/world.js:190–198) | 0: the sphere |
| `terrainSlope` (world.js:268), `groundNormal` (sim/flight.js:23) | 0 / the radial up |
| `surfaceAt` (world.js:253) | `SURF_MOON` (regolith, μ 0.6, boulders in 15 % of 20 m cells via `surfaceHit`) |
| contact, touchdown, topple (flight.js:28–58); debris, `fall` (flight.js:116, 230) | through `groundAlt`, so the sphere |
| `siteAt` / `landAt` (sim/procedures.js:190–212, hover check :259) | through `groundAlt`, so the sphere |
| `MOON_PE` = 5 km (sim/space.js:516, "no relief yet") | the lowest registered moon periapsis |
| camera clamp (app/render.js:33), ship shadow plane (render.js:86) | R + 1.5 m; the radial up |
| rovers (sim/rovers.js:88–92, 170) | `groundR` + `rvBump` (1.5 m value noise) + `rvRock` (4 m cells) |
| drawing (app/gl.js SKY_FS :262–273; Nyx in `MOON_FS` :801–829) | a ray-cast sphere; craters are **shading only** (`crat()`, a float cellular noise), maria an albedo term |

Two existing facts any plan must keep:
- **Selene's geology is what's drawn** (R4). `selMare`/`geoAt` (rovers.js:274–275) recompute the shader's mare mask on
  the CPU with a `Math.fround` port of the float noise, and test §42 checks they agree at 3,000 points.
- **The sun never moves yet** (`SUN_DIR` = norm(1, 0.12, 0.05)): it sits **6.8° above Selene's equator**, for good,
  until M5. Selene's north pole always has a low sun; **everything south of 83.2°S is in permanent night**. With relief,
  crater floors further north go permanently dark as well. That is R4's "ice in shadowed polar craters", for free.

---

## The shape of it: one ground layer, recipes per body

1. **A body has a `ground` recipe**, in one place next to its definition (sim/core.js): which generators, their
   parameters, a seed. `ground:null` means no surface (Hyperion), and the sphere stays for bodies not built yet.
2. **One height function per body: `bodyH(b, u)`**, metres above `b.R` along the unit vector `u` in the body's own frame.
   Tellus's is today's `terrainH`, unchanged. `groundAlt`/`groundR`/`terrainSlope`/`groundNormal` dispatch on
   `b.ground` instead of `b === TELLUS`.
3. **Bake the big features, generate the small ones.** It's the same split Tellus uses. Each body with ground gets a
   baked equirectangular map at load (or lazily, on first approach): base height, a mask channel or two, and the
   upper bound `U`. The GPU reads it with `texelFetch` and the same B-spline (`wSpl`/`wTexUV`). Procedural bands on the
   integer hash add the detail, with octave-style level of detail. So:
   - **Exact where it must be:** v1.25's rules carry over unchanged: an integer hash (`ih3`), `texelFetch` with
     identical weights, `patan` (not GLSL `atan`), `sst` (not `smoothstep`), and constants injected from the SIM.
   - **The mare mask moves into the baked map.** It's baked once from today's noise, so `geoAt` and the shader both
     read the texture. That removes the one float noise shared across CPU and GPU (v1.25: "a float hash can't be shared
     between CPU and GPU"). It works today only because a mask edge can hide a disagreement; a height can't hide it.
     Test §42 then checks `geoAt` against the bake.
4. **Real gravity gives real shapes.** SYSTEM keeps every body's real surface gravity, so morphology that scales with g
   comes out right with no tuning. One example: the size where a simple bowl crater turns complex (terraces, a central
   peak) goes as 1/g. Features keep their km size and relief stays in real metres, as on Tellus (v1.25 decision).
5. **One march, many bodies.** The sky shader's `march()` gets the body as parameters: centre, radius, rotation,
   `TERR_TOP`, the baked map. The generators are compiled in per recipe, with one program per recipe built on first
   approach. That way Selene's march doesn't pay Tellus's branches. Only the body under the camera marches; the others
   keep their current far look.
6. **Who owns what.** The world lane owns height, the march, the physics consumers and the per-body masks. The look
   lane (sky & bodies beat, Q80–Q85) owns colour, through one hook (`groundCol(p, n, masks)`), so look items and ground
   items for the same body don't edit the same lines.

---

## The generators (shared; built in order of reuse)

| # | Generator | What it makes | Bodies | Built from |
|---|---|---|---|---|
| G-crater | **crater field** | bowls, raised rims, ejecta falloff; complex craters above the transition size (terraces, a central peak, a flat floor); size bands with a power-law count | Selene, Nyx, Enyo, Astraea, Theia (few), Eos (few), Tethys (few), Phoebe, Pavor, Metus, Erebus (highlands), seeded small bodies | new; placement like the volcano cones (one candidate per hashed cell, v1.25 `VOLF`), on cube-sphere cells (9 neighbours per band) |
| G-basin | **flood plains** | low, smoothed plains inside a mask: fewer craters (a younger surface), an optional liquid level | Selene's maria, Hesper's basalt plains, Theia's lava plains, Erebus's nitrogen basin, Tethys's lakes (a liquid level, like Tellus's sea) | the baked map; the mask in a channel |
| G-lump | **shape** | low-order displacement that's large next to R: an irregular body on a sphere | Nyx (mild), Phoebe, Pavor, Metus, seeded asteroids and comets | the integer-hash fbm at 2–3 octaves; the march's shell is simply thicker (SYSTEM § Seeded: "strong height noise on a sphere is the cheap default") |
| G-volcano | **shields and calderas** | wide shield cones, summit calderas, one hand-placed giant | Hesper, Enyo (the giant shield), Theia (calderas), Astraea (its lone mountain, Ahuna Mons) | Tellus's volcano cones, with the shape parameters exposed |
| G-carve | **channels and canyons** | a warped noise isoline carved to a depth; one hand-placed canyon | Enyo (the canyon scar, a third of the globe), Hesper (lava channels), Tethys (drainage) | Tellus's fjord carving (v1.25) |
| G-dune | **dunes** | wind-aligned ridges in a mask | Enyo, Tethys | new, cheap: a stretched ridged noise along a baked wind direction |
| G-ice | **ridged ice** | crossing double ridges and cracks; very few craters | Eos | new: cell edges (Worley distance) as double ridges |
| G-boulder | **boulders as relief** | rocks you see and drive around, near young rims | every crater body | today's `surfaceHit`/`rvRock` cells, given height in the march within ~200 m of the camera |

**Which generator transition sizes come out of gravity** (simple → complex, the Moon's ~18 km scaled by 1.62/g):

| Body | g (m/s²) | Simple → complex | What it means on screen |
|---|---|---|---|
| Selene | 1.62 | ~18 km | central peaks and terraces in the big craters, like our Moon |
| Enyo | 3.72 | ~8 km | as Mars (real value ~7 km) |
| Hesper | 8.87 | ~3 km | and its thick air screens out craters under ~2 km (Venus has none that small) |
| Theia / Eos / Tethys | 1.80 / 1.31 / 1.35 | ~16 / 22 / 22 km | as Selene, but few craters (young surfaces) |
| Erebus | 0.62 | ~47 km | almost all simple bowls |
| Nyx | 0.40 | ~73 km | simple bowls only |
| Astraea | 0.28 | ~100 km | simple bowls only, deep for their width |

---

## The bodies (Q86)

Priority is the epoch that first lands there (SYSTEM § "Where this sits").

| Body | Ground | Generators | Notes | When |
|---|---|---|---|---|
| **Selene** | highland craters to saturation; maria as smooth dark plains; a few big basins; polar dark craters | G-crater, G-basin, G-boulder | the full plan below; M3's finish line needs it (a crater landing, a rover on real ground) | **M3** |
| **Nyx** | a battered small moon, slightly lumpy | G-lump (mild), G-crater | R 150 km, g 0.4; the same march as Selene with a different recipe: cheap once Selene works | M3 (after Selene) |
| **Enyo** | craters, dunes, the canyon, the giant shield, layered ground, polar caps | G-crater, G-dune, G-carve, G-volcano, G-basin (the northern lowlands) | the richest rocky ground job; rovers drive here; the polar caps are a mask (look's colour plus an ice surface) | epoch 6 |
| Pavor, Metus | dark captured lumps | G-lump, G-crater | R 2–3 km: the lump is most of the shape | epoch 6 |
| **Hesper** | basalt plains, slab rock, a few shields, lava channels | G-basin, G-volcano, G-carve | seen by landers and radar only: modest detail, cheap. A lander lasts minutes, so the near field matters more than the far | epoch 6 |
| **Astraea** | cratered regolith, the bright-floored crater, a lonely mountain | G-crater, G-volcano (one cone) | g 0.28: the bright crater is a mask the look lane colours (salts) | epoch 7 |
| Hyperion | **none** | — | `ground:null`; an entry probe ends in the deep atmosphere (the space/vehicle lanes' job) | — |
| Theia | lava plains and calderas | G-basin, G-volcano, G-crater (few) | plumes are look and effects, not ground | epoch 7 |
| Eos | ridged ice, plumes | G-ice, G-crater (few) | plumes as above | epoch 7 |
| **Tethys** | lakes, dunes, drainage channels under haze | G-basin with a liquid level, G-dune, G-carve, G-crater (few) | the richest ground job here (SYSTEM). The liquid surface reuses the sea path (`s.water`, splashdown), with methane's density. Under 1.5 bar it also needs the atmosphere march, which the space/look lanes own | epoch 7 |
| Phoebe | a cratered lump | G-lump, G-crater | R ~20 km | epoch 7 |
| **Erebus** | a smooth nitrogen-ice basin, water-ice mountains, dark highlands | G-basin (the glacier), G-crater (highlands), G-volcano reused as blocky mountains | the basin is a mask the look lane colours | epoch 8 |
| Seeded small bodies | lumps | G-lump, G-crater | one recipe, parameters from `WSEED`. A true shape model (overhangs, contact binaries) would be new work, not planned | M4/M5 |

---

## Selene in detail (Q18)

R 348 km, g 1.62, no air, tidally locked (near side −X toward Tellus), a 104 h day.

**Relief budget.** Real metres, as on Tellus. The Moon spans about −9 to +11 km, mostly from basins far bigger than
Selene can hold (its circumference is 2,187 km). So: a total range of about ±5 km, a few basins of 150–300 km, and
`TERR_TOP` near 5 km. `MOON_PE` becomes per body: the ground's top plus a margin.

**Craters** (G-crater), all measured against the Moon's numbers once built:
- **Size bands.** Basins and craters over ~20 km are baked (the map is ~2.1 km per texel at 1024×512 on Selene, which
  draws them well). Below that, 5–6 procedural bands from ~20 km down to ~100 m, in steps of about ×2.5. Their
  cumulative count follows N(>D) ∝ D⁻², near saturation in the highlands and ~10× sparser in maria. Each band is
  dropped below ~2 pixels, as octaves are now.
- **Shapes.**
  - Simple bowls (D < 18 km): depth ~0.2 D, rim ~0.04 D high, ejecta falling off as (r/R)⁻³.
  - Complex craters: shallower relative to their width, with a flat floor, a terrace ring, and a central peak above
    ~25 km.
  - Fresh against degraded: a per-crater age softens rims and fills floors. Fresh ones are few, sharp and bouldery.
- **Overlap.** Bands add, and within a band the deeper bowl wins. Old craters are softened by younger ones landing on
  them through the age term, not by simulating it.

**Maria** (G-basin): the baked mare mask, the same patches as today's, so geology agrees with the bake. Inside the
mask, the ground drops ~1–2 km into a smoothed, slightly domed plain, with the crater bands thinned 10×, plus a few
wrinkle ridges (G-carve inverted). **Where the maria sit is an art call** (see Decisions): today they're mostly on the
far side, the reverse of our Moon.

**Slopes.** These are what make a crater landing a design problem (pillar 2).
- Fresh bowl walls run 30–35°, past `TOPPLE` (24°), so landing inside a small fresh crater tips you over, and so does
  landing on its rim. Mare floors are gentle.
- `terrainSlope` becomes real, and the radar and HUD slope readout works on Selene.
- G5 gives `landAt` a hazard check: pick the flattest spot within ~100 m of the target before the final descent.

**Shadows.** On an airless body, a shadow is black: there's no sky light to fill it. Today nothing on any body casts a
shadow (shading comes only from normals, plus Tellus's cloud shadow).
- **Far:** a **sun-horizon map** per body. For the sun's current direction in the body frame, store per texel the
  horizon elevation toward the sun. Refresh it when the sun has moved ~0.5° (on Selene that's every ~9 minutes of game
  time; never, until M5, on a body that doesn't turn). Each pixel then pays one texture read.
- **Near** (within ~2 km): a short shadow ray through the procedural bands, so small craters and boulders cast their
  own shadows.
- R4's panorama quality (which today uses the sun's height alone) can later read whether the view actually has
  shadows.

**Horizons.** Selene is small: the horizon is **1.2 km** from a 2 m eye, 2.6 km from 10 m, and a 1 km rim stands
above it from **28 km** away. Crater rims make the skyline, which is most of the look of being there. That needs no
extra work: the march draws it. What it does need:
- **contact by line of sight** on the ground: rover to lander, rover to rover, and to Tellus near the limb. That's
  `gsSees`'s horizon mask, generalised from ground stations to any point on any body;
- the pass scan in `landAt` checks the low orbit against the ground (Q13's "Not yet"; 10 km stays safe under a 5 km
  top).

**Polar dark craters.** With the sun fixed at declination +6.8°, the highest it ever gets at a southern latitude φ is
90° − |φ| − 6.8° (below zero past 83.2°S), at local noon, due north. A point on a crater floor is permanently dark
when the crater's north rim, seen from that point, stands higher than that. That's computed per crater, analytically,
from its depth and width. Those
floors are R4's polar ice deposits, a mask the spectrometer (or a later neutron instrument) can read. At M5 Selene gets
a real tilt and the sun moves; the test then becomes the true permanent-shadow integral.

**Rovers.** `rvGroundR` = `bodyH` plus today's `rvBump`/`rvRock`, and `rvNormal` already differentiates whatever
`rvGroundR` returns, so rovers pick up relief with no change in code. Their tests need sites re-chosen on flat ground,
or tolerances checked.

---

## Slices (the fan-out)

All are world lane unless stated. Load per QUEUE's legend. The first two are headless.

| # | Slice | Size | Load | What it proves / measures |
|---|---|---|---|---|
| G1 | ✓ **built** (v1.54, NOTES § v1.54) — **The layer, no new relief.** `b.ground`, `bodyH`, the dispatch in `groundAlt`/`groundR`/`terrainSlope`/`groundNormal`, per-body `TERR_TOP` and `MOON_PE`, camera clamp, shadow plane (`surfaceAt` moved to G2: recipes get their own surfaces). Selene and Nyx return 0. | M | ⚙ | the whole suite passes unchanged (proof the dispatch is neutral) |
| G2 | ✓ **built** (v1.58, NOTES § v1.58; `geoAt` reading the bake moves to G3, with the shader) — **Selene's map and craters on the CPU.** The baked map (basins, maria flooded from the baked mare mask), the crater bands, `geoAt` on the bake (test §42 retargeted). A Node study, `study_ground.mjs`: crater counts against N(>D), slope histograms per unit, relief range, flat-site share, the polar dark area. | M | ⚙ | the numbers behind every parameter, before any pixel |
| G3 | (port plan: § "G3: the port plan" below) **The march on Selene.** The march generalised (body uniforms, the recipe as a compile-time define), Selene's program, its colour through the `groundCol` hook (today's albedo and maria). `terrainProbe` per body; `gpuMs` at fixed views: lander at 2 m, rover, 1 km, 20 km, low orbit. | L | 🖥 | CPU/GPU agreement in mm near the camera; a frame budget (target: Tellus's pad view or better) |
| G4 | **Shadows.** The sun-horizon map plus near shadow rays. | M | 🖥 | shadow cost; a low-sun view and an orbit terminator view |
| G5 | **Consumers.** Landing hazard checks and orbit clearance (with space: `landAt` is theirs, so the change is an `ACTIVE_WORK.md` line), line-of-sight contact on bodies (`gsSees` generalised), polar dark floors as an R4 deposit mask, rover tests on relief. | M | ⚙ | the crater-landing M3 finish line is flyable |
| G6 | **Nyx.** Its recipe (mild lump plus craters) in the same program. | S | ⚙ + 🖥 | the recipe system is real, not Selene-shaped |
| G7+ | **Planets**, one item per body from the table above, adding generators as first needed: Enyo (G-dune, G-carve, the giant shield) → Hesper → Astraea → Theia/Eos/Tethys/Phoebe → Erebus → seeded lumps. Each body: a recipe, its bake, a `study_ground` line, a view in Q79's "go to body". | M each | ⚙ then 🖥 | after G3 and Q79 |

**Risks, and what to measure first:**
- **Frame cost.** Tellus measured 8.8 ms over rugged hills at a grazing angle, set by warp divergence near the
  horizon, not by octave count (v1.25 negative results). Selene's near horizon helps, because rays leave the shell
  sooner. The crater bands loop over 9 cells each, where an octave costs one noise call, so **G3 has to time a crater
  band before stacking six**. The fallback is a crater mosaic tile baked into a texture (exact on both sides through
  `texelFetch`), used for the finest two bands.
- **Bake time and memory.** Tellus bakes in 0.4–0.85 s, with 7 Float32 maps of 2 MB each. A body baked lazily on
  first approach must not stall a flight: bake in a worker (Q38) or during the transfer.
- **Tests that assumed a smooth Selene:** §27 (crewed Selene), bodies-1 ladders, bodies-3 landing sites, §42 geology,
  rover tests. G1 keeps them green by construction. G3/G5 re-check them with relief and record which moved.

---

## G3: the port plan (Selene's relief in the sky shader)

Plan only (world session, 2026-10-08; QUEUE Q91, which waits for the milestone gate). It's written so the session that
has the GPU can start at step G3.0 cold. The rules are v1.25's (NOTES § v1.25 "CPU/GPU agreement is designed in" and the
negative results), applied to `sim/ground.js`.

### What the shader does today (app/gl.js, SKY_FS)
- Tellus is one ray-march, `march(d,hh,tS)`, through the shell from R to R + `TERR_TOP`. It skips air on the climate
  texture's bound, drops octaves by pixel footprint and distance (`octF`/`octT`), and ends with 5 bisection steps. The
  quarter-resolution pre-pass `PDEPTH` (the same SKY_FS with a main that only marches) seeds it through `coarseStart()`.
- Selene is a ray-cast sphere: `sph(uMc,uMcc,d)` in `main`. Its look is `crat()` slope shading (a float cellular
  noise), a mare albedo term and `detail()` within 3 km, all in Selene's frame through `MB()`/`uMrot`. Nyx is a separate
  pass (`MOON_FS`) and isn't part of G3.

### Shape of the change
- **A second march, generated from the first.** `march()` becomes a JS template that emits one march per body: its
  uniforms (centre, R, top, rotation), its height function and its bound. SKY_FS gets `marchT()` (Tellus, unchanged
  code) and `marchS()` (Selene). In `main`, `tM` comes from `marchS` instead of `sph`, and the nearer hit wins, as now.
  GLSL has no function pointers, and the code already injects JS constants into the shader, so a template costs nothing
  at run time.
- **The pre-pass writes the nearer of the two hits.** `coarseStart()`'s value is a safe start for both marches, because
  it's never past either hit.
- **Always march Selene, no handover.** Its shell is at most ~6 km thick (−4 to +1.6 km, plus the bands), so a ray that
  misses the shell costs one sphere test, and from Tellus orbit Selene covers a few hundred pixels. So the far look and
  the near look are the same code. **Measure that first** (G3.1): if Selene at full screen from high orbit costs more
  than its shading does today, add a distance cut on the bands, not a second look.
- **Colour through one hook,** `selCol(pf, n, mare, fresh)`. The look lane (sky & bodies beat, Q80–Q85) owns what's
  inside; the world lane owns the height, the march and the masks. This replaces `crat()` and the float mare term on
  Selene: relief normals do the shading, and the mare mask comes from the map texture.

### The height function in GLSL
- **The map:** one RGBA32F texture, 1024×512 (8 MB; NEAREST, read with `texelFetch`). Channels:
  - `E`, the base height;
  - `M`, the mare mask;
  - `U`, an upper bound: the max of `E` over ±2 texels, plus the bands' largest possible rims;
  - a spare channel for G5's dark-floor mask.
  The B-spline is `wTexUV` generalised to a texture and its size. `patan` replaces `atan`, and the UV is computed the
  same way as `mapSpl`'s.
- **The bands:** a loop over the 3 axes, skipping faces with |u_ax| < 0.5. Each face does a 3×3 cell loop, which exits
  after the first hash for the ~62 % of cells with no crater. Each band's constants (`n`, `Dhi`, `Dlo`, `λ`) are
  injected from `grBands(R)`. The hash calls are `ih(ivec3(key, zz, 7001…7006))`, the same integers as `ih3` on the
  CPU.
- **What must be bit-identical, and how:**

| Quantity | Risk | Fix |
|---|---|---|
| crater centres (`Math.tan` of the equiangular coordinate) | GLSL `tan` ~1e-5 rad off: **up to 3.5 m on Selene**, a visible wall offset on a 100 m crater | **G3.0:** CPU and GPU both use one polynomial, `ptan` (a Padé form on ±π/4, good to ~1e-8). The CPU changes first, so the CPU's ground *is* the formula |
| the cell index (`Math.atan` of u_p1/u_ax) | a flip at a cell border | harmless: the 0.8-of-the-narrowest-cell margin covers a one-cell shift (a crater two cells away can't reach). Use `patan` anyway, on both sides |
| presence and thinning tests (`hash < λ`, `hash < 0.85·sstep(M)`) | a hash within float error of the threshold flips a whole crater | inject `λ` as `Math.fround(λ)` and compare with fround on the CPU too. Thinning reads `M` at the crater centre by `texelFetch` NEAREST (no interpolation), so both sides read the same texel; a centre on a texel border is the only flip left, expected about 1 crater on all of Selene. Accepted; `terrainProbe` would show it |
| powers (`r^1.6`, `(D/Dt)^0.301`) | GLSL `pow` ~1e-6 relative | ≤ 4 mm on a 4 km crater: accepted |
| distance to a centre, \|u − c\|·R | float32 unit vectors: ~3 cm on R = 348 km | as Tellus (mm–cm near the camera); computed from `pf` as Tellus does |

- **Level of detail:** like `octF`/`octT`.
  - Drop a band once its largest crater is under ~2 pixels across.
  - Keep all six within 2 km of the camera (the physics' ground, to the centimetre); ease to 3 bands by 20 km.
  - The bound for the dropped bands is the sum of their largest rims, `.036·Dhi` each. It plays the role of Tellus's
    `bnd` term, and the march steps on it as it does now.
- **Cost estimate (to replace with measurements).** Tellus's full-detail height is 9 octaves × 8 hashes ≈ 72 hashes and
  9 fetches. Selene's is 6 bands × 9 cells, with an early exit: about 54 + 0.38·54·5 ≈ 160 hashes, plus 9 fetches and
  one `pow` per crater. So **about 2× Tellus per height** at full detail. Selene's thin shell and close horizon end
  rays sooner. Expect the same order as Tellus's pad view (4.2 ms at 1024×768 on the RTX 3050 laptop); grazing views are
  the risk, as on Tellus.
- **Fallbacks if it's over budget**, cheapest first:
  1. stop the finest band (80–200 m) beyond 300 m;
  2. a baked **crater tile**: one periodic texture of small craters indexed by cube-cell coordinates, read by
     `texelFetch` on both sides (still exact), replacing the two finest bands;
  3. Tellus's own unexplored idea, reusing last frame's depth.

### Steps (each one a commit with its own check)

| Step | What | Load | Done when |
|---|---|---|---|
| G3.0 | CPU: `ptan` and a JS `patan` in the band geometry; `λ` through `Math.fround` | ⚙ | `study_ground.mjs` shows the same counts, slopes and seams; ground-2 passes; heights move by under 1 cm (an old/new diff at 10,000 points) |
| G3.1 | GPU: Selene's map texture, `marchS` with the map only (no bands), the pre-pass with both hits; `terrainProbe(SELENE)` against `seleneH(pf, 0)` | 🖥 | agreement as Tellus (median ≤ 2 mm, p99 ≤ 3 cm, max ≤ 15 cm); `gpuMs` in the five views below vs today |
| G3.2 | GPU: the bands, one at a time, with level of detail and the dropped-band bound | 🖥 | probe agreement within 2 km of the camera; `gpuMs` per band count (the decision point for the fallbacks) |
| G3.3 | shading through `selCol`: relief normals, mare from `M`, fresh craters brighter (the band loop also returns the freshest crater's freshness under the point); `geoAt` reads the bake (§42 compares it to the bake) | 🖥 | the look lane's review from stills; TESTING 131 re-judged |
| G3.4 | **Going live**, below | ⚙ + 🖥 | the full suite, the robot run, TESTING rows for landing and driving on relief |

**Views for timing and stills** (add to `views.js`, after Q79's numbering): a lander 2 m over a mare flat; a crater rim
at a 5° sun; rover eye height in the highlands; 1 km over the highlands; 20 km; low orbit (30 km); Selene from Tellus
orbit.

### Going live (G3.4): what flips when `SELENE.ground = SELENE_GROUND`
- **Saves:** anything landed on Selene was stored on the smooth sphere (`R`): landed registry entries, rovers in the
  field (`PROG.rvOut`), bases, recorded landing spots (`land.pf`). Relief is −4 to +1.6 km, so on load they'd be
  buried or floating. Migration: re-seat each one's `pf` onto `groundR` along its own direction, once, keyed on a save
  version. This needs Q57 (save versions, platform lane).
- **Tapes:** `TAPE_V` fingerprints the *code* that moves a craft (procedures.js:13). Switching the recipe on changes
  *data*, so old Selene tapes would replay unretired onto new ground. Add the recipe (`gen` plus a hash of
  `seleneH`'s source and the band constants) to the fingerprint. Procedures survive, as designed.
- **Tests that land on Selene** (§27 crewed Selene, bodies-1 ladders, bodies-3 landing sites, the rover sections, §42)
  were measured on a sphere. Re-run them, record what moved (touchdown speeds, Δv left, landing error), and re-pick sites
  on flat ground where a check depends on a flat landing. `landAt`'s 5 m precision should hold: it reads the ground at
  the site.
- **`MOON_PE`** = 5 km + `top`. With `top` 4 km the lowest registered orbit becomes 9 km. Tighten `top` to the measured
  bound (≈ 2 km: 1.6 km map max + band rims) so it's 7 km. The 10×20 km landing orbit then stays registered.
- **The bake's 1 s:** going live makes the first approach to Selene bake mid-flight. Bake at idle after load
  (`requestIdleCallback`; the CPU and the GPU upload together), and share Q38's worker if that has landed.
- **Who to tell** (`ACTIVE_WORK.md` lines): space (procedures, rovers, §42); look & sound, sky & bodies beat (`selCol`,
  SKY_FS's `main`); effects (the landing dust uses the ground under the ship: it should already follow `groundAlt`);
  QA (the robot's Selene rows).

---

## Decisions for Caio (defaults hold if silent)

1. **Where Selene's maria sit.** Today they're mostly on the far side: 1.2 % of the near side is mare, against the
   Moon's 31 %. **Default: move them to the near side, Moon-like,** when G2 bakes the mask. The geology follows the
   bake. It's an art call because it changes how Selene looks from Tellus.
2. **Can G1–G2 start before M3 opens?** They're headless, and they're the shared layer every SYSTEM body's ground
   needs; ROADMAP already lets "look and ground for a body" start early. **Default: yes,** G1–G2 now. G3 onward waits
   for M3 (or the per-body rule).
3. **Relief in real metres** on small bodies, as on Tellus. **Default: yes.** The alternative is relief scaled 1/5
   with the radius, which would flatten Selene's craters to a fifth of their depth.

---

## Version history
- **0.1.3 (2026-10-08):** § "G3: the port plan": the march as a per-body template, what must be bit-identical (`ptan` for crater centres), cost estimate and fallbacks, steps G3.0–G3.4, and what flips when the recipe goes live (saves, tapes, tests, `MOON_PE`, the bake).
- **0.1.2 (2026-10-08):** G2 built (v1.58): the recipe is in `sim/ground.js`, not live until G3; the measured numbers are in NOTES § v1.58.
- **0.1.1 (2026-10-08):** G1 built (v1.54).
- **0.1.0 (2026-10-08):** first plan (world session): code survey, the layer, eight generators, the per-body table,
  Selene in detail, slices G1–G7+, three decisions with defaults.
