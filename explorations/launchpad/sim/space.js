// sim/space.js — the registry, rendezvous, contact, docking, fleets, the bay, stations, the arm, moonbases, moon orbits, RCS. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- the orbital registry: what we leave in orbit stays there, on exact Kepler rails across program time.
// One absolute frame for everything: program time T (s) = day × DAY_S; Tellus's angle is th0 + rot·T. Flights lift off at
// the daily launch window (a whole day), so a flight's own frame (its clock starting at 0) is this frame exactly and a
// satellite registered at the end of one flight is in the right place, over the right ground, in the next.
// (Selene's phase still restarts with each flight; nothing in the registry depends on it yet.)
const absTh=T=>TELLUS.th0+TELLUS.rot*T,satAt=(q,T)=>kepler(q.r,q.v,T-q.epoch,orbBody(q).mu);   // in its body's frame (orbBody)
const SAT_FOV=30*Math.PI/180,SAT_IFOV=1e-5,SUN_MIN=Math.sin(10*Math.PI/180),STA_MIN=Math.sin(5*Math.PI/180),CLEAR=0.35,SAT_STEP=30;
// ground stations: the pad, plus any the program builds at cities. At home a station is just a purchase; on another
// power's land it needs their permission (friendly relations with home, a fair opinion of us), costs more, pays a lease
// every 100 days, and is shut down if relations turn tense. More, better-spread stations mean pictures come down sooner.
const GS_HOME=10,GS_FOREIGN=20,GS_LEASE=2,IMG_RATE=0.12;   // imagery sales: M per day at 100 % contact
function padGS(){const t=curSite();return{name:t.name,u:t.u,power:t.power}}   // the pad's own station: the chosen launch site
function stationsAll(){return[padGS(),...(PROG.stations||[]).map(g=>{const c=CITIES[g.ci];return{name:c.name,u:c.u,power:c.power?c.power.i:HOME,ci:g.ci}})]}
// candidate sites: each power's two biggest cities that don't have a station yet
function gsSites(){const have=new Set((PROG.stations||[]).map(g=>g.ci)),out=[];
  for(const pw of POWERS){const cs=CITIES.map((c,i)=>({c,i})).filter(x=>x.c.power===pw).sort((a,b)=>b.c.pop-a.c.pop).slice(0,2);for(const x of cs)if(!have.has(x.i))out.push(x.i)}return out}
// can we build at city ci? {ok, cost, why}
function gsCheck(ci){const c=CITIES[ci],pw=c.power?c.power.i:HOME,home=pw===HOME,cost=home?GS_HOME:GS_FOREIGN;
  if((PROG.stations||[]).some(g=>g.ci===ci))return{ok:false,cost,why:'already built'};
  if(!home){const r=relOf(HOME,pw);if(r<=0.2)return{ok:false,cost,why:`${POWERS[pw].root} won't allow it (relations ${relWord(r)})`};
    if(opOf(pw)<45)return{ok:false,cost,why:`${POWERS[pw].root} doesn't trust us enough yet (opinion ${opOf(pw).toFixed(0)})`}}
  if(PROG.funds<cost)return{ok:false,cost,why:'not enough funds'};return{ok:true,cost,why:''}}
function buildStation(ci){const v=gsCheck(ci);if(!v.ok)return v;const c=CITIES[ci],pw=c.power?c.power.i:HOME;
  PROG.funds-=v.cost;(PROG.stations=PROG.stations||[]).push({ci,built:PROG.day});if(pw!==HOME)opAdd(pw,2);
  HOOK.news(pw===HOME?`New ground station opens at ${c.name}`:`Ground station opens at ${c.name}, ${POWERS[pw].name}: the dishes point up, the lease is signed`,'ok');HOOK.save();return v}
function stationsTick(d){const L=PROG.stations||[];if(!L.length)return;
  for(let i=L.length-1;i>=0;i--){const c=CITIES[L[i].ci],pw=c.power?c.power.i:HOME;if(pw===HOME||relOf(HOME,pw)>=-0.2)continue;
    L.splice(i,1);opAdd(pw,-2);HOOK.news(`${POWERS[pw].name} shuts our ground station at ${c.name} and keeps the furniture`,'bad')}
  const q0=Math.floor((PROG.day-d)/100),q1=Math.floor(PROG.day/100),n=L.filter(g=>{const c=CITIES[g.ci];return c.power&&c.power.i!==HOME}).length;
  if(q1>q0&&n){const x=GS_LEASE*n*(q1-q0);PROG.funds-=x;PROG.leasePaid=(PROG.leasePaid||0)+x}}
// the sky shader's float value noise (h3/vn/fbm), ported with Math.fround at each step so the CPU sees the same clouds
// the GPU draws. (It used to carry the land mask too; the terrain now has its own integer-hash noise, see "the world".)
const F32=Math.fround,fr32=x=>F32(x-Math.floor(x));
function h3(x,y,z){x=fr32(F32(F32(x*0.3183099)+0.1));y=fr32(F32(F32(y*0.3183099)+0.1));z=fr32(F32(F32(z*0.3183099)+0.1));
  x=F32(x*17);y=F32(y*17);z=F32(z*17);return fr32(F32(F32(F32(x*y)*z)*F32(F32(x+y)+z)))}
function vn(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let fx=x-ix,fy=y-iy,fz=z-iz;
  fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);const H=(a,b,c)=>h3(ix+a,iy+b,iz+c),L=(a,b,t)=>a+(b-a)*t;
  return L(L(L(H(0,0,0),H(1,0,0),fx),L(H(0,1,0),H(1,1,0),fx),fy),L(L(H(0,0,1),H(1,0,1),fx),L(H(0,1,1),H(1,1,1),fx),fy),fz)}
function fbm(x,y,z){let a=.5,s=0;for(let i=0;i<6;i++){s+=a*vn(x,y,z);x=F32(x*2.03+1.7);y=F32(y*2.03+9.2);z=F32(z*2.03+3.1);a*=.5}return s}
// cloud cover at a planet-fixed unit vector at program time T: the sky shader's cloudCovF, ported like that
function cloudAt(u,T){const t=(T*2e-4)%500,a=4;
  const w=[vn(u[0]*a+t*.3,u[1]*a+t*.3,u[2]*a+t*.3),vn(u[0]*a+5.2,u[1]*a+1.3,u[2]*a+t*.3),vn(u[0]*a+9.1,u[1]*a+t*.3,u[2]*a+2.7)].map(x=>x-.5);
  const q=[(u[0]+w[0]*.22)*6+t,(u[1]+w[1]*.22)*11,(u[2]+w[2]*.22)*6+t*.6];
  const c=fbm(q[0],q[1],q[2])+.35*(fbm(u[0]*1.7+4,u[1]*1.7+1,u[2]*1.7+t*.2)-.5),x=clamp((c-.55)/.17,0,1);return x*x*(3-2*x)}
const SUN_DIR=norm([1,0.12,0.05]);   // the renderer's SUN (fixed in the absolute frame); kept here so the sim core stands alone
const sunUp=(u,T)=>dot(rotY(u,absTh(T)),SUN_DIR);   // sine of the sun's elevation at a planet-fixed point
const orbQ=(r,v)=>{const f=nodeFrame(r,v);return qFromBasis(f.pro,f.nrm,f.rad)};   // orbital frame → absolute
function satKind(q){return q.junk?'Debris':q.cam?'Lookout':q.sci?'Beeper':q.ballast?'Boilerplate':q.bio?'Ark':q.bodyName&&q.ant?'Relay':'Object'}
function satRegister(s,R){if(s.alive&&s.landed&&s.body!==TELLUS&&s.pf)return landRegister(s,R);if(!s.alive||s.landed)return;
  const B=s.body,el=elements(s.r,s.v,B.mu);let cruise=0;
  if(!settled(B,el)){if(!(len(s.r)-B.R>(B.atm||0)))return;cruise=1}   // not a lasting orbit but above the air: in flight (Q49); in the air at flight end: dropped, as before
  const n=k=>s.parts.filter(p=>p.on&&p.d.kind===k).length+(s.att||[]).reduce((a,x)=>a+kitOwn(x.e,k),0),q={cam:n('cam'),ant:n('ant'),sci:n('sci'),ballast:n('ballast'),bio:n('bio')};if(B!==TELLUS)q.bodyName=B.name;
  PROG.sats=PROG.sats||[];PROG.satN=(PROG.satN||0)+1;const kind=satKind(q),same=PROG.sats.filter(x=>satKind(x)===kind).length;
  Object.assign(q,{id:PROG.satN,name:`${kind} ${same+1}`,epoch:R.T??R.day0*DAY_S+simT,r:s.r.slice(),v:s.v.slice(),mass:s.mOwn??s.mass,born:PROG.day,imgs:0,pending:[]});PROG.sats.push(q);
  // what it looks like, for the 3D view: the parts still on, and its attitude held in the orbital frame (prograde, normal,
  // radial), so a camera that looked down at registration still looks down a week later. Render-only; the sim ignores it.
  const on=s.parts.filter(p=>p.on);q.shape=shapeOf(on,R.crewed&&R.crewOK);
  q.qo=qmul(qconj(orbQ(s.r,s.v)),s.q);q.cm=(s.cmOwn||s.cm).slice();R.satId=q.id;
  q.attached=(s.att||[]).map(a=>({e:a.e,p:a.p.slice(),q:a.q.slice(),host:a.host,hpi:a.hpi,ppi:a.ppi,kind:a.kind}));HOOK.satLook&&HOOK.satLook(q.shape,on);   // what's docked goes up with it, as itself
  q.stack=s.stack?JSON.parse(JSON.stringify(s.stack)):null;q.vst=vstOf(s);   // A2: what it takes to fly it again
  {const N=[s.node,...(s.nodeQ||[])].filter(n=>n&&n.t>simT&&!n.burning);if(N.length)q.nodes=N.map(n=>({T:R.day0*DAY_S+n.t,dv:n.dv.slice(),b:n.b||B.name}))}   // planned burns go with it (Q49 slice 3)
  if(s.reg){const o=s.reg;Object.assign(q,{id:o.id,name:o.name,born:o.born,imgs:o.imgs||0,pending:o.pending||[],labDays:o.labDays,contact:o.contact})}   // the same object, back on the register
  if(cruise){q.cruise=1;return HOOK.news(`${q.name} is on its way, in flight around ${B.name}: it carries on between flights (Program → In flight)`,'ok')}
  const inc=Math.acos(clamp(el.h[1]/el.hl,-1,1))*57.29578;
  if(B!==TELLUS)return HOOK.news(`${q.name} stays in orbit around ${B.name} (${kmS(el.pe-B.R)}–${kmS(el.ap-B.R)} km, ${inc.toFixed(0)}°)${q.ant?': a relay for rovers out of sight of Tellus':''}`,'ok');
  HOOK.news(`${q.name} stays in orbit (${kmS(el.pe-TELLUS.R)}–${kmS(el.ap-TELLUS.R)} km, ${inc.toFixed(0)}°)${q.cam&&q.ant?': a working camera satellite, on the job between flights':q.cam?', though without an antenna its pictures stay up there':''}`,'ok')}
// ---- debris, slice 1 (space session, QUEUE Q26; NOTES § "Plan: debris and Kessler"): big pieces are objects. Every
// piece a flight drops (detach) is noted with its state; at flight end the ones of JUNK_MIN or more in a closed orbit clear
// of the air, and well inside the SOI, join the registry as Debris (q.junk): drawn, targetable, grabbable, hit in flight
// like any satellite; never flyable or held; on their rails plus decay only (no tides), so hundreds stay cheap.
const JUNK=[],JUNK_MIN=100;   // kg
function junkNote(s,parts,r,v,dm,cm){if(!s.rec||!s.rec.launched)return;const e=parts.find(p=>p.d.kind==='engine')||parts.find(p=>p.d.kind==='tank')||parts[0];
  JUNK.push({rec:s.rec,body:s.body,r:r.slice(),v:v.slice(),t:simT,q:s.q.slice(),shape:shapeOf(parts,false),cm:cm.slice(),mass:dm*1000,name:e.d.name.replace(/ \(.*\)$/,'')})}
function junkRegister(R){return junkAdd(JUNK.splice(0).filter(j=>j.rec===R),R.day0*DAY_S)}
// pieces noted by junkNote, their times from T0 (program time of the flight's start): the ones that stay up join the registry
function junkAdd(list,T0){const L=list.filter(j=>j.mass>=JUNK_MIN);let n=0;
  for(const j of L){const B=j.body,el=elements(j.r,j.v,B.mu),fl=B.R+(B.atm||MOON_PE+bodyTop(B)),far=B===TELLUS?Math.min(...B.children.map(c=>c.rMin))/2:B.soiMin;
    if(!(el.e<1&&el.pe>fl&&el.ap<far))continue;
    PROG.sats=PROG.sats||[];PROG.satN=(PROG.satN||0)+1;n++;
    const q={id:PROG.satN,junk:1,name:`${j.name} (debris)`,epoch:T0+j.t,r:j.r,v:j.v,mass:j.mass,born:PROG.day,imgs:0,pending:[],shape:j.shape,cm:j.cm,
      qo:qmul(qconj(orbQ(j.r,j.v)),j.q),attached:[],adrift:PROG.day,cam:0,ant:0,sci:0,ballast:0,bio:0};
    if(B!==TELLUS)q.bodyName=B.name;PROG.sats.push(q)}
  if(n)HOOK.news(`${n} spent stage${n>1?'s':''} from this flight stay${n>1?'':'s'} in orbit as debris`,'warn');return n}
// ---- debris, slice 2 (space session, QUEUE Q146): conjunctions between flights. Big objects (Debris) against active
// entries only (everything else in Tellus orbit), never object against object (LATE_GAME § "Debris and Kessler": the
// measured costs). Each orbit is smeared over 50 km altitude bands by the share of its period it spends in each (resid).
// A pair crosses at two nodes; for circular orbits of radius r and mutual inclination Δi, with radii spread over a band
// of width W, the rate is Rs² v / (2π r² W cos(Δi/2)), Rs the two bounding radii added: at a node they hit if their
// offsets across the band and along the track fall in an ellipse of area π Rs²/cos(Δi/2) (a Monte Carlo agrees,
// study_debris.mjs). Summed over the bands both visit, weighted by their shares.
// A hit: a crewed entry is always warned and moves (LATE_GAME: no surprise deaths); a tracked one (radar + compute: from
// the mainframe era) with DODGE_DV in its tanks dodges and pays it; anything else is destroyed with the object, and the
// breakup is recorded for the fragment bands (Q147). The whole pressure is a world setting (off / light / real).
const BAND_W=50e3,BAND_N=38,DODGE_DV=0.5,PRESSURE_K={off:0,light:0.1,real:1};
const pressureOf=k=>(PROG.pressures||{})[k]||'light';   // world settings for pressures (platform's Q124 adopts this)
const bandR=b=>TELLUS.R+TELLUS.atm+(b+.5)*BAND_W;
const RES_C=new WeakMap();
function resid(q){let c=RES_C.get(q);if(c&&c.ep===q.epoch&&c.r===q.r)return c;const el=elements(q.r,q.v,TELLUS.mu),f=new Float64Array(BAND_N),N=72;
  if(el.e<1)for(let i=0;i<N;i++){const M=2*Math.PI*(i+.5)/N;let E=M;for(let k=0;k<6;k++)E-=(E-el.e*Math.sin(E)-M)/(1-el.e*Math.cos(E));
    const b=Math.floor((el.a*(1-el.e*Math.cos(E))-TELLUS.R-TELLUS.atm)/BAND_W);if(b>=0&&b<BAND_N)f[b]+=1/N}
  c={ep:q.epoch,r:q.r,f,hn:mul(el.h,1/el.hl),R:q.shape&&q.shape.length&&q.cm?satMP(q).R:1};RES_C.set(q,c);return c}
// hits a day between two Tellus orbits (at full, "real" rates)
function pairRate(A,B){const a=resid(A),b=resid(B),ci=Math.cos(Math.acos(clamp(dot(a.hn,b.hn),-1,1))/2),Rs=a.R+b.R;let s=0;
  for(let k=0;k<BAND_N;k++)if(a.f[k]&&b.f[k]){const r=bandR(k);s+=a.f[k]*b.f[k]*Math.sqrt(TELLUS.mu/r)/(r*r)}
  return s?Rs*Rs*s/(2*Math.PI*BAND_W*Math.max(ci,0.05))*DAY_S:0}
const entryCrewed=q=>[q,...(q.attached||[]).map(x=>x.e)].some(e=>(e.shape||[]).some(o=>o.crew));
const debrisTracked=()=>compEra()>=1;
function conjTick(T0,T1,roll){const K=PRESSURE_K[pressureOf('debris')]||0,days=(T1-T0)/DAY_S;if(!(K>0)||!(days>0))return;
  const up=satsUp(),J=up.filter(q=>q.junk),A=up.filter(q=>!q.junk);if(!J.length||!A.length)return;
  for(const a of A){if(!PROG.sats.includes(a))continue;const rates=J.filter(o=>PROG.sats.includes(o)).map(o=>[o,pairRate(a,o)]).filter(x=>x[1]>0);
    const L=K*days*rates.reduce((s,x)=>s+x[1],0);if(!(L>0))continue;
    const u=(roll||rng((Math.floor(T1/DAY_S)*104729+a.id*7919)|0))();if(u>=1-Math.exp(-L))continue;
    let w=u/(1-Math.exp(-L))*rates.reduce((s,x)=>s+x[1],0),o=rates[0][0];for(const[x,r]of rates){if(w<r){o=x;break}w-=r}
    if(entryCrewed(a)){skSpend(a,DODGE_DV);HOOK.news(`${a.name} was warned of ${o.name} on a collision course and moved out of its way`,'warn');continue}
    if(debrisTracked()&&skDv(a)>=DODGE_DV){skSpend(a,DODGE_DV);HOOK.news(`${a.name} dodged ${o.name}: tracked, warned, a ${DODGE_DV} m/s burn`,'ok');continue}
    const h=len(satAt(a,T1)[0])-TELLUS.R;PROG.sats=PROG.sats.filter(x=>x!==a&&x!==o);
    (PROG.breakups=PROG.breakups||[]).push({day:T1/DAY_S,h,mass:(a.mass||0)+(o.mass||0),a:a.name,o:o.name});
    HOOK.news(`${a.name} was struck by ${o.name}${debrisTracked()?'':', which nobody was tracking'}: both are gone in a cloud of fragments`,'bad')}}
