# Elements — the grammar of text on a screen
**Version**: 0.1.4 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-11-18 · **Updated**: 2026-11-18
**Status**: **the roles, the code and the Assembly's dress are decided (D50, 2026-11-18).** Nothing in the game
follows it yet; the build order is § 7 (filed under QUEUE *Proposed*). The sans: IBM Plex Sans and B612 (D52).
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

Twenty-six kinds of text and text-holder, found by going through the Assembly, the part card and the flight HUD.
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
  `ibmplexsans`, `b612`, `sofiasans`, `sofiasanscondensed`, `archivo`.

Recalled, not re-read (check before quoting): Saussure, *Course in General Linguistics* (value by difference);
Jakobson on markedness; Bertin, *Semiology of Graphics*; Norman, *The Design of Everyday Things* (signifiers); Tufte,
*Envisioning Information* (the smallest effective difference); Brath, *Visualizing with Text* (Bertin's levels
applied to type). Looked for and not found: Apollo's own panel-lettering rules (NASA TN D-7919 returned a 404).

- 0.1.0 (2026-11-18): first draft, with `mockups/kit/`.
- 0.1.4 (2026-11-18): D52, the sans is IBM Plex Sans (paper) and B612 (lit panels).
- 0.1.3 (2026-11-18): § 7.1, five sans faces measured; the build filed under QUEUE *Proposed*.
- 0.1.2 (2026-11-18): D51, the cockpit's caution on lamps.
- 0.1.1 (2026-11-18): D50 recorded; pictures, the power's colour and the cockpit caution added to the mock-up.
