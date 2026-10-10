// app/debrief.js — the Debrief screen (flow session, UI slice 3; NOTES § "UI: screens and navigation"). Part of index.html's script:
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// Renders the record sim/debrief.js builds when a flight is settled (debShown, set by go()). Sections, in order: outcome,
// money, missions, certifications, logbook records, incidents, know-how; an empty section is left out. Exits: Program,
// Assembly (same design), Fly again. The section headings use class "dh", not "ep": "ep" headings belong to Program tabs.
function renderDebrief(){const D=debShown,el=$('debBody');if(!D){el.innerHTML='<div class="none">No flight to debrief yet.</div>';return}
  const o=D.outcome,sec=(t,h)=>h?`<div class="dsec"><div class="dh">${t}</div>${h}</div>`:'',
    money=v=>`<span class="${v<0?'bad':'ok'}">${v<0?'−':'+'}${fmtM(Math.abs(v))}</span>`,pct=v=>`${(v*100).toFixed(0)}%`,
    rows=L=>`<table>${L.join('')}</table>`;
  $('debHead').innerHTML=`<div class="dt">Flight ${D.flight}${D.design?` · ${D.design}`:''}</div><div class="sub">${fmtDate(D.day)} · ${fmtT(D.met)} flown</div>`;
  let h=`<div class="dout k-${o.k}"><b>${o.t}</b><div class="sub">${o.d}</div>`
    +(D.crew?`<div class="sub ${D.crew.ok?'ok':'bad'}">${D.crew.line}</div>`:'')   // (Q191)
    +(D.passenger?`<div class="sub">${D.passenger.ok?`${D.passenger.who} came through`:`${D.passenger.who} ${D.passenger.why}`}</div>`:'')+`</div>`;
  h+=sec('Money',D.money.length?rows(D.money.map(m=>`<tr><td>${m.l}</td><td>${money(m.v)}</td></tr>`))
    +(D.net!=null?`<table class="dnet"><tr><td>Net for the program</td><td>${money(D.net)}</td></tr></table>`:''):'');
  h+=sec('Missions',D.missions.map(m=>`<div class="ms done"><b>${m.l}</b>${m.first?' · <span class="acc">first in the world</span>':''}</div>`).join(''));
  h+=sec('Certified by telemetry',D.certs.length?rows(D.certs.map(c=>`<tr><td>${c.l}</td><td>${pct(c.a)} → <span class="ok">${pct(c.b)}</span></td></tr>`)):'');
  h+=sec('Logbook',D.records.map(r=>`<div class="ms"><b>${r.l}</b>: ${r.v}${r.was?` <span class="sub">(was ${r.was})</span>`:' <span class="sub">(first measured)</span>'}</div>`).join(''));
  h+=sec('Incidents',D.incidents.map(t=>`<div class="ms" style="border-left-color:var(--bad)">${t}</div>`).join(''));
  h+=sec('Know-how',D.kh.length?rows(D.kh.slice(0,8).map(k=>`<tr><td>${k.l}</td><td>${pct(k.a)} → <span class="ok">${pct(k.b)}</span></td></tr>`))
    +(D.kh.length>8?`<div class="sub">and ${D.kh.length-8} more parts</div>`:''):'');
  if(D.streak>1)h+=`<div class="sub" style="margin-top:8px">${D.streak} flights in a row with no stage on a town.</div>`;
  el.innerHTML=h;
  const again=!D.fromOrbit;$('bDebAgain').disabled=!again;$('bDebAgain').title=again?'':'This flight started in orbit: there is no pad to fly it from again';
  for(const[id,to]of[['bDebProg','program'],['bDebAsm','assembly']])$(id).classList.toggle('big',debNext===to);$('bDebAgain').classList.toggle('big',false)}
// Fly again: back to the pad with the same design, through the usual LAUNCH (its checks: funds, site, safety)
function debAgain(){const D=debShown;if(!D||D.fromOrbit)return;go('assembly');if(screenNow()==='assembly')$('launch').click()}
$('bDebAgain').onclick=()=>debAgain();
// the HUD offers the way out once the flight is over: landed or lost
function debEndBtn(){const b=$('bEnd');if(!b)return;const R=S&&S.rec,over=mode==='flight'&&R&&R.launched&&!R.ended&&(!S.alive||S.landed&&simT>5);b.classList.toggle('hidden',!over)}
$('bEnd').onclick=()=>go('debrief');
