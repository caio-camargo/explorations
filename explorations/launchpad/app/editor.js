// app/editor.js — the editor UI. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ editor UI
const $=id=>document.getElementById(id);
// the construction screen lives in builder.js (BLD)
function renderEditor(){BLD.init();editorChanged();renderSites()}
function renderProgram(){const el=$('program');if(!el)return;const EP={1:'Epoch 1 · sounding rockets',2:'Epoch 2 · first orbit',3:'Epoch 3 · satellites that work',4:'Epoch 4 · Selene',5:'Epoch 5 · the second moon'};let html='';
  for(const ep of[1,2,3,4,5]){html+=`<div class="ep">${EP[ep]}</div>`;
    for(const M of MISSIONS.filter(m=>m.ep===ep)){const done=PROG.done[M.id],open=missionOpen(M);
      if(done)html+=`<div class="ms done"><b>✔ ${M.name}</b></div>`;
      else if(!open)html+=`<div class="ms lock">🔒 ${M.name} <span>· after ${M.req.filter(r=>!PROG.done[r]).map(r=>MISSIONS.find(m=>m.id===r).name).join(', ')}</span></div>`;
      else html+=`<div class="ms"><b>${M.name}</b> <span class="ok">+${fmtM(M.pay)}</span>${stageNote(M)}${M.prog?` <span class="acc">${M.prog()}</span>`:''}<div class="sub">${M.brief}</div></div>`}}
  const bands=BANDS.map(k=>PROG.atm[k]?'■':'□').join(''),ks=Object.keys(PARTS).filter(k=>!PARTS[k].radialOnly),full=ks.filter(k=>certOf(k)>=.999).length,tested=ks.filter(k=>certOf(k)>CERT0+.005).length;
  html=`<div class="ep">${fmtDate(PROG.day)} · Funds <b class="acc" style="font-size:13px">${fmtM(PROG.funds)}</b>${PROG.bailouts?` <span class="dim">· ${PROG.bailouts} top-up${PROG.bailouts>1?'s':''}</span>`:''}</div>`+html;
  const pc=p=>`hsl(${p.hue},70%,68%)`,H=POWERS[HOME];
  const F=flav(HOME),pris=Object.entries(F.pri).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(', ');
  html+=`<div class="ep">The world</div><div class="sub">Home: <b style="color:${pc(H)}">${H.name}</b> · opinion of us ${opOf(HOME).toFixed(0)}<br>`+
    `<span class="dim">${F.name}: answers to ${F.open>=.6?'the public (elections)':F.open>=.4?'a mix of public and leadership':'the leadership'} · money: ${{tax:'taxes',commodity:'commodity revenue',patronage:'patronage',military:'the military budget'}[F.money]}${F.grow?', growing':''} · wants ${pris} · nationalism ${natWord(natOf(HOME))}</span>`+
    `<br><span class="dim">Industry: makes ${TIER_NAME.filter((_,t)=>indOf(HOME)>=IND_TH[t]).join(', ')}${[0,1,2].some(t=>indOf(HOME)<IND_TH[t])?`; imports ${[0,1,2].filter(t=>indOf(HOME)<IND_TH[t]).map(t=>{const k={1:'sparrow',2:'condor'}[t],x=sourceOf(k);return `${TIER_NAME[t]} ${x.how==='grey'?'<span class="bad">via intermediaries ×3</span>':`from ${POWERS[x.from].root}`}`}).join(', ')}`:''}</span>`+
    `${PROG.demand?`<br><span class="warn">The leadership expects a spectacular within ${(PROG.demand.by-PROG.day).toFixed(0)} days</span>`:''}${F.open>=.6&&PROG.nextElection!=null?`<br><span class="dim">Next election in ${(PROG.nextElection-PROG.day).toFixed(0)} days</span>`:''}<br>`+
    POWERS.filter(p=>p.i!==HOME).map(p=>{const r=relOf(HOME,p.i);return`<span style="color:${pc(p)}">${p.name}</span> <span class="dim">(${ARCH[archOf(p.i)].name.toLowerCase()})</span> · <span class="${r>.2?'ok':r<-.2?'bad':'dim'}">${relWord(r)}</span> · opinion ${opOf(p.i).toFixed(0)}`}).join('<br>')+`</div>`;
  {const used=Object.keys(PROG.kh||{}).sort((a,b)=>khBar(b)-khBar(a)),bar=k=>`<span class="acc">${'▮'.repeat(Math.round(khBar(k)*8))}${'▯'.repeat(8-Math.round(khBar(k)*8))}</span>`,
     prod=k=>{const x=sourceOf(k);return x.how==='line'?`${x.line.lic!=null?'licensed':'own'} line, maturity ${(x.line.m*100).toFixed(0)}%`:x.how==='home'?'home-made':x.how==='grey'?'<span class="bad">grey market</span>':`from ${POWERS[x.from].root}`};
   if(used.length)html+=`<div class="ep">Know-how</div><div class="sub">${used.slice(0,10).map(k=>`${bar(k)} ${PARTS[k].name} <span class="dim">· ${prod(k)}</span>`).join('<br>')}</div>`}
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
  {const L=PROG.lines||{},mine=Object.keys(L).filter(k=>L[k].power===HOME),cand=S?[...new Set(S.parts.map(p=>p.d.key))].filter(k=>{const x=sourceOf(k);return(x.how==='import'||x.how==='grey')&&!(L[k]&&L[k].power===HOME)}):[];
   if(mine.length||cand.length){html+=`<div class="ep">Production</div><div class="sub">`+mine.map(k=>{const l=L[k];return PROG.day<l.ready?`${PARTS[k].name}: tooling up, ready in ${(l.ready-PROG.day).toFixed(0)} days`:`${PARTS[k].name}: ${l.lic!=null?`licensed from ${POWERS[l.lic].root}`:'own line'} · maturity ${(l.m*100).toFixed(0)}% · ${l.units} built · ×${prodLineK(l).toFixed(2)} per unit`}).join('<br>')+
     cand.map(k=>{const q=prodQuote(k),b=(m,o,lbl)=>`<button data-line="${k}:${m}" ${o.ok&&PROG.funds>=o.cost?'':'disabled'} title="${o.why||''}">${lbl} ${fmtM(o.cost)}, ${o.days} d</button>`;
       return `<div style="margin-top:3px">${PARTS[k].name} <span class="dim">(bought abroad)</span><br>${b('own',q.own,'Own line')} ${b('lic',q.lic,q.lic.from!=null?`License from ${POWERS[q.lic.from].root}`:'License')}${!q.own.ok?`<br><span class="dim">${q.own.why}</span>`:''}</div>`}).join('')+`</div>`}}
  html+=`<div class="ep">What we know</div><div class="sub">Atmosphere 0–${(TELLUS.atm/1e3).toFixed(0)} km <span class="acc">${bands}</span> (sampled bands)<br>Parts: ${tested} with flight data, ${full} fully proven, of ${ks.length}<br>Flights ${PROG.flights}${PROG.streak?` · clean-range streak ${PROG.streak}`:''}${selKnowHTML()}</div>
    <button id="progReset" style="margin-top:6px;font-size:10.5px">reset program</button>`;
  el.innerHTML=html.replace(/^(<div class="ep">.*?<\/div>)/,m=>m+ownershipHTML()+contractsHTML()+satsHTML());$('progReset').onclick=()=>{if(!confirm('Forget all missions and everything the program has learned?'))return;
    Object.assign(PROG,{done:{},cert:{},atm:{},streak:0,flights:0,funds:FUNDS0,bailouts:0,day:0,rel:{},op:{},offers:null,active:[],cdone:0,stand:{},recs:{},cycle:0,cyc:null,own:null,decisions:[],home:0,history:[],homeArch:null,nat:{},hush:0,hushPen:0,bmult:1,demand:null,cancelled:false,nextElection:null,comm:0,commPh:null,kh:{},lines:{},stand2:null,dev:{},devJob:null,studies:{},studyQ:[],compEra:null,staged:{},dispatch:[],fac:{}});HOME=0;RIVALS=raceSchedule();ensureBoard();HOOK.save();editorChanged()}}
