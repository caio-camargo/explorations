// sim/vessel.js — parts, design trees, resources, the vessel, avionics, wheels, aero, structure, gimbal, heat. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- parts. Masses in tonnes, thrust in kN (vacuum), Isp in s. Engines: gim = gimbal range (°), gimR = its slew rate (°/s).
// Joint ratings (the weaker side of a joint governs): C compression, T tension, S shear (kN), B bending (kN·m).
// prof = outer shape as [radius, height] bottom→top; it is both the aero surface and (with colour) the mesh.
const R0=0.625;   // the 1.25 m class radius; every part carries its own radius d.r
const PARTS={
  cone:{name:'Nose cone',kind:'cone',m:0.12,h:1.6,cm:.35,C:600,T:400,B:150,prof:[[.625,0],[.6,.3],[.5,.75],[.3,1.25],[0,1.6]]},
  chute:{name:'Parachute',kind:'chute',m:0.1,h:0.42,C:300,T:400,B:150,prof:[[.3,0],[.3,.22],[.16,.38],[0,.42]]},
  pod:{name:'Command pod',kind:'pod',m:0.84,h:1.2,cm:.25,torque:10000,hmax:100000,C:900,T:600,B:200,prof:[[.625,0],[.625,.06],[.34,1.0],[.3,1.06],[.3,1.2]]},
  // crew (bodies session, epoch 4): a pod with two people and 10 days of life support; an escape tower (solid motor, 150 kN
  // for 3 s) that pulls it off a failing rocket. Until the tower is qualified (the max-q abort), the capsule flies dummies.
  // ins: the crew cabin lags the skin by an hour (insulated and cooled), where the animal capsule lags it by 10 min: on the
  // way up the bare capsule's skin reaches ~520 K, which would cook a 10-min cabin (387 K) but warms this one by ~20 K.
  crew:{name:'Crew capsule',kind:'pod',crew:2,ins:3600,m:1.4,h:1.2,cm:.25,torque:10000,hmax:100000,C:900,T:600,B:200,prof:[[.625,0],[.625,.06],[.34,1.0],[.3,1.06],[.3,1.2]]},
  les:{name:'Escape tower',kind:'les',m:0.6,h:2.1,cm:.6,thrust:150,burn:3,C:900,T:500,B:200,prof:[[.18,0],[.18,1.3],[.26,1.42],[.26,1.6],[.1,1.9],[0,2.1]]},
  t1:{name:'Tank 1 t',kind:'tank',wet:1,dry:0.11,h:1.1},
  t2:{name:'Tank 2 t',kind:'tank',wet:2,dry:0.22,h:2.0},
  t4:{name:'Tank 4 t',kind:'tank',wet:4,dry:0.45,h:3.8},
  t8:{name:'Tank 8 t',kind:'tank',wet:8,dry:0.9,h:7.4},
  // heat shield: wider than the stack so everything behind it rides in its shadow; ablator boils off to soak up heat
  shield:{name:'Heat shield',kind:'shield',m:0.1,h:0.2,cm:.4,r:.66,Tmax:1700,res0:{ablator:0.04},C:2500,T:1200,B:450,prof:[[.66,0],[.66,.1],[.625,.2]]},
  dec:{name:'Decoupler',kind:'dec',m:0.05,h:0.25,C:1200,T:500,B:220},
  // interstage: a decoupler whose shell encloses the engine above it — smooth aero, and the load path skips the engine
  istage:{name:'Interstage decoupler',kind:'dec',istage:true,m:0.08,h:0.25,C:2500,T:1200,B:450},
  adapt:{name:'Adapter 2.5 → 1.25 m',kind:'adapt',m:0.4,h:1.5,r:1.25,C:2500,T:1200,B:450,prof:[[1.25,0],[1.25,.15],[.625,1.35],[.625,1.5]]},
  // radial decoupler: rated as if it were the usual pair of attach points, so it carries a booster's thrust and moment
  rdec:{name:'Radial decoupler',kind:'rdec',m:0.08,h:0.4,C:800,T:500,S:500,B:500,noAero:true,radialOnly:true},
  fins:{name:'Fin ring',kind:'fins',m:0.25,h:0.9,C:2500,T:1200,B:450,span:0.9,chord:0.9},
  // radial fin: one plate, surface-attached (surf) to any part's side — no stack line of its own, nothing attaches to it.
  // Same plate as one of the ring's four, so four of these on a 1.25 m body fly like the ring. Its root carries the plate's
  // normal force as shear and bending at the joint.
  // RCS (sats session): a cold-gas quad on the skin (nozzles up and down the axis and both ways round it, 0.15 kN each,
  // Isp 70 s) and the bottle that feeds it (15 kg of nitrogen). off: how far the body stands out from the skin.
  rcs:{name:'RCS quad (cold gas)',kind:'rcs',surf:true,noAero:true,m:0.02,h:0.2,r:0.07,off:0.06,C:900,T:600,B:200,rcsF:0.15,isp:70},
  gas:{name:'Gas bottle',kind:'gas',surf:true,noAero:true,m:0.03,h:0.6,r:0.17,off:0.19,res0:{gas:0.015},C:900,T:600,B:200},
  // base beacon (sats session): what makes a landing site a base; everything landed within 500 m of it belongs to it
  beacon:{name:'Base beacon',kind:'beacon',m:0.05,h:0.6,r:0.3,C:900,T:600,B:200},
  // rover mounts (sats session, rovers R2): a rover folded flat on a lander's side, or a deck with ramps it drives down;
  // the rover packed on it (its node's rvd) adds its own mass
  rvfold:{name:'Rover, folded (side mount)',kind:'rover',surf:true,noAero:true,m:0.03,h:1.8,r:0.6,off:0.2,C:900,T:600,B:200},
  rvdeck:{name:'Rover deck with ramps',kind:'rover',m:0.15,h:1.9,r:1.6,prof:[[1.6,0],[1.6,.3],[1.2,1.9]],C:900,T:600,B:200},
  // robotic arm (sats session): a base on the side of anything; two 5 m booms (drawn per frame); a weak grip
  arm:{name:'Robotic arm',kind:'arm',surf:true,noAero:true,m:0.4,h:0.6,r:0.25,off:0.2,jF:3e3,jM:4e3,C:900,T:600,B:200},
  // radial docking port (sats session): mounts on the side of anything, its face depth out from the skin, facing outward
  rport:{name:'Radial docking port',kind:'port',radial:true,surf:true,noAero:true,m:0.12,h:1.0,r:0.5,depth:0.3,C:900,T:600,B:200,jF:30e3,jM:20e3},
  // station modules (sats session): a habitat (berths for three, 300 kg of supplies: 60 crew-days) and a laboratory
  hab:{name:'Habitat module',kind:'hab',m:2.0,h:3.2,berths:3,res0:{sup:0.3},C:2500,T:1200,B:450},
  lab:{name:'Laboratory module',kind:'lab',lab:1,m:2.4,h:3.2,C:2500,T:1200,B:450},
  // cargo bay (sats session): floor (h), walls bayL tall (inner radius bayIn), a clamshell roof roofH high; cm 8.4 × h ≈ 2.1 m up
  bay:{name:'Cargo bay',kind:'bay',m:0.6,h:0.25,r:0.8,cm:8.4,bayL:4,bayIn:0.7,roofH:0.6,C:2500,T:1200,B:450,prof:[[.8,0],[.8,4.25],[.62,4.6],[0,4.85]],profOpen:[[.8,0],[.8,4.25]]},
  // probe core (sats session): a command part without crew, so a separated module is a vessel you can fly
  // reaction wheel unit (control session): an inline drum of wheels, more torque and storage than a pod's own
  rwheel:{name:'Reaction wheel',kind:'rwheel',m:0.12,h:0.3,torque:15000,hmax:150000,C:900,T:600,B:200},
  // spin-up motors (control session): a ring of small solids firing round the axis, spinJ N·m·s in burn s, when the stage
  // they sit on lights (or, on a stage without engines, when it is released). A spun stage holds its axis like a top
  // (Explorer 1, Vanguard, the Delta and PAM kick stages): ~2 rev/s on a 1.25 m kick stage.
  spin:{name:'Spin-up motors',kind:'spin',m:0.03,h:0.2,spinJ:4000,burn:1,C:1200,T:500,B:220},
  core:{name:'Probe core',kind:'core',m:0.08,h:0.25,torque:2000,hmax:20000,C:900,T:600,B:200},
  // docking port (sats session): 1.25 m, its face on top; two capture when they meet slowly and nearly aligned
  port:{name:'Docking port',kind:'port',m:0.1,h:0.3,C:900,T:600,B:200,prof:[[.625,0],[.625,.14],[.5,.2],[.5,.3]],jF:30e3,jM:20e3},
  // the claw (sats session): its jaws grab whatever they touch slowly enough, wherever and however it is; a weaker hold
  claw:{name:'Claw',kind:'claw',m:0.15,h:0.55,C:900,T:600,B:200,prof:[[.35,0],[.35,.25],[.3,.32],[.18,.55]],jF:15e3,jM:8e3},
  // landing leg (vehicle session, Q31): on the side of anything, folded flat for launch; deployed (Y), its foot stands reach
  // out from the skin and drop below the leg's bottom, and becomes the vessel's contact point there (footPoints). Its root
  // carries the landing load, so a hard landing snaps a leg rather than needing a rule of its own.
  leg:{name:'Landing leg',kind:'leg',surf:true,noAero:true,m:0.05,h:1.0,r:0.08,off:0.08,reach:1.5,drop:1.0,C:900,T:600,S:240,B:80},
  // power (vehicle session, Q34a; sim/power.js): an onboard computer (needed for the guidance computer's SAS modes on a craft
  // without crew, from the onboard-computer era: era), a battery, solar cells on the skin (fixed; Wp in full sun, a share of it
  // on average) and a solar wing that unfolds (P), tracks the sun about its own arm, and tears off deployed above qMax Pa
  ocomp:{name:'Onboard computer',kind:'comp',m:0.03,h:0.2,W:50,era:2,C:900,T:600,B:200},
  batt:{name:'Battery 1 kWh',kind:'batt',m:0.02,h:0.15,kWh:1,C:900,T:600,B:200},
  bpanel:{name:'Solar cells (body)',kind:'solar',body:true,surf:true,noAero:true,m:0.01,h:0.8,r:0.02,off:0.02,Wp:40,C:300,T:200,S:150,B:60},
  wpanel:{name:'Solar wing',kind:'solar',wing:true,surf:true,noAero:true,m:0.03,h:0.6,r:0.06,off:0.06,Wp:300,span:2.4,qMax:1000,C:300,T:200,S:150,B:60},
  rfin:{name:'Radial fin',kind:'rfin',surf:true,noAero:true,m:0.06,h:0.9,r:0.05,C:300,T:200,S:150,B:60,span:0.9,chord:0.9},
  // steerable fins (control session): the same plates, all-moving, turned about their span up to ctl degrees at ctlR °/s
  cfin:{name:'Steerable fin',kind:'rfin',surf:true,noAero:true,m:0.09,h:0.9,r:0.05,C:300,T:200,S:150,B:60,span:0.9,chord:0.9,ctl:20,ctlR:40},
  cfins:{name:'Steerable fin ring',kind:'fins',m:0.37,h:0.9,C:2500,T:1200,B:450,span:0.9,chord:0.9,ctl:20,ctlR:40},
  wren:{name:'Wren lander',kind:'engine',m:0.15,h:0.55,cm:.7,thrust:18,gim:6,gimR:20,ispA:240,ispV:300,exit:0.25,C:500,T:300,B:150,prof:[[.25,0],[.1,.25],[.35,.35],[.625,.5],[.625,.55]]},
  // a small sea-level engine: sounding rockets and early hops (a Kestrel empties a 1 t tank in 12 s and leaves a tail-heavy, tumbling hull)
  sparrow:{name:'Sparrow sounding',kind:'engine',m:0.3,h:0.8,cm:.6,thrust:60,gim:3,gimR:15,ispA:250,ispV:280,exit:0.3,C:900,T:400,B:200,prof:[[.3,0],[.12,.45],[.3,.55],[.625,.72],[.625,.8]]},
  petrel:{name:'Petrel vacuum',kind:'engine',m:0.5,h:1.0,cm:.7,thrust:65,gim:3,gimR:10,ispA:90,ispV:345,exit:0.6,C:1200,T:500,B:250,prof:[[.6,0],[.15,.7],[.3,.8],[.625,.9],[.625,1]]},
  kestrel:{name:'Kestrel booster',kind:'engine',m:1.3,h:1.3,cm:.65,thrust:230,gim:5,gimR:10,ispA:285,ispV:315,exit:0.55,C:2000,T:800,B:300,prof:[[.55,0],[.22,.75],[.4,.9],[.625,1.15],[.625,1.3]]},
  // program payloads: instruments telemeter loads live and bring air samples home; a biocapsule carries a passenger with
  // limits of its own (g, cabin heat, air); a mass simulator is a boilerplate block for lift benchmarks
  sci:{name:'Instrument package',kind:'sci',m:0.08,h:0.45,C:900,T:600,B:200},
  bio:{name:'Biocapsule',kind:'bio',m:0.45,h:1.0,cm:.4,C:900,T:600,B:200,prof:[[.625,0],[.625,.08],[.42,.85],[.3,.88],[.3,1.0]]},
  ballast:{name:'Mass simulator 0.5 t',kind:'ballast',m:0.5,h:0.5,C:2500,T:1200,B:450},
  // satellite kit: a camera (≈10 µrad, so ~2 m from 200 km) and an antenna to send pictures down. Left in orbit, they keep working.
  cam:{name:'Imaging camera',kind:'cam',m:0.12,h:0.5,C:900,T:600,B:200},
  ant:{name:'Antenna',kind:'ant',m:0.04,h:0.3,C:900,T:600,B:200,prof:[[.625,0],[.625,.12],[.3,.3]]},
  condor:{name:'Condor heavy',kind:'engine',m:3.0,h:1.9,cm:.65,thrust:650,gim:4,gimR:8,ispA:280,ispV:305,exit:0.62,C:4000,T:1500,B:600,prof:[[.62,0],[.28,1.1],[.45,1.3],[.625,1.65],[.625,1.9]]},
};
for(const k in PARTS){const d=PARTS[k];d.key=k;if(d.kind==='tank'){d.m=d.wet;Object.assign(d,{C:2500,T:1200,B:450})}
  if(d.Tmax==null)d.Tmax={pod:1250,bio:1250,chute:1000,engine:1500,cone:1400,fins:1400}[d.kind]||1300;if(d.kind==='tank')d.res0={fuel:d.wet-d.dry};
  if(d.kind==='engine'){if(d.gim==null)d.gim=4;if(d.gimR==null)d.gimR=10}
  if(d.r==null)d.r=R0;if(!d.prof)d.prof=[[d.r,0],[d.r,d.h]];if(d.cm==null)d.cm=.5;if(d.S==null)d.S=d.C*0.5}
