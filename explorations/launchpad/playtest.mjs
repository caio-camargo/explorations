// The robot playtester: walks TESTING.md rows on the real GPU and records screenshots, numbers and console errors.
// usage:  node playtest.mjs [rows…]           run those rows (default: every row in ROWS), e.g. node playtest.mjs 95 96 38
//         node playtest.mjs --eval <js>…      probe: fresh tester page, evaluate each expression (awaited), screenshot after each
// Needs the folder served (python -m http.server 8799 --directory <repo>/explorations). Env: PT_URL (page, default
// http://localhost:8799/launchpad/index.html), PT_OUT (output dir, default C:/Users/caioa/dev/playtest-out), PT_W/PT_H,
// PT_IGPU=1 (the integrated GPU instead of the discrete one), SHOT_FLAGS (Chrome GPU flags, overrides both).
// One headless Chrome for the whole run, driven over CDP (Node 22+ has WebSocket). --use-angle=d3d11 keeps the real GPU and
// --force_high_performance_gpu picks the discrete one (without it, as in shot.mjs, this laptop renders on the Intel iGPU).
// Per row: storage wiped, tester flags preset before the page's scripts run (row.flags; null = no ?tester), page loaded,
// views.js and the PT helpers injected, the career gate passed into the Assembly (row.gate:true keeps the gate). Then the
// row's steps: a string is JS evaluated in the page (awaited; its value is logged), {shot:'name'} captures
// <out>/r<row>_<name>.png, {wait:ms} lets the live frame loop run, {key:'h'} / {hold:'w', ms} / {click:'#sel'} are real
// input events. checks are expressions evaluated at the end; expect[label](value) === false marks the row failed.
// Exceptions thrown in the page fail the row automatically. Output: PNGs + results.json (per row: step values, checks,
// failed expectations, console errors) in PT_OUT. Notes: NOTES § "The robot playtester".
// What it can't judge is left to the human reading the screenshots (and to Caio): feel, difficulty, fun.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
const URL0 = process.env.PT_URL || 'http://localhost:8799/launchpad/index.html', OUT = process.env.PT_OUT || 'C:/Users/caioa/dev/playtest-out';
const W = +(process.env.PT_W || 1280), H = +(process.env.PT_H || 800);
fs.mkdirSync(OUT, {recursive: true});
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- helpers injected into the page (window.PT) ----------------------------------------------------------------------
const HELPERS = String.raw`
window.PT = {
  log: [],   // every HOOK.msg / HOOK.news line since the helpers were injected, with the sim time
  hookLog() { if (HOOK.__pt) return; HOOK.__pt = 1; for (const k of ['msg', 'news']) { const f = HOOK[k]; HOOK[k] = (...a) => { PT.log.push((typeof simT === 'number' ? simT.toFixed(1) : '') + ' ' + k + ': ' + String(a[0]).replace(/<[^>]+>/g, '')); return f.apply(HOOK, a) } } },
  logSince(n) { return PT.log.slice(n) },
  // pass the "Whose program? / How does it start?" gate (first start button, default power)
  start(k) { const b = k ? document.querySelector('[data-start="'+k+'"]') : document.querySelector('[data-start]'); if (b) b.click(); return !!b },
  click(sel) { const e = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!e) throw new Error('no element ' + sel); e.click(); return true },
  clickText(sel, re) { const e = [...document.querySelectorAll(sel)].find(x => new RegExp(re).test(x.textContent)); if (!e) throw new Error('no ' + sel + ' ~ ' + re); e.click(); return e.textContent.trim().slice(0, 60) },
  key(k, opt = {}) { const ev = new KeyboardEvent('keydown', {key: k, bubbles: true, ...opt}); (document.activeElement || document.body).dispatchEvent(ev); window.dispatchEvent(new KeyboardEvent('keyup', {key: k, bubbles: true})); return k },
  text(sel) { const e = document.querySelector(sel); return e ? e.innerText : null },
  vis(sel) { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('.hidden') },
  rect(sel) { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round) },
  overlap(a, b) { const A = PT.rect(a), B = PT.rect(b); if (!A || !B) return null; const w = Math.min(A[2], B[2]) - Math.max(A[0], B[0]), h = Math.min(A[3], B[3]) - Math.max(A[1], B[1]); return w > 0 && h > 0 ? w * h : 0 },
  preset(name) { stackDef = JSON.parse(JSON.stringify(PRESETS[name])); editorChanged(); return name },
  launch() { document.getElementById('launch').click(); return mode },
  // fly with the physics directly (rAF in a headless tab runs, but slowly for long flights): steps until cond or tmax s
  fly(cond, tmax = 600, opts = {}) { const t0 = simT; let n = 0; while (S.alive && !cond() && simT - t0 < tmax) { if (opts.ascent) { INP.pitch = (simT >= (opts.kick||8) && simT < (opts.kick||8) + (opts.kickLen||0.8)) ? 1 : 0; if (simT > (opts.kick||8) + 1.8 && S.sasMode !== 'pro' && sasModeOK(S, 'pro')) { S.sas = true; S.sasMode = 'pro' } } if (opts.autostage && simT - t0 > 3 && S.thrust <= 0 && S.evIdx < S.events.length && simT - (PT._st ?? -9) > 1) { stage(S); PT._st = simT } if (opts.each) opts.each(); advPhys(S); if (opts.smoke) emitSmoke(DT); n++ } INP.pitch = 0; return {t: +(simT - t0).toFixed(1), steps: n, alive: S.alive} },
  alt() { return len(S.r) - S.body.R },
  agl() { return groundGap(S) },
  // the vessel's nose against its airflow, degrees
  aoaDeg() { const va = sub(S.v, surfVel(S.body, S.r)); return Math.acos(clamp(dot(norm(va), qrot(S.q, [0, 1, 0])), -1, 1)) * 57.2958 },
  orbit() { const r = len(S.r), v2 = dot(S.v, S.v), mu = S.body.mu, a = 1 / (2 / r - v2 / mu), h = len(cross(S.r, S.v)), e = Math.sqrt(Math.max(0, 1 - h * h / (mu * a))); return {ap: a * (1 + e) - S.body.R, pe: a * (1 - e) - S.body.R} },
  // show the HUD and frame the camera on the ship: yaw, pitch, dist
  look(yaw, pitch, dist) { cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; PT.showUI(); render(); return true },
  hud() { if (typeof updateHUD === 'function') updateHUD(); return document.getElementById('info').innerText },
  news() { const n = document.getElementById('news'); return n ? n.innerText : '' },
  msg() { const m = document.getElementById('msg'); return m ? m.innerText : '' },
  showUI() { document.querySelectorAll('.ui,#news,#msg').forEach(e => e.style.visibility = ''); if (mode === 'flight') updateHUD(); render(); return true },
  frames(n) { return new Promise(r => { let k = 0; const f = () => (++k >= n ? r(k) : requestAnimationFrame(f)); requestAnimationFrame(f) }) },
};
PT.hookLog();
true`;

