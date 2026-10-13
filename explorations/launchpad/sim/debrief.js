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
  return{funds:PROG.funds,day:PROG.day,kh,done:Object.keys(PROG.done||{}),satN:PROG.satN||0,recOrbit:PROG.recs&&PROG.recs.orbit,led:{...(PROG.led||{})}}}
// ---- the money ledger (flow, QUEUE Q293; REVIEW-2026-10-11 § 3 gap 1): what moves the funds between liftoff and the
// settling, by kind, so the Debrief names each line instead of one "days passing" lump. Running totals in PROG.led; the
// Debrief takes the difference from its snapshot. The flight's own items (hardware, pay, refurbishment, damages) are
// itemized from its record as before; 'paid' is all income() and the flight's own pay is taken back out of it.
const LED_L={budget:'Budget day',topup:'Government top-up',upkeep:'Running the program',lease:'Ground station leases',sats:'Satellite income (pictures, TV)',
  contracts:'Contracts completed between flights',paid:'Pay for other flights (dispatches)',debt:'Debt repaid from income',dispatch:'Dispatched flights launched',salvage:'Recovery fleet salvage',stages:'Spent stages recovered',patron:"The leadership's reward"};
function ledAdd(k,v){if(!(Math.abs(v)>0))return;const L=PROG.led||(PROG.led={});L[k]=(L[k]||0)+v}
// what went wrong on the way (Q293): the flight's failures in order, with the time and the height; a loss shows them as the
// chain that led to it, a flight that got home lists them as incidents
function debFail(s,k,why){const R=s&&s.rec;if(!R||!R.launched)return;const F=R.fails||(R.fails=[]);if(F.length>=8)return;
  F.push({k,why,met:simT,h:Math.max(0,len(s.r)-s.body.R)})}
