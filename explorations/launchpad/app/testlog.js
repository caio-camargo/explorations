// app/testlog.js — the tester's verbose log (QUEUE Q265, PLAYTEST #65). Part of index.html's script (launchpad NOTES § "The file
// split"): a classic script sharing one global scope with the others; loaded last, after the hooks it taps are set.
// The SIM's logEv (sim/program.js) keeps the lines; this file shows them (a scrolling panel), mirrors them to the console
// and downloads them as text with the seeds. Besides the SIM's own calls it taps HOOK.msg / news / save (every player
// message: staging, ignition, flame-out, burn-up, destruction with its cause) and watches funds, contracts and missions,
// so money that moves anywhere shows up without a call at each site. Only with ?tester and "Verbose log" on.
'use strict';
const testLogLine=e=>`[day ${e.day.toFixed(2)} · t ${e.t.toFixed(1)} s] ${e.kind.padEnd(9)} ${e.text}`;
{
  for (const k of ['msg', 'news', 'save']) {
    const f = HOOK[k];
    HOOK[k] = (...a) => {
      if (TEST.log) logEv(k === 'msg' && /^(Destroyed|Vessel lost)/.test(a[0]) ? 'destroyed' : k, k === 'save' ? 'program saved' : String(a[0]));
      return f(...a);
    };
  }
  const el = document.createElement('div'); el.id = 'testlog'; el.className = 'hidden';
  el.innerHTML = '<div class="tlh"><b>Log</b> <span id="testlogN"></span> <button data-tl="dl">Download</button> <button data-tl="clear">Clear</button> <button data-tl="off" title="turn the verbose log off">✕</button></div><pre id="testlogP"></pre>';
  document.body.appendChild(el);
  const st = document.createElement('style');
  st.textContent = '#testlog{position:fixed;left:8px;bottom:8px;width:min(560px,46vw);z-index:6;background:rgba(8,12,18,.88);border:1px solid var(--warn);border-radius:4px;font:11px/1.35 ui-monospace,Consolas,monospace;color:#cfe}'
    + '#testlog.hidden{display:none}#testlog .tlh{padding:3px 6px;border-bottom:1px solid #345;color:var(--warn)}#testlog .tlh span{color:#9ab}'
    + '#testlog button{font:inherit;padding:0 6px;margin-left:4px}#testlogP{margin:0;padding:4px 6px;max-height:22vh;overflow:auto;white-space:pre-wrap}';
  document.head.appendChild(st);
  const pre = el.querySelector('#testlogP'), n = el.querySelector('#testlogN');
  const draw = () => { n.textContent = `· ${LOG.length} lines`; };
  HOOK.log = e => {
    console.log('[launchpad] ' + testLogLine(e));
    const stick = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 4;
    pre.append(testLogLine(e) + '\n');
    while (pre.childNodes.length > 400) pre.firstChild.remove();   // the panel shows the last 400; LOG and the download keep 5000
    if (stick) pre.scrollTop = pre.scrollHeight;
    draw();
  };
  el.addEventListener('click', ev => {
    const a = ev.target.dataset && ev.target.dataset.tl; if (!a) return;
    if (a === 'clear') { LOG.length = 0; pre.textContent = ''; draw(); }
    else if (a === 'off') { TEST.log = false; testSaveFlags(); renderTester(); }
    else if (a === 'dl') {
      const head = [`Launchpad tester log, saved ${new Date().toISOString()}`, `page ${location.href}`,
        `world seed ${PROG.wseed} · terrain seed ${WSEED} · world day ${(PROG.day || 0).toFixed(2)} · flights ${PROG.flights || 0}`,
        `${navigator.userAgent}`, ''];
      const url = URL.createObjectURL(new Blob([head.concat(LOG.map(testLogLine)).join('\n') + '\n'], { type: 'text/plain' }));
      const lnk = document.createElement('a'); lnk.href = url; lnk.download = `launchpad-log-day${Math.floor(PROG.day || 0)}.txt`;
      document.body.appendChild(lnk); lnk.click(); lnk.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  // the watcher: money, contracts and missions change in many places; compare twice a second instead of calling at each one
  let was = null;
  const snap = () => ({ funds: PROG.funds, active: new Map((PROG.active || []).map(c => [c.id, c])), done: new Set(Object.keys(PROG.done || {})) });
  setInterval(() => {
    const on = TEST.on && TEST.log; el.classList.toggle('hidden', !on);
    if (!on) { was = null; return; }
    const now = snap();
    if (was) {
      const d = now.funds - was.funds;
      if (Math.abs(d) >= 0.05) logEv('money', `funds ${fmtM(was.funds)} → ${fmtM(now.funds)} (${d > 0 ? '+' : ''}${fmtM(d)})`);
      for (const [id, c] of now.active) if (!was.active.has(id)) logEv('contract', `accepted ${c.type} #${id}`);
      for (const [id, c] of was.active) if (!now.active.has(id)) logEv('contract', `closed ${c.type} #${id}`);
      for (const id of now.done) if (!was.done.has(id)) { const M = MISSIONS.find(m => m.id === id); logEv('mission', `done: ${M ? M.name : id}`); }
    }
    was = now;
  }, 500);
}
