// sim/debrief.js — the flight's debrief record (flow session, UI slice 3). Part of index.html's script (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- the debrief: what one flight did, as data (NOTES § "UI: screens and navigation", Debrief). missionTick takes a
// snapshot of the program just before liftoff (debSnap); missionEnd builds the record once the flight is settled
// (debriefOf) and keeps it in R.debrief and DEBRIEF_LAST. The Debrief screen only renders it. Sections, in order: outcome,
// money (pay, refurbishment, damages, and what's left: the days that passed), certifications, logbook records, incidents,
// know-how. Nothing here changes the program: it only compares before and after.
let DEBRIEF_LAST=null;
function debSnap(){const kh={};for(const k in PROG.kh||{})kh[k]=PROG.kh[k].use;
  return{funds:PROG.funds,day:PROG.day,kh,done:Object.keys(PROG.done||{}),satN:PROG.satN||0,recOrbit:PROG.recs&&PROG.recs.orbit}}
// the paid items missionComplete, contractEval and stagePay add to the flight's record
const debPaid=(R,k,l,pay,x)=>{if(R)(R.paid||(R.paid=[])).push({k,l,pay,...x})};
function debOutcome(s,R){const B=s.body,km=v=>fmtKm(Math.max(0,v));
  if(!s.alive)return{k:'lost',t:'Lost',d:`destroyed${R.apex>0?` after reaching ${km(R.apex)}`:''}`};
  if(s.landed)return B===TELLUS?{k:'landed',t:'Landed',d:`${R.launchPf&&isFinite(R.landDist)?`${km(R.landDist)} from the pad`:'home'}${s.water?', in the sea':''}${R.recovery?` · recovery: ${R.recovery}`:''}`}
    :{k:'away',t:`Landed on ${B.name}`,d:'stays there'};
  const el=elements(s.r,s.v,B.mu);
  if(el.e>=1)return{k:'escape',t:`Escaping ${B.name}`,d:'on its way out'};
  if(el.pe>B.R+(B.atm||0))return{k:'orbit',t:B===TELLUS?'In orbit':`In orbit of ${B.name}`,d:`${km(el.pe-B.R)} × ${km(el.ap-B.R)}`};
  return{k:'flying',t:'Ended in flight',d:'left on a path that comes down: written off'}}
// (never throws: a debrief that fails to build must not stop the flight from settling)
function debriefOf(s,R,ups){try{return DEBRIEF_LAST=debBuild(s,R,ups)}catch(e){console.error('debrief',e);return null}}
function debBuild(s,R,ups){const b=R.deb0,out=debOutcome(s,R),D={flight:PROG.flights,design:s.stack?designName(s.stack):s.name||'',
    day0:R.day0,day:PROG.day,met:simT,fromOrbit:!!R.fromOrbit,outcome:out,money:[],net:null,missions:[],certs:[],records:[],incidents:[],kh:[],streak:PROG.streak||0};
  if(b&&PROG.satN>b.satN)out.d+=' · registered in the fleet';
  if(R.bio)D.passenger={who:R.pet,ok:R.bioOK,why:R.bioWhy,tourist:!!R.tourist};
  // money: what we know line by line; the rest is the days that passed (budget, upkeep, income, debt)
  const M=D.money,add=(l,v,k)=>{if(Math.abs(v)>=0.05)M.push({l,v,k})};
  add('Hardware',-(R.cost||0),'cost');add('Launch operations',-(R.ops||0),'cost');add('Site lease',-(R.siteFee||0),'cost');add('Sponsor covers the failed attempt',R.cover||0,'cover');
  for(const p of R.paid||[]){add(p.k==='contract'?`Contract: ${p.l}`:p.k==='stage'?`${p.l} (share)`:p.l,p.pay,p.k);if(p.k==='mission')D.missions.push({l:p.l,pay:p.pay,first:!!p.first})}
  add(`Refurbishment${R.recovery?` (${R.recovery})`:''}`,R.refund||0,'refund');add('Damages to towns',-(R.dmg||0),'dmg');
  if(b){D.net=PROG.funds-b.funds;const rest=D.net-M.reduce((a,m)=>a+m.v,0);add(`${Math.max(0,PROG.day-b.day).toFixed(0)} days passing (budget, upkeep, debt)`,rest,'days')}
  D.certs=(ups||[]).map(u=>({l:PARTS[u.k]?PARTS[u.k].name:u.k,a:u.a,b:u.b}));
  for(const id of R.newLog||[]){const F=LOGF.find(f=>f.id===id),e=(PROG.log||{})[id];if(F&&e)D.records.push({l:F.label,v:F.fmt(e.v),was:e.hist&&e.hist.length?F.fmt(e.hist[e.hist.length-1]):null})}
  if(b&&PROG.recs&&PROG.recs.orbit!==b.recOrbit&&b.recOrbit!=null)D.records.push({l:'Cheapest trip to orbit',v:`${fmtM(PROG.recs.orbit)} net`,was:fmtM(b.recOrbit)});
  for(const v of R.drops||[]){const pw=v.power,abroad=pw&&pw.i!==HOME,town=v.city?v.city.name:'a town';
    if(v.kind==='city')D.incidents.push(`A stage fell on ${town}${abroad?` (${pw.name})`:''}`);
    else if(v.kind==='near')D.incidents.push(`A stage fell near ${town}${abroad?` (${pw.name})`:''}`);
    else if(abroad)D.incidents.push(`A stage came down in ${pw.name}`)}
  if(R.bio&&!R.bioOK)D.incidents.push(`${R.pet} ${R.bioWhy}`);
  if(b)for(const k in PROG.kh||{}){const a=b.kh[k]??use0(k),v=PROG.kh[k].use;if(v>a+0.005)D.kh.push({l:PARTS[k]?PARTS[k].name:k,a,b:v})}
  D.kh.sort((x,y)=>(y.b-y.a)-(x.b-x.a));
  return D}
