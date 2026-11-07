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
// the grip here: the world's μ times the ground's own share (loose soil holds less; W.grip, if any, gives it)
const evaMu=(W,x,z)=>W.mu*(W.grip?W.grip(x,z):1);
// the ground the body rides on: the ground averaged over a stride's width (0.3 m round), so that on rough ground the body
// doesn't bob over every pebble the feet step over (the feet stand on the ground itself)
const EVA_HBK=[[0,0],[.3,0],[.15,.26],[-.15,.26],[-.3,0],[-.15,-.26],[.15,-.26]];
const evaHB=(W,x,z)=>{let s=0;for(const[a,b]of EVA_HBK)s+=W.ground(x+a,z+b);return s/7};
const evaNormalB=(W,x,z)=>{const d=.15,hx=evaHB(W,x+d,z)-evaHB(W,x-d,z),hz=evaHB(W,x,z+d)-evaHB(W,x,z-d);return norm([-hx/(2*d),1,-hz/(2*d)])};
// a walker standing at (x, z), facing heading psi (radians: 0 faces +z, π/2 faces +x; turning right lowers psi)
const evaFw=psi=>[Math.sin(psi),0,Math.cos(psi)],evaRt=psi=>[-Math.cos(psi),0,Math.sin(psi)];
function evaNew(W,x,z,psi=0,T=EVA_TUNE){const gy=W.ground(x,z);
  return{T,W,p:[x,evaHB(W,x,z)+T.h,z],v:[0,0,0],psi,st:'stand',f:[x,gy,z],c:[x,gy,z],feet:[[x,gy,z],[x,gy,z]],tdT:0,toT:0,jumpK:'',dn:null,
    sf:0,stepT:0,stepP:1,lope:false,slipT:0,downT:0,t:0,in:{fwd:0,side:0,turn:0,hurry:false,jump:false,target:null},jumpWas:false,
    tel:{F:[0,0,0],cone:0,slip:false,cp:[x,gy,z],vd:[0,0,0],lean:0,why:''},
    rec:{dist:0,vmax:0,falls:0,steps:0,airT:0,hopH:0,top:0,escaped:false,slips:0,scram:0},prints:[],trail:[]}}
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
// The grade is read over a stride (1 m, on the body's smoothed ground): a stone's steep side is a foothold matter, not a
// slope to slow down for.
function evaSlopeV(A,g,dir){const T=A.T,W=A.W,at=k=>evaHB(W,A.p[0]+dir[0]*k,A.p[2]+dir[2]*k);let th=0;
  for(const k of[0,.5,1,1.5,2])th=Math.max(th,Math.atan(Math.abs(at(k+.5)-at(k-.5))));
  const room=Math.atan(.9*evaMu(A.W,A.p[0],A.p[2]))-th,vc=T.creep*evaWalkV(T,g);
  if(room<=0)return vc;const w=Math.sqrt(g/T.h),P=A.in.hurry?evaStanceP(T,g):evaStepP(T,g);return Math.max(vc,T.h*Math.tan(room)*w/Math.tanh(w*P/2))}
// Turning, it slows to what the grip can hold round the turn (v·ω within half of μg), as anyone does.
function evaWanted(A){const T=A.T,g=evaG(A.W),I=A.in,fw=evaFw(A.psi),rt=evaRt(A.psi),base=Math.min(I.hurry?evaRunV(T,g):evaWalkV(T,g),I.turn?.5*evaMu(A.W,A.p[0],A.p[2])*g/T.turn:Infinity);
  const spAlong=dir=>Math.min(base,evaSlopeV(A,g,dir));
  if(I.target){const d=[I.target[0]-A.p[0],0,I.target[1]-A.p[2]],dl=len(d);if(dl<.3){I.target=null;return[0,0,0]}const sp=spAlong(mul(d,1/dl));
    // slow down in time: the stopping distance at the friction's grip (half of it, to keep a margin)
    const vs=Math.min(sp,Math.sqrt(2*.5*evaMu(A.W,A.p[0],A.p[2])*g*Math.max(0,dl-.2)));return mul(d,vs/dl)}
  const w=add(mul(fw,I.fwd),mul(rt,I.side)),wl=len(w);return wl>1e-6?mul(w,spAlong(mul(w,1/wl))/Math.max(1,wl)):[0,0,0]}
// where the next foot goes: the deadbeat placement of the inverted pendulum (velocity v0 now, vd after a step of period P),
// d = (v0·cosh ωP − vd)/(ω sinh ωP), held within the leg's reach
// A walker asks a step only for the change of velocity its grip allows (70 % of μ less the slope, over the step), so it
// doesn't push itself into a slip; on ground steeper than the friction angle it can't change speed at all.
function evaPlaceAt(A,x,v,vd,P){const g=evaG(A.W),w=Math.sqrt(g/A.T.h),ch=Math.cosh(w*P),sh=w*Math.sinh(w*P),v0=[v[0],0,v[2]],n=evaNormal(A.W,x[0],x[2]);
  const mE=Math.max(.03,evaMu(A.W,x[0],x[2])-Math.hypot(n[0],n[2])/n[1]),dv=sub(vd,v0),dvl=len(dv),dm=.7*mE*g*P;if(dvl>dm)vd=add(v0,mul(dv,dm/dvl));
  // and no farther than leans the push past 85 % of the grip at the start of the step
  // (at least 0.15·h: on ground at the grip's edge a foot still goes out to catch the body, and slips: a slide, not a fall)
  let d=sh>1e-9?mul(sub(mul(v0,ch),vd),1/sh):[0,0,0];const dl=len(d),dM=Math.min(A.T.reach,Math.max(.15,.85*mE)*A.T.h);if(dl>dM)d=mul(d,dM/dl);
  return evaFoothold(A,x[0]+d[0],x[2]+d[2],v)}
