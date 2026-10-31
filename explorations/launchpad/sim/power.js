// sim/power.js — electric power: batteries, solar cells and wings, the loads, the onboard computer. Part of index.html's script
// (launchpad NOTES § "Vehicle parts", Q34a; vehicle session, 2026-10-09): a classic script sharing one global scope with the others.
'use strict';
// ---- the model. A vessel has one store, s.E (J), up to the batteries on board (a probe core has 0.5 kWh of its own); the loads
// (W on parts) draw on it, the panels fill it while the vessel is out of its body's shadow. Crew capsules run on their own fuel
// cells, so they draw nothing here. Running flat never kills (ROADMAP pillar 5): the onboard computer goes off, so the SAS falls
// back to the analog autopilot, until the panels catch up. The antenna and camera loads count in the budget; what a flat
// battery does to their service is the space lane's (Q27, Q50), not done here.
Object.assign(PARTS.ant,{W:5});Object.assign(PARTS.cam,{W:10});Object.assign(PARTS.core,{kWh:0.5});for(const k of['core6','core3'])if(PARTS[k])PARTS[k].kWh=+(0.5*PARTS[k].sc**2).toPrecision(3);   // the small cores' own (Q505)
// every antenna and camera draws, the side forms and the boom antenna too (vehicle, 2026-10-13: they drew nothing, so a satellite
// built from them showed a 0 W load)
for(const k in PARTS){const d=PARTS[k];if(d.W==null&&(d.kind==='ant'||d.kind==='cam'))d.W=PARTS[d.kind].W}
const KWH=3.6e6,SOL_BODY=0.32,SOL_WING=0.9;   // cells on a skin average ~a third of full sun; a wing on its own arm loses ~10 %
// a docked composite is one store (space, Q304): the passengers' (s.att, sim/space.js) batteries, loads, RTGs and cells
// count with the vessel's own. A passenger's parts are its registry shape; its wings are out unless it was left with
// them folded (its vst.dep), and its cells see the sun through its attitude on the vessel (a.q).
function powEach(s,f){for(const p of s.parts)if(p.on)f(p.d,p,null);
  for(const a of s.att||[]){const e=a.e,dep=e.vst&&e.vst.dep;for(const o of e.shape||[]){const d=PARTS[o.k];if(d)f(d,{dep:!dep||dep.includes(o.oi??o.i),phi:o.phi,dmg:o.dmg},a.q)}}}
const powCap=s=>{let E=0;powEach(s,d=>{if(d.kWh)E+=d.kWh*KWH});return E};
const powLoad=s=>{let W=0;powEach(s,d=>{if(d.W)W+=d.W});return W};
const powRTG=s=>{let W=0;powEach(s,d=>{if(d.Wg)W+=d.Wg});return W};   // RTGs: the same day and night (Q131)
// what the panels give in full sun from direction u (the vessel's own frame): body cells their average share; a deployed wing
// turns about its arm (the mount's outward normal n) to face the sun as well as that allows, so √(1 − (n·u)²) of its best
function powSun(s,u){let W=0;powEach(s,(d,p,aq)=>{if(d.kind!=='solar')return;const k=d.Wp*(1-(p.dmg||0));
    if(d.body)W+=k*SOL_BODY;else if(p.dep){const v=aq?qrot(qconj(aq),u):u,a=p.phi||0,c=Math.cos(a)*v[0]+Math.sin(a)*v[2];W+=k*SOL_WING*Math.sqrt(Math.max(0,1-c*c))}});
  return W}
// the best the panels can give (wings square to the sun): what the steady state assumes
const powPeak=s=>{let W=0;powEach(s,(d,p)=>{if(d.kind==='solar')W+=d.Wp*(1-(p.dmg||0))*(d.body?SOL_BODY:SOL_WING)});return W};
// what a passenger brings to the store when it docks, and its share when it leaves (by battery capacity)
const battCap=e=>(e.shape||[]).reduce((a,o)=>a+((PARTS[o.k]||{}).kWh||0)*KWH,0)+(e.attached||[]).reduce((a,x)=>a+battCap(x.e),0);
function storeOf(e){const c=battCap(e);return e._v?Math.min(c,e._v.E??c):e.pw&&e.Ewh!=null?Math.min(c,e.Ewh*3600):e.vst&&e.vst.E!=null?Math.min(c,e.vst.E):c}
// in the body's shadow: a cylinder behind it (the sun is fixed in the absolute frame, SUN_DIR, and far)
function inShadow(b,r){const d=dot(r,SUN_DIR);return d<0&&len(sub(r,mul(SUN_DIR,d)))<b.R}
// the share of a circular orbit of radius r spent in that shadow, its plane at beta to the sun: none once the sun is high
// enough over the plane, else the arc whose distance from the shadow's axis is under R
function eclFrac(R,r,beta=0){if(r<=R)return 0.5;const sb=Math.abs(Math.sin(beta));if(R/r<=sb)return 0;
  return Math.acos(Math.min(1,Math.sqrt(r*r-R*R)/(r*Math.cos(beta))))/Math.PI}