// 2.5 m class: the 1.25 m shapes scaled ×2. Tanks hold 8× (volume); compression/tension/shear ratings ×4 (wall area),
// bending ×8 (section modulus ∝ r²·wall, wall ∝ r) — which is why fat rockets shrug off loads that snap thin ones.
const big=(key,base,o)=>{const b=PARTS[base];PARTS[key]={...b,key,base,sc:2,h:b.h*2,r:b.r*2,prof:b.prof.map(([r,y])=>[r*2,y*2]),
  C:b.C*4,T:b.T*4,S:b.S*4,B:b.B*8,...o};const d=PARTS[key];if(d.kind==='tank')d.res0={fuel:d.wet-d.dry}};
big('T16','t2',{name:'Tank 16 t (2.5 m)',wet:16,dry:1.76,m:16});
big('T32','t4',{name:'Tank 32 t (2.5 m)',wet:32,dry:3.6,m:32});
big('dec25','dec',{name:'Decoupler 2.5 m',m:0.2});
big('fins25','fins',{name:'Fin ring 2.5 m',m:1.0,span:1.8,chord:1.8});
big('cfins25','cfins',{name:'Steerable fin ring 2.5 m',m:1.4,span:1.8,chord:1.8});
big('cone25','cone',{name:'Nose cone 2.5 m',m:0.45});
big('albatross','kestrel',{name:'Albatross (2.5 m)',m:6,thrust:1100,gim:4,gimR:8,ispA:285,ispV:310,exit:1.1});
// joint reinforcement: strength multiplier and added mass (t) at a 1.25 m joint, scaled by (joint radius / 0.625)²
const JR=[{name:'standard',k:1,m:0},{name:'reinforced',k:2,m:0.06},{name:'heavy',k:4,m:0.18}];
// A design is the core stack top→bottom; an entry is a part key, or {k, rad:{n, dec, stack}} for a part with a
// radial group beside it: n copies of a side stack (top→bottom), bottoms level with that part's bottom.
const PRESETS={
  Hopper:['chute','pod','t2','fins','kestrel'],
  Orbiter:['chute','pod','t2','petrel','dec','t8','fins','kestrel'],
  Heavy:['chute','pod','t2','petrel','dec','t8','fins',{k:'kestrel',rad:{n:2,dec:true,stack:['cone','t4','fins','kestrel']}}],
  // two crossfed booster pairs: the upper pair drains first and drops, then the lower pair, then the core — whose tanks are still full
  Asparagus:['chute','pod','t2','petrel','dec',{k:'t8',rad:{n:2,dec:true,x:true,stack:['cone','t4','kestrel']}},'fins',{k:'kestrel',rad:{n:2,dec:true,x:true,stack:['cone','t4','fins','kestrel']}}],
  // resized for the bigger planet (orbit ~4,300 m/s; a Selene landing and return ~3,900 more): a 2.5 m first stage
  Lunar:['chute','pod','t1','wren','dec','t4','t4','petrel','istage','adapt','T32','T16','fins25','albatross'],
  // with a heat shield under the pod: drop the lander stage before re-entry and come home shield-first from Selene
  Sounding:['chute','sci','t1','fins','sparrow'],
  Passenger:['chute','bio','dec','t4','fins','sparrow'],   // a 4 t tank since the rescale: space is 100 km up now
  'Big Lunar':['chute','pod','shield','dec','t1','wren','dec','t4','t4','petrel','istage','adapt','T32','T16',{k:'fins25',rad:{n:2,dec:true,stack:['cone','t8','fins','kestrel']}},'albatross'],
  // crew to Selene and back (bodies session): Big Lunar with a crew capsule (+0.56 t) under an escape tower, a 2 t return
  // tank, a 12 t lander, a stretched core and four boosters. Flown to orbit with a tuned turn (vertical to 200 m, flat by
  // 38 km) it arrives with ~2,800 m/s in the lander (transfer 1,321 + landing ~1,250) and ~1,830 to come home (~1,250).
  // uncrewed (bodies session): a probe with a camera, an antenna and instruments on a Lunar-class launcher, ~1,900 m/s
  // spare past orbit, a transfer, a capture and a landing (the far side, impactor, soft landing, and all four Nyx missions);
  // and Big Lunar with an instrument package in its capsule, to bring a sample back from Selene
  Probe:['ant','cam','sci','core','t4','t4','petrel','istage','adapt','T32','T16','fins25','albatross'],
  'Sample Return':['chute','pod','sci','shield','dec','t2','wren','dec','t4','t4','t2','petrel','istage','adapt','T32','T16',{k:'fins25',rad:{n:2,dec:true,stack:['cone','t8','fins','kestrel']}},'albatross'],
  'Crewed Lunar':['les','chute','crew','shield','dec','t2','wren','dec','t8','t4','petrel','istage','adapt','T32','T32',{k:'fins25',rad:{n:4,dec:true,stack:['cone','t8','fins','kestrel']}},'albatross'],
};
const entryKey=e=>typeof e==='string'?e:e.k;
// the vessel is its command pod, else the capsule or the instruments, else its top part: losing the root ends the flight
function rootIdx(stack){for(const k of['crew','pod','bio','sci']){const i=stack.findIndex(e=>entryKey(e)===k);if(i>=0)return i}return 0}
// ---- design format v2: a tree of part nodes, what the construction screen builds. node = {k, at, j, x, c:[nodes]}.
// `at` says how a node hangs on its parent: 'u' on the parent's top, 'd' under its bottom, or radial {y, a, n, cy, dec, x}:
// against the parent's side at height y above the parent's bottom and angle a (radians, in the parent's frame), n
// symmetric copies around the parent's axis, the child's own attach point cy above its bottom (default: mid-height);
// dec = through a radial decoupler, x = that decoupler crossfeeds. j = the reinforcement of the joint to the parent;
// x on a stack decoupler = crossfeed. Parts never tilt: a radial child starts a new vertical stack line beside its
// parent, so the physics (stack lines, joint frames) is the same one the old format had. The old format — core stack
// top→bottom with {k, rad:{n, dec, x, j, stack}} entries — converts losslessly (toV2), so presets stay in it.
const RGAP=0.25;   // clearance between side-by-side stack lines; a radial decoupler fills it
const isV2=st=>!!st&&!Array.isArray(st)&&st.v===2;
function toV2(stack){
  if(isV2(stack))return stack;
  const core=stack.map(e=>typeof e==='string'?{k:e}:e),n=core.length;if(!n)return{v:2,root:null};
  const r=rootIdx(stack),nodes=core.map(e=>{const o={k:e.k,c:[]};if(e.j)o.j=e.j;if(e.x)o.x=true;return o});
  for(let i=r-1;i>=0;i--){nodes[i].at='u';nodes[i+1].c.push(nodes[i])}
  for(let i=r+1;i<n;i++){nodes[i].at='d';nodes[i-1].c.push(nodes[i])}
  const y0=new Array(n);let y=0;for(let i=n-1;i>=0;i--){y0[i]=y;y+=PARTS[core[i].k].h}
  let g=0;
  core.forEach((e,i)=>{if(!e.rad||!e.rad.stack.length)return;g++;
    // side stack bottoms level with this part's bottom, hung at its mid-height on whichever core part is there
    const st=e.rad.stack,H=st.reduce((h,k)=>h+PARTS[k].h,0),yc=y0[i]+H/2;
    let hi=core.findIndex((c,q)=>yc>=y0[q]&&yc<=y0[q]+PARTS[c.k].h);if(hi<0)hi=i;
    const sy=[];let yy=y0[i];for(let j=st.length-1;j>=0;j--){sy[j]=yy;yy+=PARTS[st[j]].h}
    let s=st.findIndex((k,j)=>yc>=sy[j]&&yc<=sy[j]+PARTS[k].h);if(s<0)s=0;
    const side=st.map(k=>({k,c:[]}));
    for(let j=s-1;j>=0;j--){side[j].at='u';side[j+1].c.push(side[j])}
    for(let j=s+1;j<st.length;j++){side[j].at='d';side[j-1].c.push(side[j])}
    const at={y:yc-y0[hi],a:(g-1)*Math.PI/e.rad.n,n:e.rad.n,cy:yc-sy[s]};if(e.rad.dec)at.dec=true;if(e.rad.x)at.x=true;
    side[s].at=at;if(e.rad.j)side[s].j=e.rad.j;nodes[hi].c.push(side[s])});
  return{v:2,root:nodes[r]}}
// A stack line through an entry node: its members (reached over u/d links) with bottoms relative to the entry's bottom.
function lineOf(nd){const mem=[{nd,y:0,up:null}];
  const walk=m=>{for(const c of m.nd.c||[]){if(c.at!=='u'&&c.at!=='d')continue;
    const q={nd:c,y:c.at==='u'?m.y+PARTS[m.nd.k].h:m.y-PARTS[c.k].h,up:m};mem.push(q);walk(q)}};
  walk(mem[0]);return mem}
const radAt=at=>at&&typeof at==='object';
// a part's outer radius at height y above its bottom (its profile, interpolated): where a surface part sits
function profR(d,y){const pr=d.prof;if(y<=pr[0][1])return pr[0][0];
  for(let i=0;i<pr.length-1;i++){const[r0,y0]=pr[i],[r1,y1]=pr[i+1];if(y<=y1)return y1-y0<1e-9?Math.max(r0,r1):r0+(r1-r0)*(y-y0)/(y1-y0)}return pr[pr.length-1][0]}
// Every part instance of a v2 design (symmetric copies included) and the joints between them. y up, the root's bottom at
// 0 (assemble shifts the lowest part to 0). An instance: {nd, d, x, z, y0, rot, phi, line, rdec?}: rot is the frame
// angle its own radial children are measured in, phi the outward angle of the radial attachment that placed its line.
function layoutDesign(des){
  const inst=[],joints=[];des=toV2(des);if(!des||!des.root)return{inst,joints};
  let lineN=0;
  const place=(mem,x,z,yS,rot,phi,path)=>{const id=lineN++,byM=new Map();
    for(const m of [...mem].sort((a,b)=>a.y-b.y)){const d=PARTS[m.nd.k],q={nd:m.nd,d,x,z,y0:yS+m.y,rot,phi,line:id,path};inst.push(q);byM.set(m,q)}
    for(const m of mem)if(m.up){const c=byM.get(m),p=byM.get(m.up),u=m.nd.at==='u';
      joints.push({a:p,b:c,axis:[0,u?1:-1,0],P:[x,u?c.y0:c.y0+c.d.h,z],j:m.nd.j||0})}
    return{byM,lo:Math.min(...mem.map(m=>yS+m.y)),hi:Math.max(...mem.map(m=>yS+m.y+PARTS[m.nd.k].h))}};
  const rMax=(qs,lo,hi)=>{let r=0;for(const q of qs)if(q.y0<hi-1e-6&&q.y0+q.d.h>lo+1e-6)r=Math.max(r,q.d.r);return r};
  const queue=[];const m0=lineOf(des.root),L0=place(m0,0,0,0,0,null,'');queue.push({mem:m0,L:L0});
  while(queue.length){const{mem,L}=queue.shift(),lineQ=[...L.byM.values()];
    for(const m of [...mem].sort((a,b)=>b.y-a.y))for(const c of m.nd.c||[]){if(!radAt(c.at))continue;
      if(PARTS[c.k].surf){ // a surface part sits on the host's skin at that height; no line, no children
        const P=L.byM.get(m),at=c.at,d=PARTS[c.k],n=Math.max(1,at.n|0),rp=profR(P.d,clamp(at.y,0,P.d.h)),yc=P.y0+at.y;
        for(let k=0;k<n;k++){const ph=P.rot+at.a+2*Math.PI*k/n,nx=Math.cos(ph),nz=Math.sin(ph),
          q={nd:c,d,x:P.x+rp*nx,z:P.z+rp*nz,y0:yc-(at.cy??d.h/2),rot:ph,phi:ph,line:-1,surf:true,path:P.path+'/'+k};inst.push(q);
          joints.push({a:P,b:q,axis:[nx,0,nz],P:[q.x,yc,q.z],j:c.j||0})}
        continue}
      const P=L.byM.get(m),at=c.at,cm=lineOf(c),n=Math.max(1,at.n|0),cy=at.cy??PARTS[c.k].h/2,yb=P.y0+at.y-cy;
      const lo=yb+Math.min(...cm.map(q=>q.y)),hi=yb+Math.max(...cm.map(q=>q.y+PARTS[q.nd.k].h)),rs=Math.max(...cm.map(q=>PARTS[q.nd.k].r));
      const D=Math.max(rMax(lineQ,lo,hi),P.d.r)+RGAP+rs,rp=P.d.r,yc=P.y0+at.y;
      for(let k=0;k<n;k++){const ph=P.rot+at.a+2*Math.PI*k/n,nx=Math.cos(ph),nz=Math.sin(ph),N=[nx,0,nz],x=P.x+D*nx,z=P.z+D*nz,path=P.path+'/'+k;
        const CL=place(cm,x,z,yb,ph,ph,path),E=CL.byM.get(cm[0]);
        if(at.dec){const rd=PARTS.rdec,rr=(rp+D-rs)/2,q={nd:c,d:rd,x:P.x+rr*nx,z:P.z+rr*nz,y0:yc-rd.h/2,rot:ph,phi:ph,line:-1,rdec:true,xfeed:!!at.x,path};inst.push(q);
          joints.push({a:P,b:q,axis:N,P:[P.x+rp*nx,yc,P.z+rp*nz],j:c.j||0},{a:q,b:E,axis:N,P:[P.x+(D-rs)*nx,yc,P.z+(D-rs)*nz],j:c.j||0})}
        else joints.push({a:P,b:E,axis:N,P:[P.x+rp*nx,yc,P.z+rp*nz],j:c.j||0});
        queue.push({mem:cm,L:CL})}}}
  return{inst,joints}}
