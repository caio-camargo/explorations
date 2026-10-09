// sim/contracts.js — contracts, sanctions, the race, ownership, decisions. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- contracts: repeatable, generated work from three sources (science, commercial, government), each client a power.
// Offers arrive over program time and expire; the program holds a few at once (capacity grows with contracts done);
// every accepted contract is checked against every flight, so one well-planned flight can complete several. Pay scales
// with difficulty, the source's standing with us, and (commercial) the business cycle. Government money also arrives
// as a budget every 100 days, scaled by public opinion at home. Firsts (MISSIONS) stay one-time; these never run out.
const SRC={sci:{name:'Science',rate:1/14},com:{name:'Commercial',rate:1/18},gov:{name:'Government',rate:1/30},tour:{name:'Tourism',rate:1/22},mil:{name:'Military',rate:1/35}};
const BOARD_MAX=6,OFFER_LIFE=50,GRANT_100=15;   // M per 100 days at home opinion 50
const capOf=()=>2+Math.min(4,Math.floor((PROG.cdone||0)/3));
const standOf=k=>(PROG.stand||{})[k]??50;
function standAdd(k,d){PROG.stand=PROG.stand||{};PROG.stand[k]=clamp(standOf(k)+d,0,100)}
const kmS=x=>(x/1e3).toFixed(0);
// contract types: who offers them, when they unlock, how they're parameterised, and the check against a flight record
// geography for contracts (terrain session): the land biomes worth a field station, with how far the nearest is from
// the first site (≤ 1,200 km, not the pad's own); and how far the auroral zone (|lat| > 55°) is from it
const AURORA_ALT=1e5,AURORA_LAT=55*Math.PI/180,FIELD_IDS=[1,7,8,10,11,12,13,14];let fieldMemo=null;
function fieldBiomes(){if(fieldMemo)return fieldMemo;const u0=SITES[0].u,own=biomeAt(u0).id,near={};
  for(let k=1;k<=60;k++)for(let a=0;a<24;a++){const id=biomeAt(alongAz(u0,a*Math.PI/12,k*20e3/TELLUS.R)).id;if(near[id]==null)near[id]=k*20}
  fieldMemo=FIELD_IDS.filter(b=>b!==own&&near[b]!=null).map(b=>({b,km:near[b]}));if(!fieldMemo.length)fieldMemo=[{b:own===10?7:10,km:1200}];return fieldMemo}
