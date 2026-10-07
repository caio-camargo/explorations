// Headless checks for Launchpad's simulation core. Run: node test.mjs
// Extracts the "SIM BEGIN … SIM END" block from index.html and drives it with no DOM or GL.
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `
return {chooseStart,own,stateShare,ownKind,floorCheck,offerDecision,resolveDecision,income,valuation,pickClient,rng,acceptOffer,CT,capOf,ensureBoard,standOf,GRANT_100,wearOf,makePowers,POWERS,powerAt,relOf,opOf,advanceDays,DAY_S,prepDays,HOME,vesselCost,FUNDS0,FUNDS_FLOOR,REFURB,advPhys,advRails,PROG,MISSIONS,missionEnd,missionDrop,safetyReview,certOf,atmU,G_LIM,CERT0,CITIES,landValue,isLand,dropVerdict,debrisImpact,fall,surfVelX:null,predictImpact,tapeNew,tapePhys,tapeRails,tapeStage,tapePlay,tapeDuration,toPF,railsOK,segFuel,stageStats,partMass,PARTS,analyze,nodeInfo,nodeBurnTime,predictFrom,dvPlan,kepler,elements,timeToNu,predict,newShip,physStep,rails,railsOK,stage,stageStats,dvRemaining,localFrame,qFromBasis,qrot,cross,norm,len,sub,add,mul,dot,probe,firstSeg,geom,INP,surfVel,SND,
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
// 13. The world (v1.9): cities on land and clear of the pad; dropped stages land where predicted; verdicts.
{
  const C = api.CITIES, R = TELLUS.R, gc = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * R;
  check('cities: ~30, all inland (land mask with margin), none within 150 km of the pad, ≥250 km apart',
    C.length >= 20 && C.every(c => api.landValue(c.u) >= 0.58) && C.every(c => gc(c.u, [1, 0, 0]) > 150e3) && C.every((c, i) => C.every((d, j) => i === j || gc(c.u, d.u) > 250e3)),
    `${C.length} cities, nearest to the pad ${(Math.min(...C.map(c => gc(c.u, [1, 0, 0]))) / 1e3).toFixed(0)} km, populations ${(Math.min(...C.map(c => c.pop)) / 1e3).toFixed(0)}k–${(Math.max(...C.map(c => c.pop)) / 1e6).toFixed(1)}M`);
  const c0 = C[0], v1 = api.dropVerdict(TELLUS, mul(c0.u, R)), far = api.dropVerdict(TELLUS, mul(norm(add(c0.u, [0, 0.2, 0])), R));
  check('drop verdict: a stage on a city centre is a city hit; far away it is land or sea', v1.kind === 'city' && v1.city === c0 && (far.kind === 'land' || far.kind === 'sea'),
    `${c0.name}: ${v1.kind}; 1200 km away: ${far.kind}`);
  // a dropped first stage, predicted at separation vs flown on its own with the same drag
  api.t = 0; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; api.HOOK.msg = () => {}; let got = null;
  api.HOOK.debris = d => { if (got) return; const pred = api.debrisImpact(d); let r = d.r.slice(), v = d.v.slice(), tt = api.t;
    while (len(r) - R > 0) { const rl = len(r); let a = r.map(x => -TELLUS.mu * x / rl ** 3); const h = rl - R, rho = h < 70000 ? 1.225 * Math.exp(-h / 5600) : 0,
      va = [v[0] - TELLUS.rot * r[2], v[1], v[2] + TELLUS.rot * r[0]], sp = len(va);
      if (rho > 0 && sp > 0.1) { let ad = 0.5 * rho * sp * 2.5 / d.mass; if (ad * api.DT > 0.9) ad = 0.9 / api.DT; a = a.map((x, i) => x - ad * va[i]); }
      v = v.map((x, i) => x + a[i] * api.DT); r = r.map((x, i) => x + v[i] * api.DT); tt += api.DT; }
    got = { pred, pf: api.toPF(TELLUS, r, tt), t: tt }; };
  s.throttle = 1; api.stage(s); let ph = 'asc';
  while (api.t < 900 && s.alive && ph !== 'done') { api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0; if (api.t > 9.8) s.sasMode = 'pro';
    const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - R;
    if (ph === 'asc' && el.ap - R > 80000) { s.throttle = 0; ph = 'coast'; } if (ph === 'coast' && h > 70000 && api.timeToNu(el, Math.PI) < 25) { s.throttle = 1; ph = 'circ'; }
    if (ph === 'circ' && el.pe - R > 70000) { s.throttle = 0; ph = 'done'; }
    if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.stage(s); api.physStep(s, api.DT); }
  api.INP.pitch = 0; api.HOOK.debris = () => {};
  check('drop zones: the Orbiter\'s spent first stage lands where it was predicted at separation', got && gc(got.pred.pf, got.pf) < 500 && Math.abs(got.pred.t - got.t) < 2,
    got ? `${(gc(got.pred.pf, [1, 0, 0]) / 1e3).toFixed(0)} km downrange, prediction off ${gc(got.pred.pf, got.pf).toFixed(0)} m / ${(got.pred.t - got.t).toFixed(1)} s; ${api.dropVerdict(TELLUS, got.pred.pf).kind}` : 'no stage dropped');
}

// 11. Impact prediction (v1.8): predicted vs actual landing, through the air and onto Selene.
{
  const R = TELLUS.R, clamp = (x, a, b) => Math.max(a, Math.min(b, x)), gc = (a, b) => { const A = norm(a), B = norm(b); return Math.acos(clamp(dot(A, B), -1, 1)); };
  function compare(name, setup, predictAt) {
    api.t = 0; const s = api.newShip(setup.stack); api.S = s; api.HOOK.msg = () => {}; setup.init(s);
    let pred = null, steps = 0, lastV = 0;
    while (s.alive && !(s.landed && api.t > 1) && api.t < 6000 && steps++ < 400000) { if (!pred && predictAt(s)) { pred = { p: api.predictImpact(s), t0: api.t }; if (process.env.DBG) console.log(name, api.t, len(s.r) - R, JSON.stringify(api.INP), s.sasMode, !!pred.p); }
      lastV = len(sub(s.v, api.surfVel(s.body, s.r))); if (api.railsOK(s) && !s.landed) api.rails(s, 2); else api.physStep(s, api.DT); }
    const b = s.body, act = api.toPF(b, s.r, api.t), p = pred && pred.p;
    const dist = p ? gc(p.pf, act) * b.R : NaN, dt = p ? p.t - api.t : NaN;
    const vLand = lastV;
    return { ok: !!p, dist, dt, flight: api.t - (pred ? pred.t0 : 0), v: p && p.v, vAct: s.crashSpeed ?? 'landed', dv: p ? p.v - (s.crashSpeed ?? vLand) : NaN };
  }
  const hop = compare('hopper', { stack: ['chute', 'pod', 't2', 'fins', 'kestrel'], init: s => { s.throttle = 1; api.stage(s); } },
    s => { api.INP.pitch = api.t >= 5 && api.t < 5.4 ? 1 : 0; if (api.t > 6) s.sasMode = 'pro'; return !s.landed && api.t > 30 && dot(s.v, s.r) < 0; });
  api.INP.pitch = 0;
  check('impact prediction: a ballistic Hopper from apex lands where predicted', hop.ok && hop.dist < 2000 && Math.abs(hop.dt) < 10,
    `predicted ${(hop.flight).toFixed(0)} s ahead: ${(hop.dist / 1000).toFixed(2)} km off, ${hop.dt.toFixed(1)} s early/late; predicted ${hop.v.toFixed(0)} m/s, actual ${typeof hop.vAct === 'number' ? hop.vAct.toFixed(0) : hop.vAct} m/s`);
  const pod = compare('pod', { stack: ['chute', 'pod', 'shield'], init: s => { s.landed = false; const f = api.localFrame([R + 75000, 0, 0]); s.r = [R + 75000, 0, 0];
      s.v = add(mul(f.e, 2250), mul(f.up, -60)); const d = norm(s.v), Y = mul(d, -1), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.sas = false; api.stage(s); } },
    s => len(s.r) - R < 25000);
  // 5 km since v1.12: with the drogue held until ~Mach 1.3, more of the descent is fast, where the unmodelled trim lift accumulates
  check('impact prediction: a re-entering pod under its parachute, predicted from 25 km', pod.ok && pod.dist < 5000 && Math.abs(pod.dv) < 0.5,
    `${(pod.dist / 1000).toFixed(2)} km off, ${pod.dt.toFixed(0)} s; touchdown ${pod.v.toFixed(1)} m/s predicted. (From 74 km it is ~40 km off of 760: the capsule's trim lift is not modelled)`);
  const moon = compare('selene', { stack: ['pod', 't1', 'wren'], init: s => { s.landed = false; s.body = SELENE; s.r = [SELENE.R + 30000, 0, 0]; s.v = [0, 0, -400]; s.sas = false; } },
    s => true);
  check('impact prediction: an unpowered fall onto airless Selene is exact (Kepler)', moon.ok && moon.dist < 300,
    `${(moon.dist).toFixed(0)} m off after ${(moon.flight).toFixed(0)} s, ${moon.dt.toFixed(2)} s; ${moon.v.toFixed(0)} m/s`);
}
// 12. Flight tapes (v1.8): record a whole flight to orbit, replay it with different chunking, demand a bit-identical result.
{
  const mu = TELLUS.mu, R = TELLUS.R;
  api.t = 0; let s = api.newShip(api.PRESETS.Orbiter); api.S = s; api.HOOK.msg = () => {}; const T = api.tapeNew(api.PRESETS.Orbiter);
  s.throttle = 1; api.tapeStage(T, s); let phase = 'asc', frames = 0;
  while (api.t < 1500 && s.alive && phase !== 'done') { frames++;
    api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0; if (api.t > 9.8 && s.sasMode !== 'pro') s.sasMode = 'pro';
    const el = elements(s.r, s.v, mu), h = len(s.r) - R;
    if (phase === 'asc' && el.ap - R > 80000) { s.throttle = 0; phase = 'coast'; }
    if (phase === 'coast' && h > 70000 && api.timeToNu(el, Math.PI) < 20) { s.throttle = 1; phase = 'circ'; }
    if (phase === 'circ' && el.pe - R > 70000) { s.throttle = 0; phase = 'done'; }
    if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.tapeStage(T, s);
    if (api.railsOK(s) && !s.landed) api.tapeRails(T, s, 1.7 + (frames % 3) * 0.9, 50); else for (let k = 0; k < 1 + (frames % 4); k++) api.tapePhys(T, s);
  }
  api.INP.pitch = 0; const A = { r: s.r.slice(), v: s.v.slice(), q: s.q.slice(), t: api.t, ap: elements(s.r, s.v, mu).ap - R, pe: elements(s.r, s.v, mu).pe - R };
  const runs = [7, 1000].map(budget => { api.t = 0; const s2 = api.newShip(api.PRESETS.Orbiter); api.S = s2; const pl = { tape: T, i: 0, n: 0 };
    while (api.tapePlay(pl, s2, budget)); api.INP.pitch = 0; return { r: s2.r, v: s2.v, q: s2.q, t: api.t }; });
  const same = x => x.t === A.t && x.r.every((v, i) => v === A.r[i]) && x.v.every((v, i) => v === A.v[i]) && x.q.every((v, i) => v === A.q[i]);
  check('autopilot tape: a recorded flight to orbit replays bit-identically, in any chunk size', phase === 'done' && runs.every(same),
    `${T.ops.length} ops for ${api.tapeDuration(T).toFixed(0)} s of flight (${(JSON.stringify(T.ops).length / 1024).toFixed(0)} KB), orbit ${(A.ap / 1e3).toFixed(1)} × ${(A.pe / 1e3).toFixed(1)} km, replayed in chunks of 7 and 1000 steps`);
}

