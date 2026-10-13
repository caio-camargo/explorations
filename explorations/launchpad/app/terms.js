// app/terms.js — the hover-term glossary (flow session, QUEUE Q287; UI.md rule 9, D16). A classic script sharing one global
// scope with the others; index.html loads it before editor.js. 'use strict';
'use strict';
// Jargon is a word you can hover, not a sub-line under every number. term(k, text) marks it (dotted underline); one
// tooltip (#termTip) shared by every screen shows its explanation, one level deep (no terms inside a term). The same
// element carries Q340's self-explaining warnings (whyMark, below). A screen that redraws every frame (the HUD)
// keeps the tooltip: it follows the pointer, not the element.
const TERMS={
  dv:{t:'Δv (delta-v)',d:'How much the rocket can still change its speed with the propellant on board, in m/s. Reaching orbit, a transfer, a landing: each costs Δv. In a stage row the first number is in vacuum, the second at sea level, where the engines push less.'},
  twr:{t:'TWR (thrust-to-weight)',d:'Thrust divided by weight. Under 1 the stage can\'t lift itself; 1.2 to 1.6 is a good first stage; much more and the climb is fast through thick air, hard on the structure at max-q. An upper stage can be under 1: it is already flying.'},
  maxq:{t:'Max-q',d:'The moment of greatest air pressure on the way up (q is dynamic pressure, in kPa): speed is climbing and the air hasn\'t thinned yet. Fins, joints and control are rated against it; a percentage is how much of a joint\'s certified limit it uses.'},
  ap:{t:'Apoapsis (Ap)',d:'The highest point of the orbit. A prograde burn there raises the opposite side, the periapsis: it is where you finish an orbit.'},
  pe:{t:'Periapsis (Pe)',d:'The lowest point of the orbit. Inside the air it won\'t last: the craft slows each pass and comes down. Raise it with a prograde burn at the apoapsis.'},
  kh:{t:'Know-how',d:'What the team has learned about a part by building and flying it, in one bar. Low know-how means engines that fail to light, slower stacking and science that pays less; flights, the test stand and development projects raise it.'},
  trim:{t:'Trim',d:'An engine whose thrust misses the centre of mass turns the craft, so the steering spends part of what it has holding it straight. The share it spends is the trim: under 20% is fine, near 100% leaves nothing for flying.'},
  scale:{t:'The model\'s scale',d:'The rocket on the table is a scale model, like a kit: at 1:48, 1 cm of the model is 48 cm of the real rocket. The scale is the smallest kit scale that keeps the model under 45 cm, so a bigger design sits at a smaller scale. The table, the lamp and the little figure on the base plate (a real 1.8 m person) are drawn at the same scale.'},   // (flow, Q277)
  stab:{t:'Stability margin',d:'How far the centre of mass sits ahead of the centre of pressure, in body widths (calibers). Positive: it flies nose-first like an arrow (0.5 and up is comfortable); negative: it wants to fly backwards and flips.'},
};
const term=(k,txt)=>TERMS[k]?`<span class="term" data-term="${k}">${txt||TERMS[k].t}</span>`:(txt||k);
// ---- warnings that explain themselves (QUEUE Q340, PROBES.md § 8, D22's Checks rows): an amber or red mark in the builder
// says on hover what's wrong, why it matters, and the fixes. whyMark(cls, html, W) wraps the mark: W={t: what's wrong,
// d: why it matters, fix: a sentence or a list of fixes}. A mark that's fine (cls 'ok' or none) stays a plain mark. Plain
// text only in W (it's escaped), and no terms inside: one level deep, like the terms.
const attrEsc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const lc1=s=>s.replace(/^[A-Z](?=[a-z ])/,c=>c.toLowerCase());   // (not RCS, CoM)
function fixText(f){if(!f)return'';if(!Array.isArray(f))return lc1(f.trim());const L=f.filter(Boolean).map(x=>lc1(x.trim()).replace(/\.$/,''));
  return(L.length>1?L.slice(0,-1).join('; ')+'; or '+L[L.length-1]:L[0]||'')+'.'}
function whyMark(cls,html,W,tag='b'){if(!W||!cls||cls==='ok')return`<${tag}${cls?` class="${cls}"`:''}>${html}</${tag}>`;
  return`<${tag} class="${cls} term" data-wt="${attrEsc(W.t||'')}" data-wd="${attrEsc(W.d||'')}" data-wf="${attrEsc(fixText(W.fix))}">${html}</${tag}>`}
const tipEsc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
// the tooltip: one for every screen (#termTip). Terms and self-explaining marks show on hover of a [data-term] or
// [data-wt], under it (above when there's no room); the builder's part cards (beside the parts list) and the hover over a
// part on the craft (at the pointer) show through tipShow too (QUEUE Q391). Each use names itself (own: 'term', 'card',
// 'craft'), so moving off one never closes another's; the tooltip always stays inside the window.
function tipShow(own,html,at){const tip=$('termTip');if(!tip)return;tip.dataset.own=own;tip.classList.toggle('card',own!=='term');
  if(tip.innerHTML!==html)tip.innerHTML=html;tip.classList.remove('hidden');const w=tip.offsetWidth,h=tip.offsetHeight;let x,y;
  if(at.x!=null){x=at.x+14;y=at.y+14;if(x+w>innerWidth-6)x=at.x-w-14;if(y+h>innerHeight-6)y=at.y-h-14}   // at the pointer
  else if(at.side){x=at.r.right+10;y=at.r.top-8;if(x+w>innerWidth-6)x=at.r.left-w-10}                    // beside it
  else{x=at.r.left;y=at.r.bottom+6+h<innerHeight?at.r.bottom+6:at.r.top-h-6}                            // under it
  tip.style.left=`${Math.round(Math.max(6,Math.min(innerWidth-w-6,x)))}px`;tip.style.top=`${Math.round(Math.max(6,Math.min(innerHeight-h-6,y)))}px`}
function tipHide(own){const tip=$('termTip');if(tip&&(!own||tip.dataset.own===own))tip.classList.add('hidden')}
document.addEventListener('mouseover',e=>{const el=e.target.closest&&e.target.closest('[data-term],[data-wt]');
  if(!el){tipHide('term');return}let html;
  if(el.dataset.wt!=null){const D=el.dataset;html=`<b class="${el.classList.contains('bad')?'bad':'warn'}">${tipEsc(D.wt)}</b>${D.wd?`<div>${tipEsc(D.wd)}</div>`:''}${D.wf?`<div class="fix">Fix: ${tipEsc(D.wf)}</div>`:''}`}
  else{const T=TERMS[el.dataset.term];if(!T)return;html=`<b>${T.t}</b><div>${T.d}</div>`}
  tipShow('term',html,{r:el.getBoundingClientRect()})});
