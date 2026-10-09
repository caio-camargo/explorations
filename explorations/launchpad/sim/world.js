// sim/world.js — the generated world, launch sites, recovery, ground stations, plasma blackout. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- the world (terrain session). Tellus is generated from a seed in two layers:
//  · a baked 512×256 map (equirectangular, 7 km a texel at the equator): plates make the continents and, where they
//    collide, the mountain ranges (collision belts, coastal ranges with volcanoes over subduction, island arcs, rifts).
//    Climate follows: temperature from latitude and height; rain carried by the prevailing winds (easterly trades,
//    westerlies, polar easterlies), dumped where air is forced uphill (wet windward slopes, dry rain shadows), and
//    modulated by the big circulation (wet equator, dry subtropics, stormy mid-latitudes).
//  · procedural detail on top (ridges, hills, the fractal coast, fjords, volcano cones), built on an INTEGER hash, so
//    the lattice values are bit-identical here and in GLSL and heights agree to float rounding (millimetres). The old
//    float hash could disagree by whole lattice values on GPUs that fuse multiply-adds: tens of metres of terrain.
// The world is generated in its own frame and turned about the axis so the home launch site sits at planet-fixed +X
// (on the equator). Heights are metres above sea level; the sea is the sphere R, the land is R + h.
function ih3(x,y,z){let h=Math.imul(x,0x8da6b343)^Math.imul(y,0xd8163841)^Math.imul(z,0xcb1ab31f);
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;return(h>>>8)/16777216}
function tn(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let fx=x-ix,fy=y-iy,fz=z-iz;
  fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
  const a=ih3(ix,iy,iz),b=ih3(ix+1,iy,iz),c=ih3(ix,iy+1,iz),d=ih3(ix+1,iy+1,iz),e=ih3(ix,iy,iz+1),f=ih3(ix+1,iy,iz+1),g=ih3(ix,iy+1,iz+1),h=ih3(ix+1,iy+1,iz+1);
  const x1=a+(b-a)*fx,x2=c+(d-c)*fx,x3=e+(f-e)*fx,x4=g+(h-g)*fx,y1=x1+(x2-x1)*fy;return y1+(x3+(x4-x3)*fy-y1)*fz}
