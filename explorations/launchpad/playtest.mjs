// The robot playtester: walks TESTING.md rows on the real GPU and records screenshots, numbers and console errors.
// usage:  node playtest.mjs [rows…]           run those rows (default: every row in ROWS), e.g. node playtest.mjs 95 96 38
//         node playtest.mjs --eval <js>…      probe: fresh tester page, evaluate each expression (awaited), screenshot after each
//         node playtest.mjs --watch[=speed] m1  watch it play (Q224): a visible Chrome window, flights at real speed × speed
//                                               (warped in coasts), a caption for what the robot does, a mark where it clicks
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
// --watch[=speed] (Q224): headed Chrome, paced for a person watching; its results and shots go to <out>/watch
const ARGV = process.argv.slice(2), WARG = ARGV.find(a => a.startsWith('--watch')), WATCH = WARG ? +(WARG.split('=')[1] || 1) : 0;
const URL0 = process.env.PT_URL || 'http://localhost:8799/launchpad/index.html', OUT = (process.env.PT_OUT || 'C:/Users/caioa/dev/playtest-out') + (WATCH ? '/watch' : '');
const W = +(process.env.PT_W || 1280), H = +(process.env.PT_H || 800);
fs.mkdirSync(OUT, {recursive: true});
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- helpers injected into the page (window.PT) ----------------------------------------------------------------------
const HELPERS = String.raw`
window.PT = {
  log: [],   // every HOOK.msg / HOOK.news line since the helpers were injected, with the sim time
  hookLog() { if (HOOK.__pt) return; HOOK.__pt = 1; for (const k of ['msg', 'news']) { const f = HOOK[k]; HOOK[k] = (...a) => { PT.log.push((typeof simT === 'number' ? simT.toFixed(1) : '') + ' ' + k + ': ' + String(a[0]).replace(/<[^>]+>/g, '')); return f.apply(HOOK, a) } } },
  logSince(n) { return PT.log.slice(n) },
  // sign the charter on the title screen (Q241 R3): tick how it starts (k, else the first), then Found the program
  start(k) { const c = k && document.querySelector('[data-cstart="'+k+'"]'); if (c) c.click(); const b = document.querySelector('#bFound'); if (b) b.click(); return !!b },
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
  fly(cond, tmax = 600, opts = {}) { const t0 = simT; let n = 0; const fin = () => { INP.pitch = 0; return {t: +(simT - t0).toFixed(1), steps: n, alive: S.alive} };
    const r = PT.loop(() => { if (!(S.alive && !cond() && simT - t0 < tmax)) return false; if (opts.ascent) { INP.pitch = (simT >= (opts.kick||8) && simT < (opts.kick||8) + (opts.kickLen||0.8)) ? 1 : 0; if (simT > (opts.kick||8) + 1.8 && S.sasMode !== 'pro' && sasModeOK(S, 'pro')) { S.sas = true; S.sasMode = 'pro' } } if (opts.autostage && simT - t0 > 3 && S.thrust <= 0 && S.evIdx < S.events.length && simT - (PT._st ?? -9) > 1) { stage(S); PT._st = simT; PT.W && PT.say('Staging') } if (opts.each) opts.each(); advPhys(S); if (opts.smoke && !PT.W) emitSmoke(DT); n++ }, Infinity, {warp: PT.coastWarp});
    return r && r.then ? r.then(fin) : fin() },
  // run body() (one physics step each, false ends it) to the end: at once, or in watch mode (PT.W) across animation frames at
  // speed × warp() sim seconds per real second, the game's own simulate() held off so the live loop only draws
  W: null,
  loop(body, maxK = Infinity, opts = {}) {
    if (!PT.W) { let k = 0; while (k++ < maxK && body() !== false); return k }
    return new Promise(res => { const sim0 = window.simulate; window.simulate = () => {}; let k = 0, acc = 0, last = performance.now();
      const tick = now => { const dt = Math.min(0.1, (now - last) / 1000), w = opts.warp ? opts.warp() : 1; last = now; acc += dt * PT.W.speed * w; PT.warpTag(w * PT.W.speed);
        const t0 = simT; let done = false, n = 0; while (acc >= DT && n++ < 4000) { acc -= DT; if (k++ >= maxK || body() === false) { done = true; break } } if (n >= 4000) acc = 0; emitSmoke(simT - t0);
        if (done) { window.simulate = sim0; PT.warpTag(0); res(k) } else requestAnimationFrame(tick) };
      requestAnimationFrame(tick) }) },
  // warp while nothing happens: engines off, high above the ground (×20 above the air, ×4 in it)
  coastWarp() { if (!S.alive || S.throttle > 0 || groundGap(S) < 3000) return 1; return PT.alt() > (S.body.atm || 0) ? 20 : 4 },
  say(text) { if (!PT.W) return text; let c = document.getElementById('ptcap'); if (!c) { c = document.createElement('div'); c.id = 'ptcap';
      c.style.cssText = 'position:fixed;left:50%;bottom:150px;transform:translateX(-50%);max-width:70%;padding:10px 16px;border-radius:8px;background:rgba(10,14,22,.82);color:#fff;font:600 17px system-ui,sans-serif;z-index:99999;pointer-events:none;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.4)';
      document.body.appendChild(c) }
    c.innerHTML = '<span style="color:#7fd4ff;font-size:12px;letter-spacing:.12em;margin-right:10px">ROBOT</span>' + text + '<span id="ptwarp" style="color:#ffd27f;margin-left:10px"></span>'; return text },
  warpTag(w) { const e = document.getElementById('ptwarp'); if (e) e.textContent = w > 1.01 ? '×' + Math.round(w) : '' },
  dot(x, y) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:' + (x - 18) + 'px;top:' + (y - 18) + 'px;width:36px;height:36px;border:3px solid #ffd27f;border-radius:50%;z-index:99999;pointer-events:none;transition:transform .6s,opacity .6s';
    document.body.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = 'scale(1.8)'; d.style.opacity = '0' })); setTimeout(() => d.remove(), 900); return true },
  alt() { return len(S.r) - S.body.R },
  agl() { return groundGap(S) },
  // the vessel's nose against its airflow, degrees
  aoaDeg() { const va = sub(S.v, surfVel(S.body, S.r)); return Math.acos(clamp(dot(norm(va), qrot(S.q, [0, 1, 0])), -1, 1)) * 57.2958 },
  orbit() { const r = len(S.r), v2 = dot(S.v, S.v), mu = S.body.mu, a = 1 / (2 / r - v2 / mu), h = len(cross(S.r, S.v)), e = Math.sqrt(Math.max(0, 1 - h * h / (mu * a))); return {ap: a * (1 + e) - S.body.R, pe: a * (1 - e) - S.body.R} },
  // show the HUD and frame the camera on the ship: yaw, pitch, dist
  look(yaw, pitch, dist) { cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; PT.showUI(); render(); return true },
  hud() { if (typeof updateHUD === 'function') updateHUD(); const c = document.getElementById('cards'); return document.getElementById('info').innerText + (c ? String.fromCharCode(10) + c.innerText : '') },   // the core and the cards (flow, slice 4a)
  news() { const n = document.getElementById('news'); return n ? n.innerText : '' },
  msg() { const m = document.getElementById('msg'); return m ? m.innerText : '' },
  showUI() { document.querySelectorAll('.ui,#news,#msg').forEach(e => e.style.visibility = ''); if (mode === 'flight') updateHUD(); render(); return true },
  frames(n) { return new Promise(r => { let k = 0; const f = () => (++k >= n ? r(k) : requestAnimationFrame(f)); requestAnimationFrame(f) }) },
};
PT.hookLog();
true`;

// ---- Chrome over CDP -------------------------------------------------------------------------------------------------
const port = 9300 + Math.floor(Math.random() * 500);
const ch = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [...(WATCH ? ['--window-position=60,40', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-first-run', '--no-default-browser-check'] : ['--headless=new']), `--remote-debugging-port=${port}`,
  ...(process.env.SHOT_FLAGS ? process.env.SHOT_FLAGS.split(' ') : (process.env.PT_IGPU ? ['--use-angle=d3d11', '--enable-gpu'] : ['--use-angle=d3d11', '--enable-gpu', '--force_high_performance_gpu'])), '--ignore-gpu-blocklist',
  '--hide-scrollbars', `--window-size=${W + (WATCH ? 16 : 0)},${H + (WATCH ? 48 : 0)}`, `--user-data-dir=${process.env.TEMP}/ptprof${port}`, WATCH ? '--app=about:blank' : 'about:blank'], {stdio: 'ignore'});
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break } catch {} await wait(200) }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); let logs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400));
  else if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; logs.push('EXC ' + (d.exception?.description || d.text).slice(0, 600)) } };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params})) });
await cmd('Runtime.enable'); await cmd('Page.enable');
if (!WATCH) await cmd('Emulation.setDeviceMetricsOverride', {width: W, height: H, deviceScaleFactor: 1, mobile: false});   // watching: the window's own size
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
  const q = query ?? (flags ? '?tester' : ''), url = URL0 + (URL0.includes('?') && q.startsWith('?') ? '&' + q.slice(1) : q);   // Q221: PT_URL may carry its own query
  await cmd('Page.navigate', {url});
  for (let i = 0; i < 100; i++) { await wait(200); const r = await ev('typeof render==="function"&&typeof PROG==="object"&&document.readyState==="complete"'); if (r.val) break }
  await wait(1500);
  await ev(`new Promise(r=>{const s=document.createElement('script');s.src='views.js';s.onload=()=>r(true);s.onerror=()=>r(false);document.head.appendChild(s)})`);
  await ev(HELPERS); if (WATCH) await ev(`PT.W = {speed: ${WATCH}}; PT.say('Starting'); true`);
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
const PROGTAB = t => `(()=>{ go('program'); PT.click('[data-ptab="${t}"]'); return document.getElementById(${JSON.stringify(t)} === 'inbox' ? 'deskTrayBox' : 'progBody').innerText.slice(0, 1500) })()`;   // (Q239) the Inbox is the desk's in-tray
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
  ...['inbox', 'missions', 'contracts', 'fleet', 'world', 'industry', 'company'].flatMap(t => [`PT.click('[data-ptab="${t}"]'); document.getElementById('${t === 'inbox' ? 'deskTrayBox' : 'progBody'}').innerText.slice(0,300)`, {shot: t}])],
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
  `PT.start('company'); ({gate: progGate, build: document.getElementById('bBuild').disabled, funds: PROG.funds, name: progName()})`, {shot: 'started'}],
  checks: {gate: `progGate`}, expect: {gate: v => v === false}};

// M1's finish line (QUEUE Q55, ROADMAP § M1): a new career, no tester flags, from the first-run gate to the first orbit
// and its debrief. Written before M1 is done, so it FAILS until the flow lane's M1 items land; each check names its item.
// Two flights: a Sounding for "Above the weather", then the beeper (an instrument package in orbit). No preset carries
// one to orbit until PLAYTEST #24 added the Beeper preset; the robot flies it (or, on an old page, the Orbiter with the package for the pod). The ascent
// is fly_ladder.mjs's handAscent (PT.ascent(flatKm): the turn ends at flatKm, 38 there): attitude set directly, so it proves the career path, not that the rocket is flyable.
// Boxes: every visible panel on each screen, pairwise; any overlap ≥ 40 px² at 1280×800 is listed.
const M1_HELPERS = String.raw`
PT.boxes = () => { const els = [...document.querySelectorAll('body *')].filter(e => { if (e.tagName === 'CANVAS' || e.closest('.hidden') || e.id === 'ptcap' || e.closest('#ptcap')) return false; const cs = getComputedStyle(e);
    if (!/absolute|fixed|sticky/.test(cs.position) || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.width * r.height < 0.5 * innerWidth * innerHeight && e.innerText.trim() });   // full-screen layers are containers, not boxes
  const top = els.filter(e => !els.some(o => o !== e && o.contains(e))), name = e => e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  const out = []; for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) { const A = top[i].getBoundingClientRect(), B = top[j].getBoundingClientRect();
    const w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top); if (w > 0 && h > 0 && w * h >= 40) out.push(name(top[i]) + ' × ' + name(top[j]) + ' ' + Math.round(w * h) + ' px²') }
  return out };
PT.debrief = () => /debrief/.test(screenNow()) || [...document.querySelectorAll('[id*=debrief],[class*=debrief]')].some(e => !e.closest('.hidden') && e.getBoundingClientRect().height > 0);
PT.ascent = (flatKm = 38) => { const s = S, ATM = TELLUS.atm, AS = ATM / 7e4, tgt = ATM + 10000; s.sas = false; s.throttle = 1; if (s.evIdx === 0) stage(s); let k = 0, phase = 'up'; const say = x => { if (PT.W) PT.say(x) }; say('Full throttle: liftoff, then a slow turn toward the horizon');
  const point = Y => { const f = localFrame(s.r), X = norm(cross(Y, f.n)); s.q = qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0] };
  const pitch = d => { const f = localFrame(s.r), r = d * Math.PI / 180; point(norm(add(mul(f.e, Math.cos(r)), mul(f.up, Math.sin(r))))) };
  const body = () => { if (!(s.alive && k++ < 400000)) return false; const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - TELLUS.R;
    if (phase === 'up') { const f = Math.min(1, Math.max(0, (h - 200 * AS) / (flatKm * 1000 * AS - 200 * AS))); pitch(90 * (1 - Math.pow(f, 0.6))); if (el.ap - TELLUS.R > tgt) { s.throttle = 0; phase = 'coast'; say('Apoapsis high enough: engine off, coasting up to it') } }
    else if (phase === 'coast') { pitch(0); s.throttle = h < ATM && el.ap - TELLUS.R < tgt - 500 ? 0.3 : 0;
      const dvC = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a)); if (h > ATM && timeToNu(el, Math.PI) < Math.max(25, 0.5 * dvC / Math.max(engAcc(s), 0.1))) { phase = 'circ'; say('At apoapsis: burning along the horizon to circularise') } }
    else { const f = localFrame(s.r), hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), need = sub(mul(hv, Math.sqrt(TELLUS.mu / len(s.r))), s.v); point(norm(need)); s.throttle = 1;
      if (el.pe - TELLUS.R > ATM + 2000 || len(need) < 3) { s.throttle = 0; say('In orbit'); return false } }
    if (s.throttle > 0 && dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) { stage(s); say('Stage empty: staging') }
    advPhys(s) };
  const fin = () => { const o = PT.orbit(); return {alive: s.alive, pe: Math.round(o.pe / 1e3), ap: Math.round(o.ap / 1e3), atm: TELLUS.atm / 1e3, t: Math.round(simT)} };
  const r = PT.loop(body, Infinity, {warp: () => phase === 'coast' && len(s.r) - TELLUS.R > ATM ? 20 : 1}); return r && r.then ? r.then(fin) : fin() };
PT.state = () => ({screen: screenNow(), day: +PROG.day.toFixed(1), funds: +PROG.funds.toFixed(1), flights: PROG.flights, done: Object.keys(PROG.done)});
true`;
// The Program as the director's desk (flow, QUEUE Q239 R1): a Sounding flown in real frames (so the liftoff photo is
// taken by frame(), as in play), then the desk with the photo, the clipping and, after a first, a certificate.
ROWS.desk = {title: 'the Program as a desk: photo, clipping, in-tray; the Debrief as the report', gate: true, flags: null, steps: [M1_HELPERS,
  {click: '[data-cstart="agency"]'}, {click: '#bFound'}, {shot: 'desk_new'},
  `(async()=>{ go('assembly'); PT.preset('Sounding'); PT.launch(); S.throttle = 1; stage(S); await new Promise(r => setTimeout(r, 6000)); return {photo: !!localStorage.getItem('launchpad-photo'), screen: screenNow(), room: document.body.classList.contains('room')} })()`,
  `(()=>{ PT.fly(() => S.thrust <= 0 && simT > 5, 200); for (let k = 0; k < 4 && !S.chute; k++) { stage(S); PT.fly(() => false, 1) } PT.fly(() => S.landed || !S.alive, 3000); go('program'); return {screen: screenNow(), room: document.body.classList.contains('room'), photo: !!document.querySelector('#debWall img'), head: PT.text('#debHead'), boxes: PT.boxes()} })()`,
  {shot: 'report'}, `(()=>{ go('program'); return {screen: screenNow(), room: document.body.classList.contains('room'), wall: document.getElementById('deskWall').innerText.slice(0, 300)} })()`,
  {shot: 'desk_after'}, `(()=>{ PT.click('[data-ptab="inbox"]'); return {tab: progTab, tray: document.getElementById('deskTrayBox').innerText.slice(0, 200)} })()`],
  checks: {room: `document.body.classList.contains('room')`, photo: `!!document.querySelector('#deskWall img')`, boxes: `PT.boxes()`}};
