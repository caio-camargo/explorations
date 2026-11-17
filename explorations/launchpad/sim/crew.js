'use strict';
// sim/crew.js — the roster (QUEUE Q182, crew slice 1; notes/economy.md § "Plan revision: crew by qualification", W24,
// W43). Part of index.html's script, a classic script sharing one global scope with the others (NOTES § "The file
// split"). Pure SIM. Astronauts are people: named in the home school's style, selected as a class, picked for each crewed
// flight by seniority, carried on their seats (`p.crewIds`, beside Q606's `crewAboard`) through the registry, and
// counted when they come home. A loss names them and puts them in `PROG.memorial`. No qualifications yet (slice 2):
// every pilot counts as qualified on every type, which is the behaviour before the roster.
const CREW_CLASS=3;   // the first class: 3 people + 1 per computing-centre level (W24)
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
function crewHire(n){PROG.crew=PROG.crew||[];PROG.crewCls=(PROG.crewCls||0)+1;const out=[];
  for(let k=0;k<n;k++){const id=PROG.crewN=(PROG.crewN||0)+1;
    const a={id,name:crewName(id),spec:'fly',cls:PROG.crewCls,joined:PROG.day,status:'ready',where:null,up:null,quals:{},type:{},sen:[],rec:{flights:0,days:0,walked:[]}};
    PROG.crew.push(a);out.push(a)}
  return out}
// the first class is selected when the abort tests open (W24 1), so the people exist while the tower is qualified
const crewOpen=()=>!!(PROG.done&&(PROG.done.maxqabort||PROG.done.padabort||PROG.done.orbiter));   // padabort's req is the orbiter
function crewClassTick(){if((PROG.crew||[]).length||!crewOpen())return;const c=crewHire(CREW_CLASS+facLv('centre'));
  HOOK.news(`The first class of astronauts: ${crewList(c)}`,'ok')}
// the title (CREW § Every astronaut; early era): everyone is a pilot, the most senior of a crew of two or more commands
const crewTitle=(a,crew)=>crew.length>1&&crew.slice().sort(crewRank)[0]===a?'commander':'pilot';
// at the flight's first tick, people flying (not dummies): the most senior ready astronauts fill the empty seats. With too
// few ready (the rest aboard a station, held abroad), the office selects more at once rather than refusing the flight
function crewPick(s,R){const n=s.parts.reduce((a,p)=>a+(p.on&&p.d.crew&&!p.crewAboard?p.d.crew:0),0);if(!n)return[];crewClassTick();
  let ready=(PROG.crew||[]).filter(a=>a.status==='ready').sort(crewRank);
  if(ready.length<n){const c=crewHire(n-ready.length);HOOK.news(`${crewList(c)} ${c.length>1?'are':'is'} selected in a hurry to fill the seats`,'warn');ready=ready.concat(c)}
  const go=ready.slice(0,n);for(const a of go){a.status='flying';a.up=R.day0??PROG.day;a.rec.flights++}
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
