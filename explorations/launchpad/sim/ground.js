// sim/ground.js — the ground of bodies other than Tellus (ends with SIM END). Part of index.html's script, a classic
// script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- Selene's ground (GROUND.md, slice G2). A recipe in the shape of slice G1's (`gen`, `top`): a baked map for what
// is bigger than ~20 km (highland swell, the big craters, the maria flooded into the mare mask) plus procedural crater
// bands below that, on the integer hash, so the shader can compute the same numbers later (G3).
// NOT LIVE YET: SELENE.ground stays unset until the sky shader draws this relief (G3), or ships would land on hills
// nobody can see. Tests and study_ground.mjs set SELENE.ground = SELENE_GROUND in their own copies of the SIM.
const GR_C=0.055;   // crater count: N(>D) = GR_C·D⁻² per km², D in km (the Moon's highlands: ~5,200 craters ≥ 20 km)
const GR_DT=18e3*1.62;   // simple → complex at 18 km on the Moon (g 1.62); the size goes as 1/g, so GR_DT/g
const GR_BANDS=[20e3,8e3,3.2e3,1280,512,205];   // procedural bands: the largest crater of each (m); each band runs down to the next
const GR_MARE_THIN=0.85;   // procedural craters on mare: the plains are younger, so 85 % fewer
const GR_EXP=1.6;   // a simple bowl is -d + (d+rim)·r^GR_EXP inside: 37° at a fresh rim, about the angle of repose
// (a paraboloid, 2, gave 43° at the rim and up to 58° where craters overlap; study_ground.mjs)
// a crater's height at r = distance / its radius (metres; D its diameter in m, Dt the simple → complex size, fr its
// freshness 0–1). Inside: a bowl, or for complex craters a flat floor, a steeper wall and a central peak. Outside:
// the ejecta blanket, rim·r⁻³, faded out by r = 2 (so a crater reaches D from its centre: the band cells rely on it).
function craterH(r,D,Dt,fr){if(r>=2)return 0;
  const simple=D<Dt,d=(simple?.2*D:.138*Dt*(D/Dt)**.301)*(.3+.7*fr),rim=(simple?.036*D:.042*Dt*(D/Dt)**.399)*(.2+.8*fr);
  if(r>=1)return rim/(r*r*r)*(1-sstep(1.4,2,r));
  if(simple)return-d+(d+rim)*r**GR_EXP;
  const f=.35,w=r<f?0:(r-f)/(1-f);let h=-d+(d+rim)*w*w;
  if(D>1.4*Dt&&r<.18){const q=1-(r/.18)**2;h+=.5*d*q*q}   // central peak
  return h}
// the baked map: equirectangular W×H (Selene: ~2.1 km a texel at 1024×512), read like Tellus's (wBil / wSpl's B-spline)
function mapBil(A,W,H,u){const x=(Math.atan2(u[2],u[0])/(2*Math.PI)+.5)*W-.5,y=(Math.asin(clamp(u[1],-1,1))/Math.PI+.5)*H-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const i0=(ix+W)%W,i1=(ix+1)%W,j0=Math.max(iy,0)*W,j1=Math.min(iy+1,H-1)*W,a=A[j0+i0]+(A[j0+i1]-A[j0+i0])*fx;return a+(A[j1+i0]+(A[j1+i1]-A[j1+i0])*fx-a)*fy}
function mapSpl(A,W,H,u){const x=(Math.atan2(u[2],u[0])/(2*Math.PI)+.5)*W-.5,y=(Math.asin(clamp(u[1],-1,1))/Math.PI+.5)*H-.5,ix=Math.floor(x+.5),iy=Math.floor(y+.5),wx=bsq(x-ix),wy=bsq(y-iy);let o=0;
  for(let b=0;b<3;b++){const j=clamp(iy-1+b,0,H-1)*W;for(let a=0;a<3;a++)o+=A[j+(ix-1+a+W*2)%W]*wx[a]*wy[b]}return o}
