# Launchpad — mock-ups
**Version**: 0.1.4 · **Author**: Caio Camargo + Claude (flow session; bodies round 2: sky & bodies beat; suits: effects beat; heads: look & sound) · **Created**: 2026-10-08 · **Updated**: 2026-10-10 · **Status**: for Caio to pick
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

## bodies/ — how each body looks (QUEUE Q71, round 2 Q207 → SYSTEM.md look briefs → Q80–Q85)

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

**Round 1 feedback (Caio, 2026-10-09, W20):** Hesper too featureless; Enyo's volcano a perfect ring, redder overall;
Astraea too much like the Moon; Hyperion too much like Saturn; Eos's lines unclear; Tethys featureless; Erebus needs
something distinctive. Round 1 stays on the page as the `r1-*` buttons; its stills keep their old names.

### Round 2 (QUEUE Q207, SYSTEM.md 1.1.0 § each body "Look, round 2")

Same page; the bar's first row. Stills in `output/launchpad/mockups/bodies/r2-<view>.png` (1280×800).

| View | What changed | Real references (compare) | What the game's planet shader would need |
|---|---|---|---|
| **hesper** | day side: cream with faint chevron streaks, the sideways-Y shape, a swirl and cold collar at each pole | Mariner 10 / Akatsuki UV, toned down | a cloud map (or procedural Y + streaks) under the haze limb; no ground from space |
| **hesperNight** | the night side glows dull red; dark cloud filaments and cooler highlands in silhouette; exaggerated | Akatsuki IR2; Parker Solar Probe WISPR (2021) | an emissive term on the night side (glow × (1 − cloud opacity) × highland mask), added before tone mapping |
| **enyo** (+ Pavor) | redder: rust and ochre dust, dark basalt; the volcano with an irregular basal cliff, three smaller shields in a row, the canyon east of them | Viking colour mosaics ("Mars as people picture it") | land colour from a map; the volcano and its row as **ground height** (GROUND.md's Enyo recipe), lit by the bump, not painted |
| **enyoVolcano** | the volcano from above at low sun: the cliff, overlapping off-centre calderas | Olympus Mons by Viking / Mars Express HRSC | the same height field at close range; the calderas need flat floors and steep walls in the recipe |
| **astraea** | lumpy and flattened (0.8 at the poles); a giant south-polar basin with a central mountain; equatorial grooves; salt spots in a young crater; faint blue-white streaks | Vesta by Dawn (Rheasilvia, Divalia Fossae); Ceres's Occator | the basin, mountain and grooves as ground height; the flattening is a render-only scale on the sphere (physics stays round, SYSTEM.md says so) |
| **astraeaSide** | the same body side-on: the flattened outline and the mountain standing out of the basin | Vesta's profile by Dawn | as above |
| **hyperion** | northern summer: bands and storm spot, the polar hexagon, the southern winter hemisphere blue; rings with a broad dark gap and a small moon in it (drawn ~15× too big to see), a braided bright outer ring | Jupiter by Juno (bands); Saturn's hexagon and blue north by Cassini; the F ring, Pan and Daphnis | a band texture plus a hexagon mask; a **season uniform** (the sun's latitude in the planet frame) that tints the winter side; ring opacity as a 1D radial profile plus the braid and the gap's edge waves |
| **hypWinter** | six years on: the north is winter, blue, with the rings' shadow across it; the rings seen from their unlit side | Cassini 2004–2005 (Saturn's blue north, ring shadows) | the same uniform; rings lit through their unlit face (thin parts glow, dense parts dark) |
| **hypSky** | from Tellus after dusk, with a telescope inset showing the new rings | amateur telescope views | unchanged from round 1 (a point in the sky; a telescope view later) |
| **eos** | scalloped crack chains (cycloids), two patches of jumbled ice blocks (chaos), four tiger stripes at the south pole with plume curtains over the limb | Europa by Galileo (cycloids, Conamara Chaos); Enceladus by Cassini (tiger stripes, plumes) | cycloids and chaos as decal maps; stripes a polar decal; plumes as a small volume (or stacked billboards) brightest looking toward the sun |
| **eosSouth** | Eos from below: the stripes with frost on their flanks, cycloids and chaos | Enceladus's south pole by Cassini | as above |
| **tethys** | haze thinned: dark dune belts, a bright highland, northern lakes, one glinting at the sun; the detached blue layer stays | Titan by Cassini VIMS (dunes, Xanadu, the 2009 Kraken Mare glint) | a surface map under a view-angle haze (thin at the centre, thick at the limb); a specular term masked by lakes |
| **erebus** | backlit: a dark disc in thin layered blue haze, the sun just hidden | New Horizons' departing image of Pluto | a forward-scattering haze shell with layered density; only matters when the sun is behind the body |
| **erebusAether** | Erebus and its companion at true size and distance: an irregular cellular nitrogen plain (no heart), a dark tholin belt, water-ice blocks on the plain's rim; Aether grey with a dark red polar stain | Pluto (Sputnik Planitia's cells, Cthulhu) and Charon (Mordor Macula) | a second body in the tree locked face to face; Erebus's map; Aether's cap as a polar decal |

