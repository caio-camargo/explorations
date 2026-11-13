// Q607 (review 2 session, 2026-11-13): what places does Selene's relief offer for a named landing?
// Lists the largest baked craters with what a mission would judge: size, side, latitude, ground unit, and how much of
// the floor a lander can stand on (slope under 12 degrees on a 10 m baseline). Run: node places.mjs
import { mk } from '../2026-11-11/h.mjs';
const D = mk('HOOK,SELENE,SELENE_GROUND,seleneMap,seleneH,selMare,bodyRel,toPF,fromPF,norm,mul,dot,cross,rng,groundAlt');
const B = D.SELENE; B.ground = D.SELENE_GROUND;
const m = D.seleneMap(), R = B.R, deg = 180 / Math.PI;
// is Selene locked? the Tellus direction in Selene's own frame at two times
const toT = t => D.norm(D.toPF(B, D.mul(D.bodyRel(B, t)[0], -1), t));
const n0 = toT(0), n1 = toT(6 * 86400), n2 = toT(40 * 86400);
console.log('Tellus direction in Selene frame, t=0, 6 d, 40 d:', [n0, n1, n2].map(v => v.map(x => x.toFixed(3)).join(' ')).join(' | '));
console.log(`craters in the map: ${m.craters.length}, simple to complex at ${(m.Dt / 1e3).toFixed(1)} km, relief ${m.lo.toFixed(0)} to ${m.hi.toFixed(0)} m`);
const frame = u => { const a = Math.abs(u[1]) < .9 ? [0, 1, 0] : [1, 0, 0], e = D.norm(D.cross(a, u)), n = D.cross(u, e); return [e, n]; };
const at = (u, e, n, x, y) => D.norm([0, 1, 2].map(i => u[i] * R + e[i] * x + n[i] * y));
const H = u => D.seleneH(u);
const slope = (u, e, n, x, y, d = 10) => { const h = (a, b) => H(at(u, e, n, a, b)); return Math.atan(Math.hypot(h(x + d, y) - h(x - d, y), h(x, y + d) - h(x, y - d)) / (2 * d)) * deg; };
const rnd = D.rng(7);
const rows = [];
for (const c of m.craters) {
  const u = c.c, [e, n] = frame(u), rad = c.D / 2, simple = c.D < m.Dt, floor = (simple ? .25 : .33) * rad;
  let ok = 0, N = 60, worst = 0, sum = 0;
  for (let i = 0; i < N; i++) { const r = floor * Math.sqrt(rnd()), a = 2 * Math.PI * rnd(), s = slope(u, e, n, r * Math.cos(a), r * Math.sin(a)); if (s < 12) ok++; worst = Math.max(worst, s); sum += s; }
  // the wall: steepest of 24 points at 0.7 of the radius
  let wall = 0; for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; wall = Math.max(wall, slope(u, e, n, .7 * rad * Math.cos(a), .7 * rad * Math.sin(a), 50)); }
  const depth = H(at(u, e, n, rad, 0)) - H(u);
  rows.push({ D: c.D / 1e3, lat: Math.asin(u[1]) * deg, lon: Math.atan2(u[2], u[0]) * deg, near: D.dot(u, n0), mare: D.selMare(u), fr: c.fr, young: c.young, ok: ok / N, mean: sum / N, worst, wall, depth, floorKm: floor / 1e3 });
}
rows.sort((a, b) => b.D - a.D);
const f = r => `${r.D.toFixed(0).padStart(4)} km  ${r.lat.toFixed(0).padStart(4)}N ${r.lon.toFixed(0).padStart(5)}E  ${r.near > .25 ? 'near' : r.near < -.25 ? 'far ' : 'limb'}  ${r.mare > .3 ? 'mare' : 'high'}  fresh ${r.fr.toFixed(2)}${r.young ? ' young' : '      '}  floor ${r.floorKm.toFixed(1).padStart(4)} km: ${(100 * r.ok).toFixed(0).padStart(3)} % under 12 deg (mean ${r.mean.toFixed(0)}, worst ${r.worst.toFixed(0)})  wall ${r.wall.toFixed(0)} deg  rim to floor ${r.depth.toFixed(0)} m`;
console.log('\nthe 30 largest:'); rows.slice(0, 30).forEach(r => console.log(f(r)));
const cnt = (p) => rows.filter(p).length;
console.log(`\n>= 40 km: ${cnt(r => r.D >= 40)}; of them near side ${cnt(r => r.D >= 40 && r.near > .25)}, far ${cnt(r => r.D >= 40 && r.near < -.25)}; on mare ${cnt(r => r.D >= 40 && r.mare > .3)}; |lat| > 60: ${cnt(r => r.D >= 40 && Math.abs(r.lat) > 60)}`);
console.log(`floor share standable (under 12 deg), all ${rows.length}: median ${(100 * rows.map(r => r.ok).sort((a, b) => a - b)[rows.length >> 1]).toFixed(0)} %; craters with under 50 %: ${cnt(r => r.ok < .5)}; with 90 % or more: ${cnt(r => r.ok >= .9)}`);
// open ground for comparison: 200 random points on mare and on highland
for (const [name, pick] of [['mare', x => x > .5], ['highland', x => x < .05]]) { let k = 0, ok = 0, s = 0; while (k < 200) { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), q = Math.sqrt(1 - z * z), u = [q * Math.cos(t), z, q * Math.sin(t)]; if (!pick(D.selMare(u))) continue; const [e, n] = frame(u), sl = slope(u, e, n, 0, 0); k++; s += sl; if (sl < 12) ok++; } console.log(`open ${name}: ${(ok / 2).toFixed(0)} % of points under 12 deg, mean ${(s / 200).toFixed(1)} deg`); }
// a grade per place, by a rule a mission can state: A = near side and 85 % or more of the floor standable;
// C = far side or limb, or under 60 % standable, or beyond 60 degrees of latitude; B = the rest. Craters of 40 km and more.
const grade = r => r.near > .25 && r.ok >= .85 ? 'A' : r.near <= .25 || r.ok < .6 || Math.abs(r.lat) > 60 ? 'C' : 'B';
const big = rows.filter(r => r.D >= 40), g = { A: [], B: [], C: [] }; for (const r of big) g[grade(r)].push(r);
console.log(`\ngrades of the ${big.length} craters of 40 km and more: A ${g.A.length}, B ${g.B.length}, C ${g.C.length}`);
for (const k of 'AB') { console.log(k + ':'); g[k].forEach(r => console.log('  ' + f(r))); }
console.log(`C: near side ${g.C.filter(r => r.near > .25).length}, limb ${g.C.filter(r => Math.abs(r.near) <= .25).length}, far ${g.C.filter(r => r.near < -.25).length}`);
const vis = big.filter(r => r.depth >= 300);
console.log(`\nof the ${big.length}, rim stands 300 m or more above the centre (a crater you can see): ${vis.length}; by grade A ${vis.filter(r => grade(r) === 'A').length}, B ${vis.filter(r => grade(r) === 'B').length}, C ${vis.filter(r => grade(r) === 'C').length}; flooded or worn flat: ${big.length - vis.length}`);
console.log(`with a central peak (25 km and more, all of them): ${big.length}`);
