// tests/vehicle.mjs — test sections: vehicle (and control). Not a module on its own: shards.mjs splices every file in tests/ (in the
// order of TEST_FILES) between test.mjs's prelude (the SIM as `api`, `check`) and its summary, and runs that as one module.
// Add a section at the end of your lane's file: "// <lane>-<n>. Title" at column 0, then a { block }. NOTES § "Test shards".

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

// vehicle-3. The first orbit missions fly on presets (vehicle session, QUEUE Q74 / PLAYTEST #24): the Beeper puts an
// instrument package in orbit; the Passenger Orbiter takes a biocapsule once round and home, inside the passenger's limits.
// The limits are the game's own, from the flight record over the whole flight (`S.rec`: missionTick's cabin from liftoff),
// so a cabin cooked on the way up fails here as it does in play (Q201, PLAYTEST #35). The Passenger Orbiter is also stable at
// roll out (no "Aerodynamically unstable" line: its nose cone needs the second fin ring), and it comes home on the first
// hour's avionics: the Gyro autopilot holds retrograde (Q216, PLAYTEST #38); off retrograde the passenger cooks.
{
  const R = TELLUS.R, O = api.PRESETS.Orbiter, el = s => api.elements(s.r, s.v, TELLUS.mu);
  const b = handAscent(api, api.PRESETS.Beeper), eb = el(b);
  const p = handAscent(api, api.PRESETS['Passenger Orbiter']), ep = el(p), dvP = api.dvRemaining(p).cur, cabUp = p.rec.cabin, msgs = [], s0 = api.newShip(api.PRESETS['Passenger Orbiter']), A0 = api.analyze(s0), cal = Math.min(...[A0.ful, A0.sup].map(x => (x.ycm - x.ycp) / (2 * s0.radius))); api.HOOK.msg = m => msgs.push(m);
  api.advRails(p, ep.period, 10);   // once round
  const retro = () => { const v = mul(norm(p.v), -1), f = api.localFrame(p.r), X = norm(cross(v, f.n)); p.q = api.qFromBasis(X, v, cross(X, v)); p.w = [0, 0, 0]; };
  p.throttle = 1; for (let k = 0; k < 20000 && p.alive; k++) { retro(); api.advPhys(p); if (el(p).pe - R < 40e3 || api.dvRemaining(p).cur < 1) break; }
  p.throttle = 0; p.av = 0; p.sas = true; p.sasMode = 'retro'; const gyro = api.avOf(p), bio = p.parts.find(q => q.d.kind === 'bio'), PR = p.rec; let cab = cabUp, armed = false;
  for (let k = 0; k < 2e6 && p.alive && !p.landed; k++) { const h = len(p.r) - R; if (h > TELLUS.atm + 5e3) { api.advRails(p, 20, 10); cab = Math.max(cab, PR.cabin); continue; }
    api.advPhys(p); cab = Math.max(cab, PR.cabin);
    if (!armed && h < 20e3) { armed = true; while (p.evIdx < p.events.length) api.stage(p); } }
  check('presets: the Beeper puts its instrument package in a stable orbit; the Passenger Orbiter goes once round and lands its biocapsule under 8 g and 330 K (the flight record, from liftoff), coming home on the retrograde hold of the first hour (the Gyro autopilot)',
    b.alive && eb.pe - R > TELLUS.atm && b.parts.some(q => q.on && q.d.kind === 'sci') && p.landed && bio.on && PR.bio && PR.bioOK && PR.bioOrbits >= 1 && PR.gMax < 8 && cab < 330 && cal >= 0 && gyro.name === 'Gyro autopilot' && gyro.modes.includes('retro') && !gyro.modes.includes('pro') && O.length === 8,
    `Beeper: periapsis ${((eb.pe - R) / 1e3).toFixed(0)} km, ${api.dvRemaining(b).cur.toFixed(0)} m/s spare · Passenger Orbiter: ${dvP.toFixed(0)} m/s spare in orbit, ${PR.gMax.toFixed(1)} g, cabin ${cabUp.toFixed(0)} K in orbit, peak ${cab.toFixed(0)} K (${PR.bioOK ? 'passenger fine' : PR.pet + ' ' + PR.bioWhy}), ${PR.bioOrbits.toFixed(2)} orbits, ${p.landed ? 'landed' : 'not landed'}; stability at roll out ${cal.toFixed(2)} calibers`);
}

