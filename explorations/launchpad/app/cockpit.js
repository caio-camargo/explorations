// app/cockpit.js — the flight's dark cockpit (flow session, QUEUE Q286 slice 1; UI.md § 3 Flight row, D16). A classic
// script sharing one global scope with the others; index.html loads it after hud.js. 'use strict';
'use strict';
// While something critical is happening (the climb through the air, a burn, a landing) the screen keeps quiet: the news
// ticker is held (it comes back, with what arrived meanwhile, once things are quiet), the cards that aren't the phase's
// fold away unless pinned, and one MASTER CAUTION under the readout names whatever is red. Hold modes the vessel can't fly
// aren't shown (editor.js renderSAS); Ap · Pe isn't shown landed, and reads "under the surface" when it is (program-ui.js).
// updateHUD calls cockpit() after the cards.
// the phase: 'ascent' (in the air, climbing or burning), 'burn' (an engine lit out of the air), 'landing' (coming down
// through the air or low over an airless body), or null (quiet)
function cpPhase(){if(mode!=='flight'||!S||!S.alive||S.landed||!S.rec||!S.rec.launched)return null;
  const low=ascentOn(),down=dot(S.v,S.r)<0;
  if(S.thrust>0)return low&&!down?'ascent':low?'landing':'burn';
  return low?(down?'landing':'ascent'):null}
const CP_CARDS=['ascent','descent','target'];   // the phase's cards: everything else folds away in a critical phase unless pinned
// what's red right now, in words: the master caution's reasons
function cautions(){const L=[];if(mode!=='flight'||!S||!S.alive)return L;const pc=x=>`${(x*100).toFixed(0)}%`;
  if(S.hot&&S.hot.T>S.hot.d.Tmax*.9)L.push(`heat: the ${S.hot.d.name} at ${pc(S.hot.T/S.hot.d.Tmax)} of its limit`);
  const p=S.maxLoadP;if(p&&p.on&&p.sk1&&p.parent){const c=S.maxLoad/Math.min(certOf(p.sk1),certOf(p.sk2));if(c>1)L.push(`structure: ${p.d.name} / ${p.parent.d.name} at ${pc(c)} of its rating`)}
  if(S.rangeWarn&&S.rangeWarn.city)L.push(`range safety: the impact point is over ${S.rangeWarn.city.name}`);
  return L}
// (QUEUE Q271, PLAYTEST #71; W36's default) HEAT and LOAD beside the navball, in every phase: the hottest part against its
// limit and the most loaded joint against its certified rating. Faint under 50 %, amber from 50 %, red from 90 %;
// the title names the part. The master caution blinks for three seconds when its reasons change.
function hlFracs(){if(mode!=='flight'||!S||!S.alive)return{heat:0,load:0};const p=S.maxLoadP;
  return{heat:S.hot?S.hot.T/S.hot.d.Tmax:0,hp:S.hot&&S.hot.d.name,load:p&&p.on&&p.sk1&&p.parent?S.maxLoad/Math.min(certOf(p.sk1),certOf(p.sk2)):0,lp:p&&p.parent?`${p.d.name} / ${p.parent.d.name}`:''}}
const hlCls=x=>x>=.9?'bad':x>=.5?'warn':'';
function hlGauges(){const F=hlFracs();for(const[id,x,who,what]of[['gHeat',F.heat,F.hp,'of its heat limit'],['gLoad',F.load,F.lp,'of its certified rating']]){const g=$(id);if(!g)continue;
  const h=`${Math.round(Math.min(1,Math.max(0,x))*100)}%`,c=hlCls(x);if(g.firstChild.style.height!==h)g.firstChild.style.height=h;if(g.className!==`g ${c}`.trim())g.className=`g ${c}`.trim();
  const t=`${id==='gHeat'?'HEAT':'LOAD'}: ${who?`${who}, ${Math.round(x*100)}% ${what}`:'nothing yet'}`;if(g.title!==t)g.title=t}}
let mcPrev='';
function cockpit(){const ph=cpPhase(),n=$('news');if(n)n.classList.toggle('held',!!ph);depHint();turnHint();circHint();hlGauges();
  let m=$('mcau');if(!m){m=document.createElement('div');m.id='mcau';m.className='hidden';(document.getElementById('hud')||document.body).appendChild(m)}
  const L=cautions(),txt=L.length?`<b>MASTER CAUTION</b> ${L.join(' · ')}`:'';
  if(m.innerHTML!==txt){m.innerHTML=txt;if(txt&&L.join()!==mcPrev){m.classList.remove('new');void m.offsetWidth;m.classList.add('new')}mcPrev=L.join()}m.classList.toggle('hidden',!L.length);
  if(L.length){const tl=document.querySelector('#hud .tl'),r=tl&&tl.getBoundingClientRect();if(r&&r.width){m.style.left=`${Math.round(r.left)}px`;m.style.top=`${Math.round(r.bottom+6)}px`;m.style.width=`${Math.round(r.width)}px`}}}