const mapU=(W,H,i,j)=>{const lo=((i+.5)/W-.5)*2*Math.PI,la=((j+.5)/H-.5)*Math.PI;return[Math.cos(la)*Math.cos(lo),Math.sin(la),Math.cos(la)*Math.sin(lo)]};
// stamp one crater into a map: inside its rim the old ground is replaced by the crater sitting on the ground at its
// centre (so overlapping craters erase what they land on); outside, its ejecta adds
function mapCrater(E,W,H,R,c,D,Dt,fr){const ang=D/R,la0=Math.asin(c[1]),j0=Math.max(0,Math.floor((la0-ang)/Math.PI*H+H/2-1)),j1=Math.min(H-1,Math.ceil((la0+ang)/Math.PI*H+H/2+1));
  const base=mapBil(E,W,H,c);
  for(let j=j0;j<=j1;j++){const la=((j+.5)/H-.5)*Math.PI,cl=Math.cos(la),span=cl*Math.cos(la0)<1e-6?Math.PI:Math.min(Math.PI,ang/Math.max(cl,1e-6)+2*Math.PI/W*2);
    const lo0=Math.atan2(c[2],c[0]),i0=Math.floor((lo0-span)/(2*Math.PI)*W+W/2),i1=Math.ceil((lo0+span)/(2*Math.PI)*W+W/2);
    for(let ii=i0;ii<=i1;ii++){const i=(ii%W+W)%W,u=mapU(W,H,i,j),r=Math.acos(clamp(dot(u,c),-1,1))*R/(D/2);if(r>=2)continue;const k=j*W+i,h=craterH(r,D,Dt,fr);
      if(r>=1)E[k]+=h;else{const s=sstep(1,.7,r);E[k]=E[k]*(1-s)+(base+h)*s+h*(1-s)}}}}
// The map: highland swell, old big craters, the maria flooded (to a gently domed plain ~1.4 km down), then the young
// big craters on top of everything. Baked on first use (about a second), never at load.
let SEL_MAP=null;
function seleneMap(){if(SEL_MAP)return SEL_MAP;const W=1024,H=512,R=SELENE.R,g=SELENE.mu/(R*R),Dt=GR_DT/g,E=new Float32Array(W*H),M=new Float32Array(W*H),rnd=rng(4242);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const u=mapU(W,H,i,j),k=j*W+i;M[k]=selMare(u);E[k]=1800*(tfbm(u[0]*2.5+40,u[1]*2.5+40,u[2]*2.5+40,5)-.5)}
  const area=4*Math.PI*(R/1000)**2,n=Math.round(GR_C/400*area),cr=[];   // N(>20 km)
  for(let q=0;q<n;q++){const z=2*rnd()-1,t=2*Math.PI*rnd(),s=Math.sqrt(1-z*z),x=rnd(),D=1000/Math.sqrt(1/400-x*(1/400-1/150**2));
    cr.push({c:[s*Math.cos(t),z,s*Math.sin(t)],D,fr:rnd()**3,young:rnd()<.15})}
  for(const c of cr)if(!c.young)mapCrater(E,W,H,R,c.c,c.D,Dt,c.fr);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const k=j*W+i,m=sstep(.05,.5,M[k]);if(!m)continue;const u=mapU(W,H,i,j),fl=-1400+500*(tfbm(u[0]*9+7,u[1]*9+7,u[2]*9+7,3)-.5);E[k]+=(fl-E[k])*m}
  for(const c of cr)if(c.young)mapCrater(E,W,H,R,c.c,c.D,Dt,c.fr);
  let lo=Infinity,hi=-Infinity;for(const v of E){if(v<lo)lo=v;if(v>hi)hi=v}
  return SEL_MAP={W,H,E,M,Dt,craters:cr,lo,hi}}
// The procedural bands. Cells are on an equiangular cube (6 faces × n×n per band, near-equal in area); each cell holds
// at most one crater (the expected count per cell, c·area·(Dlo⁻²−Dhi⁻²), is about 0.38 at the Moon's c). A crater reaches D
// from its centre, and D ≤ 0.8 of a cell's arc (the narrowest cell, at a cube corner, is 0.82 of it), so a point sees every
// crater that touches it in the 3×3 cells around it, on each face whose cells come near it (up to three, at a cube corner).
// Integer hash only, so the shader can compute the same craters (G3). Per body: its radius, its crater density c, a hash
// salt (so two bodies don't share craters), how eroded its craters are (freshness = hash^frPow), and thin(centre), the
// chance a crater is missing there (young plains, ice).
const grBandsOf=(R,c)=>{const out=[];for(const D0 of GR_BANDS){const n=Math.ceil(Math.PI/2*R*.8/D0);out.push({n,Dhi:.8*Math.PI/2*R/n})}
  out.forEach((b,i)=>{b.Dlo=i+1<out.length?out[i+1].Dhi:b.Dhi/2.5;b.lam=c*(4*Math.PI*(R/1000)**2/6/(b.n*b.n))*(1/(b.Dlo/1000)**2-1/(b.Dhi/1000)**2)});return out};
