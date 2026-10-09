// sim/procedures.js — stepping, flight tapes, procedures, headless flights. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- deterministic stepping + flight tapes. Everything that advances the flight goes through advPhys / advRails, and a
// tape records each of those calls plus every control change before it — so playing it back from the pad reproduces the
// flight bit for bit (the planet's spin and Selene's position depend only on time, which starts at 0).
const CHUTE_G=3;   // chutes are reefed: the canopy opens in stages so its own drag never exceeds this many g
// A tape replays bit for bit only on the physics that recorded it. TAPE_V used to be a hand-bumped string ('lp-1.12'), and it
// had gone stale through a dozen physics changes since (terrain, both moons' pull, aero, crew), so an old tape would have
// replayed against new physics and silently diverged. Now it's a fingerprint of the code and data that move a craft: any change
// to them retires old tapes, and procedures (below) are what survive a physics change.
const hashStr=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
const TAPE_V='lp-'+hashStr([physStep,rails,coastPlan,coastStep,pertAcc,pertNear,checkSOI,groundCheck,stage,detach,abort,lesJettison,aeroPass,thermal,structLoads,
  integrateRot,attStep,ctrlAccel,spinFire,rcsStep,contactStep,fleetPhysAll,armStep,bayTick,kepler,bodyRel,advPhys,advRails,igniteOK,procStep].map(f=>f.toString()).join('')
  +JSON.stringify(PARTS)+JSON.stringify(BODIES.map(b=>[b.R,b.mu,b.orb||null,!!b.pert])));
function advPhys(s){if(s.proc){procStep(s);autoLegs(s)}fleetPhysAll(DT);physStep(s,DT);powerStep(s,DT);armStep(s);FLEET.forEach(armStep);contactStep(s,DT);fleetContacts(DT);bayTick(s);FLEET.forEach(bayTick);stepDebris(DT);missionTick(s,DT,true);procSample(s)}   // sampled after the step: it sees a landing in the step that made it
function advRails(s,dt,warp){procSample(s);   // in orbit with the engines off a craft goes straight onto rails: that's where an ascent is recognised as done
  if(!s.landed){if(warp<=4){const n=Math.min(400,Math.max(1,Math.round(dt/DT)));for(let i=0;i<n;i++)attStep(s,dt/n)}
    else{const Y=qrot(s.q,[0,1,0]),sp=dot(s.w,Y);const keep=s.spun||!s.sas&&Math.abs(sp)>=SPIN_MIN;s.w=keep?mul(Y,sp):[0,0,0];   // a spinning stage keeps its spin (the wobble is lost), the axis stays put
      if(s.sas&&s.sasMode!=='stab'&&!keep){const tg=sasTarget(s);if(tg)s.q=tg.q?qnorm(tg.q):qnorm(qmul(qFromTo(qrot(s.q,[0,1,0]),tg),s.q))}}}
  const t0=simT,ok=rails(s,dt),el=simT-t0;powerRails(s,el);if(FLEET.length){simT=t0;for(const v of FLEET)if(v.alive)fleetRails(v,el);simT=t0+el}missionTick(s,dt,false);bayTick(s);FLEET.forEach(bayTick);
  if(warp>4){for(const d of debris)d.mesh&&d.mesh.free&&d.mesh.free();debris.length=0}else stepDebris(dt);
  return ok}
function controls(s){return{th:s.throttle,p:INP.pitch,y:INP.yaw,r:INP.roll,tx:INP.tx,ty:INP.ty,tz:INP.tz,rcs:!!s.rcs,tg:s.tgtV?'v:'+s.tgtV.name:s.target??null,sas:s.sas,mode:s.sasMode,
  node:s.node?(s.node.burning?'burning':JSON.stringify({t:s.node.t,dv:s.node.dv})):null}}
function setControls(s,c){s.throttle=c.th;INP.pitch=c.p;INP.yaw=c.y;INP.roll=c.r;INP.tx=c.tx||0;INP.ty=c.ty||0;INP.tz=c.tz||0;s.rcs=!!c.rcs;
  if('tg' in c){const v=typeof c.tg==='string'&&FLEET.find(x=>'v:'+x.name===c.tg);s.tgtV=v||null;s.target=v?null:c.tg}
  if(s.sas!==c.sas||s.sasMode!==c.mode){s.sas=c.sas;s.sasMode=c.mode;s.hold=null}
  if(c.node!=='burning'){const cur=s.node&&!s.node.burning?JSON.stringify({t:s.node.t,dv:s.node.dv}):null;if(cur!==c.node)s.node=c.node?JSON.parse(c.node):null}}
// ---- procedures (bodies session, 2026-10-08): a flight's intent kept as a guidance plan instead of keypresses, so it still flies
// when things differ (mass, a failed ignition retried, the day, a contract's target orbit) and survives physics changes.
// v1 is the ascent to orbit, the flight players repeat most. Every flight off the pad is sampled (procSample, from advPhys):
// pitch above the horizon and throttle against altitude, the heading, staging done before a tank ran dry, the first cut-off,
// and the orbit it ends in. Once it's in a stable orbit with the engines off, that becomes a procedure for the design, kept
// only if it beats the stored one (less Δv spent to orbit), so a better hand-flown ascent improves every automated one after.
// procStep flies it through SAS 'stab' holds (real torque, real staging), cutting off on goals (apoapsis, periapsis), not times.
const PROC_V=1,procKey=stack=>JSON.stringify(stack);
const tabAt=(tab,h)=>{if(!tab.length)return 0;if(h<=tab[0][0])return tab[0][1];for(let i=1;i<tab.length;i++)if(h<=tab[i][0]){const[a,x]=tab[i-1],[b,y]=tab[i];return x+(y-x)*(h-a)/(b-a)}return tab[tab.length-1][1]};
function procSample(s){if(s.noRec)return;if(s.procRec&&s.procRec.done){procMission(s,s.procRec);return}if(s.body!==TELLUS||s.proc&&s.proc.noRec)return;
  if(!s.procRec){if(s.rec&&simT<1&&len(s.r)-TELLUS.R<2000&&(s.landed||s.rec.launched))s.procRec={pts:[],early:[],az:null};return}   // a flight off the ground, from its first second
  const P=s.procRec;if(P.done||s.landed||!s.alive)return;
  const up=norm(s.r),h=len(s.r)-TELLUS.R,nose=qrot(s.q,[0,1,0]),pitch=Math.asin(clamp(dot(nose,up),-1,1))*57.29578,last=P.pts[P.pts.length-1];
  if(P.az==null&&h>2000){const f=localFrame(s.r),nh=sub(nose,mul(up,dot(nose,up)));if(len(nh)>1e-3)P.az=Math.atan2(dot(nh,f.e),dot(nh,f.n))}
  const el=elements(s.r,s.v,TELLUS.mu);
  if(!P.cut){if(!last||h>last[0]+150||Math.abs(s.throttle-last[2])>0.05)P.pts.push([h,pitch,s.throttle,len(s.v)]);
    if(s.throttle===0&&h>1000&&P.pts.length>5)P.cut={h,ap:el.ap-TELLUS.R}}   // the first cut-off: the ascent is over
  else if(s.throttle===0&&el.e<1&&el.pe>TELLUS.R+TELLUS.atm){P.done=true;P.target={pe:el.pe-TELLUS.R,ap:el.ap-TELLUS.R,inc:Math.acos(clamp(el.h[1]/el.hl,-1,1))*57.29578};
    P.dv=s.rec?s.rec.dv:null;procKeep(s)}}
function procAscent(s,P){const pitch=[],thr=[],vel=[];let hm=-1;for(const[h,q,t,v]of P.pts){if(h<=hm||t<=0)continue;hm=h;pitch.push([Math.round(h),+q.toFixed(1)]);thr.push([Math.round(h),+t.toFixed(2)]);if(v!=null)vel.push([Math.round(h),Math.round(v)])}   // powered samples only: the cut-off isn't a throttle setting
  return{v:PROC_V,kind:'orbit',site:s.site?s.site.id:null,az:P.az??Math.PI/2,pitch,thr,vel,early:P.early.filter(h=>h>50),cutAp:P.cut.ap,target:P.target,dv:P.dv,by:designName(s.stack),day:PROG.day,flight:PROG.flights+1}}
