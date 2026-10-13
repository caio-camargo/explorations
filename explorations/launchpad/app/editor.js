// app/editor.js — the editor UI. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ editor UI
const $=id=>document.getElementById(id);
// the construction screen lives in builder.js (BLD)
function renderEditor(){BLD.init();editorChanged();renderSites()}
function renderProgram(){const el=$('program');if(!el)return;const EP={1:'Epoch 1 · sounding rockets',2:'Epoch 2 · first orbit',3:'Epoch 3 · satellites that work',4:'Epoch 4 · Selene',5:'Epoch 5 · the second moon'};let html='';
  const epNow=Math.min(...MISSIONS.filter(m=>!PROG.done[m.id]).map(m=>m.ep),9);   // (Q286) the first epoch with work left
  for(const ep of[1,2,3,4,5]){html+=`<div class="ep">${EP[ep]}</div>`;const Ms=MISSIONS.filter(m=>m.ep===ep);
    if(ep>epNow+1&&Ms.every(M=>!PROG.done[M.id]&&!missionOpen(M))){html+=`<div class="ms lock">🔒 ${Ms.length} mission${Ms.length>1?'s':''}, once ${EP[ep-1].replace(/^Epoch \d+ · /,'')} is under way</div>`;continue}   // (Q286, UI.md § 3) beyond the next epoch: a count
    for(const M of Ms){const done=PROG.done[M.id],open=missionOpen(M);
      if(done)html+=`<div class="ms done"><b>✔ ${M.name}</b></div>`;
      else if(!open)html+=`<div class="ms lock">🔒 ${M.name} <span>· after ${M.req.filter(r=>!PROG.done[r]).map(r=>MISSIONS.find(m=>m.id===r).name).join(', ')}</span></div>`;
      else html+=`<div class="ms"><b>${M.name}</b> <span class="ok">+${fmtM(M.pay)}</span>${stageNote(M)}${M.prog?` <span class="acc">${M.prog()}</span>`:''}<div class="sub">${M.brief}</div></div>`}}
  const bands=BANDS.map(k=>PROG.atm[k]?'■':'□').join(''),ks=Object.keys(PARTS).filter(k=>!PARTS[k].radialOnly),full=ks.filter(k=>certOf(k)>=.999).length,tested=ks.filter(k=>certOf(k)>CERT0+.005).length;
  html=`<div class="ep">${fmtDate(PROG.day)} · Funds <b class="acc" style="font-size:13px">${fmtM(PROG.funds)}</b>${PROG.bailouts?` <span class="dim">· ${PROG.bailouts} top-up${PROG.bailouts>1?'s':''}</span>`:''}</div>`+html;
  const pc=p=>`hsl(${p.hue},70%,68%)`,H=POWERS[HOME];
  const F=flav(HOME),pris=Object.entries(F.pri).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(', ');
  html+=`<div class="ep">The world</div><div class="sub">Home: ${typeof flagSVG==='function'?flagSVG(H,24):''}<b style="color:${pc(H)}">${H.name}</b> · opinion of us ${opOf(HOME).toFixed(0)}<br>`+
    `<span class="dim">${F.name}: answers to ${F.open>=.6?'the public (elections)':F.open>=.4?'a mix of public and leadership':'the leadership'} · money: ${{tax:'taxes',commodity:'commodity revenue',patronage:'patronage',military:'the military budget'}[F.money]}${F.grow?', growing':''} · wants ${pris} · nationalism ${natWord(natOf(HOME))}</span>`+
    `<br><span class="dim">Industry: makes ${TIER_NAME.filter((_,t)=>indOf(HOME)>=IND_TH[t]).join(', ')}${[0,1,2].some(t=>indOf(HOME)<IND_TH[t])?`; imports ${[0,1,2].filter(t=>indOf(HOME)<IND_TH[t]).map(t=>{const k={1:'sparrow',2:'condor'}[t],x=sourceOf(k);return `${TIER_NAME[t]} ${x.how==='grey'?'<span class="bad">via intermediaries ×3</span>':`from ${POWERS[x.from].root}`}`}).join(', ')}`:''}</span>`+
    `${PROG.demand?`<br><span class="warn">The leadership expects a spectacular within ${(PROG.demand.by-PROG.day).toFixed(0)} days</span>`:''}${F.open>=.6&&PROG.nextElection!=null?`<br><span class="dim">Next election in ${(PROG.nextElection-PROG.day).toFixed(0)} days</span>`:''}<br>`+
    POWERS.filter(p=>p.i!==HOME).map(p=>{const r=relOf(HOME,p.i);return`${typeof flagSVG==='function'?flagSVG(p,18):''}<span style="color:${pc(p)}">${p.name}</span> <span class="dim">(${ARCH[archOf(p.i)].name.toLowerCase()})</span> · <span class="${r>.2?'ok':r<-.2?'bad':'dim'}">${relWord(r)}</span> · opinion ${opOf(p.i).toFixed(0)}`}).join('<br>')+`</div>`;
  {const used=Object.keys(PROG.kh||{}).sort((a,b)=>khBar(b)-khBar(a)),bar=k=>`<span class="acc">${'▮'.repeat(Math.round(khBar(k)*8))}${'▯'.repeat(8-Math.round(khBar(k)*8))}</span>`,
     prod=k=>{const x=sourceOf(k);return x.how==='line'?`${x.line.lic!=null?'licensed':'own'} line, maturity ${(x.line.m*100).toFixed(0)}%`:x.how==='home'?'home-made':x.how==='grey'?'<span class="bad">grey market</span>':x.how==='giant'?`from ${x.name} (${POWERS[x.from].root})`:`from ${POWERS[x.from].root}`};
   if(used.length)html+=`<div class="ep">${term('kh','Know-how')}</div><div class="sub">${used.slice(0,10).map(k=>`${bar(k)} ${PARTS[k].name} <span class="dim">· ${prod(k)}</span>`).join('<br>')}</div>`}
  {const S2=PROG.stand2,ks=[...new Set([...(S?S.parts.map(p=>p.d.key):[]),...Object.keys(PROG.kh||{})])].filter(k=>PARTS[k]);
   html+=`<div class="ep">Test stand</div><div class="sub">`+(!S2?`<button data-stand="build" ${PROG.funds>=STAND_COST?'':'disabled'}>Build a test stand ${fmtM(STAND_COST)}, ${STAND_DAYS} d</button> <span class="dim">ground tests: know-how and certification without flying</span>`:
     PROG.day<S2.ready?`Under construction, ready in ${(S2.ready-PROG.day).toFixed(0)} days`:S2.job?`Testing the ${PARTS[S2.job.k].name} (${S2.job.mode==='destroy'?'to destruction':'qualification'}), ${(S2.job.end-PROG.day).toFixed(0)} days left`:
     ks.slice(0,8).map(k=>{const q=testQuote(k,'qual'),r=testQuote(k,'destroy');return`${PARTS[k].name} <button data-test="${k}:qual" ${PROG.funds>=q.cost?'':'disabled'}>Qualify ${fmtM(q.cost)}, ${q.days} d</button> <button data-test="${k}:destroy" ${PROG.funds>=r.cost&&certOf(k)<1?'':'disabled'}>To destruction ${fmtM(r.cost)}, ${r.days} d</button>`}).join('<br>'))+`</div>`}
  html+=facilitiesHTML();   // economy: self-contained section (UI session: move freely)
  html+=computeHTML();   // economy: self-contained section (UI session: move freely)
  html+=timelineHTML();   // economy: self-contained section (UI session: move freely)
  {const J=PROG.devJob,ks=[...new Set([...(S?S.parts.map(p=>p.d.key):[]),...Object.keys(PROG.kh||{})])].filter(k=>PARTS[k]&&(()=>{const x=sourceOf(k);return x.how==='home'||(x.how==='line'&&x.line.lic==null)})());
   if(J||ks.length)html+=`<div class="ep">Development</div><div class="sub">`+(J?`Design bureau: ${DEV_GOALS[J.g].toLowerCase()} ${PARTS[J.k].name}, ${(J.end-PROG.day).toFixed(0)} days left`:
     ks.slice(0,8).map(k=>`${PARTS[k].name}${Object.keys(PROG.dev?.[k]||{}).length?` <span class="dim">(${Object.entries(PROG.dev[k]).map(([g,v])=>`${DEV_GOALS[g].toLowerCase()} ×${v}`).join(', ')})</span>`:''}<br>`+
       Object.keys(DEV_GOALS).map(g=>{const q=devQuote(k,g);return`<button data-dev="${k}:${g}" ${q.ok&&PROG.funds>=q.cost?'':'disabled'} title="${q.why}">${DEV_GOALS[g]} ${fmtM(q.cost)}, ${q.days} d</button>`}).join(' ')+
       (devQuote(k,'cheap').why&&devQuote(k,'rel').why?`<br><span class="dim">${devQuote(k,'rel').why}</span>`:'')).join('<br>'))+`</div>`}
  {const L=PROG.lines||{},mine=Object.keys(L).filter(k=>L[k].power===HOME),cand=S?[...new Set(S.parts.map(p=>p.d.key))].filter(k=>{const x=sourceOf(k);return(x.how==='import'||x.how==='grey'||x.how==='giant')&&!(L[k]&&L[k].power===HOME)}):[];
   if(mine.length||cand.length){html+=`<div class="ep">Production</div><div class="sub">`+mine.map(k=>{const l=L[k];return PROG.day<l.ready?`${PARTS[k].name}: tooling up, ready in ${(l.ready-PROG.day).toFixed(0)} days`:`${PARTS[k].name}: ${l.lic!=null?`licensed from ${POWERS[l.lic].root}`:'own line'} · maturity ${(l.m*100).toFixed(0)}% · ${l.units} built · ×${prodLineK(l).toFixed(2)} per unit`}).join('<br>')+
     cand.map(k=>{const q=prodQuote(k),b=(m,o,lbl)=>`<button data-line="${k}:${m}" ${o.ok&&PROG.funds>=o.cost?'':'disabled'} title="${o.why||''}">${lbl} ${fmtM(o.cost)}, ${o.days} d</button>`;
       return `<div style="margin-top:3px">${PARTS[k].name} <span class="dim">(bought abroad)</span><br>${b('own',q.own,'Own line')} ${b('lic',q.lic,q.lic.from!=null?`License from ${POWERS[q.lic.from].root}`:'License')}${!q.own.ok?`<br><span class="dim">${q.own.why}</span>`:''}</div>`}).join('')+`</div>`}}
  html+=`<div class="ep">What we know</div><div class="sub">Atmosphere 0–${(TELLUS.atm/1e3).toFixed(0)} km <span class="acc">${bands}</span> (sampled bands)<br>Parts: ${tested} with flight data, ${full} fully proven, of ${ks.length}<br>Flights ${PROG.flights}${PROG.streak?` · clean-range streak ${PROG.streak}`:''}${selKnowHTML()}</div>
    <button id="progReset" style="margin-top:6px;font-size:10.5px">reset program</button>`;
  el.innerHTML=html.replace(/^(<div class="ep">.*?<\/div>)/,m=>m+ownershipHTML()+contractsHTML()+satsHTML());$('progReset').onclick=()=>{if(confirm('Forget all missions and everything the program has learned?')){resetProgram();go('title')}}}
