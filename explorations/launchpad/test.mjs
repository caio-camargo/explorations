// Headless checks for Launchpad's simulation core. Run: node test.mjs
// Extracts the "SIM BEGIN … SIM END" block from index.html and drives it with no DOM or GL.
import { readFileSync } from 'node:fs';
import { crewLunar } from './fly_crewlunar.mjs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `
return {ctrlAuthority,ctrlAuthRoll,activeEngines,missionTick,upcoming,nextEvent,advanceTo,acceptOffer,COMP_ERAS,compLag,compEra,worldEra,compYear,predErr,studyQuote,orderStudy,studyWait,studyKey,studyOf,predictImpact,FAC,facLv,buildFac,fleetSalvage,devLv,devQuote,startDev,devPriceK,wearOf,buildStand,startTest,testQuote,standReady,STAND_COST,prodLine,prodLineK,prodQuote,startProdLine,prodUnits,khVessel,khYield,khUse,khBar,use0,khLearn,igniteOK,khOn,OPS_FIX,OPS_FRAC,SITES,siteById,curSite,homeSite,homeSites,siteAccessOf,siteFits,siteFrame,terrainH,terrainSlope,SITE_GAP,PAD_FLAT,tapeNew,toolOK,TOOLS,eraOf,designName,LOGF,sourceOf,tierOf,indOf,cert0,IMPORT_K,GREY_K,cancelProgram,demandMet,flav,ARCH,natOf,moneyK,failHit,flavTick,sanction,sanctioned,offerRisk,RIVALS,RACE,raceLost,LEAK_P,genOffer,contractEval,chooseStart,own,stateShare,ownKind,floorCheck,offerDecision,resolveDecision,income,valuation,pickClient,rng,acceptOffer,CT,capOf,ensureBoard,standOf,GRANT_100,wearOf,makePowers,POWERS,powerAt,relOf,opOf,advanceDays,DAY_S,prepDays,HOME,vesselCost,FUNDS0,FUNDS_FLOOR,REFURB,advPhys,advRails,PROG,MISSIONS,missionEnd,missionDrop,safetyReview,certOf,atmU,G_LIM,CERT0,CITIES,landValue,isLand,dropVerdict,debrisImpact,fall,surfVelX:null,predictImpact,tapePhys,tapeRails,tapeStage,tapePlay,tapeDuration,toPF,railsOK,segFuel,stageStats,partMass,PARTS,analyze,nodeInfo,nodeBurnTime,predictFrom,dvPlan,kepler,elements,timeToNu,predict,newShip,physStep,rails,stage,dvRemaining,localFrame,qFromBasis,qrot,cross,norm,len,sub,add,mul,dot,probe,firstSeg,geom,INP,surfVel,SND,buildStation,gsCheck,stationsAll,GS_LEASE,pairKey,satAt,absTh,cloudAt,sunUp,relBase,SURF_MOON,SURF,BIOMES,surfaceAt,surfaceHit,biomeAt,groundAlt,TOPPLE,groundGap,aglAt,MAIN_AGL,fromPF,density,
  badness,careerMove,get home(){return HOME},resetHome(){HOME=0;RIVALS=raceSchedule()},
  TELLUS,SELENE,NYX,BODIES,soiAt,bodyRel,bodyPos,MISSIONS,SUN_DIR,advRails,satRegister,utilTick,navCover,capital,STAT_R,isTV,rotY,abort,activeEngines,PRESETS,HOOK,moonPos,moonVel,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v},DT};`)();
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
  // 3b. once there, the orbit is held on rails: 30 days of warp give the same orbit as small steps. (Since 6b the moons'
  // tides reach low orbit, so Ap/Pe really do drift a little; what warp must not do is change the answer.)
  const s = r.s, e0 = elements(s.r, s.v, TELLUS.mu), st0 = { r: s.r.slice(), v: s.v.slice(), t: api.t };
  check('railsOK in orbit', api.railsOK(s));
  const t0 = performance.now(); let frames = 0;
  while (api.t < st0.t + 30 * 86400 - 1e-6) { api.rails(s, Math.min(100000 / 60, st0.t + 30 * 86400 - api.t)); frames++; }
  const us = (performance.now() - t0) / frames * 1000, e1 = elements(s.r, s.v, TELLUS.mu), rW = s.r.slice();
  s.r = st0.r.slice(); s.v = st0.v.slice(); api.t = st0.t; while (api.t < st0.t + 30 * 86400 - 1e-6) api.rails(s, Math.min(60, st0.t + 30 * 86400 - api.t));
  const e2 = elements(s.r, s.v, TELLUS.mu);
  check('30 days at 100000× = 30 days in 60 s chunks (warp is exact); tides from the moons move Ap/Pe by under a km', Math.abs(e1.ap - e2.ap) < 1 && Math.abs(e1.pe - e2.pe) < 1 && Math.abs(e1.ap - e0.ap) < 1000 && Math.abs(e1.pe - e0.pe) < 1000,
    `warp vs small steps: ΔAp ${(e1.ap - e2.ap).toExponential(1)} m, ΔPe ${(e1.pe - e2.pe).toExponential(1)} m, ${len(sub(rW, s.r)).toFixed(1)} m apart; tidal drift in 30 days: Ap ${(e1.ap - e0.ap).toFixed(0)} m, Pe ${(e1.pe - e0.pe).toFixed(0)} m; ${us.toFixed(0)} µs per warp frame`);
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
    s.throttle = 1; api.stage(s); let maxLoad = 0, maxQ = 0, yankLoad = 0;
    while (api.t < 600 && s.alive) {
      api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0;
      if (yank && s.qdyn > 15000 && !yank.done) { yank.t0 = yank.t0 ?? api.t; api.INP.pitch = 1; if (api.t > yank.t0 + yank.dur) yank.done = true; }
      if (api.t > 9.8) s.sasMode = 'pro';
      const el = elements(s.r, s.v, TELLUS.mu); if (el.ap - TELLUS.R > (ATM + 10000)) s.throttle = 0;
      if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.stage(s);
      api.physStep(s, api.DT); maxLoad = Math.max(maxLoad, s.maxLoad); maxQ = Math.max(maxQ, s.qdyn);
      if (yank && yank.t0 != null && api.t < yank.t0 + yank.dur + 3) yankLoad = Math.max(yankLoad, s.maxLoad);
      if (len(s.r) - TELLUS.R > ATM && s.throttle === 0) break;
    }
    api.INP.pitch = 0;
    return { ok: s.alive && len(s.r) - TELLUS.R > ATM, maxLoad, maxQ, yankLoad, broke: msgs.find(m => /Structural/.test(m)) };
  }
  for (const k of ['Orbiter', 'Lunar']) { const r = flySAS(P[k]);
    check(`${k}: W-tap + prograde hold reaches space intact`, r.ok && !r.broke, `max q ${(r.maxQ / 1000).toFixed(1)} kPa, worst joint ${(r.maxLoad * 100).toFixed(0)}%`); }
  const y = flySAS(P.Lunar, { yank: { dur: 4 } });
  // it snapped at exactly 100 % while the gimbal was an instant torque; a real nozzle (slew, sea-level thrust) takes ~10 % off
  check('Lunar: 4 s hard pitch at max-q takes a joint to the edge (≥ 80 %)', y.yankLoad >= 0.8, `${(y.yankLoad * 100).toFixed(0)} %${y.broke ? ', ' + y.broke : ''}`);

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
    api.INP.pitch = (api.t >= 8 && api.t < 9.2) ? 1 : 0; if (api.t > 10.2 && s.sasMode !== 'pro') s.sasMode = 'pro';   // kick retuned for the bigger planet, then for SAS's exact prograde tracking (control session)
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
  const before = api.certOf('sparrow'), finC0 = api.certOf('fins'), tnkC0 = api.certOf('t1'), cd0 = api.certOf('condor'); api.missionEnd(s); const kc = api.certOf('sparrow'), fc = api.certOf('fins'), tc = api.certOf('t1');
  check('telemetry from an instrumented flight raises certified ratings, for the parts that flew only, never past 100 %', kc > before && fc > finC0 && tc > tnkC0 && api.certOf('condor') === api.cert0('condor') && Math.abs(cd0 - api.cert0('condor')) < 0.01 && Math.max(kc, fc, tc) < 1,
    `sparrow ${(kc * 100).toFixed(0)}%, fins ${(fc * 100).toFixed(0)}%, tank ${(tc * 100).toFixed(0)}%, condor (didn't fly) ${(api.certOf('condor') * 100).toFixed(0)}%`);
  // the impact predictor's spread: wide while the air is unknown, gone where it's been sampled
  const probeShip = () => { api.t = 0; const q = api.newShip(['chute', 'pod']); q.landed = false; q.r = [TELLUS.R + 60000, 0, 0]; q.v = [0, 0, -1200]; q.chute = false; return q; };
  const gc = (a, b) => Math.acos(Math.min(1, dot(norm(a), norm(b)))) * TELLUS.R / 1000;
  fresh(); let q = probeShip(); const i0 = api.predictImpact(q), w0 = gc(api.predictImpact(q, -1).pf, api.predictImpact(q, 1).pf);
  [0, 1, 2, 3, 4, 5, 6].forEach(k => P.atm[k] = 1); q = probeShip(); P.studies = { [api.studyKey(q)]: { err: 0 } }; const w1 = gc(api.predictImpact(q, -1).pf, api.predictImpact(q, 1).pf);   // (studied exactly: only the air counts here)
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
  check('budget: launch charged (vehicle + operations), intact landing refurbished at REFURB of dry price, the mission paid', Math.abs(net - (c0.cost + api.OPS_FIX + api.OPS_FRAC * c0.cost - c0.dry * api.REFURB)) < 0.1 && !!P.done.weather,   // within 0.1M: a touchdown a hair over 6 m/s wears the parts slightly
    `net ${net.toFixed(4)} vs ${(c0.cost + api.OPS_FIX + api.OPS_FRAC * c0.cost - c0.dry * api.REFURB).toFixed(4)}, done ${Object.keys(P.done)}, cost ${c0.cost.toFixed(2)}k, refurbished ${(c0.dry * api.REFURB).toFixed(2)}k, mission +15k → funds ${P.funds.toFixed(2)}k`);
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
  const ft = api.t, khv = api.khVessel(s); api.missionEnd(s); const want = Math.ceil(api.prepDays(c0.cost) * (1 + 0.5 * (1 - khv))) + ft / api.DAY_S;   // stacking stretches with unfamiliar parts; lift-off waits for the daily launch window
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
  check('contracts overlap: one sounding flight completes two contracts and a first, each paid once', P.active.length === 0 && s.rec.cdone.length === 2 && !!P.done.weather && P.cdone === 2 && Math.abs(P.funds - (f0 - s.rec.cost - s.rec.ops + (10 + 11) * api.khYield() + paid())) < 1e-6,
    `${s.rec.cdone.join(' + ')} + Above the weather; funds ${f0}M → ${P.funds.toFixed(2)}M before refurbishment`);
  // capacity: two at first, growing with contracts done
  fresh(); P.day = 0; P.offers = [1, 2, 3, 4].map(i => ({ ...ct('apex', { lo: 10, hi: 25 }), id: i, expires: 50 })); const took = [1, 2, 3].map(i => api.acceptOffer(i)); const c0cap = api.capOf(); P.cdone = 6;
  check('capacity: two contracts at first, more as the program completes them', took.join() === 'true,true,false' && c0cap === 2 && api.capOf() === 4, `took ${took.join(', ')}; capacity 2 → ${api.capOf()} after 6 done`);
  // a satellite contract: periapsis/apoapsis window and inclination, with a precision bonus; the wrong plane doesn't count
  const orbAt = (st, alt, incDeg) => { const x = api.newShip(st); api.S = x; api.t = 0; x.landed = false; const r0 = TELLUS.R + alt * 1e3, v = Math.sqrt(TELLUS.mu / r0), i = incDeg * Math.PI / 180;
    x.r = [r0, 0, 0]; x.v = [0, v * Math.sin(i), -v * Math.cos(i)]; x.rec.launched = true; api.advRails(x, 60, 1000); return x; };
  fresh(); P.day = 0; P.done.beeper = { flight: 0 }; P.active = [ct('sat', { alt: 150, tol: 20, inc: 0, itol: 3, pay: 50 }, 'com'), ct('sat', { alt: 150, tol: 20, inc: 30, itol: 3, pay: 60 }, 'com')]; const f1 = P.funds;
  orbAt(['sci'], 150, 0);
  check('satellite contract: a centred 150 km equatorial orbit pays with the full precision bonus; the 30° one stays open', P.active.length === 1 && P.active[0].p.inc === 30 && Math.abs(P.funds - f1 - 50 * 1.3) < 1e-3,   // 1e-3: since 6b the moons' tides nudge even a 60 s test orbit
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

// 20. More bodies (bodies session): a body tree; Nyx, a small moon on an inclined eccentric orbit whose SOI breathes.
{
  const { NYX, soiAt, bodyRel } = api, P = 2 * Math.PI / NYX.n, tPe = (2 * Math.PI - NYX.orb.M0) / NYX.n, tAp = tPe - P / 2;
  const sPe = soiAt(NYX, tPe), sAp = soiAt(NYX, tAp), [rP] = bodyRel(NYX, tPe), [rA] = bodyRel(NYX, tAp);
  const incl = Math.asin(Math.abs(norm(cross(...bodyRel(NYX, 1234)))[1] ** 2 < 1 ? Math.sqrt(1 - norm(cross(...bodyRel(NYX, 1234)))[1] ** 2) : 0)) * 180 / Math.PI;
  check('Nyx: eccentric inclined orbit clear of Selene\'s SOI; its SOI breathes with distance', Math.abs(len(rP) - NYX.rMin) < 1 && Math.abs(len(rA) - NYX.rMax) < 1 &&
    Math.abs(incl - 30) < 1e-6 && NYX.rMax + NYX.soi < SELENE.a - SELENE.soi && Math.abs(sPe - NYX.soiMin) < 1 && Math.abs(sAp - NYX.soi) < 1,
    `pe ${(len(rP) / 1e3).toFixed(0)} km, ap ${(len(rA) / 1e3).toFixed(0)} km, i ${incl.toFixed(1)}°, period ${(P / 3600).toFixed(1)} h; SOI ${(sPe / 1e3).toFixed(0)}–${(sAp / 1e3).toFixed(0)} km; clearance to Selene's SOI ${((SELENE.a - SELENE.soi - NYX.rMax - NYX.soi) / 1e3).toFixed(0)} km`);
  // an approach from outside the SOI near Nyx's apoapsis: predict() finds the encounter; rails switch there; then it leaves again
  const t0 = tAp - 2 * 3600, [m0, mv0] = bodyRel(NYX, t0), dir = norm(sub(bodyRel(NYX, t0 + 6 * 3600)[0], m0));
  const ship = (r, v, b, t) => { api.t = t; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.landed = false; s.body = b; s.r = r; s.v = v; s.throttle = 0; return s; };
  const side = norm(cross(dir, cross(m0, mv0)));
  let s = ship(add(add(m0, mul(dir, -1.8 * NYX.soi)), mul(side, 500e3)), add(mv0, mul(dir, 250)), TELLUS, t0);   // trailing it 500 km off-axis, catching up at 250 m/s
  let p = api.predict(s), enc = p[0].endKind === 'enc' && p[1].b === NYX;
  let sw = null; while (api.t < t0 + 40 * 3600 && s.alive) { api.rails(s, 60); if (s.body === NYX && sw === null) sw = api.t; if (sw !== null && s.body !== NYX) break; }
  check('Nyx: predict() finds an encounter, rails switch into its SOI at the predicted time, and out again', enc && sw !== null && sw - p[0].endT >= 0 && sw - p[0].endT <= 60 && (s.body === TELLUS || !s.alive),
    enc ? `encounter predicted at +${((p[0].endT - t0) / 3600).toFixed(2)} h (Pe ${p[1].el.pe < NYX.R ? 'impact' : ((p[1].el.pe - NYX.R) / 1e3).toFixed(0) + ' km'}), switched at +${sw && ((sw - t0) / 3600).toFixed(2)} h, out at +${((api.t - t0) / 3600).toFixed(2)} h (predicted +${p[1].endT ? ((p[1].endT - t0) / 3600).toFixed(2) : '—'} h)` : p.map(x => x.b.name + ':' + x.endKind).join(' '));
  // stripping: a retrograde bound orbit whose apoapsis reaches past the periapsis-time SOI is predicted to leave as Nyx swings in, and does
  const rr = NYX.R + 150e3, ra = 0.8 * NYX.soi, aO = (rr + ra) / 2, vpe = Math.sqrt(NYX.mu * (2 / rr - 1 / aO)), [mA, vA] = bodyRel(NYX, tAp), hn = norm(cross(mA, vA));
  s = ship(mul(norm(mA), rr), mul(cross(norm(mA), hn), vpe), NYX, tAp);
  p = api.predict(s); const esc = p[0].endKind === 'esc';
  log.length = 0; while (api.t < tAp + 3 * P && s.body === NYX && s.alive) api.rails(s, 300);
  const left = s.body === TELLUS;
  check('Nyx: an orbit reaching past its periapsis-time SOI is stripped as Nyx swings in (predicted, then flown on rails)', esc && left && Math.abs(api.t - p[0].endT) < 300,
    `orbit ${(rr - NYX.R) / 1e3}–${((ra - NYX.R) / 1e3).toFixed(0)} km; predicted escape at +${esc ? ((p[0].endT - tAp) / 3600).toFixed(1) : '—'} h (SOI then ${esc ? (api.soiAt(NYX, p[0].endT) / 1e3).toFixed(0) : '—'} km), flown ${left ? 'out at +' + ((api.t - tAp) / 3600).toFixed(1) + ' h' : 'still bound'}`);
  // a low orbit is never stripped: no escape predicted, still bound after three Nyx orbits
  s = ship(mul(norm(mA), NYX.R + 100e3), mul(cross(norm(mA), hn), Math.sqrt(NYX.mu / (NYX.R + 100e3))), NYX, tAp);
  p = api.predict(s); while (api.t < tAp + 3 * P && s.body === NYX) api.rails(s, 3600);
  check('Nyx: a 100 km circular orbit stays inside even the smallest SOI', !p[0].endKind && s.body === NYX && s.alive, `${p.length} leg(s), body after 3 Nyx orbits: ${s.body.name}`);
  // falling onto airless Nyx is exact
  s = ship([NYX.R + 20000, 0, 0], [0, 0, -150], NYX, 1000); const ip = api.predictImpact(s); let n = 0;
  while (s.alive && !s.landed && n++ < 200000) { if (api.railsOK(s)) api.rails(s, 1); else api.physStep(s, api.DT); }
  const gcd = ip && Math.acos(Math.max(-1, Math.min(1, dot(norm(ip.pf), norm(api.toPF(NYX, s.r, api.t)))))) * NYX.R;
  check('Nyx: an unpowered fall is predicted to within 200 m (perturbed: same stepper as rails)', ip && ip.b === NYX && gcd < 200, ip ? `${gcd.toFixed(0)} m off, ${s.landed ? 'landed' : 'crashed'} at ${(s.crashSpeed || s.touchV || 0).toFixed(0)} m/s` : 'no prediction');
}

// 21. Third-body perturbations near Nyx (6b): rails, the predictor and an independent n-body integration agree.
{
  const { NYX, bodyRel, soiAt } = api, P = 2 * Math.PI / NYX.n, muT = TELLUS.mu, muN = NYX.mu;
  // truth: RK4 in Tellus's frame with Tellus's reflex toward each moon (the model the moons' motion is consistent with), tight steps
  // Each moon is checked against its own consistent three-body problem: the moons ride fixed paths, so with both on, n-body
  // would have Selene pull a craft orbiting Nyx but not Nyx itself. The game keeps only Tellus's tide inside Nyx's SOI.
  SELENE.pert = false; let MOONS = [NYX];
  const acc = (r, t) => { let a = mul(r, -muT / len(r) ** 3);   // Tellus, then each moon's pull and Tellus's reflex toward it
    for (const m of MOONS) { const R = bodyRel(m, t)[0], d = sub(r, R); a = add(a, add(mul(d, -m.mu / len(d) ** 3), mul(R, -m.mu / len(R) ** 3))); } return a; };
  const nbody = (r, v, t, t1, stop) => { while (t < t1) { const h = Math.min(0.005 * Math.min(...MOONS.map(m => len(sub(r, bodyRel(m, t)[0])) ** 1.5 / Math.sqrt(m.mu)), len(r) ** 1.5 / Math.sqrt(muT)), 60, t1 - t);
      const k1v = acc(r, t), k1r = v, k2v = acc(add(r, mul(k1r, h / 2)), t + h / 2), k2r = add(v, mul(k1v, h / 2)), k3v = acc(add(r, mul(k2r, h / 2)), t + h / 2), k3r = add(v, mul(k2v, h / 2)), k4v = acc(add(r, mul(k3r, h)), t + h), k4r = add(v, mul(k3v, h));
      r = add(r, mul(add(add(k1r, mul(k2r, 2)), add(mul(k3r, 2), k4r)), h / 6)); v = add(v, mul(add(add(k1v, mul(k2v, 2)), add(mul(k3v, 2), k4v)), h / 6)); t += h; if (stop && stop(r, t)) break; } return [r, v, t]; };
  const ship = (r, v, b, t) => { api.t = t; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.landed = false; s.body = b; s.r = r; s.v = v; s.throttle = 0; return s; };
  const tAp = (Math.PI - NYX.orb.M0) / NYX.n, [mA, vA] = bodyRel(NYX, tAp), hn = norm(cross(mA, vA)), ux = norm(mA), uy = cross(hn, ux);
  const circ = (alt, dir) => [mul(ux, NYX.R + alt), mul(uy, dir * Math.sqrt(muN / (NYX.R + alt)))];
  const fate = (alt, dir, chunk) => { const [r, v] = circ(alt, dir), s = ship(r, v, NYX, tAp), p = api.predict(s);
    while (api.t < tAp + 2 * P && s.alive && s.body === NYX && !(len(s.r) < NYX.R + 5000)) api.rails(s, chunk);
    return { s, p, t: api.t, how: !s.alive || len(s.r) < NYX.R + 5000 ? 'down' : s.body !== NYX ? 'out' : 'bound' }; };
  let tN = null; nbody(add(mA, circ(200e3, 1)[0]), add(vA, circ(200e3, 1)[1]), tAp, tAp + 2 * P, (r, t) => { if (len(sub(r, bodyRel(NYX, t)[0])) < NYX.R + 5000) { tN = t; return true; } });
  const pro = fate(200e3, 1, 600), retro = fate(200e3, -1, 600), pk = pro.p[0];
  check('6b: a 200 km prograde orbit about Nyx is wrecked at its periapsis pass, as in n-body; the map predicts it', pro.how === 'down' && tN && Math.abs(pro.t - tN) < 600 && pk.endKind === 'impact' && Math.abs(pk.endT - tN) < 900,
    `n-body: down at ${tN ? ((tN - tAp) / P).toFixed(3) : '—'} P · rails: ${pro.how} at ${((pro.t - tAp) / P).toFixed(3)} P · predicted ${pk.endKind} at ${pk.endT ? ((pk.endT - tAp) / P).toFixed(3) : '—'} P`);
  check('6b: the retrograde twin survives two Nyx orbits, and is predicted to', retro.how === 'bound' && !retro.p[0].endKind,
    `${retro.how} after ${((retro.t - tAp) / P).toFixed(2)} P; predicted ${retro.p.length} leg(s), radius ${(retro.p[0].minR / 1e3).toFixed(0)}–${(retro.p[0].maxR / 1e3).toFixed(0)} km`);
  // the same orbit flown in 60 s chunks and in one-hour chunks (warp) ends in the same place
  const fly = (chunk) => { const [r, v] = circ(300e3, -1), s = ship(r, v, NYX, tAp); while (api.t < tAp + P - 1e-6) api.rails(s, Math.min(chunk, tAp + P - api.t)); return s; };
  const a = fly(60), b = fly(3600), [rN] = nbody(add(mA, circ(300e3, -1)[0]), add(vA, circ(300e3, -1)[1]), tAp, tAp + P);
  const errN = a.body === NYX ? len(sub(add(a.r, bodyRel(NYX, tAp + P)[0]), rN)) : NaN;
  check('6b: rails chunk size doesn\'t matter (60 s vs 1 h), and one Nyx orbit matches n-body', a.body === NYX && b.body === NYX && len(sub(a.r, b.r)) < 1000 && errN < 2000,
    `60 s vs 1 h chunks: ${len(sub(a.r, b.r)).toFixed(1)} m apart after one Nyx orbit; vs n-body ${(errN / 1e3).toFixed(2)} km`);
  // a slow flyby at Nyx's periapsis: n-body vs rails one day after closest approach (patched conics alone were off by ~10,000 km)
  const tc = -NYX.orb.M0 / NYX.n + P, [rm, vm] = bodyRel(NYX, tc), hx = norm(cross(rm, vm)), x = norm(rm), y = cross(hx, x), rp = 375e3, vp = Math.sqrt(300 ** 2 + 2 * muN / rp);
  // start: n-body backwards from closest approach (time-reversed RK4 = integrate with -v and flip back)
  let [r0, v0] = nbody(add(mul(x, rp), rm), mul(add(mul(y, vp), vm), -1), 0, 0.6 * 86400); v0 = mul(v0, -1);
  // that ran time forward from 0 with reversed velocity; the moon must run backwards too, so instead integrate in reverse properly:
  { let r = add(mul(x, rp), rm), v = add(mul(y, vp), vm), t = tc; const t1 = tc - 0.6 * 86400;
    while (t > t1) { const h = -Math.min(0.005 * Math.min(len(sub(r, bodyRel(NYX, t)[0])) ** 1.5 / Math.sqrt(muN), len(r) ** 1.5 / Math.sqrt(muT)), 60, t - t1);
      const k1v = acc(r, t), k1r = v, k2v = acc(add(r, mul(k1r, h / 2)), t + h / 2), k2r = add(v, mul(k1v, h / 2)), k3v = acc(add(r, mul(k2r, h / 2)), t + h / 2), k3r = add(v, mul(k2v, h / 2)), k4v = acc(add(r, mul(k3r, h)), t + h), k4r = add(v, mul(k3v, h));
      r = add(r, mul(add(add(k1r, mul(k2r, 2)), add(mul(k3r, 2), k4r)), h / 6)); v = add(v, mul(add(add(k1v, mul(k2v, 2)), add(mul(k3v, 2), k4v)), h / 6)); t += h; }
    r0 = r; v0 = v; }
  const [rT] = nbody(r0, v0, tc - 0.6 * 86400, tc + 86400), sf = ship(r0, v0, TELLUS, tc - 0.6 * 86400);
  while (api.t < tc + 86400 - 1e-6) api.rails(sf, Math.min(600, tc + 86400 - api.t));
  const rF = sf.body === NYX ? add(sf.r, bodyRel(NYX, api.t)[0]) : sf.r;
  check('6b: a slow flyby at Nyx\'s periapsis lands within 2 km of n-body a day later', sf.body === TELLUS && len(sub(rF, rT)) < 2000, `${(len(sub(rF, rT)) / 1e3).toFixed(2)} km off; through Nyx's SOI and out`);
  // cost at full warp in a low Nyx orbit
  const [rc, vc] = circ(60e3, -1), sc = ship(rc, vc, NYX, tAp); const t0 = performance.now(); let fr = 0; while (api.t < tAp + P) { api.rails(sc, 100000 / 60); fr++; }
  const us = (performance.now() - t0) * 1000 / fr;
  check('6b: a perturbed orbit at 100,000× warp stays cheap', us < 2000, `${us.toFixed(0)} µs per warp frame (60 km orbit about Nyx), ${fr} frames`);
  // a maneuver node 4 h ahead on a perturbed orbit sits where rails actually take the craft (Kepler alone would miss it)
  { const [r, v] = circ(250e3, -1), s = ship(r, v, NYX, tAp); s.node = { t: tAp + 4 * 3600, dv: [10, 0, 0] };
    const I = api.nodeInfo(s), kep = api.kepler(r, v, 4 * 3600, muN)[0], I2 = api.nodeInfo(s);
    while (api.t < tAp + 4 * 3600 - 1e-6) api.rails(s, Math.min(600, tAp + 4 * 3600 - api.t));
    check('6b: a node on a perturbed orbit is placed where the craft will be (integrated, then cached)', len(sub(I.rN, s.r)) < 200 && I2.rN === I.rN,
      `node state vs rails at the node: ${len(sub(I.rN, s.r)).toFixed(0)} m; Kepler alone: ${(len(sub(kep, s.r)) / 1e3).toFixed(1)} km`); }
  // 22. Selene perturbs too (the same machinery, kap > 1): checked against Tellus + Selene n-body, with Nyx's perturbation off.
  SELENE.pert = true; NYX.pert = false; MOONS = [SELENE];
  const PS = 2 * Math.PI / SELENE.n;
  // a 100 km circular lunar orbit, one day: Tellus's tide inside Selene's SOI
  { const [sp, sv] = bodyRel(SELENE, 0), u = norm(sp), w = norm(cross(cross(sp, sv), u)), rr = SELENE.R + 100e3, vc = Math.sqrt(SELENE.mu / rr);
    const s = ship(mul(u, rr), mul(w, vc), SELENE, 0); while (api.t < 86400 - 1) api.rails(s, 600);
    const [rT] = nbody(add(sp, mul(u, rr)), add(sv, mul(w, vc)), 0, api.t), e = s.body === SELENE ? len(sub(add(s.r, bodyRel(SELENE, api.t)[0]), rT)) : NaN;
    check('6b: Selene: a 100 km lunar orbit flown a day on rails matches Tellus+Selene n-body', e < 2000, `${(e / 1e3).toFixed(2)} km off after a day (period ${(2 * Math.PI * Math.sqrt(rr ** 3 / SELENE.mu) / 60).toFixed(0)} min)`); }
  // a translunar coast through Selene's SOI and out again, two days
  { const r0 = TELLUS.R + 110e3, at = (r0 + SELENE.a) / 2, tof = Math.PI * Math.sqrt(at ** 3 / muT), f0 = SELENE.n * tof + SELENE.orb.M0, ph = Math.atan2(Math.sin(f0), Math.cos(f0)) + Math.PI - 0.06;
    const vp = Math.sqrt(muT * (2 / r0 - 2 / (r0 + SELENE.a)));
    let R0, V0, s, p;   // search the departure angle for a pass 200–3,000 km above Selene (predicted with perturbations)
    for (let k = 0; k < 40; k++) { const q = ph - 0.01 * k; R0 = [r0 * Math.cos(q), 0, -r0 * Math.sin(q)]; V0 = [-vp * Math.sin(q), 30, -vp * Math.cos(q)];
      s = ship(R0, V0, TELLUS, 0); p = api.predict(s); const L = p.find(x => x.b === SELENE); if (L && L.minR > SELENE.R + 2e5 && L.minR < SELENE.R + 3e6) break; } let inS = false; while (api.t < 2 * 86400 - 1) { api.rails(s, 600); if (s.body === SELENE) inS = true; }
    const [rT] = nbody(R0, V0, 0, api.t), rG = s.body === SELENE ? add(s.r, bodyRel(SELENE, api.t)[0]) : s.r;
    check('6b: Selene: a translunar coast through its SOI matches n-body after two days; the predictor follows it', inS && len(sub(rG, rT)) < 10000 && p.some(x => x.path),
      `${(len(sub(rG, rT)) / 1e3).toFixed(2)} km off (Selene pass ${((p.find(x => x.b === SELENE) || {}).minR / 1e3 - SELENE.R / 1e3).toFixed(0)} km up); legs ${p.map(x => x.b.name + (x.path ? '~' : '') + (x.endKind ? '→' + x.endKind : '')).join(' ')}`); }
  NYX.pert = true;
}

// 23. "Out there" missions (bodies session): the Selene ladder and Nyx, each flown through the real flight code.
{
  const P = api.PROG, { NYX, bodyRel, SUN_DIR } = api, saved = JSON.stringify({ done: P.done, log: P.log, funds: P.funds, active: P.active });
  const news = []; api.HOOK.news = m => news.push(m); api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  const reset = done => { P.done = Object.fromEntries(done.map(k => [k, { flight: 0, day: 0 }])); P.log = {}; P.active = []; P.funds = 1000; };
  const craft = (stack, b, r, v, t) => { api.t = t; const s = api.newShip(stack); api.S = s; s.landed = false; s.body = b; s.r = r; s.v = v; s.throttle = 0; s.rec.launched = true; s.rec.dv = 5000; return s; };
  const upright = (s) => { const up = norm(s.r), X = norm(cross(up, [0.3, 0.9, 0.1])); s.q = api.qFromBasis(X, up, cross(X, up)); s.w = [0, 0, 0]; };
  const toT = t => norm(mul(bodyRel(SELENE, t)[0], -1));
  // the far side: find a time when Selene's far side is sunlit (Selene between Tellus and the sun), orbit past it at 1.5 R
  let tF = 0; while (dot(toT(tF), SUN_DIR) > -0.6) tF += 3600;
  const uF = norm(add(mul(toT(tF), -1), SUN_DIR)), wF = norm(cross(uF, [0, 1, 0])), rF = 1.5 * SELENE.R;
  reset(['beeper']); let s = craft(['ant', 'cam', 't2', 'petrel'], SELENE, mul(uF, rF), mul(wF, Math.sqrt(SELENE.mu / rF)), tF);
  let photoT = null; while (api.t < tF + 6 * 3600 && !P.done.farside) { api.advRails(s, 60, 100); if (s.rec.farPhoto && photoT === null) photoT = api.t; }
  check('out there: the far side is photographed behind Selene and comes home once Tellus is in sight', !!P.done.farside && photoT !== null && P.done.farside && news.some(m => /far side reach home/.test(m)),
    `photo at +${photoT !== null ? ((photoT - tF) / 60).toFixed(0) : '—'} min, downlink by +${((api.t - tF) / 60).toFixed(0)} min (orbit ${(2 * Math.PI * Math.sqrt(rF ** 3 / SELENE.mu) / 60).toFixed(0)} min)`);
  // the impactor: heard on the near side, not on the far side
  const drop = (side) => { reset(['beeper', 'farside']); const u = side > 0 ? toT(0) : mul(toT(0), -1), r = mul(u, SELENE.R + 20e3); const c = craft(['ant', 'sci', 't2', 'petrel'], SELENE, r, mul(u, -300), 0);
    let n = 0; while (c.alive && n++ < 20000) { if (api.railsOK(c)) api.advRails(c, 1, 1); else api.advPhys(c); } return !!P.done.selimp; };
  const nearHit = drop(1), farHit = drop(-1);
  check('out there: an impactor on the near side completes the mission; on the far side nobody hears it', nearHit && !farHit && news.some(m => /nobody heard/.test(m)), `near ${nearHit}, far ${farHit}`);
  // a soft landing near side (instruments + antenna), and the sample counts toward a return
  // land from rest with the craft's base h metres above the ground
  const land = (b, u, stack, done, h) => { reset(done); const c = craft(stack, b, [0, 0, 0], [0, 0, 0], 0); c.r = mul(u, b.R - c.yBot + h); upright(c); let n = 0; while (!c.landed && c.alive && n++ < 5000) api.advPhys(c); for (let k = 0; k < 5; k++) api.advPhys(c); return c; };
  const hard = land(SELENE, toT(0), ['ant', 'sci', 't2', 'petrel'], ['beeper', 'farside', 'selimp'], 10), hardV = hard.touchV, hardOK = !!P.done.selland;
  s = land(SELENE, toT(0), ['ant', 'sci', 't2', 'petrel'], ['beeper', 'farside', 'selimp'], 3);
  const sampleOK = api.MISSIONS.find(m => m.id === 'selsample').ok({ ...s.rec, landed: true, recSci: true });
  check('out there: a soft landing on Selene\'s near side phones home (a 10 m drop is too hard); a recovered sample would complete a return', !!P.done.selland && s.rec.selSampled && sampleOK && hard.landed && !hardOK,
    `from 3 m: ${(s.touchV || 0).toFixed(1)} m/s, done; from 10 m: ${(hardV || 0).toFixed(1)} m/s, ${hardOK ? 'done (wrong)' : 'not counted'}`);
  // Nyx: weighed by tracking a craft where its pull matters (high orbit around Nyx's periapsis time)
  const P_N = 2 * Math.PI / NYX.n, tPe = (2 * Math.PI - NYX.orb.M0) / NYX.n + P_N, r30 = 3.0e7;
  reset(['beeper', 'farside']); s = craft(['ant', 'sci', 't2', 'petrel'], TELLUS, [r30, 0, 0], [0, 0, -Math.sqrt(TELLUS.mu / r30)], tPe - 6 * 3600);
  while (api.t < tPe + 10 * 3600 && !P.done.nyxfind) api.advRails(s, 600, 1000);
  check('out there: Nyx is weighed from tracking residuals (12 h where its pull is ≥ 1e-3 of Tellus\'s) and enters the logbook', !!P.done.nyxfind && !!P.log.nyx,
    `found after ${((s.rec.nyxTrack || 0) / 3600).toFixed(1)} h of tracking; logbook: ${P.log.nyx ? 'm/M ' + P.log.nyx.v.m.toExponential(2) : '—'}`);
  // an orbit that lasts: retrograde survives two Nyx orbits, prograde is wrecked
  const tAp = (Math.PI - NYX.orb.M0) / NYX.n, [mA, vA] = bodyRel(NYX, tAp), hn = norm(cross(mA, vA)), ux = norm(mA), uy = cross(hn, ux), rr = NYX.R + 200e3;
  const orbitNyx = dir => { reset(['beeper', 'farside', 'nyxfind', 'nyxfly']); P.log.nyx = { v: { m: 1, pe: 1, ap: 1 } }; const c = craft(['sci', 't2', 'petrel'], NYX, mul(ux, rr), mul(uy, dir * Math.sqrt(NYX.mu / rr)), tAp);
    while (api.t < tAp + 2.05 * P_N && c.alive && !P.done.nyxorb) { if (api.railsOK(c)) api.advRails(c, 600, 1000); else api.advPhys(c); } return { ok: !!P.done.nyxorb, alive: c.alive, h: (c.rec.nyxOrbT || 0) / 3600 }; };
  const ret = orbitNyx(-1), pro = orbitNyx(1);
  check('out there: "an orbit that lasts" around Nyx: retrograde does it, prograde is wrecked first', ret.ok && !pro.ok, `retrograde ${ret.h.toFixed(0)} h (done ${ret.ok}); prograde ${pro.h.toFixed(0)} h, ${pro.alive ? 'still up' : 'crashed'}`);
  // landing on Nyx
  s = land(NYX, norm([0.3, 0.9, 0.2]), ['sci', 't2', 'petrel'], ['beeper', 'farside', 'nyxfind', 'nyxfly'], 5);
  check('out there: landing on Nyx under 3 m/s', !!P.done.nyxland && !!P.log.nyxland, `touchdown ${(s.touchV || 0).toFixed(2)} m/s`);
  const S0 = JSON.parse(saved); Object.assign(P, S0); api.HOOK.news = () => {};
}

// 24. Epoch 3, satellites that work (bodies session): weather, TV for the capital, disaster watch, navigation.
{
  const P = api.PROG, saved = JSON.stringify({ done: P.done, log: P.log, funds: P.funds, active: P.active, sats: P.sats, satN: P.satN, day: P.day, offers: P.offers, stations: P.stations, disDone: P.disDone });
  const news = []; api.HOOK.news = m => news.push(m); api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  const reset = done => { P.done = Object.fromEntries(done.map(k => [k, { flight: 0, day: 0 }])); P.log = {}; P.active = []; P.offers = []; P.funds = 1000; P.sats = []; P.satN = 0; P.day = 10; P.disDone = []; };
  const craft = (stack, r, v) => { api.t = 0; const s = api.newShip(stack); api.S = s; s.landed = false; s.body = TELLUS; s.r = r; s.v = v; s.throttle = 0; s.rec.launched = true; s.rec.dv = 5000; s.rec.day0 = P.day; return s; };
  const rot = (v, inc) => [v[0], v[1] * Math.cos(inc) - v[2] * Math.sin(inc), v[1] * Math.sin(inc) + v[2] * Math.cos(inc)];   // tilt about +X
  const orbit = (alt, incDeg, ph = 0) => { const r = TELLUS.R + alt, v = Math.sqrt(TELLUS.mu / r), i = incDeg * Math.PI / 180;
    return [rot([r * Math.cos(ph), 0, -r * Math.sin(ph)], i), rot([-v * Math.sin(ph), 0, -v * Math.cos(ph)], i)]; };
  // weather: polar counts, equatorial doesn't
  reset(['beeper']); let [r, v] = orbit(300e3, 90); let s = craft(['ant', 'cam', 't2', 'petrel'], r, v); api.advRails(s, 60, 100); const polar = !!P.done.weather;
  reset(['beeper']); [r, v] = orbit(300e3, 0); s = craft(['ant', 'cam', 't2', 'petrel'], r, v); api.advRails(s, 60, 100); const eq = !!P.done.weather;
  check('epoch 3: a weather satellite needs a polar orbit (an equatorial one doesn\'t count)', polar && !eq, `polar ${polar}, equatorial ${eq}`);
  // TV: stationary, over the capital's longitude; it pays every day it stays there, and a sloppy one drifts away
  const cap = api.capital(), T0 = P.day * api.DAY_S, ua = api.rotY(norm([cap.u[0], 0, cap.u[2]]), api.absTh(T0));   // over the capital's longitude, now
  const stat = (k = 1) => { const R0 = api.STAT_R, vS = Math.sqrt(TELLUS.mu / R0) * k; return [mul(ua, R0), mul([ua[2], 0, -ua[0]], vS)]; };   // prograde about +Y
  reset(['beeper']); [r, v] = stat(); s = craft(['ant', 't2', 'petrel'], r, v); api.advRails(s, 60, 100); const tvOK = !!P.done.tv;
  api.satRegister(s, s.rec); const q = P.sats[0], f0 = P.funds; api.utilTick(10); const paid = P.funds - f0;
  reset(['beeper']); [r, v] = stat(1.002); s = craft(['ant', 't2', 'petrel'], r, v); api.advRails(s, 60, 100); const sloppy = !!P.done.tv; api.satRegister(s, s.rec);
  let lostDay = null; for (let d = 0; d < 200 && lostDay === null; d++) { P.day += 1; api.utilTick(1); if (news.some(m => /drifted out of the capital/.test(m))) lostDay = d; }
  check('epoch 3: TV for the capital from a stationary orbit pays daily; one 0.2 % too fast misses the mark and drifts out of the sky', tvOK && Math.abs(paid - 10 * 0.4) < 1e-9 && !sloppy && lostDay !== null,
    `capital ${cap.name} (${(Math.asin(cap.u[1]) * 57.3).toFixed(0)}°), ${(api.STAT_R / 1e3 - TELLUS.R / 1e3).toFixed(0)} km up: ${tvOK ? 'done' : 'not done'}, ${paid.toFixed(1)}M over 10 days; the sloppy one ${sloppy ? 'counted (wrong)' : 'not counted'}, out of sight after ${lostDay} days`);
  // disaster watch: a polar camera satellite with an antenna delivers pictures within 12 h of the call
  reset(['beeper', 'weather']); [r, v] = orbit(300e3, 90); s = craft(['ant', 'cam', 't2', 'petrel'], r, v); api.satRegister(s, s.rec);
  const ci = api.CITIES.map((c, i) => ({ i, d: Math.acos(Math.min(1, dot(c.u, [1, 0, 0]))) })).sort((a, b) => a.d - b.d)[0].i;   // a city near the pad (a station in reach)
  let got = null;
  for (let k = 0; k < 8 && !got; k++) { P.active = [{ id: 900 + k, type: 'image', src: 'gov', client: 0, p: { ci, res: 8, dis: 'Floods', pay: 30, dur: 5 }, posted: P.day, deadline: P.day + 5 }]; P.disDone = [];
    for (let h = 0; h < 4 && !P.done.diswatch; h++) api.advanceDays(0.125); if (P.done.diswatch) got = (P.disDone[0].t - P.disDone[0].posted * api.DAY_S) / 3600; else api.advanceDays(1); }
  check('epoch 3: disaster watch: pictures of a disaster delivered within 12 h of the call', got !== null && got <= 12, got !== null ? `delivered ${got.toFixed(1)} h after the call` : 'never within 12 h');
  // navigation: two satellites aren't enough; four in two polar planes, two per plane phased half an orbit apart, are
  const reg = (alt, node, ph) => { const R1 = TELLUS.R + alt, vv = Math.sqrt(TELLUS.mu / R1), ry = a => [a[0] * Math.cos(node) + a[2] * Math.sin(node), a[1], -a[0] * Math.sin(node) + a[2] * Math.cos(node)];
    const [rr, vr] = orbit(alt, 90, ph); P.satN++; P.sats.push({ id: P.satN, name: 'Nav ' + P.satN, ant: 1, cam: 0, sci: 0, ballast: 0, bio: 0, epoch: P.day * api.DAY_S, r: ry(rr), v: ry(vr), pending: [], imgs: 0 }); };
  reset(['beeper', 'tv']); reg(1000e3, 0, 0); reg(1000e3, Math.PI / 2, 0); api.utilTick(1); const two = P.navCov, twoOK = !!P.done.nav;
  reg(1000e3, 0, Math.PI); reg(1000e3, Math.PI / 2, Math.PI); api.utilTick(1); const four = P.navCov;
  check('epoch 3: navigation: 2 satellites leave gaps; 4 in two polar planes, phased in pairs, fix anyone within half an hour', !twoOK && !!P.done.nav && four >= 0.95,
    `2 satellites: ${(two * 100).toFixed(0)}% · 4: ${(four * 100).toFixed(1)}% of places and moments`);
  Object.assign(P, JSON.parse(saved)); api.HOOK.news = () => {};
}

// 25. Crew (bodies session, epoch 4): the escape tower, abort tests, then people. Flown through the real flight code.
{
  const P = api.PROG, saved = JSON.stringify({ done: P.done, log: P.log, funds: P.funds, active: P.active, sats: P.sats, day: P.day });
  const news = [], msgs = []; api.HOOK.news = m => news.push(m); api.HOOK.msg = m => msgs.push(m); api.HOOK.save = () => {};
  const reset = done => { P.done = Object.fromEntries(done.map(k => [k, { flight: 0, day: 0 }])); P.log = {}; P.active = []; P.funds = 1e4; news.length = 0; msgs.length = 0; };
  const flyOut = s => { let apex = 0, n = 0; while (s.alive && !(s.landed && s.rec.abort && api.t > s.rec.abort.t + 5) && n++ < 300000) {
      if (api.railsOK(s) && !s.landed) api.advRails(s, 1, 1); else api.advPhys(s); apex = Math.max(apex, len(s.r) - TELLUS.R); } return apex; };
  // pad abort: from a standing start, under 8 g, high enough for the chute
  reset(['orbiter']); api.t = 0; let s = api.newShip(['les', 'chute', 'crew', 't4', 'kestrel']); api.S = s; api.abort(s); let apex = flyOut(s);
  check('crew: a pad abort lifts the capsule clear under 8 g and it lands under its chute (dummies aboard)', !!P.done.padabort && s.landed && s.alive && !s.rec.crewed && s.rec.cgMax < 8 && apex > 500,
    `apex ${(apex / 1e3).toFixed(2)} km, peak ${s.rec.cgMax.toFixed(1)} g, touchdown ${(s.touchV || 0).toFixed(1)} m/s; tower jettisoned: ${!s.parts.some(p => p.on && p.d.kind === 'les')}`);
  // max-q abort: straight up at full throttle, abort at 18 kPa
  reset(['orbiter', 'padabort']); api.t = 0; s = api.newShip(['les', 'chute', 'crew', 'dec', 't8', 'kestrel']); api.S = s; s.throttle = 1; api.stage(s);
  let k = 0; while (s.alive && k++ < 20000) { api.advPhys(s); if ((s.qdyn || 0) >= 18000) { api.abort(s); break; } } apex = flyOut(s);
  check('crew: a max-q abort (18 kPa) brings the capsule home under 8 g and qualifies the tower', !!P.done.maxqabort && s.landed && s.rec.cgMax < 8,
    `abort at ${(s.rec.abort.q / 1e3).toFixed(1)} kPa, ${(s.rec.abort.alt / 1e3).toFixed(1)} km up; peak ${s.rec.cgMax.toFixed(1)} g; apex ${(apex / 1e3).toFixed(1)} km`);
  // no tower, no abort; and on a nominal flight the tower goes at the first staging above 30 km
  reset(['orbiter']); api.t = 0; s = api.newShip(['chute', 'crew', 't4', 'kestrel']); api.S = s; const noTower = api.abort(s);
  s = api.newShip(['les', 'chute', 'crew', 'dec', 't4', 'kestrel']); api.S = s; s.landed = false; s.rec.launched = true; s.r = mul(norm(s.r), TELLUS.R + 4e4); api.stage(s);
  check('crew: no abort without a tower; the tower is jettisoned at the first staging above 30 km', !noTower && !s.parts.some(p => p.on && p.d.kind === 'les') && msgs.some(m => /Escape tower jettisoned/.test(m)), `abort without a tower: ${noTower}`);
  // once qualified, capsules fly people: around Selene and home counts; a crashed capsule loses its crew
  const crewFlight = (done) => { reset(done); P.day = 50; api.t = 0; const c = api.newShip(['les', 'chute', 'crew', 't4', 'kestrel']); api.S = c; c.rec.launched = true; c.rec.day0 = P.day; c.rec.dv = 4000;
    const home = { r: c.r.slice(), pf: c.pf.slice(), q: c.q.slice(), qLocal: c.qLocal.slice() }; return { c, home }; };
  let { c, home } = crewFlight(['orbiter', 'padabort', 'maxqabort', 'farside']);
  c.landed = false; c.body = SELENE; c.r = [SELENE.R + 300e3, 0, 0]; c.v = [0, 0, -Math.sqrt(SELENE.mu / (SELENE.R + 300e3))]; api.advRails(c, 60, 10);
  const sawSel = c.rec.crewSel; c.body = TELLUS; c.landed = true; Object.assign(c, { pf: home.pf, qLocal: home.qLocal }); api.advRails(c, 1, 1);
  check('crew: after qualification the capsule carries people; around Selene and home safe completes "Crew around Selene"', c.rec.crewed && sawSel && c.rec.crewOK && !!P.done.crewaround, `crewed ${c.rec.crewed}, in Selene's SOI ${sawSel}, home ${c.rec.capHome}`);
  ({ c } = crewFlight(['orbiter', 'padabort', 'maxqabort']));
  c.landed = false; c.body = SELENE; c.r = [SELENE.R + 20e3, 0, 0]; c.v = [-300, 0, 0]; let n = 0; while (c.alive && n++ < 20000) { if (api.railsOK(c)) api.advRails(c, 1, 1); else api.advPhys(c); }
  check('crew: a crashed crewed capsule loses its crew (news, opinion)', !c.rec.crewOK && news.some(m => /The crew were lost/.test(m)), news.find(m => /crew/.test(m)) || 'no news');
  // the landing mission's condition reads the flight record
  const okLand = api.MISSIONS.find(m => m.id === 'crewland').ok;
  check('crew: "Crew on Selene" needs a crewed landing there and the crew home safe', okLand({ crewed: true, crewOK: true, crewSelLand: true, capHome: true }) && !okLand({ crewed: true, crewOK: false, crewSelLand: true, capHome: true }) && !okLand({ crewed: false, crewOK: true, crewSelLand: true, capHome: true }), '');
  Object.assign(P, JSON.parse(saved)); api.HOOK.news = () => {}; api.HOOK.msg = m => log.push(`[t=${api.t.toFixed(1)}] ${m}`);
}

// 26. The Crewed Lunar preset (bodies session): to orbit on a tuned turn, tower gone, enough left for Selene and home.
{
  const r = fly('Crewed Lunar', { turnStart: 200 * AS, turnEnd: 38000 * AS, verbose: false }), s = r.s, plan = api.dvPlan(s, 0).map(x => x.dv);
  const lander = plan[plan.length - 2] || 0, ret = plan[plan.length - 1] || 0, tower = s.parts.some(p => p.on && p.d.kind === 'les');
  check('Crewed Lunar reaches orbit, sheds its tower, and keeps ≥ 2,600 m/s in the lander and ≥ 1,250 to come home', r.phase === 'done' && s.alive && !tower && plan.length === 2 && lander >= 2600 && ret >= 1250,
    `orbit for ${r.dvUsed.toFixed(0)} m/s, max q ${(r.maxQ / 1e3).toFixed(1)} kPa, ${r.maxG.toFixed(1)} g; left: lander ${lander.toFixed(0)}, return ${ret.toFixed(0)} m/s (transfer 1,321 + landing ~1,250; return ~1,250)`);
  const c = api.newShip(api.PRESETS['Crewed Lunar']), pr = api.probe(c, { M: 0.6, aoa: 4, q: 5000, h: 3000 }), cal = (pr.ycm - pr.ycp) / (2 * c.radius);
  check('Crewed Lunar is stable (CoM ahead of CoP) and its root is the crew capsule', cal > 0.3 && c.root && c.root.d.key === 'crew', `margin ${cal.toFixed(2)} cal, ${(c.mass / 1000).toFixed(0)} t, root ${c.root && c.root.d.name}`);
}

// 27. A crewed Selene landing and return, flown end to end on Crewed Lunar (bodies session; the flight is fly_crewlunar.mjs).
{
  const P = api.PROG, saved = JSON.stringify({ done: P.done, log: P.log, funds: P.funds, active: P.active, day: P.day }), H = { ...api.HOOK };
  const R = crewLunar(api);
  check('Crewed Lunar flies a crew to Selene and home: a soft landing there, one clean entry here, crew fine, "Crew on Selene" done',
    R.done && R.home && R.crewed && R.crewOK && R.landing.landed && R.landing.v < 4 && R.landing.tilt < 10 && R.passes.length === 1 && R.g < 8 && R.days < 10,
    `orbit with ${R.orbit.left.map(x => x.toFixed(0)).join('/')} m/s left, cabin ${R.orbit.cabin.toFixed(0)} K · corrections ${R.mcc.toFixed(0)} + ${R.retCorr.toFixed(0)} m/s · landed at ${R.landing.v.toFixed(1)} m/s with ${R.landing.left.map(x => x.toFixed(0)).join('/')} left · ` +
    `back in Selene orbit with ${R.ascent.left.map(x => x.toFixed(0)).join('/')} · ${R.passes.length} entry pass · splashdown ${R.touch.toFixed(1)} m/s, peak ${R.g.toFixed(1)} g, cabin ${R.cabin.toFixed(0)} K, ${R.days.toFixed(1)} days`);
  Object.assign(P, JSON.parse(saved)); Object.assign(api.HOOK, H);
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

// 20. Satellites in 3D (sats session): registration keeps the vessel's shape and its attitude in the orbital frame.
{
  const P = api.PROG; api.HOOK.news = () => {}; api.HOOK.msg = () => {};
  Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: 500, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, day: 0, sats: [], satN: 0, wseed: 4242, rel: {}, op: {} });
  const qm = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const orb = (r, v) => { const pro = norm(v), nrm = norm(api.cross(r, v)); return api.qFromBasis(pro, nrm, api.cross(pro, nrm)); };
  api.t = 0; const s = api.newShip(['ant', 'cam', 'petrel']); api.S = s;
  s.landed = false; s.rec.launched = true; P.day = 3; s.rec.day0 = 3; s.rec.cost = 0; const r0 = TELLUS.R + 300e3; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(TELLUS.mu / r0)];
  const h = Math.SQRT1_2; s.q = [0, 0, h, h];   // nose (+y) turned to point down at the ground
  let lookOK = false; api.HOOK.satLook = (sh, ps) => { lookOK = sh.length === ps.length && sh.every((o, k) => o.k === ps[k].d.key && o.i === ps[k].i); };   // the renderer's marks hand-off
  api.t = 50; api.missionEnd(s); const q = JSON.parse(JSON.stringify(P.sats[0]));   // as it comes back from the save
  const look = T => { const [r, v] = api.satAt(q, T), Y = api.qrot(qm(orb(r, v), q.qo), [0, 1, 0]); return dot(Y, norm(r)); };
  const per = 2 * Math.PI * Math.sqrt(r0 ** 3 / TELLUS.mu), dn0 = dot(api.qrot(s.q, [0, 1, 0]), norm(s.r)), dn1 = look(q.epoch + per / 4), dn2 = look(q.epoch + 2.6 * per);
  check('a registered satellite keeps its shape and holds its attitude in the orbital frame (nose-down stays nose-down)',
    q.shape.length === s.parts.filter(p => p.on).length && q.shape.every(o => api.PARTS[o.k]) && P.sats[0].id === s.rec.satId && lookOK && Math.abs(dn0 + 1) < 1e-9 && Math.abs(dn1 + 1) < 1e-9 && Math.abs(dn2 + 1) < 1e-9,
    `${q.shape.length} parts kept; nose·up at registration ${dn0.toFixed(3)}, ¼ orbit later ${dn1.toFixed(3)}, 2.6 orbits ${dn2.toFixed(3)}`);
  Object.assign(P, { sats: [], satN: 0 }); delete api.HOOK.satLook;
}

