// app/hud.js — the flight readout's cards (flow session, UI slice 4a, QUEUE Q3; NOTES § UI "Slice 4 plan"). The readout
// top left is the core (updateHUD, never more than 6 lines); everything else is a card in a column on the right, under
// the toolbar. A card shows while its condition holds, or while it's pinned (📌, remembered per browser); a click on its
// title folds it. On the map only the Target card stays. When the column is taller than the window, the oldest unpinned cards fold to their title bars first.
// **For other sessions:** new HUD content registers a card here instead of adding a row to updateHUD:
//   HUD_CARDS.push({id, title, when: () => bool (optional: shown whenever it has rows), rows: () => [[label, html], …]})
// test.mjs flow-5 fails if updateHUD's core gains a row.
'use strict';
// the rows that used to be the core's (same text), now the Ascent and Descent cards'
function aeroRow(){const b=S.body,h=len(S.r)-b.R;return['Aero',b.atm&&h<b.atm?`M ${S.mach.toFixed(2)} · AoA ${(S.aoa*57.3).toFixed(1)}° · q ${(S.qdyn/1000).toFixed(1)} kPa`:'—']}
function heatRow(){return['Heat',S.hot?`<span class="${S.hot.T>S.hot.d.Tmax*.9?'bad':S.hot.T>S.hot.d.Tmax*.7?'warn':'ok'}">${S.hot.T.toFixed(0)} / ${S.hot.d.Tmax} K</span> <span class="dim">${S.hot.d.name}${S.parts.some(p=>p.on&&p.cap.ablator)?` · ablator ${(100*S.parts.filter(p=>p.on&&p.cap.ablator).reduce((a,p)=>a+p.res.ablator/p.cap.ablator,0)/S.parts.filter(p=>p.on&&p.cap.ablator).length).toFixed(0)}%`:''}</span>`:'—']}
function structRow(){return['Structure',S.maxLoadP&&S.maxLoadP.on&&S.maxLoadP.sk1?(c=>`<span class="${c>1?'bad':c>.7?'warn':'ok'}">${(c*100).toFixed(0)}% ${S.maxLoadKind}</span>`)(S.maxLoad/Math.min(certOf(S.maxLoadP.sk1),certOf(S.maxLoadP.sk2)))+` <span class="dim">${S.maxLoadP.d.name} / ${S.maxLoadP.parent.d.name}</span>`:'—']}
function impactRow(){return['Impact',!toolOK('impact')?'<span class="dim">no trajectory data yet</span>':impact?`in ${fmtT(impact.t-simT)} · ${impact.v.toFixed(0)} m/s${impact.v<12?' <span class="ok">(safe)</span>':''}${impSpread&&impSpread.km>0.5?` <span class="warn">± ${impSpread.km.toFixed(0)} km</span>`:''}${S.rangeWarn?` <span class="bad">over ${S.rangeWarn.city.name}!</span>`:''}`:'—']}
const inAir=()=>!!S.body.atm&&!S.landed&&len(S.r)-S.body.R<S.body.atm;
// (slice 4b) the Ascent condition: in the air with q over 1 kPa or below 20 km (the climb's start, a landing's radar tape),
// low over an airless body, or the skin above 30 % of its limit. Held 3 s after it ends, so the cluster doesn't flicker.
function ascentNow(){if(!S||!S.alive||S.landed)return false;const b=S.body,h=len(S.r)-b.R;
  return inAir()&&((S.qdyn||0)>1000||h<20000)||!b.atm&&h<20000||!!S.hot&&S.hot.T>S.hot.d.Tmax*.3}
