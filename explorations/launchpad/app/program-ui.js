// app/program-ui.js — the Program screen: contract board, satellites, logbook, the era map; then the start-up calls. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ program UI: the contract board (economy session)
function ownershipHTML(){const o=own(),pc=i=>`hsl(${POWERS[i].hue},70%,68%)`;
  if(!o.chosen&&!PROG.flights)return `<div class="ep">Whose program? <span class="dim">(your power)</span></div><div class="sub gq">The country behind the launch site: how the money arrives, what the public wants from you, and what a failure costs.</div>`+   // (flow, Q41) each choice explained in one sentence, on screen
    [['', `Random world`, `Whatever the launch site's power was generated as: a ${ARCH[POWERS[0].arch].name.toLowerCase()} this time.`],...Object.entries(ARCH).map(([k,v])=>[k,v.name,v.blurb])].map(([k,n,b])=>{const on=(PROG.homeArch||'')===k;
      return `<div class="ms gc${on?' on':''}"><button data-arch="${k}" class="${on?'on':''}">${n}</button><div class="sub">${b}</div></div>`}).join('')+
    `<div class="ep">How does the program start?</div><div class="sub gq">Who owns it: where the money comes from, and who you answer to.</div>`+Object.entries(START).map(([k,v])=>
    `<div class="ms gc"><button data-start="${k}">${v.name} · ${fmtM(v.funds)}</button><div class="sub">${v.blurb}</div></div>`).join('');
  const shares=[...Object.entries(o.st).sort((a,b)=>b[1]-a[1]).map(([k,x])=>`<span style="color:${pc(+k)}">${POWERS[+k].root}</span> ${(x*100).toFixed(0)}%`),...(o.pv>0?[`private ${(o.pv*100).toFixed(0)}%`]:[])].join(' · ');
  return `<div class="ep">${progName()} <span class="dim">· ${ownKind()}</span></div><div class="sub">${shares}${o.debt>0?` · <span class="bad">debt ${fmtM(o.debt)}</span>`:''}</div>`+
    ((PROG.history||[]).length?`<div class="sub dim">${PROG.history.map(h=>`day ${h.day.toFixed(0)}: ${h.from} ${h.move}`).join('<br>')}</div>`:'')+
    (PROG.decisions||[]).map(d=>`<div class="ms" style="border-left-color:var(--warn)"><b>${d.title}</b><div class="sub">${d.text} <i>${Math.max(0,d.expires-PROG.day).toFixed(0)} days to answer</i></div>`+
      d.opts.map(([k,l])=>`<button data-dk="${d.id}:${k}">${l}</button>`).join(' ')+`</div>`).join('')}
document.addEventListener('click',e=>{const ds=e.target.dataset||{};
  if(ds.arch!=null){PROG.homeArch=ds.arch||null;RIVALS=raceSchedule();HOOK.save();renderProgram()}
  else if(ds.start){chooseStart(ds.start);renderProgram();editorChanged()}
  else if(ds.dk){const[i,k]=ds.dk.split(':');resolveDecision(+i,k);renderProgram();editorChanged()}
  else if(ds.line){const[k,m]=ds.line.split(':');if(!startProdLine(k,m))HOOK.msg('Not possible right now');renderProgram();editorChanged()}
  else if(ds.stand){if(!buildStand())HOOK.msg('Not possible right now');renderProgram()}
  else if(ds.fac){if(!buildFac(ds.fac))HOOK.msg('Not possible right now');renderProgram();editorChanged()}
  else if(ds.devtake){takeDeviation(+ds.devtake)}
  else if(ds.devlose){loseDeviation(+ds.devlose,'let go');renderProgram()}
  else if(ds.wd){if(!withdrawContract(+ds.wd))HOOK.msg('Not possible right now');renderProgram()}   // economy (Q93)
  else if(ds.baserun){const b=(PROG.sats||[]).find(x=>x.id===+ds.baserun),r=b&&orderBaseRun(b,stackDef);HOOK.msg(r&&r.ok?`Supply run dispatched to ${b.name}`:`Supply run: ${r?r.why:'no such base'}`);renderProgram()}   // economy (Q61)
  else if(ds.dry){const r=orderDryRun(stackDef);HOOK.msg(r.ok?`Dry run: ${r.proc.from}'s procedure flies it, ${fmtDv(r.margin)} to spare (provisional)`:`Trajectory office: ${r.why}`);renderProgram();editorChanged()}
  else if(ds.disp){const c=PROG.active.find(x=>x.id===+ds.disp),o=c&&dispatchOptions(c)[0];if(!o||!orderDispatch(c,o.stack))HOOK.msg('Not possible right now');renderProgram()}
  else if(ds.adv){const st=advanceTo(+ds.adv);HOOK.msg(st?`Stopped: ${st.text}`:`${fmtDate(PROG.day)}`);renderProgram();editorChanged()}
  else if(ds.dev){const[k,g]=ds.dev.split(':');if(!startDev(k,g))HOOK.msg('The design bureau is busy, or there is not enough money');renderProgram();editorChanged()}
  else if(ds.test){const[k,m]=ds.test.split(':');if(!startTest(k,m))HOOK.msg('The stand is busy, or there is not enough money');renderProgram();editorChanged()}});
function contractsHTML(){ensureBoard();const pc=i=>`hsl(${POWERS[i].hue},70%,68%)`,cyc=PROG.cycle||0;
  const row=(c,act)=>`<div class="ms"><b>${cTitle(c)}</b> <span class="ok">${fmtM(c.p.pay)}</span> <span class="dim">· ${SRC[c.src].name} · </span><span style="color:${pc(c.client)}">${POWERS[c.client].root}</span>`+
    (c.why?`<div class="sub dim">Why: ${c.why}</div>`:'')+`<div class="sub">${cBrief(c)} ${act?`<b>${Math.max(0,c.deadline-PROG.day).toFixed(0)} days left</b> <button data-wd="${c.id}" title="frees the slot now, at a missed deadline's cost in standing">Withdraw</button>`:`offer ends in ${Math.max(0,c.expires-PROG.day).toFixed(0)} d`}</div>`+
    (()=>{const r=offerRisk(c),w=[...r.now.map(i=>`${POWERS[i].root} sanctions us at once`),...r.leak.map(i=>`${POWERS[i].root} if it leaks (${(LEAK_P(c)*100).toFixed(0)}%)`)];return w.length?`<div class="sub bad">⚠ ${w.join(' · ')}</div>`:''})()+
    (act?'':`<button data-acc="${c.id}" ${PROG.active.length>=capOf()?'disabled':''}>Take</button> <button data-dec="${c.id}">Pass</button>`)+`</div>`;
  return `<div class="ep">Contracts ${PROG.active.length}/${capOf()} <span class="dim">· economy ${cyc>.45?'booming':cyc<-.45?'in recession':cyc>.15?'growing':cyc<-.15?'slowing':'steady'}</span></div>`+
    (PROG.active.length?PROG.active.map(c=>row(c,true)+dispatchLine(c,stackDef)).join(''):'<div class="sub">none taken: one flight can complete several</div>')+
    `<div class="ep">Offers</div>`+(PROG.offers.length?PROG.offers.map(c=>row(c,false)).join(''):'<div class="sub">none right now</div>')+
    `<div class="sub">Standing: ${Object.keys(SRC).map(k=>`${SRC[k].name.toLowerCase()} ${standOf(k).toFixed(0)}`).join(' · ')}</div>`+
    (Object.keys(PROG.sanc||{}).filter(i=>sanctioned(+i)).map(i=>`<div class="sub bad">Sanctioned by ${POWERS[+i].name} for ${(PROG.sanc[i]-PROG.day).toFixed(0)} more days</div>`).join(''))+
    `<div class="ep">The race</div><div class="sub">`+RACE.map(id=>{const M=MISSIONS.find(m=>m.id===id),r=RIVALS[id],l=raceLost(id);
      return `${M.name.replace(/^Passenger: /,'Passenger, ')}: `+(PROG.done[id]?(l!=null?`<span class="warn">second, after ${POWERS[l].root}</span>`:'<span class="ok">first in the world</span>'):l!=null?`<span class="bad">${POWERS[l].root} got there first</span>`:r?`${POWERS[r.i].root} expected ${r.day-PROG.day<60?'<span class="warn">soon</span>':`around day ${r.day}`}`:'open')}).join('<br>')+'</div>'}
document.addEventListener('click',e=>{const a=e.target.dataset&&(e.target.dataset.acc||e.target.dataset.dec);if(!a)return;
  if(e.target.dataset.acc){if(!acceptOffer(+a))HOOK.msg(`At capacity: ${capOf()} contracts at once`)}else declineOffer(+a);renderProgram()});