// ---- Chrome over CDP -------------------------------------------------------------------------------------------------
const port = 9300 + Math.floor(Math.random() * 500);
const ch = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`,
  ...(process.env.SHOT_FLAGS ? process.env.SHOT_FLAGS.split(' ') : (process.env.PT_IGPU ? ['--use-angle=d3d11', '--enable-gpu'] : ['--use-angle=d3d11', '--enable-gpu', '--force_high_performance_gpu'])), '--ignore-gpu-blocklist',
  '--hide-scrollbars', `--window-size=${W},${H}`, `--user-data-dir=${process.env.TEMP}/ptprof${port}`, 'about:blank'], {stdio: 'ignore'});
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break } catch {} await wait(200) }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); let logs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400));
  else if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; logs.push('EXC ' + (d.exception?.description || d.text).slice(0, 600)) } };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params})) });
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', {width: W, height: H, deviceScaleFactor: 1, mobile: false});
const ev = async (expression, timeout = 300000) => { const r = await cmd('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true, timeout});
  if (r.result?.exceptionDetails) return {err: (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 600)};
  return {val: r.result?.result?.value} };
const shot = async file => { const s = await cmd('Page.captureScreenshot', {format: 'png'}); fs.writeFileSync(`${OUT}/${file}`, Buffer.from(s.result.data, 'base64')); return file };
// real key presses through CDP (the page's handlers listen on window keydown/keyup)
const KEYCODE = {Escape: 27, Backspace: 8, Tab: 9, Enter: 13, ' ': 32, Shift: 16, Control: 17, F2: 113, Delete: 46, ',': 188, '.': 190, '/': 191, '[': 219, ']': 221};
const keyEv = (type, key) => { const vk = KEYCODE[key] ?? key.toUpperCase().charCodeAt(0);
  return cmd('Input.dispatchKeyEvent', {type, key, code: key.length === 1 && /[a-z]/i.test(key) ? 'Key' + key.toUpperCase() : key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && key.length === 1 ? {text: key} : {})}) };
const press = async (key, ms = 60) => { await keyEv('keyDown', key); await wait(ms); await keyEv('keyUp', key) };
const clickAt = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', {type, x, y, button: 'left', clickCount: 1}) };
let boot = null;
// a fresh page: storage wiped, tester flags preset (null: no ?tester), then views.js and PT
async function fresh(flags = {money: true, kh: true, tools: true, nofail: true, fast: true}, query, gate) {
  await cmd('Page.navigate', {url: 'about:blank'}); await wait(200);
  await cmd('Storage.clearDataForOrigin', {origin: new URL(URL0).origin, storageTypes: 'all'});
  if (boot) await cmd('Page.removeScriptToEvaluateOnNewDocument', {identifier: boot});
  boot = (await cmd('Page.addScriptToEvaluateOnNewDocument', {source: flags ? `try{if(!localStorage.getItem('launchpad-tester-flags'))localStorage.setItem('launchpad-tester-flags',${JSON.stringify(JSON.stringify(flags))})}catch(e){}` : ''})).result.identifier;
  const url = URL0 + (query ?? (flags ? '?tester' : ''));
  await cmd('Page.navigate', {url});
  for (let i = 0; i < 100; i++) { await wait(200); const r = await ev('typeof render==="function"&&typeof PROG==="object"&&document.readyState==="complete"'); if (r.val) break }
  await wait(1500);
  await ev(`new Promise(r=>{const s=document.createElement('script');s.src='views.js';s.onload=()=>r(true);s.onerror=()=>r(false);document.head.appendChild(s)})`);
  await ev(HELPERS);
  if (!gate) await ev(`PT.start(); go('assembly'); screenNow()`);   // past the career gate, in the assembly (gate:true keeps the gate)
}

// ---- the rows --------------------------------------------------------------------------------------------------------
const ROWS = {};
const views = (...ns) => ns.flatMap(n => [`refView(${n})`, {shot: 'v' + n}]);
// a live launch from the pad, rendered after each listed time (s since launch), the sim frozen for each capture: the pad's
// rig animations (gantry roll-back over 14 s, arms and hold-downs at liftoff) run on sim time
const padWatch = (design, times, cam, ignite = 15) => [
  `PT.preset(${JSON.stringify(design)}); PT.launch(); window.simulate0 = window.simulate0 || window.simulate; window.simulate = () => {}; cam.yaw=${cam[0]}; cam.pitch=${cam[1]}; cam.dist=${cam[2]}; PT.t0 = simT; PT.lit = 0; render(); 'ok'`,
  ...times.flatMap(t => [`(()=>{ while (simT - PT.t0 < ${t}) { if (simT - PT.t0 >= ${ignite} && !PT.lit) { PT.lit = 1; S.throttle = 1; stage(S) } advPhys(S); emitSmoke(DT); render() } document.querySelectorAll('.ui,#news,#msg').forEach(e => e.style.visibility = 'hidden'); render(); return {t: +(simT - PT.t0).toFixed(1), up: +(PT.alt()).toFixed(1)} })()`, {shot: `${design.replace(/ /g, "")}_t${t}`}])];

// Visuals & effects: mostly the reference scenes in views.js
ROWS[35] = {title: 'part close-ups', steps: [...views(4, 5, 6, 7, 8, 9),
  // the newer parts in the builder: camera, antenna, port, RCS, claw, probe core on a short stack
  `(async()=>{ document.querySelectorAll('.ui,#perf,#news,#msg').forEach(e=>e.style.visibility=''); go('assembly'); stackDef=['port','core','cam','ant','rwheel','t1','claw'].filter(k=>PARTS[k]); editorChanged(); HOOK.edStill=true; cam.edY=0; cam.yaw=0.6; cam.pitch=0.1; cam.dist=7; render(); await new Promise(r=>setTimeout(r,200)); document.querySelectorAll('.ui,#perf,#news,#msg').forEach(e=>e.style.visibility='hidden'); return stackDef })()`, {shot: 'newparts'},
  `Object.keys(PARTS).join(' ')`]};
ROWS[36] = {title: 'flight marks', steps: views(11, 12, 13, 14)};
ROWS[37] = {title: 'launch complex and liftoff', steps: [...views(15, 16, 17),
  ...padWatch('Sounding', [14, 15.4, 16.5], [0.9, 0.1, 30]), ...padWatch('Orbiter', [15.4, 16.5, 18], [0.9, 0.1, 50]), ...padWatch('Big Lunar', [15.4, 16.5, 18.5], [0.9, 0.1, 90])]};
ROWS[108] = {title: 'gantry roll-back from wide rockets', steps: [...padWatch('Crewed Lunar', [0, 4, 8, 11, 14], [-0.5, 0.15, 70], 99), ...padWatch('Asparagus', [0, 4, 8, 11, 14], [-0.5, 0.15, 55], 99)]};
ROWS[38] = {title: 'plumes', steps: views(30, 31, 32, 33, 34, 35, 36)};
ROWS[39] = {title: 'plume on the pad', steps: views(60, 61, 62, 63, 64)};
ROWS[40] = {title: 'night launch', steps: views(65, 66, 67)};
ROWS[41] = {title: 'ignition and shutdown', steps: views(68, 69, 70, 71, 72, 73, 74, 75, 76, 77)};
ROWS[42] = {title: 're-entry plasma', steps: views(40, 41, 42, 43, 44, 45)};
ROWS[43] = {title: 'vapor cones', steps: views(50, 51, 52, 53)};
ROWS[44] = {title: 'clouds with depth', steps: views(80, 81, 82, 83)};
ROWS[46] = {title: 'escape tower, dust, explosions', steps: views(84, 85, 86, 87, 88, 89, 90, 91, 92, 93)};
ROWS[48] = {title: 'HUD gauges', steps: views(94, 95, 96)};

// Flight & physics
const FLY = (design, extra = '') => `PT.preset(${JSON.stringify(design)}); PT.launch(); ${extra} S.throttle = 1; stage(S); PT.n0 = PT.log.length;`;
ROWS[3] = {title: 'yank the Lunar at max-q', steps: [
  ...[3.5, 8].flatMap(y => [`PT.yankS = ${y}`, `(()=>{ ${FLY('Lunar')} const a = PT.fly(() => S.qdyn >= 15000, 300, {ascent: true}); const q0 = S.qdyn, h0 = PT.alt(), n0 = S.parts.filter(p=>p.on).length;
     S.sas = false; renderSAS(); const t0 = simT; let qmax = 0, load = 0, aoa = 0; while (S.alive && simT - t0 < PT.yankS) { INP.pitch = 1; advPhys(S); qmax = Math.max(qmax, S.qdyn); load = Math.max(load, S.maxLoad); aoa = Math.max(aoa, PT.aoaDeg()) } INP.pitch = 0;
     return {yankS: PT.yankS, q0: +(q0/1000).toFixed(1), h0: +(h0/1000).toFixed(1), qmax: +(qmax/1000).toFixed(1), peakJointLoad: +load.toFixed(2), maxAoA: +aoa.toFixed(1), alive: S.alive, partsBefore: n0, partsAfter: S.parts.filter(p=>p.on).length, log: PT.logSince(PT.n0)} })()`,
  `PT.look(1.75, 0.05, 60)`, {shot: 'yank' + y}]),
  // a gentle ascent (kick at 8 s, prograde) to 60 km never breaks
  `(()=>{ ${FLY('Lunar')} PT.fly(() => PT.alt() > 60000, 400, {ascent: true, autostage: true}); return {alive: S.alive, alt: +(PT.alt()/1000).toFixed(1), maxQ: +(GQ.peak/1000).toFixed(1), failures: PT.logSince(PT.n0).filter(l => /Structural/.test(l))} })()`],
  checks: {gentleOK: `PT.log.filter(l=>/Structural/.test(l)).length`}};
ROWS[4] = {title: 'Orbiter without its fin ring', steps: [
  `go('assembly'); stackDef = PRESETS.Orbiter.filter(k => k !== 'fins'); editorChanged(); render(); document.querySelector('#editor .right').innerText.match(/AERODYNAMICS[^]{0,700}/i)?.[0]`, {shot: 'builder'},
  // climb with SAS to 25 km, then engine off, SAS off, coast 40 s; the same with the fins as the control
  ...[['nofins', `PRESETS.Orbiter.filter(k => k !== 'fins')`], ['fins', `PRESETS.Orbiter`]].flatMap(([tag, st]) => [
    `(()=>{ stackDef = JSON.parse(JSON.stringify(${st})); editorChanged(); PT.launch(); S.throttle = 1; stage(S); PT.fly(() => PT.alt() > 12000, 300, {ascent: true});
       S.throttle = 0; S.sas = false; renderSAS(); const t0 = simT, aoa = []; let w = 0; while (S.alive && simT - t0 < 40) { advPhys(S); if (Math.round((simT - t0) / DT) % Math.round(5 / DT) === 0) aoa.push(+PT.aoaDeg().toFixed(1)); w = Math.max(w, len(S.w)) }
       return {tag: '${tag}', alt: +(PT.alt()/1000).toFixed(1), aoaEvery5s: aoa, maxSpin: +w.toFixed(2), alive: S.alive} })()`, `PT.look(1.75, 0.05, 40)`, {shot: tag}])]};
ROWS[5] = {title: 'Heavy boosters separate', steps: [
  `(()=>{ ${FLY('Heavy')} PT.fly(() => PT.log.slice(PT.n0).some(l => /burnout|empty/i.test(l)), 120, {ascent: true}); return {t: +simT.toFixed(1), alt: +(PT.alt()/1000).toFixed(1), log: PT.logSince(PT.n0)} })()`,
  `PT.look(1.75, 0.05, 45)`, {shot: 'before'},
  `(()=>{ const d0 = debris.length; stage(S); const t0 = simT; window.simulate0 = window.simulate0 || window.simulate; window.simulate = () => {}; while (simT - t0 < 0.8) { advPhys(S); emitSmoke(DT); render() }
     // each booster's speed away from the core's axis (outward +), and how far out it is, in the core's frame
     const Y = qrot(S.q, [0, 1, 0]), perp = x => sub(x, mul(Y, dot(x, Y)));
     const out = debris.slice(d0).map(d => { const rel = sub(d.v, S.v), off = perp(sub(d.r, S.r)); return {outward: +dot(rel, norm(off)).toFixed(1), across: +len(perp(rel)).toFixed(1), dist: +len(off).toFixed(1)} });
     PT.look(1.75, 0.05, 45); return {debris: debris.length - d0, sep: out, log: PT.logSince(PT.n0).slice(-3)} })()`, {shot: 'sep08'},
  `(()=>{ const t0 = simT; while (simT - t0 < 2) { advPhys(S); emitSmoke(DT); render() } PT.look(1.75, 0.05, 60); return document.getElementById('stages').innerText + ' || ' + PT.hud().split(String.fromCharCode(10)).filter(l=>/Δv|Mass/.test(l)).join(' ') })()`, {shot: 'sep28'}],
  checks: {}};
ROWS[7] = {title: 'Asparagus booster prompt', steps: [
  `(()=>{ ${FLY('Asparagus')} PT.fly(() => PT.log.slice(PT.n0).some(l => /stage to drop/i.test(l)), 200, {ascent: true}); return {t: +simT.toFixed(1), alt: +(PT.alt()/1000).toFixed(1), log: PT.logSince(PT.n0), stages: document.getElementById('stages').innerText} })()`,
  `PT.look(1.75, 0.05, 45); document.getElementById('msg').style.opacity = 1; renderStages(); document.getElementById('stages').innerText`, {shot: 'prompt'},
  `(()=>{ stage(S); PT.fly(() => PT.log.slice(PT.n0).filter(l => /stage to drop|burnout/i.test(l)).length >= 2, 200, {ascent: true}); return {t: +simT.toFixed(1), log: PT.logSince(PT.n0)} })()`,
  `PT.look(1.75, 0.05, 45); renderStages(); 'ok'`, {shot: 'prompt2'}]};
// entries from 95 km at speed x vf of circular, ~2 deg down, held retrograde (as refView 13): bare pod vs shielded, low orbit vs a Selene return
const ENTRY = (stack, vf, tag) => `(()=>{ stackDef = ${JSON.stringify(stack)}; editorChanged(); PT.launch(); S.landed = false; S.mkLift = true;
  const r = TELLUS.R + 95000, dir = norm([0.9, 0.3, 0.3]), v0 = norm(cross([0, 1, 0], dir)), vc = Math.sqrt(TELLUS.mu / r);
  S.r = mul(dir, r); S.v = add(mul(v0, vc * ${vf}), mul(dir, -vc * ${vf > 1.1 ? 0.25 : 0.035})); S.throttle = 0; S.sas = true; S.sasMode = 'retro';
  const Y = mul(norm(S.v), -1), X = norm(cross(Y, dir)); S.q = qFromBasis(X, Y, cross(X, Y)); S.w = [0, 0, 0]; const n0 = PT.log.length;
  let Tmax = 0, gmax = 0, hT = 0; const t0 = simT; while (S.alive && PT.alt() > 15000 && simT - t0 < 1500) { advPhys(S); const T = Math.max(...S.parts.filter(p => p.on).map(p => p.T)); if (T > Tmax) { Tmax = T; hT = PT.alt() } gmax = Math.max(gmax, S.gload) }
  return {tag: '${tag}', alive: S.alive, alt: +(PT.alt()/1000).toFixed(1), v: +len(S.v).toFixed(0), Tmax: +Tmax.toFixed(0), atKm: +(hT/1000).toFixed(0), gmax: +gmax.toFixed(1), parts: S.parts.filter(p=>p.on).map(p => p.d.key + (p.res && p.res.ablator != null ? ':abl ' + p.res.ablator.toFixed(3) : '')).join(' '), log: PT.logSince(n0)} })()`;
ROWS[8] = {title: 're-entry: bare pod and shielded pod', steps: [ENTRY(['chute', 'pod'], 1.0, 'bare LEO'), `PT.look(2.2, -0.35, 6)`, {shot: 'bare_leo'},
  ENTRY(['chute', 'pod'], 1.38, 'bare Selene return'), ENTRY(['chute', 'pod', 'shield'], 1.38, 'shield Selene return'), `PT.look(2.2, -0.35, 6)`, {shot: 'shield_selene'}]};
ROWS[9] = {title: 'parachute landing', steps: [
  `(()=>{ ${FLY('Passenger')} PT.fly(() => S.thrust <= 0 && simT > 5, 200); for (let k = 0; k < 4 && !S.chute; k++) { stage(S); PT.fly(() => false, 1) } const n0 = PT.log.length; let drog = null, main = null, apex = 0; const t0 = simT;
     PT.fly(() => S.landed || !S.alive, 3000, {each: () => { apex = Math.max(apex, PT.alt()); if (drog == null && S.chuteA > 0) drog = {agl: +PT.agl().toFixed(0), v: +len(sub(S.v, surfVel(S.body, S.r))).toFixed(0), t: +simT.toFixed(0)}; if (main == null && S.chuteA > 7) main = {agl: +PT.agl().toFixed(0), t: +simT.toFixed(0)}; if (PT.agl() < 30) PT.vLast = +len(sub(S.v, surfVel(S.body, S.r))).toFixed(1) }});
     return {apexKm: +(apex/1000).toFixed(1), drogue: drog, main, touchdown: PT.vLast, landed: S.landed, alive: S.alive, descentS: +(simT - t0).toFixed(0), log: PT.logSince(n0)} })()`, `PT.look(0.9, 0.1, 12)`, {shot: 'landed'}]};

// Attitude control
// put the current stack in a 200 km circular orbit, nose prograde, still
const ORBIT = `(()=>{ S.landed = false; S.mkLift = true; const r = TELLUS.R + 200000, dir = norm([0.85, 0.2, 0.45]); S.r = mul(dir, r); S.v = mul(norm(cross([0, 1, 0], dir)), Math.sqrt(TELLUS.mu / r)); S.throttle = 0;
  const Y = norm(S.v), X = norm(cross(Y, dir)); S.q = qFromBasis(X, Y, cross(X, Y)); S.w = [0, 0, 0]; S.wH = [0, 0, 0]; return true })()`;
// stage until the named engine is the one lit (drops the first stage and boosters), engine off again
const UPPER = eng => `(()=>{ for (let k = 0; k < 8 && !activeEngines(S).some(e => e.d.key === '${eng}'); k++) stage(S); return activeEngines(S).map(e => e.d.key).join(',') + ' ' + (S.mass/1000).toFixed(1) + ' t' })()`;
// SAS Stability re-aimed 90 deg away (toward the orbit's radial): seconds until the nose is within 5 deg and nearly still
const TURN = thr => `(()=>{ ${ORBIT}; S.sas = true; S.sasMode = 'stab'; S.hold = norm(S.r); S.throttle = ${thr}; const t0 = simT; let t5 = null;
  while (simT - t0 < 400) { advPhys(S); const ang = Math.acos(clamp(dot(qrot(S.q, [0, 1, 0]), S.hold), -1, 1)) * 57.2958; if (ang < 5 && len(S.w) < 0.02) { t5 = simT - t0; break } }
  return {throttle: ${thr}, seconds: t5 == null ? '>400' : +t5.toFixed(1), wheelsPct: S.hmax > 0 ? +(len(S.wH || [0,0,0]) / S.hmax * 100).toFixed(0) : null} })()`;
ROWS[103] = {title: 'turning big stacks on wheels, then with the engine', steps: [
  ...[['Orbiter', 'petrel'], ['Lunar', 'petrel'], ['Crewed Lunar', 'petrel']].flatMap(([d, e]) => [`PT.preset(${JSON.stringify(d)}); PT.launch(); ${JSON.stringify(d)} + ': ' + ${UPPER(e)}`, TURN(0), `PT.preset(${JSON.stringify(d)}); PT.launch(); ${UPPER(e)}`, TURN(1)]),
  // the whole stack parked in orbit, wheels only: the case the builder's "90° turn in vacuum … wheels" line describes
  ...['Orbiter', 'Lunar', 'Crewed Lunar'].flatMap(d => [`PT.preset(${JSON.stringify(d)}); go('assembly'); ${JSON.stringify(d)} + ' full, builder says: ' + (document.querySelector('#editor .right').innerText.match(/90° turn[^\\n]*/)?.[0])`, `PT.launch(); 'ok'`, TURN(0)]),
  `PT.look(2.4, 0.2, 60)`, {shot: 'crewed_turned'}]};
ROWS[104] = {title: 'fill the wheels and unload them', steps: [
  // the Orbiter's upper stage (what you have in orbit) and, as a heavier case, the whole stack parked in orbit
  ...[['upper', UPPER('petrel')], ['full', `'full stack ' + (S.mass/1000).toFixed(1) + ' t'`]].flatMap(([tag, prep]) => [
  `PT.preset('Orbiter'); PT.launch(); ${prep}`, ORBIT,
  // SAS off, pitch key held 30 s: spin (rad/s) and storage every 2 s, and anything that breaks
  `(()=>{ S.sas = false; const n0 = PT.log.length, t0 = simT, tr = []; while (simT - t0 < 30 && S.alive) { INP.pitch = 1; advPhys(S); if (Math.round((simT - t0) / DT) % Math.round(2 / DT) === 0) tr.push([+(simT - t0).toFixed(0), +len(S.w).toFixed(2), +(len(S.wH) / S.hmax * 100).toFixed(0)]) } INP.pitch = 0;
     return {tag: '${tag}', I: S.I.map(v => +v.toFixed(0)), hmax: S.hmax, tSpinPctFull: tr, broke: PT.logSince(n0), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Wheels/.test(l)).join('')} })()`,
  `PT.look(2.4, 0.2, 18)`, {shot: tag + '_held'},
  // SAS on (Stability): stop the spin; then a 3 s burn (lights the next engine if none is lit) and 5 s more
  `(()=>{ S.sas = true; S.sasMode = 'stab'; S.hold = null; const t0 = simT; while (simT - t0 < 20) advPhys(S); const a = {afterSAS20s: {spin: +len(S.w).toFixed(3), wheelsPct: +(len(S.wH) / S.hmax * 100).toFixed(0)}};
     if (!activeEngines(S).length) stage(S); S.throttle = 1; const t1 = simT; while (simT - t1 < 3) advPhys(S); S.throttle = 0; a.engine = activeEngines(S).map(e => e.d.key).join(); const t2 = simT; while (simT - t2 < 5) advPhys(S); a.after3sBurn = {spin: +len(S.w).toFixed(3), wheelsPct: +(len(S.wH) / S.hmax * 100).toFixed(0)}; return a })()`]),
  // the unloading path on its own: the full stack held still under SAS with its wheels 95 % full, then the Kestrel at full throttle
  `(()=>{ S.w = [0, 0, 0]; S.wH = [0, 0, 0.95 * S.hmax]; S.sas = true; S.sasMode = 'stab'; S.hold = null; S.throttle = 1; const t0 = simT, tr = []; while (simT - t0 < 12) { advPhys(S); if (Math.round((simT - t0) / DT) % Math.round(1 / DT) === 0) tr.push(+(len(S.wH) / S.hmax * 100).toFixed(0)) } S.throttle = 0; return {burnWheelsPctEverySecond: tr, engine: activeEngines(S).map(e => e.d.key).join()} })()`]};
ROWS[106] = {title: "the builder's Control block", steps: [
  ...['Orbiter', 'Heavy', 'Sounding', 'Passenger', 'Lunar'].flatMap(d => [`go('assembly'); PT.preset(${JSON.stringify(d)}); render(); ${JSON.stringify(d)} + ' :: ' + (document.querySelector('#editor .right').innerText.match(/CONTROL[^]{0,420}/)?.[0] || 'no CONTROL block')`]),
  `stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); stackDef.splice(2, 0, 'rwheel'); editorChanged(); render(); 'Orbiter + wheel :: ' + (document.querySelector('#editor .right').innerText.match(/CONTROL[^]{0,420}/)?.[0])`,
  `document.querySelector('#editor .right').scrollTop = 1e4; 'ok'`, {shot: 'orbiter_wheel'}]};
// steerable fins: a probe dart coasting in the air obeys SAS; in vacuum it doesn't (only the probe core's small wheel)
ROWS[105] = {title: 'steerable fins', steps: [
  `go('assembly'); stackDef = ['core', 't1', 'cfins', 'sparrow']; editorChanged(); render(); document.querySelector('#editor .right').innerText.match(/CONTROL[^]{0,420}/)?.[0]`, {shot: 'dart_builder'},
  `(()=>{ PT.launch(); S.throttle = 1; stage(S); PT.fly(() => S.thrust <= 0 && simT > 3, 120); const h = PT.alt(), M = S.mach; S.sas = true; S.sasMode = 'stab'; const up = norm(S.r), e = norm(cross([0, 1, 0], up)); S.hold = norm(add(qrot(S.q, [0, 1, 0]), mul(e, 0.35)));
     const t0 = simT; let t5 = null; while (simT - t0 < 30) { advPhys(S); if (t5 == null && Math.acos(clamp(dot(qrot(S.q, [0, 1, 0]), S.hold), -1, 1)) < 0.06) t5 = simT - t0 } return {coastingAt: +(h/1000).toFixed(1) + ' km M ' + M.toFixed(2), reachedNewHoldIn: t5 == null ? '>30 s' : +t5.toFixed(1)} })()`,
  `PT.look(1.75, 0.05, 12)`, {shot: 'dart_air'},
  `(()=>{ ${ORBIT}; S.sas = true; S.sasMode = 'stab'; S.hold = norm(S.r); const t0 = simT; let t5 = null; while (simT - t0 < 120) { advPhys(S); if (t5 == null && Math.acos(clamp(dot(qrot(S.q, [0, 1, 0]), S.hold), -1, 1)) < 0.09) t5 = simT - t0 } return {vacuum90degTurn: t5 == null ? '>120 s' : +t5.toFixed(1) + ' s'} })()`]};
// gimbal: an ascent under SAS (kick, prograde) on each preset; the nose's wobble about the flight path after the kick
ROWS[107] = {title: 'gimbal: no wobble under SAS', steps: [
  ...['Orbiter', 'Heavy', 'Asparagus', 'Lunar', 'Big Lunar', 'Crewed Lunar', 'Sounding'].map(d => `(()=>{ PT.preset(${JSON.stringify(d)}); PT.launch(); S.throttle = 1; stage(S); const aoa = []; let last = 0, wmax = 0;
     PT.fly(() => PT.alt() > 30000 || simT > 150, 200, {ascent: true, each: () => { if (simT > 14 && S.mach > 0.3 && S.thrust > 0) { aoa.push(PT.aoaDeg()); wmax = Math.max(wmax, len(S.w)) } }});
     const m = aoa.reduce((a, b) => a + b, 0) / Math.max(1, aoa.length), sd = Math.sqrt(aoa.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, aoa.length));
     let rev = 0; for (let i = 2; i < aoa.length; i++) if ((aoa[i] - aoa[i-1]) * (aoa[i-1] - aoa[i-2]) < 0 && Math.abs(aoa[i] - aoa[i-1]) > 0.02) rev++;
     return ${JSON.stringify(d)} + ': AoA mean ' + m.toFixed(2) + ' sd ' + sd.toFixed(2) + ' max ' + Math.max(0, ...aoa).toFixed(1) + ' deg, rate max ' + wmax.toFixed(3) + ' rad/s, AoA reversals ' + rev + ' over ' + (aoa.length * DT).toFixed(0) + ' s, alive ' + S.alive })()`)]};

// Launch sites & terrain
const PICK = `(go('rollout'), document.getElementById('sitePick').innerText)`;   // the picker lives in the Rollout since slice 5 (flow, Q4)
const setSite = expr => `(()=>{ const t = ${expr}; if (!t) return 'no such site'; const sel = document.getElementById('siteSel'); sel.value = t.id; sel.dispatchEvent(new Event('change')); render(); return t.name + ' :: ' + ${PICK} })()`;
// an ascent to space from the current site: kick, prograde, staging, cut at a 120 km apoapsis, coast to 100 km; the
// orbit's inclination to the equator (Tellus spins about +Y)
const TO_SPACE = `(()=>{ PT.launch(); S.throttle = 1; stage(S); PT.fly(() => PT.orbit().ap > 120000, 600, {ascent: true, autostage: true}); S.throttle = 0; PT.fly(() => PT.alt() > 100000 || dot(S.v, norm(S.r)) < 0, 900);
  const h = cross(S.r, S.v), inc = Math.acos(Math.abs(h[1]) / len(h)) * 57.2958; return {site: curSite().name, alt: +(PT.alt()/1000).toFixed(0), inclination: +inc.toFixed(1), ap: +(PT.orbit().ap/1000).toFixed(0), pe: +(PT.orbit().pe/1000).toFixed(0), alive: S.alive} })()`;
ROWS[25] = {title: 'site picker; a polar launch', steps: [`go('assembly'); PT.preset('Orbiter'); ${PICK}`, {shot: 'picker_home'},
  `SITES.map(t => t.name + ' (' + fmtLat(t.lat) + (t.power === HOME ? ', ours' : '') + (siteAccessOf(t).ok ? '' : ', closed') + ')').join(' | ')`,
  setSite(`SITES.filter(t => t.power === HOME && siteAccessOf(t).ok).sort((a, b) => Math.abs(b.lat) - Math.abs(a.lat))[0]`), {shot: 'picker_polar'},
  `({lowestInclination: curSite().minInc, lat: curSite().lat})`, TO_SPACE, `PT.look(2.4, 0.2, 30)`, {shot: 'polar_space'}]};
ROWS[26] = {title: 'a foreign site', steps: [`go('assembly'); PT.preset('Orbiter'); 'ok'`,
  setSite(`SITES.find(t => !siteAccessOf(t).ok)`), {shot: 'refused_picker'},
  `(()=>{ const m0 = PT.log.length; document.getElementById('launch').click(); return {screen: screenNow(), log: PT.logSince(m0), msg: PT.msg()} })()`, {shot: 'refused_launch'},
  setSite(`SITES.find(t => t.power === HOME && t !== homeSite() && siteAccessOf(t).ok)`), `PT.launch(); ({screen: screenNow(), site: S.site && S.site.name, landed: S.landed, alt: +PT.alt().toFixed(0), agl: +PT.agl().toFixed(1)})`, `PT.look(-0.5, 0.15, 45)`, {shot: 'moved'}]};
ROWS[27] = {title: 'the Sea Platform', steps: [`go('assembly'); PT.preset('Orbiter'); 'ok'`, setSite(`SITES.find(t => t.kind === 'sea')`),
  `(()=>{ HOOK.edStill = true; cam.edY = 0; [cam.yaw, cam.pitch, cam.dist] = [-0.9, 0.28, 85]; render(); document.querySelectorAll('.ui,#perf,#news,#msg').forEach(e => e.style.visibility = 'hidden'); render(); return curSite().name })()`, {shot: 'sea_sw'},
  `(()=>{ [cam.yaw, cam.pitch, cam.dist] = [1.24, 0.6, 420]; render(); return true })()`, {shot: 'sea_high'},
  `(()=>{ [cam.yaw, cam.pitch, cam.dist] = [2.6, 0.05, 160]; render(); return true })()`, {shot: 'sea_low'}]};
ROWS[28] = {title: 'storm scrub', steps: [`go('assembly'); PT.preset('Orbiter'); 'ok'`,
  // tester date +1 day until the picker's sky line says storms (at most 120 days), then launch
  `(()=>{ for (let d = 0; d < 120; d++) { if (siteWeather(curSite(), PROG.day * DAY_S).scrub) break; testAdvance(1) } renderSites(); return {day: PROG.day, sky: siteWeather(curSite(), PROG.day * DAY_S).word, picker: ${PICK}.match(/weather today[^\\n]*/)?.[0]} })()`, {shot: 'storm_picker'},
  `(()=>{ const m0 = PT.log.length, d0 = PROG.day; PT.launch(); S.throttle = 1; stage(S); PT.fly(() => false, 5); return {slipDays: +(PROG.day - d0).toFixed(1), log: PT.logSince(m0)} })()`, `PT.look(-0.5, 0.15, 45)`, {shot: 'storm_launch'}]};
ROWS[29] = {title: 'downrange warning', steps: [`go('assembly'); PT.preset('Orbiter'); 'ok'`,
  `SITES.filter(t => downrangeWarning(t)).map(t => t.name + ': ' + downrangeWarning(t)).join(' | ') || 'no site has a downrange warning'`,
  setSite(`SITES.filter(t => downrangeWarning(t)).sort((a, b) => (siteAccessOf(b).ok ? 1 : 0) - (siteAccessOf(a).ok ? 1 : 0))[0]`), {shot: 'warning'},
  `(()=>{ const m0 = PT.log.length; PT.launch(); PT.fly(() => false, 5); return PT.logSince(m0) })()`]};
// the Link row along an Orbiter flight: climb, coast to apoapsis, a lap on rails-free physics, then an entry
ROWS[110] = {title: 'the Link row through a flight', steps: [
  `(()=>{ PT.preset('Orbiter'); PT.launch(); S.throttle = 1; stage(S); const seen = []; let last = '';
     const note = tag => { const l = linkOf(S), w = l.ok ? (l.st ? l.st.name : l.why) : l.why; if (w !== last) { seen.push(tag + ' T+' + simT.toFixed(1) + ' ' + (PT.alt()/1000).toFixed(1) + ' km M ' + S.mach.toFixed(1) + ': ' + w); last = w } };
     PT.fly(() => PT.orbit().ap > 150000, 600, {ascent: true, autostage: true, each: () => note('climb')}); S.throttle = 0;
     PT.fly(() => dot(S.v, norm(S.r)) < 0, 1200, {each: () => note('coast')});
     // a circular orbit at this height, then 3,000 s of it (a good part of a lap)
     const r = len(S.r), up = norm(S.r), hdir = norm(sub(S.v, mul(up, dot(S.v, up)))); S.v = mul(hdir, Math.sqrt(TELLUS.mu / r));
     const t0 = simT; while (simT - t0 < 3000 && S.alive) { advPhys(S); if (Math.round((simT - t0) / DT) % 50 === 0) note('orbit') }
     // de-orbit: 8 % off the speed, retrograde hold, down to 20 km
     S.v = mul(S.v, 0.92); S.sas = true; S.sasMode = 'retro'; PT.fly(() => PT.alt() < 20000, 3000, {each: () => note('entry')});
     return seen })()`, `PT.look(2.2, -0.3, 12)`, {shot: 'entry_end'}]};
// PLAYTEST #17 / Q17 + Q20: hard climbs through max heating show no blackout on the Link row and draw no plasma shell
// (plasmaHeat over render.js's 1.5e4 gate); the entry half is row 110's
ROWS[122] = {title: 'no blackout or plasma shell on a hard climb', steps: ['Heavy', 'Asparagus'].flatMap(d => [
  `(()=>{ go('assembly'); PT.preset('${d}'); PT.launch(); S.throttle = 1; stage(S); const seen = new Set(); let qMax = 0, shell = 0, at = null;
     PT.fly(() => PT.orbit().ap > 150000 || PT.alt() > 90000, 600, {ascent: true, autostage: true, each: () => { const l = linkOf(S); seen.add(l.ok ? (l.st ? 'station' : l.why) : l.why);
       const h = plasmaHeat(S.body, S.r, S.v, S.qHeat || 0); if (S.qHeat > qMax) { qMax = S.qHeat; at = {t: +simT.toFixed(0), km: +(PT.alt()/1000).toFixed(1), mach: +S.mach.toFixed(1), v: Math.round(len(sub(S.v, surfVel(S.body, S.r))))} } shell = Math.max(shell, h) }});
     PT.look(1.75, 0.05, 45); return {design: '${d}', link: [...seen], qHeatMax: Math.round(qMax), atMax: at, plasmaShellMax: Math.round(shell), shellDrawn: shell > 1.5e4, PLASMA_V} })()`, {shot: d.toLowerCase() + '_top'}]),
  checks: {blackout: `false`}};

// Program & economy
const NOMONEY = {kh: true, tools: true, nofail: true, fast: true};
const PROGTAB = t => `(()=>{ go('program'); PT.click('[data-ptab="${t}"]'); return document.getElementById('progBody').innerText.slice(0, 1500) })()`;
// a Sounding flight: up, chute, down, then back to the Program (that ends the flight); funds and news on the way
const SOUNDING = `(()=>{ go('assembly'); PT.preset('Sounding'); const f0 = PROG.funds, m0 = PT.log.length; PT.launch(); S.throttle = 1; stage(S); PT.fly(() => S.thrust <= 0 && simT > 5, 200);
  for (let k = 0; k < 4 && !S.chute; k++) { stage(S); PT.fly(() => false, 1) } PT.fly(() => S.landed || !S.alive, 3000); const apex = S.rec && S.rec.apex; go('program'); const fP = PROG.funds, flP = PROG.flights, settledAtProgram = !!S.rec.ended;
  resetShip();   // what the next launch (or Revert) does: since PLAYTEST #21 leaving the flight already settled it, so this pays nothing more
  return {landed: S.landed, apexKm: apex ? +(apex/1000).toFixed(1) : null, fundsBefore: +f0.toFixed(1), fundsAtProgram: +fP.toFixed(1), flightsAtProgram: flP, settledAtProgram, fundsAfterSettling: +PROG.funds.toFixed(1), flights: PROG.flights, log: PT.logSince(m0).filter(l => !/Logbook/.test(l))} })()`;
// row 97: three ways to end a flight, each settled when you leave it for the Program (PLAYTEST #21 rerun for crash and
// orbit); a debrief, once flow's Q2 lands, would show here too
const ENDING = (how, design, fly) => `(()=>{ go('assembly'); PT.preset('${design}'); const f0 = PROG.funds, fl0 = PROG.flights, m0 = PT.log.length; PT.launch(); ${fly}
  const end = {landed: S.landed, alive: S.alive, alt: Math.round(PT.alt())}; go('program');
  return {how: '${how}', end, settled: !!S.rec.ended, flights: [fl0, PROG.flights], funds: +(PROG.funds - f0).toFixed(1), debrief: /debrief/.test(screenNow()) || !!document.querySelector('[id*=debrief]:not(.hidden),[class*=debrief]:not(.hidden)'),
    news: PT.logSince(m0).filter(l => !/Logbook|Space to ignite/.test(l)).slice(-8)} })()`;
ROWS[97] = {title: 'finish flights three ways', flags: NOMONEY, steps: [
  ENDING('landed', 'Sounding', `S.throttle = 1; stage(S); PT.fly(() => S.thrust <= 0 && simT > 5, 200); for (let k = 0; k < 4 && !S.chute; k++) { stage(S); PT.fly(() => false, 1) } PT.fly(() => S.landed || !S.alive, 3000);`), {shot: 'landed'},
  ENDING('crashed', 'Sounding', `S.throttle = 1; stage(S); PT.fly(() => S.thrust <= 0 && simT > 5, 200); PT.fly(() => S.landed || !S.alive, 3000);`), {shot: 'crashed'},
  ENDING('in orbit', 'Orbiter', `${ORBIT.replace(/;$/, '')}; PT.fly(() => false, 60);`), {shot: 'orbit'}],
  checks: {settled: `true`}};
ROWS[77] = {title: 'budget gate and recovery refund', flags: NOMONEY, steps: [
  `go('assembly'); PT.preset('Big Lunar'); render(); ({funds: PROG.funds, button: document.getElementById('launch').textContent, cost: vesselCost(S.parts).cost})`,
  `(()=>{ const m0 = PT.log.length; document.getElementById('launch').click(); return {screen: screenNow(), log: PT.logSince(m0)} })()`,
  `document.querySelector('#editor .right').scrollTop = 1e4; 'ok'`, {shot: 'over_budget'}, SOUNDING, {shot: 'after_sounding'}]};
ROWS[79] = {title: 'the contract board', steps: [PROGTAB('inbox'), {shot: 'offers'},
  `(()=>{ const n = [...document.querySelectorAll('[data-acc]')].length; PT.click('[data-acc]'); const a = PROG.active.length; PT.click('[data-ptab="inbox"]'); PT.click('[data-dec]'); return {offers: n, active: a, cap: capOf(), log: PT.log.slice(-3)} })()`,
  `(()=>{ let k = 0; while (k++ < 10) { go('program'); PT.click('[data-ptab="inbox"]'); const b = [...document.querySelectorAll('[data-acc]')].find(x => !x.disabled); if (!b) break; b.click() } go('program'); PT.click('[data-ptab="inbox"]'); return {active: PROG.active.length, cap: capOf(), takeDisabled: [...document.querySelectorAll('[data-acc]')].every(x => x.disabled), inbox: document.getElementById('progBody').innerText.slice(0, 600)} })()`, {shot: 'at_capacity'},
  PROGTAB('contracts'), {shot: 'contracts'}]};
ROWS[84] = {title: 'know-how bars move', flags: {tools: true, nofail: true, fast: true, money: true}, steps: [
  `(()=>{ go('program'); PT.click('[data-ptab="industry"]'); return ['sparrow', 'sci', 't1', 'fins', 'chute'].map(k => k + ' ' + khUse(k).toFixed(2)).join(', ') })()`, {shot: 'industry_before'},
  SOUNDING, `(()=>{ go('program'); PT.click('[data-ptab="industry"]'); return ['sparrow', 'sci', 't1', 'fins', 'chute'].map(k => k + ' ' + khUse(k).toFixed(2)).join(', ') + ' || ' + (document.getElementById('progBody').innerText.match(/Know-how[^]{0,500}/)?.[0] || 'no Know-how section') })()`, {shot: 'industry_after'},
  `go('assembly'); PT.preset('Orbiter'); render(); document.querySelector('#editor .right').innerText.match(/Cost[^]{0,400}/)?.[0]`]};
ROWS[85] = {title: 'own line vs license', steps: [`(()=>{ go('program'); PT.click('[data-ptab="industry"]'); return document.getElementById('progBody').innerText.match(/Production[^]{0,400}/)?.[0] })()`,
  `(()=>{ const b = [...document.querySelectorAll('[data-line]')]; const opts = b.map(x => x.dataset.line + ' = ' + x.textContent + (x.title ? ' (' + x.title + ')' : '')); const f0 = PROG.funds; if (b[0]) b[0].click(); return {opts, spent: +(f0 - PROG.funds).toFixed(1), lines: JSON.stringify(PROG.lines), log: PT.log.slice(-2)} })()`, {shot: 'line_ordered'},
  `(()=>{ testFinishJobs(); go('program'); PT.click('[data-ptab="industry"]'); return document.getElementById('progBody').innerText.match(/Production[^]{0,300}/)?.[0] })()`]};
ROWS[86] = {title: 'test stand', steps: [`(()=>{ go('program'); PT.click('[data-ptab="industry"]'); const f0 = PROG.funds; PT.click('[data-stand="build"]'); return {spent: +(f0 - PROG.funds).toFixed(1), log: PT.log.slice(-2)} })()`,
  `(()=>{ testFinishJobs(); go('program'); PT.click('[data-ptab="industry"]'); const b = [...document.querySelectorAll('[data-test]')]; return b.slice(0, 6).map(x => x.dataset.test + ' = ' + x.textContent + (x.disabled ? ' (disabled)' : '')) })()`, {shot: 'stand_ready'},
  `(()=>{ const b = document.querySelector('[data-test$=":qual"]:not([disabled])'); if (!b) return 'no qualify button'; const k = b.dataset.test.split(':')[0], c0 = certOf(k), u0 = khUse(k), d0 = PROG.day, f0 = PROG.funds; b.click(); const busy = document.getElementById('progBody').innerText.match(/Test stand[^]{0,200}/)?.[0]; testFinishJobs(); return {part: k, cert: [+c0.toFixed(2), +certOf(k).toFixed(2)], knowhow: [+u0.toFixed(2), +khUse(k).toFixed(2)], costM: +(f0 - PROG.funds).toFixed(1), busy, log: PT.log.slice(-3)} })()`]};
ROWS[87] = {title: 'development project', steps: [`(()=>{ go('program'); PT.click('[data-ptab="industry"]'); const b = [...document.querySelectorAll('[data-dev]')]; return {n: b.length, first: b.slice(0, 4).map(x => x.dataset.dev + ' = ' + x.textContent + (x.title ? ' (' + x.title + ')' : '') + (x.disabled ? ' [disabled]' : ''))} })()`,
  `(()=>{ const b = document.querySelector('[data-dev]:not([disabled])'); if (!b) return 'none enabled'; const f0 = PROG.funds; b.click(); go('program'); PT.click('[data-ptab="industry"]'); return {spent: +(f0 - PROG.funds).toFixed(1), job: JSON.stringify(PROG.devJob), text: document.getElementById('progBody').innerText.match(/Development[^]{0,300}/)?.[0], log: PT.log.slice(-2)} })()`, {shot: 'dev_ordered'},
  `(()=>{ testFinishJobs(); return PT.log.slice(-3) })()`]};
ROWS[88] = {title: 'integration hall and recovery fleet', steps: [
  `(()=>{ go('assembly'); PT.preset('Orbiter'); const d0 = prepDays(vesselCost(S.parts).cost) * FAC.hall.eff[facLv('hall')]; go('program'); PT.click('[data-ptab="industry"]'); const b = [...document.querySelectorAll('[data-fac]')].map(x => x.dataset.fac + ' = ' + x.textContent); [...document.querySelectorAll('[data-fac]')].forEach(x => x.click()); testFinishJobs(); go('program'); PT.click('[data-ptab="industry"]'); go('assembly'); PT.preset('Orbiter'); const d1 = prepDays(vesselCost(S.parts).cost) * FAC.hall.eff[facLv('hall')]; return {buttons: b, orbiterStackDays: [+d0.toFixed(1), +d1.toFixed(1)], levels: Object.fromEntries(Object.keys(PROG.fac || {}).map(k => [k, facLv(k)])), log: PT.log.slice(-4)} })()`,
  PROGTAB('industry'), {shot: 'facilities'}]};
ROWS[90] = {title: 'compute eras and studies', steps: [`(()=>{ go('program'); const m0 = PT.log.length, d0 = PROG.day; testAdvance(1850); go('program'); return {days: PROG.day - d0, era: compEra(), news: PT.logSince(m0).filter(l => /comput|mainframe|calculat|trajector/i.test(l)).slice(0, 8)} })()`,
  PROGTAB('industry'), {shot: 'industry_mainframes'},
  `(()=>{ go('assembly'); PT.preset('Orbiter'); render(); const before = document.querySelector('#editor .right').innerText.match(/Trajectory[^\\n]*/)?.[0]; const b = document.querySelector('[data-study]'); if (b && !b.disabled) b.click(); render(); const after = document.querySelector('#editor .right').innerText.match(/Trajectory[^\\n]*/)?.[0]; testFinishJobs(); editorChanged(); return {before, after, done: document.querySelector('#editor .right').innerText.match(/Trajectory[^\\n]*/)?.[0]} })()`]};
ROWS[91] = {title: 'Coming up and Wait', steps: [PROGTAB('inbox'),
  `(()=>{ const b = [...document.querySelectorAll('[data-adv]')]; const list = b.map(x => x.dataset.adv + ' ' + x.textContent + ' :: ' + x.parentElement.innerText.slice(0, 80)); const d0 = PROG.day, m0 = PT.log.length; if (b[0]) b[0].click(); return {list, from: d0, to: PROG.day, target: b[0] && +b[0].dataset.adv, log: PT.logSince(m0).slice(0, 6)} })()`, {shot: 'after_wait'},
  `(()=>{ go('program'); PT.click('[data-ptab="inbox"]'); const b = [...document.querySelectorAll('[data-adv]')]; const d0 = PROG.day; const last = b[b.length - 1]; if (last) last.click(); return {from: d0, to: PROG.day, target: last && +last.dataset.adv, decisions: (PROG.decisions || []).map(d => d.title + ' expires ' + d.expires), offersExpiring: (PROG.offers || PROG.board || []).length} })()`]};
ROWS[93] = {title: 'ground stations', steps: [PROGTAB('fleet'), `testEpoch(3); 'epoch 3'`, PROGTAB('fleet'), {shot: 'fleet'},
  `(()=>{ const b = [...document.querySelectorAll('[data-gs]')]; const f0 = PROG.funds, m0 = PT.log.length; const res = b.slice(0, 4).map(x => { x.click(); return x.parentElement ? x.parentElement.innerText.slice(0, 120) : '' }); return {buttons: b.length, rows: res, spent: +(f0 - PROG.funds).toFixed(1), log: PT.logSince(m0)} })()`, PROGTAB('fleet'), {shot: 'after_build'}]};
const FLAVOUR = a => ({title: 'power flavour: a year as ' + a, gate: true, steps: [`(()=>{ const b = document.querySelector('[data-arch="${a}"]'); if (b) b.click(); PT.start('agency'); const m0 = PT.log.length, f0 = PROG.funds; testAdvance(YEAR_D); go('program'); return {arch: PROG.homeArch, name: progName(), funds: [f0, +PROG.funds.toFixed(0)], decisions: (PROG.decisions || []).map(d => d.title), news: PT.logSince(m0).slice(0, 16)} })()`, {shot: a}]});
ROWS[82] = FLAVOUR('openSuper'); ROWS['82b'] = FLAVOUR('closedSuper'); ROWS['82c'] = FLAVOUR('resource');
ROWS[52] = {title: 'logbook looks by era', steps: [`go('program'); ovOpen('logbook'); toggleLog(); toggleLog(); document.getElementById('logbook').className`, {shot: 'notebook'},
  `(()=>{ ovClose('logbook'); document.getElementById('logbook').classList.add('hidden'); testEpoch(3); go('program'); toggleLog(); ovOpen('logbook'); return document.getElementById('logbook').className })()`, {shot: 'after_epoch3'},
  `(()=>{ const c = document.querySelector('#logbook input[type=checkbox]'); if (c) c.click(); return {modern: !!c, cls: document.getElementById('logbook').className} })()`, {shot: 'modern'}]};

// More rows: hold-downs, impact prediction, frame rate, rover yard, tool gates, avionics eras, the Δv table, the world from orbit
// boosters on the diagonals: the Heavy's pair turned 45° (and a three-booster version), on the pad and at liftoff
const DIAG = (n, a) => `(()=>{ const t = toV2(PRESETS.Heavy); const walk = x => { if (x.at && typeof x.at === 'object') { x.at.a = ${a}; x.at.n = ${n} } (x.c || []).forEach(walk) }; walk(t.root); stackDef = t; editorChanged(); return 'boosters n ${n} at ' + (${a} * 57.3).toFixed(0) + ' deg' })()`;
const HOLD = (tag, n, a) => [`go('assembly'); 'ok'`, DIAG(n, a), `PT.launch(); window.simulate0 = window.simulate0 || window.simulate; window.simulate = () => {}; render(); PT.t0 = simT; while (simT - PT.t0 < 15) advPhys(S); [cam.yaw, cam.pitch, cam.dist] = [0.6, 0.35, 22]; document.querySelectorAll('.ui,#news,#msg').forEach(e => e.style.visibility = 'hidden'); render(); 'ok'`, {shot: tag + '_pad'},
  `(()=>{ S.throttle = 1; stage(S); const t1 = simT; while (simT - t1 < 1.2) { advPhys(S); emitSmoke(DT); render() } render(); return {up: +PT.agl().toFixed(1)} })()`, {shot: tag + '_liftoff'}];
ROWS[109] = {title: 'hold-downs with boosters on the diagonals', steps: [  // (render once at launch: the gantry's roll-back clock starts at the first frame)
...HOLD('diag2', 2, 0.7854), ...HOLD('three', 3, 0.5236)]};
// impact prediction: a Sounding lob tipped 8° east; the predicted landing (and the HUD's ±) at apex vs where it lands
ROWS[10] = {title: 'impact prediction vs the landing', steps: [
  `(()=>{ PT.preset('Sounding'); PT.launch(); const pf0 = toPF(TELLUS, S.r, simT); S.throttle = 1; stage(S); PT.fly(() => simT > 3, 10); S.sas = true; S.sasMode = 'stab'; const up = norm(S.r), e = norm(cross([0, 1, 0], up)); S.hold = norm(add(up, mul(e, 0.14))); PT.fly(() => S.thrust <= 0 && simT > 5, 200);
     PT.fly(() => dot(S.v, norm(S.r)) < 0, 2000); for (let k = 0; k < 4 && !S.chute; k++) { stage(S); PT.fly(() => false, 1) }
     const hud = PT.hud().split(String.fromCharCode(10)).filter(l => /Impact/.test(l)).join(''); const p = predictImpact(S); const P = p ? (p.pf || (p.r && toPF(TELLUS, p.r, p.t))) : null;
     PT.fly(() => S.landed || !S.alive, 4000); const pf1 = toPF(TELLUS, S.r, simT), km = (a, b) => +(Math.acos(clamp(dot(norm(a), norm(b)), -1, 1)) * TELLUS.R / 1000).toFixed(2);
     return {hudAtApex: hud, predKeys: p ? Object.keys(p).join(',') : null, predictedT: p && p.t != null ? +p.t.toFixed(0) : null, landedT: +simT.toFixed(0), missKm: P ? km(P, pf1) : null, rangeKm: km(pf0, pf1), landed: S.landed} })()`]};
// frame rate in the heaviest FX scene: the Heavy at night, engines lit on the pad; live frames timed (the sim runs)
// the game's own frame step (simulate) driven by hand at 60 Hz, the live loop frozen: keys, tape recording and warp as in play
const SIM = `PT.sim = window.simulate0 || window.simulate; window.simulate0 = PT.sim; window.simulate = () => {}; PT.run = (sec, f) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (f && f() === false) break; PT.sim(1 / 60) } return simT };`;
ROWS[11] = {title: 'autopilot tape: save, replay, take over', steps: [
  `(()=>{ ${SIM} PT.preset('Sounding'); PT.launch(); PT.key('z'); PT.key(' '); PT.run(4); keys.add('w'); PT.run(1.5); keys.delete('w'); PT.run(20);
     PT.A = {t: simT, r: S.r.slice(), alt: PT.alt()}; PT.click('#bSaveTape'); return {recordedAt: +simT.toFixed(2), altKm: +(PT.alt()/1000).toFixed(2), saved: !!loadTape(), msg: PT.msg()} })()`,
  `(()=>{ PT.click('#bRevert'); updateAutoBtn(); const vis = !document.getElementById('bAuto').classList.contains('hidden'), label = document.getElementById('bAuto').textContent; PT.click('#bAuto');
     PT.run(40, () => simT < PT.A.t - 1e-9); const miss = len(sub(S.r, PT.A.r)); return {autoButton: vis, label, replayAt: +simT.toFixed(2), missM: +miss.toFixed(2), playingAtEnd: !!player, log: PT.log.slice(-2)} })()`,
  // a second replay, taken over at 12 s with W
  `(()=>{ PT.click('#bRevert'); updateAutoBtn(); PT.click('#bAuto'); PT.run(20, () => simT < 12); const was = !!player; const m0 = PT.log.length; PT.key('w'); PT.run(1); keys.delete('w'); return {playingBefore: was, playingAfter: !!player, log: PT.logSince(m0), alt: +(PT.alt()/1000).toFixed(2)} })()`]};
// physics warp near the ground: a Sounding capsule coming down under its chute at warp 100x; where the warp drops
ROWS[6] = {title: 'physics warp drops near the ground', steps: [
  `(()=>{ ${SIM} PT.preset('Sounding'); PT.launch(); PT.key('z'); PT.key(' '); PT.run(60); PT.run(400, () => dot(S.v, norm(S.r)) > 0); for (let k = 0; k < 3 && !S.chute; k++) { PT.key(' '); PT.run(1) }
     const seen = []; let last = -1; warpIdx = 5; PT.run(3000, () => { if (warpIdx !== last) { seen.push('warp ' + WARPS[warpIdx] + 'x at ' + PT.agl().toFixed(0) + ' m AGL, v ' + len(sub(S.v, surfVel(S.body, S.r))).toFixed(0) + ' m/s'); last = warpIdx } if (warpIdx === 0 && seen.length > 1 && !PT.re) { PT.re = 1; warpIdx = 5 } return !S.landed && S.alive });
     return {seen, landed: S.landed, simT: +simT.toFixed(0)} })()`]};
ROWS[47] = {title: 'frame rate: Heavy at night on the pad', steps: [
  `(()=>{ PT.preset('Heavy'); PT.launch(); const t0 = simT; for (let k = 1; k < 400; k++) { const tt = t0 + k * 120, site = fromPF(TELLUS, padPF(), tt); if (dot(norm(sub(site, bodyPos(TELLUS, tt))), SUN) < -0.3) { simT = tt; break } } syncLanded(S); markT = null; padShip = null;
     const tw = simT; while (simT - tw < 15) advPhys(S); S.throttle = 1; stage(S); [cam.yaw, cam.pitch, cam.dist] = [0.9, 0.1, 60]; PT.showUI(); document.body.classList.remove('noperf'); return GPU_NAME })()`,
  `new Promise(r => { const ts = []; let last = performance.now(); const f = () => { const n = performance.now(); ts.push(n - last); last = n; if (ts.length < 180) requestAnimationFrame(f); else { ts.shift(); ts.sort((a, b) => a - b); r({frames: ts.length, medianMs: +ts[ts.length >> 1].toFixed(1), p95Ms: +ts[Math.floor(ts.length * .95)].toFixed(1), gpuMs: gpuMs == null ? null : +gpuMs.toFixed(1), cpuMs: +frameMs.toFixed(1), res: RS, alt: +PT.agl().toFixed(0), perf: document.getElementById('perf').textContent}) } }; requestAnimationFrame(f) })`, {shot: 'heavy_night'}]};
ROWS[34] = {title: 'rover yard', steps: [`go('rover'); ({screen: screenNow(), rv: typeof RV !== 'undefined' && !!RV})`, {shot: 'yard'},
  {hold: 'w', ms: 3000}, {hold: 'a', ms: 1200}, {hold: 'w', ms: 3000}, `({screen: screenNow(), speed: RV ? +len(RV.v).toFixed(2) : null, hud: (document.getElementById('rvHud') || {}).innerText})`, {shot: 'driving'}]};
// tool gates in a fresh career (tester without "All tools"): N in orbit, the impact row, the logbook's unlock lines
ROWS[51] = {title: 'tool gates before they unlock', flags: {money: true, kh: true, nofail: true, fast: true}, steps: [
  `PT.preset('Orbiter'); PT.launch(); ${UPPER('petrel')}`, ORBIT, `PT.showUI(); 'ok'`, {key: 'n'}, `({msg: PT.msg(), node: !!S.node, impact: PT.hud().split(String.fromCharCode(10)).filter(l => /Impact/.test(l)).join('')})`, {shot: 'n_refused'},
  {key: 'm'}, `({view, msg: PT.msg()})`, {shot: 'map'}, {key: 'm'}, `go('program'); toggleLog(); ovOpen('logbook'); document.getElementById('logbook').innerText.match(/will unlock[^]{0,60}/g)`]};
// avionics eras arriving (no "All tools"): the builder's SAS line at day 0, year 3 and year 7
ROWS[102] = {title: 'avionics eras arrive', flags: {money: true, kh: true, nofail: true, fast: true}, steps: [
  ...[0, 3, 7].map(y => `(()=>{ const m0 = PT.log.length; if (${y}) testAdvance(Math.max(0, ${y} * YEAR_D - PROG.day + 10)); go('assembly'); PT.preset('Orbiter'); render(); const tx = document.querySelector('#editor .right').innerText; return {year: (PROG.day / YEAR_D).toFixed(2), sas: tx.match(/SAS [^]{0,140}/)?.[0], news: PT.logSince(m0).filter(l => /avionic|autopilot|guidance|computer|mainframe/i.test(l)).slice(0, 4)} })()`),
  `document.querySelector('#editor .right').scrollTop = 900; 'ok'`, {shot: 'year7_builder'}]};
ROWS[22] = {title: 'the Δv/TWR table', steps: [`go('assembly'); PT.preset('Crewed Lunar'); render(); document.getElementById('stats').innerText.slice(0, 900)`, {shot: 'crewed_lunar'}]};
ROWS[30] = {title: 'the world from orbit', steps: [...views(3, 100)]};
// clouds: the volume hands over to the shell around 40 km. One climb to 36 km, then the ship moved straight up to 38–44 km at
// the same moment (each launch moves the world date, so separate climbs see different weather)
ROWS['44b'] = {title: 'clouds: the 40 km hand-over', steps: [
  `(()=>{ PT.preset('Orbiter'); PT.launch(); CLOUD_DT = 0; S.throttle = 1; stage(S); PT.fly(() => PT.alt() > 36000, 600, {ascent: true, autostage: true}); for (let k = 0; k < 4000; k++) { const c = cloudAt(norm(toPF(TELLUS, S.r, simT)), tNow() + k * 300); if (c > 0.55 && c < 0.75) { CLOUD_DT = k * 300; break } }
     window.simulate0 = window.simulate0 || window.simulate; window.simulate = () => {}; PT.up = norm(S.r); [cam.yaw, cam.pitch, cam.dist] = [1.75, 0.5, 60]; document.querySelectorAll('.ui,#news,#msg').forEach(e => e.style.visibility = 'hidden'); render(); return {simT, CLOUD_DT} })()`, {shot: 'h36'},
  ...[38, 40, 42, 44].flatMap(h => [`(()=>{ S.r = mul(PT.up, TELLUS.R + ${h}000); render(); render(); return PT.alt() })()`, {shot: 'h' + h}])]};

// UI & screens
const OVS = `['help','logbook','escm','tester'].filter(id=>document.getElementById(id)&&!document.getElementById(id).classList.contains('hidden'))`;
ROWS[95] = {title: 'every Program tab', steps: [`go('program'); [...document.querySelectorAll('[data-ptab]')].map(b=>b.dataset.ptab)`,
  ...['inbox', 'missions', 'contracts', 'fleet', 'world', 'industry', 'company'].flatMap(t => [`PT.click('[data-ptab="${t}"]'); document.getElementById('progBody').innerText.slice(0,300)`, {shot: t}])],
  checks: {tabs: `[...document.querySelectorAll('[data-ptab]')].map(b=>b.dataset.ptab).join(' ')`, more: `!!document.querySelector('[data-ptab="more"]')`, inboxN: `progInbox`},
  expect: {more: v => v === false}};
ROWS[96] = {title: 'Esc, Help, Logbook, Program, Build keys', steps: [
  `go('program'); screenNow()`, {key: 'h'}, `${OVS}`, {key: 'f'}, `${OVS}`, {shot: 'help_log'}, {key: 'Escape'}, `${OVS}`, {key: 'Escape'}, `${OVS}`,
  {key: 'Escape'}, `${OVS}`, {shot: 'escmenu_prog'}, {key: 'Escape'}, `${OVS}`,
  {key: 'b'}, `screenNow()`, {key: 'h'}, {shot: 'help_assembly'}, {key: 'Escape'}, {key: 'p'}, `screenNow()`, {key: 'b'}, `screenNow()`,
  // in the air: revert asks twice; landed (on the pad): once
  `PT.preset('Orbiter'); PT.launch(); S.throttle=1; stage(S); PT.fly(()=>PT.alt()>1500); screenNow()`, {key: 'Escape'}, {shot: 'escmenu_air'},
  `PT.click('[data-esc="revert"]'); document.querySelector('[data-esc="revert"]')?.textContent`, {shot: 'revert_armed'},
  `PT.click('[data-esc="revert"]'); ({screen: screenNow(), simT, alt: PT.alt().toFixed(0), landed: S.landed})`,
  {key: 'Escape'}, `[...document.querySelectorAll('[data-esc]')].map(b=>b.dataset.esc+':'+b.textContent).join(' | ')`, `PT.click('[data-esc="assembly"]'); screenNow()`,
  `go('flight'); ${OVS}`, {key: 'h'}, `document.getElementById('help').innerText.slice(0,900)`, {shot: 'help_flight'}],
  checks: {screen: `screenNow()`}};
ROWS[100] = {title: 'tester menu controls', steps: [
  `localStorage.setItem('launchpad-program-v1','{"canary":1}'); go('program'); 'ok'`, {key: 'F2'}, `${OVS}`, {shot: 'menu'},
  // each flag: off, then back on, read from TEST and from storage
  `TEST_FLAGS.map(([k])=>{const q=()=>document.querySelector('[data-test-flag="'+k+'"]'); q().click(); const off=TEST[k], st=JSON.parse(localStorage.getItem('launchpad-tester-flags'))[k]; q().click(); return k+':'+off+'/'+st+'->'+TEST[k]}).join(' ')`,
  `localStorage.getItem('launchpad-tester-flags')`,
  ...[5, 3, 1, 4].flatMap(n => [`PT.click('[data-test-ep="${n}"]'); ({ep: testEpochNow(), done: Object.keys(PROG.done).length})`]), {shot: 'epoch4'},
  `(()=>{const d0=PROG.day;PT.click('[data-test-day="1"]');const d1=PROG.day;PT.click('[data-test-day="10"]');const d2=PROG.day;PT.click('[data-test-day="100"]');const d3=PROG.day;return [d0,d1,d2,d3]})()`,
  `(()=>{const d=PROG.day;const t=performance.now();PT.click('[data-test-day="'+YEAR_D+'"]');return {days:PROG.day-d,ms:Math.round(performance.now()-t)}})()`, {shot: 'after_year'},
  `PT.click('[data-test-act="jobs"]'); PT.msg()`,
  `PT.click('[data-test-act="fresh"]'); document.querySelector('[data-test-act="fresh"]').textContent`, {shot: 'fresh_armed'},
  // in flight: epoch and date disabled
  `ovClose('tester'); go('assembly'); PT.preset('Sounding'); PT.launch(); ovOpen('tester'); [...document.querySelectorAll('[data-test-ep],[data-test-day]')].every(b=>b.disabled)`, {shot: 'in_flight'}],
  checks: {career: `localStorage.getItem('launchpad-program-v1')`, sandbox: `!!localStorage.getItem('launchpad-program-tester')`, ep: `testEpochNow()`, funds: `PROG.funds`},
  expect: {career: v => v === '{"canary":1}', sandbox: v => v === true}};
ROWS[75] = {title: 'new career gate', gate: true, flags: null, steps: [{shot: 'gate'}, `({build: document.getElementById('bBuild').disabled, gate: progGate})`,
  {key: 'b'}, `({screen: screenNow(), msg: PT.msg()})`, {shot: 'b_refused'},
  `PT.click('[data-arch="closedSuper"]'); ({arch: PROG.homeArch})`, {shot: 'arch'},
  `PT.click('[data-start="company"]'); ({gate: progGate, build: document.getElementById('bBuild').disabled, funds: PROG.funds, name: progName()})`, {shot: 'started'}],
  checks: {gate: `progGate`}, expect: {gate: v => v === false}};

// M1's finish line (QUEUE Q55, ROADMAP § M1): a new career, no tester flags, from the first-run gate to the first orbit
// and its debrief. Written before M1 is done, so it FAILS until the flow lane's M1 items land; each check names its item.
// Two flights: a Sounding for "Above the weather", then the beeper (an instrument package in orbit). No preset carries
// one to orbit (PLAYTEST #24), so the robot swaps the Orbiter's pod for the package, as career.mjs assumes. The ascent
// is fly_ladder.mjs's handAscent: attitude set directly, so it proves the career path, not that the rocket is flyable.
// Boxes: every visible panel on each screen, pairwise; any overlap ≥ 40 px² at 1280×800 is listed.
const M1_HELPERS = String.raw`
PT.boxes = () => { const els = [...document.querySelectorAll('body *')].filter(e => { if (e.tagName === 'CANVAS' || e.closest('.hidden')) return false; const cs = getComputedStyle(e);
    if (!/absolute|fixed|sticky/.test(cs.position) || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.width * r.height < 0.5 * innerWidth * innerHeight && e.innerText.trim() });   // full-screen layers are containers, not boxes
  const top = els.filter(e => !els.some(o => o !== e && o.contains(e))), name = e => e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  const out = []; for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) { const A = top[i].getBoundingClientRect(), B = top[j].getBoundingClientRect();
    const w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top); if (w > 0 && h > 0 && w * h >= 40) out.push(name(top[i]) + ' × ' + name(top[j]) + ' ' + Math.round(w * h) + ' px²') }
  return out };
