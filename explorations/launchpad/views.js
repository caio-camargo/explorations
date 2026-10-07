// Fixed reference views for judging graphics changes before/after. Paste into the page console (or load via the
// in-app browser tooling) and call refView(1..3). Each one rebuilds the same scene deterministically: same design,
// same sim time, same camera — so screenshots from different versions line up.
window.refView = async (n) => {
  const settle = () => new Promise(r => setTimeout(r, 150));
  // scene only: hide panels, HUD, messages, and the builder's CoM/CoP markers
  const bare = () => { document.querySelectorAll('.ui,#perf,#news,#msg').forEach(e => e.style.visibility = 'hidden'); if (S) S.ana = null; render(); };
  if (n === 1) { // the Orbiter on the pad, morning light
    if (mode !== 'editor') document.getElementById('bEditor').click();
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged();
    cam.yaw = 0.35; cam.pitch = 0.02; cam.dist = 40; render(); await settle(); bare(); return 'pad';
  }
  if (n === 2) { // Lunar rocket climbing through ~3 km, engine at full power, seen from the side
    stackDef = JSON.parse(JSON.stringify(PRESETS.Lunar)); editorChanged(); document.getElementById('launch').click();
    S.throttle = 1; stage(S);
    while (len(S.r) - TELLUS.R < 3000) { INP.pitch = (simT >= 8 && simT < 8.8) ? 1 : 0; if (simT > 9.8) S.sasMode = 'pro'; advPhys(S); if (typeof emitSmoke === 'function') emitSmoke(DT); }
    INP.pitch = 0; cam.yaw = 1.75; cam.pitch = 0.05; cam.dist = 55; render(); await settle(); bare(); return 'ascent';
  }
  if (n === 3) { // Orbiter upper stage in a 200 km orbit over the day side, planet filling the lower half
    stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click();
    S.landed = false; stage(S); stage(S); const r = TELLUS.R + 200000, dir = norm([0.85, 0.2, 0.45]);
    S.r = mul(dir, r); S.v = mul(norm(cross([0, 1, 0], dir)), Math.sqrt(TELLUS.mu / r)); S.throttle = 0;
    const Y = norm(S.v), X = norm(cross(Y, dir)); S.q = qFromBasis(X, Y, cross(X, Y)); S.w = [0, 0, 0];
    cam.yaw = 2.4; cam.pitch = 0.32; cam.dist = 16; render(); await settle(); bare(); return 'orbit';
  }
};
