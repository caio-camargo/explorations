# Launchpad — what still needs a human to try
**Version**: 0.1.2 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-08 · **Updated**: 2026-10-08 · **Status**: running checklist
**Purpose**: Everything built that nobody has played yet. The headless checks (`node test.mjs`) prove the numbers; this list is
for what only a person can judge: feel, difficulty, looks, whether a flow is findable and fun.

**How it relates to [`PLAYTEST.md`](PLAYTEST.md):** this list says *what to try*; PLAYTEST collects *what you noticed*. When a
row turns up a problem, file it in PLAYTEST (symptom + lead) and point the row at it.

**Marking a row:** put the result in the `#` cell: `✓ 12` (fine), `✗ 12 → P#15` (problem, filed as PLAYTEST #15), or
`~ 12` (tried, unsure; add a word in the row). Leave untried rows alone.

**Contract for coding sessions:** when you ship something a person should try, **add a row** here in the right area (next
free number, your session as owner) in the same commit as your NOTES section. When you change something a row describes,
fix the row. Don't delete tried rows; they are the record.

**Getting there fast:** most late-game rows need the tester menu: open `index.html?tester`, then F2 (or the TESTER badge
or the Esc menu): infinite money, full know-how, all tools, no ignition failures, instant stacking, epoch picker 1–5, world
date jumps, finish every job now. `refView(n)` reference scenes are in `views.js` (paste
`const s=document.createElement('script');s.src='views.js';document.head.appendChild(s)` in the console, then
`refView(n)`). Note: SAS modes depend on the computing era in a career (row 101). The epoch picker doesn't move the date,
so use *All tools* (it gives the best avionics) or the date jumps.

---

### Flight & physics

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 1 | Fly the Orbiter to orbit by hand: a short W tap, then follow the flight path | Program > BUILD > preset Orbiter > LAUNCH. A fresh career has only Stability (gyro era): re-aim the hold with the pitch keys. With the tester's *All tools* (or a world date past year 3), hold Prograde instead | You make your first orbit in 2–4 tries, not 20, and still have some Δv left. The pitch-over feels learnable | v1.0 / planet rescale / v1.46 | core |
| 2 | Judge how responsive the controls, zoom and frame rate feel | Any flight. Esc menu > perf readout on. Note which GPU it names | Turning and zoom don't feel laggy. If the readout names the Intel iGPU, check whether the game is still playable on it | v1.1 | core |
| 3 | Yank the Lunar hard at max-q (hold W for 3–4 s around 15–25 kPa) | Preset Lunar, launch, pitch hard at around 10 km | The breakup message says which joint failed, and it reads as something you caused, not random. A gentle ascent never breaks | v1.2 / v1.5 | core |
| 4 | Fly an Orbiter with the fin ring removed, then coast with SAS off | Builder: delete the fin ring. Check the stability margin before launch | The builder's negative margin warns you ahead of time. The rocket tumbles once it coasts without SAS, and you can see why | v1.2 | core |
| 5 | Watch the Heavy's boosters separate | Preset Heavy, launch, wait about 48 s | The boosters kick outward cleanly. The staging HUD and Δv readout make sense after the drop | v1.3 | core |
| 6 | Use physics warp (up to 100×) during an ascent and near the ground | Any ascent: warp up. Watch the auto-drop near the ground and when loads pass 70% | Warp drops back at sensible moments and doesn't keep kicking you back to 1× | v1.2 | core |
| 7 | Fly the Asparagus and stage on the "boosters empty — stage to drop them" prompt | Preset Asparagus | The prompt is noticeable and clear, and the A/B group lettering makes sense | v1.6 | core |
| 8 | Re-enter a bare pod from low orbit, then a shielded pod coming back from Selene | Orbiter to orbit, retro burn. Big Lunar for the shielded case. Watch the Heat HUD row | The bare pod survives from low orbit, and the shield clearly matters on a Selene return. The ablator and heat readouts are easy to follow | v1.7 | core |
| 9 | Land under parachutes, including over high ground | Passenger preset hop. Also bring a pod down over a 4–5 km plateau | The drogue opens, then the main below 3 km above the ground. Touchdown is about 6 m/s. The float down isn't tediously long | v1.12 / v1.29 | core / terrain |
| 10 | Compare the impact prediction (HUD time/speed, red path, X on the ground) with where you actually land | Needs the logbook fact "farthest from Tellus", or tester > All tools | The marker lands within the shown ± spread, and the spread shrinks once you have sampled the atmosphere | v1.8 / v1.12 | core |
| 11 | Save a flight as an autopilot, replay it, then take over mid-flight | Esc menu > Save as autopilot. On the pad, ▶ Autopilot. Press a control key during the replay | The replay matches the flight you recorded, and taking over feels seamless | v1.8 | core |
| 12 | Make an ascent procedure, then beat it | Hand-fly the Orbiter to orbit. Next flight: ▶ Procedure. Then fly a more efficient ascent yourself | The procedure reaches orbit by itself. A better hand-flown ascent replaces it and you get a news line about it | Procedures | bodies |
| 13 | Run the "Selene land" mission procedure | First fly Crewed Lunar to Selene and home by hand, then press the procedure button on the pad | The whole mission flies through the game loop, and it's watchable rather than a long wait | Procedures v2 | bodies |
| 14 | Build a lone side booster and set its cant with Balance | Builder: Sparrow core + one Condor radial; open the part options and use cant/Balance | The cant control is understandable. Uncanted flips, balanced flies straight. Is the reason clear to a player? | v1.22 | core |
| 15 | Fly with low know-how and live with ignition failures | Fresh career (tester "No ignition failures" off): fly new imported engines | A scrub on the pad or an upper stage that won't light reads as a reason, not a bug. Frequency feels fair, not punishing | v1.30 | economy |
| 16 | Point a launch at a city (change azimuth or staging) | Fly a dogleg toward a city on the map | Range-safety warning, HUD flag and headline appear in time; drop-zone verdicts after staging are understandable | v1.9 | core |

### Attitude control

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 101 | Fly the first three years on gyro-era SAS (Stability only) | Fresh career (no tester). Watch the SAS panel: Prograde & co. dimmed with a tooltip | A first orbit and a capsule return are a fair challenge on Stability + pitch keys, not a chore. If it's a chore: a pitch programmer for this era (NOTES v1.46) | v1.46 | control |
| 102 | See the analog autopilot (year 3) and the guidance computer (year 7) arrive | Tester with *All tools* off: world date +1 year until mainframes (~year 3), then onboard computers (~year 7). The builder's Control block names the avionics | The new modes appear and you notice; the "what comes next" line in the builder is clear | v1.46 | control |
| 103 | Turn big stacks in space on wheels alone, then with the engine lit | Orbiter / Lunar / Crewed Lunar in orbit, SAS Stability, aim 90° away; then the same with throttle up | Wheels-only turns are slow (Orbiter ~11 s, Crewed Lunar ~2½ min) but not maddening; lighting the engine snaps it round in 3–5 s. Is the reason clear? | v1.43 | control |
| 104 | Fill the wheels and unload them | Hold a pitch key in space with SAS off; watch the HUD `Wheels n% saturated` row; then a short burn, or RCS on past 80 % | The spin stops growing when full; the HUD row explains itself; a burn empties them; RCS only keeps them usable and you see the gas it costs | v1.43 | control |
| 105 | Fly steerable fins on a rocket and a probe dart | Builder: swap the Orbiter's fin ring for **Steerable fin ring**; or Probe core + Tank 1 t + Steerable fin ring + Sparrow | Coasting through the air it obeys SAS (the builder said "coasting holds"); in vacuum the fins do nothing. They look like fins (they don't move visibly yet) | v1.40 | control |
| 106 | Read the builder's Control block on several designs | Builder: Orbiter, Heavy, Sounding, Passenger, Lunar; then add a Reaction wheel (palette *Control*) | "holds / weathervanes / flips", roll and the turn times make sense to a player and change sensibly when you add parts | v1.43 | control |
| 107 | Feel the gimbal: hand-fly an ascent with SAS off, then on | Orbiter, keys only | The rocket answers the keys with a small, believable lag; no wobble under SAS on any preset (Lunar was the worst before the fix) | v1.40 | control |