// Design → a tree of parts rooted at the vessel's root (pod, capsule, instruments, else the design's root), in vessel
// coordinates (y up from the lowest part's bottom). Each part knows its joint to its parent: the point jP and the axis jA
// (parent → child). Segments (stages) are cut by decouplers, a decoupler belonging to its far side; events say which
// segments drop and which ignite when.
function assemble(stack){
  const des=toV2(stack),L=layoutDesign(des),parts=[];
  let ymin=Infinity,ymax=-Infinity;for(const q of L.inst){ymin=Math.min(ymin,q.y0);ymax=Math.max(ymax,q.y0+q.d.h)}if(!L.inst.length)ymin=ymax=0;
  for(const q of L.inst){const p={i:parts.length,d:q.d,pos:[q.x,0,q.z],y0:q.y0-ymin,h:q.d.h,parent:null,children:[],on:true,
    res:{...(q.d.res0||{})},cap:{...(q.d.res0||{})},T:290,Q:0,load:0,F:[0,0,0],L:[0,0,0],jA:[0,1,0],jP:[0,0,0],dn:q.nd,inst:q};
    if(q.line===0)p.core=true;if(q.phi!=null)p.phi=q.phi;if(q.d.kind==='engine'&&q.nd.cant&&q.phi!=null)p.tdir=cantDir(q.nd.cant,q.phi);p.xfeed=q.rdec?q.xfeed:!!q.nd.x;q.p=p;parts.push(p)}
  // root: a pod, else a biocapsule, else instruments (on the root line first, then the highest), else the design's root
  let root=null;for(const k of['pod','core','bio','sci']){const c=parts.filter(p=>p.d.kind===k);if(c.length){root=c.sort((a,b)=>(b.core?1:0)-(a.core?1:0)||b.y0-a.y0)[0];break}}
  if(!root)root=parts.find(p=>p.dn===des.root&&p.core)||parts[0];
  const adj=new Map(parts.map(p=>[p,[]]));for(const J of L.joints){adj.get(J.a.p).push([J,1]);adj.get(J.b.p).push([J,-1])}
  if(root){const seen=new Set([root]),st=[root];
    while(st.length){const p=st.shift();for(const[J,s]of adj.get(p)){const c=s>0?J.b.p:J.a.p;if(seen.has(c))continue;seen.add(c);
      c.parent=p;p.children.push(c);c.jA=s>0?J.axis.slice():J.axis.map(v=>-v);c.jP=[J.P[0],J.P[1]-ymin,J.P[2]];c.jr=J.j||0;st.push(c)}}}
  // reinforcement mass sits on the child side of the joint, scaled by the joint's size
  for(const p of parts)if(p.parent&&p.jr){const rj=Math.min(p.d.r,p.parent.d.r);p.jm=JR[p.jr].m*(rj/R0)**2}
  for(const p of parts)if(p.d.kind==='rover'&&p.dn.rvd)p.xm=rvGeom(p.dn.rvd).m/1000;   // a packed rover's own mass
  // an interstage's shell reaches up around the part right above it on its line (an engine): that part is enclosed
  for(const p of parts)if(p.d.istage){const a=parts.find(q=>q!==p&&!q.inst.rdec&&!q.inst.surf&&q.inst.line===p.inst.line&&Math.abs(q.y0-(p.y0+p.h))<1e-6);
    if(a){p.shell=a.h;p.xm=0.1*a.h;a.encBy=p}}
  // a cargo bay encloses whatever sits on its floor within its walls and under its roof (shielded while its doors are shut)
  for(const b of parts)if(b.d.kind==='bay'){const fl=b.y0+b.h,top=fl+b.d.bayL;
    for(const q of parts)if(q!==b&&q.y0>=fl-1e-6&&q.y0+q.h<=top+1e-6&&Math.hypot(q.pos[0]-b.pos[0],q.pos[2]-b.pos[2])+(q.d.off||0)+q.d.r<=b.d.bayIn+1e-6)q.inBay=b}
  // radial groups: one per radial placement (all its symmetric copies)
  const groups=[],gOf=new Map();
  for(const q of L.inst){if(!radAt(q.nd.at)||q.rdec||q.line<0)continue;const nd=q.nd;if(gOf.has(nd))continue;
    const sub=x=>[x.k,...(x.c||[]).flatMap(sub)];
    const g={nd,dec:!!nd.at.dec,label:`${sub(nd).some(k=>PARTS[k].kind==='engine')?'boosters':'side tanks'} ×${nd.at.n}`,joins:[],parts:[]};gOf.set(nd,g);groups.push(g)}
  for(const p of parts)if(p.inst.rdec)gOf.get(p.dn).joins.push(p);
  if(groups.length>1)groups.forEach((g,i)=>{g.label=g.label.replace(' ×',' '+'ABCDEFGH'[i%8]+' ×')});
  // segments: the nearest decoupler at or above a part (towards the root) names its segment
  const segKey=p=>{for(let q=p;q;q=q.parent)if(q.d.kind==='dec'||q.d.kind==='rdec')return q;return null};
  const keys=[],segs=[],idx=k=>{let i=keys.indexOf(k);if(i<0){i=keys.length;keys.push(k);segs.push({ignited:false,flamed:false,label:''})}return i};
  for(const p of parts)if(p.core)idx(segKey(p));for(const p of parts)p.seg=idx(segKey(p));
  for(const g of groups){g.segs=g.dec?[...new Set(g.joins.map(rd=>rd.seg))]:[];g.parts=parts.filter(p=>g.segs.includes(p.seg));for(const k of g.segs)segs[k].label=g.label}
  // the segment tree: a segment's parent holds its decoupler. The chain runs from the root's segment down through stack
  // decouplers below it (the one nearest the axis, if several); everything else hangs off a chain segment, burns with it
  // and drops before it does — deepest first, then the highest first (so asparagus pairs go top-down).
  const sPar=keys.map(k=>k&&k.parent?k.parent.seg:-1),depth=k=>{let n=0;for(let s=k;sPar[s]>=0;s=sPar[s])n++;return n};
  const below=k=>keys[k]&&keys[k].d.kind==='dec'&&keys[k].jA[1]<-0.5;
  const chain=[root?root.seg:0];
  for(;;){const cur=chain[chain.length-1],ax=keys[cur]||root,cs=keys.map((k,i)=>i).filter(i=>sPar[i]===cur&&below(i));if(!cs.length)break;
    const dd=i=>Math.hypot(keys[i].pos[0]-ax.pos[0],keys[i].pos[2]-ax.pos[2]);cs.sort((a,b)=>dd(a)-dd(b));chain.push(cs[0])}
  chain.slice().reverse().forEach((k,j,a)=>{if(!segs[k].label)segs[k].label=j===a.length-1?'upper':`core ${j+1}`});
  const owner=k=>{for(let s=k;s>=0;s=sPar[s])if(chain.includes(s))return s;return chain[0]};
  const hasEng=k=>parts.some(p=>p.seg===k&&p.d.kind==='engine'),events=[];
  const att=X=>keys.map((k,i)=>i).filter(i=>!chain.includes(i)&&owner(i)===X);
  const burn=X=>[X,...att(X)].filter(hasEng);
  const ig0=burn(chain[chain.length-1]);if(ig0.length)events.push({decouple:[],ignite:ig0});
  for(let j=chain.length-1;j>=0;j--){const X=chain[j],by=new Map();
    for(const i of att(X)){const id=keys[i].dn;if(!by.has(id))by.set(id,{segs:[],d:0,y:-Infinity,rad:false,o:by.size});const G=by.get(id);
      G.segs.push(i);G.d=Math.max(G.d,depth(i));G.y=Math.max(G.y,keys[i].y0);G.rad=G.rad||keys[i].d.kind==='rdec'}
    for(const G of [...by.values()].sort((a,b)=>b.d-a.d||b.y-a.y||a.o-b.o))events.push(G.rad?{decouple:G.segs,ignite:[],radial:true}:{decouple:G.segs,ignite:[]});
    for(const k of att(X))if(!segs[k].label)segs[k].label='jettison';
    if(j>0)events.push({decouple:[X],ignite:burn(chain[j-1])})}
  if(parts.some(p=>p.d.kind==='chute'))events.push({decouple:[],ignite:[],chute:true});
  const st=stageAtoms(events,keys,sPar,segs,parts,des.stg);
  return{parts,segs,events:st.events,root,height:ymax-ymin,groups,layout:L,shift:-ymin,stages:st.stages,custom:st.custom}}
// Staging. The automatic events split into atoms: one per decoupling placement (all its symmetric copies), one per ignited
// segment group, and the chute. An atom is named by its decoupler's design-node id ('d:7', 'i:7', 'i:root', 'c'), so a
// design can carry its own order: stg = [[atom ids fired together], …] in firing order. Atoms it doesn't mention yet (parts
// added since) keep their automatic place relative to the rest. In a custom order a drop takes everything hanging from the
// segment with it — the core can go before its boosters, and the boosters must not stay behind as orphans.
function stageAtoms(auto,keys,sPar,segs,parts,stg){
  // a design that was never edited has no node ids yet: name its atoms by segment so they stay distinct (display only —
  // a custom order needs real ids, and the builder assigns them on the first edit)
  const tmp=new Map(),nid=k=>{if(!keys[k])return'root';const n=keys[k].dn;if(n.id!=null)return n.id;if(!tmp.has(n))tmp.set(n,'#'+tmp.size);return tmp.get(n)};
  const atoms=[],byId=new Map();
  const add=(id,i,f)=>{let a=byId.get(id);if(!a){a={id,i,d:[],g:[],c:false,radial:false};byId.set(id,a);atoms.push(a)}f(a)};
  auto.forEach((e,i)=>{if(e.decouple.length)add('d:'+nid(e.decouple[0]),i,a=>{a.d.push(...e.decouple);a.radial=!!e.radial});
    for(const k of e.ignite)add('i:'+nid(k),i,a=>a.g.push(k));if(e.chute)add('c',i,a=>{a.c=true})});
  const eng=ks=>{const nm={};for(const p of parts)if(ks.includes(p.seg)&&p.d.kind==='engine'){const n=p.d.name.split(' ')[0];nm[n]=(nm[n]||0)+1}
    return Object.entries(nm).map(([n,c])=>c>1?`${n}×${c}`:n).join(' + ')};
  for(const a of atoms){a.label=a.c?'chute':a.d.length?'drop '+segs[a.d[0]].label.split(' (')[0]:'ignite '+(eng(a.g)||'—');a.kind=a.c?'c':a.d.length?'d':'i'}
  const ok=Array.isArray(stg)&&atoms.every(a=>!a.id.includes('#'));
  let out;
  if(!ok)out=auto.map((e,i)=>atoms.filter(a=>a.i===i));
  else{const used=new Set();out=[];
    for(const s of stg){const g=(s||[]).map(id=>byId.get(id)).filter(a=>a&&!used.has(a.id));g.forEach(a=>used.add(a.id));if(g.length)out.push(g)}
    const miss=atoms.filter(a=>!used.has(a.id)),ev=[...new Set(miss.map(a=>a.i))].sort((x,y)=>x-y);
    for(const i of ev){const g=miss.filter(a=>a.i===i),at=out.findIndex(s=>s.some(a=>a.i>i));at<0?out.push(g):out.splice(at,0,g)}}
  const desc=k=>{const r=[k];for(let s=0;s<sPar.length;s++){let q=s;while(q>=0&&q!==k)q=sPar[q];if(q===k&&s!==k)r.push(s)}return r};
  const gone=new Set();   // segments already dropped by an earlier stage aren't dropped again
  const events=!ok?auto:out.map(g=>{const dd=[...new Set(g.flatMap(a=>a.d.flatMap(desc)))].filter(k=>!gone.has(k));dd.forEach(k=>gone.add(k));
    const e={decouple:dd,ignite:g.flatMap(a=>a.g)};
    // "Booster separation" only when every drop in the stage is radial; core + boosters together is a stage separation
    const drops=g.filter(a=>a.d.length);if(drops.length&&drops.every(a=>a.radial))e.radial=true;if(g.some(a=>a.c))e.chute=true;return e});
  return{events,custom:ok,stages:out.map(g=>g.map(a=>({id:a.id,label:a.label,kind:a.kind,segs:a.kind==='d'?a.d:a.g})))}}
