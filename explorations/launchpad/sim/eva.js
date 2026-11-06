// sim/eva.js — astronauts on foot (EVA). Part of index.html's script (a classic script sharing one global scope; index.html
// loads them in order) and of eva-lab.html, the movement test ground, which loads only sim/core.js and this file.
'use strict';
// ============================================================ EVA movement (space session, QUEUE Q531; EVA.md § 3, § 6a;
// notes/space.md § "Plan: EVA E0"). One walker in a local flat frame (right-handed, y up, metres; facing +z, +x is on
// the left) against a *world*:
// {g (m/s², down is −y), mu, R (the body's radius, for escape speed), ground(x,z) → height}.
//
// The model, in one paragraph: on the ground the centre of mass rides at height h over the stance foot as an inverted
// pendulum (x'' = ω²(x − c), ω = √(g/h), c the centre of pressure, which the ankle can move within the foot). Walking is
// where the next foot goes: every step period (∝ √(L/g)) the foot lands where it brings the body to the wanted velocity by
// the end of the next step (the pendulum's own solution), no farther than the leg reaches. The foot's force must fit
// inside the ground's friction cone, or it slips. Past Froude v²/(gL) ≈ 0.5 the gait is a lope: each stance ends in a
// push, then ballistic flight, and the foot is placed only at touchdown. A jump is the leg's force over a crouch. A lean
// past the limit, or a slip that lasts, is a fall: lie, slide to rest, get up.
const EVA_DT=1/240;
// the tuning (the lab's tweak panel edits a copy; EVA.md § 6a: feel over accuracy, these are where the tuning starts)
const EVA_TUNE={
  m:170,        // kg, a person in a suit
  L:.9,         // m, leg length (hip height)
  h:1,          // m, the centre of mass over the feet when standing (the backpack raises it)
  foot:.1,      // m, how far the ankle can move the centre of pressure from the foot's middle
  reach:.55,    // m, the farthest a step puts the foot from under the centre of mass
  push:2000,    // N, the leg's push in a jump
  crouch:.3,    // m, how far the leg extends in that push
  frLope:.5,    // the Froude number where walking turns into a lope (Kram et al. 1997)
  frWalk:.25,   // the Froude number of an easy walk (W), capped at vWalkMax
  frRun:1.2,    // the Froude number of a hurried lope (Shift), capped at vRunMax
  vWalkMax:1.4,vRunMax:3.2,
  hopV:.45,     // m/s, the lope's push off the ground at each stride
  kStep:1.9,    // step period = kStep·√(L/g), between stepMin and stepMax s
  stepMin:.35,stepMax:3,
  kStance:.8,   // a lope's contact time = kStance·√(L/g), between .15 and 1.5 s
  turn:2,       // rad/s, the fastest turn
  fallDeg:38,   // a lean past this is a fall
  slipFall:.3,  // s of slipping before a slide can become a fall…
  slideFall:2.5,  // m/s: …once it slides faster than this (slower, it slides on its feet: scree, a steep bank)
  creep:.25,    // share of the walking speed it keeps on ground too steep to walk (it always tries; the grip decides)
  landMax:4,    // m/s, coming down faster than this is a fall
  stepUp:.45,   // m, the highest ground a step can rise onto (higher is a wall): knee-high
  stepDown:.6,  // m, the deepest a foothold can be below the last one without jumping down
  getUp:2,      // s to get up at 1 g; slower in low g (getUpLow more at 0 g)
  getUpLow:4};
const evaUp=[0,1,0];
const evaG=W=>Math.max(0,W.g);
const evaNormal=(W,x,z)=>{const d=.1,hx=W.ground(x+d,z)-W.ground(x-d,z),hz=W.ground(x,z+d)-W.ground(x,z-d);return norm([-hx/(2*d),1,-hz/(2*d)])};
// a walker standing at (x, z), facing heading psi (radians: 0 faces +z, π/2 faces +x; turning right lowers psi)
const evaFw=psi=>[Math.sin(psi),0,Math.cos(psi)],evaRt=psi=>[-Math.cos(psi),0,Math.sin(psi)];
function evaNew(W,x,z,psi=0,T=EVA_TUNE){const gy=W.ground(x,z);
  return{T,W,p:[x,gy+T.h,z],v:[0,0,0],psi,st:'stand',f:[x,gy,z],c:[x,gy,z],feet:[[x,gy,z],[x,gy,z]],tdT:0,toT:0,jumpK:'',dn:null,
    sf:0,stepT:0,stepP:1,lope:false,slipT:0,downT:0,t:0,in:{fwd:0,side:0,turn:0,hurry:false,jump:false,target:null},jumpWas:false,
    tel:{F:[0,0,0],cone:0,slip:false,cp:[x,gy,z],vd:[0,0,0],lean:0,why:''},
    rec:{dist:0,vmax:0,falls:0,steps:0,airT:0,hopH:0,top:0,escaped:false,slips:0},prints:[],trail:[]}}
