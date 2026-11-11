// R13a: "adaptive resolution can't grow back without timer queries". Runs the CURRENT app/render.js text of resNext, RSP
// and adaptRes (extracted verbatim) with gpuMs = null (no EXT_disjoint_timer_query_webgl2) against a synthetic frame clock.
// Run: node r13a.mjs
import { readFileSync } from 'node:fs';
import { ROOT } from './sim.mjs';
const src = readFileSync(ROOT + 'app/render.js', 'utf8');
const a = src.indexOf('const RS_MIN='), b = src.indexOf('function render(){');
const code = src.slice(a, b);
const mk = () => new Function(`let gpuMs=null,RS=1,rsT=0,slowAvg=0,RS_MAX=1;${code}
  return{adaptRes,get RS(){return RS},set RS(v){RS=v},set gpuMs(v){gpuMs=v},RSP}`)();
// the display: frames hold the refresh period while the GPU cost (cost1 ms at RS=1, as RS²) fits in it, else they take 2 periods (vsync)
function run(hz, cost1, secs, start) {
  const A = mk(); A.RS = start; const per = 1 / hz, log = []; let t = 0, next = 0;
  while (t < secs) { const gpu = cost1 * A.RS ** 2 / 1000, dt = Math.ceil(gpu / per - 1e-9) * per || per; A.adaptRes(dt); t += dt; if (t >= next) { log.push(`${t.toFixed(0)}s:${Math.round(A.RS * 100)}%`); next += secs / 8; } }
  return { end: A.RS, log: log.join(' ') };
}
for (const [hz, cost, start, note] of [[60, 5, 0.35, 'light scene (5 ms at full res), start at the floor'], [144, 3, 0.35, 'light scene at 144 Hz'], [60, 30, 1, 'heavy scene (30 ms at full res): fits at 74 %'], [60, 30, 0.35, 'heavy scene, from the floor']]) {
  const r = run(hz, cost, 120, start);
  console.log(`${hz} Hz, ${note}: RS ${Math.round(start * 100)}% -> ${Math.round(r.end * 100)}% after 120 s   [${r.log}]`);
}
console.log('claim: RS could never grow back in this path. expected if the claim held: stuck at the start value.');
