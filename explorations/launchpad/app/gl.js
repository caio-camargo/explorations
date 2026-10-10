// app/gl.js — WebGL2 setup, shaders, meshes. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ rendering (raw WebGL2)
const cv=document.getElementById('gl'),ov=document.getElementById('ov'),octx=ov.getContext('2d');
const gl=cv.getContext('webgl2',{antialias:true,depth:true,stencil:true,powerPreference:'high-performance'});
if(!gl){document.body.innerHTML='<p style="padding:2em">WebGL2 is required.</p>'}
const SUN=norm([1,0.12,0.05]),FAR=1e12,FC=2/Math.log2(FAR+1);
const QUAD_VS=`#version 300 es
layout(location=0) in vec2 aV;out vec2 vNdc;void main(){vNdc=aV;gl_Position=vec4(aV,0.,1.);}`;
const SKY_FS=`#version 300 es
precision highp float;
in vec2 vNdc;out vec4 o;
uniform vec3 uR,uU,uF,uSun;uniform vec2 uTan;uniform float uFc;
uniform vec3 uPc;uniform float uPcc,uPR,uAR;uniform mat3 uProt;uniform vec3 uPdet;uniform sampler2D uCity;
uniform highp sampler2D uWorld;uniform sampler2D uClim;uniform vec2 uGen;uniform float uTcc;uniform vec4 uSites[4];uniform int uNS;uniform vec3 uPadE,uPadS;uniform highp sampler2D uDepth;uniform float uUseDepth;
uniform float uIv;uniform vec3 uMc;uniform float uMcc,uMR;uniform vec3 uMdet;uniform vec2 uMrot;uniform float uCcc,uCR,uCT,uPix;uniform vec3 uPadL;
uniform sampler2D uCov;uniform vec3 uCv0,uCvE,uCvN;uniform float uCvX,uVk,uVD,uVs,uVv;
uniform sampler2D uAtlas;uniform float uAtl;   // the map's atlas overlay (terrain session): colour + opacity, equirectangular like uCity
uniform vec3 uGx,uGc,uGt;uniform vec4 uGp,uGs,uGn;
const vec3 BR=vec3(5.8e-6,13.5e-6,33.1e-6);const float BM=5e-6,HR=${TELLUS.H.toFixed(1)},HM=${(TELLUS.H*1200/5600).toFixed(1)},SUNI=22.;
// filmic tone curve (Narkowicz's ACES fit): a soft shoulder keeps gradients on bright paint instead of clipping to white
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float hp(vec3 i,float P){return h3(mod(i,P));}
float pn(vec3 x,float P){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hp(i,P),hp(i+vec3(1,0,0),P),f.x),mix(hp(i+vec3(0,1,0),P),hp(i+vec3(1,1,0),P),f.x),f.y),
            mix(mix(hp(i+vec3(0,0,1),P),hp(i+vec3(1,0,1),P),f.x),mix(hp(i+vec3(0,1,1),P),hp(i+vec3(1,1,1),P),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<6;i++){s+=a*vn(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
// near-field detail: periods divide 1000 m, so the CPU can re-centre the origin every km without a seam
float detail(vec3 l){return .4*pn(l/25.,40.)+.3*pn(l/5.,200.)+.2*pn(l,1000.)+.1*pn(l*4.,4000.);}
float crat(vec3 p){vec3 i=floor(p),f=fract(p);float r=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 o=vec3(x,y,z),c=i+o;
  vec3 j=vec3(h3(c),h3(c+17.3),h3(c+41.9));float rad=.18+.3*h3(c+5.1),k=length(o+j-f)/rad;
  r+=k<1.?(k*k-.75)*.6:(k<1.4?(1.4-k)*.5:0.);}return r;}
// ray from the camera (origin) vs sphere centred at C; cc=|C|^2-R^2 comes from the CPU in float64
vec2 sph(vec3 C,float cc,vec3 d){float b=dot(d,C),D=b*b-cc;if(D<0.)return vec2(-1.,-2.);float s=sqrt(D),t0,t1;
 if(b>0.){t1=b+s;t0=cc/t1;}else{t0=b-s;t1=abs(t0)>1e-9?cc/t0:0.;}return vec2(t0,t1);}
vec3 sunTrans(vec3 p){if(uAR<=0.)return vec3(1.);float r=length(p),b=dot(p,uSun),c=r*r-uAR*uAR,tl=-b+sqrt(max(b*b-c,0.)),sl=tl/6.,lR=0.,lM=0.;
 for(int j=0;j<6;j++){vec3 q=p+uSun*(float(j)+.5)*sl;float hq=max(length(q)-uPR,0.);lR+=exp(-hq/HR)*sl;lM+=exp(-hq/HM)*sl;}
 return exp(-(BR*lR+BM*1.1*lM));}
vec3 scatter(vec3 d,float tMax,out vec3 trans){
 trans=vec3(1.);if(uAR<=0.)return vec3(0.);
 vec2 ta=sph(uPc,dot(uPc,uPc)-uAR*uAR,d);if(ta.y<0.||ta.x>ta.y)return vec3(0.);
 float t0=max(ta.x,0.),t1=min(ta.y,tMax);if(t1<=t0)return vec3(0.);
 float ds=(t1-t0)/12.,odR=0.,odM=0.;vec3 sR=vec3(0.),sM=vec3(0.);
 for(int i=0;i<12;i++){float t=t0+(float(i)+.5)*ds;vec3 p=d*t-uPc;float r=length(p),h=r-uPR;
  float dR=exp(-h/HR)*ds,dM=exp(-h/HM)*ds;odR+=dR;odM+=dM;
  float b=dot(p,uSun);if(b<0.&&r*r-b*b<uPR*uPR)continue;
  float c=r*r-uAR*uAR,tl=-b+sqrt(max(b*b-c,0.)),sl=tl/4.,lR=0.,lM=0.;
  for(int j=0;j<4;j++){vec3 q=p+uSun*(float(j)+.5)*sl;float hq=length(q)-uPR;lR+=exp(-hq/HR)*sl;lM+=exp(-hq/HM)*sl;}
  vec3 att=exp(-(BR*(odR+lR)+BM*1.1*(odM+lM)));sR+=att*dR;sM+=att*dM;}
 trans=exp(-(BR*odR+BM*1.1*odM));
 float mu=dot(d,uSun),g=.76,pR=3./(16.*3.14159)*(1.+mu*mu),pM=3./(8.*3.14159)*((1.-g*g)*(1.+mu*mu))/((2.+g*g)*pow(1.+g*g-2.*g*mu,1.5));
 return SUNI*(sR*BR*pR+sM*BM*pM);}
// ---- the ground (terrain session): the same height the physics uses. A baked 512×256 map (uWorld: base height,
// ruggedness, volcanism, salt), read with texelFetch and our own bilinear so the arithmetic matches the CPU's, plus
// procedural detail on an integer hash (bit-identical lattice values on both sides). uClim: temperature and wetness.
// sst is smoothstep that allows reversed edges (GLSL's smoothstep is undefined for edge0 >= edge1; the CPU's isn't).
float sst(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
uint ihu(ivec3 p){uint h=uint(p.x)*0x8da6b343u^uint(p.y)*0xd8163841u^uint(p.z)*0xcb1ab31fu;h^=h>>16u;h*=0x7feb352du;h^=h>>15u;h*=0x846ca68bu;h^=h>>16u;return h;}
float ih(ivec3 p){return float(ihu(p)>>8u)/16777216.;}
float tn(vec3 x){vec3 fl=floor(x),f=x-fl;ivec3 i=ivec3(fl);f=f*f*(3.-2.*f);
 float a=ih(i),b=ih(i+ivec3(1,0,0)),c=ih(i+ivec3(0,1,0)),d=ih(i+ivec3(1,1,0)),e=ih(i+ivec3(0,0,1)),g=ih(i+ivec3(1,0,1)),h=ih(i+ivec3(0,1,1)),k=ih(i+ivec3(1,1,1));
 float x1=a+(b-a)*f.x,x2=c+(d-c)*f.x,x3=e+(g-e)*f.x,x4=h+(k-h)*f.x,y1=x1+(x2-x1)*f.y;return y1+(x3+(x4-x3)*f.y-y1)*f.z;}
// the quarter-resolution pre-pass marched the terrain already: start just short of the nearest hit among this pixel's
// coarse neighbours (3×3 covers a silhouette edge), so the full-resolution march only has the last few metres to do
float coarseStart(){if(uUseDepth<.5)return 0.;ivec2 c=ivec2(gl_FragCoord.xy)/2,sz=textureSize(uDepth,0);float m=1e30;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)m=min(m,texelFetch(uDepth,clamp(c+ivec2(x,y),ivec2(0),sz-ivec2(1)),0).x);return m>1e29?0.:m*.985-1.;}
// atan2 to ~1e-7 rad: the built-in is an approximation good to ~1e-5, which moves the texel lookup enough to put the GPU's
// ground tens of centimetres (metres, on steep slopes) off the CPU's. Range-reduced to |a| ≤ tan(π/8), then the series.
float patan(float y,float x){float ax=abs(x),ay=abs(y),a=min(ax,ay)/max(max(ax,ay),1e-30),off=0.;if(a>.41421356){a=(a-1.)/(a+1.);off=.78539816;}
 float q=a*a,r=a*(1.+q*(-.33333333+q*(.2+q*(-.14285714+q*(.11111111+q*(-.09090909+q*(.07692308-q*.06666667)))))))+off;
 if(ay>ax)r=1.5707963-r;if(x<0.)r=3.1415927-r;return y<0.?-r:r;}
vec2 wUV(vec3 g){return vec2(patan(g.z,g.x)/6.2831853+.5,patan(g.y,length(g.xz))/3.1415927+.5);}
// quadratic B-spline over 3×3 texels, as wSpl on the CPU (continuous slope: no lighting facets at texel edges); unrolled
vec4 wRow(int j,int ix,vec3 w){return texelFetch(uWorld,ivec2((ix+${WTW*2-1})%${WTW},j),0)*w.x+texelFetch(uWorld,ivec2((ix+${WTW*2})%${WTW},j),0)*w.y+texelFetch(uWorld,ivec2((ix+${WTW*2+1})%${WTW},j),0)*w.z;}
vec4 wTexUV(vec2 u0){vec2 uv=u0*vec2(${WTW}.,${WTH}.)-.5,c=floor(uv+.5),t=uv-c;int ix=int(c.x),iy=int(c.y);
 vec3 wx=vec3(.5*(.5-t.x)*(.5-t.x),.75-t.x*t.x,.5*(.5+t.x)*(.5+t.x)),wy=vec3(.5*(.5-t.y)*(.5-t.y),.75-t.y*t.y,.5*(.5+t.y)*(.5+t.y));
 return wRow(clamp(iy-1,0,${WTH-1}),ix,wx)*wy.x+wRow(clamp(iy,0,${WTH-1}),ix,wx)*wy.y+wRow(clamp(iy+1,0,${WTH-1}),ix,wx)*wy.z;}
vec4 wTex(vec3 g){return wTexUV(wUV(g));}
vec3 toGen(vec3 pf){return vec3(uGen.x*pf.x+uGen.y*pf.z,pf.y,-uGen.y*pf.x+uGen.x*pf.z);}
// k = how many octaves (fractional: the last one fades in). The CPU always uses all 9; the GPU drops the ones finer
// than a pixel, and while marching high above the ground it uses fewer still and pays for them with a height bound.
float hgtG(vec3 g,vec2 uv,float k,out float m){vec4 w=wTexUV(uv);m=w.y;float e0=w.x,v=w.z,sf=w.w,lat=abs(g.y);
 float e=e0>3500.?3500.+(e0-3500.)*.5:e0,f=${HF0.toFixed(5)},a=1.,rid=0.,hil=0.,wgt=1.;
 for(int i=0;i<9;i++){float q=clamp(k-float(i),0.,1.);if(q<=0.)break;float n=mix(.5,tn(g*f+vec3(11.3,3.7,7.1)),q),r=1.-abs(2.*n-1.);r*=r*wgt;wgt=clamp(r*1.6,0.,1.);rid+=a*r;hil+=a*(n-.5);f*=2.03;a*=.5;}
 const float AN=1.99609375;
 e+=((m*${RIDGE_A}.+120.)*rid/AN*1.3-m*${VALLEY}.+(380.+500.*sst(900.,0.,abs(e0)))*hil/AN*(1.-m*.5))*(1.-.9*sf);
 float gl=sst(.66,.82,lat)*sst(.08,.35,m)*sst(1800.,400.,e0);
 if(gl>0.){const float F1=${FJ1.toFixed(5)},F2=${FJ2.toFixed(5)};float wv=tn(vec3(g.x*F1,g.y*F1+5.,g.z*F1))-.5,l=abs(tn(vec3(g.x*F2+wv*3.,g.y*F2,g.z*F2+wv*3.))-.5);e-=gl*1500.*(1.-sst(.01,.06,l));}
 if(v>.15){vec3 x=g*${VOLF.toFixed(5)},fl=floor(x);ivec3 i=ivec3(fl);
  if(ih(i+ivec3(0,0,77))<.55){float dd=length(x-fl-.25-.5*vec3(ih(i+ivec3(0,0,78)),ih(i+ivec3(0,0,79)),ih(i+ivec3(0,0,80))))/.25;
   if(dd<1.)e+=v*(1800.+1600.*ih(i+ivec3(0,0,81)))*(1.-dd)*(1.-dd)*(dd<.12?.6+3.*dd:1.);}}
 return e;}
// height at a planet-fixed direction, with the pad levelled (as terrainH on the CPU)
// the launch pads near the camera (up to 4, xyz = unit vector, w = pad height) are levelled as terrainH levels them all
float terr(vec3 pf,float k,out float m,out float ub){m=0.;vec3 g=toGen(pf);vec2 uv=wUV(g);ub=texture(uClim,uv).z;
 float dmin=1e30,hs=0.;for(int i=0;i<4;i++){if(i>=uNS)break;float dd=length(pf-uSites[i].xyz)*uPR;if(dd<dmin){dmin=dd;hs=uSites[i].w;}}
 if(dmin<2000.)return hs;float h=hgtG(g,uv,k,m);return dmin>4500.?h:h+(hs-h)*(1.-sst(2000.,4500.,dmin));}
float terr(vec3 pf,float k){float m,ub;return terr(pf,k,m,ub);}
// octaves worth drawing at a footprint fw (m per pixel): the finest kept has a wavelength of at least two pixels
float octF(float fw){return clamp(log2(25000./(2.*max(fw,.5)))/1.0215+1.,1.,9.);}
// ...and at distance t: all 9 (the physics' ground, to the millimetre) within 2 km of the camera, easing to 5 by ~20 km
float octT(float t,float fw){return min(octF(fw),clamp(9.-1.2*log2(max(t,1.)/2000.),5.,9.));}
// march the ray through the shell of possible terrain (sea level to R+uTop). Returns the hit distance (1e30 = none)
// and the height there (negative: the sea surface over that depth). Altitude along the ray uses cc from the CPU in
// float64, (t²−2tb+cc)/(|p|+R), so it stays centimetre-accurate even a few metres above the ground.
float march(vec3 d,out float hh,float tS){hh=0.;vec2 sh=sph(uPc,uTcc,d);if(sh.y<0.||sh.x>sh.y||(uTcc>0.&&sh.x<0.))return 1e30;
 float b=dot(d,uPc),t=max(max(sh.x,0.),tS),t1=sh.y,tp=t,k=2.;vec2 sea=sph(uPc,uPcc,d);float ts=(uPcc>0.&&sea.x>0.)?sea.x:1e30;t1=min(t1,ts);
 bool hit=false;
 float ub=0.,m=0.;
 for(int i=0;i<64;i++){vec3 p=d*t-uPc;float rl=length(p),alt=(t*t-2.*t*b+uPcc)/(rl+uPR);vec3 up=p/rl,pf=uProt*up;float cs=max(-dot(d,up),0.);
  // the air bound only needs the climate texel: skip the terrain while clearly above anything that could be here
  if(alt>ub&&i>0){tp=t;t+=(alt-ub)/(cs+.7)+.002*t+.5;k=2.;vec3 g=toGen(uProt*normalize(d*t-uPc));ub=texture(uClim,wUV(g)).z;if(t>=t1)break;continue;}
  float kF=octT(t,t*uPix/max(cs,.08)),kk=min(k,kF),h=terr(pf,kk,m,ub),bnd=kk<kF-.01?(m*${(RIDGE_A*1.3/2).toFixed(0)}.+300.)*exp2(1.-kk):0.,dh=alt-h-bnd;
  if(alt>ub){tp=t;t+=(alt-ub)/(cs+.7)+.002*t+.5;if(t>=t1)break;continue;}
  if(dh<0.){if(bnd>0.){k=kF;continue;}hit=true;hh=h;break;}
  // lowlands are gentle (slopes ≲ 0.2), mountains can be steep: the step trusts the local ruggedness
  tp=t;t+=max(dh/(cs+.22+.8*m),.004*t+.25);k=clamp(log2((m*${(RIDGE_A*1.3/2).toFixed(0)}.+300.)/max(dh,.5))+2.,2.,9.);
  if(t>=t1)break;}
 if(!hit){if(t>=t1){if(ts<1e29){hh=terr(uProt*normalize(d*ts-uPc),octT(ts,ts*uPix));return ts;}return 1e30;}
  vec3 p=d*t-uPc;hh=terr(uProt*normalize(p),octT(t,t*uPix));return t;}   // out of steps right above the ground: call it a hit
 float lo=tp,hi=t;for(int i=0;i<5;i++){float tm=.5*(lo+hi);vec3 p=d*tm-uPc;float rl=length(p),alt=(tm*tm-2.*tm*b+uPcc)/(rl+uPR),h=terr(uProt*(p/rl),octT(tm,tm*uPix));
  if(alt<h){hi=tm;hh=h;}else lo=tm;}
 if(hi<ts&&hh<0.)hh=0.;return hi;}
// near field, filtered by the pixel footprint fw (metres): octaves finer than a pixel fade to their mean instead of
// aliasing into streaks at grazing angles
float detailF(vec3 l,float fw){return .4*pn(l/25.,40.)+.3*mix(.5,pn(l/5.,200.),smoothstep(10.,2.5,fw))
 +.2*mix(.5,pn(l,1000.),smoothstep(2.,.5,fw))+.1*mix(.5,pn(l*4.,4000.),smoothstep(.5,.12,fw));}
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));}
float gline(vec2 x,float per,float w,float fw){vec2 g=abs(fract(x/per)-.5)*per;float e=max(w,fw*.7);return (1.-smoothstep(e*.5,e,min(g.x,g.y)))*min(1.,w/e*1.6);}
// the launch complex, painted onto the ground in the pad's own frame (x east, y north, metres): a concrete apron with
// expansion joints and stains, soot around the pad, slabs under the tanks, an access road with a gravel shoulder
vec3 padGround(vec2 x,vec3 alb,float fw,out float paved){
 float r=length(x),n=vn(vec3(x/7.,1.)),n2=vn(vec3(x*.9,3.));
 float apron=1.-smoothstep(40.,42.+3.*n,r);
 apron=max(apron,1.-smoothstep(14.,15.,length(x-vec2(36.,18.))));
 apron=max(apron,1.-smoothstep(16.,17.,length(x-vec2(-45.,-25.))));
 apron=max(apron,1.-smoothstep(6.,6.5,length(x-vec2(20.,-30.))));
 float rd=sdSeg(x,vec2(-20.,-36.),vec2(-1500.,-1150.));rd=min(rd,sdSeg(x,vec2(-20.,-36.),vec2(-45.,-25.)));
 float road=1.-smoothstep(3.5,3.5+max(.15,fw),rd),shoulder=(1.-smoothstep(6.,7.5+n*2.,rd))*(1.-road);
 vec3 conc=vec3(.19,.185,.175)*(.82+.3*n+.1*n2)*(1.-.3*gline(x,6.,.06,fw)*smoothstep(1.5,.3,fw));
 vec3 asph=vec3(.055,.055,.06)*(.85+.3*n2);
 float dash=(1.-smoothstep(.12,.12+fw,abs(dot(x-vec2(-20.,-36.),normalize(vec2(-1150.,1480.))))))*step(.5,fract(dot(x,normalize(vec2(-1480.,-1150.)))/9.))*road;
 asph=mix(asph,vec3(.5,.45,.2),dash*smoothstep(2.,.5,fw));
 vec3 gravel=vec3(.17,.16,.14)*(.8+.4*n2);
 vec3 c=mix(alb,gravel,shoulder*.9);c=mix(c,conc,apron);c=mix(c,asph,road*(1.-apron));
 float soot=exp(-max(r-6.,0.)/11.)*(.5+.5*vn(vec3(x/2.5,7.)))+.3*exp(-r/28.)*n;
 paved=max(apron,road);return c*(1.-.85*min(soot,1.));}
// biome colours from the climate map (temperature with a 6.5 K/km lapse, wetness), blended across the same thresholds
// biomeAt uses on the CPU; then rock on steep slopes, snow where it's cold and not too steep, salt pans, basalt,
// wetlands, beaches. Albedos roughly physical (forest ~.1, grass ~.2, desert ~.35).
vec3 tellus(vec3 pf,vec3 npf,float h,vec2 gx,float det,float fade,out float ocean){
 ocean=0.;
 if(h<0.){ocean=1.;float dp=-h;vec3 col=mix(vec3(.007,.04,.11),vec3(.003,.016,.06),sst(200.,3000.,dp));
  return mix(col,vec3(.02,.11,.12),pow(sst(70.,0.,dp),2.));}                         // shallow turquoise over the shelf
 vec3 g=toGen(pf);vec4 w=wTex(g),cl=texture(uClim,wUV(g));
 float T=cl.x-6.5*max(h-max(w.x,0.),0.)/1000.,W=cl.y,m=w.y,v=w.z,sf=w.w,slope=1.-dot(npf,pf);
 vec3 rainf=vec3(.022,.065,.02),sav=vec3(.19,.16,.075),hdes=vec3(.36,.26,.14),tfor=vec3(.035,.085,.028),grass=vec3(.10,.16,.045),cdes=vec3(.27,.23,.16),
  taiga=vec3(.026,.05,.034),stp=vec3(.17,.15,.085),tund=vec3(.18,.17,.13),rock=vec3(.16,.14,.12),snow=vec3(.6,.64,.68);   // fresh snow is ~.8, but at .8 the tone curve flattens it and the relief disappears
 vec3 hot=mix(mix(hdes,sav,sst(.3,.42,W)),rainf,sst(.64,.8,W)),tmp=mix(mix(cdes,grass,sst(.24,.36,W)),tfor,sst(.5,.62,W)),cld=mix(stp,taiga,sst(.3,.42,W));
 vec3 col=mix(cld,tmp,sst(4.,10.,T));col=mix(col,hot,sst(15.,21.,T));col=mix(tund,col,sst(-4.,1.,T));
 col=mix(col,vec3(.045,.07,.035),sst(.7,.85,W)*sst(80.,20.,h)*sst(.15,.05,m)*sst(3.,8.,T));   // wetlands
 float mid=fbm(pf*90.+2.);col*=.72+.56*mid;col=mix(col,tfor,sst(.56,.7,fbm(pf*420.))*.4*sst(.3,.5,W)*sst(0.,6.,T));
 col=mix(col,vec3(.62,.6,.55)*(.9+.2*mid),sst(.3,.7,sf));                                    // salt pans
 col=mix(col,vec3(.06,.055,.05),sst(.3,.6,v)*sst(200.,700.,h));                              // basalt on the volcanic arcs
 col=mix(col,vec3(.17,.15,.10),sst(12.,3.,h)*.8);                                            // beaches
 col=mix(col,rock*(.8+.4*mid),max(sst(.06,.2,slope),sst(1.,-3.,T)*.55));                    // cliffs, and bare ground above the trees
 // close up: a patchwork of fields where it's green, mild and flat
 if(fade>0.){vec2 cl2=mod(floor(gx/260.),4096.);float hsh=fract(sin(dot(cl2,vec2(12.9898,78.233)))*43758.55),farm=fade*sst(.25,.4,W)*sst(.8,.6,W)*sst(.04,.01,slope)*sst(6.,11.,T)*sst(25.,21.,T)*(1.-sf);
  col=mix(col,col*mix(vec3(.85,.92,.75),vec3(1.18,1.1,.85),hsh),farm*.45);col*=mix(1.,.85+.3*det,fade);}   // ×1 at fade 0: the old .85 floor made a visible ring where fade starts
 // snow and ice hold on gentle ground only: faces steeper than ~35° stay bare rock, which is what gives a range its relief
 float steep=sst(.12,.3,slope),sn=sst(-.5,-5.,T)*(1.-steep)*sst(.35,.7,vn(pf*220.)+.3),ice=sst(-11.,-15.,T)*(1.-.85*steep);
 // (Q52) the high ranges were one white cap: wind-scoured rock shows through where the ice is thin (outcrops on a ~4 km
 // and ~1.2 km noise, more on steeper slopes, none on flat ice sheets), old blue glacier ice in the hollows, and the snow's tone varies
 if(uIv>0.){float ex=vn(pf*300.)*.6+vn(pf*1100.)*.4,bare=sst(.55,.68,ex+.25*sst(.05,.12,slope))*sst(.003,.02,slope);ice*=1.-.85*bare*uIv;sn*=1.-.85*bare*uIv;
  snow=mix(snow,vec3(.42,.52,.62),sst(.6,.78,vn(pf*640.+5.))*.45*uIv*sst(.02,.0,slope))*(1.-.1*uIv+.2*uIv*mid);}
 return mix(col,snow,max(sn,ice));}
// clouds: one thin shell at 3 km. Coverage is the same value noise, in planet-fixed coordinates (so weather turns with the
// planet) drifting slowly (uCT), with a large-scale term that groups cells into weather systems.
// A cheap domain warp (three value-noise lookups) swirls the cells; stretching y makes them run east–west like zonal winds.
// fw: the pixel's footprint on the shell (unit-sphere units). Far and grazing samples widen the threshold toward the mean
// coverage instead of aliasing into speckle and a hard bright rim where the shell is seen edge-on.
float cloudCovF(vec3 u,float fw){vec3 w=vec3(vn(u*4.+uCT*.3),vn(u*4.+vec3(5.2,1.3,uCT*.3)),vn(u*4.+vec3(9.1,uCT*.3,2.7)))-.5;
 vec3 q=(u+w*.22)*vec3(6.,11.,6.)+vec3(uCT,0.,uCT*.6);
 float c=fbm(q)+.35*(fbm(u*1.7+vec3(4.,1.,uCT*.2))-.5),k=clamp(fw*60.,0.,.3);return smoothstep(.55-k,.72+k*.4,c)*(1.-k*.8);}
float cloudCov(vec3 u){return cloudCovF(u,0.);}
// the deck with depth, near a low camera (uVk > 0: the camera is under ~20 km): a slab from 2 to 5.5 km marched out to
// uVD. Coverage comes from uCov, cloudCovF baked round the point under the camera (gnomonic, half-extent uCvX m; the
// same coverage the shell and cloudAt use), and sets each column's height: thin cover makes low puffs, thick cover
// towers. Two octaves of 3D value noise (planet-fixed, drifting) erode it into billows. Lit by height in the column (tops
// bright, bellies dark), one step toward the sun, and the sky; aerial perspective like the shell's.
float covNear(vec3 cu){float g=dot(cu,uCv0);vec2 uv=uPR*vec2(dot(cu,uCvE),dot(cu,uCvN))/(g*uCvX)*.5+.5;
 if(g<=0.||any(lessThan(uv,vec2(.002)))||any(greaterThan(uv,vec2(.998))))return 0.;return texture(uCov,uv).r;}
float cloudDens(vec3 q){float r=length(q);vec3 u=q/r,cu=uProt*u;float hf=(r-uPR-2000.)/3500.;if(hf<0.||hf>1.)return 0.;
 float c=covNear(cu);if(c<.01)return 0.;
 vec3 w=cu*uPR+vec3(uCT*400.,0.,uCT*250.);float n=vn(w/650.)*.65+vn(w/230.)*.35,tw=vn(w/2600.);
 float top=mix(.15,1.,c*c*(3.-2.*c))*(.45+1.1*tw)*mix(1.,.55+.9*vn(w/9000.+3.7),uVv),shape=smoothstep(0.,.06,hf)*smoothstep(top,top*.5,hf);
 return clamp(c*shape*1.9-(1.-n)*.85,0.,1.);}
// ---- the sky behind everything (aerofx; PLAYTEST #10). Inertial directions, so the sky turns as the planet does not.
// The home galaxy is generated from the world seed (galaxyParams): a band on a great circle (normal uGx) with a bulge at
// its centre (uGc), dust lanes along its midplane, a satellite galaxy (uGs: direction, size) and a nebula (uGn).
// uGp = (band half-width, bulge size, dust, arm contrast); uGt = the band's tint.
vec3 galaxy(vec3 d,out float band){float b=dot(d,uGx),lc=dot(d,uGc),cl=.5+.5*lc,w=uGp.x*(.6+.9*cl*cl);   // the band widens toward the centre
 band=exp(-b*b/(w*w));float ac=acos(clamp(lc,-1.,1.)),bulge=exp(-ac*ac/(uGp.y*uGp.y))*exp(-b*b/(uGp.y*uGp.y*.35));
 // everything sampled on the sphere (no angle coordinates, so no seams); clumps stretched along the band by squashing
 // the noise across it
 vec3 q=d-uGx*b*.65;float n=vn(q*7.)*.5+vn(q*19.+1.7)*.3+vn(q*53.+4.1)*.2,arm=mix(1.,smoothstep(.3,.75,vn(q*4.+2.)),uGp.w);
 float dust=uGp.z*smoothstep(.38,.62,vn(q*13.+3.)*.6+vn(q*37.)*.4)*exp(-b*b/(w*w*.15));
 float I=(band*(.3+1.1*n*n)*arm+bulge*2.2)*(1.-.8*dust)+band*.15;
 vec3 c=mix(uGt,vec3(1.,.8,.55),clamp(bulge*1.4,0.,1.))*I*.07;
 float sa=acos(clamp(dot(d,uGs.xyz),-1.,1.));c+=vec3(.8,.86,1.)*exp(-sa*sa/(uGs.w*uGs.w))*(.5+.7*vn(d*70.))*.022;
 float na=acos(clamp(dot(d,uGn.xyz),-1.,1.));c+=vec3(1.,.32,.42)*exp(-na*na/(uGn.w*uGn.w))*smoothstep(.35,.8,vn(d*26.)*.6+vn(d*80.)*.4)*.05;
 return c;}
// stars: two layers on hashed cells; colours by temperature (blue-white → orange-red), a few bright ones, many faint, and
// more of them along the galactic band
vec3 starsAt(vec3 d,float band){vec3 c=vec3(0.);
 for(int k=0;k<2;k++){float sc=k==0?220.:560.;vec3 sd=d*sc,ci=floor(sd),j=vec3(h3(ci+3.1),h3(ci+7.7),h3(ci+1.3));
  float th=k==0?.993-.004*band:.9965-.012*band;if(h3(ci)<th)continue;
  float t=h3(ci+5.3),br=(k==0?.25+3.5*pow(h3(ci+9.),5.):.12+.25*h3(ci+9.)),r=length(fract(sd)-j*.6-.2);
  vec3 tc=t<.12?vec3(.7,.8,1.):t<.55?vec3(.95,.97,1.):t<.8?vec3(1.,.92,.75):vec3(1.,.72,.5);
  c+=tc*br*smoothstep(k==0?.22:.16,0.,r)*.6;}
 return c;}
// the sun: a limb-darkened disc (0.27°), a corona and wide glow, and four diffraction spikes in screen space
vec3 sunAt(vec3 d){float sdn=dot(d,uSun);if(sdn<0.)return vec3(0.);float th=acos(clamp(sdn,-1.,1.)),r=th/.0047;
 float disc=r<1.?(1.-.55*(1.-sqrt(1.-r*r))):0.;disc*=smoothstep(1.,.92,r);
 vec3 q=d-uSun*sdn;float a=atan(dot(q,uU),dot(q,uR));
 float sp=(pow(abs(cos(a*2.)),600.)+.4*pow(abs(cos(a*2.+.785)),500.))*exp(-th/.025)*smoothstep(.003,.006,th);   // camera-fixed spikes (a lens artefact)
 return vec3(1.,.96,.88)*(disc*60.+exp(-th/.0035)*3.+exp(-th/.02)*.35+exp(-th/.12)*.04+sp*1.6);}
float cloudShadow(vec3 p){float b=dot(p,uSun),c=dot(p,p)-uCR*uCR;if(c>0.||uCR<=0.)return 1.;vec3 q=p+uSun*(-b+sqrt(max(b*b-c,0.)));return 1.-.7*cloudCov(uProt*normalize(q));}
// the cloud volume's own shadow on the ground (QUEUE Q65): 5 steps toward the sun through the 2–5.5 km slab, the volume's
// extinction (1/180 m⁻¹), floor 0.25 for skylight; blended into the shell's shadow by uVk and a fade at the bake's edge,
// so the shadows under the deck match the clouds drawn above them. uVs = 0 turns it off (A/B).
float cloudShadowV(vec3 p){float sh=cloudShadow(p);if(uVk*uVs<=0.)return sh;vec3 cu=uProt*normalize(p);float g=dot(cu,uCv0);
 vec2 uv=uPR*vec2(dot(cu,uCvE),dot(cu,uCvN))/(g*uCvX)*.5+.5;float e=max(abs(uv.x-.5),abs(uv.y-.5)),w=uVk*uVs*(1.-smoothstep(.36,.47,e))*step(0.,g);
 float s=dot(normalize(p),uSun);if(w<=0.||s<=.02)return sh;float hg=length(p)-uPR,t0=max(2000.-hg,0.)/s,t1=min((5500.-hg)/s,t0+30000.),dt=(t1-t0)/5.,od=0.;
 for(int i=0;i<5;i++)od+=cloudDens(p+uSun*(t0+(float(i)+.5)*dt));
 return mix(sh,max(exp(-od*dt/180.),.25),w);}
void main(){
 vec3 d=normalize(uR*vNdc.x*uTan.x+uU*vNdc.y*uTan.y+uF);
 float hT=0.,tP=march(d,hT,coarseStart()),tM=1e30;
 vec2 hm=sph(uMc,uMcc,d);if(uMcc>0.&&hm.x>0.)tM=hm.x;
 float tH=min(tP,tM);vec3 trans;vec3 ins=scatter(d,tH,trans);vec3 col;vec4 atl=vec4(0.);float atlL=1.;
 if(tP<tM){
  vec3 p=d*tP-uPc,n=normalize(p),pf=uProt*n,loc=uProt*(d*tP)+uPdet;
  float fw=tP*uPix/max(-dot(d,n),.06),lt=asin(clamp(pf.y,-1.,1.));vec2 gx=vec2(atan(pf.z,pf.x)*cos(lt),lt)*uPR;   // footprint, ground coords (m)
  float fade=sst(4000.,150.,tP),det=fade>0.?detailF(loc,fw):.5,oc;
  // the terrain normal from the height field (planet-fixed), over about a pixel and a half
  vec3 npf=pf;if(hT>=0.){float kF=octT(tP,tP*uPix),eps=max(fw*1.5,1.);vec3 t1=normalize(cross(vec3(0,1,0),pf)+vec3(1e-6,0,0)),t2=cross(pf,t1);
   npf=normalize(pf-(t1*(terr(normalize(pf+t1*(eps/uPR)),kF)-hT)+t2*(terr(normalize(pf+t2*(eps/uPR)),kF)-hT))/eps);}
  vec3 alb=tellus(pf,npf,hT,gx,det,fade,oc);
  if(fade>0.&&oc<.5){
   // scrub: dark bushes on a 3 m grid, thinning in deserts and fading before they'd alias
   vec2 cb=floor(gx/3.),fb=gx/3.-cb;cb=mod(cb,4096.);float hb=h3(vec3(cb,5.)),grn=alb.g/max(alb.r,.01);
   vec2 ob=vec2(h3(vec3(cb,6.)),h3(vec3(cb,8.)))*.6+.2;float clump=vn(vec3(gx/45.,2.))+.5*vn(vec3(gx/11.,4.))-.75,bs=.05+.25*h3(vec3(cb,9.));
   float bush=step(1.1-.35*clamp(grn,0.,1.5)-.9*clump,hb)*(1.-smoothstep(bs*.5,bs,length(fb-ob)))*smoothstep(1.2,.4,fw);
   vec3 pv=loc-uPadL;float paved=0.;if(dot(pv,pv)<4e6)alb=padGround(vec2(dot(pv,uPadE),dot(pv,uPadS)),alb,fw,paved);   // the nearest pad's own frame (east, south)
   alb=mix(alb,alb*vec3(.35,.45,.3),bush*(1.-paved)*fade);npf=normalize(mix(npf,pf,paved));}
  vec3 st=sunTrans(p+n*20.);vec3 nb=oc>.5?n:normalize(transpose(uProt)*npf);   // npf is planet-fixed; n is inertial
  float ndl=dot(n,uSun),ndb=max(dot(nb,uSun),0.)*smoothstep(-.05,.08,ndl);   // relief shading, but never lit past the terminator
  // cities: an equirectangular texture (r = built-up, g = lights); a street grid shows up close
  vec2 eq=vec2(atan(pf.z,pf.x)/6.2831853+.5,asin(clamp(pf.y,-1.,1.))/3.1415927+.5);vec4 ct=texture(uCity,eq);float urb=ct.r*(1.-oc);
  if(uAtl>0.){atl=texture(uAtlas,eq);atlL=.5+.5*smoothstep(-.12,.2,ndl);}   // the atlas stays readable on the night side
  float street=0.;if(urb>.01){vec2 g=abs(fract(gx/90.)-.5);street=smoothstep(.46,.49,max(g.x,g.y));alb=mix(alb,vec3(.13,.12,.11)*(1.-.5*fade*street),urb*.85);}
  col=alb*(ndb*st*5.*cloudShadowV(p)+vec3(.01,.016,.03));
  // night lights: a soft glow from orbit; up close they gather onto the streets
  col+=vec3(1.,.72,.38)*ct.g*(1.-oc)*.55*(1.-smoothstep(-.12,.05,ndl))*mix(1.,.08+1.6*street,fade);
  if(oc>.5)col+=st*pow(max(dot(reflect(d,n),uSun),0.),90.)*1.5*step(0.,ndl);
  col=col*trans+ins;
 }else if(tM<1e29){
  vec3 p=d*tM-uMc,n=normalize(p);
  // crater relief: the height field's slope along the sun direction tilts the lighting (2 evaluations, no normal map)
  // Selene turns (tidally locked): its markings and detail are in its own frame (uMrot = cos, sin of its angle)
  #define MB(v) vec3(uMrot.x*(v).x-uMrot.y*(v).z,(v).y,uMrot.y*(v).x+uMrot.x*(v).z)
  vec3 nb=MB(n),nb2=MB(normalize(n+normalize(uSun-n*dot(uSun,n))*.004));
  float cr=crat(nb*18.)+.5*crat(nb*55.),fade=smoothstep(3000.,150.,tM),det=fade>0.?detail(MB(d*tM)+uMdet):.5;
  float cr2=crat(nb2*18.)+.5*crat(nb2*55.);
  float slope=clamp((cr2-cr)*1.4,-.9,1.2);
  float base=.16+.09*fbm(nb*3.)-.07*smoothstep(.5,.65,fbm(nb*1.6+3.)-${MARE_NEAR}*nb.x);
  vec3 alb=vec3(base+.03*cr+.07*fade*(det-.5))*vec3(1.,.98,.95);
  float ndl=max(dot(n,uSun),0.);col=alb*(clamp(ndl+slope*sqrt(max(1.-ndl*ndl,0.))*.8,0.,1.6)*2.2+.004);col=col*trans+ins;
 }else{
  float band;vec3 gal=galaxy(d,band);
  col=ins+trans*(gal+starsAt(d,band)+sunAt(d));
 }
 // the cloud deck in front of whatever the ray hit: lit tops, darker bellies seen from below, the air between applied
 // approximately (transmittance raised to the fraction of the path, in-scatter in proportion to the extinction)
 float tC=-1.,tD=tH;
 if(uVk>0.&&uCR>0.){float r0=length(uPc),RB=uPR+2000.,RT=uPR+5500.;vec2 hb=sph(uPc,r0*r0-RB*RB,d),ht=sph(uPc,r0*r0-RT*RT,d);float tA=-1.,tB=-1.;
  if(r0<RB){tA=hb.y;tB=ht.y;}else if(r0<RT){tA=0.;tB=hb.x>0.?hb.x:ht.y;}else if(ht.x>0.){tA=ht.x;tB=hb.x>0.?hb.x:ht.y;}
  tB=min(min(tB,tH),uVD);
  if(tA>=0.&&tB>tA){const int N=72;float L=tB-tA,j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))),T=1.;vec3 C=vec3(0.);
   vec2 ta=sph(uPc,dot(uPc,uPc)-uAR*uAR,d);float tEnd=tH<1e29?tH:max(ta.y,tB+1.);
   vec3 sT=sunTrans(d*(.5*(tA+tB))-uPc)*5.,amb=vec3(.42,.5,.62)*(.12+.88*clamp(dot(normalize(-uPc),uSun)*3.+.3,0.,1.));
   for(int i=0;i<N;i++){float x=(float(i)+j)/float(N),t=tA+L*x*x,ds=L*2.*x/float(N)+L/float(N*N);   // steps grow with distance
    vec3 q=d*t-uPc;float dn=cloudDens(q)*(1.-smoothstep(.5*uVD,uVD,t));if(dn<.003)continue;
    float a=1.-exp(-dn*ds/180.),hf=(length(q)-uPR-2000.)/3500.,dl=cloudDens(q+uSun*250.)+cloudDens(q+uSun*800.),lt=max(exp(-dl*2.2),mix(.4,.28,uVv)*exp(-dl*.35));   // two steps toward the sun; the second term stands in for multiple scattering (deep cloud is grey-white, not black)
    vec3 cs=vec3(.9)*(sT*(.08+.92*lt)*(.5+.5*smoothstep(0.,.8,hf))*.8+amb*(.35+.4*hf)*.6);
    if(uVv>0.)cs*=mix(1.,.82+.32*vn(uProt*normalize(q)*uPR/7000.+1.3),uVv);   // Q65: ±15 % over ~7 km, thicker and thinner stretches of deck
    vec3 tr=pow(max(trans,vec3(1e-4)),vec3(clamp(t/tEnd,0.,1.))),ic=ins*(1.-tr)/max(vec3(1.)-trans,vec3(1e-3));
    C+=T*a*(cs*tr+ic);T*=1.-a;if(T<.5&&tD>=tH)tD=t;if(T<.02)break;}
   col=col*(1.-uVk*(1.-T))+uVk*C;}}
 if(uCR>0.){vec2 hc=sph(uPc,uCcc,d);tC=uCcc>0.?(hc.x>0.&&hc.x<=hc.y?hc.x:-1.):hc.y;}
 float shW=1.-uVk*(1.-smoothstep(.5*uVD,uVD,tC));   // inside uVD the volume stands in for the shell
 if(tC>0.&&tC<tH&&shW>.001){vec3 cp=d*tC-uPc,cn=normalize(cp),cu=uProt*cn;float mu=abs(dot(d,cn)),fw=tC*uPix/max(mu,1e-3)/uCR,cov=cloudCovF(cu,fw)*smoothstep(.0,.035,mu);
  // up close: billowy detail on top of the weather-scale coverage (fades out with distance, so orbit views pay nothing)
  float near=smoothstep(60000.,4000.,tC),dn=0.;if(near>0.&&cov>.002){dn=vn(cu*2600.+uCT*3.)*.6+vn(cu*7800.)*.4;cov=clamp(cov+(dn-.55)*1.6*near*smoothstep(0.,.3,cov),0.,1.);}   // breaks the deck into lumps and holes up close
  if(cov>.002){float ndl=dot(cn,uSun),below=uCcc<0.?1.:0.,lit=clamp(ndl*.6+.4,0.,1.)*smoothstep(-.15,.1,ndl);
   vec3 cc=vec3(.92)*sunTrans(cp)*5.*lit*mix(1.,.45,below*cov)*(.78+.22*cov)*(1.-near*.25*(1.-dn))+vec3(.015,.02,.03);
   vec2 ta=sph(uPc,dot(uPc,uPc)-uAR*uAR,d);float tEnd=tH<1e29?tH:max(ta.y,tC+1.);
   vec3 tr=pow(max(trans,vec3(1e-4)),vec3(clamp(tC/tEnd,0.,1.))),ic=ins*(1.-tr)/max(vec3(1.)-trans,vec3(1e-3));
   col=mix(col,cc*tr+ic,cov*.95*shW*(1.-.85*uAtl));if(cov*shW>.5)tD=min(tD,tC);}}
 if(atl.a>0.)col=mix(col,pow(atl.rgb,vec3(2.2))*1.7*atlL,atl.a*uAtl);   // over the clouds: it's a map
 col=aces(col*.85);o=vec4(pow(col,vec3(1./2.2)),1.);
 o.rgb+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.;   // dither: dark gradients (the galaxy, night skies) band in 8 bits
 gl_FragDepth=tD<1e29?min(log2(1.+tD*dot(d,uF))*uFc*.5,.9999999):1.;
}`;
const MESH_VS=`#version 300 es
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in vec3 aC;layout(location=3) in float aM;layout(location=4) in vec4 aU;layout(location=5) in vec2 aK;
uniform mat4 uVP,uM;uniform float uFc;uniform vec4 uMv[48];out vec3 vN,vC,vP,vO,vNo;out float vW,vM;out vec4 vU;out vec2 vK;
// moving parts (setMoves, QUEUE Q23): up to 16 entries of three vec4s, (pivot, part index), (mode, axis x, axis z, ring
// radius), (rotation): mode 1 an engine's bell (kind 2) turned by a quaternion about its throat; mode 2 a fin ring's
// plates (kind 6 beyond the ring radius), plate j by angle .[j] about its radial axis FIN4[j]; mode 3 a radial fin, .x
vec3 rotA(vec3 v,vec3 a,float t){float c=cos(t),s=sin(t);return v*c+cross(a,v)*s+a*dot(a,v)*(1.-c);}
vec3 qrv(vec4 q,vec3 v){return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
void main(){vec3 P=aP,N=aN;int k=int(aK.x+.5)%32;
 if((k==2||k==6)&&aK.y>-.5)for(int j=0;j<16;j++){vec4 A=uMv[j*3],B=uMv[j*3+1],Q=uMv[j*3+2];if(B.x<.5||abs(A.w-aK.y)>.5)continue;vec3 d=P-A.xyz;
  if(B.x<1.5){if(k==2){P=A.xyz+qrv(Q,d);N=qrv(Q,N);}}
  else if(B.x<2.5){if(length(d.xz)>B.w){vec2 a=abs(d.x)>abs(d.z)?vec2(sign(d.x),0.):vec2(0.,sign(d.z));int i=a.x>.5?0:a.y>.5?1:a.x<-.5?2:3;
   vec3 ax=vec3(a.x,0.,a.y);P=A.xyz+rotA(d,ax,Q[i]);N=rotA(N,ax,Q[i]);}}
  else{vec3 ax=vec3(B.y,0.,B.z);P=A.xyz+rotA(d,ax,Q.x);N=rotA(N,ax,Q.x);}
  break;}
 vec4 w=uM*vec4(P,1.);vP=w.xyz;vO=aP;vNo=N;gl_Position=uVP*w;vW=gl_Position.w;gl_Position.z=(log2(max(1e-6,1.+gl_Position.w))*uFc-1.)*gl_Position.w;vN=mat3(uM)*N;vC=aC;vM=aM;vU=aU;vK=aK;}`;