// 21. Industrial independence (economy): who makes which parts, imports and the grey market, young-industry certification.
{
  const P = api.PROG; api.HOOK.news = () => {}; api.HOOK.msg = () => {};
  const fresh = arch => { api.resetHome(); Object.assign(P, { homeArch: arch, day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {} }); };
  const orbiter = () => api.vesselCost(api.newShip(api.PRESETS.Orbiter).parts).cost;
  fresh('openSuper'); const cSuper = orbiter(), allHome = ['t2', 'kestrel', 'condor', 'pod', 'sci'].every(k => api.sourceOf(k).how === 'home');
  fresh('resource'); for (const q of api.POWERS) if (q.i) P.rel[`0-${q.i}`] = 0.5;   // everyone willing to sell
  const cRes = orbiter(), srcK = api.sourceOf('kestrel'), srcT = api.sourceOf('t8');
  check('industry: a superpower makes everything; a resource state makes tanks but imports engines and avionics at ×1.5', allHome && srcT.how === 'home' && srcK.how === 'import' && api.sourceOf('pod').how === 'import' && cRes > 1.3 * cSuper,
    `Orbiter ${cSuper.toFixed(1)}M at home vs ${cRes.toFixed(1)}M for the resource state (Kestrel from ${api.POWERS[srcK.from].root})`);
  // sanctions reach hardware: lose the supplier, switch to the next; lose them all, the grey market at ×3
  fresh('resource'); for (const q of api.POWERS) if (q.i) P.rel[`0-${q.i}`] = 0.5;
  const first = api.sourceOf('kestrel').from; P.sanc[first] = 999; const second = api.sourceOf('kestrel');
  for (const p of api.POWERS) if (p.i !== api.home) P.sanc[p.i] = 999; const grey = api.sourceOf('kestrel');
  check('sanctions reach hardware: a sanctioning supplier is replaced by the next; with none left, parts come via intermediaries at ×3', second.how === 'import' && second.from !== first && grey.how === 'grey' && grey.k === api.GREY_K,
    `Kestrel from ${api.POWERS[first].root} → ${api.POWERS[second.from].root} → grey market`);
  // certification: a young industry's own parts start less proven; imports arrive certified
  fresh('frugal'); const tHome = api.certOf('t1'), eImp = api.certOf('kestrel');
  check('a young industry\'s own parts start less certified; imported parts arrive at the usual level', Math.abs(tHome - (api.CERT0 - 0.2 * 0.6)) < 1e-9 && eImp === api.CERT0,
    `frugal power: own tank ${(tHome * 100).toFixed(0)}%, imported Kestrel ${(eImp * 100).toFixed(0)}%`);
  // a rising power catches up: big engines become home-made after enough program time
  fresh('rising'); for (const q of api.POWERS) if (q.i) P.rel[`0-${q.i}`] = 0.5; const d0 = api.sourceOf('condor').how; P.day = 600; const d600 = api.sourceOf('condor').how;
  check('a rising power\'s industry grows: big engines imported at first, home-made later', d0 === 'import' && d600 === 'home' && api.indOf(api.home) > 0.8, `Condor: ${d0} on day 0, ${d600} on day 600 (self-sufficiency ${api.indOf(api.home).toFixed(2)})`);
  fresh(null);
}