// 10. Re-entry heating (v1.7): low-orbit returns are survivable bare, Selene returns need a shield, the ablator is a budget.
{
  const mu = TELLUS.mu, R = TELLUS.R;
  const entry = (ra, hp) => { const r = R + 75000, rp = R + hp, a = (ra + rp) / 2, v = Math.sqrt(mu * (2 / r - 1 / a)), e = (ra - rp) / (ra + rp), h = Math.sqrt(mu * a * (1 - e * e)); return { v, g: Math.acos(Math.min(1, h / (r * v))) }; };
  function enter(stack, ra, hp) { const { v, g } = entry(ra, hp); api.t = 0; const s = api.newShip(stack); api.S = s; const msgs = []; api.HOOK.msg = m => msgs.push(m);
    s.landed = false; const f = api.localFrame([R + 75000, 0, 0]); s.r = [R + 75000, 0, 0]; s.v = add(mul(f.e, v * Math.cos(g)), mul(f.up, -v * Math.sin(g)));
    const d = norm(s.v), Y = mul(d, -1), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.sas = false; let st = false, hot = 0;
    while (s.alive && !s.landed && api.t < 5000) { if (!st && len(s.r) - R < 15000) { api.stage(s); st = true; } api.physStep(s, api.DT);
      for (const p of s.parts) if (p.on && p.d.key === 'pod') hot = Math.max(hot, p.T / p.d.Tmax); }
    const sh = s.parts.find(p => p.d.key === 'shield'); return { landed: s.landed, alive: s.alive, hot, abl: sh ? sh.res.ablator / sh.cap.ablator : null, burned: msgs.find(m => /burned up/.test(m)) }; }
  const leo = enter(['chute', 'pod'], R + 80000, 30000), lun = enter(['chute', 'pod'], 12e6, 30000), lunS = enter(['chute', 'pod', 'shield'], 12e6, 30000);
  check('re-entry: a bare pod survives a low-orbit return, but burns up coming back from Selene', leo.landed && leo.hot < 1 && !lun.alive && /Command pod/.test(lun.burned || ''),
    `LEO pod peaks at ${(leo.hot * 100).toFixed(0)}% of its limit; Selene return: ${lun.burned}`);
  check('re-entry: with a heat shield the Selene return lands, using about half the ablator', lunS.landed && lunS.hot < 0.5 && lunS.abl > 0.2 && lunS.abl < 0.8,
    `pod peaks at ${(lunS.hot * 100).toFixed(0)}%, ${(lunS.abl * 100).toFixed(0)}% ablator left`);
  const asc = k => { api.t = 0; const s = api.newShip(api.PRESETS[k]); api.S = s; api.HOOK.msg = () => {}; s.throttle = 1; api.stage(s); let mx = 0;
    while (api.t < 300 && s.alive) { api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0; if (api.t > 9.8) s.sasMode = 'pro'; const el = elements(s.r, s.v, mu); if (el.ap - R > 80000) s.throttle = 0;
      if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.stage(s); api.physStep(s, api.DT);
      for (const p of s.parts) if (p.on) mx = Math.max(mx, p.T / p.d.Tmax); if (len(s.r) - R > 70000 && s.throttle === 0) break; }
    api.INP.pitch = 0; return mx; };
  const hs = ['Orbiter', 'Lunar', 'Big Lunar'].map(k => [k, asc(k)]);
  check('ascent heating stays well inside part limits on every launch preset', hs.every(x => x[1] < 0.7), hs.map(x => `${x[0]} ${(x[1] * 100).toFixed(0)}%`).join(', '));
}