PT.debrief = () => /debrief/.test(screenNow()) || [...document.querySelectorAll('[id*=debrief],[class*=debrief]')].some(e => !e.closest('.hidden') && e.getBoundingClientRect().height > 0);
PT.ascent = () => { const s = S, ATM = TELLUS.atm, AS = ATM / 7e4, tgt = ATM + 10000; s.sas = false; s.throttle = 1; if (s.evIdx === 0) stage(s); let k = 0, phase = 'up';
  const point = Y => { const f = localFrame(s.r), X = norm(cross(Y, f.n)); s.q = qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0] };
  const pitch = d => { const f = localFrame(s.r), r = d * Math.PI / 180; point(norm(add(mul(f.e, Math.cos(r)), mul(f.up, Math.sin(r))))) };
  while (s.alive && k++ < 400000) { const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - TELLUS.R;
    if (phase === 'up') { const f = Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))); pitch(90 * (1 - Math.pow(f, 0.6))); if (el.ap - TELLUS.R > tgt) { s.throttle = 0; phase = 'coast' } }
    else if (phase === 'coast') { pitch(0); s.throttle = h < ATM && el.ap - TELLUS.R < tgt - 500 ? 0.3 : 0;
      const dvC = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a)); if (h > ATM && timeToNu(el, Math.PI) < Math.max(25, 0.5 * dvC / Math.max(engAcc(s), 0.1))) phase = 'circ' }
    else { const f = localFrame(s.r), hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), need = sub(mul(hv, Math.sqrt(TELLUS.mu / len(s.r))), s.v); point(norm(need)); s.throttle = 1;
      if (el.pe - TELLUS.R > ATM + 2000 || len(need) < 3) { s.throttle = 0; break } }
    if (s.throttle > 0 && dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) stage(s);
    advPhys(s) }
  const o = PT.orbit(); return {alive: s.alive, pe: Math.round(o.pe / 1e3), ap: Math.round(o.ap / 1e3), atm: TELLUS.atm / 1e3, t: Math.round(simT)} };
