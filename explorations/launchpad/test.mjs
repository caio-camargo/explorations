// Headless checks for Launchpad's simulation core. Run: node test.mjs
// Extracts the "SIM BEGIN … SIM END" block from index.html and drives it with no DOM or GL.
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `
return {nodeInfo,nodeBurnTime,predictFrom,dvPlan,kepler,elements,timeToNu,predict,newShip,physStep,rails,railsOK,stage,stageStats,dvRemaining,localFrame,qFromBasis,qrot,cross,norm,len,sub,add,mul,dot,probe,firstSeg,geom,INP,surfVel,SND,
  TELLUS,SELENE,PRESETS,HOOK,moonPos,moonVel,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v},DT};`)();
const { kepler, elements, len, sub, add, mul, dot, norm, cross, TELLUS, SELENE } = api;
const log = [];
api.HOOK.msg = m => log.push(`[t=${api.t.toFixed(1)}] ${m}`);
let fails = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

// 1. Kepler propagation: a full period returns to the start; forward then back is identity (ellipse + hyperbola).
{
  const mu = TELLUS.mu, r0 = [680000, 0, 0], v0 = [0, 120, -2400];
  const el = elements(r0, v0, mu);
  const [r1, v1] = kepler(r0, v0, el.period, mu);
  check('ellipse: one period returns home', len(sub(r1, r0)) < 1e-3, `err ${len(sub(r1, r0)).toExponential(2)} m`);
  const [r2, v2] = kepler(r0, v0, 12345.6, mu), [r3] = kepler(r2, v2, -12345.6, mu);
  check('ellipse: forward/back identity', len(sub(r3, r0)) < 1e-3, `err ${len(sub(r3, r0)).toExponential(2)} m`);
  const vh = [0, 0, -4200], [r4, v4] = kepler(r0, vh, 50000, mu), [r5] = kepler(r4, v4, -50000, mu);
  const E = (r, v) => dot(v, v) / 2 - mu / len(r);
  check('hyperbola: forward/back identity', len(sub(r5, r0)) < 1e-2, `err ${len(sub(r5, r0)).toExponential(2)} m`);
  check('hyperbola: energy conserved', Math.abs(E(r4, v4) - E(r0, vh)) / Math.abs(E(r0, vh)) < 1e-9);
  // drift comparison: 10 days of a low orbit via Kepler steps vs. symplectic Euler at DT
  const steps = 10 * 86400;
  let [ra, va] = [r0, [0, 0, -Math.sqrt(mu / 680000)]];
  const e0 = E(ra, va);
  for (let i = 0; i < 1000; i++) [ra, va] = kepler(ra, va, steps / 1000, mu);
  let rb = r0.slice(), vb = [0, 0, -Math.sqrt(mu / 680000)];
  const t0 = performance.now();
  for (let i = 0; i < steps / 0.02; i++) { const rl = len(rb), a = mul(rb, -mu / (rl * rl * rl)); vb = add(vb, mul(a, 0.02)); rb = add(rb, mul(vb, 0.02)); }
  const ms = performance.now() - t0;
  console.log(`      10-day low orbit: Kepler energy drift ${(Math.abs(E(ra, va) - e0) / Math.abs(e0)).toExponential(1)}, ` +
    `Euler@50Hz drift ${(Math.abs(E(rb, vb) - e0) / Math.abs(e0)).toExponential(1)}, radius error ${(Math.abs(len(rb) - 680000)).toFixed(0)} m, ${ms.toFixed(0)} ms for 43.2M steps`);
}

// 2. Stage maths for the presets
for (const [k, st] of Object.entries(api.PRESETS)) {
  const { stages, mass } = api.stageStats(st);
  console.log(`      ${k.padEnd(8)} ${mass.toFixed(2)} t  ` + stages.map((s, i) => `S${i + 1} ${s.dvV.toFixed(0)} m/s TWR ${s.twr.toFixed(2)}`).join(' | ') +
    `  total ${stages.reduce((a, s) => a + s.dvV, 0).toFixed(0)}`);
}

