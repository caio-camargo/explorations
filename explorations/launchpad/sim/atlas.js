// sim/atlas.js — the atlas grid. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- the atlas (terrain session): biome and power of every point on an equirectangular grid, the city texture's layout
// (x: longitude atan2(z,x) from -π; y: latitude from the south pole). biomeAt + powerAt cost ~5 µs a point, so the
// 1024×512 grid (~3 s) is baked a few rows at a time on first use. From it: the map's colour texture (render side), the
// coasts and borders as lines (the notebook and terminal maps draw them in ink) and where each power's name goes.
const ATLAS={W:1024,H:512,bio:null,pow:null,y:0,lines:null,names:null};
const atlasU=(x,y)=>{const la=((y+.5)/ATLAS.H-.5)*Math.PI,lo=((x+.5)/ATLAS.W-.5)*2*Math.PI;return[Math.cos(la)*Math.cos(lo),Math.sin(la),Math.cos(la)*Math.sin(lo)]};
const atlasXY=u=>{const W=ATLAS.W,H=ATLAS.H;return[((Math.floor((Math.atan2(u[2],u[0])/(2*Math.PI)+.5)*W)%W)+W)%W,clamp(Math.floor((Math.asin(clamp(u[1],-1,1))/Math.PI+.5)*H),0,H-1)]};
function atlasBake(ms=Infinity){const A=ATLAS,t0=performance.now();if(!A.bio){A.bio=new Uint8Array(A.W*A.H);A.pow=new Uint8Array(A.W*A.H)}
  while(A.y<A.H&&performance.now()-t0<ms){const y=A.y++;
    for(let x=0;x<A.W;x++){const u=atlasU(x,y),k=y*A.W+x,b=biomeAt(u);A.bio[k]=b.id;if(b.id){const p=powerAt(u);A.pow[k]=p?p.i+1:0}}}
  if(A.y<A.H)return false;if(!A.lines)atlasLines();return true}
// coasts and borders by marching squares on every 2nd point: in each cell, the edges whose two corners differ (land/sea
// for coasts; two powers' land for borders); two such edges are joined by a segment, any other number meet at the centre
function atlasLines(s=2){const A=ATLAS,W=A.W/s,H=A.H/s,at=(x,y)=>(y*s)*A.W+((x%W+W)%W)*s,coast=[],border=[];
  const P=(fx,fy)=>atlasU(fx*s,fy*s),E=[[.5,0],[1,.5],[.5,1],[0,.5]];
  for(let y=0;y<H-1;y++)for(let x=0;x<W;x++){const c=[at(x,y),at(x+1,y),at(x+1,y+1),at(x,y+1)],L=c.map(k=>A.bio[k]>0),Q=c.map(k=>A.pow[k]);
    for(const[out,diff]of[[coast,(i,j)=>L[i]!==L[j]],[border,(i,j)=>L[i]&&L[j]&&Q[i]!==Q[j]]]){
      const es=[0,1,2,3].filter(i=>diff(i,(i+1)%4)).map(i=>P(x+E[i][0],y+E[i][1]));if(!es.length)continue;
      if(es.length===2)out.push(es[0],es[1]);else{const m=P(x+.5,y+.5);for(const e of es)out.push(e,m)}}}
  const f32=L=>Float32Array.from(L.flat());A.lines={coast:f32(coast),border:f32(border)};
  // a power's name sits on its own land nearest the centroid of that land (area-weighted: the grid's cells shrink by cos lat)
  A.names=POWERS.map(p=>{let c=[0,0,0],n=0;for(let k=0;k<A.W*A.H;k+=3)if(A.pow[k]===p.i+1){const u=atlasU(k%A.W,k/A.W|0),w=Math.sqrt(1-u[1]*u[1]);c=madd(c,u,w);n+=w}
    if(!n)return null;c=norm(c);let best=null,bd=-2;for(let k=0;k<A.W*A.H;k+=3)if(A.pow[k]===p.i+1){const u=atlasU(k%A.W,k/A.W|0),d=dot(u,c);if(d>bd){bd=d;best=u}}
    return{i:p.i,u:best,area:n}})}
// what's under a planet-fixed point, from the live functions (the grid is for drawing): the map's hover readout
function atlasAt(pf){const u=norm(pf),b=biomeAt(u),p=b.id?powerAt(u):null;return{biome:b.name,id:b.id,power:p,h:terrainH(u),lat:Math.asin(clamp(u[1],-1,1))*180/Math.PI,lon:Math.atan2(u[2],u[0])*180/Math.PI}}
const pairKey=(i,j)=>i<j?i+'-'+j:j+'-'+i;
const relBase=(i,j)=>{const a=POWERS[i].align,b=POWERS[j].align;return clamp(1-0.9*Math.hypot(a[0]-b[0],a[1]-b[1]),-1,1)};
const relOf=(i,j)=>i===j?1:PROG.rel[pairKey(i,j)]??relBase(i,j);
const relWord=r=>r>.55?'allied':r>.2?'friendly':r>-.2?'neutral':r>-.55?'tense':'hostile';
const opOf=i=>PROG.op[i]??(i===HOME?55:clamp(48+12*relOf(HOME,i),20,80));
function opAdd(i,d){PROG.op[i]=clamp(opOf(i)+d,0,100)}
function worldTick(d){const R=rng(PROG.wseed=(PROG.wseed*1103515245+12345+Math.floor(d*1000))>>>0),k=1-Math.exp(-d/150);
  for(let i=0;i<POWERS.length;i++)for(let j=i+1;j<POWERS.length;j++){const key=pairKey(i,j);let r=relOf(i,j);
    r+=(relBase(i,j)-r)*k+(R()-.5)*0.12*Math.sqrt(d/20);
    if(R()<1-Math.exp(-d*0.0015*(1.2-r))){r-=.35;HOOK.news(`${POWERS[i].name} and ${POWERS[j].name}: talks collapse, embassies recalled`,'warn')}
    else if(R()<1-Math.exp(-d*0.002)){r+=.25;HOOK.news(`${POWERS[i].name} and ${POWERS[j].name} sign a surprise friendship treaty`,'ok')}
    PROG.rel[key]=clamp(r,-1,1)}
  for(const p of POWERS)PROG.op[p.i]=opOf(p.i)+(50-opOf(p.i))*(1-Math.exp(-d/250));   // memory fades
  econTick(d,R);satTick(d,R);utilTick(d)}
