// sim/flight.js — SOI changes, ground contact, abort, trajectory legs, maneuver nodes, impact prediction. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// Patched conics: leave the current body's SOI for its parent, or enter one of its moons'.
function soiSwitch(s,to,how){const from=s.body;s.body=to;s.hold=null;HOOK.msg(`${how} SOI`);
  // the nodes placed on the old body's leg are gone with it (untagged, or tagged with it and already past); those tagged
  // for this body or a later leg stay, a later return to the old body included (Q33)
  const keep=n=>n&&n.b&&(n.b!==from.name||n.t>simT);let drop=0;if(s.node&&!keep(s.node)){s.node=null;drop++}
  if(s.nodeQ){const k=s.nodeQ.filter(keep);drop+=s.nodeQ.length-k.length;s.nodeQ=k}if(!s.node&&s.nodeQ&&s.nodeQ.length)nodeNext(s);
  if(drop)HOOK.msg(`${how} SOI — ${drop>1?drop+' maneuver nodes':'maneuver node'} cleared${s.node?'; the next is up':''}`)}
function checkSOI(s){const b=s.body;
  if(b.parent&&len(s.r)>soiAt(b,simT)){const[p,v]=bodyRel(b,simT);s.r=add(s.r,p);s.v=add(s.v,v);soiSwitch(s,b.parent,`Escaping ${b.name}`);return}
  for(const c of b.children){const[p,v]=bodyRel(c,simT),d=sub(s.r,p);if(len(d)<soiAt(c,simT)){s.r=d;s.v=sub(s.v,v);soiSwitch(s,c,`Entering ${c.name}`);return}}}
// ---- ground contact (terrain session). The vessel meets the ground through contact points on its base: the foot of
// every part whose bottom is within 0.5 m of the lowest point (the core's base, side boosters' bases), 4 per part
// around its own axis. Each point pushes back with a spring-damper along the ground's normal (2 cm of static
// deflection at Earth gravity on every body, ζ 0.6) and drags with Coulomb friction (μ from the surface). Tipping,
// sliding and bouncing follow from those forces, which also load the joints like any other force. The speed verdict
// (surfaces, boulders) happens at the first touch; a vessel at rest for C_REST s is landed, pinned in the attitude it
// came to rest in; tilting past C_TOPPLE while touching is toppling. The sea is its own section below (Q274).
const C_DEFL=0.02,C_ZETA=0.6,C_REST=0.5,C_TOPPLE=1.05,C_GREF=9.81;
// Landing legs (vehicle session, Q31): a deployed leg is one point, at its foot; a stowed one lies on the skin and is none.
// The lowest point counts the feet too, so with legs down (their feet a metre below the rims) the stack stands on its feet.
const legFoot=p=>{const a=p.phi||0;return[p.pos[0]+p.d.reach*Math.cos(a),p.y0-p.d.drop,p.pos[2]+p.d.reach*Math.sin(a)]};
function footPoints(s){const key=s.parts.map(p=>p.on?(p.dep?2:1):0).join('');if(s.foot&&s.foot.key===key)return s.foot.pts;
  let yb=Infinity;for(const p of s.parts)if(p.on&&(p.d.kind!=='leg'||p.dep))yb=Math.min(yb,p.d.kind==='leg'?legFoot(p)[1]:p.y0);const pts=[];
  for(const p of s.parts){if(!p.on)continue;if(p.d.kind==='leg'){if(p.dep){const f=legFoot(p);if(f[1]<=yb+0.5)pts.push({p,pt:f})}continue}
    if(p.y0>yb+0.5)continue;const r=Math.max(p.d.r*0.95,0.05);
    for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;pts.push({p,pt:[p.pos[0]+r*Math.cos(a),p.y0,p.pos[2]+r*Math.sin(a)]})}}
  s.foot={key,pts:pts.slice(0,32)};return s.foot.pts}
// how fast it may drift sideways at touchdown and still stand (vehicle, Q264 / PLAYTEST #64): the feet stop, it pivots on
// the edge of its stance, and the swing (angular momentum m·v·h about that edge) must lift the centre of mass over it.
// h: centre of mass above the feet; b: the stance's half-width in its narrowest direction. The Hopper (5.8 m on its bell,
// h 2.7 m, b 0.42 m) tips past ~0.9 m/s, which the contact model reproduces (stands at 0.7, topples at 1.0)
function tipSpeed(s,g){const pts=footPoints(s);if(!pts.length)return Infinity;let yb=Infinity;for(const f of pts)yb=Math.min(yb,f.pt[1]);const h=s.cm[1]-yb;if(h<=0)return Infinity;
  let b=Infinity;for(let k=0;k<16;k++){const dx=Math.cos(k*Math.PI/8),dz=Math.sin(k*Math.PI/8);let m=-Infinity;for(const f of pts)m=Math.max(m,(f.pt[0]-s.cm[0])*dx+(f.pt[2]-s.cm[2])*dz);b=Math.min(b,m)}
  if(b<=0)return 0;const Ip=Math.min(s.I[0],s.I[2])+s.mass*(h*h+b*b);return Math.sqrt(2*g*(Math.hypot(b,h)-h)*Ip/s.mass)/h}
