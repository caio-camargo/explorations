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
// (flow, Q488; PLAYTEST #123) where it comes down and who brings it back: the map X's verdict, one line (impVerdict)
function landRow(){const V=toolOK('impact')&&impVerdict();return V?[['Landing',`<span style="color:${verdictInk(V.v)}">${tipEsc(V.t)}</span>`]]:[]}
const inAir=()=>!!S.body.atm&&!S.landed&&len(S.r)-S.body.R<S.body.atm;
// (slice 4b) the Ascent condition: in the air with q over 1 kPa or below 20 km (the climb's start, a landing's radar tape),
// low over an airless body, or the skin above 30 % of its limit. Held 3 s after it ends, so the cluster doesn't flicker.
function ascentNow(){if(!S||!S.alive||S.landed)return false;const b=S.body,h=len(S.r)-b.R;
  return inAir()&&((S.qdyn||0)>1000||h<20000)||!b.atm&&h<20000||!!S.hot&&S.hot.T>S.hot.d.Tmax*.3}
let ascentT=-1e9;function ascentOn(){const now=performance.now();if(ascentNow())ascentT=now;return now-ascentT<3000}
// the gauges' slot (#gslot, read by gl.js's gaugeRect): shown in flight while the Ascent condition holds and the gauges are on
function gaugeSlot(){const g=$('gslot');if(!g)return;const on=GAUGES&&mode==='flight'&&view!=='map'&&!!S&&ascentOn();if(g.classList.contains('hidden')===on)g.classList.toggle('hidden',!on)}
// the design's action groups (Q329): a button each (its key), what it moves and whether that is out now
function agRows(){if(!S.alive)return[];const O={out:'extend',in:'retract',tog:'toggle'};
  return(S.ag||[]).map(g=>{const P=agParts(S,g),n=P.filter(p=>agOut(S,p)).length;
    return[`<button data-agfire="${g.id}" title="${O[g.op]} (${g.key.toUpperCase()})"${P.length?'':' disabled'}>${g.key.toUpperCase()}</button>`,`${tipEsc(g.name)} <span class="dim">${P.length?`${n} of ${P.length} out`:'nothing left'}</span>`]})}
document.addEventListener('click',e=>{const id=e.target.dataset&&e.target.dataset.agfire;if(id==null||mode!=='flight'||!S)return;e.target.blur();tapeAg(recTape,S,id)});
// (flow, Q495; PLAYTEST #130) the Δv card: the stage burning now, from what's left in its tanks at this air's exhaust speed
// (the core's line is vacuum), with its burn at full throttle; the stages after it (in vacuum: they burn high); and, past the climb, what the ◇'s burn to
// orbit needs (Q485's turnGuide), against all that's left
function dvRows(){if(!S.alive)return[];const b=S.body,pr=b.atm&&b.rho0?density(b,len(S.r)-b.R)/b.rho0:0,P=dvPlan(S,pr);
  const V=pr>0.01?dvPlan(S,0):P,c=P[0],rest=V.slice(1).filter(x=>x.dv>0.5),tot=(c?c.dv:0)+rest.reduce((a,x)=>a+x.dv,0);if(!c||tot<0.5)return[];
  const R=c.dv>0.5?[['This stage',`<span title="at this air's exhaust speed">${c.dv.toFixed(0)} m/s</span>${V!==P&&V[0]?` <span class="dim">(${V[0].dv.toFixed(0)} vac)</span>`:''}`],['Full burn',fmtT(c.burn)]]:[['This stage','<span class="dim">empty: stage (Space)</span>']];
  if(rest.length)R.push(['Then',`<span title="the stages after this one, in vacuum">${rest.map(x=>x.dv.toFixed(0)).join(' · ')} m/s</span>`]);
  const g=S.rec&&S.rec.launched?turnGuide(S):null;
  if(g&&g.ph!=='climb')R.push(['To orbit',`${g.dv.toFixed(0)} m/s · ${fmtT(g.tb)} <span class="dim">burn</span> · <span class="${tot>=g.dv?'ok':'bad'}" title="${tot>=g.dv?'left over after it':'short of it'}">${tot>=g.dv?'+':'−'}${Math.abs(tot-g.dv).toFixed(0)}</span>`]);
  return R}