function tfbm(x,y,z,o){let a=.5,s=0,n=0;for(let i=0;i<o;i++){s+=a*tn(x,y,z);n+=a;x=x*2.03+1.7;y=y*2.03+9.2;z=z*2.03+3.1;a*=.5}return s/n}
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
// Feature sizes are kept in kilometres, not as fractions of the planet: they were tuned on the 600 km Tellus, and WK
// converts those angles to this radius (ranges ~100 km across, detail from 25 km down to 90 m, fjords, ~5 km cones).
// ridges: RIDGE_A of ridged relief where the ground is fully rugged, VALLEY of it below the base (deep valleys, sharp crests)
const RIDGE_A=4200,VALLEY=1800;
const WTW=1024,WTH=512,WSEED=13,HOCT=9,NPLATES=20,WK=6e5/TELLUS.R,HF0=+(24/WK).toFixed(5),FJ1=+(18/WK).toFixed(5),FJ2=+(70/WK).toFixed(5),VOLF=+(60/WK).toFixed(5);
function makeWorld(seed=WSEED){const R=rng(seed),NP=NPLATES,D=Math.PI/180,off=[R()*100,R()*100,R()*100],plates=[];
  for(let k=0;k<NP;k++){const z=R()*2-1,ph=R()*6.2832,q=Math.sqrt(1-z*z);plates.push({s:[q*Math.cos(ph),z,q*Math.sin(ph)],cont:false,ax:norm([R()*2-1,R()*2-1,R()*2-1]),w:.6+R()*.8})}
  {const ix=plates.map((_,i)=>i);for(let i=NP-1;i>0;i--){const j=R()*(i+1)|0;[ix[i],ix[j]]=[ix[j],ix[i]]}for(let i=0;i<Math.round(NP*.45);i++)plates[ix[i]].cont=true}
  const N=WTW*WTH,E=new Float32Array(N),M=new Float32Array(N),V=new Float32Array(N),T=new Float32Array(N),W=new Float32Array(N),S=new Float32Array(N);
  // the smooth fields (boundary warp, continent noise, old worn ranges) live on a half-resolution grid and are
  // interpolated; only the plate boundaries, which must stay sharp, are found per texel. Pair normals are precomputed.
  const LW=WTW/2,LH=WTH/2,QX=new Float32Array(LW*LH),QY=new Float32Array(LW*LH),QZ=new Float32Array(LW*LH),CN=new Float32Array(LW*LH),WR=new Float32Array(LW*LH);
  for(let j=0;j<LH;j++){const lat=((j+.5)/LH-.5)*Math.PI,cl=Math.cos(lat),sl=Math.sin(lat);
    for(let i=0;i<LW;i++){const lon=(i+.5)/LW*2*Math.PI-Math.PI,p=[cl*Math.cos(lon),sl,cl*Math.sin(lon)],k=j*LW+i;
      QX[k]=p[0]+.45*(tfbm(p[0]*3+off[0],p[1]*3,p[2]*3,3)-.5);QY[k]=p[1]+.45*(tfbm(p[0]*3,p[1]*3+off[1],p[2]*3,3)-.5);QZ[k]=p[2]+.45*(tfbm(p[0]*3,p[1]*3,p[2]*3+off[2],3)-.5);
      CN[k]=tfbm(p[0]*1.8+off[1],p[1]*1.8,p[2]*1.8+off[2],5)-.5;WR[k]=1-Math.abs(2*tfbm(p[0]*5/WK+off[2],p[1]*5/WK,p[2]*5/WK+off[0],3)-1)}}
  const lo=(A,x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,i0=(ix+LW)%LW,i1=(ix+1)%LW,j0=clamp(iy,0,LH-1)*LW,j1=clamp(iy+1,0,LH-1)*LW,a=A[j0+i0]+(A[j0+i1]-A[j0+i0])*fx;return a+(A[j1+i0]+(A[j1+i1]-A[j1+i0])*fx-a)*fy};
  const PN=[];for(let a=0;a<NP;a++){PN.push([]);for(let b=0;b<NP;b++)PN[a].push(a===b?null:norm(sub(plates[a].s,plates[b].s)))}
  for(let j=0;j<WTH;j++){const ly=(j+.5)/2-.5;
    for(let i=0;i<WTW;i++){const lx=(i+.5)/2-.5,k=j*WTW+i,q=norm([lo(QX,lx,ly),lo(QY,lx,ly),lo(QZ,lx,ly)]);
      // plates: nearest seed (after the warp, so boundaries wander); the boundary is the nearest bisector
      let b1=-2,i1=0;for(let n=0;n<NP;n++){const d=dot(q,plates[n].s);if(d>b1){b1=d;i1=n}}
      const P1=plates[i1],pn=PN[i1];let bd=9,i2=0;
      for(let n=0;n<NP;n++){if(n===i1)continue;const v=pn[n],a=q[0]*v[0]+q[1]*v[1]+q[2]*v[2];if(a<bd){bd=a;i2=n}}
      bd=Math.asin(clamp(bd,-1,1));
      const P2=plates[i2],v1=cross(P1.ax,q),v2=cross(P2.ax,q),bk=bd/WK;   // bk: distance to the boundary in the 600 km planet's radians, so widths stay in km
      let nb=sub(P2.s,P1.s);nb=norm(sub(nb,mul(q,dot(nb,q))));
      const conv=dot(v1,nb)*P1.w-dot(v2,nb)*P2.w,c1=P1.cont?1:0,c2=P2.cont?1:0,cb=c1+(c2-c1)*.5*(1-sstep(0,.22,bk));
      const cn=lo(CN,lx,ly);
      let e=-3600+3900*cb+7500*cn;if(e>0)e*=.35;   // most land sits low; height comes from tectonics
      let up=0,vol=0;const g=x=>Math.exp(-x*x);
      if(conv>0){const cv=Math.min(conv,1.2);
        if(c1&&c2)up=5200*cv*g(bk/.07)+1400*cv*sstep(.3,.05,bk)*(i1<i2?1:.3);                     // collision: a high range, a plateau behind
        else if(c1)up=4200*cv*g((bk-.06)/.05),vol=cv*g((bk-.09)/.03);                                // ocean diving under a continent: coastal range + volcanoes
        else if(c2)up=-2200*cv*g(bk/.03);                                                            // the trench
        else if(i1<i2)up=4600*cv*g((bk-.05)/.025),vol=cv*g((bk-.05)/.025)}                           // island arc
      else if(conv<-.15){const cv=Math.min(-conv,1.2);if(c1&&c2)up=-1500*cv*g(bk/.035)+500*cv*g((bk-.07)/.04);else if(!c1&&!c2)up=1200*cv*g(bk/.05)}   // rift valley / mid-ocean ridge
      const r=lo(WR,lx,ly);up+=900*r*r*r*sstep(-.1,.3,cb+cn);      // old, worn ranges
      E[k]=e+up;M[k]=clamp(Math.abs(up)/3500,0,1);V[k]=clamp(vol,0,1)}}
  for(let j=0;j<WTH;j++){const lat=((j+.5)/WTH-.5)*180,al=Math.abs(lat),dir=al<30||al>60?1:-1,dx=2*Math.PI*TELLUS.R/1000*Math.cos(lat*D)/WTW,g=x=>Math.exp(-x*x);
    const circ=.6+.7*g(lat/11)-.5*g((al-25)/6.5)+.35*g((al-47)/12)-.3*sstep(65,85,al);let m=1,ep=0;
    for(let pass=0;pass<2;pass++)for(let n=0;n<WTW;n++){const i=dir>0?n:WTW-1-n,k=j*WTW+i,e=E[k];let oro=0;
      if(e<0){m+=(1-m)*(1-Math.exp(-dx/300));ep=0}else{oro=m*(1-Math.exp(-Math.max(0,e-ep)/1000*.55));m=Math.max(m*Math.exp(-dx/3500)-oro,0);ep=e}
      if(pass)W[k]=clamp((.4+.95*m)*circ+oro*7,0,1.5)}
    for(let i=0;i<WTW;i++){const k=j*WTW+i;T[k]=27-52*Math.pow(al/90,2.2)-6.5*Math.max(E[k],0)/1000}}
  for(let it=0;it<5;it++){const W2=W.slice();for(let j=1;j<WTH-1;j++)for(let i=0;i<WTW;i++){const k=j*WTW+i;W[k]=(W2[k]*2+W2[j*WTW+(i+WTW-1)%WTW]+W2[j*WTW+(i+1)%WTW]+W2[k-WTW]+W2[k+WTW])/6}}
  // salt flats: dry, flat basins that sit below their surroundings (where rain would pool, if it rained)
  for(let j=2;j<WTH-2;j++)for(let i=0;i<WTW;i++){const k=j*WTW+i;if(E[k]<=0||W[k]>.4||M[k]>.2||T[k]<0)continue;let s=0;
    for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)s+=E[(j+a)*WTW+(i+b+WTW)%WTW];S[k]=sstep(60,220,s/25-E[k])*sstep(.4,.25,W[k])}
  // an upper bound on the ground near each texel (base + the most the detail can add, dilated ±2 texels): the shader's
  // march skips through air above it without evaluating the terrain at all
  const U=new Float32Array(N),U0=new Float32Array(N);for(let k=0;k<N;k++){const e=E[k]>3500?3500+(E[k]-3500)*.5:E[k],m=M[k];U0[k]=e+(m*RIDGE_A+120)*1.3-m*VALLEY+440+V[k]*3400}
  for(let j=0;j<WTH;j++)for(let i=0;i<WTW;i++){let mx=-1e9;for(let a=-2;a<=2;a++){const jj=clamp(j+a,0,WTH-1);for(let b=-2;b<=2;b++)mx=Math.max(mx,U0[jj*WTW+(i+b+WTW)%WTW])}U[j*WTW+i]=Math.max(mx,0)+30}
  return{E,M,V,T,W,S,U,plates,seed,lon0:0,site:null,siteH:0}}