const GR_BCACHE=new Map(),grBands=(R,c=GR_C)=>{const k=R+'|'+c;return GR_BCACHE.get(k)||(GR_BCACHE.set(k,grBandsOf(R,c)),GR_BCACHE.get(k))};
const GR_FACE=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];   // axis, then the face's two in-plane axes
function craterBands(u,R,Dt,thin,bands=GR_BANDS.length,c=GR_C,salt=0,frPow=3){let h=0;
  const BS=grBands(R,c),s0=7001+salt*16;for(let b=0;b<bands;b++){const{n,Dhi,Dlo,lam}=BS[b],mg=3/n;
    for(let ax=0;ax<3;ax++){const ua=u[ax];if(Math.abs(ua)<.5)continue;const sg=ua>0?1:-1,f=ax*2+(sg>0?0:1),[,p1,p2]=GR_FACE[ax*2],
        A=4/Math.PI*Math.atan(u[p1]/Math.abs(ua)),B=4/Math.PI*Math.atan(u[p2]/Math.abs(ua));
      if(Math.abs(A)>1+mg||Math.abs(B)>1+mg)continue;
      const ci=Math.floor((A+1)/2*n),cj=Math.floor((B+1)/2*n);
      for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=n||j>=n)continue;
        const key=f*65536+i,zz=j*8+b*131072;if(ih3(key,zz,s0)>=lam)continue;
        const a=Math.tan(((i+ih3(key,zz,s0+1))/n*2-1)*Math.PI/4),c2=Math.tan(((j+ih3(key,zz,s0+2))/n*2-1)*Math.PI/4),cv=[0,0,0];cv[ax]=sg;cv[p1]=a;cv[p2]=c2;const cu=norm(cv);
        const dx=u[0]-cu[0],dy=u[1]-cu[1],dz=u[2]-cu[2],D=1/Math.sqrt(1/(Dlo*Dlo)-ih3(key,zz,s0+3)*(1/(Dlo*Dlo)-1/(Dhi*Dhi))),r=Math.sqrt(dx*dx+dy*dy+dz*dz)*R/(D/2);
        if(r>=2)continue;if(thin&&ih3(key,zz,s0+4)<thin(cu))continue;
        h+=craterH(r,D,Dt,ih3(key,zz,s0+5)**frPow)}}}
  return h}
// Selene's height above R at a planet-fixed point (any length)
const selThin=m=>cu=>GR_MARE_THIN*sstep(.05,.5,mapBil(m.M,m.W,m.H,cu));   // fewer craters on the young plains (as flooded)
function seleneH(pf,bands){const u=norm(pf),m=seleneMap();return mapSpl(m.E,m.W,m.H,u)+craterBands(u,SELENE.R,m.Dt,m.thin||(m.thin=selThin(m)),bands)}
GROUND_GEN.selene=pf=>seleneH(pf);
const SELENE_GROUND={gen:'selene',top:4000};   // top: an upper bound (sampled max 1.3 km), checked in test ground-2

// ---- the planets (GROUND.md G7). No planet is in the body tree yet (the space lane's Q87), so each recipe has a stub with
// SYSTEM.md's radius and surface gravity; the real body takes the recipe over (`ground: ENYO_GROUND`). Names and numbers
// are SYSTEM.md's; change them there first. NOT LIVE: nothing draws these yet (G3, Q79).
const GROUND_STUBS={Enyo:{name:'Enyo',R:6.78e5,g:3.72}};
const llU=(la,lo)=>{const a=la*Math.PI/180,o=lo*Math.PI/180;return[Math.cos(a)*Math.cos(o),Math.sin(a),Math.cos(a)*Math.sin(o)]};
const angTo=(u,c)=>Math.acos(clamp(u[0]*c[0]+u[1]*c[1]+u[2]*c[2],-1,1));
// big craters for a map: n of them with N(>D) ∝ D⁻² from 20 km to Dmax, uniform over the sphere
function bigCraters(rnd,R,c,Dmax,youngShare){const n=Math.round(c/400*4*Math.PI*(R/1000)**2),cr=[];
  for(let q=0;q<n;q++){const z=2*rnd()-1,t=2*Math.PI*rnd(),s=Math.sqrt(1-z*z),x=rnd(),D=1000/Math.sqrt(1/400-x*(1/400-1/(Dmax/1000)**2));
    cr.push({c:[s*Math.cos(t),z,s*Math.sin(t)],D,fr:rnd()**3,young:rnd()<youngShare})}
  return cr}
// a shield volcano at r = distance / its radius: concave flanks, a basal scarp, a flat-floored summit caldera
function shieldH(r,H,scarp,cal){if(r>=1)return 0;let h=H*(1-r)**1.4+scarp*sstep(1,.95,r);
  if(r<cal*1.25){const fl=H*(1-cal)**1.4+scarp-H*.16;h=Math.min(h,fl+(h-fl)*sstep(cal,cal*1.25,r))}
  return h}