function engineMdot(d){return d.thrust/(d.ispV*G0)}   // t/s at full throttle
// ---- resources: each part holds res {name: amount} up to cap; mass = dry + Σ amount × density. Only propellant exists
// today (tonnes, so density 1); power or life support would be new entries here plus producers/consumers with rates.
const RES={fuel:{density:1,unit:'t'},ablator:{density:1,unit:'t'},gas:{density:1,unit:'t'},sup:{density:1,unit:'t'}};
function dryMass(p){return(p.d.kind==='tank'?p.d.dry:p.d.m)+(p.jm||0)+(p.xm||0)}
function partMass(p){let m=dryMass(p);for(const k in p.res)m+=p.res[k]*RES[k].density;return m}
// Fuel flow follows the part tree: it crosses every joint except a decoupler's own (decoupler ↔ the part it holds on to),
// unless that decoupler is set to crossfeed. Engines draw on every tank in their flow group, the tanks whose segment will
// be dropped soonest first (proportionally within that tier) — so crossfed boosters run dry before the core is touched.
function flowGroups(s,on){const g=new Array(s.parts.length).fill(-1),cut=p=>(p.d.kind==='dec'||p.d.kind==='rdec')&&!p.xfeed;let n=0;
  for(const p0 of s.parts){if(!on[p0.i]||g[p0.i]>=0)continue;g[p0.i]=n;const st=[p0];
    while(st.length){const p=st.pop(),nb=p.children.filter(c=>!cut(c));if(p.parent&&!cut(p))nb.push(p.parent);
      for(const q of nb)if(on[q.i]&&g[q.i]<0){g[q.i]=n;st.push(q)}}n++}
  return g}
function dropRank(s,ev0){const NEVER=1e9,r=s.segs.map(()=>NEVER);for(let e=ev0;e<s.events.length;e++)for(const k of s.events[e].decouple)if(r[k]===NEVER)r[k]=e;return r}   // segments never dropped drain last (finite, so they still drain)
function drawFuel(s,on,fuel,grp,rank,gid,amt){let got=0;
  for(let guard=0;guard<50&&amt-got>1e-12;guard++){let r=Infinity,tot=0;
    for(const p of s.parts){const i=p.i;if(on[i]&&grp[i]===gid&&fuel[i]>1e-12&&rank[p.seg]<r)r=rank[p.seg]}
    if(r===Infinity)break;for(const p of s.parts){const i=p.i;if(on[i]&&grp[i]===gid&&fuel[i]>1e-12&&rank[p.seg]===r)tot+=fuel[i]}
    const take=Math.min(tot,amt-got),k=Math.max(0,1-take/tot);
    for(const p of s.parts){const i=p.i;if(on[i]&&grp[i]===gid&&fuel[i]>1e-12&&rank[p.seg]===r)fuel[i]=k<1e-12?0:fuel[i]*k}got+=take}
  return got}
const fuelArr=s=>s.parts.map(p=>p.res.fuel||0),onArr=s=>s.parts.map(p=>p.on);
function groupFuel(s,gid){let f=0;for(const p of s.parts)if(p.on&&s.grp[p.i]===gid)f+=p.res.fuel||0;return f}
function segFuel(s,k){let f=0;for(const p of s.parts)if(p.on&&p.seg===k)f+=p.res.fuel||0;return f}
function partC(p){return[p.pos[0],p.y0+p.h*p.d.cm,p.pos[2]]}
function thrustPt(p){return[p.pos[0],p.y0+p.h*.8,p.pos[2]]}   // engines push on their mount
// Canted engines (v1.22): an engine on a radial line may tilt its nozzle outward by cant degrees, in its own radial plane, so
// its thrust leans in toward the axis: d = cosθ·ŷ − sinθ·n̂ (n̂ outward at the line's angle φ). Uncanted engines have no tdir
// and every thrust path below reduces to exactly the old axial code.
const Y_AX=[0,1,0],tdirOf=p=>p.tdir||Y_AX;
function cantDir(deg,phi){const t=deg*Math.PI/180;return[-Math.sin(t)*Math.cos(phi),Math.cos(t),-Math.sin(t)*Math.sin(phi)]}

// Δv plan: play the event list forward, burning every ignited segment together (boosters and core in parallel)
// and staging each time the segments the next event drops have run dry. pr = pressure ratio (0 vac, 1 sea level).
function dvPlan(s,pr){
  const on=onArr(s),fuel=fuelArr(s),ign=s.segs.map(g=>g.ignited),out=[];let ev=s.evIdx,grp=flowGroups(s,on),rank=dropRank(s,ev);
  const other=p=>{let m=0;for(const k in p.res)if(k!=='fuel')m+=p.res[k]*RES[k].density;return m};   // ablator etc. ride along
  const mass=()=>s.parts.reduce((m,p,i)=>on[i]?m+dryMass(p)+fuel[i]+other(p):m,0);
  const gF=g=>{let f=0;for(let i=0;i<fuel.length;i++)if(on[i]&&grp[i]===g)f+=fuel[i];return f};
  const engs=()=>s.parts.filter((p,i)=>on[i]&&p.d.kind==='engine'&&ign[p.seg]&&gF(grp[i])>1e-9);
  const fire=()=>{const e=s.events[ev++];for(const k of e.decouple)s.parts.forEach((p,i)=>{if(p.seg===k)on[i]=false});for(const k of e.ignite)ign[k]=true;grp=flowGroups(s,on);rank=dropRank(s,ev)};
  // a segment is ready to drop once its own tanks are empty (with crossfeed its engines would run on, on others' fuel)
  const segDry=k=>{const T=s.parts.filter((p,i)=>on[i]&&p.seg===k&&p.cap.fuel);return T.length?T.every(p=>fuel[p.i]<=1e-9):!s.parts.some((p,i)=>on[i]&&p.seg===k&&p.d.kind==='engine'&&ign[k]&&gF(grp[i])>1e-9)};
  if(s.evIdx===0&&!engs().length&&s.events[ev]&&s.events[ev].ignite.length&&!s.events[ev].decouple.length)fire();
  let st={dv:0,burn:0,m0:mass(),twr:0},guard=0,first=true;
  const tw=()=>{const T=[0,0,0];for(const p of engs()){const d=tdirOf(p),f=engineMdot(p.d)*p.d.ispA*G0;T[0]+=f*d[0];T[1]+=f*d[1];T[2]+=f*d[2]}return len(T)/(mass()*G0)};st.twr=tw();
  while(guard++<400){
    const E=engs(),next=s.events[ev],dry=next&&next.decouple.length&&next.decouple.every(segDry);
    if(!E.length||dry){if(!next||next.chute)break;
      if(st.dv>0.5||first){st.m1=mass();out.push(st)}first=false;fire();st={dv:0,burn:0,m0:mass(),twr:0};st.twr=tw();continue}
    // each flow group burns its lowest-rank tier of tanks; the step ends when the first tier empties (proportional draining
    // empties a whole tier at once), so the plan is exact piecewise — no time step
    const md={},Tv=[0,0,0];let M=0;for(const p of E){const g=grp[p.i],m=engineMdot(p.d),d=tdirOf(p),f=m*(p.d.ispV+(p.d.ispA-p.d.ispV)*pr)*G0;md[g]=(md[g]||0)+m;M+=m;Tv[0]+=f*d[0];Tv[1]+=f*d[1];Tv[2]+=f*d[2]}
    const T=len(Tv);
    let dt=Infinity;for(const g in md){let r=Infinity,tf=0;for(const p of s.parts){const i=p.i;if(on[i]&&grp[i]==g&&fuel[i]>1e-9&&rank[p.seg]<r)r=rank[p.seg]}
      for(const p of s.parts){const i=p.i;if(on[i]&&grp[i]==g&&fuel[i]>1e-9&&rank[p.seg]===r)tf+=fuel[i]}dt=Math.min(dt,tf/md[g])}
    const m0=mass();for(const g in md)drawFuel(s,on,fuel,grp,rank,+g,md[g]*dt);
    st.dv+=T/M*Math.log(m0/mass());st.burn+=dt}
  if(st.dv>0.5||first){st.m1=mass();out.push(st)}
  return out}
function stageStats(stack){const s=newShip(stack),v=dvPlan(s,0).filter(x=>x.dv>0.5),a=dvPlan(s,1).filter(x=>x.dv>0.5);
  return{stages:v.map((x,i)=>({dvV:x.dv,dvA:a[i]?a[i].dv:0,twr:x.twr,burn:x.burn,m0:x.m0,mf:x.m1})),mass:s.mass/1000}}

// ---- the vessel: one rigid body. State is (body, r, v) relative to the body it orbits (patched conics).
let S=null,simT=0;
const debris=[];
function newShip(stack,site=curSite()){
  const A=assemble(stack);
  const s={stack:JSON.parse(JSON.stringify(stack)),parts:A.parts,segs:A.segs,events:A.events,root:A.root,groups:A.groups,evIdx:0,body:TELLUS,alive:true,landed:true,
    av:avNow(),throttle:0,sas:true,sasMode:'stab',hold:null,w:[0,0,0],chute:false,chuteA:0,thrust:0,qdyn:0,mach:0,aoa:0,gload:0,maxLoad:0,r:[0,0,0],v:[0,0,0],q:[0,0,0,1],att:[]};
  geom(s);rebuildShape(s);s.rec=recNew();
  s.site=site;const f=siteFrame(site.u);                  // on the levelled pad of the chosen launch site
  s.pf=mul(site.u,TELLUS.R+site.h-s.yBot);
  s.qLocal=qFromBasis(f.e,f.up,f.s);                     // nose up, belly (+X) east, +Z south
  syncLanded(s);
  return s}
function geom(s){let m=0,c=[0,0,0],yb=Infinity,yt=-Infinity;s.torque=0;s.hmax=0;
  for(const p of s.parts){if(!p.on)continue;const pm=partMass(p);m+=pm;c=madd(c,partC(p),pm);yb=Math.min(yb,p.y0);yt=Math.max(yt,p.y0+p.h);if(p.d.torque){s.torque+=p.d.torque;s.hmax+=p.d.hmax??p.d.torque*WHEEL_S}}
  if(s.wH&&len(s.wH)>s.hmax)s.wH=s.hmax>0?mul(s.wH,s.hmax/len(s.wH)):[0,0,0];   // wheels lost with their parts
  s.mOwn=m*1000;s.cmOwn=mul(c,1/m);
  for(const a of s.att||[]){const pm=a.e.mass/1000;m+=pm;c=madd(c,a.p,pm)}   // docked bodies: their own mass at their own centre of mass
  c=mul(c,1/m);let Ix=0,Iy=0,Iz=0;
  for(const a of s.att||[]){const pm=a.e.mass,d=sub(a.p,c),Ir=rotI(a.q,satOwnMP(a.e).I);Ix+=pm*(d[1]*d[1]+d[2]*d[2])+Ir[0];Iy+=pm*(d[0]*d[0]+d[2]*d[2])+Ir[1];Iz+=pm*(d[0]*d[0]+d[1]*d[1])+Ir[2]}
  for(const p of s.parts){if(!p.on)continue;const pm=partMass(p)*1000,d=sub(partC(p),c),pr=p.d.r,ip=pm*(p.h*p.h/12+pr*pr/4),ir=pm*pr*pr/2;
    Ix+=pm*(d[1]*d[1]+d[2]*d[2])+ip;Iy+=pm*(d[0]*d[0]+d[2]*d[2])+ir;Iz+=pm*(d[0]*d[0]+d[1]*d[1])+ip}
  s.mass=m*1000;s.cm=c;s.com=c[1];s.yBot=yb-c[1];s.yTop=yt-c[1];s.len=yt-yb;s.I=[Ix,Iy,Iz]}