// the Control block of the assembly readout (control session): kN·m per source against the need; turn times in vacuum
function controlHTML(c,stable){if(!c)return'';const k=x=>(x/1000).toFixed(x<9500?1:0),sec=t=>isFinite(t)?`${t.toFixed(1)} s`:'never',
  src=(r,rcs)=>[['wheels',r.wheel],['gimbal',r.gim],['fins',r.fin],['RCS',rcs]].filter(x=>x[1]>0.5).map(([n,x])=>`${n} ${k(x)}`).join(' + ')||'nothing',
  // short of authority, a stable design just turns into the wind; an unstable one goes over
  row=(lbl,r)=>{const have=r.auth+c.rcs,ok=r.tau<=have,cl=ok?(r.tau<=0.7*have?'ok':'warn'):stable?'warn':'bad';
    return`<div>${lbl} <b class="${cl}">${ok?'holds':stable?'weathervanes':'flips'}</b> <span class="dim">need ${k(r.tau)} kN·m · ${src(r,c.rcs)}</span></div>`};
  const A=AV[avNow()],nx=AV[avNow()+1];
  return`<h2>Control</h2><div>SAS <b>${A.name}</b> <span class="dim">${A.modes?A.modes.length===1?'attitude hold only':'hold and the velocity-vector modes':'every mode'}${nx?` · ${nx.name.toLowerCase()} with ${COMP_ERAS[nx.era].name.toLowerCase()}`:''}</span></div>
    <div class="dim">Holding 5° off the airflow at max-q (25 kPa, M1.2):</div>
    ${row('burning',c.burn)}${row('coasting',c.coast)}
    <div>Roll <span class="dim">${src(c.roll,c.rcs)}${src(c.roll,c.rcs)==='nothing'?'':' kN·m'}</span></div>
    <div>90° turn in vacuum <b>${sec(c.turn.wheels)}</b> <span class="dim">wheels${c.rcs?' + RCS':''}</span> · <b>${sec(c.turn.burn)}</b> <span class="dim">first stage lit</span></div>
    ${c.spin&&c.spin.length?`<div>Spin motors <b>${c.spin.map(r=>r.toFixed(0)).join(', ')} rpm</b> <span class="dim">when their stage lights${c.spin.some(r=>r<60)?' · under 60 rpm the axis wanders':''}</span></div>`:''}`}
