// app/state.js — app state. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ app state
let player=null,recTape=null,impact=null,impT=0,mode='editor',view='flight',warpIdx=0,physAcc=0,predCache=null,planCache=null,warpTo=null,ndStep=10,mapUI={pick:[],handles:[],node:null};
const WARPS=[1,2,4,10,50,100,1000,10000,100000];
let stackDef=JSON.parse(JSON.stringify(PRESETS.Orbiter)),shipMesh=null;
// smoke puffs, anchored to the planet (they hang in the air the rocket flew through). Visual only: not part of the sim or tapes.
const smoke=[];let smokeAcc=0;const WIND=[3.5,0,-2];   // planet-fixed m/s: a light breeze that shears the column as it ages
// the ground cloud: while a plume reaches the ground, puffs at a steady rate (∝ how much jet arrives). On the pad they
// pour out of the flame channel's mouth (and a few spill over the deck); elsewhere they ring the impact point.
let gSmokeAcc=0;
function emitGroundSmoke(dt){const t=curSite(),F=siteFrame(t.u),pp=padPF(),spf=toPF(TELLUS,S.r,simT),onPad=len(sub(spf,pp))<300,pa=pressure(TELLUS,len(S.r)-TELLUS.R);
  for(const e of activeEngines(S)){const sp=SPOOL.get(e),thr=sp?sp.k:S.throttle,L=plumeShape(e.d,thr,pa)[2],
      nz=toPF(TELLUS,add(S.r,qrot(S.q,[e.pos[0]-S.cm[0],e.y0-S.cm[1],e.pos[2]-S.cm[2]])),simT),hn=len(nz)-groundR(TELLUS,nz),w=thr*sstep(L*1.15,L*.35,hn);
    if(w<.02)continue;gSmokeAcc+=dt*30*w*Math.max(.6,e.d.exit/.55);
    while(gSmokeAcc>1){gSmokeAcc-=1;if(smoke.length>2500)smoke.shift();const R=Math.random;let pf,s0=2.5+2*R();
      if(onPad&&R()<.8)pf=add(pp,add(add(mul(F.e,(R()-.5)*7),mul(F.up,1+R()*3)),mul(F.s,26+R()*14)));
      else{const up=norm(nz),X=norm(cross(up,Math.abs(up[1])<.9?[0,1,0]:[1,0,0])),Z=cross(X,up),a=R()*6.283,rr=e.d.exit*(5+6*R())+(onPad?3:0);
        pf=add(mul(up,len(nz)-hn+1+R()*1.5),add(mul(X,Math.cos(a)*rr),mul(Z,Math.sin(a)*rr)));s0*=.7}
      smoke.push({pf,t0:simT,s0,grow:6+4*R(),a0:.5,life:40+30*R(),rise:1+1.5*R(),seed:R()*97})}}}
function emitSmoke(dt){if(mode==='flight'&&S.alive&&S.lesT>0)emitLesSmoke(dt);if(mode!=='flight'||!S.alive||S.thrust<=0||S.body!==TELLUS)return;const h=len(S.r)-TELLUS.R,rho=density(TELLUS,h);if(rho<0.02)return;
  emitGroundSmoke(dt);
  // spaced by distance, not time: puffs born bigger the faster we go and laid ~70 % of a width apart, so the column stays solid
  const sp=len(sub(S.v,surfVel(TELLUS,S.r))),s0=2.5+sp*.035,gap=Math.max(.008,.35*s0/Math.max(sp,1));smokeAcc+=dt;
  while(smokeAcc>gap){smokeAcc-=gap;for(const e of activeEngines(S)){if(smoke.length>2500)smoke.shift();
    const off=qrot(S.q,[e.pos[0]-S.cm[0],e.y0-S.cm[1]-plumeShape(e.d,S.throttle,rho/TELLUS.rho0)[2]*.7,e.pos[2]-S.cm[2]]),   // born where the plume fades
      jit=[Math.random()-.5,Math.random()-.5,Math.random()-.5];
    const pw=add(add(S.r,off),mul(jit,s0*.45)),pf=toPF(TELLUS,pw,simT);if(len(pf)-groundR(TELLUS,pf)<s0*.4)continue;   // underground: the ground cloud covers it
    smoke.push({pf,t0:simT,s0:s0*(.8+.4*Math.random())*Math.max(.5,e.d.exit/.55)*.5,grow:4+Math.random()*3,a0:.45*clamp(rho*1.1,.12,1),life:70+Math.random()*50,rise:Math.random()*0.6,seed:Math.random()*97})}}}
