// sim/rovers.js — rovers. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ rovers (sats session; NOTES § "Rovers: plan", R1)
// A rover is its own kind of vessel, designed in the Rover yard rather than the rocket builder (rovers lie down, rocket
// parts stand up): a chassis, wheels on sprung arms with hub motors, and a deck of slots. Its step is one rigid body on
// the ground, in the planet's own frame (pf): each wheel a spring and damper; its grip capped by the ground's friction
// under that wheel's load, one friction circle shared by drive, brakes and cornering; rolling resistance from soft
// ground (less for big wheels); bumps from rough ground. The chassis and what's on it touch the ground too, so a rover can
// tip over and come to rest on its side or roof, and nothing rights it. Body axes: +Y up, +Z forward, +X left.
const RV_CH={s:{name:'Small chassis',L:1.8,W:1.2,H:.22,m:45,slots:3},
  m:{name:'Medium chassis',L:3,W:1.9,H:.3,m:130,slots:5},
  l:{name:'Large chassis',L:4.4,W:2.5,H:.45,m:420,slots:8}};
// wheels, each with its hub motor: radius, width, mass (kg), stall torque (N·m), power (W), geared top speed (m/s),
// suspension travel (m). The wire-mesh wheel is the lunar rover's: 0.82 m across, a 190 W motor in each hub.
const RV_WH={s:{name:'Small wheels',r:.2,w:.12,m:5,T:30,P:120,v:2,tr:.12},
  m:{name:'Wire-mesh wheels',r:.41,w:.23,m:12,T:110,P:190,v:4,tr:.2},
  l:{name:'Heavy wheels',r:.6,w:.4,m:35,T:600,P:900,v:3,tr:.3}};
// what goes in a deck slot: mass (kg), its box (m), the height of its centre of mass as a share of its own. A crew seat
// carries its occupant (170 kg, suited). Instruments ride along as mass and height until science arrives (R4).
const RV_IT={bat:{name:'Battery',m:40,kWh:4,sz:[.5,.25,.4]},
  seat:{name:'Crew seat',m:185,crew:1,sz:[.55,1.05,.6],cy:.45},
  cam:{name:'Camera mast',m:12,sz:[.16,1.5,.16],cy:.7},
  ant:{name:'High-gain antenna',m:14,sz:[.7,1.1,.7],cy:.65},
  arm:{name:'Sample arm',m:25,sz:[.3,.35,.9]},
  spec:{name:'Spectrometer',m:8,sz:[.3,.25,.3]},
  seis:{name:'Seismometer pack',m:16,sz:[.4,.3,.4]},
  drill:{name:'Drill',m:30,sz:[.3,1.2,.3],cy:.4}};
// a step of 1/240 s; steering lock (front wheels one way, rear the other); springs sag 40 % of their travel at the gravity
// they're set for; damping ratio; motor efficiency; what the electronics draw (W); Selene's gravity as a share of Tellus's
const RV_DT=1/240,RV_STEER=.45,RV_SAG=.4,RV_ZETA=.5,RV_ETA=.8,RV_HOTEL=30,RV_GS=SELENE.mu/SELENE.R**2/(TELLUS.mu/TELLUS.R**2);
// rolling resistance: a share of the load, worse on soft ground, eased by a bigger wheel (it sinks less)
const rvCrr=(su,r)=>(.015+.045*Math.max(0,su.soft))*Math.sqrt(.41/r);
const rvDefault=()=>({name:'Rover 1',ch:'m',wh:'m',n:4,spr:'T',slots:['seat','seat','bat','cam',null]});
// the design's geometry and mass properties, in body axes with the origin at the chassis's centre
function rvGeom(d){const C=RV_CH[d.ch]||RV_CH.m,Wk=RV_WH[d.wh]||RV_WH.m,n=d.n===6?6:4,xw=C.W/2+Wk.w/2+.03,zw=C.L/2-.6*Wk.r,yM=-C.H/2;
  const wheels=[];for(const z of n===6?[zw,0,-zw]:[zw,-zw])for(const s of[1,-1])wheels.push({x:s*xw,z,steer:z>0?1:z<0?-1:0});
  const cols=C.W>=1.8?2:1,rows=Math.ceil(C.slots/cols),items=[];
  (d.slots||[]).slice(0,C.slots).forEach((k,i)=>{if(!k||!RV_IT[k])return;const row=Math.floor(i/cols),col=i%cols;
    items.push({k,it:RV_IT[k],x:cols===2?(col?-C.W/4:C.W/4):0,z:C.L/2-(row+.5)*C.L/rows,y:C.H/2})});
  const gs=d.spr==='S'?RV_GS:1,yW=yM-(1-RV_SAG)*Wk.tr,pm=[];
  for(const w of wheels)pm.push([Wk.m,[w.x,yW,w.z]]);
  for(const t of items)pm.push([t.it.m,[t.x,t.y+t.it.sz[1]*(t.it.cy??.5),t.z]]);
  let m=C.m,c=[0,0,0];for(const[mm,p]of pm){m+=mm;c=madd(c,p,mm)}c=mul(c,1/m);
  const I=[C.m/12*(C.H**2+C.L**2)+C.m*(c[1]**2+c[2]**2),C.m/12*(C.W**2+C.L**2)+C.m*(c[0]**2+c[2]**2),C.m/12*(C.W**2+C.H**2)+C.m*(c[0]**2+c[1]**2)];
  for(const[mm,p]of pm){const q=sub(p,c);I[0]+=mm*(q[1]**2+q[2]**2);I[1]+=mm*(q[0]**2+q[2]**2);I[2]+=mm*(q[0]**2+q[1]**2)}
  // what touches the ground when it isn't the tyres: the chassis's corners, the tops of what's on the deck, the hubs' outer faces
  const pts=[];for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1])pts.push([sx*C.W/2,sy*C.H/2,sz*C.L/2]);
  for(const t of items){const[a,h,b]=t.it.sz;for(const sx of[-1,1])for(const sz of[-1,1])pts.push([t.x+sx*a/2,t.y+h,t.z+sz*b/2])}
  for(const w of wheels)pts.push([w.x+Math.sign(w.x)*Wk.w/2,yW,w.z],[w.x,yW+Wk.r,w.z]);
  const share=m/n,k=share*9.81*gs/(RV_SAG*Wk.tr),kWh=items.reduce((a,t)=>a+(t.it.kWh||0),0);
  return{C,Wk,n,wheels,items,m,cm:c,I,pts,yM,gs,k,cd:2*RV_ZETA*Math.sqrt(k*share),track:2*xw,base:2*zw,kWh,crew:items.reduce((a,t)=>a+(t.it.crew||0),0)}}
