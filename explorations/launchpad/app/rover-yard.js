// app/rover-yard.js — the Rover yard. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ the Rover yard (sats session; NOTES § "Rovers: plan", R1)
// Design a rover (left panel) and drive it at home: the test yard beside the pad (ramps and side slopes on concrete) or
// open country nearby, at Tellus's gravity or as a lunar trainer (Selene's, on Tellus's ground). The sim is the rover
// block's (rvNew/rvRun); this is its screen: designs in PROG.rovers, the drive, the camera, the meshes, the readout.
let RV=null,rvSel=0,rvGround='yard',rvGK=1,rvCamHold=0,rvHudAt=0;const rvSpots={};
const rvDesigns=()=>{if(!Array.isArray(PROG.rovers)||!PROG.rovers.length)PROG.rovers=[rvDefault()];rvSel=clamp(rvSel,0,PROG.rovers.length-1);return PROG.rovers};
function rvSpot(){const site=curSite(),k=site.id+':'+rvGround;if(rvSpots[k])return rvSpots[k];const R=TELLUS.R;
  if(rvGround==='yard'){const Y=yardOf(site);return rvSpots[k]={yard:Y,pf:yardPF(Y,-20,-6),head:Y.n}}
  const u=countryOf(site),f=siteFrame(u);return rvSpots[k]={yard:null,pf:mul(u,R+terrainH(u)),head:f.n}}
function rvSpawn(){const d=rvDesigns()[rvSel],P=rvSpot();RV=rvNew(d,TELLUS,P.pf,P.head,{gk:rvGK,yard:P.yard});rvCamHold=0}
// the yard is drawn wherever it is (it's part of the home pad), whichever ground the drive is on
const rvYards={},rvYardShown=()=>{const site=curSite();return rvYards[site.id]||(rvYards[site.id]=yardOf(site))};
function rvEnter(){rvDesigns();if(rvRemote){ORB_T0=PROG.day*DAY_S-simT;RV=rvFromEntry(rvRemote);RV.remote=rvRemote}else rvSpawn();cam.dist=11;cam.pitch=.28;renderRover()}
function rvLeave(){if(RV&&RV.remote){const e=RV.remote;Object.assign(e,rvEntry(RV),{id:e.id})}else if(RV)rvFold(RV);HOOK.save();RV=null;rvRemote=null}
function rvReset(){if(RV&&RV.remote){HOOK.msg('Nobody can put it back: it drives on as it is');return}if(RV)rvFold(RV);HOOK.save();rvSpawn();renderRover()}
const rvWorld=R=>add(bodyPos(R.body,simT),fromPF(R.body,R.p,simT)),rvQW=R=>qmul(qBody(R.body,simT),R.q);
function rvTick(dtR){if(!RV)return;if(RV.remote&&!RV.obs)RV.obs=rvObsQ(RV.body,RV.p);
  RV.contact=rvContact(RV,simT,RV.remote?rvRelays([]):[]);rvCommand(RV,rvKeys(),RV.contact);if(RV.remote)rvSciSend(RV,RV.contact);rvPowerStep(RV,dtR,rvSunPF(RV.body,bodyTheta(RV.body,simT)));
  rvRun(RV,dtR);if(performance.now()-rvHudAt>100){rvHudAt=performance.now();rvHud()}
  rvChase(RV,dtR)}