// Built allocation-free into reused typed arrays: the naive version (vector temporaries per puff and per corner) cost ~3 ms
// of CPU a frame with ~1000 puffs.
let smokeV=new Float32Array(0),smokeK=new Float64Array(0),smokeI=new Uint32Array(0),smokeP=new Float64Array(0);
const QC=[-1,-1,1,-1,1,1,-1,-1,1,1,-1,1];
function drawSmoke(VP,camW,R,U){
  let w=0;for(let i=0;i<smoke.length;i++){const q=smoke[i],age=simT-q.t0;if(age<=q.life&&age>=0)smoke[w++]=q}smoke.length=w;
  const n=w;if(!n)return;const th=bodyTheta(TELLUS,simT),c=Math.cos(th),sn=Math.sin(th);
  if(smokeK.length<n){smokeK=new Float64Array(n*2);smokeI=new Uint32Array(n*2);smokeP=new Float64Array(n*12);smokeV=new Float32Array(n*96)}
  for(let i=0;i<n;i++){const q=smoke[i],age=simT-q.t0;
    let rx,ry,rz;const o=i*6;
    if(q.iv){rx=q.r0[0]+q.v[0]*age-camW[0];ry=q.r0[1]+q.v[1]*age-camW[1];rz=q.r0[2]+q.v[2]*age-camW[2]}   // fxPuff: inertial, ballistic
    else{if(q.ux===undefined){const L=len(q.pf);q.ux=q.pf[0]/L;q.uy=q.pf[1]/L;q.uz=q.pf[2]/L;q.wf=L-TELLUS.R<8000?1:.4}
      const ra=q.rise*age,wa=age*q.wf,x=q.pf[0]+q.ux*ra+WIND[0]*wa,y=q.pf[1]+q.uy*ra+WIND[1]*wa,z=q.pf[2]+q.uz*ra+WIND[2]*wa;
      rx=c*x+sn*z-camW[0];ry=y-camW[1];rz=-sn*x+c*z-camW[2]}
    smokeP[o]=rx;smokeP[o+1]=ry;smokeP[o+2]=rz;smokeP[o+3]=q.s0+q.grow*Math.sqrt(age);smokeP[o+4]=q.a0*(1-age/q.life);smokeP[o+5]=q.hot?q.hot*Math.max(0,1-age/q.life):Math.max(0,1-age/.35);
    smokeK[i]=rx*rx+ry*ry+rz*rz;smokeI[i]=i}
  const idx=smokeI.subarray(0,n).sort((a,b)=>smokeK[b]-smokeK[a]),v=smokeV;let k=0;
  for(let m=0;m<n;m++){const i=idx[m],o=i*6,sz=smokeP[o+3],seed=smoke[i].seed;
    for(let j=0;j<12;j+=2){const cx=QC[j],cy=QC[j+1],a=cx*sz,b=cy*sz;
      v[k]=smokeP[o]+R[0]*a+U[0]*b;v[k+1]=smokeP[o+1]+R[1]*a+U[1]*b;v[k+2]=smokeP[o+2]+R[2]*a+U[2]*b;
      v[k+3]=cx;v[k+4]=cy;v[k+5]=smokeP[o+4];v[k+6]=smokeP[o+5];v[k+7]=seed;k+=8}}
  const E=lightEnv(camW),su=PSMOKE.u;gl.useProgram(PSMOKE.p);gl.uniformMatrix4fv(su.uVP,false,VP);gl.uniform1f(su.uFc,FC);gl.uniform3fv(su.uLight,E.sun.map(x=>x*.45));gl.uniform3fv(su.uAmb,E.sky.map((x,i)=>x+E.gnd[i]));
  const Fz=cross(R,U);gl.uniform3f(su.uSq,dot(SUN,R),dot(SUN,U),dot(SUN,Fz));gl.uniform4fv(su.uPl,PLT.p);gl.uniform3fv(su.uPlC,PLT.c);
  gl.bindVertexArray(smokeVAO);gl.bindBuffer(gl.ARRAY_BUFFER,smokeBuf);gl.bufferData(gl.ARRAY_BUFFER,v.subarray(0,k),gl.DYNAMIC_DRAW);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,n*6);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(PMESH.p)}