// 21. Rendezvous (sats session): a registered satellite as the target; closest approach; target-relative SAS modes.
// Its own instance of the sim core, so this section never touches the shared api object above.
{
  const D = new Function(src + 'return {tgtOf,approach,sasTarget,newShip,satAt,kepler,PROG,TELLUS,DAY_S,get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, P = D.PROG; Object.assign(P, { day: 0, sats: [], satN: 0 });
  const circ = (alt, inc, ph) => { const r = T.R + alt, v = Math.sqrt(T.mu / r), c = Math.cos(ph), s = Math.sin(ph), ci = Math.cos(inc), si = Math.sin(inc);
    return { r: [r * c, 0, -r * s], v: [-v * s * ci, v * si, -v * c * ci] }; };
  const tg = circ(320e3, 2 * Math.PI / 180, 0.3); P.sats.push({ id: 7, name: 'Lookout 1', epoch: 0, ...tg, imgs: 0, pending: [] });
  const s = D.newShip(['ant', 'cam', 'petrel']); Object.assign(s, circ(300e3, 0, 0)); s.landed = false; s.rec.launched = true; s.rec.day0 = 0; D.t = 0;
  const none = D.tgtOf(s); s.target = 7; const X = D.tgtOf(s), r0 = Math.hypot(...s.r), per = 2 * Math.PI * Math.sqrt(r0 ** 3 / T.mu);
  // closest approach against a brute-force scan at 0.5 s
  const ca = D.approach(X.q, s.r, s.v, 0, 2 * per); let bf = Infinity, bt = 0;
  for (let t = 0; t <= 2 * per; t += 0.5) { const d = len(sub(D.kepler(s.r, s.v, t, T.mu)[0], D.satAt(X.q, t)[0])); if (d < bf) { bf = d; bt = t; } }
  check('rendezvous: closest approach to a target matches a brute-force scan', none === null && ca.d <= bf + 1 && Math.abs(ca.t - bt) < 30,
    `closest ${(ca.d / 1e3).toFixed(2)} km at T+${ca.t.toFixed(0)} s (scan: ${(bf / 1e3).toFixed(2)} km at ${bt.toFixed(0)} s), ${ca.vrel.toFixed(0)} m/s relative`);
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * 57.29578;
  s.hold = [0, 1, 0]; const m = k => { s.sasMode = k; return D.sasTarget(s); };
  const a1 = ang(m('tgt'), X.dr), a2 = ang(m('antitgt'), mul(X.dr, -1)), a3 = ang(m('rpro'), X.dv), a4 = ang(m('rretro'), mul(X.dv, -1));
  s.target = 99; const lost = m('tgt') === s.hold;
  check('rendezvous: Target / Anti-tgt / Rel pro / Rel retro point where they say; a vanished target falls back to the hold', Math.max(a1, a2, a3, a4) < 1e-6 && lost,
    `errors ${[a1, a2, a3, a4].map(x => x.toExponential(0)).join(' ')}°; unknown target → hold: ${lost}`);
}

// 19. More logbook facts: what a hop measures on the way up and back; Selene's orbit and gravity; satellite contact.
{
  const P = api.PROG; api.HOOK.news = () => {}; api.HOOK.msg = () => {}; api.HOOK.logged = () => {};
  const fresh = () => Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: 500, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, day: 0, sats: [], satN: 0, stations: [], log: {} });
  fresh(); api.t = 0; let s = api.newShip(api.PRESETS.Passenger); api.S = s; s.throttle = 1; api.stage(s); let stg = 0, arm = false, k = 0;
  while (s.alive && !(s.rec.launched && s.landed) && k++ < 600000) {
    if (stg === 0 && s.rec.launched && s.thrust === 0) { api.stage(s); stg = 1; }
    if (stg === 1 && !arm && dot(s.v, norm(s.r)) < 0) { api.stage(s); arm = true; } api.advPhys(s); }
  api.missionEnd(s); const L = P.log;
  const all = ['maxq', 'entry', 'heat', 'paxg', 'pad'].every(id => L[id]);
  check('a hop to space and back logs max-q, its re-entry speed, the hottest skin, the passenger\'s ride and how close to the pad it came down',
    all && L.maxq.v > 5e3 && L.entry.v > 500 && L.heat.v.T > 350 && typeof L.heat.v.part === 'string' && Math.abs(L.paxg.v - s.rec.gMax) < 1e-9 && Math.abs(L.pad.v - s.rec.landDist) < 1e-6,
    all ? `max-q ${(L.maxq.v / 1e3).toFixed(1)} kPa, entry ${L.entry.v.toFixed(0)} m/s, hottest ${L.heat.v.T.toFixed(0)} K (${L.heat.v.part}), ${L.paxg.v.toFixed(1)} g, landed ${(L.pad.v / 1e3).toFixed(1)} km from the pad` : Object.keys(L).join(','));
  // Selene: an orbit there sets its period; a lander sets the Δv to land and measures the surface gravity
  fresh(); api.t = 0; let x = api.newShip(['pod', 'petrel']); api.S = x; x.landed = false; x.rec.launched = true; x.rec.dv = 6000; x.body = SELENE;
  const rs = SELENE.R + 50e3; x.r = [rs, 0, 0]; x.v = [0, 0, -Math.sqrt(SELENE.mu / rs)]; api.advRails(x, 30, 1000);
  api.t = 0; const y = api.newShip(['pod', 'wren']); api.S = y; y.body = SELENE; y.landed = true; y.pf = [SELENE.R - y.yBot, 0, 0]; y.rec.launched = true; y.rec.dv = 7800; api.advRails(y, 1, 1);
  check('Selene: the first orbit there measures its period; the first lander logs its Δv and measures surface gravity (1.62 m/s²)',
    P.log.sorbit && Math.abs(P.log.sorbit.v.p - 2 * Math.PI * Math.sqrt(rs ** 3 / SELENE.mu)) < 1 && P.log.land && P.log.land.v === 7800 && P.log.sg && Math.abs(P.log.sg.v - 1.62) < 0.02,
    `period ${P.log.sorbit && (P.log.sorbit.v.p / 60).toFixed(1)} min at 50 km; g ${P.log.sg && P.log.sg.v.toFixed(3)} m/s²`);
  // contact: a camera satellite's share of time in view of a ground station, reported between flights
  fresh(); const r0 = TELLUS.R + 300e3, v0 = Math.sqrt(TELLUS.mu / r0);
  P.sats.push({ id: 1, name: 'Lookout 9', epoch: 0, r: [r0, 0, 0], v: [0, v0, 0], imgs: 0, pending: [], cam: 1, ant: 1, sci: 0, ballast: 0, bio: 0 }); api.advanceDays(3);
  check('a camera satellite reports its ground-station contact to the logbook, named after itself', P.log.contact && P.log.contact.by === 'Lookout 9' && Math.abs(P.log.contact.v - P.sats[0].contact * 100) < 1e-9 && !P.log.contact.stack,
    `${P.log.contact && P.log.contact.v.toFixed(0)}% by ${P.log.contact && P.log.contact.by}`);
  fresh();
}

// 21. Tools gated by knowledge: each unlocks with the logbook fact it depends on.
{
  const P = api.PROG, saved = P.log; P.log = {};
  const before = Object.keys(api.TOOLS).filter(k => api.toolOK(k)).length;
  P.log.apex = { v: 1 }; const a = api.toolOK('impact') && !api.toolOK('nodes'); P.log.orbit = { v: 1 }; const b = api.toolOK('nodes') && !api.toolOK('encounters'); P.log.selene = { v: 1 };
  check('tools unlock with knowledge: impact prediction with trajectory data from a flight, maneuver planning with a measured orbit, encounter forecasts with a visit',
    before === 0 && a && b && api.toolOK('encounters'), Object.entries(api.TOOLS).map(([k, T]) => `${T.name} ← ${T.fact}`).join(', '));
  P.log = saved;
}

// 22. Contact (sats session): the vessel against a registered satellite. Its own instance of the sim core.
{
  const D = new Function(src + 'return {newShip,satRegister,satAt,contactStep,physStep,hitNear,railsOK,PROG,TELLUS,DT,qrot,qmul,qaxis,get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, P = D.PROG;
  // a pod-tank-engine vessel in a 300 km orbit, nose out, and a camera satellite 1 m beyond its nose, antenna toward us
  const scene = (vClose) => {
    Object.assign(P, { day: 0, sats: [], satN: 0 }); D.t = 0;
    const s = D.newShip(['pod', 't1', 'kestrel']), r0 = T.R + 300e3; s.landed = false; s.rec.launched = true; s.rec.day0 = 0; s.sas = false; s.throttle = 0;
    s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(T.mu / r0)]; s.w = [0, 0, 0];
    const Y = D.qrot(s.q, [0, 1, 0]), k = D.newShip(['ant', 'cam', 'petrel']); k.landed = false; k.rec.launched = true; k.rec.day0 = 0;
    k.q = D.qmul(D.qaxis([0, 0, 1], Math.PI), s.q); k.r = add(s.r, mul(Y, s.yTop + 1 + k.yTop)); k.v = s.v.slice(); D.satRegister(k, { day0: 0 });
    s.v = add(s.v, mul(Y, vClose)); return { s, q: P.sats[0], Y, nParts: s.parts.filter(p => p.on).length };
  };
  // gentle: 0.5 m/s. Momentum is conserved through the contact step, they separate at about HIT_E of the closing speed, nothing breaks
  let { s, q, Y, nParts } = scene(0.5), mom = null, sep = null;
  for (let i = 0; i < 400 && !mom; i++) { D.physStep(s, D.DT); const T0 = D.t, [, vq] = D.satAt(q, T0), p0 = add(mul(s.v, s.mass), mul(vq, q.mass)), c0 = dot(sub(s.v, vq), Y), had = !!q.spin;
    D.contactStep(s, D.DT); if (q.spin && !had) { const p1 = add(mul(s.v, s.mass), mul(q.v, q.mass)); mom = len(sub(p1, p0)) / len(p0); sep = dot(sub(s.v, q.v), Y) / c0; } }
  check('contact: a 0.5 m/s bump conserves momentum, bounces them apart, breaks nothing', mom != null && mom < 1e-12 && sep < -0.05 && sep > -0.6 && s.alive && s.parts.filter(p => p.on).length === nParts && P.sats.length === 1 && q.shape.length === 3,
    `momentum error ${mom != null ? mom.toExponential(1) : '—'}; relative speed after/before ${sep != null ? sep.toFixed(2) : '—'}; satellite spinning at ${q.spin ? len(q.spin.w).toExponential(1) : '—'} rad/s`);
  // 5 m/s: the satellite's antenna (delicate, 3 m/s) breaks off, the satellite and our pod (8 m/s) survive
  ({ s, q } = scene(5)); for (let i = 0; i < 100 && !q.spin; i++) { D.physStep(s, D.DT); D.contactStep(s, D.DT); }
  check('contact: at 5 m/s the antenna it hits breaks off; the satellite and the vessel carry on', q.spin && P.sats.length === 1 && q.ant === 0 && q.cam === 1 && q.shape.length === 2 && s.alive,
    `satellite kit now: ${q.shape.map(o => o.k).join(', ')}; vessel ${s.alive ? 'intact' : 'lost'}`);
  // 2 km/s: 40 m per step, much more than either body. Still caught, and nothing survives
  ({ s, q } = scene(2000)); let hit = false; for (let i = 0; i < 5 && s.alive; i++) { D.physStep(s, D.DT); D.contactStep(s, D.DT); hit = !s.alive; }
  check('contact: a 2 km/s pass doesn\'t tunnel through (40 m a step); vessel and satellite are destroyed', hit && P.sats.length === 0, `vessel ${s.alive ? 'survived' : 'destroyed'}, ${P.sats.length} satellites left`);
  // physics, not rails, while a satellite is within 5 km
  ({ s } = scene(0)); const nearOn = D.hitNear(s) && !D.railsOK(s); s.r = add(s.r, mul(Y, -20e3)); const farOff = !D.hitNear(s);
  check('contact: within 5 km of a satellite the flight stays in physics steps', nearOn && farOff, `near: rails ${D.railsOK(s) ? 'on' : 'off'} at 20 km`);
}