const WORLD=makeWorld();
// bilinear on the baked map (the shader does the same arithmetic with texelFetch, not the GPU's 8-bit filter weights)
function wBil(A,g){const x=(Math.atan2(g[2],g[0])/(2*Math.PI)+.5)*WTW-.5,y=(Math.asin(clamp(g[1],-1,1))/Math.PI+.5)*WTH-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const i0=(ix+WTW)%WTW,i1=(ix+1)%WTW,j0=Math.max(iy,0)*WTW,j1=Math.min(iy+1,WTH-1)*WTW,a=A[j0+i0]+(A[j0+i1]-A[j0+i0])*fx;return a+(A[j1+i0]+(A[j1+i1]-A[j1+i0])*fx-a)*fy}
// the height channels use a quadratic B-spline over 3×3 texels instead: bilinear is continuous but its slope kinks at
// every texel edge, and the lighting showed those kinks as 8 km facets. The quadratic B-spline has continuous slope,
// never overshoots its neighbours (so the air bound U, dilated ±2 texels, still holds), and costs the shader 9 fetches.
const bsq=t=>[.5*(.5-t)*(.5-t),.75-t*t,.5*(.5+t)*(.5+t)];
function wSpl(g){const x=(Math.atan2(g[2],g[0])/(2*Math.PI)+.5)*WTW-.5,y=(Math.asin(clamp(g[1],-1,1))/Math.PI+.5)*WTH-.5,ix=Math.floor(x+.5),iy=Math.floor(y+.5),wx=bsq(x-ix),wy=bsq(y-iy),W=WORLD,o=[0,0,0,0];
  for(let b=0;b<3;b++){const j=clamp(iy-1+b,0,WTH-1)*WTW;for(let a=0;a<3;a++){const k=j+(ix-1+a+WTW*2)%WTW,w=wx[a]*wy[b];o[0]+=W.E[k]*w;o[1]+=W.M[k]*w;o[2]+=W.V[k]*w;o[3]+=W.S[k]*w}}return o}
const toGen=pf=>rotY(norm(pf),-WORLD.lon0),fromGen=g=>rotY(g,WORLD.lon0);
// the height of the land in the world's own frame g (unit vector), without the launch-site flattening
function hgtGen(g,oct=HOCT){const[e0,m,v,sf]=wSpl(g),lat=Math.abs(g[1]);
  let e=e0>3500?3500+(e0-3500)*.5:e0,f=HF0,a=1,rid=0,hil=0,wgt=1,an=0;
  // ridged multifractal (mountains) and plain fbm (hills, and the fractal coast) from the same octaves
  for(let i=0;i<oct;i++){const n=tn(g[0]*f+11.3,g[1]*f+3.7,g[2]*f+7.1);let r=1-Math.abs(2*n-1);r*=r*wgt;wgt=clamp(r*1.6,0,1);rid+=a*r;hil+=a*(n-.5);an+=a;f*=2.03;a*=.5}
  e+=((m*RIDGE_A+120)*rid/an*1.3-m*VALLEY+(380+500*sstep(900,0,Math.abs(e0)))*hil/an*(1-m*.5))*(1-.9*sf);
  // fjords: glaciers cut narrow valleys into high-latitude mountains; near the coast they flood
  const gl=sstep(.66,.82,lat)*sstep(.08,.35,m)*sstep(1800,400,e0);
  if(gl>0){const wv=tn(g[0]*FJ1,g[1]*FJ1+5,g[2]*FJ1)-.5,l=Math.abs(tn(g[0]*FJ2+wv*3,g[1]*FJ2,g[2]*FJ2+wv*3)-.5);e-=gl*1500*(1-sstep(.01,.06,l))}
  // volcanoes: one cone per ~20 km cell along the active arcs, with a summit crater
  if(v>.15){const x=g[0]*VOLF,y=g[1]*VOLF,z=g[2]*VOLF,ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    if(ih3(ix,iy,iz+77)<.55){const d=Math.hypot(x-ix-.25-.5*ih3(ix,iy,iz+78),y-iy-.25-.5*ih3(ix,iy,iz+79),z-iz-.25-.5*ih3(ix,iy,iz+80))/.25;
      if(d<1)e+=v*(1800+1600*ih3(ix,iy,iz+81))*(1-d)*(1-d)*(d<.12?.6+3*d:1)}}
  return e}
