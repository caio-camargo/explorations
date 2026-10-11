// study_sea.mjs — the sea as a fluid (world session, Q274; NOTES § v1.122): drops each preset's returning piece (everything
// above its top decoupler, tanks empty) into the sea at 7 m/s, upright or tilted, and reports what the water does with it:
// where it comes to rest (upright, on its side, upside down), how much of the hull stays dry, when it would sink, how
// long it took to settle; and a too-dense test piece, which must go down.
//   node study_sea.mjs [tilt°=0] [v=7] [preset name …]
import { pageSource } from './page.mjs';
const html = pageSource(), src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const G = new Function(src + 'return {PRESETS,TELLUS,newShip,detach,geom,physStep,seaAt,seaPts,toPF,fromPF,surfVel,qFromBasis,qBody,siteFrame,HOOK,RHO_SEA,setT:t=>{simT=t},getT:()=>simT,norm,qrot,qaxis,qmul,dot,mul,add,sub,len,clamp,DT}')();
const { TELLUS: T, norm, qrot, qmul, qaxis, dot, mul, add, len, clamp } = G, args = process.argv.slice(2), num = args.filter(a => /^[\d.]+$/.test(a)).map(Number);
const tiltDeg = num[0] ?? 0, v0 = num[1] ?? 7, names = args.filter(a => !/^[\d.]+$/.test(a));
const msgs = []; G.HOOK.msg = m => msgs.push(m); G.HOOK.boom = () => {}; G.HOOK.rebuild = () => {}; G.HOOK.debris = () => {};
// a point of open sea: east of the first site, 300 km out
let u = null; for (let a = 0; a < 6.28 && !u; a += 0.01) { const c = norm([Math.cos(a), 0.05, Math.sin(a)]); if (G.seaAt(T, mul(c, T.R))) { let ok = true; for (let d = -0.003; d <= 0.003; d += 0.001) if (!G.seaAt(T, mul(norm(add(c, [d, d, -d])), T.R))) ok = false; if (ok) u = c; } }
function drop(st, opt = {}) {
  G.setT(0); msgs.length = 0; const s = G.newShip(st);
  const decs = s.parts.filter(p => p.on && p.d.kind === 'dec' && p.pos[0] === 0 && p.pos[2] === 0).sort((a, b) => b.y0 - a.y0);
  if (decs.length) G.detach(s, s.parts.filter(p => p.on && p.y0 <= decs[0].y0 + 1e-6), [0, 0, 0], 0);
  for (const p of s.parts) if (p.on && p.res.fuel != null) p.res.fuel = 0; if (opt.heavy) for (const p of s.parts) if (p.on && p.d.kind === 'tank') p.res.fuel = 50; G.geom(s);
  const les = s.parts.filter(p => p.on && p.d.kind === 'les'); if (les.length) G.detach(s, les, [0, 0, 0], 0);
  const f = G.siteFrame(u), tilt = (opt.tilt ?? tiltDeg) * Math.PI / 180, Y = add(mul(f.up, Math.cos(tilt)), mul(f.e, Math.sin(tilt))), X = norm(sub3(f.n, Y));
  s.landed = false; s.chute = false; s.sas = opt.sas ?? false; if (opt.mode) s.sasMode = opt.mode; s.q = G.qFromBasis(norm(G.qrot ? crossN(Y, X) : X), Y, X); s.r = mul(u, T.R - s.yBot * Math.cos(tilt) + 2); s.v = add(G.surfVel(T, s.r), mul(f.up, -(opt.v ?? v0))); s.w = [0, T.rot, 0];
  const P = G.seaPts(s); let t = 0, out = 'still moving';
  for (; t < 600; t += G.DT) { G.physStep(s, G.DT); if (!s.alive) { out = s.sunk ? 'SANK' : 'destroyed'; break } if (s.landed) { out = 'afloat'; break } }
  const F = s.float; return { s, t, out, msgs: msgs.slice(), V: P.V, m: s.mass, F };
}
function sub3(a, b) { return a.map((x, i) => x - b[i] * dot(a, b)) }   // a minus its component along unit b
function crossN(a, b) { return norm([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]) }
const list = names.length ? names : Object.keys(G.PRESETS).filter(k => G.PRESETS[k]);
console.log(`open sea at ${u.map(x => x.toFixed(3))}; drop at ${v0} m/s, tilted ${tiltDeg}°\n`);
for (const k of list) { const st = G.PRESETS[k], r = drop(st.parts || st), F = r.F;
  console.log(`${k.padEnd(18)} ${(r.m / 1000).toFixed(2)} t in ${r.V.toFixed(2)} m³ (${(r.m / r.V).toFixed(0)} kg/m³)  → ${r.out} after ${r.t.toFixed(1)} s` +
    (F ? `, ${F.tilt < 0.35 ? 'upright' : F.tilt > 2.8 ? 'upside down' : 'on its side'} (${(F.tilt * 57.3).toFixed(0)}°), ${(F.dry * 100).toFixed(0)} % dry, ${isFinite(F.sinkAt) ? `sinks after ${((F.sinkAt - F.t) / 3600).toFixed(0)} h` : 'never sinks'}` : '') +
    `\n${''.padEnd(19)}${r.msgs.join(' | ')}`); }
// a piece too dense to float: the Hopper with its tank full of something heavy
for (const mode of ["stab", "retro"]) { const r = drop(G.PRESETS["Crewed Lunar"], { sas: true, mode, tilt: 0 }); console.log(`Crewed Lunar, SAS ${mode}: ${r.out} after ${r.t.toFixed(1)} s`); }
const h = drop(G.PRESETS.Hopper, { heavy: true, tilt: 0 }); console.log(`\nHopper, tank 50 t: ${(h.m / 1000).toFixed(1)} t in ${h.V.toFixed(2)} m³ → ${h.out} after ${h.t.toFixed(1)} s`);