function resetProgram(){   // (also the title screen's New program, Q241 R3)
    Object.assign(PROG,{gseed:null,done:{},cert:{},atm:{},streak:0,flights:0,funds:FUNDS0,bailouts:0,day:0,rel:{},op:{},offers:null,active:[],cdone:0,stand:{},recs:{},cycle:0,cyc:null,own:null,decisions:[],home:0,history:[],homeArch:null,nat:{},hush:0,hushPen:0,bmult:1,demand:null,cancelled:false,nextElection:null,comm:0,commPh:null,kh:{},lines:{},stand2:null,dev:{},devJob:null,studies:{},studyQ:[],compEra:null,staged:{},dispatch:[],fac:{}});HOME=0;RIVALS=raceSchedule();ensureBoard();HOOK.save();editorChanged()}
// how much sideways drift it stands at touchdown, legs down (Q264, PLAYTEST #64: a tall stack on its bell tips past ~1 m/s). Q325:
// for what lands (after its drops) on the body it lands on: a landing procedure's body and staging, else Tellus, and Selene
// too for a design with legs (the moon's weaker pull stands it ~0.4× the drift)
// trim (vehicle, Q337; PROBES § 4): the steering spent holding course against an off-centre thrust, the worst stage
function trimHTML(s){const T=trimOf(s);if(!T)return'';const p=Math.round(T.f*100),cl=T.f<0.2?'ok':T.f<0.6?'warn':'bad',cm=(T.miss*100).toFixed(T.miss<0.1?1:0);
  const W={t:`Stage ${T.k}: the thrust misses the centre of mass by ${cm} cm`,d:isFinite(T.f)?`The engine pushes off-centre, so the craft wants to turn: holding it straight takes ${p}% of its gimbal and wheels, and leaves that much less for steering.${T.f>1?' Over 100%: it can\'t hold it, and turns while it burns.':''}`:'Nothing on it can steer against the off-centre push: it turns as soon as the engine lights.',
    fix:['balance it: the same part on the other side (radial mounts ×2)','a counterweight opposite the heavy side part','deploy what unfolds after the burn, not before','more steering: an engine that gimbals, or a reaction wheel']};
  return`<div style="margin-top:4px">${term('trim','Trim')} ${whyMark(cl,isFinite(T.f)?p+'%':'no steering',W)} <span class="dim">${T.miss<0.005?'the thrust runs through the centre of mass':`stage ${T.k}: the thrust misses the centre of mass by ${cm} cm`}; the share of gimbal and wheels spent holding course</span></div>`}