let ascentT=-1e9;function ascentOn(){const now=performance.now();if(ascentNow())ascentT=now;return now-ascentT<3000}
// the gauges' slot (#gslot, read by gl.js's gaugeRect): shown in flight while the Ascent condition holds and the gauges are on
function gaugeSlot(){const g=$('gslot');if(!g)return;const on=GAUGES&&mode==='flight'&&view!=='map'&&!!S&&ascentOn();if(g.classList.contains('hidden')===on)g.classList.toggle('hidden',!on)}
const aoaRow=()=>['AoA',inAir()?`${(S.aoa*57.3).toFixed(1)}°`:'—'];
const HUD_CARDS=[
  // Ascent: shown with the gauges (ascentOn)
  {id:'ascent',title:'Ascent',when:ascentOn,rows:()=>[GAUGES?aoaRow():aeroRow(),heatRow(),structRow()]},   // with the gauges on, only what they don't draw (Mach and q are on the dials)
  // Descent: coming down with an impact predicted; or, any time, the range safety warning (impact point over a city)
  {id:'descent',title:'Descent',when:()=>S.alive&&!S.landed&&(!!S.rangeWarn||dot(S.v,S.r)<0&&(!!impact||!toolOK('impact'))),rows:()=>[impactRow()]},
  {id:'target',title:'Target',rows:()=>[...tgtRows(),...dockRows()]},
  {id:'payload',title:'Payload',rows:payloadRows},
  {id:'fleet',title:'Fleet',rows:fleetRows},
  {id:'vehicle',title:'Vehicle',when:()=>spinRows().length+wheelRows().length>0||!!S.rcs,
    rows:()=>[['Mass',`${(S.mass/1000).toFixed(2)} t · ${S.gload.toFixed(1)} g`],...spinRows(),...wheelRows(),...rcsRows()]},
  {id:'hardware',title:'Hardware',rows:()=>[...bayRows(),...armRows()]},
  {id:'rover',title:'Rover',rows:rvRows}];
// Which cards fold, so the column fits `avail` px: the oldest unpinned (smallest `since`) first, down to its title bar.
// cards: [{id, h (open height), ht (title bar height), pinned, since}]. Pure, for test.mjs.
function cardFolds(cards,avail){const fold=new Set();let tot=cards.reduce((a,c)=>a+c.h,0);
  for(const c of cards.filter(c=>!c.pinned).sort((a,b)=>a.since-b.since)){if(tot<=avail)break;fold.add(c.id);tot-=c.h-c.ht}
  return fold}
const hudPins=new Set((()=>{try{return JSON.parse(localStorage.getItem('launchpad-hud-pins')||'[]')}catch(e){return[]}})()),hudShut=new Set(),hudSince=new Map();
function renderCards(){const el=$('cards');if(!el)return;const now=performance.now();
  const on=mode==='flight'&&!!S?HUD_CARDS.filter(c=>view!=='map'||c.id==='target').map(c=>{const pin=hudPins.has(c.id);if(!pin&&c.when&&!c.when())return null;const rows=c.rows();return rows.length?{c,rows,pin}:null}).filter(Boolean):[];
  for(const id of[...hudSince.keys()])if(!on.some(x=>x.c.id===id))hudSince.delete(id);
  for(const x of on)if(!hudSince.has(x.c.id))hudSince.set(x.c.id,now);
  el.classList.toggle('hidden',!on.length);if(!on.length){el.innerHTML='';return}
  el.innerHTML=on.map(({c,rows,pin})=>`<div class="card${hudShut.has(c.id)?' fold':''}" data-card="${c.id}"><div class="ct"><span data-cfold="${c.id}">${c.title}</span><button class="pin${pin?' on':''}" data-cpin="${c.id}" title="${pin?'unpin':'keep this card open'}">📌</button></div>`
    +`<table>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table></div>`).join('');
  // too tall for the window: fold the oldest unpinned cards to their title bars
  const top=el.getBoundingClientRect().top,avail=innerHeight-top-12,C=[...el.children].map(d=>({d,id:d.dataset.card,h:d.offsetHeight,ht:d.firstChild.offsetHeight+2,pinned:hudPins.has(d.dataset.card),since:hudSince.get(d.dataset.card)}));
  const F=cardFolds(C,avail);for(const x of C)if(F.has(x.id))x.d.classList.add('fold')}
document.addEventListener('click',e=>{const d=e.target.dataset||{};
  if(d.cpin){const id=d.cpin;hudPins.has(id)?hudPins.delete(id):hudPins.add(id);try{localStorage.setItem('launchpad-hud-pins',JSON.stringify([...hudPins]))}catch(x){}renderCards();hudLayout()}
  else if(d.cfold){const id=d.cfold;hudShut.has(id)?hudShut.delete(id):hudShut.add(id);renderCards();hudLayout()}
  else if(d.warp&&mode==='flight'){warpTo=null;warpIdx=clamp(warpIdx+(+d.warp),0,WARPS.length-1);updateHUD()}});