// (QUEUE Q400, PLAYTEST #97) the first time a craft with folded parts is out of the thick air and nothing critical is
// happening, say once how they deploy, and light the button for a few seconds. Once per browser (a convenience).
const DEP_HINT_KEY='launchpad-hint-deploy';let depHinted=(()=>{try{return localStorage.getItem(DEP_HINT_KEY)==='1'}catch(e){return false}})(),depHintT=0;
function depHintDue(){if(depHinted||mode!=='flight'||!S||!S.alive||S.landed||!S.rec||!S.rec.launched||cpPhase())return null;const b=S.body,h=len(S.r)-b.R;
  if(b.atm&&h<b.atm)return null;
  const fold=S.parts.some(p=>p.on&&unfolds(p.d)&&!p.dep&&!(p.inFair&&!p.inFair.fj)),bay=S.parts.some(p=>p.on&&p.d.kind==='bay'&&!p.open);
  return fold?{id:'bWings',t:'Folded parts aboard: P unfolds them, or the Unfold button at the top right.'}:bay?{id:'bBay',t:'The bay is shut: B opens it, or the Open bay button at the top right.'}:null}
function depHint(){const H=depHintDue();if(H){depHinted=true;try{localStorage.setItem(DEP_HINT_KEY,'1')}catch(e){}HOOK.msg(H.t);const b=$(H.id);if(b){b.classList.add('hint');depHintT=performance.now()}}
  if(depHintT&&performance.now()-depHintT>6000){depHintT=0;for(const id of['bWings','bBay']){const b=$(id);if(b)b.classList.remove('hint')}}}
// (QUEUE Q434, PLAYTEST #109) teach the gravity turn. On a hand-flown climb through the air by a rocket that could make orbit
// (2.5 km/s or more in vacuum), once it's moving: how to turn; if the nose is still straight up when the profile is past 75°,
// once more. Until a flight from this browser has flown it (apoapsis out of the air with 1 km/s across the ground).
const TURN_HINT_KEY='launchpad-hint-turn';let turnLearnt=(()=>{try{return localStorage.getItem(TURN_HINT_KEY)==='1'}catch(e){return false}})(),turnHintS=null,turnHintN=0;
function turnHintDue(){if(turnLearnt||mode!=='flight'||!S||!S.alive||S.proc||!S.rec||!S.rec.launched)return null;
  if(turnHintS!==S){turnHintS=S;turnHintN=dvPlan(S,0).reduce((a,x)=>a+x.dv,0)<2500?2:0}   // a sounding rocket: no turn to teach
  const b=S.body,f=localFrame(S.r),vs=sub(S.v,surfVel(b,S.r)),across=len(sub(vs,mul(f.up,dot(vs,f.up))));
  if(b.atm&&elements(S.r,S.v,b.mu).ap-b.R>b.atm&&across>1000){turnLearnt=true;try{localStorage.setItem(TURN_HINT_KEY,'1')}catch(e){}return null}
  const g=turnGuide(S);if(!g||g.ph!=='climb'||turnHintN>=2)return null;
  const pro=sasModeOK(S,'pro');   // the gyro autopilot (a new program's) has no Prograde: the player flies the ◇ with W
  if(turnHintN===0&&len(vs)>30)return pro?'To reach orbit, turn: by about 100 m/s tap W to lean the nose a few degrees east, then pick SAS Prograde and let it fall over. Keep the nose near the ◇ on the navball.'
    :'To reach orbit, turn: by about 100 m/s tap W to lean the nose a few degrees east, and keep tapping W to keep it on the ◇ on the navball (the autopilot holds wherever you leave it).';
  if(turnHintN===1&&g.nose>85&&g.p<75)return pro?'Still straight up: that falls back down. Tap W to lean toward the ◇ on the navball, then Prograde.':'Still straight up: that falls back down. Tap W to bring the nose down to the ◇ on the navball.';
  return null}
function turnHint(){const t=turnHintDue();if(t){turnHintN++;HOOK.msg(t);msgTimer=10}}   // ten seconds to read it
// (QUEUE Q485, PLAYTEST #121) and the end of the climb: once the apoapsis is out of the air, coast to it; at it, burn on the ◇.
// One message for each per flight, until a flight from this browser has made orbit by hand (its periapsis out of the air).
const CIRC_HINT_KEY='launchpad-hint-circ';let circLearnt=(()=>{try{return localStorage.getItem(CIRC_HINT_KEY)==='1'}catch(e){return false}})(),circS=null,circSaid='';
function circHintDue(){if(circLearnt||mode!=='flight'||!S||!S.alive||S.proc||!S.rec||!S.rec.launched)return null;
  if(circS!==S){circS=S;circSaid=''}const b=S.body;if(!b.atm)return null;const g=turnGuide(S);
  if(!g){if(circSaid&&circSaid!=='done'&&!S.landed){const el=elements(S.r,S.v,b.mu);if(el.e<1&&el.pe-b.R>b.atm){circLearnt=true;try{localStorage.setItem(CIRC_HINT_KEY,'1')}catch(e){}circSaid='done';
    return'In orbit: the periapsis is out of the air. X cuts the engine.'}}return null}
  if(g.ph==='coast'&&!circSaid){circSaid='coast';return S.thrust>0?'The apoapsis is out of the air: X cuts the engine. Coast up to it; the ◇ waits on the horizon, and the navball says when to burn.'
    :'The apoapsis is out of the air: coast up to it. Point the nose at the ◇ on the horizon; the navball says when to burn.'}
  if(g.ph==='burn'&&circSaid!=='burn'){circSaid='burn';return`Burn now: full throttle (Z) on the ◇ until the periapsis is out of the air, about ${Math.round(g.dv)} m/s.`}
  return null}
function circHint(){const t=circHintDue();if(t){HOOK.msg(t);msgTimer=10}}
