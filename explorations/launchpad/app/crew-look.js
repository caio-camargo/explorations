// app/crew-look.js — how the astronauts look (look & sound, QUEUE Q195; CREW.md § Part 1). Part of index.html's script:
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// Caio picked (c) stylised human (W19, 2026-10-09): human proportions in simple forms, faces readable small; and suits
// vary by school and by epoch (D9), starting from the default. The figure is the Q72 mock-up's stylised astronaut
// (mockups/crew/, style c) rebuilt as a mesh with app/gl.js's helpers (pv, tube, lathe, makeMesh): metres, feet at the
// origin, facing +z. The mock-up's flat light bands and ink outlines are not here (the mesh shader has neither).
// Shown so far: two crew on the crew access arm at a crewed rocket's hatch, in the Assembly and on the Rollout screen
// (buildRig's crew arm, drawPadCrew below), in the pad's school's suit for the program's generation (Q229).

// Suits by school and generation (CREW.md § "The suit brief, round 2" and "…the other five schools"; mock-ups Q219, Q226;
// Caio's go W32, QUEUE Q229). gen: 0 early (the first crewed flights), 1 middle (the Selene era), 2 late (after a crew
// lands on Selene). Each suit is built from its own pieces, not one body recoloured: era reads through silhouette and
// mass, school through construction (Cape hard shells and gloss, hoses into the chest; Steppe canvas, laces and hoods,
// hoses into the belly, a ventilator case in hand; Arsenal military issue, hoses at the hip; Coastal smooth colour
// blocks, one round connector; Mountain quilted and light, the hose over the shoulder; Isle outdoor gear and sponsors,
// the hose at the thigh). Only the launch suits are here: the crew are seen at the pad. The spacewalk suits and Foundry's
// wait for something that draws them (EVA; the commercial giant's crews). Colours carry the material as a 4th entry
// (0 paint, 1 metal, 2 matte cloth, 4 glass, 5 gold). body: limb bulk, torso width, torso depth, arm length. helm: R its
// radius; face the faceplate's half-size and centre height as direction cosines (x, y, cy); kind shell (default), bubble,
// hood, bone, cap; and its extras. f: the suit's pieces.
const SUIT_DEFAULT={c1:[.82,.86,.9,2],c2:[.86,.22,.16,2],boot:[.6,.21,.18,2],glove:[.6,.21,.18,2],shell:[.8,.83,.86,0],body:[1,1,1,1],helm:{R:.19,face:[.5,.42,.06],ring:[.86,.22,.16,2]},f:{chestPack:1,belt:1}};
const AU=[.85,.62,.2,5],MT=[.6,.62,.64,1],DK=[.1,.1,.11,2],SAF=[.96,.6,.15,2],GRN=[.08,.4,.22,2],HOSE=[.55,.56,.56,2];
const SUITS={
  0:[{c1:[.74,.76,.8,1],c2:AU,boot:[.7,.72,.76,1],glove:[.72,.74,.78,1],shell:[.8,.82,.86,1],body:[.82,.86,.9,1],   // Cape early (Mercury): mirror silver
      helm:{R:.17,face:[.42,.36,.06],ring:AU,mic:1},f:{blouse:1,conn:AU,lights:1}},
     {c1:[.95,.95,.93,0],c2:[.2,.35,.75,0],acc:[.8,.15,.12,0],boot:[.9,.9,.88,0],glove:[.8,.82,.85,0],shell:[.95,.95,.93,0],body:[1.12,1.05,1.1,1],   // Cape middle (Apollo)
      helm:{R:.235,kind:'bubble',ring:[.2,.35,.75,0],ringR:.05},f:{bellows:1,connRow:1,zip:1,snoopy:1}},
     {c1:[.96,.4,.08,0],c2:[.08,.08,.09,0],boot:[.1,.1,.11,0],glove:[.1,.1,.11,0],shell:[.95,.95,.95,0],body:[1.45,1.35,1.45,1],   // Cape late (Shuttle): the orange pumpkin
      helm:{R:.21,face:[.74,.44,.04],ring:MT,pivots:1},f:{pumpkin:1,harness:1,chestHose:1,mirror:1}}],
  1:[{c1:[.9,.46,.12,2],c2:DK,acc:[.8,.12,.1,0],boot:[.1,.09,.09,2],glove:[.85,.84,.8,2],shell:[.95,.95,.93,0],body:[1,.95,1,1],   // Steppe early (SK-1)
      helm:{R:.225,face:[.5,.4,.02],ring:MT,visorUp:MT,brow:[.8,.12,.1,0]},f:{belt:1,highBoots:1,caseHand:1}},
     {c1:[.87,.84,.75,2],c2:[.18,.36,.72,2],boot:[.3,.33,.42,2],glove:[.26,.4,.7,2],shell:[.87,.84,.75,2],body:[1.06,1,1.04,1],   // Steppe middle (Sokol)
      helm:{R:.2,kind:'hood',face:[.5,.5,-.02]},f:{laces:1,laceV:1,waist:1,caseHand:1}},
     {c1:[.3,.37,.28,2],c2:[.94,.5,.12,2],boot:[.14,.15,.13,2],glove:[.24,.27,.21,2],shell:[.38,.45,.35,0],body:[.97,.97,1,1],   // Steppe late: grey-green
      helm:{R:.2,kind:'hood',face:[.52,.48,-.01]},f:{flashes:1,padChest:1,kneePads:1,shoulderPack:1}}],
  2:[{c1:[.36,.38,.22,2],c2:[.62,.64,.66,1],boot:[.08,.08,.08,2],glove:[.3,.23,.15,2],shell:[.46,.48,.36,0],body:[.95,.95,.98,1],   // Arsenal early: flight gear
      helm:{R:.165,kind:'bone'},f:{capstan:1,gHarness:1,legLoops:1,sideConn:1,patch:1}},
     {c1:[.78,.7,.52,2],c2:[.75,.16,.12,2],boot:[.32,.26,.19,2],glove:[.32,.26,.19,2],shell:[.94,.94,.92,0],body:[1.18,1.1,1.12,1],   // Arsenal middle: sand, red quilting
      helm:{R:.215,face:[.55,.45,.02],ring:MT,visorUp:[.75,.16,.12,0]},f:{redChest:1,redShoulders:1,kneePads:1,belt:1,pockets:1,sideConn:1,patch:1}},
     {c1:[.32,.34,.37,0],c2:[.75,.13,.1,0],boot:[.1,.1,.11,0],glove:[.13,.13,.14,0],shell:[.22,.23,.25,0],body:[1.22,1.14,1.15,1],   // Arsenal late: gunmetal, plates
      helm:{R:.21,face:[.6,.42,.04],ring:MT,goldStrip:1},f:{plates:1,chestPlate:1,cuffs:1,sideConn:1,patch:1}}],
  3:[{c1:[.55,.8,.78,0],c2:[.95,.95,.94,0],boot:[.95,.95,.94,0],glove:[.93,.93,.92,0],shell:[.96,.96,.95,0],body:[.86,.88,.92,1],   // Coastal early: pale teal, a white yoke
      helm:{R:.17,face:[.36,.36,.06],egg:1,ring:[.4,.75,.72,0],rim:MT},f:{yoke:1,roundConn:1}},
     {c1:[.95,.95,.94,0],c2:[.5,.8,.76,0],boot:[.92,.92,.9,0],glove:[.88,.9,.9,0],shell:[.96,.96,.95,0],body:[1.12,1.12,1.08,1],   // Coastal middle (Hermes)
      helm:{R:.215,face:[.92,.4,0],collar:1},f:{appliance:1,chestBand:1,legBand:1,roundConn:1}},
     {c1:[.48,.56,.66,0],c2:[.3,.68,.66,0],boot:[.2,.22,.26,0],glove:[.3,.34,.4,0],shell:[.86,.88,.9,0],body:[.95,.98,1,1],   // Coastal late: blue-grey, a teal seam
      helm:{R:.2,face:[.88,.3,.06],ring:[.3,.68,.66,0]},f:{pads:1,seam:1,roundConn:1}}],
  4:[{c1:[.93,.9,.8,2],c2:SAF,boot:[.86,.82,.72,2],glove:[.9,.87,.78,2],shell:[.96,.95,.92,0],body:[.88,.9,.92,1],   // Mountain early: ivory, saffron quilting
      helm:{R:.175,face:[.58,.14,.12],ring:SAF,sun:1},f:{quilt:1,quiltBand:1,shoulderHose:1}},
     {c1:[.96,.6,.16,2],c2:[.95,.94,.92,2],boot:[.94,.93,.9,2],glove:[.95,.94,.92,2],shell:[.96,.96,.95,0],body:[1.02,1,1,1],   // Mountain middle: saffron, pull-tabs
      helm:{R:.19,face:[.52,.42,.04],ring:SAF,sun:1},f:{quilt:1,straps:1,shoulderHose:1}},
     {c1:[.88,.78,.5,2],c2:[.22,.22,.5,2],boot:[.2,.2,.42,2],glove:[.22,.22,.5,2],shell:[.94,.91,.82,0],body:[.8,.86,.9,1],   // Mountain late: pale gold, the slimmest
      helm:{R:.165,kind:'cap',face:[.8,.62,.02],sun:1},f:{cuffs:1,shoulderHose:1}}],
  5:[{c1:[.15,.2,.35,2],c2:[.72,.68,.52,2],boot:[.4,.27,.15,2],glove:[.32,.3,.27,2],shell:[.92,.92,.9,0],body:[1.15,1.05,1.08,1.04],   // Isle early: surplus, patched
      helm:{R:.2,face:[.48,.42,.04],ring:MT,paint:[.38,.4,.26,0]},f:{patches:1,tape:1,rolled:1,thighHose:1}},
     {c1:[.2,.38,.23,2],c2:[.08,.08,.09,2],boot:[.1,.1,.1,2],glove:[.1,.1,.1,2],shell:[.09,.09,.1,0],body:[1.02,1,1,1],   // Isle middle: mountaineering kit
      helm:{R:.195,face:[.55,.42,.04],ring:MT,dark:1},f:{climbHarness:1,legLoops:1,thighHose:1}},
     {c1:[.07,.07,.08,0],c2:[.95,.88,.12,0],boot:[.07,.07,.08,0],glove:[.09,.09,.1,0],shell:[.08,.08,.09,0],body:[.92,.95,.98,1],   // Isle late: black, hi-vis, sponsors
      helm:{R:.195,face:[.6,.38,.05],ring:MT,dark:1,decal:1},f:{sidePanels:1,decals:1,cuffs:1,thighHose:1}}]};
