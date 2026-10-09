// sim/flight.js — SOI changes, ground contact, abort, trajectory legs, maneuver nodes, impact prediction. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// Patched conics: leave the current body's SOI for its parent, or enter one of its moons'.
function soiSwitch(s,to,how){s.body=to;s.hold=null;HOOK.msg(`${how} SOI`);if(s.node){s.node=null;HOOK.msg(`${how} SOI — maneuver node cleared`)}}
function checkSOI(s){const b=s.body;
  if(b.parent&&len(s.r)>soiAt(b,simT)){const[p,v]=bodyRel(b,simT);s.r=add(s.r,p);s.v=add(s.v,v);soiSwitch(s,b.parent,`Escaping ${b.name}`);return}
  for(const c of b.children){const[p,v]=bodyRel(c,simT),d=sub(s.r,p);if(len(d)<soiAt(c,simT)){s.r=d;s.v=sub(s.v,v);soiSwitch(s,c,`Entering ${c.name}`);return}}}
// ---- ground contact (terrain session). The vessel meets the ground through contact points on its base: the foot of
// every part whose bottom is within 0.5 m of the lowest point (the core's base, side boosters' bases), 4 per part
// around its own axis. Each point pushes back with a spring-damper along the ground's normal (2 cm of static
// deflection at Earth gravity on every body, ζ 0.6) and drags with Coulomb friction (μ from the surface). Tipping,
// sliding and bouncing follow from those forces, which also load the joints like any other force. The speed verdict
// (surfaces, boulders) happens at the first touch; a vessel at rest for C_REST s is landed, pinned in the attitude it
// came to rest in; tilting past C_TOPPLE while touching is toppling. The sea keeps the old splashdown.
const C_DEFL=0.02,C_ZETA=0.6,C_REST=0.5,C_TOPPLE=1.05,C_GREF=9.81;
function footPoints(s){const key=s.parts.map(p=>p.on?1:0).join('');if(s.foot&&s.foot.key===key)return s.foot.pts;
  let yb=Infinity;for(const p of s.parts)if(p.on)yb=Math.min(yb,p.y0);const pts=[];
  for(const p of s.parts){if(!p.on||p.y0>yb+0.5)continue;const r=Math.max(p.d.r*0.95,0.05);
    for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;pts.push({p,pt:[p.pos[0]+r*Math.cos(a),p.y0,p.pos[2]+r*Math.sin(a)]})}}
  s.foot={key,pts:pts.slice(0,32)};return s.foot.pts}
// the ground's upward normal at a planet-fixed point, in the inertial frame (finite differences over ±1 m)
function groundNormal(b,pf){if(b!==TELLUS)return norm(fromPF(b,pf,simT));const u=norm(pf),f=siteFrame(u),d=1/TELLUS.R,h0=groundAlt(b,u);
  const he=groundAlt(b,norm(add(u,mul(f.e,d)))),hn=groundAlt(b,norm(add(u,mul(f.n,d))));
  return norm(fromPF(b,norm(sub(u,add(mul(f.e,(he-h0)/TELLUS.R/d),mul(f.n,(hn-h0)/TELLUS.R/d)))),simT))}
// the touchdown verdict at first contact, judged under the vessel's centre (the base spans more than one boulder cell):
// the ground forgives TOUCH_MAX + its softness; boulders or trees add to the speed
function touchdown(s){const b=s.body,pfC=toPF(b,s.r,simT),sp=len(sub(s.v,surfVel(b,s.r))),su=surfaceAt(b,pfC),hit=surfaceHit(su,pfC,b),vE=sp+hit,lim=TOUCH_MAX+su.soft;
  s.landSurface={name:su.name,id:su.id??null,hit};s.touchV=sp;s.touchHit=hit;s.restT=0;
  const among=hit?`, among ${su.id===8||su.id===5||su.id===3?'trees':'boulders'}`:'';
  if(vE>=lim){s.alive=false;s.crashSpeed=sp;HOOK.boom(b,s.r,simT,3);HOOK.msg(`Destroyed — hit ${b.name} (${su.name}) at ${sp.toFixed(0)} m/s${among}`);return false}
  return true}
