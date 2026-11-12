// R23c: rails() returns true after its 4000-step guard cut the advance short; advRails then ticks some clocks by the
// requested dt and others by the elapsed time.
// Run: node r23c.mjs
import { makeSim } from './sim.mjs';
const ev = makeSim();
const msgs = []; ev('HOOK').msg = m => msgs.push(m);
const mk = `simT=0;FLEET.length=0;debris.length=0;S=newShip(PRESETS.Probe);{const r=SELENE.R+30e3;Object.assign(S,{alive:true,landed:false,body:SELENE,throttle:0,r:[r,0,0],v:[0,0,-Math.sqrt(SELENE.mu/r)]})};S.rec.launched=true`;
ev(mk);
console.log('rails(S,86400) at 30 km over Selene: returns', ev('rails(S,86400)'), ', simT advanced', ev('simT').toFixed(1), 's of 86400  (expected: 86400, or false)');
// --- the clocks in advRails
// a holed tank: leakTick(s,dt,false) is called from missionTick(s,dt,false) with the REQUESTED dt
ev(mk);
ev(`{const p=S.parts.find(p=>p.on&&p.res&&p.res.fuel>0);globalThis.__p=p;p.res.fuel=p.cap.fuel;S.leaks=[{p,k:'fuel',A:Math.PI*0.002*0.002/4,n:[1,0,0]}]}`);
const rate = ev('leakRate(__p,"fuel",S.leaks[0].A)'), f0 = ev('__p.res.fuel');
const bat0 = ev('JSON.stringify(S.pow||null)');
const ok = ev('advRails(S,86400,100000)'), el = ev('simT'), f1 = ev('__p.res.fuel');
console.log(`\nadvRails(S,86400,100000) returned ${ok}; simT advanced ${el.toFixed(1)} s`);
console.log(`leak: a 2 mm hole, ${rate.toFixed(4)} kg/s; tank ${(f0 * 1000).toFixed(1)} kg -> ${(f1 * 1000).toFixed(1)} kg`);
console.log(`  leaked observed ${((f0 - f1) * 1000).toFixed(2)} kg = rate x ${(((f0 - f1) * 1000) / rate).toFixed(0)} s;  expected rate x elapsed ${el.toFixed(0)} s = ${(rate * el).toFixed(2)} kg  (${(((f0 - f1) * 1000) / (rate * el)).toFixed(3)}x too much)`);
// instrument: which dt each sub-clock receives
ev(mk);
ev(`globalThis.__log=[];{const w=(n,f)=>(...a)=>{__log.push([n,a[1]]);return f(...a)};const pr=powerRails,mt=missionTick;powerRails=w('powerRails',pr);missionTick=w('missionTick',mt)}`);
let wrapped = true; try { ev('advRails(S,86400,100000)'); } catch (e) { wrapped = false; console.log('(could not wrap: functions are const-bound:', e.message, ')'); }
if (wrapped) console.log('dt each clock got:', JSON.stringify(ev('__log')), ' elapsed', ev('simT').toFixed(1));
// --- can the live loop get there? dt per frame <= 0.1 s x 100000 = 10000 s; the cap bites when dt > 4000 x hP
console.log('\nlive loop: per-frame dt is at most dtR(<=0.1 s) x 100000 = 10000 s; at 60 Hz 1667 s');
for (const [name, body, alt] of [['Selene 30 km', 'SELENE', 30e3], ['Selene 6 km', 'SELENE', 6e3], ['Nyx 6 km', 'NYX', 6e3], ['Nyx 30 km', 'NYX', 30e3], ['Tellus 150 km', 'TELLUS', 150e3], ['Tellus 3000 km', 'TELLUS', 3000e3]]) {
  const o = ev(`(()=>{const b=${body},r=[b.R+${alt},0,0],v=[0,0,-Math.sqrt(b.mu/(b.R+${alt}))],el=elements(r,v,b.mu),P=coastPlan(b,r,v,0,el,b.R+physAlt(b));return{hP:P.hP,per:el.period}})()`);
  console.log(`  ${name.padEnd(15)} period ${o.per.toFixed(0)} s, step cap hP ${o.hP === Infinity ? 'none (exact Kepler)' : o.hP.toFixed(2) + ' s'} -> most one rails() call can advance: ${o.hP === Infinity ? 'any' : (4000 * o.hP).toFixed(0) + ' s'}`);
}
// near a moon while orbiting Tellus: hP = 0.02*sqrt(dP^3/mu_moon); cap bites at 10000 s when hP < 2.5 s
for (const m of ['SELENE', 'NYX']) console.log(`  orbiting Tellus near ${m}: hP<2.5 s needs distance to it < ${(Math.cbrt((2.5 / 0.02) ** 2 * ev(m + '.mu')) / 1e3).toFixed(0)} km; its SOI is ${(ev(`soiAt(${m},0)`) / 1e3).toFixed(0)} km, its radius ${(ev(m + '.R') / 1e3).toFixed(0)} km`);
// other callers
console.log('\nheadless callers: procFly calls advRails(s, <=600 s), tape replay repeats the recorded dt; fleetRails(v, el) can pass a whole elapsed span');