// what the designer shows: for each world (Tellus, and Selene's gravity on regolith), the steepest climb and what limits
// it, top speed on the flat, the speed at which a full-lock turn tips it (or slides it), and the range on the flat
function rvStats(d){const G=rvGeom(d),Wk=G.Wk,D=Math.PI/180;
  const hAt=gk=>{const sag=Math.min(Wk.tr,RV_SAG*Wk.tr*gk/G.gs);return G.cm[1]-(G.yM-(Wk.tr-sag)-Wk.r)};
  const at=(gk,su)=>{const g=9.81*gk,h=hAt(gk),crr=rvCrr(su,Wk.r),side=G.track/2-Math.abs(G.cm[0]),back=G.base/2+G.cm[2],fwd=G.base/2-G.cm[2];
    const thT=Math.atan(Math.max(0,su.mu-crr)),thB=Math.atan(back/h);let thM=0;
    for(let a=0;a<=60;a+=.1){if(G.m*g*(Math.sin(a*D)+crr*Math.cos(a*D))<=G.n*Wk.T/Wk.r)thM=a*D;else break}
    const lims=[[thT,'traction'],[thM,'motors'],[thB,'tips over backwards']].sort((a,b)=>a[0]-b[0]);
    const vTop=Math.min(Wk.v,G.n*Wk.P/(crr*G.m*g)),Rt=(G.base/2)/Math.tan(RV_STEER),aTip=g*side/h,aSl=su.mu*g;
    const ePm=crr*G.m*g/RV_ETA+RV_HOTEL/vTop;
    return{g:gk,h,climb:lims[0][0]/D,lim:lims[0][1],vTop,turnR:Rt,vTurn:Math.sqrt(Math.min(aTip,aSl)*Rt),turnBy:aTip<aSl?'tips':'slides',range:G.kWh*3.6e6/ePm/1000,
      tipSide:Math.atan(side/h)/D,tipFwd:Math.atan(fwd/h)/D,tipBack:thB/D}};
  const pw=rvPow(d),nightH=Math.PI/SELENE.n/3600,need=pw.rtg?0:(RV_SLEEP+RV_HEAT)*nightH*3600;   // Selene's night: half an orbit
  return{mass:G.m,crew:G.crew,kWh:G.kWh,track:G.track,base:G.base,clear:(1-RV_SAG)*Wk.tr+Wk.r,T:at(1,SURF[6]),S:at(RV_GS,SURF_MOON),sol:pw.sol,rtg:pw.rtg,hg:pw.hg,nightH,nightKWh:need/3.6e6}}

// the test yard beside the pad: three ramps (10°, 20°, 30°) and two side slopes (20°, 35°), all 2.5 m high, on the
// concrete apron 320 m east of the pad. Yard axes: x east, z north; every mound has 40° shoulders.
const RV_YH=2.5,RV_SH=Math.tan(40*Math.PI/180),RV_YARD=[{k:'ramp',a:10,x:-20},{k:'ramp',a:20,x:0},{k:'ramp',a:30,x:20},{k:'bank',a:20,x:36},{k:'bank',a:35,x:56}];
function yardFeatH(f,x,z){const H=RV_YH,t=Math.tan(f.a*Math.PI/180);
  // a ramp climbs north from z = 12 at its angle to a 6 m flat top, then comes down at 12°
  if(f.k==='ramp'){const z3=12+H/t+6+H/Math.tan(12*Math.PI/180);return Math.max(0,Math.min(H,(z-12)*t,(z3-z)*Math.tan(12*Math.PI/180),(3+H/RV_SH-Math.abs(x-f.x))*RV_SH))}
  // a side slope rises eastward at its angle (drive north along it, leaning), a 3 m top, gentle 10° ends to get on and off
  const x1=f.x+H/t,e=Math.tan(10*Math.PI/180);return Math.max(0,Math.min(H,(x-f.x)*t,(x1+3+H/RV_SH-x)*RV_SH,(z-12)*e,(72+2*H/e-z)*e))}
function yardOf(site){const R=TELLUS.R,u=alongAz(site.u,Math.PI/2,320/R),f=siteFrame(u);return{site:site.id,o:mul(u,R+site.h),e:f.e,n:f.n,up:u}}
function yardH(Y,pf){const q=sub(pf,Y.o),x=dot(q,Y.e),z=dot(q,Y.n);if(x<-40||x>80||z<0||z>110)return 0;let h=0;for(const f of RV_YARD)h=Math.max(h,yardFeatH(f,x,z));return h}
const yardPF=(Y,x,z,h=0)=>add(add(Y.o,mul(Y.e,x)),add(mul(Y.n,z),mul(Y.up,h)));
// open country: the nearest stretch of land 5–8 km from the site that is gentle and not near the sea
function countryOf(site){const R=TELLUS.R,D=Math.PI/180;let best=null;
  for(const km of[5,6.5,8])for(let a=0;a<360;a+=30){const u=alongAz(site.u,a*D,km*1e3/R),sl=terrainSlope(TELLUS,u);if(terrainH(u)<20||sl>.12)continue;
    if([0,90,180,270].some(b=>terrainH(alongAz(u,b*D,600/R))<5))continue;if(!best||sl<best.sl)best={u,sl,a}}
  return best?best.u:alongAz(site.u,Math.PI/2,320/R)}

// the ground for a rover: the planet's, the yard's mounds, and bumps on rough ground (value noise on a 1.5 m lattice)
function rvBump(pf){const x=pf[0]/1.5,y=pf[1]/1.5,z=pf[2]/1.5,i=Math.floor(x),j=Math.floor(y),k=Math.floor(z),s=t=>t*t*(3-2*t),a=s(x-i),b=s(y-j),c=s(z-k);let v=0;
  for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)for(let dz=0;dz<2;dz++)v+=(dx?a:1-a)*(dy?b:1-b)*(dz?c:1-c)*ih3(i+dx,j+dy,k+dz);return 2*v-1}
function rvGroundR(R,pf){let h=groundR(R.body,pf);if(R.yard)h+=yardH(R.yard,pf);if(R.rough)h+=R.rough*rvBump(pf);return h}
function rvNormal(R,pf,h0){const u=norm(pf),e=norm(Math.abs(u[1])<.99?cross([0,1,0],u):cross([1,0,0],u)),n=cross(u,e),d=.3;
  const he=rvGroundR(R,add(pf,mul(e,d))),hn=rvGroundR(R,add(pf,mul(n,d)));return norm(sub(u,add(mul(e,(he-h0)/d),mul(n,(hn-h0)/d))))}
// (the pad's levelled ground is grass away from the pad itself: it drives as grass, without the bumps)
function rvSurface(R,pf){if(R.yard&&yardH(R.yard,pf)>.02)return{name:'gravel ramp',mu:.65,soft:0,rough:0};const su=surfaceAt(R.body,pf);
  return su===SURF_PAD&&!SITES.some(t=>len(sub(norm(pf),t.u))*TELLUS.R<250)?{name:'levelled grass',id:6,mu:SURF[6].mu,soft:SURF[6].soft,rough:0}:su}

// a rover standing on the ground at pf (any point above the spot), facing `heading` (a pf-frame direction along the ground)
function rvNew(d,body,pf,heading,o={}){const G=rvGeom(d),R={d,G,body,gk:o.gk||1,yard:o.yard||null,v:[0,0,0],w:[0,0,0],steer:0,acc:0,t:0,
    E:G.kWh*3.6e6,in:{thr:0,steer:0,brake:false},su:null,suT:0,rough:0,pitchS:0,tipT:0,tipped:false,wet:false,
    rec:{dist:0,climb:0,vmax:0,tips:0},wh:G.wheels.map(()=>({c:0,cp:0,l:G.Wk.tr,load:0,spin:0,om:0,slip:false}))};
  R.Emax=R.E;R.su=rvSurface(R,pf);R.rough=(R.su.rough||0)*.25;
  const u=norm(pf),g=rvGroundR(R,pf),gp=mul(u,g),up=rvNormal(R,gp,g),Z=norm(sub(heading,mul(up,dot(heading,up)))),X=cross(up,Z);R.q=qFromBasis(X,up,Z);   // square to the ground under it
  // high enough that no wheel starts in the ground (rough ground has bumps)
  const yG=G.yM-G.Wk.tr-G.Wk.r,lift=Math.max(0,...G.wheels.map(w=>{const q=add(gp,qrot(R.q,[w.x,0,w.z]));return dot(sub(mul(norm(q),rvGroundR(R,q)),gp),up)}));
  R.p=add(madd(gp,up,-yG+.03+lift),qrot(R.q,G.cm));return R}
