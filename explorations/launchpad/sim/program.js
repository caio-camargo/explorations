// sim/program.js — missions, budget, calendar, tester menu, out there, staged pay, powers, industry, know-how, test stand, development, facilities, compute, timeline, dispatch, deviation, production. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- the program: missions, and what the program knows. Two kinds of knowledge are earned by flying:
//  · certified part ratings: the builder judges joints against a rating that starts at 70 % of the true one (the
//    physics always uses the true one). The 30 % is the engineers' reserve for what they don't know. Every flight that
//    carries an instrument package telemeters strain on every part aboard, and the reserve shrinks: by up to half per
//    flight, in proportion to how hard the part was loaded (40 % of its rating or more counts fully). The certified
//    rating approaches the truth and never passes it. A failure reveals the true rating outright.
//  · the atmosphere: each 10 km band carries ±25 % density uncertainty until a recovered instrument package sampled it,
//    and the impact predictor shows that as a landing spread (range safety uses the whole spread).
// Mission checks only read the flight record, so ticking them never changes a flight: tapes replay identically.
// ---- the budget (millions of credits, "M": an Orbiter launch ≈ 50M, near real small launchers). Launches are paid for; whatever lands intact at the end of a flight is
// refurbished for 80 % of its dry price; missions pay on completion; stages dropped on towns cost damages. Below a floor
// the government tops the program up (grudgingly): no dead ends, but money still decides what you can fly next.
const PRICE={cone:1,chute:2,pod:12,t1:1.5,t2:2.5,t4:4,t8:7,shield:3,dec:1,istage:1.5,adapt:3,rdec:1,fins:1.5,wren:5,sparrow:4,petrel:10,
  kestrel:12,condor:25,sci:6,bio:10,ballast:0.5,cam:8,ant:3,T16:10,T32:18,dec25:3,fins25:4,cone25:3,albatross:40};
PRICE.crew=30;PRICE.les=6;   // bodies session: crew capsule, escape tower
PRICE.rfin=0.4;PRICE.rwheel=5;PRICE.spin=1;PRICE.cfin=1.2;PRICE.cfins=4.5;PRICE.cfins25=11;PRICE.rcs=1.5;PRICE.gas=0.8;PRICE.port=3;PRICE.claw=4;PRICE.core=6;PRICE.bay=6;PRICE.rport=4;PRICE.hab=25;PRICE.lab=30;PRICE.arm=12;PRICE.beacon=2;   // sats session: an RCS quad, a gas bottle   // builder session: one radial fin (a ring of four costs 1.5)
const OPS_FIX=3,OPS_FRAC=0.1,OVERHEAD=0,OVERHEAD_CAP=0;   // per launch: range, tracking, crews (M + share of the vehicle); per day: running the program (M,
// + per unit of capacity). Zero since v1.41 (Caio: idle time roughly neutral, no upkeep); was 0.06 + 0.015·capacity
const FUEL_PRICE=0.2,REFURB=0.65,TOUCH_OK=6,FUNDS0=60,FUNDS_FLOOR=25,DAMAGE={city:40,near:8};
const partPrice=p=>(PRICE[p.d.key]??3)*sourceOf(p.d.key).k*devPriceK(p.d.key)+[0,.5,1.5][p.jr||0]*((p.parent?Math.min(p.d.r,p.parent.d.r):p.d.r)/R0)**2;
// what a vessel costs to fly (parts + fuel), and what of it comes back if every part listed lands intact
// Refurbishment is pegged to what each part went through: its peak load against its true rating (fatigue above 50 %),
// its peak skin temperature against its limit (above 50 %), and the touchdown speed (above 6 m/s). 1 = good as new.
// Tracking is one comparison per part per step: the structure and heat passes already computed the numbers.
const wearOf=(p,touch)=>{const dk=1-0.25*(p.d?devLv(p.d.key,'dur'):0);return(1-0.7*dk*clamp(((p.wL||0)-.5)/.5,0,1))*(1-0.7*dk*clamp(((p.wT||0)-.5)/.5,0,1))*clamp(1-(touch-TOUCH_OK)/6*0.6,0.4,1)};   // durability development: wear ×0.75 per level
function vesselCost(parts){let c=0,dry=0;for(const p of parts){const q=partPrice(p);c+=q+(p.cap.fuel||0)*FUEL_PRICE;dry+=q}return{cost:c,dry}}
const fmtM=k=>(k<0?'−':'')+Math.abs(k).toFixed(Math.abs(k)<10?1:0)+'M';
const PROG={done:{},cert:{},atm:{},streak:0,flights:0,funds:FUNDS0,day:0,wseed:12345,rel:{},op:{}};
// ---- the program calendar, in Tellus days (8 h, one turn of the planet). Stacking a rocket takes days (bigger, longer);
// flying takes its flight time; the world moves on in between: relations drift, opinion fades back toward neutral.
const DAY_S=2*Math.PI/TELLUS.rot,YEAR_D=400,prepDays=cost=>5+cost/2;
const fmtDate=d=>`Year ${1+Math.floor(d/YEAR_D)}, day ${1+Math.floor(d%YEAR_D)}`;
function advanceDays(d){if(!(d>0))return;const T0=PROG.day*DAY_S;PROG.day+=d;worldTick(d);moonOrbTick(PROG.day*DAY_S);rvFieldTick(T0,PROG.day*DAY_S);rvFieldSci(T0,PROG.day*DAY_S);seisTick(T0,PROG.day*DAY_S)}
// ---- the tester menu (tester session; PLAYTEST #1). Cheats for playtesting, all off unless the page is opened with ?tester;
// then the program saves to its own slot (PROG_KEY), so a real career is never read or written. Each flag is read in one
// place: money → testTopUp (the frame loop and testAdvance call it), kh → khUse/certOf, tools → toolOK, nofail → igniteOK,
// fast → the stacking days in missionTick. Epochs, the date and finishing jobs are actions, not flags.
const TEST={on:false,money:false,kh:false,tools:false,nofail:false,fast:false},TEST_FUNDS=1e5;
function testTopUp(){if(TEST.on&&TEST.money&&!(PROG.funds>=TEST_FUNDS))PROG.funds=TEST_FUNDS}
// an epoch's missions open when the earlier epochs are done: mark those done (flagged test:true) and clear any later ones
function testEpoch(n){for(const M of MISSIONS){const d=PROG.done[M.id];
    if(M.ep<n&&!d)PROG.done[M.id]={flight:PROG.flights,day:PROG.day,test:true};else if(M.ep>=n&&d)delete PROG.done[M.id]}
  if(n>1)PROG.streak=Math.max(PROG.streak||0,3)}
// the world date moves a day at a time, so every daily rule (budget, elections, news, rivals, eras) runs as in play
function testAdvance(days){const end=PROG.day+days;while(PROG.day<end-1e-9){advanceDays(Math.min(1,end-PROG.day));testTopUp()}}
// every job in progress (facility, design bureau, test stand, production line, trajectory study) finishes now
function testFinishJobs(){const D=PROG.day;for(const id in PROG.fac||{}){const b=PROG.fac[id].building;if(b)b.ready=D}
  if(PROG.devJob)PROG.devJob.end=D;const S2=PROG.stand2;if(S2){S2.ready=Math.min(S2.ready,D);if(S2.job)S2.job.end=D}
  for(const k in PROG.lines||{}){const L=PROG.lines[k];if(L.ready>D)L.ready=D}for(const j of PROG.studyQ||[])j.end=D;
  advanceDays(1e-6)}