### Building

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 17 | Build a rocket from scratch with snapping, radial attach, symmetry (X), line-end pull (C), radial decoupler (R) | Program > BUILD, empty design | Ghost snaps where you expect; green/red validity obvious; a new player can make a 2-stage + boosters rocket without help | v1.17 | builder |
| 18 | Pick up subtrees, Ctrl-copy, Shift-place-many, right-click options, undo/redo | Builder on any preset | Picking up the upper stage takes what you expect; undo never loses work; options menu not cluttered | v1.17 | builder |
| 19 | Read the joint-load overlay and cycle reinforcement / swap to an interstage | Lunar preset; right-click the Tank 8 t/decoupler joint | Overlay legible on the rocket; you can tell which joint is weakest and that the interstage fixes it | v1.5 / v1.17 | builder |
| 20 | Add radial fins, then "make root" on an engine and pick up the upper stage | Builder: Orbiter, part options > make root | Fins sit right on the skin; re-root behaviour is discoverable and not confusing | v1.18 | builder |
| 21 | Rearrange staging with the chip editor (◀ ▶ ⤵, automatic) | Heavy preset, staging panel under the toolbar | Hovering a chip lights the right parts; holding boosters to the core's drop shows the Δv cost; flight follows the order | v1.20 | builder |
| 22 | Read the Δv/TWR table and stability readouts as a newcomer | Any preset; especially the Crewed Lunar lander stage | Numbers make sense; the sea-level TWR column (Petrel lander "0.10") doesn't scare you off a fine design | v1.0 / Crew | builder |
| 23 | Read the cost line: imports, grey market, "New to us", trajectory study | Career as a resource state; Orbiter in the builder | One glance tells why the rocket costs what it does; line isn't a wall of text | v1.26 / v1.30 / v1.38 | economy |
| 24 | Put a payload in the cargo bay in the editor | Builder: Cargo bay + a 1.25 m module stacked on its floor | It's clear the payload is inside; check whether not knowing if it fits is a real problem | Phase B | sats |

