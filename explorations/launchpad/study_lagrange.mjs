// Lagrange study (design desk, 2026-10-09): do Tellus–Selene L4/L5 emerge from the game's own force model (Tellus gravity +
// pertAcc, the tides 6b put into the rails)? A test particle co-orbiting at 60°/−60° vs controls at 90°/30°.
// usage: node study_lagrange.mjs [selene orbits, default 20]. LATE_GAME.md § Asteroids. A study, not a test.
import { pageSource } from './page.mjs';
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `ORB_T0=0;return {TELLUS,SELENE,NYX,bodyRel,pertAcc,len,sub,add,mul};`)();
const { TELLUS, SELENE, NYX, bodyRel, pertAcc, len, sub, add, mul } = api;
const mu = TELLUS.mu;
const acc = (r, t) => { const rl = len(r), a = mul(r, -mu / rl ** 3), p = pertAcc(TELLUS, r, t, false); return p ? add(a, p) : a; };
function rk4(r, v, t, h) { const a1 = acc(r, t), r2 = add(r, mul(v, h / 2)), v2 = add(v, mul(a1, h / 2)), a2 = acc(r2, t + h / 2), r3 = add(r, mul(v2, h / 2)), v3 = add(v, mul(a2, h / 2)), a3 = acc(r3, t + h / 2), r4 = add(r, mul(v3, h)), v4 = add(v, mul(a3, h)), a4 = acc(r4, t + h);
  return [add(r, mul(add(add(v, mul(v2, 2)), add(mul(v3, 2), v4)), h / 6)), add(v, mul(add(add(a1, mul(a2, 2)), add(mul(a3, 2), a4)), h / 6))]; }
const rot = (p, th) => { const c = Math.cos(th), s = Math.sin(th); return [p[0] * c + p[2] * s, p[1], p[2] * c - p[0] * s]; };
const P = 2 * Math.PI / SELENE.n, h = 300, ORB = +(process.argv[2] || 20);
const sel0 = bodyRel(SELENE, 0);
const muS = SELENE.mu / (mu + SELENE.mu);
console.log(`Selene period ${(P / 28800).toFixed(2)} program days; mass ratio ${muS.toFixed(4)}; Nyx pert ${NYX.pert}; ${ORB} Selene orbits`);
for (const [name, ang] of [['L4 (60° ahead)', Math.PI / 3], ['L5 (60° behind)', -Math.PI / 3], ['control: 90° ahead', Math.PI / 2], ['control: 30° ahead', Math.PI / 6]]) {
  // place on Selene's circle, rotated; same speed (circular), as a test particle co-orbiting
  let r = rot(sel0[0], ang), v = rot(sel0[1], ang), t = 0, maxD = 0, maxAng = 0;
  const steps = Math.round(ORB * P / h);
  for (let k = 1; k <= steps; k++) { [r, v] = rk4(r, v, t, h); t += h;
    if (k % 20 === 0) { const S = bodyRel(SELENE, t)[0]; const a1 = Math.atan2(-S[2], S[0]), a2 = Math.atan2(-r[2], r[0]); let d = a2 - a1; d = Math.atan2(Math.sin(d), Math.cos(d));
      const off = Math.abs(d - ang) * 180 / Math.PI; maxAng = Math.max(maxAng, off); maxD = Math.max(maxD, Math.abs(len(r) - len(S))); } }
  const S = bodyRel(SELENE, t)[0]; let d = Math.atan2(-r[2], r[0]) - Math.atan2(-S[2], S[0]); d = Math.atan2(Math.sin(d), Math.cos(d));
  console.log(`${name.padEnd(20)} end: ${(d * 180 / Math.PI).toFixed(1)}° from Selene, radius off ${((len(r) - len(S)) / 1e3).toFixed(0)} km | worst: ${maxAng.toFixed(1)}° of drift, ${(maxD / 1e3).toFixed(0)} km radial`);
}
