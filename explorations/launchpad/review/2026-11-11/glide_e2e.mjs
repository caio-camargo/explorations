// Q592 "measure first": a winged craft flown from an orbital entry to the ground with the game's real physics step.
// The craft is glide.mjs's: capsule + 1 t tank + a fin ring whose four plates are resized to wing size.
// Attitude: 'kin' sets the attitude every step (what the aerodynamics give if control were perfect);
//           'sas' asks the game's own SAS (stab hold) for the same direction with the pod's real wheels.
// Run from explorations/launchpad: node review/2026-11-11/glide_e2e.mjs
const { mk } = await import(new URL('./h.mjs', import.meta.url).href);
const A = mk('HOOK,PARTS,newShip,geom,SND,TELLUS,density,physStep,DT,G0,len,norm,add,mul,cross,sub,dot,surfVel,qrot,qconj,qFromBasis,toPF,groundR,seaAt');
const B = A.TELLUS, D2R = Math.PI / 180;
const msgs = []; A.HOOK.msg = m => msgs.push(m);
const rotAbout = (v, k, a) => A.add(A.add(A.mul(v, Math.cos(a)), A.mul(A.cross(k, v), Math.sin(a))), A.mul(k, A.dot(k, v) * (1 - Math.cos(a))));

function fly({ name, stack, span, chord, aoa, bank = 0, mode = 'kin', retro = false, flare = null, noHeat = false, h0 = 120e3, gamma = -1.5, vk = 0.99, tmax = 6000 }) {
  msgs.length = 0;
  const s = A.newShip(stack); A.geom(s);
  if (span) for (const p of s.fins) p.d = { ...p.d, span, chord };
  if (noHeat) for (const p of s.parts) p.d = { ...p.d, Tmax: 1e9 };
  A.geom(s);
  const r0 = B.R + h0, vc = Math.sqrt(B.mu / r0) * vk, g = gamma * D2R;
  s.landed = false; s.r = [r0, 0, 0]; s.v = [vc * Math.sin(g), 0, -vc * Math.cos(g)];
  if (A.dot(s.v, A.surfVel(B, s.r)) < 0) s.v[2] = -s.v[2];                       // fly with the planet's spin (east)
  s.w = [0, 0, 0]; s.sas = mode === 'sas'; s.sasMode = 'stab'; s.throttle = 0;
  const pf0 = A.norm(A.toPF(B, s.r, A.t)), t0 = A.t, m0 = s.mass;
  const bands = { 'M>5': [0, 0, 0], 'M2-5': [0, 0, 0], 'M0.3-0.9': [0, 0, 0] };   // sums of lift, drag, steps
  let gmax = 0, qmax = 0, hotmax = 0, hotName = '', qHeatMax = 0, aoaErrMax = 0, aoaErrSum = 0, aoaErrN = 0, track = 0, wmax = 0, finT = 0, nanAt = null, tumble = 0, nan = false, last = null, km1 = null, steps = 0, why = '';
  const wall = performance.now();
  while (A.t - t0 < tmax) {
    const up = A.norm(s.r), vA = A.sub(s.v, A.surfVel(B, s.r)), sp = A.len(vA), u = A.mul(vA, 1 / sp);
    const h = A.len(s.r) - B.R, pf = A.toPF(B, s.r, A.t), agl = A.len(s.r) - A.groundR(B, pf);
    // the wanted nose: the air-relative velocity pitched up by aoa in the vertical plane, that plane rolled by bank about the velocity
    let n = A.norm(A.cross(u, up)); if (!isFinite(n[0])) n = [0, 1, 0];
    let liftDir = A.norm(A.cross(n, u)); liftDir = rotAbout(liftDir, u, bank * D2R);
    const sink0 = -A.dot(vA, up);
    const a = (flare && agl < flare.below ? (flare.sink != null ? Math.min(45, Math.max(5, aoa + flare.k * (sink0 - flare.sink))) : flare.aoa) : aoa) * D2R;
    const nose = retro ? A.mul(u, -1) : A.norm(A.add(A.mul(u, Math.cos(a)), A.mul(liftDir, Math.sin(a))));
    if (mode === 'kin') { const X = A.norm(A.cross(nose, A.cross(liftDir, nose))), Z = A.cross(X, nose); s.q = A.qFromBasis(X, nose, Z); s.w = [0, 0, 0]; }
    else s.hold = nose;
    const vb = A.qrot(A.qconj(s.q), vA);
    const pre = { h, sp, w: A.len(s.w), aoa: s.aoa / D2R, q: s.qdyn };
    A.physStep(s, A.DT); steps++;
    if (!isFinite(s.r[0]) || !isFinite(s.v[0])) { nan = true; why = 'NaN'; nanAt = pre; break; }
    let F = [0, 0, 0]; for (const p of s.parts) if (p.on) F = A.add(F, p.F);
    const ub = A.mul(vb, 1 / sp), Dr = -A.dot(F, ub), Lf = A.len(A.sub(F, A.mul(ub, -Dr)));
    const M = sp / A.SND(h), bk = M > 5 ? 'M>5' : M > 2 ? 'M2-5' : M > 0.3 && M < 0.9 ? 'M0.3-0.9' : null;
    if (bk && h < 90e3) { bands[bk][0] += Lf; bands[bk][1] += Dr; bands[bk][2]++; }
    wmax = Math.max(wmax, A.len(s.w)); for (const p of s.fins) finT = Math.max(finT, p.T);
    if (h < 95e3 && agl > 200) { gmax = Math.max(gmax, s.gload); qmax = Math.max(qmax, s.qdyn); qHeatMax = Math.max(qHeatMax, s.qHeat || 0); }
    if (s.hot && s.hot.T / s.hot.d.Tmax > hotmax && !noHeat) { hotmax = s.hot.T / s.hot.d.Tmax; hotName = `${s.hot.d.name} ${s.hot.T.toFixed(0)} K of ${s.hot.d.Tmax}`; }
    if (noHeat && s.hot && s.hot.T > hotmax) { hotmax = s.hot.T; hotName = `${s.hot.d.name} ${s.hot.T.toFixed(0)} K`; }
    if (mode === 'sas' && h < 90e3) { const e = Math.acos(Math.min(1, A.dot(A.qrot(s.q, [0, 1, 0]), nose))) / D2R; aoaErrMax = Math.max(aoaErrMax, e); aoaErrSum += e; aoaErrN++; if (e > 60) tumble++; }
    const vv = A.dot(vA, up), vh = Math.sqrt(Math.max(0, sp * sp - vv * vv)); track += vh * A.DT * B.R / A.len(s.r);
    if (agl < 1000 && !km1) km1 = { t: A.t, sink: -vv, vh, sp };
    last = { h, agl, sp, sink: -vv, vh, M, sea: !!A.seaAt(B, pf) };
    if (!s.alive) { why = s.lossWhy || msgs[msgs.length - 1] || 'lost'; break; }
    if (s.landed) { why = 'landed'; break; }
    if (agl < 3) { why = 'at the ground'; break; }
    if (s.parts.filter(p => p.on).length < stack.length && !why) { why = 'broke: ' + (msgs.find(m => /Structural|burned/.test(m)) || '?'); break; }
  }
  const ms = performance.now() - wall, pf1 = A.norm(A.toPF(B, s.r, A.t));
  const ang = Math.acos(Math.min(1, A.dot(pf0, pf1))), lat = Math.asin(pf1[1]);
  const LD = k => bands[k][2] ? (bands[k][0] / bands[k][1]).toFixed(2) : '-';
  console.log(`${name}  [${mode}${noHeat ? ', heat off' : ''}] m ${m0.toFixed(0)} kg`);
  console.log(`  end: ${why || 'time out'} after ${(A.t - t0).toFixed(0)} s (${steps} steps, ${(ms / steps * 1000).toFixed(0)} us a step)${nan ? ' NaN!' : ''}`);
  console.log(`  ground track ${(track / 1e3).toFixed(0)} km (end point ${(ang * B.R / 1e3).toFixed(0)} km from entry), cross-range ${(lat * B.R / 1e3).toFixed(0)} km | peak ${gmax.toFixed(1)} g, q ${(qmax / 1e3).toFixed(1)} kPa, stagnation ${(qHeatMax / 1e4).toFixed(0)} W/cm2, hottest ${hotName}, wings ${finT.toFixed(0)} K`);
  console.log(`  L/D  M>5 ${LD('M>5')} | M2-5 ${LD('M2-5')} | M0.3-0.9 ${LD('M0.3-0.9')}`);
  if (km1 && last) console.log(`  at 1 km: ${km1.sp.toFixed(0)} m/s, sink ${km1.sink.toFixed(0)}, forward ${km1.vh.toFixed(0)} | at the end (${last.agl.toFixed(0)} m, ${last.sea ? 'sea' : 'land'}): ${last.sp.toFixed(0)} m/s, sink ${last.sink.toFixed(1)}, forward ${last.vh.toFixed(0)}`);
  else if (last) console.log(`  last: h ${(last.h / 1e3).toFixed(1)} km, ${last.sp.toFixed(0)} m/s, M ${last.M.toFixed(1)}`);
  if (mode === 'sas') console.log(`  attitude: worst error ${aoaErrMax.toFixed(0)} deg below 90 km, ${(tumble * A.DT).toFixed(0)} s more than 60 deg off, mean error ${(aoaErrSum / Math.max(1, aoaErrN)).toFixed(0)} deg, fastest turn ${wmax.toFixed(1)} rad/s`);
  if (nanAt) console.log(`  the step before NaN: h ${(nanAt.h / 1e3).toFixed(1)} km, ${nanAt.sp.toFixed(0)} m/s, turning ${nanAt.w.toExponential(1)} rad/s, aoa ${nanAt.aoa.toFixed(0)}, q ${(nanAt.q / 1e3).toFixed(1)} kPa`);
  const ev = msgs.filter(m => /Structural|burned|lost|destroyed/.test(m)).slice(0, 3); if (ev.length) console.log('  events: ' + ev.join(' | '));
}