PT.state = () => ({screen: screenNow(), day: +PROG.day.toFixed(1), funds: +PROG.funds.toFixed(1), flights: PROG.flights, done: Object.keys(PROG.done)});
true`;
ROWS.m1 = {title: 'new career: gate → first orbit → debrief (M1 finish line)', gate: true, flags: null, steps: [M1_HELPERS,
  // the first-run gate, with real clicks
  {shot: 'gate'}, `({tester: typeof TEST === 'object' ? TEST.on : null, gate: progGate, boxes: PT.boxes()})`,
  {click: '[data-start="agency"]'}, `({gate: progGate, build: document.getElementById('bBuild').disabled, ...PT.state(), program: PT.text('#prog').slice(0, 600)})`, {shot: 'program'},
  `PT.m1 = {boxes: {program: PT.boxes()}}; PT.m1.boxes.program`,
  // flight 1: Sounding, "Above the weather"
  {key: 'b'}, `PT.preset('Sounding'); ({screen: screenNow(), cost: vesselCost(S.parts).cost, funds: PROG.funds, boxes: (PT.m1.boxes.assembly = PT.boxes())})`, {shot: 'assembly'},
  {click: '#bRoll'}, `PT.m1.boxes.rollout = PT.boxes(); ({screen: screenNow(), checks: document.getElementById('rollChecks').innerText})`, {shot: 'rollout'}, {click: '#launch'}, `S.throttle = 1; stage(S); PT.m1.t0 = simT; ({screen: screenNow()})`, {wait: 2500},
  `PT.m1.live = +(simT - PT.m1.t0).toFixed(2); PT.m1.boxes.flight = PT.boxes(); ({live: PT.m1.live, alt: Math.round(PT.alt())})`, {shot: 'climb'},
  // Esc pauses (Q39): the sim clock stands still while the Esc menu is open
  {key: 'Escape'}, `PT.m1.tE = simT; true`, {wait: 2500}, `PT.m1.escRun = +(simT - PT.m1.tE).toFixed(2); ({escRun: PT.m1.escRun, menu: PT.vis('#escm')})`, {shot: 'esc'}, {key: 'Escape'},
  `({fly: PT.fly(() => S.landed || !S.alive, 4000, {autostage: true}), landed: S.landed, alive: S.alive, rec: {apex: Math.round(S.rec.apex), recSci: S.rec.recSci}})`,
  `go('program'); PT.m1.deb1 = PT.debrief(); ({debrief: PT.m1.deb1, ...PT.state(), boxes: PT.boxes(), news: PT.logSince(0).slice(-8)})`, {shot: 'after_sounding'},
  // flight 2: the beeper
  `go('assembly'); stackDef = PRESETS.Orbiter.map(k => k === 'pod' ? 'sci' : k); editorChanged(); ({stack: stackDef.join(' '), cost: vesselCost(S.parts).cost, funds: PROG.funds, open: missionOpen(MISSIONS.find(m => m.id === 'beeper'))})`, {shot: 'beeper_assembly'},
  {click: '#bRoll'}, {click: '#launch'}, `({screen: screenNow(), ascent: PT.ascent(), rec: {orbit: S.rec.orbit, orbitSci: S.rec.orbitSci}})`,
  `PT.showUI(); PT.m1.boxes.orbit = PT.boxes(); ({hud: PT.hud().slice(0, 400)})`, {shot: 'orbit'},
  `go('program'); PT.m1.deb2 = PT.debrief(); ({debrief: PT.m1.deb2, ...PT.state(), boxes: (PT.m1.boxes.after = PT.boxes()), news: PT.logSince(0).slice(-10)})`, {shot: 'after_orbit'}],
  checks: {tester: `typeof TEST === 'object' ? TEST.on : false`, weather: `!!PROG.done.weather`, beeper: `!!PROG.done.beeper`, flights: `PROG.flights`,
    escPauses: `PT.m1.escRun`, debrief: `[PT.m1.deb1, PT.m1.deb2]`, boxes: `Object.entries(PT.m1.boxes).filter(([k, v]) => v.length).map(([k, v]) => k + ': ' + v.join(', '))`},
  expect: {tester: v => !v, weather: v => v === true, beeper: v => v === true,
    escPauses: v => v === 0,                       // flow Q39
    debrief: v => v[0] === true && v[1] === true,  // flow Q2
    boxes: v => v.length === 0}};                  // M1: no box covers another at 1280×800

// Moons (QUEUE Q30 slice 1, NOTES § "Plan: robot drivers…"): the Selene and Nyx ladders flown in the page by the game's
// own procedures, with fly_ladder.mjs (fetched, its Node-only tail cut, imported from a blob) driving them. Its HOOK is a
// dummy, so the page's HUD and news (and PT.log) see everything a player would. Each mission is one step, then shots.
const MOON_HELPERS = String.raw`
PT.ladder = async () => { if (PT.L) return PT.L; const src = await (await fetch('fly_ladder.mjs')).text(); const cut = src.slice(0, src.indexOf('// run directly'));
  PT.L = await import(URL.createObjectURL(new Blob([cut], {type: 'text/javascript'}))); return PT.L };
