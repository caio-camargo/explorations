# Launchpad notes — Vehicle
**Version**: 1.0.12 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-11 (split from NOTES.md v1.21.52, W37) · **Updated**: 2026-10-30
**Purpose**: The build log for parts, the construction screen, staging, attitude control and avionics, aero, nodes, legs, power, the pilot's modes.
**Status**: live log, oldest first; new sections go at the bottom. Index of every section: [`../NOTES.md`](../NOTES.md).

---

## Parts and mission types — planning (2026-10-07, brainstorm with Caio; nothing built)

**Through-line:** every part or mission hinges on something the sim computes (orbits, sun angle, line of sight, loads,
heat, drag, mass). That keeps even the sci-fi end grounded. **Tone:** physics serious, world wry. Consequences arrive
as headlines and politics, never body counts; a little more serious than KSP.

**Science instruments.** Each wants a different flight:
- air sampler (exists): pass through bands, be recovered;
- camera: nadir pointing, daylight, no cloud, resolution ∝ 1/altitude; for maps, crops, weather, recon, disasters;
- radar: heavy and power-hungry, but works at night and through cloud;
- radiation counter: discovers the radiation belts, which then set crew dose limits;
- magnetometer: on a boom, needs latitude coverage (inclination); the field model explains the belts;
- telescope: pointing stability, away from the sun; for discoveries (second moon, asteroids, visitors);
- seismometer: soft landing on Selene, upright; several make an interior map, so it's a multi-lander campaign;
- gravity-mapping pair: two satellites in formation (GRACE-like);
- spectrometer: asteroid composition, i.e. mining targets.

Data comes home either by transmitting (antenna + power + line of sight to a ground station owned by some power) or
physically: film canisters caught mid-air by a plane (a Corona nod). Support parts: antennas, solar panels, batteries
(eclipses from the existing sun direction), reaction wheels, booms, fairings.

**Space stations:**
- **Assembly in orbit gets past what you can't launch:** a truss that would snap at max-q is fine assembled in orbit.
  That's a direct use of the structural sim.
- **Modules with jobs:** habitat (crew capacity), lab (science per crew-day), power truss, docking hub, fuel depot
  (cheaper Selene missions), construction yard (assembles big vehicles), later a hotel.
- **A growing station is still one rigid body.** Reboost burns load long trusses, docking shocks propagate, and
  attitude control has to grow with the mass. Expansion is a structural design problem.
- **Upkeep becomes repeatable contracts generated from the station's state:** orbital decay → reboost; resupply; crew
  rotation.

**Military, kept light; weapons are mostly political objects:**
- **Spy satellites and visibility.** Lower is sharper but decays faster; targets need daylight and clear skies; you plan
  the ground track. Real physics: **a satellite is visible from the ground when it's sunlit and the observer is in
  darkness** (dawn and dusk), so rivals see your passes and the news notices. Passing in Tellus's shadow is stealthy but
  blind.
- **Early-warning satellites** (high orbits) see launches, so rival launches become news you've earned.
- **Satellite hacking (Caio):** pull up alongside a rival's satellite at night and work undetected. Stealth rules: do
  the approach and the work in Tellus's shadow; inside a set distance, burns must stay minimal, since a visible plume
  or a big Δv gets you spotted. It works only *before the rival has radar*, which makes it a tech-era window: the same
  approach that is invisible to optical tracking is caught once radar exists. A precision-rendezvous minigame with
  political stakes (caught means an incident, sanctions, lost contracts).
- **Anti-satellite weapons** = rendezvous with a high closing speed. The consequence is **debris**: a lasting field that
  threatens everyone's satellites, yours included, and costs opinion with every power (Kessler as world state).
- **Lasers:** grounded first (power- and range-limited, dazzling sensors rather than destroying). More sci-fi with
  nuclear power later.
- **Tungsten rods:** de-orbit a dense rod; the impact predictor already models it. **Accuracy depends on your own
  atmosphere science** (the ±25% band uncertainty is your error). Used as tests on empty ranges, treaty politics
  (Outer Space Treaty-style bans that cost you to break), deterrence and arms races. Never cities.

**Asteroids:**
- **Start near home:** small objects temporarily captured into Tellus orbit (mini-moons), found by the telescope and
  reachable with today's physics, before the interplanetary layer exists.
- **Mining:** new resources (ore, water turned into propellant at a cost in power). Refuelling away from home changes
  mission design.
- **Moving one is a momentum budget:** asteroid mass × Δv against thrust × time. That brings ion engines and low-thrust
  propagation on rails.
- **Planetary defence as a world event:** a rock on a collision course with N days of warning; the impact ellipse
  (already built for rockets) shrinks as tracking improves; earlier action needs less Δv. Kinetic impactor (DART), gravity
  tractor, or mining it (which pushes it as a side effect). Do the powers cooperate? Who pays? Wry headlines if it hits.
  Redirecting asteroids on purpose is the sci-fi weapon end, and politically radioactive.

**Alien life and public relations (Caio):**
- **Life research:** mostly microscopic traces (chemistry in Selene samples, ambiguous biosignatures from a telescope,
  later microbes on another world). Each result has a *real* confidence level that more missions raise or collapse.
- **PR as a direct dynamic:** how the program *presents* a result is a choice. A **dry scientific tone** builds scientific
  standing slowly and safely. **Leaning into the little-green-men hype** brings a burst of opinion, funding and tourism
  interest now, but costs **credibility** if the result is later overturned. Credibility then discounts the hype on the
  *next* announcement, so the boy who cried alien gets less of a bump. Science clients care about credibility; the
  public and politicians care about excitement. Fits the tone: a press-conference choice with wry headlines either way.
- This generalises: PR choices on failures (own it or spin it), on passenger flights, on military work (deny or
  disclose).

**Infrastructure this all needs** (in order of what it unlocks):
1. **Persistent objects on rails across program time**: satellites that keep serving, stations, debris, rivals'
   hardware, asteroids. The keystone, and cheap, since Kepler rails are exact.
2. **Several vessels in physics at once:** rendezvous, docking, anti-satellite intercepts, formations, hacking.
3. **Cheap geometry:** sun and shadow, line of sight, ground stations, who can see what; plus a CPU cloud map (a port of
   the shader's clouds, the way the land mask was ported).
4. **Power:** solar panels, batteries, eclipses.
5. **Low-thrust propagation,** then the star-centred system for real asteroids and interplanetary travel.

**A first slice that tests the idea:** persistent satellites + camera + antenna. Imaging contracts (weather, crops,
disasters, recon) with daylight, cloud and ground-track planning: the first time the world reacts to things that *stay
up*.

## v1.17 — the construction screen: free placement, radial on anything (2026-10-07)

Built in a session running in parallel with the economy work (v1.13–v1.16), so the UI lives in its own file,
[`builder.js`](builder.js). That kept the two sessions' hunks apart in `index.html`. It can be folded back into
the single file once nobody else is editing it.

**What you do.** Pick a part from the palette (now grouped: command, tanks, engines, structure, aero) and it follows
the cursor as a ghost:
- **Stack nodes**: every free top or bottom node glows. Near one (34 px), the ghost snaps its bottom onto a top node, or its top under a bottom node.
- **Surface**: otherwise it attaches **radially** to whatever the cursor is over, at that height and angle. Symmetry is ×1/2/3/4/6/8 [X], snapped to 15°, and the
  line's ends are pulled onto the host's part boundaries within 0.35 m [C]. Radial decoupler on/off [R].
- **Validity**: the ghost is green when it fits and red (`blocked`) when any copy would overlap a part.
- **Picking up**: click a placed part to pick it up with everything hanging from it, all symmetric copies included. Ctrl-click takes a copy, Shift-click places one and keeps holding.
- **Options**: right-click a part for joint load and reinforcement, crossfeed, copies, decoupler, ±0.1 m and ±15° nudges, pick up / copy / delete.
- **Overlay**: joint loads are drawn on the rocket itself, replacing the strips between list rows.
- **Editing**: undo/redo. In the editor the ship hangs 3 m above the pad, as in a VAB, so parts can go under its bottom. The camera no longer auto-spins; Shift+wheel or middle-drag moves the view up and down.

**Design format v2: a tree** (`toV2`, `layoutDesign`, `assemble` in the SIM block). A node is `{k, at, j, x, c}`.
`at` is `'u'` (on the parent's top), `'d'` (under its bottom), or radial `{y, a, n, cy, dec, x}`. Parts never tilt, so a
radial child starts a new vertical stack line at distance (widest host-line radius over the child's extent) + 0.25 m +
(child line radius). The physics already flies exactly that: stack lines for aero, joint frames for loads. So
nothing in flight changed. Symmetric copies replicate the whole subtree, and nested radials are measured in their
host's rotated frame, so boosters on boosters come out symmetric. The old `{stack, rad}` format converts losslessly.
Presets stay in it, and so does any unedited design, so saved autopilot tapes keep matching.

**Staging generalised.** Segments now form a tree: a segment's parent holds its decoupler. The *chain* runs from the
root's segment down through the stack decouplers below it. Everything else hangs off a chain segment, burns with
it, and drops before it does: deepest first, then highest first. For the old designs this reproduces the old rule
exactly. For nested boosters it gives *side tanks → boosters → core*.

### Measurements
| What | Number |
|---|---|
| All 8 presets, new `assemble` vs old | **byte-identical** fingerprint: parts order, positions, parents, joint axes/points, reinforcement, segments, events, labels, Δv |
| 3 boosters × 2 nested side tanks, no crossfeed → crossfeed | 4 593 → **6 215 m/s**. The engineless side tanks are dead weight until they crossfeed |
| Same design flown straight up for 80 s | side tanks drop at T+23.9 s, boosters at 71.6 s, 58.5 km, worst joint 21 % |
| Single ×1 radial Tank 1 t on a Tank 4 t | assembles, CoM 0.21 m off the axis |
| `test.mjs` | 81 checks, all passing (6 new in §15) |

### What went wrong on the way
- **A dropped line that only one test could see.** The rewrite lost the reinforcement-mass line (`jm`). The preset
  fingerprint can't catch that, because no preset reinforces a joint. The v1.5 test "reinforcing the joint that snapped" caught it (+0 kg
  instead of +60 kg). Fingerprint *and* behavioural tests: each covered the other's blind spot.
- **Test heuristic vs geometry.** "Nearest booster = host" was wrong for a nested tank that sits 1.49998 m from a
  neighbouring booster against 1.5 m from its own. The test now reads the host from the joint tree.
- **Line endings.** `index.html` and `test.mjs` are CRLF in the working tree (`core.autocrlf=true`). A splice that
  wrote LF lines, and a `sed -i` that silently converted a whole file to LF, both had to be repaired. Edit through
  something that keeps the file's own line endings.

**Not done:** parts that tilt, so no radial fins or angled engines; that needs a per-part orientation in aero and loads. Re-rooting
(picking up the root). Drag-to-reorder staging. Aero interference between side-by-side lines is still not modelled.
The crossfeed note in flight says "side empty" for side-tank groups, which is the label's first word.

## v1.18 — radial fins and make-root (2026-10-07)

First slice built in the `launchpad-builder` worktree (branch `builder`), merged to `main` when done.

**Radial fin** (`rfin`). It is one flat plate, the same plate as one of the fin ring's four (0.9 × 0.9 m, CN = 3.5·sinα·cosα +
1.2·sin²α). It is *surface-attached* (`surf`): it sits on the host's skin at the profile radius for that height (`profR`), and it
has no stack line, so nothing attaches to it and it never gets a radial decoupler. This is the cheap and honest version
of "tilted parts". The physics already modelled fins as flat plates, so a radial fin is just one plate at its own angle φ.
Its joint is radial, so the plate's normal force reaches the host as shear plus bending at the root (rated S 150 kN,
B 60 kN·m).

| What | Number |
|---|---|
| 4 radial fins on a 1.25 m body vs the ring's 4 plates (plates alone, M 0.6, 4°, 20 kPa) | force **99.4 %**, lever arm identical (1.750 m). The 0.6 % gap is the 1.2·sin²α term, which depends on plate orientation (45° off the ring's here). The linear term doesn't: Σ n nᵀ = 2I for any 4 orthogonal plates |
| Orbiter, ring swapped for radial fins at the tank's bottom: none / ×3 / ×4 | **−3.35 / 0.03 / 0.52** calibers (ring: 0.88; without the ring's 0.9 m body the plates sit closer to the CoM). Three plates give 1.5 I, not 2 I: 75 % of the restoring force |
| Orbiter ring + 4 radial fins on the tank (flown, SAS on) | 1.63 cal; 3.2 km at T+30 s, max AoA 0.27°, busiest fin root ≈ 1 % of its rating |

**Make root.** "make root" in a part's options re-hangs the design tree from that part, flipping each stack joint on the path
(`'u'` ↔ `'d'`); a joint's reinforcement moves with it. It is limited to stack paths: reversing a radial joint isn't exact,
because the side-by-side clearance formula is asymmetric, and a symmetric copy would have to become a single parent. The
point is picking things up: with the core engine as root, clicking the upper stage picks up Petrel + tank + pod + chute
in one go. The assembled vessel doesn't change at all (test §16: same joints, reinforcement and stages, compared by stage label
because segment *numbers* follow part creation order, which a re-root changes).

**Merging.** `main` had moved: the orbital registry, which added a camera and an antenna. One conflict, the price table line next
to `PRICE.rfin`. It also exposed a palette bug: categories were a fixed list of kinds, so the two new parts didn't show.
The palette now puts any unclaimed kind under "Other". `test.mjs` 90/90 after the merge.

**Headless builder.** `builder.js` loads into the same `new Function` sandbox as the sim core: it touches no DOM until `init()`.
So tree operations like `reroot` are tested directly.

## v1.20 — the staging editor (2026-10-07)

**Model.** The automatic event list (v1.17's segment-tree rule) is split into *atoms*:
- one per decoupling placement, with all its symmetric copies
- one per ignited group
- the chute

An atom is named by its decoupler's design-node id (`d:7`, `i:7`, `i:root`, `c`). A design may carry `stg`, a list of stages in
firing order, each a list of atom ids; `stageAtoms` turns it into events.
- **Late parts:** atoms the order doesn't mention (parts added later) keep their automatic place relative to the rest, so
  editing the rocket never loses staging.
- **Drops carry what hangs off them:** in a custom order a drop takes everything hanging from the segment, so the core
  can go before its boosters without leaving them attached to nothing. A segment an earlier stage already dropped is not
  dropped again.

The automatic order written out as a custom one reproduces the events exactly (test §17). Node ids are assigned on the
first edit, copies get fresh ones, and duplicates are repaired.

**UI.** The panel sits under the build toolbar: stages in firing order, each action a chip (orange drop, green
ignition, blue chute).
- ◀ ▶ move a chip one stage earlier or later; off either end makes a new stage. ⤵ gives it a stage of its own.
- "automatic" forgets the custom order.
- Hovering a chip lights its parts on the rocket: the whole segment for a drop, the engines for an ignition.
- The flight HUD, Space, the Δv planner and autopilot tapes all read the same events, so nothing else needed changing.

| What | Number |
|---|---|
| Heavy, boosters held on until the core drops (one fewer stage) | Δv 1 758 + 1 447 + 2 465 → **2 670 + 2 465 m/s**: carrying two empty boosters for the core's burn costs **535 m/s** |
| Same, flown: Space for real, then physics stepped from the page | boosters burn out at T+48 s and stay on ("boosters empty — stage to drop them"); core + boosters drop together at T+96 s; 129 km at T+120 s, worst joint 24 % |
| `test.mjs` after merging `main` (economy v1.19) | 106 / 106 |

**Two bugs found by the browser, not the tests.**
- **Atom ids on unedited presets.** These have no node ids yet, so atoms named `d:undefined` merged: "drop core 1"
  vanished into the booster drop. The fix names them by design-node object instead (by segment at first, which split
  the booster pair). There is now a test for it.
- **A stuck highlight.** Rebuilding the panel removes the hovered chip, and a removed element never fires `mouseleave`.

### The misplaced hooks (fixed on `main` as `480d7c7` before this slice)
Moving the v1.17 hunks into this worktree used zero-context patches (`git apply --unidiff-zero`). Those place a *pure
insertion* by line number, and the terrain session's 92 lines were in the source diff but not in the worktree. Two
insertions landed in the wrong place:
- `HOOK.edDraw` went inside `drawMap`, so from v1.17 on the builder drew **no placement ghost, hover or selection glow**.
- `HOOK.edOverlay` went between `if(ds.start)` and `else if(ds.dk)` in the economy's program-panel click handler, so in the
  editor **program decisions never resolved**.

All behavioural tests passed throughout: nothing in them looks at *where* a hook is called from. My v1.17/v1.18 browser
checks drove the placement logic and read state ("ghost hard to make out") instead of looking at the ghost. It surfaced
only when a hover highlight that should have existed didn't. Now:
- a **merge guard** in test.mjs §17 checks that each render hook is called once, from inside `render()`, and that the click
  handler's if/else-if chain is intact. Run against the broken commit, the guard fails, as it should.
- **Never move hunks between diverged trees with zero-context patches.** Use a 3-way merge or a patch with context.

## v1.22 — canted engines (2026-10-07)

**Model.** An engine on a radial line may cant its nozzle outward by θ, in its own radial plane, so its thrust leans in toward the
axis: d = cos θ·ŷ − sin θ·n̂. It is set per design node, so all symmetric copies share it, and it ranges from −30° to +30°. Everything
that assumed axial thrust now uses d:
- physics (the force on the mount) and the builder's what-if probe
- the Δv planner and TWR, as vector sums, so a symmetric canted pair honestly pays its cosine
- the maneuver-node burn time
- the plume, and the engine mesh, rotated about its mount

Uncanted engines carry no direction at all and run the old axial code unchanged (all 112 checks).

**Getting "balance" right.** My first version pointed *this* engine's thrust line through the CoM. That is the wrong target:

| Lone Kestrel booster beside a Kestrel core | Thrust torque about CoM | Max tilt, 40 s climb under SAS |
|---|---|---|
| uncanted | 34.6 kN·m (the two equal engines nearly balance already) | 1.9° |
| booster aimed through the CoM (26°) | **155 kN·m**, ×4.5 | flipped, lost |
| total thrust balanced (5.05°) | 0.16 kN·m | 4.4°, worse than uncanted |

"Balance" now picks the cant at which all engines burning when this one fires push with zero net torque about the CoM of
what is still attached then (full tanks). It searches −30…30° on a 0.05° grid, and ties go to the smallest |θ|, so a symmetric
pair stays at 0°.

The last row is the real lesson. **Canting trades a torque for a side force.** The engine gimbal cancels the torque
almost for free. The side force (sin 5° × 230 kN ≈ 20 kN here) is never cancelled: it builds a crosswind angle that the fins
then fight. So cant pays only when the off-axis thrust is beyond what the gimbal can hold:

| Stack (core + lone booster) | Balance cant | Uncanted | Balanced |
|---|---|---|---|
| Sparrow + Condor | 15.0° | flips at T+4 s, lost | 4.9° max tilt, 14 km at T+50 s |
| Kestrel + Condor | 7.75° | 41.7° max tilt | 3.2° |
| Sparrow + Kestrel | 10.15° | 95.5° | 1.1° |
| Kestrel + Kestrel | 5.05° | 1.9° | 4.4° (don't) |

A symmetric pair canted 10° gives up 1.0 % of first-stage Δv. That is less than the booster's cosine (1.5 %), because the
core engine isn't canted.

**Not modelled:** a canted nozzle's plume hitting the core (plume impingement), and a cant that changes as the CoM moves
during the burn. Real stacks gimbal their boosters for that.

## v1.23 — aero interference: shadowing between stack lines (2026-10-07)

Until now every stack line (core, each booster) flew as if it were alone. The interference that follows from the model the
sim already uses is **Newtonian shadowing**:
- An upstream-facing surface sample gets no impact pressure, and no stagnation heat, if the ray from it back up the flow
  crosses another line's body first.
- Lines are cylinders of their widest radius over their own height.
- Slender-body lift and skin friction are left unshadowed.

At small angles of attack the upstream ray climbs steeply (1/tan α metres up per metre across, about 11 at 5°), so
side-by-side boosters barely shade each other on ascent. At high α the leeward lines go dark. Broadside, the Heavy's three
bodies are in a row along the flow, and the leeward booster tank's pressure falls from 70 kN (windward) to 0.9 kN (its
skin friction). That's extreme, as Newtonian always is, but it matches tandem cylinders this close (centres 1.2
diameters apart), where the downstream one sees almost no drag.

| Normal force at q 20 kPa, M 0.6 | 0° | 5° | 20° | 60° | 90° |
|---|---|---|---|---|---|
| Orbiter (1 line) | unchanged | unchanged | unchanged | unchanged | unchanged |
| Heavy (3 lines) | unchanged | 54.0 → 51.1 kN | 247 → 210 | 668 → 456 | 584 → **304** |
| Asparagus (5 lines) | unchanged | 69.0 → 66.1 | 317 → 282 | 876 → 684 | 787 → 552 |
| Nested 3×2 (10 lines) | unchanged | 24.8 → 24.3 | 146 → 124 | 568 → 355 | 641 → 476 |

Stagnation heating on shadowed faces drops with it (Heavy at 60°: 0.06 → 0.02 MW). In the builder's design case (4–5°):
- stability rises by 0.02–0.03 calibers on the booster designs, because the upper booster sections are shaded slightly
  more and the centre of pressure moves aft
- max-q joint loads move by 1–2 %

So on a normal ascent this is a small correction. It matters in tumbles, aborts and broadside re-entries.

**Cost:** about 3–12 µs more per step (5–20 %, noisy) with 3–10 lines. That is roughly 3 ms of a frame at 100× physics warp for
the Heavy. `AERO_SHADOW` switches it off for A/B measurements (tests §19).

**Two measurement traps on the way:**
- **Cold timings.** The first timing (160–270 µs per step) was a cold JIT. Warmed up and best of 5 it is 26–40 µs, the same
  as v1.8. Always warm up and take the best of several runs.