function procKeep(s){const P=s.procRec;if(!P||!P.done||P.dv==null||P.pts.length<5)return null;
  const key=procKey(s.stack),old=(PROG.procs=PROG.procs||{})[key],proc=procAscent(s,P);
  if(old&&!old.prov&&old.dv<=proc.dv+0.5)return null;PROG.procs[key]=proc;   // a provisional one (borrowed by a dry run) gives way to the design's own first flight
  HOOK.news(old&&old.prov?`${proc.by} has flown to orbit itself: its own procedure replaces the borrowed one (${fmtDv(proc.dv)})`:old?`Procedure improved: ${proc.by} to orbit for ${fmtDv(proc.dv)} (was ${fmtDv(old.dv)}); automated flights use it from now on`:`New procedure: ${proc.by} to orbit for ${fmtDv(proc.dv)}; this design can fly itself there from now on`,'ok');HOOK.save();return proc}
// fly a procedure. target overrides the orbit ({pe, ap, inc} in m and degrees): a contract's orbit with the same technique
// After the ascent, a mission log: SOI entries and exits, the last flyby periapsis before a capture (the pass to aim for),
// the last closed orbit before a landing (the capture), landing and take-off (and the stages dropped on the surface), the
// orbit after take-off, and the lowest point of the first pass through the air home. Home and well, it becomes a mission
// procedure for the design and the mission ('Selene:land', 'Selene:orbit'), kept only if it spent less Δv in all.
function procMission(s,P){const M=P.m||(P.m={ev:[],last:s.body,landed:false,surfStage:0}),b=s.body,t=simT;if(M.kept||!s.alive)return;
  if(b!==M.last){M.ev.push({k:b.parent===M.last?'enc':'esc',body:(b.parent===M.last?b:M.last).name,t});M.last=b;M.fresh=true}if(s.throttle>0)M.fresh=true;
  if(s.landed&&!M.landed){M.landed=true;M.ev.push({k:'land',body:b.name,t,v:s.touchV||0,orb:M.orb,pass:M.pass,pf:toPF(b,s.r,simT).map(x=>+x.toFixed(1))})}
  else if(!s.landed&&M.landed){M.landed=false;M.ev.push({k:'takeoff',body:b.name,t,staged:M.surfStage});M.surfStage=0;M.orb=null}
  if(!s.landed&&!(s.throttle>0)&&b!==TELLUS){const el=elements(s.r,s.v,b.mu);
    if(el.e>=1||el.ap>soiAt(b,t)){if(!M.orb&&M.fresh){M.pass=el.pe-b.R;M.fresh=false}}else if(el.pe>b.R)M.orb={pe:el.pe-b.R,ap:el.ap-b.R}}   // the pass as the executor's trim sees it: osculating, right after SOI entry or a burn
  const esc=M.ev.find(e=>e.k==='esc');if(esc&&!M.flybyKept&&!M.ev.some(e=>e.k==='land')&&!M.orbBeforeEsc&&M.pass!=null){M.flybyKept=true;procFlybyKeep(s,P,M,esc.body)}
  if(!esc&&b!==TELLUS&&M.orb){if(M.ev.some(e=>e.k==='takeoff'&&e.body===b.name))M.orbAfterOff=M.orb;else if(!M.ev.some(e=>e.k==='land'))M.orbBeforeEsc=M.orb}
  if(b===TELLUS&&esc&&!s.landed&&M.entryPe==null&&len(s.r)-b.R<b.atm)M.entryPe=elements(s.r,s.v,b.mu).pe-b.R;   // the vacuum perigee it came in on (what the return aims at), not the lowest point it reached
  if(b===TELLUS&&esc&&s.landed){M.kept=true;const R=s.rec;if(R&&R.crewed&&!R.crewOK)return;procMissionKeep(s,P,M)}}
function procFlybyKeep(s,P,M,B){if(!P.target||!s.rec)return null;const sig=`${B}:flyby`,key=procKey(s.stack)+'|'+sig,old=(PROG.procs=PROG.procs||{})[key],dv=s.rec.dv;
  const proc={...procAscent(s,P),kind:'mission',sig,phases:[{k:'transfer',to:B,pass:Math.max(10e3,M.pass)}],dv,crewed:!!s.rec.crewed};if(old&&old.dv<=dv+0.5)return null;PROG.procs[key]=proc;
  HOOK.news(old?`Procedure improved: ${proc.by}, ${B} flyby, for ${fmtDv(dv)} (was ${fmtDv(old.dv)})`:`New procedure: ${proc.by} can fly a ${B} flyby by itself from now on`,'ok');HOOK.save();return proc}
function procMissionKeep(s,P,M){const E=M.ev,enc=E.find(e=>e.k==='enc');if(!enc||!P.target)return null;
  const B=enc.body,land=E.find(e=>e.k==='land'&&e.body===B),off=E.find(e=>e.k==='takeoff'&&e.body===B),esc=E.find(e=>e.k==='esc'&&e.body===B);
  const capOrb=land?land.orb:M.orbBeforeEsc||null,phases=[{k:'transfer',to:B,pass:Math.max(10e3,(land?land.pass:M.pass)??40e3)}];
  if(capOrb)phases.push({k:'capture',ap:capOrb.ap+20e3,pe:Math.max(10e3,capOrb.pe)});
  if(land){if(land.pf)phases[0].site=land.pf;phases.push(land.pf?{k:'land',site:land.pf}:{k:'land'},{k:'surface',t:off?off.t-land.t:600});   // back to the same spot (a base, say)
    const asc=M.orbAfterOff||{pe:15e3,ap:20e3};phases.push({k:'ascend',stage:off?off.staged:0,pitchH:3000,ap:Math.max(asc.pe,asc.ap-2e3),pe:asc.pe})}
  if(!capOrb&&!land)phases.push({k:'home',perigee:M.entryPe??45e3});   // a free return: past the moon and home
  else phases.push({k:'return',perigee:M.entryPe??45e3});
  const sig=`${B}:${land?'land':capOrb?'orbit':'free-return'}`,key=procKey(s.stack)+'|'+sig,old=(PROG.procs=PROG.procs||{})[key],dv=s.rec?s.rec.dv:null;if(dv==null)return null;
  const proc={...procAscent(s,P),kind:'mission',sig,phases,dv,crewed:!!(s.rec&&s.rec.crewed)};
  if(old&&old.dv<=dv+0.5)return null;PROG.procs[key]=proc;
  HOOK.news(old?`Procedure improved: ${proc.by}, ${sig.replace(':',' ')}, for ${fmtDv(dv)} in all (was ${fmtDv(old.dv)})`:`New procedure: ${proc.by} can fly "${sig.replace(':',' ')}" by itself from now on (${fmtDv(dv)} in all)`,'ok');HOOK.save();return proc}
function procStart(s,proc,target){const T={...proc.target,...(target||{})};let az=proc.az;const cutAp=target&&target.ap!=null?target.ap:proc.cutAp??proc.target.ap;   // where the ascent's engines go off
  if(target&&target.inc!=null){const lat=Math.asin(clamp(norm(s.r)[1],-1,1)),c=Math.cos(T.inc*Math.PI/180)/Math.cos(lat);az=Math.asin(clamp(c,-1,1));if(Math.cos(proc.az)<0)az=Math.PI-az}
  s.proc={p:proc,T,az,cutAp,phase:'ascent',ei:0,lit:true,done:false};s.sas=true;s.sasMode='stab';s.hold=norm(s.r);s.throttle=Math.max(0.1,tabAt(proc.thr,0));stage(s)}   // light it now: a landed craft with its engines off would sit on rails