// ============================================================ program UI: satellites (planning session)
// program time now: during a flight, its launch-window day plus flight time; on the pad, the next window
const SAT_MESH=new WeakMap();   // registry entry → its mesh, built on first sight
function satMesh(q){let me=SAT_MESH.get(q.shape);if(!me){const parts=q.shape.filter(o=>PARTS[o.k]).map(o=>({...o,d:PARTS[o.k]}));
    for(const p of parts)if(p.mk)MARKS.set(p,{soot:p.mk[0],char:p.mk[1],cd:p.mk.slice(2),frost:0,glow:0});SAT_MESH.set(q.shape,me={mesh:partsMesh(parts),parts})}return me}   // keyed by shape: a part broken off is a new shape
const FLEET_MESH=new WeakMap();   // a fleet vessel's mesh, rebuilt when it loses parts (parts only ever come off)
function fleetMesh(v){const on=v.parts.filter(p=>p.on),k=on.length+bayKey(v);let e=FLEET_MESH.get(v);if(!e||e.n!==k){if(e)e.mesh.free();e={n:k,mesh:partsMesh(on)};FLEET_MESH.set(v,e)}return e.mesh}
const bayKey=s=>s?s.parts.filter(p=>p.on&&p.d.kind==='bay').map(p=>Math.round(doorF(p)*40)).join():'';
function tNow(){return(S&&S.rec&&S.rec.launched?S.rec.day0:Math.ceil((PROG.day||0)-1e-9))*DAY_S+simT}
// economy: a deviated dispatch, handed over at the moment it deviated (not rounded to a whole day); no revert
function takeDeviation(id){const D=(PROG.dispatch||[]).find(x=>x.id===id&&x.status==='deviated');if(!D)return;const q=D.dev.entry;
  if(S)missionEnd(S);FLEET.length=0;heard.clear();impSpread=null;warpTo=null;player=null;impact=null;pendingDrops.length=0;smoke.length=0;simT=0;debris.forEach(d=>d.mesh.free());debris.length=0;booms.length=0;
  const day0=Math.max(PROG.day,q.epoch/DAY_S);advanceDays(day0-PROG.day);if(ORB_ABS)ORB_T0=day0*DAY_S;
  const s=vesselOf(q,q.epoch+(day0*DAY_S-q.epoch));const R=s.rec=recNew();
  Object.assign(R,{launched:true,day0,cost:0,ops:0,fromOrbit:true,dispatched:D.id,noRevert:true,crewInit:1,crewed:crewOn(s)>0,crewOK:true,cg:0,cgMax:0,ccab:290});
  D.status='handed';S=s;recTape=tapeNew(q.stack,S.site);recTape.fromOrbit=true;HOOK.rebuild();warpIdx=0;physAcc=0;go('flight');cam.dist=Math.max(18,S.len*1.6);cam.pitch=0.12;
  HOOK.msg(`${D.dev.why}: the flight is yours (no revert)`);HOOK.save()}
function flyEntry(id){const q=(PROG.sats||[]).find(x=>x.id===id&&!x.docked);if(!q||!flyable(q))return;
  if(S)missionEnd(S);FLEET.length=0;heard.clear();impSpread=null;warpTo=null;player=null;impact=null;pendingDrops.length=0;smoke.length=0;simT=0;debris.forEach(d=>d.mesh.free());debris.length=0;booms.length=0;
  const day0=Math.ceil(PROG.day-1e-9);advanceDays(day0-PROG.day);   // a flight starts on a whole day, from orbit as from the pad
  if(ORB_ABS)ORB_T0=day0*DAY_S;
  const s=vesselOf(q,day0*DAY_S);PROG.sats.splice(PROG.sats.indexOf(q),1);
  const R=s.rec=recNew();Object.assign(R,{launched:true,day0,cost:0,ops:OPS_FIX,fromOrbit:true,crewInit:1,crewed:crewOn(s)>0,crewOK:true,cg:0,cgMax:0,ccab:290});PROG.funds-=R.ops;
  S=s;recTape=tapeNew(q.stack,S.site);recTape.fromOrbit=true;HOOK.rebuild();warpIdx=0;physAcc=0;go('flight');cam.dist=Math.max(18,S.len*1.6);cam.pitch=0.12;HOOK.msg(`Flying ${s.name}`);HOOK.save()}
document.addEventListener('click',e=>{const id=e.target.dataset&&e.target.dataset.fly;if(id==null)return;flyEntry(+id)});
function stationLine(q){const st=stationOf(q);if(!st)return'';
  return ` · <b>station</b>: ${st.berths} berth${st.berths===1?'':'s'}, crew ${st.crew}${st.labs?`, ${st.labs} lab${st.labs>1?'s':''}${st.crew?'':' (idle)'}`:''}, supplies ${st.crew?`${Math.floor(st.days)} days`:`${(st.sup*1000).toFixed(0)} kg`}, ${st.ports} free port${st.ports===1?'':'s'}${q.labDays?`, ${q.labDays.toFixed(0)} lab-days so far`:''}`}
function satsHTML(){return cruiseHTML()+satsHTML0()+moonSatsHTML()+landedHTML()+rvFieldHTML()}
// missions in flight (space, Q49 slice 1): what each is doing next; one waiting at an atmosphere can be flown down
function cruiseHTML(){const L=(PROG.sats||[]).filter(q=>q.cruise&&!q.docked);if(!L.length)return'';const T=tNow();
  return`<div class="ep">In flight</div>`+L.map(q=>{const B=orbBody(q),[r]=satAt(q,T),n=cruiseNext(q,T);
    const nb=q.nodes&&q.nodes[0],burn=nb?` · burn of ${len(nb.dv).toFixed(0)} m/s in ${Math.max(0,(nb.T-T)/DAY_S).toFixed(1)} days: ${nb.mc?'mission control will fly it':'yours to fly'} ${nb.mc||autoAllowed('burn').ok?`<button data-mc="${q.id}">${nb.mc?'Take it back':'Hand to mission control'}</button>`:`<span class="dim">(mission control ${autoAllowed('burn').why})</span>`}`:'';
    return`<div class="sub"><b>${q.name}</b>${flyable(q)?` <button data-fly="${q.id}">Fly</button>`:''} · ${fmtD(len(r)-B.R)} above ${B.name} · ${n.text}${n.days!=null?`, in ${n.days<1?'less than a day':`${Math.round(n.days)} days`}`:''}${burn}</div>`}).join('')}
document.addEventListener('click',e=>{const id=e.target.dataset&&e.target.dataset.mc;if(id==null)return;const q=(PROG.sats||[]).find(x=>x.id===+id);if(q&&q.nodes&&q.nodes[0])nodeHandOff(+id,!q.nodes[0].mc);HOOK.save();renderProgram()});
// station-keeping (space, Q50) and decay (Q25): how long its propellant holds its orbit, since when it drifts, or when it
// re-enters; nothing if no tide or air pulls on it
function slotLine(q){const k=holdRate(q),L=decayLife(q),fall=L<Infinity?`re-enters in about ${daysS(L)}`:'';
  if(q.adrift!=null){if(fall)return` · <span class="dim">nothing to hold it up: ${fall}</span>`;return slotRate(q)>0?` · <span class="dim">adrift since day ${Math.floor(q.adrift)}, nothing left to hold its orbit</span>`:''}
  if(!(k>0))return'';return` · holds its orbit ${daysS(skLife(q))} more (${k.toFixed(2)} m/s a day)${fall?`, then ${fall}`:''}`}
function moonSatsHTML(){const L=moonSats().filter(q=>!q.junk),T=tNow();if(!L.length)return'';
  return[...new Set(L.map(q=>q.bodyName))].map(n=>`<div class="ep">In orbit around ${n}</div>`+L.filter(q=>q.bodyName===n).map(q=>{const B=orbBody(q),[r,v]=satAt(q,T),el=elements(r,v,B.mu),inc=Math.acos(clamp(el.h[1]/el.hl,-1,1))*57.29578;
    const kit=[q.ant&&'antenna: a relay for rovers',q.cam&&'camera',q.sci&&'instruments'].filter(Boolean).join(' + ');
    return`<div class="sub"><b>${q.name}</b>${flyable(q)?` <button data-fly="${q.id}">Fly</button>`:''} · ${fmtD(el.pe-B.R)}–${fmtD(el.ap-B.R)}, ${inc.toFixed(0)}°${kit?` · ${kit}`:''}${stationLine(q)}${slotLine(q)}</div>`}).join('')).join('')}
function landedHTML(){const L=landedUp();if(!L.length)return'';
  return'<div class="ep">On the surface</div>'+L.map(q=>{const base=q.beacon?baseOf(q):null,mem=!q.beacon&&baseOfMember(q);
    return`<div class="sub"><b>${q.name}</b>${flyable(q)?` <button data-fly="${q.id}">Fly</button>`:''} · ${q.bodyName}${base?` · <b>base</b>: ${base.members.length} module${base.members.length===1?'':'s'}, ${base.berths} berths, crew ${base.crew}${base.labs?`, ${base.labs} lab${base.labs>1?'s':''}`:''}, supplies ${base.crew?`${Math.floor(base.days)} days`:`${(base.sup*1000).toFixed(0)} kg`}${q.labDays?`, ${q.labDays.toFixed(0)} lab-days so far`:''}`:mem?` · part of ${mem.name}`:''}</div>`+(base?baseRunLine(q,stackDef):'')}).join('')}