// ---- launch sites (slice B). The home site is found first: on the equator, flat low land a few km from a coast with
// open sea to the east (spent stages fall in the water). The world is turned so it sits at planet-fixed +X (power 0's
// home, the default everywhere). More sites, per power, are added once the powers exist (extendSites, below).
// SITES is plain data, one entry per pad: id, name, u (planet-fixed unit vector), lat (deg), h (levelled pad height, m),
// power (index, null at sea), coastal, maxDia (largest stage diameter it can take: a rail gauge inland, barges at the
// coast), downrange {az (deg from north), sea (fraction of the first 1,000 km over water), over (powers whose land lies
// under it)}, polar ('S', 'N', 'NS' or null: a clear corridor that way), kind ('pad'; later 'sea'), role, rot (the free
// eastward speed, m/s), minInc (deg). Economy owns who may use a site: siteAccess(site), see siteAccessOf.
const PAD_FLAT=2000,PAD_BLEND=4500,SITE_GAP=250e3,RAIL_DIA=3.9,BARGE_DIA=10,SEA_DECK=12;   // a sea platform's deck stands 12 m above the water
(function siteSearch(){let best=null;const Wd=WORLD,kmT=2*Math.PI*TELLUS.R/1000/WTW,nF=Math.round(150/kmT),nS=Math.round(600/kmT);   // coast within 150 km, then 600 km of open sea
  for(const j of[WTH/2-1,WTH/2])for(let i=0;i<WTW;i++){const k=j*WTW+i,e=Wd.E[k];if(e<3||e>350||Wd.M[k]>.12)continue;
    let first=-1,sea=0;for(let n=1;n<=nF+nS;n++){const s=Wd.E[j*WTW+(i-n+WTW*2)%WTW]<0;if(first<0){if(s)first=n;else if(n>nF)break}else if(n<=first+nS)sea+=s}
    if(first*kmT<12)continue;const sc=sea/nS-first*kmT/740-Wd.M[k];if(!best||sc>best.sc)best={sc,i,j}}
  const lon=best?(best.i+.5)/WTW*2*Math.PI-Math.PI:0;Wd.lon0=lon;Wd.siteFound=!!best})();
// a site's local frame: up, east (the way the surface turns), north, south
const siteFrame=u=>{const e=norm(cross([0,1,0],u));return{up:u,e,n:cross(u,e),s:cross(e,u)}};
// the point a great-circle angle a (rad) from u, heading az (rad, from north toward east)
function alongAz(u,az,a){const f=siteFrame(u),dir=add(mul(f.n,Math.cos(az)),mul(f.e,Math.sin(az)));return norm(add(mul(u,Math.cos(a)),mul(dir,Math.sin(a))))}
function mkSite(u,role,id){return{id,name:'',u,lat:Math.asin(clamp(u[1],-1,1))*57.29578,h:Math.max(8,hgtGen(toGen(u))),
  power:null,coastal:false,maxDia:RAIL_DIA,downrange:null,polar:null,kind:'pad',role,rot:0,minInc:0}}
const SITES=[mkSite([1,0,0],'home','s0')];
WORLD.site=SITES[0].u;WORLD.siteH=SITES[0].h;   // aliases for the home pad
const siteById=id=>SITES.find(x=>x.id===id)||null;
// home sites are whichever belong to HOME now (HOME can change: defection), never a stored list
const homeSites=()=>SITES.filter(x=>x.power===HOME);
const sitesNear=(u,n)=>SITES.filter(t=>t.kind==='pad').sort((a,b)=>dot(b.u,u)-dot(a.u,u)).slice(0,n);   // the pads near u (for levelling and the painted complex)
const homeSite=()=>homeSites()[0]||SITES[0];
const curSite=()=>(typeof PROG!=='undefined'&&PROG.site&&siteById(PROG.site))||homeSite();
// who may launch where is economy's rule (siteAccess, in the program block). Until it exists: home sites only, free.
function siteAccessOf(t){if(typeof siteAccess==='function')return siteAccess(t);
  if(t.kind==='sea')return{ok:true,why:'',fee:0};   // the sea is no one's: the platform is a service (economy may price it)
  return t.power===HOME?{ok:true,why:'',fee:0}:{ok:false,why:`${t.power==null?'nobody':POWERS[t.power].name} won't let us launch from ${t.name}`,fee:0}}