// ---- debris, slice 3 (space session, QUEUE Q147): fragments as a density per band (ESA MASTER style), PROG.frag[b] =
// fragments of 1 cm or more in band b. Sources: breakups (slice 2's collisions, fragments shattering big objects, an
// anti-satellite test), by NASA's standard breakup model, spread over the bands around the breakup's height. Drag drains
// each band into the one below (a centimetre fragment, Cd·A/m FRAG_K). A fragment hit (4 n R² v: the pair rate averaged
// over random crossings, the fragment's own size negligible) kills an uncrewed entry (nobody tracks a 1 cm piece): it goes
// silent and stays up as a dead hulk, a big object. Only a fragment big enough to bring 40 J per gram of the target
// (NASA's catastrophic threshold; FRAG_RHO for its mass from its size) shatters it into more fragments: the cascade,
// which needs the rare large pieces (a 2 t stage at 2.7 km/s: ~35 cm and up). Crewed entries are never hit by surprise: a warning instead,
// once, when their band turns risky. A band whose objects make fragments faster than drag removes them "feeds itself":
// news once (and a warning before). All of it scaled by the debris setting, like slice 2.
const CASC_YR=50,FRAG_K=0.2,FRAG_SIG=100e3,FRAG_LC=0.01,CREW_WARN=1e-3,FRAG_RHO=1000,CAT_E=4e4;   // m²/kg; m spread; 1 cm; hits a year
// for a crewed warning; kg/m³ of a fragment's sphere (hollow, crumpled); J/kg to shatter a target
const fragsOf=m=>0.1*Math.pow(m,0.75)*Math.pow(FRAG_LC,-1.71);   // NASA SBM, catastrophic: N(≥Lc) = 0.1 M^0.75 Lc^-1.71
const bandV=b=>{const r0=TELLUS.R+TELLUS.atm+b*BAND_W;return 4/3*Math.PI*((r0+BAND_W)**3-r0**3)};
function fragBands(){const F=PROG.frag;if(F&&F.length===BAND_N)return F;return PROG.frag=new Array(BAND_N).fill(0)}
// a breakup of mass kg at height h: fragments spread as a normal of FRAG_SIG over the bands; what falls below the air is gone
function breakup(h,mass){const F=fragBands(),N=fragsOf(mass),w=[];let W=0;
  for(let b=-8;b<BAND_N+8;b++){const x=Math.exp(-0.5*((TELLUS.atm+(b+.5)*BAND_W-h)/FRAG_SIG)**2);w.push([b,x]);W+=x}
  for(const[b,x]of w)if(b>=0&&b<BAND_N)F[b]+=N*x/W;return N}
// seconds a centimetre fragment takes to sink through band b (circular orbit at its middle)
const FRAG_TAU=[],CASC_STAT=[];   // CASC_STAT[b]: {R0, gen (years)} from the last tick, for views (not saved)
const fragTau=b=>FRAG_TAU[b]??(FRAG_TAU[b]=BAND_W/Math.max(1e-30,-dragRates(bandR(b),0,FRAG_K).da));
// the share of fragments big enough to shatter mass M (kg) at speed v: N(≥L) ∝ L^-1.71
const catFrac=(M,v)=>{const L=Math.cbrt(2*CAT_E*M/(v*v)/(FRAG_RHO*Math.PI/6));return Math.min(1,Math.pow(L/FRAG_LC,-1.71))};
// hits a day on an entry from the fragment bands (real rates)
function fragRate(q){const F=fragBands(),c=resid(q);let s=0;for(let b=0;b<BAND_N;b++)if(c.f[b]&&F[b])s+=c.f[b]*F[b]/bandV(b)*Math.sqrt(TELLUS.mu/bandR(b));return 4*c.R*c.R*s*DAY_S}
function asatTest(name,h,mass=1000){const n=breakup(h,mass);HOOK.news(`${name} tests an anti-satellite weapon at ${Math.round(h/1e3)} km: about ${Math.round(n/1e3)},000 new fragments in that band`,'bad');return n}
function fragTick(T0,T1,roll){const F=fragBands(),days=(T1-T0)/DAY_S;if(!(days>0))return;
  for(const x of PROG.breakups||[])if(!x.frag){breakup(x.h,x.mass);x.frag=1}
  // drain, in steps of at most a day: band b loses 1 − e^(−dt/τ) of its fragments to the band below
  for(let t=0;t<days-1e-9;){const dt=Math.min(1,days-t)*DAY_S;t+=dt/DAY_S;
    for(let b=0;b<BAND_N;b++){if(!F[b])continue;const out=F[b]*(1-Math.exp(-dt/fragTau(b)));F[b]-=out;if(b>0)F[b-1]+=out}}
  const K=PRESSURE_K[pressureOf('debris')]||0;if(!(K>0)||!F.some(x=>x>0))return;
  const T=Math.floor(T1/DAY_S),rho=new Array(BAND_N).fill(0),mJ=new Array(BAND_N).fill(0),wJ=new Array(BAND_N).fill(0);
  for(const q of satsUp()){if(!PROG.sats.includes(q))continue;const r=fragRate(q);if(!(r>0))continue;const c=resid(q);
    const cf=catFrac(q.mass||0,Math.sqrt(TELLUS.mu/(TELLUS.R+TELLUS.atm+BAND_W*c.f.indexOf(Math.max(...c.f)))));
    if(q.junk)for(let b=0;b<BAND_N;b++)if(c.f[b]){rho[b]+=c.f[b]*4*c.R*c.R*Math.sqrt(TELLUS.mu/bandR(b))/bandV(b)*cf;mJ[b]+=c.f[b]*(q.mass||0);wJ[b]+=c.f[b]}   // per fragment a second
    if(entryCrewed(q)){if(r*K*YEAR_D>=CREW_WARN&&!q.fragWarn){q.fragWarn=T;HOOK.news(`${q.name}'s crew are warned: the fragment cloud in their orbit is thick enough to matter (about one hit in ${Math.round(1/(r*K*YEAR_D))} years); shielding and a higher orbit are the answers`,'warn')}continue}
    const L=r*K*days*(q.junk?cf:1),u=(roll||rng((T*130363+q.id*15485863)|0))();if(u>=1-Math.exp(-L))continue;
    const h=len(satAt(q,T1)[0])-TELLUS.R;
    if(q.junk||u<(1-Math.exp(-L))*cf){PROG.sats=PROG.sats.filter(x=>x!==q);const n=breakup(h,q.mass||0);   // shattered
      HOOK.news(q.junk?`${q.name} was shattered by a large fragment: about ${Math.round(n/1e3)},000 more pieces at ${Math.round(h/1e3)} km`:`${q.name} was shattered by a large fragment nobody could track: about ${Math.round(n/1e3)},000 more pieces`,'bad');continue}
    Object.assign(q,{junk:1,dead:T,name:`${q.name} (dead)`,cam:0,ant:0,sci:0,bio:0,ballast:0,adrift:q.adrift??T});   // killed: a hulk, a big object now
    HOOK.news(`${q.name.replace(/ \(dead\)$/,'')} has gone silent: struck by a fragment nobody could track. Its hulk stays in orbit`,'bad')}
  // the cascade (Kessler's chain reaction): a band is critical when one breakup's fragments are expected to shatter at
  // least one more of its big objects before drag clears them (R0 = fragments × their shattering rate × their time there
  // ≥ 1); it's news when the next breakup is due within CASC_YR years (a warning at R0 ≥ ½, within 4×)
  PROG.casc=PROG.casc||{};CASC_STAT.length=0;for(let b=0;b<BAND_N;b++){if(!(rho[b]>0)||F[b]<100)continue;const k=PROG.casc[b]||0,lo=Math.round((TELLUS.atm+b*BAND_W)/1e3),
    R0=fragsOf(mJ[b]/wJ[b])*rho[b]*K*fragTau(b),gen=1/(F[b]*rho[b]*K)/DAY_S/YEAR_D;CASC_STAT[b]={R0,gen};
    if(R0>=1&&gen<=CASC_YR&&k<2){PROG.casc[b]=2;HOOK.news(`The ${lo}–${lo+50} km band now feeds itself: each breakup there now sets off more before the air can clear them. It will stay unusable for decades`,'bad')}
    else if(R0>=0.5&&gen<=4*CASC_YR&&k<1){PROG.casc[b]=1;HOOK.news(`Warning: the ${lo}–${lo+50} km band is filling with fragments; one more breakup there could start a cascade`,'warn')}}}
// ---- missions in flight, slice 1 (space session, QUEUE Q49; NOTES § "Plan: missions in flight"). A lasting orbit
// (settled: closed, clear of the air or ground, inside the body's SOI and short of any moon's) is a satellite; anything
// else still coasting above the air at flight end is a cruise entry (q.cruise), carried between flights leg by leg as
// the predictor sees it (predictFrom: Kepler, or integrated where a moon perturbs): into a moon's sphere, out of one,
// until its orbit settles (then it's an ordinary satellite) or it reaches an atmosphere (it waits there, flyable: fly
// it down) or ground (it's lost). Each turn is news. Events that stop time are slice 2.
const settled=(B,el)=>el.e<1&&el.pe>B.R+(B.atm||MOON_PE+bodyTop(B))&&(B===TELLUS||el.ap<B.soiMin)&&B.children.every(c=>el.ap<c.rMin-c.soiMin);
function cruiseStep(q,T1){const o=ORB_T0;ORB_T0=0;let guard=0;
  try{while(q.epoch<T1&&guard++<12){const B=orbBody(q),st={b:B,r:q.r,v:q.v,t:q.epoch},legs=predictFrom(st),L=legs[0],el=L.el,fl=B.R+(B.atm||0);
    const tEnd=L.endKind&&L.endT<T1?L.endT:T1;
    // the ground or the air first, if it comes before the leg ends (Kepler legs; perturbed ones end at an impact themselves)
    if(el.pe<fl&&!(el.hl<1e-3)){const nuF=-Math.acos(clamp((el.p/fl-1)/el.e,-1,1)),dt=dot(q.r,q.v)<0||el.e>=1?tPe(el,nuF)-tPe(el,el.nu):timeToNu(el,nuF);
      if(dt>=0&&q.epoch+dt<=tEnd){const[r,v]=kepler(q.r,q.v,dt,B.mu);Object.assign(q,{r,v,epoch:q.epoch+dt});
        if(B.atm){q.halt={kind:'air',day:q.epoch/DAY_S};HOOK.news(`${q.name} has reached the top of ${B.name}'s air: fly it down (Program → In flight)`,'warn')}
        else{PROG.sats=PROG.sats.filter(x=>x!==q);HOOK.news(`${q.name} struck ${B.name}`,'bad')}return}}
    if(L.endKind==='impact'&&L.endT<=T1){PROG.sats=PROG.sats.filter(x=>x!==q);HOOK.news(`${q.name} struck ${B.name}`,'bad');return}
    if(tEnd<T1&&legs[1]){const n=legs[1];q.r=n.r.slice();q.v=n.v.slice();q.epoch=n.t;if(n.b===TELLUS)delete q.bodyName;else q.bodyName=n.b.name;
      HOOK.news(L.endKind==='enc'?`${q.name} has entered ${n.b.name}'s sphere of influence`:`${q.name} has left ${B.name}'s pull: now around ${n.b.name}`,'ok')}
    else{if(pertNear(B,el)){let r=q.r,v=q.v,t=q.epoch;const h=Math.min(600,el.e<1?el.period/120:600);while(t<T1){const dt=Math.min(h,T1-t);[r,v]=tideRK4(B,r,v,t,dt);t+=dt}q.r=r;q.v=v}
      else[q.r,q.v]=kepler(q.r,q.v,T1-q.epoch,B.mu);q.epoch=T1}
    const B2=orbBody(q),e2=elements(q.r,q.v,B2.mu);
    if(settled(B2,e2)){delete q.cruise;q.skRate=null;HOOK.news(`${q.name} has settled into an orbit around ${B2.name} (${kmS(e2.pe-B2.R)}–${kmS(e2.ap-B2.R)} km)`,'ok');return}}}
  finally{ORB_T0=o}}
// ---- missions in flight, slice 2 (Q49): cruise events on the timeline (economy's upcoming()). "No silent misses"
// (LATE_GAME § "Keeping flight in play"): reaching an atmosphere or an impact course always stops time (an impact
// CRUISE_LEAD ahead, so there's time to fly it); entering a moon's sphere, and the closest approach there (CRUISE_LEAD
// ahead: the moment for a capture burn), stop it once per vessel and body (q.seen), then only show.
const CRUISE_LEAD=3/24;   // days
function cruiseEvents(T){const out=[],o=ORB_T0;ORB_T0=0;
  try{for(const q of PROG.sats||[]){if(!q.cruise||q.halt||q.docked)continue;const B=orbBody(q),[r,v]=satAt(q,T),L=predictFrom({b:B,r,v,t:T})[0],el=L.el,fl=B.R+(B.atm||0),seen=q.seen||{};let ev=null;
      if(el.pe<fl&&!(el.hl<1e-3)){const nuF=-Math.acos(clamp((el.p/fl-1)/el.e,-1,1)),dt=dot(r,v)<0||el.e>=1?tPe(el,nuF)-tPe(el,el.nu):timeToNu(el,nuF);
        if(dt>=0&&!(L.endKind&&L.endT<T+dt))ev=B.atm?{t:T+dt,text:`${q.name} reaches ${B.name}'s air`,stop:true}:{t:Math.max(T,T+dt-CRUISE_LEAD*DAY_S),text:`${q.name} will strike ${B.name} unless it's flown`,stop:true}}
      if(!ev&&L.endKind==='enc'){const c=B.children.find(c=>len(sub(L.end,bodyRel(c,L.endT)[0]))<c.soi*1.01);if(c)ev={t:L.endT,text:`${q.name} enters ${c.name}'s sphere of influence`,key:'enc:'+c.name}}
      if(!ev&&B.parent&&(el.e<1||dot(r,v)<0)){const dt=el.e<1?timeToNu(el,0):tPe(el,0)-tPe(el,el.nu);
        if(dt>0&&!(L.endKind&&L.endT<T+dt))ev={t:Math.max(T,T+dt-CRUISE_LEAD*DAY_S),text:`${q.name} passes ${kmS(el.pe-B.R)} km above ${B.name}: the moment for a capture burn`,key:'pe:'+B.name}}
      if(ev){if(ev.key)ev.stop=!seen[ev.key];out.push({...ev,id:q.id,day:ev.t/DAY_S})}}}
  finally{ORB_T0=o}return out}
// a stop at a cruise event is seen: it won't stop time again for that vessel and body (advanceTo calls this)
function cruiseSeen(ev){const q=(PROG.sats||[]).find(x=>x.id===ev.id);if(q&&ev.key)(q.seen=q.seen||{})[ev.key]=1}
// ---- missions in flight, slice 3 (Q49, QUEUE Q166): planned burns carried. A vessel's maneuver nodes go with its entry
// (q.nodes: program time T, dv in the node's frame, the body whose leg it's on) and come back when it's flown again. Each
// is a timeline event that always stops time, CRUISE_LEAD ahead (a planned burn needs you). Handed to mission control
// (n.mc), it's flown at its time as an impulse from the vessel's own tanks (skSpend), with the era's execution error
// (BURN_ERR by computing era: a human computer's 5 %, a mainframe's 2 %, an onboard computer's 0.2 %), so an early
// arrival needs a correction. Passed by without either, it's dropped (missed: a wait, never a failure).
const BURN_ERR=[0.05,0.02,0.002,0.002,0.002];
function nodesEvents(T){const out=[];for(const q of PROG.sats||[]){if(!q.nodes||!q.nodes.length||q.docked||q.halt)continue;const n=q.nodes[0];
  if(n.T>T)out.push({t:Math.max(T,n.T-CRUISE_LEAD*DAY_S),day:Math.max(T,n.T-CRUISE_LEAD*DAY_S)/DAY_S,id:q.id,stop:!n.mc,
    text:n.mc?`Mission control flies ${q.name}'s planned burn (${len(n.dv).toFixed(0)} m/s)`:`${q.name}: a planned burn (${len(n.dv).toFixed(0)} m/s): fly it, or hand it to mission control`})}return out}
// the entry's state at program time T, moving it there (cruise entries leg by leg; others on their rails)
function entryTo(q,T){if(q.cruise){if(!q.halt)cruiseStep(q,T)}else if(q.bodyName&&!(slotRate(q)>0&&skDv(q)>0))moonOrbStep(q,T);else{const[r,v]=satAt(q,T);Object.assign(q,{r,v,epoch:T})}}
function nodeFire(q,n,roll){const B=orbBody(q),f=nodeFrame(q.r,q.v),dvW=add(add(mul(f.pro,n.dv[0]),mul(f.nrm,n.dv[1])),mul(f.rad,n.dv[2])),want=len(dvW);
  const er=BURN_ERR[Math.min(compEra(),BURN_ERR.length-1)],R=roll||rng((Math.round(n.T)*7+q.id*104729)|0),g=()=>(R()+R()+R()-1.5)*2,   // ~unit spread
    dir=norm(add(mul(norm(dvW),1),[er*g(),er*g(),er*g()])),mag=want*(1+er*g()),left=skSpend(q,mag),got=Math.max(0,mag-left);
  q.v=add(q.v,mul(dir,got));q.skRate=null;delete q.seen;if(!q.cruise&&!settled(B,elements(q.r,q.v,B.mu))){q.cruise=1;delete q.adrift}   // a burn out of its orbit: in flight now
  HOOK.news(got<mag-0.5?`Mission control burned ${q.name} for ${got.toFixed(0)} of ${want.toFixed(0)} m/s: its tanks ran dry`:`Mission control flew ${q.name}'s planned burn: ${got.toFixed(1)} m/s (planned ${want.toFixed(1)})`,got<mag-0.5?'warn':'ok')}