// speeds the inputs ask for, at this gravity
const evaWalkV=(T,g)=>Math.min(T.vWalkMax,Math.sqrt(T.frWalk*g*T.L)),evaRunV=(T,g)=>Math.min(T.vRunMax,Math.sqrt(T.frRun*g*T.L));
const evaStepP=(T,g)=>g>0?clamp(T.kStep*Math.sqrt(T.L/g),T.stepMin,T.stepMax):T.stepMax;
const evaStanceP=(T,g)=>g>0?clamp(T.kStance*Math.sqrt(T.L/g),.15,1.5):1.5;
const evaFroude=(A,v=Math.hypot(A.v[0],A.v[2]))=>{const g=evaG(A.W);return g>0?v*v/(g*A.T.L):Infinity};
// the jump's take-off speed: the leg's force less the weight, over the crouch
const evaJumpV=(T,g)=>Math.sqrt(Math.max(0,2*(T.push/T.m-g)*T.crouch));
const evaEscV=W=>W.R?Math.sqrt(2*evaG(W)*W.R):Infinity;
// the wanted horizontal velocity, from the keys (in: fwd forward +, side right +, turn right +) or a target to walk to.
// On a slope the walk slows to what keeps each stride's push inside the friction cone: a stride at speed v leans the force
// by about atan(v·tanh(ωP/2)/(ωh)), and that plus the slope must stay under 90 % of the friction angle.
// It looks a stride or two ahead (the steepest grade within 2 m *along the way it's going*: a drop-off beside the path
// doesn't slow it), as a walker would. Ground too steep for the grip doesn't stop it: it creeps on, and the friction cone
// decides (it slips back on a climb, slides on a descent; v1.263's "refuse" was an invisible wall, Caio 2026-11-06).
function evaSlopeV(A,g,dir){const T=A.T;let th=0;
  for(const k of[0,.5,1,1.5,2]){const n=evaNormal(A.W,A.p[0]+dir[0]*k,A.p[2]+dir[2]*k);th=Math.max(th,Math.atan(Math.abs(n[0]*dir[0]+n[2]*dir[2])/n[1]))}
  const room=Math.atan(.9*A.W.mu)-th,vc=T.creep*evaWalkV(T,g);
  if(room<=0)return vc;const w=Math.sqrt(g/T.h),P=A.in.hurry?evaStanceP(T,g):evaStepP(T,g);return Math.max(vc,T.h*Math.tan(room)*w/Math.tanh(w*P/2))}
// Turning, it slows to what the grip can hold round the turn (v·ω within half of μg), as anyone does.
function evaWanted(A){const T=A.T,g=evaG(A.W),I=A.in,fw=evaFw(A.psi),rt=evaRt(A.psi),base=Math.min(I.hurry?evaRunV(T,g):evaWalkV(T,g),I.turn?.5*A.W.mu*g/T.turn:Infinity);
  const spAlong=dir=>Math.min(base,evaSlopeV(A,g,dir));
  if(I.target){const d=[I.target[0]-A.p[0],0,I.target[1]-A.p[2]],dl=len(d);if(dl<.3){I.target=null;return[0,0,0]}const sp=spAlong(mul(d,1/dl));
    // slow down in time: the stopping distance at the friction's grip (half of it, to keep a margin)
    const vs=Math.min(sp,Math.sqrt(2*.5*A.W.mu*g*Math.max(0,dl-.2)));return mul(d,vs/dl)}
  const w=add(mul(fw,I.fwd),mul(rt,I.side)),wl=len(w);return wl>1e-6?mul(w,spAlong(mul(w,1/wl))/Math.max(1,wl)):[0,0,0]}