// fit (Q340, PROBES § 8): what stands on a fairing's ring, under its nose, but isn't inside the shell. Only when something pokes out
function fitHTML(s){const out=[];for(const f of s.parts){if(!f.on||f.d.kind!=='fair'||!f.profF)continue;const top=f.y0+f.profF[f.profF.length-1][1];
    for(const q of s.parts)if(q.on&&q!==f&&!q.inFair&&q.y0>=f.y0+f.h-1e-6&&q.y0<top&&Math.hypot(q.pos[0]-f.pos[0],q.pos[2]-f.pos[2])<1.6*f.d.r&&!out.includes(q))out.push(q)}
  if(!out.length)return'';const nm=[...new Set(out.map(q=>q.d.name))],dep=out.some(q=>q.dep||q.open);
  const W={t:`${nm.join(', ')} ${out.length>1?'poke':'pokes'} out of the fairing`,d:'Whatever sticks out of the shell meets the air and the heat of the climb: a folded antenna or a solar wing can tear off, and the shell drops around it.',
    fix:[dep?'fold it for launch (retract all)':'','a longer fairing (right-click it: length)','a narrower part, or one moved lower inside the shell'].filter(Boolean)};
  return`<div style="margin-top:4px">Fairing ${whyMark('bad',`${out.length} part${out.length>1?'s':''} outside the shell`,W)}</div>`}
function standHTML(s){const g=b=>b.mu/b.R**2,f=v=>v>9.95?'10+':v.toFixed(1),
  to=p=>((p.phases||[]).find(x=>x.k==='transfer')||{}).to,pr=(typeof procsOf==='function'?procsOf(stackDef):[]).find(p=>procLandsOn(p,to(p))),ph=pr&&pr.phases.find(x=>x.k==='land'),B=pr&&BODIES.find(b=>b.name===to(pr))||TELLUS,
  L=landStance(s,g(B),ph?ph.ev:undefined),moon=!pr&&L.legs?landStance(s,g(SELENE)):null,on=L.legs?'its legs':L.on?`its ${L.on}`:'its base',
  what=L.n===L.of?'as built':`what's left after its drops (${L.n} of ${L.of} parts)`,cl=L.legs&&Math.min(L.v,moon?moon.v:9)<1.5?'warn':'';   // a warning for a lander only: every tall rocket tips past ~1 m/s
  const W={t:`Tips over drifting faster than ${f(Math.min(L.v,moon?moon.v:9))} m/s sideways`,d:'A tall lander on a narrow stance falls over if it touches down still drifting; under 1.5 m/s of sideways speed is a hard landing to fly.',
    fix:['wider legs: legs on a wider part, or more of them','a lower stack: drop what it doesn\'t need before landing','kill the sideways drift before touchdown, and come down slower']};
  return`<div style="margin-top:4px">Touchdown ${whyMark(cl,`stands drifting up to ${f(L.v)} m/s`,W)} <span class="dim">sideways on ${B.name}${moon?`, ${f(moon.v)} on ${SELENE.name}`:''}: ${what}, on ${on}${pr?', as its landing procedure flies it':''}; faster, it tips over${L.legs?'':'. Legs widen the stance'}</span></div>`}