// the weather at a site at program time T: the cloud field the sky draws (cloudAt). Under storm-grade cloud a launch
// scrubs and slips a day at a time (weatherHold, called on the launch day), up to SCRUB_MAX days.
const SCRUB_CLOUD=0.9,SCRUB_MAX=5;
function siteWeather(t,T){const c=cloudAt(t.u,T);return{cover:c,scrub:c>SCRUB_CLOUD,word:c<0.3?'clear':c<0.7?'some cloud':c<=SCRUB_CLOUD?'overcast':'storms: launches scrub'}}
function weatherHold(s){const t=s.site;if(!t||s.body!==TELLUS)return 0;let n=0;
  while(n<SCRUB_MAX&&siteWeather(t,PROG.day*DAY_S).scrub){advanceDays(1);n++}
  if(n)HOOK.news(`Weather scrub at ${t.name}: storms over the pad, the launch slips ${n} day${n>1?'s':''}`,'warn');return n}
// before a launch: whose land the spent stages may fall on, along the site's downrange (other than our own)
function downrangeWarning(t){const f=(t.downrange?t.downrange.over:[]).filter(i=>i!==HOME&&i!==t.power);   // the host's own land is the host's business
  return f.length?`Downrange from ${t.name} crosses ${f.map(i=>POWERS[i].name).join(' and ')}: spent stages may fall on their land`:''}
// a stage wider than the site can receive (rail gauge inland, barges at the coast) can't be stacked there
function siteFits(t,parts){const d=parts.reduce((m,q)=>Math.max(m,2*q.d.r),0);
  return d<=t.maxDia+1e-9?{ok:true,why:''}:{ok:false,why:`${t.name} is inland: nothing wider than ${t.maxDia} m comes by rail (this rocket is ${d.toFixed(2)} m)`}}
// more sites, once the powers and their land exist. Candidates are screened on the baked map (cheap); each power gets
// up to three: its most equatorial site (weighted toward open sea to the east), one with a clear polar corridor, and
// one inland. Then every site's facts are measured on the real terrain and territory.
const seaE=u=>wBil(WORLD.E,toGen(u))<0;
function siteTrack(u,az){const R=TELLUS.R,over=new Set();let n=0,w=0;
  for(let km=20;km<=1000;km+=20){const q=alongAz(u,az,km*1e3/R),p=powerAt(q);n++;if(!p)w++;else over.add(p.i)}return{sea:w/n,over:[...over]}}
function finishSite(t){const D=Math.PI/180,R=TELLUS.R;t.power=(powerAt(t.u)||{i:null}).i;
  t.coastal=[0,45,90,135,180,225,270,315].some(a=>[5,15,30].some(km=>!isLand(alongAz(t.u,a*D,km*1e3/R))));
  t.maxDia=t.coastal?BARGE_DIA:RAIL_DIA;t.rot=TELLUS.rot*R*Math.cos(t.lat*D);t.minInc=Math.abs(t.lat);
  // downrange: the most open water over the first 1,000 km among eastward headings, favouring due east (most free speed)
  let best=null;for(const a of[90,75,105,60,120,45,135]){const k=siteTrack(t.u,a*D),sc=k.sea-0.25*k.over.filter(i=>i!==t.power).length-0.002*Math.abs(a-90);if(!best||sc>best.sc)best={sc,az:a,...k}}
  t.downrange={az:best.az,sea:best.sea,over:best.over};
  const clear=a=>{const k=siteTrack(t.u,a*D);return k.sea>=.6&&k.over.every(i=>i===t.power)};
  t.polar=(clear(180)?'S':'')+(clear(0)?'N':'')||null;
  const rt=t.power==null?'Open Sea':POWERS[t.power].root,sfx={home:t.coastal?'Cape':'Field',eq:t.coastal?'Cape':'Field',polar:'Polar Range',inland:'Field'}[t.role];
  t.name=t.kind==='sea'?'Sea Platform':`${rt} ${sfx}`;if(SITES.some(x=>x!==t&&x.name===t.name))t.name+=' II';return t}
function extendSites(){const D=Math.PI/180,R=TELLUS.R,cands=[],gap=Math.cos(SITE_GAP/R),cgap=Math.cos(40e3/R);
  for(let j=8;j<WTH-8;j+=6)for(let i=0;i<WTW;i+=6){const k=j*WTW+i,e=WORLD.E[k];if(e<5||e>1500||WORLD.M[k]>.15)continue;
    const la=((j+.5)/WTH-.5)*Math.PI;if(Math.abs(la)>70*D)continue;const lo=(i+.5)/WTW*2*Math.PI-Math.PI,u=fromGen([Math.cos(la)*Math.cos(lo),Math.sin(la),Math.cos(la)*Math.sin(lo)]);
    const p=powerAt(u);if(!p||CITIES.some(c=>dot(c.u,u)>cgap))continue;
    const sea=az=>{let n=0,t=0;for(let km=40;km<=1000;km+=40){t++;if(seaE(alongAz(u,az,km*1e3/R)))n++}return n/t};
    const coast=[0,45,90,135,180,225,270,315].some(a=>seaE(alongAz(u,a*D,25e3/R)));
    cands.push({u,p:p.i,lat:la/D,coast,east:sea(90*D),pol:Math.max(sea(0),sea(180*D))})}
  const free=u=>SITES.every(x=>dot(x.u,u)<gap);
  for(const P of POWERS){const mine=cands.filter(c=>c.p===P.i),pick=(role,ok,score)=>{let b=null;for(const c of mine)if(ok(c)&&free(c.u)){const v=score(c);if(!b||v>b.v)b={v,c}}
      if(b)SITES.push(mkSite(b.c.u,role,'s'+SITES.length))};
    if(P.i!==0)pick('eq',c=>true,c=>-Math.abs(c.lat)+25*c.east);
    pick('polar',c=>c.pol>.85,c=>c.pol-Math.abs(c.lat)/200+(c.coast?.1:0));
    pick('inland',c=>!c.coast,c=>-Math.abs(c.lat))}
  // the sea platform: a floating pad on the equator in open ocean (≥ 300 km from any land), the one nearest home.
  // Sea Launch's trick: any program, whatever its latitude, can reach the equator by ship.
  {let best=null;const home=SITES[0].u,far=Math.cos(300e3/R);
    for(let i=0;i<WTW;i+=2){const lo=(i+.5)/WTW*2*Math.PI-Math.PI,u=fromGen([Math.cos(lo),0,Math.sin(lo)]);if(!free(u))continue;
      if(terrainH(u)>-500)continue;let ok=true;for(let a=0;a<12&&ok;a++)for(const km of[100,200,300])if(isLand(alongAz(u,a*Math.PI/6,km*1e3/R))){ok=false;break}
      if(!ok)continue;const d=dot(u,home);if(!best||d>best.d)best={d,u}}
    if(best){const t=mkSite(best.u,'sea','s'+SITES.length);t.kind='sea';t.h=SEA_DECK;SITES.push(t)}}
  for(const t of SITES)finishSite(t)}