const polarKm=()=>Math.max(0,AURORA_LAT-Math.asin(Math.abs(SITES[0].u[1])))*TELLUS.R/1e3;
const CT={
  apex:{src:['sci'],gen:R=>{const lo=10*(1+(R()*6|0));return{lo,hi:lo+15,pay:6+lo/5,dur:60+R()*60}},
    title:p=>`Sounding experiment, ${p.lo}–${p.hi} km`,brief:p=>`An instrument package with an apex between ${p.lo} and ${p.hi} km, recovered.`,
    ok:(R,p)=>R.recSci&&R.apexSci>=p.lo*1e3&&R.apexSci<=p.hi*1e3},
  sample:{src:['sci'],gen:R=>{const k=R()*ATM_BANDS|0;return{k,pay:8+3*k,dur:60+R()*60}},
    title:p=>`Air sample, ${p.k*10}–${p.k*10+10} km`,brief:p=>`Bring home an instrument package that flew through the ${p.k*10}–${p.k*10+10} km band.`,
    ok:(R,p)=>R.recSci&&!!R.bands[p.k]},
  test:{src:['com'],gen:R=>{const ks=['sparrow','kestrel','condor','petrel','t2','t4','t8','fins','dec','istage'],k=ks[R()*ks.length|0],q=5*Math.round(3+R()*5);return{k,q,pay:8+q/2,dur:50+R()*60}},
    title:p=>`Qualify the ${PARTS[p.k].name}`,brief:p=>`Fly a ${PARTS[p.k].name} through max-q of ${p.q} kPa or more with an instrument package aboard.`,
    ok:(R,p)=>(R.qPart[p.k]||0)>=p.q*1000},
  landing:{src:['gov'],gen:R=>{const dk=10*(3+(R()*4|0));return{dk,pay:15+(60-dk)/2,dur:60+R()*60}},
    title:p=>`Recovery demonstration`,brief:p=>`Fly above 20 km and land whatever comes back within ${p.dk} km of the pad.`,
    ok:(R,p)=>R.landed&&R.apex>=2e4&&R.landDist<=p.dk*1e3},
  bioHop:{src:['sci','gov'],req:'hop',gen:R=>{const g=5+(R()*3|0);return{g,pay:35+5*(8-g),dur:80+R()*60}},
    title:p=>`Biology flight, under ${p.g} g`,brief:p=>`A biocapsule to space and home safe, never over ${p.g} g (1 s average).`,
    ok:(R,p)=>R.landed&&R.bio&&R.bioOK&&R.bioSpace&&R.gMax<=p.g},
  sat:{src:['com','gov'],req:'beeper',gen:R=>{const alt=10*Math.round(10+R()*30),tol=5*Math.round(3+R()*5),inc=[0,0,15,30,45,90][R()*6|0];
      return{alt,tol,inc,itol:inc?2+(R()*4|0):3,pay:30+alt/12+inc*0.7,dur:90+R()*90}},
    title:p=>`Satellite to ${p.alt} km${p.inc?`, ${p.inc}°`:''}`,brief:p=>`An instrument package in orbit with periapsis and apoapsis within ${p.alt}±${p.tol} km, inclination ${p.inc}±${p.itol}°. Bonus up to 30% for precision.`,
    ok:(R,p)=>{const o=R.orb;return!!o&&o.sci&&o.pe>=(p.alt-p.tol)*1e3&&o.ap<=(p.alt+p.tol)*1e3&&Math.abs(o.inc-p.inc)<=p.itol},
    bonus:(R,p)=>{const o=R.orb,e=Math.max(Math.abs(o.pe/1e3-p.alt),Math.abs(o.ap/1e3-p.alt))/p.tol;return 0.3*clamp(1-e,0,1)}},
  image:{src:['sci','com','gov'],req:'beeper',gen:R=>{const ci=R()*CITIES.length|0,res=[2,3,5,8][R()*4|0];return{ci,res,pay:12+36/res,dur:40+R()*50}},
    title:p=>`${p.dis?p.dis+': ':''}Image ${CITIES[p.ci].name}`,brief:p=>`Photograph ${CITIES[p.ci].name} at ${p.res} m or better, in daylight under clear skies, and downlink it. Needs a satellite with a camera and an antenna in an orbit that passes over.`,
    ok:()=>false},
  // geography (terrain session): land an instrument package on a given kind of ground, or fly one through the auroral zone
  field:{src:['sci'],gen:R=>{const f=fieldBiomes(),x=f[R()*f.length|0];return{b:x.b,km:x.km,pay:Math.round(10+x.km/25),dur:80+R()*60}},
    title:p=>`Field station: ${BIOMES[p.b]}`,brief:p=>`Land an instrument package on ${BIOMES[p.b]} (the nearest is about ${p.km} km from the pad) and recover it.`,
    ok:(R,p)=>R.landed&&R.recSci&&R.landBiome===p.b},
  aurora:{src:['sci'],gen:R=>({lat:AURORA_LAT*180/Math.PI,pay:Math.round(14+polarKm()/40),dur:80+R()*60}),
    title:()=>`Aurora sounding`,brief:p=>`An instrument package above ${AURORA_ALT/1e3} km poleward of ${p.lat}° (from a high-latitude site, or a long lob), recovered.`,
    ok:R=>R.recSci&&!!R.aurora},
  lift:{src:['com','gov'],req:'lift1',gen:R=>{const m=0.5*(2+(R()*7|0));return{m,pay:22*m,dur:90+R()*90}},
    title:p=>`${p.m} t to orbit`,brief:p=>`${p.m} t of mass simulators in a stable orbit.`,ok:(R,p)=>R.lift>=p.m-1e-9},
  // tourism: passengers who paid a lot and expect to come home comfortable
  touristHop:{src:['tour'],req:'hop',gen:R=>{const g=4.5+0.5*(R()*4|0);return{g,pay:55+12*(6.5-g),dur:60+R()*80}},
    title:p=>`Tourist flight to space, under ${p.g} g`,brief:p=>`A biocapsule carrying a paying tourist to space (${(TELLUS.atm/1e3).toFixed(0)} km) and home, never over ${p.g} g (1 s average).`,
    ok:(R,p)=>R.landed&&R.bio&&R.bioOK&&R.bioSpace&&R.gMax<=p.g},
  touristOrbit:{src:['tour'],req:'orbiter',gen:R=>{const g=5+0.5*(R()*3|0);return{g,pay:110+15*(6-g),dur:90+R()*90}},
    title:p=>`Orbital holiday, under ${p.g} g`,brief:p=>`A tourist through one full orbit and home, never over ${p.g} g.`,
    ok:(R,p)=>R.landed&&R.bio&&R.bioOK&&R.bioOrbits>=1&&R.gMax<=p.g},
  // military: well paid, secret, and it may leak (see contractEval)
  recon:{src:['mil'],req:'beeper',gen:R=>{const alt=10*Math.round(11+R()*7),inc=5*Math.round(12+R()*6);return{alt,tol:20,inc,itol:5,pay:(45+inc*0.6)*1.6,dur:90+R()*60}},
    title:p=>`Reconnaissance orbit, ${p.alt} km at ${p.inc}°`,brief:p=>`An instrument package in orbit at ${p.alt}±${p.tol} km, inclination ${p.inc}±${p.itol}°. Classified.`,
    ok:(R,p)=>{const o=R.orb;return!!o&&o.sci&&o.pe>=(p.alt-p.tol)*1e3&&o.ap<=(p.alt+p.tol)*1e3&&Math.abs(o.inc-p.inc)<=p.itol}},
  ballistic:{src:['mil'],req:'weather',gen:R=>{for(let k=0;k<200;k++){const rg=300+R()*600,az=R()*6.2832,a=rg/600,u=[Math.cos(a),Math.sin(a)*Math.sin(az),Math.sin(a)*Math.cos(az)];
      if(!isLand(u))return{u,rg:Math.round(rg),rad:40,pay:(30+rg/15)*1.6,dur:60+R()*60}}return{u:[Math.cos(.8),0,Math.sin(.8)],rg:480,rad:40,pay:70,dur:80}},
    title:p=>`Ballistic test, ${p.rg} km downrange`,brief:p=>`Bring an instrument package down at sea within ${p.rad} km of a target point ${p.rg} km from the pad (marked on the map). Classified.`,
    ok:(R,p)=>!!R.endPf&&R.endSci&&Math.acos(clamp(dot(norm(R.endPf),p.u),-1,1))*TELLUS.R<=p.rad*1e3},
  milLift:{src:['mil'],req:'lift1',gen:R=>{const m=0.5*(2+(R()*5|0));return{m,pay:22*m*1.6,dur:90+R()*60}},
    title:p=>`Classified payload, ${p.m} t`,brief:p=>`${p.m} t of mass simulators to a stable orbit. Nobody asks what they simulate.`,ok:(R,p)=>R.lift>=p.m-1e-9},
};
// ---- sanctions: a power that sanctions the program sends no offers, cancels its contracts and withholds its share of
// budget day until the sanction lapses. Home sanctions too: military work for home's enemies (always found out) and,
// in intense tension (relation < −0.75), commercial work for them (export controls).
const sanctioned=i=>(PROG.sanc||{})[i]>PROG.day;
function sanction(i,days,why){PROG.sanc=PROG.sanc||{};const was=sanctioned(i);PROG.sanc[i]=Math.max(PROG.sanc[i]||0,PROG.day+days);
  PROG.offers=(PROG.offers||[]).filter(o=>o.client!==i);const lost=(PROG.active||[]).filter(c=>c.client===i);PROG.active=(PROG.active||[]).filter(c=>c.client!==i);
  HOOK.news(`${POWERS[i].name} ${was?'extends':'imposes'} sanctions on the program ${why} (${days} days${lost.length?`, ${lost.length} contract${lost.length>1?'s':''} cancelled`:''})`,'bad')}
