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
// the tooltip: on hover of a [data-term] or a self-explaining mark [data-wt], under it (above when there's no room), inside the window
document.addEventListener('mouseover',e=>{const el=e.target.closest&&e.target.closest('[data-term],[data-wt]'),tip=$('termTip');if(!tip)return;
  if(!el){tip.classList.add('hidden');return}
  if(el.dataset.wt!=null){const D=el.dataset;tip.innerHTML=`<b class="${el.classList.contains('bad')?'bad':'warn'}">${tipEsc(D.wt)}</b>${D.wd?`<div>${tipEsc(D.wd)}</div>`:''}${D.wf?`<div class="fix">Fix: ${tipEsc(D.wf)}</div>`:''}`}
  else{const T=TERMS[el.dataset.term];if(!T)return;tip.innerHTML=`<b>${T.t}</b><div>${T.d}</div>`}
  tip.classList.remove('hidden');
  const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
  tip.style.left=`${Math.max(6,Math.min(innerWidth-w-6,r.left))}px`;tip.style.top=`${r.bottom+6+h<innerHeight?r.bottom+6:Math.max(6,r.top-h-6)}px`});