function nodesTick(q,T1){while(q.nodes&&q.nodes.length&&q.nodes[0].T<=T1&&PROG.sats.includes(q)&&!q.halt){const n=q.nodes.shift();entryTo(q,n.T);
    if(!PROG.sats.includes(q)||q.halt)break;
    if(n.mc)nodeFire(q,n);else HOOK.news(`${q.name}'s planned burn passed with nobody at the controls; it carries on as it was`,'warn')}
  if(q.nodes&&!q.nodes.length)delete q.nodes}
function nodeHandOff(id,on=true){const q=(PROG.sats||[]).find(x=>x.id===id);if(q&&q.nodes&&q.nodes[0])q.nodes[0].mc=!!on;return q}
// what a cruise entry is doing next, for lists: {text, days} (program time T)
function cruiseNext(q,T){if(q.halt)return{text:`waiting at the top of ${orbBody(q).name}'s air`,days:0};const o=ORB_T0;ORB_T0=0;
  try{const B=orbBody(q),[r,v]=satAt(q,T),L=predictFrom({b:B,r,v,t:T})[0],el=L.el,d=L.endKind?(L.endT-T)/DAY_S:null;
    if(el.pe<B.R+(B.atm||0))return{text:B.atm?`falling into ${B.name}'s air`:`on course to strike ${B.name}`,days:null};
    return L.endKind==='enc'?{text:`heading into ${B.children.find(c=>len(sub(L.end,bodyRel(c,L.endT)[0]))<c.soi*1.01)?.name||'a moon'}'s pull`,days:d}:L.endKind==='esc'?{text:`leaving ${B.name}'s pull`,days:d}:{text:`coasting around ${B.name}`,days:null}}
  finally{ORB_T0=o}}
// ---- rendezvous: a registered satellite as the flight's target (S.target = its id). Everything in program time.
const progT=s=>(s.rec&&s.rec.launched?s.rec.day0:Math.ceil((PROG.day||0)-1e-9))*DAY_S+simT;
function tgtOf(s){const tv=s.tgtV;if(tv&&tv!==s&&tv.alive&&FLEET.includes(tv)&&tv.body===s.body)return{q:tv,ves:true,r:tv.r,v:tv.v,dr:sub(tv.r,s.r),dv:sub(s.v,tv.v)};   // a vessel of this flight
  {const lq=s.target!=null&&landedUp().find(x=>x.id===s.target);if(lq&&landedBody(lq)===s.body){const B=landedBody(lq),r=fromPF(B,lq.pf,simT),v=surfVel(B,r);return{q:lq,landed:true,r,v,dr:sub(r,s.r),dv:sub(s.v,v)}}}   // on the surface
  const q=s.target!=null&&orbitsAt(s.body).find(x=>x.id===s.target);if(!q)return null;
  const[r,v]=satAt(q,progT(s));return{q,r,v,dr:sub(r,s.r),dv:sub(s.v,v)}}
const tgtBody=(s,T)=>T.ves?shipBody(T.q):T.landed?landBody(T.q,simT):satBody(T.q,progT(s));   // the target as a contact body   // dr: from us to it; dv: our velocity relative to it
// closest approach between a Kepler state (r0, v0 at program time t0) and satellite q over the next span seconds:
// a coarse scan (240 steps), then golden-section on the best bracket. {t, d, vrel, p (ours), pt (its)} at that moment.
function approach(q,r0,v0,t0,span,mu=TELLUS.mu){const N=240,at=t=>kepler(q.r,q.v,t-q.epoch,mu),d=t=>len(sub(kepler(r0,v0,t-t0,mu)[0],at(t)[0]));let bi=0,bd=Infinity;   // mu: the body both orbit
  for(let i=0;i<=N;i++){const x=d(t0+span*i/N);if(x<bd){bd=x;bi=i}}
  let a=t0+span*Math.max(0,bi-1)/N,b=t0+span*Math.min(N,bi+1)/N;for(let k=0;k<50;k++){const m1=a+(b-a)*.381966,m2=b-(b-a)*.381966;if(d(m1)<d(m2))b=m2;else a=m1}
  const t=(a+b)/2,[p,vs]=kepler(r0,v0,t-t0,mu),[pt,vt]=at(t);return{t,d:len(sub(p,pt)),vrel:len(sub(vs,vt)),p,pt}}
// ---- contact: the vessel against registered satellites (sats session). Each part's shape is a signed distance field
// from its profile (radius by height, the one d.prof gives); each part's surface is a cloud of sample points on that
// profile. A point of one body inside the other is a contact. Satellites within HIT_NEAR are stepped with the vessel in
// physics (rails would step past them), and each step is re-checked at offsets 5 cm of relative motion apart, so a
// fast pass can't tunnel through. A satellite that's been hit leaves its orbit-locked attitude and spins freely.
const HIT_E=0.3,HIT_MU=0.4,HIT_SLOP=0.01,HIT_NEAR=5000,HIT_VAPOR=150,HIT_STEP=0.05;
const DELICATE=new Set(['cam','ant','sci','chute','rfin','fins','rcs']);
const hitTol=d=>d.tol??(DELICATE.has(d.kind)?3:8);   // normal speed (m/s) a part takes without breaking
const hitBase=d=>d.kind==='tank'?d.dry:d.m;          // a satellite's part masses are shares of its registered mass
function hitProf(P,y){if(y<=P[0][1])return P[0][0];for(let i=1;i<P.length;i++)if(y<=P[i][1]){const[a,ya]=P[i-1],[b,yb]=P[i];return yb>ya?a+(b-a)*(y-ya)/(yb-ya):Math.max(a,b)}return P[P.length-1][0]}
const HIT_GEO=new WeakMap();
// a part's contact geometry in the vessel frame: axis base o, profile, height, sample points, centre and bounding radius
function hitGeo(p,d){if(d.kind==='bay')return bayGeo(p,d);if(d.radial)return radialGeo(p,d);let g=HIT_GEO.get(p);if(g)return g;const h=d.h,so=d.off&&p.phi!=null?d.off:0,o=[p.pos[0]+so*Math.cos(p.phi||0),p.y0,p.pos[2]+so*Math.sin(p.phi||0)];
  let prof=d.sc&&PARTS[d.base]?PARTS[d.base].prof.map(([r,y])=>[r*d.sc,y*d.sc]):d.prof;
  if(d.kind==='fins')prof=[[d.r+(d.span||0),0],[d.r+(d.span||0),h]];   // the fin ring as its swept disc
  const pts=[],ny=Math.max(1,Math.ceil(h/0.2));
  for(let i=0;i<=ny;i++){const y=h*i/ny,r=hitProf(prof,y),n=Math.max(6,Math.ceil(6.2832*r/0.25));
    for(let k=0;k<n;k++){const a=k/n*6.2832;pts.push([o[0]+r*Math.cos(a),o[1]+y,o[2]+r*Math.sin(a)])}
    if(i===0||i===ny)for(let rr=r-0.25;rr>0.05;rr-=0.25){const m=Math.max(6,Math.ceil(6.2832*rr/0.25));for(let k=0;k<m;k++){const a=k/m*6.2832;pts.push([o[0]+rr*Math.cos(a),o[1]+y,o[2]+rr*Math.sin(a)])}}
    if(i===0||i===ny)pts.push([o[0],o[1]+y,o[2]])}
  const rmax=Math.max(...prof.map(x=>x[0]));
  g={o,prof,h,pts,c:[o[0],o[1]+h/2,o[2]],R:Math.hypot(rmax,h/2)};HIT_GEO.set(p,g);return g}
function partSDF(g,x,y,z){if(g.bay)return baySDF(g.bay,x,y,z);if(g.rot)[x,y,z]=qrot(qconj(g.rot),[x,y,z]);const ds=Math.hypot(x,z)-hitProf(g.prof,clamp(y,0,g.h)),dc=Math.max(-y,y-g.h);return ds>0&&dc>0?Math.hypot(ds,dc):Math.max(ds,dc)}
function sdfN(g,l){const e=1e-3,f=(x,y,z)=>partSDF(g,x,y,z),[x,y,z]=l;
  return norm([f(x+e,y,z)-f(x-e,y,z),f(x,y+e,z)-f(x,y-e,z),f(x,y,z+e)-f(x,y,z-e)])}
const hitW=(B,pt)=>add(B.r,qrot(B.q,sub(pt,B.cm))),hitL=(B,w)=>add(qrot(qconj(B.q),sub(w,B.r)),B.cm);
const hitIw=(B,L)=>{const l=qrot(qconj(B.q),L);return qrot(B.q,[l[0]/B.I[0],l[1]/B.I[1],l[2]/B.I[2]])};   // world I⁻¹·L
// A part record can sit in its body at a transform (a docked body's parts): tq/tp/tc carry its own frame (centre of mass
// tc) to position tp in the body's frame, turned by tq. These map part-frame points and normals into the body frame and back.
const hitV=(a,pt)=>a.tq?add(a.tp,qrot(a.tq,sub(pt,a.tc))):pt,hitVi=(a,v)=>a.tq?add(qrot(qconj(a.tq),sub(v,a.tp)),a.tc):v,hitVn=(a,n)=>a.tq?qrot(a.tq,n):n;
// a registry entry's own parts as part records (X: the docking transform when it rides on something else)
const ownRecs=(e,X)=>e.shape.filter(o=>PARTS[o.k]).map(o=>{const d=PARTS[o.k];return X?{o,p:o,d,g:hitGeo(o,d),owner:e,tq:X.q,tp:X.p,tc:e.cm,att:X}:{o,p:o,d,g:hitGeo(o,d),owner:e}});
// the vessel as a contact body (shares r, v, q, w with s until written back), docked bodies included
function shipBody(s){const parts=s.parts.filter(p=>p.on).map(p=>({p,d:p.d,g:hitGeo(p,p.d),owner:null}));for(const a of s.att||[])parts.push(...ownRecs(a.e,a));
  return{r:s.r,v:s.v,q:s.q,w:s.w,m:s.mass,I:s.I,cm:s.cm,parts,R:Math.max(...parts.map(x=>len(sub(hitV(x,x.g.c),s.cm))+x.g.R))}}
// a satellite's attitude and spin at program time T: locked to its orbital frame until something hits it, then free
function satSpin(q,T,r,v){if(q.spin){const w=q.spin.w,wl=len(w),dq=wl>1e-12?qaxis(mul(w,1/wl),wl*(T-q.spin.T0)):[0,0,0,1];return{q:qnorm(qmul(dq,q.spin.q0)),w}}
  return{q:qmul(orbQ(r,v),q.qo),w:mul(cross(r,v),1/dot(r,r))}}
// diagonal of R·diag(I)·Rᵀ: a body's principal inertia seen from a frame it's turned by q (products of inertia dropped)
function rotI(q,I){const R=[qrot(q,[1,0,0]),qrot(q,[0,1,0]),qrot(q,[0,0,1])];return[0,1,2].map(k=>R[0][k]**2*I[0]+R[1][k]**2*I[1]+R[2][k]**2*I[2])}
const SAT_MP=new WeakMap(),SAT_C=new WeakMap();
// one entry's own body: its inertia about its own centre of mass (part masses as shares of its registered own mass)
function satOwnMP(e){let M=SAT_MP.get(e.shape);if(M)return M;const L=e.shape.filter(o=>PARTS[o.k]),bm=L.reduce((a,o)=>a+hitBase(PARTS[o.k]),0)||1,k=e.mass/1000/bm;
  let I=[0,0,0];for(const o of L){const d=PARTS[o.k],pm=hitBase(d)*k*1000,dd=sub(hitGeo(o,d).c,e.cm),pr=d.r,ip=pm*(d.h*d.h/12+pr*pr/4);
    I=add(I,[pm*(dd[1]**2+dd[2]**2)+ip,pm*(dd[0]**2+dd[2]**2)+pm*pr*pr/2,pm*(dd[0]**2+dd[1]**2)+ip])}
  M={I};SAT_MP.set(e.shape,M);return M}
// an entry with everything docked to it: total mass, combined centre of mass (entry frame), inertia, and all the parts
function satMP(q){let M=SAT_C.get(q);const A=q.attached||[];if(M&&M.shape===q.shape&&M.n===A.length)return M;
  let m=q.mass,c=mul(q.cm,q.mass);for(const a of A){m+=a.e.mass;c=madd(c,a.p,a.e.mass)}c=mul(c,1/m);
  const addI=(I,mass,at,Ib)=>{const d=sub(at,c);return add(I,add([mass*(d[1]**2+d[2]**2),mass*(d[0]**2+d[2]**2),mass*(d[0]**2+d[1]**2)],Ib))};
  let I=addI([0,0,0],q.mass,q.cm,satOwnMP(q).I);for(const a of A)I=addI(I,a.e.mass,a.p,rotI(a.q,satOwnMP(a.e).I));
  const parts=[...ownRecs(q,null),...A.flatMap(a=>ownRecs(a.e,a))];
  M={shape:q.shape,n:A.length,m,cm:c,I,parts,R:Math.max(...parts.map(x=>len(sub(hitV(x,x.g.c),c))+x.g.R))};SAT_C.set(q,M);return M}
const satCM=q=>q.attached&&q.attached.length?satMP(q).cm:q.cm;
function satBody(q,T){const[r,v]=satAt(q,T),sp=satSpin(q,T,r,v),M=satMP(q);return{sat:q,r,v,q:sp.q,w:sp.w,m:M.m,I:M.I,cm:M.cm,parts:M.parts,R:M.R}}
const hitNear=s=>!s.landed&&orbitsAt(s.body).some(q=>q.shape&&len(sub(satAt(q,progT(s))[0],s.r))<HIT_NEAR);
// points of each body inside the other: depth-weighted contact point and normal (n points from B toward A), deepest depth,
// and the part on each side that's most involved
function hitFind(A,B){let W=0,P=[0,0,0],N=[0,0,0],D=0,pa=null,pb=null;
  for(const[X,Y,sg]of[[A,B,1],[B,A,-1]])for(const a of X.parts){const ca=hitW(X,hitV(a,a.g.c));if(len(sub(ca,Y.r))>a.g.R+Y.R)continue;
    for(const b of Y.parts){if(len(sub(ca,hitW(Y,hitV(b,b.g.c))))>a.g.R+b.g.R)continue;
      for(const pt of a.g.pts){const w=hitW(X,hitV(a,pt)),l=sub(hitVi(b,hitL(Y,w)),b.g.o),dd=partSDF(b.g,l[0],l[1],l[2]);if(dd>=0)continue;
        const n=mul(qrot(Y.q,hitVn(b,sdfN(b.g,l))),sg);W-=dd;P=madd(P,w,-dd);N=madd(N,n,-dd);if(-dd>D){D=-dd;pa=sg>0?a:b;pb=sg>0?b:a}}}}
  return W>0&&len(N)>1e-12?{p:mul(P,1/W),n:norm(N),d:D,pa,pb}:null}
// one impulse at the contact point (restitution HIT_E, Coulomb friction HIT_MU), after pushing the bodies apart.
// Returns the closing normal speed it removed (0 if they were already separating).
function hitResolve(A,B,c){const n=c.n,ia=1/A.m,ib=1/B.m,cr=Math.max(0,c.d-HIT_SLOP)/(ia+ib);A.r=madd(A.r,n,cr*ia);B.r=madd(B.r,n,-cr*ib);
  const ra=sub(c.p,A.r),rb=sub(c.p,B.r),vr=sub(add(A.v,cross(A.w,ra)),add(B.v,cross(B.w,rb))),vn=dot(vr,n);if(vn>=0)return 0;
  const kk=u=>ia+ib+dot(u,cross(hitIw(A,cross(ra,u)),ra))+dot(u,cross(hitIw(B,cross(rb,u)),rb));
  const j=-(1+HIT_E)*vn/kk(n);let J=mul(n,j);const vt=sub(vr,mul(n,vn)),vtl=len(vt);
  if(vtl>1e-9){const t=mul(vt,1/vtl);J=madd(J,t,-Math.min(vtl/kk(t),HIT_MU*j))}
  A.v=madd(A.v,J,ia);A.w=add(A.w,hitIw(A,cross(ra,J)));B.v=madd(B.v,J,-ib);B.w=sub(B.w,hitIw(B,cross(rb,J)));return-vn}
const KIT=['cam','ant','sci','ballast','bio'];
const kitOwn=(e,k)=>e.shape.filter(o=>PARTS[o.k]&&PARTS[o.k].kind===k).length;
const kitSet=e=>{for(const k of KIT)e[k]=kitOwn(e,k)+(e.attached||[]).reduce((a,x)=>a+kitOwn(x.e,k),0)};   // an entry's kit counts everything docked to it
// a satellite (or a body docked to it) loses parts. Delicate parts break off; anything else takes its whole body, and with
// it whatever was docked through that body. The pieces leave as debris; what's left keeps its centre of mass where it was.
function satBreak(q,B,list,why,T){
  const deb=x=>{const pc=[x.o.pos[0],x.o.y0+x.o.h*x.d.cm,x.o.pos[2]],w=hitW(B,hitV(x,pc)),out=sub(w,B.r),ol=len(out);
    HOOK.debris({body:orbBody(q),r:w,v:add(add(B.v,cross(B.w,out)),ol>1e-6?mul(out,0.5/ol):[0,0,0]),q:x.tq?qmul(B.q,x.tq):B.q.slice(),w:B.w.slice(),parts:[{...x.o,d:x.d,on:true}],cm:pc,mass:hitBase(x.d)*1000,t:0})};
  list.forEach(deb);
  const cm0=B.cm,gone=new Set();
  for(const e of new Set(list.map(x=>x.owner))){const lost=list.filter(x=>x.owner===e),keep=e.shape.filter(o=>!lost.some(x=>x.o===o));
    if(!keep.length||lost.some(x=>!DELICATE.has(x.d.kind))){gone.add(e);continue}
    const all=e.shape.reduce((a,o)=>a+(PARTS[o.k]?hitBase(PARTS[o.k]):0),0),lm=lost.reduce((a,x)=>a+hitBase(x.d),0),c0=e.cm;
    e.mass*=Math.max(0.05,1-lm/(all||1));let c=[0,0,0],m=0;for(const o of keep){const d=PARTS[o.k];if(!d)continue;c=madd(c,[o.pos[0],o.y0+o.h*d.cm,o.pos[2]],hitBase(d));m+=hitBase(d)}
    e.cm=mul(c,1/m);e.shape=keep;
    if(e!==q){const a=q.attached.find(a=>a.e===e);a.p=add(a.p,qrot(a.q,sub(e.cm,c0)))}}   // a docked body's position follows its centre of mass
  const A=q.attached||[];
  if(gone.has(q)){for(const a of A)if(!gone.has(a.e))ownRecs(a.e,a).forEach(deb);   // what was docked to it goes with it
    const i=PROG.sats.indexOf(q);if(i>=0)PROG.sats.splice(i,1);if(S&&S.target===q.id)S.target=null;HOOK.news(`${q.name} destroyed in a collision${why}`,'bad');return}
  if(gone.size){let more=true;while(more){more=false;for(const a of A)if(!gone.has(a.e)&&[...gone].some(g=>g.id===a.host)){gone.add(a.e);more=true;
      ownRecs(a.e,a).forEach(deb)}}
    q.attached=A.filter(a=>!gone.has(a.e));for(const g of gone)HOOK.news(`${g.name} destroyed in a collision${why}`,'bad')}
  SAT_C.delete(q);kitSet(q);
  const r=add(B.r,qrot(B.q,sub(satCM(q),cm0)));
  Object.assign(q,{r,v:add(B.v,cross(B.w,sub(r,B.r))),epoch:T,spin:{q0:B.q.slice(),w:B.w.slice(),T0:T}});
  const del=list.filter(x=>!gone.has(x.owner));if(del.length)HOOK.news(`${q.name} loses its ${del.map(x=>x.d.name.toLowerCase()).join(' and ')} in a collision`,'warn')}