const suitOf=(sch,gen)=>SUITS[sch]&&SUITS[sch][gen]||SUIT_DEFAULT;
// the person inside: a few skin and hair tones, so a crew of two aren't twins
// The people (D26, the head mock-up's option (a), mockups/heads/ PEOPLE): the ligne-claire head varies by a small kit,
// skin, hair colour and style, nose, brow weight and a moustache; faces don't age with the eras (CREW Part 1). Styles:
// 0 crew cut, 1 side part, 2 bob, 3 bun, 4 curls, 5 receding, 6 bald. nose: size, length, droop. The roster (economy)
// picks a person by index; the pad's two are 0 and 1. Every skin tone is in the first eight (the pass/fail check).
const CREW_PEOPLE=[
  {skin:[.97,.8,.67],hair:[.32,.18,.09],style:1,nose:[1,1,0],brow:1,mous:0},
  {skin:[.42,.27,.18],hair:[.06,.05,.05],style:4,nose:[1.35,.85,.1],brow:1.1,mous:0},
  {skin:[.9,.73,.56],hair:[.07,.06,.07],style:3,nose:[.8,.8,0],brow:.8,mous:0},
  {skin:[.99,.85,.77],hair:[.78,.36,.13],style:2,nose:[.85,.75,-.3],brow:.85,mous:0},
  {skin:[.72,.5,.35],hair:[.72,.72,.7],style:5,nose:[1.4,1.45,.4],brow:1.3,mous:1},
  {skin:[.94,.77,.62],hair:[.93,.8,.45],style:0,nose:[.85,1.45,.1],brow:1.45,mous:0},
  {skin:[.3,.19,.13],hair:[.05,.04,.04],style:6,nose:[1.2,1,.2],brow:1.2,mous:1},
  {skin:[.82,.62,.45],hair:[.16,.1,.06],style:0,nose:[1.1,1.15,.15],brow:1.15,mous:1}];
// The expressions (the mock-up's flight portraits): brow (height, inner end up +, arch), eye opening, gaze, mouth (width,
// smile, opening, teeth: 0 none, 1 top row, 2 clenched), g (features pulled down under load). All in head radii.
const CREW_EX={
  neutral:{brow:[0,0,.2],eye:1,look:[.25,0],mouth:[.13,.25,0,0],g:0},
  grin:{brow:[.05,.2,.6],eye:.95,look:[.3,.05],mouth:[.24,1,.1,1],g:0},
  grit:{brow:[-.07,-1,0],eye:.3,look:[0,0],mouth:[.25,-.25,.085,2],g:1},
  alarm:{brow:[.11,1,.3],eye:1.45,look:[.7,-.1],mouth:[.075,0,.16,0],g:0},
  wonder:{brow:[.13,.45,.7],eye:1.3,look:[.1,.75],mouth:[.06,.4,.065,0],g:0}};
