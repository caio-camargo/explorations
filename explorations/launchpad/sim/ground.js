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
// at most one crater (the expected count per cell, GR_C·area·(Dlo⁻²−Dhi⁻²), is about 0.38). A crater reaches D from its
// centre, and D ≤ 0.8 of a cell's arc (the narrowest cell, at a cube corner, is 0.82 of it), so a point sees every crater
// that touches it in the 3×3 cells around it, on each face whose cells come near it (up to three, at a cube corner).
// Integer hash only, so the shader can compute the same craters (G3).
const grBandsOf=R=>{const out=[];for(const D0 of GR_BANDS){const n=Math.ceil(Math.PI/2*R*.8/D0);out.push({n,Dhi:.8*Math.PI/2*R/n})}
  out.forEach((b,i)=>{b.Dlo=i+1<out.length?out[i+1].Dhi:b.Dhi/2.5;b.lam=GR_C*(4*Math.PI*(R/1000)**2/6/(b.n*b.n))*(1/(b.Dlo/1000)**2-1/(b.Dhi/1000)**2)});return out};
const GR_BCACHE=new Map(),grBands=R=>GR_BCACHE.get(R)||(GR_BCACHE.set(R,grBandsOf(R)),GR_BCACHE.get(R));
const GR_FACE=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];   // axis, then the face's two in-plane axes
function craterBands(u,R,Dt,M,W,H,bands=GR_BANDS.length){let h=0;
  const BS=grBands(R);for(let b=0;b<bands;b++){const{n,Dhi,Dlo,lam}=BS[b],mg=3/n;
    for(let ax=0;ax<3;ax++){const ua=u[ax];if(Math.abs(ua)<.5)continue;const sg=ua>0?1:-1,f=ax*2+(sg>0?0:1),[,p1,p2]=GR_FACE[ax*2],
        A=4/Math.PI*Math.atan(u[p1]/Math.abs(ua)),B=4/Math.PI*Math.atan(u[p2]/Math.abs(ua));
      if(Math.abs(A)>1+mg||Math.abs(B)>1+mg)continue;
      const ci=Math.floor((A+1)/2*n),cj=Math.floor((B+1)/2*n);
      for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=n||j>=n)continue;
        const key=f*65536+i,zz=j*8+b*131072;if(ih3(key,zz,7001)>=lam)continue;
        const a=Math.tan(((i+ih3(key,zz,7002))/n*2-1)*Math.PI/4),c2=Math.tan(((j+ih3(key,zz,7003))/n*2-1)*Math.PI/4),c=[0,0,0];c[ax]=sg;c[p1]=a;c[p2]=c2;const cu=norm(c);
        const dx=u[0]-cu[0],dy=u[1]-cu[1],dz=u[2]-cu[2],D=1/Math.sqrt(1/(Dlo*Dlo)-ih3(key,zz,7004)*(1/(Dlo*Dlo)-1/(Dhi*Dhi))),r=Math.sqrt(dx*dx+dy*dy+dz*dz)*R/(D/2);
        if(r>=2)continue;if(M&&ih3(key,zz,7005)<GR_MARE_THIN*sstep(.05,.5,mapBil(M,W,H,cu)))continue;   // fewer on the young plains (as flooded)
        h+=craterH(r,D,Dt,ih3(key,zz,7006)**3)}}}
  return h}
// Selene's height above R at a planet-fixed point (any length)
function seleneH(pf,bands){const u=norm(pf),m=seleneMap();return mapSpl(m.E,m.W,m.H,u)+craterBands(u,SELENE.R,m.Dt,m.M,m.W,m.H,bands)}
GROUND_GEN.selene=pf=>seleneH(pf);
const SELENE_GROUND={gen:'selene',top:4000};   // top: an upper bound (sampled max 1.3 km), checked in test ground-2
// ==== SIM END