// the fragment bands (space, Q147): how many, the thickest band and what it means for a 2 m satellite there
function fragHTML(){const F=PROG.frag;if(!F)return'';const n=F.reduce((a,x)=>a+x,0);if(n<100)return'';const b=F.indexOf(Math.max(...F)),lo=Math.round((TELLUS.atm+b*BAND_W)/1e3),
  K=PRESSURE_K[pressureOf('debris')]||0,r=4*2*2*F[b]/bandV(b)*Math.sqrt(TELLUS.mu/bandR(b))*DAY_S*YEAR_D*K,c=Object.entries(PROG.casc||{}).filter(x=>x[1]>=2).map(x=>Math.round((TELLUS.atm+x[0]*BAND_W)/1e3));
  return`<div class="sub dim">fragments of 1 cm and more: about ${Math.round(n).toLocaleString()}, thickest at ${lo}–${lo+50} km${r>0?` (a 2 m satellite there: one hit in about ${Math.round(1/r).toLocaleString()} years)`:''}${c.length?`; feeding itself: ${c.map(x=>`${x}–${x+50} km`).join(', ')}`:''}</div>`}
function satsHTML0(){const all=satsUp(),L=all.filter(q=>!q.junk),J=all.filter(q=>q.junk);const T=tNow();
  return gsHTML()+(all.length?`<div class="ep">In orbit</div>`:'')+(J.length?`<div class="sub dim">and ${J.length} piece${J.length>1?'s':''} of debris (spent stages and dead satellites, ${(J.reduce((a,q)=>a+q.mass,0)/1000).toFixed(1)} t; G targets them in flight)</div>`:'')+fragHTML()+L.map(q=>{const[r,v]=satAt(q,T),el=elements(r,v,TELLUS.mu),inc=Math.acos(clamp(el.h[1]/el.hl,-1,1))*57.29578;
    const kit=[q.cam&&'camera',q.ant&&'antenna',q.sci&&'instruments',q.ballast&&`${(q.ballast*.5).toFixed(1)} t ballast`,q.bio&&'a very patient passenger'].filter(Boolean).join(' + ');
    return`<div class="sub"><b>${q.name}</b>${flyable(q)?` <button data-fly="${q.id}">Fly</button>`:''} · ${fmtD(el.pe-TELLUS.R)}–${fmtD(el.ap-TELLUS.R)}, ${inc.toFixed(0)}° · ${kit}${stationLine(q)}${slotLine(q)}${q.cam&&q.ant&&q.contact!=null?` · in contact ${(q.contact*100).toFixed(0)}% of the time`:''}${q.cam?` · ${q.imgs} delivered${q.pending.length?`, ${q.pending.length} waiting for a downlink`:''}`:''}</div>`}).join('')}
function gsHTML(){if(!PROG.done||!PROG.done.beeper)return'';const pc=i=>`hsl(${POWERS[i].hue},70%,68%)`;
  const have=stationsAll().map(g=>`<span style="color:${pc(g.power)}">${g.name}</span>`).join(' · ');
  const sites=gsSites().map(ci=>{const c=CITIES[ci],v=gsCheck(ci),pw=c.power?c.power.i:HOME;
    return`<div class="sub"><span style="color:${pc(pw)}">${c.name}</span> <span class="dim">(${POWERS[pw].root})</span> ${fmtM(v.cost)}${pw!==HOME?` + ${fmtM(GS_LEASE)}/100 d`:''} `+
      (v.ok?`<button data-gs="${ci}">Build</button>`:`<span class="dim">· ${v.why}</span>`)+`</div>`}).join('');
  return`<div class="ep">Ground stations</div><div class="sub">${have}</div><details><summary class="sub" style="cursor:pointer">build another…</summary>${sites}</details>`}
document.addEventListener('click',e=>{const ci=e.target.dataset&&e.target.dataset.gs;if(ci==null)return;const v=buildStation(+ci);if(!v.ok)HOOK.msg(v.why);renderProgram()});
// ============================================================ program UI: the logbook (planning session)
const logF=id=>(PROG.log||{})[id];
function logHintHTML(){const o=logF('orbit'),l=logF('land');
  return`Low orbit: ${o?`<b>${fmtDv(o.v)}</b> (best, ${o.by})`:'<i>unknown, nobody has made it yet</i>'} · Selene landing: ${l?`<b>${fmtDv(l.v)}</b> from the pad (best, ${l.by})`:'<i>unknown</i>'} · <a id="lbHint" style="cursor:pointer;text-decoration:underline">logbook</a>`}
const modernUI=()=>{try{return localStorage.getItem('launchpad-modern-ui')==='1'}catch(e){return false}};
function renderLog(){const el=$('logbook'),era=modernUI()?0:eraOf(),cls=['lb-modern','lb-notebook','lb-terminal'][era];el.className=cls;
  const title=['Logbook','Program notebook','PROGRAM LOG — TERMINAL 1'][era],U=x=>era===2?x.toUpperCase():x;
  let lastSec='';const rows=LOGF.map(F=>{const sh=F.sec!==lastSec?(lastSec=F.sec,`<div class="lbsec">${U(F.sec)}</div>`):'',e=logF(F.id);const ul=unlocksOf(F.id),un=ul.length?`<div class="lbby">${U(e?'→ unlocked: ':'→ will unlock: ')}${U(ul.join(', '))}</div>`:'';
    if(!e)return sh+`<div class="lbrow">${U(F.label)}<br><span class="lbv lbu">${era===1?'???':'— NO DATA —'}</span> <span class="lbby">${U(F.hint)}</span>${un}</div>`;
    const hist=(e.hist||[]).map(v=>`<s>${F.fmt(v)}</s>`).join('');
    return sh+`<div class="lbrow">${U(F.label)}<br>${hist}<span class="lbv">${F.fmt(e.v)}</span> <span class="lbby">— ${e.by}, flight ${e.flight}, ${fmtDate(e.day)}</span>`+
      (e.stack?` <button data-lbload="${F.id}">${era===1?'copy this design':U('load design')}${e.tape?era===1?' + its flight':' + TAPE':''}</button>`:'')+un+`</div>`}).join('');
  el.innerHTML=`<span class="x" id="lbClose">✕</span><h3>${title}</h3>${rows}<div class="lbopt"><label><input type="checkbox" id="lbModern" ${modernUI()?'checked':''}> modern look</label></div>`;
  $('lbClose').onclick=()=>el.classList.add('hidden');
  $('lbModern').onchange=e=>{try{localStorage.setItem('launchpad-modern-ui',e.target.checked?'1':'0')}catch(x){}renderLog()}}
function toggleLog(){const el=$('logbook');if(el.classList.toggle('hidden'))return;renderLog()}
$('bLog').onclick=toggleLog;$('bLog2').onclick=toggleLog;
document.addEventListener('click',e=>{if(e.target.id==='lbHint')toggleLog();const id=e.target.dataset&&e.target.dataset.lbload;if(!id)return;const ent=logF(id);if(!ent||!ent.stack)return;
  go('assembly');BLD.load(JSON.parse(JSON.stringify(ent.stack)));
  // the record flight becomes this design's autopilot, unless the design already has one
  if(ent.tape)try{if(!localStorage.getItem(tapeKey()))localStorage.setItem(tapeKey(),JSON.stringify({v:ent.tape.v,stack:ent.stack,ops:ent.tape.ops,site:ent.tape.site}))}catch(x){}
  $('logbook').classList.add('hidden');HOOK.msg(`Loaded ${ent.by}${ent.tape?ent.tape.v===TAPE_V?' with its record flight as the autopilot':' (its record flight was flown on older physics and can\'t replay exactly; its procedure, if any, still can)':''}`)});
// a record set by a flight keeps that flight's tape (from the pad), so the record can be flown again
HOOK.logged=ids=>{const T=player?tapeCut(player):recTape;if(!T||!T.ops||T.ops.length>40000)return;
  for(const id of ids){const e=(PROG.log||{})[id];if(e&&e.stack)e.tape={v:T.v,ops:JSON.parse(JSON.stringify(T.ops)),site:T.site}}HOOK.save()};
// ============================================================ program UI: the map by era (planning session)
// The map ages with the program like the logbook: pencil on graph paper (orbits sketched in ink, the planet a hand-drawn
// circle with its night side hatched), then a vector terminal (a glowing wireframe globe, phosphor-green orbits). Same
// simulation, same camera, same clicks and handles: only the drawing changes. "Modern look" keeps the rendered map.
let MAPSEGS=null;
const mapEra=()=>view==='map'&&mode==='flight'&&!modernUI()?eraOf():0;
const ERA_FONT={1:k=>`${15*k}px 'Segoe Print','Bradley Hand','Comic Sans MS',cursive`,2:k=>`${12*k}px ui-monospace,Consolas,monospace`};
const inkCache=new Map(),inkCv=document.createElement('canvas').getContext('2d');
function rgbOf(c){if(inkCache.has(c))return inkCache.get(c);inkCv.fillStyle='#000';inkCv.fillStyle=c;const f=inkCv.fillStyle;let r=0,g=0,b=0,a=1;
  if(f[0]==='#'){r=parseInt(f.slice(1,3),16);g=parseInt(f.slice(3,5),16);b=parseInt(f.slice(5,7),16)}else{const m=f.match(/[\d.]+/g)||[];[r,g,b]=m.map(Number);a=m[3]!=null?+m[3]:1}
  const v=[r,g,b,a];inkCache.set(c,v);return v}