// 9. Resources and crossfeed (v1.6).
{
  const P = api.PRESETS, J = x => JSON.parse(JSON.stringify(x)), tot = st => api.stageStats(st).stages.reduce((a, x) => a + x.dvV, 0);
  const noX = st => J(st).map(e => typeof e === 'string' ? e : { ...e, rad: { ...e.rad, x: false } }), withX = st => J(st).map(e => typeof e === 'string' ? e : { ...e, rad: { ...e.rad, x: true } });
  const t8 = api.newShip(['t8']).parts[0];
  check('resource mass: a full Tank 8 t weighs dry + propellant', Math.abs(api.partMass(t8) - 8) < 1e-9, `${api.partMass(t8)} t (res ${JSON.stringify(t8.res)})`);
  check('without crossfeed the flow model reproduces the old per-stage numbers', Math.round(tot(P.Orbiter)) === 4894 && Math.round(tot(P.Heavy)) === 5671 && Math.round(tot(P.Lunar)) === 6639,
    `Orbiter ${tot(P.Orbiter).toFixed(0)}, Heavy ${tot(P.Heavy).toFixed(0)}, Lunar ${tot(P.Lunar).toFixed(0)} m/s`);
  const h0 = tot(P.Heavy), h1 = tot(withX(P.Heavy)), a0 = tot(noX(P.Asparagus)), a1 = tot(P.Asparagus);
  check('crossfeed adds Δv: boosters feed the core and drop before it is touched', h1 > h0 + 200 && a1 > a0 + 500,
    `Heavy ${h0.toFixed(0)} → ${h1.toFixed(0)} m/s, Asparagus ${a0.toFixed(0)} → ${a1.toFixed(0)} m/s`);
  api.t = 0; const s = api.newShip(P.Asparagus); api.S = s; api.HOOK.msg = () => {}; s.throttle = 1; api.stage(s);
  const fill = k => { const cap = s.parts.filter(p => p.on && p.seg === k).reduce((a, p) => a + (p.cap.fuel || 0), 0); return cap ? api.segFuel(s, k) / cap : null; };
  let at = null; while (api.t < 120 && !at) { api.physStep(s, api.DT); const d = s.events[1].decouple; if (d.every(k => fill(k) <= 1e-9)) at = s.segs.map((g, k) => [g.label, fill(k)]).filter(x => x[1] !== null); }
  const pairA = at.filter(x => /A ×/.test(x[0])), rest = at.filter(x => !/A ×/.test(x[0]));
  check('asparagus drain order: when pair A runs dry, the core and pair B are still full', pairA.every(x => x[1] === 0) && rest.every(x => x[1] > 0.999),
    `T+${api.t.toFixed(1)} s: ${at.map(x => `${x[0]} ${(x[1] * 100).toFixed(0)}%`).join(', ')}`);
}

