// app/flags.js — flags and roundels in the UI (flow session, QUEUE Q104; POWERS.md § Schools "Flag motifs", § Livery).
// A power's flag is drawn from its hardware school's motifs in its own hue (p.hue), with a small per-power variant, so two
// Cape powers fly cousins, not twins; the roundel is the flag simplified to a disc, as on the rockets (gl.js's GLSL
// roundel: Cape's stripes and starred canton, Steppe's gold star on red, a white rim; the other schools' discs are new
// here and the shader can follow). A resource state flies its contractor's hardware but has a flag of its own (a crescent
// for an Emirate or Sultanate, a lozenge for a Kingdom). Pure functions of a power object: test.mjs flow-9 draws them all.
//   flagSVG(p, w)    a 3:2 flag, w px wide          roundelSVG(p, d)   a disc, d px across
//   powerMark(i)     the roundel of POWERS[i], inline before a name     newsMark(t)  the roundel of the first power a line names
'use strict';
const FLAG_W='#f2efe6',FLAG_G='#e8c33a';
function flagCols(p){const h=Math.round(p.hue);return{A:`hsl(${h},70%,42%)`,B:`hsl(${(h+150)%360},50%,26%)`,L:`hsl(${h},60%,70%)`}}
// a per-power variant (0..3), stable for a world: from the power's name
const flagVar=p=>{let x=7;for(const c of p.root||p.name||'')x=(x*31+c.charCodeAt(0))>>>0;return x%4};
// a five-pointed star centred at (x, y), outer radius r
function starPts(x,y,r,k=.42){let s='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*k:r;s+=`${(x+q*Math.cos(a)).toFixed(2)},${(y+q*Math.sin(a)).toFixed(2)} `}return s.trim()}
const star=(x,y,r,f)=>`<polygon points="${starPts(x,y,r)}" fill="${f}"/>`;
const flagKind=p=>p.contractor!=null?(/Emirate|Sultanate/.test(p.name)?'crescent':'lozenge'):p.school||'cape';
// the flag's body in a 30 × 20 box
function flagBody(p){const{A,B,L}=flagCols(p),v=flagVar(p),W=FLAG_W,G=FLAG_G,r=(x,y,w,h,f)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
  switch(flagKind(p)){
    case'cape':{const n=[7,9,11,13][v],h=20/n;let s=r(0,0,30,20,W);for(let i=0;i<n;i+=2)s+=r(0,i*h,30,h,A);const ch=h*Math.ceil(n/2),cw=ch*1.3;s+=r(0,0,cw,ch,B);
      const cols=v%2?3:4,rows=v%2?2:3;for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)s+=star(cw*(i+.5)/cols,ch*(j+.5)/rows,Math.min(cw/cols,ch/rows)*.32,W);return s}
    case'steppe':return r(0,0,30,20,A)+(v>=2?r(0,16,30,4,B):'')+star(7,6.5,4.2,G)+(v%2?`<circle cx="7" cy="6.5" r="5.4" fill="none" stroke="${G}" stroke-width=".7"/>`:'');
    case'arsenal':return r(0,0,30,20,B)+[0,1].slice(0,v%2?2:1).map(k=>`<polygon points="${k*6},0 ${k*6+8},10 ${k*6},20 ${k*6+4},20 ${k*6+12},10 ${k*6+4},0" fill="${k?W:A}"/>`).join('')+`<circle cx="21" cy="10" r="${v>=2?4.5:3.5}" fill="${G}"/>`;
    case'coastal':{const c=[A,W,B];if(v<2)return c.map((f,i)=>r(i*10,0,10,20,f)).join('')+(v?`<circle cx="15" cy="10" r="3.4" fill="${A}"/>`:'');
      return c.map((f,i)=>r(0,i*20/3,30,20/3,f)).join('')+(v===3?`<circle cx="15" cy="10" r="4" fill="${G}" stroke="${W}" stroke-width=".8"/>`:'')}
    case'mountain':{let s=r(0,0,30,20,W);if(v%2){for(let i=0;i<12;i++){const a=i*Math.PI/6;s+=`<line x1="15" y1="9" x2="${(15+14*Math.cos(a)).toFixed(2)}" y2="${(9+14*Math.sin(a)).toFixed(2)}" stroke="${L}" stroke-width="1.6"/>`}}
      s+=`<circle cx="15" cy="9" r="5" fill="${A}"/>`;if(v>=2)s+=`<polygon points="0,20 9,11 14,16 20,9 30,20" fill="${B}"/>`;return s}
    case'isle':{const sc=[[20,4.5,1.9],[24.5,10,1.6],[20,16,2.1],[16,10.5,1.4],[22,12.5,.8]];return r(0,0,30,20,B)+r(0,0,v%2?10:7,20,A)+sc.slice(0,v>=2?5:4).map(([x,y,s])=>star(x,y,s,W)).join('')}
    case'crescent':return r(0,0,30,20,A)+r(0,0,v%2?0:7,20,W)+`<circle cx="16" cy="10" r="6" fill="${W}"/><circle cx="18.2" cy="10" r="5" fill="${A}"/>`+star(21.2,10,2,W);
    default:return r(0,0,30,20,A)+`<polygon points="15,2 27,10 15,18 3,10" fill="${W}"/>`+(v%2?star(15,10,3.2,A):`<circle cx="15" cy="10" r="3" fill="${B}"/>`)}}