// Enyo (Mars): SYSTEM.md § Enyo. R 678 km, g 3.72, so simple craters turn complex at 7.8 km, as on Mars (~7 km).
// The map, in order (heights above R, which is the datum): southern highlands (+1.2 km ± 1.2) with old craters (c 0.02, Mars's highlands: a third of the Moon's)
// and one big basin (Hellas, 520 km); the northern lowlands flooded to −3.2 km over a warped dichotomy line (37 % of the
// globe); the Tharsis bulge (+4.5 km) with a giant shield (340 km across, 14 km high on a 3 km scarp, a summit caldera), three
// smaller shields in a line and one more far off (Elysium); the canyon, 1,400 km along a great circle (a third of the globe),
// up to 5.5 km deep, its walls terraced in 550 m layers (layered sediment); the young craters; the polar caps (a 2.6 km ice
// dome in the north, a smaller one in the south). Channels: E height, Y young surface (the chance a band crater is
// missing), C ice, D dune fields, V volcanic plains, K canyon, L lowland (for the units).
const EN={c:.02,salt:1,frPow:4,seed:707,dich:.25,hi:1200,lo:-3200,bulge:[0,-110,4500,.55],
  shield:{at:[18,-133],R:170e3,H:14e3,scarp:3e3,cal:.18},montes:[[-9,-121],[1,-113],[12,-104]],montesR:75e3,montesH:9e3,elysium:{at:[25,147],R:70e3,H:6e3},
  canyon:{from:[-12,-95],len:1.4e6,w:50e3,depth:5500,layer:550},hellas:{at:[-42,70],D:520e3},capN:[.975,2600],capS:[-.996,1500],dune:{lam:400,h:25}};
let ENYO_MAP=null;
function enyoMap(){if(ENYO_MAP)return ENYO_MAP;const B=GROUND_STUBS.Enyo,R=B.R,Dt=GR_DT/B.g,W=1024,H=512,N=W*H,rnd=rng(EN.seed),
    E=new Float32Array(N),Y=new Float32Array(N),C=new Float32Array(N),D=new Float32Array(N),V=new Float32Array(N),K=new Float32Array(N),L=new Float32Array(N),U=[];
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const u=mapU(W,H,i,j),k=j*W+i;U[k]=u;
    L[k]=sstep(-.12,.12,u[1]-EN.dich+.6*(tfbm(u[0]*1.2+71,u[1]*1.2+71,u[2]*1.2+71,4)-.5));
    E[k]=EN.hi+2*EN.hi*(tfbm(u[0]*2.5+60,u[1]*2.5+60,u[2]*2.5+60,5)-.5)}
  const cr=bigCraters(rnd,R,EN.c,250e3,.25),hel=llU(...EN.hellas.at);
  mapCrater(E,W,H,R,hel,EN.hellas.D,Dt,1);
  for(const c of cr)if(!c.young)mapCrater(E,W,H,R,c.c,c.D,Dt,c.fr*.6);   // old and worn
  const bc=llU(EN.bulge[0],EN.bulge[1]),sv=llU(...EN.shield.at),mo=EN.montes.map(a=>llU(...a)),el=llU(...EN.elysium.at),
    ca=llU(...EN.canyon.from),ce=norm(cross(ca,[0,1,0])),cn=norm(cross(ca,ce));   // the canyon's great circle: from ca toward
    // increasing longitude, away from Tharsis (in this codebase east is *decreasing* atan2(z,x): NOTES § v1.25)
  for(let k=0;k<N;k++){const u=U[k];E[k]+=(EN.lo+600*(tfbm(u[0]*6+9,u[1]*6+9,u[2]*6+9,3)-.5)-E[k])*L[k];
    const gb=Math.exp(-((angTo(u,bc)/EN.bulge[3])**2));E[k]+=EN.bulge[2]*gb;
    let v=0;const add=(c,Rs,Hs,sc,cal)=>{const r=angTo(u,c)*R/Rs;if(r<1){E[k]+=shieldH(r,Hs,sc,cal);v=Math.max(v,sstep(1,.8,r))}};
    add(sv,EN.shield.R,EN.shield.H,EN.shield.scarp,EN.shield.cal);for(const m of mo)add(m,EN.montesR,EN.montesH,0,.2);add(el,EN.elysium.R,EN.elysium.H,0,.15);
    V[k]=Math.max(v,sstep(.3,.6,gb));
    // the canyon: s along the arc, d across it; walls terraced in layers, the floor flat
    const s=Math.atan2(dot(u,ce),dot(u,ca))*R,dA=Math.asin(clamp(dot(u,cn),-1,1))*R;let fl=0;
    if(s>-50e3&&s<EN.canyon.len+50e3){const w=EN.canyon.w*(.6+.8*tfbm(s/150e3,3.3,7.7,3)),tap=sstep(0,150e3,s)*sstep(EN.canyon.len,EN.canyon.len-200e3,s),x=Math.abs(dA)/w;
      if(x<1.3&&tap>0){const f=sstep(1,.75,x)*tap,q=EN.canyon.depth*f/EN.canyon.layer,qi=Math.floor(q);E[k]-=EN.canyon.layer*(qi+sstep(.6,1,q-qi));fl=sstep(.9,1,f);K[k]=f}}
    // ice: the caps (warped edges), and the erg around the north cap; dunes also on Hellas's floor and the canyon's
    const wv=.012*(tfbm(u[0]*8+3,u[1]*8+3,u[2]*8+3,3)-.5)*2,cN=sstep(EN.capN[0]-.01,EN.capN[0]+.005,u[1]+wv),cS=sstep(EN.capS[0]+.004,EN.capS[0]-.002,u[1]+wv);
    E[k]+=EN.capN[1]*cN*sstep(EN.capN[0],.999,u[1])+EN.capS[1]*cS*sstep(EN.capS[0],-.9995,u[1]);C[k]=Math.max(cN,cS);
    const erg=sstep(.93,.95,u[1])*sstep(.975,.96,u[1])*sstep(.45,.6,tfbm(u[0]*10+5,u[1]*10+5,u[2]*10+5,3));
    D[k]=Math.max(erg,sstep(.2,.12,angTo(u,hel))*sstep(.45,.6,tfbm(u[0]*14+8,u[1]*14+8,u[2]*14+8,3)),fl)*(1-C[k]);
    Y[k]=Math.max(.75*L[k],V[k],C[k],fl)}
  for(const c of cr)if(c.young&&mapBil(C,W,H,c.c)<.5)mapCrater(E,W,H,R,c.c,c.D,Dt,c.fr);
  let lo=Infinity,hi=-Infinity;for(const v of E){if(v<lo)lo=v;if(v>hi)hi=v}
  return ENYO_MAP={W,H,E,Y,C,D,V,K,L,Dt,craters:cr,lo,hi,thin:cu=>mapBil(Y,W,H,cu)}}
