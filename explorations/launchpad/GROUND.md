# GROUND — the ground of every body (plan)
**Version**: 0.1.2 · **Author**: Caio Camargo + Claude (world session) · **Created**: 2026-10-08 · **Updated**: 2026-10-08
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
| G3 | **The march on Selene.** The march generalised (body uniforms, the recipe as a compile-time define), Selene's program, its colour through the `groundCol` hook (today's albedo and maria). `terrainProbe` per body; `gpuMs` at fixed views: lander at 2 m, rover, 1 km, 20 km, low orbit. | L | 🖥 | CPU/GPU agreement in mm near the camera; a frame budget (target: Tellus's pad view or better) |
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
- **0.1.2 (2026-10-08):** G2 built (v1.58): the recipe is in `sim/ground.js`, not live until G3; the measured numbers are in NOTES § v1.58.
- **0.1.1 (2026-10-08):** G1 built (v1.54).
- **0.1.0 (2026-10-08):** first plan (world session): code survey, the layer, eight generators, the per-body table,
  Selene in detail, slices G1–G7+, three decisions with defaults.
