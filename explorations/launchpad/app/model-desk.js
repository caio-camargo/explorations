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
// (Q276) a 5×7 font for the title block: per glyph its seven rows as base-32 digits (bit 4 is the left column)
const DESK_FONT=(()=>{const f={},t='AehhvhhhBuhhuhhuCehgggheDuhhhhhuEvgguggvFvggugggGehgnhhfHhhhvhhhIe44444eJ7222iicKhikokihLggggggvMhrllhhhNhhpljhhOehhhhhePuhhugggQehhhlidRuhhukihSfgge11uTv444444UhhhhhheVhhhhha4WhhhlllaXhha4ahhYhha4444Zv1248gv0ehjlphe14c4444e2eh1248v3u11e11u426aiv225vgu11he668guhhe7v1248888ehhehhe9ehhf12c:0440440-000e000.00000cc/11248gg';
  for(let i=0;i<t.length;i+=8)f[t[i]]=[...t.slice(i+1,i+8)].map(c=>parseInt(c,32));return f})();
// what the desk shows of the design: its name and scale, the program's school and suit generation, the parts' outline
let DESK_NM={st:null,sv:null,n:-1,v:''};   // deskName's last answer: it runs every frame, and its lookups stringify the design
const deskName=()=>{const st=S.stack||stackDef,SV=PROG.designs&&PROG.designs.saved||[];if(DESK_NM.st===st&&DESK_NM.sv===SV&&DESK_NM.n===SV.length)return DESK_NM.v;
  const K=typeof designKey==='function'&&designKey,k=K&&K(st),sv=k&&SV.find(d=>K(d.stack)===k);   // the player's own name for it, if saved (v1.129)
  DESK_NM={st,sv:SV,n:SV.length,v:String(sv&&sv.name||typeof designName==='function'&&designName(st)||'').toUpperCase().slice(0,24)};return DESK_NM.v};