addEventListener('keydown',e=>{if(mode!=='drive'||e.ctrlKey||e.metaKey||e.altKey||e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const k=e.key.toLowerCase();
  if(k===' ')e.preventDefault();keys.add(k);if(k==='r'&&!e.repeat)rvReset()});

// ---- the designer
const rvF=(x,n=0)=>Number.isFinite(x)?x.toFixed(n):'—';
function renderRover(){const el=$('rvDes');if(!el)return;
  if(RV&&RV.remote){const e=RV.remote,G=RV.G;el.innerHTML=`<h1>ROVER</h1><div class="sub">driven from home</div><div class="ndrow"><button data-go="program">← Program [P]</button></div>
    <h2>${rvEsc(e.name)}</h2><div>on ${RV.body.name} · ${Math.round(G.m)} kg · ${e.km.toFixed(2)} km driven so far</div>
    <div class="sub" style="margin-top:6px">Nobody is there to right it or change its battery. Its line of sight home, sunlight and the signal's delay come with power and contact (R3); plans that drive it between flights with R5.</div>`;return}const L=rvDesigns(),d=L[rvSel],C=RV_CH[d.ch],st=rvStats(d),T=st.T,Sx=st.S,on=(a,b)=>a===b?' class="on"':'';
  const opt=k=>`<option value="${k}"${''}>${RV_IT[k].name} · ${RV_IT[k].m} kg</option>`;
  let h=`<h1>ROVER YARD</h1><div class="sub">design a rover, then drive it here at home</div><div class="ndrow"><button data-go="program">← Program [P]</button></div>`;
  h+=`<h2>Designs</h2>`+L.map((x,i)=>`<div class="row"><span class="nm">${i===rvSel?'<b class="acc">':''}${rvEsc(x.name)}${i===rvSel?'</b>':''}</span>${i===rvSel?'':`<button data-rv="sel" data-i="${i}">open</button>`}</div>`).join('')
    +`<div class="ndrow"><button data-rv="new">New</button><button data-rv="copy">Copy</button>${L.length>1?'<button data-rv="del">Delete</button>':''}</div>`;
  h+=`<h2>Name</h2><input id="rvName" value="${rvEsc(d.name)}" maxlength="28" style="width:100%;font:inherit;background:rgba(0,0,0,.3);color:var(--fg);border:1px solid var(--line);border-radius:3px;padding:2px 4px">`;
  h+=`<h2>Chassis</h2><div class="ndrow">`+Object.entries(RV_CH).map(([k,c])=>`<button data-rv="ch" data-k="${k}"${on(k,d.ch)} title="${c.L} × ${c.W} m, ${c.m} kg">${c.name.split(' ')[0]} · ${c.slots} slots</button>`).join('')+`</div>`;
  h+=`<h2>Wheels</h2><div class="ndrow">`+Object.entries(RV_WH).map(([k,w])=>`<button data-rv="wh" data-k="${k}"${on(k,d.wh)} title="${(2*w.r).toFixed(2)} m across; a ${w.P} W motor in each hub; ${(w.v*3.6).toFixed(0)} km/h geared${PROG.wheelKm&&PROG.wheelKm[k]?`; ${PROG.wheelKm[k].toFixed(1)} km of testing`:''}">${w.name}</button>`).join('')+`</div>`
    +`<div class="ndrow">how many <button data-rv="n" data-k="4"${on(4,d.n===6?6:4)}>4</button><button data-rv="n" data-k="6"${on(6,d.n===6?6:4)}>6</button> · springs set for <button data-rv="spr" data-k="T"${on('T',d.spr||'T')}>Tellus</button><button data-rv="spr" data-k="S"${on('S',d.spr)}>Selene</button></div>`;
  h+=`<h2>Deck</h2>`+Array.from({length:C.slots},(_,i)=>`<div class="row"><span class="dim" style="width:16px">${i+1}</span><select data-slot="${i}" style="flex:1;font:inherit;background:rgba(0,0,0,.3);color:var(--fg);border:1px solid var(--line)"><option value="">— empty —</option>${Object.keys(RV_IT).map(opt).join('')}</select></div>`).join('')
    +`<div class="sub">Instruments ride as mass and height for now; their science comes later (R4).</div>`;
  const row=(t,a,b,cl='')=>`<tr><td class="dim">${t}</td><td${cl}>${a}</td><td${cl}>${b}</td></tr>`;
  {const lk=rvLocked(d);h+=`<div class="sub">Price ${fmtM(rvPrice(d))} when packed on a rocket${lk.length?`<br><span class="warn">Can't fly yet: ${lk.map(x=>`${x.name.toLowerCase()} ${x.why}`).join('; ')}</span>`:''}</div>`}   // economy (Q10)
  h+=`<h2>On paper</h2><div class="sub">${rvF(st.mass)} kg${st.crew?`, crew of ${st.crew}`:''} · track ${rvF(st.track,2)} m · wheelbase ${rvF(st.base,2)} m · clearance ${rvF(st.clear,2)} m</div>`
    +(st.kWh?'':`<div class="bad">No battery: it can't drive.</div>`)
    +`<table style="margin-top:4px"><tr><td></td><td class="acc">Tellus</td><td class="acc">Selene</td></tr>`
    +row('centre of mass',`${rvF(T.h,2)} m up`,`${rvF(Sx.h,2)} m up`)
    +row('tips sideways at',`${rvF(T.tipSide)}°`,`${rvF(Sx.tipSide)}°`)
    +row('tips fwd · back',`${rvF(T.tipFwd)}° · ${rvF(T.tipBack)}°`,`${rvF(Sx.tipFwd)}° · ${rvF(Sx.tipBack)}°`)
    +row('steepest climb',`${rvF(T.climb)}°`,`${rvF(Sx.climb)}°`)
    +row('&nbsp;&nbsp;limited by',T.lim,Sx.lim,' class="dim"')
    +row('top speed',`${rvF(T.vTop*3.6)} km/h`,`${rvF(Sx.vTop*3.6)} km/h`)
    +row('full-lock turn',`${T.turnBy} > ${rvF(T.vTurn*3.6)} km/h`,`${Sx.turnBy} > ${rvF(Sx.vTurn*3.6)} km/h`)
    +row('range (flat)',`${rvF(T.range)} km`,`${rvF(Sx.range)} km`)+`</table><div class="sub">Tellus figures on grass; Selene's on regolith.</div>`;
  const tr=d.test||{},tl=(t,n)=>t?`<div>${n}: ${t.km.toFixed(2)} km · climbed ${t.climb.toFixed(0)}° · ${(t.vmax*3.6).toFixed(0)} km/h${t.tips?` · <span class="warn">tipped ${t.tips}×</span>`:''}</div>`:'';
  h+=`<h2>Power and contact</h2><div>${st.sol?`panels ${st.sol} W at noon`:'no panels'}${st.rtg?` · RTG ${st.rtg} W`:''} · draws ${RV_HOTEL} W awake, ${RV_SLEEP} W asleep</div>`
    +`<div class="${st.rtg||st.kWh>=st.nightKWh*1.15?'':'warn'}">Selene's night, ${st.nightH.toFixed(0)} h: ${st.rtg?'the RTG keeps it warm':`its heater needs ${st.nightKWh.toFixed(1)} kWh; the battery holds ${st.kWh}`}</div>`
    +`<div class="sub">${st.hg?'High-gain antenna: talks to home whenever Tellus is up.':'No high-gain antenna: off Tellus it needs a relay in sight (a lander with an antenna).'}</div>`;
  h+=`<h2>Tested</h2>`+(tr.T||tr.S?tl(tr.T,'at Tellus g')+tl(tr.S,'as a lunar trainer'):'<div class="dim">not yet: drive it</div>');
  h+=`<h2>Test drive</h2><div class="ndrow"><button data-rv="gr" data-k="yard"${on('yard',rvGround)}>Test yard</button><button data-rv="gr" data-k="country"${on('country',rvGround)}>Open country</button></div>`
    +`<div class="ndrow">gravity <button data-rv="g" data-k="1"${on(1,rvGK)}>Tellus</button><button data-rv="g" data-k="s"${on(true,rvGK<1)} title="Selene's gravity on Tellus's ground, as Apollo crews trained on a 1/6-g rover">Lunar trainer</button></div>`
    +`<div class="ndrow"><button data-rv="reset">Back to the start [R]</button></div>`;
  el.innerHTML=h;el.querySelectorAll('select[data-slot]').forEach(s=>s.value=d.slots[+s.dataset.slot]||'');
  $('rvName').onchange=e=>{d.name=e.target.value.trim()||d.name;e.target.blur();HOOK.save();renderRover()}}
const rvEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-rv]');if(!t||mode!=='drive')return;const a=t.dataset.rv,k=t.dataset.k,L=rvDesigns(),d=L[rvSel];
  if(a==='sel')rvSel=+t.dataset.i;
  else if(a==='new'){L.push({...rvDefault(),name:`Rover ${L.length+1}`});rvSel=L.length-1}
  else if(a==='copy'){const c=JSON.parse(JSON.stringify(d));delete c.test;c.name=d.name+' II';L.push(c);rvSel=L.length-1}
  else if(a==='del'){if(RV){rvFold(RV);RV=null}L.splice(rvSel,1);rvSel=Math.max(0,rvSel-1)}
  else if(a==='ch'){d.ch=k;d.slots=(d.slots||[]).slice(0,RV_CH[k].slots)}
  else if(a==='wh')d.wh=k;else if(a==='n')d.n=+k;else if(a==='spr')d.spr=k;
  else if(a==='gr')rvGround=k;else if(a==='g')rvGK=k==='s'?RV_GS:1;
  else if(a!=='reset')return;
  t.blur();rvReset()});