function groundContact(s,dt){const b=s.body;
  if(s.landed||!s.alive||len(s.r)-b.R>TERR_TOP+s.len+50||aglAt(b,s.r,simT)>s.len+20){s.inContact=false;return}
  const pts=footPoints(s),n=pts.length,mPer=s.mass/n,k=mPer*C_GREF/C_DEFL,c=2*C_ZETA*Math.sqrt(k*mPer),ct=0.5*mPer/dt,qi=qconj(s.q);let any=false;
  for(const fp of pts){const rb=sub(fp.pt,s.cm),rw=qrot(s.q,rb),P=add(s.r,rw),pf=toPF(b,P,simT),gA=groundAlt(b,pf),pen=b.R+gA-len(P);
    if(pen<=0)continue;if(b===TELLUS&&terrainH(norm(pf))<0)continue;   // over the sea: splashdown (groundCheck)
    if(!s.inContact){if(!touchdown(s))return;s.inContact=true}
    any=true;const su=surfaceAt(b,pf),nW=groundNormal(b,pf),vP=add(sub(s.v,surfVel(b,P)),cross(s.w,rw)),vn=dot(vP,nW);
    const Fn=Math.max(0,k*pen-c*vn),vt=sub(vP,mul(nW,vn)),vtl=len(vt);let Fw=mul(nW,Fn);
    if(vtl>1e-6)Fw=madd(Fw,vt,-Math.min(su.mu*Fn,ct*vtl)/vtl);
    const fb=qrot(qi,Fw);addF(fp.p,fb[0],fb[1],fb[2],fp.pt[0],fp.pt[1],fp.pt[2])}
  if(any)s.touchT=simT}
// after each step: the nose in the ground, toppling, coming to rest; and splashdowns, which keep the old rule
function groundCheck(s){
  const b=s.body,Y=qrot(s.q,[0,1,0]);if(s.landed||!s.alive||len(s.r)-b.R>TERR_TOP+s.len)return;   // well above the highest ground: nothing to hit
  const pT=madd(s.r,Y,s.yTop),hT=len(pT)-groundR(b,toPF(b,pT,simT)),up=norm(s.r),tilt=Math.acos(clamp(dot(Y,up),-1,1)),pf0=toPF(b,s.r,simT);
  if(hT<0){const sp=len(sub(s.v,surfVel(b,s.r)));s.alive=false;s.crashSpeed=sp;HOOK.boom(b,s.r,simT,3);HOOK.msg(`Destroyed — the nose hit ${b.name} at ${sp.toFixed(0)} m/s`);return}
  // the sea: a splashdown floats upright, as before
  if(b===TELLUS&&terrainH(norm(pf0))<0){const pB=madd(s.r,Y,s.yBot);if(len(pB)>b.R)return;
    if(!touchdown(s))return;
    if(tilt<0.6){const X=norm(sub(qrot(s.q,[1,0,0]),mul(up,dot(qrot(s.q,[1,0,0]),up)))),q=qFromBasis(X,up,cross(X,up));
      s.landed=true;s.water=true;s.r=mul(up,b.R-s.yBot);s.pf=toPF(b,s.r,simT);s.qLocal=qmul(qconj(qBody(b,simT)),q);syncLanded(s);s.landedAt=simT;
      HOOK.msg(`Landed on ${b.name} (sea) at ${s.touchV.toFixed(1)} m/s`)}
    else{s.alive=false;s.crashSpeed=s.touchV;HOOK.boom(b,s.r,simT,3);HOOK.msg(`Destroyed — hit the sea at ${s.touchV.toFixed(0)} m/s, sideways`)}
    return}
  if(!s.inContact)return;
  if(tilt>C_TOPPLE){const su=s.landSurface||{name:'the ground'},sl=terrainSlope(b,pf0);s.alive=false;s.crashSpeed=len(sub(s.v,surfVel(b,s.r)));HOOK.boom(b,s.r,simT,2);
    HOOK.msg(`Toppled over on ${sl>0.03?`a ${(sl*57.3).toFixed(0)}° slope of `:''}${su.name}`);return}
  const vr=len(sub(s.v,surfVel(b,s.r))),wr=len(sub(s.w,[0,bodyOmega(b),0]));
  if(vr<0.15&&wr<0.03&&!(s.thrust>0)){s.restT=(s.restT||0)+DT}else s.restT=0;   // not while the engines push (a slow liftoff is not a landing)
  if(s.restT>=C_REST){s.landed=true;s.inContact=false;s.water=false;s.pf=toPF(b,s.r,simT);s.qLocal=qmul(qconj(qBody(b,simT)),s.q);syncLanded(s);s.landedAt=simT;
    const ls=s.landSurface||{name:'?',hit:0};HOOK.msg(`Landed on ${b.name} (${ls.name}) at ${s.touchV.toFixed(1)} m/s${ls.hit?`, among ${ls.id===8||ls.id===5||ls.id===3?'trees':'boulders'} (like ${(s.touchV+ls.hit).toFixed(1)} m/s)`:''}${tilt>0.05?`, leaning ${(tilt*57.3).toFixed(0)}°`:''}`)}}
