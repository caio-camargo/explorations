'use strict';
// ==== SIM BEGIN — pure simulation, no DOM/GL. Extracted by test.mjs for headless checks.
const G0 = 9.80665, DT = 0.02;
const HOOK = { msg(){}, boom(){}, rebuild(){}, debris(){}, news(){}, save(){}, logged(){} };
const INP = { pitch:0, yaw:0, roll:0, tx:0, ty:0, tz:0 };   // tx/ty/tz: RCS translation, body axes

// ---- vectors / quaternions (plain arrays; doubles throughout)
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const madd=(a,b,s)=>[a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const norm=a=>{const l=len(a)||1;return[a[0]/l,a[1]/l,a[2]/l]};
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
function rotY(v,th){const c=Math.cos(th),s=Math.sin(th);return[c*v[0]+s*v[2],v[1],-s*v[0]+c*v[2]]}
const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qnorm=q=>{const l=Math.hypot(q[0],q[1],q[2],q[3]);return[q[0]/l,q[1]/l,q[2]/l,q[3]/l]};
const qconj=q=>[-q[0],-q[1],-q[2],q[3]];
const qaxis=(ax,an)=>{const s=Math.sin(an/2);return[ax[0]*s,ax[1]*s,ax[2]*s,Math.cos(an/2)]};
function qrot(q,v){const u=[q[0],q[1],q[2]],w=q[3],uv=cross(u,v),uuv=cross(u,uv);return[v[0]+2*(w*uv[0]+uuv[0]),v[1]+2*(w*uv[1]+uuv[1]),v[2]+2*(w*uv[2]+uuv[2])]}
function qFromBasis(X,Y,Z){const m00=X[0],m10=X[1],m20=X[2],m01=Y[0],m11=Y[1],m21=Y[2],m02=Z[0],m12=Z[1],m22=Z[2],tr=m00+m11+m22;let x,y,z,w,s;
  if(tr>0){s=Math.sqrt(tr+1)*2;w=.25*s;x=(m21-m12)/s;y=(m02-m20)/s;z=(m10-m01)/s}
  else if(m00>m11&&m00>m22){s=Math.sqrt(1+m00-m11-m22)*2;w=(m21-m12)/s;x=.25*s;y=(m01+m10)/s;z=(m02+m20)/s}
  else if(m11>m22){s=Math.sqrt(1+m11-m00-m22)*2;w=(m02-m20)/s;x=(m01+m10)/s;y=.25*s;z=(m12+m21)/s}
  else{s=Math.sqrt(1+m22-m00-m11)*2;w=(m10-m01)/s;x=(m02+m20)/s;y=(m12+m21)/s;z=.25*s}
  return qnorm([x,y,z,w])}
function qFromTo(a,b){const c=cross(a,b),d=dot(a,b);if(d<-0.999999){let ax=cross([1,0,0],a);if(len(ax)<1e-6)ax=cross([0,1,0],a);return qaxis(norm(ax),Math.PI)}return qnorm([c[0],c[1],c[2],1+d])}

// ---- the system: a tree of bodies. Inertial frame centred on the root (Tellus), spin axis +Y.
// Sized from a scale study (2026-10-07, see NOTES) and pegged to Earth rather than to any game planet: a fifth of Earth's
// radius (1,274 km, ~2.1× Kerbin), Earth's surface gravity (9.81), a day a third of Earth's (8 h), Earth-like air with
// its top at the Kármán line (100 km, scale height 7.5 km). Orbit costs ~4,200–4,350 m/s; low-orbit speed is 3.4 km/s.
const TELLUS={name:'Tellus',R:1.274e6,mu:9.81*1.274e6**2,rot:2*Math.PI/28800,atm:1e5,H:7500,rho0:1.225,th0:-Math.PI/3,soi:Infinity};
// Selene: the Moon's size relative to its planet (0.273 R), the Moon's surface gravity (1.62), a tenth of the Moon's distance
const SELENE={name:'Selene',R:3.48e5,mu:1.62*3.48e5**2,atm:0,pert:true,orb:{a:3.844e7,e:0,i:0,lan:0,argp:0,M0:2.0}};
// Nyx: a small captured moon on an inclined, eccentric orbit (8,100–27,900 km, 30°, 33 h), always inside Selene's orbit
// clear of its SOI. Its SOI breathes with its distance (407–1,401 km). Sized from an n-body study (NOTES, "Nyx").
const NYX={name:'Nyx',R:1.5e5,mu:0.4*1.5e5**2,atm:0,pert:true,orb:{a:1.8e7,e:0.55,i:30*Math.PI/180,lan:1.0,argp:0.8,M0:0.5}};
const BODIES=[],PERT_MIN=2e-6;   // PERT_MIN: see the third-body block below
// A moon's orbit about its parent: fixed Kepler elements (a, e, i, longitude of the node, argument of periapsis, mean
// anomaly at t=0). Angles are measured in this frame's equator (XZ) with +Y north, so prograde runs +X → −Z.
function addBody(b,parent){b.parent=parent||null;b.children=[];BODIES.push(b);if(!parent)return b;parent.children.push(b);
  const o=b.orb,cO=Math.cos(o.lan),sO=Math.sin(o.lan),cw=Math.cos(o.argp),sw=Math.sin(o.argp),ci=Math.cos(o.i),si=Math.sin(o.i);
  b.P=[cO*cw-sO*sw*ci,sw*si,-(sO*cw+cO*sw*ci)];b.Q=[-cO*sw-sO*cw*ci,cw*si,-(-sO*sw+cO*cw*ci)];
  b.a=o.a;b.n=Math.sqrt((parent.mu+(b.pert?b.mu:0))/o.a**3);   // a perturbing moon: the pair's relative orbit, consistent with its parent's reflex
  b.rMin=o.a*(1-o.e);b.rMax=o.a*(1+o.e);b.vMax=b.n*o.a*Math.sqrt((1+o.e)/(1-o.e));
  // SOI: the Laplace radius (m/M)^0.4 × distance. On an eccentric orbit it follows the distance (soiAt); b.soi is its
  // largest value, for conservative tests. soiRate bounds how fast it moves, for rails' step size.
  b.soiK=Math.pow(b.mu/parent.mu,0.4);b.soi=o.e?b.rMax*b.soiK:o.a*b.soiK;b.soiMin=o.e?b.rMin*b.soiK:b.soi;b.soiRate=o.e?b.soiK*b.vMax:0;return b}
addBody(TELLUS);addBody(SELENE,TELLUS);addBody(NYX,TELLUS);
// position and velocity of b relative to its parent at time t
// The moons run on program time: ORB_T0 is the program time at the flight's t = 0 (set at lift-off; a replayed tape keeps
// the one it was recorded with; 0 headless, which is the old fixed start). Tellus needs none: flights start on whole days.
let ORB_T0=0;const ORB_ABS=typeof document!=='undefined';
function bodyRel(b,t){const o=b.orb,e=o.e,M=b.n*(t+ORB_T0)+o.M0;let E=M;for(let k=0;k<30;k++){const d=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=d;if(Math.abs(d)<1e-15)break}
  const c=Math.cos(E),s=Math.sin(E),q=Math.sqrt(1-e*e),x=o.a*(c-e),y=o.a*q*s,k=b.n*o.a/(1-e*c),vx=-k*s,vy=k*q*c,P=b.P,Q=b.Q;
  return[[x*P[0]+y*Q[0],x*P[1]+y*Q[1],x*P[2]+y*Q[2]],[vx*P[0]+vy*Q[0],vx*P[1]+vy*Q[1],vx*P[2]+vy*Q[2]]]}
function moonPos(t){return bodyRel(SELENE,t)[0]}
function moonVel(t){return bodyRel(SELENE,t)[1]}
// absolute position (relative to the root); the root is the origin
// ---- third-body perturbations (open thread 6b). Near a moon with pert:true (Nyx, Selene) the craft feels both bodies: inside
// its SOI, the parent's tide (direct pull minus the pull on the moon); in the parent's frame, the moon's pull minus the
// parent's reflex toward it. Whether an orbit is perturbed is decided per orbit (pertNear, PERT_MIN = 2e-6 of the central
// pull), and on such an orbit the force is always on, so warp changes nothing but rounding. Low Tellus orbit feels Nyx's tide
// (~1e-5) and drifts metres a month; orbits that feel nothing keep the old exact Kepler rails. Each moon's relative orbit
// uses μ_parent + μ_moon, which is what makes the two frames agree; n-body integrations of that model match the game to under a
// km a day after a Nyx flyby, 10 m over a day in lunar orbit, ~5 km two days after a close Selene pass (NOTES, 6b).
const pthr=(b,r,ac)=>{const rl=len(r);return len(ac)*rl*rl>=PERT_MIN*b.mu};
function pertAcc(b,r,t,thr){let a=null;
  if(b.pert){const R=bodyRel(b,t)[0],y=add(r,R),yl=len(y),Rl=len(R);a=mul(add(mul(y,1/(yl*yl*yl)),mul(R,-1/(Rl*Rl*Rl))),-b.parent.mu)}
  for(const c of b.children)if(c.pert){const R=bodyRel(c,t)[0],d=sub(r,R),dl=len(d),rl=len(r),Rl=len(R),ac=mul(add(mul(d,1/(dl*dl*dl)),mul(R,1/(Rl*Rl*Rl))),-c.mu);
    if(!thr||pthr(b,r,ac))a=a?add(a,ac):ac}   // thr: physStep's pointwise test (physics runs in short spans)
  return a}
// Does this orbit (elements el about b) feel a moon? Decided per orbit, not per point: inside, the force is always on, so
// how the time is chopped (warp) changes nothing but rounding. An orbit well inside the moon's feels its tide, at most
// 2(m/M)(ap/(rMin−ap))³ of the parent's pull (with a margin); one reaching out toward or past the moon always counts.
const pertNear=(b,el)=>b.pert||b.children.some(c=>c.pert&&(el.ap>=c.rMin/2||2.4*c.mu/b.mu*(el.ap/(c.rMin-el.ap))**3>=PERT_MIN));
// Coasting step planner, shared by rails and the predictor: lim/sp is the old event limit (SOI edges, a floor radius, and
// now the edge of a perturbed region); pa the perturbation here (null: exact Kepler); hP the step cap when perturbed.
function coastPlan(b,r,v,t,el,floor){const rl=len(r),sp=len(v)+b.children.reduce((m,c)=>Math.max(m,c.vMax+c.soiRate),0)+(b.soiRate||0)+1;
  let lim=Infinity,pa=null,hP=Infinity;
  if(el.pe<floor)lim=rl-floor;
  for(const c of b.children)if(el.ap>c.rMin-c.soi&&el.pe<c.rMax+c.soi)lim=Math.min(lim,Math.abs(len(sub(r,bodyRel(c,t)[0]))-soiAt(c,t)));
  if(b.parent&&(el.e>=1||el.ap>b.soiMin))lim=Math.min(lim,Math.abs(soiAt(b,t)-rl));
  if(pertNear(b,el)){pa=pertAcc(b,r,t);
    if(pa){hP=2*Math.PI*Math.sqrt(rl*rl*rl/b.mu)/200;
      if(b.pert){const dP=len(add(r,bodyRel(b,t)[0]));hP=Math.min(hP,0.02*Math.sqrt(dP*dP*dP/b.parent.mu),Math.PI*2/b.n/400)}
      for(const c of b.children)if(c.pert){const dP=len(sub(r,bodyRel(c,t)[0]));hP=Math.min(hP,0.02*Math.sqrt(dP*dP*dP/c.mu),Math.PI*2/c.n/400)}}}
  return{lim,sp,pa,hP}}
// coast from (r,v,t) to t1 on b's rails (no SOI changes; stops at the ground)
function coastTo(b,r,v,t,t1){let g=0;while(t<t1-1e-9&&g++<200000){const{lim,sp,pa,hP}=coastPlan(b,r,v,t,elements(r,v,b.mu),b.R),h=Math.min(t1-t,Math.max(0.5,0.25*lim/sp),hP);
  [r,v]=coastStep(b,r,v,t,h,pa);t+=h;if(len(r)<b.R)break}return[r,v]}
// one coasting step: exact Kepler, or kick–drift–kick (Kepler drift about b, half kicks from the perturbation)
function coastStep(b,r,v,t,h,pa){if(!pa)return kepler(r,v,h,b.mu);
  [r,v]=kepler(r,madd(v,pa,h/2),h,b.mu);const pb=pertAcc(b,r,t+h);return[r,pb?madd(v,pb,h/2):v]}   // (pertAcc without a threshold: on for the whole orbit)
const soiAt=(b,t)=>b.orb&&b.orb.e?len(bodyRel(b,t)[0])*b.soiK:b.soi;
const bodyPos=(b,t)=>!b.parent?[0,0,0]:!b.parent.parent?bodyRel(b,t)[0]:add(bodyPos(b.parent,t),bodyRel(b,t)[0]);
// Selene is tidally locked (sats session, rovers R3): it turns once per orbit, keeping its near side (planet-fixed -X)
// toward Tellus. So a lunar day lasts an orbit (about 13 Tellus days), and Tellus stands still in the near side's sky.
SELENE.lock=true;
const lockTh=(b,t)=>{const p=bodyRel(b,t)[0];return Math.atan2(-p[2],p[0])};
const bodyTheta=(b,t)=>b===TELLUS?b.th0+b.rot*t:b.lock?lockTh(b,t):0;
const bodyOmega=b=>b===TELLUS?b.rot:b.lock?(b.lockW??(b.lockW=(()=>{const T=ORB_T0;ORB_T0=0;let d=lockTh(b,1)-lockTh(b,0);ORB_T0=T;return d-2*Math.PI*Math.round(d/(2*Math.PI))})())):0;
const surfVel=(b,r)=>{const w=bodyOmega(b);return[w*r[2],0,-w*r[0]]};   // ω×r with ω along +Y
const toPF=(b,v,t)=>rotY(v,-bodyTheta(b,t));
const fromPF=(b,v,t)=>rotY(v,bodyTheta(b,t));
const qBody=(b,t)=>qaxis([0,1,0],bodyTheta(b,t));
const density=(b,h)=>b.atm&&h<b.atm?b.rho0*Math.exp(-h/b.H):0;
const pressure=(b,h)=>b.atm&&h<b.atm?Math.exp(-h/b.H):0;
const physAlt=b=>b.atm?b.atm:5000;   // below this, coasting is simulated, not on rails

// ---- Kepler: universal-variable propagation (handles ellipse, parabola, hyperbola)
function stumpff(z){
  if(z>1e-4){const s=Math.sqrt(z);return[(1-Math.cos(s))/z,(s-Math.sin(s))/(s*s*s)]}
  if(z<-1e-4){const s=Math.sqrt(-z);return[(Math.cosh(s)-1)/(-z),(Math.sinh(s)-s)/(s*s*s)]}
  return[.5-z/24+z*z/720,1/6-z/120+z*z/5040]}
function kepler(r0v,v0v,dt,mu){
  if(dt===0)return[r0v.slice(),v0v.slice()];
  const r0=len(r0v),v2=dot(v0v,v0v),rv=dot(r0v,v0v),sm=Math.sqrt(mu),al=2/r0-v2/mu;
  if(al>1e-12){const P=2*Math.PI/Math.sqrt(mu*al*al*al);dt=dt%P}
  const F=x=>{const z=al*x*x,[C,S]=stumpff(z);return rv/sm*x*x*C+(1-al*r0)*x*x*x*S+r0*x-sm*dt};
  let x;
  if(al>1e-12)x=sm*dt*al;
  else if(al<-1e-12){const a=1/al,sg=Math.sign(dt);x=sg*Math.sqrt(-a)*Math.log((-2*mu*al*dt)/(rv+sg*Math.sqrt(-mu*a)*(1-r0*al)));if(!isFinite(x))x=sm*dt/r0}
  else x=sm*dt/r0;
  let ok=false;
  for(let i=0;i<60;i++){const z=al*x*x,[C,S]=stumpff(z);
    const f=rv/sm*x*x*C+(1-al*r0)*x*x*x*S+r0*x-sm*dt, df=rv/sm*x*(1-z*S)+(1-al*r0)*x*x*C+r0;
    const dx=f/df;x-=dx;if(!isFinite(x))break;if(Math.abs(dx)<1e-10*Math.max(1,Math.abs(x))){ok=true;break}}
  if(!ok){ // F is monotonic in x (dF/dx = r > 0): bracket and bisect
    let lo=0,hi=Math.sign(dt)*sm*Math.abs(dt)/r0||1;
    if(dt<0){[lo,hi]=[hi,0]}
    for(let k=0;k<200&&F(dt>0?hi:lo)*(dt>0?1:-1)<0;k++){if(dt>0)hi*=2;else lo*=2}
    for(let k=0;k<200;k++){const m=(lo+hi)/2;if(F(m)>0)hi=m;else lo=m}x=(lo+hi)/2}
  const z=al*x*x,[C,S]=stumpff(z);
  const f=1-x*x/r0*C,g=dt-x*x*x*S/sm;
  const r=[f*r0v[0]+g*v0v[0],f*r0v[1]+g*v0v[1],f*r0v[2]+g*v0v[2]],rl=len(r);
  const fd=sm/(rl*r0)*(al*x*x*x*S-x),gd=1-x*x/rl*C;
  return[r,[fd*r0v[0]+gd*v0v[0],fd*r0v[1]+gd*v0v[1],fd*r0v[2]+gd*v0v[2]]]}
function elements(r,v,mu){
  const h=cross(r,v),hl=len(h),rl=len(r),v2=dot(v,v);
  const ev=sub(mul(cross(v,h),1/mu),mul(r,1/rl)),e=len(ev);
  const a=-mu/(2*(v2/2-mu/rl)),p=hl*hl/mu;
  const P=e>1e-9?mul(ev,1/e):norm(r),Q=hl>1e-9?norm(cross(h,P)):[0,0,0];
  const nu=Math.atan2(dot(r,Q),dot(r,P));
  const n=Math.sqrt(mu/Math.abs(a*a*a));
  return{h,hl,e,a,p,P,Q,nu,n,pe:e<1?a*(1-e):p/(1+e),ap:a>0?2*a-(e<1?a*(1-e):p/(1+e)):Infinity,period:e<1?2*Math.PI/n:Infinity}}
function tPe(el,nu){const e=el.e;
  if(e<1){const E=2*Math.atan2(Math.sqrt(1-e)*Math.sin(nu/2),Math.sqrt(1+e)*Math.cos(nu/2));return(E-e*Math.sin(E))/el.n}
  const F=2*Math.atanh(Math.sqrt((e-1)/(e+1))*Math.tan(nu/2));return(e*Math.sinh(F)-F)/el.n}
function timeToNu(el,nu){let dt=tPe(el,nu)-tPe(el,el.nu);if(el.e<1)dt=((dt%el.period)+el.period)%el.period;return dt}
function timeToR(el,rt){const c=(el.p/rt-1)/el.e;if(!(c>=-1&&c<=1))return NaN;const dt=timeToNu(el,Math.acos(c));return dt>=0?dt:NaN}