// where the next foot goes: the deadbeat placement of the inverted pendulum (velocity v0 now, vd after a step of period P),
// d = (v0·cosh ωP − vd)/(ω sinh ωP), held within the leg's reach
// A walker asks a step only for the change of velocity its grip allows (70 % of μ less the slope, over the step), so it
// doesn't push itself into a slip; on ground steeper than the friction angle it can't change speed at all.
function evaPlaceAt(A,x,v,vd,P){const g=evaG(A.W),w=Math.sqrt(g/A.T.h),ch=Math.cosh(w*P),sh=w*Math.sinh(w*P),v0=[v[0],0,v[2]],n=evaNormal(A.W,x[0],x[2]);
  const mE=Math.max(.03,A.W.mu-Math.hypot(n[0],n[2])/n[1]),dv=sub(vd,v0),dvl=len(dv),dm=.7*mE*g*P;if(dvl>dm)vd=add(v0,mul(dv,dm/dvl));
  // and no farther than leans the push past 85 % of the grip at the start of the step
  let d=sh>1e-9?mul(sub(mul(v0,ch),vd),1/sh):[0,0,0];const dl=len(d),dM=Math.min(A.T.reach,.85*mE*A.T.h);if(dl>dM)d=mul(d,dM/dl);
  return evaFoothold(A,x[0]+d[0],x[2]+d[2],v)}
// A foothold: where the step would land, unless that ground is steeper than the grip holds; then the flattest spot along
// the stride (back to under the body, on to the leg's reach, a hand's width either side) that a step can rise onto. A
// knee-high bank is a step onto its top, not a slope to slip on; a 2.5 m face stays a slope.
const evaSteep=(W,x,z)=>{const n=evaNormal(W,x,z);return Math.atan(Math.hypot(n[0],n[2])/n[1])};
function evaFoothold(A,fx,fz,v){const W=A.W,T=A.T,lim=.8*Math.atan(W.mu);if(evaSteep(W,fx,fz)<=lim)return[fx,W.ground(fx,fz),fz];
  const vh=[v[0],0,v[2]],vl=len(vh),dir=vl>.05?mul(vh,1/vl):evaFw(A.psi),rt=[-dir[2],0,dir[0]],y0=A.f[1],ax=fx-A.p[0],az=fz-A.p[2],along=ax*dir[0]+az*dir[2];
  let best=null;
  for(let k=-.6;k<=T.reach+1e-9;k+=.05){const a=Math.max(-.1,along)+k;if(a<-.1||a>T.reach+.05)continue;
    for(const l of[0,-.1,.1]){const cx=A.p[0]+dir[0]*a+rt[0]*l,cz=A.p[2]+dir[2]*a+rt[2]*l,gy=W.ground(cx,cz),st=evaSteep(W,cx,cz);
      if(gy-y0>T.stepUp||y0-gy>T.stepDown)continue;const sc=st+.4*Math.abs(a-along)+.2*Math.abs(l);if(st<=lim&&(!best||sc<best.sc))best={sc,p:[cx,gy,cz]}}}
  return best?best.p:[fx,W.ground(fx,fz),fz]}
const evaPlace=(A,vd,P)=>evaPlaceAt(A,A.p,A.v,vd,P);
// Where and when the next foot comes down if the inputs hold ({f, t: seconds from now, still}), for drawing the swinging
// leg so it lands where the physics will put it: the pendulum carried to the step's end (or the flight to its landing),
// then the same placement.
function evaNext(A){const T=A.T,W=A.W,g=evaG(W),vd=A.tel.vd;if(g<1e-3||A.st==='down'||A.st==='float')return{f:A.f,t:0,still:true};
  const w=Math.sqrt(g/T.h),air=(x,v,vy)=>{let t=0;for(let i=0;i<3;i++){const gy=W.ground(x[0]+v[0]*t,x[2]+v[2]*t)+T.h,dy=x[1]-gy;t=(vy+Math.sqrt(Math.max(0,vy*vy+2*g*dy)))/g}return t};
  if(A.st==='air'){const t=air(A.p,A.v,A.v[1]),x=[A.p[0]+A.v[0]*t,0,A.p[2]+A.v[2]*t];return{f:evaPlaceAt(A,x,A.v,vd,A.lope?evaStanceP(T,g):evaStepP(T,g)),t}}
  const moving=len(vd)>.02||Math.hypot(A.v[0],A.v[2])>.05;if(!moving)return{f:A.f,t:Math.max(0,.5*evaStepP(T,g)-A.tdT),still:true};
  const tau=Math.max(0,A.stepP-A.stepT),e0=[A.p[0]-A.c[0],0,A.p[2]-A.c[2]],v=[A.v[0],0,A.v[2]],ch=Math.cosh(w*tau),sh=Math.sinh(w*tau);
  const x=add(A.c,add(mul(e0,ch),mul(v,sh/w))),vT=add(mul(e0,w*sh),mul(v,ch));
  if(A.lope){const tf=air([x[0],A.p[1],x[2]],vT,T.hopV),xl=add(x,mul(vT,tf));return{f:evaPlaceAt(A,xl,vT,vd,evaStanceP(T,g)),t:tau+tf}}
  return{f:evaPlaceAt(A,x,vT,vd,evaStepP(T,g)),t:tau}}