ROWS.m1 = {title: 'new career: gate → first orbit → debrief (M1 finish line)', gate: true, flags: null, steps: [M1_HELPERS,
  // the first-run gate, with real clicks
  {say: 'A new player opens the game for the first time'}, {shot: 'gate'}, `({tester: typeof TEST === 'object' ? TEST.on : null, gate: progGate, boxes: PT.boxes()})`,
  {say: 'Picks a space agency to start a career'}, {click: '[data-cstart="agency"]'}, {click: '#bFound'}, `({gate: progGate, build: document.getElementById('bBuild').disabled, ...PT.state(), program: PT.text('#prog').slice(0, 600)})`, {shot: 'program'},
  `PT.m1 = {boxes: {program: PT.boxes()}}; PT.m1.boxes.program`,
  // flight 1: Sounding, "Above the weather"
  {say: 'First contract, "Above the weather": to the Assembly (B) to build a sounding rocket'}, {key: 'b'}, `PT.preset('Sounding'); ({screen: screenNow(), cost: vesselCost(S.parts).cost, funds: PROG.funds, boxes: (PT.m1.boxes.assembly = PT.boxes())})`, {shot: 'assembly'},
  {say: 'Loads the Sounding preset and rolls it out'}, {click: '#bRoll'}, `PT.m1.boxes.rollout = PT.boxes(); ({screen: screenNow(), checks: document.getElementById('rollChecks').innerText})`, {shot: 'rollout'}, {say: 'Launch: full throttle, first stage lit'}, {click: '#launch'}, `S.throttle = 1; stage(S); PT.m1.t0 = simT; ({screen: screenNow()})`, {wait: 2500},
  `PT.m1.live = +(simT - PT.m1.t0).toFixed(2); PT.m1.boxes.flight = PT.boxes(); ({live: PT.m1.live, alt: Math.round(PT.alt())})`, {shot: 'climb'},
  // Esc pauses (Q39): the sim clock stands still while the Esc menu is open
  {say: 'Esc mid-flight: the game should pause'}, {key: 'Escape'}, `PT.m1.tE = simT; true`, {wait: 2500}, `PT.m1.escRun = +(simT - PT.m1.tE).toFixed(2); ({escRun: PT.m1.escRun, menu: PT.vis('#escm')})`, {shot: 'esc'}, {key: 'Escape'},
  {say: 'Back to the flight: up above the weather, then down under the parachute'},
  `(async () => ({fly: await PT.fly(() => S.landed || !S.alive, 4000, {autostage: true}), landed: S.landed, alive: S.alive, rec: {apex: Math.round(S.rec.apex), recSci: S.rec.recSci}}))()`,
  {say: 'Landed: to the Program screen for the Debrief'},
  `go('program'); PT.m1.deb1 = PT.debrief(); ({debrief: PT.m1.deb1, ...PT.state(), boxes: PT.boxes(), news: PT.logSince(0).slice(-8)})`, {shot: 'after_sounding'},
  // flight 2: the beeper
  {say: 'Second contract, "The beeper": an instrument package in orbit. The Beeper preset in the Assembly'},
  `go('assembly'); stackDef = JSON.parse(JSON.stringify(PRESETS.Beeper || PRESETS.Orbiter.map(k => k === 'pod' ? 'sci' : k))); editorChanged(); ({stack: stackDef.join(' '), cost: vesselCost(S.parts).cost, funds: PROG.funds, open: missionOpen(MISSIONS.find(m => m.id === 'beeper'))})`, {shot: 'beeper_assembly'},
  {click: '#bRoll'}, {say: 'Roll out, launch, fly it to orbit'}, {click: '#launch'}, `(async () => ({screen: screenNow(), ascent: await PT.ascent(), rec: {orbit: S.rec.orbit, orbitSci: S.rec.orbitSci}}))()`,
  `PT.showUI(); PT.m1.boxes.orbit = PT.boxes(); ({hud: PT.hud().slice(0, 400)})`, {shot: 'orbit'},
  {say: 'The map (M): the orbit it reached'}, `go('map'); render(); PT.m1.boxes.map = PT.boxes(); ({line: PT.text('#navtxt'), ball: PT.vis('#nav')})`, {shot: 'orbit_map'}, `go('flight'); render(); true`,   // slice 4c: the heading line
  {say: 'End of the flight: the Program screen and its Debrief'}, `go('program'); PT.m1.deb2 = PT.debrief(); ({debrief: PT.m1.deb2, ...PT.state(), boxes: (PT.m1.boxes.after = PT.boxes()), news: PT.logSince(0).slice(-10)})`, {shot: 'after_orbit'}],
  checks: {tester: `typeof TEST === 'object' ? TEST.on : false`, weather: `!!PROG.done.weather`, beeper: `!!PROG.done.beeper`, flights: `PROG.flights`,
    escPauses: `PT.m1.escRun`, debrief: `[PT.m1.deb1, PT.m1.deb2]`, boxes: `Object.entries(PT.m1.boxes).filter(([k, v]) => v.length).map(([k, v]) => k + ': ' + v.join(', '))`},
  expect: {tester: v => !v, weather: v => v === true, beeper: v => v === true,
    escPauses: v => v === 0,                       // flow Q39
    debrief: v => v[0] === true && v[1] === true,  // flow Q2
    boxes: v => v.length === 0}};                  // M1: no box covers another at 1280×800

// M2's finish line (QUEUE Q233, ROADMAP § M2, DECISIONS D17.1), written first like Q55 for M1: it FAILS until M2 lands, and
// each failed check names what's missing. A new career plays m1's two flights (no tester flags, nothing seeded), then the
// two epoch-3 satellites a player would: a Weather satellite (the Satellite preset flown north into a polar orbit) and TV
// for the capital (the same preset, east, then raised to the stationary orbit and circularised over the equator: the robot's
// own burns, attitude set directly as in PT.ascent). It makes a routine from the weather satellite in the Fleet tab, orders
// three runs by hand, turns on *Repeat by itself* as soon as it's allowed, and from then on lets time pass only by mission
// control's [N] Wait (a decision is declined, a deviation let go; both listed). Finish: the network still earns and the
// routine keeps it up. ~4 program years (the mainframes allow repeating from day ~1455), in steps of at most 150 waits.
const M2_HELPERS = String.raw`
PT.m2 = {adv: 0, stops: [], declined: [], letGo: 0, autoOn: null, sats0: null, led: {}, upMin: null, autoRuns: 0, flights: []};
PT.point = Y => { const f = localFrame(S.r), ref = Math.abs(dot(Y, f.n)) > 0.9 ? f.e : f.n, X = norm(cross(Y, ref)); S.q = qFromBasis(X, Y, cross(X, Y)); S.w = [0, 0, 0] };
PT.incl = () => { const el = elements(S.r, S.v, TELLUS.mu); return +(Math.acos(Math.max(-1, Math.min(1, el.h[1] / el.hl))) * 57.29578).toFixed(1) };
// PT.ascent toward a heading (az degrees from north: 0 polar, 90 east), circularised along the path it flies
PT.ascentAz = (az = 90, flatKm = 38) => { const s = S, ATM = TELLUS.atm, AS = ATM / 7e4, tgt = ATM + 10000, A = az * Math.PI / 180; s.sas = false; s.throttle = 1; if (s.evIdx === 0) stage(s); let k = 0, phase = 'up'; const ph = PT.m2.ph = [], mark = p => { const el = elements(s.r, s.v, TELLUS.mu); ph.push([p, Math.round(simT), Math.round(dvRemaining(s).tot), Math.round((el.ap - TELLUS.R) / 1e3), Math.round((len(s.r) - TELLUS.R) / 1e3), Math.round(len(s.v))]) };
  const hdg = f => norm(add(mul(f.n, Math.cos(A)), mul(f.e, Math.sin(A)))), pitch = d => { const f = localFrame(s.r), r = d * Math.PI / 180; PT.point(norm(add(mul(hdg(f), Math.cos(r)), mul(f.up, Math.sin(r))))) };
  const body = () => { if (!(s.alive && k++ < 400000)) return false; const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - TELLUS.R;
    if (k === 1 || k === 3000) mark('up'); if (phase === 'up') { const f = Math.min(1, Math.max(0, (h - 200 * AS) / (flatKm * 1000 * AS - 200 * AS))); pitch(90 * (1 - Math.pow(f, 0.6))); if (el.ap - TELLUS.R > tgt) { s.throttle = 0; phase = 'coast'; mark('coast') } }
    else if (phase === 'coast') { pitch(0); s.throttle = h < ATM && el.ap - TELLUS.R < tgt - 500 ? 0.3 : 0;
      const dvC = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a)); if (h > ATM && timeToNu(el, Math.PI) < Math.max(25, 0.5 * dvC / Math.max(engAcc(s), 0.1))) { phase = 'circ'; mark('circ') } }
    else { const f = localFrame(s.r), hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), need = sub(mul(hv, Math.sqrt(TELLUS.mu / len(s.r))), s.v); PT.point(norm(need)); s.throttle = 1;   // along the orbit's own heading: a local compass heading up here is a plane change
      if (el.pe - TELLUS.R > ATM + 2000 || len(need) < 3) { s.throttle = 0; return false } }
    if (s.throttle > 0 && dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) stage(s);
    advPhys(s) };
  PT.loop(body, Infinity, {}); const o = PT.orbit(); return {alive: s.alive, why: s.lossWhy || null, phase, t: Math.round(simT), dvLeft: Math.round(dvRemaining(s).tot), ph: PT.m2.ph, pe: Math.round(o.pe / 1e3), ap: Math.round(o.ap / 1e3), inc: PT.incl(), log: PT.log.slice(-5)} };
// from a low orbit: prograde until the apoapsis reaches R, coast to it, then circularise there: in the orbit's own plane, or
// (eq) onto the equator, the plane change folded into the burn. Stops when the last stage runs dry
PT.raise = (R, eq = false) => { const s = S, mu = TELLUS.mu; let k = 0, phase = 'raise', dry = null;
  const body = () => { if (!(s.alive && k++ < 3e6)) return false; const el = elements(s.r, s.v, mu), up = norm(s.r), dir = eq ? norm(cross([0, 1, 0], s.r)) : norm(sub(s.v, mul(up, dot(s.v, up)))), need = sub(mul(dir, Math.sqrt(mu / len(s.r))), s.v);
    if (phase === 'raise') { PT.point(norm(s.v)); s.throttle = 1; if (el.ap >= R) { s.throttle = 0; phase = 'coast' } }
    else if (phase === 'coast') { s.throttle = 0; if (timeToNu(el, Math.PI) < Math.max(20, 0.5 * len(need) / Math.max(engAcc(s), 0.1))) phase = 'circ' }
    else { PT.point(norm(need)); s.throttle = 1; if (len(need) < 2) { s.throttle = 0; return false } }
    if (s.throttle > 0 && dvRemaining(s).cur <= 0.5) { if (s.evIdx < s.events.length) stage(s); else { s.throttle = 0; dry = phase; return false } }
    advPhys(s) };
  PT.loop(body, Infinity, {}); const el = elements(s.r, s.v, mu);
  return {alive: s.alive, dry, pe: Math.round((el.pe - TELLUS.R) / 1e3), ap: Math.round((el.ap - TELLUS.R) / 1e3), statKm: Math.round((R - TELLUS.R) / 1e3), periodH: +(2 * Math.PI * Math.sqrt(Math.abs(el.a) ** 3 / mu) / 3600).toFixed(2), dayH: +(DAY_S / 3600).toFixed(2), inc: PT.incl()} };
PT.route = () => (PROG.routes || [])[0] || null;
PT.runs = () => { const r = PT.route(); return r ? (PROG.dispatch || []).filter(D => D.route === r.id).map(D => [D.status, +(D.launch || 0).toFixed(0), D.why || '', D.orb ? Math.round(D.orb.pe / 1e3) + '×' + Math.round(D.orb.ap / 1e3) + ' km' : '', D.auto ? 'auto' : 'ordered']) : [] };
PT.netNow = () => { const r = PT.route(); return {day: +PROG.day.toFixed(1), funds: +PROG.funds.toFixed(1), sats: (PROG.sats || []).filter(q => !q.junk).length, route: r && {name: r.name, keep: r.keep, up: routeSats(r).length, runs: r.runs, clean: r.clean, auto: r.auto, why: routeAutoWhy(r)}, led: PROG.led && {sats: +(PROG.led.sats || 0).toFixed(1)}, runs: PT.runs()} };
// time passes only by mission control's [N] Wait; between waits: a new decision declined (its last option), a deviation let go,
// and the routine's Repeat by itself switched on the first time it's allowed. Stops after max waits or when until() holds
PT.waitN = (until, max = 150) => { let n = 0; const M = PT.m2;
  while (n++ < max && !until()) {
    for (const d of [...(PROG.decisions || [])]) { const o = (d.opts || []).at(-1); if (o) { resolveDecision(d.id, o[0]); M.declined.push(d.title || d.kind) } }
    for (const D of PROG.dispatch || []) if (D.status === 'deviated') { loseDeviation(D.id, 'let go'); M.letGo++ }
    const r = PT.route(); if (r && !r.auto && !routeAutoWhy(r)) { go('program'); PT.click('[data-ptab="fleet"]'); const b = document.querySelector('[data-rauto="' + r.id + '"]'); if (b) { b.click(); if (r.auto) M.autoOn = +PROG.day.toFixed(1) } }
    if (screenNow() !== 'mission') go('mission'); renderMission(); const b = document.querySelector('#mcNext [data-adv]'); if (!b) { M.stops.push('day ' + PROG.day.toFixed(0) + ': nothing dated to wait for'); break }
    const d0 = PROG.day; b.click(); M.adv++; renderMission();
    if (r) { const up = routeSats(r).length; if (r.auto && (M.upMin == null || up < M.upMin)) M.upMin = up }
    if (PROG.day <= d0 + 1e-9) { M.stops.push('day ' + PROG.day.toFixed(0) + ': the wait did not move the calendar (' + (document.getElementById('msg') || {}).innerText + ')'); break } }
  M.autoRuns = (PROG.dispatch || []).filter(D => D.auto && D.status === 'done').length;
  return {waits: M.adv, ...PT.netNow()} };
true`;
// a flight as a player makes it: the preset in the Assembly, [N] until the program can pay for it, rolled out and launched
const M2_FLIGHT = (name, preset, fly) => [{say: name + ': the Satellite preset in the Assembly, rolled out and launched'},
  `go('assembly'); PT.preset(${JSON.stringify(preset)}); PT.m2.cost = vesselCost(S.parts).cost; ({cost: +PT.m2.cost.toFixed(1), funds: +PROG.funds.toFixed(1)})`,
  `({wait: PT.waitN(() => PROG.funds >= PT.m2.cost * 1.1, 40)})`,
  `go('assembly'); PT.preset(${JSON.stringify(preset)}); true`, {click: '#bRoll'}, {click: '#launch'}, `({screen: screenNow(), launched: mode === 'flight' && !!S.rec, funds: +PROG.funds.toFixed(1)})`, fly, `PT.showUI(); true`, {shot: name.toLowerCase().replace(/\W+/g, '_')},
  `go('program'); PT.m2.flights.push(${JSON.stringify(name)}); ({debrief: PT.debrief(), ...PT.state(), sats: (PROG.sats || []).map(q => q.name + (q.route != null ? ' (route)' : ''))})`];