// Shape-derived data, rebuilt whenever parts come off: one merged outer profile per stack line (core and each side
// stack, so joints between equal radii are not surfaces), fins, the parachute, and a children-first joint order.
function rebuildShape(s){
  const ps=s.parts.filter(p=>p.on),lines=new Map();
  for(const p of ps){if(p.d.noAero||shielded(p))continue;const k=p.pos[0].toFixed(3)+','+p.pos[2].toFixed(3);if(!lines.has(k))lines.set(k,[]);lines.get(k).push(p)}
  s.lines=[];
  for(const lp of lines.values()){lp.sort((a,b)=>a.y0-b.y0);const pts=[];for(const p of lp)for(const[r,y]of profOf(p))pts.push([r,p.y0+y,p]);
    // an interstage shell fills out everything it encloses to its own radius, and owns that surface
    for(const q of lp)if(q.shell){const y0=q.y0+q.h-1e-6,y1=y0+q.shell+2e-6;for(const pt of pts)if(pt[1]>=y0&&pt[1]<=y1&&pt[0]<q.d.r){pt[0]=q.d.r;pt[2]=q}}
    const all=[[0,pts[0][1],pts[0][2]],...pts,[0,pts[pts.length-1][1],pts[pts.length-1][2]]],E=[];
    for(let i=0;i<all.length-1;i++){const[r0,y0,p0]=all[i],[r1,y1,p1]=all[i+1],dr=r1-r0,dy=y1-y0,L=Math.hypot(dr,dy);if(L<1e-6)continue;
      E.push({p:p0===p1?p0:(r0>=r1?p0:p1),r0,y0,r1,y1,L,nr:dy/L,ny:-dr/L,rm:(r0+r1)/2,ym:(y0+y1)/2,slope:Math.abs(dr)/(Math.abs(dy)+1e-9),exp:1,bexp:0})}
    // a surface recessed below the radius on both sides (an engine bell inside an interstage gap) is a cavity:
    // the flow bridges it, so it gets no slender-body lift and only a fraction of the impact pressure
    for(let i=0;i<E.length;i++){let a=0,b=0;for(let j=0;j<i;j++)a=Math.max(a,E[j].r0,E[j].r1);for(let j=i+1;j<E.length;j++)b=Math.max(b,E[j].r0,E[j].r1);
      E[i].cav=Math.max(E[i].r0,E[i].r1)<Math.min(a,b)-1e-3}
    const rad=Math.max(...E.map(e=>Math.max(e.r0,e.r1))),len_=lp[lp.length-1].y0+lp[lp.length-1].h-lp[0].y0;
    s.lines.push({E,ox:lp[0].pos[0],oz:lp[0].pos[2],yLo:lp[0].y0,yHi:lp[lp.length-1].y0+lp[lp.length-1].h,radius:rad,slender:clamp((len_/(2*rad)-1.5)/1.5,0,1),core:lp[0].pos[0]===0&&lp[0].pos[2]===0})}
  const cl=s.lines.find(l=>l.core)||s.lines[0];s.radius=cl?cl.radius:R0;
  s.grp=flowGroups(s,onArr(s));
  for(const p of ps){p.area=0}for(const ln of s.lines)for(const e of ln.E)e.p.area+=6.2832*e.rm*e.L;
  for(const p of ps){if(p.d.kind==='fins')p.area+=8*p.d.span*p.d.chord;else if(p.d.kind==='rfin')p.area+=2*p.d.span*p.d.chord;if(!p.area)p.area=2}
  s.fins=ps.filter(p=>p.d.kind==='fins'||p.d.kind==='rfin');s.chutePart=ps.find(p=>p.d.kind==='chute')||null;
  const order=[],dist=p=>{let k=0;for(let q=p;q.parent;q=q.parent)k++;return k};
  for(const p of ps)if(p!==s.root&&p.parent&&p.parent.on)order.push(p);
  order.sort((a,b)=>dist(b)-dist(a));s.order=order}
function activeEngines(s){return s.parts.filter(p=>p.on&&p.d.kind==='engine'&&s.segs[p.seg].ignited&&groupFuel(s,s.grp[p.i])>1e-9)}
function syncLanded(s){s.r=fromPF(s.body,s.pf,simT);s.q=qmul(qBody(s.body,simT),s.qLocal);s.v=surfVel(s.body,s.r);s.w=[0,0,0]}
function localFrame(r){const up=norm(r);let n=sub([0,1,0],mul(up,up[1]));if(len(n)<1e-9)n=[1,0,0];n=norm(n);return{up,n,e:cross(n,up)}}
// speeds against the surface low in the air, or near an airless body's ground (it turns: Selene's equator moves at 6 m/s)
function speedRef(s){const b=s.body,h=len(s.r)-b.R;return(b.atm?h<b.atm*0.5:h<0.03*b.R)?{srf:true,v:sub(s.v,surfVel(b,s.r))}:{srf:false,v:s.v}}
const TGT_M=['tgt','antitgt','rpro','rretro','dock'];
// ---- avionics generations (control session). SAS grows with the computing eras (COMP_ERAS): a gyro autopilot that only
// holds an attitude, then an analog autopilot that can also follow the velocity vector (mainframes), then a guidance
// computer with every mode and the full-speed loop (onboard computers). k: rate-loop gain (1/s), w: fastest commanded turn
// (rad/s), db: attitude deadband (rad). A vessel keeps the avionics it launched with (s.av); with no program running
// (sandbox, physics tests), with the tester's all-tools cheat, and on ground-guided procedures it has the best.
const AV=[{name:'Gyro autopilot',modes:['stab'],k:2,w:0.3,db:0.0087,era:0},
  {name:'Analog autopilot',modes:['stab','pro','retro','normal','anti','radout','radin'],k:3,w:0.45,db:0.0035,era:1},
  {name:'Guidance computer',modes:null,k:4,w:0.6,db:0,era:2}];
const avNow=()=>khOn()&&!TEST.tools?Math.min(AV.length-1,compEra()):AV.length-1;   // the tester's "all tools" includes the best avionics
const avOf=s=>AV[s.proc?AV.length-1:Math.min(s.av??AV.length-1,avCap(s))];   // avCap (sim/power.js): no computer on board, no guidance computer
const sasModeOK=(s,m)=>{const M=avOf(s).modes;return!M||M.includes(m)};
const avNext=m=>AV.find(a=>!a.modes||a.modes.includes(m));   // the first generation that has mode m
function sasTarget(s){
  if(s.sasMode==='stab'||!sasModeOK(s,s.sasMode))return s.hold;
  if(s.sasMode==='node'){const I=nodeInfo(s);return I&&len(I.rem)>1e-3?norm(I.rem):s.hold}
  if(TGT_M.includes(s.sasMode)){const T=tgtOf(s);if(!T)return s.hold;   // toward / away from the target; along / against our velocity relative to it
    if(s.sasMode==='dock'){const P=dockPair(s,T.q,tgtBody(s,T));return P&&P.a.body===0?{q:qnorm(qmul(qFromTo(P.Aa,mul(P.Ab,-1)),s.q))}:s.hold}   // an attitude: our port's axis onto the target port's (roll too, for a side port)
    if(s.sasMode==='tgt'||s.sasMode==='antitgt'){const u=norm(T.dr);return s.sasMode==='tgt'?u:mul(u,-1)}
    if(len(T.dv)<0.05)return s.hold;const u=norm(T.dv);return s.sasMode==='rpro'?u:mul(u,-1)}
  const vr=speedRef(s).v;if(len(vr)<0.5)return s.hold;
  const pro=norm(vr),h=cross(s.r,s.v);if(len(h)<1e-6)return s.sasMode==='pro'?pro:s.sasMode==='retro'?mul(pro,-1):s.hold;
  const nrm=norm(h),rad=norm(cross(s.v,nrm));
  return{pro,retro:mul(pro,-1),normal:nrm,anti:mul(nrm,-1),radout:rad,radin:mul(rad,-1)}[s.sasMode]}
let SAS_LAG=1,SAS_TI=1;   // see ctrlAccel
// control authority (N·m) about pitch/yaw: the wheels plus every burning engine's full gimbal at its lever to the CoM
function ctrlAuthority(s,engs,thr){let tau=s.torque;for(const p of engs)tau+=p.d.thrust*1000*thr*Math.sin(p.d.gim*Math.PI/180)*len(sub(thrustPt(p),s.cm));return tau}
// ... and about roll: a gimbal only rolls the vessel from off its axis (side boosters, clusters), so one central engine adds nothing
function ctrlAuthRoll(s,engs,thr){let tau=s.torque;for(const p of engs){const r=sub(thrustPt(p),s.cm);tau+=p.d.thrust*1000*thr*Math.sin(p.d.gim*Math.PI/180)*Math.hypot(r[0],r[2])}return tau}
// Control: reaction wheels in the pod plus engine gimbal (plus RCS when asked). Returns the commanded angular acceleration
// (world frame); physStep gives the wheels' share as a torque and turns the nozzles for the rest (gimSteer).
function ctrlAccel(s,rcs){const I=inpOf(s);   // controls reach only the vessel you fly
  const X=qrot(s.q,[1,0,0]),Y=qrot(s.q,[0,1,0]),Z=qrot(s.q,[0,0,1]);
  const E=activeEngines(s),rt=rcs?rcsTauCap(s):0,fa=s.finAuth&&s.finT===simT?s.finAuth:null,fP=fa?Math.min(fa[0],fa[2]):0,fR=fa?fa[1]:0;
  const aP=(ctrlAuthority(s,E,s.throttle)+rt+fP)/Math.max(s.I[0],s.I[2]),aR=Math.min(2,(ctrlAuthRoll(s,E,s.throttle)+rt+fR)/s.I[1]);
  // a spun stage (spin motors firing, or fired and still turning ≥ SPIN_MIN/2 about its axis): SAS leaves the roll alone, so it damps the
  // wobble instead of eating the spin. A roll key under SAS hands the roll back (SAS then spins it down)
  if(s.spun&&(Math.abs(dot(s.w,Y))<SPIN_MIN/2&&!s.parts.some(p=>p.on&&p.spinT>0)||s.sas&&I.roll))s.spun=false;
  const wS=s.spun?sub(s.w,mul(Y,dot(s.w,Y))):s.w;
  if(I.pitch||I.yaw||I.roll){s.hold=null;s.sasE=s.sasI=null;
    if(s.sas){ // fly-by-wire: keys command a rotation rate, SAS spends the torque to get there
      const wb=[dot(s.w,X),dot(s.w,Y),dot(s.w,Z)],wd=[I.yaw*.3,s.spun?wb[1]:-I.roll*.8,-I.pitch*.3],K=avOf(s).k;
      return add(add(mul(X,clamp((wd[0]-wb[0])*K,-aP,aP)),mul(Y,clamp((wd[1]-wb[1])*K,-aR,aR))),mul(Z,clamp((wd[2]-wb[2])*K,-aP,aP)))}
    return add(add(mul(X,I.yaw*aP),mul(Y,-I.roll*aR)),mul(Z,-I.pitch*aP))}
  if(!s.sas){s.sasE=s.sasI=null;return[0,0,0]}
  if(!s.hold&&len(wS)<0.02)s.hold=Y;
  const tgr=sasTarget(s);let ax,ang,aE=aP;
  if(tgr&&tgr.q){const e=qmul(tgr.q,qconj(s.q)),sg=e[3]<0?-1:1,v=[e[0]*sg,e[1]*sg,e[2]*sg],sv=len(v);   // a whole attitude, roll included (a side port)
    ang=2*Math.atan2(sv,Math.abs(e[3]));ax=sv>1e-12?mul(v,1/sv):[0,0,0];aE=Math.min(aP,aR)}
  else{const tg=tgr||Y,e=cross(Y,tg),sn=len(e);ang=Math.atan2(sn,dot(Y,tg));ax=sn>1e-9?mul(e,1/sn):(dot(Y,tg)<0?X:[0,0,0])}
  // the rate to turn at: braking-limited far off (√(α·θ)), and while engines burn, linear near the target with a time
  // constant Tc = SAS_LAG × their slowest nozzle's full swing. The bare square root has unbounded gain at zero error, and a
  // nozzle that takes 0.5 s to swing turns that into a limit cycle (NOTES). Wheels and RCS act at once: no linear zone.
  // A rate loop alone can't hold against a steady torque (thrust off the CoM, a stable rocket's aero moment): it leaves a
  // standing error, and asks for no more than its gain × the rate error, which can be less than the wheels already give. So
  // while the zone is on the rate loop also integrates (time constant SAS_TI), clamped to the authority, reset when it's off.
  let lag=0;if(s.throttle>0)for(const p of E)lag=Math.max(lag,p.d.gim/p.d.gimR);
  if(fP>0.25*s.torque)for(const p of s.fins)if(p.d.ctl)lag=Math.max(lag,p.d.ctl/p.d.ctlR);   // steerable fins, once they carry real weight
  const A=avOf(s),Tc=SAS_LAG*lag;let wd=mul(ax,ang<A.db?0:Math.min(A.w,Math.sqrt(aE*ang),Tc>0?ang/Tc:Infinity));   // inside the deadband: just stop turning
  let al=mul(sub(wd,wS),A.k);
  if(Tc>0){if(s.sasI)al=add(al,s.sasI);s.sasE=len(al)<aP?mul(sub(wd,wS),A.k/SAS_TI):null;s.sasA=aP}else{s.sasE=null;s.sasI=null}   // frozen while saturated
  return add(add(mul(X,clamp(dot(al,X),-aP,aP)),mul(Y,s.spun?0:clamp(dot(al,Y),-aR,aR))),mul(Z,clamp(dot(al,Z),-aP,aP)))}   // spun: the integral turns with the cone, keep its roll out too
// Euler's equations (control session, spin): in the body frame I·dω/dt = τ − ω×(I·ω). The gyroscopic term is what makes a
// spinning stage hold its axis and wobble (nutation) instead of turning to every torque. The wheels' stored momentum is left
// out of it on purpose: their storage is a gameplay budget (a pod's 100 kN·m·s is ~20 ISS gyroscopes), and as a real
// gyroscope it pinned capsules against their chutes (NOTES § "Spin stabilisation").
// al: the applied angular acceleration τ/I (inertial frame). A fast spin is cut into substeps of ≤ ROT_STEP rad (RK4), and
// the attitude is turned exactly by each substep's ω.
const ROT_STEP=0.05,SPIN_MIN=1;   // SPIN_MIN: rad/s about the axis that counts as spun (~10 rpm)
function integrateRot(s,al,dt){const I=s.I,a=qrot(qconj(s.q),al);let w=qrot(qconj(s.q),s.w),q=s.q;
  const f=w=>{const g=cross(w,[I[0]*w[0],I[1]*w[1],I[2]*w[2]]);return[a[0]-g[0]/I[0],a[1]-g[1]/I[1],a[2]-g[2]/I[2]]};
  const n=Math.min(64,Math.max(1,Math.ceil(len(w)*dt/ROT_STEP))),h=dt/n;
  for(let i=0;i<n;i++){const k1=f(w),k2=f(madd(w,k1,h/2)),k3=f(madd(w,k2,h/2)),k4=f(madd(w,k3,h));
    w=[w[0]+h/6*(k1[0]+2*k2[0]+2*k3[0]+k4[0]),w[1]+h/6*(k1[1]+2*k2[1]+2*k3[1]+k4[1]),w[2]+h/6*(k1[2]+2*k2[2]+2*k3[2]+k4[2])];
    const wi=qrot(q,w),wl=len(wi);if(wl>1e-12)q=qnorm(qmul(qaxis(mul(wi,1/wl),wl*h),q))}
  s.q=q;s.w=qrot(q,w)}