**Not in round 2:** Theia (no change was asked; round 1's `r1-theia` stands), Pavor and Metus (unchanged).

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

## heads/ — the head inside the helmet (QUEUE Q220 → D11, CREW.md § Part 1)

Open `heads/index.html` (bar: one sheet per head, or *Side by side*) or the stills in `output/launchpad/mockups/heads/`
(`sheet-a.png`, `sheet-b.png`, `sheet-c.png`, `sheet-compare.png`; 1280 wide). Each sheet: a close-up on the pad, the
whole figure, true-size **48 px** thumbnails (the five expressions, then the roster) and the five enlarged ×2 with the
pixels kept, the five **flight portraits** (neutral, grin, grit under high g, alarm, wonder at a first sight) and a
**roster of six** (the same six people under each head: hair style and colour, nose, brow weight, skin tone, one
moustache). The suit is the crew mock-up's placeholder, not a school's (suits are `suits/`). Faces are painted in head
space, as a texture would be in the game; the portrait's light colours alarm red and wonder blue (a planet in the visor).

| Option | What it is | Reads at 48 px | Costs |
|---|---|---|---|
| **(a) Ligne claire** | Tintin: a slightly big round head, dot eyes, brows and a one-line mouth carry the face, hair a flat silhouette with an inked edge, two flat bands of shade | **best**: dots, brows and hair shape survive; the roster tells apart by hair and skin | cheapest: a sphere-ish mesh and a face texture per expression; the nose needs an ink hook to show |
| **(b) Puppet** | Thunderbirds: a big head with flat temples, cheek planes, a square jaw, a brow ledge, a block nose; glass eyes that turn, lids that close; a satin sheen | **worst**: the glass eyes and lids vanish; the head is a beige block | dearest: it needs a sculpted mesh (primitives make it a mask, as here) and per-eye rigs; strongest on the close-up |
| **(c) Toy peg** | a tall rounded cylinder (taller than wide), the face printed on, the hair a clip-on piece, a plastic glint | good: printed features as clear as (a); the hair piece carries identity | cheap like (a); **the clip-on hair is the most LEGO-like part** (no stud, real skin tones and a head 1/6 of the body keep it off the minifig); painted hair would make it a wooden peg doll instead |

Notes: expressions are brows + eyes + mouth only (no head turn); grit pulls the features down and clenches the teeth; on
(a) and (c) wide eyes add whites, a squint is a line. Under any suit with a cap (Apollo's Snoopy cap, the Sokol hood)
the hair silhouette, the roster's main tell, disappears: then skin, brows and a name tag have to carry it.
Default if silent: **(a)**, as D11 recommends.

**Round 2 for (b), art deco** (Caio 2026-10-10: the round-1 puppet "is not what i expected and does not look good"; go
faceted and chiselled, not a round head; one face many ways): `heads/deco.html`, stills `deco-all.png` (also
`deco-1-3.png`, `deco-4-6.png`). One face (Ada Marsh) as a polyhedron (mirrored planes, an eye band under a brow
ledge, a wedge nose, a hair shell), six treatments: **1 carved block** (few planes, flat-lit lacquer), **2 chiselled,
inked** (more planes, two tones, ink on every facet edge: W19's ink on a cut head), **3 Lempicka** (softened edges,
warm light, cool shade), **4 streamline** (planes rounded into a keel, grooved hair), **5 ziggurat** (inked, stepped
hair), **6 bronze** (enamel eyes; loses skin tone). Each: 3/4 in the helmet, front and profile studies, grin, alarm,
48 px. Seen so far: 1, 3 and 4 read as faces at 48 px; the inked ones (2, 5) turn to noise small and the eye band
still hints at glasses.

**Round 3 for (b)** (Caio's brief, 2026-10-10: art deco after Lawrie's Atlas, Mukhina, Lempicka, The Incredibles,
Thunderbirds' proportion; and "round 2 still started from a sphere": its planes sat tangent to an egg, so chins
receded): `heads/deco3.html`, stills `round3-sheet.png`, `round3-study.png` (`?view=study`: the chosen cell big with its
expressions; `?cut=&eye=&fin=` picks the cell). The head is a **block**: a flat front, the forehead tipping back, cheek
planes, a jaw wedge, the chin as far forward as the lips, a prism nose, a brow ledge over deep sockets, a sculpted
hair cap with V grooves. Expressions are sculpted (brows tilt, cheeks lift, the jaw drops, the mouth is a carved slot,
teeth a block). The sheet: a 3 × 3 grid, cut (soft ~6 / mid ~12 / hard ~20 face planes) × eyes (painted dot, bare
carved, painted iris); the chosen cell (**mid × painted iris**, default) in matte wood, satin lacquer, bronze; its five
expressions; in the helmet and at 48 px. Seen: mid and hard read as carved deco heads; soft loses its brow ledge to the
rounding and looks like a mannequin; at 48 px the eyes go to shadow (the brow carries the face), and the dot reads
more clearly than the iris. All three finishes work; bronze loses skin tone.

**Pick:** _(Caio)_

## suits/ — the suit lines by school and era (QUEUE Q199, round 2 Q219 → CREW.md § "The suit brief, round 2")

### Round 2 (QUEUE Q219, CREW.md 0.2.4; Caio on round 1: "too samey across epochs and for the two schools")

Open `suits/index.html`. The bar picks a suit, the role stripe, the pose (standing, or the walkout) and the shot: on the
crew arm, the helmet, the studio, or from behind (for Orlan's door). The last four buttons draw the brief's checks as
sheets. Stills are in `output/launchpad/mockups/suits/` (1280×800):
- the sheets: `r2-sheet-lineup.png`, `r2-check1-silhouettes.png`, `r2-check2-grey.png`, `r2-check3-48px.png`;
- per suit: `r2-<suit>-walk.png` and `r2-<suit>-close.png`, plus `r2-steppe-eva-back.png` and `r2-steppe-middle-pad.png`.

Round 1's stills moved to `round1/`.

Each suit is now built from its own pieces in the shader, not one body recoloured.
- **Cape** is hard shells and gloss, with metal hardware on show and hoses into the chest.
- **Steppe** is canvas: matte, creased shading, laces and hoods. Its hoses go into the belly, and on the early and
  middle suits they run to a ventilator case carried by hand.
- **Era** reads through mass: slim early suits, jointed middle ones, bulky or padded late ones, boxy spacewalk ones.

| Suit | Built from | Signature |
|---|---|---|
| **Cape early** (Mercury) | aluminised silver drawn as illustration chrome (bright above the horizon line, dark below); slim, with bloused knees; gold connectors and a hose loop on the chest; a small round shell with an oval faceplate, a gold neck ring and a mic boom | mirror silver; finger-tip lights |
| **Cape middle** (Apollo) | white; bellows ribs at the shoulders, elbows and knees; four red and blue connectors and a diagonal zip; a big blue neck ring under the **all-glass bubble**, with a **Snoopy cap** (white crown, dark sides, ear cups, mic booms) inside it | the bubble over the cap; the bellows |
| **Cape late** (Shuttle launch-and-entry) | **international orange**, a padded "pumpkin" (the widest suit); black boots and gloves; a parachute harness with a buckle; a hose into the chest; a white helmet with a wide visor, big clamshell pivots and a long back; a mirror on the wrist | the orange and the harness |
| **Cape spacewalk** (EMU) | a hard upper torso over soft trousers, with shoulder bearings; a big backpack; a **chest control box** with knobs; red identity bands on the legs; a white shell with a gold visor, **two lamps and a camera** | the chest box, the lamps |
| **Steppe early** (SK-1) | an orange coverall with a black belt and high black boots; a big white shell with red block letters across the brow and the visor slid up above them; two hoses from the belly to the **ventilator case in hand** | the lettered helmet, the case |
| **Steppe middle** (Sokol) | warm off-white canvas, creased; **blue lacing straps** round every limb, a **laced V** on the chest and a blue waist strap; the **hood sewn to the suit** (it melts into the shoulders, with no neck ring), a metal visor ring on hinges; the case and its hoses | the soft hood, the blue lacing |
| **Steppe late** | **grey-green** enamel with orange flashes at the shoulders and cuffs; a padded chest panel and knee pads; a hard hood in a lighter green with the visor ring kept from Sokol; the ventilator is now a slim **pack on a shoulder strap**, with a short hose to the belly | the grey-green |
| **Steppe spacewalk** (Orlan) | a **fridge**: one rigid box from hips to helmet, with no neck; short stiff arms standing off the body; red arm bands and blue leg bands; a boxy helmet with a **large flat visor** and **lamps on both "ears"**; a control panel on a lanyard; from behind, the **door** (the backpack, with its seam, hinges and red lever) | the back door |

**The checks** (CREW.md's four, run before showing):
1. **Silhouettes.** All eight can be told apart in black, walking and standing. The weakest pair standing is Apollo and
   SK-1 (both a big round helmet); SK-1's case separates them.
2. **Grey squint.** Each era's pair reads apart at a third of the size. Late was the weak one: Shuttle orange and
   grey-green came out the same grey, so the enamel is darker now (the pumpkin's bulk also separates them).
3. **48 px.** These signatures survive: the silver, the bubble's ring, the orange and harness, the gold visor, the case,
   the blue laces, the green, Orlan's bands. These are lost at that size: Apollo's bellows, Mercury's finger-tip lights,
   and the SK-1 letters (a red smudge on the brow). Orlan's door only shows from behind.
4. **Walkout.** It's the default pose: a stride with one arm waving, and the case or pack in the other hand on the
   Steppe suits.

**Open:**
- Cape late moved to the Shuttle's orange suit by the design desk's default. The sleek white-and-black suit goes to
  Foundry (POWERS 1.1.0). This is Caio's to override.
- The role stripes are unchanged (pilot blue, scientist green, engineer yellow), but each is now edged in ink, so pilot
  blue reads even on the Sokol's blue lacing.
- SK-1 and the Shuttle suit are both orange, but in different eras, so the brief's colour rules allow it. Their
  silhouettes are far apart.

**Pick:** _(Caio)_

### Round 1 (QUEUE Q199, CREW 0.2.3's defaults; superseded by round 2)

The page now shows round 2. Round 1's stills are in `output/launchpad/mockups/suits/round1/`; its page is in git history
(`b999a54`). It was one stylised figure, recoloured, with a few toggles (a hood, a backpack, a gold visor). Six of the
eight suits were white. Its notes, kept:

| Suit | What it is |
|---|---|
| **Cape early** | Mercury: aluminised silver suit, a silver hard helmet with a snug faceplate, dark boots |
| **Cape middle** | Apollo (the Selene era): white layers, blue fittings, an **all-glass bubble helmet** |
| **Cape late** | sleek tailored white and black, a slim helmet with a wider visor |
| **Cape spacewalk** | the EMU: bulky white, a backpack, a closed gold visor |
| **Steppe early** | the SK-1: an orange coverall, a white helmet lettered in red across the brow |
| **Steppe middle** | Sokol: white, blue connectors, a soft fabric hood with its visor (the hood only reads as fabric up close) |
| **Steppe late** | a refined, closer-fitting Sokol |
| **Steppe spacewalk** | Orlan: a rigid torso entered from the back, a closed visor, red fittings |

Role stripes proposed: **pilot blue, scientist green, engineer yellow**. Pilot blue is weak against the Sokol's blue
fittings; an alternative is pilot white-on-red. The game already draws the default suit (Q195); the picked lines go into
`SUITS` in `app/crew-look.js`, one build item per school.

**Caio (2026-10-10):** too samey across eras and schools; replaced by round 2.