function evaStep(A,dt=EVA_DT){const T=A.T,W=A.W,g=evaG(W),I=A.in;A.t+=dt;
  // turning: the keys turn; walking to a target, or sidestepping, faces the way it goes
  const vd=evaWanted(A);A.tel.vd=vd;
  if(A.st!=='down'){if(I.target&&len(vd)>.05){const want=Math.atan2(vd[0],vd[2]);let da=want-A.psi;da=Math.atan2(Math.sin(da),Math.cos(da));A.psi+=clamp(da,-T.turn*dt,T.turn*dt)}
    else A.psi-=I.turn*T.turn*dt}
  const jumpNow=I.jump&&!A.jumpWas;A.jumpWas=I.jump;
  if(g<1e-3&&A.st!=='air'){A.st='float';A.p=madd(A.p,A.v,dt);A.tel.why='0 g: nothing to push against (rails and tethers come with the 0 g hall)';return}
  if(A.st==='float')A.st='air';
  if(A.st==='air'){A.v[1]-=g*dt;A.p=madd(A.p,A.v,dt);A.rec.airT+=dt;A.rec.top=Math.max(A.rec.top,A.p[1]-W.ground(A.p[0],A.p[2])-T.h);
    if(!A.rec.escaped&&A.v[1]>evaEscV(W)){A.rec.escaped=true;A.tel.why='faster than escape speed: gone'}
    const gy=W.ground(A.p[0],A.p[2]);if(A.p[1]<=gy+T.h&&A.v[1]<=0){
      const n=evaNormal(W,A.p[0],A.p[2]),vin=-dot(A.v,n);A.rec.hopH=Math.max(A.rec.hopH,A.hopTop-gy||0);
      if(vin>T.landMax){const vh=[A.v[0],0,A.v[2]],vl=len(vh),dir=vl>.2?mul(vh,1/vl):evaFw(A.psi);A.p[1]=gy+T.h;evaFall(A,`came down at ${vin.toFixed(1)} m/s`,[A.p[0],gy,A.p[2]],dir,.3,vl*.6/T.h);return}
      // touchdown: the foot goes where the coming stance brings the wanted velocity; the vertical speed is absorbed
      A.p[1]=gy+T.h;A.v[1]=dot([A.v[0],0,A.v[2]],evaSlope(A));A.st='stand';A.stepT=0;A.stepP=A.lope?evaStanceP(T,g):evaStepP(T,g);A.f=evaPlace(A,vd,A.stepP);evaPrint(A)}
    else A.hopTop=Math.max(A.hopTop||-1e9,A.p[1]-T.h);
    evaTrail(A,dt);return}
  if(A.st==='down'){evaDown(A,dt);evaTrail(A,dt);return}
  // ---- standing / walking: the pendulum on the foot
  const w2=g/T.h,w=Math.sqrt(w2),cp=[A.p[0]+A.v[0]/w,A.f[1],A.p[2]+A.v[2]/w];A.tel.cp=cp;
  const moving=len(vd)>.02||Math.hypot(A.v[0],A.v[2])>.05,frW=len(vd)**2/(g*T.L);
  // the gait follows the faster of the wanted speed and the speed it has: a walk's slow steps can't catch a run
  const frN=Math.max(frW,(A.v[0]**2+A.v[2]**2)/(g*T.L));A.lope=frN>T.frLope||(A.lope&&frN>.8*T.frLope);
  // standing still, the ankle moves the centre of pressure toward the capture point, within the foot; walking, the
  // steps do the work and the pressure stays mid-foot
  // (the ankle uses only the grip the lean leaves: on a slope or after a long step it has little)
  const n0=evaNormal(W,A.f[0],A.f[2]),mE0=Math.max(.03,W.mu-Math.hypot(n0[0],n0[2])/n0[1]),room=clamp(.9*mE0*T.h-Math.hypot(A.p[0]-A.f[0],A.p[2]-A.f[2]),0,T.foot);
  const want=len(vd)>.02,off=[cp[0]-A.f[0],0,cp[2]-A.f[2]],ol=len(off);A.c=want?A.f.slice():add(A.f,ol>room?mul(off,room/Math.max(ol,1e-9)):off);
  A.stepT+=dt;A.tdT+=dt;
  if(jumpNow){const vj=evaJumpV(T,g);if(vj>.05){A.st='air';A.toT=A.t;A.jumpK='jump';A.v[1]=vj+dot([A.v[0],0,A.v[2]],evaSlope(A));A.hopTop=-1e9;A.tel.why=`jump: ${vj.toFixed(2)} m/s up`;evaTrail(A,dt);return}A.tel.why='too heavy to jump here'}
  // a step: on the period while moving, or at once when the capture point leaves the foot
  if((moving&&A.stepT>=A.stepP)||!want&&ol>T.foot*1.5&&A.stepT>.2*A.stepP){
    if(A.lope&&moving){A.st='air';A.toT=A.t;A.jumpK='hop';A.v[1]=T.hopV+dot([A.v[0],0,A.v[2]],evaSlope(A));A.hopTop=-1e9;A.rec.steps++;evaTrail(A,dt);return}
    A.stepT=0;A.stepP=evaStepP(T,g);A.f=evaPlace(A,vd,A.stepP);A.rec.steps++;evaPrint(A)}
  // the foot's force: the pendulum's push and the weight, inside the friction cone of the ground under the foot
  const ah=[w2*(A.p[0]-A.c[0]),0,w2*(A.p[2]-A.c[2])],n=evaNormal(W,A.f[0],A.f[2]);let F=mul([ah[0],g,ah[2]],T.m);
  const Fn=Math.max(0,dot(F,n)),Ft=sub(F,mul(n,dot(F,n))),ftl=len(Ft);A.tel.cone=Fn>0?ftl/(W.mu*Fn):Infinity;A.tel.slip=ftl>W.mu*Fn;
  if(A.tel.slip){F=add(mul(n,Fn),ftl>0?mul(Ft,W.mu*Fn/ftl):[0,0,0]);A.slipT+=dt;A.rec.slips+=dt}else A.slipT=Math.max(0,A.slipT-dt);
  A.tel.F=F;const a=add(mul(F,1/T.m),[0,-g,0]);
  // a slip moves the foot with the body; the pendulum leans on it otherwise
  A.v[0]+=a[0]*dt;A.v[2]+=a[2]*dt;
  if(A.tel.slip){const s=[A.v[0]*dt,0,A.v[2]*dt];A.f=add(A.f,s);A.f[1]=W.ground(A.f[0],A.f[2])}
  const nx=A.p[0]+A.v[0]*dt,nz=A.p[2]+A.v[2]*dt,gy0=W.ground(A.p[0],A.p[2]),gy=W.ground(nx,nz);
  // a riser higher than a step is a wall
  if(gy-gy0>.03&&gy-(A.p[1]-T.h)>T.stepUp){A.v[0]=A.v[2]=0;A.tel.why='a wall: too high to step up'}
  else{const yT=gy+T.h,yB=A.p[1]+A.v[1]*dt-.5*g*dt*dt;
    // ground falling away faster than gravity can follow (a crest at speed, a ledge): off the ground
    if(yT<yB-1e-4){A.st='air';A.toT=A.t;A.jumpK='drop';A.hopTop=-1e9;A.p=[nx,A.p[1]+A.v[1]*dt,nz];evaTrail(A,dt);return}
    A.p=[nx,yT,nz];A.v[1]=dot([A.v[0],0,A.v[2]],evaSlope(A))}
  const lean=Math.hypot(A.p[0]-A.c[0],A.p[2]-A.c[2])/T.h;A.tel.lean=Math.atan(lean)*180/Math.PI;
  if(A.tel.lean>T.fallDeg)evaFall(A,'leaned past catching');else if(A.slipT>T.slipFall&&Math.hypot(A.v[0],A.v[1],A.v[2])>T.slideFall)evaFall(A,'slid and fell');
  A.tel.slide=A.slipT>T.slipFall;
  evaTrail(A,dt)}