// the same with any legs down: what the construction screen quotes for the stack as built (Q264)
function standSpeed(s,g){const L=s.parts.filter(p=>p.on&&p.d.kind==='leg'&&!p.dep);for(const p of L)p.dep=true;s.foot=null;const v=tipSpeed(s,g);for(const p of L)p.dep=false;s.foot=null;return v}
// a lost vessel keeps its cause (Q264): s.lossWhy, a clause for the Debrief's outcome and the message that stays on screen
function lose(s,why,boom){s.alive=false;s.lossWhy=why;if(boom)HOOK.boom(s.body,s.r,simT,boom);logEv('loss',why);HOOK.msg(why[0].toUpperCase()+why.slice(1))}
// legs down (op 'down') or up ('up'): instant for now (the look beat can animate the swing); returns how many moved
function legOp(s,op){const dn=op==='down';let n=0;for(const p of s.parts)if(p.on&&p.d.kind==='leg'&&!!p.dep!==dn){p.dep=dn;n++}
  if(n){s.foot=null;HOOK.rebuild();HOOK.msg(dn?'Legs down':'Legs up')}return n}
const legsDown=s=>s.parts.some(p=>p.on&&p.d.kind==='leg'&&p.dep);
// a procedure puts the legs down by itself (vehicle, Q121): descending within 1.5 km of the ground
function autoLegs(s){if(!s.proc||s.landed||!s.alive||!s.parts.some(p=>p.on&&p.d.kind==='leg'&&!p.dep))return;
  if(dot(sub(s.v,surfVel(s.body,s.r)),norm(s.r))<0&&aglAt(s.body,s.r,simT)<1500)legOp(s,'down')}
// the ground's upward normal at a planet-fixed point, in the inertial frame (finite differences over ±1 m)
function groundNormal(b,pf){if(!b.ground)return norm(fromPF(b,pf,simT));const u=norm(pf),f=siteFrame(u),d=1/b.R,h0=groundAlt(b,u);
  const he=groundAlt(b,norm(add(u,mul(f.e,d)))),hn=groundAlt(b,norm(add(u,mul(f.n,d))));
  return norm(fromPF(b,norm(sub(u,add(mul(f.e,(he-h0)/b.R/d),mul(f.n,(hn-h0)/b.R/d)))),simT))}
// the touchdown verdict at first contact, judged under the vessel's centre (the base spans more than one boulder cell):
// the ground forgives TOUCH_MAX + its softness; boulders or trees add to the speed
function touchdown(s){const b=s.body,pfC=toPF(b,s.r,simT),vS=sub(s.v,surfVel(b,s.r)),sp=len(vS),up=norm(s.r),su=surfaceAt(b,pfC),hit=surfaceHit(su,pfC,b),vE=sp+hit,lim=TOUCH_MAX+su.soft;
  s.landSurface={name:su.name,id:su.id??null,hit};s.touchV=sp;s.touchHit=hit;s.restT=0;
  s.touchDrift=len(sub(vS,mul(up,dot(vS,up))));s.touchTilt=Math.acos(clamp(dot(qrot(s.q,[0,1,0]),up),-1,1));   // for a topple's cause
  logEv('contact',`touchdown on ${b.name} (${su.name}) at ${sp.toFixed(1)} m/s, limit ${lim.toFixed(1)}${hit?` (−${hit.toFixed(1)} for ${su.id===8||su.id===5||su.id===3?'trees':'boulders'})`:''}`);
  const among=hit?`, among ${su.id===8||su.id===5||su.id===3?'trees':'boulders'}`:'';
  if(vE>=lim){s.crashSpeed=sp;lose(s,`destroyed: hit ${b.name} (${su.name}) at ${sp.toFixed(0)} m/s${among}, over the ${lim.toFixed(0)} m/s it can take`,3);return false}
  return true}