const deskKey=N=>`${N}|${deskName()}|${typeof schoolOf==='function'?schoolOf(0):0}|${typeof crewGen==='function'?crewGen():0}|${S.parts.length}|${S.len.toFixed(2)}`;
// the desk's mesh in model metres × N, origin at the model's foot (the base plate's top), y up
function deskMesh(N){const key=deskKey(N);if(deskMeshes.has(key))return deskMeshes.get(key);const a=[],bulb=[],k=N,B=(c,h,col)=>box(a,c.map(x=>x*k),h[0]*k,h[1]*k,h[2]*k,col);
  const WOOD=[.3,.17,.09],WOOD2=[.2,.11,.06],PAPER=[.78,.75,.67],INK=[.16,.2,.32],LAMP=[.18,.32,.26],BRASS=[.75,.58,.25,1],GREY=[.5,.5,.52,1];
  const T=-.012;   // the table top, under the base plate
  B([.08,T-.02,-.115],[.8,.02,.665],WOOD);B([.08,T-.045,-.115],[.78,.005,.645],WOOD2);   // the top and its edge band, deep enough for the drafting board
  for(const[x,z]of[[-.66,-.73],[.82,-.73],[-.66,.5],[.82,.5]])B([x,T-.43,z],[.025,.39,.025],WOOD2);   // legs
  B([.08,T-.6,-.115],[.74,.012,.012],WOOD2);   // the foot rail
  B([0,T-.84,0],[4,.01,4],[.1,.07,.05]);   // the office floor (no walls: the camera orbits through where they'd be)
  B([.06,T+.0005,.06],[.3,.0005,.21],PAPER);   // the plan drawing, the model standing on it
  for(const[c,h]of[[[.06,T+.0012,-.145],[.28,.0003,.0008]],[[.06,T+.0012,.265],[.28,.0003,.0008]],[[-.22,T+.0012,.06],[.0008,.0003,.205]],[[.34,T+.0012,.06],[.0008,.0003,.205]],
    [[-.1,T+.0012,.11],[.08,.0003,.0005]],[[-.1,T+.0012,.02],[.0005,.0003,.09]],
    [[.2,T+.0012,-.06],[.0005,.0003,.06]],[[.2,T+.0012,-.06],[.06,.0003,.0005]]])B(c,h,INK);   // its border and a few construction lines
  B([.3,T+.004,.34],[.16,.003,.016],[.82,.78,.62]);B([.3,T+.0072,.34],[.16,.0002,.001],INK);   // a scale rule
  {const o=[.42,T+.004,.12];rbox(a,o.map(x=>x*k),.09*k,.0035*k,.0035*k,[.85,.62,.1],.5)}   // a pencil
  rbox(a,[.47*k,(T+.006)*k,.25*k],.022*k,.006*k,.011*k,[.86,.52,.5],-.45);   // (Q276) an eraser
  // (Q276) the drafting board behind the model, tilted 20° toward the viewer on steel legs, with the design's general
  // arrangement taped to it: its elevation drawn from the parts, and a title block lettered with its name and scale.
  // OB places a box in the board's frame: u across, v up the slope, w out of the surface (model metres)
  {const th=.349,cs=Math.cos(th),sn=Math.sin(th),z0=-.24,y0=T+.035;
    const OB=(u,v,w,hu,hw,hv,col)=>{const t=[];box(t,[0,0,0],hu*k,hw*k,hv*k,col);const c=[u*k,(y0+v*sn+w*cs)*k,(z0-v*cs+w*sn)*k],R=(x,y,z)=>[x,y*cs-z*sn,y*sn+z*cs];
      for(let i=0;i<t.length;i+=VX){const p=R(t[i],t[i+1],t[i+2]),q=R(t[i+3],t[i+4],t[i+5]);a.push(p[0]+c[0],p[1]+c[1],p[2]+c[2],...q,...t.slice(i+6,i+VX))}};
    const BOARD=[.62,.5,.34],VINYL=[.56,.64,.55],STEEL=[.42,.43,.45,1],TAPE=[.84,.76,.52];
    OB(.09,.25,-.011,.41,.011,.25,BOARD);OB(.09,.25,.0005,.4,.0005,.245,VINYL);   // the board, its green drafting cover
    OB(.09,-.006,.004,.41,.006,.005,[.45,.33,.2]);   // the pencil ledge along its foot
    for(const u of[-.28,.46]){B([u,T+.1,-.69],[.01,.1,.01],STEEL);B([u,T+.018,-.25],[.01,.018,.01],STEEL);B([u,T+.004,-.47],[.01,.004,.22],STEEL)}   // its legs and feet
    OB(.08,.26,.0015,.3,.0005,.2,PAPER);   // the drawing, taped at its corners
    for(const u of[-.215,.375])for(const v of[.065,.455])OB(u,v,.0022,.012,.0003,.012,TAPE);
    const L=(u0,v0,u1,v1,t=.0006)=>OB((u0+u1)/2,(v0+v1)/2,.0024,Math.max(Math.abs(u1-u0)/2,t),.0003,Math.max(Math.abs(v1-v0)/2,t),INK);
    L(-.208,.072,.368,.072);L(-.208,.448,.368,.448);L(-.208,.072,-.208,.448);L(.368,.072,.368,.448);   // its border
    L(.2,.072,.2,.15);L(.2,.15,.368,.15);L(.2,.105,.368,.105);   // the title block
    {const ps=S.parts.filter(p=>p.on),yb=Math.min(...ps.map(p=>p.y0)),xs=ps.flatMap(p=>[p.pos[0]-p.d.r,p.pos[0]+p.d.r]),wx=Math.max(...xs)-Math.min(...xs)||1;
      const f=Math.min(.33/S.len,.32/wx),u0=-.01,v0=.095,top=v0+S.len*f;   // the elevation, nose up, at the drawing's own scale
      for(const p of ps){const x0=u0+(p.pos[0]-p.d.r)*f,x1=u0+(p.pos[0]+p.d.r)*f,va=v0+(p.y0-yb)*f,vb=va+p.h*f;L(x0,va,x1,va,.0008);L(x0,vb,x1,vb,.0008);L(x0,va,x0,vb,.0008);L(x1,va,x1,vb,.0008)}
      for(let v=v0-.01;v<top+.01;v+=.014)L(u0,v,u0,Math.min(v+.008,top+.01),.0003)}   // and its centre line, dashed
    const TX=(txt,u,v,px)=>{[...txt].forEach((ch,n)=>{const g=DESK_FONT[ch];if(!g)return;   // a line of lettering, each row's runs of pixels as one box
      for(let r=0;r<7;r++)for(let c=0;c<5;){if(!(g[r]>>(4-c)&1)){c++;continue}let e=c;while(e<5&&g[r]>>(4-e)&1)e++;OB(u+(n*6+(c+e)/2)*px,v+(6.5-r)*px,.0024,(e-c)/2*px,.0003,px/2,INK);c=e}})};
    const nm=deskName(),sc=`SCALE 1:${N}`;
    TX(nm,.208,.116,Math.min(.0042,.152/(nm.length*6)));TX(sc,.208,.081,Math.min(.0028,.152/(sc.length*6)));
    // the T-square: its head hooked over the board's left edge, the blade across the drawing's foot
    OB(-.335,.22,-.006,.014,.02,.08,[.3,.18,.1]);OB(.02,.045,.0025,.345,.001,.014,[.78,.66,.42]);OB(.02,.059,.003,.345,.0011,.0012,[.15,.1,.07])}
  {const BASE=[.08,.08,.09];lathe(a,[[.07*k,-.012*k,BASE],[.07*k,-.002*k,BASE],[.066*k,0,BASE]],[0,0,0],40)}   // the base plate the model stands on
  lathe(a,[[.012*k,0,GREY],[.012*k,.004*k,GREY]],[0,0,0],16);   // its pin
  {const[x,y,z]=DESK_LAMP,bx=-.5,bz=-.3;   // the architect's lamp: a base, a post, an arm, a shade
    lathe(a,[[.06*k,T*k,LAMP],[.06*k,(T+.015)*k,LAMP],[.03*k,(T+.025)*k,LAMP]],[bx*k,0,bz*k],24);
    B([bx,T+.25,bz],[.006,.23,.006],BRASS);
    const L=Math.hypot(x-bx,z-bz),ang=Math.atan2(z-bz,x-bx);rbox(a,[(bx+x)/2*k,(y+.03)*k,(bz+z)/2*k],L/2*k,.005*k,.005*k,BRASS,ang);
    B([bx,(T+.48+y+.03)/2,bz],[.005,(y+.03-T-.48)/2+.005,.005],BRASS);
    lathe(a,[[.075*k,-.05*k,LAMP],[.05*k,-.01*k,LAMP],[.02*k,.02*k,LAMP],[.012*k,.03*k,LAMP]],[x*k,y*k,z*k],28,[false,true]);
    lathe(bulb,[[.001*k,-.047*k,[1,.9,.65]],[.022*k,-.04*k,[1,.9,.65]],[.022*k,-.03*k,[1,.9,.65]]],[x*k,y*k,z*k],16)}   // the bulb: its own mesh, drawn glowing
  {const fx=.05*k,fz=.025*k;   // the scale figure, a real 1.8 m person on the base plate: (Q276) one of our crew, in the program's suit
    if(typeof crewFigure==='function'){const f=crewFigure(suitOf(schoolOf(0),crewGen()),'stand',0);for(let i=0;i<f.length;i+=VX)a.push(f[i]+fx,f[i+1],f[i+2]+fz,...f.slice(i+3,i+VX))}
    else lathe(a,[[.14,0,C.BK],[.16,.05,C.BK],[.15,.8,[.85,.85,.82]],[.21,1.25,[.85,.85,.82]],[.19,1.45,[.85,.85,.82]],[.07,1.5,[.85,.7,.6]],[.1,1.6,[.85,.7,.6]],[.1,1.7,[.85,.7,.6]],[.05,1.8,[.3,.22,.15]]],[fx,0,fz],12)}
  const m={desk:makeMesh(a),bulb:makeMesh(bulb)};deskMeshes.set(key,m);
  if(deskMeshes.size>4){const[k0,m0]=deskMeshes.entries().next().value;m0.desk.free();m0.bulb.free();deskMeshes.delete(k0)}return m}