// the Control block of the assembly readout (control session): kN·m per source against the need; turn times in vacuum
// later stages in the air (Q342): each one that lights while there's air, against what it takes to hold its course there
function airHTML(A){if(!A||!A.length)return'';return A.map(a=>{const ok=a.holds,cl=ok?(a.tau<=0.7*a.auth?'ok':'warn'):'bad',k=x=>(x/1000).toFixed(x<9500?1:0);
  const W={t:`Stage ${a.k} lights in the air, at ~${(a.h/1000).toFixed(0)} km`,d:ok?`It holds, with little to spare: ${airWhy(a).replace(/^h/,'H')}. A gust or a steeper turn takes the rest.`:`${airWhy(a).replace(/^h/,'H')}: it can't, and goes off its path.`,fix:airFix(a)};
  return`<div>Stage ${a.k} in the air ${whyMark(cl,ok?'holds':'flips off its path',W)} <span class="dim">lights at ~${(a.h/1000).toFixed(0)} km, ${(a.q/1000).toFixed(1)} kPa on a standard ascent · ${ok?`need ${k(a.tau)} kN·m, has ${k(a.auth)}`:airWhy(a)}${a.cal<0?` · its centre of pressure ${(-a.cal).toFixed(1)} calibers ahead of its centre of mass${a.fair?' (the fairing up front)':''}`:''}</span>${ok?(a.cal<0&&a.q>3000?'<div class="sub">Unstable there: separate pointing prograde. '+(a.lim<30?`Held more than ~${a.lim.toFixed(0)}° off its path it may go over${a.lim<7.5*a.auth/a.tau-0.4?' (its reaction wheels fill)':''}.`:'Ten degrees off, it needs twice the steering.')+'</div>':''):`<div class="sub">${airFix(a)}</div>`}</div>`}).join('')}
function controlHTML(c,stable){if(!c)return'';const k=x=>(x/1000).toFixed(x<9500?1:0),sec=t=>isFinite(t)?`${t.toFixed(1)} s`:'never',
  src=(r,rcs)=>[['wheels',r.wheel],['gimbal',r.gim],['fins',r.fin],['RCS',rcs]].filter(x=>x[1]>0.5).map(([n,x])=>`${n} ${k(x)}`).join(' + ')||'nothing',
  // short of authority, a stable design just turns into the wind; an unstable one goes over
  row=(lbl,r)=>{const have=r.auth+c.rcs,ok=r.tau<=have,cl=ok?(r.tau<=0.7*have?'ok':'warn'):stable?'warn':'bad';
    const W={t:`${lbl.replace(/^./,c=>c.toUpperCase())} at max-q: needs ${k(r.tau)} kN·m, has ${k(have)}`,d:ok?'It holds 5° off the airflow at the worst of the climb, with under 30% to spare: a gust or a sharper turn takes the rest.':stable?'It can\'t hold 5° off the airflow there, but it\'s stable, so it turns into the wind and flies on: it just won\'t go where it\'s pointed until the air thins.':'It can\'t hold 5° off the airflow there, and it\'s unstable: once it slips, the air turns it over.',
      fix:['fins at the tail: a stable rocket lets the air do the holding','more steering: steerable fins, an engine that gimbals, reaction wheels','a gentler turn through max-q']};
    return`<div>${lbl} ${whyMark(cl,ok?'holds':stable?'weathervanes':'flips',W)} <span class="dim">need ${k(r.tau)} kN·m · ${src(r,c.rcs)}</span></div>`};
  const A=AV[avNow()],nx=AV[avNow()+1];
  return`<h2>Control</h2><div>SAS <b>${A.name}</b> <span class="dim">${A.modes?A.modes.length===1?'attitude hold only':'hold and the velocity-vector modes':'every mode'}${nx?` · ${nx.name.toLowerCase()} with ${COMP_ERAS[nx.era].name.toLowerCase()}`:''}</span></div>
    <div class="dim">Holding 5° off the airflow at ${term('maxq','max-q')} (25 kPa, M1.2):</div>
    ${row('burning',c.burn)}${row('coasting',c.coast)}
    <div>Roll <span class="dim">${src(c.roll,c.rcs)}${src(c.roll,c.rcs)==='nothing'?'':' kN·m'}</span></div>
    <div>90° turn in vacuum <b>${sec(c.turn.wheels)}</b> <span class="dim">wheels${c.rcs?' + RCS':''}</span> · <b>${sec(c.turn.burn)}</b> <span class="dim">first stage lit</span></div>
    ${c.spin&&c.spin.length?`<div>Spin motors <b>${c.spin.map(r=>r.toFixed(0)).join(', ')} rpm</b> <span class="dim">when their stage lights${c.spin.some(r=>r<60)?' · under 60 rpm the axis wanders':''}</span></div>`:''}`}
