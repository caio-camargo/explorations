# Launchpad — mock-ups
**Version**: 0.1.0 · **Author**: Caio Camargo + Claude (flow session) · **Created**: 2026-10-08 · **Updated**: 2026-10-09 · **Status**: for Caio to pick
**Purpose**: Static pages for choosing how things look, from pictures. **Never loaded by `index.html`**: no game code, no merge risk.
Stills go to `output/launchpad/mockups/<topic>/`. One line per option; Caio's pick is recorded here and in QUEUE.

## identity/ — one visual identity for the screens (QUEUE Q73 → Q53, PLAYTEST #13)

Open `identity/index.html` (bar at the top: direction, screen, era) or the stills in
`output/launchpad/mockups/identity/` (`<direction>-<screen>-era<n>.jpg`, 1280×800). Same two screens in all three, with
the game's real layout (Program: a panel over the pad; flight: readout top left, toolbar top right, stages bottom left,
navball bottom centre, cards in a right column) over real frames from the game. Era 1 = Epochs 1–2 (1950s–60s, the
hardware's look, NOTES § "Part visuals"); "later era" shows how the same direction moves on ("later eras can shift the palette").

| Option | What it is | Later eras | Fits | Costs |
|---|---|---|---|---|
| **(a) Paperwork** | Mission-control forms: cream ruled paper, typewriter type (Special Elite / Courier Prime), rubber stamps, paper clips; done missions struck through in red | Computer printout: green-bar pin-feed paper, line-printer type; then clean laser print | The **notebook map** and logbook already look like this; strongest "a program run by people" feel | Paper over the 3D view is opaque and bright: the flight HUD needs care at night and in space |
| **(b) Instrument panel** | Gunmetal bezels with screws, amber phosphor CRTs with scanlines (VT323), backlit legend buttons that light up when on | Amber → the **terminal map's** green → colour glass-cockpit LCDs | Reads best over the 3D view (dark, high contrast); the flight HUD is natural as a cockpit | The Program screen looks like a console, not an office; long text in a pixel font tires |
| **(c) Mid-century poster** | Flat cream, navy, teal and red; bold condensed headings (Bebas Neue, Jost); cut corners and a starburst | Softens into the 70s–80s: rounded type, warm browns and oranges, stripes | The most distinctive and cheerful; strong for menus, headlines and the Debrief | Least "instrument"; big type costs space in a dense HUD |

**Mixes are possible** and maybe best: e.g. (a) for Program, Debrief and the logbook (the office) with (b) for the flight
HUD and map (the cockpit), with a shared palette. Fonts: the game uses system fonts only today; the chosen direction
either bundles its font files (a few hundred KB, no build step needed) or falls back to the system face named after it.

**Pick:** _(Caio)_

## crew/ — how astronauts look (QUEUE Q72 → CREW.md part 1)

Open `crew/index.html` (bar at the top: style, shot) or the stills in `output/launchpad/mockups/crew/`
(`<style>-<shot>.png`, 1280×800). One scene: the capsule's open hatch on the pad walkway, the same pose (a wave), a wide
shot and a helmet close-up. Built from simple shapes in a raymarcher, so these show **proportion, materials and
shading**, not finished faces: "realistic" would get a modelled head in the game.

| Option | What it is | Fits | Costs |
|---|---|---|---|
| **(a) Cartoony** | Kerbal-like: a big head in a fishbowl helmet, stubby limbs, bright white-and-orange suit, big eyes | Charm and comedy; no uncanny valley; cheap to animate; a loss stings less | Clashes with the early-era hardware's realism unless the screens' identity bends too; a crew loss reads as slapstick |
| **(b) Realistic** | Human proportions, a silvered Mercury pressure suit, a shell helmet with a faceplate | Matches the hardware; a crew loss weighs what it did in 1967 | Costly to make convincing; up close it risks the uncanny valley (these stand-in faces show the risk) |
| **(c) Stylised human** | 1960s illustration / puppet-show: human proportions with simple forms, a square jaw, flat colour bands and ink outlines, a white suit with red trim | Fits the era's look and a lighter tone; faces stay readable small; the likely middle (ROADMAP § Design catalogs) | Flat shading has to match the game's lit 3D (an outline pass, or toon shading only on crew) |

**Pick:** _(Caio)_

## bodies/ — how each body looks (QUEUE Q71 → SYSTEM.md look briefs → Q80–Q85)

Open `bodies/index.html` (one button per view) or the stills in `output/launchpad/mockups/bodies/` (`<view>.png`,
1280×800). Each is drawn from its `SYSTEM.md` look brief, lit from the side so the terminator shows. These are one
proposal per body, not alternatives: pick, or say what to change. Real references are named, not copied in.

| View | From the brief | Real references (compare) | What the game's planet shader would need |
|---|---|---|---|
| **hesper** | a featureless cream-yellow ball, a bright haze limb, a soft terminator | Venus by Mariner 10 / MESSENGER (visible) | a haze limb and a thick-air terminator; no surface layer from space |
| **hesperUV** | chevron cloud bands (an instrument view) | Akatsuki's UV images | a second "UV" palette, only if a UV camera part exists |
| **enyo** (+ Pavor) | butterscotch and rust, dark basalt, white caps, a canyon scar, the shield volcano, a thin pink-tan limb | Viking orbiter mosaics; HiRISE's Phobos | the planet shader's land colours from a map (not Tellus's biomes), polar caps, a thin limb; small moons as lumpy meshes |
| **astraea** | charcoal grey, cratered, one bright salt spot | Ceres by Dawn (Occator) | Selene's crater field on a smaller body, one bright decal |
| **hyperion** | cream and ochre bands, a storm spot, rings tilted 27°, ring shadow on the clouds, planet shadow on the rings | Jupiter by Juno / Cassini; Saturn's rings by Cassini | a band texture (no ground), a ring disc with radial opacity and both shadows |
| **hypSky** | from Tellus: a bright point after dusk; a small telescope shows the rings | amateur telescope views of Saturn | planets as points in the sky (PLAYTEST #11), a telescope view later |
| **theia** | sulphur yellows, reds, black calderas, a plume over the limb | Io by Galileo | spotted colours, plumes as billboards or a small volume at the limb |
| **eos** | white ice, red-brown cracks, plumes in the south | Europa by Galileo; Enceladus's plumes by Cassini | crack lines on ice, plume volumes |
| **tethys** | a thick orange haze, a detached blue layer at the limb | Titan by Cassini; Huygens's descent | the haze as the body's whole look, a second thin layer above it; the surface only below the haze |
| **erebus** | pale pinks and tans, a smooth bright basin, dark reddish highlands, a tiny sun | Pluto by New Horizons (Sputnik Planitia); Triton by Voyager 2 | a map with one big bright region; the sun drawn small at that distance |

**Pick / changes:** _(Caio)_

## schools/ — the hardware schools (QUEUE Q89 → POWERS.md → Q102)

Open `schools/index.html` or the stills in `output/launchpad/mockups/schools/` (`<view>.png`, 1280×800). The Orbiter's
outline is the game's own (its parts' profiles exported from the sim); only surface, finish, paint and roundel change
between schools, as POWERS.md allows. Roundels use generic colours here; in the game each power tints its own.

| View | Cape | Steppe |
|---|---|---|
| **orbiters** — the same preset | white with the black roll pattern; a closed, ribbed black skirt over the upper engine; a stripes-and-stars roundel | grey-green enamel panel by panel, seams; an open lattice interstage (the upper engine shows through); one big star on a disc |
| **signature** — a design per school, from normal parts | tall and slim: three stacked stages with ribbed skirts, a capsule and a tower on top | a core with four conical strap-ons leaning in, each on four small bells |
| **capePad / steppePad** — the pad | a tall fixed service tower with swing arms, a flame trench, the crawlerway | rolled out lying down on rails on a transporter-erector, a flame pit, a launch table with four arms that fall back |

What Q102 would need in the game: a `school` style parameter read by `partBody` for paint, finish and the interstage
cover (skirt or lattice: a cover drawn around an exposed upper engine, outline unchanged); roundel decals from the
existing roll-pattern machinery; the signature stacks as preset designs for rivals; the Steppe pad's horizontal
rollout as a new pad animation (the rig code, `buildRig`).

**Pick / changes:** _(Caio)_