const aoaRow=()=>['AoA',inAir()?`${(S.aoa*57.3).toFixed(1)}°`:'—'];
// (flow, Q548; PLAYTEST #145) the Mission card: what this flight is doing for whom (cardJobs, sim/next.js), each job's
// conditions (Q547's conds) live: ✓ met, ✗ lost, ○ open with the reading now, ◐ waiting; the conds that bring it home
// read, while it flies, Q488's verdict (who brings it back). A job done folds to one line with its pay. The first row says
// where the flight stands (jobsLeft): done, end it when you like; bring it home; or what's still to do.
const MC_MARK={met:['✓','ok'],lost:['✗','bad'],open:['○','dim'],pending:['◐','warn']};
// where the flight stands, for the card and the notice: jobsLeft, and on a path down through the air, that ending it now
// writes the hardware off (the refurbishment comes with a landing)
function mcLeft(J){if(!S||!S.alive||!S.rec||S.rec.ended)return null;const L=jobsLeft(J||cardJobs(S));if(!L||L.k!=='done')return L;
  const B=S.body,down=!S.landed&&!!B.atm&&elements(S.r,S.v,B.mu).pe<B.R+B.atm;return down?{...L,t:L.t+' (land it to keep the hardware)'}:L}
// (Q600, D42) The card is on screen the whole flight (CP_CARDS, app/cockpit.js). In a critical phase (cpPhase: the climb,
// a burn, a landing) it is short: one line per job, its first open condition with the reading now; unpinned only (a
// pinned card stays full). Jobs keep the order the flight first listed them in (mcOrder), so a job done turns green where
// it stood, with its pay, instead of jumping to the top.
const MC_ORD=new WeakMap();
function mcOrder(R,J){let o=MC_ORD.get(R);if(!o)MC_ORD.set(R,o=new Map());for(const j of J)if(!o.has(j.key))o.set(j.key,o.size);
  return J.slice().sort((a,b)=>o.get(a.key)-o.get(b.key))}
const mcShort=()=>typeof cpPhase==='function'&&!!cpPhase()&&!(typeof hudPins!=='undefined'&&hudPins.has('mission'));
function missionRows(){if(!S||!S.rec||S.rec.ended)return[];const J0=cardJobs(S);if(!J0.length)return[];const J=mcOrder(S.rec,J0),L=mcLeft(J0),out=[],short=mcShort();
  const V=S.alive&&!S.landed&&toolOK('impact')&&impVerdict();
  if(L)out.push([`<b class="${L.k==='done'?'ok':'acc'}">Now</b>`,`<span class="${L.k==='done'?'ok':'acc'}">${tipEsc(L.t[0].toUpperCase()+L.t.slice(1))}</span>`]);
  for(const j of J){if(j.done){out.push(['<span class="ok">✓</span>',`<span class="ok">${tipEsc(j.title)} · done, +${fmtM(j.pay)}</span>`]);continue}
    if(short){const lost=j.conds.find(c=>c.state==='lost'),c=lost||j.conds.find(c=>c.state!=='met'),[m,cl]=MC_MARK[lost?'lost':c&&c.state]||MC_MARK.open;
      out.push([`<span class="${cl}">${m}</span>`,`<b>${tipEsc(j.title)}</b>${c?` <span class="${lost?'bad':'dim'}">· ${tipEsc(c.t)}${!lost&&c.now?`, ${tipEsc(c.now)}`:''}</span>`:''}`]);continue}
    out.push(['',`<b>${tipEsc(j.title)}</b> <span class="dim">· ${j.k} · ${fmtM(j.pay)}</span>`]);
    for(const c of j.conds){const home=MC_HOME.includes(c.id)&&!c.home,wait=home&&c.state!=='met'&&c.state!=='lost'&&V,[m,cl]=MC_MARK[wait?'pending':c.state]||MC_MARK.open;
      const now=wait?` <span style="color:${verdictInk(V.v)}">· ${tipEsc(V.t)}</span>`:c.now&&c.state!=='met'?` <span class="dim">· ${tipEsc(c.now)}</span>`:'';
      out.push([`<span class="${cl}">${m}</span>`,`<span class="${c.state==='lost'?'bad':c.state==='met'?'':'dim'}">${tipEsc(c.t)}</span>${now}`])}}
  return out}
// (Q548) a condition changing state says one line, once, card or no card (the dark cockpit folds it away): "Apex 40–55 km
// ✓", "Biology flight: never over 5 g ✗". Not for a job just done (the completion notice says that, Q569), nor at the
// first look of a flight, nor once it is over (the loss says why).
let mcSeen=null;
function missionWatch(){if(mode!=='flight'||!S||!S.rec||!S.rec.launched||!S.alive||S.rec.ended)return;const R=S.rec;
  if(!mcSeen||mcSeen.R!==R)mcSeen={R,st:new Map(),first:true};const said=[];
  for(const j of cardJobs(S)){if(j.done)continue;for(const c of j.conds){const k=j.key+'/'+c.id,was=mcSeen.st.get(k);mcSeen.st.set(k,c.state);
    if(mcSeen.first||was===undefined||was===c.state)continue;
    if(c.state==='met')said.push(`${c.t[0].toUpperCase()+c.t.slice(1)} ✓`);else if(c.state==='lost')said.push(`${j.title}: ${c.t} ✗`)}}
  mcSeen.first=false;if(said.length)HOOK.msg(said.join(' · '))}