const TOURISTS=['a retired dentist','a lottery winner','a famous chef','an influencer','a philosophy professor','a very excited grandmother','a pop star','a shipping magnate'];
const CERT0=0.7,G_LIM=8,CABIN_MAX=330,AIR_S=4*3600,PETS=['Biscuit','Pickles','Comet','Mitzi','Noodle','Major Tom','Pepper','Dumpling'];
const certOf=k=>TEST.kh?1:Math.min(1,PROG.cert[k]??cert0(k));   // (tester: fully certified)
const ATM_BANDS=Math.ceil(TELLUS.atm/1e4),BANDS=[...Array(ATM_BANDS).keys()];
const atmU=h=>{const k=Math.floor(h/1e4);return k>=0&&k<ATM_BANDS&&!PROG.atm[k]?0.25:0};
const NYX_TRACK_H=12,TV_RATE=0.4,NAV_MIN=0.95,NAV_WAIT=1800;
const STAT_R=Math.cbrt(TELLUS.mu*(DAY_S/(2*Math.PI))**2);   // stationary orbit radius (a day-long period)   // hours of tracking where Nyx's pull matters, to weigh it (bodies session)
const MISSIONS=[
  {id:'weather',pay:15,ep:1,name:'Above the weather',brief:'Fly an instrument package above 10 km and bring it home under a parachute.',
   win:'first data from above the clouds',ok:R=>R.recSci&&R.apex>=1e4},
  {id:'air',pay:25,ep:1,name:'Measure the air',brief:'Recover instrument packages that sampled every 10 km band up to 40 km. Each band sampled narrows the impact predictor.',
   win:'the lower atmosphere is mapped',ok:()=>[0,1,2,3].every(k=>PROG.atm[k]),prog:()=>`${[0,1,2,3].filter(k=>PROG.atm[k]).length}/4 bands`},
  {id:'loads',pay:20,ep:1,name:'Structural test flight',brief:'Take an instrument package through max-q of 25 kPa or more (the design case the builder checks). It takes a punchy rocket.',
   win:'the engineers finally have numbers',ok:R=>R.sciQ>=25000},
  {id:'range',pay:30,ep:1,name:'Range certification',brief:'Three flights in a row that drop stages, with every one landing clear of towns.',
   win:'the range is certified for bigger rockets',ok:()=>PROG.streak>=3,prog:()=>`${PROG.streak}/3 clean flights`},
  {id:'beeper',pay:60,ep:2,req:['weather'],name:'The beeper',brief:`Put an instrument package into a stable orbit (periapsis above ${(TELLUS.atm/1e3).toFixed(0)} km). The whole world will be listening.`,
   win:'something of ours goes round the world',ok:R=>R.orbitSci},
  {id:'hop',pay:50,ep:2,req:['loads'],name:'Passenger: the hop',brief:`A biocapsule to space (${(TELLUS.atm/1e3).toFixed(0)} km) and home safe: under ${G_LIM} g (1 s average), cabin under ${CABIN_MAX} K. Flight safety only approves designs whose joints are within their certified ratings.`,
   win:'the passenger is fine, and very famous',ok:R=>R.landed&&R.bioOK&&R.bioSpace&&R.approved},
  {id:'orbiter',pay:100,ep:2,req:['hop'],name:'Passenger: one orbit',brief:`A biocapsule through one full orbit and home safe, within ${AIR_S/3600} h of air. Same flight-safety rules.`,
   win:'a passenger has gone round the world and come home',ok:R=>R.landed&&R.bioOK&&R.bioOrbits>=1&&R.approved},
  {id:'lift1',pay:40,ep:2,req:['beeper'],name:'Heavy lift I',brief:'Half a tonne of mass simulators in a stable orbit.',win:'0.5 t in orbit',ok:R=>R.lift>=0.5-1e-9},
  {id:'lift2',pay:80,ep:2,req:['lift1'],name:'Heavy lift II',brief:'Two tonnes of mass simulators in a stable orbit.',win:'2 t in orbit, a record',ok:R=>R.lift>=2-1e-9},
  // epoch 3, utility (bodies session): satellites that do a job. Flight missions read outThere(); world ones (world:true)
  // are checked between flights by utilTick(), from the registry.
  {id:'wxsat',pay:80,ep:3,req:['beeper'],name:'Weather satellite',brief:'A camera and an antenna in a stable polar orbit (inclined 80–100°), so every latitude passes under it. From an equatorial pad that means paying for the plane change.',
   win:'the whole planet\'s weather, every day',ok:R=>R.weather},
  {id:'tv',pay:120,ep:3,req:['beeper'],name:'TV for the capital',brief:`An antenna in a stationary orbit (period one day to 0.2 %, nearly circular, under 2° inclination, ${(STAT_R/1e3-TELLUS.R/1e3).toFixed(0)} km up) at least 15° up in the capital's sky. It pays ${TV_RATE}M a day for as long as it stays there.`,
   win:'the capital watches the launch on TV',ok:R=>R.tv},
  {id:'diswatch',pay:60,ep:3,req:['wxsat'],world:true,name:'Disaster watch',brief:'Deliver pictures of a disaster within 12 hours of the call (take the job, and have a camera satellite with an antenna up, and a ground station it can reach).',
   win:'pictures before the evening news',ok:()=>false,okW:()=>(PROG.disDone||[]).some(x=>x.t-x.posted*DAY_S<=12*3600)},
  {id:'nav',pay:150,ep:3,req:['tv'],world:true,name:'Navigation constellation',brief:`Transit-style navigation: a position fix from one satellite's pass. Put up enough satellites with antennas that from anywhere on Tellus, at any moment, one will pass at least 10° up within half an hour (${NAV_MIN*100}% of places and moments).`,
   win:'nobody need ever be lost again',ok:()=>false,okW:()=>navCover(PROG.day*DAY_S)>=NAV_MIN,prog:()=>PROG.navCov!=null?`${(PROG.navCov*100).toFixed(0)}% covered`:''},
  // epochs 4–5, "out there" (bodies session): the Selene ladder, then Nyx. outThere() below reads them off the flight.
  {id:'farside',pay:230,ep:4,req:['beeper'],name:'The far side',brief:'Photograph the sunlit far side of Selene (a camera, within three Selene radii) and get the pictures home. Selene blocks the radio while you are behind it: downlink once Tellus is back in sight (antenna), or bring the camera home.',
   win:'the first pictures of a side nobody has seen',ok:R=>R.farSent},
  {id:'selimp',pay:230,ep:4,req:['farside'],name:'Impactor',brief:'Crash an instrument package with an antenna into Selene, on the side facing Tellus, so it is heard to the last second.',
   win:'telemetry to the very end, then silence',ok:R=>R.selImpact},
  {id:'selland',pay:250,ep:4,req:['selimp'],name:'Soft landing on Selene',brief:'Land an instrument package with an antenna on Selene, under 4 m/s, on the side facing Tellus so it can phone home.',
   win:'a machine of ours stands on another world',ok:R=>R.selLand},
  {id:'selsample',pay:400,ep:4,req:['selland'],name:'Sample return',brief:'Land an instrument package on Selene, then bring it back to Tellus and recover it.',
   win:'a handful of Selene on a lab bench',ok:R=>R.selSampled&&R.landed&&R.recSci},
  {id:'padabort',pay:60,ep:4,req:['orbiter'],name:'Pad abort test',brief:'With a crew capsule (test dummies aboard) under an escape tower on a rocket, abort from the pad (Backspace): the tower must carry the capsule high enough for the chute, under 8 g, and it must land intact.',
   win:'the tower works from a standing start',ok:R=>R.abort&&R.abort.alt<200&&R.capHome&&R.cgMax<=G_LIM},
  {id:'maxqabort',pay:90,ep:4,req:['padabort'],name:'Max-q abort test',brief:'Abort in flight at 15 kPa or more of dynamic pressure, the worst moment there is, and bring the capsule home intact under 8 g. This qualifies the tower: after it, capsules fly with a crew.',
   win:'the escape system is qualified for people',ok:R=>R.abort&&R.abort.q>=15000&&R.capHome&&R.cgMax<=G_LIM},
  {id:'crewaround',pay:440,ep:4,req:['maxqabort','farside'],name:'Crew around Selene',brief:`A crew capsule with two people into Selene's sphere of influence and home safe: under 8 g, cabin under ${CABIN_MAX} K, within 10 days of air.`,
   win:'the first people to see the far side',ok:R=>R.crewed&&R.crewOK&&R.crewSel&&R.capHome},
  {id:'crewland',pay:600,ep:4,req:['crewaround','selland'],name:'Crew on Selene',brief:'Land a crew on Selene (under 4 m/s), then bring them home safe, same limits.',
   win:'footprints on Selene',ok:R=>R.crewed&&R.crewOK&&R.crewSelLand&&R.capHome},
  {id:'nyxfind',pay:230,ep:5,req:['farside'],name:'Something out there',brief:`Nyx is in the sky, but nobody knows its orbit or its mass. Track a craft carrying an instrument package and an antenna for ${NYX_TRACK_H} h where Nyx's pull is at least a thousandth of Tellus's (high orbits, or near Nyx): the residuals Tellus and Selene can't explain will weigh it. Only a flight launched for this is tracked that closely.`,
   win:'Nyx weighed, and its orbit on the map',ok:R=>R.nyxFound},
  {id:'nyxfly',pay:230,ep:5,req:['nyxfind'],name:'Nyx flyby',brief:`Fly into Nyx's sphere of influence with a camera and an antenna.`,
   win:'a dark, cratered rock, close up',ok:R=>R.nyxFly},
  {id:'nyxorb',pay:250,ep:5,req:['nyxfly'],name:'An orbit that lasts',brief:`Keep an instrument package in orbit around Nyx for two of Nyx's own orbits (${(4*Math.PI/NYX.n/3600).toFixed(0)} h). Tellus's tide is strong out there: watch which way round you go.`,
   win:'an orbit around Nyx that lasts',ok:R=>R.nyxOrbT>=4*Math.PI/NYX.n},
  {id:'nyxland',pay:300,ep:5,req:['nyxfly'],name:'Landing on Nyx',brief:`Land an instrument package on Nyx under 3 m/s. Its escape speed is only 346 m/s: easy to land, easy to bounce.`,
   win:'a lander on the dark moon',ok:R=>R.nyxLand},
];
// ---- "out there" (bodies session): what the Selene and Nyx missions read from a flight. Line of sight and sunlight are
// geometry on the bodies we already have; Nyx's discovery is tracking residuals, i.e. time spent where its pull matters.
function seesTellus(s){if(s.body===TELLUS)return true;const P=mul(bodyRel(s.body,simT)[0],-1),d=sub(P,s.r),L=len(d),u=mul(d,1/L),t=-dot(s.r,u);   // Tellus from the craft, past the body it's at
  return!(t>0&&t<L&&len(madd(s.r,u,t))<s.body.R)}
const nearSide=(b,r)=>dot(norm(r),norm(mul(bodyRel(b,simT)[0],-1)))>0;   // a point on b facing Tellus
// the capital: the home power's biggest city; does a satellite at r (absolute frame, program time T) sit 15° up in its sky?
const capital=()=>CITIES.filter(c=>c.power&&c.power.i===HOME).sort((a,b)=>b.pop-a.pop)[0]||CITIES[0];
function capSees(r,T,minEl=15){const c=capital(),pf=rotY(r,-absTh(T)),d=sub(pf,mul(c.u,TELLUS.R));return dot(norm(d),c.u)>=Math.sin(minEl*Math.PI/180)}
const isTV=(q,T)=>{if(!q.ant)return false;const el=elements(q.r,q.v,TELLUS.mu),inc=Math.acos(clamp(el.h[1]/el.hl,-1,1))*180/Math.PI;
  return el.e<0.02&&inc<3&&Math.abs(el.period/DAY_S-1)<0.01&&capSees(satAt(q,T)[0],T)};
// navigation, Transit-style (a fix from one satellite's pass, as in the 1960s): the share of (place, moment) over the past
// day from which a satellite with an antenna will be at least 10° up within NAV_WAIT. 64 places spread evenly over the
// globe (a Fibonacci lattice), moments every 10 min. (Three in view at once almost everywhere would take ~12 satellites.)
const NAV_PTS=Array.from({length:64},(_,i)=>{const y=1-2*(i+.5)/64,r=Math.sqrt(1-y*y),a=i*2.39996323;return[r*Math.cos(a),y,r*Math.sin(a)]});
function navCover(T){const sats=satsUp().filter(q=>q.ant);if(!sats.length)return PROG.navCov=0;const s10=Math.sin(10*Math.PI/180),M=144,dtS=DAY_S/M,W=Math.round(NAV_WAIT/dtS);
  const vis=NAV_PTS.map(()=>new Uint8Array(M+W));
  for(let k=0;k<M+W;k++){const t=T-DAY_S+k*dtS,P=sats.map(q=>rotY(satAt(q,t)[0],-absTh(t)));
    NAV_PTS.forEach((u,j)=>{for(const p of P){const d=sub(p,mul(u,TELLUS.R));if(dot(d,u)>=s10*len(d)){vis[j][k]=1;break}}})}
  let ok=0;for(const v of vis){let next=Infinity;for(let k=M+W-1;k>=0;k--){if(v[k])next=k;if(k<M&&next-k<=W)ok++}}
  return PROG.navCov=ok/(M*NAV_PTS.length)}
// between flights: TV pays while it's in the capital's sky; world missions are checked
function utilTick(d){const T=PROG.day*DAY_S;
  for(const q of satsUp()){const tv=isTV(q,T);if(tv)income(d*TV_RATE);if(q.tvOn&&!tv)HOOK.news(`${q.name} has drifted out of the capital's sky: the screens go grey`,'warn');q.tvOn=tv}
  for(const M of MISSIONS)if(M.world&&!PROG.done[M.id]&&missionOpen(M)&&M.okW())missionComplete(M,null)}
// Nyx's pull minus Tellus's reflex, as a fraction of Tellus's pull, at r (Tellus frame): what tracking can't explain without it
const nyxResidual=r=>{const R0=bodyRel(NYX,simT)[0],d=sub(r,R0),ac=add(mul(d,-NYX.mu/len(d)**3),mul(R0,-NYX.mu/len(R0)**3));return len(ac)*dot(r,r)/TELLUS.mu};
function outThere(s,dt,phys){const R=s.rec,b=s.body,on=k=>s.parts.some(p=>p.on&&p.d.kind===k),cam=on('cam'),ant=on('ant'),sci=on('sci'),toT=b.parent?norm(mul(bodyRel(b,simT)[0],-1)):null;
  // crew (epoch 4): people fly once the escape tower is qualified (the max-q abort); until then the capsule carries dummies,
  // whose g and cabin are measured all the same. Limits are the passenger's: 8 g (1 s average), a 330 K cabin; 10 days of air.
  {const cap=s.parts.find(p=>p.on&&p.d.crew);
    if(!R.crewInit){R.crewInit=1;R.crewed=!!cap&&!!PROG.done.maxqabort;R.crewOK=true;R.cg=0;R.cgMax=0;R.ccab=290}
    if(cap){if(phys&&s.alive){R.cg+=(s.gload-R.cg)*Math.min(1,dt/1);R.cgMax=Math.max(R.cgMax,R.cg)}R.ccab+=(cap.T-R.ccab)*Math.min(1,dt/(cap.d.ins||600));
      if(s.alive&&s.landed&&b===TELLUS)R.capHome=true;
      if(s.alive&&b===SELENE&&R.crewed&&R.crewOK){R.crewSel=true;if(s.landed&&(s.touchV||0)<4)R.crewSelLand=true}}
    if(R.crewed&&R.crewOK){const why=!s.alive||!cap?'were lost':R.cgMax>G_LIM?`were hurt by ${R.cgMax.toFixed(1)} g`:R.ccab>CABIN_MAX?`overheated (cabin ${R.ccab.toFixed(0)} K)`:simT>CREW_AIR&&!R.capHome?'ran out of air':'';
      if(why){R.crewOK=false;failHit(-20,'a crew was lost');HOOK.news(`The crew ${why}. The program stops to mourn and to ask how`,'bad')}}}
  // epoch 3: a working orbit for the job (stable, coasting)
  if(b===TELLUS&&s.alive&&!s.landed&&ant&&!(s.throttle>0)&&(!R.weather&&cam||!R.tv)){const el=elements(s.r,s.v,b.mu);
    if(el.e<1&&el.pe>b.R+b.atm){const inc=Math.acos(clamp(el.h[1]/el.hl,-1,1))*180/Math.PI;
      if(cam&&inc>=80&&inc<=100)R.weather=true;
      if(Math.abs(el.period/DAY_S-1)<0.002&&el.e<0.01&&inc<2&&capSees(s.r,progT(s)))R.tv=true}}
  // Selene: far-side photos (sunlit ground below, the side away from Tellus), downlinked in line of sight or carried home
  if(b===SELENE&&s.alive&&!s.landed&&cam&&!R.farPhoto){const u=norm(s.r);if(len(s.r)<3*b.R&&dot(u,SUN_DIR)>0.1&&dot(u,toT)<-0.3){R.farPhoto=true;HOOK.msg('Far side photographed'+(ant?': downlink when Tellus is back in sight':''))}}
  if(R.farPhoto&&!R.farSent&&s.alive&&(ant&&seesTellus(s)||b===TELLUS&&s.landed&&cam)){R.farSent=true;HOOK.news(`The first pictures of Selene's far side reach home`,'ok')}
  if(!s.alive&&!R.hitDone&&b===SELENE){R.hitDone=true;if(sci&&ant){if(nearSide(b,s.r))R.selImpact=true;else HOOK.news('Our impactor hit the far side of Selene: nobody heard a thing','warn')}}
  if(s.landed&&s.alive&&b===SELENE&&sci){R.selSampled=true;if(!R.selLand&&ant&&(s.touchV||0)<4){if(nearSide(b,s.r))R.selLand=true;else if(!R.farLandNews){R.farLandNews=1;HOOK.news('Down on the far side of Selene, with no way to phone home','warn')}}}
  // Nyx: found by tracking; weighed on discovery (that logbook fact unlocks its orbit on the map and its encounter forecasts)
  // (economy: only a flight launched while nyxfind is open is tracked that closely, R.nyxLook; the farside flight's slow
  // transfer would otherwise find Nyx in passing. NOTES "Nyx is found by looking")
  if(s.alive&&sci&&ant&&R.nyxLook&&!(PROG.log&&PROG.log.nyx)&&(b===NYX||b===TELLUS&&nyxResidual(s.r)>=1e-3)){R.nyxTrack=(R.nyxTrack||0)+dt;
    if(R.nyxTrack>=NYX_TRACK_H*3600){R.nyxFound=true;logNote(s,'nyx',{m:NYX.mu/TELLUS.mu,pe:NYX.rMin,ap:NYX.rMax});HOOK.news(`Tracking residuals explained: a second moon, Nyx, weighed at ${(NYX.mu/TELLUS.mu*1e4).toFixed(1)}×10⁻⁴ of Tellus`,'ok')}}
  if(b===NYX){if(!R.logNyx){R.logNyx=1;logNote(s,'nyxreach',R.dv)}if(s.alive&&cam&&ant)R.nyxFly=true;
    if(s.alive&&!s.landed&&sci){R.nyxRun=(R.nyxRun||0)+dt;R.nyxOrbT=Math.max(R.nyxOrbT||0,R.nyxRun)}else R.nyxRun=0;
    if(s.landed&&s.alive&&sci&&(s.touchV||0)<3&&!R.nyxLand){R.nyxLand=true;logNote(s,'nyxland',R.dv)}}
  else R.nyxRun=0}