// terrain height (m above sea level; negative is sea floor) at a planet-fixed direction. Every pad is levelled: flat to
// PAD_FLAT, blended back to the land by PAD_BLEND (sites are ≥ SITE_GAP apart, so at most one is ever near).
function terrainH(pf,oct=HOCT){const c=norm(pf);let near=null,dmin=Infinity;
  for(const t of SITES){if(t.kind!=='pad')continue;const dx=c[0]-t.u[0],dy=c[1]-t.u[1],dz=c[2]-t.u[2],d=Math.sqrt(dx*dx+dy*dy+dz*dz)*TELLUS.R;if(d<dmin){dmin=d;near=t}}   // a sea platform floats: nothing to level
  if(dmin<PAD_FLAT)return near.h;const h=hgtGen(toGen(pf),oct);return dmin>PAD_BLEND?h:h+(near.h-h)*(1-sstep(PAD_FLAT,PAD_BLEND,dmin))}
// the ground under a planet-fixed point, as a radius: land, or the sea surface. Selene stays a smooth sphere for now.
const groundAlt=(b,pf)=>b===TELLUS?Math.max(0,terrainH(pf)):0;
const groundR=(b,pf)=>b.R+groundAlt(b,pf);
// ground awareness: what must be measured from the ground under the ship, not from the sea. Atmosphere thresholds
// (physAlt, drag bands, the air's top) stay sea-level based; landing-related ones use these.
const MAIN_AGL=3000;   // the main chute opens below this height above the ground (with a 250 m/s cap)
const aglAt=(b,r,t)=>len(r)-b.R-groundAlt(b,toPF(b,r,t));   // height above the ground (or sea) under r, at time t
const mainChuteOK=(b,h,r,t)=>h<TERR_TOP+MAIN_AGL&&aglAt(b,r,t)<MAIN_AGL;   // h is the sea-level height (a cheap early out)
// the gap between the ship's bottom and the ground under it (the warp's time-to-ground uses this)
const groundGap=s=>aglAt(s.body,s.r,simT)+s.yBot;
// ---- recovery by geography (slice D): a vessel that came home whole still has to be collected. At sea, a ship must
// reach it: the recovery fleet's range from the launch point when built, otherwise local boats (RECOVER_LOCAL). On our
// land or no one's, it's trucked home. On another power's land it depends on relations: friendly powers return it,
// tense ones return it worn after long talks, hostile ones keep it. The factor scales the refurbishment refund.
const RECOVER_LOCAL=200e3;
function recoveryOf(s,R){if(s.body!==TELLUS||!s.landed)return{factor:1,kind:'n/a',why:''};const u=norm(s.pf);
  if(s.water){const from=R&&R.launchPf?norm(R.launchPf):(s.site||SITES[0]).u,d=Math.acos(clamp(dot(u,from),-1,1))*TELLUS.R,
      lv=typeof facLv==='function'?facLv('fleet'):0,reach=Math.max(RECOVER_LOCAL,lv?FAC.fleet.range[lv]:0);
    return d<=reach?{factor:1,kind:'sea',why:`fished out of the sea ${(d/1e3).toFixed(0)} km out`}:{factor:0,kind:'lost',why:`came down ${(d/1e3).toFixed(0)} km out at sea, beyond our ships' reach (${(reach/1e3).toFixed(0)} km): lost`}}
  const p=powerAt(u);if(!p||p.i===HOME)return{factor:1,kind:'land',why:''};
  const rel=relOf(HOME,p.i);
  if(rel>=0)return{factor:1,kind:'returned',why:`landed in ${p.name}, which sends it back`};
  if(rel>=-0.2)return{factor:0.8,kind:'returned',why:`landed in ${p.name}: returned, worn, after long talks`};
  return{factor:0,kind:'kept',why:`landed in ${p.name}, which keeps it`}}