const INK=[.045,.04,.045,2];
// style (c)'s proportions (mockups/crew STYLES.c); the suit scales the limbs, torso and arms (its body)
const CREW_C={head:.14,helmR:.19,open:.25,tw:.22,td:.14,tH:.55,legL:.8,legR:.072,armL:.58,armR:.055,boot:[.07,.06,.15],glove:.058,eye:.018};

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
// a band round a limb A→B from h0 to h1 (fractions), standing proud of radius r by a little: laces, straps, cuffs, stripes
function band(out,A,B,h0,h1,r,col){const P=t=>add(A,mul(sub(B,A),t));tube(out,P(h0),P(h1),r*1.07,col,8)}
// a box-ish piece (a rounded superellipsoid) centred at c: packs, pockets, plates, patches
const slab=(out,c,r,col)=>blob(out,c,r,col,.3,8,6);

// One astronaut, pose 'stand' or 'wave' (the right arm up), person k (an index into CREW_PEOPLE, or a person), expression
// ex (CREW_EX). Returns the vertex array.
function crewFigure(suit,pose,k=0,ex='neutral'){const s=CREW_C,o=[],b=suit.body||[1,1,1,1],F=suit.f||{},hm=suit.helm||{},who=typeof k==='object'?k:CREW_PEOPLE[k%CREW_PEOPLE.length];
  const S=suit.c1,T=suit.c2,B=suit.boot,G=suit.glove||B,SH=suit.shell,AC=suit.acc||T,pins=[];   // pins: [from, to, bone, side] for pieces a mover must not guess (the rig below)
  const LR=s.legR*b[0],AR=s.armR*b[0],TW=s.tw*b[1],TD=s.td*b[2],AL=s.armL*b[3],GR=s.glove*(1+(b[0]-1)*.6),HR=hm.R||s.helmR,hd=Math.min(s.head,HR*.8);   // the head fits the smallest helmet
  const hip=s.legL+s.boot[1]*1.2,sh=hip+s.tH,neck=sh+s.head*.25,HC=[0,neck+s.head*1.05,s.head*.05],tc=hip+s.tH*.5;
  // legs, boots
  const legs=[];for(const sx of[-1,1]){const h=[sx*TW*.48,hip,0],kn=[sx*TW*.52,hip*.5,.02],an=[sx*TW*.5,s.boot[1]*1.5,0];legs.push([h,kn,an,sx]);
    limb(o,h,kn,LR*1.08,LR,S);limb(o,kn,an,LR,LR*.85,S);
    blob(o,[sx*TW*.5,s.boot[1],s.boot[2]*.35],[s.boot[0]*Math.sqrt(b[0]),s.boot[1],s.boot[2]],B,.45,10,6)}
  // arms: the left at the side (it carries the case on a Steppe suit); the right at the side too, or raised in a wave
  const sL=[-TW*1.05,sh-AR,0],sR=[TW*1.05,sh-AR,0],eL=add(sL,[-.06,-AL*.5,.04]),wL=add(eL,[0,-AL*.48,.06]);
  const wave=pose==='wave',eR=wave?add(sR,[AL*.42,AL*.12,.05]):add(sR,[.06,-AL*.5,.04]),wR=wave?add(eR,[.04,AL*.5,.02]):add(eR,[0,-AL*.48,.06]);
  const arms=[[sL,eL,wL,-1],[sR,eR,wR,1]];
  for(const[a,e,w]of arms){limb(o,a,e,AR*1.1,AR,S);limb(o,e,w,AR,AR*.9,S)}
  blob(o,add(wL,[0,-GR*.6,0]),[GR,GR,GR],G,1,8,5);blob(o,add(wR,[0,(wave?1:-1)*GR*.6,0]),[GR,GR,GR],G,1,8,5);
  // the torso
  if(F.pumpkin)blob(o,[0,tc+.02,.01],[TW*1.08,s.tH*.6,TD*1.12],S,.75,16,10);   // the Shuttle's padded pumpkin
  else blob(o,[0,tc+(F.appliance?.02:0),0],[TW*(F.appliance?1.08:1),s.tH*.55,TD],S,F.appliance?.3:.45,14,8);   // Coastal middle: shoulders like an appliance's corners
  const chest=(dy,r,col)=>slab(o,[0,hip+s.tH*dy,TD*.92],r,col),ring=(y,col,th=.03)=>blob(o,[0,y,0],[TW*1.04,th,TD*1.06],col,.35,14,4);
  const legBands=(h0,h1,col,seg=2)=>{for(const[h,kn,an]of legs)seg===2?band(o,h,kn,h0,h1,LR,col):band(o,kn,an,h0,h1,LR,col)};
  const armBands=(h0,h1,col,seg=1)=>{for(const[a,e,w]of arms)seg===1?band(o,e,w,h0,h1,AR,col):band(o,a,e,h0,h1,AR,col)};
  if(F.chestPack)chest(.62,[TW*.55,s.tH*.16,TD*.25],T);
  if(F.belt)ring(hip+s.tH*.08,F.chestPack?T:DK);
  // Cape: hard and glossy, metal hardware on show, hoses into the chest
  if(F.blouse)for(const[,kn]of legs)blob(o,add(kn,[0,-.04,.01]),[LR*1.5,LR*1.5,LR*1.5],S,1,10,6);   // Mercury: bloused at the knees
  if(F.conn){for(const sx of[-1,1])blob(o,[sx*.06,hip+s.tH*.45,TD+.012],[.022,.022,.022],F.conn,1,8,5);
    tube(o,[-.06,hip+s.tH*.45,TD+.03],[-.03,hip+.02,TD+.07],.015,MT,6);tube(o,[.06,hip+s.tH*.45,TD+.03],[-.03,hip+.02,TD+.07],.015,MT,6)}
  if(F.lights)for(const[,,w,sx]of arms)blob(o,add(w,[sx*.01,-GR*1.5,.01]),[.015,.015,.015],[1,.96,.8,0],1,6,4);   // finger-tip lights
  if(F.bellows){for(const[a,e,w]of arms){band(o,a,e,0,.16,AR,S);band(o,e,w,0,.16,AR,S)}for(const[h,kn,an]of legs){band(o,h,kn,.84,1,LR,S);band(o,kn,an,0,.16,LR,S)}}   // Apollo's bellows
  if(F.connRow){for(let i=0;i<4;i++)blob(o,[-.11+.073*i,hip+s.tH*.42,TD+.01],[.019,.019,.02],i%2?AC:T,1,8,5);tube(o,[-.1,sh-.06,TD+.004],[.1,hip+s.tH*.6,TD+.004],.007,DK,4)}   // connectors, the diagonal zip
  if(F.harness){for(const sx of[-1,1]){tube(o,[sx*TW*.42,sh+.03,-TD*.3],[sx*TW*.42,sh-.07,TD*1.16],.02,T,6);tube(o,[sx*TW*.42,sh-.07,TD*1.16],[sx*TW*.3,hip+.03,TD*1.14],.02,T,6)}
    tube(o,[-TW*.55,hip+s.tH*.6,TD*1.16],[TW*.55,hip+s.tH*.6,TD*1.16],.02,T,6);slab(o,[0,hip+s.tH*.6,TD*1.18],[.04,.035,.015],MT)}   // the Shuttle's parachute harness and buckle
  if(F.chestHose)tube(o,[TW*.32,hip+s.tH*.4,TD*1.1],[TW*.8,hip-.12,TD*.9],.017,HOSE,6);
  if(F.mirror)slab(o,add(mix3(eL,wL,.7),[0,0,AR*.95]),[.03,.022,.012],MT);
  // Steppe: canvas, laces and straps, hoods sewn on, hoses into the belly, the ventilator case carried by hand
  if(F.highBoots)legBands(.28,1,B,3);
  if(F.laces){armBands(.62,.7,T,0);armBands(.4,.48,T,1);legBands(.3,.37,T);legBands(.72,.79,T);legBands(.42,.49,T,3)}   // Sokol: blue lacing round every limb
  if(F.laceV)for(const sx of[-1,1])tube(o,[sx*TW*.6,sh-.04,TD+.004],[0,hip+s.tH*.42,TD+.004],.01,T,4);
  if(F.waist)ring(hip+.08,T,.022);
  if(F.flashes){armBands(0,.16,T,0);armBands(.84,1,T,1)}
  if(F.padChest)chest(.7,[TW*.74,s.tH*.15,.045],[S[0]*.8,S[1]*.8,S[2]*.8,2]);
  if(F.kneePads)for(const[,kn,,sx]of legs){const p0=o.length;blob(o,add(kn,[0,0,LR*.72]),[LR*.85,LR,LR*.5],F.redChest?T:[S[0]*.8,S[1]*.8,S[2]*.8,2],1,8,5);pins.push([p0,o.length,'shin',sx])}
  if(F.caseHand){const cc=add(wL,[-.02,-GR*1.3-.15,0]),CS=[.58,.63,.66,0],p0=o.length;slab(o,cc,[.06,.13,.19],CS);   // the ventilator case, two hoses from the belly
    tube(o,add(cc,[0,.13,-.07]),add(wL,[0,-GR*.7,-.03]),.011,DK,4);tube(o,add(cc,[0,.13,.07]),add(wL,[0,-GR*.7,.03]),.011,DK,4);pins.push([p0,o.length,'hand',-1]);
    for(const dz of[-.035,.035])tube(o,[-.02+dz,hip+.14,TD+.005],add(cc,[.03,.1,.13+dz]),.016,HOSE,6)}
  if(F.shoulderPack){const pk=[-(TW*1.05+AR+.05),hip+.02,.03],p0=o.length;slab(o,pk,[.04,.12,.14],[.58,.63,.66,0]);
    tube(o,[TW*.55,sh+.03,-.03],[TW*.42,sh-.03,TD*1.04],.016,DK,4);tube(o,[TW*.42,sh-.03,TD*1.04],add(pk,[.02,.11,.06]),.016,DK,4);tube(o,[.03,hip+.13,TD],add(pk,[.03,0,.12]),.014,HOSE,6);pins.push([p0,o.length,'torso'])}
  // Arsenal: military issue, webbing, pockets, a flag patch; the hose goes in at the side of the hip
  if(F.capstan){for(const[h,kn,an,sx]of legs){const d=[sx*LR*.97,0,0];tube(o,add(h,d),add(kn,d),.016,[S[0]*.62,S[1]*.62,S[2]*.62,2],5);tube(o,add(kn,d),add(an,add(d,[0,.08,0])),.016,[S[0]*.62,S[1]*.62,S[2]*.62,2],5)}
    for(const[a,e,w,sx]of arms){const d=[sx*AR*.95,0,0];tube(o,add(a,d),add(e,d),.014,[S[0]*.62,S[1]*.62,S[2]*.62,2],5);tube(o,add(e,d),add(w,d),.014,[S[0]*.62,S[1]*.62,S[2]*.62,2],5)}}
  if(F.gHarness){for(const sx of[-1,1]){tube(o,[sx*TW*.42,sh+.03,-TD*.3],[sx*TW*.42,sh-.07,TD*1.04],.018,DK,5);tube(o,[sx*TW*.42,sh-.07,TD*1.04],[sx*TW*.3,hip+.03,TD],.018,DK,5)}
    tube(o,[-TW*.55,hip+s.tH*.55,TD*1.04],[TW*.55,hip+s.tH*.55,TD*1.04],.018,DK,5)}
  if(F.legLoops)legBands(.06,.15,DK);
  if(F.sideConn){const hc=[-TW*1.02,hip+.1,0];slab(o,hc,[.022,.045,.045],MT);
    if(hm.kind==='bone')tube(o,add(HC,[0,-s.head*.84,s.head*.95]),add(hc,[0,.02,.04]),.017,HOSE,6);else tube(o,add(hc,[-.02,0,0]),add(hc,[-.05,-.34,.12]),.016,HOSE,6)}
  if(F.patch){const[a,e]=arms[0];slab(o,add(mix3(a,e,.6),[-AR*.97,0,0]),[.006,.045,.035],[.78,.13,.1,0])}
  if(F.redChest)chest(.72,[TW*.82,s.tH*.17,.035],T);
  if(F.redShoulders)armBands(0,.2,T,0);
  if(F.pockets)for(const[,kn,an]of legs)for(const t of[.38,.68])slab(o,add(mix3(kn,an,t),[0,0,LR*.92]),[LR*.55,.045,.022],[S[0]*.85,S[1]*.85,S[2]*.85,2]);
  if(F.plates){const PL=[S[0]*.72,S[1]*.72,S[2]*.72,0];for(const[,kn,an,sx]of legs){slab(o,add(mix3(kn,an,.45),[0,0,LR*.9]),[LR*.78,.13,.024],PL);const p0=o.length;slab(o,add(kn,[0,.02,LR*1.]),[LR*.72,.065,.028],PL);pins.push([p0,o.length,'shin',sx])}
    for(const[,e,w]of arms)slab(o,add(mix3(e,w,.5),[0,0,AR*.88]),[AR*.72,.08,.02],PL)}
  if(F.chestPlate){chest(.7,[TW*.86,s.tH*.12,.03],[S[0]*.72,S[1]*.72,S[2]*.72,0]);chest(.86,[TW*.86,.02,.03],T)}
  if(F.cuffs)armBands(.84,1,T,1);
  // Coastal: industrial design, smooth panels and colour blocks, one big round connector at the hip
  if(F.yoke){blob(o,[0,sh-.06,0],[TW*1.02,.08,TD*1.02],T,.45,14,6);armBands(0,.17,T,0)}
  if(F.chestBand)ring(hip+s.tH*.66,T,.035);
  if(F.legBand)for(const[h,kn,an,sx]of legs){const d=[sx*LR*.95,0,0];tube(o,add(h,d),add(kn,d),LR*.25,T,6);tube(o,add(kn,d),add(an,d),LR*.25,T,6)}   // down the outside of the leg
  if(F.seam){for(const[h,kn,an,sx]of legs){const d=[sx*LR*.98,0,0];tube(o,add(h,d),add(kn,d),.008,T,4);tube(o,add(kn,d),add(an,d),.008,T,4)}
    for(const[a,e,w,sx]of arms){const d=[sx*AR*.98,0,0];tube(o,add(a,d),add(e,d),.007,T,4);tube(o,add(e,d),add(w,d),.007,T,4)}
    for(const sx of[-1,1])tube(o,[sx*TW*.98,sh-.03,0],[sx*TW*.98,hip,0],.008,T,4)}
  if(F.pads){for(const[a]of arms)blob(o,add(a,[0,.03,0]),[AR*1.5,AR*1.15,AR*1.4],[S[0]*.85,S[1]*.85,S[2]*.85,0],1,8,5);for(const sx of[-1,1])blob(o,[sx*TW*.95,hip+.02,0],[.05,.07,TD*.95],[S[0]*.85,S[1]*.85,S[2]*.85,0],1,8,5)}
  if(F.roundConn){const c=[TW*.55,hip+.07,TD*.97];roundConn(o,c,T);tube(o,add(c,[0,0,.03]),add(c,[.12,-.36,.1]),.02,HOSE,6)}
  // Mountain: light and economical, narrow quilting, a coloured pull-tab on every strap; the hose over the shoulder
  if(F.quilt){for(let y=hip+.04;y<sh-.02;y+=.077)ring(y,F.quiltBand&&Math.round((y-hip)/.077)%4===0?T:S,.012);
    for(const[h,kn,an]of legs)for(let t=.1;t<1;t+=.2){band(o,h,kn,t,t+.04,LR,F.quiltBand&&t<.2?T:S);band(o,kn,an,t,t+.04,LR,F.quiltBand&&t>.75?T:S)}
    for(const[a,e,w]of arms)for(let t=.15;t<1;t+=.25){band(o,a,e,t,t+.05,AR,S);band(o,e,w,t,t+.05,AR,S)}}
  if(F.straps){ring(hip+.07,T,.022);slab(o,[.06,hip+.04,TD*1.07],[.014,.03,.008],GRN);armBands(.8,.88,T,1);legBands(0,.1,T,3);
    for(const[,e,w]of arms)slab(o,add(mix3(e,w,.84),[0,0,AR*.95]),[.012,.02,.008],GRN);for(const[,kn,an]of legs)slab(o,add(mix3(kn,an,.05),[0,0,LR*.98]),[.014,.024,.008],GRN)}
  if(F.shoulderHose){const a=[-TW*.45,sh-.16,-TD-.005],c=[-TW*.32,sh-.17,TD+.01],m=[-TW*.42,sh+.075,0];tube(o,a,m,.015,HOSE,6);tube(o,m,c,.015,HOSE,6);slab(o,add(c,[0,0,.008]),[.025,.025,.014],MT)}
  // Isle: outdoor gear and sponsors; the hose at the thigh
  if(F.patches){const PC=[[.85,.2,.15,2],[.95,.78,.2,2],[.2,.55,.3,2],[.9,.9,.85,2]];[[-.11,.74],[.1,.72],[-.06,.5],[.12,.44]].forEach(([x,y],i)=>slab(o,[x,hip+s.tH*y,TD-.004],[.03,.026,.012],PC[i]))}
  if(F.tape){armBands(0,.1,[.68,.69,.68,2],1);legBands(.84,.95,[.68,.69,.68,2])}
  if(F.rolled)armBands(.62,.8,T,1);
  if(F.climbHarness){for(const sx of[-1,1]){tube(o,[sx*TW*.42,sh+.03,-TD*.3],[sx*TW*.42,sh-.07,TD*1.03],.016,T,5);tube(o,[sx*TW*.42,sh-.07,TD*1.03],[sx*TW*.38,hip+s.tH*.55,TD*1.03],.016,T,5)}
    tube(o,[-TW*.6,hip+s.tH*.55,TD*1.03],[TW*.6,hip+s.tH*.55,TD*1.03],.016,T,5);ring(hip+.04,T,.028);blob(o,[0,hip-.015,TD*1.12],[.026,.035,.008],MT,1,8,5)}   // and a carabiner
  if(F.sidePanels){for(const[h,kn,an,sx]of legs){const d=[sx*LR*.92,0,0];tube(o,add(h,d),add(kn,d),LR*.35,T,6);tube(o,add(kn,d),add(an,d),LR*.3,T,6)}for(const sx of[-1,1])slab(o,[sx*TW*.9,tc,0],[TW*.14,s.tH*.45,TD*.95],T)}
  if(F.decals){const DC=[[.95,.95,.95,0],[.85,.15,.12,0],[.15,.4,.85,0]];[[-.1,.72,.06],[.09,.76,.05],[0,.5,.09]].forEach(([x,y,w],i)=>slab(o,[x,hip+s.tH*y,TD-.004],[w,.024,.01],DC[i]));armBands(.5,.85,DC[1],0)}
  if(F.thighHose){const[h,kn]=legs[1],c=add(mix3(h,kn,.3),[LR*.35,0,LR*.95]);slab(o,c,[.03,.03,.02],MT);tube(o,add(c,[0,0,.015]),add(c,[.1,-.32,.1]),.016,HOSE,6)}
  // the neck ring
  if(hm.ring)lathe(o,[[HR*.6,neck-.03,hm.ring],[HR*.84,neck-.03,hm.ring],[HR*.84+(hm.ringR||0),neck+.03,hm.ring],[HR*.6,neck+.03,hm.ring]],[0,0,0],20,[false,false]);
  // the helmet. face = the opening's half-size and centre height in direction cosines; open(P): the faceplate's opening
  const fc=hm.face||[.5,.42,.06],dir=P=>norm(sub(P,HC)),open=P=>{const d=dir(P);return d[2]>0&&Math.hypot(d[0]/fc[0],(d[1]-fc[2])/fc[1])<1};
  const rim=(col,r=HR)=>{for(let j=0;j<20;j++){const P=t=>{const dx=fc[0]*Math.cos(t),dy=fc[2]+fc[1]*Math.sin(t);return add(HC,mul([dx,dy,Math.sqrt(Math.max(0,1-dx*dx-dy*dy))],r))};tube(o,P(j/20*6.2832),P((j+1)/20*6.2832),.012,col,4)}};
  const ER=hm.egg?[HR,HR*1.2,HR]:[HR,HR,HR],HCe=hm.egg?add(HC,[0,HR*.12,0]):HC,inner=[.25,.26,.28,2];
  if(hm.kind==='bubble'){blob(o,HC,[HR,HR,HR],[.75,.82,.9,4],1,20,12,P=>{const d=dir(P);return d[2]<.1&&d[1]>-.82})}   // Apollo: the all-glass bubble (its back half; the front is open to show the face)
  else if(hm.kind==='bone'){const keep=P=>{const d=dir(P);return!(d[2]>.25&&d[1]<.32)&&d[1]>-.62};blob(o,HC,[HR,HR,HR],SH,1,20,12,keep);blob(o,HC,[HR-.011,HR-.011,HR-.011],inner,1,20,12,keep);   // Arsenal early: the bone dome
    for(const sx of[-1,1])blob(o,add(HC,[sx*HR*.93,-HR*.32,0]),[.03,.055,.05],SH,1,8,5);
    blob(o,HC,[HR+.012,HR+.012,HR+.012],[.1,.1,.11,0],1,20,12,P=>{const d=dir(P);return d[2]>-.1&&Math.abs(d[1]-.5)<.18});   // the tinted visor, pushed up
    const mc=add(HC,[0,-s.head*.52,s.head*.9]);blob(o,add(mc,[0,0,s.head*.1]),[s.head*.4,s.head*.36,s.head*.3],DK,1,10,6);   // the rubber oxygen mask
    for(const sx of[-1,1])tube(o,add(HC,[sx*HR*.92,-HR*.3,.03]),add(HC,[sx*s.head*.36,-s.head*.45,s.head*.86]),.007,DK,4)}
  else{const top=hm.kind==='cap'?-.3:-.82,keep=P=>!open(P)&&dir(P)[1]>top;   // a hard shell (or Sokol's hood, or Mountain late's open cap) with its faceplate opening
    blob(o,HCe,ER,SH,1,20,12,keep);blob(o,HCe,ER.map(x=>x-.012),inner,1,20,12,keep);
    if(hm.paint)blob(o,HCe,ER.map(x=>x+.002),hm.paint,1,20,12,P=>keep(P)&&((P[0]*37+P[1]*91)%.07+.07)%.07<.022);   // Isle early: painted over by hand, the olive showing through
    if(hm.kind==='hood'){blob(o,[0,neck-.02,0],[HR*1.05,HR*.6,HR*1.0],suit.shell,1,14,8,P=>P[1]<neck+.02);rim(MT,HR*1.01);for(const sx of[-1,1])blob(o,add(HC,[sx*HR*1.0,fc[2]*HR,.09]),[.026,.026,.026],MT,1,8,5)}   // the hood sewn to the suit, its hinged visor ring
    else if(hm.rim||!hm.collar)rim(hm.rim||suit.c2);
    if(hm.collar)blob(o,[0,neck-.03,0],[HR*1.08,HR*.62,HR*1.02],S,1,14,8,P=>P[1]<HC[1]-HR*.42);   // Coastal middle: the helmet grows out of the suit
    if(hm.dark)blob(o,HCe,ER.map(x=>x-.004),[.04,.05,.06,4],1,20,12,P=>open(P));   // a closed dark visor
    if(hm.goldStrip)blob(o,HCe,ER.map(x=>x-.004),AU,1,20,12,P=>open(P)&&dir(P)[1]>fc[2]+fc[1]*.4);   // Arsenal late: a gold sun strip
    if(hm.visorUp)blob(o,HCe,ER.map(x=>x+.008),hm.visorUp,1,20,12,P=>{const d=dir(P);return d[2]>.1&&Math.abs(d[1]-.78)<.07});   // SK-1, Arsenal middle: the visor slid up
    if(hm.brow)blob(o,HCe,ER.map(x=>x+.004),hm.brow,1,20,12,P=>{const d=dir(P);return d[2]>-.25&&d[1]>.5&&d[1]<.66});   // SK-1: the red lettering across the brow (as a band)
    if(hm.mic)tube(o,add(HC,[-HR*.75,-HR*.45,HR*.25]),add(HC,[-HR*.15,-HR*.56,HR*.76]),.008,DK,4);
    if(hm.pivots)for(const sx of[-1,1])tube(o,add(HC,[sx*(HR-.02),0,-.01]),add(HC,[sx*(HR+.03),0,-.01]),.06,MT,10,true);   // the clamshell's pivots
    if(hm.sun)lathe(o,[[0,HR+.019,SAF],[HR*.36,HR+.019,SAF],[HR*.36,HR+.005,SAF]],HCe,16,[false,false]);   // Mountain: the sun disc on the crown
    if(hm.decal)blob(o,HCe,ER.map(x=>x+.004),suit.c2,1,20,12,P=>{const d=dir(P);return d[0]>.55&&Math.abs(d[1])<.25})}   // Isle late: a decal on the side
  // the head, ligne claire (D26; mockups/heads/ option (a)): a slightly big round skull with a small round chin, a small
  // nose and ears; hair a flat shell with an inked hairline (or Apollo's Snoopy cap); the face drawn on, not modelled
  crewHead(o,add(HC,[0,-hd*.12,0]),hd,who,CREW_EX[ex]||CREW_EX.neutral,F.snoopy);
  // the standing skeleton, for whoever moves the figure (eva-lab.html binds each vertex to a bone, Q535): hip and shoulder
  // heights, the torso's half-width and depth, each leg's hip, knee, ankle and side, each arm's shoulder, elbow, glove;
  // pins: pieces bound by name, not by nearness (Steppe's case goes with the hand, its slung pack with the torso, a knee
  // pad with the shin), as
  // [first, end) in o's entries, the bone, the side
  o.rig={pins,hip,sh,neck,HC,TW,TD,LR,AR,legs:legs.map(([h,kn,an,sx])=>({h,kn,an,sx})),arms:arms.map(([a,e,w,sx])=>({a,e,g:add(w,[0,(wave&&sx>0?1:-1)*GR*.6,0]),sx}))};
  return o}