const MESH_FS=`#version 300 es
precision highp float;in vec3 vN,vC,vP,vO,vNo;in float vW,vM;in vec4 vU;in vec2 vK;out vec4 o;
uniform vec3 uSun,uSunCol,uSky,uGnd,uUp;uniform float uLit,uGlow,uShadow,uFc,uSeam;uniform mat4 uM;uniform vec4 uMk[96],uCh[96];uniform vec3 uFl[4];uniform float uFlI;uniform vec4 uPl;uniform vec3 uPlC;uniform vec3 uFlC;uniform float uPadM;
float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.55);}
float sdStar5(vec2 p,float r,float rf){const vec2 k1=vec2(.809016994,-.587785252),k2=vec2(-k1.x,k1.y);p.x=abs(p.x);p-=2.*max(dot(k1,p),0.)*k1;p-=2.*max(dot(k2,p),0.)*k2;
 p.x=abs(p.x);p.y-=r;vec2 ba=rf*vec2(-k1.y,k1.x)-vec2(0,1);float h=clamp(dot(p,ba)/dot(ba,ba),0.,r);return length(p-ba*h)*sign(p.y*ba.x-p.x*ba.y);}
vec3 hsv(float h,float s,float v){vec3 c=clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);return v*mix(vec3(1.),c,s);}
const bool ROUNDEL_ON=true;   // false: no roundels (edit here for an A/B)
// the roundel (Q102 step 5; Q228 for the other four, app/flags.js roundelBody's designs): a disc of radius 1 in u, by
// school: Cape red and white stripes with a blue canton of small stars; Steppe one gold star on red; Arsenal a chevron
// and a gold disc on the dark field; Coastal rings; Mountain a sun with eight rays; Isle four stars on the dark field.
// A white rim. Returns (colour, coverage); px is the pixel size in u. A is the power's hue, B its dark complement
vec4 roundel(vec2 u,int sch,float px,float hue){float r=length(u),cov=1.-smoothstep(1.-px,1.+px,r);if(cov<=0.)return vec4(0.);vec3 c;
 vec3 A=hsv(hue,.82,.71),B=hsv(fract(hue+.4167),.67,.39),W=vec3(.95,.94,.9);
 if(r>.88)c=vec3(.92);
 else if(sch==1)c=mix(hsv(hue,.88,.62),vec3(.95,.78,.22),1.-smoothstep(-px,px,sdStar5(u*1.05,.62,.42)));
 else if(sch==2){float ay=abs(u.y),ch=max(max(-.1-1.3*ay-u.x,u.x-.2+1.3*ay),ay-.5);c=length(u-vec2(.42,0.))<.26?vec3(.91,.76,.23):mix(B,A,1.-smoothstep(-px,px,ch));}
 else if(sch==3)c=r<.32?A:r<.6?W:B;
 else if(sch==4){float da=mod(atan(u.y,u.x)+.3927,.7854)-.3927,ray=max(r*abs(sin(da))-.045,r-.8);c=r<.36||ray<0.?A:W;}
 else if(sch==5){float st=min(min(sdStar5((u-vec2(0.,.5))/.17,1.,.42)*.17,sdStar5((u-vec2(.42,0.))/.14,1.,.42)*.14),min(sdStar5((u-vec2(0.,-.5))/.19,1.,.42)*.19,sdStar5((u-vec2(-.42,-.05))/.12,1.,.42)*.12));
  c=mix(B,W,1.-smoothstep(-px,px,st));}
 else if(u.y>.05&&u.x<-.05){vec2 g=fract(u*6.)-.5;c=mix(hsv(fract(hue+.55),.75,.36),vec3(.95),1.-smoothstep(.13,.13+px*6.,length(g)));}
 else c=mod(floor(u.y*4.5+.5),2.)<.5?hsv(hue,.85,.68):vec3(.94);
 return vec4(pow(c,vec3(2.2)),cov);}
// a stencilled four-digit serial from the part's index (Arsenal, Q228): a 3×5 font, q in font pixels from the bottom left
const int DG[10]=int[10](31599,11415,29671,29391,23497,31183,31215,29330,31727,31695);
float serial(vec2 q,int pi){if(q.x<0.||q.x>=15.||q.y<0.||q.y>=5.)return 0.;int i=int(q.x)/4,cx=int(q.x)-i*4;if(cx>2)return 0.;
 int n=(max(pi,0)*37+1013)%9000+1000,d=(n/(i==0?1000:i==1?100:i==2?10:1))%10;return float((DG[d]>>(int(q.y)*3+(2-cx)))&1);}
float vn2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y);}
// Footprint-filtered pattern pieces; fw is the pixel footprint of the coordinate, taken once outside the per-part branches.
// lin: lines of half-width hw every per (same units as x), fading to their mean coverage as the footprint grows
float lin(float x,float per,float hw,float fw){float d=abs(fract(x/per+.5)-.5)*per,l=1.-smoothstep(hw,hw+fw*1.5,d);return mix(2.*hw/per,l,smoothstep(per*.5,per*.12,fw));}
// sqw: square wave, 1 on the first half of each unit cycle of x (fw = footprint in cycles)
float sqw(float x,float fw){fw=min(fw,.25);return mix(.5,smoothstep(.25-fw,.25+fw,abs(fract(x-.25)-.5)),smoothstep(.5,.2,fw));}
// band: inside [a,b]
float band(float x,float a,float b,float fw){fw=fw*.75+1e-5;return smoothstep(a-fw,a+fw,x)*(1.-smoothstep(b-fw,b+fw,x));}
// dots of radius rad every per along s, on the row at height v0 (rivets, bolts)
float dots(float s,float v,float v0,float per,float rad,float fw){vec2 q=vec2((fract(s/per+.5)-.5)*per,v-v0);return(1.-smoothstep(rad,rad+fw,length(q)))*smoothstep(rad*2.5,rad*.6,fw);}
// Same light as the planet: sun irradiance already reddened by the air (uSunCol, CPU-integrated), sky above and ground
// bounce below as hemispheric ambient, Blinn–Phong specular normalised by roughness, metals and glass reflecting a sky/ground
// gradient, then the sky shader's tone curve and gamma — so a white tank and the ground under it finally agree.
void main(){gl_FragDepth=log2(1.+vW)*uFc*.5;
 if(uShadow>0.){o=vec4(0.,0.,0.,uShadow);return;}
 if(uGlow>0.){o=vec4(vC*uGlow,1.);return;}
 vec3 V=normalize(-vP);bool inside=dot(vN,vP)>0.;
 int m=int(vM+.5);float metal=m==1||m==5?1.:0.,rough=m==1?.32:m==2?.9:m==4?.06:m==5?.24:.42;
 vec3 alb=pow(vC,vec3(2.2)),nO=vNo,emis=vec3(0.);
 // Part detail, early-era hardware (ship, debris and the builder only). Each part carries its own surface frame: a = angle
 // around its axis, s = arc length at its nominal radius R, v = height above its bottom, h = its height; sc scales the
 // 1.25 m class detail sizes to the part. T is the tangent around the axis, for bump detail that tilts the normal.
 int k=int(vK.x+.5),pi=int(vK.y+.5),hq=k/256,sch=(k/32)%8;k=k%32;bool up=hq>=64;hq=hq%64;float hue=float(hq)/36.;   // school, livery hue and the upper-stage flag ride in the kind (Q102, Q228)
 float a=vU.x*6.2832,R=max(vU.z,.05),s=a*R,v=vU.y,h=vU.w,sc=R/.625,fu=fwidth(vU.x),fs=fu*6.2832*R,fv=fwidth(v);bool side=abs(vNo.y)<.6;
 float fp=side?max(fs,fv):length(fwidth(vO.xz));   // on caps the around-axis rate differs per triangle: use the planar footprint
 vec3 T=vec3(-sin(a),0.,cos(a));float blk=0.;vec4 rdl=vec4(0.);   // rdl: the roundel, laid on after the school's paint
 if(uSeam>0.&&k>0){
  if(k==1&&side){                                         // propellant tank
   float b=.07*sc,paint=band(v,b,h-b,fv);
   if(h>3.*sc){float bh=min(1.4*sc,h*.2),q=sqw(vU.x*2.,fu*2.);                  // roll-pattern checker bands, top and bottom
    float rt=sqw((v-(h-b-bh))/bh,fv/bh),rb=sqw((v-b)/bh,fv/bh);
    blk=band(v,h-b-bh,h-b,fv)*mix(1.-rt,rt,q)+band(v,b,b+bh,fv)*mix(rb,1.-rb,q);}
   else if(h>1.5*sc){float dq=abs(fract(vU.x*2.+.5)-.5)*3.1416*R;blk=(1.-smoothstep(.09*sc,.09*sc+fs,dq))*paint;}   // two opposite stripes
   float ring=lin(v-b,1.25*sc,.006,fv)*paint,seam=lin(s-1.5708*R,6.2832*R,.004,fs)*paint,pan=hh(vec2(floor((v-b)/(1.25*sc)),3.))-.5;
   float str=vn2(vec2(s*2.2,v*.12))*vn2(vec2(s*7.,v*.5+9.)),fd=smoothstep(.05,.012,fp);
   if(sch!=0)blk=0.;   // the roll pattern is Cape's alone (Q102, Q228)
   alb=mix(alb,pow(hsv(hue,.55,.16),vec3(2.2)),blk);alb*=(1.-.45*ring)*(1.-.3*seam)*(1.+.06*pan*fd)*(1.-.16*str*fd);
   float rv=max(dots(s,v,b*.5,.07*sc,.009*sc,fp),dots(s,v,h-b*.5,.07*sc,.009*sc,fp));alb=mix(alb,vec3(.09),rv*(1.-paint));
   if(ROUNDEL_ON&&h>1.5*sc&&h<=3.*sc){float rs=.3*sc;rdl=roundel(vec2(s-1.5708*R,v-h*.5)/rs,sch,fp/rs,hue);rdl.a*=paint;}}   // the roundel, between the stripes
  else if(k==2){                                           // bell: regen tubes, heat tint toward the throat, a stiffener at the lip
   float t=clamp(v/max(h,.01),0.,1.),N=floor(6.2832*R/.035+.5),ph=fract(vU.x*N),fd=smoothstep(.5,.15,fu*N);
   nO+=T*sin(ph*6.2832)*.35*fd*(inside?-1.:1.);alb*=1.-.35*fd*smoothstep(.75,1.,abs(ph-.5)*2.);
   vec3 tint=mix(mix(vec3(1.,.82,.5),vec3(.45,.5,1.),smoothstep(.55,.8,t)),vec3(.8,.45,.9),smoothstep(.8,.95,t));
   alb*=mix(vec3(1.),tint*1.25,.65*smoothstep(.35,.7,t));
   float lip=band(v,-.01,.035*sc,fv);alb=mix(alb,vec3(.35,.34,.33),lip);rough=mix(rough,.5,lip);
   if(inside){alb*=.3;rough=.7;}}
  else if(k==16&&side){                                    // station module: meteoroid-shield panels on the pressure hull
   float pv=band(v,.1*sc,h-.1*sc,fv),NA=8.,pa=fract(vU.x*NA),ph=.55*sc,pr=v/ph,
     sa=lin(vU.x*NA,1.,.012*NA/(6.2832*R),fu*NA),sr=lin(v,ph,.006*sc,fv),seam=max(sa,sr)*pv,
     pid=hh(vec2(floor(vU.x*NA),floor(pr))),pil=(pa-.5)*(fract(pr)-.5),fd=smoothstep(.04,.01,fp);
   alb*=(1.-.4*seam)*(.94+.1*pid*fd);nO+=T*(pa-.5)*.12*pv*fd;
   float bl=dots(s,v,ph,6.2832*R/NA,.008*sc,fp)*pv;alb=mix(alb,vec3(.42,.43,.45),bl);}
  else if(k==15){                                          // engine mount: bolt ring under the tank flange
   alb=mix(alb,vec3(.05),dots(s,v,h-.035*sc,.06*sc,.008*sc,fp));}
  else if(k==3&&side){                                     // capsule: dark corrugated shingles, a window, a hatch
   float body=band(v,.06*sc,1.2*sc,fv),N=floor(6.2832*R/.04+.5),ph=fract(vU.x*N),fd=smoothstep(.5,.15,fu*N);
   alb=mix(alb,vec3(.028,.029,.032),body);metal=mix(metal,.6,body);rough=mix(rough,.48,body);
   nO+=T*sin(ph*6.2832)*.22*fd*body;
   float vr=v-.06*sc,row=lin(vr,.22*sc,.004*sc,fv),rn=hh(vec2(floor(vr/(.22*sc)),floor(vU.x*6.)))-.5;
   alb*=(1.-.55*row*body)*(1.+.25*rn*body);alb=mix(alb,vec3(.1),dots(s,mod(vr,.22*sc),.018*sc,.05*sc,.005*sc,fp)*body);
   float du=abs(fract(vU.x-.125+.5)-.5),win=band(du,-1.,.032,fu)*band(v,.44*sc,.72*sc,fv),frm=band(du,-1.,.042,fu)*band(v,.40*sc,.76*sc,fv);
   alb=mix(alb,vec3(.16,.16,.17),frm);metal=mix(metal,1.,frm);
   if(win>.01){alb=mix(alb,vec3(.01,.012,.015),win);metal*=1.-win;rough=mix(rough,.05,win);m=win>.5?4:m;}
   float dh=abs(fract(vU.x-.375+.5)-.5),hat=band(dh,-1.,.035,fu)*band(v,.16*sc,.58*sc,fv),hin=band(dh,-1.,.030,fu)*band(v,.18*sc,.56*sc,fv);
   alb*=1.-.7*(hat-hin);alb=mix(alb,vec3(.2),dots(dh*6.2832*R,v,.36*sc,1.,.014*sc,fp));}
  else if(k==4&&side){                                     // nose cone: fairing split lines with rivets, a ring, a scorched tip
   float dq=abs(fract(vU.x*2.+.25)-.5)*3.1416*R;float sp=1.-smoothstep(.004,.004+fs*1.5,dq);
   alb*=1.-.5*sp;alb=mix(alb,vec3(.15),dots(v,dq,.022,.06,.006,fp)*band(v,.05,1.2*sc,fv));
   alb*=1.-.4*lin(v-.3*sc,8.,.005,fv)*band(v,.2*sc,.4*sc,fv);
   alb*=1.-.35*vn2(vec2(s*9.,v*4.))*band(v,1.25*sc,2.*sc,fv);}
  else if(k==5&&side){                                     // decoupler: hazard band, ribbed skirt, separation groove + bolts, interstage vents
   float y1=.12*sc,hz=sqw((s+v)/(.14*sc),(fs+fv)/(.14*sc));alb=mix(alb,vec3(.02),(1.-hz)*band(v,.015*sc,y1-.015*sc,fv));
   float sk=band(v,y1,.25*sc,fv),N=floor(6.2832*R/.06+.5),ph=fract(vU.x*N),fd=smoothstep(.5,.15,fu*N);
   nO+=T*smoothstep(.75,.95,abs(ph-.5)*2.)*sign(ph-.5)*.5*fd*sk;
   alb*=1.-.7*lin(v-y1,9.,.004,fv);alb=mix(alb,vec3(.4),dots(s,v,y1+.03*sc,.08*sc,.008*sc,fp));
   float sh=band(v,.25*sc,9.,fv);if(sh>0.){float N2=floor(6.2832*R/.12+.5),p2=fract(vU.x*N2),f2=smoothstep(.5,.15,fu*N2);
    nO+=T*smoothstep(.8,.97,abs(p2-.5)*2.)*sign(p2-.5)*.4*f2*sh;alb*=1.-.6*lin(v-.25*sc,.9*sc,.004,fv)*sh;
    alb=mix(alb,vec3(.02),dots(s,v,.25*sc+.35*sc,.5*sc,.05*sc,fp)*sh);}}
  else if(k==6){                                           // fin ring rivets; fins keep the paint, with grime
   if(side&&R>.5)alb=mix(alb,vec3(.3),max(dots(s,v,.04*sc,.07*sc,.007*sc,fp),dots(s,v,h-.04*sc,.07*sc,.007*sc,fp)));
   alb*=1.-.12*vn2(vec2(vO.x*3.+vO.z*3.,vO.y*.8))*smoothstep(.05,.012,fp);}
  else if(k==7){                                           // instruments: crinkled gold foil between bolted equipment rings
   if(m==5){vec2 g=vec2(s,v)*vec2(60.,46.);float fd=smoothstep(.02,.005,fp),fd2=smoothstep(.008,.002,fp);   // crinkles: tilt, not tint
    float nx=vn2(g)-.5+.5*(vn2(g*2.3+7.)-.5)*fd2,ny=vn2(g+3.1)-.5+.5*(vn2(g*2.3+1.)-.5)*fd2;
    nO+=(T*nx+vec3(0.,1.,0.)*ny)*.75*fd;alb*=.92+.16*vn2(g*.25);}
   else if(side)alb=mix(alb,vec3(.45),max(dots(s,v,.035*sc,.09*sc,.009*sc,fp),dots(s,v,h-.035*sc,.09*sc,.009*sc,fp)));}
  else if(k==8&&side){                                     // biocapsule: a porthole with a bolted frame, a hatch seam
   vec2 q=vec2(abs(fract(vU.x-.125+.5)-.5)*6.2832*R*.75,v-.47*sc);float dr=length(q);
   float win=1.-smoothstep(.075*sc,.075*sc+fp,dr),frm=1.-smoothstep(.1*sc,.1*sc+fp,dr);
   alb=mix(alb,vec3(.25),frm-win);metal=mix(metal,1.,frm-win);
   if(win>.01){alb=mix(alb,vec3(.01,.012,.015),win);rough=mix(rough,.05,win);m=win>.5?4:m;}
   alb*=1.-.6*lin(s-3.1416*R,6.2832*R,.004,fs)*band(v,.15*sc,.8*sc,fv);}
  else if(k==9&&side){                                     // mass simulator: bolted steel plates
   float pl=band(v,.05*sc,.45*sc,fv);alb*=1.-.6*pl*max(lin(v-.05*sc,.1*sc,.003,fv),lin(s,1.5708*R,.003,fs));
   alb=mix(alb,vec3(.06),dots(s+.025*sc,mod(v-.05*sc,.1*sc),.05*sc,.15*sc,.008*sc,fp)*pl);
   alb*=1.+.15*(hh(vec2(floor((v-.05*sc)/(.1*sc)),floor(vU.x*4.)))-.5)*pl;}
  else if(k==10){                                          // parachute: canister straps, woven canvas cap
   float cap=step(.22*sc,v);if(side&&cap<.5){float dq=abs(fract(vU.x*2.+.5)-.5)*3.1416*R;alb=mix(alb,vec3(.05,.05,.04),1.-smoothstep(.025,.025+fs,dq));}
   alb*=1.-.15*cap*sqw(s*60.,fs*60.)*sqw(v*60.,fv*60.)*smoothstep(.02,.008,fp);}
  else if(k==11){                                          // heat shield: ablator honeycomb, charred unevenly
   vec2 g=(side?vec2(s,v):vO.xz)/(.045*sc);g.x+=.5*floor(g.y);float fg=fp/(.045*sc);
   float cell=max(lin(g.x,1.,.06,fg),lin(g.y,1.,.06,fg));alb*=(1.-.5*cell)*(.75+.5*vn2(g*.3));rough=.95;}
  else if(k==12&&side){                                    // adapter: black roll quadrants on the cone, rivets on the flanges
   float cone=band(v,.15*sc,1.35*sc,fv);blk=sch!=0?0.:sqw(vU.x*2.,fu*2.)*cone;alb=mix(alb,vec3(.018),blk);
   alb=mix(alb,vec3(.4),max(dots(s,v,.075*sc,.08*sc,.008*sc,fp),dots(vU.x*6.2832*.625*sc,v,1.425*sc,.07*sc,.008*sc,fp)));}
  else if(k==13){                                          // radial decoupler: hazard chevrons, bolts
   alb=mix(alb,vec3(.02),1.-sqw((v+vO.x*.5)/.12,fv/.12+.01));}
  else if(k==14&&side){                                    // reinforcement collar: a bolt row
   alb=mix(alb,vec3(.6),dots(s,v,h*.5,.06,.01,fp));}
 }
 // Steppe (Q102): grey-green enamel panel by panel, dark seams where Cape has its roll pattern; olive-tinted bells
 if(uSeam>0.&&sch==1&&k>0){float wl=dot(alb,vec3(.3,.59,.11));
  if(k!=2&&k!=15&&wl>.25){float pn=hh(vec2(floor(v/(1.3*sc)),floor(vU.x*8.)))-.5;alb=pow(vec3(.47,.54,.44),vec3(2.2))*(1.+.12*pn)*clamp(wl/.7,.6,1.1);
   if(side)alb*=1.-.35*min(1.,lin(v,1.3*sc,.006,fv)+lin(s,6.2832*R/8.,.005,fs));rough=max(rough,.55);metal=0.;}
  else if(k==2)alb*=vec3(.74,.84,.66);}
 // Arsenal (2), Coastal (3), Mountain (4), Isle (5) (Q228; POWERS.md § "School briefs", mock-ups Q227): each repaints the
 // white base as Steppe does, and has its own bells, joints, decals and interstage cover. up: an upper-stage part
 if(uSeam>0.&&sch>=2&&k>0){float wl=dot(alb,vec3(.3,.59,.11)),lum=clamp(wl/.7,.6,1.1),fd=smoothstep(.05,.012,fp);vec3 hc=pow(hsv(hue,.8,.66),vec3(2.2)),
   pas=pow(hsv(hue,.38,.88),vec3(2.2)),saf=pow(vec3(.96,.6,.15),vec3(2.2)),carb=pow(vec3(.075,.075,.085),vec3(2.2));
  if(k==2){float t=clamp(v/max(h,.01),0.,1.);   // bells (t: 0 at the lip, 1 at the throat)
   if(sch==2)alb=pow(mix(vec3(.42,.36,.55),vec3(.55,.38,.2),smoothstep(0.,.8,t)),vec3(2.2))*(1.-.45*lin(v,.18*sc,.014*sc,fv));   // heat-stained, thick rings
   else if(sch==3)alb=mix(pow(vec3(.78,.79,.82),vec3(2.2)),vec3(.02),smoothstep(.6,.66,t));   // silver, a dark throat
   else if(sch==4)alb*=vec3(1.,.8,.45);   // gold-tinted
   else alb=pow(vec3(.76,.43,.27),vec3(2.2))*(1.-.15*lin(v,.02*sc,.004*sc,fv));   // copper, printed in layers
   if(inside)alb*=.3;}
  else if(k==14&&side){float ym=h*.5;metal=0.;   // the interstage cover
   if(sch==2){float cl=(fract(vU.x*8.+.5)-.5)*6.2832*R/8.,w=max(abs(cl)-.13*sc,abs(v-ym)-h*.21);if(w<0.)discard;   // vent windows (hot staging): the engine shows through
    alb=pow(vec3(.34,.37,.22),vec3(2.2))*(w<.05*sc?.45:1.);rough=.8;}
   else if(sch==3){alb=mix(pow(vec3(.92,.92,.9),vec3(2.2)),pas,band(v,ym-.03*sc,ym+.03*sc,fv));alb=mix(alb,vec3(.02),dots(s,v,h*.75,6.2832*R/16.,.035*sc,fp));rough=.5;}   // smooth, a pastel stripe, round vent ports
   else if(sch==4){alb=mix(pow(vec3(.94,.94,.92),vec3(2.2)),vec3(.3),dots(s,v,.06*sc,6.2832*R/20.,.022*sc,fp));rough=.6;}   // a ring of separation bolts
   else{alb=mix(carb,hc,band(v,ym-.04*sc,ym+.04*sc,fv));rough=.45;}}   // flush carbon, a hue stripe
  else if(k!=15&&wl>.25){float pn=hh(vec2(floor(v/(1.25*sc)),floor(vU.x*6.)))-.5;metal=0.;
   if(sch==2){alb=pow(up?vec3(.66,.68,.7):vec3(.34,.37,.22),vec3(2.2))*(1.+(up?.12:.08)*pn*fd)*lum;metal=up?.75:0.;rough=up?.4:.8;}   // olive below, bare metal above, matte
   else if(sch==3)rough=.5;   // satin white
   else if(sch==4){alb=pow(up?vec3(.94,.94,.92):vec3(.64,.32,.19),vec3(2.2))*lum;rough=.7;}   // terracotta below, white above
   else{float wv=sqw(s*20.+.5*sqw(v*20.,fv*20.),fs*20.);alb=carb*(1.+.35*(wv-.5)*fd)*lum;rough=.5-.15*wv*fd;}}   // matte black carbon; the weave shows in raking light
  if(k==1&&side){float b=.07*sc;
   if(sch==2&&h>1.5*sc)alb=mix(alb,vec3(.8),serial(vec2(s-1.5708*R+.8*sc,v-h*.28)/(.045*sc),pi)*smoothstep(.04*sc,.01*sc,fp));   // a stencilled serial
   if(sch==3){if(up)alb=mix(alb,pas,band(v,h*.5-.16*sc,h*.5+.16*sc,fv));alb=mix(alb,pas,max(band(v,b,b+.025*sc,fv),band(v,h-b-.025*sc,h-b,fv)));}   // one pastel band round the upper stage; pin-stripes at the joints
   if(sch==4)alb=mix(alb,saf,max(band(v,-1.,b+.03*sc,fv),band(v,h-b-.03*sc,h+1.,fv)));   // saffron at every joint
   if(sch==5){if(up)alb=mix(alb,hc,band(v,h-b-.16*sc,h-b-.08*sc,fv));   // the hue band under the fairing; mission patches
    alb=mix(alb,saf,1.-smoothstep(.12*sc,.12*sc+fp,length(vec2(s-1.5708*R-.45*sc,v-h*.72))));alb=mix(alb,pow(vec3(.25,.55,.85),vec3(2.2)),1.-smoothstep(.1*sc,.1*sc+fp,length(vec2(s-1.5708*R-.45*sc,v-h*.72+.3*sc))));}}
  if(k==5&&side){float hz=band(v,0.,.12*sc,fv);   // the separation plane
   if(sch==2)alb=mix(alb,step(.5,fract((s+v)/(.14*sc)))>.5?hc:vec3(.8),hz);   // a striped band, in the livery's hue
   else if(sch==3)alb=mix(alb,mix(pow(vec3(.92),vec3(2.2)),pas,band(v,.045*sc,.075*sc,fv)),hz);
   else if(sch==4)alb=mix(alb,saf,hz);
   else alb=mix(alb,carb,hz);}}
 alb=mix(alb,rdl.rgb,rdl.a);
 // Flight marks, per part (see marksTick): uMk = (soot, frost, fuel level, nozzle glow), uCh = (windward direction in the
 // ship frame, char). Soot climbs streakily from the part's base; char scorches the paint yellow-brown, then blackens it, on
 // the side the air came from (all over on the shield); frost sits below the fuel line in patches that thin as it sheds;
 // a vacuum nozzle extension glows dull red to orange from the exit up.
 if(uSeam>0.&&k>0&&pi>=0&&pi<96){vec4 mk=uMk[pi],ch=uCh[pi];vec2 q2=side?vec2(s,v):vO.xz;float nz=vn2(q2*vec2(3.,1.5)),nz2=vn2(q2*vec2(11.,6.)+4.);
  if(mk.x>0.){float st=mk.x*(k==2||k==15?1.:exp(-v/(.9*sc)))*(.7+.3*vn2(vec2(s*6.,v*.7)));st=clamp(st*1.2,0.,.985);   // soot is blacker than black paint
   alb=mix(alb,vec3(.004,.0036,.003),st);rough=mix(rough,max(rough,.85),st);metal*=1.-.6*st;}
  if(ch.w>0.){float c1=ch.w*(k==11?1.:smoothstep(-.3,.7,dot(vNo,ch.xyz)))*(.65+.7*vn2(side?vec2(s*9.,v*.9):q2*7.)),cb=k==11?smoothstep(.1,.6,c1):smoothstep(.25,1.,c1);   // streaked along the flow (planar on caps)
   float dk=1.-smoothstep(.04,.18,dot(alb,vec3(.3,.59,.11)));   // dark paint (the capsule's shingles): char can't blacken black
   alb=mix(alb,alb*vec3(.85,.7,.45),smoothstep(0.,.35,c1));alb=mix(alb,vec3(.006,.0045,.0035),min(1.,cb*(.75+.35*nz)));
   alb=mix(alb,mix(vec3(.10,.068,.04),vec3(.05,.058,.078),nz2),dk*.8*smoothstep(.1,.5,c1)*(1.-.45*cb));   // Q24: it heat-tints instead, bronze to blue-grey, like Mercury's shingles
   rough=mix(rough,max(rough,.85),cb);metal*=1.-cb;}
  // frost: a fine, translucent rime below the fuel line (the paint shows through it, so a new tank still looks new), a
  // little thicker toward the bottom, with a soft ragged edge at the fuel line and faint run-off streaks; not opaque
  // blotches (PLAYTEST #3: those read as worn paint)
  if(k==1&&mk.y>0.&&side){float lv=mk.z*h,fine=vn2(q2*vec2(46.,23.)+7.)*.55+vn2(q2*vec2(120.,60.)+2.)*.45,
    edge=1.-smoothstep(lv-(.1+.12*nz)*sc,lv,v),run=.75+.25*vn2(vec2(s*30.,v*1.2)),
    fr=mk.y*edge*run*(.12+.16*fine+.1*(1.-clamp(v/max(lv,.01),0.,1.)));
   alb=mix(alb,vec3(.86,.9,.95),fr);rough=mix(rough,.8,fr);metal*=1.-fr;nO+=T*(fine-.5)*.15*fr;}
  if(k==2&&mk.w>0.){float g=mk.w*(1.-smoothstep(.35,.75,clamp(v/max(h,.01),0.,1.)));emis+=mix(vec3(.6,.05,0.),vec3(1.,.55,.15),g)*g*g*4.;}
 }
 // the launch complex (uPadM, set while the pad and its rig draw; PLAYTEST #4): surface detail from the pad-local position
 // (metres) and the material class. Concrete: formwork seams, mottling, rain stains running down from the tops. White
 // paint (tanks, the LOX sphere, the water tower): weld rings every 2.4 m with rust weeping from them. Steel: mill
 // mottling and rust spots. Everything darkens toward its foot (grime, ground contact). Fades out with distance.
 if(uPadM>0.){vec3 o=vO,an=abs(vNo);bool vt=an.y<.55;vec2 uv=vt?vec2(an.x>an.z?o.z:o.x,o.y):o.xz;
  vec2 fw=fwidth(uv);float fd=smoothstep(.25,.03,max(fw.x,fw.y)),n1=vn2(uv*.4),n2=vn2(uv*1.9+3.),n3=vn2(uv*8.+1.);
  float foot=mix(.62,1.,smoothstep(0.,1.6,o.y));bool white=m==0&&dot(alb,vec3(.333))>.45;
  if(m==2){float sm=vt?max(lin(o.y,1.2,.012,fw.y),lin(uv.x,3.,.014,fw.x)):max(lin(uv.x,4.,.02,fw.x),lin(uv.y,4.,.02,fw.y));
   float st=vt?smoothstep(.45,.85,vn2(vec2(uv.x*1.4,o.y*.12))*.75+n2*.25):0.;
   alb*=(1.-.32*sm*fd)*(.84+.3*n1)*(.93+.14*n3*fd)*(1.-.22*st*fd)*foot;rough=max(rough,.85);}
  else if(white){float ring=vt?lin(o.y,2.4,.018,fw.y):0.,wk=vt?smoothstep(.6,.9,vn2(vec2(uv.x*2.6,o.y*.35)))*(1.-smoothstep(0.,1.6,fract(o.y/2.4)*2.4)):0.;
   alb*=(1.-.35*ring*fd)*(.95+.08*n1);alb=mix(alb,alb*vec3(.78,.62,.45),.45*wk*fd);alb*=foot;}
  else if(m==1){alb*=.8+.35*n2;alb=mix(alb,vec3(.23,.12,.06),smoothstep(.72,.86,n3*.6+n1*.4)*.55*fd);alb*=foot;}
  else{alb*=(.9+.15*n1)*(.96+.06*n3*fd)*foot;}}
 vec3 n=normalize(mat3(uM)*nO);if(dot(n,vP)>0.)n=-n;
 vec3 F0=mix(vec3(m==4?.06:.04),alb,metal),dif=alb*(1.-metal);
 float ndl=max(dot(n,uSun),0.),nv=max(dot(n,V),0.);vec3 H=normalize(uSun+V);
 float ex=2./(rough*rough*rough*rough+1e-4)-2.,spec=(ex+8.)/25.13*pow(max(dot(n,H),0.),ex);
 vec3 Fs=F0+(1.-F0)*pow(1.-max(dot(V,H),0.),5.),Fv=F0+(1.-F0)*pow(1.-nv,5.)*(1.-rough);
 vec3 sun=uSunCol*uLit,amb=mix(uGnd,uSky,.5+.5*dot(n,uUp));
 vec3 Rr=reflect(-V,n),env=mix(uGnd,uSky*1.3,smoothstep(-.15,.25,dot(Rr,uUp)));
 vec3 c=dif*(sun*ndl+amb)+sun*ndl*Fs*spec*.25+env*Fv*(metal+(m==4?1.:.35))+emis;
 // floodlights: banks on 16 m poles aimed at the pad (uFlC); a soft cone and inverse-square falloff, so the pad and the
 // near faces of buildings are lit and the far sides and the outskirts fall to dark (PLAYTEST #4)
 if(uFlI>0.){float fl=0.;for(int i=0;i<4;i++){vec3 L=uFl[i]-vP;float d2=dot(L,L);vec3 Ld=L*inversesqrt(d2);
    float cone=smoothstep(.5,.86,dot(-Ld,normalize(uFlC-uFl[i])));fl+=max(dot(n,Ld),0.)*cone*420./(d2+60.);}
  c+=dif*vec3(1.,.88,.7)*(fl+.05*smoothstep(160.,40.,length(vP-uFlC)))*uFlI;}   // + faint spill bounced off the apron
 // the engine plumes' light (plumeLight, aerofx): one soft point light in the flame, uPl = (position, core radius)
 if(uPlC.r+uPlC.g>0.){vec3 L=uPl.xyz-vP;float d2=dot(L,L);c+=dif*uPlC*(max(dot(n,L*inversesqrt(d2)),0.)*.85+.15)/(d2+uPl.w*uPl.w);}
 c=clamp((c*.85*(2.51*c*.85+.03))/(c*.85*(2.43*c*.85+.59)+.14),0.,1.);o=vec4(pow(c,vec3(1./2.2)),1.);}`;