// where the desk sits: the ship's frame, its foot at the design's bottom (the base plate is under it); while parts below
// were removed, the plate stays where it was and the design hangs above it (BLD.foot, Q247)
const deskFoot=()=>typeof BLD!=='undefined'&&BLD.foot?BLD.foot():S.yBot;
function deskFrame(camW){const p=shipWorld(),f=deskFoot(),N=deskScaleFor(S.len+S.yBot-f);
  return{N,p,M:modelQ(S.q,sub(p,camW),[-S.cm[0],f,-S.cm[2]]),up:qrot(S.q,[0,1,0]),lamp:norm(qrot(S.q,[DESK_LAMP[0]-.05,DESK_LAMP[1],DESK_LAMP[2]-.02]))}}
// the room's light: one warm lamp over the model, a dim warm room; everything is lit (no sun, no night)
function deskLight(m,F){gl.uniform3fv(m.uSun,F.lamp);gl.uniform3fv(m.uSunCol,[2.5,2.15,1.65]);gl.uniform3fv(m.uSky,[.42,.38,.33]);gl.uniform3fv(m.uGnd,[.3,.22,.15]);gl.uniform4fv(m.uDsk,[1,0,.2,0]);gl.uniform3fv(m.uLimb,[0,0,0]);gl.uniform3fv(m.uUp,F.up);
  if(m.uFlI)gl.uniform1f(m.uFlI,0)}
function deskDraw(drawMesh,m,F){const D=deskMesh(F.N);drawMesh(D.desk,F.M,F.p);gl.uniform1f(m.uGlow,2.5);drawMesh(D.bulb,F.M,F.p);gl.uniform1f(m.uGlow,0)}
// the model's shadow on the paper: the same projection the pad uses, onto the table plane, along the lamp
function deskShadowM(F,camW,Mship){const gn=F.up,L=F.lamp,ln=dot(L,gn),P0=sub(madd(F.p,gn,deskFoot()+0.0015*F.N),camW),d0=dot(P0,gn)/ln;
  const Pr=[1-L[0]*gn[0]/ln,-L[1]*gn[0]/ln,-L[2]*gn[0]/ln,0, -L[0]*gn[1]/ln,1-L[1]*gn[1]/ln,-L[2]*gn[1]/ln,0, -L[0]*gn[2]/ln,-L[1]*gn[2]/ln,1-L[2]*gn[2]/ln,0, L[0]*d0,L[1]*d0,L[2]*d0,1];
  return mmul(Pr,Mship)}