// ---- abort (bodies session): the escape tower pulls the crew capsule off a failing rocket. Everything below the capsule
// is dropped, the tower burns for its 3 s, then it's jettisoned and the chute armed. On a nominal flight the tower goes at
// the first staging above 30 km.
const LES_JET_ALT=3e4,CREW_AIR=10*86400;
function abort(s){if(!s.alive)return false;const les=s.parts.find(p=>p.on&&p.d.kind==='les'),cap=s.parts.find(p=>p.on&&p.d.crew);
  if(!les||!cap){HOOK.msg(les?'Abort: no crew capsule aboard':'Abort: no escape tower');return false}
  const drop=s.parts.filter(p=>p.on&&p.y0<cap.y0-1e-6),b=s.body;s.throttle=0;
  if(s.rec&&!s.rec.abort)s.rec.abort={t:simT,q:s.qdyn||0,alt:len(s.r)-b.R-groundAlt(b,toPF(b,s.r,simT))};
  if(drop.length)detach(s,drop,[0,-2,0],0.3);s.lesT=les.d.burn;s.kickN=(s.kickN||0)+1;HOOK.msg('ABORT: escape tower firing');HOOK.rebuild();return true}
function lesJettison(s,chute){const les=s.parts.find(p=>p.on&&p.d.kind==='les');if(!les)return;detach(s,[les],[0,4,0],0.5);s.lesT=0;
  if(chute&&s.chutePart){s.chute=true;s.chuteA=0}HOOK.msg(chute?'Tower jettisoned, chute armed':'Escape tower jettisoned')}
function stage(s){
  // a procedure being recorded notes staging done before the tank ran dry
  if(!s.alive)return;if(s.procRec&&!s.procRec.cut&&!s.landed&&dvRemaining(s).cur>0.5)s.procRec.early.push(len(s.r)-s.body.R);if(s.procRec&&s.procRec.m&&s.landed)s.procRec.m.surfStage++;{const les=s.parts.find(p=>p.on&&p.d.kind==='les');if(les&&!(s.lesT>0)&&len(s.r)-s.body.R>LES_JET_ALT)lesJettison(s,false)}s.kickN=(s.kickN||0)+1;const ev=s.events[s.evIdx];if(!ev)return;s.evIdx++;
  for(const k of ev.decouple){const list=s.parts.filter(p=>p.on&&p.seg===k);if(!list.length)continue;
    const rd=list.find(p=>p.d.kind==='rdec');   // side boosters are pushed outward, stages backward
    detach(s,list,rd?[Math.cos(rd.phi)*2.5,-0.5,Math.sin(rd.phi)*2.5]:[0,-1.5,0],rd?0.6:0.3)}
  if(ev.decouple.length)HOOK.msg(ev.radial?'Booster separation':'Stage separation');
  for(const k of ev.ignite){if(!igniteOK(s,k)){if(!ev.decouple.length){s.evIdx--;break}continue}s.segs[k].ignited=true}   // know-how: an unfamiliar engine can fail to light (a pure ignition can be retried)
  if(ev.ignite.length&&!ev.decouple.length)HOOK.msg('Ignition');
  spinFire(s,ev);
  if(ev.chute){s.chute=true;s.chuteA=0;HOOK.msg(s.body.atm?'Chute armed — drogue below 20 km and 400 m/s, main below 3 km':'Chute deployed (no air here)')}
  HOOK.rebuild()}
