# SYSTEM — the star system catalog
**Version**: 1.0.0 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-08 · **Updated**: 2026-10-08
**Status**: **Approved by Caio 2026-10-08 as the base.** Lanes may build from it. Names are placeholders (Caio will
revisit them), and he may revisit details at the margins; the shape, the scaling rules and the defaults below hold.
**Purpose**: What exists in the star system, fixed on paper so each body can become its own work package
(ROADMAP § "The system catalog"). Shape chosen by Caio on 2026-10-08: **option A, a compact system with about 6 planets**.

All numbers are patched-conic arithmetic (circular, coplanar Hohmann transfers, departure
from a 150 km Tellus orbit). They're for sizing; the space lane re-measures on its rails.

---

## How the system is scaled

Tellus and Selene already fix a set of rules (NOTES § "The planet's size"). Every other body follows the same rules,
so the system feels like one place:

| Rule | Tellus/Selene precedent | Applied to |
|---|---|---|
| **Radius × 1/5** of the real-world analogue | Tellus 1,274 km, Selene 348 km | every hand-made body |
| **Surface gravity as in reality** | 9.81 and 1.62 m/s² | every hand-made body (so mass = g·R²) |
| **Day ÷ 3** | Earth 24 h → Tellus 8 h | rotation periods |
| **Moon distances × 1/10** (half as many parent radii) | Selene at 38,440 km = 30 R | moons, unless that would put a moon inside ~2.5 parent radii; then the real radius count is kept |
| **Real atmospheric scale heights and surface pressures**, capped where the real air is deeper than the body is wide | Tellus: H 7.5 km, 100 km of air | atmospheres |
| **Real distances from the star in Tellus units (TU)** | — | planets: Hesper 0.72 TU like Venus, etc. |

**The star's mass is a dial.** The year is fixed: 400 program days of 8 h (NOTES § "Time, long missions"). With
the year fixed, the star's mass sets how far out Tellus is and how fast it moves, which sets the cost of everything
heliocentric. Tellus's Hill sphere doesn't depend on it at all (261,000 km, so Selene and Nyx are safe at any mass).

