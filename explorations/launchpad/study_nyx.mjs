// Eccentric-moon study (bodies session, 2026-10-07): n-body truth vs patched conics, used to size Nyx and pick its SOI rule.
// usage: node study_nyx.mjs [small|mid|big|selene]   (NOTES: "More bodies"). A study, not a test: it defines its own moon.
import { readFileSync } from 'node:fs';
import { pageSource } from './page.mjs';
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `return {TELLUS,addBody,bodyRel,kepler,elements,len,sub,add,mul,dot,cross,norm};`)();
const { TELLUS, kepler, elements, len, sub, add, mul, dot, cross, norm } = api;
const deg = Math.PI / 180;
const CANDS = {
  small: { name: 'small', R: 90e3, g: 0.25, a: 16e6, e: 0.7 },
  mid: { name: 'mid', R: 150e3, g: 0.4, a: 18e6, e: 0.55 },
  selene: { name: 'selene', R: 348e3, g: 1.62, a: 38.44e6, e: 0.0001 },
  big: { name: 'big', R: 200e3, g: 0.5, a: 18e6, e: 0.55 },
};
const which = process.argv[2] || 'mid';
const C = CANDS[which];
const M = { name: C.name, R: C.R, mu: C.g * C.R * C.R, atm: 0, orb: { a: C.a, e: C.e, i: 30 * deg, lan: 1.0, argp: 0.8, M0: 0.5 } };
const T0 = { ...TELLUS, children: [] }; api.addBody(T0); api.addBody(M, T0);
const muT = TELLUS.mu, muM = M.mu, P = 2 * Math.PI / M.n;
const rel = t => api.bodyRel(M, t);
const ratio = Math.pow(muM / muT, 0.4), hill = r => r * Math.pow(muM / (3 * muT), 1 / 3);
console.log(`${which}: R ${C.R / 1e3} km, g ${C.g}, a ${C.a / 1e6} Mm, e ${C.e}: pe ${(M.rMin / 1e6).toFixed(1)} Mm, ap ${(M.rMax / 1e6).toFixed(1)} Mm, period ${(P / 3600).toFixed(1)} h, v_esc ${Math.sqrt(2 * muM / C.R).toFixed(0)} m/s`);
console.log(`  SOI: at a ${(C.a * ratio / 1e3).toFixed(0)} km, at pe ${(M.rMin * ratio / 1e3).toFixed(0)} km, at ap ${(M.rMax * ratio / 1e3).toFixed(0)} km;  Hill at pe ${(hill(M.rMin) / 1e3).toFixed(0)} km, at ap ${(hill(M.rMax) / 1e3).toFixed(0)} km`);
// n-body in the Tellus-centred frame (moon on its fixed Kepler path; indirect term for Tellus's acceleration toward the moon)
function acc(r, t) {
  const rm = rel(t)[0], d = sub(r, rm), dl = len(d), rl = len(r), rml = len(rm);
  return add(add(mul(r, -muT / rl ** 3), mul(d, -muM / dl ** 3)), mul(rm, -muM / rml ** 3));
}
function nbody(r, v, t, tEnd, stop) {
  const sg = tEnd >= t ? 1 : -1;
  while (sg * (tEnd - t) > 1e-9) {
    const dl = len(sub(r, rel(t)[0])), rl = len(r);
    let h = sg * Math.min(0.01 * Math.min(dl ** 1.5 / Math.sqrt(muM), rl ** 1.5 / Math.sqrt(muT)), 120, sg * (tEnd - t));
    const k1v = acc(r, t), k1r = v;
    const k2v = acc(add(r, mul(k1r, h / 2)), t + h / 2), k2r = add(v, mul(k1v, h / 2));
    const k3v = acc(add(r, mul(k2r, h / 2)), t + h / 2), k3r = add(v, mul(k2v, h / 2));
    const k4v = acc(add(r, mul(k3r, h)), t + h), k4r = add(v, mul(k3v, h));
    r = add(r, mul(add(add(k1r, mul(k2r, 2)), add(mul(k3r, 2), k4r)), h / 6));
    v = add(v, mul(add(add(k1v, mul(k2v, 2)), add(mul(k3v, 2), k4v)), h / 6));
    t += h;
    if (stop && stop(r, v, t)) break;
  }
  return [r, v, t];
}
// A. circular orbits about the moon, started at the moon's apoapsis (worst case: periapsis comes half a period later); 1 and 3 moon periods
console.log('A. circular orbits around the moon (prograde, in the moon\'s orbital plane), started at moon apoapsis:');
const tAp = (Math.PI - M.orb.M0) / M.n;
for (const alt of [20e3, 50e3, 100e3, 150e3, 200e3, 300e3, 400e3, 600e3]) {
  const rr = C.R + alt, [rm, vm] = rel(tAp), hn = norm(cross(rm, vm)), x = norm(rm), y = cross(hn, x), vc = Math.sqrt(muM / rr);
  for (const dir of [1, -1]) {
    let r = add(rm, mul(x, rr)), v = add(vm, mul(y, dir * vc)), lost = null, minAlt = Infinity, maxR = 0;
    [r, v] = nbody(r, v, tAp, tAp + 3 * P, (r, v, t) => { const d = len(sub(r, rel(t)[0])); minAlt = Math.min(minAlt, d - C.R); maxR = Math.max(maxR, d); if (d < C.R) { lost = 'crashed ' + ((t - tAp) / P).toFixed(2) + 'P'; return true; } if (d > 3 * hill(M.rMax)) { lost = 'escaped ' + ((t - tAp) / P).toFixed(2) + 'P'; return true; } });
    console.log(`  alt ${(alt / 1e3).toFixed(0).padStart(4)} km ${dir > 0 ? 'pro ' : 'retro'}: ${lost || 'bound 3P'}  (radius ${(rr / 1e3).toFixed(0)}..${(maxR / 1e3).toFixed(0)} km, min alt ${(minAlt / 1e3).toFixed(0)} km)`);
  }
}
// B. flybys: hyperbolic passes at several approach speeds/impact params, at moon pe and ap. Compare patched conic (each SOI rule)
// against n-body: the ship's position 2 days after the encounter, and the moon-relative periapsis.
console.log('B. flybys: n-body vs patched conics, error 1 day after the pass (km), by SOI rule');
const rules = { a: () => C.a * ratio, pe: () => M.rMin * ratio, r: t => len(rel(t)[0]) * ratio };
const rows = [];
for (const at of ['pe', 'ap']) for (const vinf of [300, 800]) for (const b of [0.6, 1.5, 3]) {
  const tc = ((at === 'pe' ? 0 : Math.PI) - M.orb.M0) / M.n + P; // closest approach time
  const [rm, vm] = rel(tc), hn = norm(cross(rm, vm)), x = norm(rm), y = cross(hn, x);
  // build the moon-relative hyperbola with periapsis b*R... b = pe radius in units of (R + 100 km)
  const rp = b * (C.R + 100e3), vp = Math.sqrt(vinf * vinf + 2 * muM / rp);
  const rP = mul(x, rp), vP = mul(y, vp);   // moon-relative, at periapsis
  const span = 0.6 * 86400;
  // n-body: back-propagate along the moon-relative hyperbola far enough (3x biggest SOI) using Kepler to get a start, then integrate forward through
  const t0 = tc - span, [rs, vs] = nbody(add(rP, rm), add(vP, vm), tc, t0);   // true state 0.6 days before closest approach
  const tEnd = tc + 86400;
  const [rN] = nbody(rs, vs, t0, tEnd);
  const row = { at, vinf, rp: (rp / 1e3).toFixed(0) };
  for (const [k, soiF] of Object.entries(rules)) {
    // patched conic: Tellus Kepler until inside SOI, moon Kepler until outside, Tellus Kepler to tEnd (fine time steps for the switches)
    let r = rs, v = vs, t = t0, inM = false, sw = 0;
    while (t < tEnd - 1e-6) {
      const h = Math.min(20, tEnd - t);
      if (!inM) { [r, v] = kepler(r, v, h, muT); t += h; const [p, w] = rel(t); if (len(sub(r, p)) < soiF(t)) { r = sub(r, p); v = sub(v, w); inM = true; sw++; } }
      else { [r, v] = kepler(r, v, h, muM); t += h; if (len(r) > soiF(t)) { const [p, w] = rel(t); r = add(r, p); v = add(v, w); inM = false; sw++; } }
    }
    if (inM) { const [p] = rel(t); r = add(r, p); }
    row[k] = (len(sub(r, rN)) / 1e3).toFixed(0) + (sw ? '' : '(miss)');
  }
  rows.push(row);
}
console.table(rows);