const missionOpen=M=>(M.req||[]).every(r=>PROG.done[r]);
function recNew(){return{launched:false,landed:false,ended:false,apex:0,sciQ:0,bands:{},orbit:false,orbitSci:false,lift:0,
  sf:{},bio:false,bioOK:true,bioWhy:'',bioSpace:false,bioOrbits:0,g:0,gMax:0,cabin:290,approved:true,drops:[],cert0:{},recSci:false,pet:'',
  apexSci:0,qPart:{},orb:null,landDist:Infinity,cdone:[],dv:0,newLog:[],qMax:0,far:0,vEntry:0,hotT:0,hotPart:'',khSeen:{}}}
// flight safety review: every joint within its certified rating in the builder's what-if cases (liftoff, max-q)
function safetyReview(sh){analyze(sh);let worst=0,wp=null;
  for(const p of sh.parts){if(!p.parent||!p.sk1)continue;const f=p.anaFrac/Math.min(certOf(p.sk1),certOf(p.sk2));if(f>worst){worst=f;wp=p}}
  return{ok:worst<=1,worst,p:wp}}
function missionTick(s,dt,phys){const R=s.rec;if(!R||R.ended)return;if(R.launched)stagedTick(s,R);   // economy: staged pay
  if(R.launched&&!R.endPf&&s.body===TELLUS&&(s.landed||!s.alive)){R.endPf=toPF(TELLUS,s.r,simT);R.endSci=R.lastSci}   // where it came down (landed or crashed)
  if(s.alive)R.lastSci=s.parts.some(p=>p.on&&p.d.kind==='sci');
  if(!R.launched&&!s.landed&&!R.deb0)R.deb0=debSnap();   // the debrief's "before" (flow session, UI slice 3)
  if(!R.launched){if(s.landed)return;R.launched=true;R.nyxLook=missionOpen(MISSIONS.find(M=>M.id==='nyxfind'));importNews(s);prodUnits(s);R.cost=vesselCost(s.parts).cost;R.ops=OPS_FIX+OPS_FRAC*R.cost;PROG.funds-=R.cost+R.ops;R.prep=TEST.fast?0:prepDays(R.cost)*(1+0.5*(1-khVessel(s)))*FAC.hall.eff[facLv('hall')];R.launchPf=toPF(TELLUS,s.r,simT);R.studyWait=studyWait(s);R.padWait=padWait();advanceDays(R.studyWait+R.padWait);advanceDays(R.prep);advanceDays(Math.ceil(PROG.day-1e-9)-PROG.day);R.day0=PROG.day;{const n=weatherHold(s);if(n){R.day0=PROG.day;R.scrubs=n}}if(ORB_ABS){ORB_T0=R.orbT0!=null?R.orbT0:R.day0*DAY_S;R.orbT0=ORB_T0;if(typeof recTape!=='undefined'&&recTape)recTape.orbT0=ORB_T0}   // wait for the daily launch window
    const bio=s.parts.find(p=>p.on&&p.d.kind==='bio');
    if(bio){R.bio=true;R.tourist=(PROG.active||[]).some(c=>c.src==='tour');R.pet=R.tourist?TOURISTS[PROG.flights%TOURISTS.length]:PETS[PROG.flights%PETS.length];const v=safetyReview(newShip(s.stack));R.approved=v.ok;
      if(!v.ok)HOOK.news(`Flight safety did not sign off: ${v.p.d.name} / ${v.p.parent.d.name} at ${(v.worst*100).toFixed(0)}% of certified. ${R.pet} flies anyway, unofficially`,'warn')}
    for(const p of s.parts)R.cert0[p.d.key]=certOf(p.d.key)}
  const b=s.body,h=len(s.r)-b.R,on=k=>s.parts.find(p=>p.on&&p.d.kind===k),sci=s.alive&&on('sci'),bio=s.alive&&on('bio');
  if(b===TELLUS&&h>b.atm&&!R.logSpace){R.logSpace=1;logNote(s,'space',R.dv)}
  if(b===SELENE&&!R.logSel){R.logSel=1;logNote(s,'selene',R.dv)}
  if(b===SELENE&&s.landed&&s.alive&&!R.logLand){R.logLand=1;logNote(s,'land',R.dv);logNote(s,'sg',SELENE.mu/dot(s.r,s.r))}   // a lander measures g
  if(b===SELENE&&!s.landed&&!R.logSOrb){const e2=elements(s.r,s.v,b.mu);if(e2.e<1&&e2.pe>b.R+5000&&e2.ap<b.soi){R.logSOrb=1;logNote(s,'sorbit',{p:e2.period,alt:(e2.pe+e2.ap)/2-b.R})}}
  {const dT=len(b===TELLUS?s.r:add(s.r,bodyPos(b,simT)))-TELLUS.R;if(s.alive&&dT>R.far)R.far=dT}
  if(phys&&s.alive){if(s.qdyn>R.qMax)R.qMax=s.qdyn;for(const p of s.parts)if(p.on&&p.T>R.hotT){R.hotT=p.T;R.hotPart=p.d.name}
    if(b===TELLUS&&R.logSpace&&h<b.atm&&dot(s.v,s.r)<0){const sp=len(sub(s.v,surfVel(b,s.r)));if(sp>R.vEntry)R.vEntry=sp}}
  if(b===TELLUS){R.apex=Math.max(R.apex,h);if(sci&&h<b.atm&&h>=0)R.bands[Math.floor(h/1e4)]=1;if(sci&&h>R.apexSci)R.apexSci=h;if(sci&&h>AURORA_ALT&&Math.abs(norm(s.pf)[1])>Math.sin(AURORA_LAT))R.aurora=1}
  if(phys&&sci&&s.qdyn>0)for(const p of s.parts)if(p.on&&s.qdyn>(R.qPart[p.d.key]||0))R.qPart[p.d.key]=s.qdyn;   // the worst q each part flew through, instrumented
  if(phys&&s.thrust>0)R.dv+=s.thrust/s.mass*dt;   // Δv actually spent, for the logbook
  if(phys){for(const p of s.order)if(p.on){if(p.sf1>(p.wL||0))p.wL=p.sf1;const q=p.parent;if(p.sf2>(q.wL||0))q.wL=p.sf2}
    for(const p of s.parts)if(p.on){const f=p.T/p.d.Tmax;if(f>(p.wT||0))p.wT=f}
    if(R.launched)khMark(s,R)}
  if(phys&&sci){R.sciQ=Math.max(R.sciQ,s.qdyn);   // telemetry: the hardest each part aboard has been loaded
    if(!(R.lkT>=simT-1)){R.lkT=simT;R.lk=linkOf(s)}const SF=R.lk.ok?R.sf:(R.sfRec=R.sfRec||{});   // linked: straight down; otherwise to the recorder (terrain session)
    for(const p of s.order)if(p.on&&p.sk1){for(const[k,f]of[[p.sk1,p.sf1],[p.sk2,p.sf2]])if(f>(SF[k]||0))SF[k]=f}}
  if(s.alive&&!s.landed&&b===TELLUS){const el=elements(s.r,s.v,b.mu);
    if(el.e<1&&el.pe>b.R+b.atm){if(!R.logOrbit){R.logOrbit=1;logNote(s,'orbit',R.dv);logNote(s,'period',{p:el.period,alt:(el.pe+el.ap)/2-b.R})}R.orbit=true;if(sci)R.orbitSci=true;R.orb={pe:el.pe-b.R,ap:el.ap-b.R,inc:Math.acos(clamp(el.h[1]/el.hl,-1,1))*57.29578,sci:!!sci};R.lift=Math.max(R.lift,s.parts.reduce((m,p)=>m+(p.on&&p.d.kind==='ballast'?p.d.m:0),0));
      if(bio&&R.bioOK)R.bioOrbits+=dt/el.period}}
  if(R.bio&&R.bioOK){let why='';
    if(!bio)why=s.alive?'was lost with its stage':'was lost with the vessel';
    else{if(phys){R.g+=(s.gload-R.g)*Math.min(1,dt/1);R.gMax=Math.max(R.gMax,R.g)}R.cabin+=(bio.T-R.cabin)*Math.min(1,dt/600);   // insulated: the cabin lags the skin by ~10 min
      if(h>b.atm)R.bioSpace=true;
      if(R.gMax>G_LIM)why=`was hurt by ${R.gMax.toFixed(1)} g`;else if(R.cabin>CABIN_MAX)why=`overheated (cabin ${R.cabin.toFixed(0)} K)`;else if(simT>AIR_S&&!s.landed)why='ran out of air'}
    if(why){R.bioOK=false;R.bioWhy=why;HOOK.news(`${R.pet} ${why}. The program pauses to reflect`,'bad');HOOK.msg(`Passenger ${why}`)}}
  if(s.landed&&!R.landed&&s.alive&&b===TELLUS){R.landed=true;R.recSci=!!sci;R.landBiome=s.water?0:biomeAt(s.pf).id;R.landDist=Math.acos(clamp(dot(norm(s.pf),(s.site||SITES[0]).u),-1,1))*b.R;
    if(R.logSpace){if(R.vEntry>0)logNote(s,'entry',R.vEntry);logNote(s,'pad',R.landDist)}if(R.hotT>350)logNote(s,'heat',{T:R.hotT,part:R.hotPart});if(R.bio&&R.bioOK&&R.gMax>0)logNote(s,'paxg',R.gMax);
    if(sci){const ks=Object.keys(R.bands).filter(k=>!PROG.atm[k]);for(const k of ks)PROG.atm[k]=1;
      if(ks.length)HOOK.news(`Air samples from ${ks.map(k=>k*10+'–'+(+k+1)*10+' km').join(', ')} analysed: impact predictions tighten`,'ok')}
    if(R.bio&&R.bioOK)HOOK.news(`${R.pet} is home safe, and immediately asks for a snack`,'ok');HOOK.save()}
  outThere(s,dt,phys);missionEval(s)}
function missionEval(s){contractEval(s);if(PROG.demand&&(s.rec.firstNow||s.rec.bigContract))demandMet(s.rec.firstNow?'a first in the world':'a prestigious contract');for(const M of MISSIONS){if(PROG.done[M.id]||!missionOpen(M))continue;
  if(M.ok(s.rec,s))missionComplete(M,s.rec)}}
// a mission is done: pay it, move opinion, tell the world. rec is the flight's record, or null for a world mission
// ---- staged pay for long missions (design: NOTES "Time, long missions and communication"). A mission to another body
// pays a share when a flight is on course for it (its predicted trajectory enters the body's sphere of influence), a
// share on arrival (inside it), and the rest on completion: long missions pay along the way. Each share is paid once
// per mission, to the first open mission bound for that body (crewed ones only on a crewed flight), and an advance is
// kept if the flight then fails. Once missions fly in the background (sats registry), the same shares pay there.
const STAGE_PAY={bound:0.2,arrive:0.2};
for(const[id,to,crew]of[['farside','Selene'],['selimp','Selene'],['selland','Selene'],['selsample','Selene'],['crewaround','Selene',1],['crewland','Selene',1],
  ['nyxfly','Nyx'],['nyxorb','Nyx'],['nyxland','Nyx']]){const M=MISSIONS.find(x=>x.id===id);if(M){M.to=to;if(crew)M.crew=true}}