// ---- ground stations on real ground (slice C). A station's antenna stands GS_MAST above its ground; it sees a target
// above the higher of its minimum elevation (STA_MIN, 5°) and the terrain's horizon in that direction (mountains mask
// low passes). The horizon mask, 36 azimuths out to 300 km, is computed once per station and cached.
// Near field (GS_NEAR): the minimum elevation and the horizon mask describe long, low paths that graze the ground far
// away. A target within a couple of km of the antenna (its own pad, the first seconds of a climb, a rocket still below
// the mast top) is in direct line of sight over flat ground, so the station sees it (fixes session, PLAYTEST #19).
const GS_MAST=20,GS_AZ=36,GS_REACH=300e3,GS_NEAR=2000,BLACKOUT_Q=5e4,gsMasks=new Map();
// re-entry plasma: hot air (stagnation flux over BLACKOUT_Q) AND fast enough to ionise it. Dense air reaches that flux at
// ~1 km/s on an ordinary climb (PLAYTEST #17: Mach 3.5 at 20 km); ionisation wants orbital-class speed. The shuttle's
// blackout ended near 5 of 7.8 km/s, so ~2/3 of circular speed at the top of the air, scaled to this world: ~2.2 km/s.
// Measured: hot ascents peak at 1.7 km/s, an orbital entry is hot from 3.1 down to 1.1 km/s. aerofx: the shell can use it.
const PLASMA_V=Math.round(0.65*Math.sqrt(TELLUS.mu/(TELLUS.R+TELLUS.atm))),plasmaOn=s=>s.qHeat>BLACKOUT_Q&&len(sub(s.v,surfVel(TELLUS,s.r)))>PLASMA_V;
function gsMask(st){const key=st.u.map(x=>x.toFixed(6)).join(',');let m=gsMasks.get(key);if(m)return m;
  const R=TELLUS.R,h0=groundAlt(TELLUS,st.u)+GS_MAST;m={h0,el:new Float32Array(GS_AZ)};
  for(let a=0;a<GS_AZ;a++){let mx=-1;for(let k=1;k<=24;k++){const d=GS_REACH*Math.pow(k/24,1.6),q=alongAz(st.u,a*2*Math.PI/GS_AZ,d/R);
      const e=Math.atan2(groundAlt(TELLUS,q)-h0-d*d/(2*R),d);if(e>mx)mx=e}m.el[a]=mx}
  gsMasks.set(key,m);return m}
// does station st see the planet-fixed position pf (a vector from Tellus's centre)?
function gsSees(st,pf){const m=gsMask(st),P=mul(st.u,TELLUS.R+m.h0),d=sub(pf,P),dl=len(d);if(dl<GS_NEAR)return true;
  const sinE=dot(d,st.u)/dl;if(sinE<STA_MIN)return false;
  const f=siteFrame(st.u),az=Math.atan2(dot(d,f.e),dot(d,f.n)),i=Math.round(((az+2*Math.PI)%(2*Math.PI))/(2*Math.PI)*GS_AZ)%GS_AZ;
  return Math.asin(clamp(sinE,-1,1))>m.el[i]}
// the flight's radio link: the first station that sees the vessel, or a plasma blackout during re-entry heating. Away
// from Tellus (Selene, Nyx) the deep-space antennas are assumed to hold the link.
function linkOf(s){if(s.body!==TELLUS)return{ok:true,st:null,why:'deep space'};if(s.landed)return{ok:true,st:null,why:'on the ground'};
  if(plasmaOn(s))return{ok:false,st:null,why:'plasma blackout'};
  const pf=toPF(TELLUS,s.r,simT);for(const st of stationsAll())if(gsSees(st,pf))return{ok:true,st,why:''};return{ok:false,st:null,why:'no station in view'}}
// compatibility with the old land mask: ≥ .52 is land, ≥ .58 is "safely inland" (now: 40 m above the sea)
const landValue=pf=>.52+terrainH(pf)/700;
const isLand=pf=>terrainH(pf)>=0;
// biomes, for colours, science and landing: the same thresholds the shader blends between
const BIOMES=['sea','ice','tundra','taiga','steppe','temperate forest','grassland','cold desert','rainforest','savanna','hot desert','alpine','volcanic','salt flat','wetland'];
// what the ground is like to land on, per biome (index as BIOMES): mu = friction (a vessel stands on slopes up to
// atan(mu), and never past TOPPLE), soft = extra touchdown speed the ground forgives (m/s; negative: harder than
// usual), rough = the share of ~20 m cells with boulders or trees, which add 2–6 m/s to the effective touchdown.
const SURF=[{mu:1,soft:2,rough:0},{mu:.1,soft:0,rough:0},{mu:.45,soft:1,rough:.05},{mu:.5,soft:0,rough:.35},{mu:.55,soft:1,rough:.03},
  {mu:.5,soft:0,rough:.4},{mu:.55,soft:1,rough:.02},{mu:.55,soft:1,rough:.08},{mu:.5,soft:0,rough:.6},{mu:.55,soft:1,rough:.05},
  {mu:.45,soft:3,rough:.02},{mu:.6,soft:0,rough:.3},{mu:.7,soft:-2,rough:.3},{mu:.6,soft:0,rough:0},{mu:.3,soft:4,rough:.05}];
