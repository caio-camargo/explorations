# Launchpad — mock-ups
**Version**: 0.1.0 · **Author**: Caio Camargo + Claude (flow session) · **Created**: 2026-10-08 · **Updated**: 2026-10-08 · **Status**: for Caio to pick
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
