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
  // (Q576) a chapter closed (its capstone flown) takes the poster before a first: the chapter's name, the capstone under it
  const ch=D.chapter;
  const[kick,hl,cls]=crewLost?['A loss','Crew lost','poster black']:ch?[`Chapter ${ch.n} complete${first?' · first in the world':''}`,ch.name,'poster chap']:first?['First in the world',first.l,'poster']:o.k==='lost'?['','Vehicle lost','poster']
    :rec?['New record',`${rec.l}: ${rec.v}`,'poster']:['',o.t,''];
  let h=(kick?`<div class="kick">${kick.toUpperCase()}</div>`:'')+`<div class="hl ${cls}${cls&&typeof posterEra==='function'?' '+posterEra():''}">${hl}</div>`   // (Q479) the era's poster palette
    +`<div class="lead">${ch&&!crewLost?`<b>${ch.capstone}</b> · `:''}${cls?`<b>${o.t}</b>: `:''}${o.d}.`
    +(D.crew?` <span class="${D.crew.ok?'ok':'bad'}">${D.crew.line}.</span>`:'')   // (Q191)
    +(D.passenger?` ${D.passenger.ok?`${D.passenger.who} came through.`:`${D.passenger.who} ${D.passenger.why}.`}`:'')+`</div>`;
  // a loss explained (Q293): the failures on the way, in order, then the end, and what would help next time
  const cap=t=>t[0].toUpperCase()+t.slice(1),at=f=>`<span class="was">T+${fmtT(f.met)}${f.h!=null?` · ${fmtKm(f.h)}`:''}</span>`;
  const W=D.loss?sec('What happened',D.loss.chain.map(f=>ln(`${cap(f.why)}`,at(f))).join('')+ln(`<b>${cap(D.loss.end.why)}</b>`,at(D.loss.end),'bad')
    +(D.loss.help?`<div class="help">What would help: ${D.loss.help}</div>`:'')):'';
  // (Q570) what this flight's missions opened, under the ledger: each name goes to its tab, a part shows its card
  const Op=D.opened,lk=(x,a)=>`<a class="lnk" ${a}>${tipEsc(x.t)}</a>`,OP=Op&&opensLine(Op)?sec('Opened',
    (Op.missions.length?ln(`Missions: ${Op.missions.map(x=>lk(x,'data-debtab="missions"')).join(', ')}`):'')
    +(Op.contracts.length?ln(`Contracts: ${Op.contracts.map(x=>lk(x,'data-debtab="inbox" title="offers come to the in-tray"')).join(', ')}`):'')
    +(Op.parts.length+Op.rover.length?ln(`Parts: ${[...Op.parts.map(x=>lk(x,`data-pcard="${x.id}"`)),...Op.rover.map(x=>tipEsc(x.t))].join(', ')}`):'')):'';
  const L=W+sec('Money',D.money.map(m=>ln(m.l,money(m.v))).join('')+(D.net!=null?ln('Net for the program',money(D.net),'tot'):''))+OP
    +sec('Logbook',D.records.map(r=>ln(`${r.l} <span class="was">(${r.was?`was ${r.was}`:'first measured'})</span>`,r.v)).join(''));
  const R=sec('Missions',D.missions.map(m=>ln(`✓ ${m.l}`,m.first?'<span class="neg">first</span>':'')).join(''))
    +sec('Certified by telemetry',D.certs.map(c=>ln(c.l,`${pct(c.a)} → ${pct(c.b)}`)).join(''))
    +sec(term('kh','Know-how'),D.kh.slice(0,8).map(k=>ln(k.l,`${pct(k.a)} → ${pct(k.b)}`)).join('')+(D.kh.length>8?ln(`and ${D.kh.length-8} more parts`):''))
    +sec('Incidents',D.incidents.map(t=>ln(t,'','bad')).join(''))
    +(D.streak>1?`<div class="ln" style="margin-top:12px"><span>${D.streak} flights in a row with no stage on a town.</span></div>`:'');
  el.innerHTML=h+`<div class="cols"><div>${L}</div><div>${R}</div></div>`;
  $('debSig').innerHTML=`Filed by flight control, ${fmtDate(D.day)}<span class="sig">Flight Control</span>`;
  // the wall: this flight's photo, and the papers from the days it flew
  const ph=deskPhoto(),nw=deskNews(NEWS.filter(x=>x.day>=(D.day0??D.day)));
  $('debWall').innerHTML=deskPhotoCard(ph&&ph.flight===D.flight?ph:null,D.fromOrbit?'no liftoff':'no photo',D.fromOrbit?'this flight began in orbit':`flight ${D.flight}`)
    +(nw?deskClipping(nw,'clipn'):'');
  const again=!D.fromOrbit;$('bDebAgain').disabled=!again;$('bDebAgain').title=again?'':'This flight started in orbit: there is no pad to fly it from again';
  for(const[id,to]of[['bDebProg','program'],['bDebAsm','assembly']])$(id).classList.toggle('big',debNext===to);$('bDebAgain').classList.toggle('big',false);
  if(ch&&typeof trophyKeep==='function')trophyKeep(D);   // (Q576) the capstone's photo goes to the trophy case
  if(typeof unlockDebrief==='function')unlockDebrief(D)}   // (Q572) what it opened, as cards over the report
// Fly again: back to the pad with the same design, through the usual LAUNCH (its checks: funds, site, safety)
function debAgain(){const D=debShown;if(!D||D.fromOrbit)return;go('assembly');if(screenNow()==='assembly')$('launch').click()}
$('bDebAgain').onclick=()=>debAgain();
// the HUD offers the way out once the flight is over: landed or lost
// (Q263; PLAYTEST #63) landed or splashed at home and still, it reads Recover vessel, as in KSP: the Debrief counts the recovery
const debRecover=()=>!!(S&&S.alive&&S.landed&&S.body===TELLUS);
function debEndBtn(){const b=$('bEnd');if(!b)return;const R=S&&S.rec,over=mode==='flight'&&R&&R.launched&&!R.ended&&(!S.alive||S.landed&&simT>5||(mcLeft()||{}).k==='done');b.classList.toggle('hidden',!over);   // (Q548) or its work done
  const rec=over&&debRecover(),t=rec?'Recover vessel ▸ [Enter]':'End flight ▸ [Enter]';if(b.textContent!==t){b.textContent=t;b.classList.toggle('rec',rec);
    b.title=rec?`recover it and end the flight: the debrief${S.water?' (from the sea)':''}`:'the flight is over: see how it went'}}
$('bEnd').onclick=()=>go('debrief');
// (Q570) the Opened block's links: a mission or contract kind opens its tab on the Program; a part, its card
$('debBody').addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-debtab]');if(!t)return;progTab=t.dataset.debtab;go('program')});
$('debBody').addEventListener('mouseover',e=>{const t=e.target.closest&&e.target.closest('[data-pcard]');if(t&&typeof tipShow==='function'&&PARTS[t.dataset.pcard])tipShow('card',BLD.partCardHTML(t.dataset.pcard),{r:t.getBoundingClientRect(),side:true})});
$('debBody').addEventListener('mouseout',e=>{if(e.target.closest&&e.target.closest('[data-pcard]')&&typeof tipShow==='function')tipHide('card')});