### Launch sites & terrain

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 25 | Read the site picker and launch from a polar/high-latitude site | Picker above LAUNCH; pick Fenfen Polar Range, fly Orbiter | Site info is readable (lat, free speed, downrange, rail/barge); orbit comes out ~27–29° inclined | v1.27 | terrain |
| 26 | Try to pick a foreign site | Picker, sites abroad (⛔) | Refusal reason is clear; ship moves to the chosen pad without glitches | v1.27 | terrain |
| 27 | Launch from the Sea Platform and look at it from outside | Picker > Sea Platform; orbit the camera on the pad | Platform reads as a floating platform, not an island; judge whether a full land complex on a deck looks silly | v1.45 | terrain |
| 28 | Wait for a storm and launch into it | Tester: world date +1 d steps; check picker's sky line; launch | Scrub news explains the slip; an up-to-5-day slip feels like flavour, not a chore | v1.45 | terrain |
| 29 | Check the downrange warning | Picker on a site whose corridor crosses another power | Warning shows in picker and news; you understand what it means without reading NOTES | v1.45 | terrain |
| 30 | Look at the world from orbit and fly low over it | Orbit; then a sounding flight near mountains/coast | Ranges, fjords, volcanoes, coasts read as a real world; note haze, monotone ice peaks, pad terrace, smooth coast | v1.25 | terrain |
| 31 | Check frame rate in low grazing views over rugged hills | Fly low over mountains, perf readout on | Stays playable (watch the ~9 ms terrain cost on iGPU) | v1.25 | terrain |
| 32 | Visit cities by day and night | Fly near a city; tester date jumps for night | Lights on night side, streets up close, buildings within 60 km; nothing floats or pops | v1.9 / v1.10 | core |
| 33 | Land pods on slopes, ice, snow, sand, forest | Hop flights at different biomes (radar alt row names the ground) | Slides/tips/leans look natural, no jitter at rest; messages ("Toppled over on a 12° slope of taiga") are fair | v1.37 / v1.39 | terrain |
| 34 | Test-drive rovers in the Rover yard (home, then lunar trainer) | Program header > Rover yard; default two-seat rover; ramps and side slopes | Driving is fun, not fiddly; stalling at home vs climbing as trainer is understood; tip-overs feel earned | R1 | sats |
| 110 | Watch the Link row through a flight | Fly Orbiter; watch HUD "Link" on the climb, over the far side, and on re-entry | Names the station in view; "no station in view" past the horizon; "plasma blackout · recorder" in the hot part of re-entry; nothing flickers | v1.48 | terrain |
| 111 | Splash down far out, and land abroad | Sounding lob 600+ km to sea; another landing in a neighbour's land (tester: relations) | News says fished out / lost beyond reach / sent back / kept; the refund in the logbook follows it; it feels fair, not arbitrary | v1.48 | terrain |
| 112 | Fly a field-station and an aurora contract | Contracts (science); tester to finish setup | Briefs say where to go; landing on the named ground (radar row names it) completes it; aurora needs a long northward or southward lob | v1.48 | terrain |
| 113 | Read the disaster news for a while | Tester: date jumps with a camera satellite up | Disasters fit the place (no volcano by a plain, no wildfire in the desert); offers still come | v1.48 | terrain |
| 120 | Read the world on the map with the atlas | Map (M), then C: biomes, powers, off; in the modern look and in an early era's notebook/terminal map | Biomes, borders and coasts line up with the ground; names sit on their land; clouds don't hide it; the survey finishes in a few seconds without a stutter | v1.52 | terrain |
| 121 | Point at places with the atlas on | Map, atlas on; hover land, sea, borders, the night side | The readout names the right biome, power, height or depth; it stays under the pointer as the frame rate changes | v1.52 | terrain |
| 122 | Climb hard through max heating, then come home from orbit | Heavy or Asparagus to orbit, watching HUD "Link"; then a capsule entry | No "plasma blackout" on the climb (it was shown at Mach 3.5, PLAYTEST #17); the entry still blacks out in its fast, hot part | Q17 | terrain |

### Visuals & effects

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 35 | Inspect part close-ups for the 1950s–60s look | `refView(4)`–`(9)`; also new parts (camera, antenna, port, RCS, claw, probe core) in builder | Parts read as period hardware, details don't shimmer; foil looks like foil | Part visuals | visuals |
| 36 | Look at the rocket after an ascent and after an entry | Fly to orbit, come back; or `refView(12)`, `(13)`, `(14)` | Soot climbs from engines, char on the windward side, Petrel nozzle glows; reads as wear, not dirt | Flight marks | visuals |
| 37 | Watch liftoff on the pad: tower sized to the rocket, swing arms and hold-downs | Launch Sounding, Orbiter and Big Lunar; `refView(15)`–`(17)` | Tower height suits each rocket; arms swing back top-first, hold-downs tip out on time | Launch complex | visuals |
| 108 | Watch the service gantry roll back from a wide rocket | Launch Crewed Lunar and Asparagus from the pad (or `refView(18)` with them); watch the first 14 s | The gantry starts snug but never inside the boosters, and nothing passes through the rocket as it rolls away (the front girders are gone: does the open front still look like a structure?) | PLAYTEST #2 | tester |
| 109 | Put boosters on the diagonals and look at the hold-downs | Builder: radial boosters at 45° (or three around the core); launch | Posts stand clear of the boosters, arms reach the core between them, and they tip away at liftoff without crossing anything | Hold-downs follow the rocket | tester |
| 38 | Compare plumes at sea level, altitude and vacuum per engine | `refView(30)`–`(36)`; live ascent to 45 km | Tight bright at sea level, diamonds then gone with altitude, wide faint in vacuum; Sparrow colour plausible | Engine plumes | plumes |
| 39 | Watch the plume hit the pad and the ground cloud | Any launch at the pad; `refView(60)`–`(64)` | Flame goes down the channel, smoke pours out south; no flame through the deck | Plume meeting the ground | aerofx |
| 40 | Launch at night | Tester date jumps to night; `refView(65)`–`(67)` | Plume lights the hull, tower and ground pool; not blown out next to the nozzle | Plume light | aerofx |
| 41 | Watch ignition and shutdown closely | Launch; staging; throttle to zero; `refView(68)`–`(77)` | Green TEA-TEB flash visible, fuel-rich burst, orange tail-off, staging puffs and sparks; none look like bugs | Ignition / shutdown | aerofx |
| 42 | Re-enter shield-first and at an angle | Capsule entry; `refView(40)`–`(45)` | Glow builds 85→30 km, wake streaks behind, windward side lights on a tilted stage | Re-entry plasma | aerofx |
| 43 | Look for vapor cones around Mach 1 in a real ascent | Orbiter/Lunar ascent below 5 km; `refView(50)`–`(53)` | Collars appear briefly at the shoulders and read as condensation, not artifacts | Vapor cones | aerofx |
| 44 | Fly through and above the volumetric cloud deck | Launch on a cloudy day; `refView(80)`–`(83)` | Clouds have depth at launch; no visible pop where volume hands over to the shell (~40 km) | Clouds with depth | aerofx |
| 45 | Look at the smoke trail and cloud horizon | Ascent seen from the pad; orbit view of the limb | Smoke column has lit/shadow sides, no blobs at the plume tip; no bright line at the horizon | v1.10 / v1.11 | core |
| 46 | Trigger the escape tower, Selene landing dust and an explosion | Backspace abort; land a Wren on Selene; crash anything; `refView(84)`–`(93)` | Tower motor has a smoke column; dust sheet visible on descent; explosion reads as fireball then smoke | Effects for new features | aerofx |
| 47 | Check frame rate in the heaviest FX scene | Heavy at night on the pad, perf readout on | Still playable on the RTX and tolerable on the iGPU (≈26 ms measured there) | Performance pass | aerofx |
| 48 | Read the HUD gauges in flight | Ascent and entry; `refView(94)`–`(96)` | Altitude tape, air column, q dial with max-q pointer, Mach drum, heat bar readable at a glance (layout is PLAYTEST #9) | HUD gauges | aerofx |
| 49 | Fly past a saved satellite; look at Nyx from the ground and space | Orbit near a registered Lookout (diamond marker); Nyx in the sky | Satellite mesh keeps its marks and attitude; Nyx looks brown and distinct from Selene | Satellites in 3D / Nyx | sats / bodies |
| 114 | Listen to a launch, staging, a chute and a crash (sound on: F4 toggles) | Any preset from the pad to orbit; a Sounding lob home; a crash. Click once first (browsers start audio on a gesture) | Roar loudest on the pad, buffet near Mach 1, wind peaks at max-q, darker and fainter as the air thins, only a structure hum in vacuum; thunks at separation, a whoomp at the chute, a far blast heard late. Too loud/quiet or annoying is a finding | Sound | sound |

### Orbits & planning

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 50 | Plan and fly a Selene transfer with a maneuver node | Orbit; M map; click orbit or N; drag handles / ± panel; Warp to burn; SAS Maneuver (needs the guidance computer: tester *All tools*, or a world date past year 7) | Handles feel controllable (drag rate not twitchy); warp lands before the burn; you arrive at Selene without trial-and-error | v1.4 | core |
| 51 | Hit each tool gate before it unlocks | Fresh career: try N in orbit, look at impact row and Selene path | Refusal messages say what to do; logbook "→ will unlock" makes the path obvious | Logbook | planning |
| 52 | Watch the map and logbook change look by era | Fresh career (notebook), then after first orbit (terminal); "modern look" checkbox | Notebook and terminal styles are charming and still legible; switching is noticed | Logbook | planning |
| 53 | Use the logbook's record designs | F logbook > a record > Copy this design / LOAD DESIGN | Flow is discoverable; loaded design flies its record tape | Logbook | planning |
| 54 | Read encounter forecasts at Selene and Nyx | Transfer toward Selene; high orbit near Nyx before/after discovery | Ghost SOI and labels clear; Nyx shows "?" until weighed; "(perturbed)" legs understandable | Bodies / 6b | bodies |
| 55 | Put a prograde and a retrograde orbit around Nyx | Epoch 5 via tester; fly to Nyx; watch map | Map warns "Impact in … (perturbed)" for prograde; player can learn retrograde is the answer | 6b | bodies |
| 56 | Rendezvous with a satellite | G to cycle target; map closest approach; Target/Rel ret SAS modes (guidance computer) | Readouts (Target, Closest) enough to close to <1 km in reasonable time; navball marks readable | Rendezvous | sats |
| 57 | Compare an unstudied and studied design's impact spread | Assembly "Trajectory: unstudied ±30% [Study…]"; order study; fly a sounding near a city | The wider spread is visible and you understand why a study helps | v1.38 | economy |

### Docking & stations

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 58 | Translate with RCS (V on, I/K J/L U/O) | Stage with RCS quads + gas bottle in orbit | Keys feel natural despite differing from KSP; puffs show; gas Δv row helps | RCS | sats |
| 59 | Dock to a port using Port / Line up rows and Docking SAS | Satellite with a port in orbit, or two-port flight; G target | A first docking takes minutes not an hour; latch snap of last ≤15 cm doesn't look broken | Docking port | sats |
| 60 | Undock, and grab/release with the claw | HUD Docked row; Claw part on a stage, approach <1 m/s | Push-off looks right; claw grab holds attitude; release works | Docking port / Claw | sats |
| 61 | Bump a satellite at 1 m/s, then 6 m/s | Rendezvous, approach without docking | Bounce and spin look plausible; the antenna snapping off reads as damage | Contact | sats |
| 62 | Split a flight into two vessels and switch | Design with a probe core above a decoupler; stage in orbit; ] / [ | Vessels row and markers clear; you never lose track of which you fly | Phase A | sats |
| 63 | Open the cargo bay doors and release a payload | Cargo bay design; B or HUD Bay row in orbit | Doors look fine mid-swing (noted as odd); payload drifts out cleanly | Phase B | sats |
| 64 | Build a small station: hub with radial ports, habitat, lab, crew visit | Several flights (tester: infinite money, instant stacking); Docking mode on side ports | Side-port docking (roll included) works; Program panel station line shows crew, supplies, lab-days | Phase C | sats |
| 65 | Rotate a crew: Fly the station, undock the capsule, bring it home | Program > Fleet > station > Fly | Flow is findable; crew carries over; nothing gets lost across flights | A2 | sats |
| 66 | Grapple, berth and stow with the arm | Arm on a hub; module within 10 m <0.5 m/s; HUD Arm row | Arm motion looks right (no obvious clipping); berth/stow is satisfying, not slow | D | sats |
| 67 | Found a moonbase: beacon lander then a module landed nearby | Epoch 4+ via tester; G targets landed object; HUD Landing row | Landing near the target is achievable with the row; base shows in Fleet tab | E | sats |

### Moons & crew

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 68 | Do the Selene ladder: far side photo, impactor, soft landing, sample return | Tester epoch 4; Lunar / Big Lunar presets | Each goal is clear in the mission list; far-side downlink waiting for line of sight is understandable | Out there | bodies |
| 69 | Land on Selene by hand (<4 m/s) | Big Lunar or Crewed Lunar | Suicide burn is learnable; impact prediction and radar alt are enough; dust helps judge height | Out there / Crew | bodies |
| 70 | Run a pad abort and a max-q abort | Crew capsule + escape tower design; Backspace near pad and at ≥15 kPa | Abort is dramatic and survivable; mission messages explain dummies vs crew | Crew | bodies |
| 71 | Fly Crewed Lunar to Selene and home by hand | Preset Crewed Lunar after tower qualified (tester epoch 4) | Possible in a sitting; the ~800 m/s margin feels fair; the shallow turn needed is discoverable. Turns on wheels alone are slow (row 103): burn or use RCS | Crewed Lunar | bodies |
| 72 | Discover Nyx by tracking | High orbit (~1.3× Nyx distance or near Nyx) with instruments + antenna for 12 h | Player can figure out where to go from the mission text; reveal (name, orbit, SOI) feels like a payoff | Out there | bodies |
| 73 | Land on Nyx (<3 m/s) | Tester epoch 5; fly to Nyx | Low gravity landing is fun, not bouncy chaos | Out there | bodies |
| 74 | Fly the epoch 3 utility sats: polar weather, TV stationary, disaster watch, navigation | Tester epoch 3 | Plane change cost felt; TV drift-out news is a fair nudge; nav phasing lesson discoverable | Epoch 3 | bodies |

### Program & economy

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 75 | Start a new career through "Whose program?" / "How does it start?" | Fresh page (no save) | Choices understandable (archetype, agency/company/consortium); Build disabled until chosen isn't confusing | v1.16 / v1.24 / UI slice 2 | economy / ui |
| 76 | Play epochs 1–2 from scratch without the tester | Fresh career; sounding, passenger, beeper, orbit | First orbit by ~day 130–170; money tight but no dead end; race with rivals feels tense not hopeless | v1.12 / v1.28 | economy |
| 77 | Check the budget gate and recovery refund | Try a preset you can't afford; recover a Sounding flight | OVER BUDGET clear; refund headline (incl. "came back as scrap") understood | v1.13 / v1.14 | economy |
| 78 | Feel the stacking days between launches | Normal career launches (33 d Orbiter) | Waiting doesn't feel like dead time; timeline gives something to do | v1.28 | economy |
| 79 | Work the contract board | Program > Inbox/Contracts; Take / Pass | Offers readable; one flight completing several contracts feels rewarding; capacity limit clear | v1.15 | economy |
| 80 | Take a military or foreign contract with sanction risk | Contracts with "⚠ … sanctions us" | Risk shown before taking is clear; consequences (leak, sanctions) arrive with explanation | v1.19 | economy |
| 81 | Respond to ownership decisions (privatization, foreign stake, rescue) | Advance time after two firsts; tester date jumps | Decision text explains trade-offs; expiry deadlines noticed | v1.16 | economy |
| 82 | Experience power flavours: election, closed-regime demands, commodity cycle | Start as open superpower vs closed superpower / resource state; advance a year | Each start plays noticeably differently; election warnings not missed | v1.24 | economy |
| 83 | Try to get a career move (defection / private hire) | Run a bad career (top-ups, low opinion); tester can't set funds yet | Reachable at all in normal play? Offer and its consequences understandable | v1.21 | economy |
| 84 | Read know-how bars and gain know-how by flying | Program > Industry > Know-how | Bars move noticeably on new regimes; "New to us" warnings make sense | v1.30 / v1.32 | economy |
| 85 | Set up an own line vs a license | Industry > Production on an imported part | Cost/days/reason text clear; price drop with maturity felt over flights | v1.31 | economy |
| 86 | Build the test stand, run qualification and to-destruction | Industry > Test stand; tester Finish every job | Worth doing? Know-how/cert gains visible; 1.5M/day burn noticed | v1.33 | economy |
| 87 | Order a development project (cheaper/reliable/durable) | Industry > Development on a home-made part ≥50% know-how | Requirements and payback understandable; redesign know-how loss not a surprise | v1.34 | economy |
| 88 | Build the integration hall and recovery fleet | Industry > Facilities | Stacking speed-up and salvage headlines visible; fleet value understood | v1.35 | economy |
| 89 | Play 2–3 in-game years and judge money | Normal career or tester date +1 year steps with flights | Neither broke all the time nor drowning in cash; sinks feel like choices | v1.36 / v1.41 | economy |
| 90 | Watch compute eras arrive and use the computing centre / studies | Tester date jumps toward year 3 and 7 | Era news noticed; studies queue understandable; studying ahead pays off visibly | v1.38 | economy |
| 91 | Use "Coming up" to wait for events | Program > Inbox > Coming up; Wait / Wait until then | Waiting stops before deadlines; feels like a useful time control, not a list | v1.42 | economy |
| 92 | Get staged pay on a Selene mission | Far side mission flight | 20% on course / on arrival news appears at the right moment; mission list "(N paid)" clear | v1.44 | economy |
| 93 | Build ground stations at home and abroad | Program > Fleet > ground stations | Reason for refusal and lease costs clear; contact-time value understandable | Ground stations | planning |
| 94 | Use a camera satellite for imaging contracts and disasters | Camera + antenna sat in polar orbit; take image contracts | Waiting for daylight/clouds/downlink feels sensible; disaster offers arrive and are doable | Orbital registry | planning |

### UI & screens

| # | Try this | How to get there | Looks right if | From | Owner |
|---|---|---|---|---|---|
| 95 | Walk every Program tab | Program screen (on load) | Each section in the tab you'd look for; nothing in "More"; Inbox shows what needs action | UI slice 2 | ui |
| 96 | Use Esc menu, Help (H), Logbook (F), Program (P), Build (B) | All screens | Overlays stack/close sensibly; Revert asks twice in the air only; Help lists the right keys | UI slice 1 | ui |
| 97 | Finish flights several ways and find out what happened | Land, crash, end in orbit | Without a Debrief screen, can you tell what you earned/lost from the news ticker? (decide Debrief priority) | UI spec | ui |
| 98 | Fill the HUD info list in a busy flight | Docking + RCS + target + several vessels at once (+ the Wheels row) | Rows stay readable and don't run into the staging list | UI spec | ui |
| 99 | Read the headline ticker over a session | Any career | Tone is light, lines readable, important news not lost among flavour | v1.9 | core |
| 100 | Exercise every tester menu control | `index.html?tester`, F2: each toggle, epoch 1–5, date jumps, finish jobs, copy career in, wipe | Each does what it says; career save untouched; epoch picker leaves a playable state | Tester menu | tester |

Next free number: **123** (rows 115–119 are on `main` from sats and control).