document.addEventListener('change',e=>{const s=e.target;if(!s.dataset||s.dataset.slot==null||mode!=='drive')return;const d=rvDesigns()[rvSel];d.slots=d.slots||[];
  d.slots[+s.dataset.slot]=s.value||null;s.blur();rvReset()});

// ---- the readout
// R4: the instruments on board as buttons (greyed with the reason when they can't work), the ground, what waits to go home
// What we know: Selene's science so far (the findings themselves are in the logbook)
function selKnowHTML(){const P=PROG.sel;if(!P)return'';const nq=P.quakes.length,nl=P.quakes.filter(q=>q.loc).length;
  return`<br>Selene: ${P.spec.mare.length} mare and ${P.spec.high.length} highland rock readings · ${P.panos.length} panorama${P.panos.length===1?'':'s'} · ${P.seis.length} seismometer${P.seis.length===1?'':'s'} out${P.seis.length?`, ${nq} quake${nq===1?'':'s'} heard, ${nl} located${nq&&!nl?(P.seis.length<4?' (it takes 4 stations to place one)':P.quakes.some(q=>q.tried)?' (the array is too small to place them)':' (waiting for their records)'):''}`:''}`}
function rvSciRows(R){const ks=[['spec','Spectrometer'],['pano','Panorama'],['seis','Set out a seismometer']].filter(([k])=>rvItems(R,k==='pano'?'cam':k));
  const g=geoAt(R.body,R.p),w=(R.data||[]).length;if(!ks.length&&!g)return'';
  return`${g?`<tr><td class="dim">rock</td><td>${g.unit==='mare'?'dark plains (mare)':'bright uplands (highland)'}</td></tr>`:''}`+(ks.length?`<tr><td class="dim">science</td><td>${ks.map(([k,l])=>{const why=rvSciWhy(R,k);
    return`<button data-rvsci="${k}"${why?` disabled title="${why}"`:''}>${l}${k==='seis'?` (${R.seisLeft??SEIS_PACK*rvItems(R,'seis')})`:''}</button>`}).join(' ')}${w?`<div class="dim">${w} result${w>1?'s':''} waiting for contact</div>`:''}</td></tr>`:'')}