// 8. Structural design (v1.5): joint reinforcement, interstage, 2.5 m class.
{
  const P = api.PRESETS, V = f => { const L = JSON.parse(JSON.stringify(P.Lunar)); f(L); return L; };
  function yank(stack, dur) { api.t = 0; const s = api.newShip(stack); api.S = s; const msgs = []; api.HOOK.msg = m => msgs.push(m);
    s.throttle = 1; api.stage(s); let y0 = null;
    while (api.t < 600 && s.alive) { api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0;
      if (s.qdyn > 15000 && (y0 === null || api.t < y0 + dur)) { y0 = y0 ?? api.t; api.INP.pitch = 1; }
      if (api.t > 9.8) s.sasMode = 'pro'; const el = elements(s.r, s.v, TELLUS.mu); if (el.ap - TELLUS.R > 80000) s.throttle = 0;
      if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.stage(s);
      api.physStep(s, api.DT); if (len(s.r) - TELLUS.R > 70000 && s.throttle === 0) break; }
    api.INP.pitch = 0; return { ok: s.alive && len(s.r) - TELLUS.R > 70000 && !msgs.some(m => /Structural/.test(m)), broke: msgs.find(m => /Structural/.test(m)), mass: api.newShip(stack).mass / 1000 }; }
  const base = api.newShip(P.Lunar).mass / 1000;
  const r1 = yank(V(L => { L[9] = { k: 't8', j: 1 }; }), 4);
  check('reinforcing the joint that snapped moves the failure to the next weakest joint', /Decoupler \/ Petrel/.test(r1.broke || '') && Math.abs(r1.mass - base - 0.06) < 0.005,
    `${r1.broke}; +${((r1.mass - base) * 1000).toFixed(0)} kg`);
  const r2 = yank(V(L => { L[8] = 'istage'; }), 4);
  check('an interstage takes the engine out of the load path: the same 4 s yank is survived', r2.ok, `+${((r2.mass - base) * 1000).toFixed(0)} kg, reached space intact`);
  const s = api.newShip(P['Big Lunar']), pr = api.probe(s, { M: 0.6, aoa: 4, q: 5000, h: 3000 }), cal = (pr.ycm - pr.ycp) / (2 * s.radius), r3 = yank(P['Big Lunar'], 0);
  check('Big Lunar (2.5 m first stage + adapter) is stable and flies intact', cal > 0.5 && r3.ok, `margin ${cal.toFixed(2)} cal (on 2.5 m), ${s.mass / 1000 | 0} t`);
  const bad = Object.keys(P).filter(k => { try { const a = api.analyze(api.newShip(P[k])); return !(a.lift.worst.frac >= 0 && api.newShip(P[k]).parts.some(p => p.parent)); } catch (e) { return true; } });
  check('builder analysis runs on every preset (per-joint worst loads)', !bad.length, bad.length ? 'failed: ' + bad.join(', ') : Object.keys(P).join(', '));
  const cav = st => api.newShip(st).lines[0].E.filter(e => e.cav).length;
  check('the interstage shell closes the engine cavity in the aero profile', cav(P.Orbiter) > cav(P.Orbiter.map(k => k === 'dec' ? 'istage' : k)),
    `cavity edges ${cav(P.Orbiter)} → ${cav(P.Orbiter.map(k => k === 'dec' ? 'istage' : k))}`);
}

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