// after each physics step: the ports' loads, then every satellite near enough: docking if two ports meet right, otherwise
// contact, checked along the step's relative motion
function contactStep(s,dt){if(!s.alive||s.landed)return;portLoads(s);if(!s.alive)return;landContact(s,dt);if(!s.alive)return;const T=progT(s);let A=null;
  for(const q of orbitsAt(s.body)){if(!q.shape||!q.shape.length)continue;const[rq,vq]=satAt(q,T),rel=sub(rq,s.r),vrel=sub(vq,s.v);
    if(!A)A=shipBody(s);const M=satMP(q),reach=A.R+M.R+len(vrel)*dt+0.5;if(len(rel)>reach)continue;
    const B=satBody(q,T);if(dockTry(s,q,B,T)){A=null;continue}
    const n=Math.min(400,Math.max(1,Math.ceil(len(vrel)*dt/HIT_STEP)));let c=null;
    for(let k=0;k<=n&&!c;k++){const o=sub(rel,mul(vrel,dt*(n-k)/n));if(len(o)>A.R+M.R)continue;B.r=add(s.r,o);c=hitFind(A,B)}   // earliest touch in the step
    if(!c)continue;
    if(clawTry(s,q,A,B,c,T)){A=null;continue}
    const vn=hitResolve(A,B,c),why=` (${vn.toFixed(1)} m/s)`;s.r=A.r;s.v=A.v;s.w=A.w;
    Object.assign(q,{r:B.r,v:B.v,epoch:T,spin:{q0:B.q.slice(),w:B.w.slice(),T0:T}});   // the satellite's new rails
    if(vn>0.3)HOOK.msg(`Contact with ${q.name} at ${vn.toFixed(1)} m/s`);
    if(vn>HIT_VAPOR){HOOK.boom(s.body,c.p,simT,3);s.alive=false;s.crashSpeed=vn;HOOK.msg(`Destroyed: collided with ${q.name} at ${vn.toFixed(0)} m/s`);satBreak(q,B,B.parts,why,T);return}
    const sp=c.pb&&vn>hitTol(c.pb.d)?c.pb:null,shp=c.pa&&vn>hitTol(c.pa.d)?c.pa:null;
    if(sp)satBreak(q,B,DELICATE.has(sp.d.kind)?[sp]:B.parts.filter(x=>x.owner===sp.owner),why,T);
    if(shp){if(shp.att){HOOK.msg(`${shp.att.e.name} breaks loose from its port`);undock(s,shp.att.e.id,0)}else{HOOK.msg(`${shp.d.name} broke on ${q.name}`);partLost(s,shp.p)}A=null}
    if(!s.alive)return}}
// ---- docking (sats session). Docked spacecraft stay separate bodies fixed together (a superstructure, as in the simulator
// Orbiter): the vessel keeps its own parts, and each docked body rides along as a passenger at a fixed transform. s.att:
// {e: its registry entry, p: its centre of mass and q: its attitude in the vessel frame, host: the body it's docked to (0 =
// the vessel, else an entry id), hpi/ppi: the two ports' part indices}. Mass and inertia sum exactly (diagonal kept, as the
// vessel's own is); contact, rendering and the registry carry passengers; each port carries its load and lets go above
// its rating. Aero, heating and thrust stay with the vessel's own parts for now: docked stacks fly in vacuum. A docked
// entry stays in PROG.sats flagged `docked` until the flight ends, so a reload mid-flight can't lose it.
const PORT_GAP=0.15,PORT_LAT=0.1,PORT_COS=Math.cos(10*Math.PI/180),PORT_V=0.5,PORT_F=30e3,PORT_M=20e3,PORT_PUSH=0.3,PORT_COOL=5;
function satsUp(){return(PROG.sats||[]).filter(q=>!q.docked&&!q.landed&&!q.bodyName&&!q.cruise)}   // in Tellus orbit (landed ones: landedUp; a moon's: moonSats)
// free ports in a list of parts (vessel parts or shape entries): a port's top face, nothing stacked on it, not in use
function portsOf(list,used){const P=list.map(o=>({o,d:o.d||PARTS[o.k]})).filter(x=>x.d);
  return P.filter(x=>x.d.kind==='port'&&!used.has(x.o.i)&&(x.d.radial||!P.some(y=>y!==x&&!y.d.surf&&Math.abs(y.o.y0-(x.o.y0+x.o.h))<1e-3&&Math.hypot(y.o.pos[0]-x.o.pos[0],y.o.pos[2]-x.o.pos[2])<0.3)))
    .map(x=>({i:x.o.i,...portGeom(x.o,x.d)}))}
const usedPorts=(att,id)=>new Set(att.flatMap(a=>[...(a.host===id?[a.hpi]:[]),...(a.e.id===id?[a.ppi]:[])]));
// the vessel's free ports (its own and its passengers'), in the vessel frame: face point and outward axis
function shipPorts(s){const A=s.att||[],out=portsOf(s.parts.filter(p=>p.on),usedPorts(A,0)).map(x=>({...x,body:0,fv:x.face,av:x.ax}));
  for(const a of A)for(const x of portsOf(a.e.shape,usedPorts(A,a.e.id)))out.push({...x,body:a.e.id,fv:add(a.p,qrot(a.q,sub(x.face,a.e.cm))),av:qrot(a.q,x.ax)});return out}
// the closest pair of free ports between the vessel and satellite q (body B): world points, axes, offset
const tgtPorts=q=>q.parts?shipPorts(q).filter(x=>x.body===0):portsOf(q.shape,usedPorts(q.attached||[],0)).map(x=>({...x,fv:x.face,av:x.ax}));
function dockPair(s,q,B){let best=null;const qp=tgtPorts(q);if(!qp.length)return null;
  for(const a of shipPorts(s)){const Pa=add(s.r,qrot(s.q,sub(a.fv,s.cm))),Aa=qrot(s.q,a.av);
    for(const b of qp){const Pb=add(B.r,qrot(B.q,sub(b.fv,B.cm))),Ab=qrot(B.q,b.av),d=sub(Pb,Pa),dl=len(d);if(!best||dl<best.dl)best={a,b,Pa,Aa,Pb,Ab,d,dl}}}
  return best}
// capture: faces within PORT_GAP along our axis and PORT_LAT across it, axes opposed within 10°, ports closing under PORT_V
function dockTry(s,q,B,T){if(q.undockT!=null&&T-q.undockT<PORT_COOL)return false;const P=dockPair(s,q,B);if(!dockOK(s,B,P))return false;
  dock(s,q,B,P);return true}
function dockOK(s,B,P){if(!P||P.dl>PORT_GAP+PORT_LAT)return false;
  const g=dot(P.d,P.Aa),lat=len(sub(P.d,mul(P.Aa,g)));if(g<-0.03||g>PORT_GAP||lat>PORT_LAT||dot(P.Aa,P.Ab)>-PORT_COS)return false;
  const va=add(s.v,cross(s.w,sub(P.Pa,s.r))),vb=add(B.v,cross(B.w,sub(P.Pb,B.r)));return len(sub(vb,va))<=PORT_V}
// two vessels of this flight: b joins a (S, or the earlier one) as a passenger; its vessel is kept, so undocking gives it back
function dockTryV(a,b){if(b.undockT!=null&&progT(a)-b.undockT<PORT_COOL)return false;const B=shipBody(b),P=dockPair(a,b,B);if(!dockOK(a,B,P))return false;
  dock(a,entryOf(b),B,P);FLEET.splice(FLEET.indexOf(b),1);return true}
// a vessel becoming a passenger: a registry-style entry (shape, own mass and centre of mass, kit, what it already carries);
// the vessel itself rides along out of sight of the save (not enumerable), so undocking gives back a flyable vessel
function entryOf(v){PROG.satN=(PROG.satN||0)+1;const on=v.parts.filter(p=>p.on);
  const e={id:PROG.satN,name:v.name||`Vessel ${PROG.satN}`,mass:v.mOwn,cm:v.cmOwn.slice(),imgs:0,pending:[],
    shape:shapeOf(on,S&&S.rec&&S.rec.crewed&&S.rec.crewOK),
    attached:(v.att||[]).map(a=>({e:a.e,p:a.p.slice(),q:a.q.slice(),host:a.host,hpi:a.hpi,ppi:a.ppi,kind:a.kind}))};
  e.stack=v.stack?JSON.parse(JSON.stringify(v.stack)):null;e.vst=vstOf(v);if(v.reg){e.id=v.reg.id;e.name=v.reg.name;e.labDays=v.reg.labDays}
  HOOK.satLook&&HOOK.satLook(e.shape,on);kitSet(e);Object.defineProperty(e,'_v',{value:v,enumerable:false,writable:true});return e}
// latch: the target's port is pulled onto ours (turned so the faces oppose, moved so they meet), the two become one rigid
// body, and the joined vessel takes their total momentum and angular momentum
function dock(s,q,B,P){const Qb=qmul(qFromTo(P.Ab,mul(P.Aa,-1)),B.q);
  join(s,q,B,Qb,sub(P.Pa,qrot(Qb,sub(P.b.fv,B.cm))),P.a.body,P.a.i,P.b.i,'port')}
// two bodies become one: q (body B, placed at attitude Qb and position rB) rides on the vessel, held by part hpi of body
// host; the joined vessel takes the pair's total momentum and angular momentum
function join(s,q,B,Qb,rB,host,hpi,ppi,kind){const R=s.q,cm0=s.cm.slice(),m0=s.mass;
  const Iw=(q4,I,w)=>{const l=qrot(qconj(q4),w);return qrot(q4,[l[0]*I[0],l[1]*I[1],l[2]*I[2]])};
  const Pm=add(mul(s.v,m0),mul(B.v,B.m)),L=add(add(cross(s.r,mul(s.v,m0)),Iw(R,s.I,s.w)),add(cross(rB,mul(B.v,B.m)),Iw(Qb,B.I,B.w)));
  const toV=w=>add(qrot(qconj(R),sub(w,s.r)),cm0),qv=qmul(qconj(R),Qb);(s.att=s.att||[]);
  s.att.push({e:q,p:toV(add(rB,qrot(Qb,sub(q.cm,B.cm)))),q:qv,host,hpi,ppi,kind});
  for(const a of q.attached||[])s.att.push({e:a.e,p:toV(add(rB,qrot(Qb,sub(a.p,B.cm)))),q:qmul(qv,a.q),host:a.host||q.id,hpi:a.hpi,ppi:a.ppi,kind:a.kind});
  q.attached=[];q.docked=true;q.undockT=null;SAT_C.delete(q);if(s.target===q.id)s.target=null;if(q._v&&s.tgtV===q._v)s.tgtV=null;
  geom(s);const rc=add(s.r,qrot(R,sub(s.cm,cm0)));s.r=rc;s.v=mul(Pm,1/s.mass);
  const l=qrot(qconj(R),sub(L,cross(rc,Pm)));s.w=qrot(R,[l[0]/s.I[0],l[1]/s.I[1],l[2]/s.I[2]]);s.rcsJ=null;
  HOOK.msg(kind==='claw'?`Claw: holding ${q.name}`:kind==='arm'?`Arm: holding ${q.name}`:`Docked with ${q.name}`)}
// the claw: a claw part of the vessel's own (not holding anything yet) whose tip touches a satellite at under CLAW_V
// grabs it right there: the target is moved out of the overlap and held at exactly the attitude it had
const CLAW_V=1,CLAW_REACH=0.35,CLAW_PUSH=0.1;
const clawFree=(s,p)=>!(s.att||[]).some(x=>x.host===0&&x.hpi===p.i);
const clawTip=p=>[p.pos[0],p.y0+p.h,p.pos[2]];
function clawTry(s,q,A,B,c,T){const a=c.pa;if(!a||a.att||!a.d||a.d.kind!=='claw'||!clawFree(s,a.p)||(q.undockT!=null&&T-q.undockT<PORT_COOL))return false;
  if(len(sub(c.p,hitW(A,clawTip(a.p))))>CLAW_REACH)return false;   // the jaws, not the side of the claw
  const ra=sub(c.p,A.r),rb=sub(c.p,B.r);if(len(sub(add(A.v,cross(A.w,ra)),add(B.v,cross(B.w,rb))))>CLAW_V)return false;
  const ves=!!q.parts;join(s,ves?entryOf(q):q,B,B.q,madd(B.r,c.n,-c.d),0,a.p.i,-1,'claw');if(ves)FLEET.splice(FLEET.indexOf(q),1);return true}
// how far a world point is from a body's surface (its parts' distance fields; negative inside)
function bodyDist(B,w){let d=Infinity;for(const b of B.parts){const l=sub(hitVi(b,hitL(B,w)),b.g.o);d=Math.min(d,partSDF(b.g,l[0],l[1],l[2]))}return d}
// a docked body and everything docked through it
function dockGroup(s,a){const g=[a];for(let k=0;k<g.length;k++)for(const b of s.att)if(!g.includes(b)&&b.host===g[k].e.id)g.push(b);return g}
// a host's port, in the vessel frame: face point and axis
function hostPort(s,a){const h=a.host?s.att.find(x=>x.e.id===a.host):null,L=h?h.e.shape:s.parts,po=L.find(o=>o.i===a.hpi);if(!po)return null;
  const d=po.d||PARTS[po.k],G=portGeom(po,d);return h?{P:add(h.p,qrot(h.q,sub(G.face,h.e.cm))),ax:qrot(h.q,G.ax),d}:{P:G.face,ax:G.ax,d}}
// what each port carries: the force and bending moment that make everything beyond it follow the vessel's motion
// (non-gravitational acceleration plus rotation). Above its rating it lets go, and the body leaves with its momentum.
function portLoads(s){const A=s.att||[];if(!A.length||!s.aB)return;const aB=s.aB,al=s.alB,wb=s.wB;
  for(const a of A.slice()){if(!s.att.includes(a))continue;const H=hostPort(s,a);if(!H)continue;let F=[0,0,0],Mm=[0,0,0];
    for(const g of dockGroup(s,a)){const r=sub(g.p,s.cm),f=mul(add(add(aB,cross(al,r)),cross(wb,cross(wb,r))),g.e.mass);F=add(F,f);Mm=add(Mm,cross(sub(g.p,H.P),f))}
    const mb=len(sub(Mm,mul(H.ax,dot(Mm,H.ax))));a.load=Math.max(len(F)/(H.d.jF||PORT_F),mb/(H.d.jM||PORT_M));
    if(a.load>1){HOOK.msg(a.kind==='claw'?`The claw loses its grip: ${a.e.name} breaks loose`:`Docking port overloaded: ${a.e.name} breaks loose`);undock(s,a.e.id,0)}}}
// undock: the body (and everything docked through it) leaves on its own rails, pushed off along the port axis; momentum is
// shared so the total doesn't change. It goes back into the registry in its own right, as itself.
function undock(s,id,push){const a0=(s.att||[]).find(a=>a.e.id===id);if(!a0)return false;if(push==null)push=a0.kind==='claw'?CLAW_PUSH:a0.kind==='arm'||a0.kind==='bay'?0:PORT_PUSH;const grp=dockGroup(s,a0),T=progT(s),R=s.q,cm0=s.cm.slice();
  const W=x=>add(s.r,qrot(R,sub(x,cm0))),H=hostPort(s,a0),ax=qrot(R,H?H.ax:[0,1,0]);
  let mg=0,cg=[0,0,0];for(const g of grp){mg+=g.e.mass;cg=madd(cg,g.p,g.e.mass)}cg=mul(cg,1/mg);
  const rg=W(cg),vg=add(s.v,cross(s.w,sub(rg,s.r)));
  s.att=s.att.filter(x=>!grp.includes(x));geom(s);const rs=W(s.cm),vs=add(s.v,cross(s.w,sub(rs,s.r))),Mt=s.mass+mg;
  s.r=rs;s.v=madd(vs,ax,-push*mg/Mt);s.rcsJ=null;
  const e=a0.e;e.attached=grp.slice(1).map(x=>({e:x.e,p:add(qrot(qconj(a0.q),sub(x.p,a0.p)),e.cm),q:qmul(qconj(a0.q),x.q),host:x.host===e.id?0:x.host,hpi:x.hpi,ppi:x.ppi,kind:x.kind}));
  SAT_C.delete(e);kitSet(e);
  if(e._v){const v=e._v;v.att=e.attached;e.attached=[];geom(v);rebuildShape(v);
    Object.assign(v,{r:rg,v:madd(vg,ax,push*s.mass/Mt),q:qmul(R,a0.q),w:s.w.slice(),fleet:true,alive:true,undockT:T});FLEET.push(v);
    if(push)HOOK.msg(a0.kind==='claw'?`Released ${v.name}`:`Undocked ${v.name}`);return true}
  Object.assign(e,{r:rg,v:madd(vg,ax,push*s.mass/Mt),epoch:T,spin:{q0:qmul(R,a0.q),w:s.w.slice(),T0:T},docked:false,undockT:T});if(s.body===TELLUS)delete e.bodyName;else e.bodyName=s.body.name;   // r, v in the frame it leaves in
  if(flyable(e)){const v=vesselOf(e,T);PROG.sats=PROG.sats.filter(x=>x!==e);Object.assign(v,{fleet:true,undockT:T,rec:{launched:true,day0:s.rec&&s.rec.day0,ended:false,mini:true}});FLEET.push(v);
    if(push)HOOK.msg(a0.kind==='claw'?`Released ${v.name}`:`Undocked ${v.name}`);return true}   // flyable: back as a vessel
  if(!PROG.sats.includes(e))PROG.sats.push(e);   // a body that came up docked to another joins the registry in its own right
  if(push)HOOK.msg(a0.kind==='claw'?`Released ${e.name}`:`Undocked ${e.name}`);return true}