// hair: a shell round c (P(d) the point for a unit direction d) where hk(d) > 0, built column by column from the hairline
// up, so its edge is a smooth line, not a row of quads; the band along each edge is ink (ligne claire's inked hairline);
// sm: smooth normals (the skull's), else each quad's own (curls)
function hairShell(out,c,P,hk,col,ink,sm=true,seg=40,rows=12){const D=(t,f)=>[Math.cos(t)*Math.sin(f),Math.sin(t),Math.cos(t)*Math.cos(f)],H=Math.PI/2,n=64,dI=.06;
  const edge=(f,a,b)=>{for(let k=0;k<20;k++){const m=(a+b)/2;(hk(D(m,f))>0)===(hk(D(a,f))>0)?a=m:b=m}return(a+b)/2};
  const cols=[];for(let j=0;j<=seg;j++){const f=2*Math.PI*j/seg,T=Array.from({length:n+1},(_,i)=>-H+Math.PI*i/n),on=T.map(t=>hk(D(t,f))>0);
    const a=on.indexOf(true),b=on.lastIndexOf(true);if(a<0){cols.push(null);continue}
    const t0=a>0?edge(f,T[a-1],T[a]):-H,t1=b<n?edge(f,T[b+1],T[b]):H,i0=a>0,i1=b<n,ts=[t0];
    if(i0)ts.push(Math.min(t0+dI,(t0+t1)/2));const lo=ts[ts.length-1],hi=i1?Math.max(t1-dI,lo):t1;
    for(let r=1;r<=rows;r++)ts.push(lo+(hi-lo)*r/rows);if(i1)ts.push(t1);
    // a fixed row count per column (rows + 2), the ink bands collapsed where an edge is the pole
    while(ts.length<rows+3)ts.splice(i0?2:1,0,ts[i0?1:0]);
    cols.push({ts,i0,i1,G:ts.map(t=>add(c,P(D(t,f))))})}
  const R=rows+2;
  for(let j=0;j<seg;j++){const A=cols[j],B=cols[j+1];if(!A||!B)continue;
    for(let r=0;r<R;r++){const q=[A.G[r],A.G[r+1],B.G[r+1],B.G[r]],nn=cross(sub(q[3],q[0]),sub(q[1],q[0]));if(len(nn)<1e-12)continue;
      const N=norm(nn),inkRow=(r===0&&A.i0&&B.i0)||(r===R-1&&A.i1&&B.i1),cc=inkRow?ink:col;
      for(const k of[0,1,2,0,2,3]){const v=sub(q[k],c),sn=norm([v[0]/.86,v[1],v[2]/.9]);pv(out,q[k],sm?sn:dot(N,v)<0?mul(N,-1):N,cc)}}}}