// 14. The program (v1.12): missions read a flight record; knowledge (certified ratings, the atmosphere) is earned by flying.
{
  const P = api.PROG, fresh = () => Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: api.FUNDS0, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [] });
  const news = []; api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {};
  const launch = st => { api.t = 0; const s = api.newShip(st); api.S = s; s.throttle = 1; api.stage(s); return s; };
  // a sounding flight: straight up on the Sounding preset, chute armed once falling, down to the ground
  fresh(); let s = launch(api.PRESETS.Sounding), armed = false, n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) {
    if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; }
    api.advPhys(s);
  }
  const R = s.rec, bands = Object.keys(P.atm).map(Number).sort((a, b) => a - b);
  check('sounding flight: instrument package to altitude and home under the chute completes "Above the weather"', !!P.done.weather && R.recSci,
    `apex ${(R.apex / 1e3).toFixed(1)} km, landed ${s.landed}, max-q ${(R.sciQ / 1e3).toFixed(1)} kPa, ${(api.t / 60).toFixed(1)} min`);
  check('recovered air samples mark the bands flown through as known', bands.length >= 2 && bands[0] === 0 && bands.every((k, i) => k === i) && bands.length === Math.min(7, Math.floor(R.apex / 1e4) + 1),
    `bands ${bands.map(k => k * 10 + '–' + (k + 1) * 10).join(', ')} km`);
  const before = api.certOf('sparrow'); api.missionEnd(s); const kc = api.certOf('sparrow'), fc = api.certOf('fins'), tc = api.certOf('t1');
  check('telemetry from an instrumented flight raises certified ratings, for the parts that flew only, never past 100 %', before === api.CERT0 && kc > api.CERT0 && fc > api.CERT0 && tc > api.CERT0 && api.certOf('condor') === api.CERT0 && Math.max(kc, fc, tc) < 1,
    `sparrow ${(kc * 100).toFixed(0)}%, fins ${(fc * 100).toFixed(0)}%, tank ${(tc * 100).toFixed(0)}%, condor (didn't fly) ${(api.certOf('condor') * 100).toFixed(0)}%`);
  // the impact predictor's spread: wide while the air is unknown, gone where it's been sampled
  const probeShip = () => { api.t = 0; const q = api.newShip(['chute', 'pod']); q.landed = false; q.r = [TELLUS.R + 60000, 0, 0]; q.v = [0, 0, -1200]; q.chute = false; return q; };
  const gc = (a, b) => Math.acos(Math.min(1, dot(norm(a), norm(b)))) * TELLUS.R / 1000;
  fresh(); let q = probeShip(); const i0 = api.predictImpact(q), w0 = gc(api.predictImpact(q, -1).pf, api.predictImpact(q, 1).pf);
  [0, 1, 2, 3, 4, 5, 6].forEach(k => P.atm[k] = 1); q = probeShip(); const w1 = gc(api.predictImpact(q, -1).pf, api.predictImpact(q, 1).pf);
  check('impact spread: an unsampled atmosphere widens the landing prediction; a sampled one collapses it', w0 > 2 && w1 < 0.01,
    `±25 % density: ${w0.toFixed(1)} km wide → sampled: ${w1.toFixed(3)} km (nominal flight ${(i0.t).toFixed(0)} s)`);
  // a failure is a measurement: the part that broke is fully known afterwards
  fresh(); api.t = 0; s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.landed = false; s.r = [TELLUS.R + 3000, 0, 0]; s.v = [0, 0, -600];   // broadside at 600 m/s: something gives
  for (let k = 0; k < 500 && s.parts.every(p => p.on); k++) api.advPhys(s);
  const known = Object.keys(P.cert).filter(k => P.cert[k] === 1);
  check('a structural failure reveals the broken part\'s true rating (certified 100 %)', known.length >= 1, `fully known: ${known.join(', ') || 'none'}`);
  // range certification: three clean flights in a row, any town hit resets the streak
  fresh(); const fl = verdicts => { const x = launch(['pod', 't1', 'kestrel']); x.landed = false; x.rec.launched = true; verdicts.forEach(v => api.missionDrop(x, { kind: v })); api.missionEnd(x); };
  fl(['sea']); fl(['land', 'sea']); fl(['near']); const after3 = P.streak; fl(['sea']); fl(['land']); fl([]); fl(['sea']);
  check('range certification: a near-town drop resets the streak; flights with no drops don\'t count; three clean in a row completes it', after3 === 0 && !!P.done.range && P.streak === 3,
    `streak after a near miss ${after3}, final ${P.streak}, flights ${P.flights}`);
  // the passenger hop: a Kestrel's kick is too much for the passenger; the Sparrow preset goes to space and home safe
  const hop = st => { fresh(); P.done.loads = { flight: 0 }; const x = launch(st); let arm = false, k = 0;
    let stg = 0; const dropBooster = st.includes('dec');   // burnout: drop the booster (if it can be dropped); falling: arm the chute
    while (x.alive && !(x.rec.launched && x.landed) && k++ < 400000) {
      if (dropBooster && stg === 0 && x.rec.launched && x.thrust === 0) { api.stage(x); stg = 1; }
      if ((stg === 1 || !dropBooster) && !arm && x.rec.launched && dot(x.v, norm(x.r)) < 0) { api.stage(x); arm = true; }
      api.advPhys(x); }
    return x; };
  const hard = hop(['chute', 'bio', 't2', 'fins', 'kestrel']), whole = hop(['chute', 'bio', 't2', 'fins', 'sparrow']), soft = hop(api.PRESETS.Passenger);   // each hop() starts a fresh program: the preset goes last
  check('passenger hop: a Kestrel crushes the passenger; the Passenger preset (booster dropped at burnout) goes to space and home safe', !hard.rec.bioOK && /g$/.test(hard.rec.bioWhy) && soft.rec.bioOK && soft.rec.bioSpace && !!P.done.hop,
    `Kestrel: ${hard.rec.bioWhy} · preset: apex ${(soft.rec.apex / 1e3).toFixed(0)} km, peak ${soft.rec.gMax.toFixed(1)} g (1 s avg), cabin ${soft.rec.cabin.toFixed(0)} K at landing, approved ${soft.rec.approved} · booster kept on: ${whole.rec.bioOK ? 'safe' : whole.rec.bioWhy}`);
  // an orbital-speed return: a bare capsule tumbles and cooks its passenger; with a pod holding it shield-first, home safe
  const entry = (st, sas) => { fresh(); api.t = 0; const x = api.newShip(st); api.S = x; x.landed = false; const R0 = TELLUS.R, f = api.localFrame([R0 + 75000, 0, 0]);
    x.r = [R0 + 75000, 0, 0]; x.v = add(mul(f.e, 2250), mul(f.up, -60)); const d = norm(x.v), Y = mul(d, -1), X = norm(cross(Y, f.n)); x.q = api.qFromBasis(X, Y, cross(X, Y));
    x.sas = sas; if (sas) x.sasMode = 'retro'; x.rec.launched = true; x.rec.bio = true; api.stage(x); let k = 0; while (x.alive && !x.landed && k++ < 200000) api.advPhys(x); return x; };
  const bare = entry(['chute', 'bio', 'shield'], false), held = entry(['chute', 'bio', 'pod', 'shield'], true);
  check('orbital-speed return: a bare biocapsule tumbles and overheats; held shield-first by a pod, the passenger lands safe', !bare.rec.bioOK && held.rec.bioOK && held.landed,
    `bare: ${bare.rec.bioWhy}; held: ${held.rec.gMax.toFixed(1)} g, cabin ${held.rec.cabin.toFixed(0)} K, landed ${held.landed}`);
  // orbit benchmarks: the beeper and the lift records, from a ship placed in a circular orbit and coasted on rails
  fresh(); P.done.weather = { flight: 0 };
  const orb = st => { const x = api.newShip(st); api.S = x; api.t = 0; x.landed = false; const r0 = TELLUS.R + 90000; x.r = [r0, 0, 0]; x.v = [0, 0, -Math.sqrt(TELLUS.mu / r0)]; x.rec.launched = true; api.advRails(x, 60, 1000); return x; };
  orb(['sci', 'ballast', 'ballast']); const b1 = !!P.done.beeper, l1 = !!P.done.lift1;
  orb(['sci', 'ballast', 'ballast', 'ballast', 'ballast']);
  check('orbit benchmarks: the beeper, then 0.5 t and 2 t of mass simulators', b1 && l1 && !!P.done.lift2, `beeper ${b1}, lift I ${l1}, lift II ${!!P.done.lift2}`);
  // missions stay locked until their prerequisites are done
  fresh(); orb(['sci', 'ballast']);
  check('missions are gated: no beeper credit before "Above the weather"', !P.done.beeper && !P.done.lift1);
  // the budget: a recovered sounding flight costs only fuel plus 20 % wear, and pays its mission; a town hit costs damages;
  // the floor tops the program up
  fresh(); s = launch(api.PRESETS.Sounding); const c0 = api.vesselCost(s.parts); armed = false; n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  api.missionEnd(s); const net = api.FUNDS0 - P.funds + 15;   // +15k: "Above the weather" paid out
  check('budget: launch charged, intact landing refurbished at 80 % of dry price, the mission paid', Math.abs(net - (c0.cost - c0.dry * api.REFURB)) < 1e-6 && !!P.done.weather,
    `net ${net.toFixed(4)} vs ${(c0.cost - c0.dry * api.REFURB).toFixed(4)}, done ${Object.keys(P.done)}, cost ${c0.cost.toFixed(2)}k, refurbished ${(c0.dry * api.REFURB).toFixed(2)}k, mission +15k → funds ${P.funds.toFixed(2)}k`);
  fresh(); P.funds = 30; const x = launch(['pod', 't1', 'kestrel']); x.landed = false; x.rec.launched = true; api.missionDrop(x, { kind: 'city' }); x.alive = false; api.missionEnd(x);
  check('budget: a stage on a town costs damages, and the floor tops a broke program back up', P.funds === api.FUNDS_FLOOR && P.bailouts === 1, `30k − 40k damages → topped up to ${P.funds}k`);
  // refurbishment pegged to stress: overload, overheating and a hard touchdown each cut the refund
  const W = api.wearOf;
  check('wear: gentle flight good as new; peak load at 100 %, peak heat at 100 %, a 12 m/s touchdown each cut the value', W({ wL: .4, wT: .4 }, 5) === 1 && Math.abs(W({ wL: 1 }, 0) - .3) < 1e-9 && Math.abs(W({ wT: 1 }, 0) - .3) < 1e-9 && Math.abs(W({}, 12) - .4) < 1e-9 && W({ wL: .75, wT: .75 }, 9) < .6,
    `75 % load + 75 % heat + 9 m/s: ${(W({ wL: .75, wT: .75 }, 9) * 100).toFixed(0)}% of value`);
  const sp = s.parts.find(p => p.d.key === 'sparrow');
  check('wear is tracked on every part during a flight (peak load and heat)', sp.wL > 0 && sp.wT > 0, `Sparrow peak load ${(sp.wL * 100).toFixed(0)}%, peak heat ${(sp.wT * 100).toFixed(0)}% of limit`);
  // the calendar: stacking takes days by price, flying takes its flight time
  fresh(); P.day = 0; s = launch(api.PRESETS.Sounding); armed = false; n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  const ft = api.t; api.missionEnd(s); const want = api.prepDays(c0.cost) + ft / api.DAY_S;
  check('calendar: a launch advances the date by the stacking time, the flight by its duration', Math.abs(P.day - want) < 1e-9, `${api.prepDays(c0.cost).toFixed(2)} days to stack + ${(ft / 60).toFixed(1)} min of flight → day ${P.day.toFixed(3)}`);
  // the powers: any number of them; the pad is home; land is someone's, the sea no one's
  const counts = [2, 3, 5, 8].map(k => api.makePowers(11, k).length), PW = api.POWERS;
  const cityOK = api.CITIES.every(c => c.power), sea = (() => { for (let i = 0; i < 2000; i++) { const z = Math.sin(i * 7.1), ph = i * 2.39, q = Math.sqrt(1 - z * z), u = [q * Math.cos(ph), z, q * Math.sin(ph)]; if (!api.isLand(u)) return api.powerAt(u); } return 'none'; })();
  check('powers: generated for any count; the launch site is home; every city belongs to one; the sea to none', counts.join() === '2,3,5,8' && api.powerAt([1, 0, 0]) === PW[0] && cityOK && sea === null,
    `${PW.map(p => p.name + ' (' + api.CITIES.filter(c => c.power === p).length + ' cities)').join(', ')}`);
  // an incident: a stage on a foreign town hurts that power's opinion of us and its relation with home, costs more
  fresh(); P.funds = 200; const foreign = api.CITIES.find(c => c.power.i !== api.HOME), op0 = api.opOf(foreign.power.i), r0 = api.relOf(api.HOME, foreign.power.i);
  const y = launch(['pod', 't1', 'kestrel']); y.landed = false; y.rec.launched = true; api.missionDrop(y, { kind: 'city', city: foreign, power: foreign.power }); y.alive = false; api.missionEnd(y);
  check('a stage on a foreign town: diplomatic incident (their opinion and relations drop, damages ×1.5)', api.opOf(foreign.power.i) < op0 - 10 && api.relOf(api.HOME, foreign.power.i) < r0 && Math.abs(P.funds - (200 - 60)) < 1e-6,
    `${foreign.name}, ${foreign.power.name}: opinion ${op0.toFixed(0)}→${api.opOf(foreign.power.i).toFixed(0)}, relation ${r0.toFixed(2)}→${api.relOf(api.HOME, foreign.power.i).toFixed(2)}`);
  // the world drifts between flights, deterministically, and stays bounded
  const drift = () => { fresh(); P.day = 0; P.wseed = 99; P.rel = {}; P.op = {}; for (let d = 0; d < 40; d++) api.advanceDays(10); return JSON.stringify(P.rel); };
  const d1 = drift(), d2 = drift(), rv = Object.values(JSON.parse(d1));
  check('relations drift over a year of program time, deterministically, within [−1, 1]', d1 === d2 && rv.every(r => r >= -1 && r <= 1) && rv.length === PW.length * (PW.length - 1) / 2,
    `after 400 days: ${rv.map(r => r.toFixed(2)).join(' ')}`);
  // contracts: overlap: one sounding flight completes two accepted contracts (and the first-time mission) at once
  const ct = (type, p, src = 'sci', client = 1) => ({ id: Math.random(), type, src, client, p: { pay: 10, dur: 100, ...p }, deadline: P.day + 100 });
  fresh(); P.day = 0; P.active = [ct('apex', { lo: 10, hi: 25 }), ct('sample', { k: 1, pay: 11 })]; const f0 = P.funds;
  s = launch(api.PRESETS.Sounding); armed = false; n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  check('contracts overlap: one sounding flight completes two contracts and a first, each paid once', P.active.length === 0 && s.rec.cdone.length === 2 && !!P.done.weather && P.cdone === 2 && Math.abs(P.funds - (f0 - s.rec.cost + 10 + 11 + 15)) < 1e-6,
    `${s.rec.cdone.join(' + ')} + Above the weather; funds ${f0}M → ${P.funds.toFixed(2)}M before refurbishment`);
  // capacity: two at first, growing with contracts done
  fresh(); P.day = 0; P.offers = [1, 2, 3, 4].map(i => ({ ...ct('apex', { lo: 10, hi: 25 }), id: i, expires: 50 })); const took = [1, 2, 3].map(i => api.acceptOffer(i)); const c0cap = api.capOf(); P.cdone = 6;
  check('capacity: two contracts at first, more as the program completes them', took.join() === 'true,true,false' && c0cap === 2 && api.capOf() === 4, `took ${took.join(', ')}; capacity 2 → ${api.capOf()} after 6 done`);
  // a satellite contract: periapsis/apoapsis window and inclination, with a precision bonus; the wrong plane doesn't count
  const orbAt = (st, alt, incDeg) => { const x = api.newShip(st); api.S = x; api.t = 0; x.landed = false; const r0 = TELLUS.R + alt * 1e3, v = Math.sqrt(TELLUS.mu / r0), i = incDeg * Math.PI / 180;
    x.r = [r0, 0, 0]; x.v = [0, v * Math.sin(i), -v * Math.cos(i)]; x.rec.launched = true; api.advRails(x, 60, 1000); return x; };
  fresh(); P.day = 0; P.done.beeper = { flight: 0 }; P.active = [ct('sat', { alt: 150, tol: 20, inc: 0, itol: 3, pay: 50 }, 'com'), ct('sat', { alt: 150, tol: 20, inc: 30, itol: 3, pay: 60 }, 'com')]; const f1 = P.funds;
  orbAt(['sci'], 150, 0);
  check('satellite contract: a centred 150 km equatorial orbit pays with the full precision bonus; the 30° one stays open', P.active.length === 1 && P.active[0].p.inc === 30 && Math.abs(P.funds - f1 - 50 * 1.3) < 1e-6,
    `paid ${(P.funds - f1).toFixed(1)}M for a 50M contract`);
  orbAt(['sci'], 150, 30);
  check('…and an orbit in the 30° plane completes the other', P.active.length === 0, `${P.cdone} contracts done`);
  // deadlines: a missed one is removed and costs standing with that source and the client's opinion
  fresh(); P.day = 0; P.active = [ct('apex', { lo: 50, hi: 65 })]; P.active[0].deadline = 30; const st0 = api.standOf('sci'), op1 = api.opOf(1); api.advanceDays(40);
  check('a missed deadline drops the contract, our standing with the source and the client\'s opinion', P.active.length === 0 && api.standOf('sci') < st0 && api.opOf(1) < op1 + 1, `standing ${st0} → ${api.standOf('sci')}`);
  // budget days every 100 days, scaled by home opinion and the cycle
  fresh(); P.day = 0; P.op = {}; P.op[api.HOME] = 75; const f2 = P.funds; api.advanceDays(100.5);
  check('budget day: every 100 days the home government pays, more when opinion is high', P.funds - f2 > api.GRANT_100 * 1.1 && P.funds - f2 < api.GRANT_100 * 1.5 * 1.3, `opinion 75 → +${(P.funds - f2).toFixed(1)}M (base ${api.GRANT_100}M at opinion 50), economy ${P.cycle.toFixed(2)}`);
  // offers arrive and expire over time; types unlock with firsts; the board never overflows
  const seen = done => { fresh(); P.day = 0; P.offers = null; P.done = done; P.wseed = 7; const types = new Set(); let maxB = 0; api.ensureBoard();
    for (let d = 0; d < 1200; d += 5) { api.advanceDays(5); P.offers.forEach(o => types.add(o.type)); maxB = Math.max(maxB, P.offers.length); } return { types: [...types].sort(), maxB }; };
  const early = seen({}), later = seen({ beeper: {}, lift1: {}, hop: {} });
  check('offers flow over program time; orbital and passenger contracts appear only once those firsts are done; board ≤ 6', !early.types.some(t => ['sat', 'lift', 'bioHop'].includes(t)) && ['sat', 'lift', 'bioHop'].every(t => later.types.includes(t)) && Math.max(early.maxB, later.maxB) <= 6,
    `early: ${early.types.join(', ')} · later: ${later.types.join(', ')} · biggest board ${Math.max(early.maxB, later.maxB)}`);
  // ownership: three starting points, shares that sum to 1, everything scaled by them
  const sum = () => api.stateShare() + api.own().pv, starts = {};
  for (const k of ['agency', 'company', 'consortium']) { fresh(); api.chooseStart(k); starts[k] = { kind: api.ownKind(), funds: P.funds, members: Object.keys(api.own().st).length, sum: sum() }; }
  check('ownership: agency, company and consortium start with their own shares and funds; shares sum to 1', starts.agency.kind === 'national agency' && starts.company.kind === 'private company' && starts.consortium.kind === 'consortium' && starts.consortium.members === 3 && Object.values(starts).every(x => Math.abs(x.sum - 1) < 1e-9) && starts.company.funds > starts.agency.funds,
    Object.entries(starts).map(([k, v]) => `${k}: ${v.kind}, ${v.funds}M, ${v.members} state holder(s)`).join(' · '));
  const grant = k => { fresh(); P.day = 0; P.op = {}; P.cycle = 0; P.cyc = 0; api.chooseStart(k); const f = P.funds; api.advanceDays(100.5); return P.funds - f; };
  const gA = grant('agency'), gC = grant('consortium'), gP = grant('company');
  check('budget day by shares: the agency\'s home pays, consortium members each pay their part, a private company gets nothing', gA > 5 && gC > 5 && gP === 0, `agency +${gA.toFixed(1)}M · consortium +${gC.toFixed(1)}M · company +${gP.toFixed(1)}M`);
  // government work follows the state shareholders
  fresh(); api.chooseStart('consortium'); const R7 = api.rng(3), cl = new Set(); for (let i = 0; i < 200; i++) cl.add(api.pickClient('gov', R7));
  check('government contracts come from whoever holds the state stakes', [...cl].sort().join() === Object.keys(api.own().st).sort().join(), `clients ${[...cl].sort().join(', ')}`);
  // below the floor: an agency is topped up; a company gets a rescue decision, and a loan is repaid from half of income
  fresh(); api.chooseStart('agency'); P.funds = 5; api.floorCheck(); const agencyFunds = P.funds;
  fresh(); api.chooseStart('company'); P.funds = 5; api.floorCheck(); const dec = P.decisions[0];
  api.resolveDecision(dec.id, 'loan'); const debt0 = api.own().debt; api.income(20);
  check('below the floor: the agency is topped up; the company must choose, and a loan is repaid from half of all income', agencyFunds === 25 && dec && dec.kind === 'rescue' && Math.abs(debt0 - 26) < 1e-9 && Math.abs(api.own().debt - 16) < 1e-9 && Math.abs(P.funds - 35) < 1e-9,
    `loan of 20M → debt ${debt0}M; a 20M payout repays 10M (debt ${api.own().debt}M) and banks 10M`);
  fresh(); api.chooseStart('company'); P.funds = 5; api.floorCheck(); api.resolveDecision(P.decisions[0].id, 'stake');
  check('…or a state rescue: 30% goes to the rescuing power, and the company now has a state stake', Math.abs(api.stateShare() - 0.3) < 1e-9 && api.ownKind() === 'company with a state stake' && P.funds === 55, `${api.ownKind()}, funds ${P.funds}M`);
  // privatization: a 25% stake sold for cash, the agency becomes part-privatized
  fresh(); api.chooseStart('agency'); const f3 = P.funds; api.offerDecision({ kind: 'ipo', amt: 40, title: 't', text: '', opts: [] }); api.resolveDecision(P.decisions[0].id, 'yes');
  check('privatization: selling 25% brings cash and a part-private program', Math.abs(api.own().pv - 0.25) < 1e-9 && P.funds === f3 + 40 && api.ownKind() === 'agency, part-privatized' && Math.abs(sum() - 1) < 1e-9, `${api.ownKind()}: state ${(api.stateShare() * 100).toFixed(0)}%, private 25%`);
  fresh(); P.day = 0; P.rel = {}; P.op = {}; api.HOOK.news = () => {};
}