// spin-up motors fire with the event that lights their stage, or that releases it when it has no engines: whichever leaves
// it the bottom stage. SAS then leaves the roll alone (s.spun, ctrlAccel).
function spinFire(s,ev){if(ev.radial)return;const on=s.parts.filter(p=>p.on);if(!on.length)return;
  const lo=on.reduce((a,p)=>p.y0<a.y0?p:a).seg,M=on.filter(p=>p.d.kind==='spin'&&!p.spinT&&!p.spent&&p.seg===lo&&(ev.decouple.length||ev.ignite.includes(p.seg)));
  if(!M.length)return;let J=0;for(const p of M){p.spinT=p.d.burn;J+=p.d.spinJ}geom(s);s.spun=true;
  HOOK.msg(`Spin motors firing: ~${(J/s.I[1]*60/2/Math.PI).toFixed(0)} rpm`)}
function railsOK(s){
  if(!s.alive)return false;const thr=s.throttle>0&&activeEngines(s).length>0;
  if(s.landed)return!thr;
  return!thr&&len(s.r)-s.body.R>physAlt(s.body)&&!hitNear(s)&&!fleetNear(s)&&!rcsBusy(s)&&!armBusy(s)}   // near a satellite: physics, so contact is checked
// Advance on rails. Kepler is exact, so the only reasons to sub-step are SOI changes, the atmosphere edge, and (near Nyx)
// the perturbation, which is integrated in kick–drift–kick steps.
function rails(s,dt){
  coolOnRails(s,dt);
  if(s.landed){simT+=dt;syncLanded(s);return true}
  let rem=dt,guard=0;
  while(rem>1e-9&&guard++<4000){
    const b=s.body,el=elements(s.r,s.v,b.mu),{lim,sp,pa,hP}=coastPlan(b,s.r,s.v,simT,el,b.R+physAlt(b));
    const h=Math.min(rem,Math.max(dt/2000,0.25*lim/sp),hP);
    const[r,v]=coastStep(b,s.r,s.v,simT,h,pa);s.r=r;s.v=v;simT+=h;rem-=h;
    checkSOI(s);
    if(len(s.r)-s.body.R<physAlt(s.body))return rem<=1e-9}
  return true}
function stepDebris(dt){
  for(let i=debris.length-1;i>=0;i--){const d=debris[i],b=d.body;d.t+=dt;
    const rl=len(d.r),h=rl-b.R;let a=mul(d.r,-b.mu/(rl*rl*rl));if(b.pert||b.children.some(c=>c.pert)){const pa=pertAcc(b,d.r,simT,true);if(pa)a=add(a,pa)}   // the moons' tides, as on the craft
    const rho=density(b,h);if(rho>0){const va=sub(d.v,surfVel(b,d.r)),sp=len(va);if(sp>0.1){let ad=0.5*rho*sp*2.5/d.mass;if(ad*dt>0.9)ad=0.9/dt;a=madd(a,va,-ad)}}
    d.v=madd(d.v,a,dt);d.r=madd(d.r,d.v,dt);
    const q=d.q,dq=qmul([d.w[0],d.w[1],d.w[2],0],q);d.q=qnorm([q[0]+.5*dt*dq[0],q[1]+.5*dt*dq[1],q[2]+.5*dt*dq[2],q[3]+.5*dt*dq[3]]);
    if(h<TERR_TOP&&h<groundAlt(b,toPF(b,d.r,simT))){HOOK.boom(b,d.r,simT,1);d.dead=true}
    if(d.dead||d.t>240||(S&&S.body===b&&len(sub(d.r,S.r))>40000)){d.mesh&&d.mesh.free&&d.mesh.free();debris.splice(i,1)}}}