// who would sanction us for taking an offer: certain (home, at once) or on exposure (the client's enemies, if it leaks)
function offerRisk(c){const out={now:[],leak:[]};
  if(c.src==='mil'){if(c.client!==HOME&&relOf(HOME,c.client)<-0.55)out.now.push(HOME);
    for(const p of POWERS)if(p.i!==c.client&&!out.now.includes(p.i)&&relOf(c.client,p.i)<-0.55)out.leak.push(p.i)}
  else if(c.src==='com'&&c.client!==HOME&&relOf(HOME,c.client)<-0.75)out.now.push(HOME);
  return out}
const LEAK_P=c=>0.25+(c.client!==HOME?0.15:0);
// ---- the race for firsts: rival programs reach the headline firsts on their own schedules (seeded, faster with tech and
// economy). First in the world pays 1.5× and a big boost at home; second pays half.
const RACE=['beeper','hop','orbiter'];
function raceSchedule(){const R=rng(4242),out={};for(const id of RACE)out[id]=null;
  for(const p of POWERS){if(p.i===HOME)continue;const speed=p.tech*Math.sqrt(p.econ)*(0.6+1.6*flav(p.i).pri.prestige);let t=0;
    for(const id of RACE){t+=(100+120*R())/speed;if(!out[id]||t<out[id].day)out[id]={i:p.i,day:Math.round(t)}}}
  return out}
let RIVALS=raceSchedule();
const raceLost=id=>(PROG.raceLost||{})[id]??null;
function raceTick(){PROG.raceLost=PROG.raceLost||{};for(const id of RACE){const r=RIVALS[id];if(!r||PROG.done[id]||PROG.raceLost[id]!=null||PROG.day<r.day)continue;
  PROG.raceLost[id]=r.i;const M=MISSIONS.find(m=>m.id===id);HOOK.news(`${POWERS[r.i].name} gets there first: ${M.name.replace(/^Passenger: /,'')}!`,relOf(HOME,r.i)<0?'bad':'warn');if(relOf(HOME,r.i)<0)opAdd(HOME,-4*natK())}}
