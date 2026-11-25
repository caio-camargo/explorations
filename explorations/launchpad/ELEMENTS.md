# Elements — the grammar of text on a screen
**Version**: 0.1.11 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-11-18 · **Updated**: 2026-11-25
**Status**: **the roles, the code and the Assembly's dress are decided (D50, 2026-11-18).** Nothing in the game
follows it yet; the build order is § 7 (filed under QUEUE *Proposed*). The sans: IBM Plex Sans and B612 (D52). A flight HUD mock-up for Q477: the direction and VT323 figures decided (D53); amber, pointer gauges, legend keys (D55): § 6.1; queued as Q477. The Rollout, the Program and the Debrief mocked: § 6.2. **The office is real documents (D54)**; its graphics are being worked up on the Debrief: § 6.3.
**Purpose**: Caio (2026-11-18): "text boxes and such... have a very claude-y look, which is serviceable for development
but not definitively... first doing some research on design principles and semiotics of text elements, like what
should be similar and what different, how to establish similarity and difference and hierarchy." This is the layer
[`UI.md`](UI.md) names and never defines (rule 11, "a small kit"): which kinds of text exist, which must look alike,
which must differ, and what carries each difference. UI.md says *what* a screen shows and in what order; its § 4.1
says how each place is dressed. This sits between the two, and it re-examines the dress for function (Caio: the
identity is "only loosely fixed... subject to reevaluation for function").

Mock-up: [`mockups/kit/`](mockups/kit/index.html) (the Assembly in four dresses, a role sheet, squint and grey
checks). Stills: `output/launchpad/mockups/kit/`.

---

## 1. Today, measured (the Assembly at v1.366)

Still: `mockups/kit/today.jpg` (1258 × 702, the Orbiter preset, a part hovered).

1. **One shape does seven jobs.** The same rounded, hairlined box is a command (*undo*), a toggle (*snap*), a choice
   (*×2*), a way out (*← Program*), a part you pick up (*Command pod*), a staging event you drag (*ignite Kestrel*)
   and a purchase (*Study 3.2M*). Nothing says which of these a box is before you press it.
2. **Cyan means five things:** the title, some headings (*PAYLOADS*), some values (*60M*, *57M*, *5288 m/s*), the date
   line and the launch button. Orange is a count (*Inbox 4*), the stage numbers and a caution. Red still marks
   an upper stage's TWR 0.39, which is normal (UI.md § 1 item 3, open since October).
3. **Headings have three looks and no rank:** *PARTS* (dim capitals), *PAYLOADS* (cyan bold capitals), *STAGING*
   (bright capitals with a dim word after it). Which contains which is told only by position.
4. **Size and corner mean nothing.** `index.html` and `app/*.js` use 21 font sizes (8.5 to 22 px, ten of them
   between 9 and 13.5 px) and 5 corner radii; `builder.js` adds its own.
5. **One voice.** Everything is the system monospace: a part's name, a number, a sentence, a heading and a button are
   the same face at nearly the same size. With the translucent navy panel, the cyan hairline and the spaced capitals
   this is a code editor's theme, which is why it reads as a development tool.
6. **Numbers don't line up.** The parts' masses run 0.84 t, 0.0184 t, 0.00461 t: different precision, no shared
   decimal place, the unit as loud as the figure. The stage lines are runs joined by dots, so no figure sits under
   the one it compares with.

## 2. Principles (from the research)

Sources in § 9, each marked as read this session or recalled.

1. **A look means something only by its difference from the others** (Saussure). So the roles come first (§ 3) and
   the looks second. A difference that marks no distinction is noise (21 sizes); a distinction with no difference is
   ambiguity (one box, seven jobs).
2. **The common case is unmarked** (markedness, Jakobson). Plain body text is the default; every mark (bold, capitals,
   colour, a box) is a departure the eye pays for. Marks are a budget: the rarer and more important a thing, the more
   it may spend.
3. **Variables have different powers** (Bertin). Position and size are *ordered*: the eye ranks them. Weight and tone
   are ordered in two or three steps. Hue, typeface, case and shape are *categorical*: they say kind, never rank. So
   rank goes on position, space and size; kind on face, case and shape; condition on hue. A cyan heading beside a dim
   one asks the eye to rank by a variable that can't rank.
4. **One variable per distinction; two only where a miss costs.** Butterick: space first, then weight, then the
   smallest size step that shows, and never bold, capitals and size piled on one heading. The standards add: colour
   is always backed by a word or a shape (MIL-STD-1472F, via FAA HFDS 6.1.2.1.8b), so nothing fails in grey.
5. **Group by nearness first, likeness second, a box last** (Gestalt; NN/g on common region). A boundary overpowers
   the other two and adds clutter, so it is kept for where spacing can't do the job.