// Where does the current trajectory go? Up to three patched-conic legs, e.g. orbit → Selene encounter → escape back to Tellus.
// Each leg ends at the earliest of: entering one of the body's moons' SOIs (found by scanning, then bisection) or leaving
// the body's own SOI. `off` is the leg body's absolute position at the leg's start (null for the root).
function predict(s){return predictFrom({b:s.body,r:s.r,v:s.v,t:simT})}
const absOff=(b,t)=>b.parent?bodyPos(b,t):null;
// A perturbed leg can't be a conic: integrate it with the rails stepper, keeping a path (positions relative to the leg's body,
// with times) for the map. It ends at an SOI change, at the ground ('impact'), or at a horizon: two of the moon's orbits when
// inside its SOI (long enough to see an orbit wrecked or stripped), one revolution or the way out otherwise. Returns the next
// leg's start, or null.
function numLeg(st,el,pt){const b=st.b;let r=st.r,v=st.v,t=st.t;
  const H=b.pert?2*2*Math.PI/b.n:el.e<1?Math.min(el.period,40*86400):(timeToR(el,Math.max(...b.children.map(c=>c.rMax))*1.6)||40*86400);
  const tEnd=t+H,path=[[r,t]],every=H/1500;let tLast=t,minR=len(r),maxR=minR,guard=0;pt.path=path;
  while(t<tEnd-1e-6&&guard++<60000){
    const{lim,sp,pa,hP}=coastPlan(b,r,v,t,elements(r,v,b.mu),b.R),h=Math.min(tEnd-t,Math.max(0.5,0.25*lim/sp),hP);
    [r,v]=coastStep(b,r,v,t,h,pa);t+=h;const rl=len(r);minR=Math.min(minR,rl);maxR=Math.max(maxR,rl);
    if(t-tLast>=every){path.push([r,t]);tLast=t}
    if(rl<b.R){path.push([r,t]);pt.end=r;pt.endV=v;pt.endKind='impact';pt.endT=t;break}
    if(b.parent&&rl>soiAt(b,t)){path.push([r,t]);const[bp,bv]=bodyRel(b,t);pt.end=r;pt.endKind='esc';pt.endT=t;pt.minR=minR;pt.maxR=maxR;
      return{b:b.parent,r:add(r,bp),v:add(v,bv),t,off:absOff(b.parent,t)}}
    for(const c of b.children){const[cp,cv]=bodyRel(c,t);if(len(sub(r,cp))<soiAt(c,t)){path.push([r,t]);pt.end=r;pt.endKind='enc';pt.endT=t;pt.minR=minR;pt.maxR=maxR;
      return{b:c,r:sub(r,cp),v:sub(v,cv),t,off:absOff(c,t)}}}}
  if(!pt.endKind)path.push([r,t]);pt.minR=minR;pt.maxR=maxR;pt.tEnd=t;return null}
// When does this leg leave its body's SOI? A fixed SOI is a radius crossing (exact). A breathing one is scanned, then
// bisected: an outbound leg up to where it crosses the largest SOI; a bound orbit that reaches past the smallest SOI over
// three of the moon's orbits (it is stripped when the moon swings in and its SOI shrinks below the apoapsis).
function escTime(st,el){const b=st.b;if(!b.parent)return NaN;
  if(el.e<1&&el.ap<b.soiMin)return NaN;
  if(!b.orb.e)return timeToR(el,b.soi*0.99999);
  const out=dt=>len(kepler(st.r,st.v,dt,b.mu)[0])>=soiAt(b,st.t+dt);
  let span=el.e<1&&el.ap<b.soi?3*2*Math.PI/b.n:timeToR(el,b.soi*1.00001);if(!(span>0))span=el.e<1?el.period:NaN;if(!(span>0))return NaN;
  const h=Math.min(span/400,el.e<1?el.period/48:Infinity,2*Math.PI/b.n/96),N=Math.ceil(span/h);
  let tPrev=0,found=-1;for(let i=1;i<=N;i++){const dt=Math.min(span,i*h);if(out(dt)){found=dt;break}tPrev=dt}
  if(found<0)return NaN;let lo=tPrev,hi=found;for(let j=0;j<40;j++){const m=(lo+hi)/2;if(out(m))hi=m;else lo=m}return hi}
