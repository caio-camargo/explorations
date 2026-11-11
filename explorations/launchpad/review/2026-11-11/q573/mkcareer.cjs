// Q573: career.mjs with the proposed gates, without touching the repo. Writes career_gate.mjs to the temp folder and prints its path:
//   PACE=1 GATE=1 node <that path> 3 5   (FAILFIRST=1 or FAILFIRST=orbit as career.mjs)
// GATE=1: the Kestrel kit (kestrel, petrel, t8, istage) opens with "Structural test flight" (loads): in the abstract runner
//         that is beeper.req += loads, the loads flight flown on a Sparrow, and test contracts for closed parts not taken.
// GATE=2: as 1, and the hop too before the beeper (chapter 1's capstone is both).
const fs = require('fs'), path = require('path'), os = require('os'), L = path.resolve(__dirname, '../../..').split(path.sep).join('/') + '/', OUT = path.join(os.tmpdir(), 'career_gate.mjs');
let s = fs.readFileSync(L + 'career.mjs', 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('anchor: ' + a.slice(0, 50)); s = s.replace(a, () => b); };
rep("import { pageSource } from './page.mjs';", "import { pathToFileURL } from 'node:url';\nconst { pageSource } = await import(pathToFileURL('" + L + "page.mjs').href);");
rep("loads: () => PLANS.qual('kestrel', 40)", "loads: () => GATE ? { kind: 'qual', stack: SOUND_S, q: 26, apex: 11, p: 0.9, dur: 700 } : PLANS.qual('kestrel', 40)");
rep("case 'test': { const pl", "case 'test': { if (GATE && ((!P.done.loads && ['kestrel', 'petrel', 't8', 'istage', 'condor'].includes(p.k)) || (p.k === 'condor' && !P.done.lift1))) return null; const pl");
rep("const { PROG: P, CT, TELLUS } = api;", "const { PROG: P, CT, TELLUS } = api;\nconst GATE = +(process.env.GATE || 0);\nif (GATE) { const B = api.MISSIONS.find(M => M.id === 'beeper'); B.req = GATE > 1 ? ['weather', 'loads', 'hop'] : ['weather', 'loads']; }");
fs.writeFileSync(OUT, s); console.log(OUT);