// One ligne-claire head centred at hq, radius R, person who (CREW_PEOPLE), expression E (CREW_EX)
function crewHead(o,hq,R,who,E,snoopy){const skin=[...who.skin,0],hairC=[...who.hair,2],nz=who.nose,st=who.style;
  const H=(x,y,z)=>add(hq,[x*R,y*R,z*R]);
  blob(o,hq,[R*.93,R,R*.95],skin,1,16,12);blob(o,H(0,-.38,.1),[R*.68,R*.58,R*.7],skin,1,12,8);   // skull, chin
  blob(o,H(0,-.12-.07*nz[2],.86+.03*nz[1]),[R*.08*nz[0],R*.075*nz[0],R*(.07+.05*nz[1])*nz[0]],skin,1,10,6);   // the nose
  for(const sx of[-1,1])blob(o,H(sx*.9,-.06,0),[R*.1,R*.19,R*.13],skin,1,8,5);   // ears
  // hair: a shell over the skull where the style's hairline lets it grow; curls are a bumpy shell; the bob flares
  const hk=d=>{const y=d[1],z=d[2];if(st===5)return Math.min(.42-y,y+.32,.12-z);
    const k=[[-.22,.5,-.3,.62],[-.25,.44,-.3,.62],[-.82,.36,.32,.72],[-.3,.48,-.3,.62],[-.4,.5,-.3,.6]][st];return y-(k[0]+(k[1]-k[0])*sstep(k[2],k[3],z))};
  if(snoopy){const cq=H(0,.05,-.04),cap=P=>{const q=sub(P,hq);return!(q[2]>R*.25&&q[1]<R*.5)&&q[1]>-R*.55},W=[.96,.96,.94,2],BR=[.17,.12,.09,2],top=P=>{const q=sub(P,hq);return q[1]>-R*.05&&Math.abs(q[0])<R*.52};
    blob(o,cq,[R*.98,R*1.1,R*1.02],W,1,14,10,P=>cap(P)&&top(P));blob(o,cq,[R*.98,R*1.1,R*1.02],BR,1,14,10,P=>cap(P)&&!top(P));
    for(const sx of[-1,1]){blob(o,H(sx*.97,-.08,0),[R*.13,R*.26,R*.22],BR,1,8,5);tube(o,H(sx*.97,-.3,.12),H(sx*.3,-.52,.88),.006,DK,4)}}
  else if(st<6){const ink=[...who.hair.map((v,i)=>v+(INK[i]-v)*.8),2];
    hairShell(o,hq,d=>{let th=.055;if(st===4)th=.12+.035*Math.sin(d[0]*15)*Math.sin(d[1]*15+1)*Math.sin(d[2]*15+2);if(st===2)th+=.07*sstep(.2,-.75,d[1]);
      return[d[0]*R*(.93+th),d[1]*R*(1+th),d[2]*R*(.95+th)]},hk,hairC,ink,st!==4);
    if(st===1)blob(o,H(-.28,.8,.5),[R*.42,R*.17,R*.3],hairC,1,12,8);   // the side part's wave
    if(st===3)blob(o,H(0,.4,-.86),[R*.25,R*.25,R*.25],hairC,1,10,6)}   // a bun
  crewFace(o,hq,R,who,E)}