// A foothold: where the step would land, unless that ground is steeper than the grip holds; then the flattest spot along
// the stride (back to under the body, on to the leg's reach, a hand's width either side) that a step can rise onto. A
// knee-high bank is a step onto its top, not a slope to slip on; a 2.5 m face stays a slope.
// no foot stands on a face steeper than 50° (a boulder's flank): the walker can slip its way up a 45° bank, not a rock
const EVA_FACE=50*Math.PI/180;
const evaSteep=(W,x,z)=>{const n=evaNormal(W,x,z);return Math.atan(Math.hypot(n[0],n[2])/n[1])};
// It looks only when the spot is past 95 % of the friction angle (a foot there would slip just standing): on a smooth
// slope under that, moving the foot to slightly flatter ground farther on would only brake the walk.
function evaFoothold(A,fx,fz,v){const W=A.W,T=A.T,y0=A.f[1],yL=y0,lim=(x,z)=>.8*Math.atan(evaMu(W,x,z)),g0=W.ground(fx,fz);
  if(evaSteep(W,fx,fz)<=.95*Math.atan(evaMu(W,fx,fz))&&g0-yL<=T.stepUp&&y0-g0<=T.stepDown)return[fx,g0,fz];
  const vh=[v[0],0,v[2]],vl=len(vh),dir=vl>.05?mul(vh,1/vl):evaFw(A.psi),rt=[-dir[2],0,dir[0]],ax=fx-A.p[0],az=fz-A.p[2],along=ax*dir[0]+az*dir[2];
  let best=null,bestH=null;
  for(let k=-.6;k<=T.reach+1e-9;k+=.05){const a=Math.max(-.1,along)+k;if(a<-.1||a>T.reach+.05)continue;
    for(const l of[0,-.1,.1]){const cx=A.p[0]+dir[0]*a+rt[0]*l,cz=A.p[2]+dir[2]*a+rt[2]*l,gy=W.ground(cx,cz),st=evaSteep(W,cx,cz);
      // (deeper than a step down is still a foothold, if nothing nearer is: stepping off a boulder is a drop)
      if(gy-yL>T.stepUp)continue;const sc=st+.4*Math.abs(a-along)+.2*Math.abs(l)+2*Math.max(0,y0-gy-T.stepDown);if(st<=lim(cx,cz)&&(!best||sc<best.sc))best={sc,p:[cx,gy,cz]};
      if(st<=EVA_FACE&&(!bestH||sc<bestH.sc))bestH={sc,p:[cx,gy,cz]}}}
  // nowhere flat enough: the nearest spot a step can reach (it will slip); nowhere low enough either: under the body; and if
  // that is up a face, the foot stays where it is
  if(best)return best.p;const s0=evaSteep(W,fx,fz);if(bestH&&(g0-yL>T.stepUp||s0>EVA_FACE))return bestH.p;if(g0-yL<=T.stepUp&&s0<=EVA_FACE)return[fx,g0,fz];
  const ux=A.p[0],uz=A.p[2],gu=W.ground(ux,uz);if(gu-y0<=T.stepUp&&evaSteep(W,ux,uz)<=EVA_FACE)return[ux,gu,uz];
  evaWallSlide(A,ux,uz);A.wallT=A.t;A.tel.why='a wall: too high to step up';return A.f.slice()}
// the nearest ground to the body a foot can stand on (not a face; within a step up or down of the planted foot), ≤ 0.6 m
function evaNearStand(A){const W=A.W,T=A.T,y0=A.f[1];
  for(let r=0;r<=.6;r+=.1)for(let i=0;i<(r?12:1);i++){const a=i*Math.PI/6,x=A.p[0]+r*Math.cos(a),z=A.p[2]+r*Math.sin(a),gy=W.ground(x,z);
    if(gy-y0<=T.stepUp&&y0-gy<=T.stepDown&&evaSteep(W,x,z)<=Math.atan(evaMu(W,x,z)))return[x,gy,z]}
  return null}
// against a wall: the part of the velocity into it goes (the rest slides along it); d: the ground's gradient there
function evaWallSlide(A,x,z){const W=A.W,d=.05,gx=W.ground(x+d,z)-W.ground(x-d,z),gz=W.ground(x,z+d)-W.ground(x,z-d),gl=Math.hypot(gx,gz);
  if(gl>1e-9){const ux=gx/gl,uz=gz/gl,vn=A.v[0]*ux+A.v[2]*uz;if(vn>0){A.v[0]-=vn*ux;A.v[2]-=vn*uz}}}
