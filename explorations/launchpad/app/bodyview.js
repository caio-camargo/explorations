// app/bodyview.js — the tester's "go to body" view (QA session, QUEUE Q79; SYSTEM.md § "After approval: the fan-out").
// Each SYSTEM.md body drawn alone from its physical row (radius, tilt, flattening, rings) at three distances, with no
// orbit, SOI or ground yet, so the look items (Q80–Q85) have something to paint before M5. A classic script like the
// others; render() hands the frame to bodyViewDraw() while the view is open.
'use strict';
// The catalogue: SYSTEM.md's physical rows (R in m, tilt in degrees). Flattening isn't in SYSTEM.md: Hyperion's 0.08 is
// a placeholder from its 3.3 h day (Saturn is about 0.1). alb/bands/haze are placeholder looks for the look sessions to
// replace (Q80–Q85): albedo, banding strength, haze colour and strength. The names live here and in SYSTEM.md only.
const BODY_CAT=[
  {name:'Hesper',R:1210e3,tilt:177,flat:0,alb:[.86,.8,.62],bands:.06,haze:[.95,.88,.65,.6]},
  {name:'Enyo',R:678e3,tilt:25,flat:0,alb:[.62,.36,.2],bands:0,haze:[.8,.55,.4,.12]},
  {name:'Pavor',R:3e3,tilt:0,flat:0,alb:[.11,.1,.09],bands:0,haze:null},
  {name:'Metus',R:2e3,tilt:0,flat:0,alb:[.12,.11,.1],bands:0,haze:null},
  {name:'Astraea',R:94e3,tilt:0,flat:0,alb:[.13,.13,.13],bands:0,haze:null},
  {name:'Hyperion',R:13982e3,tilt:27,flat:.08,alb:[.86,.76,.56],bands:.35,haze:[.9,.85,.7,.15],rings:[1.3,2.2]},
  {name:'Theia',R:364e3,tilt:0,flat:0,alb:[.82,.72,.3],bands:0,haze:null},
  {name:'Eos',R:312e3,tilt:0,flat:0,alb:[.86,.86,.88],bands:0,haze:null},
  {name:'Tethys',R:515e3,tilt:0,flat:0,alb:[.78,.5,.2],bands:.05,haze:[.95,.6,.25,.7]},
  {name:'Phoebe',R:20e3,tilt:0,flat:0,alb:[.08,.08,.08],bands:0,haze:null},
  {name:'Erebus',R:238e3,tilt:120,flat:0,alb:[.76,.63,.56],bands:0,haze:[.8,.75,.8,.05]}];
const BV_DIST=[1.6,4.5,30],BV_DNAME=['near (the limb)','whole disc','far'];   // camera distance from the centre, in body radii
const BV={on:false,i:0,k:1,az:.6,el:.22,drag:null};
const BV_FS=`#version 300 es
precision highp float;
in vec2 vNdc;out vec4 o;
uniform vec3 uR,uU,uF,uO,uSun,uAlb;uniform vec2 uTan,uRing;uniform float uTilt,uFlat,uBands;uniform vec4 uHaze;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
// world → body frame: the spin axis is +Y tilted by uTilt about X; the ring plane is the equator
vec3 tob(vec3 v){float c=cos(uTilt),s=sin(uTilt);return vec3(v.x,c*v.y+s*v.z,-s*v.y+c*v.z);}
vec3 tow(vec3 v){float c=cos(uTilt),s=sin(uTilt);return vec3(v.x,c*v.y-s*v.z,s*v.y+c*v.z);}
// the ellipsoid x²+z²+(y/(1-f))²=1 along a body-frame ray: nearest t, or -1
float hitE(vec3 ro,vec3 rd){vec3 k=vec3(1.,1./(1.-uFlat),1.),a=ro*k,b=rd*k;float A=dot(b,b),B=dot(a,b),C=dot(a,a)-1.,D=B*B-A*C;if(D<0.)return -1.;
  float t=(-B-sqrt(D))/A;if(t<0.)t=(-B+sqrt(D))/A;return t;}
float ringAt(float r){if(uRing.y<=0.||r<uRing.x||r>uRing.y)return 0.;float x=(r-uRing.x)/(uRing.y-uRing.x);
  return clamp(.55+.25*sin(x*60.)+.2*sin(x*17.+1.),0.,1.)*smoothstep(0.,.03,x)*(1.-smoothstep(.97,1.,x))*(1.-.85*smoothstep(.55,.57,x)*(1.-smoothstep(.6,.62,x)));}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec3 d=normalize(uF+vNdc.x*uTan.x*uR+vNdc.y*uTan.y*uU),ro=tob(uO),rd=tob(d),sb=tob(uSun);
  vec3 col=vec3(0.);float cover=0.;
  float tp=hitE(ro,rd),tr=abs(rd.y)>1e-6?-ro.y/rd.y:-1.;
  if(tp>0.){vec3 p=ro+rd*tp,n=normalize(p*vec3(1.,1./((1.-uFlat)*(1.-uFlat)),1.));float lat=asin(clamp(n.y,-1.,1.));
    vec3 alb=uAlb*(1.+uBands*(.6*sin(lat*14.+2.*sin(lat*5.))+.4*sin(lat*37.)));
    float ndl=max(dot(n,sb),0.);
    // the rings' shadow on the clouds
    if(uRing.y>0.&&abs(sb.y)>1e-4){float ts=-p.y/sb.y;if(ts>0.)ndl*=1.-.7*ringAt(length((p+sb*ts).xz));}
    col=alb*(ndl*1.6+.015);cover=1.;
    if(uHaze.w>0.){float mu=max(dot(n,-rd),0.);col=mix(col,uHaze.rgb*(ndl*1.3+.02),uHaze.w*pow(1.-mu,3.));}}
  if(tr>0.&&(tp<0.||tr<tp)){vec3 p=ro+rd*tr;float a=ringAt(length(p.xz));
    if(a>0.){float lit=.25+.75*abs(sb.y)*4.;if(hitE(p+sb*1e-3,sb)>0.)lit*=.12;   // the planet's shadow across the rings
      col=mix(col,vec3(.85,.78,.66)*min(lit,1.4),a*.85);cover=max(cover,a);}}
  vec2 g=floor(vNdc*uTan*400.);if(cover<.05&&hash(g)>.997)col=vec3(.6+.4*hash(g+1.));   // stars only where nothing is in front
  col=aces(col*.9);o=vec4(pow(col,vec3(1./2.2)),1.);}`;
