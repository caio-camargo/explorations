# KSPISMS — what the game inherited from KSP, and what to do about it
**Version**: 0.1.0 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-11 · **Updated**: 2026-10-11
**Status**: **D15 answered 2026-10-11 (Caio): yes on all six.** Build items in QUEUE *Proposed*; 4 written into CREW.md 0.2.8, 6 (Kerbol) into SYSTEM.md 1.1.1.
**Purpose**: Caio learned the genre from Kerbal Space Program and asked (2026-10-11) that nothing idiosyncratic to KSP
come in unexamined. An audit of the docs and code (21 checks), sorted into what stays and what to change. Re-run the
checks when a big system is designed (crew, science, new UI).

---

## 1. Not inherited (the game already does its own thing)

No tech tree or science points (parts open by missions, compute eras and know-how; instruments pay through
contracts); one currency plus opinion, no reputation; no facility tiers limiting part count; one rigid body, no
wobble or struts; recovery by boats, relations and wear, not distance from the space centre; the link is a real link
budget with horizons, blackout and light delay, not CommNet's formula; asteroid classes are spectral (C, S, M); ISRU is
site-specific; cold-gas RCS from a gas bottle, wheels that saturate; Nyx is harder than Minmus (e 0.55, tides); bird
names for engines, no Mk1, Kerbal, KSC or Mun.

## 2. Inherited, and kept on purpose (genre-necessary or real; labelled as simplifications)

| What | Why it stays |
|---|---|
| Patched conics with spheres of influence, rails warp only off thrust | the standard first-order model in real mission design too; ours adds tides near Selene and Nyx; n-body stays a setting |
| Small, dense bodies (1/5 radius, real surface gravity) | chosen for play length (SYSTEM § scaling); only the wording "Kerbol's mass" goes |
| Air cut at 100 km in flight (D8) | a performance simplification at the Kármán line; satellites still decay above it |
| Staging on Space, stack-and-radial builder, symmetry | the genre itself |
| The keymap (WASD, T, M, `[ ]`) | KSP's keymap is the genre's de facto standard; remapping later |
| Ap/Pe, maneuver nodes as such | real terms and a real planning tool |
| The 2.5 km loaded-vessel radius | an engine limit, invisible; "on rails" stays out of player text |
| Part qualification contracts | qualification is real; ours tie to know-how |

## 3. Crept in unexamined: proposals (D15)

1. **Engines that restart forever and throttle to zero.** Real engines had **a set number of ignitions** (many upper
   stages one; a restartable engine was an achievement) and a **throttle range** (none early; deep throttling arrived
   with lunar descent engines); solids can't throttle or stop. **Propose:** ignitions and a throttle range per engine,
   improving with the eras (pillar 8) and a design problem (pillar 2); ullage handled automatically by staging (small
   ullage motors), never a chore (pillar 5).
2. **"SAS" and its mode list.** KSP's word for a hold-mode autopilot (real SAS was stability augmentation in aircraft).
   **Propose:** period names per era, on the instrument-panel HUD (W14): gyro era *rate damping*; analog *attitude hold*
   with its modes; guidance computer *autopilot / DAP*. The modes stay; the label and the switch look change.
3. **Navball and node handles in KSP's colours** (yellow-green prograde, blue node; green, purple and cyan handles).
   **Propose:** our own glyphs and palette, the ball styled as the era's flight director (an 8-ball early, glass
   later); the planner first, the handles for fine tuning.
4. **Crew roles pilot / scientist / engineer, the pilot unlocking hold modes by rank** (CREW.md, design only). The
   trio and the rank-unlock are KSP's. **Propose:** real titles by era and school (pilot → commander and flight
   engineer → specialists; Steppe's *bortinzhener*, research cosmonauts), and a pilot's skill coming from **training
   and time in a type** rather than rank. Touches approved CREW Part 2, so it's Caio's call.
5. **Revert to launch** after a real failure undercuts pillar 7 ("a lost crew weighs"). **Propose:** a **simulator**:
   fly any mission first in the simulator, free, no news, revert at will (early programs lived in simulators); a real
   flight can't be reverted.
6. **Names:** the *Asparagus* preset (a KSP community word) becomes *Crossfeed*; "Kerbol" goes from SYSTEM.md; the
   1.25/2.5 m diameter steps are KSP's numbers (flag only: real stages vary; a later look at sizes).

**Defaults if silent:** 1 yes (plan first, vehicle); 2 yes (with W14's HUD); 3 yes (look/flow); 4 **ask** (approved
design); 5 yes (flow, economy); 6 yes.