// dunes: wind-aligned ridges, 400 m apart and up to 25 m high, a gentle stoss and a steep lee, crests warped. A fixed 3D
// direction keeps them seamless (no longitude wrap); their orientation varies over the globe, as real ergs' does.
const DUNE_K=norm([1,.3,.7]);
function dunesH(u,R,lam,h){const p0=u[0]*R,p1=u[1]*R,p2=u[2]*R,s=(p0*DUNE_K[0]+p1*DUNE_K[1]+p2*DUNE_K[2]+8000*(tfbm(p0/3e4,p1/3e4,p2/3e4,3)-.5))/lam,x=s-Math.floor(s);
  return h*(x<.8?x/.8:(1-x)/.2)*(.5+.5*tfbm(p0/2e4+3,p1/2e4,p2/2e4,2))}
function enyoH(pf,bands){const u=norm(pf),m=enyoMap(),R=GROUND_STUBS.Enyo.R,d=mapBil(m.D,m.W,m.H,u);
  return mapSpl(m.E,m.W,m.H,u)+craterBands(u,R,m.Dt,m.thin,bands,EN.c,EN.salt,EN.frPow)+(d>0?d*dunesH(u,R,EN.dune.lam,EN.dune.h):0)}
GROUND_GEN.enyo=pf=>enyoH(pf);
const ENYO_UNITS=['polar ice','dunes','volcanic','canyon','lowland plains','highlands'];
function enyoUnit(u){const m=enyoMap(),b=A=>mapBil(A,m.W,m.H,u);if(b(m.C)>.5)return'polar ice';if(b(m.K)>.3)return'canyon';if(b(m.D)>.3)return'dunes';if(b(m.V)>.5)return'volcanic';
  return b(m.L)>.5?'lowland plains':'highlands'}
const ENYO_SURF={'polar ice':{name:'water ice',mu:.25,soft:2,rough:.02},dunes:{name:'dune sand',mu:.5,soft:4,rough:0},volcanic:{name:'basalt',mu:.7,soft:-2,rough:.3},
  canyon:{name:'layered sediment',mu:.6,soft:0,rough:.2},'lowland plains':{name:'dusty plains',mu:.6,soft:2,rough:.08},highlands:{name:'dusty regolith',mu:.6,soft:1,rough:.15}};