const stagedMission=(B,R)=>MISSIONS.find(M=>M.to===B.name&&!PROG.done[M.id]&&missionOpen(M)&&(!M.crew||R.crewed))||null;
const stagePaid=M=>((PROG.staged||{})[M.id]||{}).paid||0;
function stagePay(M,k,R){const st=PROG.staged[M.id],x=M.pay*STAGE_PAY[k];st[k]=1;st.paid=(st.paid||0)+x;income(x);debPaid(R,'stage',M.name,x);
  HOOK.news(k==='bound'?`Mission control: on course for ${M.to}. ${M.name} pays its first share (+${fmtM(x)})`:`Arrived at ${M.to}: ${M.name} pays its second share (+${fmtM(x)})`,'ok');HOOK.save()}
function stagedTick(s,R){if(!s.alive||s.landed)return;PROG.staged=PROG.staged||{};
  for(const B of[SELENE,NYX]){const M=stagedMission(B,R);if(!M)continue;const st=PROG.staged[M.id]||(PROG.staged[M.id]={});
    if(s.body===B){if(!st.bound)stagePay(M,'bound',R);if(!st.arrive)stagePay(M,'arrive',R);continue}
    if(st.bound||s.body!==TELLUS||simT-(R.boundT??-1e9)<30)continue;R.boundT=simT;   // (checked every 30 s of flight)
    const el=elements(s.r,s.v,TELLUS.mu);if(el.e<1&&el.ap<0.3*B.orb.a*(1-B.orb.e))continue;
    const P=predict(s);if(P&&P.some(L=>L.b===B))stagePay(M,'bound',R)}}
const stageNote=M=>M.to?` <span class="dim">· pays ${STAGE_PAY.bound*100}% on course, ${STAGE_PAY.arrive*100}% on arrival${stagePaid(M)?` (${fmtM(stagePaid(M))} paid)`:''}</span>`:'';
function missionComplete(M,rec){PROG.done[M.id]={flight:PROG.flights+(rec?1:0),day:PROG.day};const lost=raceLost(M.id),racing=RACE.includes(M.id),pay=Math.max(0,M.pay*(racing?(lost!=null?0.5:1+2*flav(HOME).pri.prestige):1)-stagePaid(M));   // less what was paid along the way
    income(pay);debPaid(rec,'mission',M.name,pay,{first:racing&&lost==null});opAdd(HOME,racing&&lost==null?8*(0.5+natOf(HOME)):4);if(flav(HOME).money==='patronage'&&racing&&lost==null){PROG.funds+=25;HOOK.news('The leadership rewards the triumph: +25M','ok')}
    if(racing&&lost==null&&rec)rec.firstNow=true;for(const p of POWERS)if(p.i!==HOME)opAdd(p.i,1.5);
    HOOK.news(racing?(lost!=null?`✔ ${M.name}, second after ${POWERS[lost].name} (+${fmtM(pay)})`:`✔ FIRST IN THE WORLD: ${M.name}, ${M.win} (+${fmtM(pay)})`):`✔ ${M.name}: ${M.win} (+${fmtM(pay)})`,'ok');HOOK.msg(`Mission complete: ${M.name}`);HOOK.save()}
function missionDrop(s,verdict){if(s.rec&&!s.rec.ended)s.rec.drops.push(verdict)}
// a flight ends when it's reverted or abandoned; the range streak and the certification summary are settled then
// The player leaving a flight for another screen (Program, Assembly, Rover yard) ends it there: settled now, not at the
// next launch (fixes session, PLAYTEST #21). Once only: Revert or the next launch then find it settled (R.ended).
function flightLeave(s){return missionEnd(s)}
function missionEnd(s){const R=s&&s.rec;if(!R||!R.launched||R.ended)return null;if(R.far>0)logNote(s,'apex',R.far);if(s.alive&&R.qMax>1000)logNote(s,'maxq',R.qMax);if(R.newLog.length)HOOK.logged(R.newLog);R.ended=true;PROG.flights++;satRegister(s,R);dockEnd(s);fleetEnd(R);rvEnd();advanceDays(simT/DAY_S);
  if(R.sfRec&&R.recSci)for(const k in R.sfRec)R.sf[k]=Math.max(R.sf[k]||0,R.sfRec[k]);   // the recorder counts once the package is back (terrain session)
  const yS=khYield();for(const k in R.sf){const c=certOf(k);PROG.cert[k]=1-(1-c)*(1-0.5*yS*Math.min(1,R.sf[k]/0.4))}
  khLearn(R)
  if(R.drops.length){const clean=R.drops.every(v=>v.kind!=='city'&&v.kind!=='near');PROG.streak=clean?PROG.streak+1:0}
  fleetSalvage(R);
  // where the stages came down: at home it's a local matter; on another power's land, an incident (worse on a town)
  for(const v of R.drops){const pw=v.power;if(!pw)continue;
    if(pw.i===HOME){if(v.kind==='city')opAdd(HOME,-6);else if(v.kind==='near')opAdd(HOME,-2);continue}
    const hit=v.kind==='city'?3:v.kind==='near'?1.5:1;opAdd(pw.i,-5*hit);const key=pairKey(HOME,pw.i);PROG.rel[key]=clamp(relOf(HOME,pw.i)-0.06*hit,-1,1);
    HOOK.news(v.kind==='city'?`Diplomatic incident: our stage falls on ${v.city.name}; ${pw.name} demands answers`:`${pw.name} protests a rocket stage landing on its territory`,'bad')}
  if(R.bio&&!R.bioOK&&!R.tourist)failHit(-8,`a passenger flight went wrong`);
  if(R.tourist&&!R.bioOK){standAdd('tour',-40);opAdd(HOME,-10);HOOK.news(`Space tourism in crisis after ${R.pet} ${R.bioWhy}; bookings cancelled`,'bad')}
  // the books: refurbishment for what came home whole, damages for what came down on towns, the floor
  if(s.alive&&s.landed&&s.body===TELLUS){const ps=s.parts.filter(p=>p.on),tv=(s.touchV||0)+(s.touchHit||0),rc=recoveryOf(s,R);let back=0,full=0,worst=null;R.recovery=rc.kind;   // recovery by geography (terrain session)
    if(rc.why)HOOK.news(`Recovery: ${rc.why}`,rc.factor>=1?'ok':rc.factor>0?'warn':'bad');
    for(const p of ps){const w=wearOf(p,tv)*rc.factor,q=partPrice(p)*REFURB;back+=q*w;full+=q;if(!worst||w<worst.w)worst={p,w}}
    PROG.funds+=back;R.refund=back;
    if(back>=0.5)HOOK.news(`Recovered hardware refurbished: +${fmtM(back)} (${(100*back/full).toFixed(0)}% of possible${worst&&worst.w<.85?`; ${worst.p.d.name} came back ${worst.w<.5?'as scrap':'worn'}`:''})`,'ok')}
  const dmg=R.drops.reduce((a,v)=>a+(DAMAGE[v.kind]||0)*(v.power&&v.power.i!==HOME?1.5:1),0);R.dmg=dmg;if(dmg){PROG.funds-=dmg;HOOK.news(`Damages paid to towns under the flight path: −${fmtM(dmg)}`,'bad')}
  if(R.orbit){const net=R.cost-(R.refund||0);PROG.recs=PROG.recs||{};if(!(PROG.recs.orbit<=net)){if(PROG.recs.orbit!=null)HOOK.news(`Record: cheapest trip to orbit yet, ${fmtM(net)} net`,'ok');PROG.recs.orbit=net}}
  floorCheck();
  const ups=Object.keys(R.cert0).filter(k=>certOf(k)>R.cert0[k]+0.005).map(k=>({k,a:R.cert0[k],b:certOf(k)})).sort((x,y)=>(y.b-y.a)-(x.b-x.a));
  if(ups.length)HOOK.news(`Telemetry certifies: ${ups.slice(0,3).map(u=>`${PARTS[u.k].name} ${(u.a*100).toFixed(0)}→${(u.b*100).toFixed(0)}%`).join(', ')}`,'ok');
  missionEval(s);R.debrief=debriefOf(s,R,ups);HOOK.save();return{ups,streak:PROG.streak,debrief:R.debrief}}
// ---- the powers: N of them (the number is a parameter), generated from a seed like the cities. Each has a home region,
// an economy size, a tech level and an alignment on two axes. Land belongs to the nearest home region (bigger economies
// reach further); the sea belongs to no one. Power 0's home is the launch site. Relations between every pair drift
// toward what their alignments suggest, with noise, and the odd crisis or thaw; tension is just a relation below zero.
const FORMS=['Republic of #','# Federation','Kingdom of #','# Union','United Provinces of #','# Commonwealth','Free State of #','# Confederacy'];
function makePowers(seed=11,n=5){const R=rng(seed),out=[],site=SITES[0].u,forms=FORMS.slice();let tries=0;   // forms drawn without repeats (until they run out)
  while(out.length<n&&tries++<50000){let u;if(!out.length)u=site;else{const z=R()*1.6-.8,ph=R()*6.2832,q=Math.sqrt(1-z*z);u=[q*Math.cos(ph),z,q*Math.sin(ph)];
      if(landValue(u)<0.58||out.some(p=>Math.acos(clamp(dot(u,p.u),-1,1))<1.5/Math.sqrt(n)))continue}
    const root=SYL[R()*SYL.length|0]+SYL[R()*SYL.length|0],nm=root[0].toUpperCase()+root.slice(1);
    out.push({i:out.length,root:nm,name:(forms.length?forms.splice(R()*forms.length|0,1)[0]:FORMS[R()*FORMS.length|0]).replace('#',nm),u,econ:out.length?.5+R()*1.5:1.2,tech:.6+R()*.6,
      align:[R()*2-1,R()*2-1],hue:(out.length*137.5+20)%360})}
  return out}
const POWERS=makePowers();let HOME=0;
// ---- power flavours: settings on a few axes, each wired to an existing system; archetypes are presets.
//  open (0..1): who the program answers to. Open: failures public, elections swing the budget. Closed: failures hushed
//    (part of the hit now, the rest as leak risk), the leadership demands spectaculars by a date.
//  money: tax (by opinion) · commodity (its own price cycle) · patronage (thin budget days, lump sums for prestige) ·
//    military (grows with tension).  pri: what the power wants (prestige/security/commerce/science) → offers, pay, race.
//  nat: nationalism, a mood: starts at the archetype's level, rises with tension and crises, fades in calm years, and
//    scales the home reaction to everything foreign the program does.
const ARCH={
  openSuper:{ind:1,name:'Open superpower',open:.9,money:'tax',pri:{prestige:.35,commerce:.35,security:.15,science:.15},nat:.4,
    blurb:'Rich and watched: every failure is on television, and elections decide the budget.'},
  closedSuper:{ind:1,name:'Closed superpower',open:.1,money:'patronage',pri:{prestige:.5,security:.35,commerce:.05,science:.1},nat:.6,
    blurb:'Secrecy and spectaculars: failures stay quiet (until they leak), the leadership wants triumphs on schedule.'},
  rising:{ind:.5,name:'Rising power',open:.3,money:'tax',grow:true,pri:{prestige:.4,commerce:.2,security:.2,science:.2},nat:.55,
    blurb:'Behind, and in a hurry: a budget that grows every year, and a public that wants to catch up.'},
  frugal:{ind:.4,name:'Frugal middle power',open:.75,money:'tax',pri:{commerce:.45,science:.35,prestige:.1,security:.1},nat:.3,
    blurb:'Small budget, big ingenuity: commerce and science pay, partners are welcome.'},
  resource:{ind:.1,name:'Resource state',open:.25,money:'commodity',pri:{prestige:.55,commerce:.2,science:.15,security:.1},nat:.45,
    blurb:'Oil money: lavish in a boom, brutal in a bust, and prestige is what it is for.'},
  security:{ind:.55,name:'Security state',open:.2,money:'military',cancel:true,pri:{security:.6,prestige:.2,science:.1,commerce:.1},nat:.7,
    blurb:'A military program first: money follows tension, sanctions follow you, and a new government could end it all.'}};
