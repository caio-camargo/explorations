// Headless checks for Launchpad's simulation core. Run: node test.mjs
// Extracts the "SIM BEGIN … SIM END" block from index.html and drives it with no DOM or GL.
import { readFileSync } from 'node:fs';
import { pageSource, pageScripts } from './page.mjs';
import { crewLunar } from './fly_crewlunar.mjs';
import { flyLadder, handAscent, flySite, siteOf } from './fly_ladder.mjs';
// shards (platform session): `node test.mjs --list | --only 12,docking | --smoke | --times`, see shards.mjs
if (process.argv.length > 2) process.exit(await (await import('./shards.mjs')).main(process.argv.slice(2), import.meta.url));
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `
return {nodePlan,nodePlanEnd,nodeAddNext,nodeNext,nodeLead,nodeBurnTime,soiSwitch,satLife,surfacePick,procWithSite,procLandsOn,sitePlace,autoLegs,launchWarnings,flightAims,dvToAlt,DV_ORBIT_EST,stageStats,nextStep,footPoints,legOp,legsDown,tapeLegs,toV2,powerStep,powerRails,powerBudget,eclFrac,inShadow,powCap,powLoad,avOf,avCap,hasComputer,AV,wingOp,wingsOut,tapeWings,get TEST(){return TEST},get PROG(){return PROG},compEra,khOn,advPhys,advRails,get DEBRIEF_LAST(){return DEBRIEF_LAST},debriefOf,nextStep,siteAt,PLASMA_V,plasmaOn,BLACKOUT_Q,ATLAS,atlasBake,atlasU,atlasXY,atlasAt,flightLeave:typeof flightLeave==='function'?flightLeave:null,engAcc,procFly,dispatchRun,procAdopt,orderBaseRun,baseRunQuote,baseRunLine,dispatchTick,baseOf,landedUp,orderDryRun,dryQuote,dispatchLine,PROV_UNC,FLEET,get ORB_T0(){return ORB_T0},ctrlAuthority,ctrlAuthRoll,activeEngines,missionTick,missionComplete,dispatchEstimate,dispatchQuote,orderDispatch,padWait,padsFree,procKey,stagePaid,upcoming,nextEvent,advanceTo,acceptOffer,COMP_ERAS,compLag,compEra,worldEra,compYear,predErr,studyQuote,orderStudy,studyWait,studyKey,studyOf,predictImpact,FAC,facLv,buildFac,fleetSalvage,devLv,devQuote,startDev,devPriceK,wearOf,buildStand,startTest,testQuote,standReady,STAND_COST,prodLine,prodLineK,prodQuote,startProdLine,prodUnits,khVessel,khYield,khUse,khBar,use0,khLearn,igniteOK,khOn,OPS_FIX,OPS_FRAC,SITES,siteById,curSite,homeSite,homeSites,siteAccessOf,siteFits,siteFrame,terrainH,terrainSlope,SITE_GAP,PAD_FLAT,tapeNew,toolOK,TOOLS,eraOf,designName,LOGF,sourceOf,tierOf,indOf,cert0,IMPORT_K,GREY_K,cancelProgram,demandMet,flav,ARCH,natOf,moneyK,failHit,flavTick,sanction,sanctioned,offerRisk,RIVALS,RACE,raceLost,LEAK_P,genOffer,contractEval,chooseStart,own,stateShare,ownKind,floorCheck,offerDecision,resolveDecision,income,valuation,pickClient,rng,acceptOffer,CT,capOf,ensureBoard,standOf,GRANT_100,wearOf,makePowers,POWERS,powerAt,relOf,opOf,advanceDays,DAY_S,prepDays,HOME,vesselCost,FUNDS0,FUNDS_FLOOR,REFURB,advPhys,advRails,PROG,MISSIONS,missionEnd,missionDrop,safetyReview,certOf,atmU,G_LIM,CERT0,CITIES,landValue,isLand,dropVerdict,debrisImpact,fall,surfVelX:null,predictImpact,tapePhys,tapeRails,tapeStage,tapePlay,tapeDuration,toPF,railsOK,segFuel,stageStats,partMass,PARTS,analyze,nodeInfo,nodeBurnTime,predictFrom,dvPlan,kepler,elements,timeToNu,predict,newShip,physStep,rails,stage,dvRemaining,localFrame,qFromBasis,qrot,cross,norm,len,sub,add,mul,dot,probe,firstSeg,geom,INP,surfVel,SND,buildStation,gsCheck,stationsAll,GS_LEASE,pairKey,satAt,absTh,cloudAt,sunUp,relBase,siteWeather,weatherHold,downrangeWarning,SEA_DECK,SCRUB_MAX,alongAz,SURF_MOON,SURF,BIOMES,surfaceAt,surfaceHit,biomeAt,groundAlt,TOPPLE,groundGap,aglAt,MAIN_AGL,fromPF,density,HAZ,disCities,cityGround,fieldBiomes,polarKm,recoveryOf,gsMask,gsSees,linkOf,devState,loseDeviation,vesselOf,dispatchRoll,
  badness,careerMove,get home(){return HOME},resetHome(){HOME=0;RIVALS=raceSchedule()},
  TELLUS,SELENE,NYX,BODIES,soiAt,bodyRel,bodyPos,MISSIONS,SUN_DIR,advRails,satRegister,utilTick,navCover,capital,STAT_R,isTV,rotY,abort,activeEngines,procStart,procKey,TAPE_V,PRESETS,HOOK,moonPos,moonVel,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v},DT};`)();
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
  // (platform) the world's dice and the cycle's phase pinned: they were whatever earlier sections left, so run alone this failed
  fresh(); P.homeArch = 'frugal'; P.day = 0; P.wseed = 4242; P.cyc = Math.PI / 2; P.op = {}; P.op[api.HOME] = 75; const f2 = P.funds; api.advanceDays(100.5); P.homeArch = null;   // a tax-funded home
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
  // (platform) every PROG key cleared first: fields earlier sections left (the cycle's phase, recent bailouts…) changed the outcome
  const fresh = () => { api.resetHome(); for (const k of Object.keys(P)) delete P[k]; Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: 60, bailouts: 0, day: 0, rel: {}, op: {}, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], sanc: {}, home: 0, history: [] }); };
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
  const P = api.PROG, { NYX, bodyRel, SUN_DIR } = api, saved = JSON.stringify(P);
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
  const land = (b, u, stack, done, h) => { reset(done); const c = craft(stack, b, [0, 0, 0], [0, 0, 0], 0); c.r = mul(u, b.R - c.yBot + h); c.v = api.surfVel(b, c.r); upright(c); let n = 0; while (!c.landed && c.alive && n++ < 5000) api.advPhys(c); for (let k = 0; k < 5; k++) api.advPhys(c); return c; };
  const hard = land(SELENE, toT(0), ['ant', 'sci', 't2', 'petrel'], ['beeper', 'farside', 'selimp'], 10), hardV = hard.touchV, hardOK = !!P.done.selland;
  s = land(SELENE, toT(0), ['ant', 'sci', 't2', 'petrel'], ['beeper', 'farside', 'selimp'], 3);
  const sampleOK = api.MISSIONS.find(m => m.id === 'selsample').ok({ ...s.rec, landed: true, recSci: true });
  check('out there: a soft landing on Selene\'s near side phones home (a 10 m drop is too hard); a recovered sample would complete a return', !!P.done.selland && s.rec.selSampled && sampleOK && hard.landed && !hardOK,
    `from 3 m: ${(s.touchV || 0).toFixed(1)} m/s, done; from 10 m: ${(hardV || 0).toFixed(1)} m/s, ${hardOK ? 'done (wrong)' : 'not counted'}`);
  // Nyx: weighed by tracking a craft where its pull matters (high orbit around Nyx's periapsis time)
  const P_N = 2 * Math.PI / NYX.n, tPe = (2 * Math.PI - NYX.orb.M0) / NYX.n + P_N, r30 = 3.0e7;
  // economy: only a flight launched while nyxfind is open is tracked (rec.nyxLook, set at launch); craft() skips the
  // launch, so first check the launch sets it, then fly the same high orbit unlooked (nothing found) and looked
  const looks = done => { reset(done); api.t = 0; const L = api.newShip(['ant', 'sci', 't2', 'petrel']); api.S = L; L.landed = false; api.missionTick(L, 0, false); return !!L.rec.nyxLook; };
  const lookOpen = looks(['beeper', 'farside']), lookShut = looks(['beeper']);
  const highOrbit = look => { reset(['beeper', 'farside']); const c = craft(['ant', 'sci', 't2', 'petrel'], TELLUS, [r30, 0, 0], [0, 0, -Math.sqrt(TELLUS.mu / r30)], tPe - 6 * 3600); c.rec.nyxLook = look;
    while (api.t < tPe + 10 * 3600 && !P.done.nyxfind) api.advRails(c, 600, 1000); return c; };
  const blind = highOrbit(false), blindFound = !!P.done.nyxfind;
  check('out there: Nyx is tracked only on a flight launched while "Something out there" is open (the farside flight can\'t find it in passing)', lookOpen && !lookShut && !blindFound && !blind.rec.nyxTrack,
    `launch sets nyxLook: open ${lookOpen}, before farside ${lookShut}; same orbit unlooked: ${blindFound ? 'found (wrong)' : 'not found'}`);
  s = highOrbit(true);
  check('out there: Nyx is weighed from tracking residuals (12 h where its pull is ≥ 1e-3 of Tellus\'s) and enters the logbook', !!P.done.nyxfind && !!P.log.nyx,
    `found after ${((s.rec.nyxTrack || 0) / 3600).toFixed(1)} h of tracking; logbook: ${P.log.nyx ? 'm/M ' + P.log.nyx.v.m.toExponential(2) : '—'}`);
  // economy's pay floor: every epoch 4–5 first pays at least 1.3× the full launch cost (vehicle + operations, fresh program)
  // of the preset proven to fly it (fly_ladder.mjs; the Crewed Lunar flight). NOTES "Nyx is found by looking; the pay floor"
  { const full = pre => { const c = api.vesselCost(api.newShip(api.PRESETS[pre]).parts).cost; return c + api.OPS_FIX + api.OPS_FRAC * c; };
    const VEH = { farside: 'Probe', selimp: 'Probe', selland: 'Probe', nyxfind: 'Probe', nyxfly: 'Probe', nyxorb: 'Probe', nyxland: 'Probe', selsample: 'Sample Return', crewaround: 'Crewed Lunar', crewland: 'Crewed Lunar' };
    const low = Object.entries(VEH).map(([id, pre]) => [id, api.MISSIONS.find(m => m.id === id).pay / full(pre)]).filter(([, x]) => x < 1.3);
    check('economy: every Selene and Nyx first pays at least 1.3× the full cost of the rocket proven to fly it', !low.length,
      low.length ? low.map(([id, x]) => `${id} ${x.toFixed(2)}×`).join(', ') : `Probe ${full('Probe').toFixed(0)}M, Sample Return ${full('Sample Return').toFixed(0)}M, Crewed Lunar ${full('Crewed Lunar').toFixed(0)}M`); }
  // an orbit that lasts: retrograde survives two Nyx orbits, prograde is wrecked
  const tAp = (Math.PI - NYX.orb.M0) / NYX.n, [mA, vA] = bodyRel(NYX, tAp), hn = norm(cross(mA, vA)), ux = norm(mA), uy = cross(hn, ux), rr = NYX.R + 200e3;
  const orbitNyx = dir => { reset(['beeper', 'farside', 'nyxfind', 'nyxfly']); P.log.nyx = { v: { m: 1, pe: 1, ap: 1 } }; const c = craft(['sci', 't2', 'petrel'], NYX, mul(ux, rr), mul(uy, dir * Math.sqrt(NYX.mu / rr)), tAp);
    while (api.t < tAp + 2.05 * P_N && c.alive && !P.done.nyxorb) { if (api.railsOK(c)) api.advRails(c, 600, 1000); else api.advPhys(c); } return { ok: !!P.done.nyxorb, alive: c.alive, h: (c.rec.nyxOrbT || 0) / 3600 }; };
  const ret = orbitNyx(-1), pro = orbitNyx(1);
  check('out there: "an orbit that lasts" around Nyx: retrograde does it, prograde is wrecked first', ret.ok && !pro.ok, `retrograde ${ret.h.toFixed(0)} h (done ${ret.ok}); prograde ${pro.h.toFixed(0)} h, ${pro.alive ? 'still up' : 'crashed'}`);
  // landing on Nyx
  s = land(NYX, norm([0.3, 0.9, 0.2]), ['sci', 't2', 'petrel'], ['beeper', 'farside', 'nyxfind', 'nyxfly'], 5);
  check('out there: landing on Nyx under 3 m/s', !!P.done.nyxland && !!P.log.nyxland, `touchdown ${(s.touchV || 0).toFixed(2)} m/s`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));   // the whole program state back api.HOOK.news = () => {};
}

// 24. Epoch 3, satellites that work (bodies session): weather, TV for the capital, disaster watch, navigation.
{
  const P = api.PROG, saved = JSON.stringify(P);
  const news = []; api.HOOK.news = m => news.push(m); api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  const reset = done => { P.done = Object.fromEntries(done.map(k => [k, { flight: 0, day: 0 }])); P.log = {}; P.active = []; P.offers = []; P.funds = 1000; P.sats = []; P.satN = 0; P.day = 10; P.disDone = []; };
  const craft = (stack, r, v) => { api.t = 0; const s = api.newShip(stack); api.S = s; s.landed = false; s.body = TELLUS; s.r = r; s.v = v; s.throttle = 0; s.rec.launched = true; s.rec.dv = 5000; s.rec.day0 = P.day; return s; };
  const rot = (v, inc) => [v[0], v[1] * Math.cos(inc) - v[2] * Math.sin(inc), v[1] * Math.sin(inc) + v[2] * Math.cos(inc)];   // tilt about +X
  const orbit = (alt, incDeg, ph = 0) => { const r = TELLUS.R + alt, v = Math.sqrt(TELLUS.mu / r), i = incDeg * Math.PI / 180;
    return [rot([r * Math.cos(ph), 0, -r * Math.sin(ph)], i), rot([-v * Math.sin(ph), 0, -v * Math.cos(ph)], i)]; };
  // weather: polar counts, equatorial doesn't
  reset(['beeper']); let [r, v] = orbit(300e3, 90); let s = craft(['ant', 'cam', 't2', 'petrel'], r, v); api.advRails(s, 60, 100); const polar = !!P.done.wxsat;
  reset(['beeper']); [r, v] = orbit(300e3, 0); s = craft(['ant', 'cam', 't2', 'petrel'], r, v); api.advRails(s, 60, 100); const eq = !!P.done.wxsat;
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
  reset(['beeper', 'wxsat']); [r, v] = orbit(300e3, 90); s = craft(['ant', 'cam', 't2', 'petrel'], r, v); api.satRegister(s, s.rec);
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
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));   // the whole program state back: later sections see what they would have without this one api.HOOK.news = () => {};
}

// 25. Crew (bodies session, epoch 4): the escape tower, abort tests, then people. Flown through the real flight code.
{
  const P = api.PROG, saved = JSON.stringify(P);
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
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));   // the whole program state back: later sections see what they would have without this one api.HOOK.news = () => {}; api.HOOK.msg = m => log.push(`[t=${api.t.toFixed(1)}] ${m}`);
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
  const P = api.PROG, saved = JSON.stringify(P), H = { ...api.HOOK };
  const R = crewLunar(api);
  check('Crewed Lunar flies a crew to Selene and home: a soft landing there, one clean entry here, crew fine, "Crew on Selene" done',
    R.done && R.home && R.crewed && R.crewOK && R.landing.landed && R.landing.v < 4 && R.landing.tilt < 10 && R.passes.length === 1 && R.g < 8 && R.days < 10,
    `orbit with ${R.orbit.left.map(x => x.toFixed(0)).join('/')} m/s left, cabin ${R.orbit.cabin.toFixed(0)} K · corrections ${R.mcc.toFixed(0)} + ${R.retCorr.toFixed(0)} m/s · landed at ${R.landing.v.toFixed(1)} m/s with ${R.landing.left.map(x => x.toFixed(0)).join('/')} left · ` +
    `back in Selene orbit with ${R.ascent.left.map(x => x.toFixed(0)).join('/')} · ${R.passes.length} entry pass · splashdown ${R.touch.toFixed(1)} m/s, peak ${R.g.toFixed(1)} g, cabin ${R.cabin.toFixed(0)} K, ${R.days.toFixed(1)} days`);
  // the same flight, recorded, becomes a mission procedure; the executor flies it through SAS, and the better run replaces it
  const key = api.procKey(api.PRESETS['Crewed Lunar']) + '|Selene:land', ext = P.procs && P.procs[key], ph = ext ? Object.fromEntries(ext.phases.map(x => [x.k, x])) : {};
  check('procedures v2: the flown mission is recorded as a "Selene land" procedure (transfer, capture, land, surface, ascend, return)',
    !!ext && ext.phases.map(x => x.k).join() === 'transfer,capture,land,surface,ascend,return' && Math.abs(ph.transfer.pass - 40e3) < 3e3 && ph.return.perigee > 30e3 && ph.return.perigee < 60e3,
    ext ? `pass ${(ph.transfer.pass / 1e3).toFixed(1)} km, capture ${(ph.capture.pe / 1e3).toFixed(0)}×${(ph.capture.ap / 1e3).toFixed(0)} km, ascend to ${(ph.ascend.pe / 1e3).toFixed(0)}×${(ph.ascend.ap / 1e3).toFixed(0)}, return perigee ${(ph.return.perigee / 1e3).toFixed(1)} km; ${ext.dv.toFixed(0)} m/s in all` : 'none');
  if (ext) { P.done = Object.fromEntries(['beeper', 'orbiter', 'padabort', 'maxqabort', 'farside', 'selimp', 'selland', 'crewaround'].map(k => [k, { flight: 0, day: 0 }])); const dv0 = ext.dv;
    api.t = 0; const s = api.newShip(api.PRESETS['Crewed Lunar']); api.S = s; api.advPhys(s); api.procStart(s, ext); let k = 0;
    while (s.alive && !s.proc.done && k++ < 3e6) { const X = s.proc; if (X.wake > api.t + 2 && api.railsOK(s)) api.advRails(s, Math.min(600, X.wake - api.t), 1000); else api.advPhys(s); }
    const Rp = s.rec, now = P.procs[key];
    check('procedures v2: the executor flies it end to end through SAS: crew on Selene and home safe; a cheaper run replaces the procedure',
      s.alive && s.landed && s.body === TELLUS && Rp.crewed && Rp.crewOK && !!P.done.crewland && now && now.dv <= dv0 && s.proc && s.proc.miss < 500,
      `back on the recorded spot (${s.proc && s.proc.miss != null ? s.proc.miss.toFixed(0) : '?'} m off); ${(api.t / 86400).toFixed(2)} days, peak ${(Rp.cgMax || 0).toFixed(1)} g, splashdown ${(s.touchV || 0).toFixed(1)} m/s; ${Rp.dv.toFixed(0)} m/s in all (procedure ${dv0.toFixed(0)} → ${now ? now.dv.toFixed(0) : '?'})`); }
  // the same phases to Nyx (inclined 30°, eccentric): met at its far node, landed on, and home, with the recorded ascent
  { const asc = P.procs && P.procs[api.procKey(api.PRESETS['Crewed Lunar'])];
    if (asc) { const nyx = { ...asc, phases: [{ k: 'transfer', to: 'Nyx', pass: 100e3 }, { k: 'capture', ap: 300e3, pe: 40e3 }, { k: 'land' }, { k: 'surface', t: 600 }, { k: 'ascend', stage: 0, pitchH: 2000, ap: 30e3, pe: 20e3 }, { k: 'return', perigee: 45e3 }] };
      api.t = 0; const s = api.newShip(api.PRESETS['Crewed Lunar']); api.S = s; api.advPhys(s); api.procStart(s, nyx); let k = 0, onNyx = false, vNyx = null;
      while (s.alive && !s.proc.done && k++ < 3e6) { const X = s.proc; if (X.wake > api.t + 2 && api.railsOK(s)) api.advRails(s, Math.min(600, X.wake - api.t), 1000); else api.advPhys(s); if (s.landed && s.body === api.NYX && !onNyx) { onNyx = true; vNyx = s.touchV; } }
      const Rn = s.rec, kept = P.procs[api.procKey(api.PRESETS['Crewed Lunar']) + '|Nyx:land'];
      check('procedures v2: the same phases fly a crew to Nyx (met at its node, landed on) and home within the air supply, and record a "Nyx land" procedure',
        onNyx && vNyx < 4 && s.alive && s.landed && s.body === TELLUS && Rn.crewOK && api.t < 10 * 86400 && !!kept,
        `landed on Nyx at ${vNyx != null ? vNyx.toFixed(1) : '—'} m/s; home in ${(api.t / 86400).toFixed(2)} days, peak ${(Rn.cgMax || 0).toFixed(1)} g, splashdown ${(s.touchV || 0).toFixed(1)} m/s; ${Rn.dv.toFixed(0)} m/s in all`); } }
  // a free return (transfer, then home): "Crew around Selene"; recorded as a flyby at the SOI exit and a free return at home
  { const asc = P.procs && P.procs[api.procKey(api.PRESETS['Crewed Lunar'])];
    if (asc) { P.done = Object.fromEntries(['beeper', 'orbiter', 'padabort', 'maxqabort', 'farside'].map(k => [k, { flight: 0, day: 0 }]));
      const fr = { ...asc, phases: [{ k: 'transfer', to: 'Selene', pass: 400e3 }, { k: 'home', perigee: 45e3 }] }, base = api.procKey(api.PRESETS['Crewed Lunar']);
      api.t = 0; const s = api.newShip(api.PRESETS['Crewed Lunar']); api.S = s; api.advPhys(s); api.procStart(s, fr); let k = 0;
      while (s.alive && !s.proc.done && k++ < 3e6) { const X = s.proc; if (X.wake > api.t + 2 && api.railsOK(s)) api.advRails(s, Math.min(600, X.wake - api.t), 1000); else api.advPhys(s); }
      const Rf = s.rec, fb = P.procs[base + '|Selene:flyby'], frp = P.procs[base + '|Selene:free-return'];
      check('procedures v2: a free return (transfer, then home) flies "Crew around Selene", and is recorded as a flyby and a free-return procedure',
        !!P.done.crewaround && Rf.crewOK && s.landed && s.body === TELLUS && !!fb && !!frp && frp.phases.map(x => x.k).join() === 'transfer,home' && frp.dv < 5950,   // aimed as a true free return: small correction home
        `home in ${(api.t / 86400).toFixed(2)} days, peak ${(Rf.cgMax || 0).toFixed(1)} g; procedures: flyby ${!!fb}, free-return ${frp ? frp.dv.toFixed(0) + ' m/s' : 'none'}`); } }
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));   // the whole program state back: later sections see what they would have without this one Object.assign(api.HOOK, H);
}

// 28. Procedures (bodies session): a hand-flown ascent becomes a guidance plan that flies the design again, adapts, and only improves.
{
  const P = api.PROG, saved = JSON.stringify(P), news = [];
  api.HOOK.news = m => news.push(m); api.HOOK.msg = () => {}; api.HOOK.save = () => {}; P.procs = {}; P.funds = 1e4;
  const st = api.PRESETS.Orbiter, key = api.procKey(st), tgt = ATM + 10000;
  // a flight to orbit (attitude set directly, as in §3, sampled through advPhys like any flight); turnEnd sets how well it's flown
  const hand = (turnEnd) => { api.t = 0; const s = api.newShip(st); api.S = s; api.advPhys(s); s.sas = false; s.throttle = 1; api.stage(s); let k = 0, phase = 'up';
    const point = d => { const f = api.localFrame(s.r), r = d * Math.PI / 180, Y = norm(add(mul(f.e, Math.cos(r)), mul(f.up, Math.sin(r)))), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
    while (s.alive && k++ < 400000) { const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - TELLUS.R;
      if (phase === 'up') { const f = Math.min(1, Math.max(0, (h - 1000 * AS) / (turnEnd - 1000 * AS))); point(90 * (1 - Math.pow(f, 0.6))); if (el.ap - TELLUS.R > tgt) { s.throttle = 0; phase = 'coast'; } }
      else if (phase === 'coast') { point(0); s.throttle = h < ATM && el.ap - TELLUS.R < tgt - 500 ? 0.3 : 0; if (h > ATM && api.timeToNu(el, Math.PI) < 25) phase = 'circ'; }
      else { const f = api.localFrame(s.r), hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), X = norm(cross(hv, f.n)); s.q = api.qFromBasis(X, hv, cross(X, hv)); s.w = [0, 0, 0]; s.throttle = 1; if (el.pe - TELLUS.R > ATM + 2000) { s.throttle = 0; api.advRails(s, 10, 100); break; } }   // as in the game: engines off in orbit, straight onto rails
      if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) api.stage(s);
      api.advPhys(s); }
    return s; };
  const fly = (stack, proc, target) => { api.t = 0; const s = api.newShip(stack); api.S = s; api.advPhys(s); api.procStart(s, proc, target); let k = 0;
    while (s.alive && s.proc && !s.proc.done && k++ < 400000) { if (s.proc.phase === 'coast' && api.railsOK(s) && s.proc.wake > api.t + 2) api.advRails(s, Math.min(60, s.proc.wake - api.t), 100); else api.advPhys(s); }
    return s; };
  let s = hand(45000 * AS); const pr = P.procs[key], dvHand = s.rec.dv;
  check('procedures: a hand-flown ascent to orbit becomes a procedure for its design (pitch curve, staging, target, Δv)', !!pr && pr.pitch.length > 20 && Math.abs(pr.dv - dvHand) < 1 && news.some(m => /New procedure/.test(m)),
    pr ? `${pr.pitch.length} pitch points, heading ${(pr.az * 57.3).toFixed(0)}°, target ${(pr.target.pe / 1e3).toFixed(0)}×${(pr.target.ap / 1e3).toFixed(0)} km, ${pr.dv.toFixed(0)} m/s` : 'no procedure');
  P.procs = {}; s = hand(45000 * AS); const proc = P.procs[key]; P.procs = { [key]: proc };   // keep it fixed while we fly it
  let f = fly(st, proc), e = elements(f.r, f.v, TELLUS.mu);
  check('procedures: flown by the procedure (SAS, staging, goal cut-offs), the same design reaches a stable orbit for about the same Δv', f.alive && f.proc.done && e.pe - TELLUS.R > ATM && f.rec.dv < 1.05 * proc.dv,
    `${((e.pe - TELLUS.R) / 1e3).toFixed(0)}×${((e.ap - TELLUS.R) / 1e3).toFixed(0)} km for ${f.rec.dv.toFixed(0)} m/s (hand-flown ${proc.dv.toFixed(0)})`);
  f = fly(st, proc, { pe: 180e3, ap: 180e3 }); e = elements(f.r, f.v, TELLUS.mu);
  check('procedures: the same technique flies to a different target orbit (a contract\'s 180 km)', f.alive && f.proc.done && Math.abs(e.ap - TELLUS.R - 180e3) < 15e3 && e.pe - TELLUS.R > 150e3, `${((e.pe - TELLUS.R) / 1e3).toFixed(0)}×${((e.ap - TELLUS.R) / 1e3).toFixed(0)} km for ${f.rec.dv.toFixed(0)} m/s`);
  // a heavier, different variant with margin (a 4 t upper tank: 2 t more, liftoff TWR 1.41 not 1.63; 5,550 m/s in all),
  // and one that can't (the payload alone: 4,329 m/s in total, short of the ~4,450 orbit costs): it must not claim success
  f = fly(['chute', 'pod', 't4', 'petrel', 'dec', 't8', 'fins', 'kestrel'], proc); e = elements(f.r, f.v, TELLUS.mu);
  check('procedures: it adapts to a heavier, different variant (2 t more, lower thrust-to-weight): still to orbit', f.alive && f.proc.done && e.pe - TELLUS.R > ATM, `${((e.pe - TELLUS.R) / 1e3).toFixed(0)}×${((e.ap - TELLUS.R) / 1e3).toFixed(0)} km for ${f.rec.dv.toFixed(0)} m/s`);
  f = fly(['chute', 'pod', 'ballast', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], proc);
  check('procedures: a variant that cannot make orbit does not claim to: it stops with a deviation, saying why', !(f.proc && f.proc.done) && !!f.procDev && f.procDev.kind === 'short', f.procDev ? `${f.procDev.kind}: ${f.procDev.why}` : `done ${f.proc && f.proc.done}, alive ${f.alive}`);
  // records only improve: a sloppier ascent (late turn) doesn't replace it; a better one would
  news.length = 0; s = hand(80000 * AS); const kept = P.procs[key] === proc;
  check('procedures: a worse flight of the design leaves the stored procedure alone', kept && s.rec.dv > proc.dv && !news.some(m => /Procedure improved/.test(m)), `a lazier turn: ${s.rec.dv.toFixed(0)} m/s vs kept ${proc.dv.toFixed(0)}`);
  check('tapes: the tape version is a fingerprint of the physics (no more hand-bumped string)', /^lp-[0-9a-z]+$/.test(api.TAPE_V) && api.TAPE_V !== 'lp-1.12', api.TAPE_V);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));   // the whole program state back: later sections see what they would have without this one api.HOOK.news = () => {};
}

// bodies-1. The Selene and Nyx ladders, flown from the pad by procedures on the Probe and Sample Return presets (bodies
// session; the flights are fly_ladder.mjs). Only each mission's prerequisites are done; the mission's own check decides.
// The executor's options get exercised: the far side lit on arrival, near-side impact and landing, a retrograde capture at
// Nyx (and the same orbit prograde, which Tellus's tide should wreck), and a sample brought home.
{
  const P = api.PROG, saved = JSON.stringify(P), rows = flyLadder(api), row = id => rows.find(r => r.id === id) || {};
  const fmt = r => `${r.at}, ${r.days} days, ${r.dv} m/s in all, ${r.left} m/s left${r.touch ? `, touchdown ${r.touch} m/s` : ''}; ${r.cost}M`;
  for (const [id, what] of [['farside', 'the sunlit far side photographed and the pictures sent home'], ['selimp', 'an impactor heard to the end on the near side'],
    ['selland', 'a soft landing on the near side'], ['selsample', 'a Selene sample landed back on Tellus'], ['nyxfind', 'Nyx weighed by tracking residuals'],
    ['nyxfly', 'a Nyx flyby with camera and antenna'], ['nyxorb', 'a retrograde orbit round Nyx that lasts two Nyx orbits'], ['nyxland', 'a soft landing on Nyx']])
    check(`mission ladders: ${id} flown from the pad by procedure (${row(id).preset}): ${what}`, row(id).ok === true, fmt(row(id)));
  const pro = row('nyxorb:pro');
  check('mission ladders: the same Nyx orbit flown prograde does not last (Tellus\'s tide wrecks it: which way round matters)', pro.ok === false && pro.days < 4.3, fmt(pro));
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// bodies-2. Procedures flown headless, for dispatch (bodies session): procFly flies a stored procedure in isolation (the
// flight on screen, the fleet, the clock and the hooks put back as they were); a procedure that can't make its goal stops
// with a deviation and a registry entry of the craft where it stopped; dispatchRun flies dispatched contracts for real.
{
  const P = api.PROG, saved = JSON.stringify(P), st = api.PRESETS.Orbiter, key = api.procKey(st);
  api.HOOK.news = () => {}; api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  P.procs = {}; handAscent(api, st); const proc = P.procs[key];
  // isolation: a "flight in progress" (S, its clock, a fleet vessel, the hooks) is exactly as it was afterwards
  const S0 = api.newShip(['pod']), mark = () => {}; api.S = S0; api.t = 1234.5; api.FLEET.push(S0); api.HOOK.msg = mark; const T00 = api.ORB_T0;
  let f = api.procFly(st, proc, { pe: 180e3, ap: 180e3 });
  check('dispatch flights: a procedure flown headless reaches the asked orbit, and the flight in progress is untouched (S, clock, fleet, hooks)',
    f.ok && Math.abs(f.orb.ap - 180e3) < 15e3 && f.orb.pe > 150e3 && api.S === S0 && api.t === 1234.5 && api.FLEET.length === 1 && api.FLEET[0] === S0 && api.HOOK.msg === mark && api.ORB_T0 === T00 && P.procs[key] === proc,
    f.ok ? `${(f.orb.pe / 1e3).toFixed(0)}×${(f.orb.ap / 1e3).toFixed(0)} km, ${f.dv.toFixed(0)} m/s, ${(f.t / 60).toFixed(0)} min of flight` : JSON.stringify(f.dev || f.why));
  api.FLEET.length = 0; api.HOOK.msg = () => {};
  // short of propellant: the ballast variant (as in §28) deviates, and its entry rebuilds the craft where it stopped
  f = api.procFly(['chute', 'pod', 'ballast', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], proc);
  const vS = f.entry && api.vesselOf(f.entry, f.entry.epoch);
  check('dispatch flights: a design that can\'t make it deviates ("short") and hands over a registry entry that rebuilds the craft where it stopped',
    !f.ok && f.dev && f.dev.kind === 'short' && vS && vS.alive && len(sub(vS.r, f.s.r)) < 1 && Math.abs(api.dvRemaining(vS).tot - api.dvRemaining(f.s).tot) < 1,
    f.dev ? `${f.dev.kind}: ${f.dev.why} (${(f.t / 60).toFixed(1)} min in, ${((len(f.s.r) - TELLUS.R) / 1e3).toFixed(0)} km up)` : JSON.stringify(f.why));
  // the upper stage won't relight: handed over coasting up to apoapsis, with what circularising needs still aboard
  f = api.procFly(st, proc, null, { noRelight: true }); const el = elements(f.s.r, f.s.v, TELLUS.mu), need = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a));
  check('dispatch flights: a relight failure hands the craft over near apoapsis, periapsis in the air, the circularisation still possible by hand',
    f.dev && f.dev.kind === 'relight' && el.pe - TELLUS.R < ATM && api.dvRemaining(f.s).tot > need,
    f.dev ? `${((len(f.s.r) - TELLUS.R) / 1e3).toFixed(0)} km up, periapsis ${((el.pe - TELLUS.R) / 1e3).toFixed(0)} km; needs ${need.toFixed(0)} m/s, has ${api.dvRemaining(f.s).tot.toFixed(0)}` : 'no deviation');
  // dry runs: a new design borrows a stored procedure, provisionally, if a headless run gets it to orbit; its own first flight replaces it
  P.procs = { [key]: proc }; const heavy = ['chute', 'pod', 't1', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], hk = api.procKey(heavy);   // a tonne more on the upper stage
  const ad = api.procAdopt(heavy), weak = api.procAdopt(['chute', 'pod', 'ballast', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel']), one = api.procAdopt(['sci', 't8', 'kestrel']);
  const hot = api.procAdopt(['chute', 'pod', 't4', 'petrel', 'dec', 't8', 'fins', 'kestrel']);   // two tonnes more: Δv to spare on paper, but slower off the pad
  check('dry runs: a heavier variant borrows the Orbiter\'s procedure provisionally (measured on itself); one that can\'t make orbit, or stages differently, does not',
    ad.ok && P.procs[hk] && P.procs[hk].prov && P.procs[hk].from === 'Orbiter' && ad.margin > 0 && !weak.ok && !one.ok && one.tried.every(t => t.why === 'different staging'),
    `heavy: ${ad.ok ? `${ad.proc.dv.toFixed(0)} m/s to orbit, ${ad.margin.toFixed(0)} m/s to spare` : ad.why} · ballast: ${weak.why} (${(weak.tried || []).map(t => t.why).join('; ')}) · single stage: ${one.why}`);
  check('dry runs: a variant with Δv to spare on paper is still refused when the borrowed climb fails it (two tonnes more, lower thrust-to-weight: it falls back before cut-off)',
    !hot.ok && hot.tried.some(t => /falling back/.test(t.why)), `${hot.why}: ${(hot.tried || []).map(t => t.why).join('; ')}`);
  const provDv = P.procs[hk] ? P.procs[hk].dv : NaN; handAscent(api, heavy);
  check('dry runs: the design\'s own first flight replaces the borrowed procedure (records only improve, but a borrowed one always gives way)', P.procs[hk] && !P.procs[hk].prov, `borrowed ${provDv.toFixed(0)} m/s → own ${P.procs[hk] ? P.procs[hk].dv.toFixed(0) : '?'} m/s`);
  // the corridor (Q12): a climb that has already failed is handed over early, alive. Injected faults: an 8 s tumble at
  // 40 km (a stuck gimbal, say), and a recording that claims a much faster climb than this one can fly
  const flyWith = (pr, fault) => { api.t = 0; const s = api.newShip(st); api.S = s; s.noRec = true; api.procStart(s, pr); let k = 0;
    while (s.alive && s.proc && !s.proc.done && k++ < 200000) { if (fault) fault(s); api.advPhys(s); } return s; };
  let tSpin = null; const spun = flyWith(proc, s => { const h = len(s.r) - TELLUS.R; if (h > 40e3 && tSpin == null) tSpin = api.t; if (tSpin != null && api.t < tSpin + 8) s.w = [0.8, 0, 0]; });
  let tB = null; const brief = flyWith(proc, s => { const h = len(s.r) - TELLUS.R; if (h > 40e3 && tB == null) tB = api.t; if (tB != null && api.t < tB + 2) s.w = [0.8, 0, 0]; });
  const fast = flyWith({ ...proc, vel: proc.vel.map(([h, v]) => [h, v * 1.6]) });
  check('corridor: the climb is handed over early and alive when control is lost (the nose 20° off for 5 s; a 2 s tumble the SAS recovers from is not enough) or it falls far behind its recorded speed',
    spun.procDev && spun.procDev.kind === 'control' && spun.alive && !brief.procDev && brief.proc && brief.proc.done && fast.procDev && fast.procDev.kind === 'slow' && fast.alive && proc.vel.length > 10,
    `spun: ${spun.procDev ? spun.procDev.why : 'no deviation'} (${((len(spun.r) - TELLUS.R) / 1e3).toFixed(0)} km) · 2 s tumble: ${brief.procDev ? brief.procDev.why : brief.proc && brief.proc.done ? 'recovered, in orbit' : 'not done'} · fast recording: ${fast.procDev ? fast.procDev.why : 'no deviation'}`);
  // a dispatched contract, flown: the orbit is the procedure's, not a roll; the same seed gives the same flight
  const sst = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'];   // a satellite (the economy's §38 design): its own ascent, flown by hand once
  P.procs = {}; handAscent(api, sst); const sproc = P.procs[api.procKey(sst)];
  api.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, done: { beeper: { flight: 0, day: 0 } }, kh: {}, lines: {}, flights: 3, own: null, decisions: [], active: [], offers: [], fac: {}, studies: {}, studyQ: [], dispatch: [], procs: { [api.procKey(sst)]: sproc }, staged: {} });
  api.chooseStart('agency'); P.funds = 2000; P.day = 10; for (const p of api.newShip(sst).parts) { P.kh[p.d.key] = { use: 0.97, reg: {} }; P.cert[p.d.key] = 1; }
  const c = { id: 921, type: 'sat', src: 'com', client: 0, p: { alt: 160, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 }; P.active = [c];
  const before = JSON.stringify(P), fly = () => { api.orderDispatch(c, sst); const L = P.dispatch[0].launch; let n = 0; while (P.day < L + 1 && n++ < 30) { P.decisions = []; api.advanceTo(L + 1); } return P.dispatch[0]; };
  const D1 = fly(), o1 = D1.orb && { ...D1.orb }, paid = !P.active.includes(c), kept = (P.sats || []).filter(q => !q.junk).length; Object.assign(P, JSON.parse(before)); P.sats = JSON.parse(before).sats || []; P.active = [c]; const D2 = fly();   // the same world: the first payload (now registered, Q49) isn't up for the second
  check('dispatch flights: a dispatched contract is flown by its procedure to the contract\'s orbit and paid; the same seed flies the same flight',
    D1.status === 'done' && o1 && Math.abs((o1.pe + o1.ap) / 2 - 160e3) < 20e3 && paid && kept === 1 && D2.status === 'done' && D2.orb && Math.abs(D2.orb.pe - o1.pe) < 1 && Math.abs(D2.orb.ap - o1.ap) < 1,
    o1 ? `${D1.status}: ${(o1.pe / 1e3).toFixed(1)}×${(o1.ap / 1e3).toFixed(1)} km (contract 160 ± 20), paid ${paid}, payload registered ${kept}; again: ${D2.status} ${D2.orb ? (D2.orb.pe / 1e3).toFixed(1) + '×' + (D2.orb.ap / 1e3).toFixed(1) : ''}` : `${D1.status} ${D1.why || ''}`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// bodies-3. Landing on a chosen point (QUEUE Q13): the transfer aims the orbit's plane through the site, the capture is low,
// the descent steers to the velocity that would stop it there. Mid-latitude, near the pole, the far side, and on Nyx.
{
  const P = api.PROG, saved = JSON.stringify(P);
  for (const [preset, body, lat, lon, what] of [['Probe', 'Selene', 20, 15, 'Selene, 20°N 15°E of the point under Tellus'], ['Probe', 'Selene', 85, 0, 'Selene, near the pole (a polar orbit)'],
    ['Probe', 'Selene', -10, 170, 'the far side of Selene'], ['Probe', 'Nyx', 30, 20, 'Nyx (inclined, eccentric, its tide strong)']]) {
    const r = flySite(api, preset, body, lat, lon);
    check(`targeted landing: ${what}, within 100 m (a base takes in what lands within 500 m)`, r.landed && r.alive && r.miss < 100 && r.touch < 3,
      r.landed ? `${r.miss.toFixed(0)} m off at ${r.touch.toFixed(1)} m/s, ${r.left.toFixed(0)} m/s left, ${r.days.toFixed(2)} days` : `not landed: ${r.dev ? r.dev.why : r.alive ? 'still flying' : 'lost'}`); }
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
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
  const level = SI.filter(t => t.kind === 'pad').every(t => { const f = api.siteFrame(t.u);   // a sea platform floats: nothing levelled
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
  const outside = (page.replace(goSrc, '') + bsrc).match(/[^=!\w.]((?:mode|view|atHQ|atDeb|atRoll|atNet)=[^=])/g) || [];
  check('only go() changes the screen (no mode=/view=/atHQ=/atDeb=/atRoll=/atNet= assignments outside it but their declarations)', goSrc && outside.length === 6, outside.join(' '));
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
  if (!(P.offers || []).length) P.offers = null;   // (bodies session) the board after 90 days depends on the business cycle earlier sections leave behind; deal a fresh one if it's empty
  api.ensureBoard(); const o = P.offers.find(o => o.p.dur > 20) || P.offers[0]; api.acceptOffer(o.id); const c = P.active[0], st = api.advanceTo(P.day + 1000);
  check('timeline: a long wait stops a day before a contract deadline (not missed)', st && st.kind === 'deadline' && P.active.includes(c) && Math.abs(P.day - (c.deadline - 1)) < 1e-6,
    `stopped at day ${P.day.toFixed(1)}, deadline ${c.deadline.toFixed(1)}: ${st && st.text}`);
  // idle time is neutral: no overhead, so funds never fall while waiting (they only rise on budget days)
  P.active = []; let lo = P.funds, fell = false; for (let i = 0; i < 6; i++) { api.advanceTo(); if (P.funds < lo - 1e-9) fell = true; lo = P.funds; }
  check('timeline: waiting costs nothing (no daily overhead)', !fell, `six waits to day ${P.day.toFixed(0)}, funds never fell`);
  api.resetHome(); Object.assign(P, { own: null, flights: 0, fac: {}, kh: {}, studies: {}, studyQ: [], compEra: null, active: [], offers: [], decisions: [] });
}

// 36. Staged pay for long missions (economy): on course, on arrival, then the rest on completion; the total is unchanged.
{
  const P = api.PROG, { bodyRel, soiAt } = api, saved = JSON.stringify(P); const news = []; api.HOOK.news = m => news.push(m); api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  const reset = done => { P.done = Object.fromEntries(done.map(k => [k, { flight: 0, day: 0 }])); P.staged = {}; P.active = []; P.funds = 1000; P.own = null; };
  const craft = (b, r, v) => { api.t = 0; const s = api.newShip(['ant', 'cam', 't2', 'petrel']); api.S = s; s.landed = false; s.body = b; s.r = r; s.v = v; s.throttle = 0; s.rec.launched = true; s.rec.dv = 5000; return s; };
  const M = api.MISSIONS.find(m => m.id === 'farside');
  // what completing it pays with no staging
  reset(['beeper']); const fA = P.funds; api.missionComplete(M, null); const whole = P.funds - fA;
  // on course: just outside Selene's sphere of influence, closing at 300 m/s
  reset(['beeper']); const [pS, vS] = bodyRel(SELENE, 0), u = norm(pS), soi = soiAt(SELENE, 0), f0 = P.funds;
  const s = craft(TELLUS, sub(pS, mul(u, soi * 1.2)), add(vS, mul(u, 300))); api.missionTick(s, 0, false); const fBound = P.funds - f0;
  s.body = SELENE; s.r = mul(u, -soi * 0.9); s.v = mul(u, 300); api.missionTick(s, 0, false); const fArrive = P.funds - f0 - fBound;
  delete P.done.farside; api.missionComplete(M, null); const total = P.funds - f0;
  check('staged pay: a Selene mission pays 20% on course, 20% on arrival, and the rest on completion (same total)',
    Math.abs(fBound - 0.2 * M.pay) < 1e-9 && Math.abs(fArrive - 0.2 * M.pay) < 1e-9 && Math.abs(total - whole) < 1e-9 && news.some(m => /on course for Selene/.test(m)),
    `${M.name}: +${fBound.toFixed(0)}M on course, +${fArrive.toFixed(0)}M on arrival, ${total.toFixed(0)}M in all (unstaged ${whole.toFixed(0)}M)`);
  // a flight that isn't headed there pays nothing; a crewed mission's shares need a crew aboard
  reset(['beeper']); const g0 = P.funds; const s2 = craft(TELLUS, mul(u, 7e6), mul(norm(cross(u, [0, 1, 0])), Math.sqrt(TELLUS.mu / 7e6))); api.missionTick(s2, 0, false);
  reset(['beeper', 'farside', 'selimp', 'selland', 'selsample', 'padabort', 'maxqabort']); const s3 = craft(SELENE, mul(u, -soi * 0.9), mul(u, 300)); api.missionTick(s3, 0, false);
  check('staged pay: nothing for a flight not bound anywhere, nor for crewed missions on an uncrewed flight', P.funds === 1000 && g0 === 1000 && !Object.keys(P.staged).length,
    `circular orbit at 7,000 km: +0; uncrewed probe at Selene with only crewed missions open: +0`);
  Object.assign(P, JSON.parse(saved));
}

// 38. Dispatch (economy): a contract flown by a stored procedure; risk from part data; pads as reservations; a fixed seed.
{
  const P = api.PROG, saved = JSON.stringify(P); const news = []; api.HOOK.news = m => news.push(m); api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  api.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, done: { beeper: { flight: 0, day: 0 } }, kh: {}, lines: {}, flights: 3, own: null, decisions: [], active: [], offers: [], fac: {}, studies: {}, studyQ: [], dispatch: [], procs: {}, staged: {} });
  api.chooseStart('agency'); P.funds = 2000; P.day = 10;
  const st = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], key = api.procKey(st);
  const sat = (id, alt) => ({ id, type: 'sat', src: 'com', client: 0, p: { alt, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 });
  const c1 = sat(901, 150), c2 = sat(902, 250), c3 = sat(903, 350); P.active = [c1, c2, c3];   // (apart: one orbit can complete several contracts)
  const none = api.dispatchEstimate(st, c1); P.procs = { [key]: { kind: 'orbit', target: { pe: 110e3, ap: 118e3 }, dv: 4445 } };
  const raw = api.dispatchEstimate(st, c1);
  for (const p of api.newShip(st).parts) { P.kh[p.d.key] = { use: 0.97, reg: {} }; P.cert[p.d.key] = 1; }
  const known = api.dispatchEstimate(st, c1);
  check('dispatch: needs a procedure; part data raises the chance and narrows the estimate', !none.ok && raw.ok && known.p > raw.p && (known.hi - known.lo) < (raw.hi - raw.lo),
    `no procedure: "${none.why}" · unknown parts ${(raw.p * 100).toFixed(0)}% (${(raw.lo * 100).toFixed(0)}–${(raw.hi * 100).toFixed(0)}%) · well-known ${(known.p * 100).toFixed(0)}% (${(known.lo * 100).toFixed(0)}–${(known.hi * 100).toFixed(0)}%), margin ${known.margin.toFixed(0)} m/s`);
  // pads: the second dispatch queues behind the first; a second pad takes the third at once; a hand-flown launch waits
  const q1 = api.dispatchQuote(c1, st); api.orderDispatch(c1, st); const q2 = api.dispatchQuote(c2, st); api.orderDispatch(c2, st);
  const waitOne = api.padWait(); P.fac.pads = { lv: 1 }; const q3 = api.dispatchQuote(c3, st);
  check('dispatch: pads are reservations; a second dispatch waits for the pad, a second pad takes one at once', Math.abs(q2.start - q1.launch) < 1e-9 && q2.pad === 0 && q3.pad === 1 && Math.abs(q3.start - P.day) < 1e-9 && Math.abs(waitOne - (q2.launch - P.day)) < 1e-9,
    `#1 launches day ${q1.launch.toFixed(0)}, #2 day ${q2.launch.toFixed(0)} (same pad), with two pads #3 day ${q3.launch.toFixed(0)}; a hand-flown launch would wait ${waitOne.toFixed(0)} d`);
  P.fac.pads = { lv: 0 };
  // the flights: same seed, same outcome; the contract pays as if flown by hand
  const before = JSON.stringify(P), f0 = P.funds, fl0 = P.flights; const waitTo = d => { let n = 0; while (P.day < d - 1e-9 && n++ < 50) { P.decisions = []; api.advanceTo(d); } }; waitTo(P.dispatch[1].launch + 8);   // (decisions that come up on the way are waved off)
  const r1 = P.dispatch.map(d => d.status + (d.orb ? d.orb.pe.toFixed(0) : '')).join(' '), paid = !P.active.includes(c1) && !P.active.includes(c2), df = P.funds - f0;
  Object.assign(P, JSON.parse(before)); P.active = [c1, c2, c3].filter(c => JSON.parse(before).active.some(x => x.id === c.id)); waitTo(P.dispatch[1].launch + 8);
  const r2 = P.dispatch.map(d => d.status + (d.orb ? d.orb.pe.toFixed(0) : '')).join(' ');
  check('dispatch: both fly on their launch days, contracts paid as by hand; the same seed gives the same outcome (no re-rolls)', r1 === r2 && /done/.test(r1) && paid && P.flights === fl0 + 2,
    `${r1.replace(/(\d{3})\d{3}/g, '$1 km ')} · funds ${df >= 0 ? '+' : ''}${df.toFixed(0)}M net of two launches`);
  Object.assign(P, JSON.parse(saved));
}

// 39. Deviation (economy): a dispatch that can't meet its goal hands the flight over; time stops for it; ignored, it's lost.
{
  const P = api.PROG, saved = JSON.stringify(P); const news = []; api.HOOK.news = m => news.push(m); api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  api.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, done: { beeper: { flight: 0, day: 0 } }, kh: {}, lines: {}, flights: 3, own: null, decisions: [], active: [], offers: [], fac: {}, studies: {}, studyQ: [], dispatch: [], procs: {}, staged: {} });
  api.chooseStart('agency'); P.funds = 2000; P.day = 10;
  const st = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel']; P.procs = { [api.procKey(st)]: { kind: 'orbit', target: { pe: 110e3, ap: 118e3 }, dv: 4445 } };
  const c = { id: 911, type: 'sat', src: 'com', client: 0, p: { alt: 150, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 }; P.active = [c];
  // the state a deviation hands over: the top stage at apoapsis, periapsis in the air, with the propellant of its case
  const eR = api.devState({ id: 1, stack: st }, c, 'relight'), eS = api.devState({ id: 1, stack: st }, c, 'short'), vR = api.vesselOf(eR, eR.epoch), vS = api.vesselOf(eS, eS.epoch);
  const elR = elements(vR.r, vR.v, TELLUS.mu), need = Math.sqrt(TELLUS.mu / elR.ap) - len(vR.v);
  check('deviation: the handed-over state is the top stage at apoapsis on a transfer orbit that dips into the air; "short" lacks the propellant to circularise',
    vR.alive && !vR.parts.some(p => p.on && p.d.key === 'kestrel') && Math.abs(len(vR.r) - TELLUS.R - 150e3) < 1 && elR.pe - TELLUS.R < 40e3 && api.dvRemaining(vR).tot > need && api.dvRemaining(vS).tot < need,
    `${vR.parts.filter(p => p.on).map(p => p.d.key).join('+')} at ${((len(vR.r) - TELLUS.R) / 1e3).toFixed(0)} km, periapsis ${((elR.pe - TELLUS.R) / 1e3).toFixed(0)} km; circularising needs ${need.toFixed(0)} m/s: relight case has ${api.dvRemaining(vR).tot.toFixed(0)}, short case ${api.dvRemaining(vS).tot.toFixed(0)}`);
  // a deviation from the physics side (here a stand-in): time stops for it and won't move until it's dealt with
  api.HOOK.dispatchRun = (D, v, cc) => ({ deviation: { kind: 'relight', why: 'the upper stage failed to relight', entry: api.devState(D, cc, 'relight') } });
  api.orderDispatch(c, st); const L0 = P.dispatch[0].launch; let n = 0; while (P.day < L0 - 1e-9 && n++ < 20) { P.decisions = []; api.advanceTo(L0 + 30); }
  const day1 = P.day, D = P.dispatch[0], again = api.advanceTo(P.day + 30);
  check('deviation: the dispatch stops the calendar and waits for you; waiting again refuses to move', D.status === 'deviated' && again && again.kind === 'deviation' && P.day === day1 && news.some(m => /needs you/.test(m)) && P.active.includes(c),
    `launch day ${L0.toFixed(1)}: ${D.status} (${D.dev.why}); a second wait stays at day ${P.day.toFixed(1)}; the contract is still open`);
  // ignored while time moves on (a hand-flown launch, say): lost. Let go: lost, the contract still open.
  api.advanceDays(1); api.advanceDays(0.01);
  check('deviation: if time moves on without you, nobody was at the console and the flight is lost', D.status === 'failed' && /nobody was at the console/.test(D.why) && P.active.includes(c), D.why);
  delete api.HOOK.dispatchRun;
  // the interim resolver gives deviations too, for an upper stage nobody knows (relight odds)
  for (const p of api.newShip(st).parts) { P.kh[p.d.key] = { use: 0.97, reg: {} }; P.cert[p.d.key] = 1; } P.kh.petrel = { use: 0, reg: {} };
  const tally = { done: 0, lost: 0, relight: 0, short: 0 }; for (let sd = 1; sd <= 400; sd++) { const r = api.dispatchRoll({ id: 1, seed: sd * 7919, stack: st }, api.newShip(st), c); tally[r.deviation ? r.deviation.kind : r.ok ? 'done' : 'lost']++; }
  check('deviation: the interim resolver hands over when the upper stage fails to relight (an unknown engine), and is otherwise reliable here', tally.relight > 4 && tally.done > 300 && tally.short === 0,
    `400 seeds, the Petrel unknown: ${tally.done} in orbit, ${tally.relight} relight failures handed over, ${tally.lost} lost, ${tally.short} short`);
  Object.assign(P, JSON.parse(saved));
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

// control-1. Engine gimbal and steerable fins (control session): the nozzle really turns, within its range and slew rate; a single
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
// control-2. Reaction wheels that saturate, and the builder's control readout (control session). The wheels store what they give;
// they unload through a burning gimbal (free) or RCS (gas, only past 80 %); the readout's numbers match flown turns.
{
  const D = new Function(src + 'return {toV2,newShip,physStep,stage,controlReport,qrot,rcsGas,TELLUS,HOOK,INP,DT,len,PRESETS,get t(){return simT},set t(v){simT=v},set S(v){S=v}};')();
  D.HOOK.msg = () => {}; const T = D.TELLUS, len = D.len, ang = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const fnd = (n, k) => n.k === k ? n : (n.c || []).map(c => fnd(c, k)).find(Boolean);
  const withRcs = (stack, host, ys) => { const d = D.toV2(JSON.parse(JSON.stringify(stack))), h = fnd(d.root, host);
    for (const y of ys) h.c.push({ k: 'rcs', at: { y, a: 0, n: 4, cy: 0.1 }, c: [] }); h.c.push({ k: 'gas', at: { y: 0.5, a: Math.PI / 4, n: 2, cy: 0.3 }, c: [] }); return d; };
  const space = des => { D.t = 0; const s = D.newShip(des), r0 = T.R + 300e3; D.S = s;
    Object.assign(s, { landed: false, sas: false, throttle: 0, r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)], w: [0, 0, 0] }); return s; };
  // the pitch key held for 30 s, SAS off: the rate levels off where the wheels are full
  const o = space(D.PRESETS.Orbiter); for (let i = 0; i < 30 / D.DT; i++) { D.INP.pitch = 1; D.physStep(o, D.DT); } D.INP.pitch = 0;
  const cap = o.hmax / Math.max(o.I[0], o.I[2]);
  check('wheels: the pod gives 10 kN·m and stores 100 kN·m·s; held 30 s, the Orbiter’s pitch rate stops at storage ÷ inertia',
    o.torque === 10000 && Math.abs(len(o.w) / cap - 1) < 0.02 && len(o.wH) / o.hmax > 0.999, `${len(o.w).toFixed(3)} rad/s vs ${cap.toFixed(3)}; wheels ${(100 * len(o.wH) / o.hmax).toFixed(0)}%`);
  // unloading from 90 %, holding attitude: nothing else to steer with / a burning gimbal / cold-gas RCS
  const unload = (des, { rcs = false, thr = 0 } = {}) => { const s = space(des); D.stage(s); Object.assign(s, { throttle: thr, rcs, sas: true, sasMode: 'stab' });
    s.wH = [0.9 * s.hmax, 0, 0]; const Y0 = D.qrot(s.q, [0, 1, 0]), g0 = D.rcsGas(s); let err = 0;
    for (let i = 0; i < 45 / D.DT; i++) { D.physStep(s, D.DT); err = Math.max(err, ang(D.qrot(s.q, [0, 1, 0]), Y0) * 57.3); }
    return { f: len(s.wH) / s.hmax, err, gas: (g0 - D.rcsGas(s)) * 1000 }; };
  const st = ['chute', 'pod', 't2', 'petrel'], none = unload(st), burn = unload(st, { thr: 1 }), gas = unload(withRcs(st, 't2', [0.1, 1.9]), { rcs: true });
  check('wheels unload: not with nothing else to steer; a burning gimbal empties them in 45 s holding within 1°; RCS spends gas on it',
    Math.abs(none.f - 0.9) < 1e-9 && burn.f < 0.05 && burn.err < 1 && gas.f < 0.85 && gas.gas > 1,
    `nothing ${(100 * none.f).toFixed(0)}% · gimbal ${(100 * burn.f).toFixed(0)}% (max error ${burn.err.toFixed(2)}°) · RCS ${(100 * gas.f).toFixed(0)}% for ${gas.gas.toFixed(1)} kg of gas`);
  // the readout: its 90° turn time on wheels against a flown one; coasting at max-q, a steerable ring holds where wheels can't
  const flown = k => { const s = space(D.PRESETS[k]), est = D.controlReport(s).turn.wheels, X0 = D.qrot(s.q, [1, 0, 0]); Object.assign(s, { sas: true, sasMode: 'stab', hold: X0 });
    let t = 0; while (t < 200) { D.physStep(s, D.DT); t += D.DT; if (ang(D.qrot(s.q, [0, 1, 0]), X0) < 2 / 57.3) break; } return { est, t }; };
  const fo = flown('Orbiter'), fl = flown('Lunar'), cO = D.controlReport(D.newShip(D.PRESETS.Orbiter)).coast,
    cS = D.controlReport(D.newShip(D.PRESETS.Orbiter.map(x => x === 'fins' ? 'cfins' : x))).coast;
  check('control readout: 90° turn times on wheels match flown turns within 10%; coasting at max-q the Orbiter can’t hold 5° on wheels, with a steerable ring it can',
    Math.abs(fo.est / fo.t - 1) < 0.1 && Math.abs(fl.est / fl.t - 1) < 0.1 && cO.tau > cO.auth && cS.tau < cS.auth,
    `Orbiter ${fo.est.toFixed(1)} vs ${fo.t.toFixed(1)} s, Lunar ${fl.est.toFixed(1)} vs ${fl.t.toFixed(1)} s; coasting need ${(cO.tau / 1e3).toFixed(0)} kN·m: wheels ${(cO.auth / 1e3).toFixed(0)}, steerable ring ${(cS.auth / 1e3).toFixed(0)}`);
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
  const D = new Function(src + 'return {fromPF,surfVel,newShip,stage,geom,physStep,contactStep,syncLanded,satRegister,vesselOf,landedUp,satsUp,baseOf,baseOfMember,stationTick,advanceDays,tgtOf,groundR,toPF,SELENE,PROG,TELLUS,DT,qrot,qFromTo,qaxis,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
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
  const c = D.newShip(['pod']); D.t = 0; const up = norm(D.fromPF(B, hab.pf, 0)), top = D.groundR(B, mul(up, B.R)) + 3.2 + 0.25 + 0.05 - c.yBot;
  Object.assign(c, { body: B, landed: false, alive: true, sas: false, throttle: 0, w: [0, 0, 0], q: D.qFromTo([0, 1, 0], up), r: mul(up, top), v: add(mul(up, -1), D.surfVel(B, mul(up, top))) }); c.rec.launched = true; D.S = c;
  for (let i = 0; i < 30 && dot(c.v, up) < 0; i++) { D.physStep(c, D.DT); D.contactStep(c, D.DT); }
  check('moonbase: a capsule landing on a module bounces off it; the module stays put', dot(c.v, up) > 0 && len(sub(hab.pf, pf0)) === 0 && c.alive, `rebounds at ${dot(c.v, up).toFixed(2)} m/s; module moved ${len(sub(hab.pf, pf0))} m`);
  // a landed object as the target: the landing guidance has a distance to work with
  c.target = q.id; const T = D.tgtOf(c);
  check('moonbase: a base can be the target of a landing', T && T.landed && T.q === q && len(T.dr) > 100, `${T ? T.q.name + ' at ' + (len(T.dr) / 1000).toFixed(2) + ' km' : 'no target'}`);
  Object.assign(P, { sats: [], satN: 0, labDays: 0 });
}

// 37. The tester menu (tester session; PLAYTEST #1): cheats that only act in tester mode, an epoch picker, the date,
// finishing jobs, and a save slot apart from the career. Its own copy of the SIM, so no other section sees the flags.
{
  const D = new Function(src + 'return {TEST,TEST_FUNDS,testTopUp,testEpoch,testAdvance,testFinishJobs,PROG,MISSIONS,missionOpen,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart,buildFac,facLv,khUse,certOf,toolOK,newShip,missionTick,PRESETS,set S(v){S=v},set t(v){simT=v}};')();
  const P = D.PROG, T = D.TEST; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, lines: {}, flights: 1, own: null, decisions: [], active: [], offers: [], fac: {} });
  D.chooseStart('agency'); P.funds = 0;
  // off by default, and the flags do nothing until tester mode is on
  const k0 = D.khUse('kestrel'), c0 = D.certOf('kestrel'), tools0 = D.toolOK('nodes');
  T.money = true; D.testTopUp(); const offMoney = P.funds; T.money = false;
  check('tester: everything off by default; infinite money does nothing outside tester mode', !T.on && !T.kh && !T.tools && !T.nofail && !T.fast && offMoney === 0 && k0 < 1 && c0 < 1 && !tools0,
    `know-how ${k0.toFixed(2)}, cert ${c0.toFixed(2)}, funds ${offMoney}`);
  // infinite money: broke, yet a facility can be bought
  T.on = true; T.money = true; D.testTopUp(); const bought = D.buildFac('hall'); D.testTopUp();
  check('tester: infinite money tops the program up, so anything can be bought', bought && P.funds === D.TEST_FUNDS, `funds ${P.funds}, hall ordered: ${bought}`);
  // finishing jobs: the hall under construction is done now, not in N days
  const lv0 = D.facLv('hall'); D.testFinishJobs();
  check('tester: "finish every job" completes a facility under construction at once', lv0 === 0 && D.facLv('hall') === 1, `hall level ${lv0} → ${D.facLv('hall')}`);
  // know-how and certification, tools
  T.kh = true; T.tools = true;
  check('tester: full know-how and certification, every tool', D.khUse('kestrel') === 1 && D.certOf('kestrel') === 1 && ['impact', 'nodes', 'encounters'].every(D.toolOK));
  // mission ids are keys of PROG.done: two missions with one id complete together (epoch 3's weather satellite was once
  // 'weather', the same id as epoch 1's sounding flight, so that flight also ticked off the satellite)
  const ids = D.MISSIONS.map(m => m.id), dupIds = ids.filter((k, i) => ids.indexOf(k) !== i);
  check('every mission has its own id', !dupIds.length, dupIds.join(' ') || `${ids.length} missions`);
  // the epoch picker: epoch 4 means epochs 1–3 done and the first Selene missions open; back to 2 clears the later ones
  D.testEpoch(4); const M = D.MISSIONS, done4 = M.filter(m => P.done[m.id]), open4 = M.filter(m => m.ep === 4 && !P.done[m.id] && D.missionOpen(m)).map(m => m.id);
  check('tester: epoch 4 marks epochs 1–3 done and opens the first Selene missions', done4.length === M.filter(m => m.ep < 4).length && done4.every(m => m.ep < 4 && P.done[m.id].test) && open4.includes('farside') && open4.includes('padabort'),
    `${done4.length} done; open in epoch 4: ${open4.join(', ')}`);
  D.testEpoch(2);
  check('tester: going back to epoch 2 clears everything from epoch 2 on', M.every(m => !!P.done[m.id] === (m.ep < 2)), `done: ${Object.keys(P.done).join(', ')}`);
  // the date: a hundred days pass, one day at a time
  const d0 = P.day; D.testAdvance(100);
  check('tester: the world date moves forward by the days asked', Math.abs(P.day - d0 - 100) < 1e-6, `day ${d0.toFixed(1)} → ${P.day.toFixed(1)}`);
  // instant stacking: no preparation days on launch
  const prep = fast => { T.fast = fast; P.day = 0; const x = D.newShip(D.PRESETS.Orbiter); D.S = x; x.landed = false; D.t = 0; D.missionTick(x, 0, false); return x.rec.prep; };
  const slow = prep(false), quick = prep(true);
  check('tester: instant stacking skips the preparation days', slow > 1 && quick === 0, `Orbiter ${slow.toFixed(1)} → ${quick} days`);
  Object.assign(T, { on: false, money: false, kh: false, tools: false, nofail: false, fast: false });
  // the page: the save slot follows the mode, and the menu's key shows in Help only in tester mode
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const writes = [...page.matchAll(/localStorage\.setItem\(([^,]+),/g)].map(m => m[1]).filter(k => /program/i.test(k) || k === 'PROG_KEY');
  check('tester: the program saves to PROG_KEY only, a separate slot in tester mode', /const PROG_KEY=TEST\.on\?'launchpad-program-tester':'launchpad-program-v1'/.test(page) && writes.length && writes.every(k => k === 'PROG_KEY'),
    `program writes: ${writes.join(', ')}`);
  check('tester: the F2 row is hidden from Help outside tester mode', /\{k:\['f2'\][^}]*tester:true\}/.test(page) && /L\.filter\(r=>!r\.tester\|\|TEST\.on\)/.test(page));
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

// 35. Rovers packed and deployed (sats session, rovers R2): a folded rover on a lander's side, a deck with ramps; the
// deploy check; the rover upright on Selene; bumping the lander; left in the field and picked up again. Own sim instance.
{
  const D = new Function(src + 'return {newShip,syncLanded,groundR,qFromTo,qaxis,qmul,SELENE,PROG,HOOK,rvDeploy,rvDeployCheck,rvFlight,rvTilt,rvEnd,rvLoadNear,rvObsOf,rvGeom,rvDefault,shipPF,satRegister,vesselOf,landedUp,get FROV(){return FROV},get RVA(){return RVA},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const msgs = []; D.HOOK.msg = m => msgs.push(m);
  const B = D.SELENE, P = D.PROG; Object.assign(P, { sats: [], satN: 0, rvOut: [] });
  const luno = { name: 'Lunokhod', ch: 'm', wh: 'm', n: 6, spr: 'S', slots: ['cam', 'bat', 'ant', 'spec', null] };
  const lander = (mount, rvd, { tanks = 1, lean = 0 } = {}) => { D.t = 0; let low = { k: 'sparrow', at: 'd' }; for (let i = 0; i < tanks; i++) low = { k: 't1', at: 'd', c: [low] };
    const root = { k: 'core', c: [low, mount === 'fold' ? { k: 'rvfold', at: { y: .6, a: 0, n: 1 }, rvd } : { k: 'rvdeck', at: 'u', rvd }] };
    const s = D.newShip({ v: 2, root }), u = [1, 0, 0]; Object.assign(s, { body: B, landed: true, alive: true, sas: false, throttle: 0 });
    s.pf = mul(u, D.groundR(B, mul(u, B.R)) - s.yBot); s.qLocal = D.qmul(D.qaxis([0, 0, 1], lean * Math.PI / 180), D.qFromTo([0, 1, 0], u)); D.syncLanded(s); s.rec.launched = true; D.S = s; return s; };
  const rp = s => s.parts.find(p => p.d.kind === 'rover'), run = sec => { for (let i = 0; i < sec * 10; i++) D.rvFlight(0.1); };
  // packing: the rover's own mass rides on the lander; what doesn't fit, or has no one to drive it, is refused on the spot
  const bare = lander('fold', null), s = lander('fold', luno), kg = D.rvGeom(luno).m;
  const big = lander('fold', { ...luno, ch: 'l' }), crewd = lander('fold', D.rvDefault());
  const cBig = D.rvDeployCheck(big, rp(big)), cCrew = D.rvDeployCheck(crewd, rp(crewd));
  check('rover R2: a packed rover\'s mass rides on the lander; a large chassis won\'t fold, a crewed rover needs a crew', Math.abs(s.mass - bare.mass - kg) < 1e-6 && !cBig.ok && /doesn't fold/.test(cBig.why) && !cCrew.ok && /crew/.test(cCrew.why),
    `+${(s.mass - bare.mass).toFixed(0)} kg (the design: ${kg.toFixed(0)}); "${cBig.why}"; "${cCrew.why}"`);
  // deploy from the side: the lander is lighter and stays where it stood; after the unfold the rover stands on its wheels beside it
  D.S = s; const o0 = D.shipPF(s, [0, 0, 0]), m0 = s.mass, R = D.rvDeploy(s, rp(s)); run(12);
  const dist = len(sub(R.p, s.pf)), ti = D.rvTilt(R);
  check('rover R2: deployed from the side it unfolds onto its wheels beside the lander; the lander is lighter and hasn\'t moved', R && !R.dep && D.RVA === R && Math.abs(m0 - s.mass - kg) < 1e-6 && len(sub(D.shipPF(s, [0, 0, 0]), o0)) < 1e-9 && dist > 2.5 && dist < 6 && Math.abs(ti.pitch) < 5 && Math.abs(ti.roll) < 5 && len(R.v) < 0.01 && !R.tipped,
    `${dist.toFixed(1)} m out, pitch ${ti.pitch.toFixed(1)}°, roll ${ti.roll.toFixed(1)}°; lander ${(m0 / 1000).toFixed(2)} → ${(s.mass / 1000).toFixed(2)} t`);
  // it can't drive through the lander: backing into it, it stops against it
  R.obs = D.rvObsOf([s]); R.in.thr = -1; let close = 1e9; for (let i = 0; i < 100; i++) { D.rvFlight(0.1); close = Math.min(close, len(sub(R.p, s.pf))); } R.in.thr = 0;
  check('rover R2: backing into the lander it stops against it instead of driving through', close > 1.8 && !R.tipped, `closest ${close.toFixed(2)} m (centre to centre)`);
  // left in the field at the flight's end; a later flight nearby picks it up again; the lander, saved, remembers it's gone
  D.satRegister(s, s.rec); const q = P.sats.find(x => x.landed); D.rvEnd(); const out = P.rvOut.slice(), v = D.vesselOf(q, 0);
  D.S = s; const n = D.rvLoadNear(s);
  check('rover R2: at the flight\'s end it stays in the field; a flight nearby takes it back in; the saved lander comes back without it', out.length === 1 && out[0].bodyName === 'Selene' && n === 1 && D.FROV[0].name === 'Lunokhod' && len(sub(D.FROV[0].p, out[0].p)) < 1e-9 && Math.abs(v.mass - s.mass) < 1e-6 && rp(v).rvOut,
    `${out[0] ? out[0].name + ' on ' + out[0].bodyName : 'nothing kept'}; the saved lander ${(v.mass / 1000).toFixed(2)} t`);
  D.rvEnd(); P.rvOut = [];
  // a deck with ramps: on top of a short lander the ramps reach at a drivable angle; on a tall one they don't
  const dk = lander('deck', luno), cD = D.rvDeployCheck(dk, rp(dk)), tall = lander('deck', luno, { tanks: 3 }), cT = D.rvDeployCheck(tall, rp(tall));
  D.S = dk; const R2 = D.rvDeploy(dk, rp(dk)); run(14); const t2 = D.rvTilt(R2);
  check('rover R2: down the ramps of a deck on a short lander; a tall lander\'s ramps would be too steep', cD.ok && R2 && !R2.dep && Math.abs(t2.pitch) < 5 && Math.abs(t2.roll) < 5 && rp(dk).on && !cT.ok && /ramps/.test(cT.why),
    `ramps at ${cD.ang.toFixed(0)}°; on the tall one: "${cT.why}"`);
  // a lander that came to rest leaning can't deploy
  const ln = lander('fold', luno, { lean: 20 }), cL = D.rvDeployCheck(ln, rp(ln));
  check('rover R2: a lander leaning 20° won\'t deploy', !cL.ok && /leans/.test(cL.why), cL.why);
  D.rvEnd(); Object.assign(P, { sats: [], satN: 0, rvOut: [] });
}

// control-3. Avionics generations (control session): SAS grows with the computing eras. A gyro autopilot holds an attitude only;
// an analog autopilot adds the velocity-vector modes; a guidance computer has every mode and the fastest loop. Own instance.
{
  const D = new Function(src + 'return {avNow,compEra,AV,PROG,sasModeOK,satRegister,vesselOf,newShip,physStep,sasTarget,qrot,len,TELLUS,HOOK,DT,get t(){return simT},set t(v){simT=v},set S(v){S=v}};')();
  D.HOOK.msg = () => {}; const T = D.TELLUS, ang = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 57.2958;
  const sand = D.avNow(); D.PROG.flights = 1; const gens = [0, 3.5, 8].map(y => { D.PROG.day = y * 400; return [D.avNow(), D.compEra()]; });
  check('avionics: no program, the best SAS; in a program it follows the computing era (gyro, then analog at mainframes, then guidance computer)',
    sand === 2 && gens.every(([a, e]) => a === Math.min(2, e)) && gens.map(g => g[0]).join() === '0,1,2', `sandbox ${sand}; years 0 / 3.5 / 8 → ${gens.map(g => D.AV[g[0]].name).join(' / ')}`);
  // the guidance computer's pod carries an onboard computer: since Q34a (vehicle) a craft without crew needs one for those modes
  const pod = av => { D.t = 0; const s = D.newShip(av === 2 ? ['chute', 'pod', 'ocomp'] : ['chute', 'pod']), r0 = T.R + 300e3; D.S = s; s.av = av;
    Object.assign(s, { landed: false, throttle: 0, r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)], w: [0, 0, 0], sas: true, sasMode: 'stab' });
    const modes = ['pro', 'node', 'tgt'].map(m => D.sasModeOK(s, m) ? 'yes' : 'no'); s.sasMode = 'pro'; const proHolds = D.sasTarget(s) === s.hold; s.sasMode = 'stab';
    const X0 = D.qrot(s.q, [1, 0, 0]); s.hold = X0; let t = 0, reach = null, err = 0;
    while (t < 40) { D.physStep(s, D.DT); t += D.DT; const e = ang(D.qrot(s.q, [0, 1, 0]), X0); if (reach == null && e < 2) reach = t; if (reach != null && t > reach + 15) err = Math.max(err, e); }
    return { modes: modes.join('/'), proHolds, reach, err }; };
  const g = pod(0), a = pod(1), c = pod(2);
  check('avionics: a gyro only holds (asked for prograde, it holds the attitude), within its ½° deadband; a bare pod\u2019s 90° turn takes it twice as long as a guidance computer',
    g.modes === 'no/no/no' && g.proHolds && !c.proHolds && a.modes === 'yes/no/no' && c.modes === 'yes/yes/yes' && g.reach > 1.8 * c.reach && g.err <= 0.5 + 1e-6,
    `prograde/maneuver/target: gyro ${g.modes} (prograde holds: ${g.proHolds}), analog ${a.modes}, computer ${c.modes}; 90° in ${g.reach.toFixed(1)} / ${a.reach.toFixed(1)} / ${c.reach.toFixed(1)} s; gyro holds within ${g.err.toFixed(2)}°`);
  // a satellite keeps its avionics through the register: loaded back years later, it still has the gyro it flew with
  D.t = 0; const sat = D.newShip(['ant', 'core', 't1', 'wren']), rs = T.R + 300e3; D.S = sat; sat.av = 0; D.PROG.day = 8 * 400;
  Object.assign(sat, { landed: false, alive: true, r: [rs, 0, 0], v: [0, 0, -Math.sqrt(T.mu / rs)], w: [0, 0, 0] }); D.PROG.sats = []; D.satRegister(sat, { day0: 0 });
  const back = D.PROG.sats.length ? D.vesselOf(D.PROG.sats[0], 0) : null;
  check('avionics: a gyro-era satellite loaded back from the register in the computer era still flies its gyro', back && back.av === 0 && D.avNow() === 2,
    `registered ${D.PROG.sats.length}, loaded back with ${back ? D.AV[back.av].name : '—'} (today: ${D.AV[D.avNow()].name})`);
}

// control-4. Spin stabilisation (control session): Euler's equations with the gyroscopic term (ω×Iω), spin-up motors, and
// SAS leaving the roll of a spun stage alone. A spinning stage holds its axis against a misaligned thrust and wobbles at
// the rate Euler's equations give; before, it turned to every torque as if it weren't spinning. Own instance.
{
  const D = new Function(src + 'return {newShip,stage,physStep,advRails,controlReport,qrot,qconj,len,dot,sub,add,mul,TELLUS,HOOK,INP,DT,set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const msgs = []; D.HOOK.msg = m => msgs.push(m); D.HOOK.debris = () => {}; D.HOOK.rebuild = () => {}; D.HOOK.boom = () => {};
  const T = D.TELLUS, toB = (s, v) => D.qrot(D.qconj(s.q), v), toI = (s, v) => D.qrot(s.q, v), deg = 57.2958;
  const orbit = stack => { D.t = 0; const s = D.newShip(stack), r0 = T.R + T.atm + 100e3; D.S = s;
    Object.assign(s, { landed: false, throttle: 0, sas: false, r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)] }); return s; };
  const Lof = s => { const w = toB(s, s.w); return toI(s, [s.I[0] * w[0], s.I[1] * w[1], s.I[2] * w[2]]); };
  // a free kick stage at 2 rev/s with a small wobble: angular momentum kept, the wobble turns at (I_axis − I_side)/I_side × spin
  {
    const s = orbit(['core', 't1', 'petrel']), ws = 4 * Math.PI; s.w = toI(s, [0.05, ws, 0.02]); const L0 = Lof(s);
    let turned = 0, last = Math.atan2(0.02, 0.05), drift = 0;
    for (let i = 0; i < 1500; i++) { D.physStep(s, D.DT); const w = toB(s, s.w), a = Math.atan2(w[2], w[0]); let d = a - last; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); turned += d; last = a;
      drift = Math.max(drift, D.len(D.sub(Lof(s), L0)) / D.len(L0)); }
    const It = (s.I[0] + s.I[2]) / 2, want = Math.abs((s.I[1] - It) / It * ws), got = Math.abs(turned / 30);
    check('spin: a free spinning stage keeps its angular momentum, and its wobble turns at the rate Euler\u2019s equations give',
      drift < 1e-3 && Math.abs(got / want - 1) < 0.01, `L drift ${(drift * 100).toFixed(3)} % in 30 s; wobble ${got.toFixed(3)} rad/s (Euler ${want.toFixed(3)})`);
  }
  // a kick stage burning with its thrust 0.5° off the axis, SAS off: unspun it tumbles; at 2 rev/s it flies straight
  const burn = (rps, sas) => { const s = orbit(['core', 't1', 'petrel']), e = s.parts.find(p => p.d.kind === 'engine'), c = 0.5 / deg;
    e.tdir = [Math.sin(c), Math.cos(c), 0]; s.w = toI(s, [0, rps * 2 * Math.PI, 0]); D.stage(s); s.throttle = 1; if (sas) Object.assign(s, { sas: true, sasMode: 'stab', spun: true });
    const Y0 = toI(s, [0, 1, 0]); let dv = [0, 0, 0], t = 0; while (t < 120) { D.physStep(s, D.DT); t += D.DT; if (s.thrust === 0) break; dv = D.add(dv, D.mul(toI(s, s.aB), D.DT)); }
    const along = D.dot(dv, Y0); return { off: Math.atan2(D.len(D.sub(dv, D.mul(Y0, along))), along) * deg, spin: D.dot(s.w, toI(s, [0, 1, 0])) / 2 / Math.PI }; };
  const b0 = burn(0), b2 = burn(2), bS = burn(1, true);
  check('spin: a kick stage with its thrust ½° off the axis tumbles unspun; spun at 2 rev/s its Δv goes within ½° of where it pointed; SAS on a spun stage keeps the spin',
    b0.off > 20 && b2.off < 0.5 && bS.off < 0.5 && bS.spin > 0.99, `Δv off the axis: unspun ${b0.off.toFixed(1)}°, 2 rev/s ${b2.off.toFixed(2)}°, 1 rev/s with SAS ${bS.off.toFixed(2)}° (spin kept: ${bS.spin.toFixed(3)} rev/s)`);
  // spin motors under a kick stage fire at the separation that lights it, at the rate the builder said; time warp keeps the
  // spin; a roll key under SAS takes the roll back and SAS spins it down
  {
    const stack = ['core', 't1', 'petrel', 'spin', 'dec', 't2', 'kestrel'], est = D.controlReport(D.newShip(stack)).spin[0];
    const s = orbit(stack); Object.assign(s, { sas: true, sasMode: 'stab' }); msgs.length = 0;
    D.stage(s); for (let i = 0; i < 25; i++) D.physStep(s, D.DT); const early = !!s.spun; D.stage(s); s.throttle = 1;
    for (let i = 0; i < 150; i++) D.physStep(s, D.DT);
    const rpm = () => D.dot(s.w, toI(s, [0, 1, 0])) * 60 / 2 / Math.PI, flown = rpm(); s.throttle = 0; D.advRails(s, 600, 1000); const warped = rpm();
    D.INP.roll = 1; D.physStep(s, D.DT); D.INP.roll = 0; for (let i = 0; i < 500; i++) D.physStep(s, D.DT);
    check('spin motors: fire at the separation that lights their stage, at the rate the builder shows; time warp keeps the spin; a roll key under SAS takes it back',
      !early && msgs.some(m => /Spin motors firing/.test(m)) && Math.abs(flown / est - 1) < 0.05 && Math.abs(warped / flown - 1) < 0.01 && !s.spun && Math.abs(rpm()) < 0.5 * flown,
      `builder ${est.toFixed(0)} rpm, flown ${flown.toFixed(0)}, after warp ${warped.toFixed(0)}, after a roll key ${rpm().toFixed(0)} rpm (spun: ${s.spun})`);
  }
}

// control-5. The wheels won't spin a vessel apart (control session; PLAYTEST #18). With SAS off a held key used to spin the
// Orbiter's upper stage to 23 rad/s in 9 s and tear the pod off (a bare pod: 66 rad/s in 2 s, chute torn off), because 100
// kN·m·s of storage is tens of rad/s on a light stage. The wheels now refuse to turn a vessel past WHEEL_W. Own instance.
{
  const D = new Function(src + 'return {newShip,physStep,PRESETS,WHEEL_W,len,TELLUS,HOOK,INP,DT,set S(v){S=v},set t(v){simT=v}};')();
  const msgs = []; D.HOOK.msg = m => msgs.push(m); D.HOOK.debris = () => {}; D.HOOK.rebuild = () => {}; D.HOOK.boom = () => {};
  const held = stack => { D.t = 0; const s = D.newShip(stack), T = D.TELLUS, r0 = T.R + T.atm + 100e3; D.S = s; msgs.length = 0;
    Object.assign(s, { landed: false, throttle: 0, sas: false, r: [r0, 0, 0], v: [0, 0, -Math.sqrt(T.mu / r0)] });
    D.INP.pitch = 1; let w = 0; for (let i = 0; i < 3000; i++) { D.physStep(s, D.DT); w = Math.max(w, D.len(s.w)); } D.INP.pitch = 0;
    return { w, broke: msgs.some(m => /Structural/.test(m)), wheels: D.len(s.wH || [0, 0, 0]) / s.hmax, sat: s.hmax / s.I[0] }; };
  const up = held(['chute', 'pod', 't2', 'petrel']), pod = held(['chute', 'pod']), orb = held(D.PRESETS.Orbiter);
  check('wheels: a key held for 60 s with SAS off turns a light stage or a bare pod no faster than the wheels\u2019 limit, and nothing breaks; the Orbiter still runs out of storage first',
    up.w <= D.WHEEL_W[0] + 1e-6 && pod.w <= D.WHEEL_W[0] + 1e-6 && !up.broke && !pod.broke && orb.wheels > 0.99 && Math.abs(orb.w / orb.sat - 1) < 0.02,
    `upper stage ${up.w.toFixed(2)} rad/s, pod ${pod.w.toFixed(2)} rad/s (limit ${D.WHEEL_W[0]}); Orbiter ${orb.w.toFixed(3)} rad/s at ${(orb.wheels * 100).toFixed(0)} % full (storage ÷ inertia ${orb.sat.toFixed(3)})`);
}

// 36. Launch-site follow-ups (terrain session): the sea platform, weather scrubs, and the downrange warning.
{
  const P = api.PROG, SI = api.SITES, R = TELLUS.R, D = Math.PI / 180;
  // a floating pad on the equator in open ocean: not levelled, ≥ 300 km from land, open to any program, the ship on its deck
  const sea = SI.find(t => t.kind === 'sea');
  let farLand = true; for (let a = 0; a < 12; a++) for (const km of [100, 200, 300]) if (api.isLand(api.alongAz(sea.u, a * Math.PI / 6, km * 1e3 / R))) farLand = false;
  const x = api.newShip(api.PRESETS.Orbiter, sea);
  check('sea platform: on the equator over deep water (not levelled into an island), ≥ 300 km from land, open to anyone, the ship on its deck',
    sea && Math.abs(sea.lat) < 1 && api.terrainH(sea.u) < -500 && farLand && api.siteAccessOf(sea).ok && sea.downrange.sea > 0.95
      && Math.abs(len(x.r) - (R + api.SEA_DECK - x.yBot)) < 1e-6,
    `${sea.name} at ${sea.lat.toFixed(2)}°, ${(-api.terrainH(sea.u)).toFixed(0)} m of water, downrange ${(sea.downrange.sea * 100).toFixed(0)}% water`);
  // weather: on a storm day at a site, the launch slips day by day until the sky clears
  const home = SI[0], keepDay = P.day, news = []; const keepNews = api.HOOK.news; api.HOOK.news = t => news.push(t);
  let d0 = -1; for (let d = 1; d < 4000 && d0 < 0; d++) if (api.siteWeather(home, d * api.DAY_S).scrub && !api.siteWeather(home, (d - 1) * api.DAY_S).scrub) d0 = d;
  let bad = 0; while (api.siteWeather(home, (d0 + bad) * api.DAY_S).scrub && bad < api.SCRUB_MAX) bad++;
  P.day = d0; const y = api.newShip(api.PRESETS.Orbiter, home), n = api.weatherHold(y), clearDay = P.day;
  P.day = d0 - 1; const n0 = api.weatherHold(api.newShip(api.PRESETS.Orbiter, home));
  P.day = keepDay; api.HOOK.news = keepNews;
  check('weather: a storm over the pad slips the launch a day at a time until it clears; a clear day launches on time',
    d0 > 0 && n === bad && clearDay === d0 + bad && (bad === api.SCRUB_MAX || !api.siteWeather(home, clearDay * api.DAY_S).scrub) && n0 === 0 && news.some(t => /Weather scrub/.test(t)),
    `day ${d0}: storms for ${bad} day(s) → slipped ${n}; "${news.find(t => /Weather scrub/.test(t))}"`);
  // downrange: a warning names other powers under the corridor (not ours, not the host's own land)
  const warned = SI.filter(t => api.downrangeWarning(t)), quiet = SI.filter(t => t.downrange.over.some(i => i !== t.power) && !api.downrangeWarning(t));
  check('downrange warning: names the other powers under a site\'s corridor; our own land and the host\'s are not warned about',
    api.downrangeWarning(home) === '' && warned.length > 0 && warned.every(t => t.downrange.over.some(i => i !== api.HOME && i !== t.power))
      && quiet.every(t => t.downrange.over.every(i => i === api.HOME || i === t.power)),
    `${warned.length} site(s) warned, e.g. "${warned[0] ? api.downrangeWarning(warned[0]) : ''}"`);
}

// 38. The service gantry clears the rocket (tester session; PLAYTEST #2). The page's own buildRig and padRig run with
// stubs that record every box and lattice column; then the gantry's whole roll-back, from service position to its parking
// spot, is swept against each preset's envelope (|x|, |z| of its widest reach, up to its top). Before the fix, girders
// across the open front swept through every rocket, and the decks reached into the Crewed Lunar's boosters.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (a, b) => { const i = page.indexOf(a); return i < 0 ? '' : page.slice(i, page.indexOf(b, i + a.length)); };
  const rigSrc = cut('function buildRig(TH,rig){', '\n// The tower is sized'), padRigSrc = cut('function padRig(TH){', '\nfunction padSync');
  const D = new Function(src + `let mode='flight';const LIFT=3,PAD_GX=10.5,BOXES=[];
    const box=(o,c,hx,hy,hz)=>o.push({c:c.slice(),h:[hx,hy,hz]}),lattice=(o,x,z,w,Hh)=>o.push({c:[x,Hh/2,z],h:[w/2,Hh/2,w/2]}),tube=()=>{},makeMesh=a=>({a,free(){}});
    ${rigSrc}\n${padRigSrc}
    return {buildRig,padRig,newShip,PRESETS,set S(v){S=v}};`)();
  const bad = [];
  for (const [k, st] of Object.entries(D.PRESETS)) {
    const s = D.newShip(st); D.S = s; const TH = Math.min(60, Math.max(12.5, Math.ceil((s.len + 3) / 2.5) * 2.5)), rig = D.padRig(TH), R = D.buildRig(TH, rig);
    let xr = 0, zr = 0; for (const p of s.parts) { xr = Math.max(xr, Math.abs(p.pos[0]) + p.d.r); zr = Math.max(zr, Math.abs(p.pos[2]) + p.d.r); }
    let hit = null;
    for (let i = 0; i <= 200 && !hit; i++) { const zS = R.zS ?? -3.3, zg = zS + (-80 - zS) * i / 200;   // (-3.3: the fixed service position before)
      for (const b of R.gantry.a) { const [cx, cy, cz] = b.c, [hx, hy, hz] = b.h;
        if (Math.abs(cx) - hx < xr && Math.abs(cz + zg) - hz < zr && cy - hy < s.len) { hit = `${k}: box at (${cx.toFixed(1)}, ${cy.toFixed(1)}, ${cz.toFixed(1)}) with the gantry at z ${zg.toFixed(1)}`; break; } } }
    if (hit) bad.push(hit);
  }
  check('the service gantry never touches the rocket, from service position all the way back (every preset, boosters included)', !bad.length, bad.slice(0, 3).join(' | ') || `${Object.keys(D.PRESETS).length} presets`);
  const sOrb = D.newShip(D.PRESETS.Orbiter); D.S = sOrb; const zOrb = D.buildRig(20, D.padRig(20)).zS;
  const sCL = D.newShip(D.PRESETS['Crewed Lunar']); D.S = sCL; const zCL = D.buildRig(45, D.padRig(45)).zS;
  check('a narrow rocket keeps the old service position; a wide one gets the gantry stopped further back', zOrb === -3.3 && zCL < -3.3, `Orbiter ${zOrb} m, Crewed Lunar ${zCL?.toFixed(2)} m`);
}

// 39. Selene tidally locked; rover power and contact (sats session, rovers R3). Own sim instance.
{
  const D = new Function(src + 'return {advanceDays,rvNew,rvRun,rvPowerStep,rvSunPF,bodyTheta,bodyOmega,rvFieldTick,rvContact,rvCommand,rvEntry,bodyRel,bodyPos,fromPF,surfVel,SELENE,TELLUS,PROG,HOOK,DAY_S,get orb(){return ORB_T0},set orb(v){ORB_T0=v}};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {};
  const B = D.SELENE, P = D.PROG, orbit = 2 * Math.PI / B.n;
  // locked: the near side (planet-fixed −X) faces Tellus all orbit; a spot's sun goes round once an orbit; the ground moves
  let worst = 1, lo = 1, hi = -1; for (let i = 0; i < 24; i++) { const t = orbit * i / 24, w = D.fromPF(B, [-1, 0, 0], t), toT = norm(sub(D.bodyPos(D.TELLUS, t), D.bodyPos(B, t)));
    worst = Math.min(worst, dot(w, toT)); const s = dot([-1, 0, 0], D.rvSunPF(B, D.bodyTheta(B, t))); lo = Math.min(lo, s); hi = Math.max(hi, s); }
  const ve = len(D.surfVel(B, [B.R, 0, 0]));
  check('Selene is tidally locked: its near side faces Tellus all orbit, a day there lasts an orbit, its ground moves', worst > 1 - 1e-9 && lo < -0.95 && hi > 0.95 && Math.abs(ve - B.R * Math.abs(D.bodyOmega(B))) < 1e-6 && ve > 5,
    `near side off Tellus by ${(Math.acos(Math.min(1, worst)) * 180 / Math.PI).toExponential(1)}°; a day of ${(orbit / 3600).toFixed(0)} h; the equator moves at ${ve.toFixed(2)} m/s`);
  const p0 = D.bodyRel(B, 5000)[0]; D.orb = 12345; const p1 = D.bodyRel(B, 5000 - 12345)[0]; D.orb = 0;
  check('the moons run on program time: a flight that starts later finds them further along', len(sub(p0, p1)) < 1e-6, `${len(sub(p0, p1)).toExponential(1)} m`);
  // power at a near-side spot: panels charge it by day; without panels or an RTG it freezes in the night; an RTG keeps it going
  const mk = (slots, E = 1, pf = [-B.R, 0, 0]) => { const R = D.rvNew({ name: 'x', ch: 'm', wh: 'm', n: 6, spr: 'S', slots }, B, pf, [0, 1, 0], {}); R.name = 'x'; R.sleep = true; R.E = R.Emax * E; return R; };
  const run = (R, t0, t1) => { for (let t = t0; t < t1; t += 600) D.rvPowerStep(R, 600, D.rvSunPF(B, D.bodyTheta(B, t))); };
  let noon = 0; while (noon < orbit && dot([-1, 0, 0], D.rvSunPF(B, D.bodyTheta(B, noon))) < 0.99) noon += 600;
  const a = mk(['cam', 'bat', 'ant', 'sol', null], 0.5), e0 = a.E; run(a, noon - 6 * 3600, noon + 6 * 3600);
  const b = mk(['cam', 'bat', 'ant', null, null], 0.2), c = mk(['cam', 'bat', 'ant', 'rtg', null], 0.2); run(b, noon, noon + orbit); run(c, noon, noon + orbit);
  check('rover power: panels charge it by day; with no panels and no RTG it freezes in the night; an RTG keeps it going', a.E > e0 && b.dead && !c.dead && c.E > 0,
    `+${((a.E - e0) / 3.6e6).toFixed(2)} kWh around noon; froze: ${b.dead}; with the RTG ${(c.E / 3.6e6).toFixed(2)} kWh after an orbit`);
  // between flights: one with panels lives through Selene's nights; one without freezes, and the news says so
  P.rvOut = [{ ...D.rvEntry(mk(['cam', 'bat', 'ant', 'sol', null])), name: 'Panels' }, { ...D.rvEntry(mk(['cam', 'bat', 'ant', null, null])), name: 'NoPanels' }];
  P.day = 0; D.advanceDays(40);
  check('between flights a rover with panels lives through Selene\'s nights; one without freezes, and the news says so', !P.rvOut[0].dead && P.rvOut[1].dead && news.some(m => /NoPanels froze/.test(m)),
    `40 days: Panels ${(P.rvOut[0].E / 3.6e6).toFixed(2)} kWh; NoPanels froze`);
  // contact: the near side talks home directly (a light-time round trip late); the far side can't; without a high-gain
  // antenna it needs a relay in sight (a lander 1 km away, but not 6 km: over the horizon)
  const near = mk(['cam', 'bat', 'ant', 'sol', null]), far = mk(['cam', 'bat', 'ant', 'sol', null], 1, [B.R, 0, 0]), lg = mk(['cam', 'bat', null, 'sol', null]);
  const rel = km => [{ body: B, pf: mul([-Math.cos(km * 1e3 / B.R), 0, Math.sin(km * 1e3 / B.R)], B.R), h: 4, name: 'Lander' }];
  const cN = D.rvContact(near, 0, []), cF = D.rvContact(far, 0, []), c0 = D.rvContact(lg, 0, []), c1 = D.rvContact(lg, 0, rel(1)), c6 = D.rvContact(lg, 0, rel(6));
  const lt = 2 * len(sub(D.bodyPos(B, 0), D.bodyPos(D.TELLUS, 0))) / 299792458;
  check('rover contact: near side direct to home, a light-time late; far side none; without a high-gain antenna only through a lander in sight', cN.ok && cN.via === 'home' && Math.abs(cN.delay - lt) < 0.01 && !cF.ok && !c0.ok && c1.ok && c1.via === 'Lander' && !c6.ok,
    `round trip ${(cN.delay * 1000).toFixed(0)} ms; far ${cF.ok}; low-gain alone ${c0.ok}, lander at 1 km ${c1.ok}, at 6 km ${c6.ok}`);
  // commands: out of contact it holds still; in contact, a command acts a round trip later
  D.rvCommand(far, { thr: 1, steer: 0, brake: false }, cF); const held = far.in.thr === 0 && far.in.brake;
  near.sleep = false; D.rvCommand(near, { thr: 1, steer: 0, brake: false }, cN); const early = near.in.thr; D.rvRun(near, 0.2); D.rvRun(near, 0.2); D.rvCommand(near, { thr: 1, steer: 0, brake: false }, cN);
  check('rover commands: out of contact it holds still; in contact a command acts a round trip late', held && early === 0 && near.in.thr === 1, `held ${held}; at once ${early}, after ${(cN.delay * 1000).toFixed(0)} ms ${near.in.thr}`);
  P.rvOut = [];
}

// 40. The Selene relay (sats session): orbits about a moon in the registry, in its frame; relays for far-side rovers;
// Tellus's tide between flights. Own sim instance.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,satsUp,moonSats,advanceDays,vesselOf,satAt,elements,rvNew,rvContact,rvRelays,bodyPos,SELENE,TELLUS,PROG,HOOK,DAY_S};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {};
  const B = D.SELENE, P = D.PROG; P.sats = []; P.day = 0;
  // a Probe (camera, instruments, antenna), or one with only the antenna, at periapsis of an orbit about Selene
  const put = (alt, inc, e = 0, bare = false) => { const s = D.newShip(D.PRESETS.Probe), rp = B.R + alt, v0 = Math.sqrt(B.mu * (1 + e) / rp), c = Math.cos(inc * Math.PI / 180), si = Math.sin(inc * Math.PI / 180);
    if (bare) for (const p of s.parts) if (p.d.kind === 'cam' || p.d.kind === 'sci') p.on = false;
    Object.assign(s, { alive: true, landed: false, body: B, r: [rp, 0, 0], v: [0, v0 * si, -v0 * c] }); return s; };
  const reg = (...a) => { const n = P.sats.length; D.satRegister(put(...a), { day0: 0 }); return P.sats.length > n ? P.sats.at(-1) : null; };
  const q1 = reg(1000e3, 0, 0, true), low = reg(3e3, 0), wide = reg(1000e3, 0, 0.9);
  const v = q1 && D.vesselOf(q1, 5000), dv = v && len(sub(v.r, D.satAt(q1, 5000)[0]));
  check('a vessel left in Selene orbit is registered in Selene\'s frame (a Relay, if an antenna is all it has); one that skims the ground or leaves the SOI is not (it is in flight, Q49)',
    q1 && q1.bodyName === 'Selene' && /^Relay/.test(q1.name) && !D.satsUp().includes(q1) && D.moonSats(B).includes(q1) && (!low || low.cruise) && (!wide || wide.cruise) && !D.moonSats(B).includes(low) && !D.moonSats(B).includes(wide) && v.body === B && dv < 1e-6,
    `${q1 ? q1.name : '—'}; Tellus list ${D.satsUp().length}, Selene list ${D.moonSats(B).length}; 3 km periapsis ${low ? (low.cruise ? 'in flight' : 'kept') : 'refused'}, apoapsis past the SOI ${wide ? (wide.cruise ? 'in flight' : 'kept') : 'refused'}; flown again around ${v ? v.body.name : '—'}`);
  // a far-side rover (high-gain antenna, Tellus never up) hears home only through a relay over its horizon that sees Tellus
  const rov = D.rvNew({ name: 'x', ch: 'm', wh: 'm', n: 6, spr: 'S', slots: ['cam', 'bat', 'ant', 'sol', null] }, B, [B.R, 0, 0], [0, 1, 0], {});
  const frac = (alt, rel) => { const per = 2 * Math.PI * Math.sqrt((B.R + alt) ** 3 / B.mu); let n = 0, N = 0, via = null, dl = 0, tOk = null;
    for (let t = 0; t < 3 * per; t += per / 300) { const c = D.rvContact(rov, t, rel()); N++; if (c.ok) { n++; via = c.via; dl = Math.max(dl, c.delay); tOk = tOk ?? t; } } return { f: n / N, via, dl, tOk }; };
  const alone = frac(1000e3, () => []), hi = frac(1000e3, () => D.rvRelays([])), lt = 2 * len(sub(D.bodyPos(B, 0), D.bodyPos(D.TELLUS, 0))) / 299792458;
  // a vessel of this flight in orbit relays too: put one where the registered relay was in contact, with the register empty
  const sh = put(1000e3, 0); sh.r = D.satAt(q1, hi.tOk)[0]; P.sats = []; const fl = D.rvContact(rov, hi.tOk, D.rvRelays([sh]));
  reg(100e3, 0, 0, true); const lo = frac(100e3, () => D.rvRelays([]));
  check('the far side hears home through a relay in Selene orbit: about a third of the time from 1,000 km, never from 100 km (Selene is in the way), the extra leg up to the relay on its round trip; a vessel of the flight relays too',
    alone.f === 0 && hi.f > 0.25 && hi.f < 0.45 && /^Relay/.test(hi.via) && hi.dl > lt + 2 * 1000e3 / 299792458 && lo.f === 0 && fl.ok && fl.via === 'the orbiter',
    `alone ${(alone.f * 100).toFixed(0)}%; relay at 1,000 km ${(hi.f * 100).toFixed(1)}% via ${hi.via}, up to ${(hi.dl * 1000).toFixed(0)} ms (direct ${(lt * 1000).toFixed(0)}); at 100 km ${(lo.f * 100).toFixed(0)}%; the flight's orbiter ${fl.ok ? 'relays' : 'does not'}`);
  // between flights Tellus's tide works on them: equatorial orbits keep their shape; high polar ones are pumped into the
  // ground (2,000 km, ~day 41) or out of the SOI (3,000 km, ~day 21; Tellus days of 8 h), matching a 5 s RK4 to within a step (NOTES)
  P.sats = []; news.length = 0; const dry = q => { for (const o of q.shape) if (o.res) for (const k in o.res) o.res[k] = 0; return q; };   // nothing to hold them (space Q50: propellant would)
  const qe = dry(reg(1000e3, 0, 0, true)), qg = dry(reg(2000e3, 90, 0, true)), qs = dry(reg(3000e3, 90, 0, true));
  D.advanceDays(45); const el = D.elements(qe.r, qe.v, B.mu);
  check('between flights Tellus\'s tide works on Selene orbits: an equatorial relay keeps its shape; a high polar one is pulled into the ground, a higher one out of the SOI (into Tellus\'s registry)',
    P.sats.includes(qe) && el.pe > B.R + 950e3 && el.ap < B.R + 1050e3 && !P.sats.includes(qg) && D.satsUp().includes(qs) && !qs.bodyName && news.some(m => /came down on Selene/.test(m)) && news.some(m => /slipped out/.test(m)),
    `45 days: equatorial ${((el.pe - B.R) / 1e3).toFixed(0)}–${((el.ap - B.R) / 1e3).toFixed(0)} km; 2,000 km polar ${P.sats.includes(qg) ? 'still up' : 'came down'}; 3,000 km polar ${qs.bodyName ? 'still around Selene' : 'now orbits Tellus'}`);
  P.sats = [];
}

// 41. Rendezvous with moon orbiters (sats session): §25's docking scene, moved to a 100 km Selene orbit. The target, the
// closest approach, contact and capture, undocking back into Selene's register, and loading. Own sim instance.
{
  const D = new Function(src + 'return {newShip,physStep,contactStep,satRegister,satAt,undock,tgtOf,approach,hitNear,nearbyFlyable,moonSats,kepler,FLEET,PROG,SELENE,TELLUS,DT,qrot,qmul,qaxis,HOOK,get t(){return simT},set t(v){simT=v}};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {};
  const B = D.SELENE, P = D.PROG;
  const scene = ({ gap = 0.3, close = 0.2, tilt = 3 } = {}) => {
    Object.assign(P, { day: 0, sats: [], satN: 0 }); D.t = 0;
    const s = D.newShip(['port', 'pod', 't1', 'kestrel']), r0 = B.R + 100e3; Object.assign(s, { body: B, landed: false, sas: false, throttle: 0, w: [0, 0, 0] });
    s.rec.launched = true; s.rec.day0 = 0; s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(B.mu / r0)];
    const Y = D.qrot(s.q, [0, 1, 0]), k = D.newShip(['port', 'pod', 'petrel']); Object.assign(k, { body: B, landed: false }); k.rec.launched = true; k.rec.day0 = 0;
    k.q = D.qmul(D.qaxis([0, 0, 1], Math.PI + tilt * Math.PI / 180), s.q); k.r = add(add(s.r, mul(Y, s.yTop + gap + k.yTop)), [0, 0.04, 0]); k.v = s.v.slice(); D.satRegister(k, { day0: 0 });
    s.v = add(s.v, mul(Y, close)); return { s, q: P.sats[0] };
  };
  const fly = (s, n, stop) => { for (let i = 0; i < n && !(stop && stop()); i++) { D.physStep(s, D.DT); D.contactStep(s, D.DT); } };
  // the target: found around Selene; a Tellus satellite can't be one from here. Closest approach on Selene's μ, against a fine scan
  let { s, q } = scene({ gap: 50e3 }); s.target = q.id; const T1 = D.tgtOf(s);
  const [rt, vt] = D.satAt(q, 1000), [r1, v1] = D.kepler(add(rt, [0, 300, 0]), add(vt, [0, 0, 8]), -1000, B.mu), per = 2 * Math.PI * Math.sqrt(len(r1) ** 3 / B.mu), ca = D.approach(q, r1, v1, 0, per, B.mu);   // a pass 300 m off at t = 1000 s
  let fine = Infinity; for (let t = 0; t <= per; t += 0.5) fine = Math.min(fine, len(sub(D.kepler(r1, v1, t, B.mu)[0], D.satAt(q, t)[0])));
  P.sats.push({ id: 99, name: 'Tellus sat', r: [B.R * 10, 0, 0], v: [0, 0, 1], epoch: 0, shape: [] }); s.target = 99; const T2 = D.tgtOf(s);
  check('rendezvous at Selene: a Selene orbiter is a target, its closest approach found on Selene\'s gravity; a Tellus satellite is not a target from there',
    T1 && T1.q === q && Math.abs(len(T1.dr) - 50e3) < 10e3 && ca.d <= 300 && Math.abs(ca.d - fine) < 1 && Math.abs(ca.t - 1000) < 60 && !T2,
    `target ${T1 ? (len(T1.dr) / 1e3).toFixed(1) + ' km' : 'none'}; closest approach ${ca.d.toFixed(1)} m at ${ca.t.toFixed(0)} s (scan ${fine.toFixed(1)} m); Tellus satellite targetable: ${!!T2}`);
  // contact and capture: 0.2 m/s, 4 cm and 3° off latches; momentum kept, masses summed; rails held off nearby; loadable
  ({ s, q } = scene()); const near = D.hitNear(s), load = D.nearbyFlyable(s).includes(q), m0 = s.mass, mq = q.mass; let mom = null;
  for (let i = 0; i < 300 && !s.att.length; i++) { D.physStep(s, D.DT); const [, vq] = D.satAt(q, D.t), p0 = add(mul(s.v, s.mass), mul(vq, q.mass)); D.contactStep(s, D.DT);
    if (s.att.length) mom = len(sub(mul(s.v, s.mass), p0)) / len(p0); }
  check('docking at Selene: ports latch as at home (momentum kept, masses summed); physics, not rails, near the target; it can be loaded into the flight',
    s.att.length === 1 && s.att[0].e === q && q.docked && mom < 1e-12 && Math.abs(s.mass - m0 - mq) < 1e-6 && near && load,
    `latched ${s.att.length === 1}; momentum error ${mom != null ? mom.toExponential(1) : '—'}; rails held off ${near}; loadable ${load}`);
  // undocking (it has a pod, so it leaves as a vessel of this flight) leaves it around Selene where it was; at 1 m/s, a bump
  const cmQ = add(s.r, D.qrot(s.q, sub(s.att[0].p, s.cm))); D.FLEET.length = 0; D.undock(s, q.id); const u = D.FLEET.find(v => v.name === q.name);
  const back = !q.docked && q.bodyName === 'Selene' && u && u.body === B && len(sub(u.r, cmQ)) < 1;
  ({ s, q } = scene({ close: 1 })); fly(s, 200, () => q.spin); const bumped = !s.att.length && !!q.spin;
  check('undocking at Selene leaves the other vessel around Selene, where it was; at 1 m/s the ports bump instead',
    back && bumped, `undocked around ${u ? u.body.name : '—'}, ${u ? len(sub(u.r, cmQ)).toExponential(1) : '—'} m from where it was; 1 m/s: ${bumped ? 'bumped' : 'latched'}`);
  P.sats = [];
}

// 42. Rover science, R4 first slice (sats session): Selene's geology as drawn; the spectrometer, the panorama camera and
// the seismic network, each counting only when its data reaches home. Own sim instance.
{
  const D = new Function(src + 'return {geoAt,selMare,rvNew,rvSci,rvSciSend,rvContact,rvRelays,rvEntry,rvFromEntry,rvSunPF,thAbs,selSci,advanceDays,satRegister,newShip,PRESETS,SEL_CORE,SELENE,TELLUS,PROG,HOOK,DAY_S,fbm,MARE_NEAR};')();
  const msgs = []; D.HOOK.news = m => msgs.push(m); D.HOOK.msg = m => msgs.push(m);
  const B = D.SELENE, P = D.PROG; P.day = 0; P.sats = []; P.log = {};
  // geology: the unit follows the drawn dark patches (the shader's mask, recomputed here); maria are iron-rich
  // a Fibonacci lattice (z evenly spaced, the golden angle around). It used to take z from the golden fraction too, which
  // tied z to the angle and put all 3,000 points on one spiral curve: shares came out biased (9.7 % for a true 8.4 %)
  const pts = []; for (let i = 0; i < 3000; i++) { const z = 1 - (2 * i + 1) / 3000, a = i * 2.39996, s = Math.sqrt(1 - z * z); pts.push([s * Math.cos(a), z, s * Math.sin(a)]); }
  let agree = 0, nm = 0; const fe = { mare: 0, high: 0 }, fn = { mare: 0, high: 0 };
  for (const u of pts) { const g = D.geoAt(B, mul(u, B.R)), x = Math.min(1, Math.max(0, (D.fbm(u[0] * 1.6 + 3, u[1] * 1.6 + 3, u[2] * 1.6 + 3) - D.MARE_NEAR * u[0] - .5) / .15)), M = x * x * (3 - 2 * x);
    if ((M >= .2) === (g.unit === 'mare')) agree++; if (g.unit === 'mare') nm++; fe[g.unit] += g.FeO; fn[g.unit]++; }
  const feM = fe.mare / fn.mare, feH = fe.high / fn.high, share = nm / pts.length;
  check('Selene\'s geology follows the dark patches the sky shader draws: mare basalt (iron-rich) on them, highland rock elsewhere',
    agree === pts.length && share > .10 && share < .20 && feM > 2 * feH && !D.geoAt(D.TELLUS, [1, 0, 0]),
    `${(share * 100).toFixed(1)} % mare; FeO ${feM.toFixed(1)} % on mare, ${feH.toFixed(1)} % on highland; unit agrees with the shader's mask at ${agree}/${pts.length} points`);
  // spots: a near-side mare (talks home directly) and a far-side highland (needs a relay). Since GROUND.md G2 the maria
  // are on the near side, as on our Moon (they were on the far side, and the spots the other way round)
  const far = pts.filter(u => u[0] > .2 && D.geoAt(B, mul(u, B.R)).unit === 'high').sort((p, q) => Math.abs(p[1]) - Math.abs(q[1]))[0], hi = pts.filter(u => u[0] < -.8 && D.geoAt(B, mul(u, B.R)).unit === 'mare').sort((p, q) => Math.abs(p[1]) - Math.abs(q[1]))[0];   // near the equator: the panoramas need a high noon sun
  const mk = (u, slots) => { const R = D.rvNew({ name: 'x', ch: 'l', wh: 'm', n: 6, spr: 'S', slots }, B, mul(u, B.R), [0, 1, 0], {}); R.name = 'Sci'; R.id = 7; return R; };
  const kit = ['spec', 'cam', 'seis', 'ant', 'bat', 'sol', null, null];
  const Rn = mk(hi, kit), Rf = mk(far, kit), Rx = mk(hi, ['bat', 'sol', null, null, null, null, null, null]);
  Rn.v = [0.5, 0, 0]; const moving = D.rvSci(Rn, 'spec', 0); Rn.v = [0, 0, 0];
  const g0 = D.geoAt(B, Rn.p), okN = D.rvSci(Rn, 'spec', 0), dup = D.rvSci(Rn, 'spec', 0), none = D.rvSci(Rx, 'spec', 0);
  const before = !!P.log.semare, sent = D.rvSciSend(Rn, D.rvContact(Rn, 0, [])), e = P.log.semare;
  check('the spectrometer reads the rock under a stopped rover (once per spot), and it counts when it reaches home: a near-side mare reading in the logbook',
    okN && !dup && !none && !moving && !before && sent === 1 && e && Math.abs(e.v.FeO - g0.FeO) < 4 && e.v.n === 1,
    `read ${okN}, again here ${dup}, without one ${none}, moving ${moving}; logbook before sending ${before}, after: FeO ${e ? e.v.FeO.toFixed(1) : '—'} % (truth ${g0.FeO.toFixed(1)})`);
  // far side: the reading waits in the field (no contact) until a relay is up, then arrives between flights
  D.rvSci(Rf, 'spec', 0); const held = D.rvSciSend(Rf, D.rvContact(Rf, 0, [])) === 0 && Rf.data.length === 1;   // no contact: nothing goes
  P.rvOut = [D.rvEntry(Rf)]; D.advanceDays(2); const waited = held && !P.log.sehigh && P.rvOut[0].data.length === 1;
  const sat = D.newShip(D.PRESETS.Probe), a = B.R + 1000e3; Object.assign(sat, { alive: true, landed: false, body: B, r: [a, 0, 0], v: [0, 0, -Math.sqrt(B.mu / a)] }); D.satRegister(sat, { day0: P.day });
  D.advanceDays(3); const arrived = !!P.log.sehigh && !P.rvOut[0].data.length;
  const back = D.rvFromEntry(P.rvOut[0]);
  check('a far-side reading waits in the field without contact, then reaches home through a relay between flights; field entries keep data, seismometers and read spots',
    waited && arrived && P.log.sehigh.v.FeO < 7 && back.reads.length === 1 && back.seisLeft === undefined,
    `waited ${waited}; arrived via the relay ${arrived} (highland FeO ${P.log.sehigh ? P.log.sehigh.v.FeO.toFixed(1) : '—'} %)`);
  // panoramas: the quality is the sun's height (long shadows best, noon flat, night refused)
  const elAt = T => Math.asin(dot(norm(Rn.p), D.rvSunPF(B, D.thAbs(B, T)))) * 180 / Math.PI, orbit = 2 * Math.PI / B.n;
  let tLow = null, tHigh = null, tDark = null; for (let T = 0; T < orbit; T += 600) { const el = elAt(T); if (tLow == null && el > 8 && el < 15) tLow = T; if (tHigh == null && el > 75) tHigh = T; if (tDark == null && el < -5) tDark = T; }
  Rn.data = []; D.rvSci(Rn, 'pano', tLow); D.rvSci(Rn, 'pano', tHigh); const dark = D.rvSci(Rn, 'pano', tDark), [pl, ph] = Rn.data;
  check('panorama quality follows the sun: long shadows at a low sun beat a flat noon; at night it refuses', pl && ph && pl.q > .9 && ph.q < .5 && !dark,
    `sun ${pl ? pl.el.toFixed(0) : '—'}°: ${pl ? (pl.q * 100).toFixed(0) : '—'} %; sun ${ph ? ph.el.toFixed(0) : '—'}°: ${ph ? (ph.q * 100).toFixed(0) : '—'} %; night ${dark}`);
  // seismic: four stations set out from rovers; a tight array hears quakes but can't place them; a wide one locates
  // them and brackets the hidden core
  const nearPt = (az, dist) => { const t = dist / B.R, d = [0, Math.sin(az), Math.cos(az)]; return mul(norm(add(mul([-1, 0, 0], Math.cos(t)), mul(d, Math.sin(t)))), B.R); };
  const array = (sp, side = 1) => { P.sel = null; P.sats = []; P.rvOut = []; P.log = {}; P.day = 0; const R = mk([-1, 0, 0], ['seis', 'ant', 'bat', 'sol', null, null, null, null]);
    for (const pf of [[-B.R, 0, 0], nearPt(0, sp), nearPt(2.1, sp), nearPt(4.2, sp)].map(p => [p[0] * side, p[1], p[2]])) { R.p = mul(pf, 1.0001); D.rvSci(R, 'seis', 0); }
    D.advanceDays(60); const S = D.selSci(); return { left: R.seisLeft, n: S.seis.length, heard: S.quakes.length, loc: S.quakes.filter(q => q.loc).length, c: S.core, buf: S.seis.reduce((a, s) => a + s.buf.length, 0) }; };
  const tight = array(2e3), farA = array(400e3, -1), wide = array(400e3), C = D.SEL_CORE;   // farA: the same array on the far side, no relay
  check('a seismic network: a tight array (2 km) hears moonquakes but can\'t place them; on the far side with no relay the records wait; a wide one (400 km) locates them and brackets the hidden core',
    tight.n === 4 && tight.left === 0 && tight.heard > 20 && tight.loc === 0 && farA.heard > 20 && farA.loc === 0 && farA.buf > 0 && wide.loc > 20 && wide.c && wide.c.lo < C && wide.c.hi > C && wide.c.hi - wide.c.lo < 40e3 && P.log.secore,
    `tight: ${tight.heard} heard, ${tight.loc} located; far side: ${farA.loc} located, ${farA.buf} records waiting; wide: ${wide.loc} located, core ${wide.c ? (wide.c.lo / 1e3).toFixed(0) + '–' + (wide.c.hi / 1e3).toFixed(0) : '—'} km (truth ${(C / 1e3).toFixed(0)})`);
  P.sel = null; P.rvOut = []; P.sats = [];
}

// 37b. Ground stations on real ground (terrain session, slice C): terrain masks the horizon; the flight's link; telemetry
// only certifies what reaches the ground (linked) or comes home on the recorder.
{
  const R = TELLUS.R, D = Math.PI / 180, U = (la, lo) => [Math.cos(la * D) * Math.cos(lo * D), Math.sin(la * D), Math.cos(la * D) * Math.sin(lo * D)];
  // a station at the foot of a range: find a spot whose horizon rises above 10° in some direction
  let st = null, azHi = -1, azLo = -1;
  for (let la = -60; la <= 60 && !st; la += 1) for (let lo = -180; lo < 180 && !st; lo += 1) {
    const u = U(la, lo); if (api.terrainH(u) < 0) continue; const cand = { name: 'test', u };
    // cheap pre-check: a big rise within 30 km
    let rise = 0; for (let a = 0; a < 8; a++) rise = Math.max(rise, api.terrainH(api.alongAz(u, a * Math.PI / 4, 20e3 / R)) - api.terrainH(u)); if (rise < 2500) continue;
    const m = api.gsMask(cand); let hi = -1, lo2 = -1; for (let i = 0; i < m.el.length; i++) { if (m.el[i] > 10 * D && hi < 0) hi = i; if (m.el[i] < 2 * D && lo2 < 0) lo2 = i; }
    if (hi >= 0 && lo2 >= 0) { st = cand; azHi = hi; azLo = lo2; } }
  const m = api.gsMask(st), P = mul(st.u, R + m.h0), f = api.siteFrame(st.u);
  const target = (azi, el, dist) => { const az = azi * 2 * Math.PI / m.el.length, dir = add(mul(f.n, Math.cos(az)), mul(f.e, Math.sin(az)));
    return add(P, mul(add(mul(dir, Math.cos(el)), mul(st.u, Math.sin(el))), dist)); };
  const behind = api.gsSees(st, target(azHi, 8 * D, 800e3)), open = api.gsSees(st, target(azLo, 8 * D, 800e3)), high = api.gsSees(st, target(azHi, 45 * D, 800e3));
  check('stations: a mountain masks a target at 8° elevation behind it; the same elevation over open ground is seen; overhead is always seen',
    !behind && open && high, `horizon ${(m.el[azHi] / D).toFixed(1)}° one way, ${(m.el[azLo] / D).toFixed(1)}° the other`);
  // the flight's link: the pad station sees a climbing rocket; the far side of the planet sees nothing; plasma blacks out
  api.t = 0; const s = api.newShip(api.PRESETS.Orbiter); s.landed = false; const home = api.SITES[0];
  s.r = api.fromPF(TELLUS, mul(home.u, R + 30e3), 0); const l1 = api.linkOf(s);
  s.r = api.fromPF(TELLUS, mul(mul(home.u, -1), R + 150e3), 0); const l2 = api.linkOf(s);
  s.r = api.fromPF(TELLUS, mul(home.u, R + 60e3), 0); s.qHeat = 2e5; s.v = add(api.surfVel(TELLUS, s.r), mul(api.localFrame(s.r).e, 3000)); const l3 = api.linkOf(s); s.qHeat = 0; s.v = api.surfVel(TELLUS, s.r);
  check('link: the pad sees the climb; the far side of the planet has no station in view; re-entry plasma blacks the link out',
    l1.ok && l1.st && !l2.ok && /no station/.test(l2.why) && !l3.ok && /blackout/.test(l3.why), `${l1.st && l1.st.name} · ${l2.why} · ${l3.why}`);
  // telemetry: out of contact, strain data goes to the recorder, not straight to certification
  const x = api.newShip(['sci', 'pod']); x.landed = false; x.rec.launched = true; x.r = api.fromPF(TELLUS, mul(mul(home.u, -1), R + 50e3), 0);
  x.v = api.surfVel(TELLUS, x.r); api.physStep(x, api.DT); for (const p of x.order) if (p.on && p.sk1) { p.sf1 = 0.3; p.sf2 = 0.3; } x.rec.lkT = undefined; api.missionTick(x, api.DT, true);   // one step sets the joints' strain keys
  const recOnly = Object.keys(x.rec.sfRec || {}).length > 0 && Object.keys(x.rec.sf).length === 0;
  check('telemetry: out of contact the strain data goes to the recorder (it certifies only if the package comes home)', recOnly,
    `recorder ${Object.keys(x.rec.sfRec || {}).join(', ')}; downlinked ${Object.keys(x.rec.sf).join(', ') || 'nothing'}`);
}

// 37c. Recovery by geography (terrain session, slice D): what lands whole must still be collected.
{
  const P = api.PROG, R = TELLUS.R, home = api.SITES[0], keepRel = JSON.parse(JSON.stringify(P.rel || {})), keepFac = P.fac;
  const at = (u, water) => { const s = api.newShip(['chute', 'pod']); s.landed = true; s.water = water; s.pf = mul(norm(u), R); return s; };
  const Rr = { launchPf: mul(home.u, R) };
  // the sea: within local boats' reach of the launch point, or beyond it (no recovery fleet built)
  let near = null, far = null;
  for (let k = 1; k <= 60 && !(near && far); k++) for (let a = 0; a < 12; a++) { const q = api.alongAz(home.u, a * Math.PI / 6, k * 20e3 / R);
    if (api.isLand(q)) continue; const d = k * 20; if (!near && d >= 60 && d <= 180) near = q; if (!far && d >= 900) far = q; }
  P.fac = {}; const rn = api.recoveryOf(at(near, true), Rr), rf = api.recoveryOf(at(far, true), Rr); P.fac = keepFac;
  // another power's land: friendly returns it, hostile keeps it
  const city = api.CITIES.find(c => c.power && c.power.i !== api.HOME), pi = city.power.i, key = api.pairKey(api.HOME, pi);
  P.rel[key] = 0.5; const rFriend = api.recoveryOf(at(city.u, false), Rr);
  P.rel[key] = -0.1; const rTense = api.recoveryOf(at(city.u, false), Rr);
  P.rel[key] = -0.6; const rHost = api.recoveryOf(at(city.u, false), Rr); P.rel = keepRel;
  check('recovery: the sea near the launch point is fished out, far out it is lost (no fleet); foreign land: returned, worn, or kept by relations',
    rn.factor === 1 && rf.factor === 0 && rFriend.factor === 1 && rTense.factor === 0.8 && rHost.factor === 0 && /keeps/.test(rHost.why),
    `${rn.why} · ${rf.why} · ${rFriend.why} · ${rHost.why}`);
}

// 37d. Geography in the work (terrain session, slice E): disasters follow the land; field stations and aurora soundings.
{
  const C = api.CITIES, n = {}, all = Object.keys(api.HAZ);
  for (const k of all) n[k] = api.disCities(k).length;
  const gs = C.map(api.cityGround), volc = api.disCities('Volcano'), fire = api.disCities('Wildfire');
  check('disasters follow the land: volcanoes only near volcanic ground, wildfire only near forest or savanna, each kind somewhere but not everywhere',
    all.filter(k => n[k] > 0).length >= 3 && all.every(k => n[k] < C.length) && volc.every(i => gs[i].has[12]) && fire.every(i => gs[i].has[3] || gs[i].has[5] || gs[i].has[9]),
    all.map(k => `${k} ${n[k]}/${C.length}`).join(', '));
  const f = api.fieldBiomes(), own = api.biomeAt(api.SITES[0].u).id, CTf = api.CT.field, CTa = api.CT.aurora;
  let seq = 0.37; const Rg = () => (seq = (seq * 9301 + 0.49297) % 1), p = CTf.gen(Rg), pa = CTa.gen(Rg);
  check('field stations: biomes within 1,200 km (not the pad\'s own), paid by distance; the landing has to be on that ground, with the package recovered',
    f.length > 0 && f.every(x => x.b !== own && x.km <= 1200) && f.some(x => x.b === p.b) && CTf.ok({ landed: true, recSci: true, landBiome: p.b }, p)
      && !CTf.ok({ landed: true, recSci: true, landBiome: (p.b + 1) % 15 }, p) && !CTf.ok({ landed: true, recSci: false, landBiome: p.b }, p),
    f.map(x => `${api.BIOMES[x.b]} ${x.km} km`).join(', ') + ` → "${CTf.title(p)}" pays ${p.pay}`);
  check('aurora sounding: needs the package above 100 km poleward of 55°, recovered; pays more the farther the zone is',
    CTa.ok({ recSci: true, aurora: 1 }, pa) && !CTa.ok({ recSci: true }, pa) && !CTa.ok({ recSci: false, aurora: 1 }, pa) && pa.pay >= 14,
    `${CTa.brief(pa)} (${api.polarKm().toFixed(0)} km to the zone, pays ${pa.pay})`);
}

// 39. The hold-downs clear the boosters (tester session). Four arms 90° apart, from posts to clamps on the rocket's base:
// on the diagonals unless boosters stand there, then turned into the gaps, each clamping the outermost part on its line.
// The page's own buildRig/padRig/holdPlan run with stubs; arms (up to 90 % of their length, short of the clamp) and posts
// are checked against every part's cylinder, for the presets and for boosters turned onto the diagonals.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (a, b) => { const i = page.indexOf(a); return i < 0 ? '' : page.slice(i, page.indexOf(b, i + a.length)); };
  const D = new Function(src + `let mode='flight';const LIFT=3,PAD_GX=10.5;
    const box=(o,c,hx,hy,hz)=>o.push({c:c.slice(),h:[hx,hy,hz]}),lattice=()=>{},tube=(o,A,B,r)=>o.push({A:A.slice(),B:B.slice(),r}),makeMesh=a=>({a,free(){}});
    ${cut('function buildRig(TH,rig){', '\n// The tower is sized')}\n${cut('function padRig(TH){', '\nfunction padSync')}
    return {buildRig,padRig,newShip,PRESETS,set S(v){S=v}};`)();
  const turn = (s, ang, drop) => { const c = Math.cos(ang), n = Math.sin(ang);
    if (drop != null) s.parts = s.parts.filter(p => Math.hypot(p.pos[0], p.pos[2]) < 0.05 || Math.abs(Math.atan2(p.pos[2], p.pos[0]) - drop) > 0.1);
    for (const p of s.parts) { const [x, , z] = p.pos; p.pos = [x * c - z * n, p.pos[1], x * n + z * c]; } return s; };
  const cases = Object.entries(D.PRESETS).map(([k, st]) => [k, D.newShip(st)]);
  cases.push(['Asparagus turned 45°', turn(D.newShip(D.PRESETS.Asparagus), Math.PI / 4)], ['Crewed Lunar turned 45°', turn(D.newShip(D.PRESETS['Crewed Lunar']), Math.PI / 4)],
    ['Crewed Lunar, 3 boosters', turn(D.newShip(D.PRESETS['Crewed Lunar']), Math.PI / 4, -Math.PI / 2)]);
  const bad = [], moved = [];
  for (const [k, s] of cases) {
    D.S = s; const TH = Math.min(60, Math.max(12.5, Math.ceil((s.len + 3) / 2.5) * 2.5)), rig = D.padRig(TH), R = D.buildRig(TH, rig);
    const inside = (q, r) => s.parts.find(p => { const y0 = p.y0 + rig.base; return q[1] >= y0 && q[1] <= y0 + p.h && Math.hypot(q[0] - p.pos[0], q[2] - p.pos[2]) < p.d.r + r; });
    for (const Hd of R.holds) { const t = Hd.mesh.a[0];
      for (let i = 0; i <= 36; i++) { const u = 0.9 * i / 36, q = t.A.map((v, j) => Hd.P[j] + v + (t.B[j] - v) * u), p = inside(q, t.r); if (p) { bad.push(`${k}: arm through ${p.d.key}`); break; } } }
    const posts = R.posts ? R.posts.a : [0, 1, 2, 3].map(i => { const a = Math.PI / 4 + i * Math.PI / 2; return { c: [3.4 * Math.cos(a), .25, 3.4 * Math.sin(a)], h: [.3, .25, .3] }; });   // (before: fixed on the diagonals)
    for (const b of posts) for (const y of [0.05, 0.45]) { const p = inside([b.c[0], y, b.c[2]], b.h[0] * Math.SQRT2); if (p) bad.push(`${k}: post in ${p.d.key}`); }
    const hd = rig.hold || { f: 0, rp: [3.4, 3.4, 3.4, 3.4], r: [0, 1, 2, 3].map(() => rig.rB + .12) };
    if (hd.f) moved.push(`${k} ${(hd.f * 180 / Math.PI).toFixed(0)}°`);
    if (D.PRESETS[k] && (hd.f || hd.rp.some(x => x !== 3.4) || hd.r.some(x => Math.abs(x - rig.rB - .12) > 1e-9))) bad.push(`${k}: a preset's hold-downs moved`);
  }
  check('hold-downs: arms and posts clear every part, boosters on the diagonals included; the presets keep theirs as before', !bad.length, bad.slice(0, 4).join(' | ') || `${cases.length} rockets; turned: ${moved.join(', ')}`);
}

// sound-1. Sound (sound session; open thread 7). The pure mix block (flight state → layer levels) behaves physically,
// and an Orbiter ascent flown on the SIM gives a launch that is loudest on the pad, roars through max-q, buffets at
// Mach 1 and goes quiet but for the structure in vacuum. Also: F4 is in Help, and the page wires sndTick into frame().
{
  const H = html.replace(/\r\n/g, '\n'), blk = H.slice(H.indexOf('// ==== SOUND MIX BEGIN'), H.indexOf('// ==== SOUND MIX END'));
  const { sndMix, sndBoom } = new Function(blk + ';return {sndMix,sndBoom}')();
  const pad = sndMix({ T: 4e6, pr: 1, M: 0, q: 0, agl: 0 }), up = sndMix({ T: 4e6, pr: 1, M: 0.3, q: 5e3, agl: 2000 }),
    thin = sndMix({ T: 4e6, pr: 0.05, M: 3, q: 8e3, agl: 3e4 }), vac = sndMix({ T: 4e6, pr: 0, M: 0, q: 0 }), off = sndMix({ T: 0, pr: 1 });
  check('sound mix: the pad is loudest (ground reflection); thin air is quieter and darker; vacuum leaves only the structure; no engines, no roar',
    pad.air > up.air && up.air > 3 * thin.air && thin.airLp < up.airLp && vac.air === 0 && vac.str > 0 && off.air === 0 && off.str === 0 && off.sub === 0,
    `air ${pad.air.toFixed(2)} → ${up.air.toFixed(2)} → ${thin.air.toFixed(3)} → ${vac.air}; lowpass ${up.airLp.toFixed(0)} → ${thin.airLp.toFixed(0)} Hz`);
  const sub = sndMix({ T: 4e6, pr: 0.5, M: 0.8, q: 2e4 }), sup = sndMix({ T: 4e6, pr: 0.5, M: 1.5, q: 2e4 }),
    sol = sndMix({ T: 4e6, pr: 1, solid: 1 }), liq = sndMix({ T: 4e6, pr: 1, solid: 0 }), small = sndMix({ T: 2e4, pr: 1 });
  check('sound mix: past Mach 1 the exhaust falls behind; solids crackle more than liquids; a 20 kN engine is quieter, not silent',
    sup.air < 0.4 * sub.air && sol.crk > 3 * liq.crk && small.air > 0.1 && small.air < 0.3 * liq.air,
    `M 0.8 → 1.5: ${sub.air.toFixed(2)} → ${sup.air.toFixed(2)}; crackle solid ${sol.crk.toFixed(2)} / liquid ${liq.crk.toFixed(2)}; 20 kN ${small.air.toFixed(2)}`);
  const near = sndBoom(100, 1, 1, false), far = sndBoom(5000, 1, 1, false), space = sndBoom(100, 0, 1, false), me = sndBoom(0, 0, 1, true);
  check('sound mix: a blast arrives late and dull from afar, not at all through vacuum, and our own ship is heard through its structure',
    near.gain > 2 * far.gain && Math.abs(far.delay - 5000 / 340) < 1e-9 && far.lp < near.lp && space.gain === 0 && me.gain > 0 && me.delay === 0,
    `100 m ${near.gain.toFixed(2)} @ ${near.delay.toFixed(2)} s; 5 km ${far.gain.toFixed(2)} @ ${far.delay.toFixed(1)} s, lowpass ${far.lp.toFixed(0)} Hz`);
  // a real ascent: the Orbiter's gravity turn (as §3), the mix sampled every second
  api.t = 0; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.sas = false; s.throttle = 1; api.stage(s);
  const point = pd => { const f = api.localFrame(s.r), p = pd * Math.PI / 180, Y = norm(add(mul(f.e, Math.cos(p)), mul(f.up, Math.sin(p)))), X = norm(cross(Y, f.n));
    s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  const tr = []; let next = 0, n = 0;
  while (n++ < 300000 && s.alive) { const h = len(s.r) - TELLUS.R, el = elements(s.r, s.v, TELLUS.mu);
    point(90 * (1 - Math.pow(Math.min(1, Math.max(0, (h - 1000 * AS) / (44000 * AS))), 0.6)));
    if (el.ap - TELLUS.R > ATM + 10000) break;
    if (api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) api.stage(s);
    api.physStep(s, api.DT);
    if (api.t >= next) { next += 1; const pr = h < ATM ? Math.exp(-h / TELLUS.H) : 0;
      tr.push({ t: api.t, h, M: s.mach || 0, q: s.qdyn || 0, m: sndMix({ T: s.thrust, pr, M: s.mach || 0, q: s.qdyn || 0, v: (s.mach || 0) * 340, agl: h }) }); } }
  const at = f => tr.reduce((b, x) => f(x) < f(b) ? x : b), mq = tr.reduce((b, x) => x.q > b.q ? x : b),
    m1 = at(x => Math.abs(x.M - 1)), k30 = at(x => Math.abs(x.h - 3e4)), k80 = at(x => Math.abs(x.h - 8e4)), row = x => `T+${x.t.toFixed(0)} ${(x.h / 1e3).toFixed(1)} km: roar ${x.m.air.toFixed(2)} wind ${x.m.wind.toFixed(2)} buffet ${x.m.buf.toFixed(2)}`;
  console.log(`      sound over an Orbiter ascent: ${[tr[0], m1, mq, k30, k80].map(row).join(' | ')}`);
  check('sound over an Orbiter ascent: roar loudest on the pad, buffet at Mach 1, wind loudest near max-q, faint by 30 km, only the structure near the top of the air',
    tr[0].m.air > m1.m.air && m1.m.buf > 0.5 && Math.abs(tr.reduce((b, x) => x.m.wind > b.m.wind ? x : b).t - mq.t) < 15 && k30.m.air < 0.25 * tr[0].m.air && k80.m.air < 0.02 && k80.m.str > 0,
    `${tr.length} samples; max-q ${(mq.q / 1e3).toFixed(1)} kPa at T+${mq.t.toFixed(0)}`);
  const P = H.slice(H.indexOf('// ==== SIM END'));
  check('sound is wired: F4 in KEYS.all, sndTick called from frame() and not from render()',
    /all:\[[^\n]*k:\['f4'\]/.test(P) && /function frame\(now\)\{[^]*?sndTick\(dtR\)[^]*?requestAnimationFrame\(frame\)\}/.test(P) && !/function render\(\)\{[^]*?\n\}/.exec(P)?.[0].includes('sndTick'));
}

// fixes-1. PLAYTEST sweep #15–#22 (fixes session). What the SIM can show: #19, the home station sees its own vessel from the
// first moment it leaves the pad (no "no station in view" while the rocket is still below the mast top); #21, a landed
// flight is settled when the player leaves it (refund, flight count, know-how), once: Revert or the next launch then pay
// nothing more. Also: go() settles a flight it leaves (a page check, as §32 does for screens).
{
  const P = api.PROG;
  // #19: an Orbiter lifting off from the home pad, its link every step of the first 20 s
  Object.assign(P, { site: api.homeSite ? api.homeSite().id : P.site, stations: [] });
  api.t = 0; let s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.throttle = 1; api.stage(s);
  const seen = []; let air = 0;
  for (let k = 0; k < 20 / api.DT && s.alive; k++) { api.advPhys(s); if (s.landed) continue; air++;
    const l = api.linkOf(s), w = l.ok ? (l.st ? l.st.name : l.why) : l.why; if (seen[seen.length - 1]?.w !== w) seen.push({ w, t: +api.t.toFixed(1), h: +(len(s.r) - TELLUS.R - api.groundAlt(TELLUS, norm(api.toPF(TELLUS, s.r, api.t)))).toFixed(1) }); }
  check('fixes-1 #19: from liftoff on, the home station sees the climbing vessel (never "no station in view")',
    air > 100 && seen.length === 1 && seen[0].w === api.curSite().name, seen.map(x => `T+${x.t} ${x.h} m: ${x.w}`).join(' → '));
  // #21: a Sounding flight up and back under its chute, then left for the Program
  Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: api.FUNDS0, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [] });
  api.t = 0; s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); let armed = false, n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  const f0 = P.funds, fl0 = P.flights, kh0 = api.khUse('sparrow'), out = api.flightLeave ? api.flightLeave(s) : null;
  const f1 = P.funds, fl1 = P.flights, kh1 = api.khUse('sparrow');
  check('fixes-1 #21: leaving a landed flight settles it there: refund paid, flight counted, know-how learnt',
    s.landed && !!out && s.rec.ended && f1 > f0 && s.rec.refund > 0 && fl1 === fl0 + 1 && kh1 > kh0,
    `funds ${f0.toFixed(2)} → ${f1.toFixed(2)} (refund ${(s.rec.refund || 0).toFixed(2)}), flights ${fl0} → ${fl1}, Sparrow know-how ${kh0.toFixed(2)} → ${kh1.toFixed(2)}`);
  // then Revert (resetShip → missionEnd on the same ship), leaving again, and the next launch: nothing more is paid
  const again = [api.missionEnd(s), api.flightLeave ? api.flightLeave(s) : 0];
  api.t = 0; const s2 = api.newShip(api.PRESETS.Sounding); api.S = s2; api.missionEnd(s);   // the relaunch settles the old ship (resetShip) first
  check('fixes-1 #21: settled once: a revert, a second leave or the next launch pay nothing more',
    again.every(x => x === null) && P.funds === f1 && P.flights === fl1 && api.khUse('sparrow') === kh1, `funds ${P.funds.toFixed(2)}, flights ${P.flights}`);
  const H = html.replace(/\r\n/g, '\n'), gi = H.indexOf('function go(s){'), goSrc = gi < 0 ? '' : H.slice(gi, H.indexOf('\n// ', gi));   // (up to the next comment line)
  check('fixes-1 #21: go() settles the flight it leaves (flight or map → any other screen)', /from==='flight'\|\|from==='map'[^\n]*flightLeave\(S\)/.test(goSrc));
}

// 37e. The atlas (terrain session): the map's grid of biomes and powers, its coasts and borders, the powers' names, the
// pointer readout, and the page wiring (the C key, the bake before the sky pass, the overlay and the notebook ink).
{
  const A = api.ATLAS, t0 = performance.now(); let chunks = 1; while (!api.atlasBake(40)) chunks++;
  const ms = performance.now() - t0, N = A.W * A.H; let land = 0, orphan = 0;
  for (let k = 0; k < N; k++) { if (A.bio[k]) { land++; if (!A.pow[k]) orphan++; } else if (A.pow[k]) orphan++; }
  check('atlas: baked in chunks; every land point has a power, no sea point has one', chunks > 3 && orphan === 0 && land > 0.3 * N && land < 0.7 * N,
    `${(ms / 1000).toFixed(1)} s in ${chunks} chunks; land ${(100 * land / N).toFixed(1)} % of the grid points`);
  const R = api.rng(7); let bad = 0;
  for (let i = 0; i < 300; i++) { const x = R() * A.W | 0, y = R() * A.H | 0, u = api.atlasU(x, y), k = y * A.W + x, b = api.biomeAt(u), p = b.id ? api.powerAt(u) : null;
    if (A.bio[k] !== b.id || A.pow[k] !== (p ? p.i + 1 : 0)) bad++; const [x2, y2] = api.atlasXY(u); if (x2 !== x || y2 !== y) bad++; }
  check('atlas: the grid is biomeAt/powerAt at its points, and atlasXY inverts atlasU', bad === 0, `${bad} mismatches in 300 points`);
  const around = (u, f) => { const out = new Set(), [x, y] = api.atlasXY(u);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) out.add(f(Math.min(A.H - 1, Math.max(0, y + dy)) * A.W + (x + dx + A.W) % A.W)); return out; };
  const L = A.lines; let nc = 0, nb = 0, cOff = 0, bOff = 0;
  for (let i = 0; i < L.coast.length; i += 6 * 37) { nc++; if (around([L.coast[i], L.coast[i + 1], L.coast[i + 2]], k => A.bio[k] > 0).size < 2) cOff++; }
  for (let i = 0; i < L.border.length; i += 6 * 5) { nb++; const q = around([L.border[i], L.border[i + 1], L.border[i + 2]], k => A.pow[k]); q.delete(0); if (q.size < 2) bOff++; }
  check('atlas: coast lines run between land and sea, border lines between two powers', nc > 100 && nb > 50 && cOff === 0 && bOff === 0,
    `${L.coast.length / 6} coast, ${L.border.length / 6} border segments; sampled ${nc} / ${nb}, off ${cOff} / ${bOff}`);
  check("atlas: each power's name sits on its own land", A.names.length === api.POWERS.length && A.names.every((nm, i) => nm && api.powerAt(nm.u)?.i === i),
    A.names.map(nm => nm && `${api.POWERS[nm.i].root} ${(Math.asin(nm.u[1]) * 180 / Math.PI).toFixed(0)}°`).join(', '));
  const u0 = api.SITES[0].u, a = api.atlasAt(u0);
  check('atlas readout at the first launch site: its biome, its power, its height', a.id > 0 && a.biome === api.biomeAt(u0).name && a.power === api.powerAt(u0) && Math.abs(a.h - api.terrainH(u0)) < 1e-6,
    `${a.biome} · ${a.power && a.power.name} · ${a.h.toFixed(0)} m · ${a.lat.toFixed(2)}°, ${a.lon.toFixed(2)}°`);
  const P = html.replace(/\r\n/g, '\n'), pg = P.slice(P.indexOf('// ==== SIM END')), km = pg.slice(pg.indexOf('  map:['), pg.indexOf('  program:['));
  check('atlas is wired: C in KEYS.map and the key handler, the bake before the sky pass, the tint after the clouds, overlay and ink called',
    km.includes("{k:['c'],l:'C'") && pg.includes("k==='c'&&view==='map')cycleAtlas()") && pg.includes("atlasTick();\n  // ---- sky / planets") &&
    /cov\*\.95\*shW\*\(1\.-\.85\*uAtl\)[^]{0,200}\n if\(atl\.a>0\.\)col=mix/.test(pg) && pg.includes('atlasOverlay(era,camW,') && pg.includes('if(atlasMode)atlasInk(era,'));
}

// 37f. Plasma blackout needs speed, not just heat (terrain session, QUEUE Q17 / PLAYTEST #17): an ordinary climb through
// dense air reaches the heat flux at ~1 km/s and must keep its link; an orbital-speed entry still blacks out.
{
  const { TELLUS: T } = api, sv = r => api.surfVel(T, r), V = (s, va) => { s.v = add(sv(s.r), mul(api.localFrame(s.r).e, va)); };
  const s = api.newShip(api.PRESETS.Orbiter); s.landed = false; s.r = api.fromPF(T, mul(api.SITES[0].u, T.R + 20e3), 0);
  s.qHeat = 7.7e4; V(s, 1041); const climb = api.linkOf(s);   // the robot's Heavy: 77 kW/m² at Mach 3.5, 20 km
  s.qHeat = 1.9e5; V(s, 2600); const entry = api.linkOf(s), on = api.plasmaOn(s); s.qHeat = 0; const cool = api.plasmaOn(s);
  check('blackout: a hot climb at 1 km/s keeps its link; a hot entry at 2.6 km/s blacks out; fast but cool air does not',
    climb.ok && !/blackout/.test(climb.why) && !entry.ok && /blackout/.test(entry.why) && on && !cool && api.PLASMA_V > 1800 && api.PLASMA_V < 2600,
    `PLASMA_V ${api.PLASMA_V} m/s · climb: ${climb.ok ? (climb.st ? climb.st.name : climb.why) : climb.why} · entry: ${entry.why}`);
  // flown: the Heavy's gravity turn never blacks out; a capsule's return from orbit does, for a while
  const turn = name => { api.t = 0; const x = api.newShip(api.PRESETS[name]); api.S = x; x.sas = false; x.throttle = 1; api.stage(x); let k = 0, n = 0, vmax = 0;
    while (k++ < 300000 && x.alive) { const h = len(x.r) - T.R, el = elements(x.r, x.v, T.mu), f = api.localFrame(x.r), p = Math.PI / 2 * (1 - Math.pow(Math.min(1, Math.max(0, (h - 1000 * AS) / (44000 * AS))), 0.6));
      const Y = norm(add(mul(f.e, Math.cos(p)), mul(f.up, Math.sin(p)))), X = norm(cross(Y, f.n)); x.q = api.qFromBasis(X, Y, cross(X, Y)); x.w = [0, 0, 0];
      if (el.ap - T.R > ATM + 10000 && h > ATM) break; if (api.dvRemaining(x).cur <= 0.5 && x.evIdx < x.events.length) api.stage(x);
      api.physStep(x, api.DT); if (x.qHeat > api.BLACKOUT_Q) vmax = Math.max(vmax, len(sub(x.v, sv(x.r)))); if (api.plasmaOn(x)) n++; }
    return { n: n * api.DT, vmax }; };
  const heavy = turn('Heavy');
  api.t = 0; const x = api.newShip(['chute', 'bio', 'pod', 'shield']); api.S = x; x.landed = false; const f = api.localFrame([T.R + ATM + 5000, 0, 0]);
  x.r = [T.R + ATM + 5000, 0, 0]; x.v = add(mul(f.e, VENT), mul(f.up, -60)); { const d = norm(x.v), Y = mul(d, -1), X = norm(cross(Y, f.n)); x.q = api.qFromBasis(X, Y, cross(X, Y)); }
  x.sas = true; x.sasMode = 'retro'; x.rec.launched = true; let k = 0, nb = 0; while (x.alive && !x.landed && k++ < 400000) { api.physStep(x, api.DT); if (api.plasmaOn(x)) nb++; }
  check('blackout, flown: the Heavy climb never loses its link to plasma; a capsule returning from orbit is blacked out for a while',
    heavy.n === 0 && nb * api.DT > 30, `Heavy: hot up to ${heavy.vmax.toFixed(0)} m/s, ${heavy.n.toFixed(0)} s of plasma · entry: ${(nb * api.DT).toFixed(0)} s of blackout`);
}

// platform-1. The file split (platform session): index.html's script is now classic scripts in sim/ and app/, loaded in
// order and sharing one global scope (NOTES § "The file split"). The tests read them as one text (page.mjs), so they
// can't see what a browser would: a function is hoisted only within its own file, so a top-level call into a later
// file breaks the page. Here each SIM file runs as its own script, in page order, the way the browser runs them. Also:
// every file in sim/ and app/ is on the page (a new file nobody loads is a silent no-op), and each one runs strict.
{
  const vm = await import('node:vm'), fs = await import('node:fs'), files = pageScripts();
  const read = f => fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8'), sim = files.filter(f => f.startsWith('sim/'));
  const ctx = vm.createContext({ console, performance }), bad = [];
  for (const f of sim) try { new vm.Script(read(f), { filename: f }).runInContext(ctx); } catch (e) { bad.push(`${f}: ${e.message}`); }
  check('split: each SIM file loads as its own script, in page order (no top-level call into a later file)',
    !bad.length && vm.runInContext('typeof physStep === "function" && typeof dispatchRun === "function" && PROG.funds > 0', ctx), bad.join('; ') || `${sim.length} files`);
  const disk = ['sim', 'app'].flatMap(d => fs.readdirSync(new URL('./' + d + '/', import.meta.url)).filter(x => x.endsWith('.js')).map(x => d + '/' + x));
  check('split: index.html loads every file in sim/ and app/, and each file it loads exists',
    disk.every(f => files.includes(f)) && files.every(f => disk.includes(f)), `${files.length} on the page; not loaded: ${disk.filter(f => !files.includes(f)).join(', ') || 'none'}`);
  const lax = files.filter(f => !/^(\/\/[^\n]*\n)*'use strict';/.test(read(f).replace(/\r\n/g, '\n')));
  check("split: every file starts 'use strict' (a classic script doesn't inherit it from the one before)", !lax.length, lax.join(', ') || 'all strict');
}

// flow-1. Debrief (flow session, UI slice 3; QUEUE Q2): a settled flight leaves a summary record (sim/debrief.js) that the
// Debrief screen renders: outcome, money line by line (adding up to what the program actually gained or lost), missions,
// certifications, logbook records, incidents, know-how. Built once, at settlement; the page sends a flight that settles
// on the way out to the Debrief screen.
{
  const P = api.PROG; api.HOOK.news = () => {};
  Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: api.FUNDS0, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], kh: {}, log: {} });
  api.t = 0; let s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); let armed = false, n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  const b = s.rec.deb0, out = api.flightLeave(s), D = out && out.debrief, M = D ? D.money : [];
  const sum = M.reduce((a, m) => a + m.v, 0), row = l => M.find(m => m.l.startsWith(l));
  check('flow-1: a landed flight, once settled, has a debrief record (returned, on the record, and the last one)',
    !!b && !!D && D === s.rec.debrief && D === api.DEBRIEF_LAST && D.outcome.k === 'landed' && D.flight === P.flights, D ? `${D.outcome.t}: ${D.outcome.d}` : 'none');
  check('flow-1: the money adds up: hardware, operations, refurbishment, the rest; their sum is what the program gained or lost',
    D && Math.abs(sum - D.net) < 1e-6 && Math.abs(D.net - (P.funds - b.funds)) < 1e-6 && row('Hardware').v === -s.rec.cost && Math.abs(row('Refurbishment').v - s.rec.refund) < 1e-9,
    M.map(m => `${m.l} ${m.v.toFixed(1)}`).join(' · ') + ` = ${D && D.net.toFixed(1)}M`);
  const newly = Object.keys(P.done).filter(k => !b.done.includes(k)).map(k => api.MISSIONS.find(x => x.id === k).name);
  check('flow-1: missions done on the flight are listed with their pay; know-how gained is listed by part',
    D && D.missions.length === newly.length && D.missions.every(m => newly.includes(m.l) && row(m.l)) && D.kh.some(k => /Sparrow/.test(k.l) && k.b > k.a),
    `missions: ${D && D.missions.map(m => `${m.l} +${m.pay.toFixed(0)}`).join(', ') || 'none'} · know-how: ${D && D.kh.map(k => `${k.l} ${(k.a * 100).toFixed(0)}→${(k.b * 100).toFixed(0)}%`).join(', ')}`);
  check('flow-1: settled once: leaving again builds no second record', api.flightLeave(s) === null && api.DEBRIEF_LAST === D);
  // a flight lost in the air
  api.t = 0; s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); n = 0;
  while (s.alive && api.t < 20 && n++ < 200000) api.advPhys(s);
  s.alive = false; const L = api.flightLeave(s);
  check('flow-1: a vessel destroyed in flight is debriefed as lost', L && L.debrief && L.debrief.outcome.k === 'lost' && L.debrief.flight === D.flight + 1, L && L.debrief && `${L.debrief.outcome.t}: ${L.debrief.outcome.d}`);
  // the page: go() debriefs a flight that settles on the way out; the screen has its keys; the Esc menu can end a flight
  const H = html.replace(/\r\n/g, '\n'), gi = H.indexOf('function go(s){'), goSrc = gi < 0 ? '' : H.slice(gi, H.indexOf('\n// Keys, one table', gi));
  check('flow-1: leaving a flight goes to Debrief first; Debrief has keys and exits; the Esc menu has End flight',
    /s='debrief'/.test(goSrc) && /debrief:\[\{k:\['p'\]/.test(H) && /b\('end','End flight/.test(H) && /id="bDebAgain"/.test(H) && /id="bEnd"/.test(H));
  Object.assign(P, { done: {}, flights: 0, funds: api.FUNDS0, kh: {}, log: {} });
}

// aerofx-1. The plasma shell needs speed, not just heat (look & sound effects beat, QUEUE Q20 / PLAYTEST #17): the
// glow's heat level is the stagnation flux faded in by airspeed over .85–1.05 PLASMA_V (terrain's blackout threshold),
// so a hot climb at 1 km/s draws nothing, an orbital-speed entry draws the full shell, and it grows in smoothly. The
// render call must go through plasmaHeat for both the ship and falling stages (no bare heat-flux gate).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const fn = pg.slice(pg.indexOf('function plasmaHeat('), pg.indexOf('\n', pg.indexOf('function plasmaHeat(')));
  const { TELLUS: T, PLASMA_V: PV } = api, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const plasmaHeat = new Function('len', 'sub', 'surfVel', 'clamp', 'PLASMA_V', fn + ';return plasmaHeat')(len, sub, api.surfVel, clamp, PV);
  const r = api.fromPF(T, mul(api.SITES[0].u, T.R + 20e3), 0), e = api.localFrame(r).e, at = va => plasmaHeat(T, r, add(api.surfVel(T, r), mul(e, va)), 7.7e4);
  const ramp = []; for (let v = 0.8 * PV; v <= 1.1 * PV; v += PV / 200) ramp.push(at(v));
  const mono = ramp.every((q, i) => !i || q >= ramp[i - 1]), jump = Math.max(...ramp.map((q, i) => i ? q - ramp[i - 1] : 0));
  check('plasma shell: no glow from a hot climb at 1 km/s or at .85 PLASMA_V; full heat by 1.05 PLASMA_V; rises smoothly',
    at(1041) === 0 && at(0.85 * PV) === 0 && Math.abs(at(1.05 * PV) - 7.7e4) < 1 && at(2600) === 7.7e4 && mono && jump < 7.7e4 * 0.05,
    `PLASMA_V ${PV} · 1041 m/s ${at(1041)} · PLASMA_V ${at(PV).toFixed(0)} · 2600 m/s ${at(2600)} · largest step ${jump.toFixed(0)}`);
  const blk = pg.slice(pg.indexOf('if(PLASMA_FX&&near)'), pg.indexOf('\n  // RCS:'));
  check('plasma shell: the ship and debris draws are gated by plasmaHeat, not the bare heat flux',
    (blk.match(/plasmaHeat\(/g) || []).length === 2 && !/qHeat>1\.5e4|g\.q>1\.5e4/.test(blk), blk.slice(0, 120));
}

// aerofx-2. The plasma lights the hull (look & sound effects beat, QUEUE Q63): plasmaLight makes the shock layer the
// scene's point light (PLT) while it outshines the plumes, upstream of the leading face; nothing on a hot climb (the
// same speed gate as the shell); a brighter light already in PLT (an explosion's flash) keeps it. Called between the
// plumes' and the explosions' lights, before the mesh pass reads PLT.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const fsrc = pg.slice(pg.indexOf('function plasmaLight('), pg.indexOf('\nlet PLASMA_LK'));
  const hsrc = pg.slice(pg.indexOf('function plasmaHeat('), pg.indexOf('\n', pg.indexOf('function plasmaHeat(')));
  const { TELLUS: T } = api, clamp = (x, a, b) => Math.min(b, Math.max(a, x)), PLT = { p: new Float32Array(4), c: new Float32Array(3), g: 1 };
  const S = { body: T, alive: true, radius: 0.66, yTop: 0.72, yBot: -0.48, qHeat: 1.6e5 };
  const env = { PLASMA_LIGHT: true, PLASMA_FX: true, mode: 'flight', S, PLT, simT: 0, PLASMA_LK: 5, len, sub, add, mul, dot, clamp,
    surfVel: api.surfVel, qrot: api.qrot, bodyPos: () => [0, 0, 0], PLASMA_V: api.PLASMA_V };
  const plasmaLight = new Function(...Object.keys(env), hsrc + ';' + fsrc + ';return plasmaLight')(...Object.values(env));
  S.r = api.fromPF(T, mul(api.SITES[0].u, T.R + 50e3), 0); const e = api.localFrame(S.r).e;
  const fly = (va, qH, shieldFirst) => { S.v = add(api.surfVel(T, S.r), mul(e, va)); S.qHeat = qH; const Y = mul(e, shieldFirst ? -1 : 1), X = norm(cross(Y, norm(S.r)));
    S.q = api.qFromBasis(X, Y, cross(X, Y)); PLT.c.fill(0); PLT.g = 1; plasmaLight([0, 0, 0]); return { c: [...PLT.c], up: dot(sub([...PLT.p].slice(0, 3), S.r), e), w: PLT.p[3], g: PLT.g }; };
  const entry = fly(2600, 1.6e5, true), climb = fly(1041, 7.7e4, false);
  PLT.c.set([500, 300, 150]); S.v = add(api.surfVel(T, S.r), mul(e, 2600)); S.qHeat = 1.6e5; plasmaLight([0, 0, 0]); const boomKept = PLT.c[0] === 500;
  const rnd = H.slice(H.indexOf('plumeLight(camW);'), H.indexOf('gl.uniform4fv(m.uPl,PLT.p)'));
  check('plasma light: an entry lights the hull from just upstream (warm, no ground pool); a hot climb and a brighter flash leave PLT alone',
    entry.c[0] > 0 && entry.c[0] >= entry.c[1] && entry.up > 0.48 && entry.up < 2 && entry.g === null && climb.c.every(x => x === 0) && climb.g === 1 && boomKept
      && /plumeLight\(camW\);plasmaLight\(camW\);boomLight\(camW\)/.test(rnd),
    `entry rgb ${entry.c.map(x => x.toFixed(1)).join(',')} at ${entry.up.toFixed(2)} m upstream, core ${entry.w.toFixed(2)} m · climb ${climb.c.join(',')} · flash kept ${boomKept}`);
  const vsrc = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  // aerofx-3 rides along here (same page slices): QUEUE Q64, vapor collars on side boosters. Each stack line gets its own
  // profile and shoulders: a Heavy has its core plus one line per booster, each booster's nose cone a shoulder near its
  // top; an Orbiter (one line) keeps exactly the shoulders the old whole-envelope profile gave.
  const cutFn = name => pg.slice(pg.indexOf('function ' + name + '('), pg.indexOf('\n', pg.indexOf('function ' + name + '(')));
  const vsrcFns = ['hullProfile', 'hullShoulders', 'lineProfile', 'vaporLines'].map(n => {
    const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); }).join('\n');
  const V = new Function('HULLPR', 'VLPR', vsrcFns + ';return {hullProfile,hullShoulders,lineProfile,vaporLines}')(new Float32Array(32), new Float32Array(32));
  const sh = s => V.vaporLines(s).map(l => ({ l, sh: V.hullShoulders(V.lineProfile(l.parts, l.lo, l.hi, l.ax, l.az), -1) }));
  const hv = api.newShip(api.PRESETS.Heavy), hL = sh(hv), ob = api.newShip(api.PRESETS.Orbiter), oL = sh(ob);
  const oldOb = V.hullShoulders(V.hullProfile(ob), -1).map(x => x.map(v => +v.toFixed(3))), newOb = oL[0].sh.map(x => x.map(v => +v.toFixed(3)));
  const boosters = hL.slice(1), noseOK = boosters.every(({ l, sh }) => sh.length && sh[0][0] >= 24 && Math.hypot(l.ax, l.az) > 0.5);
  check('vapor collars: each side booster gets its own line and a nose shoulder near its top; the Orbiter keeps its old collars',
    hL.length === 3 && noseOK && oL.length === 1 && JSON.stringify(oldOb) === JSON.stringify(newOb),
    `Heavy lines ${hL.length}: ${hL.map(({ l, sh }) => `(${l.ax.toFixed(2)},${l.az.toFixed(2)}) ${JSON.stringify(sh.map(x => x.map(v => +v.toFixed(2))))}`).join(' ')} · Orbiter old ${JSON.stringify(oldOb)} new ${JSON.stringify(newOb)}`);
  // aerofx-3 also: QUEUE Q23, moving parts. The bell turns about its throat by the quaternion from tdir to tdir + gv, and
  // the plume's frame follows: tilted the same way, leaving from the turned exit. Steerable plates and gimbals reach the
  // mesh shader through setMarks → setMoves; the reaction wheel has its own case.
  {
    const SIMF = new Function(src + 'return {qFromTo,qrot,norm,add,sub,cross,qFromBasis}')();
    const mfn = ['tiltQ', 'engMove', 'plumeFrame'].map(n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0;
      for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); }).join('\n');
    const M = new Function('qFromTo', 'qrot', 'norm', 'add', 'sub', 'cross', 'qFromBasis', 'bellThroat', 'MOVES_FX', mfn + ';return {engMove,plumeFrame}')(
      SIMF.qFromTo, SIMF.qrot, SIMF.norm, SIMF.add, SIMF.sub, SIMF.cross, SIMF.qFromBasis, () => 0.75, true);
    const a = 5 * Math.PI / 180, e = { d: { key: 'kestrel' }, pos: [0, 0, 0], y0: 10, h: 1.3, gv: [Math.sin(a), 0, 0] };
    const f0 = M.plumeFrame({ ...e, gv: null }), f1 = M.plumeFrame(e), down = SIMF.qrot(f1.qt, [0, -1, 0]);
    const lateral = f1.ex[0], expect = -0.75 * Math.sin(a);   // the exit swings opposite the thrust's tilt
    // a canted engine's exit hangs from its mount along −tdir (it was left at the untilted spot)
    const c10 = 10 * Math.PI / 180, fc = M.plumeFrame({ ...e, gv: null, tdir: [-Math.sin(c10), Math.cos(c10), 0] }), want = [1.3 * Math.sin(c10), 11.3 - 1.3 * Math.cos(c10)];
    check('moving parts: a canted engine\'s plume leaves from its tilted nozzle exit', Math.hypot(fc.ex[0] - want[0], fc.ex[1] - want[1]) < 1e-6,
      `exit (${fc.ex[0].toFixed(3)}, ${fc.ex[1].toFixed(3)}) vs (${want[0].toFixed(3)}, ${want[1].toFixed(3)})`);
    check('moving parts: a gimballed bell turns about its throat and the plume follows it (tilt and exit); at rest nothing moves',
      f0.qt === null && f0.ex[0] === 0 && Math.abs(lateral - expect) < 0.01 && Math.abs(down[0] + Math.sin(a)) < 0.02 && M.engMove({ ...e, gv: [0, 0, 0] }) === null
        && /uniform vec4 uMv\[48\]/.test(pg) && pg.includes("setMoves(u,parts)}") && pg.includes("case'rwheel':") && /pf=plumeFrame\(e\)/.test(pg)
        && (pg.match(/pf=plumeFrame\(e\)/g) || []).length === 2,
      `exit swings ${lateral.toFixed(3)} m (expect ${expect.toFixed(3)}), plume axis x ${down[0].toFixed(3)}`);
  }
  check('plasma light: views 46–47 are the shield-first capsule', /46: \[\['chute', 'bio', 'shield'\], [\d.]+, \d+, 'shield'/.test(vsrc) && /47: \[\[[^\]]*\], [\d.]+, \d+, 'shield'/.test(vsrc) && vsrc.includes("aoa === 'shield'"));
}

// qa-1. More tester cheats (QA session, QUEUE Q16): go to any day (forward runs the days, back moves only the calendar),
// set funds (which turns infinite money off), skip to a computing era, one mission at a time. Own SIM copy, like §37.
{
  const D = new Function(src + 'return {TEST,testGoto,testFunds,testEra,testMission,testTopUp,compEra,COMP_ERAS,YEAR_D,PROG,MISSIONS,missionOpen,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, T = D.TEST; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, lines: {}, flights: 1, own: null, decisions: [], active: [], offers: [], fac: {} });
  D.chooseStart('agency'); T.on = true;
  D.testGoto(250); const fwd = P.day; D.testGoto(40); const back = P.day; const bad = D.testGoto('x');
  check('tester: go to any day, forward and back; nonsense is refused', fwd === 250 && back === 40 && bad === false && P.day === 40, `→ ${fwd}, back → ${back}`);
  T.money = true; D.testTopUp(); D.testFunds(3); D.testTopUp();
  check('tester: set funds to an exact number, which turns infinite money off (so the program can go broke)', P.funds === 3 && T.money === false, `funds ${P.funds}, money ${T.money}`);
  D.testFunds(-20);
  check('tester: funds can be set below zero', P.funds === -20);
  const e0 = D.compEra(), ok1 = D.testEra(1), d1 = P.day, e1 = D.compEra(), ok2 = D.testEra(2), e2 = D.compEra();
  check('tester: skip to a computing era: the date runs on until it reaches the program, then stops', e0 === 0 && ok1 && e1 === 1 && ok2 && e2 === 2 && d1 > 0,
    `${D.COMP_ERAS[e1].name} on day ${d1.toFixed(0)}, ${D.COMP_ERAS[e2].name} on day ${P.day.toFixed(0)}`);
  const dEra = P.day; D.testGoto(dEra - 1); const e2b = D.compEra(); D.testGoto(dEra);
  check('tester: the era skip stops on the first day of the era (a day earlier is still the one before)', e2b === 1, `day ${dEra - 1}: era ${e2b}`);
  const bp = D.MISSIONS.find(m => m.id === 'beeper'), open0 = D.missionOpen(bp); D.testMission('weather', true); const open1 = D.missionOpen(bp), mark = P.done.weather;
  D.testMission('weather', false); const open2 = D.missionOpen(bp), none = D.testMission('nope', true);
  check('tester: one mission at a time: ticking "Above the weather" opens the beeper, unticking closes it; unknown ids refused',
    !open0 && open1 && mark && mark.test === true && !open2 && !P.done.weather && none === false);
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('tester menu: day, era, funds and mission controls are drawn, and disabled in flight', ['id="testDayIn"', 'data-test-era=', 'id="testFundsIn"', 'data-test-mis='].every(s => pg.includes(s)) && /data-test-mis="\$\{M\.id\}"[^`]*\$\{dis\}/.test(pg));
  Object.assign(T, { on: false, money: false, kh: false, tools: false, nofail: false, fast: false });
}

// vehicle-1. Landing legs (vehicle session, QUEUE Q31; NOTES § "Vehicle parts"): a deployed leg is one contact point at its
// foot, so a lander stands on slopes its bare rim tips on, and a hard landing snaps legs through the joint loads. The contact
// model's caps by effective mass (rotation included) and its stiction keep wide feet from chattering, spinning or creeping.
{
  const D = Math.PI / 180, R = TELLUS.R, U = (la, lo) => [Math.cos(la * D) * Math.cos(lo * D), Math.sin(la * D), Math.cos(la * D) * Math.sin(lo * D)];
  const find = (n, k) => n.k === k ? n : (n.c || []).map(x => find(x, k)).find(Boolean);
  const spots = {};
  for (let la = -60; la <= 60 && !(spots.flat && spots.s13 && spots.s20); la += 0.5) for (let lo = -180; lo < 180; lo += 0.5) {
    const u = U(la, lo); if (api.biomeAt(u).h < 0) continue; const su = api.surfaceAt(TELLUS, u); if (su.mu < 0.5 || api.surfaceHit(su, u) > 0) continue;
    const sl = api.terrainSlope(TELLUS, u);
    if (!spots.flat && sl < 0.03) spots.flat = { u, sl, su };
    if (!spots.s13 && sl > 0.21 && sl < 0.25) spots.s13 = { u, sl, su };
    if (!spots.s20 && sl > 0.33 && sl < 0.37) spots.s20 = { u, sl, su }; }
  const L0 = ['pod', 't1', 'wren'], legs = () => { const d = api.toV2(JSON.parse(JSON.stringify(L0))); find(d.root, 't1').c.push({ k: 'leg', at: { y: 0.3, a: Math.PI / 4, n: 4, cy: 0.5 }, c: [] }); return d; };
  // set a stack down upright, its lowest point 0.2 m above the ground (uphill feet included), coming down at v m/s, or turning at w rad/s
  const drop = (spot, v, stack, dep, w = 0, steps = 3000) => { api.t = 0; const s = api.newShip(stack); api.S = s; let last = ''; api.HOOK.msg = m => { last = m; }; s.landed = false;
    if (dep) api.legOp(s, 'down'); const F = api.footPoints(s), fy = Math.min(...F.map(f => f.pt[1])) - s.cm[1], fr = Math.max(...F.map(f => Math.hypot(f.pt[0], f.pt[2])));
    s.r = api.fromPF(TELLUS, mul(spot.u, R + api.groundAlt(TELLUS, spot.u) - fy + 0.2 + Math.tan(spot.sl) * fr), 0); const up = norm(s.r), e = norm(cross([0, 1, 0], up));
    s.v = add(api.surfVel(TELLUS, s.r), mul(up, -v)); s.q = api.qFromBasis(e, up, cross(e, up)); s.w = mul(up, w); s.sas = true; s.sasMode = 'stab';
    const n0 = s.parts.filter(p => p.on && p.d.kind === 'leg').length;
    for (let i = 0; i < steps && s.alive && !s.landed; i++) api.physStep(s, api.DT);
    return { s, last, lost: n0 - s.parts.filter(p => p.on && p.d.kind === 'leg').length }; };
  const sh = api.newShip(legs()), stowed = api.footPoints(sh).length, dn = api.legOp(sh, 'down'), F = api.footPoints(sh);
  check('legs: four legs deployed are the only contact points, at their feet (reach 1.5 m, a metre below the leg); stowed they are none',
    dn === 4 && stowed === 4 && F.length === 4 && F.every(f => f.p.d.kind === 'leg') && api.footPoints(sh).every(f => Math.abs(Math.hypot(f.pt[0], f.pt[2]) - 2.125) < 0.05) && api.legsDown(sh),
    `stowed ${stowed} rim points; deployed ${F.length} feet at r ${Math.hypot(F[0].pt[0], F[0].pt[2]).toFixed(2)} m`);
  const b13 = drop(spots.s13, 1, L0, false), l13 = drop(spots.s13, 1, legs(), true), b20 = drop(spots.s20, 1, L0, false), l20 = drop(spots.s20, 1, legs(), true), lf = drop(spots.flat, 1, legs(), true);
  check('legs: a pod-tank-Wren lander topples on 12–14° and 19–21° slopes bare, and stands on both with legs, leaning with the slope',
    !b13.s.alive && /Toppled/.test(b13.last) && !b20.s.alive && l13.s.landed && l20.s.landed && lf.s.landed && l13.lost + l20.lost === 0,
    `${(spots.s13.sl / D).toFixed(0)}°: bare "${b13.last}", legs "${l13.last}" · ${(spots.s20.sl / D).toFixed(0)}°: bare "${b20.last}", legs "${l20.last}"`);
  const v8 = drop(spots.flat, 8, legs(), true), v11 = drop(spots.flat, 11, legs(), true);
  check('legs: the lander takes 8 m/s on its legs; at 11 m/s (under the ground\'s 12) the landing loads snap legs and it goes over',
    v8.s.landed && v8.lost === 0 && v11.lost > 0 && !v11.s.alive, `8 m/s: ${v8.last} · 11 m/s: ${v11.lost} legs lost, ${v11.last}`);
  // the contact fixes: spun about the vertical, a stack on its rim and a lander on wide feet both stop turning and come to rest
  const sO = drop(spots.flat, 0.5, api.PRESETS.Orbiter, false, 0.3), sL = drop(spots.flat, 0.5, legs(), true, 0.3), rest = drop(spots.flat, 1, legs(), true, 0, 600);
  check('contact: spun at 0.3 rad/s, the Orbiter on its rim and the lander on its feet stop turning and land (no friction-pumped spin, no chatter)',
    sO.s.landed && sL.s.landed && rest.s.landed && rest.s.landedAt < 12, `Orbiter: ${sO.last} · lander: ${sL.last} · at rest by ${rest.s.landedAt?.toFixed(1)} s`);
  // a tape records the legs going down and replays it
  { const s = api.newShip(legs()); api.S = s; const T = api.tapeNew(legs()); api.tapeLegs(T, s, 'down'); const s2 = api.newShip(legs()); api.S = s2;
    const pl = { tape: T, i: 0 }; api.tapePlay(pl, s2, 10);
    check('legs: an autopilot tape records the legs going down and replays it', api.legsDown(s) && api.legsDown(s2) && T.ops.some(o => o[0] === 'G' && o[1] === 'down')); }
}

// econ-1. A failed attempt at the next step is mostly covered (economy session, QUEUE W12 / Q44): a flight on the priciest
// rocket yet that comes to nothing gets 75 % of its loss back from the sponsor, once per epoch (the newest one with firsts
// open). Retries, cheaper losses and flights that earned something are not covered. Own SIM copy, like §37.
{
  const D = new Function(src + 'return {coverLoss,COVER,PROG,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, cert: {}, kh: {}, lines: {}, own: null, decisions: [], active: [], offers: [], fac: {},
    done: { weather: { flight: 1 }, loads: { flight: 2 } }, flights: 5, recs: { maxCost: 30 } });
  D.chooseStart('agency');
  const lose = (cost, refund = 0) => D.coverLoss({}, { cost, refund, cdone: [] });
  P.funds = 0; const x1 = lose(80), f1 = P.funds, ep = Object.keys(P.recs.cover || {});
  check('cover: the first lost flight on the priciest rocket yet gets 75 % back, keyed to the newest open epoch (2: beeper, hop)',
    Math.abs(x1 - 0.75 * 80) < 1e-9 && Math.abs(f1 - 60) < 1e-9 && ep.join() === '2' && /cover/.test(news.at(-1) || ''), `${x1} back, epochs ${ep}`);
  P.flights = 6; const x2 = lose(95);
  check('cover: once per epoch (a second, pricier loss in epoch 2 gets nothing)', x2 === 0);
  P.recs = { maxCost: 100 }; P.flights = 7; const x3 = lose(80);
  check('cover: a loss on a rocket cheaper than one flown before is not covered', x3 === 0);
  P.recs = { maxCost: 30 }; const x4 = lose(80, 30);
  check('cover: a flight that came home for refurbishment (a quarter or more back) is not a loss', x4 === 0);
  P.recs = { maxCost: 30 }; P.flights = 8; P.done.hop = { flight: 8 }; const x5 = lose(80); delete P.done.hop;
  check('cover: a flight that completed a first is not covered', x5 === 0);
  P.recs = { maxCost: 30 }; const x6 = D.coverLoss({}, { cost: 80, refund: 0, cdone: ['a contract'] });
  check('cover: a flight that completed a contract is not covered', x6 === 0);
  P.recs = { maxCost: 30 }; P.flights = 9; const x7 = D.coverLoss({}, { cost: 80, refund: 0, cdone: [], orbit: true });
  check('cover: a rocket that reached orbit worked, even with nothing completed: no cover (PLAYTEST #33)', x7 === 0);
  const H = html.replace(/\r\n/g, '\n');
  check('cover: kept in PROG.recs, which a new game resets', /recs:\{\}/.test(H.slice(H.indexOf('// ==== SIM END'))));
}

// ground-1. The ground of every body (world session, GROUND.md slice G1): a body's `ground` recipe replaces every
// `b === TELLUS` ground test. Neutral today (Tellus as before, the moons smooth spheres), and live: a recipe given to
// Selene reaches contact, landing, slope and the ground normal with no other change. Own SIM copy, so Selene's recipe
// doesn't leak.
{
  const G = new Function(src + 'return {TELLUS,SELENE,NYX,BODIES,GROUND_GEN,bodyH,bodyTop,seaAt,groundAlt,groundR,terrainH,terrainSlope,groundNormal,TERR_TOP,newShip,physStep,fromPF,toPF,surfVel,qFromBasis,qrot,HOOK,DT,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const T = G.TELLUS, Se = G.SELENE, D = Math.PI / 180; G.HOOK.msg = () => {}; G.HOOK.boom = () => {};
  let rs = 7, bad = 0, sea = 0, wet = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const u = norm([rnd() - .5, rnd() - .5, rnd() - .5]), h = G.terrainH(u);
    if (G.groundAlt(T, u) !== Math.max(0, h) || G.seaAt(T, u) !== (h < 0) || G.bodyH(T, u) !== h) bad++; if (h < 0) sea++; }
  for (const b of G.BODIES) if (b !== T && (G.groundAlt(b, [b.R, 0, 0]) !== 0 || G.terrainSlope(b, [0, 1, 0]) !== 0 || G.seaAt(b, [b.R, 0, 0]) || G.bodyTop(b) !== 0)) wet++;
  check('ground-1: neutral: Tellus ground is terrainH clamped at the sea, as before (2,000 points); every other body a smooth sphere',
    bad === 0 && sea > 1000 && wet === 0 && G.bodyTop(T) === G.TERR_TOP && T.ground.sea === 0 && !Se.ground && !G.NYX.ground, `${bad} differ, ${sea} at sea, top ${G.bodyTop(T)} m`);
  // a test recipe on Selene: a 500 m plateau rising to the north at 20° (h = 500 m + tan 20° × the arc north of 1°N)
  const S20 = Math.tan(20 * D), lat = u => Math.asin(Math.max(-1, Math.min(1, norm(u)[1])));
  G.GROUND_GEN.g1test = pf => 500 + Se.R * S20 * Math.max(0, lat(pf) - 1 * D);
  Se.ground = { gen: 'g1test', top: 4e4 };
  const drop = la => { G.t = 0; const s = G.newShip(['chute', 'pod']); G.S = s; s.body = Se; s.landed = false; let last = ''; G.HOOK.msg = m => { last = m; };
    const u = [Math.cos(la * D), Math.sin(la * D), 0]; s.r = G.fromPF(Se, mul(u, Se.R + G.groundAlt(Se, u) - s.yBot + 0.2), 0); const up = norm(s.r), e = norm(cross([0, 1, 0], up));
    s.v = add(G.surfVel(Se, s.r), mul(up, -1)); s.q = G.qFromBasis(e, up, cross(e, up)); s.w = [0, 0, 0]; s.sas = true; s.sasMode = 'stab';
    for (let i = 0; i < 4000 && s.alive && !s.landed; i++) G.physStep(s, G.DT);
    return { s, last, h: len(G.toPF(Se, s.r, G.t)) - Se.R + s.yBot }; };
  const flat = drop(0), u5 = [Math.cos(5 * D), Math.sin(5 * D), 0], slope = G.terrainSlope(Se, u5), nrm = G.groundNormal(Se, G.toPF(Se, G.fromPF(Se, u5, G.t), G.t)),
    tilt = Math.acos(Math.min(1, dot(nrm, norm(G.fromPF(Se, u5, G.t))))) / D;
  check('ground-1: live: a recipe on Selene holds a pod up on its 500 m plateau, and its 20° rise reads as slope and as a tilted normal',
    flat.s.alive && flat.s.landed && Math.abs(flat.h - 500) < 0.5 && Math.abs(slope / D - 20) < 0.5 && Math.abs(tilt - 20) < 0.5,
    `${flat.last || 'not landed'} · rests ${flat.h.toFixed(2)} m above R · slope ${(slope / D).toFixed(2)}° · normal tilted ${tilt.toFixed(2)}°`);
  Se.ground = { gen: 'g1test', top: 4e4, sea: 600 };
  check('ground-1: a recipe\'s liquid level: below it is sea, and the ground there is the liquid\'s surface', G.seaAt(Se, [Se.R, 0, 0]) && G.groundAlt(Se, [Se.R, 0, 0]) === 600 && !G.seaAt(Se, u5));
  delete Se.ground;
}

// ground-2. Selene's ground (world session, GROUND.md slice G2): a baked map (highland swell, big craters, maria flooded
// into the near-side mare mask) plus procedural crater bands on an equiangular cube. Not live in play until the shader
// draws it (G3), so this copy switches it on. Numbers behind each parameter: study_ground.mjs.
{
  const G = new Function(src + 'return {SELENE,SELENE_GROUND,seleneMap,seleneH,grBands,GR_C,geoAt,terrainSlope,groundAlt,bodyTop,ih3,newShip,physStep,fromPF,toPF,surfVel,qFromBasis,qrot,HOOK,DT,get SEL_MAP(){return SEL_MAP},get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const B = G.SELENE, R = B.R, D = Math.PI / 180, lazy = G.SEL_MAP === null; G.HOOK.msg = () => {}; G.HOOK.boom = () => {};
  check('ground-2: Selene\'s recipe is not live in play (no ground until the shader draws it), and its map is baked on first use, not at load',
    !B.ground && lazy && G.groundAlt(B, [R, 0, 0]) === 0);
  B.ground = G.SELENE_GROUND; const M = G.seleneMap(), area = 4 * Math.PI * (R / 1000) ** 2;
  const pts = []; for (let i = 0; i < 4000; i++) { const z = 1 - (2 * i + 1) / 4000, a = i * 2.39996, q = Math.sqrt(1 - z * z); pts.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = pts.map(u => G.seleneH(u)), hmax = Math.max(...H), hmin = Math.min(...H);
  // the band cells: each holds a crater with probability λ (one band enumerated in full); the baked count is GR_C's
  const b2 = G.grBands(R)[2]; let full = 0; for (let f = 0; f < 6; f++) for (let i = 0; i < b2.n; i++) for (let j = 0; j < b2.n; j++) if (G.ih3(f * 65536 + i, j * 8 + 2 * 131072, 7001) < b2.lam) full++;
  const occ = full / (6 * b2.n * b2.n);
  check('ground-2: relief within the recipe\'s bounds; crater counts on target (baked ≥ 20 km = GR_C·area/400; band cells filled at λ)',
    hmax < G.bodyTop(B) && hmin > -5000 && M.craters.length === Math.round(G.GR_C / 400 * area) && Math.abs(occ / b2.lam - 1) < 0.03,
    `${hmin.toFixed(0)}…${hmax.toFixed(0)} m (top ${G.bodyTop(B)}) · ${M.craters.length} baked craters · band ${(b2.Dlo / 1e3).toFixed(1)}–${(b2.Dhi / 1e3).toFixed(1)} km: ${(occ * 100).toFixed(1)} % of cells (λ ${(b2.lam * 100).toFixed(1)} %)`);
  // no seams: the steepest 0.5 m step on the cube's face edges is a crater wall, not a cliff
  let rs = 3, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 3000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(G.seleneH(v) - G.seleneH(n)) / 0.5); }
  check('ground-2: continuous across the crater cells\' cube-face seams (steepest 0.5 m step there under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
  // the units: maria low and smooth, highlands rough; landing spots from the same samples
  const by = { mare: [], high: [] }, ht = { mare: [], high: [] };
  pts.forEach((u, i) => { const k = G.geoAt(B, u).unit; by[k].push({ u, sl: G.terrainSlope(B, u) / D }); ht[k].push(H[i]); });
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], over = (a, t) => a.filter(x => x.sl > t).length / a.length;
  const mS = med(by.mare.map(x => x.sl)), hS = med(by.high.map(x => x.sl)), mH = med(ht.mare), hH = med(ht.high);
  check('ground-2: maria are low, smooth plains; highlands are rough (median slope, share past TOPPLE, median height)',
    mS < hS / 2 && over(by.mare, 24) < over(by.high, 24) && mH < hH - 800 && over(by.high, 24) > .02,
    `slope ${mS.toFixed(1)}° vs ${hS.toFixed(1)}° · past 24°: ${(over(by.mare, 24) * 100).toFixed(1)} % vs ${(over(by.high, 24) * 100).toFixed(1)} % · height ${mH.toFixed(0)} vs ${hH.toFixed(0)} m`);
  // live in the physics: a pod comes to rest on a flat mare spot at the ground's height; on a crater wall it doesn't stay put
  const drop = (u, stack = ['chute', 'pod']) => { G.t = 0; const s = G.newShip(stack); G.S = s; s.body = B; s.landed = false; let last = ''; G.HOOK.msg = m => { last = m; };
    s.r = G.fromPF(B, mul(u, R + G.groundAlt(B, u) - s.yBot + 0.2), 0); const up = norm(s.r), e = norm(cross([0, 1, 0], up));
    s.v = add(G.surfVel(B, s.r), mul(up, -1)); s.q = G.qFromBasis(e, up, cross(e, up)); s.w = [0, 0, 0]; s.sas = true; s.sasMode = 'stab';
    const p0 = G.toPF(B, s.r, 0); for (let i = 0; i < 3000 && s.alive && !s.landed; i++) G.physStep(s, G.DT);
    const pf = G.toPF(B, s.r, G.t); return { s, last, gap: len(pf) - R - G.groundAlt(B, pf) + s.yBot, moved: len(sub(pf, p0)) }; };
  const flat = by.mare.find(x => x.sl < 2 && Math.abs(x.u[1]) < .7), wall = by.high.find(x => x.sl > 32 && x.sl < 40);
  const a = drop(flat.u), w = drop(wall.u);
  check('ground-2: in the physics: a pod rests on a flat mare spot, at the ground\'s height; on a crater wall it slides or tips instead',
    a.s.alive && a.s.landed && Math.abs(a.gap) < 0.3 && !(w.s.landed && w.moved < 1),
    `mare ${flat.sl.toFixed(1)}°: ${a.last} (gap ${a.gap.toFixed(2)} m) · wall ${wall.sl.toFixed(0)}°: ${w.last || (w.s.landed ? 'landed' : 'still sliding')}, moved ${w.moved.toFixed(1)} m`);
  delete B.ground;
}

// econ-2. Who may launch where (economy session, QUEUE Q6): siteAccess(site) → {ok, why, fee}. Our sites free; a sea
// platform a service fee; a consortium member's site shared; others leased (cheaper with better relations), refused under
// sanctions or hostile relations. Launch charges the fee and records R.site / R.siteFee; the debrief lists it.
{
  const D = new Function(src + 'return {siteAccess,siteAccessOf,LEASE,SEA_FEE,SITES,PROG,HOOK,POWERS,pairKey,newShip,missionTick,debriefOf,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart,set t(v){simT=v}};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, kh: {}, lines: {}, own: null, decisions: [], active: [], offers: [], fac: {},
    done: {}, flights: 0, recs: {}, atm: {}, stand: {}, studies: {}, studyQ: [] });
  D.chooseStart('agency');
  const home = D.SITES.find(t => t.power === 0), abroad = D.SITES.find(t => t.power != null && t.power !== 0 && t.kind !== 'sea'), sea = D.SITES.find(t => t.kind === 'sea');
  const k = abroad && D.pairKey(0, abroad.power), at = r => { P.rel[k] = r; return D.siteAccess(abroad); };
  const h = D.siteAccess(home), good = at(0.8), cool = at(0), bad = at(-0.5);
  check('sites: ours are free; abroad is leased, cheaper with better relations; hostile relations refuse', h.ok && h.fee === 0 && abroad && good.ok && cool.ok && good.fee < cool.fee && cool.fee === D.LEASE && !bad.ok && /relations/.test(bad.why),
    `${abroad && abroad.name}: rel 0.8 → ${good.fee}M, 0 → ${cool.fee}M, −0.5 → ${bad.why}`);
  P.rel[k] = 0.5; P.sanc = { [abroad.power]: P.day + 30 }; const sx = D.siteAccess(abroad); P.sanc = {};
  check('sites: a power that sanctions the program closes its sites', !sx.ok && /sanctions/.test(sx.why), sx.why);
  P.own = { kind: 'consortium', st: { 0: 0.4, [abroad.power]: 0.3 }, pv: 0, chosen: true, debt: 0 }; const mem = D.siteAccess(abroad); D.chooseStart('agency');
  check('sites: a consortium member\'s site is shared, free', mem.ok && mem.fee === 0);
  const sv = sea ? D.siteAccess(sea) : { ok: true, fee: D.SEA_FEE };
  check('sites: a sea platform is open to all, for a service fee', sv.ok && sv.fee === D.SEA_FEE && D.siteAccessOf(abroad).fee === D.siteAccess(abroad).fee);
  P.rel[k] = 0; P.funds = 500; const s = D.newShip(['chute', 'sci', 't1', 'fins', 'sparrow'], abroad); D.t = 0; s.landed = false; D.missionTick(s, 0, false);
  const R = s.rec, spent = 500 - P.funds;
  check('sites: launch charges the lease with hardware and operations, and records the site', R.site === abroad.id && R.siteFee === D.LEASE && Math.abs(spent - (R.cost + R.ops + R.siteFee)) < 1e-6,
    `site ${R.site}, fee ${R.siteFee}, spent ${spent.toFixed(1)}`);
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('sites: the debrief lists the lease; the builder\'s budget check and picker include the fee', H.includes("add('Site lease',-(R.siteFee||0)") && /const fee=siteAccessOf\(curSite\(\)\)\.fee/.test(pg) && pg.includes('a launch`'));
}

// econ-3. The ballistic test's target from the program's site (economy session, QUEUE Q7): the target lies 300–900 km
// downrange of the site the program flies from (true distances, not the old 600 km-radius radians from +X), at sea, and
// the test counts only when flown from that site. Contracts saved before Q7 (no p.site) count from anywhere.
{
  const D = new Function(src + 'return {CT,SITES,PROG,HOOK,TELLUS,curSite,isLand,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 0, rel: {}, op: {}, sanc: {}, done: {}, own: null, decisions: [], site: null }); D.chooseStart('agency');
  const B = D.CT.ballistic, km = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * D.TELLUS.R / 1e3;
  const far = D.SITES.find(t => t.kind !== 'sea' && km(t.u, D.SITES[0].u) > 1000) || D.SITES[1];
  let okAll = true, worst = 0; const R = D.rng(77);
  for (const t of [D.SITES[0], far]) { P.site = t.id; for (let i = 0; i < 20; i++) { const p = B.gen(R); if (!p) continue; const d = km(p.u, t.u);
    worst = Math.max(worst, Math.abs(d - p.rg)); okAll = okAll && p.site === t.id && !D.isLand(p.u) && d >= 299 && d <= 901 && Math.abs(d - p.rg) < 1; } }
  check('ballistic: the target is at sea, its stated distance downrange of the program\'s current site', okAll, `worst distance error ${worst.toFixed(2)} km; second site ${far.name}`);
  P.site = D.SITES[0].id; const p = B.gen(D.rng(5)), at = p.u.map(x => x * D.TELLUS.R);
  check('ballistic: counts on target from its own site, not from another, and the brief names the site',
    B.ok({ endPf: at, endSci: true, site: p.site }, p) && !B.ok({ endPf: at, endSci: true, site: far.id }, p) && B.brief(p).includes(p.sname));
  const old = { u: p.u, rg: p.rg, rad: 40 };
  check('ballistic: a contract saved before Q7 (no site) still counts from anywhere', B.ok({ endPf: at, endSci: true, site: far.id }, old));
}

// econ-4. Every offer says why it appeared (economy session, QUEUE Q45): whyOf picks the strongest true reason (a first
// that opened the type, tension, the business cycle, tourism standing, home government, the client's priorities, our
// standing, else routine) when the offer is made; the Contracts tab shows it.
{
  const D = new Function(src + 'return {whyOf,genOffer,econTick,ensureBoard,PROG,HOOK,POWERS,pairKey,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 200, rel: {}, op: {}, sanc: {}, stand: {}, done: { weather: { day: 10 } }, own: null, decisions: [], cycle: 0, offers: null, active: [], cdone: 0, flights: 3, wseed: 99 });
  D.chooseStart('agency');
  const other = D.POWERS.find(p => p.i !== 0).i;
  P.done.beeper = { day: 180 }; const fresh = D.whyOf('sat', 'com', other); P.done.beeper.day = 50; const stale = D.whyOf('sat', 'com', other);
  check('why: a type opened by a recent first says so; after 60 days it no longer does', /New since you did “The beeper”/.test(fresh) && !/New since/.test(stale), `${fresh} / ${stale}`);
  for (const p of D.POWERS) if (p.i !== other) P.rel[D.pairKey(other, p.i)] = -0.8; const tense = D.whyOf('ballistic', 'mil', other); P.rel = {};
  P.cycle = 0.6; const boom = D.whyOf('test', 'com', other); P.cycle = -0.6; const rec = D.whyOf('test', 'com', other); P.cycle = 0;
  check('why: tension for military work, the cycle for commercial work', /nervous/.test(tense) && /Boom/.test(boom) && /recession/.test(rec), `${tense} · ${boom} · ${rec}`);
  const gov = D.whyOf('landing', 'gov', 0), plain = D.whyOf('apex', 'sci', other);
  P.stand = { sci: 85 }; const st = D.whyOf('apex', 'sci', other); P.stand = {};
  check('why: home government, then the client\'s priorities or our standing, else routine work', /government/.test(gov) && /(cares about|standing|Routine)/.test(plain) && /(cares about|standing \(85\))/.test(st), `${gov} · ${plain} · ${st}`);
  P.offers = null; D.ensureBoard(); for (let k = 0; k < 20; k++) { P.day += 10; D.econTick(10, D.rng(k + 1)); }
  const ws = P.offers.map(o => o.why);
  check('why: every offer on a real board carries a one-line reason', ws.length > 0 && ws.every(w => typeof w === 'string' && w.length > 5 && w.length < 80 && !w.includes('\n')), ws.join(' | '));
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('why: the Contracts tab shows it', pg.includes('Why: ${c.why}'));
}

// flow-2. What to do next (flow session, QUEUE Q40): the Program screen's one suggestion. A new career is pointed at the
// cheapest first step a preset can fly; a decision or an accepted contract comes first; done missions move it on.
{
  const P = api.PROG, save = { done: P.done, decisions: P.decisions, active: P.active, offers: P.offers, raceLost: P.raceLost };
  Object.assign(P, { done: {}, decisions: [], active: [], offers: [], raceLost: {} });
  const a = api.nextStep(); P.done.weather = P.done.loads = { flight: 1 }; const b = api.nextStep(); P.done.hop = P.done.beeper = { flight: 2 }; const c = api.nextStep();
  P.decisions = [{ title: 'A public launch', expires: (P.day || 0) + 12, opts: [] }]; const d = api.nextStep();
  check('flow-2: next step: a new career starts with a preset-flyable first step; then first orbit or a passenger; then what is left; a decision comes first',
    a && a.id === 'weather' && a.preset === 'Sounding' && /opens/.test(a.why) && b && ['hop', 'beeper'].includes(b.id) && /be first/.test(b.why) && c && c.kind === 'mission' && !['weather', 'loads', 'hop', 'beeper'].includes(c.id) && d && d.kind === 'decision',
    [a, b, c, d].map(x => x && `${x.title} (${x.why}${x.how ? '; ' + x.how : ''})`).join(' → '));
  Object.assign(P, save);
}

// econ-5. Dry runs as the trajectory office's study (economy session, QUEUE Q46): dryQuote prices it like a study (era,
// centre, procedures tried); orderDryRun pays, lets the days pass, runs procAdopt and keeps the measured margin; a
// provisional procedure's estimate is PROV_UNC wider and uses that margin; the dispatch line offers it for the design
// in Assembly when nothing stored can fly the contract.
{
  const P = api.PROG, saved = JSON.stringify(P), st = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], heavy = ['sci', 't1', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], hk = api.procKey(heavy);
  api.HOOK.news = () => {}; api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  P.procs = {}; P.done = { beeper: { flight: 0, day: 0 } }; P.funds = 1e6; handAscent(api, st);
  const c = { id: 931, type: 'sat', src: 'com', client: 0, p: { alt: 160, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 }; P.active = [c];
  const line0 = api.dispatchLine(c, heavy), q = api.dryQuote(heavy), qOwn = api.dryQuote(st), qNone = api.dryQuote(null);
  check('dry run: priced like a study (days and money), refused for a design with its own procedure or no design', q.ok && q.n === 1 && q.cost > 0 && q.days > 0 && !qOwn.ok && !qNone.ok, `${q.days} d, ${q.cost}M; own: ${qOwn.why}`);
  P.funds = q.cost - 0.1; const poor = api.orderDryRun(heavy), none = !P.procs[hk]; P.funds = 1e6;
  const d0 = P.day, r = api.orderDryRun(heavy), pr = P.procs[hk];
  check('dry run: ordering it pays, lets its days pass, and adopts the procedure with the measured margin kept',
    !poor.ok && none && r.ok && r.cost === q.cost && pr && pr.prov && Math.abs(pr.margin - r.margin) < 1e-9 && Math.abs(P.day - d0 - q.days) < 1e-6 && !api.dryQuote(heavy).ok,
    `${r.ok ? `${r.margin.toFixed(0)} m/s to spare` : r.why}; ${(P.day - d0).toFixed(1)} d, ${r.cost}M; short of money: ${poor.why}`);
  const e1 = api.dispatchEstimate(heavy, c); pr.prov = false; const e2 = api.dispatchEstimate(heavy, c); pr.prov = true;
  const m0 = pr.margin; pr.margin = m0 + 500; const e3 = api.dispatchEstimate(heavy, c); pr.margin = m0;
  check('dry run: a provisional procedure\'s estimate is wider, and its margin is the measured one', e1.ok && e2.ok && (e1.hi - e1.lo) > (e2.hi - e2.lo) && Math.abs(e3.margin - e1.margin - 500) < 1e-6,
    `${Math.round(e1.lo * 100)}–${Math.round(e1.hi * 100)}% vs ${Math.round(e2.lo * 100)}–${Math.round(e2.hi * 100)}% if it were its own`);
  P.procs = {}; const lineNo = api.dispatchLine(c, heavy);
  check('dry run: the contract\'s dispatch line offers it for the design in Assembly (which has no procedure)', /data-dry="931"/.test(line0) && /Dispatch /.test(line0), line0.replace(/<[^>]+>/g, ' ').slice(0, 160));
  check('dry run: …and not when there is no stored procedure to try', !/data-dry/.test(lineNo));
  Object.keys(P).forEach(k => delete P[k]); Object.assign(P, JSON.parse(saved));
}

// ground-3. Enyo's ground (world session, GROUND.md G7), the first planet: on the CPU, not live (no Enyo in the body tree
// yet; the recipe hangs on a stub with SYSTEM.md's radius and gravity). SYSTEM.md's ground brief, feature by feature:
// the dichotomy, the giant shield, the canyon a third of the way round, the polar caps; craters, seams and surfaces as on
// Selene. Numbers behind each parameter: `node study_ground.mjs enyo`.
{
  const G = new Function(src + 'return {ENYO_GROUND,enyoMap,enyoH,GROUND_STUBS,EN,llU,grBands,BODIES,SELENE,surfaceAt,terrainSlope,groundAlt,bodyTop,get ENYO_MAP(){return ENYO_MAP}};')();
  const S = G.GROUND_STUBS.Enyo, R = S.R, B = { name: S.name, R, mu: S.g * R * R, ground: G.ENYO_GROUND }, D = Math.PI / 180;
  check('ground-3: Enyo\'s recipe is not live (no Enyo in the body tree), and its map is baked on first use',
    G.ENYO_MAP === null && !G.BODIES.some(b => b.name === 'Enyo'));
  const M = G.enyoMap(), h = u => G.enyoH(u), area = 4 * Math.PI * (R / 1000) ** 2;
  const pts = []; for (let i = 0; i < 4000; i++) { const z = 1 - (2 * i + 1) / 4000, a = i * 2.39996, q = Math.sqrt(1 - z * z); pts.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = pts.map(h), un = pts.map(G.ENYO_GROUND.unit), share = k => un.filter(x => x === k).length / un.length;
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], hOf = k => med(H.filter((_, i) => un[i] === k));
  const b1 = G.grBands(R, G.EN.c)[1];
  check('ground-3: relief within the recipe\'s top; craters on target (baked ≥ 20 km = c·area/400, c 0.02); band λ scaled by c',
    Math.max(...H) < G.bodyTop(B) && Math.min(...H) > -8000 && M.craters.length === Math.round(G.EN.c / 400 * area) && Math.abs(b1.lam / G.grBands(R)[1].lam - G.EN.c / 0.055) < 1e-6   /* λ is a float32 (G3.0) */,
    `${Math.min(...H).toFixed(0)}…${Math.max(...H).toFixed(0)} m (top ${G.bodyTop(B)}) · ${M.craters.length} baked craters`);
  // the dichotomy: northern lowlands low and smooth, a third or so of the globe
  const sl = k => med(pts.filter((_, i) => un[i] === k).slice(0, 400).map(u => G.terrainSlope(B, u)));
  check('ground-3: the dichotomy: northern lowland plains (30–45 % of Enyo) lie 3+ km below the highlands and are smoother',
    share('lowland plains') > .30 && share('lowland plains') < .45 && hOf('lowland plains') < hOf('highlands') - 3000 && sl('lowland plains') < sl('highlands'),
    `lowlands ${(share('lowland plains') * 100).toFixed(1)} %, median ${hOf('lowland plains').toFixed(0)} m vs highlands ${hOf('highlands').toFixed(0)} m`);
  // the giant shield: its summit rim stands 10+ km above the plains at its foot; the caldera is a pit in it
  const sv = G.llU(...G.EN.shield.at), off = (u, km, az) => { const e = norm(cross([0, 1, 0], u)), n = cross(u, e), d = norm(add(mul(e, Math.cos(az)), mul(n, Math.sin(az)))), a = km * 1e3 / R; return norm(add(mul(u, Math.cos(a)), mul(d, Math.sin(a)))); };
  const rim = Math.max(...[0, 1, 2, 3].map(k => h(off(sv, G.EN.shield.R / 1e3 * .2, k * Math.PI / 2)))), foot = med([0, 1, 2, 3, 4, 5].map(k => h(off(sv, G.EN.shield.R / 1e3 * 1.25, k * 1.05)))), pit = h(sv);
  check('ground-3: the giant shield stands 10+ km above the plains at its foot, with a summit caldera below its rim',
    rim - foot > 10000 && pit < rim - 1000, `rim ${rim.toFixed(0)} m, foot ${foot.toFixed(0)} m, caldera floor ${pit.toFixed(0)} m`);
  // the canyon: along its great circle, 3+ km below the ground 150 km to either side, for over 1,000 km
  const ca = G.llU(...G.EN.canyon.from), ce = norm(cross(ca, [0, 1, 0])), cn = cross(ca, ce);
  let deep = 0; for (let s = 0; s < G.EN.canyon.len; s += 20e3) { const a = s / R, u = norm(add(mul(ca, Math.cos(a)), mul(ce, Math.sin(a)))), side = [-1, 1].map(k => h(norm(add(u, mul(cn, k * 150e3 / R)))));
    if (Math.max(...side) - h(u) > 3000) deep += 20e3; }   // below its higher wall: at its mouth one wall can be the lowlands, as on Mars
  check('ground-3: the canyon: 3+ km below its higher wall for over 1,000 km along its arc (a third of the way round), terraced walls',
    deep > 1.0e6 && share('canyon') > .005, `deep for ${(deep / 1e3).toFixed(0)} km; ${(share('canyon') * 100).toFixed(1)} % of Enyo`);
  // caps and surfaces: the north pole is an ice dome you land on as ice; dunes are sand; Selene keeps its regolith
  const np = [0, 1, 0], su = G.surfaceAt(B, np), dun = pts.find((u, i) => un[i] === 'dunes');
  check('ground-3: the north polar cap is an ice dome (ice to land on); dune fields are sand; a recipe without surfaces keeps regolith',
    su.name === 'water ice' && h(np) > hOf('lowland plains') + 1500 && dun && G.surfaceAt(B, dun).name === 'dune sand' && G.surfaceAt(G.SELENE, [G.SELENE.R, 0, 0]).name === 'regolith',
    `pole ${h(np).toFixed(0)} m on ${su.name}; dunes ${dun ? G.surfaceAt(B, dun).name : '—'}`);
  // no seams on the cube faces
  let rs = 5, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(h(v) - h(n)) / 0.5); }
  check('ground-3: continuous across the crater cells\' cube-face seams (under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
}

// space-1. Station-keeping as a fuel lifetime (space session, QUEUE Q50, ROADMAP W2): a satellite holds its orbit by
// spending its own propellant against the moons' tides, at a rate measured once for its orbit (study_slot.mjs); dry, the
// tide steps it between flights and it drifts off its slot. Low orbits feel no tide in the game (pertNear) and cost nothing.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,satAt,kepler,elements,slotRate,slotTilt,skDv,skLife,isTV,capital,rotY,absTh,TELLUS,SELENE,PROG,HOOK,DAY_S,STAT_R,YEAR_D};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, G0 = 9.80665; P.sats = []; P.day = 0;
  // a Probe left in a circular orbit of radius a, inclination inc; then its tanks set to hold dv m/s (null: as launched)
  const reg = (a, inc, dv = null) => { const s = D.newShip(D.PRESETS.Probe), vc = Math.sqrt(T.mu / a), c = Math.cos(inc * Math.PI / 180), si = Math.sin(inc * Math.PI / 180);
    Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, vc * si, -vc * c] }); D.satRegister(s, { day0: 0 }); const q = P.sats.at(-1);
    if (dv != null) { let tk = null; for (const o of q.shape) if (o.res) for (const k of ['fuel', 'gas']) if (o.res[k] > 0) { q.mass -= o.res[k] * 1000; o.res[k] = 0; if (k === 'fuel') tk = o; }
      const m0 = q.mass; let lo = 0, hi = m0 * 0.9;   // the fuel that gives dv, by bisection on skDv
      if (dv > 0) for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; tk.res.fuel = mid; q.mass = m0 + mid * 1000; if (D.skDv(q) < dv) lo = mid; else hi = mid; } }
    return q; };
  const R = T.R, low = reg(R + 300e3, 0), nav = reg(R + 3000e3, 60), stat = reg(D.STAT_R, 0), k = q => D.slotRate(q);
  check('station-keeping: holding an orbit’s size and shape costs what the tides pull, nothing in low orbit, ~0.02–0.06 m/s a day at 3,000 km, ~0.05–0.3 stationary; the tilt is let go (re-tuned for MIDGAME § Satellites; study_slot.mjs)',
    k(low) === 0 && k(nav) > 0.02 && k(nav) < 0.06 && k(stat) > 0.05 && k(stat) < 0.3 && D.slotTilt(stat) > 3e-5 && D.slotTilt(low) < 3e-5,
    `low ${k(low)}, nav ${k(nav).toFixed(3)}, stationary ${k(stat).toFixed(3)} m/s a day; stationary tilt ${(D.slotTilt(stat) * 400 * 180 / Math.PI).toFixed(2)}° a year`);
  // a stationary satellite with tanks for 100 m/s holds its rails for ~250 days; one with 4 days' worth goes adrift on day 4
  P.sats = []; news.length = 0; const held = reg(D.STAT_R, 0, 100), short = reg(D.STAT_R, 0, 4 * k(held)), none = reg(D.STAT_R, 0, 0);
  const r0 = D.satAt(held, 30 * D.DAY_S)[0], ep0 = held.epoch, m0 = held.mass, life0 = D.skLife(held);
  D.advanceDays(30);
  const spent = 100 - D.skDv(held), off = q => len(sub(D.satAt(q, 30 * D.DAY_S)[0], D.kepler([D.STAT_R, 0, 0], [0, 0, -Math.sqrt(T.mu / D.STAT_R)], 30 * D.DAY_S, T.mu)[0]));
  const el0 = D.elements([D.STAT_R, 0, 0], [0, 0, -Math.sqrt(T.mu / D.STAT_R)], T.mu), el1 = D.elements(held.r, held.v, T.mu), tilt = Math.acos(Math.min(1, el1.h[1] / el1.hl));
  check('station-keeping: with propellant it holds its orbit’s size and shape, its tilt wanders a little, and it pays the rate from its own tanks (mass and Δv drop)',
    Math.abs(el1.a - el0.a) < 1 && Math.abs(el1.e - el0.e) < 1e-6 && tilt > 0 && tilt < 0.01 && Math.abs(spent - 30 * k(held)) < 0.01 * spent && held.mass < m0 && held.adrift == null && Math.abs(D.skLife(held) - (life0 - 30)) < 0.5,
    `spent ${spent.toFixed(2)} m/s in 30 days (rate ${(30 * k(held)).toFixed(2)}); tilt ${(tilt * 180 / Math.PI).toFixed(3)}°; life ${life0.toFixed(0)} → ${D.skLife(held).toFixed(0)} days; ${(m0 - held.mass).toFixed(1)} kg lighter`);
  check('station-keeping: dry, it drifts off its slot under the tide (news once, only for one that had propellant), and nothing is lost',
    Math.abs(short.adrift - 4) < 0.05 && none.adrift === 0 && off(short) > 100e3 && off(none) > 100e3 && off(held) < 50e3 && P.sats.length === 3 &&
    news.filter(m => /last of its propellant/.test(m)).length === 1 && news.some(m => m.startsWith(short.name)),
    `adrift on day ${short.adrift?.toFixed(2)} and ${none.adrift}; off the slot after 30 days: ${(off(short) / 1e3).toFixed(0)} km and ${(off(none) / 1e3).toFixed(0)} km (held, its tilt only: ${(off(held) / 1e3).toFixed(1)} km)`);
  // around a moon too: the 2,000 km polar Selene orbit that Tellus's tide pulls into the ground in ~41 days (test 40) holds with propellant
  P.sats = []; news.length = 0; const B = D.SELENE, s = D.newShip(D.PRESETS.Probe), vs = Math.sqrt(B.mu / (B.R + 2000e3));
  Object.assign(s, { alive: true, landed: false, body: B, r: [B.R + 2000e3, 0, 0], v: [0, vs, 0] }); D.satRegister(s, { day0: P.day }); const sq = P.sats.at(-1), sel0 = D.elements(sq.r, sq.v, B.mu), dv0 = D.skDv(sq);
  D.advanceDays(45);
  check('station-keeping: around Selene, a polar orbit the tide would pull into the ground holds while its tanks last',
    P.sats.includes(sq) && Math.abs(D.elements(sq.r, sq.v, B.mu).a - sel0.a) < 1 && Math.abs(D.elements(sq.r, sq.v, B.mu).e - sel0.e) < 1e-6 && sq.adrift == null && D.skDv(sq) < dv0 && !news.some(m => /came down/.test(m)),
    `${D.slotRate(sq).toFixed(2)} m/s a day; ${(dv0 - D.skDv(sq)).toFixed(0)} of ${dv0.toFixed(0)} m/s spent in 45 days`);
  // a TV satellite over the capital, held: two years on its tilt is past the old 3° limit and the capital still sees it all day
  P.sats = []; P.day = 0; const c = D.capital(), u = D.rotY(c.u, D.absTh(0)), lon = Math.atan2(u[2], u[0]), aS = D.STAT_R, vS = Math.sqrt(T.mu / aS), tvs = D.newShip(D.PRESETS.Probe);
  Object.assign(tvs, { alive: true, landed: false, body: T, r: [aS * Math.cos(lon), 0, aS * Math.sin(lon)], v: [vS * Math.sin(lon), 0, -vS * Math.cos(lon)] }); D.satRegister(tvs, { day0: 0 }); const tq = P.sats.at(-1);
  let tvDays = 0; const tv0 = D.isTV(tq, 0); for (let d = 0; d < 2 * D.YEAR_D; d++) { D.advanceDays(1); if (D.isTV(tq, P.day * D.DAY_S)) tvDays++; }
  const tel = D.elements(tq.r, tq.v, T.mu), tilt2 = Math.acos(Math.min(1, tel.h[1] / tel.hl)) * 180 / Math.PI;
  check('station-keeping: a held TV satellite’s tilt wanders past 3° in two years and the capital still sees it all day, so TV pays on',
    tv0 && tilt2 > 3 && tvDays === 2 * D.YEAR_D, `tilt ${tilt2.toFixed(1)}° after two years; TV on ${tvDays} of ${2 * D.YEAR_D} days`);
}

// qa-2. The tester's "go to body" view (QA session, QUEUE Q79): its catalogue holds every SYSTEM.md body with the
// radius and tilt SYSTEM.md gives, render() hands it the frame, and the tester menu and views.js reach it.
{
  const bv = readFileSync(new URL('./app/bodyview.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const CAT = new Function(bv.slice(bv.indexOf('const BODY_CAT='), bv.indexOf('];', bv.indexOf('const BODY_CAT=')) + 2) + 'return BODY_CAT')();
  const sys = readFileSync(new URL('./SYSTEM.md', import.meta.url), 'utf8'), num = s => +s.replace(/,/g, '');
  const want = {}; for (const m of sys.matchAll(/^### (\w+)[^\n]*\n- \*\*Physical:\*\* R ([\d,]+) km[^\n]*?(?:tilt (?:\*\*)?(\d+)°)?/gm)) want[m[1]] = {R: num(m[2]) * 1e3, tilt: m[3] != null ? +m[3] : null};
  for (const m of sys.matchAll(/\*\*(\w+)\*\* \([^)]*\): R ~?([\d,]+) km/g)) want[m[1]] = {R: num(m[2]) * 1e3, tilt: null};
  for (const m of sys.matchAll(/\*\*(Pavor|Metus)\*\* \(R ~(\d+) km\)/g)) want[m[1]] = {R: +m[2] * 1e3, tilt: null};
  const bad = Object.entries(want).filter(([k, w]) => { const c = CAT.find(b => b.name === k); return !c || Math.abs(c.R - w.R) > 1 || (w.tilt != null && c.tilt !== w.tilt); }).map(([k]) => k);
  check('go to body: every SYSTEM.md body is in the catalogue with its radius and tilt', Object.keys(want).length >= 11 && !bad.length && CAT.length === Object.keys(want).length,
    `${Object.keys(want).length} in SYSTEM.md (${Object.keys(want).join(', ')}), ${CAT.length} in the catalogue; mismatched: ${bad.join(', ') || 'none'}`);
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  check('go to body: render() hands over the frame first; the tester menu and refView(200 + 3·i + k) open it',
    /function render\(\)\{\n\s*if\(self\.bodyViewDraw&&self\.bodyViewDraw\(\)\)return;/.test(pg) && /data-test-body=/.test(pg) && /bodyViewOpen\(d\.testBody/.test(pg) && /n >= 200 && typeof BODY_CAT/.test(vj) && /bodyViewClose\(\)/.test(vj));
}

// vehicle-2. Power (vehicle session, QUEUE Q34a; NOTES § "Vehicle parts"): batteries, solar cells and wings, the loads, and the
// onboard computer. The builder's steady state (an orbit's average generation against the load, a battery for one shadow) agrees
// with the store integrated along an orbit; a deployed wing tears off in thick air; running flat drops a probe's guidance
// computer to the analog autopilot, never kills it; crew capsules carry their own computer.
{
  const find = (n, k) => n.k === k ? n : (n.c || []).map(x => find(x, k)).find(Boolean);
  const sat = (wings = 2, extra = []) => { const d = api.toV2(['core', 'ocomp', 'batt', 'ant', 't1', 'petrel', ...extra]); if (wings) find(d.root, 't1').c.push({ k: 'wpanel', at: { y: 0.55, a: 0, n: wings, cy: 0.3 }, c: [] }); return d; };
  const mu = TELLUS.mu, R = TELLUS.R, ecl = Math.acos(Math.sqrt(LEO * LEO - R * R) / LEO) / Math.PI, T = 2 * Math.PI * Math.sqrt(LEO ** 3 / mu);
  const s0 = api.newShip(sat()), B = api.powerBudget(s0);
  check('power: the low-orbit budget by hand: two wings 2 × 300 W × 0.9, 55 W of load, 37 % of the orbit in shadow, 1.5 kWh against one shadow',
    Math.abs(B.peak - 540) < 1e-6 && Math.abs(B.use - 55) < 1e-6 && Math.abs(B.ecl - ecl) < 1e-9 && Math.abs(ecl - 0.372) < 0.005 && Math.abs(B.avg - 540 * (1 - ecl)) < 1e-6
      && Math.abs(B.tE - ecl * T) < 1e-6 && Math.abs(B.battWh - 1500) < 1e-6 && B.ok && api.eclFrac(R, LEO, Math.PI / 2) === 0,
    `${B.avg.toFixed(0)} W average of ${B.peak} W, shadow ${(B.tE / 60).toFixed(1)} min of ${(T / 60).toFixed(1)}, needs ${B.needWh.toFixed(1)} Wh`);
  // one orbit with the sun in its plane (β 0), the wings' arms square to the sun, on rails in 20 s steps: the store dips in the
  // shadow and refills in the sun, and gains what the steady state says; one long rails step gains the same
  const S = api.SUN_DIR, h = norm(cross(S, [0, 1, 0])), k = cross(h, S), up = (s) => { s.r = mul(S, LEO); s.v = mul(k, Math.sqrt(mu / LEO)); s.w = [0, 0, 0];
    s.q = api.qFromBasis(h, S, cross(h, S)); s.sas = true; s.sasMode = 'stab'; s.throttle = 0; s.landed = false; };
  api.t = 0; const s1 = api.newShip(sat()); api.S = s1; api.HOOK.msg = () => {}; up(s1); api.wingOp(s1, 'out'); api.powerStep(s1, 0); s1.E = s1.Emax / 2;
  const E0 = s1.E; let drain = 0; for (let t = 0; t < T - 1; t += 20) { const e = s1.E; api.advRails(s1, Math.min(20, T - t), 10); if (s1.E < e) drain += e - s1.E; }
  const gain = s1.E - E0, want = (B.avg - B.use) * T;
  api.t = 0; const s2 = api.newShip(sat()); api.S = s2; up(s2); api.wingOp(s2, 'out'); api.powerStep(s2, 0); s2.E = s2.Emax / 2; api.advRails(s2, T, 1000); const gain2 = s2.E - s2.Emax / 2;
  check('power: along one orbit the battery drains in the shadow and refills in the sun; the gain matches the steady state within 5 % (in 20 s steps and in one step)',
    Math.abs(drain - B.use * B.tE) < 0.1 * B.use * B.tE && Math.abs(gain - want) < 0.05 * Math.abs(want) && Math.abs(gain2 - want) < 0.05 * Math.abs(want),
    `stepped ${(gain / 3600).toFixed(0)} Wh, one step ${(gain2 / 3600).toFixed(0)} Wh, steady state ${(want / 3600).toFixed(0)} Wh; drained ${(drain / 3600).toFixed(1)} Wh in the shadow (load × shadow: ${(B.use * B.tE / 3600).toFixed(1)})`);
  // a wing deployed at 10 km and 300 m/s (~14 kPa) tears off; deployed in vacuum it stays
  { api.t = 0; const s = api.newShip(sat()); api.S = s; const ms = []; api.HOOK.msg = m => ms.push(m); s.landed = false; s.r = [R + api.groundAlt(TELLUS, [1, 0, 0]) + 10000, 0, 0]; s.v = add(api.surfVel(TELLUS, s.r), [0, 300, 0]);
    s.q = api.qFromBasis([0, 0, 1], [1, 0, 0], [0, -1, 0]); s.w = [0, 0, 0]; api.wingOp(s, 'out'); api.advPhys(s); const air = s.parts.filter(p => p.on && p.d.wing).length;
    const v = api.newShip(sat()); api.S = v; up(v); api.wingOp(v, 'out'); for (let i = 0; i < 50; i++) api.advPhys(v); const vac = v.parts.filter(p => p.on && p.d.wing).length;
    check('power: a solar wing deployed in thick air (10 km, 300 m/s: ~14 kPa) tears off; deployed in orbit it stays', air === 0 && vac === 2 && ms.filter(m => /torn off/.test(m)).length === 2, `${ms.find(m => /torn off/.test(m))} · q ${(s.qdyn / 1000).toFixed(1)} kPa, ${air} left · in orbit ${vac} wings`); }
  // the computer: a program running in the onboard-computer era, a vessel that launched with the guidance computer
  { const P = api.PROG, f0 = P.flights, tl = api.TEST.tools; P.flights = Math.max(1, f0); api.TEST.tools = false; const top = api.AV.length - 1, msgs = []; api.HOOK.msg = m => msgs.push(m);
    const probe = api.newShip(sat()); probe.av = top; const bare = api.newShip(['core', 'batt', 't1', 'petrel']); bare.av = top; const crew = api.newShip(['crew', 't1', 'petrel']); crew.av = top;
    const g0 = api.avOf(probe) === api.AV[top] && api.avOf(bare) === api.AV[top - 1] && api.avOf(crew) === api.AV[top] && api.hasComputer(crew);
    api.S = probe; up(probe); probe.E = 1; const S2 = api.SUN_DIR; probe.r = mul(S2, -LEO); api.powerStep(probe, 10); const flat = probe.pwrOut && api.avOf(probe) === api.AV[top - 1] && probe.alive;
    probe.r = mul(S2, LEO); api.wingOp(probe, 'out'); api.powerStep(probe, 10); const back = !probe.pwrOut && api.avOf(probe) === api.AV[top];
    P.flights = f0; const sandbox = f0 > 0 ? true : api.avOf(bare) === api.AV[top]; api.TEST.tools = tl;
    check('power: from the onboard-computer era a probe needs its computer for the guidance modes (a crew capsule has its own); flat, it falls back to analog and recovers in the sun',
      g0 && flat && back && sandbox && msgs.some(m => /Power flat: the onboard computer is off/.test(m)) && msgs.includes('Power back'),
      `probe ${api.avOf(probe).name} · bare probe ${api.AV[top - 1].name} · crew capsule ${api.AV[top].name} · ${msgs.filter(m => /Power/.test(m)).join(' / ')}`); }
  { const s = api.newShip(sat()); api.S = s; const T2 = api.tapeNew(sat()); api.tapeWings(T2, s, 'out'); const s2 = api.newShip(sat()); api.S = s2; api.tapePlay({ tape: T2, i: 0 }, s2, 10);
    check('power: an autopilot tape records the wings going out and replays it', api.wingsOut(s) && api.wingsOut(s2) && T2.ops.some(o => o[0] === 'W' && o[1] === 'out')); }
}

// econ-6. Rover part prices and gates; Selene science contracts (economy session, QUEUE Q10). A packed rover's price is
// its parts'; a rocket can't carry a rover with a part not yet open (the yard is free). The R4 contracts are judged
// between flights on science received since they were taken.
{
  const D = new Function(src + 'return {rvPrice,rvLocked,rvLaunchWhy,rvPartOpen,rvDefault,partPrice,PARTS,CT,selN,selSci,selTick,sciGot,genOffer,acceptOffer,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, stand: {}, done: {}, own: null, decisions: [], offers: [], active: [], cdone: 0, flights: 3, kh: {}, sel: null }); D.chooseStart('agency');
  const apollo = D.rvDefault(), basic = { name: 'Yard cart', ch: 's', wh: 's', n: 4, slots: ['bat', 'cam', null] };
  const part = d => ({ d: D.PARTS.rvdeck, dn: { rvd: d } }), bare = D.partPrice({ d: D.PARTS.rvdeck, dn: {} });
  check('rovers: a packed rover costs its parts (the default two-seater 24M), on top of the deck', D.rvPrice(apollo) === 24 && Math.abs(D.partPrice(part(apollo)) - bare - 24) < 1e-9 && D.rvPrice(basic) === 9,
    `two-seater ${D.rvPrice(apollo)}M, yard cart ${D.rvPrice(basic)}M, deck ${bare}M`);
  const lk0 = D.rvLocked(apollo).map(x => x.k).join(), why0 = D.rvLaunchWhy([part(apollo)]), cart = D.rvLaunchWhy([part(basic)]);
  P.done = { farside: { day: 1 }, orbiter: { day: 1 } }; const lk1 = D.rvLocked(apollo).length, why1 = D.rvLaunchWhy([part(apollo)]);
  check('rovers: parts open with firsts; a rocket can\'t carry a rover with a locked part; the basic cart flies from the start',
    lk0 === 'm,m,seat' && /can't fly yet/.test(why0) && /The far side/.test(why0) && cart === '' && lk1 === 0 && why1 === '', `locked at start: ${lk0} · ${why0}`);
  P.done.selland = { day: 1 }; P.sel = null; const S = D.selSci();
  const mk = (type, p) => { const c = { id: 900 + P.active.length, type, src: 'sci', client: 0, p: { ...p }, deadline: P.day + 300 }; c.base = D.selN(); P.active.push(c); return c; };
  D.sciGot({ k: 'spec', unit: 'mare', FeO: 10, TiO2: 2, Al2O3: 10, pf: [-1, 0, 0] }, 'R');   // one from before: doesn't count
  const read = mk('selRead', { unit: 'mare', n: 2, pay: 50 }), pano = mk('selPano', { q: 0.8, pay: 60 }), far = mk('selFar', { n: 1, pay: 90 });
  D.sciGot({ k: 'spec', unit: 'mare', FeO: 11, TiO2: 3, Al2O3: 10, pf: [-1, 0, 0] }, 'R'); D.sciGot({ k: 'pano', q: 0.7, el: 30, unit: 'mare' }, 'R'); const f0 = P.funds; D.selTick(); const after1 = P.active.length, f1 = P.funds;
  D.sciGot({ k: 'spec', unit: 'mare', FeO: 12, TiO2: 3, Al2O3: 10, pf: [1, 0, 0] }, 'R'); D.sciGot({ k: 'pano', q: 0.85, el: 10, unit: 'high' }, 'R'); D.selTick();
  check('Selene contracts: readings, a good enough panorama and far-side science complete between flights, not before they arrive',
    after1 === 3 && f1 === f0 && !P.active.includes(read) && !P.active.includes(pano) && !P.active.includes(far) && P.funds > f0 && D.selN().far === 1, `paid ${(P.funds - f0).toFixed(0)}M; after the first results ${after1} open; left ${P.active.map(c => c.type).join(',') || 'none'}`);
  const types = () => { const seen = new Set(); const R = D.rng(3); for (let k = 0; k < 300; k++) { const o = D.genOffer('sci', R); if (o) seen.add(o.type); } return seen; };
  const t0 = types(); S.seis = [{ id: 1 }, { id: 2 }, { id: 3 }]; const t1 = types();
  check('Selene contracts: located quakes are offered only once three stations stand; the network only while it has fewer than four',
    !t0.has('selQuake') && t0.has('selSeis') && t0.has('selRead') && t1.has('selQuake') && !t1.has('selCore'), `${[...t1].filter(x => x.startsWith('sel')).join(', ')}`);
}

// ground-4. Hesper's ground (world session, GROUND.md G7): on the CPU, not live (stub body). Venus's character: craters
// few, fresh and none small (the thick air), mostly smooth basalt plains, raised and rough slab rock, one high massif,
// gentle shields, coronae, narrow lava channels. Numbers behind each parameter: `node study_ground.mjs hesper`.
{
  const G = new Function(src + 'return {HESPER_GROUND,hesperMap,hesperH,hesperChan,GROUND_STUBS,HE,llU,grBands,BODIES,surfaceAt,terrainSlope,bodyTop,get HESPER_MAP(){return HESPER_MAP}};')();
  const S = G.GROUND_STUBS.Hesper, R = S.R, B = { name: S.name, R, mu: S.g * R * R, ground: G.HESPER_GROUND }, D = Math.PI / 180;
  check('ground-4: Hesper\'s recipe is not live (no Hesper in the body tree), and its map is baked on first use', G.HESPER_MAP === null && !G.BODIES.some(b => b.name === 'Hesper'));
  const M = G.hesperMap(), h = u => G.hesperH(u), area = 4 * Math.PI * (R / 1000) ** 2, bs = G.grBands(R, G.HE.c).slice(0, G.HE.bands);
  const pts = []; for (let i = 0; i < 6000; i++) { const z = 1 - (2 * i + 1) / 6000, a = i * 2.39996, q = Math.sqrt(1 - z * z); pts.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = pts.map(h), un = pts.map(G.HESPER_GROUND.unit), share = k => un.filter(x => x === k).length / un.length;
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], at = k => pts.filter((_, i) => un[i] === k), hOf = k => med(H.filter((_, i) => un[i] === k));
  const nBig = Math.round(G.HE.c / 4 * area);   // craters over 2 km expected on the whole planet
  check('ground-4: craters are few and none small: ~' + nBig + ' over 2 km on all of Hesper, the finest band stops at 1.3 km; relief within top',
    nBig > 80 && nBig < 250 && bs[bs.length - 1].Dlo > 1200 && Math.max(...H) < G.bodyTop(B) && M.craters.length <= 3,
    `${nBig} over 2 km · smallest ${(bs[bs.length - 1].Dlo / 1e3).toFixed(1)} km · ${Math.min(...H).toFixed(0)}…${Math.max(...H).toFixed(0)} m (top ${G.bodyTop(B)})`);
  const sl = k => med(at(k).slice(0, 300).map(u => G.terrainSlope(B, u) / D));
  check('ground-4: smooth basalt plains cover most of Hesper; slab rock (~10 %) stands 1.5+ km above them and is rougher',
    share('plains') > .7 && share('slab rock') > .05 && share('slab rock') < .2 && hOf('slab rock') > hOf('plains') + 1500 && sl('slab rock') > 3 * sl('plains'),
    `plains ${(share('plains') * 100).toFixed(1)} % (${sl('plains').toFixed(1)}°), slab rock ${(share('slab rock') * 100).toFixed(1)} % (${sl('slab rock').toFixed(1)}°, ${(hOf('slab rock') - hOf('plains')).toFixed(0)} m higher)`);
  const ma = G.llU(...G.HE.massif.at), shields = G.HE.shields.map(s => { const c = G.llU(s[0], s[1]), e = norm(cross([0, 1, 0], c)), n = cross(c, e), foot = Math.min(...[0, 1, 2, 3, 4, 5].map(k => h(norm(add(c, mul(add(mul(e, Math.cos(k * 1.05)), mul(n, Math.sin(k * 1.05))), 1.3 * s[2] / R)))))); return h(norm(add(c, mul(e, .1 * s[2] / R)))) - foot; });   // the foot: the lowest ground round it
  check('ground-4: the massif rises past 8 km; every shield stands 3+ km above its foot', h(ma) > 8000 && shields.every(x => x > 3000), `massif ${h(ma).toFixed(0)} m; shields ${shields.map(x => x.toFixed(0)).join(', ')} m`);
  const co = G.HE.coronae.map(s => { const c = G.llU(s[0], s[1]), e = norm(cross([0, 1, 0], c)), p = r => h(norm(add(c, mul(e, r * s[2] / R)))); return [p(0), p(.85), p(1.08)]; });
  check('ground-4: coronae are rings: the rim stands above both the centre and the moat outside', co.every(([c, r, o]) => r > c + 300 && r > o + 300), co.map(x => x.map(v => v.toFixed(0)).join('/')).join(' · '));
  // a lava channel: a narrow trough. 3 km out, the ground is higher across it and level along it
  let rs = 9; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647, chs = [];
  for (let i = 0; i < 400000 && chs.length < 5; i++) { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), q = Math.sqrt(1 - z * z), u = [q * Math.cos(t), z, q * Math.sin(t)]; if (G.hesperChan(u, R, M) > .95) chs.push(u); }
  // across a channel (the direction where both sides 3 km out are highest) the floor is 40+ m lower on both sides; along it
  // (at right angles, 1 km out: channels meander, so 3 km along the tangent leaves them) it isn't: a channel, not a pit.
  // The median of five channel points (the plains' wrinkle ridges make any one profile wander)
  const prof = ch => { const e1 = norm(cross([0, 1, 0], ch)), n1 = cross(ch, e1), side = (a, r) => [-1, 1].map(k => h(norm(add(ch, mul(add(mul(e1, Math.cos(a)), mul(n1, Math.sin(a))), k * r / R)))));
    let best = null; for (let k = 0; k < 18; k++) { const a = k * Math.PI / 18, d = Math.min(...side(a, 3e3)) - h(ch); if (!best || d > best.d) best = { a, d }; }
    return { across: best.d, along: Math.min(...side(best.a + Math.PI / 2, 1e3)) - h(ch) }; };
  const P = chs.map(prof), acr = med(P.map(p => p.across)), alg = med(P.map(p => p.along));
  check('ground-4: lava channels are narrow troughs in the plains (3 km across: 40+ m higher on both sides; 1 km along: not; median of 5)',
    chs.length === 5 && acr > 40 && alg < acr / 2 && chs.every(u => G.surfaceAt(B, u).name === 'channel floor'), `across +${acr.toFixed(0)} m, along ${alg.toFixed(0)} m (${chs.length} channel points)`);
  let worst = 0; for (let i = 0; i < 2000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(h(v) - h(n)) / 0.5); }
  check('ground-4: surfaces by unit (basalt plains, slab rock); no seams on the cube faces',
    G.surfaceAt(B, at('plains')[0]).name === 'basalt plains' && G.surfaceAt(B, at('slab rock')[0]).name === 'slab rock' && Math.atan(worst) / D < 60, `steepest seam step ${(Math.atan(worst) / D).toFixed(1)}°`);
}

// space-2. Orbital decay (space session, QUEUE Q25): above the flight's air a thin upper atmosphere (Vallado's exponential
// table) drags on low orbits between flights. A satellite with propellant pays to hold its orbit (with Q50's tides); a dry
// one sinks on its rails (orbit-averaged drag, study_decay.mjs) and re-enters when its periapsis reaches the air's top.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,satAt,kepler,elements,thinAir,dragK,dragRate,holdRate,decayLife,decayStep,skDv,skLife,TELLUS,PROG,HOOK,DAY_S,len,add,mul};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R; P.sats = []; P.day = 0;
  // a Probe left in a circular equatorial orbit at alt, its tanks emptied unless keep
  const reg = (alt, keep = false) => { const s = D.newShip(D.PRESETS.Probe), a = R + alt, vc = Math.sqrt(T.mu / a);
    Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -vc] }); D.satRegister(s, { day0: P.day }); const q = P.sats.at(-1);
    if (!keep) for (const o of q.shape) if (o.res) for (const k of ['fuel', 'gas']) if (o.res[k] > 0) { q.mass -= o.res[k] * 1000; o.res[k] = 0; }
    return q; };
  const ok1 = Math.abs(D.thinAir(200e3) / 2.789e-10 - 1) < 1e-9 && D.thinAir(99e3) === 0 && D.thinAir(150e3) < D.thinAir(140e3);
  const lo = reg(200e3), hi = reg(700e3), K = D.dragK(lo), L = D.decayLife(lo);
  check('decay: the upper air thins with height; a dry Probe at 200 km has a lifetime of tens of days, one at 700 km lasts',
    ok1 && K > 0.005 && K < 0.05 && L > 10 && L < 200 && D.decayLife(hi) === Infinity, `Cd·A/m ${K.toFixed(4)} m²/kg; life at 200 km ${L.toFixed(1)} days`);
  const pe0 = D.elements(lo.r, lo.v, T.mu).pe, hr0 = hi.r.slice(), hv0 = hi.v.slice();
  D.advanceDays(Math.floor(L / 2)); const pe1 = D.elements(lo.r, lo.v, T.mu).pe, L1 = D.decayLife(lo), hiMoved = Math.abs(D.elements(hi.r, hi.v, T.mu).pe - D.elements(hr0, hv0, T.mu).pe);
  D.advanceDays(Math.ceil(L - Math.floor(L / 2)) + 1);
  check('decay: dry, it sinks on its rails as predicted, is warned about, and re-enters; the high one barely feels it',
    pe1 < pe0 - 5e3 && Math.abs(L1 - (L - Math.floor(L / 2))) < 0.05 * L + 0.5 && !P.sats.includes(lo) && P.sats.includes(hi) && hiMoved < 100 &&
    news.some(m => m.startsWith(lo.name) && /within/.test(m)) && news.some(m => m.startsWith(lo.name) && /re-entered/.test(m)),
    `periapsis ${((pe0 - R) / 1e3).toFixed(0)} → ${((pe1 - R) / 1e3).toFixed(0)} km by day ${Math.floor(L / 2)}; life then ${L1.toFixed(1)} (expected ${(L - Math.floor(L / 2)).toFixed(1)}); 700 km periapsis moved ${hiMoved.toFixed(2)} m; news: ${news.filter(m => m.startsWith(lo.name)).join(' / ')}`);
  // with its tanks, it holds: on its rails, paying the drag
  P.sats = []; news.length = 0; P.day = 0; const held = reg(200e3, true), ep = held.epoch, dv0 = D.skDv(held), g = D.dragRate(held);
  D.advanceDays(30);
  check('decay: with propellant it holds its orbit, paying what the drag takes, and says how long that lasts',
    P.sats.includes(held) && held.epoch === ep && held.adrift == null && Math.abs(dv0 - D.skDv(held) - 30 * D.holdRate(held)) < 0.05 * 30 * g && g > 0 && D.skLife(held) < Infinity,
    `${g.toFixed(3)} m/s a day; ${(dv0 - D.skDv(held)).toFixed(2)} m/s in 30 days; ${D.skLife(held).toFixed(0)} days left`);
  // the averaged rails against a direct RK4 with the same drag (no tides), 150 km down to 130 km
  { const q = reg(150e3), K2 = D.dragK(q), a0 = R + 150e3; let r = [a0, 0, 0], v = [0, 0, -Math.sqrt(T.mu / a0)], t = 0; const h = 2, { add, mul, len } = D;
    const acc = (r, v) => { const rl = len(r), vl = len(v), f = 0.5 * D.thinAir(rl - R) * vl * K2; return add(mul(r, -T.mu / rl ** 3), mul(v, -f)); };
    while (D.elements(r, v, T.mu).pe > R + 130e3) { const a1 = acc(r, v), r2 = add(r, mul(v, h / 2)), v2 = add(v, mul(a1, h / 2)), a2 = acc(r2, v2), r3 = add(r, mul(v2, h / 2)), v3 = add(v, mul(a2, h / 2)), a3 = acc(r3, v3), r4 = add(r, mul(v3, h)), v4 = add(v, mul(a3, h)), a4 = acc(r4, v4);
      r = add(r, mul(add(add(v, mul(v2, 2)), add(mul(v3, 2), v4)), h / 6)); v = add(v, mul(add(add(a1, mul(a2, 2)), add(mul(a3, 2), a4)), h / 6)); t += h; }
    q.epoch = 0; q.r = [a0, 0, 0]; q.v = [0, 0, -Math.sqrt(T.mu / a0)]; let tr = 0; while (D.elements(q.r, q.v, T.mu).pe > R + 130e3) { tr += 600; D.decayStep(q, tr); }
    check('decay: the averaged rails agree with a direct integration of the drag (150 → 130 km) to a few percent', Math.abs(tr / t - 1) < 0.05, `direct ${(t / 3600).toFixed(1)} h, rails ${(tr / 3600).toFixed(1)} h`); }
}

// ground-5. Astraea's ground (world session, GROUND.md G7): Ceres's character on a 94 km body with g 0.28, on the CPU,
// not live (stub body). Its weak icy crust turns craters complex at 12.5 km and keeps the big ones shallow; one young
// bright crater with salt on its floor; one lonely mountain. Numbers behind each parameter: `node study_ground.mjs astraea`.
{
  const G = new Function(src + 'return {ASTRAEA_GROUND,astraeaMap,astraeaH,GROUND_STUBS,AS,llU,BODIES,surfaceAt,terrainSlope,bodyTop,get ASTRAEA_MAP(){return ASTRAEA_MAP}};')();
  const S = G.GROUND_STUBS.Astraea, R = S.R, B = { name: S.name, R, mu: S.g * R * R, ground: G.ASTRAEA_GROUND }, D = Math.PI / 180;
  check('ground-5: Astraea\'s recipe is not live (no Astraea in the body tree), and its map is baked on first use', G.ASTRAEA_MAP === null && !G.BODIES.some(b => b.name === 'Astraea'));
  const M = G.astraeaMap(), h = u => G.astraeaH(u), area = 4 * Math.PI * (R / 1000) ** 2;
  const pts = []; for (let i = 0; i < 3000; i++) { const z = 1 - (2 * i + 1) / 3000, a = i * 2.39996, q = Math.sqrt(1 - z * z); pts.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = pts.map(h), at = (c, km, az) => { const e = norm(cross([0, 1, 0], c)), n = cross(c, e), d = norm(add(mul(e, Math.cos(az)), mul(n, Math.sin(az)))), a = km * 1e3 / R; return norm(add(mul(c, Math.cos(a)), mul(d, Math.sin(a)))); };
  // the biggest crater: relaxed shallow (the complex depth law above the crust's 12.5 km), not a 20 km-deep bowl
  const big = M.craters.slice().sort((a, b) => b.D - a.D)[0], bigDepth = Math.min(...[0, 1, 2, 3].map(k => h(at(big.c, big.D / 2e3, k * Math.PI / 2)))) - h(big.c);
  check('ground-5: craters on target (baked ≥ 20 km = c·area/400); the crust turns them complex at ~12.5 km and keeps the biggest shallow; relief within top',
    M.craters.length === Math.round(G.AS.c / 400 * area) && M.Dt > 12e3 && M.Dt < 13e3 && bigDepth > 300 && bigDepth < 5000 && Math.max(...H) < G.bodyTop(B),
    `${M.craters.length} baked craters; transition ${(M.Dt / 1e3).toFixed(1)} km; the biggest (${(big.D / 1e3).toFixed(0)} km) ${bigDepth.toFixed(0)} m deep; ${Math.min(...H).toFixed(0)}…${Math.max(...H).toFixed(0)} m`);
  // Ahuna Mons: 3.5+ km above the ground around it, flanks steep but standing (25–45°), a flat-ish top
  const ah = G.llU(...G.AS.ahuna.at), foot = Math.min(...[0, 1, 2, 3, 4, 5].map(k => h(at(ah, 15, k * 1.05)))), fl = Math.max(...[0, 1, 2, 3].map(k => G.terrainSlope(B, at(ah, 6, k * Math.PI / 2)) / D)), top = G.terrainSlope(B, ah) / D;
  check('ground-5: the lonely mountain stands 3.5+ km above its surroundings, its flanks 25–45°, its top flat-ish', h(ah) - foot > 3500 && fl > 25 && fl < 45 && top < 10,
    `summit ${(h(ah) - foot).toFixed(0)} m above its foot; steepest flank ${fl.toFixed(0)}°; top ${top.toFixed(1)}°`);
  // the bright crater: its rim 1.5+ km above its floor, a central pit, salt on the floor (and dark regolith outside)
  const oc = G.llU(...G.AS.occ.at), oR = G.AS.occ.D / 2e3, rim = Math.max(...[0, 1, 2, 3].map(k => h(at(oc, oR, k * Math.PI / 2)))), floor = h(at(oc, oR * .45, 1)), pit = h(oc);
  const salt = [0, 1, 2, 3, 4, 5, 6, 7].map(k => G.surfaceAt(B, at(oc, oR * .2, k * Math.PI / 4)).name).filter(n => n === 'salt deposits').length;
  check('ground-5: the young bright crater: rim 1.5+ km above its floor, a central pit, salt deposits on the floor, dark regolith outside',
    rim - floor > 1500 && pit < floor - 200 && salt >= 3 && G.surfaceAt(B, at(oc, oR * 2.5, 0)).name === 'dark regolith',
    `rim ${(rim - floor).toFixed(0)} m above the floor; pit ${(floor - pit).toFixed(0)} m deeper; salt at ${salt}/8 points on the inner floor`);
  let rs = 11, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(h(v) - h(n)) / 0.5); }
  check('ground-5: continuous across the crater cells\' cube-face seams (under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
}

// ground-6. Hyperion's moons (world session, GROUND.md G7), on the CPU, not live (stub bodies): Theia (Io: no craters,
// paterae, tilted mountains), Eos (Europa + Enceladus: flat ridged ice, chaos, the tiger stripes), Tethys (Titan: methane
// lakes you splash into, linear dunes, a rugged highland), Phoebe (a cratered lump). And every body's poles, Tellus's too:
// the equirectangular maps' polar rows used to make near-vertical steps there (polesFix). `node study_ground.mjs <moon>`.
{
  const G = new Function(src + 'return {GROUND_GEN,GROUND_STUBS,THEIA_GROUND,theiaMap,theiaH,EOS_GROUND,eosMap,eosH,worleyEdge,eosStripe,EO,TETHYS_GROUND,tethysMap,tethysH,TT,PHOEBE_GROUND,phoebeMap,phoebeH,BODIES,TELLUS,SELENE,terrainH,surfaceAt,terrainSlope,seaAt,groundAlt,bodyTop,get THEIA_MAP(){return THEIA_MAP},get EOS_MAP(){return EOS_MAP},get TETHYS_MAP(){return TETHYS_MAP},get PHOEBE_MAP(){return PHOEBE_MAP}};')();
  const D = Math.PI / 180, body = (n, g) => { const S = G.GROUND_STUBS[n]; return { name: n, R: S.R, mu: S.g * S.R * S.R, ground: g }; };
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], fib = n => { const o = []; for (let i = 0; i < n; i++) { const z = 1 - (2 * i + 1) / n, a = i * 2.39996, q = Math.sqrt(1 - z * z); o.push([q * Math.cos(a), z, q * Math.sin(a)]); } return o; };
  const at = (c, R, m, az) => { const e = norm(cross(Math.abs(c[1]) < .9 ? [0, 1, 0] : [1, 0, 0], c)), n = cross(c, e), d = norm(add(mul(e, Math.cos(az)), mul(n, Math.sin(az)))), a = m / R; return norm(add(mul(c, Math.cos(a)), mul(d, Math.sin(a)))); };
  check('ground-6: none of Hyperion\'s moons is live (not in the body tree), and no map is baked before first use',
    ['Theia', 'Eos', 'Tethys', 'Phoebe'].every(n => !G.BODIES.some(b => b.name === n)) && !G.THEIA_MAP && !G.EOS_MAP && !G.TETHYS_MAP && !G.PHOEBE_MAP);
  // Theia: no craters at all; paterae are flat-floored pits with steep walls and fresh lava; tilted blocks stand 4+ km
  { const Rt = G.GROUND_STUBS.Theia.R, Bt = body('Theia', G.THEIA_GROUND), M = G.theiaMap(), h = u => G.theiaH(u);
    const pit = M.paterae.map(p => Math.max(...[0, 1, 2, 3, 4, 5].map(k => h(at(p.c, Rt, p.R * 1.25, k * 1.05)))) - h(p.c)), lava = M.paterae.filter(p => G.surfaceAt(Bt, p.c).name === 'fresh lava').length;
    const tall = Math.max(...M.mtns.map(t => h(t.c) - Math.min(...[0, 1, 2, 3, 4, 5].map(k => h(at(t.c, Rt, t.R * 1.4, k * 1.05))))));
    check('ground-6: Theia: no impact craters; paterae sink 400+ m below their rims (median) with fresh lava floors; its mountains rise 4+ km',
      M.craters.length === 0 && med(pit) > 400 && lava >= M.paterae.length * .8 && tall > 4000, `${M.paterae.length} paterae, median ${med(pit).toFixed(0)} m deep, ${lava} on fresh lava; tallest mountain ${tall.toFixed(0)} m`); }
  // Eos: flat (relief under 1 km); the ridges are double (crests 600 m either side of a lower centre line); chaos rougher;
  // the tiger stripes: rifts 400+ m deep near the south pole, frosted
  { const Re = G.GROUND_STUBS.Eos.R, Be = body('Eos', G.EOS_GROUND), h = u => G.eosH(u), P = fib(3000), H = P.map(h), L = G.EO.ridge[0][0];
    const bin = { edge: [], crest: [] }; let rs = 3; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 60000; i++) { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), q = Math.sqrt(1 - z * z), u = [q * Math.cos(t), z, q * Math.sin(t)], d = G.worleyEdge(u[0] * Re / L, u[1] * Re / L, u[2] * Re / L) * L;
      if (d < 100) bin.edge.push(h(u)); else if (Math.abs(d - G.EO.dr.w) < 100) bin.crest.push(h(u)); }
    const un = P.map(G.EOS_GROUND.unit), sl = k => P.filter((_, i) => un[i] === k).slice(0, 300).map(u => G.terrainSlope(Be, u) / D).sort((a, b) => a - b), p90 = a => a[Math.floor(a.length * .9)];
    const s0 = norm([G.EO.stripes.gap * .5 / Re, -1, 0]), sDepth = Math.min(h(at(s0, Re, 3e3, Math.PI / 2)), h(at(s0, Re, 3e3, -Math.PI / 2))) - h(s0);   // across the stripe (x); az 0 here runs along it
    check('ground-6: Eos: flat ice (relief under 1 km); double ridges (crests above their centre lines); chaos rougher than ridged ice; tiger stripes 400+ m deep, frosted',
      Math.max(...H) - Math.min(...H) < 1000 && med(bin.crest) > med(bin.edge) + 100 && p90(sl('chaos')) > p90(sl('ridged ice')) && sDepth > 400 && G.surfaceAt(Be, s0).name === 'fresh plume frost',
      `relief ${(Math.max(...H) - Math.min(...H)).toFixed(0)} m; crests ${(med(bin.crest) - med(bin.edge)).toFixed(0)} m above the centre line; p90 slope chaos ${p90(sl('chaos')).toFixed(1)}° vs ${p90(sl('ridged ice')).toFixed(1)}°; stripe ${sDepth.toFixed(0)} m deep`); }
  // Tethys: methane lakes (a liquid level: seaAt, the ground is the surface), mostly north; linear dunes run east–west
  { const Rh = G.GROUND_STUBS.Tethys.R, Bh = body('Tethys', G.TETHYS_GROUND), h = u => G.tethysH(u), P = fib(4000), un = P.map(G.TETHYS_GROUND.unit);
    const lakes = P.filter((_, i) => un[i] === 'lake'), north = lakes.filter(u => u[1] > 0).length, lk = lakes.find(u => u[1] > .8);
    const dn = P.filter((_, i) => un[i] === 'dunes'), rng2 = (u, az) => { const v = [-1000, -500, 0, 500, 1000].map(m => h(at(u, Rh, m, az))); return Math.max(...v) - Math.min(...v); };
    const ns = med(dn.slice(0, 60).map(u => rng2(u, Math.PI / 2))), ew = med(dn.slice(0, 60).map(u => rng2(u, 0)));   // az 0 is east, π/2 north
    check('ground-6: Tethys: methane lakes (2–8 %, mostly north) are a liquid you splash into; linear dunes in the equatorial belt run east–west',
      lakes.length / P.length > .02 && lakes.length / P.length < .08 && north > lakes.length * .6 && !!lk && G.seaAt(Bh, lk) && G.groundAlt(Bh, lk) === 0 && dn.every(u => Math.abs(u[1]) < .55) && ns > 2 * ew && ns > 50,
      `lakes ${(lakes.length / P.length * 100).toFixed(1)} % (${north} of ${lakes.length} north); dunes: ${ns.toFixed(0)} m relief over 2 km north–south vs ${ew.toFixed(0)} m east–west`); }
  // Phoebe: a lump (its outline not round), saturated with craters (30+ % of its ground over 10°)
  { const Rp = G.GROUND_STUBS.Phoebe.R, Bp = body('Phoebe', G.PHOEBE_GROUND), h = u => G.phoebeH(u), P = fib(2000), H = P.map(h), steep = P.slice(0, 600).filter(u => G.terrainSlope(Bp, u) > 10 * D).length / 600;
    check('ground-6: Phoebe: a lump (relief over 12 % of its radius) saturated with craters (30+ % of it over 10°), landing on regolith',
      (Math.max(...H) - Math.min(...H)) / Rp > .12 && steep > .3 && G.surfaceAt(Bp, P[0]).name === 'regolith', `relief ${((Math.max(...H) - Math.min(...H)) / Rp * 100).toFixed(0)} % of R; ${(steep * 100).toFixed(0)} % over 10°`); }
  // every body's poles: no step (the polar rows of the equirectangular maps); Tellus is live, so this one matters in play
  { const bodies = [['Tellus', G.TELLUS.R, u => G.terrainH(u)], ['Selene', G.SELENE.R, u => G.GROUND_GEN.selene(u)], ...['Enyo', 'Hesper', 'Astraea', 'Theia', 'Eos', 'Tethys', 'Phoebe', 'Erebus'].map(n => [n, G.GROUND_STUBS[n].R, u => G.GROUND_GEN[n.toLowerCase()](u)])];
    const worst = bodies.map(([n, R, f]) => { let w = 0; for (const sg of [1, -1]) for (let i = 0; i < 400; i++) { const a = i * 2.39996, r = (i % 40) / 40 * 2e3 / R, u = norm([Math.sin(r) * Math.cos(a), sg * Math.cos(r), Math.sin(r) * Math.sin(a)]), v = norm(add(u, mul(norm(cross(u, [1, 0, 0])), .5 / R))); w = Math.max(w, Math.abs(f(v) - f(u)) / .5); } return [n, Math.atan(w) / D]; });
    check('ground-6: no step at any body\'s poles, Tellus\'s included (steepest 0.5 m step within 2 km of a pole under 60°)', worst.every(([, d]) => d < 60), worst.map(([n, d]) => `${n} ${d.toFixed(0)}°`).join(' · ')); }
}

// econ-7. Dispatch to a base (economy session, QUEUE Q61): a supply run flies the design's ascent procedure, then a
// transfer, capture and landing at the base's beacon (landAt); the lander is registered there and joins the base.
// Repeats only: refused before the body's landing first and for a design with no ascent procedure.
{
  const P = api.PROG, saved = JSON.stringify(P), st = api.PRESETS.Probe, B = api.BODIES.find(b => b.name === 'Selene');
  api.HOOK.news = () => {}; api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  P.procs = {}; P.done = { beeper: { flight: 0, day: 0 } }; P.funds = 1e6; handAscent(api, st);
  const site = siteOf(api, B, 20, 15), base = { id: 777, landed: true, beacon: true, bodyName: 'Selene', pf: site.map(x => x * B.R), ql: [0, 0, 0, 1], name: 'Selene Base 1', shape: [], born: 0, imgs: 0, pending: [] };
  P.sats = [base]; P.satN = 777; P.dispatch = []; P.day = 10;
  P.done.selland = { flight: 0, day: 0 }; const handEra = api.baseRunQuote(base, st); while (api.compEra() < 2 && P.day < 40000) P.day += 100;   // D7: onboard computers
  delete P.done.selland; const early = api.baseRunQuote(base, st); P.done.selland = { flight: 0, day: 0 }; const none = api.baseRunQuote(base, ['sci', 't8', 'kestrel']), q = api.baseRunQuote(base, st);
  check('supply run: refused before onboard computers (the automation ladder, D7)', !handEra.ok && /onboard computers/.test(handEra.why), `${handEra.why}; onboard computers from day ${P.day}`);
  check('supply run: refused before the landing first and for a design with no ascent procedure; quoted otherwise', !early.ok && /by hand first/.test(early.why) && !none.ok && q.ok && q.cost > 0,
    `${early.why} · ${none.why} · ${q.ok ? `${q.cost.toFixed(0)}M, launch day ${q.launch.toFixed(0)}` : q.why}`);
  const line = api.baseRunLine(base, st), r = api.orderBaseRun(base, st), D = P.dispatch[0];
  for (let k = 0; k < 8 && D.status === 'queued'; k++) { P.day = D.launch; api.dispatchTick(); }
  const lander = api.landedUp().find(x => x.id !== 777), b = api.baseOf(base);
  check('supply run: the Probe lands at the beacon and joins the base', /data-baserun="777"/.test(line) && r.ok && D.status === 'done' && lander && b && b.members.length === 2,
    `${D.status}${D.why ? ': ' + D.why : ''}; ${lander ? `${lander.name}, ${(Math.acos(Math.min(1, api.dot(api.norm(lander.pf), site))) * B.R).toFixed(0)} m from the beacon` : 'nothing landed'}; base of ${b ? b.members.length : 0}`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// econ-8. Staged pay only for a mission open when the flight launched (economy session, QUEUE Q112 / PLAYTEST #28): a
// probe parked at Nyx used to collect the first two shares of every Nyx mission as each one unlocked.
{
  const D = new Function(src + 'return {stagedTick,MISSIONS,NYX,PROG,HOOK,recNew,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], flights: 5, staged: {},
    done: Object.fromEntries(['weather', 'beeper', 'farside', 'nyxfind'].map(k => [k, { flight: 1, day: 1 }])) }); D.chooseStart('agency');
  const R = D.recNew(); R.paid = []; R.open0 = D.MISSIONS.filter(M => !P.done[M.id] && (M.req || []).every(r => P.done[r])).map(M => M.id);
  const s = { alive: true, landed: false, body: D.NYX }, f0 = P.funds;
  D.stagedTick(s, R); const fly = P.staged.nyxfly || {}, f1 = P.funds;
  P.done.nyxfly = { flight: 6, day: 120 }; P.done.nyxorb = { flight: 6, day: 121 }; D.stagedTick(s, R);
  const land = P.staged.nyxland || {};
  check('staged pay: the flyby launched for pays its shares; Landing on Nyx, opened mid-flight, pays nothing to the same probe',
    fly.bound && fly.arrive && f1 > f0 && !land.bound && !land.arrive && P.funds === f1, `flyby +${(f1 - f0).toFixed(0)}M; after the orbit opened the landing: +${(P.funds - f1).toFixed(0)}M`);
  const R2 = D.recNew(); R2.paid = []; R2.open0 = ['nyxland']; D.stagedTick(s, R2);
  check('staged pay: a flight launched after it opened does collect', (P.staged.nyxland || {}).bound && P.funds > f1);
}

// vehicle-3. The first orbit missions fly on presets (vehicle session, QUEUE Q74 / PLAYTEST #24): the Beeper puts an
// instrument package in orbit; the Passenger Orbiter takes a biocapsule once round and home, inside the passenger's limits.
{
  const R = TELLUS.R, O = api.PRESETS.Orbiter, el = s => api.elements(s.r, s.v, TELLUS.mu);
  const b = handAscent(api, api.PRESETS.Beeper), eb = el(b);
  const p = handAscent(api, api.PRESETS['Passenger Orbiter']), ep = el(p), dvP = api.dvRemaining(p).cur, msgs = []; api.HOOK.msg = m => msgs.push(m);
  api.advRails(p, ep.period, 10);   // once round
  const retro = () => { const v = mul(norm(p.v), -1), f = api.localFrame(p.r), X = norm(cross(v, f.n)); p.q = api.qFromBasis(X, v, cross(X, v)); p.w = [0, 0, 0]; };
  p.throttle = 1; for (let k = 0; k < 20000 && p.alive; k++) { retro(); api.advPhys(p); if (el(p).pe - R < 40e3 || api.dvRemaining(p).cur < 1) break; }
  p.throttle = 0; p.sas = true; p.sasMode = 'retro'; const bio = p.parts.find(q => q.d.kind === 'bio'); let g1 = 0, gMax = 0, cab = 290, armed = false;
  for (let k = 0; k < 2e6 && p.alive && !p.landed; k++) { const h = len(p.r) - R; if (h > TELLUS.atm + 5e3) { api.advRails(p, 20, 10); continue; }
    api.advPhys(p); g1 += (p.gload - g1) * Math.min(1, api.DT); gMax = Math.max(gMax, g1); cab += (bio.T - cab) * api.DT / (bio.d.ins || 600);
    if (!armed && h < 20e3) { armed = true; while (p.evIdx < p.events.length) api.stage(p); } }
  check('presets: the Beeper puts its instrument package in a stable orbit; the Passenger Orbiter goes once round and lands its biocapsule under 8 g and 330 K',
    b.alive && eb.pe - R > TELLUS.atm && b.parts.some(q => q.on && q.d.kind === 'sci') && p.landed && bio.on && gMax < 8 && cab < 330 && O.length === 8,
    `Beeper: periapsis ${((eb.pe - R) / 1e3).toFixed(0)} km, ${api.dvRemaining(b).cur.toFixed(0)} m/s spare · Passenger Orbiter: ${dvP.toFixed(0)} m/s spare in orbit, ${gMax.toFixed(1)} g, cabin ~${cab.toFixed(0)} K, ${p.landed ? 'landed' : 'not landed'}`);
}

// ground-7. Erebus's ground (world session, GROUND.md G7), the last hand-made body: Pluto's character on the CPU, not
// live (stub body). The nitrogen-ice basin (flat, crater-free, broken into convection cells), the water-ice mountains on
// its margin, the dark tholin highlands (the most cratered), bladed terrain. `node study_ground.mjs erebus`.
{
  const G = new Function(src + 'return {EREBUS_GROUND,erebusMap,erebusH,worleyEdge,ER,GROUND_STUBS,llU,BODIES,surfaceAt,terrainSlope,bodyTop,get EREBUS_MAP(){return EREBUS_MAP}};')();
  const S = G.GROUND_STUBS.Erebus, R = S.R, B = { name: S.name, R, mu: S.g * R * R, ground: G.EREBUS_GROUND }, D = Math.PI / 180, h = u => G.erebusH(u);
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], at = (c, m, az) => { const e = norm(cross([0, 1, 0], c)), n = cross(c, e), d = norm(add(mul(e, Math.cos(az)), mul(n, Math.sin(az)))), a = m / R; return norm(add(mul(c, Math.cos(a)), mul(d, Math.sin(a)))); };
  check('ground-7: Erebus\'s recipe is not live (no Erebus in the body tree), and its map is baked on first use', G.EREBUS_MAP === null && !G.BODIES.some(b => b.name === 'Erebus'));
  const M = G.erebusMap(), P = []; for (let i = 0; i < 4000; i++) { const z = 1 - (2 * i + 1) / 4000, a = i * 2.39996, q = Math.sqrt(1 - z * z); P.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = P.map(h), un = P.map(G.EREBUS_GROUND.unit), of = k => P.filter((_, i) => un[i] === k), sl = k => of(k).slice(0, 300).map(u => G.terrainSlope(B, u) / D).sort((a, b) => a - b);
  const bc = G.llU(...G.ER.basin.at), rim = med([0, 1, 2, 3, 4, 5].map(k => h(at(bc, G.ER.basin.r * R * 1.3, k * 1.05)))), ni = sl('nitrogen ice');
  check('ground-7: the nitrogen-ice basin: 2+ km below the land round it, its floor flat (median under 1°, p99 under 10°), relief within top',
    rim - h(bc) > 2000 && med(ni) < 1 && ni[Math.floor(ni.length * .99)] < 10 && Math.max(...H) < G.bodyTop(B) && G.surfaceAt(B, bc).name === 'nitrogen ice',
    `basin ${(rim - h(bc)).toFixed(0)} m below the land round it; floor slope median ${med(ni).toFixed(1)}°, p99 ${ni[Math.floor(ni.length * .99)].toFixed(1)}°; max ${Math.max(...H).toFixed(0)} m (top ${G.bodyTop(B)})`);
  // convection cells: on the floor, the troughs along the cell edges lie lower than the cells' middles
  const L = G.ER.cells.L, edge = [], mid = []; for (let i = 0; i < 4000; i++) { const u = at(bc, (i % 63) / 63 * .8 * G.ER.basin.r * R, i * 2.39996), d = G.worleyEdge(u[0] * R / L + 3, u[1] * R / L + 3, u[2] * R / L + 3) * L; if (d < 300) edge.push(h(u)); else if (d > 5e3) mid.push(h(u)); }
  check('ground-7: the basin floor is broken into convection cells: troughs along their edges 50+ m below their middles', med(mid) - med(edge) > 50, `${(med(mid) - med(edge)).toFixed(0)} m (${edge.length} trough points, ${mid.length} mid-cell)`);
  const tall = Math.max(...M.mtns.map(t => h(t.c) - Math.min(...[0, 1, 2, 3, 4, 5].map(k => h(at(t.c, t.R * 1.4, k * 1.05)))))), mtS = sl('mountains');
  check('ground-7: water-ice mountains on the basin\'s margin: 2.5+ km above their foot, steep (p90 over 30°), on bedrock',
    tall > 2500 && mtS[Math.floor(mtS.length * .9)] > 30 && G.surfaceAt(B, M.mtns[0].c).name === 'water-ice bedrock', `tallest ${tall.toFixed(0)} m; p90 flank ${mtS[Math.floor(mtS.length * .9)].toFixed(0)}°`);
  // the tholin highlands keep all their craters (old crust); the uplands lose half, the basin all
  const th = of('tholin highlands'), up = of('uplands'), p90 = a => a[Math.floor(a.length * .9)];
  check('ground-7: the dark tholin highlands are the most cratered (no thinning there, half on the uplands, all on the ice) and rougher than the uplands',
    th.length > 50 && med(th.map(M.thin)) < .05 && Math.abs(med(up.map(M.thin)) - .5) < .05 && M.thin(bc) > .95 && p90(sl('tholin highlands')) > p90(sl('uplands')) && G.surfaceAt(B, th[0]).name === 'dark tholin dust',
    `thinning: tholin ${med(th.map(M.thin)).toFixed(2)}, uplands ${med(up.map(M.thin)).toFixed(2)}, ice ${M.thin(bc).toFixed(2)}; p90 slope ${p90(sl('tholin highlands')).toFixed(1)}° vs ${p90(sl('uplands')).toFixed(1)}°`);
  let rs = 13, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(h(v) - h(n)) / 0.5); }
  check('ground-7: continuous across the crater cells\' cube-face seams (under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
}

// ground-8. The seeded small bodies (world session, GROUND.md G7): a recipe factory, smallBodyGround({kind, R, seed}), for
// the classes SYSTEM.md seeds per world. None exists in the game yet, so the checks drive recipes directly, and through a
// stand-in body to show they work as any body's `ground`. `node study_ground.mjs small:<kind>:<R>:<seed>`.
{
  const G = new Function(src + 'return {smallBodyGround,smallH,smallShape,smallMap,smallBoulders,smallPit,SB_KINDS,SB_CLASSES,SB_G,groundAlt,surfaceAt,bodyTop};')();
  const D = Math.PI / 180, P = []; for (let i = 0; i < 1500; i++) { const z = 1 - (2 * i + 1) / 1500, a = i * 2.39996, q = Math.sqrt(1 - z * z); P.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const mk = (kind, R, seed) => G.smallBodyGround({ kind, R, seed }), body = rc => ({ name: 'rock', R: rc.R, mu: rc.g * rc.R * rc.R, ground: rc });
  // the same seed makes the same rock; another seed another; gravity from density
  const a1 = mk('stony', 5000, 11), a2 = mk('stony', 5000, 11), a3 = mk('stony', 5000, 12);
  check('ground-8: a seed makes the same rock every time and another seed another; gravity is G·(4/3)πρR; every class draws from known kinds',
    P.slice(0, 200).every(u => G.smallH(u, a1) === G.smallH(u, a2)) && a1.ax.join() !== a3.ax.join() && Math.abs(a1.g - G.SB_G * 4 / 3 * Math.PI * 2000 * 5000) < 1e-12 && Object.values(G.SB_CLASSES).flat().every(k => G.SB_KINDS[k]),
    `axes ${a1.ax.map(x => (x / 1e3).toFixed(2)).join('×')} km vs ${a3.ax.map(x => (x / 1e3).toFixed(2)).join('×')} km; g ${a1.g.toExponential(2)} m/s²`);
  // every kind, a few sizes and seeds: finite, within its own bound, and usable as a body's ground (groundAlt, surfaceAt)
  let bad = [], n = 0; for (const kind of Object.keys(G.SB_KINDS)) for (const [R, seed] of [[200, 1], [2000, 2], [20000, 3]]) { const rc = mk(kind, R, seed), B = body(rc);
    for (const u of P.slice(0, 400)) { const h = G.smallH(u, rc); n++; if (!Number.isFinite(h)) bad.push(`${kind} ${R} m: not finite`); else if (h > G.bodyTop(B)) bad.push(`${kind} ${R} m: over top`); else if (Math.abs(G.groundAlt(B, mul(u, R)) - h) > 1e-6 * R) bad.push(`${kind} ${R} m: groundAlt differs`); }
    if (G.surfaceAt(B, [R, 0, 0]).name !== G.SB_KINDS[kind].surf.name) bad.push(`${kind} surface`); }
  check('ground-8: every kind at 0.2, 2 and 20 km: heights finite and under the recipe\'s top, the same through groundAlt, its own surface', !bad.length, bad.length ? [...new Set(bad)].join(', ') : `${n} heights`);
  // shapes: a visitor is a needle (4:1 or more); some comets are contact binaries with a waist; rubble piles have a ridge
  const vis = mk('visitor', 200, 7), vr = P.map(u => G.smallShape(u, vis)), bi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => mk('comet', 2000, s)).find(c => c.lobes);
  const waist = bi && G.smallShape([0, 1, 0], bi) < .85 * Math.max(G.smallShape([1, 0, 0], bi), G.smallShape([-1, 0, 0], bi));
  const rb = mk('rubble', 500, 4), noShape = u => G.smallH(u, rb) - (G.smallShape(u, rb) - 500), eq = P.filter(u => Math.abs(u[1]) < .05).map(noShape), mid = P.filter(u => Math.abs(Math.abs(u[1]) - .5) < .1).map(noShape), avg = a => a.reduce((s, x) => s + x, 0) / a.length;   // noShape: the ridge itself, not the flattened shape
  check('ground-8: shapes: a visitor is a needle (4:1+), some comets are contact binaries with a waist, rubble piles a spinning-top ridge',
    Math.max(...vr) / Math.min(...vr) > 4 && !!bi && waist && avg(eq) - avg(mid) > .02 * 500,
    `visitor ${(Math.max(...vr) / Math.min(...vr)).toFixed(1)}:1; comet seed ${bi ? bi.seed : '—'} bilobe, waist ${waist}; ridge +${(avg(eq) - avg(mid)).toFixed(0)} m on a 500 m rubble pile`);
  // surface features: rubble piles are covered in boulders; comets have pits; a visitor has neither, nor craters
  const bShare = P.filter(u => G.smallBoulders(u, 500, rb) > .5).length / P.length, cm = mk('comet', 2000, 6), pits = P.filter(u => G.smallPit(u, 2000, cm) < -.1 * cm.pL).length;
  check('ground-8: rubble piles are strewn with boulders (5+ % of the ground under one); comets have steep pits; a visitor has no craters, boulders or pits',
    bShare > .05 && pits > 3 && G.smallMap(vis).craters.length === 0 && !G.SB_KINDS.visitor.boulders && !G.SB_KINDS.visitor.pits, `boulders on ${(bShare * 100).toFixed(1)} % of the rubble pile; ${pits} comet points in pits`);
  // boulders and pits are steep by design but continuous: every feature that touches a point is among its 27 neighbouring
  // cells, so searching 125 finds nothing more (a feature the 27 missed would appear from one point and not the next)
  let missB = 0, missP = 0, r3 = 7; const rn3 = () => (r3 = (r3 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 20000; i++) { const z = 2 * rn3() - 1, t = 2 * Math.PI * rn3(), q = Math.sqrt(1 - z * z), u = [q * Math.cos(t), z, q * Math.sin(t)];
    if (G.smallBoulders(u, 500, rb) !== G.smallBoulders(u, 500, rb, 2)) missB++; if (G.smallPit(u, 2000, cm) !== G.smallPit(u, 2000, cm, 2)) missP++; }
  check('ground-8: boulders and pits are continuous: at 20,000 points the 27 neighbouring cells find every feature 125 do', !missB && !missP, `missed: boulders ${missB}, pits ${missP}`);
  // the crater bands across the cube-face seams (boulders and pits are steep by design, so they're left out here)
  const st = mk('stony', 20000, 5), cr = u => G.smallH(u, st) - G.smallBoulders(u, 20000, st); let rs = 17, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1500; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const nn = norm(u);
    const e = norm(cross(nn, Math.abs(nn[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(nn, mul(e, 0.5 / 20000))); worst = Math.max(worst, Math.abs(cr(v) - cr(nn)) / 0.5); }
  check('ground-8: a 20 km stony body\'s craters are continuous across the cube-face seams (under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
}

// space-3. Debris, slice 1 (space session, QUEUE Q26; NOTES § "Plan: debris and Kessler"): big pieces are objects. A
// spent stage of 100 kg or more left in a closed orbit clear of the air joins the registry at flight end as Debris:
// on its rails, targetable, never flyable; low ones decay and re-enter quietly; suborbital or small pieces don't count.
{
  const D = new Function(src + 'return {newShip,PRESETS,detach,junkRegister,JUNK,satKind,satAt,elements,orbitsAt,flyable,advanceDays,partMass,TELLUS,PROG,HOOK,DAY_S,len,sub};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R; P.sats = []; P.day = 0;
  // an Orbiter in a circular orbit at alt (speed × f of circular), flying a program flight; it drops its first stage
  const fly = (alt, f = 1) => { const s = D.newShip(D.PRESETS.Orbiter), a = R + alt, vc = Math.sqrt(T.mu / a) * f;
    Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -vc], rec: { launched: true, day0: P.day } }); return s; };
  const drop = s => { const ev = s.events.find(e => e.decouple.length), list = s.parts.filter(p => p.on && ev.decouple.includes(p.seg)); D.detach(s, list, [0, -1, 0], 0); return list; };
  const hi = fly(400e3), dl = drop(hi), dm = dl.reduce((a, p) => a + D.partMass(p), 0) * 1000, n1 = D.junkRegister(hi.rec), q = P.sats.at(-1);
  const at = q && D.satAt(q, q.epoch)[0], j0 = q && D.elements(q.r, q.v, T.mu);
  check('debris: a spent stage left in orbit joins the registry as Debris, on its rails, targetable, not flyable',
    n1 === 1 && q.junk && D.satKind(q) === 'Debris' && /\(debris\)$/.test(q.name) && Math.abs(q.mass - dm) < 1 && D.len(D.sub(at, q.r)) < 1e-6 && j0.pe - R > 390e3 &&
    D.orbitsAt(T).includes(q) && !D.flyable(q) && news.some(m => /stays in orbit as debris/.test(m)) && D.JUNK.length === 0,
    `${q ? q.name : '—'}: ${(dm / 1000).toFixed(2)} t at ${q ? ((j0.pe - R) / 1e3).toFixed(0) : '—'}–${q ? ((j0.ap - R) / 1e3).toFixed(0) : '—'} km`);
  // low: registered, then gone within a day, quietly; suborbital and small pieces, or another flight's, never count
  news.length = 0; const lo = fly(105e3); drop(lo); const n2 = D.junkRegister(lo.rec), ql = P.sats.at(-1);
  const sub = fly(300e3, 0.8); drop(sub); const n3 = D.junkRegister(sub.rec);
  const sm = fly(400e3), tiny = sm.parts.filter(p => p.on && D.partMass(p) < 0.1 && p.seg === sm.events.find(e => e.decouple.length).decouple[0]).slice(0, 1);
  if (tiny.length) D.detach(sm, tiny, [0, -1, 0], 0); const n4 = D.junkRegister(sm.rec);
  const other = fly(400e3); drop(other); const n5 = D.junkRegister({ launched: true, day0: 0 });
  const nBefore = P.sats.length; D.advanceDays(1);
  check('debris: a low piece re-enters within a day without news; suborbital, small (<100 kg) and other flights’ pieces never join',
    n2 === 1 && ql.junk && !P.sats.includes(ql) && P.sats.length === nBefore - 1 && !news.some(m => /re-entered|sinking/.test(m)) && n3 === 0 && n4 === 0 && tiny.length === 1 && n5 === 0,
    `low ${n2}, suborbital ${n3}, small ${n4} (${tiny.length ? (D.partMass(tiny[0]) * 1000).toFixed(0) + ' kg' : 'none found'}), another flight's ${n5}`);
  // the high one, a month on: still there, decaying by metres
  D.advanceDays(30); const j1 = D.elements(q.r, q.v, T.mu);
  check('debris: a piece at 400 km stays, on its rails plus a trace of decay', P.sats.includes(q) && j0.pe - j1.pe >= 0 && j0.pe - j1.pe < 500, `periapsis down ${(j0.pe - j1.pe).toFixed(1)} m in 31 days`);
}

// flow-3. A landing site picked on the map (flow session, QUEUE Q62): the click's ray meets a moon's near side and gives a
// site in that body's frame (pf, what bodies' landAt flies to); a ray at Tellus picks nothing; the site goes into a
// landing procedure for that body (its transfer and its descent) and leaves any other procedure alone.
{
  const B = api.SELENE, t0 = 1234, c = api.bodyPos(B, t0), o = add(c, [0, 0, 5 * B.R]), d = norm(sub(add(c, [B.R * 0.3, B.R * 0.2, 0]), o));
  const hit = api.surfacePick(o, d, t0), back = hit && add(c, api.fromPF(B, hit.pf, t0));
  const miss = api.surfacePick([0, 0, 5 * TELLUS.R], [0, 0, -1], t0);
  const land = { kind: 'mission', sig: 'Selene:land', phases: [{ k: 'transfer', to: 'Selene', pass: 40e3 }, { k: 'capture', ap: 40e3, pe: 10e3 }, { k: 'land' }, { k: 'surface', t: 600 }, { k: 'return', perigee: 45e3 }] };
  const fly = { kind: 'mission', sig: 'Selene:flyby', phases: [{ k: 'transfer', to: 'Selene', pass: 40e3 }] };
  const L = hit && api.procWithSite(land, 'Selene', hit.pf), F = hit && api.procWithSite(fly, 'Selene', hit.pf);
  check('flow-3: a map click on Selene gives a site on its near side; one at Tellus gives none; the site goes into a landing procedure (transfer and descent) only',
    hit && hit.body === 'Selene' && Math.abs(len(api.fromPF(B, hit.pf, t0)) - B.R) < 1 && dot(sub(back, c), sub(o, c)) > 0 && miss === null
      && L !== land && L.phases[0].site === hit.pf && L.phases[2].site === hit.pf && !L.phases[1].site && !land.phases[2].site && F === fly && api.procLandsOn(land, 'Nyx') === false,
    hit ? `${hit.body} ${api.sitePlace(hit.pf)} (${(len(api.fromPF(B, hit.pf, t0)) / 1e3).toFixed(1)} km from the centre)` : 'no hit');
}

// vehicle-4. Warnings before launch (vehicle session, QUEUE Q48): the Rollout screen says when a design is short of the
// Δv its aim needs (the logbook's best flight to orbit, or ~4,500 m/s before anyone has been there, plus the climb to a
// contract's altitude), and when a crew or a passenger rides with no parachute.
{
  const P = api.PRESETS, PR = api.PROG, B = [{ name: 'The beeper', alt: 0 }], H = [{ name: 'Satellite to 400 km', alt: 400 }], lv = (st, a) => api.launchWarnings(st, a).map(x => x[0]).join();
  const log0 = PR.log; PR.log = {}; const est = [lv(P.Beeper, B), lv(P.Orbiter, H), lv(P.Hopper, B), lv(P['Passenger Orbiter'], B)];
  PR.log = { orbit: { v: 5600 } }; const best = api.launchWarnings(P.Orbiter, B); PR.log = log0;
  const chute = [api.launchWarnings(['bio', 'rwheel', 't2', 'petrel'], []), api.launchWarnings(['les', 'crew', 't2', 'petrel'], []), api.launchWarnings(P['Passenger Orbiter'], []), api.launchWarnings(P.Beeper, [])];
  const climb = api.dvToAlt(TELLUS, 400), r0 = TELLUS.R + TELLUS.atm + 1e4, r1 = TELLUS.R + 4e5, hand = Math.sqrt(TELLUS.mu / r0) * (Math.sqrt(2 * r1 / (r0 + r1)) - 1) + Math.sqrt(TELLUS.mu / r1) * (1 - Math.sqrt(2 * r0 / (r0 + r1)));
  check('launch warnings: the Beeper is fine for the beeper, the Orbiter tight for 400 km, the Hopper short; the logbook\'s best sets the need; no chute under a crew or a passenger is flagged',
    est.join('|') === 'ok|warn|warn|ok' && /Short of orbit/.test(api.launchWarnings(P.Hopper, B)[0][1]) && /Tight/.test(api.launchWarnings(P.Orbiter, H)[0][1])
      && best[0][0] === 'warn' && /5,600 m\/s/.test(best[0][1]) && Math.abs(climb - hand) < 1e-6 && climb > 250 && climb < 350
      && /passenger can't come home/.test(chute[0].map(x => x[1]).join()) && /crew can't come home/.test(chute[1].map(x => x[1]).join()) && !chute[2].length && !chute[3].length && api.flightAims().length === 0,
    `${est.join(' / ')}; climb to 400 km ${climb.toFixed(0)} m/s; "${best[0][1]}"`);
}

// vehicle-5. Legs by themselves (vehicle session, QUEUE Q121): a procedure puts the legs down once it's descending within
// 1.5 km of the ground; legs and wings left deployed stay deployed when a vessel is registered and loaded back.
{
  const find = (n, k) => n.k === k ? n : (n.c || []).map(x => find(x, k)).find(Boolean);
  const lander = () => { const d = api.toV2(['pod', 't1', 'wren']); find(d.root, 't1').c.push({ k: 'leg', at: { y: 0.3, a: Math.PI / 4, n: 4, cy: 0.5 }, c: [] }); return d; };
  const R = TELLUS.R, u = [1, 0, 0], g = api.groundAlt(TELLUS, u), at = (h, vz) => { api.t = 0; const s = api.newShip(lander()); api.S = s; api.HOOK.msg = () => {}; s.landed = false;
    s.r = mul(u, R + g + h); s.v = add(api.surfVel(TELLUS, s.r), mul(u, vz)); s.proc = { done: false }; api.autoLegs(s); return api.legsDown(s); };
  const high = at(3000, -20), low = at(1200, -20), rising = at(1200, 20), hand = (() => { api.t = 0; const s = api.newShip(lander()); s.landed = false; s.r = mul(u, R + g + 800); s.v = add(api.surfVel(TELLUS, s.r), mul(u, -20)); api.autoLegs(s); return api.legsDown(s); })();
  const D = new Function(src + 'return {PROG,satRegister,vesselOf,newShip,legOp,legsDown,wingOp,wingsOut,toV2,TELLUS,HOOK,get t(){return simT},set t(v){simT=v}};')();
  D.HOOK.msg = () => {}; const d = D.toV2(['core', 'batt', 't1', 'wren']), fd = (n, k) => n.k === k ? n : (n.c || []).map(x => fd(x, k)).find(Boolean);
  fd(d.root, 't1').c.push({ k: 'leg', at: { y: 0.3, a: 0, n: 3, cy: 0.5 }, c: [] }, { k: 'wpanel', at: { y: 0.8, a: 0.5, n: 2, cy: 0.3 }, c: [] });
  const sat = D.newShip(d), rs = D.TELLUS.R + 3e5; D.legOp(sat, 'down'); D.wingOp(sat, 'out');
  Object.assign(sat, { landed: false, alive: true, r: [rs, 0, 0], v: [0, 0, -Math.sqrt(D.TELLUS.mu / rs)], w: [0, 0, 0] }); D.PROG.sats = []; D.satRegister(sat, { day0: 0 });
  const back = D.PROG.sats.length ? D.vesselOf(D.PROG.sats[0], 0) : null;
  check('legs: a procedure puts them down descending within 1.5 km (not at 3 km, not climbing, not when you fly); legs and wings left out stay out through the register',
    !high && low && !rising && !hand && back && D.legsDown(back) && D.wingsOut(back), `3 km ${high} · 1.2 km down ${low} · climbing ${rising} · by hand ${hand} · reloaded: legs ${back && D.legsDown(back)}, wings ${back && D.wingsOut(back)}`);
}

// ground-9. G3.0 (world session, QUEUE Q107; GROUND.md § G3): the crater cells' trigonometry goes through approximations
// the shader will copy exactly (GLSL's tan/atan are only good to ~1e-5 rad: 3.5 m on Selene). The bands must not call the
// built-ins again, and the approximations must stay as good as measured.
{
  const G = new Function(src + 'return {ptan,patanJ,craterBands,grBands};')();
  let et = 0, ea = 0; for (let i = 0; i <= 20000; i++) { const x = (i / 20000 * 2 - 1) * Math.PI / 4, y = Math.tan(x) * 1.3; et = Math.max(et, Math.abs(G.ptan(x) - Math.tan(x))); ea = Math.max(ea, Math.abs(G.patanJ(y, 1) - Math.atan(y))); }
  const srcB = G.craterBands.toString(), lam = G.grBands(3.48e5)[2].lam;
  check('ground-9: crater cells use ptan (≤1e-12) and patanJ (≤5e-8 rad), not Math.tan/atan; λ is a float32',
    et < 1e-12 && ea < 5e-8 && !/Math\.(tan|atan)\(/.test(srcB) && lam === Math.fround(lam), `ptan ${et.toExponential(1)}, patanJ ${ea.toExponential(1)} rad`);
}

// econ-9. Pay floors and withdrawing (economy session, QUEUE Q93 / Q118): every offer pays at least 1.3× the net cost of
// the cheapest preset that can fly it, whatever the world; a taken contract can be withdrawn at a missed deadline's cost.
{
  const D = new Function(src + 'return {genOffer,payFloor,withdrawContract,standOf,opOf,CT,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'frugal', day: 50, rel: {}, op: {}, sanc: {}, stand: { sci: 10, com: 10 }, cycle: -0.9, done: { weather: { day: 1 }, loads: { day: 1 }, hop: { day: 1 }, beeper: { day: 1 } },
    own: null, decisions: [], offers: [], active: [], flights: 3 }); D.chooseStart('company');
  const R = D.rng(11); let n = 0, low = []; for (let k = 0; k < 400; k++) for (const src of ['sci', 'com', 'gov', 'tour', 'mil']) { const o = D.genOffer(src, R); if (!o) continue; n++; const f = D.payFloor(o.type); if (o.p.pay < f - 1e-9) low.push(`${o.type} ${o.p.pay} < ${f}`); }
  check('pay floor: in a frugal world, low standing and a deep recession, no offer pays under its floor', n > 500 && !low.length && D.payFloor('apex') > 10 && D.payFloor('sat') > D.payFloor('apex'),
    `${n} offers; floors: sounding ${D.payFloor('apex')}M, test ${D.payFloor('test')}M, hop ${D.payFloor('bioHop')}M, satellite ${D.payFloor('sat')}M${low.length ? '; under: ' + low.slice(0, 3).join(', ') : ''}`);
  const c = { id: 501, type: 'apex', src: 'sci', client: 1, p: { lo: 20, hi: 30, pay: 15, dur: 100 }, deadline: P.day + 100 }; P.active = [c];
  const s0 = D.standOf('sci'), o0 = D.opOf(1), ok = D.withdrawContract(501), again = D.withdrawContract(501);
  check('withdraw: frees the slot at once, at a missed deadline\'s cost in standing and the client\'s opinion', ok && !again && P.active.length === 0 && D.standOf('sci') === Math.max(0, s0 - 10) && D.opOf(1) < o0,
    `standing ${s0} → ${D.standOf('sci')}, opinion ${o0.toFixed(1)} → ${D.opOf(1).toFixed(1)}`);
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('withdraw: taken contracts show the button', pg.includes('data-wd="${c.id}"') && pg.includes('withdrawContract(+ds.wd)'));
}

// econ-10. Dispatched flights launch from their procedure's site and pay its lease (economy session, QUEUE Q95).
{
  const D = new Function(src + 'return {dispatchQuote,dispatchSite,baseRunQuote,siteAccess,procKey,SITES,PROG,HOOK,pairKey,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, kh: {}, lines: {}, own: null, decisions: [], active: [], offers: [], fac: {}, dispatch: [],
    done: { beeper: { flight: 0, day: 0 } }, flights: 3, funds: 2000 }); D.chooseStart('agency');
  const st = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], key = D.procKey(st), abroad = D.SITES.find(t => t.power != null && t.power !== 0 && t.kind !== 'sea');
  const c = { id: 941, type: 'sat', src: 'com', client: 0, p: { alt: 160, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 };
  P.procs = { [key]: { kind: 'orbit', dv: 4300, target: { pe: 160e3, ap: 160e3 }, site: null } }; const qHome = D.dispatchQuote(c, st);
  P.procs[key].site = abroad.id; P.rel[D.pairKey(0, abroad.power)] = 0; const qAbroad = D.dispatchQuote(c, st), fee = D.siteAccess(abroad).fee;
  P.rel[D.pairKey(0, abroad.power)] = -0.8; const qBad = D.dispatchQuote(c, st);
  check('dispatch abroad: launches from the procedure\'s site, its lease on the price; refused when the site is closed to us',
    qHome.ok && qHome.fee === 0 && qAbroad.ok && qAbroad.site === abroad.id && Math.abs(qAbroad.cost - qHome.cost - fee) < 1e-9 && fee > 0 && !qBad.ok && /relations/.test(qBad.why),
    `home ${qHome.cost.toFixed(1)}M · ${abroad.name} ${qAbroad.cost.toFixed(1)}M (lease ${fee}M) · hostile: ${qBad.why}`);
}

// aerofx-3. A different galaxy each playthrough (look & sound effects beat, QUEUE Q21): the sky's galaxy comes from the
// program's own seed PROG.gseed, drawn once and kept (saved with PROG); a different seed gives a different sky; a program
// reset clears it; the reference views pin it to WSEED so they stay the same pictures.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const SIMF = new Function(src + 'return {rng,norm,add,sub,mul,dot,WSEED}')(), P = {};
  const G = new Function('rng', 'norm', 'add', 'sub', 'mul', 'dot', 'WSEED', 'PROG', body('makeGal') + ';let GAL=makeGal(WSEED);' + body('galaxy') + ';return {makeGal,galaxy}')(
    SIMF.rng, SIMF.norm, SIMF.add, SIMF.sub, SIMF.mul, SIMF.dot, SIMF.WSEED, P);
  const a = G.galaxy(), s1 = P.gseed, b = G.galaxy(), w = G.makeGal(SIMF.WSEED), o = G.makeGal(s1 + 1);
  P.gseed = null; const c = G.galaxy(), s2 = P.gseed;
  const vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8'), ed = readFileSync(new URL('./app/editor.js', import.meta.url), 'utf8');
  check('galaxy per program: drawn once and kept, different seeds differ, a reset draws a new one; views pin WSEED',
    s1 > 0 && a === b && a.seed === s1 && Math.abs(dot(w.gx, o.gx)) < 0.9999 && s2 > 0 && s2 !== s1 && c.seed === s2
      && vj.includes('PROG.gseed = WSEED') && ed.includes('Object.assign(PROG,{gseed:null,') && /galaxy\(\);gl\.uniform3fv\(u\.uGx/.test(pg),
    `seeds ${s1} → reset ${s2}; WSEED vs other gx·gx ${dot(w.gx, o.gx).toFixed(3)}`);
  // QUEUE Q116 (PLAYTEST #32): near an airless body the lighting's fill comes from its sunlit ground, about its own up:
  // on Selene's day side the ground term is lit; on its night side it is dark; far out in space there is none
  {
    const SM = new Function(src + 'return {BODIES,TELLUS,SELENE,bodyPos,norm,sub,add,mul,len,dot,cross,SUN_DIR,get t(){return simT}}')();
    const F = new Function('BODIES', 'TELLUS', 'bodyPos', 'norm', 'sub', 'len', 'dot', 'SUN', 'simT', 'FILL_FX', body('airlessFill') + ';return airlessFill')(
      SM.BODIES, SM.TELLUS, SM.bodyPos, SM.norm, SM.sub, SM.len, SM.dot, SM.SUN_DIR, SM.t, true);
    const C = SM.bodyPos(SM.SELENE, SM.t), at = (u, h) => SM.add(C, SM.mul(SM.norm(u), SM.SELENE.R + h));
    const w = SM.norm(SM.cross(SM.SUN_DIR, [0, 0, 1])), day = F(at(SM.add(SM.mul(SM.SUN_DIR, Math.sin(0.35)), SM.mul(w, Math.cos(0.35))), 2)),
      night = F(at(SM.mul(SM.SUN_DIR, -1), 2)), far = F(SM.mul(SM.SUN_DIR, 2e8)), high = F(at(SM.SUN_DIR, SM.SELENE.R));
    check('airless fill: a lander on Selene\'s day side gets light from the ground (its own up); none at night, less higher up, none in deep space',
      day && day.gnd[0] > 0.1 && day.gnd[0] < 0.4 && Math.abs(SM.dot(day.up, SM.norm(SM.sub(at(w, 0), C))) - Math.cos(0.35)) < 0.01 && night && night.gnd[0] === 0
        && far === null && high && high.gnd[0] < day.gnd[0] && /function lightEnv\(p\)\{const af=airlessFill\(p\);if\(af\)return af;/.test(pg),
      `day ground ${day && day.gnd[0].toFixed(3)}, night ${night && night.gnd[0]}, 1 R up ${high && high.gnd[0].toFixed(3)}`);
  }
  // QUEUE Q65: the ground under the cloud volume takes the volume's own shadow (cloudShadowV, blended by uVk and the bake's
  // edge), with its A/B uniforms uploaded; the deck's variety is behind its own toggle
  check('cloud volume shadows: the ground shading uses cloudShadowV, which marches cloudDens toward the sun; toggles wired',
    pg.includes('col=alb*(ndb*st*5.*cloudShadowV(p)+') && /float cloudShadowV\(vec3 p\)\{float sh=cloudShadow\(p\);/.test(pg) && /od\+=cloudDens\(p\+uSun\*/.test(pg)
      && pg.includes('gl.uniform1f(u.uVs,CLOUD_SHADOW_V?1:0);') && pg.includes('gl.uniform1f(u.uVv,CLOUD_VARY?1:0);') && /uniform float uCvX,uVk,uVD,uVs,uVv;/.test(pg));
  // QUEUE Q66: per-engine voices. Smaller nozzles sing higher; voices go by kind of engine (two Kestrels are one voice), the
  // biggest thrust shares first, at most four; nothing when nothing burns; equal shares sum to the airborne level in power
  {
    const blk = H.slice(H.indexOf('// ==== SOUND MIX BEGIN'), H.indexOf('// ==== SOUND MIX END'));
    const { sndVoices } = new Function(blk + ';return {sndVoices}')();
    const wren = sndVoices([{ key: 'wren', T: 18e3, exit: 0.25 }], 1), alb = sndVoices([{ key: 'albatross', T: 1.1e6, exit: 1.1 }], 1);
    const mix = sndVoices([{ key: 'kestrel', T: 230e3, exit: 0.55 }, { key: 'kestrel', T: 230e3, exit: 0.55 }, { key: 'condor', T: 460e3, exit: 0.62 }], 0.8);
    const many = sndVoices(['a', 'b', 'c', 'd', 'e'].map((k, i) => ({ key: k, T: 1e5 * (i + 1), exit: 0.3 + 0.1 * i })), 1);
    check('engine voices: a small nozzle sings higher than a big one; one voice per kind; ≤ 4, biggest first; silent when off (and the volume slider, Q35, is wired)',
      wren[0].f > 900 && alb[0].f < 260 && mix.length === 2 && Math.abs(mix[0].g ** 2 + mix[1].g ** 2 - 0.64) < 1e-9 && many.length === 4 && many[0].f < many[3].f
        && /ice\*=1\.-\.85\*bare\*uIv;sn\*=1\.-\.85\*bare\*uIv;/.test(H) && /gl\.uniform1f\(u\.uIv,ICE_VARY\?1:0\)/.test(H)
        && /function sndSettings\(el\)/.test(H) && /if\(typeof sndSettings==='function'\)sndSettings\(\$\('setSound'\)\)/.test(H) && /localStorage\.getItem\('launchpad-volume'\)/.test(H)
        && sndVoices([], 1).length === 0 && sndVoices([{ key: 'x', T: 0, exit: 0.5 }], 1).length === 0 && /AUD\.V=\[0,1,2,3\]\.map/.test(H) && /sndVoices\(st\.engs,m\.air\)/.test(H),
      `Wren ${wren[0].f.toFixed(0)} Hz, Albatross ${alb[0].f.toFixed(0)} Hz, Kestrel×2 + Condor: ${mix.map(v => v.f.toFixed(0) + ' Hz ' + v.g.toFixed(2)).join(', ')}`);
    // QUEUE Q67: the plasma's sound follows the heating like the drawn shell (flux on its log scale, the same airspeed gate);
    // sounds from elsewhere fall with distance, pan toward their side, need air at both ends
    const { sndPlasma, sndOthers } = new Function(blk + ';return {sndPlasma,sndOthers}')(), PV = api.PLASMA_V;
    const climb = sndPlasma(7.7e4, 1041, PV), peak = sndPlasma(1.6e5, 2600, PV), onset = sndPlasma(2e4, 2600, PV), cool = sndPlasma(0, 3000, PV), moon = sndPlasma(1e5, 2600, 0);
    const near = sndOthers([{ d: 200, T: 2.3e5, air: 1, x: 1 }]), far = sndOthers([{ d: 8000, T: 2.3e5, air: 1, x: 1 }]), left = sndOthers([{ d: 200, T: 2.3e5, air: 1, x: -0.8 }]),
      vac = sndOthers([{ d: 200, T: 2.3e5, air: 0, x: 1 }]), deb = sndOthers([{ d: 500, T: 0, whoosh: 0.5, air: 0.5, x: 0 }]);
    check('plasma sound: none on a hot climb or cool air, faint at onset, full at an orbital entry\'s peak; elsewhere: nearer is louder, panned, silent in vacuum',
      climb === 0 && cool === 0 && moon === 0 && onset > 0 && onset < 0.2 && peak > 0.95 && near.g > 2 * far.g && near.pan > 0.9 && left.pan < -0.7 && vac.g === 0 && deb.g > 0 && near.lp > far.lp
        && /sndPlasma\(st\.qh,st\.va,st\.pv\)/.test(H) && /sndOthers\(st\.others\)/.test(H),
      `plasma: climb ${climb}, onset ${onset.toFixed(2)}, peak ${peak.toFixed(2)} · others: 200 m ${near.g.toFixed(2)}, 8 km ${far.g.toFixed(3)}, debris ${deb.g.toFixed(2)}`);
  }
  // QUEUE Q102 (steps 1–3): hardware schools. A power's school is drawn once from its archetype's affinity (stable per
  // world and power); unbuilt schools fall back to Cape; a part draws in its maker's school (an import: the seller's);
  // the school rides in the vertex's kind (+32·school) and both mesh shaders decode it; reference views pin Cape
  {
    const SM = new Function(src + 'return {rng,WSEED,POWERS,HOME,archOf:typeof archOf==="function"?archOf:null}')();
    const env = { rng: SM.rng, WSEED: SM.WSEED, HOME: SM.HOME, SCHOOL_FORCE: null };
    const mk = (POW, arch, srcFn) => new Function('rng', 'WSEED', 'HOME', 'POWERS', 'archOf', 'sourceOf', 'SCHOOL_FORCE',
      pg.slice(pg.indexOf('const SCHOOL_IDS='), pg.indexOf('let SCHOOL_FORCE=')) + body('schoolOf') + ';' + body('partMaker') + ';' + body('partSchool') + ';return {schoolOf,partSchool}')(
      env.rng, env.WSEED, env.HOME, POW, arch, srcFn, null);
    const pows = Array.from({ length: 400 }, (_, i) => ({ arch: i % 2 ? 'closedSuper' : 'openSuper' })), A = i => pows[i].arch;
    const S1 = mk(pows, A, () => ({ how: 'home' })), S2 = mk(pows, A, () => ({ how: 'home' }));
    const closed = pows.map((_, i) => i).filter(i => i % 2), steppeShare = closed.filter(i => S1.schoolOf(i) === 1).length / closed.length;
    const stable = pows.every((_, i) => S1.schoolOf(i) === S2.schoolOf(i)), openCape = pows.map((_, i) => i).filter(i => !(i % 2)).every(i => S1.schoolOf(i) === 0);
    const imp = mk(pows, A, () => ({ how: 'import', from: 1 })).partSchool({ d: { key: 't2' } }), own = mk(pows, A, () => ({ how: 'home' })).partSchool({ d: { key: 't2' } });
    check('hardware schools: a power\'s school follows its affinity (closed superpowers mostly Steppe, open ones Cape) and never changes; a part draws in its maker\'s school',
      steppeShare > 0.6 && steppeShare < 0.8 && stable && openCape && imp === S1.schoolOf(1) && own === S1.schoolOf(env.HOME)
        && /int k=int\(aK\.x\+\.5\)%32;/.test(pg) && /hq=k\/256,sch=\(k\/32\)%8;k=k%32;/.test(pg) && /PK\.k\+32\*\(PK\.sch\|\|0\)\+256\*\(PK\.hq\|\|0\)/.test(pg)
        && /rdl=roundel\(vec2\(s-1\.5708\*R,v-h\*\.5\)\/rs,sch,fp\/rs,hue\)/.test(pg) && pg.indexOf(' alb=mix(alb,rdl.rgb,rdl.a);') > pg.indexOf('Steppe (Q102): grey-green enamel')
        && /if\(INTERSTAGE_FX&&p\.d\.kind==='dec'\)/.test(pg) && /sch=partSchool\(p\);PK=\{o:\[x,y0,z\],k:KIND\.collar/.test(pg)
        && /SCHOOL_FORCE = 0;/.test(readFileSync(new URL('./views.js', import.meta.url), 'utf8')),
      `closed superpowers drawing Steppe: ${(steppeShare * 100).toFixed(0)} % (0.7 expected)`);
  }
  // QUEUE Q24: char on dark paint heat-tints (it can't blacken black); a bay door's inside is a different colour from its
  // outside, and it has hinge brackets
  check('char on dark paint tints; bay doors have an inside and hinges',
    /float dk=1\.-smoothstep\(\.04,\.18,dot\(alb,vec3\(\.3,\.59,\.11\)\)\);/.test(pg) && /alb=mix\(alb,mix\(vec3\([^)]*\),vec3\([^)]*\),nz2\),dk\*/.test(pg)
      && /pv\(out,z,mul\(n,-1\),cin\)/.test(body('bayDoor')) && /for\(const zz of\[-\.55,0,\.55\]\)rbox/.test(body('bayDoor')));
  // QUEUE Q97: the leg and the power parts have their own looks (placeholders gone); the deployed leg puts its footpad
  // where the sim's legFoot puts the foot (reach out, drop below), one case each
  const leg = body('partBody').slice(body('partBody').indexOf("case'leg':"));
  check('part looks: leg, solar wing, body cells, battery and computer are drawn; the deployed leg\'s foot is legFoot\'s',
    ["case'leg':", "case'wpanel':", "case'bpanel':", "case'batt':", "case'ocomp':"].every(c => pg.split(c).length === 2) && !pg.includes('placeholder until the parts & pad beat')
      && !pg.includes('placeholders until the parts & pad beat') && /F=\[x\+n\[0\]\*d\.reach,y-d\.drop,z\+n\[2\]\*d\.reach\]/.test(leg)
      && /const legFoot=p=>\{const a=p\.phi\|\|0;return\[p\.pos\[0\]\+p\.d\.reach\*Math\.cos\(a\),p\.y0-p\.d\.drop/.test(H));
}

// vehicle-6. The Docking preset (vehicle session, QUEUE Q78): a docking head on the Orbiter's launcher reaches orbit with its
// gas full, can translate on RCS, and has a computer for Docking SAS on a probe.
{
  const d = api.PRESETS.Docking, s = handAscent(api, d), el = api.elements(s.r, s.v, TELLUS.mu), P = api.PROG, f0 = P.flights, tl = api.TEST.tools;
  const gas = s.parts.filter(p => p.on && p.d.kind === 'gas').reduce((a, p) => a + (p.res.gas || 0), 0), rcs = s.parts.filter(p => p.on && p.d.kind === 'rcs').length;
  P.flights = Math.max(1, f0); api.TEST.tools = false; s.av = api.AV.length - 1; const av = api.avOf(s).name; P.flights = f0; api.TEST.tools = tl;
  check('presets: Docking reaches orbit with both gas bottles full, eight RCS quads and the port on top; its computer gives Docking SAS in the onboard-computer era',
    s.alive && el.pe - TELLUS.R > TELLUS.atm && rcs === 8 && Math.abs(gas - 0.03) < 1e-9 && s.parts.some(p => p.on && p.d.kind === 'port') && av === api.AV[api.AV.length - 1].name && api.designName(d) === 'Docking',
    `periapsis ${((el.pe - TELLUS.R) / 1e3).toFixed(0)} km, ${api.dvRemaining(s).cur.toFixed(0)} m/s spare, ${rcs} quads, ${(gas * 1000).toFixed(0)} kg gas, SAS ${av}`);
}

// vehicle-7. Power, second slice (vehicle session, QUEUE Q131): an RTG gives the same day and night; the budget can be
// worked out for the orbit the flight is aimed at (higher means a shorter shadow); the battery's charge is kept when a
// vessel is registered and loaded back.
{
  const find = (n, k) => n.k === k ? n : (n.c || []).map(x => find(x, k)).find(Boolean);
  const des = (extra) => { const d = api.toV2(['core', 'ant', 't1', 'petrel']); find(d.root, 't1').c.push(...extra); return d; };
  const rt = api.newShip(des([{ k: 'rtg', at: { y: 0.5, a: 0, n: 1, cy: 0.3 }, c: [] }])), B = api.powerBudget(rt);
  api.S = rt; rt.r = mul(api.SUN_DIR, -(TELLUS.R + 3e5)); rt.E = 0; api.powerStep(rt, 10); const night = rt.pGen;
  const wing = api.newShip(des([{ k: 'wpanel', at: { y: 0.5, a: 0, n: 2, cy: 0.3 }, c: [] }])), lo = api.powerBudget(wing), hi = api.powerBudget(wing, { r: TELLUS.R + 1000e3 });
  const D = new Function(src + 'return {PROG,satRegister,vesselOf,newShip,toV2,TELLUS,HOOK,powerStep,get t(){return simT},set t(v){simT=v}};')();
  D.HOOK.msg = () => {}; const sat = D.newShip(['core', 'batt', 'ant', 't1', 'petrel']), rs = D.TELLUS.R + 3e5; D.powerStep(sat, 0); sat.E = 1234567;
  Object.assign(sat, { landed: false, alive: true, r: [rs, 0, 0], v: [0, 0, -Math.sqrt(D.TELLUS.mu / rs)], w: [0, 0, 0] }); D.PROG.sats = []; D.satRegister(sat, { day0: 0 });
  const back = D.PROG.sats.length ? D.vesselOf(D.PROG.sats[0], 0) : null;
  check('power: an RTG gives its 60 W in the shadow (no battery needed for a 5 W antenna); at 1,000 km the shadow is shorter than at low orbit; the charge survives the register',
    B.rtg === 60 && B.ok && B.needWh === 0 && night === 60 && hi.ecl < lo.ecl && hi.alt > 999 && hi.avg > lo.avg && back && back.E === 1234567,
    `RTG ${B.avg} W average, ${night} W at night · shadow ${(lo.ecl * 100).toFixed(0)}% low, ${(hi.ecl * 100).toFixed(0)}% at 1,000 km · charge back ${back && back.E}`);
}

// vehicle-8. A satellite's lifetime in the builder (vehicle session, QUEUE Q141; MIDGAME § Satellites): the design's top
// stage at the aimed orbit, what holding it costs a day (space's holdRate), how long the Δv left after getting there pays
// for it, and when the air brings it down after. Lower is dearer; a few hundred km up a good design outlasts its era.
{
  const B = api.PRESETS.Beeper, L = a => api.satLife(B, a), l110 = L(110), l200 = L(200), l400 = L(400);
  const d2 = JSON.parse(JSON.stringify(B)); d2[0] = 'chute'; const t0 = Date.now(); api.satLife(d2, 400); const ms = Date.now() - t0;
  check('lifetime: holding costs more the lower the orbit (110 km re-enters within a day once it stops); at 400 km the Beeper holds past 20 years; a new design at a seen altitude costs a few ms',
    l110.rate > l200.rate && l200.rate > l400.rate && l110.fall < 1 && l200.days > 365 && isFinite(l200.fall) && l400.days > 20 * 400 && !isFinite(l400.fall) && ms < 50,
    `110 km: ${l110.rate.toFixed(1)} m/s a day, ${l110.days.toFixed(0)} days on ${l110.spare.toFixed(0)} m/s, down in ${(l110.fall * 24).toFixed(0)} h · 200 km: ${l200.rate.toFixed(2)} m/s a day, ${(l200.days / 400).toFixed(1)} years, then down in ${l200.fall.toFixed(0)} days · 400 km: ${l400.rate.toFixed(3)} m/s a day · ${ms} ms`);
}

// space-4. Debris, slice 2 (space session, QUEUE Q146): conjunctions between flights. Big objects against active entries
// only, at Rs² v / (2π r² W cos(Δi/2)) a pair per band (study_debris.mjs: a Monte Carlo agrees within its noise). A hit:
// crewed entries are always warned and move; tracked ones (mainframe era on) with fuel dodge; the rest are destroyed with
// the object and the breakup is recorded. The pressure is a world setting (off / light / real).
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,detach,junkRegister,conjTick,pairRate,resid,bandR,BAND_W,skDv,TELLUS,PROG,HOOK,DAY_S};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R, deg = Math.PI / 180;
  const orbit = (s, alt, inc) => { const a = R + alt, vc = Math.sqrt(T.mu / a); Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, vc * Math.sin(inc * deg), -vc * Math.cos(inc * deg)] }); return s; };
  const sat = (alt, inc, { fuel = false, crew = false } = {}) => { const s = orbit(D.newShip(D.PRESETS.Probe), alt, inc); D.satRegister(s, { day0: P.day }); const q = P.sats.at(-1);
    if (!fuel) for (const o of q.shape) if (o.res) for (const k of ['fuel', 'gas']) if (o.res[k] > 0) { q.mass -= o.res[k] * 1000; o.res[k] = 0; }
    if (crew) q.shape[0].crew = 2; return q; };
  const junk = (alt, inc) => { const s = orbit(D.newShip(D.PRESETS.Orbiter), alt, inc); s.rec = { launched: true, day0: P.day };
    const ev = s.events.find(e => e.decouple.length); D.detach(s, s.parts.filter(p => p.on && ev.decouple.includes(p.seg)), [0, -1, 0], 0); D.junkRegister(s.rec); return P.sats.at(-1); };
  const reset = (day, mode) => { P.sats = []; P.day = day; P.breakups = []; P.pressures = { debris: mode }; news.length = 0; };
  reset(0, 'real'); const a = sat(425e3, 0), o = junk(425e3, 60), far = junk(1500e3, 60);
  const ra = D.resid(a), ro = D.resid(o), rb = D.bandR(6), Rs = ra.R + ro.R, want = Rs * Rs * Math.sqrt(T.mu / rb) / (2 * Math.PI * rb * rb * D.BAND_W * Math.cos(30 * deg)) * D.DAY_S;
  check('debris conjunctions: a pair sharing a band meets at Rs² v / (2π r² W cos(Δi/2)) a day; a pair in different bands never',
    Math.abs(ra.f[6] - 1) < 1e-9 && Math.abs(ro.f[6] - 1) < 1e-9 && Math.abs(D.pairRate(a, o) / want - 1) < 0.02 && D.pairRate(a, far) === 0,
    `${D.pairRate(a, o).toExponential(3)} a day (formula ${want.toExponential(3)}), Rs ${Rs.toFixed(1)} m; 1,500 km: ${D.pairRate(a, far)}`);
  const hit = () => 0, miss = () => 0.999999, T1 = d => (P.day + d) * D.DAY_S;
  reset(0, 'off'); { const a1 = sat(425e3, 0), o1 = junk(425e3, 60); D.conjTick(T1(0), T1(1), hit); const offKept = P.sats.includes(a1) && P.sats.includes(o1);
    reset(0, 'real'); const a2 = sat(425e3, 0), o2 = junk(425e3, 60); news.length = 0; D.conjTick(T1(0), T1(1), miss); const missed = P.sats.length === 2 && !news.length;
    D.conjTick(T1(0), T1(1), hit); const gone = !P.sats.includes(a2) && !P.sats.includes(o2) && P.breakups.length === 1 && Math.abs(P.breakups[0].h - 425e3) < 1e3 && news.some(m => /struck by/.test(m));
    check('debris conjunctions: off does nothing; a miss leaves both; an untracked hit destroys both and records the breakup',
      offKept && missed && gone, `breakup at ${P.breakups[0] ? (P.breakups[0].h / 1e3).toFixed(0) + ' km, ' + (P.breakups[0].mass / 1000).toFixed(1) + ' t' : '—'}`); }
  reset(3000, 'real'); { const a3 = sat(425e3, 0, { fuel: true }), o3 = junk(425e3, 60), dv0 = D.skDv(a3); D.conjTick(T1(0), T1(1), hit);
    const dodged = P.sats.includes(a3) && P.sats.includes(o3) && Math.abs(dv0 - D.skDv(a3) - 0.5) < 0.01 && news.some(m => /dodged/.test(m));
    reset(0, 'real'); const a4 = sat(425e3, 0, { crew: true }), o4 = junk(425e3, 60); D.conjTick(T1(0), T1(1), hit);
    const warned = P.sats.includes(a4) && P.sats.includes(o4) && news.some(m => /was warned/.test(m)) && !P.breakups.length;
    check('debris conjunctions: tracked (mainframe era) with fuel, it dodges for 0.5 m/s; crewed, it is always warned, even untracked and dry',
      dodged && warned, `dodged ${dodged}, crewed warned ${warned}`); }
}

// vehicle-9. Maneuver node chains (vehicle session, QUEUE Q33): nodes after the first, planned on the trajectory the earlier
// ones leave; a capture node at a moon's periapsis planned before the encounter, kept through the SOI switch; the burn
// started early enough that half its Δv is in by the node (the craft gets lighter, so that's more than half the burn).
{
  const mu = TELLUS.mu, R = TELLUS.R, el = s => api.elements(s.r, s.v, s.body.mu), msgs = []; api.HOOK.msg = m => msgs.push(m);
  // 1. across an SOI change: test 4's transfer geometry turned 12° (a flyby at ~240 km, not an impact), a kick now, then
  // N's next node lands on Selene's periapsis
  api.t = 0; const r = LEO, vc = Math.sqrt(mu / r), vp = Math.sqrt(mu * (2 / r - 2 / (r + SELENE.a))), at = (r + SELENE.a) / 2, tof = Math.PI * Math.sqrt(at ** 3 / mu);
  const d0 = norm(mul(moonPos(tof), -1)), L12 = 12 * Math.PI / 180, dir = [d0[0] * Math.cos(L12) - d0[2] * Math.sin(L12), d0[1], d0[0] * Math.sin(L12) + d0[2] * Math.cos(L12)], tang = cross([0, 1, 0], dir), s = api.newShip(api.PRESETS.Lunar); api.S = s; s.landed = false; s.r = mul(dir, r); s.v = mul(tang, vc);
  s.node = { t: 1, dv: [vp - vc, 0, 0] }; const n2 = api.nodeAddNext(s), P1 = api.nodePlan(s);
  const vrel = P1[1] ? len(P1[1].vN) : 0, rp = P1[1] ? len(P1[1].rN) : 1, want = Math.sqrt(SELENE.mu / rp) * 1.1; if (n2) n2.dv = [want - vrel, 0, 0];
  const E = api.nodePlanEnd(s), eS = E && api.elements(E.r, E.v, SELENE.mu);
  // the SOI switch drops the Tellus node and puts the Selene one up
  const q = { node: { t: 1, dv: [1, 0, 0] }, nodeQ: [{ t: 9e4, dv: [-5, 0, 0], b: 'Selene' }, { t: 9e5, dv: [1, 0, 0], b: 'Tellus' }], body: TELLUS }; msgs.length = 0; api.soiSwitch(q, SELENE, 'Entering');
  check('node chain: the next node after a Selene transfer sits at Selene\'s periapsis, tagged Selene; a retro burn there plans a capture; the SOI switch drops the node placed on the Tellus leg, puts the Selene one up, and keeps a later return node',
    n2 && n2.b === 'Selene' && P1.length === 2 && P1[1].b === SELENE && eS && eS.e < 1 && q.node && q.node.b === 'Selene' && q.nodeQ.length === 1 && q.nodeQ[0].b === 'Tellus' && /maneuver node cleared; the next is up/.test(msgs.join('|')),
    `node 2 at Selene, ${n2 ? ((n2.t - 1) / 3600).toFixed(1) : '?'} h after node 1, periapsis ${((rp - SELENE.R) / 1e3).toFixed(0)} km; capture ${n2 ? n2.dv[0].toFixed(0) : '?'} m/s → e ${eS ? eS.e.toFixed(2) : '?'} · ${msgs.join(' | ')}`);
  // 2. flown: a Hohmann raise from low orbit to 400 km in two nodes, burns started by nodeLead; the end orbit matches the plan
  const r1 = R + 400e3, dv1 = vc * (Math.sqrt(2 * r1 / (r + r1)) - 1), dv2 = Math.sqrt(mu / r1) * (1 - Math.sqrt(2 * r / (r + r1)));
  api.t = 0; const c = api.newShip(['pod', 't2', 'wren']); api.S = c; c.landed = false; c.r = [r, 0, 0]; c.v = [0, 0, -vc]; c.w = [0, 0, 0]; c.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; c.throttle = 0;
  c.node = { t: 600, dv: [dv1, 0, 0] }; api.nodeAddNext(c).dv = [dv2, 0, 0]; const plan = api.elements(api.nodePlanEnd(c).r, api.nodePlanEnd(c).v, mu);
  api.stage(c); c.throttle = 0; c.sas = true; c.sasMode = 'node'; const est = api.nodeBurnTime(c, dv1), lead = api.nodeLead(c, dv1);
  for (let k = 0; k < 4e5 && c.alive && (c.node || c.throttle > 0); k++) { const n = c.node; if (!n) break;
    const go = n.t - api.nodeLead(c, len(api.nodeInfo(c).rem));
    if (!n.burning && api.t < go - 120) { api.advRails(c, Math.min(60, go - 120 - api.t), 10); continue; }
    c.throttle = api.t >= go || n.burning ? 1 : 0; api.advPhys(c); }
  const got = el(c);
  check('node chain flown: a two-node raise to 400 km, each burn led so half its Δv is in by the node, ends within 3 km of the planned orbit; the lead is a little more than half the burn',
    !c.node && Math.abs(got.pe - plan.pe) < 3e3 && Math.abs(got.ap - plan.ap) < 3e3 && Math.abs(plan.pe - r1) < 2e3 && lead > est / 2 && lead < 0.6 * est,
    `planned ${((plan.pe - R) / 1e3).toFixed(1)}×${((plan.ap - R) / 1e3).toFixed(1)} km, flown ${((got.pe - R) / 1e3).toFixed(1)}×${((got.ap - R) / 1e3).toFixed(1)} km; burn 1 ${est.toFixed(0)} s, lead ${lead.toFixed(1)} s (half ${(est / 2).toFixed(1)})`);
}

// econ-11. Obsolescence and servicing (economy session, QUEUE Q126, MIDGAME.md § Satellites): a satellite earns less
// for each computing era it falls behind; servicing a valuable one (a contract completed by docking with it) brings it
// up to date.
{
  const D = new Function(src + 'return {satQual,satEra,obsTick,serviceTarget,genOffer,contractEval,compEra,CT,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, stand: {}, done: { beeper: { day: 1 } }, own: null, decisions: [], offers: [], active: [], flights: 3, cdone: 0 }); D.chooseStart('agency');
  const tv = { id: 31, name: 'TV 1', ant: 1, r: [7e6, 0, 0], v: [0, 7e3, 0], epoch: 0, tvOn: true, pending: [], imgs: 0 }, cam = { id: 32, name: 'Eye 1', cam: 1, ant: 1, contact: 0.1, r: [7e6, 0, 0], v: [0, 7e3, 0], epoch: 0, pending: [], imgs: 0 };
  P.sats = [tv, cam]; const e0 = D.compEra(); D.obsTick(); const q0 = D.satQual(tv);
  while (D.compEra() < e0 + 1 && P.day < 20000) P.day += 50; news.length = 0; D.obsTick(); D.obsTick(); const q1 = D.satQual(tv), n1 = news.filter(t => /generation/.test(t)).length;
  check('obsolescence: a satellite earns in full in its own era, 74 % one era behind; the news says so once per satellite', q0 === 1 && Math.abs(q1 - 1 / 1.35) < 1e-9 && n1 === 2,
    `era ${e0} → ${D.compEra()} on day ${P.day}: ${Math.round(q1 * 100)} %, ${n1} news`);
  const tgt = D.serviceTarget();
  check('servicing: offered for a valuable satellite that has fallen behind (TV in view), not a poorly placed imager', tgt === tv);
  const c = { id: 961, type: 'service', src: 'gov', client: 0, p: D.CT.service.gen(D.rng(1)), deadline: P.day + 300 }; P.active = [c];
  const R = { cdone: [], paid: [] }, f0 = P.funds; D.contractEval({ rec: R, att: [] }); const before = P.active.length;
  D.contractEval({ rec: R, att: [{ e: tv }] });
  check('servicing: a flight docked with it completes the contract, and the satellite is up to date again', before === 1 && P.active.length === 0 && P.funds > f0 && D.satEra(tv) === D.compEra() && D.satQual(tv) === 1 && !D.serviceTarget(),
    `paid ${(P.funds - f0).toFixed(0)}M; ${c.p.name}, ${c.p.n} era behind`);
}

// econ-12. A mission counts only on a flight launched while it was open (economy session, W11 defaulted; QUEUE Q113 /
// PLAYTEST #29): chained firsts no longer complete together (a 2 t flight earned Heavy Lift I and II; the tracking flight
// that weighs Nyx earned the flyby too). The flight's launch record lists what was open (R.open0, v1.74).
{
  const D = new Function(src + 'return {missionEval,recNew,MISSIONS,PROG,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 50, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], flights: 4, cdone: 0, staged: {},
    done: { weather: { flight: 1, day: 1 }, beeper: { flight: 2, day: 2 } } }); D.chooseStart('agency');
  const open = () => D.MISSIONS.filter(M => !P.done[M.id] && (M.req || []).every(r => P.done[r])).map(M => M.id);
  const R = D.recNew(); R.open0 = open(); Object.assign(R, { orbit: true, lift: 2, orb: { pe: 150e3, ap: 160e3, inc: 0 }, paid: [] });
  D.missionEval({ rec: R, parts: [] }); D.missionEval({ rec: R, parts: [] });
  const one = !!P.done.lift1 && !P.done.lift2;
  const R2 = D.recNew(); R2.open0 = open(); Object.assign(R2, { orbit: true, lift: 2, orb: R.orb, paid: [] }); D.missionEval({ rec: R2, parts: [] });
  check('W11: a 2 t flight launched with only Heavy Lift I open earns that one; the next flight earns Heavy Lift II', one && !!P.done.lift2, `after the first flight: lift1 ${!!P.done.lift1}, lift2 ${one ? 'not yet' : 'too'}`);
}

// space-5. Debris, slice 3 (space session, QUEUE Q147): fragments as a density per band. Breakups add 1 cm+ fragments
// by NASA's model, spread around their height; drag drains each band into the one below; a hit kills an uncrewed entry
// (a dead hulk stays up) and only a large fragment shatters it; crewed entries are warned, never hit by surprise; the
// cascade (R0 ≥ 1 and the next breakup due within 50 years) is news; an anti-satellite test fouls a band.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,detach,junkRegister,fragTick,breakup,fragsOf,fragBands,fragRate,catFrac,asatTest,CASC_STAT,BAND_N,TELLUS,PROG,HOOK,DAY_S,YEAR_D};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R, deg = Math.PI / 180, sum = () => D.fragBands().reduce((a, x) => a + x, 0);
  const reset = mode => { P.sats = []; P.day = 0; P.frag = null; P.breakups = []; P.casc = {}; P.pressures = { debris: mode }; news.length = 0; };
  const orbit = (s, alt, inc) => { const a = R + alt, vc = Math.sqrt(T.mu / a); Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, vc * Math.sin(inc * deg), -vc * Math.cos(inc * deg)] }); return s; };
  const sat = (alt, inc, crew = false) => { D.satRegister(orbit(D.newShip(D.PRESETS.Probe), alt, inc), { day0: 0 }); const q = P.sats.at(-1); if (crew) q.shape[0].crew = 2; return q; };
  const junk = (alt, inc) => { const s = orbit(D.newShip(D.PRESETS.Orbiter), alt, inc); s.rec = { launched: true, day0: 0 }; const ev = s.events.find(e => e.decouple.length);
    D.detach(s, s.parts.filter(p => p.on && ev.decouple.includes(p.seg)), [0, -1, 0], 0); D.junkRegister(s.rec); const q = P.sats.at(-1); q.mass = 2000; return q; };
  reset('real'); const n1 = D.breakup(800e3, 1000), F = D.fragBands(), pk = F.indexOf(Math.max(...F)), s1 = sum();
  reset('real'); D.breakup(150e3, 1000); const lowKept = sum() / D.fragsOf(1000);
  check('fragments: a 1 t breakup makes ~47,000 pieces of 1 cm and more (NASA), spread around its height; a low one loses what falls below the air',
    Math.abs(n1 - 0.1 * 1000 ** 0.75 * 0.01 ** -1.71) < 1 && (pk === 13 || pk === 14) && Math.abs(s1 / n1 - 1) < 1e-6 && lowKept < 0.9,
    `${Math.round(n1)} fragments, peak band ${pk}; a breakup at 150 km keeps ${(lowKept * 100).toFixed(0)} % in the bands`);
  reset('off'); D.breakup(400e3, 1000); D.breakup(800e3, 1000); const lo0 = D.fragBands().slice(0, 9).reduce((a, x) => a + x, 0), hi0 = D.fragBands().slice(12).reduce((a, x) => a + x, 0);
  D.fragTick(0, D.YEAR_D * D.DAY_S); const lo1 = D.fragBands().slice(0, 9).reduce((a, x) => a + x, 0), hi1 = D.fragBands().slice(12).reduce((a, x) => a + x, 0);
  check('fragments: drag drains low bands within a year and barely touches 800 km (even with the setting off, drag is physics)',
    lo1 / lo0 < 0.7 && hi1 / hi0 > 0.99, `below 550 km ${(lo1 / lo0 * 100).toFixed(0)} % left, above 700 km ${(hi1 / hi0 * 100).toFixed(1)} %`);
  // a thick cloud at 425 km: an uncrewed satellite dies (a hulk stays), a crewed one is warned and lives, a big object shatters
  reset('real'); D.breakup(425e3, 1e9); const a = sat(425e3, 0), c = sat(425e3, 0, true), o = junk(425e3, 60), nB = sum();
  const La = D.fragRate(a), cf = D.catFrac(a.mass, 3000); D.fragTick(0, D.DAY_S, () => 0.001);
  const dead = P.sats.includes(a) && a.junk && /\(dead\)$/.test(a.name) && a.ant === 0, crewOK = P.sats.includes(c) && !c.junk && news.some(m => /crew are warned/.test(m));
  const shattered = !P.sats.includes(o) && sum() > nB * 0.99 && news.some(m => /shattered by a large fragment/.test(m)) && news.some(m => /gone silent/.test(m));
  check('fragments: in a thick cloud an uncrewed satellite goes silent (its hulk stays up as debris), a crewed one is warned and lives, a spent stage is shattered into more',
    La > 1 && cf < 0.01 && dead && crewOK && shattered, `hits a day ${La.toFixed(1)}, shattering share ${cf.toExponential(1)}; dead ${dead}, crew ${crewOK}, shattered ${shattered}`);
  // a thinner cloud, the same roll: the satellite dies, the stage (only large fragments can shatter it) survives
  reset('real'); D.breakup(425e3, 1e7); const a3 = sat(425e3, 0), o3 = junk(425e3, 60); D.fragTick(0, D.DAY_S, () => 0.01);
  check('fragments: a hit that kills a satellite leaves a spent stage whole (shattering takes 40 J per gram of it)',
    a3.junk && P.sats.includes(o3), `satellite ${a3.junk ? 'dead' : 'alive'}, stage ${P.sats.includes(o3) ? 'whole' : 'shattered'}`);
  reset('off'); D.breakup(425e3, 1e7); const a2 = sat(425e3, 0); D.fragTick(0, D.DAY_S, () => 0); const offOK = P.sats.includes(a2) && !a2.junk;
  // the cascade: thirty spent stages at 800–850 km and a big breakup there: R0 ≥ 1, the next breakup due within 50 years, news once
  reset('real'); for (let i = 0; i < 30; i++) junk(825e3, (i * 37) % 180); D.breakup(825e3, 2e5); D.fragTick(0, D.DAY_S, () => 0.999999); D.fragTick(D.DAY_S, 2 * D.DAY_S, () => 0.999999);
  const cs = D.CASC_STAT[14] || {}, casc = news.filter(m => /feeds itself/.test(m)).length;
  const asat = (P.frag = null, D.asatTest('A rival', 600e3)), asatOK = asat > 4e4 && D.fragBands()[9] > 1000 && news.some(m => /anti-satellite/.test(m));
  check('fragments: off spares satellites; a crowded band past R0 = 1 with the next breakup due within 50 years is news, once; an anti-satellite test fouls its band',
    offOK && cs.R0 >= 1 && cs.gen <= 50 && casc === 1 && asatOK, `R0 ${cs.R0?.toFixed(1)}, next in ${cs.gen?.toFixed(1)} years, news ${casc}; ASAT ${Math.round(asat)} fragments`);
}

// econ-13. Powers as content (economy session, QUEUE Q103, POWERS.md): a hardware school per power from its archetype's
// affinities (the same draw the look lane's schoolOf used, now read from POWERS), names from the school's syllables and
// the archetype's forms of government, sites named after them; rivals' news by archetype.
{
  const D = new Function(src + 'return {POWERS,SITES,SCHOOLS,ARCH_FORMS,RIVAL_WIN,raceTick,MISSIONS,PROG,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},get RIVALS(){return RIVALS},set RIVALS(v){RIVALS=v},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const W = D.POWERS, sup = W.filter(p => /Super$/.test(p.arch)), roots = W.map(p => p.root);
  const formOk = p => D.ARCH_FORMS[p.arch].some(f => f.replace('#', p.root) === p.name);
  check('powers: every power has a school (a resource state its contractor\'s), the superpowers\' differ, names unique and in their archetype\'s forms',
    W.every(p => D.SCHOOLS[p.school]) && sup.length === 2 && sup[0].school !== sup[1].school && new Set(roots).size === roots.length && W.every(formOk)
    && W.filter(p => p.arch === 'resource').every(p => p.contractor != null && W[p.contractor].school === p.school),
    W.map(p => `${p.name} (${p.arch}, ${p.school})`).join('; '));
  check('powers: launch sites carry the new names', D.SITES.filter(t => t.power != null).every(t => t.name.startsWith(W[t.power].root)), D.SITES.slice(0, 4).map(t => t.name).join(', '));
  const H = html.replace(/\r\n/g, '\n');
  check('powers: the look lane reads the SIM\'s school (one source of truth)', H.includes('if(POWERS[i].school&&') && H.includes('return SCHOOL_IDS[POWERS[i].school]'));
  D.resetHome(); Object.assign(P, { homeArch: null, day: 0, rel: {}, op: {}, done: {}, raceLost: {}, raceAnn: {} }); D.chooseStart('agency');
  const open = W.find(p => p.arch === 'openSuper'), closed = W.find(p => p.arch === 'closedSuper');
  D.RIVALS = { beeper: { i: open.i, day: 100 }, hop: { i: closed.i, day: 100 } };
  P.day = 69; D.raceTick(); const n0 = news.length; P.day = 70; D.raceTick(); const ann = news.slice(n0); P.day = 90; D.raceTick(); const rum = news.slice(n0 + ann.length);
  P.day = 100; news.length = 0; D.raceTick();
  check('rivals: the open superpower announces 30 days ahead, the closed one is preceded by rumours; each wins in its own tone',
    ann.length === 1 && /announces an attempt at The beeper/.test(ann[0]) && rum.length === 1 && /Rumours from/.test(rum[0]) && news.some(t => /Live on every channel/.test(t)) && news.some(t => /state bulletin/.test(t)),
    [...ann, ...rum, ...news].join(' | '));
}

// platform-2. Save versions (QUEUE Q57): a save carries `ver`; the loader runs MIGRATE from the save's version up to
// SAVE_V. Fixtures: a version-0 save (no `ver`, no rel/op, a docked satellite, a broken day) comes up current and clean;
// a current save passes through unchanged; a save from a newer game is left alone and flagged; garbage loads as nothing;
// saving never lowers a newer save's version. When SAVE_V goes up, add the new step's fixture here.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const blk = pg.slice(pg.indexOf('const SAVE_V='), pg.indexOf('try{const j=migrateSave('));
  const { SAVE_V, MIGRATE, migrateSave } = new Function(blk + ';return {SAVE_V,MIGRATE,migrateSave}')();
  const v0 = migrateSave({ funds: 50, day: NaN, sats: [{ id: 1, docked: true }], done: { beeper: 1 } });
  const cur = { ver: SAVE_V, funds: 70, day: 12, rel: { 1: 0.2 }, op: {}, sats: [] }, curOut = migrateSave(JSON.parse(JSON.stringify(cur)));
  const fut = migrateSave({ ver: SAVE_V + 5, funds: 1, odd: 'x' });
  check('save versions: an old save comes up current and clean; a current one is unchanged; a newer one is left alone and flagged',
    MIGRATE.length === SAVE_V && v0.ver === SAVE_V && v0.day === 0 && !('docked' in v0.sats[0]) && v0.rel && v0.op && v0.done.beeper === 1 && v0.funds === 50
      && JSON.stringify(curOut) === JSON.stringify(cur) && fut.ver === SAVE_V + 5 && fut.newerSave === true && fut.odd === 'x'
      && migrateSave(null) === null && migrateSave('junk') === null && /PROG\.ver=Math\.max\(PROG\.ver\|0,SAVE_V\)/.test(pg),
    `SAVE_V ${SAVE_V}, ${MIGRATE.length} step(s)`);
}

// space-6. Dispatched flights leave debris too (space session, QUEUE Q149): procFly hands back what its flight dropped
// (keepJunk) and dispatchRun registers the pieces that stay up, dated from the flight's start; dry runs leave none.
{
  const D = new Function(src + 'return {PRESETS,PROG,HOOK,procKey,procFly,junkAdd,JUNK,newShip,detach,TELLUS,DAY_S,satKind,BODIES,MISSIONS,SELENE,advPhys,advRails,bodyRel,dvPlan,dvRemaining,engAcc,localFrame,procStart,qFromBasis,railsOK,siteAt,stage,timeToNu,toPF,vesselCost,len,norm,add,sub,mul,dot,cross,elements,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, st = D.PRESETS.Orbiter; P.sats = []; P.day = 10; P.procs = {}; handAscent(D, st); const proc = P.procs[D.procKey(st)];
  D.JUNK.length = 0; D.JUNK.push({ marker: true }); const before = D.JUNK.length, day = P.day;
  const f = D.procFly(st, proc, { pe: 180e3, ap: 180e3 }, { keepJunk: true }), j1 = D.JUNK.map(j => j.marker ? 'M' : Math.round(j.mass)).join(','), dry = D.procFly(st, proc, { pe: 180e3, ap: 180e3 }), j2 = D.JUNK.map(j => j.marker ? 'M' : Math.round(j.mass)).join(',');
  const kept = D.JUNK.length === 1 && D.JUNK[0].marker, n0 = D.junkAdd(f.junk || [], f.T0);   // the booster falls back: nothing stays up
  // a piece dropped by the orbiting craft: registered, its epoch from the flight's start
  const s = f.s; s.rec = { launched: true, day0: 0 }; const part = s.parts.filter(p => p.on && p.d.kind === 'tank').slice(-1);
  D.JUNK.length = 0; D.detach(s, part, [0, -1, 0], 0); const piece = D.JUNK[0]; piece.mass = Math.max(piece.mass, 200); const n1 = D.junkAdd([piece], f.T0), q = P.sats.at(-1);
  check('dispatched debris: procFly hands back its flight’s pieces (keepJunk), the global list untouched, dry runs return none; what stays up is registered from the flight’s start',
    f.ok && Array.isArray(f.junk) && f.junk.length >= 1 && f.junk.every(j => j.rec) && !('junk' in dry) && before === 1 && kept && f.T0 === Math.ceil(day - 1e-9) * D.DAY_S &&
    n0 === 0 && n1 === 1 && q.junk && D.satKind(q) === 'Debris' && Math.abs(q.epoch - (f.T0 + piece.t)) < 1e-6,
    `${f.junk ? f.junk.length : '—'} piece(s) dropped (${f.junk ? f.junk.map(j => Math.round(j.mass) + ' kg').join(', ') : ''}); registered ${n0} then ${n1}; list kept ${kept} (after the flight ${j1}, after the dry run ${j2}); T0 ${f.T0 / D.DAY_S} (day ${day}); epoch off by ${q ? (q.epoch - f.T0 - piece.t).toExponential(1) : '—'}`);
}

// space-7. The orbital period goes in the logbook once the engines stop (space session, QUEUE Q114, PLAYTEST #30): it
// used to be logged the first moment the orbit was bound, mid-burn (a probe captured into 200 × 20 km logged "1,521.9 min
// at 3,112 km"). The Δv to orbit is still noted at the moment the orbit closes.
{
  const D = new Function(src + 'return {newShip,PRESETS,missionTick,elements,TELLUS,SELENE,PROG,HOOK,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG; P.day = 0; P.log = {};
  const run = (B, alt, apAlt) => { const x = D.newShip(D.PRESETS.Probe); D.S = x; x.landed = false; D.t = 0; D.missionTick(x, 0, false);
    const rp = B.R + alt, ra = B.R + apAlt, a = (rp + ra) / 2, vp = Math.sqrt(B.mu * (2 / rp - 1 / a));
    Object.assign(x, { alive: true, landed: false, body: B, r: [rp, 0, 0], v: [0, 0, -vp], throttle: 1 }); x.rec.dv = 900; x.rec.launched = true;
    x.parts.filter(p => p.on && p.d.kind === 'engine').forEach(p => { x.segs[p.seg].ignited = true; });
    const id = B === D.SELENE ? 'sorbit' : 'period'; delete P.log[id]; D.missionTick(x, 0.1, true); const burning = !!P.log[id];
    x.throttle = 0; D.missionTick(x, 0.1, true); const L = P.log[id], el = D.elements(x.r, x.v, B.mu);
    return { burning, ok: !!L && Math.abs(L.v.p - el.period) < 1e-6, L, el }; };
  const sel = run(D.SELENE, 20e3, 200e3), tel = run(D.TELLUS, 300e3, 300e3);
  check('logbook: the orbital period is noted once the engines stop, around Selene and Tellus, not mid-burn',
    !sel.burning && sel.ok && !tel.burning && tel.ok && D.PROG.log.orbit,
    `Selene ${sel.L ? (sel.L.v.p / 60).toFixed(1) + ' min' : '—'} (logged while burning: ${sel.burning}); Tellus ${tel.L ? (tel.L.v.p / 60).toFixed(1) + ' min' : '—'} (while burning: ${tel.burning})`);
}

// econ-14. The network screen's model (economy session, QUEUE Q154): netModel() gives the screen its fleet and pads (as
// flow's fallback did), today's nodes with stock and need, no routes yet, and the bottleneck (the crewed node shortest of
// supplies). The screen reads it and computes nothing.
{
  const D = new Function(src + 'return {netModel,padsN,TELLUS,SELENE,PROG,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], flights: 5, fac: {}, stations: [] }); D.chooseStart('agency');
  const R0 = D.TELLUS.R + 400e3, v0 = Math.sqrt(D.TELLUS.mu / R0), u = [-1, 0, 0].map(x => x * D.SELENE.R);
  const sat = { id: 41, name: 'Lookout 1', cam: 1, ant: 1, r: [R0, 0, 0], v: [0, 0, v0], epoch: 0, pending: [], imgs: 0, shape: [] };
  const base = { id: 42, name: 'Selene Base 1', landed: true, beacon: true, bodyName: 'Selene', pf: u, ql: [0, 0, 0, 1], shape: [{ k: 'hab', crew: 2, res: { sup: 0.1 } }], pending: [], imgs: 0 };
  P.sats = [sat, base];
  P.dispatch = [{ id: 1, title: 'Supply run to Selene Base 1', base: 42, stack: ['sci', 't8', 'kestrel'], pad: 0, launch: 140, ordered: 100, status: 'queued' },
    { id: 2, title: 'Dispatched: a satellite contract', cid: 9, stack: ['sci', 't8', 'kestrel'], pad: 0, launch: 90, status: 'deviated', dev: { why: 'the upper stage failed to relight' } }];
  const M = D.netModel(), bn = M.nodes.find(n => n.id === 'reg:42'), sn = M.nodes.find(n => n.id === 'reg:41');
  check('network model: fleet (craft, queued and deviated dispatches) and the pads\' bookings, as the screen draws them',
    M.fleet.length === 4 && M.fleet.some(f => /needs you/.test(f.next)) && M.pads.length === D.padsN() && M.pads[0].bars.length === 1 && M.pads[0].bars[0].to === 140 && Array.isArray(M.routes) && !M.routes.length,
    M.fleet.map(f => `${f.name}: ${f.next}`).join(' · '));
  check('network model: nodes for our sites, the satellite by orbit band, the base with its stock and need; the bottleneck names it',
    M.nodes.some(n => n.kind === 'site') && sn && sn.slot === 'low' && bn && bn.kind === 'base' && bn.stock.supplies === 100 && bn.need.supplies === 10 && Math.round(bn.days) === 10
    && M.bottleneck && M.bottleneck.node === 'reg:42' && /10 days of supplies/.test(M.bottleneck.text), M.bottleneck ? M.bottleneck.text : 'no bottleneck');
  const N = readFileSync(new URL('./app/network.js', import.meta.url), 'utf8');
  check('network model: the screen reads netModel() when it exists', /typeof netModel==='function'\?netModel\(\)/.test(N));
}

// space-8. Missions in flight, slice 1 (space session, QUEUE Q49): a vessel still coasting above the air at flight end
// that isn't in a lasting orbit becomes a cruise entry, carried between flights leg by leg as the predictor sees it.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,satAt,elements,kepler,predictFrom,cruiseNext,flyable,satsUp,TELLUS,SELENE,PROG,HOOK,DAY_S,STAT_R,len,sub,set ORB_T0(v){ORB_T0=v}};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, Sl = D.SELENE, R = T.R; D.ORB_T0 = 0;
  const reg = (r, v) => { const s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r, v }); const n = P.sats.length; D.satRegister(s, { day0: 0 }); return P.sats.length > n ? P.sats.at(-1) : null; };
  const reset = () => { P.sats = []; P.day = 0; news.length = 0; };
  // a transfer to Selene: from 300 km, aimed so the predictor finds the encounter
  const r0 = R + 300e3, vT = Math.sqrt(T.mu * (2 / r0 - 2 / (r0 + Sl.a))) * 1.002; let tr = null;
  for (let k = 0; k < 360 && !tr; k++) { const a = k * Math.PI / 180, r = [r0 * Math.cos(a), 0, r0 * Math.sin(a)], v = [vT * Math.sin(a), 0, -vT * Math.cos(a)], L = D.predictFrom({ b: T, r, v, t: 0 });
    if (L[0].endKind === 'enc' && L[1] && L[1].b === Sl) tr = { r, v, L }; }
  reset(); const qt = reg(tr.r, tr.v), tArr = tr.L[0].endT; D.advanceDays(Math.ceil(tArr / D.DAY_S) + 0.01);
  const arrived = qt && qt.bodyName === 'Selene' && news.some(m => /entered Selene/.test(m));
  const back = qt && (qt.cruise || !P.sats.includes(qt) || qt.bodyName === 'Selene');
  check('in flight: a Selene transfer left at flight end is carried between flights and enters Selene’s sphere when the predictor said',
    !!tr && qt && qt.cruise !== undefined && arrived && back, `found an aim: ${!!tr}; arrives on day ${(tArr / D.DAY_S).toFixed(2)}; now around ${qt ? (qt.bodyName || 'Tellus') : '—'}; ${news.filter(m => /entered|settled|struck|left/.test(m)).join(' / ')}`);
  // an escape stays on its rails; a return halts at the top of the air (flyable, waiting); lasting orbits are satellites
  reset(); const ve = Math.sqrt(2 * T.mu / r0) * 1.05, qe = reg([r0, 0, 0], [0, 0, -ve]); D.advanceDays(3); const eExp = D.kepler([r0, 0, 0], [0, 0, -ve], 3 * D.DAY_S, T.mu)[0], qeUp = D.satsUp().includes(qe);
  reset(); const ra = R + 5000e3, rp = R + 50e3, aa = (ra + rp) / 2, va = Math.sqrt(T.mu * (2 / ra - 1 / aa)), qr = reg([ra, 0, 0], [0, 0, -va]); D.advanceDays(1); const hr = qr && D.len(qr.r) - R, ep1 = qr && qr.epoch; D.advanceDays(1);
  const halted = qr && qr.cruise && qr.halt && qr.halt.kind === 'air' && Math.abs(hr - T.atm) < 1 && qr.epoch > ep1 && Math.abs(D.len(D.satAt(qr, qr.epoch)[0]) - R - T.atm) < 1 && D.flyable(qr) && news.some(m => /top of Tellus/.test(m));
  reset(); const ql = reg([R + 300e3, 0, 0], [0, 0, -Math.sqrt(T.mu / (R + 300e3))]), qs = reg([D.STAT_R, 0, 0], [0, 0, -Math.sqrt(T.mu / D.STAT_R)]);
  check('in flight: an escape carries on outward (the moons perturb it as in flight); a return waits at the top of the air, flyable; low and stationary orbits are still satellites',
    qe && qe.cruise && Math.abs(qe.epoch - 3 * D.DAY_S) < 1 && D.len(qe.r) > 0.9 * D.len(eExp) && D.elements(qe.r, qe.v, T.mu).e > 1 && halted && ql && !ql.cruise && qs && !qs.cruise && D.satsUp().includes(qs) && !qeUp,
    `escape at ${qe ? (D.len(qe.r) / 1e6).toFixed(0) : '—'} Mm after 3 days (pure Kepler ${(D.len(eExp) / 1e6).toFixed(0)}, ${qe ? (D.len(D.sub(qe.r, eExp)) / 1e3).toFixed(0) : '—'} km apart); return halted at ${hr ? (hr / 1e3).toFixed(1) : '—'} km`);
}

// econ-15. Rival personalities in the race and the program's own voice (economy session, QUEUE Q165, POWERS.md): a
// frugal power doesn't race; a rising power copies the first of the race's firsts, then catches up; our firsts are
// announced in the home archetype's voice.
{
  const D = new Function(src + 'return {raceSchedule,RACE,POWERS,missionComplete,MISSIONS,PROG,HOOK,resetHome:()=>{HOME=0},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'frugal', day: 10, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], flights: 1, done: {}, raceLost: {}, staged: {} }); D.chooseStart('agency');
  const W = D.POWERS, x = W.find(p => p.i !== 0 && !/Super$/.test(p.arch)), keep = { arch: x.arch, tech: x.tech, econ: x.econ };
  Object.assign(x, { arch: 'frugal', tech: 5, econ: 5 }); const Sf = D.raceSchedule();
  Object.assign(x, { arch: 'rising' }); const Sr = D.raceSchedule(); Object.assign(x, keep);
  check('race: a frugal power never holds a first, however fast; a rising one leaves the first of them to others and wins later ones',
    D.RACE.every(id => !Sf[id] || Sf[id].i !== x.i) && Sr[D.RACE[0]] && Sr[D.RACE[0]].i !== x.i && D.RACE.slice(1).some(id => Sr[id] && Sr[id].i === x.i),
    `rising ${x.root}: ${D.RACE.map(id => `${id} → ${Sr[id] ? W[Sr[id].i].root : '—'}`).join(', ')}`);
  D.missionComplete(D.MISSIONS.find(m => m.id === 'beeper'), null);
  check('our own first is announced in the home archetype\'s voice (frugal: the science desk)', news.some(t => /FIRST IN THE WORLD/.test(t) && /motorway bridge/.test(t)), news.find(t => /FIRST/.test(t)));
}

// space-9. Missions in flight, slice 2 (space session, QUEUE Q49): cruise events on the timeline, and "no silent
// misses": entering a moon's sphere and the closest approach there stop time once per vessel and body; an atmosphere or
// an impact course always stops it (an impact 3 h ahead, so it can be flown).
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,advanceTo,upcoming,cruiseEvents,cruiseSeen,predictFrom,elements,tPe,satAt,TELLUS,SELENE,PROG,HOOK,DAY_S,len,set ORB_T0(v){ORB_T0=v}};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, Sl = D.SELENE, R = T.R; D.ORB_T0 = 0;
  const reg = (r, v) => { const s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r, v }); D.satRegister(s, { day0: 0 }); return P.sats.at(-1); };
  const reset = () => { P.sats = []; P.day = 0; news.length = 0; P.decisions = []; P.active = []; P.dispatch = []; };
  const r0 = R + 300e3, vT = Math.sqrt(T.mu * (2 / r0 - 2 / (r0 + Sl.a))) * 1.002; let tr = null;
  for (let k = 0; k < 360 && !tr; k++) { const a = k * Math.PI / 180, r = [r0 * Math.cos(a), 0, r0 * Math.sin(a)], v = [vT * Math.sin(a), 0, -vT * Math.cos(a)], L = D.predictFrom({ b: T, r, v, t: 0 });
    if (L[0].endKind === 'enc' && L[1] && L[1].b === Sl) tr = { r, v, L }; }
  reset(); const q = reg(tr.r, tr.v), ev1 = D.upcoming().find(x => x.kind === 'cruise'), arr = tr.L[0].endT / D.DAY_S;
  const st1 = D.advanceTo(arr + 20), day1 = P.day, ev2 = D.upcoming().find(x => x.kind === 'cruise'), st2 = D.advanceTo(arr + 20), day2 = P.day;
  const [rq, vq] = D.satAt(q, day2 * D.DAY_S), eq = D.elements(rq, vq, Sl.mu), toPe = (D.tPe(eq, 0) - D.tPe(eq, eq.nu)) / D.DAY_S;
  check('in flight: the arrival at Selene is on the timeline and stops time there; the next stop is the closest approach (or an impact warning) 3 h ahead',
    ev1 && /enters Selene/.test(ev1.text) && ev1.stop && Math.abs(ev1.day - arr) < 1e-6 && st1 && st1.kind === 'cruise' && Math.abs(day1 - arr) < 1e-3 && q.bodyName === 'Selene' && q.seen && q.seen['enc:Selene'] &&
    ev2 && ev2.stop && /capture burn|strike/.test(ev2.text) && st2 && st2.kind === 'cruise' && day2 > day1 && (!/capture burn/.test(ev2.text) || Math.abs(toPe - 3 / 24) < 0.01),
    `listed: ${ev1 ? ev1.text + ' (day ' + ev1.day.toFixed(2) + ')' : '—'}; stopped on day ${day1.toFixed(3)}; next: ${ev2 ? ev2.text : '—'}, stopped on day ${day2.toFixed(3)}, ${(toPe * 24).toFixed(2)} h before periapsis`);
  // seen once: the same kind of stop for that body doesn't stop time again
  const evs = D.cruiseEvents(P.day * D.DAY_S), again = evs.find(x => x.key), seenOK = !again || (D.cruiseSeen(again), !D.cruiseEvents(P.day * D.DAY_S).find(x => x.key === again.key && x.stop));
  // a return to Tellus stops at the top of the air
  reset(); const ra = R + 5000e3, rp = R + 50e3, aa = (ra + rp) / 2, va = Math.sqrt(T.mu * (2 / ra - 1 / aa)), qr = reg([ra, 0, 0], [0, 0, -va]);
  const ea = D.upcoming().find(x => x.kind === 'cruise'), sta = D.advanceTo(5);
  check('in flight: a stop seen once is shown but doesn’t stop time again; a return stops at the top of the air, where it waits',
    seenOK && ea && /reaches Tellus's air/.test(ea.text) && ea.stop && sta && sta.kind === 'cruise' && qr.halt && Math.abs(P.day - ea.day) < 1e-3,
    `return: ${ea ? ea.text + ' on day ' + ea.day.toFixed(3) : '—'}; stopped on day ${P.day.toFixed(3)}, halted ${!!qr.halt}`);
}

// econ-16. Station work (economy session, QUEUE Q162, Q9's plan slice 1): resupply, lab time and expansion contracts,
// offered for our stations and judged between flights on the station's state since they were taken.
{
  const D = new Function(src + 'return {CT,genOffer,acceptOffer,selTick,stState,stPick,TELLUS,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], flights: 5, cdone: 0, done: { beeper: { day: 1, flight: 1 } } }); D.chooseStart('agency');
  const R0 = D.TELLUS.R + 400e3, v0 = Math.sqrt(D.TELLUS.mu / R0);
  const st = { id: 51, name: 'Station 1', r: [R0, 0, 0], v: [0, 0, v0], epoch: 0, pending: [], imgs: 0, shape: [{ k: 'hab', crew: 2, res: { sup: 0.35 } }, { k: 'lab' }], attached: [], labDays: 7 };
  P.sats = [st];
  const R = D.rng(5); let o = null; for (let k = 0; k < 400 && !o; k++) { const x = D.genOffer(k % 2 ? 'gov' : 'com', R); if (x && x.type === 'stResupply') o = x; }
  check('station work: a crewed station short of supplies gets a resupply offer, due when they run out, saying why', o && o.p.st === 51 && o.p.days === 35 && o.p.kg === 600 && /35 days of supplies/.test(o.why), o ? `${D.CT[o.type].title(o.p)}: ${o.p.kg} kg in ${o.p.dur} days, ${o.p.pay.toFixed(0)}M; ${o.why}` : 'no offer');
  P.offers = [o]; D.acceptOffer(o.id); const c = P.active[0], f0 = P.funds; D.selTick(); const before = P.active.length;
  st.attached.push({ e: { id: 52, shape: [{ k: 'hab', res: { sup: 0.3 } }] } }); D.selTick(); const half = P.active.includes(c);
  st.attached.push({ e: { id: 54, shape: [{ k: 'hab', res: { sup: 0.3 } }] } }); D.selTick();
  check('station work: the resupply completes once 600 kg have docked (two habitats of 300 kg), not after the first', before === 1 && half && !P.active.includes(c) && P.funds > f0, `paid ${(P.funds - f0).toFixed(0)}M`);
  const lab = { id: 901, type: 'stLab', src: 'sci', client: 0, p: { st: 51, name: 'Station 1', n: 10, pay: 64 }, deadline: P.day + 90 }, exp = { id: 902, type: 'stExpand', src: 'com', client: 0, p: { st: 51, name: 'Station 1', kind: 'lab', pay: 100 }, deadline: P.day + 300 };
  P.offers = [lab, exp]; D.acceptOffer(901); D.acceptOffer(902); st.labDays = 12; D.selTick(); const midLab = P.active.includes(lab), midExp = P.active.includes(exp);
  st.labDays = 17; st.attached.push({ e: { id: 53, shape: [{ k: 'lab' }] } }); D.selTick();
  check('station work: lab time counts lab-days earned since taken; expansion counts a module docked since taken', midLab && midExp && !P.active.includes(lab) && !P.active.includes(exp) && D.stState(51, 'lab') === 2,
    `lab-days 7 → 12 (not yet) → 17 (done); labs ${D.stState(51, 'lab')}`);
}

// econ-17. The first-station firsts (economy session, QUEUE Q163; Q9's plan slice 2): a habitat with two free ports in
// orbit, then a crew aboard, then a lab, then thirty crewed days, judged between flights (world missions), in that order.
{
  const D = new Function(src + 'return {utilTick,stationOf,TELLUS,PROG,HOOK,MISSIONS,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], flights: 5, cdone: 0, staged: {},
    done: { weather: { day: 1, flight: 1 }, beeper: { day: 2, flight: 2 } } }); D.chooseStart('agency');
  const R0 = D.TELLUS.R + 400e3, v0 = Math.sqrt(D.TELLUS.mu / R0);
  const hab = { k: 'hab', i: 0, pos: [0, 0, 0], y0: 0, h: 3.2 }, top = { k: 'port', i: 1, pos: [0, 0, 0], y0: 3.2, h: 0.3 }, side = { k: 'rport', i: 2, pos: [0, 0, 0], y0: 1, h: 0.6, phi: 0 };
  const st = { id: 61, name: 'Station 1', r: [R0, 0, 0], v: [0, 0, v0], epoch: 0, pending: [], imgs: 0, shape: [hab, top, side], attached: [] };
  P.sats = [st]; const step = () => { D.utilTick(1); P.day += 1; return Object.keys(P.done).filter(k => /^station/.test(k)).join(','); };
  const s1 = step(); hab.crew = 2; hab.res = { sup: 0.6 }; const s2 = step(); st.shape.push({ k: 'lab', i: 3, pos: [0, 0, 0], y0: -3.2, h: 3.2 }); const s3 = step();
  for (let k = 0; k < 29; k++) step(); const s4 = step();
  check('first station: a habitat with two free ports, then a crew, then a lab, then thirty crewed days, each a first in turn',
    s1 === 'station1' && s2 === 'station1,stationcrew' && s3 === 'station1,stationcrew,stationlab' && /station30/.test(s4) && news.some(t => /A station/.test(t)),
    `${s1} → ${s2} → ${s3} → ${s4}; ${Math.floor(st.crewDays)} crewed days`);
}

// space-10. Missions in flight, slice 3 (space session, QUEUE Q166): planned burns go with a vessel's entry and come back
// when it's flown; each stops time 3 h ahead; handed to mission control it's flown at its time with the era's error from
// the vessel's own tanks; passed with nobody at the controls it's dropped; a burn out of orbit puts the vessel in flight.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,vesselOf,advanceDays,advanceTo,upcoming,nodeHandOff,elements,skDv,compEra,autoAllowed,TELLUS,PROG,HOOK,DAY_S,BURN_ERR,len};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R, a0 = R + 300e3, vc = Math.sqrt(T.mu / a0);
  const reset = () => { P.sats = []; P.day = 2000; news.length = 0; P.decisions = []; P.active = []; P.dispatch = []; };   // the mainframe era: mission control flies burns (Q127)
  const reg = (dv, t = 30000) => { const s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r: [a0, 0, 0], v: [0, 0, -vc], node: { t, dv: [dv, 0, 0], b: 'Tellus' }, nodeQ: [{ t: t + 9000, dv: [5, 0, 0], b: 'Tellus' }] });
    D.satRegister(s, { day0: 2000 }); return P.sats.at(-1); };
  reset(); const q = reg(50), T0 = 2000 * D.DAY_S, v = D.vesselOf(q, T0 + 500);
  const carried = q.nodes && q.nodes.length === 2 && q.nodes[0].T === T0 + 30000 && v.node && v.node.t === 29500 && v.nodeQ.length === 1 && v.nodeQ[0].t === 38500;
  const ev = D.upcoming().find(x => x.kind === 'burn'), st = D.advanceTo(2010), stDay = P.day;
  check('planned burns: a vessel’s nodes go with its entry and come back in the next flight’s time; the burn is on the timeline and stops time 3 h ahead',
    carried && ev && ev.stop && Math.abs(ev.day - (T0 + 30000 - 3 / 24 * D.DAY_S) / D.DAY_S) < 1e-6 && st && st.kind === 'burn' && Math.abs(stDay - ev.day) < 1e-3,
    `carried ${carried}; ${ev ? ev.text : '—'} on day ${ev ? ev.day.toFixed(3) : '—'}; stopped on day ${stDay.toFixed(3)}`);
  // handed to mission control: flown at its time, with the era's error, from its own tanks; the next one missed
  const e0 = D.elements(q.r, q.v, T.mu), dv0 = D.skDv(q); D.nodeHandOff(q.id); D.advanceDays(2);
  const e1 = D.elements(q.r, q.v, T.mu), want = vc * 2 * (50 / vc), dA = e1.a - e0.a, aExp = e0.a * (1 + 2 * 50 / vc), spent = dv0 - D.skDv(q), er = D.BURN_ERR[D.compEra()];
  const flown = news.some(m => /Mission control flew/.test(m)) && Math.abs(e1.a / aExp - 1) < 3 * er * 2 * 50 / vc + 1e-4 && Math.abs(spent - 50) < 3 * er * 50 + 0.5;
  const missed = news.some(m => /passed with nobody at the controls/.test(m)) && !q.nodes;
  check('planned burns: mission control flies one at its time within the era’s error, paying from the tanks; an unhanded one is missed and dropped',
    flown && missed, `a ${((e0.a - R) / 1e3).toFixed(0)} → ${((e1.a - R) / 1e3).toFixed(1)} km (planned ${((aExp - R) / 1e3).toFixed(1)}); spent ${spent.toFixed(2)} m/s of 50`);
  // a burn out of orbit: the satellite becomes a vessel in flight
  reset(); const qx = reg(2000); D.nodeHandOff(qx.id); D.advanceDays(2);
  check('planned burns: a burn that leaves the orbit puts the vessel in flight', qx.cruise === 1 && D.elements(qx.r, qx.v, T.mu).e > 1, `e ${D.elements(qx.r, qx.v, T.mu).e.toFixed(2)}, in flight ${!!qx.cruise}`);
}

// econ-18. Base work (economy session, Q9's plan slice 3): the station contracts of v1.89.3 for a base too, read with
// baseOf (everything landed within 500 m of the beacon): a resupply is met by landing supplies there.
{
  const D = new Function(src + 'return {CT,genOffer,acceptOffer,selTick,stState,SELENE,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], flights: 5, cdone: 0, done: { beeper: { day: 1, flight: 1 } } }); D.chooseStart('agency');
  const at = (dx) => { const u = [-1, dx / D.SELENE.R, 0], l = Math.hypot(...u); return u.map(x => x / l * D.SELENE.R); };
  const beacon = { id: 71, name: 'Selene Base 1', landed: true, beacon: true, bodyName: 'Selene', pf: at(0), ql: [0, 0, 0, 1], shape: [], pending: [], imgs: 0 };
  const hab = { id: 72, name: 'Selene lander 1', landed: true, bodyName: 'Selene', pf: at(100), ql: [0, 0, 0, 1], shape: [{ k: 'hab', crew: 2, res: { sup: 0.1 } }], pending: [], imgs: 0 };
  P.sats = [beacon, hab];
  const R = D.rng(9); let o = null; for (let k = 0; k < 400 && !o; k++) { const x = D.genOffer(k % 2 ? 'gov' : 'com', R); if (x && x.type === 'stResupply') o = x; }
  check('base work: a crewed base short of supplies gets a resupply offer that says to land the module', o && o.p.st === 71 && o.p.base && /land a module/.test(D.CT.stResupply.brief(o.p)) && o.p.days === 10,
    o ? `${D.CT.stResupply.title(o.p)}: ${o.p.kg} kg in ${o.p.days} days` : 'no offer');
  P.offers = [o]; D.acceptOffer(o.id); const c = P.active[0];
  P.sats.push({ id: 73, name: 'Selene lander 2', landed: true, bodyName: 'Selene', pf: at(300), ql: [0, 0, 0, 1], shape: [{ k: 'hab', res: { sup: 0.3 } }], pending: [], imgs: 0 }); D.selTick(); const half = P.active.includes(c);
  P.sats.push({ id: 74, name: 'Selene lander 3', landed: true, bodyName: 'Selene', pf: at(4000), ql: [0, 0, 0, 1], shape: [{ k: 'hab', res: { sup: 0.6 } }], pending: [], imgs: 0 }); D.selTick(); const far = P.active.includes(c);
  P.sats.push({ id: 75, name: 'Selene lander 4', landed: true, bodyName: 'Selene', pf: at(-200), ql: [0, 0, 0, 1], shape: [{ k: 'hab', res: { sup: 0.3 } }], pending: [], imgs: 0 }); D.selTick();
  check('base work: supplies landed within 500 m count (4 km away doesn\'t); 600 kg completes it', half && far && !P.active.includes(c), `supplies at the base ${D.stState(71, 'sup').toFixed(2)} t`);
}

// space-11. The star system on paper (space session, QUEUE Q87 slice 1): the planets from SYSTEM.md at their real places
// (heliocentric Kepler, no physics yet), for the map from epoch 1. The year fixes the scale; the ecliptic is tilted 23° to
// the equator and turned so the sun on day 0 is where the renderer draws it.
{
  const D = new Function(src + 'return {TU,helioPos,fromTellus,planetPeriod,eclFrame,SYSTEM_BODIES,SUN_DIR,DAY_S,YEAR_D,len,dot,norm,sub};')();
  const yr = n => D.planetPeriod(n) / D.DAY_S / D.YEAR_D, want = { Hesper: 244 / 400, Enyo: 1.87, Astraea: 4.61, Hyperion: 11.9, Erebus: 23.7 };
  const per = Object.entries(want).map(([n, w]) => [n, yr(n), w]), perOK = per.every(([n, y, w]) => Math.abs(y / w - 1) < 0.01);
  check('system: Tellus’s year is exactly 400 days and the planets’ periods are SYSTEM.md’s (Hesper 244 d, Enyo 1.87 y, Astraea 4.61, Hyperion 11.9, Erebus 23.7)',
    Math.abs(yr('Tellus') - 1) < 1e-12 && Math.abs(D.TU() / 15.8e9 - 1) < 0.01 && perOK, per.map(([n, y]) => `${n} ${y.toFixed(2)} y`).join(', ') + `; TU ${(D.TU() / 1e9).toFixed(2)} Gm`);
  const F = D.eclFrame(), tilt = Math.acos(F.N[1]) * 180 / Math.PI, sun0 = D.dot(D.norm(D.fromTellus('Helios', 0)), D.SUN_DIR);
  let inside = true; for (const b of D.SYSTEM_BODIES) for (let k = 0; k < 20; k++) { const r = D.len(D.helioPos(b.name, k * 37.3 * D.DAY_S)), a = b.a * D.TU(); if (r < a * (1 - b.e) * 0.999999 || r > a * (1 + b.e) * 1.000001) inside = false; }
  // Enyo's closest approaches to Tellus over 9 years: their spacing is the synodic period (the launch windows: 2.14 y)
  const dEn = t => D.len(D.fromTellus('Enyo', t)), mins = []; let prev = dEn(0), down = false;
  for (let d = 1; d < 9 * D.YEAR_D; d++) { const x = dEn(d * D.DAY_S); if (x > prev && down) mins.push(d - 1); down = x < prev; prev = x; }
  const gaps = mins.slice(1).map((m, i) => (m - mins[i]) / D.YEAR_D), gapOK = gaps.length >= 2 && gaps.every(g => Math.abs(g - 2.14) < 0.2);
  check('system: the sun on day 0 is the renderer’s, the ecliptic is 23° from the equator, every planet stays between its perihelion and aphelion, Enyo comes close every ~2.14 years',
    sun0 > 1 - 1e-9 && Math.abs(tilt - 23) < 1e-6 && inside && gapOK, `sun ${sun0.toFixed(9)}, tilt ${tilt.toFixed(3)}°, Enyo's closest approaches ${gaps.map(g => g.toFixed(2)).join(', ')} years apart`);
}

// flow-4. The planets on the map (flow session, QUEUE Q175, Q87 slice 1's drawing; PLAYTEST #11): Helios and the five
// other planets, each at fromTellus's place that day, its distance in TU, a disc sized by class (Hyperion biggest,
// Astraea and Erebus at the 2 px floor), its direction laid into the ecliptic for the map's ring, never Tellus itself;
// a planet moves across the sky as the days pass.
{
  const D = new Function(src + 'return {planetMarks,fromTellus,eclFrame,TU,DAY_S,len,dot,norm,sub,mul};')(), N = D.eclFrame().N;
  const T = 123 * D.DAY_S, M = D.planetMarks(T), by = n => M.find(m => m.name === n), names = M.map(m => m.name).join();
  const placeOK = M.every(m => D.len(m.p) > 0 && D.dot(D.norm(m.p), D.norm(D.fromTellus(m.name, T))) > 1 - 1e-12 && Math.abs(m.d - D.len(m.p) / D.TU()) < 1e-12
    && Math.abs(D.len(m.u) - 1) < 1e-12 && Math.abs(D.dot(m.u, N)) < 1e-12 && D.dot(m.u, D.norm(D.sub(m.p, D.mul(N, D.dot(m.p, N))))) > 1 - 1e-12);   // the ring: in the ecliptic, at its longitude
  const pxOK = by('Hyperion').px === 6 && by('Astraea').px === 2 && by('Erebus').px === 2 && by('Hesper').px > by('Enyo').px && by('Helios').px === 7;
  const moved = Math.acos(Math.min(1, D.dot(D.norm(D.planetMarks(T + 60 * D.DAY_S).find(m => m.name === 'Enyo').p), D.norm(by('Enyo').p)))) * 180 / Math.PI;
  check('flow-4: the map has Helios and the five other planets (not Tellus) where they are that day (ring direction in the ecliptic), their distance in TU and a disc by class; Enyo moves across the sky in 60 days',
    names === 'Helios,Hesper,Enyo,Astraea,Hyperion,Erebus' && placeOK && pxOK && Math.abs(by('Helios').d - 1) < 0.02 && moved > 5,
    `${M.map(m => `${m.name} ${m.d.toFixed(2)} TU ${m.px.toFixed(1)} px`).join(', ')}; Enyo moved ${moved.toFixed(1)}° in 60 days`);
}

// space-12. The automation ladder, slice 1 (space session, QUEUE Q127): one table says what each computing era lets run
// as a routine; mission control's burns wait for mainframes, uncrewed runs to the moons for onboard computers, and a
// refusal says which era unlocks it.
{
  const D = new Function(src + 'return {autoAllowed,AUTO_LADDER,compEra,newShip,PRESETS,satRegister,nodeHandOff,PROG,HOOK,TELLUS};')();
  D.HOOK.news = () => {}; const msgs = []; D.HOOK.msg = m => msgs.push(m); D.HOOK.save = () => {};
  const P = D.PROG, at = (day, k) => { P.day = day; return D.autoAllowed(k); };
  const e0 = at(0, 'burn'), e1 = at(2000, 'burn'), m1 = at(2000, 'moon'), m2 = at(3000, 'moon'), a0 = at(0, 'ascent');
  // a hand-off before mainframes is refused with the reason; in their era it goes through
  P.sats = []; P.day = 0; const T = D.TELLUS, a = T.R + 300e3, s = D.newShip(D.PRESETS.Probe);
  Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -Math.sqrt(T.mu / a)], node: { t: 30000, dv: [10, 0, 0], b: 'Tellus' } }); D.satRegister(s, { day0: 0 });
  const q = P.sats.at(-1), r0 = D.nodeHandOff(q.id), mc0 = !!q.nodes[0].mc; P.day = 2000; const r1 = D.nodeHandOff(q.id);
  check('automation ladder: burns by mission control from mainframes, uncrewed moon runs from onboard computers, a flown ascent always; a refusal says which era',
    !e0.ok && /mainframes/.test(e0.why) && e1.ok && !m1.ok && /onboard computers/.test(m1.why) && m2.ok && a0.ok && r0 && r0.refused && !mc0 && r1 === q && q.nodes[0].mc && msgs.some(m => /Mission control needs mainframes/.test(m)),
    `day 0: burn "${e0.why}"; day 2000 (era ${(P.day = 2000, D.compEra())}): burn ${e1.ok}, moon "${m1.why}"; day 3000: moon ${m2.ok}`);
}

// space-13. The link budget, slice 1 (space session, QUEUE Q171, Q51): every link also says its rate (bit/s, the free-space
// law: LINK_K · P · Gt · Gr / d²) and its light delay, without changing which links exist; the rover's path through a
// relay runs at its weaker hop.
{
  const D = new Function(src + 'return {newShip,PRESETS,linkOf,linkRate,LINK_FLOOR,G_STATION,G_WHIP,P_RADIO,curSite,toPF,fromPF,TELLUS,SELENE,bodyPos,rotY,absTh,len,sub,mul,set t(v){simT=v},set ORB_T0(v){ORB_T0=v}};')();
  const T = D.TELLUS, R = T.R; D.t = 0; D.ORB_T0 = 0;
  const r1 = D.linkRate(5, 1, D.G_STATION, 1e6), r2 = D.linkRate(5, 1, D.G_STATION, 2e6);
  // a Probe 300 km straight over the pad (the pad's station sees it), and one around Selene (deep space)
  const u = D.curSite().u, over = D.rotY(D.mul(u, R + 300e3), D.absTh(0)), s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r: over, v: [0, 0, 0] });
  const L = D.linkOf(s), m = D.newShip(D.PRESETS.Probe); Object.assign(m, { alive: true, landed: false, body: D.SELENE, r: [D.SELENE.R + 100e3, 0, 0], v: [0, 0, 0] }); const Ls = D.linkOf(m);
  check('link budget: the rate falls with distance squared; a whip 300 km over the pad gets ~0.3 Mbit/s, one at Selene tens of bit/s, still above the telemetry floor; the delay is the light time',
    Math.abs(r1 / r2 - 4) < 1e-9 && L.ok && L.st && L.rate > 1e5 && L.rate < 1e6 && Math.abs(L.d - 300e3) < 5e3 && Ls.ok && Ls.rate > D.LINK_FLOOR && Ls.rate < 100 && Math.abs(Ls.delay - 2 * Ls.d / 299792458) < 1e-12,
    `over the pad: ${(L.rate / 1e3).toFixed(0)} kbit/s at ${(L.d / 1e3).toFixed(0)} km; at Selene: ${Ls.rate.toFixed(1)} bit/s at ${(Ls.d / 1e6).toFixed(1)} Mm, ${(Ls.delay * 1000).toFixed(0)} ms round trip`);
}

// space-14. The last Debrief survives a reload (QUEUE Q100; space overflow), and a flight left coasting above the air is
// "In flight" in it, not "written off" (it carries on as a cruise entry since v1.90).
{
  const mk = () => new Function(src + 'return {newShip,PRESETS,recNew,missionEnd,debRestore,get DEBRIEF_LAST(){return DEBRIEF_LAST},TELLUS,PROG,HOOK};')();
  const D = mk(); D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {}; D.HOOK.logged = () => {};
  const P = D.PROG, T = D.TELLUS, r0 = T.R + 300e3; P.sats = []; P.day = 0; P.done = P.done || {};
  const ra = T.R + 5000e3, rp = T.R + 50e3, va = Math.sqrt(T.mu * (2 / ra - 2 / (ra + rp))), s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r: [ra, 0, 0], v: [0, 0, -va] });   // high, on a path that comes down
  s.rec = D.recNew(); Object.assign(s.rec, { launched: true, day0: 0 }); D.missionEnd(s);
  const out = s.rec.debrief && s.rec.debrief.outcome, saved = JSON.stringify(P);
  const E = mk(); Object.assign(E.PROG, JSON.parse(saved)); const back = E.debRestore();
  check('debrief: a flight left coasting above the air reads "In flight"; the last Debrief is kept with the save and comes back after a reload',
    out && out.k === 'cruise' && /In flight/.test(out.t) && P.lastDebrief && back && JSON.stringify(back) === JSON.stringify(D.DEBRIEF_LAST) && E.DEBRIEF_LAST === back,
    `outcome ${out ? out.k + ' "' + out.t + ': ' + out.d + '"' : '—'}; restored ${!!back}`);
}

// space-15. Data as a volume (space session, QUEUE Q172, Q51 slice 2): a camera fills its recorder, contact drains it at
// the link's rate and imagery sells per bit received; the far side's slow-scan pictures trickle home; a recorder plays a
// blackout's readings back once the link returns.
{
  const D = new Function(src + 'return {PROG,HOOK,TELLUS,SELENE,DAY_S,advanceDays,CAM_BPS,REC_CAP,FAR_BITS,TLM_BITS,newShip,PRESETS,missionTick,physStep,advRails,linkOf,fromPF,curSite,bodyRel,SUN_DIR,DT,get t(){return simT},set t(v){simT=v},set ORB_T0(v){ORB_T0=v}};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {}; D.HOOK.logged = () => {};
  const P = D.PROG, T = D.TELLUS; D.ORB_T0 = 0;
  const fresh = () => Object.assign(P, { done: { beeper: {} }, cert: {}, atm: {}, streak: 0, flights: 0, funds: 500, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, day: 0, sats: [], satN: 0, wseed: 4242, rel: {}, op: {}, stations: [] });
  const sat = altKm => { fresh(); const r0 = T.R + altKm * 1e3, v = Math.sqrt(T.mu / r0); P.sats.push({ id: 1, name: 'L', epoch: 0, r: [r0, 0, 0], v: [0, v, 0], imgs: 0, pending: [], cam: 1, ant: 1, sci: 0, ballast: 0, bio: 0 });
    for (let k = 0; k < 10; k++) D.advanceDays(2); const q = P.sats[0]; return { q, share: q.got / (D.CAM_BPS * D.DAY_S * 20), contact: q.contact, rate: q.rate }; };
  const lo = sat(300), hi = sat(2000);
  // the far side: a Probe-like craft past Selene's sunlit far side with its picture taken, then in sight of Tellus
  const toT = t => norm(mul(D.bodyRel(D.SELENE, t)[0], -1)); let tF = 0; while (dot(toT(tF), D.SUN_DIR) > -0.6) tF += 3600;
  fresh(); D.t = tF; const rF = 3 * D.SELENE.R, uN = toT(tF), wN = norm(cross(uN, [0, 1, 0])), f = D.newShip(['ant', 'cam', 't2', 'petrel']);
  Object.assign(f, { alive: true, landed: false, body: D.SELENE, r: mul(uN, rF), v: mul(wN, Math.sqrt(D.SELENE.mu / rF)), throttle: 0 }); Object.assign(f.rec, { launched: true, dv: 5000, farPhoto: true });
  let at5 = null; while (D.t < tF + 4 * 3600 && !f.rec.farSent) { D.advRails(f, 60, 1); if (at5 === null && D.t >= tF + 300) at5 = !!f.rec.farSent; }
  const farMin = (D.t - tF) / 60;
  // the recorder: strain logged out of contact (the far side of the planet), then the craft passes over the pad
  D.t = 0; const home = D.curSite(), x = D.newShip(['sci', 'pod']); x.landed = false; x.rec.launched = true;
  x.r = D.fromPF(T, mul(mul(home.u, -1), T.R + 50e3), 0); x.v = [0, 0, 0]; D.physStep(x, D.DT); for (const p of x.order) if (p.on && p.sk1) { p.sf1 = 0.3; p.sf2 = 0.3; } x.rec.lkT = undefined; D.missionTick(x, D.DT, true);
  const nRec = Object.keys(x.rec.sfRec || {}).length; for (const p of x.order) if (p.on && p.sk1) { p.sf1 = 0; p.sf2 = 0; }
  x.r = D.fromPF(T, mul(home.u, T.R + 300e3), 0); x.rec.lkT = undefined; for (let i = 0; i * D.DT < 1; i++) D.missionTick(x, D.DT, true);   // a second of playback
  const back = Object.keys(x.rec.sf).length, left = Object.keys(x.rec.sfRec).length;
  check('data as a volume: a 300 km camera downlinks about its contact share of a day\'s take (sales as before); at 2,000 km it\'s seen longer but drains far less; the recorder never overfills',
    lo.share > 0.7 * lo.contact && lo.share < 1.05 * lo.contact && hi.contact > 2 * lo.contact && hi.share < 0.5 * lo.share && lo.q.rec <= D.REC_CAP && hi.q.rec <= D.REC_CAP,
    `300 km: contact ${(lo.contact * 100).toFixed(1)}% at ${(lo.rate / 1e3).toFixed(0)} kbit/s → ${(lo.share * 100).toFixed(1)}% of the take home; 2,000 km: ${(hi.contact * 100).toFixed(1)}% at ${(hi.rate / 1e3).toFixed(1)} kbit/s → ${(hi.share * 100).toFixed(1)}%`);
  check('data as a volume: the far side\'s pictures trickle home from Selene (not in the first 5 minutes, done within an hour); a blackout\'s readings play back once the link returns',
    f.rec.farSent && at5 === false && farMin < 60 && f.rec.farGot >= D.FAR_BITS && nRec > 0 && back === nRec && left === 0,
    `far side home after ${farMin.toFixed(0)} min (${(D.FAR_BITS / 1e3).toFixed(0)} kbit); recorder: ${nRec} readings held out of contact, ${back} played back over the pad`);
}

// econ-19. Rendezvous and retrieval (economy session, QUEUE Q180; Q9's plan slice 4): a rendezvous is a near pass during
// the flight (within 100 m, under 1 m/s, sampled each tick); a retrieval lands a dead satellite at home stowed in a
// closed bay, and its hardware comes back refurbished. Retrieval waits for the first docking (stationcrew).
{
  const D = new Function(src + 'return {CT,genOffer,contractEval,rdvTick,rdvTarget,retrieveTarget,satAt,progT,compEra,TELLUS,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, T = D.TELLUS; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], flights: 5, cdone: 0, done: { beeper: { day: 1, flight: 1 } } }); D.chooseStart('agency');
  const r0 = T.R + 400e3, v0 = Math.sqrt(T.mu / r0);
  const stage = { id: 81, name: 'Spent stage 1', junk: true, r: [r0, 0, 0], v: [0, v0, 0], epoch: 0, pending: [], imgs: 0 };
  const dead = { id: 82, name: 'Beeper 2', sci: 1, r: [0, r0, 0], v: [-v0, 0, 0], epoch: 0, era: 0, pending: [], imgs: 0, shape: [{ k: 'core' }, { k: 'bat' }, { k: 'ant' }, { k: 'tank' }] };
  const tv = { id: 83, name: 'TV 1', ant: 1, tvOn: true, r: [-r0, 0, 0], v: [0, -v0, 0], epoch: 0, era: 0, pending: [], imgs: 0, shape: [{ k: 'core' }, { k: 'ant' }] };
  P.sats = [stage, dead, tv]; const e0 = D.compEra(); while (D.compEra() < 1 && P.day < 20000) P.day += 50;
  const kinds = R => { const n = {}; for (let k = 0; k < 300; k++) { const o = D.genOffer('gov', R); if (o) n[o.type] = (n[o.type] || 0) + 1; } return n; };
  const n0 = kinds(D.rng(3)); P.done.stationcrew = { day: 5, flight: 4 }; const n1 = kinds(D.rng(3));
  check('rendezvous offered for spent hardware; retrieval only after the first docking, for a dead satellite, never for one still earning',
    n0.rdv > 0 && !n0.retrieve && n1.retrieve > 0 && D.rdvTarget() === stage && D.retrieveTarget() === dead, `era ${e0}→${D.compEra()}; before ${JSON.stringify(n0)}; after ${JSON.stringify(n1)}`);
  // rendezvous: a far pass and a fast pass don't count; a slow one within 100 m does
  const c = { id: 991, type: 'rdv', src: 'gov', client: 0, p: { sat: 81, name: stage.name, pay: 100, dur: 300 }, deadline: P.day + 300 }; P.active = [c];
  const R = { launched: true, day0: P.day, cdone: [], paid: [] }, s = { rec: R, alive: true, landed: false, body: T };
  const [r, v] = D.satAt(stage, D.progT(s)), at = (d, dv) => { s.r = [r[0] + d, r[1], r[2]]; s.v = [v[0], v[1] + dv, v[2]]; D.rdvTick(s, R); D.contractEval(s); return P.active.includes(c); };
  const far = at(150, 0), fast = at(50, 3), near = at(50, 0.4);
  check('rendezvous: within 100 m under 1 m/s completes it (150 m or 3 m/s don\'t)', far && fast && !near, `${far} ${fast} ${near}`);
  // retrieval: landed home with it in a closed bay; held on a port, or with the doors open, doesn't count
  const w = D.CT.retrieve.gen(D.rng(2)), k = { id: 992, type: 'retrieve', src: 'gov', client: 0, p: w, deadline: P.day + 500 }; P.active = [k];
  const bay = { open: false }, s2 = { rec: { cdone: [], paid: [] }, alive: true, landed: true, body: T, parts: [bay], att: [{ kind: 'port', e: dead, hpi: 0 }] };
  D.contractEval(s2); const onPort = P.active.includes(k); s2.att[0].kind = 'bay'; bay.open = true; D.contractEval(s2); const open = P.active.includes(k);
  bay.open = false; const f0 = P.funds; D.contractEval(s2);
  check('retrieval: landed home in a closed bay completes it and pays its hardware back (on a port or with the doors open: no)',
    onPort && open && !P.active.includes(k) && w.worth >= 8 && P.funds - f0 > w.pay + w.worth - 1e-6 && s2.rec.paid.some(x => x.k === 'refurb'), `pay ${w.pay}M + hardware ${w.worth}M; got ${(P.funds - f0).toFixed(1)}M`);
}

// qa-3. TESTING.md's row numbers (QA session, LESSONS #37): sessions number rows at once and collide (131, 133, 134 and
// 168 were each used twice). Every row number once, and "Next free number" above them all, so a collision fails here.
{
  const T = readFileSync(new URL('./TESTING.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const nums = [...T.matchAll(/^\| [✓~✗ ]*(\d+)(?: \(robot\))?(?: → P#\d+)? \|/gm)].map(m => +m[1]), seen = new Set(), dup = [...new Set(nums.filter(n => seen.has(n) || !seen.add(n)))];
  const next = +((T.match(/Next free number: \*\*(\d+)\*\*/) || [])[1] || 0);
  check('TESTING.md: every row number is used once, and "Next free number" is above them all', nums.length > 100 && !dup.length && next > Math.max(...nums),
    `${nums.length} rows, highest ${Math.max(...nums)}, next free ${next}; doubled: ${dup.join(', ') || 'none'} (renumber the newer row, fix its references)`);
}

// qa-4. Debris by hand (QA session, QUEUE Q161): the tester's breakup, ASAT test and clutter put fragments and dead stages
// where they say; below the air nothing happens. Own SIM copy.
{
  const D = new Function(src + 'return {TEST,testBreakup,testAsat,testClutter,fragBands,fragsOf,BAND_W,PROG,TELLUS,POWERS,HOOK,elements,satsUp};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG; Object.assign(P, { day: 0, frag: null }); delete P.sats; delete P.satN; D.TEST.on = true;   // a fresh program has neither
  const tot = () => D.fragBands().reduce((a, b) => a + b, 0), b400 = Math.floor((400e3 - D.TELLUS.atm) / D.BAND_W);
  const n1 = D.testBreakup(400, 1), t1 = tot(), peak = D.fragBands().indexOf(Math.max(...D.fragBands())), none = D.testBreakup(60, 1) + D.testAsat(50) + D.testClutter(10, 80);
  const n2 = D.testAsat(800), t2 = tot();
  check('tester debris: a 1 t breakup at 400 km adds NASA\'s 46,774 fragments, thickest in the 400 km band; an ASAT test names a foreign power; below the air nothing',
    Math.abs(n1 - D.fragsOf(1000)) < 1 && Math.abs(t1 - n1) < n1 * 0.02 && Math.abs(peak - b400) <= 1 && none === 0 && t2 > t1 && news.some(m => /tests an anti-satellite weapon at 800 km/.test(m)) && !news.some(m => /Tester: a 1 t breakup at 60/.test(m)),
    `${Math.round(n1)} fragments (in the bands ${Math.round(t1)}), peak band ${peak} (400 km is ${b400}); ASAT ${Math.round(n2)}; news: ${news.find(m => /anti-satellite/.test(m)) || 'none'}`);
  const k = D.testClutter(50, 800), J = P.sats.filter(q => q.junk), hs = J.map(q => { const el = D.elements(q.r, q.v, D.TELLUS.mu); return (el.a - D.TELLUS.R) / 1e3; });
  check('tester debris: clutter adds dead 2 t stages near the height, on many planes', k === 50 && J.length === 50 && J.every(q => q.mass === 2000) && Math.min(...hs) > 770 && Math.max(...hs) < 830 && new Set(J.map(q => Math.round(Math.acos(q.r[1] / Math.hypot(...q.r)) * 10))).size > 20,
    `${k} added, heights ${Math.min(...hs).toFixed(0)}–${Math.max(...hs).toFixed(0)} km`);
  D.TEST.on = false;
}

// qa-5. The tester's school picker (QA session, QUEUE Q106): Auto plus every school in SCHOOLS; the ones without a look
// yet are disabled, and a pick sets SCHOOL_FORCE and redraws the ship.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('tester: the school picker lists Auto and every school, and a pick sets SCHOOL_FORCE and rebuilds the ship',
    /data-test-school="\$\{k\}"/.test(pg) && /\['auto',\.\.\.Object\.keys\(SCHOOLS\)\]/.test(pg) && /if\(d\.testSchool\)\{SCHOOL_FORCE=[^}]*HOOK\.rebuild\(\)/.test(pg));
}

// ==== END OF SECTIONS (shards.mjs: new sections go above this line; everything below runs in every shard)
function moonPos(t) { return api.moonPos(t); }
console.log(log.slice(0, 12).join('\n'));
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