function groundContact(s,dt){const b=s.body;
  if(s.landed||!s.alive||len(s.r)-b.R>bodyTop(b)+s.len+50||aglAt(b,s.r,simT)>s.len+20){s.inContact=false;return}
  const pts=footPoints(s),n=pts.length,mPer=s.mass/n,k=mPer*C_GREF/C_DEFL,c=2*C_ZETA*Math.sqrt(k*mPer),qi=qconj(s.q);let any=false;
  for(const fp of pts){const rb=sub(fp.pt,s.cm),rw=qrot(s.q,rb),P=add(s.r,rw),pf=toPF(b,P,simT),gA=groundAlt(b,pf),pen=b.R+gA-len(P);
    if(pen<=0){fp.a=null;continue}if(seaAt(b,pf))continue;   // over the sea: splashdown (groundCheck)
    if(!s.inContact){if(!touchdown(s))return;s.inContact=true}
    any=true;const su=surfaceAt(b,pf),nW=groundNormal(b,pf),vP=add(sub(s.v,surfVel(b,P)),cross(s.w,rw)),vn=dot(vP,nW);
    const nb=qrot(qi,nW),cn=cross(rb,nb),mN=1/(n*(1/s.mass+cn[0]*cn[0]/s.I[0]+cn[1]*cn[1]/s.I[1]+cn[2]*cn[2]/s.I[2]));   // its effective mass along the normal
    // the spring and damper are capped by it (vehicle, Q31): legs put points ~2 m off a light lander's axis, where a quarter of the
    // mass is ~8× too much, and the damper then overshot every step (the lander chattered until it toppled on the flat). The caps
    // are halved because the normal and the friction forces below a tall stack push on the same pitch: each alone at full gain
    // was stable, together they rang at two steps' period.
    const Fn=Math.max(0,Math.min(k,0.5*mN/(dt*dt))*pen-Math.min(c,0.5*mN/dt)*vn),vt=sub(vP,mul(nW,vn));let Fw=mul(nW,Fn);
    // friction (vehicle, Q31): a tangential spring to where the point first touched (stiction: it holds on a slope instead of
    // creeping, which a velocity-only cap can't do), plus a damper; both capped by the point's effective mass along the slip,
    // rotation included. Past μ·Fn the point slides and its anchor follows, so a slide is Coulomb as before.
    if(!fp.a)fp.a=pf;let d=sub(P,fromPF(b,fp.a,simT));d=sub(d,mul(nW,dot(d,nW)));const dl=len(d),vtl=len(vt);
    const u=dl>1e-9?mul(d,1/dl):vtl>1e-9?mul(vt,1/vtl):null;
    if(u){const cc=cross(rb,qrot(qi,u)),mT=1/(n*(1/s.mass+cc[0]*cc[0]/s.I[0]+cc[1]*cc[1]/s.I[1]+cc[2]*cc[2]/s.I[2])),kt=Math.min(k,0.25*mT/(dt*dt)),ct=Math.min(c,0.5*mT/dt);
      let Ft=add(mul(d,-kt),mul(vt,-ct));const fl=len(Ft),cap=su.mu*Fn;
      if(fl>cap){Ft=mul(Ft,cap/fl);if(dl>1e-9)fp.a=toPF(b,sub(P,mul(d,Math.min(1,cap/(kt*dl)))),simT)}
      Fw=add(Fw,Ft)}
    const fb=qrot(qi,Fw);addF(fp.p,fb[0],fb[1],fb[2],fp.pt[0],fp.pt[1],fp.pt[2])}
  if(any)s.touchT=simT}
// after each step: the nose in the ground, toppling, coming to rest; and splashdowns (seaCheck)
function groundCheck(s){
  const b=s.body,Y=qrot(s.q,[0,1,0]);if(s.landed||!s.alive||len(s.r)-b.R>bodyTop(b)+s.len)return;   // well above the highest ground: nothing to hit
  const pT=madd(s.r,Y,s.yTop),hT=len(pT)-groundR(b,toPF(b,pT,simT)),up=norm(s.r),tilt=Math.acos(clamp(dot(Y,up),-1,1)),pf0=toPF(b,s.r,simT);
  if(seaAt(b,pf0)){seaCheck(s);return}   // the sea: a fluid since Q274 (seaForces pushes; seaCheck judges the splash, the rest and a sinking)
  if(hT<0){const sp=len(sub(s.v,surfVel(b,s.r)));s.crashSpeed=sp;lose(s,`destroyed: the nose hit ${b.name} at ${sp.toFixed(0)} m/s`,3);return}
  if(!s.inContact)return;
  if(tilt>C_TOPPLE){s.crashSpeed=len(sub(s.v,surfVel(b,s.r)));lose(s,toppleWhy(s,pf0),2);return}
  const vr=len(sub(s.v,surfVel(b,s.r))),wr=len(sub(s.w,[0,bodyOmega(b),0]));
  if(vr<0.15&&wr<0.03&&!(s.thrust>0)){s.restT=(s.restT||0)+DT}else s.restT=0;   // not while the engines push (a slow liftoff is not a landing)
  if(s.restT>=C_REST){s.landed=true;s.inContact=false;s.water=false;s.pf=toPF(b,s.r,simT);s.qLocal=qmul(qconj(qBody(b,simT)),s.q);syncLanded(s);s.landedAt=simT;
    const ls=s.landSurface||{name:'?',hit:0};HOOK.msg(`Landed on ${b.name} (${ls.name}) at ${s.touchV.toFixed(1)} m/s${ls.hit?`, among ${ls.id===8||ls.id===5||ls.id===3?'trees':'boulders'} (like ${(s.touchV+ls.hit).toFixed(1)} m/s)`:''}${tilt>0.05?`, leaning ${(tilt*57.3).toFixed(0)}°`:''}`)}}