const rcsSeen={};   // RCS nozzle index → when it last fired (render-side, for the puffs)
const booms=[],cam={yaw:0.35,pitch:0.12,dist:28,mYaw:0.7,mPitch:0.45,mDist:TELLUS.R*5,focus:0};
const keys=new Set();
let msgTimer=0;
const headlines=[];HOOK.news=(t,cls='')=>{headlines.unshift({t,cls,at:simT});headlines.length=Math.min(headlines.length,3);
  const n=$('news');n.classList.remove('hidden');n.innerHTML=headlines.map((h,i)=>`<div class="${i?'old':h.cls}">${h.t}</div>`).join('');hudLayout()};
// Results off the ticker (Q99): what a flight's settlement announces (refurbishment, telemetry, records, missions completed
// at the end) is on the Debrief, so it skips the #news ticker. Every headline is still kept (NEWS, the last 40, with the
// day) and the Program's Inbox lists them under "News", marking the ones since your last visit. (Here, not in debrief.js:
// the Program's layout runs at start-up, before the later files load.)
let settling=false;const NEWS=[];let newsSeen=0;
let landPick=null;   // a landing site picked on the map ({body, pf}; Q62): ▶ Procedure lands there
{const raw=missionEnd;missionEnd=function(s){settling=true;try{return raw(s)}finally{settling=false}}}
{const raw=HOOK.news;HOOK.news=(t,cls='')=>{NEWS.unshift({t,cls,day:PROG.day||0});newsSeen++;if(NEWS.length>40)NEWS.length=40;if(!settling)raw(t,cls)}}
function newsHTML(){if(!NEWS.length)return'';const fresh=Math.min(newsSeen,NEWS.length);
  return `<div class="ep">News</div>`+NEWS.slice(0,Math.max(6,fresh)).slice(0,12).map((n,i)=>`<div class="nw${i<fresh?' new':''}"><span class="dim">day ${Math.floor(n.day)+1}</span> <span class="${n.cls}">${n.t}</span></div>`).join('')}
// Two placements the flight HUD keeps (fixes session, PLAYTEST #15, #16), run on every screen change, each HUD update and
// each headline. The TESTER badge is the last item of the flight toolbar; elsewhere it sits at the top centre, which no
// other screen uses (Program, Assembly, Rover yard).
// The news keeps its own lane: centred if it fits, but never over the flight readout (however wide its rows make it),
// the toolbar, or a panel on the right (maneuver node, rover); with no room beside the readout, it goes under it.
function hudLayout(){const b=$('testerBadge'),tr=document.querySelector('#hud .tr'),fl=mode==='flight';if(typeof debEndBtn==='function')debEndBtn();msgLayout();bldLayout();   // (flow: End flight once it's over; #msg and the key strip get lanes)
  if(b&&tr){const home=fl?tr:document.body;if(b.parentNode!==home)home.appendChild(b)}
  const n=$('news');if(!n||n.classList.contains('hidden'))return;const st=n.style;
  if(!fl){st.left=st.top=st.maxWidth=st.transform='';return}
  const box=sel=>{const e=document.querySelector(sel);if(!e||!e.offsetParent)return null;const r=e.getBoundingClientRect();return r.width&&r.height?r:null},
    info=box('#hud .tl'),bar=box('#hud .tr'),W=innerWidth;
  let L=info?info.right+10:12,R=W-12;for(const sel of['#nodep','#rvFHud']){const r=box(sel);if(r&&r.left>L)R=Math.min(R,r.left-10)}
  let top=46;if(R-L<240&&info){L=12;top=info.bottom+8}   // no room beside the readout: under it
  st.transform='none';st.left='0px';st.maxWidth=Math.max(120,Math.min(560,R-L))+'px';const w=n.offsetWidth,x=Math.min(Math.max(W/2-w/2,L),Math.max(L,R-w));
  if(bar&&bar.left<x+w&&bar.right>x)top=Math.max(top,bar.bottom+6);
  st.left=Math.round(x)+'px';st.top=Math.round(top)+'px'}
