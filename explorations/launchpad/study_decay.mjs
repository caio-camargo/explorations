// Orbital decay study (space session, QUEUE Q25, 2026-10-08): how long low orbits last in the thin upper air, and whether
// the orbit-averaged decay on rails (decayAE) agrees with a direct integration of the drag. usage: node study_decay.mjs
// (NOTES § "Orbital decay"). A study, not a test.
import { pageSource } from './page.mjs';
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const D = new Function(src + `return {TELLUS,DAY_S,YEAR_D,PRESETS,newShip,shapeOf,partMass,dragK,dragRates,decayAE,thinAir,kepler,elements,len,add,mul};`)();
const { TELLUS, DAY_S, YEAR_D, len, add, mul } = D, mu = TELLUS.mu, R = TELLUS.R;
// K (Cd·A/m) of each preset's payload as it would be registered: what's left once every stage that drops has gone
const kOf = name => { const s = D.newShip(D.PRESETS[name]); for (const e of s.events) for (const g of e.decouple) for (const p of s.parts) if (p.seg === g) p.on = false;
  const on = s.parts.filter(p => p.on); for (const p of on) if (p.res.fuel != null) p.res.fuel = 0;   // tanks spent getting there
  const q = { shape: D.shapeOf(on, false), mass: on.reduce((a, p) => a + D.partMass(p), 0) * 1000 }; return { name, K: D.dragK(q), m: q.mass, n: on.length }; };
const life = (alt, K, e = 0) => { const a = (R + alt) / (1 - e); const o = D.decayAE(a, e, K, 0, 100 * YEAR_D * DAY_S); return o.gone ? o.t / DAY_S : Infinity; };
const fmt = d => d === Infinity ? '> 100 y' : d >= YEAR_D ? `${(d / YEAR_D).toFixed(1)} y` : d >= 1 ? `${d.toFixed(1)} d` : `${(d * 8).toFixed(1)} h`;
console.log(`density at 100 / 200 / 400 km: ${[100, 200, 400].map(k => D.thinAir(k * 1e3).toExponential(2)).join(' / ')} kg/m³; day ${DAY_S / 3600} h, year ${YEAR_D} days`);
for (const n of Object.keys(D.PRESETS)) { const k = kOf(n); console.log(`  ${n.padEnd(18)} payload ${k.n} parts, ${(k.m).toFixed(0)} kg dry: Cd·A/m ${k.K.toFixed(4)} m²/kg`); }
console.log('lifetime of a circular orbit (game days), by Cd·A/m:');
const KS = [0.002, 0.005, 0.01, 0.02, 0.05];
console.log('  alt km  ' + KS.map(k => `K ${k}`.padStart(10)).join(''));
for (const alt of [110, 130, 150, 200, 250, 300, 400, 500, 600, 800]) console.log(`  ${String(alt).padStart(6)}  ` + KS.map(k => fmt(life(alt * 1e3, k)).padStart(10)).join(''));
// check: averaged rails vs a direct RK4 with drag (no tides), 150 km circular, K 0.01, until 120 km periapsis
{
  const K = 0.01, a0 = R + 150e3, vc = Math.sqrt(mu / a0);
  let r = [a0, 0, 0], v = [0, 0, -vc], t = 0;
  const acc = (r, v) => { const rl = len(r), vl = len(v), f = 0.5 * D.thinAir(rl - R) * vl * K; return add(mul(r, -mu / rl ** 3), mul(v, -f)); };
  const h = 2;
  while (D.elements(r, v, mu).pe > R + 120e3 && t < 400 * DAY_S) {
    const a1 = acc(r, v), r2 = add(r, mul(v, h / 2)), v2 = add(v, mul(a1, h / 2)), a2 = acc(r2, v2), r3 = add(r, mul(v2, h / 2)), v3 = add(v, mul(a2, h / 2)), a3 = acc(r3, v3), r4 = add(r, mul(v3, h)), v4 = add(v, mul(a3, h)), a4 = acc(r4, v4);
    r = add(r, mul(add(add(v, mul(v2, 2)), add(mul(v3, 2), v4)), h / 6)); v = add(v, mul(add(add(a1, mul(a2, 2)), add(mul(a3, 2), a4)), h / 6)); t += h;
  }
  let ta = 0; { let a = a0, e = 0; while (a * (1 - e) > R + 120e3) { const o = D.decayAE(a, e, K, ta, ta + 600); a = o.a; e = o.e; ta = o.t; } }
  console.log(`check, 150 → 120 km at K 0.01: direct RK4 ${(t / DAY_S).toFixed(2)} days, averaged rails ${(ta / DAY_S).toFixed(2)} days`);
}