function flagSVG(p,w=24){return `<svg class="flag" width="${w}" height="${(w*2/3).toFixed(1)}" viewBox="0 0 30 20" role="img" aria-label="flag of ${p.name}"><title>${p.name}</title>${flagBody(p)}<rect x=".25" y=".25" width="29.5" height="19.5" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".5"/></svg>`}
// the roundel: a disc of radius 1 with a white rim (as the shader's r > .88)
function roundelBody(p){const{A,B}=flagCols(p),W=FLAG_W,G=FLAG_G,c=(r,f)=>`<circle r="${r}" fill="${f}"/>`;
  switch(flagKind(p)){
    case'cape':{let s=c(.88,W);for(let k=0;k<9;k+=2)s+=`<rect x="-1" y="${(-1+k*2/9).toFixed(3)}" width="2" height="${(2/9).toFixed(3)}" fill="${A}"/>`;
      s+=`<rect x="-1" y="-1" width=".95" height=".95" fill="${B}"/>`;for(const[x,y]of[[-.62,-.38],[-.3,-.62],[-.32,-.3]])s+=star(x,y,.1,W);return s}   // (the shader: stripes, a starred canton top left)
    case'steppe':return c(.88,A)+star(0,.02,.6,G);
    case'arsenal':return c(.88,B)+`<polygon points="-.75,-.5 -.1,0 -.75,.5 -.45,.5 .2,0 -.45,-.5" fill="${A}"/>`+`<circle cx=".42" r=".26" fill="${G}"/>`;
    case'coastal':return c(.88,B)+c(.6,W)+c(.32,A);
    case'mountain':{let s=c(.88,W);for(let i=0;i<8;i++){const a=i*Math.PI/4;s+=`<line x1="0" y1="0" x2="${(.8*Math.cos(a)).toFixed(3)}" y2="${(.8*Math.sin(a)).toFixed(3)}" stroke="${A}" stroke-width=".09"/>`}return s+c(.36,A)}
    case'isle':return c(.88,B)+[[0,-.5,.17],[.42,0,.14],[0,.5,.19],[-.42,.05,.12]].map(([x,y,s])=>star(x,y,s,W)).join('');
    case'crescent':return c(.88,A)+`<circle cx="-.08" r=".55" fill="${W}"/><circle cx=".12" r=".46" fill="${A}"/>`+star(.38,0,.18,W);
    default:return c(.88,A)+`<polygon points="0,-.6 .5,0 0,.6 -.5,0" fill="${W}"/>`}}
function roundelSVG(p,d=14){return `<svg class="rdl" width="${d}" height="${d}" viewBox="-1 -1 2 2" role="img" aria-label="roundel of ${p.name}"><title>${p.name}</title><clipPath id="rdl-c"><circle r=".88"/></clipPath><circle r="1" fill="${FLAG_W}"/><g clip-path="url(#rdl-c)">${roundelBody(p)}</g><circle r=".97" fill="none" stroke="rgba(0,0,0,.4)" stroke-width=".06"/></svg>`}
const powerMark=(i,d=13)=>POWERS[i]?roundelSVG(POWERS[i],d):'';
// the first power a news line names (full name or root), as a roundel; '' if none
function newsMark(t){const s=String(t);let best=null,at=1e9;for(const p of POWERS)for(const n of[p.name,p.root]){const k=s.indexOf(n);if(k>=0&&k<at){at=k;best=p}}return best?roundelSVG(best,13):''}