// 23. Launch sites as data (terrain session, slice B): generated per power, a site per flight, latitude that matters.
{
  const P = api.PROG, SI = api.SITES, R = TELLUS.R, D = Math.PI / 180, keep = P.site;
  const fields = ['id', 'name', 'u', 'lat', 'h', 'power', 'coastal', 'maxDia', 'downrange', 'polar', 'kind', 'rot', 'minInc'];
  const per = api.POWERS.map(p => SI.filter(t => t.power === p.i).length);
  const gap = Math.min(...SI.flatMap((a, i) => SI.slice(i + 1).map(b => Math.acos(Math.min(1, dot(a.u, b.u))) * R)));
  const level = SI.every(t => { const f = api.siteFrame(t.u);
    return [0, 1, 2, 3].every(k => Math.abs(api.terrainH(norm(add(t.u, mul(k % 2 ? f.e : f.n, (k < 2 ? 1 : -1) * 1500 / R)))) - t.h) < 1e-9) && api.terrainSlope(TELLUS, t.u) < 0.01; });
  check('sites: generated per power with every field the economy needs; home site first, at +X; ≥ 250 km apart; pads levelled',
    SI.length >= 10 && SI.every(t => fields.every(k => k in t) && t.h > 0 && t.downrange && Array.isArray(t.downrange.over)) && per.every(n => n >= 1)
      && SI[0].u[0] === 1 && SI[0].power === api.HOME && gap >= api.SITE_GAP - 1 && level,
    `${SI.length} sites (${per.join('/')} per power), closest pair ${(gap / 1e3).toFixed(0)} km; home ${SI[0].name} at ${SI[0].lat.toFixed(1)}°, ${SI[0].h.toFixed(0)} m, downrange ${SI[0].downrange.az}° ${(SI[0].downrange.sea * 100).toFixed(0)}% water`);
  // a ship at a far site stands on its pad, nose up, with the site's free speed, in an orbit plane at its latitude
  const far = SI.reduce((a, b) => Math.abs(b.lat) > Math.abs(a.lat) ? b : a), x = api.newShip(api.PRESETS.Orbiter, far), up = norm(x.r);
  const hv = cross(x.r, x.v), inc = Math.acos(Math.abs(hv[1]) / len(hv)) / D, Y = api.qrot(x.q, [0, 1, 0]);
  check("a ship at a site: on its levelled pad, nose up, the site's free speed east, an orbit plane at its latitude",
    x.site === far && Math.abs(len(x.r) - (R + far.h - x.yBot)) < 1e-6 && dot(Y, up) > 0.999999 && Math.abs(len(x.v) - TELLUS.rot * len(x.r) * Math.cos(far.lat * D)) < 1e-4 && Math.abs(far.rot - TELLUS.rot * R * Math.cos(far.lat * D)) < 1e-9 && Math.abs(inc - Math.abs(far.lat)) < 1e-6,
    `${far.name} at ${far.lat.toFixed(1)}°: ${len(x.v).toFixed(1)} m/s free (equator ${SI[0].rot.toFixed(1)}), plane ${inc.toFixed(2)}°`);
  // the chosen site is the default for every flight, and tapes remember where they were recorded
  P.site = far.id; const y = api.newShip(api.PRESETS.Orbiter), tp = api.tapeNew(api.PRESETS.Orbiter, y.site); P.site = keep;
  check('the chosen site (PROG.site) is where flights start; a tape records its site',
    y.site === far && tp.site === far.id && api.curSite() === ((keep && api.siteById(keep)) || api.homeSite()));
  // until economy defines siteAccess: home sites only, free; a stage too wide for the rail gauge can't go inland
  const foreign = SI.find(t => t.power !== api.HOME), inland = SI.find(t => !t.coastal), coastal = SI.find(t => t.coastal), wide = [{ d: { r: 2.5 } }];
  const ah = api.siteAccessOf(SI[0]), af = api.siteAccessOf(foreign);
  check("site access: home sites only (until economy's siteAccess); inland sites take nothing wider than the rail gauge",
    ah.ok && !af.ok && af.why.length > 0 && !api.siteFits(inland, wide).ok && api.siteFits(coastal, wide).ok && api.siteFits(inland, [{ d: { r: 1.25 } }]).ok,
    `"${af.why}"; inland: "${api.siteFits(inland, wide).why}"`);
  // fly the Orbiter from a site away from the equator: the orbit's inclination is the site's latitude
  const off = SI.filter(t => Math.abs(t.lat) > 8 && Math.abs(t.lat) < 30).sort((a, b) => Math.abs(b.lat) - Math.abs(a.lat))[0];
  P.site = off.id; const r = fly('Orbiter', { verbose: false }); P.site = keep;
  const hh = cross(api.S.r, api.S.v), inc2 = Math.acos(Math.abs(hh[1]) / len(hh)) / D;
  check('a flight from a site at latitude φ reaches orbit inclined ≈ φ', r.el.pe - R > ATM && Math.abs(inc2 - Math.abs(off.lat)) < 1.0,
    `${off.name} ${off.lat.toFixed(1)}° → ${((r.el.ap - R) / 1e3).toFixed(0)}×${((r.el.pe - R) / 1e3).toFixed(0)} km at ${inc2.toFixed(2)}°`);
}

// 24. RCS (sats session): cold-gas quads, jet selection, pulses, attitude control. Its own instance of the sim core.
{
  const D = new Function(src + 'return {toV2,newShip,physStep,railsOK,rcsJets,rcsGas,INP,PROG,TELLUS,DT,G0,PARTS,qrot,qaxis,qmul,get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, I = D.INP, fnd = (n, k) => n.k === k ? n : (n.c || []).map(c => fnd(c, k)).find(Boolean);
  const design = (stack, host, ys) => { const d = D.toV2(JSON.parse(JSON.stringify(stack))), h = fnd(d.root, host);
    for (const y of ys) h.c.push({ k: 'rcs', at: { y, a: 0, n: 4, cy: 0.1 }, c: [] });
    h.c.push({ k: 'gas', at: { y: 0.5, a: Math.PI / 4, n: 2, cy: 0.3 }, c: [] }); return d; };
  const fly = (des, set) => { D.t = 0; const s = D.newShip(des), r0 = T.R + 300e3; Object.assign(s, { landed: false, sas: false, throttle: 0, r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)], w: [0, 0, 0] });
    s.rec.launched = true; s.rec.day0 = 0; set && set(s); return s; };
  const zero = () => Object.assign(I, { pitch: 0, yaw: 0, roll: 0, tx: 0, ty: 0, tz: 0 });
  const twin = (des, ax, sec) => { const a = fly(des, s => s.rcs = true), b = fly(des), g0 = D.rcsGas(a); zero(); I[ax] = 1;
    for (let i = 0; i < sec / D.DT; i++) { D.t = i * D.DT; D.physStep(a, D.DT); D.t = i * D.DT; D.physStep(b, D.DT); } zero();
    const dv = D.qrot([-a.q[0], -a.q[1], -a.q[2], a.q[3]], sub(a.v, b.v)); return { a, dv, w: len(a.w), gas: (g0 - D.rcsGas(a)) * 1000 }; };
  // a pod, a tank with two rings of four quads, two bottles: pure translation along the nose and sideways
  const des = design(['pod', 't1', 'kestrel'], 't1', [0.15, 0.95]), J = D.rcsJets(fly(des)), F = D.PARTS.rcs.rcsF * 1000;
  const up = twin(des, 'ty', 2), side = twin(des, 'tx', 2), m = up.a.mass, isp = D.PARTS.rcs.isp;
  check('RCS: forward translation is pure (8 nozzles at full duty), gas used matches Isp 70 s', Math.abs(up.dv[1] - 8 * F / m * 2) / (8 * F / m * 2) < 0.03 && Math.abs(up.dv[0]) + Math.abs(up.dv[2]) < 1e-3 && up.w < 1e-3 && Math.abs(up.gas - 8 * F * 2 / (isp * D.G0)) < 0.1,
    `${J.N.length} nozzles; Δv ${up.dv[1].toFixed(3)} m/s (expected ${(8 * F / m * 2).toFixed(3)}), cross ${(Math.abs(up.dv[0]) + Math.abs(up.dv[2])).toExponential(0)}, spin ${up.w.toExponential(0)} rad/s, gas ${up.gas.toFixed(2)} kg`);
  check('RCS: sideways translation is balanced across the two rings; on/off pulsing leaves only a few mrad/s of jitter', side.dv[0] > 0.1 && Math.abs(side.dv[1]) + Math.abs(side.dv[2]) < 0.02 * side.dv[0] && side.w < 5e-3,
    `Δv ${side.dv[0].toFixed(3)} m/s sideways, cross ${(Math.abs(side.dv[1]) + Math.abs(side.dv[2])).toExponential(0)}, spin ${side.w.toExponential(1)} rad/s`);
  // one ring only, 1.4 m above the centre of mass: the sideways nozzles alone would turn it, so jet selection fires the
  // up/down nozzles on either side to cancel that torque. Still pure, at a lower capacity than two rings
  const oneD = design(['pod', 't1', 'kestrel'], 'pod', [0.5]), one = twin(oneD, 'tx', 2), c1 = D.rcsJets(fly(oneD)).basis[0].cap, c2 = J.basis[0].cap;
  check('RCS: one ring off the centre of mass still translates sideways without turning; jet selection balances it, at a lower capacity', one.w < 2e-3 && Math.abs(one.dv[1]) + Math.abs(one.dv[2]) < 0.05 * one.dv[0] && c1 < c2,
    `spin ${one.w.toExponential(1)} rad/s; sideways capacity ${c1.toFixed(0)} N vs ${c2.toFixed(0)} N with two rings`);
  // attitude with no wheels: a camera-tank-engine stack, nose 0.5 rad off prograde, SAS on. RCS on: it turns, in whole pulses
  const probe = design(['cam', 't1', 'sparrow'], 't1', [0.15, 0.95]), turn = rcs => { const s = fly(probe, s => { s.sas = true; s.sasMode = 'pro'; s.rcs = rcs; s.q = D.qmul(D.qaxis([1, 0, 0], 0.5), D.qaxis([1, 0, 0], -Math.PI / 2)); }), g0 = D.rcsGas(s);
    zero(); for (let i = 0; i < 60 / D.DT; i++) { D.t = i * D.DT; D.physStep(s, D.DT); }
    const Y = D.qrot(s.q, [0, 1, 0]); return { err: Math.acos(Math.max(-1, Math.min(1, dot(Y, norm(s.v))))), pulses: (g0 - D.rcsGas(s)) / (F * D.DT / (isp * D.G0) / 1000), torque: s.torque }; };
  const on = turn(true), off = turn(false);
  check('RCS: a vessel with no reaction wheels holds prograde on RCS alone; gas goes in whole 20 ms pulses', on.torque === 0 && on.err < 0.03 && off.err > 0.3 && Math.abs(on.pulses - Math.round(on.pulses)) < 1e-6,
    `error after 60 s: ${on.err.toFixed(3)} rad with RCS, ${off.err.toFixed(2)} without; ${Math.round(on.pulses)} pulses of ${(F * D.DT).toFixed(0)} N·s`);
  const r = fly(des, s => { s.rcs = true; s.sas = true; });
  check('RCS: while it\'s on (SAS on), the flight stays in physics steps', !D.railsOK(r) && D.railsOK(fly(des)), `rails with RCS on: ${D.railsOK(r)}`);
  zero();
}

// 25. Docking (sats session): ports capture, the docked body rides as a passenger, the port carries its load, undocking
// hands it back. Its own instance of the sim core.
{
  const D = new Function(src + 'return {newShip,stage,physStep,contactStep,satRegister,dockEnd,satAt,satMP,satSpin,undock,PROG,TELLUS,DT,qrot,qmul,qaxis,qconj,get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, P = D.PROG;
  // a port-pod-tank-engine vessel nose out in a 300 km orbit; a camera satellite with a port, turned to face it, `gap` beyond
  const scene = ({ gap = 0.3, close = 0.2, lat = 0.04, tilt = 3 } = {}) => {
    Object.assign(P, { day: 0, sats: [], satN: 0 }); D.t = 0;
    const s = D.newShip(['port', 'pod', 't1', 'kestrel']), r0 = T.R + 300e3; Object.assign(s, { landed: false, sas: false, throttle: 0, w: [0, 0, 0] });
    s.rec.launched = true; s.rec.day0 = 0; s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(T.mu / r0)];
    const Y = D.qrot(s.q, [0, 1, 0]), k = D.newShip(['port', 'cam', 'petrel']); k.landed = false; k.rec.launched = true; k.rec.day0 = 0;
    k.q = D.qmul(D.qaxis([0, 0, 1], Math.PI + tilt * Math.PI / 180), s.q); k.r = add(add(s.r, mul(Y, s.yTop + gap + k.yTop)), [0, lat, 0]); k.v = s.v.slice(); D.satRegister(k, { day0: 0 });
    s.v = add(s.v, mul(Y, close)); return { s, q: P.sats[0], Y };
  };
  const fly = (s, n, stop) => { for (let i = 0; i < n && !(stop && stop()); i++) { D.physStep(s, D.DT); D.contactStep(s, D.DT); } };
  const portW = (s, a) => { const o = a ? a.e.shape.find(x => x.i === a.ppi) : s.parts.find(p => p.d.kind === 'port'), face = [o.pos[0], o.y0 + o.h, o.pos[2]];
    return add(s.r, D.qrot(s.q, sub(a ? add(a.p, D.qrot(a.q, sub(face, a.e.cm))) : face, s.cm))); };
  // capture at 0.2 m/s, 4 cm off and 3° off: latched, faces together, momentum kept, mass summed
  let { s, q, Y } = scene(), mom = null, m0 = s.mass, mq = q.mass;
  for (let i = 0; i < 300 && !s.att.length; i++) { D.physStep(s, D.DT); const [, vq] = D.satAt(q, D.t), p0 = add(mul(s.v, s.mass), mul(vq, q.mass)); D.contactStep(s, D.DT);
    if (s.att.length) mom = len(sub(mul(s.v, s.mass), p0)) / len(p0); }
  const a = s.att[0], gapEnd = a ? len(sub(portW(s, a), portW(s, null))) : NaN, axes = a ? dot(D.qrot(s.q, D.qrot(a.q, [0, 1, 0])), D.qrot(s.q, [0, 1, 0])) : NaN;
  check('docking: ports meeting at 0.2 m/s, 4 cm and 3° off, latch; faces together, momentum kept, masses summed', a && a.e === q && q.docked && mom < 1e-12 && gapEnd < 1e-9 && axes < -1 + 1e-9 && Math.abs(s.mass - m0 - mq) < 1e-6,
    `momentum error ${mom != null ? mom.toExponential(1) : '—'}; faces ${gapEnd.toExponential(1)} m apart, axes ${axes.toFixed(6)}; ${(s.mass / 1000).toFixed(3)} t = ${(m0 / 1000).toFixed(3)} + ${(mq / 1000).toFixed(3)}`);
  // the Docking autopilot mode turns the nose against the target port's axis (15° off to start, 30 s, 3 m apart)
  ({ s, q } = scene({ gap: 3, close: 0, tilt: 15 })); Object.assign(s, { sas: true, sasMode: 'dock', target: q.id }); fly(s, 30 / D.DT);
  const tq = D.satAt(q, D.t), Ab = D.qrot(D.satSpin(q, D.t, tq[0], tq[1]).q, [0, 1, 0]), off = Math.acos(Math.min(1, -dot(D.qrot(s.q, [0, 1, 0]), Ab))) * 57.29578;
  check('docking: the Docking autopilot mode lines the nose up against the target port', off < 0.5, `${off.toFixed(2)}° off after 30 s (15° at the start)`);
  // too fast, or too far off the axis: no latch (a bump instead)
  ({ s, q } = scene({ close: 1 })); fly(s, 200, () => q.spin); const fast = !s.att.length && !!q.spin;
  ({ s, q } = scene({ tilt: 20 })); fly(s, 200, () => q.spin); const askew = !s.att.length && !!q.spin;
  check('docking: at 1 m/s, or 20° off, the ports bump instead of latching', fast && askew, `1 m/s: ${fast ? 'bumped' : 'latched'}; 20°: ${askew ? 'bumped' : 'latched'}`);
  // the port carries the load: a gentle burn keeps it, full throttle (≈5 g on the satellite) breaks it loose
  ({ s, q } = scene()); fly(s, 300, () => s.att.length); D.stage(s); s.throttle = 0.05; D.physStep(s, D.DT); D.contactStep(s, D.DT); fly(s, 50);
  const low = s.att.length === 1 ? s.att[0].load : NaN; s.throttle = 1; fly(s, 50); const broke = !s.att.length && !q.docked && P.sats.includes(q); s.throttle = 0;
  check('docking: the port carries the satellite through a 5 % burn and lets go at full throttle', low < 1 && broke, `load at 5 %: ${(low * 100).toFixed(0)} % of the rating; full throttle: ${broke ? 'broke loose' : 'held'}`);
  // undock: pushed apart at 0.3 m/s along the port axis, momentum kept; back in the registry as itself, at the right place
  ({ s, q, Y } = scene()); fly(s, 300, () => s.att.length); const pBefore = mul(s.v, s.mass), cmQ = add(s.r, D.qrot(s.q, sub(s.att[0].p, s.cm)));
  D.undock(s, q.id); const [rq, vq] = D.satAt(q, D.t), sep = dot(sub(vq, s.v), D.qrot(s.q, [0, 1, 0])), pAfter = add(mul(s.v, s.mass), mul(vq, q.mass));
  fly(s, 100); const again = s.att.length;
  check('undocking: 0.3 m/s apart along the port axis, momentum kept, the satellite back in the registry where it was', !q.docked && P.sats.includes(q) && Math.abs(sep - 0.3) < 1e-6 && len(sub(pAfter, pBefore)) / len(pBefore) < 1e-12 && len(sub(rq, cmQ)) < 1e-6 && !again,
    `separation ${sep.toFixed(4)} m/s; momentum error ${(len(sub(pAfter, pBefore)) / len(pBefore)).toExponential(1)}; position ${len(sub(rq, cmQ)).toExponential(1)} m; recaptured: ${!!again}`);
  // a flight that ends docked registers one stack: the satellite rides inside the new entry, which weighs what the vessel did
  ({ s, q } = scene()); fly(s, 300, () => s.att.length); const mS = s.mass, rS = s.r.slice(); D.satRegister(s, { day0: 0 }); D.dockEnd(s);
  const st = P.sats.find(x => x !== q), M = st && D.satMP(st);
  check('docking: a flight ending docked registers one stack, the satellite inside it as itself', P.sats.length === 1 && st && st.attached.length === 1 && st.attached[0].e === q && !q.docked && Math.abs(M.m - mS) < 1e-6 && len(sub(st.r, rS)) < 1e-9,
    `${P.sats.map(x => x.name).join(', ')} carrying ${st ? st.attached.map(x => x.e.name).join(', ') : '—'}; ${(M ? M.m / 1000 : NaN).toFixed(3)} t`);
  Object.assign(P, { sats: [], satN: 0 });
}

// 26. The claw (sats session): grabs a satellite with no port, wherever it touches, at its attitude. Own sim instance.
{
  const D = new Function(src + 'return {newShip,stage,physStep,contactStep,satRegister,satAt,satBody,satMP,bodyDist,undock,PROG,TELLUS,DT,qrot,qmul,qaxis,get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, P = D.PROG;
  // a claw-pod-tank-engine vessel nose out at 300 km; a camera satellite (no port) lying across its path, `gap` beyond the jaws
  const scene = ({ nose = 'claw', gap = 0.3, close = 0.4 } = {}) => {
    Object.assign(P, { day: 0, sats: [], satN: 0 }); D.t = 0;
    const s = D.newShip([nose, 'pod', 't1', 'kestrel']), r0 = T.R + 300e3; Object.assign(s, { landed: false, sas: false, throttle: 0, w: [0, 0, 0] });
    s.rec.launched = true; s.rec.day0 = 0; s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(T.mu / r0)];
    const Y = D.qrot(s.q, [0, 1, 0]), k = D.newShip(['ant', 'cam', 'petrel']); k.landed = false; k.rec.launched = true; k.rec.day0 = 0;
    k.q = D.qmul(D.qaxis([0, 0, 1], Math.PI / 2), s.q); k.r = add(s.r, mul(Y, s.yTop + gap + 0.625)); k.v = s.v.slice(); D.satRegister(k, { day0: 0 });
    s.v = add(s.v, mul(Y, close)); return { s, q: P.sats[0], Y };
  };
  const fly = (s, n, stop) => { for (let i = 0; i < n && !(stop && stop()); i++) { D.physStep(s, D.DT); D.contactStep(s, D.DT); } };
  const axisAngle = (s, a) => Math.acos(Math.max(-1, Math.min(1, dot(D.qrot(s.q, D.qrot(a.q, [0, 1, 0])), D.qrot(s.q, [0, 1, 0]))))) * 57.29578;
  // grab at 0.4 m/s: held where it touched, at the attitude it had (90° across), momentum kept
  let { s, q } = scene(), mom = null;
  for (let i = 0; i < 300 && !s.att.length; i++) { D.physStep(s, D.DT); const [, vq] = D.satAt(q, D.t), p0 = add(mul(s.v, s.mass), mul(vq, q.mass)); D.contactStep(s, D.DT);
    if (s.att.length) mom = len(sub(mul(s.v, s.mass), p0)) / len(p0); }
  const a = s.att[0], ang = a ? axisAngle(s, a) : NaN, cw = s.parts.find(p => p.d.kind === 'claw'),   // the held body where it's held: its pose from the vessel
    held = a && { r: add(s.r, D.qrot(s.q, sub(a.p, s.cm))), q: D.qmul(s.q, a.q), cm: q.cm, parts: D.satMP(q).parts },
    tip = a ? D.bodyDist(held, add(s.r, D.qrot(s.q, sub([cw.pos[0], cw.y0 + cw.h, cw.pos[2]], s.cm)))) : NaN;
  check('claw: a satellite with no port, touched at 0.4 m/s, is grabbed where it touched, at its attitude; momentum kept', a && a.kind === 'claw' && a.e === q && mom < 1e-12 && Math.abs(ang - 90) < 1e-6 && tip > -0.02 && tip < 0.35,   // the jaws close on whatever they reached (here across the waist between camera and engine)
    `held at ${ang.toFixed(4)}° to our axis; jaws' centre ${tip.toFixed(3)} m from its skin (reach 0.35 m); momentum error ${mom != null ? mom.toExponential(1) : '—'}`);
  // too fast for the jaws, or a part that isn't a claw: a bump, not a grab
  ({ s, q } = scene({ close: 2 })); fly(s, 200, () => q.spin); const fast = !s.att.length && !!q.spin;
  ({ s, q } = scene({ nose: 'port' })); fly(s, 200, () => q.spin); const port = !s.att.length && !!q.spin;
  check('claw: at 2 m/s, or touching with a docking port instead, nothing is grabbed (a bump)', fast && port, `2 m/s: ${fast ? 'bumped' : 'grabbed'}; port: ${port ? 'bumped' : 'grabbed'}`);
  // a weaker hold than a port: a 5 % burn holds, full throttle tears it loose
  ({ s, q } = scene()); fly(s, 300, () => s.att.length); D.stage(s); s.throttle = 0.05; fly(s, 50); const low = s.att.length ? s.att[0].load : NaN;
  s.throttle = 1; fly(s, 50, () => !s.att.length); const tore = !s.att.length && P.sats.includes(q) && !q.docked; s.throttle = 0;   // stop there: burning on rams it
  check('claw: the grip holds through a 5 % burn and tears loose at full throttle', low < 1 && tore, `grip load at 5 %: ${(low * 100).toFixed(0)} % of its rating; full throttle: ${tore ? 'tore loose' : 'held'}`);
  // release: 0.1 m/s apart along the claw's axis, momentum kept, back in the registry as itself
  ({ s, q } = scene()); fly(s, 300, () => s.att.length); const pB = mul(s.v, s.mass); D.undock(s, q.id); const [, vq] = D.satAt(q, D.t), sep = dot(sub(vq, s.v), D.qrot(s.q, [0, 1, 0]));
  const err = len(sub(add(mul(s.v, s.mass), mul(vq, q.mass)), pB)) / len(pB); fly(s, 100); const again = s.att.length;
  check('claw: release pushes off at 0.1 m/s along the claw, momentum kept, no regrab', Math.abs(sep - 0.1) < 1e-6 && err < 1e-12 && !q.docked && P.sats.includes(q) && !again,
    `separation ${sep.toFixed(4)} m/s; momentum error ${err.toExponential(1)}; regrabbed: ${!!again}`);
  Object.assign(P, { sats: [], satN: 0 });
  // the whole page, not just the sim core: a syntax error in render or UI code passes every check above (the claw's HUD row did once)
  let perr = null; for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) try { new Function(m[1]); } catch (e) { perr = e.message; }
  check('the whole page script parses (render and UI included)', !perr, perr || 'ok');
}