// A deviation: the procedure can't meet its goal from here. It stops and says why; the craft is yours (in a dispatched
// flight, the dispatch hands it to you). s.procDev keeps what happened, for whoever runs the flight.
function procDev(s,kind,why){s.procDev={kind,why,t:simT,phase:s.proc&&s.proc.phase};s.proc=null;s.throttle=0;HOOK.msg(`Procedure stopped: ${why}. You have control`)}
// The corridor around the recorded climb (Q12): what goes wrong before the propellant does. Stopped early, the craft is
// still somewhere a pilot can do something with (or bail out of). Kept loose: a variant with less thrust flies lower and
// slower and is still fine; these catch a climb that has already failed.
//   control  the nose more than 20° off the commanded climb for 5 s (an unstable design, a tumble, a stuck engine)
//   falling  coming down under power, below the cut-off (too little thrust for the weight, an engine out)
//   slow     above 10 km, under 70 % of the speed the recorded flight had at this height
function procCorridor(s,X,p,h,up){if(simT<10)return;const off=Math.acos(clamp(dot(qrot(s.q,[0,1,0]),s.hold||up),-1,1))*57.29578;
  X.offT=off>20?(X.offT||0)+DT:0;if(X.offT>=5)return procDev(s,'control',`lost control of the climb: the nose ${off.toFixed(0)}° off for 5 s`);
  const vv=dot(s.v,up);if(vv<-20&&h<TELLUS.atm)return procDev(s,'falling',`falling back at ${kmS(h)} km before the engines could cut off`);
  if(p.vel&&p.vel.length>3&&h>10e3&&h<=p.vel[p.vel.length-1][0]){const v0=tabAt(p.vel,h);if(len(s.v)<0.7*v0)return procDev(s,'slow',`far behind the recorded climb: ${Math.round(len(s.v))} m/s at ${kmS(h)} km where it flew ${Math.round(v0)}`)}}
function procStep(s){const X=s.proc;if(!X||X.done||!s.alive)return;const p=X.p,T=X.T,up=norm(s.r),h=len(s.r)-TELLUS.R,el=elements(s.r,s.v,TELLUS.mu),f=localFrame(s.r);
  const dirAt=d=>{const hz=add(mul(f.n,Math.cos(X.az)),mul(f.e,Math.sin(X.az))),r=d*Math.PI/180;return norm(add(mul(hz,Math.cos(r)),mul(up,Math.sin(r))))};
  const dry=()=>s.throttle>0&&dvRemaining(s).cur<=0.5&&s.evIdx<s.events.length;
  s.sas=true;
  if(X.phase==='ascent'){s.sasMode='stab';s.hold=dirAt(tabAt(p.pitch,h));s.throttle=Math.max(0.1,tabAt(p.thr,h));
    if(!X.lit){X.lit=true;stage(s);return}   // ignition
    if(dry())stage(s);else if(X.ei<p.early.length&&h>=p.early[X.ei]){X.ei++;stage(s)}
    if(el.ap-TELLUS.R>=X.cutAp){s.throttle=0;X.phase='coast'}else if(dvRemaining(s).tot<=0.5&&X.lit)procDev(s,'short',`out of propellant in the climb, apoapsis ${kmS(el.ap-TELLUS.R)} km`);
    else procCorridor(s,X,p,h,up);return}
  const thrust=activeEngines(s).reduce((a,q)=>a+q.d.thrust*1000,0)||1,vAp=Math.sqrt(TELLUS.mu*(2/el.ap-1/el.a)),tb=(Math.sqrt(TELLUS.mu/el.ap)-vAp)*s.mass/thrust,tAp=timeToNu(el,Math.PI);
  if(X.phase==='coast'){s.sasMode='pro';
    if(!X.chk&&h>TELLUS.atm){X.chk=1;const need=Math.sqrt(TELLUS.mu/el.ap)-vAp,have=dvRemaining(s).tot;
      if(have<need-5){procDev(s,'short',`running short of propellant: ${Math.round(need-have)} m/s short of circularising`);return}}
    s.throttle=h<TELLUS.atm&&el.ap-TELLUS.R<X.cutAp-300?0.3:0;   // drag eats the apoapsis while still in the air: top it up
    X.wake=simT+Math.max(0,tAp-tb/2);if(h>TELLUS.atm&&tAp<=tb/2+0.5)X.phase='circ';return}
  if(X.phase==='circ'){const hz=norm(sub(s.v,mul(up,dot(s.v,up)))),d=sub(mul(hz,Math.sqrt(TELLUS.mu/len(s.r))),s.v);   // toward a circular orbit right here: robust to starting late
    s.sasMode='stab';s.hold=norm(d);s.throttle=Math.min(1,Math.max(0.05,len(d)/(engAcc(s)*2||1)));if(dry())stage(s);
    if(dvRemaining(s).tot<=0.5&&len(d)>=1.5&&el.pe-TELLUS.R<T.pe){procDev(s,'short',`out of propellant circularising, periapsis ${kmS(el.pe-TELLUS.R)} km`);return}
    if(len(d)<1.5||el.pe-TELLUS.R>=T.pe&&el.ap-TELLUS.R<=T.ap+5e3){s.throttle=0;s.sasMode='pro';
      if(p.phases&&p.phases.length){X.phase='mission';X.mi=0;X.sub=null;X.wake=null;HOOK.msg(`Procedure: in orbit; next, ${p.phases[0].k}`)}
      else{X.done=true;X.phase='done';HOOK.msg('Procedure complete: in orbit, you have control')}}return}
  if(X.phase==='mission'){const ph=p.phases[X.mi];if(!MP[ph.k]){X.done=true;return}
    if(MP[ph.k](s,X,ph)){X.mi++;X.sub=null;X.wake=null;X.dv=null;X.got=0;X.fw=0;s.throttle=0;
      if(X.mi>=p.phases.length){X.done=true;X.phase='done';HOOK.msg('Procedure complete: mission flown, you have control')}else HOOK.msg(`Procedure: ${ph.k} done; next, ${p.phases[X.mi].k}`)}}}
// ---- mission procedures (v2, bodies session 2026-10-08): phases after the ascent, each a guidance law with the parameters a
// flight chose: transfer {to, pass}, capture {pe, ap}, land, surface {t}, ascend {stage, pitchH, pe, ap}, return {perigee}.
// Ported from fly_crewlunar.mjs (the hand-written flight that proved them), but steered through SAS: a burn waits until the
// nose is on the burn direction. Coasts set X.wake, so the game warps to them and a headless runner rails to them.
const bodyNamed=n=>BODIES.find(b=>b.name===n),ALIGN=600;   // wake this long before a burn: on rails a SAS hold doesn't turn the craft, and a heavy stack turns slowly
function aimAt(s,dir,tol){s.sas=true;s.sasMode='stab';s.hold=norm(dir);return dot(qrot(s.q,[0,1,0]),s.hold)>=Math.cos(tol*Math.PI/180)}
const engAcc=s=>activeEngines(s).reduce((a,p)=>a+p.d.thrust*1000,0)/s.mass;   // m/s² at full throttle, the stage burning now
const horiz=s=>{const up=norm(s.r);return sub(s.v,mul(up,dot(s.v,up)))};
// an impulse (prograde, normal, radial) that minimises score(Δv): coordinate search, halving the step
function solveDv(s,score,step0=4,maxDv=200){const pro=norm(s.v),nrm=norm(cross(s.r,s.v)),rad=norm(cross(s.v,nrm)),W=d=>add(add(mul(pro,d[0]),mul(nrm,d[1])),mul(rad,d[2]));
  let d=[0,0,0],best=score(W(d)),st=step0;
  for(let it=0;it<120&&st>0.02;it++){let imp=false;for(const ax of[0,2,1])for(const sg of[1,-1]){const c=d.slice();c[ax]+=sg*st;if(len(c)>maxDv)continue;const v=score(W(c));if(v<best){best=v;d=c;imp=true}}if(!imp)st/=2}
  return W(d)}
// burn toward dir at full throttle once aimed; an empty stage drops unless we're past the last one we may shed (X.noAuto)
// a stage runs dry: drop it if another stage with an engine is still to come (never the capsule loose behind the last one)
const dryStage=s=>{if(s.throttle>0&&dvRemaining(s).cur<=0.5&&s.evIdx<s.events.length&&dvPlan(s,0).length>1)stage(s)};
function burnTo(s,X,dir,tol=4){s.throttle=aimAt(s,dir,tol)?1:0;dryStage(s)}
// deliver an impulse X.dv; true when delivered
function impulse(s,X){const need=len(X.dv);if(need<0.05||X.got>=need-0.05){s.throttle=0;return true}
  if(aimAt(s,X.dv,3)){s.throttle=Math.min(1,Math.max(0.05,(need-X.got)/30));X.got+=(s.thrust||0)/s.mass*DT;dryStage(s)}else s.throttle=0;return false}