const PRI_OF={sci:'science',com:'commerce',mil:'security',gov:'prestige',tour:'commerce'};
// ---- industrial independence. Parts come in three tiers: structure (0), small engines and 2.5 m structure (1), big
// engines and complex payloads (2). A power makes the tiers its self-sufficiency reaches (0 / 0.45 / 0.8); a rising
// power's industry grows with time. Anything home can't make is imported (×1.5) from the most capable supplier that isn't
// hostile and isn't sanctioning us; with no supplier left it comes through intermediaries (×3): that's how sanctions
// reach hardware. A young industry's own parts start less certified (CERT0 − 0.2 × (1 − self-sufficiency)); imports
// arrive certified to the usual level.
const IND_TH=[0,0.45,0.8],IMPORT_K=1.5,GREY_K=3;
const indOf=i=>{const F=flav(i);return F.grow?Math.min(0.9,F.ind+PROG.day/1500):F.ind};
// tier 1 for steerable fins (d.ctl), reaction wheels and spin motors: they carry actuators (control session)
function tierOf(k){const d=PARTS[k];if(!d)return 0;
  if(d.kind==='engine')return d.thrust>=300?2:1;if(d.ctl||d.kind==='rwheel'||d.kind==='spin')return 1;if(['pod','bio','sci','cam','ant'].includes(d.kind))return 2;return d.sc?1:0}
function sourceOf(k){const t=tierOf(k),L=prodLine(k);if(L)return{how:'line',k:prodLineK(L),t,line:L};if(indOf(HOME)>=IND_TH[t])return{how:'home',k:1,t};
  const sup=POWERS.filter(p=>p.i!==HOME&&indOf(p.i)>=IND_TH[t]&&!sanctioned(p.i)&&relOf(HOME,p.i)>-0.2).sort((a,b)=>indOf(b.i)*b.econ-indOf(a.i)*a.econ)[0];
  return sup?{how:'import',k:IMPORT_K,from:sup.i,t}:{how:'grey',k:GREY_K,t}}
const cert0=k=>{const x=sourceOf(k);return x.how==='home'?CERT0-0.2*(1-indOf(HOME)):x.how==='line'?CERT0-0.2*(1-x.line.m):CERT0};
const TIER_NAME=['structure and tanks','small engines','big engines and avionics'];
// ---- know-how: owning a part is not knowing how to use it. Per part type, two facets:
//  · use: operational familiarity (PROG.kh[k].use), gained by flying it through regimes: one step per flight, of
//    (1−use)·(1−e^(−0.05·Σ novelty)) with novelty 1/(1+times that regime was seen) — an orbital flight's first time
//    teaches about a third of what's left, repeats less; a part built at home starts higher (the engineers made it).
//  · limits: certification (PROG.cert, unchanged). The player sees one bar: 0.6·use + 0.4·(how far certification is
//    from 50 % to 100 %).
// Low use bites through risk, time and yield, never stat cuts: engines can fail to light (8 %·(1−use)²), stacking an
// unfamiliar vehicle takes up to 1.5× longer, instruments return less (science pay and certification gains scale
// with 0.5 + 0.5·use of the instrument package). Effects start once the program has started (a start chosen, or a
// flight flown), so plain physics in the sim is unaffected. Know-how belongs to the team: it carries over on defection.
const KH_REG=['fly','maxq','vac','orbit','heat','land','burn','vburn','fail'],KH_RATE=0.05,IGN_FAIL=0.08;
const khOn=()=>PROG.flights>0||!!(PROG.own&&PROG.own.chosen);
function use0(k){const t=tierOf(k),b=[0.5,0.2,0.1][t],x=sourceOf(k);return x.how==='home'?Math.min(0.95,b+0.3*indOf(HOME)):x.how==='line'?Math.min(0.95,b+0.2+0.2*x.line.m):b}
const khUse=k=>TEST.kh?1:((PROG.kh||{})[k]?.use)??use0(k);   // (tester: full know-how)
const khBar=k=>clamp(0.6*khUse(k)+0.4*(certOf(k)-0.5)/0.5,0,1);
const khYield=()=>0.5+0.5*khUse('sci');
// price-weighted familiarity of a vessel (for stacking time)
function khVessel(s){let w=0,u=0;for(const p of s.parts){const q=PRICE[p.d.key]??3;w+=q;u+=q*khUse(p.d.key)}return w?u/w:1}
// regimes each part goes through this flight (called every physics step once launched)
function khMark(s,R){const b=s.body,h=len(s.r)-b.R,vac=h>(b.atm||0),hot=[],orbit=R.orbit;
  for(const p of s.parts){if(!p.on)continue;const k=p.d.key,set=R.khSeen[k]||(R.khSeen[k]={});set.fly=1;
    if(s.qdyn>15e3)set.maxq=1;if(vac)set.vac=1;if(orbit)set.orbit=1;if(p.T/p.d.Tmax>0.5)set.heat=1;
    if(p.d.kind==='engine'&&s.thrust>0&&s.segs[p.seg]&&s.segs[p.seg].ignited){set.burn=1;if(vac)set.vburn=1}}
  if(s.landed)for(const p of s.parts)if(p.on&&R.khSeen[p.d.key])R.khSeen[p.d.key].land=1}
// at flight end: each regime seen teaches, by novelty
function khLearn(R,w=1){if(!khOn())return;PROG.kh=PROG.kh||{};
  for(const k in R.khSeen){const e=PROG.kh[k]||(PROG.kh[k]={use:use0(k),reg:{}});
    let nov=0;for(const g in R.khSeen[k]){const n=e.reg[g]||0;nov+=Math.max(1/(1+n),R.novMin||0);e.reg[g]=n+1}
    e.use+=(1-e.use)*(1-Math.exp(-KH_RATE*nov*w))}}   // one step per flight, sized by how new the flight was (sum over regimes); w < 1 for ground tests
// ---- the test stand: a one-off facility (40M, 60 days, no upkeep) for ground campaigns, one at a time. Each campaign
// buys a unit of the part and burns 1.5M a day. A qualification run (10 + 10·tier days) puts it through what a stand can
// reproduce (burns for engines, structural load, heat), teaching at 60 % of a flight's rate (a stand never shows
// vacuum or orbit) and certifying as if loaded to 60 %. A test to destruction (half the time) finds the true limits
// (certified 100 %), teaches a little, and destroys the unit.
const STAND_COST=40,STAND_DAYS=60,STAND_DAY=1.5,STAND_W=0.6,STAND_NOV=0.5;   // a campaign is hours of burn: never worth less than half a fresh regime
const standReady=()=>!!(PROG.stand2&&PROG.day>=PROG.stand2.ready);
function buildStand(){if(PROG.stand2||PROG.funds<STAND_COST)return false;PROG.funds-=STAND_COST;PROG.stand2={ready:PROG.day+STAND_DAYS,job:null,done:0};
  HOOK.news(`Ground broken for a test stand: ready in ${STAND_DAYS} days`,'ok');HOOK.save();return true}
function testQuote(k,mode){const t=tierOf(k),days=mode==='destroy'?5+5*t:10+10*t,unit=(PRICE[k]??3)*sourceOf(k).k;return{days,cost:unit+STAND_DAY*days}}
function startTest(k,mode){if(!standReady()||PROG.stand2.job)return false;const q=testQuote(k,mode);if(PROG.funds<q.cost)return false;
  PROG.funds-=q.cost;PROG.stand2.job={k,mode,end:PROG.day+q.days};HOOK.news(`On the test stand: ${PARTS[k].name}, ${mode==='destroy'?'to destruction':'qualification run'} (${q.days} days)`,'');HOOK.save();return true}
// ---- development projects: improving a part we make (home industry or our own line; not imports, and not a licensed
// design, which belongs to the licensor). Goals that don't touch the physics: cheaper (unit price −12 % per level),
// more reliable (ignition failures ×0.6 per level), more durable (wear ×0.75 per level). Up to three levels per goal,
// each needing real know-how of the part (use ≥ 50 / 65 / 80 %) and money and design-bureau time (one project at a
// time; cost ~3 × price × (1 + tier) × (1 + level), 30 + 20·tier days × (1 + 0.5·level)). A redesign is a new design:
// certification −0.1 and know-how −0.1, to be won back by flying it. Performance goals (thrust, Isp, mass) wait for the
// variants-or-upgrades decision (they change shared part definitions).
const DEV_GOALS={cheap:'Cheaper',rel:'More reliable',dur:'More durable'},DEV_MAX=3,DEV_USE=[0.5,0.65,0.8];
const devLv=(k,g)=>((PROG.dev||{})[k]||{})[g]||0;
const devPriceK=k=>{const x=sourceOf(k);return x.how==='home'||(x.how==='line'&&x.line.lic==null)?1-0.12*devLv(k,'cheap'):1};
function devQuote(k,g){const lv=devLv(k,g),t=tierOf(k),x=sourceOf(k),mine=x.how==='home'||(x.how==='line'&&x.line.lic==null);
  const cost=(PRICE[k]??3)*3*(1+t)*(1+lv),days=Math.round((30+20*t)*(1+0.5*lv)),need=DEV_USE[lv];
  const why=g==='rel'&&PARTS[k]?.kind!=='engine'?'reliability only matters for engines (for now)':!mine?(x.how==='line'?'a licensed design belongs to the licensor':'we can only develop what we make'):lv>=DEV_MAX?'fully developed':khUse(k)<need?`needs know-how ${(need*100).toFixed(0)}% (now ${(khUse(k)*100).toFixed(0)}%)`:'';
  return{lv,cost,days,ok:!why,why}}
function startDev(k,g){if(PROG.devJob)return false;const q=devQuote(k,g);if(!q.ok||PROG.funds<q.cost)return false;PROG.funds-=q.cost;
  PROG.devJob={k,g,end:PROG.day+q.days};HOOK.news(`Design bureau: ${DEV_GOALS[g].toLowerCase()} ${PARTS[k].name} (mark ${q.lv+2}), ${q.days} days`,'');HOOK.save();return true}
// ---- facilities: one-off investments you upgrade, with no upkeep. An upgrade takes money and time; until it's built
// the facility keeps working at its old level.
//  · integration hall: stacking time ×0.8 at level 1 (90M), ×0.65 at level 2 (220M): two bays, two vehicles in work at once
//  · recovery fleet: ships salvage spent stages that come down at sea within range of the launch point (800 / 1,500 km),
//    for 35 / 60 % of their dry price (scaled by wear, as refurbishment), 2M of ship time each; a little know-how too
const FAC={hall:{name:'Integration hall',lv:[{cost:90,days:60},{cost:220,days:120}],eff:[1,0.8,0.65],what:l=>`stacking ×${[1,0.8,0.65][l]}`},
  fleet:{name:'Recovery fleet',lv:[{cost:50,days:90},{cost:120,days:120}],range:[0,800e3,1500e3],sal:[0,0.35,0.6],what:l=>l?`salvages stages at sea within ${[0,800,1500][l]} km, ${[0,35,60][l]}% of value`:'none'},
  pads:{name:'Launch pads',lv:[{cost:80,days:120},{cost:160,days:180}],what:l=>`${1+l} pad${l?'s':''}: dispatched and hand-flown launches in parallel`},
  centre:{name:'Computing centre',lv:[{cost:40,days:90},{cost:120,days:180}],ahead:[0,1,2],speed:[1,0.6,0.4],what:l=>l?`studies ×${[1,0.6,0.4][l]} time, ${[0,1,2][l]} yr ahead of our power's computing`:'none: the trajectory office rents what it can'}};
const facLv=id=>{const f=(PROG.fac||{})[id];return f?f.lv:0};
function facQuote(id){const lv=facLv(id),f=(PROG.fac||{})[id],step=FAC[id].lv[lv];return step?{...step,ok:!(f&&f.building),why:f&&f.building?'already building':''}:{ok:false,why:'fully built'}}
function buildFac(id){const q=facQuote(id);if(!q.ok||PROG.funds<q.cost)return false;PROG.fac=PROG.fac||{};const f=PROG.fac[id]||(PROG.fac[id]={lv:0});
  PROG.funds-=q.cost;f.building={lv:f.lv+1,ready:PROG.day+q.days};HOOK.news(`Construction starts: ${FAC[id].name}, level ${f.lv+1} (${q.days} days)`,'ok');HOOK.save();return true}
function facTick(){for(const id in PROG.fac||{}){const f=PROG.fac[id];if(f.building&&PROG.day>=f.building.ready){f.lv=f.building.lv;f.building=null;
  HOOK.news(`${FAC[id].name} level ${f.lv} is open: ${FAC[id].what(f.lv)}`,'ok');HOOK.save()}}}
// salvaged for parts: load and heat wear count, the splash itself doesn't
function fleetSalvage(R){const lv=facLv('fleet');if(!lv||!R.launchPf)return;let got=0,n=0;const seen={};
  for(const v of R.drops){if(v.kind!=='sea'||!v.pf||!v.parts)continue;const d=Math.acos(clamp(dot(norm(v.pf),norm(R.launchPf)),-1,1))*TELLUS.R;if(d>FAC.fleet.range[lv])continue;
    let val=0;for(const p of v.parts){val+=partPrice(p)*REFURB*FAC.fleet.sal[lv]*wearOf(p,TOUCH_OK);seen[p.d.key]={land:1}}got+=val-2;n++}
  if(!n)return;PROG.funds+=got;khLearn({khSeen:seen},0.3);
  HOOK.news(`Recovery fleet: ${n} stage${n>1?'s':''} fished out of the sea, ${got>=0?'+':''}${fmtM(got)} after ship time`,got>=0?'ok':'')}