// ---- reaction wheels (control session). They store what they give: the vessel gets torque τ, the wheels' momentum H
// (body frame, N·m·s) changes by −τ·dt. Past hmax they can't push that way any more; they unload whenever something else
// (a burning gimbal, steerable fins in the air, RCS) can hold the vessel while they spin down (physStep).
// The wheels' controller also won't drive the vessel past WHEEL_W (rad/s about pitch, roll, yaw): beyond it, a torque that
// would turn it faster that way is refused, as if the wheels were full. A light stage would otherwise reach tens of rad/s on
// a held key and tear itself apart before 100 kN·m·s filled up (PLAYTEST #18); big stacks still run out of storage first.
let WHEEL_S=10,WHEEL_DUMP=4,WHEEL_W=[1,3,1];   // storage in seconds of full torque for parts without hmax; unloading time constant (s)
function wheelGive(s,tau,dt){if(!(s.torque>0))return[0,0,0];const H=s.wH||[0,0,0],tl=len(tau);let t=tl>s.torque?mul(tau,s.torque/tl):tau;
  const wb=qrot(qconj(s.q),s.w);t=t.map((x,i)=>x*wb[i]>0?Math.sign(x)*Math.min(Math.abs(x),Math.max(0,WHEEL_W[i]-Math.abs(wb[i]))*s.I[i]/dt):x);   // up to the limit, not past it
  let Hn=madd(H,t,-dt);const hn=len(Hn);if(hn>s.hmax){Hn=mul(Hn,s.hmax/hn);t=mul(sub(H,Hn),1/dt)}   // only what stays within storage
  s.wH=Hn;return t}
// attitude only (used while on rails): the wheels give what they can
function attStep(s,dt){const a=qrot(qconj(s.q),ctrlAccel(s)),t=wheelGive(s,[a[0]*s.I[0],a[1]*s.I[1],a[2]*s.I[2]],dt);
  integrateRot(s,qrot(s.q,[t[0]/s.I[0],t[1]/s.I[1],t[2]/s.I[2]]),dt)}

// ---- aerodynamics: one pass over each stack line's merged surface, per part. Body frame throughout.
// Newtonian impact pressure on every upstream-facing surface element (8 samples around each ring) with the stagnation
// coefficient rising through Mach 1; slender-body normal force where the cross-section changes; flat-plate fins;
// base suction on exposed rear faces (mostly filled by a burning engine); skin friction. Forces land on the part that
// owns the surface, at the point they act, so the same numbers give both the centre of pressure and the joint loads.
// Interference between lines (v1.23): Newtonian shadowing. An upstream-facing sample on one line gets no impact pressure
// (and no stagnation heat) if the ray from it back up the flow hits another line's body first. Lines are taken as
// cylinders of their widest radius over their own height. At small angles of attack the ray climbs steeply (1/tan α per
// metre across), so side-by-side boosters barely shade each other in an ascent; at high α the leeward lines go dark.
// Slender-body lift and skin friction are not shadowed.
let AERO_SHADOW=true;   // off only for A/B measurements
function shadowed(s,ln,px,py,pz,ux,uy,uz){const a=ux*ux+uz*uz;if(a<1e-12)return false;
  for(const B of s.lines){if(B===ln)continue;const dx=B.ox-px,dz=B.oz-pz,tc=(dx*ux+dz*uz)/a;if(tc<=0)continue;
    const perp2=dx*dx+dz*dz-tc*tc*a,r2=B.radius*B.radius;if(perp2>=r2)continue;
    const sIn=Math.max(0,tc-Math.sqrt((r2-perp2)/a)),sOut=tc+Math.sqrt((r2-perp2)/a),y0=py+sIn*uy,y1=py+sOut*uy;
    if(Math.max(y0,y1)>=B.yLo&&Math.min(y0,y1)<=B.yHi)return true}   // the chord through B's cylinder overlaps B's height
  return false}
const SND=h=>Math.sqrt(1.4*287*Math.max(216.65,288.15-0.0065*Math.max(h,0)));
const cpMax=M=>M<1?1+0.28*M*M:1.84-0.56/(M*M);
const waveBump=M=>1+0.5*Math.exp(-(((M-1.05)/0.18)**2));
// Sutton–Graves stagnation heating q = k·√(ρ/r_nose)·v³ (W/m², k = 1.83e-4 for air); each surface element gets q·|cos|
const SG=1.83e-4;let HEAT_GAIN=1;   // plain Sutton–Graves since the rescale (3.4 km/s orbits heat ~3.3× more than the old 2.3); it was ×3 when this small planet's 2.3 km/s orbits would otherwise re-enter like a gentle breeze (see NOTES)
const FIN4=[[1,0],[0,1],[-1,0],[0,-1]];
const NA=8,CA=[],SA=[];for(let k=0;k<NA;k++){CA.push(Math.cos((k+.5)/NA*6.283185307));SA.push(Math.sin((k+.5)/NA*6.283185307))}
function addF(p,fx,fy,fz,px,py,pz){const F=p.F,L=p.L;F[0]+=fx;F[1]+=fy;F[2]+=fz;L[0]+=py*fz-pz*fy;L[1]+=pz*fx-px*fz;L[2]+=px*fy-py*fx}
function aeroPass(s,vb,wb,rho,M,thrusting){
  const c=s.cm,sp=len(vb);if(sp<0.05)return;
  const cp=cpMax(M)*waveBump(M),fy0=-vb[1]/sp,fromTop=fy0<0;
  const ex=(rmx,rmn,rs)=>rmx<=rs?0:(rmx*rmx-rmn*rmn<1e-9?1:clamp((rmx*rmx-Math.max(rs,rmn)**2)/(rmx*rmx-rmn*rmn),0,1));
  const cbase=(M<0.8?0.12:M<1.2?0.12+0.3*(M-0.8):Math.max(0.08,0.24/M)),multi=AERO_SHADOW&&s.lines.length>1;let nShadow=0;
  for(const ln of s.lines){const E=ln.E,n=E.length,ox=ln.ox,oz=ln.oz,slender=ln.slender;
    let rs=0;for(let k=0;k<n;k++){const e=E[fromTop?n-1-k:k],mx=Math.max(e.r0,e.r1),mn=Math.min(e.r0,e.r1);e.exp=e.ny*fy0<0?ex(mx,mn,rs):1;rs=Math.max(rs,mx)}
    rs=0;for(let k=0;k<n;k++){const e=E[fromTop?k:n-1-k],mx=Math.max(e.r0,e.r1),mn=Math.min(e.r0,e.r1);e.bexp=e.ny*fy0>0?ex(mx,mn,rs):0;rs=Math.max(rs,mx)}
    for(const e of E){const p=e.p,dA=e.L*e.rm*(6.283185307/NA)*(e.cav?0.3:1),cb=cbase*(thrusting&&p.d.kind==='engine'?0.25:1);
      for(let k=0;k<NA;k++){const ca=CA[k],sa=SA[k],px=ox+e.rm*ca,py=e.ym,pz=oz+e.rm*sa,rx=px-c[0],ry=py-c[1],rz=pz-c[2];
        const fx=-(vb[0]+wb[1]*rz-wb[2]*ry),fy=-(vb[1]+wb[2]*rx-wb[0]*rz),fz=-(vb[2]+wb[0]*ry-wb[1]*rx);   // air velocity relative to this point
        const f2=fx*fx+fy*fy+fz*fz;if(f2<1e-6)continue;const fl=Math.sqrt(f2),qL=0.5*rho*f2,nx=e.nr*ca,ny=e.ny,nz=e.nr*sa;
        const cn=(nx*fx+ny*(ny*fy<0?fy*e.exp:fy)+nz*fz)/fl;
        if(cn<0){if(multi&&shadowed(s,ln,px,py,pz,-fx,-fy,-fz)){nShadow++}else{const pr=qL*cp*cn*cn*dA;addF(p,-nx*pr,-ny*pr,-nz*pr,px,py,pz);p.Q+=HEAT_GAIN*SG*Math.sqrt(rho/ln.radius)*f2*fl*(-cn)*dA}}
        else if(e.bexp>0&&cn>0){const pr=qL*cb*e.bexp*cn*dA/fl;addF(p,fx*pr,fy*pr,fz*pr,px,py,pz)}
        const sf=qL*0.003*dA/fl;addF(p,fx*sf,fy*sf,fz*sf,px,py,pz)}
      if(slender>0&&e.slope<1.5&&!e.cav){const rx=ox-c[0],ry=e.ym-c[1],rz=oz-c[2];
        const fx=-(vb[0]+wb[1]*rz-wb[2]*ry),fy=-(vb[1]+wb[2]*rx-wb[0]*rz),fz=-(vb[2]+wb[0]*ry-wb[1]*rx),fc=Math.hypot(fx,fz),f2=fx*fx+fy*fy+fz*fz;
        if(fc>1e-6){const rLo=e.y0<e.y1?e.r0:e.r1,rHi=e.y0<e.y1?e.r1:e.r0,dS=Math.PI*(fy<0?rLo*rLo-rHi*rHi:rHi*rHi-rLo*rLo);
          const N=0.5*rho*f2*2*(fc/Math.sqrt(f2))*(Math.abs(fy)/Math.sqrt(f2))*dS*slender;   // q·sin2α·dS
          addF(p,fx/fc*N,0,fz/fc*N,ox,e.ym,oz)}}}}
  // a fin ring is four plates around its own axis; a radial fin is one plate, its root on the host's skin at angle phi
  for(const p of s.fins){const d=p.d,A=d.span*d.chord,py=p.y0+d.chord/2,one=d.kind==='rfin',rr=one?d.span/2:d.r+d.span/2;
    let j=0;for(const[ax,az]of one?[[Math.cos(p.phi),Math.sin(p.phi)]]:FIN4){const dl=p.fd?p.fd[j]:0;j++;   // a steerable plate's deflection (rad)
      const px=p.pos[0]+ax*rr,pz=p.pos[2]+az*rr,cd=Math.cos(dl),nx=-az*cd,ny=-Math.sin(dl),nz=ax*cd,rx=px-c[0],ry=py-c[1],rz=pz-c[2];
      const fx=-(vb[0]+wb[1]*rz-wb[2]*ry),fy=-(vb[1]+wb[2]*rx-wb[0]*rz),fz=-(vb[2]+wb[0]*ry-wb[1]*rx),f2=fx*fx+fy*fy+fz*fz;if(f2<1e-6)continue;
      const fl=Math.sqrt(f2),qL=0.5*rho*f2,sa=(fx*nx+fy*ny+fz*nz)/fl,ca=Math.sqrt(Math.max(0,1-sa*sa)),N=qL*A*(3.5*sa*ca+1.2*sa*Math.abs(sa)),sf=qL*A*0.012/fl;
      addF(p,nx*N+fx*sf,ny*N+fy*sf,nz*N+fz*sf,px,py,pz)}}
  if(s.chute&&s.chuteA>0&&s.chutePart&&s.chutePart.on){const p=s.chutePart,px=p.pos[0],pz=p.pos[2],py=p.y0+p.h+1,rx=px-c[0],ry=py-c[1],rz=pz-c[2];
    const fx=-(vb[0]+wb[1]*rz-wb[2]*ry),fy=-(vb[1]+wb[2]*rx-wb[0]*rz),fz=-(vb[2]+wb[0]*ry-wb[1]*rx),f2=fx*fx+fy*fy+fz*fz,fl=Math.sqrt(f2),D=0.5*rho*f2*s.chuteA/fl;addF(p,fx*D,fy*D,fz*D,px,py,pz)}
  s.nShadow=nShadow}