// The face, drawn on (ligne claire): dots for eyes, brows and a one-line mouth carry the expression; a hook of ink under
// the nose; a moustache. Shapes are laid on the head's front a hair's breadth out, in face coordinates (x, y) in head
// radii, as flat strokes and fills that follow the skull, the chin and the nose.
function crewFace(o,hq,R,who,E){const nz=who.nose,g=.045*E.g;
  const ell=(x,y,cx,cy,rx,ry,cz,rz)=>{const u=1-((x-cx)/rx)**2-((y-cy)/ry)**2;return u>0?cz+rz*Math.sqrt(u):-9};
  const zs=(x,y)=>Math.max(ell(x,y,0,0,.93,1,0,.95),ell(x,y,0,-.38,.68,.58,.1,.7),ell(x,y,0,-.12-.07*nz[2],.08*nz[0],.075*nz[0],.86+.03*nz[1],(.07+.05*nz[1])*nz[0]));
  const fp=(x,y,lift)=>{y-=g;const e=.01,z=zs(x,y),n=norm([-(zs(x+e,y)-zs(x-e,y))/(2*e),-(zs(x,y+e)-zs(x,y-e))/(2*e),1]);return[add(hq,[x*R+n[0]*lift,y*R+n[1]*lift,z*R+n[2]*lift]),n]};
  const L1=R*.012,L2=R*.02;   // fills, then ink over them
  const tri=(a,b,c,col,lift)=>{for(const p of[a,b,c]){const[P,n]=fp(p[0],p[1],lift);pv(o,P,n,col)}};
  const fill=(poly,col,lift=L1)=>{const c=poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);for(let i=0;i<poly.length;i++)tri(c,poly[i],poly[(i+1)%poly.length],col,lift)};
  const ring=(cx,cy,rx,ry,n=14)=>Array.from({length:n},(_,i)=>{const a=i/n*6.2832;return[cx+rx*Math.cos(a),cy+ry*Math.sin(a)]});
  const dot=(c,r,col,lift=L2)=>fill(ring(c[0],c[1],r,r,8),col,lift);
  const stroke=(pts,w,col,closed=false,lift=L2)=>{const n=pts.length;for(let i=0;i<(closed?n:n-1);i++){const a=pts[i],b=pts[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,px=-dy/l*w,py=dx/l*w;
    tri([a[0]+px,a[1]+py],[a[0]-px,a[1]-py],[b[0]-px,b[1]-py],col,lift);tri([a[0]+px,a[1]+py],[b[0]-px,b[1]-py],[b[0]+px,b[1]+py],col,lift)}
    for(const p of pts)dot(p,w,col,lift)};
  const hair=[...who.hair,2],brow=[...who.hair.map((v,i)=>v+(INK[i]-v)*.65),2],ex=.3,ey=.1,by=.34,my=-.45;
  for(const sx of[-1,1]){const X=p=>[sx*p[0],p[1]];
    // brows: an inner, a middle and an outer point; the inner end lifts in worry, drops in anger
    const[h,iu,ar]=E.brow;stroke([[.08,by+h+iu*.09],[.24,by+h+ar*.045+iu*.02],[.42,by+h-.03-iu*.03]].map(X),.034*who.brow,brow);
    // eyes: dots; wide open, whites and a pupil; a squint, a line
    const e=[sx*ex,ey],lk=[E.look[0]*.035,E.look[1]*.03];
    if(E.eye<.45)stroke([[ex-.08,ey+iu*.04],[ex+.08,ey-iu*.02]].map(X),.022,INK);
    else if(E.eye>1.15){const rh=.1+.03*(E.eye-1.15);fill(ring(e[0],e[1],.1,rh),[.98,.98,.98,0]);stroke(ring(e[0],e[1],.1,rh),.016,INK,true);dot([e[0]+lk[0]*1.6,e[1]+lk[1]*1.6],.042,INK,L2*1.3)}
    else fill(ring(e[0]+lk[0],e[1]+lk[1],.06,.08*E.eye,10),INK,L2);
    // a moustache, drooping outward
    if(who.mous){const m=Array.from({length:24},(_,i)=>{const a=i/24*6.2832,x=.17*Math.cos(a);return[Math.max(.01,.12+x),my+.13+.075*Math.sin(a)-.25*x*x/.04]}).map(X);fill(m,hair,L1*1.4);stroke(m,.012,INK,true)}}
  // a hook of ink under the nose
  const nb=-.12-.07*nz[2]-.075*nz[0];stroke([[-.05,nb],[.04,nb-.01],[.08*nz[0],nb+.04]],.014,INK);
  // the mouth: a line, or an open shape between an upper and a lower curve (teeth: a top row, or clenched)
  const[mw,mc,mo,te]=E.mouth,base=s=>my+mc*.085*(s*s-.35),S=Array.from({length:11},(_,i)=>-1+i/5);
  if(mo<.02)stroke(S.map(s=>[s*mw,base(s)]),.019,INK);
  else{const k=s=>te>1.5?Math.sqrt(Math.max(1-s**4,0)):Math.sqrt(Math.max(1-s*s,0)),up=mo*(.25+.5*sstep(.12,.06,mw)),U=s=>base(s)+up*k(s),D=s=>base(s)-mo*k(s);
    const poly=[...S.map(s=>[s*mw,U(s)]),...S.slice(1,-1).reverse().map(s=>[s*mw,D(s)])];
    fill(poly,te>1.5?[.96,.96,.96,0]:[.38,.07,.07,0]);
    if(te===1)fill([...S.map(s=>[s*mw*.92,U(s)-.004]),...S.slice().reverse().map(s=>[s*mw*.92,Math.max(D(s),U(s)-.05)])],[.97,.97,.97,0],L1*1.4);
    if(te>1.5){stroke(S.map(s=>[s*mw*.97,(U(s)+D(s))/2]),.008,INK,false,L1*1.6);for(let x=-mw+.07;x<mw-.03;x+=.07){const s=x/mw;stroke([[x,U(s)],[x,D(s)]],.006,INK,false,L1*1.6)}}
    stroke(poly,.02,INK,true)}}