const LINE_VS=`#version 300 es
layout(location=0) in vec3 aP;layout(location=2) in vec4 aC;uniform mat4 uVP;uniform float uFc;out vec4 vC;out float vW;
void main(){gl_Position=uVP*vec4(aP,1.);vW=gl_Position.w;gl_Position.z=(log2(max(1e-6,1.+gl_Position.w))*uFc-1.)*gl_Position.w;vC=aC;}`;
const LINE_FS=`#version 300 es
precision highp float;in vec4 vC;in float vW;out vec4 o;uniform float uFc;void main(){o=vC;gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
function mkProg(vs,fs){const p=gl.createProgram();
  for(const[t,s]of[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh)}
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const f=gl.getActiveUniform(p,i);u[f.name]=gl.getUniformLocation(p,f.name)}return{p,u}}
// city texture: 1024×512 equirectangular, built once on the CPU from CITIES (r = built-up density, g = night lights)
// the baked world for the ground shader: heights etc. as exact floats (read with texelFetch), climate filtered
const WORLD_TEX=(()=>{const n=WTW*WTH,a=new Float32Array(n*4),c=new Float32Array(n*4);
  for(let k=0;k<n;k++){a[k*4]=WORLD.E[k];a[k*4+1]=WORLD.M[k];a[k*4+2]=WORLD.V[k];a[k*4+3]=WORLD.S[k];c[k*4]=WORLD.T[k];c[k*4+1]=WORLD.W[k];c[k*4+2]=WORLD.U[k]}
  const mk=(fmt,data,filt)=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,fmt,WTW,WTH,0,gl.RGBA,gl.FLOAT,data);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filt);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filt);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t};
  return{w:mk(gl.RGBA32F,a,gl.NEAREST),c:mk(gl.RGBA16F,c,gl.LINEAR)}})();
const CITY_TEX=(()=>{const W=2048,H=1024,d=new Uint8Array(W*H*4),R=rng(99);
  for(const c of CITIES){const lat=Math.asin(c.u[1]),lon=Math.atan2(c.u[2],c.u[0]),ang=c.rad/TELLUS.R,rpx=ang/Math.PI*H*1.8+2;
    const cx=(lon/6.2832+.5)*W,cy=(lat/Math.PI+.5)*H,sx=rpx/Math.max(.2,Math.cos(lat));
    for(let y=Math.floor(cy-rpx);y<=cy+rpx;y++)for(let x=Math.floor(cx-sx);x<=cx+sx;x++){const dx=(x-cx)/sx,dy=(y-cy)/rpx,r2=dx*dx+dy*dy;if(r2>1||y<0||y>=H)continue;
      const k=((y*W+((x%W)+W)%W)*4),v=Math.exp(-r2*2.6)*(.7+.3*R());d[k]=Math.min(255,d[k]+v*255);d[k+1]=Math.min(255,d[k+1]+v*255*(.5+.5*Math.min(1,c.pop/1e6)))}}
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,d);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t})();
// engine plume: a raymarched volume, axisymmetric about the nozzle axis, inside a bounding cylinder (unit lathe scaled by
// uB = [R, L, exit radius]; local frame in metres, y 0 at the nozzle exit → −L downstream, s = −y). Shape follows the
// pressure ratio n = pe/pa (exit over ambient): over-expanded jets pinch in, matched ones run straight with shock
// diamonds every Lc ∝ √n, under-expanded ones balloon (spread angle grows with log n), and the gas thins as (re/rb)² as
// it spreads, so a vacuum plume is wide and faint. Colours and strengths come from the engine's propellant profile (PFX):
// a hot core over the potential-core length, diamonds, a fuel-rich afterburning mantle that needs air, a gas glow, and
// soot that absorbs (premultiplied blend, so a kerolox tail can darken what is behind it).
// uS: x = n (pe/pa), y = tan of the spread angle, z = diamond visibility, w = air density ratio; uK: core, diamond, mantle,
// soot gains. rb(s) is the jet boundary radius; the vertex shader bends the proxy lathe to ~1.9 rb (Waterfall-style mesh
// deformation), so the march only runs where there can be plume.
const PLUME_RB=`float rb(float s,float re){return (re*mix(1.,sqrt(clamp(uS.x,.3,1.)),smoothstep(0.,1.5*re,s))+s*(uS.y+.035*uS.w))*(1.+uIg.w*(.5+1.2*smoothstep(0.,4.*re,s)));}`;
const PLUME_VS=`#version 300 es
layout(location=0) in vec3 aP;uniform mat4 uVP,uM;uniform vec3 uB;uniform vec4 uS,uIg;uniform float uFc;out vec3 vL;out float vW;
${PLUME_RB}
void main(){float s=-aP.y*uB.y,k=min(uB.x,1.9*rb(s,uB.z)+.15*uB.z)*1.0086;vL=vec3(aP.x*k,-s,aP.z*k);
 vec4 w=uM*vec4(vL,1.);gl_Position=uVP*w;vW=gl_Position.w;gl_Position.z=(log2(max(1e-6,1.+gl_Position.w))*uFc-1.)*gl_Position.w;}`;
const PLUME_FS=`#version 300 es
precision highp float;precision highp sampler3D;in vec3 vL;in float vW;out vec4 o;
uniform vec3 uB,uCam,uCo,uDi,uMa,uVa,uSo;uniform vec4 uK,uS,uGp,uIg;uniform float uFc,uT,uIn,uI,uOp;uniform sampler3D uN;
${PLUME_RB}
void main(){float R=uB.x,L=uB.y,re=uB.z;vec3 rd=normalize(vL-uCam);
 // the stretch of the ray inside the bounding cylinder: from the proxy's front face (or the eye, when inside) to where it leaves
 vec3 p0=uIn>.5?uCam:vL;float t1;
 {float a=dot(rd.xz,rd.xz),b=dot(p0.xz,rd.xz),c=dot(p0.xz,p0.xz)-R*R,ts=a>1e-9?(-b+sqrt(max(0.,b*b-a*c)))/a:1e9;
  float ty=rd.y<-1e-6?(-L-p0.y)/rd.y:rd.y>1e-6?-p0.y/rd.y:1e9;t1=max(0.,min(ts,ty));if(uIn>.5)t1=min(t1,length(vL-uCam));}
 const int N=32;float ds=t1/float(N),j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
 float Lc=re*2.4*sqrt(clamp(uS.x,.3,4.)),Lp=re*(3.5+2.5*uS.w),st=ds/re;
 vec3 C=vec3(0.),Tr=vec3(1.);
 for(int i=0;i<N;i++){vec3 p=p0+rd*(ds*(float(i)+j));float s=-p.y;if(dot(p,uGp.xyz)<uGp.w)break;if(s<0.||s>L)continue;   // the ground (uGp: its plane) is opaque
  float b=rb(s,re),r=length(p.xz);if(r>1.95*b)continue;   // outside even the noisiest edge: skip before any noise
  vec3 q=vec3(p.x,s-uT*re*30.,p.z)/(re*.8);float nn=texture(uN,q*.03125).r*.65+texture(uN,q*.0844+.21).r*.35;
  float u=r/(b*(1.+(.08+.3*s/L)*(nn-.5)*2.)),d=pow(re/b,1.3);   // density ∝ (re/rb)², seen through a path ∝ rb
  if(u>1.4)continue;
  float prof=exp(-2.2*u*u)*smoothstep(1.4,1.,u),fade=smoothstep(L,L*.45,s+(nn-.5)*L*.25);
  float core=smoothstep(Lp,0.,s+2.2*re*u)*smoothstep(1.05,.4,u);
  float k=floor(s/Lc+.5),f=s/Lc-k,dm=k>=1.&&k<6.?exp(-.45*(k-1.))*exp(-f*f*14.-u*u*4.):0.;
  float mantle=uK.z*uS.w*smoothstep(.35,.95,u)*smoothstep(1.35,1.,u)*smoothstep(0.,3.*re,s)*fade*(.4+1.2*nn);
  float rich=uIg.w*(.5+nn);vec3 co=mix(uCo,uMa*vec3(1.,.8,.6),min(rich,1.));
  float gf=min(1.,uIg.r+uIg.g+uIg.b);   // while the igniter flashes, its colour outshines the young flame
  vec3 e=uI*(co*uK.x*core*d*.45+uDi*uK.y*uS.z*dm*.45*(1.-uIg.w)+uMa*(mantle+rich*prof*.6)*sqrt(d)*.5+uVa*prof*d*fade*(.6+.4*nn)*.18)*(1.-.85*gf)
   +uIg.rgb*(core*2.+prof*(.6+nn))*d*smoothstep(6.*re,0.,s);   // the igniter's flash (TEA-TEB green on kerolox)
  float soot=uK.w*uS.w*(smoothstep(.45*L,.9*L,s)*prof*fade*nn*2.+smoothstep(.75,1.,u)*smoothstep(1.25,1.,u)*smoothstep(3.*re,re,s)*.8)+uK.w*rich*prof*smoothstep(1.5*re,5.*re,s)*smoothstep(14.*re,6.*re,s)*1.5;   // start/stop soot stays near the nozzle
  C+=Tr*e*st;Tr*=exp(-(uSo*soot+uOp*uI*(core*d*.4+mantle*.25))*st);if(max(Tr.r,max(Tr.g,Tr.b))<.02)break;}
 vec3 c=pow(1.-exp(-C),vec3(1./1.5));float a=1.-dot(Tr,vec3(.333));
 o=vec4(c,a);gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
// 32³ tiling value noise for the plume's turbulence: one trilinear fetch per octave instead of eight hashes
const PNOISE=(()=>{const n=32,d=new Uint8Array(n*n*n);let x=12345;for(let i=0;i<d.length;i++){x=(x*1103515245+12345)>>>0;d[i]=x>>>24}
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_3D,t);gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,n,n,n,0,gl.RED,gl.UNSIGNED_BYTE,d);
  for(const w of[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,w,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.bindTexture(gl.TEXTURE_3D,null);return t})();
// smoke: camera-facing puffs, soft round falloff, lit like the meshes and tone-mapped the same way
const SMOKE_VS=`#version 300 es
layout(location=0) in vec3 aP;layout(location=1) in vec4 aQ;layout(location=2) in float aS;uniform mat4 uVP;uniform float uFc;uniform vec4 uPl;uniform vec3 uPlC;out vec4 vQ;out float vW,vS;out vec3 vPl;
void main(){vec3 L=uPl.xyz-aP;vPl=uPlC*.18/(dot(L,L)+4.*uPl.w*uPl.w);gl_Position=uVP*vec4(aP,1.);vW=gl_Position.w;gl_Position.z=(log2(max(1e-6,1.+gl_Position.w))*uFc-1.)*gl_Position.w;vQ=aQ;vS=aS;}`;
const SMOKE_FS=`#version 300 es
precision highp float;in vec4 vQ;in float vW,vS;in vec3 vPl;out vec4 o;uniform vec3 uLight,uAmb,uSq;uniform float uFc;
float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float nz(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){vec3 q=vec3(vQ.xy*2.2,vS);float n=nz(q)*.65+nz(q*2.3)*.35,r=length(vQ.xy)+.42*(n-.5);if(r>1.)discard;   // lumpy edge per puff
 float a=vQ.z*smoothstep(1.,.2,r)*(.75+.5*n);
 // each puff shaded as a lumpy sphere: sun side bright, the far side in its own shadow (uSq = sun in the quad's frame)
 vec3 sn=normalize(vec3(vQ.xy,sqrt(max(0.,1.-r*r))+.3)+.35*vec3(n-.5,nz(q*1.7+5.)-.5,0.));float ls=.18+.82*smoothstep(-.3,.8,dot(sn,uSq));
 vec3 c=vec3(.84,.83,.81)*(.8+.35*n)*(uLight*ls*1.25+uAmb*.55*(.6+.4*sn.y))+vec3(1.,.5,.15)*vQ.w*.8+vPl*(.7+.5*n);
 c=clamp((c*.85*(2.51*c*.85+.03))/(c*.85*(2.43*c*.85+.59)+.14),0.,1.);o=vec4(pow(c,vec3(1./2.2)),a);gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
// terrain depth pre-pass: the sky shader's functions with a main that only marches and writes the hit distance
const PDEPTH=gl.getExtension('EXT_color_buffer_float')?mkProg(QUAD_VS,SKY_FS.slice(0,SKY_FS.indexOf('void main(){'))+
  'void main(){vec3 d=normalize(uR*vNdc.x*uTan.x+uU*vNdc.y*uTan.y+uF);float hh;o=vec4(march(d,hh,0.),0.,0.,1.);}'):null;
const DEPTH_RT={tex:null,fb:null,w:0,h:0};
function depthTarget(w,h){const D=DEPTH_RT;if(D.w===w&&D.h===h)return D;if(!D.tex){D.tex=gl.createTexture();D.fb=gl.createFramebuffer()}
  // on its own unit (5, where the sky reads it): binding it on the active unit replaced whatever texture the sky had just
  // been given there (unit 0: the city lights) for that one frame, so every resize lit the night side (PLAYTEST #7)
  gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,D.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,w,h,0,gl.RED,gl.FLOAT,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,D.fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,D.tex,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE0);D.w=w;D.h=h;return D}
// re-entry plasma: a volume raymarched in a flow-aligned frame (y = upstream, origin ahead of the ship, s = −y downstream)
// inside the plume's proxy cylinder (uB = [R, L]). The hull is a capped cylinder (axis uA through uM0, radius uRb, half
// length uHl). Three parts, all scaled by the heat level uK (0 at ~15 kW/m², 1 at an orbital entry's ~160 kW/m² peak):
// the shock layer, a thin hot sheath on the faces that meet the flow (standoff uD); the wake, a cooling trail of
// streaks peeling off the hull's edges, uLw long; and a dim core in the wake.
// the hull's envelope radius at 32 stations from its bottom to its top (ship frame; radial parts count by their offset)
let PLASMA_FX=true;   // false hides the re-entry plasma (GPU A/B)
const HULLPR=new Float32Array(32);
function hullProfile(s,all){const y0=s.cm[1]+s.yBot,dy=(s.yTop-s.yBot)/31;HULLPR.fill(0);
  for(const p of s.parts){if(!p.on&&!all)continue;const off=Math.hypot(p.pos[0],p.pos[2]),pr=p.d.prof;
    for(let i=0;i<32;i++){const y=y0+i*dy-p.y0;if(y<-1e-6||y>p.h+1e-6)continue;let r=pr[pr.length-1][0];
      for(let k=1;k<pr.length;k++)if(y<=pr[k][1]){const a=pr[k-1],b=pr[k],t=b[1]>a[1]?(y-a[1])/(b[1]-a[1]):1;r=a[0]+(b[0]-a[0])*t;break}
      HULLPR[i]=Math.max(HULLPR[i],off+r)}}
  return HULLPR}
let VAPOR_FX=true;   // false hides the vapor cones (GPU A/B)
// hull shoulders for vapor cones, walking the profile downstream from the leading end (dir −1: from station 31 down):
// where the radius stops growing after a nose or flare, or steps down. Strength by how much it grew or dropped.
function hullShoulders(pr,dir){const out=[],n=pr.length,st=dir<0?n-1:0,en=dir<0?-1:n;let lo=pr[st];
  for(let i=st+dir;i!==en-dir&&i+dir!==en;i+=dir){const r=pr[i],nx=pr[i+dir];if(r<=1e-3){lo=nx;continue}lo=Math.min(lo,r);
    const grew=(r-lo)/r,drop=(r-nx)/r;
    if((grew>.15&&nx<=r+1e-3)||drop>.1){out.push([i,r,Math.min(1,Math.max(grew,drop)*1.6)]);lo=nx}}
  return out.sort((a,b)=>b[2]-a[2]).slice(0,3)}
// draws the vapor collars of the ship S when it is transonic in humid air (camera-relative frame like the meshes).
// One volume per stack line (QUEUE Q64): the core with its surface parts, and each side booster on its own axis with
// its own profile, so a booster's nose makes its own collar (the envelope alone only knew the outermost radius).
const SHA=new Float32Array(12),VLPR=new Float32Array(32);
// the radius profile of some parts about the axis (ax, az), 32 stations over [lo, hi] (vessel coordinates)
function lineProfile(parts,lo,hi,ax,az){const dy=(hi-lo)/31;VLPR.fill(0);
  for(const p of parts){const off=Math.hypot(p.pos[0]-ax,p.pos[2]-az),pr=p.d.prof;if(!pr)continue;
    for(let i=0;i<32;i++){const y=lo+i*dy-p.y0;if(y<-1e-6||y>p.h+1e-6)continue;let r=pr[pr.length-1][0];
      for(let k=1;k<pr.length;k++)if(y<=pr[k][1]){const a=pr[k-1],b=pr[k],t=b[1]>a[1]?(y-a[1])/(b[1]-a[1]):1;r=a[0]+(b[0]-a[0])*t;break}
      VLPR[i]=Math.max(VLPR[i],off+r)}}
  return VLPR}
// the ship's stack lines for the vapor: [{parts, lo, hi, ax, az}], core first. Side lines are the boosters' own stacks
// (inst.line > 0); the core keeps everything else that is on (its surface parts too), but not the radial decouplers.
function vaporLines(s){const L=new Map();
  for(const p of s.parts){if(!p.on)continue;const ln=p.inst?p.inst.line:0;if(p.inst&&p.inst.rdec)continue;const k=ln>0?ln:0;
    let e=L.get(k);if(!e){e={parts:[],lo:1e9,hi:-1e9,ax:k?p.pos[0]:0,az:k?p.pos[2]:0};L.set(k,e)}e.parts.push(p);e.lo=Math.min(e.lo,p.y0);e.hi=Math.max(e.hi,p.y0+p.h)}
  return[...L.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1]).filter(e=>e.hi>e.lo)}
let VAPOR_SIDE=true;   // false: the core's collars only (A/B for Q64)
function drawVapor(VP,camW){if(!VAPOR_FX||!S.alive||S.body!==TELLUS)return;const h=len(S.r)-TELLUS.R,M=S.mach,
    V=sstep(.84,.94,M)*(1-sstep(1.12,1.28,M))*(1-sstep(5000,15000,h));if(V<.01)return;
  const va=sub(S.v,surfVel(S.body,S.r)),vl=len(va);if(vl<1)return;const fl=qrot(qconj(S.q),mul(va,1/vl)),ds=fl[1]>0?1:-1;   // downstream is −y when flying nose first
  const p=shipWorld(),O=sub(p,camW),cl=qrot(qconj(S.q),mul(O,-1)),u=PVAPOR.u,E=lightEnv(camW);let first=true;
  for(const ln of vaporLines(S)){if(!first&&!VAPOR_SIDE)break;first=false;
    const pr=lineProfile(ln.parts,ln.lo,ln.hi,ln.ax,ln.az),hl=(ln.hi-ln.lo)/2,dy=2*hl/31,sh=hullShoulders(pr,ds>0?-1:1);if(!sh.length)continue;
    const rmax=Math.max(...pr),m=rmax*.5,R=rmax*2.6+.3,L=2*hl+2*m,top=ln.hi-S.cm[1]+m,ox=ln.ax-S.cm[0],oz=ln.az-S.cm[2],
      Mo=modelQ(S.q,O,[ox,top,oz]),clL=[cl[0]-ox,cl[1]-top,cl[2]-oz],
      inside=clL[1]<.01&&clL[1]>-L-.01&&Math.hypot(clL[0],clL[2])<R*1.01+.05;
    SHA.fill(0);sh.forEach(([i,r,k],j)=>SHA.set([-hl+i*dy,r,k,0],j*4));
    gl.useProgram(PVAPOR.p);gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniformMatrix4fv(u.uM,false,Mo);gl.uniform1f(u.uFc,FC);gl.uniform1f(u.uT,simT%1000);
    gl.uniform3f(u.uB,R,L,0);gl.uniform3fv(u.uCam,clL);gl.uniform1f(u.uIn,inside?1:0);gl.uniform3f(u.uM0,0,-(m+hl),0);gl.uniform1f(u.uHl,hl);gl.uniform1fv(u['uPr[0]'],pr);
    gl.uniform4fv(u['uSh[0]'],SHA);gl.uniform1f(u.uV,V);gl.uniform1f(u.uMa,M);gl.uniform1f(u.uDs,ds);
    gl.uniform3fv(u.uSunL,qrot(qconj(S.q),SUN));gl.uniform3fv(u.uLight,E.sun.map(x=>x*.45));gl.uniform3fv(u.uAmb,E.sky.map((x,i)=>x+E.gnd[i]));
    gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_3D,PNOISE);gl.uniform1i(u.uN,7);gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.enable(gl.CULL_FACE);gl.cullFace(inside?gl.BACK:gl.FRONT);
    gl.bindVertexArray(PLUME.vao);gl.drawArrays(gl.TRIANGLES,0,PLUME.n);gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.disable(gl.BLEND)}
  gl.useProgram(PMESH.p)}
const PLASMA_VS=`#version 300 es
layout(location=0) in vec3 aP;uniform mat4 uVP,uM;uniform vec3 uB;uniform float uFc;out vec3 vL;out float vW;
void main(){vL=aP*vec3(uB.x*1.0086,uB.y,uB.x*1.0086);vec4 w=uM*vec4(vL,1.);gl_Position=uVP*w;vW=gl_Position.w;gl_Position.z=(log2(max(1e-6,1.+gl_Position.w))*uFc-1.)*gl_Position.w;}`;
const PLASMA_FS=`#version 300 es
precision highp float;precision highp sampler3D;in vec3 vL;in float vW;out vec4 o;
uniform vec3 uB,uCam,uA,uM0,uC;uniform float uFc,uT,uIn,uK,uRb,uHl,uD,uLw,uEf,uEp,uPr[32];uniform sampler3D uN;
vec3 heat(float k){return k<.5?mix(vec3(1.,.28,.06),vec3(1.,.55,.22),k*2.):mix(vec3(1.,.55,.22),vec3(1.,.7,.95),min(1.,(k-.5)*2.));}
void main(){float R=uB.x,L=uB.y;vec3 rd=normalize(vL-uCam),p0=uIn>.5?uCam:vL;float t1;
 {float a=dot(rd.xz,rd.xz),b=dot(p0.xz,rd.xz),c=dot(p0.xz,p0.xz)-R*R,ts=a>1e-9?(-b+sqrt(max(0.,b*b-a*c)))/a:1e9;
  float ty=rd.y<-1e-6?(-L-p0.y)/rd.y:rd.y>1e-6?-p0.y/rd.y:1e9;t1=max(0.,min(ts,ty));if(uIn>.5)t1=min(t1,length(vL-uCam));}
 // steps sized by the distance to the hull: fine through the thin shock layer, coarse down the wake (≤ 56 steps);
 // ahead of the hull and clear of the shock layer, a step jumps straight to it
 float j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))),dmax=t1/16.,t=0.,h=0.;
 vec3 C=vec3(0.),cs=heat(uK),cw=heat(uK*.4);
 for(int i=0;i<56;i++){if(t>=t1)break;vec3 p=p0+rd*(t+h*j),q=p-uM0;
  // the hull's signed distance and the normal of its nearest face; the ray stops at the hull
  // (the slope correction to the radial distance only holds near the surface: far out it would pull distant points in)
  float ta=dot(q,uA);vec3 rv=q-uA*ta;float rr=length(rv),fi=clamp((ta+uHl)/(2.*uHl),0.,1.)*31.;int i0=min(int(fi),30);
  float r0=uPr[i0],r1=uPr[i0+1],sl=abs(ta)<uHl?clamp((r1-r0)*15.5/uHl,-2.5,2.5):0.,dr=rr-mix(r0,r1,fi-float(i0)),dS=dr*mix(1.,inversesqrt(1.+sl*sl),smoothstep(4.*uD,uD,dr)),dC=abs(ta)-uHl,sd=length(max(vec2(dS,dC),0.))+min(max(dS,dC),0.);
  if(sd<0.)break;
  vec3 qc=p-uC;float x=-qc.y-uEf;
  if(sd>5.*uD&&x<-2.*uEf){h=max(sd-4.5*uD,uD);t+=h;h=0.;continue;}
  h=clamp(sd*.35+uD*.2,uD*.25,dmax);h=min(h,t1-t);   // this sample stands for the stretch [t, t+h]
  vec3 n=dS>dC?normalize(rv/max(rr,1e-4)-uA*sl):uA*sign(ta);float w=n.y;   // facing the flow: n·upstream
  float nn=texture(uN,vec3(p.x,p.y*.35-uT*6.,p.z)/(uEp*.9)*.25).r;
  float sh=exp(-pow(sd/uD,1.4))*smoothstep(4.*uD,2.5*uD,sd)*smoothstep(-.1,.9,w)*(.75+.5*nn)*.8;
  // the wake: from the hull's downstream edge, distance x past it, radius ρ off the flow axis
  float rho=length(qc.xz),W=uEp*.8+.035*max(x,0.);
  float wk=0.;if(x>-2.*uEf&&rho<1.6*W){float xe=max(x,0.),dec=exp(-xe/uLw*3.)*smoothstep(-2.*uEf,0.,x);
   vec2 dr=qc.xz/max(rho,1e-4);float n2=texture(uN,vec3(dr*.7,xe/(uEp*5.)-uT*4.)).r,n3=texture(uN,vec3(dr*1.6,xe/(uEp*2.5)-uT*7.)+.37).r;
   float ring=exp(-pow((rho/W-.75)/.3,2.)),strk=smoothstep(.4,.8,n2*.6+n3*.4);
   wk=dec*(ring*(.2+1.3*strk)+.3*exp(-3.*rho*rho/(W*W))*(.6+.6*n3));}
  C+=(cs*sh*3.+cw*wk*.35)*uK*h/max(uEp,.3);t+=h;}
 vec3 c=pow(1.-exp(-C),vec3(1./1.5));o=vec4(c,0.);gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