// at the end of a flight: docked entries either went into the vessel's registration or came down with it
function dockEnd(s){const A=s.att||[];if(!A.length)return;const kept=(PROG.sats||[]).some(q=>(q.attached||[]).some(a=>a.e===A[0].e));
  PROG.sats=PROG.sats.filter(q=>!q.docked);for(const a of A)delete a.e.docked;
  if(!kept){const home=s.alive&&s.landed;HOOK.news(`${A.map(a=>a.e.name).join(', ')} ${home?'brought home':'lost with the vessel'}`,home?'ok':'bad')}}
// ---- several vessels in a flight (sats session; Phase A of the stations plan). S is the vessel you fly; FLEET holds the
// others. A separation that takes a command part (pod or probe core) makes a vessel instead of debris. Every vessel is
// stepped each tick (physics together, or rails together), they collide with each other, and controls only reach S:
// the rest keep their own throttle, SAS and RCS. Switching (tape op 'V') hands the flight record to the new S. At the
// end of the flight every vessel left in a stable orbit is registered.
const FLEET=[];
const ZERO_INP={pitch:0,yaw:0,roll:0,tx:0,ty:0,tz:0};
const inpOf=s=>s&&s.fleet?ZERO_INP:INP;
const isCommand=p=>p.d.kind==='pod'||p.d.kind==='core';
let vesselN=0;
// a vessel built from parts leaving s: clones (the originals stay off in s), re-indexed, their tree, segments and the
// staging events that concern only them; same vessel frame, so it starts exactly where those parts were
function vesselFrom(s,list,r,v,w){const map=new Map(),parts=list.map((p,i)=>{const c={...p,i,oi:p.oi??p.i,oseg:p.oseg??p.seg,on:true,children:[],F:[0,0,0],L:[0,0,0],res:{...p.res},cap:{...p.cap}};map.set(p,c);return c});
  for(const p of list){const c=map.get(p);c.parent=map.get(p.parent)||null;if(c.parent)c.parent.children.push(c);if(c.inBay)c.inBay=map.get(c.inBay)||null}
  const oldSegs=[...new Set(parts.map(c=>c.seg))],segN=new Map(oldSegs.map((k,i)=>[k,i]));for(const c of parts)c.seg=segN.get(c.seg);
  const segs=oldSegs.map(k=>({...s.segs[k]})),inSet=k=>segN.has(k),hasChute=parts.some(c=>c.d.kind==='chute');
  const events=s.events.slice(s.evIdx).filter(e=>[...e.decouple,...e.ignite].every(inSet)&&(e.decouple.length||e.ignite.length||(e.chute&&hasChute)))
    .map(e=>({...e,decouple:e.decouple.map(k=>segN.get(k)),ignite:e.ignite.map(k=>segN.get(k))}));
  const nm=x=>x.some(p=>p.on&&p.d.kind==='pod')?'Capsule':'Probe';if(!s.name)s.name=`${nm(s.parts)} ${++vesselN}`;   // the vessel left behind gets a name too, now there are two
  const n=++vesselN,cmd=parts.find(isCommand);
  const ns={stack:s.stack,parts,segs,events,root:parts.find(c=>!c.parent),groups:[],evIdx:0,body:s.body,alive:true,landed:false,
    av:s.av,throttle:0,sas:false,sasMode:'stab',hold:null,w:w.slice(),chute:false,chuteA:0,thrust:0,qdyn:0,mach:0,aoa:0,gload:0,maxLoad:0,r:r.slice(),v:v.slice(),q:s.q.slice(),att:[],
    fleet:true,name:`${cmd?cmd.d.kind==='pod'?'Capsule':'Probe':'Payload'} ${n}`,site:s.site,rec:{launched:true,day0:s.rec&&s.rec.day0,ended:false,mini:true}};
  geom(ns);rebuildShape(ns);HOOK.cloned&&HOOK.cloned(list,parts);FLEET.push(ns);HOOK.msg(`${ns.name} separates: a vessel of its own ([ / ] to switch)`);return ns}
// one physics step of a vessel that isn't S, at the same instant as S's (the clock is S's to advance)
function fleetPhys(v,dt){const t0=simT;physStep(v,dt);simT=t0;if(v.alive)contactStep(v,dt);simT=t0}
function fleetRails(v,dt){const t0=simT;rails(v,dt);if(simT<t0+dt-1e-9&&v.alive&&!v.landed){const[r,w]=kepler(v.r,v.v,t0+dt-simT,v.body.mu);v.r=r;v.v=w}simT=t0}
// vessels against each other: one impulse at the contact, each side's parts take damage like any contact
function vesselContact(a,b,dt){if(!a.alive||!b.alive||a.landed||b.landed||a.body!==b.body)return;const rel=sub(b.r,a.r),vrel=sub(b.v,a.v);
  const A=shipBody(a),B=shipBody(b);if(len(rel)>A.R+B.R+len(vrel)*dt+0.5)return;
  const n=Math.min(400,Math.max(1,Math.ceil(len(vrel)*dt/HIT_STEP)));let c=null;const r0=B.r;
  for(let k=0;k<=n&&!c;k++){const o=sub(rel,mul(vrel,dt*(n-k)/n));if(len(o)>A.R+B.R)continue;B.r=add(a.r,o);c=hitFind(A,B)}
  if(!c){B.r=r0;return}if(clawTry(a,b,A,B,c,progT(a)))return;const vn=hitResolve(A,B,c);a.r=A.r;a.v=A.v;a.w=A.w;b.r=B.r;b.v=B.v;b.w=B.w;
  if(vn>0.3)HOOK.msg(`Contact between ${a.name||'the vessel'} and ${b.name||'the vessel'} at ${vn.toFixed(1)} m/s`);
  for(const[x,s]of[[c.pa,a],[c.pb,b]])if(x&&!x.att&&vn>hitTol(x.d)&&x.p.on){HOOK.msg(`${x.d.name} broke`);partLost(s,x.p)}}
// a tick: the other vessels step from the same instant first (the clock is S's), then S, then every pair is checked
function fleetPhysAll(dt){for(const v of FLEET)if(v.alive)fleetPhys(v,dt)}
function fleetContacts(dt){if(!FLEET.length)return;const all=[S,...FLEET],here=x=>x===S||FLEET.includes(x);
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j];if(!here(a)||!here(b))continue;
    if(a.alive&&b.alive&&!a.landed&&!b.landed&&a.body===b.body&&dockTryV(a,b))continue;vesselContact(a,b,dt)}
  for(let i=FLEET.length-1;i>=0;i--)if(!FLEET[i].alive)FLEET.splice(i,1)}
// another vessel of this flight within reach: physics, or rails would step them through each other (and never dock)
const fleetNear=s=>s.alive&&!s.landed&&[S,...FLEET].some(v=>v&&v!==s&&v.alive&&!v.landed&&v.body===s.body&&len(sub(v.r,s.r))<HIT_NEAR);
const flightRailsOK=()=>railsOK(S)&&FLEET.every(v=>!v.alive||railsOK(v));
// switch: fly FLEET[i]; the vessel you leave keeps its throttle, SAS and RCS, and the flight record follows you
// (the vessel you leave goes to the end of FLEET, so ] (take the first) and [ (take the last) cycle through them all)
function switchTo(i){const v=FLEET[i];if(!v||!v.alive)return false;FLEET.splice(i,1);FLEET.push(S);S.fleet=true;v.fleet=false;const R=S.rec;S.rec=v.rec;v.rec=R;S=v;
  if(crewOn(S)&&S.rec&&!S.rec.mini&&!S.rec.crewed){S.rec.crewed=true;S.rec.crewOK=true;S.rec.crewInit=1}   // the people aboard are this flight's crew now
  HOOK.rebuild();HOOK.msg(`Flying ${S.name||'the vessel'}`);return true}
// the end of a flight: every other vessel left in a stable orbit is registered (with whatever it has docked)
function fleetEnd(R){for(const v of FLEET){if(!v.alive)continue;satRegister(v,{day0:R.day0,crewed:R.crewed,crewOK:R.crewOK});dockEnd(v)}FLEET.length=0}
// ---- the cargo bay (sats session; stations plan Phase B). A floor with walls and clamshell roof doors: whatever is
// stacked on its floor and fits inside its walls and under its roof is enclosed (p.inBay, set in assemble), shielded from
// the air and its heat while the doors are shut. The doors take DOOR_S of flight time to open or close (p.open, p.doorT;
// on the flight clock, so tapes replay them). With them open the payload is released through the top: pushed out along
// the bay's axis at BAY_PUSH, a vessel of its own whether or not it has a command part.
const DOOR_S=2,BAY_PUSH=0.3;
const doorF=p=>{if(p.doorT==null)return p.open?1:0;const f=clamp((simT-p.doorT)/DOOR_S,0,1);return p.open?f:1-f};   // 0 shut … 1 open
const shielded=p=>!!(p.inBay&&p.inBay.on&&!p.inBay.open&&doorF(p.inBay)===0);   // exposed from the moment the doors are told to open until they're shut again
const profOf=p=>p.d.kind==='bay'&&(p.open||doorF(p)>0)?p.d.profOpen:p.d.prof;   // an open bay's outline has no roof
function bayDoors(s,open){let n=0;for(const p of s.parts){if(!p.on||p.d.kind!=='bay'||!!p.open===open)continue;const f=doorF(p);
    p.open=open;p.doorT=simT-(open?f:1-f)*DOOR_S;n++;if(!open)s.bayShut=Math.max(s.bayShut||0,simT+f*DOOR_S)}   // mid-swing reversals keep their place
  if(!n)return false;if(open)rebuildShape(s);HOOK.msg(open?'Bay doors opening':'Bay doors closing');return true}
// the doors finishing shut make the payload shielded again (the outline changes back)
function bayTick(s){if(s&&s.bayShut!=null&&simT>=s.bayShut){s.bayShut=null;rebuildShape(s)}}
function bayRelease(s){const bays=s.parts.filter(p=>p.on&&p.d.kind==='bay');if(!bays.length)return false;let n=0;
  for(const b of bays){const list=b.children.filter(c=>c.on&&c.inBay===b).flatMap(subtree);if(!list.length)continue;
    if(doorF(b)<1){HOOK.msg('Open the bay doors first');continue}
    if(list.includes(s.root)){HOOK.msg("The vessel's own command part is in the bay");continue}
    const dm=list.reduce((a,p)=>a+partMass(p),0)*1000,ms=s.mass-dm;detach(s,list,[0,BAY_PUSH*ms/(ms+dm),0],0,true);n++}   // 0.3 m/s apart, momentum shared
  if(!n&&bays.every(b=>!b.children.some(c=>c.on&&c.inBay===b)))HOOK.msg('Nothing in the bay');return n>0}
function bayOp(s,op){return op==='open'?bayDoors(s,true):op==='close'?bayDoors(s,false):op==='rel'?bayRelease(s):false}
// contact: the bay is hollow (walls, floor, and a roof only while shut), so a payload can leave without touching it
const BAY_GEO=new WeakMap();
function bayGeo(p,d){const shut=doorF(p)===0;let g=BAY_GEO.get(p);if(g&&g.shut===shut)return g;
  const o=[p.pos[0],p.y0,p.pos[2]],hf=d.h,top=d.h+d.bayL,R=d.r,ri=d.bayIn,pts=[];
  const ring=(r,y)=>{const n=Math.max(8,Math.ceil(6.2832*r/0.25));for(let k=0;k<n;k++){const a=k/n*6.2832;pts.push([o[0]+r*Math.cos(a),o[1]+y,o[2]+r*Math.sin(a)])}};
  const ny=Math.ceil(top/0.2);for(let i=0;i<=ny;i++){const y=top*i/ny;ring(R,y);if(y>hf+0.05)ring(ri,y)}   // outer and inner walls
  for(let r=R-0.25;r>0.05;r-=0.25)ring(r,0);pts.push(o.slice());   // the floor's underside
  if(shut){for(let r=R-0.25;r>0.05;r-=0.25)ring(r,top+0.1);pts.push([o[0],o[1]+top+0.1,o[2]])}   // the shut roof
  g={o,bay:{hf,top,R,ri,shut},prof:[[R,0],[R,top]],h:top,pts,c:[o[0],o[1]+top/2,o[2]],R:Math.hypot(R,top/2+0.1),shut};BAY_GEO.set(p,g);return g}
function baySDF(b,x,y,z){const rad=Math.hypot(x,z),box=(...ds)=>{const pos=ds.filter(v=>v>0);return pos.length?Math.hypot(...pos):Math.max(...ds)};
  let d=box(Math.abs(rad-(b.R+b.ri)/2)-(b.R-b.ri)/2,-y,y-b.top);   // the walls
  d=Math.min(d,box(rad-b.R,-y,y-b.hf));                             // the floor
  if(b.shut)d=Math.min(d,box(rad-b.R,b.top-y,y-(b.top+0.1)));       // the roof
  return d}
// ---- stations (sats session; stations plan Phase C). Ports can sit on any structure: a stack port faces up its line, a
// radial port faces out from the side of whatever it's mounted on (portGeom). A station is a registry stack with a
// habitat or a lab; what it can do comes from what's docked: berths (habitats), crew (the people in crewed capsules
// docked to it, as many as there are berths: each capsule stays as its crew's lifeboat), labs, supplies (pooled across
// the stack, SUP_DAY per crew-day between flights; out of supplies, the labs stop) and free ports.
const SUP_DAY=0.005;   // t of supplies per crew-day (food, water, air without recycling)
const portGeom=(o,d)=>{if(d.radial){const n=[Math.cos(o.phi||0),0,Math.sin(o.phi||0)];return{face:madd([o.pos[0],o.y0+o.h/2,o.pos[2]],n,d.depth),ax:n}}
  return{face:[o.pos[0],o.y0+o.h,o.pos[2]],ax:[0,1,0]}};
// a registry shape from parts: what each part is and where, its resources (supplies persist), and whether a capsule
// carried a real crew (dummies don't count)
function shapeOf(on,crewed){return on.map(p=>{const o={k:p.d.key,pos:p.pos.slice(),y0:p.y0,h:p.h,i:p.i,oi:p.oi??p.i};if(p.rvOut)o.rvOut=1;if(p.phi!=null)o.phi=p.phi;if(p.tdir)o.tdir=p.tdir.slice();if(p.shell)o.shell=p.shell;
  if(p.cap&&Object.keys(p.cap).length)o.res={...p.res};if(p.d.crew&&(crewed||p.crewAboard))o.crew=p.d.crew;return o})}
// a radial port's contact shape: its cylinder along the radial axis (rot carries part-local +Y onto it)
function radialGeo(p,d){let g=HIT_GEO.get(p);if(g)return g;const n=[Math.cos(p.phi||0),0,Math.sin(p.phi||0)],q=qFromTo([0,1,0],n),B=[p.pos[0],p.y0+p.h/2,p.pos[2]],h=d.depth,pts=[];
  const ring=(r,y)=>{const m=Math.max(6,Math.ceil(6.2832*r/0.25));for(let k=0;k<m;k++){const a=k/m*6.2832;pts.push(add(B,qrot(q,[r*Math.cos(a),y,r*Math.sin(a)])))}};
  const ny=Math.max(1,Math.ceil(h/0.2));for(let i=0;i<=ny;i++)ring(d.r,h*i/ny);for(let rr=d.r-0.25;rr>0.05;rr-=0.25)ring(rr,h);pts.push(add(B,mul(n,h)));
  g={o:B,rot:q,prof:[[d.r,0],[d.r,h]],h,pts,c:madd(B,n,h/2),R:Math.hypot(d.r,h/2)};HIT_GEO.set(p,g);return g}
function stationOf(q){if(!q.shape)return null;const A=q.attached||[],bodies=[{e:q,id:0},...A.map(a=>({e:a.e,id:a.e.id}))],P=bodies.flatMap(b=>(b.e.shape||[]).map(o=>({o,d:PARTS[o.k]})).filter(x=>x.d));
  const berths=P.reduce((a,x)=>a+(x.d.berths||0),0),labs=P.filter(x=>x.d.lab).length;if(!berths&&!labs)return null;
  const seats=P.reduce((a,x)=>a+(x.o.crew||0),0),sup=P.reduce((a,x)=>a+((x.o.res||{}).sup||0),0),crew=Math.min(seats,berths);
  const ports=bodies.reduce((n,b)=>n+portsOf(b.e.shape||[],usedPorts(A,b.id)).length,0);
  return{berths,labs,seats,crew,sup,ports,days:crew?sup/(crew*SUP_DAY):Infinity,work:sup>0?Math.min(crew,2*labs):0}}