// 3. Fly the Orbiter preset: scripted gravity turn, attitude set directly (this tests physics, not piloting).
function fly(preset, { turnStart = 1000, turnEnd = 45000, target = 80000, verbose = true } = {}) {
  api.t = 0; const s = api.newShip(api.PRESETS[preset]); api.S = s; s.sas = false;
  s.throttle = 1; api.stage(s);
  let phase = 'ascent', maxQ = 0, maxG = 0, guard = 0, dvUsed = 0, lastV = len(s.v);
  const point = (pitchDeg) => { const f = api.localFrame(s.r), p = pitchDeg * Math.PI / 180;
    const Y = norm(add(mul(f.e, Math.cos(p)), mul(f.up, Math.sin(p)))), X = norm(cross(Y, f.n));
    s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  while (guard++ < 400000 && s.alive) {
    const h = len(s.r) - TELLUS.R, el = elements(s.r, s.v, TELLUS.mu);
    if (phase === 'ascent') {
      const f = Math.min(1, Math.max(0, (h - turnStart) / (turnEnd - turnStart)));
      point(90 * (1 - Math.pow(f, 0.6)));
      if (el.ap - TELLUS.R > target) { s.throttle = 0; phase = 'coast'; }
    } else if (phase === 'coast') {
      point(0);
      if (h > TELLUS.atm && el.ap - TELLUS.R < target - 500) s.throttle = 0.3; else if (h < TELLUS.atm) s.throttle = el.ap - TELLUS.R < target ? 0.2 : 0;
      else s.throttle = 0;
      if (h > TELLUS.atm && api.timeToNu(el, Math.PI) < 25) phase = 'circ';
    } else if (phase === 'circ') {
      // burn along the local horizontal (prograde-ish) at apoapsis
      const f = api.localFrame(s.r), hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up))));
      const X = norm(cross(hv, f.n)); s.q = api.qFromBasis(X, hv, cross(X, hv)); s.w = [0, 0, 0];
      s.throttle = 1;
      if (el.pe - TELLUS.R > 72000) { s.throttle = 0; phase = 'done'; break; }
    }
    if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) api.stage(s);
    const v0 = s.v.slice();
    api.physStep(s, api.DT);
    if (s.thrust > 0) dvUsed += s.thrust / s.mass * api.DT;
    maxQ = Math.max(maxQ, s.qdyn); maxG = Math.max(maxG, s.gload);
  }
  const el = elements(s.r, s.v, TELLUS.mu), dv = api.dvRemaining(s);
  return { s, phase, el, maxQ, maxG, dvUsed, dvLeft: dv.tot, t: api.t };
}
{
  const r = fly('Orbiter');
  const ap = (r.el.ap - TELLUS.R) / 1000, pe = (r.el.pe - TELLUS.R) / 1000;
  check('Orbiter reaches a stable orbit', r.phase === 'done' && pe > 70, `Ap ${ap.toFixed(1)} km, Pe ${pe.toFixed(1)} km at T+${r.t.toFixed(0)} s; ` +
    `Δv spent ${r.dvUsed.toFixed(0)} m/s, left ${r.dvLeft.toFixed(0)} m/s; max q ${(r.maxQ / 1000).toFixed(1)} kPa, max ${r.maxG.toFixed(1)} g`);
  // 3b. once there, the orbit is held on rails: 30 days of warp must not move Ap/Pe
  const s = r.s, e0 = elements(s.r, s.v, TELLUS.mu);
  check('railsOK in orbit', api.railsOK(s));
  const t0 = performance.now(); let frames = 0;
  while (api.t < r.t + 30 * 86400) { api.rails(s, 100000 / 60); frames++; }
  const e1 = elements(s.r, s.v, TELLUS.mu);
  check('30 days at 100000× changes nothing', Math.abs(e1.ap - e0.ap) < 0.01 && Math.abs(e1.pe - e0.pe) < 0.01,
    `ΔAp ${(e1.ap - e0.ap).toExponential(1)} m, ΔPe ${(e1.pe - e0.pe).toExponential(1)} m; ${((performance.now() - t0) / frames * 1000).toFixed(1)} µs per warp frame`);
}
// 4. Lunar transfer: from a circular 80 km orbit, a prograde kick at the right phase finds Selene.
{
  api.t = 0; const mu = TELLUS.mu, r = 680000, vc = Math.sqrt(mu / r), vp = Math.sqrt(mu * (2 / r - 2 / (r + SELENE.a)));
  // transfer time; lead the moon so it arrives at apoapsis
  const at = (r + SELENE.a) / 2, tof = Math.PI * Math.sqrt(at ** 3 / mu);
  const moonAtArrival = moonPos(tof), dir = norm(mul(moonAtArrival, -1));          // depart opposite the arrival point
  const s = api.newShip(api.PRESETS.Lunar); api.S = s; s.landed = false;
  const tang = cross([0, 1, 0], dir);  // prograde direction (equatorial, same sense as Selene)
  s.r = mul(dir, r); s.v = mul(tang, vp);
  const p = api.predict(s);
  const enc = p.find(x => x.endKind === 'enc');
  check('predict() finds the Selene encounter', !!enc, enc ? `encounter in ${((enc.endT) / 3600).toFixed(1)} h, Selene Pe ${((p[1].el.pe - SELENE.R) / 1000).toFixed(0)} km; TMI Δv ${(vp - vc).toFixed(0)} m/s` : JSON.stringify(p.map(x => x.endKind)));
  // fly it on rails and check the SOI switch actually happens near the predicted time
  let switched = null;
  while (api.t < tof * 1.3) { api.rails(s, 50); if (s.body === SELENE && switched === null) { switched = api.t; break; } }
  check('rails switches into Selene SOI on schedule', switched !== null && enc && Math.abs(switched - enc.endT) < 60,
    switched ? `switched at ${(switched / 3600).toFixed(2)} h vs predicted ${(enc.endT / 3600).toFixed(2)} h` : 'never switched');
}

