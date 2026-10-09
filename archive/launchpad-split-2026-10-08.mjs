// The one-time split of explorations/launchpad/index.html's script into classic scripts (platform session, 2026-10-08;
// launchpad NOTES § "The file split"). Kept for the record. Run from the repo root:  node archive/launchpad-split-2026-10-08.mjs
// Cuts at header lines found by their text (not line numbers), so it re-runs on a newer main. Each file after the first
// gets a two-line prelude (what it is; 'use strict', which a classic script doesn't inherit). Verifies that the page put
// back together (page.mjs) equals the old index.html minus exactly those preludes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const DIR = 'explorations/launchpad/';
const BAR = '// ============================================================ ';
// [file, the line it starts at (prefix match), what it holds]
const PARTS = [
  ['sim/core.js', "'use strict';", 'vectors and quaternions, the body tree, third-body perturbations, Kepler'],
  ['sim/vessel.js', '// ---- parts. Masses in tonnes', 'parts, design trees, resources, the vessel, avionics, wheels, aero, structure, gimbal, heat'],
  ['sim/flight.js', "// Patched conics: leave the current body's SOI", 'SOI changes, ground contact, abort, trajectory legs, maneuver nodes, impact prediction'],
  ['sim/world.js', '// ---- the world (terrain session).', 'the generated world, launch sites, recovery, ground stations, plasma blackout'],
  ['sim/program.js', '// ---- the program: missions, and what the program knows.', 'missions, budget, calendar, tester menu, out there, staged pay, powers, industry, know-how, test stand, development, facilities, compute, timeline, dispatch, deviation, production'],
  ['sim/atlas.js', '// ---- the atlas (terrain session)', 'the atlas grid'],
  ['sim/contracts.js', '// ---- contracts: repeatable', 'contracts, sanctions, the race, ownership, decisions'],
  ['sim/space.js', '// ---- the orbital registry:', 'the registry, rendezvous, contact, docking, fleets, the bay, stations, the arm, moonbases, moon orbits, RCS'],
  ['sim/logbook.js', '// ---- the logbook: what the program has *measured*', 'the logbook and tools gated by it'],
  ['sim/procedures.js', '// ---- deterministic stepping + flight tapes.', 'stepping, flight tapes, procedures, headless flights'],
  ['sim/rovers.js', BAR + 'rovers (sats session', 'rovers (ends with SIM END)'],
  ['app/gl.js', BAR + 'rendering (raw WebGL2)', 'WebGL2 setup, shaders, meshes'],
  ['app/state.js', BAR + 'app state', 'app state'],
  ['app/editor.js', BAR + 'editor UI', 'the editor UI'],
  ['app/input.js', BAR + 'input', 'input'],
  ['app/screens.js', BAR + 'screens, overlays, keys', 'screens, overlays, keys (go, KEYS, Help)'],
  ['app/rover-yard.js', BAR + 'the Rover yard', 'the Rover yard'],
  ['app/sound.js', BAR + 'sound (sound session', 'sound (the SOUND MIX block inside is pure)'],
  ['app/loop.js', BAR + 'main loop', 'the main loop'],
  ['app/render.js', BAR + 'render', 'render()'],
  ['app/program-ui.js', BAR + 'program UI: the contract board', 'the Program screen: contract board, satellites, logbook, the era map; then the start-up calls'],
];

const html = readFileSync(DIR + 'index.html', 'utf8'), EOL = html.includes('\r\n') ? '\r\n' : '\n';
const L = html.split(EOL), open = L.indexOf('<script>'), close = L.indexOf('</script>', open);
if (open < 0 || close < 0 || L.indexOf('<script>', open + 1) >= 0) throw new Error('expected exactly one inline <script> block');
// where each part starts: the first line after the previous start that begins with its marker (order makes the short
// ones, like BAR + 'render', unambiguous: 'rendering (raw WebGL2)' is already behind)
let at = open + 1;
const starts = PARTS.map(([f, mark]) => {
  const i = L.findIndex((l, k) => k >= at && k < close && l.startsWith(mark));
  if (i < 0) throw new Error(`${f}: no line starting "${mark}" after line ${at + 1}`);
  at = i + 1; return i;
});
if (starts[0] !== open + 1) throw new Error("the script should open with 'use strict';");
const prelude = (f, what) => [`// ${f} — ${what}. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):`, `// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';`, "'use strict';"];
mkdirSync(DIR + 'sim', { recursive: true }); mkdirSync(DIR + 'app', { recursive: true });
PARTS.forEach(([f, , what], k) => {
  const body = L.slice(starts[k], k + 1 < PARTS.length ? starts[k + 1] : close);
  writeFileSync(DIR + f, [...(k ? prelude(f, what) : []), ...body].join(EOL) + EOL);
  console.log(`${f.padEnd(20)} ${String(body.length).padStart(5)} lines  ${(body.join(EOL).length / 1024).toFixed(0).padStart(4)} KB`);
});
const page = [...L.slice(0, open), ...PARTS.map(([f]) => `<script src="${f}"></script>`), ...L.slice(close + 1)].join(EOL);
writeFileSync(DIR + 'index.html', page);

// Node tools that read the page as text now read it through page.mjs (the same text, scripts inlined)
const READ = "readFileSync(new URL('./index.html', import.meta.url), 'utf8')";
for (const f of ['career.mjs', 'study_control.mjs', 'study_nyx.mjs', 'study_spin.mjs', 'test.mjs', 'fly_crewlunar.mjs', 'fly_ladder.mjs']) {
  let t = readFileSync(DIR + f, 'utf8');
  const nl = t.includes('\r\n') ? '\r\n' : '\n', n = t.split(READ).length - 1;
  if (n !== 1) throw new Error(`${f}: expected one page read, found ${n}`);
  t = t.replace(READ, 'pageSource()');
  if (/^import \{ readFileSync \} from 'node:fs';/m.test(t)) t = t.replace(/^(import \{ readFileSync \} from 'node:fs';)/m, `$1${nl}import { pageSource } from './page.mjs';`);
  else t = t.replace("const { readFileSync } = await import('node:fs');", "const { pageSource } = await import('./page.mjs');");
  if (!t.includes("from './page.mjs'") && !t.includes("import('./page.mjs')")) throw new Error(`${f}: no page.mjs import added`);
  writeFileSync(DIR + f, t); console.log(`${f}: reads pageSource()`);
}

// the check: page.mjs puts it back; that must be the old file with the preludes inserted at the cuts, byte for byte
const { pageSource } = await import(new URL('../' + DIR + 'page.mjs', import.meta.url));
const want = [...L]; for (let k = PARTS.length - 1; k > 0; k--) want.splice(starts[k], 0, ...prelude(PARTS[k][0], PARTS[k][2]));
const same = pageSource() === want.join(EOL);
console.log(`index.html ${L.length} → ${page.split(EOL).length} lines; put back together it is ${same ? 'the old file plus the preludes, exactly' : 'DIFFERENT'}`);
if (!same) process.exit(1);