// 24. Ground awareness (terrain session): the main chute, the impact predictor and the warp's time-to-ground read the
// ground under the ship, not the sea. Before, the main opened on air denser than 0.7 (about 4.2 km above the SEA since
// the rescale), so over a high plateau a capsule came down under its drogue alone.
{
  const D = Math.PI / 180, R = TELLUS.R, U = (la, lo) => [Math.cos(la * D) * Math.cos(lo * D), Math.sin(la * D), Math.cos(la * D) * Math.sin(lo * D)];
  let spot = null;   // a high, gentle plateau: above 4.5 km, nothing steeper than ~11° within 800 m
  for (let la = -60; la <= 60 && !spot; la++) for (let lo = -180; lo < 180 && !spot; lo++) {
    const u = U(la, lo), h = api.terrainH(u); if (h < 4500 || h > 6500 || api.terrainSlope(TELLUS, u) > 0.15) continue;
    const f = api.siteFrame(u); let ok = true;
    for (let k = 0; k < 8 && ok; k++) { const q = norm(add(u, add(mul(f.e, Math.cos(k) * 800 / R), mul(f.n, Math.sin(k) * 800 / R)))); if (api.terrainSlope(TELLUS, q) > 0.2) ok = false; }
    if (ok) spot = { u, h }; }
  api.t = 0; const s = api.newShip(['chute', 'pod']); api.S = s; const msgs = []; api.HOOK.msg = m => msgs.push(m);
  s.landed = false; s.r = api.fromPF(TELLUS, mul(spot.u, R + spot.h + 25000), 0); const up = norm(s.r), e = norm(cross([0, 1, 0], up));
  s.v = add(api.surfVel(TELLUS, s.r), mul(up, -250)); s.q = api.qFromBasis(e, up, cross(e, up)); s.w = [0, 0, 0]; s.sas = true; s.sasMode = 'stab';
  api.stage(s); const pred = api.predictImpact(s); let mainA = 0;
  while (s.alive && !s.landed && api.t < 3000) { api.physStep(s, api.DT); mainA = Math.max(mainA, s.chuteA); }
  const off = pred ? Math.acos(Math.min(1, dot(norm(pred.pf), norm(api.toPF(TELLUS, s.r, api.t))))) * R : Infinity;
  check('over a 4.5–6.5 km plateau the main chute opens (3 km above the ground) and the capsule lands softly; the predictor agrees',
    s.alive && s.landed && s.touchV < 8 && mainA > 100 && api.density(TELLUS, spot.h) < 0.7 && pred && Math.abs(pred.v - s.touchV) < 2 && off < 2000,
    `ground at ${(spot.h / 1e3).toFixed(2)} km (air ${api.density(TELLUS, spot.h).toFixed(2)} kg/m³, under the old 0.7 rule): main ${mainA.toFixed(0)} m², touchdown ${s.touchV ? s.touchV.toFixed(1) : '—'} m/s; predicted ${pred ? pred.v.toFixed(1) : '—'} m/s, ${(off / 1e3).toFixed(2)} km off · ${msgs.slice(-1)[0]}`);
  // the warp's time-to-ground: 500 m over that plateau is 500 m (plus the ship's bottom offset), not 5+ km
  const x = api.newShip(['chute', 'pod']); x.landed = false; x.r = api.fromPF(TELLUS, mul(spot.u, R + spot.h + 500), 0); api.t = 0;
  const gap = api.groundGap(x), seaGap = len(x.r) - R + x.yBot;
  check("the warp's ground gap is measured from the ground under the ship", Math.abs(gap - (500 + x.yBot)) < 1e-6 && seaGap > 4500,
    `gap ${gap.toFixed(1)} m (from the sea it would be ${(seaGap / 1e3).toFixed(1)} km)`);
}

// 25. Know-how (economy): owning a part is not knowing how to use it.
{
  const P = api.PROG; api.HOOK.news = () => {}; api.HOOK.msg = () => {};
  const fresh = arch => { api.resetHome(); Object.assign(P, { homeArch: arch, day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, flights: 0, own: null, decisions: [], active: [], offers: [] }); api.chooseStart('agency'); };
  // starting points: structure is familiar, big engines aren't; building at home helps
  fresh('openSuper'); const homeKestrel = api.use0('kestrel'), homeTank = api.use0('t2');
  fresh('resource'); for (const q of api.POWERS) if (q.i) P.rel[`0-${q.i}`] = 0.5; const impKestrel = api.use0('kestrel'), impCondor = api.use0('condor'), resTank = api.use0('t2');
  check('know-how starts by tier and origin: tanks familiar, imported engines not; home-made parts start higher', homeKestrel > impKestrel + 0.25 && resTank > impKestrel && impCondor < impKestrel && homeTank >= resTank,
    `Kestrel: home-made ${(homeKestrel * 100).toFixed(0)}%, imported ${(impKestrel * 100).toFixed(0)}% · imported Condor ${(impCondor * 100).toFixed(0)}% · tank ${(resTank * 100).toFixed(0)}%`);
  // learning by novelty: the first flight through new regimes teaches a lot, the tenth identical one little
  fresh('resource'); for (const q of api.POWERS) if (q.i) P.rel[`0-${q.i}`] = 0.5; P.flights = 1;
  const seen = { kestrel: { fly: 1, maxq: 1, burn: 1 } }, gains = []; let u = api.khUse('kestrel');
  for (let n = 0; n < 10; n++) { api.khLearn({ khSeen: JSON.parse(JSON.stringify(seen)) }); const v = api.khUse('kestrel'); gains.push(v - u); u = v; }
  check('know-how grows by novelty: the first flight teaches most, repeats less and less', gains[0] > 3 * gains[9] && gains.every((g, i) => i === 0 || g <= gains[i - 1] + 1e-12) && u < 0.95,
    `Kestrel use: gains per flight ${gains.map(g => (g * 100).toFixed(1)).join(', ')} pts → ${(u * 100).toFixed(0)}%`);
  // risk: unfamiliar engines fail to light more often (deterministic per flight)
  const ignFails = use => { fresh('frugal'); P.flights = 1; P.kh = { sparrow: { use, reg: {} } }; let f = 0;
    for (let n = 0; n < 400; n++) { P.flights = n + 1; const x = api.newShip(['sci', 't1', 'sparrow']); if (!api.igniteOK(x, x.parts.find(q => q.d.key === 'sparrow').seg)) f++; } return f / 400; };
  const f0 = ignFails(0), f9 = ignFails(0.9);
  check('reliability: an engine we barely know fails to ignite ~8% of the time; one we know well almost never', f0 > 0.04 && f0 < 0.13 && f9 < 0.01, `ignition failures: ${(f0 * 100).toFixed(1)}% at know-how 0, ${(f9 * 100).toFixed(1)}% at 0.9`);
  // time and yield: unfamiliar vehicles stack slower; instruments we don't know return less
  fresh('frugal'); P.kh = {}; const sh = api.newShip(api.PRESETS.Orbiter), slow = api.khVessel(sh); P.kh = Object.fromEntries(sh.parts.map(q => [q.d.key, { use: 1, reg: {} }]));
  const fast = api.khVessel(sh), y0 = (P.kh = {}, api.khYield()); P.kh = { sci: { use: 1, reg: {} } }; const y1 = api.khYield();
  check('time and yield: an unfamiliar vehicle takes longer to stack; an instrument we know returns full value', slow < 0.6 && fast === 1 && y0 < 0.75 && y1 === 1,
    `Orbiter familiarity ${(slow * 100).toFixed(0)}% → stacking ×${(1 + 0.5 * (1 - slow)).toFixed(2)} · instrument yield ${(y0 * 100).toFixed(0)}% → ${(y1 * 100).toFixed(0)}%`);
  // no effects before a program starts (plain physics in the sim)
  api.resetHome(); Object.assign(P, { flights: 0, own: null, kh: {} }); const x = api.newShip(['sci', 't1', 'sparrow']);
  check('know-how stays out of plain physics: no ignition failures before a program has started', !api.khOn() && api.igniteOK(x, x.parts.find(q => q.d.key === 'sparrow').seg));
  fresh(null); P.own = null; P.flights = 0;
}

// 27. Several vessels in a flight (sats session, stations plan Phase A): separating a probe module makes a vessel; both
// fly; controls reach only the one you fly; switching; rails; vessel-on-vessel contact; registration. Own sim instance.
{
  const D = new Function(src + 'return {toV2,newShip,stage,advPhys,advRails,rails,vesselContact,flightRailsOK,switchTo,fleetEnd,kepler,FLEET,INP,PROG,TELLUS,DT,qrot,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, P = D.PROG, I = D.INP, zero = () => Object.assign(I, { pitch: 0, yaw: 0, roll: 0, tx: 0, ty: 0, tz: 0 });
  Object.assign(P, { day: 0, sats: [], satN: 0 });
  // a pod on a tank, a decoupler, then a probe module with its own tank and engine; parked in a 300 km orbit
  const fly = () => { D.FLEET.length = 0; D.t = 0; zero(); const s = D.newShip(['pod', 't1', 'dec', 'core', 't1', 'sparrow']), r0 = T.R + 300e3;
    Object.assign(s, { landed: false, sas: false, throttle: 0, w: [0, 0, 0], r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)] }); s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2];
    s.rec.launched = true; s.rec.day0 = 0; D.S = s; return s; };
  const mom = xs => xs.reduce((a, x) => add(a, mul(x.v, x.mass)), [0, 0, 0]), cmw = xs => mul(xs.reduce((a, x) => add(a, mul(x.r, x.mass)), [0, 0, 0]), 1 / xs.reduce((a, x) => a + x.mass, 0));
  let s = fly(), p0 = mom([s]), c0 = cmw([s]);
  for (let k = 0; k < 4 && !D.FLEET.length; k++) D.stage(s);
  const v = D.FLEET[0], dp = v ? len(sub(mom([s, v]), p0)) / len(p0) : NaN, dc = v ? len(sub(cmw([s, v]), c0)) : NaN;
  check('fleet: separating a probe module makes a vessel (not debris); momentum and centre of mass kept through the push', v && v.parts.some(p => p.d.kind === 'core') && !v.parts.some(p => p.d.kind === 'pod') && dp < 1e-12 && dc < 1e-9,
    `${v ? v.name + ': ' + v.parts.map(p => p.d.key).join(', ') : 'no vessel'}; momentum error ${dp.toExponential(1)}, centre of mass moved ${dc.toExponential(1)} m`);
  // both fly, from the same clock; the pilot's controls turn only the vessel being flown
  s.sas = false; v.sas = false; const t0 = D.t; for (let k = 0; k < 100; k++) { I.pitch = k < 5 ? 1 : 0; D.advPhys(s); } zero();   // a 0.1 s tap
  const ws = len(s.w), wv = len(v.w), dt = D.t - t0;
  check('fleet: both vessels step together on one clock; the controls reach only the vessel you fly', Math.abs(dt - 100 * D.DT) < 1e-9 && ws > 1e-3 && wv < 1e-9 && len(sub(v.r, s.r)) > 0,
    `clock advanced ${dt.toFixed(3)} s for 100 steps; the flown vessel turns at ${ws.toFixed(3)} rad/s, the other at ${wv.toExponential(1)}`);
  // switching: the flight record follows the pilot, and so do the controls
  const R = s.rec; D.switchTo(0); const nowS = D.S; for (let k = 0; k < 50; k++) { I.pitch = k < 5 ? 1 : 0; D.advPhys(D.S); } zero();
  check('fleet: switching flies the other vessel, hands it the flight record, and leaves the first in the fleet', nowS === v && D.FLEET[0] === s && v.rec === R && s.rec.mini && len(v.w) > 1e-3 && Math.abs(len(s.w) - ws) < 1e-9,
    `now flying ${D.S.name}; the capsule keeps turning at its own ${len(s.w).toFixed(3)} rad/s`);
  // rails: the other vessel coasts exactly as it would alone (rails include the bodies session's perturbations, so the
  // reference is rails itself, not bare Kepler)
  const nearPhys = !D.flightRailsOK(); v.r = add(v.r, mul(norm(v.v), 20e3));   // within 5 km they stay in physics; 20 km apart, rails
  s.w = [0, 0, 0]; v.w = [0, 0, 0]; const tr = D.t, alone = x => { const c = { ...x, r: x.r.slice(), v: x.v.slice() }; D.t = tr; D.rails(c, 600); D.t = tr; return c.r; };
  const ks = alone(s), kv = alone(v), ok = D.flightRailsOK(); D.advRails(D.S, 600, 10);
  check('fleet: close together the vessels stay in physics; apart, on rails, each coasts 600 s exactly as it would alone', nearPhys && ok && Math.abs(D.t - tr - 600) < 1e-9 && len(sub(s.r, ks)) < 1e-6 && len(sub(v.r, kv)) < 1e-6,
    `errors ${len(sub(s.r, ks)).toExponential(1)} and ${len(sub(v.r, kv)).toExponential(1)} m`);
  // the two vessels touching: one impulse, momentum kept, they part
  s.r = add(v.r, mul(D.qrot(v.q, [0, 1, 0]), -(v.yTop - s.yBot) - 30)); s.v = v.v.slice(); s.q = v.q.slice();
  const Y = D.qrot(v.q, [0, 1, 0]); s.r = add(v.r, mul(Y, v.yTop - s.yBot + 0.5)); s.v = add(v.v, mul(Y, -0.4));
  s.r = add(v.r, mul(Y, v.yTop - s.yBot - 0.01));   // the capsule's base 1 cm into the module's top, closing at 0.4 m/s
  const pc = mom([s, v]); D.vesselContact(v, s, D.DT); const sep = dot(sub(s.v, v.v), Y), hit = sep !== -0.4 ? { err: len(sub(mom([s, v]), pc)) / len(pc), sep } : null;
  check('fleet: two vessels collide (one impulse), keep their total momentum and part', hit && hit.err < 1e-12 && hit.sep > 0 && s.alive && v.alive,
    `momentum error ${hit ? hit.err.toExponential(1) : '—'}; parting at ${hit ? hit.sep.toFixed(2) : '—'} m/s`);
  // the end of the flight: the other vessel in orbit is registered
  D.fleetEnd({ day0: 0 }); const reg = P.sats.length === 1 && P.sats[0].shape.some(o => o.k === 'pod') && !D.FLEET.length;
  check('fleet: at the end of the flight the other vessel left in orbit is registered', reg, `${P.sats.map(q => q.name).join(', ')}`);
  Object.assign(P, { sats: [], satN: 0 }); D.FLEET.length = 0; zero();
}

// 28. Docking two vessels of one flight (sats session): latch, undock back to a flyable vessel, dock two you aren't flying,
// target a vessel, and register a stack that carries one. Own sim instance.
{
  const D = new Function(src + 'return {newShip,fleetContacts,undock,switchTo,sasTarget,satRegister,dockEnd,FLEET,INP,PROG,TELLUS,DT,qrot,qmul,qaxis,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, P = D.PROG, r0 = T.R + 300e3;
  Object.assign(P, { day: 0, sats: [], satN: 0 });
  const vessel = (stack, name) => { const v = D.newShip(stack); Object.assign(v, { landed: false, sas: false, throttle: 0, w: [0, 0, 0], name });
    v.rec.launched = true; v.rec.day0 = 0; return v; };
  // the flown vessel nose out at 300 km; the other turned to face it, `gap` beyond its port, closing at `close`
  const scene = ({ gap = 0.08, close = 0.2 } = {}) => { D.FLEET.length = 0; D.t = 0;
    const s = vessel(['port', 'pod', 't1'], 'Ferry'), b = vessel(['port', 'core', 't1'], 'Module'); s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(T.mu / r0)];
    const Y = D.qrot(s.q, [0, 1, 0]); b.q = D.qmul(D.qaxis([0, 0, 1], Math.PI), s.q); b.r = add(s.r, mul(Y, s.yTop + gap + b.yTop)); b.v = add(s.v, mul(Y, -close));
    b.fleet = true; b.rec = { launched: true, day0: 0, mini: true }; D.S = s; D.FLEET.push(b); return { s, b, Y }; };
  const mom = xs => xs.reduce((a, x) => add(a, mul(x.v, x.mass)), [0, 0, 0]);
  // latch: the module becomes a passenger, keeping its vessel for later; momentum and mass kept
  let { s, b, Y } = scene(), p0 = mom([s, b]), m0 = s.mass + b.mass; D.fleetContacts(D.DT);
  const a = s.att[0], ok1 = a && a.e._v === b && !D.FLEET.length && len(sub(mom([s]), p0)) / len(p0) < 1e-12 && Math.abs(s.mass - m0) < 1e-6;
  check('vessel docking: two vessels of one flight latch; the module rides as a passenger and keeps its vessel; momentum and mass kept', ok1,
    `${a ? a.e.name + ' docked' : 'no latch'}; momentum error ${(len(sub(mom([s]), p0)) / len(p0)).toExponential(1)}; ${(s.mass / 1000).toFixed(3)} t`);
  // undock: the module is a vessel again, flyable, pushed off at 0.3 m/s, momentum kept, and a save of the stack is fine
  const p1 = mom([s]); D.undock(s, a.e.id); const back = D.FLEET[0], sep = back ? dot(sub(back.v, s.v), Y) : NaN;
  const flyable = back === b && D.switchTo(0) && D.S === b; if (flyable) D.switchTo(0);
  check('vessel docking: undocking gives the vessel back (flyable), 0.3 m/s apart along the port, momentum kept', flyable && Math.abs(sep - 0.3) < 1e-6 && len(sub(mom([s, b]), p1)) / len(p1) < 1e-12,
    `${back ? back.name : '—'} back in the fleet; separation ${sep.toFixed(4)} m/s`);
  // two vessels you aren't flying dock to each other; the earlier one is the host
  ({ s, b } = scene()); const c = vessel(['pod'], 'Bystander'); c.r = add(s.r, [0, 0, 5000]); c.v = s.v.slice(); D.S = c; D.FLEET.splice(0, 0, s); s.fleet = true;
  D.fleetContacts(D.DT); const both = D.FLEET.length === 1 && D.FLEET[0] === s && s.att.length === 1 && s.att[0].e._v === b;
  check('vessel docking: two vessels you are not flying dock to each other (the earlier one hosts)', both, `fleet now: ${D.FLEET.map(v => v.name + (v.att.length ? ' + ' + v.att.map(x => x.e.name).join() : '')).join(', ')}`);
  // targeting a vessel: the Docking mode turns the nose against its port
  ({ s, b } = scene({ gap: 3, close: 0 })); b.q = D.qmul(D.qaxis([0, 0, 1], Math.PI + 0.2), s.q); Object.assign(s, { sas: true, sasMode: 'dock', tgtV: b });
  const want = mul(D.qrot(b.q, [0, 1, 0]), -1), got = D.qrot(D.sasTarget(s).q, [0, 1, 0]), err = Math.acos(Math.min(1, dot(got, want))) * 57.29578;   // the mode gives an attitude; our nose port's axis there
  check('vessel docking: a vessel can be the target; the Docking mode aims at its port', err < 1e-4, `aim error ${err.toExponential(1)}°`);
  // a flight ending with a vessel docked: one stack registered, and the save (JSON) works (the kept vessel isn't saved)
  ({ s, b } = scene()); D.fleetContacts(D.DT); D.satRegister(s, { day0: 0 }); D.dockEnd(s); let js = null; try { js = JSON.stringify(P.sats); } catch (e) { js = 'ERR ' + e.message; }
  check('vessel docking: a flight ending docked registers one stack carrying the module, and the save serialises', P.sats.length === 1 && P.sats[0].attached[0].e.name === 'Module' && !js.startsWith('ERR') && !js.includes('"_v"'),
    `${P.sats.map(q => q.name + ' + ' + (q.attached || []).map(x => x.e.name).join()).join('; ')}; save ${js.startsWith('ERR') ? js : (js.length / 1024).toFixed(1) + ' kB'}`);
  Object.assign(P, { sats: [], satN: 0 }); D.FLEET.length = 0;
}