// raise a low periapsis at apoapsis (horizontal burn); true when pe ≥ peMin
function fixPe(s,X,peMin){const B=s.body,e=elements(s.r,s.v,B.mu);if(e.pe-B.R>=peMin){s.throttle=0;return true}
  if(!X.fw){X.fw=1;X.tBurn=simT+timeToNu(e,Math.PI);X.wake=X.tBurn-ALIGN}
  if(simT<X.tBurn){s.throttle=0;aimAt(s,horiz(s),5);return false}X.wake=null;
  s.throttle=aimAt(s,horiz(s),4)?0.3:0;return false}
// how far a predicted trajectory is from passing B at `pass`: the pass error once it encounters B, else the closest approach
// (plus a million), so a search that starts with a miss still has a slope toward an encounter
// the perigee a trajectory comes home on after passing B (the leg after B's), or null
function homePe(p,B){const i=p.findIndex(x=>x.b===B),L=i>=0?p[i+1]:null;if(!L||L.b!==B.parent)return null;return(L.path&&L.endKind!=='impact'?L.minR:L.el.pe)-L.b.R}
// a pass's geometry: on which side of the moon the periapsis falls (relative to the parent), and which way round it goes
function passShape(L,B){const toP=norm(mul(bodyRel(B,L.t)[0],-1)),nB=norm(cross(B.P,B.Q)),el=L.el;let u=el.P;
  if(el.pe<B.R){const p=el.a*(1-el.e*el.e),nu=-Math.acos(clamp((p/B.R-1)/el.e,-1,1));u=add(mul(el.P,Math.cos(nu)),mul(el.Q,Math.sin(nu)))}   // an impact: where it hits, on the way in
  return{side:dot(u,toP),retro:dot(el.h,nB)<0}}
// a landing site's distance from the arrival orbit's plane (m on the surface), when it's expected to land: the pass, then
// about two hours of capture and waiting. Off-plane is what's expensive to fix in orbit; along the track is only waiting.
function siteOff(L,B,site){const tL=L.t+(L.el.e<1?timeToNu(L.el,0):Math.max(0,-tPe(L.el,L.el.nu)))+7200,u=norm(fromPF(B,site,tL));let n=norm(L.el.h);
  if(L.path&&L.path.length>4){const P=L.path;let i=1;for(let j=1;j<P.length-1;j++)if(len(P[j][0])<len(P[i][0]))i=j;i=Math.min(Math.max(i,1),P.length-2);
    const c=cross(P[i-1][0],P[i+1][0]);if(len(c)>0)n=norm(c)}   // the plane at the low point of the integrated pass: the tide twists it on the way in
  return B.R*Math.asin(Math.min(1,Math.abs(dot(n,u))))}
function passScore(p,B,pass,home,opt){const L=p.find(x=>x.b===B);if(L){let e=Math.abs((L.path?L.endKind==='impact'?elements(L.end,L.endV,B.mu).pe:L.minR:L.el.pe)-B.R-pass);   // the integrated pass where the tide bends it (an impact: the orbit it hits on)
    if(opt){const g=passShape(L,B);if(opt.side==='near'&&g.side<0.3||opt.side==='far'&&g.side>-0.3)e+=3e5;if(opt.retro!=null&&opt.retro!==g.retro)e+=3e5;if(opt.site)e+=siteOff(L,B,opt.site)}
    if(home==null)return e;
    const h=homePe(p,B);return h==null?5e5+e:Math.abs(h-home)+2*Math.max(0,e-0.5*pass)}   // a free return: the way home counts; the pass may sit within half its height
  const p0=p[0];let d=Infinity;
  if(p0.path)for(const[r,t]of p0.path)d=Math.min(d,len(sub(r,bodyRel(B,t)[0])));
  else{const T=p0.el.e<1?p0.el.period:3*86400;for(let i=0;i<=400;i++){const dt=T*i/400;d=Math.min(d,len(sub(kepler(p0.r,p0.v,dt,p0.b.mu)[0],bodyRel(B,p0.t+dt)[0])))}}
  return 1e6+d}
// plan a transfer to an inclined or eccentric moon: arrive at its farther node (it's in our plane there, and slower), on a
// Hohmann-like ellipse from the parking orbit; wait for the parking-orbit pass that leaves closest to the right time. The
// leftover timing (up to half a parking orbit) is the mid-course correction's job.
function transferNode(s,X,ph,B,b){const o=B.orb,Pv=B.P,Qv=B.Q,p=o.a*(1-o.e*o.e),nu1=Math.atan2(-Pv[1],Qv[1]),cands=[nu1,nu1+Math.PI].map(nu=>({nu,r:p/(1+o.e*Math.cos(nu))}));
  const nd=cands[cands[0].r>cands[1].r?0:1],E=2*Math.atan(Math.sqrt((1-o.e)/(1+o.e))*Math.tan(nd.nu/2)),Mn=E-o.e*Math.sin(E),u=norm(add(mul(Pv,Math.cos(nd.nu)),mul(Qv,Math.sin(nd.nu))));
  const r0=len(s.r),a=(r0+nd.r)/2,tof=Math.PI*Math.sqrt(a**3/b.mu),vc=Math.sqrt(b.mu/r0),dvH=Math.sqrt(b.mu*(2/r0-1/a))-vc,tb=dvH/Math.max(engAcc(s),1e-3);
  const TP=2*Math.PI/B.n;let tN=(Mn-o.M0)/B.n-ORB_T0;while(tN-tof<simT+1800+tb)tN+=TP;while(tN-tof-TP>simT+1800+tb)tN-=TP;   // the next passage we can still make
  // when we're opposite the node, on the real parking orbit (its period, not 2πr/v from where we happen to be: over a day of
  // waiting that difference was tens of degrees)
  const tD=tN-tof,el=elements(s.r,s.v,b.mu),ang=r=>Math.atan2(-r[2],r[0]),nuDep=ang(mul(u,-1))-ang(el.P);let t1=simT+timeToNu(el,nuDep);
  const TL=el.period;while(t1+TL<=tD)t1+=TL;if(Math.abs(t1+TL-tD)<Math.abs(t1-tD))t1+=TL;   // the pass nearest the ideal departure
  X.rTo=nd.r;X.tN=tN;X.uN=u;X.sub='wait';X.tBurn=t1-tb/2;X.wake=X.tBurn-ALIGN;HOOK.msg(`Procedure: ${B.name} met at its node ${(nd.r/1e3).toFixed(0)} km out; leaving in ${((X.tBurn-simT)/3600).toFixed(1)} h (${((t1-tD)/60).toFixed(0)} min from ideal)`);return false}