addEventListener('pointerdown',e=>{const k=e.target.dataset&&e.target.dataset.rvsci;if(!k||e.target.disabled)return;const R=mode==='drive'?RV:RVA;if(!R)return;
  e.preventDefault();rvSci(R,k,ORB_T0+simT);rvSciSend(R,R.contact);HOOK.save();rvHudAt=0;rvFHudAt=0});
function rvHud(el=$('rvHud'),R=RV){if(!el||!R)return;const G=R.G,up=norm(R.p),fw=qrot(R.q,[0,0,1]),vf=dot(R.v,fw),ti=rvTilt(R),st=rvStats(R.d),X=R.gk<1||R.body!==TELLUS?st.S:st.T,home=mode==='drive'&&!R.remote;
  const f=siteFrame(up),hd=Math.round(Math.atan2(dot(fw,f.e),dot(fw,f.n))*180/Math.PI+360)%360,slip=R.wh.some(w=>w.slip&&w.load>0),air=R.wh.every(w=>!w.load);
  const warn=R.wet?`<div class="bad">In the sea: lost.${home?' R starts again.':''}</div>`:R.tipped?`<div class="bad">Tipped over.${home?' R puts it back at the start: on a mission, nobody would.':' Nobody can right it.'}</div>`
    :!R.E&&G.kWh?'<div class="bad">Battery flat.</div>':!G.kWh?'<div class="bad">No battery: it can\'t drive.</div>':'';
  const tc=(a,lim)=>Math.abs(a)>lim*.8?'bad':Math.abs(a)>lim*.6?'warn':'';
  el.innerHTML=`<h2 style="margin-top:0">${rvEsc(R.d.name)} · ${R.body!==TELLUS?'on '+R.body.name:R.gk<1?'lunar trainer':'Tellus'}${R.remote?' · from home':''}</h2>${warn}<table>
    <tr><td class="dim">speed</td><td>${(Math.abs(vf)*3.6).toFixed(1)} km/h${vf<-.05?' (reverse)':''}</td></tr>
    <tr><td class="dim">heading</td><td>${hd.toFixed(0)}°</td></tr>
    <tr><td class="dim">pitch</td><td class="${tc(ti.pitch,ti.pitch>0?X.tipBack:X.tipFwd)}">${Math.round(ti.pitch)+0}° <span class="dim">of ${(ti.pitch>0?X.tipBack:X.tipFwd).toFixed(0)}</span></td></tr>
    <tr><td class="dim">roll</td><td class="${tc(ti.roll,X.tipSide)}">${Math.round(ti.roll)+0}° <span class="dim">of ${X.tipSide.toFixed(0)}</span></td></tr>
    <tr><td class="dim">ground</td><td>${R.su?R.su.name:'—'}${R.dep?' · <span class="acc">deploying</span>':`${slip?' · <span class="warn">slipping</span>':''}${air?' · <span class="warn">airborne</span>':''}`}</td></tr>
    <tr><td class="dim">battery</td><td>${G.kWh?(100*R.E/R.Emax).toFixed(0)+' %':'—'}</td></tr>
    <tr><td class="dim">power</td><td>${R.dead?'<span class="bad">frozen</span>':R.pGen==null?'—':`sun ${Math.round(R.sunEl)+0}° · <span class="${R.pGen>=R.pUse?'ok':'warn'}">${R.pGen>=R.pUse?'+':''}${Math.round(R.pGen-R.pUse)} W</span>`}</td></tr>
    <tr><td class="dim">contact</td><td>${!R.contact?'—':!R.contact.ok?'<span class="bad">none: it holds still</span>':R.contact.via==='crew'?'crew aboard':R.contact.via==='home'?`home${R.contact.delay?` · ${(R.contact.delay*1000).toFixed(0)} ms`:''}`:`via ${rvEsc(R.contact.via)}`}</td></tr>
    <tr><td class="dim">this drive</td><td>${R.rec.dist<1000?R.rec.dist.toFixed(0)+' m':(R.rec.dist/1000).toFixed(2)+' km'} · climbed ${R.rec.climb.toFixed(0)}°</td></tr>${rvSciRows(R)}</table>
    <div class="sub" style="margin-top:4px">W S drive · A D steer · Space brake · ${home?'R start again':mode==='flight'?'[ back to the lander':'P Program'}</div>`}

