# Launchpad — the presets-only playtest route
**Version**: 0.1.4 · **Author**: Caio Camargo + Claude (QA session) · **Created**: 2026-10-08 · **Updated**: 2026-10-09 · **Status**: draft, ready to play
**Purpose**: An order to play [`TESTING.md`](TESTING.md) in using **only the eleven presets**, so Caio can play before
the construction screen is easy for a newcomer (QUEUE Q54; it covers W8, the human playtest for M1). Each step names its
TESTING rows. The rows hold the full "looks right if" text. This file is only the order and the setup.

**Rules of the route**
- Pick a preset and LAUNCH. Never place a part. Reading the builder's panels for a preset is fine (sitting 7).
- **Judge what a machine can't judge**: feel, difficulty, whether something is clear, whether it's fun. Where the robot
  has already measured a row (`(robot)` in TESTING), that row is listed only when it says *needs a human*.
- **Marking:** put the result in the row's `#` cell in TESTING.md: `✓ n`, `~ n` plus a word, or `✗ n → P#…`. Or just
  tell the playtest intake session what you noticed ("you are the playtest feedback session"), and it files the items.
- Sitting 1 is the one M1 is about. Do it first, and **again** once flow's M1 items land (Q39 Esc pause,
  Q40 next contract, Q41 first-run sentences; the Debrief, Q2, has landed). The other sittings can go in any order. Each one says how long it takes.

**Where to play:** <https://caio-camargo.github.io/explorations/explorations/launchpad/index.html> (what's on `main`), or
locally `python -m http.server 8799 --directory C:/Users/caioa/dev/explorations/explorations` and
`http://localhost:8799/launchpad/index.html`. Add **`?tester`** for sittings 2–7. The tester has its own save and never
touches the career.

**Tester setup (sittings 2–7), once:** F2 → *Infinite money*, *Full know-how*, *All tools*, *No ignition failures*,
*Instant stacking* on. Esc menu → perf readout on. Click once on the page and press F4 for sound. While you're in the
menu, try each control once (row **100**, robot ✓; it's on W8's list).

---

## Sitting 1 — the first hour, as a new player (no tester, ~60 min)

Plain URL, no `?tester`. If you have a career save, play it in a private window instead, so the save stays as it is.