const hasComputer=s=>s.parts.some(p=>p.on&&p.d.crew)||!s.pwrOut&&s.parts.some(p=>p.on&&p.d.kind==='comp');
// the avionics a vessel can use (avOf takes the lower of this and what it launched with): with no program running, with the
// tester's tools, or with a computer on board, everything; otherwise one generation short of the guidance computer
const avCap=s=>!khOn()||TEST.tools||!s.parts||hasComputer(s)?AV.length-1:AV.length-2;
function powFlat(s,out){if(out===!!s.pwrOut)return;s.pwrOut=out;const comp=s.parts.some(p=>p.on&&p.d.kind==='comp');
  HOOK.msg(out?`Power flat${comp?': the onboard computer is off, analog autopilot only, until the panels catch up':''}`:'Power back')}
// one physics step: the store, from the sun right now; a deployed wing in thick air tears off
function powerStep(s,dt){if(!s.alive)return;
  for(const p of s.parts.filter(p=>p.on&&p.dep&&p.d.qMax&&s.qdyn>p.d.qMax)){if(!p.on)continue;HOOK.msg(`${p.d.name} torn off at ${(s.qdyn/1000).toFixed(1)} kPa`);partLost(s,p)}
  s.Emax=powCap(s);if(s.E==null)s.E=s.Emax;const use=powLoad(s);
  const gen=(inShadow(s.body,s.r)?0:powSun(s,qrot(qconj(s.q),SUN_DIR)))+powRTG(s);s.pGen=gen;s.pUse=use;
  s.E=clamp(s.E+(gen-use)*dt,0,s.Emax);powFlat(s,s.E<=0&&gen<use)}
// a rails step: short ones like a physics step; long ones on the orbit's average (its share in shadow from the elements)
function powerRails(s,dt){if(!s.alive||dt<=0)return;if(dt<=60){const q=s.qdyn;s.qdyn=0;powerStep(s,dt);s.qdyn=q;return}
  s.Emax=powCap(s);if(s.E==null)s.E=s.Emax;const use=powLoad(s),b=s.body,r=len(s.r),h=cross(s.r,s.v),hl=len(h);
  const v2=dot(s.v,s.v),a=1/(2/r-v2/b.mu),beta=hl>0?Math.asin(clamp(dot(h,SUN_DIR)/hl,-1,1)):0;
  const ecl=s.landed||!(a>0)?(inShadow(b,s.r)?1:0):eclFrac(b.R,a,beta),gen=powSun(s,qrot(qconj(s.q),SUN_DIR))*(1-ecl)+powRTG(s);
  s.pGen=gen;s.pUse=use;s.E=clamp(s.E+(gen-use)*dt,0,s.Emax);powFlat(s,s.E<=0&&gen<use)}
// the steady state for a design in a circular orbit (default: Tellus, 10 km above the air), its plane at beta to the sun:
// average generation (panels and RTGs) against the load, and the battery needed to cross one shadow on what the RTGs don't cover
function powerBudget(s,o={}){const b=o.body||TELLUS,r=o.r||b.R+(b.atm||0)+10000,beta=o.beta||0,ecl=eclFrac(b.R,r,beta),T=2*Math.PI*Math.sqrt(r*r*r/b.mu);
  const peak=powPeak(s),rtg=powRTG(s),use=powLoad(s),avg=peak*(1-ecl)+rtg,tE=ecl*T,needWh=Math.max(0,use-rtg)*tE/3600,battWh=powCap(s)/3600;
  return{peak,rtg,use,avg,ecl,T,tE,needWh,battWh,alt:(r-b.R)/1000,ok:avg>=use&&battWh>=needWh}}
