// sim/eva.js — astronauts on foot (EVA). Part of index.html's script (a classic script sharing one global scope; index.html
// loads them in order) and of eva-lab.html, the movement test ground, which loads only sim/core.js and this file.
'use strict';
// ============================================================ EVA movement (space session, QUEUE Q531; EVA.md § 3, § 6a;
// notes/space.md § "Plan: EVA E0"). One walker in a local flat frame (x east, y up, z north, metres) against a *world*:
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
  slipFall:.3,  // s of slipping that ends in a fall
  landMax:4,    // m/s, coming down faster than this is a fall
  stepUp:.35,   // m, the highest ground a step can rise onto (higher is a wall)
  getUp:2,      // s to get up at 1 g; slower in low g (getUpLow more at 0 g)
  getUpLow:4};
const evaUp=[0,1,0];
const evaG=W=>Math.max(0,W.g);
const evaNormal=(W,x,z)=>{const d=.1,hx=W.ground(x+d,z)-W.ground(x-d,z),hz=W.ground(x,z+d)-W.ground(x,z-d);return norm([-hx/(2*d),1,-hz/(2*d)])};
// a walker standing at (x, z), facing heading psi (radians, 0 = +z, π/2 = +x)
function evaNew(W,x,z,psi=0,T=EVA_TUNE){const gy=W.ground(x,z);
  return{T,W,p:[x,gy+T.h,z],v:[0,0,0],psi,st:'stand',f:[x,gy,z],c:[x,gy,z],feet:[[x-.1*Math.cos(psi),gy,z+.1*Math.sin(psi)],[x+.1*Math.cos(psi),gy,z-.1*Math.sin(psi)]],
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
// Heading psi: 0 faces +z (north), π/2 faces +x (east); right of the heading is (cos psi, 0, −sin psi).
// On a slope the walk slows to what keeps each stride's push inside the friction cone: a stride at speed v leans the force
// by about atan(v·tanh(ωP/2)/(ωh)), and that plus the slope must stay under 90 % of the friction angle.
// It looks a stride or two ahead (the steepest ground within 2 m the way it's going), as a walker would.
function evaSlopeV(A,g){const T=A.T,vh=[A.v[0],0,A.v[2]],vl=len(vh),dir=vl>.1?mul(vh,1/vl):[Math.sin(A.psi),0,Math.cos(A.psi)];let th=0;
  for(const k of[0,.5,1,1.5,2]){const n=evaNormal(A.W,A.p[0]+dir[0]*k,A.p[2]+dir[2]*k);th=Math.max(th,Math.atan(Math.hypot(n[0],n[2])/n[1]))}
  const room=Math.atan(.9*A.W.mu)-th;
  if(room<=0)return 0;const w=Math.sqrt(g/T.h),P=A.in.hurry?evaStanceP(T,g):evaStepP(T,g);return T.h*Math.tan(room)*w/Math.tanh(w*P/2)}
function evaWanted(A){const T=A.T,g=evaG(A.W),I=A.in,sp=Math.min(I.hurry?evaRunV(T,g):evaWalkV(T,g),evaSlopeV(A,g)),fw=[Math.sin(A.psi),0,Math.cos(A.psi)],rt=[Math.cos(A.psi),0,-Math.sin(A.psi)];
  if(I.target){const d=[I.target[0]-A.p[0],0,I.target[1]-A.p[2]],dl=len(d);if(dl<.3){I.target=null;return[0,0,0]}
    // slow down in time: the stopping distance at the friction's grip (half of it, to keep a margin)
    const vs=Math.min(sp,Math.sqrt(2*.5*A.W.mu*g*Math.max(0,dl-.2)));return mul(d,vs/dl)}
  const w=add(mul(fw,I.fwd),mul(rt,I.side)),wl=len(w);return wl>1e-6?mul(w,sp/Math.max(1,wl)):[0,0,0]}
// where the next foot goes: the deadbeat placement of the inverted pendulum (velocity v0 now, vd after a step of period P),
// d = (v0·cosh ωP − vd)/(ω sinh ωP), held within the leg's reach
// A walker asks a step only for the change of velocity its grip allows (70 % of μ less the slope, over the step), so it
// doesn't push itself into a slip; on ground steeper than the friction angle it can't change speed at all.
function evaPlace(A,vd,P){const g=evaG(A.W),w=Math.sqrt(g/A.T.h),ch=Math.cosh(w*P),sh=w*Math.sinh(w*P),v0=[A.v[0],0,A.v[2]],n=evaNormal(A.W,A.p[0],A.p[2]);
  const mE=Math.max(.03,A.W.mu-Math.hypot(n[0],n[2])/n[1]),dv=sub(vd,v0),dvl=len(dv),dm=.7*mE*g*P;if(dvl>dm)vd=add(v0,mul(dv,dm/dvl));
  let d=sh>1e-9?mul(sub(mul(v0,ch),vd),1/sh):[0,0,0];const dl=len(d);if(dl>A.T.reach)d=mul(d,A.T.reach/dl);
  const fx=A.p[0]+d[0],fz=A.p[2]+d[2];return[fx,A.W.ground(fx,fz),fz]}
function evaStep(A,dt=EVA_DT){const T=A.T,W=A.W,g=evaG(W),I=A.in;A.t+=dt;
  // turning: the keys turn; walking to a target, or sidestepping, faces the way it goes
  const vd=evaWanted(A);A.tel.vd=vd;
  if(A.st!=='down'){if(I.target&&len(vd)>.05){const want=Math.atan2(vd[0],vd[2]);let da=want-A.psi;da=Math.atan2(Math.sin(da),Math.cos(da));A.psi+=clamp(da,-T.turn*dt,T.turn*dt)}
    else A.psi+=I.turn*T.turn*dt}
  const jumpNow=I.jump&&!A.jumpWas;A.jumpWas=I.jump;
  if(g<1e-3&&A.st!=='air'){A.st='float';A.p=madd(A.p,A.v,dt);A.tel.why='0 g: nothing to push against (rails and tethers come with the 0 g hall)';return}
  if(A.st==='float')A.st='air';
  if(A.st==='air'){A.v[1]-=g*dt;A.p=madd(A.p,A.v,dt);A.rec.airT+=dt;A.rec.top=Math.max(A.rec.top,A.p[1]-W.ground(A.p[0],A.p[2])-T.h);
    if(!A.rec.escaped&&A.v[1]>evaEscV(W)){A.rec.escaped=true;A.tel.why='faster than escape speed: gone'}
    const gy=W.ground(A.p[0],A.p[2]);if(A.p[1]<=gy+T.h&&A.v[1]<=0){
      const n=evaNormal(W,A.p[0],A.p[2]),vin=-dot(A.v,n);A.rec.hopH=Math.max(A.rec.hopH,A.hopTop-gy||0);
      if(vin>T.landMax){evaFall(A,`came down at ${vin.toFixed(1)} m/s`);A.p[1]=gy+.25;return}
      // touchdown: the foot goes where the coming stance brings the wanted velocity; the vertical speed is absorbed
      A.p[1]=gy+T.h;A.v[1]=dot([A.v[0],0,A.v[2]],evaSlope(A));A.st='stand';A.stepT=0;A.stepP=A.lope?evaStanceP(T,g):evaStepP(T,g);A.f=evaPlace(A,vd,A.stepP);evaPrint(A)}
    else A.hopTop=Math.max(A.hopTop||-1e9,A.p[1]-T.h);
    evaTrail(A,dt);return}
  if(A.st==='down'){const n=evaNormal(W,A.p[0],A.p[2]),gt=sub(mul([0,-g,0],1),mul(n,dot([0,-g,0],n))),vh=sub(A.v,mul(n,dot(A.v,n))),vl=len(vh);
    // lying: gravity along the slope, friction against the slide
    let a=gt;if(vl>1e-3)a=madd(a,vh,-Math.min(W.mu*g*dot(n,evaUp),vl/dt)/vl);else if(len(gt)<=W.mu*g*dot(n,evaUp))a=[0,0,0];
    A.v=madd(vh,a,dt);A.p=madd(A.p,A.v,dt);A.p[1]=W.ground(A.p[0],A.p[2])+.25;
    if(len(A.v)<.02){A.v=[0,0,0];A.downT+=dt;if(A.downT>T.getUp+T.getUpLow*clamp(1-g/9.81,0,1)){const gy=W.ground(A.p[0],A.p[2]);A.st='stand';A.p[1]=gy+T.h;A.f=[A.p[0],gy,A.p[2]];A.stepT=0;A.tel.why='got up'}}
    evaTrail(A,dt);return}
  // ---- standing / walking: the pendulum on the foot
  const w2=g/T.h,w=Math.sqrt(w2),cp=[A.p[0]+A.v[0]/w,A.f[1],A.p[2]+A.v[2]/w];A.tel.cp=cp;
  const moving=len(vd)>.02||Math.hypot(A.v[0],A.v[2])>.05,frW=len(vd)**2/(g*T.L);
  A.lope=frW>T.frLope||(A.lope&&frW>.8*T.frLope);
  // standing still, the ankle moves the centre of pressure toward the capture point, within the foot; walking, the
  // steps do the work and the pressure stays mid-foot
  const want=len(vd)>.02,off=[cp[0]-A.f[0],0,cp[2]-A.f[2]],ol=len(off);A.c=want?A.f.slice():add(A.f,ol>T.foot?mul(off,T.foot/ol):off);
  A.stepT+=dt;
  if(jumpNow){const vj=evaJumpV(T,g);if(vj>.05){A.st='air';A.v[1]=vj+dot([A.v[0],0,A.v[2]],evaSlope(A));A.hopTop=-1e9;A.tel.why=`jump: ${vj.toFixed(2)} m/s up`;evaTrail(A,dt);return}A.tel.why='too heavy to jump here'}
  // a step: on the period while moving, or at once when the capture point leaves the foot
  if((moving&&A.stepT>=A.stepP)||!want&&ol>T.foot*1.5&&A.stepT>.2*A.stepP){
    if(A.lope&&moving){A.st='air';A.v[1]=T.hopV+dot([A.v[0],0,A.v[2]],evaSlope(A));A.hopTop=-1e9;A.rec.steps++;evaTrail(A,dt);return}
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
    if(yT<yB-1e-4){A.st='air';A.hopTop=-1e9;A.p=[nx,A.p[1]+A.v[1]*dt,nz];evaTrail(A,dt);return}
    A.p=[nx,yT,nz];A.v[1]=dot([A.v[0],0,A.v[2]],evaSlope(A))}
  const lean=Math.hypot(A.p[0]-A.c[0],A.p[2]-A.c[2])/T.h;A.tel.lean=Math.atan(lean)*180/Math.PI;
  if(A.tel.lean>T.fallDeg)evaFall(A,'leaned past catching');else if(A.slipT>T.slipFall)evaFall(A,'slipped');
  evaTrail(A,dt)}
const evaSlope=A=>{const n=evaNormal(A.W,A.p[0],A.p[2]);return[-n[0]/n[1],0,-n[2]/n[1]]};
function evaFall(A,why){A.st='down';A.downT=0;A.slipT=0;A.rec.falls++;A.tel.why='fell: '+why;A.v[1]=0}
function evaPrint(A){A.sf^=1;A.feet[A.sf]=A.f.slice();A.prints.push([A.f[0],A.f[1],A.f[2],A.psi]);if(A.prints.length>400)A.prints.shift()}
function evaTrail(A,dt){const s=Math.hypot(A.v[0],A.v[2]);A.rec.dist+=s*dt;A.rec.vmax=Math.max(A.rec.vmax,s);
  const L=A.trail,q=L[L.length-1];if(!q||Math.hypot(q[0]-A.p[0],q[1]-A.p[1],q[2]-A.p[2])>.1){L.push(A.p.slice());if(L.length>1500)L.shift()}}
function evaRun(A,dt){A.acc=Math.min((A.acc||0)+dt,.25);while(A.acc>=EVA_DT){evaStep(A,EVA_DT);A.acc-=EVA_DT}}
const evaGait=A=>A.st==='down'?'down':A.st==='float'?'floating':A.st==='air'?(A.lope?'lope (in the air)':'in the air'):A.lope?'lope (on the ground)':Math.hypot(A.v[0],A.v[2])>.05||A.stepT<.3?'walk':'stand';

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
const EVA={TUNE:EVA_TUNE,DT:EVA_DT,new:evaNew,step:evaStep,run:evaRun,gait:evaGait,froude:evaFroude,walkV:evaWalkV,runV:evaRunV,stepP:evaStepP,
  jumpV:evaJumpV,escV:evaEscV,world:evaWorld,bodies:evaBodies,stations:EVA_STATIONS,ridges:EVA_RIDGES,courseH:evaCourseH,normal:evaNormal};