| Step | Do | Rows |
|---|---|---|
| 1 | Start a career: read "Whose program?" / "How does it start?" as if you'd never seen them | 75 (robot ✓: here it's about whether you *understand* the choices) |
| 2 | Look round the Program tabs and the contract board; take one or two contracts | 79 (*needs a human: rewarding*), 99 |
| 3 | BUILD → preset **Sounding** → read the cost line and the Δv table, ROLL OUT, LAUNCH. Watch the know-how and the logbook after you land | 23, 22, 84 |
| 4 | **Passenger**, then **Hopper** hops. Fly with ignition failures on (that's the career default) | 15, 9 |
| 5 | **Beeper** to orbit for *The beeper*, then **Passenger Orbiter**: once round and home for *Passenger: one orbit* (both v1.73 presets, the Orbiter's launcher with the payload in the pod's place). Gyro-era SAS (Stability + pitch keys only). Count the tries | **1**, **101**, 147 |
| 6 | Between launches: the stacking days, "Coming up", Wait | 78, 91 |
| 7 | End flights three ways (land, crash, end in orbit; ☰ → End flight in orbit). Read the Debrief each time: can you tell what you earned or lost? | **97**, **127** |
| 8 | Overall: where were you stuck, where were you bored, did the money feel tight but fair? | 76 |

**The first-orbit missions can be flown on presets** since v1.73 (PLAYTEST #24): the Beeper reaches orbit with ~1.5 km/s
to spare; the Passenger Orbiter goes once round and lands at ~4 g. The career moves past epoch 1 on presets alone now,
so judge the progress as well as the flying.

Write the answer to step 8 down even if it's one line. It's M1's finish line ("where they got stuck or bored is
written in PLAYTEST").

## Sitting 2 — around home: hops, sites, the world (tester, ~40 min)

| Step | Do | Rows |
|---|---|---|
| 1 | **Sounding** lob: watch the impact X and its ± spread; aim the next one at a city on the map | 10 (spread not yet checked), **16** |
| 2 | **Sounding** lob 600+ km out to sea; then one that lands in a neighbour's country | 111 |
| 3 | **Passenger** down under chutes with warp: does the float feel too long? | **9**, 6 |
| 4 | **Hopper** hops from sites with different ground (slope, ice, sand, forest; the radar row names it) | **33** |
| 5 | **Hopper** or **Sounding**, low over mountains and a coast, perf readout on | **30**, **31** |
| 6 | Near a city by day, then a date jump to night | 32 |
| 7 | Picker → **Sea Platform**; orbit the camera round the pad. Silly or fine? | **27** |
| 8 | Program header → **Rover yard**, the default rover: ramps, side slopes, trainer mode | **34** |
| 9 | Map (M), C for the atlas: biomes, borders, hover over places | 123, 124 |

## Sitting 3 — big rockets and the ascent (tester, ~30 min)

| Step | Do | Rows |
|---|---|---|
| 1 | **Heavy** from the pad: booster separation, the smoke column seen from the pad, Link row on the climb (no "plasma blackout" now) | 5, 45, **122** |
| 2 | **Asparagus**: is the "boosters empty, stage to drop them" prompt noticeable enough? | **7** (*needs a human*), 122, 108 |
| 3 | **Heavy** at night on the pad, perf readout on: still playable? | **47**, 40 |
| 4 | **Lunar**: hand-fly with SAS off, then on; then yank it hard at max-q (W for 3–4 s around 15–25 kPa) | 107, **3** |
| 5 | Any flight: how do the controls, zoom and frame rate feel? | **2** |
| 6 | Sound on: a launch, staging, a chute, a crash | **114** |
| 7 | Some quick refView looks, if you want them (TESTING header says how): 4–9 parts, 30–36 plumes | 35 |

## Sitting 4 — Orbiter in orbit and home again (tester, ~30 min)

| Step | Do | Rows |
|---|---|---|
| 1 | **Orbiter** to orbit with Prograde hold (All tools). Then **Esc → Save as autopilot** | 1, 11 |
| 2 | In orbit, SAS off: hold a pitch key until the wheels saturate, then a short burn. Does the HUD row explain itself? | **104** (fixed since the robot's ✗, P#18) |
| 3 | SAS Stability: a 90° turn on wheels only, then the same with the engine lit | **103** |
| 4 | SAS off: hold roll a while, then tap pitch: does the stage cone instead of turning over? Then SAS on | **119** |
| 5 | Retro burn, the bare pod home from low orbit: are the heat readouts easy to follow? | **8** (low-orbit half) |
| 6 | On the pad: ▶ Autopilot, press a key midway. Is taking over seamless? | **11** (*needs a human*) |
| 7 | Next flight: ▶ Procedure. Then hand-fly a better ascent and look for the news line | **12** |

## Sitting 5 — Selene (tester epoch 4, ~90 min, can split)

| Step | Do | Rows |
|---|---|---|
| 1 | **Probe** to orbit; plan the transfer with a maneuver node (N, drag the handles); warp to the burn; Maneuver SAS | **50**, 54 |
| 2 | Same flight: far-side photo (downlink waits for line of sight), then the impactor. Watch for the staged-pay news | **68**, 92 |
| 3 | **Big Lunar**: land on Selene by hand, under 4 m/s | **69** |
| 4 | **Big Lunar** or **Sample Return** home, shield first: does the shield clearly matter? | **8** (Selene half), 68 (sample return) |
| 5 | **Crewed Lunar** on the pad: Backspace at the pad, then again at ≥ 15 kPa | **70**, 108 |
| 6 | **Crewed Lunar** to Selene and back by hand, in one sitting | **71** |
| 7 | On the pad afterwards: ▶ the "Selene land" procedure, and the re-fly to the spot you landed on | 13, 125 |

## Sitting 6 — satellites, contracts, Nyx (tester, ~60 min)

**Park high: orbits decay since v1.64.** Between flights the thin upper air drags on everything left in orbit. A dry
Probe-sized satellite lasts under an hour at 110 km (the usual parking orbit), ~5 days at 150, ~70 at 200, ~a year at
250 and ~3 years at 300 km. Anything that must still be up later in this sitting goes to **250–300 km**, or keeps some
propellant to hold itself up (~0.09 m/s a day at 200 km). The Program line says how long each one has. Missions and
contracts complete during the flight, so a low reconnaissance orbit still pays; it just doesn't last.

| Step | Do | Rows |
|---|---|---|
| 1 | Epoch 3: the utility sats (polar weather, TV stationary, disaster watch, navigation), all with the **Probe** | **74** |
| 2 | A camera **Probe** in polar orbit at ~300 km (it has to survive the date jumps): imaging contracts; then date jumps and read the disaster news | 94, 113, 140 |
| 3 | Fly a **Probe** to the orbit of a sat contract, then dispatch that contract and watch it fly. For a deviation turn off *Full know-how* (an unknown upper engine may not relight) and press Take control | **120** (the "one tank short" half needs the builder) |
| 4 | Field-station and aurora contracts (Hopper, Sounding) | 112 |
| 5 | Orbit near a saved satellite (diamond marker; one parked above ~250 km in an earlier flight, so it's still up) and fly past it; G to target, close the distance | 49, 56 |
| 6 | Epoch 4: the far-side flight shouldn't find Nyx; a **Probe** to ~25,000 km should weigh it in 12 h. Is the reveal a payoff? | **72**, **121** |
| 7 | Epoch 5: look at Nyx from the ground and from space; a prograde and a retrograde orbit round it; land under 3 m/s | 49, **55**, **73** |

## Sitting 7 — the program with the tester (~30 min, no flying)

| Step | Do | Rows |
|---|---|---|
| 1 | Three new sandboxes (Fresh, twice): open superpower, closed superpower, resource state; a year of date jumps each. Do they *play* differently? | **82** |
| 2 | Ownership decisions after two firsts; a contract with ⚠ sanctions | 81, 80 |
| 3 | Run a bad career (no *Infinite money*) and see whether a career move turns up | 83 (tester → *Set funds*) |
| 4 | Industry: test stand (turn *Full know-how* off to see the gains), study a trajectory, read the spreads | **86**, 57 |
| 5 | Fleet → ground stations at home and abroad; a refusal | **93** |
| 6 | Logbook (F): a record, Copy this design, LOAD DESIGN, fly its tape | 53 |
| 7 | Builder panels, reading only: the Control block on Orbiter, Heavy, Sounding, Passenger, Lunar; the eras arriving with date jumps (*All tools* off) | **106**, **102** |
| 8 | Two to three in-game years of flights and date jumps: neither broke nor drowning? | 89 |

---

## Not on this route

- **Need the builder** (after the vehicle lane's newcomer pass, ROADMAP M1): 4, 14, 17–21, 24, 105, 118.
- **Need docking ports or RCS, which no preset has**: 58–67, 98, 116. Rover science on Selene needs a built rover: 115, 117.
- **Can't be reached**: 29 (the only downrange warning is on a foreign site you can't launch from).
- **The robot already judged them, and they need no human feel** (glance at them as they come up): 5, 6, 25, 26, 28, 36–44,
  46, 48, 51, 52, 77, 84, 85, 87, 88, 90, 95, 96, 100, 107–110.