function rvStep(R,dt){const G=R.G,Wk=G.Wk,b=R.body;if(R.wet)return;R.t+=dt;
  if((R.suT-=dt)<=0){R.suT=.25;R.su=rvSurface(R,R.p);R.rough=(R.su.rough||0)*.25;
    if(b===TELLUS&&R.su.id===0){R.wet=true;R.v=[0,0,0];R.w=[0,0,0];HOOK.msg('Into the sea: the rover is lost');return}}
  R.steer+=clamp(-R.in.steer*RV_STEER-R.steer,-dt,dt);   // the steering motors turn the wheels at 1 rad/s
  const up=norm(R.p),M=G.m,mu=R.su.mu;R.v=madd(R.v,up,-R.gk*b.mu/dot(R.p,R.p)*dt);
  const Iinv=v=>{const l=qrot(qconj(R.q),v);return qrot(R.q,[l[0]/G.I[0],l[1]/G.I[1],l[2]/G.I[2]])},
    imp=(r,j)=>{R.v=madd(R.v,j,1/M);R.w=add(R.w,Iinv(cross(r,j)))},meff=(r,u)=>{const a=cross(r,u);return 1/(1/M+dot(a,Iinv(a)))},vel=r=>add(R.v,cross(R.w,r));
  const down=qrot(R.q,[0,-1,0]),fwd=qrot(R.q,[0,0,1]),vf=dot(R.v,fwd),drive=R.E>0&&!R.dead&&!R.in.brake?R.in.thr:0,brake=R.dead||R.in.brake||!R.in.thr&&Math.abs(vf)<.25;
  // the springs first, every wheel; then grip, solved together over a few passes (one wheel's grip moves the others'
  // contact points), each wheel's total kept inside its friction circle
  let Pd=0,onG=0;const K=[];
  G.wheels.forEach((w,i)=>{const s=R.wh[i],P=add(R.p,qrot(R.q,sub([w.x,G.yM,w.z],G.cm))),gR=rvGroundR(R,P),n=rvNormal(R,P,gR),dn=dot(down,n);
    let l=Wk.tr;if(dn<-.3)l=(dot(sub(P,mul(norm(P),gR)),n)-Wk.r)/(-dn);
    if(l>=Wk.tr){s.l=Wk.tr;s.c=s.cp=s.load=0;s.slip=false;s.om*=.995;s.spin+=s.om*dt;return}
    const c=Wk.tr-l,cd=dot(vel(sub(P,R.p)),n)/dn;s.cp=c;s.c=c;s.l=l;onG++;   // compression rate: how fast the mount closes on the ground
    let F=G.k*c+G.cd*cd;if(c>Wk.tr)F+=10*G.k*(c-Wk.tr)+2*G.cd*cd;F=Math.max(0,F);s.load=F;
    const r=sub(madd(madd(P,down,l),n,-Wk.r),R.p);imp(r,mul(n,F*dt));
    const st=w.steer*R.steer,wf=qrot(R.q,[Math.sin(st),0,Math.cos(st)]),f=norm(sub(wf,mul(n,dot(wf,n))));
    K.push({s,r,f,lat:cross(n,f),Jm:mu*F*dt,F,Jl:0,Jt:0,Fd:0})});
  for(let it=0;it<4;it++)for(const k of K){const{r,f,lat}=k,vc=vel(r),vl=dot(vc,f),vt=dot(vc,lat);let dl=0;
    if(brake)dl=-vl*meff(r,f);
    else if(!it){if(drive){k.Fd=drive*Math.min(Wk.T/Wk.r,Wk.P/Math.max(Math.abs(vl),.05));if(drive*vl>0)k.Fd*=clamp((Wk.v*1.05-Math.abs(vl))/(.05*Wk.v),0,1)}
      dl=k.Fd*dt-Math.sign(vl)*Math.min(rvCrr(R.su,Wk.r)*k.F*dt,Math.abs(vl)*meff(r,f));Pd+=Math.abs(k.Fd)*(Math.abs(vl)+.1)/RV_ETA}
    let L=k.Jl+dl,T=k.Jt-vt*meff(r,lat);const jj=Math.hypot(L,T);k.s.slip=jj>k.Jm;if(k.s.slip){L*=k.Jm/jj;T*=k.Jm/jj}
    imp(r,add(mul(f,L-k.Jl),mul(lat,T-k.Jt)));k.Jl=L;k.Jt=T}
  for(const k of K){const vl=dot(vel(k.r),k.f),s=k.s;s.om=brake?(s.slip?0:vl/Wk.r):s.slip&&k.Fd?vl/Wk.r+Math.sign(k.Fd)*2:vl/Wk.r;s.spin+=s.om*dt}
  for(const pt of G.pts){const r=qrot(R.q,sub(pt,G.cm)),P=add(R.p,r),gR=rvGroundR(R,P),dep=gR-len(P);if(dep<=0)continue;
    const n=rvNormal(R,P,gR),vn=dot(vel(r),n),jn=Math.max(0,-1.2*vn+.1*dep/dt)*meff(r,n);if(jn<=0)continue;imp(r,mul(n,jn));
    const v2=vel(r),vt=sub(v2,mul(n,dot(v2,n))),vtl=len(vt);if(vtl>1e-6){const t=mul(vt,1/vtl);imp(r,mul(t,-Math.min(vtl*meff(r,t),mu*jn)))}}
  // landed vessels are upright cylinders it can't drive through: the rover's footprint (a box, wheels included) against each axis
  if(R.obs)for(const O of R.obs){const y=dot(sub(R.p,O.c),O.u);if(y<0||y>O.h||len(sub(R.p,O.c))>O.r+G.C.L+6)continue;
    const A=madd(O.c,O.u,y),a=add(qrot(qconj(R.q),sub(A,R.p)),G.cm),hx=G.track/2+Wk.w/2,hz=G.C.L/2,c=[clamp(a[0],-hx,hx),a[1],clamp(a[2],-hz,hz)],dd=sub(a,c),dl=Math.hypot(dd[0],dd[2]);
    let n,dep;if(dl>1e-6){dep=O.r-dl;n=qrot(R.q,[-dd[0]/dl,0,-dd[2]/dl])}else{const ex=hx-Math.abs(a[0]),ez=hz-Math.abs(a[2]);dep=O.r+Math.min(ex,ez);n=qrot(R.q,ex<ez?[-Math.sign(a[0])||1,0,0]:[0,0,-Math.sign(a[2])||1])}
    if(dep<=0)continue;n=norm(madd(n,O.u,-dot(n,O.u)));const r=qrot(R.q,sub(c,G.cm)),jn=Math.max(0,-1.2*dot(vel(r),n)+.1*dep/dt)*meff(r,n);if(jn>0)imp(r,mul(n,jn))}
  R.E=Math.max(0,R.E-Pd*dt);
  R.p=madd(R.p,R.v,dt);const wl=len(R.w);if(wl>1e-9)R.q=qnorm(qmul(qaxis(mul(R.w,1/wl),wl*dt),R.q));
  // the test record: distance on the ground, top speed, the steepest slope climbed (pitch smoothed over a second), tip-overs
  const sp=len(R.v),pit=Math.asin(clamp(dot(fwd,up),-1,1)),tilt=Math.acos(clamp(dot(qrot(R.q,[0,1,0]),up),-1,1));R.pitchS+=(pit-R.pitchS)*Math.min(1,dt);
  if(onG>=2){R.rec.dist+=sp*dt;R.rec.vmax=Math.max(R.rec.vmax,sp);const cl=vf>.2?R.pitchS:vf<-.2?-R.pitchS:0;R.rec.climb=Math.max(R.rec.climb,cl*180/Math.PI)}
  if(tilt>75*Math.PI/180&&sp<.5){if((R.tipT+=dt)>1.5&&!R.tipped){R.tipped=true;R.rec.tips++;HOOK.msg('Tipped over')}}else if(tilt<45*Math.PI/180){R.tipT=0;R.tipped=false}}
