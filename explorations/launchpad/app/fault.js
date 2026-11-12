'use strict';
// app/fault.js — when the game throws (QUEUE R9, review 2026-11-09 § 2). Before: an exception in frame() skipped its
// requestAnimationFrame, so one bad frame froze the game for good, and the page had no error handler at all. Now frame()
// (app/loop.js) catches and always schedules the next frame, and any uncaught error or rejected promise lands here:
// gameFault shows a small panel with what broke and where, and *Reload*, *Export save* (the program as a .json file),
// *Export the old save* when R10 kept an unloadable one (PROG_BAD), and *Keep playing*. Loaded first of the app scripts,
// so it also catches an app script that throws while loading. The panel comes back only for an error it hasn't shown.
const FAULT={n:0,first:null,seen:new Set(),el:null,off:false};
function faultWhere(e){const l=String(e&&e.stack||'').split('\n').find(x=>/\.js:\d+/.test(x)),m=l&&/((?:sim|app)\/[\w-]+\.js|[\w-]+\.js):(\d+)/.exec(l);return m?`${m[1]}:${m[2]}`:''}
function gameFault(e,src){FAULT.n++;const msg=String(e&&e.message||e||'unknown error'),where=faultWhere(e),key=`${msg}@${where}`;
  if(!FAULT.seen.has(key)){FAULT.seen.add(key);console.error(`launchpad (${src}):`,e);if(!FAULT.first)FAULT.first={msg,where,src};FAULT.off=false;FAULT.last={msg,where,src}}
  try{if(typeof logEv==='function')logEv('error',`${src}: ${msg}${where?` (${where})`:''}`)}catch(_){}
  try{faultShow()}catch(_){}}
function faultShow(){if(FAULT.off||typeof document==='undefined'||!document.body)return;
  let el=FAULT.el;if(!el){el=FAULT.el=document.createElement('div');el.id='fault';
    el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99;max-width:min(560px,92vw);padding:10px 14px;'
      +'background:#2a1416;color:#ffd9d4;border:1px solid #c0504a;border-radius:6px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 4px 18px #0008';
    el.onclick=ev=>{const a=ev.target&&ev.target.dataset&&ev.target.dataset.fault;if(!a)return;
      if(a==='reload')location.reload();else if(a==='save')exportSave();else if(a==='bad')exportBadSave();else if(a==='keep'){FAULT.off=true;el.style.display='none'}};
    document.body.appendChild(el)}
  const L=FAULT.last||FAULT.first,bad=hasBadSave();
  el.innerHTML=`<b>Something went wrong.</b> The game is still running but may misbehave; export your save before you reload.`
    +`<div style="opacity:.8;margin:4px 0 8px;font-family:monospace;font-size:12px;word-break:break-word">${faultEsc(L.msg)}${L.where?` · ${faultEsc(L.where)}`:''}${FAULT.n>1?` · ${FAULT.n}×`:''}</div>`
    +`<button data-fault="reload">Reload</button> <button data-fault="save">Export save</button>${bad?' <button data-fault="bad">Export the old save</button>':''} <button data-fault="keep">Keep playing</button>`;
  el.style.display=''}
const faultEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// a file the player can keep, attach to a bug report, or put back (a .json save is progJSON's text)
function saveFile(text,name){const u=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function exportSave(){saveFile(progJSON(),`launchpad-save-day${Math.floor(PROG.day||0)}.json`)}
function hasBadSave(){try{return typeof PROG_BAD==='string'&&!!localStorage.getItem(PROG_BAD)}catch(e){return false}}
function exportBadSave(){try{const t=localStorage.getItem(PROG_BAD);if(t)saveFile(t,'launchpad-save-unloadable.json')}catch(e){}}
addEventListener('error',e=>gameFault(e.error||e.message,'error'));
addEventListener('unhandledrejection',e=>gameFault(e.reason,'promise'));
