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
// C (slice 3, Q147): fragment bands with the game's own code. (1) how long a centimetre fragment lasts in each band;
// (2) one 1 t breakup: what's left over the years, and the risk to a 2 m satellite in the thickest band; (3) the cascade:
// N spent stages (2 t each, random planes) at 800–850 km and one breakup there, real rates, 40 years.
{
  const G = new Function(src + `return {TELLUS,DAY_S,YEAR_D,BAND_W,BAND_N,bandR,bandV,fragTau,fragsOf,breakup,fragBands,fragTick,advanceDays,CASC_STAT,newShip,PRESETS,detach,junkRegister,PROG,HOOK,satsUp};`)();
  const P = G.PROG, news = []; G.HOOK.news = m => news.push(m); G.HOOK.msg = () => {}; G.HOOK.save = () => {};
  const yrs = s => s / G.DAY_S / G.YEAR_D, km = b => Math.round((G.TELLUS.atm + b * G.BAND_W) / 1e3);
  console.log('\nC1. a centimetre fragment (Cd·A/m 0.2) sinking through each band, and from there to re-entry (years):');
  let acc = 0; const out = [];
  for (let b = 0; b < G.BAND_N; b++) { acc += G.fragTau(b); if ([0, 2, 4, 6, 8, 10, 14, 18, 22, 28, 37].includes(b)) out.push(`${km(b)} km: ${yrs(G.fragTau(b)).toPrecision(2)} (${yrs(acc).toPrecision(2)} down)`); }
  console.log('  ' + out.join(' · '));
  for (const h of [400e3, 800e3]) {
    P.frag = null; P.sats = []; P.breakups = []; P.day = 0; const n = G.breakup(h, 1000), F = G.fragBands(), peak = F.indexOf(Math.max(...F));
    const rate = Fb => 4 * 2 * 2 * Fb / G.bandV(peak) * Math.sqrt(G.TELLUS.mu / G.bandR(peak)) * G.DAY_S * G.YEAR_D;   // 2 m radius
    const line = [`${Math.round(n)} fragments; peak ${km(peak)}–${km(peak) + 50} km: ${Math.round(F[peak])}, a 2 m satellite there hit ${rate(F[peak]).toExponential(1)}/year (real)`];
    let d = 0; for (const y of [1, 5, 20, 50]) { G.fragTick(d * G.DAY_S, y * G.YEAR_D * G.DAY_S); d = y * G.YEAR_D; line.push(`${y} y: ${Math.round(G.fragBands().reduce((a, x) => a + x, 0))} left`); }
    console.log(`C2. 1 t breakup at ${h / 1e3} km: ` + line.join('; '));
  }
  console.log('C3. N spent stages (2 t) at 800–850 km plus one 1 t breakup there, real rates, 40 years (stages left/fragments in the band):');
  for (const N of [100, 400, 1500]) {
    P.frag = null; P.sats = []; P.breakups = []; P.casc = {}; P.day = 0; P.pressures = { debris: 'real' }; news.length = 0; let seed = 7;
    const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) { const s = G.newShip(G.PRESETS.Orbiter), a = G.TELLUS.R + 805e3 + R() * 40e3, vc = Math.sqrt(G.TELLUS.mu / a), inc = R() * Math.PI, ph = R() * 2 * Math.PI;
      const r = [a * Math.cos(ph), 0, a * Math.sin(ph)], t = [-Math.sin(ph), 0, Math.cos(ph)], v = [vc * (t[0] * Math.cos(inc)), vc * Math.sin(inc), vc * (t[2] * Math.cos(inc))];
      Object.assign(s, { alive: true, landed: false, body: G.TELLUS, r, v, rec: { launched: true, day0: 0 } }); const ev = s.events.find(e => e.decouple.length);
      G.detach(s, s.parts.filter(p => p.on && ev.decouple.includes(p.seg)), [0, -1, 0], 0); G.junkRegister(s.rec); P.sats.at(-1).mass = 2000; }
    G.breakup(825e3, 1000); const row = [];
    for (let y = 5; y <= 40; y += 5) { G.advanceDays(5 * G.YEAR_D); row.push(`${y}y ${G.satsUp().length}/${Math.round(G.fragBands()[14] / 1e3)}k`); }
    const cs = G.CASC_STAT[14] || {};
    console.log(`  N ${String(N).padStart(4)}: R0 ${cs.R0?.toFixed(2)}, next breakup due in ~${cs.gen?.toFixed(0)} years; stages left / fragments in the band: ${row.join(' · ')}; ${news.filter(m => /feeds itself|filling/.test(m)).map(m => m.slice(0, 60)).join(' | ') || 'no cascade news'}`);
  }
}