6. **A box must mean one thing.** Factorio's rework is the worked example: its team stated which shapes are raised
   (buttons) and which are sunken (fields that hold something), and players objected wherever a screen mixed the
   two. Norman's term is the *signifier*; NN/g reports that weak ones leave people unsure what can be clicked.
7. **Labels are graded, and never repeat their parent** (MIL-STD-1472F, via FAA HFDS 6.1.2.1.2–5, 6.1.2.2.12): group
   labels larger than control labels, each step at least about 25 % larger than the one below, three levels (system,
   group, component), and a lower label never restates a higher one ("rpm", not "engine rpm"). One-word labels in
   capitals, phrases in mixed case (6.1.2.3.10–11). A line round a group carries its label centred at the top, in a
   break in the line (6.1.2.2.7).
8. **The value is the content; the label is support** (Refactoring UI). Drop the label where the format says it
   ("12 left"), quieten it where it stays, and reverse that only where people scan by label (a spec sheet).
9. **A typeface is a voice** (van Leeuwen: type signifies by connotation, through features such as weight, slope,
   expansion and regularity). So a second face should mark *who is speaking*, not rank. Every period medium this
   game borrows already makes that split: a form is **printed** by the office and **typed** by the clerk; a panel is
   **engraved** by the maker and **lit** by the instrument; a drawing is **lettered** and then **figured**. That is
   the label/value distinction, native to each dress.

## 3. The roles

Twenty-seven kinds of text and text-holder, found by going through the Assembly, the part card and the flight HUD.
The mock-up's *Role sheet* shows each one live in every dress, and its footer names the role under the pointer.

| Group | Role | What it is | Alike with | Differs from, and by what |
|---|---|---|---|---|
| Structure | **Place title** | where you are; one per screen | every screen's title | a group heading: one size up |
| | **Group heading** | names a functional group | the same rank on every panel | the title: one size down. A name: it starts a block, with space above |
| | **Sub-heading** | a category inside a group | every category line | a group heading: one size down, quiet, capitals |
| Data | **Label** | names a value; the system speaking | every label and column header | its value: weight and tone |
| | **Value** | the data: figures of one width, fixed decimals | every figure on every screen | its label: weight and tone (in a dress, also the hand that wrote it) |
| | **Unit** | belongs to its value; in a table, said once in the header | every unit | its value: tone and weight |
| | **Name** | what a thing is called (part, site, craft) | values: both are the data | a heading: it never starts a block |
| | **Index** | which one in a sequence (stage 1, 2, 3) | every sequence number | a value: a fixed first column. Never colour |
| | **Count** | how many wait for you | every such count | a value: a filled pill, the only round shape |
| Judgement | **Verdict** | a judgement in a word (GO, PROBABLY, NO-GO) | every verdict (Rollout, Debrief) | a value: a word in capitals, fixed width, reserved colour. A command: no fill, never reacts |
| | **Caution / warning** | will need action / act now | the master caution | prose: a glyph and an edge in the reserved colour; the words stay in the ink |
| Prose | **Sentence** | what a thing is; mixed case; UI.md § 2.1's budget | all prose | a label: length and case |
| | **Note** | a condition, a source, a status | every aside | a sentence: one size down, quiet |
| | **Prompt** | the one next step; one per screen | every prompt | a sentence: a marker, and there is only one |
| | **Term** | a word the glossary explains on hover | every term | a command: a dotted underline, no plate |
| Controls | **Command** | does something now; a verb | everything pressable shares the plate | static text: the plate |
| | **Primary command** | the one action the screen exists for | commands | a command: size and fill; one per screen |
| | **Toggle** | on or off, and it stays | every switch | a command: an indicator that is always there, lit when on |
| | **Choice** | one of several | tabs | a command: plates joined edge to edge, the chosen one inverted |
| | **Navigation** | leaves the screen | every way out | a command: an arrow, and its place in the title row |
| | **Key hint** | the key that does the same | every key hint | a count: outlined, not filled |
| Things | **Well** | holds objects; the only sunken region | every list of objects | a panel: sunken |
| | **Object** | a thing you pick up (a part, a saved design) | tokens, crew, anything picked up | a command: a row in a well, no plate of its own |
| | **Token** | an object in a sequence (a staging event) | objects | a command: a grip edge, inside a well |
| | **Picture** (D50) | a part's side silhouette | every part, wherever it is listed | another kind: shape. Another size: scale, in three steps. One tone, never colour |
| Judgement | **Lamp** (cockpit only) | a caution as a tile outside any readout, dark until it matters | the master caution and its tiles | a key: no raised edge. A verdict: it lights and goes dark |
| Data | **Gauge** (D55, cockpit) | a value drawn as a pointer on a scale against a limit | every gauge (fuel, heat, load, throttle) | a value: a length, not a figure. A lamp: never a filled block in the phosphor's colour |

States, the same on every role that has them: **held or chosen** = inverted (ink and ground swapped); **not
available** = faint, with its reason one hover away; **hover** = a tint, never a change of shape.

