// sim/next.js — what to do next (flow session, QUEUE Q40). Part of index.html's script (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- one suggestion for the Program screen, with why. Pure: it only reads the program. In order: a decision waiting for
// an answer (the soonest deadline); an accepted contract (the soonest deadline); an open mission, preferring the ones a
// preset is known to fly (NEXT_PRESET, measured by the robot runs) within one epoch of the earliest open one, then the
// earliest epoch, then the smallest pay (the easiest step); otherwise the best offer on the board.
const NEXT_PRESET={weather:'Sounding',loads:'Sounding',beeper:'Orbiter',hop:'Passenger'};
const NEXT_HOW={beeper:'the Orbiter preset with an instrument package in place of the pod'};
function nextStep(){const day=PROG.day||0,left=t=>`${Math.max(0,t-day).toFixed(0)} days`;
  const d=(PROG.decisions||[]).slice().sort((a,b)=>a.expires-b.expires)[0];
  if(d)return{kind:'decision',title:d.title,why:`waiting for your answer: ${left(d.expires)} left`,tab:'inbox'};
  const c=(PROG.active||[]).slice().sort((a,b)=>a.deadline-b.deadline)[0];
  if(c)return{kind:'contract',title:cTitle(c),why:`accepted, pays ${fmtM(c.p.pay)}: ${left(c.deadline)} left`,tab:'contracts'};
  const open=MISSIONS.filter(M=>!PROG.done[M.id]&&missionOpen(M));
  if(open.length){const ep0=Math.min(...open.map(M=>M.ep)),hint=M=>NEXT_PRESET[M.id]&&M.ep<=ep0+1?0:1;
    const M=open.slice().sort((a,b)=>hint(a)-hint(b)||a.ep-b.ep||a.pay-b.pay)[0],opens=MISSIONS.filter(x=>(x.req||[]).includes(M.id)).map(x=>x.name);
    const race=RACE.includes(M.id)&&raceLost(M.id)==null?'; nobody has done it yet: be first':'';
    return{kind:'mission',id:M.id,title:M.name,why:`pays ${fmtM(M.pay)}${opens.length?`, opens ${opens.join(' and ')}`:''}${race}`,
      how:NEXT_HOW[M.id]||(NEXT_PRESET[M.id]?`the ${NEXT_PRESET[M.id]} preset`:''),preset:NEXT_PRESET[M.id]||null,tab:'missions'}}
  const o=(PROG.offers||[]).slice().sort((a,b)=>b.p.pay-a.p.pay)[0];
  if(o)return{kind:'offer',title:cTitle(o),why:`the best offer on the board, pays ${fmtM(o.p.pay)}`,tab:'inbox'};
  return null}