const certFrac=p=>p&&p.sk1?p.anaFrac/Math.min(certOf(p.sk1),certOf(p.sk2)):null;   // the builder only ever shows loads vs certified ratings
// the power budget (vehicle session, Q34a): only for a design with something that draws or makes power. The steady state in
// the orbit the flight is aimed at (an accepted satellite contract's altitude, else low Tellus orbit; Q131), the sun in its
// plane (the longest shadow): the panels' and RTGs' average against the load, and the battery against one pass through the shadow
const powerAim=()=>{const a=flightAims().filter(x=>x.alt).sort((x,y)=>y.alt-x.alt)[0];return a?{r:TELLUS.R+a.alt*1000}:{}};
// the payload bench's Checks (Q416, PROBES § 6.1): payChecks against the rocket it was opened from, if that carries it
function benchHTML(empty){if(empty)return'<div class="dim">an empty payload: start from a probe core, or a starter below the parts</div>';
  const b=BLD.bench(),C=payChecks(stackDef,b&&b.back&&isV2(b.back.def)?b.back.def:null,b?b.id:null),sym={ok:'✓',warn:'!',bad:'✕'};
  return`<h2 style="margin-top:0">Payload checks</h2>`+C.rows.map(r=>`<div class="${r.cl}" style="margin-top:3px">${sym[r.cl]} ${r.t}${r.fix?`<div class="sub">${r.fix}</div>`:''}</div>`).join('')+
    `<div style="margin-top:8px">${(C.mass*1000).toFixed(0)} kg · ${fmtM(C.cost)} <span class="dim">(the payload alone)</span></div>
    <div class="sub">Pointing and temperatures are checked once the attitude law comes (PROBES S2). Done takes it back to the rocket; every block of it there follows.</div>`}
function powerLine(s){if(!s.parts.some(p=>p.d.W||p.d.Wg||p.d.kind==='solar'||p.d.kind==='batt'))return'';const B=powerBudget(s,powerAim()),f=x=>x.toFixed(0);
  const okA=B.avg>=B.use,okB=B.battWh>=B.needWh,c=x=>x?'ok':'bad';
  const WA={t:`The panels can't keep up: +${f(B.avg)} W against −${f(B.use)} W`,d:'Averaged over a whole orbit, night side included, it makes less than it uses: the battery drains a little every orbit until it runs flat and the craft goes quiet.',fix:['more solar panels, or a solar wing','an RTG, which works day and night','fewer parts drawing power']},
    WB={t:`The battery can't last the night: ${f(B.needWh)} Wh needed, ${f(B.battWh)} Wh aboard`,d:`Behind the planet the panels make nothing for ${f(B.tE/60)} minutes, and the battery carries the whole load till sunrise.`,fix:['a bigger battery, or a second one','an RTG, which keeps working in the dark','fewer parts drawing power']};
  return`<div style="margin-top:6px">Power ${whyMark(c(okA),`+${f(B.avg)} W`,WA)} / −${f(B.use)} W <span class="dim">(${B.alt>(TELLUS.atm+10000)/1000+1?`${f(B.alt)} km orbit`:'low orbit'} average, the sun in its plane)</span> · shadow ${f(B.tE/60)} min needs ${whyMark(c(okB),`${f(B.needWh)} Wh`,WB)} <span class="dim">(battery ${f(B.battWh)} Wh)</span>${okA?'':' <span class="warn">the panels can’t keep up: it runs flat</span>'}</div>`}
// a satellite's lifetime (vehicle session, Q141): for a design carrying an antenna, a camera or instruments, at the orbit the
// flight is aimed at (else low Tellus orbit): what holding it costs a day, how long the Δv left pays for it, then what happens
function lifeLine(s){if(!s.parts.some(p=>['ant','cam','sci'].includes(p.d.kind)))return'';const a=flightAims().filter(x=>x.alt).sort((x,y)=>y.alt-x.alt)[0],
    alt=a?a.alt:Math.round((TELLUS.atm+10000)/1000),L=satLife(stackDef,alt),fall=L.fall<Infinity?`the air brings it down in ${daysS(L.fall)}`:null;
  let t;if(!(L.rate>0))t=fall?`nothing worth burning against but the air: it comes down in ${daysS(L.fall)}`:'holds its orbit for good';
  else if(!(L.spare>0))t=`holding it costs ${L.rate.toFixed(2)} m/s a day and it has none to spare: ${fall||'it drifts off its slot (its service pauses)'}`;
  else t=`holding it costs ${L.rate.toFixed(2)} m/s a day; ~${Math.round(L.spare)} m/s left there holds it ${L.days>=20*YEAR_D?'past 20 years':daysS(L.days)}, then ${fall||'it drifts off its slot (its service pauses)'}`;
  const c=L.days<YEAR_D&&L.rate>0||!(L.rate>0)&&fall&&L.fall<YEAR_D?'warn':'dim';
  const W={t:`Short-lived at ${alt} km: under a year`,d:'Its service ends when it comes down or drifts off its slot, and a contract that wants it up for longer counts it as lost.',fix:['a higher orbit: the air thins fast with height','more propellant left once it\'s there: a bigger last stage or a lighter payload']};
  return`<div style="margin-top:4px">Lifetime at ${alt} km ${c==='warn'?whyMark('warn',t,W,'span'):`<span class="${c}">${t}</span>`}</div>`}