// (flow, Q633; PLAYTEST #170) The RCS card, while RCS is on: the keys as a picture of the craft as the camera sees it (D43).
// Left, *move*: the translate keys at the ends of the axes they push along (I/K the nose, J/L and U/O sideways); an axis
// pointing at the camera is a mark at the bottom, ⊙ towards the camera, ⊗ away. Right, *turn*: the attitude keys on arcs
// (W/S and A/D tip the nose, Q/E roll it), an arc seen edge-on likewise a mark. A key held lights its arrow. Under it, the
// gas left. In the dark cockpit it stays within RCS_NEAR of the target (a burn on a docking approach).
// rcsPic is pure: the craft's quaternion, the camera's R, U, Fw (HOOK.view), the inputs (INP). Test flow-64.
const RCS_NEAR=1000;
const RCS_T=[[[1,0,0],'L','J','tx',.5],[[0,1,0],'I','K','ty',1.1],[[0,0,1],'U','O','tz',.5]];   // body axis, + key, − key (app/loop.js), where its arrows start
// sim/vessel.js ctrlAccel: W tips the nose to +X, D to +Z, Q rolls +X to +Z. [key, input, sign, the arc (body axes; ph:
// the side of the craft facing the camera, so Q and E run from it both ways round), t from, t to]
const rcsRing=a=>[Math.cos(a)*.8,-.3,Math.sin(a)*.8];
const RCS_A=[
  ['W','pitch',1,t=>[Math.sin(t),Math.cos(t),0],.2,.75],['S','pitch',-1,t=>[-Math.sin(t),Math.cos(t),0],.2,.75],
  ['D','yaw',1,t=>[0,Math.cos(t),Math.sin(t)],.2,.75],['A','yaw',-1,t=>[0,Math.cos(t),-Math.sin(t)],.2,.75],
  ['Q','roll',1,(t,ph)=>rcsRing(ph+t),.12,.95],['E','roll',-1,(t,ph)=>rcsRing(ph-t),.12,.95]];
function hull2(P){const Q=P.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),L=[],U=[];
  for(const p of Q){while(L.length>1&&cr(L[L.length-2],L[L.length-1],p)<=0)L.pop();L.push(p)}
  for(const p of Q.reverse()){while(U.length>1&&cr(U[U.length-2],U[U.length-1],p)<=0)U.pop();U.push(p)}
  return L.slice(0,-1).concat(U.slice(0,-1))}