const W3 = { stack: ['pod', 't1', 'fins'], span: 3, chord: 2 }, W5 = { stack: ['pod', 't1', 'fins'], span: 5, chord: 2 };
const only = process.argv[2];
const runs = [
  { name: 'ballistic: pod + shield, shield first', stack: ['pod', 'shield'], retro: true, aoa: 0 },
  { name: 'wings 3x2, nose first, aoa 0 (no lift)', ...W3, aoa: 0 },
  { name: 'wings 3x2, aoa 15', ...W3, aoa: 15 },
  { name: 'wings 3x2, aoa 15, heat off', ...W3, aoa: 15, noHeat: true },
  { name: 'wings 3x2, aoa 40 then 15 is not flown: aoa 40 all the way, heat off', ...W3, aoa: 40, noHeat: true },
  { name: 'wings 5x2, aoa 10, heat off', ...W5, aoa: 10, noHeat: true },
  { name: 'wings 5x2, aoa 15, heat off', ...W5, aoa: 15, noHeat: true },
  { name: 'wings 5x2, aoa 15, flare to 35 under 150 m, heat off', ...W5, aoa: 15, flare: { below: 150, aoa: 35 }, noHeat: true },
  { name: 'wings 5x2, aoa 10, flare holding 2 m/s sink under 60 m, heat off', ...W5, aoa: 10, flare: { below: 60, sink: 2, k: 2 }, noHeat: true },
  { name: 'wings 3x2, aoa 15, flare holding 2 m/s sink under 60 m, heat off', ...W3, aoa: 15, flare: { below: 60, sink: 2, k: 2 }, noHeat: true },
  { name: 'wings 5x2, aoa 15, bank 45, heat off', ...W5, aoa: 15, bank: 45, noHeat: true },
  { name: 'wings 3x2, aoa 15, bank 45, heat off', ...W3, aoa: 15, bank: 45, noHeat: true },
  { name: 'wings 5x2, aoa 15, the game SAS and wheels, heat off', ...W5, aoa: 15, mode: 'sas', noHeat: true },
  { name: 'wings 3x2, aoa 15, the game SAS and wheels, heat off', ...W3, aoa: 15, mode: 'sas', noHeat: true },
  { name: 'wings 5x2, no control at all (SAS off), heat off', ...W5, aoa: 0, mode: 'free', noHeat: true },
];
for (const [i, r] of runs.entries()) if (only == null || +only === i) fly(r);