// 15. Design format v2 (v1.17): the construction screen's free attach tree — radial on anything, nested symmetry.
// Its own instance of the sim core, so this section never touches the shared api object above.
{
  const D = new Function(src + 'return {toV2,assemble,stageStats,newShip,physStep,stage,segFuel,PRESETS,HOOK,DT,len,TELLUS,get t(){return simT},set t(v){simT=v},set S(v){S=v}};')();
  const P = D.PRESETS, fp = A => JSON.stringify([A.parts.map(p => [p.d.key, p.pos, p.y0, p.parent && p.parent.i, p.jA, p.jP, p.jr || 0, p.seg]), A.events, A.segs.map(s => s.label)]);
  const diff = Object.keys(P).filter(k => fp(D.assemble(P[k])) !== fp(D.assemble(JSON.parse(JSON.stringify(D.toV2(JSON.parse(JSON.stringify(P[k]))))))));
  check('design v2: every preset converts to the tree format and survives a JSON round trip unchanged (parts, joints, stages)', !diff.length, diff.length ? 'differs: ' + diff.join(', ') : `${Object.keys(P).length} presets`);
  // three boosters on the core, each carrying two small side tanks of its own (crossfeed optional)
  const nested = x => ({ v: 2, root: { k: 'pod', c: [{ k: 'chute', at: 'u', c: [] }, { k: 't2', at: 'd', c: [{ k: 'petrel', at: 'd', c: [{ k: 'dec', at: 'd', c: [{ k: 't8', at: 'd', c: [
    { k: 'fins', at: 'd', c: [{ k: 'kestrel', at: 'd', c: [] }] },
    { k: 't4', at: { y: 4.16, a: 0.7854, n: 3, cy: 1.9, dec: true }, c: [{ k: 'kestrel', at: 'd', c: [] },
      { k: 't1', at: { y: 2.38, a: 5.236, n: 2, cy: 0.55, dec: true, ...(x ? { x: true } : {}) }, c: [] }] }] }] }] }] }] } });
  const A = D.assemble(nested(true)), B = A.parts.filter(p => p.d.key === 't4'), T = A.parts.filter(p => p.d.key === 't1');
  const rB = B.map(p => Math.hypot(p.pos[0], p.pos[2])), aB = B.map(p => Math.atan2(p.pos[2], p.pos[0])).sort((a, b) => a - b);
  const host = t => t.parent.parent, rT = T.map(t => Math.hypot(t.pos[0] - host(t).pos[0], t.pos[2] - host(t).pos[2]));
  check('nested symmetry: 3 boosters 120° apart at one distance, each with 2 side tanks 1.5 m off its own axis', A.parts.length === 29 && B.length === 3 && T.length === 6 &&
    Math.max(...rB) - Math.min(...rB) < 1e-9 && Math.abs(aB[1] - aB[0] - 2 * Math.PI / 3) < 1e-9 && rT.every(r => Math.abs(r - 1.5) < 1e-9), `${A.parts.length} parts, boosters at ${rB[0].toFixed(3)} m, side tanks at ${rT[0].toFixed(3)} m`);
  const ev = A.events;
  check('nested staging: the side tanks drop first, then the boosters, then the core', ev.length === 5 && ev[0].ignite.length === 4 && ev[1].decouple.length === 6 && ev[1].radial &&
    ev[2].decouple.length === 3 && ev[2].radial && ev[3].ignite.length === 1 && ev[4].chute, ev.map(e => e.chute ? 'chute' : `${e.decouple.length ? '−' + e.decouple.length : ''}${e.ignite.length ? '+' + e.ignite.length : ''}`).join(' → '));
  const dv = d => D.stageStats(d).stages.reduce((a, s) => a + s.dvV, 0), d0 = dv(nested(false)), d1 = dv(nested(true));
  check('…and without crossfeed the side tanks are dead weight (no engine of their own); with it they feed the boosters', d1 > d0 + 1000, `${d0.toFixed(0)} → ${d1.toFixed(0)} m/s`);
  D.t = 0; const s = D.newShip(nested(true)), msgs = []; D.S = s; D.HOOK.msg = m => msgs.push(`${D.t.toFixed(1)} ${m}`); s.throttle = 1; D.stage(s); let worst = 0;
  while (D.t < 80 && s.alive) { D.physStep(s, D.DT); worst = Math.max(worst, s.maxLoad); const nx = s.events[s.evIdx]; if (nx && nx.decouple.length && nx.decouple.every(k => D.segFuel(s, k) <= 1e-9)) D.stage(s); }
  const seps = msgs.filter(m => /separation/.test(m));
  check('nested design flies: tanks then boosters drop as they run dry, no structural failure', s.alive && s.evIdx === 3 && seps.length === 2 && !msgs.some(m => /Structural/.test(m)) && D.len(s.r) - D.TELLUS.R > 20000,
    `${seps.join(', ')} · ${((D.len(s.r) - D.TELLUS.R) / 1000).toFixed(1)} km at T+80 s, worst joint ${(worst * 100).toFixed(0)}%`);
  // a single radial part (×1, no decoupler): the old format couldn't say this; the physics takes the off-axis mass as is
  const one = D.newShip({ v: 2, root: { k: 'pod', c: [{ k: 't4', at: 'd', c: [{ k: 'kestrel', at: 'd', c: [] }, { k: 't1', at: { y: 2, a: 0, n: 1 }, c: [] }] }] } });
  check('asymmetric ×1 radial: assembles, centre of mass moves off the axis toward it', one.parts.length === 4 && one.cm[0] > 0.05 && one.events.length === 1, `CoM x ${one.cm[0].toFixed(3)} m`);
}

function moonPos(t) { return api.moonPos(t); }
console.log(log.slice(0, 12).join('\n'));
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