function predictFrom(st0){
  const out=[];let st={...st0,off:null};
  for(let k=0;k<3;k++){
    const el=elements(st.r,st.v,st.b.mu),pt={...st,el,end:null,endKind:null};out.push(pt);
    if(el.hl<1e-3||k===2&&!pertNear(st.b,el))break;
    if(pertNear(st.b,el)){const nx=numLeg(st,el,pt);if(!nx||k===2)break;st=nx;continue}
    const b=st.b,tEsc=escTime(st,el);
    let enc=null;
    for(const c of b.children){
      if(el.e<1&&el.ap<c.rMin-c.soi)continue;if(el.pe>c.rMax+c.soi)continue;
      let span=el.e<1?Math.min(el.period,40*86400):timeToR(el,c.rMax*1.6);if(tEsc>0)span=Math.min(span,tEsc);if(!(span>0))continue;
      const inC=dt=>len(sub(kepler(st.r,st.v,dt,b.mu)[0],bodyRel(c,st.t+dt)[0]))<soiAt(c,st.t+dt);
      const N=400;let tPrev=0,found=-1;
      for(let i=1;i<=N;i++){const dt=span*i/N;if(enc&&dt>=enc.dt)break;if(inC(dt)){found=dt;break}tPrev=dt}
      if(found<0)continue;
      let lo=tPrev,hi=found;for(let j=0;j<40;j++){const m=(lo+hi)/2;if(inC(m))hi=m;else lo=m}
      if(!enc||hi<enc.dt)enc={c,dt:hi}}
    if(enc){const te=st.t+enc.dt,[p,v]=kepler(st.r,st.v,enc.dt,b.mu),[cp,cv]=bodyRel(enc.c,te);pt.end=p;pt.endKind='enc';pt.endT=te;
      st={b:enc.c,r:sub(p,cp),v:sub(v,cv),t:te,off:absOff(enc.c,te)}}
    else if(tEsc>0){const[p,v]=kepler(st.r,st.v,tEsc,b.mu),tx=st.t+tEsc,[bp,bv]=bodyRel(b,tx);pt.end=p;pt.endKind='esc';pt.endT=tx;
      st={b:b.parent,r:add(p,bp),v:add(v,bv),t:tx,off:absOff(b.parent,tx)}}
    else break}
  return out}
// ---- maneuver node: one planned impulse {t, dv:[prograde, normal, radial]} on the current leg of the trajectory.
// Before the burn the node's world-frame Δv is recomputed from the orbit (so it follows any correction you make);
// once thrust starts inside the burn window it freezes, and every m/s the engines deliver is subtracted from it.
function nodeFrame(r,v){const pro=norm(v),h=cross(r,v),nrm=len(h)>1e-9?norm(h):[0,1,0];return{pro,nrm,rad:norm(cross(v,nrm))}}
function nodeInfo(s){const n=s.node;if(!n)return null;
  if(n.burning){const rem=sub(n.dvW,n.applied);return{rem,dvW:n.dvW,rN:s.r,vN:s.v,t:simT,b:s.body}}
  let r,v;
  // on a perturbed orbit the node's state is integrated (same stepper as rails), and kept until something other than
  // gravity changes the craft's motion (kickN) or the node moves; otherwise it's the exact Kepler state
  if(pertNear(s.body,elements(s.r,s.v,s.body.mu))){const k=`${n.t}|${s.body.name}|${s.kickN||0}`;
    if(!n._c||n._c.k!==k||simT<n._c.t0){[r,v]=coastTo(s.body,s.r,s.v,simT,n.t);n._c={k,r,v,t0:simT}}else{r=n._c.r;v=n._c.v}}
  else[r,v]=kepler(s.r,s.v,n.t-simT,s.body.mu);
  const f=nodeFrame(r,v),dvW=add(add(mul(f.pro,n.dv[0]),mul(f.nrm,n.dv[1])),mul(f.rad,n.dv[2]));
  return{rem:dvW,dvW,rN:r,vN:v,t:n.t,b:s.body,f}}
function nodeBurnTime(s,dv){ // full throttle, vacuum, on the engines burning now (or the next stage's)
  let E=activeEngines(s);if(!E.length){const ev=s.events[s.evIdx];if(ev)E=s.parts.filter(p=>p.on&&p.d.kind==='engine'&&ev.ignite.includes(p.seg)&&groupFuel(s,s.grp[p.i])>0)}
  if(!E.length)return NaN;const Fv=[0,0,0];let md=0;for(const p of E){const d=tdirOf(p),f=p.d.thrust*1000;Fv[0]+=f*d[0];Fv[1]+=f*d[1];Fv[2]+=f*d[2];md+=engineMdot(p.d)*1000}const F=len(Fv);
  return s.mass*(1-Math.exp(-dv/(F/md)))/md}