// vehicle-4. Warnings before launch (vehicle session, QUEUE Q48): the Rollout screen says when a design is short of the
// Δv its aim needs (the logbook's best flight to orbit, or ~4,500 m/s before anyone has been there, plus the climb to a
// contract's altitude), and when a crew or a passenger rides with no parachute.
{
  const P = api.PRESETS, PR = api.PROG, B = [{ name: 'The beeper', alt: 0 }], H = [{ name: 'Satellite to 400 km', alt: 400 }], lv = (st, a) => api.launchWarnings(st, a).map(x => x[0]).join();
  const log0 = PR.log; PR.log = {}; const est = [lv(P.Beeper, B), lv(P.Orbiter, H), lv(P.Hopper, B), lv(P['Passenger Orbiter'], B)];
  // every reading with an empty logbook is taken before log0 is back: earlier sections leave a best orbit in it (5,000 m/s
  // inside --smoke), which reads the Orbiter short of 400 km instead of tight (Q204)
  const hop = api.launchWarnings(P.Hopper, B), tight = api.launchWarnings(P.Orbiter, H);
  PR.log = { orbit: { v: 5600 } }; const best = api.launchWarnings(P.Orbiter, B); PR.log = log0;
  const chute = [api.launchWarnings(['bio', 'rwheel', 't2', 'petrel'], []), api.launchWarnings(['les', 'crew', 't2', 'petrel'], []), api.launchWarnings(P['Passenger Orbiter'], []), api.launchWarnings(P.Beeper, [])];
  const climb = api.dvToAlt(TELLUS, 400), r0 = TELLUS.R + TELLUS.atm + 1e4, r1 = TELLUS.R + 4e5, hand = Math.sqrt(TELLUS.mu / r0) * (Math.sqrt(2 * r1 / (r0 + r1)) - 1) + Math.sqrt(TELLUS.mu / r1) * (1 - Math.sqrt(2 * r0 / (r0 + r1)));
  check('launch warnings: the Beeper is fine for the beeper, the Orbiter tight for 400 km, the Hopper short; the logbook\'s best sets the need; no chute under a crew or a passenger is flagged',
    est.join('|') === 'ok|warn|warn|ok' && /Short of orbit/.test(hop[0][1]) && /Tight/.test(tight[0][1])
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

// vehicle-10. Gates for late parts (vehicle session, QUEUE Q190, Caio 2026-10-10): a late part opens with the mission that
// first needs it (PART_GATE) or with its computing era (d.era); before that it's listed and designable but no launch may
// carry it. Every gate names a real mission that comes no later than the first mission needing the part.
{
  const P = api.PROG, T = api.TEST, keep = { done: P.done, flights: P.flights, day: P.day, tools: T.tools };
  const why = st => api.partLaunchWhy(api.newShip(st).parts), M = id => api.MISSIONS.find(m => m.id === id);
  P.done = {}; P.flights = 1; P.day = 0; T.tools = false;
  const early = ['Hopper', 'Orbiter', 'Beeper', 'Passenger Orbiter', 'Sounding', 'Passenger'].filter(n => why(api.PRESETS[n]));
  const bay0 = api.partOpen('bay'), arm0 = api.partOpen('arm'), comp0 = api.partOpen('ocomp'), rtg0 = api.partOpen('rtg'), dock0 = why(api.PRESETS.Docking);
  P.done = { beeper: true }; const port1 = api.partOpen('port').ok && api.partOpen('hab').ok && !api.partOpen('bay').ok, dock1 = why(api.PRESETS.Docking);
  P.done = { beeper: true, station1: true }; const bay2 = api.partOpen('bay').ok && api.partOpen('arm').ok && !api.partOpen('lab').ok;
  T.tools = true; const tl = api.partOpen('lab').ok && api.partOpen('ocomp').ok && !why(api.PRESETS.Docking);
  T.tools = false; P.flights = 0; const sb = !why(api.PRESETS.Docking) || !!(P.own && P.own.chosen);
  Object.assign(P, { done: keep.done, flights: keep.flights, day: keep.day }); T.tools = keep.tools;
  // a gate mission must exist and be reachable no later than the missions that need the part
  const reqs = id => { const m = M(id); return m ? [id, ...(m.req || []).flatMap(reqs)] : [id]; };
  const bad = Object.entries(api.PART_GATE).filter(([k, id]) => !M(id) || !api.PARTS[k]).map(([k]) => k);
  const order = [['hab', 'station1'], ['port', 'station1'], ['lab', 'stationlab'], ['crew', 'padabort'], ['les', 'padabort'], ['beacon', 'selland']]
    .filter(([k, m]) => api.PART_GATE[k] !== m && !reqs(m).includes(api.PART_GATE[k])).map(([k]) => k);
  check('part gates: early presets fly from day 1; the cargo bay and the arm open with "A station", the docking port with "The beeper", the computer and RTG with their era; tester tools and a sandbox ignore gates',
    !early.length && !bay0.ok && /A station/.test(bay0.why) && !arm0.ok && !comp0.ok && !rtg0.ok && /docking port/.test(dock0) && /onboard computer/.test(dock0)
      && port1 && !/docking port/.test(dock1) && /onboard computer/.test(dock1) && bay2 && tl && sb && !bad.length && !order.length,
    `early presets blocked: ${early.join(', ') || 'none'}; day 1 Docking: "${dock0}"; after the beeper: "${dock1}"; bad gates ${bad.join(',') || 'none'}; out of order ${order.join(',') || 'none'}`);
}

// vehicle-11. Every part says what it does (vehicle session, QUEUE Q248; PLAYTEST #46): the palette's card has a sentence
// for every listed part (its own, its 1.25 m sibling's, or its kind's) and a spec sheet with mass, size and price.
{
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
  const D = new Function(src + 'let stackDef=null;' + bsrc + ';return {PARTS,BLD};')();
  const listed = Object.keys(D.PARTS).filter(k => !D.PARTS[k].radialOnly);
  const mute = listed.filter(k => D.BLD.partInfo(D.PARTS[k]).length < 20);
  const thin = listed.filter(k => { const L = D.BLD.partSpecs(D.PARTS[k]).map(r => r[0]); return !L.includes('mass') || !L.includes('size') || (D.PARTS[k].kind === 'engine' && !L.includes('Isp')); });
  check('part cards: every listed part has a sentence and a spec sheet (engines with Isp)', !mute.length && !thin.length && listed.length > 40,
    `${listed.length} parts; no sentence: ${mute.join(', ') || 'none'}; thin sheet: ${thin.join(', ') || 'none'}`);
}

// vehicle-12. The player's designs (vehicle session, Caio 2026-10-11): every launch files its design under PROG.designs.launched
// (one entry per distinct design, newest first, its launch count); a design saved under a name is kept, the same name
// replaces it; parked parts never count as a different launched design.
{
  const P = api.PROG, keep = P.designs; P.designs = {};
  const cp = x => JSON.parse(JSON.stringify(x)), orb = api.toV2(cp(api.PRESETS.Orbiter)), parked = cp(orb);
  parked.park = [{ n: { k: 't1', c: [] }, p: [3, 0, 0] }];
  api.designLaunched(api.PRESETS.Orbiter); api.designLaunched(api.PRESETS.Beeper); api.designLaunched(orb); api.designLaunched(parked);
  const L = api.designLib(), first = L.launched[0];
  api.designSave('Mine', orb); api.designSave('Mine', api.PRESETS.Beeper); api.designSave('', api.PRESETS.Hopper);
  const ok = L.launched.length === 2 && first.name === 'Orbiter' && first.n === 3 && !first.stack.park && L.launched[1].name === 'Beeper'
    && L.saved.length === 2 && L.saved.find(e => e.name === 'Mine').stack[0] === 'cone' && L.saved.some(e => e.name === 'Hopper');
  check('design library: launches file their designs (one per design, newest first, counted; parked parts ignored); saving a name keeps it, the same name replaces it',
    ok, `launched ${L.launched.map(e => `${e.name}×${e.n}`).join(', ')}; saved ${L.saved.map(e => e.name).join(', ')}`);
  P.designs = keep;
}

// vehicle-13. Why a landed rocket blew up (vehicle session, QUEUE Q264; PLAYTEST #64): a tall stack on its engine bell tips over if it
// touches down drifting sideways faster than tipSpeed (the swing about its stance's edge lifts the centre of mass over it), and past
// 60° it is destroyed a few seconds after touchdown. The model and the formula agree; the loss keeps its cause for the Debrief.
{
  const msg0 = api.HOOK.msg, st = api.PRESETS.Hopper, vt = api.standSpeed(api.newShip(st), TELLUS.mu / TELLUS.R ** 2);
  const drop = vx => { api.t = 0; const s = api.newShip(st); api.S = s; api.HOOK.msg = () => {}; s.landed = false; s.sas = false; s.throttle = 0;
    const f = api.localFrame(s.r); s.r = add(s.r, mul(f.up, 0.1)); s.v = add(api.surfVel(TELLUS, s.r), add(mul(f.up, -1), mul(f.e, vx)));
    for (let i = 0; i < 20 / api.DT && s.alive && !s.landed; i++) api.physStep(s, api.DT); return s; };
  const slow = drop(0.75 * vt), fast = drop(1.15 * vt), out = api.debOutcome(fast, fast.rec);
  check('topple (Q264): the Hopper stands drifting ~0.9 m/s; below it lands, above it topples, and the Debrief says why',
    vt > 0.8 && vt < 1 && slow.landed && !fast.alive && /drifting .* tips over past/.test(fast.lossWhy || '') && out.d.startsWith(fast.lossWhy),
    `tips past ${vt.toFixed(2)} m/s; at ${(0.75 * vt).toFixed(2)} ${slow.landed ? 'landed' : 'not landed'}; at ${(1.15 * vt).toFixed(2)}: ${out.d}`);
  api.HOOK.msg = msg0;
}

// vehicle-14. The Touchdown quote for what lands (vehicle session, QUEUE Q325): the stack after its drops (a capsule under its chute),
// or, with legs, before the drop that leaves them behind (a descent stage stays on the moon); on Selene the same stack stands ~0.41×
// the drift (tipSpeed goes as √g). Quoting leaves the ship as it was.
{
  const gT = TELLUS.mu / TELLUS.R ** 2, gS = SELENE.mu / SELENE.R ** 2, ps = api.newShip(api.PRESETS.Passenger), cm0 = ps.cm.slice(), m0 = ps.mass;
  const P = api.landStance(ps, gT), Pm = api.landStance(ps, gS), P0 = api.landStance(ps, gT, 0), built = api.standSpeed(ps, gT);
  const fd = (n, k) => n.k === k ? n : n.c.map(c => fd(c, k)).find(Boolean), d = api.toV2(['pod', 't1', 'wren', 'dec', 't2', 'wren']);
  fd(fd(d.root, 'dec'), 't2').c.push({ k: 'leg', at: { y: 0.3, a: Math.PI / 4, n: 4, cy: 0.5 }, c: [] });
  const ls = api.newShip(d), L = api.landStance(ls, gS), drops = ls.events.some(e => e.decouple.length);
  check('touchdown quote (Q325): what lands after its drops, legs keep their stage, Selene ×0.41, the ship untouched',
    P.n < P.of && P.v > 1.5 * built && P0.n === P0.of && Math.abs(Pm.v / P.v - Math.sqrt(gS / gT)) < 0.01 &&
    drops && L.legs && L.n === L.of && ps.mass === m0 && ps.cm.every((x, i) => x === cm0[i]),
    `Passenger: ${P.n} of ${P.of} parts land on ${P.on}, ${P.v.toFixed(2)} m/s (built ${built.toFixed(2)}), Selene ×${(Pm.v / P.v).toFixed(3)}; lander ${L.n} of ${L.of} on Selene ${L.v.toFixed(2)} m/s`);
}

// vehicle-15. Staging by drag and drop (vehicle session, QUEUE Q249; PLAYTEST #47): stgEdit moves an action into another stage,
// gives it a stage of its own between two, merges a stage into another and moves a stage; the merged stage fires all of its
// actions in one press (one event that drops and lights together).
{
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
  const D = new Function(src + 'let stackDef=null;' + bsrc + ';return {toV2,assemble,PRESETS,BLD};')();
  const E = D.BLD.stgEdit, L = [['a', 'b'], ['c'], ['d', 'e']], J = x => JSON.stringify(x);
  const cases = [
    [E(L, { atom: [0, 1] }, { row: 2 }), [['a'], ['c'], ['d', 'e', 'b']]],    // an action dragged onto stage 3
    [E(L, { atom: [2, 0] }, { gap: 1 }), [['a', 'b'], ['d'], ['c'], ['e']]],  // between stages 1 and 2: a stage of its own
    [E(L, { atom: [1, 0] }, { gap: 3 }), [['a', 'b'], ['d', 'e'], ['c']]],    // past the end; its old stage, now empty, goes
    [E(L, { stage: 1 }, { row: 0 }), [['a', 'b', 'c'], ['d', 'e']]],           // stage 2 merged into stage 1
    [E(L, { stage: 0 }, { gap: 3 }), [['c'], ['d', 'e'], ['a', 'b']]],         // stage 1 moved to the end
    [E(L, { stage: 2 }, { row: 2 }), L]];                                       // onto itself: nothing
  const bad = cases.filter(([g, w]) => J(g) !== J(w)).map(([g]) => J(g));
  const cp = x => JSON.parse(JSON.stringify(x)), heavy = () => { const d = D.toV2(cp(D.PRESETS.Heavy)); D.BLD.ensureIds(d); return d; };
  const A0 = D.assemble(heavy()), ids = A0.stages.map(s => s.map(a => a.id)), h = heavy(); h.stg = E(ids, { stage: 1 }, { row: 0 });
  const A1 = D.assemble(h), e0 = A1.events[0];
  check('staging by drag and drop (Q249): actions and stages move, merge and split; a merged stage fires all its actions at once',
    !bad.length && L.length === 3 && A1.custom && A1.events.length === A0.events.length - 1 && e0.ignite.length === A0.events[0].ignite.length + A0.events[1].ignite.length && e0.decouple.length === A0.events[1].decouple.length,
    `${bad.length ? 'wrong: ' + bad.join(' ') + ' · ' : ''}Heavy ${A0.stages.length} stages → ${A1.stages.length}; stage 1 now: ${A1.stages[0].map(a => a.label).join(' + ')}`);
}

// vehicle-16. Deploy in the Assembly (vehicle session, QUEUE Q328; PLAYTEST #79): a leg, a solar wing or a cargo bay set out on
// the design (n.dep, every symmetric copy) rolls out that way: legs down, wings out, doors open. The Rollout warns of each; the
// design keeps its procedures (procKey ignores dep). Flown up deployed, the wings tear off in thick air and the rocket flies on.
{
  const fd = (n, k) => n.k === k ? n : (n.c || []).map(c => fd(c, k)).find(Boolean), mk = dep => {
    const d = api.toV2(['core', 't1', 'bay', 'pod', 't2', 'kestrel']), t = fd(d.root, 't2');
    t.c.push({ k: 'leg', at: { y: 0.3, a: Math.PI / 4, n: 4, cy: 0.5 }, c: [] }, { k: 'wpanel', at: { y: 1, a: 0, n: 2 }, c: [] });
    if (dep) for (const k of ['leg', 'wpanel', 'bay']) fd(d.root, k).dep = true; return d; };
  const d0 = mk(false), d1 = mk(true), s0 = api.newShip(d0), s1 = api.newShip(d1), of = (s, f) => s.parts.filter(p => f(p.d));
  const L = of(s1, d => d.kind === 'leg'), Wg = of(s1, d => d.wing), B = of(s1, d => d.kind === 'bay')[0];
  const wn = d => api.launchWarnings(d).filter(([k, x]) => /at launch/.test(x)).length;
  const stowed = !s0.parts.some(p => p.dep || p.open) && wn(d0) === 0;
  const out = L.length === 4 && L.every(p => p.dep) && Wg.length === 2 && Wg.every(p => p.dep) && B.open && !s1.parts.some(p => p.inBay && p.inBay.open === false);
  const msg0 = api.HOOK.msg; api.HOOK.msg = () => {}; api.t = 0; api.S = s1; api.stage(s1); s1.throttle = 1;
  let qx = 0; for (let i = 0; i < 60 / api.DT && s1.alive && Wg.some(p => p.on); i++) { api.advPhys(s1); qx = Math.max(qx, s1.qdyn); }
  api.HOOK.msg = msg0;
  check('deploy in the Assembly (Q328): legs, wings and doors roll out as left, the Rollout warns, procedures kept; wings torn off on the way up',
    stowed && out && wn(d1) === 3 && api.procKey(d0) === api.procKey(d1) && api.procKey(d1) !== JSON.stringify(d1) && s1.alive && !Wg.some(p => p.on),
    `stowed ${stowed}; deployed: ${L.filter(p => p.dep).length}/4 legs, ${Wg.filter(p => p.dep).length}/2 wings, bay ${B.open ? 'open' : 'shut'}; ${wn(d1)} warnings; flown: ${s1.alive ? 'alive' : 'lost'}, wings ${Wg.filter(p => p.on).length} left at ${(qx / 1000).toFixed(2)} kPa`);
}

// vehicle-17. The payload fairing (vehicle session, QUEUE Q337; PROBES § 3.5): its shell encloses what stands on its ring within its
// outline, so those parts are out of the air (no outline, no heating) and its shell's mass rides along; a staging press after the
// first stage drops the shell in two halves (the mass goes, the payload meets the air). Too short a shell: the top pokes out, and
// the Rollout says so. The 2.5 m fairing, its length from the design node, and the halves as debris.
{
  const D = new Function(src + 'return {toV2,newShip,stage,shielded,launchWarnings,HOOK,debris,PARTS,geom,simT};')();
  const pay = ['ant', 'cam', 'sci', 'sci', 'core', 'fair', 't2', 'petrel', 'dec', 't8', 'kestrel'], fd = (n, k) => n.k === k ? n : (n.c || []).map(c => fd(c, k)).find(Boolean), mk = fl => { const d = D.toV2(pay.slice()); if (fl) fd(d.root, 'fair').fl = fl; return d; };
  const msg0 = D.HOOK.msg, deb0 = D.HOOK.debris; let deb = 0; D.HOOK.msg = () => {}; D.HOOK.debris = () => { deb++; }; D.HOOK.rebuild = D.HOOK.rebuild || (() => {});
  const s = D.newShip(mk()), F = s.parts.find(p => p.d.kind === 'fair'), inn = s.parts.filter(p => p.inFair === F), names = inn.map(p => p.d.key).sort().join(',');
  const shield0 = inn.length && inn.every(p => D.shielded(p)), m0 = s.mass, fi = s.events.findIndex(e => e.fair), sep = s.events.findIndex(e => e.decouple.length);
  const warn0 = D.launchWarnings(mk()).filter(([k, x]) => /out of the fairing/.test(x)).length;
  for (let i = 0; i < fi; i++) D.stage(s);
  const m1 = s.mass; D.stage(s);
  const dropped = F.fj && F.xm === 0 && Math.abs(m1 - s.mass - F.d.fm * F.fl * 1000) < 1 && inn.every(p => !D.shielded(p)) && deb === 3;
  const short = D.newShip(mk(2)), Fs = short.parts.find(p => p.d.kind === 'fair'), innS = short.parts.filter(p => p.inFair === Fs).length, warnS = D.launchWarnings(mk(2)).filter(([k, x]) => /out of the fairing/.test(x)).length;
  const big = D.newShip(D.toV2(['cam', 'core', 'fair25', 'T16', 'albatross'])), Fb = big.parts.find(p => p.d.kind === 'fair');
  D.HOOK.msg = msg0; D.HOOK.debris = deb0;
  check('payload fairing (Q337): the payload inside is out of the air, the shell drops after stage 1 in two halves, a short shell warns',
    names === 'ant,cam,core,sci,sci' && shield0 && Math.abs(F.fl - 3) < 1e-9 && fi === sep + 1 && warn0 === 0 && dropped && innS < inn.length && warnS === 1 && Fb && Math.abs(Fb.fl - 6) < 1e-9 && big.parts.filter(p => p.inFair === Fb).length === 2,
    `inside: ${names} (shielded ${shield0}); fairing event ${fi} after separation ${sep}; dropped ${dropped} (debris ${deb}); a 2 m shell holds ${innS}, ${warnS} warning; 2.5 m: ${Fb ? Fb.fl : '-'} m, ${big.parts.filter(p => p.inFair === Fb).length} inside`);
}

// vehicle-18. Side antennas and side boxes (vehicle session, QUEUE Q337; PROBES § 3.1–3.2): a boom antenna rides folded (it fits in
// a fairing, the radio is at whip gain), P unfolds it with the wings (gain ×5; out at launch, the Rollout warns and it no longer
// fits), and thick air tears it off while out. The whip is a side antenna at whip gain; the side camera and instrument package
// count as a camera and instruments, off the axis (the centre of mass moves).
{
  const D = new Function(src + 'return {toV2,newShip,antOf,wingOp,launchWarnings,HOOK,advPhys,stage,khUse,PROG,TEST,S:null};')();
  const fd = (n, k) => n.k === k ? n : (n.c || []).map(c => fd(c, k)).find(Boolean);
  const mk = (dep, side) => { const d = D.toV2(['core', 'sci', 'fair', 't2', 'petrel', 'dec', 't8', 'kestrel']), c = fd(d.root, 'sci');
    c.c.push({ k: 'bant', at: { y: 0.35, a: 0, n: 1 }, c: [] }); if (dep) fd(d.root, 'bant').dep = true;
    if (side) { const t = fd(d.root, 't2'); t.c.push({ k: 'scam', at: { y: 1, a: Math.PI / 2, n: 1 }, c: [] }, { k: 'whip', at: { y: 1.5, a: Math.PI, n: 1 }, c: [] }); }
    return d; };
  const msg0 = D.HOOK.msg; let msgs = []; D.HOOK.msg = m => msgs.push(m); D.HOOK.rebuild = D.HOOK.rebuild || (() => {}); D.HOOK.debris = D.HOOK.debris || (() => {});
  const s = D.newShip(mk()), b = s.parts.find(p => p.d.key === 'bant'), g0 = D.antOf(s.parts).G, fits = !!b.inFair;
  for (const p of s.parts) if (p.profF) p.fj = true;   // the shell jettisoned: nothing unfolds inside it (Q410)
  D.wingOp(s, 'out'); const g1 = D.antOf(s.parts).G, said = msgs.includes('Antennas out');
  const sd = D.newShip(mk(true)), bd = sd.parts.find(p => p.d.key === 'bant'), w = D.launchWarnings(mk(true)).some(([k, x]) => /^Boom antenna deployed at launch/.test(x));
  const reg = D.antOf([{ k: 'bant' }, { k: 'whip' }]).G;   // a registry entry's shape: unfolded in orbit
  // flown up unfolded and without a fairing in the way, it tears off
  const f = mk(true); fd(f.root, 'fair').k = 'dec'; const sf = D.newShip(f), bf = sf.parts.find(p => p.d.key === 'bant'); D.S = sf; D.stage(sf); sf.throttle = 1;
  for (let i = 0; i < 4000 && sf.alive && bf.on; i++) D.advPhys(sf);
  const sc = D.newShip(mk(false, true)), s0 = D.newShip(mk(false, false)), cams = sc.parts.filter(p => p.on && p.d.kind === 'cam').length, ants = sc.parts.filter(p => p.d.kind === 'ant').length, off = Math.hypot(sc.cm[0], sc.cm[2]);
  const kh0 = D.PROG.kh; D.PROG.kh = { cam: { use: 0.87, reg: {} } }; const kin = !D.TEST.kh ? D.khUse('scam') === 0.87 && D.khUse('cam') === 0.87 : true; D.PROG.kh = kh0;
  D.HOOK.msg = msg0;
  check('side antennas and boxes (Q337): a boom antenna folded fits the fairing at whip gain, unfolds to ×5, warns and tears off out in air; side camera counts, CoM moves',
    fits && g0 === 1 && g1 === 5 && said && !bd.inFair && w && reg === 5 && !bf.on && sf.alive && cams === 1 && ants === 2 && off > 1e-3 && Math.hypot(s0.cm[0], s0.cm[2]) < off && kin,
    `folded: in fairing ${fits}, gain ${g0}; unfolded ${g1} (${said ? 'said' : 'silent'}); out at launch: fits ${!!bd.inFair}, warned ${w}; registry gain ${reg}; flown out: ${bf.on ? 'still on' : 'torn off'}; side camera ${cams}, antennas ${ants}, CoM off axis ${(off * 100).toFixed(1)} cm; side camera shares the camera's know-how ${kin}`);
}

// vehicle-19. Trim (vehicle session, QUEUE Q337; PROBES § 4): the steering a stage spends holding course against thrust that
// misses its centre of mass. A symmetric rocket spends nothing; a camera on one side a little; a tank on one side much more; a
// single booster on one side more than it has, and the Rollout warns.
{
  const fd = (n, k) => n.k === k ? n : (n.c || []).map(c => fd(c, k)).find(Boolean);
  const mk = add => { const d = api.toV2(['core', 't2', 'petrel', 'dec', 't8', 'kestrel']); if (add) fd(d.root, 't8').c.push(add); return d; };
  const T = d => api.trimOf(api.newShip(d)), W = d => api.launchWarnings(d).some(([k, x]) => /can't hold its course/.test(x));
  const sym = T(mk()), cam = T(mk({ k: 'scam', at: { y: 6, a: 0, n: 1 }, c: [] })), tank = T(mk({ k: 't2', at: { y: 4, a: 0, n: 1 }, c: [] }));
  const bst = mk({ k: 't4', at: { y: 4, a: 0, n: 1, dec: true }, c: [{ k: 'kestrel', at: 'd', c: [] }] }), B = T(bst);
  check('trim (Q337): symmetric ~0, a side camera a little, a side tank more, one side booster past what it can steer (warned)',
    sym.f < 0.01 && cam.f > sym.f && tank.f > cam.f && B.f > 0.6 && W(bst) && !W(mk()),
    `symmetric ${(sym.f * 100).toFixed(1)}%, side camera ${(cam.f * 100).toFixed(1)}% (${(cam.miss * 100).toFixed(1)} cm), side tank ${(tank.f * 100).toFixed(0)}%, one booster ${(B.f * 100).toFixed(0)}% (stage ${B.k}, ${(B.miss * 100).toFixed(0)} cm)`);
}

// vehicle-20. Builder notes from Caio's testing (2026-10-12): the side boxes fit inside a payload fairing on a 1.25 m stack (they
// used to stick out past its bulge), and on the narrow octagonal frame; the stack camera is a short drum now.
{
  const fd = (n, k) => n.k === k ? n : (n.c || []).map(c => fd(c, k)).find(Boolean), SIDE = ['scam', 'ssci', 'sbatt', 'scomp'];
  const d = api.toV2(['core', 'oct', 'sci', 'fair', 't2', 'petrel', 'dec', 't8', 'kestrel']);
  SIDE.forEach((k, i) => { fd(d.root, 'sci').c.push({ k, at: { y: 0.24, a: i * Math.PI / 2, n: 1 }, c: [] }); fd(d.root, 'oct').c.push({ k, at: { y: 0.25, a: i * Math.PI / 2 + 0.4, n: 1 }, c: [] }); });
  const s = api.newShip(d), side = s.parts.filter(p => SIDE.includes(p.d.key)), out = side.filter(p => !p.inFair).map(p => p.d.key + (p.host && p.host.d ? '@' + p.host.d.key : ''));
  const o = s.parts.find(p => p.d.key === 'oct');
  check('builder notes: side boxes fit a payload fairing on a 1.25 m stack and on the octagonal frame; the frame is 0.8 m across; the camera is 0.3 m tall',
    side.length === 8 && !out.length && o && o.d.r === 0.4 && api.PARTS.cam.h === 0.3,
    `side boxes ${side.length}, outside the fairing: ${out.join(', ') || 'none'}; frame r ${o && o.d.r}; camera ${api.PARTS.cam.h} m`);
}

// vehicle-21. Later stages in the air (vehicle session, QUEUE Q342 / PLAYTEST #82): a satellite's upper stage with a payload
// fairing up front, dropped at ~34 km and ~13 kPa by a small first stage, goes end over end (the fairing's joints never break:
// the tumble is what Caio saw). airSep finds where each fresh stage lights on a standard ascent and whether it holds there:
// short of steering (the satellite); a reaction wheel or steerable fins on the upper stage fix it (the wheel only since the SAS
// cancels the air's torque, v1.165); the presets hold; a booster drop isn't a fresh stage. Flown in attitude hold on the pitch
// program (6–11° off its path at separation): the satellite tumbles; with steerable fins on its upper stage it doesn't.
{
  const L = ['t2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], sat = api.toV2(['core', 'batt', 'sci', 'cam', 'fair', ...L]), whl = api.toV2(['core', 'rwheel', 'batt', 'sci', 'cam', 'fair', ...L]),
    cf = api.toV2(['core', 'batt', 'sci', 'cam', 'fair', 't2', 'cfins', 'petrel', 'dec', 't8', 'fins', 'kestrel']);
  const A = d => api.airSep(d)[0] || {}, a = A(sat), w = A(whl), c = A(cf), warned = api.launchWarnings(sat).some(([k, x]) => /end over end/.test(x));
  const presets = ['Orbiter', 'Beeper', 'Passenger Orbiter', 'Probe', 'Heavy', 'Asparagus', 'Lunar', 'Sample Return'].filter(n => api.airSep(api.PRESETS[n]).some(x => !x.holds));
  const heavy = api.airSep(api.PRESETS.Heavy)[0];   // its boosters drop at ~19 km off a lit core: the stage checked is the upper one, high up
  const fly = d => { const AS = api.TELLUS.atm / 7e4; api.t = 0; const s = api.newShip(d); api.S = s; s.av = 2; api.advPhys(s); s.throttle = 1; api.stage(s); s.sas = true; s.sasMode = 'stab';
    let tS = null, mx = 0; for (let k = 0; k < 60000 && s.alive; k++) { const f = api.localFrame(s.r), h = api.len(s.r) - api.TELLUS.R;
      { const r = 90 * (1 - Math.pow(Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))), 0.6)) * Math.PI / 180; s.hold = api.norm(api.add(api.mul(f.e, Math.cos(r)), api.mul(f.up, Math.sin(r)))); }
      if (api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) { const dec = s.events[s.evIdx].decouple.length; api.stage(s); if (dec && tS == null) tS = api.t; }
      if (tS != null && api.t > tS + 0.1 && s.qdyn > 500) mx = Math.max(mx, s.aoa); if (tS != null && api.t > tS + 10) break; api.advPhys(s); }
    return { sep: tS != null, aoa: mx * 180 / Math.PI }; };
  const msg0 = api.HOOK.msg; api.HOOK.msg = () => {}; const fs = fly(sat), fc = fly(cf); api.HOOK.msg = msg0;
  check('later stages in the air (Q342): the fairing satellite\'s upper stage flips at ~34 km (short of steering), warned; a wheel or steerable fins hold; presets hold; flown in attitude hold: it tumbles, with fins it doesn\'t',
    a.k === 2 && !a.holds && a.why === 'auth' && a.h > 25e3 && a.h < 45e3 && a.q > 8e3 && a.q < 18e3 && a.fair && warned && w.holds && c.holds && !presets.length && heavy && heavy.h > 45e3
      && fs.sep && fs.aoa > 60 && fc.sep && fc.aoa < 20,
    `satellite: stage ${a.k} at ${(a.h / 1e3).toFixed(0)} km ${(a.q / 1e3).toFixed(1)} kPa, ${a.holds ? 'holds' : 'flips (' + a.why + ')'}, warned ${warned}; with a wheel ${w.holds ? 'holds' : 'flips'}; steerable fins ${c.holds ? 'hold' : 'flip'}; presets flagged: ${presets.join(', ') || 'none'}; Heavy's checked stage at ${heavy && (heavy.h / 1e3).toFixed(0)} km; flown: ${fs.aoa.toFixed(0)}° after separating, with fins ${fc.aoa.toFixed(0)}°`);
}

// vehicle-22. A fast rocket's own max-q (vehicle session, QUEUE Q347 / PLAYTEST #84): four boosters push a satellite launcher
// through thick air so fast its dynamic pressure peaks near 75 kPa, three times the 25 kPa design case, and the decoupler under
// the upper stage's Petrel snapped (flown: 102%). The Assembly's max-q case now uses the design's own peak on the standard
// ascent when it's higher (the Orbiter's estimate matches its flight's 33 kPa), names the joint and suggests an interstage
// decoupler, which carries the load round the engine (the same rocket with one: about half).
{
  const top = ['core', 'batt', 'sci', 'cam', 'fair', 't2', 'petrel'], rad = { k: 'kestrel', rad: { n: 4, dec: true, stack: ['cone', 't4', 'kestrel'] } };
  const four = api.toV2([...top, 'dec', 't8', 'fins', rad]), ist = api.toV2([...top, 'istage', 't8', 'fins', rad]);
  const A = d => api.analyze(api.newShip(d)).mq, a = A(four), b = A(ist), o = api.ascentEst(api.PRESETS.Orbiter), fix = api.jointFix(a.cert, a.own);
  check('a fast rocket\'s own max-q (Q347): four boosters peak near 75 kPa, the decoupler joint near its rating, an interstage suggested and about halving it; the Orbiter\'s estimate ~33 kPa',
    a.own && a.q > 60e3 && a.q < 90e3 && a.cert.frac > 0.75 && /dec/.test(a.cert.p.d.key + a.cert.p.parent.d.key) && /interstage/.test(fix) && b.cert.frac < 0.6 * a.cert.frac && o.qMax > 30e3 && o.qMax < 37e3,
    `four boosters: max-q ${(a.q / 1e3).toFixed(0)} kPa M${a.M.toFixed(1)}, ${(a.cert.frac * 100).toFixed(0)}% ${a.cert.kind} at ${a.cert.p && a.cert.p.d.key + '/' + a.cert.p.parent.d.key}; "${fix}"; with an interstage ${(b.cert.frac * 100).toFixed(0)}%; Orbiter ${(o.qMax / 1e3).toFixed(1)} kPa`);
}

// vehicle-23. Fin sizes (vehicle session, QUEUE Q348 / PLAYTEST #85): a radial or steerable fin's node may carry fz, a step up
// (0.9, 1.35, 2 m span). The plate scales; mass, shear and price by area; the root's bending rating by k³. Four 2 m radial fins
// at the foot of the fairing satellite's upper stage (Q342) make it about neutral, so it holds in the air; flown in attitude
// hold on the pitch program (the hard case, 6–11° off its path at separation) it stays on course through max-q and past
// separation. (Before the SAS cancelled the air's torque, v1.165, fins that big up top tipped the whole rocket over at max-q.)
{
  const f = (x, k) => x.k === k ? x : (x.c || []).map(c => f(c, k)).find(Boolean);
  const sat = fz => { const d = api.toV2(['core', 'batt', 'sci', 'cam', 'fair', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel']), n = { k: 'rfin', at: { y: 0.45, a: Math.PI / 4, n: 4 }, c: [] }; if (fz) n.fz = fz; f(d.root, 't2').c.push(n); return d; };
  const b = api.PARTS.rfin, z = api.finDef(b, 2), k = api.FIN_SZ[2].k, s0 = api.newShip(sat(0)), s2 = api.newShip(sat(2)), p2 = s2.parts.find(p => p.d.kind === 'rfin');
  const scale = Math.abs(z.span / b.span - k) < 1e-9 && Math.abs(z.m / b.m - k * k) < 1e-9 && Math.abs(z.B / b.B - k ** 3) < 1e-9 && z.key === 'rfin' && api.finDef(b, 0) === b && p2.d === z;
  const c0 = api.vesselCost(s0.parts).cost, c2 = api.vesselCost(s2.parts).cost, a0 = api.airSep(sat(0))[0], a2 = api.airSep(sat(2));
  const fly = d => { const AS = api.TELLUS.atm / 7e4; api.t = 0; const s = api.newShip(d); api.S = s; s.av = 2; api.advPhys(s); s.throttle = 1; api.stage(s); s.sas = true; s.sasMode = 'stab';
    let tS = null, mx = 0; for (let i = 0; i < 60000 && s.alive; i++) { const fr = api.localFrame(s.r), h = api.len(s.r) - api.TELLUS.R;
      const r = 90 * (1 - Math.pow(Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))), 0.6)) * Math.PI / 180; s.hold = api.norm(api.add(api.mul(fr.e, Math.cos(r)), api.mul(fr.up, Math.sin(r))));
      if (api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) { const dec = s.events[s.evIdx].decouple.length; api.stage(s); if (dec && tS == null) tS = api.t; }
      if (s.qdyn > 500 && (tS == null || api.t > tS + 0.1)) mx = Math.max(mx, s.aoa); if (tS != null && api.t > tS + 10) break; api.advPhys(s); }
    return { sep: tS != null, aoa: mx * 180 / Math.PI, alive: s.alive }; };
  const msg0 = api.HOOK.msg; api.HOOK.msg = () => {}; const fl = fly(sat(2)); api.HOOK.msg = msg0;
  check('fin sizes (Q348): a 2 m radial fin scales span x2.2, mass by area, root bending by k^3, costs more; four on the satellite upper stage hold it in the air, and flown in attitude hold it stays on course through max-q and separation',
    scale && c2 > c0 && !a0.holds && a2.length === 1 && a2[0].holds && a2[0].cal > a0.cal && fl.sep && fl.alive && fl.aoa < 20,
    `2 m: span ${z.span.toFixed(2)} m, ${(z.m * 1000).toFixed(0)} kg, B ${z.B.toFixed(0)} kN·m; cost ${c0.toFixed(1)}M → ${c2.toFixed(1)}M; stage 2 ${a0.holds ? 'holds' : 'flips'} (cal ${a0.cal.toFixed(2)}) → ${a2.map(a => (a.holds ? 'holds' : 'flips') + ' (cal ' + a.cal.toFixed(2) + ')').join(', ')}; flown ${fl.aoa.toFixed(0)}° at worst`);
}

// vehicle-24. The SAS cancels the air's torque (vehicle session, QUEUE Q382, Caio: "the other designs are also flipping"): the
// stock Beeper, flown on the gyro autopilot in attitude hold along the pitch program, used to go end over end the moment its
// upper stage separated (~38 km, ~9 kPa): the air hit the light unstable stage with ~13 kN·m at once, and a rate loop only
// answers once the craft turns, so its 15 kN·m wheel came in too late. With the last step's aero moment fed forward it holds.
{
  const fly = (d, av) => { const AS = api.TELLUS.atm / 7e4; api.t = 0; const s = api.newShip(d); api.S = s; s.av = av; api.advPhys(s); s.throttle = 1; api.stage(s); s.sas = true; s.sasMode = 'stab';
    let tS = null, mx = 0; for (let i = 0; i < 60000 && s.alive; i++) { const fr = api.localFrame(s.r), h = api.len(s.r) - api.TELLUS.R;
      const r = 90 * (1 - Math.pow(Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))), 0.6)) * Math.PI / 180; s.hold = api.norm(api.add(api.mul(fr.e, Math.cos(r)), api.mul(fr.up, Math.sin(r))));
      if (api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) { const dec = s.events[s.evIdx].decouple.length; api.stage(s); if (dec && tS == null) tS = api.t; }
      if (tS != null && api.t > tS + 0.1 && s.qdyn > 500) mx = Math.max(mx, s.aoa); if (tS != null && api.t > tS + 15) break; api.advPhys(s); }
    return { sep: tS != null, aoa: mx * 180 / Math.PI }; };
  const msg0 = api.HOOK.msg; api.HOOK.msg = () => {}; const g = fly(api.PRESETS.Beeper, 0), c = fly(api.PRESETS.Beeper, 2); api.HOOK.msg = msg0;
  check('SAS cancels the air\'s torque (Q382): the Beeper flown through separation in attitude hold stays on course, gyro autopilot and guidance computer alike',
    g.sep && c.sep && g.aoa < 30 && c.aoa < 30, `after separating: gyro ${g.aoa.toFixed(0)}°, guidance computer ${c.aoa.toFixed(0)}° at worst`);
}