// 5. Aerodynamics + structure (v1.2): stability from shape, real-dynamics flights, coasting, abuse, re-entry, determinism.
{
  const P = api.PRESETS, noFin = st => st.filter(x => x !== 'fins');
  const margin = st => { const s = api.newShip(st), r = api.probe(s, { M: 0.6, aoa: 4, q: 5000, h: 3000 }); return (r.ycm - r.ycp) / (2 * s.radius); };
  const mO = margin(P.Orbiter), mL = margin(P.Lunar), mOn = margin(noFin(P.Orbiter)), mLn = margin(noFin(P.Lunar));
  check('fins make the presets stable, removing them makes them unstable', mO > 0.5 && mL > 0.5 && mOn < 0 && mLn < 0,
    `margins (calibers) Orbiter ${mO.toFixed(2)} / no fins ${mOn.toFixed(2)}, Lunar ${mL.toFixed(2)} / no fins ${mLn.toFixed(2)}`);
  const lift = api.probe(api.newShip(P.Lunar), { thr: 1 }).worst;
  check('liftoff loads well inside limits', lift.frac < 0.5, `Lunar worst joint ${(lift.frac * 100).toFixed(0)}% (${lift.kind})`);

  function flySAS(stack, { yank = null } = {}) {
    api.t = 0; const s = api.newShip(stack); api.S = s; const msgs = []; api.HOOK.msg = m => msgs.push(m);
    s.throttle = 1; api.stage(s); let maxLoad = 0, maxQ = 0;
    while (api.t < 600 && s.alive) {
      api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0;
      if (yank && s.qdyn > 15000 && !yank.done) { yank.t0 = yank.t0 ?? api.t; api.INP.pitch = 1; if (api.t > yank.t0 + yank.dur) yank.done = true; }
      if (api.t > 9.8) s.sasMode = 'pro';
      const el = elements(s.r, s.v, TELLUS.mu); if (el.ap - TELLUS.R > 80000) s.throttle = 0;
      if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.stage(s);
      api.physStep(s, api.DT); maxLoad = Math.max(maxLoad, s.maxLoad); maxQ = Math.max(maxQ, s.qdyn);
      if (len(s.r) - TELLUS.R > 70000 && s.throttle === 0) break;
    }
    api.INP.pitch = 0;
    return { ok: s.alive && len(s.r) - TELLUS.R > 70000, maxLoad, maxQ, broke: msgs.find(m => /Structural/.test(m)) };
  }
  for (const k of ['Orbiter', 'Lunar']) { const r = flySAS(P[k]);
    check(`${k}: W-tap + prograde hold reaches space intact`, r.ok && !r.broke, `max q ${(r.maxQ / 1000).toFixed(1)} kPa, worst joint ${(r.maxLoad * 100).toFixed(0)}%`); }
  const y = flySAS(P.Lunar, { yank: { dur: 4 } });
  check('Lunar: 4 s hard pitch at max-q snaps the stack', !!y.broke, y.broke || 'survived');

  function coast(stack) { api.t = 0; const s = api.newShip(stack); api.S = s; api.HOOK.msg = () => {}; s.throttle = 1; api.stage(s);
    while (len(sub(s.v, api.surfVel(TELLUS, s.r))) < 450) api.physStep(s, api.DT);
    s.throttle = 0; s.sas = false; s.w = add(s.w, mul(norm(cross(s.r, [0, 1, 0])), 0.05));
    let m = 0; for (let i = 0; i < 1000; i++) { api.physStep(s, api.DT); m = Math.max(m, s.aoa); } return m * 57.3; }
  const cf = coast(P.Orbiter), cn = coast(noFin(P.Orbiter));
  check('coasting with SAS off: fins weathervane, no fins tumbles', cf < 10 && cn > 90, `max AoA ${cf.toFixed(1)}° with fins, ${cn.toFixed(0)}° without`);

  { api.t = 0; const s = api.newShip(['chute', 'pod']); api.S = s; const msgs = []; api.HOOK.msg = m => msgs.push(m);
    s.landed = false; const f = api.localFrame([TELLUS.R + 75000, 0, 0]); s.r = [TELLUS.R + 75000, 0, 0]; s.v = add(mul(f.e, 2300), mul(f.up, -60));
    const Y = norm(add(f.e, mul(f.up, -0.03))), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.sas = false;
    let staged = false, shield = 0, n = 0;
    while (s.alive && !s.landed && api.t < 4000) { const h = len(s.r) - TELLUS.R; if (!staged && h < 20000) { api.stage(s); staged = true; }
      api.physStep(s, api.DT); if (h < 50000 && h > 25000 && s.qdyn > 500) { n++; if (s.aoa > 2.3) shield++; } }
    check('bare pod re-enters shield-first and lands under its chute', s.landed && shield / n > 0.8, `${(100 * shield / n).toFixed(0)}% of the hot phase shield-first; ${msgs.slice(-1)[0]}`); }

  function det(chunk) { api.t = 0; const s = api.newShip(P.Lunar); api.S = s; api.HOOK.msg = () => {}; s.throttle = 1; api.stage(s);
    for (let i = 0; i < 8000;) for (let k = 0; k < chunk && i < 8000; k++, i++) { api.INP.pitch = (i > 400 && i < 440) ? 1 : 0; if (i > 500) s.sasMode = 'pro'; api.physStep(s, api.DT); }
    api.INP.pitch = 0; return s; }
  const t0 = performance.now(), d1 = det(1), us = (performance.now() - t0) * 1000 / 8000, d2 = det(100);
  check('physics warp is exact: 1× and 100× flights are bit-identical', d1.r.every((x, i) => x === d2.r[i]) && d1.q.every((x, i) => x === d2.q[i]),
    `${us.toFixed(1)} µs per step (13 parts) → 100× costs ${(us * 100 / 60 / 0.02 / 1000).toFixed(2)} ms per 60 Hz frame`);
}
// 6. Radial attachment (v1.3): side boosters on the Heavy preset.
{
  const H = api.PRESETS.Heavy, s = api.newShip(H), ev = s.events.map(e => (e.decouple.length ? (e.radial ? 'drop-side' : 'drop') : '') + (e.ignite.length ? `ignite${e.ignite.length}` : '') + (e.chute ? 'chute' : ''));
  check('Heavy: boosters light with the core, drop first, then the core stage', ev.join(',') === 'ignite3,drop-side,dropignite1,chute', ev.join(','));
  check('Heavy: symmetric — centre of mass on the axis', Math.hypot(s.cm[0], s.cm[2]) < 1e-9, `cm (${s.cm.map(x => x.toFixed(3)).join(', ')})`);
  const plan = api.dvPlan(s, 0).filter(x => x.dv > 0.5), r = api.probe(s, { M: 0.6, aoa: 4, q: 5000, h: 3000 }), cal = (r.ycm - r.ycp) / (2 * s.radius);
  check('Heavy: parallel-burn Δv plan has three stages, design is stable', plan.length === 3 && cal > 0.5,
    `${plan.map(x => x.dv.toFixed(0)).join(' / ')} m/s, margin ${cal.toFixed(2)} cal`);
  const lift = api.probe(s, { thr: 1 }).worst;
  check('Heavy: booster thrust reaches the core through the radial decoupler (shear)', lift.kind === 'shear' && /rdec/.test(lift.p.d.key + lift.p.parent.d.key) && lift.frac < 0.5,
    `${(lift.frac * 100).toFixed(0)}% ${lift.kind} at ${lift.p.d.name} / ${lift.p.parent.d.name}`);
  api.t = 0; const f = api.newShip(H); api.S = f; const msgs = [], deb = []; api.HOOK.msg = m => msgs.push(m);
  const oldDeb = api.HOOK.debris; api.HOOK.debris = d => deb.push({ parts: d.parts.length, rel: api.qrot(qconj(f.q), sub(d.v, f.v)) });
  f.throttle = 1; api.stage(f);
  while (api.t < 100 && f.alive) { api.INP.pitch = (api.t >= 8 && api.t < 9.5) ? 1 : 0; if (api.t > 10.5) f.sasMode = 'pro';
    if (api.dvRemaining(f).cur <= 0.5 && f.evIdx < f.events.length - 1) api.stage(f); api.physStep(f, api.DT); }
  api.INP.pitch = 0; api.HOOK.debris = oldDeb;
  const side = deb.slice(0, 2);
  check('Heavy: boosters separate outward, opposite each other, then the core stage drops', f.alive && msgs.filter(m => /Booster burnout/.test(m)).length === 1 &&
    side.length === 2 && side[0].rel[0] * side[1].rel[0] < 0 && Math.abs(side[0].rel[0]) > 2 && deb.length === 3,
    `booster debris ${side.map(d => `(${d.rel.map(x => x.toFixed(1)).join(', ')})`).join(' & ')} m/s; ${msgs.filter(m => /separation|burnout|Flameout/.test(m)).join(' → ')}`);
}
function qconj(q) { return [-q[0], -q[1], -q[2], q[3]]; }
// 7. Maneuver nodes (v1.4): plan a Hohmann transfer, fly it with SAS on the node, compare plan vs result.
{
  const mu = TELLUS.mu, r0 = 680000, vc = Math.sqrt(mu / r0), vp = Math.sqrt(mu * (2 / r0 - 2 / (r0 + SELENE.a))), dvH = vp - vc;
  const orbitShip = () => { api.t = 0; const s = api.newShip(['chute', 'pod', 't2', 'petrel']); api.S = s; api.HOOK.msg = () => {};
    s.landed = false; s.r = [r0, 0, 0]; s.v = [0, 0, -vc]; api.stage(s); return s; };
  // plan only: the dashed trajectory's apoapsis must be the textbook one
  let s = orbitShip(); s.node = { t: 600, dv: [dvH, 0, 0] };
  let I = api.nodeInfo(s), plan = api.predictFrom({ b: s.body, r: I.rN, v: add(I.vN, I.rem), t: I.t });
  const apPlan = plan[0].el.ap ?? plan[0].el.a * 2;
  check('node plan: +856 m/s prograde from 80 km reaches Selene\'s orbit', Math.abs(apPlan - SELENE.a) < 1000 || plan[0].endKind === 'enc',
    `planned Ap ${((apPlan) / 1e3).toFixed(1)} km from centre (target ${(SELENE.a / 1e3).toFixed(1)}), legs: ${plan.map(x => x.b.name + (x.endKind ? '→' + x.endKind : '')).join(' | ')}`);
  s.node.dv = [0, 200, 0]; I = api.nodeInfo(s); plan = api.predictFrom({ b: s.body, r: I.rN, v: add(I.vN, I.rem), t: I.t });
  const inc = Math.acos(plan[0].el.h[1] / plan[0].el.hl) * 57.2958;
  check('node plan: 200 m/s normal tilts the orbit by atan(200/v)', Math.abs(inc - Math.atan(200 / vc) * 57.2958) < 0.01, `inclination ${inc.toFixed(3)}° (expected ${(Math.atan(200 / vc) * 57.2958).toFixed(3)}°)`);
  // fly it: SAS → node, coast on rails to the burn window, full throttle until the node clears itself
  s = orbitShip(); s.node = { t: 900, dv: [dvH, 0, 0] }; s.sas = true; s.sasMode = 'node'; s.hold = null;
  I = api.nodeInfo(s); plan = api.predictFrom({ b: s.body, r: I.rN, v: add(I.vN, I.rem), t: I.t });
  const est = api.nodeBurnTime(s, len(I.rem)); s.node.est = est; const start = 900 - est / 2;
  while (api.t < start - 6) api.rails(s, Math.min(5, start - 6 - api.t));
  for (let k = 0; k < 300; k++) { s.throttle = 0; api.physStep(s, api.DT); }   // settle attitude on the node vector (6 s)
  s.throttle = 1; let n = 0; while (s.node && n++ < 20000) api.physStep(s, api.DT);
  const elA = elements(s.r, s.v, mu), err = Math.abs(elA.ap - apPlan) / apPlan;
  check('node burn: SAS-pointed finite burn lands within 1% of the planned apoapsis, then cuts the throttle', !s.node && s.throttle === 0 && err < 0.01,
    `burn ${(n * api.DT).toFixed(1)} s (estimate ${est.toFixed(1)} s); Ap ${(elA.ap / 1e3).toFixed(0)} km vs plan ${(apPlan / 1e3).toFixed(0)} km (${(err * 100).toFixed(2)}%)`);
}

function moonPos(t) { return api.moonPos(t); }
console.log(log.slice(0, 12).join('\n'));
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