| Star μ (m³/s²) | Tellus's orbit | Tellus's speed | Δv from 150 km to Enyo / Hyperion |
|---|---|---|---|
| 3.0e17 | 10.0 Gm | 5.5 km/s | 1,416 / 1,653 |
| **1.17e18 (default, Kerbol's)** | **15.8 Gm** | **8.6 km/s** | **1,460 / 2,025** |
| 5.0e18 | 25.6 Gm | 14.0 km/s | 1,581 / 2,930 |

Escaping Tellus alone costs 1,385 m/s, so the inner planets cost about the same whatever the star. The dial mostly
prices the outer system. Default: Kerbol's mass, which is KSP-like and puts Hyperion about where Jool is. It is not a
physical star (about 1/113 of the Sun), in the same spirit as Tellus's density.

---

## Overview

| Body | Kind | Orbits | a | Period | Transfer from Tellus | Window every | Δv to depart (from 150 km) | Known at start? |
|---|---|---|---|---|---|---|---|---|
| **Helios** | the star | — | — | — | — | — | — | yes |
| **Hesper** | hot cloud-wrapped rocky planet | Helios | 0.72 TU (11.4 Gm) | 244 d | 160 d | 1.57 y | 1,441 | yes |
| **Tellus** | home | Helios | 1 TU (15.8 Gm) | 400 d (the year) | — | — | — | yes |
| Selene | major moon (exists) | Tellus | 38,440 km | — | 2.4 d | — | — | yes |
| Nyx | small eccentric moon (exists) | Tellus | 8,100–27,900 km | 33.4 h | 0.8 d | — | — | **found** (v1.53) |
| **Enyo** | small cold red planet | Helios | 1.52 TU (24.0 Gm) | 1.87 y | 283 d | 2.14 y | 1,460 | yes |
| Pavor, Metus | captured moonlets | Enyo | 1,900 / 4,600 km | 3.5 / 13.2 h | — | — | — | **found** |
| **Astraea** | dwarf planet, largest in the belt | Helios | 2.77 TU (43.7 Gm) | 4.61 y | 1.29 y | 1.28 y | 1,726 | yes |
| **Hyperion** | ringed gas giant | Helios | 5.2 TU (82.1 Gm) | 11.9 y | 2.73 y | 1.09 y | 2,025 | yes |
| Theia, Eos, Tethys | major moons | Hyperion | 42,170 / 66,940 / 106,260 km | 6.9 / 13.7 / 27.5 h | — | — | — | yes (telescope) |
| Phoebe | captured retrograde moon | Hyperion | ~1,000,000 km | 33 d | — | — | — | **found** |
| **Erebus** | distant icy dwarf | Helios | 8.25 TU (130 Gm), e 0.2 | 23.7 y | 4.97 y (less with a Hyperion assist) | 1.04 y | 2,198 | **found** |

Plus the seeded classes (§ "Seeded per world"): near-Tellus asteroids, the belt's small bodies, trojans, comets,
interstellar visitors.

**Names** are one family: Helios, Selene and Eos are siblings in Greek myth, children of the Titans Hyperion and
Theia; Nyx is night and Erebus is her brother, darkness. Hesper is the evening star (Venus), Enyo a war goddess (Mars's
role), Pavor and Metus are dread and fear (Phobos and Deimos), Astraea the star-maiden, Tethys a Titaness of the
sea (fitting for a moon with seas), Phoebe another Titaness (and Saturn's real captured moon). **Placeholders**
(Caio, 2026-10-08: naming is revisited later). Code should keep names in one place so a rename is one edit.

**Where this sits in the game.** Epochs 1–5 end at Selene and Nyx. The planets are M5 (the star-centred system and
the year, heliocentric rails). Proposed: **epoch 6, the near planets** (Hesper, Enyo); **epoch 7, the outer system**
(Astraea, Hyperion); **epoch 8, the edge** (Erebus, visitors). Looks and ground can be built before M5 against a
tester "go to body" view (ROADMAP).

---

## The bodies

Each entry: physical, orbit, look brief, ground brief, role. Real-world analogue numbers are already scaled.

### Helios — the star
- **Physical:** μ 1.17e18 (dial above). Colour: yellow-white, as the renderer's sun today.
- **Look brief:** the sun the game already draws; the change at M5 is that it moves through the sky with the year
  and gets smaller and dimmer from the outer planets (Hyperion sees it at 1/27 the brightness). *References:* SDO's
  visible-light Sun; the Sun from Saturn in Cassini's backlit ring images.
- **Role:** the frame for M5. No missions of its own yet (a solar observatory is a possible later payload).

### Hesper — the hot cloud world (Venus)
- **Physical:** R 1,210 km, g 8.87 m/s² (μ 0.82 Tellus), rotation 243 program days **retrograde** (slower than its
  year), tilt 177°. **Atmosphere:** CO₂, 90 bar at the surface, H 15.9 km, about 250 km deep; 460 °C at the ground;
  a sulphuric cloud deck at 45–65 km, where pressure and temperature are Tellus-like. No magnetic field.
- **Orbit:** 0.72 TU, e 0.007, i 3.4°. Arriving v∞ ~800 m/s; capture into a 260 km orbit ~1.3 km/s, or nearly free
  by aerocapture through that thick air.
- **Look brief:** from space, a featureless cream-yellow ball; only in a UV view do chevron-shaped cloud bands show. The
  brightest thing in Tellus's sky after Selene. Below the clouds, a dim orange world under a heavy overcast.
  *References:* Venus by Mariner 10 / MESSENGER (visible), Akatsuki's UV images; the Venera 13 surface panoramas.
- **Ground brief:** volcanic basalt plains, slab rock, a few shield volcanoes and lava channels. Seen only by landers
  and by radar, so modest detail is fine.
- **Role (epoch 6):** the closest planet and the first planetary mission. *Design problems (pillar 2):* aerocapture
  and entry heating; **a lander that lasts minutes** (pressure and heat: the clock is the mission, like Venera); a
  radar mapper that reveals a hidden surface (**pillar 4**). *Gives back:* science, a surface map.
  *Possible new part:* a balloon at 50 km (it would need a pillar check, ROADMAP § "Systems are complete").

### Tellus — home (exists)
- As built: R 1,274 km, 9.81 m/s², 8 h day, 100 km of air. **New here:** its orbit (1 TU, e ≈ 0.017) and the
  **axial tilt: 23°** (decision 3; seasons at M5).

### Selene and Nyx (exist)
- As built and as NOTES describes them (§ "More bodies", § v1.53). Unchanged; listed so the catalog is complete.
  **New here:** Selene's L4/L5 trojans as a seeded class.

### Enyo — the cold red planet (Mars), with Pavor and Metus
- **Physical:** R 678 km, g 3.72 m/s² (μ 0.11 Tellus), day 8.2 h, tilt 25°. **Atmosphere:** CO₂, 0.006 bar, H 11 km,
  with dust storms. Polar caps of water and CO₂ ice. No global field.
- **Orbit:** 1.52 TU, e 0.09, i 1.9°. Arriving v∞ ~760 m/s; capture into a 30 km orbit ~770 m/s.
- **Moons:** **Pavor** (R ~3 km) at 1,900 km, inside the synchronous orbit (3,350 km), so it rises in the west and
  crosses the sky twice a day, like Phobos. **Metus** (R ~2 km) at 4,600 km. Both are dark captured asteroids.
- **Look brief:** butterscotch and rust, dark basalt patches, white polar caps, a canyon scar across a third of the
  globe and a giant shield volcano. A thin pink-tan sky, blue at sunset. *References:* Viking orbiter mosaics; Curiosity's
  Gale crater panoramas (and its blue sunsets). Moons: HiRISE's Phobos and Deimos.
- **Ground brief:** craters, dunes, canyons, the volcano, layered sediment, ice at the poles; boulders like Selene's.
  Rovers drive here (rovers exist, R3/R4).
- **Role (epoch 6):** *Design problems:* **air too thin to stop you and too thick to ignore** (chutes help but a
  retro burn or a sky crane is still needed: pillar 2); dust storms as weather; a relay orbiter that stays and matters
  (**pillar 3**). Pavor is a cheap staging base. *Gives back:* polar water (ISRU), rover science, a possible crewed
  goal late. The planet most players will care about after Selene.

### Astraea and the belt (Ceres; the belt is seeded)
- **Physical:** R 94 km, g 0.28 m/s², escape speed 229 m/s, day 3 h, no air. Dark rock with **bright salt spots**
  in one young crater. The belt (2.2–3.3 TU) is otherwise seeded (below).
- **Orbit:** 2.77 TU, e 0.08, i 10.6°. **Costlier to reach than Enyo:** 1,726 to depart and ~1,270 m/s to match
  speeds at arrival, because its gravity is too weak to help.
- **Look brief:** charcoal grey, cratered, with the salt spot as the one bright point. *References:* Ceres by Dawn
  (Occator's bright spots); Vesta by Dawn.
- **Ground brief:** cratered regolith, the bright-floored crater, a lonely mountain (Ahuna Mons).
- **Role (epoch 7, bridges M4):** *Design problems:* landing where gravity barely holds you (closer to docking);
  a plane change of 10°. *Gives back:* water and salts for a depot (M4 depots, **pillar 3**).

### Hyperion — the ringed giant (Jupiter's banding, Saturn's rings), with Theia, Eos, Tethys and Phoebe
- **Physical:** R 13,982 km (the 1-bar level), g 24.8 m/s² (μ 305 Tellus), day 3.3 h, tilt **27°** so its rings open
  and close as seen from Tellus over its 12-year orbit. H₂/He atmosphere, H 27 km; no surface. Bright **rings** at
  18,000–31,000 km (1.3–2.2 R). Strong magnetic field (flavour only: radiation would be a new system).
- **Orbit:** 5.2 TU, e 0.05, i 1.3°. Its SOI is 9.1 Gm. Arriving v∞ ~1.6 km/s, but **a low orbit costs ~7.7 km/s**
  because it's so deep. The design problem is getting captured cheaply: burn low (Oberth), or slow down at a moon.
- **Moons** (Theia : Eos : Tethys periods are 1 : 2 : 4, like Io, Europa and Ganymede; the resonance is the story of
  why the inner two are heated):
  - **Theia** (Io): R 364 km, g 1.80, at 42,170 km (3.0 R). Volcanic: sulphur yellows and reds, active plumes.
  - **Eos** (Europa + Enceladus): R 312 km, g 1.31, at 66,940 km. White ice, red-brown cracks, water plumes over a
    buried ocean.
  - **Tethys** (Titan): R 515 km, g 1.35, at 106,260 km. **Thick orange haze, 1.5 bar of N₂ and methane** (H ~20 km,
    capped ~200 km deep), methane lakes and dunes.
  - **Phoebe** (Phoebe): R ~20 km, dark, at ~1,000,000 km, **retrograde** (i 175°), e 0.16. Captured; found, not known.
- **Look brief:** cream and ochre bands, a storm spot, the rings casting a shadow on the clouds; a strong object in
  Tellus's sky (a telescope shows the rings). *References:* Jupiter by Juno/Cassini for bands; Saturn's rings by
  Cassini. Moons: Io and Europa by Galileo, Enceladus's plumes and Titan's haze by Cassini, Huygens's descent images.
- **Ground brief:** none for Hyperion. Theia: lava plains and calderas; Eos: ridged ice and plumes; Tethys: lakes,
  dunes and drainage channels under haze (the richest ground job here); Phoebe: a cratered lump.
- **Role (epoch 7):** the long mission. A 2.7-year transfer is about **one compute era**, matching the time design
  (NOTES § "Time, long missions": continues in the background and pays along the way, **pillar 5**). *Design
  problems:* capture; **an entry probe into the giant** (the hardest heating in the game, ~26 km/s: pillar 2); the
  moon tour with assists; **Tethys, where parachutes do everything** (low g and thick air); a sample flown through
  Eos's plumes. *Gives back:* the big discoveries (Eos's ocean), and the gravity assist to Erebus.

### Erebus — the icy dwarf at the edge (Pluto)
- **Physical:** R 238 km, g 0.62 m/s², escape 543 m/s, day 2.1 days, tilt 120°. A trace of N₂ (no aerodynamics).
- **Orbit:** a 8.25 TU, e 0.2, i 17°. **2:1 with Hyperion**, with their conjunctions phased at Erebus's aphelion,
  as Pluto is protected from Neptune. Its perihelion (6.6 TU) stays clear of Hyperion.
- **Look brief:** pale pinks and tans, a smooth glacier basin of nitrogen ice next to dark, reddish highlands; a
  black sky and a tiny sun. *References:* Pluto by New Horizons (Sputnik Planitia); Triton by Voyager 2.
- **Ground brief:** nitrogen-ice plains, water-ice mountains, dark tholin highlands.
- **Role (epoch 8):** discovered by a telescope survey (**pillar 4**: you find the edge of your system). A 5-year
  passive flyby with a Hyperion assist (passive flybys are decided, NOTES § "Time, long missions"). The capstone
  probe.

---

## Seeded per world (`WSEED`)

Default (ROADMAP): hand-made bodies are the same in every world; these classes vary per playthrough.

| Class | Where | What it's for | Known? |
|---|---|---|---|
| **Near-Tellus asteroids** | orbits crossing near 1 TU | M4 capture and mining; a close-pass "threat" headline | found by surveys |
| **Belt bodies** | 2.2–3.3 TU, a few dozen named | prospecting, sample return | found |
| **Selene trojans** | Selene's L4/L5 (stable, NOTES § "Program design") | a cheap first asteroid near home | found |
| **Hyperion trojans** | Hyperion's L4/L5 | outer-system targets en route | found |
| **Comets** | a few periodic ones (3–10 y), a rare long-period one | flyby and intercept missions with a deadline that comes round again (**pillar 5**) | periodic: some known; long-period: found |
| **Interstellar visitors** | hyperbolic, one every few years | M5: the intercept you have one chance at | found |

Small bodies need an irregular shape. Bodies are ray-cast spheres today; strong height noise on a sphere is the
cheap default, and a true shape model would be new work for the world lane.

---

## Room to grow (Caio's question, 2026-10-08)

Adding bodies later is cheap, as long as a few things are fixed now.

**Additive, any time:**
- **On rails, a new body changes nothing that exists.** Patched conics never let bodies tug on each other, so existing
  orbits, windows and tests stay the same. Only the n-body setting cares, which is why the slots below are spaced.
- **Reserved slots:** an innermost airless planet at ~0.39 TU (Mercury: the sunshade and the star's deep well);
  an ice giant beyond Erebus at ~12–14 TU; Erebus's binary partner (Charon); more small moons for Hyperion and Enyo.
- **Seeded classes** can gain members or new classes freely.

**Expensive to change once built:**
- **the star's mass**, since it prices every heliocentric mission;
- **the year**, which is already fixed by the calendar and eras;
- **a body once missions are priced on it**, since the economy's pay floor is measured against the presets
  that fly them (NOTES § v1.53).

Names and looks stay cheap to change.

---

## Decisions (round 2, Caio, 2026-10-08)

1. **Names:** the Titan/Night family stays as **placeholders**; Caio revisits naming later.
2. **The star's mass:** Kerbol's, μ 1.17e18.
3. **Tellus's axial tilt: 23°, Earth-like.** Fixed now because the sky, the world's snow and the planet shader depend
   on it; **seasons are built at M5**, not before.
4. **Hyperion has bright rings and a 27° tilt.**
5. **Tethys keeps its thick air** (1.5 bar, chutes do everything).

## After approval: the fan-out

Each approved body becomes a package (ROADMAP): **look** (a sky & bodies session per body), **world** (its ground),
**space** (orbit, SOI, rails at M5), **economy** (its missions), **QA** (a tester "go to body" cheat). The orchestrator
adds them to QUEUE.md. Look and ground may start before M5.

---

## Version history
- **1.0.0 (2026-10-08):** approved by Caio as the base; round-2 decisions recorded; names are placeholders.
- **0.1.0 (2026-10-08):** first draft. Shape A chosen by Caio; scaling rules, overview, eight body entries, seeded
  classes, room to grow, round-2 questions.
