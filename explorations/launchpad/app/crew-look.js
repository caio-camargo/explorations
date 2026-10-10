// app/crew-look.js — how the astronauts look (look & sound, QUEUE Q195; CREW.md § Part 1). Part of index.html's script:
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// Caio picked (c) stylised human (W19, 2026-10-09): human proportions in simple forms, faces readable small; and suits
// vary by school and by epoch (D9), starting from the default. The figure is the Q72 mock-up's stylised astronaut
// (mockups/crew/, style c) rebuilt as a mesh with app/gl.js's helpers (pv, tube, lathe, makeMesh): metres, feet at the
// origin, facing +z. The mock-up's flat light bands and ink outlines are not here (the mesh shader has neither).
// Shown so far: two crew on the crew access arm at a crewed rocket's hatch, in the Assembly and on the Rollout screen
// (buildRig's crew arm, drawPadCrew below).

// Suits by school and generation (D9: early ≈ the first crewed flights, middle ≈ the Selene era, late ≈ after it, plus a
// spacewalk suit once EVA exists). Only the default is drawn yet: the mock-up's pale layered suit with red fittings.
// Each school's line goes into SUITS[school][gen] as it is built; suitOf falls back to the default until then.
const SUIT_DEFAULT={suit:[.82,.86,.9,2],trim:[.86,.22,.16,2],boot:[.6,.21,.18,2],shell:[.8,.83,.86,0]};
const SUITS={};
const suitOf=(sch,gen)=>SUITS[sch]&&SUITS[sch][gen]||SUIT_DEFAULT;
// the person inside: a few skin and hair tones, so a crew of two aren't twins
const CREW_SKIN=[[.95,.76,.6],[.7,.5,.36],[.5,.33,.23],[.88,.68,.52]],CREW_HAIR=[[.36,.2,.09],[.1,.08,.07],[.62,.5,.3],[.2,.12,.07]];
// style (c)'s proportions (mockups/crew STYLES.c)
const CREW_C={head:.13,helmR:.19,open:.25,tw:.22,td:.14,tH:.55,legL:.8,legR:.072,armL:.58,armR:.055,boot:[.07,.06,.15],glove:.058,eye:.018};

// a superellipsoid centred at c with radii r (e = 1 an ellipsoid; smaller, a rounded box); keep(P) may drop quads
// (the hair's hairline, the helmet's faceplate)
function blob(out,c,r,col,e=1,seg=12,ring=8,keep=null){const sp=(x,p)=>Math.sign(x)*Math.pow(Math.abs(x),p);
  const V=(i,j)=>{const t=-Math.PI/2+Math.PI*i/ring,f=2*Math.PI*j/seg,ct=Math.cos(t),st=Math.sin(t),cf=Math.cos(f),sf=Math.sin(f);
    const P=[c[0]+r[0]*sp(ct,e)*sp(sf,e),c[1]+r[1]*sp(st,e),c[2]+r[2]*sp(ct,e)*sp(cf,e)];
    const N=norm([sp(ct,2-e)*sp(sf,2-e)/r[0],sp(st,2-e)/r[1],sp(ct,2-e)*sp(cf,2-e)/r[2]]);return[P,N]};
  for(let i=0;i<ring;i++)for(let j=0;j<seg;j++){const q=[V(i,j),V(i+1,j),V(i+1,j+1),V(i,j+1)];
    if(keep&&!keep(mul(add(add(q[0][0],q[1][0]),add(q[2][0],q[3][0])),.25)))continue;
    for(const k of[0,1,2,0,2,3])pv(out,q[k][0],len(q[k][1])>0?q[k][1]:[0,1,0],col)}}
