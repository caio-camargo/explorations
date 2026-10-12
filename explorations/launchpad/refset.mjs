// The reference set for before/after (BEAUTY.md § 3, QUEUE Q312): every listed refView(n) shot at full resolution, with
// its GPU time measured twice, at the adaptive scale the game would pick and at full resolution, into one folder:
// vNNN-<label>.png and timings.log (one JSON row per view: [label, 'adaptive', gpu ms, scale, 'full', gpu ms]).
// usage: node refset.mjs <outDir> [n n-m ...]   (default: the BEAUTY set below)
// Env: REF_URL (default http://localhost:8790/launchpad/index.html: serve the folder above launchpad/ there),
// REF_Q=low|high (a graphics setting, app/settings.js; default: the page's), SHOT_IGPU=1 for the Intel iGPU (runs Edge with --force_low_power_gpu: Windows pins chrome.exe to the RTX on this
// machine, GpuPreference=2, so Chrome's flags can't reach the iGPU; shot.mjs's SHOT_IGPU lands on the RTX too), REF_BROWSER: another browser, SHOT_FLAGS to override the GPU flags (as shot.mjs). Headless Chrome over CDP on the
// real GPU (--use-angle=d3d11; --force_high_performance_gpu picks the RTX).
import {spawn} from 'node:child_process';
import fs from 'node:fs';
const [out, ...args] = process.argv.slice(2);
if (!out) { console.log('usage: node refset.mjs <outDir> [n n-m ...]'); process.exit(1) }
const range = s => { const [a, b] = s.split('-').map(Number); return b ? Array.from({length: b - a + 1}, (_, i) => a + i) : [a] };
const SET = '1-10 30-36 40-47 50-56 60-77 80-83 90-93 97-104 112-115 123-126 152-158';
const views = (args.length ? args : SET.split(' ')).flatMap(range);
const URL0 = process.env.REF_URL || 'http://localhost:8790/launchpad/index.html', port = 9300 + Math.floor(Math.random() * 500);
const gpu = process.env.SHOT_FLAGS ? process.env.SHOT_FLAGS.split(' ') : ['--use-angle=d3d11', '--enable-gpu', ...(process.env.SHOT_IGPU ? ['--force_low_power_gpu'] : ['--force_high_performance_gpu'])];
const ch = spawn(process.env.REF_BROWSER || (process.env.SHOT_IGPU ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', `--remote-debugging-port=${port}`, ...gpu, '--ignore-gpu-blocklist', '--hide-scrollbars',
  '--window-size=1280,800', `--user-data-dir=${process.env.TEMP}/refset${port}`, 'about:blank'], {stdio: 'ignore'});
const wait = ms => new Promise(r => setTimeout(r, ms)); let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === 'page')) break } catch {} await wait(200) }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(), errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  else if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + m.params.exceptionDetails.exception?.description) };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params})) });
const ev = async x => { const r = await cmd('Runtime.evaluate', {expression: x, awaitPromise: true, returnByValue: true}); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description };
await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Page.navigate', {url: URL0});
const t0 = Date.now(); while (!(await ev(`typeof refView === 'function' || (typeof render === 'function' && !!document.getElementById('gl'))`)) && Date.now() - t0 < 180e3) await wait(500);
// a fresh career past the first-run gate, then views.js; the GPU timer's readout and the scaler are the page's own (render.js)
console.log(await ev(`(async () => { try { localStorage.clear() } catch (e) {} document.querySelector('[data-start="agency"]')?.click();
  const s = document.createElement('script'); s.src = 'views.js?' + Date.now(); document.head.appendChild(s); await new Promise(r => s.onload = r);
  window.adaptRes0 = adaptRes; ${process.env.REF_Q ? `applyQuality(${JSON.stringify(process.env.REF_Q)});` : ''} return 'ready in ' + ((performance.now() / 1000) | 0) + ' s; GPU ' + (gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) || '?').replace(/ANGLE \\(|\\)$/g, '') + '; timer ' + !!TQ + '; quality ' + quality + ' (scale cap ' + RS_MAX + ')' })()`));
fs.mkdirSync(out, {recursive: true}); const log = fs.createWriteStream(`${out}/timings.log`, {flags: 'a'});
const meas = ms => `new Promise(r => { gpuMs = null; setTimeout(() => r([gpuMs == null ? null : +gpuMs.toFixed(2), +RS.toFixed(2)]), ${ms}) })`;
for (const n of views) {
  const label = await ev(`refView(${n}).then(x => typeof x === 'string' ? x : JSON.stringify(x))`);
  // adaptive: the game's own scaler from the setting's cap for ~2.4 s (it steps every 0.6 s), then the GPU time at the scale it settled on
  const a = await ev(`(async () => { adaptRes = adaptRes0; RS = RS_MAX; await new Promise(r => setTimeout(r, 2400)); return ${meas(900)} })()`);
  // full resolution: the scaler held at 1
  const f = await ev(`(async () => { adaptRes = () => {}; RS = 1; await new Promise(r => setTimeout(r, 400)); return ${meas(900)} })()`);
  const s = await cmd('Page.captureScreenshot', {format: 'png'});
  const slug = String(label ?? 'view').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  fs.writeFileSync(`${out}/v${String(n).padStart(3, '0')}-${slug}.png`, Buffer.from(s.result.data, 'base64'));
  const row = [n, label, 'adaptive', a?.[0], a?.[1], 'full', f?.[0]]; log.write(JSON.stringify(row) + '\n'); console.log(JSON.stringify(row));
  await ev(`adaptRes = adaptRes0`);
}
if (errs.length) console.log('console errors:', [...new Set(errs)].slice(0, 10));
log.end(); ws.close(); ch.kill(); process.exit(0);