// ---- meshes: the body (chassis and deck) per design, and one wheel per kind with its axle along X
const rvMeshC=new Map();
function rvBodyMesh(d){const key=JSON.stringify([d.ch,d.wh,d.n,d.slots]);if(!rvMeshC.has(key))rvMeshC.set(key,makeMesh(rvBodyArr(d)));return rvMeshC.get(key)}
function rvBodyArr(d){const G=rvGeom(d),CH=G.C,a=[],W=CH.W/2,Hh=CH.H/2;
  const FR=[.55,.56,.58,1];box(a,[0,-Hh*.2,0],W*.94,Hh*.75,CH.L/2*.96,[.25,.26,.28,1]);   // the chassis: a tub inside a tubular frame
  for(const sx of[-1,1]){tube(a,[sx*W,Hh*.6,-CH.L/2],[sx*W,Hh*.6,CH.L/2],.035,FR,8,true);tube(a,[sx*W,-Hh*.6,-CH.L/2],[sx*W,-Hh*.6,CH.L/2],.035,FR,8,true);
    for(let i=0;i<=4;i++){const zz=-CH.L/2+i*CH.L/4;tube(a,[sx*W,-Hh*.6,zz],[sx*W,Hh*.6,zz],.025,FR,6)}}
  for(const zz of[-CH.L/2,CH.L/2])tube(a,[-W,Hh*.6,zz],[W,Hh*.6,zz],.035,FR,8,true);
  for(let i=0;i<4;i++){const zz=-CH.L/2+CH.L*(i+.5)/4;box(a,[0,Hh+.005,zz],W*.92,.008,CH.L/8*.94,i%2?[.16,.17,.19,1]:[.2,.21,.23,1])}   // floor panels
  for(const w of G.wheels){const s=Math.sign(w.x),fx=s*(W+G.Wk.w/2+.03),fr=G.Wk.r*1.1;   // fenders: an arc of panels over each wheel
    for(let k=0;k<7;k++){const t0=(k/7-.5)*2.2,t1=((k+1)/7-.5)*2.2,tm=(t0+t1)/2;box(a,[fx,Hh+.02+fr*(Math.cos(tm)-1)*.35+.04,w.z+Math.sin(tm)*fr*.85],G.Wk.w/2+.04,.012,fr*.85*(t1-t0)/2+.02,[.82,.82,.8])}
    box(a,[s*(W+.02),-Hh-.02,w.z],.05,.05,.06,C.D)}
  for(const t of G.items){const[x,y,z]=[t.x,t.y,t.z],[sx,sy,sz]=t.it.sz;
    if(t.k==='bat'){box(a,[x,y+sy/2,z],sx/2,sy/2,sz/2,C.D);box(a,[x,y+sy+.01,z],sx/2*.8,.01,sz/2*.8,C.AU)}
    else if(t.k==='seat'){box(a,[x,y+.2,z],.24,.04,.24,C.G);box(a,[x,y+.5,z-.24],.24,.3,.03,C.G);
      box(a,[x,y+.55,z-.05],.17,.3,.12,C.W);box(a,[x,y+.3,z+.15],.15,.08,.18,C.W);lathe(a,[[0,0,C.W],[.12,.03,C.W],[.15,.15,C.Y],[.12,.27,C.W],[0,.3,C.W]],[x,y+.85,z-.05],14)}
    else if(t.k==='cam'){lathe(a,[[.035,0,C.ST],[.035,1.3,C.ST]],[x,y,z],10);box(a,[x,y+1.38,z],.14,.08,.08,C.W);box(a,[x,y+1.38,z+.09],.04,.04,.02,C.GL)}
    else if(t.k==='ant'){lathe(a,[[.03,0,C.ST],[.03,.9,C.ST]],[x,y,z],10);lathe(a,[[.02,0,C.W],[.18,.03,C.W],[.33,.12,C.W],[.35,.15,C.W]],[x,y+.92,z],20,[true,false])}
    else if(t.k==='arm'){box(a,[x,y+.06,z],.08,.06,.08,C.ST);box(a,[x,y+.16,z-.05],.04,.04,.4,C.W);box(a,[x,y+.28,z+.05],.035,.035,.38,C.W);box(a,[x,y+.28,z+.44],.06,.06,.06,C.AU)}
    else if(t.k==='spec'){box(a,[x,y+sy/2,z],sx/2,sy/2,sz/2,C.AU);box(a,[x,y+sy+.04,z+.05],.04,.04,.04,C.GL)}
    else if(t.k==='seis'){box(a,[x,y+.1,z],sx/2,.1,sz/2,C.W);for(const o of[-.1,.1])lathe(a,[[.07,0,C.AU],[.07,.18,C.AU]],[x+o,y+.2,z],12)}
    else if(t.k==='sol'){box(a,[x,y+.08,z],.03,.08,.03,C.ST);box(a,[x,y+.17,z],sx/2,.012,sz/2,C.ST);box(a,[x,y+.185,z],sx/2-.02,.006,sz/2-.02,[.07,.09,.22,4])}
    else if(t.k==='rtg'){lathe(a,[[.1,0,C.D],[.1,.45,C.D],[0,.48,C.D]],[x,y,z],12);for(let i=0;i<6;i++){const g=i*Math.PI/3;box(a,[x+Math.cos(g)*.14,y+.22,z+Math.sin(g)*.14],.04+.0*g,.2,.04,C.G)}}
    else if(t.k==='drill'){for(const o of[[-.1,-.1],[.1,-.1],[0,.1]])box(a,[x+o[0],y+.6,z+o[1]],.02,.6,.02,C.ST);lathe(a,[[.04,-.15,C.D],[.04,1.1,C.D]],[x,y,z],10);box(a,[x,y+1.15,z],.12,.08,.12,C.W)}}
  return a}