## 4. The code: what carries each distinction

| Distinction | Carried by | Steps | Never by |
|---|---|---|---|
| Rank (title, group, category) | size, with space above | 3, each ≥ 1.25 × | colour, a box |
| Label or value | weight and tone; in a dress, the hand | 2 | size, colour |
| Data or the system's words | typeface (where the dress has two) | 2 | colour |
| Pressable or not | the plate | 2 | colour, an underline |
| Which kind of control | one added feature on the plate (indicator, joined edge, arrow) | 4 | a different shape per control |
| Object or control | the well | 2 | |
| Held, chosen, on | inversion | 2 | hue |
| Condition | hue **and** a word or glyph: amber = will need action, red = act now, green = GO (UI.md rule 4) | 3 | hue alone |
| Available or not | tone | 2 | hiding it without a reason |
| Order in a sequence | position, and an index figure | | colour |

The budget this gives a screen: **4 sizes** (footnote 10.5, body 13, title 16.5, and poster type for big moments
only: UI.md rule 11), **2 weights**, **3 tones** (ink, quiet, faint), **3 hues, all reserved**, **2 faces at most**,
**2 enclosures** (plate, well) besides the panel itself. **One accent: the power's colour, on the primary command
and nowhere else** (D50). That puts a limit on the powers' colours: one near red or amber makes the launch button
read as an alarm (the mock-up's *Power* swatches: cobalt is fine, terracotta reads as red on paper, ochre as
amber). A power whose colour is in that range needs a darker or cooler variant for the button.

Changes this makes to content, not only to looks (all in the mock-up):
- **Stages become a table**, units in the header, so each figure sits under the one it compares with.
- **Masses share a format:** kilograms under 0.1 t, two decimals above (80 kg, 0.84 t), not 0.0184 t.
- **A normal number is never red.** TWR 0.39 is a value; "Gets off the pad" is the verdict and carries the colour.
- **A toggle's name is its state's name** (*Snap*, lit), never a verb.
- **The launch button stays on screen:** the right panel scrolls above a fixed foot.

## 5. The identity, re-examined for function

A dress may change every surface, but it must supply every variable in § 4. Tests, in order:

1. Two weights, or two tones, legible at footnote size.
2. Figures of one width, with Δ, ×, →, ° and · in the face.
3. Sentences in mixed case (principle 7).
4. A plate and a well that can't be mistaken for each other or for a stamp.
5. The three reserved hues free: no surface, phosphor or ink of the dress may be amber, red or green.
6. A panel 280–350 px wide holds the parts list and a six-column table at the dress's body size.

| Dress | What it is | Passes | Fails or strains |
|---|---|---|---|
| **Plain** | no costume: one DIN face, dark neutral, no hue | all six | says nothing about the era; it is the control case |
| **Form** | a printed form filled in on a typewriter: section bars, small printed labels, typed entries, dot leaders from a part to its figure, checkboxes, rubber stamps | 1–5. The printed/typed split is principle 9 for free, and stamps are a native verdict | 6 strains: Courier is wide, so the body drops to 12.5 px and long part names run close to their figures |
| **Drawing** | an engineering drawing: lettered capitals, a parts list with item numbers, ruled tables, headings in a break in the line | 1–6 | drafting lettering has one weight, so label and value differ only by case and tone: the weakest pair of the four. Dark blue prints were already old by the 1950s (recalled, not checked) |
| **Panel** | an instrument panel: engraved capitals, groups ringed with the label in the line (MIL's own rule), lit keys, readouts on glass in VT323 | 3, 4 | 1: VT323 has one weight, so emphasis must be reverse video or half brightness. 5: **amber phosphor is the caution colour** (toggle *Amber phosphor* in the mock-up: the Inbox count and PROBABLY vanish into the readouts), and green phosphor would be GO; the mock-up uses white. 6: glass type needs 15–17 px to read, and the six-column table fits with 18 px to spare only at 15. Data outside a readout needs its own little window, which then looks like a plate |

What follows from the table:
- **The grammar is independent of the dress.** All four are the same HTML with the same role classes; only the
  dress's block of CSS differs. That is Q480's token sheet (one place, one block), with roles as the thing a place
  styles.
- **The office's dress suits the Assembly better than the cockpit's.** A parts list and a stage table are a
  catalogue and a tabulation: paper's home ground. Form and Drawing pass where Panel strains. This agrees with UI.md
  § 4.1 item 4 (the Assembly as the model on a desk).
- **The cockpit's amber needed a decision before Q477, now made (D51: lamps)** (the flight HUD as the instrument panel, "amber VT323
  readouts"): either the readouts are not amber, or caution is not amber on that screen. Real panels keep the two
  apart by putting cautions on separate lamps, so a lit caution tile outside the glass may be enough; that wants its
  own mock-up, in flight.
- **Found on the way, in a built screen:** the charter marks its ticked boxes with a red ✗ (red is "act now").
  Small; not changed.

## 6. What the mock-up shows, and what was checked

`mockups/kit/index.html`, served or opened as a file. Bar: **Dress** (keys 1–5: Today, Plain, Form, Drawing, Panel),
**View** (Assembly, Role sheet, Cockpit caution), **Power**, **Checks** (Squint, Grey, No pictures, Amber phosphor). Hover anything: the footer names its role
and its rule. The content is the real Assembly's (the Orbiter preset's figures; part names and specs from the game),
regrouped only as § 4 lists. The background is the game's own frame with the panels hidden.