// 29. The cargo bay (sats session, stations plan Phase B): enclosure, shielding, doors, release. Own sim instance.
{
  const D = new Function(src + 'return {newShip,physStep,advPhys,bayOp,doorF,hitGeo,partSDF,FLEET,PARTS,TELLUS,DT,qrot,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS;
  // a probe module on the floor of a bay, on a pod, a tank and an engine
  const mk = (pay = ['core', 't1']) => { D.FLEET.length = 0; D.t = 0; const s = D.newShip([...pay, 'bay', 'pod', 't2', 'kestrel']); Object.assign(s, { landed: false, sas: false, throttle: 0, w: [0, 0, 0] });
    s.rec.launched = true; s.rec.day0 = 0; D.S = s; return s; };
  let s = mk(); const bay = s.parts.find(p => p.d.kind === 'bay'), pay = s.parts.filter(p => p.inBay === bay);
  check('bay: what sits on its floor inside the walls is enclosed', pay.map(p => p.d.key).sort().join() === 'core,t1', `enclosed: ${pay.map(p => p.d.key).join(', ')}`);
  // in the air at 400 m/s, 8 km up: shut, the payload takes no air load and no heat; open, it does
  const air = (open) => { const s = mk(); if (open) { D.bayOp(s, 'open'); D.t += 2.01; D.bayOp(s, 'noop'); }
    const r0 = T.R + 8000, up = [1, 0, 0]; s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = add(D.qrot(s.q, [0, 400, 0]), [0, 0, 0]); D.physStep(s, D.DT);
    const p = s.parts.filter(q => q.inBay), b = s.parts.find(q => q.d.kind === 'bay'); return { pay: p.reduce((a, q) => a + len(q.F) + Math.abs(q.Q), 0), bay: len(b.F) }; };
  const shut = air(false), open = air(true);
  check('bay: doors shut, the payload takes no air load or heat; open, it does', shut.pay === 0 && shut.bay > 0 && open.pay > 0, `payload |F|+|Q| shut ${shut.pay.toFixed(1)}, open ${open.pay.toFixed(0)}; bay ${shut.bay.toFixed(0)} N`);
  // release: refused while shut; open, the payload leaves as a vessel at 0.3 m/s along the bay's axis, momentum kept
  s = mk(); const r0 = T.R + 300e3; s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(T.mu / r0)];
  const refused = !D.bayOp(s, 'rel') && !D.FLEET.length;
  D.bayOp(s, 'open'); for (let k = 0; k < 2.1 / D.DT; k++) D.advPhys(s); const f = D.doorF(s.parts.find(p => p.d.kind === 'bay'));
  const Y = D.qrot(s.q, [0, 1, 0]), p0 = mul(s.v, s.mass); D.bayOp(s, 'rel'); const v = D.FLEET[0], sep = v ? dot(sub(v.v, s.v), Y) : NaN, dp = v ? len(sub(add(mul(s.v, s.mass), mul(v.v, v.mass)), p0)) / len(p0) : NaN;
  check('bay: release is refused with the doors shut; open, the payload leaves as a vessel at 0.3 m/s along the bay, momentum kept', refused && f === 1 && v && v.parts.some(p => p.d.kind === 'core') && Math.abs(sep - 0.3) < 1e-9 && dp < 1e-12,
    `${v ? v.name : 'no vessel'}; doors ${f}; separation ${sep.toFixed(4)} m/s; momentum error ${dp.toExponential(1)}`);
  // it leaves without touching the walls: 15 s later (4 m of bay at 0.3 m/s) it's still parting at 0.3 m/s, clear of the top
  const sb = s.parts.find(p => p.d.kind === 'bay'), topY = sb.y0 + sb.h + sb.d.bayL; for (let k = 0; k < 15 / D.DT; k++) D.advPhys(s);
  const sep2 = dot(sub(v.v, s.v), Y), bottomV = dot(sub(add(v.r, D.qrot(v.q, sub([0, Math.min(...v.parts.map(p => p.y0)), 0], v.cm))), add(s.r, D.qrot(s.q, sub([0, topY, 0], s.cm)))), Y);
  check('bay: the payload slides out without touching the walls and clears the top', Math.abs(sep2 - 0.3) < 1e-3 && bottomV > 0, `still parting at ${sep2.toFixed(4)} m/s; its base ${bottomV.toFixed(2)} m above the bay's rim`);
  // a payload without a command part is a vessel too (not debris that would vanish)
  s = mk(['cam', 'ant']); s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(T.mu / r0)]; D.bayOp(s, 'open'); for (let k = 0; k < 2.1 / D.DT; k++) D.advPhys(s); D.bayOp(s, 'rel');
  check('bay: a payload with no command part still leaves as a vessel', D.FLEET.length === 1 && /^Payload/.test(D.FLEET[0].name), `${D.FLEET.map(x => x.name + ': ' + x.parts.map(p => p.d.key).join()).join('; ')}`);
  // the contact shape is hollow: the cavity is outside the bay, the wall inside it; the roof only while shut
  const g = D.hitGeo(sb, sb.d), mid = D.partSDF(g, 0, 2, 0), wall = D.partSDF(g, 0.75, 2, 0), roof = D.partSDF(g, 0, sb.h + sb.d.bayL + 0.05, 0);
  check('bay: its contact shape is hollow (the payload can leave), with the roof gone while the doors are open', mid > 0 && wall < 0 && roof > 0, `cavity ${mid.toFixed(2)}, wall ${wall.toFixed(3)}, roof plane ${roof.toFixed(3)} (open)`);
  D.FLEET.length = 0;
}

// 26. Production lines (economy): learning to manufacture is different from buying.
{
  const P = api.PROG; api.HOOK.news = () => {}; api.HOOK.msg = () => {};
  const fresh = arch => { api.resetHome(); Object.assign(P, { homeArch: arch, day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, lines: {}, flights: 1, own: null, decisions: [], active: [], offers: [], funds: 2000 });
    api.chooseStart('agency'); P.funds = 2000; for (const q of api.POWERS) if (q.i) P.rel[`0-${q.i}`] = 0.5; };
  // you can't reverse-engineer what you don't know; a license is possible straight away
  fresh('frugal'); const q0 = api.prodQuote('kestrel'), ownEarly = api.startProdLine('kestrel', 'own'); P.kh = { kestrel: { use: 0.5, reg: {} } }; const q1 = api.prodQuote('kestrel');
  check('an own line needs know-how of the part; a license from its maker is possible at once (cheaper, quicker)', !q0.own.ok && !ownEarly && q0.lic.ok && q1.own.ok && q0.lic.cost < q0.own.cost && q0.lic.days < q0.own.days,
    `Kestrel: own line ${q0.own.cost.toFixed(0)}M / ${q0.own.days} d (needs know-how), license from ${api.POWERS[q0.lic.from].root} ${q0.lic.cost.toFixed(0)}M / ${q0.lic.days} d`);
  // tooling up takes time; then the part is ours: no import markup, immune to sanctions, cheaper with every unit
  fresh('frugal'); P.kh = { kestrel: { use: 0.5, reg: {} } }; const price = () => api.vesselCost(api.newShip(['pod', 't2', 'kestrel']).parts).cost;
  const imp = price(), sup = api.sourceOf('kestrel').from; api.startProdLine('kestrel', 'own'); const during = api.sourceOf('kestrel').how; P.day += 200; const first = price();
  for (let n = 0; n < 25; n++) api.prodUnits(api.newShip(['kestrel'])); const mature = price(); P.sanc[sup] = 9999; const how = api.sourceOf('kestrel').how;
  check('a line takes time to tool up; then units start dear and get cheaper than imports with every one built; sanctions don\'t touch it', during === 'import' && how === 'line' && first < imp && mature < first && api.prodLine('kestrel').m > 0.8,
    `pod+tank+Kestrel: imported ${imp.toFixed(1)}M → first line units ${first.toFixed(1)}M → after 25 units ${mature.toFixed(1)}M (maturity ${(api.prodLine('kestrel').m * 100).toFixed(0)}%)`);
  // lines belong to the country: after a defection they're no longer ours
  const j = api.POWERS.find(p => p.i !== api.home && api.relOf(api.home, p.i) < 0.6).i; api.careerMove({ kind: 'defect', power: j, amt: 50 });
  check('production lines stay with the country on a defection', api.prodLine('kestrel') === null && api.sourceOf('kestrel').how !== 'line', `after defecting, the Kestrel comes ${api.sourceOf('kestrel').how === 'home' ? 'from the new home\'s industry' : 'from abroad again'}`);
  fresh(null); P.own = null; P.flights = 0; P.lines = {};
}

// 30. The test stand (economy): ground testing for know-how and certification, at a price.
{
  const P = api.PROG; api.HOOK.news = () => {}; api.HOOK.msg = () => {};
  api.resetHome(); Object.assign(P, { homeArch: 'frugal', day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, lines: {}, flights: 1, own: null, decisions: [], active: [], offers: [], stand2: null });
  api.chooseStart('agency'); P.funds = 500;
  const early = api.startTest('kestrel', 'qual'), built = api.buildStand(), stillBuilding = api.startTest('kestrel', 'qual'); api.advanceDays(61);
  const u0 = api.khUse('kestrel'), c0 = api.certOf('kestrel'), f0 = P.funds, q = api.testQuote('kestrel', 'qual'), ok = api.startTest('kestrel', 'qual'), busy = api.startTest('t2', 'qual');
  api.advanceDays(q.days + 1); const u1 = api.khUse('kestrel'), c1 = api.certOf('kestrel');
  check('test stand: built once (it takes time), one campaign at a time; a qualification run raises know-how and certification', !early && built && !stillBuilding && ok && !busy && u1 > u0 && c1 > c0 && P.funds < f0 - q.cost + 1e-9,
    `Kestrel: know-how ${(u0 * 100).toFixed(0)} → ${(u1 * 100).toFixed(0)}%, certified ${(c0 * 100).toFixed(0)} → ${(c1 * 100).toFixed(0)}%, ${q.cost.toFixed(1)}M over ${q.days} days`);
  // ground tests teach less than flying the same regimes
  const flown = (() => { const P2 = JSON.parse(JSON.stringify(P.kh)); P.kh = { kestrel: { use: u0, reg: {} } }; api.khLearn({ khSeen: { kestrel: { fly: 1, maxq: 1, heat: 1, burn: 1 } } }); const v = api.khUse('kestrel'); P.kh = P2; return v; })();
  check('the stand teaches less than a flight through the same regimes (and never vacuum or orbit)', u1 - u0 < flown - u0, `stand +${((u1 - u0) * 100).toFixed(1)} pts vs a flight +${((flown - u0) * 100).toFixed(1)} pts`);
  // to destruction: true limits known, the unit lost
  const r = api.testQuote('condor', 'destroy'); api.startTest('condor', 'destroy'); api.advanceDays(r.days + 1);
  check('test to destruction: the true rating is known (certified 100 %)', api.certOf('condor') === 1, `Condor, ${r.cost.toFixed(1)}M over ${r.days} days`);
  api.resetHome(); Object.assign(P, { own: null, flights: 0, stand2: null, kh: {}, cert: {} });
}

// 31. Development projects (economy): improving parts we make, for money, time and know-how.
{
  const P = api.PROG; api.HOOK.news = () => {}; api.HOOK.msg = () => {};
  const fresh = arch => { api.resetHome(); Object.assign(P, { homeArch: arch, day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, lines: {}, flights: 1, own: null, decisions: [], active: [], offers: [], stand2: null, dev: {}, devJob: null });
    api.chooseStart('agency'); P.funds = 2000; for (const q of api.POWERS) if (q.i) P.rel[`0-${q.i}`] = 0.5; };
  // only what we make, and only once we know it
  fresh('frugal'); const imp = api.devQuote('kestrel', 'cheap'); P.lines = { kestrel: { power: api.home, lic: null, start: 0, ready: 0, m: 0.05, units: 0 } };   // a brand-new own line: we make it, but don't know it yet
  const green = api.devQuote('kestrel', 'cheap'); P.lines = {}; const known = api.devQuote('t2', 'cheap');   // tanks we've always made: known from the start
  check('development: only parts we make (not imports), and only once we know them', !imp.ok && /make/.test(imp.why) && !green.ok && /know-how/.test(green.why) && known.ok,
    `Kestrel imported: "${imp.why}" · Kestrel off a new own line: "${green.why}" · our own tank: ${known.cost.toFixed(0)}M, ${known.days} days`);
  // a cheaper tank: the design bureau takes time; then the price drops, certification and know-how take a hit
  const price = () => api.vesselCost(api.newShip(['pod', 't2', 'kestrel']).parts).cost, p0 = price(), c0 = api.certOf('t2'), u0 = api.khUse('t2');
  const started = api.startDev('t2', 'cheap'), busy = api.startDev('t2', 'rel'); const mid = price(); api.advanceDays(known.days + 1); const p1 = price();
  check('a cheaper design costs less per unit once done, and has to prove itself again (certification and know-how dip)', started && !busy && Math.abs(mid - p0) < 1e-9 && p1 < p0 && api.devLv('t2', 'cheap') === 1 && api.certOf('t2') < c0 && api.khUse('t2') < u0,
    `pod+tank+Kestrel ${p0.toFixed(1)} → ${p1.toFixed(1)}M · tank certified ${(c0 * 100).toFixed(0)} → ${(api.certOf('t2') * 100).toFixed(0)}%, know-how ${(u0 * 100).toFixed(0)} → ${(api.khUse('t2') * 100).toFixed(0)}%`);
  // durability: the same flight wears the part less
  const part = { d: { key: 't2' }, wL: 0.9, wT: 0.2 }, w0 = api.wearOf(part, 4); P.dev.t2.dur = 2; const w2 = api.wearOf(part, 4);
  check('a more durable design keeps more of its value after a hard flight', w2 > w0, `90 % load: refurbished value ${(w0 * 100).toFixed(0)}% → ${(w2 * 100).toFixed(0)}% at durability mark 2`);
  api.resetHome(); Object.assign(P, { own: null, flights: 0, dev: {}, devJob: null, kh: {}, cert: {} });
}

// 32. Screens and keys (ui session): Help is generated from KEYS, so every key a handler reads must be in its screen's table;
// and only go() changes the screen (mode/view), so moving between screens has one place to look.
{
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));   // git may check files out with CRLF
  const KEYS = new Function(cut(page, 'const KEYS={', '\nconst SCREEN_NAME') + ';return KEYS')();
  const read = t => new Set([...t.matchAll(/k===?'([^']+)'/g), ...t.matchAll(/keys\.has\('([^']+)'\)/g)].map(m => m[1]));
  const listed = (...L) => new Set(L.flat().flatMap(r => r.k || []));
  const flightSrc = cut(page, "if(mode!=='flight')return;const k=e.key", "addEventListener('keyup'") + page.match(/keys\.has\('[^']+'\)/g).join(' ');
  const shared = cut(page, '// Keys every screen shares', '\n// ') || cut(page, '// Keys every screen shares', '</script>');
  const edSrc = cut(bsrc, "addEventListener('keydown',e=>{if(mode!=='editor'", 'palette()}');
  const fl = listed(KEYS.flight, KEYS.map, KEYS.all), ed = listed(KEYS.assembly, KEYS.all);
  const missF = [...read(flightSrc), ...read(shared)].filter(k => !fl.has(k)), missE = [...read(edSrc), ...read(shared)].filter(k => !ed.has(k));
  check('Help lists every key the flight and map handlers read', flightSrc.length > 500 && !missF.length, missF.join(' ') || `${fl.size} keys`);
  check('Help lists every key the assembly handler reads', edSrc.length > 300 && !missE.length, missE.join(' ') || `${ed.size} keys`);
  const dup = sc => { const L = (sc === 'assembly' ? [] : KEYS.flight.concat(sc === 'map' ? KEYS.map : [])).concat(sc === 'assembly' ? KEYS.assembly : [], KEYS.all).flatMap(r => r.k || []); return L.filter((k, i) => L.indexOf(k) !== i && !(sc === 'assembly' && k === 'escape')); };
  const d = ['flight', 'map', 'assembly'].flatMap(dup);
  check('no key means two things on one screen (R is revert in flight, RCS is V)', !d.length, d.join(' ') || 'ok');
  const goSrc = cut(page, 'function go(s){', '\n// Keys, one table');
  const outside = (page.replace(goSrc, '') + bsrc).match(/[^=!\w.]((?:mode|view|atHQ)=[^=])/g) || [];
  check('only go() changes the screen (no mode=/view=/atHQ= assignments outside it but their declarations)', goSrc && outside.length === 3, outside.join(' '));
  // every Program section heading the page can write lands in a real tab, not "More"
  const progTabOf = new Function('progName', cut(page, 'const progTabOf=', ';\nlet progTab') + ';return progTabOf')(() => 'Fenfen Space Agency');
  const heads = [...html.matchAll(/class="ep">([A-Z][^<$]*)/g)].map(m => m[1].trim()).filter(h => !/^\.\*/.test(h));
  const lost = [...new Set(heads.filter(h => progTabOf(h) === 'more'))];
  check('every Program section heading has a tab (add new ones to progTabOf)', heads.length > 8 && !lost.length && progTabOf('Fenfen Space Agency · national agency') === 'company', lost.join(' | ') || `${heads.length} headings`);
}

// 33. Facilities (economy): the integration hall and the recovery fleet.
{
  const P = api.PROG; const news = []; api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {};
  api.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, lines: {}, flights: 1, own: null, decisions: [], active: [], offers: [], fac: {} });
  api.chooseStart('agency'); P.funds = 1000;
  const stack = st => { P.day = 0; const x = api.newShip(st); api.S = x; x.landed = false; api.t = 0; const d0 = P.day; api.missionTick(x, 0, false); return { x, days: x.rec.prep }; };
  const t0 = stack(api.PRESETS.Orbiter).days; api.buildFac('hall'); const tBuilding = stack(api.PRESETS.Orbiter).days; P.day = 500; api.advanceDays(1); const t1 = stack(api.PRESETS.Orbiter).days;   // (stack() resets the date)
  check('integration hall: stacking takes less time once it is built (not while building)', Math.abs(tBuilding - t0) < 1e-9 && Math.abs(t1 / t0 - api.FAC.hall.eff[1]) < 1e-9 && api.facLv('hall') === 1, `Orbiter stacking ${t0.toFixed(1)} → ${t1.toFixed(1)} days at hall level 1`);
  // the fleet: salvages stages that land at sea within range of the launch point, not on land or too far
  api.buildFac('fleet'); P.day = 1000; api.advanceDays(1);
  const { x } = stack(['pod', 't1', 'dec', 't8', 'kestrel']), stagePts = x.parts.filter(p => ['t8', 'kestrel'].includes(p.d.key)), pf0 = x.rec.launchPf, u0 = api.norm(pf0), near = api.norm([u0[0], u0[1] + 0.1, u0[2]]).map(v => v * api.TELLUS.R), far = api.norm([u0[0], u0[1] + 1.0, u0[2]]).map(v => v * api.TELLUS.R);
  const R = { drops: [{ kind: 'sea', pf: near, parts: stagePts }, { kind: 'land', pf: near, parts: stagePts }, { kind: 'sea', pf: far, parts: stagePts }], launchPf: pf0 }, f0 = P.funds; api.fleetSalvage(R);
  const got = P.funds - f0;
  check('recovery fleet: one stage fished out at sea within range; the one on land and the one too far are lost', got > 0 && news.some(t => /1 stage fished out/.test(t)) && api.khUse('kestrel') > 0,
    `+${got.toFixed(1)}M for a Kestrel stage ${(Math.acos(api.dot(api.norm(near), api.norm(pf0))) * api.TELLUS.R / 1e3).toFixed(0)} km out (the other ${(Math.acos(api.dot(api.norm(far), api.norm(pf0))) * api.TELLUS.R / 1e3).toFixed(0)} km away: out of range)`);
  api.resetHome(); Object.assign(P, { own: null, flights: 0, fac: {}, kh: {} });
}

// 34. Compute eras and trajectory studies (economy).
{
  const P = api.PROG; const news = []; api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {};
  const setup = arch => { api.resetHome(); Object.assign(P, { homeArch: arch, day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, lines: {}, flights: 1, own: null, decisions: [], active: [], offers: [], fac: {}, studies: {}, studyQ: [], compEra: null });
    api.chooseStart('agency'); P.funds = 1000; };
  // eras follow the world date; a power arrives late by its access lag
  setup('openSuper'); const e0 = api.compEra(); P.day = 3.5 * 400; const eOpen = api.compEra(), lagOpen = api.compLag();
  setup('resource'); P.day = 3.5 * 400; const eRes = api.compEra(), lagRes = api.compLag();
  check('compute eras: the world date brings mainframes; a resource state with no chip industry gets them late', e0 === 0 && eOpen === 1 && eRes === 0 && lagOpen === 0 && lagRes > 1,
    `year 4.5: open superpower ${api.COMP_ERAS[eOpen].name} (lag ${lagOpen.toFixed(1)} yr), resource state ${api.COMP_ERAS[eRes].name} (lag ${lagRes.toFixed(1)} yr)`);
  // a study: costs money, a launch waits for it, and it narrows the prediction error; another design isn't covered
  setup('openSuper'); const s = api.newShip(api.PRESETS.Orbiter), q = api.studyQuote(s), e1 = api.predErr(s), f0 = P.funds;
  const okOrder = api.orderStudy(s), paid = f0 - P.funds; api.S = s; s.landed = false; api.t = 0; api.missionTick(s, 0, false);
  const waited = s.rec.studyWait, prep = s.rec.prep; api.advanceDays(0.01); const e2 = api.predErr(s), other = api.predErr(api.newShip(api.PRESETS.Sounding));
  check('a trajectory study costs money and days (the launch waits for it, then stacks), and narrows the prediction error for that design only',
    okOrder && Math.abs(paid - q.cost) < 1e-9 && Math.abs(waited - q.days) < 1e-9 && P.day >= q.days + prep && e1 === 0.3 && e2 === 0.1 && other === 0.3,
    `Orbiter study ${q.cost.toFixed(1)}M, ${q.days.toFixed(0)} days + ${prep.toFixed(0)} stacking; ±${e1 * 100}% → ±${e2 * 100}% (a Sounding stays ±${other * 100}%)`);
  // ordered ahead, while time passes, it costs no days at launch
  setup('openSuper'); const s2 = api.newShip(api.PRESETS.Orbiter); api.orderStudy(s2); api.advanceDays(40); api.S = s2; s2.landed = false; api.t = 0; api.missionTick(s2, 0, false);
  check('a study ordered ahead of time costs no days at launch', s2.rec.studyWait === 0 && api.predErr(s2) === 0.1, `waited ${s2.rec.studyWait} days`);
  // the impact predictor reads the error as a drag-model error: an unstudied design's spread is wider; none once compute is cheap
  setup('openSuper'); for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) P.atm[k] = 1;
  const f = api.newShip(['pod']); api.S = f; f.landed = false; api.t = 0; const up = api.norm(f.r); f.r = api.add(f.r, api.mul(up, 60e3)); f.v = api.add(api.surfVel(api.TELLUS, f.r), api.add(api.mul(up, 300), api.mul(api.norm(api.cross([0, 1, 0], up)), 1500)));
  const gc = (a, b) => Math.acos(Math.max(-1, Math.min(1, api.dot(api.norm(a.pf), api.norm(b.pf))))) * api.TELLUS.R / 1e3;
  const sp = () => { const c = api.predictImpact(f), lo = api.predictImpact(f, -1), hi = api.predictImpact(f, 1); return Math.max(gc(lo, c), gc(hi, c)); };
  const raw = sp(); P.studies = { [api.studyKey(f)]: { err: 0.1 } }; const studied = sp(); P.day = 15 * 400; const cheap = sp();
  check('impact spread: an unstudied design lands in a wider spread than a studied one, and cheap compute makes it exact (all air bands sampled)', raw > studied * 2 && studied > 0 && cheap < 1e-6,
    `±${raw.toFixed(1)} km unstudied, ±${studied.toFixed(1)} km studied, ${cheap.toFixed(3)} km with cheap compute`);
  // the computing centre: studies faster, the program ahead of its power
  setup('resource'); P.day = 3.5 * 400; const sR = api.newShip(api.PRESETS.Orbiter), d0 = api.studyQuote(sR).days; api.buildFac('centre'); P.day += 100; api.advanceDays(0.01);
  check('computing centre: faster studies and a year ahead of our power', api.compEra() === 1 && api.studyQuote(sR).days < d0, `resource state, year 4.8: ${api.COMP_ERAS[api.compEra()].name}; study ${d0.toFixed(0)} d → ${api.studyQuote(sR).days.toFixed(0)} d`);
  api.resetHome(); Object.assign(P, { own: null, flights: 0, fac: {}, kh: {}, studies: {}, studyQ: [], compEra: null, atm: {} });
}