function rvWheelMesh(k){const key='w'+k;if(!rvMeshC.has(key))rvMeshC.set(key,makeMesh(rvWheelArr(k)));return rvMeshC.get(key)}
function rvWheelArr(k){const Wk=RV_WH[k],a=[],r=Wk.r,w=Wk.w/2,tc=k==='m'?C.AU:C.BK;
  lathe(a,[[r*.55,-w,tc],[r*.95,-w,tc],[r,-w*.7,tc],[r,w*.7,tc],[r*.95,w,tc],[r*.55,w,tc]],[0,0,0],28,[false,false]);
  if(k==='m')for(let i=0;i<14;i++){const t=i/14*6.2832,c=Math.cos(t),sn=Math.sin(t);for(const sd of[-1,1])box(a,[c*r*1.005,w*.35*sd,sn*r*1.005],.012,w*.32,.04,[.32,.31,.29,1])}   // the mesh tyre's titanium chevrons
  lathe(a,[[r*.55,-w*.6,C.G],[r*.55,w*.6,C.G]],[0,0,0],28,[true,true]);lathe(a,[[r*.2,-w*1.05,C.ST],[r*.2,w*1.05,C.ST]],[0,0,0],14);
  for(let i=0;i<4;i++){const s=[];box(s,[0,0,0],r*.5,w*.25,r*.06,C.D);const c=Math.cos(i*Math.PI/4),sn=Math.sin(i*Math.PI/4);
    for(let j=0;j<s.length;j+=VX){const P=[s[j],s[j+1],s[j+2]],N=[s[j+3],s[j+4],s[j+5]];s[j]=c*P[0]+sn*P[2];s[j+2]=-sn*P[0]+c*P[2];s[j+3]=c*N[0]+sn*N[2];s[j+5]=-sn*N[0]+c*N[2]}
    for(let j=0;j<s.length;j+=VX)s[j+1]+=w*.8;a.push(...s)}
  for(let j=0;j<a.length;j+=VX){const x=a[j],y=a[j+1],nx=a[j+3],ny=a[j+4];a[j]=y;a[j+1]=-x;a[j+3]=ny;a[j+4]=-nx}   // turn the axle from Y onto X
  return a}
// a packed rover on its deck, facing +X, wheels hanging at full travel (part of the lander's mesh)
function rvOnDeck(out,d,b){const G=rvGeom(d),y0=-(G.yM-G.Wk.tr-G.Wk.r),a=rvBodyArr(d);
  for(const w of G.wheels){const s=rvWheelArr(d.wh);for(let j=0;j<s.length;j+=VX){s[j]+=w.x;s[j+1]+=G.yM-G.Wk.tr;s[j+2]+=w.z}for(const v of s)a.push(v)}
  for(let j=0;j<a.length;j+=VX){const P=rotY([a[j],a[j+1]+y0,a[j+2]],Math.PI/2),N=rotY([a[j+3],a[j+4],a[j+5]],Math.PI/2);out.push(P[0]+b[0],P[1]+b[1],P[2]+b[2],N[0],N[1],N[2]);for(let k=6;k<VX;k++)out.push(a[j+k])}}