// warm colours (impacts, warnings, encounters) become red pencil / bright phosphor; everything else, ink / green
// ---- the atlas on the map (terrain session): C cycles biomes → powers → off. The grid is baked by atlasBake (SIM);
// the rendered map tints the planet with a texture made from it, the notebook and terminal maps draw its lines in ink.
const BIOME_INK=['#2a5d8a','#eef3f6','#a9b49c','#47715a','#cdc386','#5b9a4e','#a3c45f','#bba98b','#2f7a3e','#d2b25c','#e6c47f','#9a948e','#6a4a42','#f4eee2','#5fa293'];
let atlasMode=(()=>{try{return(+localStorage.getItem('launchpad-atlas')||0)%3}catch(e){return 0}})();const ATLAS_GL={tex:null,mode:0};
function cycleAtlas(){atlasMode=(atlasMode+1)%3;try{localStorage.setItem('launchpad-atlas',atlasMode)}catch(e){}
  HOOK.msg(['Atlas off','Atlas: biomes','Atlas: powers'][atlasMode]+(atlasMode&&!ATLAS.lines?' (surveying…)':''))}
function atlasTick(){if(!atlasBake(6))return;if(ATLAS_GL.mode!==atlasMode)atlasTex(atlasMode)}
// colour + opacity per point: biome or power colour, coasts dark, borders light (biomes) or dark (powers)
function atlasTex(mode){const A=ATLAS,W=A.W,H=A.H,d=new Uint8Array(W*H*4),hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const bc=BIOME_INK.map(hex),pc=POWERS.map(p=>rgbOf(`hsl(${p.hue},50%,58%)`).slice(0,3)),edge=mode===1?[250,248,236]:[28,28,34];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=y*W+x;if(!A.bio[k])continue;const nb=[y*W+(x+1)%W,y*W+(x+W-1)%W,y>0?k-W:k,y<H-1?k+W:k];
    let c=mode===1?bc[A.bio[k]]:pc[A.pow[k]-1]||[200,200,200],a=mode===1?205:180;
    if(nb.some(j=>!A.bio[j])){c=[22,26,34];a=240}else if(nb.some(j=>A.pow[j]!==A.pow[k])){c=edge;a=240}
    d[k*4]=c[0];d[k*4+1]=c[1];d[k*4+2]=c[2];d[k*4+3]=a}
  if(!ATLAS_GL.tex)ATLAS_GL.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,ATLAS_GL.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,d);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);ATLAS_GL.mode=mode}
// a planet-fixed unit vector on Tellus's surface, in world space, and whether it faces the camera
const atlasW=u=>add(bodyPos(TELLUS,simT),fromPF(TELLUS,mul(u,TELLUS.R),simT)),atlasVis=(w,camW)=>dot(sub(w,bodyPos(TELLUS,simT)),sub(camW,w))>0;
// the notebook and terminal maps: coasts in ink, borders dashed in the second ink
function atlasInk(era,camW,project,tanY,k){const L=ATLAS.lines;if(!L)return;const o=octx,cen=bodyPos(TELLUS,simT),d=len(sub(cen,camW));
  if(d<=TELLUS.R||(H/2)*Math.tan(Math.asin(TELLUS.R/d))/tanY<25)return;   // too small to carry a map
  const th=bodyTheta(TELLUS,simT),c=Math.cos(th)*TELLUS.R,s=Math.sin(th)*TELLUS.R,cp=toPF(TELLUS,sub(camW,cen),simT),
    Wd=(F,i)=>[cen[0]+c*F[i]+s*F[i+2],cen[1]+TELLUS.R*F[i+1],cen[2]-s*F[i]+c*F[i+2]];   // fromPF (rotY by θ), inlined: ~22k points a frame
  for(const[F,col,dash]of[[L.coast,era===1?'rgba(29,42,82,.75)':'rgba(57,255,110,.75)',null],[L.border,era===1?'rgba(176,54,42,.8)':'rgba(214,255,120,.85)',[4*k,3*k]]]){
    o.strokeStyle=col;o.lineWidth=(era===1?1.1:.9)*k;o.setLineDash(dash||[]);o.beginPath();
    for(let i=0;i<F.length;i+=6){if(F[i]*cp[0]+F[i+1]*cp[1]+F[i+2]*cp[2]<=TELLUS.R)continue;const p=project(Wd(F,i)),q=project(Wd(F,i+3));   // facing the camera: u·cam > R
      if(p&&q){o.moveTo(p[0],p[1]);o.lineTo(q[0],q[1])}}
    o.stroke()}
  o.setLineDash([])}
// over every map look: the powers' names on their land, the biome legend (rendered map), and what's under the pointer
function atlasOverlay(era,camW,project,R,U,Fw,tanX,tanY){const A=ATLAS,o=octx,k=Math.min(devicePixelRatio||1,1.5),ink=c=>era?eraInk(era,c):c,fnt=o.font;
  if(!A.lines){o.textAlign='left';o.fillStyle=ink('#cfd8e3');o.fillText(`Atlas: surveying ${(100*A.y/A.H).toFixed(0)}%`,14*k,H-60*k);o.textAlign='center';return}
  o.font=`600 ${11*k}px ui-sans-serif,system-ui,sans-serif`;o.textAlign='center';
  for(const nm of A.names){if(!nm)continue;const w=atlasW(nm.u);if(!atlasVis(w,camW))continue;const s=project(w);if(!s)continue;const P=POWERS[nm.i];
    o.fillStyle=ink(`hsl(${P.hue},80%,${atlasMode===2?'92%':'78%'})`);o.strokeStyle=era===1?'rgba(246,240,222,.8)':'rgba(0,0,0,.65)';o.lineWidth=3*k;
    const t=P.root.toUpperCase().split('').join(' ');o.strokeText(t,s[0],s[1]);o.fillText(t,s[0],s[1])}
  if(atlasMode===1&&!era){const ids=[...new Set(A.bio)].filter(i=>i).sort((a,b)=>a-b),x=W-150*k,y0=H-(ids.length*14+24)*k;o.font=`${10.5*k}px ui-sans-serif,system-ui,sans-serif`;o.textAlign='left';
    ids.forEach((id,j)=>{const y=y0+j*14*k;o.fillStyle=BIOME_INK[id];o.fillRect(x,y-8*k,10*k,10*k);o.fillStyle='rgba(225,232,240,.9)';o.fillText(BIOMES[id],x+15*k,y+1*k)})}
  // the readout: cast the pointer's ray at Tellus
  const m=mapUI.mouse&&[mapUI.mouse[0]*W/cv.clientWidth,mapUI.mouse[1]*H/cv.clientHeight];if(m){const dd=norm(add(Fw,add(mul(R,(2*m[0]/W-1)*tanX),mul(U,(1-2*m[1]/H)*tanY)))),cen=bodyPos(TELLUS,simT),oc=sub(camW,cen),b=dot(oc,dd),q=b*b-dot(oc,oc)+TELLUS.R*TELLUS.R;
    if(q>0&&-b-Math.sqrt(q)>0){const a=atlasAt(toPF(TELLUS,madd(oc,dd,-b-Math.sqrt(q)),simT)),deg=(v,p,n)=>`${Math.abs(v).toFixed(1)}°${v>=0?p:n}`;
      const t=a.id?`${a.biome[0].toUpperCase()+a.biome.slice(1)} · ${a.power?a.power.name:'unclaimed'} · ${Math.round(a.h).toLocaleString('en')} m`:`Sea · ${Math.round(-a.h).toLocaleString('en')} m deep`;
      const t2=`${deg(a.lat,'N','S')} ${deg(a.lon,'E','W')}`;o.font=`${11*k}px ui-monospace,Consolas,monospace`;o.textAlign='left';
      const wd=Math.max(o.measureText(t).width,o.measureText(t2).width)+12*k,x=Math.min(m[0]+14*k,W-wd-4),y=m[1]+18*k;
      o.fillStyle=era===1?'rgba(246,240,222,.92)':'rgba(8,12,18,.82)';o.fillRect(x,y-12*k,wd,32*k);o.fillStyle=ink('#e6edf5');o.fillText(t,x+6*k,y);o.fillText(t2,x+6*k,y+14*k)}}
  o.font=fnt;o.textAlign='center'}
