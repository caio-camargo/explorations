# Launchpad — tech scouting (real advances to mine for ideas)
**Version**: 0.1.0 · **Author**: Caio Camargo + Claude · **Created**: 2026-10-08 · **Updated**: 2026-10-08 · **Status**: idea bank
**Purpose**: Real recent advances and near-future concepts in rocketry and spaceflight, each with a possible game hook.
Not a plan. Status as reported by news searches on 2026-10-08; most dates are company or agency targets, not facts.
Promising items graduate to `PLAYTEST.md` (as design items) or NOTES backlog.

**Maturity:** 🟢 flying or flown · 🟡 hardware on the ground / demo booked · 🔴 concept or study

---

## Propulsion

| Tech | Real status (Oct 2026) | Game hook |
|---|---|---|
| **Fusion drive** 🟡 | Pulsar Fusion *Sunbird* confined plasma in an exhaust test (Apr 2026); UKAEA does its shielding modelling; DIU funds compact fusion propulsion and wants an orbital prototype in 2027. Helicity Space got a NIAC award (2025) for a fusion-drive constellation. | Late-game era tech: very high Isp, modest thrust, heavy shielding and power. The answer to long trips (PLAYTEST #12, #14). Needs low-thrust propagation. |
| **Nuclear thermal (NTR)** 🔴 | DARPA/NASA's DRACO flight demo was **cancelled** (FY2026 budget); NASA NTP and NEP research got no funding. The stated reason: once launch got cheap, nuclear's efficiency gain stopped paying for its R&D. Fuel tests continue (BWXT, ~3000 K). | Mid-game: about 2× chemical Isp, heavy engine, launch politics (a reactor overflying towns, leaks, sanctions). **The cancellation itself is the best hook:** the economy decides which techs are worth it, so a cheap-launch world can kill nuclear, while a power with expensive launch keeps it. Tech paths that depend on the world, not a fixed tree. |
| **Nuclear electric (NEP)** 🔴 | Unfunded in the US alongside NTP. | Reactor + ion engines: the low-thrust deep-space workhorse. Shares the low-thrust propagation work with fusion. |
| **Rotating detonation engine (RDRE)** 🟡 | Ground hot-fires (Venus Aerospace, Sep 2026 with a new fuel); Juno Propulsion aims at the first in-orbit RDRE test, NASA-funded, later in 2026; GE/Lockheed ramjet version for hypersonic missiles. | A development project on an existing engine: +Isp for the same propellant, but rough running (vibration loads on the joints, which the sim already models) and lower reliability until learned. Fits know-how and certification (v1.30, v1.33). Military variant fits military contracts. |
| **Solar / laser sails** 🔴 (solar 🟢 historically) | No new 2026 sail missions; lab work on metasurface sails; Breakthrough Starshot remains a concept (a 100 GW ground laser array). | Solar sail: free, endless, tiny thrust, falls off with distance from the sun. A laser sail is a **ground facility** (capital construction) that drives sails on command: an interstellar-probe flagship project for the very late game. |

## Getting to orbit

| Tech | Real status (Oct 2026) | Game hook |
|---|---|---|
| **Reusable upper stages** 🟡 | Starship's upper stage survived entry and splashed down intact (Flight 13, Jul 2026); tower catch delayed; first reflight targeted late 2026/early 2027. ESA–Avio (€40M) and CNES DEMESURE study reusable upper stages; Blue Origin is debating New Glenn's. | Extends the recovery fleet (v1.35) from stages at sea to whole vehicles: the upper stage needs a heat shield, fuel reserve and fins, so a payload-vs-reuse trade. A **tower catch** is great pad content (the complex already has a tower and swing arms). |
| **Kinetic launch (SpinLaunch)** 🟡 | Suborbital test accelerator built; orbital accelerator (100 m) slipped to 2027+; its own satellites now fly on ordinary rockets. | A launch-site facility for small, g-hardened payloads only: cheap per launch, expensive to build, and a site choice (they're looking at a remote Alaskan island). Parts get a g-tolerance rating. |
| **Skyhook (rotating tether)** 🔴 | Concept only (TRL 2); NASA–Boeing HASTOL study (2000–01) projected $300–1,000/kg. No company found. | Late-game megaproject: a rocket only needs to reach the hook's tip speed, then gets thrown to orbit. Every catch costs the hook momentum, so it needs reboosting. Real orbital mechanics, very KSP. |

## In space

| Tech | Real status (Oct 2026) | Game hook |
|---|---|---|
| **Propellant depots / refuelling** 🟡 | Orbit Fab depot + Astroscale refueller to GEO for the Space Force (booked mid-2026, slipped before); Starship ship-to-ship transfer of ≥10 t targeted late 2026; Quantum Space depot contract (Jun 2026). | Needs docking and persistent objects (already in the infrastructure list). Then: depots as stations you build, fuel as a sellable commodity, refuelling contracts. Changes how Δv budgets work (Crewed Lunar would stop needing 127 t). |
| **Inflatable heat shields / aerocapture** 🟡 | LOFTID flew (NASA, 2022); 2026 papers model inflatables for lunar-return aerocapture. | A part: big diameter on a small mass, deployed before entry. Aerocapture as a manoeuvre: brake into orbit through the atmosphere instead of burning (the re-entry heating sim already handles the physics). |
| **Lunar ISRU (oxygen, water)** 🔴 | ESA's demo (aimed at 2025) not confirmed flown; Italy's ORACLE made water from simulant in the lab; NASA is soliciting oxygen-extraction demos. | Fuel made on Selene: a surface base that feeds depots. Pairs with the science logbook (where is the ice?). |
| **In-space manufacturing and assembly** 🟡 | Commercially closest of the "new space" sectors (pharma, semiconductor precursors in microgravity). Large assembly lags: everything still has to fit in a fairing. | Microgravity factory contracts (recurring income from a station). Orbital assembly removes the fairing limit for megaprojects. |

## Power and compute

| Tech | Real status (Oct 2026) | Game hook |
|---|---|---|
| **Orbital data centres** 🟢 (first nodes) | Axiom's first two nodes in LEO (Jan 2026, Kepler optical relay); Starcloud, Google Suncatcher, ESA ASCEND (2028); SpaceX reportedly showed a 120 kW compute satellite (single source). Limits: radiation and cooling. | Fits the planned **AI era** (NOTES, economy: world demand for compute explodes and it gets scarce) and the compute eras (v1.38) directly: launch your own compute, then sell it or use it for trajectory studies. Radiators as a real part. |
| **Space-based solar power** 🔴/🟡 | Aetherflux kW-class infrared-laser demo on a 2026 rideshare; Japan's OHISAMA ~1 kW demo, aiming at 1 GW within 25 years. Launch is >90% of lifecycle cost (NASA 2024). | A flagship that only pays off once launch is cheap enough: the economy decides when it's worth it (the same lesson as DRACO, in reverse). A beamed-power receiver is also a military/political worry. |

---

## Patterns worth keeping
- **Economics picks the technology.** DRACO was killed by cheap launch, SBSP waits for it, kinetic launch retreated to rockets. Let tech viability depend on the world's launch cost, not a fixed tree.
- **Schedules slip.** Nearly every 2026 target above slipped at least once. Development projects in the game could slip too, especially for new technology.
- **Military money funds firsts** (DIU fusion, Space Force refuelling, RDE ramjets). That fits the existing military contracts and sanctions.

## Sources
- Fusion: [Electronics360](https://electronics360.globalspec.com/article/23767/fusion-rocket-test-paves-way-for-superfast-interplanetary-travel), [ANS on DIU](https://ans.org/news/article-3978/defense-agency-invests-in-fusion-and-radioisotopepowered-space-propulsion), [NASA NIAC 2026](https://www.nasa.gov/general/niac-2026-selections/)
- Nuclear: [DRACO (Wikipedia)](https://en.wikipedia.org/wiki/Demonstration_Rocket_for_Agile_Cislunar_Operations), [What was DRACO (newspaceeconomy.ca, Mar 2026)](https://newspaceeconomy.ca/2026/03/15/what-was-the-darpa-draco-program/), [The Space Review](https://thespacereview.com/article/5028/1)
- RDRE: [Purdue / Juno](https://engineering.purdue.edu/AAE/spotlights/2026/startup-alumnae-rdre), [Lockheed–GE ramjet](https://www.lockheedmartin.com/en-us/news/features/2026/ready-to-fly-faster-farther-and-at-lower-cost-GE-Aerospace-and-Lockheed-Martin-demo-rotating-detonation-ramjet.html)
- Sails: [ScienceBlog, laser array](https://scienceblog.com/t-laser-array-gram-spacecraft-20-percent-light-speed-directed-energy-propulsion/), [Centauri Dreams](https://www.centauri-dreams.org/2025/02/27/experimenting-on-an-interstellar-sail/)
- Depots: [Starship propellant transfer](https://en.wikipedia.org/wiki/Starship_Propellant_Transfer_Demonstration), [Air & Space Forces](https://www.airandspaceforces.com/space-force-satellite-refueling-demos/), [Quantum Space](https://www.chartmill.com/news/external/48779/prnews-2026-6-18-quantum-space-awarded-a-department-of-war-contract-to-advance-on-orbit-refueling-capabilities)
- Skyhook: [Orbit Codex](https://orbitcodex.com/knowledge-base/skyhook)
- Launch: [SpinLaunch (The Space Bucket)](https://thespacebucket.com/is-spinlaunch-making-progress-on-an-orbital-accelerator-2/), [Avio upper stage (The Register)](https://www.theregister.com/2025/10/02/esa_avio_upper_stage/), [CNES DEMESURE](https://europeanspaceflight.com/cnes-to-develop-reusable-upper-stage-for-heavy-lift-rocket/), [Starship catch delay](https://www.newsbytesapp.com/news/science/spacex-delays-starship-tower-catch-test-for-a-few-months/tldr)
- Entry: [ESA inflatable aerocapture](https://nebula.esa.int/content/inflatable-systems-aerocapture-and-aerobraking)
- ISRU / manufacturing / SBSP: [ESA ISRU demo](https://exploration.esa.int/web/moon/-/60127-in-situ-resource-utilisation-demonstration-mission), [Payload: State of ISAM 2026](https://payloadspace.com/the-state-of-isam-2026/), [Interesting Engineering on SBSP](https://interestingengineering.com/innovation/space-based-solar-power-by-2026)
- Compute: [Introl, first orbital nodes](https://introl.com/fr/blog/orbital-data-center-nodes-launch-space-computing-infrastructure-january-2026), [DataCenterNews, Orbital](https://datacenter.news/story/orbital-raises-usd-5-million-for-ai-compute-satellites)