Checked this session, from stills at 1258 × 702:
- **Squint** (Plain): what survives the blur is the launch button, the held part and the Inbox count. The first two
  are the screen's read 1; the count is arguably too loud.
- **Fit:** the stage table measures 296 px in the Panel dress's 314 px; the other dresses have more room.
- **Added after D50:** a **picture** on every part row (ten hand-drawn silhouettes, scaled in three steps; filled
  on the form, line art on the drawing; *No pictures* hides them to compare). They are placeholders: the game has
  each part's real profile (`prof` in the part definitions), which is what a build would draw. **Power** swatches
  for the launch button. The **Cockpit caution** view (§ 8). Opening the page as a file works (the fonts load).
- **Not checked:** the Grey toggle's stills were captured but not inspected (each condition has a word or glyph by
  construction); any dress on the flight HUD, the Program or the map; any window larger than 1258 × 702; a
  colour-blind simulation; whether Bahnschrift exists off Windows (it is a stand-in: the game bundles no sans).

### 6.1 The flight HUD on the roles (2026-11-19, for Q477)

`mockups/kit/flight.html`, opened as a file. The flight screen as the instrument panel, from the same roles: engraved
B612 for the system (labels, headings, key legends), lit figures on glass for the data, cautions on lamps (D51). The
backgrounds, the navball and *Today* are the game's own at v1.370 (`views.js` 94 and 156); **the figures and the
caution sentences are invented.** Bar: **State** (Climb all quiet, Caution, Warning, Orbit burn), **Phosphor**,
**Figures**, **Key on**, **Gauge**, **Checks** (Squint, Grey, Today). Stills `output/launchpad/mockups/kit/flight-*.png`.

**D53 (Caio, 2026-11-19), on round 1:** "it's the right direction, i like vt 323, but it takes up too much space
and some numbers are way bigger than they need to be. the panel doesn't have to come up to the top of the navball.
the staging readout needs work, i think each stage needs to be a separate box or something because it needs to
carry more information than a single word or phrase". Round 2 is what the file shows now:
- **Smaller.** The bezels cover 24.5 % of the 1258 × 644 view in the quiet climb, from 35.9 % in round 1. The
  main bezel is 628 × 142 px (was 750 × 212).
- **The panel is lower than the ball.** The navball stands on the bezel and rises about 60 px above its edge, with the
  heading and pitch on a small tab over it.
- **Smaller figures.** Speed and altitude are 30 px VT323 (were 46), with their labels beside them, not above.
- **Each stage is its own box of glass**, stacked as the rocket is (the one flying at the bottom). Its number is
  the large figure. The stage flying: its engine, thrust to weight, the fuel gauge, Δv and time left, in a lit
  frame. A stage waiting: its events as tokens, then its Δv, burn time and thrust to weight; the next one
  carries the Space key. Later ones are dimmer.
- **The caution tiles are a strip** along the bottom of the main bezel, the master first. The master alone has a
  raised edge, since it alone is pressed (to acknowledge).

**The layout, against UI.md § 3's Flight row.**
- Read 1 is one bezel at the bottom centre: speed, the navball, altitude, in the order aircraft use (speed left of the
  ball, altitude right), with the caution strip under them.
- Read 2 is two bezels: *Stages* at the bottom left, and one *phase card* at the bottom right (Ascent: Q and
  structure; Burn: Δv to go, ignition, burn time), each row on one line.
- Cut from the standing screen, to live behind *Readout +*: the mission line, the link's name, total Δv and TWR, the
  angle of attack, the altitude tape, the radar height and the air gauge. Each is a call for Caio and flow to check.

**Found.**
1. **A role was missing: the gauge** (a value drawn as a length against a limit). The Assembly has none; the cockpit
   has five. Its code here: a strip of glass with the limit as a tick engraved on the bezel; it never changes colour.
2. **A lit tile always has a row of the same name on the phase card**: the gauge, the figure, and the fix under it
   in the readout's own colour (UI.md rule 14). HEAT lights, so a Heat row appears; when it goes dark the row leaves
   (rule 3). The same word on the tile and the row is what ties them.