// between flights: the crew eats, the labs work (two people per lab at most), and the headlines notice when it runs low
// between flights: crews eat, labs work (two people per lab at most), headlines when supplies run low or out. Stations
// (a registry stack) and bases (landed objects around a beacon) work the same way.
function crewTick(q,ents,st,d,again){const need=st.crew*d*SUP_DAY;let left=need;
  for(const e of ents)for(const o of e.shape||[])if(o.res&&o.res.sup>0&&left>0){const x=Math.min(left,o.res.sup);o.res.sup-=x;left-=x}
  const days=(need-left)/(st.crew*SUP_DAY),lab=Math.min(st.crew,2*st.labs)*days;q.labDays=(q.labDays||0)+lab;PROG.labDays=(PROG.labDays||0)+lab;
  const after=again();
  if(left>1e-12&&!q.supOut){q.supOut=true;HOOK.news(`${q.name}: supplies have run out. The crew is on emergency rations and the lab has stopped`,'bad')}
  else if(after.sup>0)q.supOut=false;
  if(after.days<10&&after.sup>0&&!q.supLow){q.supLow=true;HOOK.news(`${q.name}: ${after.days.toFixed(0)} days of supplies left`,'warn')}else if(after.days>=10)q.supLow=false}
function stationTick(d){for(const q of[...satsUp(),...moonSats()]){const st=stationOf(q);if(st&&st.crew)crewTick(q,[q,...(q.attached||[]).map(a=>a.e)],st,d,()=>stationOf(q))}
  for(const a of landedUp().filter(x=>x.beacon)){const st=baseOf(a);if(st.crew)crewTick(a,st.bodies,st,d,()=>baseOf(a))}}
// ---- vessels that stay flyable across flights (sats session; stations plan A2). A registry entry keeps its design
// (q.stack) and state (q.vst: which of the design's stage segments have ignited, SAS, RCS, chute), and each shape part
// its index in that design (o.oi). Rebuilding (vesselOf) assembles the design again, switches off the parts the entry no
// longer has, restores their resources, crew and marks, finds the next staging event from what's left, and carries
// whatever is docked. Vessels split off another keep their parts' design indices (p.oi, p.oseg), so any descendant of a
// design rebuilds the same way. Entries registered before this have no design and stay passive.
const LOAD_R=2500;   // a flyable vessel this close can be switched to (it's loaded into the flight)
const vstOf=s=>({ign:[...new Set(s.parts.filter(p=>s.segs[p.seg]&&s.segs[p.seg].ignited).map(p=>p.oseg??p.seg))],sas:!!s.sas,sasMode:s.sasMode,rcs:!!s.rcs,chute:!!s.chute,av:s.av,dep:s.parts.filter(p=>p.on&&p.dep).map(p=>p.i),E:s.E});   // av: its avionics (control session); dep: legs and wings deployed (vehicle, Q121); E: the battery's charge (Q131)
const flyable=q=>!!(q&&q.stack&&q.shape&&q.shape.length&&q.shape.every(o=>o.oi!=null)&&q.shape.some(o=>PARTS[o.k]&&(PARTS[o.k].kind==='pod'||PARTS[o.k].kind==='core')));
function vesselOf(q,T){const s=newShip(q.stack),by=new Map(q.shape.map(o=>[o.oi,o])),st=q.vst||{},ign=new Set(st.ign||[]);if(st.av!=null)s.av=st.av;   // the avionics it flew with (older entries: today's)
  for(const p of s.parts){const o=by.get(p.i);p.on=!!o;if(!o)continue;if(o.res)for(const k in o.res)if(k in p.res)p.res[k]=o.res[k];if(o.crew)p.crewAboard=o.crew;if(o.rvOut){p.rvOut=true;p.xm=0}}
  for(const i of st.dep||[]){const p=s.parts.find(x=>x.i===i);if(p&&p.on)p.dep=true}   // legs and wings as they were left (vehicle, Q121)
  if(st.E!=null)s.E=st.E;   // the battery as it was left (Q131; powerStep caps it at what's still aboard)
  if(q.nodes&&q.nodes.length){const N=q.nodes.filter(n=>n.T>T).map(n=>({t:n.T-T,dv:n.dv.slice(),b:n.b}));s.node=N.shift()||null;s.nodeQ=N}   // its planned burns, in this flight's time (Q49 slice 3)
  s.segs.forEach((g,k)=>{g.ignited=ign.has(k)});
  // the next staging event: the first that hasn't happened (something still there to drop, a segment not yet lit, a chute)
  const has=k=>s.parts.some(p=>p.on&&p.seg===k);
  s.evIdx=s.events.findIndex(e=>e.decouple.some(has)||e.ignite.some(k=>has(k)&&!ign.has(k))||(e.chute&&!st.chute&&s.parts.some(p=>p.on&&p.d.kind==='chute')));if(s.evIdx<0)s.evIdx=s.events.length;
  s.att=(q.attached||[]).map(a=>({e:a.e,p:a.p.slice(),q:a.q.slice(),host:a.host,hpi:a.hpi,ppi:a.ppi,kind:a.kind}));geom(s);rebuildShape(s);
  if(q.landed){HOOK.unshape&&HOOK.unshape(s.parts,by);   // on the surface: in its body's frame
    Object.assign(s,{body:landedBody(q),pf:q.pf.slice(),qLocal:q.ql.slice(),landed:true,alive:true,name:q.name,sas:!!st.sas,sasMode:st.sasMode||'stab',rcs:!!st.rcs,throttle:0,reg:q});syncLanded(s);return s}
  const[r,v]=satAt(q,T),sp=satSpin(q,T,r,v);HOOK.unshape&&HOOK.unshape(s.parts,by);
  Object.assign(s,{r,v,q:sp.q,w:sp.w.slice(),landed:false,alive:true,body:orbBody(q),name:q.name,sas:!!st.sas,sasMode:st.sasMode||'stab',rcs:!!st.rcs,chute:!!st.chute,throttle:0,reg:q});
  return s}
// a flyable registry vessel near s, loaded into this flight (it leaves the register until the flight ends)
const nearbyFlyable=s=>s&&!s.landed?orbitsAt(s.body).filter(q=>flyable(q)&&len(sub(satAt(q,progT(s))[0],s.r))<LOAD_R):[];
function loadEntry(q,s){const i=(PROG.sats||[]).indexOf(q);if(i<0||!flyable(q))return null;const v=vesselOf(q,progT(s));PROG.sats.splice(i,1);
  Object.assign(v,{fleet:true,rec:{launched:true,day0:s.rec&&s.rec.day0,ended:false,mini:true}});if(s.target===q.id){s.target=null;s.tgtV=v}FLEET.push(v);return v}
const crewOn=s=>s.parts.reduce((a,p)=>a+(p.on&&p.crewAboard?p.crewAboard:0),0);
// ---- the arm (sats session; stations plan D). A robotic arm on the side of any structure: two 5 m booms from a shoulder
// on its base. Grapple: a body within reach and moving slowly relative to us (a satellite, a vessel of this flight, or
// the payload in our open bay) is held where it is, as a passenger (kind 'arm'). Berth: the arm carries it to a free
// port of our stack (to a stand-off ARM_OFF out, aligned, then straight in) and it latches as a docking. Stow: into an
// open cargo bay, on its floor (kind 'bay'): close the doors and bring it home. Release: let go, no push. Moving a held
// body is internal motion: the stack's centre of mass (s.r) and velocity stay where they were.
const ARM_R=10,ARM_V=0.5,ARM_SPD=0.15,ARM_ROT=3*Math.PI/180,ARM_OFF=0.5;
const armBase=p=>{const n=[Math.cos(p.phi||0),0,Math.sin(p.phi||0)];return{P:madd([p.pos[0],p.y0+p.h/2,p.pos[2]],n,0.35),n}};   // the shoulder (vessel frame) and its outward axis
const armHeld=(s,p)=>(s.att||[]).find(a=>a.kind==='arm'&&a.host===0&&a.hpi===p.i);
const armOf=s=>s.parts.find(p=>p.on&&p.d.kind==='arm'&&armHeld(s,p))||null;
const armBusy=s=>!!(s&&(s.att||[]).some(a=>a.goal));
// the end effector on a held body: a.gp, a point in its own frame, chosen at capture
const armGrip=(a,p=a.p,q=a.q)=>add(p,qrot(q,sub(a.gp||a.e.cm,a.e.cm)));
function armGrab(s){const arm=s.parts.find(p=>p.on&&p.d.kind==='arm'&&!armHeld(s,p));if(!arm){HOOK.msg('No free arm');return false}
  const base=add(s.r,qrot(s.q,sub(armBase(arm).P,s.cm))),T=progT(s);
  // the payload in our own open bay first (it leaves the vessel's parts and is held at once)
  for(const b of s.parts.filter(p=>p.on&&p.d.kind==='bay'&&doorF(p)===1)){const list=b.children.filter(c=>c.on&&c.inBay===b).flatMap(subtree);if(!list.length||list.includes(s.root))continue;
    const n0=FLEET.length;detach(s,list,[0,0,0],0,true);if(FLEET.length>n0)return armTake(s,arm,FLEET[FLEET.length-1],T)}
  let best=null;
  for(const q of orbitsAt(s.body)){if(!q.shape||!q.shape.length)continue;const B=satBody(q,T),d=len(sub(B.r,base))-B.R;if(d<ARM_R&&len(sub(B.v,s.v))<ARM_V&&(!best||d<best.d))best={d,x:q}}
  for(const v of FLEET){if(!v.alive||v.landed||v.body!==s.body)continue;const d=len(sub(v.r,base))-shipBody(v).R;if(d<ARM_R&&len(sub(v.v,s.v))<ARM_V&&(!best||d<best.d))best={d,x:v}}
  if(!best){HOOK.msg(`Nothing within the arm's ${ARM_R} m, slow enough to catch`);return false}
  return armTake(s,arm,best.x,T)}
function armTake(s,arm,x,T){const ves=!!x.parts,B=ves?shipBody(x):satBody(x,T),base=add(s.r,qrot(s.q,sub(armBase(arm).P,s.cm)));
  // the grapple point: where the line from the shoulder meets the body's bounding sphere
  const toB=sub(B.r,base),dl=len(toB),gp=dl>1e-9?sub(B.r,mul(toB,Math.min(B.R,dl)/dl)):B.r.slice();
  if(len(sub(gp,base))>ARM_R+1e-6){HOOK.msg('Out of the arm\'s reach');return false}
  const e=ves?entryOf(x):x;join(s,e,B,B.q,B.r,0,arm.i,-1,'arm');if(ves)FLEET.splice(FLEET.indexOf(x),1);
  const a=s.att.find(z=>z.e===e);if(a)a.gp=add(qrot(qconj(B.q),sub(gp,B.r)),B.cm);return!!a}
const armReach=(arm,a,p,q)=>len(sub(armGrip(a,p,q),armBase(arm).P))<=ARM_R+1e-6;
// berth: the closest pair of free ports, one of ours (not on the held body or anything docked through it), one of its
function armBerth(s){const arm=armOf(s),a=arm&&armHeld(s,arm);if(!a||a.goal)return false;
  const ids=new Set(dockGroup(s,a).map(x=>x.e.id)),ours=shipPorts(s).filter(x=>!ids.has(x.body)),theirs=portsOf(a.e.shape,usedPorts(s.att,a.e.id));
  let best=null;for(const o of ours)for(const t of theirs){const d=len(sub(add(a.p,qrot(a.q,sub(t.face,a.e.cm))),o.fv));if(!best||d<best.d)best={d,o,t}}
  if(!best){HOOK.msg('No pair of free ports to berth to');return false}
  const{o,t}=best,qg=qnorm(qmul(qFromTo(qrot(a.q,t.ax),mul(o.av,-1)),a.q)),pg=sub(o.fv,qrot(qg,sub(t.face,a.e.cm))),ps=madd(pg,o.av,ARM_OFF);
  if(!armReach(arm,a,pg,qg)||!armReach(arm,a,ps,qg)){HOOK.msg('That port is beyond the arm\'s reach');return false}
  a.goal={kind:'berth',stand:{p:ps,q:qg},end:{p:pg,q:qg},stage:0,host:o.body,hpi:o.i,ppi:t.i,d0:len(sub(ps,a.p))+ARM_OFF};HOOK.msg(`Arm: berthing ${a.e.name}`);return true}
// stow: into an open, empty cargo bay, its own axis up the bay's, its base on the floor, centred
function armStow(s){const arm=armOf(s),a=arm&&armHeld(s,arm);if(!a||a.goal)return false;
  const b=s.parts.find(p=>p.on&&p.d.kind==='bay'&&doorF(p)===1&&!s.parts.some(c=>c.on&&c.inBay===p)&&!(s.att||[]).some(x=>x.kind==='bay'&&x.hpi===p.i));
  if(!b){HOOK.msg('No open, empty cargo bay');return false}
  if(dockGroup(s,a).length>1){HOOK.msg('Only a single body fits in the bay');return false}
  const ps=a.e.shape.filter(o=>PARTS[o.k]),y0=Math.min(...ps.map(o=>o.y0)),y1=Math.max(...ps.map(o=>o.y0+o.h)),rr=Math.max(...ps.map(o=>Math.hypot(o.pos[0],o.pos[2])+PARTS[o.k].r));
  if(y1-y0>b.d.bayL||rr>b.d.bayIn){HOOK.msg(`${a.e.name} doesn't fit in the bay`);return false}
  const qg=[0,0,0,1],fl=b.y0+b.h,pg=[b.pos[0]+a.e.cm[0],fl-y0+a.e.cm[1],b.pos[2]+a.e.cm[2]],st=add(pg,[0,b.d.bayL+0.3,0]);
  if(!armReach(arm,a,pg,qg)||!armReach(arm,a,st,qg)){HOOK.msg('The bay is beyond the arm\'s reach');return false}
  a.goal={kind:'stow',stand:{p:st,q:qg},end:{p:pg,q:qg},stage:0,bay:b.i,d0:len(sub(st,a.p))+b.d.bayL};HOOK.msg(`Arm: stowing ${a.e.name}`);return true}
function armFree(s){const arm=armOf(s),a=arm&&armHeld(s,arm);if(!a||a.goal)return false;undock(s,a.e.id,0);return true}
function armOp(s,op){return op==='grab'?armGrab(s):op==='berth'?armBerth(s):op==='stow'?armStow(s):op==='free'?armFree(s):false}
// each step: the held body moves toward its next waypoint (with whatever is docked through it), rigidly in the vessel
// frame; the vessel's centre of mass is recomputed, s.r (that centre, in the world) stays put
function armStep(s){if(!s||!s.att)return;for(const a of s.att.slice()){const g=a.goal;if(!g||!s.att.includes(a))continue;
  const tg=g.stage===0?g.stand:g.end,dp=sub(tg.p,a.p),dl=len(dp),st=ARM_SPD*DT,qe=qmul(tg.q,qconj(a.q)),sg=qe[3]<0?-1:1,vv=[qe[0]*sg,qe[1]*sg,qe[2]*sg],vl=len(vv),ang=2*Math.atan2(vl,Math.abs(qe[3])),rs=ARM_ROT*DT;
  const np=dl>st?madd(a.p,dp,st/dl):tg.p.slice(),dq=ang>rs&&vl>1e-12?qaxis(mul(vv,1/vl),rs):qnorm(qmul(tg.q,qconj(a.q)));
  for(const x of dockGroup(s,a)){if(x===a)continue;x.p=add(np,qrot(dq,sub(x.p,a.p)));x.q=qnorm(qmul(dq,x.q))}
  a.p=np;a.q=qnorm(qmul(dq,a.q));geom(s);
  if(dl>st||ang>rs)continue;if(g.stage===0){g.stage=1;continue}
  delete a.goal;delete a.gp;
  if(g.kind==='berth')Object.assign(a,{kind:'port',host:g.host,hpi:g.hpi,ppi:g.ppi}),HOOK.msg(`Berthed ${a.e.name}`);
  else Object.assign(a,{kind:'bay',host:0,hpi:g.bay,ppi:-1}),HOOK.msg(`${a.e.name} stowed in the bay`)}}
// ---- moonbases (sats session; stations plan E). A vessel that ends a flight resting on a body other than home is saved
// in that body's frame (q.landed, q.bodyName, q.pf: its centre of mass, q.ql: its attitude): drawn when near, a target
// for landing, flyable again (the flight starts on the surface). A base beacon makes a base: everything landed within
// BASE_R of it (on the surface) belongs to it; berths, crew, labs and supplies add up across them, and between flights
// they work as a station's do. Landed objects are immovable for contact (and, for now, take no damage).
const BASE_R=500;
function landedUp(){return(PROG.sats||[]).filter(q=>q.landed&&!q.docked)}
const landedBody=q=>BODIES.find(b=>b.name===q.bodyName)||null;
// ---- orbits about a moon (sats session: the Selene relay). Kept in the moon's frame (q.bodyName; r, v relative to it).
// In a flight they ride Kepler (satAt). Between flights Tellus's tide steps them (RK4, ~120 steps an orbit), because it
// matters: it pumps a high, steeply inclined orbit's eccentricity (Lidov-Kozai) into the ground or out of the SOI within
// days (NOTES, "The Selene relay"). One that leaves the SOI joins its parent's registry; one that meets the ground is lost.
const MOON_PE=5e3;   // how far above its highest ground (bodyTop) a moon's orbit must stay to be registered (airless)
const orbBody=q=>q.bodyName&&BODIES.find(b=>b.name===q.bodyName)||TELLUS;
function moonSats(b){return(PROG.sats||[]).filter(q=>q.bodyName&&!q.landed&&!q.docked&&!q.cruise&&(!b||q.bodyName===b.name))}
const orbitsAt=b=>b===TELLUS?satsUp():moonSats(b);   // registered orbiters about body b (what a flight there can meet)
// one RK4 step of an orbit about B under its tides (pertAcc), in program time (ORB_T0 = 0)
function tideRK4(B,r,v,t,h){const acc=(r,t)=>{const rl=len(r),a=mul(r,-B.mu/(rl*rl*rl)),p=pertAcc(B,r,t,false);return p?add(a,p):a};
  const a1=acc(r,t),r2=add(r,mul(v,h/2)),v2=add(v,mul(a1,h/2)),a2=acc(r2,t+h/2),r3=add(r,mul(v2,h/2)),v3=add(v,mul(a2,h/2)),
    a3=acc(r3,t+h/2),r4=add(r,mul(v3,h)),v4=add(v,mul(a3,h)),a4=acc(r4,t+h);
  return[add(r,mul(add(add(v,mul(v2,2)),add(mul(v3,2),v4)),h/6)),add(v,mul(add(add(a1,mul(a2,2)),add(mul(a3,2),a4)),h/6))]}