// why it fell over (Q264): the drift or the lean it came down with, against what this stack can stand; legs if it has none
function toppleWhy(s,pf0){const b=s.body,su=s.landSurface||{name:'the ground'},sl=terrainSlope(b,pf0),vt=tipSpeed(s,b.mu/(b.R*b.R)),dr=s.touchDrift||0,ti=(s.touchTilt||0)*57.3;
  const how=dr>0.6*vt?`it touched down drifting ${dr.toFixed(1)} m/s sideways, and it tips over past ${vt.toFixed(1)} m/s`
    :ti>3?`it touched down leaning ${ti.toFixed(0)}° at ${(s.touchV||0).toFixed(1)} m/s`:sl>0.03?'':`it came down at ${(s.touchV||0).toFixed(1)} m/s, drifting ${dr.toFixed(1)} sideways`;
  const legs=!s.parts.some(p=>p.on&&p.d.kind==='leg'&&p.dep)&&vt<2?'; landing legs widen its stance':'';
  return`toppled over on ${sl>0.03?`a ${(sl*57.3).toFixed(0)}° slope of `:''}${su.name}${how?`: ${how}`:''}${legs}`}
// ---- the sea (world session, Q274; NOTES § v1.122). Water is a fluid. Every stack line's outer profile (s.lines, the
// aero's) is cut into slices up to SEA_DY tall; each slice is a disc sampled at SEA_N points on the ring of radius r/√2,
// which keeps the disc's waterplane moment, so the righting moment comes out right. A point under the water pushes up
// with ρ·g times its share of the volume (smoothed over its own vertical extent, so the force doesn't step) and drags
// against the water: quadratic, plus a linear term standing for the waves it makes, capped like the ground's contact.
// An engine is an open bell: SEA_KEEP of its outline holds air. A capsule's flotation bags (d.float m³ on top, Apollo's
// uprighting bags) inflate at splashdown. At rest the vessel is afloat: landed, s.water, riding a kinematic swell and
// drifting with the wind (seaPose), until its parts flood one by one (SEA_FLOOD hours): sinkAt is when what stays dry
// can no longer hold it up. Sinking while still moving (too dense even fully under) is judged at once. The liquid's
// density is the body's (a recipe's rho: Tethys's methane, 450 kg/m³), else sea water's.
const RHO_SEA=1025,SEA_DY=0.5,SEA_N=8,SEA_CD=0.5,SEA_LIN=500,SEA_REST=2,SEA_SWELL=0.8,SEA_SWELL_T=8,SEA_DRIFT=0.25;
const SEA_KEEP={engine:0.35},SEA_FLOOD={engine:0,dec:2,adapt:6,tank:24,pod:72,bio:72,sci:24,core:24};   // hours; others 12
const seaFloodH=p=>SEA_FLOOD[p.d.kind]??12,seaRho=b=>b.ground&&b.ground.rho||RHO_SEA;
// the sample points, cached per shape: {pts:[{p,b,V,dy,w}], V (whole hull, m³), byPart (m³ per part)}
function seaPts(s){if(s.seaP&&s.seaP.lines===s.lines&&s.seaP.bags===!!s.bags)return s.seaP;const pts=[],byPart=new Map();let V=0;
  const put=(p,v)=>{byPart.set(p,(byPart.get(p)||0)+v);V+=v};
  for(const ln of s.lines)for(const e of ln.E){const dy=e.y1-e.y0;if(dy<=1e-6)continue;const k=SEA_KEEP[e.p.d.kind]??1,n=Math.ceil(dy/SEA_DY),h=dy/n;
    for(let i=0;i<n;i++){const ra=e.r0+(e.r1-e.r0)*i/n,rb=e.r0+(e.r1-e.r0)*(i+1)/n,v=Math.PI/3*h*(ra*ra+ra*rb+rb*rb)*k,rm=(ra+rb)/2,y=e.y0+h*(i+.5);
      if(v<=0)continue;put(e.p,v);for(let j=0;j<SEA_N;j++){const a=(j+.5)/SEA_N*2*Math.PI;pts.push({p:e.p,b:[ln.ox+rm*Math.SQRT1_2*Math.cos(a),y,ln.oz+rm*Math.SQRT1_2*Math.sin(a)],V:v/SEA_N,dy:h,w:rm})}}}
  if(s.bags)for(const p of s.parts)if(p.on&&p.d.float){const r=p.d.r*0.7,y=p.y0+p.h+0.35;put(p,p.d.float);
    for(let j=0;j<4;j++){const a=j*Math.PI/2;pts.push({p,b:[p.pos[0]+r*Math.cos(a),y,p.pos[2]+r*Math.sin(a)],V:p.d.float/4,dy:0.7,w:0.4})}}
  s.seaP={lines:s.lines,bags:!!s.bags,pts,V,byPart};return s.seaP}
