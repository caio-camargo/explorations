// Station-keeping study (space session, QUEUE Q50, 2026-10-08): what it costs a satellite in Tellus orbit to hold its slot
// against the moons' tides, by orbit. usage: node study_slot.mjs   (NOTES § "Station-keeping"). A study, not a test.
// The registry keeps satellites on exact Kepler rails; the truth is that rail plus pertAcc (the moons' pull minus Tellus's
// reflex), the same force the flight and the moon-orbit stepper use. For each orbit: how far the truth wanders off the
// rail, and the Δv of holding it there by a correction every τ (cost of one correction ≈ |δv| + 2|δr|/τ, a two-impulse
// return), per day, for several τ. If the per-day cost hardly depends on τ, it's the secular drift and the rate is real.
import { pageSource } from './page.mjs';
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `ORB_T0=0;return {TELLUS,SELENE,NYX,DAY_S,STAT_R,kepler,elements,pertAcc,len,sub,add,mul,dot};`)();
const { TELLUS, DAY_S, STAT_R, kepler, pertAcc, len, sub, add, mul } = api;
const mu = TELLUS.mu, R = TELLUS.R, deg = Math.PI / 180;
const acc = (r, t) => { const rl = len(r), a = mul(r, -mu / (rl * rl * rl)), p = pertAcc(TELLUS, r, t, false); return p ? add(a, p) : a; };
function rk4(r, v, t, t1, P) {
  while (t < t1) {
    const h = Math.min(t1 - t, P / 200);
    const a1 = acc(r, t), r2 = add(r, mul(v, h / 2)), v2 = add(v, mul(a1, h / 2)), a2 = acc(r2, t + h / 2), r3 = add(r, mul(v2, h / 2)), v3 = add(v, mul(a2, h / 2)),
      a3 = acc(r3, t + h / 2), r4 = add(r, mul(v3, h)), v4 = add(v, mul(a3, h)), a4 = acc(r4, t + h);
    r = add(r, mul(add(add(v, mul(v2, 2)), add(mul(v3, 2), v4)), h / 6)); v = add(v, mul(add(add(a1, mul(a2, 2)), add(mul(a3, 2), a4)), h / 6)); t += h;
  }
  return [r, v];
}
const circ = (a, inc) => { const vc = Math.sqrt(mu / a); return [[a, 0, 0], [0, vc * Math.sin(inc), -vc * Math.cos(inc)]]; };   // y is the pole
const ORBITS = [
  ['low 110 km, 0°', R + 110e3, 0], ['low 300 km, 0°', R + 300e3, 0], ['polar 1,000 km', R + 1000e3, 90 * deg],
  ['nav 3,000 km, 60°', R + 3000e3, 60 * deg], ['stationary', STAT_R, 0],
];
const DAYS = +(process.argv[2] || 20);
console.log(`Tellus R ${(R / 1e3).toFixed(0)} km, day ${(DAY_S / 3600).toFixed(2)} h, stationary ${((STAT_R - R) / 1e3).toFixed(0)} km up; ${DAYS} days`);
for (const [name, a, inc] of ORBITS) {
  const [r0, v0] = circ(a, inc), P = 2 * Math.PI * Math.sqrt(a ** 3 / mu);
  let tide = 0; for (let k = 0; k < 64; k++) { const t = k * P / 64, p = pertAcc(TELLUS, kepler(r0, v0, t, mu)[0], t, false); if (p) tide = Math.max(tide, len(p)); }
  // free drift off the rail
  const off = [];
  { let r = r0, v = v0, t = 0; for (const d of [1, 5, DAYS]) { [r, v] = rk4(r, v, t, d * DAY_S, P); t = d * DAY_S; off.push(len(sub(r, kepler(r0, v0, t, mu)[0]))); } }
  // what holding it costs: the Δv that would put the drifted orbit's plane, size and shape back, per day, read at several
  // spans D. Phase is free (a slightly different size for a while). Short-period wobble cancels; growth linear in D is secular.
  const held = [], el0 = api.elements(r0, v0, mu);
  { let r = r0, v = v0, t = 0; for (const D of [2, 5, 10, DAYS]) { [r, v] = rk4(r, v, t, D * DAY_S, P); t = D * DAY_S;
    // the osculating elements wobble within an orbit: average over one orbit's samples
    let h = [0, 0, 0], aa = 0, ee = 0, rr = r, vv = v; const N = 16;
    for (let k = 0; k < N; k++) { const e = api.elements(rr, vv, mu); h = add(h, mul(e.h, 1 / e.hl / N)); aa += e.a / N; ee += e.e / N; [rr, vv] = rk4(rr, vv, t + k * P / N, t + (k + 1) * P / N, P); }
    const vc = Math.sqrt(mu / el0.a), ang = Math.acos(Math.min(1, api.dot(h, mul(el0.h, 1 / el0.hl)) / len(h)));
    const dv = { plane: vc * ang, size: vc / 2 * Math.abs(aa - el0.a) / el0.a, shape: vc / 2 * Math.abs(ee - el0.e) };
    held.push({ D, ...dv, all: (dv.plane + dv.size + dv.shape) / D }); } }
  console.log(`${name.padEnd(20)} tide ≤ ${tide.toExponential(2)} m/s²  off the rail ${off.map(x => (x / 1e3).toFixed(1)).join(' / ')} km after 1 / 5 / ${DAYS} d`);
  console.log(`${''.padEnd(20)} to hold, m/s a day after D = ${held.map(x => x.D).join(', ')} d: ${held.map(x => x.all.toFixed(4)).join(', ')}   (at ${DAYS} d: plane ${held[3].plane.toFixed(2)}, size ${held[3].size.toFixed(2)}, shape ${held[3].shape.toFixed(2)} m/s; per tide·day ${(held[3].all / (tide * DAY_S)).toFixed(4)})`);
}
// B (2026-10-09, the re-tune for MIDGAME § Satellites): station-keeping now holds size, shape and phase and lets the tilt go,
// stepped by the orbit-averaged torque of the tide (tiltStep). Its tilt against the full RK4's, after 20 days.
{
  const G = new Function(src + `return {tiltStep,elements,kepler,STAT_R,TELLUS,DAY_S,YEAR_D,newShip,PRESETS,satRegister,advanceDays,isTV,capital,rotY,absTh,skDv,holdRate,slotRate,slotTilt,PROG,HOOK};`)();
  const incOf = (r, v) => { const e = G.elements(r, v, mu); return Math.acos(Math.max(-1, Math.min(1, e.h[1] / e.hl))) / deg; };
  console.log('\nB. tilt after 20 days, tiltStep vs RK4 (degrees):');
  for (const [name, a, inc] of [ORBITS[3], ORBITS[4]]) {
    const [r0, v0] = circ(a, inc), P = 2 * Math.PI * Math.sqrt(a ** 3 / mu), q = { r: r0, v: v0, epoch: 0 };
    const [r1, v1] = rk4(r0, v0, 0, DAYS * DAY_S, P); G.tiltStep(q, DAYS * DAY_S);
    console.log(`  ${name.padEnd(20)} start ${inc / deg}°: RK4 ${incOf(r1, v1).toFixed(3)}°, tiltStep ${incOf(q.r, q.v).toFixed(3)}°; normals ${(Math.acos(Math.min(1, api.dot(G.elements(r1, v1, mu).h, G.elements(q.r, q.v, mu).h) / (G.elements(r1, v1, mu).hl * G.elements(q.r, q.v, mu).hl))) / deg).toFixed(3)}° apart`);
  }
  // C. a TV satellite held over the capital for 12 years with plenty of propellant: its tilt, what holding costs, TV days
  const P = G.PROG; G.HOOK.news = () => {}; G.HOOK.msg = () => {}; G.HOOK.save = () => {}; P.sats = []; P.day = 0;
  const c = G.capital(), u = G.rotY(c.u, G.absTh(0)), lon = Math.atan2(u[2], u[0]), a = G.STAT_R, vc = Math.sqrt(mu / a);
  const s = G.newShip(G.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: G.TELLUS, r: [a * Math.cos(lon), 0, a * Math.sin(lon)], v: [vc * Math.sin(lon), 0, -vc * Math.cos(lon)] });
  G.satRegister(s, { day0: 0 }); const q = P.sats.at(-1), dv0 = G.skDv(q);
  console.log(`\nC. a TV satellite held over the capital (lat ${(Math.asin(c.u[1]) / deg).toFixed(0)}°): hold ${G.slotRate(q).toFixed(3)} m/s a day (size + shape), tilt ${(G.slotTilt(q) / deg * 400).toFixed(2)}° a year at first; TV at the start ${G.isTV(q, 0)}`);
  let first = null;
  for (let y = 1; y <= 12; y++) { let tv = 0; for (let d = 0; d < G.YEAR_D; d++) { G.advanceDays(1); if (G.isTV(q, P.day * DAY_S)) tv++; else if (first == null) first = P.day; }
    console.log(`  year ${String(y).padStart(2)}: tilt ${incOf(q.r, q.v).toFixed(1)}°, TV ${(tv / G.YEAR_D * 100).toFixed(0)}% of days, ${(dv0 - G.skDv(q)).toFixed(0)} m/s spent so far`); }
  console.log(`  first day without TV: ${first ?? 'none'}`);
}
