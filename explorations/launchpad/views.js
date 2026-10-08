// Fixed reference views for judging graphics changes before/after. Paste into the page console (or load via the
// in-app browser tooling) and call refView(1..14): 1–3 whole-scene views, 4–9 part close-ups, 10 a firing engine from below, 11–14 flight marks, 15–17 the launch complex, 18–19 the pad at the start of a flight (day, night), 30–36 engine plumes, 40–45 re-entry plasma, 50–53 vapor cones, 60–67 plume on the pad (65–67 at night), 68–72 ignition, 73–77 cutoff and staging, 80–83 clouds, 84–86 escape tower, 87–89 landing dust, 90–93 explosions, 94–96 HUD gauges, 97–100 the sky from space. Each one rebuilds the same scene deterministically: same design,
// same sim time, same camera — so screenshots from different versions line up.
window.refView = async (n) => {
  if (window.simulate0) window.simulate = window.simulate0; else window.simulate0 = window.simulate;   // undo an ignition view's freeze
  if (typeof CLOUD_DT !== 'undefined') CLOUD_DT = 0;
  const settle = () => new Promise(r => setTimeout(r, 150));
  // the budget gate refuses expensive designs on a fresh program: reference views are screenshots, so fund them
  if (typeof PROG !== 'undefined' && PROG.funds < 1e6) PROG.funds = 1e6;
  // scene only: hide panels, HUD, messages, and the builder's CoM/CoP markers
  const bare = () => { document.querySelectorAll('.ui,#perf,#news,#msg').forEach(e => e.style.visibility = 'hidden'); if (S) S.ana = null; render(); };
  if (n === 1) { // the Orbiter on the pad, morning light
    if (mode !== 'editor') document.getElementById('bEditor').click();
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); cam.edY = 0;
    cam.yaw = 0.35; cam.pitch = 0.02; cam.dist = 40; render(); await settle(); bare(); return 'pad';
  }
  if (n === 2) { // Lunar rocket climbing through ~3 km, engine at full power, seen from the side
    stackDef = JSON.parse(JSON.stringify(PRESETS.Lunar)); editorChanged(); document.getElementById('launch').click();
    S.throttle = 1; stage(S);
    while (len(S.r) - TELLUS.R < 3000) { INP.pitch = (simT >= 8 && simT < 8.8) ? 1 : 0; if (simT > 9.8) S.sasMode = 'pro'; advPhys(S); if (typeof emitSmoke === 'function') emitSmoke(DT); }
    INP.pitch = 0; cam.yaw = 1.75; cam.pitch = 0.05; cam.dist = 55; render(); await settle(); bare(); return 'ascent';
  }
  // 4–9: part close-ups in the editor, for judging part detail: design, the part to centre on, camera yaw/pitch/distance
  const close = { 4: ['Orbiter', 'kestrel', 0.5, -0.05, 6], 5: ['Orbiter', 'pod', 0.3, 0.1, 5], 6: ['Big Lunar', 'adapt', 0.6, 0.05, 11],
    7: ['Sounding', 'sci', 0.25, 0.08, 4.5], 8: ['Lunar', 't8', 0.4, 0.02, 16], 9: ['Big Lunar', 'shield', 1.9, 0.15, 7] };
  if (close[n]) {
    const [design, key, yaw, pitch, dist] = close[n];
    if (mode !== 'editor') document.getElementById('bEditor').click();
    stackDef = JSON.parse(JSON.stringify(PRESETS[design])); editorChanged(); HOOK.edStill = true;
    const p = S.parts.find(q => q.d.key === key);
    cam.edY = p.y0 + p.h / 2 - S.cm[1]; cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render(); await settle(); bare(); return design + ':' + key;
  }
  if (n === 10) { // Sounding rocket's Sparrow firing at ~1 km, from below and to the side: the bell interior and the plume root
    stackDef = JSON.parse(JSON.stringify(PRESETS.Sounding)); editorChanged(); document.getElementById("launch").click();
    S.throttle = 1; stage(S); while (len(S.r) - TELLUS.R < 1000) advPhys(S);
    cam.yaw = 0.9; cam.pitch = -1.1; cam.dist = 5; render(); await settle(); bare(); return "engine";
  }
  // 11–14: flight marks (marksTick runs inside the sim loops; a single render only takes up to 5 s of marks)
  const fly = (until, every = 0.25) => { let t = simT; while (!until()) { advPhys(S); if (simT - t >= every) { marksTick(); t = simT } } marksTick(); };
  if (n === 11) { // the Orbiter fuelled on the pad, before ignition: LOX frost below each tank's fuel line
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click();
    markT = null; render(); advPhys(S); render(); cam.yaw = 0.5; cam.pitch = 0.05; cam.dist = 13; render(); await settle(); bare(); return 'frost';
  }
  if (n === 12) { // the same rocket 70 s into the climb: first-stage soot, frost mostly shed
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click();
    markT = null; render(); S.throttle = 1; stage(S);
    fly(() => simT > 70, 0.5); cam.yaw = 1.9; cam.pitch = -0.75; cam.dist = 15; render(); await settle(); bare(); return 'soot';
  }
  if (n === 13) { // a biocapsule + heat shield after an entry from orbit (orbital speed at 95 km, ~2° down), shield first: shield and windward hull charred
    stackDef = ['chute', 'bio', 'shield']; editorChanged(); document.getElementById('launch').click(); S.landed = false; S.mkLift = true;
    const r = TELLUS.R + 95000, dir = norm([0.9, 0.3, 0.3]), v0 = norm(cross([0, 1, 0], dir));
    const vc = Math.sqrt(TELLUS.mu / r); S.r = mul(dir, r); S.v = add(mul(v0, vc * 1.01), mul(dir, -vc * 0.035));   // just above orbital speed, ~2° down S.throttle = 0; S.sasMode = 'retro'; markT = simT;
    const Y = mul(norm(S.v), -1), X = norm(cross(Y, dir)); S.q = qFromBasis(X, Y, cross(X, Y)); S.w = [0, 0, 0];
    const t0 = simT; fly(() => len(S.v) < 0.3 * vc || len(S.r) - TELLUS.R < 20000 || !S.alive || simT - t0 > 900);
    cam.yaw = 2.2; cam.pitch = -0.35; cam.dist = 5; render(); await settle(); bare();
    return 'entry v ' + len(S.v).toFixed(0) + ' T ' + S.parts.map(p => p.d.key + ':' + p.T.toFixed(0)).join(' ');
  }
  if (n === 14) { // the Orbiter's upper stage, 12 s into a burn in orbit: the Petrel's nozzle extension glowing
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click();
    S.landed = false; S.mkLift = true; stage(S); stage(S); const r = TELLUS.R + 200000, dir = norm([0.85, 0.2, 0.45]);
    S.r = mul(dir, r); S.v = mul(norm(cross([0, 1, 0], dir)), Math.sqrt(TELLUS.mu / r)); S.sasMode = 'pro'; markT = simT;
    const Y = norm(S.v), X = norm(cross(Y, dir)); S.q = qFromBasis(X, Y, cross(X, Y)); S.w = [0, 0, 0]; S.throttle = 1;
    const t0 = simT; fly(() => simT - t0 > 12);
    cam.yaw = 2.6; cam.pitch = -0.3; cam.dist = 9; render(); await settle(); bare(); return 'glow';
  }
  // 15–17: the launch complex with the Orbiter on the pad: the pad area from the south-west, the tower and table, and the
  // whole site from high up (blockhouse 230 m west, gantry 80 m south)
  if (n === 15 || n === 16 || n === 17) {
    if (mode !== 'editor') document.getElementById('bEditor').click();
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); HOOK.edStill = true; cam.edY = 0;
    const v = { 15: [-0.9, 0.28, 85], 16: [0.25, 0.12, 26], 17: [1.24, 0.75, 420] }[n]; [cam.yaw, cam.pitch, cam.dist] = v;
    render(); await settle(); bare(); return { 15: 'complex', 16: 'tower', 17: 'site' }[n];
  }
  // 18–19: a flight starting on the pad: the gantry in service position around the rocket at t = 0, and the same at
  // night (the first time after now when the sun is well below the pad's horizon), floodlights on
  if (n === 18 || n === 19) {
    if (mode !== 'editor') document.getElementById('bEditor').click();
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click(); markT = null;
    if (n === 19) { const t0 = simT; for (let k = 1; k < 400; k++) { const tt = t0 + k * 120, site = fromPF(TELLUS, padPF(), tt);
      if (dot(norm(sub(site, bodyPos(TELLUS, tt))), SUN) < -0.3) { simT = tt; break } } syncLanded(S); markT = null; padShip = null }
    render(); cam.yaw = -0.5; cam.pitch = 0.15; cam.dist = 45; render(); await settle(); bare(); return n === 18 ? 'service' : 'night';
  }
  // 30–36: engine plumes. The ship is placed at an altitude (teleported, pointing straight up, climbing at vy m/s), staged
  // nst times and run 1.5 s at full throttle, then seen from the side: [design, altitude m, stagings, yaw, pitch, dist, vy]
  const plume = { 30: ['Orbiter', 150, 1, 3.0, -0.05, 24, 60], 31: ['Lunar', 20000, 1, 1.6, -0.35, 60, 700], 32: ['Lunar', 45000, 1, 1.6, -0.35, 90, 1500],
    33: ['Orbiter', 200000, 3, 1.6, -0.1, 30, 0], 34: ['Sounding', 800, 1, 1.6, 0.0, 9, 150], 35: ['Lunar', 200000, 4, 1.6, -0.1, 14, 0],
    36: ['Hopper', 1000, 1, 1.6, -0.25, 16, 150] };
  if (plume[n]) {
    const [design, alt, nst, yaw, pitch, dist, vy] = plume[n];
    stackDef = JSON.parse(JSON.stringify(PRESETS[design])); editorChanged(); document.getElementById('launch').click();
    S.landed = alt < 500 ? S.landed : false; S.mkLift = true; for (let i = 0; i < nst; i++) stage(S);
    const dir = norm([0.85, 0.2, 0.45]);
    if (alt >= 500) { S.r = mul(dir, TELLUS.R + alt); const X = norm(cross([0, 0, 1], dir)); S.q = qFromBasis(X, dir, cross(X, dir)); S.w = [0, 0, 0];
      S.v = add(surfVel(TELLUS, S.r), mul(dir, vy)); S.hold = dir; S.sasMode = 'stab' }
    S.throttle = 1; const t0 = simT; while (simT - t0 < 1.5) { advPhys(S); if (typeof emitSmoke === 'function') emitSmoke(DT) }
    cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render(); await settle(); bare();
    return design + ' h ' + ((len(S.r) - TELLUS.R) / 1000).toFixed(1) + ' km p ' + pressure(TELLUS, len(S.r) - TELLUS.R).toFixed(4) + ' eng ' + activeEngines(S).map(e => e.d.key).join(',');
  }
  // 40–45: re-entry plasma. An entry from 95 km (speed ×vf of circular, ~2° down) flown retro until altitude alt km, then the
  // ship is turned aoa degrees off the airflow and seen from yaw/pitch/dist: [design, vf, alt, aoa, yaw, pitch, dist]
  const entry = { 40: [['chute', 'bio', 'shield'], 1.01, 50, 0, 1.6, 0.1, 9], 41: [['chute', 'bio', 'shield'], 1.01, 50, 0, 2.6, 0.35, 14],
    42: [['chute', 'bio', 'shield'], 1.01, 75, 0, 1.6, 0.1, 9], 43: [['chute', 'bio', 'shield'], 1.01, 35, 0, 1.6, 0.1, 9],
    44: [['pod', 't2', 'petrel'], 1.01, 55, 35, 1.6, 0.1, 14], 45: [['chute', 'bio', 'shield'], 1.3, 55, 0, 1.6, 0.1, 9] };
  if (entry[n]) {
    const [design, vf, alt, aoa, yaw, pitch, dist] = entry[n];
    stackDef = design; editorChanged(); document.getElementById('launch').click(); S.landed = false; S.mkLift = true;
    const r = TELLUS.R + 95000, dir = norm([0.9, 0.3, 0.3]), v0 = norm(cross([0, 1, 0], dir)), vc = Math.sqrt(TELLUS.mu / r);
    S.r = mul(dir, r); S.v = add(mul(v0, vc * vf), mul(dir, -vc * (vf > 1.1 ? 0.25 : 0.035))); S.throttle = 0; S.sasMode = 'retro';
    const Y0 = mul(norm(S.v), -1), X0 = norm(cross(Y0, dir)); S.q = qFromBasis(X0, Y0, cross(X0, Y0)); S.w = [0, 0, 0];
    const t0 = simT; while (S.alive && len(S.r) - TELLUS.R > alt * 1000 && simT - t0 < 900) advPhys(S);
    if (aoa) { const va = norm(sub(S.v, surfVel(TELLUS, S.r))), up = norm(S.r), s = norm(cross(va, up)), a = aoa / 57.2958,
      Y = add(mul(va, -Math.cos(a)), mul(up, Math.sin(a))), X = norm(cross(Y, s)); S.q = qFromBasis(X, Y, cross(X, Y)); S.w = [0, 0, 0]; S.sasMode = null }
    cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render(); await settle(); bare();
    return 'entry h ' + ((len(S.r) - TELLUS.R) / 1000).toFixed(1) + ' km v ' + len(S.v).toFixed(0) + ' q ' + (S.qHeat / 1000).toFixed(0) + ' kW/m2 alive ' + S.alive;
  }
  // 50–53: transonic vapor cones. An ascent (pitch kick at 8 s, then prograde) flown until Mach M: [design, M, yaw, pitch, dist]
  const vapor = { 50: ['Orbiter', 0.97, 1.75, 0.05, 30], 51: ['Orbiter', 1.08, 1.75, 0.05, 30], 52: ['Lunar', 1.0, 1.75, 0.05, 50],
    53: ['Orbiter', 1.0, 2.3, -0.25, 16] };
  if (vapor[n]) {
    const [design, M, yaw, pitch, dist] = vapor[n];
    stackDef = JSON.parse(JSON.stringify(PRESETS[design])); editorChanged(); document.getElementById('launch').click();
    S.throttle = 1; stage(S);
    while (S.alive && S.mach < M && simT < 200) { INP.pitch = (simT >= 8 && simT < 8.8) ? 1 : 0; if (simT > 9.8) S.sasMode = 'pro'; advPhys(S); if (typeof emitSmoke === 'function') emitSmoke(DT); }
    INP.pitch = 0; cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render(); await settle(); bare();
    return design + ' M ' + S.mach.toFixed(2) + ' h ' + ((len(S.r) - TELLUS.R) / 1000).toFixed(1) + ' km shoulders ' + JSON.stringify(hullShoulders(hullProfile(S), -1).map(x => x.map(v => +v.toFixed(2))));
  }
  // 60–64: the plume meeting the ground. Ignite on the pad and burn until the engine's nozzle is alt m up (0: still held
  // down, 0.6 s after ignition), seen from yaw/pitch/dist: [design, alt, yaw, pitch, dist]
  const pad = { 60: ['Orbiter', 0, 0.9, 0.12, 40], 61: ['Orbiter', 12, 0.9, 0.12, 40], 62: ['Orbiter', 35, 0.9, 0.1, 55],
    63: ['Lunar', 3, 0.9, 0.12, 60], 64: ['Orbiter', 6, 0.4, 0.75, 60],
    // 65–67 at night (the plume lighting the pad): just after ignition, 12 m up, and a close look at the rocket's base
    65: ['Orbiter', 0, 0.9, 0.12, 40, 1], 66: ['Orbiter', 12, 0.9, 0.12, 45, 1], 67: ['Orbiter', 0, 2.2, 0.05, 16, 1] };
  if (pad[n]) {
    const [design, alt, yaw, pitch, dist, night] = pad[n];
    stackDef = JSON.parse(JSON.stringify(PRESETS[design])); editorChanged(); document.getElementById('launch').click();
    if (night) { const t0 = simT; for (let k = 1; k < 400; k++) { const tt = t0 + k * 120, site = fromPF(TELLUS, padPF(), tt);
      if (dot(norm(sub(site, bodyPos(TELLUS, tt))), SUN) < -0.3) { simT = tt; break } } syncLanded(S); markT = null; padShip = null }
    S.throttle = 1; stage(S); const t0 = simT, h0 = len(S.r);
    while (S.alive && simT - t0 < 60 && (alt ? len(S.r) - h0 < alt : simT - t0 < 0.6)) { advPhys(S); if (typeof emitSmoke === 'function') emitSmoke(DT); }
    cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render(); await settle(); bare();
    return design + ' up ' + (len(S.r) - h0).toFixed(1) + ' m t ' + (simT - t0).toFixed(1) + ' s';
  }
  // 68–72: ignition. The Orbiter's Kestrel (kerolox: TEA-TEB green flash, then a fuel-rich orange start) age seconds after
  // ignition, after 15 s on the pad (gantry clear), rendered every step so the render-side ignition clock starts on time: [age, night, yaw, pitch, dist]
  const ign = { 68: [0.04, 0, 0.9, 0.08, 26], 69: [0.12, 0, 0.9, 0.08, 26], 70: [0.3, 0, 0.9, 0.08, 26], 71: [0.7, 0, 0.9, 0.08, 26], 72: [0.06, 1, 0.9, 0.08, 30] };
  if (ign[n]) {
    const [age, night, yaw, pitch, dist] = ign[n];
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click();
    if (night) { const t0 = simT; for (let k = 1; k < 400; k++) { const tt = t0 + k * 120, site = fromPF(TELLUS, padPF(), tt);
      if (dot(norm(sub(site, bodyPos(TELLUS, tt))), SUN) < -0.3) { simT = tt; break } } syncLanded(S); markT = null; padShip = null }
    cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render();
    { const tw = simT; while (simT - tw < 15) advPhys(S); }   // the service gantry rolls back over 14 s (padSync)
    render(); S.throttle = 1; stage(S); const t0 = simT;
    while (simT - t0 < age - 1e-9) { advPhys(S); if (typeof emitSmoke === 'function') emitSmoke(DT); render(); }
    window.simulate = () => {};   // freeze the sim for the capture (the live frame loop would run it on); the next refView restores it
    await settle(); bare(); return 'ignition +' + (simT - t0).toFixed(2) + ' s';
  }
  // 73–77: cutoff and staging. Climb (pitch kick at 8 s, then prograde) to alt m, then do the action and render every step
  // for age s, freezing the sim for the capture: [design, alt, action ('cut' = throttle to zero, 'stage'), age, yaw, pitch, dist]
  const cut = { 73: ['Orbiter', 3000, 'cut', 0.15, 1.75, 0.0, 30], 74: ['Orbiter', 3000, 'cut', 0.6, 1.75, 0.0, 30],
    75: ['Orbiter', 3000, 'stage', 0.12, 1.75, 0.05, 26], 76: ['Orbiter', 30000, 'stage', 0.3, 1.75, 0.05, 26],
    77: ['Heavy', 2500, 'stage', 0.15, 1.75, 0.05, 34] };
  if (cut[n]) {
    const [design, alt, act, age, yaw, pitch, dist] = cut[n];
    stackDef = JSON.parse(JSON.stringify(PRESETS[design])); editorChanged(); document.getElementById('launch').click();
    S.throttle = 1; stage(S);
    while (S.alive && len(S.r) - TELLUS.R < alt && simT < 400) { INP.pitch = (simT >= 8 && simT < 8.8) ? 1 : 0; if (simT > 9.8) S.sasMode = 'pro'; advPhys(S); if (typeof emitSmoke === 'function') emitSmoke(DT); }
    INP.pitch = 0; cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render();
    for (const e of activeEngines(S)) { const sp = SPOOL.get(e); if (sp) { sp.ig = -1e9; sp.k = S.throttle } }   // the climb wasn't rendered: these engines lit long ago
    render();
    if (act === 'cut') S.throttle = 0; else stage(S);
    const t0 = simT; while (simT - t0 < age - 1e-9) { advPhys(S); if (typeof emitSmoke === 'function') emitSmoke(DT); render(); }
    window.simulate = () => {};   // freeze for the capture (restored by the next refView)
    await settle(); bare(); return design + ' ' + act + ' at ' + ((len(S.r) - TELLUS.R) / 1000).toFixed(1) + ' km +' + (simT - t0).toFixed(2) + ' s debris ' + debris.length;
  }
  // 80–83: clouds with depth. The Orbiter's ascent (pitch kick at 8 s, prograde) to alt m, seen from yaw/pitch/dist; the
  // sim is frozen for the capture. 80 is on the pad looking up past the rocket. [alt, yaw, pitch, dist]
  const cl = { 80: [0, 0.9, -0.45, 30], 81: [3000, 1.75, 0.05, 40], 82: [8000, 1.75, 0.45, 60], 83: [25000, 1.75, 0.5, 60] };
  if (cl[n]) {
    const [alt, yaw, pitch, dist] = cl[n];
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click();
    // weather on demand: the first time offset (5-minute steps) at which the sky under the rocket is about 60 % covered
    const wx = u => { CLOUD_DT = 0; for (let k = 0; k < 4000; k++) { const c = cloudAt(u, tNow() + k * 300); if (c > 0.55 && c < 0.75) { CLOUD_DT = k * 300; break } } };
    if (alt) { S.throttle = 1; stage(S); while (S.alive && len(S.r) - TELLUS.R < alt && simT < 600) { INP.pitch = (simT >= 8 && simT < 8.8) ? 1 : 0; if (simT > 9.8) S.sasMode = 'pro'; advPhys(S) } INP.pitch = 0 }
    wx(norm(toPF(TELLUS, S.r, simT)));   // weather on demand: ~60 % cover under the rocket
    cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render(); window.simulate = () => {};
    await settle(); bare(); const u = norm(toPF(TELLUS, S.r, simT));
    return 'clouds h ' + ((len(S.r) - TELLUS.R) / 1000).toFixed(1) + ' km, cover here ' + cloudAt(u, tNow() + CLOUD_DT).toFixed(2) + ' (CLOUD_DT ' + CLOUD_DT + ')';
  }
  // 84–86: the escape tower firing. The Crewed Lunar preset, aborted on the pad (84, 85) or at alt m in the climb (86); age s
  // after the abort, rendered every step, then frozen: [alt, age, yaw, pitch, dist]
  const abt = { 84: [0, 0.4, 0.9, 0.05, 45], 85: [0, 1.5, 0.9, 0.0, 70], 86: [4000, 1.0, 1.75, 0.05, 45] };
  if (abt[n]) {
    const [alt, age, yaw, pitch, dist] = abt[n];
    stackDef = JSON.parse(JSON.stringify(PRESETS['Crewed Lunar'])); editorChanged(); document.getElementById('launch').click();
    if (alt) { S.throttle = 1; stage(S); while (S.alive && len(S.r) - TELLUS.R < alt && simT < 400) { INP.pitch = (simT >= 8 && simT < 8.8) ? 1 : 0; if (simT > 9.8) S.sasMode = 'pro'; advPhys(S) } INP.pitch = 0;
      for (const e of activeEngines(S)) { const sp = SPOOL.get(e); if (sp) { sp.ig = -1e9; sp.k = S.throttle } } }
    else { const tw = simT; while (simT - tw < 15) advPhys(S) }   // the gantry clear
    cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render();
    const ok = abort(S); const t0 = simT; while (simT - t0 < age - 1e-9) { advPhys(S); emitSmoke(DT); render() }
    window.simulate = () => {}; await settle(); bare();
    return 'abort ' + ok + ' at ' + ((len(S.r) - TELLUS.R) / 1000).toFixed(2) + ' km +' + (simT - t0).toFixed(2) + ' s lesT ' + (S.lesT || 0).toFixed(2);
  }
  // 87–89: landing dust on Selene. A pod + tank + Wren hovering with its nozzle h m over the ground, in sunlight, run 1 s
  // and frozen: [h, yaw, pitch, dist]
  const dust = { 87: [25, 0.9, 0.12, 30], 88: [8, 0.9, 0.12, 30], 89: [3, 2.3, 0.35, 45] };
  if (dust[n]) {
    const [hh, yaw, pitch, dist] = dust[n];
    stackDef = ['pod', 't1', 'wren']; editorChanged(); document.getElementById('launch').click(); S.landed = false; S.mkLift = true; stage(S);
    // a sunlit spot: the sub-solar side of Selene, a little off the sun direction so shadows have length
    const u = norm(add(SUN, [0, 0.5, 0.3])), pf = mul(u, groundR(SELENE, mul(u, SELENE.R)) - S.yBot + hh);
    S.body = SELENE; S.r = pf; const X = norm(cross(u, [0, 0, 1])); S.q = qFromBasis(X, u, cross(X, u)); S.w = [0, 0, 0]; S.v = surfVel(SELENE, S.r);
    S.hold = u; S.sasMode = 'stab'; S.throttle = 0.25; const t0 = simT; while (simT - t0 < 1) { advPhys(S); render() }
    cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render(); window.simulate = () => {}; await settle(); bare();
    return 'Selene, nozzle ' + (len(S.r) - groundR(SELENE, toPF(SELENE, S.r, simT)) + S.yBot).toFixed(1) + ' m up, alive ' + S.alive;
  }
  // 90–93: explosions. A rocket destroyed at alt m (HOOK.boom at the ship, size sz), seen age s later (the boom clock is
  // wall time, so the view backdates the boom instead of waiting): [design, alt, sz, age, yaw, pitch, dist, night]
  const ex = { 90: ['Orbiter', 2000, 3, 0.15, 1.75, 0.05, 90], 91: ['Orbiter', 2000, 3, 1.2, 1.75, 0.05, 110], 92: ['Orbiter', 2000, 3, 6, 1.75, -0.25, 220],
    93: ['Orbiter', 0, 3, 0.1, 0.9, 0.1, 70, 1] };
  if (ex[n]) {
    const [design, alt, sz, age, yaw, pitch, dist, night] = ex[n];
    stackDef = JSON.parse(JSON.stringify(PRESETS[design])); editorChanged(); document.getElementById('launch').click();
    if (night) { const t0 = simT; for (let k = 1; k < 400; k++) { const tt = t0 + k * 120, site = fromPF(TELLUS, padPF(), tt);
      if (dot(norm(sub(site, bodyPos(TELLUS, tt))), SUN) < -0.3) { simT = tt; break } } syncLanded(S); markT = null; padShip = null }
    if (alt) { S.throttle = 1; stage(S); while (S.alive && len(S.r) - TELLUS.R < alt && simT < 400) { INP.pitch = (simT >= 8 && simT < 8.8) ? 1 : 0; if (simT > 9.8) S.sasMode = 'pro'; advPhys(S) } INP.pitch = 0 }
    else { const tw = simT; while (simT - tw < 15) advPhys(S) }
    cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; render();
    booms.length = 0; HOOK.boom(S.body, S.r, simT, sz); booms[booms.length - 1].t0 = performance.now() - age * 1000; S.alive = false; S.throttle = 0;
    window.simulate = () => {}; const b = booms[booms.length - 1]; const keepT = performance.now() - b.t0;
    render(); await settle(); b.t0 = performance.now() - keepT; bare();
    return 'boom at ' + ((len(S.r) - TELLUS.R) / 1000).toFixed(2) + ' km, age ' + age + ' s, air ' + b.air.toFixed(2);
  }
  // 94–96: the HUD gauges, with the HUD shown (not bare): the Lunar's climb at max-q (~10 km), at 40 km, and a capsule's
  // entry at peak heating. [kind, alt]
  const gv = { 94: ['climb', 10000], 95: ['climb', 40000], 96: ['entry', 50] };
  if (gv[n]) {
    const [kind, alt] = gv[n];
    if (kind === 'climb') { stackDef = JSON.parse(JSON.stringify(PRESETS.Lunar)); editorChanged(); document.getElementById('launch').click();
      S.throttle = 1; stage(S); while (S.alive && len(S.r) - TELLUS.R < alt && simT < 600) { INP.pitch = (simT >= 8 && simT < 8.8) ? 1 : 0; if (simT > 9.8) S.sasMode = 'pro'; advPhys(S); render() } INP.pitch = 0 }
    else { await refView(40) }
    cam.yaw = 1.75; cam.pitch = 0.05; cam.dist = 60; window.simulate = () => {}; render(); await settle();
    document.querySelectorAll('.ui').forEach(e => e.style.visibility = ''); render();
    return kind + ' h ' + ((len(S.r) - S.body.R) / 1000).toFixed(1) + ' km q ' + (S.qdyn / 1000).toFixed(1) + ' kPa, max ' + (GQ.peak / 1000).toFixed(1) + ' M ' + S.mach.toFixed(2);
  }
  // 97–100: the sky from space. The ship in orbit, the camera aimed along a direction D: 97 the galactic centre, 98 along
  // the band, 99 the sun, 100 the band over the planet's limb (D horizontal, the camera tipped down a little)
  if (n >= 97 && n <= 100) {
    stackDef = ['pod', 't2', 'petrel']; editorChanged(); document.getElementById('launch').click(); S.landed = false; S.mkLift = true; stage(S);
    const along = norm(cross(GAL.gx, GAL.gc)), D = n === 97 ? GAL.gc : n === 98 ? along : n === 99 ? norm(add(SUN, mul(GAL.gx, 0.04))) : along;
    let up = D; if (n === 100) { up = norm(cross(D, GAL.gx)); if (dot(up, SUN) < 0) up = mul(up, -1) }   // a sunlit limb
    const r = TELLUS.R + 300e3; S.r = mul(up, r); S.v = mul(norm(cross(GAL.gx, up)), Math.sqrt(TELLUS.mu / r)); S.throttle = 0; S.w = [0, 0, 0];
    const f = localFrame(S.r), Dv = n === 100 ? norm(add(D, mul(up, -0.25))) : D;
    cam.pitch = Math.asin(clamp(-dot(Dv, f.up), -1, 1)); cam.yaw = Math.atan2(-dot(Dv, f.e), dot(Dv, f.n)); cam.dist = 30;
    window.simulate = () => {}; render(); await settle(); bare(); return 'sky ' + n;
  }
  if (n === 3) { // Orbiter upper stage in a 200 km orbit over the day side, planet filling the lower half
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click();
    S.landed = false; stage(S); stage(S); const r = TELLUS.R + 200000, dir = norm([0.85, 0.2, 0.45]);
    S.r = mul(dir, r); S.v = mul(norm(cross([0, 1, 0], dir)), Math.sqrt(TELLUS.mu / r)); S.throttle = 0;
    const Y = norm(S.v), X = norm(cross(Y, dir)); S.q = qFromBasis(X, Y, cross(X, Y)); S.w = [0, 0, 0];
    cam.yaw = 2.4; cam.pitch = 0.32; cam.dist = 16; render(); await settle(); bare(); return 'orbit';
  }
};