const certFrac=p=>p&&p.sk1?p.anaFrac/Math.min(certOf(p.sk1),certOf(p.sk2)):null;   // the builder only ever shows loads vs certified ratings
function editorChanged(){
  const empty=BLD.isEmpty(stackDef);
  if(!empty){resetShip();S.ana=analyze(S)}
  BLD.panel();
  if(empty){$('stats').innerHTML='<div class="dim">empty — pick a command pod from the parts list</div>';return}
  const{stages,mass}=stageStats(stackDef);let tot=0,html='';
  stages.forEach((s,i)=>{tot+=s.dvV;const tw=s.twr<1?'bad':s.twr<1.3?'warn':'ok';
    html+=`<div class="seg"><b>Stage ${i+1}</b> <span class="dim">${s.m0.toFixed(2)} t → ${s.mf.toFixed(2)} t</span><br>Δv <b>${s.dvV.toFixed(0)}</b> / ${s.dvA.toFixed(0)} m/s · TWR <span class="${tw}">${s.twr.toFixed(2)}</span> · ${s.burn.toFixed(0)} s</div>`});
  {const c=vesselCost(S.parts),ok=c.cost<=PROG.funds+1e-9;html+=`<div class="dim" style="margin-top:6px">${prepDays(c.cost).toFixed(1)} days to stack</div>`+studyLine(S);$('launch').textContent=ok?'LAUNCH':'OVER BUDGET';$('launch').style.opacity=ok?1:.55;
   html+=`<div style="margin-top:6px">Cost <b class="${ok?'acc':'bad'}">${fmtM(c.cost)}</b> <span class="dim">of ${fmtM(PROG.funds)} · ${fmtM(c.dry*REFURB)} back if it all lands intact</span>${importsLine(S.parts)}${knowhowLine(S.parts)}</div>`}
  html+=`<div style="margin-top:6px">Total Δv <b class="acc">${tot.toFixed(0)} m/s</b> · ${mass.toFixed(2)} t</div>
    <div class="sub">${logHintHTML()}</div>`;
  if(!S.parts.some(p=>p.d.torque))html+=S.ana&&S.ana.ctl.steer?'<div class="warn">No reaction wheels: it steers only with engines burning, steerable fins in the air, or RCS.</div>':'<div class="warn">No reaction wheels, gimbals, steerable fins or RCS: no control at all.</div>';
  BLD.frameCam();
  const a=S.ana,cal=r=>(r.ycm-r.ycp)/(2*S.radius),cc=v=>v<0?'bad':v<0.5?'warn':'ok',lc=f=>f>1?'bad':f>.7?'warn':'ok';
  const jn=w=>w.p?`${w.kind} · ${w.p.d.name} / ${w.p.parent.d.name}`:'';
  html+=`<h2>Aerodynamics &amp; structure</h2>
    <div>Stability <span class="dim">(CoM ahead of CoP, calibers)</span><br>
    full <b class="${cc(cal(a.ful))}">${cal(a.ful).toFixed(2)}</b> · stage-1 dry <b class="${cc(cal(a.emp))}">${cal(a.emp).toFixed(2)}</b> · M1.6 <b class="${cc(cal(a.sup))}">${cal(a.sup).toFixed(2)}</b></div>
    <div style="margin-top:4px">Liftoff <b class="${lc(a.lift.cert.frac)}">${(a.lift.cert.frac*100).toFixed(0)}%</b> <span class="dim">${jn(a.lift.cert)}</span></div>
    <div>Max-q 25 kPa · M1.2 · 5° <b class="${lc(a.mq.cert.frac)}">${(a.mq.cert.frac*100).toFixed(0)}%</b> <span class="dim">${jn(a.mq.cert)}</span>
</div>
    ${controlHTML(a.ctl,Math.min(cal(a.ful),cal(a.sup))>0)}
    <div class="sub">${Math.min(cal(a.ful),cal(a.emp),cal(a.sup))<0?`Negative stability: it flips unless something steers it: the engines
    while they burn, steerable fins while there's air (the Control block says which hold). `:''}Joint loads are against <b>certified</b> ratings, which start at 70% of what a part can really take. Over 100%: beyond what's
    been proven. It may hold, or not. An instrument package's telemetry certifies the parts it flies with.</div>`;
  renderProgram();
  $('stats').innerHTML=html}