ROWS.m2 = {title: 'satellites that work: weather + TV kept up by a routine, time by [N] only (M2 finish line)', gate: true, flags: null, steps: [
  ...ROWS.m1.steps, M2_HELPERS,
  `PT.m2.after1 = PT.state(); ({wxsat: missionOpen(MISSIONS.find(m => m.id === 'wxsat')), tv: missionOpen(MISSIONS.find(m => m.id === 'tv'))})`,
  // the weather satellite: a near-polar orbit (80–100° counts), 3° east of north so the planet's spin helps instead of being
  // cancelled (~82°), then up to ~300 km so it lasts (at ~106 km it re-enters within weeks)
  ...M2_FLIGHT('Weather satellite', 'Satellite', `(()=>({polar: PT.ascentAz(3), raise: PT.raise(TELLUS.R + 300e3)}))()`),
  // the routine, from it, in the Fleet tab: keep one up
  {say: 'A routine from the Fleet tab: keep the weather satellite up'},
  `(()=>{ go('program'); PT.click('[data-ptab="fleet"]'); const bs = [...document.querySelectorAll('[data-mkroute]')]; if (bs[0]) bs[0].click();
     return {buttons: bs.length, why: (PROG.sats || []).filter(q => !q.junk).map(q => q.name + ': ' + (routeFrom(q).why || 'ok') + ', holds ' + Math.round(skLife(q)) + ' d, decays in ' + Math.round(decayLife(q)) + ' d'), route: PT.netNow().route} })()`, {shot: 'fleet_route'},
  // TV: east to a low orbit, then up to the stationary orbit
  ...M2_FLIGHT('TV satellite', 'Satellite', `(()=>({low: PT.ascentAz(90), raise: PT.raise(STAT_R, true)}))()`),
  // three runs ordered by hand, each waited out with [N]
  ...[1, 2, 3].flatMap(i => [`(()=>{ const r = PT.route(); if (!r) return 'no route'; go('program'); PT.click('[data-ptab="fleet"]'); const b = document.querySelector('[data-rorder="' + r.id + '"]'); if (!b) return {order: 'no Order a run button', why: routeQuote(r).why};
     b.click(); const D = (PROG.dispatch || []).filter(x => x.route === r.id).at(-1); return {ordered: !!D, launch: D && +D.launch.toFixed(1), msg: (document.getElementById('msg') || {}).innerText} })()`,
    `PT.waitN(() => { const r = PT.route(); return !r || !(PROG.dispatch || []).some(x => x.route === r.id && (x.status === 'queued' || x.status === 'deviated')) }, 40)`]),
  {shot: 'after_runs'},
  // years at [N]: until the routine has repeated by itself for a year, or ~4,000 days
  ...Array.from({length: 12}, () => `PT.waitN(() => PROG.day > 4000 || (PT.m2.autoOn != null && PROG.day > PT.m2.autoOn + 400 && PT.m2.autoRuns > 0), 150)`),
  `go('program'); PT.click('[data-ptab="fleet"]'); ({...PT.netNow(), m2: PT.m2, news: PT.logSince(0).slice(-12)})`, {shot: 'fleet_end'},
  `go('mission'); renderMission(); true`, {shot: 'mission_end'}],
  checks: {m1: `!!PROG.done.weather && !!PROG.done.beeper`, wxsat: `!!PROG.done.wxsat`, tv: `!!PROG.done.tv`, route: `!!PT.route()`,
    clean3: `PT.route() ? PT.route().clean : 0`, repeating: `PT.route() ? PT.route().auto : false`, autoRuns: `PT.m2.autoRuns`,
    keptUp: `PT.route() ? routeSats(PT.route()).length + ' of ' + PT.route().keep + ' up, at least ' + PT.m2.upMin + ' while repeating' : 'no route'`,
    earning: `(PROG.sats || []).filter(q => !q.junk && isTV(q, PROG.day * DAY_S)).length`, satsIncome: `+((PROG.led || {}).sats || 0).toFixed(1)`,
    waitsOnly: `PT.m2.adv`, declined: `PT.m2.declined`, letGo: `PT.m2.letGo`},
  expect: {m1: v => v === true,                          // the first hour (m1) still plays
    wxsat: v => v === true,                              // a weather satellite from a player's preset (vehicle: polar from the pad)
    tv: v => v === true,                                 // a stationary orbit over the capital (vehicle: a preset that gets there; space/flow: a way to aim the longitude)
    route: v => v === true,                              // a routine made from it (economy Q184)
    clean3: v => v >= 3,                                 // three clean runs by order (economy W27 ladder; space: the route's procedure reaches its orbit)
    repeating: v => v === true,                          // Repeat by itself, once the mainframes allow it
    autoRuns: v => v >= 1,                               // the routine launched a replacement by itself
    keptUp: v => !/^0 of|no route|least (0|null) /.test(v),   // and kept the network up while repeating
    earning: v => v >= 1,                                // a TV satellite earning at the end
    satsIncome: v => v > 0}};                            // the network earned over time (the ledger's 'sats' line)

// Moons (QUEUE Q30 slice 1, NOTES § "Plan: robot drivers…"): the Selene and Nyx ladders flown in the page by the game's
// own procedures, with fly_ladder.mjs (fetched, its Node-only tail cut, imported from a blob) driving them. Its HOOK is a
// dummy, so the page's HUD and news (and PT.log) see everything a player would. Each mission is one step, then shots.
const MOON_HELPERS = String.raw`
PT.ladder = async () => { if (PT.L) return PT.L; const src = await (await fetch('fly_ladder.mjs')).text(); const cut = src.slice(0, src.indexOf('// run directly'));
  PT.L = await import(URL.createObjectURL(new Blob([cut], {type: 'text/javascript'}))); return PT.L };
PT.api = () => ({PRESETS, TELLUS, SELENE, BODIES, MISSIONS, newShip, stage, advPhys, advRails, railsOK, localFrame, qFromBasis, elements, timeToNu, dvRemaining, dvPlan, engAcc,
  HOOK: {}, PROG, len, norm, add, sub, mul, dot, cross, procStart, procKey, vesselCost, bodyRel, toPF, siteAt, get S() { return S }, set S(v) { S = v }, get t() { return simT }, set t(v) { simT = v }});
PT.fly1 = async id => { const L = await PT.ladder(), n0 = PT.log.length, f0 = PROG.funds; const rows = L.flyLadder(PT.api(), [id]); HOOK.rebuild(); PT.showUI();
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
  `(async()=>{ const L = await PT.ladder(); const a = L.flySite(PT.api(), 'Probe', 'Selene', 10, 20), b = L.flySite(PT.api(), 'Probe', 'Selene', 10, 20); HOOK.rebuild(); PT.showUI(); return {first: a, second: b} })()`, `PT.look(0.9, 0.15, 25)`, {shot: 'landed'}]};

// Docking (QUEUE Q30 slice 2): test.mjs §22/§25/§27/§29's scenes placed in the page (a 300 km orbit, the clock at 0), the
// flown vessel a port-pod-tank-engine stack with two RCS rings and gas (§24's design). PT.dockIn is a pilot: Docking SAS
// holds the attitude, and RCS pulses (INP.tx/ty/tz, ±1 like the keys) close at up to vmax and null the sideways drift.
const DOCK_HELPERS = String.raw`
PT.zero = () => Object.assign(INP, {pitch: 0, yaw: 0, roll: 0, tx: 0, ty: 0, tz: 0});
PT.rcsDesign = (stack, host) => { const d = toV2(JSON.parse(JSON.stringify(stack))), f = n => n.k === host ? n : (n.c || []).map(f).find(Boolean), h = f(d.root);
  for (const y of [0.15, 0.95]) h.c.push({k: 'rcs', at: {y, a: 0, n: 4, cy: 0.1}, c: []}); h.c.push({k: 'gas', at: {y: 0.5, a: Math.PI / 4, n: 2, cy: 0.3}, c: []}); return d };