// a client for a source: science and commerce come from any power (weighted by economy), government from home
function pickClient(src,R){if(src==='mil'&&R()<0.6)return HOME;
  if(src==='gov'){const st=own().st,ks=Object.keys(st);if(!ks.length)return HOME;let x=R()*ks.reduce((a,k)=>a+st[k],0);for(const k of ks){x-=st[k];if(x<=0)return+k}return+ks[0]}let t=0;for(const p of POWERS)t+=p.econ;let x=R()*t;for(const p of POWERS){x-=p.econ;if(x<=0)return p.i}return HOME}
function genOffer(src,R){const types=Object.keys(CT).filter(k=>CT[k].src.includes(src)&&(!CT[k].req||PROG.done[CT[k].req]));if(!types.length)return null;
  const type=types[R()*types.length|0],p=CT[type].gen(R),mult=0.7*(0.8+0.4*standOf(src)/100)*(src==='com'?(1+0.35*(PROG.cycle||0))*(1+0.15*own().pv):1);
  p.pay=Math.round(p.pay*mult*10)/10;PROG.cseq=(PROG.cseq||0)+1;
  const client=pickClient(src,R);if(sanctioned(client))return null;p.pay=Math.round(p.pay*(0.7+1.2*flav(client).pri[PRI_OF[src]])*10)/10;   // clients pay for what they care about
  return{id:PROG.cseq,type,src,client,p,posted:PROG.day,expires:PROG.day+OFFER_LIFE}}
function ensureBoard(){if(PROG.offers)return;PROG.offers=[];PROG.active=PROG.active||[];const R=rng(PROG.wseed^0x5eed);for(const k of['sci','sci','com','gov']){const o=genOffer(k,R);if(o)PROG.offers.push(o)}}
const cTitle=c=>CT[c.type].title(c.p),cBrief=c=>CT[c.type].brief(c.p);
function acceptOffer(id){ensureBoard();const i=PROG.offers.findIndex(o=>o.id===id);if(i<0||PROG.active.length>=capOf())return false;
  const c=PROG.offers.splice(i,1)[0];c.deadline=PROG.day+c.p.dur;PROG.active.push(c);
  if(offerRisk(c).now.includes(HOME))sanction(HOME,c.src==='mil'?250:120,c.src==='mil'?`for military work for ${POWERS[c.client].name}`:`under export controls on ${POWERS[c.client].name}`);
  if(c.client!==HOME&&relOf(HOME,c.client)<-0.55&&(own().st[HOME]||0)>0.1){opAdd(HOME,-4*natK()*(own().st[HOME]||0));HOOK.news(`Opposition asks why the space program is working for ${POWERS[c.client].name}`,'warn')}
  HOOK.save();return true}
function declineOffer(id){ensureBoard();PROG.offers=PROG.offers.filter(o=>o.id!==id);HOOK.save()}
function contractEval(s){if(!PROG.active||!PROG.active.length)return;const R=s.rec;
  for(let i=PROG.active.length-1;i>=0;i--){const c=PROG.active[i];if(!c)continue;const T=CT[c.type];if(!T.ok(R,c.p,s))continue;   // a leak's sanctions can shrink the list mid-loop
    const bonus=T.bonus?T.bonus(R,c.p):0,pay=c.p.pay*(1+bonus)*(c.src==='sci'?khYield():1);PROG.active.splice(i,1);income(pay);debPaid(R,'contract',cTitle(c),pay);PROG.cdone=(PROG.cdone||0)+1;
    standAdd(c.src,5);opAdd(c.client,3);if(c.client!==HOME)opAdd(HOME,1.2-2*natOf(HOME));R.cdone.push(cTitle(c));if(pay>=40)R.bigContract=true;
    if(c.src==='mil'&&rng((PROG.wseed^(c.id*2654435761))>>>0)()<LEAK_P(c)){opAdd(HOME,c.client===HOME?-3:-8);
      HOOK.news(`Leak: the space program flew a secret payload for ${POWERS[c.client].name}`,'bad');for(const j of offerRisk(c).leak){opAdd(j,-15);sanction(j,200,`after the leak`)}}
    HOOK.news(`Contract done for ${POWERS[c.client].name}: ${cTitle(c)} (+${fmtM(pay)}${bonus>0.005?`, ${(bonus*100).toFixed(0)}% precision bonus`:''})`,'ok');HOOK.msg(`Contract complete: ${cTitle(c)}`);HOOK.save()}}