function moonOrbStep(q,T1){const B=orbBody(q),o=ORB_T0;ORB_T0=0;let r=q.r,v=q.v,t=q.epoch,out=null;   // program time: the moons' phase is ORB_T0 + t
  const floor=B.R+(B.atm||0);   // Tellus's orbiters (only ones adrift, below) end in the air
  while(t<T1){const el=elements(r,v,B.mu);if(len(r)>soiAt(B,t)){out='soi';break}
    const h=Math.min(T1-t,600,el.e<1?el.period/120:600);
    if(el.pe<floor&&dot(r,v)<0){const nR=-Math.acos(clamp((el.p/floor-1)/el.e,-1,1));if(el.nu>=nR||tPe(el,nR)-tPe(el,el.nu)<=h){out='ground';break}}   // inbound, and its path meets the ground within this step
    [r,v]=tideRK4(B,r,v,t,h);t+=h}
  if(out==='soi'){const[R0,V0]=bodyRel(B,t);r=add(r,R0);v=add(v,V0);if(B.parent===TELLUS)delete q.bodyName;else q.bodyName=B.parent.name}
  ORB_T0=o;q.r=r;q.v=v;q.epoch=t;
  if(out==='ground'){const i=(PROG.sats||[]).indexOf(q);if(i>=0)PROG.sats.splice(i,1);HOOK.news(B===TELLUS?`${q.name} sank into the air and burned up: with nothing left to hold it, the moons' tides stretched its orbit down`:`${q.name} came down on ${B.name}: Tellus's pull stretched its orbit into the ground`,'bad')}
  if(out==='soi')HOOK.news(`${q.name} slipped out of ${B.name}'s pull and now orbits ${B.parent.name}`,'warn');return out}
// ---- station-keeping (space session, QUEUE Q50; ROADMAP W2). A satellite holds its orbit (its slot) by spending its own
// propellant against the moons' tides, at a rate measured once for its orbit (slotRate; study_slot.mjs: ~0.03 m/s a day at
// 1,000 km, ~0.3 at 3,000, ~0.4 stationary; NOTES § "Station-keeping"). Held, it stays on its exact Kepler rails. Dry, it
// drifts: between flights the tide steps it as it steps every orbit about a moon, so whatever needed the slot (TV in the
// capital's sky) stops by itself, and nothing is destroyed for running out. Orbits the flight treats as unperturbed
// (pertNear), or so weakly that the drift is a few km a month (SK_MIN: low Tellus orbits), cost nothing and never drift. A flight that docks with it or flies it re-registers it:
// a new slot, and its tanks as they are then.
const SK_D=20,SK_MIN=0.02,TILT_MIN=3e-5,TILT_DT=DAY_S/2;   // days of tide a rate is measured over (secular drift; the wobble within
// an orbit averages out); m/s a day of size and shape drift below which it's ignored both ways (no cost, no drift); radians a
// day of tilt below which the plane is left alone (low orbits: ~0.03° a month); the tilt step (study_slot.mjs)
function slotRate(q){if(q.skRate!=null)return q.skRate;const B=orbBody(q),el0=elements(q.r,q.v,B.mu);q.skTilt=0;
  if(!(el0.e<1)||!pertNear(B,el0))return q.skRate=0;
  const o=ORB_T0;ORB_T0=0;const P=el0.period,h=Math.min(600,P/120),N=16;let r=q.r,v=q.v,t=q.epoch;
  const mean=()=>{let hv=[0,0,0],a=0,e=0;for(let k=0;k<N;k++){const x=elements(r,v,B.mu);hv=add(hv,mul(x.h,1/(x.hl*N)));a+=x.a/N;e+=x.e/N;for(let j=0;j<8;j++){[r,v]=tideRK4(B,r,v,t,P/N/8);t+=P/N/8}}return{hv,a,e}};   // one orbit's mean
  // net change between one-orbit means 20 days apart: the moons' periodic pull (Nyx 4.2 days, Selene 13) mostly cancels,
  // the secular drift stays (a deadband controller on the full physics is the better measure, but a crude one pumped the
  // eccentricity: NOTES § "Station-keeping, re-tuned")
  const m0=mean(),T1=q.epoch+SK_D*DAY_S;while(t<T1){const dt=Math.min(h,T1-t);[r,v]=tideRK4(B,r,v,t,dt);t+=dt}const m1=mean();
  ORB_T0=o;const vc=Math.sqrt(B.mu/el0.a),ang=Math.acos(clamp(dot(m0.hv,m1.hv)/(len(m0.hv)*len(m1.hv)),-1,1)),k=(vc/2*Math.abs(m1.a-m0.a)/el0.a+vc/2*Math.abs(m1.e-m0.e))/SK_D;
  q.skTilt=ang/SK_D;return q.skRate=k<SK_MIN?0:k}   // size + shape are held (paid); the tilt is let go (tiltStep); phase is free
const slotTilt=q=>(slotRate(q),q.skTilt||0),tideMatters=q=>slotRate(q)>0||slotTilt(q)>TILT_MIN;
// a held orbit's plane under the tide (MIDGAME § Satellites: a good design outlasts its era, so holding the tilt, ~70 % of
// the cost, is left out, as real geostationary satellites do late in life): the torque of the tide averaged over one orbit
// turns its angular momentum; size, shape and phase stay as held. Program time, steps of TILT_DT
function tiltStep(q,T1){const B=orbBody(q),o=ORB_T0;ORB_T0=0;let r=q.r,v=q.v,t=q.epoch;const P=elements(r,v,B.mu).period,N=24;
  while(t<T1){const dt=Math.min(T1-t,TILT_DT);let tq=[0,0,0];
    for(let i=0;i<N;i++){const ti=t+P*i/N,ri=kepler(r,v,ti-t,B.mu)[0],a=pertAcc(B,ri,ti,false);if(a)tq=add(tq,cross(ri,a))}
    const h=cross(r,v),Q=qFromTo(norm(h),norm(add(h,mul(tq,dt/N))));[r,v]=kepler(r,v,dt,B.mu);r=qrot(Q,r);v=qrot(Q,v);t+=dt}
  ORB_T0=o;Object.assign(q,{r,v,epoch:t})}
// what it can burn: tank fuel through its best engine (vacuum Isp), then RCS gas through its thrusters
const SK_GAS_ISP=PARTS.rcs.isp;
function skProp(q){let isp=0,rcs=false;for(const o of q.shape||[]){const d=PARTS[o.k];if(!d)continue;if(d.kind==='engine')isp=Math.max(isp,d.ispV);if(d.kind==='rcs')rcs=true}
  return[isp&&{k:'fuel',isp},rcs&&{k:'gas',isp:SK_GAS_ISP}].filter(Boolean)}
// tonnes (entries keep their mass in kg; tanks hold tonnes)
const skMass=q=>((q.mass||0)+(q.attached||[]).reduce((a,x)=>a+(x.e.mass||0),0))/1000,skAmt=(q,k)=>(q.shape||[]).reduce((a,o)=>a+(o.res&&o.res[k]||0),0);
function skDv(q){let m=skMass(q),dv=0;for(const p of skProp(q)){const f=Math.min(skAmt(q,p.k),m*0.999);if(f>0){dv+=p.isp*G0*Math.log(m/(m-f));m-=f}}return dv}
// spend dv m/s of station-keeping from its tanks; returns what it couldn't pay
function skSpend(q,dv){for(const p of skProp(q)){if(!(dv>0))break;const m=skMass(q),have=skAmt(q,p.k);if(!(have>0))continue;
  const can=p.isp*G0*Math.log(m/(m-Math.min(have,m*0.999))),use=Math.min(dv,can),dm=use>=can?have:m*(1-Math.exp(-use/(p.isp*G0)));
  for(const o of q.shape)if(o.res&&o.res[p.k]>0)o.res[p.k]=Math.max(0,o.res[p.k]-dm*o.res[p.k]/have);q.mass-=dm*1000;dv-=use}
  SAT_C.delete(q);return dv>1e-9?dv:0}
const skLife=q=>{const k=holdRate(q);return q.adrift!=null?0:k>0?skDv(q)/k:Infinity};   // (holdRate: below, with decay)   // days it can still hold its orbit
// ---- orbital decay (space session, QUEUE Q25). Above the flight's air (cut at TELLUS.atm = 100 km) a thin upper
// atmosphere still drags on low orbits between flights. The flight itself ignores it: over a few hours it changes nothing.
// Density: Vallado's exponential model (CIRA-72, moderate sun): rows of [km, kg/m³, scale height km]. The planet is a fifth
// of Earth but its air is Earth's height, so the table carries over as it is (NOTES § "Orbital decay").
const THERMO=[[100,5.297e-7,5.877],[110,9.661e-8,7.263],[120,2.438e-8,9.473],[130,8.484e-9,12.636],[140,3.845e-9,16.149],[150,2.070e-9,22.523],
  [180,5.464e-10,29.74],[200,2.789e-10,37.105],[250,7.248e-11,45.546],[300,2.418e-11,53.628],[350,9.518e-12,53.298],[400,3.725e-12,58.515],
  [450,1.585e-12,60.828],[500,6.967e-13,63.822],[600,1.454e-13,71.835],[700,3.614e-14,88.667],[800,1.17e-14,124.64],[900,5.245e-15,181.05],[1000,3.019e-15,268]];
function thinAir(h){const k=h/1e3;if(!(k>=100)||k>2000)return 0;let i=THERMO.length-1;while(THERMO[i][0]>k)i--;const[k0,r0,H]=THERMO[i];return r0*Math.exp((k0-k)/H)}
// drag per unit dynamic pressure per kg (Cd·A/m, m²/kg): tumbling, so the mean projected area of its outline, taken as one
// cylinder around every part (a quarter of its surface, Cauchy), Cd 2.2; what's docked to it counts in both
function dragK(q){let A=0;for(const e of[q,...(q.attached||[]).map(x=>x.e)]){let R=0,y0=Infinity,y1=-Infinity;
    for(const o of e.shape||[]){const d=PARTS[o.k];if(!d)continue;R=Math.max(R,Math.hypot(o.pos?o.pos[0]:0,o.pos?o.pos[2]:0)+d.r);y0=Math.min(y0,o.y0);y1=Math.max(y1,o.y0+o.h)}
    if(R>0)A+=(2*Math.PI*R*(y1-y0)+2*Math.PI*R*R)/4}
  return 2.2*A/(skMass(q)*1000)}
// orbit-averaged drag on a Tellus orbit (a, e): {da, de} per second (Gauss, the drag along the velocity) and the mean
// deceleration ad (m/s²), sampled evenly in time
function dragRates(a,e,K){const mu=TELLUS.mu,N=36;let da=0,de=0,ad=0;
  for(let i=0;i<N;i++){const M=2*Math.PI*(i+.5)/N;let E=M;for(let k=0;k<6;k++)E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
    const r=a*(1-e*Math.cos(E)),v=Math.sqrt(mu*(2/r-1/a)),cn=(Math.cos(E)-e)/(1-e*Math.cos(E)),f=0.5*thinAir(r-TELLUS.R)*v*v*K;
    da-=2*a*a*v/mu*f;de-=2*(e+cn)/v*f;ad+=f}
  return{da:da/N,de:de/N,ad:ad/N}}
const DECAY_FLOOR=()=>TELLUS.R+TELLUS.atm;
// the m/s a day it costs to hold this orbit against drag (0 above the table, around a moon, or with no outline)
function dragRate(q){if(q.bodyName)return 0;const el=elements(q.r,q.v,TELLUS.mu);if(!(el.e<1)||el.pe-TELLUS.R>2000e3)return 0;const K=dragK(q);return K>0?dragRates(el.a,el.e,K).ad*DAY_S:0}
const holdRate=q=>slotRate(q)+dragRate(q);   // tides + drag: what holding its orbit costs a day
// let drag work on a Tellus orbit from q.epoch to T1, on its rails: (a, e) by the averaged rates in steps that keep the
// periapsis change small, the mean anomaly carried along, the apsides fixed. Below the air's top it's gone. Returns the
// re-entry time, or null.
function decayAE(a,e,K,t,T1,stepCb){const fl=DECAY_FLOOR();
  while(t<T1){const g=dragRates(a,e,K),n=Math.sqrt(TELLUS.mu/(a*a*a)),dpe=g.da*(1-e)-a*g.de,pe=a*(1-e);
    if(pe<=fl)return{t,a,e,gone:true};
    const dt=Math.min(T1-t,Math.max(2*Math.PI/n,dpe<0?0.05*(pe-fl)/-dpe:Infinity));stepCb&&stepCb(n,dt);
    a+=g.da*dt;e=Math.max(0,e+g.de*dt);t+=dt}
  return{t,a,e,gone:a*(1-e)<=fl}}
function decayStep(q,T1){const mu=TELLUS.mu,el=elements(q.r,q.v,mu),K=dragK(q);if(!(K>0)||!(el.e<1))return;
  // the warning looks across the whole jump, so a long wait between flights can't skip it: 10 days ahead of re-entry, or
  // at once if it comes down sooner (the news then reads in order: warned, then gone)
  if(!q.decayWarn&&!q.junk){const L=decayLife(q);if(L<10+(T1-q.epoch)/DAY_S){q.decayWarn=1;HOOK.news(`${q.name} is sinking into the upper air: it will re-enter within ${daysS(Math.max(1,Math.min(10,L)))}`,'warn')}}
  const E0=2*Math.atan2(Math.sqrt(1-el.e)*Math.sin(el.nu/2),Math.sqrt(1+el.e)*Math.cos(el.nu/2));let M=E0-el.e*Math.sin(E0);
  const o=decayAE(el.a,el.e,K,q.epoch,T1,(n,dt)=>{M+=n*dt});
  if(o.gone){const i=PROG.sats.indexOf(q);if(i>=0)PROG.sats.splice(i,1);if(!q.junk)HOOK.news(`${q.name} has re-entered: the thin upper air finally pulled it down, and it burned up`,'bad');return true}
  const a=o.a,e=o.e,n=Math.sqrt(mu/(a*a*a)),rp=a*(1-e),vp=Math.sqrt(mu*(1+e)/rp),[r,v]=kepler(mul(el.P,rp),mul(el.Q,vp),(((M%(2*Math.PI))+2*Math.PI)%(2*Math.PI))/n,mu);
  Object.assign(q,{r,v,epoch:o.t});
}
// days until it re-enters if nothing holds it (Infinity past 20 years); daysS writes a span of days
const daysS=d=>d>=YEAR_D?`${(d/YEAR_D).toFixed(1)} years`:d>=1?`${Math.round(d)} day${Math.round(d)===1?'':'s'}`:'less than a day';
function decayLife(q){if(q.bodyName)return Infinity;const el=elements(q.r,q.v,TELLUS.mu),K=dragK(q);if(!(K>0)||!(el.e<1)||el.pe-TELLUS.R>2000e3)return Infinity;
  const H=20*YEAR_D*DAY_S,o=decayAE(el.a,el.e,K,0,H);return o.gone?o.t/DAY_S:Infinity}
// between flights (advanceDays, program time T0 → T1): held orbits pay for the time (tides and drag); dry ones drift under
// the tides, or decay in the upper air; a held orbit (or one too weakly pulled to need holding) only turns its tilt (tiltStep)
function orbTick(T0,T1){for(const q of[...(PROG.sats||[])]){if(q.docked||q.landed||!PROG.sats.includes(q))continue;
  if(q.nodes)nodesTick(q,T1);if(!PROG.sats.includes(q))continue;   // planned burns first, at their times (Q49 slice 3)
  if(q.cruise){if(q.halt){if(q.epoch<T1)q.epoch=T1}else if(q.epoch<T1)cruiseStep(q,T1);continue}   // in flight (Q49); one waiting at an atmosphere
  // keeps its place while time passes (a stopgap until slice 2 stops the clock before it), so Fly starts it there
  if(q.junk){if(q.epoch<T1)(q.bodyName?moonOrbStep:decayStep)(q,T1);continue}   // debris: rails + decay only (Q26)
  if(q.adrift==null){const k=holdRate(q);
    if(k>0){const t0=Math.max(q.skT??T0,q.epoch),had=skDv(q)>0,left=skSpend(q,k*(T1-t0)/DAY_S);q.skT=T1;if(left){
      const tDry=had?T1-left/k*DAY_S:t0,[r,v]=satAt(q,tDry);Object.assign(q,{r,v,epoch:tDry,adrift:tDry/DAY_S});
      if(had)HOOK.news(`${q.name} has used the last of its propellant holding its orbit: from now on it ${slotRate(q)>0?'drifts':'sinks'}`,'warn')}}   // (one that never had any just drifts)
    if(q.adrift==null){if(q.epoch<T1&&slotTilt(q)>TILT_MIN)tiltStep(q,T1);continue}}   // held (or nothing to hold): only the tilt moves
  if(!(q.epoch<T1))continue;
  if(q.bodyName||tideMatters(q))moonOrbStep(q,T1);else decayStep(q,T1)}
  conjTick(T0,T1);fragTick(T0,T1)}   // debris, slices 2 and 3