const evaSlope=A=>{const n=evaNormal(A.W,A.p[0],A.p[2]);return[-n[0]/n[1],0,-n[2]/n[1]]};
// A fall is the body toppling about its feet as an inverted pendulum, θ'' = (g/h)·sin θ, from the lean it had (slow in low
// g, as on Apollo 16), the feet sliding on as friction allows; then it lies and slides to rest; then it gets up (on hands
// and knees from a fall on its front, sitting up from one on its back) and stands facing the way its body lay.
const EVA_LIE=.2;   // m, the centre of mass over the ground lying down
function evaFall(A,why,piv,dir,th0,w0=0){const T=A.T;if(!piv){const e=[A.p[0]-A.c[0],0,A.p[2]-A.c[2]],el=len(e);piv=A.c.slice();dir=el>.02?mul(e,1/el):evaFw(A.psi);th0=Math.max(.15,Math.atan(el/T.h))}
  A.st='down';A.downT=0;A.slipT=0;A.rec.falls++;A.tel.why='fell: '+why;
  A.dn={ph:'topple',th:th0,w:w0,piv:piv.slice(),dir,face:dot(dir,evaFw(A.psi))>=0,vs:[A.v[0],0,A.v[2]],t:0};A.v[1]=0}
const evaThEnd=T=>Math.acos(clamp(EVA_LIE/T.h,0,1));
const evaRiseP=(T,g)=>clamp(1.6*Math.sqrt(9.81/Math.max(g,.3)),1.6,5);
function evaDown(A,dt){const T=A.T,W=A.W,g=evaG(W),D=A.dn,mu=W.mu;D.t+=dt;
  const slide=v=>{const vl=len(v),dv=mu*g*dt;return vl>dv?mul(v,1-dv/vl):[0,0,0]};
  if(D.ph==='topple'){D.w+=g/T.h*Math.sin(D.th)*dt;D.th+=D.w*dt;D.vs=slide(D.vs);D.piv=madd(D.piv,D.vs,dt);D.piv[1]=W.ground(D.piv[0],D.piv[2]);
    const te=evaThEnd(T),th=Math.min(D.th,te),p=add(D.piv,add(mul(D.dir,T.h*Math.sin(th)),[0,T.h*Math.cos(th),0]));
    A.v=add(D.vs,add(mul(D.dir,T.h*D.w*Math.cos(th)),[0,-T.h*D.w*Math.sin(th),0]));A.p=p;if(D.th>=te){D.ph='lie';D.t=0;A.v=add(D.vs,mul(D.dir,.3*D.w*T.h));A.v[1]=0}return}
  if(D.ph==='lie'){const n=evaNormal(W,A.p[0],A.p[2]),gt=sub([0,-g,0],mul(n,-g*n[1])),vh=sub(A.v,mul(n,dot(A.v,n))),vl=len(vh);
    // lying: gravity along the slope, friction against the slide
    let a=gt;if(vl>1e-3)a=madd(a,vh,-Math.min(mu*g*n[1],vl/dt)/vl);else if(len(gt)<=mu*g*n[1])a=[0,0,0];
    A.v=madd(vh,a,dt);A.p=madd(A.p,A.v,dt);A.p[1]=W.ground(A.p[0],A.p[2])+EVA_LIE;
    if(len(A.v)<.02){A.v=[0,0,0];A.downT+=dt;if(A.downT>T.getUp+T.getUpLow*clamp(1-g/9.81,0,1)){
      // the body lies from its feet along dir; it stands up about 0.35 m from its middle, toward its feet
      const L=A.p.slice(),S=sub(L,mul(D.dir,.35));S[1]=W.ground(S[0],S[2]);D.ph='rise';D.t=0;D.L=L;D.S=S;D.dur=evaRiseP(T,g)}}return}
  // rising: the centre of mass from lying to standing (the figure is posed from D.t/D.dur)
  const u=clamp(D.t/D.dur,0,1),k=u*u*(3-2*u),S=D.S;A.p=add(mul(D.L,1-k),mul([S[0],S[1]+T.h,S[2]],k));A.v=[0,0,0];
  if(u>=1){const F=D.face?D.dir:mul(D.dir,-1);A.psi=Math.atan2(F[0],F[2]);A.st='stand';A.f=S.slice();A.c=S.slice();A.feet=[S.slice(),S.slice()];A.stepT=0;A.tdT=1;A.dn=null;A.downT=0;A.tel.why='got up'}}