function nodeBurn(s,Y,T,dt){const n=s.node;
  if(!n.burning){if(simT<n.t-(n.est||0)-60)return;n.dvW=nodeInfo(s).dvW;n.applied=[0,0,0];n.burning=true}
  n.applied=madd(n.applied,Y,T/s.mass*dt);const rem=sub(n.dvW,n.applied);
  if(dot(rem,n.dvW)<=0||len(rem)<0.1){s.node=null;s.throttle=0;HOOK.msg('Maneuver complete — throttle cut')}}
function dvRemaining(s){ // current stage (until the next staging event) and total, vacuum Isp
  const plan=dvPlan(s,0);return{cur:plan.length?plan[0].dv:0,tot:plan.reduce((a,x)=>a+x.dv,0)}}
function analyze(s){ // the what-if cases; each joint keeps its worst load across liftoff and max-q
  const ls=launchSegs(s),saved=fuelArr(s);s.parts.forEach(p=>{p.anaFrac=0;p.anaKind=''});
  const rec=r=>{let cw={frac:0,p:null,kind:''};for(const p of s.parts){if(p.parent&&p.sk1&&p.pfrac>0){const f=p.pfrac/Math.min(certOf(p.sk1),certOf(p.sk2));if(f>cw.frac)cw={frac:f,p,kind:p.pkind}}
    if(p.pfrac>p.anaFrac){p.anaFrac=p.pfrac;p.anaKind=p.pkind}p.pfrac=0}r.cert=cw;return r};
  s.parts.forEach(p=>p.pfrac=0);
  const ful=probe(s,{M:0.6,aoa:4,q:5000,h:3000}),sup=probe(s,{M:1.6,aoa:4,q:5000,h:12000});s.parts.forEach(p=>p.pfrac=0);
  const lift=rec(probe(s,{thr:1})),mq=rec(probe(s,{M:1.2,aoa:5,q:25000,h:9000,thr:1}));
  s.parts.forEach(p=>{if(ls.includes(p.seg)&&p.res.fuel!=null)p.res.fuel=0});const emp=probe(s,{M:0.6,aoa:4,q:5000,h:3000});s.parts.forEach((p,i)=>{if(p.res.fuel!=null)p.res.fuel=saved[i]});
  geom(s);return{ful,emp,sup,lift,mq,ctl:controlReport(s)}}

// ---- impact prediction: a point mass with this vessel's real drag, flown forward from now. Vacuum legs are exact Kepler; in
// the air it integrates drag from a CdA(Mach) table measured by the aero pass at the angle the vessel is holding to the
// airflow right now (5° bins), plus the parachute rules. The path is kept in the planet's rotating frame.
function dragTable(s,aoa){const A=Math.round(aoa/5)*5,key=s.parts.filter(p=>p.on).length+':'+A;if(s.dragTab&&s.dragTab.key===key)return s.dragTab.tab;const ar=A*Math.PI/180;
  const tab=[],ca=s.chuteA,saved=s.parts.map(p=>[p.F.slice(),p.L.slice(),p.Q]);s.chuteA=0;geom(s);
  for(let M=0;M<=12.01;M+=0.5){for(const p of s.parts){p.F=[0,0,0];p.L=[0,0,0]}const v=Math.max(M,0.05)*SND(5000),rho=0.5;
    const vb=[v*Math.sin(ar),v*Math.cos(ar),0];aeroPass(s,vb,[0,0,0],rho,M,false);let F=[0,0,0];for(const p of s.parts)if(p.on)F=add(F,p.F);
    tab.push(Math.max(0,-dot(F,vb)/v)/(0.5*rho*v*v))}   // the drag component only; lift from a trim angle is not modelled
  s.chuteA=ca;s.parts.forEach((p,i)=>{p.F=saved[i][0];p.L=saved[i][1];p.Q=saved[i][2]});s.dragTab={key,tab};return tab}
