// app/rollout.js — the Rollout screen (flow session, UI slice 5, QUEUE Q4; NOTES § "UI: screens and navigation"). Part of
// index.html's script: a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// The checkpoint between Assembly and the launch: a panel beside the ship on the pad with the launch site (the picker,
// renderSites, moved here from Assembly), the checks, what the flight costs and how long it takes to stack, what's in
// play, and LAUNCH (still #launch, with its own checks in editor.js). ⛔ blocks the launch, ⚠ is worth a look, ✔ is fine.
// (Q193, with look & sound) the rollout lying down: on a Steppe pad (no tower) the Rollout opens with the rocket on its
// side on the transporter-erector at the assembly hall's door; the car rolls it down the rails to the pit (ROLL_S[0] s),
// the boom raises it (ROLL_S[1] s), then the support arms and cable masts close on it (ROLL_S[2] s). rollPhase() is the
// clock gl.js draws from (drawSteppeRig, rollTilt): null when not rolling out on a Steppe pad. It restarts on entering
// the Rollout or on picking another site. LAUNCH isn't held back: launching early stands the rocket up at once.
const ROLL_S=[7,5,1.5];let rollT0=0,rollSite=null;
function rollPhase(){if(!atRoll||mode!=='editor'||padSchoolOf(curSite())!==1)return null;const now=performance.now();
  if(curSite()!==rollSite){rollSite=curSite();rollT0=now}const t=(now-rollT0)/1000,u=(a,d)=>sstep(0,1,clamp((t-a)/d,0,1));
  return{t,roll:u(0,ROLL_S[0]),up:u(ROLL_S[0],ROLL_S[1]),arms:u(ROLL_S[0]+ROLL_S[1],ROLL_S[2])}}
function rollChecks(){const out=[],ok=t=>out.push(['ok',t]),warn=(t,W)=>out.push(['warn',t,W]),bad=(t,W)=>out.push(['bad',t,W]);   // (Q391) a warning or a stop can carry its explanation, W={t, d, fix} as whyMark takes it (app/terms.js): hover the check
  const t=curSite(),a=siteAccessOf(t),fz=siteFits(t,S.parts),c=vesselCost(S.parts).cost,fee=a.fee||0,ops=OPS_FIX+OPS_FRAC*c,w=siteWeather(t,(PROG.day||0)*DAY_S);
  if(c+fee>PROG.funds+1e-9)bad(`Over budget: ${fmtM(c)}${fee?` + ${fmtM(fee)} site fee`:''}, the program has ${fmtM(PROG.funds)}`,{t:'Over budget',d:'The launch is refused until the program can pay for the hardware and the site.',fix:['cheaper parts: fewer or smaller engines and tanks','a site of our own (no fee)','wait for money: contracts and the budget fill the account']});
  else if(c+fee+ops>PROG.funds+1e-9)warn(`The ops fee (${fmtM(ops)}) takes the program below zero`,{t:'The account goes below zero',d:'It flies, but the range, tracking and crews take the program into the red until money comes in; below the floor the government or the investors step in, at a price.',fix:['cheaper parts','wait for money first']});else ok(`Affordable: ${fmtM(c+fee+ops)} of ${fmtM(PROG.funds)}`);
  {const lk=partLaunchWhy(S.parts);if(lk)bad(lk,{t:'A part that isn\'t open yet',d:'Parts that come with a mission or a computing era can be designed with before then, but not launched.',fix:['an open part in its place','fly the mission that opens it (the parts list says which)']})}   // a part not open yet (vehicle, Q190)
  {const W={t:"This site won't take it",d:"A site has its owner's terms and its own pads: what it allows, and what fits on them.",fix:'another launch site: the site line under the Assembly picks it.'};if(!a.ok)bad(a.why,W);if(!fz.ok)bad(fz.why,W)}if(a.ok&&fz.ok)ok(`${t.name}: open to us, the stages fit`);
  const dw=downrangeWarning(t);if(dw)warn(dw,{t:'Stages may fall on people',d:'The spent stages come down along the path downrange; over towns they cost damages and opinion, abroad more.',fix:['a site with sea downrange','fewer stages dropped low over land']});
  if(w.scrub)warn(`Weather at ${t.name}: ${w.word}; the launch may wait for a clear day`,{t:'Bad weather at the site',d:'Wind and storms scrub a launch: it waits for a clear day, and the days count.',fix:['launch and let it wait','another site with clearer weather']});
  const st=stageStats(stackDef).stages[0],tw={fix:['a stronger engine, or boosters on the side','less propellant in stage 1','a lighter upper stage or payload']};
  if(st)st.twr<1?bad(`Stage 1 can't lift off: ${term('twr','TWR')} ${st.twr.toFixed(2)}`,{...tw,t:`Thrust ${st.twr.toFixed(2)}× its weight`,d:'Under 1 it sits on the pad with its engines running.'})
    :st.twr<1.15?warn(`Stage 1 is sluggish: ${term('twr','TWR')} ${st.twr.toFixed(2)}`,{...tw,t:`A slow climb: thrust ${st.twr.toFixed(2)}× its weight`,d:'Every second spent climbing slowly is spent holding the rocket up against gravity: propellant burned that a quicker climb keeps.'}):ok(`Liftoff TWR ${st.twr.toFixed(2)}`);
  const A=S.ana;if(A){const cal=r=>(r.ycm-r.ycp)/(2*S.radius),m=Math.min(cal(A.ful),cal(A.sup));
    if(m<0)(A.ctl&&A.ctl.steer?warn:bad)(`Aerodynamically unstable (${m.toFixed(2)} calibers)${A.ctl&&A.ctl.steer?': only steering keeps it straight':' and nothing to steer it'}`,{t:'Unstable in the air',d:'The air\'s push sits ahead of the balance point, like an arrow with its feathers at the front: in air it wants to fly tail-first, and only steering holds it.',fix:['fins at the bottom, or bigger ones','heavier parts higher up the stack','keep an engine burning through the thick air']});
    const j=Math.max(A.lift.cert.frac,A.mq.cert.frac);if(j>1){const w=A.mq.cert.frac>=A.lift.cert.frac?A.mq.cert:A.lift.cert,at=w===A.mq.cert?`max-q, ${(A.mq.q/1000).toFixed(0)} kPa`:'liftoff';warn(`A joint is past its certified rating (${(j*100).toFixed(0)}% at ${at}: ${w.p?`${w.p.d.name} / ${w.p.parent.d.name}, ${w.kind}`:''}). ${jointFix(w,w===A.mq.cert&&A.mq.own)}`,{t:'A joint past its rating',d:'Ratings start at 70% of what the part really takes, so it may hold, but the further past, the likelier it breaks on the way up.',fix:jointFix(w,w===A.mq.cert&&A.mq.own)})}}
  if(S.parts.some(p=>p.on&&p.d.kind==='bio')&&!safetyReview(newShip(stackDef)).ok)warn('Flight safety won\'t approve a passenger on this design');
  for(const[k,x]of launchWarnings(stackDef))(k==='ok'?ok:warn)(x);   // Δv for the flight's aim, a parachute for whoever rides (vehicle, Q48)
  const nd=(PROG.decisions||[]).length;if(nd)warn(`${nd} decision${nd>1?'s':''} waiting in the Program's Inbox`,{t:'Decisions waiting',d:'They expire if nobody answers, and some change what this flight is worth.',fix:'answer them in the Program\'s Inbox (P) first.'});
  return out}