// vehicle-25. A working satellite, and the wheels' storage in the air (vehicle session, Caio: "a satellite that doesn't tip over
// during ascent and is also viable"). The Satellite preset (core, battery, wheel, a long octagonal frame with two wings, a whip,
// a camera and an instrument package, in a fairing on the Orbiter's launcher) shows no warnings, draws its antenna and camera's
// 15 W, and flies to orbit on the probe autopilot with Δv to spare, pointing prograde and 10° below it. (Balanced on the bench, Q416,
// with its instrument package opposite the camera, it tumbles once on the pitch program in attitude hold, ~14° off, but makes orbit.)
// The same payload on a 4 t upper stage lights at ~25 km: holding 5° off fills its wheel in a few seconds though its torque is
// in hand, and flown 5° below prograde it goes over; the builder now says so (why 'store'), and gives the preset's limit (~7°).
{
  const sat = api.PRESETS.Satellite, W = api.launchWarnings(sat), a = api.airSep(sat)[0], pb = api.powerBudget(api.newShip(sat)), kinds = api.newShip(sat).parts.map(p => p.d.kind);
  const t4 = (() => { const d = JSON.parse(JSON.stringify(sat)), f = n => n.k === 't2' ? n : (n.c || []).map(f).find(Boolean); f(d.root).k = 't4'; return d; })(), b = api.airSep(t4)[0];
  const AS = TELLUS.atm / 7e4, tgt = TELLUS.atm + 10000;
  // mode 'pro': the pitch program to 10 km, then prograde; 'hold': the program in attitude hold all the way; 'lag5': 5° below prograde from 10 km
  const fly = (d, mode, stopAfterSep = 0) => { api.t = 0; const s = api.newShip(d); api.S = s; s.av = 1; api.advPhys(s); s.throttle = 1; api.stage(s); s.sas = true; s.sasMode = 'stab';
    let phase = 'up', tS = null, mx = 0; for (let k = 0; k < 400000 && s.alive; k++) { const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - TELLUS.R, f = api.localFrame(s.r);
      if (phase === 'up') { if (mode === 'pro' && h > 10000 * AS) s.sasMode = 'pro';
        else if (/^lag/.test(mode) && h > 10000 * AS) { const v = norm(s.v), ax = norm(cross(v, f.up)), g = +mode.slice(3) / 57.3; s.sasMode = 'stab'; s.hold = norm(add(mul(v, Math.cos(g)), mul(cross(ax, v), Math.sin(g)))); }
        else { const r = 90 * (1 - Math.pow(Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))), 0.6)) * Math.PI / 180; s.sasMode = 'stab'; s.hold = norm(add(mul(f.e, Math.cos(r)), mul(f.up, Math.sin(r)))); }
        if (el.ap - TELLUS.R > tgt) { s.throttle = 0; phase = 'coast'; } }
      else if (phase === 'coast') { s.sasMode = 'pro'; s.throttle = h < TELLUS.atm && el.ap - TELLUS.R < tgt - 500 ? 0.3 : 0;
        const dvC = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a)); if (h > TELLUS.atm && api.timeToNu(el, Math.PI) < Math.max(25, 0.5 * dvC / Math.max(api.engAcc(s), 0.1))) phase = 'circ'; }
      else { const hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), need = sub(mul(hv, Math.sqrt(TELLUS.mu / len(s.r))), s.v); s.sasMode = 'stab'; s.hold = norm(need); s.throttle = 1;
        if (el.pe - TELLUS.R > TELLUS.atm + 2000 || len(need) < 3 || api.dvRemaining(s).tot < 0.5) { s.throttle = 0; break; } }
      { const nx = s.events[s.evIdx]; if (nx && nx.fair && h > 40000 && s.qdyn < 300) api.stage(s); }   // the fairing off in thin air
      if (tS != null && s.qdyn > 500) mx = Math.max(mx, s.aoa);
      if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) { const dec = s.events[s.evIdx].decouple.length; api.stage(s); if (dec && tS == null) tS = api.t; }
      if (stopAfterSep && tS != null && api.t > tS + stopAfterSep) break; api.advPhys(s); }
    const el = elements(s.r, s.v, TELLUS.mu); return { orbit: s.alive && el.pe - TELLUS.R > TELLUS.atm, left: api.dvRemaining(s).tot, aoa: mx * 180 / Math.PI }; };
  const msg0 = api.HOOK.msg; api.HOOK.msg = () => {}; const pro = fly(sat, 'pro'), lag = fly(sat, 'lag10'), hold = fly(sat, 'hold'), over = fly(t4, 'lag5', 90); api.HOOK.msg = msg0;
  check('a working satellite: the Satellite preset has no warnings, sci + camera + antenna, a 15 W load its wings cover; it reaches orbit with Δv to spare prograde and 10° below; held to ~7° (its wheel), past that (the pitch program in attitude hold, ~14° off) it may tumble but still makes orbit; on a 4 t upper stage its wheel fills (flagged) and 5° off it goes over',
    !W.length && ['sci', 'cam', 'ant', 'batt', 'rwheel', 'solar'].every(k => kinds.includes(k)) && pb.ok && pb.use >= 15 && a.holds && a.lim >= 5 && a.lim <= 12
      && pro.orbit && pro.left > 300 && lag.orbit && lag.left > 300 && lag.aoa < 30 && hold.orbit && !b.holds && b.why === 'store' && over.aoa > 60,
    `warnings ${W.length ? W.map(w => w[1]).join(' | ') : 'none'}; power ${pb.use} W of ${pb.avg.toFixed(0)}, ${pb.ok ? 'ok' : 'short'}; in the air ${a.holds ? 'holds' : 'flips'} to ~${a.lim}°; prograde ${pro.orbit ? 'orbit' : 'no orbit'} ${pro.left.toFixed(0)} m/s left; 10° below prograde ${lag.orbit ? 'orbit' : 'no orbit'} ${lag.left.toFixed(0)} m/s, ${lag.aoa.toFixed(0)}° at worst; the pitch program in attitude hold ${hold.orbit ? 'orbit' : 'no orbit'} ${hold.left.toFixed(0)} m/s (${hold.aoa.toFixed(0)}° at worst); 4 t upper stage ${b.holds ? 'holds' : 'flips (' + b.why + ', fills in ' + b.fill.toFixed(0) + ' s)'}, flown 5° off ${over.aoa.toFixed(0)}°`);
}

