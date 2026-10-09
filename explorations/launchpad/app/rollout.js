// app/rollout.js — the Rollout screen (flow session, UI slice 5, QUEUE Q4; NOTES § "UI: screens and navigation"). Part of
// index.html's script: a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// The checkpoint between Assembly and the launch: a panel beside the ship on the pad with the launch site (the picker,
// renderSites, moved here from Assembly), the checks, what the flight costs and how long it takes to stack, what's in
// play, and LAUNCH (still #launch, with its own checks in editor.js). ⛔ blocks the launch, ⚠ is worth a look, ✔ is fine.
function rollChecks(){const out=[],ok=t=>out.push(['ok',t]),warn=t=>out.push(['warn',t]),bad=t=>out.push(['bad',t]);
  const t=curSite(),a=siteAccessOf(t),fz=siteFits(t,S.parts),c=vesselCost(S.parts).cost,fee=a.fee||0,ops=OPS_FIX+OPS_FRAC*c,w=siteWeather(t,(PROG.day||0)*DAY_S);
  if(c+fee>PROG.funds+1e-9)bad(`Over budget: ${fmtM(c)}${fee?` + ${fmtM(fee)} site fee`:''}, the program has ${fmtM(PROG.funds)}`);
  else if(c+fee+ops>PROG.funds+1e-9)warn(`The ops fee (${fmtM(ops)}) takes the program below zero`);else ok(`Affordable: ${fmtM(c+fee+ops)} of ${fmtM(PROG.funds)}`);
  if(!a.ok)bad(a.why);if(!fz.ok)bad(fz.why);if(a.ok&&fz.ok)ok(`${t.name}: open to us, the stages fit`);
  const dw=downrangeWarning(t);if(dw)warn(dw);
  if(w.scrub)warn(`Weather at ${t.name}: ${w.word}; the launch may wait for a clear day`);
  const st=stageStats(stackDef).stages[0];if(st)st.twr<1?bad(`Stage 1 can't lift off: TWR ${st.twr.toFixed(2)}`):st.twr<1.15?warn(`Stage 1 is sluggish: TWR ${st.twr.toFixed(2)}`):ok(`Liftoff TWR ${st.twr.toFixed(2)}`);
  const A=S.ana;if(A){const cal=r=>(r.ycm-r.ycp)/(2*S.radius),m=Math.min(cal(A.ful),cal(A.sup));
    if(m<0)(A.ctl&&A.ctl.steer?warn:bad)(`Aerodynamically unstable (${m.toFixed(2)} calibers)${A.ctl&&A.ctl.steer?': only steering keeps it straight':' and nothing to steer it'}`);
    const j=Math.max(A.lift.cert.frac,A.mq.cert.frac);if(j>1)warn(`A joint is past its certified rating (${(j*100).toFixed(0)}% at ${A.mq.cert.frac>=A.lift.cert.frac?'max-q':'liftoff'})`)}
  if(S.parts.some(p=>p.on&&p.d.kind==='bio')&&!safetyReview(newShip(stackDef)).ok)warn('Flight safety won\'t approve a passenger on this design');
  for(const[k,x]of launchWarnings(stackDef))(k==='ok'?ok:warn)(x);   // Δv for the flight's aim, a parachute for whoever rides (vehicle, Q48)
  const nd=(PROG.decisions||[]).length;if(nd)warn(`${nd} decision${nd>1?'s':''} waiting in the Program's Inbox`);
  return out}
function renderRollout(){const el=$('rollBody');if(!el||BLD.isEmpty(stackDef))return;
  const t=curSite(),c=vesselCost(S.parts),fee=siteAccessOf(t).fee||0,ops=OPS_FIX+OPS_FRAC*c.cost,
    days=(TEST.fast?0:prepDays(c.cost)*(1+0.5*(1-khVessel(S)))*FAC.hall.eff[facLv('hall')])+studyWait(S)+padWait(),   // as missionTick reckons it at liftoff
    ck=rollChecks(),icon={ok:'✔',warn:'⚠',bad:'⛔'},row=(l,v)=>`<tr><td>${l}</td><td>${v}</td></tr>`,nx=nextStep();
  $('rollDesign').textContent=`${designName(stackDef)} · ${fmtDate(PROG.day||0)}`;
  // a check's closing parenthesis (where a number comes from) folds into an ⓘ tooltip, so each check stays a line or two (Q151)
  const fold=x=>{const i=x.indexOf(' (');return i>0&&x.endsWith(')')?`${x.slice(0,i)} <i class="ri" title="${x.slice(i+2,-1).replace(/"/g,'&quot;')}">ⓘ</i>`:x};
  $('rollChecks').innerHTML=ck.map(([k,x])=>`<div class="rc ${k}"><span>${icon[k]}</span> ${fold(x)}</div>`).join('');
  $('rollBooks').innerHTML=`<table>${row('Hardware',fmtM(c.cost))}${row('Launch operations',fmtM(ops))}${fee?row('Site fee',fmtM(fee)):''}`+
    `${row('Funds after launch',`<span class="${PROG.funds-c.cost-ops-fee<0?'bad':''}">${fmtM(PROG.funds-c.cost-ops-fee)}</span>`)}${row('Back if it all lands intact',fmtM(c.dry*REFURB))}${row('Ready to fly in',`${days.toFixed(1)} days`)}</table>`;
  $('rollPlay').innerHTML=(nx?`<div><b>NEXT</b> ${nx.title} <span class="dim">· ${nx.why}</span></div>`:'')+
    ((PROG.active||[]).map(x=>`<div class="sub">Contract: ${cTitle(x)} · ${fmtM(x.p.pay)} · ${Math.max(0,x.deadline-(PROG.day||0)).toFixed(0)} days left</div>`).join('')||'<div class="sub">No contract accepted.</div>');
  const blocked=ck.some(x=>x[0]==='bad');$('launch').style.opacity=blocked?.5:1;$('launch').title=blocked?'something above blocks the launch':''}