function facilitiesHTML(){return`<div class="ep">Facilities</div><div class="sub">`+Object.keys(FAC).map(id=>{const F=FAC[id],lv=facLv(id),f=(PROG.fac||{})[id],q=facQuote(id);
  return`<b>${F.name}</b> <span class="dim">level ${lv}: ${F.what(lv)}</span>`+(f&&f.building?`<br><span class="warn">building level ${f.building.lv}, ${(f.building.ready-PROG.day).toFixed(0)} days left</span>`:
    q.cost!=null?` <button data-fac="${id}" ${q.ok&&PROG.funds>=q.cost?'':'disabled'}>Level ${lv+1}: ${FAC[id].what(lv+1)} · ${fmtM(q.cost)}, ${q.days} d</button>`:'')}).join('<br>')+`</div>`}
// ---- compute: a resource across eras (design: NOTES "Compute — a resource across eras"). The world's computing advances
// with the world date (nudged a little by every computing centre built: the program contributes to the frontier); a
// power reaches each era late by its access lag, like parts: its own industry, else buying from a friendly supplier
// (slower the more closed it is), else the grey market; a sanction shuts the supplier's door. A computing centre puts
// the program ahead of its power. Eras (program years): human computers, mainframes (3), onboard computers (7), cheap
// compute (14), the AI boom (25), when compute grows scarce again: the world price `cpi` dips and climbs back.
// Studies: the trajectory office computes a design before it flies. A study is per exact design (like autopilot tapes),
// costs money and days (×√(cost/50M), 0.5–3), one at a time in order; a launch waits for its own design's study and then
// stacks, so a study ordered ahead, while other things fly, costs no days at all. It buys precision: an unstudied design's
// predictions carry the era's raw error, a studied one the era's studied error (kept from the era it was computed in,
// unless the present does better). The impact predictor reads it as a drag-model error, so the landing spread widens,
// and range safety takes the whole spread. Compute never blocks flying: you can always fly unstudied.
const COMP_ERAS=[
  {id:'hand',name:'Human computers',yr:0,study:{cost:3,days:24},err:[0.3,0.1],cpi:100,blurb:'rooms of people with desk calculators; a trajectory takes weeks'},
  {id:'main',name:'Mainframes',yr:3,study:{cost:5,days:8},err:[0.15,0.04],cpi:20,blurb:'a machine the size of a room, time-shared and queued'},
  {id:'board',name:'Onboard computers',yr:7,study:{cost:3,days:3},err:[0.05,0],cpi:5,blurb:'guidance computers fly with the vehicle'},
  {id:'cheap',name:'Cheap compute',yr:14,study:{cost:1,days:0.5},err:[0,0],cpi:1,blurb:'planning is instant and exact'},
  {id:'ai',name:'The AI boom',yr:25,study:{cost:1,days:0.5},err:[0,0],cpi:4,blurb:'the world wants all the compute there is; datacenters hunt for power and cooling'}];
const COMP_NUDGE=0.25;   // world years per computing-centre level built (anyone's: ours, for now)
function compLag(i=HOME){const F=flav(i),own=4*(1-indOf(i)),sup=POWERS.some(p=>p.i!==i&&indOf(p.i)>=0.9&&!(i===HOME&&sanctioned(p.i))&&relOf(i,p.i)>-0.2);
  return Math.min(own,sup?0.5+1.5*(1-F.open):4)}
const worldCompYear=()=>PROG.day/YEAR_D+COMP_NUDGE*facLv('centre');
const compYear=()=>worldCompYear()-compLag()+FAC.centre.ahead[facLv('centre')];
const eraAt=y=>{let e=0;for(let j=0;j<COMP_ERAS.length;j++)if(y>=COMP_ERAS[j].yr)e=j;return e};
const compEra=()=>eraAt(compYear()),worldEra=()=>eraAt(worldCompYear());
const studyKey=s=>{const c={};for(const p of s.parts)c[p.d.key]=(c[p.d.key]||0)+1;return Object.keys(c).sort().map(k=>k+'×'+c[k]).join(',')};
const studyOf=s=>(PROG.studies||{})[studyKey(s)],studyJob=s=>(PROG.studyQ||[]).find(j=>j.key===studyKey(s));
// the prediction error a design flies with (0 = exact)
function predErr(s){const E=COMP_ERAS[compEra()],st=studyOf(s);return st?Math.min(st.err,E.err[1]):E.err[0]}
function studyQuote(s){const E=COMP_ERAS[compEra()],k=clamp(Math.sqrt(vesselCost(s.parts).cost/50),0.5,3),sp=FAC.centre.speed[facLv('centre')];
  const why=E.err[0]===0?`not needed: ${E.name.toLowerCase()} make predictions exact`:studyOf(s)&&studyOf(s).err<=E.err[1]?'already studied':studyJob(s)?'already in the office':'';
  return{cost:E.study.cost*k,days:E.study.days*k*sp,err:E.err[1],raw:E.err[0],ok:!why,why}}
function orderStudy(s){const q=studyQuote(s);if(!q.ok||PROG.funds<q.cost)return false;PROG.studyQ=PROG.studyQ||[];
  const start=Math.max(PROG.day,...PROG.studyQ.map(j=>j.end));PROG.funds-=q.cost;PROG.studyQ.push({key:studyKey(s),err:q.err,end:start+q.days,era:compEra()});
  HOOK.news(`Trajectory office: a study of this design, ready in ${Math.ceil(start+q.days-PROG.day)} days`,'');HOOK.save();return true}
// days a launch of this design waits for its study (0 if none is pending)
const studyWait=s=>{const j=studyJob(s);return j?Math.max(0,j.end-PROG.day):0};
function compTick(){const Q=PROG.studyQ||[];while(Q.length&&Q[0].end<=PROG.day+1e-9){const j=Q.shift();PROG.studies=PROG.studies||{};PROG.studies[j.key]={err:j.err,day:j.end,era:j.era}}
  const e=compEra();if(PROG.compEra==null)PROG.compEra=e;else if(e>PROG.compEra){PROG.compEra=e;const E=COMP_ERAS[e];HOOK.news(`A new computing era reaches the program: ${E.name.toLowerCase()} (${E.blurb})`,'ok');HOOK.save()}}
function computeHTML(){const E=COMP_ERAS[compEra()],W=COMP_ERAS[worldEra()],Q=PROG.studyQ||[],lag=compLag();
  return`<div class="ep">Compute</div><div class="sub"><b>${E.name}</b> <span class="dim">· ${E.blurb}</span><br>`+
    `<span class="dim">The world: ${W.name.toLowerCase()} · world price index ${W.cpi} · our power ${lag<0.05?'keeps up':`runs ${lag.toFixed(1)} yr behind`}${facLv('centre')?`, the centre puts us ${FAC.centre.ahead[facLv('centre')]} yr ahead of it`:''}</span><br>`+
    `Predictions: ${E.err[0]?`±${Math.round(E.err[0]*100)}% unstudied, ±${Math.round(E.err[1]*100)}% studied`:'exact'} · ${Object.keys(PROG.studies||{}).length} designs studied`+
    (Q.length?`<br>In the office: ${Q.map(j=>`ready day ${Math.ceil(j.end-PROG.day)}`).join(', ')}`:'')+`</div>`}
// ---- the event timeline (design: NOTES "Time, long missions and communication"). Time passes only when you choose:
// by flying, or by advancing the calendar to the next thing that happens. upcoming() gathers what is dated in the
// program: studies, buildings, the design bureau, the test stand, production lines, budget days, elections, sanctions
// lapsing, a computing era arriving, and a day's warning before each contract deadline and decision expiry. Events
// marked stop are the ones that need you: advancing past several stops at the first of those, or at any new decision.
// Launch windows and missions in flight join later (planning, sats, bodies).
function upcoming(){const D=PROG.day,E=[],add=(day,kind,text,stop=false)=>{if(day>D+1e-6)E.push({day,kind,text,stop})};
  for(const j of PROG.studyQ||[])add(j.end,'study','A trajectory study is ready');
  for(const x of PROG.dispatch||[])if(x.status==='queued')add(x.launch,'dispatch',`Dispatched launch: ${x.title}`);
  for(const id in PROG.fac||{}){const f=PROG.fac[id];if(f.building)add(f.building.ready,'build',`${FAC[id].name} level ${f.building.lv} opens`)}
  if(PROG.stand2){add(PROG.stand2.ready,'build','The test stand opens');if(PROG.stand2.job)add(PROG.stand2.job.end,'test',`Test stand: the ${PARTS[PROG.stand2.job.k].name} campaign ends`)}
  if(PROG.devJob)add(PROG.devJob.end,'dev',`Design bureau: the ${PARTS[PROG.devJob.k].name} redesign is done`);
  for(const k in PROG.lines||{}){const L=PROG.lines[k];if(L.power===HOME&&L.ready)add(L.ready,'line',`Production line for the ${PARTS[k].name} opens`)}
  add((Math.floor(D/100)+1)*100,'budget','Budget day');
  if(PROG.nextElection!=null)add(PROG.nextElection,'politics','Election',true);
  for(const i in PROG.sanc||{})add(PROG.sanc[i],'politics',`${POWERS[i].name}'s sanctions lapse`);
  const nx=COMP_ERAS[compEra()+1];if(nx)add(D+(nx.yr-compYear())*YEAR_D,'era',`${nx.name} reach the program`);
  for(const c of PROG.active||[])if(c.deadline!=null)add(c.deadline-1,'deadline',`One day left: ${cTitle(c)}`,true);
  for(const d of PROG.decisions||[])if(d.expires!=null)add(d.expires-1,'decision',`One day left to decide: ${d.title||d.kind}`,true);
  return E.sort((a,b)=>a.day-b.day)}
const nextEvent=()=>upcoming()[0]||null;
// advance the calendar to a day (or the next event), stopping early at an event that needs you or a new decision
function advanceTo(day){if(devWaiting().length)return{kind:'deviation',text:'A dispatched flight needs you'};const n0=(PROG.decisions||[]).length;let stopped=null,guard=0;if(day==null){const e=nextEvent();if(!e)return null;day=e.day}
  while(PROG.day<day-1e-9&&guard++<500){const e=nextEvent(),to=e&&e.day<day?e.day:day;advanceDays(to-PROG.day+1e-9);   // (a hair past, so the event's own tick fires)
    if((PROG.decisions||[]).length>n0){stopped={kind:'decision',text:'A decision is waiting'};break}
    if(devWaiting().length){stopped={kind:'deviation',text:'A dispatched flight needs you'};break}
    if(e&&e.day<day&&e.stop){stopped=e;break}}
  HOOK.save();return stopped}
function timelineHTML(){const E=upcoming().slice(0,8),W=devWaiting();if(!E.length&&!W.length)return'';
  const need=W.map(D=>`<b class="bad">⚠ ${D.title}: ${D.dev.why}.</b> <button data-devtake="${D.id}">Take control</button> <button data-devlose="${D.id}">Let it go</button>`).join('<br>');
  return`<div class="ep">Coming up</div><div class="sub">`+(need?need+(E.length?'<br>':''):'')+E.map((e,i)=>`${e.stop?'<b>':''}in ${Math.ceil(e.day-PROG.day-1e-9)} d · ${e.text}${e.stop?'</b>':''}`+
    ` <button data-adv="${e.day}">${i?'Wait until then':'Wait'}</button>`).join('<br>')+`</div>`}
