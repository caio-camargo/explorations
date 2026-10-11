// app/record.js — the session recorder, the page's half (QUEUE Q275 = Q225 R1; NOTES § "Plan: record and replay"). Part of
// index.html's script (NOTES § "The file split"), loaded last. The SIM half (sim/record.js) keeps the save's diffs and each
// flight's tape with its hashes; this file starts and stops it from the tester flag "Record this session", gives it the
// clock, and adds what only the page knows: the screen, the design on the Assembly, the camera, the flight's pacing and
// path, and keys and clicks (for captions in the viewer, and for a robot row later, R4). The download is gzipped JSON.
'use strict';
{
  // the page's other stored settings, part of the start (not the program slots: that's start.prog; not the baked atlas, a cache)
  const store = () => { const o = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i);
    if (k.startsWith('launchpad-') && !/^launchpad-(program-|atlas)/.test(k)) { const v = localStorage.getItem(k); if (v.length < 65536) o[k] = v; } } } catch (e) {} return o; };
  REC.clock = () => performance.now();
  const save0 = HOOK.save; HOOK.save = (...a) => { const r = save0(...a); recProg(); return r; };
  let seen = {}, slow = 0;
  const camNow = () => [cam.yaw, cam.pitch, cam.dist, cam.mYaw, cam.mPitch, cam.mDist, cam.focus].map(x => typeof x === 'number' ? +x.toFixed(4) : x);
  const once = (k, v, d) => { const j = JSON.stringify(v); if (seen[k] === j) return; seen[k] = j; recEv(k, d); };
  setInterval(() => {   // 10 Hz: start/stop with the flag, then the samplers
    const want = TEST.on && TEST.record;
    if (want && !REC.on) { recStart(store(), { built: location.href.split('?')[0], ua: navigator.userAgent, saveV: SAVE_V }); seen = {}; HOOK.msg('Recording this session'); renderTester(); }
    else if (!want && REC.on) { recStop(); HOOK.msg(`Recording stopped: ${REC.events.length} events`); renderTester(); }
    if (!REC.on) return;
    const sc = screenNow(); once('screen', sc, { s: sc });
    once('cam', [camNow(), view], { c: camNow(), view });
    if (REC.flight && S && S.alive != null) once('pace', tapeDuration(recTapeNow()), { d: +tapeDuration(recTapeNow()).toFixed(3) });
    if (++slow % 10) return;   // 1 Hz: the path (for a flight a newer sim can't re-fly) and the design on the table
    if (REC.flight && S) recEv('path', { r: S.r.map(x => Math.round(x)), v: S.v.map(x => +x.toFixed(2)), body: S.body.name, alive: !!S.alive });
    if (sc === 'assembly') once('design', stackDef, { stack: JSON.parse(JSON.stringify(stackDef)) });
  }, 100);
  // keys and clicks, as the robot writes them ({key}, {click}); display only: the viewer never replays them as input
  window.addEventListener('keydown', e => { if (REC.on && !e.repeat) recEv('ui', { key: e.key }); }, true);
  document.addEventListener('click', e => {
    if (!REC.on) return; const el = e.target.closest && e.target.closest('button,[data-ov],a,label,summary,canvas,[id]'); if (!el) return;
    const data = Object.fromEntries(Object.entries(el.dataset || {}).slice(0, 4));
    recEv('ui', { click: el.id ? '#' + el.id : el.tagName.toLowerCase(), data, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48) });
  }, true);
  // the tester menu's block (screens.js renderTester asks for it)
  self.recMenu = () => !TEST.record ? '' : `<h3>Recording · ${REC.on ? REC.events.length + ' events' : 'off'}</h3><div><button data-rec="dl"${REC.on ? '' : ' disabled'}>Download recording</button></div>`
    + '<div class="sub">Gzipped JSON: the save as it changed, every flight\'s tape, the camera. The replay viewer is QUEUE Q225 R2.</div>';
  document.addEventListener('click', async e => {
    if (!(e.target.dataset && e.target.dataset.rec === 'dl') || !REC.on) return;
    const text = JSON.stringify(recFile()), name = `launchpad-session-day${Math.floor(PROG.day || 0)}.json.gz`;
    const blob = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    HOOK.msg(`Saved ${name}: ${(text.length / 1024).toFixed(0)} KB, ${(blob.size / 1024).toFixed(0)} KB gzipped`);
  });
}