function eraInk(era,c){const[r,g,b,a]=rgbOf(c),warm=r>g+40&&r>b+40;
  return era===1?(warm?`rgba(176,54,42,${Math.max(.6,a)})`:`rgba(29,42,82,${Math.max(.55,a)})`):(warm?`rgba(214,255,120,${Math.max(.7,a)})`:`rgba(57,255,110,${Math.max(.55,a)})`)}
const wob=(x,y,i)=>[x+Math.sin(i*1.7+y*.05)*.7,y+Math.cos(i*2.3+x*.05)*.7];   // a hand's tremor, steady from frame to frame
function drawEraMap(era,camW,project,tanY){const k=Math.min(devicePixelRatio||1,1.5),o=octx;
  // the sheet
  if(era===1){o.fillStyle='#f6f0de';o.fillRect(0,0,W,H);o.strokeStyle='rgba(120,160,210,.28)';o.lineWidth=1;o.beginPath();
    for(let x=0;x<W;x+=24*k){o.moveTo(x,0);o.lineTo(x,H)}for(let y=0;y<H;y+=24*k){o.moveTo(0,y);o.lineTo(W,y)}o.stroke()}
  else{o.fillStyle='#020a03';o.fillRect(0,0,W,H);o.fillStyle='rgba(255,255,255,.025)';for(let y=0;y<H;y+=3*k)o.fillRect(0,y,W,1)}
  const ink=era===1?'rgba(29,42,82,.85)':'rgba(57,255,110,.9)';
  // the bodies: limb circles; the terminal adds a wireframe of latitude and longitude, the notebook hatches the night side
  for(const[b,cen]of BODIES.map(b=>[b,bodyPos(b,simT)])){const c=project(cen);if(!c)continue;const d=len(sub(cen,camW));if(d<=b.R)continue;
    const rp=(H/2)*Math.tan(Math.asin(b.R/d))/tanY;if(rp<1.5){o.fillStyle=ink;o.beginPath();o.arc(c[0],c[1],2*k,0,7);o.fill();continue}
    o.strokeStyle=ink;o.lineWidth=(era===1?1.6:1.2)*k;if(era===2){o.shadowColor='rgba(57,255,110,.8)';o.shadowBlur=6*k}
    o.beginPath();for(let i=0;i<=72;i++){const t=i/72*6.2832,[x,y]=era===1?wob(c[0]+rp*Math.cos(t),c[1]+rp*Math.sin(t),i):[c[0]+rp*Math.cos(t),c[1]+rp*Math.sin(t)];i?o.lineTo(x,y):o.moveTo(x,y)}o.stroke();
    const th=bodyTheta(b,simT),vis=p=>dot(sub(p,cen),sub(camW,p))>0,P=(lat,lon)=>add(cen,rotY([b.R*Math.cos(lat)*Math.cos(lon),b.R*Math.sin(lat),b.R*Math.cos(lat)*Math.sin(lon)],th));
    const line=(fn,n)=>{let pv=null;for(let i=0;i<=n;i++){const w=fn(i/n);if(!vis(w)){pv=null;continue}const q=project(w);if(q&&pv){o.moveTo(pv[0],pv[1]);o.lineTo(q[0],q[1])}pv=q}};
    o.beginPath();o.lineWidth=(era===1?1:.8)*k;o.strokeStyle=era===1?'rgba(29,42,82,.35)':'rgba(57,255,110,.45)';
    if(era===2){for(let la=-60;la<=60;la+=30)line(t=>P(la*Math.PI/180,t*6.2832),64);for(let lo=0;lo<360;lo+=30)line(t=>P((t-.5)*Math.PI,lo*Math.PI/180),48)}
    else line(t=>P(0,t*6.2832),64);   // the notebook just pencils in the equator
    o.stroke();o.shadowBlur=0;
    if(era===1){const sq=project(add(cen,mul(SUN,b.R)));if(sq){let sx=sq[0]-c[0],sy=sq[1]-c[1];const sl=Math.hypot(sx,sy)||1;sx/=sl;sy/=sl;
      o.save();o.beginPath();o.arc(c[0],c[1],rp,0,7);o.clip();o.beginPath();o.rect(c[0]-rp-2,c[1]-rp-2,2*rp+4,2*rp+4);o.clip();
      o.strokeStyle='rgba(29,42,82,.22)';o.lineWidth=1;o.beginPath();
      for(let t=-rp*1.5;t<rp*1.5;t+=6*k){const x0=c[0]+t,y0=c[1]-rp*1.5,x1=c[0]+t+rp*1.2,y1=c[1]+rp*1.5;   // diagonal strokes, kept on the night half
        for(let u=0;u<1;u+=.05){const xa=x0+(x1-x0)*u,ya=y0+(y1-y0)*u,xb=x0+(x1-x0)*(u+.05),yb=y0+(y1-y0)*(u+.05);
          if((xa-c[0])*sx+(ya-c[1])*sy<0&&(xb-c[0])*sx+(yb-c[1])*sy<0){o.moveTo(xa,ya);o.lineTo(xb,yb)}}}
      o.stroke();o.restore()}}}
  if(atlasMode)atlasInk(era,camW,project,tanY,k);   // coasts and borders (terrain session)
  // every line the map computed (orbits, plans, Selene, satellites, impact traces), in two inks
  const segs=MAPSEGS;if(!segs||!segs.length)return;const warm=[],cool=[];
  for(let i=0;i<segs.length;i+=14){const a=project(add([segs[i],segs[i+1],segs[i+2]],camW)),bb=project(add([segs[i+7],segs[i+8],segs[i+9]],camW));if(!a||!bb)continue;
    const r=segs[i+3],g=segs[i+4],bl=segs[i+5],al=segs[i+6];((r>g+.15&&r>bl+.15)?warm:cool).push(a,bb,al)}
  for(const[L,col]of[[cool,era===1?[29,42,82]:[57,255,110]],[warm,era===1?[176,54,42]:[214,255,120]]]){if(!L.length)continue;
    o.lineWidth=(era===1?1.3:1.1)*k;if(era===2){o.shadowColor=`rgba(${col},.9)`;o.shadowBlur=5*k}
    for(const pass of[.35,.7,1]){o.strokeStyle=`rgba(${col},${era===1?pass*.9:pass})`;o.beginPath();   // three alpha bands keep faint lines faint
      for(let i=0;i<L.length;i+=3){const al=L[i+2];if(al>pass||al<=pass-.35&&pass>.35)continue;let[x0,y0]=L[i],[x1,y1]=L[i+1];if(era===1){[x0,y0]=wob(x0,y0,i);[x1,y1]=wob(x1,y1,i+1)}o.moveTo(x0,y0);o.lineTo(x1,y1)}o.stroke()}
    o.shadowBlur=0}}
function gateMsg(k){const T=TOOLS[k],F=LOGF.find(f=>f.id===T.fact);return`No ${T.name} yet: it needs "${F.label.toLowerCase()}" in the logbook`}
// encounter legs are only drawn once someone has been there; until then the map stops at the edge, with a question mark
const knownBody=b=>b!==NYX||!!(PROG.log&&PROG.log.nyx);   // Nyx's orbit and pull are unknown until it's weighed
function gateLegs(list,labels){if(!list||!list.length||toolOK('encounters')&&(!list[1]||knownBody(list[1].b)))return list;const p0=list[0];
  if(p0.endKind==='enc'&&p0.end){labels.push({p:add(p0.b.parent?(p0.off||bodyPos(p0.b,simT)):[0,0,0],p0.end),mark:'impact',t:`? ${list[1]?list[1].b.name:'another body'}: what its pull does next, no data yet`,c:'#ffb454'})}
  return[{...p0,endKind:null}]}
const unlocksOf=id=>Object.values(TOOLS).filter(T=>T.fact===id).map(T=>T.name);
function payloadRows(){const R=S.rec,out=[];if(!R)return out;
  if(R.bio){out.push(['Passenger',R.bioOK?`${R.pet} · <span class="${R.g>G_LIM*.8?'bad':R.g>G_LIM*.5?'warn':'ok'}">${R.g.toFixed(1)} g</span> <span class="dim">(max ${R.gMax.toFixed(1)}/${G_LIM})</span> · cabin <span class="${R.cabin>CABIN_MAX-10?'bad':'ok'}">${R.cabin.toFixed(0)} K</span> · air ${fmtT(AIR_S-simT)}`:`<span class="bad">${R.pet} ${R.bioWhy}</span>`])}
  if(S.parts.some(p=>p.on&&p.d.kind==='sci')){const b=Object.keys(R.bands).map(Number).sort((a,b)=>a-b);
    out.push(['Instruments',`telemetry live · max-q ${(R.sciQ/1000).toFixed(1)} kPa${b.length?` · air samples ${b[0]*10}–${(b[b.length-1]+1)*10} km`:''}`])}
  if((PROG.active&&PROG.active.length)||R.cdone.length)out.push(['Contracts',[...R.cdone.map(t=>`<span class="ok">✔ ${t}</span>`),...(PROG.active||[]).map(c=>`<span class="dim">${cTitle(c)}</span>`)].join(' · ')]);
  return out}