const evaPlace=(A,vd,P)=>evaPlaceAt(A,A.p,A.v,vd,P);
// Against a wall the pendulum would only put the next foot behind (it's standing still): instead the foot goes up onto the
// riser's top, the nearest flat spot ahead (0.2 m to the leg's reach) within a step up of the lower foot; none, no step up.
function evaStepUp(A,vd){const W=A.W,T=A.T,dir=mul(vd,1/len(vd)),yL=Math.min(A.f[1],A.feet[0][1],A.feet[1][1]);
  for(let a=.2;a<=T.reach+1e-9;a+=.05){const x=A.p[0]+dir[0]*a,z=A.p[2]+dir[2]*a,gy=W.ground(x,z);
    if(gy-yL>.05&&gy-yL<=T.stepUp&&evaSteep(W,x,z)<=.8*Math.atan(evaMu(W,x,z)))return[x,gy,z]}
  return null}
// Where and when the next foot comes down if the inputs hold ({f, t: seconds from now, still}), for drawing the swinging
// leg so it lands where the physics will put it: the pendulum carried to the step's end (or the flight to its landing),
// then the same placement.
function evaNext(A){const T=A.T,W=A.W,g=evaG(W),vd=A.tel.vd;if(g<1e-3||A.st==='down'||A.st==='float')return{f:A.f,t:0,still:true};
  const w=Math.sqrt(g/T.h),air=(x,v,vy)=>{let t=0;for(let i=0;i<3;i++){const gy=evaHB(W,x[0]+v[0]*t,x[2]+v[2]*t)+T.h,dy=x[1]-gy;t=(vy+Math.sqrt(Math.max(0,vy*vy+2*g*dy)))/g}return t};
  if(A.st==='air'){const t=air(A.p,A.v,A.v[1]),x=[A.p[0]+A.v[0]*t,0,A.p[2]+A.v[2]*t];return{f:evaPlaceAt(A,x,A.v,vd,A.lope?evaStanceP(T,g):evaStepP(T,g)),t}}
  const moving=len(vd)>.02||Math.hypot(A.v[0],A.v[2])>.05;if(!moving)return{f:A.f,t:Math.max(0,.5*evaStepP(T,g)-A.tdT),still:true};
  const tau=Math.max(0,A.stepP-A.stepT),e0=[A.p[0]-A.c[0],0,A.p[2]-A.c[2]],v=[A.v[0],0,A.v[2]],ch=Math.cosh(w*tau),sh=Math.sinh(w*tau);
  const x=add(A.c,add(mul(e0,ch),mul(v,sh/w))),vT=add(mul(e0,w*sh),mul(v,ch));
  if(A.lope&&!A.accel){const tf=air([x[0],A.p[1],x[2]],vT,T.hopV),xl=add(x,mul(vT,tf));return{f:evaPlaceAt(A,xl,vT,vd,evaStanceP(T,g)),t:tau+tf}}
  return{f:evaPlaceAt(A,x,vT,vd,A.accel?evaStanceP(T,g):evaStepP(T,g)),t:tau}}