// in the step, before integrating: buoyancy and the water's drag on every point under the (flat) sea
function seaForces(s,dt){const b=s.body;s.seaSub=0;if(!s.landed&&s.float)s.float=null;
  if(s.landed||!s.alive||!b.ground||b.ground.sea==null)return;
  const h=len(s.r)-b.R-b.ground.sea;if(h>s.len+5||!seaAt(b,toPF(b,s.r,simT)))return;
  const qi=qconj(s.q),up=qrot(qi,norm(s.r)),g=b.mu/dot(s.r,s.r),c=s.cm,P=seaPts(s),vB=qrot(qi,sub(s.v,surfVel(b,s.r))),wB=qrot(qi,s.w),
    ca=Math.abs(up[1]),sa=Math.sqrt(Math.max(0,1-ca*ca)),rho=seaRho(b),cap=0.3*s.mass/Math.max(1,s.seaN||1)/dt;let V=0,n=0;
  for(const pt of P.pts){const rx=pt.b[0]-c[0],ry=pt.b[1]-c[1],rz=pt.b[2]-c[2],z=h+rx*up[0]+ry*up[1]+rz*up[2],e=0.5*(pt.dy*ca+pt.w*sa)+0.02,f=clamp(0.5-z/(2*e),0,1);
    if(f<=0)continue;const v=pt.V*f;V+=v;n++;const Fb=rho*g*v;
    const vx=vB[0]+wB[1]*rz-wB[2]*ry,vy=vB[1]+wB[2]*rx-wB[0]*rz,vz=vB[2]+wB[0]*ry-wB[1]*rx,sp=Math.hypot(vx,vy,vz),kd=Math.min(cap,0.5*rho*SEA_CD*Math.cbrt(v*v)*sp+SEA_LIN*v);
    addF(pt.p,up[0]*Fb-kd*vx,up[1]*Fb-kd*vy,up[2]*Fb-kd*vz,pt.b[0],pt.b[1],pt.b[2])}
  s.seaSub=V;s.seaN=n}
// after the step, over the sea: the splash (the touchdown verdict, bags out, the main chute cut), then rest or sinking
function seaCheck(s){const b=s.body;
  if(!(s.seaSub>0))return;
  if(!s.wet){if(!touchdown(s))return;s.wet=true;s.restT=0;
    if(s.parts.some(p=>p.on&&p.d.float)){s.bags=true;s.seaP=null}
    if(s.chute){s.chute=false;s.chuteA=0}
    const P=seaPts(s);logEv('contact',`splashdown at ${s.touchV.toFixed(1)} m/s; the hull holds up ${(P.V*seaRho(b)/1000).toFixed(2)} t, the vessel is ${(s.mass/1000).toFixed(2)} t`);
    HOOK.msg(`Splashdown at ${s.touchV.toFixed(1)} m/s`);return}
  if(s.seaSub>=0.97*seaPts(s).V&&seaRho(b)*s.seaSub<s.mass&&len(s.r)-b.R-b.ground.sea<-s.len){seaSink(s,'went straight to the bottom');return}
  const vr=len(sub(s.v,surfVel(b,s.r))),wr=len(sub(s.w,[0,bodyOmega(b),0]));
  if(vr<0.3&&wr<0.05&&!(s.thrust>0))s.restT=(s.restT||0)+DT;else s.restT=0;
  if(s.restT>=SEA_REST)afloat(s)}