// a limb: a tapered tube with round ends
function limb(out,A,B,ra,rb,col){const d=sub(B,A),L=len(d),Y=mul(d,1/L),X=norm(cross(Math.abs(Y[1])<.9?[0,1,0]:[1,0,0],Y)),Z=cross(X,Y),seg=8;
  for(let j=0;j<seg;j++){const a0=j/seg*6.2832,a1=(j+1)/seg*6.2832,N=a=>add(mul(X,Math.cos(a)),mul(Z,Math.sin(a)));
    for(const[a,y]of[[a0,0],[a0,1],[a1,1],[a0,0],[a1,1],[a1,0]]){const r=ra+(rb-ra)*y;pv(out,add(add(A,mul(d,y)),mul(N(a),r)),N(a),col)}}
  blob(out,A,[ra,ra,ra],col,1,8,5);blob(out,B,[rb,rb,rb],col,1,8,5)}

// One astronaut, pose 'stand' or 'wave' (the right arm up), person k (skin, hair). Returns the vertex array.
function crewFigure(suit,pose,k=0){const s=CREW_C,o=[],S=suit.suit,T=suit.trim,B=suit.boot,skin=[...CREW_SKIN[k%4],0],hair=[...CREW_HAIR[k%4],2];
  const hip=s.legL+s.boot[1]*1.2,sh=hip+s.tH,neck=sh+s.head*.25,HC=[0,neck+s.head*1.05,s.head*.05];
  for(const sx of[-1,1]){const h=[sx*s.tw*.48,hip,0],kn=[sx*s.tw*.52,hip*.5,.02],an=[sx*s.tw*.5,s.boot[1]*1.5,0];
    limb(o,h,kn,s.legR*1.08,s.legR,S);limb(o,kn,an,s.legR,s.legR*.85,S);
    blob(o,[sx*s.tw*.5,s.boot[1],s.boot[2]*.35],s.boot,B,.45,10,6)}
  blob(o,[0,hip+s.tH*.5,0],[s.tw,s.tH*.55,s.td],S,.45,14,8);   // torso
  blob(o,[0,hip+s.tH*.62,s.td*.95],[s.tw*.55,s.tH*.16,s.td*.25],T,.35,10,6);   // chest pack
  blob(o,[0,hip+s.tH*.08,0],[s.tw*1.04,s.tH*.06,s.td*1.06],T,.35,14,4);   // belt
  // arms: the left at the side; the right at the side too, or raised in a wave
  const sL=[-s.tw*1.05,sh-s.armR,0],sR=[s.tw*1.05,sh-s.armR,0],eL=add(sL,[-.06,-s.armL*.5,.04]),wL=add(eL,[0,-s.armL*.48,.06]);
  const wave=pose==='wave',eR=wave?add(sR,[s.armL*.42,s.armL*.12,.05]):add(sR,[.06,-s.armL*.5,.04]),wR=wave?add(eR,[.04,s.armL*.5,.02]):add(eR,[0,-s.armL*.48,.06]);
  limb(o,sL,eL,s.armR*1.1,s.armR,S);limb(o,eL,wL,s.armR,s.armR*.9,S);limb(o,sR,eR,s.armR*1.1,s.armR,S);limb(o,eR,wR,s.armR,s.armR*.9,S);
  blob(o,add(wL,[0,-s.glove*.6,0]),[s.glove,s.glove,s.glove],B,1,8,5);blob(o,add(wR,[0,(wave?1:-1)*s.glove*.6,0]),[s.glove,s.glove,s.glove],B,1,8,5);
  // the neck ring, and the helmet: a shell (outside and a darker inside) open at the faceplate and underneath
  lathe(o,[[s.helmR*.6,neck-.03,T],[s.helmR*.84,neck-.03,T],[s.helmR*.84,neck+.03,T],[s.helmR*.6,neck+.03,T]],[0,0,0],20,[false,false]);
  const F=norm([0,.12,1]),shut=P=>{const d=norm(sub(P,HC));return dot(d,F)<s.open&&d[1]>-.82};
  blob(o,HC,[s.helmR,s.helmR,s.helmR],suit.shell,1,20,12,shut);blob(o,HC,[s.helmR-.012,s.helmR-.012,s.helmR-.012],[.25,.26,.28,2],1,20,12,shut);
  // the faceplate's rim: a ring where the opening meets the shell
  {const U=norm(cross([1,0,0],F)),R=cross(F,U),c=add(HC,mul(F,s.helmR*s.open)),rr=s.helmR*Math.sqrt(1-s.open*s.open);
   for(let j=0;j<20;j++){const a0=j/20*6.2832,a1=(j+1)/20*6.2832,P=a=>add(c,add(mul(R,rr*Math.cos(a)),mul(U,rr*Math.sin(a))));tube(o,P(a0),P(a1),.012,T,4)}}
  // the head: skull, a squarish jaw, nose, ears, hair over the top, eyes with pupils, a mouth
  const hq=add(HC,[0,-s.head*.12,0]),hd=s.head;
  blob(o,hq,[hd*.86,hd,hd*.9],skin,1,14,10);blob(o,add(hq,[0,-hd*.5,hd*.12]),[hd*.58,hd*.42,hd*.56],skin,.6,12,8);
  blob(o,add(hq,[0,-hd*.05,hd*.86]),[hd*.13,hd*.18,hd*.16],skin,1,8,5);
  for(const sx of[-1,1])blob(o,add(hq,[sx*hd*.86,-hd*.05,0]),[hd*.1,hd*.2,hd*.14],skin,1,8,5);
  blob(o,add(hq,[0,hd*.04,-hd*.03]),[hd*.91,hd*1.04,hd*.95],hair,1,14,10,P=>{const q=sub(P,hq),z=clamp(q[2]/hd,-1,1);return q[1]-hd*(-.15+.57*sstep(-.4,.7,z))>0});
  for(const sx of[-1,1]){const ec=add(hq,[sx*hd*.36,hd*.16,hd*.8-s.eye*.4]);blob(o,ec,[s.eye,s.eye,s.eye],[.96,.96,.96,0],1,8,5);
    blob(o,add(ec,[-sx*s.eye*.1,0,s.eye*.72]),[s.eye*.45,s.eye*.45,s.eye*.45],[.03,.04,.06,0],1,6,4);
    tube(o,add(hq,[sx*hd*.22,hd*.38,hd*.84]),add(hq,[sx*hd*.5,hd*.36,hd*.72]),hd*.035,hair,4,true)}   // brows
  tube(o,add(hq,[-hd*.24,-hd*.36,hd*.84]),add(hq,[hd*.24,-hd*.36,hd*.84]),hd*.04,[.35,.08,.07,0],5,true);   // the mouth
  return o}

// The crew on the access arm (Cape: buildRig's crew arm, RIG.crew): built when the rig is, drawn in the Assembly and
// on the Rollout screen while the arm is at the hatch (in flight they are aboard and the arm is swung back). Each is
// placed on the arm's deck in the arm's frame: x from the hatch end, facing the capsule (−x), the second turned out
// and waving.
function crewMeshes(n,sch){const out=[];for(let k=0;k<Math.min(n,2);k++){const a=crewFigure(suitOf(sch,0),k?'wave':'stand',k);out.push({mesh:makeMesh(a),k})}return out}
function drawPadCrew(drawMesh,camW){if(!RIG||!RIG.crew||!RIG.crewFig||mode!=='editor'||HOOK.noRig)return;const F=padFrame(camW),A=RIG.crew;
  RIG.crewFig.forEach(({mesh,k})=>{const yaw=k?-Math.PI/2+.9:-Math.PI/2+.35,c=Math.cos(yaw),s=Math.sin(yaw),X=[5.5-A.L+.75+k*1.15,A.h,k?.32:-.28];
    drawMesh(mesh,padMat(F,[c,0,-s],[0,1,0],[s,0,c],X),F.site)})}