// ---- structure: the vessel is rigid, so every joint carries exactly what it takes to make the branch beyond it
// follow the whole body's motion. Cut at the joint; (inertial demand of the branch) − (external forces on it) is the
// force and moment the joint transmits, read in the joint's own frame (axis jA: stack joints vertical, side joints
// radial): along the axis → compression/tension, across it → shear, moment across it → bending.
function structLoads(s,aNg,al,w,tauCtrl,probe){
  const c=s.cm;
  // control torque: reaction wheels in the pod up to their rating, the remainder as gimbal side-force shared by the
  // burning engines (which also pushes the whole vessel sideways, so it joins the body's acceleration)
  const tl=len(tauCtrl);let fg=[0,0,0];
  if(tl>0){const wheel=Math.min(tl,s.torque),tw=mul(tauCtrl,wheel/tl),tg=sub(tauCtrl,tw),pod=s.parts.find(p=>p.on&&p.d.torque);
    if(pod)pod.L=add(pod.L,tw);const E=activeEngines(s);
    if(E.length&&len(tg)>1){let D=0;for(const e of E){const d=sub(thrustPt(e),c);D+=dot(d,d)}
      for(const e of E){const pt=thrustPt(e),f=mul(cross(tg,sub(pt,c)),1/D);addF(e,f[0],f[1],f[2],pt[0],pt[1],pt[2]);fg=add(fg,f)}
      aNg=add(aNg,mul(fg,1/s.mass))}}
  for(const p of s.parts){if(!p.on)continue;const m=partMass(p)*1000,pc=partC(p),rr=sub(pc,c);
    const a=add(aNg,add(cross(al,rr),cross(w,cross(w,rr)))),fin=mul(a,m),pr=p.d.r,io=m*(p.h*p.h/12+pr*pr/4),ir=m*pr*pr/2;
    p.bF=sub(fin,p.F);p.bL=sub(add(cross(pc,fin),[io*al[0],ir*al[1],io*al[2]]),p.L)}
  let worst={frac:0,p:null,kind:''};
  for(const p of s.order){const par=p.parent,J=p.jP,A=p.jA,Fj=p.bF,Mj=sub(p.bL,cross(J,Fj));
    const fA=dot(Fj,A),axial=-fA,shear=len(sub(Fj,mul(A,fA))),bend=len(sub(Mj,mul(A,dot(Mj,A))));
    // the weaker side governs, times the joint's reinforcement. An interstage carries the load around the engine it
    // encloses, so the enclosed engine's own (weaker) rating drops out of both joints it sits between.
    const a1=p.encBy?p.encBy.d:p.d,a2=p.d.istage?p.d:(par.encBy?par.encBy.d:par.d),lim=k=>1000*Math.min(a1[k],a2[k])*JR[p.jr||0].k;
    const fa=axial>0?axial/lim('T'):-axial/lim('C'),fs=shear/lim('S'),fb=bend/lim('B'),jk=1000*JR[p.jr||0].k;
    // each side against its own rating: what telemetry can certify for that part
    const side=d=>Math.max(axial>0?axial/(d.T*jk):-axial/(d.C*jk),shear/(d.S*jk),bend/(d.B*jk));p.sk1=a1.key;p.sk2=a2.key;
    if(!probe){p.sf1=side(a1);p.sf2=side(a2)}
    const frac=Math.max(fa,fs,fb),kind=frac===fb?'bending':frac===fs?'shear':axial>0?'tension':'compression';
    if(!probe)p.load=p.load*0.6+frac*0.4;else{p.pfrac=frac;p.pkind=kind}const f=probe?frac:p.load;
    p.loadKind=kind;if(f>worst.frac)worst={frac:f,p,kind};
    par.bF=add(par.bF,Fj);par.bL=add(par.bL,p.bL)}
  worst.aSide=mul(fg,1/s.mass);return worst}
function subtree(p){const out=[p];for(const c of p.children)if(c.on)out.push(...subtree(c));return out}
// Take parts off the vessel (staging or structural failure). They leave as one debris body with the velocity
// their centre of mass had, including the spin, plus a kick (body frame).
function detach(s,list,kick,spin,asVessel){
  list=list.filter(p=>p.on);if(!list.length)return;s.kickN=(s.kickN||0)+1;
  geom(s);const c0=s.cm.slice();let dm=0,dc=[0,0,0];for(const p of list){const m=partMass(p);dm+=m;dc=madd(dc,partC(p),m)}dc=mul(dc,1/dm);
  for(const p of list)p.on=false;
  geom(s);rebuildShape(s);
  const off=qrot(s.q,sub(dc,c0)),vd=add(add(s.v,cross(s.w,off)),qrot(s.q,kick));
  if(asVessel||list.some(isCommand)){s.v=madd(s.v,qrot(s.q,kick),-dm*1000/s.mass);vesselFrom(s,list,add(s.r,off),vd,s.w)}   // a command part aboard: a vessel of its own
  else{junkNote(s,list,add(s.r,off),add(add(s.v,cross(s.w,off)),qrot(s.q,kick)),dm,dc);HOOK.debris({body:s.body,r:add(s.r,off),v:add(add(s.v,cross(s.w,off)),qrot(s.q,kick)),q:s.q.slice(),
    w:add(s.w,[(Math.random()-.5)*spin,(Math.random()-.5)*spin,(Math.random()-.5)*spin]),parts:list,cm:dc,mass:dm*1000,t:0})}   // junkNote: space Q26
  s.r=add(s.r,qrot(s.q,sub(s.cm,c0)));
  if(s.landed)s.landed=false;
  HOOK.rebuild()}
// ---- engine gimbal (control session). Each engine's nozzle swivels up to d.gim degrees, at most d.gimR °/s. p.gv is its
// deflection: a vessel-frame vector across its thrust axis, |gv| = sin(angle); the thrust points along tdir + gv, so the
// steering torque, the side force and the joint loads all come from the turned thrust itself. The torque the wheels can't
// give (tauB, body frame) is shared out by least squares over every engine's two deflection axes (columns r × t·u), each
// engine then clipped to its range. An engine on the axis has no roll column: it can't roll the vessel.
// Steerable fins join the same solve: each plate is one column, the torque its full deflection gives at this step's airflow
// (finCols, linearised: dN/dδ ≈ 3.5·q·A along the plate's normal); a plate is clipped to ±ctl and slews at ctlR.
function gimSteer(s,eng,th,tauB,dt,fc=[]){
  const cols=[],need=len(tauB)>1e-9;
  if(need)eng.forEach((p,i)=>{const d=tdirOf(p),a=Math.abs(d[0])<0.9?[1,0,0]:[0,0,1],u1=norm(cross(d,a)),u2=cross(d,u1),r=sub(thrustPt(p),s.cm),
    sm=Math.sin(p.d.gim*Math.PI/180)*th[i];cols.push({p,u:[u1,u2],c:[mul(cross(r,u1),sm),mul(cross(r,u2),sm)]})});
  if(need)for(const F of fc)cols.push({F,c:[F.c]});
  const want=new Map(),fin=new Map();
  if(cols.length){
    const M=[[0,0,0],[0,0,0],[0,0,0]];let tr=0;for(const C of cols)for(const c of C.c)for(let i=0;i<3;i++)for(let j=0;j<3;j++)M[i][j]+=c[i]*c[j];
    for(let i=0;i<3;i++)tr+=M[i][i];for(let i=0;i<3;i++)M[i][i]+=1e-9*tr+1e-12;   // ridge: a rank-2 set (no roll column) stays solvable
    const y=solve3(M,tauB);
    for(const C of cols){if(C.F){fin.set(C.F,clamp(dot(C.c[0],y),-1,1)*C.F.dm);continue}
      let a1=dot(C.c[0],y),a2=dot(C.c[1],y);const m=Math.hypot(a1,a2);if(m>1){a1/=m;a2/=m}
      const k=Math.sin(C.p.d.gim*Math.PI/180);want.set(C.p,add(mul(C.u[0],a1*k),mul(C.u[1],a2*k)))}}
  for(const p of s.parts){if(!p.on||p.d.kind!=='engine')continue;const g=p.gv||[0,0,0],w=want.get(p)||[0,0,0],dg=sub(w,g),dl=len(dg),
    st=p.d.gimR*Math.PI/180*dt;p.gv=dl>st?madd(g,dg,st/dl):w}   // slew toward the command (or back to centre when not steering)
  const cmd=new Map();for(const[F,v]of fin){if(!cmd.has(F.p))cmd.set(F.p,[]);cmd.get(F.p)[F.j]=v}
  for(const p of s.fins){if(!p.d.ctl)continue;const n=p.d.kind==='rfin'?1:4,st=p.d.ctlR*Math.PI/180*dt,w=cmd.get(p)||[],fd=p.fd||new Array(n).fill(0);
    p.fd=fd.map((g,j)=>{const t=w[j]||0;return Math.abs(t-g)>st?g+Math.sign(t-g)*st:t})}}
// the steerable plates' columns at this airflow (body frame): r × n · 3.5·q·A·(−f_y/|f|)·δmax, and the authority they add
// about each body axis (the torque one axis gets if every plate turns for it alone)
function finCols(s,vb,wb,rho){const out=[],auth=[0,0,0];if(!(rho>0))return{out,auth};const c=s.cm;
  for(const p of s.fins){const d=p.d;if(!d.ctl)continue;const A=d.span*d.chord,py=p.y0+d.chord/2,one=d.kind==='rfin',rr=one?d.span/2:d.r+d.span/2,dm=d.ctl*Math.PI/180;
    let j=0;for(const[ax,az]of one?[[Math.cos(p.phi),Math.sin(p.phi)]]:FIN4){const px=p.pos[0]+ax*rr,pz=p.pos[2]+az*rr,rx=px-c[0],ry=py-c[1],rz=pz-c[2];
      const fx=-(vb[0]+wb[1]*rz-wb[2]*ry),fy=-(vb[1]+wb[2]*rx-wb[0]*rz),fz=-(vb[2]+wb[0]*ry-wb[1]*rx),f2=fx*fx+fy*fy+fz*fz;
      if(f2>1e-6){const k=3.5*0.5*rho*f2*A*(-fy/Math.sqrt(f2))*dm,col=mul(cross([rx,ry,rz],[-az,0,ax]),k);out.push({p,j,c:col,dm});for(let i=0;i<3;i++)auth[i]+=Math.abs(col[i])}j++}}
  return{out,auth}}
function solve3(M,b){const[a,b_,c]=M[0],[d,e,f]=M[1],[g,h,i]=M[2],A=e*i-f*h,B=f*g-d*i,C=d*h-e*g,det=a*A+b_*B+c*C;if(Math.abs(det)<1e-300)return[0,0,0];
  const inv=[[A,c*h-b_*i,b_*f-c*e],[B,a*i-c*g,c*d-a*f],[C,b_*g-a*h,a*e-b_*d]];return inv.map(r=>(r[0]*b[0]+r[1]*b[1]+r[2]*b[2])/det)}
