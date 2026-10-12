// app/network.js — the network's data, slice N1 (flow session, QUEUE Q155; NOTES § UI "Network screen plan"); its screen is
// mission control since Q241 R4 (app/mission.js). Part of
// index.html's script: a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// N1: the fleet strip (everything of ours out there, and what it does next) and the pad calendar (each pad's bookings over
// the next months, with the program's dated events). The screen draws from economy's netModel() (QUEUE Q154) once it
// exists; until then netFallback() reads the same things from what the game has today: the registry, the dispatch queue,
// the pads, the timeline. Nothing here changes the program.
const NET_DAYS=180;   // the calendar's span, from today
const netOpen=()=>(PROG.sats||[]).some(q=>!q.junk)||(PROG.dispatch||[]).length>0;   // a second node besides the pad (W18's default)
function netFallback(){const D=PROG.day||0,fleet=[],pads=[];
  for(const q of PROG.sats||[]){if(q.junk||q.docked)continue;const body=q.bodyName||'Tellus',life=q.landed?Infinity:skLife(q);
    fleet.push({name:q.name,kind:satKind(q),where:q.landed?`on ${body}`:`${body} orbit`,
      next:q.landed?'on the surface':q.adrift!=null?'adrift: out of propellant':isFinite(life)?`holds its orbit ${Math.floor(life)} more days`:'holds its orbit',t:isFinite(life)?life:null})}
  for(const x of PROG.dispatch||[])if(x.status==='queued')fleet.push({name:x.title,kind:'Dispatch',where:`pad ${x.pad+1}`,next:`launches in ${Math.ceil(x.launch-D)} days`,t:x.launch-D});
  for(let p=0;p<padsN();p++)pads.push({pad:p,bars:(PROG.dispatch||[]).filter(x=>x.status==='queued'&&x.pad===p)
    .map(x=>({from:Math.max(D,x.ordered??D),to:x.launch,kind:'dispatch',title:`${x.title} · ${designName(x.stack)||'our design'}`}))});
  return{fleet,pads}}
const netData=()=>typeof netModel==='function'?netModel():netFallback();
// the pads' calendar: each pad's bookings over the next NET_DAYS, and the program's dated events. Mission control's wall
// shows it as its second page (Q241 R4); the screen it was drawn on folded into mission control (app/mission.js).
function netCalHTML(N){const D=PROG.day||0,x=d=>`${(100*Math.max(0,Math.min(NET_DAYS,d-D))/NET_DAYS).toFixed(2)}%`;
  const ticks=[];for(let d=30;d<NET_DAYS;d+=30)ticks.push(`<i class="tk" style="left:${x(D+d)}"><b>${d} d</b></i>`);
  const ev=(typeof upcoming==='function'?upcoming():[]).filter(e=>e.day<=D+NET_DAYS);
  return`<div class="cal">`+
    (N.pads||[]).map(p=>`<div class="crow"><span class="cl">Pad ${p.pad+1}</span><div class="ctr">${ticks.join('')}${p.bars.map(b=>`<div class="cbar ${b.kind}" style="left:${x(b.from)};width:calc(${x(b.to)} - ${x(b.from)})" title="${b.title}">${b.title}</div>`).join('')}${p.bars.length?'':'<span class="cfree">free</span>'}</div></div>`).join('')+
    `<div class="crow"><span class="cl">Events</span><div class="ctr">${ticks.join('')}${ev.map(e=>`<i class="cev" style="left:${x(e.day)}" title="${e.text} · in ${Math.ceil(e.day-D)} d"></i>`).join('')}</div></div></div>`+
    (ev.length?`<div class="sub" style="margin-top:4px">${ev.slice(0,4).map(e=>`in ${Math.ceil(e.day-D)} d: ${e.text}`).join(' · ')}</div>`:'')}
// links home and coverage (space session, QUEUE Q173): each orbiting entry's share of the next day with a path home, its
// longest gap, the relays it goes through, and a burn mission control can't reach flagged; then each body's coverage.
// (Mission control's NETWORK console draws the same rows its own way; this stays for anyone who wants them as a table.)
function netLinksHTML(N){const L=N.links||[],C=N.cover||[],pc=x=>`${Math.round(100*x)} %`;if(!L.length&&!C.length)return'';
  let h=`<div class="dh">Links home <span class="dim">· next day</span></div>`;
  if(L.length)h+=`<table class="netf">${L.map(l=>`<tr><td>${l.name}</td><td class="dim">${l.body}</td><td>${l.now?'in contact':'<span class="dim">out of contact</span>'} · ${pc(l.share)} of the day${l.share<1?`, gaps up to ${l.gapH.toFixed(1)} h`:''}</td><td class="${l.flag?'warn':'dim'}">${l.flag||(l.via.length?`through ${l.via.join(', ')}`:'')}</td></tr>`).join('')}</table>`;
  if(C.length)h+=`<div class="sub" style="margin-top:4px">${C.map(c=>c.low!=null?`Tellus: a low satellite has a station in view ${pc(c.low)} of the time`:`${c.body}: the ground reaches home ${pc(c.near)} of the time on the near side, ${pc(c.far)} on the far side`).join(' · ')}</div>`;
  return h}