// 35. The event timeline (economy): what's dated in the program, waiting to the next event, stopping where you're needed.
{
  const P = api.PROG; const news = []; api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {};
  api.resetHome(); Object.assign(P, { homeArch: 'frugal', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, lines: {}, flights: 1, own: null, decisions: [], active: [], offers: [], fac: {}, studies: {}, studyQ: [], compEra: null, stand2: null, devJob: null, nextElection: null });
  api.chooseStart('agency'); P.funds = 1000; P.day = 10;
  api.buildFac('fleet'); api.orderStudy(api.newShip(api.PRESETS.Orbiter));
  const E = api.upcoming(), kinds = E.map(e => e.kind), sorted = E.every((e, i) => !i || E[i - 1].day <= e.day);
  check('timeline: studies, buildings and budget day are listed in date order', sorted && ['study', 'build', 'budget'].every(k => kinds.includes(k)) && api.nextEvent().day === E[0].day,
    E.slice(0, 4).map(e => `day ${e.day.toFixed(0)} ${e.kind}`).join(' · '));
  // waiting to the next event: the study (34 days) comes first, then budget day (100); the fleet opens at day 100 too
  const f0 = P.funds; api.advanceTo(); const d1 = P.day, studied = Object.keys(P.studies).length; api.advanceTo(); const d2 = P.day;
  check('timeline: "wait" goes to the next event and it happens (the study lands, then budget day comes)', studied === 1 && Math.abs(d2 - 100) < 1e-6 && d1 < d2 && P.funds > f0,
    `day ${d1.toFixed(1)}: ${studied} design studied · day ${d2.toFixed(1)}: budget day, funds ${f0.toFixed(0)} → ${P.funds.toFixed(0)}M`);
  // a long wait stops a day before a contract deadline, so it isn't missed
  api.ensureBoard(); const o = P.offers.find(o => o.p.dur > 20) || P.offers[0]; api.acceptOffer(o.id); const c = P.active[0], st = api.advanceTo(P.day + 1000);
  check('timeline: a long wait stops a day before a contract deadline (not missed)', st && st.kind === 'deadline' && P.active.includes(c) && Math.abs(P.day - (c.deadline - 1)) < 1e-6,
    `stopped at day ${P.day.toFixed(1)}, deadline ${c.deadline.toFixed(1)}: ${st && st.text}`);
  // idle time is neutral: no overhead, so funds never fall while waiting (they only rise on budget days)
  P.active = []; let lo = P.funds, fell = false; for (let i = 0; i < 6; i++) { api.advanceTo(); if (P.funds < lo - 1e-9) fell = true; lo = P.funds; }
  check('timeline: waiting costs nothing (no daily overhead)', !fell, `six waits to day ${P.day.toFixed(0)}, funds never fell`);
  api.resetHome(); Object.assign(P, { own: null, flights: 0, fac: {}, kh: {}, studies: {}, studyQ: [], compEra: null, active: [], offers: [], decisions: [] });
}

// 25. Surfaces (terrain session): the touchdown verdict depends on the ground. Friction caps the slope a vessel can
// stand on (atan μ), softness changes the speed the ground forgives, boulders or trees add to the effective speed.
{
  const D = Math.PI / 180, R = TELLUS.R, U = (la, lo) => [Math.cos(la * D) * Math.cos(lo * D), Math.sin(la * D), Math.cos(la * D) * Math.sin(lo * D)];
  const want = { ice: null, grip: null, sand: null, basalt: null, rain: null };
  for (let la = -80; la <= 80; la += 0.5) for (let lo = -180; lo < 180; lo += 0.5) {
    const u = U(la, lo), b = api.biomeAt(u); if (b.h < 0) continue;
    const sl = api.terrainSlope(TELLUS, u), su = api.surfaceAt(TELLUS, u), hit = api.surfaceHit(su, u);
    if (!want.ice && b.id === 1 && sl > 0.14 && sl < 0.35) want.ice = { u, sl, su };
    if (!want.grip && b.id !== 1 && su.name === b.name && su.mu >= 0.5 && hit === 0 && sl > 0.14 && sl < Math.min(api.TOPPLE, Math.atan(su.mu)) - 0.02) want.grip = { u, sl, su };
    if (!want.sand && b.id === 10 && su.name === b.name && hit === 0 && sl < 0.1) want.sand = { u, sl, su };
    if (!want.basalt && b.id === 12 && su.name === b.name && hit === 0 && sl < 0.1) want.basalt = { u, sl, su };
    if (!want.rain && b.id === 8 && su.name === b.name) want.rain = { u, sl, su }; }
  // set a pod down, upright, just above the ground, coming down at v m/s
  const drop = (spot, v, stack = ['chute', 'pod'], steps = 2500) => { api.t = 0; const s = api.newShip(stack); api.S = s; let last = ''; api.HOOK.msg = m => { last = m; }; s.landed = false;
    s.r = api.fromPF(TELLUS, mul(spot.u, R + api.groundAlt(TELLUS, spot.u) - s.yBot + 0.2), 0); const up = norm(s.r), e = norm(cross([0, 1, 0], up));
    s.v = add(api.surfVel(TELLUS, s.r), mul(up, -v)); s.q = api.qFromBasis(e, up, cross(e, up)); s.w = [0, 0, 0]; s.sas = true; s.sasMode = 'stab';
    let p0 = null; for (let i = 0; i < steps && s.alive && !s.landed; i++) { api.physStep(s, api.DT); if (!p0 && s.inContact) p0 = api.toPF(TELLUS, s.r, api.t); }
    const moved = p0 ? len(sub(api.toPF(TELLUS, s.r, api.t), p0)) : 0, Y = api.qrot(s.q, [0, 1, 0]), lean = Math.acos(Math.min(1, dot(Y, norm(s.r)))) / D;
    return { s, last, moved, lean }; };
  const ice = drop(want.ice, 2, ['chute', 'pod'], 500), grip = drop(want.grip, 2);
  check('contact: on a slope ice cannot hold (μ 0.1) the pod slides; on grippier ground at a steeper pitch it comes to rest, leaning with the slope',
    api.SURF.length === api.BIOMES.length && ice.s.alive && !ice.s.landed && ice.moved > 3 && grip.s.landed && grip.moved < 1.5 && Math.abs(grip.lean - want.grip.sl / D) < 4 && grip.s.landSurface.name === want.grip.su.name,
    `ice at ${(want.ice.sl / D).toFixed(0)}°: slid ${ice.moved.toFixed(1)} m in 10 s · ${want.grip.su.name} at ${(want.grip.sl / D).toFixed(0)}°: ${grip.last} (moved ${grip.moved.toFixed(2)} m)`);
  const sand = drop(want.sand, 13.5), basalt = drop(want.basalt, 10.5), flatRain = drop(want.sand, 10.5);
  check('surfaces: sand forgives 13.5 m/s; basalt does not forgive 10.5 m/s, which sand takes in its stride',
    sand.s.landed && !basalt.s.alive && flatRain.s.landed, `sand: ${sand.last} · basalt: ${basalt.last}`);
  // boulders/trees: the share of hit cells follows the biome's roughness, and the same spot always gives the same answer
  const su = want.rain.su, f = api.siteFrame(want.rain.u); let hits = 0, same = true;
  for (let k = 0; k < 2000; k++) { const q = norm(add(want.rain.u, add(mul(f.e, (k % 50) * 37 / R), mul(f.n, Math.floor(k / 50) * 37 / R))));
    const h = api.surfaceHit(su, q); if (h > 0) { hits++; if (h < 2 || h > 6) same = false; } if (h !== api.surfaceHit(su, q)) same = false; }
  check('surfaces: rainforest cells have trees at its roughness (60%), adding 2–6 m/s, deterministically', Math.abs(hits / 2000 - su.rough) < 0.05 && same,
    `${(100 * hits / 2000).toFixed(0)}% of 2,000 cells (roughness ${su.rough * 100}%)`);
  // snow: cold, gentle ground on a non-ice biome is snow (μ 0.3, +3 m/s); Selene's regolith has boulders in 15% of cells
  let snowFlat = null, snowSteep = null;
  for (let la = -80; la <= 80 && !(snowFlat && snowSteep); la += 0.5) for (let lo = -180; lo < 180 && !(snowFlat && snowSteep); lo += 0.5) {
    const u = U(la, lo), sv = api.surfaceAt(TELLUS, u); if (sv.name !== 'snow') continue; const sl = api.terrainSlope(TELLUS, u);
    if (!snowFlat && sl < 0.1 && api.surfaceHit(sv, u) === 0) snowFlat = { u, sl, su: sv };
    if (!snowSteep && sl > 0.33 && sl < 0.4 && api.surfaceHit(sv, u) === 0) snowSteep = { u, sl, su: sv }; }
  const sf = drop(snowFlat, 14.5), ss = drop(snowSteep, 2, ['chute', 'pod'], 500);
  let mh = 0; for (let k = 0; k < 2000; k++) { const q = U(-60 + (k % 40) * 0.3, (k / 40 | 0) * 0.7); if (api.surfaceHit(api.SURF_MOON, q, api.SELENE) > 0) mh++; }
  check('surfaces: snow forgives 14.5 m/s on the flat but cannot hold a 19–23° slope; Selene has boulders in ~15% of cells',
    sf.s.landed && ss.s.alive && !ss.s.landed && ss.moved > 3 && Math.abs(mh / 2000 - 0.15) < 0.04,
    `snow flat: ${sf.last} · snow at ${(snowSteep.sl / D).toFixed(0)}°: slid ${ss.moved.toFixed(1)} m in 10 s · Selene ${(100 * mh / 2000).toFixed(0)}% boulder cells`);
  // tipping: a tall, narrow rocket (the Orbiter: 1.25 m base, CoM ~5 m up) set down gently stands on the flat but goes over on a
  // slope its footprint can't span, however grippy the ground
  let tiltSpot = null;
  for (let la = -60; la <= 60 && !tiltSpot; la += 0.5) for (let lo = -180; lo < 180 && !tiltSpot; lo += 0.5) {
    const u = U(la, lo), sv = api.surfaceAt(TELLUS, u); if (sv.mu < 0.5 || api.surfaceHit(sv, u) > 0) continue; const sl = api.terrainSlope(TELLUS, u);
    if (sl > 0.2 && sl < 0.3) tiltSpot = { u, sl, su: sv }; }
  const tallFlat = drop(want.sand, 1, api.PRESETS.Orbiter), tallSlope = drop(tiltSpot, 1, api.PRESETS.Orbiter);
  check('contact: the Orbiter set down at 1 m/s stands on the flat and topples on a 12–17° slope (its footprint is narrow)',
    tallFlat.s.landed && !tallSlope.s.alive && /Toppled/.test(tallSlope.last), `flat: ${tallFlat.last} · ${tiltSpot.su.name} at ${(tiltSpot.sl / D).toFixed(0)}°: ${tallSlope.last}`);
}

// 35. Engine gimbal and steerable fins (control session): the nozzle really turns, within its range and slew rate; a single
// engine on the axis cannot roll the vessel, side boosters can; the nozzle centres again when nothing asks for torque.
// All-moving fins steer in air in proportion to q, and roll.
{
  const D = Math.PI / 180, R = TELLUS.R;
  const inSpace = (stack) => { api.t = 0; const s = api.newShip(stack); api.S = s; api.HOOK.msg = () => {}; s.landed = false;
    s.r = [R + ATM + 50e3, 0, 0]; s.v = [0, 0, -Math.sqrt(TELLUS.mu / (R + ATM + 50e3))]; s.w = [0, 0, 0]; api.stage(s); return s; };
  const bodyW = s => api.qrot([-s.q[0], -s.q[1], -s.q[2], s.q[3]], s.w);
  // a wheel-less probe on one Sparrow, SAS off: roll and pitch held for 3 s at full throttle
  const run = (key) => { const s = inSpace(['cam', 't1', 'sparrow']); s.sas = false; s.throttle = 1; let gMax = 0, rate = 0, prev = null;
    for (let i = 0; i < 3 / api.DT; i++) { api.INP[key] = 1; api.physStep(s, api.DT); const e = s.parts.find(p => p.d.kind === 'engine'), g = len(e.gv || [0, 0, 0]);
      gMax = Math.max(gMax, Math.asin(Math.min(1, g)) / D); if (prev) rate = Math.max(rate, len(sub(e.gv, prev)) / api.DT / D); prev = e.gv.slice(); }
    api.INP[key] = 0; return { s, w: bodyW(s), gMax, rate }; };
  const roll = run('roll'), pitch = run('pitch');
  check('gimbal: one Sparrow on the axis pitches a wheel-less probe but cannot roll it; nozzle within 3° and 15 °/s',
    roll.s.torque === 0 && Math.abs(roll.w[1]) < 1e-6 && Math.hypot(pitch.w[0], pitch.w[2]) > 0.3 && pitch.gMax <= 3 + 1e-9 && pitch.rate <= 15 + 1e-6,
    `roll rate ${roll.w[1].toExponential(1)} rad/s; pitch rate ${Math.hypot(pitch.w[0], pitch.w[2]).toFixed(2)} rad/s; max ${pitch.gMax.toFixed(2)}° at ≤ ${pitch.rate.toFixed(1)} °/s`);
  // the nozzle centres once the key is let go and the throttle is cut
  const s = pitch.s; s.throttle = 0; for (let i = 0; i < 1 / api.DT; i++) api.physStep(s, api.DT);
  const e = s.parts.find(p => p.d.kind === 'engine');
  // side boosters give roll authority beyond the wheels; a single core engine gives none
  const H = inSpace(api.PRESETS.Heavy), O = inSpace(api.PRESETS.Orbiter), rH = api.ctrlAuthRoll(H, api.activeEngines(H), 1), rO = api.ctrlAuthRoll(O, api.activeEngines(O), 1);
  check('gimbal: the nozzle centres with the throttle cut; the Heavy\'s boosters add roll authority, the Orbiter\'s one engine none',
    len(e.gv) < 1e-9 && rO === O.torque && rH > 2 * H.torque,
    `nozzle ${len(e.gv).toExponential(1)}; roll authority Orbiter ${(rO / 1e3).toFixed(0)} kN·m (wheels), Heavy ${(rH / 1e3).toFixed(0)} kN·m`);
  // steerable fins: a probe dart coasting nose-up at 300 m/s, 5 km, told to hold 30° off. A passive ring's aero moment fights
  // the core's 4 kN·m wheels; an all-moving ring flies it there. Unpowered, wheel-less, the roll key rolls only on steerable fins.
  const dart = (stack, { h = 5000, v = 300, turn = 30, T = 20, roll = false } = {}) => { api.t = 0; const s = api.newShip(stack); api.S = s; api.HOOK.msg = () => {};
    s.landed = false; const r = [R + h, 0, 0], f = api.localFrame(r); s.r = r; s.v = add(api.surfVel(TELLUS, r), mul(f.up, v)); s.q = api.qFromBasis(f.e, f.up, cross(f.e, f.up)); s.w = [0, 0, 0];
    const tgt = norm(add(mul(f.up, Math.cos(turn * D)), mul(f.e, Math.sin(turn * D)))); s.sas = !roll; s.sasMode = 'stab'; s.hold = tgt;
    let reach = null, dMax = 0, rate = 0, auth0 = null;
    for (let i = 0; i < T / api.DT && s.alive; i++) { api.INP.roll = roll ? 1 : 0; const before = s.parts.map(p => p.fd ? p.fd.slice() : null); api.physStep(s, api.DT); if (!auth0) auth0 = s.finAuth;
      s.parts.forEach((p, k) => { if (!p.fd) return; p.fd.forEach((x, j) => { dMax = Math.max(dMax, Math.abs(x) / D); if (before[k]) rate = Math.max(rate, Math.abs(x - before[k][j]) / api.DT / D); }); });
      if (reach == null && Math.acos(Math.min(1, dot(api.qrot(s.q, [0, 1, 0]), tgt))) < 2 * D) reach = api.t; }
    api.INP.roll = 0; return { s, reach, dMax, rate, auth0, w: bodyW(s) }; };
  const pas = dart(['core', 't1', 'fins', 'sparrow']), ste = dart(['core', 't1', 'cfins', 'sparrow']);
  check('steerable fins: a probe dart at 300 m/s turns 30° far faster on an all-moving ring than on a passive one; plates within 20° and 40 °/s',
    ste.reach != null && pas.reach != null && ste.reach < 0.6 * pas.reach && ste.dMax <= 20 + 1e-9 && ste.rate <= 40 + 1e-6,
    `steerable ${ste.reach?.toFixed(1)} s, passive ${pas.reach?.toFixed(1)} s; plates up to ${ste.dMax.toFixed(1)}° at ≤ ${ste.rate.toFixed(1)} °/s`);
  const vac = dart(['core', 't1', 'cfins', 'sparrow'], { h: 150000, T: 1 }), lo = dart(['core', 't1', 'cfins', 'sparrow'], { v: 150, T: 1 }), hi = dart(['core', 't1', 'cfins', 'sparrow'], { v: 300, T: 1 });
  const rs = dart(['sci', 't1', 'cfins', 'sparrow'], { turn: 0, T: 2, roll: true }), rp = dart(['sci', 't1', 'fins', 'sparrow'], { turn: 0, T: 2, roll: true });
  check('steerable fins: authority grows with q (≈4× from 150 to 300 m/s), none in vacuum; they roll a wheel-less dart, a passive ring does not',
    vac.auth0 === null && lo.auth0 && hi.auth0 && Math.abs(hi.auth0[0] / lo.auth0[0] - 4) < 0.5 && Math.abs(rs.w[1]) > 0.5 && Math.abs(rp.w[1]) < 1e-6,
    `pitch authority ${(lo.auth0[0] / 1e3).toFixed(1)} → ${(hi.auth0[0] / 1e3).toFixed(1)} kN·m; roll rate after 2 s: steerable ${rs.w[1].toFixed(2)}, passive ${rp.w[1].toExponential(1)} rad/s`);
}

// 30. Stations (sats session, stations plan Phase C): radial ports on any structure, habitat and lab, station state and
// what passes between flights. Own sim instance.
{
  const D = new Function(src + 'return {toV2,newShip,physStep,contactStep,satRegister,satAt,satSpin,sasTarget,undock,portsOf,stationOf,stationTick,PROG,TELLUS,DT,qrot,qFromTo,get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, P = D.PROG, r0 = T.R + 300e3, fnd = (n, k) => n.k === k ? n : (n.c || []).map(c => fnd(c, k)).find(Boolean);
  Object.assign(P, { day: 0, sats: [], satN: 0 });
  // a hub: a probe core on a tank, with one radial port on the tank's side (facing +X of the vessel)
  const hub = () => { D.t = 0; const d = D.toV2(['core', 't2']); fnd(d.root, 't2').c.push({ k: 'rport', at: { y: 1.0, a: 0, n: 1, cy: 0.5 }, c: [] });
    const s = D.newShip(d); Object.assign(s, { landed: false, sas: false, throttle: 0, w: [0, 0, 0], q: [0, 0, 0, 1], r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)] });
    s.rec.launched = true; s.rec.day0 = 0; return s; };
  let s = hub(); const rp = D.portsOf(s.parts.filter(p => p.on), new Set()).find(x => Math.abs(x.ax[1]) < 1e-9);
  check('stations: a radial port on a tank faces out from its side, its face 0.3 m off the skin', rp && Math.abs(rp.ax[0] - 1) < 1e-9 && Math.abs(rp.face[0] - 0.925) < 1e-9,
    rp ? `axis (${rp.ax.map(x => x.toFixed(2)).join(', ')}), face ${rp.face[0].toFixed(3)} m from the axis` : 'no radial port found');
  // a habitat module with a nose port, registered so its port faces the hub's side port, 0.1 m off
  const module = (s, gap, axis) => { Object.assign(P, { sats: [], satN: 0 }); const k = D.newShip(['port', 'hab']); k.landed = false; k.rec.launched = true; k.rec.day0 = 0;
    const n = D.qrot(s.q, [1, 0, 0]), face = add(s.r, D.qrot(s.q, sub(rp.face, s.cm))), Y = axis || mul(n, -1); k.q = D.qFromTo([0, 1, 0], Y);
    k.r = sub(add(face, mul(n, gap)), mul(Y, k.yTop)); k.v = s.v.slice(); D.satRegister(k, { day0: 0 }); return P.sats[0]; };
  let q = module(s, 0.1); const n = D.qrot(s.q, [1, 0, 0]); s.v = add(s.v, mul(n, 0.15));
  for (let i = 0; i < 200 && !s.att.length; i++) { D.physStep(s, D.DT); D.contactStep(s, D.DT); }
  const a = s.att[0], perp = a ? Math.abs(dot(D.qrot(a.q, [0, 1, 0]), [0, 1, 0])) : NaN;
  check('stations: a module docks onto a hub\'s side port, at right angles to the hub', a && a.e === q && perp < 1e-9, `${a ? a.e.name + ' docked' : 'no latch'}; its axis · the hub's axis = ${perp.toExponential(1)}`);
  // the side port carries the load like any port, and undocking pushes off along its own axis
  s.aB = [2, 0, 0]; s.alB = [0, 0, 0]; s.wB = [0, 0, 0]; D.contactStep(s, D.DT); const load = a.load;
  s.w = [0, 0, 0]; D.undock(s, q.id); const [, vq] = D.satAt(q, D.t), sep = dot(sub(vq, s.v), n);   // (latching off-axis left a slow turn; stop it to measure the push alone)
  check('stations: the side port carries its load and undocks along its own axis', load > 0 && load < 1 && Math.abs(sep - 0.3) < 1e-6, `load at 2 m/s² sideways ${(load * 100).toFixed(1)} %; separation ${sep.toFixed(9)} m/s along the port`);
  // the Docking mode turns the hub so its side port faces a target port that points another way (here along +Z)
  s = hub(); q = module(s, 3, [0, 0, 1]); Object.assign(s, { sas: true, sasMode: 'dock', target: q.id });
  for (let i = 0; i < 40 / D.DT; i++) D.physStep(s, D.DT);
  const [qr, qv] = D.satAt(q, D.t), Ab = D.qrot(D.satSpin(q, D.t, qr, qv).q, [0, 1, 0]), off =   // the target port turns with its orbit; aim where it is now
    Math.acos(Math.min(1, -dot(D.qrot(s.q, [1, 0, 0]), Ab))) * 57.29578;
  check('stations: the Docking mode turns a side port to face its target (it aims the port, not the nose)', off < 1, `side port ${off.toFixed(2)}° off after 40 s (90° at the start)`);
  // station state from a registered stack: a crewed capsule, a habitat, a lab
  Object.assign(P, { sats: [], satN: 0, labDays: 0 }); const st0 = (crewed) => { const k = D.newShip(['crew', 'hab', 'lab']); Object.assign(k, { landed: false, r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)] });
    k.rec.launched = true; D.satRegister(k, { day0: 0, crewed, crewOK: true }); return P.sats[P.sats.length - 1]; };
  q = st0(true); let st = D.stationOf(q);
  check('stations: a crewed capsule, a habitat and a lab make a station: 3 berths, crew 2, 1 lab, 60 crew-days of supplies (30 days for two)', st && st.berths === 3 && st.crew === 2 && st.labs === 1 && Math.abs(st.days - 30) < 1e-9,
    st ? `berths ${st.berths}, crew ${st.crew}, labs ${st.labs}, supplies ${(st.sup * 1000).toFixed(0)} kg = ${st.days.toFixed(1)} days, ${st.ports} free ports` : 'not a station');
  // between flights: 10 days use 100 kg and earn 20 lab-days; of 30 more, supplies last 20 (40 more lab-days, 60 in all), and say so
  const news = []; const nw = q => q; D.stationTick(10); const a10 = D.stationOf(q).sup, l10 = q.labDays; D.stationTick(30); st = D.stationOf(q);
  check('stations: between flights the crew uses supplies and the lab earns lab-days, until the supplies run out', Math.abs(a10 - 0.2) < 1e-9 && Math.abs(l10 - 20) < 1e-9 && st.sup < 1e-12 && Math.abs(q.labDays - 60) < 1e-9 && q.supOut,
    `after 10 days ${(a10 * 1000).toFixed(0)} kg and ${l10.toFixed(0)} lab-days; after 40, ${(st.sup * 1000).toFixed(0)} kg and ${q.labDays.toFixed(0)} lab-days (out: ${!!q.supOut})`);
  // dummies don't count: the same stack flown before the escape tower qualified has no crew
  Object.assign(P, { sats: [] }); q = st0(false); st = D.stationOf(q);
  check('stations: a capsule that flew dummies brings no crew', st.crew === 0 && st.seats === 0, `crew ${st.crew}`);
  Object.assign(P, { sats: [], satN: 0, labDays: 0 });
}

