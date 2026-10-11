// app/model-desk.js — the Assembly as a scale model on a 1960s drafting table (flow session at Caio's ask, QUEUE Q242;
// PLAYTEST #45; NOTES § v1.115). A classic script sharing one global scope with the others; index.html loads it after
// gl.js (box, lathe, makeMesh, pv) and before render.js, which calls deskScene() and deskDraw() while the Assembly shows.
'use strict';
// The design is drawn as it always is (the builder's camera and picking are untouched); what changes is everything around
// it. The desk is built in the ship's own frame and scaled up by the model's scale N, so the rocket reads as a model about
// 40 cm tall: the table, paper, lamp and pencil are N times their real size, and the little figure on the base plate is
// a real 1.8 m person. N is a kit scale (1:20 … 1:500), the smallest that keeps the model under 45 cm.
const DESK_SCALES=[20,24,32,48,72,96,144,200,288,400,500],DESK_MAX=0.45;
const DESK_BG=[.075,.058,.045],DESK_LAMP=[-.34,.52,-.2];   // the room behind (clear colour); the lamp's shade, model metres from the model's foot
const deskScaleFor=h=>DESK_SCALES.find(n=>h/n<=DESK_MAX)||DESK_SCALES[DESK_SCALES.length-1];
const deskScene=()=>DESK_FX&&mode==='editor'&&typeof screenNow==='function'&&screenNow()==='assembly'&&S&&S.alive&&isFinite(S.len)&&S.len>0;
let DESK_FX=true;   // A/B: false puts the Assembly back on the pad
const deskMeshes=new Map();
// the desk's mesh in model metres × N, origin at the model's foot (the base plate's top), y up
function deskMesh(N){if(deskMeshes.has(N))return deskMeshes.get(N);const a=[],bulb=[],k=N,B=(c,h,col)=>box(a,c.map(x=>x*k),h[0]*k,h[1]*k,h[2]*k,col);
  const WOOD=[.3,.17,.09],WOOD2=[.2,.11,.06],PAPER=[.78,.75,.67],INK=[.16,.2,.32],LAMP=[.18,.32,.26],BRASS=[.75,.58,.25,1],GREY=[.5,.5,.52,1];
  const T=-.012;   // the table top, under the base plate
  B([.08,T-.02,.05],[.8,.02,.5],WOOD);B([.08,T-.045,.05],[.78,.005,.48],WOOD2);   // the top and its edge band
  for(const[x,z]of[[-.66,-.4],[.82,-.4],[-.66,.5],[.82,.5]])B([x,T-.43,z],[.025,.39,.025],WOOD2);   // legs
  B([.08,T-.6,.05],[.74,.012,.012],WOOD2);   // the foot rail
  B([0,T-.84,0],[4,.01,4],[.1,.07,.05]);   // the office floor (no walls: the camera orbits through where they'd be)
  B([.06,T+.0005,.06],[.3,.0005,.21],PAPER);   // the drawing, A2, the model standing on it
  for(const[c,h]of[[[.06,T+.0012,-.145],[.28,.0003,.0008]],[[.06,T+.0012,.265],[.28,.0003,.0008]],[[-.22,T+.0012,.06],[.0008,.0003,.205]],[[.34,T+.0012,.06],[.0008,.0003,.205]],
    [[.25,T+.0012,.22],[.09,.0003,.0006]],[[.16,T+.0012,.24],[.0006,.0003,.025]],[[-.1,T+.0012,.11],[.08,.0003,.0005]],[[-.1,T+.0012,.02],[.0005,.0003,.09]],
    [[.2,T+.0012,-.06],[.0005,.0003,.06]],[[.2,T+.0012,-.06],[.06,.0003,.0005]]])B(c,h,INK);   // its border, title block and a few construction lines
  B([.3,T+.004,.34],[.16,.003,.016],[.82,.78,.62]);B([.3,T+.0072,.34],[.16,.0002,.001],INK);   // a scale rule
  {const o=[.42,T+.004,.12];rbox(a,o.map(x=>x*k),.09*k,.0035*k,.0035*k,[.85,.62,.1],.5)}   // a pencil
  {const BASE=[.08,.08,.09];lathe(a,[[.07*k,-.012*k,BASE],[.07*k,-.002*k,BASE],[.066*k,0,BASE]],[0,0,0],40)}   // the base plate the model stands on
  lathe(a,[[.012*k,0,GREY],[.012*k,.004*k,GREY]],[0,0,0],16);   // its pin
  {const[x,y,z]=DESK_LAMP,bx=-.5,bz=-.3;   // the architect's lamp: a base, a post, an arm, a shade
    lathe(a,[[.06*k,T*k,LAMP],[.06*k,(T+.015)*k,LAMP],[.03*k,(T+.025)*k,LAMP]],[bx*k,0,bz*k],24);
    B([bx,T+.25,bz],[.006,.23,.006],BRASS);
    const L=Math.hypot(x-bx,z-bz),ang=Math.atan2(z-bz,x-bx);rbox(a,[(bx+x)/2*k,(y+.03)*k,(bz+z)/2*k],L/2*k,.005*k,.005*k,BRASS,ang);
    B([bx,(T+.48+y+.03)/2,bz],[.005,(y+.03-T-.48)/2+.005,.005],BRASS);
    lathe(a,[[.075*k,-.05*k,LAMP],[.05*k,-.01*k,LAMP],[.02*k,.02*k,LAMP],[.012*k,.03*k,LAMP]],[x*k,y*k,z*k],28,[false,true]);
    lathe(bulb,[[.001*k,-.047*k,[1,.9,.65]],[.022*k,-.04*k,[1,.9,.65]],[.022*k,-.03*k,[1,.9,.65]]],[x*k,y*k,z*k],16)}   // the bulb: its own mesh, drawn glowing
  {const fx=.05,fz=.025,s=1.8/1.8;   // the scale figure, a real 1.8 m person in a white coat, on the base plate
    lathe(a,[[.14,0,C.BK],[.16,.05,C.BK],[.15,.8,[.85,.85,.82]],[.21,1.25,[.85,.85,.82]],[.19,1.45,[.85,.85,.82]],[.07,1.5,[.85,.7,.6]],[.1,1.6,[.85,.7,.6]],[.1,1.7,[.85,.7,.6]],[.05,1.8,[.3,.22,.15]]].map(([r,y,c])=>[r*s,y*s,c]),[fx*k,0,fz*k],12)}
  const m={desk:makeMesh(a),bulb:makeMesh(bulb)};deskMeshes.set(N,m);
  if(deskMeshes.size>4){const[k0,m0]=deskMeshes.entries().next().value;m0.desk.free();m0.bulb.free();deskMeshes.delete(k0)}return m}
