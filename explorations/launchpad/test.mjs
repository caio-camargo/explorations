// Headless checks for Launchpad's simulation core. Run: node test.mjs
// Extracts the "SIM BEGIN … SIM END" block from index.html and drives it with no DOM or GL.
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `
return {eraOf,designName,LOGF,relBase,cancelProgram,demandMet,flav,ARCH,natOf,moneyK,failHit,flavTick,sanction,sanctioned,offerRisk,RIVALS,RACE,raceLost,LEAK_P,genOffer,contractEval,chooseStart,own,stateShare,ownKind,floorCheck,offerDecision,resolveDecision,income,valuation,pickClient,rng,acceptOffer,CT,capOf,ensureBoard,standOf,GRANT_100,wearOf,makePowers,POWERS,powerAt,relOf,opOf,advanceDays,DAY_S,prepDays,HOME,vesselCost,FUNDS0,FUNDS_FLOOR,REFURB,advPhys,advRails,PROG,MISSIONS,missionEnd,missionDrop,safetyReview,certOf,atmU,G_LIM,CERT0,CITIES,landValue,isLand,dropVerdict,debrisImpact,fall,surfVelX:null,predictImpact,tapeNew,tapePhys,tapeRails,tapeStage,tapePlay,tapeDuration,toPF,railsOK,segFuel,stageStats,partMass,PARTS,analyze,nodeInfo,nodeBurnTime,predictFrom,dvPlan,kepler,elements,timeToNu,predict,newShip,physStep,rails,stage,dvRemaining,localFrame,qFromBasis,qrot,cross,norm,len,sub,add,mul,dot,probe,firstSeg,geom,INP,surfVel,SND,buildStation,gsCheck,stationsAll,GS_LEASE,pairKey,satAt,absTh,cloudAt,sunUp,
  badness,careerMove,get home(){return HOME},resetHome(){HOME=0;RIVALS=raceSchedule()},
  TELLUS,SELENE,PRESETS,HOOK,moonPos,moonVel,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v},DT};`)();
const { kepler, elements, len, sub, add, mul, dot, norm, cross, TELLUS, SELENE } = api;
// geometry from the planet, not literals: low orbit 10 km above the air, entry 5 km below its top at ~98 % of circular speed
const ATM = TELLUS.atm, LEO = TELLUS.R + ATM + 10000, VENT = 0.9838 * Math.sqrt(TELLUS.mu / (TELLUS.R + ATM + 5000)), AS = ATM / 7e4;
const log = [];
api.HOOK.msg = m => log.push(`[t=${api.t.toFixed(1)}] ${m}`);
let fails = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

// 1. Kepler propagation: a full period returns to the start; forward then back is identity (ellipse + hyperbola).
{
  const mu = TELLUS.mu, r0 = [LEO, 0, 0], v0 = [0, 120, -1.053 * Math.sqrt(TELLUS.mu / LEO)];
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
  let [ra, va] = [r0, [0, 0, -Math.sqrt(mu / LEO)]];
  const e0 = E(ra, va);
  for (let i = 0; i < 1000; i++) [ra, va] = kepler(ra, va, steps / 1000, mu);
  let rb = r0.slice(), vb = [0, 0, -Math.sqrt(mu / LEO)];
  const t0 = performance.now();
  for (let i = 0; i < steps / 0.02; i++) { const rl = len(rb), a = mul(rb, -mu / (rl * rl * rl)); vb = add(vb, mul(a, 0.02)); rb = add(rb, mul(vb, 0.02)); }
  const ms = performance.now() - t0;
  console.log(`      10-day low orbit: Kepler energy drift ${(Math.abs(E(ra, va) - e0) / Math.abs(e0)).toExponential(1)}, ` +
    `Euler@50Hz drift ${(Math.abs(E(rb, vb) - e0) / Math.abs(e0)).toExponential(1)}, radius error ${(Math.abs(len(rb) - LEO)).toFixed(0)} m, ${ms.toFixed(0)} ms for 43.2M steps`);
}

// 2. Stage maths for the presets
for (const [k, st] of Object.entries(api.PRESETS)) {
  const { stages, mass } = api.stageStats(st);
  console.log(`      ${k.padEnd(8)} ${mass.toFixed(2)} t  ` + stages.map((s, i) => `S${i + 1} ${s.dvV.toFixed(0)} m/s TWR ${s.twr.toFixed(2)}`).join(' | ') +
    `  total ${stages.reduce((a, s) => a + s.dvV, 0).toFixed(0)}`);
}

