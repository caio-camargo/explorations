// app/network.js — the network's data, slice N1 (flow session, QUEUE Q155; NOTES § UI "Network screen plan"); its screen is
// mission control since Q241 R4 (app/mission.js). Part of
// index.html's script: a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// N1: the fleet strip (everything of ours out there, and what it does next) and the pad calendar (each pad's bookings over
// the next months, with the program's dated events); N2 (QUEUE Q170): the schematic of the nodes. All of it is drawn from
// economy's netModel() (QUEUE Q154, sim/program.js), the one SIM function the screen reads. Nothing here changes the program.
const NET_DAYS=180;   // the calendar's span, from today
const netOpen=()=>(PROG.sats||[]).some(q=>!q.junk)||(PROG.dispatch||[]).length>0;   // a second node besides the pad (W18's default)
const netData=()=>netModel();
// N2, the schematic (NOTES § UI "Network screen plan"): not the orbital map. Bodies as columns, outward to the right (Tellus
// first, then the others in the order the model lists them); within a column the surface at the bottom and the orbit bands
// above it (netModel's slots: low, high, stationary). Each node says what it is in words; a crewed one its supplies (stock,
// what it eats a day, days left); a paused one why. The bottleneck line sits on top. Routes come with routines (N3).
const NET_SLOTS=[['stationary','Stationary'],['high','High orbit'],['low','Low orbit'],['surface','Surface']];
function netNodesHTML(N){const nodes=N.nodes||[],bn=N.bottleneck,kg=x=>x>=1e4?`${(x/1e3).toFixed(1)} t`:`${Math.round(x)} kg`;
  const bodies=[...new Set(['Tellus',...nodes.map(n=>n.body)])].filter(b=>nodes.some(n=>n.body===b)),lk=new Map((N.links||[]).map(l=>[`reg:${l.id}`,l]));
  const node=n=>{const L=lk.get(n.id),sup=n.stock&&n.stock.supplies,eat=n.need&&n.need.supplies,on=bn&&bn.node===n.id;
    return`<div class="nn${n.paused?' paused':''}${on?' bn':''}" data-node="${n.id}" title="${n.name}: ${n.kind}"><b>${n.name}</b><div class="dim">${n.kind}</div>`
      +(sup!=null?`<div>supplies ${kg(sup)}${eat?` · eats ${kg(eat)}/d`:''}</div>`:'')
      +(n.days!=null?`<div class="${n.days<30?'bad':''}">${Math.floor(n.days)} days left</div>`:'')
      +(n.paused?`<div class="warn">paused: ${eat&&!(sup>0)?'out of supplies':'adrift'}</div>`:'')
      +(L&&!L.now?'<div class="dim">no contact now</div>':'')+`</div>`};
  return`<div class="nbn${bn?' bad':''}">${bn?`Bottleneck: ${bn.text}`:'No bottleneck: no crewed node is short of supplies'}</div>`
    +`<div class="ngrid" style="grid-template-columns:110px repeat(${bodies.length},minmax(0,1fr))"><span></span>${bodies.map(b=>`<div class="nb">${b}</div>`).join('')}`
    +NET_SLOTS.map(([k,l])=>`<div class="nl">${l}</div>`+bodies.map(b=>`<div class="nc">${nodes.filter(n=>n.body===b&&n.slot===k).map(node).join('')}</div>`).join('')).join('')+`</div>`
    +`<div class="dim nfoot">${nodes.length} node${nodes.length===1?'':'s'} · ${(N.routes||[]).length?`${N.routes.length} routes`:'no routes yet: they come with routines'} · not to scale (the map [M] is)</div>`}
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
