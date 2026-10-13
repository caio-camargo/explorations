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
function cockpit(){const ph=cpPhase(),n=$('news');if(n)n.classList.toggle('held',!!ph);
  let m=$('mcau');if(!m){m=document.createElement('div');m.id='mcau';m.className='hidden';(document.getElementById('hud')||document.body).appendChild(m)}
  const L=cautions(),txt=L.length?`<b>MASTER CAUTION</b> ${L.join(' · ')}`:'';
  if(m.innerHTML!==txt)m.innerHTML=txt;m.classList.toggle('hidden',!L.length);
  if(L.length){const tl=document.querySelector('#hud .tl'),r=tl&&tl.getBoundingClientRect();if(r&&r.width){m.style.left=`${Math.round(r.left)}px`;m.style.top=`${Math.round(r.bottom+6)}px`;m.style.width=`${Math.round(r.width)}px`}}}