// ---- rendezvous UI: choosing a target, the closest-approach cache, the HUD rows
function setTarget(id,tv=null){S.target=id;S.tgtV=tv;caCache=null;if(id==null&&TGT_M.includes(S.sasMode))S.sasMode='stab';renderSAS();const T=tgtOf(S);HOOK.msg(T?`Target: ${T.q.name}`:'Target cleared')}
function cycleTarget(){const L=[...orbitsAt(S.body).map(q=>({id:q.id})),...landedUp().filter(x=>landedBody(x)===S.body).map(q=>({id:q.id})),...FLEET.filter(v=>v.alive).map(v=>({v}))];if(!L.length){HOOK.msg('Nothing in orbit to target');return}
  const i=L.findIndex(x=>x.v?x.v===S.tgtV:S.tgtV==null&&x.id===S.target),n=L[i+1];if(n)setTarget(n.id??null,n.v||null);else setTarget(null)}   // satellites, then this flight's vessels, then none
let caCache=null;   // recomputed at most 4× a second of real time, or at once when the target or the node changes
function tgtCA(){const T=tgtOf(S);if(!T||T.landed||S.landed||!S.alive)return null;const key=(T.ves?'v:'+T.q.name:S.target)+'|'+(S.node?S.node.t+','+S.node.dv.join():''),now=performance.now();
  if(caCache&&caCache.key===key&&now-caCache.at<250)return caCache;
  const T0=progT(S),Q=T.ves?{r:T.q.r,v:T.q.v,epoch:T0}:T.q,orbit=(r,v,t0)=>{const B=S.body,el=elements(r,v,B.mu);return el.e<1&&el.pe>B.R?approach(Q,r,v,t0,2*el.period,B.mu):null};
  let plan=null;if(S.node){const I=nodeInfo(S);if(I)plan=orbit(I.rN,add(I.vN,I.rem),T0+I.t-simT)}
  return caCache={key,at:now,now:orbit(S.r,S.v,T0),plan}}
function spinRows(){const Y=qrot(S.q,[0,1,0]),sp=dot(S.w,Y);if(!S.spun&&Math.abs(sp)<SPIN_MIN)return[];
  const wob=len(sub(S.w,mul(Y,sp)))/Math.max(Math.abs(sp),1e-9);
  return[['Spin',`${(Math.abs(sp)*60/2/Math.PI).toFixed(0)} rpm${wob>0.01?` · wobble ${(Math.atan(wob)*180/Math.PI).toFixed(1)}°`:''}${S.spun&&S.sas?' <span class="dim">(SAS damps the wobble, leaves the roll; a roll key takes it back)</span>':''}`]]}
function wheelRows(){if(!(S.hmax>0)||!S.wH)return[];const f=len(S.wH)/S.hmax;if(f<0.05)return[];
  return[['Wheels',`<span class="${f>0.9?'bad':f>0.6?'warn':'ok'}">${(f*100).toFixed(0)}% saturated</span>${f>0.6?' <span class="dim">(RCS, a burn or steerable fins unload them)</span>':''}`]]}
function rcsRows(){const J=rcsJets(S);if(!J)return[];const g=rcsGas(S)*1000,dv=J.N[0].isp*G0*Math.log(S.mass/Math.max(1,S.mass-g));
  return[['RCS',`${S.rcs?'<span class="ok">on</span>':'off'} · gas ${g.toFixed(1)} kg · Δv ${dv.toFixed(1)} m/s${S.rcsFire?` · ${S.rcsFire} firing`:''}`]]}
// the line-up: distance between the ports, angle between their axes, closing speed, and which RCS keys close the
// offset (the target port's position from ours in our body axes: L/J move us +X/−X, U/O +Z/−Z)
function armRows(){if(!S.parts.some(p=>p.on&&p.d.kind==='arm'))return[];const arm=armOf(S),a=arm&&armHeld(S,arm),bt=(op,l)=>` <button data-arm="${op}">${l}</button>`;
  if(!a)return[['Arm',`free${bt('grab','grapple')} <span class="dim">(within ${ARM_R} m, under ${ARM_V} m/s)</span>`]];
  if(a.goal){const g=a.goal,left=(g.stage===0?len(sub(g.stand.p,a.p))+(g.kind==='berth'?ARM_OFF:g.stand.p[1]-g.end.p[1]):len(sub(g.end.p,a.p)));
    return[['Arm',`${g.kind==='berth'?'berthing':'stowing'} ${a.e.name} · ${(100*(1-left/Math.max(g.d0,1e-9))).toFixed(0)}%`]]}
  return[['Arm',`holding ${a.e.name}${bt('berth','berth')}${bt('stow','stow in bay')}${bt('free','release')}`]]}
document.addEventListener('click',e=>{const op=e.target.dataset&&e.target.dataset.arm;if(!op||mode!=='flight'||!S)return;tapeArm(recTape,S,op)});
function bayRows(){const B=S.parts.filter(p=>p.on&&p.d.kind==='bay');if(!B.length)return[];const f=Math.min(...B.map(doorF)),op=B.some(b=>b.open),
    load=B.some(b=>b.children.some(c=>c.on&&c.inBay===b)),st=f===0?'shut':f===1?'open':`${op?'opening':'closing'} ${(f*100).toFixed(0)}%`;
  return[['Bay',`${st} <button data-bay="${op?'close':'open'}">${op?'close':'open'} [B]</button>${load&&f===1?' <button data-bay="rel">release payload</button>':load?'':' <span class="dim">empty</span>'}`]]}
document.addEventListener('click',e=>{const op=e.target.dataset&&e.target.dataset.bay;if(!op||mode!=='flight'||!S)return;tapeBay(recTape,S,op)});
// ] and [: the flight's other vessels, then flyable ones of yours nearby (loaded into the flight as you switch to them)
function cycleVessel(dir){if(rvCycle(dir))return;const near=nearbyFlyable(S);if(!FLEET.length&&!near.length)return;
  const pickNear=dir>0?!FLEET.length:near.length>0;if(!pickNear){tapeSwitch(recTape,S,dir>0?0:FLEET.length-1);return}
  const q=dir>0?near[0]:near[near.length-1],v=tapeLoad(recTape,S,q.id);if(v)tapeSwitch(recTape,S,FLEET.indexOf(v))}
function fleetRows(){const L=FLEET.filter(v=>v.alive),N=nearbyFlyable(S);return L.length||N.length?[['Vessels',[...L.map(v=>`${v.name} ${fmtD(len(sub(v.r,S.r)))}`),...N.map(q=>`${q.name} ${fmtD(len(sub(satAt(q,progT(S))[0],S.r)))}`)].join(' · ')+' <span class="dim">· [ ] switch</span>']]:[]}
// landing on a target on the surface: how far along the ground, which way, and how far the predicted impact point is from it
function landingRow(T){const b=S.body,f=localFrame(S.r),d=T.dr,brg=(Math.atan2(dot(d,f.e),dot(d,f.n))*57.29578+360)%360,ds=pfDist(b,toPF(b,S.r,simT),T.q.pf);
  const imp=impact&&impact.b===b?pfDist(b,impact.pf,T.q.pf):null;
  return['Landing',`${T.q.name}: ${fmtD(ds)} along the surface, bearing ${brg.toFixed(0)}°${imp!=null?` · impact point <span class="${imp<BASE_R?'ok':'warn'}">${fmtD(imp)}</span> from it`:''}`]}
function dockRows(){const out=[],D=S.att||[];
  if(D.length)out.push(['Docked',D.map(a=>`${a.e.name}${a.load>0.5?` <span class="${a.load>0.9?'bad':'warn'}">${(a.load*100).toFixed(0)}%</span>`:''} ${a.kind==='arm'?' <span class="dim">(in the arm)</span>':`${a.kind==='bay'?' <span class="dim">(in the bay)</span>':''} <button data-undock="${a.e.id}">${a.kind==='claw'||a.kind==='bay'?'release':'undock'}</button>`}`).join(' · ')]);
  {const T=tgtOf(S);if(T&&T.landed)out.push(landingRow(T))}
  const T=tgtOf(S);if(!T||len(T.dr)>500)return out;const B=tgtBody(S,T),P=dockPair(S,T.q,B);
  const cw=S.parts.find(p=>p.on&&p.d.kind==='claw'&&clawFree(S,p));
  if(cw){const tip=add(S.r,qrot(S.q,sub(clawTip(cw),S.cm))),d=bodyDist(B,tip),u=norm(sub(B.r,tip)),vc=dot(sub(S.v,B.v),u);
    out.push(['Claw',`${d<10?d.toFixed(2)+' m':fmtD(d)} to ${T.q.name} · closing <span class="${vc<CLAW_V?'ok':'warn'}">${vc.toFixed(2)} m/s</span> <span class="dim">(grabs under ${CLAW_V} m/s)</span>`])}
  if(!P){if(!cw)out.push(['Port',`<span class="dim">${T.q.name} has no free docking port</span>`]);return out}
  const ang=Math.acos(clamp(-dot(P.Aa,P.Ab),-1,1))*57.29578,db=qrot(qconj(S.q),P.d),va=add(S.v,cross(S.w,sub(P.Pa,S.r))),vb=add(B.v,cross(B.w,sub(P.Pb,B.r))),
    cl=-dot(sub(vb,va),P.Aa),vr=qrot(qconj(S.q),sub(va,vb)),k=(v,a,b)=>Math.abs(v)<0.005?'':`${v>0?a:b} ${Math.abs(v).toFixed(2)}`,ok=(c,t)=>`<span class="${c?'ok':'warn'}">${t}</span>`;
  out.push(['Port',`${P.dl<10?P.dl.toFixed(2)+' m':fmtD(P.dl)} · ${ok(ang<10,ang.toFixed(1)+'°')} · closing ${ok(cl<PORT_V,cl.toFixed(2)+' m/s')}`],
    ['Line up',(()=>{const K=[['L','J'],['I','K'],['U','O']],av=P.a.av,ax=[0,1,2].sort((i,j)=>Math.abs(av[i])-Math.abs(av[j])).slice(0,2).sort();   // the two body axes across our port's axis
      return `offset ${ax.map(i=>k(db[i],...K[i])).filter(Boolean).join(' · ')||'centred'} m · drift ${ax.map(i=>k(-vr[i],...K[i])).filter(Boolean).join(' · ')||'none'} m/s`})()]);
  return out}