function physStep(s,dt){
  if(s.lesJet){s.lesJet=false;lesJettison(s,true)}
  const b=s.body;geom(s);
  const r=s.r,rl=len(r),h=rl-b.R,pr=pressure(b,h);
  for(const p of s.parts){p.F[0]=p.F[1]=p.F[2]=0;p.L[0]=p.L[1]=p.L[2]=0;p.Q=0}
  const eng=activeEngines(s);let T=0;
  // control first: the wheels take what they can of the law's torque (a pure torque), the gimbals and steerable fins are
  // steered for the rest. The fins' authority depends on the airflow, so their columns come first.
  const qi=qconj(s.q),FC=s.fins.some(p=>p.d.ctl)?finCols(s,qrot(qi,sub(s.v,surfVel(b,r))),qrot(qi,s.w),density(b,h)):null;s.finAuth=FC&&FC.out.length?FC.auth:null;s.finT=simT;
  const alC=qrot(qi,ctrlAccel(s)),tauC=[alC[0]*s.I[0],alC[1]*s.I[1],alC[2]*s.I[2]];
  const thr=s.throttle>0?eng.map(p=>engineMdot(p.d)*1000*(p.d.ispV+(p.d.ispA-p.d.ispV)*pr)*G0*s.throttle):[];
  // what can take the torque the wheels don't give: gimbals and steerable fins (one solve), else RCS
  const steer=(s.throttle>0&&eng.length?ctrlAuthority(s,eng,s.throttle)-s.torque:0)+(s.finAuth?Math.min(s.finAuth[0],s.finAuth[2]):0),rcsCap=s.rcs?rcsTauCap(s):0;
  // free channels (gimbal, fins) unload from 2 %; RCS costs gas, so it only keeps them usable: past 80 % down to 60 %
  const hf=s.wH&&s.hmax>0?len(s.wH)/s.hmax:0;s.wDump=steer>0?hf>0.02:rcsCap>0&&(s.wDump?hf>0.6:hf>0.8);
  let dump=[0,0,0];if(s.wDump){dump=mul(s.wH,1/WHEEL_DUMP);const dl=len(dump),cap=Math.min(s.torque,0.5*(steer>0?steer:rcsCap));if(dl>cap)dump=mul(dump,cap/dl)}
  const tauW=wheelGive(s,add(tauC,dump),dt),rest=sub(tauC,tauW);   // rest = the law's torque the wheels didn't give, minus the unloading
  gimSteer(s,s.throttle>0?eng:[],thr,steer>0?rest:[0,0,0],dt,FC?FC.out:[]);
  if(s.sasE){const I=madd(s.sasI||[0,0,0],s.sasE,dt),m=len(I);s.sasI=m>s.sasA?mul(I,s.sasA/m):I}   // SAS rate integral (ctrlAccel)
  if(s.throttle>0&&eng.length){const want={};for(const[i,p]of eng.entries()){const md=engineMdot(p.d)*1000,t=thr[i],pt=thrustPt(p);
    const d=norm(add(tdirOf(p),p.gv||[0,0,0]));T+=t*d[1];addF(p,t*d[0],t*d[1],t*d[2],pt[0],pt[1],pt[2]);const g=s.grp[p.i];want[g]=(want[g]||0)+md*s.throttle*dt/1000}
    const on=onArr(s),fuel=fuelArr(s),rank=dropRank(s,s.evIdx);for(const g in want)drawFuel(s,on,fuel,s.grp,rank,+g,want[g]);
    s.parts.forEach((p,i)=>{if(p.res.fuel!=null)p.res.fuel=fuel[i]})}
  const out=new Set(),next=s.events[s.evIdx];
  for(let k=0;k<s.segs.length;k++){const g=s.segs[k],eng=s.parts.filter(p=>p.on&&p.seg===k&&p.d.kind==='engine');
    if(g.ignited&&!g.flamed&&eng.length&&eng.every(p=>groupFuel(s,s.grp[p.i])<=1e-9)){g.flamed=true;out.add(g.label.startsWith('boosters')?'Booster burnout':'Flameout')}
    // a crossfed segment empties its own tanks while its engines run on: say so when it's the next thing to drop
    else if(!g.dryNote&&next&&next.decouple.includes(k)&&s.parts.some(p=>p.on&&p.seg===k&&p.cap.fuel)&&segFuel(s,k)<=1e-9){g.dryNote=true;out.add(`${g.label.split(' ')[0]} empty — stage to drop them`)}}
  for(const m of out)HOOK.msg(m);
  for(const p of s.parts)if(p.on&&p.spinT>0){const k=Math.min(dt,p.spinT)/dt;p.L[1]+=k*p.d.spinJ/p.d.burn;p.spinT-=dt;if(p.spinT<=0){p.spinT=0;p.spent=true}}   // spin motors: a pure couple about the axis
  s.thrust=T;
  const Y=qrot(s.q,[0,1,0]);
  if(s.landed){const W=s.mass*b.mu/(rl*rl);
    if(T*dot(Y,norm(r))>W){s.landed=false;HOOK.msg(simT<1?'Liftoff!':'Takeoff')}
    else{simT+=dt;syncLanded(s);s.gload=1;s.maxLoad=0;return}}
  if(s.node&&T>0)nodeBurn(s,Y,T,dt);
  const vAir=sub(s.v,surfVel(b,r)),vb=qrot(qi,vAir),wb=qrot(qi,s.w),rho=density(b,h),sp=len(vAir);
  s.mach=b.atm?sp/SND(h):0;s.qdyn=0.5*rho*sp*sp;s.aoa=sp>1?Math.acos(clamp(vb[1]/sp,-1,1)):0;
  if(s.chute&&rho>0.03&&s.chutePart&&s.chutePart.on){const tgt=sp<250&&mainChuteOK(b,h,r,simT)?600:sp<400?6:0,cap=Math.min(tgt,CHUTE_G*G0*s.mass/Math.max(s.qdyn,1));if(tgt)s.chuteA=s.chuteA<cap?Math.min(cap,s.chuteA+dt*(tgt>6?140:3)):cap}  // drogue below ~20 km once under 400 m/s (~Mach 1.3: a supersonic drogue would hit a falling capsule with 17 g), main below 3 km above the ground (MAIN_AGL) under 250 m/s
  if(rho>0&&sp>0.05){
    const F0=s.parts.map(p=>p.F.slice()),L0=s.parts.map(p=>p.L.slice());
    aeroPass(s,vb,wb,rho,s.mach,T>0);
    // drag may not reverse the airflow within one step
    let Fa=[0,0,0];s.parts.forEach((p,i)=>{Fa=add(Fa,sub(p.F,F0[i]))});
    const lim=0.9*sp*s.mass/dt,fa=len(Fa);
    if(fa>lim){const k=lim/fa;s.parts.forEach((p,i)=>{p.F=add(F0[i],mul(sub(p.F,F0[i]),k));p.L=add(L0[i],mul(sub(p.L,L0[i]),k))})}}
  // RCS: the translation keys, plus whatever the control law wants beyond the wheels and gimbal (real forces, real gas)
  if(s.rcs){const alR=qrot(qi,ctrlAccel(s,true)),ex=steer>0?[0,0,0]:rest;   // with nothing else to steer, RCS also covers what the wheels didn't give
    rcsStep(s,dt,[(alR[0]-alC[0])*s.I[0]+ex[0],(alR[1]-alC[1])*s.I[1]+ex[1],(alR[2]-alC[2])*s.I[2]+ex[2]])}else{s.rcsFire=0;s.rcsShots=null}
  groundContact(s,dt);   // the ground pushes back through the contact points (terrain session)
  let F=[0,0,0],L=[0,0,0];for(const p of s.parts)if(p.on){F=add(F,p.F);L=add(L,p.L)}
  if(s.lesT>0){const les=s.parts.find(p=>p.on&&p.d.kind==='les');if(les){F=add(F,[0,les.d.thrust*1000,0]);s.lesT-=dt;if(s.lesT<=0)s.lesJet=true}else s.lesT=0}   // the escape tower, on the axis
  const tau=sub(L,cross(s.cm,F)),aNg=mul(F,1/s.mass);
  const alB=[(tau[0]+tauW[0])/s.I[0],(tau[1]+tauW[1])/s.I[1],(tau[2]+tauW[2])/s.I[2]];   // the gimbals' torque is already in tau (turned thrust)
  const worst=structLoads(s,aNg,alB,wb,tauW);s.aB=add(aNg,worst.aSide);s.alB=alB;s.wB=wb;   // for the ports' loads
  s.maxLoad=worst.frac;s.maxLoadP=worst.p;s.maxLoadKind=worst.kind;if(len(aNg)>1e-9)s.kickN=(s.kickN||0)+1;   // non-gravitational: cached node states go stale
  let grav=mul(r,-b.mu/(rl*rl*rl));s.gload=len(aNg)/G0;if(b.pert||b.children.some(c=>c.pert)){const pa=pertAcc(b,r,simT,true);if(pa)grav=add(grav,pa)}
  s.v=madd(s.v,add(grav,qrot(s.q,add(aNg,worst.aSide))),dt);s.r=madd(s.r,s.v,dt);
  integrateRot(s,qrot(s.q,alB),dt);
  simT+=dt;checkSOI(s);groundCheck(s);
  thermal(s,dt,rho*sp*sp*sp>0?Math.sqrt(rho/Math.max(s.radius,.3))*sp*sp*sp*SG*HEAT_GAIN:0,rho,sp);
  if(s.alive&&worst.frac>1){const p=worst.p;PROG.cert[p.sf1>=p.sf2?p.sk1:p.sk2]=1;   // a failure is a measurement too
    HOOK.msg(`Structural failure — ${p.d.name} / ${p.parent.d.name} (${worst.kind}, ${(worst.frac*100).toFixed(0)}%)`);
    detach(s,subtree(p),[0,0,0],1.5)}}
// ---- heat. Each part has a skin temperature: absorbed aero heat in, εσ(T⁴−T∞⁴) radiated out over its whole skin, heat
// capacity of a 6 kg/m² metal skin. A shield's ablator boils off above 700 K at 2.5 MJ/kg and pins it there until gone.
const T_AMB=250,SKIN=6*900,H_ABL=2.5e6,T_ABL=700;
// Air also cools a skin hotter than the flow over it (the recovery temperature T∞ + v²/2cp): convection, ~h = 12·√(ρv) W/m²K.
// It only ever acts once a re-entry is over, so peak heating is unchanged, but a capsule no longer hangs at 500 K under its chute.
function thermal(s,dt,qStag,rho=0,sp=0){
  s.qHeat=qStag;let hot=null;
  for(const p of s.parts){if(!p.on)continue;const A=p.area||2,cap=SKIN*A;
    let net=p.Q-0.8*5.67e-8*(p.T**4-T_AMB**4)*A;const Tr=T_AMB+sp*sp/2010;if(rho>0&&p.T>Tr)net-=12*Math.sqrt(rho*Math.max(sp,2))*A*(p.T-Tr);
    if(p.res.ablator>0&&p.T>=T_ABL&&net>0){const use=Math.min(p.res.ablator,net*dt/H_ABL/1000);p.res.ablator-=use;net-=use*1000*H_ABL/dt}
    p.T=Math.max(T_AMB*0.9,p.T+net*dt/cap);if(!hot||p.T/p.d.Tmax>hot.T/hot.d.Tmax)hot=p}
  s.hot=hot;
  if(hot&&hot.T>hot.d.Tmax){HOOK.msg(`${hot.d.name} burned up (${hot.T.toFixed(0)} K)`);partLost(s,hot)}}
function coolOnRails(s,dt){for(const p of s.parts)if(p.on)p.T=T_AMB+(p.T-T_AMB)*Math.exp(-dt/400)}
// a destroyed part takes its branch with it; losing the root (the pod) ends the flight
function partLost(s,p){const P=add(s.r,qrot(s.q,sub(partC(p),s.cm)));HOOK.boom(s.body,P,simT,0.6);
  if(p===s.root){s.alive=false;HOOK.msg('Vessel lost');return}detach(s,subtree(p),[0,0,0],1)}
function launchSegs(s){const e=s.events[0];return e&&!e.decouple.length?e.ignite:[]}
// What-if analysis for the assembly screen: centre of pressure, stability margin, and joint loads at liftoff and
// at max-q (trimmed, i.e. controls exactly cancel the aero torque — the worst steady case the pilot can hold).
function probe(s,{M=0.6,aoa=4,q=0,thr=0,h=0}){
  for(const p of s.parts){p.F=[0,0,0];p.L=[0,0,0]}geom(s);
  const pr=Math.exp(-h/TELLUS.H),ls=launchSegs(s),E=s.parts.filter(p=>p.on&&p.d.kind==='engine'&&ls.includes(p.seg));let T=0;
  if(thr>0)for(const p of E){const md=engineMdot(p.d)*1000,t=md*(p.d.ispV+(p.d.ispA-p.d.ispV)*pr)*G0*thr,pt=thrustPt(p),d=tdirOf(p);T+=t*d[1];addF(p,t*d[0],t*d[1],t*d[2],pt[0],pt[1],pt[2])}
  let Fx=0,Lz=0,fin=0;
  if(q>0){const v=M*SND(h),rho=2*q/(v*v),a=aoa*Math.PI/180,vb=[v*Math.sin(a),v*Math.cos(a),0];fin=finCols(s,vb,[0,0,0],rho).auth[2];   // pitch about z
    const F0=s.parts.map(p=>p.F.slice()),L0=s.parts.map(p=>p.L.slice());aeroPass(s,vb,[0,0,0],rho,M,T>0);
    s.parts.forEach((p,i)=>{if(p.on){Fx+=p.F[0]-F0[i][0];Lz+=p.L[2]-L0[i][2]}})}
  let F=[0,0,0],L=[0,0,0];for(const p of s.parts)if(p.on){F=add(F,p.F);L=add(L,p.L)}
  const tau=sub(L,cross(s.cm,F)),ctl=mul(tau,-1),auth=ctrlAuthority(s,E,thr);
  const ign=s.segs.map(g=>g.ignited);s.segs.forEach((g,k)=>g.ignited=ls.includes(k));
  const worst=structLoads(s,mul(F,1/s.mass),[0,0,0],[0,0,0],ctl,true);s.segs.forEach((g,k)=>g.ignited=ign[k]);
  // CoP on the axis: −Lz/Fx is only meaningful for a symmetric design, which side groups always are
  return{ycp:Fx!==0?-Lz/Fx:NaN,ycm:s.cm[1],worst,trim:len(tau)<=auth+fin,tau:len(tau),auth:auth+fin,wheel:s.torque,gim:auth-s.torque,fin}}
// The builder's control readout (control session). Pitch: what holding 5° off the airflow at max-q takes, burning and
// coasting, against each source. Roll: wheels, engines off the axis, steerable fins at max-q. Turns: a 90° turn in vacuum
// as the SAS flies it (accelerate, then brake, at most 0.6 rad/s, and on wheels alone at most their storage ÷ inertia),
// wheels alone and with the first stage lit. RCS is
// counted only if the design has quads (it adds to every case).
function turnTime(alpha,wmax=0.6,th=Math.PI/2){if(!(alpha>0)||!(wmax>0))return Infinity;const w=Math.sqrt(th*alpha);return w<=wmax?2*Math.sqrt(th/alpha):th/wmax+wmax/alpha}   // wmax: the SAS's 0.6 rad/s, or what the wheels can store
function controlReport(s){geom(s);const ls=launchSegs(s),E=s.parts.filter(p=>p.on&&p.d.kind==='engine'&&ls.includes(p.seg)),Ip=Math.max(s.I[0],s.I[2]);
  const rc=s.rcs;s.rcs=true;s.rcsJ=null;const rcs=rcsTauCap(s);s.rcs=rc;s.rcsJ=null;
  const MQ={M:1.2,aoa:5,q:25000,h:9000},burn=probe(s,{...MQ,thr:1}),coast=probe(s,{...MQ,thr:0});s.parts.forEach(p=>p.pfrac=0);
  const v=MQ.M*SND(MQ.h),rho=2*MQ.q/(v*v),fr=finCols(s,[0,v,0],[0,0,0],rho).auth[1];
  const thrust=E.reduce((a,p)=>a+p.d.thrust*1000,0);
  // spin motors: the spin they give what is left when they fire (their stage and everything above it, tanks full)
  const spin=s.parts.filter(p=>p.on&&p.d.kind==='spin').map(p=>{const y=Math.min(...s.parts.filter(q=>q.on&&q.seg===p.seg).map(q=>q.y0)),t={parts:s.parts.filter(q=>q.on&&q.y0>=y)};
    geom(t);return p.d.spinJ/t.I[1]*60/2/Math.PI});geom(s);
  return{burn,coast,rcs,spin,roll:{wheel:s.torque,gim:ctrlAuthRoll(s,E,1)-s.torque,fin:fr},
    turn:{wheels:turnTime((s.torque+rcs)/Ip,rcs>0?0.6:Math.min(0.6,s.hmax/Ip)),burn:turnTime((ctrlAuthority(s,E,1)+rcs)/Ip)},hfull:s.hmax/Ip,steer:s.torque>0||E.some(p=>p.d.gim>0)||s.parts.some(p=>p.on&&p.d.ctl)||rcs>0,thrust}}
function firstSeg(s){return launchSegs(s)[0]??0}
