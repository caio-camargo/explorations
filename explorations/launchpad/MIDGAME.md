# MIDGAME — from single flights to a network
**Version**: 1.1.0 · **Author**: Caio Camargo + Claude (design desk) · **Created**: 2026-10-09 · **Updated**: 2026-10-10
**Status**: **Approved by Caio 2026-10-09.** Numbers are placeholders for the lanes to measure and tune.
**Purpose**: How the program turns from one-off flights into routines (epochs 3–6, M2–M4): what's automated first, how
automation grows with the eras, what a routine's window is, and what satellites ask of the player. The bridge to
[`LATE_GAME.md`](LATE_GAME.md), written now because M2 is being built.

**Built on:** NOTES § "Rich programs" (routine runs, the pad calendar), § "Compute — a resource across eras"
("automation arrives with compute"), § v1.47/v1.50 (dispatch, deviation), § v1.60 (station-keeping), § v1.64 (orbital
decay); [`CREW.md`](CREW.md) (the pilot is the computer); LATE_GAME.md § "Templates", § "Keeping flight in play".

---

## Decisions (Caio, 2026-10-09)

1. **Flying stays most of the game, if the player wants.** Automation is **opt-in per route**, never forced. A player
   who flies everything gives up scale (pads, calendar time), never access. Flying can take most of the player's time
   through the endgame.
2. **Automation arrives with compute,** as a ladder through the eras; pilots are the early exception.
3. **Every routine has a window,** stored in its template; the routine runs at the next valid one.
4. **Satellites: adjustment built into the design, replacement for upgrades.** Maintenance as a chore is out (Caio:
   "satellite maintenance might be very boring").

---

## The automation ladder (decision 2)

Each era moves the edge of automation outward; the player flies what's beyond it.

| Era (NOTES § Compute) | What can run as a routine | What you still fly |
|---|---|---|
| **Before computers: the launch rail** (year 0 on; § The launch rail) | **an aimed launch**: set the rail's angle and heading, and a small solid rocket flies itself to its orbit, no steering | anything crewed, liquid or heavy |
| **Human computers** (year 0–3) | repeating an ascent you've flown (dispatch: exists, Q11) | everything else |
| **Mainframes** (~year 3) | deploying satellites to orbits you've flown; ground-commanded | rendezvous, docking, anything beyond Tellus orbit |
| **Onboard computers** (~year 7) | **uncrewed rendezvous and docking: cargo resupply** (Progress-like); Selene runs | the new: other bodies, first landings, the planets |
| **Abundance and after** | interplanetary routes, gravity-assist families (LATE_GAME) | the edge, wherever it is |

**Pilots come first** (CREW.md): a crewed vessel can rendezvous and dock before its computer can. So **the first
resupply is crewed**: crew rotation carrying cargo, Soyuz-like. Uncrewed cargo routines follow with onboard
computers.

**The order of first routines**, typically: a repeat satellite launch → crew rotation with cargo → uncrewed resupply →
Selene runs. **The network screen earns its place around the third routine** (a station, its resupply, a
constellation); before that the pad calendar is enough.

## Windows (decision 3)

Every route waits for alignment, but the scale differs hugely (our system's numbers):

| Destination | What has to line up | How often | For a routine |
|---|---|---|---|
| **Tellus orbit** | the target's plane passing over the pad | about twice a program day (8 h rotation); phasing in orbit takes hours | effectively always; the calendar picks the slot |
| **Selene** | Selene's place in its 13-program-day orbit; for surface runs, daylight at the site | departures most days; surface runs on a 13-day lighting cycle | a short wait |
| **Nyx** | its node crossing (30° tilt) | about once per 33 h orbit | a short wait |
| **Planets** | planetary alignment | every 1.0–2.1 years (SYSTEM.md) | convoy seasons |
| **Gravity-assist routes** | two or more bodies | years to decades | rare and valuable |

**The rule:** a template stores its **window rule** (plane over the site · target phase · lighting · planetary
alignment), and the routine runs at the next valid window. The pad calendar shows upcoming windows. Near space costs
days of waiting; planets cost years.

## Satellites (decision 4)

Station-keeping (v1.60) and decay (v1.64) are real physics and stay. What changes is what they're **for**:
- **Lifetime is a design choice, made once.** The builder shows it ("holds its slot 12 years at 0.37 m/s a day"),
  and a good design (more propellant, a higher orbit, an engine that can trim) **outlasts its era**. Re-tune so a
  well-built satellite rarely runs dry; a short life is the result of a careless design, not the norm. Today's
  Program line ("holds its orbit 240 more days") is the right *display*; the typical numbers need to grow.
- **Replacement is for upgrades.** A new era makes a better satellite worth launching (NOTES § Program design: "TV
  goes HD"). It's an opportunity with a payoff (more audience, finer imagery, a new service), not a repair.
- **Servicing is special, not routine:** a Hubble-style rescue of something valuable, with a real reward. Once flown,
  a reboost or refuel can become a routine you never think about.
- **Running dry pauses; only a satellite parked too low to hold its orbit comes down, warned ahead** (W2, pillar 5;
  amended 2026-10-09, D6: the builder's lifetime readout makes a too-low orbit a visible design choice).

---

## The launch rail (the bottom rung; Caio, 2026-10-10, from D14)

Before any guidance, a launch can still be automated by **aiming it**. Japan's first satellite (Ohsumi, 1970) flew on
an unguided solid rocket from a tilted rail: the rail set the angle, and gravity did the pitch-over. In the gyro era
(SAS holds stability only) the player otherwise steers every ascent by hand; the rail turns a launch into a puzzle
solved **before** lift-off: choose the angle and the heading, then watch. Once it's right, it repeats without flying.

- **Any school, as a pad upgrade.** Physics never depends on the school (POWERS § schools), so the rail is a pad
  option for everyone. **Mountain's pads show one by default** (its history; POWERS 1.2.0 § School briefs).
- **What it takes:** small, **uncrewed** rockets that leave the rail fast: in practice solid stages with a high
  thrust-to-weight ratio and fins or spin for stability. A heavy, slow rocket droops off the end of the rail (the
  physics says so; the rollout screen warns). No crew: an unguided ride isn't for people, and the escape tower
  assumes a vertical launch.
- **How it flies:** the rocket starts at the rail's angle and heading and is held on the rail until it reaches its end
  (a few tens of metres), then flies free: fins, spin and the shape of the gravity turn decide where it goes.
  Staging can be on timers set at rollout (an early sequencer: no computer, a clock).
- **Fades with the eras:** once a mainframe can fly ascents, the rail is history (pillar 8); it stays for sounding
  rockets and nostalgia.
- **Sizes and numbers** (rail length, angle range, the thrust-to-weight floor) are the lane's to measure.

## Follow-ups (in QUEUE *Proposed*)

- **space:** re-tune station-keeping and decay so typical good designs outlast their era (v1.60/v1.64 numbers); a
  satellite's lifetime as a builder readout (with vehicle).
- **economy:** era-driven obsolescence as the reason to replace (service quality by the satellite's era); servicing
  contracts for valuable assets.
- **space / economy:** routines' window rules (Q49's registry and the pad calendar).
- **vehicle:** the launch rail (QUEUE Q228).
- **economy:** the automation ladder: which routines each compute era permits; crewed routines before onboard
  computers.

---

## Version history
- **1.0.0 (2026-10-09):** written and approved in one round: flying stays central, the automation ladder, windows,
  satellites replaced for upgrades.
- **1.1.0 (2026-10-10):** the launch rail as the ladder's bottom rung (Caio, from D14 2).