let PBV=null;
function bodyViewDraw(){if(!BV.on)return false;if(!PBV)PBV=mkProg(QUAD_VS,BV_FS);const b=BODY_CAT[BV.i],u=PBV.u;
  const dpr=Math.min(devicePixelRatio||1,1.5)*RS,w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;ov.width=w;ov.height=h}W=w;H=h;octx.clearRect(0,0,w,h);
  const D=BV_DIST[BV.k],ce=Math.cos(BV.el),O=[D*ce*Math.sin(BV.az),D*Math.sin(BV.el),D*ce*Math.cos(BV.az)],F=norm(mul(O,-1)),Rr=norm(cross(F,[0,1,0])),Uu=cross(Rr,F);
  const sun=norm([Math.sin(BV.az+1.25),.18,Math.cos(BV.az+1.25)]),ty=Math.tan(25*Math.PI/180);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(PBV.p);
  gl.uniform3fv(u.uR,Rr);gl.uniform3fv(u.uU,Uu);gl.uniform3fv(u.uF,F);gl.uniform3fv(u.uO,O);gl.uniform3fv(u.uSun,sun);gl.uniform3fv(u.uAlb,b.alb);
  gl.uniform2f(u.uTan,ty*w/h,ty);gl.uniform2f(u.uRing,b.rings?b.rings[0]:0,b.rings?b.rings[1]:0);gl.uniform1f(u.uTilt,b.tilt*Math.PI/180);gl.uniform1f(u.uFlat,b.flat);
  gl.uniform1f(u.uBands,b.bands);gl.uniform4fv(u.uHaze,b.haze||[0,0,0,0]);gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);
  bodyViewCaption();return true}
function bodyViewCaption(){let c=$('bvCap');if(!c){c=document.createElement('div');c.id='bvCap';document.body.appendChild(c)}
  const b=BODY_CAT[BV.i],km=x=>Math.round(x/1e3).toLocaleString('en');
  const t=`<b>${b.name}</b> · R ${km(b.R)} km · tilt ${b.tilt}°${b.flat?` · flattening ${b.flat}`:''}${b.rings?` · rings ${b.rings[0]}–${b.rings[1]} R`:''} · ${BV_DNAME[BV.k]} (${BV_DIST[BV.k]} R)`
    +`<div class="sub">Placeholder look (QUEUE Q80–Q85) · ◀ ▶ body · 1 2 3 distance · drag to turn · Esc closes</div>`
    +`<div>${BODY_CAT.map((x,i)=>`<button data-bv="${i}"${i===BV.i?' class="on"':''}>${x.name}</button>`).join('')}</div>`;
  if(c.dataset.t!==t){c.innerHTML=t;c.dataset.t=t}}
function bodyViewOpen(name,k){const i=BODY_CAT.findIndex(b=>b.name===name);if(i<0)return false;Object.assign(BV,{on:true,i,k:k==null?BV.k:k});document.body.classList.add('bv');return true}
function bodyViewClose(){if(!BV.on)return;BV.on=false;document.body.classList.remove('bv');const c=$('bvCap');if(c)c.remove()}
{const st=document.createElement('style');st.textContent='body.bv .ui,body.bv #prog,body.bv #editor,body.bv #hud,body.bv #deb,body.bv #news,body.bv #msg,body.bv .ovl{visibility:hidden!important}'
  +'#bvCap{position:fixed;left:12px;bottom:12px;max-width:min(760px,92vw);z-index:7;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px 12px;font-size:12px}'
  +'#bvCap button{margin:3px 3px 0 0}#bvCap button.on{border-color:var(--acc);color:var(--acc)}';document.head.appendChild(st)}
// its own keys and drag while it's open (capture phase, before the screens' handler)
addEventListener('keydown',e=>{if(!BV.on)return;const k=e.key,n=BODY_CAT.length;let used=true;
  if(k==='Escape')bodyViewClose();else if(k==='ArrowRight')BV.i=(BV.i+1)%n;else if(k==='ArrowLeft')BV.i=(BV.i+n-1)%n;else if(k==='1'||k==='2'||k==='3')BV.k=+k-1;else used=false;
  if(used){e.preventDefault();e.stopImmediatePropagation()}},true);
addEventListener('click',e=>{const d=e.target.dataset||{};if(BV.on&&d.bv!=null){BV.i=+d.bv;e.stopImmediatePropagation()}},true);
addEventListener('mousedown',e=>{if(BV.on&&!e.target.closest('#bvCap'))BV.drag=[e.clientX,e.clientY,BV.az,BV.el]},true);
addEventListener('mousemove',e=>{if(!BV.on||!BV.drag||!(e.buttons&1))return;const[x,y,a,l]=BV.drag;BV.az=a-(e.clientX-x)*.006;BV.el=clamp(l+(e.clientY-y)*.006,-1.4,1.4)},true);
addEventListener('mouseup',()=>{BV.drag=null},true);
self.bodyViewDraw=bodyViewDraw;
