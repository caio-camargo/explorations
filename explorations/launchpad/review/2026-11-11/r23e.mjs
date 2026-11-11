// R23e: physStep calls ctrlAccel twice. The first (start of the step) adds the aero feed-forward ff = -tauA/I because
// s.simTA === simT. Between the calls the aero pass sets s.tauA anew and s.simTA = simT + dt, so the second call
// (ctrlAccel(s,true), for RCS) fails `s.simTA===simT` and leaves ff out. RCS is commanded (alR - alC)·I + ex, so the
// missing ff shows up as an RCS torque command of about +tauA: RCS told to push WITH the aero moment the first call cancelled.
// Flight: vehicle-24's (tests/vehicle.mjs): SAS attitude hold along a pitch program, staging when dry; RCS switched on.
// Run: node r23e.mjs [preset]      (default Beeper+RCS, built below)
import { makeSim } from './sim.mjs';
const ev = makeSim();
ev('HOOK.msg=()=>{};HOOK.news=()=>{}');
const preset = process.argv[2] || 'Beeper+RCS';
// No stock preset has both RCS and an unstable stage (Docking, the one with quads, never gets a feed-forward, with or without
// its fins). So the default is the stock Beeper (vehicle-24's design) with Docking's two RCS rings and gas bottles on its upper tank.
ev(`{const d=toV2(PRESETS.Beeper),find=n=>n.k==='t2'?n:n.c.map(find).find(Boolean),t=find(d.root);t.c.push({k:'rcs',at:{y:0.2,a:0,n:4,cy:0.1},c:[]},{k:'rcs',at:{y:1.8,a:0,n:4,cy:0.1},c:[]},{k:'gas',at:{y:1,a:Math.PI/4,n:2,cy:0.3},c:[]});PRESETS['Beeper+RCS']=d}`);
ev(`simT=0;S=newShip(PRESETS[${JSON.stringify(preset)}]);advPhys(S);S.sas=true;S.sasMode='stab';S.throttle=1;stage(S);S.rcs=true`);
console.log('preset', preset, '· RCS quads on the stack:', ev(`S.parts.filter(p=>p.on&&p.d.kind==='rcs').length`), '· rcsTauCap', ev('rcsTauCap(S)').toFixed(0), 'N·m');
// instrument rcsStep: the torque it is handed, and what the second ctrlAccel would return with the feed-forward the first one used
ev(`globalThis.__rows=[];globalThis.__pre=null;globalThis.__nTau=0;
  {const rs=rcsStep;rcsStep=function(s,dt,tq){
    if(s===S&&__pre){const sv={tauA:s.tauA,simTA:s.simTA,sasI:s.sasI,sasE:s.sasE,sasA:s.sasA,hold:s.hold,spun:s.spun};
      const qi=qconj(s.q);s.tauA=__pre.tauA;s.simTA=simT;const alFF=qrot(qi,ctrlAccel(s,true));Object.assign(s,sv);
      s.simTA=simT-1;const alNo=qrot(qi,ctrlAccel(s,true));Object.assign(s,sv);
      const dd=[0,1,2].map(i=>(alNo[i]-alFF[i])*s.I[i]);if(globalThis.__fix)tq=[tq[0]-dd[0],tq[1]-dd[1],tq[2]-dd[2]];__rows.push({t:simT,h:len(s.r)-s.body.R,aoa:s.aoa*180/Math.PI,q:s.qdyn,tauA:__pre.tauA.slice(),tq:tq.slice(),d:[0,1,2].map(i=>(alNo[i]-alFF[i])*s.I[i])})}
    return rs(s,dt,tq)}}
  globalThis.__fly=()=>{const s=S,AS=TELLUS.atm/7e4;for(let i=0;i<30000&&s.alive;i++){const fr=localFrame(s.r),h=len(s.r)-TELLUS.R;if(h>TELLUS.atm)break;
    const r=90*(1-Math.pow(Math.min(1,Math.max(0,(h-200*AS)/(38000*AS-200*AS))),0.6))*Math.PI/180;s.hold=norm(add(mul(fr.e,Math.cos(r)),mul(fr.up,Math.sin(r))));
    if(dvRemaining(s).cur<=0.5&&s.evIdx<s.events.length)stage(s);s.rcs=true;
    __pre=s.tauA&&s.simTA===simT?{tauA:s.tauA.slice()}:null;if(__pre)__nTau++;advPhys(s)}}`);
const gas=()=>ev(`S.parts.reduce((a,p)=>a+(p.res&&p.res.gas||0),0)*1000`);
ev('globalThis.__fix='+(process.env.FIX==='1'));const g0=gas();
ev('__fly()');
console.log(process.env.FIX==='1'?'[FIX=1: the wrapper takes the missing-ff share out of the RCS command]':'[as shipped; FIX=1 node r23e.mjs flies the same with the missing-ff share removed]','· RCS gas used on the ascent:',(g0-gas()).toFixed(2),'kg of',g0.toFixed(2));
const rows = ev('__rows');
console.log('flown to t =', ev('simT').toFixed(1), 's, altitude', (ev('len(S.r)-TELLUS.R') / 1e3).toFixed(1), 'km, alive', ev('S.alive'), '· steps where the first ctrlAccel fed the aero moment forward:', ev('__nTau'), '· of those with RCS firing logic reached:', rows.length);
const f = v => v.map(x => x.toFixed(0).padStart(8)).join('');
console.log('   t(s)  alt(m)  aoa°  q(Pa)   tauA fed forward by call 1 (N·m, body)   RCS torque command given to rcsStep     of which due to the missing ff');
for (const r of rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / 14)) === 0).slice(0, 16))
  console.log(`${r.t.toFixed(2).padStart(7)} ${r.h.toFixed(0).padStart(7)} ${r.aoa.toFixed(1).padStart(5)} ${r.q.toFixed(0).padStart(6)}   [${f(r.tauA)}]             [${f(r.tq)}]        [${f(r.d)}]`);
const mag = v => Math.hypot(...v);
if (rows.length) {
  const big = rows.filter(r => mag(r.tauA) > 1);
  const along = big.map(r => (r.tq[0] * r.tauA[0] + r.tq[1] * r.tauA[1] + r.tq[2] * r.tauA[2]) / (mag(r.tauA) ** 2));
  const expAlong = big.map(r => ((r.tq[0] - r.d[0]) * r.tauA[0] + (r.tq[1] - r.d[1]) * r.tauA[1] + (r.tq[2] - r.d[2]) * r.tauA[2]) / (mag(r.tauA) ** 2));
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`\nover ${big.length} steps with |tauA| > 1 N·m: (RCS command · tauA)/|tauA|²  observed median ${med(along).toFixed(3)}, max ${Math.max(...along).toFixed(3)}  (+1 = RCS told to add the whole aero moment back)`);
  console.log(`   with the feed-forward kept in the second call: median ${med(expAlong).toFixed(3)}  (expected ~0: RCS asked only for what its own extra authority adds)`);
  console.log(`   largest RCS command from the missing ff: ${Math.max(...big.map(r => mag(r.d))).toFixed(0)} N·m; RCS can give ${ev('rcsTauCap(S)').toFixed(0)} N·m`);
}
