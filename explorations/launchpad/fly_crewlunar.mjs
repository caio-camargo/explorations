// A crewed Selene landing and return, flown end to end on the Crewed Lunar preset through the game's own physics (bodies
// session, 2026-10-08). The attitude is set directly (this tests the vehicle and the physics, not piloting); everything
// else (thrust, staging, aero, heating, the moons' pull, rails, the predictor, the crew's limits) is the game's.
//   node fly_crewlunar.mjs        prints the flight log          test.mjs section 27 runs it and checks every leg
// Flight plan: ascent (vertical to 200 m, flat by 38 km) / transfer at the Hohmann phase angle / a mid-course correction
// found with the predictor (40 km pass) / capture into a low orbit, periapsis raised at apoapsis / braking at periapsis,
// then a suicide burn (the lander is dropped high if it can't finish the descent) / ascent on the return stage (pitch over
// by 3 km: no air) / the burn home, chosen by scanning burn point and size for a 45 km Tellus perigee / a correction aimed
// at the integrated path's lowest point / drop the return stage, shield first, chute.
export function crewLunar(api, say = () => {}) {
  const { TELLUS, SELENE, len, norm, add, sub, mul, dot, cross, elements } = api;
  const log = (...a) => say(`[${(api.t / 3600).toFixed(2)} h] ` + a.join(' ')), R = {};
  const msgs = []; api.HOOK.msg = m => { msgs.push(m); if (!/Logbook/.test(m)) log('msg:', m); }; api.HOOK.news = m => { if (/crew|Crew|Selene|✔/.test(m)) log('news:', m); }; api.HOOK.save = () => {};
  const P = api.PROG; P.funds = 1e5; P.active = []; P.done = Object.fromEntries(['beeper', 'orbiter', 'padabort', 'maxqabort', 'farside', 'selimp', 'selland', 'crewaround'].map(k => [k, { flight: 0, day: 0 }]));
  const ATM = TELLUS.atm, AS = ATM / 7e4;
  api.t = 0; const s = api.newShip(api.PRESETS['Crewed Lunar']); api.S = s; s.sas = false;
  // attitude set directly: nose (+Y) along dir, keeping roll stable
  const point = dir => { const Y = norm(dir), ref = Math.abs(Y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], X = norm(cross(Y, ref)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  let capTmax = 0, capTt = 0, cabMax = 0;
  let autoStage = true;
  const phys = () => {{const c = s.parts.find(p => p.on && p.d.crew); if (c && c.T > capTmax) { capTmax = c.T; capTt = api.t; } cabMax = Math.max(cabMax, s.rec.ccab || 0);} if (autoStage && s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) { log('staging (empty)'); api.stage(s); } api.advPhys(s); };
  const coast = (dt, warp = 1000) => { const t1 = api.t + dt; while (api.t < t1 - 1e-6 && s.alive) { if (api.railsOK(s)) api.advRails(s, Math.min(t1 - api.t, 600), warp); else phys(); } };
  // burn an inertial Δv vector with the engines (finite burn; staging when a stage runs dry); returns Δv delivered
  function burn(dv, thr = 1, dirFn = null) { const need = len(dv), d = norm(dv); let got = 0, k = 0; s.throttle = thr;
    while (got < need - 0.05 && s.alive && k++ < 2e6) { point(dirFn ? dirFn() : d); const v0 = s.v.slice(), b0 = s.body; phys(); if (s.body === b0 && s.thrust > 0) got += s.thrust / s.mass * api.DT;
      if (need - got < 30 && thr > 0.1) s.throttle = Math.max(0.05, thr * (need - got) / 30); }
    s.throttle = 0; return got; }
  function burnUntil(done, dirFn, thr = 1) { let k = 0; s.throttle = thr; while (!done() && s.alive && k++ < 2e6) { point(dirFn()); phys(); } s.throttle = 0; }
  // --- 1. ascent: vertical to 200 m, flat by 38 km; then circularise at apoapsis
  { let phase = 'ascent', g = 0; s.throttle = 1; api.stage(s);
    const pt = p => { const f = api.localFrame(s.r), r = p * Math.PI / 180; point(add(mul(f.e, Math.cos(r)), mul(f.up, Math.sin(r)))); };
    while (g++ < 400000 && s.alive) { const h = len(s.r) - TELLUS.R, el = elements(s.r, s.v, TELLUS.mu);
      if (phase === 'ascent') { const f = Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))); pt(90 * (1 - Math.pow(f, 0.6))); if (el.ap - TELLUS.R > ATM + 10000) { s.throttle = 0; phase = 'coast'; } }
      else if (phase === 'coast') { pt(0); if (h > ATM && el.ap - TELLUS.R < ATM + 9500) s.throttle = 0.3; else if (h < ATM) s.throttle = el.ap - TELLUS.R < ATM + 10000 ? 0.2 : 0; else s.throttle = 0; if (h > ATM && api.timeToNu(el, Math.PI) < 25) phase = 'circ'; }
      else { const f = api.localFrame(s.r); point(sub(s.v, mul(f.up, dot(s.v, f.up)))); s.throttle = 1; if (el.pe - TELLUS.R > ATM + 2000) { s.throttle = 0; break; } }
      phys(); }
    const el = elements(s.r, s.v, TELLUS.mu); log('ORBIT', ((el.pe - TELLUS.R) / 1e3).toFixed(0), '×', ((el.ap - TELLUS.R) / 1e3).toFixed(0), 'km; Δv left by stage', api.dvPlan(s, 0).map(x => x.dv.toFixed(0)).join(' / '), '; tower', s.parts.some(p => p.on && p.d.kind === 'les') ? 'ON' : 'gone', '; crewed', s.rec.crewed, '; capsule skin max', capTmax.toFixed(0), 'K at', capTt.toFixed(0), 's; cabin max', cabMax.toFixed(0), 'K'); R.orbit = { pe: el.pe - TELLUS.R, left: api.dvPlan(s, 0).map(x => x.dv), cabin: cabMax, tower: s.parts.some(p => p.on && p.d.kind === 'les') }; }
  // --- 2. transfer: wait for the phase angle, burn prograde (centred on the right moment), then refine with the predictor
  const ang = r => Math.atan2(-r[2], r[0]);   // angle in the equator, prograde positive
  const selene = t => api.bodyRel(SELENE, t)[0];
  { const r0 = len(s.r), a = (r0 + SELENE.a) / 2, tof = Math.PI * Math.sqrt(a ** 3 / TELLUS.mu), phi = Math.PI - SELENE.n * tof;
    const vc = Math.sqrt(TELLUS.mu / r0), dvH = Math.sqrt(TELLUS.mu * (2 / r0 - 1 / a)) - vc, acc = api.activeEngines(s).length ? 0 : 0;
    const tb = dvH / (65000 / s.mass) /* rough burn time on the Petrel */, wn = vc / r0 - SELENE.n;
    let lead = ((ang(selene(api.t)) - ang(s.r) - phi) % (2 * Math.PI) + 4 * Math.PI) % (2 * Math.PI), wait = lead / wn - tb / 2;
    if (wait < 0) wait += 2 * Math.PI / wn;
    log(`transfer: Hohmann +${dvH.toFixed(0)} m/s, ${(tof / 3600).toFixed(1)} h; burn ~${tb.toFixed(0)} s; waiting ${(wait / 60).toFixed(0)} min`);
    coast(wait);
    burnUntil(() => elements(s.r, s.v, TELLUS.mu).ap >= SELENE.a * 0.995, () => s.v, 1);
    const el = elements(s.r, s.v, TELLUS.mu), p = api.predict(s);
    log('after TLI: ap', (el.ap / 1e3).toFixed(0), 'km; legs', p.map(x => x.b.name + (x.endKind ? '→' + x.endKind : '')).join(' '), p[1] ? 'Selene pe ' + ((p[1].minR ?? p[1].el.pe) / 1e3 - SELENE.R / 1e3).toFixed(0) + ' km' : '');
  }
  // --- helpers for corrections: find an impulse (prograde/normal/radial) that puts a predicted quantity on target
  function frame() { const pro = norm(s.v), nrm = norm(cross(s.r, s.v)), rad = norm(cross(s.v, nrm)); return { pro, nrm, rad }; }
  function solve(score, step0 = 4, maxDv = 200) { const f = frame(), toW = d => add(add(mul(f.pro, d[0]), mul(f.nrm, d[1])), mul(f.rad, d[2]));
    let d = [0, 0, 0], best = score(toW(d)), step = step0;
    for (let it = 0; it < 120 && step > 0.02; it++) { let improved = false;
      for (const ax of [0, 2, 1]) for (const sg of [1, -1]) { const c = d.slice(); c[ax] += sg * step; if (len(c) > maxDv) continue; const v = score(toW(c)); if (v < best) { best = v; d = c; improved = true; } }
      if (!improved) step /= 2; }
    return { dv: toW(d), d, err: best }; }
  const seleneLeg = p => p.find(x => x.b === SELENE);
  const selPe = p => { const L = seleneLeg(p); return L ? L.el.pe - SELENE.R : null; };   // osculating at SOI entry: negative when it would hit (a gradient to follow)
  const scoreSel = target => dv => { const p = api.predictFrom({ b: s.body, r: s.r, v: add(s.v, dv), t: api.t }); const pe = selPe(p); return pe == null ? 1e9 : Math.abs(pe - target) + 0.01 * len(dv); };
  // --- 3. mid-course correction to a 40 km pass, coast to Selene, capture into a low orbit
  coast(2 * 3600);
  { const sol = solve(scoreSel(40e3)); R.mcc = len(sol.dv); log('MCC:', sol.d.map(x => x.toFixed(2)).join(', '), 'm/s (pro, nrm, rad); predicted pe error', (sol.err / 1e3).toFixed(1), 'km'); burn(sol.dv, 0.3); }
  { const p = api.predict(s); log('after MCC: Selene pe', (selPe(p) / 1e3).toFixed(1), 'km'); }
  while (s.body !== SELENE && s.alive && api.t < 40 * 3600) coast(600);
  log('in Selene SOI; pe', ((elements(s.r, s.v, SELENE.mu).pe - SELENE.R) / 1e3).toFixed(1), 'km');
  // trim the pass again from inside the SOI (cheap there), then capture at periapsis
  { const sol = solve(dv => { const el = elements(s.r, add(s.v, dv), SELENE.mu); return Math.abs(el.pe - SELENE.R - 40e3) + 0.01 * len(dv); }, 2, 100); burn(sol.dv, 0.2); }
  { const el = elements(s.r, s.v, SELENE.mu), vp = Math.sqrt(SELENE.mu * (2 / el.pe - 1 / el.a)), vc = Math.sqrt(SELENE.mu / el.pe), tb = (vp - vc) / (65000 / s.mass);
    log('pass at', ((el.pe - SELENE.R) / 1e3).toFixed(1), 'km; capture', (vp - vc).toFixed(0), 'm/s, ~', tb.toFixed(0), 's');
    coast(Math.max(0, api.timeToNu(el, 0) - tb / 2), 100);
    burnUntil(() => { const e = elements(s.r, s.v, SELENE.mu); return e.e < 1 && e.ap - SELENE.R < 200e3; }, () => mul(s.v, -1), 1);
    const e = elements(s.r, s.v, SELENE.mu); R.capture = { pe: e.pe - SELENE.R, ap: e.ap - SELENE.R, left: api.dvPlan(s, 0).map(x => x.dv) }; log('SELENE ORBIT', ((e.pe - SELENE.R) / 1e3).toFixed(0), '×', ((e.ap - SELENE.R) / 1e3).toFixed(0), 'km; Δv left', api.dvPlan(s, 0).map(x => x.dv.toFixed(0)).join(' / ')); }
  // raise a periapsis the finite capture burn dragged down: at apoapsis, burn along the horizontal
  const fixPe = (mu, R, minAlt) => { let e = elements(s.r, s.v, mu); if (e.pe - R >= minAlt) return; coast(api.timeToNu(e, Math.PI), 100);
    burnUntil(() => elements(s.r, s.v, mu).pe - R >= minAlt, () => { const up = norm(s.r); return sub(s.v, mul(up, dot(s.v, up))); }, 0.3);
    e = elements(s.r, s.v, mu); log('periapsis raised:', ((e.pe - R) / 1e3).toFixed(0), '×', ((e.ap - R) / 1e3).toFixed(0), 'km'); };
  fixPe(SELENE.mu, SELENE.R, 30e3);
  // --- 4. landing: brake at periapsis (retrograde), then a vertical descent that slows toward the ground
  const aMax = () => api.activeEngines(s).reduce((a, p) => a + p.d.thrust * 1000, 0) / s.mass;
  { const e = elements(s.r, s.v, SELENE.mu); coast(Math.max(0, api.timeToNu(e, 0) - 60), 100); let k = 0; s.throttle = 1;
    while (!s.landed && s.alive && k++ < 400000) { const up = norm(s.r), vv = dot(s.v, up), vhv = sub(s.v, mul(up, vv)), vh = len(vhv), hb = len(s.r) - SELENE.R + s.yBot, g = SELENE.mu / dot(s.r, s.r), A = Math.max(aMax(), 0.1);
      if (k % 1000 === 0) log('descent', (hb / 1e3).toFixed(2), 'km, vv', vv.toFixed(1), 'vh', vh.toFixed(1), 'stage dv', api.dvRemaining(s).cur.toFixed(0), 'thr', s.throttle.toFixed(2), 'A', A.toFixed(2));
      if (vh <= 15 && s.parts.some(p => p.on && p.d.key === 'petrel') && hb > 1500 && api.dvRemaining(s).cur < 1.15 * Math.sqrt(2 * g * hb + vv * vv)) { log('lander short for the descent at', (hb / 1e3).toFixed(1), 'km (', api.dvRemaining(s).cur.toFixed(0), 'm/s left): dropping it, finishing on the return stage'); api.stage(s); continue; }
      if (vh > 15) { point(mul(s.v, -1)); s.throttle = 1; }   // braking: kill the orbital speed
      else { point(sub(mul(up, 1), mul(vhv, 0.08)));
        if (hb > 30) { const need = vv < 0 ? vv * vv / (2 * Math.max(hb - 15, 1)) + g : 0; s.throttle = need > 0.85 * A ? Math.min(1, need / A) : 0; }   // suicide burn: fall until the stop needs 85 % of full thrust
        else { const vt = -Math.max(1.2, 0.08 * hb); s.throttle = Math.min(1, Math.max(0, (g + 1.5 * (vt - vv)) / A)); } }   // the last 30 m, gently
      phys(); }
    s.throttle = 0; const tilt = Math.acos(Math.min(1, dot(norm(api.qrot(s.q, [0, 1, 0])), norm(s.r)))) * 57.3;
    R.landing = { landed: s.landed, v: s.touchV || s.crashSpeed || 0, tilt, left: api.dvPlan(s, 0).map(x => x.dv), crewSelLand: !!s.rec.crewSelLand };
    log(s.landed ? 'LANDED ON SELENE' : 'landing failed', 'at', (s.touchV || s.crashSpeed || 0).toFixed(2), 'm/s, tilt', tilt.toFixed(1), '°; Δv left', api.dvPlan(s, 0).map(x => x.dv.toFixed(0)).join(' / '), '; crewOK', s.rec.crewOK, 'crewSelLand', s.rec.crewSelLand); }
  // --- 5. ascent to a low Selene orbit on the return stage (the lander stays behind)
  autoStage = false;   // from here on the return stage is the last one with an engine: never stage the capsule loose
  coast(600, 1);   // ten minutes on the surface
  while (s.parts.some(p => p.on && p.d.key === 'petrel') && s.evIdx < s.events.length) { log('staging to leave the lander'); api.stage(s); }
  { let k = 0; s.throttle = 1; const east = () => norm(cross([0, 1, 0], s.r));
    while (s.alive && k++ < 400000) { const up = norm(s.r), h = len(s.r) - SELENE.R, e = elements(s.r, s.v, SELENE.mu), pitch = Math.max(0, 90 - 90 * Math.min(1, h / 3e3)) * Math.PI / 180;   // no air: pitch over almost at once
      point(add(mul(up, Math.sin(pitch)), mul(east(), Math.cos(pitch)))); if (e.ap - SELENE.R > 20e3) break; phys(); }
    s.throttle = 0; fixPe(SELENE.mu, SELENE.R, 15e3); const e = elements(s.r, s.v, SELENE.mu); R.ascent = { pe: e.pe - SELENE.R, left: api.dvPlan(s, 0).map(x => x.dv) }; log('BACK IN SELENE ORBIT', ((e.pe - SELENE.R) / 1e3).toFixed(0), '×', ((e.ap - SELENE.R) / 1e3).toFixed(0), 'km; Δv left', api.dvPlan(s, 0).map(x => x.dv.toFixed(0)).join(' / ')); }
  // --- 6. home: pick the burn point and size for a Tellus periapsis 45 km up, burn, correct on the way, re-enter shield-first
  const tellPe = p => { const L = p.find((x, i) => i > 0 && x.b === TELLUS); return L ? L.el.pe - TELLUS.R : null; };
  { const e = elements(s.r, s.v, SELENE.mu), Pd = e.period; let best = null;
    for (let i = 0; i < 48; i++) { const dt = Pd * i / 48, [r, v] = api.kepler(s.r, s.v, dt, SELENE.mu);
      for (let dv = 300; dv <= 700; dv += 10) { const p = api.predictFrom({ b: SELENE, r, v: add(v, mul(norm(v), dv)), t: api.t + dt }), pe = tellPe(p); if (pe == null) continue;
        const sc = Math.abs(pe - 45e3) + 20 * dv; if (!best || sc < best.sc) best = { sc, dt, dv, pe }; } }
    log('trans-Tellus burn: in', (best.dt / 60).toFixed(0), 'min, ~', best.dv, 'm/s, predicted Tellus pe', (best.pe / 1e3).toFixed(0), 'km');
    const [r1, v1] = api.kepler(s.r, s.v, best.dt, SELENE.mu), vinf2 = dot(v1, v1) + 2 * best.dv * len(v1) + best.dv ** 2 - 2 * SELENE.mu / len(r1);   // target specific energy ×2
    coast(Math.max(0, best.dt - best.dv / aMax() / 2), 100);
    burnUntil(() => dot(s.v, s.v) - 2 * SELENE.mu / len(s.r) >= vinf2, () => s.v, 1);
    log('after the burn: predicted Tellus pe', (tellPe(api.predict(s)) / 1e3).toFixed(0), 'km; Δv left', api.dvPlan(s, 0).map(x => x.dv.toFixed(0)).join(' / ')); }
  while (s.body !== TELLUS && s.alive) coast(600);
  coast(4 * 3600);
  const perigee = p => (p[0].path ? p[0].minR : p[0].el.pe) - TELLUS.R;   // the integrated path's lowest point (the moons' tides move it ~30 km on the way in)
  { const sol = solve(dv => { const p = api.predictFrom({ b: TELLUS, r: s.r, v: add(s.v, dv), t: api.t }); return Math.abs(perigee(p) - 45e3) + 0.01 * len(dv); }, 4, 300);
    R.retCorr = len(sol.dv); log('return correction', len(sol.dv).toFixed(1), 'm/s; predicted lowest point', (sol.err / 1e3).toFixed(1), 'km off 45'); burn(sol.dv, 0.3); log('after: predicted lowest point', (perigee(api.predict(s)) / 1e3).toFixed(1), 'km'); }
  while (s.alive && len(s.r) - TELLUS.R > 3e6) coast(600);
  while (s.alive && s.evIdx < s.events.length && s.parts.some(p => p.on && p.d.kind === 'engine')) { log('staging: drop the return stage'); api.stage(s); }
  while (s.alive && s.evIdx < s.events.length) api.stage(s);   // arm the chute
  { let k = 0, inAir = false, passes = []; while (s.alive && !s.landed && k++ < 3e6) { const h = len(s.r) - TELLUS.R; if (h < TELLUS.atm && !inAir) { inAir = true; passes.push({ t: api.t, min: h }); } if (inAir) { passes[passes.length - 1].min = Math.min(passes[passes.length - 1].min, h); if (h > TELLUS.atm) inAir = false; }
      if (api.railsOK(s)) api.advRails(s, 10, 100); else { point(mul(sub(s.v, api.surfVel(TELLUS, s.r)), -1)); phys(); } }
    R.passes = passes.map(p => p.min); log('atmosphere passes:', passes.map(p => (p.t / 3600).toFixed(1) + ' h down to ' + (p.min / 1e3).toFixed(0) + ' km').join('; '));
    const Rc = s.rec; Object.assign(R, { home: s.landed && s.alive && s.body === TELLUS, touch: s.touchV || s.crashSpeed || 0, crewed: Rc.crewed, crewOK: Rc.crewOK, g: Rc.cgMax, cabin: Rc.ccab, days: api.t / 86400, done: !!P.done.crewland }); log(s.landed ? 'HOME' : 'LOST', 'touchdown', (s.touchV || s.crashSpeed || 0).toFixed(1), 'm/s; crew', Rc.crewOK ? 'OK' : 'NOT OK', '; peak', Rc.cgMax.toFixed(1), 'g; cabin max', Rc.ccab.toFixed(0), 'K; flight', (api.t / 86400).toFixed(1), 'days; crewland done:', !!P.done.crewland); }


  return R;
}
// run directly: build the SIM from index.html and print the log
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('fly_crewlunar.mjs')) {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
  const api = new Function(src + `return {PRESETS,TELLUS,SELENE,newShip,stage,advPhys,advRails,railsOK,localFrame,qFromBasis,qrot,elements,timeToNu,kepler,predict,predictFrom,dvRemaining,dvPlan,activeEngines,bodyRel,surfVel,HOOK,PROG,DT,len,norm,add,sub,mul,dot,cross,
    get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)();
  const R = crewLunar(api, m => console.log(m)); console.log(JSON.stringify(R, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
}
