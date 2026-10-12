# Launchpad notes — Vehicle
**Version**: 1.0.0 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-11 (split from NOTES.md v1.21.52, W37) · **Updated**: 2026-10-11
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

> **Superseded (2026-10-11, DECISIONS D15.4):** modes come from qualifications (rendezvous, docking, landing), not rank (CREW.md § Skill); Q134 re-plans this.

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
