// R23b: fleetRails(v,dt) = rails(v,dt), and if rails stopped early (the air's top / 5 km floor, or the 4000-step cap)
// the rest of dt is one plain kepler() call: no air, no ground, no SOI test, no tide.
// Run: node r23b.mjs
import { makeSim } from './sim.mjs';
const ev = makeSim();
const msgs = []; ev('HOOK').msg = m => msgs.push(m);
const setup = (pe) => ev(`simT=0;FLEET.length=0;
  S=newShip(PRESETS.Probe);{const r=TELLUS.R+2000e3;Object.assign(S,{alive:true,landed:false,body:TELLUS,throttle:0,r:[r,0,0],v:[0,0,-Math.sqrt(TELLUS.mu/r)]})};S.rec.launched=true;
  {const v=newShip(PRESETS.Probe),ra=TELLUS.R+400e3,rp=TELLUS.R+(${pe}),a=(ra+rp)/2,va=Math.sqrt(TELLUS.mu*(2/ra-1/a));
   Object.assign(v,{alive:true,landed:false,body:TELLUS,throttle:0,r:[0,0,ra],v:[va,0,0],fleet:true,name:'Lander'});v.rec={launched:true,day0:0,mini:true};FLEET.push(v)}`);
const alt = () => ev('len(FLEET[0].r)-TELLUS.R');
console.log('Tellus: R', ev('TELLUS.R'), 'air top', ev('TELLUS.atm'), '; S in a 2000 km orbit, a second vessel (FLEET[0]) at 400 km apoapsis with its periapsis below the ground');
for (const [pe, dt] of [[-300e3, 1667], [-300e3, 2400], [-300e3, 3000], [-300e3, 10000], [30e3, 3000]]) {
  setup(pe); msgs.length = 0;
  const ok0 = ev('flightRailsOK()'), a0 = alt(), e0 = ev('(()=>{const v=FLEET[0];return dot(v.v,v.v)/2-TELLUS.mu/len(v.r)})()');
  const ok = ev(`advRails(S,${dt},100000)`), v = ev('FLEET[0]'), a1 = alt(), e1 = ev('(()=>{const v=FLEET[0];return dot(v.v,v.v)/2-TELLUS.mu/len(v.r)})()');
  console.log(`\nperiapsis ${pe / 1e3} km, one advRails(S, ${dt} s, warp 100000)  [flightRailsOK before: ${ok0}]`);
  console.log(`  FLEET[0]: altitude ${(a0 / 1e3).toFixed(1)} km -> ${(a1 / 1e3).toFixed(1)} km, alive=${v.alive}, landed=${v.landed}, orbital energy change ${(e1 - e0).toExponential(2)} J/kg (0 = no drag felt), advRails returned ${ok}, flightRailsOK after: ${ev('flightRailsOK()')}, msgs: ${JSON.stringify(msgs)}`);
  // what the next frames do with it (physics, since flightRailsOK is false below the air's top)
  if (a1 < ev('TELLUS.atm')) { for (let i = 0; i < 200 && ev('FLEET.length&&FLEET[0].alive'); i++) ev('advPhys(S)'); console.log('  then 200 physics steps: FLEET =', ev('FLEET.length'), 'vessels;', JSON.stringify(msgs.slice(-2))); }
}
console.log('\nexpected in every case: the vessel stops at the air\'s top (100 km) for physics to fly the entry, or is destroyed/landed at the ground; never below 0 km alive, never out the far side');
// the SOI half: a fleet vessel in low Selene orbit hits rails' 4000-step cap; the rest is plain Kepler
ev(`simT=0;FLEET.length=0;S=newShip(PRESETS.Probe);{const r=TELLUS.R+2000e3;Object.assign(S,{alive:true,landed:false,body:TELLUS,throttle:0,r:[r,0,0],v:[0,0,-Math.sqrt(TELLUS.mu/r)]})};S.rec.launched=true;
  {const v=newShip(PRESETS.Probe),r=SELENE.R+30e3;Object.assign(v,{alive:true,landed:false,body:SELENE,throttle:0,r:[r,0,0],v:[0,0,-Math.sqrt(SELENE.mu/r)],fleet:true,name:'Selene probe'});v.rec={launched:true,day0:0,mini:true};FLEET.push(v)}`);
const A = ev(`(()=>{const v=FLEET[0],t0=simT,r0=v.r.slice(),v0=v.v.slice();rails(v,86400);const el=simT-t0;simT=t0;v.r=r0;v.v=v0;return el})()`);
console.log(`\nSelene probe at 30 km: rails(v,86400) alone advances ${A.toFixed(0)} s (the 4000-step cap); fleetRails finishes the other ${(86400 - A).toFixed(0)} s as one kepler() call (no tide, no SOI test)`);
// reference: same vessel as S, rails called until the full day has passed
const ref = ev(`(()=>{const v=FLEET[0],t0=simT,r0=v.r.slice(),v0=v.v.slice();let g=0;while(simT<t0+86400-1e-6&&g++<50)rails(v,t0+86400-simT);const out=v.r.slice();simT=t0;v.r=r0;v.v=v0;return out})()`);
ev('fleetRails(FLEET[0],86400)'); const got = ev('FLEET[0].r');
console.log(`  position after a day: fleetRails vs tide-stepped rails differ by ${(Math.hypot(got[0] - ref[0], got[1] - ref[1], got[2] - ref[2]) / 1e3).toFixed(2)} km`);