function evaStep(A,dt=EVA_DT){const T=A.T,W=A.W,g=evaG(W),I=A.in;A.t+=dt;
  // turning: the keys turn; walking to a target, or sidestepping, faces the way it goes
  const vd=evaWanted(A);A.tel.vd=vd;
  if(A.st!=='down'){if(I.target&&len(vd)>.05){const want=Math.atan2(vd[0],vd[2]);let da=want-A.psi;da=Math.atan2(Math.sin(da),Math.cos(da));A.psi+=clamp(da,-T.turn*dt,T.turn*dt)}
    else A.psi-=I.turn*T.turn*dt}
  const jumpNow=I.jump&&!A.jumpWas;A.jumpWas=I.jump;
  if(g<1e-3&&A.st!=='air'){A.st='float';A.p=madd(A.p,A.v,dt);A.tel.why='0 g: nothing to push against (rails and tethers come with the 0 g hall)';return}
  if(A.st==='float')A.st='air';
  if(A.st==='air'){A.v[1]-=g*dt;
    // in flight too a rock face well over the feet (0.35 m over the soles, the legs hanging h under the body) stops the body
    // going into it: it slides along it, and drops
    {const fy=A.p[1]-T.h+.35,nx=A.p[0]+A.v[0]*dt,nz=A.p[2]+A.v[2]*dt;if(W.ground(nx,nz)>fy&&W.ground(nx,nz)>W.ground(A.p[0],A.p[2])&&evaSteep(W,nx,nz)>EVA_FACE){const d=.05,gx=W.ground(nx+d,nz)-W.ground(nx-d,nz),gz=W.ground(nx,nz+d)-W.ground(nx,nz-d),gl=Math.hypot(gx,gz);
      if(gl>1e-9){const ux=gx/gl,uz=gz/gl,vn=A.v[0]*ux+A.v[2]*uz;if(vn>0){A.v[0]-=vn*ux;A.v[2]-=vn*uz}}if(W.ground(A.p[0]+A.v[0]*dt,A.p[2]+A.v[2]*dt)>fy){A.v[0]=A.v[2]=0}}}
    A.p=madd(A.p,A.v,dt);A.rec.airT+=dt;A.rec.top=Math.max(A.rec.top,A.p[1]-evaHB(W,A.p[0],A.p[2])-T.h);
    if(!A.rec.escaped&&A.v[1]>evaEscV(W)){A.rec.escaped=true;A.tel.why='faster than escape speed: gone'}
    const gy=evaHB(W,A.p[0],A.p[2]);if(A.p[1]<=gy+T.h&&A.v[1]<=0){
      const n=evaNormal(W,A.p[0],A.p[2]),vin=-dot(A.v,n);A.rec.hopH=Math.max(A.rec.hopH,A.hopTop-gy||0);
      if(vin>T.landMax){const vh=[A.v[0],0,A.v[2]],vl=len(vh),dir=vl>.2?mul(vh,1/vl):evaFw(A.psi);A.p[1]=gy+T.h;evaFall(A,`came down at ${vin.toFixed(1)} m/s`,[A.p[0],gy,A.p[2]],dir,.3,vl*.6/T.h);return}
      // touchdown: the foot goes where the coming stance brings the wanted velocity; the vertical speed is absorbed
      A.p[1]=gy+T.h;A.v[1]=dot([A.v[0],0,A.v[2]],evaSlope(A));A.st='stand';A.stepT=0;A.stepP=A.lope?evaStanceP(T,g):evaStepP(T,g);A.f=evaPlace(A,vd,A.stepP);evaPrint(A)}
    else A.hopTop=Math.max(A.hopTop||-1e9,A.p[1]-T.h);
    evaTrail(A,dt);return}
  if(A.st==='down'){evaDown(A,dt);evaTrail(A,dt);return}
  if(A.scram&&evaScramble(A,vd,dt))return;
  // ---- standing / walking: the pendulum on the foot
  const w2=g/T.h,w=Math.sqrt(w2),cp=[A.p[0]+A.v[0]/w,A.f[1],A.p[2]+A.v[2]/w];A.tel.cp=cp;
  const moving=len(vd)>.02||Math.hypot(A.v[0],A.v[2])>.05,frW=len(vd)**2/(g*T.L);
  // the gait follows the faster of the wanted speed and the speed it has: a walk's slow steps can't catch a run
  const frN=Math.max(frW,(A.v[0]**2+A.v[2]**2)/(g*T.L));A.lope=frN>T.frLope||(A.lope&&frN>.8*T.frLope);
  // standing still, the ankle moves the centre of pressure toward the capture point, within the foot; walking, the
  // steps do the work and the pressure stays mid-foot
  // (the ankle uses only the grip the lean leaves: on a slope or after a long step it has little)
  const n0=evaNormal(W,A.f[0],A.f[2]),muF=evaMu(W,A.f[0],A.f[2]),mE0=Math.max(.03,muF-Math.hypot(n0[0],n0[2])/n0[1]),room=clamp(.9*mE0*T.h-Math.hypot(A.p[0]-A.f[0],A.p[2]-A.f[2]),0,T.foot);
  const want=len(vd)>.02,off=[cp[0]-A.f[0],0,cp[2]-A.f[2]],ol=len(off);A.c=want?A.f.slice():add(A.f,ol>room?mul(off,room/Math.max(ol,1e-9)):off);
  // setting off from standing (under 0.2 m/s), the ankle pushes: the pressure goes back toward the heel, the way it wants to go
  // (where the ground behind gives no foothold to lean off, this is what starts it)
  if(want&&Math.hypot(A.v[0],A.v[2])<.2){const vl=len(vd);A.c=sub(A.f,mul(vd,Math.min(room,T.foot)/vl))}
  A.stepT+=dt;A.tdT+=dt;
  if(jumpNow){const vj=evaJumpV(T,g);if(vj>.05){A.st='air';A.toT=A.t;A.jumpK='jump';A.v[1]=vj+dot([A.v[0],0,A.v[2]],evaSlope(A));A.hopTop=-1e9;A.tel.why=`jump: ${vj.toFixed(2)} m/s up`;evaTrail(A,dt);return}A.tel.why='too heavy to jump here'}
  // a step: on the period while moving, or at once when the capture point leaves the foot; and slowing down hard (0.5 m/s
  // or more under its speed), as soon as
  // the body passes over the foot (quick short steps, the foot always ahead: a long stance would let the pendulum speed it
  // up again past the foot), with no flight between
  const vh0=[A.v[0],0,A.v[2]],sp0=len(vh0),braking=sp0>.6&&dot(vd,vh0)/sp0<sp0-.5,passed=dot(sub(A.p,A.f),vh0)>0;
  // speeding up hard on Shift (wanting 0.3 m/s or a quarter more than it has), quick steps of a lope's contact
  // time with no flight between, starting now (a walk's long step, or the first step from standing, was a wait); not
  // against a wall or slipping (quick steps against a boulder climbed it)
  const vdl=len(vd);A.accel=want&&I.hurry&&vdl>sp0+Math.max(.3,.25*vdl)&&A.t-(A.wallT??-9)>1&&!A.tel.slip;if(A.accel)A.stepP=Math.min(A.stepP,Math.max(A.stepT,evaStanceP(T,g)));
  if((moving&&A.stepT>=A.stepP)||!want&&ol>T.foot*1.5&&A.stepT>.2*A.stepP||braking&&passed&&A.stepT>.12){
    if(A.lope&&moving&&!braking&&!A.accel){A.st='air';A.toT=A.t;A.jumpK='hop';A.v[1]=T.hopV+dot([A.v[0],0,A.v[2]],evaSlope(A));A.hopTop=-1e9;A.rec.steps++;evaTrail(A,dt);return}
    A.stepT=0;A.stepP=A.accel?evaStanceP(T,g):evaStepP(T,g);A.f=(A.t-(A.wallT??-9)<.5&&len(vd)>.02&&evaStepUp(A,vd))||evaPlace(A,vd,A.stepP);A.rec.steps++;evaPrint(A)}
  // the foot's force: the pendulum's push and the weight, inside the friction cone of the ground under the foot
  const ah=[w2*(A.p[0]-A.c[0]),0,w2*(A.p[2]-A.c[2])],n=evaNormal(W,A.f[0],A.f[2]);let F=mul([ah[0],g,ah[2]],T.m);
  const Fn=Math.max(0,dot(F,n)),Ft=sub(F,mul(n,dot(F,n))),ftl=len(Ft);A.tel.cone=Fn>0?ftl/(muF*Fn):Infinity;A.tel.slip=ftl>muF*Fn;
  if(A.tel.slip){F=add(mul(n,Fn),ftl>0?mul(Ft,muF*Fn/ftl):[0,0,0]);A.slipT+=dt;A.rec.slips+=dt}else A.slipT=Math.max(0,A.slipT-dt);
  // slipping on a bank too steep to stand on, pushing up it: down on hands and feet (evaScramble)
  if(A.tel.slip&&len(vd)>.02&&A.t-(A.scramOff??-9)>1&&evaScrambleOK(A,vd,A.f)&&[.25,.5,.75].every(k=>evaScrambleOK(A,vd,add(A.p,mul(vd,k/len(vd)))))){A.scram=true;A.tel.why='scrambling up on hands and feet'}
  A.tel.F=F;const a=add(mul(F,1/T.m),[0,-g,0]);
  // a slip moves the foot with the body; the pendulum leans on it otherwise
  A.v[0]+=a[0]*dt;A.v[2]+=a[2]*dt;
  // (a sliding foot goes with the body over the ground, up a bank too, scrabbling; but not up a rock's face, steeper than
  // 50°: there it's stopped, and so is the body, going into the rock)
  if(A.tel.slip){const fx=A.f[0]+A.v[0]*dt,fz=A.f[2]+A.v[2]*dt,gy=W.ground(fx,fz);if(gy<=A.f[1]+1e-4||evaSteep(W,fx,fz)<=EVA_FACE)A.f=[fx,gy,fz];else{evaWallSlide(A,fx,fz);A.wallT=A.t}}
  // The body can't pass over a face (steeper than 50°) above its feet (0.15 m over the higher foot): a riser no step
  // has gone up yet, a boulder too high to step on, is a wall (a bank, it scrabbles up, slipping). The body slides along it, as a hand on a rock steers you round it; the next
  // step looks for a foothold on top (evaStepUp).
  const maxF=Math.max(A.f[1],A.feet[0][1],A.feet[1][1]),wall=(x,z)=>{const gw=W.ground(x,z);return gw-W.ground(A.p[0],A.p[2])>.005&&gw-maxF>.15&&evaSteep(W,x,z)>EVA_FACE};
  let nx=A.p[0]+A.v[0]*dt,nz=A.p[2]+A.v[2]*dt,blocked=false;
  if(wall(nx,nz)){evaWallSlide(A,nx,nz);
    nx=A.p[0]+A.v[0]*dt;nz=A.p[2]+A.v[2]*dt;if(wall(nx,nz)){A.v[0]=A.v[2]=0;blocked=true}A.wallT=A.t;A.tel.why='a wall: too high to step up'}
  // the body rides the smoothed ground, but no higher than 0.35 m over its higher foot (the legs are only so long), and where
  // the ground under it is still low, 0.15 m (the smoothing reaches 0.3 m ahead: onto a rock no foot is on yet) and rises no faster than 1.5 m/s (a step up is the legs' work, not a jump)
  const hb=evaHB(W,nx,nz),cap=maxF+(W.ground(nx,nz)<=maxF+.15?.15:.35),capped=hb>cap,gy=capped?cap:hb;
  if(blocked){}
  else{const yT=Math.min(gy+T.h,A.p[1]+1.5*dt),tl=.1+dt,yArc=A.p[1]+A.v[1]*tl-.5*g*tl*tl,gA=evaHB(W,A.p[0]+A.v[0]*tl,A.p[2]+A.v[2]*tl)+T.h;
    // ground falling away faster than gravity can follow (a crest at speed, a ledge): off the ground. Judged 0.1 s ahead,
    // and only when the ground there is 3 cm under the arc the body would fly (a pebble's crest isn't a ledge)
    if(gA<yArc-.03){A.st='air';A.toT=A.t;A.jumpK='drop';A.hopTop=-1e9;A.p=[nx,A.p[1]+A.v[1]*dt,nz];evaTrail(A,dt);return}
    A.p=[nx,yT,nz];A.v[1]=capped?0:dot([A.v[0],0,A.v[2]],evaSlope(A))}
  const lean=Math.hypot(A.p[0]-A.c[0],A.p[2]-A.c[2])/T.h;A.tel.lean=Math.atan(lean)*180/Math.PI;
  // against a rock (a wall touched in the last half second) a lean past catching is braced with a hand: it stops, and the
  // foot goes to the nearest ground it can stand on, under the body if it can
  if(A.tel.lean>T.fallDeg&&A.t-(A.wallT??-9)<.5){const q=evaNearStand(A);if(q){A.v[0]=A.v[2]=0;A.f=q;A.c=q.slice();evaPrint(A);A.stepT=0;A.tel.why='braced on the rock'}else evaFall(A,'leaned past catching')}
  else if(A.tel.lean>T.fallDeg)evaFall(A,'leaned past catching');else if(A.slipT>T.slipFall&&Math.hypot(A.v[0],A.v[1],A.v[2])>T.slideFall)evaFall(A,'slid and fell');
  A.tel.slide=A.slipT>T.slipFall;
  evaTrail(A,dt)}