const pfDist=(b,a,c)=>Math.acos(clamp(dot(norm(a),norm(c)),-1,1))*b.R;   // along the surface
// a landed object as a contact body at flight time t: fixed to its body, turning with it, immovable
function landBody(q,t){const b=landedBody(q),M=satMP(q),r=fromPF(b,q.pf,t);return{sat:q,r,v:surfVel(b,r),q:qmul(qBody(b,t),q.ql),w:[0,bodyOmega(b),0],m:1e15,I:[1e18,1e18,1e18],cm:M.cm,parts:M.parts,R:M.R}}
function landRegister(s,R){const on=s.parts.filter(p=>p.on),b=s.body,beacon=on.some(p=>p.d.kind==='beacon'),here=landedUp().filter(x=>x.bodyName===b.name);
  PROG.sats=PROG.sats||[];PROG.satN=(PROG.satN||0)+1;
  const q={id:PROG.satN,landed:true,bodyName:b.name,pf:s.pf.slice(),ql:s.qLocal.slice(),mass:s.mOwn??s.mass,cm:(s.cmOwn||s.cm).slice(),born:PROG.day,imgs:0,pending:[],beacon,
    name:beacon?`${b.name} Base ${here.filter(x=>x.beacon).length+1}`:`${b.name} lander ${here.length+1}`};
  q.shape=shapeOf(on,R.crewed&&R.crewOK);q.attached=(s.att||[]).map(a=>({e:a.e,p:a.p.slice(),q:a.q.slice(),host:a.host,hpi:a.hpi,ppi:a.ppi,kind:a.kind}));
  q.stack=s.stack?JSON.parse(JSON.stringify(s.stack)):null;q.vst=vstOf(s);
  if(s.reg){const o=s.reg;Object.assign(q,{id:o.id,name:o.name,born:o.born,labDays:o.labDays})}
  kitSet(q);PROG.sats.push(q);R.satId=q.id;HOOK.satLook&&HOOK.satLook(q.shape,on);
  const base=!beacon&&baseOfMember(q);HOOK.news(beacon?`${q.name} is set up on ${b.name}`:base?`${q.name} sets down at ${base.name}`:`${q.name} stays on ${b.name}`,'ok')}
// the base a landed object belongs to (a beacon on the same body within BASE_R), and a base's members and state
function baseOfMember(q){const b=landedBody(q);return b?landedUp().find(x=>x.beacon&&x.bodyName===q.bodyName&&pfDist(b,x.pf,q.pf)<=BASE_R)||null:null}
function baseMembers(a){const b=landedBody(a);return b?landedUp().filter(x=>x.bodyName===a.bodyName&&pfDist(b,x.pf,a.pf)<=BASE_R):[]}
function baseOf(a){const M=baseMembers(a),E=M.flatMap(e=>[e,...(e.attached||[]).map(x=>x.e)]),P=E.flatMap(e=>(e.shape||[]).map(o=>({o,d:PARTS[o.k]}))).filter(x=>x.d);
  const berths=P.reduce((s,x)=>s+(x.d.berths||0),0),labs=P.filter(x=>x.d.lab).length,seats=P.reduce((s,x)=>s+(x.o.crew||0),0),sup=P.reduce((s,x)=>s+((x.o.res||{}).sup||0),0),crew=Math.min(seats,berths);
  return{members:M,bodies:E,berths,labs,seats,crew,sup,days:crew?sup/(crew*SUP_DAY):Infinity,work:sup>0?Math.min(crew,2*labs):0}}
// contact with landed objects on the body we're near
function landContact(s,dt){let A=null;for(const q of landedUp()){if(landedBody(q)!==s.body||!q.shape||!q.shape.length)continue;
    const B=landBody(q,simT),rel=sub(B.r,s.r),vrel=sub(B.v,s.v);if(!A)A=shipBody(s);if(len(rel)>A.R+B.R+len(vrel)*dt+0.5)continue;
    const n=Math.min(400,Math.max(1,Math.ceil(len(vrel)*dt/HIT_STEP)));let c=null;
    for(let k=0;k<=n&&!c;k++){const o=sub(rel,mul(vrel,dt*(n-k)/n));if(len(o)>A.R+B.R)continue;B.r=add(s.r,o);c=hitFind(A,B)}
    if(!c)continue;const vn=hitResolve(A,B,c);s.r=A.r;s.v=A.v;s.w=A.w;
    if(vn>0.3)HOOK.msg(`Contact with ${q.name} at ${vn.toFixed(1)} m/s`);
    if(vn>HIT_VAPOR){HOOK.boom(s.body,c.p,simT,3);s.alive=false;s.crashSpeed=vn;HOOK.msg(`Destroyed: hit ${q.name} at ${vn.toFixed(0)} m/s`);return}
    const shp=c.pa&&vn>hitTol(c.pa.d)?c.pa:null;if(shp){if(shp.att){HOOK.msg(`${shp.att.e.name} breaks loose`);undock(s,shp.att.e.id,0)}else{HOOK.msg(`${shp.d.name} broke on ${q.name}`);partLost(s,shp.p)}A=null}
    if(!s.alive)return}}
// ---- RCS (sats session). Thrusters are real forces at real points (addF), so translating with unbalanced quads also turns
// the vessel, as it should. Jet selection: for each of the 12 signed axes (± force x, y, z; ± torque x, y, z) a set of
// non-negative duties that produces that axis alone as nearly as the layout allows (non-negative least squares, solved
// once per layout and cached), scaled so its busiest nozzle is at 1. A command is a sum of those, clipped to [0, 1]. Each
// nozzle is on/off: a sigma-delta modulator (started half-way, so its error stays within ±½ pulse) turns its duty into whole DT pulses, so
// the minimum impulse bit is thrust × 20 ms.
const RCS_OFF=0.12;   // nozzles stand this far off the skin
// a quad's four nozzles: force directions up and down the axis and both ways round it, at the quad's outer face
function rcsNozzles(s){const out=[];for(const p of s.parts){if(!p.on||p.d.kind!=='rcs')continue;const n=[Math.cos(p.phi),0,Math.sin(p.phi)],t=[-n[2],0,n[0]],F=p.d.rcsF*1000,
    at=[p.pos[0]+n[0]*RCS_OFF,p.y0+p.h/2,p.pos[2]+n[2]*RCS_OFF];for(const d of[[0,1,0],[0,-1,0],t,mul(t,-1)])out.push({p,d,at,F,isp:p.d.isp})}return out}
// non-negative least squares, exactly (Lawson–Hanson active set), with a small ridge term: opposed nozzles at the same
// spot cancel perfectly, so without it the problem has no unique answer and a solver happily fires both
function nnls(A,b,mu){const m=A.length,n=A[0].length,M=[],q=[];
  for(let i=0;i<n;i++){M.push([]);let s=0;for(let k=0;k<m;k++)s+=A[k][i]*b[k];q.push(s);for(let j=0;j<n;j++){let c=i===j?mu:0;for(let k=0;k<m;k++)c+=A[k][i]*A[k][j];M[i].push(c)}}
  const solve=P=>{const k=P.length,G=P.map((i,r)=>[...P.map(j=>M[i][j]),q[i]]);   // Gaussian elimination, partial pivoting
    for(let c=0;c<k;c++){let pv=c;for(let r=c+1;r<k;r++)if(Math.abs(G[r][c])>Math.abs(G[pv][c]))pv=r;[G[c],G[pv]]=[G[pv],G[c]];
      for(let r=c+1;r<k;r++){const f=G[r][c]/G[c][c];for(let cc=c;cc<=k;cc++)G[r][cc]-=f*G[c][cc]}}
    const x=new Array(k).fill(0);for(let r=k-1;r>=0;r--){let s=G[r][k];for(let cc=r+1;cc<k;cc++)s-=G[r][cc]*x[cc];x[r]=s/G[r][r]}
    const out=new Array(n).fill(0);P.forEach((i,r)=>out[i]=x[r]);return out};
  let u=new Array(n).fill(0),P=[],tol=1e-10*Math.max(1,...q.map(Math.abs));
  for(let it=0;it<3*n+10;it++){const w=q.map((qi,i)=>qi-M[i].reduce((a,x,j)=>a+x*u[j],0));let t=-1,best=tol;
    for(let i=0;i<n;i++)if(!P.includes(i)&&w[i]>best){best=w[i];t=i}if(t<0)break;P.push(t);
    for(let g=0;g<3*n+10;g++){const s=solve(P);if(P.every(i=>s[i]>0)){u=s;break}
      let a=1;for(const i of P)if(s[i]<=0)a=Math.min(a,u[i]/(u[i]-s[i]));u=u.map((x,i)=>x+a*(s[i]-x));P=P.filter(i=>u[i]>1e-12);for(let i=0;i<n;i++)if(!P.includes(i))u[i]=0}}
  return u}
// the layout's jet tables, cached on the vessel by which quads are on and where the centre of mass is (to 5 cm)
function rcsJets(s){const N=rcsNozzles(s);if(!N.length)return null;const key=N.map(z=>z.p.i).join()+'|'+s.cm.map(x=>Math.round(x*20)).join();
  if(s.rcsJ&&s.rcsJ.key===key)return s.rcsJ;
  const Lr=Math.max(1,s.len/2),A=[[],[],[],[],[],[]];
  for(const z of N){const r=sub(z.at,s.cm),f=mul(z.d,z.F),tq=cross(r,f);A[0].push(f[0]);A[1].push(f[1]);A[2].push(f[2]);A[3].push(tq[0]/Lr);A[4].push(tq[1]/Lr);A[5].push(tq[2]/Lr)}
  const basis=[];for(let k=0;k<12;k++){const ax=k>>1,sg=k&1?-1:1,b=[0,0,0,0,0,0];b[ax]=sg;
    // aim for a unit along this axis (in newtons, or newton-metres / Lr); the solution's scale gives the capacity
    const sc=A[ax].reduce((a,x)=>a+Math.abs(x),0)||1,bb=b.map(x=>x*sc),u=nnls(A,bb,1e-3*sc*sc/N.length),got=A.map(row=>row.reduce((a,x,j)=>a+x*u[j],0)),
      off=Math.hypot(...got.map((g,i)=>i===ax?0:g)),on=got[ax]*sg,mx=Math.max(...u);
    basis.push(on>1e-6&&off<0.3*on&&mx>1e-12?{u:u.map(x=>x/mx),cap:on/mx}:null)}   // cap: newtons (or N·m / Lr) at full duty
  const old=s.rcsJ;s.rcsJ={key,N,Lr,basis,acc:old&&old.N.length===N.length?old.acc:new Array(N.length).fill(0.5)};return s.rcsJ}
// the torque (N·m) the RCS can give about the pitch/yaw axes: added to the control authority while it's on
function rcsTauCap(s){const J=s.rcs&&rcsJets(s);if(!J)return 0;let c=Infinity;for(const k of[6,7,10,11])c=Math.min(c,J.basis[k]?J.basis[k].cap*J.Lr:0);return isFinite(c)?c:0}
const rcsGas=s=>s.parts.reduce((a,p)=>a+(p.on&&p.res.gas>0?p.res.gas:0),0);   // tonnes
const rcsBusy=s=>{const I=inpOf(s);return!!(s.rcs&&rcsJets(s)&&(s.sas||I.tx||I.ty||I.tz||I.pitch||I.yaw||I.roll))};
// one step: translation from the keys, plus the torque (body frame, N·m) the wheels couldn't give. Returns nothing; the
// forces land on the quads via addF, and the gas comes out of the bottles.
function rcsStep(s,dt,tauB){const J=s.rcs&&rcsJets(s);s.rcsFire=0;s.rcsShots=[];if(!J)return;const n=J.N.length,duty=new Array(n).fill(0),
    cmd=(I=>[I.tx||0,I.ty||0,I.tz||0])(inpOf(s));
  const addAxis=(k,frac)=>{const B=J.basis[k];if(!B||frac<=0)return;for(let j=0;j<n;j++)duty[j]+=Math.min(1,frac)*B.u[j]};
  for(let a=0;a<3;a++)if(cmd[a])addAxis(2*a+(cmd[a]<0?1:0),Math.abs(cmd[a]));
  if(tauB)for(let a=0;a<3;a++){const v=tauB[a]/J.Lr,k=6+2*a+(v<0?1:0),B=J.basis[k];if(B)addAxis(k,Math.abs(v)/B.cap)}
  let gas=rcsGas(s),used=0;
  for(let j=0;j<n;j++){const z=J.N[j];J.acc[j]+=Math.min(1,duty[j]);if(J.acc[j]<1){if(duty[j]===0)J.acc[j]=0.5;continue}J.acc[j]-=1;
    const dm=z.F*dt/(z.isp*G0)/1000;if(gas-used<dm)continue;used+=dm;s.rcsFire++;s.rcsShots.push(j);
    addF(z.p,z.d[0]*z.F,z.d[1]*z.F,z.d[2]*z.F,z.at[0],z.at[1],z.at[2])}
  // gas out of the fullest bottles first
  for(const p of s.parts.filter(p=>p.on&&p.res.gas>0).sort((a,b)=>b.res.gas-a.res.gas)){if(used<=0)break;const x=Math.min(used,p.res.gas);p.res.gas-=x;used-=x}}
// paying out an imaging contract (the same terms a flight-completed contract gets)
function imageDone(c,sat,st,t){const i=PROG.active.indexOf(c);if(i<0)return;if(c.p.dis&&t!=null)(PROG.disDone=PROG.disDone||[]).push({posted:c.posted,t});PROG.active.splice(i,1);income(c.p.pay);PROG.cdone=(PROG.cdone||0)+1;
  standAdd(c.src,5);opAdd(c.client,3);if(c.client!==HOME)opAdd(HOME,1);sat.imgs++;
  HOOK.news(`${sat.name} delivers via ${st?st.name:'the pad'}: ${cTitle(c)} for ${POWERS[c.client].name} (+${fmtM(c.p.pay)})`,'ok')}
// between flights: satellites with cameras look for their targets (in reach of the camera, sharp enough, sunlit, clear),
// keep the pictures until they pass over a ground station, then downlink them. Working ones also sell imagery.
const DIS=[['Floods','Floods along the river at #: relief agencies ask for pictures from space'],['Wildfire','Wildfire near #: firefighters want to know which way it is heading'],
  ['Volcano','Volcano near # wakes up grumpy; vulcanologists request a look'],['Storm','A storm parks itself over #; insurers request photographs, urgently'],['Locusts','Locust swarm reported near #; farmers want maps']];
// disasters follow the land (terrain session): what can befall a city depends on the ground around it (sampled out to
// 120 km): floods on coasts and wetlands, wildfire in forest and savanna, volcanoes near volcanic ground, storms on warm
// coasts, locusts on grass, steppe and desert edges
const HAZ={Floods:g=>g.coast||g.has[14]||g.wet>0.7,Wildfire:g=>g.has[3]||g.has[5]||g.has[9],Volcano:g=>g.has[12],
  Storm:g=>g.coast&&g.T>18,Locusts:g=>g.has[4]||g.has[6]||g.has[9]||g.has[10]};let hazMemo=null;
function cityGround(c){const b0=biomeAt(c.u),g={has:{},coast:false,T:b0.T,wet:b0.wet};g.has[b0.id]=1;
  for(const km of[25,60,120])for(let a=0;a<8;a++){const id=biomeAt(alongAz(c.u,a*Math.PI/4,km*1e3/TELLUS.R)).id;g.has[id]=1;if(!id&&km<=60)g.coast=true}return g}
function disCities(dis){if(!hazMemo){hazMemo={};const gs=CITIES.map(cityGround);for(const k in HAZ)hazMemo[k]=gs.map((g,i)=>HAZ[k](g)?i:-1).filter(i=>i>=0)}return hazMemo[dis]||[]}
function satTick(d,R){stationTick(d);const sats=satsUp().filter(q=>q.cam);ensureBoard();
  // imagery sales scale with contact time: the share of the time a satellite has a ground station in view (sampled every
  // 2 min). A polar satellite at 300 km sees the pad ~10 % of the time and a five-station network ~50 %: that's what
  // stations are for on a planet this small (a single pass comes soon enough; a whole day's pictures don't fit in it).
  {const GS0=stationsAll(),T1=PROG.day*DAY_S;for(const q of sats){if(!q.ant)continue;let n=0,N=0;
    for(let t=Math.max(T1-d*DAY_S,q.epoch);t<T1;t+=120){const[r]=satAt(q,t),pf=rotY(r,-absTh(t));N++;if(GS0.some(st=>gsSees(st,pf)))n++}
    if(N){q.contact=n/N;income(d*IMG_RATE*q.contact*(1+0.3*(PROG.cycle||0))*(typeof satQual==='function'?satQual(q):1));if(N>=60&&q.contact>0)logNote(null,'contact',q.contact*100,q.name)}}}
  // disasters: the world asks for pictures (a short, well-paid offer, if anyone up there can take them)
  if(R()<1-Math.exp(-d/45)){const x=R(),DK=DIS.filter(q=>disCities(q[0]).length),[dis,head]=DK[R()*DK.length|0],cs=disCities(dis),ci=cs[x*cs.length|0],c=CITIES[ci],can=sats.some(q=>q.ant);
    HOOK.news(head.replace('#',c.name)+(can?'':' (if only someone had a camera up there)'),'warn');
    if(can&&PROG.offers.length<BOARD_MAX+2){PROG.cseq=(PROG.cseq||0)+1;const res=[3,5,8][R()*3|0];
      PROG.offers.push({id:PROG.cseq,type:'image',src:'gov',client:c.power?c.power.i:HOME,p:{ci,res,dis,pay:Math.round(25+60/res),dur:4+R()*3},posted:PROG.day,expires:PROG.day+2})}}
  stationsTick(d);const want=(PROG.active||[]).filter(c=>c.type==='image');if(!want.length)return;
  const T1=PROG.day*DAY_S,T0=T1-d*DAY_S,GS=stationsAll();
  for(const q of sats){let t=Math.max(T0,q.epoch);
    for(;t<=T1&&want.length;t+=SAT_STEP){const[r]=satAt(q,t),pf=rotY(r,-absTh(t)),rl=len(pf),alt=rl-TELLUS.R,un=mul(pf,1/rl);
      for(const c of want){if(q.pending.includes(c.id))continue;const u=CITIES[c.p.ci].u,dd=Math.acos(clamp(dot(un,u),-1,1))*TELLUS.R;
        if(Math.atan2(dd,alt)>SAT_FOV)continue;const slant=Math.hypot(dd,alt);
        if(slant*SAT_IFOV>c.p.res||sunUp(u,t)<SUN_MIN||cloudAt(u,t)>CLEAR)continue;q.pending.push(c.id)}
      if(q.ant&&q.pending.length)for(const st of GS){if(!gsSees(st,pf))continue;
        for(const id of q.pending){const c=want.find(x=>x.id===id);if(c){imageDone(c,q,st,t);want.splice(want.indexOf(c),1)}}q.pending=[];break}}}}