PT.park = s => { const r0 = TELLUS.R + 300e3; Object.assign(s, {landed: false, sas: false, throttle: 0, w: [0, 0, 0]}); s.rec.launched = true; s.rec.day0 = PROG.day;
  s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(TELLUS.mu / r0)]; S = s; HOOK.rebuild(); return s };   // rebuild: the drawn mesh follows S
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
// a point on the flown ship (its own frame, about the CoM) in world space. Not PT.W: that is the watch-mode flag (PLAYTEST #94)
PT.Wpos = x => add(S.r, qrot(S.q, sub(x, S.cm)));
PT.fleetTab = () => { go('program'); if (screenNow() === 'debrief') go('program'); PT.click('[data-ptab="fleet"]'); return document.getElementById('progBody').innerText.slice(0, 900) };
true`;
const STSTART = [DOCK_HELPERS, ST_HELPERS, `PT.preset('Orbiter'); PT.launch(); true`];
ROWS['60c'] = {title: 'grab and release with the claw', steps: [...STSTART,
  `(()=>{ const r = PT.dockScene({gap: 0.3, lat: 0, close: 0.4, tgt: ['ant', 'cam', 'petrel'], me: ['claw', 'pod', 't1', 'kestrel']}); const k = PROG.sats[0]; let n = 0; while (!S.att.length && n++ < 2000) advPhys(S);
     return {grabbed: S.att.length ? S.att[0].kind : null, secs: +(n * DT).toFixed(1), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Dock|Claw/.test(l))} })()`, `PT.look(2.4, 0.15, 14)`, {shot: 'grabbed'},
  `(()=>{ undock(S, PT.q.id); PT.steps(5); const {u, p} = PT.rel(PT.q); return {sep: +(-u[1]).toFixed(3), dist: +len(p).toFixed(2), att: S.att.length} })()`, `PT.look(2.4, 0.15, 14)`, {shot: 'released'}]};
// §30's module: a habitat with a nose port, 0.3 m off the hub's side port, closing at 0.15 m/s; then the flight is left
ROWS[64] = {title: 'a habitat on a radial port, and the station line', steps: [...STSTART,
  `(()=>{ const s = PT.hub(false), rp = portsOf(s.parts.filter(p => p.on), new Set()).find(x => Math.abs(x.ax[1]) < 1e-9), n = qrot(s.q, [1, 0, 0]), face = PT.Wpos(rp.face);
     const k = newShip(['port', 'hab']); k.landed = false; k.rec.launched = true; k.rec.day0 = PROG.day; k.q = qFromTo([0, 1, 0], mul(n, -1)); k.r = sub(add(face, mul(n, 0.3)), mul(mul(n, -1), k.yTop)); k.v = add(s.v.slice(), mul(n, -0.15));
     satRegister(k, {day0: PROG.day}); PT.q = PROG.sats.at(-1); let i = 0; while (!S.att.length && i++ < 3000) advPhys(S); return {docked: S.att.length ? S.att[0].kind : null, secs: +(i * DT).toFixed(1), station: stationOf(PROG.sats.at(-1)), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Dock|Station/.test(l))} })()`,
  `PT.look(1.2, 0.2, 16)`, {shot: 'berthed'}, `PT.fleetTab()`, {shot: 'fleet'}, `testAdvance(30); PT.fleetTab()`]};
ROWS[66] = {title: 'grapple and berth with the arm', steps: [...STSTART,
  `(()=>{ const s = PT.hub(true), armP = s.parts.find(p => p.d.kind === 'arm'), base = PT.Wpos(armBase(armP).P); const k = newShip(['port', 'lab']); Object.assign(k, {landed: false, v: s.v.slice()}); k.r = add(base, [-4, 0, 0]); k.q = qFromTo([0, 1, 0], [0, 0, 1]); k.rec.launched = true;
     satRegister(k, {day0: PROG.day}); PT.q = PROG.sats.at(-1); const g = armOp(S, 'grab'); let n = 0; while (armBusy(S) && n++ < 20000) advPhys(S); return {grab: g, secs: +(n * DT).toFixed(1), att: S.att.map(a => a.kind), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Arm|Dock/.test(l))} })()`,
  `PT.look(1.2, 0.25, 22)`, {shot: 'grappled'},
  `(()=>{ const b = armOp(S, 'berth'); let n = 0; const tr = []; while (armBusy(S) && n++ < 40000) { advPhys(S); if (n % 500 === 0) tr.push(PT.hud().split(String.fromCharCode(10)).filter(l => /Arm/.test(l)).join('')) } return {berth: b, secs: +(n * DT).toFixed(1), att: S.att.map(a => a.kind), arm: tr.slice(0, 6)} })()`,
  `PT.look(1.2, 0.25, 22)`, {shot: 'berthed'}]};
// §33: a beacon lander standing on Selene, the flight left there
ROWS[67] = {title: 'a beacon on Selene: a moonbase in the Fleet tab', steps: [...STSTART,
  `(()=>{ FLEET.length = 0; PROG.sats = []; simT = 0; const B = SELENE, s = newShip(['beacon', 'core', 't1', 'sparrow']), u = [1, 0, 0]; Object.assign(s, {body: B, landed: true, alive: true, sas: false, throttle: 0});
     s.pf = mul(u, groundR(B, mul(u, B.R)) - s.yBot); s.qLocal = qFromTo([0, 1, 0], u); syncLanded(s); Object.assign(s.rec, {launched: true, day0: PROG.day, crewed: false, crewOK: true}); S = s; HOOK.rebuild(); return {body: S.body.name, landed: S.landed} })()`,
  `PT.look(0.9, 0.15, 14)`, {shot: 'beacon'}, `PT.fleetTab()`, {shot: 'fleet'}]};
// everything at once: RCS, a target 8 m off, a second vessel in the flight, docking rows; every box must stay apart
ROWS[98] = {title: 'the HUD in a busy flight', steps: [M1_HELPERS, ...STSTART,
  `(()=>{ PT.dockScene({gap: 40, lat: 1.5, me: PT.rcsDesign(['port', 'pod', 't1', 'dec', 'core', 't1', 'sparrow'], 't1')}); for (let k = 0; k < 5 && !FLEET.length; k++) stage(S); S.throttle = 0; return {fleet: FLEET.map(v => v.name)} })()`,
  `PT.dockIn({stopAt: 10})`, `PT.showUI(); ({rows: PT.hud().split(String.fromCharCode(10)).map(l => l.split(String.fromCharCode(9))[0]), boxes: PT.boxes()})`, {shot: 'busy'}], checks: {boxes: `PT.boxes()`}, expect: {boxes: v => v.length === 0}};

// QUEUE Q101: TESTING 127, the Debrief after each way a flight ends, reached with the real buttons (End flight ▸, the Esc
// menu's End flight, the toolbar's Assembly), plus going back to it from the Program. Each: the screen, which exit is
// highlighted, the outcome line and the money block.
const DEB = tag => `(()=>{ const big = [...document.querySelectorAll('#debActs button')].filter(b => b.classList.contains('big')).map(b => b.id), body = document.getElementById('debBody').innerText;
  return {tag: '${tag}', screen: screenNow(), big, againShown: PT.vis('#bDebAgain'), head: (document.getElementById('debHead') || {}).innerText, outcome: body.split(String.fromCharCode(10)).slice(0, 2).join(' / '),
    money: (body.match(/Money[^]*?Net for the program.*/i) || [''])[0].split(String.fromCharCode(10)).join(' · ').slice(0, 300)} })()`;
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

// QUEUE Q120: TESTING 65, a crew rotation. A crewed capsule (chute, crew, shield, decoupler, a tank with a radial port)
// takes a habitat's nose port on its side; leaving the flight registers the stack with its crew. Then Program → Fleet → Fly, the HUD's
// undock, a retro burn (the robot cuts the speed to a ~40 km perigee instead of flying it) and the chute home. The checks follow the
// crew: in the station line, aboard the flown stack, and home in the Debrief.
const CREWTXT = () => `({fleet: (PT.text('#progBody') || '').split(String.fromCharCode(10)).filter(l => /station|crew|Capsule|Habitat|Object/i.test(l)).slice(0, 6)})`;
ROWS[65] = {title: 'rotate a crew: fly the station, undock the capsule, bring it home', steps: [...STSTART, `testEpoch(5); true`,
  `(()=>{ FLEET.length = 0; PROG.sats = []; PROG.satN = 0; simT = 0; PT.zero(); const d = toV2(['chute', 'crew', 'shield', 'dec', 't2']), f = n => n.k === 't2' ? n : (n.c || []).map(f).find(Boolean); f(d.root).c.push({k: 'rport', at: {y: 1.0, a: 0, n: 1, cy: 0.5}, c: []});
     const s = PT.park(newShip(d)); s.q = [0, 0, 0, 1]; Object.assign(s.rec, {crewed: true, crewOK: true}); const rp = portsOf(s.parts.filter(p => p.on), new Set()).find(x => Math.abs(x.ax[1]) < 1e-9), n = qrot(s.q, [1, 0, 0]), face = PT.Wpos(rp.face);
     const k = newShip(['port', 'hab', 't2']); k.landed = false; k.rec.launched = true; k.rec.day0 = PROG.day; k.q = qFromTo([0, 1, 0], mul(n, -1)); k.r = sub(add(face, mul(n, 0.3)), mul(mul(n, -1), k.yTop)); k.v = add(s.v.slice(), mul(n, -0.15));
     satRegister(k, {day0: PROG.day}); PT.q = PROG.sats.at(-1); let i = 0; while (!S.att.length && i++ < 3000) advPhys(S); return {latched: S.att.map(a => a.kind), secs: +(i * DT).toFixed(1), crewed: S.rec.crewed, hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Dock|Crew|Pass/.test(l))} })()`,
  `PT.look(1.2, 0.2, 14)`, {shot: 'docked'},
  `PT.fleetTab()`, {shot: 'station'},
  {click: '[data-fly]'}, `({screen: screenNow(), flying: S.name, att: S.att.map(a => a.e.name + ' (' + a.kind + ')'), crewed: S.rec.crewed, hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Dock|Crew|Pass|Body/.test(l))})`, {shot: 'flying_station'},
  {click: '[data-undock]'}, `PT.steps(10); ({att: S.att.length, flying: S.name, sats: PROG.sats.map(q => q.name), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /Dock|Vessel|Target/.test(l))})`, {shot: 'undocked'},
  `(()=>{ for (let k = 0; k < 40 && PT.orbit().pe > 40e3; k++) S.v = mul(S.v, 0.995); const pe = Math.round(PT.orbit().pe / 1e3); for (let k = 0; k < 6 && S.parts.some(p => p.on && p.d.key === 't2'); k++) stage(S); S.sas = true; S.sasMode = 'retro'; for (let k = 0; k < 6 && !S.chute; k++) stage(S); const r = PT.fly(() => S.landed || !S.alive, 6000); PT.showUI(); PT.home = S.landed && S.alive && S.rec.crewOK && S.body === TELLUS; return {pe, fly: r, landed: S.landed, alive: S.alive, crewOK: S.rec.crewOK, body: S.body.name, log: PT.log.slice(-6)} })()`, {shot: 'home'},
  `go('program'); ({screen: screenNow(), debrief: (PT.text('#debBody') || '').split(String.fromCharCode(10)).slice(0, 12).join(' / ')})`, {shot: 'debrief'},
  `go('program'); PT.click('[data-ptab="fleet"]'); true`, CREWTXT(), {shot: 'fleet_after'}],
  checks: {home: `PT.home`}, expect: {home: v => v === true}};

// New rows, 2026-10-09 (QA evergreen). A page reload inside a row: the step reloads, the next waits, and later steps use
// only the page's own globals (PT and views.js are gone after a reload).
const RELOAD = [`setTimeout(() => location.reload(), 50); true`, {wait: 6000}];
ROWS[155] = {title: 'Settings survive a reload', steps: [
  `ovOpen('settings'); PT.click('[data-qual="low"]'); for (const id of ['setPerf', 'setGauges', 'setModern']) { const e = document.getElementById(id); e.checked = !e.checked; e.dispatchEvent(new Event('change', {bubbles: true})) }
   PT.wanted = {quality, perfOn, GAUGES, modern: modernUI()}; PT.wanted`, {shot: 'set'}, `JSON.stringify(PT.wanted)`,
  ...RELOAD, `({quality, perfOn, GAUGES, modern: modernUI()})`],
  checks: {after: `JSON.stringify({quality, perfOn, GAUGES, modern: modernUI()})`}, expect: {after: v => /"quality":"low"/.test(v)}};
ROWS[172] = {title: 'the last Debrief survives a reload', steps: [
  `PT.preset('Sounding'); PT.launch(); S.throttle = 1; stage(S); PT.fly(() => S.thrust <= 0 && simT > 5, 200); for (let k = 0; k < 4 && !S.chute; k++) { stage(S); PT.fly(() => false, 1) } PT.fly(() => S.landed || !S.alive, 3000); go('program');
   localStorage.setItem('pt-deb', document.getElementById('debBody').innerText.slice(0, 400)); screenNow()`, {shot: 'before'},
  ...RELOAD, `go('program'); ({lastShown: !document.getElementById('bDebLast').classList.contains('hidden')})`, {click: '#bDebLast'},
  `({screen: screenNow(), same: document.getElementById('debBody').innerText.slice(0, 400) === localStorage.getItem('pt-deb'), now: document.getElementById('debBody').innerText.slice(0, 200)})`, {shot: 'after'}],
  checks: {same: `document.getElementById('debBody').innerText.slice(0, 400) === localStorage.getItem('pt-deb')`}, expect: {same: v => v === true}};
// 157 and 152: five designs through Roll out; each one's checks (rollChecks) and whether LAUNCH is offered
const ROLL = (tag, stack, pre = '') => `(()=>{ go('assembly'); ${pre} stackDef = JSON.parse(JSON.stringify(${stack})); editorChanged(); go('rollout');
  const ck = rollChecks(), L = document.getElementById('launch'); const r = {tag: '${tag}', screen: screenNow(), checks: ck.map(c => (c.k || c.lvl || c.level || '') + ' ' + (c.t || c.text || c.msg || JSON.stringify(c)).slice(0, 140)), launch: L ? {text: L.textContent, disabled: L.disabled, opacity: L.style.opacity} : null}; return r })()`;
ROWS[157] = {title: 'roll out: the checks before launch (with 152)', flags: {kh: true, tools: true, nofail: true, fast: true}, steps: [
  `testMission('weather', true); testFunds(200); go('program'); true`,
  ROLL('Orbiter, fine', `PRESETS.Orbiter`), {shot: 'ok'},
  ROLL('Hopper, beeper next', `PRESETS.Hopper`), {shot: 'short'},
  ROLL('Big Lunar, over budget', `PRESETS['Big Lunar']`), {shot: 'budget'},
  ROLL('TWR under 1', `['pod', 'T32', 'sparrow']`), {shot: 'twr'},
  ROLL('Orbiter without fins', `PRESETS.Orbiter.filter(k => k !== 'fins')`), {shot: 'unstable'},
  ROLL('biocapsule, no chute', `['bio', 'dec', 't4', 'fins', 'sparrow']`), {shot: 'nochute'},
  `go('assembly'); ({screen: screenNow(), stack: stackDef.join(' ')})`]};
// 147: the Passenger Orbiter once round and home (the robot's ascent, a period on rails, a retro cut, the chute)
ROWS[147] = {title: 'Passenger: one orbit, on the Passenger Orbiter preset', steps: [M1_HELPERS, `PT.flatKm = +(new URLSearchParams(location.search).get('flat') || 60); testEpoch(2); testMission('hop', true); missionOpen(MISSIONS.find(m => m.id === 'orbiter'))`,
  `go('assembly'); PT.preset('Passenger Orbiter'); ({cost: vesselCost(S.parts).cost, stack: stackDef.map(e => typeof e === 'string' ? e : e.k).join(' ')})`, `go('rollout'); rollChecks().map(c => JSON.stringify(c).slice(0, 120))`,
  {click: '#launch'}, `(async () => ({screen: screenNow(), ascent: await PT.ascent(PT.flatKm || 38), bioOK: S.rec.bioOK, cabin: +S.rec.cabin.toFixed(0), why: S.rec.bioWhy, skin: (S.parts.find(p => p.on && p.d.kind === 'bio') || {}).T, passenger: PT.log.filter(l => /Passenger|overheat/.test(l))}))()`,
  `(async ()=>{ const o = elements(S.r, S.v, TELLUS.mu), per = 2 * Math.PI * Math.sqrt(o.a ** 3 / TELLUS.mu), t0 = simT; while (simT - t0 < per * 1.05 && S.alive) advPhys(S);   // physics steps: the flight record counts orbits per step
     for (let k = 0; k < 60 && PT.orbit().pe > 45e3; k++) S.v = mul(S.v, 0.998); S.sas = true; S.sasMode = 'retro'; for (let k = 0; k < 6 && !S.chute; k++) stage(S); const f = await PT.fly(() => S.landed || !S.alive, 8000);
     return {pe: Math.round(PT.orbit().pe / 1e3), orbits: S.rec.bioOrbits, cabin: S.rec.cabinMax, landed: S.landed, alive: S.alive, bioOK: S.rec.bioOK, gMax: S.rec.cgMax || S.rec.gMax, fly: f, log: PT.log.slice(-5)} })()`, {shot: 'home'},
  `go('program'); ({done: !!PROG.done.orbiter, debrief: (document.getElementById('debBody').innerText || '').split(String.fromCharCode(10)).slice(0, 8).join(' / ')})`, {shot: 'debrief'}],
  checks: {done: `!!PROG.done.orbiter`}, expect: {done: v => v === true}};

// 160: two Docking presets, as a player flies them: the first left in orbit (its upper stage, registered), the second's
// upper stage closes in from 50 m with the robot pilot (Docking SAS + RCS)
ROWS[160] = {title: 'dock two Docking presets', steps: [...DOCKSTART,
  `(()=>{ const up = () => { const s = PT.park(newShip(PRESETS.Docking)); for (let k = 0; k < 6 && s.parts.some(p => p.on && p.d.key === 't8'); k++) stage(s); s.throttle = 0; PT.zero(); FLEET.length = 0; return s };
     PROG.sats = []; PROG.satN = 0; simT = 0; const a = up(), Y = qrot(a.q, [0, 1, 0]); a.q = qmul(qaxis([0, 0, 1], Math.PI), a.q); a.r = add(a.r, mul(Y, 0)); satRegister(a, {day0: PROG.day}); const q = PROG.sats.at(-1);
     const b = up(); b.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; const Yb = qrot(b.q, [0, 1, 0]); b.r = sub(q.r, mul(Yb, b.yTop + 50 + a.yTop)); b.r = add(b.r, [0, 1.5, 0]); b.v = q.v.slice(); HOOK.rebuild(); PT.q = q; S.target = q.id;
     return {target: q.name, parts: b.parts.filter(p => p.on).map(p => p.d.key).join(' '), gas: +(rcsGas(S) * 1000).toFixed(1), hud: PT.hud().split(String.fromCharCode(10)).filter(l => /RCS|Target|Port/.test(l))} })()`,
  `PT.look(2.4, 0.15, 30)`, {shot: 'start'}, `PT.dockIn()`, `PT.look(2.4, 0.15, 22)`, {shot: 'docked'},
  `(()=>{ undock(S, PT.q.id); PT.steps(5); const {u} = PT.rel(PT.q); return {sep: +(-u[1]).toFixed(2), att: S.att.length} })()`],
  checks: {latched: `PT.q && PT.q.docked != null ? true : S.att.length >= 0`}};

// Reading rows (QA evergreen): what the Program and the Assembly say, with a shot each
ROWS[165] = {title: "the Beeper's lifetime line", steps: [`go('assembly'); PT.preset('Beeper'); (document.querySelector('#editor .right').innerText.match(/Lifetime.*/) || ['no Lifetime line'])[0]`, {shot: 'beeper'},
  `go('program'); PT.click('[data-ptab="contracts"]'); const b = [...document.querySelectorAll('button')].find(x => /^Take$/.test(x.textContent) && /Satellite to|satellite/i.test(x.closest('div') ? x.closest('div').innerText : '')); if (b) b.click(); ({took: !!b})`,
  `go('assembly'); PT.preset('Beeper'); (document.querySelector('#editor .right').innerText.match(/Lifetime.*/) || ['no Lifetime line'])[0]`, {shot: 'beeper_contract'}]};
ROWS[164] = {title: 'mission control (was: the network screen)', steps: [DOCK_HELPERS, `testEpoch(3); PT.preset('Beeper'); PT.launch(); PROG.sats = []; PT.park(newShip(PRESETS.Beeper.slice(0, 2))); satRegister(S, {day0: PROG.day}); go('program'); if (screenNow() === 'debrief') go('program'); const n = document.getElementById('bMC'); ({shown: n && !n.classList.contains('hidden')})`, {key: 'c'},
  `({screen: screenNow(), text: (document.querySelector('#mc') || document.body).innerText.slice(0, 500)})`, {shot: 'network'}]};
// 233: the network's nodes on mission control's wall (Q170, N2): row 164's setup and C, W twice to the nodes page; then a Selene
// base short of supplies added to netModel's answer (the page only draws it) for the bottleneck line and its frame.
ROWS[233] = {title: "the network's nodes on mission control's wall", steps: [...ROWS[164].steps.slice(0, 3), {key: 'w'}, {key: 'w'},
  `({page: mcPage, text: document.getElementById('mcNet').innerText.slice(0, 400)})`, {shot: 'nodes'},
  `{const nm = netModel; window.netModel = () => {const M = nm(); M.nodes.push({id: 'reg:999', kind: 'base', body: 'Selene', slot: 'surface', name: 'Selene Base 1', stock: {supplies: 400}, need: {supplies: 40}, days: 10, paused: false}); M.bottleneck = {text: 'Selene Base 1 has 10 days of supplies left', node: 'reg:999', good: 'supplies'}; return M}; renderMission(); document.getElementById('mcNet').innerText.slice(0, 200)}`, {shot: 'bottleneck'}]};
// charter: the title screen and the charter (Q241 R3): a new player sees the charter; ticks a power and a start, signs;
// the desk opens; back on the title (Esc menu's Title screen) the charter is signed and Enter continues.
ROWS.charter = {title: 'the title screen and the charter', gate: true, flags: null, steps: [M1_HELPERS, {shot: 'charter'},
  `({screen: screenNow(), desk: PT.vis('#prog'), boxes: PT.boxes(), menu: PT.text('#ttlMenu')})`,
  {click: '#ttlCharter [data-arch]:not([data-arch=""])'}, {click: '[data-cstart="consortium"]'}, {shot: 'ticked'},
  `({found: document.getElementById('bFound').dataset.start, sig: PT.text('#ttlCharter .sig')})`,
  {click: '#bFound'}, `({screen: screenNow(), name: progName(), funds: PROG.funds})`, {shot: 'desk'},
  `go('title'); ({screen: screenNow(), buttons: document.querySelectorAll('#ttlCharter button').length, menu: PT.text('#ttlMenu')})`, {shot: 'signed'},
  {key: 'Enter'}, `({screen: screenNow()})`],
  checks: {screen: `screenNow()`}, expect: {screen: v => v === 'program'}};
// layers: the map's layers (Q261): a satellite up and the ship in orbit; the map with the era's defaults, the panel open,
// then everything on (busy), then only our things with no names
ROWS.layers = {title: "the map's layers", steps: [DOCK_HELPERS, M1_HELPERS, `testEpoch(3); PT.preset('Beeper'); PT.launch(); PROG.sats = []; PT.park(newShip(PRESETS.Beeper.slice(0, 2))); satRegister(S, {day0: PROG.day}); PT.preset('Beeper'); PT.launch(); PT.park(S); go('map'); render(); ({screen: screenNow(), btn: PT.vis('#bLay')})`,
  {click: '#bLay'}, `render(); ({panel: PT.text('#mapLay'), boxes: PT.boxes()})`, {shot: 'defaults'},
  `for (const [k] of MAP_LAYERS) mapLaySet[k] = true; renderMapLay(); render(); true`, {shot: 'all'},
  `for (const [k] of MAP_LAYERS) mapLaySet[k] = ['sats', 'links'].includes(k); renderMapLay(); render(); true`, {shot: 'ours'},
  `mapLaySet = {}; mapLaySave(); go('flight'); ({panel: PT.vis('#mapLay')})`],
  checks: {panel: `PT.vis('#mapLay')`}, expect: {panel: v => v === false}};
// focus: what the map is centred on (Q262): a satellite up and the ship in orbit; the Focus list to the satellite, then a
// double-click on Selene (projected from the map's camera), then Home back to the ship
ROWS.focus = {title: "the map's focus", steps: [DOCK_HELPERS, M1_HELPERS, `testEpoch(3); PT.preset('Beeper'); PT.launch(); PROG.sats = []; PT.park(newShip(PRESETS.Beeper.slice(0, 2))); satRegister(S, {day0: PROG.day}); PT.preset('Beeper'); PT.launch(); PT.park(S); S.r = mul(S.r, -1); S.v = mul(S.v, -1); go('map'); render(); ({list: [...document.querySelectorAll('#mapFocus option')].map(o => o.textContent)})`, {shot: 'ship'},
  `{const el = document.getElementById('mapFocus'); renderMapFocus(); el.value = 's:' + PROG.sats[0].id; el.dispatchEvent(new Event('change')); render(); ({key: mapFocusKey(), dist: Math.round(cam.mDist / 1e3)})}`, {shot: 'satellite'},
  `{const V = HOOK.view, p = bodyPos(BODIES[1], simT), d = sub(p, V.camW), z = dot(d, V.Fw), k = cv.clientWidth / cv.width, x = (dot(d, V.R) / z / V.tanX + 1) / 2 * V.W * k, y = (1 - dot(d, V.U) / z / V.tanY) / 2 * V.H * k;
    cv.dispatchEvent(new MouseEvent('dblclick', {clientX: x, clientY: y, bubbles: true})); render(); ({key: mapFocusKey(), at: [Math.round(x), Math.round(y)]})}`, {shot: 'selene'},
  {key: 'Home'}, `render(); ({key: mapFocusKey()})`, {shot: 'home'}],
  checks: {key: `mapFocusKey()`}, expect: {key: v => v === 'ship'}};
// terms: hover terms (Q287): the Orbiter in the Assembly, hover Δv in the stage rows; then in orbit, hover the HUD's Ap
ROWS.terms = {title: 'hover terms', steps: [DOCK_HELPERS, M1_HELPERS, `{PT.preset('Orbiter'); render(); const el = document.querySelector('#stats [data-term="dv"]'); el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})); ({tip: PT.text('#termTip'), shown: PT.vis('#termTip')})}`, {shot: 'builder'},
  `{PT.preset('Beeper'); PT.launch(); PT.park(S); render(); updateHUD(); const el = document.querySelector('#info [data-term="ap"]'); el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})); ({tip: PT.text('#termTip'), shown: PT.vis('#termTip')})}`, {shot: 'hud'},
  `document.body.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})); ({shown: PT.vis('#termTip')})`],
  checks: {gone: `PT.vis('#termTip')`}, expect: {gone: v => v === false}};
// explain: warnings that explain themselves and part cards (Q340): the Orbiter in the Assembly with too little money, hover
// the cost (over budget: why and the fixes); hover the camera in the parts list (its card ends with what it pairs with)
ROWS.explain = {title: 'self-explaining warnings, part cards', steps: [DOCK_HELPERS, M1_HELPERS, `{go('assembly'); PT.preset('Orbiter'); window.F340 = PROG.funds; PROG.funds = 1; editorChanged(); render(); const el = document.querySelector('#stats [data-wt]'); el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})); ({marks: document.querySelectorAll('#stats [data-wt]').length, tip: PT.text('#termTip'), shown: PT.vis('#termTip')})}`, {shot: 'warning'},
  `{document.body.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})); PROG.funds = window.F340; editorChanged(); const b = [...document.querySelectorAll('#palette button')].find(x => x.textContent.startsWith(PARTS.cam.name)); b.dispatchEvent(new MouseEvent('mouseenter')); ({card: PT.text('#termTip'), own: document.getElementById('termTip').dataset.own})}`, {shot: 'card'},
  `{const b0 = document.querySelector('#palette button'); b0 && b0.dispatchEvent(new MouseEvent('mouseleave')); window.F391 = PROG.funds; PROG.funds = 1; go('rollout'); const el = document.querySelector('#rollChecks [data-wt]'); el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})); window.R391 = PT.text('#termTip'); PROG.funds = window.F391; ({tip: window.R391})}`, {shot: 'rollout'}],
  checks: {tip: `/Over budget/.test(window.R391 || '') && /Fix:/.test(window.R391 || '') && !document.getElementById('partcard') && !document.getElementById('bldtip')`}, expect: {tip: v => v === true}};
// loss: a loss explained (Q293): a Sounding rocket whose joint breaks at 9 s and whose nose then hits the ground; the
// Debrief's "What happened" (the chain, the end, what would help) and the money named line by line
ROWS.loss = {title: 'a loss explained in the Debrief', steps: [M1_HELPERS, `{go('assembly'); PT.preset('Sounding'); go('rollout'); window.L293 = {launch: PT.launch(), screen: screenNow()}; S.throttle = 1; stage(S); L293.fly = PT.fly(() => simT > 9, 60); L293.rec = !!S.rec.launched; L293.alive = S.alive; debFail(S, 'structure', 'structural failure: Sparrow / Tank 1 broke in bending, at 131% of its strength'); lose(S, 'destroyed: the nose hit Tellus at 80 m/s', 0); go('program'); ({L293, debrief: PT.debrief(), text: (document.getElementById('debBody') || {}).innerText})}`, {shot: 'debrief'}],
  checks: {chain: `/What happened/i.test(document.getElementById('debBody').innerText) && /What would help/.test(document.getElementById('debBody').innerText) && !/days passing/.test(document.getElementById('debBody').innerText)`}, expect: {chain: v => v === true}};
// cockpit: the dark cockpit (Q286 slice 1): a Sounding rocket's climb with a headline arriving (held: no ticker, no
// Payload card), a part forced to 95 % of its heat limit (MASTER CAUTION), then down under the chute (the news back)
ROWS.cockpit = {title: 'the dark cockpit', steps: [M1_HELPERS, `{go('assembly'); PT.preset('Sounding'); go('rollout'); PT.launch(); S.throttle = 1; stage(S); HOOK.news('Test headline: it arrives during the climb'); PT.fly(() => simT > 12, 30); updateHUD(); render();
    ({phase: cpPhase(), news: PT.vis('#news'), cards: [...document.querySelectorAll('#cards [data-card]')].map(d => d.dataset.card), sas: [...document.querySelectorAll('#sas button')].map(b => b.textContent)})}`, {shot: 'climb'},
  `{const p = S.parts.find(q => q.on && q.d.kind === 'cone') || S.parts.find(q => q.on); S.hot = p; p.T = p.d.Tmax * 0.95; updateHUD(); render(); window.MC286 = PT.text('#mcau'); p.T = 300; ({mcau: window.MC286})}`, {shot: 'caution'},
  `(async () => { await PT.fly(() => S.landed || !S.alive, 4000, {autostage: true}); updateHUD(); render(); return {landed: S.landed, phase: cpPhase(), news: PT.vis('#news'), mcau: PT.vis('#mcau')} })()`, {shot: 'landed'}],
  checks: {dark: `!!window.MC286 && /MASTER CAUTION/.test(window.MC286) && PT.vis('#news') && !PT.vis('#mcau')`}, expect: {dark: v => v === true}};
// desk: the Program decluttered (Q286 slice 2): a new career's desk (offers one line each, no empty photo frame, far
// epochs as a count), then the first offer opened to its full text
ROWS.declutter = {title: 'the Program decluttered', steps: [{click: '[data-cstart="agency"]'}, {click: '#bFound'}, `{go('program'); ({offers: document.querySelectorAll('#deskTrayBox details.ms.of').length, photo: !!document.querySelector('#deskWall .photo'), locks: [...document.querySelectorAll('#program .ms.lock, #progBody .ms.lock, .ms.lock')].map(e => e.innerText).slice(0, 6)})}`, {shot: 'desk'},
  `{const d = document.querySelector('#deskTrayBox details.ms.of'); d.open = true; ({open: d.open, text: d.innerText.slice(0, 300)})}`, {shot: 'offer'}],
  checks: {one: `document.querySelectorAll('#deskTrayBox details.ms.of').length > 0 && !document.querySelector('#deskWall .photo.empty')`}, expect: {one: v => v === true}};
// deploy: how folded parts deploy (Q400): the Satellite's solar wing selected in the Assembly (the part panel's "In
// flight:" line); then in orbit, folded, the first-time hint and the lit Unfold button
ROWS.deploy = {title: 'how folded parts deploy', steps: [DOCK_HELPERS, M1_HELPERS, `{try { localStorage.removeItem('launchpad-hint-deploy') } catch (e) {} go('assembly'); PT.preset('Satellite'); const q = S.parts.find(p => p.on && unfolds(p.d)), n = q && q.dn; BLD.st.sel = n; BLD.panel(); render(); ({part: n && n.k, line: [...document.querySelectorAll('.bsel .sub')].map(e => e.innerText).find(t => /In flight/.test(t))})}`, {shot: 'panel'},
  `{go('rollout'); PT.launch(); PT.park(S); S.rec.launched = true; for (const p of S.parts) if (p.on && unfolds(p.d)) p.dep = false; const fr = S.parts.find(p => p.on && p.profF); if (fr) fairJettison(S, [S.parts.indexOf(fr)]); updateHUD(); render(); ({msg: PT.text('#msg'), lit: document.getElementById('bWings').classList.contains('hint'), btn: PT.text('#bWings')})}`, {shot: 'hint'}],
  checks: {hint: `/P unfolds/.test(document.getElementById('msg').innerText) || localStorage.getItem('launchpad-hint-deploy') === '1'`}, expect: {hint: v => v === true}};
// topview: the camera straight down (Q405, PLAYTEST #101): T in the Assembly on the Satellite (the CoM marker off the
// axis shows), T again back; then the Sounding rocket climbing, the camera dragged to straight down
ROWS.topview = {title: 'the top-down camera', steps: [M1_HELPERS, `{go('assembly'); PT.preset('Satellite'); render(); window.dispatchEvent(new KeyboardEvent('keydown', {key: 't'})); render(); window.P405 = cam.pitch; ({pitch: +cam.pitch.toFixed(3), R: HOOK.view.R.map(x => +x.toFixed(3))})}`, {shot: 'assembly_top'},
  `{window.dispatchEvent(new KeyboardEvent('keydown', {key: 't'})); render(); go('rollout'); PT.launch(); S.throttle = 1; stage(S); PT.fly(() => simT > 8, 20); cam.pitch = Math.PI / 2; cam.dist = 40; render(); window.V405 = HOOK.view.R.concat(HOOK.view.U); ({pitch: +cam.pitch.toFixed(3), finite: window.V405.every(Number.isFinite)})}`, {shot: 'flight_top'}],
  checks: {view: `(window.V405 || []).length === 6 && window.V405.every(Number.isFinite) && Math.abs(window.P405 - Math.PI / 2) < 1e-6`}, expect: {view: v => v === true}};
// gauges: heat and load you notice (Q271): the Sounding rocket climbing (HEAT and LOAD faint), its nose forced to 70 % of
// its heat limit (amber), then 95 % (red, and the master caution blinking with the reason)
ROWS.gauges = {title: 'HEAT and LOAD by the navball', steps: [M1_HELPERS, `{go('assembly'); PT.preset('Sounding'); go('rollout'); PT.launch(); S.throttle = 1; stage(S); PT.fly(() => simT > 10, 20); updateHUD(); render(); ({heat: document.getElementById('gHeat').className, load: document.getElementById('gLoad').className, t: document.getElementById('gHeat').title})}`, {shot: 'faint'},
  `{const p = S.parts.find(q => q.on && q.d.kind === 'cone') || S.parts.find(q => q.on); S.hot = p; p.T = p.d.Tmax * 0.7; updateHUD(); render(); ({heat: document.getElementById('gHeat').className, t: document.getElementById('gHeat').title})}`, {shot: 'amber'},
  `{const p = S.hot; p.T = p.d.Tmax * 0.95; updateHUD(); render(); window.G271 = [document.getElementById('gHeat').className, PT.text('#mcau'), document.getElementById('mcau').classList.contains('new')]; ({g: window.G271})}`, {shot: 'red'}],
  checks: {red: `(window.G271 || [])[0] === 'g bad' && /MASTER CAUTION heat/.test(window.G271[1]) && window.G271[2] === true`}, expect: {red: v => v === true}};
ROWS[156] = {title: 'the NEXT line in a new career', gate: true, flags: null, steps: [{click: '[data-cstart="agency"]'}, {click: '#bFound'},
  `(document.getElementById('prog').innerText.match(/NEXT.*/) || ['no NEXT line'])[0]`, {shot: 'next'}]};

// 200: the Assembly keeps the design where it was (Q247): deleting the parts underneath leaves the root still on screen and
// above the plate; Clear is one click (the presets' ✕ Empty) and Ctrl+Z brings the design back (Q235); holding a part shows the
// radial-mount count, and its chips set it (Q236)
const PIN200 = `(()=>{ const r = S.parts.find(p => p.core && p.dn && !p.dn.at), up = r.y0 - S.cm[1] - (cam.edY || 0); const o = {root: r.d.key, onScreen: +up.toFixed(3), abovePlate: +(r.y0 + BLD.st.gap).toFixed(3), gap: +BLD.st.gap.toFixed(3), parts: S.parts.length}; (window.PIN200 = window.PIN200 || []).push(o); return o })()`;
const DEL200 = `(()=>{ const low = S.parts.filter(p => p.core).sort((a, b) => a.y0 - b.y0)[0]; BLD.design(); BLD.st.sel = S.parts.find(p => p.i === low.i).dn; BLD.panel(); const b = [...document.querySelectorAll('.bsel button')].find(x => /^delete/.test(x.textContent)); b.click(); render(); return low.d.key })()`;
ROWS[200] = {title: 'the Assembly: pinned design, Clear, radial mounts', steps: [`go('assembly'); PT.preset('Beeper'); HOOK.edStill = true; render(); 'ok'`, PIN200,
  DEL200, PIN200, DEL200, PIN200, {shot: 'pinned'},
  `PT.click('#presets button'); ({empty: BLD.isEmpty(stackDef), status: document.getElementById('target').innerText})`, {shot: 'cleared'},
  `window.CLR200 = BLD.isEmpty(stackDef); document.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', ctrlKey: true, bubbles: true})); render(); window.UNDO200 = S.parts.length`,
  `BLD.grab('t1'); render(); document.querySelector('#target [data-sym="4"]').click(); ({sym: BLD.st.sym, chips: document.querySelectorAll('#target [data-sym]').length})`, {shot: 'mounts'}],
  checks: {pin: `(()=>{ const P = window.PIN200 || []; return P.length === 3 && P.every(o => o.onScreen === P[0].onScreen && o.abovePlate === P[0].abovePlate) && P[2].gap > P[1].gap && P[1].gap > 0 })()`,
    clear: `window.CLR200 === true && window.UNDO200 === 7`, sym: `BLD.st.sym`},
  expect: {pin: v => v === true, clear: v => v === true, sym: v => v === 4}};