// Lanes for two more boxes (flow session; PLAYTEST #25, #26), each kept clear of the panels beside it:
// #msg ("Mission complete: …") in flight: centred between the readout and the right-hand panels, under the toolbar and the
// news where they overlap, or under the readout when there's no room beside it. Elsewhere its CSS place.
const shown=sel=>{const e=document.querySelector(sel);if(!e||e.closest('.hidden'))return null;const r=e.getBoundingClientRect();return r.width&&r.height?r:null};
function msgLayout(){const m=$('msg');if(!m)return;const st=m.style;
  if(mode!=='flight'){st.left=st.top=st.maxWidth=st.transform='';return}
  const info=shown('#hud .tl'),W=innerWidth;let L=info?info.right+10:12,R=W-12,top=Math.round(innerHeight*.18);
  for(const sel of['#nodep','#rvFHud']){const r=shown(sel);if(r&&r.left>L)R=Math.min(R,r.left-10)}
  if(R-L<200&&info){L=12;R=W-12;top=Math.max(top,info.bottom+8)}
  st.transform='none';st.left='0px';st.maxWidth=Math.round(R-L)+'px';const w=m.offsetWidth,h=m.offsetHeight,x=Math.min(Math.max(W/2-w/2,L),Math.max(L,R-w));
  for(const r of[shown('#hud .tr'),shown('#news')])if(r&&r.left<x+w&&r.right>x&&r.bottom+6>top&&r.top<top+h)top=Math.round(r.bottom+6);
  st.left=Math.round(x)+'px';st.top=top+'px'}
// the builder's key strip (builder.js #bldhelp) between the two assembly panels, wrapping, instead of under both
function bldLayout(){const h=$('bldhelp'),a=shown('#editor .left'),b=shown('#editor .right');if(!h||!a||!b)return;const st=h.style,L=a.right+10,R=b.left-10;
  st.transform='none';st.whiteSpace='normal';st.textAlign='center';st.left=Math.round(L)+'px';st.width=Math.max(0,Math.round(R-L))+'px';st.boxSizing='border-box';st.visibility=R-L<160?'hidden':''}
addEventListener('resize',()=>{msgLayout();bldLayout()});
let evt=false;   // set by any in-flight event message; used to drop out of warp
HOOK.msg=t=>{const m=document.getElementById('msg');m.textContent=t;m.style.opacity=1;msgTimer=3;evt=true;msgLayout()};
HOOK.boom=(b,r,t,sz)=>{const h=len(r)-b.R,air=b.atm&&h<b.atm?clamp(density(b,h)/b.rho0*3,0,1):0;
  booms.push({b,pf:toPF(b,r,t),t0:performance.now(),sz,air,seed:Math.random()*40});
  if(b!==TELLUS)return;const v0=S&&S.body===b&&len(sub(S.r,r))<200?S.v:surfVel(b,r),R=Math.random,k=Math.sqrt(sz);   // sparks and burning fragments
  for(let i=0;i<30+20*k;i++){const u=norm([R()-.5,R()-.5,R()-.5]),sp=(15+45*R())*k;fxPuff(r,add(v0,mul(u,sp)),{s0:.08+.08*R()*k,grow:0,a0:.9,life:.3+.9*R(),hot:1.8})}};
HOOK.rebuild=()=>{shipMesh&&shipMesh.free();shipMesh=partsMesh(S.parts.filter(p=>p.on));renderStages();renderSAS()};
HOOK.debris=d=>{d.mesh=partsMesh(d.parts);debris.push(d);sepFx(d);d.impact=d.body.atm||d.body.parent?debrisImpact(d):null;
  if(d.impact){d.verdict=dropVerdict(d.impact.b,d.impact.pf);if(S)missionDrop(S,{...d.verdict,pf:d.impact.pf,parts:d.parts});d.name=d.parts.find(p=>p.d.kind==='engine')?.d.name.split(' ')[0]||d.parts[0].d.name;pendingDrops.push(d)}};
