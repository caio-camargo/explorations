// app/notice.js — the completion notice (flow, QUEUE Q569; Caio 2026-11-11, the gameplay loop). Part of index.html's
// script: a classic script sharing one global scope with the others; index.html loads them in order.
'use strict';
// A mission or contract done used to be HOOK.msg's one 18 px line for 3 s, in the slot the staging and gravity-turn hints
// overwrite. Now the sim calls HOOK.done (missionComplete, contractEval, selDone) and the notice queues here, in its own
// element (#done): the name, the win line, the pay, what it opened (Q570, opensOf) and what is left of the flight (Q548's
// jobsLeft: end the flight / bring it home / still to do). It stays until dismissed (Enter or a click) or, for one won in
// flight, until that flight ends; two at once queue ("1 more"). The sim never pauses for it. Hints keep #msg.
// (Q600, D42: "a mission done is quiet in flight and loud after it") In flight there is no centred box any more: the
// Mission card (app/hud.js), on screen the whole flight now, turns the job green the moment it is done, and doneFlight
// says one line in #msg with a chime (sndDone). The box is for world missions and contracts judged at home (utilTick,
// selDone), at the desk, until Q572's overlays take those too; the fanfare after a flight is Q572's. (Before: the box
// came in flight too, held while the engines burned, Q558, so it arrived when the thrust was cut: PLAYTEST #162.)
// ---- the completion notice
const DONE_Q=[];let doneOn=null,doneH='',doneT=0;
HOOK.done=n=>{if(n.flight&&mode==='flight'){doneFlight(n);return}DONE_Q.push(n);doneShow()};
// in flight: one line, a chime; the Mission card's row is already green (the pay is in rec.paid, which cardJobs reads)
function doneFlight(n){const kick=n.first?'First in the world':n.k==='mission'?'Mission complete':'Contract done';
  HOOK.msg(`✓ ${kick}: ${n.name} · +${fmtM(n.pay)}`);msgTimer=6;if(typeof sndDone==='function')sndDone()}
function doneHTML(n,more){const up=t=>t?t[0].toUpperCase()+t.slice(1):'',O=n.k==='mission'?opensLine(opensNames([n.id])):'',L=n.flight&&mode==='flight'?mcLeft():null;
  const kick=n.first?'First in the world':n.k==='mission'?'Mission complete':'Contract done';
  return`<div class="dk">${kick.toUpperCase()}</div><div class="dn">${tipEsc(n.name)}</div>`
    +(n.win?`<div class="dw">${tipEsc(up(n.win))}${n.second?` <span class="dim">(second, after ${tipEsc(n.second)})</span>`:''}</div>`:'')
    +`<div class="dp">+${fmtM(n.pay)}</div>`+(O?`<div class="do">Opens ${O}</div>`:'')
    +(L?`<div class="dl ${L.k==='done'?'ok':'acc'}">${tipEsc(up(L.t))}</div>`:'')
    +`<div class="dx">${more?`${more} more after this · `:''}Enter or click: OK</div>`}
// what is on screen now: the first in the queue, unless its flight is over (dropped)
function doneShow(){const el=typeof document!=='undefined'&&$('done');if(!el)return;
  while(DONE_Q.length&&DONE_Q[0].flight&&mode!=='flight')DONE_Q.shift();   // its flight ended: the debrief says it now
  const n=DONE_Q[0]||null;
  if(!n){el.classList.add('hidden');doneOn=null;return}
  const h=doneHTML(n,DONE_Q.length-1);if(n!==doneOn||doneH!==h){el.innerHTML=doneH=h;el.classList.remove('hidden');doneOn=n}}
function doneDismiss(){if(!doneOn)return false;DONE_Q.splice(DONE_Q.indexOf(doneOn),1);doneOn=null;doneShow();return true}
function doneTick(dt){doneT-=dt;if(doneT>0)return;doneT=0.25;doneShow()}   // four times a second (its "left" line moves)
// ---- end of the completion notice
if(typeof document!=='undefined'&&$('done')){$('done').onclick=()=>doneDismiss();
  // Enter takes the notice first (before End flight's Enter): one press, one notice
  addEventListener('keydown',e=>{if(e.key!=='Enter'||e.repeat||!doneOn||e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(doneDismiss()){e.preventDefault();e.stopImmediatePropagation()}},true)}