- **The bisect that "found" a 5× higher apogee.** It came from my own script, which still used the old 600 km radius.
  The planet had been rescaled to 1 274 km on `main` (d5cc27e) in the meantime. Measure altitude from `TELLUS.R`, never
  a literal.

**Also seen:** an unfaired design (boosters and side tanks with flat tops) has 288 kN of drag at 0°, against 32 kN for the
Heavy with its nose cones. Newtonian impact pressure on blunt faces is what it should be. Fairings matter.

## Vehicle parts: landing legs (Q31) and power, computer, radiator (Q34) — plan (2026-10-08, vehicle session; nothing built)

Planned without running the game (Caio: no heavy GPU for now). Both are ⚙ work: physics plus headless checks; the look
beat draws the new parts afterwards. Numbers marked *tune* are starting points to measure, not results.

### Q31 — landing legs

**Why now.** § v1.37's contact model already makes legs worth having: with no legs a stack's footprint is its bottom
rim, so the Orbiter (1.25 m base, CoM ~5 m up) topples on a 12° slope (atan(r/h)). Legs are only a wider footprint,
plus a place for landing loads to go.

**The part.**
- `leg`: `kind:'leg'`, `surf:true`, `noAero:true`. It mounts on a part's side like `rfin`, so the builder's radial
  count (`at.n`, 3 or 4) gives a symmetric set for free (`layoutDesign`'s surface-part branch).
- Geometry: the root is on the host's skin; the foot sits `reach` out along the mount's normal and `drop` below the
  root. *Tune:* reach 0.9 m, drop 0.8 m, so 4 legs on a 1.25 m body put the feet at r ≈ 1.5 m, 0.8 m below the rim.
- Mass 0.04 t each. Price 1.5. `complexity` tier 1 (`sim/program.js:317`).
- Joint ratings sized so a set of 4 survives ~6 m/s vertical at the stack's design mass and snaps a leg around ~9
  (*tune* by measurement). Then a hard landing breaks a leg and the stack tips over, with no special rule: the
  contact forces are already part forces (`p.F`/`p.L`) that the structural check reads.
- **Deployable:** stowed for launch, deployed by a key (flow picks a free one; `G` if it's free). Stowed legs add no
  feet. **Default:** deployable. Fixed legs would also need the pad and the rig to clear them.

**Contact changes (`sim/flight.js` `footPoints`, one function):**
- A deployed leg adds **one** contact point, at its foot, instead of the 4 rim points every other part gets.
- `yb` (the lowest point) is taken over the feet as well as the rims, so with legs down the rims (≥ 0.8 m higher)
  drop out by the existing 0.5 m rule.
- The cache key adds each leg's deployed flag next to `p.on`.
- Keep the spring-damper per point as it is (2 cm static deflection, ζ 0.6). A softer leg stroke is a later
  refinement, and the verdict (`touchdown`, `TOUCH_MAX` 12 m/s + softness) doesn't change. Legs help by spreading the
  footprint and by breaking, not by a speed bonus.
- `rvFootR` (rovers) reads `footPoints`, so a lander's legs also widen the area a rover is placed around. Check that.

**Checks for `test.mjs` (a new section at the end):**
1. The Orbiter with 4 legs deployed stands on a 12° slope (it topples today) and on a slope up to atan(1.5/5) ≈ 17°.
2. The same stack with the legs stowed topples as before (no regression).
3. A 9 m/s vertical touchdown snaps at least one leg (`partLost`); 3 m/s snaps none.
4. A Selene lander (Wren + legs) lands on regolith at 15°.
5. `footPoints` with legs down returns only feet (4 points for 4 legs).

**Others:** the look beat draws the leg (folded and deployed). Until then, a placeholder box at the foot. The
TESTING row goes in when it's built: "land the Orbiter with legs on a slope".

### Q34 — onboard computer, solar panels, battery, radiator

**What exists.**
- Rovers have a power model (`sim/rovers.js` R3: panels, an RTG, a battery, a night heater). Vessels have none.
- Avionics come from the world's compute era alone (`avNow()`; v1.46). `s.av` is set at launch, so nothing on board
  decides it.
- The flight thermal pass (`thermal()`, `sim/vessel.js`) is the per-part skin model for re-entry. Orbital
  steady-state thermal is a named M2–M5 system (§ "Rich programs", step 3) with no code yet.
- The sun is fixed in the absolute frame (`SUN_DIR`), so a polar orbit whose plane is square to the sun is dawn-dusk
  forever, with no J2 needed. That's convenient for the "no eclipse" case.

**Scale (worked out from the constants; not run):** LEO here is r = 1,384 km (`TELLUS.R` + air + 10 km). That gives
a 43-minute period and a shadow half-angle of acos(√(r²−R²)/r) = 67°, so **37% of each orbit is in eclipse (16 min)**
at β = 0. A 50 W load needs 13 Wh through each eclipse. Batteries are cheap here; the panel area, generation ÷
(1 − 0.37), is what costs.

**Split into two slices (recommendation):**

*Q34a — computer, panels, battery (M2, ⚙).*
- **Parts:**
  - `ocomp` Onboard computer: inline, 0.03 t, 50 W (the Apollo guidance computer: 32 kg, 55 W). Price 8, tier 2.
  - `bpanel` Body-mounted solar cells: surface part, fixed, 0.01 t. *Tune:* 40 W in full sun, ×0.32 averaged over a
    tumbling or spinning body (Vanguard, Explorer).
  - `wpanel` Deployable solar wing: surface part, 0.03 t. *Tune:* 300 W in full sun, tracks the sun about its own
    axis (×0.9). **Deployed, it snaps above ~1 kPa of dynamic pressure** (when to deploy is a design problem,
    Pillar 2).
  - `batt` Battery: inline or surface, 0.02 t, 1 kWh (silver-zinc, ~50 Wh/kg).
- **Loads**, a `W` field on parts that draw power: computer 50, antenna 20 while it transmits, camera 15, crewed pod
  150 (a cabin). A pod or core carries its own small battery (0.5 kWh) so short flights never need to think about it.
- **The budget is a steady state first** (the lean pillar, like thermal step 1). For a design and an orbit: orbit-
  average generation (with the eclipse fraction from the orbit's β), load, and the battery needed to cross the
  eclipse. The builder shows one line: `Power +85 W / −70 W · eclipse 16 min needs 19 Wh (battery 1 kWh ✓)`.
- **In flight:** the instantaneous version, integrated like the rovers' `R.E` (`gen − use`, clamped; sunlit from
  `SUN_DIR` and the planet's shadow cylinder). One line in the step, no new state beyond `s.E`.
- **Running flat never kills (Pillar 5):** the computer drops to the analog autopilot, the antenna and camera stop,
  and on the registry the service **pauses** (the W2/Q50 pattern) until the budget is positive again. This differs
  from rovers, which freeze to death at night; leave them alone, they're the space lane's call.
- **The computer and avionics (Caio decided 2026-10-08: built into crew capsules, a part for probes):** from the
  onboard-computer era on, the **Guidance computer** generation (`AV[2]`) needs a computer on board.
  - **Crew capsules have one built in** (parts with `crew`, like Apollo's command module and lunar module). No mass
    change: it's in the capsule's mass.
  - **Everything else needs an `ocomp`, powered:** probe cores, biocapsules, instrument packages. Without one, a
    vessel flies the analog autopilot.
  - It's a pilot aid, not autonomy: the player flies either way; the computer decides which SAS hold modes exist.
  - Before that era the part isn't offered, and nothing changes.
  - Sandbox, physics tests and procedures (`s.proc`) keep the best avionics, as now (`avOf`).
  - **What it breaks:** uncrewed presets and the robot's probe designs flown after year 7 lose the target and docking
    modes unless they get the part. Update those presets in the same commit, and tell QA (`career.mjs`). Crewed presets
    are unaffected.
  - It gives the space lane a hook, `hasComputer(s)` (a crew capsule or a powered `ocomp`), for onboard autonomy out
    of contact (§ "Compute", era 3). Their Q27 and the link budget read it; Q34a doesn't build autonomy.
  - Rejected: a part for everyone (crewed ships historically had theirs built in, and every crewed preset would
    break); built into every command part (the part would only matter later, for autonomy).
- **Checks:**
  1. The steady-state budget for a LEO satellite with a wing, against a hand calculation;
  2. In flight, the battery drains through the shadow and refills in sun, and over one orbit the steady state and the
     integration agree to within 5%;
  3. A deployed wing snaps at max-q, and one deployed after fairing separation survives;
  4. Running flat drops avionics to analog and pauses a satellite's service; recharging restores both;
  5. Era ≥ onboard computers: a probe with no `ocomp` has no docking mode; a crew capsule without one has it.

*Q34b — radiators and the steady-state thermal solve (M2–M3, with the economy's orbital datacenter).*
- `rad`: a deployable surface panel. Its mass per m² and emissivity give εσAT⁴. Like the wing, it snaps in air.
- **The solve** (§ "Waste heat", step 1): heat in is α·A·S + internal power, heat out is εσAT⁴; solve for T per
  vessel. Parts get operating ranges (electronics 270–330 K). The builder shows "runs at 340 K, over the computer's
  limit".
- **Why wait:** until the datacenter exists, nothing on a vessel makes enough heat for a radiator to matter (a 50 W
  computer on a 1.25 m bus runs a few kelvin warm). Build it when the economy starts datacenter revenue (that
  section's order, step 3), so the part ships with a reason to fly.
- In the flight's `thermal()`, a radiator is only a skin part with a low `Tmax`, so re-entry with it deployed burns
  it off. The orbital solve is a separate function that shares only the radiation term.

**Overlaps (so nobody builds the same thing twice):**
- space Q27 "relay range and power": reads the power budget and `hasComputer`; it doesn't build its own.
- space Q50: power-flat pauses service the same way fuel-flat does. One "paused because…" field, shared. *(Space, v1.60: fuel-flat turned out to be physical drift, not a switch, so there is no field yet; Q34a adds `q.off`, see § v1.60 "Decisions".)*
- economy: chip sourcing (§ "Compute") can later price `ocomp` by `compLag`, like any part.
- Q10 era gates: as far as I found, parts aren't era-gated yet. `ocomp` needs its gate (`compEra() ≥ 2`) whichever
  session builds the gating.

## v1.40 — attitude control: a real gimbal, steerable fins, a SAS that holds (2026-10-08, control session)

Caio's review: stability and attitude control are a big part of KSP and felt undercooked here. They weren't missing
(wheels, gimbal, RCS and passive fins all existed), but control was an **abstract torque budget that was always spent
perfectly**. Every engine had the same 7 % "gimbal" as a number, nothing ever turned, the controller's acceleration
was added to the dynamics as is, and a single engine on the axis could roll the vessel. This slice makes the actuators
physical. `study_control.mjs` measures the control budget (`node study_control.mjs`).

**What changed**
- **Engine gimbal is a nozzle that turns.** Each engine has a range `gim` (°) and a slew rate `gimR` (°/s): Sparrow 3°/15,
  Wren 6°/20, Petrel 3°/10, Kestrel 5°/10, Condor 4°/8, Albatross 4°/8 (other sessions' engines default to 4°/10).
  `p.gv` is the deflection; the thrust points along `tdir + gv`, so the steering torque, the side force and the joint
  loads all come from the turned thrust. The structural code's separate "gimbal side force" path is now only used by
  the builder's what-if `probe`.
- **One allocator** (`gimSteer`): the wheels give what they can of the control law's torque as a pure torque, and the
  rest is shared out by least squares over every engine's two deflection axes and every steerable plate. An engine on
  the axis has no roll column, so it can't roll anything. Roll authority (`ctrlAuthRoll`) counts only engines off the
  axis (side boosters, clusters).
- **Steerable fins**: `cfin` (radial, 1.2 M), `cfins` (ring, 4.5 M), `cfins25` (2.5 m ring, 11 M). The same plates as
  the passive ones, all-moving, ±20° at 40 °/s. A plate's normal turns about its span (n' = n·cosδ − Y·sinδ) in the
  existing flat-plate model. Their columns (`finCols`) are linearised each step at the current airflow, so their
  authority grows with q, is gone in vacuum, and they roll. They use the existing fin kinds, so palette, mesh, damage and
  aero all pick them up. Tier 1 in `tierOf` (they have actuators).
- **SAS**: (1) while lagging actuators carry the load (engines burning, or steerable fins with > 25 % of the wheels'
  authority), the rate demand is linear near the target with Tc = `SAS_LAG` × the slowest actuator's full swing. (2) The
  rate loop then also integrates (`SAS_TI` = 1 s), clamped to the authority and **frozen while the command saturates**.
  Wheel- and RCS-only flight is untouched: no zone, no integral.

**Before / after** (same scripted inputs)

| | main | v1.40 |
|---|---|---|
| Lunar, pitch/yaw rate t 20–90 s under SAS prograde (rms) | 0.63 °/s | 0.61 °/s |
| Heavy, same (rms) | 1.56 °/s | 1.37 °/s |
| Lone Condor + "balance" cant, max tilt in 50 s (test §22) | 2.2° | **1.3°** |
| Lunar, 4 s SAS yank at q > 15 kPa, peak joint (test §5) | 100 %, snaps | 88 %, holds |
| Probe dart (core 4 kN·m) at 300 m/s, 30° turn: passive ring / steerable ring | 11.6 s / — | 11.6 s / **5.5 s** |
| Steerable ring pitch authority, 150 → 300 m/s at 5 km | — | 7.2 → 28.9 kN·m (∝ q) |
| Physics step, Lunar / Heavy | 34 / 52 µs | 40 / 53 µs |

**What it taught**
- **The square-root law limit-cycles with any lag.** √(α·θ) has unbounded gain at zero error. With an instant
  actuator that was invisible; with a nozzle taking 0.5 s to swing, the Lunar wobbled at ~0.5 Hz (rms rate 4.8 °/s,
  0.9 nozzle reversals a second). A linear zone of Tc = 1× the swing time cures it; 0.5× doesn't.
- **A rate loop can't fight a steady moment, and the old one hid it.** The linear zone left a standing error against
  thrust off the CoM (canted test: 2.2° → 10.1°). Worse, the steerable fins never moved at all: the loop's largest request
  (gain 4 × 0.6 rad/s × inertia) was 3.6 kN·m on the dart, less than its 4 kN·m wheel, so it never asked the fins for
  anything while the passive aero moment won. A rate integral fixes both.
- **…and windup is the integral's whole failure mode.** Clamped to full authority but integrating while saturated, it
  made the Lunar oscillate at rms 9.8 °/s whatever its time constant (0.5–2 s). Freezing it while the command saturates
  (conditional integration) took it back to 0.61 °/s. Clamping it at 30 % instead also stopped the wobble, but halved
  what the fins could do.
- **The old gravity turns were partly a controller artifact.** The sqrt law trailed prograde with a small standing
  error on the kick's side, which sped up the pitch-over (34° at 40 s). Exact tracking gives a slower, pure gravity turn
  (29°), so scripted 0.95 s kicks now need ~1.2 s for the same trajectory. Test §12's tape kick was retuned. Human
  pilots will notice nothing but slightly lazier turns after a kick.
- **The magic roll was real but rare**: it only showed when roll was commanded (roll key, roll disturbances). The
  scripted ascents never asked for roll, so the study's counter read 0 before and after.

**Tests** (section `control-1`, numbered §35 until v1.46.2; 4 checks): one Sparrow pitches a wheel-less probe but can't roll it, nozzle ≤ 3° at ≤ 15 °/s; the
nozzle centres when the throttle is cut; the Heavy's boosters add roll authority, the Orbiter's one engine none; the
steerable dart turns 30° in < 0.6× the passive time, plates within range and rate; fin authority ∝ q and none in vacuum,
and they roll a wheel-less dart. Changed: §5's yank check now asks for a joint ≥ 80 % (was "snaps", at exactly 100 %);
§12's tape kick 0.95 → 1.2 s. 247 checks pass on the slice, 262 after merging main (sats Phase C).

**For other sessions**
- **visuals:** `p.gv` (engine, vessel frame, |gv| = sin of the deflection) and `p.fd` (steerable fin, one angle per
  plate, rad; ring plates in `FIN4` order) are there to draw: nozzles that swivel, fins that turn. `cfin`/`cfins` draw as
  the passive fins for now.
- **builder:** the steerable fins sit in "Aero & recovery" by kind. The "no control torque" warning still looks only
  for wheels; a wheel-less design can now steer with gimbals or steerable fins.
- **economy / planning:** prices above; `tierOf` returns 1 for `d.ctl`. Engine gimbal ranges could become a variant
  or an upgrade axis.

**Next on this line** (the rest of the review, in order): the builder readout (control authority per axis vs the aero
moment at max-q; time for a 90° turn in vacuum, both of which `study_control.mjs` already computes); weaker wheels
that saturate (pod 40 → ~5–10 kN·m, a wheel part, momentum dumped with RCS); era-gated SAS quality. The wheels are
still 8× a KSP Mk1 pod and dominate everything but the biggest stacks: in the study the Orbiter's steady ascent never
needs its gimbal once the kick is done.

## v1.43 — reaction wheels that saturate; the builder's control readout (2026-10-08, control session)

The second slice of the control review (v1.40). The pod's wheels were 8× a KSP Mk1 pod and never filled up, so they
steered everything. Now they are a resource.

**What changed**
- **Wheels store what they give** (`wheelGive`): the vessel gets τ and the wheels' momentum H (body frame) changes by
  −τ·dt. Past `hmax` they can't push that way. Pod and crew capsule 40 → **10 kN·m**, 100 kN·m·s; probe core 4 → **2 kN·m**,
  20 kN·m·s; parts without `hmax` store 10 s of their torque (`WHEEL_S`). The rails attitude step goes through the same
  limit.
- **They unload** whenever something else can hold the vessel while they spin down (time constant `WHEEL_DUMP` = 4 s,
  at most half that channel's authority). A burning gimbal or steerable fins unload them for free from 2 %. RCS spends
  gas, so it only keeps them usable: from 80 % down to 60 %. When there's no gimbal or fins channel, RCS also covers what
  saturated wheels can't give.
- **A reaction wheel part** (`rwheel`, *Control*, 0.12 t, 15 kN·m, 150 kN·m·s, 5 M) to stack where turning big things
  matters.
- **HUD row** `Wheels n% saturated` once they hold ≥ 5 %, with the hint of what unloads them.
- **Builder: a Control block.** Holding 5° off the airflow at max-q (25 kPa, M1.2), burning and coasting: what it takes
  against wheels + gimbal + fins + RCS, as **holds** / **weathervanes** (short of authority but stable) / **flips**
  (short and unstable). Roll authority by source. A 90° turn in vacuum on wheels (capped at storage ÷ inertia) and with
  the first stage lit (`controlReport`, `turnTime`). The old "controls can't hold 5°" line moved here and now counts fins.
  The no-wheels warning says what still steers.
- **Bug fixed from v1.40:** `partBody` picks meshes by part key, so `cfin`/`cfins` drew as plain cylinders. They now draw
  as the fins they are.

**Numbers**

| | v1.40 | v1.43 |
|---|---|---|
| 90° turn in vacuum on wheels, Orbiter / Heavy / Lunar / Crewed Lunar (readout; flown) | 5.5 / 7.3 / 21 / 38 s | **11.1 / 14.6 / 56 / 151 s** (flown 11.5 / 15.3 / 54 / 145) |
| Same with the first stage lit (gimbal) | 3.4 / 3.3 / 4.9 s | 3.5 / 3.4 / 5.0 s |
| Orbiter, pitch key held 30 s, SAS off | spins up without limit | levels off at hmax/I = 0.512 rad/s |
| Unloading from 90 %, holding attitude, 45 s | — | nothing: 90 % · burning gimbal: 2 %, within 0.31° · cold-gas RCS: 73 % for all 30 kg |
| Coasting at max-q, Orbiter: need / have | 18 / 40 kN·m (holds) | 18 / 10 on wheels (weathervanes); 264 with a steerable ring |
| Physics step, Lunar / Heavy (back to back) | 37 / 55 µs | 39 / 58 µs |

**What it taught**
- **Quartering the wheels broke no check.** Every scripted flight (ascents, aborts, the crewed Selene mission,
  docking, re-entries) steers on the gimbal while burning, and the capsules are aerodynamically stable shield-first. The
  wheels had been doing almost nothing the tests could see. Where they do matter is turning in vacuum, now 2–4× slower,
  and holding off the airflow while coasting.
- **Wheel storage, not torque, sets a big stack's turn rate.** With 100 kN·m·s on a 192 t·m² Orbiter the turn tops out
  at 0.51 rad/s; on the Crewed Lunar at ~0.03 rad/s, a 2½-minute 90°. The readout has to cap by storage or it is 3×
  optimistic for the big stacks.
- **Cold gas is a poor way to unload a pod's wheels**: 90 → 60 % (30 kN·m·s) is ~29 kg at Isp 70 with this lever. Hence
  the 80 → 60 % band: RCS keeps the wheels usable rather than emptying them, and a short burn is the cheap way.
- **Saturation in the air is hard to isolate.** Holding a rocket off the airflow, the airflow swings round to meet the
  nose (the vessel's own lift), so the needed torque fades and the wheels level off short of full. The clean tests are in
  vacuum.

**Tests** section `control-2` (3 checks; numbered §36, then §38, until v1.46.2): the saturated rate equals storage ÷ inertia; unloading by nothing / gimbal / RCS; the
readout's turn times within 10 % of flown ones, and the coasting max-q case on wheels vs a steerable ring. 280 pass.

**For other sessions**
- **ui:** the `Wheels` HUD row sits before the RCS row (`wheelRows`). The Control block is in `editorChanged`
  (`controlHTML`).
- **builder:** `rwheel` is in *Control* (one edit to `CAT`). It draws with the default banded drum.
- **visuals:** `rwheel` could use a look of its own.
- **economy:** `PRICE.rwheel = 5`, `tierOf` gives it 1.
- **anyone scripting flights in vacuum with big stacks:** turns on wheels alone are slow now; light the engine (the
  gimbal) or add RCS / a wheel part.

**Next on this line:** ~~era-gated SAS quality~~ (done, v1.46); the gimbal and
fin deflections drawn (visuals); a "kill rotation" / unload-now control if playtests want one.

## v1.46 — avionics generations: SAS grows with the computing eras (2026-10-08, control session)

The third slice of the control review. The NOTES' eras idea ("early guidance computers have stability-only SAS") on the
compute eras of v1.38. Caio's choice: **two steps by era**.

| Avionics | Comes with | SAS modes | Loop (gain · fastest turn · deadband) |
|---|---|---|---|
| Gyro autopilot | human computers (year 0) | Stability, Retro (Retro since v1.73.2, Q216) | 2/s · 0.3 rad/s · 0.5° |
| Analog autopilot | mainframes (year 3) | + Prograde, Normal, Anti-normal, Radial in/out | 3/s · 0.45 rad/s · 0.2° |
| Guidance computer | onboard computers (year 7) | + Maneuver, Target, Anti-target, Relative pro/retro, Docking | 4/s · 0.6 rad/s · 0 |

- The program's era is `compEra()`, so a power that lags in computing gets each step later (up to 4 years).
- `s.av` is fixed when the vessel is made (`avNow()`), and a vessel split off keeps its parent's. With no program running
  (sandbox, physics tests: `khOn()` false) it is the guidance computer, and so are ground-guided procedures (`s.proc`):
  nothing that existed before changes outside a career.
- A mode the avionics lack holds the attitude (`sasTarget`). In flight those buttons are dimmed, with a tooltip naming the
  generation and era that bring them; *SAS → node* explains instead of switching. The builder's Control block opens with
  the flight's avionics and what comes next.

**Measured** (90° turn in vacuum under SAS; how tight it holds after settling)

| | gyro | analog | computer |
|---|---|---|---|
| Bare pod (wheels) | 5.6 s | 3.7 s | 2.8 s |
| Orbiter, first stage lit (gimbal) | 5.1 s | 4.0 s | 3.5 s |
| Orbiter on wheels alone | 11.2 s, ±0.30° | 11.4 s, ±0.11° | 11.5 s, ±0 |
| Lunar on wheels alone | 53.9 s | 54.1 s | 54.2 s |

**What it taught**
- **The loop only shows where authority is spare.** Big stacks on wheels turn at the limit of their torque and wheel
  storage (peak 0.23 rad/s on the Orbiter, under even the gyro's 0.3), so all three generations turn them alike and the
  difference is how tightly they hold. On a pod or under a gimbal the generations separate 2×.
- **The modes are the real gate.** In the first three years an orbit is flown on Stability plus the pitch keys
  (re-aim the hold as the flight path bends), and a capsule comes home shield-first because it is stable, not because
  SAS holds retrograde. That is how Vostok and Mercury flew.

**Tests** section `control-3` (3 checks; numbered §37, then §39, until v1.46.2): the generation follows the era (and the sandbox gets the best); the mode table, "prograde on a
gyro holds", the pod's turn time ratio and the gyro's deadband; a gyro-era satellite loaded back from the register
still flies its gyro. 315 pass.

**For other sessions**
- **economy / planning:** `AV`, `avNow()`, `avOf(s)`. A facility, import or purchase that buys better avionics early
  would set `s.av` (or move `avNow`). Registered vessels keep theirs (`vstOf` stores `av`, `vesselOf` restores it;
  entries from before v1.46.1 get today's).
- **tester:** *All tools* also gives the best avionics (`avNow`); the epoch picker doesn't move the date, so without it
  a tester at epoch 4 flies a gyro.
- **ui:** locked SAS buttons are `disabled` with a `title`; the SAS toggle's title names the avionics.
- **anyone writing career flight scripts:** in a program before year 3, `sasMode='pro'` holds the attitude.

## v1.51 — spin stabilisation (2026-10-08, control session)

The fourth slice of the control review. The rotation step applied τ/I and nothing else: Euler's equations were missing
their gyroscopic term (ω×Iω). So a spinning stage turned to every torque as if it weren't spinning, never wobbled, and
kept its angular momentum only to ~1 %. Spin is how stages were held before guidance could (Explorer 1's cluster, the
Vanguard and Delta third stages, the PAM kick stages), so in the gyro era it is a real tool.

**What changed**
- **Euler's equations** (`integrateRot`): in the body frame I·dω/dt = τ − ω×(I·ω), integrated RK4, cut into substeps of
  ≤ 0.05 rad (`ROT_STEP`) when spinning fast; the attitude turns exactly by each substep's ω (it was a first-order
  quaternion step). The rails attitude step goes through the same function.
- **Spin-up motors** (`spin`, *Control*, 0.03 t, 1 M): a ring of small solids, 4,000 N·m·s in 1 s about the axis, ~2 rev/s
  on a 1.25 m kick stage. They fire with the event that lights their stage, or, on a stage without engines, the
  separation that releases it: whichever leaves it the bottom stage (`spinFire`, from `stage`). Never at a booster
  separation.
- **SAS on a spun stage** (`s.spun`, set when the motors fire): the rate loop leaves the roll alone, so it damps the
  wobble (a nutation damper) instead of eating the spin. A roll key under SAS hands the roll back and SAS spins it down;
  below 0.5 rad/s it is an ordinary vessel again.
- **Time warp past 4×** keeps a spin about the axis (spun, or SAS off and ≥ 1 rad/s): the wobble is dropped and the axis
  stays put. Everything else still stops turning on rails, as before.
- **HUD** row *Spin* (rpm, the wobble's cone angle). **Builder:** the Control block gives each spin motor's rpm on what
  is left when it fires (tanks full), and warns under 60 rpm.

**Measured** (`study_spin.mjs`: a Probe core + Tank 1 t + Petrel kick stage in orbit, its thrust 0.5° off the axis,
burned to empty, 46 s)

| Spin | before: axis off at burnout · Δv off | now: axis off · Δv off | now, SAS on |
|---|---|---|---|
| none | 119° · 49° (tumbles) | 121° · 44° | — |
| 0.5 rev/s | 85° · 2.8° | 12° · 5.5° | |
| 1 rev/s | 74° · 0.54° | 3.2° · 1.3° | 0.9° · 0.01° |
| 2 rev/s | 61° · 0.11° | 1.1° · 0.34° | 0.26° · 0.00° |
| 4 rev/s | 41° · 0.03° | 0.2° · 0.09° | |

Free spin at 2 rev/s for 60 s: angular momentum kept to 0.017 % (was 0.83 %); the wobble turns at 6.186 rad/s in the body
frame, Euler's (I_axis − I_side)/I_side × spin to four figures (was 0). Spin motors on that stage: the builder says 121
rpm, flown 122. Physics step: no change beyond noise (Lunar / Heavy 73–81 / 82–89 µs, back to back).

**What it taught**
- **Spin already half-worked without the physics, which hid the gap.** A body-fixed torque that turns with the stage
  averages out, so before the change the Δv still went roughly straight at 2–4 rev/s while the axis itself wandered
  40–60°. Only measuring the axis, not just the Δv, showed the gyroscopic term was missing.
- **The wheels' stored momentum had to stay out of the gyroscopic term.** With it in (the textbook ω×(Iω + H)), three
  capsule checks failed: a max-q abort, a crew landing on Nyx, and a plateau landing at 146 m/s under a full main. A pod's
  100 kN·m·s is a gameplay budget (v1.43), about twenty ISS gyroscopes; as a real gyroscope it pinned the capsule against
  its chute. Real pod numbers (~1–5 kN·m·s) would make it harmless, but that is a v1.43 retune, not this slice. The cost:
  angular momentum isn't conserved while wheels hold momentum, as before.
- **The SAS rate integral leaked the spin away.** It sums in the inertial frame, and on a coning stage that sum picks up
  a roll part: 22 % of a 1 rev/s spin went into the wheels over one burn. The SAS's roll output is now zeroed whole on a
  spun stage, integral included.
- **SAS on a spun stage helps more than spin alone** while the engine burns: the rate loop damps the wobble and steers
  the gimbal, so the Δv error falls from 1.3° to 0.01° at 1 rev/s.

**Not modelled:** energy dissipation, so no Explorer 1 flat spin (a spin about the long axis is stable here forever);
yo-yo despin; spinning anything but about the long axis; products of inertia (the diagonal is kept, as before).

**Tests** section `control-4` (3 checks): a free spin keeps its angular momentum and wobbles at Euler's rate; the
misaligned kick stage tumbles unspun and flies within ½° spun, and SAS keeps the spin; the motors fire at the right
separation, at the builder's rpm, warp keeps the spin, a roll key takes it back. Mutation-tested: dropping the gyroscopic
term fails the first two; dropping the roll guard fails the second.

**For other sessions**
- **everyone flying scripted vessels:** `integrateRot` changed (exact attitude step, gyroscopic term). Every check still
  passes; tapes are retired by the fingerprint as usual (`spinFire` added to it).
- **visuals:** `spin` draws as the default banded drum; it could have its nozzles. A spinning stage now actually spins on
  screen at up to several rev/s.
- **economy:** `PRICE.spin = 1`, `tierOf` gives it 1.
- **builder:** `spin` is in *Control* by kind.

### v1.51.1 — the wheels won't spin a vessel apart (PLAYTEST #18, #23)

The robot playtester held a pitch key with SAS off: the Orbiter's upper stage reached 23 rad/s in 9 s and tore the pod off
its tank, with the wheels only 89 % full. A bare pod: 66 rad/s in 2 s, chute torn off; without the fix it goes on to
500 rad/s. 100 kN·m·s of storage (v1.43) is tens of rad/s on a light stage, so storage never ran out before the structure.

- **The wheels' controller won't drive the vessel past `WHEEL_W`** = 1 rad/s in pitch and yaw, 3 rad/s in roll (body
  axes; `wheelGive`). Torque that would turn it faster that way is cut to what reaches the limit exactly (at a pod's
  55 rad/s² a plain cut-off overshot to 1.3 rad/s); slowing down is never refused. In effect the storage is sized to the
  vessel (≤ I·WHEEL_W from rest), which is the playtest's first suggestion, without per-vessel magic. SAS never asks for
  more than 0.6 rad/s, so nothing it flies changes; big stacks still run out of storage first (Orbiter 0.512 rad/s, full).
- Gimbal, fins and RCS are not limited: they spin a stage only while burning, in air, or on gas.
- **Builder wording (#23):** the negative-stability note shows only when a margin is negative, and now names steerable
  fins too; "Roll nothing" drops the kN·m.
- Tests: section `control-5` (1 check, mutation-tested: without the limit, 60 and 503 rad/s).
- The wheels' momentum is still left out of the gyroscopic term: the limit bounds what the keys put in, not what SAS
  stores against a steady aero torque (a capsule under its chute), which is where it did harm.

**Next on this line:** energy dissipation (flat spin) and yo-yo despin if spun payloads become a thing; the gimbal and fin
deflections drawn (visuals); a pitch programmer for the gyro era if row 101 says ascents are a chore.

## v1.61 — landing legs, and a contact model that holds wide feet (2026-10-08, vehicle session, QUEUE Q31)

Built to the plan above (§ "Vehicle parts", Q31). Headless only; nobody has seen it drawn yet (TESTING row 135).

**The part** (`PARTS.leg`, `sim/vessel.js`): a surface part, mounted in sets with the builder's radial count. 0.05 t,
price 1.5, complexity tier 1, palette *Surface*. Stowed for launch; **Y** in flight puts all legs down or up (`legOp`,
recorded on autopilot tapes as op `G`). Deployed, the foot stands 1.5 m out from the skin and 1.0 m below the leg's
bottom. Joint ratings C 900 · T 600 · S 240 · B 80. The legs have no drag and no animation yet. The mesh in `app/gl.js`
is a placeholder (a strut along the skin, or two struts and a pad), for the parts & pad beat to replace.

**Contact** (`footPoints`): a deployed leg is one point, at its foot; a stowed one is none. The lowest point counts the
feet, so with legs down the rims (a metre higher) drop out by the existing 0.5 m rule.

**Measured** (pod + 1 t tank + Wren, 2.3 t, four legs on the tank: feet at r 2.1 m, centre of mass 2 m above them):

| Ground | Bare (rim of the Wren) | With legs |
|---|---|---|
| flat, 1 m/s | lands | lands |
| taiga 13°, 15°, 20° | topples on all three | lands, leaning 13° / 16° / 21° |
| flat, 8 m/s | — | lands, leg load 0.9 of rating |
| flat, 9.4–11 m/s | — | legs snap, it goes over |

The full Orbiter (13 t, centre of mass 7.6 m above its feet) gains little on slopes from legs on the Kestrel: its
footprint can't beat atan(1.3/7.6) ≈ 10°. On the flat, standard joints snap at 4 m/s, reinforced ones too, and
**heavy** joints (×4) take 4.6 m/s. So legs are a lander's part, and a heavy stack pays for heavy joints.

### The contact model needed three fixes for wide feet (terrain session: please read)

All three are in `groundContact` (`sim/flight.js`). Every contact point used **a quarter of the vessel's mass**
(`mPer`) to size its spring, damper and friction cap. That is right for the stack moving as a whole. It is wrong for
a point far off the axis, where the mass that point actually moves (rotation included) is much smaller: ~73 kg
instead of 578 kg for the lander's feet. Each point now uses its **effective mass** along the normal (`mN`) and along
the slip (`mT`): 1 / (n · (1/M + |r × t|² / I)).

1. **Friction pumped a yaw spin.** The old cap (stop the slip in ~2 steps through `mPer`) overshot every step for an
   off-axis point and rectified into a steady spin. It was there before legs: the bare Orbiter given 0.3 rad/s slowed
   to 0.001 and spun back up to 0.27. With legs (feet 7× farther out) it started on its own at touchdown and never
   stopped (0.31 rad/s).
2. **The normal damper overshot.** c·dt/m was ~4 for the lander's feet, so it chattered until it toppled on the flat.
   The spring and damper are now capped at 0.5·mN/dt² and 0.5·mN/dt. The halving matters: under a tall stack the
   normal and friction forces both push on pitch, and at full gain each was stable alone but together they rang at a
   two-step period (`s.w` flipping sign every step while the attitude stood still).
3. **Stiction.** Friction was viscous with a cap, so anything on a slope crept. With the old, too-large cap the creep
   was a few mm/s and passed as rest. With a correct cap it was 0.5 m/s. Each point now holds a planet-fixed anchor
   where it first touched: a tangential spring (≤ 0.25·mT/dt²) plus a damper (≤ 0.5·mT/dt), capped at μ·Fn. Past
   the cap the point slides and the anchor follows, so a slide is Coulomb as before. The anchor clears when the point
   leaves the ground.

For a stack on its own narrow rim almost nothing changes (mN ≈ mPer there). The §25 checks (ice slides, snow, sand
and basalt verdicts, the Orbiter toppling on 12–17°) still pass.

**Tests:** `test.mjs` section `vehicle-1`, 5 checks: feet replace rims; the lander topples bare and stands with legs
on 13° and 20°; 8 m/s holds and 11 m/s snaps; spun at 0.3 rad/s, the Orbiter and the lander both land; a tape replays
the legs.

**Not yet:**
- legs going down by themselves in procedures (`landAt`), and in the robot's landings;
- a softer leg stroke (a crush-core damper) for a speed bonus;
- a deployed state that survives a vessel leaving the flight (`vesselOf`'s `vst`; landed vessels are pinned, so it
  only shows if one is re-flown);
- drag on deployed legs;
- sizes (a 2.5 m class leg).

**Q30 slice 1, moons: done (QA session).** `node playtest.mjs 68 72 55 73 125` (about 3½ min in all). The page fetches
`fly_ladder.mjs`, cuts its Node-only tail, imports it from a blob URL and runs `flyLadder`/`flySite` with an `api` made of
page globals and a dummy `HOOK`, so the real HUD, news and map show what a player would see. Every ladder mission passes.
Staged pay reads right (TESTING 92 ✓), the Nyx reveal works, the prograde Nyx control is wrecked in 2.5 days, and a
twice-flown landing comes down 6.7 m from its point. Found: staged pay for a mission nobody flew (PLAYTEST #28), weighing
and flying past Nyx pay together (#29), Selene's first orbital period is logged mid-capture (#30), map labels pile up at
the top-left corner (#31), and a sun-behind lander on Selene is a black silhouette (#32). Slices 2 (docking) and 3
(stations) are still open.

**`shot.mjs` on the RTX (QUEUE Q28).** It now passes `--force_high_performance_gpu` like `playtest.mjs`: WebGL reports the
"NVIDIA GeForce RTX 5050 Laptop GPU" by default and the Intel iGPU with `SHOT_IGPU=1` (`SHOT_FLAGS` still overrides).

**Q30 slice 2, docking: done (QA session).** `node playtest.mjs 59 60 61 56 62 63`. The scenes are §22/§25/§27/§29's,
placed in the page, and `PT.dockIn` is a scripted pilot: Docking SAS plus bang-bang RCS on the target's position in the
ship's frame. It latches from 50 m in 3.5 min on 6.5 kg of gas. Bumps, undocking, vessel switching and the bay all behave
(TESTING 56, 58–63). Worth knowing: the RCS budget is 4.8 m/s of Δv, so a 300 m approach at 2 m/s uses 85 % of it.
Row 116 (docking at Selene) and the claw are left for slice 3. Run the slice by itself: when two sessions' Chromes started
together, row 62 stalled for minutes; alone it takes 49 s.

**Q30 slice 3, stations: done for rows 60 (claw), 64, 66, 67, 98 (QA session).** `node playtest.mjs 60c 64 66 67 98`.
The setups are §26, §30, §32 and §33, and the Program's Fleet tab is read after the flight is left. Everything works as
specified (TESTING notes). Still undriven: 65 (crew rotation), 115/117 (relay and rover science on Selene), 116 (docking
at Selene). Each needs a rover or crew set up on another body, and is the next driver if Q30 is extended.

## The pilot's SAS modes by rank — plan (2026-10-09, vehicle session, QUEUE Q134; CREW.md § Part 2; nothing built)

> **Superseded (2026-10-11, DECISIONS D15.4):** modes come from qualifications (rendezvous, docking, landing), not rank (CREW.md § Skill); Q134 re-plans this. **Re-planned:** economy § "Plan revision: crew by qualification" (Q283, 2026-10-13): the table by qualification and time in type; the pilot loop and `modesOf` below stand.

**The gap.** CREW.md has the pilot fly the modes the vessel's computer can't. Rank 1 gets the analog autopilot's
modes; rank 2 adds manoeuvre and target; rank 3 adds docking and a manual landing hold. Today avionics are whole
generations: `avOf(s) = AV[min(s.av, avCap(s))]`, and `sasModeOK(s, m)` asks that generation's list. Rank 2 (target
but not docking) sits between two generations, so gating has to become per mode.

**Proposal:**
- **`modesOf(s)`**, the union of two sources:
  - the **computer's** modes: `AV[min(s.av, avCap(s))].modes`, as today;
  - the **pilot's** modes: `PILOT[r].modes` for the best pilot aboard (`r` = the highest rank of role *pilot* among
    the crew on parts that are still on), only on a crewed vessel.
  - `sasModeOK(s, m)` asks the union. The buttons, the tooltip and `sasTarget` stay as they are.
- **The loop follows the source.** If the computer has the mode, the computer's loop flies it (`k`, `w`, `db` from
  `AV`). If only the pilot has it, a pilot loop: *tune* k 2.5/s, fastest turn 0.35 rad/s, deadband 0.5°. That's
  CREW's "slower and less precise than a computer of the same tier", so computers win when they arrive (pillar 8).
- **The tiers:**

  | Rank | Modes |
  |---|---|
  | 1 | stability, prograde, retrograde, normal, anti-normal, radial out/in (the analog autopilot's list) |
  | 2 | + manoeuvre, target, anti-target, relative prograde/retrograde (`node` + `TGT_M` without `dock`) |
  | 3 | + docking, + the manual landing hold |

- **The landing hold is a new mode, not just a gate.** It holds attitude on the surface-relative retrograde and flies a
  descent-rate law on the throttle (hover, then sink at a set m/s). It's the control session's kind of work (size M),
  planned on its own when crew reach M3. Until then rank 3 means docking.
- **With v1.68:** from the onboard-computer era, crew capsules carry their own computer (`hasComputer`), so the pilot
  matters in eras 0–1 and as the precision floor; uncrewed vessels are untouched. Procedures keep the best avionics.
- **What it needs from the roster** (CREW's astronaut office, economy and flow): who is aboard. Today `p.crewAboard`
  is a count. The roster has to give each crewed part its astronauts' ids, with role and rank (`p.crew = [{id, role,
  rank}]`), and keep that through the register (`shapeOf`'s `o.crew`, `vesselOf`). Until the roster lands, no pilot
  modes, which is today's behaviour.
- **UI (flow):** a SAS button the pilot provides names them in its tooltip ("flown by Vela Marisk, pilot, rank 2").

**Checks to write with it:**
- in era 0, rank 1 gives prograde, rank 2 target (not docking), rank 3 docking;
- the pilot's 90° turn is slower than the guidance computer's;
- an uncrewed probe is unchanged;
- in the onboard-computer era a crewed capsule flies the computer's loop.

**Sizes:** per-mode gating plus the pilot loop is S (vehicle), after the roster; the landing hold is M (control).

## v1.68 — power: the onboard computer, solar cells and wings, batteries (2026-10-09, vehicle session, QUEUE Q34a)

Built to the plan in § "Vehicle parts" (Q34a), with Caio's call on the computer: **built into crew capsules, a part for
probes**. Headless only: nobody has seen the parts drawn or the builder's power line yet (TESTING row 144).

**Parts** (`sim/vessel.js`; palette *Power*):

| Part | Kind | Mass | Power | Notes |
|---|---|---|---|---|
| Onboard computer `ocomp` | inline | 0.03 t | −50 W | offered from the onboard-computer era (`era: 2`); price 8, tier 2 |
| Battery 1 kWh `batt` | inline | 0.02 t | stores 1 kWh | price 2 |
| Solar cells (body) `bpanel` | surface, fixed | 0.01 t | 40 W in full sun × 0.32 | price 2, tier 1 |
| Solar wing `wpanel` | surface, folds out (**P**) | 0.03 t | 300 W in full sun × 0.9 | tears off deployed above 1 kPa; price 5, tier 1 |

A probe core has 0.5 kWh of its own; the antenna draws 5 W and the camera 10 W. Crew capsules run on their own fuel
cells (their 10 days of life support) and draw nothing.

**The model** (new `sim/power.js`, loaded before `ground.js` so it's inside the SIM block):
- One store per vessel, `s.E`, up to its batteries (`powCap`). The loads (`powLoad`) draw on it, and the panels fill it
  while the vessel is out of its body's shadow.
- **The shadow** is a cylinder behind the body, since the sun is fixed and far (`SUN_DIR`).
- **Panels in flight:**
  - body cells give their average share whatever the attitude;
  - a wing turns about its own arm, so it gives √(1 − (arm·sun)²) of its best.
- **Stepping:**
  - each physics step (`advPhys`), and rails steps up to 60 s, use the sun right now;
  - longer rails steps use the orbit's average, with the shadow share taken from its elements (`eclFrac` with the
    orbit's β).
- **The builder's line** (`powerLine` in `app/editor.js`) appears only for designs with something electric. It shows a
  low Tellus orbit's average against the load, and the battery against one shadow, for example
  `Power +339 W / −55 W · shadow 16 min needs 15 Wh (battery 1500 Wh)`. It turns red and says "it runs flat" when
  the panels can't keep up.
- **Running flat never kills (Pillar 5):** the onboard computer goes off ("Power flat: the onboard computer is off,
  analog autopilot only…") and comes back once the panels catch up ("Power back").
- **Avionics** (`avOf` takes the lower of `s.av` and `avCap(s)`): from the onboard-computer era, the guidance
  computer's modes need `hasComputer(s)`, meaning a crew capsule, or an `ocomp` with power. Sandbox, physics tests,
  the tester's tools and procedures keep everything, as before.
  - **Presets:** no preset flies a probe that needs the guidance modes. The robot's docking pilot (`PT.dockIn`) flies
    in a test scene. So nothing needed the part added. **QA:** a robot career past year 7 that wants target or docking
    modes on a probe now needs an `ocomp` on it.
- **Era gate:** the builder hides a part with `era` until the program's `compEra()` reaches it (not with the tester's
  tools, and not in the sandbox). It's the first era-gated part, and the gate is the general one Q10 can reuse.

**Measured** (a probe: core, computer, battery, antenna, 1 t tank, Petrel, two wings):
- **Low orbit** (r 1,384 km, β 0): 37.2% of the 42.7-minute orbit is in shadow (15.9 min). The panels give 540 W
  peak and 339 W on average against 55 W of load, so one shadow needs 14.6 Wh of the 1.5 kWh on board.
- **Integrated along one orbit** on rails in 20 s steps: +204 Wh, with 14.4 Wh drained in the shadow. One long rails
  step gives +202 Wh, and the steady state says +202 Wh.
- A wing deployed at 10 km and 300 m/s (14.2 kPa) tears off.

**Tests:** `test.mjs` section `vehicle-2`, 5 checks: the budget by hand; one orbit, stepped and in one step, against
the steady state; a wing in thick air; the computer (a probe with and without it, a crew capsule, running flat and
coming back); a tape replays the wings.

**Not yet:**
- what a flat battery does to the antenna and camera, and to a satellite's service on the registry (space lane, Q27
  and the power side of Q50; they read `powerBudget`, `hasComputer`, `s.E`/`s.pwrOut`);
- an RTG;
- a builder choice of the orbit for the budget (it always assumes low Tellus orbit, β 0);
- the look of the parts (placeholders in `app/gl.js`, Q97);
- battery charge carried across a flight's end (each flight starts full).

## v1.73 — M0: presets for the first orbit missions, the Program screen's stray labels, and the palette v1.68 broke (2026-10-09, vehicle session, QUEUE Q74, Q77)

**Q74, PLAYTEST #24 (P1): two presets.** No preset could fly *The beeper* or *Passenger: one orbit*, so a presets-only
player stopped at the end of epoch 1. Both now use the Orbiter's launcher with the payload in the pod's place, plus a
reaction wheel to steer it (the wheel is 0.12 t, the pod 0.84 t):
- **Beeper:** cone, instrument package, wheel. It reaches orbit (periapsis 102 km) with 1,556 m/s to spare.
- **Passenger Orbiter:** chute, biocapsule, wheel. It reaches orbit with 715 m/s spare, goes once round, deorbits,
  and lands at 4.2 g with a ~256 K cabin.
- **Rejected:** keeping the pod. With the biocapsule, the pod and a shield under a decoupler, the rocket didn't make
  orbit. With the pod plus the package, only 319 m/s was left.
- **Without the wheel:** the plain swap (the payload for the pod, no wheel) also flies, at 6.4 g, but it can only turn
  while an engine burns.
- `career.mjs`'s own `passOrbit` stack (biocapsule, pod, shield, no decoupler) would bury the shield under the tank in
  real physics. It isn't touched here (QA's file).

**Q77, PLAYTEST #27: "NaN%" on the Program screen.** `builder.js` `overlay()` now also returns on the Program screen
(`atHQ`, where `S` is still the flown vessel), and it skips a load fraction that isn't finite.

**The palette v1.68 broke.** Q34a's era-gate line in `palette()` ended with a `//` comment that swallowed the next
statement (`const b=document.createElement('button')`). So from v1.68 to here **the construction screen listed no
parts**. The headless suite only checks that the page parses; the robot's `m1` run caught it at once. Fixed.
Lesson (LESSONS_LEARNED): run `node playtest.mjs m1` before pushing anything that touches a screen, as the QUEUE flag says.

**Checked:** `playtest.mjs m1` passes in full on this branch (the gate, a Sounding, the beeper to orbit, two debriefs,
no boxes overlapping). `test.mjs` section `vehicle-3`: the Beeper in orbit; the Passenger Orbiter once round and home
under 8 g and 330 K.

## v1.73.1 — the Passenger Orbiter's nose cone; vehicle-4 alone and in the smoke run (2026-10-09, vehicle session, QUEUE Q201, Q204)

**The passenger cooked on the way up (PLAYTEST #35).** The preset was chute, biocapsule, wheel: the chute (0.3 m) is
narrower than the capsule (0.625 m), so the capsule's shoulder flew in the flow all the way up. On the robot's ascent
(`handAscent`, level by 38 km) its skin reached ~500 K and the cabin, which follows the skin with a 10-minute lag from
liftoff (`missionTick`), passed 330 K on the climb: "Biscuit overheated". The 10-minute lag stays: the crew capsule's
comment in `sim/vessel.js` says a bare animal capsule on an orbital ascent is meant to cook, so this is the preset's
design problem, not the physics'. **Fix:** a nose cone over the chute (`cone, chute, bio, rwheel, …`). Measured on the same
ascent (scratch runs of the preset and variants):

| Stack top | Skin at orbit | Cabin at orbit | Spare in orbit |
|---|---|---|---|
| chute, bio (was) | 499 K | 330 K: failed | 715 m/s |
| cone, bio (no chute) | 319 K | 300 K | 822 m/s |
| cone, chute, bio | 318 K | 300 K | 665 m/s |
| **cone, chute, bio, … t8, fins, fins** | 316 K | 300 K | 580 m/s |

The chute is a staging event, not a position, so it opens under the cone as before. **The cone cost the stability margin**
(+0.94 → −0.67 calibers: Rollout said "Aerodynamically unstable … only steering keeps it straight", seen on the browser run
of row 147). A second fin ring at the bottom puts it back (+0.91); fins higher up (between `dec` and `t8`) made it worse
(−1.24). `vehicle-3` now also fails a Passenger Orbiter under 0 calibers. The first flight's price goes 58 → 60.3M.
`PACE=1 node career.mjs 3 12`, one fin ring against two: frugal programs reach orbit ~10–30 days later and their minimum
funds drop ~10M (frugal company 11/12 to orbit either way); resource programs about the same. Caio chose the second ring:
a first-hour preset shouldn't warn.

**Why `vehicle-3` passed.** It kept its own cabin temperature, starting at 290 K after the orbit, and never read the flight
record. It now reads `S.rec` over the whole flight: `bio`, `bioOK`, `bioOrbits ≥ 1`, `gMax`, and the cabin at orbit and
coming home. On the old preset it fails with the game's own words ("Biscuit overheated (cabin 330 K)").

**`vehicle-4` in `--smoke` (Q204).** The check put the logbook back (`PR.log = log0`) before two of its readings: the
Hopper short and the Orbiter *tight* for 400 km. Alone the logbook is empty; in the smoke run an earlier section has left a
5,000 m/s best orbit there, which reads the Orbiter *short* of 400 km instead of tight. Every empty-logbook reading is now
taken before the logbook is restored. (The "Beeper short of orbit" in the failure's detail line was the check's own
deliberate 5,600 m/s case, `best`, not the failure.)

**Browser, row 147 (tester mode):** the gentle ascent passes: cabin 290 K at orbit, Biscuit home at 4.2 g, +180M. The steep
one wasn't run in tester mode: `PT_URL` with a query (`?flat=38`) breaks the page's `?tester` (playtest appends `?tester`
to whatever is there), so those runs flew without tester mode. They found the next problem:

**Without a retrograde hold the passenger cooks coming home (PLAYTEST #38, Q216).** At *Passenger: one orbit* a real
program is still in the human computers' era (`compEra` 0 until year 3), so its avionics are the Gyro autopilot: `stab`
only, no `retro` (`avNow`, `AV`). Row 147 sets `sasMode = 'retro'`, which only tester mode's "all tools" honours. Headless,
the robot's way home (a period, speed cut until periapsis < 45 km, chute armed) with `stab` or SAS off: the passenger
overheats on every version of the preset, the old one included (bio skin 630–910 K, the stack 70–125° off retrograde);
with `retro`, under 270 K.

## v1.79 — warnings before launch, legs by themselves, the escape tower's own shelf (2026-10-09, vehicle session, QUEUE Q48, Q121, Q32)

**Q48: the Rollout screen warns.** `launchWarnings(stack, aims)` (`sim/vessel.js`, after `stageStats`) adds lines to
flow's `rollChecks()` with one call (flagged: `app/rollout.js` is flow's file). Every line is ⚠ or ✔, never ⛔: the
player may know better, and the flight is how they find out.
- **What the flight is aimed at** (`flightAims()`): accepted *Satellite to N km* and *Image* contracts, and the suggested
  next mission if it's an orbit one (beeper, orbiter, lift1, lift2).
- **Δv:** the stages' Δv against the program's best flight to orbit (the logbook's `orbit` fact, which keeps the least
  Δv any flight has taken). Before anyone has reached orbit, it uses ~4,500 m/s, a good ascent (the Orbiter in §2 spends
  4,446). A contract's altitude adds a Hohmann climb from low orbit (`dvToAlt`: +307 m/s to 400 km). Three outcomes:
  - **short:** the vacuum total doesn't reach the need;
  - **tight:** only the vacuum total does, while the first stage's sea-level Δv plus the rest doesn't;
  - **ok:** it does even counting the first stage at sea level.
- **Measured on the presets** (before anyone has reached orbit), for the beeper and for a 400 km satellite:

  | Preset | The beeper | 400 km satellite |
  |---|---|---|
  | Beeper | ok (5,745 m/s) | ok |
  | Orbiter | ok (4,663) | tight (4,894 vacuum vs 4,807) |
  | Passenger Orbiter | ok (5,058) | ok |
  | Hopper | short (1,560) | short |
  | Passenger | short (3,210) | short |
- **No parachute:** a crew capsule or a biocapsule aboard with no chute gets "No parachute: the crew (the passenger)
  can't come home". TWR < 1 and the passenger safety review were already in `rollChecks`.
- **The next-step hint** (`NEXT_PRESET`, `sim/next.js`) now names the Beeper for *The beeper* and the Passenger Orbiter
  for *Passenger: one orbit*. The "Orbiter with an instrument package in place of the pod" text is gone.

**Q121: legs by themselves.**
- `autoLegs(s)` (`sim/flight.js`) puts the legs down while a procedure is flying the vessel (`s.proc`) and it's
  descending within 1.5 km of the ground. It's called right after `procStep` in `advPhys`. A hand-flown landing stays
  the player's call (Y).
- **What's remembered:** legs and wings left deployed are in the vessel's saved state (`vstOf` adds `dep`, the indices
  of deployed parts; `vesselOf` restores them). So a lander registered on Selene still stands on its legs when loaded
  back, and a satellite keeps its wings out.
- **Not yet:** none of the ladder's presets (Probe, Sample Return) has legs, so `fly_ladder.mjs` doesn't exercise this
  end to end.

**Q32: the escape tower** is in a *Crew escape* palette category of its own (it was under *Other*).

**Checked:**
- `test.mjs` sections `vehicle-4` (warnings: the table above, the logbook's best, the climb against a hand Hohmann, the
  parachute) and `vehicle-5` (auto legs at 3 km / 1.2 km / climbing / by hand; legs and wings through the register);
- the full suite, 527/527;
- the robot's `m1` run passes; a tester probe shows the Hopper's "Short of orbit for The beeper" and a chute-less Passenger Orbiter's "No parachute" in the Rollout panel.

## v1.80 — a Docking preset; power's second slice: an RTG, the budget at the flight's aim, charge kept (2026-10-09, vehicle session, QUEUE Q78, Q131)

**Q78: the Docking preset.** A docking head on the Orbiter's launcher, so the docking rows (TESTING 58–67, 98, 116) can
be flown without the builder: a port on top, a probe core with an onboard computer (Docking SAS needs one on a probe,
v1.68) and a battery, two rings of four RCS quads and two gas bottles on the upper 2 t tank. It's the first preset built
as a v2 tree (surface parts), made at the end of `sim/vessel.js` once `toV2` exists.
- **Measured:** it reaches orbit (periapsis 103 km) with 646 m/s spare and its 30 kg of gas untouched.
- **To dock:** launch it twice, one as the target, or chase any satellite with a port. Docking SAS comes in the
  onboard-computer era (or with the tester's tools).

**Q131: power, second slice** (`sim/power.js`):
- **An RTG** (`rtg`, surface part, 35 kg, 60 W day and night, price 15; *Power* palette): `powRTG` is added in the
  physics step, in long rails steps and in the steady state. The battery only has to cover the load the RTGs don't.
  Placeholder mesh: a dark finned drum on a strut.
- **The budget at the flight's aim:** the builder's power line works out the orbit the flight is aimed at (the highest
  accepted satellite contract, `flightAims` from v1.79), else low Tellus orbit. It still assumes the sun in the orbit's
  plane (β 0), the longest shadow, and says so. At 1,000 km the shadow is 19% of the orbit, against 37% low down.
- **The charge is kept:** the vessel's saved state (`vstOf`) carries `E`, and `vesselOf` restores it, so a satellite
  loaded back has the battery it was left with (each new flight still starts full).

**Checked:** `test.mjs` sections `vehicle-6` (the Docking preset to orbit: quads, gas, port, Docking SAS with its
computer) and `vehicle-7` (RTG at night, the higher orbit's shorter shadow, the charge through the register); the full
suite 541/541 with Q78; the smoke shard and the power, legs and docking sections after Q131; `playtest.mjs m1` passes;
in the page, a core + antenna + RTG reads "Power +60 W / −5 W (low orbit average, the sun in its plane) · shadow 16 min
needs 0 Wh".

**Not yet:** a choice of β or orbit in the builder itself; what a flat battery does to a satellite's service (space, Q27).

## v1.84 — a satellite's lifetime in the builder (first numbered v1.81) (2026-10-09, vehicle session, QUEUE Q141)

MIDGAME § Satellites: lifetime is a design choice made once, so the builder shows it. For a design carrying an antenna,
a camera or instruments, the stats panel has a **Lifetime** line at the orbit the flight is aimed at (the highest
accepted satellite contract, else low Tellus orbit). It says what holding that orbit costs a day, how long the Δv left
after getting there pays for it, and then what happens: "the air brings it down in …", or "it drifts off its slot
(its service pauses)".

**How** (`satLife(stack, alt)`, `sim/vessel.js`; reads space's functions, changes none):
- The stand-in is the design's top stage (the root's segment, what's left after every decoupler), as a register entry
  in a circular orbit at that altitude.
- `holdRate` (tides + drag) gives the daily cost, and `decayLife` the fall.
- The Δv left is the design's vacuum Δv minus `launchWarnings`' need (the best flight to orbit or ~4,500 m/s, plus the
  Hohmann climb), so the two lines agree.
- **Speed:** the tide's rate is a 20-day integration that depends only on the orbit, so it's cached per altitude
  (`SLOT_ALT`, ~150 ms the first time); a design edit costs 1–2 ms. The fall is only worked out if holding ends within
  20 years.

**Measured (the Beeper):**

| Orbit | Holding costs | Lasts | Then |
|---|---|---|---|
| 110 km (low orbit) | 73 m/s a day | 20 days on its 1,494 m/s | down in ~4 h |
| 200 km | 0.20 m/s a day | 17.5 years | down in 151 days |
| 400 km | 0.002 m/s a day | past 20 years | — |

**Worth knowing:** a satellite parked at the default low orbit lives days (v1.64's decay working as built). QA's Q129
(parking orbits above ~200 km) and the presets' briefs follow from it; the builder line now makes it visible before
launch.

**Checked:** `test.mjs` section `vehicle-8`; `playtest.mjs m1` passes; in the page the Beeper reads "Lifetime at 110 km
holding it costs 73.25 m/s a day; ~1494 m/s left there holds it 20 days, then the air brings it down in less than a
day"; the smoke shard after merging main.

## v1.85 — maneuver node chains, nodes past an SOI change, the finite-burn lead (2026-10-09, vehicle session, QUEUE Q33)

**Chains.** `s.node` is still the node being flown, so everything that read it before still works. `s.nodeQ` holds the
nodes after it, in time order. When a burn completes (`nodeBurn`), `nodeNext` puts the next one up ("Maneuver complete
— throttle cut; next node is up").
- `nodePlan(s)` chains them: coast along the patched-conic legs (`predictFrom`) to each node, add its Δv in that node's
  own frame, carry on from there.
- `nodePlanEnd` is where the last node leaves the craft. The map's dashed plan starts there (one call in `render.js`).
- **Keyboard:** **N** with a node already placed adds the next one at the next apoapsis of the trajectory after the last
  node. If that trajectory meets a moon (or escapes), it goes at the next leg's periapsis: the capture point
  (`nodeAddNext`).
- **The node panel:** "◀ node k of n ▶" picks which node the Δv and time buttons edit. A queued node's time is kept
  between its neighbours, and the summary says how many nodes follow. The map's drag handles still act on the active
  node.

**Past an SOI change.** Each node carries the body whose leg it sits on (`b`, set by the plan). `nodeInfo` reads a node
on another body's leg from the predicted legs (`legState`).
- **The SOI switch** used to clear the node. Now it drops only the nodes placed on the old body's leg (untagged, or
  tagged with it and already past). It keeps those for the new body and for later legs, a return to the old body
  included, and puts the next one up.
- **Measured:** test 4's transfer turned 12° (a 240 km flyby, not an impact), +1,321 m/s now. N puts node 2 at Selene's
  periapsis, 14.4 h later; a −312 m/s burn there plans a capture (e 0.21).

**The finite burn.** The craft gets lighter as it burns and accelerates harder at the end, so the first half of the Δv
takes **more** than half the burn time. `nodeLead(s, dv)` is the time to deliver half the Δv at full throttle. The panel's
"start burn in" and **Warp to burn** use it (both used half the burn time before).
- **Measured** (pod + 2 t tank + Wren, a 157 m/s raise): the burn takes 25 s, the lead is 12.9 s against a naive 12.7.
- **Flown:** a two-node Hohmann raise from low orbit to 400 km, each burn started by the lead, ended at
  399.8 × 399.9 km against a planned 400.0 × 400.0.

**Tapes:** the controls record the queued nodes with the active one (`q` in the node's JSON), so an autopilot replays
a chain. Old tapes have none.

**Checked:** `test.mjs` section `vehicle-9` (the Selene capture plan and the SOI switch; the flown two-node raise
against its plan and the lead); the full suite 554/554; `playtest.mjs m1` passes; in the page, two nodes from N read
"◀ node 1 of 2 ▶ … 1 more node after it", ▶ selects node 2, and the map draws the plan after the last node.

**Not yet:**
- ~~markers and drag handles for queued nodes on the map (flow / the map's owner);~~ done, § v1.103;
- a node placed by clicking on a later leg past an SOI change (the map's pick only knows the current leg; N covers
  the capture case).

**`m1` passes (QA session, 2026-10-09).** With Esc pause (Q39), the Debrief (Q2), PLAYTEST #25/#26 fixed and the Beeper
preset (#24), the new-career robot run is green: weather ✓, beeper ✓ on the **Beeper** preset (51M of 104M), the clock
stands still under Esc, a Debrief after each flight, and no overlapping boxes on any screen. M1's robot finish line is
met (ROADMAP M1 row). What's left of M1 isn't the robot's: the career.mjs pacing check, and a person playing the first hour.

**TESTING numbers are checked (QA session, 2026-10-09).** `test.mjs` `qa-3` fails if a TESTING row number is used twice or
"Next free number" isn't above them all. Rows had collided twice in two days (LESSONS #37), so a collision now fails the
suite you run before merging, instead of waiting for someone to read the file.

**Row 65, crew rotation, and a driver fix (QA session, 2026-10-09; QUEUE Q120).** `node playtest.mjs 65`: a crewed capsule
(chute, crew, shield, decoupler, a tank with a radial port) takes a habitat's nose port; leaving the flight registers the
stack as a crewed station; Program → Fleet → **Fly**, the HUD's undock, a retro burn (the robot cuts the speed), the tank
dropped, shield first, chute: home at 8.5 m/s with the crew safe. Found: the Debrief never mentions the crew (PLAYTEST #34).
**Driver fix:** a robot that swaps `S` for a ship it built must call `HOOK.rebuild()`, or the scene keeps drawing the ship
it launched first. `PT.park` does now. The numbers from Q30's docking and station rows stand, but their shots of 56, 59, 60,
60c, 64, 66 and 116 drew the Orbiter; 59, 64, 66 and 116 were re-shot (`C:/Users/caioa/dev/playtest-out/reshoot`).

**Tester debris (QA session, 2026-10-09; QUEUE Q161).** Tester menu → **Debris**: a height and a mass, *Breakup*
(`testBreakup`, v1.83's `breakup` plus a news line), *ASAT test* (`asatTest` named for the first foreign power), *+100 dead
stages there* (`testClutter`: 2 t Kestrel stages within 25 km of the height on seeded random planes, through `junkAdd` like
a flight's spent stages), and the **debris setting** off / light / real (`PROG.pressures.debris`, which had no UI). Heights
below the air are refused. Measured in the page: on *light* (the default), 1,500 stages and a 1 t breakup at 825 km give
R0 11 but the next breakup is ~300 years off, so no news; on *real*, R0 110, due in ~30 years, and "The 800–850 km band now
feeds itself" arrives in the first days. test.mjs `qa-4`; TESTING 177. Found on the way: a fresh program has no `PROG.satN`,
so the first seed came out NaN and every stage was dropped; the test now starts without it.

**Tester school picker (QA session, 2026-10-09; QUEUE Q106).** Tester menu → **Hardware school**: Auto and every school
in `SCHOOLS`; a pick sets `SCHOOL_FORCE` (app/gl.js) and redraws the ship. Only Cape and Steppe have a look so far, so the
other four are greyed with "draws as Cape" until Q102's steps 6–7; then they need no change here. `refView(114)`/`(115)`
already show Cape and Steppe on the Orbiter for shot.mjs. test.mjs `qa-5`; TESTING 179 (178 at first; the Steppe pad row had it, qa-3 caught the collision).

**New robot rows (QA session, 2026-10-09).** `node playtest.mjs 155 172 157 147`. 155 and 172 reload the page inside a
row (`RELOAD`: later steps use only the page's globals). 157 runs five designs through Roll out with `rollChecks()`. 147
flies the Passenger Orbiter on `PT.ascent(flatKm)` (the turn ends at flatKm, 38 in fly_ladder). It found PLAYTEST #35: the
passenger overheats whatever the ascent, and test.mjs `vehicle-3` can't see it, because it restarts its own cabin
temperature at 290 K after the orbit. Also #36, the Hopper's own instability warning.

## v1.73.2 — the gyro autopilot holds retrograde (2026-10-10, vehicle session, QUEUE Q216, PLAYTEST #38)

**Caio's call:** the first generation of avionics gets a retrograde hold (`AV[0].modes`: `stab`, `retro`), as early
capsules held their retrofire attitude. The analog autopilot (mainframes) still adds prograde, normal, anti-normal and
radial; the avionics table above says so. Why (v1.73.1 § "Without a retrograde hold"), the Passenger Orbiter's way home
from one orbit, measured headless:

| Coming home | Cabin peak | |
|---|---|---|
| SAS off, or `stab` on a fixed direction (pointed retrograde once, at 105 or 300 km) | 330 K | cooked: skin 630–910 K, 80–125° off retrograde |
| the capsule alone, upper stage dropped (with a shield; bio's `cm` .4, .25, .15) | 330 K | cooked: it flies apex-first, or base-first at 506 K skin |
| cabin lag 30 or 60 min instead of 10 | 328–330 K | cooked, or hurt at 8 g |
| **the gyro autopilot on `retro`** | **268 K** | home: skin 262 K, within 25° of retrograde |

So only a held retrograde works, and the gyro's slower loop (2/s, 0.3 rad/s) is enough. `vehicle-3` flies its way home on
`s.av = 0` now. In the builder and the flight panel the Retro button is lit from year 0 (`sasModeOK`, `editor.js`), and
Q134's pilot ranks are unchanged (rank 1 is the analog autopilot's list).


**Watching the robot play (Q224, QA session, 2026-10-10).** `node playtest.mjs --watch m1` (or `--watch=4` for 4×) opens a
visible Chrome window and paces the run for a person: a caption at the bottom says what the robot is doing (`{say: '…'}` steps,
plus the ascent's phases and staging), a yellow ring marks each click before it lands, a key press is named first, and every
step is followed by a short pause. Flights run on `PT.loop`: headless it is the old tight loop; watching (`PT.W`), the same
per-step body runs across animation frames at speed × warp sim seconds per real second, with the game's `simulate` held off so
the live loop only draws (warp ×20 above the air with the engines off, ×4 in it above 3 km; `PT.coastWarp`). `PT.fly` and
`PT.ascent` return a promise when watching, so a step that uses their value must `await` it (m1 and 147 do). Results and shots
go to `<out>/watch`, captions hidden in the shots. At 8× m1 takes ~4 min and passes; at 1× expect ~15 min (the Sounding's
parachute descent is most of it). Rows that set a scene directly (a ship placed in orbit, `PT.steps`) still jump: only m1 and
147 are written for watching. Also Q221: a `PT_URL` with its own query now joins `tester` with `&`.

## v1.113 — gates for late parts (2026-10-10, vehicle session, QUEUE Q190; from economy's v1.98 note)

Before this, only rover parts had gates (`rvPartOpen`) and the onboard computer was hidden before its era, so the cargo
bay, the arm, the station modules and the crew capsule were all buyable on the first flight. Caio's calls (2026-10-10):
**listed and designable, never flown** (as rover parts are), and **each part opens with the mission that first needs it**.

| Opens with | Parts |
|---|---|
| "The beeper" (first orbit) | docking port, radial docking port, claw, habitat module, solar wing, landing leg |
| "Passenger: one orbit" | crew capsule, escape tower (the pad abort, next on the ladder, needs both) |
| "A station" (≈ the first docking) | cargo bay, robotic arm |
| "A crew aboard" | laboratory module |
| "Soft landing on Selene" | base beacon (bases already wait for it, `BASE_FIRST`) |
| the onboard-computer era (`d.era: 2`) | onboard computer (it was hidden before; now listed), RTG (new) |
| from the start | everything else: tanks, every engine (the big ones are dear through `sourceOf` instead), fins, chute, pods, instruments, RCS and gas, wheels, spin motors, battery, body cells |

- **Code:** `PART_GATE`, `partOpen(k)` → `{ok, why, short}` and `partLaunchWhy(parts)` in `sim/program.js`, beside the rover
  gates. No gates before a program starts (`khOn()`) or with the tester's tools (`TEST.tools`), as before for the era.
- **Where it bites:** the LAUNCH handler (`app/editor.js`, after `rvLaunchWhy`), a red line in Rollout's checks
  (`app/rollout.js`), `dispatchQuote` (a design borrowing a procedure, `procAdopt`, could carry a part its owner didn't) and
  `baseRunQuote` (supply runs). The palette (`builder.js` `palette()`) lists a locked part dimmed with "🔒 The beeper"; its
  tooltip has the sentence. Presets that carry one still load.
- **Ordering check:** each gate is reachable no later than the first mission that needs the part (`vehicle-10` walks
  the `req` chains). The crew capsule's gate is safe for "A crew aboard": crews fly only after the max-q abort test anyway
  (`R.crewed` needs `PROG.done.maxqabort`), which comes after the passenger orbit.
- **Seen in the browser** (`shot.mjs`, day 1 with one flight flown): 14 parts locked with their reasons; LAUNCH on the
  Docking preset says "Not open yet: onboard computer (opens with the onboard computers era); docking port (opens with
  “The beeper”)".
- **Not done:** the rover yard's own gates are unchanged (`RV_GATE`). The race's rivals don't read gates (they don't build
  from parts). Contracts that need a part (retrieval needs the bay) still check their own `req`, which already waits
  for "A crew aboard".

Test `vehicle-10` (1 check; fails with the bay's gate removed). Full suite: 634 checks, all pass.

## v1.118 — the Assembly keeps the design still; Clear and the radial-mount count in plain sight (2026-10-11, vehicle session, QUEUE Q247, Q235, Q236; PLAYTEST #44, #42, #39)

- **The design stays pinned (Q247, #44).** The editor camera looks at the CoM and the desk's base plate (and, on the pad,
  the `LIFT`) sat under the design's lowest part, so deleting the bottom moved both and the rocket seemed to fall.
  `BLD` now keeps a pin on the root part (`st.pin`: its id, its bottom above the design's bottom and above the CoM): after
  an edit, `cam.edY` follows the CoM shift so the root stays still on screen, and `st.gap` keeps the plate where it was,
  so the rest hangs above it. Building below the plate pushes the plate down (the gap never goes negative), never the
  rocket up. A new design starts on the plate: a preset, the first part, Clear, a new root (make root). A preset's first
  edit (array → tree, `design()`) keeps its pin. `BLD.foot()` is the plate's height in the ship's frame; `app/model-desk.js`
  stands the desk on it (`deskFoot`) and sizes its scale on rocket + gap, so the scale doesn't jump as parts go.
  On the pad (desk off), `S.pf` adds the gap. Undo of a delete brings the gap back to 0.
- **Clear (Q235, #42)** had been there since v1.17: a small "clear" by undo. Caio didn't find it. Now **✕ Empty** is the
  first button over the presets and the toolbar's reads "✕ clear design" (both `clearDesign`: one undo step, a note saying so).
- **Radial mounts (Q236, #39):** `mountsHTML()` puts ×1 … ×8 chips (and `[X]`) under the parts list's status line while a
  part is held; the cursor line says "radial mounts ×n · X changes" when the held part is off any node and "radial mounts ×n [X]"
  on a surface. The toolbar group and the key help say *radial mounts* instead of *symmetry*.
- **Flow (Q272):** new player strings here say "the design", none says "Assembly"; the rename has nothing new to catch.

Robot row 200 (pin, Clear + undo, the ×4 chip; three checks). `--smoke` 567 checks pass; sections 16, 17, 32, flow-11 pass.

## v1.119 — every part says what it does (2026-10-11, vehicle session, QUEUE Q248; PLAYTEST #46)

- **A card beside the palette** (`cardAt`, `#partcard` in `builder.js`) on hover: the name, one sentence (`PART_INFO`,
  keyed by part, falling back to a 2.5 m part's base and then to its kind, so a new part from another lane gets its
  kind's sentence until it has its own), and a sheet from the part's own numbers (`partSpecs`): mass (full and empty for
  tanks), propellant, thrust and Isp, an escape tower's burn, seats and berths, turning torque, power made, stored or
  drawn, size, heat limit (`Tmax`), price (`partPrice` plus a tank's propellant at `FUEL_PRICE`). A part not open yet says
  why there (the old `title` tooltip is gone). The tooltip on the design (`#bldtip`) adds the sentence.
- **Not done:** the school (no part differs by school yet), and the picture: Q238's thumbnails go at the top of this card.
- **Words:** the sentences are written for a newcomer (what it's for, one catch) and avoid "Assembly" (Flow's Q272).

Test `vehicle-11` (every listed part has a sentence and a sheet; engines show Isp). Sections 16, 17, 32 pass.

## v1.120 — park parts in the air while building (2026-10-11, vehicle session, QUEUE Q246; PLAYTEST #43)

- **Click in the air to park.** Holding a part (or a group: a part with what hangs from it), a click where no node or
  surface takes it parks it there (`parkHeld`), unless it would overlap the rocket. The design keeps them in
  **`design.park = [{n, p}]`**: `n` the group's node tree (as `root` is), `p` its bottom centre from the root part's bottom
  centre, so parked parts keep still with the pin (v1.118). `parkedInst()` lays them out; they are drawn solid with a
  faint blue glow and a *parked* label, hover and highlight as parts do, and are picked up (click), copied (Ctrl-click) or
  deleted (Del) through the same `pickUp` / `detachNode` as the rocket's parts. They are never attach targets in this
  slice: pick a parked group up and put it on the rocket.
- **Inserting a part** between two others, KSP's way: pick up the lower part (it brings what hangs below it), park it, place
  the new part, then put the parked group back under it. The first part placed stays the root.
- **Not the rocket:** `assemble`, `stageStats`, costs and launch only read `root`, so parked parts never fly. `launchWarnings`
  (`sim/vessel.js`) adds "N parked groups not attached to the rocket: they stay behind" to Rollout's checks; the status line
  under PARTS says the same while any are parked. Undo and Clear cover them; deleting the root drops them.
- **Saved designs** carry `park` as they carry the tree; a dispatch or procedure that flies a saved design ignores it.

Robot row 202 (pick up, park, Rollout warning, pick up from the air, put back: 8 parts again).

## v1.129 — the player's designs; a finer Shift+wheel (2026-10-11, vehicle session, QUEUE Q306, Q305; PLAYTEST #77, #76)

- **Caio's call (2026-10-11):** a design is saved by default whenever it's launched, and can be saved by hand under a name.
- **Data** (`sim/vessel.js`): `PROG.designs = {saved: [{name, stack, day}], launched: [{stack, day, n, name}]}`, per program,
  in its save. `designLaunched(stack, s)` is called once at liftoff (`missionTick`, right after the revert snapshot
  `REVERT0`, so a reverted flight doesn't count twice): one entry per distinct design (`designKey`: the v2 tree without
  node ids or parked parts), moved to the top with its count, at most `DESIGN_LAUNCHED` (24). `designSave(name, stack)`
  keeps a design under a name; the same name replaces it; no name → `designLabel` (a preset's name, else its top part ·
  parts · tonnes). Parked parts (v1.120) stay in a saved design and never in a launched one.
- **UI** (`builder.js` `library()`): under the presets, *Your designs* (a name box and Save, each design with load and ✕)
  and *Launched* (the last 8, day and ×count). Loading is one undo step. The toolbar's *save design…* scrolls there and
  focuses the name, since the palette is long until Q238 folds it.
- **Shift+wheel** (#76): the step was 6 % of the camera distance per wheel event whatever its size, so a touchpad's many
  small events ran away. Now it follows `deltaY` (one mouse notch ≈ 1.5 % of the distance, a touchpad proportionally).
- **A near miss, for the next session:** `sim/logbook.js` already has `designName` (the Debrief's "design: Orbiter"); a
  second global function of the same name silently replaces the first across the classic scripts. And a `//` comment
  inside one of `program.js`'s one-line statements comments out the rest of the line: section 16's launch-window check
  caught it (liftoff stopped charging). Use `/* */` inside those lines.
- **Not done:** loading a design from the Debrief or a flight's history entry; designs shared across careers (a question
  for Caio: per program now).

Test `vehicle-12`. `--smoke` all pass.

## v1.133 — why a landed rocket blew up (2026-10-12, vehicle session, QUEUE Q264; PLAYTEST #64)

- **The cause:** toppling, and the physics is right. A stack on its engine bell pivots on its stance's edge once the feet
  stop; the swing (angular momentum m·v·h about that edge) has to lift the centre of mass over it. The Hopper (5.8 m,
  centre of mass 2.7 m up, stance half-width 0.42 m in its narrowest direction) tips past **0.91 m/s** of sideways drift
  by that formula; the contact model agrees (sweep, SAS off, 1 m/s down: 0.3–0.7 m/s rock for 3–9 s and settle, 1.0 m/s
  topples 2.4 s after touchdown). A 5° lean at 7.8 m/s topples too (4.2 s); 5° at ≤ 6 m/s, or any straight drop, stands.
  Past 60° (`C_TOPPLE`) it is destroyed, seconds after it looked landed, and the message flashed for 3 s: Caio's report.
  Every preset tips between 0.54 (Passenger Orbiter) and 1.07 m/s (Sounding), as real tall rockets do. SAS with a pod's
  reaction wheel holds a 1.2 m/s drift upright in the browser; with SAS off it topples. **Not changed:** the contact
  model, and toppling stays fatal (a 5.8 m rocket falling over hits at ~13 m/s at the nose).
- **`tipSpeed(s, g)`** (`sim/flight.js`): that threshold from the live foot points and `s.I`; **`standSpeed(s, g)`**: the
  same with any legs down. `touchdown` records `s.touchDrift` and `s.touchTilt`; **`toppleWhy`** names the drift (if
  over 0.6 × the threshold) or the lean, and suggests legs when it has none and tips under 2 m/s.
- **A loss keeps its cause:** `lose(s, why, boom)` in `flight.js` (touchdown, the nose, toppling) and `s.lossWhy` at the
  other losses (sinking, collisions in `space.js`, the root burning up in `vessel.js`). `debOutcome`'s *Lost* line is
  the cause now (the Debrief's lead); `app/loop.js` keeps it on screen while the wreck is in view. **Q293** (losses
  explained) can read `s.lossWhy` / the outcome's `d`; a loss also logs `logEv('loss', …)`.
- **The builder** (`app/editor.js` `standHTML`, under Max-q): *Touchdown stands drifting up to X m/s sideways, as built*,
  on its bottom part or its legs. Neutral for a rocket (all of them tip near 1 m/s); amber for a design with legs that
  still tips under 1.5 m/s.
- **Not yet:** the quote is for the stack as built, not for what's left after the drops (the Orbiter's upper stage, a
  lander stage); on Selene the threshold is √(g) lower (×0.41). Test `vehicle-13`; TESTING 215.

## v1.136 — the Touchdown quote for what lands (2026-10-12, vehicle session, QUEUE Q325; from Q264, v1.133)

- **What lands:** `landStance(s, g, nev)` (`sim/flight.js`) quotes `standSpeed` for the stack after its drops: every
  staging event's decouples, or, for a design with legs, the events before the one that drops the legs' segment (a
  lander's descent stage stays on the surface when its ascent stage lifts off). Tanks full or dry, whichever tips sooner.
  It switches parts off, re-runs `geom`, and puts everything back. Presets on Tellus: the capsules stand far better than
  the stacks as built (Passenger 2.63 m/s against 0.76; Big Lunar 2.91 on its heat shield), the upper stages ~1 m/s;
  the Probe's final stage tips sooner than the whole stack (0.68 against 0.90).
- **Where it lands:** a design with a landing procedure (`procLandsOn`) is quoted on that body, with that procedure's
  staging: the procedure now records **`ev`**, the staging events fired by touchdown, in its land phase
  (`sim/procedures.js`: the land event keeps `s.evIdx`). Older procedures lack it and fall back to the rule above. With no
  landing procedure it is Tellus, plus Selene for a design with legs. Selene's weaker pull stands the same stack at
  √(1.62/9.81) = **×0.41** the drift: the Hopper 0.37 m/s, a two-stage legged lander 1.1.
- **The builder** (`app/editor.js` `standHTML`): *Touchdown stands drifting up to X m/s sideways on Tellus[, Y on
  Selene]: what's left after its drops (n of m parts), on its Biocapsule*, or *as built* when nothing drops, and *as its
  landing procedure flies it* when one set the body. Amber still only for legs under 1.5 m/s (now on either body).
  `procsOf` lives in `app/program-ui.js`, loaded after the editor, so it is guarded with `typeof`.
- **Not yet:** a legless lander (Lunar, Sample Return, Crewed Lunar) with no landing procedure is quoted for its last
  stage (the return capsule), not the stage that sets down on Selene: only a recorded procedure knows that. Q152 (a
  legged lander preset, parked) would make the presets' case right. Test `vehicle-14`; TESTING 218.

## v1.139 — the craft stays where it was put (2026-10-12, vehicle session, QUEUE Q327; PLAYTEST #78; finishes Q247, v1.118)

- **What sank:** with nothing built, any click put the first part on the base plate (`findSlot` returned the root slot
  wherever the cursor was), and a new root, a reroot or the first part after Clear set `st.gap` back to 0. Q247 only
  kept the height while parts below were removed.
- **Now** (`builder.js`): with nothing built, a held part floats with the cursor (the parking ghost) and **`placeRoot`**
  puts it down there, its bottom that high over the plate (`st.hang`, clamped 0–20 m, read by `pinTo`). **Picking up
  the root takes the whole rocket** (it used to refuse): the design is empty while it's held, parked parts wait (they are
  placed relative to the root), and a click hangs it where it floats; right-click drops it (Ctrl+Z brings it back). The
  camera keeps its target's height over the plate, unless a new start (Clear, a fresh page) reframes it. Another part
  made the root keeps the height (the design didn't move). The plate stays put while the design is empty.
- **Undo** carries the height: an undo step is `{u: 1, d: design, gap}` (old plain entries still restore). It is not in
  the design, because `procKey` is the stack's JSON and a height would split a design's procedures.
- **Unchanged:** a preset or a saved design starts on the plate; the rollout and the launch stand it on the pad
  (`resetShip`). Removing or adding parts below works as Q247 made it.
- **Checked** in the browser (`shot.mjs`, events on the canvas): the Hopper picked up by its pod and put down 4.85 m up,
  the camera still; a first tank after a new start hanging 7 m over the plate. No headless test: the builder's pin needs
  the view (as Q247's). TESTING 221. **For look:** a hanging model has nothing under it on the desk; a display rod from
  the base plate to its bottom (`deskMesh`, from `BLD.foot()` to `S.yBot`) would explain it (QUEUE *Proposed*).

## v1.141 — staging by drag and drop (2026-10-12, vehicle session, QUEUE Q249; PLAYTEST #47)

- **What was there:** since the staging editor (v1.20) a stage could already hold several actions (drops, ignitions, the
  chute, each an *atom* of `stageAtoms`, `sim/vessel.js`; a design's own order is `stg`, lists of atom ids), but the
  only way to move one was the ◀ ▶ buttons on each chip, one stage at a time, and nothing said a stage fires them all.
- **Now** (`builder.js` `staging`): drag a chip onto a stage to fire it there, or into the gap between two stages (or
  past either end) for a stage of its own; drag a stage by its number onto another to **merge** them, or between two to
  move it. Gaps widen while dragging and the target lights. ⤵ still splits a chip off; **⇣** merges a stage with the
  next; ◀ ▶ are gone. A hint line under the header says it, and that a stage fires all of its actions in one press.
  The first edit freezes the order into `stg` as before; *automatic* forgets it; undo works per move.
- **`stgEdit(L, from, to)`** (exposed on `BLD`): the pure move on the list of stages; the panel calls it inside
  `edit()`. No change to the sim: `stageAtoms` already makes one event per stage from whatever it holds.
- **Not here:** deployments as stage actions (legs, solar wings, bay doors) come with Q329's action groups, which drop
  into stages through this panel. There is no fairing part yet. Test `vehicle-15` (the moves, and the Heavy with stage 2
  merged into 1 firing as one event); checked in the browser with real drag events (merge, a chip past the end, undo).
  TESTING 223 (renumbered from v1.140/222: flow's Q43 took them).

## v1.145 — deploy in the Assembly: legs, solar wings and bay doors roll out as left (2026-10-12, vehicle session, QUEUE Q328; PLAYTEST #79)

- **What was there:** deployment was already one flag on a flying part (`p.dep` for legs and solar wings, `p.open` for a
  cargo bay's doors), set only in flight (Y, P, B; tape ops `G`, `W`, `B`). The Assembly always showed and rolled out
  everything stowed, so the deployed shape could not be seen or checked before flight.
- **Now:** a design node carries **`dep`** (every symmetric copy shares the node). `assemble` (`sim/vessel.js`) turns
  it into `p.dep` (legs, wings) or `p.open` (a bay: `doorT` unset, so `doorF` is 1 at once and the payload isn't
  shielded). The Assembly redraws from that, and the craft rolls out and lifts off as it was left, as in KSP.
- **The builder** (`builder.js`): a *deploy* group in the toolbar, **extend all / retract all**, shown when the design
  has a deployable part; and a *deployed* row in a part's options (right-click): legs down/up, wings out/in, doors
  open/shut. Both go through `edit()`, so Ctrl+Z undoes them.
- **The Rollout warns** (`launchWarnings`): a solar wing deployed (thick air tears it off past its `qMax`, 1.0 kPa,
  `powerStep`), legs down, a bay open (the payload meets the air and its heat). Warnings, not blocks.
- **Procedures:** `procKey` (`sim/procedures.js`, space lane, one line) leaves `dep` out of the key, so setting a
  design's parts out or away keeps its recorded procedures. They adapt as they always did (an op on a part already
  deployed does nothing).
- **Not here:** a rover's fold (its unfolding is a timed deploy on the ground, `rvRun`, not a state to set before
  flight); deployments as stage actions or groups (Q329). Legs down on the pad stand in the pad's plate; nothing
  pushes on them before liftoff. Test `vehicle-16` (stowed by default; set out, all six copies and the bay roll out
  so, three warnings, the same `procKey`; flown up deployed, the wings tear off at 1.0 kPa and the rocket flies on).
  Checked in the browser: the toolbar and the part row, the drawing in the Assembly and on the pad, undo, the Rollout's
  checks. TESTING 227 (renumbered from v1.144/226: world's Q270 took them).

## v1.146 — the payload fairing (2026-10-12, vehicle session, QUEUE Q337 part 1; PROBES § 3.5, D20)

- **What was there:** nothing shielded a payload on the way up except the cargo bay (an orbital part) and the
  interstage's skirt around one engine. Every satellite part met the air, and the parts planned in PROBES S1 (a folded
  boom antenna, a folded dish) would have nowhere to ride.
- **The parts** (`sim/vessel.js` `PARTS`): **`fair`** (for a 1.25 m stack) and **`fair25`** (2.5 m, from `big()`): a
  base ring whose shell bulges wider than the stack (r 0.8 m over a 0.625 m foot, `rb`; ×2 for the big one), so parts
  as wide as the stack fit. Its length is a step on the design node, **`nd.fl`** (2–6 m, 3 by default; 4–12 m, 6), and
  the shell weighs `fm` a metre (0.035 t, 0.11 t), carried as `p.xm`; `partC` puts that mass at the shell's middle.
- **What it encloses** (`assemble`): every part above the ring that is wholly under the outline (`fairProf`: straight
  for 60% of the length, then an ogive to a point; `fairFits` checks a part's bottom and top against the radius there,
  less the wall; a deployed leg or wing never fits) gets **`p.inFair`**. `shielded()` (`sim/space.js`) counts it as
  inside while the shell is on, so it has no outline, no drag and no heating (the cargo bay's rule), and `profOf` gives
  the fairing the shell's outline instead.
- **Staging:** an atom of its own, **`f:<node id>`** (label *fairing*), placed one press after the first stage
  separation (out of the thick air by then), or last before the chute if the rocket has one stage. It drags and drops
  in the staging panel like any action (Q249). `stage()` calls **`fairJettison`**: the shell's mass goes, the outline
  is rebuilt, and **two halves** leave as debris, pushed apart.
- **Kept across splits and flights:** `vesselFrom` maps `inFair` and the fairing event's part indices onto the new
  vessel; `vstOf` saves which fairings are gone (`fj`), and `vesselOf` restores it (space lane, additive lines).
- **The builder:** under *Structure*; a part's options have a **length** row (one button per step) and say how many
  parts it encloses. The shell is drawn **cut away** on one side at the design table so the payload shows, whole on the
  pad (`render.js` rebuilds the ship's mesh when that changes) and in flight; the halves are drawn as half shells.
- **The Rollout warns** (`launchWarnings`) when parts stand above the ring but stick out of the outline: a longer
  shell, or the 2.5 m fairing. Price 2 M and 6 M (`PRICE`, economy's table, one line).
- **Not here yet (rest of Q337):** the boom antenna, the folding boom, side forms of the small boxes, the whip, the
  trim readout. Look & sound may restyle the shell (seams, era finishes). Test `vehicle-17` (what's inside and
  shielded, the event after separation, the mass and two halves at the drop, a short shell's warning, the 2.5 m
  fairing's default length); checked in the browser (the cutaway, the length row, the staging chip, the whole shell on
  the pad, a jettison in flight). TESTING 228.

## v1.147 — side antennas, side boxes, trim (2026-10-12, vehicle session, QUEUE Q337 part 2; PROBES § 3.1, 3.2, 4)

- **Antennas on the side** (`sim/vessel.js` `PARTS`, kind `ant`, so contracts, the registry and `KIT` count them as
  before): the **whip** (`whip`, survives the air, whip gain) and the **boom antenna** (`bant`, `fold`: it rides folded,
  **P** unfolds it with the solar wings, `gain` 5 once out, torn off above `qMax` 1.5 kPa while out, by `powerStep` like
  a wing; it opens with *The beeper*, as the wing does). The inline cone `ant` is now *Cone antenna (early whip)*;
  presets and old saves keep it.
- **Gain** (`antOf`, `sim/space.js`, space lane): the best antenna aboard sets G (a boom antenna's gain only once
  unfolded; a registry entry's shape counts it out); P still adds per antenna. **`unfolds(d)`** (`sim/power.js`) = a
  wing or a `fold` part: `wingOp`, `wingsOut`, the P key, the Assembly's *deploy* (Q328) and the Rollout warning use it.
- **Side boxes** (PROBES § 3.1): `scam`, `ssci`, `sbatt`, `scomp`, the camera, instrument package, battery and computer
  as boxes on the skin, the same numbers and kinds. **`kin`** names the inline part whose know-how, certification and
  production line they share (`kinOf` in `sim/program.js`, economy's file: `certOf`, `khUse`, `khMark`, `prodLine`), so
  a side camera isn't "new to us" when the camera has flown.
- **Trim** (PROBES § 4): **`trimOf(s)`** (`sim/vessel.js`) walks the stages as they light (full tanks, what is still
  attached): the thrust's moment about the centre of mass, over the steering it has (each lit engine's sideways push at
  full gimbal about the CoM, plus the reaction wheels); the worst stage, with the miss in metres. The Assembly's
  *Aerodynamics & structure* block has a **Trim** line (green under 20%, amber under 60%, red beyond); the Rollout warns
  past 60%. A **dashed thrust line** from stage 1's thrust centre is drawn when it misses the CoM by 1 cm or more, and
  the **CoM marker** now sits at the real centre of mass, off the axis when it is (`app/render.js`).
- **The folding boom moved out** to **Q341**: a part whose tip mount (and whatever rides it) changes place when it
  deploys needs parts that move in flight (layout, joints, mass, inertia, drawing), more than a part. Everything else
  in Q337 is done.
- Placeholder looks (look & sound to restyle): the whip a rod on a foot, the boom antenna a canister that swings out a
  thin boom with an element, the boxes on struts with a lens, louvers or a grille. Tests `vehicle-18` (folded fits a
  fairing at whip gain, unfolds to ×5 and says so, warns and doesn't fit when out at launch, tears off out in air, a
  registry shape's gain, the side camera counts and moves the CoM, shares the camera's know-how) and `vehicle-19`
  (symmetric 0%, a side camera 1.5%, a side tank 52%, one side booster 96% and the warning). TESTING 229.

## v1.148 — builder notes: side boxes fit the fairing, a smaller camera, the octagonal frame (2026-10-12, vehicle session, Caio's testing)

- **Side boxes fit a payload fairing** (`scam`, `ssci`, `sbatt`, `scomp`): they stood out 0.2–0.3 m from the skin, past the
  fairing's 0.175 m bulge over a 1.25 m stack, so a side camera stuck out of the shell. Now `off + r` is 0.10–0.14 m and a new
  **`w`** gives their half-width round the skin; the mesh keeps within `off + r`. The **side camera's lens looks outward** (it
  looked up the axis, copied from the stack camera). Nothing in the sim depends on where a camera looks yet; pointing (Q338)
  will take the outward axis.
- **The stack camera** (`cam`) is 0.3 m tall, was 0.5 m: a short drum with the lens out the side. Same mass.
- **Octagonal frame** (`oct` 0.5 m, `octl` 1 m; kind `frame`, in *Structure*): a narrow bus 0.8 m across (r 0.4) to build a
  satellite round. Side parts sit on its faces; what stacks on it rests on a joint of its radius (weaker than a 1.25 m one).
  Placeholder look: eight foil faces between dark rings (`lathe` with 8 segments).
- **The Nyx orbit flight** (`fly_ladder.mjs`, test `bodies-1`): the shorter camera tipped the Probe's retrograde 80 × 30 km Nyx
  orbit under the ~103 h the mission needs. Measured, that orbit decays onto Nyx at ~98 h **whichever way round it goes**
  (76 km: both 4.14 days; 73 km: both last), so it passed on `main` by a whisker. `nyxorb` now captures at 70 × 30 km; the
  prograde control still flies 80 × 30 km. Whether Tellus's tide should tell the two apart is **Q344** (space).
- Test `vehicle-20` (all four side boxes on a 1.25 m stack and on the frame inside a fairing; the frame's radius; the camera's
  height). TESTING 230.

## v1.152 — later stages in the air: why the fairing satellite tumbles, and the builder saying so (2026-10-12, vehicle session, QUEUE Q342; PLAYTEST #82)

- **What breaks:** nothing, at first. Measured (a satellite, core + battery + instruments + camera under a 3 m fairing, on the
  Orbiter's launcher): the fairing's own joints carry 9% of their certified rating at 5° and max-q, 27% at 15°; flown, no joint
  fails even tumbling. What happens is the **upper stage going end over end** right after separation: the small first stage
  drops it at ~34 km and ~12.6 kPa, and the fairing up front puts its centre of pressure 1.5 calibers ahead of its centre of
  mass (any pointed nose does this; a flat top, as the satellites had before, has no nose lift in the aero model, which is why
  they flew so stable). Within 0.5 s it is 60° off its path. That is what Caio saw as "the craft tilts and the fairing snaps".
- **Why steering doesn't save it**, flown: the stage is light (pitch inertia 2,800 kg·m² against 128,000 for the stack it came
  off), so it diverges with a time constant of ~0.2 s at 10+ kPa, faster than SAS reacts; and holding the pitch program's
  attitude it separates 6–11° off its path, where the shell's load beats one Petrel's 3° gimbal. A reaction wheel doesn't help
  (its torque goes unused at that speed); three don't either. Clearing the SAS integral at staging doesn't help. The stock
  **Beeper and Passenger Orbiter flip the same way** when flown through staging in attitude hold on the standard profile;
  holding **prograde** from 20 km they don't (Q353).
- **`airSep(stack)`** (`sim/flight.js`, in `analyze` as `ana.air`): where each fresh stage lights on a standard ascent (a point
  mass on the procedures' pitch profile, with `dvPlan`'s steps, thrust from each step's vacuum and sea-level exhaust speeds by
  pressure, and the ship's drag table: 34 km / 12.7 kPa against 33.9 / 12.6 flown), then that stage as it flies (dropped
  parts gone, a fairing jettisoned before it gone) probed holding 5° at that q, burning. It **flips** if the steering is short
  by more than 10%, or its divergence rate `√(dM/dα / I)` passes `LAM_MAX` 5.5/s; both thresholds from flying sixteen designs
  (every case right: flips at ≥ 5.8/s or short; holds with steerable fins, a passive fin ring, a bigger first stage, each
  separated prograde). A booster drop off a lit core isn't a fresh stage (Heavy, Asparagus). `dvPlan` steps now carry `ev`
  (events fired when the step starts); `probe` takes `segs` (the burning segments).
- **Builder:** the Control block has a **Stage N in the air** line: holds / flips, where it lights, why (the steering it needs
  against what it has, or how fast it would go over), the centre of pressure ahead (and "the fairing up front"), and what
  helps: fins or steerable fins on it, a bigger first stage (or coast up before staging), separating pointing prograde. An
  unstable stage that holds gets the prograde advice. **Rollout:** the same as a warning. Every preset holds.
- Test `vehicle-21` (the satellite flips, short of steering; with a wheel, too fast; steerable fins hold; no preset flagged;
  Heavy's checked stage is its upper one; flown, the satellite tumbles 179° and with steerable fins stays within 2°). TESTING 234.

## v1.157 — the rocket stands on the pad outside the Assembly (2026-10-13, vehicle session, QUEUE Q346; PLAYTEST #83)

- **The bug:** the builder places the ship `LIFT` (3 m) plus `gap` above the pad, VAB-style, so parts can go under it; that
  placement (`changed()` in `builder.js`) ran whatever the screen, so the Rollout and the Program's backdrop showed the rocket
  hanging 3 m up, and Launch (a fresh ship, landed) dropped it to the pad. Measured on the Orbiter preset: Rollout 3.00 m
  before, 0.00 after. Not Q327's doing (a preset with no gap hung the same 3 m); Q327 only made a mid-air part's extra height
  show too.
- **The fix:** the hang only on the Assembly (`screenNow()==='assembly'`); everywhere else it stands on the pad. Entering the
  Rollout rebuilds the ship (`editorChanged`, `app/screens.js`), and so does entering the Program with a design (was: only
  after a flight). Assembly → Rollout → Assembly → Program → Assembly: 3.00, 0.00, 3.00, 0.00, 3.00 m.
- UI only, so no `test.mjs` section (the flow and platform sections pass). TESTING 239.

## v1.160 — a fast rocket's own max-q (2026-10-13, vehicle session, QUEUE Q347; PLAYTEST #84)

- **What broke:** flown (a satellite launcher, four boosters hung off the core's Kestrel as the Heavy preset hangs two,
  boosters without fins), the joint that snaps is the **decoupler under the upper stage's Petrel** ("the first engine" from
  the top), in bending at 35 s: four boosters push it through thick air so fast that q peaks near **76 kPa**. The Assembly's
  max-q case was a fixed 25 kPa, so it showed that joint at a comfortable ~30%. With fins on the boosters the flight was
  gentler and held (30–55%); boosters on the core's tank instead of its engine held too.
- **`ascentEst(stack)`** (`sim/flight.js`): `airSep`'s point-mass ascent, pulled out, cached on the design, now flying every
  step and keeping the peak: `{qMax, hQ, MQ, starts}`. The Orbiter's estimate is 34 kPa against 33.2 flown.
- **The max-q case** (`analyze`, `ana.mq`): at the design's own peak when that is past 25 kPa (`mq.q`, `mq.M`, `mq.own`),
  else the old 25 kPa / M1.2. The four-booster rocket: 74 kPa, 91% at the decoupler; with an interstage decoupler 44%.
  Presets all stay under 65%.
- **Saying why** (`jointFix`, `sim/vessel.js`): under the Max-q line from 70% up, and in the Rollout's joint warning, which now
  names the joint: an interstage decoupler instead (when a plain decoupler is in the joint), reinforce the joint (the part's
  *joint* option), or less thrust low down (when it's the design's own peak).
- Test `vehicle-22`. TESTING 242.

## v1.164 — bigger fins, and the in-air check recalibrated (2026-10-13, vehicle session, QUEUE Q348; PLAYTEST #85)

- **Fin sizes:** a radial or steerable fin's options have a **size** row: 0.9 m (as before), 1.35 m, 2 m span (`FIN_SZ`; the
  node's `fz`). `finDef(d, fz)` (`sim/vessel.js`) gives a sized fin its own cached definition, same key: span, chord and height
  × k; mass, compression, tension, shear and price × k² (`pk`, read by `partPrice`); root bending × k³ (its own air load × its
  lever). `assemble` uses it for surface parts, so aero, steering, loads, heating and the mesh all see the bigger plate.
- **What bigger fins do, flown** (the fairing satellite of Q342): four 2 m radial fins at the foot of its upper stage make that
  stage about neutral (−0.48 → 0.01 calibers), so it holds after separating. But fins that big up top also move the **whole
  rocket's** centre of pressure forward (−1.18 → −1.95), and with only the fin ring below it goes over at max-q and snaps the
  decoupler joint, even with a steerable fin ring (whose static check said it holds). With 2 m fins low on the first stage as
  well, it flies clean (1° at worst). 1.35 m fins up top with a steerable ring below also fly.
- **The in-air check, recalibrated** (`airSep`): the divergence threshold is now on rate × the slowest lit gimbal's full swing
  (`gim / gimR`: a Kestrel 0.5 s, a Petrel 0.3 s), past `LAG_MAX` 1.7, which fits every flight (stage 1 and later stages
  alike); the steering threshold is `AUTH_MAX` 1.5 × what it has (flown prograde, a separated stage sits near 1°, not 5°: up to
  1.23 flew, 1.98 flipped). **Stage 1 is checked too**, at its own max-q, for going over too fast only ("Stage 1 at max-q
  flips", with "fins ahead of the centre of mass push it over: bigger fins low on the first stage, or smaller ones up top").
- **Found:** the **Hopper preset** flips at max-q in flight (straight up: from 3° to 111° in a second at 16 s and 111 kPa, as
  its tank drains), and the builder now says so. Left as it is: Q371.
- Test `vehicle-23`. TESTING 246.

## v1.173 — the SAS cancels the air's torque; flips at staging mostly gone (2026-10-13, vehicle session, QUEUE Q382)

- **Caio:** "the other designs are also flipping, i wonder if there was some change that made everything less stable". **No
  change did:** the presets' stability and their stage-1 flights are identical on `main` as of 2026-10-10 and today (same
  calibers, same angles of attack to the tenth of a degree).
- **What flips:** separating in thick air. Flown through staging in attitude hold on the pitch program, with any autopilot,
  the Beeper and Passenger Orbiter went end over end at separation (~96 s, 8–11 kPa), as Caio's satellites did. A stiffer
  rate loop doesn't fix it (gain ×3, lag ×0.3: same); re-aiming the hold along the path at separation doesn't either.
- **Why** (traced, the Beeper): the moment it separates the air hits the light upper stage with ~13 kN·m. The SAS is a rate
  loop: it asks for torque only as the craft starts to turn, ~0.4 kN·m at first, ramping up; by the time its 15 kN·m wheel is
  at full torque the stage is 28° off and the air pushes 35. Not a shortage of torque: a controller that doesn't see the air.
- **The fix** (`ctrlAccel`, `physStep`, `sim/vessel.js`): each step keeps the part of its **aero moment about the centre of
  mass that turns the nose away from the airflow** (`s.tauA`: an unstable airframe's push; less what the steerable fins give by
  deflecting), while engines burn and within 60° of nose-first, faded in from 0.5° to 2.5° of angle of attack; the SAS **feeds
  it forward**, cancelling it within its authority, which is what the builder's control check always assumed. The restoring
  part and the damping are left to the air (cancelling the whole moment broke stable darts, falling stages and asymmetric
  rockets in four tests). Tried and dropped: only for a few seconds after a separation (the integral can't take over a torque
  already cancelled, so it flipped when the window closed); only for fast divergences. Flown: the Beeper holds through separation on every autopilot (gyro 14°, guidance computer 15°);
  the fairing satellite with a reaction wheel holds (11°, was 180° with three wheels); big fins up top no longer tip the
  first stage over at max-q; held prograde at separation, everything I flew holds, even the bare fairing satellite. The
  canted-engine test's asymmetric rocket now leans into its sideways drift (11.5° in 50 s, was 3.2°): still climbing; the
  test's limit is 15° now.
  What still flips is a stage that really lacks the steering for the angle it separates at: the Passenger Orbiter in
  attitude hold, ~10° off its path, needs ~23 kN·m and has 20 (prograde, it holds).
- **The Hopper is back as it was** (Tank 2 t): with the feed-forward it climbs straight (124 kPa, 0°) and the Q371 retune
  isn't needed. Caio had approved it; reverted before it shipped.
- **The builder's in-air check** (`airSep`) keeps one rule: steering short of 1.5× what holding 5° takes. The divergence-rate
  rule and the stage-1 max-q line (v1.164) are gone: that failure mode was the controller's, and it's fixed. The advice leads
  with separating pointing prograde; a reaction wheel helps again.
- Tests: `vehicle-24` (the Beeper through separation, gyro and guidance computer); `vehicle-21` (a wheel now holds; its flight
  stays in attitude hold), `vehicle-23` (2 m fins up top fly in attitude hold), `vehicle-4` back to the Hopper short only;
  core: the impact prediction is taken once descending and lined up (the Hopper now climbs straight to ~40 km), canted engines
  ≤ 15°, procedures v2 also passes when the crew is lost only to the tree cell it lands on (a few metres moved it there;
  the hazard is Q383). TESTING 255.

## v1.178 — a working satellite preset; the builder counts the wheels' storage in the air (2026-10-13, vehicle session, QUEUE Q390)

- **Caio:** "i'm having trouble making a satellite that doesn't tip over during ascent and is also viable--ie includes
  batteries, a reaction wheel, solar panel etc. let's make a model and make sure it can successfully get into orbit".
- **Reproduced:** core, battery, wheel and an octagonal bus (two wings, a whip, a side camera) in a fairing on the Orbiter's
  launcher. The builder said stage 2 "holds"; flown in attitude hold on the pitch program it went over at ~43 km, 15 s after
  separating, on every autopilot. Traced: not torque (the air pushed ~10 kN·m against 21.6 in hand) but **storage**: the wheels
  carry the steady load and the gimbal only unloads them, up to half its authority (`physStep`'s dump), so holding ~10° off for
  15 s filled wheel + core (170 kN·m·s) and the gimbal alone lost it in a second. Letting the gimbal unload at 95 % saved the gyro
  flight only; the other autopilots went over later (the steady torque is about the gimbal's own): not shipped.
- **Measured** (scratch `satfly.mjs`; av1 unless noted; fairing off above 40 km under 300 Pa; spare = Δv left in a 100-km orbit):
  - the bus, 2 t upper stage: prograde from 10 km 771 m/s; 5°, 8° or 10° below prograde all hold (720–765); the pitch program
    in attitude hold goes over (~10.5° off).
  - fins on its upper stage (4 × 0.9 / 1.35 / 2 m): steady, but their mass and drag leave it short of orbit, or it still flips
    (0.9 m). A steerable fin ring: holds everywhere, 3–146 m/s spare. Not a fix for a light upper stage.
  - a 4 t upper stage: 1,451 prograde, but it lights at ~25 km, 19 kPa and goes over 5° below prograde (wheel full ~70 s in).
    With a steerable ring it holds, 87–760. A bigger first stage under it: a slow, sagging climb.
  - a second wheel: holds every way flown, ~330 spare (a 400 km orbit takes ~310 more).
  - the gyro autopilot has no prograde mode (its "prograde" runs were holds).
- **The Satellite preset** (`PRESETS.Satellite`): core, battery, reaction wheel, a long octagonal frame carrying two solar wings,
  a whip, a side camera and a side instrument package (the satellite, reconnaissance and imaging contracts), in a fairing on the
  Orbiter's launcher; 595 kg of payload with its fairing. No builder warnings; 15 W of load against ~340 W from the wings, its
  1.5 kWh against ~4 Wh per shadow. Flown: prograde 565 m/s spare, 5° below 518, 10° below 550, the pitch program in
  attitude hold 521 (14° at worst); the guidance computer 566 prograde, 518 5° below; the gyro autopilot held the pitch program (485) and tumbled
  once 5° below prograde but recovered to orbit (439).
- **The builder's in-air check** (`airSep`, `airStore` in `sim/flight.js`): besides steering short of 1.5× what holding 5°
  takes, a stage now **flips (why 'store') if holding 5° off fills its wheels before the air thins**: the torque past half the
  gimbal's authority (and the fins', which fall with q) integrated over the stage's q after it lights, each second along the
  standard ascent (`ascentRun` keeps `qs` per start, until under 300 Pa), against `s.hmax`. It flags only the two 4 t versions
  among every preset and candidate. `lim` = the most it holds off its path; the line under "holds" says "held more than ~N° off
  its path it may go over (its reaction wheels fill)". Conservative: flown, the stage sits 2–4° off the airflow 5° below
  prograde, so the wheels fill later than the estimate's 5°, and the preset (lim ~7°) held 14° off on the pitch program. The
  warning doesn't quote seconds for that reason; its fix leads with "separate pointing prograde and keep it there", then
  another wheel, steerable or bigger fins, a bigger first stage.
- **Power:** the side camera, the whip and the boom antenna drew nothing (their records never got the inline parts' 10 W / 5 W):
  every antenna and camera draws now (`sim/power.js`). A satellite built from side parts used to show a 0 W load.
- Test `vehicle-25`. TESTING 260.

## v1.184 — a flight button for the unfolding parts (2026-10-13, vehicle session, QUEUE Q409)

- **Caio:** "are there now controls that can extend the parts that start retracted?" (only the P key) then "yeah, let's add a
  button with P in parentheses".
- `#bWings` in the flight bar, next to Map: shown while the craft has solar wings or boom antennas, reading "Unfold wings (P)" /
  "Fold wings (P)" ("antennas", "wings and antennas" as fitted), lit while they're out; a click does what P does (recorded on the
  tape). Updated in `updateHUD` (`app/program-ui.js`). Checked in the browser on the Satellite preset.
- Seen doing it: on the pad the wings unfold straight through the closed fairing; nothing stops deploying inside one (QUEUE
  Q410; first numbered Q398, which collided with a playtest item).
- TESTING 266.

## v1.185 — nothing unfolds inside a closed fairing (2026-10-13, vehicle session, QUEUE Q410)

- **Caio:** "sure, go ahead" (on Q410: the Satellite preset's wings unfolded through its fairing on the pad).
- `wingOp` (`sim/power.js`) leaves folded any wing or boom antenna whose fairing (`inFair`, set at assembly) is still on with its
  shell (`profF`, not `fj`); the message says "Inside the fairing: jettison it first (stage), then unfold", or "(N still inside
  the fairing)" when others did unfold. The Assembly's own deploy toggle is untouched (a part left deployed there already
  doesn't count as inside, and warns).
- Tests: `vehicle-26`; `vehicle-18` jettisons the shell before unfolding its boom antenna. TESTING 267.

## v1.188 — flight buttons for legs and the cargo bay (2026-10-13, vehicle session, QUEUE Q400's vehicle part)

- **Caio:** "ok good, let's keep going". Q400 (PLAYTEST #97, P1: "no visible way to deploy folded parts") asked for an on-screen
  control for everything that deploys. With v1.184's wings button (Q409): `#bLegs` "Legs down (Y)" / "Legs up (Y)" and `#bBay`
  "Open bay (B)" / "Close bay (B)" in the flight bar, shown only when the craft has legs or a bay, lit while deployed; a click
  does what the key does (recorded on the tape). `updateHUD`, `app/program-ui.js`. Checked in the browser on a probe with a bay
  and four legs.
- Left for flow (Q400): the Part tab saying how a part deploys, and a first-time hint in space.
- TESTING 270.

## v1.198 — the payload bench, slice 1 (2026-10-13, vehicle session, QUEUE Q416, D24, PROBES § 6.1)

- **Caio:** "there is a big satellite redesign i just did, let's look at that next", then on the plan: "the 'no prefab satellites'
  rule is about a whole satellite as a unit that is not customizable, presets are fine. ok on defaults, go ahead and begin".
- **Built as a mode of the existing builder**, not a separate screen (the queue had it blocked on the desk drawing the bench;
  the desk can dress it later without the logic moving). Same part tree, same physics and checks.
- **The block** (`sim/vessel.js`): a rocket design node `{k:'pay', pid, name, pd}` carrying its own copy of the payload's design
  (pd), so a saved rocket, its procedure and a registered satellite stay whole if the bench copy changes or goes. `payExpand` (in
  `layoutDesign`) turns it into a **payload adapter** (`padapt`, 30 kg, never in the parts list) with the payload standing on it,
  re-hung from the bottom of its root's stack line (`payStandOn`); the adapter and the payload's parts are copies with `payOf` →
  the block (non-enumerable, never saved), every other node is laid out as itself (copies mapped back through `src`). So the
  aero, power, deploying, fairing fit and registration see ordinary parts. Payload designs: `PROG.payloads` [{id, name, d, m}]
  (`payDesigns`, `payNew`, `payById`, `payNode`); `paySync` brings a rocket's blocks up to their bench copy whenever the Assembly
  rebuilds (renamed or rebuilt there).
- **The builder** (`builder.js`): every node comparison goes through `dnOf(p)` (a payload part answers to its block): hover,
  select, pick up, copy, delete take the block whole; nothing attaches to a payload's parts; a held block goes on a stack node
  only. The palette lists **Payloads** (pick one up; ✎ opens it on the bench; **+ New payload**). A selected block says its mass,
  parts and whether it's inside a fairing, with **open on the bench**. A fairing with something on top offers **make the parts
  inside a payload** (`makePay`: re-hangs the design from the fairing and lifts its top child into a new payload): that's how a
  rocket built the old way becomes one with a block.
- **The bench** (`benchOpen` / `benchClose`): the rocket and its undo are put aside, the payload is edited at satellite scale
  (closer camera), its name editable, **✓ done** (back to the rocket, blocks follow) or **✓ done, and pick it up** (holding a
  block to place). Starters instead of presets (`PAY_STARTERS`: the first beacon, the Satellite preset's payload). "Build and
  launch" reads "On the payload bench" and is off; leaving the Assembly from the bench saves and brings the rocket back.
- **The bench's Checks** (`payChecks`, `benchHTML` in `app/editor.js`): power in shadow (a battery-only craft warns with its
  days), can talk home, can turn itself, balanced (centre of mass under 5 cm off the axis; off it warns, fails if it has an
  engine of its own), fits the fairing of the rocket it was opened from (or "checked on the rocket"). Pointing and temperatures
  wait for S2 (Q338).
- **The Satellite preset** now has its instrument package opposite the camera: the bench showed it 14 cm off balance (2 cm now).
  Flown: prograde 567 m/s spare, 5° below 518, 10° below 551; on the pitch program in attitude hold (~14° off, twice its ~7°
  limit) it now tumbles once and makes orbit with 189 (the lopsided one happened to hold there). `vehicle-25` checks 10° below.
- Checked in the browser: the Satellite preset's fairing contents made a payload (560 kg), the bench's Checks all green, Done,
  launched: 17 parts, 10 inside the fairing, the wings button there.
- Not yet (slice 2, Q417): the adjustable bus frame, 0.3/0.6 m stacks, a kick motor; the office's way in (flow); the desk's
  dressing of the bench.
- Test `vehicle-27`. TESTING 279.

## v1.207 — propulsion on the bench (2026-10-13, vehicle session, QUEUE Q422, PROBES § 6.3)

- **Caio:** "there are new satellite items in the queue, we can get started on that". Q422 first (after Q416's slice 1).
- **Parts** (`sim/vessel.js`, prices in `sim/program.js`): kick motors, solid, small / medium / large (31 / 80 / 200 kg, 6 / 12
  / 25 kN, 285 s vacuum; `kick30`, `kick80`, `kick200`); hydrazine thrusters, 4 × 22 N, 220 s (`hthr`); a bipropellant apogee
  engine, 440 N, 312 s (`apogee`); propellant spheres 0.4 and 0.7 m (35 and 170 kg full; `sph4`, `sph7`). Fuel and oxidiser
  aren't told apart: the liquid engines draw from the spheres like any engine from its tanks. Plain shapes from their profiles;
  their look is parts & pad's (Q396's line).
- **Solids** (Q252's rule): a kick motor carries its own propellant (res fuel on the motor) and `flowGroups` cuts every joint
  round it, so nothing else feeds it or is fed by it. Lit by its stage it waits, **armed**, until the throttle first goes up;
  then `physStep` holds the throttle at 1 until it burns out ("… lit: it burns to the end", "… burnt out", throttle back to
  0). Released at full throttle it fires at once: once lit, no stopping. While it burns, liquid engines lit in the same stage
  burn too (the hydrazine lost 0.8 kg in the test).
- **The payload adapter is the separation ring now** (kind `dec`): staging it releases the payload and drops the stage under
  it, and the cut stops the upper stage's engine drinking the satellite's propellant. A block's payload is its own last stage.
- **The bench's Checks** add the payload's own Δv against a stationary orbit from a transfer orbit (641 m/s at the top, 5,668 km
  up on Tellus). The rocket's stages include the payload's (the Assembly's Reaches counts them together, as Q422 asked).
- Measured (test `vehicle-28`): the Satellite starter with a large kick motor and a 4 × 22 N thruster on a 0.4 m sphere, in a
  fairing on a Tank 2 t + Petrel, put in a 110 km orbit: released (the Petrel gone), armed through 1 s of coasting, a touch on
  the throttle → 714 m/s along its path in ~20 s with the throttle cut; then 10 s of hydrazine (0.4 kg).
- **The balance weight** (Caio's round-2 note on the bench): `bwt`, a side mass whose kilograms its node carries (`wk`, sized at
  layout by `wtDef` as fins are by `finDef`); the bench's balance check, when off, has **add a balance weight** (`addBalance`):
  opposite the offset on the widest part of the main stack (the longest lever), mass × offset ÷ lever. On the Satellite made
  lopsided (14 cm): 111 kg brings it to 1 cm. Heavy on a narrow bus: moving parts is cheaper, and the check says so. It goes on
  the payload itself rather than the adapter, which only exists on the rocket (test `vehicle-29`).
- **Drawn at their real size** (`app/gl.js` `partBody`): the fallback drew any new part as a 1.25 m drum, so the adapter, the
  motors, the thrusters, the spheres and the weight now have plain shapes from their own profiles; parts & pad styles them.
- Not yet: ion; a stationary-orbit preset (Q412) built from these. TESTING 288.

## v1.215 — a preset that reaches the stationary orbit: the TV Satellite (2026-10-13, vehicle session, QUEUE Q412, PLAYTEST #102)

- **Caio:** "go ahead" (Q412 next: "no preset reaches the stationary orbit, so TV for the capital can't be flown"; M2's finish
  line).
- **The preset** (`PRESETS['TV Satellite']`, and its payload as a bench starter, `PAY_STARTERS['TV satellite']`): core, battery,
  wheel, a long frame with two solar wings and two whips, an apogee engine (Q422) on a 0.7 m propellant sphere: 545 kg, 1,024
  m/s of its own. A payload block with no bench link (`pid: null`: a player's payloads never overwrite it; "open on the bench"
  makes one) in a **4 m fairing** (the 3 m left three parts out) on the Heavy's launcher (a Tank 2 t + Petrel over a Tank 8 t +
  Kestrel with two boosters). No builder warnings; its upper stage holds to 30° off its path.
- **Compared:** the Satellite's own launcher has 6,240 m/s in all against ~6,150 needed (too tight); a 4 t upper stage (6,894)
  sagged back in the climb on the probe autopilot (TWR 0.33 lighting at 22 km; the builder flags its wheel filling too).
- **Flown** (test `vehicle-30`, the probe autopilot, prograde after 10 km): a 110 km orbit with ~2,290 m/s left; **a coast until
  a transfer burn now would arrive over the capital's longitude** (the far point is opposite, half a transfer later, while the
  planet turns ~84°): 26 min from Dunnzar Cape for Kamar (41.6°S, 48°E); a prograde burn raises the far point to 5,668 km (the
  upper stage runs dry part-way: staging releases the satellite and its engine finishes the burn); at the top the apogee engine
  circularises: period 0.9995 day, e 0.0005, 0.00°, over 47.9°E, the capital sees it, **TV for the capital counts** (the
  mission's own check), 378 m/s left to hold the slot. Without the wait it ends at 110°W, where Kamar can't see it.
- **Not in the game yet:** anything that tells the player when to start that burn; QUEUE Q454.
- TESTING 296.

## v1.226 — when to start the transfer burn (2026-10-13, vehicle session, QUEUE Q454)

- **Caio:** "q454 is fine" (from Q412: a stationary satellite ends over the longitude its transfer burn aims at, and nothing
  told the player when to burn).
- **`statXfer(s)`** (`sim/program.js`, by `capSees`): from a low (far point under 0.6 of the stationary radius), nearly circular
  (e < 0.05), nearly equatorial (under 10°) orbit of Tellus, samples the next two orbits for the place where a transfer begun
  there arrives (opposite, half a transfer later, the planet turned meanwhile) over the capital's longitude: `{dt, r, dv,
  city}`, dt to the burn's middle, dv the first burn, prograde. One orbit sweeps 360° less the planet's turn, so two always hold
  an answer.
- **The Stationary orbit card** (`statRows` in `app/program-ui.js`, registered in `HUD_CARDS`, `app/hud.js`; shown on the Map
  too): "prograde 991 m/s · in 26 min (the burn's middle)" (checked in the browser: card, button, node, the Map marks; a node on the burn's place hides that label), "over Kamar, 5,668 km up", and **plan it**, which places the node
  there with that Δv (or moves the node), so the node panel's burn timing and warp do the rest. Shown while the craft carries an
  antenna, or TV for the capital is open and not flown; recomputed once a second (`statX`).
- **The Map** (`drawMap`, `app/render.js`): the stationary ring, the capital's slot on it turning with the planet, and the burn's
  place on the current orbit ("transfer burn · in 26 min").
- **Measured** (scratch flights of the TV Satellite, then test `vehicle-30`, which now flies on `statXfer`'s timing): it says
  26.3 min from the Cape (the test's own search had found 26); a burn **started** there ends over 46.4°E, one **centred** there
  (as a node is) over 48.4°E, the capital 48.0°E. TV for the capital counts; 378 m/s left.
- **Flow:** the Map view showed only the Target card; it shows `stat` too (one condition in `renderCards`).
- TESTING 306.

## v1.228 — the Satellite reads stable; a stable stage in the air holds (2026-10-17, vehicle session, QUEUE Q439, PLAYTEST #114)

- **The report** (test bench, TESTING 260): the Satellite preset reads unstable in the Assembly (−0.28 calibers full, −0.56 at
  M1.6, Control *coasting flips*), though v1.178 "had no warnings". **Nothing changed since:** measured headless at every vehicle
  commit from v1.178 on, the same −0.28 / +0.48 / −0.56. v1.178's "no warnings" was `launchWarnings` (the Rollout's list); the
  calibers row was red from the start. The fairing (1.6 m, at the nose) sits the centre of pressure ahead of the centre of mass;
  the bare Orbiter launcher reads +0.88.
- **Fix: a second fin ring** (as the Passenger Orbiter got for its nose cone, v1.73.1). Candidates, full / M1.6 calibers and the
  first stage's Δv (was 2,498 m/s): a second ring **+1.01 / +0.74, 2,425**; 3 × 0.9 m radial fins +1.11 / +0.88, 2,382; 4 × 2 m
  +1.74 / +1.59, 2,193. Flown (test `vehicle-25`): prograde 479 m/s left in a 100 km orbit (was ~565), 10° below 461, the pitch
  program in attitude hold 418 (13° at worst).
- **The in-air check was wrong for stable stages** (TESTING 246's half of #114): four 2 m radial fins low on the fairing
  satellite's Tank 2 t (the robot's `y 0.05`) read "Stage 2 in the air flips" (12 kN·m needed, 5.3 there), where the same fins at
  `y 0.45` (v1.164's test) read "holds". Lower fins made stage 2 *more* stable (+0.16 against +0.01 calibers), and a stable
  stage needs torque to hold 5° off the airflow too: the air pushes its nose back along its path. `airSep` counted that
  shortfall as a flip. Flown in attitude hold on the pitch program (av2): `y 0.05` 4° off after separating, `y 0.45` 3°, `y 1.0`
  (−0.19) end over end. **Now** a stage stable there (`cal ≥ 0`) short of steering or with its wheels full gets `holds` and
  `vane` (it turns into the airflow), and the readout says "stable: it turns into the airflow" (`airHTML`); an unstable one
  flips as before. The Control block already said *weathervanes* for a stable rocket at max-q.
- **A leak in the tests:** `fixes-1` (`tests/core.mjs`) set `PROG.site` and reset a dozen `PROG` fields and left them so; every
  later section in its shard flew that program (costs 79M where 61M, every Satellite flight short of orbit). It was why
  `--smoke` failed *presets*, *fin sizes* and *node chain flown* (Q372's "not reproduced": they pass alone) on `main`. It now
  snapshots `PROG` (`structuredClone`) and puts it back. Found by bisecting `--smoke --only` ranges by `--list` position.
- Test `vehicle-31`; TESTING 308. `--smoke` fails only the three known (Help `t`, atlas is wired, go to body).

## v1.229 — the Satellite's routine runs: the margin for 300 km polar, and a quote that says what flying it leaves (2026-10-17, vehicle session, QUEUE Q413, PLAYTEST #103)

- **The report** (test bench, robot `m2`, v1.184): a routine from the weather satellite (297 km, 82°, hand-flown there dry)
  refused *Order a run*: "153 m/s short for this orbit"; a run from a raised orbit broke up in the climb.
- **Measured headless** (the Satellite hand-flown to orbit 3° east of north, recorded as its procedure, then `dispatchEstimate`
  against `procFly` to the contract's orbit). v1.228's Satellite, recorded at 102 km, 82°, 107 m/s left:

  | orbit asked | quote said | flown |
  |---|---|---|
  | 102 km, 82° (the one it flew) | 53 short | 120 m/s left |
  | 300 km, 82° | 265 short | 101 m/s short of circularising |

  **Two faults in the quote, one in the design.** (1) It charged the planet's spin lost to the contract's inclination, vRot ·
  (1 − cos 82°) = 239 m/s, though the procedure had flown 82° and paid for it: now vRot · (cos i₀ − cos i), i₀ the inclination
  the margin was measured on (the procedure's, or a dry run's `mT`). (2) Its margin was the vacuum Δv on paper less the flight's
  spent Δv (5,167 − 4,976 = 191), but the flight ended with 107: the first stage burns at sea-level Isp. A procedure now records
  **`left`** (`dvRemaining` when it reaches orbit; `procSample`/`procAscent`) and the quote starts from it (an old one without
  it as before). (3) Even quoted right, v1.228's Satellite is ~100 m/s short of 300 km polar (the second fin ring, Q439, took 70).
- **Fix for the design: a Tank 2 t over the first stage's 8 t.** Candidates (full / M1.6 calibers; flown to 300 km at 82°):
  2 t **+1.27 / +0.95, 227 m/s left**, 2.8 dearer; 4 t +1.53 / +1.17, 434 left, 4.7 dearer; a 4 t upper stage (t2 → t4) lights
  stage 2 at 23 km, 20 kPa and goes over (and its wheel fills, flagged); one fin ring and the 2 t: −0.19 / −0.51 (Q439 again).
  The 2 t: enough for the job with ~200 m/s of margin, not a TV satellite (that is the TV Satellite's boosters). To a 100-km
  orbit east on the probe autopilot: ~770-820 m/s to spare (was 418-479).
- **The quote now**, the same flight: 300 km 82° quoted 217, flown 227; 300 km equatorial quoted 457, flown 493; its own orbit
  quoted 430, flown 458.
- **"It broke up in the climb" is a roll, not physics:** `pS = Π (1 − 0.02 (1 − cert))` over the parts (18 on the Satellite);
  with the rest, a fresh program's run is p ≈ 0.79, so three clean runs in a row (the finish line) are ~0.49. Economy's balance
  call (QUEUE Proposed).
- One fin ring, for the record (Q439's point, flown): `procFly` loses control of the climb, the nose 120° off.
- `handAscent` (`fly_ladder.mjs`) takes a heading (`az`, degrees from north; east by default, flown as before). Test
  `vehicle-32`; TESTING 309.

## v1.231 — action groups (2026-10-18, vehicle session, QUEUE Q329, PLAYTEST #80)

- **What Caio asked** (PLAYTEST #80): action groups, like KSP. Make a group from deployments in the builder, name it,
  fire it in flight from its own button and a key, and drop it into a stage.
- **The design carries `ag`**: `[{id, name, op, n: [node ids]}]`. `op` is `out` (legs down, unfold, open the doors, arm
  the chute), `in` (put away) or `tog` (away if any of them is out, else out, as P and Y do). Every copy of a node moves
  with it. The deployable kinds: legs, what unfolds (solar wings, boom antennas), cargo bays, chutes (armed only: a
  chute isn't packed again). A rover's deploy stays its own button (it makes a new vessel).
- **Stock groups** come with the parts: *Solar panels* (`sol`, P) and *Landing legs* (`legs`, Y). Fired as a toggle
  they are exactly P and Y (`wingOp` / `legOp`), so they can go into a stage too: the wings out with the stage that
  drops the fairing.
- **Keys 1–9**: the design's groups in their order (`agList`, up to `AG_MAX` = 9). Deleting one renumbers the rest.
- **Staging**: a group is a staging atom `g:<id>` (`stageAtoms` takes the group list). It has no automatic place: it
  fires with a stage only where the design's `stg` puts it, and an event carries `ag: [ids]`, fired by `stage()` after
  its drops, ignitions and chute. `stgEdit` takes `{group: id}` (out of any stage it was in, into the target) and
  `{out: true}` (a chip out of the order).
- **The tape**: `['K', id]` (`tapeAg`; G was the legs' already). Procedures fire groups through their stages.
- **`procKey` ignores `ag`** as it does `dep`: groups don't change the ascent. One put in a stage changes `stg`, which
  stays in the key.
- **Builder**: an *action groups* box under staging. Each group is a chip (key · name) to drag onto a stage, with a name
  field, its mode (toggle / extend / retract, click to change), the number of parts and ✕. *+ group* starts one with the
  selected part if it deploys. A deployable part's options have a *groups* row: in or out of each group, and *+ new
  group*. A group's chip in a stage has ✕ to take it out. Chip labels are escaped now (group names are typed).
- **Flight**: keys 1–9; an *Action groups* HUD card (shown when the design has its own groups) with a button per group,
  its key on it, and how many of its parts are out; the stage list names the groups a stage fires.
- `bayDoors(s, open, only)` opens just the listed bays. Not here: Caio's other KSP groups (lights, abort, custom engine
  toggles): nothing else deploys yet. Test `vehicle-33`; TESTING 311.

## Pilot margin: what a hand-flown ascent loses (2026-10-30, test bench, QUEUE Q474, PLAYTEST #119, D25)

**Question:** the presets, studies and contracts are sized to the scripted ascent (fly_ladder's `handAscent`: vertical to
286 m, flat by 54 km, the ideal circularisation; Tellus's air is 100 km). How much more does a sloppy pilot spend?
`study_pilot.mjs` flies each orbital preset on the script, then on profiles that each get one thing wrong, then a
"typical pilot" who gets several a little wrong. Attitude is set directly each step (as `handAscent` does), except the
SAS profiles, which fly the game's own autopilot (Prograde after a kick; or Stability on the gyro autopilot, the hold put
on the navball's ◇, `turnGuide`, v1.234). Hopper, Sounding and Passenger don't orbit and are skipped. ~1–2 min a preset;
run them one at a time on a busy machine (the whole list in one process was killed for memory on `Charlinho`).

**Δv spent beyond the script, m/s** (✗−n: ran dry n short; LOST: burned up or crashed; ESC: still under the line after
three circularisation burns):

| Preset | script | spare | late (2.9 km) | steep (flat 86 km) | shallow (flat 36 km) | wobble ±4° | over-steer ±6° | apoapsis +40 km | circ. by horizon | circ. late | SAS 12°@30 | SAS 8°@30 | SAS 15°@60 | ◇ gyro | ◇ every 10 s | typical pilot |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Orbiter | 4390 | 425 | +33 | +138 | LOST | +9 | +15 | +24 | −1 | −1 | +1 | +175 | ✗−96 | +8 | +50 | +93 |
| Beeper | 4359 | 1556 | +34 | +147 | ✗−1714 | +11 | +14 | +26 | −2 | −1 | +71 | +181 | +505 | +6 | +53 | +97 |
| Passenger Orbiter | 4376 | 580 | +27 | +136 | ✗−17 | +14 | +26 | +24 | −1 | −1 | +33 | +179 | +518 | **✗−361** | **✗−172** | +89 |
| Satellite | 4697 | 714 | −2 | +53 | ✗−722 | +13 | +20 | +25 | −1 | −1 | ✗−2684 | ✗−2121 | +145 | −2 | −10 | +18 |
| TV Satellite | 4416 | 2462 | +17 | +124 | LOST | +8 | +20 | +26 | −1 | 0 | +421 | +490 | +569 | 0 | **LOST** | +78 |
| Heavy | 4306 | 1281 | +29 | +151 | LOST | +6 | +8 | +26 | −1 | +2 | +469 | +563 | +613 | +15 | +88 | +101 |
| Asparagus | 4234 | 2323 | +38 | +144 | LOST | +8 | −3 | +24 | −1 | −1 | +497 | +583 | +645 | +12 | +82 | +105 |
| Lunar | 4356 | 4074 | +43 | +334 | LOST | +9 | +59 | +24 | −1 | +1 | LOST | +260 | ESC | +13 | +121 | +255 |
| Big Lunar | 4335 | 4109 | +40 | +239 | LOST | +8 | +55 | +12 | −12 | +42 | +59 | +401 | +588 | +37 | +128 | +168 |
| Probe | 4427 | 4286 | +34 | +222 | ✗−1679 | +9 | +37 | +21 | −3 | +10 | +160 | +290 | +503 | +14 | +78 | +172 |
| Sample Return | 4329 | 4489 | +39 | ESC | LOST | +9 | +184 | +22 | −1 | +4 | −48 | ESC | LOST | +28 | +296 | ESC |
| Crewed Lunar | 4358 | 4650 | +44 | +291 | LOST | +5 | +14 | +24 | 0 | 0 | LOST | LOST | +252 | +12 | +85 | +195 |

*Typical pilot:* vertical to 1.4 km, flat by 71 km, ±2° wobble, apoapsis 15 km high, circularised along the horizon
(nose lifted 0.5° per m/s of fall). *Circ. late:* the same from apoapsis instead of half the burn before it.

**What it says:**
- **Steady errors are cheap.** A late turn +30–45, wobble +5–15, an apoapsis 40 km high ~+25, a circularisation
  along the horizon instead of the ideal vector ±0. Turning too little is the expensive steady one: +50–150 on one-core
  and booster rockets, **+220–335 on the Lunar class**, whose ~0.6 g upper stages can't add the sideways speed in time
  after a steep climb and need a second circularisation burn (Sample Return can't finish it at all).
- **Turning too flat is a cliff, not a cost** (swept on Orbiter and Lunar, flat by): 51 km −4/−15, 49 km +2/−27,
  46 km +39/−23, **43 km +312/+501, 40 km burned up** (the pod passes 1,250 K) on both. The script's 54 km sits ~10 km
  above the edge; the cheapest point (49–51 km) is just above it.
- **The SAS gravity turn (kick, then Prograde) has a narrow window that doesn't carry across rockets.** On the Orbiter
  12–15° at 30 m/s matches the script, 8° costs +175, 20° turns flat into the sea, and kicking at 60 m/s needs ~25°. The
  Orbiter's 12° flips the Satellite and burns up the Lunar and Crewed Lunar; the heavy boosters (Heavy, Asparagus, TV
  Satellite) lose +420–500 on it.
- **The ◇ works** (v1.234): flown on the gyro autopilot with the hold on the ◇ every step it costs +0–37; moved every
  10 s, +50–130 (Sample Return +296). Two exceptions, both control, not Δv: the **Passenger Orbiter departs** at ~35 km
  following the ◇ (AoA 5° → 100°, ~500 m/s lost tumbling) on every autopilot generation, and the **TV Satellite flips at
  5 km** when the hold steps ~11° at once (PLAYTEST #120).
- **Δv is not what's thin on these presets.** Every one of them has ≥ 425 m/s spare after the script, more than any
  steady pilot error here costs one-core rockets. What ends a hand flight is a cliff: turning flat into the heat, a kick
  that's wrong for this rocket, a stack that departs off the airflow. That matches Caio's "I don't precalculate the
  optimal path" better than a thin tank does.

**For Q475 (the pilot margin):** carry **+150 m/s** on one-core and booster presets (covers turning too little, the ◇
moved every 10 s, and the typical pilot) and **+350 m/s** on the Lunar class (weak upper stages: turning too little
+334). The Assembly's line: "to orbit ~4.4 km/s flown well, ~4.55 by hand" (~4.7 on a Lunar-class stack). Presets
already above that (all of today's orbital ones) need no tank; contracts and studies whose spare was sized to the script
(the Satellite's 300 km polar routine, v1.229) should be checked against it. **For Normal's forgiveness, the cliffs
matter more than the tank:** a heat warning before turning flat costs the pod, and the Passenger Orbiter's departure
(PLAYTEST #120). Not measured: the suborbital first-hour flights (Hopper, Sounding, Passenger), throttle errors, staging
late or early, crosswind, flights from other sites.

## v1.237 — the pilot's margin in the Δv budget (2026-10-30, vehicle session, QUEUE Q475, PLAYTEST #119, D25)

**What:** the Δv to orbit is now quoted twice, flown well and by hand. `orbitNeed(stack, aims)` (sim/vessel.js) is the one
place it's worked out: the need as before (the logbook's best flight to orbit, else 4,500 m/s, plus a Hohmann climb to the
most demanding aim's altitude), plus `pilotMargin`: **+150 m/s**, or **+350** when the stage whose Δv finishes the climb
pushes under 0.3 g (the Lunar class: Lunar, Big Lunar, Probe, Sample Return, Crewed Lunar, whose second stages light at
0.10–0.20 g). Numbers from Q474 (§ "Pilot margin" above). `PILOT_DV`, `PILOT_DV_WEAK`.
- **The Assembly** (app/editor.js `orbitLine`, under Total Δv): "To low orbit ~4,500 m/s flown well, ~4,650 by hand ·
  4,663 m/s in the air", or the aimed contract's name instead of low orbit. Green when the air Δv covers the hand-flown
  need; amber (a why-mark: a bigger upper tank, a lighter payload, fly the ◇) when only the well-flown one; red when it's
  short even flown well and the flight is aimed at orbit; dim when it's aimed nowhere (a sounding rocket isn't short).
- **The Rollout** (`launchWarnings`): *Tight* now means the air Δv is under the hand-flown need (was: under the well-flown
  one), and the ok line quotes both.
- **Presets: no tank changes.** In the budget's own terms (air Δv against 4,500 + margin) every orbital preset clears the
  hand-flown need; the Orbiter by 13 m/s, the Passenger Orbiter by 157, the rest by 580–3,800. In flight the margin is
  wider (Q474 measured ≥ 425 m/s spare after the script; the estimate's 4,500 is above the script's ~4,400).
- **Contracts:** none are sized on Δv (they ask for an orbit; the player picks the rocket). The Satellite's 300 km polar
  routine (v1.229) is flown by its procedure, i.e. well, so it keeps the script's margin: no change. `satLife`'s spare
  stays the well-flown one.
- **Hard (Q476):** meant to read 0 in `pilotMargin`; nothing else to change.
- **Checks:** `vehicle-34` (margins per preset, the weak-stage list, Tight between the two needs, the ok line's wording);
  `--smoke` all passed. GPU look (shot.mjs, Assembly with Lunar and Sounding): the line reads as above.

## v1.238 — the Orbiter carries a pilot's margin you can feel (2026-10-30, vehicle session, QUEUE Q486, PLAYTEST #121)

**Why:** Caio flew the Orbiter by hand on v1.237, following the ◇, and ran dry short of orbit ("it was tight
regardless"). It was the thinnest preset: ~425 m/s left after a perfect climb, 13 m/s over the hand-flown need in the
Assembly's budget.

**What:** `PRESETS.Orbiter` gets a **Tank 1 t** under the Tank 2 t on its upper stage (`chute pod t2 t1 petrel dec t8
fins kestrel`). Compared (study_pilot.mjs with the preset swapped; `orbitNeed`):

| Orbiter | vac Δv | budget over by-hand | left after the script | steep | ◇ | cost | TWR 1 / 2 |
|---|---|---|---|---|---|---|---|
| today (v1.237) | 4,894 | +13 | 425 | +138 | +8 | 55.8M | 1.63 / 0.50 |
| +Tank 1 t, first stage | 5,066 | +168 | 572 | +144 | +7 | — | 1.51 / 0.50 |
| **+Tank 1 t, upper stage** (taken) | 5,288 | +431 | **794** | +127 | +3 | 57.5M | 1.51 / 0.39 |

The upper stage doubles what's left for ~1.7M (a new program starts with 60M); it stays above the 0.3 g line, so it's
not Lunar class; no new Rollout warning; its stage still holds in the air (`airSep`).

**What it changes for a kick-then-Prograde climb:** lifting off at 1.51 g, not 1.63, the W-tap at 8 s that suited the
old Orbiter now turns it flat into the heat (100 % of a part's limit, falls back). The window is narrow (Q474): 9 s +
0.8 s works (heat 53 %, 745 m/s left), 8.5 + 0.8 and 9 + 0.9 also, 9 + 0.7 and 9.5 + 0.8 run dry circularising. The tests
that fly that way (core § 5 flySAS, § 12 the tape, § 10 ascent heating) now kick the Orbiter at 9 s. A player meets this
only once Prograde exists (the analog autopilot); in the first hour the ◇ is what's flown, and it's insensitive (+3).
Q481's pitch programmer is the real answer to the narrow kick.

**Hard (Q476)** can keep today's Orbiter (the v1.237 stack) if Caio wants Hard's exact margins to include the presets.
**Tests:** core's Orbiter Δv (5,288), launch warnings' tight case moves to the Passenger Orbiter (the Orbiter now carries
400 km), vehicle-3's Orbiter length 9, vehicle-34's tight case at a 5,000 m/s logbook.

## v1.241 — the TV Satellite holds together on a hand-flown climb (2026-10-30, vehicle session, QUEUE Q504, PLAYTEST #137)

**Reproduced** (study_pilot.mjs, the TV Satellite, with structural messages logged): flown smoothly (the script, the ◇
every step, a kick-then-Prograde, the typical pilot) it reached orbit; with the hold moved onto the ◇ every 10 s (a player
tapping toward it) it broke at **4 km, 48 kPa**: *Tank 8 t / Decoupler (bending, 100 %)*, then the payload adapter.

**Cause: it was barely stable.** Its stability margin was **0.14 calibers on the pad and −0.05 supersonic** (the Heavy,
the same lower stack with a pod on top: 0.79 / 0.62). The 1.6 m fairing up front puts the air's push ahead; a step of the
hold at max-q lets it swing broadside, and at 48 kPa no joint survives that: an interstage decoupler or a reinforced joint
only moved the break (to Petrel / Tank 2 t at 23 km).

**Fix:** a second fin ring on the core and on each booster (`…'t8','fins','fins',{k:'kestrel',rad:{…stack:['cone','t4',
'fins','fins','kestrel']}}`), as the Satellite got in Q439: **0.95 / 0.78 calibers**, 115.2M (was 110.7M), Δv 6,842
(was 6,962). Flown again: script, wobble, over-steer, the kick at 12° and 8°, the ◇ every step and **every 10 s**, the
typical pilot: all reach orbit, no structural failure. A core-only second ring gives 0.55 / 0.36 (not flown).

**Why the checks didn't warn loudly:** the Rollout did say "Aerodynamically unstable (−0.05 calibers): only steering keeps
it straight", amber, the same line the stock Hopper and Beeper show on every launch (Q202), so it reads as boilerplate.
Between 0 and ~0.3 calibers nothing is said at all. Not changed here: max-q doesn't separate the dangerous case (the
Hopper's estimate is 119 kPa, the Asparagus sits at 0.04 calibers and survives every profile); Q202 (making the stock
rockets stable) is what makes the amber line mean something.

**Checks:** `vehicle-35` (≥ 0.5 calibers, no stability warning); vehicle-30 (the TV Satellite to its stationary slot over
the capital) passes; `--smoke` all passed.

## v1.243 — small satellites (2026-10-31, vehicle session, QUEUE Q505, PLAYTEST #138)

**Why:** Caio: "satellites still seem to require some full-sized cylindrical elements which keep them from being really
small". The probe core, the battery and the reaction wheel came only at 1.25 m, and every bench starter stood on them.

**What:**
- `small(key, base, sc, o)` (sim/vessel.js, beside `big`): the 1.25 m part drawn smaller through the same `sc`/`base`
  path the 2.5 m parts use (`partShape` scales the base's shape; no new drawing). What a part holds or makes goes with
  its face, sc²: mass, torque, momentum, charge; strength as `big`'s (C, T, S × sc², B × sc³).
  **core6 / core3** (Probe core 0.6 / 0.3 m: 18 / 4.6 kg, 461 / 115 N·m, 0.115 / 0.029 kWh of its own, sim/power.js),
  **batt6 / batt3** (0.23 / 0.058 kWh), **rwheel6 / rwheel3** (3.46 / 0.86 kN·m), **octl6** (the long octagonal frame
  at 0.6 m). Prices 5 / 4, 1 / 0.8, 3.5 / 2.5M. Ungated, as their full-size parts; tier 1 by `tierOf` (d.sc).
- **The adapter narrows** (`payAdapter(r)`, `padapt6`, `padapt3`): a payload block's ring is picked by the radius of the
  part it stands on, 1.25 m below it either way. `isAdapter(d)` replaces the `key === 'padapt'` tests (builder, the
  fairing check, tests).
- **Starters:** the *TV satellite* on core6, batt6, rwheel6, octl6 (its 0.7 m sphere is now the widest part; 345 kg,
  was 545; 1,825 m/s of its own, was 1,024; wheels 3.9 kN·m); the *First beacon* at 0.6 m (Sputnik's 0.58) on core6 and
  four batt6 (~1 kWh: 9 days on its battery, was 13; 47 kg, was 110). The *Satellite* starter (the Satellite preset's
  payload) is unchanged.
- **Not done:** a GPU look at the small parts (they're the big ones scaled); the frame family (`oct`) only has the long
  one at 0.6 m; Q417's bus shapes and kick motor.
- **Checks:** `vehicle-36`. **Not yet run** (the machine was out of memory; Caio playtesting): `--smoke`, and
  vehicle-30 (the TV Satellite to its stationary slot: its payload got lighter).

## v1.244 — the payload bench lists a satellite's parts only (2026-10-31, vehicle session, QUEUE Q506, PLAYTEST #139)

`benchPart(d)` (sim/vessel.js): not the kinds in `BENCH_NO` (pods, the escape tower, nose cones, fairings, fins and fin
blades, decouplers, the 2.5 m adapter, the mass simulator, hab, lab, bay, ports, the claw, the arm, rovers), and tanks and
engines only up to 0.7 m (the propellant spheres; kick motors, thrusters, the apogee engine). Everything else stays:
cores, batteries, wheels, spin motors, frames, the balance weight, instruments, cameras, antennas, computers, solar,
RTGs, RCS and gas, legs, the landing beacon, chutes and heat shields (a capsule that comes home), the biocapsule. The
builder's palette (`listed`) applies it on the bench and skips a category left empty. 42 of 84 parts. `vehicle-37`.
Not checked in the browser yet.

## v1.245 — opening the Assembly leaves a preset a preset (2026-10-31, vehicle session, QUEUE Q498, PLAYTEST #132)

**Cause** (the test bench's, confirmed in the code): `design()` (builder.js) turns a preset still in the array format into
a v2 tree, which builder.js says must wait for the first edit (so the preset keeps its name and its tape). Since v1.231
(Q329) `BLD.panel()` called it on every draw: the *+ group* button's count (`design().ag`), and the selected part's
options (`nodes(design().root)`, `const D=design()`). So opening the Assembly made every preset a custom design ("Design
9J06"), and the robot's `m1` threw at `stackDef.join`.

**Fix:** `dView()`, the design to read: `stackDef` when it's already a tree, else a view over the nodes the ship was
assembled from (the same objects `design()` would adopt), the array left alone. The panel's three read-only uses take it;
`design()` stays inside `edit()` and the actions (place, pick up, balance, make a payload, save). The group rows' `G()`
already ran only inside `edit()`.

**Checks:** none headless (builder.js needs the page). **To run:** the robot's `m1` (`playtest.mjs m1`), the Beeper step,
and the news line naming the Beeper, not "Design …".
