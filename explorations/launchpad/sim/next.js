// sim/next.js — what to do next (flow session, QUEUE Q40). Part of index.html's script (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- one suggestion for the Program screen, with why. Pure: it only reads the program. In order: a decision waiting for
// an answer (the soonest deadline); an accepted contract (the soonest deadline); an open mission, preferring the ones a
// preset is known to fly (NEXT_PRESET, measured by the robot runs) within one epoch of the earliest open one, then the
// earliest epoch, then the smallest pay (the easiest step); otherwise the best offer on the board.
const NEXT_PRESET={weather:'Sounding',loads:'Sounding',beeper:'Beeper',hop:'Passenger',orbiter:'Passenger Orbiter'};   // Beeper, Passenger Orbiter: vehicle, Q74
const NEXT_HOW={};
function nextStep(){const day=PROG.day||0,left=t=>`${Math.max(0,t-day).toFixed(0)} days`;
  const d=(PROG.decisions||[]).slice().sort((a,b)=>a.expires-b.expires)[0];
  if(d)return{kind:'decision',title:d.title,why:`waiting for your answer: ${left(d.expires)} left`,tab:'inbox'};
  const c=(PROG.active||[]).slice().sort((a,b)=>a.deadline-b.deadline)[0];
  if(c)return{kind:'contract',title:cTitle(c),why:`accepted, pays ${fmtM(c.p.pay)}: ${left(c.deadline)} left`,tab:'contracts'};
  const open=MISSIONS.filter(M=>!PROG.done[M.id]&&missionOpen(M));
  if(open.length){const M=missionsInOrder(open)[0],opens=MISSIONS.filter(x=>(x.req||[]).includes(M.id)).map(x=>x.name);
    const race=RACE.includes(M.id)&&raceLost(M.id)==null?'; nobody has done it yet: be first':'';
    return{kind:'mission',id:M.id,title:M.name,why:`pays ${fmtM(M.pay)}${opens.length?`, opens ${opens.join(' and ')}`:''}${race}`,
      how:NEXT_HOW[M.id]||(NEXT_PRESET[M.id]?`the ${NEXT_PRESET[M.id]} preset`:''),preset:NEXT_PRESET[M.id]||null,tab:'missions'}}
  const o=(PROG.offers||[]).slice().sort((a,b)=>b.p.pay-a.p.pay)[0];
  if(o)return{kind:'offer',title:cTitle(o),why:`the best offer on the board, pays ${fmtM(o.p.pay)}`,tab:'inbox'};
  return null}
// missions in NEXT's order: a preset known to fly them (within one epoch of the earliest), then the epoch, then the pay
function missionsInOrder(L){if(!L.length)return[];const ep0=Math.min(...L.map(M=>M.ep)),hint=M=>NEXT_PRESET[M.id]&&M.ep<=ep0+1?0:1;
  return L.slice().sort((a,b)=>hint(a)-hint(b)||a.ep-b.ep||a.pay-b.pay)}

// ---- the Mission card's jobs (flow, QUEUE Q548; notes/flow.md § "Plan: the aim and the mission card", slice 2). Until
// the aim (Q549) says what a flight is for: every accepted contract judged on a flight (a cond that isn't "judged at
// home") whose needs this vessel carried when first asked (at the pad: a dropped stage doesn't take the job off the
// card), then the missions open at launch (rec.open0, W11) it could meet, in NEXT's order, up to MC_MISSIONS; first, what
// this flight has done (rec.paid). Each {key, k:'contract'|'mission', title, pay, done, conds: jobConds (Q547)}.
const MC_MISSIONS=3,MC_HOME=['rec','safe','home'];   // the conds that bring it home: recovered, home safe, landed at home
const MC_FIT=new WeakMap();   // rec → {job key: carries its needs}, decided once per flight
function cardJobs(s){const R=s&&s.rec;if(!R)return[];const J=[];if(!MC_FIT.has(R))MC_FIT.set(R,{});const fit=MC_FIT.get(R);
  for(const p of R.paid||[])if(p.k==='mission'||p.k==='contract')J.push({key:p.k+':'+(p.id??p.l),k:p.k,title:p.l,pay:p.pay,done:true,conds:[]});
  const live=(key,x)=>{const C=jobConds(x,R,s);if(!C.some(c=>!c.home))return null;if(!(key in fit))fit[key]=jobNeeds(x,s).every(n=>n.ok);return fit[key]?C:null};
  for(const c of PROG.active||[]){const key='contract:'+c.id,C=live(key,c);if(C)J.push({key,k:'contract',title:cTitle(c),pay:c.p.pay,done:false,conds:C})}
  let n=0;for(const M of missionsInOrder(MISSIONS.filter(M=>!PROG.done[M.id]&&missionOpen(M)&&(!R.open0||R.open0.includes(M.id))))){if(n>=MC_MISSIONS)break;
    const key='mission:'+M.id,C=live(key,M);if(C){J.push({key,k:'mission',title:M.name,pay:M.pay,done:false,conds:C});n++}}
  return J}
// where the flight stands (Q548; Caio 2026-11-11: "a hard time understanding when I have finished a mission"). Jobs with a
// cond lost don't count. 'home': a job wants only bringing home (all else met); 'todo': a job under way (a cond met, one
// still open: "pending" waits on the program, as the air bands' analysis, and doesn't hold the flight); 'done': this
// flight did something and nothing above is left: end it when you like; null: nothing done or under way yet.
function jobsLeft(J){let home=null,todo=null;
  for(const j of J){if(j.done||j.conds.some(c=>c.state==='lost'))continue;const H=j.conds.filter(c=>MC_HOME.includes(c.id)&&!c.home),W=j.conds.filter(c=>!H.includes(c));
    if(H.length&&W.every(c=>c.state==='met')){const c=H.find(c=>c.state!=='met');if(c&&!home)home={j,c}}
    else if(W.some(c=>c.state==='met')&&W.some(c=>c.state==='open')&&!todo)todo={j,c:W.find(c=>c.state==='open')}}
  if(home)return{k:'home',j:home.j,c:home.c,t:`bring it home: ${home.j.title}, ${home.c.t}`};
  if(todo)return{k:'todo',j:todo.j,c:todo.c,t:`still to do for ${todo.j.title}: ${todo.c.t}`};
  return J.some(j=>j.done)?{k:'done',t:'done: end the flight when you like'}:null}