function seaSink(s,how){s.alive=false;s.sunk=true;s.crashSpeed=0;s.float=null;s.lossWhy=`sank: ${how}`;logEv('contact',`sank: ${how}`);HOOK.msg(`Sank — ${how}`)}
// how long after coming to rest the parts that stay dry longest can no longer hold the vessel up (s), or Infinity
function sinkTime(s){const P=seaPts(s),ps=[...P.byPart.entries()].map(([p,v])=>({v,h:seaFloodH(p)})).sort((a,b)=>a.h-b.h);let V=P.V;
  for(const x of ps){V-=x.v;if(seaRho(s.body)*V<s.mass)return x.h*3600}return Infinity}
function afloat(s){const b=s.body,Y=qrot(s.q,[0,1,0]),up=norm(s.r),tilt=Math.acos(clamp(dot(Y,up),-1,1)),T=sinkTime(s),P=seaPts(s);
  s.landed=true;s.water=true;s.inContact=false;s.wet=false;s.pf=toPF(b,s.r,simT);s.qLocal=qmul(qconj(qBody(b,simT)),s.q);
  const az=(Math.sin(s.pf[0]*1e-3+s.pf[2]*7e-4)*0.5+0.5)*2*Math.PI;   // the wind's heading here, steady per spot (tapes replay)
  s.float={pf:s.pf.slice(),q:s.qLocal.slice(),t:simT,az,sinkAt:simT+T,dry:1-s.seaSub/P.V,tilt};s.landedAt=simT;syncLanded(s);
  const att=tilt<0.35?'upright':tilt>2.8?'upside down':`on its side (${(tilt*57.3).toFixed(0)}°)`;
  logEv('contact',`afloat ${att}, ${(s.float.dry*100).toFixed(0)} % of the hull above the water; ${isFinite(T)?`floods in ${(T/3600).toFixed(0)} h`:'stays afloat'}`);
  HOOK.msg(`Afloat on ${b.name}'s sea, ${att}, splashdown ${s.touchV.toFixed(1)} m/s${isFinite(T)?` — sinks in ~${(T/3600).toFixed(0)} h`:''}`)}
// the afloat pose: the rest pose, heaving on two crossing swells, rocking with their slope (less for a long hull) and
// drifting downwind; it sinks at sinkAt. Called from syncLanded, so it holds on rails and at warp.
function seaPose(s){const F=s.float,b=s.body,t=simT-F.t;if(simT>=F.sinkAt){seaSink(s,'flooded and went down');return}
  const ramp=Math.min(1,t/20),w1=2*Math.PI/SEA_SWELL_T,w2=w1*1.37,k=w1*w1/9.81,A=SEA_SWELL*ramp,rock=Math.min(1,8/Math.max(s.len,1));
  const u0=norm(F.pf),f=siteFrame(u0),dir=add(mul(f.e,Math.sin(F.az)),mul(f.n,Math.cos(F.az)));
  const heave=A*(0.6*Math.sin(w1*t)+0.4*Math.sin(w2*t+1.3)),u=norm(add(u0,mul(dir,SEA_DRIFT*t/b.R)));
  s.pf=mul(u,len(F.pf)+heave);
  const pe=A*k*rock*0.6*Math.cos(w1*t),pn=A*k*rock*0.4*Math.cos(w2*t+1.3);   // the wave slopes: rocking about the local north and east
  s.qLocal=qmul(qmul(qaxis(f.n,pe),qaxis(f.e,pn)),F.q)}
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
  logEv('stage',`event ${s.evIdx}: ${ev.decouple.length} group(s) dropped, ${ev.ignite.filter(k=>s.segs[k].ignited).length} of ${ev.ignite.length} lit; ${(len(s.r)-s.body.R)/1000|0} km, ${len(sub(s.v,surfVel(s.body,s.r))).toFixed(0)} m/s`);
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
    if(h<bodyTop(b)&&h<groundAlt(b,toPF(b,d.r,simT))){HOOK.boom(b,d.r,simT,1);d.dead=true}
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
  if(!n.burning&&n.b&&n.b!==s.body.name){const legs=predictFrom({b:s.body,r:s.r,v:s.v,t:simT}),x=legState(legs,n.t);if(!x)return null;   // past an SOI change (Q33)
    const[b,r,v]=x,f=nodeFrame(r,v),dvW=add(add(mul(f.pro,n.dv[0]),mul(f.nrm,n.dv[1])),mul(f.rad,n.dv[2]));return{rem:dvW,dvW,rN:r,vN:v,t:n.t,b,f}}
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
  if(dot(rem,n.dvW)<=0||len(rem)<0.1){s.node=null;s.throttle=0;nodeNext(s);HOOK.msg(s.node?'Maneuver complete — throttle cut; next node is up':'Maneuver complete — throttle cut')}}