// ---- dispatch (design: NOTES "Dispatch — the economy's answers"): a contract flown by a stored procedure, without you.
// Only repeats: it needs a procedure for the design (so the design has flown it by hand), and firsts are never
// dispatched (missions aren't contracts). Same costs, stacking and pay as a flight flown by hand. It is queued on a pad:
// pads are reservations on the calendar (one pad, plus the Launch pads facility), and a hand-flown launch waits for a
// free pad too. The outcome is fixed by a seed taken when it's ordered (no re-rolls). The risk estimate comes from the
// part data: the procedure's Δv margin for this target, ignition odds from know-how (and line maturity, development),
// load uncertainty from certification. Good data raises the chance and narrows the range.
// The flight itself: dispatchRun(D) from the physics side (bodies session: the procedure flown headless, with
// deviation handing the flight to the player). Until it exists, dispatchRoll rolls the estimate with the seed (interim).
const DISPATCH_TYPES=['sat','recon'];
const vRot=()=>TELLUS.R*TELLUS.rot;
function dispatchTarget(c){const p=c.p;return{pe:p.alt*1e3,ap:p.alt*1e3,inc:p.inc||0}}
// the estimate for a design (stack) on a contract: {ok, why, p, lo, hi, margin}
function dispatchEstimate(stack,c){const proc=(PROG.procs||{})[procKey(stack)];if(!proc||proc.kind!=='orbit')return{ok:false,why:'no procedure for this design: fly it to orbit by hand first'};
  const v=newShip(stack),T=dispatchTarget(c),R0={orb:{...T,sci:v.parts.some(p=>p.on&&p.d.kind==='sci'),cam:v.parts.some(p=>p.on&&p.d.kind==='cam')},cdone:[]};
  if(!CT[c.type].ok(R0,c.p,{rec:R0,parts:v.parts}))return{ok:false,why:'this design cannot do this contract (its payload)'};
  const a0=(proc.target?(proc.target.pe+proc.target.ap)/2:T.pe),vc=h=>Math.sqrt(TELLUS.mu/(TELLUS.R+h)),
    extra=Math.abs(vc(a0)-vc(T.pe))+vRot()*(1-Math.cos(T.inc*Math.PI/180)),margin=dvRemaining(v).tot-proc.dv-extra;
  const pM=1/(1+Math.exp(-(margin-40)/25));let pI=1,pS=1,nk=0,uk=0,uc=0;
  const eng=v.parts.filter(p=>p.on&&p.d.kind==='engine'),last=Math.max(...eng.map(p=>p.seg??0));
  let pT=1;for(const p of eng){const L=prodLine(p.d.key),f=0.6**devLv(p.d.key,'rel')*IGN_FAIL*(1-khUse(p.d.key))**2*(L?2-L.m:1);pI*=1-f;if((p.seg??0)===last)pT*=1-f}   // the top stage lights twice: once in the ascent, once to circularise (pT)
  pI*=pT;
  for(const p of v.parts){if(!p.on)continue;const c1=certOf(p.d.key);pS*=1-0.02*(1-c1);uc+=1-c1;uk+=1-khUse(p.d.key);nk++}
  const pr=pM*pI*pS,unc=nk?0.4*uc/nk+0.4*uk/nk:0;
  return{ok:margin>-50,why:margin>-50?'':`${Math.round(-margin)} m/s short for this orbit`,p:pr,lo:clamp(pr*(1-unc),0,1),hi:clamp(pr*(1+unc/2),0,1),margin,proc,pM,pS,pRelight:pT,pLow:pI/pT}}
const padsN=()=>1+facLv('pads');
// when each pad is next free, from today (dispatch reservations)
function padsFree(){const D=PROG.day,f=Array.from({length:padsN()},()=>D);for(const x of PROG.dispatch||[])if(x.status==='queued'&&x.pad<f.length)f[x.pad]=Math.max(f[x.pad],x.launch);return f}
const padWait=()=>Math.max(0,Math.min(...padsFree())-PROG.day);
// the designs with a procedure that could fly this contract, best chance first
function dispatchOptions(c){if(!DISPATCH_TYPES.includes(c.type))return[];const out=[];
  for(const key in PROG.procs||{}){let st;try{st=JSON.parse(key)}catch(e){continue}if(!Array.isArray(st))continue;const e=dispatchEstimate(st,c);if(e.ok)out.push({stack:st,e})}
  return out.sort((a,b)=>b.e.p-a.e.p)}
function dispatchQuote(c,stack){const e=dispatchEstimate(stack,c);if(!e.ok)return e;const v=newShip(stack),cost=vesselCost(v.parts).cost,
  prep=prepDays(cost)*(1+0.5*(1-khVessel(v)))*FAC.hall.eff[facLv('hall')],f=padsFree(),pad=f.indexOf(Math.min(...f)),start=f[pad];
  const busy=(PROG.dispatch||[]).some(x=>x.status==='queued'&&x.cid===c.id);
  return{...e,ok:!busy,why:busy?'already dispatched':'',cost:cost+OPS_FIX+OPS_FRAC*cost,prep,pad,start,launch:start+prep}}
function orderDispatch(c,stack){const q=dispatchQuote(c,stack);if(!q.ok)return false;PROG.dispatch=PROG.dispatch||[];PROG.dispN=(PROG.dispN||0)+1;
  PROG.dispatch.push({id:PROG.dispN,cid:c.id,title:cTitle(c),stack,pad:q.pad,launch:q.launch,seed:(PROG.wseed^(PROG.dispN*2654435761))>>>0,est:{p:q.p,lo:q.lo,hi:q.hi},status:'queued',ordered:PROG.day});
  HOOK.news(`Dispatched: ${cTitle(c)}, ${designName(stack)||'our design'} on pad ${q.pad+1}, launch in ${Math.ceil(q.launch-PROG.day)} days (success ~${Math.round(q.p*100)}%)`,'');HOOK.save();return true}
// interim resolver: the estimate rolled with the dispatch's own seed, the orbit scattered by the procedure and the compute era
function dispatchRoll(D,v,c){const R=rng(D.seed),e=dispatchEstimate(D.stack,c);if(!e.ok)return{ok:false,why:e.why};
  if(R()>=e.pS)return{ok:false,why:'it broke up in the climb'};if(R()>=e.pLow)return{ok:false,why:'an engine failed to light in the ascent; range safety ended the flight'};
  if(R()>=e.pM)return{deviation:{kind:'short',why:'running short of propellant: the circularisation can\'t be finished as planned',entry:devState(D,c,'short')}};
  if(R()>=e.pRelight)return{deviation:{kind:'relight',why:'the upper stage failed to relight for the circularisation',entry:devState(D,c,'relight')}};
  const T=dispatchTarget(c),sk=(3+40*predErr(v))*1e3,j=()=>(R()-0.5)*2*sk,pe=T.pe+j(),ap=T.ap+Math.abs(j());
  return{ok:true,orb:{pe:Math.min(pe,ap),ap:Math.max(pe,ap),inc:T.inc+(R()-0.5)*0.4,sci:v.parts.some(p=>p.on&&p.d.kind==='sci'),cam:v.parts.some(p=>p.on&&p.d.kind==='cam')},dv:e.proc.dv}}
// ---- deviation: the dispatch can't meet its goal and hands the flight to you. Time stops (advanceTo won't move while a
// deviation waits), and the flight is yours from that moment: take control, or let it go. If time moves on without you
// (a hand-flown launch, say), nobody was at the console and it's lost. A handed-over flight can't be reverted, or
// dispatches could be re-rolled. The state is a registry entry (vesselOf rebuilds it), as the physics side's
// dispatchRun will give; the interim resolver builds one for its two cases: the upper stage at apoapsis on the ascent's
// transfer orbit (periapsis in the air), with the propellant the circularisation needs ('relight') or too little ('short').
const devWaiting=()=>(PROG.dispatch||[]).filter(x=>x.status==='deviated');
function devState(D,c,kind){const v=newShip(D.stack),e=dispatchEstimate(D.stack,c),T=PROG.day*DAY_S,alt=c.p.alt*1e3,ra=TELLUS.R+alt,rp=TELLUS.R+30e3;
  let n=0;while(v.events.slice(v.evIdx).some(x=>x.decouple.length)&&n++<20)stage(v);   // drop down to the top stage (lit in the ascent)
  const va=Math.sqrt(TELLUS.mu*2*rp/(ra*(ra+rp))),need=Math.sqrt(TELLUS.mu/ra)-va,want=kind==='short'?0.6*need:need+Math.max(0,e.margin||0);
  const tanks=v.parts.filter(p=>p.on&&p.res&&Object.keys(p.res).length),full=tanks.map(p=>({...p.res}));let lo=0,hi=1;
  const setK=k=>tanks.forEach((p,i)=>{for(const x in p.res)p.res[x]=full[i][x]*k});
  for(let i=0;i<40;i++){const m=(lo+hi)/2;setK(m);geom(v);if(dvRemaining(v).tot<want)lo=m;else hi=m}setK(hi);geom(v);
  const site=homeSites()[0]||SITES[0],u=norm(fromPF(TELLUS,site.u,T)),east=norm(cross([0,1,0],u)),dr=0.4,up=norm(add(mul(u,Math.cos(dr)),mul(east,Math.sin(dr)))),pro=norm(cross([0,1,0],up));
  const rr=mul(up,ra),vv=mul(pro,va),X=norm(cross(pro,up)),q=qFromBasis(X,pro,cross(X,pro));v.r=rr;v.v=vv;v.q=q;
  const on=v.parts.filter(p=>p.on);
  return{stack:JSON.parse(JSON.stringify(D.stack)),shape:shapeOf(on,false),vst:vstOf(v),r:rr,v:vv,epoch:T,qo:qmul(qconj(orbQ(rr,vv)),q),cm:(v.cm||[0,0,0]).slice(),name:`${designName(D.stack)||'Dispatch'} ${D.id}`,attached:[]}}
function loseDeviation(id,why){const D=(PROG.dispatch||[]).find(x=>x.id===id&&x.status==='deviated');if(!D)return false;D.status='failed';D.why=why||D.dev.why;
  HOOK.news(`Dispatched flight lost: ${D.title}. ${D.why}`,'bad');HOOK.save();return true}
function dispatchTick(){for(const D of devWaiting())if(PROG.day>D.dev.at+0.5)loseDeviation(D.id,`${D.dev.why}, and nobody was at the console`);
  for(const D of PROG.dispatch||[]){if(D.status!=='queued'||PROG.day<D.launch-1e-9)continue;
  const c=(PROG.active||[]).find(x=>x.id===D.cid);if(!c){D.status='cancelled';HOOK.news(`Dispatch stood down: ${D.title} is no longer on our books`,'warn');continue}
  const site=homeSites()[0]||null;if(site&&siteWeather(site,PROG.day*DAY_S).scrub&&(D.slips||0)<SCRUB_MAX){D.slips=(D.slips||0)+1;D.launch+=1;HOOK.news(`Weather scrub: the dispatched ${D.title} slips a day`,'warn');continue}
  const v=newShip(D.stack),cost=vesselCost(v.parts).cost,ops=OPS_FIX+OPS_FRAC*cost;if(PROG.funds<cost+ops){D.launch+=10;HOOK.news(`Dispatch held: not enough money to fly ${D.title}; 10 days`,'warn');continue}
  PROG.funds-=cost+ops;importNews(v);prodUnits(v);PROG.flights++;
  const run=HOOK.dispatchRun||(typeof dispatchRun==='function'?dispatchRun:null),res=run?run(D,v,c):dispatchRoll(D,v,c);
  if(res.deviation){D.status='deviated';D.dev={...res.deviation,at:PROG.day};HOOK.news(`⚠ A dispatched flight needs you: ${D.title}. ${res.deviation.why}`,'bad');HOOK.save();continue}
  D.status=res.ok?'done':'failed';D.flown=PROG.day;D.why=res.why||'';if(res.orb)D.orb=res.orb;
  const seen={};for(const p of v.parts)if(p.on)seen[p.d.key]=p.d.kind==='engine'?{fly:1,maxq:1,burn:1}:{fly:1,maxq:1};khLearn({khSeen:seen});
  if(res.ok){const R={orb:res.orb,cdone:[],dv:res.dv,dispatched:true};contractEval({rec:R,parts:v.parts});
    HOOK.news(R.cdone.length?`Dispatched flight to orbit: ${res.orb.pe/1e3|0}×${res.orb.ap/1e3|0} km, ${R.cdone.join(', ')}`:`Dispatched flight reached ${res.orb.pe/1e3|0}×${res.orb.ap/1e3|0} km, outside the contract's window`,R.cdone.length?'ok':'warn')}
  else HOOK.news(`Dispatched flight lost: ${D.title}. ${D.why}`,'bad');
  HOOK.save()}}
function dispatchLine(c){const O=dispatchOptions(c);if(!O.length&&!DISPATCH_TYPES.includes(c.type))return'';const D=(PROG.dispatch||[]).find(x=>x.status==='queued'&&x.cid===c.id);
  if(D)return`<div class="sub dim">Dispatched: ${designName(D.stack)||'our design'} on pad ${D.pad+1}, launches in ${Math.ceil(D.launch-PROG.day)} d (~${Math.round(D.est.p*100)}%)</div>`;
  if(!O.length)return`<div class="sub dim">Dispatch: no stored procedure can fly this yet (fly one to orbit by hand)</div>`;
  const o=O[0],q=dispatchQuote(c,o.stack),pc=x=>Math.round(x*100);
  return`<div class="sub">Dispatch ${designName(o.stack)||'our design'}: success ~${pc(o.e.p)}% (${pc(o.e.lo)}–${pc(o.e.hi)}%), launches in ${Math.ceil(q.launch-PROG.day)} d on pad ${q.pad+1}, ${fmtM(q.cost)} `+
    `<button data-disp="${c.id}" ${q.ok?'':'disabled'}>Dispatch</button></div>`}