// between flights: the business cycle turns, offers arrive and expire, deadlines pass, the budget comes in
function econTick(d,R){ensureBoard();standTick();devTick();facTick();compTick();dispatchTick();
  if(PROG.flights>0){PROG.funds-=(OVERHEAD+OVERHEAD_CAP*capOf())*d;   // running the program, from its first launch on (more as it grows)
    floorCheck()}   // between flights too: with running costs, a program that can't fly would otherwise bleed with no rescue
  PROG.bailRecent=(PROG.bailRecent||0)*Math.exp(-d/300);   // top-ups fade from memory
  const c0=PROG.cycle||0;PROG.cyc=(PROG.cyc??R()*6.28)+d*6.2832/700+(R()-.5)*0.15*Math.sqrt(d/10);PROG.cycle=clamp(0.75*Math.sin(PROG.cyc)+(R()-.5)*0.1,-1,1);
  if(c0<0.45&&PROG.cycle>=0.45)HOOK.news('Boom times: satellite operators are hiring launches again','ok');
  if(c0>-0.45&&PROG.cycle<=-0.45)HOOK.news('Recession bites: commercial launch orders dry up','warn');
  for(const k in SRC){const rate=SRC[k].rate*(0.4+2.4*flav(HOME).pri[PRI_OF[k]])*(0.6+0.8*standOf(k)/100)*(k==='com'?(1+0.5*PROG.cycle)*(0.8+0.6*own().pv):k==='gov'?0.3+1.2*stateShare():k==='tour'?(standOf('tour')/50)**2:1),n=Math.min(4,Math.floor(rate*d+R()));
    for(let j=0;j<n&&PROG.offers.length<BOARD_MAX;j++){const o=genOffer(k,R);if(o)PROG.offers.push(o)}}
  PROG.offers=PROG.offers.filter(o=>o.expires>PROG.day);
  for(let i=PROG.active.length-1;i>=0;i--){const c=PROG.active[i];if(c.deadline>PROG.day)continue;PROG.active.splice(i,1);standAdd(c.src,-10);opAdd(c.client,-3);
    HOOK.news(`Missed deadline: ${cTitle(c)} for ${POWERS[c.client].name}`,'bad')}
  const q0=Math.floor((PROG.day-d)/100),q1=Math.floor(PROG.day/100);
  for(let q=q0;q<q1;q++)budgetDay();
  flavTick(d,R);decisionTick(d,R);cancelTick();raceTick()}
// ---- ownership: what the program is. Shares that sum to 1: state stakes by power (st) and private capital (pv).
// Everything scales with the shares, so a part-privatized agency sits between the archetypes:
//  · budget day comes from each state shareholder, by its stake and its opinion of us; private capital pays nothing
//  · government offers follow the state shareholders; commercial offers and pay grow with the private share
//  · working for a rival of home costs home opinion only in proportion to home's stake
//  · below the floor, a mostly-state program is topped up (repeated top-ups take private stakes for the state); a mostly
//    private one gets a decision: a state rescue for equity, or an investor loan repaid from half of all income
// Changes arrive as between-flight decisions (privatization, a foreign stake, a rescue) that expire if ignored.
const START={
  agency:{name:'National agency',blurb:'Funded by your government: budget days, a safety net, more government work. Opinion at home is everything.',funds:80},
  company:{name:'Private company',blurb:'Investor capital: more cash up front and more commercial work, no budget day and no safety net, little political flak.',funds:90},
  consortium:{name:'Transnational consortium',blurb:'Home and its two friendliest neighbours share the program and its budget. Their opinions all count.',funds:80}};
const own=()=>PROG.own||(PROG.own={kind:'agency',st:{[HOME]:1},pv:0,chosen:false});
const stateShare=()=>Object.values(own().st).reduce((a,x)=>a+x,0);
function chooseStart(kind){const o={kind,st:{},pv:0,chosen:true,debt:0};
  if(kind==='agency')o.st[HOME]=1;else if(kind==='company')o.pv=1;
  else{const fr=POWERS.filter(p=>p.i!==HOME).sort((a,b)=>relOf(HOME,b.i)-relOf(HOME,a.i)).slice(0,2);o.st[HOME]=0.4;for(const p of fr)o.st[p.i]=0.3}
  PROG.own=o;PROG.funds=START[kind].funds;PROG.decisions=[];HOOK.save()}
function progName(){const o=own(),H=POWERS[HOME];if(o.name)return o.name;return o.kind==='company'?`${H.root} Aerospace`:o.kind==='consortium'?'Joint Space Organisation':`${H.root} Space Agency`}
function ownKind(){const o=own(),ss=stateShare(),top=Object.entries(o.st).sort((a,b)=>b[1]-a[1])[0];
  return o.pv>=0.5?(ss>0?'company with a state stake':'private company'):top&&top[1]>=0.5?(o.pv>0?'agency, part-privatized':'national agency'):'consortium'}