3. **Amber figures and amber tiles do not collide** (D51 holds): a tile is a filled block with dark letters, in its own
   column. **But a filled amber bar does**: blurred, the throttle and the gauges were the same blobs as the tiles
   (`flight-caution-squint.png`). With *Gauge: Pointer* (a mark on a scale) the only filled blocks in the phosphor's
   colour are lamps (`flight-caution-pointer-squint.png`). A white phosphor avoids it either way; a green one would
   collide with GO on the Rollout's poll (not mocked).
4. **A key lit whole is the brightest thing on the panel**, brighter than read 1, and in grey it is an amber tile
   (`flight-quiet-squint-plate.png`, `flight-warning-grey-plate.png`). *Key on: Legend* lights only the legend and a
   bar on the key. This departs from "chosen is inverted" (§ 4) for the cockpit only.
5. **Red differs from amber without colour** by a white frame and by the master's word (CAUTION, WARNING):
   `flight-warning-grey.png`. A flash would too; a still can't show it.
6. **Figures: VT323 (D53).** It reads at 18 px for a row and 30 px for read 1 (46 in round 1 was more than needed). B612 Mono gives the point and the colon a full
   cell (`13. 6`, `0: 55`). **B612 itself has figures of one width**, reads best of the three, and makes the cockpit
   one family, but Caio prefers VT323. B612 Mono also overflows a stage box (279 px in 262).
7. **The navball is the strongest colour on the panel** (the game's blue). Its look is look & sound's, with Q436.

**Decided (D55, Caio 2026-11-25: "let's go with the recommendations"):** amber phosphor; pointer gauges; legend
keys; the gauge joins the roles of § 3. ~~Open: the phosphor (amber, white); bar or pointer gauges; legend or plate keys; the gauge as a role.~~

**Not checked.** A landing, the map, the Rollout and the rover yard; the eras; a window narrower than about 1215 px, where
the three bottom bezels (284 + 628 + 262 px) would meet; a rocket of five or more stages (the stack of boxes grows
by 55 px a stage); the hold keys' symbols (placeholders, not Q436's); the
copy; any of it in play.

### 6.2 The Rollout, the Program and the Debrief on the roles (2026-11-19)

Caio, on round 2 of the flight HUD: "yes, much better. let's look at other screens with the same approach now".
Three screens, each with the game's own content at v1.370 and a *Today* switch to the game's screen. Stills
`output/launchpad/mockups/kit/rollout-*.png` and `office-*.png`.

**The Rollout** (`mockups/kit/flight.html`, states *All go* and *No-go*): the flight's panel, since rule 13 puts both
in the cockpit. Today it is the old cool-blue panel with a system drop-down and green and red text.
- **The poll is a column of lamps**: GO (green), HOLD (amber), NO-GO (red with the white frame), each with its
  station engraved beside it and its reason lit on glass; a NO-GO's reason ends with the fix (rule 14).
- **LAUNCH is the one primary command**, in the power's colour (D50), dark while any lamp is NO-GO.
- The panel is 400 x 538 px and fits; today's is about 365 x 625.
- **Phosphor against the lamps:** green figures are the GO lamps' hue, amber figures the HOLD lamp's
  (`rollout-nogo-green.png`). Told apart only by the fill, as on the flight panel. White matches neither.
- Left for hover or a site sheet: the lowest inclination, the pad's height, the polar corridor, how stages travel,
  what comes back if it lands intact. Each is a call for Caio.

**The Program and the Debrief** (`mockups/kit/office.html`): the Form dress (D50), printed in IBM Plex Sans, typed in
Courier Prime. Both already have the desk and the paper; what the roles change:
- **Label against entry.** Today everything is Courier, so a heading, a label and a value differ only by place.
  Here the form is printed (navy, capitals) and the entries are typed.
- **Colour.** Today: green pay, blue progress, a red NEXT, a red calendar header, red negative figures, a red FILED
  stamp. Here: none of those. The only red is a failed flight's stamp; a negative figure has its minus sign; the
  tray's count is the one amber; the button that leads to the launch has the power's colour.
- **An offer is one line and opens in place** (name, pay, days; UI.md § 3). Eight Take and Pass buttons become two.
- **The Debrief's net is its largest figure**; the empty photo frame is cut until there is a photo (UI.md § 3); a
  lock is the words "not open", not an emoji.
- **The news clipping keeps its own serif**: a third face in the office, as a thing from outside it. Flagged.

**Not done.** The map (it is lettering on a drawing, and its lines did not render from a file: it needs its own
session with the game served); mission control, the title, the logbook, the rover yard. On these three: the time
strip UI.md § 3 asks of the Program and the Debrief; the other five tabs; a successful flight's Debrief (PAID, FIRST)
and a poster heading for a first; the eras; a window other than 1258 x 644; any of it in play.

### 6.3 The office's look: two directions (2026-11-19)