// transonic vapor cones: a lit cloud raymarched in the ship's frame (y = ship axis, origin above the top, the plume's proxy
// lathe). Flow speeds up round each hull shoulder (the end of a nose cone, a step down in diameter), the air expands and
// cools, and humid air condenses until the shock behind it recompresses it: a collar with a soft front at the shoulder
// and a sharp rear edge at the shock, which slides aft as Mach rises. uSh[k] = (axial position, radius, strength, 0) of
// up to three shoulders; uV = visibility (Mach window × humid low air); uDs = +1 if downstream is −y.
const VAPOR_FS=`#version 300 es
precision highp float;precision highp sampler3D;in vec3 vL;in float vW;out vec4 o;
uniform vec3 uB,uCam,uM0,uSunL,uLight,uAmb;uniform vec4 uSh[3];uniform float uFc,uT,uIn,uV,uMa,uDs,uHl,uPr[32];uniform sampler3D uN;
void main(){float R=uB.x,L=uB.y;vec3 rd=normalize(vL-uCam),p0=uIn>.5?uCam:vL;float t1;
 {float a=dot(rd.xz,rd.xz),b=dot(p0.xz,rd.xz),c=dot(p0.xz,p0.xz)-R*R,ts=a>1e-9?(-b+sqrt(max(0.,b*b-a*c)))/a:1e9;
  float ty=rd.y<-1e-6?(-L-p0.y)/rd.y:rd.y>1e-6?-p0.y/rd.y:1e9;t1=max(0.,min(ts,ty));if(uIn>.5)t1=min(t1,length(vL-uCam));}
 const int N=40;float ds=t1/float(N),j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
 float Tr=1.,ls=0.,acc=0.;
 for(int i=0;i<N;i++){vec3 p=p0+rd*(ds*(float(i)+j));float ta=p.y-uM0.y,rr=length(p.xz);
  float fi=clamp((ta+uHl)/(2.*uHl),0.,1.)*31.;int i0=min(int(fi),30);float rh=mix(uPr[i0],uPr[i0+1],fi-float(i0));
  if(abs(ta)<uHl&&rr<rh)break;   // the hull
  float dens=0.;
  for(int k=0;k<3;k++){vec4 S=uSh[k];if(S.z<=0.)continue;float z=(S.x-ta)*uDs,zs=S.y*(1.+6.*clamp(uMa-.86,0.,.35));
   if(z<-.3*S.y||z>zs*1.3)continue;
   float n1=texture(uN,vec3(p.x*1.3,ta*.6-uT*.4,p.z*1.3)/S.y*.25).r,n2=texture(uN,vec3(p.x,ta*3.,p.z)/S.y*.6+.3).r;
   float ro=S.y*(1.15+.95*sqrt(max(z,0.)/zs))*(1.+.3*(n1-.5)+.12*(n2-.5)),front=smoothstep(-.15*S.y,.35*zs,z),rear=1.-smoothstep(zs*(.86+.1*n2),zs*(.97+.1*n2),z);
   dens+=S.z*front*rear*smoothstep(ro,ro*.62,rr)*(.5+n1*n2);}
  if(dens<=0.)continue;
  float sg=dens*uV*3./max(uSh[0].y,.3),a=1.-exp(-sg*ds);
  vec3 nr=vec3(p.x,0.,p.z)/max(rr,1e-3);float l=.5+.5*max(dot(nr,uSunL),0.)+.6*pow(max(dot(rd,uSunL),0.),6.);
  ls+=Tr*a*l;acc+=Tr*a;Tr*=1.-a;if(Tr<.02)break;}
 if(acc<1e-4)discard;
 vec3 c=vec3(.95,.96,.98)*(uLight*(ls/acc)*1.25+uAmb*.6);c=clamp((c*.85*(2.51*c*.85+.03))/(c*.85*(2.43*c*.85+.59)+.14),0.,1.);
 float al=1.-Tr;o=vec4(pow(c,vec3(1./2.2))*al,al);gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
// the plume meeting the ground: a volume in a ground frame (y up; on the pad, the pad's frame, x east, z south down the
// flame channel) inside a box uLo..uHi. Around the impact point uIP a hot splash spreads over the deck; on the pad most of
// the flow (uCh = 1) is driven down the channel between its walls (|x| < 3.4 m, from z ≈ 0), rising and cooling as it
// goes: white-hot near the impact, then the mantle's orange, then soot. uW = how much jet still reaches the ground.
const IMP_VS=`#version 300 es
layout(location=0) in vec3 aP;uniform mat4 uVP,uM;uniform vec3 uLo,uHi;uniform float uFc;out vec3 vL;out float vW;
void main(){vL=mix(uLo,uHi,aP*.5+.5);vec4 w=uM*vec4(vL,1.);gl_Position=uVP*w;vW=gl_Position.w;gl_Position.z=(log2(max(1e-6,1.+gl_Position.w))*uFc-1.)*gl_Position.w;}`;
const IMP_FS=`#version 300 es
precision highp float;precision highp sampler3D;in vec3 vL;in float vW;out vec4 o;
uniform vec3 uLo,uHi,uCam,uCo,uMa,uVa,uSo;uniform vec4 uK,uIg,uIP[4];uniform float uFc,uT,uIn,uI,uOp,uW,uCh,uRe;uniform int uNH;uniform sampler3D uN;
void main(){vec3 rd=normalize(vL-uCam),iv=1./rd,ta=(uLo-uCam)*iv,tb=(uHi-uCam)*iv,tn3=min(ta,tb),tf3=max(ta,tb);
 float tN=max(max(tn3.x,tn3.y),max(tn3.z,0.)),tF=min(min(tf3.x,tf3.y),tf3.z);
 // (VBOX's faces wind outward: outside, its front faces are drawn; inside, its back faces. Either way the march runs
 // over the ray's whole stretch inside the box, from the entry, or the eye)
 vec3 p0=uCam+rd*tN;float t1=max(0.,tF-tN);
 const int N=28;float ds=t1/float(N),j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))),st=ds/max(uRe,.3);
 vec3 C=vec3(0.),Tr=vec3(1.);
 for(int i=0;i<N;i++){vec3 p=p0+rd*(ds*(float(i)+j));float h=p.y;if(h<0.)break;
  // the splash round each impact (uIP[k] = x, z, jet strength); q, rho: the nearest, for the swirl and the cooling
  float a=p.z,re=uRe,sp=0.,rho=1e9;vec2 q=vec2(0.);
  for(int k=0;k<4;k++){if(k>=uNH)break;vec2 qk=p.xz-uIP[k].xy;float rk=length(qk);sp+=uIP[k].z*exp(-rk/(re*3.2))*exp(-h/(re*(.45+.2*rk/re)));if(rk<rho){rho=rk;q=qk;}}
  sp*=1.-.6*uCh;
  float cm=uCh*smoothstep(3.6,2.4,abs(p.x))*smoothstep(-1.,4.,a),thc=1.3+.1*max(a,0.),ch=cm*exp(-max(a,0.)/35.)*exp(-h/thc);
  if(sp+ch<.003)continue;
  vec2 dr=q/max(rho,1e-3);float n1=texture(uN,vec3(p.x,p.y*1.5,p.z-uT*14.*uCh)*.18-vec3(dr*uT*1.2*(1.-uCh),0.).xzy).r,n2=texture(uN,vec3(p.xz*.5,p.y*.8-uT*2.).xzy+.3).r;
  float d=(sp+uW*ch)*(.15+1.5*n1*n2),tau=mix(exp(-rho/(re*3.)),exp(-max(a,0.)/12.),ch/(sp+ch+1e-4));
  vec3 e=uI*(uCo*uK.x*.15*tau*tau*tau+uMa*2.2*tau*(1.+uIg.w)+uVa*.4*tau)*d*(1.-.85*min(1.,uIg.r+uIg.g+uIg.b))+uIg.rgb*1.5*tau*d;   // + the igniter's flash, fuel-rich start
  C+=Tr*e*st;Tr*=exp(-(uSo*uK.w*1.4*(1.-tau)+uOp*.3*tau+.08)*d*st);if(max(Tr.r,max(Tr.g,Tr.b))<.02)break;}
 vec3 c=pow(1.-exp(-C),vec3(1./1.5));float al=1.-dot(Tr,vec3(.333));o=vec4(c,al);gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
// the plume's light on the ground (the ground is the sky shader's): an additive disc just above it, like the floodlight
// pools. Local frame: x/z on the ground, the light uLh above the disc's centre.
const POOL_VS=`#version 300 es
layout(location=0) in vec3 aP;uniform mat4 uVP,uM;uniform float uFc,uR;out vec2 vG;out float vW;
void main(){vG=aP.xz*uR;vec4 w=uM*vec4(vG.x,.06,vG.y,1.);gl_Position=uVP*w;vW=gl_Position.w;gl_Position.z=(log2(max(1e-6,1.+gl_Position.w))*uFc-1.)*gl_Position.w;}`;
const POOL_FS=`#version 300 es
precision highp float;in vec2 vG;in float vW;out vec4 o;uniform vec3 uPlC;uniform float uLh,uR0,uFc,uR,uDk;
void main(){float d2=dot(vG,vG)+uLh*uLh,E=uLh*inversesqrt(d2)/(d2+uR0*uR0);vec3 c=uPlC*E*.3*uDk*smoothstep(uR,uR*.6,length(vG));
 o=vec4(1.-exp(-c*1.6),1.);gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
// the coverage bake for the near cloud volume: cloudCovF over a gnomonic patch round the point under the camera, sliced
// out of SKY_FS so the noise and the coverage are the very same code
const COV_FS=(()=>{const a=SKY_FS.indexOf('float h3('),b=SKY_FS.indexOf('float hp('),c=SKY_FS.indexOf('float fbm('),e=SKY_FS.indexOf('\n',c),
    f=SKY_FS.indexOf('float cloudCovF('),g=SKY_FS.indexOf('float cloudCov(');
  if([a,b,c,e,f,g].some(x=>x<0))throw new Error('COV_FS: SKY_FS markers moved');
  return `#version 300 es
precision highp float;in vec2 vNdc;out vec4 o;uniform float uCT,uPR,uCvX;uniform vec3 uCv0,uCvE,uCvN;
${SKY_FS.slice(a,b)}${SKY_FS.slice(c,e+1)}${SKY_FS.slice(f,g)}
void main(){vec2 xy=vNdc*uCvX;vec3 u=normalize(uCv0+(xy.x*uCvE+xy.y*uCvN)/uPR);o=vec4(cloudCovF(u,0.),0.,0.,1.);}`})();
// landing dust on an airless body: a jet reaching the ground there throws a thin sheet of dust outward in radial streaks
// (no air to slow or loft it), with the ground swept clear right under the nozzle. A volume in the ground frame (the
// impingement's box, IMP_VS), lit by the sun like the surface. uIP: impact x, z, strength, clear radius; uRd: reach.
const DUST_FS=`#version 300 es
precision highp float;precision highp sampler3D;in vec3 vL;in float vW;out vec4 o;
uniform vec3 uLo,uHi,uCam,uSunL,uAlb;uniform vec4 uIP;uniform float uFc,uT,uIn,uRd,uLit;uniform sampler3D uN;
void main(){vec3 rd=normalize(vL-uCam),iv=1./rd,ta=(uLo-uCam)*iv,tb=(uHi-uCam)*iv,tn3=min(ta,tb),tf3=max(ta,tb);
 float tN=max(max(tn3.x,tn3.y),max(tn3.z,0.)),tF=min(min(tf3.x,tf3.y),tf3.z);
 // (VBOX's faces wind outward: outside, its front faces are drawn; inside, its back faces. Either way the march runs
 // over the ray's whole stretch inside the box, from the entry, or the eye)
 vec3 p0=uCam+rd*tN;float t1=max(0.,tF-tN);
 const int N=40;float ds=t1/float(N),j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
 float T=1.,L=0.;
 for(int i=0;i<N;i++){vec3 p=p0+rd*(ds*(float(i)+j));if(p.y<0.)break;
  vec2 q=p.xz-uIP.xy;float rho=length(q);vec2 dr=q/max(rho,1e-3);
  float H=.45+.09*rho,clr=smoothstep(uIP.w*.6,uIP.w*1.4,rho),fall=exp(-2.6*rho/uRd);
  float n1=texture(uN,vec3(dr*2.2,rho*.05-uT*2.2)).r,n2=texture(uN,vec3(dr*5.3+.3,rho*.12-uT*4.)).r,strk=smoothstep(.38,.78,n1*.6+n2*.4);
  float d=uIP.z*clr*fall*exp(-p.y/H)*(.1+2.2*strk);if(d<.002)continue;
  float a=1.-exp(-d*2.4*ds);L+=T*a;T*=1.-a;if(T<.03)break;}
 if(T>.997)discard;
 float ph=.55+.45*smoothstep(-.2,1.,dot(-rd,uSunL));   // dust scatters forward: brighter looking toward the sun
 vec3 c=uAlb*(uLit*ph+.02)*(L/max(1.-T,1e-4));c=clamp((c*.85*(2.51*c*.85+.03))/(c*.85*(2.43*c*.85+.59)+.14),0.,1.);
 float al=1.-T;o=vec4(pow(c,vec3(1./2.2))*al,al);gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
// explosions: a raymarched fireball that turns into a rising, lit smoke cloud (in air) or flashes and thins out (vacuum).
// Local frame: y up (radial), origin at the blast; the box proxy (IMP_VS) follows the cloud. uA: age (s), uR: radius (m),
// uRise: the cloud's centre height (m), uAir: 1 in thick air → 0 in vacuum.
const BOOM_FS=`#version 300 es
precision highp float;precision highp sampler3D;in vec3 vL;in float vW;out vec4 o;
uniform vec3 uLo,uHi,uCam,uSunL,uLight,uAmb;uniform float uFc,uT,uIn,uA,uR,uRise,uAir,uSeed;uniform sampler3D uN;
vec3 heat(float k){return k>.66?mix(vec3(1.,.75,.35),vec3(1.,.95,.8),(k-.66)*3.):k>.33?mix(vec3(1.,.38,.08),vec3(1.,.75,.35),(k-.33)*3.):mix(vec3(.35,.05,.01),vec3(1.,.38,.08),k*3.);}
void main(){vec3 rd=normalize(vL-uCam),iv=1./rd,ta=(uLo-uCam)*iv,tb=(uHi-uCam)*iv,tn3=min(ta,tb),tf3=max(ta,tb);
 float tN=max(max(tn3.x,tn3.y),max(tn3.z,0.)),tF=min(min(tf3.x,tf3.y),tf3.z);
 // (VBOX's faces wind outward: outside, its front faces are drawn; inside, its back faces. Either way the march runs
 // over the ray's whole stretch inside the box, from the entry, or the eye)
 vec3 p0=uCam+rd*tN;float t1=max(0.,tF-tN);
 const int N=40;float ds=t1/float(N),j=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))),st=ds/uR;
 float F=exp(-uA/(.35+.5*uAir)),sm=uAir*(1.-exp(-uA/.6))*(1.-smoothstep(7.,14.,uA))+.35*(1.-uAir)*exp(-uA/.8);
 vec3 C=vec3(0.);float T=1.,L=0.,A=0.;
 for(int i=0;i<N;i++){vec3 p=p0+rd*(ds*(float(i)+j)),q=(p-vec3(0.,uRise,0.))/uR;q.y*=1.+.25*uAir*smoothstep(1.,5.,uA);   // the cloud flattens a little as it rises
  float r=length(q);if(r>1.5)continue;
  vec3 w=q*1.4+uSeed+vec3(0.,-uT*.25,0.);float n=texture(uN,w*.3).r*.55+texture(uN,w*.85+.4).r*.3+texture(uN,w*2.2+.7).r*.15;   // big billows, then detail
  float e=r+.85*(n-.5),dens=smoothstep(1.,.6,e);if(dens<.01)continue;
  float hk=clamp(F*(1.35-1.15*e)*(.6+.8*n),0.,1.);vec3 em=heat(hk)*pow(hk,1.4)*24.*dens;
  float sg=dens*(sm*5.+F*.7),a=1.-exp(-sg*st);
  float lt=.35+.65*smoothstep(-.4,.9,dot(normalize(q+vec3(1e-4)),uSunL)+.35*(n-.5));
  C+=T*em*st;L+=T*a*lt;A+=T*a;T*=1.-a;if(T<.02)break;}
 vec3 sc=mix(vec3(.07,.065,.06),vec3(.3,.29,.28),smoothstep(1.,6.,uA));   // black soot first, greying as it cools and spreads
 vec3 smk=sc*(uLight*(L/max(A,1e-4))+uAmb*.2)*A;   // sunlit side brighter
 vec3 c=smk+C;c=clamp((c*.85*(2.51*c*.85+.03))/(c*.85*(2.43*c*.85+.59)+.14),0.,1.);
 float al=1.-T;if(al<.003&&max(c.r,max(c.g,c.b))<.003)discard;o=vec4(pow(c,vec3(1./2.2)),al);gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
// ---- bloom (aerofx): the frame is drawn into a multisampled offscreen target, resolved, and its near-white parts are
// shrunk through ½, ¼, ⅛ and 1/16 resolution (a box filter each step, so the chain blurs them) and added back as a soft
// glow while the frame is copied to the screen. The scene is already tone-mapped, so the threshold works on display
// values: only near-white pixels feed it (the sun, explosions, plume cores, lamps), and it is added mostly where the
// frame is dark, since a bright daytime sky is as near-white as the sun once tone-mapped.
const BLOOM_FS=`#version 300 es
precision highp float;in vec2 vNdc;out vec4 o;uniform sampler2D uT;uniform vec2 uPx;uniform float uTh;
void main(){vec2 uv=vNdc*.5+.5;vec3 c=vec3(0.);
 for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){float w=(i==0?2.:1.)*(j==0?2.:1.);c+=texture(uT,uv+vec2(i,j)*uPx*2.).rgb*w;}c/=16.;   // a 3×3 tent: no blocks
 if(uTh>0.){float m=max(c.r,max(c.g,c.b));c*=smoothstep(uTh,1.,m)*m;}
 o=vec4(c,1.);}`;
const COMP_FS=`#version 300 es
precision highp float;in vec2 vNdc;out vec4 o;uniform sampler2D uS,uB1,uB2,uB3,uB4;uniform vec2 uP4;uniform float uK;
vec3 tent(sampler2D t,vec2 uv,vec2 px){vec3 c=texture(t,uv).rgb*4.;c+=texture(t,uv+vec2(px.x,0.)).rgb*2.+texture(t,uv-vec2(px.x,0.)).rgb*2.+texture(t,uv+vec2(0.,px.y)).rgb*2.+texture(t,uv-vec2(0.,px.y)).rgb*2.;
 c+=texture(t,uv+px).rgb+texture(t,uv-px).rgb+texture(t,uv+vec2(px.x,-px.y)).rgb+texture(t,uv+vec2(-px.x,px.y)).rgb;return c/16.;}