document.addEventListener('click',e=>{const id=e.target.dataset&&e.target.dataset.undock;if(id==null||mode!=='flight'||!S)return;tapeUndock(recTape,S,+id)});
function tgtRows(){const T=tgtOf(S);if(!T)return[];const d=len(T.dr),cl=dot(T.dv,T.dr)/Math.max(d,1e-9),ca=tgtCA();
  return[['Target',`${T.q.name} · ${fmtD(d)} · <span class="dim">rel</span> ${len(T.dv).toFixed(1)} m/s${Math.abs(cl)>0.05?` <span class="dim">${cl>0?'closing':'opening'}</span> ${Math.abs(cl).toFixed(1)}`:''}`],
    ['Closest',ca&&ca.now?`${fmtD(ca.now.d)} <span class="dim">in ${fmtT(ca.now.t-progT(S))} at ${ca.now.vrel.toFixed(0)} m/s</span>${ca.plan?` · plan ${fmtD(ca.plan.d)}`:''}`:'—']]}
function updateHUD(){
  const b=S.body,rl=len(S.r),h=rl-b.R,el=elements(S.r,S.v,b.mu),vs=dot(S.v,S.r)/rl,srf=len(sub(S.v,surfVel(b,S.r)));
  let sit;if(!S.alive)sit='<span class="bad">destroyed</span>';else if(S.landed)sit='landed';else if(b.atm&&h<b.atm)sit='flying';
  else if(el.pe<b.R+(b.atm||0))sit='sub-orbital';else if(el.e>=1||el.ap>soiAt(b,simT))sit='escaping';else sit='<span class="ok">orbiting</span>';
  const thr=S.thrust,twr=thr/(S.mass*b.mu/(rl*rl)),dv=dvRemaining(S);
  const tAp=el.e<1&&!S.landed?timeToNu(el,Math.PI):NaN,tPe_=!S.landed&&el.hl>1e-3?timeToNu(el,0):NaN;
  const met='T+'+fmtT(simT);
  const rows=[['MET',met],['Body',`${b.name} · ${sit}`],['Altitude',`${fmtD(h)}  <span class="dim">${vs>=0?'↑':'↓'} ${Math.abs(vs).toFixed(0)} m/s</span>`],...(h<TERR_TOP+20000&&!S.landed?[['Radar alt',`${fmtD(Math.max(0,groundGap(S)))} <span class="dim">above ${surfaceAt(S.body,toPF(S.body,S.r,simT)).name}</span>`]]:[]),...(S.body===TELLUS&&!S.landed?[['Link',(()=>{const k=linkOf(S);return k.ok?`<span class="ok">${k.st?k.st.name:k.why}</span>`:`<span class="warn">${k.why}</span> <span class="dim">· recorder</span>`})()]]:[]),
    ['Speed',`srf ${srf.toFixed(0)} · orb ${len(S.v).toFixed(0)} m/s`],
    ['Apoapsis',S.landed?'—':el.e<1?`${fmtD(el.ap-b.R)} <span class="dim">in ${fmtT(tAp)}</span>`:'escape'],
    ['Periapsis',S.landed?'—':`${fmtD(el.pe-b.R)}${isFinite(tPe_)&&tPe_>0&&el.pe>b.R?` <span class="dim">in ${fmtT(tPe_)}</span>`:''}`],
    ['Mass',`${(S.mass/1000).toFixed(2)} t · TWR ${twr.toFixed(2)} · ${S.gload.toFixed(1)} g`],['Δv',`stage ${dv.cur.toFixed(0)} · total ${dv.tot.toFixed(0)} m/s`],
    ['Aero',b.atm&&h<b.atm?`M ${S.mach.toFixed(2)} · AoA ${(S.aoa*57.3).toFixed(1)}° · q ${(S.qdyn/1000).toFixed(1)} kPa`:'—'],
    ['Impact',!toolOK('impact')?'<span class="dim">no trajectory data yet</span>':impact?`in ${fmtT(impact.t-simT)} · ${impact.v.toFixed(0)} m/s${impact.v<12?' <span class="ok">(safe)</span>':''}${impSpread&&impSpread.km>0.5?` <span class="warn">± ${impSpread.km.toFixed(0)} km</span>`:''}${S.rangeWarn?` <span class="bad">over ${S.rangeWarn.city.name}!</span>`:''}`:'—'],
    ['Heat',S.hot?`<span class="${S.hot.T>S.hot.d.Tmax*.9?'bad':S.hot.T>S.hot.d.Tmax*.7?'warn':'ok'}">${S.hot.T.toFixed(0)} / ${S.hot.d.Tmax} K</span> <span class="dim">${S.hot.d.name}${S.parts.some(p=>p.on&&p.cap.ablator)?` · ablator ${(100*S.parts.filter(p=>p.on&&p.cap.ablator).reduce((a,p)=>a+p.res.ablator/p.cap.ablator,0)/S.parts.filter(p=>p.on&&p.cap.ablator).length).toFixed(0)}%`:''}</span>`:'—'],
    ...spinRows(),...wheelRows(),...rcsRows(),...tgtRows(),...dockRows(),...fleetRows(),...bayRows(),...armRows(),...rvRows(),...payloadRows(),
    ['Structure',S.maxLoadP&&S.maxLoadP.on&&S.maxLoadP.sk1?(c=>`<span class="${c>1?'bad':c>.7?'warn':'ok'}">${(c*100).toFixed(0)}% ${S.maxLoadKind}</span>`)(S.maxLoad/Math.min(certOf(S.maxLoadP.sk1),certOf(S.maxLoadP.sk2)))+` <span class="dim">${S.maxLoadP.d.name} / ${S.maxLoadP.parent.d.name}</span>`:'—']];
  $('info').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  const w=WARPS[warpIdx];$('warp').textContent=w>1?`▶▶ ${w}×${railsOK(S)?'':' (physics)'}`:'';
  renderStages();updateNodePanel();updateAutoBtn();settleDrops();hudLayout();
  // the beeper: while an instrument package orbits, towns it passes over hear it (once each per flight)
  if(S.alive&&S.rec.orbitSci&&!S.landed&&S.body===TELLUS){const{city,dist}=nearestCity(toPF(TELLUS,S.r,simT));
    if(dist<350e3&&!heard.has(city.name)){heard.add(city.name);HOOK.news(heard.size===1?`Radio hams in ${city.name} pick up a faint beep-beep-beep from orbit`:`${city.name} hears the beeper pass overhead`,'ok')}}
  if(simT-impT>0.25||simT<impT){impT=simT;impact=predictImpact(S);
    // the atmosphere's unsampled bands: fly the same prediction with the air 25 % thinner and thicker there (once a second)
    if(!impact||impact.b!==TELLUS||(BANDS.every(k=>PROG.atm[k])&&!predErr(S)))impSpread=null;   // predErr: the compute era (economy)
    else if(simT-impST>1||simT<impST){impST=simT;const lo=predictImpact(S,-1),hi=predictImpact(S,1),gc=(a,b)=>Math.acos(clamp(dot(norm(a),norm(b)),-1,1))*TELLUS.R/1000;
      impSpread=lo&&hi?{lo,hi,km:Math.max(gc(lo.pf,impact.pf),gc(hi.pf,impact.pf))}:null}
    // range safety: while climbing under power, the impact point (the whole spread of it) must stay clear of cities
    const vs=impact&&S.thrust>0&&impact.b===TELLUS?[impact,...(impSpread?[impSpread.lo,impSpread.hi]:[])].map(x=>dropVerdict(TELLUS,x.pf)):[],
      rs=vs.find(v=>v.kind==='city')||vs.find(v=>v.kind==='near')||null,warn=!!rs;
    if(warn&&!rangeWarned){rangeWarned=true;HOOK.msg(`RANGE SAFETY: impact point over ${rs.city.name}`);HOOK.news(`Range safety officer spills coffee as flight path crosses ${rs.city.name}`,'warn')}
    if(!warn)rangeWarned=false;S.rangeWarn=warn?rs:null}}