function rvRun(R,dt){if(R.dep){R.dep.t+=dt;if(R.dep.t<R.dep.T)return;R.dep=null}R.acc=Math.min(R.acc+dt,.25);while(R.acc>=RV_DT){rvStep(R,RV_DT);R.acc-=RV_DT}}
const rvTilt=R=>{const up=norm(R.p);return{pitch:Math.asin(clamp(dot(qrot(R.q,[0,0,1]),up),-1,1))*180/Math.PI,roll:Math.asin(clamp(dot(qrot(R.q,[1,0,0]),up),-1,1))*180/Math.PI}};
// a test drive's record goes into the design's (per gravity: Tellus 'T', the lunar trainer 'S') and the wheels' distance
function rvFold(R){const k=R.gk<1?'S':'T',t=(R.d.test=R.d.test||{})[k]=R.d.test[k]||{km:0,climb:0,vmax:0,tips:0},r=R.rec;
  t.km+=r.dist/1000;t.climb=Math.max(t.climb,r.climb);t.vmax=Math.max(t.vmax,r.vmax);t.tips+=r.tips;
  const W=PROG.wheelKm=PROG.wheelKm||{};W[R.d.wh]=(W[R.d.wh]||0)+r.dist/1000;R.rec={dist:0,climb:0,vmax:0,tips:0}}
// ---- R2: rovers packed on a lander and deployed on the ground (sats session; NOTES § "R2 built")
// Two mounts: folded flat against a lander's side (rvfold: small and medium chassis, the lunar rover's way) and on a deck
// with ramps (rvdeck: any rover up to 3.8 m long, Lunokhod's way). The design rides in the part's node (nd.rvd, the copy
// made when it was packed), its mass added as the part's xm. "Deploy" on a landed lander checks the ground where the
// rover would end up; it either refuses and says why, or ends with the rover upright on its wheels after a scripted unfold
// (RV_FOLD_T s) or a drive down the ramps (RV_DECK_T s). Deployed rovers (FROV) are driven one at a time (RVA). At the
// flight's end they stay where they are (PROG.rvOut); a later flight within LOAD_R of one takes it back in, and an
// uncrewed one can be driven from home.
const RV_RAMP=6,RV_FOLD_T=8,RV_DECK_T=10,RV_TILT=15;   // telescoping ramps, 6 m out
let FROV=[],RVA=null;
const rvPacked=p=>p.on&&p.d.kind==='rover'&&p.dn&&p.dn.rvd&&!p.rvOut;
function rvMountWhy(p,d){const C=RV_CH[d.ch]||RV_CH.m;
  return p.d.key==='rvfold'?(d.ch==='l'?`a ${C.name.toLowerCase()} doesn't fold: put it on a deck`:''):C.L>2*p.d.r+.6?`${C.L} m long, too long for the deck`:''}
const rvYC={};
function rvYardNear(b,pf){if(b!==TELLUS)return null;for(const t of SITES){const Y=rvYC[t.id]||(rvYC[t.id]=yardOf(t));if(len(sub(pf,Y.o))<400)return Y}return null}
const rvProbe=(b,pf)=>{const P={body:b,yard:rvYardNear(b,pf),rough:0},su=rvSurface(P,pf);P.su=su;P.rough=(su.rough||0)*.25;return P};
// the steepest the ground gets across a span (m) around pf, in degrees
function rvSlopeAt(P,pf,span){const u=norm(pf),e=norm(Math.abs(u[1])<.99?cross([0,1,0],u):cross([1,0,0],u)),n=cross(u,e),h=v=>rvGroundR(P,add(pf,v));
  const dx=(h(mul(e,span))-h(mul(e,-span)))/(2*span),dz=(h(mul(n,span))-h(mul(n,-span)))/(2*span);return Math.atan(Math.hypot(dx,dz))*180/Math.PI}
// rover-sized rocks: on rough ground, a share of 4 m cells has one (the boulders landers worry about are 20 m cells)
const rvRock=(P,pf)=>{if(!P.su.rough)return false;const g=mul(norm(pf),P.body.R/4);return ih3(Math.floor(g[0]),Math.floor(g[1]),Math.floor(g[2])+733)<P.su.rough*.5};
const shipPF=(s,v)=>add(s.pf,qrot(s.qLocal,sub(v,s.cm)));   // a point in a landed vessel's body axes, in the planet's frame
function rvFootR(s){let r=1;for(const f of footPoints(s))r=Math.max(r,Math.hypot(f.pt[0],f.pt[2]));for(const p of s.parts)if(p.on&&!p.inst.surf)r=Math.max(r,Math.hypot(p.pos[0],p.pos[2])+p.d.r);return r}
// where the rover would end up and whether it may: {ok, why, spot (pf, on the ground), head, p0/q0 (its stowed pose), T}
function rvDeployCheck(s,p){const d=p.dn&&p.dn.rvd;if(!rvPacked(p)||!d)return{ok:false,why:'nothing packed there'};
  if(!s.alive||!s.landed)return{ok:false,why:'only once landed and still'};
  const mw=rvMountWhy(p,d);if(mw)return{ok:false,why:mw};
  const G=rvGeom(d);if(G.crew&&!crewOn(s))return{ok:false,why:'nobody aboard to drive it (a crewed rover needs a crewed lander)'};
  const b=s.body,u=norm(s.pf),Ul=qrot(s.qLocal,[0,1,0]),tilt=Math.acos(clamp(dot(Ul,u),-1,1))*180/Math.PI;
  if(tilt>RV_TILT)return{ok:false,why:`the lander leans ${tilt.toFixed(0)}° (deploying needs under ${RV_TILT}°)`};
  const P0=rvProbe(b,s.pf),gp=mul(u,rvGroundR(P0,s.pf)),hor=v=>norm(sub(v,mul(u,dot(v,u)))),st=rvStats(d),X=b===TELLUS?st.T:st.S,sLim=Math.min(20,X.tipSide-15);
  const spotWhy=(spot,what)=>{const P=rvProbe(b,spot);if(seaAt(b,spot))return`the sea where it would ${what}`;
    const sl=rvSlopeAt(P,spot,G.C.L/2);if(sl>sLim)return`the ground where it would ${what} slopes ${sl.toFixed(0)}° (it needs under ${sLim.toFixed(0)}°)`;
    if(rvRock(P,spot))return`a rock where it would ${what}`;return''};
  const fr=rvFootR(s);
  if(p.d.key==='rvfold'){const o=hor(qrot(s.qLocal,[Math.cos(p.phi),0,Math.sin(p.phi)])),spot=madd(gp,o,Math.max(fr,Math.hypot(p.pos[0],p.pos[2])+.4)+G.C.L/2+.4),why=spotWhy(spot,'unfold');
    if(why)return{ok:false,why};
    // stowed: belly to the hull, nose up
    const Y=norm(sub(o,mul(Ul,dot(o,Ul)))),p0=madd(shipPF(s,partC(p)),o,.35),q0=qFromBasis(cross(Y,Ul),Y,Ul);return{ok:true,why:'',spot,head:o,p0,q0,T:RV_FOLD_T,kind:'fold'}}
  if(p.children.some(c=>c.on&&c.dn&&c.dn.at==='u'))return{ok:false,why:'something is stacked on the deck'};
  const top=shipPF(s,[p.pos[0],p.y0+.3,p.pos[2]]),yG=G.yM-G.Wk.tr-G.Wk.r;let best=null;
  for(const a of[0,1,2,3]){const o=hor(qrot(s.qLocal,[Math.cos(a*Math.PI/2),0,Math.sin(a*Math.PI/2)])),edge=madd(top,o,p.d.r),hd=dot(sub(edge,mul(norm(edge),rvGroundR(rvProbe(b,edge),edge))),u);
    const ang=hd>=RV_RAMP?90:Math.asin(Math.max(0,hd)/RV_RAMP)*180/Math.PI,aLim=Math.min(25,X.tipFwd-10),spot=madd(gp,o,Math.max(fr,p.d.r)+RV_RAMP*Math.cos(ang*Math.PI/180)+G.C.L/2+.3);
    const why=ang>aLim?(hd>=RV_RAMP?`the deck is ${hd.toFixed(1)} m up: the ramps (${RV_RAMP} m) don't reach the ground`:`the ramps would be ${ang.toFixed(0)}° (under ${aLim.toFixed(0)}° to drive down them)`):spotWhy(spot,'come off the ramps');
    const c={ok:!why,why,spot,head:o,ang,p0:madd(top,u,-yG+G.cm[1]),q0:(Z=>qFromBasis(cross(Ul,Z),Ul,Z))(norm(sub(o,mul(Ul,dot(o,Ul))))),T:RV_DECK_T,kind:'deck',edge};
    if(!best||c.ok&&(!best.ok||c.ang<best.ang)||!best.ok&&!c.ok&&c.ang<best.ang)best=c}
  return best}