// vehicle-26. Nothing unfolds inside a closed fairing (vehicle session, QUEUE Q410): on the pad, P (or its button) unfolded the
// Satellite preset's wings straight through its fairing. Now they stay folded and the message says why; once the shell is
// jettisoned they unfold.
{
  const msgs = [], m0 = api.HOOK.msg; api.HOOK.msg = m => msgs.push(m); api.t = 0; const s = api.newShip(api.PRESETS.Satellite); api.S = s; api.advPhys(s);
  const n0 = api.wingOp(s, 'out'), said = msgs.some(m => /Inside the fairing/.test(m));
  const fe = s.events.findIndex(e => e.fair && e.fair.length); let n1 = -1; if (fe >= 0) { while (s.evIdx <= fe) api.stage(s); n1 = api.wingOp(s, 'out'); } api.HOOK.msg = m0;
  check('nothing unfolds inside a closed fairing (Q410): the Satellite preset\'s wings stay folded on the pad, saying why; after the fairing is jettisoned both unfold',
    n0 === 0 && said && n1 === 2 && api.wingsOut(s), `in the fairing: ${n0} unfolded, "${msgs.find(m => /fairing/i.test(m)) || ''}"; after jettison: ${n1}`);
}

// vehicle-27. The payload bench, slice 1 (vehicle session, QUEUE Q416, D24, PROBES § 6.1): a satellite designed apart from the
// rocket rides it as one block {k:'pay', pid, pd}. Laid out, the block is a payload adapter with the payload standing on it:
// the Satellite preset rebuilt as fairing + block has the same parts plus the adapter, all of the payload inside the fairing,
// the same stages within 2 %, and the design's JSON carries no layout copies. A block follows its bench copy (paySync). The
// bench's Checks pass for the Satellite starter (and its fit on that rocket); a short fairing fails the fit; the first beacon
// runs on its battery alone (a warning with its days); a lopsided payload warns, and with an engine of its own it fails.
{
  const cl = x => JSON.parse(JSON.stringify(x)), P0 = api.PROG.payloads; api.PROG.payloads = [];
  const fair = { k: 'fair', c: [] }, rocket = api.toV2(['t2', 'petrel', 'dec', 't8', 'fins', 'kestrel']);
  // the fairing on top of the upper tank, the block on the fairing
  const e = api.payNew('Sat', api.PAY_STARTERS.Satellite); fair.at = 'u'; rocket.root.c.push(fair); fair.c.push({ ...api.payNode(e), at: 'u' });
  const A = api.newShip(api.PRESETS.Satellite), B = api.newShip(rocket), pay = B.parts.filter(p => p.dn.payOf), padapt = B.parts.filter(p => p.d.key === 'padapt');
  const dA = api.stageStats(api.PRESETS.Satellite).stages.map(s => s.dvV), dB = api.stageStats(rocket).stages.map(s => s.dvV);
  const same = dA.length === dB.length && dA.every((v, i) => Math.abs(dB[i] - v) / v < 0.02), clean = !/payOf|"src"/.test(JSON.stringify(rocket));
  const inside = pay.filter(p => p.d.key !== 'padapt').every(p => p.inFair);
  e.name = 'Renamed'; e.d.root.c.push({ k: 'batt', at: 'u', c: [] }); const synced = api.paySync(rocket), blk = rocket.root.c.find(c => c.k === 'fair').c[0];
  const C = api.payChecks(api.PAY_STARTERS.Satellite, rocket, e.id).rows, cls = Object.fromEntries(C.map(r => [r.k, r.cl]));
  const short = cl(rocket); short.root.c.find(c => c.k === 'fair').fl = 2; const fitShort = api.payChecks(api.PAY_STARTERS.Satellite, short, e.id).rows.find(r => r.k === 'fit');
  const beacon = api.payChecks(api.PAY_STARTERS['First beacon']).rows.find(r => r.k === 'power');
  const lop = cl(api.PAY_STARTERS.Satellite), oct = (function g(n) { return n.k === 'octl' ? n : (n.c || []).map(g).find(Boolean); })(lop.root);
  oct.c.find(c => c.k === 'ssci').at.a = -Math.PI / 2; const balL = api.payChecks(lop).rows.find(r => r.k === 'bal');
  const kick = cl(lop); (function g(n) { if (n.k === 'octl') n.c.push({ k: 'wren', at: 'd', c: [] }); else (n.c || []).forEach(g); })(kick.root);
  const balK = api.payChecks(kick).rows.find(r => r.k === 'bal');
  api.PROG.payloads = P0;
  check('the payload bench (Q416): a satellite as one block lays out as an adapter and its parts, inside the fairing, flying as the preset does; blocks follow the bench; its Checks pass, a short fairing fails, a battery-only beacon and a lopsided payload warn, lopsided with an engine fails',
    B.parts.length === A.parts.length + 1 && padapt.length === 1 && inside && same && clean && synced === 1 && blk.name === 'Renamed' && JSON.stringify(blk.pd) === JSON.stringify(e.d)
      && ['power', 'link', 'turn', 'bal', 'fit'].every(k => cls[k] === 'ok') && fitShort.cl === 'bad' && beacon.cl === 'warn' && /days|hours/.test(beacon.t) && balL.cl === 'warn' && balK.cl === 'bad',
    `parts ${A.parts.length} → ${B.parts.length} (${padapt.length} adapter), payload inside ${inside}; Δv ${dA.map(v => v.toFixed(0)).join('/')} vs ${dB.map(v => v.toFixed(0)).join('/')}; clean ${clean}; synced ${synced}; checks ${C.map(r => r.k + ':' + r.cl).join(' ')}; 2 m fairing ${fitShort.cl} "${fitShort.t}"; beacon ${beacon.cl} "${beacon.t}"; lopsided ${balL.cl} "${balL.t}", with an engine ${balK.cl}`);
}