function editorChanged(){
  const empty=BLD.isEmpty(stackDef),bench=BLD.bench();
  if(!bench&&isV2(stackDef))paySync(stackDef);   // blocks follow their payload's bench copy (Q416)
  if(!empty){resetShip();S.ana=bench?null:analyze(S)}
  BLD.panel();
  {const r=$('bRoll');if(r){r.disabled=!!bench;r.style.opacity=bench?.45:'';r.textContent=bench?'ON THE PAYLOAD BENCH':'BUILD AND LAUNCH ▶ [L]';r.title=bench?'on the payload bench: Done goes back to the rocket':'build it for real: the launch site, the checks, then LAUNCH'}
    const h=$('statsHd');if(h)h.style.display=bench?'none':''}
  if(bench){$('stats').innerHTML=benchHTML(empty);BLD.frameCam();renderProgram();return}
  if(empty){$('stats').innerHTML='<div class="dim">empty — pick a command pod from the parts list</div>';return}
  const{stages,mass}=stageStats(stackDef);let tot=0,html='';
  stages.forEach((s,i)=>{tot+=s.dvV;const tw=s.twr<1?'bad':s.twr<1.3?'warn':'ok',x=s.twr.toFixed(2);
    const W=i===0?(s.twr<1?{t:`Stage 1 can't lift itself: thrust ${x}× its weight`,d:'Under 1 it sits on the pad with its engines running.',fix:['a stronger engine, or boosters on the side','less propellant in this stage','a lighter upper stage or payload']}
        :{t:`A slow climb: thrust ${x}× its weight`,d:'Every second spent climbing slowly is spent holding the rocket up against gravity: propellant burned that a quicker climb keeps.',fix:['boosters on the side','a stronger engine','one tank fewer on this stage']})
      :{t:`Stage ${i+1} pushes ${x}× its weight`,d:s.twr<1?'An upper stage can fly under 1 if it lights high and already fast, but the lower it lights, the longer it burns and the more it sags back toward the air.':'A little slow for an upper stage that lights low: it sags a bit before it gains speed. Fine if it lights high.',fix:['a stronger engine','less propellant in this stage','light it later, higher and faster']};
    html+=`<div class="seg"><b>Stage ${i+1}</b> <span class="dim">${s.m0.toFixed(2)} t → ${s.mf.toFixed(2)} t</span><br>${term('dv','Δv')} <b>${s.dvV.toFixed(0)}</b> / ${s.dvA.toFixed(0)} m/s · ${term('twr','TWR')} ${whyMark(tw,x,W,'span')} · ${s.burn.toFixed(0)} s</div>`});
  {const c=vesselCost(S.parts),ok=c.cost<=PROG.funds+1e-9;html+=`<div class="dim" style="margin-top:6px">${prepDays(c.cost).toFixed(1)} days to stack</div>`+studyLine(S);$('launch').textContent=ok?'LAUNCH [L]':'OVER BUDGET';$('launch').style.opacity=ok?1:.55;
   html+=`<div style="margin-top:6px">Cost ${ok?`<b class="acc">${fmtM(c.cost)}</b>`:whyMark('bad',fmtM(c.cost),{t:`Over budget: ${fmtM(c.cost)} with ${fmtM(PROG.funds)} in the account`,d:'The launch is refused until the program can pay for it.',fix:['cheaper parts: fewer or smaller engines and tanks','parts that come home on a chute cost less the second time','wait for money: contracts and the budget fill the account']})} <span class="dim">of ${fmtM(PROG.funds)} · ${fmtM(c.dry*REFURB)} back if it all lands intact</span>${importsLine(S.parts)}${knowhowLine(S.parts)}</div>`}
  html+=`<div style="margin-top:6px">Total ${term('dv','Δv')} <b class="acc">${tot.toFixed(0)} m/s</b> · ${mass.toFixed(2)} t</div>
    ${powerLine(S)}
    ${lifeLine(S)}
    <div class="sub">${logHintHTML()}</div>`;
  if(!S.parts.some(p=>p.d.torque))html+=S.ana&&S.ana.ctl.steer?whyMark('warn','No reaction wheels: it steers only with engines burning, steerable fins in the air, or RCS.',{t:'Nothing turns it on a coast in space',d:'Engines steer only while they burn and fins only in air: between burns it can\'t point where the next burn needs it.',fix:['a reaction wheel','RCS thrusters and a gas bottle']},'div'):whyMark('warn','No reaction wheels, gimbals, steerable fins or RCS: no control at all.',{t:'It can\'t steer at all',d:'It flies wherever the air and the thrust send it: no turn toward orbit, no pointing for a burn.',fix:['an engine that gimbals','a reaction wheel','steerable fins for the climb','RCS thrusters and a gas bottle']},'div');
  BLD.frameCam();
  const a=S.ana,cal=r=>(r.ycm-r.ycp)/(2*S.radius),cc=v=>v<0?'bad':v<0.5?'warn':'ok',lc=f=>f>1?'bad':f>.7?'warn':'ok';
  const stW=(v,when)=>({t:v<0?`Unstable ${when}: ${(-v).toFixed(2)} calibers the wrong way`:`Barely stable ${when}: ${v.toFixed(2)} calibers`,
      d:v<0?'The air\'s push sits ahead of the balance point, like an arrow with its feathers at the front: in air it wants to fly tail-first, and only steering holds it (engines burning, steerable fins).':'It flies nose-first, but with under half a caliber a gust or a turn can tip it past what it recovers from.',
      fix:['fins at the bottom, or bigger ones (right-click a fin)','heavier parts higher up the stack, light ones lower','keep an engine burning through the thick air']}),
    stM=(v,when)=>whyMark(cc(v),v.toFixed(2),stW(v,when));
  const jn=w=>w.p?`${w.kind} · ${w.p.d.name} / ${w.p.parent.d.name}`:'';
  const jW=(w,when,own)=>({t:`${w.p?`The joint ${w.p.d.name} / ${w.p.parent.d.name}`:'A joint'} at ${(w.frac*100).toFixed(0)}% of its rating ${when}`,
    d:w.frac>1?'Past its certified rating: ratings start at 70% of what the part really takes, so it may hold, but the further past, the likelier it breaks.':'Near its certified rating: a turn or a gust on the way up adds to it.',fix:jointFix(w,own)});
  html+=`<h2>Aerodynamics &amp; structure</h2>
    <div>${term('stab','Stability')} <span class="dim">in calibers</span><br>
    full ${stM(cal(a.ful),'full on the pad')} · stage-1 dry ${stM(cal(a.emp),'with stage 1 burned out')} · M1.6 ${stM(cal(a.sup),'at M1.6, past the speed of sound')}</div>
    <div style="margin-top:4px">Liftoff ${whyMark(lc(a.lift.cert.frac),`${(a.lift.cert.frac*100).toFixed(0)}%`,jW(a.lift.cert,'at liftoff',false))} <span class="dim">${jn(a.lift.cert)}</span></div>
    <div>${term('maxq','Max-q')} ${(a.mq.q/1000).toFixed(0)} kPa · M${a.mq.M.toFixed(1)} · 5° ${whyMark(lc(a.mq.cert.frac),`${(a.mq.cert.frac*100).toFixed(0)}%`,jW(a.mq.cert,'at max-q, 5° off the airflow',a.mq.own))} <span class="dim">${a.mq.own?'its own peak on a standard ascent (past the 25 kPa design case) · ':''}${jn(a.mq.cert)}</span>${a.mq.cert.frac>0.7?`<div class="sub">${a.mq.cert.frac>1?jointFix(a.mq.cert,a.mq.own):'Near its rating (a turn or a gust adds to it): '+jointFix(a.mq.cert,a.mq.own).replace(/^./,c=>c.toLowerCase())}</div>`:''}
</div>
    ${trimHTML(S)}
    ${fitHTML(S)}
    ${standHTML(S)}
    ${controlHTML(a.ctl,Math.min(cal(a.ful),cal(a.sup))>0)}
    ${airHTML(a.air)}
    <div class="sub">${Math.min(cal(a.ful),cal(a.emp),cal(a.sup))<0?`Negative stability: it flips unless something steers it: the engines
    while they burn, steerable fins while there's air (the Control block says which hold). `:''}Joint loads are against <b>certified</b> ratings, which start at 70% of what a part can really take. Over 100%: beyond what's
    been proven. It may hold, or not. An instrument package's telemetry certifies the parts it flies with.</div>`;
  renderProgram();
  $('stats').innerHTML=html;if(atRoll)renderRollout()}   // (a site picked in the Rollout rebuilds the ship: refresh the checks)
