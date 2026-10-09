// Debris conjunction study (space session, QUEUE Q146, 2026-10-09): checks pairRate's formula, Rs² v / (2π r² W
// cos(Δi/2)), against an event-driven Monte Carlo of two circular orbits with radii spread over one 50 km band and
// random phases, then what a cluttered low orbit costs a year. usage: node study_debris.mjs  (NOTES § v1.77 or later)
import { pageSource } from './page.mjs';
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const D = new Function(src + `return {TELLUS,DAY_S,BAND_W,bandR,pairRate,rng};`)();
const { TELLUS, DAY_S, BAND_W } = D, mu = TELLUS.mu, deg = Math.PI / 180;
// A. Monte Carlo: at each node passage of A, B's offset along its track; linear relative motion gives the miss distance
function mc(band, di, Rs, pairs = 20000, days = 20) {
  const R = D.rng(12345), r0 = D.bandR(band) - BAND_W / 2, T = days * DAY_S; let hits = 0;
  for (let p = 0; p < pairs; p++) {
    const rA = r0 + R() * BAND_W, rB = r0 + R() * BAND_W, nA = Math.sqrt(mu / rA ** 3), nB = Math.sqrt(mu / rB ** 3), vA = nA * rA, vB = nB * rB;
    const pA = R() * 2 * Math.PI, pB = R() * 2 * Math.PI;   // angles from the ascending node at t = 0
    for (const node of [0, Math.PI]) {
      // A at node at times tk = (node - pA)/nA + k PA; B's angle from the same node then: pB + nB tk - node
      const PA = 2 * Math.PI / nA; let t = (((node - pA) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / nA;
      for (; t < T; t += PA) {
        let d = (pB + nB * t - node) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        if (Math.abs(d) > 0.05) continue;
        // tangent-plane frame: x along the node line (radial at the node), uA = (0,1,0), uB = (0, cos di, sin di)
        const d0 = [rB - rA, rB * d * Math.cos(di), rB * d * Math.sin(di)], w = [0, vB * Math.cos(di) - vA, vB * Math.sin(di)];
        const ww = w[0] ** 2 + w[1] ** 2 + w[2] ** 2, dw = d0[0] * w[0] + d0[1] * w[1] + d0[2] * w[2], dd = d0[0] ** 2 + d0[1] ** 2 + d0[2] ** 2;
        if (dd - dw * dw / ww < Rs * Rs) hits++;
      }
    }
  }
  return hits / pairs / days;   // hits a day per pair
}
const formula = (band, di, Rs) => { const r = D.bandR(band), v = Math.sqrt(mu / r); return Rs * Rs * v / (2 * Math.PI * r * r * BAND_W * Math.cos(di / 2)) * DAY_S; };
console.log('A. hits a day per pair, Monte Carlo vs formula (band 6 = 400–450 km, Rs 1 km to get counts; 200,000 pairs × 20 days):');
for (const di of [90, 60, 30, 10]) { const m = mc(6, di * deg, 1000, 200000), f = formula(6, di * deg, 1000); console.log(`  Δi ${String(di).padStart(2)}°: MC ${m.toExponential(3)} (${Math.round(m * 200000 * 20)} hits), formula ${f.toExponential(3)}, ratio ${(m / f).toFixed(2)}`); }
// B. what it means: a 2 m satellite among N spent stages (2.5 m) in its band, crossing at ~60°, per year (400 days)
console.log('B. a satellite (Rs 4.5 m with the stage) sharing a 50 km band at 400 km with N pieces of debris, crossing at 60°:');
for (const N of [10, 100, 1000]) { const lam = formula(6, 60 * deg, 4.5) * N * 400; console.log(`  N ${String(N).padStart(4)}: real ${lam.toExponential(2)} hits a year (1 in ${(1 / lam).toFixed(0)} years), light ${(lam / 10).toExponential(2)}`); }