// the yard's mounds, a height grid over each one's footprint (yard axes; the mesh's z is south so the frame turns right-handed)
let rvYardMesh=null;
function rvYardBuild(){if(rvYardMesh)return rvYardMesh;const a=[],col=[.5,.46,.4],hz=(x,z)=>{let h=0;for(const f of RV_YARD)h=Math.max(h,yardFeatH(f,x,z));return h};
  for(let x=-30;x<70;x+=.5)for(let z=8;z<102;z+=.5){const H=[[x,z],[x+.5,z],[x+.5,z+.5],[x,z+.5]].map(([u,v])=>hz(u,v));if(Math.max(...H)<=0)continue;
    const Q=[[x,z],[x+.5,z],[x+.5,z+.5],[x,z+.5]],P=Q.map(([u,v],i)=>[u,H[i]+.02,-v]),N=Q.map(([u,v])=>norm([-(hz(u+.25,v)-hz(u-.25,v))/.5,1,(hz(u,v+.25)-hz(u,v-.25))/.5]));
    for(const i of Math.abs(H[0]-H[2])<=Math.abs(H[1]-H[3])?[0,1,2,0,2,3]:[0,1,3,1,2,3])pv(a,P[i],N[i],col)}
  return rvYardMesh=makeMesh(a)}
function drawRoverScene(drawMesh,camW){const th=bodyTheta(TELLUS,simT),Y=rvYardShown(),o=fromPF(TELLUS,Y.o,simT);
  if(len(sub(o,camW))<3e3)drawMesh(rvYardBuild(),mat4(rotY(Y.e,th),rotY(Y.up,th),rotY(mul(Y.n,-1),th),sub(o,camW)),o);
  for(const R of mode==='drive'?(RV?[RV]:[]):FROV){if(R.wet)continue;const G=R.G,P=rvPoseW(R),qW=P.q,pW=P.p;if(len(sub(pW,camW))>5e3)continue;const wm=rvWheelMesh(R.d.wh);
    drawMesh(rvBodyMesh(R.d),modelQ(qW,sub(pW,camW),mul(G.cm,-1)),pW);
    G.wheels.forEach((w,i)=>{const s=R.wh[i],l=R.dep?G.Wk.tr*(1-RV_SAG):s.l,c=add(pW,qrot(qW,sub([w.x,G.yM-l,w.z],G.cm))),q=qmul(qmul(qW,qaxis([0,1,0],w.steer*R.steer)),qaxis([1,0,0],s.spin));
      drawMesh(wm,modelQ(q,sub(c,camW)),c)})}}
function rvLabels(octx,project){const k=Math.min(devicePixelRatio||1,1.5),Y=rvYardShown();octx.font=`${12*k}px ui-monospace,Consolas,monospace`;octx.textAlign='center';octx.fillStyle='rgba(255,220,160,.9)';
  for(const f of RV_YARD){const p=add(bodyPos(TELLUS,simT),fromPF(TELLUS,yardPF(Y,f.x+(f.k==='bank'?2:0),f.k==='bank'?20:9,1.2),simT)),q=project(p);if(q&&len(sub(p,HOOK.view.camW))<400)octx.fillText(f.k==='ramp'?`${f.a}° ramp`:`${f.a}° side slope`,q[0],q[1])}}

// ---- rovers in a flight (R2): deploy from the HUD's Rover row, ] drives one (and the next), [ goes back to the lander.
// Rovers left in the field come back into any flight within LOAD_R of them; an uncrewed one can be driven from home
// (the Program screen's "Rovers in the field", which opens the drive screen wherever it is: Lunokhod was driven from Earth).
let rvLoadT=0,rvFHudAt=0,rvRemote=null;
const rvKeys=()=>({thr:(keys.has('w')?1:0)-(keys.has('s')?1:0),steer:(keys.has('d')?1:0)-(keys.has('a')?1:0),brake:keys.has(' ')});
// a rover in the field, as home sees it now: who can hear it
function rvFieldContact(e){const b=BODIES.find(x=>x.name===e.bodyName)||TELLUS,s=ORB_T0;ORB_T0=PROG.day*DAY_S-simT;const c=rvContact({body:b,p:e.p,d:e.d,remote:true},simT,rvRelays([]));ORB_T0=s;return c}
const rvPack=()=>{const d=JSON.parse(JSON.stringify(rvDesigns()[rvSel]));delete d.test;return d};   // what the builder packs into a new rover part
const rvPoseW=R=>{const P=rvPose(R);return{p:add(bodyPos(R.body,simT),fromPF(R.body,P.p,simT)),q:qmul(qBody(R.body,simT),P.q)}};
function rvChase(R,dtR){if(drag)rvCamHold=2;else rvCamHold=Math.max(0,rvCamHold-dtR);if(rvCamHold||len(R.v)<.3)return;
  const f=localFrame(fromPF(R.body,R.p,simT)),fw=qrot(qmul(qBody(R.body,simT),R.q),[0,0,1]),want=Math.atan2(-dot(fw,f.e),dot(fw,f.n));
  let dy=want-cam.yaw;dy-=2*Math.PI*Math.round(dy/(2*Math.PI));cam.yaw+=dy*Math.min(1,dtR*1.5)}