function evaPrint(A){A.sf^=1;A.tdT=0;A.feet[A.sf]=A.f.slice();A.prints.push([A.f[0],A.f[1],A.f[2],A.psi]);if(A.prints.length>400)A.prints.shift()}
function evaTrail(A,dt){const s=Math.hypot(A.v[0],A.v[2]);A.rec.dist+=s*dt;A.rec.vmax=Math.max(A.rec.vmax,s);
  const L=A.trail,q=L[L.length-1];if(!q||Math.hypot(q[0]-A.p[0],q[1]-A.p[1],q[2]-A.p[2])>.1){L.push(A.p.slice());if(L.length>1500)L.shift()}}
function evaRun(A,dt){A.acc=Math.min((A.acc||0)+dt,.25);while(A.acc>=EVA_DT){evaStep(A,EVA_DT);A.acc-=EVA_DT}}
const evaGait=A=>A.st==='down'?'down':A.st==='float'?'floating':A.st==='air'?(A.lope?'lope (in the air)':'in the air'):A.tel.slide?'sliding on its feet':A.lope?'lope (on the ground)':Math.hypot(A.v[0],A.v[2])>.05||A.stepT<.3?'walk':'stand';

// ---- the course (EVA.md § 6a): the lab draws it and the headless twin walks it. E0a: the flat pad (a 50 m straight from
// the origin north along x = 0) and four ridges (5°, 10°, 20°, 30°) in lanes 5 m wide east of it, each rising north from
// z = 5 to 2.5 m, a 4 m top, and down again at the same angle; their sides fall at 45°.
const EVA_RIDGES=[5,10,20,30].map((a,i)=>({a,x:16+8*i}));
function evaRidgeH(r,x,z){const H=2.5,t=Math.tan(r.a*Math.PI/180),z1=5+H/t,z2=z1+4,z3=z2+H/t;if(z<5||z>z3)return 0;
  const along=Math.min(H,(z-5)*t,(z3-z)*t),side=(2.5+H-Math.abs(x-r.x))*1;return Math.max(0,Math.min(along,side))}