// 202: parts parked in the air (Q246): the Orbiter's lower stage picked up, parked beside the rocket (Rollout warns it stays
// behind), picked up again by a click on it, and put back under the upper stage: the same eight parts as before
const CLK202 = `window.CLK = (x, y) => { const g = document.getElementById('gl'), k = g.width / g.clientWidth, o = {bubbles: true, button: 0, clientX: x / k, clientY: y / k};
  g.dispatchEvent(new MouseEvent('mousemove', o)); g.dispatchEvent(new MouseEvent('mousedown', o)); g.dispatchEvent(new MouseEvent('mouseup', o)); render() }; 'ok'`;
ROWS[202] = {title: 'the Assembly: park parts in the air', steps: [`go('assembly'); PT.preset('Orbiter'); HOOK.edStill = true; cam.dist = 30; render(); window.N202 = S.parts.length`, CLK202,
  `(()=>{ const t = S.parts.find(p => p.d.key === 't8'), q = BLD.proj([t.pos[0], t.y0 + t.h / 2, t.pos[2]]); CLK(q[0], q[1]); return {held: BLD.st.held && BLD.st.held.k, parts: S.parts.length} })()`,
  `(()=>{ const v = HOOK.view; CLK(v.W * 0.66, v.H * 0.62); return {park: (stackDef.park || []).length, parts: S.parts.length, warn: launchWarnings(stackDef).map(w => w[1]).filter(w => /parked/.test(w))} })()`, {shot: 'parked'},
  `(()=>{ const P = BLD.parkedInst(), t = P.find(p => p.d.key === 't8'), q = BLD.proj([t.pos[0], t.y0 + t.h / 2, t.pos[2]]); CLK(q[0], q[1]); return {held: BLD.st.held && BLD.st.held.k, park: (stackDef.park || []).length} })()`,
  `(()=>{ const low = S.parts.filter(p => p.core).sort((a, b) => a.y0 - b.y0)[0], q = BLD.proj([low.pos[0], low.y0, low.pos[2]]); CLK(q[0], q[1]); return {held: !!BLD.st.held, parts: S.parts.length, park: (stackDef.park || []).length} })()`, {shot: 'back'}],
  checks: {back: `S.parts.length === window.N202 && !(stackDef.park || []).length && !BLD.st.held`},
  expect: {back: v => v === true}};