$('stats').addEventListener('click',e=>{if(e.target.dataset&&e.target.dataset.study){if(!orderStudy(S))HOOK.msg('Not possible right now');editorChanged()}});   // economy: trajectory studies
$('launch').onclick=()=>{if(BLD.isEmpty(stackDef))return;BLD.drop();{const fee=siteAccessOf(curSite()).fee||0;if(vesselCost(S.parts).cost+fee>PROG.funds+1e-9){HOOK.msg(`Over budget: this design costs ${fmtM(vesselCost(S.parts).cost)}${fee?` plus ${fmtM(fee)} for the site`:''}, the program has ${fmtM(PROG.funds)}`);return}}
  {const t=curSite(),a=siteAccessOf(t),fz=siteFits(t,S.parts),rv=rvLaunchWhy(S.parts)||partLaunchWhy(S.parts);if(rv){HOOK.msg(rv);return}if(!a.ok){HOOK.msg(a.why);renderSites();return}if(!fz.ok){HOOK.msg(fz.why);renderSites();return}const w=downrangeWarning(t);if(w)HOOK.news(w,'warn')}resetShip();go('flight');cam.dist=Math.max(18,S.len*1.6);cam.pitch=0.12;HOOK.msg('Space to ignite · Z for full throttle')};
// ---- the launch-site picker (terrain session): ours first, then abroad (refused until economy's siteAccess allows it).
// Picking a site moves the ship in the construction screen onto that pad.
const fmtLat=l=>`${Math.abs(l).toFixed(1)}°${l>=0?'N':'S'}`;
function renderSites(){const el=$('sitePick');if(!el)return;const cur=curSite(),pn=i=>i==null?'open sea':POWERS[i].root,bad=t=>`<br><span style="color:#ff8a7a">${t}</span>`;
  const opt=t=>`<option value="${t.id}"${t===cur?' selected':''}>${siteAccessOf(t).ok?'':'⛔ '}${t.name} · ${fmtLat(t.lat)}</option>`;
  const own=SITES.filter(t=>t.power===HOME),abroad=SITES.filter(t=>t.power!==HOME),dr=cur.downrange,forn=dr.over.filter(i=>i!==cur.power);
  const a=siteAccessOf(cur),fz=S&&S.parts?siteFits(cur,S.parts):{ok:true};
  el.innerHTML=`<select id="siteSel" style="width:100%">${own.length?`<optgroup label="ours">${own.map(opt).join('')}</optgroup>`:''}<optgroup label="abroad">${abroad.map(opt).join('')}</optgroup></select>
    <div class="dim" style="margin:4px 0 8px">${fmtLat(cur.lat)} · free ${cur.rot.toFixed(0)} m/s east · lowest inclination ${cur.minInc.toFixed(1)}° · pad at ${cur.h.toFixed(0)} m<br>
    downrange ${dr.az}°: ${(dr.sea*100).toFixed(0)}% water${forn.length?`, over ${forn.map(pn).join(', ')}`:''} · polar corridor ${cur.polar||'none'}<br>
    ${cur.kind==='sea'?'a floating platform: stages of any size come by ship':cur.coastal?'coastal: stages of any size come by barge':`inland: stages up to ${cur.maxDia} m come by rail`}<br>
    weather today: ${siteWeather(cur,(PROG.day||0)*DAY_S).word}${downrangeWarning(cur)?`<br><span style="color:#ffc46b">${downrangeWarning(cur)}</span>`:''}${a.ok?(a.fee?`<br>${a.how}: ${fmtM(a.fee)} a launch`:''):bad(a.why)}${fz.ok?'':bad(fz.why)}</div>`;
  $('siteSel').onchange=e=>{PROG.site=e.target.value;HOOK.save();editorChanged();renderSites()};
  // the one-line summary pinned above LAUNCH (PLAYTEST #20): the full picker above scrolls with the panel
  const sl=$('siteLine');if(sl)sl.innerHTML=`${a.ok&&fz.ok?'':'<span style="color:#ff8a7a">⛔</span> '}${cur.name} · ${fmtLat(cur.lat)} · ${siteWeather(cur,(PROG.day||0)*DAY_S).word}${downrangeWarning(cur)?' · <span style="color:#ffc46b">downrange warning</span>':''}`;sl&&(sl.title=a.ok?fz.ok?'':fz.why:a.why)}