// Landing on a chosen point (Q13): ph.site is a point in the body's own frame (pf, as landed objects are kept). From a
// low, near-circular orbit whose plane the transfer aimed through the site, it waits for the pass that comes closest
// (over the next day: the moon turns under the orbit), then flies a powered descent at the point: the horizontal
// velocity it wants is the one that would stop it at the site under 60 % of its thrust, toward the site, so a late start,
// a stronger engine or a cross-track miss all show up as a velocity error and get steered out; the vertical keeps a fall
// rate that shrinks with height (√ of the height, at 30 % of thrust). The last 30 m are the usual touchdown.
function siteAt(B,site,t){const u=norm(fromPF(B,site,t));return mul(u,B.R+groundAlt(B,toPF(B,u,t)))}   // (the ground there, inertial frame)
function landAt(s,X,ph,B){const A=Math.max(engAcc(s),0.1),plan=dvPlan(s,0);
  // from a higher orbit, down to a low near-circular one first (~10 × 20 km): periapsis down at apoapsis, then apoapsis down at periapsis
  if(!X.sub||X.sub==='lw'){const e=elements(s.r,s.v,B.mu),lo=ph.pe??10e3;
    if(!X.sub&&e.e<1&&(e.pe-B.R>lo+5e3||e.ap-B.R>lo+15e3)){const peFirst=e.pe-B.R>lo+5e3;X.lw=peFirst?'pe':'ap';X.tBurn=simT+timeToNu(e,peFirst?Math.PI:0);X.wake=X.tBurn-ALIGN;X.sub='lw';return false}
    if(X.sub==='lw'){aimAt(s,mul(s.v,-1),5);if(simT<X.tBurn-1e-6){s.throttle=0;return false}X.wake=null;
      const done=X.lw==='pe'?e.pe-B.R<=lo:e.ap-B.R<=lo+10e3||e.ap-e.pe<2e3;if(!done){burnTo(s,X,mul(s.v,-1));return false}s.throttle=0;X.sub=null;return false}}
  if(!X.sub){const el=elements(s.r,s.v,B.mu),P=el.period,w=norm(el.h),aB=0.6*A,vo=len(s.v),lead=(vo*vo/(2*aB)+vo*60)/B.R;   // start this far ahead (+ a minute's travel)
    let best=null;for(let t=0;t<Math.min(86400,30*P);t+=20){const[r]=kepler(s.r,s.v,t,B.mu),u=norm(siteAt(B,ph.site,simT+t)),x=Math.asin(clamp(dot(u,w),-1,1)),
      ah=norm(sub(u,mul(w,dot(u,w)))),ang=Math.atan2(dot(cross(norm(r),ah),w),dot(norm(r),ah));   // the site ahead along the track (rad), and off it
      if(Math.abs(ang-lead)<vo*20/(2*B.R)+1e-4){const sc=Math.abs(x)*B.R;if(!best||sc<best.sc-500)best={t,sc}}}
    if(!best){procDev(s,'nosite','the landing site never comes near the ground track');return false}
    X.tGo=simT+best.t;X.wake=X.tGo-ALIGN;X.sub='wait';X.xtrack=best.sc;HOOK.msg(`Procedure: landing site ${(best.sc/1e3).toFixed(1)} km off the track at its closest; descent in ${((X.tGo-simT)/3600).toFixed(1)} h`);return false}
  if(X.sub==='wait'){s.throttle=0;aimAt(s,mul(sub(s.v,surfVel(B,s.r)),-1),5);if(simT>=X.tGo-1e-6){X.sub='go';X.wake=null}return false}
  if(s.landed){s.throttle=0;X.noAuto=true;X.miss=len(sub(s.r,siteAt(B,ph.site,simT)));return true}
  const up=norm(s.r),vs=sub(s.v,surfVel(B,s.r)),vv=dot(vs,up),vh=sub(vs,mul(up,vv)),g=B.mu/dot(s.r,s.r),hb=len(s.r)-B.R-groundAlt(B,toPF(B,s.r,simT))+s.yBot;
  const S=siteAt(B,ph.site,simT),dvec=sub(S,s.r),dh=sub(dvec,mul(up,dot(dvec,up))),dist=len(dh),aB=0.6*A;
  if(plan.length>1&&dvRemaining(s).cur<=0.5)stage(s);
  if(hb<30){const vt=-Math.max(1.2,0.08*hb);aimAt(s,sub(up,mul(sub(vh,mul(dh,0.05)),0.08)),25);s.throttle=Math.min(1,Math.max(0,(g+1.5*(vt-vv))/A));return false}
  const vt=dist>1?mul(dh,Math.min(Math.sqrt(2*aB*dist),dist/8)/dist):[0,0,0];   // close in, a linear law (dist/8 s): no chatter across the point
  if(!X.brk){const along=dot(dh,norm(vh));   // coast until the site is a braking distance ahead along the track; passed it: plan the next pass
    if(along<0){X.sub=null;return false}if(along>len(vh)**2/(2*aB)){s.throttle=0;aimAt(s,mul(vh,-1),5);return false}X.brk=true}
  if(X.over||len(vh)<15&&dist<300){X.over=true;   // over the site: the usual suicide burn down, steering out what drift is left
    if(plan.length>1&&hb>1500&&dvRemaining(s).cur<1.15*Math.sqrt(2*g*hb+vv*vv)){stage(s);return false}   // a lander that can't finish it drops off high
    aimAt(s,sub(up,mul(sub(vh,vt),0.08)),25);const Au=A*Math.max(0.2,dot(qrot(s.q,[0,1,0]),up)),need=vv<0?vv*vv/(2*Math.max(hb-15,1))+g:0;
    s.throttle=need>0.7*Au?Math.min(1,need/Au):len(sub(vh,vt))>3?0.05:0;return false}
  const ah=mul(sub(vt,vh),1/3),vvT=-Math.min(100,Math.sqrt(2*0.3*A*Math.max(hb-20,0))),av=Math.max(0,g+(vvT-vv)/3);
  let a=add(ah,mul(up,av));const L=len(a);if(L>A){const v2=Math.min(av,A),hs=Math.sqrt(Math.max(0,A*A-v2*v2))/Math.max(len(ah),1e-6);a=add(mul(ah,Math.min(1,hs)),mul(up,v2))}
  const ok=aimAt(s,a,30),c=dot(qrot(s.q,[0,1,0]),norm(a));s.throttle=c>0.5?Math.min(1,len(a)/A):0;return false}
