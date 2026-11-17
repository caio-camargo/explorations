'use strict';
// sim/crew.js — the roster (QUEUE Q182, crew slice 1; notes/economy.md § "Plan revision: crew by qualification", W24,
// W43). Part of index.html's script, a classic script sharing one global scope with the others (NOTES § "The file
// split"). Pure SIM. Astronauts are people: named in the home school's style, selected as a class, picked for each crewed
// flight by seniority, carried on their seats (`p.crewIds`, beside Q606's `crewAboard`) through the registry, and
// counted when they come home. A loss names them and puts them in `PROG.memorial`. No qualifications yet (slice 2):
// every pilot counts as qualified on every type, which is the behaviour before the roster.
const CREW_CLASS=3;   // the first class: 3 people + 1 per computing-centre level (W24)
// (Q626, classes over time; Q133's rest) a class every two program years, the same size (a resource state's, 2: it buys
// seats more than it trains people, CREW § hooks); pilots, then scientists once people have been to orbit and engineers
// once a station or base is up, in the archetype's mix (security: pilots first; frugal: scientist-heavy)
const CREW_EVERY=730,CREW_SPEC={fly:'pilot',sci:'scientist',eng:'engineer'};
const CREW_ORD=[,'first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
const CREW_MIX={security:{fly:.8,sci:.1,eng:.1},frugal:{fly:.3,sci:.5,eng:.2}},CREW_MIX0={fly:.5,sci:.3,eng:.2};
const crewClassN=()=>archOf(HOME)==='resource'?2:CREW_CLASS+facLv('centre');
// [n, specs]: at least one pilot, the rest by the mix's largest remainders among what's open
function crewMix(n){const W={...(CREW_MIX[archOf(HOME)]||CREW_MIX0)};if(!(PROG.crewFirst&&PROG.crewFirst.orbit))W.sci=0;
  if(!(typeof stPick==='function'&&stPick(()=>true)))W.eng=0;const t=W.fly+W.sci+W.eng,ks=['fly','sci','eng'];
  const q=ks.map(k=>W[k]/t*(n-1)),c=q.map(Math.floor);let left=n-1-c.reduce((a,b)=>a+b,0);
  ks.map((k,i)=>i).sort((i,j)=>(q[j]-c[j])-(q[i]-c[i])||i-j).forEach(i=>{if(left>0&&W[ks[i]]>0){c[i]++;left--}});c[0]+=1+left;
  const specs=[];ks.forEach((k,i)=>{for(let j=0;j<c[i];j++)specs.push(k)});return[n,specs]}
const CREW_FIRSTS={flight:'first people to fly',orbit:'first people in orbit',sel:'first people around Selene',selLand:'first people on Selene',days60:'first to spend 60 days in space'};
const crewById=id=>(PROG.crew||[]).find(a=>a.id===id);
// seniority (W43 5): the firsts they flew, then flights, then the earlier class; the most senior aboard commands
const crewRank=(a,b)=>b.sen.length-a.sen.length||b.rec.flights-a.rec.flights||a.cls-b.cls||a.id-b.id;
const crewList=as=>as.length<2?as.map(a=>a.name).join(''):as.slice(0,-1).map(a=>a.name).join(', ')+' and '+as[as.length-1].name;
// a given and a family name from the home school's syllables (v1.89's SCHOOLS), on their own seeded draws; unique
function crewName(id){const S=SCHOOLS[(POWERS[HOME]||{}).school]||SCHOOLS.cape,used=new Set((PROG.crew||[]).map(a=>a.name));let nm='';
  for(let t=0;t<40&&(!nm||used.has(nm));t++){const R=rng(((PROG.wseed||1)*7919+id*104729+t*31+5)|0),
      w=()=>{const n=S.n[0]+(R()*(S.n[1]-S.n[0]+1)|0);let x='';for(let k=0;k<n;k++)x+=S.syl[R()*S.syl.length|0];return x[0].toUpperCase()+x.slice(1)};
    nm=w()+' '+w()}
  return nm}
function crewHire(n,specs=[]){PROG.crew=PROG.crew||[];PROG.crewCls=(PROG.crewCls||0)+1;const out=[];
  for(let k=0;k<n;k++){const id=PROG.crewN=(PROG.crewN||0)+1;
    const a={id,name:crewName(id),spec:specs[k]||'fly',cls:PROG.crewCls,joined:PROG.day,status:'ready',where:null,up:null,quals:{},type:{},sen:[],rec:{flights:0,days:0,walked:[]}};
    PROG.crew.push(a);out.push(a)}
  return out}
// the first class is selected when the abort tests open (W24 1), so the people exist while the tower is qualified
const crewOpen=()=>!!(PROG.done&&(PROG.done.maxqabort||PROG.done.padabort||PROG.done.orbiter));   // padabort's req is the orbiter
function crewClassTick(){if(!crewOpen())return;
  if(!(PROG.crew||[]).length){const c=crewHire(crewClassN());PROG.crewNext=PROG.day+CREW_EVERY;HOOK.news(`The first class of astronauts: ${crewList(c)}`,'ok');return}
  if(PROG.crewNext==null){PROG.crewNext=PROG.day+CREW_EVERY;return}   // (an older save's roster) the next class two years on
  if(PROG.day<PROG.crewNext)return;PROG.crewNext+=CREW_EVERY;if(PROG.day>=PROG.crewNext)PROG.crewNext=PROG.day+CREW_EVERY;   // one class however long the jump
  const c=crewHire(...crewMix(crewClassN())),ord=CREW_ORD[PROG.crewCls]||`class ${PROG.crewCls}`;
  HOOK.news(`The ${ord} class of astronauts: ${crewList(c.map(a=>({name:a.spec==='fly'?a.name:`${a.name} (${CREW_SPEC[a.spec]})`})))}`,'ok')}
// the title (CREW § Every astronaut; Q626): the most senior flier of a crew of two or more commands; then by what they do,
// in the home school's words (Steppe: research cosmonaut, bortinzhener). Not stored: a title change is no promotion
const crewTitle=(a,crew)=>{if(a.spec==='fly'||!a.spec)return crew.length>1&&crew.filter(x=>x.spec==='fly'||!x.spec).sort(crewRank)[0]===a?'commander':'pilot';
  const st=(POWERS[HOME]||{}).school==='steppe';return a.spec==='sci'?(st?'research cosmonaut':'scientist-astronaut'):(st?'bortinzhener':'flight engineer')};
// at the flight's first tick, people flying (not dummies): the most senior ready astronauts fill the empty seats. With too
// few ready (the rest aboard a station, held abroad), the office selects more at once rather than refusing the flight
function crewPick(s,R){const n=s.parts.reduce((a,p)=>a+(p.on&&p.d.crew&&!p.crewAboard?p.d.crew:0),0);if(!n)return[];crewClassTick();
  let ready=(PROG.crew||[]).filter(a=>a.status==='ready').sort(crewRank);
  if(ready.length<n){const c=crewHire(n-ready.length);HOOK.news(`${crewList(c)} ${c.length>1?'are':'is'} selected in a hurry to fill the seats`,'warn');ready=ready.concat(c)}
  // (Q626) by what the flight needs: the best pilot on this capsule first (the most modes, then seniority); a scientist
  // on a lander (legs), an engineer for a station (a target with berths); the rest by seniority
  const cap=(s.parts.find(p=>p.on&&p.d.crew&&!p.crewAboard)||{d:{}}).d.key,go=[],take=a=>{if(a&&!go.includes(a)&&go.length<n)go.push(a)};
  take(ready.filter(a=>a.spec==='fly'||!a.spec).sort((a,b)=>pilotModes(b,cap).length-pilotModes(a,cap).length||crewRank(a,b))[0]);
  if(s.parts.some(p=>p.on&&p.d.kind==='leg'))take(ready.find(a=>a.spec==='sci'&&!go.includes(a)));
  {const T=s.target!=null&&(PROG.sats||[]).find(q=>q.id===s.target);if(T&&typeof stOf==='function'&&stOf(T))take(ready.find(a=>a.spec==='eng'&&!go.includes(a)))}
  for(const a of ready)take(a);
  if(go[0]&&cap&&!pilotModes(go[0],cap).length&&avOf(s).modes)HOOK.news(`${go[0].name} flies the ${capName(cap)} new to it: the autopilot's modes only, until a flight in it`,'warn');for(const a of go){a.status='flying';a.up=R.day0??PROG.day;a.rec.flights++}
  R.crew=go.map(a=>a.id);return R.crew.slice()}
// the people on a vessel's seats (ids), the most senior first
const crewSeated=s=>s.parts.filter(p=>p.on&&p.crewIds).flatMap(p=>p.crewIds).map(crewById).filter(Boolean).sort(crewRank);
// a crew lost (outThere): named, gone from the roster, in the memorial; a closed power's loss is hushed (shown when it leaks)
function crewLose(ids,R,s){const as=[...new Set(ids)].map(crewById).filter(a=>a&&a.status!=='lost'),hushed=flav(HOME).open<0.5;
  PROG.memorial=PROG.memorial||[];
  for(const a of as){PROG.memorial.push({id:a.id,name:a.name,title:crewTitle(a,as),day:(R.day0??PROG.day)+simT/DAY_S,flight:PROG.flights+1,
    vessel:s.name||(s.stack?designName(s.stack):''),cause:R.crewWhy||'were lost',hushed});a.status='lost';a.where=null}
  R.crewLost=as.map(a=>a.id);return as}
// the flight's end (missionEnd, after the registry and recovery): who is aboard a registered vessel stays there; who came
// down is ready again (or held abroad, Q616) with the days counted; the program's crewed firsts name the people who flew them
function crewEnd(s,R){if(!(PROG.crew||[]).length)return;const day=PROG.day,reg=new Map(),seats=new Set();
  for(const q of PROG.sats||[])for(const o of q.shape||[])for(const id of o.who||[])reg.set(id,q);
  for(const p of s.parts)if(p.on&&p.crewIds)for(const id of p.crewIds)seats.add(id);
  const flown=new Set([...(R.crew||[]),...seats]),back=[];
  for(const a of PROG.crew){if(a.status==='lost')continue;const q=reg.get(a.id);
    if(q){a.status='aboard';a.where=q.id;continue}
    if(!flown.has(a.id)&&a.status!=='flying')continue;   // aboard a vessel this flight never touched
    a.status=R.heldD?'held':'ready';a.held=R.heldD||null;a.where=null;if(a.up!=null){a.rec.days+=Math.max(0,day-a.up);a.up=null}back.push(a)}
  if(!(R.crewed&&R.crewOK))return;
  const who=[...flown].map(crewById).filter(a=>a&&a.status!=='lost').sort(crewRank),F=PROG.crewFirst=PROG.crewFirst||{};
  if(R.crewSelLand)for(const a of who)if(!a.rec.walked.includes('Selene'))a.rec.walked.push('Selene');
  const first=(k,ok,as)=>{if(!ok||F[k]||!as.length)return;F[k]={day,ids:as.map(a=>a.id)};for(const a of as)a.sen.push({k,day});
    HOOK.news(`${crewList(as)}: the ${CREW_FIRSTS[k]}`,'ok');(R.crewFirsts=R.crewFirsts||[]).push(k)};
  first('flight',true,who);first('orbit',!!R.orbit,who);first('sel',!!R.crewSel,who);first('selLand',!!R.crewSelLand,who);
  first('days60',true,back.filter(a=>a.rec.days>=60))}
// (Q616) a crew a hostile power held is let go, whatever the answer
function crewRelease(did){for(const a of PROG.crew||[])if(a.status==='held'&&a.held===did){a.status='ready';a.held=null}}
// ---- requalification after a loss (QUEUE Q183; W24 4; CREW § "Requalification after a loss"; notes/economy.md § v1.350).
// A crew lost sets PROG.requal from the flight record: what killed them and how far the flight had gone. Until a real
// flight (not the simulator: what was wrong was the truth) takes the crew capsule as far, with dummies, and brings it
// home inside every limit (g, cabin, air), capsules fly dummies. Not refused: the flight that carries the dummies is the
// qualification flight, so a loss costs a flight and a design problem, not a wait (pillars 2, 5). A closed power is
// offered the skip: fly people again now, hushed, the cause unfixed; each crewed flight until a qualification flight
// adds to what can leak.
const REQUAL_FAR=0.9;   // as far as the lost flight went, within this share
function requalKind(s,R){const cap=s.parts.find(p=>p.on&&p.d.crew);return!s.alive||!cap?'lost':R.cgMax>G_LIM?'g':R.ccab>CABIN_MAX?'cabin':'air'}
const requalHolds=()=>!!(PROG.requal&&!PROG.requal.skip);
const requalKm=q=>Math.max(0,q.far||0)/1000;
// what the qualification flight has to show, in a line (the Rollout, the news)
const requalWhat=q=>`fly a crew capsule uncrewed${q.far>1000?` to ${requalKm(q).toFixed(0)} km${q.body&&q.body!=='Tellus'?` (${q.body})`:''}`:''} and bring it home inside the limits${q.kind==='g'?` (it was ${q.val.toFixed(1)} g)`:q.kind==='cabin'?` (the cabin reached ${q.val.toFixed(0)} K)`:q.kind==='air'?' (the air ran out)':''}`;
function requalSet(s,R,as){const q={kind:requalKind(s,R),why:R.crewWhy||'were lost',val:0,far:R.far||0,body:s.body&&s.body.name,
    day:PROG.day,flight:PROG.flights+1,design:s.stack?designName(s.stack):s.name||'',names:as.map(a=>a.name),skip:false};
  q.val=q.kind==='cabin'?R.ccab:q.kind==='g'?R.cgMax:0;PROG.requal=q;
  HOOK.news(`Crews stand down until the cause is fixed: ${requalWhat(q)}`,'warn');
  if(flav(HOME).open<0.5)offerDecision({kind:'requal',life:60,title:'Requalify, or fly again now?',
    text:`The loss is not public. Requalify (${requalWhat(q)}), or put a crew up again now, hushed, the cause unfixed: each crewed flight until a qualification flight adds to what can leak.`,
    opts:[['requal','Requalify first'],['skip','Fly again now, hushed']]})}
function requalAnswer(d,key){if(key!=='skip'||!PROG.requal)return;PROG.requal.skip=true;HOOK.news('Crews fly again. Officially, nothing needed fixing','warn')}
// at the flight's first tick: a skipped requalification flies people, and each such flight is one more thing hushed
function requalLaunch(R){if(PROG.requal&&PROG.requal.skip&&R.crewed){PROG.hush=(PROG.hush||0)+1;PROG.hushPen=(PROG.hushPen||0)-4;R.requalSkip=true}}
// the flight's end (missionEnd): a capsule flown with dummies while crews stand down is the qualification flight
function requalEnd(s,R){const q=PROG.requal;if(!q||!R.requalFlight)return;
  const miss=!(s.alive&&R.capHome)?'the capsule did not come home':(R.far||0)<REQUAL_FAR*q.far?`it reached ${((R.far||0)/1000).toFixed(0)} km of the ${requalKm(q).toFixed(0)} needed`
    :R.cgMax>G_LIM?`the dummies saw ${R.cgMax.toFixed(1)} g`:R.ccab>CABIN_MAX?`the cabin reached ${R.ccab.toFixed(0)} K`:simT+(R.airX||0)>CREW_AIR?'the air would have run out':'';
  if(miss){R.requal={ok:false,why:miss};HOOK.news(`Not requalified yet: ${miss}`,'warn');return}
  PROG.requal=null;R.requal={ok:true};PROG.decisions=(PROG.decisions||[]).filter(d=>d.kind!=='requal');
  HOOK.news(`Requalified: the capsule went as far as the lost flight and came home inside the limits. Crews fly again`,'ok')}
// ---- qualifications (QUEUE Q458, crew slice 2; notes/economy.md § "Plan revision: crew by qualification", W43).
// Earned by doing it. A type is the crew capsule (its part key, W43 1): two simulator hours in it, or one real flight.
// Rendezvous, docking and landing (W43 2): two clean completions in the simulator, or one real; space flags the moment
// (crewDid) with the people on the seats then, and the flight's end credits whoever came through it (not lost). Field
// geology is a 30-day course the astronaut office orders (W43 4). Time in type: hours per capsule, real ones count
// double. Nothing expires. What the qualifications do (the pilot's modes, the scientist's ×) is later slices.
const QUAL_SIM_N=2,QUAL_TYPE_H=2,QUAL_RDV_D=1000,QUAL_RDV_V=5,QUAL_LAND_V=4,GEO_DAYS=30,GEO_COST=0.2;
const QUAL_L={rdv:'rendezvous',dock:'docking',land:'landing',geo:'field geology'};
const capName=k=>PARTS[k]?PARTS[k].name:k;
// the people on this vessel's seats now (not dummies: crewIds go only with people)
const crewIdsOn=s=>s.parts.filter(p=>p.on&&p.crewAboard&&p.crewIds).flatMap(p=>p.crewIds);
// space's flag: the vessel did k (rdv, dock, land) with these people aboard; R.simDid on a real flight too
function crewDid(s,k){const R=s&&s.rec;if(!R||!R.launched||R.ended)return;const ids=crewIdsOn(s);if(!ids.length)return;
  const D=R.simDid=R.simDid||{},L=D[k]=D[k]||[];for(const id of ids)if(!L.includes(id))L.push(id)}
// rendezvous (every tick of a crewed flight): within 1 km of the target and 5 m/s of its velocity
function crewRdvTick(s){const R=s.rec;if(R.simDid&&R.simDid.rdv||!crewIdsOn(s).length)return;const T=tgtOf(s);
  if(T&&!T.landed&&len(T.dr)<=QUAL_RDV_D&&len(T.dv)<QUAL_RDV_V)crewDid(s,'rdv')}
function qualGain(a,k,day,got){if(a.quals[k]!=null)return;a.quals[k]=day;got.push({a,k,l:`for ${QUAL_L[k]}`})}
// a flight's end, real (missionEnd) or simulated (simEnd, after the program is put back): time in type for each person on
// a seat, the type, and what they did. Returns what was earned, for the news and the Debrief
function crewCredit(s,R,real){if(!(PROG.crew||[]).length||!R)return[];const day=PROG.day,hrs=(real?simT:(R.simS||0))/3600,lost=new Set(R.crewLost||[]),
    seat=new Map(),cap0=(s.parts.find(p=>p.d.crew)||{d:{}}).d.key,got=[];
  for(const p of s.parts)if(p.crewIds)for(const id of p.crewIds)seat.set(id,p.d.key);
  const did=R.simDid||{};
  for(const id of new Set([...(R.crew||[]),...seat.keys()])){const a=crewById(id);if(!a||a.status==='lost'||lost.has(id))continue;
    const k=seat.get(id)||cap0;a.quals=a.quals||{};a.type=a.type||{};a.simN=a.simN||{};
    if(k){const T=a.type[k]=a.type[k]||{h:0,flights:0};T.h+=hrs*(real?2:1);if(real)T.flights++;
      a.quals.types=a.quals.types||{};if(a.quals.types[k]==null&&(real||T.h>=QUAL_TYPE_H)){a.quals.types[k]=day;got.push({a,k:'type',l:`on the ${capName(k)}`})}}
    for(const q of['rdv','dock','land'])if((did[q]||[]).includes(id)){if(!real)a.simN[q]=(a.simN[q]||0)+1;if(real||a.simN[q]>=QUAL_SIM_N)qualGain(a,q,day,got)}}
  for(const g of got)HOOK.news(`${g.a.name} qualifies ${g.l}${real?'':' (simulator)'}`,'ok');
  return got.map(g=>`${g.a.name} ${g.l}`)}
// the field geology course: the astronaut office sends one ready astronaut away for 30 days (off the roster for flights)
function crewCourseQuote(id){const a=crewById(id);
  return!a?{ok:false,why:'no such astronaut'}:a.quals&&a.quals.geo!=null?{ok:false,why:'already qualified'}:a.status==='course'?{ok:false,why:'on the course now'}
    :a.status!=='ready'?{ok:false,why:`not available (${a.status})`}:PROG.funds<GEO_COST?{ok:false,why:'not enough money'}:{ok:true,cost:GEO_COST,days:GEO_DAYS}}
function crewCourse(id){const q=crewCourseQuote(id);if(!q.ok)return q;const a=crewById(id);PROG.funds-=GEO_COST;ledAdd('crew',-GEO_COST);
  a.status='course';a.course={k:'geo',until:PROG.day+GEO_DAYS};HOOK.news(`${a.name} goes to field geology school for ${GEO_DAYS} days`,'');return q}
// (advanceDays) a course ends: back on the roster, qualified
function crewCourseTick(){for(const a of PROG.crew||[])if(a.status==='course'&&a.course&&PROG.day>=a.course.until-1e-9){
  a.status='ready';(a.quals=a.quals||{})[a.course.k]=a.course.until;a.course=null;HOOK.news(`${a.name} qualifies in field geology`,'ok')}}
// the badges on a crew card: [label, earned, title]
function crewBadges(a){const Q=a.quals||{},n=a.simN||{},out=[];
  for(const k in Q.types||{})out.push([capName(k),true,`qualified on the ${capName(k)} (${((a.type||{})[k]||{h:0}).h.toFixed(1)} h in type)`]);
  for(const k in a.type||{})if(!(Q.types||{})[k])out.push([capName(k),false,`${a.type[k].h.toFixed(1)} of ${QUAL_TYPE_H} h in the simulator`]);
  if(!out.length)out.push(['capsule',false,`no type yet: ${QUAL_TYPE_H} h in a capsule in the simulator, or one real flight`]);
  for(const k of['rdv','dock','land','geo'])out.push([QUAL_L[k],Q[k]!=null,Q[k]!=null?`qualified, day ${Math.floor(Q[k])}`:k==='geo'?`a ${GEO_DAYS}-day course`:`${n[k]||0} of ${QUAL_SIM_N} in the simulator, or one real`]);
  return out}
// ---- the pilot's modes (QUEUE Q625, crew slice 3; Q134 re-planned: notes/economy.md § "Plan revision: crew by
// qualification", notes/vehicle.md § "The pilot's SAS modes"; W43 3). A crewed vessel's SAS flies the union of the
// computer's modes and the best pilot aboard's. On the type (the capsule on their seat), a pilot gives the analog
// autopilot's modes; rendezvous adds manoeuvre and target; docking adds docking. Not on the type: nothing the computer
// doesn't have (they can hold it steady, not fly it). Where only the pilot has the mode, a pilot's loop flies it, slower and
// less precise than a computer (pillar 8), tightening over the first 20 hours in type. From the onboard-computer era a
// crew capsule carries the guidance computer (hasComputer), which has every mode: the pilot matters in eras 0 and 1.
// The manual landing hold is control's (size M), not here.
const PILOT_TYPE=['stab','pro','retro','normal','anti','radout','radin'],PILOT_RDV=['node','tgt','antitgt','rpro','rretro'],PILOT_DOCK=['dock'];
const PILOT_K=2.5,PILOT_W=[0.35,0.45],PILOT_DB=[0.5*Math.PI/180,0.3*Math.PI/180],PILOT_H=20;
function pilotModes(a,cap){const Q=a.quals||{};if(!(Q.types||{})[cap])return[];
  return PILOT_TYPE.concat(Q.rdv!=null?PILOT_RDV:[],Q.dock!=null?PILOT_DOCK:[])}
// the best pilot on this vessel's seats (people, not dummies): the most modes, then the most hours in type; null if none
function pilotOf(s){let best=null;if(!s||!s.parts)return null;
  for(const p of s.parts){if(!p.on||!p.crewAboard||!p.crewIds)continue;
    for(const id of p.crewIds){const a=crewById(id);if(!a||a.status==='lost'||a.spec&&a.spec!=='fly')continue;const m=pilotModes(a,p.d.key);if(!m.length)continue;
      const h=((a.type||{})[p.d.key]||{h:0}).h;if(!best||m.length>best.modes.length||m.length===best.modes.length&&h>best.h)best={a,modes:m,h,cap:p.d.key}}}
  return best}
// the loop for a mode only the pilot flies: k 2.5/s; 0.35 → 0.45 rad/s and a 0.5° → 0.3° deadband over the first 20 h in type
const pilotLoop=P=>{const f=Math.min(1,P.h/PILOT_H);return{name:`${P.a.name} (pilot)`,k:PILOT_K,w:PILOT_W[0]+f*(PILOT_W[1]-PILOT_W[0]),db:PILOT_DB[0]+f*(PILOT_DB[1]-PILOT_DB[0]),pilot:P.a}};
// what it takes for a pilot to fly mode m (the SAS's "not yet" line), or null when no pilot can
const pilotNeeds=m=>PILOT_TYPE.includes(m)?'a pilot on the type':PILOT_RDV.includes(m)?'a pilot qualified for rendezvous':PILOT_DOCK.includes(m)?'a pilot qualified for docking':null;
// ---- the scientist's and engineer's hooks (QUEUE Q626, crew slice 6; Q136 re-planned by qualification)
// the engineer: a failed ignition is tried again, once per ignition, twice when qualified on the capsule's systems (an
// engineer on the type). Returns {n, a}: the most relights anyone aboard gives, and who
function engRelights(s){let best={n:0,a:null};if(!s||!s.parts)return best;
  for(const p of s.parts){if(!p.on||!p.crewAboard||!p.crewIds)continue;
    for(const id of p.crewIds){const a=crewById(id);if(!a||a.spec!=='eng'||a.status==='lost')continue;const n=(a.quals&&a.quals.types||{})[p.d.key]!=null?2:1;if(n>best.n)best={n,a}}}
  return best}
// the scientist: a reading taken in person on a body counts for more. ×1.25 a scientist; ×1.5 with field geology; ×2 with
// it and a walk on that body before this flight (rec.walked is written at the flight's end). A pilot with field geology
// ×1.25. The best person on the vessel's seats on that body; 1 with nobody there
function sciWeight(s,body){let w=1,by=null;if(!s||!s.parts||!body||s.body!==body)return{w,by};
  for(const id of crewIdsOn(s)){const a=crewById(id);if(!a)continue;const geo=a.quals&&a.quals.geo!=null,
      x=a.spec==='sci'?(geo?((a.rec.walked||[]).includes(body.name)?2:1.5):1.25):geo?1.25:1;
    if(x>w){w=x;by=a}}
  return{w,by}}