const SURF_PAD={name:'launch pad',mu:.8,soft:0,rough:0},SURF_MOON={name:'regolith',mu:.6,soft:1,rough:.15},TOUCH_MAX=12;   // regolith: boulders in 15% of cells
// the ground under a planet-fixed point, as a landing surface: a levelled pad, the sea, or the biome's
function surfaceAt(b,pf){if(b!==TELLUS)return SURF_MOON;const u=norm(pf);
  if(SITES.some(t=>{if(t.kind!=='pad')return false;const dx=u[0]-t.u[0],dy=u[1]-t.u[1],dz=u[2]-t.u[2];return Math.sqrt(dx*dx+dy*dy+dz*dz)*TELLUS.R<PAD_FLAT}))return SURF_PAD;
  const bi=biomeAt(u),su={name:bi.name,id:bi.id,...SURF[bi.id]};
  // snow lies where the shader paints it: colder than ~−3 °C at that height, on slopes under ~38° (ice is its own biome)
  if(bi.id!==1&&bi.h>=0&&bi.T<-2.75&&terrainSlope(b,u)<0.66)return{name:'snow',id:bi.id,mu:.3,soft:3,rough:su.rough*.3};
  return su}
// boulders or trees where the ship comes down: decided per ~20 m cell (deterministic, so tapes replay the same)
function surfaceHit(su,pf,b=TELLUS){if(!su.rough)return 0;const g=mul(norm(pf),b.R/20),x=Math.floor(g[0]),y=Math.floor(g[1]),z=Math.floor(g[2]);
  return ih3(x,y,z+501)<su.rough?2+4*ih3(x,y,z+502):0}
function biomeAt(pf){const g=toGen(pf),h=terrainH(pf),w4=wSpl(g),e0=w4[0],Tc=wBil(WORLD.T,g)-6.5*Math.max(0,h-Math.max(e0,0))/1000,Wm=wBil(WORLD.W,g),m=w4[1],v=w4[2],sf=w4[3];
  let id;if(h<0)id=0;else if(Tc<-13)id=1;else if(h>2800&&Tc<2)id=11;else if(v>.5&&h>300)id=12;else if(sf>.5)id=13;else if(Wm>.75&&h<60&&m<.1&&Tc>5)id=14;
  else if(Tc<-1)id=2;else if(Tc<7)id=Wm>.35?3:4;else if(Tc<18)id=Wm>.55?5:Wm>.3?6:7;else id=Wm>.72?8:Wm>.36?9:10;
  return{id,name:BIOMES[id],h,T:Tc,wet:Wm}}
// the steepest the ground gets under a point (radians), from the height field over ±15 m; landings past TOPPLE tip over
const TERR_TOP=Math.ceil(WORLD.U.reduce((a,b)=>Math.max(a,b),0)/100)*100,TOPPLE=0.42;   // the highest the ground can be anywhere (from the air bound)
function terrainSlope(b,pf){if(b!==TELLUS)return 0;const u=norm(pf),e=norm(cross([0,1,0],u).map((x,i)=>x+(i===0?1e-9:0))),n=cross(u,e),k=15/TELLUS.R,
  h0=groundAlt(b,u),hx=groundAlt(b,add(u,mul(e,k)))-groundAlt(b,sub(u,mul(e,k))),hy=groundAlt(b,add(u,mul(n,k)))-groundAlt(b,sub(u,mul(n,k)));
  return Math.atan(Math.hypot(hx,hy)/30+0*h0)}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const SYL=['va','lo','ri','an','mar','tel','os','ka','ne','bru','dun','sel','fen','or','is','pa','quel','tor','ven','al','hav','em','ly','gor'];
function makeCities(seed=7,n=32){const R=rng(seed),out=[],site=SITES[0].u;let tries=0;
  while(out.length<n&&tries++<20000){const z=R()*2-1,ph=R()*6.2832,q=Math.sqrt(1-z*z),pf=[q*Math.cos(ph),z*0.85,q*Math.sin(ph)],u=norm(pf);
    if(Math.abs(u[1])>0.8||landValue(u)<0.58)continue;                       // inland enough that float noise can't put it at sea
    if(Math.acos(dot(u,site))*TELLUS.R<160e3)continue;                        // not on top of the pad
    if(out.some(c=>Math.acos(clamp(dot(u,c.u),-1,1))*TELLUS.R<260e3))continue;
    const pop=Math.round(Math.exp(11+R()*3.3)/1000)*1000,nm=SYL[R()*SYL.length|0]+SYL[R()*SYL.length|0]+(R()<.35?' '+['Bay','Falls','Port','Heights','Cross'][R()*5|0]:'');
    out.push({name:nm[0].toUpperCase()+nm.slice(1),u,pop,rad:2500+5200*Math.sqrt(pop/1e6),seed:R()*1e9|0})}
  return out}
const CITIES=makeCities();
function nearestCity(pf){const u=norm(pf);let best=null,bd=Infinity;for(const c of CITIES){const d=Math.acos(clamp(dot(u,c.u),-1,1))*TELLUS.R;if(d<bd){bd=d;best=c}}return{city:best,dist:bd}}
// where a falling thing comes down: in a city, near one, at sea or in open country
function dropVerdict(b,pf){if(b!==TELLUS)return{kind:'away',where:b.name};const{city,dist}=nearestCity(pf);
  if(dist<city.rad)return{kind:'city',city,dist,power:city.power};if(dist<city.rad+15e3)return{kind:'near',city,dist,power:city.power};const pw=powerAt(pf);return{kind:pw?'land':'sea',city,dist,power:pw}}