// where the desk sits: the ship's frame, its foot at the design's bottom (the base plate is under it); while parts below
// were removed, the plate stays where it was and the design hangs above it (BLD.foot, Q247)
const deskFoot=()=>typeof BLD!=='undefined'&&BLD.foot?BLD.foot():S.yBot;
function deskFrame(camW){const p=shipWorld(),f=deskFoot(),N=deskScaleFor(S.len+S.yBot-f);
  return{N,p,M:modelQ(S.q,sub(p,camW),[-S.cm[0],f,-S.cm[2]]),up:qrot(S.q,[0,1,0]),lamp:norm(qrot(S.q,[DESK_LAMP[0]-.05,DESK_LAMP[1],DESK_LAMP[2]-.02]))}}
// the room's light: one warm lamp over the model, a dim warm room; everything is lit (no sun, no night)
function deskLight(m,F){gl.uniform3fv(m.uSun,F.lamp);gl.uniform3fv(m.uSunCol,[2.5,2.15,1.65]);gl.uniform3fv(m.uSky,[.42,.38,.33]);gl.uniform3fv(m.uGnd,[.3,.22,.15]);gl.uniform3fv(m.uUp,F.up);
  if(m.uFlI)gl.uniform1f(m.uFlI,0)}
function deskDraw(drawMesh,m,F){const D=deskMesh(F.N);drawMesh(D.desk,F.M,F.p);gl.uniform1f(m.uGlow,2.5);drawMesh(D.bulb,F.M,F.p);gl.uniform1f(m.uGlow,0)}
// the model's shadow on the paper: the same projection the pad uses, onto the table plane, along the lamp
function deskShadowM(F,camW,Mship){const gn=F.up,L=F.lamp,ln=dot(L,gn),P0=sub(madd(F.p,gn,deskFoot()+0.0015*F.N),camW),d0=dot(P0,gn)/ln;
  const Pr=[1-L[0]*gn[0]/ln,-L[1]*gn[0]/ln,-L[2]*gn[0]/ln,0, -L[0]*gn[1]/ln,1-L[1]*gn[1]/ln,-L[2]*gn[1]/ln,0, -L[0]*gn[2]/ln,-L[1]*gn[2]/ln,1-L[2]*gn[2]/ln,0, L[0]*d0,L[1]*d0,L[2]*d0,1];
  return mmul(Pr,Mship)}