$('stats').addEventListener('click',e=>{if(e.target.dataset&&e.target.dataset.study){if(!orderStudy(S))HOOK.msg('Not possible right now');editorChanged()}});   // economy: trajectory studies
$('launch').onclick=()=>{if(BLD.isEmpty(stackDef))return;BLD.drop();if(vesselCost(S.parts).cost>PROG.funds+1e-9){HOOK.msg(`Over budget: this design costs ${fmtM(vesselCost(S.parts).cost)}, the program has ${fmtM(PROG.funds)}`);return}
  {const t=curSite(),a=siteAccessOf(t),fz=siteFits(t,S.parts);if(!a.ok){HOOK.msg(a.why);renderSites();return}if(!fz.ok){HOOK.msg(fz.why);renderSites();return}const w=downrangeWarning(t);if(w)HOOK.news(w,'warn')}resetShip();go('flight');cam.dist=Math.max(18,S.len*1.6);cam.pitch=0.12;HOOK.msg('Space to ignite · Z for full throttle')};
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
    weather today: ${siteWeather(cur,(PROG.day||0)*DAY_S).word}${downrangeWarning(cur)?`<br><span style="color:#ffc46b">${downrangeWarning(cur)}</span>`:''}${a.ok?'':bad(a.why)}${fz.ok?'':bad(fz.why)}</div>`;
  $('siteSel').onchange=e=>{PROG.site=e.target.value;HOOK.save();editorChanged();renderSites()};
  // the one-line summary pinned above LAUNCH (PLAYTEST #20): the full picker above scrolls with the panel
  const sl=$('siteLine');if(sl)sl.innerHTML=`${a.ok&&fz.ok?'':'<span style="color:#ff8a7a">⛔</span> '}${cur.name} · ${fmtLat(cur.lat)} · ${siteWeather(cur,(PROG.day||0)*DAY_S).word}${downrangeWarning(cur)?' · <span style="color:#ffc46b">downrange warning</span>':''}`;sl&&(sl.title=a.ok?fz.ok?'':fz.why:a.why)}
$('bEditor').onclick=()=>go('assembly');
$('bRevert').onclick=()=>{if(S&&S.rec&&S.rec.noRevert){HOOK.msg('No revert: this flight was handed over from a dispatch');return}resetShip();go('flight');HOOK.msg('Reverted to launch')};
$('bMap').onclick=()=>toggleMap();
$('bHelp').onclick=()=>toggleHelp();$('bMenu').onclick=()=>ovToggle('escm');
const SASM=[['stab','Stability'],['pro','Prograde'],['retro','Retro'],['normal','Normal'],['anti','Anti-nrm'],['radout','Rad out'],['radin','Rad in'],['node','Maneuver'],['tgt','Target'],['antitgt','Anti-tgt'],['rpro','Rel pro'],['rretro','Rel ret'],['dock','Docking']];
function renderSAS(){const el=$('sas');el.innerHTML='';
  const t=document.createElement('button');t.className='wide'+(S.sas?' on':'');t.textContent='SAS '+(S.sas?'ON':'OFF')+' [T]';t.onclick=()=>{S.sas=!S.sas;S.hold=null;renderSAS()};el.appendChild(t);
  if(rcsJets(S)){const b=document.createElement('button');b.className='wide'+(S.rcs?' on':'');b.textContent='RCS '+(S.rcs?'ON':'OFF')+' [V]';b.onclick=()=>{S.rcs=!S.rcs;renderSAS()};el.appendChild(b)}
  t.title=avOf(S).name;
  for(const[k,n]of SASM){if(TGT_M.includes(k)&&S.target==null)continue;const b=document.createElement('button');b.textContent=n;if(k==='stab')b.className='wide';if(S.sas&&S.sasMode===k)b.classList.add('on');
    if(!sasModeOK(S,k)){const g=avNext(k);b.disabled=true;b.style.opacity=.35;b.title=`${avOf(S).name}: no ${n.toLowerCase()} mode. ${g.name} with ${COMP_ERAS[g.era].name.toLowerCase()}.`}
    else b.onclick=()=>{S.sas=true;S.sasMode=k;S.hold=null;renderSAS()};el.appendChild(b)}}
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