// generic fall: a point mass from (r,v,t) with drag rate per unit speed kdrag(h,sp,rho,r,t) (1/m), to the ground or never
function fall(b,r,v,t,kdrag){
  const mu=b.mu,top=b.R+(b.atm||0),path=[],keep=(r,t)=>path.push(toPF(b,r,t)),r0=r,v0=v,t0=t;r=r.slice();v=v.slice();let dt0=0;
  const el=elements(r,v,mu);if(el.pe>top)return null;
  if(len(r)>top+1){const c=(el.p/top-1)/el.e;if(!(c>=-1&&c<=1))return null;const dt=timeToNu(el,-Math.acos(c));dt0=dt;
    for(let k=1;k<=24;k++){const[rr]=kepler(r,v,dt*k/24,mu);keep(rr,t+dt*k/24)}[r,v]=kepler(r,v,dt,mu);t+=dt}
  if(!b.atm&&pertNear(b,el)){const tEnd=t+2*(dt0>0?dt0:0)+600;r=r0.slice();v=v0.slice();t=t0;path.length=0;let k=0;   // perturbed: the same stepper as rails
    while(t<tEnd&&len(r)>b.R){const{lim,sp,pa,hP}=coastPlan(b,r,v,t,elements(r,v,mu),b.R),h=Math.min(Math.max(0.05,0.25*lim/sp),hP,tEnd-t);[r,v]=coastStep(b,r,v,t,h,pa);t+=h;if(++k%8===0)keep(r,t)}
    if(len(r)>b.R)return null;return{t,pf:toPF(b,r,t),v:len(sub(v,surfVel(b,r))),path,b}}
  if(!b.atm)return{t,pf:toPF(b,r,t),v:len(sub(v,surfVel(b,r))),path,b};
  let kd=0;   // drag rate (1/s) at the last evaluation: the step must stay well under its time constant, or a chute makes it ring
  const acc=(r,v)=>{const rl=len(r),h=rl-b.R,rho=density(b,h),va=sub(v,surfVel(b,r)),sp=len(va);let a=mul(r,-mu/(rl*rl*rl));kd=0;
    if(rho>0&&sp>0.1){kd=0.5*rho*sp*kdrag(h,sp,rho,r,t);a=madd(a,va,-kd)}return a};
  for(let i=0;i<40000;i++){const h=len(r)-b.R;if(h<=0||h<TERR_TOP&&h<=groundAlt(b,toPF(b,r,t)))break;acc(r,v);const sp=len(v),dt=Math.min(clamp(h/Math.max(sp,1)/40,0.02,2),0.3/Math.max(kd,1e-9));
    const a1=acc(r,v),rm=madd(r,v,dt/2),vm=madd(v,a1,dt/2),a2=acc(rm,vm);r=madd(r,vm,dt);v=madd(v,a2,dt);t+=dt;
    if(i%8===0)keep(r,t);
    if(len(r)>top+10&&dot(r,v)>0){ // climbing out of the air: coast the vacuum arc exactly and come back in (or never)
      const e2=elements(r,v,mu);if(e2.pe>top)return null;const c=(e2.p/(top-1)-1)/e2.e;if(!(c>=-1&&c<=1))return null;const dt=timeToNu(e2,-Math.acos(c));
      for(let k=1;k<=24;k++){const[rr]=kepler(r,v,dt*k/24,mu);keep(rr,t+dt*k/24)}[r,v]=kepler(r,v,dt,mu);t+=dt}}
  return{t,pf:toPF(b,r,t),v:len(sub(v,surfVel(b,r))),path,b}}
function predictImpact(s,sg=0){
  if(s.landed||!s.alive)return null;const b=s.body;
  const Y=qrot(s.q,[0,1,0]),va0=sub(s.v,surfVel(b,s.r)),aoa=len(va0)>1?Math.acos(clamp(dot(va0,Y)/len(va0),-1,1))*57.2958:0,tab=b.atm?dragTable(s,aoa):[0,0],m=s.mass;
  const cdA=M=>{const x=clamp(M/0.5,0,tab.length-1.001),i=Math.floor(x);return tab[i]+(tab[i+1]-tab[i])*(x-i)},pe=sg&&b===TELLUS?predErr(s):0;
  return fall(b,s.r,s.v,simT,(h,sp,rho,r,t)=>{let A=cdA(sp/SND(h));if(s.chute&&s.chutePart&&s.chutePart.on&&rho>0.03)A+=Math.min(sp<250&&mainChuteOK(b,h,r,t)?600:sp<400?6:0,CHUTE_G*G0*m/(0.5*rho*sp*sp+1));return A/m*(b===TELLUS?1+sg*(atmU(h)+pe):1)})}   // pe: the compute era's prediction error (economy)
// debris falls with the same simple drag stepDebris gives it (2.5 m² tumbling)
const debrisImpact=d=>fall(d.body,d.r,d.v,simT,()=>2.5/d.mass);