// ---- node chains (vehicle session, Q33). s.node is the node being flown (as before); s.nodeQ holds the ones after it, in
// time order. Each node carries the body whose leg it sits on (b, a name; none means the vessel's body when it was placed),
// so a capture burn can be planned before the encounter: the SOI switch keeps the nodes for the new body and drops the old
// body's. nodePlan chains them: coast along the patched-conic legs (predictFrom) to each node, add its Δv in that node's
// frame, carry on from there. The map's dashed plan starts where the last node leaves the craft (nodePlanEnd).
const nodeBody=(s,n)=>n.b?BODIES.find(x=>x.name===n.b)||s.body:s.body;
function nodeNext(s){const q=s.nodeQ||[];s.node=q.length?q.shift():null;if(s.node){s.node.burning=false;s.node._c=null}}
// where the craft is at time t on legs from predictFrom: [body, r, v] in that body's frame (null past the last leg)
function legState(legs,t){for(let i=legs.length-1;i>=0;i--){const L=legs[i];if(t<L.t-1e-6)continue;if(L.endT&&t>L.endT+1e-6)return null;
    const[r,v]=kepler(L.r,L.v,t-L.t,L.b.mu);return[L.b,r,v]}return null}
function nodePlan(s){const all=[s.node,...(s.nodeQ||[])].filter(Boolean);if(!all.length)return[];
  const key=JSON.stringify(all.map(n=>[n.t,n.dv,n.b||null]))+'|'+s.body.name+'|'+(s.kickN||0)+'|'+Math.floor(simT);
  if(s._np&&s._np.key===key)return s._np.out;
  const out=[];let st=null;
  for(let i=0;i<all.length;i++){const n=all[i];let b,r,v;
    if(i===0){const I=nodeInfo(s);if(!I)break;out.push({n,b:I.b,rN:I.rN,vN:I.vN,dvW:I.dvW,t:I.t});st={b:I.b,r:I.rN,v:add(I.vN,I.rem),t:I.t};continue}
    const legs=predictFrom(st),x=legState(legs,n.t);if(!x)break;[b,r,v]=x;if(!n.b)n.b=b.name;
    const f=nodeFrame(r,v),dvW=add(add(mul(f.pro,n.dv[0]),mul(f.nrm,n.dv[1])),mul(f.rad,n.dv[2]));
    out.push({n,b,rN:r,vN:v,dvW,t:n.t});st={b,r,v:add(v,dvW),t:n.t}}
  s._np={key,out};return out}
function nodePlanEnd(s){const P=nodePlan(s);if(!P.length)return null;const L=P[P.length-1];return{b:L.b,r:L.rN,v:add(L.vN,L.dvW),t:L.t}}
// add a node at the next apoapsis of the trajectory after the last node, or, on a leg that ends in an encounter or an
// escape, at the next leg's periapsis (the capture point); the first node goes where nodeAtApoapsis puts it
function nodeAddNext(s){if(!s.node)return null;const e=nodePlanEnd(s);if(!e)return null;const legs=predictFrom(e),L0=legs[0];
  let L=L0;if(L0.endKind&&legs[1])L=legs[1];const el=L.el,b=L.b;
  const t=L===L0?(el.e<1?e.t+timeToNu(el,Math.PI):e.t+300):L.t+Math.max(0,timeToNu(el,0));
  const n={t,dv:[0,0,0],b:b.name};(s.nodeQ=s.nodeQ||[]).push(n);s.nodeQ.sort((a,c)=>a.t-c.t);return n}