function evaCourseH(x,z){let h=0;for(const r of EVA_RIDGES)if(Math.abs(x-r.x)<6)h=Math.max(h,evaRidgeH(r,x,z));return h}
const EVA_STATIONS=[{k:'straight',name:'The straight (50 m)',x:0,z:-2,psi:0},
  ...EVA_RIDGES.map(r=>({k:'slope'+r.a,name:`Slope ${r.a}°`,x:r.x,z:1,psi:0}))];
// the gravities to try: every body in the game, from its own table
function evaBodies(){const out=[];
  if(typeof BODIES!=='undefined')for(const b of BODIES)out.push({name:b.name,g:b.mu/b.R**2,R:b.R});
  if(typeof SYSTEM_BODIES!=='undefined')for(const b of SYSTEM_BODIES)if(!out.some(o=>o.name===b.name))out.push({name:b.name,g:b.g,R:b.R,gas:b.g>20});
  return out}
function evaWorld(g=9.81,R=null,mu=.6){return{g,R,mu,ground:evaCourseH}}
// the lab's test of a fall: a push the way it faces (or the way it moves), as if it tripped
function evaKnock(A){if(A.st!=='stand')return;const vh=[A.v[0],0,A.v[2]],vl=len(vh),dir=vl>.1?mul(vh,1/vl):evaFw(A.psi);evaFall(A,'knocked over',[A.p[0]-dir[0]*.05,A.f[1],A.p[2]-dir[2]*.05],dir,.25,.3)}
const EVA={TUNE:EVA_TUNE,knock:evaKnock,DT:EVA_DT,LIE:EVA_LIE,thEnd:evaThEnd,next:evaNext,fw:evaFw,rt:evaRt,new:evaNew,step:evaStep,run:evaRun,gait:evaGait,froude:evaFroude,walkV:evaWalkV,runV:evaRunV,stepP:evaStepP,
  jumpV:evaJumpV,escV:evaEscV,world:evaWorld,bodies:evaBodies,stations:EVA_STATIONS,ridges:EVA_RIDGES,courseH:evaCourseH,normal:evaNormal};