const debT=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,"0")}`;   // a flight time, m:ss (sim-side: no fmtT here)
// what helps, by what went wrong first: one line, plain words (the Assembly says the rest before the next launch)
function debHelp(k,why){why=why||'';
  if(k==='structure')return"Reinforce the joint that broke (right-click the part: joint), use an interstage decoupler, or climb more gently through max-q. The Assembly shows each joint's load before you fly.";
  if(k==='heat'||/burned up/.test(why))return'A heat shield under what comes home, a shallower way back in, or a nose cone over what faces the air.';
  if(k==='ignite')return'An engine new to us can fail to light; the test stand and flights raise its know-how. A failed ignition alone can be tried again (stage again).';
  if(/topple|tipped|fell over/.test(why))return"Touch down with no sideways drift, or on wider legs (the Assembly's Touchdown line says how much it stands).";
  if(/sank/.test(why))return'Come down on land, or bring a capsule that floats.';
  if(/collided|hit .* at \d+ m\/s$/.test(why)&&!/hit (Tellus|Selene|the nose)/.test(why))return'Close in slowly: under a few m/s near another craft.';
  if(/hit|nose/.test(why))return'Come down slower: a parachute opened low and slow, or a landing burn.';
  return''}
// the paid items missionComplete, contractEval and stagePay add to the flight's record
const debPaid=(R,k,l,pay,x)=>{if(R)(R.paid||(R.paid=[])).push({k,l,pay,...x});logEv('pay',`${k}: ${l}, ${pay.toFixed(1)} M`)};
function debOutcome(s,R){const B=s.body,km=v=>fmtKm(Math.max(0,v));
  if(!s.alive)return{k:'lost',t:'Lost',d:`${s.lossWhy||(s.sunk?'sank at sea':'destroyed')}${R.apex>0?` (it reached ${km(R.apex)})`:''}`};   // the cause since Q264
  if(s.landed)return B===TELLUS?{k:'landed',t:'Landed',d:`${R.launchPf&&isFinite(R.landDist)?`${km(R.landDist)} from the pad`:'home'}${s.water?', in the sea':''}${R.recovery?` · recovery: ${R.recovery}`:''}`}
    :{k:'away',t:`Landed on ${B.name}`,d:'stays there'};
  const el=elements(s.r,s.v,B.mu);
  if(el.e>=1)return{k:'escape',t:`Escaping ${B.name}`,d:'on its way out'};
  if(el.pe>B.R+(B.atm||0))return{k:'orbit',t:B===TELLUS?'In orbit':`In orbit of ${B.name}`,d:`${km(el.pe-B.R)} × ${km(el.ap-B.R)}`};
  const q=R.satId!=null&&(PROG.sats||[]).find(x=>x.id===R.satId);if(q&&q.cruise)return{k:'cruise',t:'In flight',d:'carries on between flights (Program → In flight)'};   // space Q49
  return{k:'flying',t:'Ended in flight',d:'left on a path that comes down: written off'}}
// (never throws: a debrief that fails to build must not stop the flight from settling)
function debriefOf(s,R,ups){try{DEBRIEF_LAST=debBuild(s,R,ups);PROG.lastDebrief=DEBRIEF_LAST;return DEBRIEF_LAST}catch(e){console.error('debrief',e);return null}}   // kept with the save (Q100)
// after a save loads: the last flight's Debrief is there again (QUEUE Q100; space overflow)
function debRestore(){DEBRIEF_LAST=PROG.lastDebrief||null;return DEBRIEF_LAST}
function debBuild(s,R,ups){const b=R.deb0,out=debOutcome(s,R),D={flight:PROG.flights,design:s.stack?designName(s.stack):s.name||'',
    day0:R.day0,day:PROG.day,met:simT,fromOrbit:!!R.fromOrbit,outcome:out,money:[],net:null,missions:[],certs:[],records:[],incidents:[],kh:[],streak:PROG.streak||0};
  if(b&&PROG.satN>b.satN)out.d+=' · registered in the fleet';
  if(R.bio)D.passenger={who:R.pet,ok:R.bioOK,why:R.bioWhy,tourist:!!R.tourist};
  // the crew (flow, Q191; PLAYTEST #34): people, not the test dummies flown before the escape tower is qualified. How many,
  // how it ended for them, and their days in space: since this liftoff, or for a crew brought home from a station since
  // the day they went up (crewUp, carried through the registry by shapeOf/vesselOf; space, Q214)
  if(R.crewed){const n=R.crewN||2,d0=R.day0??PROG.day,up=Math.min(d0,...s.parts.filter(p=>p.on&&p.crewAboard&&p.crewUp!=null).map(p=>p.crewUp)),
      before=d0-up,days=simT/DAY_S+before,home=s.alive&&s.landed&&s.body===TELLUS;
    D.crew={n,ok:!!R.crewOK,home,days,before,line:!R.crewOK?`The crew of ${n} ${R.crewWhy||'were lost'}`:home?`Crew of ${n} home safe${days>=1?` after ${days.toFixed(days<10?1:0)} days${before>0?' in space':''}`:''}`:`Crew of ${n} aboard, all well`}}
  // money: what we know line by line; the rest is the days that passed (budget, upkeep, income, debt)
  const M=D.money,add=(l,v,k)=>{if(Math.abs(v)>=0.05)M.push({l,v,k})};
  add('Hardware',-(R.cost||0),'cost');add('Launch operations',-(R.ops||0),'cost');add('Site lease',-(R.siteFee||0),'cost');add('Sponsor covers the failed attempt',R.cover||0,'cover');
  for(const p of R.paid||[]){add(p.k==='contract'?`Contract: ${p.l}`:p.k==='stage'?`${p.l} (share)`:p.l,p.pay,p.k);if(p.k==='mission')D.missions.push({l:p.l,pay:p.pay,first:!!p.first})}
  add(`Refurbishment${R.recovery?` (${R.recovery})`:''}`,R.refund||0,'refund');add('Damages to towns',-(R.dmg||0),'dmg');
  if(b){D.net=PROG.funds-b.funds;const nd=Math.max(0,PROG.day-b.day),L0=b.led||{},L1=PROG.led||{},own=(R.paid||[]).reduce((a,p)=>a+p.pay,0);
    D.days=nd;
    for(const k in LED_L){let v=(L1[k]||0)-(L0[k]||0);if(k==='paid')v-=own;add(k==='upkeep'?`${LED_L[k]} (${nd.toFixed(nd<10?1:0)} days)`:LED_L[k],v,k)}
    const rest=D.net-M.reduce((a,m)=>a+m.v,0);add('Other',rest,'other')}   // (an old save's flight, or money no ledger line names yet)
  // the failures on the way (Q293): for a loss, the chain that led to it and what helps; otherwise incidents
  const F=(R.fails||[]).map(f=>({...f}));
  if(out.k==='lost'){D.loss={chain:F,end:{met:simT,why:s.lossWhy||out.d},help:debHelp(F[0]&&F[0].k,F.length?F[0].why:s.lossWhy)}}
  else for(const f of F)D.incidents.push(`${f.why[0].toUpperCase()+f.why.slice(1)} (T+${debT(f.met)}, ${fmtKm(f.h)})`);
  D.certs=(ups||[]).map(u=>({l:PARTS[u.k]?PARTS[u.k].name:u.k,a:u.a,b:u.b}));
  for(const id of R.newLog||[]){const F=LOGF.find(f=>f.id===id),e=(PROG.log||{})[id];if(F&&e)D.records.push({l:F.label,v:F.fmt(e.v),was:e.hist&&e.hist.length?F.fmt(e.hist[e.hist.length-1]):null})}
  if(b&&PROG.recs&&PROG.recs.orbit!==b.recOrbit&&b.recOrbit!=null)D.records.push({l:'Cheapest trip to orbit',v:`${fmtM(PROG.recs.orbit)} net`,was:fmtM(b.recOrbit)});
  for(const v of R.drops||[]){const pw=v.power,abroad=pw&&pw.i!==HOME,town=v.city?v.city.name:'a town';
    if(v.kind==='city')D.incidents.push(`A stage fell on ${town}${abroad?` (${pw.name})`:''}`);
    else if(v.kind==='near')D.incidents.push(`A stage fell near ${town}${abroad?` (${pw.name})`:''}`);
    else if(abroad)D.incidents.push(`A stage came down in ${pw.name}`)}
  for(const k in R.overK||{}){const c=R.overK[k];D.incidents.push(`Flew low over ${POWERS[k].name}${c>0?`: it protests (opinion −${(OVER_OP*c).toFixed(1)})`:', a friend: no objection'}`)}   // Q181
  if(R.bio&&!R.bioOK)D.incidents.push(`${R.pet} ${R.bioWhy}`);
  if(b)for(const k in PROG.kh||{}){const a=b.kh[k]??use0(k),v=PROG.kh[k].use;if(v>a+0.005)D.kh.push({l:PARTS[k]?PARTS[k].name:k,a,b:v})}
  D.kh.sort((x,y)=>(y.b-y.a)-(x.b-x.a));
  return D}
