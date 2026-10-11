# UI — hierarchy and restraint
**Version**: 0.1.0 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-11 · **Updated**: 2026-10-11
**Status**: draft; the open calls are **D16** in [`QUEUE.md`](QUEUE.md).
**Purpose**: Caio (2026-10-11): "the menus and UIs need more attention. There's a lot going on; remove unnecessary
information, use structure to signal information hierarchy." Research, an audit of today's screens, rules every
screen follows, and a per-screen spec. **Not** navigation (which screens exist and how you move between them: NOTES §
"UI: screens and navigation — spec", Q239) and **not** the visual identity (W14 → Q53): this is what each screen
*says* and in what order. Both of those build on it.

Screens audited (1280×800, 2026-10-11): `output/launchpad/ui-audit/` (1 setup, 2 Program, 3 Assembly, 4 flight on
ascent, 5 flight on the pad, 6 map).

---

## 1. What's wrong today (the audit)

**Across every screen**
1. **No first read.** Everything is the same small size and weight, so nothing tells the eye where to start. The
   Program has five competing focal points (the offers column, the NEXT note, the tabs, an empty photo, the buttons);
   the Assembly's right panel is one long scroll of equal lines.
2. **Four visual languages at once:** paperwork (Program), dark generic panels (Assembly, HUD), cream period gauges
   (flight), a blue navball, a pencil map, all on screen together in flight and map.
3. **Colour isn't a code.** Red is a calendar header, the NEXT label, a border and a warning; it also marks stage 2's
   **TWR 0.50 in red, which is normal for an upper stage**: the alarm colour on something that's fine. Green is money
   and "OK"; orange is instructions and warnings.
4. **Always-on things that rarely matter:** the key-help bar, nine hold-mode buttons with the unavailable ones greyed,
   locked parts and locked missions two epochs ahead, an empty "first flight's photo" frame, Ap/Pe while landed
   ("Pe −11 m"), the news ticker during the ascent.
5. **Sentences where a state would do:** "Why: Routine science work" on every offer, a sub-line under every choice,
   "Right-click a part for its options" under the staging.
6. **Things said twice:** the NEXT note and the first mission; the Inbox's offers and the Contracts tab; funds in two
   places on two screens.

**Per screen**
- **Program:** the agency name is the biggest thing; funds and the date (what decisions hang on) are small in a
  corner. Offers are fully expanded (6–8 lines each). Six tabs plus Logbook and Rover yard as buttons.
- **Assembly:** the question the screen exists for, *will this rocket do the job?*, has no answer anywhere; the parts
  of one (Δv by stage, TWR, "Low orbit: unknown", cost, days to stack, imports, know-how, study) are scattered down
  the panel.
- **Flight:** in the most demanding minute (the ascent), the news box sits top centre; the readout, a card, the
  stages, the gauges, the navball and the hold modes are six boxes in three styles.
- **Map:** labels pile up (Hesper, Hyperion, Helios, Enyo over each other), "TU" units nobody knows, and the dark
  flight panels sit over the paper map.
- **Setup** (first run): fine. One-time, and the sentences are the point. Only: say why "To the assembly hall" is
  disabled, and pre-select a default.

## 2. Rules (from the research, adapted)

Sources: Zach Gage's "three reads" (on Into the Breach); NN/g on minimalist design, visual hierarchy and progressive
disclosure; the Douglas/Airbus **dark cockpit**; FAA 14 CFR 25.1322 (alarm colours); Apollo's caution-and-warning
system and Mission Control's GO/NO-GO polls; Apollo flight plans (a timeline keyed to mission time); Oxygen Not
Included's overlays; Mini Metro; Factorio's GUI rework; HighFleet and KSP2's reception. Links in § 6.

1. **Three reads per screen.** Read 1: one to three things, the biggest on the screen, understood at a glance. Read 2:
   what you use while working. Read 3: everything else, one click or hover away. **Each screen writes its reads down
   (§ 3)**, and anything not in them is cut.
2. **Every element pays rent.** For each, name the decision it serves and how often. Serves none: cut. Rare: behind
   a click or a hover. Only for one phase: shows in that phase only.