const ENYO_GROUND={gen:'enyo',top:15000,surf:pf=>ENYO_SURF[enyoUnit(norm(pf))],unit:u=>enyoUnit(u)};   // top: checked in test ground-3
// Hesper (Venus): SYSTEM.md § Hesper. R 1,210 km, g 8.87 (simple → complex at 3.3 km). Seen only by landers and radar, so
// modest detail: a 7.4 km map plus a little procedural texture. The 90 bar air burns up small impactors and the surface is
// young, so craters are few, fresh and never under ~1.3 km: c 3e-5 (Venus: under a thousand craters in all; at Hesper's
// size ~140 over 2 km), only the three coarsest bands, no thinning. The map, in order: basalt plains (−0.5 km ± 0.4);
// slab-rock highlands (Venus's tesserae: blocks raised 2 km, ~10 % of the globe, with ridged texture added procedurally);
// one high massif (Maxwell Montes, to ~9 km); four broad, gentle shields (Maat Mons and kin: 150–200 km across, 4–7 km);
// three coronae (rings: a raised rim, a moat outside, a sagged centre); a cluster of pancake domes (25 km, 0.7 km, flat
// tops; blobs at this map's scale). Procedural on top: slab rock's ridges, the plains' wrinkle ridges, and lava channels: a narrow trough (~2 km wide at half depth, 80 m deep; measured) along the
// isolines of a warped noise, in some of the plains. Channels: E height, T slab rock, V volcanic, O corona.
GROUND_STUBS.Hesper={name:'Hesper',R:1.21e6,g:8.87};
const HE={c:3e-5,salt:2,frPow:1,bands:3,seed:909,plains:[-500,800],tess:[.635,.69,2000],massif:{at:[65,0],r:.08,h:7000},
  shields:[[0,-165,200e3,7e3],[-25,30,180e3,5e3],[22,-130,160e3,4.5e3],[-40,100,150e3,4e3]],coronae:[[-15,-60,150e3],[30,80,120e3],[-55,-150,180e3]],
  domes:{at:[-30,10],n:12,spread:.06,R:12.5e3,h:700},ridge:700,wrinkle:110,chan:{depth:80,half:.00045,lam:900e3}};
let HESPER_MAP=null;
function hesperMap(){if(HESPER_MAP)return HESPER_MAP;const B=GROUND_STUBS.Hesper,R=B.R,Dt=GR_DT/B.g,W=1024,H=512,N=W*H,rnd=rng(HE.seed),
    E=new Float32Array(N),T=new Float32Array(N),V=new Float32Array(N),O=new Float32Array(N);
  const ma=llU(...HE.massif.at),sh=HE.shields.map(s=>({c:llU(s[0],s[1]),R:s[2],H:s[3]})),co=HE.coronae.map(s=>({c:llU(s[0],s[1]),R:s[2]})),dc=llU(...HE.domes.at),dm=[];
  for(let q=0;q<HE.domes.n;q++){const e=norm(cross([0,1,0],dc)),n=cross(dc,e),a=HE.domes.spread*Math.sqrt(rnd()),t=2*Math.PI*rnd();
    dm.push(norm(add(dc,add(mul(e,a*Math.cos(t)),mul(n,a*Math.sin(t))))))}
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const u=mapU(W,H,i,j),k=j*W+i,gm=Math.exp(-((angTo(u,ma)/(HE.massif.r*2.2))**2));
    T[k]=Math.max(sstep(HE.tess[0],HE.tess[1],tfbm(u[0]*1.6+31,u[1]*1.6+31,u[2]*1.6+31,4)),sstep(.3,.6,gm));
    let e=HE.plains[0]+HE.plains[1]*(tfbm(u[0]*2+17,u[1]*2+17,u[2]*2+17,5)-.5)+HE.tess[2]*T[k]+HE.massif.h*Math.exp(-((angTo(u,ma)/HE.massif.r)**2)),v=0,o=0;
    for(const s of sh){const r=angTo(u,s.c)*R/s.R;if(r<1){e+=shieldH(r,s.H,0,.08);v=Math.max(v,sstep(1,.7,r))}}
    for(const c of co){const r=angTo(u,c.c)*R/c.R;if(r<1.4){e+=900*Math.exp(-(((r-.85)/.12)**2))-500*Math.exp(-(((r-1.05)/.07)**2))-200*sstep(.7,0,r);o=Math.max(o,sstep(1.3,1.1,r))}}
    for(const d of dm){const r=angTo(u,d)*R/HE.domes.R;if(r<1){e+=HE.domes.h*sstep(1,.8,r);v=Math.max(v,sstep(1,.6,r))}}
    E[k]=e;V[k]=v;O[k]=o}
  const cr=bigCraters(rnd,R,HE.c,60e3,1);for(const c of cr)mapCrater(E,W,H,R,c.c,c.D,Dt,c.fr);
  let lo=Infinity,hi=-Infinity;for(const v of E){if(v<lo)lo=v;if(v>hi)hi=v}
  return HESPER_MAP={W,H,E,T,V,O,Dt,craters:cr,lo,hi,thin:()=>0}}