PT.api = () => ({PRESETS, TELLUS, SELENE, BODIES, MISSIONS, newShip, stage, advPhys, advRails, railsOK, localFrame, qFromBasis, elements, timeToNu, dvRemaining, dvPlan, engAcc,
  HOOK: {}, PROG, len, norm, add, sub, mul, dot, cross, procStart, procKey, vesselCost, bodyRel, toPF, siteAt, get S() { return S }, set S(v) { S = v }, get t() { return simT }, set t(v) { simT = v }});
PT.fly1 = async id => { const L = await PT.ladder(), n0 = PT.log.length, f0 = PROG.funds; const rows = L.flyLadder(PT.api(), [id]); PT.showUI();
  return {id, rows, at: S.body.name, alt: Math.round(PT.alt() / 1e3), landed: S.landed, funds: +(PROG.funds - f0).toFixed(1), news: PT.logSince(n0).filter(l => /news|Mission/.test(l)).slice(-10)} };
PT.mapShot = () => { go('map'); render(); return true };
true`;
const MOON = (id, shots = true) => [`PT.fly1(${JSON.stringify(id)})`, ...(shots ? [`PT.look(0.9, 0.15, 25)`, {shot: id.replace(':', '_')}, `PT.mapShot()`, {shot: id.replace(':', '_') + '_map'}, `go('flight'); true`] : [])];
const MOONSTART = [MOON_HELPERS, `PT.preset('Probe'); PT.launch(); testEpoch(4); true`];
ROWS[68] = {title: 'the Selene ladder by procedure (with 54, 92, 13)', steps: [...MOONSTART, ...MOON('farside'), ...MOON('selimp'), ...MOON('selland'), ...MOON('selsample')]};
ROWS[72] = {title: 'Nyx: found by tracking, flown past (with 121)', steps: [...MOONSTART, ...MOON('nyxfind'), ...MOON('nyxfly')]};
// after each capture, up to 400 h on: the prograde orbit should come down or leave, the retrograde one stay
const NYXWAIT = `(()=>{ const t0 = simT; for (let k = 0; k < 400 && S.alive && S.body.name === 'Nyx' && !S.landed; k++) { if (railsOK(S)) advRails(S, 3600, 1000); else advPhys(S) }
  return {days: +((simT - t0) / 86400).toFixed(1), body: S.body.name, alive: S.alive, landed: S.landed, alt: Math.round(PT.alt() / 1e3), log: PT.log.slice(-4)} })()`;
ROWS[55] = {title: 'Nyx orbits: retrograde lasts, prograde is wrecked', steps: [...MOONSTART, ...MOON('nyxorb'), NYXWAIT, ...MOON('nyxorb:pro'), NYXWAIT]};
ROWS[73] = {title: 'land on Nyx by procedure', steps: [...MOONSTART, ...MOON('nyxland')]};
// flySite twice at one point: the landing procedure is repeatable to within metres
ROWS[125] = {title: 'land on the same Selene spot twice', steps: [...MOONSTART,
  `(async()=>{ const L = await PT.ladder(); const a = L.flySite(PT.api(), 'Probe', 'Selene', 10, 20), b = L.flySite(PT.api(), 'Probe', 'Selene', 10, 20); PT.showUI(); return {first: a, second: b} })()`, `PT.look(0.9, 0.15, 25)`, {shot: 'landed'}]};

// Docking (QUEUE Q30 slice 2): test.mjs §22/§25/§27/§29's scenes placed in the page (a 300 km orbit, the clock at 0), the
// flown vessel a port-pod-tank-engine stack with two RCS rings and gas (§24's design). PT.dockIn is a pilot: Docking SAS
// holds the attitude, and RCS pulses (INP.tx/ty/tz, ±1 like the keys) close at up to vmax and null the sideways drift.
const DOCK_HELPERS = String.raw`
PT.zero = () => Object.assign(INP, {pitch: 0, yaw: 0, roll: 0, tx: 0, ty: 0, tz: 0});
PT.rcsDesign = (stack, host) => { const d = toV2(JSON.parse(JSON.stringify(stack))), f = n => n.k === host ? n : (n.c || []).map(f).find(Boolean), h = f(d.root);
  for (const y of [0.15, 0.95]) h.c.push({k: 'rcs', at: {y, a: 0, n: 4, cy: 0.1}, c: []}); h.c.push({k: 'gas', at: {y: 0.5, a: Math.PI / 4, n: 2, cy: 0.3}, c: []}); return d };