// 3. Fly the Orbiter preset: scripted gravity turn, attitude set directly (this tests physics, not piloting).
function fly(preset, { turnStart = 1000 * AS, turnEnd = 45000 * AS, target = (ATM + 10000), verbose = true } = {}) {
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
      if (el.pe - TELLUS.R > (ATM + 2000)) { s.throttle = 0; phase = 'done'; break; }
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
  check('Orbiter reaches a stable orbit', r.phase === 'done' && pe > ATM / 1e3, `Ap ${ap.toFixed(1)} km, Pe ${pe.toFixed(1)} km at T+${r.t.toFixed(0)} s; ` +
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
  api.t = 0; const mu = TELLUS.mu, r = LEO, vc = Math.sqrt(mu / r), vp = Math.sqrt(mu * (2 / r - 2 / (r + SELENE.a)));
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
  const P = api.PRESETS, noFin = st => st.filter(x => x !== 'fins' && x !== 'fins25');
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
      const el = elements(s.r, s.v, TELLUS.mu); if (el.ap - TELLUS.R > (ATM + 10000)) s.throttle = 0;
      if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.stage(s);
      api.physStep(s, api.DT); maxLoad = Math.max(maxLoad, s.maxLoad); maxQ = Math.max(maxQ, s.qdyn);
      if (len(s.r) - TELLUS.R > ATM && s.throttle === 0) break;
    }
    api.INP.pitch = 0;
    return { ok: s.alive && len(s.r) - TELLUS.R > ATM, maxLoad, maxQ, broke: msgs.find(m => /Structural/.test(m)) };
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
    s.landed = false; const f = api.localFrame([TELLUS.R + (ATM + 5000), 0, 0]); s.r = [TELLUS.R + (ATM + 5000), 0, 0]; s.v = add(mul(f.e, 2300), mul(f.up, -60));
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
    while (len(r) - R > 0) { const rl = len(r); let a = r.map(x => -TELLUS.mu * x / rl ** 3); const h = rl - R, rho = h < ATM ? TELLUS.rho0 * Math.exp(-h / TELLUS.H) : 0,
      va = [v[0] - TELLUS.rot * r[2], v[1], v[2] + TELLUS.rot * r[0]], sp = len(va);
      if (rho > 0 && sp > 0.1) { let ad = 0.5 * rho * sp * 2.5 / d.mass; if (ad * api.DT > 0.9) ad = 0.9 / api.DT; a = a.map((x, i) => x - ad * va[i]); }
      v = v.map((x, i) => x + a[i] * api.DT); r = r.map((x, i) => x + v[i] * api.DT); tt += api.DT; }
    got = { pred, pf: api.toPF(TELLUS, r, tt), t: tt }; };
  s.throttle = 1; api.stage(s); let ph = 'asc';
  while (api.t < 900 && s.alive && ph !== 'done') { api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0; if (api.t > 9.8) s.sasMode = 'pro';
    const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - R;
    if (ph === 'asc' && el.ap - R > (ATM + 10000)) { s.throttle = 0; ph = 'coast'; } if (ph === 'coast' && h > ATM && api.timeToNu(el, Math.PI) < 25) { s.throttle = 1; ph = 'circ'; }
    if (ph === 'circ' && el.pe - R > ATM) { s.throttle = 0; ph = 'done'; }
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
  const pod = compare('pod', { stack: ['chute', 'pod', 'shield'], init: s => { s.landed = false; const f = api.localFrame([R + (ATM + 5000), 0, 0]); s.r = [R + (ATM + 5000), 0, 0];
      s.v = add(mul(f.e, VENT), mul(f.up, -60)); const d = norm(s.v), Y = mul(d, -1), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.sas = false; api.stage(s); } },
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
  while (api.t < 3000 && s.alive && phase !== 'done') { frames++;
    api.INP.pitch = (api.t >= 8 && api.t < 8.95) ? 1 : 0; if (api.t > 9.95 && s.sasMode !== 'pro') s.sasMode = 'pro';   // kick retuned for the bigger planet
    const el = elements(s.r, s.v, mu), h = len(s.r) - R;
    if (phase === 'asc' && el.ap - R > (ATM + 10000)) { s.throttle = 0; phase = 'coast'; }
    if (phase === 'coast' && h > ATM && api.timeToNu(el, Math.PI) < 20) { s.throttle = 1; phase = 'circ'; }
    if (phase === 'circ' && el.pe - R > ATM) { s.throttle = 0; phase = 'done'; }
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
  const entry = (ra, hp) => { const r = R + (ATM + 5000), rp = R + hp, a = (ra + rp) / 2, v = Math.sqrt(mu * (2 / r - 1 / a)), e = (ra - rp) / (ra + rp), h = Math.sqrt(mu * a * (1 - e * e)); return { v, g: Math.acos(Math.min(1, h / (r * v))) }; };
  function enter(stack, ra, hp) { const { v, g } = entry(ra, hp); api.t = 0; const s = api.newShip(stack); api.S = s; const msgs = []; api.HOOK.msg = m => msgs.push(m);
    s.landed = false; const f = api.localFrame([R + (ATM + 5000), 0, 0]); s.r = [R + (ATM + 5000), 0, 0]; s.v = add(mul(f.e, v * Math.cos(g)), mul(f.up, -v * Math.sin(g)));
    const d = norm(s.v), Y = mul(d, -1), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.sas = false; let st = false, hot = 0;
    while (s.alive && !s.landed && api.t < 5000) { if (!st && len(s.r) - R < 15000) { api.stage(s); st = true; } api.physStep(s, api.DT);
      for (const p of s.parts) if (p.on && p.d.key === 'pod') hot = Math.max(hot, p.T / p.d.Tmax); }
    const sh = s.parts.find(p => p.d.key === 'shield'); return { landed: s.landed, alive: s.alive, hot, abl: sh ? sh.res.ablator / sh.cap.ablator : null, burned: msgs.find(m => /burned up/.test(m)) }; }
  const leo = enter(['chute', 'pod'], R + (ATM + 10000), 30000), lun = enter(['chute', 'pod'], SELENE.a, 30000), lunS = enter(['chute', 'pod', 'shield'], SELENE.a, 30000);
  check('re-entry: a bare pod survives a low-orbit return, but burns up coming back from Selene', leo.landed && leo.hot < 1 && !lun.alive && /Command pod/.test(lun.burned || ''),
    `LEO pod peaks at ${(leo.hot * 100).toFixed(0)}% of its limit; Selene return: ${lun.burned}`);
  check('re-entry: with a heat shield the Selene return lands, using about half the ablator', lunS.landed && lunS.hot < 0.5 && lunS.abl > 0.2 && lunS.abl < 0.8,
    `pod peaks at ${(lunS.hot * 100).toFixed(0)}%, ${(lunS.abl * 100).toFixed(0)}% ablator left`);
  const asc = k => { api.t = 0; const s = api.newShip(api.PRESETS[k]); api.S = s; api.HOOK.msg = () => {}; s.throttle = 1; api.stage(s); let mx = 0;
    while (api.t < 300 && s.alive) { api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0; if (api.t > 9.8) s.sasMode = 'pro'; const el = elements(s.r, s.v, mu); if (el.ap - R > (ATM + 10000)) s.throttle = 0;
      if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.stage(s); api.physStep(s, api.DT);
      for (const p of s.parts) if (p.on) mx = Math.max(mx, p.T / p.d.Tmax); if (len(s.r) - R > ATM && s.throttle === 0) break; }
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
  check('without crossfeed the flow model reproduces the old per-stage numbers', Math.round(tot(P.Orbiter)) === 4894 && Math.round(tot(P.Heavy)) === 5671 && Math.round(tot(P.Lunar)) === 8495,   // Lunar resized for the 2026-10-07 rescale
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
  // a fixed 1.25 m test rocket (the pre-rescale Lunar), so these checks edit the joints they mean to, whatever the presets become
  const P = api.PRESETS, OLD_LUNAR = ['chute', 'pod', 't1', 'wren', 'dec', 't4', 't2', 'petrel', 'dec', 't8', 't4', 'fins', 'condor'], V = f => { const L = JSON.parse(JSON.stringify(OLD_LUNAR)); f(L); return L; };
  function yank(stack, dur) { api.t = 0; const s = api.newShip(stack); api.S = s; const msgs = []; api.HOOK.msg = m => msgs.push(m);
    s.throttle = 1; api.stage(s); let y0 = null;
    while (api.t < 1200 && s.alive) { api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0;
      if (s.qdyn > 15000 && (y0 === null || api.t < y0 + dur)) { y0 = y0 ?? api.t; api.INP.pitch = 1; }
      if (api.t > 9.8) s.sasMode = 'pro'; const el = elements(s.r, s.v, TELLUS.mu); if (el.ap - TELLUS.R > (ATM + 30000)) s.throttle = 0;   // 30 km of margin: the thicker air drags a coasting apoapsis down
      if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.stage(s);
      api.physStep(s, api.DT); if (len(s.r) - TELLUS.R > ATM && s.throttle === 0) break; if (y0 !== null && api.t > y0 + dur + 60) break; }
    api.INP.pitch = 0; return { ok: s.alive && !msgs.some(m => /Structural/.test(m)) /* intact and still flying a minute after the yank */, broke: msgs.find(m => /Structural/.test(m)), mass: api.newShip(stack).mass / 1000 }; }
  const base = api.newShip(OLD_LUNAR).mass / 1000;
  const r1 = yank(V(L => { L[9] = { k: 't8', j: 1 }; }), 4);
  check('reinforcing the joint that snapped moves the failure to the next weakest joint', /Decoupler \/ Petrel/.test(r1.broke || '') && Math.abs(r1.mass - base - 0.06) < 0.005,
    `${r1.broke}; +${((r1.mass - base) * 1000).toFixed(0)} kg`);
  const r2 = yank(V(L => { L[8] = 'istage'; }), 4);
  check('an interstage takes the engine out of the load path: the same 4 s yank is survived', r2.ok, `+${((r2.mass - base) * 1000).toFixed(0)} kg, flying intact a minute after the yank`);
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
  const mu = TELLUS.mu, r0 = LEO, vc = Math.sqrt(mu / r0), vp = Math.sqrt(mu * (2 / r0 - 2 / (r0 + SELENE.a))), dvH = vp - vc;
  const orbitShip = () => { api.t = 0; const s = api.newShip(['chute', 'pod', 't2', 'petrel']); api.S = s; api.HOOK.msg = () => {};
    s.landed = false; s.r = [r0, 0, 0]; s.v = [0, 0, -vc]; api.stage(s); return s; };
  // plan only: the dashed trajectory's apoapsis must be the textbook one
  let s = orbitShip(); s.node = { t: 600, dv: [dvH, 0, 0] };
  let I = api.nodeInfo(s), plan = api.predictFrom({ b: s.body, r: I.rN, v: add(I.vN, I.rem), t: I.t });
  const apPlan = plan[0].el.ap ?? plan[0].el.a * 2;
  check(`node plan: +${dvH.toFixed(0)} m/s prograde from low orbit reaches Selene's orbit`, Math.abs(apPlan - SELENE.a) < 1000 || plan[0].endKind === 'enc',
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
  // 1.5 % since the rescale: Selene is 3.2× farther, the burn ~58 s, and a finite burn's spread around the node grows with it
  check('node burn: SAS-pointed finite burn lands within 1.5% of the planned apoapsis, then cuts the throttle', !s.node && s.throttle === 0 && err < 0.015,
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
  fresh(); api.t = 0; s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.landed = false; s.r = [TELLUS.R + 3000, 0, 0]; s.v = add(api.surfVel(TELLUS, s.r), [0, 0, -600]);   // broadside at 600 m/s through the air: something gives
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
  const entry = (st, sas) => { fresh(); api.t = 0; const x = api.newShip(st); api.S = x; x.landed = false; const R0 = TELLUS.R, f = api.localFrame([R0 + (ATM + 5000), 0, 0]);
    x.r = [R0 + (ATM + 5000), 0, 0]; x.v = add(mul(f.e, VENT), mul(f.up, -60)); const d = norm(x.v), Y = mul(d, -1), X = norm(cross(Y, f.n)); x.q = api.qFromBasis(X, Y, cross(X, Y));
    x.sas = sas; if (sas) x.sasMode = 'retro'; x.rec.launched = true; x.rec.bio = true; api.stage(x); let k = 0; while (x.alive && !x.landed && k++ < 200000) api.advPhys(x); return x; };
  const bare = entry(['chute', 'bio', 'shield'], false), held = entry(['chute', 'bio', 'pod', 'shield'], true);
  check('orbital-speed return: a bare biocapsule tumbles and overheats; held shield-first by a pod, the passenger lands safe', !bare.rec.bioOK && held.rec.bioOK && held.landed,
    `bare: ${bare.rec.bioWhy}; held: ${held.rec.gMax.toFixed(1)} g, cabin ${held.rec.cabin.toFixed(0)} K, landed ${held.landed}`);
  // orbit benchmarks: the beeper and the lift records, from a ship placed in a circular orbit and coasted on rails
  fresh(); P.done.weather = { flight: 0 };
  const orb = st => { const x = api.newShip(st); api.S = x; api.t = 0; x.landed = false; const r0 = TELLUS.R + (ATM + 20000); x.r = [r0, 0, 0]; x.v = [0, 0, -Math.sqrt(TELLUS.mu / r0)]; x.rec.launched = true; api.advRails(x, 60, 1000); return x; };
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
  // every first this flight completed paid out (Above the weather; in denser air a sounding rocket also passes the 25 kPa test)
  const paid = () => Object.keys(P.done).reduce((a, k) => a + (api.MISSIONS.find(m => m.id === k)?.pay || 0), 0);
  api.missionEnd(s); const net = api.FUNDS0 - P.funds + paid();
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
  const ft = api.t; api.missionEnd(s); const want = Math.ceil(api.prepDays(c0.cost)) + ft / api.DAY_S;   // lift-off waits for the daily launch window
  check('calendar: a launch advances the date by the stacking time (to the next daily launch window), the flight by its duration', Math.abs(P.day - want) < 1e-9, `${api.prepDays(c0.cost).toFixed(2)} days to stack + ${(ft / 60).toFixed(1)} min of flight → day ${P.day.toFixed(3)}`);
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
  check('contracts overlap: one sounding flight completes two contracts and a first, each paid once', P.active.length === 0 && s.rec.cdone.length === 2 && !!P.done.weather && P.cdone === 2 && Math.abs(P.funds - (f0 - s.rec.cost + 10 + 11 + paid())) < 1e-6,
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
  fresh(); P.homeArch = 'frugal'; P.day = 0; P.op = {}; P.op[api.HOME] = 75; const f2 = P.funds; api.advanceDays(100.5); P.homeArch = null;   // a tax-funded home
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
  // slice 6 — tourism: only after a passenger has flown; a hurt tourist empties the bookings
  const R8 = api.rng(8), tourTypes = d => { fresh(); P.done = d; const t = new Set(); for (let i = 0; i < 60; i++) { const o = api.genOffer('tour', R8); if (o) t.add(o.type); } return [...t].sort().join(); };
  const t0 = tourTypes({}), t1 = tourTypes({ hop: {} }), t2 = tourTypes({ hop: {}, orbiter: {} });
  fresh(); s = launch(['chute', 'bio', 't2', 'fins', 'kestrel']); s.rec.launched = false; P.active = [ct('touristHop', { g: 5 }, 'tour')]; const opT = api.opOf(api.HOME);
  armed = false; n = 0; while (s.alive && !(s.rec.launched && s.landed) && n++ < 400000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  api.missionEnd(s);
  check('tourism: offered only after a passenger flight (orbital holidays after an orbit); a hurt tourist collapses tourism standing', t0 === '' && t1 === 'touristHop' && t2 === 'touristHop,touristOrbit' && s.rec.tourist && !s.rec.bioOK && api.standOf('tour') <= 10 && api.opOf(api.HOME) < opT - 10,
    `offers: none → ${t1} → ${t2}; on a Kestrel, ${s.rec.pet} ${s.rec.bioWhy}; tourism standing ${api.standOf('tour')}`);
  // sanctions: military work for home's enemy → home sanctions at once: no government offers, no budget day from home
  const foe = (() => { for (const p of PW) if (p.i !== api.HOME && api.relOf(api.HOME, p.i) < -0.55) return p.i; return null; })();
  fresh(); P.day = 0; P.op = {}; if (foe == null) { P.rel['0-1'] = -0.8; }
  const enemy = foe ?? 1; P.offers = [{ ...ct('milLift', { m: 1 }, 'mil', enemy), id: 77, expires: 50 }];
  const risk = api.offerRisk(P.offers[0]); api.acceptOffer(77); const fG = P.funds; api.advanceDays(100.5);
  const govOffers = (() => { const R9 = api.rng(9); let k = 0; for (let i = 0; i < 40; i++) { const o = api.genOffer('gov', R9); if (o) k++; } return k; })();
  check('military work for an enemy of home: home sanctions at once; no government offers and no budget day from home while it lasts', risk.now.includes(api.HOME) && api.sanctioned(api.HOME) && govOffers === 0 && P.funds === fG,
    `client ${PW[enemy].name} (relation ${api.relOf(api.HOME, enemy).toFixed(2)}); sanctioned until day ${P.sanc[api.HOME].toFixed(0)}; 40 government draws → ${govOffers} offers`);
  // a leak: the client's enemies sanction us, cancel their contracts and stop sending offers
  fresh(); P.day = 0; P.op = {}; P.rel = {}; const pairs = []; for (const a of PW) for (const b of PW) if (a.i < b.i) pairs.push([a.i, b.i]);
  const [cl1, en1] = pairs.find(([a, b]) => api.relOf(a, b) < -0.55 && a !== api.HOME && b !== api.HOME) || [1, 2]; P.rel[[cl1, en1].sort().join('-')] = -0.8;
  let mid = 1; while (api.rng((P.wseed ^ (mid * 2654435761)) >>> 0)() >= api.LEAK_P({ client: cl1 })) mid++;   // a contract id whose roll leaks
  P.active = [{ ...ct('milLift', { m: 0.5 }, 'mil', cl1), id: mid }, { ...ct('apex', { lo: 10, hi: 25 }, 'sci', en1), id: 5 }];
  api.contractEval({ rec: { lift: 1, cdone: [] } });
  check('a military contract that leaks: powers hostile to the client sanction the program and cancel their contracts', api.sanctioned(en1) && !P.active.some(c => c.client === en1),
    `${PW[cl1].name}'s payload leaked → ${PW[en1].name} sanctions us`);
  // the ballistic test: down at sea within the radius of the target, with the instruments
  const tgt = norm([Math.cos(0.8), 0, Math.sin(0.8)]), near = norm(add(tgt, [0, 0.02, 0])), far = norm(add(tgt, [0, 0.2, 0])), CTb = api.CT.ballistic;
  check('ballistic test: counts only near the target and only with the instrument package aboard', CTb.ok({ endPf: mul(near, TELLUS.R), endSci: true }, { u: tgt, rad: 40 }) && !CTb.ok({ endPf: mul(far, TELLUS.R), endSci: true }, { u: tgt, rad: 40 }) && !CTb.ok({ endPf: mul(near, TELLUS.R), endSci: false }, { u: tgt, rad: 40 }),
    `${(Math.acos(dot(near, tgt)) * TELLUS.R / 1e3).toFixed(0)} km off counts, ${(Math.acos(dot(far, tgt)) * TELLUS.R / 1e3).toFixed(0)} km off doesn't`);
  // the race: first in the world pays 1.5×; after a rival gets there, half
  const firstPay = lost => { fresh(); P.homeArch = 'openSuper'; P.day = 0; P.done.weather = {}; P.raceLost = lost ? { beeper: 1 } : {}; const f = P.funds; orb(['sci'], 1); P.homeArch = null; return P.funds - f; };
  const pFirst = firstPay(false), pSecond = firstPay(true), beeperPay = api.MISSIONS.find(m => m.id === 'beeper').pay;
  check('the race: the first satellite pays more when we are first (1.7× for an open superpower), half when a rival got there first; rivals have schedules', Math.abs(pFirst - (1 + 2 * api.ARCH.openSuper.pri.prestige) * beeperPay) < 1e-6 && Math.abs(pSecond - 0.5 * beeperPay) < 1e-6 && api.RACE.every(id => api.RIVALS[id] && api.RIVALS[id].day > 0),
    `first ${pFirst}M, second ${pSecond}M; rivals expected: ${api.RACE.map(id => `${id} ${PW[api.RIVALS[id].i].root} day ${api.RIVALS[id].day}`).join(', ')}`);
  fresh(); P.day = 0; P.rel = {}; P.op = {}; P.sanc = {}; P.raceLost = {}; api.HOOK.news = () => {};
}

// 16. The orbital registry (planning branch): what's left in orbit persists on Kepler rails across program time; cameras
// image targets in reach, sharp enough, sunlit and clear, and downlink over a ground station.
{
  const P = api.PROG, news = []; api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {};
  const fresh = () => Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: 500, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, day: 0, sats: [], satN: 0, wseed: 4242, rel: {}, op: {} });
  const rotY = (v, th) => { const c = Math.cos(th), sn = Math.sin(th); return [c * v[0] + sn * v[2], v[1], -sn * v[0] + c * v[2]]; };
  // a flight that ends in orbit leaves its vessel registered, in the same place over the same ground
  fresh(); api.t = 0; let s = api.newShip(['ant', 'cam', 'petrel']); api.S = s;
  s.landed = false; s.rec.launched = true; P.day = 7; s.rec.day0 = 7; s.rec.cost = 0; const r0 = TELLUS.R + 250e3; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(TELLUS.mu / r0)];
  api.t = 1234.5; api.missionEnd(s); const q = P.sats[0], Tend = 7 * api.DAY_S + 1234.5;
  const [ra] = api.satAt(q, Tend), pfFlight = api.toPF(TELLUS, s.r, 1234.5), pfA = rotY(ra, -api.absTh(Tend));
  check('a flight ending in orbit registers a satellite, over the same ground in the program\'s absolute frame', P.sats.length === 1 && q.cam === 1 && q.ant === 1 && len(sub(pfA, pfFlight)) < 1e-6,
    `${q.name}: planet-fixed mismatch ${len(sub(pfA, pfFlight)).toExponential(1)} m`);
  // the launch window: lift-off happens on a whole program day
  fresh(); P.day = 2.3; s = api.newShip(api.PRESETS.Sounding); api.S = s; api.t = 0; s.throttle = 1; api.stage(s); for (let k = 0; k < 200 && !s.rec.launched; k++) api.advPhys(s);
  check('lift-off waits for the daily launch window: the flight starts on a whole program day', s.rec.launched && Number.isInteger(s.rec.day0) && s.rec.day0 >= 2.3 + api.prepDays(s.rec.cost), `stacking ends day ${(2.3 + api.prepDays(s.rec.cost)).toFixed(2)} → lift-off day ${s.rec.day0}`);
  // clouds: the CPU port is a coverage in [0,1] that moves with time, and some of the sky is clear
  let clear = 0, sum = 0, moved = 0; for (let i = 0; i < 400; i++) { const z = Math.sin(i * 1.7), ph = i * 2.4, qq = Math.sqrt(1 - z * z), u = [qq * Math.cos(ph), z, qq * Math.sin(ph)], c = api.cloudAt(u, 1e5), c2 = api.cloudAt(u, 1e5 + 5 * api.DAY_S);
    sum += c; if (c < .35) clear++; if (Math.abs(c - c2) > .2) moved++; }
  check('clouds on the CPU: coverage within [0,1], mostly clear somewhere, and the weather moves over days', sum / 400 > 0.05 && sum / 400 < 0.8 && clear > 100 && moved > 20, `mean cover ${(sum / 400).toFixed(2)}, clear at ${clear}/400 points, changed at ${moved}/400 after 5 days`);
  // imaging: a polar camera satellite at 300 km gets a 5 m picture of a city within weeks; 1 m is beyond it; no antenna, no delivery
  const sat = (alt, inc, kit) => { const r0 = TELLUS.R + alt * 1e3, v = Math.sqrt(TELLUS.mu / r0), i = inc * Math.PI / 180; P.satN++;
    P.sats.push({ id: P.satN, name: 'T' + P.satN, epoch: P.day * api.DAY_S, r: [r0, 0, 0], v: [0, v * Math.sin(i), -v * Math.cos(i)], imgs: 0, pending: [], sci: 0, ballast: 0, bio: 0, ...kit }); };
  const ci = api.CITIES.findIndex(c => c.power && c.power.i === 2), job = (id, res) => ({ id, type: 'image', src: 'com', client: 2, p: { ci, res, pay: 20, dur: 999 }, deadline: 999 });
  fresh(); sat(300, 90, { cam: 1, ant: 1 }); P.active = [job(1, 5), job(2, 1)]; let day5 = null;
  for (let d = 0; d < 80 && day5 == null; d++) { api.advanceDays(1); if (!P.active.some(c => c.id === 1)) day5 = P.day; }
  check('a polar camera satellite delivers a 5 m image of the target within weeks; a 1 m request stays out of its reach', day5 != null && P.active.some(c => c.id === 2) && P.sats[0].imgs === 1,
    `${api.CITIES[ci].name}: delivered on day ${day5 && day5.toFixed(0)} (resolution at 300 km ≈ ${(300e3 * 1e-5).toFixed(1)} m at nadir)`);
  fresh(); sat(300, 90, { cam: 1, ant: 0 }); P.active = [job(1, 5)]; for (let d = 0; d < 40; d++) api.advanceDays(1);
  check('without an antenna the picture is taken but never comes down', P.active.length === 1 && P.sats[0].pending.length === 1, `pending on board: ${P.sats[0].pending.length}`);
  // the world asks: disasters become offers only once a working camera satellite exists; it also sells imagery
  fresh(); P.done.beeper = {}; news.length = 0; for (let d = 0; d < 300; d += 5) api.advanceDays(5); const quips = news.filter(t => /if only someone/.test(t)).length;
  fresh(); P.done.beeper = {}; news.length = 0; sat(300, 90, { cam: 1, ant: 1 }); let disOffers = 0; const f0 = P.funds;
  for (let d = 0; d < 300; d += 5) { const n0 = P.offers.filter(o => o.p.dis).length; api.advanceDays(5); disOffers += Math.max(0, P.offers.filter(o => o.p.dis).length - n0); }
  check('disasters: headlines either way, offers only when a camera satellite with an antenna is up; it also earns from imagery', quips > 0 && disOffers > 0 && P.funds > f0,
    `${quips} unanswerable disasters without one; with one, ${disOffers} disaster offers and funds ${f0} → ${P.funds.toFixed(1)}M`);
  fresh(); P.sats = []; api.HOOK.news = () => {};
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

// 17. Ground stations (planning branch): home ones are a purchase; foreign ones need permission, pay a lease, and close
// when relations sour; a better-spread network brings pictures down sooner.
{
  const P = api.PROG, news = []; api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {};
  const fresh = () => Object.assign(P, { done: { beeper: {} }, cert: {}, atm: {}, streak: 0, flights: 0, funds: 500, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, day: 0, sats: [], satN: 0, wseed: 4242, rel: {}, op: {}, stations: [] });
  const C = api.CITIES, H = api.HOME, home = C.findIndex(c => c.power.i === H && len(sub(c.u, [1, 0, 0])) > 0.05), far = C.findIndex(c => c.power.i !== H && c.u[0] < -0.3 && api.relBase(H, c.power.i) > 0), fp = C[far].power.i;   // a friendly power: relations drift toward the alignments over the 100 days
  fresh(); const f0 = P.funds, a = api.buildStation(home);
  P.rel[api.pairKey(H, fp)] = -0.1; const b = api.gsCheck(far);
  P.rel[api.pairKey(H, fp)] = 0.5; P.op[fp] = 60; const c = api.buildStation(far);
  check('ground stations: home is a purchase; abroad needs friendly relations and opinion, and costs more', a.ok && !b.ok && c.ok && P.funds === f0 - 10 - 20 && api.stationsAll().length === 3,
    `${C[home].name} (home) ${a.cost}M; ${C[far].name}: refused at −0.1 ("${b.why}"), built at +0.5 for ${c.cost}M`);
  P.leasePaid = 0; api.advanceDays(100); P.rel[api.pairKey(H, fp)] = 0.5;
  const leased = P.leasePaid; P.rel[api.pairKey(H, fp)] = -0.6; api.advanceDays(1);
  check('a foreign station pays its lease every 100 days, and is shut when relations turn tense', leased >= api.GS_LEASE - 1e-9 && api.stationsAll().length === 2 && news.some(t => /shuts our ground station/.test(t)),
    `lease ${leased.toFixed(1)}M over 100 days; closed at −0.6`);
  // delivery: the same polar satellite and target, with only the pad vs with a station near the target
  const run = withStation => { fresh(); if (withStation) { P.rel[api.pairKey(H, fp)] = 0.9; P.op[fp] = 80; api.buildStation(far); }
    const r0 = TELLUS.R + 300e3, v = Math.sqrt(TELLUS.mu / r0); P.sats.push({ id: 1, name: 'L', epoch: 0, r: [r0, 0, 0], v: [0, v, 0], imgs: 0, pending: [], cam: 1, ant: 1, sci: 0, ballast: 0, bio: 0 });
    P.active = [{ id: 9, type: 'image', src: 'com', client: fp, p: { ci: far, res: 5, pay: 20, dur: 999 }, deadline: 999 }];
    for (let k = 0; k < 3000; k++) { api.advanceDays(0.005); if (!P.active.length) return P.day; if (withStation) P.rel[api.pairKey(H, fp)] = 0.9; } return Infinity; };
  const tPad = run(false), tNet = run(true);
  check('a station near the target brings the picture down sooner than waiting for a pass over the pad', isFinite(tNet) && tNet < tPad,
    `${C[far].name}: pad only, day ${tPad.toFixed(1)}; with a station there, day ${tNet.toFixed(1)} (${((tPad - tNet) * 6).toFixed(1)} h sooner)`);
  // contact time, and the imagery income that follows it
  const earn = withNet => { fresh(); if (withNet) for (let k = 1; k < api.POWERS.length; k++) { const ci = C.map((c, i) => ({ c, i })).filter(x => x.c.power.i === k).sort((a, b) => b.c.pop - a.c.pop)[0].i;
      P.rel[api.pairKey(H, k)] = 0.9; P.op[k] = 80; api.buildStation(ci); }
    const r0 = TELLUS.R + 300e3, v = Math.sqrt(TELLUS.mu / r0); P.sats.push({ id: 1, name: 'L', epoch: 0, r: [r0, 0, 0], v: [0, v, 0], imgs: 0, pending: [], cam: 1, ant: 1, sci: 0, ballast: 0, bio: 0 });
    P.funds = 1000; P.cycle = 0; let inc = 0; for (let k = 0; k < 20; k++) { const f = P.funds; api.advanceDays(5); for (let j = 1; j < api.POWERS.length; j++) P.rel[api.pairKey(H, j)] = 0.9; } return { contact: P.sats[0].contact, n: api.stationsAll().length }; };
  const lone = earn(false), net = earn(true);
  check('contact time: a polar satellite sees the pad a small share of the time; a station network multiplies it (and the imagery income with it)', lone.contact < 0.2 && net.contact > 2.5 * lone.contact,
    `pad only ${(lone.contact * 100).toFixed(0)}% → ${net.n} stations ${(net.contact * 100).toFixed(0)}%; sales ≈ ${(0.12 * lone.contact * 400).toFixed(0)}M vs ${(0.12 * net.contact * 400).toFixed(0)}M a year`);
  fresh(); P.stations = []; api.HOOK.news = () => {};
}

// 16. Radial fins and make-root (v1.18). The builder's tree operations run headless too: builder.js defines BLD without
// touching the DOM until init(), so it loads into the same sandbox as the sim core.
{
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
  const D = new Function(src + 'let stackDef=null;' + bsrc + ';return {toV2,assemble,newShip,geom,aeroPass,analyze,SND,PRESETS,BLD,set des(v){stackDef=v}};')();
  const find = (n, k) => n.k === k ? n : (n.c || []).map(x => find(x, k)).find(Boolean), cp = x => JSON.parse(JSON.stringify(x)), P0 = D.PRESETS;
  // plate forces alone (body subtracted) at M 0.6, 4°, 20 kPa
  const plates = (s, only) => { D.geom(s); const all = s.fins, v = 0.6 * D.SND(0), a = 4 * Math.PI / 180, rho = 40000 / (v * v), vb = [v * Math.sin(a), v * Math.cos(a), 0];
    const run = f => { s.fins = f; for (const p of s.parts) { p.F = [0, 0, 0]; p.L = [0, 0, 0]; } D.aeroPass(s, vb, [0, 0, 0], rho, 0.6, false); let Fx = 0, Lz = 0; for (const p of s.parts) { Fx += p.F[0]; Lz += p.L[2]; } return [Fx, Lz]; };
    const b = run([]), w = run(all.filter(only)); s.fins = all; return [w[0] - b[0], w[1] - b[1]]; };
  const R = D.newShip(D.toV2(cp(P0.Orbiter))), wR = D.toV2(cp(P0.Orbiter));
  find(wR.root, 'fins').c.push({ k: 'rfin', at: { y: 0.45, a: Math.PI / 4, n: 4, cy: 0.45 }, c: [] });
  const F = D.newShip(wR), a = plates(R, p => p.d.kind === 'fins'), b = plates(F, p => p.d.kind === 'rfin'), rf = F.parts.filter(p => p.d.kind === 'rfin');
  check('radial fins: four on a 1.25 m body give the ring\'s plate force (within 1%) at the same lever arm, roots on the skin', Math.abs(b[0] / a[0] - 1) < 0.01 &&
    Math.abs(b[1] / b[0] - a[1] / a[0]) < 1e-3 && rf.length === 4 && rf.every(p => Math.abs(Math.hypot(p.pos[0], p.pos[2]) - 0.625) < 1e-9),
    `force ratio ${(b[0] / a[0]).toFixed(4)}, arm ${(-a[1] / a[0]).toFixed(3)} / ${(-b[1] / b[0]).toFixed(3)} m`);
  const cal = d => { const s = D.newShip(d), A = D.analyze(s); return [(A.ful.ycm - A.ful.ycp) / (2 * s.radius), A.mq.cert.frac]; };
  const sw = n => { const d = D.toV2(cp(P0.Orbiter)), t = find(d.root, 't8'); t.c = [{ k: 'kestrel', at: 'd', c: [] }]; if (n) t.c.push({ k: 'rfin', at: { y: 0.45, a: 0, n, cy: 0.45 }, c: [] }); return d; };
  const c4 = cal(sw(4)), c3 = cal(sw(3)), c0 = cal(sw(0));
  check('radial fins: the Orbiter without its ring is unstable; ×3 radial fins about neutral, ×4 stable; fin roots hold at max-q', c0[0] < -2 && Math.abs(c3[0]) < 0.3 && c4[0] > 0.3 && c4[1] < 1,
    `calibers: none ${c0[0].toFixed(2)}, ×3 ${c3[0].toFixed(2)}, ×4 ${c4[0].toFixed(2)} · worst max-q joint ${(c4[1] * 100).toFixed(0)}%`);
  // make root: re-hang the Heavy preset from its core Kestrel; the assembled vessel must not change at all
  // canonical: segment numbers follow part creation order, which a re-root changes, so compare by stage label
  const r9 = v => +v.toFixed(9), fpA = A => JSON.stringify([A.parts.map(p => JSON.stringify([p.d.key, p.pos.map(r9), r9(p.y0), p.jA, p.jP.map(r9), p.jr || 0,
    A.segs[p.seg].label, p.parent && p.parent.d.key])).sort(), A.events.map(e => [e.decouple.map(k => A.segs[k].label).sort(), e.ignite.map(k => A.segs[k].label).sort(), !!e.chute, !!e.radial])]);
  const h = D.toV2(cp(P0.Heavy)); find(h.root, 't8').j = 2; D.des = h; const before = fpA(D.assemble(h));
  const k = (n => { const f = x => x.k === 'kestrel' && x.at === 'd' ? x : (x.c || []).map(f).find(Boolean); return f(n); })(h.root), path = D.BLD.rootPath(h.root, k);
  D.BLD.reroot(path); const after = fpA(D.assemble(h));
  check('make root: re-rooting the design at the core engine changes nothing in the assembled vessel (joints, reinforcement, stages)', h.root === k && !k.at && before === after,
    `path of ${path.length} parts; new root ${h.root.k}, old root now hangs '${find(h.root, 'pod').at}'`);
}

// 17. Staging editor (v1.20): a design may carry its own firing order (stg); atoms are named by decoupler node ids.
{
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
  const D = new Function(src + 'let stackDef=null;' + bsrc + ';return {toV2,assemble,newShip,stageStats,physStep,stage,DT,PRESETS,BLD};')();
  const cp = x => JSON.parse(JSON.stringify(x)), heavy = () => { const d = D.toV2(cp(D.PRESETS.Heavy)); D.BLD.ensureIds(d); return d; };
  const ids = A => A.stages.map(s => s.map(a => a.id)), evs = A => JSON.stringify(A.events);
  const h0 = heavy(), A0 = D.assemble(h0), h1 = heavy(); h1.stg = ids(A0); const A1 = D.assemble(h1);
  check('staging: the automatic order written out as a custom one gives the same events', A1.custom && !A0.custom && evs(A1) === evs(A0),
    A0.stages.map((s, i) => `${i + 1}: ${s.map(a => a.label).join(' + ')}`).join(' · '));
  // keep the boosters on until the core goes: their drop moves into the core's decoupling stage
  const L = ids(A0), bi = L.findIndex(s => s.some(id => id.startsWith('d:') && A0.stages[L.indexOf(s)].find(a => a.id === id).label.includes('boosters')));
  const bid = L[bi][0], h2 = heavy(); L.splice(bi, 1); L[bi].push(bid); h2.stg = L; const A2 = D.assemble(h2);
  const dv = d => D.stageStats(d).stages.map(s => s.dvV.toFixed(0)).join(' + ');
  check('staging: boosters held on until the core drops — one fewer stage, the drop event carries both, Δv plan changes', A2.events.length === A0.events.length - 1 &&
    A2.events.some(e => e.decouple.length === 3 && e.ignite.length === 1) && dv(h2) !== dv(h0), `auto ${dv(h0)} m/s → held ${dv(h2)} m/s`);
  // a part added after the custom order existed still gets staged (where the automatic order would put it)
  const h3 = heavy(); h3.stg = ids(D.assemble(h3)); const t2 = (n => { const f = x => x.k === 't2' ? x : (x.c || []).map(f).find(Boolean); return f(n); })(h3.root);
  t2.c.push({ k: 't1', at: { y: 1, a: 0, n: 2, cy: 0.55, dec: true }, c: [] }); D.BLD.ensureIds(h3); const A3 = D.assemble(h3), newD = A3.stages.flat().filter(a => a.label.includes('side tanks'));
  check('staging: a decoupler added after the order was set is still staged', newD.length === 1 && A3.events.some(e => e.decouple.length === 2 && e.radial),
    A3.stages.map((s, i) => `${i + 1}: ${s.map(a => a.label).join(' + ')}`).join(' · '));
  // drop the core first, boosters still on it: they must leave with it, not float on attached to nothing
  const h4 = heavy(), L4 = ids(D.assemble(h4)), ci = L4.findIndex(s => s.some(id => id.startsWith('d:') && id !== bid)), cid = L4[ci].find(id => id.startsWith('d:'));
  L4[ci] = L4[ci].filter(id => id !== cid); h4.stg = [L4[0], [cid], ...L4.slice(1)].filter(s => s.length);
  D.t = 0; const s4 = D.newShip(h4), boost = s4.parts.filter(p => p.d.key === 'kestrel' && !p.core); s4.throttle = 1; D.stage(s4); D.stage(s4);
  check('staging: dropping the core before its boosters takes the boosters with it', boost.length === 2 && boost.every(p => !p.on) && s4.parts.filter(p => p.on).every(p => !p.inst || p.core || p.inst.rdec === undefined),
    `after stage 2: ${s4.parts.filter(p => p.on).map(p => p.d.key).join(', ')}`);
  // an unedited preset (old format, no node ids yet) still shows every atom separately
  const Lg = D.assemble(cp(D.PRESETS.Heavy)).stages, flat = Lg.flat();
  check('staging: an unedited preset (no node ids) still lists each action separately', Lg[0].length === 2 && flat.some(a => a.label === 'drop core 1') && new Set(flat.map(a => a.id)).size === flat.length,
    Lg.map((s, i) => `${i + 1}: ${s.map(a => a.label).join(' + ')}`).join(' · '));
  // merge guard: the builder's three render hooks each sit once, inside render(). A zero-context patch once put one inside
  // drawMap (no ghosts or highlights) and another between the program panel's `if` and `else if` (decisions dead in the editor)
  const H = html.replace(/\r\n/g, '\n'), fnAt = i => { const m = [...H.slice(0, i).matchAll(/\nfunction (\w+)\(/g)]; return m.length ? m[m.length - 1][1] : '?'; };
  const at = s => { const o = []; let i = -1; while ((i = H.indexOf(s, i + 1)) >= 0) o.push(fnAt(i)); return o.join(','); };
  const hooks = ['HOOK.edDraw(', 'HOOK.edOverlay(', 'HOOK.view='].map(s => `${s} ${at(s)}`);
  check('merge guard: builder render hooks are each once inside render(), and the program click handler is an if / else-if chain',
    hooks.every(s => / render$/.test(s)) && /if\(ds\.start\)\{[^\n]*\}\n\s*else if\(ds\.dk\)/.test(H), hooks.join(' · '));
  // ids survive JSON and duplicates (a copied subtree) are repaired
  const h5 = heavy(), dup = cp(h5.root.c[0]); h5.root.c.push(dup); D.BLD.ensureIds(h5); const all = (n => { const r = []; const w = x => { r.push(x.id); (x.c || []).forEach(w); }; w(n); return r; })(h5.root);
  check('staging: node ids are unique after a copied subtree brings duplicates', new Set(all).size === all.length, `${all.length} nodes`);
}

// 18. Career moves (economy): when the program does badly (or very well), the team gets offers to defect or be hired.
{
  const P = api.PROG, news = []; api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {};
  const fresh = () => { api.resetHome(); Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: 60, bailouts: 0, day: 0, rel: {}, op: {}, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], sanc: {}, home: 0, history: [] }); };
  const careerOffers = setup => { fresh(); setup(); P.wseed = 31; for (let d = 0; d < 400 && !P.decisions.some(x => x.kind === 'defect' || x.kind === 'hire'); d += 10) api.advanceDays(10);
    return P.decisions.filter(x => x.kind === 'defect' || x.kind === 'hire').map(x => x.kind); };
  const whenBad = careerOffers(() => { P.bailouts = 2; P.op[0] = 20; }), whenFine = careerOffers(() => { P.op[0] = 50; }), whenGreat = careerOffers(() => { P.op[0] = 80; for (const k of ['weather', 'air', 'loads', 'range', 'beeper']) P.done[k] = {}; });
  check('career offers come when the program is in trouble (or excelling), not in ordinary times', whenBad.length === 1 && whenFine.length === 0 && whenGreat.length === 1,
    `in trouble: ${whenBad.join() || 'none'} · ordinary: ${whenFine.join() || 'none'} · excelling: ${whenGreat.join() || 'none'} (within 400 days)`);
  // defection: the program changes home; the old home sanctions, its contracts go; what the team knows comes along
  fresh(); api.chooseStart('agency'); P.cert.sparrow = 0.93; P.atm = { 0: 1, 1: 1 }; P.done.weather = {};
  const old = api.home, j = api.POWERS.find(p => p.i !== old && api.relOf(old, p.i) < 0.2).i;
  P.active = [{ id: 1, type: 'apex', src: 'gov', client: old, p: { lo: 10, hi: 25, pay: 10, dur: 100 }, deadline: 100 }];
  api.offerDecision({ kind: 'defect', power: j, amt: 120, title: 't', text: '', opts: [] }); api.resolveDecision(P.decisions[0].id, 'yes');
  const town = api.CITIES.find(c => c.power.i === old), y = api.newShip(['pod', 't1', 'kestrel']); y.rec.launched = true; y.landed = false; y.alive = false;
  const opOld = api.opOf(old); api.missionDrop(y, { kind: 'city', city: town, power: town.power }); api.missionEnd(y);
  check('defection: a new home and owner, signing money, the old home sanctions and cancels; knowledge and firsts carry over', api.home === j && api.ownKind() === 'national agency' && Object.keys(api.own().st).join() === String(j) &&
    api.sanctioned(old) && P.active.length === 0 && api.certOf('sparrow') === 0.93 && P.atm[1] === 1 && !!P.done.weather && P.history.length === 1,
    `${P.history[0].from} ${P.history[0].move}; old home opinion ${opOld.toFixed(0)}, sanctioned until day ${P.sanc[old]}`);
  check('…and the old home is now foreign: a stage on its town is a diplomatic incident', news.some(t => /Diplomatic incident/.test(t)) && api.opOf(old) < opOld, `${town.name}: opinion ${opOld.toFixed(0)} → ${api.opOf(old).toFixed(0)}`);
  // a private hire: a company buys the program; debts paid, government work dropped, knowledge kept
  fresh(); api.chooseStart('company'); api.own().debt = 30; P.cert.kestrel = 0.88;
  P.active = [{ id: 2, type: 'apex', src: 'gov', client: 0, p: { pay: 10, dur: 100, lo: 10, hi: 25 }, deadline: 100 }, { id: 3, type: 'apex', src: 'sci', client: 1, p: { pay: 10, dur: 100, lo: 10, hi: 25 }, deadline: 100 }];
  api.offerDecision({ kind: 'hire', co: 'Brutor Orbital', amt: 90, title: 't', text: '', opts: [] }); api.resolveDecision(P.decisions[0].id, 'yes');
  check('private hire: the company owns it all, the debt is gone, government contracts dropped, knowledge kept', api.own().pv === 1 && api.own().name === 'Brutor Orbital' && api.own().debt === 0 && P.funds === 90 &&
    P.active.length === 1 && P.active[0].src === 'sci' && api.certOf('kestrel') === 0.88 && api.home === 0, `${api.ownKind()} "${api.own().name}", funds ${P.funds}M`);
  fresh(); api.HOOK.news = () => {};
}

// 18. Canted engines (v1.22): a thrust direction per engine on a radial line; "balance" zeroes the net thrust torque.
{
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
  const D = new Function(src + 'let stackDef=null;' + bsrc + ';return {newShip,stageStats,physStep,stage,thrustPt,qrot,len,dot,sub,add,cross,DT,HOOK,BLD,get t(){return simT},set t(v){simT=v},set S(v){S=v}};')();
  const torque = s => { let L = [0, 0, 0]; for (const p of s.parts) if (p.d.kind === 'engine') { const d = p.tdir || [0, 1, 0]; L = D.add(L, D.cross(D.sub(D.thrustPt(p), s.cm), d.map(x => x * p.d.thrust))); } return D.len(L); };
  const pair = cant => ({ v: 2, root: { k: 'pod', c: [{ k: 't4', at: 'd', c: [{ k: 'kestrel', at: 'd', c: [] }, { k: 't4', at: { y: 1.9, a: 0, n: 2, cy: 1.9, dec: true }, c: [{ k: 'kestrel', at: 'd', c: [], ...(cant ? { cant } : {}) }] }] }] } });
  const P0 = D.newShip(pair(0)), P10 = D.newShip(pair(10)), bs = P10.parts.filter(p => p.tdir), dv = c => D.stageStats(pair(c)).stages[0].dvV;
  check('canted engines: no cant, no thrust direction; canted copies lean in toward the axis, unit length; a symmetric pair loses less than its cosine',
    !P0.parts.some(p => p.tdir) && bs.length === 2 && bs.every(p => Math.abs(D.len(p.tdir) - 1) < 1e-12 && D.dot(p.tdir, [Math.cos(p.phi), 0, Math.sin(p.phi)]) < 0) &&
    dv(10) < dv(0) && 1 - dv(10) / dv(0) < 1 - Math.cos(10 * Math.PI / 180) && D.BLD.aimCant(P0.parts.find(p => p.phi != null && p.d.kind === 'engine'), P0) === 0,
    `first-stage Δv ${dv(0).toFixed(0)} → ${dv(10).toFixed(0)} m/s at 10°; balance on the symmetric pair: 0°`);
  // a light core with a lone big booster: uncanted it flips; balanced it climbs
  const lone = cant => ({ v: 2, root: { k: 'pod', c: [{ k: 'chute', at: 'u', c: [] }, { k: 't8', at: 'd', c: [{ k: 'fins', at: 'd', c: [{ k: 'sparrow', at: 'd', c: [] }] },
    { k: 'T16', at: { y: 3.7, a: 0, n: 1, cy: 2, dec: true }, c: [{ k: 'condor', at: 'd', c: [], ...(cant ? { cant } : {}) }] }] }] } });
  const L0 = D.newShip(lone(0)), aim = D.BLD.aimCant(L0.parts.find(p => p.phi != null && p.d.kind === 'engine'), L0), L1 = D.newShip(lone(aim));
  const fly = cant => { D.t = 0; const s = D.newShip(lone(cant)); D.S = s; D.HOOK.msg = () => {}; s.throttle = 1; D.stage(s); let tilt = 0;
    for (let i = 0; i < 2500 && s.alive; i++) { D.physStep(s, D.DT); const Y = D.qrot(s.q, [0, 1, 0]), up = s.r.map(x => x / D.len(s.r)); tilt = Math.max(tilt, Math.acos(Math.min(1, D.dot(Y, up))) * 57.3); }
    return { alive: s.alive, tilt }; };
  const f0 = fly(0), f1 = fly(aim);
  check('canted engines: "balance" zeroes the thrust torque of a Sparrow core + lone Condor; uncanted it flips, balanced it climbs',
    torque(L1) < 0.01 * torque(L0) && f0.tilt > 90 && f1.alive && f1.tilt < 10,
    `cant ${aim.toFixed(2)}°, torque ${torque(L0).toFixed(0)} → ${torque(L1).toFixed(2)} kN·m; max tilt ${f0.tilt.toFixed(0)}° → ${f1.tilt.toFixed(1)}°`);
}

// 19. Aero interference (v1.23): Newtonian shadowing between stack lines.
{
  const D = new Function(src + 'return {newShip,geom,aeroPass,analyze,SND,PRESETS,set SH(v){AERO_SHADOW=v}};')();
  const cp = x => JSON.parse(JSON.stringify(x));
  // aero on a fresh ship at a given AoA (q 20 kPa, M 0.6); flow in the x-y plane, from +x when sgn = 1, from −x when −1
  const run = (d, aoa, sh, sgn = 1) => { D.SH = sh; const s = D.newShip(cp(d)); D.geom(s); const v = 0.6 * D.SND(0), a = aoa * Math.PI / 180, rho = 40000 / (v * v);
    for (const p of s.parts) { p.F = [0, 0, 0]; p.L = [0, 0, 0]; p.Q = 0; } D.aeroPass(s, [sgn * v * Math.sin(a), v * Math.cos(a), 0], [0, 0, 0], rho, 0.6, false); D.SH = true;
    let F = [0, 0, 0], Q = 0; for (const p of s.parts) { F = F.map((x, i) => x + p.F[i]); Q += p.Q; } return { s, F, Q, n: s.nShadow || 0 }; };
  const same = (a, b) => a.F.every((x, i) => x === b.F[i]) && a.Q === b.Q;
  const orb = [0, 20, 90].every(a => same(run(D.PRESETS.Orbiter, a, true), run(D.PRESETS.Orbiter, a, false))), h0 = same(run(D.PRESETS.Heavy, 0, true), run(D.PRESETS.Heavy, 0, false));
  check('aero interference: a single-line rocket, and any rocket at zero angle of attack, is exactly unchanged', orb && h0);
  // broadside Heavy: the boosters sit on the x axis, in line with the crossflow; the leeward booster goes dark
  const B = run(D.PRESETS.Heavy, 90, true), side = sgnx => B.s.parts.filter(p => p.d.key === 't4' && Math.sign(p.pos[0]) === sgnx).reduce((m, p) => m + Math.hypot(p.F[0], p.F[2]), 0);
  const windward = side(1), leeward = side(-1);   // air arrives from +x (vb along +x means the body moves toward +x)
  check('aero interference: broadside, the leeward booster tank gets no impact pressure, the windward one does', windward > 1000 && leeward < 0.02 * windward && B.n > 0,
    `windward ${(windward / 1000).toFixed(1)} kN, leeward ${(leeward / 1000).toFixed(2)} kN, ${B.n} shadowed samples`);
  const mir = run(D.PRESETS.Heavy, 60, true, 1), mir2 = run(D.PRESETS.Heavy, 60, true, -1);
  check('aero interference: mirror-symmetric (flow from +x and from −x give mirrored forces)', Math.abs(mir.F[0] + mir2.F[0]) < 1e-6 * Math.abs(mir.F[0]) && Math.abs(mir.F[1] - mir2.F[1]) < 1e-6 * Math.abs(mir.F[1]));
  const cut = a => 1 - Math.abs(run(D.PRESETS.Heavy, a, true).F[0]) / Math.abs(run(D.PRESETS.Heavy, a, false).F[0]), c5 = cut(5), c20 = cut(20), c90 = cut(90);
  check('aero interference: the Heavy\'s normal-force cut grows with angle of attack (small at 5°, about half broadside)', c5 > 0 && c5 < 0.1 && c20 > c5 && c90 > 0.3 && c90 < 0.7,
    `cut ${(c5 * 100).toFixed(1)}% at 5°, ${(c20 * 100).toFixed(1)}% at 20°, ${(c90 * 100).toFixed(1)}% at 90°`);
}

// 19. Power flavours (economy): archetypes as presets on axes (openness, money, priorities, nationalism).
{
  const P = api.PROG, news = []; api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {};
  const fresh = (arch = null) => { api.resetHome(); Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: 60, bailouts: 0, day: 0, rel: {}, op: {}, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], sanc: {}, home: 0, history: [],
    homeArch: arch, nat: {}, hush: 0, hushPen: 0, bmult: 1, demand: null, cancelled: false, nextElection: null, comm: 0, commPh: null, wseed: 5 }); api.chooseStart('agency'); P.funds = 60; };
  const PW = api.POWERS, arch = PW.map(p => p.arch);
  fresh('security');
  check('flavours: every power has an archetype, the two biggest economies are one open and one closed superpower; picking yours overrides', arch.every(a => api.ARCH[a]) && arch.includes('openSuper') && arch.includes('closedSuper') && api.flav(0) === api.ARCH.security,
    PW.map(p => `${p.root}: ${api.ARCH[p.arch].name}`).join(' · '));
  // openness: an open program takes the whole hit; a closed one a part now, and the rest leaks later, worse
  fresh('openSuper'); P.op[0] = 60; api.failHit(-10, 'x'); const openHit = 60 - api.opOf(0);
  fresh('closedSuper'); P.op[0] = 60; api.failHit(-10, 'x'); const closedNow = 60 - api.opOf(0), pen = -P.hushPen; let leakDay = null, leakDrop = 0;
  for (let d = 0; d < 2000 && P.hush; d += 10) { const o = api.opOf(0); api.advanceDays(10); if (!P.hush) { leakDay = P.day; leakDrop = o - api.opOf(0); } }
  check('openness: open programs take a failure in full; closed ones hush it up, until it leaks (worse)', Math.abs(openHit - 9.4) < 0.01 && closedNow < 6 && pen > 10 - closedNow && leakDay != null && leakDrop > pen * 0.8 && news.some(t => /^Leaked/.test(t)),
    `open −${openHit.toFixed(1)} now · closed −${closedNow.toFixed(1)} now, then −${leakDrop.toFixed(1)} when it leaked (day ${leakDay && leakDay.toFixed(0)})`);
  // money: each kind responds to its own driver
  fresh('resource'); P.op[0] = 50; P.comm = 0.8; const boom = api.moneyK(0); P.comm = -0.8; const bust = api.moneyK(0);
  fresh('security'); P.op[0] = 50; P.rel = {}; for (const p of PW) if (p.i) P.rel[`0-${p.i}`] = 0.5; const calm = api.moneyK(0); P.rel['0-1'] = -0.9; const tense = api.moneyK(0);
  fresh('rising'); P.op[0] = 50; const y0 = api.moneyK(0); P.day = 800; const y2 = api.moneyK(0);
  check('money: commodity budgets boom and bust, military budgets grow with tension, a rising power\'s budget grows', boom > 2.5 * bust && tense > 1.5 * calm && Math.abs(y2 / y0 - 2) < 1e-9,
    `commodity boom ${boom.toFixed(2)} vs bust ${bust.toFixed(2)} · military calm ${calm.toFixed(2)} vs tense ${tense.toFixed(2)} · rising day 0 ${y0.toFixed(2)} → day 800 ${y2.toFixed(2)}`);
  // priorities: a security state gets military work, a frugal middle power science and commerce
  const mix = a => { fresh(a); P.done = { weather: {}, beeper: {}, lift1: {}, hop: {} }; P.offers = []; const c = {}; for (let d = 0; d < 1500; d += 5) { api.advanceDays(5); for (const o of P.offers) c[o.src] = (c[o.src] || 0) + 1; P.offers = []; } return c; };
  const ms = mix('security'), mf = mix('frugal');
  check('priorities shape the board: military offers dominate a security state, commerce and science a frugal power', ms.mil > 2 * (mf.mil || 0) && (mf.com + mf.sci) > 1.5 * (ms.com + ms.sci),
    `security: mil ${ms.mil}, com ${ms.com}, sci ${ms.sci} · frugal: mil ${mf.mil || 0}, com ${mf.com}, sci ${mf.sci}`);
  // nationalism: rises with tension, and scales the reaction at home to a foreign stake
  fresh('frugal'); P.rel = {}; for (const p of PW) if (p.i) P.rel[`0-${p.i}`] = 0.5; const n0 = api.natOf(0); for (let d = 0; d < 400; d += 10) { P.rel['0-1'] = -1; api.advanceDays(10); } const n1 = api.natOf(0);   // a standing feud
  const stakeHit = n => { fresh('frugal'); P.nat = { 0: n }; P.op[0] = 50; api.offerDecision({ kind: 'stake', power: 2, amt: 10, title: 't', text: '', opts: [] }); api.resolveDecision(P.decisions[0].id, 'yes'); return 50 - api.opOf(0); };
  check('nationalism rises with tension and makes a foreign stake costlier at home', n1 > n0 + 0.2 && stakeHit(0.9) > 2.5 * stakeHit(0.1), `nationalism ${n0.toFixed(2)} → ${n1.toFixed(2)} with a hostile neighbour · stake costs ${stakeHit(0.1).toFixed(1)} at 0.1, ${stakeHit(0.9).toFixed(1)} at 0.9`);
  // elections: an open program's budget mood follows opinion on election day
  fresh('openSuper'); P.op[0] = 80; P.nextElection = 20; api.advanceDays(25); const up = P.bmult; fresh('openSuper'); P.op[0] = 20; P.nextElection = 20; api.advanceDays(25);
  check('elections: a popular program gets a bigger budget for the term, an unpopular one a cut', up === 1.25 && P.bmult === 0.7, `opinion 80 → ×${up}, opinion 20 → ×${P.bmult}`);
  // spectaculars: a closed program is told to deliver by a date; a first in the world does it
  fresh('closedSuper'); P.op[0] = 50; for (let d = 0; d < 1000 && !P.demand; d += 10) api.advanceDays(10); const asked = !!P.demand, f0 = P.funds, o0 = api.opOf(0); api.demandMet('a first');
  check('spectaculars: the leadership demands one by a date; delivering pleases it (and pays, under patronage)', asked && !P.demand && P.funds === f0 + 30 && api.opOf(0) === o0 + 8, `demanded by day ${asked ? 'set' : '—'}; delivered: +30M, opinion +8`);
  // regime change: a security state's program can be cancelled; ignoring both offers leaves a private remnant
  fresh('security'); P.op[0] = 20; for (let d = 0; d < 3000 && !P.cancelled; d += 10) api.advanceDays(10); const offers = P.decisions.map(x => x.kind).sort().join();
  api.advanceDays(45);
  check('regime change cancels a security state\'s program: defect or go private, and doing nothing leaves a private remnant', offers === 'defect,hire' && api.own().pv === 1 && /Space Collective/.test(api.own().name) && !P.cancelled,
    `offers: ${offers}; after 45 days: ${api.ownKind()} "${api.own().name}"`);
  fresh(); api.HOOK.news = () => {};
}

// 18. The logbook (planning branch): facts measured by real flights, with provenance; records only improve.
{
  const P = api.PROG, logged = []; api.HOOK.news = () => {}; api.HOOK.msg = () => {}; api.HOOK.logged = ids => logged.push(...ids);
  const fresh = () => Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: 500, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, day: 0, sats: [], satN: 0, stations: [], log: {} });
  // a real flight to space (the Passenger preset, booster dropped at burnout) records the Δv it spent and the design
  fresh(); api.t = 0; let s = api.newShip(api.PRESETS.Passenger); api.S = s; s.throttle = 1; api.stage(s); let stg = 0, arm = false, k = 0;
  while (s.alive && !(s.rec.launched && s.landed) && k++ < 600000) {
    if (stg === 0 && s.rec.launched && s.thrust === 0) { api.stage(s); stg = 1; }
    if (stg === 1 && !arm && dot(s.v, norm(s.r)) < 0) { api.stage(s); arm = true; } api.advPhys(s); }
  api.missionEnd(s); const L = P.log;
  check('logbook: a flight to space records the Δv it actually spent, who flew it, and the design; its apex too', L.space && L.space.v > 1000 && L.space.v < s.rec.dv + 1e-9 && L.space.by === 'Passenger' && !!L.space.stack && L.apex && Math.abs(L.apex.v - s.rec.apex) < 1 && logged.includes('space'),
    `space: ${L.space && L.space.v.toFixed(0)} m/s by ${L.space && L.space.by} (flight total ${s.rec.dv.toFixed(0)}); apex ${L.apex && (L.apex.v / 1e3).toFixed(0)} km`);
  // orbit records: the first sets it (with the period), a worse one changes nothing, a better one replaces it and keeps history
  const orbitWith = (dv, st = ['sci', 'petrel']) => { api.t = 0; const x = api.newShip(st); api.S = x; x.landed = false; x.rec.launched = true; x.rec.dv = dv;
    const r0 = TELLUS.R + ATM + 50e3; x.r = [r0, 0, 0]; x.v = [0, 0, -Math.sqrt(TELLUS.mu / r0)]; api.advRails(x, 60, 1000); api.missionEnd(x); };
  orbitWith(4321); const first = { ...L.orbit }, per = L.period.v.p; orbitWith(4500); const after2 = L.orbit.v; orbitWith(4200, ['sci', 'kestrel']);
  check('records only improve: a costlier orbit leaves the record alone, a cheaper one replaces it and the old value is kept; the period is set once',
    first.v === 4321 && after2 === 4321 && L.orbit.v === 4200 && L.orbit.hist.join() === '4321' && L.period.v.p === per && /^Design [0-9A-Z]{1,4}$/.test(L.orbit.by),
    `orbit 4321 → (4500 ignored) → 4200 by ${L.orbit.by}; period ${(per / 60).toFixed(1)} min, unchanged`);
  check('names: a preset design is named after the preset; any other design gets a stable short name', api.designName(api.PRESETS.Orbiter) === 'Orbiter' && api.designName(['sci', 'kestrel']) === api.designName(['sci', 'kestrel']) && api.designName(['sci', 'kestrel']) !== api.designName(['sci', 'petrel']));
  const e1 = api.eraOf(); P.done.beeper = { flight: 1 };
  check('the logbook\'s era follows the program: a notebook until something orbits, then a terminal', e1 === 1 && api.eraOf() === 2);
  fresh(); api.HOOK.logged = () => {};
}

function moonPos(t) { return api.moonPos(t); }
console.log(log.slice(0, 12).join('\n'));
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