const MP={
  transfer(s,X,ph){const B=bodyNamed(ph.to),b=s.body;
    if(!X.sub&&(B.orb.e>0.05||B.orb.i>0.01))return transferNode(s,X,ph,B,b);
    if(!X.sub){const r0=len(s.r),a=(r0+B.a)/2,tof=Math.PI*Math.sqrt(a**3/b.mu),phi=Math.PI-B.n*tof,ang=r=>Math.atan2(-r[2],r[0]);
      const vc=Math.sqrt(b.mu/r0),dvH=Math.sqrt(b.mu*(2/r0-1/a))-vc,tb=dvH/Math.max(engAcc(s),1e-3),wn=vc/r0-B.n;
      const lead=((ang(bodyRel(B,simT)[0])-ang(s.r)-phi)%(2*Math.PI)+4*Math.PI)%(2*Math.PI);let wait=lead/wn-tb/2;if(wait<0)wait+=2*Math.PI/wn;
      if(ph.sunFar)for(let k=0;k<200&&dot(norm(bodyRel(B,simT+wait+tb/2+tof)[0]),SUN_DIR)<0.4;k++)wait+=2*Math.PI/wn;   // the far side lit at arrival: the moon on the sun's side
      X.sub='wait';X.tBurn=simT+wait;X.wake=X.tBurn-ALIGN;return false}
    if(X.sub==='wait'){s.throttle=0;aimAt(s,s.v,5);if(simT>=X.tBurn-1e-6){X.sub='burn';X.wake=null}return false}
    if(X.sub==='burn'){if(elements(s.r,s.v,b.mu).ap>=(X.rTo||B.a*0.995)){if(typeof DEBUG_PROC!=='undefined'&&X.uN){const e=elements(s.r,s.v,b.mu),ad=mul(e.P,-1),tA=simT+timeToNu(e,Math.PI);HOOK.msg(`after the burn: apoapsis ${(e.ap/1e3).toFixed(0)} km at ${(tA/3600).toFixed(2)} h vs node ${(X.tN/3600).toFixed(2)} h; apoapsis direction off the node by ${(Math.acos(Math.min(1,dot(ad,X.uN)))*57.3).toFixed(1)}°`)}s.throttle=0;X.sub='coast';X.wake=simT+2*3600;X.mccN=0;return false}burnTo(s,X,s.v);return false}
    // a free return (the next phase is 'home'): the corrections also aim at the perigee it will come home on after the flyby
    const nxt=X.p.phases[X.mi+1],home=nxt&&nxt.k==='home'?nxt.perigee:null;
    if(X.sub==='coast'){s.throttle=0;s.sasMode='pro';if(simT<X.wake)return false;X.wake=null;
      const sc0=passScore(predict(s),B,ph.pass,home,ph);X.dv=solveDv(s,dv=>passScore(predictFrom({b:s.body,r:s.r,v:add(s.v,dv),t:simT}),B,ph.pass,home,ph)+0.01*len(dv),8,400);X.got=0;X.sub='mcc';X.mccN=(X.mccN||0)+1;
      if(typeof DEBUG_PROC!=='undefined')HOOK.msg(`MCC ${X.mccN}: score ${(sc0/1e3).toFixed(0)} → ${(passScore(predictFrom({b:s.body,r:s.r,v:add(s.v,X.dv),t:simT}),B,ph.pass,home,ph)/1e3).toFixed(0)} km-ish with ${len(X.dv).toFixed(1)} m/s`);return false}
    if(X.sub==='mcc'){if(!impulse(s,X))return false;const p=predict(s),L=p.find(x=>x.b===B),hp=home!=null?homePe(p,B):null;
      const off=!L||(home!=null?(hp==null||Math.abs(hp-home)>20e3):Math.abs(L.el.pe-B.R-ph.pass)>20e3)||passScore(p,B,ph.pass,null,ph)>=3e5||!!(ph.site&&L&&siteOff(L,B,ph.site)>3e3);   // wrong side or sense counts as off too, and a landing site off the plane
      if(off&&X.mccN<3){X.sub='coast';X.wake=simT+3*3600;return false}   // not there yet: correct again later
      if(off&&!L){procDev(s,'offcourse',`three corrections and still no encounter with ${B.name}`);return false}
      X.sub='toSOI';X.wake=p[0].endT?p[0].endT+60:simT+3600;return false}
    if(X.sub==='toSOI'){s.throttle=0;s.sasMode='pro';if(s.body!==B){if(simT>=X.wake)X.wake=simT+600;return false}X.wake=null;
      X.dv=home!=null||ph.side||ph.retro!=null||ph.site||B.pert?solveDv(s,dv=>passScore(predictFrom({b:s.body,r:s.r,v:add(s.v,dv),t:simT}),B,ph.pass,home,ph)+0.01*len(dv),2,100)   // a moon the tide bends: the integrated pass
        :solveDv(s,dv=>{const e=elements(s.r,add(s.v,dv),B.mu);return Math.abs(e.pe-B.R-ph.pass)+0.01*len(dv)},2,100);X.got=0;X.sub='trim';return false}
    return impulse(s,X)},
  capture(s,X,ph){const B=s.body;
    if(!X.sub){const el=elements(s.r,s.v,B.mu),vp=Math.sqrt(B.mu*(2/el.pe-1/el.a)),vc=Math.sqrt(B.mu/el.pe),tb=(vp-vc)/Math.max(engAcc(s),1e-3);
      X.tBurn=simT+Math.max(0,timeToNu(el,0)-tb/2);X.wake=X.tBurn-ALIGN;X.sub='wait';return false}
    if(X.sub==='wait'){s.throttle=0;aimAt(s,mul(s.v,-1),5);
      if(!X.fine&&simT>=X.wake-1){X.fine=1;const el=elements(s.r,s.v,B.mu),vp=Math.sqrt(B.mu*(2/el.pe-1/el.a)),vc=Math.sqrt(B.mu/el.pe);X.tBurn=simT+Math.max(0,timeToNu(el,0)-(vp-vc)/Math.max(engAcc(s),1e-3)/2)}   // awake, close in: the tide has moved periapsis since the SOI entry
      if(simT>=X.tBurn-1e-6){X.sub='burn';X.wake=null}return false}
    if(X.sub==='burn'){const e=elements(s.r,s.v,B.mu);if(e.e<1&&e.ap-B.R<ph.ap){s.throttle=0;X.sub='fix';return false}burnTo(s,X,mul(s.v,-1));return false}
    return fixPe(s,X,ph.pe)},
  land(s,X,ph){const B=s.body;if(ph.site)return landAt(s,X,ph,B);
    // first bring periapsis down near the ground (a small burn at apoapsis): braking low saves the fall, ~√(2gh) of Δv
    if(!X.sub){const e=elements(s.r,s.v,B.mu),peT=ph.pe??5e3;if(e.e<1&&e.pe-B.R>peT+2e3){X.tBurn=simT+timeToNu(e,Math.PI);X.wake=X.tBurn-ALIGN;X.sub='dwait';return false}
      X.tBurn=simT+Math.max(0,timeToNu(e,0)-60);X.wake=X.tBurn-ALIGN;X.sub='wait';X.fine=0;return false}
    if(X.sub==='dwait'){s.throttle=0;aimAt(s,mul(s.v,-1),5);if(simT>=X.tBurn-1e-6){X.sub='deorbit';X.wake=null}return false}
    if(X.sub==='deorbit'){if(elements(s.r,s.v,B.mu).pe-B.R<=(ph.pe??5e3)){s.throttle=0;X.sub=null;return false}burnTo(s,X,mul(s.v,-1));return false}
    if(X.sub==='wait'){s.throttle=0;aimAt(s,mul(s.v,-1),5);if(!X.fine&&simT>=X.wake-1){X.fine=1;X.tBurn=simT+Math.max(0,timeToNu(elements(s.r,s.v,B.mu),0)-60)}if(simT>=X.tBurn-1e-6){X.sub='go';X.wake=null}return false}
    if(s.landed){s.throttle=0;X.noAuto=true;return true}
    const up=norm(s.r),vs=sub(s.v,surfVel(B,s.r)),vv=dot(vs,up),vhv=sub(vs,mul(up,vv)),vh=len(vhv),hb=len(s.r)-B.R-groundAlt(B,toPF(B,s.r,simT))+s.yBot,g=B.mu/dot(s.r,s.r),A=Math.max(engAcc(s),0.1),plan=dvPlan(s,0);
    // drop a stage that can't finish the descent while there's height to switch, and finish on the next
    if(vh<=15&&plan.length>1&&hb>1500&&dvRemaining(s).cur<1.15*Math.sqrt(2*g*hb+vv*vv)){stage(s);return false}
    if(typeof DEBUG_PROC!=="undefined"&&(X.dbgT==null||simT-X.dbgT>(hb<4000?0.5:30))){X.dbgT=simT;HOOK.msg(`land: h ${(hb/1e3).toFixed(2)} km r-h ${((len(s.r)-B.R)/1e3).toFixed(2)} vv ${vv.toFixed(1)} vh ${vh.toFixed(1)} thr ${s.throttle.toFixed(2)} nose·up ${dot(qrot(s.q,[0,1,0]),up).toFixed(2)} stage dv ${dvRemaining(s).cur.toFixed(0)} plan ${plan.length} A ${A.toFixed(2)}`)}
    if(vh>(X.braked?40:15)){burnTo(s,{noAuto:plan.length<2},mul(vs,-1),10);return false}X.braked=true;   // braking: kill the speed over the ground (once; after that the tilt below handles what drift is left)
    aimAt(s,sub(up,mul(vhv,0.08)),25);
    const Au=A*Math.max(0.2,dot(qrot(s.q,[0,1,0]),up));   // only the upward part of the thrust stops the fall (a heavy stack on wheels wanders while it coasts)
    if(hb>30){const need=vv<0?vv*vv/(2*Math.max(hb-15,1))+g:0;s.throttle=need>0.7*Au?Math.min(1,need/Au):0}   // suicide burn, with 30 % in hand
    else{const vt=-Math.max(1.2,0.08*hb);s.throttle=Math.min(1,Math.max(0,(g+1.5*(vt-vv))/A))}
    if(s.throttle>0&&plan.length>1&&dvRemaining(s).cur<=0.5)stage(s);return false},
  surface(s,X,ph){s.throttle=0;if(!X.sub){X.sub='wait';X.wake=simT+(ph.t||600)}return simT>=X.wake-1e-6},
  ascend(s,X,ph){const B=s.body;
    if(!X.sub){for(let i=0;i<(ph.stage||0);i++)stage(s);while(dvRemaining(s).cur<=0.5&&s.evIdx<s.events.length&&dvPlan(s,0).length>0)stage(s);
      // a stage that can't reach orbit by itself (the lander came down on it) stays behind, if there's one under it that can
      const need=1.2*Math.sqrt(B.mu/(B.R+ph.ap));while(dvPlan(s,0).length>1&&dvRemaining(s).cur<need&&s.evIdx<s.events.length)stage(s);X.sub='up';X.noAuto=true}
    if(X.sub==='up'){const up=norm(s.r),h=len(s.r)-B.R,pitch=Math.max(0,90-90*Math.min(1,h/(ph.pitchH||3000)))*Math.PI/180,east=norm(cross([0,1,0],s.r));
      aimAt(s,add(mul(up,Math.sin(pitch)),mul(east,Math.cos(pitch))),20);s.throttle=1;
      if(elements(s.r,s.v,B.mu).ap-B.R>ph.ap){s.throttle=0;X.sub='fix';X.fw=0}return false}
    return fixPe(s,X,ph.pe)},
  home(s,X,ph){if(!X.sub){X.sub='out';X.wake=simT+3600}return MP.return(s,X,ph)},   // a free return: out of the moon's SOI, correct the perigee, shed the stage, entry
  return(s,X,ph){const B=s.body,P=B.parent||B,perigee=p=>{const L=p.find((x,i)=>x.b===P&&(i>0||!B.parent));return L?(L.path&&L.endKind!=='impact'?L.minR:L.el.pe)-P.R:null},
      perigeeAt=p=>{const L=p.find((x,i)=>x.b===P&&(i>0||!B.parent));if(!L)return Infinity;if(L.path){let m=Infinity,tm=Infinity;for(const[r,t]of L.path){const d=len(r);if(d<m){m=d;tm=t}}return tm}
        return L.t+(L.el.e<1?timeToNu(L.el,0):Math.max(0,-tPe(L.el,L.el.nu)))};   // when it gets there (the crew has 10 days of air)   // an impact leg's lowest point is the ground: use the orbit's (negative) perigee, so a search has a slope to follow
    if(!X.sub){const e=elements(s.r,s.v,B.mu),Pd=e.period,aboard=dvRemaining(s).tot;let best=null;   // everything aboard: an empty stage drops on the way
      const nT=B.orb&&B.orb.e>0.05?24:48;for(let i=0;i<nT;i++){const dt=Pd*i/nT,[r,v]=kepler(s.r,s.v,dt,B.mu);
        for(let dv=200;dv<=Math.min(B.orb&&B.orb.e>0.05?1500:900,0.9*aboard);dv+=B.orb&&B.orb.e>0.05?25:10){const pe=perigee(predictFrom({b:B,r,v:add(v,mul(norm(v),dv)),t:simT+dt}));if(pe==null)continue;
          const p2=predictFrom({b:B,r,v:add(v,mul(norm(v),dv)),t:simT+dt}),late=perigeeAt(p2)-(simT+dt)>2.5*86400;   // home within 2.5 days, not the long way round
          const sc=dv+5*Math.max(0,Math.abs(pe-ph.perigee)-50e3)/1e3+(late?1e5:0);if(!best||sc<best.sc)best={sc,dt,dv,r,v}}}   // the smallest burn that gets within 50 km of the perigee (the correction does the rest); 5 m/s per km beyond
      if(!best){procDev(s,'nohome','no way home found from here with what is aboard');return false}
      HOOK.msg(`Procedure: burn home in ${(best.dt/60).toFixed(0)} min, ${best.dv} m/s (${dvRemaining(s).cur.toFixed(0)} m/s aboard)`);
      X.e2=dot(best.v,best.v)+2*best.dv*len(best.v)+best.dv**2-2*B.mu/len(best.r);X.tBurn=simT+Math.max(0,best.dt-best.dv/Math.max(engAcc(s),1e-3)/2);X.wake=X.tBurn-ALIGN;X.sub='wait';return false}
    if(X.sub==='wait'){s.throttle=0;aimAt(s,s.v,5);if(simT>=X.tBurn-1e-6){X.sub='burn';X.wake=null}return false}
    if(X.sub==='burn'){if(dot(s.v,s.v)-2*B.mu/len(s.r)>=X.e2){s.throttle=0;X.sub='out';X.wake=simT+3600;return false}burnTo(s,X,s.v);return false}
    if(X.sub==='out'){s.throttle=0;s.sasMode='pro';if(s.body!==P||simT<X.wake){if(simT>=X.wake)X.wake=simT+3600;return false}X.wake=null;
      X.dv=solveDv(s,dv=>{const pe=perigee(predictFrom({b:P,r:s.r,v:add(s.v,dv),t:simT}));return pe==null?1e9:Math.abs(pe-ph.perigee)+0.01*len(dv)},4,300);X.got=0;X.sub='corr';return false}
    if(X.sub==='corr'){if(!X.logged){X.logged=1;const pe0=perigee(predict(s));HOOK.msg(`Procedure: correction ${len(X.dv).toFixed(1)} m/s, perigee ${pe0!=null?(pe0/1e3).toFixed(0):'?'} → ${(ph.perigee/1e3).toFixed(0)} km`)}if(!impulse(s,X))return false;{const pe1=perigee(predict(s));HOOK.msg(`Procedure: after the correction, perigee ${pe1!=null?(pe1/1e3).toFixed(1):'?'} km`)}X.sub='in';return false}
    if(X.sub==='in'){s.throttle=0;s.sasMode='pro';if(len(s.r)-P.R>3e6){X.wake=simT+600;return false}X.wake=null;
      while(s.evIdx<s.events.length&&s.parts.some(q=>q.on&&q.d.kind==='engine'))stage(s);while(s.evIdx<s.events.length)stage(s);   // drop the return stage, arm the chute
      X.sub='entry';return false}
    s.throttle=0;s.sas=true;s.sasMode='retro';return s.landed||!s.alive}};   // shield first (retrograde to the air), chute