PT.park = s => { const r0 = TELLUS.R + 300e3; Object.assign(s, {landed: false, sas: false, throttle: 0, w: [0, 0, 0]}); s.rec.launched = true; s.rec.day0 = PROG.day;
  s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(TELLUS.mu / r0)]; S = s; return s };
PT.dockScene = ({gap = 50, lat = 2, close = 0, tgt = ['port', 'cam', 'petrel'], me = null} = {}) => { FLEET.length = 0; PROG.sats = []; PROG.satN = 0; simT = 0; PT.zero();
  const s = PT.park(newShip(me || PT.rcsDesign(['port', 'pod', 't1', 'kestrel'], 't1'))), Y = qrot(s.q, [0, 1, 0]), k = newShip(tgt); k.landed = false; k.rec.launched = true; k.rec.day0 = PROG.day;
  k.q = qmul(qaxis([0, 0, 1], Math.PI), s.q); k.r = add(add(s.r, mul(Y, s.yTop + gap + k.yTop)), [0, lat, 0]); k.v = s.v.slice(); satRegister(k, {day0: PROG.day});
  s.v = add(s.v, mul(Y, close)); const q = PROG.sats[PROG.sats.length - 1]; s.target = q.id; PT.q = q; return {target: q.name, gap, lat, gas: +(rcsGas(S) * 1000).toFixed(1)} };
