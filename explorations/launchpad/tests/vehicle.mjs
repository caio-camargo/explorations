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