// vehicle-28. Propulsion on the bench (vehicle session, QUEUE Q422, PROBES § 6.3): a satellite with its own large kick motor
// and a hydrazine thruster on a propellant sphere, carried as a block. The payload adapter is a separation ring: staging it in
// orbit drops the upper stage, whose tank never fed the satellite. The kick motor waits, armed, until a touch on the throttle,
// then burns to burnout at full thrust though the throttle is cut (~700 m/s, along its path), and leaves the hydrazine alone;
// the thruster then burns from its sphere. The bench counts the payload's own Δv against a stationary orbit; the rocket's
// stages count it too (the Assembly's Reaches sees rocket and payload together).
{
  const cl = x => JSON.parse(JSON.stringify(x)), P0 = api.PROG.payloads; api.PROG.payloads = [];
  const pd = cl(api.PAY_STARTERS.Satellite), oct = (function g(n) { return n.k === 'octl' ? n : (n.c || []).map(g).find(Boolean); })(pd.root);
  oct.c.push({ k: 'sph4', at: 'd', c: [{ k: 'hthr', at: 'd', c: [{ k: 'kick200', at: 'd', c: [] }] }] });
  const e = api.payNew('Kick sat', pd), dvRow = api.payChecks(pd).rows.find(r => r.k === 'dv');
  const R = { v: 2, root: { k: 't2', c: [{ k: 'fair', at: 'u', c: [{ ...api.payNode(e), at: 'u' }] }, { k: 'petrel', at: 'd', c: [] }] } }, st = api.stageStats(R).stages;
  const msg0 = api.HOOK.msg, msgs = []; api.HOOK.msg = m => msgs.push(m);
  api.t = 0; const s = api.newShip(R); api.S = s; const r0 = TELLUS.R + TELLUS.atm + 10000; s.landed = false; s.r = [r0, 0, 0]; s.v = [0, 0, Math.sqrt(TELLUS.mu / r0)];
  const fuel = k => s.parts.filter(p => p.on && p.d.key === k).reduce((a, p) => a + (p.res.fuel || 0), 0), t2 = fuel('t2');
  s.throttle = 0; for (let k = 0; k < 10 && s.evIdx < s.events.length && s.parts.some(p => p.on && p.d.key === 'petrel'); k++) api.stage(s);
  const released = !s.parts.some(p => p.on && p.d.key === 'petrel'), armed = fuel('kick200');
  const point = () => { const Y = norm(s.v), X = norm(cross(Y, [0, 1, 0])); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  for (let i = 0; i < 50; i++) { point(); api.advPhys(s); } const waited = fuel('kick200'), v0 = Math.hypot(...s.v), h0 = fuel('sph4');
  s.throttle = 1; point(); api.advPhys(s); s.throttle = 0;
  for (let i = 0; i < 3000 && fuel('kick200') > 0; i++) { point(); api.advPhys(s); }
  point(); api.advPhys(s);   // burnout is noticed on the next step
  const dv = Math.hypot(...s.v) - v0, h1 = fuel('sph4'), thr = s.throttle;
  s.throttle = 1; for (let i = 0; i < 500; i++) { point(); api.advPhys(s); } s.throttle = 0; const h2 = fuel('sph4');
  api.HOOK.msg = msg0; api.PROG.payloads = P0;
  check('propulsion on the bench (Q422): the adapter releases the payload and drops the upper stage; the kick motor waits armed, then burns to the end with the throttle cut (~700 m/s); its propellant and the hydrazine stay apart; the bench and the stages count its Δv',
    released && armed > 0.17 && waited === armed && dv > 600 && dv < 800 && fuel('kick200') === 0 && thr === 0 && h0 - h1 < 0.002 && h1 - h2 > 0.0003
      && msgs.some(m => /lit: it burns to the end/.test(m)) && msgs.some(m => /burnt out/.test(m)) && dvRow && /stationary/.test(dvRow.t) && st.length === 2 && st[1].dvV > 700,
    `released ${released}, kick ${armed.toFixed(3)} t armed, ${waited.toFixed(3)} after waiting; Δv ${dv.toFixed(0)} m/s, throttle after ${thr}; hydrazine ${h0.toFixed(4)} → ${h1.toFixed(4)} (kick) → ${h2.toFixed(4)} (its own burn); bench "${dvRow && dvRow.t}"; stages ${st.map(x => x.dvV.toFixed(0)).join('/')}`);
}

// vehicle-29. The balance weight (Caio's round-2 note on the bench, Q416): a side mass whose kilograms its node carries (wk). On
// the Satellite starter made lopsided (its instrument package moved beside the camera, 14 cm off the axis), a weight opposite
// the offset, sized as the bench's button sizes it (mass × offset ÷ its lever), brings the balance check back to ok.
{
  const d = JSON.parse(JSON.stringify(api.PAY_STARTERS.Satellite)), oct = (function g(n) { return n.k === 'octl' ? n : (n.c || []).map(g).find(Boolean); })(d.root);
  oct.c.find(c => c.k === 'ssci').at.a = -Math.PI / 2;
  let s = api.newShip(d); const off = Math.hypot(s.cm[0], s.cm[2]), before = api.payChecks(d).rows.find(r => r.k === 'bal').cl;
  const host = s.parts.filter(p => p.on && p.core && !p.inst.surf && !p.inst.rdec).sort((x, y) => y.d.r - x.d.r)[0], B = host.dn;   // the widest part on the main stack, as the bench's button picks
  const rw = Math.hypot(host.pos[0], host.pos[2]) + host.d.r + api.PARTS.bwt.off, kg = Math.ceil(s.mass * off / rw);
  B.c.push({ k: 'bwt', at: { y: host.h / 2, a: Math.atan2(-s.cm[2], -s.cm[0]) - (host.inst.rot || 0), n: 1, cy: 0.1 }, wk: kg, c: [] });
  s = api.newShip(d); const w = s.parts.find(p => p.d.kind === 'bwt'), after = api.payChecks(d).rows.find(r => r.k === 'bal');
  check('the balance weight: sized on its node, opposite the offset it brings a lopsided payload back to balanced', before === 'warn' && w && Math.abs(w.d.m * 1000 - kg) < 1e-6 && after.cl === 'ok',
    `offset ${(off * 100).toFixed(0)} cm (${before}); a ${kg} kg weight: "${after.t}"`);
}

// vehicle-30. A stationary satellite (vehicle session, QUEUE Q412, PLAYTEST #102): the TV Satellite preset flown on the probe
// autopilot from Dunnzar Cape. A 110 km orbit; a coast until a transfer burn now would arrive over the capital's longitude (the
// far point is opposite, half a transfer later); a prograde burn to the stationary height (the upper stage runs dry, staging
// releases the satellite, its apogee engine goes on); at the top the apogee engine circularises to a day's period. The
// mission's own check counts TV for the capital; the satellite keeps Δv to hold its slot; no builder warnings.
{
  const T = TELLUS, ATM = T.atm, AS = ATM / 7e4, DAY = 2 * Math.PI / T.rot, rg = api.STAT_R, d = api.PRESETS['TV Satellite'], W = api.launchWarnings(d);
  const c = api.capital(), capLon = Math.atan2(c.u[2], c.u[0]) * 180 / Math.PI, msg0 = api.HOOK.msg; api.HOOK.msg = () => {};
  api.t = 0; const s = api.newShip(d); api.S = s; s.av = 1; api.advPhys(s); s.throttle = 1; api.stage(s); s.sas = true; s.sasMode = 'stab';
  let phase = 'up', k = 0, waited = 0, t0 = 0;
  const step = () => { const nx = s.events[s.evIdx]; if (nx && nx.fair && len(s.r) - T.R > 40000 && s.qdyn < 300) api.stage(s);
    if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) api.stage(s); api.advPhys(s); };
  while (s.alive && k++ < 3e6) { const el = elements(s.r, s.v, T.mu), h = len(s.r) - T.R, f = api.localFrame(s.r);
    if (phase === 'up') { if (h > 10000 * AS) s.sasMode = 'pro'; else { const x = Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))), r = 90 * (1 - Math.pow(x, 0.6)) * Math.PI / 180; s.sasMode = 'stab'; s.hold = norm(add(mul(f.e, Math.cos(r)), mul(f.up, Math.sin(r)))); }
      if (el.ap - T.R > ATM + 10000) { s.throttle = 0; phase = 'coast'; } }
    else if (phase === 'coast') { s.sasMode = 'pro'; s.throttle = h < ATM && el.ap - T.R < ATM + 9500 ? 0.3 : 0;
      const dvC = Math.sqrt(T.mu / el.ap) - Math.sqrt(T.mu * (2 / el.ap - 1 / el.a)); if (h > ATM && api.timeToNu(el, Math.PI) < Math.max(25, 0.5 * dvC / Math.max(api.engAcc(s), 0.1))) phase = 'circ'; }
    else if (phase === 'circ') { const hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), need = sub(mul(hv, Math.sqrt(T.mu / len(s.r))), s.v); s.sasMode = 'stab'; s.hold = norm(need); s.throttle = 1;
      if (el.pe - T.R > ATM + 2000 || len(need) < 3) { s.throttle = 0; t0 = api.t; phase = 'wait'; } }
    else if (phase === 'wait') { s.sasMode = 'pro'; s.throttle = 0; const a = (len(s.r) + rg) / 2, Ta = api.progT(s) + Math.PI * Math.sqrt(a ** 3 / T.mu), pf = api.rotY(mul(norm(s.r), -1), -api.absTh(Ta));
      if (Math.abs(((Math.atan2(pf[2], pf[0]) * 180 / Math.PI - capLon) % 360 + 540) % 360 - 180) < 1.5) { waited = api.t - t0; phase = 'gto'; } }
    else if (phase === 'gto') { s.sasMode = 'pro'; s.throttle = el.ap < rg - 2e5 ? 1 : el.ap < rg ? 0.2 : 0; if (el.ap >= rg) { s.throttle = 0; phase = 'rel'; } }
    else if (phase === 'rel') { let g = 0; while (s.parts.some(p => p.on && p.d.key === 'padapt') && s.evIdx < s.events.length && g++ < 6) api.stage(s); phase = 'toAp'; }
    else if (phase === 'toAp') { s.sasMode = 'pro'; const dvC = Math.sqrt(T.mu / el.ap) - Math.sqrt(T.mu * (2 / el.ap - 1 / el.a)), lead = 0.5 * dvC / Math.max(api.engAcc(s) || 0.5, 0.05), tA = api.timeToNu(el, Math.PI);
      if (tA > lead + 120 && api.railsOK(s)) { api.advRails(s, Math.min(600, tA - lead - 60), 1000); continue; } if (tA <= lead) phase = 'circ2'; }
    else { const hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), need = sub(mul(hv, Math.sqrt(T.mu / len(s.r))), s.v); s.sasMode = 'stab'; s.hold = norm(need);
      const P = el.a > 0 ? 2 * Math.PI * Math.sqrt(el.a ** 3 / T.mu) : 0; s.throttle = P > DAY * 0.99 ? 0.15 : 1; if (P >= DAY * 0.9995 || api.dvRemaining(s).tot < 0.3) { s.throttle = 0; break; } }
    step(); }
  for (let i = 0; i < 20; i++) api.advPhys(s); api.HOOK.msg = msg0;
  const el = elements(s.r, s.v, T.mu), P = 2 * Math.PI * Math.sqrt(el.a ** 3 / T.mu) / DAY, inc = Math.acos(Math.abs(el.h[1] / len(el.h))) * 180 / Math.PI;
  check('a stationary satellite (Q412): the TV Satellite preset, timed over the capital, reaches a day-long circular equatorial orbit the capital sees; TV for the capital counts; Δv left to hold it; no warnings',
    !W.length && s.alive && Math.abs(P - 1) < 0.002 && el.e < 0.01 && inc < 2 && api.capSees(s.r, api.progT(s)) && s.rec.tv && api.dvRemaining(s).tot > 150,
    `warnings ${W.length}; waited ${(waited / 60).toFixed(0)} min in the low orbit; period ${P.toFixed(4)} day, e ${el.e.toFixed(4)}, ${inc.toFixed(2)}°; capital sees it ${api.capSees(s.r, api.progT(s))}; TV ${!!s.rec.tv}; ${api.dvRemaining(s).tot.toFixed(0)} m/s left`);
}