function renderRollout(){const el=$('rollBody');if(!el||BLD.isEmpty(stackDef))return;
  const t=curSite(),c=vesselCost(S.parts),fee=siteAccessOf(t).fee||0,ops=OPS_FIX+OPS_FRAC*c.cost,
    days=(TEST.fast?0:prepDays(c.cost)*(1+0.5*(1-khVessel(S)))*FAC.hall.eff[facLv('hall')])+studyWait(S)+padWait(),   // as missionTick reckons it at liftoff
    ck=rollChecks(),icon={ok:'✔',warn:'⚠',bad:'⛔'},row=(l,v)=>`<tr><td>${l}</td><td>${v}</td></tr>`,nx=nextStep();
  $('rollDesign').textContent=`${designName(stackDef)} · ${fmtDate(PROG.day||0)}`;
  // a check's closing parenthesis (where a number comes from) folds into an ⓘ tooltip, so each check stays a line or two (Q151)
  const fold=x=>{const i=x.indexOf(' (');return i>0&&x.endsWith(')')?`${x.slice(0,i)} <i class="ri" title="${x.slice(i+2,-1).replace(/"/g,'&quot;')}">ⓘ</i>`:x};
  $('rollChecks').innerHTML=ck.map(([k,x,W])=>`<div class="rc ${k}"><span>${icon[k]}</span> ${W&&typeof whyMark==='function'?whyMark(k,fold(x),W,'span'):fold(x)}</div>`).join('');   // (Q391) a check with W explains itself on hover
  $('rollBooks').innerHTML=`<table>${row('Hardware',fmtM(c.cost))}${row('Launch operations',fmtM(ops))}${fee?row('Site fee',fmtM(fee)):''}`+
    `${row('Funds after launch',`<span class="${PROG.funds-c.cost-ops-fee<0?'bad':''}">${fmtM(PROG.funds-c.cost-ops-fee)}</span>`)}${row('Back if it all lands intact',fmtM(c.dry*REFURB))}${row('Ready to fly in',`${days.toFixed(1)} days`)}</table>`;
  $('rollPlay').innerHTML=(nx?`<div><b>NEXT</b> ${nx.title} <span class="dim">· ${nx.why}</span></div>`:'')+
    ((PROG.active||[]).map(x=>`<div class="sub">Contract: ${cTitle(x)} · ${fmtM(x.p.pay)} · ${Math.max(0,x.deadline-(PROG.day||0)).toFixed(0)} days left</div>`).join('')||'<div class="sub">No contract accepted.</div>');
  const blocked=ck.some(x=>x[0]==='bad');$('launch').style.opacity=blocked?.5:1;$('launch').title=blocked?'something above blocks the launch':''}