// ---- a procedure flown headless (bodies session; the physics side of dispatch, NOTES "Procedures: automation that adapts").
// The same executor and physics as a watched flight, but isolated from whatever else is going on: the flight on screen (if
// any), the fleet, debris, the moons' clock and the hooks are set aside and put back. Its record is closed (no costs, no
// missions, no logbook) and it records no procedure. opt: {site, T0 (program time at lift-off), maxT, noRelight (the
// upper stage won't light for the circularisation: a deviation there), name}. Returns {ok, orb, dv, t, s} in orbit,
// {dev: {kind, why}, entry, ...} on a deviation (entry: a registry entry of the craft at that moment, for vesselOf), or
// {ok: false, why} if it was lost.
function regEntry(s,stack,T,name){const on=s.parts.filter(p=>p.on);
  return{stack:JSON.parse(JSON.stringify(stack)),shape:shapeOf(on,false),vst:vstOf(s),r:s.r.slice(),v:s.v.slice(),epoch:T,qo:qmul(qconj(orbQ(s.r,s.v)),s.q),cm:(s.cm||[0,0,0]).slice(),name,attached:[]}}
function procFly(stack,proc,target,opt={}){
  const keep={S,simT,T0:ORB_T0,fleet:FLEET.splice(0),debris:debris.splice(0),junk:JUNK.splice(0),vn:vesselN,hook:{...HOOK}};
  for(const k of Object.keys(HOOK))if(typeof HOOK[k]==='function'&&k!=='dispatchRun')HOOK[k]=()=>{};const log=[];HOOK.msg=m=>log.push(m);
  const T0=opt.T0??Math.ceil((PROG.day||0)-1e-9)*DAY_S;if(ORB_ABS)ORB_T0=T0;   // a whole day: the ground under the flight is where it is at T0
  let out;
  try{simT=0;const s=newShip(stack,opt.site||homeSites()[0]||curSite());S=s;s.noRec=true;const R=s.rec=recNew();Object.assign(R,{launched:true,ended:true,day0:T0/DAY_S});
    procStart(s,proc,target);let dv=0,k=0;const lim=opt.maxT??(proc.phases&&proc.phases.length?30*86400:3*3600);
    while(s.alive&&s.proc&&!s.proc.done&&simT<lim&&k++<3e6){const X=s.proc;
      if(opt.noRelight&&X.phase==='circ'){procDev(s,'relight','the upper stage failed to relight for the circularisation');break}
      if(X.wake>simT+2&&railsOK(s))advRails(s,Math.min(600,X.wake-simT),1000);else{const m=s.mass;advPhys(s);dv+=(s.thrust||0)/m*DT}}
    const name=opt.name||`${designName(stack)||'Flight'}`,el=elements(s.r,s.v,s.body.mu);
    if(!s.alive)out={ok:false,why:(log.filter(m=>/Destroyed|broke|burn/i.test(m)).pop()||'it was lost').replace(/^Destroyed — /,''),dv,t:simT,s,log};
    else if(s.procDev)out={ok:false,dev:s.procDev,entry:regEntry(s,stack,T0+simT,name),dv,t:simT,s};
    else if(!s.proc||!s.proc.done){s.procDev={kind:'lost',why:'the procedure lost its way',t:simT};out={ok:false,dev:s.procDev,entry:regEntry(s,stack,T0+simT,name),dv,t:simT,s}}
    else out={ok:true,orb:{pe:el.pe-s.body.R,ap:el.ap-s.body.R,inc:Math.acos(clamp(el.h[1]/el.hl,-1,1))*180/Math.PI},body:s.body.name,dv,t:simT,s,log};
  }finally{S=keep.S;simT=keep.simT;ORB_T0=keep.T0;FLEET.length=0;FLEET.push(...keep.fleet);debris.length=0;debris.push(...keep.debris);JUNK.length=0;JUNK.push(...keep.junk);vesselN=keep.vn;Object.assign(HOOK,keep.hook)}
  return out}