PT.rel = q => { const [rq, vq] = satAt(q, simT), qi = qconj(S.q); return {p: qrot(qi, sub(rq, S.r)), u: qrot(qi, sub(S.v, vq))} };
PT.dockIn = ({vmax = 0.5, tmax = 1800, stopAt = 0} = {}) => { const q = PT.q; S.sas = true; S.sasMode = 'dock'; S.rcs = true; const g0 = rcsGas(S), t0 = simT, tr = []; let k = 0, d = 0;
  while (!S.att.length && S.alive && simT - t0 < tmax) { const {p, u} = PT.rel(q); d = len(p); if (stopAt && d < stopAt) break;
    const want = [clamp(0.05 * p[0], -0.2, 0.2), Math.min(vmax, 0.1 + 0.02 * Math.max(0, p[1] - S.yTop - 2)), clamp(0.05 * p[2], -0.2, 0.2)], e = want.map((w, i) => w - u[i]);
    INP.tx = Math.abs(e[0]) > 0.01 ? Math.sign(e[0]) : 0; INP.ty = Math.abs(e[1]) > 0.01 ? Math.sign(e[1]) : 0; INP.tz = Math.abs(e[2]) > 0.01 ? Math.sign(e[2]) : 0;
    advPhys(S); if (k++ % 500 === 0) tr.push([Math.round(simT - t0), +d.toFixed(1), +u[1].toFixed(2)]) }
  PT.zero(); return {latched: !!S.att.length, secs: Math.round(simT - t0), dist: +d.toFixed(2), gasKg: +((g0 - rcsGas(S)) * 1000).toFixed(2), docked: !!PT.q.docked, track: tr.slice(0, 10),
    hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Target|Closest|Port|Line|Dock|RCS|Gas|Vessel/.test(l))} };
PT.steps = sec => { const t0 = simT; while (simT - t0 < sec && S.alive) advPhys(S); return +(simT - t0).toFixed(1) };
true`;
const DOCKSTART = [DOCK_HELPERS, `PT.preset('Orbiter'); PT.launch(); true`];
ROWS[59] = {title: 'dock to a port from 50 m with RCS and Docking SAS (with 58)', steps: [...DOCKSTART, `PT.dockScene({gap: 50, lat: 2})`, `PT.look(2.4, 0.15, 30)`, {shot: 'start'},
  `PT.dockIn({stopAt: 12})`, `PT.look(2.4, 0.15, 20)`, {shot: 'close'}, `PT.dockIn()`, `PT.look(2.4, 0.15, 20)`, {shot: 'latched'}],
  checks: {latched: `S.att.length > 0`}, expect: {latched: v => v === true}};
ROWS[60] = {title: 'undock and push off', steps: [...DOCKSTART, `PT.dockScene({gap: 8, lat: 0.3})`, `PT.dockIn()`,
  `(()=>{ const q = PT.q; undock(S, q.id); PT.steps(5); const {u, p} = PT.rel(q); return {sep: +(-u[1]).toFixed(3), dist: +len(p).toFixed(2), docked: !!q.docked, att: S.att.length} })()`, `PT.look(2.4, 0.15, 25)`, {shot: 'undocked'}]};
// §22: a camera satellite, antenna toward us, 1 m beyond the nose, closing at 1 and 6 m/s with no pilot
const BUMP = v => [`PT.dockScene({gap: 1, lat: 0, close: ${v}, tgt: ['ant', 'cam', 'petrel'], me: ['pod', 't1', 'kestrel']})`,
  `(()=>{ const q = PT.q, n0 = PT.log.length; let k = 0; while (!q.spin && S.alive && k++ < 2000) advPhys(S); PT.steps(3); return {v: ${v}, spin: q.spin ? +len(q.spin.w).toFixed(3) : null, kit: (q.shape || []).map(o => o.k), alive: S.alive, sats: PROG.sats.length, log: PT.logSince(n0)} })()`,
  `PT.look(2.4, 0.15, 20)`, {shot: 'bump' + v}];
ROWS[61] = {title: 'bump a satellite at 1 and 6 m/s', steps: [...DOCKSTART, ...BUMP(1), ...BUMP(6)]};
ROWS[56] = {title: 'rendezvous: G to target, close from 300 m', steps: [...DOCKSTART, `PT.dockScene({gap: 300, lat: 25})`, `S.target = null; S.tgtV = null; true`, {key: 'g'},
  `({target: S.target, name: (PROG.sats.find(q => q.id === S.target) || {}).name, hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Target|Closest/.test(l))})`, `PT.look(2.4, 0.15, 30)`, {shot: 'targeted'},
  `PT.dockIn({vmax: 2, stopAt: 15})`, `PT.look(2.4, 0.15, 30)`, {shot: 'close'}]};
ROWS[62] = {title: 'split a flight into two vessels and switch', steps: [...DOCKSTART,
  `(()=>{ FLEET.length = 0; PROG.sats = []; simT = 0; PT.park(newShip(['pod', 't1', 'dec', 'core', 't1', 'sparrow'])); for (let k = 0; k < 4 && !FLEET.length; k++) stage(S); PT.steps(20); return {fleet: FLEET.map(v => v.name), flying: S.name, hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Vessel/.test(l))} })()`,
  `PT.look(2.4, 0.15, 25)`, {shot: 'split'}, {key: ']'}, `({flying: S.name, parts: S.parts.filter(p => p.on).map(p => p.d.key), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Vessel/.test(l))})`, `PT.look(2.4, 0.15, 25)`, {shot: 'switched'}]};
ROWS[63] = {title: 'open the cargo bay and release the payload', steps: [...DOCKSTART,
  `(()=>{ FLEET.length = 0; PROG.sats = []; simT = 0; PT.park(newShip(['core', 't1', 'bay', 'pod', 't2', 'kestrel'])); bayOp(S, 'open'); PT.steps(1); return doorF(S.parts.find(p => p.d.kind === 'bay')) })()`, `PT.look(2.4, 0.15, 18)`, {shot: 'doors_half'},
  `PT.steps(1.2); bayOp(S, 'rel'); PT.steps(15); ({fleet: FLEET.map(v => v.name), sep: FLEET[0] ? +len(sub(FLEET[0].v, S.v)).toFixed(3) : null})`, `PT.look(2.4, 0.15, 25)`, {shot: 'released'}]};

// Stations (QUEUE Q30 slice 3): §26 claw, §30 radial ports and a habitat, §32 the arm, §33 a beacon on Selene; and the
// busiest HUD (row 98). The Program side is read after the flight is left (Debrief first, then the Program's Fleet tab).
const ST_HELPERS = String.raw`
PT.hubDes = (arm) => { const d = toV2(['core', 't2']), f = n => n.k === 't2' ? n : (n.c || []).map(f).find(Boolean), h = f(d.root); h.c.push({k: 'rport', at: {y: 1.0, a: 0, n: 1, cy: 0.5}, c: []});
  if (arm) h.c.push({k: 'arm', at: {y: 1.0, a: Math.PI, n: 1, cy: 0.3}, c: []}); return d };