void main(){vec2 uv=vNdc*.5+.5;vec3 c=texture(uS,uv).rgb;
 vec3 b=texture(uB1,uv).rgb*.35+tent(uB2,uv,uP4*.25).rgb*.35+tent(uB3,uv,uP4*.5).rgb*.4+tent(uB4,uv,uP4).rgb*.45;   // each level tent-filtered at its own texel size (uP4 is the 1/16 level's)   // tight glow; the wide levels faint (sunlit white paint is as bright as the sun here, and the wide levels smeared it)
 float L=dot(c,vec3(.3,.5,.2));o=vec4(c+uK*b*pow(1.-L,1.6),1.);}`;   // glow shows over darker surroundings, not on bright sky
// fin-tip vapor (aerofx): ribbons of condensed vortex core trailing from loaded fin tips. Vertices: camera-relative
// position, the side across the ribbon (−1..1), opacity. Lit like the smoke (sun and sky), white, soft-edged.
const VTR_VS=`#version 300 es
layout(location=0) in vec3 aP;layout(location=1) in vec2 aS;uniform mat4 uVP;uniform float uFc;out vec2 vS;out float vW;
void main(){gl_Position=uVP*vec4(aP,1.);vW=gl_Position.w;gl_Position.z=(log2(max(1e-6,1.+gl_Position.w))*uFc-1.)*gl_Position.w;vS=aS;}`;
const VTR_FS=`#version 300 es
precision highp float;in vec2 vS;in float vW;out vec4 o;uniform vec3 uLight,uAmb;uniform float uFc;
void main(){float e=1.-vS.x*vS.x,a=vS.y*e*e;if(a<.004)discard;vec3 c=vec3(.95,.96,.98)*(uLight*1.1+uAmb*.6);
 c=clamp((c*.85*(2.51*c*.85+.03))/(c*.85*(2.43*c*.85+.59)+.14),0.,1.);o=vec4(pow(c,vec3(1./2.2))*a,a);gl_FragDepth=log2(1.+vW)*uFc*.5;}`;
const PSKY=mkProg(QUAD_VS,SKY_FS),PMESH=mkProg(MESH_VS,MESH_FS),PLINE=mkProg(LINE_VS,LINE_FS),PPLUME=mkProg(PLUME_VS,PLUME_FS),PSMOKE=mkProg(SMOKE_VS,SMOKE_FS);const PPLASMA=mkProg(PLASMA_VS,PLASMA_FS);const PIMP=mkProg(IMP_VS,IMP_FS);const PVTR=mkProg(VTR_VS,VTR_FS);const PBLM=mkProg(QUAD_VS,BLOOM_FS),PCOMP=mkProg(QUAD_VS,COMP_FS);const PBOOM=mkProg(IMP_VS,BOOM_FS);const PDUST=mkProg(IMP_VS,DUST_FS);const PCOV=mkProg(QUAD_VS,COV_FS);const PPOOL=mkProg(POOL_VS,POOL_FS);const PVAPOR=mkProg(PLASMA_VS,VAPOR_FS);
// ---- the small moons (Nyx; Selene stays in SKY_FS): one full-screen ray-cast each, after the sky pass and depth-tested
// against it. The fragment shader is SKY_FS's helpers (sph, scatter, crat, fbm, detail) plus its own main, so the air in
// front of a moon seen from the ground is the same air the sky pass draws. SKY_FS itself is left alone.
const MOON_FS=SKY_FS.slice(0,SKY_FS.lastIndexOf('void main(){'))+`
uniform vec3 uNc,uNdet,uNalb;uniform float uNcc;
float rough(vec3 n){return crat(n*9.)+.6*crat(n*31.)+.35*crat(n*90.);}
void main(){
 vec3 d=normalize(uR*vNdc.x*uTan.x+uU*vNdc.y*uTan.y+uF);
 vec2 hn=sph(uNc,uNcc,d);if(!(uNcc>0.&&hn.x>0.))discard;float tN=hn.x;
 vec3 trans;vec3 ins=scatter(d,tN,trans);
 vec3 p=d*tN-uNc,n=normalize(p);
 // a rubble-pile look: craters at three scales, slope lighting along the sun as on Selene, dark mottled regolith
 float cr=rough(n),fade=smoothstep(3000.,150.,tN),det=fade>0.?detail(d*tN+uNdet):.5;
 vec3 ts=normalize(uSun-n*dot(uSun,n));float slope=clamp((rough(normalize(n+ts*.003))-cr)*1.2,-.9,1.2);
 float base=.75+.5*fbm(n*2.5)-.3*smoothstep(.45,.7,fbm(n*1.2+7.));
 vec3 alb=uNalb*(base+.12*cr+.25*fade*(det-.5));
 float ndl=max(dot(n,uSun),0.);vec3 col=alb*(clamp(ndl+slope*sqrt(max(1.-ndl*ndl,0.))*.8,0.,1.6)*2.2+.004);col=col*trans+ins;
 col=aces(col*.85);o=vec4(pow(col,vec3(1./2.2)),1.);
 o.rgb+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.;   // dither: dark gradients (the galaxy, night skies) band in 8 bits
 gl_FragDepth=min(log2(1.+tN*dot(d,uF))*uFc*.5,.9999999);
}`;
const PMOON=mkProg(QUAD_VS,MOON_FS);
NYX.alb=[.085,.068,.054];   // carbonaceous: darker and browner than Selene
function drawMoons(camW,R,U,Fw,tanX,tanY){const u=PMOON.u;let on=false;
  for(const b of BODIES){if(!b.parent||b===SELENE)continue;const C=sub(bodyPos(b,simT),camW),dc=len(C);if(dc<b.R)continue;
    if(!on){on=true;gl.useProgram(PMOON.p);gl.uniform3fv(u.uR,R);gl.uniform3fv(u.uU,U);gl.uniform3fv(u.uF,Fw);gl.uniform3fv(u.uSun,SUN);gl.uniform2f(u.uTan,tanX,tanY);gl.uniform1f(u.uFc,FC);
      const Cp=mul(camW,-1),d=len(Cp);gl.uniform3fv(u.uPc,Cp);gl.uniform1f(u.uPcc,(d-TELLUS.R)*(d+TELLUS.R));gl.uniform1f(u.uPR,TELLUS.R);gl.uniform1f(u.uAR,TELLUS.R+TELLUS.atm);gl.bindVertexArray(quadVAO)}
    gl.uniform3fv(u.uNc,C);gl.uniform1f(u.uNcc,(dc-b.R)*(dc+b.R));gl.uniform3fv(u.uNalb,b.alb||[.15,.15,.15]);
    gl.uniform3fv(u.uNdet,mul(C,-1).map(x=>x-Math.round(x/1000)*1000));gl.drawArrays(gl.TRIANGLES,0,3)}}
const smokeVAO=gl.createVertexArray(),smokeBuf=gl.createBuffer();gl.bindVertexArray(smokeVAO);gl.bindBuffer(gl.ARRAY_BUFFER,smokeBuf);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,32,28);gl.bindVertexArray(null);
const quadVAO=gl.createVertexArray();gl.bindVertexArray(quadVAO);{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0)}
const lineVAO=gl.createVertexArray(),lineBuf=gl.createBuffer();gl.bindVertexArray(lineVAO);gl.bindBuffer(gl.ARRAY_BUFFER,lineBuf);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,28,12);gl.bindVertexArray(null);
function makeMesh(arr){const data=new Float32Array(arr),vao=gl.createVertexArray(),b=gl.createBuffer(),B=VX*4;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,B,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,B,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,B,24);
  gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,B,36);gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,4,gl.FLOAT,false,B,40);gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,2,gl.FLOAT,false,B,56);gl.bindVertexArray(null);
  return{vao,n:data.length/VX,free(){gl.deleteBuffer(b);gl.deleteVertexArray(vao)}}}
// vertex = position, normal, colour, material (colour arrays may carry the material as a 4th entry), then the part's own
// surface frame for the mesh shader's detail: (turns around the part's axis, height above its bottom, its nominal radius,
// its height) and (detail kind, part index). PK is the part being built; outside partShape it is PK0 (kind 0 = no detail).
const VX=16,PK0={o:[0,0,0],k:0,R:0,h:0,i:-1};let PK=PK0;
const KIND={tank:1,bell:2,pod:3,cone:4,dec:5,fins:6,sci:7,bio:8,ballast:9,chute:10,shield:11,adapt:12,rdec:13,collar:14,mount:15,rfin:6,cam:7,ant:7,rcs:15,gas:15,port:7,claw:15,core:7,bay:15,hab:16,lab:16,arm:15,beacon:15,rover:15};
// one vertex; u = turns around the part axis (lathe passes its own angle; otherwise it comes from the position)
function pv(out,P,N,c,u){if(u==null){u=Math.atan2(P[2]-PK.o[2],P[0]-PK.o[0])/6.2832;if(u<0)u+=1}
  out.push(P[0],P[1],P[2],N[0],N[1],N[2],c[0],c[1],c[2],c[3]||0,u,P[1]-PK.o[1],PK.R,PK.h,PK.k+32*(PK.sch||0)+256*(PK.hq||0)+16384*(PK.up||0),PK.i)}   // the school (×32), the maker's hue (×256, 10° steps) and the upper-stage flag (×16384, Q228) ride in the kind (Q102)
// surface of revolution around +Y; prof = [[r,y,rgb],...] bottom→top; per-vertex colour (duplicate a point for a hard band)
function lathe(out,prof,o=[0,0,0],seg=28,caps=[true,true]){const own=o[0]===PK.o[0]&&o[2]===PK.o[2];
  const V=(r,y,a,nr,ny,c)=>{const ca=Math.cos(a),sa=Math.sin(a);pv(out,[o[0]+r*ca,o[1]+y,o[2]+r*sa],[nr*ca,ny,nr*sa],c,own?a/6.2832:null)};
  for(let i=0;i<prof.length-1;i++){const[r0,y0,c0]=prof[i],[r1,y1,c1]=prof[i+1];let nr=y1-y0,ny=-(r1-r0);const l=Math.hypot(nr,ny);if(l<1e-9)continue;nr/=l;ny/=l;
    for(let j=0;j<seg;j++){const a0=j/seg*6.2832,a1=(j+1)/seg*6.2832;
      V(r0,y0,a0,nr,ny,c0);V(r1,y1,a0,nr,ny,c1);V(r1,y1,a1,nr,ny,c1);V(r0,y0,a0,nr,ny,c0);V(r1,y1,a1,nr,ny,c1);V(r0,y0,a1,nr,ny,c0)}}
  const cap=(r,y,c,ny)=>{if(r<=0)return;for(let j=0;j<seg;j++){const a0=j/seg*6.2832,a1=(j+1)/seg*6.2832;
    V(0,y,(a0+a1)/2,0,ny,c);V(r,y,a0,0,ny,c);V(r,y,a1,0,ny,c)}};
  if(caps[0])cap(prof[0][0],prof[0][1],prof[0][2],-1);const L=prof[prof.length-1];if(caps[1])cap(L[0],L[1],L[2],1)}
const C={W:[.86,.87,.88],D:[.16,.17,.19],G:[.55,.57,.6],O:[.85,.42,.12],K:[.36,.33,.31,1],Y:[.75,.6,.15],R:[.7,.12,.1],GL:[.05,.06,.08,4],CON:[.6,.59,.56,2],SH:[.35,.22,.12,2],
  BK:[.07,.07,.08],ST:[.5,.5,.52,1],AU:[.8,.6,.22,5]};
function box(out,c,hx,hy,hz,col){for(const[ax,s]of[[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]){const n=[0,0,0];n[ax]=s;const h=[hx,hy,hz],u=(ax+1)%3,v=(ax+2)%3,P=(a,b)=>{const p=c.slice();p[ax]+=s*h[ax];p[u]+=a*h[u];p[v]+=b*h[v];return p};
  const q=[P(-1,-1),P(1,-1),P(1,1),P(-1,1)];for(const i of[0,1,2,0,2,3])pv(out,q[i],n,col)}}
function rbox(out,c,hx,hy,hz,col,phi){const a=[];box(a,[0,0,0],hx,hy,hz,col);for(let i=0;i<a.length;i+=VX){const P=rotY([a[i],a[i+1],a[i+2]],-phi),N=rotY([a[i+3],a[i+4],a[i+5]],-phi);
  out.push(P[0]+c[0],P[1]+c[1],P[2]+c[2],...N,...a.slice(i+6,i+VX))}}
// a swept, tapered fin at angle a around the part axis: root chord ch on the hull (radius r0), tip chord ×0.45 flush with
// the trailing edge, thickness 2t; the leading edge is a bare-metal strip, the faces take the paint
function fin(out,o,a,r0,sp,ch,t,col){const ca=Math.cos(a),sa=Math.sin(a),P=(rr,y,s)=>[o[0]+rr*ca-s*sa,o[1]+y,o[2]+rr*sa+s*ca],N=(nr,ny,ns)=>[nr*ca-ns*sa,ny,nr*sa+ns*ca];
  const q=[[r0,0],[r0+sp,0],[r0+sp,ch*.45],[r0,ch]],tri=(A,B,Cc,n,c)=>{pv(out,A,n,c);pv(out,B,n,c);pv(out,Cc,n,c)};
  for(const s of[-1,1]){const n=N(0,0,s),Q=q.map(([r,y])=>P(r,y,s*t));tri(Q[0],Q[1],Q[2],n,col);tri(Q[0],Q[2],Q[3],n,col)}
  for(let e=0;e<4;e++){const[r1,y1]=q[e],[r2,y2]=q[(e+1)%4],l=Math.hypot(r2-r1,y2-y1),n=N((y2-y1)/l,-(r2-r1)/l,0),c=e===2?C.ST:col;
    const A=P(r1,y1,-t),B=P(r2,y2,-t),Cc=P(r2,y2,t),D=P(r1,y1,t);tri(A,B,Cc,n,c);tri(A,Cc,D,n,c)}}
// station trim: yellow handrails along the hull at the given angles, on standoffs (the crew's way along the outside)
function stationTrim(out,x,y,z,h,angs){const HR=[.85,.65,.12];for(const a of angs){const c=Math.cos(a),sn=Math.sin(a),P=(r,yy)=>[x+c*r,y+yy,z+sn*r];
  tube(out,P(.7,.35),P(.7,h-.35),.018,HR,6);for(let yy=.35;yy<=h-.34;yy+=.6)tube(out,P(.625,yy),P(.7,yy),.012,HR,4)}}
// a round window on the hull: a dark frame, glass, eight bolts (the lab's science window)
function labWindow(out,x,y,z,yy,a){const c=Math.cos(a),sn=Math.sin(a);rbox(out,[x+c*.632,y+yy,z+sn*.632],.012,.16,.16,C.D,a);rbox(out,[x+c*.642,y+yy,z+sn*.642],.008,.12,.12,C.GL,a);
  for(let k=0;k<8;k++){const t=k*Math.PI/4,dy=Math.cos(t)*.14,ds=Math.sin(t)*.14;rbox(out,[x+c*.646-sn*ds,y+yy+dy,z+sn*.646+c*ds],.008,.012,.012,[.5,.5,.52,1],a)}}
function partShape(out,p){
  if(p.d.sc){const a=[],k=p.d.sc;partShape(a,{...p,d:PARTS[p.d.base],y0:0,pos:[0,0,0]});
    for(let i=0;i<a.length;i+=VX)out.push(a[i]*k+p.pos[0],a[i+1]*k+p.y0,a[i+2]*k+p.pos[2],a[i+3],a[i+4],a[i+5],a[i+6],a[i+7],a[i+8],a[i+9],a[i+10],a[i+11]*k,a[i+12]*k,a[i+13]*k,a[i+14],a[i+15]);return}
  const d=p.d,sch=partSchool(p);PK={o:[p.pos[0],p.y0,p.pos[2]],k:KIND[d.kind]||KIND[d.key]||0,R:d.r,h:d.h,i:p.i??-1,sch,hq:partHue(p),up:sch>=2&&UPPER&&UPPER.has(p)?1:0};partBody(out,p);PK=PK0}
// ---- hardware schools (QUEUE Q102; NOTES § "Hardware schools in the game: the plan"). A part draws in its maker's school:
// the seller's when it was bought abroad (sourceOf), else the program's. Built: Cape (0, today's look), Steppe (1), and
// Arsenal (2), Coastal (3), Mountain (4), Isle (5) (Q228). Their pads and signature designs are still Cape's (steps 6–7). A power's school is drawn once from POWERS.md's
// affinity weights, seeded by the world and the power, so it never changes. SCHOOL_FORCE (tester, views) overrides.
const SCHOOL_IDS={cape:0,steppe:1,arsenal:2,coastal:3,mountain:4,isle:5},SCHOOL_AFF={openSuper:{cape:.6,coastal:.2,mountain:.2},closedSuper:{steppe:.7,arsenal:.3},
  rising:{arsenal:.4,mountain:.4,steppe:.2},frugal:{coastal:.5,mountain:.3,isle:.2},security:{arsenal:.6,steppe:.3,mountain:.1}};
let SCHOOL_FORCE=null;
function schoolOf(i){if(typeof POWERS==='undefined'||!POWERS[i])return 0;if(POWERS[i].school&&!(i===0&&PROG.homeArch&&PROG.homeArch!==POWERS[0].arch))return SCHOOL_IDS[POWERS[i].school]??0;/* the SIM's school (economy, Q103): one source of truth */const aff=SCHOOL_AFF[typeof archOf==='function'?archOf(i):POWERS[i].arch];if(!aff)return 0;   // a resource state has none: its parts are its sellers'
  const R=rng(WSEED*7907+i*131+17),x=R()*Object.values(aff).reduce((a,b)=>a+b,0);let acc=0;for(const k in aff){acc+=aff[k];if(x<acc)return SCHOOL_IDS[k]??0}return 0}
function partMaker(p){try{const src=typeof sourceOf==='function'&&p.d?sourceOf(p.d.base||p.d.key):null;return src&&src.how==='import'?src.from:HOME}catch(e){return 0}}
function partSchool(p){if(SCHOOL_FORCE!=null)return SCHOOL_FORCE;return schoolOf(partMaker(p))}
// the livery's hue (POWERS.md § Livery): the maker's own colour, in 10° steps, for the school's accent and the roundel
function partHue(p){const i=partMaker(p);return typeof POWERS!=='undefined'&&POWERS[i]?Math.round((POWERS[i].hue||0)/10)%36:2}
// an engine: the bell (exit → throat) gets kind 'bell' with R = its exit radius and h = the throat height; the rest is the
// mount. Big engines carry a turbopump beside the throat, its exhaust duct running down into the bell wall.
function engine(out,p,prof,o){let ti=0;for(let i=1;i<prof.length;i++)if(prof[i][0]<prof[ti][0])ti=i;const K=PK,[rt,yt]=prof[ti];
  PK={...K,k:KIND.bell,R:prof[0][0],h:yt};lathe(out,prof.slice(0,ti+1),o,32,[false,false]);
  PK={...K,k:KIND.mount};lathe(out,prof.slice(ti),o,28,[false,true]);
  if(p.d.thrust>=200){const px=o[0]+rt+.15,pz=o[2],G=C.ST;
    lathe(out,[[0,yt-.08,G],[.07,yt-.06,G],[.09,yt,G],[.09,yt+.22,G],[.06,yt+.26,G],[0,yt+.27,G]],[px,o[1],pz],12,[false,false]);
    lathe(out,[[.035,yt*.55,C.K],[.035,yt-.05,C.K]],[px,o[1],pz],8,[false,false]);
    lathe(out,[[.05,yt+.02,G],[.05,yt+.16,G]],[o[0]-rt-.08,o[1],o[2]],10,[true,true])}
  PK=K}
// one roof half of a cargo bay: a quarter-dome on side sd (±x), swung by th about its hinge on the rim; two-sided
// (Q24) the inside is grey insulation, so a half mid-swing reads as a door, not a white eggshell; hinge brackets on the rim
function bayDoor(out,o,R,top,H,sd,th,col){const c=Math.cos(th),sn=Math.sin(th),nu=6,na=12,cin=[.36,.37,.39,1];
  const P=(u,a)=>{const r=R*Math.cos(u*Math.PI/2),yy=H*Math.sin(u*Math.PI/2),dx=r*Math.cos(a)-R,dy=yy;   // in the half's own frame (x toward its hinge)
    return[o[0]+sd*(R+dx*c+dy*sn),o[1]+top-dx*sn+dy*c,o[2]+r*Math.sin(a)]};
  for(let i=0;i<nu;i++)for(let j=0;j<na;j++){const u0=i/nu,u1=(i+1)/nu,a0=-Math.PI/2+j/na*Math.PI,a1=-Math.PI/2+(j+1)/na*Math.PI,A=P(u0,a0),B=P(u1,a0),Cc=P(u1,a1),D=P(u0,a1);
    let n=norm(cross(sub(B,A),sub(D,A)));if(sd<0)n=mul(n,-1);for(const[x,y,z]of[[A,B,Cc],[A,Cc,D]]){pv(out,x,n,col);pv(out,y,n,col);pv(out,z,n,col);pv(out,z,mul(n,-1),cin);pv(out,y,mul(n,-1),cin);pv(out,x,mul(n,-1),cin)}}
  for(const zz of[-.55,0,.55])rbox(out,[o[0]+sd*(R+.02),o[1]+top+.02,o[2]+zz*R],.04,.05,.07,C.D,0)}
function partBody(out,p){
  const d=p.d,y=p.y0,x=p.pos[0],z=p.pos[2],o=[x,y,z],h=d.h;
  switch(d.key){
    case'cone':lathe(out,[[.625,0,C.W],[.6,.3,C.W],[.5,.75,C.W],[.3,1.25,C.W],[.3,1.25,C.D],[0,1.6,C.D]],o);break;
    case'fins':case'cfins':lathe(out,[[.625,0,C.D],[.625,.9,C.D]],o);{const sp=d.span,ch=d.chord;
      for(let i=0;i<4;i++)fin(out,o,i*Math.PI/2,R0,sp,ch,.035,i%2?C.BK:C.W)}break;
    case'rdec':rbox(out,[x,y+h/2,z],.14,h/2,.22,C.Y,p.phi);break;
    // reaction wheel (Q23): a squat machined housing between bolted flanges, a gold-foil band, four motor pods
    case'rwheel':lathe(out,[[.625,0,C.D],[.625,.035,C.D],[.6,.035,C.ST],[.6,.1,C.ST],[.6,.1,C.AU],[.6,.2,C.AU],[.6,.2,C.ST],[.6,.265,C.ST],[.625,.265,C.D],[.625,.3,C.D]],o);
      for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;rbox(out,[x+Math.cos(a)*.63,y+h/2,z+Math.sin(a)*.63],.035,.07,.06,C.D,a)}break;
    case'rfin':case'cfin':fin(out,o,p.phi,0,d.span,h,.035,(p.i||0)%2?C.BK:C.W);rbox(out,[x+Math.cos(p.phi)*.06,y+h*.35,z+Math.sin(p.phi)*.06],.06,h*.3,.07,C.ST,p.phi);break;
    // docking port: a bolted collar, the capture ring, a probe on the axis, three radial guide vanes and three latches
    case'port':lathe(out,[[.625,0,C.D],[.625,.14,C.D],[.625,.14,C.ST],[.5,.2,C.ST],[.5,.3,C.W],[.46,.3,C.D],[.46,.27,C.D]],o,32,[true,false]);
      tube(out,[x,y+.27,z],[x,y+.44,z],.035,C.ST,10,false);lathe(out,[[.035,0,C.ST],[.05,.03,C.ST],[0,.07,C.ST]],[x,y+.44,z],10,[false,false]);
      for(let k=0;k<3;k++){const a=k*2.0944;fin(out,[x,y+.27,z],a,.3,.16,.16,.012,C.Y);
        const b=a+1.0472;box(out,[x+Math.cos(b)*.48,y+.31,z+Math.sin(b)*.48],.03,.025,.03,C.D)}break;
    // claw: a drive housing with a bolted base flange and a hazard band, a turntable, and three jointed fingers (a
    // hinge knuckle at the base and the elbow, a hydraulic ram along each, rubber-padded tips) around a dark contact plate
    case'rport':{const n=[Math.cos(p.phi),0,Math.sin(p.phi)],qr=qFromTo([0,1,0],n),B=[x,y+h/2,z],a=[];   // built along +Y, then turned to face out
      lathe(a,[[d.r,0,C.D],[d.r,.16,C.G],[.4,.2,C.G],[.4,d.depth,C.W]],[0,0,0],28,[false,true]);
      for(let i=0;i<a.length;i+=VX){const P=add(B,qrot(qr,[a[i],a[i+1],a[i+2]])),N=qrot(qr,[a[i+3],a[i+4],a[i+5]]);a[i]=P[0];a[i+1]=P[1];a[i+2]=P[2];a[i+3]=N[0];a[i+4]=N[1];a[i+5]=N[2]}
      for(const v of a)out.push(v)}break;
    case'beacon':lathe(out,[[.3,0,C.D],[.3,.08,C.D],[.08,.1,C.G],[.05,.5,C.G],[0,.55,C.G]],o);box(out,[x,y+.57,z],.04,.04,.04,[1,.2,.1]);break;
     case'rvfold':{const n=[Math.cos(p.phi),0,Math.sin(p.phi)],tg=[-n[2],0,n[0]];for(const s of[-1,1])rbox(out,[x+n[0]*.03+tg[0]*s*.5,y+h/2,z+n[2]*.03+tg[2]*s*.5],.03,h/2,.04,C.ST,p.phi);
       if(!p.rvOut&&p.dn&&p.dn.rvd){rbox(out,[x+n[0]*.21,y+h/2,z+n[2]*.21],.18,h/2-.05,.52,C.AU,p.phi);
         for(const a of[.27,.73])for(const s of[-1,1])rbox(out,[x+n[0]*.41+tg[0]*s*.27,y+h*a,z+n[2]*.41+tg[2]*s*.27],.025,.2,.2,C.BK,p.phi)}}break;
     case'rvdeck':lathe(out,[[d.r,0,C.D],[d.r,.3,C.ST]],o,32);for(const s of[-1,1])box(out,[x+s*(d.r-.08),y+1,z],.05,.7,.5,C.G);
       if(!p.rvOut&&p.dn&&p.dn.rvd)rvOnDeck(out,p.dn.rvd,[x,y+.3,z]);break;
    case'arm':{const n=[Math.cos(p.phi),0,Math.sin(p.phi)];rbox(out,[x+n[0]*.1,y+h/2,z+n[2]*.1],.1,.32,.3,C.G,p.phi);   // the base plate, a turret, its drive ring
      tube(out,[x+n[0]*.2,y+h/2,z+n[2]*.2],[x+n[0]*.36,y+h/2,z+n[2]*.36],.13,C.W,14,true);tube(out,[x+n[0]*.24,y+h/2,z+n[2]*.24],[x+n[0]*.28,y+h/2,z+n[2]*.28],.145,C.D,14,true)}break;
    case'hab':lathe(out,[[.6,0,C.D],[.625,.03,C.D],[.625,.1,C.D],[.625,.1,C.W],[.625,3.1,C.W],[.625,3.1,C.D],[.625,3.17,C.D],[.6,3.2,C.D]],o);
      for(let k=0;k<6;k++){const a=k*Math.PI/3+.3;rbox(out,[x+Math.cos(a)*.632,y+1.9,z+Math.sin(a)*.632],.012,.13,.1,C.D,a);rbox(out,[x+Math.cos(a)*.64,y+1.9,z+Math.sin(a)*.64],.01,.1,.075,C.GL,a)}   // portholes in dark frames
      stationTrim(out,x,y,z,3.2,[.3+Math.PI/6,.3+Math.PI*7/6]);
      for(const s2 of[1,-1]){const a=.3+Math.PI/2*s2;rbox(out,[x+Math.cos(a)*.72,y+1.1,z+Math.sin(a)*.72],.012,.7,.3,[.9,.9,.92,1],a);   // radiators on standoffs
        tube(out,[x+Math.cos(a)*.62,y+.6,z+Math.sin(a)*.62],[x+Math.cos(a)*.71,y+.6,z+Math.sin(a)*.71],.02,C.ST,4);tube(out,[x+Math.cos(a)*.62,y+1.6,z+Math.sin(a)*.62],[x+Math.cos(a)*.71,y+1.6,z+Math.sin(a)*.71],.02,C.ST,4)}
      break;
    case'lab':lathe(out,[[.6,0,C.D],[.625,.03,C.D],[.625,.1,C.D],[.625,.1,C.W],[.625,1.2,C.W],[.625,1.2,C.AU],[.625,2.0,C.AU],[.625,2.0,C.W],[.625,3.1,C.W],[.625,3.1,C.D],[.625,3.17,C.D],[.6,3.2,C.D]],o);
      labWindow(out,x,y,z,2.6,1.2);stationTrim(out,x,y,z,3.2,[.6,.6+Math.PI]);
      for(let k=0;k<3;k++){const a=2.3+k*.45;rbox(out,[x+Math.cos(a)*.7,y+1.6,z+Math.sin(a)*.7],.07,.12+.05*k,.09,k%2?C.ST:[.62,.63,.6],a)}   // external experiment boxes on the gold band
      break;
    case'bay':{const top=h+d.bayL,th=doorF(p)*1.75;
      lathe(out,[[d.r,0,C.W],[d.r,top,C.W],[d.r,top,C.G],[d.bayIn,top,C.G],[d.bayIn,h,C.D],[0,h,C.D]],o,32,[true,false]);
      for(const sd of[1,-1])bayDoor(out,o,d.r,top,d.roofH,sd,th,C.W)}break;
    // probe core: a guidance and avionics ring, foil between bolted rings; four equipment boxes on the band (two with
    // thermal louvers), a sun sensor, a status lamp, and two whip antennas on the top ring
    case'core':lathe(out,[[.625,0,C.D],[.625,.04,C.D],[.6,.04,C.AU],[.6,.21,C.AU],[.625,.21,C.D],[.625,.25,C.D]],o);
      for(let k=0;k<4;k++){const a=.4+k*Math.PI/2,c=Math.cos(a),sn=Math.sin(a),P=r=>[x+c*r,y+.125,z+sn*r];
        rbox(out,P(.63),.035,.06,.09,k%2?[.62,.63,.6]:C.ST,a);
        if(k%2)for(let j=-2;j<=2;j++)rbox(out,[x+c*.668,y+.125+j*.022,z+sn*.668],.004,.006,.08,C.D,a)}
      rbox(out,[x+Math.cos(1.17)*.635,y+.2,z+Math.sin(1.17)*.635],.02,.02,.02,C.BK,1.17);
      box(out,[x+Math.cos(2.7)*.63,y+.06,z+Math.sin(2.7)*.63],.012,.012,.012,[.9,.25,.15]);
      for(const a of[.9,4.04]){const c=Math.cos(a),sn=Math.sin(a);tube(out,[x+c*.6,y+.24,z+sn*.6],[x+c*.82,y+.6,z+sn*.82],.006,C.D,4)}break;
    case'claw':lathe(out,[[.35,0,C.D],[.35,.04,C.D],[.35,.04,C.ST],[.35,.15,C.ST],[.35,.15,C.Y],[.35,.22,C.Y],[.3,.25,C.ST],[.24,.27,C.ST],[.24,.3,C.D]],o);
      lathe(out,[[.17,.3,C.BK],[.17,.31,C.BK]],o,24,[false,true]);
      for(let k=0;k<3;k++){const a=k*2.0944,c=Math.cos(a),sn=Math.sin(a),P=(r,yy)=>[x+c*r,y+yy,z+sn*r],t=[-sn,0,c],J=(r,yy)=>tube(out,madd(P(r,yy),t,-.045),madd(P(r,yy),t,.045),.035,C.ST,8,true);
        J(.22,.28);J(.3,.45);tube(out,P(.22,.28),P(.3,.45),.032,C.D,6,false);tube(out,P(.3,.45),P(.15,.545),.027,C.D,6,false);
        tube(out,P(.16,.29),P(.27,.41),.012,[.75,.76,.78,1],6,false);box(out,P(.14,.55),.025,.012,.025,C.BK)}break;
    case'rcs':{const n=[Math.cos(p.phi),0,Math.sin(p.phi)],t=[-n[2],0,n[0]],e=[x+n[0]*RCS_OFF,y+h/2,z+n[2]*RCS_OFF];
      // an outrigger and a housing at the nozzle cluster; four little bells (throat, flared exit, heat-tinted lip) on the thrust axes
      rbox(out,[x+n[0]*d.off,y+h/2,z+n[2]*d.off],d.off,.05,.045,C.ST,p.phi);rbox(out,e,.035,.035,.035,C.G,p.phi);
      for(const dd of[[0,1,0],[0,-1,0],t,mul(t,-1)]){tube(out,madd(e,dd,-.03),madd(e,dd,-.05),.011,C.K,6,false);tube(out,madd(e,dd,-.05),madd(e,dd,-.075),.02,C.K,8,false);
        tube(out,madd(e,dd,-.072),madd(e,dd,-.077),.022,[.55,.36,.24,1],8,false)}}break;
    // gas bottle: painted, a green service band, two straps, a valve and regulator on top, a feed line to the hull
    case'gas':{const B=[.78,.79,.8],GN=[.16,.42,.22],c=[x+Math.cos(p.phi)*d.off,y,z+Math.sin(p.phi)*d.off];
      lathe(out,[[0,0,B],[.11,.03,B],[.17,.12,B],[.17,.33,B],[.17,.33,GN],[.17,.39,GN],[.17,.39,B],[.17,.48,B],[.11,.57,B],[0,.6,B]],c,16,[false,false]);
      for(const yy of[.17,.44])lathe(out,[[.177,yy,C.D],[.177,yy+.03,C.D]],c,16,[false,false]);
      tube(out,add(c,[0,.59,0]),add(c,[0,.66,0]),.02,C.ST,8,true);box(out,add(c,[0,.68,0]),.03,.02,.03,C.G);
      tube(out,add(c,[0,.68,0]),[x,y+.68,z],.008,C.ST,5,false)}break;
    case'les':lathe(out,[[.18,0,C.D],[.18,1.3,C.R],[.26,1.42,C.D],[.26,1.6,C.R],[.1,1.9,C.R],[0,2.1,C.D]],o);break;
    case'crew':case'pod':lathe(out,[[.625,0,C.D],[.625,.06,C.D],[.62,.06,C.G],[.34,1.0,C.G],[.34,1.0,C.D],[.3,1.06,C.D],[.3,1.06,C.G],[.3,1.2,C.G]],o);break;
    case'cam':lathe(out,[[.625,0,C.D],[.625,.06,C.D],[.625,.06,C.ST],[.625,.44,C.ST],[.625,.44,C.D],[.625,.5,C.D]],o);
      box(out,[x,y+.25,z+.6],.24,.17,.05,C.BK);tube(out,[x,y+.25,z+.56],[x,y+.25,z+.78],.15,C.D,14,false);tube(out,[x,y+.25,z+.56],[x,y+.25,z+.7],.11,C.GL,14,true);
      box(out,[x,y+.25,z-.61],.17,.12,.03,C.G);break;
    case'ant':lathe(out,[[.625,0,C.D],[.625,.12,C.D],[.3,.3,C.W]],o);tube(out,[x,y+.3,z],[x,y+.62,z],.03,C.ST,8);
      {const pr=[];for(let i=0;i<=8;i++){const r=.3*i/8;pr.push([r,.62+r*r/.6,[.84,.85,.86]])}lathe(out,pr,[x,y,z],24,[false,false]);
       for(let k=0;k<3;k++){const t=k*2.094;tube(out,[x+.29*Math.cos(t),y+.76,z+.29*Math.sin(t)],[x,y+.79,z],.008,C.D,4)}tube(out,[x,y+.74,z],[x,y+.81,z],.03,C.D,8,true);
       for(const t of[.8,3.9])tube(out,[x+.55*Math.cos(t),y+.1,z+.55*Math.sin(t)],[x+.8*Math.cos(t),y+.95,z+.8*Math.sin(t)],.008,C.D,4)}break;
    case'sci':lathe(out,[[.625,0,C.D],[.625,.07,C.D],[.625,.07,C.AU],[.625,.38,C.AU],[.625,.38,C.D],[.625,.45,C.D]],o);
      box(out,[x+.45,y+.6,z],.015,.25,.015,C.G);box(out,[x-.45,y+.55,z],.015,.2,.015,C.G);break;
    case'bio':lathe(out,[[.625,0,C.D],[.625,.08,C.D],[.6,.08,C.W],[.42,.85,C.W],[.42,.85,C.D],[.3,.88,C.D],[.3,1.0,C.D]],o);break;
    case'ballast':lathe(out,[[.625,0,C.D],[.625,.05,C.D],[.625,.05,C.ST],[.625,.45,C.ST],[.625,.45,C.D],[.625,.5,C.D]],o);break;
    case'chute':lathe(out,[[.3,0,C.G],[.3,.22,C.G],[.3,.22,C.O],[.16,.38,C.O],[0,.42,C.O]],o);break;
    case'shield':lathe(out,[[.66,0,C.SH],[.66,.1,C.SH],[.625,.2,C.D]],o);break;
    case'dec':lathe(out,[[.625,0,C.Y],[.625,.12,C.Y],[.625,.12,C.D],[.625,.25,C.D]],o);break;
    case'istage':lathe(out,[[.625,0,C.Y],[.625,.12,C.Y],[.625,.12,C.D],[.625,.25,C.D]],o);if(p.shell)lathe(out,[[.627,.25,C.G],[.627,.25+p.shell,C.G]],o,28,[false,false]);break;
    case'adapt':lathe(out,[[1.25,0,C.D],[1.25,.15,C.D],[1.25,.15,C.W],[.625,1.35,C.W],[.625,1.35,C.D],[.625,1.5,C.D]],o);break;
    case'wren':engine(out,p,[[.25,0,C.K],[.1,.25,C.D],[.35,.35,C.G],[.625,.5,C.G],[.625,.55,C.G]],o);break;
    case'sparrow':engine(out,p,[[.3,0,C.K],[.12,.45,C.D],[.3,.55,C.G],[.625,.72,C.G],[.625,.8,C.G]],o);break;
    case'petrel':engine(out,p,[[.6,0,C.K],[.15,.7,C.D],[.3,.8,C.G],[.625,.9,C.G],[.625,1,C.G]],o);break;
    case'kestrel':engine(out,p,[[.55,0,C.K],[.22,.75,C.D],[.4,.9,C.G],[.625,1.15,C.G],[.625,1.3,C.G]],o);break;
    case'condor':engine(out,p,[[.62,0,C.K],[.28,1.1,C.D],[.45,1.3,C.G],[.625,1.65,C.G],[.625,1.9,C.G]],o);break;
    // power parts and the landing leg (QUEUE Q97, effects beat on the parts & pad's behalf). n is the part's outward
    // direction on its host's skin, t across it.
    // solar wing: stowed, a folded pack of four panels against the skin; deployed, a boom and yoke out to a wing of four
    // framed panels (its plane holds n and y, as power.js assumes)
    case'wpanel':{const a=p.phi||0,n=[Math.cos(a),0,Math.sin(a)],P=(r,yy)=>[x+n[0]*r,y+yy,z+n[2]*r],CELL=[.08,.11,.28,4];
      if(p.dep){const L=d.span,b0=.6,w=L/4;tube(out,P(.02,h/2),P(b0-.05,h/2),.03,C.ST,6);rbox(out,P(b0-.03,h/2),.03,h*.5,.025,C.D,a);   // boom, yoke
        for(let k=0;k<4;k++){const c=b0+(k+.5)*w;rbox(out,P(c,h/2),w/2-.015,h/2-.02,.008,CELL,a);rbox(out,P(c,h/2),w/2,h/2,.004,C.ST,a)}   // cells on a frame
        rbox(out,P(b0+L/2,h-.01),L/2,.012,.012,C.ST,a);rbox(out,P(b0+L/2,.01),L/2,.012,.012,C.ST,a)}   // the wing's edge spars
      else{for(let k=0;k<4;k++)rbox(out,P(.03+k*.025,h/2),.011,h/2-.01,.2,k%2?CELL:C.ST,a);rbox(out,P(.13,h/2),.012,h/2,.21,C.D,a)}}break;   // folded pack, cover
    // solar cells on the body: tiles that follow a 0.625 m hull's curve (4 columns × 4 rows), on a thin steel backing
    // RTG (vehicle session, Q131; placeholder): a dark finned drum standing off the skin on a short strut
    case'rtg':{const a=p.phi||0,n=[Math.cos(a),0,Math.sin(a)],c=[x+n[0]*.3,y,z+n[2]*.3];tube(out,[x,y+h/2,z],[c[0],y+h/2,c[2]],.03,C.ST,6);
      lathe(out,[[0,.05,C.D],[.12,.05,C.D],[.12,h-.05,C.D],[0,h-.05,C.D]],c,12,[false,false]);for(let k=0;k<4;k++)fin(out,c,k*Math.PI/2,.12,.08,h-.1,.01,C.D)}break;
    case'bpanel':{const a=p.phi||0,R=.625,cx=x-Math.cos(a)*R,cz=z-Math.sin(a)*R,CELL=[.08,.11,.28,4];
      for(let k=0;k<4;k++){const ak=a+(k-1.5)*.17,c=Math.cos(ak),s=Math.sin(ak);rbox(out,[cx+c*(R+.008),y+h/2,cz+s*(R+.008)],.004,h/2,.054,C.ST,ak);
        for(let j=0;j<4;j++)rbox(out,[cx+c*(R+.014),y+(j+.5)*h/4,cz+s*(R+.014)],.004,h/8-.012,.046,CELL,ak)}}break;
    // battery: a ribbed ring of cells, an orange stripe, two terminal boxes
    case'batt':{const pr=[[.625,0,C.D],[.625,.02,C.D]];for(let k=0;k<5;k++){const y0=.02+k*.022;pr.push([.61,y0,C.K],[.61,y0+.011,C.K],[.625,y0+.011,C.D],[.625,y0+.022,C.D])}
      pr.push([.625,.13,C.O],[.625,h,C.O]);lathe(out,pr,o);for(const a of[.6,3.7])rbox(out,[x+Math.cos(a)*.64,y+h*.55,z+Math.sin(a)*.64],.025,.04,.06,C.D,a)}break;
    // onboard computer: a dark equipment ring with six gold-foil avionics boxes and a cable run between them
    case'ocomp':{lathe(out,[[.625,0,C.D],[.625,h,C.D]],o);for(let k=0;k<6;k++){const a=k*Math.PI/3+.3;
        rbox(out,[x+Math.cos(a)*.66,y+h/2,z+Math.sin(a)*.66],.035,h*.36,.11,k%3?C.AU:C.BK,a)}
      lathe(out,[[.645,h*.12,C.K],[.645,h*.2,C.K]],o,28,[false,false])}break;
    // landing leg. The foot is where the sim puts it (legFoot: reach out, drop below the leg's bottom). Stowed: the shock
    // strut lies along the skin, its footpad folded flat at the bottom, the brace beside it. Deployed: hinge → outer cylinder
    // → chrome piston → footpad on a ball joint, and a brace from the lower mount to the strut's middle.
    case'leg':{const a=p.phi||0,n=[Math.cos(a),0,Math.sin(a)],P=(r,yy)=>[x+n[0]*r,y+yy,z+n[2]*r],PIS=[.74,.75,.77,1],H=P(.08,h*.9);
      rbox(out,P(.05,h*.9),.05,.07,.1,C.D,a);rbox(out,P(.04,h*.12),.04,.05,.08,C.D,a);   // hinge and lower mount fittings
      if(p.dep){const F=[x+n[0]*d.reach,y-d.drop,z+n[2]*d.reach],K=add(H,mul(sub(F,H),.55)),Fp=add(F,[0,.09,0]);
        tube(out,H,K,.05,C.ST,10);tube(out,K,Fp,.032,PIS,10);tube(out,P(.06,h*.12),add(H,mul(sub(F,H),.6)),.022,C.D,6);
        lathe(out,[[.02,.06,C.D],[.05,.09,C.D],[.02,.12,C.D]],F,8,[false,false]);   // ball joint
        lathe(out,[[0,0,C.D],[.2,0,C.D],[.22,.04,C.D],[.12,.07,C.D],[0,.07,C.D]],F,16,[false,false])}   // footpad
      else{tube(out,H,P(.08,h*.4),.05,C.ST,10);tube(out,P(.08,h*.4),P(.08,.1),.032,PIS,10);tube(out,P(.05,h*.12),P(.07,h*.55),.02,C.D,6);
        rbox(out,P(.1,.05),.03,.05,.16,C.D,a)}}break;   // folded footpad
    default:{const b=.07;lathe(out,[[.625,0,C.D],[.625,b,C.D],[.625,b,C.W],[.625,h-b,C.W],[.625,h-b,C.D],[.625,h,C.D]],o)}}}
// the rotation taking +y to t (t a unit vector near +y): a canted nozzle's frame
function tiltQ(t){const Z=norm(cross([1,0,0],t)),X=cross(t,Z);return qFromBasis(X,t,Z)}
// the parts on an upper stage: above a decoupler on their own stack line (Q228: Arsenal and Mountain paint stages apart)
let UPPER=null;
function upperOf(parts){const decs=parts.filter(q=>q.d.kind==='dec');return new Set(parts.filter(p=>decs.some(q=>q!==p&&Math.abs(q.pos[0]-p.pos[0])<1e-3&&Math.abs(q.pos[2]-p.pos[2])<1e-3&&p.y0>=q.y0+q.h-1e-3)))}
function partsMesh(parts){const a=[];UPPER=upperOf(parts);for(const p of parts){const n0=a.length;partShape(a,p);
    if(p.tdir){const q=tiltQ(p.tdir),m=[p.pos[0],p.y0+p.h,p.pos[2]];for(let i=n0;i<a.length;i+=VX){
      const v=qrot(q,[a[i]-m[0],a[i+1]-m[1],a[i+2]-m[2]]),nn=qrot(q,[a[i+3],a[i+4],a[i+5]]);a[i]=v[0]+m[0];a[i+1]=v[1]+m[1];a[i+2]=v[2]+m[2];a[i+3]=nn[0];a[i+4]=nn[1];a[i+5]=nn[2]}}
    // the interstage cover (Q102 step 4): a decoupler with an engine sitting right on top of it gets a cover around that
    // engine at the stack's radius: Cape a closed ribbed skirt, Steppe an open lattice (the engine shows through); Arsenal vent windows, Coastal smooth with a pastel stripe, Mountain bolts and spin rockets, Isle flush carbon (Q228, the paint in MESH_FS). It is
    // the decoupler's (its part index and school), so it falls away with the lower stage. Drawing only: outline, aero and
    // PARTS untouched. INTERSTAGE_FX = false leaves the engine bare, as before.
    if(INTERSTAGE_FX&&p.d.kind==='dec'){const up=parts.find(q=>q!==p&&q.d.kind==='engine'&&!q.tdir&&Math.abs(q.y0-(p.y0+p.h))<1e-3&&Math.abs(q.pos[0]-p.pos[0])<1e-3&&Math.abs(q.pos[2]-p.pos[2])<1e-3);
      if(up){const R=p.d.r+.004,H=up.h,y0=up.y0,x=p.pos[0],z=p.pos[2],sch=partSchool(p);PK={o:[x,y0,z],k:KIND.collar,R,h:H,i:p.i??-1,sch};
        if(sch!==1){const c=[.08,.08,.09,1];lathe(a,[[R,0,c],[R,H,c]],[x,y0,z],32,[false,false]);
          if(sch===0)for(let k=0;k<24;k++){const g=k/24*6.2832;rbox(a,[x+Math.cos(g)*(R+.008),y0+H/2,z+Math.sin(g)*(R+.008)],.008,H/2-.02,.018,c,g)}   // Cape's ribs
          if(sch===4)for(let k=0;k<4;k++){const g=(k+.5)/4*6.2832,P=yy=>[x+Math.cos(g)*(R+.05),y0+yy,z+Math.sin(g)*(R+.05)];tube(a,P(H-.36),P(H-.08),.045,[.3,.31,.32,1],8)}}   // Mountain's spin rockets
        else{const c=[.17,.2,.17,1],P=(g,yy)=>[x+Math.cos(g)*R,y0+yy,z+Math.sin(g)*R];lathe(a,[[R,0,c],[R,.07,c]],[x,y0,z],32,[false,false]);lathe(a,[[R,H-.07,c],[R,H,c]],[x,y0,z],32,[false,false]);
          for(let k=0;k<12;k++){const g=k/12*6.2832,dg=6.2832/12;tube(a,P(g,.07),P(g+dg,H-.07),.022,c,6);tube(a,P(g+dg,.07),P(g,H-.07),.022,c,6)}}   // lattice
        PK=PK0}}
    // reinforced joints show as a dark collar (two for heavy) around a stack joint, a darker box at a side joint
    if(p.jr&&p.parent&&parts.includes(p.parent)){const J=p.jP,rj=Math.min(p.d.r,p.parent.d.r)+.025,c=[.3,.32,.36,1];
      if(Math.abs(p.jA[1])>0.5)for(let k=0;k<p.jr;k++){const yy=J[1]+(k-(p.jr-1)/2)*.2;PK={o:[J[0],yy-.06,J[2]],k:KIND.collar,R:rj,h:.12,i:p.i??-1};lathe(a,[[rj,yy-.06,c],[rj,yy+.06,c]],[J[0],0,J[2]],28,[true,true])}
      else{PK={o:J,k:KIND.collar,R:.25,h:.5,i:p.i??-1};rbox(a,J,.1,.25+.1*p.jr,.25,c,p.phi||0)}PK=PK0}}
  UPPER=null;return makeMesh(a)}
// ---- flight marks: what a flight leaves on the hardware. Render-side only, never read by the sim; kept per part object,
// so they ride along onto debris and landed stages, and a new flight (new parts) starts clean.
//   soot  — a burning engine, and the base of the parts within 3 m above it on its stack line; worse at altitude, where
//           the plume balloons and washes back over the base
//   char  — the peak skin temperature between 480 K and the part's limit (1 = about to burn up); its direction is the
//           heat-weighted airflow in the ship frame, so the windward side takes it. A heat shield blackens from ~420 K (and with
//           the ablator it has used).
//   frost — fuelled tanks waiting on the pad are LOX-cold; frost sheds over the first minute of flight, faster with speed
//   glow  — a vacuum engine's radiatively cooled nozzle extension: heats over ~6 s of burn, cools over ~12 s after cutoff
const MARKS=new WeakMap(),MKA=new Float32Array(96*4),CHA=new Float32Array(96*4);
const markOf=p=>{let m=MARKS.get(p);if(!m)MARKS.set(p,m={soot:0,frost:0,glow:0,char:0,cd:[0,0,0]});return m};
// a registered satellite keeps the marks it flew with: soot, and char with its windward direction. Frost and nozzle
// glow are gone within a minute, long before anyone flies past. Rounded: they go into the save.
HOOK.unshape=(parts,by)=>{for(const p of parts){const o=by.get(p.i);if(o&&o.mk)MARKS.set(p,{soot:o.mk[0],char:o.mk[1],cd:o.mk.slice(2),frost:0,glow:0})}};   // a rebuilt vessel's marks
HOOK.cloned=(a,b)=>a.forEach((p,i)=>{const m=MARKS.get(p);if(m)MARKS.set(b[i],{...m,cd:m.cd.slice()})});   // a separated vessel keeps its marks
HOOK.satLook=(shape,parts)=>parts.forEach((p,k)=>{const m=MARKS.get(p);if(!m||m.soot<.01&&m.char<.01)return;const l=len(m.cd)||1;
  shape[k].mk=[m.soot,m.char,m.cd[0]/l,m.cd[1]/l,m.cd[2]/l].map(x=>+x.toFixed(3))});
const vacNozzle=d=>d.kind==='engine'&&d.ispA<0.5*d.ispV;
let markT=null;
function marksTick(){const dt=markT==null||simT<markT?0:Math.min(simT-markT,5);markT=simT;if(mode!=='flight'||!S||!dt)return;
  const b=S.body,pr=pressure(b,len(S.r)-b.R),eng=S.alive&&S.throttle>0?activeEngines(S):[];if(!S.landed&&!S.mkLift){S.mkLift=true;S.mkLiftT=simT}
  const pad=S.landed&&!S.mkLift,fb=qrot(qconj(S.q),sub(S.v,surfVel(b,S.r))),sp=len(fb),base=(1+2*(1-pr))*S.throttle;
  for(const p of S.parts){if(!p.on)continue;const m=markOf(p);
    if(p.cap.fuel)m.frost=pad?1:Math.max(0,m.frost-dt*(1/45+sp/6000));
    if(p.T>480){m.char=Math.max(m.char,clamp((p.T-480)/(p.d.Tmax-480),0,1));if(sp>1)m.cd=madd(m.cd,fb,(p.T-480)*dt/sp)}
    if(p.cap.ablator)m.char=Math.max(m.char,clamp((p.T-420)/300,0,1),Math.min(1,3*(1-p.res.ablator/p.cap.ablator)));   // an ablator blackens far below its rating
    if(vacNozzle(p.d)){const tg=eng.includes(p)?S.throttle:0;m.glow+=(tg-m.glow)*(1-Math.exp(-dt/(tg>m.glow?6:12)))}}
  for(const e of eng){const top=e.y0+e.h;markOf(e).soot=Math.min(1,markOf(e).soot+dt*base/60);
    for(const p of S.parts){const dy=p.y0-top;if(!p.on||p===e||dy<-.01||dy>3||Math.abs(p.pos[0]-e.pos[0])>.05||Math.abs(p.pos[2]-e.pos[2])>.05)continue;
      const m=markOf(p);m.soot=Math.min(1,m.soot+dt*base/80*(1-dy/3))}}
  for(const d of debris)for(const p of d.parts){const m=MARKS.get(p);if(!m)continue;m.frost=Math.max(0,m.frost-dt/45);m.glow*=Math.exp(-dt/12)}}
// the marks of these parts into the mesh shader's per-part-index uniforms (zeros for parts without marks, and for [])
function setMarks(u,parts){MKA.fill(0);CHA.fill(0);for(const p of parts){const i=p.i,m=MARKS.get(p);if(!m||i==null||i<0||i>=96)continue;
    MKA.set([m.soot,m.frost,p.cap&&p.cap.fuel?clamp(p.res.fuel/p.cap.fuel,0,1):0,m.glow],i*4);const l=len(m.cd);
    CHA.set(l>1e-9?[m.cd[0]/l,m.cd[1]/l,m.cd[2]/l,m.char]:[0,0,0,m.char],i*4)}
  gl.uniform4fv(u['uMk[0]'],MKA);gl.uniform4fv(u['uCh[0]'],CHA);setMoves(u,parts)}
// the moving parts of these parts into the mesh shader's uMv table (QUEUE Q23): engine bells turned by their gimbal
// (p.gv: the thrust along tdir + gv, the bell turning about its throat) and steerable fin plates by their deflection
// (p.fd, rad, about each plate's radial axis through mid-chord, the sim's sign). Up to 16; parts at rest are left out.
const MVA=new Float32Array(48*4),BELL_YT=new Map();
function bellThroat(d){let y=BELL_YT.get(d.key);if(y!=null)return y;const a=[],b=d.sc?PARTS[d.base]:d;partShape(a,{d:b,pos:[0,0,0],y0:0,h:b.h,i:0});y=0;
  for(let i=0;i<a.length;i+=VX)if(a[i+14]%32===KIND.bell){y=a[i+13];break}y*=d.sc||1;BELL_YT.set(d.key,y);return y}
function engMove(p){const g=p.gv;if(!g||Math.abs(g[0])+Math.abs(g[1])+Math.abs(g[2])<1e-5)return null;const t=p.tdir||[0,1,0],q=qFromTo(t,norm(add(t,g)));
  let pv=[p.pos[0],p.y0+bellThroat(p.d),p.pos[2]];if(p.tdir){const m=[p.pos[0],p.y0+p.h,p.pos[2]];pv=add(m,qrot(tiltQ(p.tdir),sub(pv,m)))}return{pv,q}}
// an engine's exhaust frame (vessel coordinates): qt its tilt (null: straight down the axis), ex the nozzle exit. Follows
// the cant (tdir, about the mount) and the gimbal (about the throat), so the plume leaves the bell where it is drawn.
function plumeFrame(e){const t=e.tdir||null;let ex=[e.pos[0],e.y0,e.pos[2]],qt=t?tiltQ(t):null;
  if(t&&e.h){const m=[e.pos[0],e.y0+e.h,e.pos[2]];ex=add(m,qrot(qt,sub(ex,m)))}   // (escape-tower nozzles carry no h: their exit is their mount)
  const mv=MOVES_FX?engMove(e):null;if(mv){qt=tiltQ(norm(add(t||[0,1,0],e.gv)));ex=add(mv.pv,qrot(mv.q,sub(ex,mv.pv)))}return{qt,ex}}
let INTERSTAGE_FX=true;   // false: no interstage covers (A/B, Q102 step 4)
let MOVES_FX=true;   // false: bells and fin plates stay put (A/B)
function setMoves(u,parts){MVA.fill(0);let n=0;if(MOVES_FX)for(const p of parts){if(n>=16)break;const i=p.i;if(i==null||i<0||i>=96||!p.on)continue;const d=p.d;
    if(d.kind==='engine'){const e=engMove(p);if(!e)continue;MVA.set([...e.pv,i,1,0,0,0,...e.q],n*12);n++}
    else if(d.ctl&&p.fd&&p.fd.some(x=>Math.abs(x)>1e-4)){const k=d.sc||1;
      if(d.kind==='fins')MVA.set([p.pos[0],p.y0+d.chord*k/2,p.pos[2],i,2,0,0,.625*k*1.02,p.fd[0]||0,p.fd[1]||0,p.fd[2]||0,p.fd[3]||0],n*12);
      else MVA.set([p.pos[0],p.y0+d.h/2,p.pos[2],i,3,Math.cos(p.phi),Math.sin(p.phi),0,p.fd[0]||0,0,0,0],n*12);n++}}
  gl.uniform4fv(u['uMv[0]'],MVA)}
const PLUME=(()=>{const a=[],w=[1,1,1],pr=[];for(let i=0;i<=16;i++)pr.push([1,-i/16,w]);lathe(a,pr,[0,0,0],24,[true,true]);return makeMesh(a)})();
// propellant profiles (Waterfall's "templates"): colours of core, diamonds, afterburning mantle, gas glow, soot absorption
// per channel; K = gains [core, diamonds, mantle, soot]. Engines pick one plus their exit pressure pe (atm) in PFX.
const PROPS={
  // ig: the igniter's flash colour and length (s), rich: how long the fuel-rich start lasts (s)
  kerolox:{ig:[.25,1,.35],igT:.3,rich:.7,tail:.8,co:[1,.72,.4],di:[1,.88,.65],ma:[1,.42,.1],va:[1,.42,.12],so:[.75,.9,1.05],K:[5,2.5,1.3,.5],op:1.2},
  alcohol:{ig:[1,.75,.35],igT:.15,rich:.4,tail:.4,co:[1,.86,.72],di:[1,.85,.6],ma:[1,.6,.3],va:[.9,.65,.55],so:[.8,.9,1],K:[2.6,2.6,1.6,.04],op:.8},
  hypergolic:{ig:[1,.55,.5],igT:.05,rich:.15,tail:.15,co:[1,.62,.45],di:[1,.72,.52],ma:[1,.48,.36],va:[1,.5,.4],so:[1,1,1],K:[2.4,1.8,.5,0],op:.25},
  // solid: aluminised composite, blinding white-yellow, nearly opaque, few diamonds; its smoke is white (alumina)
  solid:{ig:[1,.95,.8],igT:.06,rich:.12,tail:.35,co:[1,.92,.78],di:[1,.9,.75],ma:[1,.62,.3],va:[1,.82,.6],so:[1,1,1],K:[7,.4,1.6,0],op:1.6},
  hydrolox:{ig:[.6,.6,1],igT:.05,rich:.1,tail:.1,co:[.55,.65,1],di:[1,.62,.75],ma:[.6,.5,.95],va:[.45,.55,1],so:[1,1,1],K:[1.2,2.6,.15,0],op:.03}};
const PFX={les:{prop:'solid',pe:.9},sparrow:{prop:'alcohol',pe:.9},wren:{prop:'hypergolic',pe:.12},petrel:{prop:'kerolox',pe:.025},
  kestrel:{prop:'kerolox',pe:.75},condor:{prop:'kerolox',pe:.8},albatross:{prop:'kerolox',pe:.7}};
// an engine without an entry: kerolox, with a vacuum nozzle if its sea-level Isp is under half its vacuum one
const pfxOf=d=>PFX[d.key]||PFX[d.base]||{prop:'kerolox',pe:d.ispA<0.5*d.ispV?.025:.75};
// render-side spool: plumes grow over ~0.3 s after ignition (and follow throttle with the same lag)
// the ground under the ship, camera-relative: on (within 300 m of) the launch pad its frame (x east, y up, z south down the
// flame channel), else the terrain below with an arbitrary heading. {O, X, Y, Z, pad}
function groundFrame(camW){const b=S.body,p=add(bodyPos(b,simT),S.r);
  if(b===TELLUS){const F=padFrame(camW),d=sub(sub(p,camW),F.O),hz=sub(d,mul(F.Y,dot(d,F.Y)));if(len(hz)<300)return{O:F.O,X:F.X,Y:F.Y,Z:F.Z,pad:true}}
  const up=norm(S.r),g=add(bodyPos(b,simT),mul(up,groundR(b,toPF(b,S.r,simT)))),X=norm(cross(up,Math.abs(up[1])<.9?[0,1,0]:[1,0,0]));
  return{O:sub(g,camW),X,Y:up,Z:cross(X,up),pad:false}}
// the plumes' light, one point light for all burning engines: at the flame's bright part (a quarter of the plume down,
// lower when the jet reaches the ground), coloured from the propellant's core and mantle, strength ∝ exit area × spool,
// with the plume's flicker. PLT = {p: [camera-relative position, core radius], c: colour × strength, g: ground info}.
let CLOUD_VOL=true;   // false: the flat shell everywhere (A/B)
let ICE_VARY=true;   // false: the old uniform ice caps on the high ranges (A/B, Q52)
let CLOUD_VARY=true;   // false: no 9 km swell in the deck's top heights (A/B, Q65: a more varied deck seen from 8 km)
let CLOUD_SHADOW_V=true;   // false: the ground keeps the shell's cloud shadow under the volume too (A/B, Q65)
let CLOUD_DT=0;   // debug/reference views only: shifts the drawn weather in time (s). cloudAt (satellites) ignores it
// the coverage texture for the near cloud volume: 512² over ±50 km round the point under the camera (planet-fixed,
// gnomonic). Re-baked when the camera has moved 5 km or the weather has drifted (uCT) noticeably.
const COV={tex:null,fb:null,n0:512,ext:5e4,vd:4e4,c0:[0,1,0],e:[1,0,0],n:[0,0,1],ct:-1};
function covBake(camW){const th=bodyTheta(TELLUS,simT),c=Math.cos(th),s=Math.sin(th),u=norm(camW),
    c0=[c*u[0]-s*u[2],u[1],s*u[0]+c*u[2]],ct=((tNow()+CLOUD_DT)*2e-4)%500;   // the camera's direction, planet-fixed: uProt·u (uProt's columns are (c,0,s), (0,1,0), (−s,0,c))
  if(COV.tex&&dot(c0,COV.c0)>Math.cos(5000/TELLUS.R)&&Math.abs(ct-COV.ct)<.02)return;
  if(!COV.tex){COV.tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,COV.tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,COV.n0,COV.n0,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    COV.fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,COV.fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,COV.tex,0)}
  const e=norm(cross([0,1,0],c0)),n=cross(c0,e);Object.assign(COV,{c0,e,n,ct});
  const u2=PCOV.u;gl.useProgram(PCOV.p);gl.bindFramebuffer(gl.FRAMEBUFFER,COV.fb);gl.viewport(0,0,COV.n0,COV.n0);gl.disable(gl.DEPTH_TEST);
  gl.uniform1f(u2.uCT,ct);gl.uniform1f(u2.uPR,TELLUS.R);gl.uniform1f(u2.uCvX,COV.ext);gl.uniform3fv(u2.uCv0,c0);gl.uniform3fv(u2.uCvE,e);gl.uniform3fv(u2.uCvN,n);
  gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFB());gl.enable(gl.DEPTH_TEST)}
let BLOOM=true;   // false draws straight to the screen (A/B)
const SCN={w:0,h:0,on:false};
function texRT(w,h){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return{t,fb,w,h}}
// the scene target for this frame size (multisampled colour + depth/stencil, a resolve texture, the bloom chain)
function sceneTarget(w,h){if(SCN.w===w&&SCN.h===h)return SCN;
  if(SCN.ms){gl.deleteFramebuffer(SCN.ms);gl.deleteRenderbuffer(SCN.rc);gl.deleteRenderbuffer(SCN.rd);for(const x of[SCN.res,...SCN.chain]){gl.deleteTexture(x.t);gl.deleteFramebuffer(x.fb)}}
  const ns=Math.min(4,gl.getParameter(gl.MAX_SAMPLES)),rc=gl.createRenderbuffer(),rd=gl.createRenderbuffer(),ms=gl.createFramebuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER,rc);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,ns,gl.RGBA8,w,h);
  gl.bindRenderbuffer(gl.RENDERBUFFER,rd);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,ns,gl.DEPTH24_STENCIL8,w,h);
  gl.bindFramebuffer(gl.FRAMEBUFFER,ms);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,rc);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,rd);
  const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  const res=texRT(w,h),chain=[2,4,8,16].map(k=>texRT(Math.max(1,Math.ceil(w/k)),Math.max(1,Math.ceil(h/k))));
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);Object.assign(SCN,{w,h,ms,rc,rd,res,chain,ok});return SCN}
// the framebuffer the 3D frame is being drawn into (passes that render elsewhere mid-frame come back to it)
const sceneFB=()=>SCN.on?SCN.ms:null;
function bloomBegin(w,h){SCN.on=false;if(!BLOOM)return;const T=sceneTarget(w,h);if(!T.ok)return;SCN.on=true;gl.bindFramebuffer(gl.FRAMEBUFFER,T.ms)}
function bloomEnd(){if(!SCN.on)return;const T=SCN,w=T.w,h=T.h;SCN.on=false;
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,T.ms);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,T.res.fb);gl.blitFramebuffer(0,0,w,h,0,0,w,h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.depthMask(false);gl.bindVertexArray(quadVAO);
  const u=PBLM.u;gl.useProgram(PBLM.p);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(u.uT,0);let src=T.res;
  T.chain.forEach((dst,i)=>{gl.bindFramebuffer(gl.FRAMEBUFFER,dst.fb);gl.viewport(0,0,dst.w,dst.h);gl.bindTexture(gl.TEXTURE_2D,src.t);
    gl.uniform2f(u.uPx,.5/src.w,.5/src.h);gl.uniform1f(u.uTh,i===0?.965:0);gl.drawArrays(gl.TRIANGLES,0,3);src=dst});
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);const c=PCOMP.u;gl.useProgram(PCOMP.p);
  [T.res,...T.chain].forEach((x,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,x.t)});
  gl.uniform1i(c.uS,0);gl.uniform1i(c.uB1,1);gl.uniform1i(c.uB2,2);gl.uniform1i(c.uB3,3);gl.uniform1i(c.uB4,4);
  gl.uniform2f(c.uP4,1/T.chain[3].w,1/T.chain[3].h);gl.uniform1f(c.uK,.9);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.activeTexture(gl.TEXTURE0);gl.depthMask(true);gl.enable(gl.DEPTH_TEST)}
// ---- fin-tip vapor: each fin tip's recent path, planet-fixed, with how much vapor it shed there. A fin sheds a tip
// vortex in proportion to its load: the cross-flow component along its normal (so in a turn two fins of a ring trail
// and two don't), dynamic pressure and angle of attack; condensation needs humid low air and subsonic-to-low-supersonic
// flow (the same window as the vapor cones, wider in Mach). Render-side; trails last ~1.2 s.
let FINTIP_FX=true;
const FTR=new Map(),FTV={buf:null,vao:null,n:0,cap:0};
function finTips(s){const out=[];for(const p of s.parts){if(!p.on)continue;const k=p.d.kind;
    if(k==='fins'){const sp=p.d.span,r=(p.d.r||R0)+sp;for(let i=0;i<4;i++){const a=i*Math.PI/2;out.push({key:p,i,pos:[p.pos[0]+r*Math.cos(a),p.y0+p.d.chord*.12,p.pos[2]+r*Math.sin(a)],nrm:[-Math.sin(a),0,Math.cos(a)]})}}
    else if(k==='rfin'){const a=p.phi||0,sp=p.d.span;out.push({key:p,i:0,pos:[p.pos[0]+sp*Math.cos(a),p.y0+p.h*.12,p.pos[2]+sp*Math.sin(a)],nrm:[-Math.sin(a),0,Math.cos(a)]})}}
  return out}
function finTipTick(){if(!FINTIP_FX||mode!=='flight'||!S||!S.alive||S.body!==TELLUS){FTR.clear();return}
  const h=len(S.r)-TELLUS.R,M=S.mach||0,va=sub(S.v,surfVel(TELLUS,S.r)),sp=len(va);
  for(const[k,t]of FTR){while(t.pts.length&&simT-t.pts[0].t>1.4)t.pts.shift();if(!t.pts.length)FTR.delete(k)}
  if(sp<30)return;const vb=qrot(qconj(S.q),mul(va,1/sp)),cr=[vb[0],0,vb[2]],cl=len(cr),aoa=Math.asin(Math.min(1,cl));
  const env=(1-sstep(5000,11000,h))*(1-sstep(1.3,1.8,M))*sstep(.25,.5,M),base=env*sstep(.02,.12,aoa)*sstep(3e3,15e3,S.qdyn||0);
  for(const f of finTips(S)){const key=f.key.i*8+f.i,load=cl>1e-6?Math.abs(dot(f.nrm,cr))/cl:0,I=base*load;
    let t=FTR.get(key);const pw=add(S.r,qrot(S.q,sub(f.pos,S.cm)));
    if(!t){if(I<.02)continue;t={pts:[]};FTR.set(key,t)}const last=t.pts[t.pts.length-1];
    if(last&&simT-last.t<1e-4)continue;if(last&&simT<last.t){t.pts.length=0}
    t.pts.push({pf:toPF(TELLUS,pw,simT),t:simT,I})}}
function drawFinTips(VP,camW,R,U){if(!FTR.size)return;const th=bodyTheta(TELLUS,simT),c=Math.cos(th),sn=Math.sin(th),v=[];
  for(const t of FTR.values()){const P=t.pts;if(P.length<2)continue;
    const W=P.map(q=>{const x=q.pf[0],y=q.pf[1],z=q.pf[2];return[c*x+sn*z-camW[0],y-camW[1],-sn*x+c*z-camW[2]]});
    for(let i=0;i<P.length-1;i++){const a=W[i],b=W[i+1],d=sub(b,a);const ln=len(d);if(ln<1e-4)continue;
      const mid=mul(add(a,b),.5),side=norm(cross(d,mid)),age0=simT-P[i].t,age1=simT-P[i+1].t;
      const w0=.2+1.1*Math.sqrt(age0),w1=.2+1.1*Math.sqrt(age1),al0=Math.min(.85,P[i].I*1.4)*Math.exp(-age0/.6),al1=Math.min(.85,P[i+1].I*1.4)*Math.exp(-age1/.6);
      const A0=madd(a,side,-w0),A1=madd(a,side,w0),B0=madd(b,side,-w1),B1=madd(b,side,w1);
      v.push(...A0,-1,al0,...A1,1,al0,...B1,1,al1,...A0,-1,al0,...B1,1,al1,...B0,-1,al1)}}
  const n=v.length/5;if(!n)return;
  if(!FTV.vao){FTV.vao=gl.createVertexArray();FTV.buf=gl.createBuffer();gl.bindVertexArray(FTV.vao);gl.bindBuffer(gl.ARRAY_BUFFER,FTV.buf);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12)}
  gl.bindVertexArray(FTV.vao);gl.bindBuffer(gl.ARRAY_BUFFER,FTV.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.DYNAMIC_DRAW);
  const E=lightEnv(camW),u=PVTR.u;gl.useProgram(PVTR.p);gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniform1f(u.uFc,FC);
  gl.uniform3fv(u.uLight,E.sun.map(x=>x*.45));gl.uniform3fv(u.uAmb,E.sky.map((x,i)=>x+E.gnd[i]));
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,n);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(PMESH.p)}
// the glow's heat level: the stagnation flux, faded in by airspeed around PLASMA_V (terrain's blackout threshold, Q17).
// Dense air on an ordinary climb reaches the flux at ~1 km/s (Mach 3.5, PLAYTEST #17) but is not hot enough to glow;
// the shock layer lights up at orbital-class speeds. Fades over .85–1.05 PLASMA_V so the shell grows in, not pops.
function plasmaHeat(b,r,v,q){const s=len(sub(v,surfVel(b,r))),x=clamp((s-.85*PLASMA_V)/(.2*PLASMA_V),0,1);return q*x*x*(3-2*x)}
// the plasma for one body: S needs body, r, v, q, parts, cm, radius, yTop, yBot (the ship, or debrisGeo for a stage)
function drawPlasma(VP,camW,S,p,qH,all){const va=sub(S.v,surfVel(S.body,S.r)),vl=len(va);if(vl>50){
  const f=mul(va,1/vl),k=clamp(Math.log(qH/1.5e4)/Math.log(1.6e5/1.5e4),0,1.5),Y=qrot(S.q,[0,1,0]),ca=Math.abs(dot(Y,f)),sa=Math.sqrt(Math.max(0,1-ca*ca)),
    rb=S.radius,hl=(S.yTop-S.yBot)/2,mid=(S.yTop+S.yBot)/2,ef=ca*hl+sa*rb,ep=sa*hl+ca*rb,D=.12*Math.min(ep,rb*1.2)+.06,Lw=ep*(5+14*Math.min(k,1)),
    su=ef+Math.abs(dot(Y,f)*mid)+3*D,X=norm(cross(f,Math.abs(f[1])<.9?[0,1,0]:[1,0,0])),Z=cross(X,f),Qf=qFromBasis(X,f,Z),qi=qconj(Qf),
    O=add(sub(p,camW),mul(f,su)),R=ep*1.9+D*3+.06*Lw+.2,L=su+ef+Lw+ep,cl=qrot(qi,mul(O,-1)),c=[0,-su,0],A=qrot(qi,Y),m0=add(c,mul(A,mid)),
    inside=cl[1]<.01&&cl[1]>-L-.01&&Math.hypot(cl[0],cl[2])<R*1.01+.05,pu=PPLASMA.u;
  gl.useProgram(PPLASMA.p);gl.uniformMatrix4fv(pu.uVP,false,VP);gl.uniform1f(pu.uFc,FC);gl.uniform1f(pu.uT,performance.now()/1000%1000);
  gl.uniformMatrix4fv(pu.uM,false,modelQ(Qf,O));gl.uniform3f(pu.uB,R,L,0);gl.uniform3fv(pu.uCam,cl);gl.uniform1f(pu.uIn,inside?1:0);
  gl.uniform3fv(pu.uA,A);gl.uniform3fv(pu.uM0,m0);gl.uniform3fv(pu.uC,m0);gl.uniform1f(pu.uK,k);gl.uniform1f(pu.uRb,rb);gl.uniform1f(pu.uHl,hl);
  gl.uniform1f(pu.uD,D);gl.uniform1f(pu.uLw,Lw);gl.uniform1f(pu.uEf,ef);gl.uniform1f(pu.uEp,ep);gl.uniform1fv(pu['uPr[0]'],hullProfile(S,all));
  gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_3D,PNOISE);gl.uniform1i(pu.uN,7);gl.activeTexture(gl.TEXTURE0);
  gl.enable(gl.CULL_FACE);gl.cullFace(inside?gl.BACK:gl.FRONT);gl.bindVertexArray(PLUME.vao);gl.drawArrays(gl.TRIANGLES,0,PLUME.n);gl.disable(gl.CULL_FACE);
  gl.useProgram(PMESH.p)}}
// ---- spent stages falling back (render-side): a stagnation heat flux per debris piece from its speed through the air
// (Sutton–Graves, nose radius from its widest part), smoothed; drives its plasma, char marks on its parts, sparks shed
// from the hot face and a dark smoke trail while it burns. Geometry (y range, radius) worked out once per piece.
const DEBH=new WeakMap();
function debrisGeo(d){const g={body:d.body,r:d.r,v:d.v,q:d.q,parts:d.parts,cm:d.cm};let y0=1e9,y1=-1e9,rad=.3;
  for(const p of d.parts){y0=Math.min(y0,p.y0);y1=Math.max(y1,p.y0+p.h);rad=Math.max(rad,(p.d.r||R0)+Math.hypot(p.pos[0],p.pos[2])*.5)}
  g.yBot=y0-d.cm[1];g.yTop=y1-d.cm[1];g.radius=rad;return g}
function debrisHeat(){if(mode!=='flight')return;const dt=Math.min(.1,Math.max(0,simT-(debrisHeat.t??simT)));debrisHeat.t=simT;if(!dt)return;
  for(const d of debris){const b=d.body;if(!b.atm)continue;const h=len(d.r)-b.R,rho=density(b,h);let g=DEBH.get(d);
    if(!g){if(rho<=0)continue;g={geo:debrisGeo(d),q:0,spk:0,smk:0};DEBH.set(d,g)}
    g.geo.r=d.r;g.geo.v=d.v;g.geo.q=d.q;const va=sub(d.v,surfVel(b,d.r)),sp=len(va),
      qs=rho>0?Math.sqrt(rho/Math.max(g.geo.radius,.3))*sp*sp*sp*SG*HEAT_GAIN:0;g.q+=(qs-g.q)*(1-Math.exp(-dt/.5));
    if(g.q<1.5e4)continue;const k=clamp(Math.log(g.q/1.5e4)/Math.log(1.6e5/1.5e4),0,1.5),fb=sp>1?qrot(qconj(d.q),mul(va,1/sp)):[0,1,0];
    for(const p of d.parts){const m=markOf(p);m.char=Math.min(1,m.char+dt*k*.12);m.cd=madd(m.cd,fb,dt*k)}   // it chars as it burns
    if(b!==TELLUS)continue;const lead=add(d.r,mul(va,-(g.geo.radius+.5)/Math.max(sp,1)*0));
    g.spk+=dt*k*40;while(g.spk>1){g.spk-=1;const R=Math.random,u=norm([R()-.5,R()-.5,R()-.5]);   // sparks peel off and fall behind
      fxPuff(madd(lead,u,g.geo.radius*.8),add(madd(d.v,va,-(.02+.05*R())),mul(u,6*R())),{s0:.06+.08*R(),grow:0,a0:.9,life:.4+.8*R(),hot:1.8})}
    g.smk+=dt*k*12;while(g.smk>1){g.smk-=1;if(smoke.length>2500)smoke.shift();const R=Math.random;   // a dark trail of ablated paint and insulation
      smoke.push({pf:toPF(b,madd(d.r,[R()-.5,R()-.5,R()-.5],g.geo.radius),simT),t0:simT,s0:g.geo.radius*(1+R()),grow:3+3*R(),a0:.35*clamp(rho*3,.1,1),life:25+20*R(),rise:0,seed:R()*97})}}}
let PLUME_LIGHT=true;   // false turns the plume light off (A/B)
const PLT={p:new Float32Array(4),c:new Float32Array(3),g:null};
const DISC=(()=>{const a=[],w=[1,1,1];lathe(a,[[0,0,w],[1,0,w]],[0,0,0],40,[false,false]);return makeMesh(a)})();
function plumeLight(camW){PLT.c.fill(0);PLT.g=null;if(!PLUME_LIGHT||mode!=='flight'||!S||!S.alive)return;const E=plumeEngines().map(x=>x[0]);if(!E.length)return;
  const p=add(bodyPos(S.body,simT),S.r),pa=S.body.atm?pressure(S.body,len(S.r)-S.body.R):0,GF=groundFrame(camW);let W=0,P=[0,0,0],C=[0,0,0],R0=0,hg=1e9;
  for(const e of E){const sp=SPOOL.get(e),thr=sp?sp.k:S.throttle;const f=pfxOf(e.d),Pr=PROPS[f.prop]||PROPS.kerolox,g=ignOf(e,Pr),L=plumeShape(e.d,thr,pa)[2],
      pf=plumeFrame(e),Q=pf.qt?qmul(S.q,pf.qt):S.q,o=add(sub(p,camW),qrot(S.q,sub(pf.ex,S.cm))),dW=qrot(Q,[0,-1,0]),dn=dot(dW,GF.Y);
    if(thr<.01&&g[0]+g[1]+g[2]<.01)continue;
    let at=L*.25;if(dn<-.2){const sg=dot(sub(GF.O,o),GF.Y)/dn;if(sg>0){at=Math.min(at,sg*.85);hg=Math.min(hg,sg)}}
    const w=thr*(e.d.exit/.55)**2*(.6+.4*Pr.K[0]/5),tt=simT*7+e.i*1.7,fl=.94+.03*Math.sin(tt*9.1)+.03*Math.sin(tt*23.7);
    P=madd(P,add(o,mul(dW,at)),w);const gf=Math.min(1,g[0]+g[1]+g[2]);for(let k=0;k<3;k++)C[k]+=w*fl*(Pr.co[k]*.4+Pr.ma[k]*.6)*(1-.8*gf)+(e.d.exit/.55)**2*g[k]*.6;W+=Math.max(w,.05);R0=Math.max(R0,e.d.exit*2.5)}   // (1−0.8 gf: the igniter's flash outshines the young flame)
  if(W<=0)return;P=mul(P,1/W);const K=110*Math.min(1,pa*4+.15);   // dimmer in thin air (the plume's own glow goes too)
  PLT.p.set([P[0],P[1],P[2],R0]);PLT.c.set(C.map(x=>x*K));
  const h=dot(sub(P,GF.O),GF.Y);if(h>0&&h<60)PLT.g={F:GF,h,foot:sub(P,mul(GF.Y,h))}}
function drawPlumePool(VP){const g=PLT.g;if(!g)return;const u=PPOOL.u,F=g.F,Rp=Math.max(12,g.h*3.2);gl.useProgram(PPOOL.p);
  gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniformMatrix4fv(u.uM,false,mat4(F.X,F.Y,F.Z,g.foot));gl.uniform1f(u.uFc,FC);gl.uniform1f(u.uR,Rp);
  const dk=1-sstep(-.05,.2,dot(norm(S.r),SUN));gl.uniform1f(u.uDk,.12+.88*dk);   // added onto already-lit ground: in daylight a flame pool barely shows
  gl.uniform3fv(u.uPlC,PLT.c);gl.uniform1f(u.uLh,g.h);gl.uniform1f(u.uR0,PLT.p[3]);gl.bindVertexArray(DISC.vao);gl.drawArrays(gl.TRIANGLES,0,DISC.n);gl.useProgram(PMESH.p)}
// an explosion's flash, as the scene's point light (PLT) while it outshines the plumes: decays over ~0.3 s, then the
// fireball's glow lingers dimmer for ~1 s
function boomLight(camW){const now=performance.now();let best=null,bk=0;
  for(const bm of booms){const a=(now-bm.t0)/1000;if(a<0||a>2)continue;const k=bm.sz*(900*Math.exp(-a/.12)+120*Math.exp(-a/.8));if(k>bk){bk=k;best=[bm,a]}}
  if(!best||bk<PLT.c[0]+PLT.c[1]+PLT.c[2])return;const[bm,a]=best,ps=fromPF(bm.b,bm.pf,simT),P=sub(add(bodyPos(bm.b,simT),ps),camW),R0=bm.sz*(2+6*Math.sqrt(a));
  PLT.p.set([P[0],P[1],P[2],R0]);PLT.c.set([bk,bk*.62,bk*.3]);
  if(bm.b===TELLUS){const Y=norm(ps),g=groundR(TELLUS,toPF(TELLUS,ps,simT)),h=len(ps)-g;
    if(h>-1&&h<80){const X=norm(cross(Y,Math.abs(Y[1])<.9?[0,1,0]:[1,0,0]));PLT.g={F:{X,Y,Z:cross(X,Y)},h:Math.max(h,R0*.5),foot:sub(P,mul(Y,h))}}}}
// the re-entry plasma's light on the hull (QUEUE Q63): the shock layer as the scene's point light (PLT) while it
// outshines the plumes. It sits in the sheath just ahead of the leading face, as wide as the ship's cross-flow extent,
// so the windward face takes most of it and the sides a soft wash; colour follows the shell's (deep red → orange →
// pink-white with the heat level k). Lights smoke too (the same PLT); no ground pool (nothing glows near the ground).
let PLASMA_LIGHT=true;   // false turns it off (A/B)
function plasmaLight(camW){if(!PLASMA_LIGHT||!PLASMA_FX||mode!=='flight'||!S||!S.alive||!S.body.atm)return;
  const qE=plasmaHeat(S.body,S.r,S.v,S.qHeat);if(qE<=1.5e4)return;const va=sub(S.v,surfVel(S.body,S.r)),vl=len(va);if(vl<50)return;
  const k=clamp(Math.log(qE/1.5e4)/Math.log(1.6e5/1.5e4),0,1.5),f=mul(va,1/vl),Y=qrot(S.q,[0,1,0]),ca=Math.abs(dot(Y,f)),sa=Math.sqrt(Math.max(0,1-ca*ca)),
    rb=S.radius,hl=(S.yTop-S.yBot)/2,mid=(S.yTop+S.yBot)/2,ef=ca*hl+sa*rb+Math.abs(dot(Y,f)*mid),ep=sa*hl+ca*rb,D=.12*Math.min(ep,rb*1.2)+.06,
    a=clamp(k,0,1),c=a<.5?[1,.28+.54*a,.06+.32*a]:[1,.55+.3*(a-.5),.22+1.46*(a-.5)],K=PLASMA_LK*k*k*Math.min(2.25,ep*ep),
    P=add(sub(add(bodyPos(S.body,simT),S.r),camW),mul(f,ef+2*D));
  if(K*(c[0]+c[1]+c[2])<PLT.c[0]+PLT.c[1]+PLT.c[2])return;PLT.p.set([P[0],P[1],P[2],ep*1.2]);PLT.c.set(c.map(x=>x*K));PLT.g=null}
let PLASMA_LK=5;   // the plasma light's brightness at k = 1, per square metre of cross-flow extent (tuned against views 40, 46, 47)
const VBOX=(()=>{const F=[[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[0,1,0],[1,0,0]]],v=[];
  for(const[n,a,b]of F){const c=(i,j)=>[n[0]+a[0]*i+b[0]*j,n[1]+a[1]*i+b[1]*j,n[2]+a[2]*i+b[2]*j];v.push(...c(-1,-1),...c(1,-1),...c(1,1),...c(-1,-1),...c(1,1),...c(-1,1))}
  const vao=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);gl.bindVertexArray(null);return{vao,n:36}})();
// ---- HUD gauges (aerofx session; PLAYTEST #9's graphics). Self-contained instrument widgets drawn on the 2D overlay:
// an altitude tape, the atmosphere's depth, dynamic pressure with a max-q pointer, Mach, and the hottest part's skin
// temperature. drawGauges(x, y, s) draws the whole strip with its top-left at (x, y) in overlay pixels, scale s; where it
// sits is the HUD layout's business (the ui session's slice 4) — gaugeRect() is a placeholder beside the navball.
// Look: early-era instruments, cream dial faces with black ink on a dark panel, red limits, amber cautions.
let GAUGES=true;   // false hides the strip
const GQ={ship:null,peak:0,peakT:0};   // max-q, held per vessel (render-side)
const GC={panel:'#17191c',bezel:'#2b2e33',face:'#e8e1cc',faceDim:'#c9c1a9',ink:'#1b1a17',red:'#b8322a',amber:'#d79b1c',green:'#4f7f3a',lab:'#b9b29c'};
// (flow, UI slice 4b) the strip's place is #gslot, the left of the bottom cluster (gauges | throttle | navball | SAS);
// app/hud.js shows the slot while the Ascent condition holds, so in space the cluster narrows. Scaled to the slot's width.
function gaugeRect(){const g=document.getElementById('gslot');if(!g||g.closest('.hidden')||!g.offsetParent||getComputedStyle(g).visibility==='hidden')return null;   // the HUD hidden: no gauges
  const r=g.getBoundingClientRect(),k=ov.width/ov.clientWidth;return{x:r.left*k,y:r.top*k,s:k*r.width/318}}
function gaugeFont(px,s,w=600){return `${w} ${Math.round(px*s)}px Bahnschrift,"DIN Alternate","Arial Narrow",Arial,sans-serif`}
function drawGauges(x0,y0,s){if(!GAUGES||!S)return;const g=octx,b=S.body,h=len(S.r)-b.R;
  // the data
  if(GQ.ship!==S){GQ.ship=S;GQ.peak=0;GQ.peakT=0}if(S.qdyn>GQ.peak){GQ.peak=S.qdyn;GQ.peakT=simT}
  const el=elements(S.r,S.v,b.mu),low=!S.landed&&h<TERR_TOP+20000,radar=low?Math.max(0,groundGap(S)):null,
    pa=b.atm&&h<b.atm?pressure(b,h):0,M=S.mach||0,q=S.qdyn||0;
  let hot=null;for(const p of S.parts)if(p.on&&p.d.Tmax&&(!hot||p.T/p.d.Tmax>hot.T/hot.d.Tmax))hot=p;
  const W=318,H=150;g.save();g.translate(x0,y0);g.scale(s,s);
  // the panel
  g.fillStyle=GC.panel;g.strokeStyle=GC.bezel;g.lineWidth=2;rrect(g,0,0,W,H,7);g.fill();g.stroke();
  g.textBaseline='middle';
  // 1. altitude tape: a scrolling scale round the current altitude, span by altitude; marks for the top of the air, the
  //    cloud deck, Ap and Pe; the window shows the altitude (radar altitude over it when low)
  {const X=8,Y=8,w=64,hh=H-16,cy=Y+hh/2,span=clamp(h*1.4,1500,6e5),k=hh/span,ty=v=>cy-(v-h)*k;
    g.save();rrect(g,X,Y,w,hh,4);g.clip();g.fillStyle=GC.face;g.fillRect(X,Y,w,hh);
    if(b.atm){const t=ty(b.atm);g.fillStyle='#d6dde3';g.fillRect(X,Y,w,Math.max(0,t-Y))}   // above the air: pale
    if(b===TELLUS){const a=ty(5500),c=ty(2000);g.fillStyle='rgba(255,255,255,.75)';g.fillRect(X,a,w,c-a);g.strokeStyle=GC.faceDim;g.lineWidth=1;g.strokeRect(X+.5,a,w-1,c-a)}
    const st=niceStep(span/6);g.strokeStyle=GC.ink;g.fillStyle=GC.ink;g.font=gaugeFont(9,1);g.textAlign='left';
    for(let v=Math.floor((h-span/2)/st)*st;v<=h+span/2;v+=st){if(v<0)continue;const yy=ty(v);g.lineWidth=1.2;g.beginPath();g.moveTo(X+w-12,yy);g.lineTo(X+w,yy);g.stroke();
      for(let m=1;m<5;m++){const y2=ty(v+st*m/5);g.lineWidth=.6;g.beginPath();g.moveTo(X+w-6,y2);g.lineTo(X+w,y2);g.stroke()}
      g.fillText(fmtAlt(v),X+3,yy)}
    const mark=(v,txt,col)=>{const yy=ty(v);if(yy<Y-6||yy>Y+hh+6)return;g.fillStyle=col;g.beginPath();g.moveTo(X+w,yy);g.lineTo(X+w-9,yy-5);g.lineTo(X+w-9,yy+5);g.fill();
      g.font=gaugeFont(8,1,700);g.textAlign='right';g.fillText(txt,X+w-11,yy);g.textAlign='left'};
    if(b.atm)mark(b.atm,'AIR',GC.green);
    if(!S.landed&&el.e<1){mark(el.ap-b.R,'Ap',GC.red);if(el.pe>b.R)mark(el.pe-b.R,'Pe',GC.red)}
    g.restore();
    // the window
    g.fillStyle=GC.ink;g.strokeStyle=GC.amber;g.lineWidth=1.5;rrect(g,X-2,cy-10,w+4,20,3);g.fill();g.stroke();
    g.fillStyle=GC.face;g.font=gaugeFont(12,1,700);g.textAlign='center';g.fillText(fmtAlt(h,true),X+w/2,cy+.5);
    g.font=gaugeFont(8,1);g.fillStyle=GC.lab;g.fillText(radar!=null?`RADAR ${fmtAlt(radar,true)}`:'ALTITUDE',X+w/2,Y+hh+4.5);}
  // 2. the air: a column from sea-level pressure to vacuum, filled to the current pressure (log scale, 1 → 1e-4 atm)
  {const X=80,Y=14,w=18,hh=H-28;rrect(g,X,Y,w,hh,3);g.fillStyle='#08090b';g.fill();
    const gr=g.createLinearGradient(0,Y+hh,0,Y);gr.addColorStop(0,'#7fb3e0');gr.addColorStop(.55,'#2b4f8e');gr.addColorStop(1,'#0b1020');
    const f=pa>0?clamp(1+Math.log10(pa)/4,0,1):0;g.save();rrect(g,X,Y,w,hh,3);g.clip();g.fillStyle=gr;g.fillRect(X,Y+hh*(1-f),w,hh*f);g.restore();
    g.strokeStyle=GC.bezel;g.lineWidth=1;rrect(g,X,Y,w,hh,3);g.stroke();
    g.fillStyle=GC.lab;g.font=gaugeFont(8,1);g.textAlign='center';g.fillText('AIR',X+w/2,Y-5);
    g.fillText(pa>=.01?pa.toFixed(2):pa>0?pa.toExponential(0).replace('e-','e−'):'VAC',X+w/2,Y+hh+6)}
  // 3. dynamic pressure: a dial 0–qmax (kPa), the needle, a red pointer held at the flight's max-q; Mach in a drum below
  {const cx=166,cy=72,R=50,qmax=Math.max(40e3,GQ.peak*1.15),a0=Math.PI*.8,a1=Math.PI*2.2,ang=v=>a0+(a1-a0)*clamp(v/qmax,0,1);
    g.fillStyle=GC.face;g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.fill();g.strokeStyle=GC.bezel;g.lineWidth=3;g.stroke();
    g.strokeStyle=GC.ink;g.fillStyle=GC.ink;g.textAlign='center';g.font=gaugeFont(8,1);const st=niceStep(qmax/5);
    for(let v=0;v<=qmax+1;v+=st/2){const a=ang(v),big=Math.abs(v/st-Math.round(v/st))<1e-6;g.lineWidth=big?1.4:.7;g.beginPath();
      g.moveTo(cx+Math.cos(a)*(R-3),cy+Math.sin(a)*(R-3));g.lineTo(cx+Math.cos(a)*(R-(big?10:6)),cy+Math.sin(a)*(R-(big?10:6)));g.stroke();
      if(big)g.fillText((v/1e3).toFixed(0),cx+Math.cos(a)*(R-17),cy+Math.sin(a)*(R-17))}
    g.font=gaugeFont(8,1,700);g.fillText('q kPa',cx,cy-17);
    if(GQ.peak>500){const a=ang(GQ.peak);g.fillStyle=GC.red;g.beginPath();g.moveTo(cx+Math.cos(a)*(R-1),cy+Math.sin(a)*(R-1));
      g.lineTo(cx+Math.cos(a+.07)*(R+7),cy+Math.sin(a+.07)*(R+7));g.lineTo(cx+Math.cos(a-.07)*(R+7),cy+Math.sin(a-.07)*(R+7));g.fill()}
    {const a=ang(q);g.strokeStyle=GC.ink;g.lineWidth=2.4;g.beginPath();g.moveTo(cx-Math.cos(a)*8,cy-Math.sin(a)*8);g.lineTo(cx+Math.cos(a)*(R-8),cy+Math.sin(a)*(R-8));g.stroke();
      g.fillStyle=GC.ink;g.beginPath();g.arc(cx,cy,4,0,Math.PI*2);g.fill()}
    g.font=gaugeFont(8,1);g.fillStyle=GC.ink;g.fillText(`MAX ${(GQ.peak/1e3).toFixed(1)}`,cx,cy+17);
    // Mach drum: amber through the transonic band
    const tr=M>.85&&M<1.25,mw=56;g.fillStyle=tr?GC.amber:GC.ink;rrect(g,cx-mw/2,cy+R+3,mw,17,3);g.fill();
    g.fillStyle=tr?GC.ink:GC.face;g.font=gaugeFont(11,1,700);g.fillText(`M ${M.toFixed(2)}`,cx,cy+R+12)}
  // 4. heat: the hottest part's skin temperature against its limit, green → amber → red, with its name
  {const X=228,Y=14,w=16,hh=H-34,f=hot?clamp((hot.T-250)/(hot.d.Tmax-250),0,1):0,col=f<.6?GC.green:f<.85?GC.amber:GC.red;
    rrect(g,X,Y,w,hh,3);g.fillStyle='#08090b';g.fill();g.save();rrect(g,X,Y,w,hh,3);g.clip();g.fillStyle=col;g.fillRect(X,Y+hh*(1-f),w,hh*f);g.restore();
    g.strokeStyle=GC.red;g.lineWidth=1.5;g.beginPath();g.moveTo(X-3,Y+hh*.15);g.lineTo(X+w+3,Y+hh*.15);g.stroke();
    g.strokeStyle=GC.bezel;g.lineWidth=1;rrect(g,X,Y,w,hh,3);g.stroke();
    g.fillStyle=GC.lab;g.font=gaugeFont(8,1);g.textAlign='center';g.fillText('HEAT',X+w/2,Y-5);
    g.textAlign='left';g.font=gaugeFont(10,1,700);g.fillStyle=f>.85?GC.red:GC.face;g.fillText(hot?`${hot.T.toFixed(0)} K`:'—',X+w+7,Y+hh-26);
    g.font=gaugeFont(8,1);g.fillStyle=GC.lab;g.fillText(hot?`of ${hot.d.Tmax} K`:'',X+w+7,Y+hh-13);
    g.fillText(hot?hot.d.name.split(' ')[0].toUpperCase():'',X+w+7,Y+hh)}
  g.restore()}
function rrect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function niceStep(x){const p=Math.pow(10,Math.floor(Math.log10(x))),m=x/p;return(m<1.5?1:m<3.5?2:m<7.5?5:10)*p}
function fmtAlt(v,fine){const a=Math.abs(v);return a>=1e5?(v/1e3).toFixed(0)+' km':a>=1e4?(v/1e3).toFixed(fine?1:0)+' km':a>=1e3?(v/1e3).toFixed(fine?2:1)+' km':v.toFixed(0)+' m'}
// the home galaxy's look, from a seed (PLAYTEST #10, Caio: each world's sky different): a great-circle band
// with a bulge, dust, arms, a satellite galaxy and a nebula, all as directions in the inertial frame
function makeGal(seed){const R=rng(seed*7919+101),dir=()=>norm([R()*2-1,R()*2-1,R()*2-1]);
  const gx=norm(add(dir(),[0,.3,0])),c0=dir(),gc=norm(sub(c0,mul(gx,dot(c0,gx)))),off=a=>norm(add(gc,a));
  const s=dir(),nb=norm(add(mul(gc,.6),add(mul(gx,.15),mul(dir(),.5))));
  return{seed,gx,gc,gt:[.75+.2*R(),.82+.1*R(),1],p:[.09+.07*R(),.18+.14*R(),.5+.5*R(),.3+.5*R()],s:[...s,.035+.04*R()],n:[...nb,.06+.07*R()]}}
// a different galaxy each playthrough (QUEUE Q21): the program's own seed PROG.gseed, drawn the first time the sky is
// drawn and saved with the program (a reset clears it; the tester's sandbox has its own). The planet stays WSEED's.
let GAL=makeGal(WSEED);
function galaxy(){if(PROG.gseed==null)PROG.gseed=1+Math.floor(Math.random()*2147483646);if(GAL.seed!==PROG.gseed)GAL=makeGal(PROG.gseed);return GAL}
let IMPACT_FX=true;   // false hides the plume's ground impingement volume (GPU A/B)
const CUBE=(()=>{const a=[];box(a,[0,0,0],1,1,1,[1,1,1]);return makeMesh(a)})();
// one volume for all the engines whose jets reach the ground (up to 4 impact points; the strongest engine's propellant).
// Drawing one per engine overdrew the whole flame channel once per engine: ~6 ms for the Heavy's three on the pad.
// landing dust (airless bodies): one volume for the strongest jet. It starts ~30–40 m up (more for bigger nozzles) and
// thickens as the nozzle comes down; the cleared patch under the nozzle widens as it gets close.
function drawDust(G,hits,VP){let h=null,best=0;for(const x of hits){const k=x.thr*(x.re/.25)**2*sstep(30+40*x.re,2,x.sg);if(k>best){best=k;h=x}}if(!h||best<.01)return;
  const u=PDUST.u,loc=v=>{const d=sub(v,G.O);return[dot(d,G.X),dot(d,G.Y),dot(d,G.Z)]},cl=loc([0,0,0]),ip=loc(h.P),w=Math.min(1.5,best),
    Rd=8+28*w,Hb=2+.12*Rd,lo=[ip[0]-Rd*1.6,0,ip[2]-Rd*1.6],hi=[ip[0]+Rd*1.6,Hb,ip[2]+Rd*1.6],
    inside=cl[0]>lo[0]&&cl[0]<hi[0]&&cl[1]>lo[1]&&cl[1]<hi[1]&&cl[2]>lo[2]&&cl[2]<hi[2],sl=[dot(SUN,G.X),dot(SUN,G.Y),dot(SUN,G.Z)];
  gl.useProgram(PDUST.p);gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniform1f(u.uFc,FC);gl.uniform1f(u.uT,performance.now()/1000%1000);
  gl.uniformMatrix4fv(u.uM,false,mat4(G.X,G.Y,G.Z,G.O));gl.uniform3fv(u.uLo,lo);gl.uniform3fv(u.uHi,hi);gl.uniform3fv(u.uCam,cl);gl.uniform1f(u.uIn,inside?1:0);
  gl.uniform4f(u.uIP,ip[0],ip[2],w,h.re*2+.15*h.sg);gl.uniform1f(u.uRd,Rd);gl.uniform3fv(u.uSunL,sl);gl.uniform3f(u.uAlb,.78,.76,.72);gl.uniform1f(u.uLit,4*Math.max(0,sl[1])+.05);
  gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_3D,PNOISE);gl.uniform1i(u.uN,7);gl.activeTexture(gl.TEXTURE0);
  gl.cullFace(inside?gl.FRONT:gl.BACK);gl.bindVertexArray(VBOX.vao);gl.drawArrays(gl.TRIANGLES,0,VBOX.n);gl.bindVertexArray(PLUME.vao);gl.useProgram(PPLUME.p)}
const IPA=new Float32Array(16);
function drawImpact(G,hits,VP){const u=PIMP.u;gl.useProgram(PIMP.p);gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniform1f(u.uFc,FC);gl.uniform1f(u.uT,performance.now()/1000%1000);
  gl.uniformMatrix4fv(u.uM,false,mat4(G.X,G.Y,G.Z,G.O));gl.bindVertexArray(VBOX.vao);
  const loc=v=>{const d=sub(v,G.O);return[dot(d,G.X),dot(d,G.Y),dot(d,G.Z)]},cl=loc([0,0,0]);
  hits.sort((a,b)=>b.w*b.re*b.re-a.w*a.re*a.re);const H4=hits.slice(0,4),top=H4[0],P=top.P2;
  let lo=[1e9,0,1e9],hi=[-1e9,0,-1e9],W=0,re=0,ig=[0,0,0,0];IPA.fill(0);
  H4.forEach((h,k)=>{const ip=loc(h.P),Rs=h.re*9,w=Math.max(h.w,.7*(h.ig?h.ig[3]:0));IPA.set([ip[0],ip[2],w,0],k*4);
    lo=[Math.min(lo[0],ip[0]-Rs),0,Math.min(lo[2],ip[2]-Rs)];hi=[Math.max(hi[0],ip[0]+Rs),Math.max(hi[1],h.re*4+(G.pad?5:2)),Math.max(hi[2],ip[2]+Rs)];
    W=Math.max(W,w);re=Math.max(re,h.re);if(h.ig)for(let c=0;c<4;c++)ig[c]=Math.max(ig[c],h.ig[c])});
  if(G.pad){lo[0]=Math.min(lo[0],-4.2);hi[0]=Math.max(hi[0],4.2);hi[2]=Math.max(hi[2],38)}
  const inside=cl[0]>lo[0]&&cl[0]<hi[0]&&cl[1]>lo[1]&&cl[1]<hi[1]&&cl[2]>lo[2]&&cl[2]<hi[2];
  gl.uniform3fv(u.uLo,lo);gl.uniform3fv(u.uHi,hi);gl.uniform3fv(u.uCam,cl);gl.uniform1f(u.uIn,inside?1:0);gl.uniform4fv(u['uIP[0]'],IPA);gl.uniform1i(u.uNH,H4.length);
  gl.uniform3fv(u.uCo,P.co);gl.uniform3fv(u.uMa,P.ma);gl.uniform3fv(u.uVa,P.va);gl.uniform3fv(u.uSo,P.so);gl.uniform4fv(u.uK,P.K);gl.uniform1f(u.uOp,P.op);
  gl.uniform4fv(u.uIg,ig);gl.uniform1f(u.uI,1);gl.uniform1f(u.uW,Math.min(1.3,W*(.7+.3*H4.length)));gl.uniform1f(u.uCh,G.pad?1:0);gl.uniform1f(u.uRe,re);
  gl.cullFace(inside?gl.FRONT:gl.BACK);gl.bindVertexArray(VBOX.vao);gl.drawArrays(gl.TRIANGLES,0,VBOX.n);
  gl.bindVertexArray(PLUME.vao);gl.useProgram(PPLUME.p)}
const SPOOL=new WeakMap();
// the spool: the plume follows the throttle with a lag (0.12 s; 0.3 s while starting); a start from (near) zero stamps the
// ignition time sp.ig, which drives the igniter flash and the fuel-rich start (ignOf)
// on = the engine is still burning (in activeEngines); an engine that stops (cutoff, flameout) keeps a decaying plume, and
// the moment its target drops to zero stamps sp.off, the cutoff clock for the tail-off (ignOf) and a smoke puff
function spoolOf(e,on=true){let sp=SPOOL.get(e);if(!sp)SPOOL.set(e,sp={k:0,t:simT,ig:-1e9,off:-1e9,tg:0});const dt=clamp(simT-sp.t,0,5);sp.t=simT;
  const tg=on?(e.les?1:S.throttle):0;if(sp.k<.02&&tg>0)sp.ig=simT;if(sp.tg>0&&tg<=0&&sp.k>.2){sp.off=simT;cutoffPuff(e)}sp.tg=tg;
  const a=simT-sp.ig;sp.k+=(tg-sp.k)*(1-Math.exp(-dt/(tg<sp.k?.22:a<.6?.3:.12)));return sp}
// the engines whose plume shows: the burning ones, and stopped ones still tailing off: [[engine, burning]]
function plumeEngines(){const A=S.alive?activeEngines(S):[],out=A.map(e=>[e,true]);
  for(const p of S.parts)if(p.on&&p.d.kind==='engine'&&!A.includes(p)){const sp=SPOOL.get(p);if(sp&&sp.k>.005)out.push([p,false])}
  for(const p of S.parts)if(p.on&&p.d.kind==='les')for(const z of lesNozzles(p)){const sp=SPOOL.get(z),on=S.lesT>0;if(on||sp&&sp.k>.005)out.push([z,on])}
  return out}
// the escape tower's motor: four nozzles round the bottom of its motor housing (1.33 m up the tower, r 0.26 m), canted 35°
// outward so the jets clear the capsule. Plume-only stand-ins shaped like engines (the part mesh has no nozzles).
const LESN=new WeakMap();
function lesNozzles(p){let z=LESN.get(p);if(z)return z;const a=35/57.2958,d={key:'les',kind:'engine',exit:.1,ispA:250,ispV:270};
  z=[0,1,2,3].map(k=>{const t=k*Math.PI/2+Math.PI/4,c=Math.cos(t),s=Math.sin(t);
    return{les:true,i:900+k,d,pos:[p.pos[0]+.26*c,0,p.pos[2]+.26*s],y0:p.y0+1.33,tdir:norm([-Math.sin(a)*c,Math.cos(a),-Math.sin(a)*s])}});
  LESN.set(p,z);return z}
// the escape motor's smoke: dense white puffs laid along each jet while it burns (air only)
let lesAcc=0;
function emitLesSmoke(dt){const les=S.parts.find(p=>p.on&&p.d.kind==='les');if(!les||S.body!==TELLUS)return;const h=len(S.r)-TELLUS.R,rho=density(TELLUS,h);if(rho<.02)return;
  const sp=len(sub(S.v,surfVel(TELLUS,S.r))),s0=.7+sp*.012,gap=Math.max(.004,.3*s0/Math.max(sp,1));   // spaced by distance, like the main trail
  lesAcc+=dt;while(lesAcc>gap){lesAcc-=gap;for(const z of lesNozzles(les)){if(smoke.length>2500)smoke.shift();const R=Math.random,dir=qrot(S.q,mul(z.tdir,-1)),
      at=add(S.r,qrot(S.q,[z.pos[0]-S.cm[0],z.y0-S.cm[1],z.pos[2]-S.cm[2]])),pw=madd(at,dir,1.5+3*R());
    smoke.push({pf:toPF(TELLUS,pw,simT),t0:simT,s0:s0*(.8+.4*R()),grow:3+2*R(),a0:.7*clamp(rho*1.1,.3,1),life:40+30*R(),rise:.3*R(),seed:R()*97})}}}
// cutoff: a puff of unburnt propellant at the nozzle (kerolox: a dark sooty one), carried with the ship
function cutoffPuff(e){if(S.body!==TELLUS)return;const P=PROPS[pfxOf(e.d).prop]||PROPS.kerolox,n=Math.round(4+8*(P.tail||.3)),
    at=add(S.r,qrot(S.q,[e.pos[0]-S.cm[0],e.y0-S.cm[1]-e.d.exit,e.pos[2]-S.cm[2]])),dn=qrot(S.q,[0,-1,0]),pa=pressure(TELLUS,len(S.r)-TELLUS.R);
  for(let i=0;i<n;i++){const R=Math.random,j=[R()-.5,R()-.5,R()-.5];
    fxPuff(madd(at,j,e.d.exit),add(S.v,add(mul(dn,6+10*R()),mul(j,4))),{s0:e.d.exit*(1+R()),grow:2+3*R()*(1+2*(1-pa)),a0:.35+.3*(P.tail||.3),life:2+3*R()*pa+1,hot:.4})}}
// a puff that travels with a velocity (inertial frame, Tellus-centred) instead of hanging in the air: separation gas,
// cutoff puffs, sparks. hot = how much it glows (sparks ~1)
function fxPuff(r,v,o){if(smoke.length>2500)smoke.shift();smoke.push({iv:true,r0:r,v,t0:simT,s0:o.s0,grow:o.grow,a0:o.a0,life:o.life,hot:o.hot||0,rise:0,seed:Math.random()*97})}

// [igniter colour × flash strength, richness] for an engine's current age since ignition
function ignOf(e,P){const sp=SPOOL.get(e),a=sp?simT-sp.ig:1e9,ao=sp?simT-sp.off:1e9;if(a>3&&ao>3)return[0,0,0,0];const T=P.igT||.1,
    fl=a<0||a>3?0:Math.exp(-a/T)*sstep(0,.02,a)*1.4,rich=a>3?0:sstep(0,.05,a)*Math.exp(-a/(P.rich||.2)),
    tail=ao<0||ao>3?0:sstep(0,.04,ao)*Math.exp(-ao/.5)*(P.tail||.3)*1.4;   // the tail-off: the dying flame goes fuel-rich
  return[P.ig[0]*fl,P.ig[1]*fl,P.ig[2]*fl,Math.max(rich,tail)]}

// the plume's bounding size for an exit radius, throttle and ambient pressure (atm): [n, spread tan, length, radius]
function plumeShape(d,thr,pa){const f=pfxOf(d),re=d.exit,n=f.pe/Math.max(pa,1e-5),tn=.03+.52*sstep(0,2.5,Math.log10(Math.max(n,1))),
    L=re*(10+12*thr)*(1+1.4*(1-pa)),rb=re*Math.sqrt(clamp(n,.3,1))+L*(tn+.035*pa);return[n,tn,L,rb*1.12+re*.3]}
const FIRE=(()=>{const a=[],pr=[];for(let i=0;i<=10;i++){const t=i/10*Math.PI;pr.push([Math.sin(t),-Math.cos(t),[1,.55+.3*Math.sin(t),.15]])}lathe(a,pr,[0,0,0],18,[false,false]);return makeMesh(a)})();
// a cold-gas puff: a faint white cone, tip at the nozzle, pointing down −Y (drawn additively, so it reads as glow)
const PUFF=(()=>{const a=[];lathe(a,[[0,0,[.9,.92,.95]],[.5,-.45,[.55,.58,.62]],[0,-1,[.2,.21,.23]]],[0,0,0],12,[false,false]);return makeMesh(a)})();
const CANOPY=(()=>{const a=[];lathe(a,[[1,0,C.O],[.92,.35,C.O],[.92,.35,C.W],[.7,.7,C.W],[.7,.7,C.O],[.38,.92,C.O],[0,1,C.W]],[0,0,0],24,[false,false]);return makeMesh(a)})();
// a straight tube from A to B (struts, pipes, masts, legs): seg sides, optional flat end caps
function tube(out,A,B,r,col,seg=6,caps=false){const d=sub(B,A),L=len(d),Y=mul(d,1/L),X=norm(cross(Math.abs(Y[1])<.9?[0,1,0]:[1,0,0],Y)),Z=cross(X,Y);
  const N=a=>add(mul(X,Math.cos(a)),mul(Z,Math.sin(a))),P=(a,y)=>add(add(A,mul(Y,y)),mul(N(a),r));
  for(let j=0;j<seg;j++){const a0=j/seg*6.2832,a1=(j+1)/seg*6.2832;for(const[a,y]of[[a0,0],[a0,L],[a1,L],[a0,0],[a1,L],[a1,0]])pv(out,P(a,y),N(a),col)}
  if(caps)for(const[y,s]of[[0,-1],[L,1]])for(let j=0;j<seg;j++){const a0=j/seg*6.2832,a1=(j+1)/seg*6.2832,n=mul(Y,s);pv(out,add(A,mul(Y,y)),n,col);pv(out,P(a0,y),n,col);pv(out,P(a1,y),n,col)}}
// an open lattice tower, w square and H tall at (x, z): corner posts, a girder ring every ~2.5 m, a zig-zag brace per bay
function lattice(out,x,z,w,H,col){const c=[[x-w/2,z-w/2],[x+w/2,z-w/2],[x+w/2,z+w/2],[x-w/2,z+w/2]],n=Math.round(H/2.5);
  for(const[a,b]of c)tube(out,[a,0,b],[a,H,b],.12,col);
  for(let i=0;i<=n;i++){const y=i*H/n;for(let k=0;k<4;k++){const[a,b]=c[k],[a2,b2]=c[(k+1)%4];tube(out,[a,y,b],[a2,y,b2],.07,col,5)}}
  for(let i=0;i<n;i++){const y0=i*H/n,y1=(i+1)*H/n;for(let k=0;k<4;k++){const[a,b]=c[k],[a2,b2]=c[(k+1)%4],f=(i+k)%2;tube(out,[a,f?y0:y1,b],[a2,f?y1:y0,b2],.05,col,4)}}}
// a flat strip on the ground from A to B ((x, z) pairs), w wide and h tall: roads, rail beds, slab paths, cable trenches
function strip(out,A,B,w,h,col){const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,nx=-uz,nz=ux;
  const P=(t,s,y)=>[A[0]+ux*t+nx*s*w/2,y,A[1]+uz*t+nz*s*w/2],q=(p,n)=>{for(const i of[0,1,2,0,2,3])pv(out,p[i],n,col)};
  q([P(0,-1,h),P(L,-1,h),P(L,1,h),P(0,1,h)],[0,1,0]);for(const s of[-1,1])q([P(0,s,0),P(L,s,0),P(L,s,h),P(0,s,h)],[nx*s,0,nz*s])}
// The launch complex, in the pad's frame (x east, y up, z south; the rocket stands at the origin and flies east, so the
// control side is up-range to the west). Everything sits at or above the ground, which the sky shader draws; near the
// pad the buildings stand on the concrete it paints (padGround: apron r 40, slabs at (36,18), (−45,−25), (20,−30), the
// road leaving to the north-west). Further out, slabs, rail beds and roads are thin meshes. TH is the umbilical tower's
// height (sized to the rocket); the service gantry and the lightning masts scale with it. Early-era Cape style.
function buildPad(TH,sch=0){const a=[],OR=[.78,.3,.12],CO=[.48,.47,.44,2],STL=[.45,.46,.48,1],DK=[.1,.1,.1,2],AS=[.06,.06,.065,2],W=C.W;
  if(sch===1)steppeTable(a,CO,STL,DK);else{   // (the pad per school, Q159: Steppe's below)
  // launch table: the concrete pad, a steel flame grate under the engines with radial bars, four hold-down posts
  lathe(a,[[7,-.8,[.3,.29,.28,2]],[7,.02,[.3,.29,.28,2]]],[0,0,0],36);lathe(a,[[2.6,.02,[.05,.05,.05,1]],[2.6,.035,[.05,.05,.05,1]]],[0,0,0],32);
  for(let i=0;i<8;i++)rbox(a,[0,.05,0],2.6,.02,.06,STL,i*Math.PI/8);
  // (the four hold-down posts are in the rig, buildRig: they move to clear the rocket's boosters)
  // flame channel running south: low sooted walls on a dark floor (the ground itself can't be dug)
  for(const s of[-1,1])box(a,[3.4*s,.6,21],.4,.6,14.5,CO);box(a,[0,.012,21],3,.01,14.5,DK);
  // the umbilical tower: an orange lattice east of the rocket, a cap platform, a hammerhead jib, a lightning mast, the
  // elevator shaft (its swing arms move, so they are in the rig)
  const TX=7,TW=3;lattice(a,TX,0,TW,TH,OR);box(a,[TX,TH+.15,0],TW/2+.6,.15,TW/2+.6,STL);
  box(a,[TX-2,TH+1.2,0],3.5,.25,.25,OR);tube(a,[TX-5.3,TH+1.2,0],[TX-5.3,TH-1.5,0],.03,DK,4);tube(a,[TX,TH+.3,0],[TX,TH+8,0],.08,STL,6);
  box(a,[TX,TH/2,0],.5,TH/2,.5,[.22,.23,.25,1]);
  // the service gantry's twin rails, from the launch table to its parking spot ~80 m north (the gantry is in the rig)
  for(const x of[-PAD_GX,PAD_GX]){strip(a,[x,5],[x,-118],1.6,.05,CO);strip(a,[x-.25,5],[x-.25,-118],.12,.17,STL);strip(a,[x+.25,5],[x+.25,-118],.12,.17,STL)}}
  // propellant farm on its slab: a LOX sphere on legs, a horizontal RP-1 tank on saddles, both feeding the pad by pipe
  {const pr=[];for(let i=0;i<=14;i++){const t=-Math.PI/2+i/14*Math.PI;pr.push([4.5*Math.cos(t),6+4.5*Math.sin(t),W])}lathe(a,pr,[33,0,13],24,[false,false]);
   for(let i=0;i<6;i++){const t=i/6*6.2832;tube(a,[33+5*Math.cos(t),0,13+5*Math.sin(t)],[33+4.4*Math.cos(t),6,13+4.4*Math.sin(t)],.18,STL,6)}}
  tube(a,[33,2.3,24],[45,2.3,22],2,W,20,true);for(const x of[35,39,43])box(a,[x,.6,23.7-(x-33)/6],.3,.6,1.4,CO);
  tube(a,[33,.4,9],[4,.4,4.2],.25,STL,8);tube(a,[35,.35,21],[4.2,.35,2.6],.2,STL,8);
  // high-pressure gas storage on the west slab: three racks of long nitrogen/helium bottles, four across and three high;
  // its line to the pad runs in a covered trench, flush enough for the gantry's trucks to roll over
  for(const z of[-33,-25,-17]){for(let r=0;r<3;r++)for(let c=0;c<4;c++)tube(a,[-52,.6+r*.95,z-1.4+c*.95],[-38,.6+r*.95,z-1.4+c*.95],.42,[.74,.74,.7],10,true);
    for(const x of[-50,-45,-40])box(a,[x,1.5,z],.15,1.5,2.1,STL)}
  strip(a,[-38,-25],[-5,-2],.6,.06,DK);
  // deluge water: a ground tank and its pump house by the south-west edge of the apron, piped to the flame channel
  lathe(a,[[10,.025,CO],[10,.045,CO]],[-28,0,30],28);lathe(a,[[6,0,W],[6,8,W],[5.6,8.6,W],[0,9.4,W]],[-28,0,30],28,[false,false]);
  box(a,[-19,1.6,25],2.5,1.6,2,[.66,.64,.58,2]);box(a,[-19,3.3,25],2.7,.1,2.2,C.D);tube(a,[-17,.4,24],[-3.2,.4,9],.3,STL,8);
  // two lightning masts with a catenary wire across the pad
  for(const[x,z]of[[-14,12],[14,-14]])tube(a,[x,0,z],[x,TH+12,z],.22,[.6,.6,.62,1],8);tube(a,[-14,TH+11.5,12],[14,TH+11.5,-14],.02,DK,4);
  // the compressor/power building on the small slab
  box(a,[20,2,-30],4.5,2,3,[.68,.66,.6,2]);box(a,[20,4.1,-30],4.7,.1,3.2,C.D);
  // camera bunkers ringed ~90 m out (slit window facing the pad) and two camera towers with a hut on top
  for(const deg of[20,60,130,-30,-150]){const t=deg*Math.PI/180,x=90*Math.cos(t),z=90*Math.sin(t),ph=Math.atan2(-z,-x);
    rbox(a,[x,1,z],1.3,1,1.1,[.55,.54,.5,2],-ph);rbox(a,[x-Math.cos(t)*1.12,1.35,z-Math.sin(t)*1.12],.02,.12,.8,DK,-ph)}
  for(const deg of[100,-60]){const t=deg*Math.PI/180,x=70*Math.cos(t),z=70*Math.sin(t);lattice(a,x,z,1.6,10,STL);box(a,[x,11,z],1.4,1,1.4,[.6,.6,.58,2]);box(a,[x,12.05,z],1.6,.08,1.6,C.D)}
  // the blockhouse, up-range ~230 m west: a thick concrete dome on its own slab with a band of periscope slots and an
  // antenna mast, a spur road down to the access road, and a flush cable trench running to the pad
  {const BX=-230,BZ=-60;lathe(a,[[26,.03,CO],[26,.05,CO]],[BX,0,BZ],40);
   lathe(a,[[11,0,CO],[11,1.8,CO],[11,1.8,DK],[10.8,2.4,DK],[10.8,2.4,CO],[9.6,5,CO],[7.5,7.4,CO],[4.5,8.9,CO],[0,9.6,CO]],[BX,0,BZ],36,[false,false]);
   tube(a,[BX,9.5,BZ],[BX,16,BZ],.06,STL,4);strip(a,[BX,BZ-26],[BX,-194],6,.04,AS);strip(a,[BX+24,BZ+4],[-7,-2],.7,.08,CO)}
  // floodlight poles around the apron, their heads aimed at the pad (lit at night: PAD_LIGHTS, padLights, PAD_GLOW)
  for(const[x,z]of PAD_LIGHTS){tube(a,[x,0,z],[x,16,z],.15,STL,6);box(a,[x,16.4,z],.8,.4,.3,C.D)}
  return makeMesh(a)}
// ---- the pad per school (QUEUE Q159, Q102 step 7; POWERS.md § Schools). A site's pad is built in its owner's school
// (a sea platform: home's), SCHOOL_FORCE overriding as for parts. Cape is the complex above. Steppe has no tower: the
// rocket is rolled out lying on a transporter-erector, raised over a flame pit and left hanging in the launch table's
// four support arms, which fall back outward at lift-off; two cable masts fall back with them, and the two halves of
// the service structure, closed round the rocket at the start of a flight, fold down to the ground east and west.
// The pit can't be dug (the ground is the sky shader's), so its mouth is a near-black floor inside parapet walls, as
// Cape's flame channel, opening south down a sooted slope. The erector's rail line runs north to the assembly hall.
const PIT_W=6.5;   // the pit's half-width (m): the table ring sits over it, the service halves hinge beyond it
function steppeTable(a,CO,STL,DK){const PIT=[.012,.012,.014,2],GL=[.64,.62,.57,2],zN=-PIT_W;
  box(a,[0,.016,(zN+26)/2],PIT_W,.012,(26-zN)/2,PIT);   // the pit's mouth
  for(const s of[-1,1]){const x=(PIT_W+.4)*s;box(a,[x,.55,(zN+26)/2],.4,.55,(26-zN)/2+.4,CO);tube(a,[x,1.75,zN-.4],[x,1.75,26],.04,STL,4);
    for(let z=zN;z<=26;z+=3.4)tube(a,[x,1.1,z],[x,1.75,z],.04,STL,4)}
  box(a,[0,.55,zN-.4],PIT_W+.8,.55,.4,CO);tube(a,[-PIT_W-.4,1.75,zN-.4],[PIT_W+.4,1.75,zN-.4],.04,STL,4);
  box(a,[0,.012,33],PIT_W,.01,7,DK);   // the sooted slope below the mouth, where the flame leaves the pit
  // the erector's rail line, north to the hall: a ballast bed, two rails, sleepers
  strip(a,[0,zN-1],[0,-122],5,.05,[.3,.29,.27,2]);for(const x of[-1.6,1.6])strip(a,[x,zN-1],[x,-122],.12,.2,STL);
  for(let z=zN-3;z>-122;z-=4)box(a,[0,.08,z],2.2,.03,.15,[.2,.18,.16,2]);
  // the horizontal assembly hall: the rocket is put together lying down and leaves through the door facing the pad
  box(a,[0,8,-152],13,8,30,GL);box(a,[0,16.2,-152],13.4,.2,30.4,C.D);box(a,[0,6.5,-121.9],7,6.5,.1,[.16,.17,.18,2])}
// the school a site's pad is built in, and the mesh it draws (the current site's is sized to the rocket, padSync; any
// other site in another school gets a default-height one, built once)
const padSchoolOf=t=>SCHOOL_FORCE!=null?SCHOOL_FORCE:schoolOf(t&&t.power!=null?t.power:HOME);
const PADX={};function padFor(t){const k=padSchoolOf(t);return k===padSch?PAD:PADX[k]||(PADX[k]=buildPad(32,k))}
const PAD_GX=10.5,PAD_LIGHTS=[0,1,2,3].map(i=>{const t=.9+i*Math.PI/2;return[34*Math.cos(t),34*Math.sin(t)]});
// what glows at night: the lamp faces, and the pools of light they throw on the ground around the pad (the ground is the
// sky shader's, so the pools are additive discs just above it, drawn in the glow pass)
const PAD_GLOW=(()=>{const a=[],L=[1,.9,.72];for(const[x,z]of PAD_LIGHTS){const d=Math.hypot(x,z),ux=-x/d,uz=-z/d;
    box(a,[x+ux*.32,16.4,z+uz*.32],.7,.32,.7,L);lathe(a,[[0,.08,[.3,.27,.2]],[9,.08,[.17,.15,.11]],[20,.08,[0,0,0]]],[x*.42,0,z*.42],32,[false,false])}
  return makeMesh(a)})();
// The moving parts of the pad, each built in its own frame so animating it is just a matrix: three swing arms hinged at
// the tower's west face (pointing west at angle 0, folded north along the face at 90°), four hold-down arms pivoting on
// their table posts, and the mobile service gantry rolling along its rails. rig (padRig) says where the rocket is.
function buildRig(TH,rig,sch=0){if(sch===1)return steppeRig(TH,rig);const OR=[.78,.3,.12],RD=[.6,.16,.1],STL=[.45,.46,.48,1],DK=[.1,.1,.1,2],x0=7-1.5;
  const arms=[.3,.55,.8].map((f,i)=>{const h=Math.round(TH*f),xr=rig&&rig.xs[i],L=xr!=null?x0-(xr+.12):4.8,a=[];
    box(a,[-L/2,0,0],L/2,.35,.45,OR);box(a,[-L-.05,-.1,0],.05,.45,.35,STL);tube(a,[-.6,-.35,.3],[-L-.3,-.55,.3],.07,DK,6);return{mesh:makeMesh(a),h,reach:xr!=null}});
  // the crew access arm (Q195): a walkway with railings to the capsule's hatch, hinged on the tower like the swing arms
  // (west at angle 0); a swing arm within 1.6 m of it stands down. The crew stand on it in the Assembly (app/crew-look.js)
  let crew=null,crewFig=null;if(rig&&rig.crew&&rig.crew.x!=null){const h=rig.crew.h,L=Math.max(1.5,x0-(rig.crew.x+.15)),a=[],GR=[.4,.41,.42,1];
    box(a,[-L/2,-.06,0],L/2,.06,.8,GR);box(a,[-L/2,-.3,0],L/2,.18,.12,OR);
    for(const z of[-.8,.8]){tube(a,[0,1.05,z],[-L,1.05,z],.025,OR,4);tube(a,[0,.55,z],[-L,.55,z],.02,OR,4);for(let x=0;x>=-L-.01;x-=Math.min(1.2,L/2))tube(a,[x,0,z],[x,1.05,z],.025,OR,4)}
    crew={mesh:makeMesh(a),h,L};for(const A of arms)if(Math.abs(A.h-h)<1.6)A.skip=true;crewFig=typeof crewMeshes==='function'?crewMeshes(rig.crew.n,sch):null}
  // hold-downs: from the posts up to clamps on the rocket's base, above its engines (in the editor the ship hangs higher,
  // as in an assembly hall, and they become the launch stool it stands on)
  // Where they stand comes from padRig (rig.hold): turned off the diagonals if boosters sit there, each clamping the outermost
  // part on its line, its post 1.2 m beyond. With no rocket the posts stand on the diagonals at 3.4 m.
  const HD=rig?rig.hold:{t:[0,1,2,3].map(i=>Math.PI/4+i*Math.PI/2),rp:[3.4,3.4,3.4,3.4]},pa=[];
  HD.t.forEach((t,i)=>box(pa,[HD.rp[i]*Math.cos(t),.25,HD.rp[i]*Math.sin(t)],.3,.25,.3,STL));const posts=makeMesh(pa);
  const holds=rig?[0,1,2,3].map(i=>{const t=HD.t[i],c=Math.cos(t),sn=Math.sin(t),y=rig.base+rig.hE*.85,r=HD.r[i],P=[HD.rp[i]*c,.45,HD.rp[i]*sn],a=[];
    const E=[r*c-P[0],y-P[1],r*sn-P[2]];tube(a,[0,0,0],E,.14,STL,8);box(a,add(E,[.1*c,0,.1*sn]),.18,.22,.18,OR);return{mesh:makeMesh(a),P,k:[-sn,0,c]}}):[];
  // the gantry, centred on z = 0 here: four lattice columns on rail trucks, work decks across its back half (the open
  // front closes around the rocket in service position), girders, a roof, a bridge crane
  const g=[],GH=TH+6,GX=PAD_GX,z0=-6,z1=6;
  for(const x of[-GX,GX])for(const z of[z0,z1]){lattice(g,x,z,2.2,GH,RD);box(g,[x,.45,z],1.4,.3,1.8,STL)}
  for(let y=6;y<GH-2;y+=6)box(g,[0,y,z0+3.5],GX+1.1,.15,3.5,[.5,.5,.48]);
  // girders: across the back, and along each side; none across the open front, which rolls past the rocket (PLAYTEST #2)
  for(const y of[GH*.33,GH*.66]){box(g,[0,y,z0],GX,.25,.25,RD);for(const x of[-GX,GX])box(g,[x,y,(z0+z1)/2],.25,.25,(z1-z0)/2,RD)}
  box(g,[0,GH+.25,0],GX+1.2,.25,7,RD);box(g,[0,GH+1.5,0],1,1,5,STL);box(g,[0,GH+2.6,3],.4,.15,4,RD);
  // service position: the decks (front edge at z = 1 here) stop 0.5 m short of the stack's widest reach, boosters included
  const gantry=makeMesh(g),zS=Math.min(-3.3,-((rig?rig.zr:R0)+1.5));
  return{arms,holds,posts,gantry,zS,crew,crewFig,free(){for(const x of arms)x.mesh.free();for(const x of holds)x.mesh.free();posts.free();gantry.free();if(crew)crew.mesh.free();if(crewFig)for(const x of crewFig)x.mesh.free()}}}
// Steppe's moving parts (Q159), each in its own frame like Cape's: the table ring (fixed), four support arms pivoting on
// it and leaning in to clamp the rocket a third of the way up (holds; the same angles as Cape's hold-downs, so they miss
// the boosters), two cable masts north of the ring (arms), one service half (gantry, drawn twice: east, and turned 180°
// west), and the transporter-erector: its rail car and its boom, hinged at the car's south end, with cradle arms that
// reach to the rocket. rig.st and rig.prof come from padRig.
function steppeRig(TH,rig){const STL=[.42,.44,.45,1],SG=[.6,.63,.64,1],ER=[.32,.4,.31,1],DK=[.1,.1,.1,2],OR=[.78,.3,.12];
  const ext=rig?rig.ext:R0,base=rig?rig.base:0,L=rig?rig.L:20,st=rig?rig.st:{hc:6,t:[0,1,2,3].map(i=>Math.PI/4+i*Math.PI/2),r:[R0,R0,R0,R0]};
  const rp=st.r.map(r=>Math.max(r+Math.max(1.6,.15*st.hc),ext+1)),ri=ext+.5,ro=Math.max(...rp)+.8;
  // the ring, and two girders carrying it to the pit's walls
  const pa=[];lathe(pa,[[ri,0,STL],[ro,0,STL],[ro,.5,STL],[ri,.5,STL],[ri,0,STL]],[0,0,0],48,[false,false]);
  if(ro<PIT_W)for(const s of[-1,1])box(pa,[s*(ro+PIT_W)/2,.3,0],(PIT_W-ro)/2+.3,.3,.6,STL);const posts=makeMesh(pa);
  const holds=st.t.map((t,i)=>{const c=Math.cos(t),sn=Math.sin(t),P=[rp[i]*c,.5,rp[i]*sn],E=[(st.r[i]+.15)*c-P[0],st.hc-.5,(st.r[i]+.15)*sn-P[2]],k=[-sn,0,c],a=[];
    const n=Math.max(2,Math.round(len(E)/1.4));for(const o of[-.3,.3])tube(a,mul(k,o),add(E,mul(k,o*.5)),.09,STL,6);
    for(let j=0;j<n;j++){const A=mul(E,j/n),B=mul(E,(j+1)/n),f=j%2?.3:-.3;tube(a,add(A,mul(k,f*(1-.5*j/n))),add(B,mul(k,-f*(1-.5*(j+1)/n))),.05,STL,4)}
    box(a,add(E,[.12*c,0,.12*sn]),.2,.35,.2,OR);box(a,[.7*c,-.05,.7*sn],.45,.4,.45,DK);   // the clamp shoe; the counterweight behind the pivot
    return{mesh:makeMesh(a),P,k}});
  // the cable masts: lattices north of the ring, an arm from the top to the rocket's side; they fall back north
  const hm=base+L*.55,zm=Math.max(ro+1.2,PIT_W+.4),arms=[-1,1].map(sx=>{const P=[sx*3.2,0,-zm],a=[];lattice(a,0,0,1.1,hm,STL);
    const rT=rig?Math.max(rig.rAt(hm-.6),rig.rAt(hm-.4),rig.rAt(hm-.2)):R0,d=norm([P[0],0,P[2]]),Q=mul(d,rT+.25);tube(a,[0,hm-.4,0],[Q[0]-P[0],hm-.4,Q[2]-P[2]],.12,STL,6);return{mesh:makeMesh(a),P}});
  // a service half: lattice columns at its outer (hinge) side on the pit's edge, open grating decks every 5 m reaching in
  // to the rocket (solid decks folded down read as walls), a roof
  const xh=Math.max(ext+3.5,PIT_W+1.2),D=xh-(ext+.5),g=[];for(const z of[-3,3])lattice(g,-1,z,2,TH,SG);
  for(let y=5;y<TH-1;y+=5){for(const z of[-3.6,3.6])tube(g,[0,y,z],[-D,y,z],.07,SG,4);for(let x=-.6;x>=-D;x-=1.2)tube(g,[x,y,-3.6],[x,y,3.6],.05,SG,4);tube(g,[-D,y,-3.6],[-D,y,3.6],.07,SG,4)}
  box(g,[-1,TH+.2,0],1.6,.2,4,SG);
  // the erector: a car on the rails north of the ring, and the boom (raised in the editor: the rocket just stood up)
  const zb=Math.max(ro+1,PIT_W+1),Lb=L+base+1,c=[],b=[];box(c,[0,.7,-(zb+Lb/2)],1.9,.5,Lb/2,ER);box(c,[0,1.3,-(zb+1)],1.6,.3,1,ER);
  for(const x of[-1,1])tube(b,[x,0,0],[x,Lb,0],.14,ER,6);for(let y=0;y<Lb;y+=2.5)tube(b,[-1,y,0],[1,y+1.25,0],.06,ER,4);
  for(let y=4;y<Lb-1;y+=7){const r=rig?Math.max(rig.rAt(y+1.2),rig.rAt(y+1.4),rig.rAt(y+1.6)):R0;if(r<=0)continue;const rch=zb-r-.25;tube(b,[0,y,0],[0,y,rch],.12,ER,6);box(b,[0,y,rch],1,.2,.1,ER)}
  const car=makeMesh(c),boom=makeMesh(b),gantry=makeMesh(g);
  return{sch:1,arms,holds,posts,gantry,car,boom,xh,bP:[0,1.4,-zb],zS:0,free(){for(const x of arms)x.mesh.free();for(const x of holds)x.mesh.free();posts.free();gantry.free();car.free();boom.free()}}}
// The tower is sized to the rocket standing on the pad (or being built): about 3 m above its top, in whole lattice bays,
// 12.5–60 m. While a rocket stands there (or is being built) the pad holds it: swing arms reach from the tower to the
// widest thing at each arm's height (boosters included), and hold-downs clamp its base. Ship x is pad x (east) here.
let PAD=buildPad(32),RIG=buildRig(32,null),padTH=32,padSch=0,padKey='',padShip=null,padMode=null,padT0=-1e9,padNight=0;
function padRig(TH){const base=mode==='editor'?(typeof LIFT==='number'?LIFT:3):0,ps=S.parts.filter(p=>p.on);if(!ps.length)return null;
  const bot=ps.filter(p=>p.y0<.01),core=bot.find(p=>Math.abs(p.pos[0])<.05&&Math.abs(p.pos[2])<.05)||bot[0];
  const xAt=h=>{let x=null;for(const p of ps){const y0=p.y0+base;if(h>=y0&&h<=y0+p.h){const e=p.pos[0]+p.d.r;if(x==null||e>x)x=e}}return x};
  const hold=holdPlan(ps,core,base),rB=core?core.d.r:R0;
  // Steppe (Q159): the widest reach, the stack's length, the radius at a height, and where the support arms clamp (radial
  // decouplers are small brackets, not the stack's width: left out)
  const pb=ps.filter(p=>p.d.kind!=='rdec'),rAt=h=>{let m=0;for(const p of pb){const y0=p.y0+base;if(h>=y0&&h<=y0+p.h)m=Math.max(m,Math.hypot(p.pos[0],p.pos[2])+p.d.r)}return m},
    ray=(t,h)=>{const c=Math.cos(t),s=Math.sin(t);let r=0;for(const p of pb){const y0=p.y0+base;if(h<y0||h>y0+p.h)continue;const x=p.pos[0],z=p.pos[2],b=x*c+z*s,D=b*b-(x*x+z*z-p.d.r*p.d.r);if(D>=0)r=Math.max(r,b+Math.sqrt(D))}return r||rB},
    L=Math.max(...pb.map(p=>p.y0+p.h)),hc=base+clamp(L*.3,2.5,18);
  return{base,hE:core?core.h:1,rB,xs:[.3,.55,.8].map(f=>xAt(Math.round(TH*f))),zr:Math.max(...ps.map(p=>Math.abs(p.pos[2])+p.d.r)),hold,
    crew:(c=>c?{n:c.d.crew,h:base+c.y0+c.h*.3,x:xAt(base+c.y0+c.h*.3)}:null)(ps.find(p=>p.d.crew)),   // the hatch (Q195)
    ext:Math.max(...pb.map(p=>Math.hypot(p.pos[0],p.pos[2])+p.d.r)),L,rAt,st:{hc,t:hold.t,r:hold.t.map(t=>ray(t,hc))},prof:Array.from({length:Math.ceil(L/2.5)+1},(_,i)=>rAt(base+i*2.5))}}
// the hold-downs: four arms 90° apart, on the diagonals unless something stands there (boosters at 45°, three at 120°…);
// then the set turns to the angle with the most room between the parts down at clamp height. Each arm clamps the
// outermost part on its line (the core, or a booster if one is in the way) and its post stands 1.2 m beyond, ≥ 3.4 m.
function holdPlan(ps,core,base){const yc=base+(core?core.h:1)*.85,low=ps.filter(p=>p.y0+base<=yc+.3),dir=t=>[Math.cos(t),Math.sin(t)];
  const room=t=>{const[c,s]=dir(t);let m=9;for(const p of low){if(Math.hypot(p.pos[0],p.pos[2])<.05)continue;   // (the core's own stack: that's what it clamps)
      const x=p.pos[0],z=p.pos[2],a=x*c+z*s;m=Math.min(m,(a>0?Math.abs(z*c-x*s):Math.hypot(x,z))-p.d.r)}return m},
    reach=t=>{const[c,s]=dir(t);let r=core?core.d.r:R0;for(const p of low){const x=p.pos[0],z=p.pos[2],b=x*c+z*s,D=b*b-(x*x+z*z-p.d.r*p.d.r);if(D>=0)r=Math.max(r,b+Math.sqrt(D))}return r},
    set=f=>[0,1,2,3].map(i=>Math.PI/4+f+i*Math.PI/2),score=f=>Math.min(...set(f).map(room));
  let f=0;if(score(0)<.3){let best=score(0);for(let k=1;k<90;k++){const g=score(k*Math.PI/180);if(g>best+1e-9){best=g;f=k*Math.PI/180}}}
  const t=set(f),r=t.map(x=>reach(x)+.12);return{f,t,r,rp:r.map(x=>Math.max(3.4,x+1.2))}}
function padSync(){if(!S||!S.parts)return;const pre=mode==='editor'||S.landed&&!S.mkLift;
  // a flight that starts on the pad starts with the gantry in service position; it rolls back from then (padT0)
  if(S!==padShip||mode!==padMode){padShip=S;padMode=mode;padT0=mode==='flight'&&S.landed&&!S.mkLift?simT:-1e9}
  if(!pre)return;   // after liftoff the rig keeps its shape and only animates
  const H=clamp(Math.ceil((S.len+3)/2.5)*2.5,12.5,60),rig=padRig(H),sch=padSchoolOf(curSite());
  const key=H+'|'+sch+'|'+(typeof crewGen==='function'?crewGen():0)+'|'+(rig?[rig.base,rig.hE.toFixed(2),rig.rB,rig.zr.toFixed(2),rig.hold.f.toFixed(3),...rig.hold.r.map(x=>x.toFixed(2)),...rig.xs.map(x=>x==null?'-':x.toFixed(2)),...(rig.crew?['c'+rig.crew.h.toFixed(2)]:[]),...(sch===1?[rig.ext.toFixed(2),rig.L.toFixed(1),...rig.st.r.map(x=>x.toFixed(2)),...rig.prof.map(x=>x.toFixed(2))]:[])].join(','):'free');
  if(key===padKey)return;if(H!==padTH||sch!==padSch){PAD.free();PAD=buildPad(H,sch);padTH=H;padSch=sch}RIG.free();RIG=buildRig(H,rig,sch);padKey=key}
// the frame of the pad the rocket uses (curSite(): every site draws the static pad; the rig and the lights are only at
// this one), with the same axes the pad's own draw uses (siteFrame: e, up, s)
const padPF=()=>{const t=curSite();return mul(t.u,TELLUS.R+t.h)};
function padFrame(camW){const th=bodyTheta(TELLUS,simT),t=curSite(),f=siteFrame(t.u),site=fromPF(TELLUS,mul(t.u,TELLUS.R+t.h),simT);
  return{site,O:sub(site,camW),X:rotY(f.e,th),Y:rotY(f.up,th),Z:rotY(f.s,th)}}
const padW=(F,v)=>add(add(mul(F.X,v[0]),mul(F.Y,v[1])),mul(F.Z,v[2]));
function padMat(F,a,b,c,T){return mat4(padW(F,a),padW(F,b),padW(F,c),add(F.O,padW(F,T)))}
// rotation by ang about the unit axis k (Rodrigues), as the images of x, y, z
function rotAx(k,ang){const c=Math.cos(ang),s=Math.sin(ang),R=v=>{const kv=dot(k,v);return add(add(mul(v,c),mul(cross(k,v),s)),mul(k,kv*(1-c)))};return[R([1,0,0]),R([0,1,0]),R([0,0,1])]}
// Each frame: the rig. Gantry: parked in the editor; on a flight from the pad, rolls from service position (RIG.zS) to
// its parking spot (−80 m) over 14 s. Swing arms: connected until liftoff, then swing back top first, 1.5 s each, 0.25 s
// apart; arms with no rocket at their height stay folded. Hold-downs: tip outward 0.9 rad in 0.6 s at liftoff.
function drawPadRig(drawMesh,camW){const F=padFrame(camW);if(len(F.O)>3e5||HOOK.noRig)return;   // (noRig: views.js close-ups)
  const pre=mode==='editor'||S&&S.landed&&!S.mkLift,tl=S&&S.mkLiftT!=null?simT-S.mkLiftT:1e9;if(RIG.sch===1)return drawSteppeRig(drawMesh,F,pre,tl);
  RIG.arms.forEach((A,i)=>{if(A.skip)return;const u=!A.reach?1:pre?0:clamp((tl-(2-i)*.25)/1.5,0,1),f=sstep(0,1,u)*Math.PI/2;
    drawMesh(A.mesh,padMat(F,[Math.cos(f),0,Math.sin(f)],[0,1,0],[-Math.sin(f),0,Math.cos(f)],[5.5,A.h,0]),F.site)});
  const al=pre?0:-.9*sstep(0,1,clamp(tl/.6,0,1));for(const Hd of RIG.holds){const[a,b,c]=rotAx(Hd.k,al);drawMesh(Hd.mesh,padMat(F,a,b,c,Hd.P),F.site)}
  drawMesh(RIG.posts,padMat(F,[1,0,0],[0,1,0],[0,0,1],[0,0,0]),F.site);
  if(RIG.crew){const f=mode==='editor'?0:Math.PI/2;drawMesh(RIG.crew.mesh,padMat(F,[Math.cos(f),0,Math.sin(f)],[0,1,0],[-Math.sin(f),0,Math.cos(f)],[5.5,RIG.crew.h,0]),F.site)}   // at the hatch in the Assembly; swung back in flight (the crew are aboard)
  const zg=mode==='editor'?-80:RIG.zS+(-80-RIG.zS)*sstep(0,1,clamp((simT-padT0)/14,0,1));drawMesh(RIG.gantry,padMat(F,[1,0,0],[0,1,0],[0,0,1],[0,0,zg]),F.site)}
// Steppe's rig each frame (Q159). Support arms: closed until lift-off, then fall back outward 66° in 1.4 s, starting
// 0.1 s after it (the counterweights take them as the rocket rises). Cable masts: fall back north 0.55 rad in 0.8 s at
// lift-off. Service halves: closed round the rocket when a flight starts on the pad, folding down to the ground over
// 14 s from 2 s in (as Cape's gantry rolls away); down in the editor. Erector: boom up in the editor, down on its car
// in flight.
// The Rollout (Q193, flow, rollPhase in app/rollout.js): the car comes down the rails from the hall's door (rollDz), the
// boom rises from lying on it, and the support arms and masts stand open until the rocket is up, then close on it.
const ROLL_DOOR=121.9;   // the hall's door, m north of the pad (steppeTable)
const rollDz=R=>-(ROLL_DOOR+RIG.bP[2])*(1-R.roll);
function drawSteppeRig(drawMesh,F,pre,tl){const R=typeof rollPhase==='function'?rollPhase():null,dz=R?rollDz(R):0,I=padMat(F,[1,0,0],[0,1,0],[0,0,1],[0,0,0]);
  drawMesh(RIG.posts,I,F.site);drawMesh(RIG.car,padMat(F,[1,0,0],[0,1,0],[0,0,1],[0,0,dz]),F.site);
  const al=R?-1.15*(1-R.arms):pre?0:-1.15*sstep(0,1,clamp((tl-.1)/1.4,0,1));for(const Hd of RIG.holds){const[a,b,c]=rotAx(Hd.k,al);drawMesh(Hd.mesh,padMat(F,a,b,c,Hd.P),F.site)}
  const am=R?-.55*(1-R.arms):pre?0:-.55*sstep(0,1,clamp(tl/.8,0,1));for(const M of RIG.arms){const[a,b,c]=rotAx([1,0,0],am);drawMesh(M.mesh,padMat(F,a,b,c,M.P),F.site)}
  const f=mode==='editor'?Math.PI/2:Math.PI/2*sstep(0,1,clamp((simT-padT0-2)/14,0,1));
  {const[a,b,c]=rotAx([0,0,1],-f);drawMesh(RIG.gantry,padMat(F,a,b,c,[RIG.xh,0,0]),F.site)}
  {const[a,b,c]=rotAx([0,0,1],f);drawMesh(RIG.gantry,padMat(F,mul(a,-1),b,mul(c,-1),[-RIG.xh,0,0]),F.site)}
  const[a,b,c]=rotAx([1,0,0],R?-Math.PI/2*(1-R.up):mode==='editor'?0:-Math.PI/2);drawMesh(RIG.boom,padMat(F,a,b,c,add(RIG.bP,[0,0,dz])),F.site)}
// the ship's model matrix during the Rollout: turned with the boom about its hinge and carried with the car (Q193)
function rollTilt(camW,M){const R=RIG.sch===1&&typeof rollPhase==='function'&&rollPhase();if(!R||R.up>=1)return M;
  const F=padFrame(camW),[x,y,z]=rotAx(F.X,-Math.PI/2*(1-R.up)),H0=add(F.O,padW(F,RIG.bP)),H1=add(F.O,padW(F,add(RIG.bP,[0,0,rollDz(R)])));
  return mmul(mat4(x,y,z,sub(H1,add(add(mul(x,H0[0]),mul(y,H0[1])),mul(z,H0[2])))),M)}
// floodlights: on from dusk (the sun 4° above the pad's horizon) to dawn; four point lights for the mesh shader, which
// lights the rocket, the tower and the pad's buildings with them
function padLights(u,camW){const F=padFrame(camW),e=dot(norm(sub(F.site,bodyPos(TELLUS,simT))),SUN);padNight=len(F.O)<2e4?1-sstep(-.05,.07,e):0;
  const P=[];for(const[x,z]of PAD_LIGHTS)P.push(...add(F.O,padW(F,[x*.98,16.2,z*.98])));gl.uniform3fv(u['uFl[0]'],P);gl.uniform1f(u.uFlI,padNight);gl.uniform3fv(u.uFlC,add(F.O,padW(F,[0,6,4])))}   // aimed at the launch table
function drawPadGlow(u,camW){if(padNight<.01)return;const F=padFrame(camW);gl.uniformMatrix4fv(u.uM,false,padMat(F,[1,0,0],[0,1,0],[0,0,1],[0,0,0]));
  gl.uniform1f(u.uGlow,padNight);gl.bindVertexArray(PAD_GLOW.vao);gl.drawArrays(gl.TRIANGLES,0,PAD_GLOW.n)}

// buildings: boxes in the city's tangent plane, dropped by the curvature, taller toward the centre; built when first needed
const cityMeshes=new Map();
// the sea platform's hull: a deck on columns and pontoons, from the deck (y = 0) down past the waterline (y = −SEA_DECK).
// The deck covers the whole launch complex (the PAD mesh spans x −256…86, z −194…80 m in the pad's frame), so nothing
// stands on open water: a big converted platform. A sea-specific complex (tower and table only) would be smaller.
let SEA_HULL=null;function seaHull(){if(SEA_HULL)return SEA_HULL;const a=[],g=[.42,.43,.45],r=[.62,.22,.16],cx=-85,cz=-57,hx=180,hz=146;
  box(a,[cx,-1.5,cz],hx,1.5,hz,g);for(const dx of[-.8,-.27,.27,.8])for(const dz of[-.75,.75])box(a,[cx+dx*hx,-7,cz+dz*hz],7,5.5,7,g);
  for(const dz of[-.75,.75])box(a,[cx,-15.5,cz+dz*hz],hx*.95,3,11,r);SEA_HULL=makeMesh(a);return SEA_HULL}
function cityMesh(c){if(cityMeshes.has(c))return cityMeshes.get(c);const a=[],R=rng(c.seed),n=Math.min(900,Math.round(160+c.pop/2500));
  // the same tangent frame the renderer uses (planet-fixed here): each building stands on the terrain under it, none in the water
  const ex=norm(cross(Math.abs(c.u[1])<.9?[0,1,0]:[1,0,0],c.u)),ez=cross(ex,c.u);
  for(let i=0;i<n;i++){const rr=Math.sqrt(R())*c.rad*.9,th=R()*6.2832,x=rr*Math.cos(th),z=rr*Math.sin(th),core=Math.exp(-((rr/c.rad)**2)*3);
    const w=12+R()*30,dpt=12+R()*30,hgt=6+R()*12+core*(40+R()*120),drop=(x*x+z*z)/(2*TELLUS.R),g=.62+R()*.28,w2=R()<.5,col=[g*(w2?1:.94),g*.97,g*(w2?.92:1)];   // light concrete: the mesh shader has no tone map, so mid-greys read as black
    const gh=terrainH(norm(add(mul(c.u,TELLUS.R),add(mul(ex,x),mul(ez,z)))));if(gh<1)continue;
    box(a,[x,gh+hgt/2-drop-1,z],w/2,hgt/2,dpt/2,col)}
  const m=makeMesh(a);cityMeshes.set(c,m);return m}
// ---- light at a point (world): the sun's colour after the air between here and space (same coefficients as the sky
// shader), plus hemispheric sky/ground ambient that fades with altitude and night. ×5 matches the ground's sun term.
// near an airless body (QUEUE Q116, PLAYTEST #32) the fill comes from its own sunlit ground: light bounced up off the
// regolith (albedo ~0.12) as the hemisphere's ground term, about that body's up, fading with height; no sky. Without it a
// lander with the sun behind it was a black silhouette (this function only knew Tellus's air). Earthshine (~1e-4 of the
// sun) is left out. FILL_FX = false turns it off (A/B).
let FILL_FX=true;
function airlessFill(p){let nb=null;if(!FILL_FX)return null;for(const b of BODIES){if(b===TELLUS||b.atm)continue;const q=sub(p,bodyPos(b,simT)),d=len(q);
    if(d<b.R*4&&(!nb||d-b.R<nb.h))nb={b,q,h:d-b.R}}
  if(!nb)return null;const up=norm(nb.q),g=5*(nb.b.albedo??.12)*Math.max(0,dot(up,SUN))*Math.exp(-Math.max(nb.h,0)/(nb.b.R*.6));
  return{sun:[5,5,5],up,sky:[.006,.007,.01],gnd:[.95,.92,.88].map(x=>x*g)}}
function lightEnv(p){const af=airlessFill(p);if(af)return af;const up=norm(p),h=len(p)-TELLUS.R,mu=dot(up,SUN),BR=[5.8e-6,13.5e-6,33.1e-6],BM=5e-6*1.1;
  let odR=0,odM=0;if(h<TELLUS.atm){const b=dot(p,SUN),c=dot(p,p)-(TELLUS.R+TELLUS.atm)**2,tl=-b+Math.sqrt(Math.max(b*b-c,0)),n=10,sl=tl/n;
    for(let i=0;i<n;i++){const q=madd(p,SUN,(i+.5)*sl),hq=Math.max(0,len(q)-TELLUS.R);odR+=Math.exp(-hq/TELLUS.H)*sl;odM+=Math.exp(-hq/(TELLUS.H*1200/5600))*sl}}
  const T=BR.map(b=>Math.exp(-(b*odR+BM*odM))),day=clamp((mu+.08)/.35,0,1),air=Math.exp(-Math.max(h,0)/22000),shine=clamp(mu+.25,0,1)*Math.exp(-Math.max(h,0)/2.5e6);
  return{sun:T.map(t=>5*t),up,sky:[.30,.45,.80].map(x=>x*.75*day*air),gnd:[.30,.27,.21].map(x=>x*(.6*day*air+.35*shine))}}
// ---- matrices (column-major)
function mat4(R,U,Fw,t){return[R[0],R[1],R[2],0,U[0],U[1],U[2],0,Fw[0],Fw[1],Fw[2],0,t[0],t[1],t[2],1]}
function mmul(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o}
// shift: a body-frame offset (or just a y offset) applied before rotating, e.g. −(centre of mass)
function modelQ(q,pos,shift=0,sc=[1,1,1]){const X=qrot(q,[1,0,0]),Y=qrot(q,[0,1,0]),Z=qrot(q,[0,0,1]),sh=typeof shift==='number'?[0,shift,0]:shift;return mat4(mul(X,sc[0]),mul(Y,sc[1]),mul(Z,sc[2]),add(pos,qrot(q,sh)))}