// move a share from everyone else, pro rata, to `to` (a power index, or 'pv')
function shiftShare(to,amt){const o=own(),get=k=>k==='pv'?o.pv:(o.st[k]||0),set=(k,v)=>{if(k==='pv')o.pv=v;else if(v>1e-9)o.st[k]=v;else delete o.st[k]};
  const others=[...Object.keys(o.st).map(Number),'pv'].filter(k=>k!==to&&get(k)>0),tot=others.reduce((a,k)=>a+get(k),0);amt=Math.min(amt,tot);
  for(const k of others)set(k,get(k)-amt*get(k)/tot);set(to,get(to)+amt)}
function income(x){const o=own();if(o.debt>0){const r=Math.min(o.debt,x/2);o.debt-=r;x-=r}PROG.funds+=x}
const valuation=()=>80+40*Object.keys(PROG.done).length+6*(PROG.cdone||0);   // what investors think the program is worth (M)
// how a power's money arrives (multiplies GRANT_100 × stake): its money axis, opinion where it matters, the cycles
// the Assembly panel's study line: what this design's predictions are worth, and the office
function studyLine(s){const E=COMP_ERAS[compEra()];if(!E.err[0])return'';const st=studyOf(s),j=studyJob(s),q=studyQuote(s);
  return`<div class="dim" style="margin-top:4px">Trajectory: `+(st?`studied, predictions ±${Math.round(predErr(s)*100)}%`:j?`in the office, ready in ${Math.ceil(studyWait(s))} d (a launch waits for it)`:
    `unstudied, predictions ±${Math.round(E.err[0]*100)}% <button data-study="1" ${q.ok&&PROG.funds>=q.cost?'':'disabled'}>Study ${fmtM(q.cost)}, ${Math.ceil(q.days)} d → ±${Math.round(q.err*100)}%</button>`)+`</div>`}
function knowhowLine(parts){const ks=[...new Set(parts.map(p=>p.d.key))].filter(k=>khUse(k)<0.35).sort((a,b)=>khUse(a)-khUse(b));
  return ks.length?`<div class="sub warn">New to us: ${ks.slice(0,4).map(k=>`${PARTS[k].name} (know-how ${(khBar(k)*100).toFixed(0)}%)`).join(', ')}${ks.length>4?'…':''}: riskier ignitions, slower checkout</div>`:''}
function importsLine(parts){const by={};for(const k of new Set(parts.map(p=>p.d.key))){const x=sourceOf(k);if(x.how==='home'||x.how==='line')continue;const w=x.how==='grey'?'grey market ×3':`${POWERS[x.from].root} ×${IMPORT_K}`;(by[w]=by[w]||[]).push(PARTS[k].name)}
  const e=Object.entries(by);return e.length?`<div class="sub ${by['grey market ×3']?'bad':'dim'}">Imports: ${e.map(([w,n])=>`${n.join(', ')} (${w})`).join(' · ')}</div>`:''}
function moneyK(i){const F=flav(i),op=opOf(i)/50,home=i===HOME;let k;
  if(F.money==='commodity')k=(0.6+0.4*op)*(1+0.8*(PROG.comm||0));
  else if(F.money==='patronage')k=0.5*op;
  else if(F.money==='military')k=0.7*(1+tensionOf(i));
  else k=op*(1+0.25*(PROG.cycle||0));
  if(F.grow)k*=Math.min(2,1+PROG.day/800);
  return Math.max(0,k*(home?(PROG.bmult??1):1))}
function budgetDay(){const o=own();let g=0;const parts=[];
  for(const k in o.st){if(sanctioned(+k))continue;const i=+k,x=GRANT_100*o.st[k]*Math.sqrt(POWERS[i].econ/POWERS[HOME].econ)*moneyK(i);g+=x;parts.push(`${POWERS[i].root} ${fmtM(x)}`)}
  if(g<=0)return;PROG.funds+=g;
  HOOK.news(Object.keys(o.st).length>1?`Budget day: members contribute ${fmtM(g)} (${parts.join(', ')})`:
    `Budget day: ${POWERS[+Object.keys(o.st)[0]].name} allocates ${fmtM(g)} to the space program${opOf(HOME)>60?' (and applauds)':opOf(HOME)<40?' (through gritted teeth)':''}`,g>=GRANT_100*stateShare()?'ok':'warn')}