// A dry run (the trajectory office's study, NOTES "Procedures: automation that adapts", part 3): another design's procedure
// flown headless on this design. Margin is what's left aboard in orbit. procAdopt tries every stored orbit procedure whose
// design has the same number of engine stages (a different staging structure needs a hand-flown run-through) and keeps the
// cheapest that reaches orbit as this design's, provisional: dispatchable, measured on this design, given way to the
// design's own first flight. (The economy decides what a study costs and how much wider a provisional estimate is.)
function dryRun(stack,proc,target){const f=procFly(stack,proc,target);return{...f,margin:f.ok?dvRemaining(f.s).tot:null}}
const engStages=stack=>dvPlan(newShip(stack),0).length;
function procAdopt(stack,target){const key=procKey(stack),own=(PROG.procs||{})[key];if(own&&!own.prov)return{ok:false,why:'this design has its own procedure'};
  const n=engStages(stack),tried=[];let best=null;
  for(const k in PROG.procs||{}){const pr=PROG.procs[k];if(k===key||pr.kind!=='orbit'||!pr.pitch||pr.prov)continue;let st;try{st=JSON.parse(k)}catch(e){continue}
    if(engStages(st)!==n){tried.push({by:pr.by,why:'different staging'});continue}
    const f=dryRun(stack,pr,target);tried.push({by:pr.by,ok:f.ok,why:f.ok?'':f.dev?f.dev.why:f.why,dv:f.dv,margin:f.margin});
    if(f.ok&&(!best||f.dv<best.f.dv))best={pr,f}}
  if(!best)return{ok:false,why:tried.length?'no stored procedure gets this design to orbit':'no stored procedure to try',tried};
  const proc={...best.pr,dv:best.f.dv,by:designName(stack)||'our design',prov:true,from:best.pr.by,day:PROG.day,flight:null};
  (PROG.procs=PROG.procs||{})[key]=proc;HOOK.news(`Dry run: ${best.pr.by}'s procedure gets ${proc.by} to orbit with ${fmtDv(best.f.margin)} to spare. Provisional until the design flies it itself`,'ok');HOOK.save();
  return{ok:true,proc,margin:best.f.margin,tried}}
// dispatch's flight (dispatchTick calls it): what the parts data can't fly is still rolled with the dispatch's seed (breakup
// from certification, an engine that won't light in the ascent, the upper stage's relight); the rest is flown. Running short
// is no longer a roll: the procedure flies the design to this contract's orbit and either gets there or hands the craft over
// where it stopped.
function dispatchRun(D,v,c){const R=rng(D.seed),e=dispatchEstimate(D.stack,c);if(!e.ok)return{ok:false,why:e.why};if(!e.proc.pitch)return dispatchRoll(D,v,c);   // a procedure with no guidance to fly (an old save's stub): the roll
  if(R()>=e.pS)return{ok:false,why:'it broke up in the climb'};if(R()>=e.pLow)return{ok:false,why:'an engine failed to light in the ascent; range safety ended the flight'};
  const f=procFly(D.stack,e.proc,dispatchTarget(c),{noRelight:R()>=e.pRelight,name:`${designName(D.stack)||'Dispatch'} ${D.id}`});
  if(f.dev)return{deviation:{kind:f.dev.kind,why:f.dev.why,entry:f.entry}};
  if(!f.ok)return{ok:false,why:f.why};
  return{ok:true,orb:{...f.orb,sci:v.parts.some(p=>p.on&&p.d.kind==='sci'),cam:v.parts.some(p=>p.on&&p.d.kind==='cam')},dv:f.dv}}
function tapeNew(stack,site){return{v:TAPE_V,stack:JSON.parse(JSON.stringify(stack)),ops:[],lastK:null,site:site?site.id:null}}   // a tape flies from the site it was recorded at
function tapeCtl(T,s){const c=controls(s),k=JSON.stringify(c);if(k!==T.lastK){T.ops.push(['C',c]);T.lastK=k}}
function tapePhys(T,s){tapeCtl(T,s);const o=T.ops[T.ops.length-1];if(o&&o[0]==='P')o[1]++;else T.ops.push(['P',1]);advPhys(s)}
function tapeRails(T,s,dt,warp){tapeCtl(T,s);T.ops.push(['R',dt,warp]);return advRails(s,dt,warp)}
function tapeStage(T,s){tapeCtl(T,s);T.ops.push(['S']);stage(s)}
function tapeAbort(T,s){tapeCtl(T,s);T.ops.push(['A']);abort(s)}
function tapeArm(T,s,op){tapeCtl(T,s);T.ops.push(['A',op]);armOp(s,op)}
function tapeBay(T,s,op){tapeCtl(T,s);T.ops.push(['B',op]);bayOp(s,op)}
function tapeLegs(T,s,op){tapeCtl(T,s);T.ops.push(['G',op]);legOp(s,op)}
function tapeWings(T,s,op){tapeCtl(T,s);T.ops.push(['W',op]);wingOp(s,op)}
function tapeRover(T,s,pi){tapeCtl(T,s);T.ops.push(['Y',pi]);const p=s.parts[pi];return p?rvDeploy(s,p):null}
function tapeLoad(T,s,id){const q=satsUp().find(x=>x.id===id);if(!q)return null;tapeCtl(T,s);T.ops.push(['L',id]);return loadEntry(q,s)}
function tapeSwitch(T,s,i){tapeCtl(T,s);T.ops.push(['V',i]);switchTo(i)}
function tapeUndock(T,s,id){tapeCtl(T,s);T.ops.push(['D',id]);undock(s,id)}
function tapeDuration(T){let d=0;for(const o of T.ops)d+=o[0]==='P'?o[1]*DT:o[0]==='R'?o[1]:0;return d}
// play up to `budget` steps (a rails jump counts as one); returns false once the tape is used up
function tapePlay(pl,s,budget){const ops=pl.tape.ops;
  while(budget>0&&pl.i<ops.length&&s.alive){const o=ops[pl.i];
    if(o[0]==='C'){setControls(s,o[1]);pl.i++}
    else if(o[0]==='S'){stage(s);pl.i++}
    else if(o[0]==='A'&&o[1]==null){abort(s);pl.i++}   // (an arm op is ['A', op]: below)
    else if(o[0]==='D'){undock(s,o[1]);pl.i++}
    else if(o[0]==='V'){switchTo(o[1]);s=S;pl.i++}
    else if(o[0]==='B'){bayOp(s,o[1]);pl.i++}
    else if(o[0]==='G'){legOp(s,o[1]);pl.i++}
    else if(o[0]==='W'){wingOp(s,o[1]);pl.i++}
    else if(o[0]==='Y'){const p=s.parts[o[1]];if(p)rvDeploy(s,p);pl.i++}
    else if(o[0]==='A'){armOp(s,o[1]);pl.i++}
    else if(o[0]==='L'){const q=satsUp().find(x=>x.id===o[1]);if(q)loadEntry(q,s);pl.i++}
    else if(o[0]==='R'){advRails(s,o[1],o[2]);pl.i++;budget--}
    else{const k=Math.min(budget,o[1]-pl.n);for(let j=0;j<k;j++)advPhys(s);pl.n+=k;budget-=k;if(pl.n>=o[1]){pl.i++;pl.n=0}}}
  return pl.i<ops.length&&s.alive}
// the tape so far, when the pilot takes over mid-replay (recording continues from there)
function tapeCut(pl){const T=tapeNew(pl.tape.stack,siteById(pl.tape.site));T.orbT0=pl.tape.orbT0;T.ops=JSON.parse(JSON.stringify(pl.tape.ops.slice(0,pl.i)));if(pl.n)T.ops.push(['P',pl.n]);
  for(let i=T.ops.length-1;i>=0;i--)if(T.ops[i][0]==='C'){T.lastK=JSON.stringify(T.ops[i][1]);break}return T}