// 31. Vessels that stay flyable across flights (sats session, stations plan A2): a registered vessel rebuilds from its
// design (parts, fuel, staging, crew), as itself, through a save; undocking a flyable body gives a vessel; a nearby one
// loads into the flight. Own sim instance.
{
  const D = new Function(src + 'return {newShip,geom,stage,satRegister,fleetEnd,dockEnd,fleetContacts,vesselOf,flyable,loadEntry,nearbyFlyable,undock,activeEngines,crewOn,FLEET,PROG,TELLUS,DT,qrot,qmul,qaxis,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, P = D.PROG, r0 = T.R + 300e3, round = q => JSON.parse(JSON.stringify(q));   // as through a save
  Object.assign(P, { day: 0, sats: [], satN: 0 });
  const fly = (stack, crewed) => { D.FLEET.length = 0; D.t = 0; const s = D.newShip(stack); Object.assign(s, { landed: false, sas: false, throttle: 0, w: [0, 0, 0], r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)] });
    s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; Object.assign(s.rec, { launched: true, day0: 0, crewed: !!crewed, crewOK: true }); D.S = s; return s; };
  // a probe stage after its booster dropped, some fuel used: registered, saved, rebuilt
  let s = fly(['core', 't1', 'dec', 't1', 'sparrow']); for (let k = 0; k < 4 && s.evIdx < s.events.length; k++) D.stage(s);
  const tk = s.parts.find(p => p.on && p.d.key === 't1'); tk.res.fuel = 0.37; D.geom(s); D.satRegister(s, s.rec); let q = round(P.sats[0]); P.sats[0] = q;
  let v = D.vesselOf(q, 0); const keys = vv => vv.parts.filter(p => p.on).map(p => p.d.key).sort().join(), fuel = v.parts.find(p => p.on && p.d.key === 't1').res.fuel;
  check('A2: a registered vessel rebuilds from its design through a save: same parts, fuel, mass, place, nothing left to stage', D.flyable(q) && keys(v) === keys(s) && Math.abs(fuel - 0.37) < 1e-12 && Math.abs(v.mass - s.mass) < 1e-6 && len(sub(v.r, s.r)) < 1e-6 && v.evIdx === v.events.length,
    `${q.name}: ${keys(v)}; fuel ${fuel.toFixed(2)} t; mass ${(v.mass / 1000).toFixed(3)} t (was ${(s.mass / 1000).toFixed(3)}); staging ${v.evIdx}/${v.events.length}`);
  // a vessel split off another rebuilds too: the separated probe, its engine still lit
  Object.assign(P, { sats: [], satN: 0 }); s = fly(['pod', 't1', 'dec', 'core', 't1', 'sparrow']); for (let k = 0; k < 4 && !D.FLEET.length; k++) D.stage(s);
  const probe = D.FLEET[0]; D.fleetEnd(s.rec); q = round(P.sats.find(x => x.shape.some(o => o.k === 'core'))); v = D.vesselOf(q, 0); v.throttle = 1;
  check('A2: a vessel that separated from another rebuilds from the original design, its engine still lit', probe && keys(v) === keys(probe) && D.activeEngines(v).length === 1,
    `${q.name}: ${keys(v)}; engines lit ${D.activeEngines(v).length}`);
  // identity: flown again and re-registered, it's the same object (id, name, history)
  P.sats = [q]; q.labDays = 7; v = D.vesselOf(q, 0); P.sats = []; D.satRegister(v, { day0: 0 }); const back = P.sats[0];
  check('A2: flown again and re-registered, it is the same object (id, name, its history)', back.id === q.id && back.name === q.name && back.labDays === 7, `${back.name} #${back.id}`);
  // a crewed capsule docked at a station, saved; the station flown again; the capsule undocks as a flyable vessel, crew aboard
  Object.assign(P, { sats: [], satN: 0 }); s = fly(['port', 'hab'], true); const cap = D.newShip(['port', 'crew']); Object.assign(cap, { landed: false, sas: false, throttle: 0, w: [0, 0, 0], name: 'Capsule' });
  const Y = D.qrot(s.q, [0, 1, 0]); cap.q = D.qmul(D.qaxis([0, 0, 1], Math.PI), s.q); cap.r = add(s.r, mul(Y, s.yTop + 0.05 + cap.yTop)); cap.v = add(s.v, mul(Y, -0.1)); cap.fleet = true;
  cap.rec = { launched: true, day0: 0, mini: true }; D.FLEET.push(cap); D.fleetContacts(D.DT); D.satRegister(s, s.rec); D.dockEnd(s);
  q = round(P.sats[0]); P.sats = [q]; const crewSaved = q.attached[0].e.shape.find(o => o.k === 'crew').crew;
  // (the flight's record said crewed: the capsule's crew is in the save)
  const st = D.vesselOf(q, 0); P.sats = []; D.S = st; D.FLEET.length = 0; D.undock(st, q.attached[0].e.id); const cv = D.FLEET[0];
  check('A2: a station flown again undocks its crew capsule as a flyable vessel, crew aboard', crewSaved === 2 && cv && cv.parts.some(p => p.on && p.d.kind === 'pod') && D.crewOn(cv) === 2 && !P.sats.length,
    `capsule ${cv ? cv.name : '—'}: crew ${cv ? D.crewOn(cv) : 0}; register now ${P.sats.length} entries (both are flying)`);
  // a flyable vessel of yours within 2.5 km loads into the flight; at the end it goes back on the register as itself
  Object.assign(P, { sats: [], satN: 0 }); s = fly(['core', 't1']); const near = D.newShip(['core', 't1']); Object.assign(near, { landed: false, r: add(s.r, [0, 0, 800]), v: s.v.slice() }); near.rec.launched = true;
  D.satRegister(near, { day0: 0 }); q = P.sats[0]; const nb = D.nearbyFlyable(s).length; const lv = D.loadEntry(q, s); const loaded = lv && D.FLEET.includes(lv) && !P.sats.length;
  D.fleetEnd(s.rec); const again = P.sats.length === 1 && P.sats[0].id === q.id;
  check('A2: a flyable vessel within 2.5 km loads into the flight, and goes back on the register as itself at the end', nb === 1 && loaded && again, `nearby ${nb}; loaded ${!!loaded}; back as #${P.sats[0] && P.sats[0].id}`);
  Object.assign(P, { sats: [], satN: 0 }); D.FLEET.length = 0;
}

// 32. The arm (sats session, stations plan D): grapple, berth onto a port, unload a bay, stow in a bay, release.
// Own sim instance.
{
  const D = new Function(src + 'return {toV2,newShip,geom,physStep,satRegister,satAt,armOp,armStep,armBase,armBusy,bayOp,doorF,partMass,FLEET,PROG,TELLUS,DT,qrot,qFromTo,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const T = D.TELLUS, P = D.PROG, r0 = T.R + 300e3, fnd = (n, k) => n.k === k ? n : (n.c || []).map(c => fnd(c, k)).find(Boolean);
  const vessel = (des) => { D.FLEET.length = 0; D.t = 0; Object.assign(P, { day: 0, sats: [], satN: 0 }); const s = D.newShip(des);
    Object.assign(s, { landed: false, sas: false, throttle: 0, w: [0, 0, 0], q: [0, 0, 0, 1], r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)] }); s.rec.launched = true; s.rec.day0 = 0; D.S = s; return s; };
  // a hub: a core on a tank, a side port facing +X and an arm facing −X
  const hubDes = (stack = ['core', 't2'], host = 't2') => { const d = D.toV2(stack), h = fnd(d.root, host);
    h.c.push({ k: 'rport', at: { y: 1.0, a: 0, n: 1, cy: 0.5 }, c: [] }, { k: 'arm', at: { y: 1.0, a: Math.PI, n: 1, cy: 0.3 }, c: [] }); return d; };
  const run = (s, max) => { let n = 0; while (D.armBusy(s) && n++ < max) { D.physStep(s, D.DT); D.armStep(s); } return n * D.DT; };
  const W = (s, x) => add(s.r, D.qrot(s.q, sub(x, s.cm)));
  // a lab module 4 m off the arm's side, drifting with us: grapple it, then berth it on the side port
  let s = vessel(hubDes()); const armP = s.parts.find(p => p.d.kind === 'arm'), base = W(s, D.armBase(armP).P);
  let k = D.newShip(['port', 'lab']); Object.assign(k, { landed: false, r: add(base, [0, 0, 0]), v: s.v.slice() }); k.r = add(base, [-4, 0, 0]); k.q = D.qFromTo([0, 1, 0], [0, 0, 1]); k.rec.launched = true;
  D.satRegister(k, { day0: 0 }); const q = P.sats[0], grabbed = D.armOp(s, 'grab'), a = s.att[0];
  // the arm moving it: our own parts move the other way, in proportion to the masses (the centre of mass stays put)
  D.armOp(s, 'berth'); const hp = s.parts.find(p => p.d.key === 't2'), h0 = W(s, hp.pos), g0 = W(s, a.p); D.armStep(s); const dh = sub(W(s, hp.pos), h0), dg = sub(W(s, a.p), g0);
  const ratio = len(dh) / len(dg), want = a.e.mass / (s.mass - a.e.mass);
  const took = run(s, 1e5), done = a.kind === 'port' && !a.goal;
  const rp = s.parts.find(p => p.d.key === 'rport'), face = [rp.pos[0] + 0.3, rp.y0 + rp.h / 2, rp.pos[2]], mp = a.e.shape.find(o => o.k === 'port'), mface = add(a.p, D.qrot(a.q, sub([mp.pos[0], mp.y0 + mp.h, mp.pos[2]], a.e.cm)));
  check('arm: grapples a module and berths it onto a side port; it latches as a docking, faces together', grabbed && a.e === q && done && len(sub(mface, face)) < 1e-6,
    `${a.e.name}: ${a.kind}, faces ${len(sub(mface, face)).toExponential(1)} m apart, ${took.toFixed(0)} s at 0.15 m/s`);
  check('arm: while it carries something, the rest of the stack moves the other way in proportion (centre of mass fixed)', Math.abs(ratio - want) < 1e-6 && dot(dh, dg) < 0,
    `hub moved ${(len(dh) * 1000).toFixed(3)} mm for the module's ${(len(dg) * 1000).toFixed(1)} mm: ${ratio.toFixed(5)} vs mass ratio ${want.toFixed(5)}`);
  // out of reach: 20 m away, nothing doing
  s = vessel(hubDes()); k = D.newShip(['port', 'lab']); Object.assign(k, { landed: false, r: add(s.r, [-20, 0, 0]), v: s.v.slice() }); k.rec.launched = true; D.satRegister(k, { day0: 0 });
  check('arm: a module 20 m away is out of reach', !D.armOp(s, 'grab') && !s.att.length, 'refused');
  // a carrier with a bay: a payload (with a port) on its floor; open the doors, the arm takes it out and berths it on the side port
  const carrier = () => { const d = hubDes(['port', 'core', 't1', 'bay', 'pod', 't2'], 't2'); return vessel(d); };
  s = carrier(); D.bayOp(s, 'open'); for (let i = 0; i < 2.1 / D.DT; i++) D.physStep(s, D.DT);
  const took2 = D.armOp(s, 'grab'), held = s.att[0], fromBay = held && held.e.shape.some(o => o.k === 'core') && !D.FLEET.length && !s.parts.some(p => p.on && p.inBay);
  D.armOp(s, 'berth'); run(s, 1e5);
  check('arm: takes the payload out of its own open bay and berths it on the side port', took2 && fromBay && held.kind === 'port', `${held ? held.e.name + ' ' + held.kind : 'nothing'}`);
  // and the way home: a fresh carrier; take the payload out, release it (no push), grapple it again, stow it back in the bay
  s = carrier(); D.bayOp(s, 'open'); for (let i = 0; i < 2.1 / D.DT; i++) D.physStep(s, D.DT); D.armOp(s, 'grab'); D.armOp(s, 'free'); const relV = D.FLEET.length ? len(sub(D.FLEET[0].v, s.v)) : NaN;
  const freed = s.att.length === 0 && D.FLEET.length === 1; D.armOp(s, 'grab'); const back = s.att[0], st = D.armOp(s, 'stow'); run(s, 1e5);
  const bay = s.parts.find(p => p.d.kind === 'bay'), core = back && back.e.shape.find(o => o.k === 'port'), low = back ? Math.min(...back.e.shape.map(o => o.y0)) : 0, baseY = back ? back.p[1] - back.e.cm[1] + low : NaN;
  check('arm: release lets go without a push; grappled again, it stows back in the bay on the floor', freed && relV < 1e-9 && st && back.kind === 'bay' && Math.abs(baseY - (bay.y0 + bay.h)) < 1e-6,
    `released at ${relV.toExponential(1)} m/s; stowed: ${back ? back.kind : '—'}, its base ${(baseY - (bay.y0 + bay.h)).toExponential(1)} m off the floor`);
  Object.assign(P, { sats: [], satN: 0 }); D.FLEET.length = 0;
}

// 33. Moonbases (sats session, stations plan E): landed objects persist in a body's frame, fly again from the surface,
// a beacon makes a base, the base works between flights, landed modules are immovable for contact. Own sim instance.
{
  const D = new Function(src + 'return {newShip,stage,geom,physStep,contactStep,syncLanded,satRegister,vesselOf,landedUp,satsUp,baseOf,baseOfMember,stationTick,advanceDays,tgtOf,groundR,toPF,SELENE,PROG,TELLUS,DT,qrot,qFromTo,qaxis,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const B = D.SELENE, P = D.PROG;
  Object.assign(P, { day: 0, sats: [], satN: 0, labDays: 0 });
  // a vessel standing upright on Selene `along` metres east of the reference point (on the equator, at +X)
  const land = (stack, along = 0, crewed = false) => { D.t = 0; const s = D.newShip(stack), a = along / B.R, u = [Math.cos(a), 0, -Math.sin(a)];
    Object.assign(s, { body: B, landed: true, alive: true, sas: false, throttle: 0 }); s.pf = mul(u, D.groundR(B, mul(u, B.R)) - s.yBot); s.qLocal = D.qFromTo([0, 1, 0], u);
    D.syncLanded(s); Object.assign(s.rec, { launched: true, day0: 0, crewed, crewOK: true }); D.S = s; return s; };
  // a beacon lander: registered in Selene's frame, as a base
  let s = land(['beacon', 'core', 't1', 'sparrow']); D.satRegister(s, s.rec); let q = P.sats[0];
  check('moonbase: a vessel that ends its flight on Selene is saved in Selene\'s frame (and as a base, with a beacon)', q && q.landed && q.bodyName === 'Selene' && q.beacon && len(sub(q.pf, s.pf)) < 1e-9 && !D.satsUp().length && D.landedUp().length === 1,
    `${q ? q.name : '—'}; orbit-only lists see ${D.satsUp().length}, the surface list ${D.landedUp().length}`);
  // flown again: it starts on the surface, where it was, and lifts off under power
  const v = D.vesselOf(q, 0); D.S = v; const at = v.landed && v.body === B && len(sub(v.pf, q.pf)) < 1e-9;
  D.stage(v); v.throttle = 1; for (let i = 0; i < 50 && v.landed; i++) D.physStep(v, D.DT); v.throttle = 0;
  check('moonbase: flown again, it starts on the surface where it stood, and lifts off', at && !v.landed && v.alive, `took off: ${!v.landed}`);
  // a base: a habitat 200 m away, a lab 300 m, a crewed capsule 100 m, and a habitat 2 km off (not part of it)
  for (const [stack, x, c] of [[['hab', 'core'], 200], [['lab', 'core'], 300], [['crew'], 100, true], [['hab', 'core'], 2000]]) { const m = land(stack, x, c); D.satRegister(m, m.rec); }
  const st = D.baseOf(q), far = P.sats.find(x => x.landed && !D.baseOfMember(x));
  check('moonbase: everything landed within 500 m of the beacon is the base (a habitat 2 km off is not)', st.members.length === 4 && st.berths === 3 && st.crew === 2 && st.labs === 1 && far,
    `${st.members.length} members: ${st.berths} berths, crew ${st.crew}, ${st.labs} lab; outside: ${far ? far.name : '—'}`);
  D.stationTick(10); const lab = q.labDays, sup = D.baseOf(q).sup; D.advanceDays(1);
  check('moonbase: between flights the base works like a station (supplies used, lab-days earned), orbit code unbothered', Math.abs(lab - 20) < 1e-9 && Math.abs(sup - 0.2) < 1e-9, `${lab.toFixed(0)} lab-days, ${(sup * 1000).toFixed(0)} kg of supplies left; a further day passed without error`);
  // landing on a module: a capsule coming down onto the habitat at 1 m/s bounces off it; the habitat doesn't move
  const hab = P.sats.find(x => x.landed && x.shape.some(o => o.k === 'hab') && D.baseOfMember(x)), pf0 = hab.pf.slice();
  const c = D.newShip(['pod']); D.t = 0; const up = norm(hab.pf), top = D.groundR(B, mul(up, B.R)) + 3.2 + 0.25 + 0.05 - c.yBot;
  Object.assign(c, { body: B, landed: false, alive: true, sas: false, throttle: 0, w: [0, 0, 0], q: D.qFromTo([0, 1, 0], up), r: mul(up, top), v: mul(up, -1) }); c.rec.launched = true; D.S = c;
  for (let i = 0; i < 30 && dot(c.v, up) < 0; i++) { D.physStep(c, D.DT); D.contactStep(c, D.DT); }
  check('moonbase: a capsule landing on a module bounces off it; the module stays put', dot(c.v, up) > 0 && len(sub(hab.pf, pf0)) === 0 && c.alive, `rebounds at ${dot(c.v, up).toFixed(2)} m/s; module moved ${len(sub(hab.pf, pf0))} m`);
  // a landed object as the target: the landing guidance has a distance to work with
  c.target = q.id; const T = D.tgtOf(c);
  check('moonbase: a base can be the target of a landing', T && T.landed && T.q === q && len(T.dr) > 100, `${T ? T.q.name + ' at ' + (len(T.dr) / 1000).toFixed(2) + ' km' : 'no target'}`);
  Object.assign(P, { sats: [], satN: 0, labDays: 0 });
}

// 34. Rovers (sats session, rovers plan R1): the designer's figures, and the wheel-contact rover in the test yard beside
// the pad. Own sim instance.
{
  const D = new Function(src + 'return {rvNew,rvRun,rvStats,rvDefault,rvTilt,rvFold,rvCrr,yardOf,yardPF,SITES,TELLUS,RV_GS,SURF_MOON,HOOK,PROG};')();
  const msgs = []; D.HOOK.msg = m => msgs.push(m);
  const Y = D.yardOf(D.SITES[0]), lrv = D.rvDefault(), st = D.rvStats(lrv), D2R = Math.PI / 180;
  const at = (d, x, z, o = {}, h = 0, head = Y.n) => D.rvNew(d, D.TELLUS, D.yardPF(Y, x, z, h), head, { yard: Y, ...o });
  const run = (R, s) => { for (let i = 0; i < s * 10; i++) D.rvRun(R, 0.1); return R; };
  const up = R => len(R.p) - D.TELLUS.R - D.SITES[0].h;
  // on paper: a lunar-rover-sized crewed rover can barely climb at home (its hub motors are sized for a sixth of the
  // weight); at Selene's gravity the ground's grip is the limit; and a full-lock turn tips or slides at a lower speed there
  const tr = Math.atan(D.SURF_MOON.mu - D.rvCrr(D.SURF_MOON, 0.41)) / D2R;
  check('rover stats: the crewed rover climbs little at home (motors), at Selene up to its grip; turns are slower there',
    st.T.lim === 'motors' && st.T.climb < 10 && st.S.lim === 'traction' && Math.abs(st.S.climb - tr) < 0.2 && st.S.vTurn < st.T.vTurn / 2,
    `Tellus ${st.T.climb.toFixed(1)}° (${st.T.lim}), Selene ${st.S.climb.toFixed(1)}° (${st.S.lim}); full-lock turn ${st.T.turnBy} above ${st.T.vTurn.toFixed(1)} / ${st.S.vTurn.toFixed(1)} m/s`);
  // parked on the level: it settles still, its centre of mass where the designer says, and holds there
  let R = run(at(lrv, -20, -6), 4); const p0 = R.p.slice(); run(R, 5);
  check('rover: parked on the level it settles where the designer says and stays put', len(R.v) < 1e-4 && len(sub(R.p, p0)) < 1e-3 && Math.abs(up(R) - st.T.h) < 0.03,
    `centre of mass ${up(R).toFixed(3)} m up (designer ${st.T.h.toFixed(3)}), drifted ${(len(sub(R.p, p0)) * 1000).toFixed(2)} mm in 5 s`);
  // flat out on the levelled grass beside the pad (away from the ramps): the top speed the designer gave
  R = at(lrv, -20, -6, {}, 0, mul(Y.n, -1)); R.in.thr = 1; run(R, 15);
  check('rover: flat out on grass it reaches the designer\'s top speed', Math.abs(len(R.v) - st.T.vTop) < 0.05 * st.T.vTop && R.su.name === 'levelled grass',
    `${len(R.v).toFixed(2)} m/s (designer ${st.T.vTop.toFixed(2)}), on ${R.su.name}`);
  // the 20° ramp: at home it stalls partway; as a lunar trainer it gets to the top
  const climb = gk => { const R = at(lrv, 0, 0, { gk }); R.in.thr = 1; let mh = 0; for (let i = 0; i < 300; i++) { D.rvRun(R, 0.1); mh = Math.max(mh, up(R)); } return mh - up(at(lrv, 0, 0, { gk })); };
  const hT = climb(1), hS = climb(D.RV_GS);
  check('rover: the 20° ramp (2.5 m) stalls it at home; the lunar trainer gets to the top', hT < 1.5 && hS > 2.4, `rose ${hT.toFixed(2)} m at home, ${hS.toFixed(2)} m as a trainer`);
  // parked across the side slopes: the 20° one holds it; the 35° one is steeper than gravel's grip (33°), so it slides
  const park = (d, x) => { const R = run(at(d, x, 40, {}, 3), 2), a = R.p.slice(); run(R, 5); return { R, moved: len(sub(R.p, a)) }; };
  const s20 = park(lrv, 39.5), s35 = park(lrv, 58);
  check('rover: parked across a 20° slope it holds; across 35° (past the gravel\'s grip) it slides', s20.moved < 0.01 && s35.moved > 0.05 && !s35.R.tipped,
    `${(s20.moved * 1000).toFixed(1)} mm and ${(s35.moved * 100).toFixed(0)} cm in 5 s; roll ${D.rvTilt(s20.R).roll.toFixed(0)}° and ${D.rvTilt(s35.R).roll.toFixed(0)}°`);
  // a top-heavy rover (three crew on a small chassis) tips over on the 35° slope; a low one doesn't. Nothing rights it.
  const tall = { name: 'tall', ch: 's', wh: 's', n: 4, spr: 'T', slots: ['seat', 'seat', 'seat'] }, low = { name: 'low', ch: 's', wh: 's', n: 4, spr: 'T', slots: ['ant', 'ant', 'drill'] };
  msgs.length = 0; const tT = run(park(tall, 58).R, 3), tL = park(low, 58).R;
  check('rover: top-heavy, it tips over on the 35° slope and stays over; a low one stays on its wheels', tT.tipped && tT.rec.tips === 1 && msgs.includes('Tipped over') && !tL.tipped,
    `tips sideways at ${D.rvStats(tall).T.tipSide.toFixed(0)}° on paper (the springs lean it further) and ${D.rvStats(low).T.tipSide.toFixed(0)}°`);
  // no battery, no drive; a drive's record goes to the design and to the wheels' tested distance
  R = at({ ...lrv, slots: ['seat', 'seat', null, 'cam', null] }, -20, -6, {}, 0, mul(Y.n, -1)); R.in.thr = 1; run(R, 3);
  const d = JSON.parse(JSON.stringify(lrv)), R2 = at(d, -20, -6, {}, 0, mul(Y.n, -1)); R2.in.thr = 1; run(R2, 10); const km = R2.rec.dist / 1000, w0 = (D.PROG.wheelKm || {}).m || 0; D.rvFold(R2);
  check('rover: without a battery it can\'t drive; a test drive\'s record goes to the design and the wheels', len(R.v) < 0.01 && Math.abs(d.test.T.km - km) < 1e-9 && Math.abs(D.PROG.wheelKm.m - w0 - km) < 1e-9 && d.test.T.vmax > 2,
    `${(km * 1000).toFixed(0)} m driven, ${d.test.T.vmax.toFixed(2)} m/s`);
}

function moonPos(t) { return api.moonPos(t); }
console.log(log.slice(0, 12).join('\n'));
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