function rvDeploy(s,p){const c=rvDeployCheck(s,p),d=p.dn&&p.dn.rvd;if(!c.ok){HOOK.msg(`Can't deploy${d?' the '+d.name:''}: ${c.why}`);return null}
  const R=rvNew(JSON.parse(JSON.stringify(d)),s.body,c.spot,c.head,{yard:rvYardNear(s.body,c.spot)});
  PROG.rvN=(PROG.rvN||0)+1;Object.assign(R,{id:PROG.rvN,name:d.name,dep:{t:0,T:c.T,p0:c.p0,q0:c.q0,kind:c.kind,edge:c.edge||null}});
  const cm0=s.cm.slice();p.rvOut=true;p.xm=0;geom(s);s.pf=shipPF({pf:s.pf,qLocal:s.qLocal,cm:cm0},s.cm);syncLanded(s);HOOK.rebuild();   // lighter now; the lander stays put
  FROV.push(R);RVA=R;HOOK.msg(`${d.name}: ${c.kind==='fold'?'unfolding':'down the ramps'}`);return R}
// the pose to draw: during a deploy, along a curve from the stowed pose to the ground (over the deck's edge, for ramps)
function rvPose(R){if(!R.dep)return{p:R.p,q:R.q};const D=R.dep,f=sstep(0,1,D.t/D.T),u=norm(R.p),c=D.edge?madd(D.edge,u,dot(sub(D.p0,D.edge),u)):madd(mul(add(D.p0,R.p),.5),u,.8);
  const a=madd(D.p0,sub(c,D.p0),f),b2=madd(c,sub(R.p,c),f),q1=dot(D.q0,R.q)<0?R.q.map(x=>-x):R.q;
  return{p:madd(a,sub(b2,a),f),q:qnorm(D.q0.map((x,i)=>x+(q1[i]-x)*f))}}
// obstacles a rover bumps into: landed vessels, as upright cylinders (base on the ground, radius, height)
function rvObsOf(vs){return vs.filter(v=>v&&v.alive&&v.landed&&v.pf).map(v=>{const u=norm(v.pf),P=rvProbe(v.body,v.pf);let r=.5;
  for(const p of v.parts)if(p.on&&!p.inst.surf)r=Math.max(r,Math.hypot(p.pos[0],p.pos[2])+p.d.r);return{c:mul(u,rvGroundR(P,v.pf)),u,r,h:v.len}})}
// the same for objects left landed (registry entries: their saved shape), within 300 m of pf on body b
function rvObsQ(b,pf){return landedUp().filter(q=>q.bodyName===b.name&&q.shape&&len(sub(q.pf,pf))<300).map(q=>{const u=norm(q.pf),Ul=qrot(q.ql,[0,1,0]);let r=.5,h=1;
  for(const o of q.shape){const d=PARTS[o.k];if(!d)continue;h=Math.max(h,o.y0+o.h);if(!d.surf)r=Math.max(r,Math.hypot(o.pos[0],o.pos[2])+d.r)}return{c:mul(u,rvGroundR(rvProbe(b,q.pf),q.pf)),u:Ul,r,h}})}
function rvFlight(dt){for(const R of FROV){if(R.wet)continue;rvPowerStep(R,dt,rvSunPF(R.body,bodyTheta(R.body,simT)));if(R===RVA||R.dep)R.sleep=false;else if(len(R.v)<.02&&len(R.w)<.02&&R.t>1)R.sleep=true;if(!R.sleep)rvRun(R,dt)}}
// at the flight's end, every rover still on its wheels (or not) stays where it is
const rvEntry=R=>({id:R.id,name:R.name,d:R.d,bodyName:R.body.name,p:R.p.slice(),q:R.q.slice(),E:R.E,km:(R.km0||0)+R.rec.dist/1000,day:PROG.day,tipped:R.tipped,dead:!!R.dead,data:R.data||[],seisLeft:R.seisLeft,reads:R.reads||[]});
function rvEnd(){PROG.rvOut=PROG.rvOut||[];for(const R of FROV){if(R.wet)continue;R.dep=null;PROG.rvOut.push(rvEntry(R))}FROV.length=0;RVA=null}
function rvFromEntry(e){const b=BODIES.find(x=>x.name===e.bodyName)||TELLUS,R=rvNew(e.d,b,e.p,[0,0,1],{yard:rvYardNear(b,e.p)});
  Object.assign(R,{id:e.id,name:e.name,p:e.p.slice(),q:e.q.slice(),E:Math.min(e.E,R.Emax),km0:e.km||0,tipped:!!e.tipped,dead:!!e.dead,crewed:false,data:(e.data||[]).slice(),seisLeft:e.seisLeft,reads:(e.reads||[]).slice()});return R}
// rovers left in the field come back into a flight on the same body within LOAD_R of the vessel
function rvLoadNear(s){const L=PROG.rvOut||[];if(!s||!s.alive||!L.length)return 0;const pf=toPF(s.body,s.r,simT);let n=0;
  for(let i=L.length-1;i>=0;i--){const e=L[i];if(e.bodyName!==s.body.name||len(sub(e.p,pf))>LOAD_R)continue;L.splice(i,1);FROV.push(rvFromEntry(e));n++}return n}