// Scrambling: up a bank steeper than the grip holds standing (95 % of the friction angle) and no steeper than a face
// (50°), the walker goes on hands and feet: slowly (0.3 m/s at 1 g, as √g lower), surely, no slipping back. Not physics,
// a gait: what a person does on a steep bank, and what keeps a bank from being a wall that holds or doesn't by luck. It
// stands again on ground it can stand on, or when the wish to climb stops.
function evaScrambleOK(A,vd,at){const W=A.W,n=evaNormal(W,at[0],at[2]),st=Math.atan(Math.hypot(n[0],n[2])/n[1]),up=[-n[0],0,-n[2]],ul=len(up);
  return st>.9*Math.atan(evaMu(W,at[0],at[2]))&&st<=EVA_FACE&&ul>1e-6&&dot(vd,up)/(len(vd)*ul)>.3}
function evaScramble(A,vd,dt){const T=A.T,W=A.W,g=evaG(W),vl=len(vd);
  const face=evaSteep(W,A.p[0]+vd[0]/vl*.3,A.p[2]+vd[2]/vl*.3)>EVA_FACE;if(face)A.wallT=A.t;
  if(vl<.02||face||!evaScrambleOK(A,vd,A.p)&&!evaScrambleOK(A,vd,add(A.p,mul(vd,.4/vl)))){A.scram=false;A.scramOff=A.t;const u=[A.p[0],W.ground(A.p[0],A.p[2]),A.p[2]];A.f=u;A.c=u.slice();A.feet=[u.slice(),u.slice()];A.p[1]=evaHB(W,u[0],u[2])+T.h;A.stepT=0;A.v=[0,0,0];return false}
  const sp=Math.min(vl,.3*Math.sqrt(g/9.81)),d=mul(vd,sp/vl),nx=A.p[0]+d[0]*dt,nz=A.p[2]+d[2]*dt;
  const yS=evaHB(W,nx,nz)+.75*T.h;A.v=[d[0],0,d[2]];A.p=[nx,A.p[1]+(yS-A.p[1])*Math.min(1,dt*4),nz];A.rec.scram+=dt;A.stepT+=dt;A.tdT+=dt;A.slipT=0;A.tel.slip=false;A.tel.slide=false;
  // a hand-and-foot move every ~0.6 s (as √(L/g)): the foot goes to just ahead of the body
  if(A.stepT>.6*Math.sqrt(9.81/Math.max(g,.5))*.55){A.stepT=0;const f=add(A.p,mul(vd,.15/vl));A.f=[f[0],W.ground(f[0],f[2]),f[2]];A.c=A.f.slice();A.rec.steps++;evaPrint(A)}
  A.tel.why='scrambling up on hands and feet';evaTrail(A,dt);return true}