let rangeWarned=false,impSpread=null,impST=-1;const heard=new Set();

// ---- autopilot tapes in browser storage, one per exact design (and sim version: a tape only replays on the sim that made it)
const tapeKey=()=>'launchpad-tape:'+TAPE_V+':'+JSON.stringify(stackDef);
function loadTape(){try{const t=JSON.parse(localStorage.getItem(tapeKey())||'null');return t&&t.v===TAPE_V?t:null}catch(e){return null}}
const procsOf=stack=>{const k=procKey(stack),P=PROG.procs||{};return Object.keys(P).filter(x=>x===k||x.startsWith(k+'|')).map(x=>P[x])};
// (flow, Q62) the start buttons stay while the craft still sits on the pad unlaunched (time runs there; it used to be simT===0 only,
// gone a few frames after LAUNCH, before a landing site could be picked on the map)
const prelaunch=()=>mode==='flight'&&!!S&&(simT===0||S.landed&&!!S.rec&&!S.rec.launched);
function updateProcBtn(){const b=$('bProc');if(!b)return;const L=procsOf(stackDef),show=L.length&&prelaunch()&&!player&&!(S&&S.proc);
  document.querySelectorAll('.bProcX').forEach(e=>e.remove());b.classList.toggle('hidden',!show);if(!show)return;
  const label=pr=>pr.kind==='mission'?`▶ Procedure: ${pr.sig.replace(':',' ')} (${fmtDv(pr.dv)})${landPick&&procLandsOn(pr,landPick.body)?` → ${sitePlace(landPick.pf)}`:''}`:`▶ Procedure: orbit ${(pr.target.pe/1e3).toFixed(0)}×${(pr.target.ap/1e3).toFixed(0)} km (${fmtDv(pr.dv)})`;
  b.textContent=label(L[0]);b.dataset.i=0;
  L.slice(1).forEach((pr,i)=>{const x=b.cloneNode();x.id='';x.classList.add('bProcX');x.dataset.i=i+1;x.textContent=label(pr);x.onclick=b.onclick;b.after(x)})}
function updateAutoBtn(){updateProcBtn();const t=loadTape();$('bAuto').classList.toggle('hidden',!(t&&prelaunch()&&!player));if(t)$('bAuto').textContent=`▶ Autopilot (${fmtT(tapeDuration(t))})`}
$('bProc').onclick=e=>{const pr=procsOf(stackDef)[+(e.currentTarget.dataset.i||0)];if(!pr)return;if(pr.site&&siteById(pr.site))PROG.site=pr.site;resetShip();procStart(S,landPick?procWithSite(pr,landPick.body,landPick.pf):pr);if(recTape)recTape.byProc=true;updateAutoBtn();
  HOOK.msg(`Procedure: ${pr.by}, ${pr.kind==='mission'?pr.sig.replace(':',' '):'to orbit'}, the best flown so far · any control key takes over`)};
function takeOver(){if(!player)return;recTape=tapeCut(player);player=null;warpIdx=0;HOOK.msg('Autopilot off — you have control')}
$('bAuto').onclick=()=>{const t=loadTape();if(!t)return;if(t.site&&siteById(t.site))PROG.site=t.site;resetShip();S.rec.orbT0=t.orbT0??0;player={tape:t,i:0,n:0};updateAutoBtn();HOOK.msg('Autopilot: replaying your recorded flight · any control key takes over')};
$('bSaveTape').onclick=()=>{if(recTape&&recTape.byProc&&!player){HOOK.msg('This flight was flown by a procedure: it is already automated (the ▶ Procedure button)');return}if(recTape&&recTape.fromOrbit&&!player){HOOK.msg('Autopilot tapes start from the pad: this flight began in orbit');return}try{const T=player?tapeCut(player):recTape;localStorage.setItem(tapeKey(),JSON.stringify({v:T.v,stack:T.stack,ops:T.ops,site:T.site}));
  HOOK.msg(`Saved ${fmtT(tapeDuration(T))} of flight as this design's autopilot`)}catch(e){HOOK.msg('Could not save (browser storage unavailable)')}};
function nodeAtApoapsis(){if(!S.alive||S.landed)return;if(!toolOK('nodes')){HOOK.msg(gateMsg('nodes'));return}
  if(S.node){const n=nodeAddNext(S);if(n)HOOK.msg(`Node ${1+S.nodeQ.length} at the ${n.b!==S.body.name?n.b+' ':''}${n.b!==S.body.name?'periapsis':'next apoapsis'} after the last one`);return}   // a chain (vehicle, Q33)
  const el=elements(S.r,S.v,S.body.mu);
  const t=el.e<1&&el.hl>1e-3?simT+timeToNu(el,Math.PI):simT+300;S.node={t,dv:[0,0,0]};HOOK.msg(el.e<1?'Node at next apoapsis':'Node in 5 minutes')}
// which node of a chain the panel edits (vehicle, Q33): 0 the active one, k the k-th queued after it; ◀ ▶ in the summary
let ndSel=0;const ndNodes=()=>[S.node,...(S.nodeQ||[])].filter(Boolean);
$('nodep').addEventListener('click',e=>{const a=e.target.dataset&&e.target.dataset.a;if(!a||!S.node)return;if(player)takeOver();
  const L=ndNodes();if(a==='n-'||a==='n+'){ndSel=(ndSel+(a==='n+'?1:L.length-1))%L.length;return}ndSel=Math.min(ndSel,L.length-1);const n=L[ndSel];
  if(a[0]==='d'){if(n.burning)return;n.dv[+a[1]]+=(a[2]==='+'?1:-1)*ndStep}
  else if(a[0]==='s'&&a!=='sas'){ndStep=+a.slice(1)}
  else if(a[0]==='t'&&!n.burning){const el=elements(S.r,S.v,S.body.mu),P=el.e<1?el.period:0,d=a==='t-o'?-P:a==='t+o'?P:+a.slice(1);
    const lo=ndSel?L[ndSel-1].t+1:simT+1,hi=L[ndSel+1]?L[ndSel+1].t-1:ndSel?Infinity:(predCache&&predCache.p[0]&&predCache.p[0].endT)||Infinity;n.t=clamp(n.t+d,lo,hi)}   // a chain stays in time order
  else if(a==='warp'){const dv=len(nodeInfo(S).rem),est=nodeBurnTime(S,dv);warpTo=S.node.t-(isFinite(est)?nodeLead(S,dv):0)-15;if(warpTo<=simT+1)warpTo=null}
  else if(a==='sas'){if(!sasModeOK(S,'node')){HOOK.msg(`${avOf(S).name}: it can't point at a maneuver; hold the burn attitude by hand (Stability)`);return}S.sas=true;S.sasMode='node';S.hold=null;renderSAS()}
  else if(a==='del'){S.node=null;nodeNext(S);HOOK.msg(S.node?'Node deleted; the next is up':'Node deleted')}
  updateNodePanel()});
function updateNodePanel(){const el=$('nodep');if(!S.node||mode!=='flight'){el.classList.add('hidden');return}el.classList.remove('hidden');
  const L=ndNodes();ndSel=Math.min(ndSel,L.length-1);const I=nodeInfo(S);if(!I)return;S.node.est=nodeBurnTime(S,len(I.rem));
  const n=L[ndSel],dv=ndSel?len(n.dv):len(I.rem),est=ndSel?nodeBurnTime(S,dv):S.node.est,pick=L.length>1?`<button data-a="n-">◀</button> node ${ndSel+1} of ${L.length}${n.b&&n.b!==S.body.name?` (at ${n.b})`:''} <button data-a="n+">▶</button><br>`:'';
  for(let k=0;k<3;k++)$('nd'+k).textContent=n.dv[k].toFixed(1)+' m/s';
  const tt=n.t-simT,start=tt-(isFinite(est)?nodeLead(S,dv):0),more=(S.nodeQ||[]).length;   // the lead puts half the Δv before the node (vehicle, Q33)
  $('nd-sum').innerHTML=pick+(n.burning?`<b class="warn">BURNING</b> · ${dv.toFixed(1)} m/s to go`:
    `Δv <b>${dv.toFixed(1)} m/s</b> · burn ${isFinite(est)?fmtT(est):'<span class="bad">no engine</span>'}<br>node in ${fmtT(tt)} · <span class="${start<10?'warn':''}">start burn in ${fmtT(start)}</span>${more&&!ndSel?` · ${more} more node${more>1?'s':''} after it`:''}${warpTo!==null?' <span class="warn">(warping)</span>':''}`);
  for(const b of el.querySelectorAll('[data-a^="s"]'))b.classList.toggle('on',b.dataset.a==='s'+ndStep)}
renderEditor();go('program');
requestAnimationFrame(frame);