function devTick(){const J=PROG.devJob;if(!J||PROG.day<J.end)return;PROG.devJob=null;PROG.dev=PROG.dev||{};const e=PROG.dev[J.k]||(PROG.dev[J.k]={});e[J.g]=(e[J.g]||0)+1;
  PROG.cert[J.k]=Math.max(0.5,certOf(J.k)-0.1);PROG.kh=PROG.kh||{};const h=PROG.kh[J.k]||(PROG.kh[J.k]={use:use0(J.k),reg:{}});h.use=Math.max(0,h.use-0.1);
  HOOK.news(`New design: the ${PARTS[J.k].name} is ${DEV_GOALS[J.g].toLowerCase()} (mark ${(e.cheap||0)+(e.rel||0)+(e.dur||0)+1}); it has to prove itself again`,'ok');HOOK.save()}
function standTick(){const S2=PROG.stand2;if(!S2||!S2.job||PROG.day<S2.job.end)return;const{k,mode}=S2.job,d=PARTS[k];S2.job=null;S2.done++;
  const seen={fly:1,maxq:1,heat:1};if(d&&d.kind==='engine')seen.burn=1;
  if(mode==='destroy'){PROG.cert[k]=1;khLearn({khSeen:{[k]:{fail:1}},novMin:STAND_NOV},STAND_W);HOOK.news(`Tested to destruction: the ${d.name}'s true limits are known`,'ok')}
  else{const c=certOf(k);PROG.cert[k]=1-(1-c)*(1-0.5*Math.min(1,0.6/0.4));khLearn({khSeen:{[k]:seen},novMin:STAND_NOV},STAND_W);HOOK.news(`Qualification run complete: ${d.name}`,'ok')}
  HOOK.save()}
// an ignition event: each engine in the segment rolls against its know-how (deterministic per flight, kick and part)
// ---- production lines: learning to manufacture a part is different from buying it. A line costs capital and time to
// set up: ~4× the part's price × (1 + tier), 40 + 30·tier days. Your own line (reverse-engineering) needs real know-how
// of the part (≥ 40 % use); a license from a supplier that makes it (friendly, not sanctioning us) costs 60 %, is
// quicker, starts more mature, and pays the licensor 10 % royalty per unit. Every unit built raises maturity m
// (+12 %·(1 − m) per unit): the price per unit runs from ×1.25 at m = 0 to ×0.75 at m = 1, so building at home ends up
// cheaper than buying; an immature line's engines are rougher (ignition failures ×(2 − m)); line parts start with more
// know-how and certification. Lines belong to the country: they ignore sanctions (a license keeps running) and stay
// behind on a defection.
const LINE_ROYALTY=0.1;
function prodLine(k){const L=(PROG.lines||{})[k];return L&&L.power===HOME&&PROG.day>=L.ready?L:null}
const prodLineK=L=>(1.25-0.5*L.m)+(L.lic!=null?LINE_ROYALTY:0);
function prodQuote(k){const t=tierOf(k),base=(PRICE[k]??3)*4*(1+t),days=40+30*t,x=sourceOf(k),lic=x.how==='import'?x.from:null;
  const can=khUse(k)>=0.4,licOK=lic!=null&&relOf(HOME,lic)>0.2&&!sanctioned(lic);
  return{own:{cost:base,days,ok:can,why:can?'':'we need to know it better first (fly it: know-how 40 %+)'},lic:{cost:base*0.6,days:Math.round(days*0.7),ok:licOK,from:lic,
    why:lic==null?'no foreign maker to license from':!licOK?`${POWERS[lic].root} won't license it`:''}}}
function startProdLine(k,mode){const Q=prodQuote(k)[mode];if(!Q.ok||PROG.funds<Q.cost)return false;const L0=(PROG.lines||{})[k];if(L0&&L0.power===HOME)return false;
  PROG.funds-=Q.cost;(PROG.lines=PROG.lines||{})[k]={power:HOME,lic:mode==='lic'?Q.from:null,start:PROG.day,ready:PROG.day+Q.days,m:mode==='lic'?0.3:0.05,units:0};
  if(mode==='lic')opAdd(Q.from,3);else opAdd(HOME,2*natK());
  HOOK.news(mode==='lic'?`License signed: ${POWERS[Q.from].root}'s ${PARTS[k].name} will be built under license (${Q.days} days to tool up)`:`A production line for the ${PARTS[k].name}: ${Q.days} days to tool up`,'ok');HOOK.save();return true}
function prodUnits(s){for(const k of new Set(s.parts.map(p=>p.d.key))){const L=prodLine(k);if(!L)continue;const n=s.parts.filter(p=>p.d.key===k).length;
  for(let i=0;i<n;i++){L.m+=0.12*(1-L.m);L.units++}if(L.lic!=null)opAdd(L.lic,0.2)}}
function igniteOK(s,k){if(TEST.nofail||!khOn()||!s.rec)return true;
  for(const p of s.parts){if(!p.on||p.seg!==k||p.d.kind!=='engine')continue;const L=prodLine(p.d.key),f=0.6**devLv(p.d.key,'rel')*IGN_FAIL*(1-khUse(p.d.key))**2*(L?2-L.m:1);   // early units from a young line are rougher
    const x=((Math.sin((PROG.flights+1)*12.9898+(s.kickN||0)*78.233+p.i*37.719)*43758.5453)%1+1)%1;
    if(x<f){const set=s.rec.khSeen[p.d.key]||(s.rec.khSeen[p.d.key]={});set.fail=1;
      HOOK.msg(`${p.d.name} failed to ignite (we're still learning it)`);return false}}
  return true}
// generated flavours: the two biggest economies are the superpowers (open or closed by their second alignment axis), the
// rest by what they have: rich and low-tech → resource state, high tension of alignment → security state, etc.
(()=>{const R=rng(777),big=POWERS.slice().sort((a,b)=>b.econ*b.tech-a.econ*a.tech);
  big.forEach((p,k)=>{p.arch=k<2?(p.align[1]>0?'closedSuper':'openSuper'):p.econ>1.3&&p.tech<0.85?'resource':p.align[1]>0.4?'security':p.tech>0.95?'rising':R()<0.6?'frugal':'rising'});
  if(big[0].arch===big[1].arch)big[1].arch=big[0].arch==='openSuper'?'closedSuper':'openSuper'})();   // a rivalry needs both kinds
const archOf=i=>i===0&&PROG.homeArch?PROG.homeArch:POWERS[i].arch,flav=i=>ARCH[archOf(i)];
const natOf=i=>(PROG.nat||{})[i]??flav(i).nat,natK=()=>0.3+1.4*natOf(HOME);   // natK: 1 at nationalism 0.5
const tensionOf=i=>Math.max(0,...POWERS.filter(p=>p.i!==i).map(p=>-relOf(i,p.i)));
const natWord=n=>n>.7?'fervent':n>.5?'high':n>.3?'moderate':'low';
// failures at home: open programs take the whole hit now; closed ones a part, the rest piles up as leak risk
function failHit(x,what){const o=flav(HOME).open;opAdd(HOME,x*(0.4+0.6*o));
  if(o<0.5){PROG.hush=(PROG.hush||0)+1;PROG.hushPen=(PROG.hushPen||0)+x*0.6*(1-o)*1.5;HOOK.news(`Officially, nothing happened (${what})`,'warn')}}
function flavTick(d,R){PROG.nat=PROG.nat||{};
  for(const p of POWERS){const n=natOf(p.i),tgt=clamp(flav(p.i).nat+0.3*tensionOf(p.i),0,1);PROG.nat[p.i]=n+(tgt-n)*(1-Math.exp(-d/200))}
  // the commodity cycle (its own clock, ~500 days)
  const c0=PROG.comm||0;PROG.commPh=(PROG.commPh??R()*6.28)+d*6.2832/500+(R()-.5)*0.2*Math.sqrt(d/10);PROG.comm=clamp(0.8*Math.sin(PROG.commPh),-1,1);
  if(flav(HOME).money==='commodity'){if(c0<0.5&&PROG.comm>=0.5)HOOK.news('Commodity boom: the treasury is overflowing','ok');if(c0>-0.5&&PROG.comm<=-0.5)HOOK.news('Commodity bust: belts tighten everywhere, rockets included','bad')}
  const F=flav(HOME);
  // leaks of hushed-up failures: likelier the more there are
  if(PROG.hush&&R()<1-Math.exp(-d*0.002*PROG.hush)){opAdd(HOME,PROG.hushPen);   // hushPen is the (negative) deferred hit
    HOOK.news(`Leaked: the program quietly lost ${PROG.hush} flight${PROG.hush>1?'s':''} it never admitted to`,'bad');PROG.hush=0;PROG.hushPen=0}
  // elections (open programs): budget mood for the next term
  if(F.open>=0.6){if(PROG.nextElection==null)PROG.nextElection=300+R()*200;
    if(PROG.day>=PROG.nextElection-50&&!PROG.electionWarned){PROG.electionWarned=true;HOOK.news('Election in 50 days: a success now would not hurt','warn')}
    if(PROG.day>=PROG.nextElection){const o=opOf(HOME);PROG.bmult=o>55?1.25:o<40?0.7:1;PROG.nextElection+=400;PROG.electionWarned=false;
      HOOK.news(o>55?'Re-elected: the government doubles down on space':o<40?'New government trims the space budget':'Election: the space budget survives, unchanged',o>55?'ok':o<40?'bad':'')}}
  // the leadership's demand for a spectacular (closed programs)
  if(F.open<0.5){if(PROG.demand&&PROG.day>PROG.demand.by){opAdd(HOME,-10);HOOK.news('The leadership is displeased: no spectacular by the anniversary','bad');PROG.demand=null}
    if(!PROG.demand&&stateShare()>=0.5&&R()<1-Math.exp(-d/260)){PROG.demand={by:PROG.day+60};HOOK.news('The leadership wants a spectacular by the anniversary, 60 days from now: a first, or a contract worth 40M+','warn')}}
  // regime change can cancel a security state's program
  if(F.cancel&&!PROG.cancelled&&stateShare()>=0.5&&opOf(HOME)<35&&R()<1-Math.exp(-d/600))cancelProgram(R)}
function importNews(s){const ks=[...new Set(s.parts.map(p=>p.d.key))],src=ks.map(k=>[k,sourceOf(k)]),grey=src.filter(x=>x[1].how==='grey'),imp=src.filter(x=>x[1].how==='import');
  if(grey.length)HOOK.news(`Bought through intermediaries at triple the price: ${grey.map(x=>PARTS[x[0]].name).join(', ')}`,'warn');
  if(imp.length||grey.length)opAdd(HOME,-0.4*natK()*(imp.length+grey.length)/Math.max(1,ks.length))}
function demandMet(why){if(!PROG.demand)return;PROG.demand=null;opAdd(HOME,8);if(flav(HOME).money==='patronage')PROG.funds+=30;
  HOOK.news(`The leadership is delighted (${why})${flav(HOME).money==='patronage'?': +30M':''}`,'ok')}
function cancelProgram(R){PROG.cancelled=true;PROG.bmult=0;PROG.decisions=(PROG.decisions||[]).filter(x=>x.kind!=='defect'&&x.kind!=='hire');   // these two replace any pending career offers
  HOOK.news(`Regime change in ${POWERS[HOME].name}: the new government cancels the space program`,'bad');
  const c=POWERS.filter(p=>p.i!==HOME&&!sanctioned(p.i)).sort((a,b)=>b.econ*opOf(b.i)-a.econ*opOf(a.i))[0],V=valuation();
  if(c)offerDecision({kind:'defect',power:c.i,amt:Math.round(40+V*0.3),life:40,title:`${c.name} offers the cancelled team a new home`,text:'The program is cancelled at home. Defect, and it lives on as theirs.',opts:[['yes',`Go to ${c.root}`],['no','No']]});
  offerDecision({kind:'hire',co:`${POWERS[HOME].root} Space Collective`,amt:Math.round(30+V*0.15),life:40,title:'Go private with what is left',text:'The team keeps the hardware and its knowledge, as a private company with little money.',opts:[['yes','Go private'],['no','No']]})}   // "our government": power 0 (the launch site's) until the program changes hands (career moves)
function powerAt(pf){const u=norm(pf);if(!isLand(u))return null;let best=null,bd=Infinity;
  for(const p of POWERS){const d=Math.acos(clamp(dot(u,p.u),-1,1))-0.12*Math.log(p.econ);if(d<bd){bd=d;best=p}}return best}
for(const c of CITIES)c.power=powerAt(c.u);
extendSites();   // the launch sites need the powers' land (terrain session)