function rvFlightTick(dt,dtR){if(!S)return;const obs=rvObsOf([S,...FLEET]);for(const R of FROV)R.obs=obs;
  if(RVA&&(RVA.wet||!FROV.includes(RVA)))RVA=null;
  if(RVA){RVA.contact=rvContact(RVA,simT,rvRelays([S,...FLEET]));rvCommand(RVA,rvKeys(),RVA.contact);rvSciSend(RVA,RVA.contact);if(view!=='map')rvChase(RVA,dtR)}
  rvFlight(dt);
  if((rvLoadT-=dtR)<=0){rvLoadT=1;const n=rvLoadNear(S);if(n)HOOK.msg(`${n>1?n+' rovers':'A rover'} of yours nearby: ] to drive`)}
  const el=$('rvFHud');if(el){el.classList.toggle('hidden',!RVA);if(RVA&&performance.now()-rvFHudAt>100){rvFHudAt=performance.now();rvHud(el,RVA)}}}
// ] from the lander drives the first rover, then the next; [ goes back to the lander
function rvCycle(dir){const L=FROV.filter(R=>!R.wet);if(!L.length||(!RVA&&dir<0))return false;
  if(RVA){RVA.in={thr:0,steer:0,brake:false};RVA.cq=[]}const j=RVA?L.indexOf(RVA)+dir:0;RVA=j<0||j>=L.length?null:L[j];if(RVA){RVA.sleep=false;cam.dist=Math.min(cam.dist,14)}
  HOOK.msg(RVA?`Driving the ${RVA.name}: W S A D, Space brakes · [ back`:'Back to the lander');return true}
const rvFlightKey=k=>[' ','z','x','t','backspace','shift','control'].includes(k);   // keys the lander mustn't get while you drive
function rvRows(){if(!S)return[];const out=[];
  for(const p of S.parts){if(!rvPacked(p))continue;const d=p.dn.rvd,c=S.landed&&S.alive?rvDeployCheck(S,p):null;
    out.push(['Rover',`${rvEsc(d.name)} <span class="dim">(${p.d.key==='rvfold'?'folded on the side':'on the deck'})</span> `+(c&&c.ok?`<button data-rvdep="${p.i}">deploy</button>`:`<span class="${c?'warn':'dim'}">${c?c.why:'deploys once landed'}</span>`)])}
  const L=FROV.filter(R=>!R.wet);
  if(L.length)out.push(['Rovers',L.map(R=>`${R===RVA?'<b class="acc">':''}${rvEsc(R.name)}${R===RVA?'</b>':''} ${R.dep?'deploying':fmtD(len(sub(rvPoseW(R).p,shipWorld())))}${R.tipped?' <span class="bad">over</span>':''}`).join(' · ')+` <span class="dim">· ${RVA?'[ back to the lander · ] next':'] drive'}</span>`]);
  return out}
document.addEventListener('click',e=>{const i=e.target.dataset&&e.target.dataset.rvdep;if(i==null||mode!=='flight'||!S)return;e.target.blur();tapeRover(recTape,S,+i)});
// the Program screen's list, and driving one from home
function rvFieldHTML(){const L=PROG.rvOut||[];if(!L.length)return'';
  return'<div class="ep">Rovers in the field</div>'+L.map(e=>{const G=rvGeom(e.d);
    return`<div class="ms"><b>${rvEsc(e.name)}</b> on ${e.bodyName}${e.tipped?' <span class="bad">on its side</span>':''} · battery ${G.kWh?(100*e.E/(G.kWh*3.6e6)).toFixed(0)+' %':'none'} · ${e.km.toFixed(2)} km driven `+
      (e.dead?'<span class="bad">· froze in the night</span>':G.crew?'<span class="dim">· its crew drives it: fly a crewed lander there</span>':(c=>c.ok?`<button data-rvdrive="${e.id}">Drive from home</button> <span class="dim">${(c.delay*1000).toFixed(0)} ms${c.via!=='home'?' via '+rvEsc(c.via):''}</span>`:'<span class="warn">· out of contact</span>')(rvFieldContact(e)))+`</div>`}).join('')}
document.addEventListener('click',e=>{const id=e.target.dataset&&e.target.dataset.rvdrive;if(id==null)return;const q=(PROG.rvOut||[]).find(x=>String(x.id)===id);if(!q)return;rvRemote=q;go('rover')});

