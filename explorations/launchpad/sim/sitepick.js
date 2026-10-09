// sim/sitepick.js — a landing site picked on the map (flow session, QUEUE Q62). Part of index.html's script (launchpad NOTES
// § "The file split"): a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- pure helpers for the map's "land here". surfacePick: the first body a ray from o along the unit vector d meets, as a
// site in that body's own frame (pf, the frame landed things are kept in, as bodies' landAt wants it); null when it meets
// nothing or Tellus first (procedures land on moons). procWithSite: a recorded mission procedure that lands on that body,
// flown to the site instead: the transfer aims its plane at it and the descent lands on it (NOTES § "Landing on a chosen point").
function surfacePick(o,d,t){let best=null;
  for(const b of BODIES){const oc=sub(o,bodyPos(b,t)),B=dot(oc,d),D=B*B-(dot(oc,oc)-b.R*b.R);if(D<0)continue;const x=-B-Math.sqrt(D);if(x>0&&(!best||x<best.x))best={b,x}}
  if(!best||!best.b.parent)return null;const B=best.b,p=sub(add(o,mul(d,best.x)),bodyPos(B,t));
  return{body:B.name,pf:toPF(B,p,t).map(v=>+v.toFixed(1))}}
const procLandsOn=(pr,name)=>!!pr&&pr.kind==='mission'&&(pr.phases||[]).some(ph=>ph.k==='land')&&(pr.phases||[]).some(ph=>ph.k==='transfer'&&ph.to===name);
function procWithSite(pr,name,pf){if(!procLandsOn(pr,name))return pr;
  return{...pr,phases:pr.phases.map(ph=>ph.k==='land'||ph.k==='transfer'&&ph.to===name?{...ph,site:pf}:ph)}}
const sitePlace=pf=>{const r=len(pf),la=Math.asin(clamp(pf[1]/r,-1,1))*57.29578,lo=Math.atan2(pf[2],pf[0])*57.29578;
  return `${Math.abs(la).toFixed(1)}°${la>=0?'N':'S'} ${Math.abs(lo).toFixed(1)}°${lo>=0?'E':'W'}`};