// The test bench's TESTING pass (2026-10-13): drivers for rows nobody had driven, newest first. Look rows are refView
// scenes judged from the shots; feel stays a human's.
// 282: a design hanging over the base plate stands on a display rod (Q330). The bottom part deleted from its own panel
const BOTTOM = `(()=>{ const D = BLD.design(), deep = n => (n.c || []).length ? deep(n.c.at(-1)) : n; BLD.st.sel = deep(D.root); BLD.panel(); return BLD.st.sel.k })()`;
ROWS[282] = {title: 'a display rod under a hanging model', steps: [`go('assembly'); PT.preset('Orbiter'); HOOK.edStill = true; cam.yaw = 0.7; cam.pitch = 0.15; render(); ({gap: BLD.st.gap || 0})`, {shot: 'whole'},
  BOTTOM, `PT.clickText('button', '^delete'); render(); ({gap: +(BLD.st.gap || 0).toFixed(2), foot: +BLD.foot().toFixed(2), yBot: +S.yBot.toFixed(2)})`,
  BOTTOM, `PT.clickText('button', '^delete'); BLD.st.sel = null; BLD.panel(); cam.yaw = 0.7; cam.pitch = 0.05; render(); ({gap: +(BLD.st.gap || 0).toFixed(2), parts: S.parts.map(p => p.d.key).join(' ')})`, {shot: 'hanging'}],
  checks: {gap: `+(BLD.st.gap || 0).toFixed(2)`}, expect: {gap: v => v > 0}};
// 270: the flight bar's Legs (Y) and Bay (B) buttons, clicked twice each; none on the Sounding
// (no preset carries legs or a bay: a pod over a cargo bay, four legs on its tank, is built here)
const LEGBAY = `(()=>{ const d = toV2(['chute', 'pod', 'bay', 't2', 'petrel']), f = n => n.k === 't2' ? n : (n.c || []).map(f).find(Boolean); f(d.root).c.push({k: 'leg', at: {y: 0.1, a: 0, n: 4}, c: []});
  stackDef = d; editorChanged(); go('assembly'); PT.launch(); render(); return S.parts.filter(p => p.on).map(p => p.d.kind || p.d.key).join(' ') })()`;
const DEPROW = (kind, id) => [`(()=>{ const b = document.getElementById('${id}'); return {shown: PT.vis('#${id}'), text: b && b.textContent} })()`, `PT.click('#${id}'); if (typeof updateHUD === 'function') updateHUD(); ({text: PT.text('#${id}'), lit: document.getElementById('${id}').className})`, {shot: kind + '_on'},
  `PT.click('#${id}'); if (typeof updateHUD === 'function') updateHUD(); ({text: PT.text('#${id}'), lit: document.getElementById('${id}').className})`];
ROWS[270] = {title: 'legs and bay buttons', steps: [LEGBAY, ...DEPROW('leg', 'bLegs'), ...DEPROW('bay', 'bBay'),
  `go('assembly'); PT.preset('Sounding'); PT.launch(); render(); ({legs: PT.vis('#bLegs'), bay: PT.vis('#bBay')})`, {wait: 1500},
  `if (typeof updateHUD === 'function') updateHUD(); ({after: true, legs: PT.vis('#bLegs'), bay: PT.vis('#bBay'), parts: S.parts.map(p => p.d.key).join(' ')})`, {shot: 'sounding'}],
  checks: {none: `!PT.vis('#bLegs') && !PT.vis('#bBay')`}, expect: {none: v => v === true}};
// 284: the camera shake's switch (Q360): the buffet's size at max-q on and off, and the setting after a reload. How it
// feels is a human's
const SHAKE = `(()=>{ go('assembly'); PT.preset('Lunar'); PT.launch(); S.throttle = 1; stage(S); let m = 0, n = 0; PT.fly(() => S.qdyn > 25000 || simT > 120, 200, {ascent: true});
  for (let i = 0; i < 300; i++) { advPhys(S); const s = camShake(); if (s) { m = Math.max(m, Math.hypot(s[0], s[1])); n++ } } return {on: SHAKE_FX, q: Math.round(S.qdyn), mach: +S.mach.toFixed(2), frames: n, maxDeg: +(m * 57.3).toFixed(3)} })()`;
ROWS[284] = {title: 'a calmer camera shake, and its switch', steps: [SHAKE, `ovOpen('settings'); const e = document.getElementById('setShake'); e.checked = false; e.dispatchEvent(new Event('change', {bubbles: true})); SHAKE_FX`, {shot: 'settings'}, SHAKE,
  ...RELOAD, `SHAKE_FX`, `(()=>{ const e = document.getElementById('setShake'); if (e) { e.checked = true; e.dispatchEvent(new Event('change', {bubbles: true})) } else { SHAKE_FX = true; try { localStorage.setItem('launchpad-shake', '1') } catch (x) {} } return SHAKE_FX })()`],
  checks: {after: `SHAKE_FX`}, expect: {after: v => v === true}};
// look rows from reference scenes: 281 stars by day, dusk and night, planets, airglow; 278 and 272 clouds and their
// shadows at liftoff and in the climb; 275 Selene in its own pass; 274 and 277 each school's pad, its ground and lettering
ROWS[281] = {title: 'planets, stars by day, airglow (refViews)', steps: views(1, 19, 152, 156, 97, 98, 100, 160)};
ROWS[278] = {title: 'clouds at liftoff, cloud shadows (refViews, with 272)', steps: views(80, 81, 82, 83, 153)};
ROWS[275] = {title: 'Selene in its own pass (refViews)', steps: views(19, 158, 112, 113, 3)};
ROWS[263] = {title: 'the sunglint, Tellus from above, the exposure, star halos (refViews, with 258, 262, 265, 269)', steps: views(162, 3, 157, 98, 160)};
ROWS[274] = {title: "each school's pad, its ground and lettering (refViews, with 277)", steps: views(145, 146, 147, 148, 149, 151)};
// 266 and 267: the Unfold button (Q409) and nothing unfolding inside a fairing (Q410), on the Satellite: on the pad, then
// parked in orbit with the fairing dropped (as ROWS.deploy does); click, click again, then P
const WINGS = `({dep: S.parts.filter(p => p.on && unfolds(p.d)).map(p => !!p.dep).join(), btn: PT.text('#bWings'), lit: document.getElementById('bWings').className})`;
ROWS[266] = {title: 'unfold the wings: inside the fairing, then in orbit (with 267)', steps: [DOCK_HELPERS, M1_HELPERS,
  `{go('assembly'); PT.preset('Satellite'); go('rollout'); PT.launch(); updateHUD(); render(); ${WINGS}}`,
  `{const n0 = PT.log.length; PT.click('#bWings'); updateHUD(); ({...${WINGS}, said: PT.logSince(n0)})}`, {shot: 'pad'},
  `{PT.park(S); S.rec.launched = true; const fr = S.parts.find(p => p.on && p.profF); if (fr) fairJettison(S, [S.parts.indexOf(fr)]); updateHUD(); render(); ${WINGS}}`,
  `{PT.click('#bWings'); updateHUD(); PT.look(1.2, 0.2, 12); render(); ${WINGS}}`, {wait: 1500}, {shot: 'unfolded'},
  `{PT.click('#bWings'); updateHUD(); ${WINGS}}`, `{PT.key('p'); updateHUD(); ${WINGS}}`]};
// 260: the Satellite preset's checks in the Assembly (no warnings; stage 2 holds in the air, and how far; the power line)
ROWS[260] = {title: 'a working satellite: its checks', steps: [`{go('assembly'); PT.preset('Satellite'); render(); const t = document.body.innerText;
  ({warn: [...document.querySelectorAll('.warn, .bad, .w, .b')].map(e => e.innerText.trim()).filter(Boolean).slice(0, 6), holds: (t.match(/[^\\n]*holds[^\\n]*/g) || []).slice(0, 3), power: (t.match(/Power[^\\n]*/) || [''])[0]})}`, {shot: 'checks'},
  `{const t = document.body.innerText.split(String.fromCharCode(10)), i = t.findIndex(l => /AERODYNAMICS/.test(l)), e = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && /AERODYNAMICS/.test(x.textContent));
   if (e) e.scrollIntoView({block: 'start'}); ({aero: t.slice(i, i + 16)})}`, {shot: 'aero'}]};