// wrinkle ridges on the plains: thin, low ridges ~30 km apart (the ridged noise raised to a high power)
function hesperWrinkle(u,R){const f=1/30e3,r=1-Math.abs(2*tn(u[0]*R*f+21,u[1]*R*f+13,u[2]*R*f+17)-1);return r**8}
// lava channels: a trough along an isoline of a warped noise, where a second noise allows it (some of the plains only)
function hesperChan(u,R,m){const p=HE.chan.lam,x=u[0]*R/p,y=u[1]*R/p,z=u[2]*R/p,wv=tn(x*2.3+5,y*2.3+5,z*2.3+5)-.5,l=Math.abs(tn(x+wv*.9+11,y+wv*.9,z+wv*.9)-.5);
  if(l>HE.chan.half*2.5)return 0;const ok=sstep(.5,.6,tn(x*.7+40,y*.7,z*.7))*(1-mapBil(m.T,m.W,m.H,u))*(1-mapBil(m.V,m.W,m.H,u));return ok*sstep(HE.chan.half*1.6,HE.chan.half*.6,l)}
// slab rock's texture: ridged noise at ~12, 5.5 and 2.5 km, crossing (two directions), only on the slabs
function hesperRidge(u,R){let s=0,a=1,f=1/12e3;for(let o=0;o<3;o++){const r=1-Math.abs(2*tn(u[0]*R*f+3,u[1]*R*f*1.7+7,u[2]*R*f+1)-1),q=1-Math.abs(2*tn(u[0]*R*f*1.7+9,u[1]*R*f+2,u[2]*R*f*1.3+4)-1);s+=a*(r*r+q*q)*.5;a*=.5;f*=2.2}return s/1.75}
function hesperH(pf,bands=HE.bands){const u=norm(pf),m=hesperMap(),R=GROUND_STUBS.Hesper.R,t=mapBil(m.T,m.W,m.H,u);
  return mapSpl(m.E,m.W,m.H,u)+craterBands(u,R,m.Dt,null,Math.min(bands,HE.bands),HE.c,HE.salt,HE.frPow)+(t>0?t*HE.ridge*hesperRidge(u,R):0)+(t<1?(1-t)*HE.wrinkle*hesperWrinkle(u,R):0)-HE.chan.depth*hesperChan(u,R,m)}
GROUND_GEN.hesper=pf=>hesperH(pf);
const HESPER_UNITS=['mountains','slab rock','volcanic','corona','lava channel','plains'];
function hesperUnit(u){const m=hesperMap(),b=A=>mapBil(A,m.W,m.H,u),R=GROUND_STUBS.Hesper.R;if(b(m.T)>.5)return mapSpl(m.E,m.W,m.H,u)>5000?'mountains':'slab rock';
  if(b(m.V)>.5)return'volcanic';if(b(m.O)>.5)return'corona';return hesperChan(u,R,m)>.3?'lava channel':'plains'}
const HESPER_SURF={mountains:{name:'slab rock',mu:.75,soft:-2,rough:.4},'slab rock':{name:'slab rock',mu:.75,soft:-2,rough:.4},volcanic:{name:'lava flows',mu:.7,soft:-2,rough:.3},
  corona:{name:'fractured basalt',mu:.7,soft:-1,rough:.25},'lava channel':{name:'channel floor',mu:.65,soft:-1,rough:.05},plains:{name:'basalt plains',mu:.7,soft:-1,rough:.15}};
