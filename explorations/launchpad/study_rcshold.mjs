// RCS hold study (vehicle session, QUEUE Q632, PLAYTEST #169): gas per hour of SAS holding with RCS on and nothing pressed.
// The Docking craft beside the tester's dummy at 300 km, turned onto each SAS mode's target on the tester's endless gas
// (120 s), then held; with its wheels, and with them taken out (ONLY=w or ONLY=nw for one half).
// usage: node study_rcshold.mjs [minutes, default 60]   (notes/vehicle.md § v1.375)
import { pageSource } from './page.mjs';
const MIN = +(process.argv[2] || 60);
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const mk = () => { const ev = new Function(src + '\nreturn c=>eval(c);')(); ev('HOOK.msg=()=>{};HOOK.news=()=>{}'); return ev; };
const ONLY=process.env.ONLY;const cases0 = [
  ['Docking', 'stab', false], ['Docking', 'pro', false], ['Docking', 'tgt', false], ['Docking', 'dock', false],
  ['Docking', 'stab', true], ['Docking', 'pro', true], ['Docking', 'tgt', true], ['Docking', 'dock', true],
];const cases=ONLY?cases0.filter(c=>ONLY==='nw'?c[2]:!c[2]):cases0;
console.log('DT', mk()('DT'));
for (const [preset, mode, noWheels] of cases) {
  const ev = mk();
  ev(`simT=0;S=newShip(PRESETS[${JSON.stringify(preset)}]);globalThis.__pl=placeCraft(S,{body:'Tellus',where:'beside',alt:300e3,inc:0,target:'dummy',T:0});
    S.throttle=0;S.sas=true;S.sasMode=${JSON.stringify(mode)};S.rcs=true;${noWheels ? 'for(const p of S.parts)if(p.d.torque)p.d=Object.assign({},p.d,{torque:0});geom(S);' : ''}
    globalThis.__g=()=>S.parts.reduce((a,p)=>a+(p.on&&p.res&&p.res.gas||0),0)*1000;
    globalThis.__run=(n)=>{let f=0,steps=0,on=0,maxW=0,maxE=0,dry=null;for(let i=0;i<n&&S.alive;i++){physStep(S,DT);f+=S.rcsFire;if(S.rcsFire)on++;steps++;if(dry==null&&__g()<0.05)dry=steps*DT/60;
      maxW=Math.max(maxW,len(S.w));const Y=qrot(S.q,[0,1,0]),tg=sasTarget(S);if(tg&&!tg.q)maxE=Math.max(maxE,Math.acos(Math.min(1,dot(Y,tg))))}
      return {f,steps,on,maxW,maxE,dry}}`);
  const info = ev(`({pl:JSON.stringify(__pl),tgt:S.tgt,quads:S.parts.filter(p=>p.on&&p.d.kind==='rcs').length,torque:S.torque,cap:rcsTauCap(S),mass:S.mass,I:S.I.map(x=>+x.toFixed(0))})`);
  // settle 120 s, then measure
  ev(`TEST.on=TEST.fuel=true;__run(Math.round((+process.env.SETTLE||120)/DT));TEST.on=TEST.fuel=false`);   // settle on the tester's endless gas
  const g0 = ev('__g()');
  const r = ev(`__run(Math.round(${MIN * 60}/DT))`);
  const used = g0 - ev('__g()');
  console.log(`${preset} ${mode}${noWheels ? ' no wheels' : ''}: quads ${info.quads}, wheels ${info.torque} N·m, rcs cap ${info.cap.toFixed(0)} N·m, gas ${g0.toFixed(2)} kg`
    + ` | ${MIN} min: used ${used.toFixed(3)} kg (${(used * 60 / MIN).toFixed(3)} kg/h), nozzle firings ${r.f}, steps firing ${r.on}/${r.steps} (${(100 * r.on / r.steps).toFixed(1)} %), max |w| ${(r.maxW * 180 / Math.PI).toFixed(3)} °/s, max err ${(r.maxE * 180 / Math.PI).toFixed(3)}°${r.dry != null ? ' · DRY at ' + r.dry.toFixed(1) + ' min' : ''}`);
}