const mix3=(A,B,t)=>add(A,mul(sub(B,A),t));
// Coastal's one big round connector, facing forward at c: a teal disc, a metal boss
function roundConn(o,c,col){for(const[r,z0,z1,cl]of[[.055,0,.02,col],[.03,.02,.035,MT]]){const n=16;for(let j=0;j<n;j++){const a0=j/n*6.2832,a1=(j+1)/n*6.2832,P=(a,rr,z)=>add(c,[rr*Math.cos(a),rr*Math.sin(a),z]);
  for(const[p,q]of[[P(a0,r,z1),P(a1,r,z1)]]){pv(o,add(c,[0,0,z1]),[0,0,1],cl);pv(o,p,[0,0,1],cl);pv(o,q,[0,0,1],cl)}
  const N=[Math.cos((a0+a1)/2),Math.sin((a0+a1)/2),0];for(const[p,z]of[[a0,z0],[a0,z1],[a1,z1],[a0,z0],[a1,z1],[a1,z0]])pv(o,P(p,r,z),N,cl)}}}

// The crew on the access arm (Cape: buildRig's crew arm, RIG.crew): built when the rig is, drawn in the Assembly and
// on the Rollout screen while the arm is at the hatch (in flight they are aboard and the arm is swung back). Each is
// placed on the arm's deck in the arm's frame: x from the hatch end, facing the capsule (−x), the second turned out
// and waving.
// The suits' generation from the program: early until it starts on Selene (an epoch 4 mission done), middle through the
// Selene era, late once a crew has landed there (CREW.md: middle ≈ the Selene era, late ≈ after it)
let CREW_GEN_FORCE=null;   // reference views pin a generation
function crewGen(){if(CREW_GEN_FORCE!=null)return CREW_GEN_FORCE;const D=typeof PROG!=='undefined'&&PROG.done||{};if(D.crewland)return 2;return typeof MISSIONS!=='undefined'&&MISSIONS.some(M=>M.ep>=4&&D[M.id])?1:0}
function crewMeshes(n,sch){const out=[],g=crewGen();for(let k=0;k<Math.min(n,2);k++){const a=crewFigure(suitOf(sch,g),k?'wave':'stand',k);out.push({mesh:makeMesh(a),k})}return out}
function drawPadCrew(drawMesh,camW){if(!RIG||!RIG.crew||!RIG.crewFig||mode!=='editor'||HOOK.noRig)return;const F=padFrame(camW),A=RIG.crew;
  RIG.crewFig.forEach(({mesh,k})=>{const yaw=k?-Math.PI/2+.9:-Math.PI/2+.35,c=Math.cos(yaw),s=Math.sin(yaw),X=[5.5-A.L+.75+k*1.15,A.h,k?.32:-.28];
    drawMesh(mesh,padMat(F,[c,0,-s],[0,1,0],[s,0,c],X),F.site)})}