const HESPER_GROUND={gen:'hesper',top:12000,surf:pf=>HESPER_SURF[hesperUnit(norm(pf))],unit:u=>hesperUnit(u)};   // top: checked in test ground-4
// Astraea (Ceres): SYSTEM.md § Astraea. R 94 km, g 0.28, no air, near-spherical (no lump). By 1/g alone its craters would
// stay simple bowls to ~100 km, and a 100 km bowl would be 20 km deep on a 94 km body. Ceres's ice-rich crust is weak, so
// its craters turn complex at ~7.5–12 km (Dawn) and its big ones have relaxed shallow: a crust factor `crust` scales the
// transition (0.12: 12.5 km here), and above it the complex depth law keeps the biggest (~100 km) at ~3 km deep.
// c 0.03 (between Mars's and the Moon's; Ceres is heavily cratered, but short of big craters), crisp (freshness hash²).
// The map (512×256, 1.15 km a texel): a gentle swell (±1.5 km); the big craters (≥ 20 km, ~8 of them, up to 100 km);
// Ahuna Mons, the lonely mountain (4 km high, 20 km across, a flat top, flanks to ~38°); last, the young bright crater
// (Occator: 18 km, complex, a central pit, salt on its floor: the one bright spot on a charcoal-grey world).
// Channels: E height, S salt, A the mountain, Y young surface (where band craters are missing).
GROUND_STUBS.Astraea={name:'Astraea',R:9.4e4,g:.28};
const AS={c:.03,salt:3,frPow:2,crust:.12,seed:1201,swell:1500,Dmax:100e3,ahuna:{at:[-10,-45],R:10e3,H:4000,top:.25},occ:{at:[20,120],D:18e3}};
let ASTRAEA_MAP=null;
function astraeaMap(){if(ASTRAEA_MAP)return ASTRAEA_MAP;const B=GROUND_STUBS.Astraea,R=B.R,Dt=GR_DT/B.g*AS.crust,W=512,H=256,N=W*H,rnd=rng(AS.seed),
    E=new Float32Array(N),S=new Float32Array(N),A=new Float32Array(N),Y=new Float32Array(N);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const u=mapU(W,H,i,j);E[j*W+i]=2*AS.swell*(tfbm(u[0]*2+90,u[1]*2+90,u[2]*2+90,4)-.5)}
  const cr=bigCraters(rnd,R,AS.c,AS.Dmax,0);for(const c of cr)mapCrater(E,W,H,R,c.c,c.D,Dt,c.fr);
  const ah=llU(...AS.ahuna.at),oc=llU(...AS.occ.at),occR=AS.occ.D/2;
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const u=mapU(W,H,i,j),k=j*W+i,r=angTo(u,ah)*R/AS.ahuna.R;
    if(r<1){E[k]+=AS.ahuna.H*sstep(1,AS.ahuna.top,r)*(1+.03*(1-r));A[k]=sstep(1,.8,r)}}
  mapCrater(E,W,H,R,oc,AS.occ.D,Dt,1);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const u=mapU(W,H,i,j),k=j*W+i,r=angTo(u,oc)*R/occR;
    if(r<.12)E[k]-=1500*sstep(.12,.04,r);   // the central pit: at 18 km the crater has a central peak, collapsed here into a pit below the floor
    // salt: the floor's middle, blotchy (Cerealia, Vinalia), plus a little on the rim
    S[k]=r<.6?sstep(.6,.3,r)*sstep(.35,.55,tfbm(u[0]*400,u[1]*400,u[2]*400,3)+.25*sstep(.3,0,r)):0;Y[k]=Math.max(r<1.1?sstep(1.1,.9,r):0,A[k])}
  let lo=Infinity,hi=-Infinity;for(const v of E){if(v<lo)lo=v;if(v>hi)hi=v}
  return ASTRAEA_MAP={W,H,E,S,A,Y,Dt,craters:cr,lo,hi,thin:cu=>mapBil(Y,W,H,cu)}}
function astraeaH(pf,bands){const u=norm(pf),m=astraeaMap();return mapSpl(m.E,m.W,m.H,u)+craterBands(u,GROUND_STUBS.Astraea.R,m.Dt,m.thin,bands,AS.c,AS.salt,AS.frPow)}
GROUND_GEN.astraea=pf=>astraeaH(pf);
const ASTRAEA_UNITS=['salt deposits','mountain','regolith'];
function astraeaUnit(u){const m=astraeaMap(),b=X=>mapBil(X,m.W,m.H,u);return b(m.S)>.4?'salt deposits':b(m.A)>.5?'mountain':'regolith'}
const ASTRAEA_SURF={'salt deposits':{name:'salt deposits',mu:.5,soft:1,rough:.02},mountain:{name:'salty ice rubble',mu:.6,soft:0,rough:.3},regolith:{name:'dark regolith',mu:.6,soft:1,rough:.15}};
const ASTRAEA_GROUND={gen:'astraea',top:6000,surf:pf=>ASTRAEA_SURF[astraeaUnit(norm(pf))],unit:u=>astraeaUnit(u)};   // top: checked in test ground-5
// ==== SIM END