// ---- R3: power and contact (sats session; NOTES § "R3 built")
// Power: solar panels (flat on the deck: their output follows the sun's height over the rover's own deck, nothing below
// the horizon) and an RTG (steady, and it keeps the rover warm). The draw: 30 W of electronics awake, 10 W asleep, and
// on an airless body at night a 25 W heater unless an RTG keeps it warm. A battery that runs flat in the night with no
// RTG means the rover froze: it is lost. Selene's night lasts half an orbit (about 52 h); between flights the battery is
// worked out over program time, half an hour at a time (rvFieldTick).
// Contact: a rover is driven by radio. On Tellus, always. Elsewhere, directly with a high-gain antenna while Tellus is
// over its horizon, or through a relay it can see: a lander or a landed object of yours with an antenna that sees Tellus
// itself, within radio horizon (√(2Rh₁)+√(2Rh₂), antenna heights). Commands arrive a light-time round trip late. A crew
// riding it needs no radio.
RV_IT.sol={name:'Solar panels',m:18,W:330,sz:[.9,.06,1.1]};
RV_IT.rtg={name:'RTG',m:35,rtgW:60,sz:[.35,.5,.35]};
const RV_HEAT=25,RV_SLEEP=10,RV_HG=1.2,RV_LG=.8,RV_CLIGHT=299792458;
const rvPow=d=>{const G=rvGeom(d);let sol=0,rtg=0,hg=false;for(const t of G.items){sol+=t.it.W||0;rtg+=t.it.rtgW||0;if(t.k==='ant')hg=true}return{sol,rtg,hg}};
// the body's turn at program time T (a moon's from its orbit at T itself, whatever flight is running)
function thAbs(b,T){if(b===TELLUS)return absTh(T);if(!b.lock)return 0;const s=ORB_T0;ORB_T0=0;const th=lockTh(b,T);ORB_T0=s;return th}
const rvSunPF=(b,th)=>rotY(SUN_DIR,-th);   // the sun's direction in the body's own frame, when it has turned th
function rvPowerStep(R,dt,sun){const P=R.pw||(R.pw=rvPow(R.d)),u=norm(R.p),el=dot(u,sun),night=el<0,cold=!R.body.atm&&night&&!P.rtg;
  const gen=(el>0?P.sol*Math.max(0,dot(qrot(R.q,[0,1,0]),sun)):0)+P.rtg,use=(R.sleep?RV_SLEEP:RV_HOTEL)+(cold?RV_HEAT:0);
  Object.assign(R,{pGen:gen,pUse:use,sunEl:Math.asin(clamp(el,-1,1))*180/Math.PI});if(R.dead)return;
  R.E=clamp(R.E+(gen-use)*dt,0,R.Emax);if(R.E<=0&&cold){R.dead=true;R.v=[0,0,0];R.w=[0,0,0];HOOK.msg(`${R.name||'The rover'} froze in the night: its battery ran flat with no heat`)}}
// between flights: every rover left in the field, over program time T0 → T1
function rvFieldTick(T0,T1){for(const e of PROG.rvOut||[]){if(e.dead)continue;const b=BODIES.find(x=>x.name===e.bodyName)||TELLUS,P=rvPow(e.d),G=rvGeom(e.d),Emax=G.kWh*3.6e6,u=norm(e.p),up=qrot(e.q,[0,1,0]);
  for(let T=T0;T<T1;T+=1800){const h=Math.min(1800,T1-T),sun=rvSunPF(b,thAbs(b,T+h/2)),el=dot(u,sun),cold=!b.atm&&el<0&&!P.rtg;
    e.E=clamp(e.E+((el>0?P.sol*Math.max(0,dot(up,sun)):0)+P.rtg-RV_SLEEP-(cold?RV_HEAT:0))*h,0,Emax);
    if(e.E<=0&&cold){e.dead=true;HOOK.news(`${e.name} froze in the night on ${e.bodyName}: its battery ran flat with no heat`,'bad');break}}}}
// who can hear the rover: {ok, via ('crew' | 'home' | a relay's name), d (m, to the relay), delay (s, the round trip)}
function rvContact(R,t,relays){if(R.body===TELLUS)return{ok:true,via:'home',delay:0};if(R.d&&rvGeom(R.d).crew&&R.crewed!==false&&!R.remote)return{ok:true,via:'crew',delay:0};
  const b=R.body,P=R.pw||(R.pw=rvPow(R.d)),w=add(bodyPos(b,t),fromPF(b,R.p,t)),up=norm(fromPF(b,R.p,t)),toT=sub(bodyPos(TELLUS,t),w),lt=2*len(toT)/RV_CLIGHT;
  const Gr=P.hg?G_RVHG:G_WHIP;   // space Q171: rates, the weaker hop through a relay
  if(P.hg&&dot(up,norm(toT))>Math.sin(1*Math.PI/180))return{ok:true,via:'home',delay:lt,rate:linkRate(P_ROVER,Gr,G_STATION,len(toT))};
  const hR=P.hg?RV_HG:RV_LG;let best=null;
  const Tb=sub(bodyPos(TELLUS,t),bodyPos(b,t)),wr=fromPF(b,R.p,t),sin1=Math.sin(Math.PI/180);   // Tellus and the rover, in b's frame
  for(const q of relays||[]){if(q.body!==b)continue;
    if(q.at){if(q.on&&!q.on(t))continue;const Q=q.at(t),dq=sub(Q,wr),d=len(dq),qT=sub(Tb,Q),u=norm(qT),c=-dot(Q,u);   // in orbit: over the rover's horizon, and Tellus not behind b
      if(dot(up,dq)<d*sin1||c>0&&len(add(Q,mul(u,c)))<b.R)continue;
      const dl=2*(d+len(qT))/RV_CLIGHT;if(!best||d<best.d)best={ok:true,via:q.name,d,delay:dl,rate:Math.min(linkRate(P_ROVER,Gr,G_WHIP,d),linkRate(P_RADIO,G_WHIP,G_STATION,len(qT)))};continue}
    const d=len(sub(q.pf,R.p)),reach=Math.sqrt(2*b.R*hR)+Math.sqrt(2*b.R*Math.max(1,q.h));if(d>reach)continue;
    const qu=norm(fromPF(b,q.pf,t)),qT=norm(sub(bodyPos(TELLUS,t),add(bodyPos(b,t),fromPF(b,q.pf,t))));if(dot(qu,qT)<Math.sin(Math.PI/180))continue;
    if(!best||d<best.d)best={ok:true,via:q.name,d,delay:lt,rate:Math.min(linkRate(P_ROVER,Gr,G_WHIP,Math.max(d,1)),linkRate(P_RADIO,G_WHIP,G_STATION,len(sub(bodyPos(TELLUS,t),add(bodyPos(b,t),fromPF(b,q.pf,t))))))}}
  return best||{ok:false,via:null,delay:lt}}