3. **Dark cockpit.** When all is normal, the screen is quiet: gauges and cards appear when they matter (heat while
   heating, fuel when low or burning, the link when it's about to drop) and leave after. Empty means "all good".
4. **Colours are reserved.** Red only for *act now* (abort, out of money, a crash course, a deadline today); amber only
   for *will need action*; green only for a GO. Never decoration, never a brand, never a number that's just low. The
   power's own colour is the accent everywhere else.
5. **One master caution.** One lamp in a fixed place; clicking it acknowledges and shows which tile is lit (HEAT,
   STRUCTURE, LINK, POWER, FUEL). Tiles stay lit until the problem is gone.
6. **GO/NO-GO instead of raw numbers.** A screen that asks "can we?" answers it in a board of a few rows, each GO or
   NO-GO with one reason, the numbers behind a click (Mission Control's poll). Show the consequence, not the inputs
   ("reaches orbit, 340 m/s spare"), as Into the Breach does.
7. **Time as one strip.** Calendars, flight plans and debriefs are a vertical strip of time with only the big events
   on it; each opens its own sheet.
8. **Layers, not clutter.** The map and the Assembly get overlays (coverage, targets, windows; mass, heat, cost),
   one at a time, off by default.
9. **Words for terms, not for every line.** Jargon (Δv, TWR, max-q, apoapsis, know-how) becomes a hover term with
   its explanation (Crusader Kings' nested tooltips, one level); the sub-lines go.
10. **The theme dresses the information; it never hides it.** Paper, panels and posters are frames, type and
    colour; numbers stay plain, controls stay standard (click, hover, undo). No dial to turn to read a value
    (HighFleet's lesson), no stylised type that's harder to read (KSP2's).
11. **A small kit, and every screen is built from it.** Sheet, row, stat, stamp (GO / NO-GO / DONE), lamp, tile,
    poster heading, button, tab. Four type sizes (poster, sheet title, body, footnote), two weights. Poster type only
    for big moments (a first, a Debrief title, a loss), never for routine headings.
12. **What's clickable looks clickable**, one way, everywhere; stamps and labels never look like buttons.
13. **One language per place:** the office (Program, Debrief, logbook) is paperwork; the cockpit (flight, rollout)
    is the instrument panel; the map is the pencil chart. No dark generic panels anywhere (W14's mix).

## 3. Each screen's reads (the spec)

| Screen | Read 1 (biggest) | Read 2 (while working) | Read 3 (on click or hover) | Cut or hide |
|---|---|---|---|---|
| **Program** | **what to do next** (one card: the next mission or decision, with its deadline) · funds · date | the open contracts and offers as **one line each** (name, pay, days left); the time strip (launch windows, deadlines, budget day) | an offer's full text; tabs for Fleet, World, Industry, Company | the agency name shrinks to a letterhead; "Why: …" lines; locked missions beyond the next epoch (a count instead); the empty photo frame until there's a photo |
| **Assembly** | **a GO/NO-GO board** for the chosen mission: *Reaches target · Budget · Stack time · Recovery · Escape (crewed)*; each GO, or NO-GO with one reason | the parts list; the stage list with Δv per stage | each board row opens its numbers (Δv by stage, TWR, mass, cost breakdown, imports, know-how, study) | the key-help bar (a `?` button and H); the red on a normal upper-stage TWR; locked parts collapsed into one line per family |
| **Flight** (ascent, burns, landing) | the navball with the burn or hold marker · altitude and speed (one line) · the **master caution** | the current stage and its fuel; a **phase card** (ascent: q and heat; landing: height and descent rate; burn: Δv to go) | everything else on hover or the readout's `+` | the news during ascent, burns and landing (it queues for the next quiet moment); hold modes the vessel can't fly; Ap/Pe while landed; the help bar |
| **Map** | the orbit and the **result** of the planned burn (encounter or not, periapsis), big | Ap/Pe on the orbit, the next node, time to it | overlays (coverage, targets, windows), one at a time | labels that collide (declutter by importance, hide the rest at that zoom); the flight's dark panels; units nobody knows ("TU" → days) |
| **Debrief** | the verdict stamp (PAID / FAILED / FIRST) and the money | the flight as a time strip with what mattered (staging, anomalies, objectives) | the logbook entry, the telemetry details | — |
| **Rollout** | the GO/NO-GO poll (the Assembly's board, now with weather and the window) and LAUNCH | the site, the weather, the window | — | — |

**Every screen passes three checks before it's done:**
1. **Squint:** blurred, the two or three blobs that stand out are its read 1.
2. **Five seconds:** someone who sees it for five seconds can say what needs attention and what to do next.
3. **Inventory:** every element on it is in its row above, or it's cut.

## 4. What this changes in the queue

- **Q239 (real screens)** and **Q53 (identity)** build each screen to its row in § 3, with § 2's kit.
- **A declutter pass now**, before the screens get their rooms, on today's layout (cheap, and the playtests feel it
  at once): the Program's one-line offers and NEXT card, the Assembly's GO/NO-GO board, the flight's dark cockpit
  (phase card, news held during critical phases, master caution, hidden modes), the colour code, the map's labels.
- **The hover-term glossary** (rule 9), shared by every screen.

## 5. Open (D16)

1. **The Assembly's question:** the GO/NO-GO board answers for **the mission you picked** (default: the Program's NEXT
   card, or a contract you choose on the Assembly), or a generic "reaches low orbit" when none is picked.
2. **The master caution makes a sound** (default: yes, a short period buzzer; F4 mutes all sound).
3. **A pinned readout for experts:** players can pin extra lines to the flight readout (default: yes, read 3 made
   read 2 by choice; the default stays minimal).

## 6. Sources

Gage, three reads (gigazine.net/gsc_news/en/20180501-game-design-subway-legibility) · NN/g: aesthetic and minimalist
design, visual hierarchy, progressive disclosure, squint test (nngroup.com) · Oldale, *Douglas Flight Deck Design
Philosophy* (ntrs.nasa.gov/citations/19910001626) · 14 CFR 25.1322 (law.cornell.edu) · Apollo CSM displays and
controls, caution and warning (nasa.gov ALSJ) · Launch status check, flight controllers (Wikipedia; ibiblio Apollo
documents) · Oxygen Not Included overlays (wiki.gg) · Mini Metro (killscreen.com) · Factorio Friday Facts 216, 243,
277 · HighFleet review (pcgamer.com) · KSP2 UI feedback threads (forum.kerbalspaceprogram.com) · CK3 nested tooltips
(gamingonlinux.com; Paradox Tinto Talks #77).