// staging: at the separating joint, a ring of pyro/vent gas and a spray of sparks, carried with the ship (render-side).
// The joint: a stack decoupler's top face, a radial decoupler's mount; breakups (no decoupler) get nothing here (booms).
function sepFx(d){if(!S||d.body!==TELLUS)return;const dec=d.parts.find(p=>p.d.kind==='dec'||p.d.kind==='rdec');if(!dec)return;
  const rad=dec.d.kind==='rdec',J=rad?[dec.pos[0],dec.y0+dec.h/2,dec.pos[2]]:[dec.pos[0],dec.y0+dec.h,dec.pos[2]],
    at=add(d.r,qrot(d.q,sub(J,d.cm))),Y=qrot(d.q,[0,1,0]),X=qrot(d.q,[1,0,0]),Z=qrot(d.q,[0,0,1]),r=rad?.4:(dec.d.r||R0),
    pa=pressure(TELLUS,len(d.r)-TELLUS.R),R=Math.random;
  for(let i=0;i<18;i++){const a=i/18*6.283+R()*.3,u=add(mul(X,Math.cos(a)),mul(Z,Math.sin(a))),sp=4+6*R()+8*(1-pa);   // gas vents radially from the seam
    fxPuff(add(at,mul(u,r)),add(S.v,add(mul(u,sp),mul(Y,(R()-.5)*2))),{s0:.3+.3*R(),grow:1.5+2*R()+3*(1-pa),a0:.45*(.25+.75*pa),life:1.5+2.5*R()*(.3+pa),hot:.25})}
  for(let i=0;i<26;i++){const u=norm([R()-.5,R()-.5,R()-.5]),sp=8+18*R();   // sparks: small, hot, fast, short-lived
    fxPuff(add(at,mul(u,r*.8)),add(S.v,mul(u,sp)),{s0:.05+.05*R(),grow:0,a0:.9,life:.25+.45*R(),hot:1.6})}}
// the program persists in browser storage (best effort: a private window just starts fresh each time)
// tester mode (?tester in the URL) keeps its own program, so cheats never reach the career (TEST: the SIM tester block)
TEST.on=(()=>{try{return new URLSearchParams(location.search).has('tester')}catch(e){return false}})();
if(TEST.on)try{Object.assign(TEST,JSON.parse(localStorage.getItem('launchpad-tester-flags')||'{}'),{on:true})}catch(e){}
const PROG_KEY=TEST.on?'launchpad-program-tester':'launchpad-program-v1';
try{const j=JSON.parse(localStorage.getItem(PROG_KEY)||'null');if(j){Object.assign(PROG,j);for(const q of PROG.sats||[])delete q.docked}}catch(e){}   // a flight in progress doesn't survive a reload
if(PROG.home!=null&&PROG.home!==HOME)HOME=PROG.home;if(PROG.home!=null||PROG.homeArch)RIVALS=raceSchedule();ensureBoard();if(!isFinite(PROG.funds))PROG.funds=FUNDS0;if(!isFinite(PROG.day))PROG.day=0;PROG.rel=PROG.rel||{};PROG.op=PROG.op||{};
HOOK.save=()=>{try{localStorage.setItem(PROG_KEY,JSON.stringify(PROG))}catch(e){}};
// dropped stages leave the simulation long before they land; their predicted landing is settled when its time comes
const pendingDrops=[];
function settleDrops(){for(let i=pendingDrops.length-1;i>=0;i--){const d=pendingDrops[i];if(simT<d.impact.t)continue;pendingDrops.splice(i,1);
  const v=d.verdict,stg=`${d.name} stage`;
  if(v.kind==='city')HOOK.news(`💥 ${stg} comes down IN ${v.city.name} — residents not amused`,'bad');
  else if(v.kind==='near')HOOK.news(`${stg} lands ${(v.dist/1000-v.city.rad/1000).toFixed(0)} km outside ${v.city.name}; mayor "would like a word"`,'warn');
  else if(v.kind==='sea')HOOK.news(`${stg} splashes down safely at sea`,'ok');
  else if(v.kind==='land')HOOK.news(`${stg} lands in open country, ${(v.dist/1000).toFixed(0)} km from ${v.city.name}`,'ok')}}
function resetShip(){if(S)missionEnd(S);FLEET.length=0;heard.clear();impSpread=null;warpTo=null;player=null;impact=null;pendingDrops.length=0;smoke.length=0;simT=0;debris.forEach(d=>d.mesh.free());debris.length=0;booms.length=0;S=newShip(stackDef);recTape=tapeNew(stackDef,S.site);HOOK.rebuild();warpIdx=0;physAcc=0}