PT.hub = arm => { FLEET.length = 0; PROG.sats = []; PROG.satN = 0; simT = 0; PT.zero(); const s = PT.park(newShip(PT.hubDes(arm))); s.q = [0, 0, 0, 1]; return s };
PT.W = x => add(S.r, qrot(S.q, sub(x, S.cm)));
PT.fleetTab = () => { go('program'); if (screenNow() === 'debrief') go('program'); PT.click('[data-ptab="fleet"]'); return document.getElementById('progBody').innerText.slice(0, 900) };
true`;
const STSTART = [DOCK_HELPERS, ST_HELPERS, `PT.preset('Orbiter'); PT.launch(); true`];
ROWS['60c'] = {title: 'grab and release with the claw', steps: [...STSTART,
  `(()=>{ const r = PT.dockScene({gap: 0.3, lat: 0, close: 0.4, tgt: ['ant', 'cam', 'petrel'], me: ['claw', 'pod', 't1', 'kestrel']}); const k = PROG.sats[0]; let n = 0; while (!S.att.length && n++ < 2000) advPhys(S);
     return {grabbed: S.att.length ? S.att[0].kind : null, secs: +(n * DT).toFixed(1), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Dock|Claw/.test(l))} })()`, `PT.look(2.4, 0.15, 14)`, {shot: 'grabbed'},
  `(()=>{ undock(S, PT.q.id); PT.steps(5); const {u, p} = PT.rel(PT.q); return {sep: +(-u[1]).toFixed(3), dist: +len(p).toFixed(2), att: S.att.length} })()`, `PT.look(2.4, 0.15, 14)`, {shot: 'released'}]};
// §30's module: a habitat with a nose port, 0.3 m off the hub's side port, closing at 0.15 m/s; then the flight is left
ROWS[64] = {title: 'a habitat on a radial port, and the station line', steps: [...STSTART,
  `(()=>{ const s = PT.hub(false), rp = portsOf(s.parts.filter(p => p.on), new Set()).find(x => Math.abs(x.ax[1]) < 1e-9), n = qrot(s.q, [1, 0, 0]), face = PT.W(rp.face);
     const k = newShip(['port', 'hab']); k.landed = false; k.rec.launched = true; k.rec.day0 = PROG.day; k.q = qFromTo([0, 1, 0], mul(n, -1)); k.r = sub(add(face, mul(n, 0.3)), mul(mul(n, -1), k.yTop)); k.v = add(s.v.slice(), mul(n, -0.15));
     satRegister(k, {day0: PROG.day}); PT.q = PROG.sats.at(-1); let i = 0; while (!S.att.length && i++ < 3000) advPhys(S); return {docked: S.att.length ? S.att[0].kind : null, secs: +(i * DT).toFixed(1), station: stationOf(PROG.sats.at(-1)), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Dock|Station/.test(l))} })()`,
  `PT.look(1.2, 0.2, 16)`, {shot: 'berthed'}, `PT.fleetTab()`, {shot: 'fleet'}, `testAdvance(30); PT.fleetTab()`]};
ROWS[66] = {title: 'grapple and berth with the arm', steps: [...STSTART,
  `(()=>{ const s = PT.hub(true), armP = s.parts.find(p => p.d.kind === 'arm'), base = PT.W(armBase(armP).P); const k = newShip(['port', 'lab']); Object.assign(k, {landed: false, v: s.v.slice()}); k.r = add(base, [-4, 0, 0]); k.q = qFromTo([0, 1, 0], [0, 0, 1]); k.rec.launched = true;
     satRegister(k, {day0: PROG.day}); PT.q = PROG.sats.at(-1); const g = armOp(S, 'grab'); let n = 0; while (armBusy(S) && n++ < 20000) advPhys(S); return {grab: g, secs: +(n * DT).toFixed(1), att: S.att.map(a => a.kind), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Arm|Dock/.test(l))} })()`,
  `PT.look(1.2, 0.25, 22)`, {shot: 'grappled'},
  `(()=>{ const b = armOp(S, 'berth'); let n = 0; const tr = []; while (armBusy(S) && n++ < 40000) { advPhys(S); if (n % 500 === 0) tr.push(PT.hud().split(String.fromCharCode(10)).filter(l => /Arm/.test(l)).join('')) } return {berth: b, secs: +(n * DT).toFixed(1), att: S.att.map(a => a.kind), arm: tr.slice(0, 6)} })()`,
  `PT.look(1.2, 0.25, 22)`, {shot: 'berthed'}]};
// §33: a beacon lander standing on Selene, the flight left there
ROWS[67] = {title: 'a beacon on Selene: a moonbase in the Fleet tab', steps: [...STSTART,
  `(()=>{ FLEET.length = 0; PROG.sats = []; simT = 0; const B = SELENE, s = newShip(['beacon', 'core', 't1', 'sparrow']), u = [1, 0, 0]; Object.assign(s, {body: B, landed: true, alive: true, sas: false, throttle: 0});
     s.pf = mul(u, groundR(B, mul(u, B.R)) - s.yBot); s.qLocal = qFromTo([0, 1, 0], u); syncLanded(s); Object.assign(s.rec, {launched: true, day0: PROG.day, crewed: false, crewOK: true}); S = s; return {body: S.body.name, landed: S.landed} })()`,
  `PT.look(0.9, 0.15, 14)`, {shot: 'beacon'}, `PT.fleetTab()`, {shot: 'fleet'}]};
// everything at once: RCS, a target 8 m off, a second vessel in the flight, docking rows; every box must stay apart
ROWS[98] = {title: 'the HUD in a busy flight', steps: [M1_HELPERS, ...STSTART,
  `(()=>{ PT.dockScene({gap: 40, lat: 1.5, me: PT.rcsDesign(['port', 'pod', 't1', 'dec', 'core', 't1', 'sparrow'], 't1')}); for (let k = 0; k < 5 && !FLEET.length; k++) stage(S); S.throttle = 0; return {fleet: FLEET.map(v => v.name)} })()`,
  `PT.dockIn({stopAt: 10})`, `PT.showUI(); ({rows: PT.hud().split(String.fromCharCode(10)).map(l => l.split(String.fromCharCode(9))[0]), boxes: PT.boxes()})`, {shot: 'busy'}], checks: {boxes: `PT.boxes()`}, expect: {boxes: v => v.length === 0}};

// QUEUE Q101: TESTING 127, the Debrief after each way a flight ends, reached with the real buttons (End flight ▸, the Esc
// menu's End flight, the toolbar's Assembly), plus going back to it from the Program. Each: the screen, which exit is
// highlighted, the outcome line and the money block.
const DEB = tag => `(()=>{ const big = [...document.querySelectorAll('#deb .hqHead button')].filter(b => b.classList.contains('big')).map(b => b.id), body = document.getElementById('debBody').innerText;
  return {tag: '${tag}', screen: screenNow(), big, againShown: PT.vis('#bDebAgain'), head: (document.getElementById('debHead') || {}).innerText, outcome: body.split(String.fromCharCode(10)).slice(0, 2).join(' / '),
    money: (body.match(/Money[^]*?Net for the program.*/) || [''])[0].split(String.fromCharCode(10)).join(' · ').slice(0, 300)} })()`;
ROWS[127] = {title: 'the Debrief after each way a flight ends', flags: NOMONEY, steps: [
  `PT.preset('Sounding'); PT.launch(); S.throttle = 1; stage(S); PT.fly(() => S.thrust <= 0 && simT > 5, 200); for (let k = 0; k < 4 && !S.chute; k++) { stage(S); PT.fly(() => false, 1) } PT.fly(() => S.landed || !S.alive, 3000); PT.showUI(); ({landed: S.landed, endShown: PT.vis('#bEnd')})`,
  {click: '#bEnd'}, DEB('landed, End flight ▸'), {shot: 'landed'}, {key: 'p'}, `screenNow()`,
  `go('assembly'); PT.preset('Sounding'); PT.launch(); S.throttle = 1; stage(S); PT.fly(() => S.thrust <= 0 && simT > 5, 200); PT.fly(() => S.landed || !S.alive, 3000); PT.showUI(); ({alive: S.alive, endShown: PT.vis('#bEnd')})`,
  {click: '#bEnd'}, DEB('crashed, End flight ▸'), {shot: 'crashed'}, {key: 'b'}, `screenNow()`,
  `PT.preset('Orbiter'); PT.launch(); ${ORBIT.replace(/;$/, '')}; PT.fly(() => false, 30); PT.showUI(); true`, {key: 'Escape'}, {click: '[data-esc="end"]'}, {click: '[data-esc="end"]'},
  DEB('in orbit, Esc → End flight'), {shot: 'orbit'}, `go('program'); screenNow()`,
  `go('assembly'); PT.preset('Sounding'); PT.launch(); S.throttle = 1; stage(S); PT.fly(() => simT > 20, 60); PT.showUI(); true`, {click: '#bEditor'}, {click: '#bEditor'}, DEB('mid-flight, toolbar Assembly'), {shot: 'to_assembly'},
  {key: 'b'}, `screenNow()`, `go('program'); go('debrief'); screenNow()`, DEB('again from the Program'), {shot: 'again'}],
  checks: {screens: `true`}};

// Selene's far side (Q30 follow-up): §40's relay and §42's rovers placed in the program, then the Program and the rover
// screen as a player reaches them. Contact over a relay orbit is sampled by moving the program day (rvFieldContact is pure).
const SEL_HELPERS = String.raw`
PT.selPt = want => { for (let i = 0; i < 3000; i++) { const z = 1 - (2 * i + 1) / 3000, a = i * 2.39996, s = Math.sqrt(1 - z * z), u = [s * Math.cos(a), z, s * Math.sin(a)];
  if (Math.abs(u[1]) < .15 && want(u, geoAt(SELENE, mul(u, SELENE.R)))) return u } return null };
PT.rover = (u, slots, name) => { const R = rvNew({name, ch: 'l', wh: 'm', n: 6, spr: 'S', slots}, SELENE, mul(u, groundR(SELENE, mul(u, SELENE.R))), [0, 1, 0], {}); R.name = name; R.id = 70 + (PROG.rvOut || []).length; R.km0 = 0;
  PROG.rvOut = PROG.rvOut || []; PROG.rvOut.push(rvEntry(R)); return PROG.rvOut.at(-1) };
PT.relay = alt => { const B = SELENE, s = newShip(PRESETS.Probe), rp = B.R + alt, v0 = Math.sqrt(B.mu / rp); for (const p of s.parts) if (p.d.kind === 'cam' || p.d.kind === 'sci') p.on = false;
  Object.assign(s, {alive: true, landed: false, body: B, r: [rp, 0, 0], v: [0, 0, -v0]}); satRegister(s, {day0: PROG.day}); return PROG.sats.at(-1) };
true`;
ROWS[115] = {title: 'a far-side rover driven through a Selene relay', steps: [SEL_HELPERS, `go('program'); PROG.sats = []; PROG.rvOut = []; testEpoch(4); true`,
  `(()=>{ const e = PT.rover(PT.selPt((u, g) => u[0] > .2 && g.unit === 'high'), ['cam', 'bat', 'ant', 'sol', null], 'Far rover'), before = rvFieldContact(e), q = PT.relay(1000e3), B = SELENE;
     const per = 2 * Math.PI * Math.sqrt((B.R + 1000e3) ** 3 / B.mu) / DAY_S, d0 = PROG.day; let n = 0, N = 0, via = null, dl = 0, tOk = null;
     for (let k = 0; k < 300; k++) { PROG.day = d0 + k * per / 300; const c = rvFieldContact(e); N++; if (c.ok) { n++; via = c.via; dl = Math.max(dl, c.delay); tOk = tOk ?? PROG.day } }
     PROG.day = tOk ?? d0; return {relay: q && q.name, before: before.ok, contactShare: +(n / N).toFixed(2), via, maxDelayMs: Math.round(dl * 1000), periodH: +(per * DAY_S / 3600).toFixed(1)} })()`,
  `PT.click('[data-ptab="fleet"]'); (document.getElementById('progBody').innerText.match(/Rovers in the field[^]{0,300}/) || [''])[0]`, {shot: 'fleet'},
  {click: '[data-rvdrive]'}, `({screen: screenNow(), rover: document.getElementById('rover') ? document.getElementById('rover').innerText.slice(0, 500) : null})`, {shot: 'drive'}]};
ROWS[117] = {title: 'rover science on Selene: rock, spectrometer, panorama', steps: [SEL_HELPERS, `go('program'); PROG.sats = []; PROG.rvOut = []; testEpoch(4); true`,
  `(()=>{ const e = PT.rover(PT.selPt((u, g) => u[0] < -.8 && g.unit === 'mare'), ['spec', 'cam', 'seis', 'ant', 'bat', 'sol', null, null], 'Sci rover'); return {contact: rvFieldContact(e).ok} })()`,
  `PT.click('[data-ptab="fleet"]'); true`, {click: '[data-rvdrive]'}, {wait: 4000},
  `(()=>{ const t = document.getElementById('rover') ? document.getElementById('rover').innerText : ''; return {screen: screenNow(), rock: t.split(String.fromCharCode(10)).find(l => /^rock/.test(l)) || '', ground: t.split(String.fromCharCode(10)).find(l => /^ground/.test(l)) || '', buttons: [...document.querySelectorAll('[data-rvsci]')].map(b => b.textContent + (b.disabled ? ' (' + b.title + ')' : ''))} })()`, {shot: 'rover'},
  {click: '[data-rvsci="spec"]'}, {wait: 3000}, `({log: PT.log.slice(-4), reads: RV ? RV.reads : RVA ? RVA.reads : null, panel: document.getElementById('rover').innerText.split(String.fromCharCode(10)).slice(-4).join(' · ')})`, {shot: 'spec'},
  {click: '[data-rvsci="pano"]'}, {wait: 3000}, `({log: PT.log.slice(-4), panel: document.getElementById('rover').innerText.split(String.fromCharCode(10)).slice(-4).join(' · ')})`, {shot: 'pano'},
  `go('program'); if (screenNow() === 'debrief') go('program'); (PT.text('#progBody') || '').match(/On Selene[^]{0,300}/)?.[0] || 'no On Selene section on this tab'`, `ovOpen('logbook'); (PT.text('#logbook') || '').match(/On Selene[^]{0,400}/)?.[0] || 'no On Selene section in the logbook'`, {shot: 'logbook'}]};

// 116: §41's scene, the docking pilot in a 100 km Selene orbit; then undock, and the probe is still listed around Selene
ROWS[116] = {title: 'rendezvous and dock with a Selene orbiter', steps: [...DOCKSTART,
  `(()=>{ const B = SELENE, r = PT.dockScene({gap: 40, lat: 1.5}), r0 = B.R + 100e3, Y = qrot(S.q, [0, 1, 0]), k = PT.q;
     // move both into Selene orbit, the target re-registered in Selene's frame
     PROG.sats = []; S.body = B; S.r = [r0, 0, 0]; S.v = [0, 0, -Math.sqrt(B.mu / r0)]; const t = newShip(['port', 'cam', 'petrel']); Object.assign(t, {body: B, landed: false}); t.rec.launched = true; t.rec.day0 = PROG.day;
     t.q = qmul(qaxis([0, 0, 1], Math.PI), S.q); t.r = add(add(S.r, mul(Y, S.yTop + 40 + t.yTop)), [0, 1.5, 0]); t.v = S.v.slice(); satRegister(t, {day0: PROG.day}); PT.q = PROG.sats.at(-1); S.target = null;
     return {body: S.body.name, listed: moonSats(B).map(q => q.name)} })()`, {key: 'g'}, `({target: S.target, hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Target|Closest|Body/.test(l))})`,
  `PT.dockIn()`, `PT.look(2.4, 0.15, 20)`, {shot: 'docked_selene'},
  `(()=>{ undock(S, PT.q.id); PT.steps(5); return {att: S.att.length, aroundSelene: moonSats(SELENE).map(q => q.name)} })()`]};

// ---- run ---------------------------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args[0] === '--eval') {
  await fresh();
  logs = [];
  for (let k = 1; k < args.length; k++) { const r = await ev(args[k]); console.log(k, JSON.stringify(r).slice(0, 3000)); await wait(300); await shot(`eval_${k}.png`) }
  if (logs.length) console.log('console:', logs.slice(0, 20));
} else {
  const want = args.length ? args : Object.keys(ROWS);
  const resPath = `${OUT}/results.json`;
  for (const n of want) {
    const R = ROWS[n]; if (!R) { console.log('no row', n); continue }
    const t0 = Date.now(), res = {row: n, title: R.title, steps: [], shots: [], checks: {}, failed: [], console: []};
    try {
      await fresh(R.flags === undefined ? undefined : R.flags, R.query, R.gate); logs = [];
      for (const st of R.steps || []) {
        if (typeof st === 'string') { const r = await ev(st); res.steps.push(r.err ? {err: r.err} : r.val); if (r.err) res.failed.push('step threw: ' + r.err.split('\n')[0]) }
        else if (st.wait) await wait(st.wait);
        else if (st.key) { for (const k of [].concat(st.key)) { await press(k, st.ms); await wait(st.gap ?? 150) } }
        else if (st.hold) { await keyEv('keyDown', st.hold); await wait(st.ms); await keyEv('keyUp', st.hold) }
        else if (st.click) { const r = await ev(`(()=>{const e=typeof ${JSON.stringify(st.click)}==='string'?document.querySelector(${JSON.stringify(st.click)}):null;if(!e)return null;const b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]})()`);
          if (!r.val) res.failed.push('no element to click: ' + st.click); else { await clickAt(...r.val); await wait(150) } }
        else if (st.shot) { await wait(st.settle ?? 300); res.shots.push(await shot(`r${n}_${st.shot}.png`)) }
      }
      for (const [k, e] of Object.entries(R.checks || {})) { const r = await ev(e); res.checks[k] = r.err ? {err: r.err} : r.val;
        if (r.err) res.failed.push(`check ${k} threw`); else if (R.expect && R.expect[k] && !R.expect[k](r.val)) res.failed.push(`check ${k} = ${JSON.stringify(r.val)}`) }
    } catch (x) { res.failed.push('driver: ' + x.message) }
    res.console = logs.slice(0, 30); if (logs.some(l => l.startsWith('EXC'))) res.failed.push('page exception');
    res.secs = +((Date.now() - t0) / 1000).toFixed(1);
    const all = fs.existsSync(resPath) ? JSON.parse(fs.readFileSync(resPath, 'utf8')) : {}; all[n] = res;   // re-read: runs may overlap
    console.log(`row ${n} ${res.failed.length ? 'FAIL ' + res.failed.join('; ') : 'ok'} (${res.secs} s) shots ${res.shots.join(' ')}`);
    console.log('   checks', JSON.stringify(res.checks).slice(0, 1500)); if (res.console.length) console.log('   console', res.console.slice(0, 5).join(' | ').slice(0, 800));
    fs.writeFileSync(resPath, JSON.stringify(all, null, 1));
  }
}
ws.close(); ch.kill(); process.exit(0);