// relays on a body: vessels in this flight and objects left landed, with an antenna (their base, height, name), and
// relays in its orbit (at: flight time → position in its frame): vessels of this flight and registered ones
function rvRelays(vs){const out=[];for(const v of vs){if(!v||!v.alive||!v.parts.some(p=>p.on&&p.d.kind==='ant'))continue;
    if(!v.landed){if(v.body!==TELLUS)out.push({body:v.body,at:()=>v.r,name:v.name||'the orbiter'});continue}if(!v.pf)continue;out.push({body:v.body,pf:v.pf,h:v.len,name:v.name||'the lander'})}
  for(const q of moonSats())if(q.ant&&satDuty(q)>0)out.push({body:orbBody(q),at:t=>satAt(q,ORB_T0+t)[0],on:t=>satOn(q,ORB_T0+t),name:q.name});   // on: powered then (Q173)
  for(const q of landedUp()){if(!q.shape||!q.shape.some(o=>PARTS[o.k]&&PARTS[o.k].kind==='ant'))continue;const b=landedBody(q);if(b)out.push({body:b,pf:q.pf,h:Math.max(1,...q.shape.map(o=>o.y0+o.h)),name:q.name})}return out}
// a command reaches the rover a round trip late, and not at all out of contact (then it stops and holds)
function rvCommand(R,inp,c){if(!c.ok){R.in={thr:0,steer:0,brake:true};R.cq=[];return}if(!c.delay){R.in=inp;return}
  (R.cq=R.cq||[]).push({t:R.t+c.delay,...inp});while(R.cq.length&&R.cq[0].t<=R.t){const x=R.cq.shift();R.in={thr:x.thr,steer:x.steer,brake:x.brake}}}
// ---- rover science, R4 first slice (sats session, decided with Caio): Selene's geology as drawn, and three instruments
// whose results hinge on what the sim computes. Results count when they reach home (R3's contact), into the logbook.
// Geology: the sky shader's dark maria, smoothstep(.5,.65,fbm(n·1.6+3)−MARE_NEAR·n.x) in Selene's frame (h3/vn/fbm are its
// port), so a rover on a dark patch is on mare basalt. The −n.x term gathers them on the near side (−X faces Tellus), as on
// our Moon (GROUND.md decision 1): 30 % of the near side, 1 % of the far side, 15 % of all. The composition under it is hidden truth, varying smoothly within each unit.
const MARE_NEAR=.24,selMare=pf=>{const u=norm(pf),x=clamp((fbm(u[0]*1.6+3,u[1]*1.6+3,u[2]*1.6+3)-MARE_NEAR*u[0]-.5)/.15,0,1);return x*x*(3-2*x)};
function geoAt(b,pf){if(b!==SELENE)return null;const M=selMare(pf),u=norm(pf),f=k=>fbm(u[0]*k+11,u[1]*k+7,u[2]*k+5);
  const mare={FeO:15+6*f(7),TiO2:.5+11*clamp(fbm(u[0]*4+21,u[1]*4+2,u[2]*4+9)-.3,0,1),Al2O3:9+3*f(5)},high={FeO:3.5+3*f(9),TiO2:.2+.5*f(6),Al2O3:25+5*f(8)};
  const mix=k=>high[k]+(mare[k]-high[k])*M;return{unit:M>=MARE_M?'mare':'high',M,FeO:mix('FeO'),TiO2:mix('TiO2'),Al2O3:mix('Al2O3')}}
const GEO_NAME={mare:'mare basalt',high:'highland rock'},MARE_M=.2;   // mare where it has visibly darkened (~8 % darker)
const SPEC_SD={FeO:1,TiO2:.6,Al2O3:1.2},SPEC_NEAR=30;   // a reading's noise (wt %); a new reading needs 30 m from the last
const SEIS_PACK=4,SEL_CORE=.26*SELENE.R,QV_P=8000,QV_S=4500,QT_SD=.2,QUAKE_DAY=.6,LOC_MAX=15e3;   // the core is hidden truth
const selSci=()=>PROG.sel||(PROG.sel={spec:{mare:[],high:[]},panos:[],seis:[],quakes:[],seq:0,core:null});
const rvItems=(R,k)=>rvGeom(R.d).items.filter(t=>t.k===k).length;
const gauss=r=>{let s=0;for(let i=0;i<6;i++)s+=r();return(s-3)*Math.SQRT2};   // ~N(0,1), deterministic
// why an instrument can't work right now ('' if it can)
function rvSciWhy(R,k){if(!rvItems(R,k==='pano'?'cam':k))return`no ${k==='pano'?'camera mast':RV_IT[k].name.toLowerCase()} on board`;
  if(R.body!==SELENE)return R.body===TELLUS?'nothing new to learn at home':'only Selene has its geology mapped';
  if(R.dead||R.tipped||R.wet)return'the rover is out of action';if(len(R.v)>.05)return'stop first';
  if(k==='seis'&&(R.seisLeft??SEIS_PACK*rvItems(R,'seis'))<=0)return'all its seismometers are set out';return''}
// the instruments: a spectrometer reading, a panorama (its quality is the sun's: low sun shows the relief in long
// shadows, a high sun flattens it, none at night), a seismometer set out. Readings wait in R.data until contact.
function rvSci(R,k,T){const why=rvSciWhy(R,k);if(why){HOOK.msg(`${k==='spec'?'Spectrometer':k==='pano'?'Panorama':'Seismometer'}: ${why}`);return false}
  const P=selSci(),g=geoAt(R.body,R.p),r=rng(9001+P.seq++);R.data=R.data||[];
  if(k==='spec'){if((R.reads||[]).some(p=>len(sub(p,R.p))<SPEC_NEAR)){HOOK.msg('Spectrometer: already read here (drive on 30 m)');return false}
    (R.reads=R.reads||[]).push(R.p.slice());const x={k,unit:g.unit,T,pf:R.p.slice()};for(const c in SPEC_SD)x[c]=Math.max(0,g[c]+SPEC_SD[c]*gauss(r));
    R.data.push(x);HOOK.msg(`Spectrometer: ${GEO_NAME[g.unit]} here, FeO ${x.FeO.toFixed(1)} %${rvSciSent(R)}`);return true}
  if(k==='pano'){const el=Math.asin(clamp(dot(norm(R.p),rvSunPF(R.body,thAbs(R.body,T))),-1,1))*180/Math.PI;if(el<=0){HOOK.msg('Panorama: too dark (the sun is down)');return false}
    const q=panoQ(el);R.data.push({k,q,el,unit:g.unit,T});HOOK.msg(`Panorama taken, sun ${el.toFixed(0)}° up: ${q>.8?'long shadows, the relief stands out':q>.5?'fair':'flat light'} (${(q*100).toFixed(0)} %)${rvSciSent(R)}`);return true}
  if(k==='seis'){R.seisLeft=(R.seisLeft??SEIS_PACK*rvItems(R,'seis'))-1;const st={id:P.seis.length+1,bodyName:R.body.name,pf:mul(norm(R.p),R.body.R),T,buf:[]};st.name=`Seismometer ${st.id}`;
    P.seis.push(st);HOOK.msg(`${st.name} set out (${R.seisLeft} left on board)`);return true}}
const panoQ=el=>el<3?.4*el/3:el<=20?1:Math.max(.3,1-.7*(el-20)/70);
const rvSciSent=R=>R.contact&&R.contact.ok&&R.contact.via!=='crew'?'':' · waits for contact';
// results reaching home: into the program's science and the logbook
function sciGot(x,by){const P=selSci();
  if(x.k==='spec'){const L=P.spec[x.unit];L.push({FeO:x.FeO,TiO2:x.TiO2,Al2O3:x.Al2O3,far:!!(x.pf&&x.pf[0]>0)});/* far: Selene's far side, planet-fixed +X (economy's contracts) */const n=L.length,m=c=>L.reduce((a,y)=>a+y[c],0)/n,sd=n>1?Math.sqrt(L.reduce((a,y)=>a+(y.FeO-m('FeO'))**2,0)/(n-1)):SPEC_SD.FeO;
    logNote(null,x.unit==='mare'?'semare':'sehigh',{FeO:m('FeO'),TiO2:m('TiO2'),Al2O3:m('Al2O3'),se:sd/Math.sqrt(n),n},by)}
  if(x.k==='pano'){P.panos.push({q:x.q,el:x.el,unit:x.unit});logNote(null,'sepano',{q:x.q,el:x.el,unit:x.unit},by)}}