$('bEditor').onclick=()=>go('assembly');
$('bRevert').onclick=revertFlight;
$('bMap').onclick=()=>toggleMap();
$('bHelp').onclick=()=>toggleHelp();$('bMenu').onclick=()=>ovToggle('escm');
const SASM=[['stab','Stability'],['pro','Prograde'],['retro','Retro'],['normal','Normal'],['anti','Anti-nrm'],['radout','Rad out'],['radin','Rad in'],['node','Maneuver'],['tgt','Target'],['antitgt','Anti-tgt'],['rpro','Rel pro'],['rretro','Rel ret'],['dock','Docking']];
function renderSAS(){const el=$('sas');el.innerHTML='';
  const t=document.createElement('button');t.className='wide'+(S.sas?' on':'');t.textContent='SAS '+(S.sas?'ON':'OFF')+' [T]';t.onclick=()=>{S.sas=!S.sas;S.hold=null;renderSAS()};el.appendChild(t);
  if(rcsJets(S)){const b=document.createElement('button');b.className='wide'+(S.rcs?' on':'');b.textContent='RCS '+(S.rcs?'ON':'OFF')+' [V]';b.onclick=()=>{S.rcs=!S.rcs;renderSAS()};el.appendChild(b)}
  t.title=avOf(S).name;const no=[];
  for(const[k,n]of SASM){if(TGT_M.includes(k)&&S.target==null)continue;const b=document.createElement('button');b.textContent=n;if(k==='stab')b.className='wide';if(S.sas&&S.sasMode===k)b.classList.add('on');
    if(!sasModeOK(S,k)){const g=avNext(k);no.push(`${n.toLowerCase()} (${g.name}, ${COMP_ERAS[g.era].name.toLowerCase()})`);continue}   // (Q286) a mode it can't fly isn't shown: SAS's title says when it comes
    b.onclick=()=>{S.sas=true;S.sasMode=k;S.hold=null;renderSAS()};el.appendChild(b)}
  if(no.length)t.title=`${avOf(S).name}. Not yet: ${no.join(', ')}`}
function renderStages(){if(!S)return;const el=$('stages');let html='<h2 style="margin-top:0">Stages</h2>';
  const ev=S.events;for(let i=ev.length-1;i>=S.evIdx;i--){const e=ev[i],parts=[];
    if(e.decouple.length)parts.push(e.radial?'drop '+S.segs[e.decouple[0]].label.split(' (')[0]:'decouple');
    if(e.ignite.length){const nm={};S.parts.filter(p=>p.on&&e.ignite.includes(p.seg)&&p.d.kind==='engine').forEach(p=>{const n=p.d.name.split(' ')[0];nm[n]=(nm[n]||0)+1});
      parts.push('ignite '+Object.entries(nm).map(([n,c])=>c>1?`${n}×${c}`:n).join(' + '))}
    if(e.chute)parts.push('chute');
    html+=`<div class="stg${i===S.evIdx?' cur':''}"><b>${i===S.evIdx?'▶ ':''}${i+1}</b> ${parts.join(' · ')}</div>`}
  if(S.evIdx>=ev.length)html+='<div class="dim">no stages left</div>';
  const agg={};for(let k=0;k<S.segs.length;k++){const fm=S.parts.filter(p=>p.on&&p.seg===k).reduce((a,p)=>a+(p.cap.fuel||0),0);
    if(fm>0){const L=S.segs[k].label,a=agg[L]=agg[L]||[0,0];a[0]+=segFuel(S,k);a[1]+=fm}}
  for(const[L,[f,fm]]of Object.entries(agg))html+=`<div class="dim" style="margin-top:4px">${L} ${f.toFixed(2)} t<div class="bar"><i style="width:${100*f/fm}%"></i></div></div>`;
  el.innerHTML=html}