function rcsPic(q,V,I){const k=26,H=128,cy=H/2,out=[],f=n=>n.toFixed(1),pl=P=>P.map(p=>f(p[0])+','+f(p[1])).join(' ');
  const at=(x0,v)=>{const w=qrot(q,v);return[x0+dot(w,V.R)*k,cy-dot(w,V.U)*k]},cls=(c,on)=>`class="${c}${on?' on':''}"`;
  const head=(P,on,key)=>{let a=P[P.length-2];const b=P[P.length-1];if(Math.hypot(b[0]-a[0],b[1]-a[1])<.5)a=P[0];
    const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,u=[(b[0]-a[0])/l,(b[1]-a[1])/l],n=[-u[1],u[0]];
    out.push(`<polyline ${cls('a',on)} points="${pl(P)}"/><polygon ${cls('h',on)} points="${pl([[b[0]+u[0]*4,b[1]+u[1]*4],[b[0]-u[0]*3+n[0]*4,b[1]-u[1]*3+n[1]*4],[b[0]-u[0]*3-n[0]*4,b[1]-u[1]*3-n[1]*4]])}"/>`
      +`<text ${cls('k',on)} x="${f(b[0]+u[0]*10)}" y="${f(b[1]+u[1]*10)}">${key}</text>`)};
  const marks=[0,0],mark=(pan,toward,on,key)=>{const x=pan*145+10+marks[pan]++*28,y=H-8;   // ⊙ comes at the camera, ⊗ goes away
    out.push(`<circle ${cls('m',on)} cx="${x}" cy="${y}" r="5"/>`+(toward?`<circle ${cls('h',on)} cx="${x}" cy="${y}" r="1.6"/>`:`<path ${cls('a',on)} d="M${x-3} ${y-3}L${x+3} ${y+3}M${x+3} ${y-3}L${x-3} ${y+3}"/>`)
      +`<text ${cls('k',on)} x="${x+12}" y="${y}">${key}</text>`)};
  const craft=x0=>{const R=[];for(let i=0;i<16;i++){const a=i*Math.PI/8,c=Math.cos(a)*.38,s=Math.sin(a)*.38;R.push([c,-.9,s],[c,.4,s])}R.push([0,1,0]);
    const sh=R.filter(v=>v[1]===.4).map(v=>at(x0,v));out.push(`<polygon class="c" points="${pl(hull2(R.map(v=>at(x0,v))))}"/><polyline class="r" points="${pl([...sh,sh[0]])}"/>`)};
  out.push('<text class="t" x="2" y="8">move</text><text class="t" x="147" y="8">turn</text>');
  craft(72);
  for(const[ax,kp,km,inp,e0]of RCS_T){const w=qrot(q,ax),px=dot(w,V.R),py=-dot(w,V.U),l=Math.hypot(px,py);
    for(const sg of[1,-1]){const on=I[inp]===sg,key=sg>0?kp:km;
      if(l<.35){mark(0,(dot(w,V.Fw)<0)===(sg>0),on,key);continue}
      const s=at(72,ax.map(x=>x*e0*sg)),u=[px/l*sg,py/l*sg];head([s,[s[0]+u[0]*12,s[1]+u[1]*12]],on,key)}}
  craft(217);const ph=Math.atan2(-dot(qrot(q,[0,0,1]),V.Fw),-dot(qrot(q,[1,0,0]),V.Fw));   // the ring's side nearest the camera
  for(const[key,inp,sg,fn,t0,t1]of RCS_A){const r=inp==='roll'?1:1.3,on=I[inp]===sg,P=[];for(let i=0;i<=8;i++)P.push(at(217,fn(t0+(t1-t0)*i/8,ph).map(x=>x*r)));
    if(Math.hypot(P[8][0]-P[0][0],P[8][1]-P[0][1])>=10){head(P,on,key);continue}
    const tg=qrot(q,sub(fn(t1,ph),fn(t1-.05,ph)));mark(1,dot(tg,V.Fw)<0,on,key)}
  return`<svg class="rcsp" viewBox="0 0 290 ${H}" width="290" height="${H}"><title>RCS keys as the camera sees the craft</title>${out.join('')}</svg>`}
function rcsCardRows(){const L=rcsLeft();if(!L)return[];const V=HOOK.view&&HOOK.view.R?HOOK.view:{R:[1,0,0],U:[0,1,0],Fw:[0,0,-1]};
  return[[rcsPic(S.q,V,INP)],['Gas',`${L.g.toFixed(1)} kg · Δv ${L.dv.toFixed(1)} m/s`]]}
const rcsNear=()=>{const T=tgtOf(S);return!!T&&len(T.dr)<RCS_NEAR};
const HUD_CARDS=[
  {id:'mission',title:'Mission',rows:missionRows},   // (Q548) first: what the flight is for. (Q600) In CP_CARDS: on screen the whole flight, short in a critical phase
  // Ascent: shown with the gauges (ascentOn)
  {id:'ascent',title:'Ascent',when:ascentOn,rows:()=>[GAUGES?aoaRow():aeroRow(),heatRow(),structRow()]},   // with the gauges on, only what they don't draw (Mach and q are on the dials)
  // Descent: coming down with an impact predicted; or, any time, the range safety warning (impact point over a city)
  {id:'descent',title:'Descent',when:()=>S.alive&&!S.landed&&(!!S.rangeWarn||dot(S.v,S.r)<0&&(!!impact||!toolOK('impact'))),rows:()=>[impactRow(),...landRow()]},
  {id:'dv',title:'<span style="text-transform:none">Δv</span>',rows:dvRows},   // (Q495) shown in the dark cockpit too: a burn is when it matters
  {id:'target',title:'Target',rows:()=>[...tgtRows(),...dockRows()]},
  {id:'approach',title:'Approach',when:()=>approachOn(),rows:()=>approachRows()},   // (Q630) inside 20 km: the path in the target's frame; under 200 m the docking rows
  {id:'stat',title:'Stationary orbit',rows:statRows},   // (vehicle, Q454) when to start the transfer, app/program-ui.js; on the Map too
  {id:'tipped',title:'On its side',rows:()=>tipRows()},   // (flow, Q527) a toppled lander: what's out under it and why, the damage
  {id:'payload',title:'Payload',rows:payloadRows},
  {id:'fleet',title:'Fleet',rows:fleetRows},
  {id:'rcs',title:'RCS',when:()=>!!S.rcs&&!!rcsJets(S),cp:()=>rcsNear(),rows:()=>rcsCardRows()},   // (Q633) the keys as a picture, the gas left; in the dark cockpit near a target
  {id:'vehicle',title:'Vehicle',when:()=>spinRows().length+wheelRows().length>0,   // (Q633) RCS on has its own card: the RCS line here only while it's off
    rows:()=>[['Mass',`${(S.mass/1000).toFixed(2)} t · ${S.gload.toFixed(1)} g`],...spinRows(),...wheelRows(),...(S.rcs?[]:rcsRows())]},
  {id:'hardware',title:'Hardware',rows:()=>[...bayRows(),...armRows()]},
  {id:'groups',title:'Action groups',when:()=>S.alive&&(S.ag||[]).some(g=>!g.stock),rows:agRows},   // (vehicle, Q329) one button each, its key on it
  {id:'rover',title:'Rover',rows:rvRows}];