function floorCheck(){if(PROG.funds>=FUNDS_FLOOR)return;const o=own();
  if(stateShare()>=0.5){const k=+Object.entries(o.st).sort((a,b)=>b[1]-a[1])[0][0];PROG.bailouts=(PROG.bailouts||0)+1;PROG.bailRecent=(PROG.bailRecent||0)+1;
    HOOK.news(`${POWERS[k].name} grudgingly tops up the space program (${fmtM(PROG.funds)} → ${fmtM(FUNDS_FLOOR)})`,'warn');PROG.funds=FUNDS_FLOOR;opAdd(k,-2);
    if(PROG.bailouts>2&&o.pv>0){shiftShare(k,Math.min(o.pv,0.1));HOOK.news(`…and this time it takes a bigger stake: ${POWERS[k].root} now owns ${(o.st[k]*100).toFixed(0)}%`,'warn')}return}
  if(!(PROG.decisions||[]).some(d=>d.kind==='rescue'))offerDecision(rescueDecision())}
// ---- decisions: offers that wait for an answer between flights
function offerDecision(d){if(!d)return;PROG.decisions=PROG.decisions||[];PROG.dseq=(PROG.dseq||0)+1;d.id=PROG.dseq;d.expires=PROG.day+(d.life||40);PROG.decisions.push(d);
  HOOK.news(`Offer: ${d.title}`,'warn');HOOK.save()}
function rescueDecision(){const fr=POWERS.slice().sort((a,b)=>(opOf(b.i)+30*relOf(HOME,b.i))-(opOf(a.i)+30*relOf(HOME,a.i)))[0],need=FUNDS_FLOOR-PROG.funds;
  return{kind:'rescue',power:fr.i,life:60,title:`${fr.name} offers a rescue`,
    text:`Funds are below ${fmtM(FUNDS_FLOOR)}. ${fr.name} will put in ${fmtM(need+30)} for a 30% stake and a board seat. Or investors lend ${fmtM(need)}, to be repaid ×1.3 from half of all future income.`,
    opts:[['stake','Take the stake'],['loan','Take the loan']]}}
function decisionTick(d,R){const o=own();PROG.decisions=(PROG.decisions||[]).filter(x=>x.expires>PROG.day);
  const has=k=>PROG.decisions.some(x=>x.kind===k),firsts=Object.keys(PROG.done).length,V=valuation();
  // investors circle an established public program
  if(!has('ipo')&&stateShare()>=0.4&&firsts>=2&&R()<1-Math.exp(-d/350)){const amt=Math.round(V*0.25);
    offerDecision({kind:'ipo',amt,title:`Investors offer ${fmtM(amt)} for a 25% stake`,text:`A privatization: cash now, more commercial work and freedom, a smaller budget day. ${POWERS[HOME].align[0]>0?'The market-minded public would approve.':'Many at home will call it selling the family silver.'}`,
      opts:[['yes','Sell the stake'],['no','Decline']]})}
  // a friendly power wants in
  const fr=POWERS.filter(p=>p.i!==HOME&&relOf(HOME,p.i)>0.25&&(o.st[p.i]||0)<0.3);
  if(!has('stake')&&fr.length&&firsts>=1&&R()<1-Math.exp(-d/500)){const p=fr[R()*fr.length|0],amt=Math.round(V*0.15);
    offerDecision({kind:'stake',power:p.i,amt,title:`${p.name} offers ${fmtM(amt)} for a 15% stake`,text:`Their money and a share of their budget days, plus their contracts. Their rivals will notice, and so will opinion at home.`,
      opts:[['yes','Welcome them aboard'],['no','Decline']]})}
  // career moves: when things go badly (a hail mary) or very well (a step up), the team itself gets offers
  const bad=badness(),good=firsts>=5&&opOf(HOME)>60&&!bad;
  if(!has('defect')&&!has('hire')&&(bad||good)&&R()<1-Math.exp(-d*(bad?bad/150:1/900))){
    if(R()<0.5){const sc=p=>p.econ*p.tech*opOf(p.i)*(flav(p.i).money==='commodity'?1.6:1),c=POWERS.filter(p=>p.i!==HOME&&relOf(HOME,p.i)<0.2&&!sanctioned(p.i)).sort((a,b)=>sc(b)-sc(a))[0];
      if(c){const amt=Math.round(40+V*(good?0.5:0.3));
        offerDecision({kind:'defect',power:c.i,amt,life:30,title:`${c.name} wants your whole team`,
          text:`${good?'They have watched your program and want it for themselves':'Things are going badly at home, and they have noticed'}: defect, and the program becomes theirs, with ${fmtM(amt)} to start. What the team knows comes along (certified parts, the air, everything flown). ${POWERS[HOME].name} will not forgive it.`,
          opts:[['yes',`Defect to ${c.root}`],['no','Stay']]})}}
    else{const nm=`${SYL[R()*SYL.length|0]}${SYL[R()*SYL.length|0]}`,co=nm[0].toUpperCase()+nm.slice(1)+[' Orbital',' Dynamics',' Launch Systems',' Rocketworks'][R()*4|0],amt=Math.round(50+V*(good?0.45:0.25));
      offerDecision({kind:'hire',co,amt,life:30,title:`${co} offers to hire the team`,
        text:`A private company buys the program outright: ${fmtM(amt)} of capital${own().debt>0?', the debts paid off':''}, no budget day, no government to answer to. What the team knows comes along. ${POWERS[HOME].name} will call it a brain drain.`,
        opts:[['yes',`Join ${co}`],['no','Decline']]})}}}
