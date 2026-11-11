// R23d: ORB_T0 (and in absAt, simT) is swapped to 0 and put back with no try/finally. A throw in between leaves it at 0.
// In Node ORB_ABS is false and ORB_T0 is always 0, so the suite can't see this; here it is set by hand as the browser does at lift-off.
// Run: node r23d.mjs
import { makeSim } from './sim.mjs';
const ev = makeSim();
ev('HOOK.msg=()=>{};HOOK.news=()=>{}');
const T0 = ev('100*DAY_S'), ST = 500;
const good = `{bodyName:'Selene',name:'sat',id:7,epoch:0,ant:1,shape:[],r:[SELENE.R+2000e3,0,0],v:[0,0,-Math.sqrt(SELENE.mu/(SELENE.R+2000e3))]}`;
const bad = `{bodyName:'Selene',name:'bad',id:8,epoch:0,ant:1,shape:[]}`;   // an entry with no r/v (a damaged save)
const cases = [
  ['moonOrbStep (sim/space.js)', `moonOrbStep(${bad},1000)`, 'entry without r'],
  ['tiltStep (sim/space.js)', `tiltStep(${bad},1000)`, 'entry without r'],
  ['absAt (sim/space.js)', `absAt(${bad},1000)`, 'entry without r'],
  ['radioAt (sim/rovers.js)', `radioAt(SELENE,undefined,true,1000)`, 'pf undefined'],
  ['slotRate (sim/space.js)', `(()=>{const f=pertAcc;pertAcc=()=>{throw new Error('injected')};try{return slotRate(${good})}finally{pertAcc=f}})()`, 'INJECTED throw in pertAcc (no data found that throws here)'],
  ['tvTiltRate (sim/space.js)', `(()=>{const f=pertAcc;pertAcc=()=>{throw new Error('injected')};try{TV_W=null;return tvTiltRate()}finally{pertAcc=f}})()`, 'INJECTED throw in pertAcc (takes no input)'],
  ['bodyOmega (sim/core.js)', `(()=>{const f=lockTh;delete SELENE.lockW;try{lockTh=()=>{throw new Error('injected')};return bodyOmega(SELENE)}finally{lockTh=f}})()`, 'NOT DEMONSTRATED: lockTh is a const, cannot inject; pure body math, no input can throw'],
  ['entryDirect (sim/space.js)', `(()=>{const f=bodyPos;try{bodyPos=()=>{throw new Error('injected')};return entryDirect(${good},1000,[SELENE.R+2000e3,0,0])}finally{bodyPos=f}})()`, 'NOT DEMONSTRATED: bodyPos is a const, cannot inject; pure body math'],
  ['thAbs (sim/rovers.js)', `(()=>{const f=lockTh;try{lockTh=()=>{throw new Error('injected')};return thAbs(SELENE,1000)}finally{lockTh=f}})()`, 'NOT DEMONSTRATED: lockTh is a const, cannot inject; pure body math'],
  // the guarded ones, for contrast
  ['cruiseNext (guarded)', `cruiseNext(${bad},1000)`, 'entry without r'],
  ['entryRelay (guarded)', `(()=>{PROG.sats=[${bad},${good}];try{return entryRelay(${good.replace('id:7', 'id:9')},1000,[SELENE.R+2000e3,0,0])}finally{PROG.sats=[]}})()`, 'a relay entry without r'],
];
for (const [name, code, how] of cases) {
  ev(`ORB_T0=${T0};simT=${ST}`); let threw = 'no throw';
  try { ev(code); } catch (e) { threw = 'threw ' + e.constructor.name + ': ' + String(e.message).slice(0, 50); }
  const o = ev('ORB_T0'), t = ev('simT');
  console.log(`${name.padEnd(28)} ${how}\n    ${threw}\n    ORB_T0 after: observed ${o}  expected ${T0}   simT after: observed ${t}  expected ${ST}   ${o === T0 && t === ST ? 'OK' : '<-- LEFT WRONG'}`);
}
// what a stuck ORB_T0 = 0 breaks: every moon's phase and Selene's facing are read as bodyRel(b, t + ORB_T0)
ev(`ORB_T0=${T0};simT=${ST}`);
const pS = ev('bodyRel(SELENE,simT)[0]'), pN = ev('bodyRel(NYX,simT)[0]'), th = ev('bodyTheta(SELENE,simT)');
ev(`S=newShip(PRESETS.Probe);{const p=bodyRel(SELENE,simT),d=[0.9*soiAt(SELENE,simT),0,0];Object.assign(S,{alive:true,landed:false,body:TELLUS,throttle:0,r:add(p[0],d),v:p[1]})}`);   // Tellus-frame state just inside Selene's SOI
ev('ORB_T0=0');
const qS = ev('bodyRel(SELENE,simT)[0]'), qN = ev('bodyRel(NYX,simT)[0]'), th2 = ev('bodyTheta(SELENE,simT)');
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
console.log(`\nconsequence, flight on day 100 at t=${ST} s, ORB_T0 dropped from ${T0} to 0:`);
console.log(`  Selene is read ${(d(pS, qS) / 1e3).toFixed(0)} km from where it was (its orbit radius ~${(Math.hypot(...pS) / 1e3).toFixed(0)} km); Nyx ${(d(pN, qN) / 1e3).toFixed(0)} km`);
console.log(`  Selene's facing (bodyTheta) jumps ${(((th2 - th) * 180 / Math.PI % 360 + 360) % 360).toFixed(1)} deg: every landed site and the ground under an orbiter move with it`);
ev('checkSOI(S)');
console.log(`  a craft that was inside Selene's SOI (Tellus frame, about to be captured): body after checkSOI = ${ev('S.body.name')}  (with the right ORB_T0: Selene)`);