Caio, on § 6.2's Program and Debrief: "the readability is better, but I don't love the design--it feels
paper-themed, but not like paper at all... paper is fine in principle, though i'm not married to it, but this isn't
great." **So the Form dress as mocked in `office.html` is not the office's look** (D50's point 2 is reopened for the
office; the roles and the code stand). Why it failed, as I read it: it is a web layout in beige. Five cards with
drop shadows, web tabs, web buttons and an accordion, all of one stock, one format and one size; nothing on a desk
looks like that.

Four ways out were put to him: A real documents; B the screen is the page; C leave paper for a planning-room board;
D let the medium change with the era (with A or B). He asked for A and B side by side: `mockups/kit/debrief-ab.html`
(keys 1 and 2), the same Debrief both ways. Stills `debrief-a.png`, `debrief-b.png`, both in `debrief-ab.png`.

| | A · real documents | B · the screen is the page |
|---|---|---|
| What it is | Each thing is the document it would be: a boxed report form (caption in the corner of each box, the entry typed in), a ledger sheet clipped to it, a carbon-copy annex in purple type, a clipping, a routing slip | One printed page with no desk, cards or shadows: a grid, rules, two inks (black and the power's colour), numerals as large as they matter |
| Label against value | printed caption against typed entry (Special Elite) | printed text against typed figures (Courier Prime), and size |
| Commands | the routing slip's three lines, each a box to tick; the primary one in the power's colour | three ruled buttons in the page's foot; the primary one filled |
| Reads as paper by | stock, ink and format differing by document; holes, a clip, a signature, a stamp | print conventions: folio line, rules, spot colour, crop marks; the stamp is the one physical act |
| For it | it is a place; a document's format says what it is before it is read | the most legible; hierarchy by size; a long list or a table costs nothing |
| Against it | tilted type is softer; Special Elite reads worse than Courier Prime; captions are 8.5 px; the commands sit apart from the report; every screen needs its documents designed, and the Program (six tabs, long lists) is much harder than this | it reads as present-day editorial more than as the 1950s; less of a place; a short flight leaves half the page empty |

**Not checked:** only the Debrief, and only a failed flight; neither tried on the Program; the script face (Segoe
Script) and the clipping's serif are the machine's own, not bundled; nothing in play.

**D54 (Caio, 2026-11-19): A.** "I like A, I think there's graphical work to be done so it looks more like real docs
but the concept is good." The office is real documents. This replaces D50's point 2 for the office (the Form
dress); the Assembly's dress is untouched by it and should be looked at again in this light.

**The graphical pass (round 2 of A, same file; before and after in `debrief-a-rounds.png`).** What was added, each
a thing a real sheet has and the first try lacked:
- **The sheet is a layer of its own**: aged towards its edges, two folds across the report, a soft shadow.
- **Printed ink against typed ink.** The form (rules, captions, title, crest) is printed in one blue-green ink;
  the entries are typed in black. This is label against value by ink, on top of face and size.
- **Typed letters are uneven**: each a little off its line, turned a little, inked a little more or less (seeded,
  so it does not shimmer); each entry sits a little off its box. *Even type* in the bar turns it off to compare.
- **Each document its own stock**: cream bond for the report, green ruled ledger paper, thin white for the carbon
  copy (purple type, slightly spread, a faint COPY), grey newsprint torn by hand, a canary slip with its gummed
  edge. Sheet edges are straight; only the clipping is torn (uneven edges on every sheet looked chewed).
- **Office hardware and marks**: punch holes, a staple, a wire clip, a purple RECEIVED stamp, a pencilled
  "seen", the distribution line and form number.
- **A green blotter** under the papers, so the desk is a desk and cream has something dark to sit on.

**The costs, measured or seen:** uneven type is the look's biggest gain and its biggest cost to reading (compare
`debrief-a.png` and `debrief-a-even.png`); the captions are 8.5 px; the stamp, the pencil note and the distribution
line are decoration the game would have to generate or keep fixed; the script and serif faces are the machine's
own (Segoe Script, Georgia) and would need bundling; the sheets are CSS and one SVG filter, no images.

**The commands (Caio, 2026-11-24):** "in general it looks really good. the routing slip I'm not so sure about, it
seems to lack weight for options to leave the current screen". As I read it: three 13 px lines on a small slip are
the lightest thing on the desk, and they are the only things that act. Two heavier ways are in the same file
(*Commands* in the bar, `?cmd=slip|fold|keys`; stills `cmd-fold-0.png`, `cmd-keys-0.png`):
- **Folders** (shown by default): one file folder per place the report can go, the place typed on its tab (LAUNCH
  PAD, DESIGN TABLE, OFFICE), the act in 18 px, one line saying what happens. The usual one is the folder in the
  power's colour. Still paper, so the office keeps one language (UI.md rule 13).