// how badly the program is doing: each of these counts once
function cancelTick(){if(!PROG.cancelled||(PROG.decisions||[]).some(x=>x.kind==='defect'||x.kind==='hire'))return;
  careerMove({kind:'hire',co:`${POWERS[HOME].root} Space Collective`,amt:Math.max(10,PROG.funds)})}
function badness(){const o=own();return((PROG.bailRecent||0)>=1.5?1:0)+(opOf(HOME)<35?1:0)+(sanctioned(HOME)?1:0)+((o.debt||0)>0?1:0)+(PROG.funds<FUNDS_FLOOR?1:0)}
// the program changes hands. Knowledge (certified ratings, the atmosphere, firsts flown, contract record) carries over;
// money, ownership and government standing don't. A defection moves "home": every HOME-relative rule (budget day,
// government work, drop incidents, ground stations, the race) follows. The pad itself stays where it is for now, flying
// under lease (launch sites belong to the terrain work).
function careerMove(d){const old=HOME,o=own();PROG.history=PROG.history||[];
  if(d.kind==='defect'){const j=d.power;PROG.history.push({day:PROG.day,from:progName(),move:`defected to ${POWERS[j].name}`});
    HOME=j;PROG.home=j;PROG.own={kind:'agency',st:{[j]:1},pv:0,chosen:true,debt:0};PROG.funds=d.amt;PROG.bailouts=0;
    PROG.op[old]=10;PROG.rel[pairKey(old,j)]=clamp(relOf(old,j)-0.3,-1,1);opAdd(j,15*(1.3-natOf(j)));PROG.cancelled=false;PROG.bmult=1;for(const p of POWERS)if(p.i!==j&&p.i!==old)opAdd(p.i,-5);
    standAdd('gov',-100);standAdd('gov',50);RIVALS=raceSchedule();
    HOOK.news(`DEFECTION: the space program's team crosses over to ${POWERS[j].name}`,'bad');sanction(old,400,'after the defection')}
  else{PROG.history.push({day:PROG.day,from:progName(),move:`hired by ${d.co}`});
    PROG.own={kind:'company',st:{},pv:1,chosen:true,debt:0,name:d.co};PROG.funds=d.amt;PROG.bailouts=0;opAdd(HOME,-8*natK());PROG.cancelled=false;PROG.bmult=1;standAdd('gov',-20);
    PROG.active=(PROG.active||[]).filter(c=>c.src!=='gov');HOOK.news(`${d.co} hires the whole space program; ${POWERS[HOME].name} calls it a brain drain`,'warn')}}
function resolveDecision(id,key){const i=(PROG.decisions||[]).findIndex(x=>x.id===id);if(i<0)return false;const d=PROG.decisions.splice(i,1)[0],o=own();
  if(d.kind==='rescue'){const need=Math.max(0,FUNDS_FLOOR-PROG.funds);
    if(key==='stake'){shiftShare(d.power,0.3);PROG.funds+=need+30;opAdd(d.power,4);HOOK.news(`${POWERS[d.power].name} takes 30% of the program`,'warn')}
    else{o.debt=(o.debt||0)+need*1.3;PROG.funds+=need;HOOK.news(`Investors lend ${fmtM(need)}; ${fmtM(o.debt)} to repay from future income`,'warn')}}
  else if(d.kind==='ipo'&&key==='yes'){shiftShare('pv',0.25);PROG.funds+=d.amt;opAdd(HOME,POWERS[HOME].align[0]>0?3:-5);HOOK.news(`Privatization: 25% of the program sold for ${fmtM(d.amt)}`,'ok')}
  else if((d.kind==='defect'||d.kind==='hire')&&key==='yes')careerMove(d);
  else if(d.kind==='stake'&&key==='yes'){shiftShare(d.power,0.15);PROG.funds+=d.amt;opAdd(HOME,-2*natK());
    for(const p of POWERS)if(p.i!==d.power&&p.i!==HOME&&relOf(d.power,p.i)<-0.2)opAdd(p.i,-6);HOOK.news(`${POWERS[d.power].name} buys 15% of the program`,'ok')}
  HOOK.save();return true}