const evaSlope=A=>{const n=evaNormalB(A.W,A.p[0],A.p[2]);return[-n[0]/n[1],0,-n[2]/n[1]]};
// A fall is the body toppling about its feet as an inverted pendulum, θ'' = (g/h)·sin θ, from the lean it had (slow in low
// g, as on Apollo 16), the feet sliding on as friction allows; then it lies and slides to rest; then it gets up (on hands
// and knees from a fall on its front, sitting up from one on its back) and stands facing the way its body lay.
const EVA_LIE=.2;   // m, the centre of mass over the ground lying down
function evaFall(A,why,piv,dir,th0,w0=0){const T=A.T;if(!piv){const e=[A.p[0]-A.c[0],0,A.p[2]-A.c[2]],el=len(e);piv=A.c.slice();dir=el>.02?mul(e,1/el):evaFw(A.psi);th0=Math.max(.15,Math.atan(el/T.h))}
  A.st='down';A.downT=0;A.slipT=0;A.rec.falls++;A.tel.why='fell: '+why;
  A.dn={ph:'topple',th:th0,w:w0,piv:piv.slice(),dir,face:dot(dir,evaFw(A.psi))>=0,vs:[A.v[0],0,A.v[2]],t:0};A.v[1]=0}
const evaThEnd=T=>Math.acos(clamp(EVA_LIE/T.h,0,1));
const evaRiseP=(T,g)=>clamp(1.6*Math.sqrt(9.81/Math.max(g,.3)),1.6,5);
function evaDown(A,dt){const T=A.T,W=A.W,g=evaG(W),D=A.dn,mu=evaMu(W,A.p[0],A.p[2]);D.t+=dt;
  const slide=v=>{const vl=len(v),dv=mu*g*dt;return vl>dv?mul(v,1-dv/vl):[0,0,0]};
  if(D.ph==='topple'){D.w+=g/T.h*Math.sin(D.th)*dt;D.th+=D.w*dt;D.vs=slide(D.vs);D.piv=madd(D.piv,D.vs,dt);D.piv[1]=W.ground(D.piv[0],D.piv[2]);
    const te=evaThEnd(T),th=Math.min(D.th,te),p=add(D.piv,add(mul(D.dir,T.h*Math.sin(th)),[0,T.h*Math.cos(th),0]));
    A.v=add(D.vs,add(mul(D.dir,T.h*D.w*Math.cos(th)),[0,-T.h*D.w*Math.sin(th),0]));A.p=p;if(D.th>=te){D.ph='lie';D.t=0;A.v=add(D.vs,mul(D.dir,.3*D.w*T.h));A.v[1]=0}return}
  if(D.ph==='lie'){const n=evaNormal(W,A.p[0],A.p[2]),gt=sub([0,-g,0],mul(n,-g*n[1])),vh=sub(A.v,mul(n,dot(A.v,n))),vl=len(vh);
    // lying: gravity along the slope, friction against the slide
    let a=gt;if(vl>1e-3)a=madd(a,vh,-Math.min(mu*g*n[1],vl/dt)/vl);else if(len(gt)<=mu*g*n[1])a=[0,0,0];
    A.v=madd(vh,a,dt);A.p=madd(A.p,A.v,dt);A.p[1]=evaHB(W,A.p[0],A.p[2])+EVA_LIE;
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
const evaGait=A=>A.st==='down'?'down':A.st==='float'?'floating':A.st==='air'?(A.lope?'lope (in the air)':'in the air'):A.scram?'scrambling (hands and feet)':A.tel.slide?'sliding on its feet':A.lope?'lope (on the ground)':Math.hypot(A.v[0],A.v[2])>.05||A.stepT<.3?'walk':'stand';

// ---- the course (EVA.md § 6a): the lab draws it and the headless twin walks it. E0a: the flat pad (a 50 m straight from
// the origin north along x = 0) and four ridges (5°, 10°, 20°, 30°) in lanes 5 m wide east of it, each rising north from
// z = 5 to 2.5 m, a 4 m top, and down again at the same angle; their sides fall at 45°.
const EVA_RIDGES=[5,10,20,30].map((a,i)=>({a,x:16+8*i}));
function evaRidgeH(r,x,z){const H=2.5,t=Math.tan(r.a*Math.PI/180),z1=5+H/t,z2=z1+4,z3=z2+H/t;if(z<5||z>z3)return 0;
  const along=Math.min(H,(z-5)*t,(z3-z)*t),side=(2.5+H-Math.abs(x-r.x))*1;return Math.max(0,Math.min(along,side))}
// E0b, rough ground, west of the straight (EVA.md § 6a; "being able to navigate uneven terrain is important", Caio
// 2026-11-06):
//  - the rubble lane, x −26…−8, z 0…44: hummocks all along (0.15 m over 2.5 m, 0.05 m over 0.8 m); from z 12 stones
//    (0.1–0.3 m, to step on or over); from z 26 boulders (0.3–1.3 m: the low ones a step up, the high ones walls to go round);
//  - a crater at (−36, 12): 7 m to the rim, the floor 1.2 m under the plain, the rim 0.8 m over it; its inner wall steepens
//    to 30° at the rim, the edge of the grip (it slips climbing out straight; slanting across is easier, as on the Moon);
//  - two 15° banks side by side from z 30, up to a 2 m top and down again: x −41…−36 loose soil (half the grip, so 15° is
//    near its limit: slow, slipping), x −36…−31 firm ground (as easy as the 10°–20° ridges). Same slope, different ground.
// The rocks are drawn from a fixed seed, so the lab and the headless twin walk the same field.
const EVA_ROCKS=(()=>{let a=531;const rnd=()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const out=[];for(let i=0;i<90;i++)out.push({x:-25+17*rnd(),z:12+14*rnd(),r:.15+.3*rnd(),H:.1+.2*rnd()});
  for(let i=0;i<15;i++){const H=.3+rnd();out.push({x:-25+17*rnd(),z:27+16*rnd(),r:.5+.7*rnd()+.3*H,H})}
  const B=new Map();for(const k of out)for(let i=Math.floor((k.x-k.r)/2);i<=Math.floor((k.x+k.r)/2);i++)for(let j=Math.floor((k.z-k.r)/2);j<=Math.floor((k.z+k.r)/2);j++){const c=i+','+j;if(!B.has(c))B.set(c,[]);B.get(c).push(k)}
  return{list:out,at:(x,z)=>B.get(Math.floor(x/2)+','+Math.floor(z/2))||[]}})();
// smooth value noise, fixed (the hummocks)
function evaNoise(x,z){const h=(i,j)=>{let n=Math.imul(i,374761393)+Math.imul(j,668265263)|0;n=Math.imul(n^n>>>13,1274126177);return((n^n>>>16)>>>0)/4294967296-.5};
  const i=Math.floor(x),j=Math.floor(z),u=x-i,v=z-j,su=u*u*(3-2*u),sv=v*v*(3-2*v);
  return h(i,j)*(1-su)*(1-sv)+h(i+1,j)*su*(1-sv)+h(i,j+1)*(1-su)*sv+h(i+1,j+1)*su*sv}
const EVA_LANE={x0:-26,x1:-8,z0:0,z1:44},EVA_CRATER={x:-36,z:12,R:7,D:1.2,rim:.8},EVA_BANKS={x0:-41,xm:-36,x1:-31,z0:30,a:15,H:2,top:8};
function evaRubbleH(x,z){const L=EVA_LANE;if(x<L.x0||x>L.x1||z<L.z0||z>L.z1)return 0;
  const e=Math.min(x-L.x0,L.x1-x,z-L.z0,L.z1-z),fade=e<1?e*e*(3-2*e):1;
  let h=.3*evaNoise(x/2.5,z/2.5)+.1*evaNoise(x/.8+17,z/.8+5);
  // a rock: blocky, steep sides (past 50° up to ~90 % of its height on the boulders) and a top rounded off by 30 % at
  // its edge: u = 1 − d/r, h = H·min(1, u/0.25)^0.3·(1 − 0.3(1 − u)²)
  let rk=0;for(const k of EVA_ROCKS.at(x,z)){const d=Math.hypot(x-k.x,z-k.z);if(d<k.r){const u=1-d/k.r;rk=Math.max(rk,k.H*Math.pow(Math.min(1,u/.25),.3)*(1-.3*(1-u)**2))}}
  return fade*h+rk}
function evaCraterH(x,z){const C=EVA_CRATER,r=Math.hypot(x-C.x,z-C.z);if(r>20)return 0;
  // the bowl: floor −D under the plain at the middle, rising as (r/R)² to the rim (+rim); outside, the rim falls away
  // over ~3 m (an ejecta apron), gone by 20 m
  if(r<C.R)return -C.D+(C.D+C.rim)*(r/C.R)**2;const t=(r-C.R)/3;return C.rim*Math.exp(-t*t)*Math.max(0,1-(r-C.R)/13)}
function evaBankH(x,z){const B=EVA_BANKS,t=Math.tan(B.a*Math.PI/180),z1=B.z0+B.H/t,z2=z1+B.top,z3=z2+B.H/t;if(z<B.z0||z>z3||x<B.x0-B.H||x>B.x1+B.H)return 0;
  const along=Math.min(B.H,(z-B.z0)*t,(z3-z)*t),side=Math.min(x-B.x0,B.x1-x)+B.H;return Math.max(0,Math.min(along,side))}
function evaCourseH(x,z){if(x<-6)return evaRubbleH(x,z)+evaCraterH(x,z)+evaBankH(x,z);let h=0;for(const r of EVA_RIDGES)if(Math.abs(x-r.x)<6)h=Math.max(h,evaRidgeH(r,x,z));return h}
// the ground's share of the grip: loose soil on the west bank holds half
function evaCourseGrip(x,z){const B=EVA_BANKS;return x<B.xm&&x>B.x0-B.H&&z>B.z0-.5&&z<B.z0+2*B.H/Math.tan(B.a*Math.PI/180)+B.top+.5?.5:1}
const EVA_STATIONS=[{k:'straight',name:'The straight (50 m)',x:0,z:-2,psi:0},
  ...EVA_RIDGES.map(r=>({k:'slope'+r.a,name:`Slope ${r.a}°`,x:r.x,z:1,psi:0})),
  {k:'rough',name:'Rubble lane (stones, then boulders)',x:-17,z:-1,psi:0},{k:'crater',name:'Crater (14 m across, 2 m deep)',x:-36,z:1,psi:0},
  {k:'loose',name:'15° bank, loose soil',x:-38.5,z:27,psi:0},{k:'firm',name:'15° bank, firm ground',x:-33.5,z:27,psi:0}];
// the gravities to try: every body in the game, from its own table
function evaBodies(){const out=[];
  if(typeof BODIES!=='undefined')for(const b of BODIES)out.push({name:b.name,g:b.mu/b.R**2,R:b.R});
  if(typeof SYSTEM_BODIES!=='undefined')for(const b of SYSTEM_BODIES)if(!out.some(o=>o.name===b.name))out.push({name:b.name,g:b.g,R:b.R,gas:b.g>20});
  return out}
function evaWorld(g=9.81,R=null,mu=.6){return{g,R,mu,ground:evaCourseH,grip:evaCourseGrip}}
// the lab's test of a fall: a push the way it faces (or the way it moves), as if it tripped
function evaKnock(A){if(A.st!=='stand')return;const vh=[A.v[0],0,A.v[2]],vl=len(vh),dir=vl>.1?mul(vh,1/vl):evaFw(A.psi);evaFall(A,'knocked over',[A.p[0]-dir[0]*.05,A.f[1],A.p[2]-dir[2]*.05],dir,.25,.3)}
const EVA={TUNE:EVA_TUNE,knock:evaKnock,DT:EVA_DT,LIE:EVA_LIE,thEnd:evaThEnd,next:evaNext,fw:evaFw,rt:evaRt,new:evaNew,step:evaStep,run:evaRun,gait:evaGait,froude:evaFroude,walkV:evaWalkV,runV:evaRunV,stepP:evaStepP,
  jumpV:evaJumpV,escV:evaEscV,world:evaWorld,bodies:evaBodies,stations:EVA_STATIONS,ridges:EVA_RIDGES,courseH:evaCourseH,normal:evaNormal,
  rocks:EVA_ROCKS.list,lane:EVA_LANE,crater:EVA_CRATER,banks:EVA_BANKS,mu:evaMu,hb:evaHB};