// the finite burn: the craft gets lighter as it burns, so it accelerates harder at the end, and the first half of the Δv
// takes more than half the burn time. Starting this long before the node puts the burn's centroid (in Δv) on the node
const nodeLead=(s,dv)=>nodeBurnTime(s,dv/2);
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
  const mu=b.mu,top=b.R+(b.atm||0),path=[],pathT=[],keep=(r,t)=>{path.push(toPF(b,r,t));pathT.push(t)},r0=r,v0=v,t0=t;r=r.slice();v=v.slice();let dt0=0;   // pathT: each point's time (Q266)
  const el=elements(r,v,mu);if(el.pe>top)return null;
  if(len(r)>top+1){const c=(el.p/top-1)/el.e;if(!(c>=-1&&c<=1))return null;const dt=timeToNu(el,-Math.acos(c));dt0=dt;
    for(let k=1;k<=24;k++){const[rr]=kepler(r,v,dt*k/24,mu);keep(rr,t+dt*k/24)}[r,v]=kepler(r,v,dt,mu);t+=dt}
  if(!b.atm&&pertNear(b,el)){const tEnd=t+2*(dt0>0?dt0:0)+600;r=r0.slice();v=v0.slice();t=t0;path.length=0;let k=0;   // perturbed: the same stepper as rails
    while(t<tEnd&&len(r)>b.R){const{lim,sp,pa,hP}=coastPlan(b,r,v,t,elements(r,v,mu),b.R),h=Math.min(Math.max(0.05,0.25*lim/sp),hP,tEnd-t);[r,v]=coastStep(b,r,v,t,h,pa);t+=h;if(++k%8===0)keep(r,t)}
    if(len(r)>b.R)return null;return{t,pf:toPF(b,r,t),v:len(sub(v,surfVel(b,r))),path,pathT,b}}
  if(!b.atm)return{t,pf:toPF(b,r,t),v:len(sub(v,surfVel(b,r))),path,pathT,b};
  let kd=0;   // drag rate (1/s) at the last evaluation: the step must stay well under its time constant, or a chute makes it ring
  const acc=(r,v)=>{const rl=len(r),h=rl-b.R,rho=density(b,h),va=sub(v,surfVel(b,r)),sp=len(va);let a=mul(r,-mu/(rl*rl*rl));kd=0;
    if(rho>0&&sp>0.1){kd=0.5*rho*sp*kdrag(h,sp,rho,r,t);a=madd(a,va,-kd)}return a};
  let i=0;for(;i<40000;i++){const h=len(r)-b.R;if(h<=0||h<bodyTop(b)&&h<=groundAlt(b,toPF(b,r,t)))break;acc(r,v);const sp=len(v),dt=Math.min(clamp(h/Math.max(sp,1)/40,0.02,2),0.3/Math.max(kd,1e-9));
    const a1=acc(r,v),rm=madd(r,v,dt/2),vm=madd(v,a1,dt/2),a2=acc(rm,vm);r=madd(r,vm,dt);v=madd(v,a2,dt);t+=dt;
    if(i%8===0)keep(r,t);
    if(len(r)>top+10&&dot(r,v)>0){ // climbing out of the air: coast the vacuum arc exactly and come back in (or never)
      const e2=elements(r,v,mu);if(e2.pe>top)return null;const c=(e2.p/(top-1)-1)/e2.e;if(!(c>=-1&&c<=1))return null;const dt=timeToNu(e2,-Math.acos(c));
      for(let k=1;k<=24;k++){const[rr]=kepler(r,v,dt*k/24,mu);keep(rr,t+dt*k/24)}[r,v]=kepler(r,v,dt,mu);t+=dt}}
  return{t,pf:toPF(b,r,t),v:len(sub(v,surfVel(b,r))),path,pathT,b,capped:i>=40000}}   // capped: still up when the steps ran out (a slow decay), not an impact
function predictImpact(s,sg=0){
  if(s.landed||!s.alive)return null;const b=s.body;
  const Y=qrot(s.q,[0,1,0]),va0=sub(s.v,surfVel(b,s.r)),aoa=len(va0)>1?Math.acos(clamp(dot(va0,Y)/len(va0),-1,1))*57.2958:0,tab=b.atm?dragTable(s,aoa):[0,0],m=s.mass;
  const cdA=M=>{const x=clamp(M/0.5,0,tab.length-1.001),i=Math.floor(x);return tab[i]+(tab[i+1]-tab[i])*(x-i)},pe=sg&&b===TELLUS?predErr(s):0;
  const f=fall(b,s.r,s.v,simT,(h,sp,rho,r,t)=>{let A=cdA(sp/SND(h));if(s.chute&&s.chutePart&&s.chutePart.on&&rho>0.03)A+=Math.min(sp<250&&mainChuteOK(b,h,r,t)?600:sp<400?6:0,CHUTE_G*G0*m/(0.5*rho*sp*sp+1));return A/m*(b===TELLUS?1+sg*(atmU(h)+pe):1)});
  return f&&f.capped?null:f}   // (flow, Q266) a slow decay that outlasts the steps isn't an impact: no X, no path round the planet   // pe: the compute era's prediction error (economy)
// debris falls with the same simple drag stepDebris gives it (2.5 m² tumbling)
const debrisImpact=d=>fall(d.body,d.r,d.v,simT,()=>2.5/d.mass);

