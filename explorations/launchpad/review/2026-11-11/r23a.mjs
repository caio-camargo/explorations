// R23a: rails' floor on an airless body is physAlt = 5000 m above b.R, whatever bodyTop(b) says.
// Run: node r23a.mjs
import { makeSim } from './sim.mjs';
const ev = makeSim();
ev('HOOK.msg=m=>console.log("   [msg] "+m)');
// (1) the real recipes' tops vs the 5 km floor
console.log('physAlt(SELENE) =', ev('physAlt(SELENE)'), ' (airless: fixed)');
console.log('recipe tops (m):', ev('JSON.stringify({selene:SELENE_GROUND.top,enyo:ENYO_GROUND.top,hesper:HESPER_GROUND.top,astraea:ASTRAEA_GROUND.top,theia:THEIA_GROUND.top,eos:EOS_GROUND.top,tethys:TETHYS_GROUND.top,phoebe:PHOEBE_GROUND.top,erebus:EREBUS_GROUND.top})'));
// sampled real maxima of two recipes (Fibonacci sphere, 20000 points)
ev(`globalThis.__fib=n=>{const o=[];for(let i=0;i<n;i++){const y=1-2*(i+.5)/n,r=Math.sqrt(1-y*y),a=i*2.399963229728653;o.push([r*Math.cos(a),y,r*Math.sin(a)])}return o}`);
for (const k of ['selene', 'enyo', 'hesper', 'theia']) { try { console.log(`sampled max of ${k}H over 20000 points:`, Math.round(ev(`Math.max(...__fib(20000).map(u=>GROUND_GEN.${k}(u)))`)), 'm'); } catch (e) { console.log(k, 'sample failed:', e.message); } }
// (2) the mechanism, on Selene with a recipe whose ground stands above 5 km (a 12 km plateau everywhere; top 15 km, Enyo's bound)
ev(`GROUND_GEN.plateau=()=>12000;SELENE.ground={gen:'plateau',top:15000}`);
ev(`simT=0;S=newShip(PRESETS.Probe);Object.assign(S,{alive:true,landed:false,body:SELENE,throttle:0,r:[SELENE.R+8000,0,0],v:[0,0,-Math.sqrt(SELENE.mu/(SELENE.R+8000))]});S.rec.launched=true`);
console.log('\nship: circular orbit 8 km above Selene\'s datum; ground under it at', ev('groundAlt(SELENE,toPF(SELENE,S.r,simT))'), 'm; bodyTop =', ev('bodyTop(SELENE)'));
console.log('aglAt (m)           observed', ev('aglAt(SELENE,S.r,simT)'), '  (the ship is 4 km inside the ground)');
console.log('railsWhy(S)         observed', JSON.stringify(ev('railsWhy(S)')), '  expected "near the ground"');
console.log('railsOK(S)          observed', ev('railsOK(S)'), '  expected false');
const ok = ev('rails(S,3600)');
console.log('rails(S,3600)       observed returns', ok, ', simT =', ev('simT'), ', alive =', ev('S.alive'), ', agl now', Math.round(ev('aglAt(SELENE,S.r,simT)')), 'm   expected: stop (false) at bodyTop, never coast under ground');
// what physics makes of the same state (so rails and physics disagree)
ev(`simT=0;S=newShip(PRESETS.Probe);Object.assign(S,{alive:true,landed:false,body:SELENE,throttle:0,r:[SELENE.R+8000,0,0],v:[0,0,-Math.sqrt(SELENE.mu/(SELENE.R+8000))]});S.rec.launched=true`);
for (let i = 0; i < 50 && ev('S.alive'); i++) ev('advPhys(S)');
console.log('same state on physics (advPhys ×50): alive =', ev('S.alive'), ' lossWhy =', ev('S.lossWhy'));
// (3) a fall: 14 km periapsis-crossing orbit, ground at 12 km. rails should hand over to physics at bodyTop (15 km), hands over at 5 km
ev(`simT=0;S=newShip(PRESETS.Probe);{const ra=SELENE.R+60e3,rp=SELENE.R+2e3,a=(ra+rp)/2,va=Math.sqrt(SELENE.mu*(2/ra-1/a));Object.assign(S,{alive:true,landed:false,body:SELENE,throttle:0,r:[ra,0,0],v:[0,0,-va]})};S.rec.launched=true`);
const ok2 = ev('rails(S,7200)');
console.log('\n60 km x 2 km orbit, ground a 12 km plateau: rails(S,7200) returns', ok2, 'after', ev('simT').toFixed(1), 's at altitude', Math.round(ev('len(S.r)-SELENE.R')), 'm, agl', Math.round(ev('aglAt(SELENE,S.r,simT)')), 'm, alive', ev('S.alive'));
console.log('   expected: stop near', ev('bodyTop(SELENE)'), 'm (above the highest ground), agl > 0');