// Which cards fold, so the column fits `avail` px: the oldest unpinned (smallest `since`) first, down to its title bar.
// cards: [{id, h (open height), ht (title bar height), pinned, since}]. Pure, for test.mjs.
function cardFolds(cards,avail){const fold=new Set();let tot=cards.reduce((a,c)=>a+c.h,0);
  for(const c of cards.filter(c=>!c.pinned).sort((a,b)=>a.since-b.since)){if(tot<=avail)break;fold.add(c.id);tot-=c.h-c.ht}
  return fold}
const hudPins=new Set((()=>{try{return JSON.parse(localStorage.getItem('launchpad-hud-pins')||'[]')}catch(e){return[]}})()),hudShut=new Set(),hudSince=new Map();
// the cards on screen now, each with its rows (Q600: its own function, so a test can ask it in a burn)
function hudCardsOn(){return mode==='flight'&&!!S?HUD_CARDS.filter(c=>view!=='map'||c.id==='target'||c.id==='stat').map(c=>{const pin=hudPins.has(c.id);if(!pin&&c.when&&!c.when())return null;if(!pin&&typeof cpPhase==='function'&&cpPhase()&&!CP_CARDS.includes(c.id)&&!(c.cp&&c.cp()))return null;   // c.cp: kept while it says so (Q633)   // (Q286) the dark cockpit
     const rows=c.rows();return rows.length?{c,rows,pin}:null}).filter(Boolean):[]}
function renderCards(){const el=$('cards');if(!el)return;const now=performance.now();
  const on=hudCardsOn();
  for(const id of[...hudSince.keys()])if(!on.some(x=>x.c.id===id))hudSince.delete(id);
  for(const x of on)if(!hudSince.has(x.c.id))hudSince.set(x.c.id,now);
  el.classList.toggle('hidden',!on.length);if(!on.length){el.innerHTML='';return}
  el.innerHTML=on.map(({c,rows,pin})=>`<div class="card${hudShut.has(c.id)?' fold':''}" data-card="${c.id}"><div class="ct"><span data-cfold="${c.id}">${c.title}</span><button class="pin${pin?' on':''}" data-cpin="${c.id}" title="${pin?'unpin':'keep this card open'}">📌</button></div>`
    +`<table>${rows.map(r=>r.length===1?`<tr><td colspan="2" class="pic">${r[0]}</td></tr>`:`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table></div>`).join('');   // a one-cell row is a picture, the card's width (Q633)
  // too tall for the window: fold the oldest unpinned cards to their title bars
  const top=el.getBoundingClientRect().top,avail=innerHeight-top-12,C=[...el.children].map(d=>({d,id:d.dataset.card,h:d.offsetHeight,ht:d.firstChild.offsetHeight+2,pinned:hudPins.has(d.dataset.card),since:hudSince.get(d.dataset.card)}));
  const F=cardFolds(C,avail);for(const x of C)if(F.has(x.id))x.d.classList.add('fold')}
document.addEventListener('click',e=>{const d=e.target.dataset||{};
  if(d.cpin){const id=d.cpin;hudPins.has(id)?hudPins.delete(id):hudPins.add(id);try{localStorage.setItem('launchpad-hud-pins',JSON.stringify([...hudPins]))}catch(x){}renderCards();hudLayout()}
  else if(d.cfold){const id=d.cfold;hudShut.has(id)?hudShut.delete(id):hudShut.add(id);renderCards();hudLayout()}
  else if(d.warp&&mode==='flight'){warpStep(+d.warp);updateHUD()}});