// 286: the camera shake's levels (Q402): the largest sway (degrees) by part of the flight, on the Lunar through max-q and
// its first staging: subsonic, transonic (Mach 0.8–1.2), supersonic, and the 2 s after a staging; Gentle, Full, Off
const SHK = lv => `(()=>{ SHAKE_LV = ${lv}; SHAKE_FX = ${lv} > 0; go('assembly'); PT.preset('Lunar'); PT.launch(); S.throttle = 1; stage(S); const m = {sub: 0, trans: 0, sup: 0, staging: 0}; let ts = -9, e0 = S.evIdx;
  PT.fly(() => simT > 180, 200, {ascent: true, autostage: true, each: () => { if (S.evIdx !== e0) { e0 = S.evIdx; ts = simT } const s = camShake(), a = s ? Math.hypot(s[0], s[1]) * 57.3 : 0;
    const k = simT - ts < 2 ? 'staging' : S.mach < 0.8 ? 'sub' : S.mach < 1.2 ? 'trans' : 'sup'; m[k] = Math.max(m[k], a) }});
  return {lv: SHAKE_LV, ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(3)])), stagings: S.evIdx} })()`;
ROWS[286] = {title: 'camera shake: Off, Gentle, Full', steps: [M1_HELPERS, SHK(1), SHK(2), SHK(0)]};
// 287: the effects clock stops with the pause (Q393): the Heavy's boosters burning, Esc, the clock and two shots 1 s apart
ROWS[287] = {title: 'effects stop with the pause', steps: [`{go('assembly'); PT.preset('Heavy'); PT.launch(); S.throttle = 1; stage(S); PT.look(0.9, 0.05, 45); true}`, {wait: 2500},
  {key: 'Escape'}, `{window.F0 = fxNow(); window.T0 = simT; true}`, {wait: 300}, `{document.querySelectorAll('#escm').forEach(e => e.style.visibility = 'hidden'); true}`, {shot: 'paused_a'}, {wait: 1200}, {shot: 'paused_b'},
  `({fxRan: +(fxNow() - F0).toFixed(1), simRan: +(simT - T0).toFixed(2)})`, `{document.querySelectorAll('#escm').forEach(e => e.style.visibility = ''); true}`, {key: 'Escape'}, {wait: 1000},
  `({fxAfter: +(fxNow() - F0).toFixed(0), simAfter: +(simT - T0).toFixed(2)})`
  ]};
// 247: a missed deadline costs a wait (Q295): take the first offer, let its deadline pass with the Program's Wait buttons,
// then wait on: the news, the client's opinion and the same job back on the board 60–120 days later
ROWS[247] = {title: 'a missed deadline costs a wait', steps: [`{go('program'); const b = document.querySelector('[data-acc]'); b.click(); const c = PROG.active.at(-1); window.C247 = {id: c.id, title: cTitle(c), client: c.client, op0: opOf(c.client), dl: c.deadline}; C247}`,
  `{const n0 = PT.log.length; let k = 0; while (PROG.day <= C247.dl + 1 && k++ < 60) advanceTo(Math.min(C247.dl + 2, PROG.day + 30)); ({day: +PROG.day.toFixed(1), active: PROG.active.some(c => c.id === C247.id), op: opOf(C247.client), news: PT.logSince(n0).filter(l => /Missed|ask again/.test(l))})}`,
  `{let k = 0; const d0 = PROG.day; while (PROG.day < d0 + 130 && k++ < 80 && !(PROG.offers || []).some(o => cTitle(o) === C247.title)) advanceTo(PROG.day + 10); renderProgram(); ({waited: +(PROG.day - d0).toFixed(0), back: (PROG.offers || []).some(o => cTitle(o) === C247.title), op: opOf(C247.client)})}`, {shot: 'board'}],
  checks: {back: `(PROG.offers || []).some(o => cTitle(o) === C247.title)`, opinion: `opOf(C247.client) >= C247.op0 - 1e-9`}, expect: {back: v => v === true, opinion: v => v === true}};
// 243: the commercial giant (Q206), by the row's own console steps: the AI-boom era, a few days, the news; then the
// giant's orbit + 1,700 days, a day, the contract board
ROWS['247c'] = {title: 'control for 247: the same waits with no contract', steps: [`{window.O0 = opOf(0); let k = 0; while (PROG.day <= 80.8 && k++ < 60) advanceTo(Math.min(82, PROG.day + 30)); window.O1 = opOf(0); k = 0; while (PROG.day < 201 && k++ < 80) advanceTo(PROG.day + 10); ({op0: O0, at81: O1, at200: opOf(0), day: +PROG.day.toFixed(0)})}`]};
ROWS[243] = {title: 'the commercial giant', steps: [`{const n0 = PT.log.length; PROG.day = 8400; advanceDays(5); ({giant: PROG.giant ? Object.keys(PROG.giant) : null, news: PT.logSince(n0).filter(l => /giant|commercial|company|AI/i.test(l)).slice(0, 6)})}`,
  `(()=>{ if (!PROG.giant || PROG.giant.orbit == null) return 'no giant.orbit'; const n0 = PT.log.length; PROG.day = PROG.giant.orbit + 1700; advanceDays(1); go('program'); renderProgram(); return ({giant: PROG.giant, news: PT.logSince(n0).slice(-6), offers: (PROG.offers || []).map(o => cTitle(o)).slice(0, 8)}) })()`, {shot: 'board'}]};
// 250: the vapor collar at Mach 1 (refViews 50–56: the Orbiter, the Heavy's boosters); 244: a plume light per side, the
// Heavy launched at night seen from either flank
ROWS[250] = {title: 'the vapor collar (refViews)', steps: views(50, 51, 54, 55)};
ROWS[244] = {title: 'a plume light per side', steps: [`{go('assembly'); PT.preset('Heavy'); PT.launch(); const t0 = simT; for (let k = 1; k < 400; k++) { const tt = t0 + k * 120, site = fromPF(TELLUS, padPF(), tt);
  if (dot(norm(sub(site, bodyPos(TELLUS, tt))), SUN) < -0.3) { simT = tt; break } } syncLanded(S); S.throttle = 1; stage(S); const t1 = simT; while (simT - t1 < 1.5) advPhys(S); window.simulate0 = window.simulate0 || window.simulate; window.simulate = () => {}; true}`,
  `{PT.look(0.6, 0.05, 40); render(); true}`, {wait: 400}, {shot: 'side_a'}, `{PT.look(0.6 + Math.PI, 0.05, 40); render(); true}`, {wait: 400}, {shot: 'side_b'}]};
// look rows from reference scenes, batch 4 (test bench, 2026-10-13): 219 the HDR scene on High then Low; 232 bells and
// noses; 231 re-entry; 235 the flames; 236 the air and the wake; 293 farmland; 290 the haze; 281's planets and dusk;
// 275's Selene; 248 the space sky on High and Low
const LOW = `{applyQuality('low'); true}`;
const viewsLow = (...ns) => ns.flatMap(n => [`refView(${n})`, {shot: 'low' + n}]);
ROWS[219] = {title: 'the HDR scene, High then Low (refViews)', steps: [...views(1, 19, 153, 3, 156, 92), LOW, ...viewsLow(1, 19, 3)]};
ROWS[232] = {title: "the craft's quick wins (refViews)", steps: views(4, 5, 6, 7, 8, 9)};
ROWS[231] = {title: 're-entry: the hull glows, the plasma (refViews)', steps: views(40, 41, 44, 46, 47, 159)};
ROWS[235] = {title: 'the flames, slice 1 (refViews)', steps: views(30, 31, 32, 33, 35, 36)};
ROWS[236] = {title: 'the air and the wake (refViews)', steps: views(50, 52, 101, 102, 103, 104)};
ROWS[293] = {title: "farmland, the pad's range, coasts (refViews)", steps: views(175, 176, 177, 153, 82, 3)};
ROWS[290] = {title: 'the haze without dither (refViews)', steps: views(1, 171, 81, 82, 163, 3)};
ROWS['281b'] = {title: 'planets and the pad at dusk (refViews, 281)', steps: views(169, 170, 171)};
ROWS['275b'] = {title: 'Selene in its own pass, close (refViews, 275)', steps: views(164, 165, 166, 167, 168)};
ROWS[248] = {title: 'the space sky, High then Low (refViews)', steps: [...views(97, 99, 100), LOW, ...viewsLow(97, 100)]};
// builder rows (test bench, 2026-10-13): each design built as the row describes, then the Assembly's own lines read back
// (the Control and Aerodynamics blocks, Touchdown), and the Rollout's checks where the row asks
const PANEL = `PT.panel = re => document.body.innerText.split(String.fromCharCode(10)).filter(l => re.test(l)).slice(0, 14); true`;
const DES = (list, mod = '') => `{const d = toV2(${JSON.stringify(list)}), f = k => (function g(n) { return n.k === k ? n : (n.c || []).map(g).find(Boolean) })(d.root); ${mod} stackDef = d; editorChanged(); go('assembly'); render();
  PT.panel(/Stage \\d (in the air|at max-q)|Max-q|flips|holds|joint|interstage|Liftoff/)}`;