- **Call box**: a dark box on the desk with three raised keys and a typed label beside each; the usual key in the
  power's colour. The rule would be "paper tells, hardware acts". Heavier, and a second language in the office.
Both name the place as well as the act, which the slip did not. Not checked: neither in grey or squint by eye;
more than three commands; the Program, where commands are many and sit inside documents.

**Open:** folders or call box; what else would make them real for Caio; the Program as documents (the harder screen: six tabs, long
lists), not yet tried.

## 7. If this is adopted: the order

1. ~~Caio picks~~ decided (D50): the roles, the code, Form for the Assembly.
2. A bundled sans with a condensed width and tabular figures (Bahnschrift can't ship): compared in § 7.1; **IBM Plex Sans and B612** (D52).
3. The role classes and one dress's tokens in `index.html` (with Q478 and Q480), the Assembly first (vehicle and flow).
4. The flight HUD on the same roles (Q477), with cautions on lamps (D51).
5. A test that fails on a font size, radius or colour outside the tokens, so the count in § 1 item 4 can't come back.

### 7.1 The sans, measured (2026-11-18)

Five faces under the Open Font License, downloaded from `github.com/google/fonts` into `mockups/kit/faces/` with
their licences, beside the stand-in. Measured in headless Chrome by the mock-up's *Faces* view (still:
`output/launchpad/mockups/kit/faces.png`); the *Sans* buttons put any of them on the Assembly.

| Face | Longest part name, 13 px | A stage row, 13 px semibold | x-height | Figures of one width | Missing of Δ → × ° · − ≥ ± ▲ ▸ ✓ | Widths and weights |
|---|---|---|---|---|---|---|
| Bahnschrift (Windows only) | 139 px | 171 px | 0.51 | when asked | → − ≥ ▲ ▸ | width 75–100, weight 300–700 |
| **Barlow** | 133 | 171 | 0.51 | when asked | → ▲ ▸ | three widths as separate families, nine weights |
| **IBM Plex Sans** | 140 | 205 | 0.52 | by default | ▲ ▸ | width 85–100, weight 100–700, one file |
| B612 | 151 | 226 | 0.56 | by default | ▲ | one width, two weights |
| Sofia Sans | 132 | 183 | 0.49 | when asked | ▲ ▸ | four widths as families, any weight |
| Archivo | 136 | 197 | 0.53 | when asked | ▲ ▸ | width 62–125, weight 100–900, one file |

("Longest part name" is *Propellant sphere 0.4 m*; the stage row is `14.04 → 6.94 2177 1969 1.51 139`. Every face
has figures of one width through `font-variant-numeric: tabular-nums`, checked.)

- **Barlow** is the nearest to the stand-in the mock-ups were judged in (same widths to the pixel on the stage row),
  the narrowest, and its condensed cut is a real one, which the form's printed labels lean on. Against it: no →
  (the game writes `14.04 → 6.94`), so the arrow must be drawn or come from the data face, and six files
  (about 630 KB as TTF; smaller once converted, not measured).
- **IBM Plex Sans** has every glyph but the two triangles, figures of one width without asking, and is sturdier at
  10.5 px. Against it: its rows run 20 % wider, it narrows only to 85 %, and it is the most recognisable as a
  present-day corporate face.
- **B612** reads best small (the largest x-height) and is the widest by a third, with no condensed cut: a face for
  a few big readouts, not for the Assembly's lists.
- **Sofia Sans** and **Archivo** sit between; Sofia's small x-height shows at footnote size.
- **▲ and ▸ are in none of them**: the caution glyph and the prompt marker should be drawn (CSS or SVG), not typed.

**D52 (Caio, 2026-11-18): IBM Plex Sans and B612.** "I like IBM plex and B612 for their legibility. I think they
also have the right feel." Where each goes is the design desk's reading of the measurements, for Caio to overrule:
**Plex on the paper places** (the Assembly's form, the drawing: long lists, and it narrows to 85 % for printed
labels), **B612 on the lit panels** (the cockpit's engraved labels, lamps and readouts: few words, large, and it is
what the face was drawn for). One sans per place, so the budget of two faces a place holds. Checked on stills
(`form-plex.png`, `drawing-plex.png`, `panel-b612.png`, `caution-b612.png`): nothing overflows at 1258 × 702; the
mock-up now opens in these. Files: Plex is one variable file (537 KB as TTF), B612 two (254 KB); woff2 sizes not
measured. Not looked at: IBM Plex Mono and B612 Mono as the data face beside each (both exist, same licence).

Before D52 my pick was Barlow (regular and semibold, in the normal and condensed widths: four files), with the arrow drawn.
Plex if the missing arrow or the thinner small labels bother Caio on the stills (`form-barlow.png`, `form-plex.png`).

## 8. Decided, and open

**D55 (Caio, 2026-11-25):** on the flight HUD's round 2, the recommendations: amber phosphor, pointer gauges, legend
keys, and the gauge as a role (§ 3). Q477 builds it.