function rvSciSend(R,c){if(!R.data||!R.data.length||!c||!c.ok||c.via==='crew')return 0;const n=R.data.length;for(const x of R.data)sciGot(x,R.name);R.data=[];
  HOOK.msg(`${n} result${n>1?'s':''} from ${R.name} received at home`);return n}
// contact for something on the ground (a field rover, a station) at program time T: R3's rules, relays where they are then
function rvFieldSci(T0,T1){for(const e of PROG.rvOut||[]){if(e.dead||!e.data||!e.data.length)continue;const b=BODIES.find(x=>x.name===e.bodyName)||TELLUS,hg=rvPow(e.d).hg;
  for(let T=T0;T<T1;T+=1800)if(radioAt(b,e.p,hg,Math.min(T+1800,T1)).ok){for(const x of e.data)sciGot(x,e.name);HOOK.news(`${e.name} on ${e.bodyName}: ${e.data.length} result${e.data.length>1?'s':''} received`,'ok');e.data=[];break}}}
function radioAt(b,pf,hg,T){const o=ORB_T0;ORB_T0=T;const c=rvContact({body:b,p:pf,pw:{hg,sol:0,rtg:0},remote:true},0,rvRelays([]));ORB_T0=o;return c}
// ---- the seismic network. Deep moonquakes (QUAKE_DAY a day, 40–60 % of the way out) happen between flights. Each
// station records the P wave and, unless its straight path crossed the liquid core (SEL_CORE, hidden), the S wave.
// Records reach home when the station has contact (each has a small high-gain dish). With 4 stations' P times home, the
// quake is located by least squares; if the array is too small, the fit can't place it (σ > LOC_MAX). Then every path
// from the located quake brackets the core: an S that arrived passed outside it, a missing S went through (each
// bound loosened by twice the location's σ).
function quakesIn(T0,T1){const out=[];for(let k=Math.floor(T0/DAY_S);k*DAY_S<T1;k++){const r=rng(424243+k*7919);
  for(let j=0;j<3;j++){if(r()>(j?QUAKE_DAY*.25:QUAKE_DAY))break;const T=(k+r())*DAY_S,z=2*r()-1,a=2*Math.PI*r(),rr=SELENE.R*(.4+.2*r()),s=Math.sqrt(1-z*z);
    if(T>=T0&&T<T1)out.push({id:k*4+j,T,x:[rr*s*Math.cos(a),rr*z,rr*s*Math.sin(a)]})}}return out.sort((a,b)=>a.T-b.T)}
const rayMin=(x,p)=>{const d=sub(p,x),u=clamp(-dot(x,d)/dot(d,d),0,1);return len(add(x,mul(d,u)))};
function seisTick(T0,T1){const P=PROG.sel;if(!P||!P.seis.length)return;const live=P.seis.filter(s=>s.bodyName==='Selene');if(!live.length)return;
  const Q=quakesIn(T0,T1);let qi=0;
  for(let T=T0;T<T1;T+=1800){const Te=Math.min(T+1800,T1);
    for(;qi<Q.length&&Q[qi].T<Te;qi++){const q=Q[qi],r=rng(q.id*31+7);let n=0;
      for(const st of live){if(st.T>q.T)continue;const L=len(sub(st.pf,q.x)),S=rayMin(q.x,st.pf)>SEL_CORE;n++;
        st.buf.push({q:q.id,tp:q.T+L/QV_P+QT_SD*gauss(r),s:S,ts:S?q.T+L/QV_S+QT_SD*gauss(r):null})}
      if(n)P.quakes.push({id:q.id,T:q.T,got:{},loc:null,tried:false})}
    for(const st of live){if(!st.buf.length)continue;if(!radioAt(SELENE,st.pf,true,Te).ok)continue;
      for(const x of st.buf){const q=P.quakes.find(y=>y.id===x.q);if(q)q.got[st.id]=x}st.buf=[]}}
  for(const q of P.quakes)if(!q.tried&&Object.keys(q.got).length>=4)seisLocate(q)}
// least squares on P times for (x, y, z, t0); restarts from 26 directions at half radius (the array alone can't tell a
// quake under it from one through the moon); σ from the fit's geometry. Then the core bracket from every path.
function seisLocate(q){const P=PROG.sel,st=Object.keys(q.got).map(id=>({p:P.seis.find(s=>s.id===+id).pf,...q.got[id]}));q.tried=true;
  const res=x=>st.map(s=>s.tp-(x[3]+len(sub(x.slice(0,3),s.p))/QV_P)),jac=x=>st.map(s=>{const d=sub(x.slice(0,3),s.p),l=len(d)||1;return[...mul(d,1/(l*QV_P)),1]}),
    nrm=J=>[0,1,2,3].map(a=>[0,1,2,3].map(b=>J.reduce((t,row)=>t+row[a]*row[b],0)));
  let best=null;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){if(!i&&!j&&!k)continue;
    let x=[...mul(norm([i,j,k]),SELENE.R*.5),Math.min(...st.map(s=>s.tp))-40];
    for(let it=0;it<40;it++){const J=jac(x),r=res(x),A=nrm(J);for(let a=0;a<4;a++)A[a][a]+=1e-12;
      const g=[0,1,2,3].map(a=>J.reduce((t,row,m)=>t+row[a]*r[m],0)),C=inv4(A);if(!C)break;
      const dx=C.map(row=>row.reduce((t,v,m)=>t+v*g[m],0));x=x.map((v,m)=>v+dx[m]);if(len(dx.slice(0,3))<1)break}
    const e=res(x).reduce((t,v)=>t+v*v,0);if(len(x.slice(0,3))<SELENE.R&&(!best||e<best.e))best={x,e}}
  if(!best)return;const C=inv4(nrm(jac(best.x))),sig=C?QT_SD*Math.sqrt(Math.max(0,C[0][0]+C[1][1]+C[2][2])):Infinity;if(!(sig<LOC_MAX))return;
  q.loc={x:best.x.slice(0,3),sig};const c=P.core||(P.core={lo:0,hi:Infinity,n:0});c.n++;
  for(const s of st){const m=rayMin(q.loc.x,s.p);if(s.s)c.hi=Math.min(c.hi,m+2*sig);else c.lo=Math.max(c.lo,m-2*sig)}   // ±2σ: the located quake is only so sure
  logNote(null,'secore',{lo:c.lo,hi:c.hi,n:c.n},'the seismic network')}
function inv4(A){const n=4,M=A.map((r,i)=>[...r,...[0,1,2,3].map(j=>i===j?1:0)]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
  if(Math.abs(M[p][c])<1e-30)return null;[M[c],M[p]]=[M[p],M[c]];const d=M[c][c];for(let j=0;j<2*n;j++)M[c][j]/=d;
  for(let r=0;r<n;r++)if(r!==c){const f=M[r][c];if(f)for(let j=0;j<2*n;j++)M[r][j]-=f*M[c][j]}}return M.map(r=>r.slice(n))}