const ROLLCHK = `{go('rollout'); render(); (document.getElementById('rollChecks') || {}).innerText}`;
const SAT234 = ['core', 'batt', 'sci', 'cam', 'fair', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'];
// 234: the fairing satellite flips in the air; with a steerable fin ring under its tank it holds
ROWS[234] = {title: 'a stage that flips in the air', steps: [PANEL, DES(SAT234), {shot: 'flips'}, ROLLCHK, {shot: 'rollout'},
  DES(['core', 'batt', 'sci', 'cam', 'fair', 't2', 'cfins', 'petrel', 'dec', 't8', 'fins', 'kestrel'])]};
// 242: the same with four boosters: its own max-q and the decoupler joint; then an interstage decoupler
const BOOST = ['core', 'batt', 'sci', 'cam', 'fair', 't2', 'petrel', 'dec', 't8', 'fins', {k: 'kestrel', rad: {n: 4, dec: true, stack: ['cone', 't4', 'kestrel']}}];
ROWS[242] = {title: "a fast rocket's own max-q", steps: [PANEL, DES(BOOST), {shot: 'boosters'}, DES(BOOST.map(k => k === 'dec' ? 'istage' : k))]};
// 246: 2 m radial fins at the foot of the Tank 2 t; then the fin ring swapped for 2 m radial fins low on the Tank 8 t
ROWS[246] = {title: 'bigger fins', steps: [PANEL, DES(SAT234, `f('t2').c.push({k: 'rfin', at: {y: 0.05, a: 0, n: 4}, fz: 2, c: []});`), {shot: 'fins_top'},
  DES(SAT234.filter(k => k !== 'fins'), `f('t2').c.push({k: 'rfin', at: {y: 0.05, a: 0, n: 4}, fz: 2, c: []}); f('t8').c.push({k: 'rfin', at: {y: 0.05, a: 0, n: 4}, fz: 2, c: []});`), {shot: 'fins_both'}]};
// 218: the Touchdown line for the Passenger, the Orbiter and the Hopper
ROWS[218] = {title: 'the Touchdown quote', steps: [PANEL, ...['Passenger', 'Orbiter', 'Hopper'].map(n => `{go('assembly'); PT.preset('${n}'); render(); ({${JSON.stringify(n)}: PT.panel(/Touchdown/)})}`)]};
// 239: the rocket on the pad: hanging on the design table, standing in its clamps at the Rollout and behind the Program
ROWS[239] = {title: 'the rocket on the pad', steps: [`{go('assembly'); PT.preset('Orbiter'); render(); true}`, {shot: 'table'}, `{PT.click('#bRoll'); render(); ({screen: screenNow(), y: +S.yBot.toFixed(2)})}`, {wait: 800}, {shot: 'rollout'},
  `{go('program'); render(); screenNow()}`, {wait: 800}, {shot: 'program'}, `{go('assembly'); render(); screenNow()}`, {wait: 800}, {shot: 'table_again'}]};
// 205: a revert puts money, day, registry, flight count and logbook back as they were before liftoff
const STATE205 = `({funds: +PROG.funds.toFixed(2), day: +PROG.day.toFixed(3), sats: (PROG.sats || []).length, flights: PROG.flights, log: Object.keys(PROG.logbook || PROG.lb || {}).length})`;
ROWS[205] = {title: 'a revert discards the flight', steps: [M1_HELPERS, `{go('assembly'); PT.preset('Beeper'); PT.click('#bRoll'); window.B205 = ${STATE205}; B205}`, {click: '#launch'},
  `(async () => ({ascent: await PT.ascent()}))()`, `{go('flight'); PT.key('Escape'); true}`, `{const b = document.querySelector('[data-esc="revert"]') || [...document.querySelectorAll('#escm button')].find(x => /Revert/.test(x.textContent)); b.click(); b.click(); true}`, {wait: 1500},
  `{({before: B205, after: ${STATE205}, screen: screenNow(), landed: S && S.landed})}`],
  checks: {same: `JSON.stringify(${STATE205}) === JSON.stringify(B205)`}, expect: {same: v => v === true}};
// batch 5 (test bench, 2026-10-13): saved designs (211), the desk (214), Graphics Low/High (216), deploying in the Assembly
// (227), side parts and trim (229), a structural failure (237), mission control's walls (213, 233)
const LIB = `(document.querySelector('#blName') || {}).closest ? [...document.querySelectorAll('.pcat')].map(e => e.innerText + ': ' + (e.nextElementSibling ? e.nextElementSibling.innerText.replace(/\\s+/g, ' ').slice(0, 160) : '')).filter(t => /designs|Launched/.test(t)) : null`;
ROWS[211] = {title: "the player's designs", steps: [`{go('assembly'); PT.preset('Orbiter'); render(); PT.clickText('button', '^save design'); const i = document.getElementById('blName'); i.value = 'Robot Orbiter'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true})); ${LIB}}`,
  `{PT.click('#bRoll'); PT.launch(); go('assembly'); PT.click('#bRoll'); PT.launch(); go('assembly'); render(); ${LIB}}`, {shot: 'library'}, ...RELOAD, `{go('assembly'); ${LIB}}`],
  checks: {kept: `JSON.stringify(${LIB})`}, expect: {kept: v => /Robot Orbiter/.test(v)}};
ROWS[214] = {title: "the desk's polish (refView 152, then the Crewed Lunar)", steps: [...views(152), `{PT.preset('Crewed Lunar'); render(); true}`, {wait: 800}, {shot: 'crewed_lunar'}]};
ROWS[216] = {title: 'Graphics Low and High', steps: [`{ovOpen('settings'); const t = document.getElementById('settings') || document.querySelector('.ov:not(.hidden)'); ({graphics: (document.body.innerText.match(/Graphics[^]{0,160}/) || [''])[0].replace(/\\s+/g, ' ')})}`, {shot: 'settings'},
  `{try { localStorage.setItem('launchpad-quality', 'medium') } catch (e) {} applyQuality(typeof loadQuality === 'function' ? loadQuality() : 'medium'); ({quality})}`, ...views(1, 90)]};
// 227: a pod over a cargo bay, legs on its tank and a solar wing ×2: extend all, one leg row folds all, Rollout warnings
const LWB = `{const d = toV2(['chute', 'pod', 'bay', 't2', 'petrel']), f = n => n.k === 't2' ? n : (n.c || []).map(f).find(Boolean); f(d.root).c.push({k: 'leg', at: {y: 0.1, a: 0, n: 4}, c: []}, {k: 'wpanel', at: {y: 0.7, a: 0.4, n: 2}, c: []});
  stackDef = d; editorChanged(); go('assembly'); render(); true}`;
const DEPS = `({deps: S.parts.filter(p => p.on && (unfolds(p.d) || p.d.kind === 'leg' || p.d.kind === 'bay')).map(p => p.d.key + (p.dep ? '+' : '-')).join(' ')})`;
ROWS[227] = {title: 'deploy in the Assembly', steps: [LWB, `{PT.clickText('button', '^extend all'); render(); ${DEPS}}`, {shot: 'extended'},
  `{const D = BLD.design(), f = n => n.k === 'leg' ? n : (n.c || []).map(f).find(Boolean); BLD.st.sel = f(D.root); BLD.panel(); const b = [...document.querySelectorAll('.bsel button')].find(x => /^down$|^up$|^in$|^out$/.test(x.textContent.trim())); if (b) b.click(); render(); ({btn: b && b.textContent, ...${DEPS}})}`,
  `{PT.click('#bRoll'); render(); (document.getElementById('rollChecks') || {}).innerText}`, {shot: 'rollout'}]};
// 229: a probe with a whip, a boom antenna and a side camera: extend all, retract all; a 2 t tank on one side of a first stage
ROWS[229] = {title: 'side antennas, side boxes, trim', steps: [`{const d = toV2(['core', 'batt', 't2', 'petrel']), f = n => n.k === 't2' ? n : (n.c || []).map(f).find(Boolean); f(d.root).c.push({k: 'whip', at: {y: 0.9, a: 0, n: 1}, c: []}, {k: 'bant', at: {y: 0.8, a: 2, n: 1}, c: []}, {k: 'scam', at: {y: 0.5, a: 4, n: 1}, c: []});
  stackDef = d; editorChanged(); go('assembly'); render(); PT.clickText('button', '^extend all'); render(); ${DEPS}}`, {shot: 'extended'}, `{PT.clickText('button', '^retract all'); render(); ${DEPS}}`,
  `{const d = toV2(['chute', 'pod', 'dec', 't8', 'kestrel']), f = n => n.k === 't8' ? n : (n.c || []).map(f).find(Boolean); f(d.root).c.push({k: 't2', at: {y: 0.5, a: 0, n: 1}, c: []}); stackDef = d; editorChanged(); render();
  (document.body.innerText.match(/Trim[^\\n]*/) || [''])[0]}`, {shot: 'trim'}]};
// 237: the Orbiter pitched hard over at ~10 km: the joint gives, sparks, vent, the structure line in the verbose log
ROWS[237] = {title: 'a structural failure shows', steps: [`{go('assembly'); PT.preset('Orbiter'); PT.launch(); S.throttle = 1; stage(S); PT.fly(() => PT.alt() > 10000, 200, {ascent: true}); const n0 = PT.log.length; let t0 = simT;
  while (S.alive && simT - t0 < 8 && !PT.log.slice(n0).some(l => /Structural|broke/i.test(l))) { INP.pitch = 1; advPhys(S) } INP.pitch = 0; window.simulate0 = window.simulate0 || window.simulate; PT.look(1.6, 0.1, 30); render(); ({t: +(simT - t0).toFixed(1), alt: Math.round(PT.alt()), log: PT.logSince(n0).slice(0, 6)})}`,
  {wait: 600}, {shot: 'break'}, `{window.simulate = window.simulate0; true}`, {wait: 1500}, {shot: 'after'}]};
// 213 and 233: mission control's walls in turn (W), the network page last
ROWS[233] = {title: "mission control's walls (with 213)", steps: [DOCK_HELPERS, `testEpoch(3); PT.preset('Beeper'); PT.launch(); PROG.sats = []; PT.park(newShip(PRESETS.Beeper.slice(0, 2))); satRegister(S, {day0: PROG.day}); go('program'); if (screenNow() === 'debrief') go('program'); true`, {key: 'c'},
  `{const tabs = [...document.querySelectorAll('[data-mcwall]')].map(b => b.textContent); tabs}`, {shot: 'track'}, `{PT.click('[data-mcwall="pads"]'); true}`, {shot: 'pads'}, `{PT.click('[data-mcwall="net"]'); (document.getElementById('mc') || document.body).innerText.slice(0, 600)}`, {shot: 'network'}]};
// batch 6 (test bench, 2026-10-13): the payload fairing (228), side boxes in a fairing (230), the race (212), a spent
// stage recovered (292), overflight consent (294), the session recorder (203)
const FAIRD = (list, mod = '') => `{const d = toV2(${JSON.stringify(list)}), f = k => (function g(n) { return n.k === k ? n : (n.c || []).map(g).find(Boolean) })(d.root); ${mod} stackDef = d; editorChanged(); go('assembly'); render(); true}`;
const FAIR228 = ['cam', 'sci', 'sci', 'core', 'fair', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'];
ROWS[228] = {title: 'the payload fairing', steps: [M1_HELPERS, FAIRD(FAIR228), `{const D = BLD.design(), f = n => n.k === 'fair' ? n : (n.c || []).map(f).find(Boolean); BLD.st.sel = f(D.root); BLD.panel(); render();
  ({panel: (document.querySelector('.bsel') || {}).innerText, staging: [...document.querySelectorAll('.stg, .stage, #staging *')].map(e => e.innerText).filter(t => /fairing/i.test(t)).slice(0, 2)})}`, {shot: 'desk'},
  `{BLD.st.sel = null; PT.click('#bRoll'); render(); (document.getElementById('rollChecks') || {}).innerText}`, {shot: 'pad'}, `{PT.launch(); true}`,
  `(async () => { const n0 = PT.log.length, a = await PT.ascent(); return {a, log: PT.logSince(n0).filter(l => /Fairing|Stage sep/.test(l))} })()`, `{PT.look(1.6, 0.1, 18); render(); true}`, {shot: 'orbit'}]};
ROWS[230] = {title: 'side boxes in a fairing, the octagonal frame', steps: [FAIRD(['core', 'octl', 'cam', 'sci', 'fair', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'],
  `f('sci').c.push({k: 'scam', at: {y: 0.5, a: 0, n: 1}, c: []}); f('octl').c.push({k: 'scam', at: {y: 0.5, a: 3, n: 1}, c: []});`), `{HOOK.edStill = true; cam.dist = 6; cam.edY = 9; cam.pitch = 0.15; render(); true}`, {wait: 600}, {shot: 'payload'}]};
ROWS[212] = {title: 'rivals as programs', steps: [`{go('program'); window.TABS = [...document.querySelectorAll('[data-ptab]')].map(b => b.dataset.ptab); const t = TABS.find(x => /race|world/i.test(x)); if (t) PT.click('[data-ptab="' + t + '"]'); ({tabs: TABS, race: (document.getElementById('progBody') || document.body).innerText.slice(0, 900)})}`, {shot: 'day0'},
  `{const n0 = PT.log.length; let k = 0; while (PROG.day < 250 && k++ < 200) advanceTo(Math.min(250, PROG.day + 25)); go('program'); const t = TABS.find(x => /race|world/i.test(x)); if (t) PT.click('[data-ptab="' + t + '"]');
  ({day: +PROG.day.toFixed(0), race: (document.getElementById('progBody') || document.body).innerText.slice(0, 900), news: PT.logSince(n0).filter(l => /first|attempt|fail|rumou|announc/i.test(l)).slice(0, 10)})}`, {shot: 'day250'}]};
ROWS[292] = {title: 'recovering a spent stage', steps: [M1_HELPERS, FAIRD(['chute', 'pod', 't2', 'petrel', 'dec', 'chute', 't8', 'fins', 'kestrel']), `{PT.click('#bRoll'); PT.launch(); true}`,
  `(async () => { const n0 = PT.log.length, a = await PT.ascent(); let k = 0; const t0 = simT; while (simT - t0 < 600 && k++ < 1e6) advPhys(S); return {a, log: PT.logSince(n0).filter(l => /afloat|stage|recover/i.test(l)).slice(0, 8)} })()`,
  `{const n0 = PT.log.length; go('program'); ({deb: (document.body.innerText.match(/Spent stage[^\\n]*/g) || []).slice(0, 3), news: PT.logSince(n0).filter(l => /recover|refurb/i.test(l))})}`, {shot: 'debrief'}]};
ROWS[294] = {title: 'overflight rights', steps: [`{go('assembly'); render(); const sel = document.getElementById('siteSel'), opts = [...sel.options].map(o => o.value); let hit = null;
  for (const v of opts) { sel.value = v; sel.dispatchEvent(new Event('change')); const b = document.querySelector('[data-overbuy]'); if (b) { hit = {site: v, btn: b.textContent, line: b.parentElement.innerText.slice(0, 300)}; break } } hit}`, {shot: 'picker'},
  `(() => { const f0 = PROG.funds, b = document.querySelector('[data-overbuy]'); if (!b) return 'no consent button'; b.click(); if (typeof renderSites === 'function') renderSites(); return {paid: +(f0 - PROG.funds).toFixed(2), line: (document.body.innerText.match(/consent until day[^\\n]*/) || [''])[0]} })()`, {shot: 'consent'}]};
ROWS[203] = {title: 'the session recorder', steps: [`{TEST.record = true; true}`, {wait: 1500}, `({on: REC.on})`, `{PT.preset('Sounding'); PT.click('#bRoll'); PT.launch(); S.throttle = 1; stage(S); PT.fly(() => S.landed || !S.alive, 3000, {autostage: true}); go('program'); true}`, {wait: 1500},
  `(async () => { const t = JSON.stringify(recFile()), gz = await new Response(new Blob([t]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(); return {events: REC.events.length, json: t.length, gzKB: +(gz.byteLength / 1024).toFixed(1), menu: (recMenu() || '').replace(/<[^>]+>/g, ' ').slice(0, 80)} })()`]};
// batch 7 (test bench, 2026-10-13): the hardware schools (162, 179, 192), the Steppe pad and its rollout (178, 190), the
// suits (193), the crew at the hatch (184) from reference scenes
ROWS[192] = {title: 'the hardware schools on one rocket (refViews, with 162, 179)', steps: views(114, 115, 123, 124, 125, 126)};
ROWS[178] = {title: 'the Steppe pad and its rollout (refViews, with 190)', steps: views(116, 117, 118, 119)};
ROWS[193] = {title: 'the suits by school and generation (refViews)', steps: views(127, 130, 133, 136, 139, 142)};
ROWS[184] = {title: 'the crew at the hatch (refViews)', steps: views(120, 121, 122)};
// ---- run ---------------------------------------------------------------------------------------------------------------
const args = ARGV.filter(a => a !== WARG);
// watching: a pause after each step (and a longer one after a click or a key) so a person can follow; PT is re-armed after a reload
const pace = ms => WATCH ? wait(ms) : null, rearm = () => WATCH ? ev(`if (window.PT && !PT.W) PT.W = {speed: ${WATCH}}; true`) : null;
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
        if (typeof st === 'string') { await rearm(); const r = await ev(st); res.steps.push(r.err ? {err: r.err} : r.val); if (r.err) res.failed.push('step threw: ' + r.err.split('\n')[0]); await pace(700) }
        else if (st.say) { if (WATCH) { console.log('   robot:', st.say); await rearm(); await ev(`window.PT && PT.say(${JSON.stringify(st.say)})`); await wait(st.ms ?? 1800) } }
        else if (st.wait) await wait(st.wait);
        else if (st.key) { for (const k of [].concat(st.key)) { if (WATCH) { await ev(`window.PT && PT.say('Key: ' + ${JSON.stringify(k === ' ' ? 'Space' : k)})`); await wait(600) } await press(k, st.ms); await wait(st.gap ?? 150) } await pace(900) }
        else if (st.hold) { await keyEv('keyDown', st.hold); await wait(st.ms); await keyEv('keyUp', st.hold) }
        else if (st.click) { const r = await ev(`(()=>{const e=typeof ${JSON.stringify(st.click)}==='string'?document.querySelector(${JSON.stringify(st.click)}):null;if(!e)return null;const b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]})()`);
          if (!r.val) res.failed.push('no element to click: ' + st.click); else { if (WATCH) { await ev(`window.PT && PT.dot(${r.val[0]}, ${r.val[1]})`); await wait(700) } await clickAt(...r.val); await wait(150); await pace(1100) } }
        else if (st.shot) { await wait(st.settle ?? 300); if (WATCH) await ev(`(document.getElementById('ptcap') || {}).style && (document.getElementById('ptcap').style.visibility = 'hidden')`);
          res.shots.push(await shot(`r${n}_${st.shot}.png`)); if (WATCH) await ev(`(document.getElementById('ptcap') || {}).style && (document.getElementById('ptcap').style.visibility = '')`) }
      }
      for (const [k, e] of Object.entries(R.checks || {})) { const r = await ev(e); res.checks[k] = r.err ? {err: r.err} : r.val;
        if (r.err) res.failed.push(`check ${k} threw`); else if (R.expect && R.expect[k] && !R.expect[k](r.val)) res.failed.push(`check ${k} = ${JSON.stringify(r.val)}`) }
    } catch (x) { res.failed.push('driver: ' + x.message) }
    res.console = logs.slice(0, 30); if (logs.some(l => l.startsWith('EXC'))) res.failed.push('page exception');
    res.secs = +((Date.now() - t0) / 1000).toFixed(1);
    const all = fs.existsSync(resPath) ? JSON.parse(fs.readFileSync(resPath, 'utf8')) : {}; all[n] = res;   // re-read: runs may overlap
    console.log(`row ${n} ${res.failed.length ? 'FAIL ' + res.failed.join('; ') : 'ok'} (${res.secs} s) shots ${res.shots.join(' ')}`);
    if (WATCH) { await ev(`window.PT && PT.say(${JSON.stringify(`Row ${n} done: ${res.failed.length ? 'FAILED (see the terminal)' : 'all checks passed'}`)})`); await wait(6000) }
    console.log('   checks', JSON.stringify(res.checks).slice(0, 1500)); if (res.console.length) console.log('   console', res.console.slice(0, 5).join(' | ').slice(0, 800));
    fs.writeFileSync(resPath, JSON.stringify(all, null, 1));
  }
}
ws.close(); ch.kill(); process.exit(0);
