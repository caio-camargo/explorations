// app/debrief.js — the Debrief screen (flow session, UI slice 3; NOTES § "UI: screens and navigation"). Part of index.html's script:
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// Renders the record sim/debrief.js builds when a flight is settled (debShown, set by go()), as a typed flight report on the
// director's desk (Q241 R2; NOTES § v1.116): a room, like the Program. The headline is a poster only for a first in the world,
// a loss or a beaten record; otherwise it's the outcome, typed. Two columns: money (a ledger, the net double-underlined) and
// the logbook on the left; missions, certifications, know-how and incidents on the right; an empty section is left out.
// Beside it, the flight's own photo (taken at liftoff, desk.js) and the papers' cutting from the days it flew. Exits: Fly
// again, Assembly (same design), To the office (the Program).
function renderDebrief(){const D=debShown,el=$('debBody');
  if(!D){$('debHead').innerHTML='<span>FLIGHT REPORT</span>';el.innerHTML='<div class="none">No flight to debrief yet.</div>';$('debWall').innerHTML='';$('debSig').innerHTML='';return}
  const o=D.outcome,sec=(t,h)=>h?`<div class="dh">${t}</div>${h}`:'',ln=(a,b='',c='')=>`<div class="ln${c?' '+c:''}"><span>${a}</span><span>${b}</span></div>`,
    money=v=>`<span class="${v<0?'neg':''}">${v<0?'−':'+'}${fmtM(Math.abs(v))}</span>`,pct=v=>`${(v*100).toFixed(0)} %`;
  $('debHead').innerHTML=`<span>FLIGHT REPORT · No. ${D.flight}</span><span>${D.design?`design: ${D.design} · `:''}${fmtDate(D.day)} · ${fmtT(D.met)} flown</span>`;
  // the headline: a loss of life first, then a first in the world, a lost vehicle, a beaten record
  const first=D.missions.find(m=>m.first),rec=D.records.find(r=>r.was),crewLost=D.crew&&!D.crew.ok;
  const[kick,hl,cls]=crewLost?['A loss','Crew lost','poster black']:first?['First in the world',first.l,'poster']:o.k==='lost'?['','Vehicle lost','poster']
    :rec?['New record',`${rec.l}: ${rec.v}`,'poster']:['',o.t,''];
  let h=(kick?`<div class="kick">${kick.toUpperCase()}</div>`:'')+`<div class="hl ${cls}">${hl}</div>`
    +`<div class="lead">${cls?`<b>${o.t}</b>: `:''}${o.d}.`
    +(D.crew?` <span class="${D.crew.ok?'ok':'bad'}">${D.crew.line}.</span>`:'')   // (Q191)
    +(D.passenger?` ${D.passenger.ok?`${D.passenger.who} came through.`:`${D.passenger.who} ${D.passenger.why}.`}`:'')+`</div>`;
  const L=sec('Money',D.money.map(m=>ln(m.l,money(m.v))).join('')+(D.net!=null?ln('Net for the program',money(D.net),'tot'):''))
    +sec('Logbook',D.records.map(r=>ln(`${r.l} <span class="was">(${r.was?`was ${r.was}`:'first measured'})</span>`,r.v)).join(''));
  const R=sec('Missions',D.missions.map(m=>ln(`✓ ${m.l}`,m.first?'<span class="neg">first</span>':'')).join(''))
    +sec('Certified by telemetry',D.certs.map(c=>ln(c.l,`${pct(c.a)} → ${pct(c.b)}`)).join(''))
    +sec('Know-how',D.kh.slice(0,8).map(k=>ln(k.l,`${pct(k.a)} → ${pct(k.b)}`)).join('')+(D.kh.length>8?ln(`and ${D.kh.length-8} more parts`):''))
    +sec('Incidents',D.incidents.map(t=>ln(t,'','bad')).join(''))
    +(D.streak>1?`<div class="ln" style="margin-top:12px"><span>${D.streak} flights in a row with no stage on a town.</span></div>`:'');
  el.innerHTML=h+`<div class="cols"><div>${L}</div><div>${R}</div></div>`;
  $('debSig').innerHTML=`Filed by flight control, ${fmtDate(D.day)}<span class="sig">Flight Control</span>`;
  // the wall: this flight's photo, and the papers from the days it flew
  const ph=deskPhoto(),nw=deskNews(NEWS.filter(x=>x.day>=(D.day0??D.day)));
  $('debWall').innerHTML=deskPhotoCard(ph&&ph.flight===D.flight?ph:null,D.fromOrbit?'no liftoff':'no photo',D.fromOrbit?'this flight began in orbit':`flight ${D.flight}`)
    +(nw?deskClipping(nw,'clipn'):'');
  const again=!D.fromOrbit;$('bDebAgain').disabled=!again;$('bDebAgain').title=again?'':'This flight started in orbit: there is no pad to fly it from again';
  for(const[id,to]of[['bDebProg','program'],['bDebAsm','assembly']])$(id).classList.toggle('big',debNext===to);$('bDebAgain').classList.toggle('big',false)}
// Fly again: back to the pad with the same design, through the usual LAUNCH (its checks: funds, site, safety)
function debAgain(){const D=debShown;if(!D||D.fromOrbit)return;go('assembly');if(screenNow()==='assembly')$('launch').click()}
$('bDebAgain').onclick=()=>debAgain();
// the HUD offers the way out once the flight is over: landed or lost
// (Q263; PLAYTEST #63) landed or splashed at home and still, it reads Recover vessel, as in KSP: the Debrief counts the recovery
const debRecover=()=>!!(S&&S.alive&&S.landed&&S.body===TELLUS);
function debEndBtn(){const b=$('bEnd');if(!b)return;const R=S&&S.rec,over=mode==='flight'&&R&&R.launched&&!R.ended&&(!S.alive||S.landed&&simT>5);b.classList.toggle('hidden',!over);
  const rec=over&&debRecover(),t=rec?'Recover vessel ▸ [Enter]':'End flight ▸ [Enter]';if(b.textContent!==t){b.textContent=t;b.classList.toggle('rec',rec);
    b.title=rec?`recover it and end the flight: the debrief${S.water?' (from the sea)':''}`:'the flight is over: see how it went'}}
$('bEnd').onclick=()=>go('debrief');