// solar wings out ('out') or folded ('in'): instant for now (the look beat can animate them)
// a boom antenna (fold, Q337) unfolds and folds with them
const unfolds=d=>!!(d.wing||d.fold);
// inside a fairing that's still on (the shell not jettisoned, the fairing not dropped) they stay folded (vehicle, Q410: they
// unfolded through it on the pad)
const encased=(s,p)=>{const f=p.inFair;return!!f&&f.on&&!!f.profF&&!f.fj};
function wingOp(s,op){const o=op==='out';let n=0,w=0,k=0;for(const p of s.parts)if(p.on&&unfolds(p.d)&&!!p.dep!==o){if(o&&encased(s,p)){k++;continue}p.dep=o;p.depT=simT;n++;if(p.d.wing)w++}
  if(n){HOOK.rebuild();const nm=w===n?'Solar wings':w?'Solar wings and antennas':'Antennas';HOOK.msg(`${nm} ${o?'out':'folded'}${k?` (${k} still inside the fairing)`:''}`)}
  else if(k)HOOK.msg(`Inside the fairing: jettison it first (stage), then unfold`);return n}
const wingsOut=s=>s.parts.some(p=>p.on&&unfolds(p.d)&&p.dep);
// ---- a registered satellite's power between flights (space session, QUEUE Q27; NOTES § v1.68's "what a flat battery does
// to their service is the space lane's"). At registration the entry keeps its steady state for its own orbit (q.pw, from
// powerBudget) and its charge (q.Ewh). A power-negative design drains its battery between flights; once flat it works
// only in sunlight, as far as its cells cover the load (a design with no cells goes quiet). A design whose battery can't
// cross an eclipse loses the rest of each one. satDuty(q) is the share of the time it can work: its service (imagery,
// TV, its link) scales with it. Entries saved before Q27 have no q.pw and work as before.
function satPowInit(s,q){const B=s.body,el=elements(s.r,s.v,B.mu);if(!(el.a>0)||!(el.e<1))return;
  const beta=el.hl>0?Math.asin(clamp(dot(el.h,SUN_DIR)/el.hl,-1,1)):0,b=powerBudget(s,{body:B,r:el.a,beta});if(!(b.use>0))return;
  q.pw={avg:b.avg,use:b.use,ecl:b.ecl,cap:b.battWh,need:b.needWh,peak:b.peak,rtg:b.rtg};q.Ewh=Math.min(b.battWh,(s.E??powCap(s))/3600)}
function satDuty(q){const w=q.pw;if(!w)return 1;
  if(w.avg>=w.use&&w.cap<w.need)return(1-w.ecl)+w.ecl*(w.need>0?w.cap/w.need:1);   // flat in each shadow
  if(q.Ewh>0)return 1;
  return clamp((1-w.ecl)*Math.min(1,(w.peak+w.rtg)/w.use)+w.ecl*Math.min(1,w.rtg/w.use),0,1)}   // flat: sunlight only
function satPowTick(d){for(const q of PROG.sats||[]){const w=q.pw;if(!w||q.junk)continue;const was=satDuty(q);
  q.Ewh=clamp(q.Ewh+(w.avg-w.use)*d*DAY_S/3600,0,w.cap);const k=satDuty(q);
  if(was>=1&&k<1)HOOK.news(k>0?`${q.name}'s batteries are flat: it works only in sunlight now, ${Math.round(k*100)} % of the time`:`${q.name}'s batteries are flat and it has no cells: it has gone quiet`,'warn')}}
// what registration news says about it (Q27): nothing if it holds; how long the battery lasts; or that it has no power
function satPowNote(q){const w=q.pw;if(!w||satDuty(q)<1&&q.Ewh>0)return'';if(w.avg>=w.use&&w.cap>=w.need)return'';
  if(w.cap<=0&&w.peak+w.rtg<=0)return'. It has no power of its own (no battery, no cells): it cannot work';
  if(w.avg<w.use){const d=q.Ewh/(w.use-w.avg)*3600/DAY_S;return`. Its battery lasts about ${d<1?'less than a day':Math.round(d)+' days'}; then ${satFlatShare(q)>0?`it works only in sunlight, ${Math.round(satFlatShare(q)*100)} % of the time`:'it goes quiet'} (solar cells would keep it going)`}
  return`. Its battery can't cross an eclipse: it's off for part of each one`}
const satFlatShare=q=>{const w=q.pw;return clamp((1-w.ecl)*Math.min(1,(w.peak+w.rtg)/w.use)+w.ecl*Math.min(1,w.rtg/w.use),0,1)};