**D50 (Caio, 2026-11-18):** the roles and the code as proposed ("yes on defaults"); **Form** for the Assembly; the
power's colour on the launch button only; parts get pictures ("that sounds good, maybe we can include a quick
mock": done, § 6). On the mock-ups: "huge improvements already".

**D51 (Caio, 2026-11-18): B.** "ok, we can go with b." In the cockpit a caution is a lit tile outside the
readout, never coloured text in it; the readout may be amber. The question as it stood: Caio asked what "lamps outside the glass" meant; the mock-up's *Cockpit caution*
view now shows it. A: the caution is written on the readout in amber, which an amber readout swallows. B: the
readout only shows figures, and a caution is a lit tile beside it (the master caution and its tiles, UI.md rule 5),
so the phosphor can stay amber.

As first asked:

1. **Are these the right distinctions?** § 3 is the proposal's core; a role that should not exist, or two that should
   be one, changes everything after it.
2. **Which dress for the Assembly?** My pick is **Form**, with Drawing's parts list (item numbers, ruled rows) if the
   dot leaders feel too quaint; Plain as the fallback for the later eras.
3. **No accent colour at all**, or the power's colour on the primary command?
4. **Do parts want pictures?** A small silhouette per part would carry kind by shape (Bertin's one free variable
   here) and make the list scannable without reading. Not mocked; it is art, not type.
5. **The cockpit's amber** (§ 5): readouts in another colour, or cautions on lamps outside the glass?

## 9. Sources

Read this session (2026-11-18):
- FAA *Human Factors Design Standard* (HFDS 2003), ch. 6 § 6.1.2 "Labeling and marking controls", which carries
  MIL-STD-1472F's rules: hf.tc.faa.gov/hfds/download-hfds/hfds_pdfs/Ch6_Controls_and_visual_indicators.pdf
- Refactoring UI, "Labels are a last resort": refactoringui.com/previews/labels-are-a-last-resort
- Butterick, *Practical Typography*, "Headings" and "Letterspacing": practicaltypography.com/headings.html
- NN/g, "The principle of common region" (nngroup.com/articles/common-region) and "Flat design: its origins, its
  problems" (nngroup.com/articles/flat-design)
- Axis Maps, "Visual variables" (Bertin's levels): axismaps.com/guide/visual-variables
- Factorio Friday Facts #277 (the module grid, shared styles) and the forum thread on #246 (raised and sunken shapes):
  factorio.com/blog/post/fff-277 · forums.factorio.com/viewtopic.php?p=366588
- van Leeuwen, "Towards a semiotics of typography", *Information Design Journal* 14(2), 2006: abstract only (the
  paper is closed): opus.lib.uts.edu.au/handle/10453/4837
- Wikipedia, "Monochrome monitor": P1 green, P3 amber, P4 white; amber "a little later" than green, no year found.
- The font files and their licences: github.com/google/fonts, `ofl/barlow`, `barlowcondensed`, `barlowsemicondensed`,
  `ibmplexsans`, `b612`, `b612mono`, `sofiasans`, `sofiasanscondensed`, `archivo`.

Recalled, not re-read (check before quoting): Saussure, *Course in General Linguistics* (value by difference);
Jakobson on markedness; Bertin, *Semiology of Graphics*; Norman, *The Design of Everyday Things* (signifiers); Tufte,
*Envisioning Information* (the smallest effective difference); Brath, *Visualizing with Text* (Bertin's levels
applied to type). Looked for and not found: Apollo's own panel-lettering rules (NASA TN D-7919 returned a 404).

- 0.1.0 (2026-11-18): first draft, with `mockups/kit/`.
- 0.1.10 (2026-11-24): the Debrief's commands: folders and a call box against the routing slip.
- 0.1.9 (2026-11-19): D54, the office is real documents; the graphical pass on the Debrief.
- 0.1.8 (2026-11-19): § 6.3, the office's look reopened; the Debrief as real documents (A) and as a printed page (B).
- 0.1.7 (2026-11-19): § 6.2, the Rollout, the Program and the Debrief on the roles.
- 0.1.6 (2026-11-19): D53; round 2 of the flight HUD mock-up (smaller, a low panel, a box a stage).
- 0.1.5 (2026-11-19): § 6.1, the flight HUD mock-up (`mockups/kit/flight.html`); the gauge as a missing role.
- 0.1.4 (2026-11-18): D52, the sans is IBM Plex Sans (paper) and B612 (lit panels).
- 0.1.3 (2026-11-18): § 7.1, five sans faces measured; the build filed under QUEUE *Proposed*.
- 0.1.2 (2026-11-18): D51, the cockpit's caution on lamps.
- 0.1.1 (2026-11-18): D50 recorded; pictures, the power's colour and the cockpit caution added to the mock-up.
