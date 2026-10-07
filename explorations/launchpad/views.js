// Fixed reference views for judging graphics changes before/after. Paste into the page console (or load via the
// in-app browser tooling) and call refView(1..14): 1–3 whole-scene views, 4–9 part close-ups, 10 a firing engine from below, 11–14 flight marks, 15–16 the launch complex, 17–23 engine plumes. Each one rebuilds the same scene deterministically: same design,
// same sim time, same camera — so screenshots from different versions line up.
window.refView = async (n) => {
  const settle = () => new Promise(r => setTimeout(r, 150));
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
  // 15–16: the launch complex with the Orbiter on the pad: the whole complex from the south-west, then the tower and table
  if (n === 15 || n === 16) {
    if (mode !== 'editor') document.getElementById('bEditor').click();
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); HOOK.edStill = true; cam.edY = 0;
    if (n === 15) { cam.yaw = -0.9; cam.pitch = 0.28; cam.dist = 85 } else { cam.yaw = 0.25; cam.pitch = 0.12; cam.dist = 26 }
    render(); await settle(); bare(); return n === 15 ? 'complex' : 'tower';
  }
  // 17–22: engine plumes. The ship is placed at an altitude (teleported, pointing straight up, climbing at vy m/s), staged
  // nst times and run 1.5 s at full throttle, then seen from the side: [design, altitude m, stagings, yaw, pitch, dist, vy]
  const plume = { 17: ['Orbiter', 150, 1, 3.0, -0.05, 24, 60], 18: ['Lunar', 20000, 1, 1.6, -0.35, 60, 700], 19: ['Lunar', 45000, 1, 1.6, -0.35, 90, 1500],
    20: ['Orbiter', 200000, 3, 1.6, -0.1, 30, 0], 21: ['Sounding', 800, 1, 1.6, 0.0, 9, 150], 22: ['Lunar', 200000, 4, 1.6, -0.1, 14, 0],
    23: ['Hopper', 1000, 1, 1.6, -0.25, 16, 150] };
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
  if (n === 3) { // Orbiter upper stage in a 200 km orbit over the day side, planet filling the lower half
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click();
    S.landed = false; stage(S); stage(S); const r = TELLUS.R + 200000, dir = norm([0.85, 0.2, 0.45]);
    S.r = mul(dir, r); S.v = mul(norm(cross([0, 1, 0], dir)), Math.sqrt(TELLUS.mu / r)); S.throttle = 0;
    const Y = norm(S.v), X = norm(cross(Y, dir)); S.q = qFromBasis(X, Y, cross(X, Y)); S.w = [0, 0, 0];
    cam.yaw = 2.4; cam.pitch = 0.32; cam.dist = 16; render(); await settle(); bare(); return 'orbit';
  }
};
