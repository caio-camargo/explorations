// Launchpad — the construction screen (v1.17). Loaded before the main script and driven by it (renderEditor →
// BLD.init, editorChanged → BLD.panel, render → HOOK.edDraw / HOOK.edOverlay); nothing here runs at load time.
//
// The design is a v2 part tree (toV2 / layoutDesign in index.html). A held part, with whatever hangs from it, snaps to
// a free stack node near the cursor (its bottom onto a top node, or its top under a bottom node), otherwise to the
// surface of the part under the cursor: a radial attachment at that height and angle, with ×1–8 symmetry around the
// host's axis and an optional radial decoupler. Parts never tilt — a radial part starts a new vertical stack line,
// which is exactly what the physics already knows how to fly.
//
// Mouse: left = pick up / place (Ctrl-click picks up a copy, Shift-click places and keeps holding a copy), right =
// part options, or drop what you hold; drag = orbit, middle-drag or Shift+wheel = move the view up and down.
// Keys: X / Shift+X symmetry, C angle/height snap, R radial decoupler, Del delete, Ctrl+Z / Ctrl+Y, Esc.
'use strict';
const BLD=(()=>{
const SYM=[1,2,3,4,6,8],SNAP_A=Math.PI/12,SNAP_Y=0.35,NODE_PX=34;
const st={held:null,heldRoot:false,sym:2,snap:true,dec:true,loads:true,hover:null,slot:null,sel:null,undo:[],redo:[],
  mouse:null,press:null,pan:false,ghost:null,ghostKey:'',hi:null,hiKey:'',inited:false,reframe:true,msg:''};
const el=id=>document.getElementById(id);
const cl=x=>JSON.parse(JSON.stringify(x));
const kids=n=>n.c||(n.c=[]);
const nodes=n=>n?[n,...kids(n).flatMap(nodes)]:[];
const isEmpty=d=>Array.isArray(d)?!d.length:!d||!d.root;
const parentOf=(n,t)=>{for(const c of kids(n)){if(c===t)return n;const r=parentOf(c,t);if(r)return r}return null};
const name=k=>PARTS[k].name;
const DPR=()=>Math.min(devicePixelRatio||1,1.5);
// deployable parts (Q328): set out or put away here, and the craft rolls out that way (n.dep on the design node)
const DEPW={leg:['down','up'],wing:['out','in'],bay:['open','shut']},depOf=k=>{const d=PARTS[k];return d.kind==='leg'?'leg':d.wing?'wing':d.kind==='bay'?'bay':null};
const depNodes=()=>isEmpty(stackDef)?[]:[...new Set(S.parts.filter(p=>p.on&&!p.inst.rdec&&depOf(p.dn.k)).map(p=>p.dn))];

// ---- design access. A preset stays in the old array format (so its saved autopilot tape still matches) until the
// first edit; then the tree that the current ship was assembled from becomes the design, so S.parts[].dn are its nodes.
function design(){
  if(!isV2(stackDef)){if(isEmpty(stackDef))stackDef={v:2,root:null};else{const r=S.parts.map(p=>p.dn).find(n=>!n.at);stackDef={v:2,root:r}}}
  ensureIds(stackDef);return stackDef}
// every node gets a small id, unique in the design: a custom staging order refers to decouplers by it
function ensureIds(D){const all=nodes(D.root);let m=0;const seen=new Set();for(const n of all)if(n.id!=null){if(seen.has(n.id))delete n.id;else{seen.add(n.id);m=Math.max(m,n.id)}}
  for(const n of all)if(n.id==null)n.id=++m}
const noIds=n=>{delete n.id;kids(n).forEach(noIds);return n};
// an undo step keeps the design's height over the plate too (Q327): {u, d, gap}; not in the design, whose JSON keys its procedures
function snapshot(){st.undo.push(JSON.stringify({u:1,d:design(),gap:st.gap||0}));if(st.undo.length>80)st.undo.shift();st.redo.length=0}
function restore(from,to){if(!from.length)return;to.push(JSON.stringify({u:1,d:stackDef,gap:st.gap||0}));const e=JSON.parse(from.pop());stackDef=e&&e.u?e.d:e;st.hang=e&&e.u?e.gap:null;st.held=null;st.sel=null;st.hover=null;editorChanged()}
function loadDesign(d){st.held=null;st.sel=null;st.hover=null;stackDef=cl(d);st.reframe=true;editorChanged()}
// The cant (degrees, −30…30) that balances the thrust: the engines burning when this one fires — this node's copies at
// cant θ, the rest as they are — push with zero net torque about the centre of mass of what is still attached then (full
// tanks). Pointing one engine through the CoM is the wrong target: a lone booster beside an equal core engine is already
// nearly balanced uncanted (measured: aiming it through the CoM multiplied the torque by 4.5 and flipped the rocket).
// Symmetric copies balance at any angle, so ties go to the smallest |θ|.
function aimCant(p,s=S){const on=s.parts.map(()=>true),ign=new Set();
  for(const e of s.events){for(const k of e.decouple)s.parts.forEach((q,i)=>{if(q.seg===k)on[i]=false});for(const k of e.ignite)ign.add(k);if(e.ignite.includes(p.seg))break}
  let m=0,C=[0,0,0];s.parts.forEach((q,i)=>{if(!on[i])return;const w=partMass(q),c=partC(q);m+=w;C=[C[0]+w*c[0],C[1]+w*c[1],C[2]+w*c[2]]});C=C.map(x=>x/m);
  const E=s.parts.filter((q,i)=>on[i]&&q.d.kind==='engine'&&ign.has(q.seg)),mine=q=>q.dn===p.dn&&q.phi!=null;
  const tau=th=>{let L=[0,0,0];for(const q of E){const d=mine(q)?cantDir(th,q.phi):tdirOf(q),f=q.d.thrust,r=sub(thrustPt(q),C);L=add(L,cross(r,[d[0]*f,d[1]*f,d[2]*f]))}return len(L)};
  let best=0,bt=tau(0);for(let th=-30;th<=30+1e-9;th+=0.05){const t=tau(th);if(t<bt-1e-6*Math.max(1,bt)||Math.abs(t-bt)<=1e-6*Math.max(1,bt)&&Math.abs(th)<Math.abs(best)){bt=t;best=th}}
  return Math.round(best*100)/100}
// root → n along the tree, or null
function rootPath(r,n){if(r===n)return[r];for(const c of kids(r)){const p=rootPath(c,n);if(p)return[r,...p]}return null}
// reverse every joint on a root→n path of stack joints: each child takes its parent as a child, flipped ('u' ↔ 'd'),
// and the joint's reinforcement moves with the joint. Geometry and the assembled vessel are unchanged.
function reroot(path){const D=design();for(let i=0;i<path.length-1;i++){const p=path[i],c=path[i+1],at=c.at,j=c.j;
    p.c.splice(p.c.indexOf(c),1);kids(c).push(p);p.at=at==='u'?'d':'u';if(j)p.j=j;else delete p.j}
  const r=path[path.length-1];delete r.at;delete r.j;D.root=r}
function detachNode(n){const D=design();if(n===D.root){D.root=null;delete D.park;return}
  const k=(D.park||[]).findIndex(e=>e.n===n);if(k>=0){D.park.splice(k,1);if(!D.park.length)delete D.park;return}
  for(const r of[D.root,...(D.park||[]).map(e=>e.n)]){const p=r&&parentOf(r,n);if(p){p.c.splice(p.c.indexOf(n),1);return}}}
// ---- parts parked in the air (Q246, PLAYTEST #43). A held part (with whatever hangs from it) clicked where no node or
// surface takes it stays there, unattached: design.park = [{n, p}], p = where its bottom centre sits from the root part's
// bottom centre (so parked parts stay still with the pin, Q247). They are drawn faint, can be picked up, copied and
// deleted like any part, and are not the rocket: assemble, costs and launch ignore them (Rollout says they stay behind).
function parkedInst(){const D=stackDef;if(!isV2(D)||!D.park||!D.park.length||isEmpty(D))return[];const r=rootPart();if(!r)return[];
  const out=[];for(const e of D.park){const L=layoutDesign({v:2,root:e.n});
    for(const q of L.inst)out.push({d:q.d,pos:[r.pos[0]+e.p[0]+q.x,0,r.pos[2]+e.p[2]+q.z],y0:r.y0+e.p[1]+q.y0,h:q.d.h,phi:q.phi,rdec:q.rdec||q.surf,
      inst:{surf:q.surf,rdec:q.rdec},dn:q.nd,park:e,on:true})}
  return out}
// where the floating ghost is drawn: the held group's bottom centre in vessel coordinates (see draw: g.float)
function floatAt(){const r=mouseRay(),w=V();if(!r||!w||!st.held)return null;const G=trial({root:true}),c=G.reduce((a,g)=>a+g.y0+g.h/2,0)/G.length,
  T=add(r.o,mul(r.d,len(sub(w.camW,shipWorld())))),sh=isEmpty(stackDef)?0:S.parts[0].y0-S.parts[0].inst.y0;
  return{v:[T[0],sh+T[1]-c,T[2]],G:G.map(g=>({...g,pos:[g.pos[0]+T[0],0,g.pos[2]+T[2]],y0:g.y0+T[1]-c}))}}
// (Q327, PLAYTEST #78) with nothing built, a held part (or the whole rocket, picked up by its root) is put down where it
// floats, its bottom that high over the plate, as in KSP's VAB; the camera stays where it was unless a new start reframes
const HANG_MAX=20;   // m over the plate
const plateY=()=>S&&S.cm&&isFinite(S.cm[1])?S.cm[1]+S.yBot-(st.gap||0):0;   // the plate, in the last ship's vessel coordinates
function placeRoot(keep){const f=floatAt(),h=st.held;if(!f||!h)return;
  if(PARTS[h.k].surf){note(`${name(h.k)} goes on the side of a part: start with something else`);return}
  const pl=plateY(),t=S&&S.cm?S.cm[1]+(cam.edY||0)-pl:null,fresh=st.reframe;
  st.hang=clamp(Math.min(...f.G.map(g=>g.y0))-pl,0,HANG_MAX);place({root:true},keep);
  if(!fresh&&t!=null&&isFinite(t))cam.edY=t+S.yBot-st.gap}   // the camera's target keeps its height over the plate
function parkHeld(keep){if(isEmpty(stackDef))return placeRoot(keep);const f=floatAt(),r=rootPart();if(!f||!r)return;if(collides(f.G)){note('Blocked: it would overlap a part');return}
  snapshot();const D=design(),h=st.held;delete h.at;(D.park||(D.park=[])).push({n:h,p:[+(f.v[0]-r.pos[0]).toFixed(3),+(f.v[1]-r.y0).toFixed(3),+(f.v[2]-r.pos[2]).toFixed(3)]});
  st.held=null;st.ghostKey='';st.parkKey='';editorChanged();note(`${name(h.k)} parked in the air: not part of the rocket until you attach it again`)}

// ---- geometry: vessel frame (y along the stack, the ship's own coordinates) ↔ world ↔ screen
const V=()=>HOOK.view;
function toWorld(v){return add(shipWorld(),qrot(S.q,sub(v,S.cm)))}
function proj(v){const w=V();if(!w)return null;const q=sub(toWorld(v),w.camW),z=dot(q,w.Fw);if(z<=0)return null;
  return[w.W/2*(1+dot(q,w.R)/(z*w.tanX)),w.H/2*(1-dot(q,w.U)/(z*w.tanY))]}
function mouseRay(){const w=V(),m=st.mouse;if(!w||!m)return null;const x=(2*m[0]/w.W-1)*w.tanX,y=(1-2*m[1]/w.H)*w.tanY;
  const dw=norm(add(w.Fw,add(mul(w.R,x),mul(w.U,y)))),qi=qconj(S.q);return{o:add(qrot(qi,sub(w.camW,shipWorld())),S.cm),d:qrot(qi,dw)}}
// a ray against one part's surface of revolution: each profile segment is a cone frustum around the part's axis
function hitPart(p,o,d){const I=p.inst||{},sf=I.surf,sw=p.d.span??Math.max(.3,(p.d.off||0)+p.d.r),pr=I.rdec?[[.2,0],[.2,p.h]]:sf?[[sw/2,0],[sw/2,p.h]]:p.d.prof;   // sw: a surface part's outward extent
  const cx=sf?p.pos[0]+Math.cos(p.phi)*sw/2:p.pos[0],cz=sf?p.pos[2]+Math.sin(p.phi)*sw/2:p.pos[2],ax=o[0]-cx,az=o[2]-cz;let best=null;
  for(let i=0;i<pr.length-1;i++){let[r0,ya]=pr[i],[r1,yb]=pr[i+1];ya+=p.y0;yb+=p.y0;if(yb-ya<1e-6)continue;
    const k=(r1-r0)/(yb-ya),c=r0+k*(o[1]-ya),A=d[0]*d[0]+d[2]*d[2]-k*k*d[1]*d[1],B=2*(ax*d[0]+az*d[2]-c*k*d[1]),C=ax*ax+az*az-c*c;
    const ts=[];if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)ts.push(-C/B)}else{const D=B*B-4*A*C;if(D>=0){const s=Math.sqrt(D);ts.push((-B-s)/(2*A),(-B+s)/(2*A))}}
    for(const t of ts){if(t<=0)continue;const y=o[1]+t*d[1];if(y<ya-1e-6||y>yb+1e-6||c+k*t*d[1]<0)continue;if(!best||t<best.t)best={t,y}}}
  return best}
function rayHit(r){let best=null;if(!r||isEmpty(stackDef))return null;
  for(const p of S.parts){if(!p.on)continue;const h=hitPart(p,r.o,r.d);if(h&&(!best||h.t<best.t))best={p,t:h.t,pt:add(r.o,mul(r.d,h.t))}}
  if(!st.held)for(const p of parkedInst()){const h=hitPart(p,r.o,r.d);if(h&&(!best||h.t<best.t))best={p,t:h.t,pt:add(r.o,mul(r.d,h.t))}}   // parked: to pick up, never to attach to
  return best}

// ---- where the held part would go. Stack nodes near the cursor win; else the surface under it; else nowhere.
function heldNeeds(h){const k=kids(h);return{top:!k.some(c=>c.at==='u'),bot:!k.some(c=>c.at==='d')}}
function stackSlots(){const out=[];if(isEmpty(stackDef))return out;
  for(const p of S.parts){if(!p.on||p.inst.rdec||p.inst.surf)continue;const n=p.dn,k=kids(n);
    const topFree=n.at!=='d'&&!k.some(c=>c.at==='u'),botFree=n.at!=='u'&&!k.some(c=>c.at==='d');
    if(topFree)out.push({p,side:'u',v:[p.pos[0],p.y0+p.h,p.pos[2]]});if(botFree)out.push({p,side:'d',v:[p.pos[0],p.y0,p.pos[2]]})}
  return out}
function findSlot(){const h=st.held;if(!h||!st.mouse)return null;
  const surf=!!PARTS[h.k].surf;
  if(isEmpty(stackDef))return null;   // nothing built: the part floats with the cursor and is put down where clicked (placeRoot)
  const need=heldNeeds(h),m=st.mouse;let best=null,bd=NODE_PX*DPR();
  if(!surf)for(const s of stackSlots()){if(s.side==='u'&&!need.bot||s.side==='d'&&!need.top)continue;const q=proj(s.v);if(!q)continue;
    const dd=Math.hypot(q[0]-m[0],q[1]-m[1]);if(dd<bd){bd=dd;best=s}}
  if(best)return{p:best.p,at:best.side};
  const hit=rayHit(mouseRay());if(!hit||hit.p.inst.rdec||hit.p.inst.surf)return null;
  const p=hit.p,I=p.inst;let a=Math.atan2(hit.pt[2]-p.pos[2],hit.pt[0]-p.pos[0])-I.rot,y=clamp(hit.pt[1]-p.y0,0,p.h);
  if(st.snap)a=Math.round(a/SNAP_A)*SNAP_A;a=((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  const cy=PARTS[h.k].h/2;
  if(st.snap){ // align the held line's bottom or top with a part boundary on the host's line, when close
    const L=lineOf(h),lo=Math.min(...L.map(q=>q.y)),hi=Math.max(...L.map(q=>q.y+PARTS[q.nd.k].h)),yb=p.y0+y-cy;let bestD=SNAP_Y,dy=0;
    for(const q of S.parts)if(q.on&&!q.inst.rdec&&q.inst.line===I.line)for(const b of[q.y0,q.y0+q.h])for(const e of[yb+lo,yb+hi])if(Math.abs(b-e)<bestD){bestD=Math.abs(b-e);dy=b-e}
    y=clamp(y+dy,0,p.h)}
  const at={y:+y.toFixed(3),a:+a.toFixed(5),n:st.sym,cy};if(st.dec&&!surf)at.dec=true;
  return{p,at}}
// lay the design out with the held part tentatively attached; returns the held instances in vessel coordinates
function trial(slot){const h=st.held,old=h.at,D=design();let L;
  if(slot.root||!slot.p){delete h.at;L=layoutDesign({v:2,root:h})}
  else{const host=slot.p.dn;h.at=slot.at;kids(host).push(h);try{L=layoutDesign(D)}finally{host.c.pop()}}
  if(old===undefined)delete h.at;else h.at=old;
  const set=new Set(nodes(h)),sh=isEmpty(stackDef)?0:S.parts[0].y0-S.parts[0].inst.y0;
  return L.inst.filter(q=>set.has(q.nd)).map(q=>({d:q.d,pos:[q.x,0,q.z],y0:q.y0+sh,h:q.d.h,phi:q.phi,rdec:q.rdec||q.surf}))}
function collides(G){const ex=isEmpty(stackDef)?[]:S.parts.filter(p=>p.on&&!p.inst.rdec&&!p.inst.surf);const all=[...G.filter(g=>!g.rdec)];
  const hit=(a,b)=>{const dx=Math.hypot(a.pos[0]-b.pos[0],a.pos[2]-b.pos[2]),oy=Math.min(a.y0+a.h,b.y0+b.h)-Math.max(a.y0,b.y0);
    return dx<1e-3?oy>1e-3:dx<a.d.r+b.d.r-0.02&&oy>0.02};
  for(let i=0;i<all.length;i++){for(const e of ex)if(hit(all[i],e))return true;for(let j=i+1;j<all.length;j++)if(hit(all[i],all[j]))return true}
  return false}
function place(slot,keep){const h=st.held;snapshot();const D=design(),put=keep?noIds(cl(h)):h;
  if(slot.root){delete put.at;D.root=put;if(st.hang==null)st.reframe=true}else{put.at=cl(slot.at);kids(slot.p.dn).push(put)}
  ensureIds(D);if(!keep){st.held=null;st.sel=put}st.ghostKey='';editorChanged()}
function pickUp(p,copy){const n=p.dn,D=design();
  if(!copy&&n===D.root&&kids(n).length){snapshot();const pk=D.park;D.root=null;if(pk)D.park=pk;st.held=n;st.sel=null;st.ghostKey='';editorChanged();   // the whole rocket (Q327); parked parts wait, placed relative to the root
    note('The whole rocket: click where it should hang · right-click drops it (Ctrl+Z brings it back)');return}
  if(copy){st.held=noIds(cl(n));delete st.held.at;st.sel=null;st.ghostKey='';refresh();return}
  snapshot();detachNode(n);st.held=n;st.sel=null;st.ghostKey='';editorChanged()}
function grab(k){st.held={k,c:[]};if(PARTS[k].kind==='rover'&&typeof rvPack==='function')st.held.rvd=rvPack();st.sel=null;st.ghostKey='';refresh();note(`${name(k)}: click a glowing node or the side of a part`)}
function drop(){if(!st.held)return;st.held=null;if(isEmpty(stackDef)&&stackDef&&stackDef.park)delete stackDef.park;st.ghostKey='';refresh()}
function del(n){if(!n)return;snapshot();detachNode(n);if(st.sel&&nodes(n).includes(st.sel))st.sel=null;editorChanged()}
let noteT=0;function note(t){st.msg=t;noteT=performance.now();const e=el('target');if(e)e.innerHTML=statusHTML()}
// (Q236, PLAYTEST #39) how many copies a radial placement makes, in plain sight while a part is held: on the side of a
// part it goes on ×n around it (stack nodes take one). The same choice as the toolbar's and X / Shift+X.
function mountsHTML(){return`<div class="bmounts"><span>radial mounts</span>${SYM.map(n=>`<button data-sym="${n}" class="${st.sym===n?'on':''}">×${n}</button>`).join('')}<span class="dim">[X]</span></div>`}
function statusHTML(){
  if(st.msg&&performance.now()-noteT<6000)return`<span class="acc">${st.msg}</span>`+(st.held?mountsHTML():'');
  if(st.held)return`holding <b>${name(st.held.k)}</b>${nodes(st.held).length>1?` +${nodes(st.held).length-1}`:''} · ${isEmpty(stackDef)?'click where it should hang':'click a glowing node or a surface, or in the air to park it'} · right-click drops it`+mountsHTML();
  const pk=parkedInst().length;if(pk&&!isEmpty(stackDef))return`<span class="warn">${pk} part${pk>1?'s':''} parked in the air</span>, not attached: click to pick ${pk>1?'them':'it'} up and attach, or Del · a launch leaves ${pk>1?'them':'it'} here`;
  return isEmpty(stackDef)?'pick a part to start: the first one placed is the root (a command pod, usually)':'pick a part below, or click one on the rocket to move it · right-click a part for its options'}

// ---- per-frame: hover and ghost. Recomputed on mouse move; meshes cached by a key so they rebuild only on change.
function update(){
  if(mode!=='editor')return;
  if(st.held){st.slot=findSlot();st.hover=null}
  else{st.slot=null;const h=st.mouse&&!st.press?rayHit(mouseRay()):null;st.hover=h?h.p.dn:null}
  tooltip()}
function meshOf(list,tint){const a=[];for(const p of list)partShape(a,p);if(tint)for(let i=0;i<a.length;i+=VX){a[i+6]=tint[0];a[i+7]=tint[1];a[i+8]=tint[2];a[i+9]=0}return a.length?makeMesh(a):null}
function ghostMeshes(){const s=st.slot,key=st.held?JSON.stringify([st.held,s&&s.root,s&&s.p&&s.p.i,s&&s.at]):'';
  if(key===st.ghostKey)return st.ghost;st.ghostKey=key;if(st.ghost){st.ghost.solid&&st.ghost.solid.free();st.ghost.glow&&st.ghost.glow.free()}st.ghost=null;
  if(!st.held)return null;
  if(!s){st.ghost={float:true,G:trial({root:true})};const G=st.ghost.G;st.ghost.glow=meshOf(G,[.5,.6,.7]);st.ghost.c=G.reduce((c,g)=>c+g.y0+g.h/2,0)/G.length;return st.ghost}
  const G=trial(s),bad=collides(G);st.ghost={G,bad,solid:bad?null:meshOf(G),glow:meshOf(G,bad?[1,.15,.1]:[.2,1,.45])};s.bad=bad;return st.ghost}
function parkMeshes(){const P=parkedInst(),key=JSON.stringify(stackDef.park||null)+'|'+P.map(q=>q.pos.concat(q.y0).map(v=>v.toFixed(3))).join();
  if(key===st.parkKey)return st.parkM;st.parkKey=key;if(st.parkM){st.parkM.s&&st.parkM.s.free();st.parkM.g&&st.parkM.g.free()}
  st.parkM=P.length?{s:meshOf(P),g:meshOf(P,[.35,.55,1])}:null;return st.parkM}
function hiMesh(){const key=st.hover?String(S.parts.findIndex(p=>p.dn===st.hover))+(st.sel===st.hover):'';
  const sel=st.sel&&!st.held?S.parts.filter(p=>p.on&&p.dn===st.sel):[],hov=st.hover?[...S.parts,...parkedInst()].filter(p=>p.on&&p.dn===st.hover):
    st.hiAtom?S.parts.filter(p=>p.on&&st.hiAtom.segs.includes(p.seg)&&(st.hiAtom.kind!=='i'||p.d.kind==='engine')):[];
  const k2=key+'|'+sel.map(p=>p.i).join(',')+'|'+hov.map(p=>p.i).join(',');if(k2===st.hiKey)return st.hi;st.hiKey=k2;
  if(st.hi){st.hi.h&&st.hi.h.free();st.hi.s&&st.hi.s.free()}st.hi={h:meshOf(hov,[.5,.8,1]),s:meshOf(sel,[1,.75,.3])};return st.hi}
// called from render() after the ship is drawn, with the mesh program bound
function draw(drawMesh,m,Mship,pw){
  if(mode!=='editor')return;
  const g=st.held?ghostMeshes():null,hi=hiMesh(),pm=isEmpty(stackDef)?null:parkMeshes();
  if(pm)drawMesh(pm.s,Mship,pw);
  if(g&&g.solid){gl.uniform1f(m.uSeam,1);drawMesh(g.solid,Mship,pw);gl.uniform1f(m.uSeam,0)}
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);gl.depthFunc(gl.LEQUAL);
  const pulse=.5+.5*Math.sin(performance.now()/180);
  if(pm){gl.uniform1f(m.uGlow,.1);drawMesh(pm.g,Mship,pw)}
  if(hi.h){gl.uniform1f(m.uGlow,.22);drawMesh(hi.h,Mship,pw)}
  if(hi.s){gl.uniform1f(m.uGlow,.16+.1*pulse);drawMesh(hi.s,Mship,pw)}
  if(g&&g.glow){let M=Mship;
    if(g.float){const r=mouseRay();if(r){const w=V(),dist=len(sub(w.camW,shipWorld())),T=add(r.o,mul(r.d,dist));M=mmul(Mship,mat4([1,0,0],[0,1,0],[0,0,1],[T[0],T[1]-g.c,T[2]]))}}
    gl.uniform1f(m.uGlow,g.float?.35:g.bad?.55:.18+.12*pulse);drawMesh(g.glow,M,pw)}
  gl.uniform1f(m.uGlow,0);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND)}
// called from render() on the 2D overlay
function overlay(o){
  if(mode!=='editor'||typeof atHQ!=='undefined'&&atHQ||isEmpty(stackDef))return;const k=DPR();   // not on the Program screen: S there is the flown vessel (PLAYTEST #27)o.save();o.font=`${11*k}px ui-monospace,Consolas,monospace`;o.textAlign='left';
  if(st.loads&&!st.held){const seen=[];
    for(const p of S.parts){if(!p.on||!p.parent)continue;const f=certFrac(p);if(f==null||!isFinite(f))continue;const q=proj(p.jP);if(!q)continue;
      const c=f>1?'#ff6b6b':f>.7?'#ffb454':'#7dffa8';o.fillStyle=c;o.beginPath();o.arc(q[0],q[1],(f>.7?3.5:2.5)*k,0,7);o.fill();
      if(f<.3||seen.some(s=>Math.hypot(s[0]-q[0],s[1]-q[1])<26*k))continue;seen.push(q);
      o.lineWidth=3*k;o.strokeStyle='rgba(0,0,0,.8)';const t=(f*100).toFixed(0)+'%';o.strokeText(t,q[0]+6*k,q[1]+4*k);o.fillText(t,q[0]+6*k,q[1]+4*k)}}
  {const P=parkedInst(),seen=new Set();for(const q of P){if(seen.has(q.park))continue;seen.add(q.park);const G=P.filter(x=>x.park===q.park),top=Math.max(...G.map(x=>x.y0+x.h)),
    c=proj([G.reduce((a,x)=>a+x.pos[0],0)/G.length,top+.3,G.reduce((a,x)=>a+x.pos[2],0)/G.length]);if(!c)continue;
    o.fillStyle='rgba(127,170,255,.95)';o.lineWidth=3*k;o.strokeStyle='rgba(0,0,0,.8)';o.textAlign='center';o.strokeText('parked',c[0],c[1]);o.fillText('parked',c[0],c[1]);o.textAlign='left'}}
  if(st.held){const need=heldNeeds(st.held),s=st.slot;
    for(const n of stackSlots()){if(n.side==='u'&&!need.bot||n.side==='d'&&!need.top)continue;const q=proj(n.v);if(!q)continue;
      const on=s&&s.p===n.p&&s.at===n.side;o.strokeStyle=on?(s.bad?'#ff6b6b':'#7dffa8'):'rgba(127,209,255,.75)';o.lineWidth=(on?2.5:1.5)*k;
      o.beginPath();o.arc(q[0],q[1],(on?8:5)*k,0,7);o.stroke()}
    if(s&&radAt(s.at)){const m=st.mouse;o.fillStyle=s.bad?'#ff6b6b':'#7dffa8';o.lineWidth=3*k;o.strokeStyle='rgba(0,0,0,.8)';
      const t=`${s.bad?'blocked · ':''}radial mounts ×${s.at.n} [X] · ${(s.at.a*180/Math.PI).toFixed(0)}° · ${s.at.y.toFixed(2)} m up ${name(s.p.d.key)}${s.at.dec?' · decoupler':''}`;
      o.strokeText(t,m[0]+16*k,m[1]+28*k);o.fillText(t,m[0]+16*k,m[1]+28*k)}
    else if(s&&s.bad){const m=st.mouse;o.fillStyle='#ff6b6b';o.fillText('blocked: it would overlap a part',m[0]+16*k,m[1]+28*k)}
    else if(!s&&st.mouse){const m=st.mouse,t=`click to park it here · radial mounts ×${st.sym} · X changes`;o.fillStyle='rgba(127,209,255,.85)';o.lineWidth=3*k;o.strokeStyle='rgba(0,0,0,.8)';o.strokeText(t,m[0]+16*k,m[1]+28*k);o.fillText(t,m[0]+16*k,m[1]+28*k)}}
  o.restore()}

// ---- what each part does (Q248, PLAYTEST #46): one sentence, then a small spec sheet from the part's own numbers, on a
// card beside the palette and in the tooltip on the design. A part with no sentence here gets its kind's; a 2.5 m part
// (big(): d.base) its 1.25 m sibling's. New parts: add a line, or the kind's sentence stands in.
const PART_INFO={
  cone:'A pointed nose: less drag through the air, and it shields what sits under it from the heat of the climb.',
  chute:'Slows a falling craft to a safe touchdown once it is low and slow enough; it only opens in air.',
  pod:'A one-seat command pod: a pilot steers it, and it carries its own small reaction wheels.',
  crew:'A two-seat capsule for longer flights; with an escape tower on top it can carry people on unproven rockets.',
  les:'A tower of solid motors that pulls the capsule clear of a failing rocket; dropped once the climb is safe.',
  tank:'Holds propellant for the engines below it. Most of a rocket is tank; empty ones are dead weight to drop.',
  shield:'An ablative heat shield: it burns away slowly so the part above survives coming home fast.',
  dec:'Splits the rocket in two when its stage fires: everything below it falls away.',
  istage:'A decoupler with a skirt that wraps the engine above it, keeping that engine out of the airflow until it is dropped.',
  adapt:'Joins a 2.5 m stack below to a 1.25 m stack above.',
  rdec:'Holds a side part on and lets it go when its stage fires.',
  fins:'A ring of fixed fins at the tail: it keeps the rocket pointing into the airflow, like an arrow\'s feathers.',
  rfin:'A single fin for the side of a part; place several around the body to keep the rocket straight in air.',
  cfin:'A fin that turns: it steers the rocket in air, strongest when it is moving fast low down.',
  cfins:'A ring of fins that turn: it steers and keeps the rocket straight in air.',
  rcs:'Small cold-gas thrusters for fine turns and nudges in space; they need a gas bottle.',
  gas:'Compressed gas for the RCS thrusters.',
  rwheel:'Spinning wheels inside turn the craft without fuel, until they reach their top speed.',
  spin:'Small solids that spin the stage up like a top when it lights, so it holds its direction without steering.',
  core:'The brain of a craft with nobody aboard: it lets a probe be flown and steered.',
  sci:'Instruments that measure the flight and send it home; it brings air samples back if recovered.',
  bio:'A sealed capsule for a living passenger, with limits of its own: g-forces, cabin heat and air.',
  ballast:'A dead block of known mass, for proving how much a rocket can lift.',
  cam:'Takes pictures of the ground from orbit; they earn once an antenna sends them down.',
  ant:'Sends data and pictures home while the craft can see a ground station.',
  engine:'Burns propellant from the tanks above it to push the rocket.',
  wren:'A small, efficient engine for landers and light upper stages; too weak to lift a rocket off the ground.',
  sparrow:'A small engine that works well in air: sounding rockets and early hops.',
  petrel:'Built for vacuum: very efficient in space, nearly useless at sea level. An upper-stage engine.',
  kestrel:'A strong first-stage engine that works well at sea level: the workhorse that lifts rockets off the pad.',
  condor:'A heavy first-stage engine for big rockets.',
  albatross:'A 2.5 m first-stage engine for the heaviest rockets.',
  port:'Two docking ports that meet slowly and lined up lock together, joining two craft into one.',
  rport:'A docking port on the side of a part, facing outward.',
  claw:'Grabs whatever it touches slowly enough, anywhere on it: for catching things that have no docking port.',
  arm:'A robotic arm that can grab and move things near the craft.',
  hab:'Living quarters for three, with two months of supplies for one person.',
  lab:'A laboratory module where a crew does science in orbit.',
  bay:'A hollow bay with doors that carries payloads inside, shielded during the climb.',
  leg:'Folds flat for launch and swings out to stand the craft up on landing (key Y).',
  rover:'Carries a rover to the surface; pick which rover in the part\'s options.',
  beacon:'Marks a landing site as a base that later flights can return to.',
  comp:'An onboard computer: on a craft without crew it runs the guidance modes (prograde, retrograde, and so on).',
  batt:'Stores electricity for the night side and for peaks.',
  solar:'Makes electricity in sunlight.',
  wpanel:'A solar wing that unfolds in space (key P) and follows the sun; open it in thick air and it tears off.',
  bpanel:'Solar cells fixed on the skin: a little power, always there.',
  rtg:'Steady power from decaying isotopes, day or night, wherever it is: costly.'};
const partInfo=d=>PART_INFO[d.key]||d.base&&PART_INFO[d.base]||PART_INFO[d.kind]||'';
function partSpecs(d){const L=[],n=(v,u,f=2)=>`${+v.toFixed(f)} ${u}`;
  if(d.kind==='tank')L.push(['propellant',n(d.wet-d.dry,'t')],['mass',`${n(d.wet,'t')} full, ${n(d.dry,'t')} empty`]);else L.push(['mass',n(d.m,'t',3)]);
  if(d.kind==='engine')L.push(['thrust',`${d.thrust} kN`],['Isp',`${d.ispA} s sea level · ${d.ispV} s vacuum`]);
  if(d.thrust&&d.kind!=='engine')L.push(['thrust',`${d.thrust} kN for ${d.burn} s`]);
  if(d.crew)L.push(['seats',d.crew]);if(d.berths)L.push(['berths',d.berths]);
  if(d.torque)L.push(['turning',`${d.torque/1000} kN·m`]);if(d.Wp)L.push(['power',`${d.Wp} W in full sun`]);if(d.Wg)L.push(['power',`${d.Wg} W always`]);
  if(d.kWh)L.push(['stores',`${d.kWh} kWh`]);if(d.W)L.push(['draws',`${d.W} W`]);
  L.push(['size',`${+(2*d.r).toFixed(2)} m wide · ${+d.h.toFixed(2)} m tall`],['heat limit',`${d.Tmax} K`]);
  try{const pr=partPrice({d,jr:0})+((d.res0&&d.res0.fuel)||0)*FUEL_PRICE;if(isFinite(pr))L.push(['price',fmtM(pr)+(d.kind==='tank'?' with its propellant':'')])}catch(e){}
  return L}
function partCardHTML(k){const d=PARTS[k],lk=typeof partOpen==='function'?partOpen(k):{ok:true};
  return`<b>${d.name}</b><div class="pcs">${partInfo(d)}</div>`+(lk.ok?'':`<div class="warn">Not open yet: it ${lk.why}. You can design with it; a launch with it is refused.</div>`)+
    `<table>${partSpecs(d).map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`}
function cardAt(b,k){let c=el('partcard');if(!c){c=document.createElement('div');c.id='partcard';document.body.appendChild(c)}
  if(!b){c.style.display='none';return}c.innerHTML=partCardHTML(k);c.style.display='block';const r=b.getBoundingClientRect(),h=c.offsetHeight;
  c.style.left=(r.right+10)+'px';c.style.top=Math.max(8,Math.min(innerHeight-h-8,r.top-8))+'px'}

// ---- tooltip and panels
function tooltip(){let t=el('bldtip');if(!t){t=document.createElement('div');t.id='bldtip';document.body.appendChild(t)}
  const n=st.hover;if(!n||mode!=='editor'||st.held||!st.mouse){t.style.display='none';return}
  const ps=S.parts.filter(p=>p.on&&p.dn===n),w=ps.reduce((a,p)=>{const f=certFrac(p);return f!=null&&f>(a?a.f:-1)?{f,p}:a},null);
  t.innerHTML=`<b>${name(n.k)}</b>${ps.filter(p=>!p.inst.rdec).length>1?` <span class="dim">×${ps.filter(p=>!p.inst.rdec).length}</span>`:''}`+
    (partInfo(PARTS[n.k])?`<div class="pcs">${partInfo(PARTS[n.k])}</div>`:'')+(w?`<br>joint <span class="${w.f>1?'bad':w.f>.7?'warn':'ok'}">${(w.f*100).toFixed(0)}%</span> <span class="dim">${w.p.anaKind||''}</span>`:'')+
    (ps.length?'':`<br><span class="warn">parked: not attached</span>`)+`<br><span class="dim">click: pick up${ps.length?' · right-click: options':' · Del: delete'}</span>`;
  const k=V()?V().W/innerWidth:1;t.style.display='block';t.style.left=(st.mouse[0]/k+14)+'px';t.style.top=(st.mouse[1]/k+14)+'px'}
// (Q235, PLAYTEST #42) start from scratch: one undo step; the palette, presets and saved designs are untouched
function clearDesign(){if(isEmpty(stackDef))return;snapshot();stackDef={v:2,root:null};st.held=null;st.sel=null;st.reframe=true;editorChanged();note('Cleared: pick a part to start (Ctrl+Z brings the design back)')}
function btn(parent,label,on,fn,tip){const b=document.createElement('button');b.textContent=label;if(on)b.className='on';if(tip)b.title=tip;b.onclick=e=>{e.stopPropagation();fn()};parent.appendChild(b);return b}
function edit(fn){snapshot();fn();editorChanged()}
function panel(){
  const box=el('stack');if(!box)return;box.innerHTML='';
  const bar=document.createElement('div');bar.className='bbar';box.appendChild(bar);
  const sy=document.createElement('div');sy.className='bgrp';sy.innerHTML='<span class="dim">radial mounts</span>';for(const n of SYM)btn(sy,'×'+n,st.sym===n,()=>{st.sym=n;st.ghostKey='';refresh()},'a part placed on the side of another goes on this many times, evenly around it [X / Shift+X]');bar.appendChild(sy);
  const t2=document.createElement('div');t2.className='bgrp';bar.appendChild(t2);
  btn(t2,'snap',st.snap,()=>{st.snap=!st.snap;refresh()},'snap radial angles to 15° and line ends to the host\'s part boundaries [C]');
  btn(t2,'radial decoupler',st.dec,()=>{st.dec=!st.dec;refresh()},'radial parts go on through a decoupler, so they become a stage you can drop [R]');
  btn(t2,'loads',st.loads,()=>{st.loads=!st.loads;refresh()},'joint loads (worst of liftoff and max-q, against certified ratings) at every joint');
  const t3=document.createElement('div');t3.className='bgrp';bar.appendChild(t3);
  btn(t3,'↶ undo',false,()=>restore(st.undo,st.redo),'Ctrl+Z').disabled=!st.undo.length;
  btn(t3,'↷ redo',false,()=>restore(st.redo,st.undo),'Ctrl+Y').disabled=!st.redo.length;
  btn(t3,'save design…',false,()=>{const i=el('blName');if(!i)return;i.scrollIntoView({block:'center'});i.focus()},'name it and keep it under Your designs (every launch also keeps its design under Launched)').disabled=isEmpty(stackDef);
  btn(t3,'✕ clear design',false,clearDesign,'remove every part and start from scratch (Ctrl+Z brings them back)').disabled=isEmpty(stackDef);
  const dn=depNodes();if(dn.length){const t4=document.createElement('div');t4.className='bgrp';t4.innerHTML='<span class="dim">deploy</span>';bar.appendChild(t4);
    const all=on=>edit(()=>{design();for(const n of dn)if(on)n.dep=true;else delete n.dep});
    btn(t4,'extend all',dn.every(n=>n.dep),()=>all(true),'legs down, solar wings out, bay doors open, as they will roll out');
    btn(t4,'retract all',!dn.some(n=>n.dep),()=>all(false),'everything stowed for launch')}
  if(!isEmpty(stackDef))staging(box);
  const n=st.sel;const sel=document.createElement('div');sel.className='bsel';box.appendChild(sel);
  if(!n||isEmpty(stackDef)||!nodes(design().root).includes(n)){st.sel=null;sel.innerHTML='<div class="sub">Right-click a part for its options.</div>';return}
  const D=design(),par=parentOf(D.root,n),ps=S.parts.filter(p=>p.on&&p.dn===n),copies=ps.filter(p=>!p.inst.rdec).length;
  const where=!par?'root part':n.at==='u'?`on top of ${name(par.k)}`:n.at==='d'?`under ${name(par.k)}`:`radial on ${name(par.k)}, ${n.at.y.toFixed(2)} m up, ${(n.at.a*180/Math.PI).toFixed(0)}°`;
  const sub=nodes(n).length-1;
  sel.innerHTML=`<div class="bhd"><b>${name(n.k)}</b>${copies>1?` <span class="dim">×${copies}</span>`:''}</div><div class="sub">${where}${sub?` · carries ${sub} part${sub>1?'s':''}`:''}</div>`;
  const row=(label)=>{const r=document.createElement('div');r.className='brow';r.innerHTML=`<span class="dim">${label}</span>`;sel.appendChild(r);return r};
  if(par){const w=ps.reduce((a,p)=>{const f=certFrac(p);return f!=null&&f>(a?a.f:-1)?{f,p}:a},null),r=row('joint');
    if(w){const s=document.createElement('span');s.className=w.f>1?'bad':w.f>.7?'warn':'ok';s.textContent=` ${(w.f*100).toFixed(0)}% ${w.p.anaKind||''} `;r.appendChild(s)}
    btn(r,JR[n.j||0].name,!!n.j,()=>edit(()=>{n.j=((n.j||0)+1)%3;if(!n.j)delete n.j}),'cycle: standard → reinforced (2× strength) → heavy (4×), each adds mass')}
  if(PARTS[n.k].kind==='dec'){const r=row('crossfeed');btn(r,n.x?'on':'off',!!n.x,()=>edit(()=>{if(n.x)delete n.x;else n.x=true}),'let fuel flow across this decoupler: the stage below feeds the engines above it, and drains first')}
  {const w=depOf(n.k);if(w){const r=row('deployed');btn(r,n.dep?DEPW[w][0]:DEPW[w][1],!!n.dep,()=>edit(()=>{if(n.dep)delete n.dep;else n.dep=true}),'set it out or put it away here: the craft rolls out the way you leave it')}}
  if(radAt(n.at)){const a=n.at;
    {const r=row('copies');for(const k of SYM)btn(r,'×'+k,a.n===k,()=>edit(()=>{a.n=k}))}
    if(!PARTS[n.k].surf){const r=row('decoupler');btn(r,a.dec?'radial decoupler':'fixed',!!a.dec,()=>edit(()=>{if(a.dec){delete a.dec;delete a.x}else a.dec=true}),'with a decoupler the radial parts are a stage of their own; without, they stay on for good');
      if(a.dec)btn(r,a.x?'crossfeed ✓':'no crossfeed',!!a.x,()=>edit(()=>{if(a.x)delete a.x;else a.x=true}),'the radial parts feed the engines they hang on too, and run dry first')}
    {const r=row('move');const hp=PARTS[par.k].h;
      btn(r,'▲',false,()=>edit(()=>{a.y=+Math.min(hp,a.y+.1).toFixed(3)}),'up 0.1 m');btn(r,'▼',false,()=>edit(()=>{a.y=+Math.max(0,a.y-.1).toFixed(3)}),'down 0.1 m');
      btn(r,'⟲',false,()=>edit(()=>{a.a=+(a.a-SNAP_A).toFixed(5)}),'rotate −15°');btn(r,'⟳',false,()=>edit(()=>{a.a=+(a.a+SNAP_A).toFixed(5)}),'rotate +15°')}}
  // cant: only an engine on a radial line has an outward direction to tilt toward
  const eng=PARTS[n.k].kind==='engine'?ps.find(p=>p.phi!=null):null;
  if(eng){const r=row('cant'),c=n.cant||0,v=document.createElement('span');v.textContent=` ${c.toFixed(2)}° `;
    if(c)v.title=`${((1-Math.cos(c*Math.PI/180))*100).toFixed(1)}% of each engine's thrust goes sideways (cancels between symmetric copies)`;
    const set=x=>edit(()=>{x=Math.round(clamp(x,-30,30)*100)/100;if(x)n.cant=x;else delete n.cant});
    btn(r,'−',false,()=>set(c-1),'cant 1° less (below 0 the nozzle tilts inward)');r.appendChild(v);btn(r,'+',false,()=>set(c+1),'cant 1° more: the nozzle tilts outward, the thrust leans in toward the axis');
    btn(r,'balance',false,()=>{const a=aimCant(eng);if(Math.abs(a-c)<0.01)note('Balanced: the engines burning with this one already push through the centre of mass');else set(a)},
      'cant so that all the engines burning with this one push through the centre of mass: no turning moment for the controls to fight')}
  // a rover mount: which rover is packed on it (a copy of the design as it is now; the Rover yard makes the designs)
  if(PARTS[n.k].kind==='rover'&&typeof rvDesigns==='function'){const r=row('rover'),L=rvDesigns(),s=document.createElement('select');
    s.style.cssText='font:inherit;background:rgba(0,0,0,.3);color:inherit;border:1px solid rgba(127,209,255,.22);max-width:160px';
    s.innerHTML='<option value="">— none —</option>'+L.map((d,i)=>`<option value="${i}">${String(d.name).replace(/</g,'&lt;')}</option>`).join('');
    s.value=n.rvd?String(Math.max(-1,L.findIndex(d=>d.name===n.rvd.name))):'';
    s.onchange=()=>{s.blur();edit(()=>{if(s.value===''||s.value==='-1')delete n.rvd;else{const d=JSON.parse(JSON.stringify(L[+s.value]));delete d.test;n.rvd=d}})};r.appendChild(s);
    const why=n.rvd&&ps[0]?rvMountWhy(ps[0],n.rvd):'',w=document.createElement('div');w.className=why?'warn':'sub';
    w.textContent=why||(n.rvd?`${Math.round(rvGeom(n.rvd).m)} kg, packed as it was then: changes in the Rover yard need it packed again`:'nothing packed');sel.appendChild(w)}
  const path=rootPath(D.root,n);if(par&&path&&path.slice(1).every(x=>x.at==='u'||x.at==='d'))
    {const r=row('root');btn(r,'make root',false,()=>edit(()=>reroot(path)),'re-hang the design from this part, so a subtree with the old root in it can be picked up (the rocket itself does not change)')}
  {const r=row('');btn(r,'pick up',false,()=>{const p=ps.find(p=>!p.inst.rdec)||ps[0];if(p)pickUp(p,false)});btn(r,'copy',false,()=>{const p=ps[0];if(p)pickUp(p,true)});
    btn(r,'delete'+(sub?` (+${sub})`:''),false,()=>{if(n===D.root&&!confirm('Delete the root part and everything on it?'))return;del(n)})}}
// ---- staging editor. Stages in firing order (1 fires first, with Space in flight); each chip is one action — a drop (a
// decoupling placement, all its copies), an ignition, or the chute — and a stage fires all of its chips in one press.
// (Q249, PLAYTEST #47) Drag a chip onto a stage to fire it there, or between stages (or past either end) for a stage of
// its own; drag a stage by its number onto another to merge them, or between two to move it. ⤵ splits a chip off, ⇣
// merges a stage with the next. The first edit freezes the automatic order into the design (stg); "automatic" drops it
// again. Parts added later slot in where the automatic order would put them.
// stgEdit: the pure move on a list of stages (atom ids). from {atom:[i,j]} or {stage:i}; to {row:k} (into stage k) or
// {gap:k} (a new place before stage k; k = L.length: after the last). Returns the new list, empty stages removed.
function stgEdit(L,from,to){L=L.map(s=>s.slice());if(from.stage!=null&&to.row===from.stage)return L;let moved;   // indices stay put until the end
  if(from.atom){const[i,j]=from.atom;moved=[L[i][j]];L[i].splice(j,1)}else{moved=L[from.stage];L[from.stage]=[]}
  if(to.row!=null)L[to.row].push(...moved)
  else L.splice(to.gap,0,moved.slice());
  return L.filter(s=>s.length)}
function staging(box){
  st.hiAtom=null;st.hiKey='';   // the chips are rebuilt: a removed chip never fires mouseleave, so its highlight would stick
  const A=assemble(stackDef),S0=A.stages,wrap=document.createElement('div');wrap.className='bstg';box.appendChild(wrap);
  wrap.innerHTML=`<div class="bhd2"><span>staging</span> <span class="dim">${A.custom?'custom':'automatic'}</span></div>`+
    (S0.length?`<div class="dim shint">drag an action onto a stage to fire it there, or between stages for a stage of its own; drag a stage's number to merge or move it</div>`:'');
  if(A.custom)btn(wrap.firstChild,'automatic',false,()=>edit(()=>{delete design().stg}),'forget the custom order and stage automatically again');
  const go=(from,to)=>edit(()=>{const D=design();D.stg=stgEdit(assemble(D).stages.map(s=>s.map(a=>a.id)),from,to)});
  let drag=null;   // what is being dragged: {atom:[i,j]} or {stage:i}
  const zone=(el,to)=>{el.addEventListener('dragover',e=>{if(!drag)return;e.preventDefault();e.dataTransfer.dropEffect='move';el.classList.add('over')});
    el.addEventListener('dragleave',()=>el.classList.remove('over'));
    el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('over');const f=drag;drag=null;if(f)go(f,to)})};
  const gap=k=>{const g=document.createElement('div');g.className='sgap';zone(g,{gap:k});wrap.appendChild(g)};
  const start=(el,what)=>{el.draggable=true;el.addEventListener('dragstart',e=>{drag=what;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain','stage')}catch(_){}wrap.classList.add('dragging');e.stopPropagation()});
    el.addEventListener('dragend',()=>{drag=null;wrap.classList.remove('dragging');wrap.querySelectorAll('.over').forEach(x=>x.classList.remove('over'))})};
  S0.forEach((s,i)=>{gap(i);const r=document.createElement('div');r.className='srow';wrap.appendChild(r);zone(r,{row:i});
    const h=document.createElement('b');h.className='snum';h.textContent=i+1;h.title='drag onto another stage to merge, or between stages to move it';start(h,{stage:i});r.appendChild(h);
    s.forEach((a,j)=>{const c=document.createElement('span');c.className='schip '+a.kind;c.innerHTML=`<span>${a.label}</span>`;c.title='drag to another stage, or between stages for a stage of its own';start(c,{atom:[i,j]});
      c.onmouseenter=()=>{st.hiAtom=a;st.hiKey=''};c.onmouseleave=()=>{if(st.hiAtom===a){st.hiAtom=null;st.hiKey=''}};
      if(s.length>1)btn(c,'⤵',false,()=>go({atom:[i,j]},{gap:i+1}),'a stage of its own, right after this one');r.appendChild(c)});
    if(i<S0.length-1){const m=btn(r,'⇣',false,()=>go({stage:i+1},{row:i}),`fire stage ${i+2} with this one, in one press`);m.className='smerge'}});
  if(S0.length)gap(S0.length)}
function palette(){const pal=el('palette');pal.innerHTML='';cardAt(null);
  const CAT=[['Command & payload',['pod','core','bio','sci','cam','ant','ballast']],['Crew escape',['les']],['Tanks',['tank']],['Engines',['engine']],['Structure',['dec','adapt','port','claw','bay']],['Station',['hab','lab','arm','beacon']],['Surface',['rover','leg']],['Power',['comp','batt','solar','rtg']],['Control',['rcs','gas','rwheel','spin']],['Aero & recovery',['cone','fins','rfin','chute','shield']]];
  // a part kind no category names still shows up, under "Other" — new parts from other sessions must not vanish
  const named=new Set(CAT.flatMap(c=>c[1])),rest=[...new Set(Object.values(PARTS).filter(d=>!d.radialOnly&&!named.has(d.kind)).map(d=>d.kind))];
  if(rest.length)CAT.push(['Other',rest]);
  for(const[cat,kinds]of CAT){const h=document.createElement('div');h.className='pcat';h.textContent=cat;pal.appendChild(h);
    for(const k in PARTS){const d=PARTS[k];if(d.radialOnly||!kinds.includes(d.kind))continue;
      const b=document.createElement('button'),lk=typeof partOpen==='function'?partOpen(k):{ok:true};   // Q190: a part not open yet is listed, dimmed, with its reason
      const spec=d.kind==='engine'?`${d.thrust} kN · ${d.ispV}s`:d.kind==='tank'?`${d.wet} t`:`${d.m} t`;
      b.innerHTML=`${d.name}<span>${lk.ok?spec:'🔒 '+lk.short}</span>`;if(!lk.ok)b.classList.add('lock');
      b.onmouseenter=()=>cardAt(b,k);b.onmouseleave=()=>cardAt(null);
      if(st.held&&st.held.k===k&&!kids(st.held).length)b.classList.add('on');
      b.onclick=()=>st.held&&st.held.k===k&&!kids(st.held).length?drop():grab(k);pal.appendChild(b)}}
  const pre=el('presets');pre.innerHTML='';
  {const b=document.createElement('button');b.textContent='✕ Empty';b.title='start from scratch: clear the design (Ctrl+Z brings it back)';b.style.margin='0 4px 4px 0';b.disabled=isEmpty(stackDef);b.onclick=clearDesign;pre.appendChild(b)}
  for(const k in PRESETS){const b=document.createElement('button');b.textContent=k;b.style.margin='0 4px 4px 0';b.onclick=()=>{snapshot();loadDesign(PRESETS[k])};pre.appendChild(b)}
  library(pre)}
// ---- your designs: save the one on the stand under a name; every launch files its design under "Launched" (designLaunched)
function library(box){if(typeof designLib!=='function'||typeof PROG==='undefined')return;const L=designLib(),w=document.createElement('div');w.className='blib';box.appendChild(w);
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  w.innerHTML=`<div class="pcat">Your designs</div><div class="blsave"><input id="blName" maxlength="40" placeholder="name this design" value="${esc(st.libName||'')}"><button id="blSave" ${isEmpty(stackDef)?'disabled':''}>Save</button></div>`+
    (L.saved.length?L.saved.map((e,i)=>`<div class="blrow"><button data-lib="s${i}" title="load it (Ctrl+Z goes back)">${esc(e.name)}</button><span class="dim">day ${Math.floor(e.day||0)}</span><button data-libdel="${i}" title="forget this design">✕</button></div>`).join(''):'<div class="sub">Nothing saved yet.</div>')+
    `<div class="pcat">Launched</div>`+(L.launched.length?L.launched.slice(0,8).map((e,i)=>`<div class="blrow"><button data-lib="l${i}" title="load it (Ctrl+Z goes back)">${esc(e.name)}</button><span class="dim">day ${Math.floor(e.day||0)}${e.n>1?` · ×${e.n}`:''}</span></div>`).join('')+(L.launched.length>8?`<div class="sub">and ${L.launched.length-8} older</div>`:''):'<div class="sub">Every launch keeps its design here.</div>');
  const inp=w.querySelector('#blName');inp.oninput=()=>{st.libName=inp.value};inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')w.querySelector('#blSave').click()};
  w.querySelector('#blSave').onclick=()=>{if(isEmpty(stackDef))return;const e=designSave(inp.value,design());st.libName='';HOOK.save&&HOOK.save();palette();note(`Saved as “${e.name}”`)};
  w.onclick=ev=>{const b=ev.target.closest('[data-lib],[data-libdel]');if(!b)return;
    if(b.dataset.libdel!=null){const e=L.saved[+b.dataset.libdel];if(!e)return;L.saved.splice(+b.dataset.libdel,1);HOOK.save&&HOOK.save();palette();note(`Forgot “${e.name}”`);return}
    const id=b.dataset.lib,e=(id[0]==='s'?L.saved:L.launched)[+id.slice(1)];if(!e)return;snapshot();loadDesign(e.stack);if(id[0]==='s')st.libName=e.name;note(`Loaded “${e.name}” (Ctrl+Z goes back)`)}}
// light refresh (no reassembly): the toolbar, palette highlight, status line
function refresh(){panel();palette();const t=el('target');if(t)t.innerHTML=statusHTML();update()}
// after editorChanged has rebuilt S from the design
const LIFT=3;   // in the editor the ship hangs this far above the pad (as in a VAB), so parts can go under its bottom
// (Q247, PLAYTEST #44) The design stays where it was while it is edited: the root part keeps its place on screen and
// above the pad (or the desk's base plate). Removing parts underneath leaves the rest hanging, `gap` above the plate;
// building below the plate pushes the plate down, never the rocket up. A preset or a saved design starts on the plate;
// since Q327 (PLAYTEST #78) the first part, or the whole rocket moved by its root, hangs where it is put down (placeRoot),
// another root keeps the height, and undo brings the height back with the design. pin = {id, y: the root's bottom above the design's bottom, c: … above the CoM}
const rootPart=()=>S.parts.find(p=>p.core&&p.dn&&!p.dn.at);
function pinTo(){const r=!isEmpty(stackDef)&&rootPart(),old=st.pin;
  if(!r){st.pin=null;st.gap=0;return}
  const p={id:isV2(stackDef)?r.dn.id:'preset',y:r.y0,c:r.y0-S.cm[1]};st.pin=p;   // a preset's first edit keeps its root (design())
  if(st.hang!=null){st.gap=st.hang;st.hang=null;return}   // put down at a height (placeRoot) or undone to one (Q327)
  if(st.reframe||!old){st.gap=0;return}
  if(old.id!==p.id&&old.id!=='preset')return;   // another part made the root: the design itself didn't move (Q327)
  st.gap=Math.max(0,old.y+(st.gap||0)-p.y);   // the plate stays put unless the design now reaches below it
  cam.edY=(cam.edY||0)+p.c-old.c}             // the camera looks at the CoM: follow the shift so the root stays still
function changed(){
  if(isEmpty(stackDef)){shipMesh&&shipMesh.free();shipMesh=null;if(S)S.ana=null;st.pin=null}   // the plate stays put while it's empty (Q327)
  else{pinTo();S.pf=mul(S.site.u,TELLUS.R+S.site.h-S.yBot+LIFT+st.gap);syncLanded(S)}   // above the chosen launch site's levelled pad
  st.hover=null;st.ghostKey='';st.hiKey='';refresh()}
// the plate the design stands on, in the ship's frame (y from the CoM): its bottom, or lower while parts below were removed
const foot=()=>S.yBot-(mode==='editor'&&st.gap||0);
function frameCam(){if(!st.reframe||isEmpty(stackDef))return;st.reframe=false;
  let w=0;for(const p of S.parts)w=Math.max(w,Math.hypot(p.pos[0],p.pos[2])+p.d.r);cam.dist=Math.max(14,S.len*1.5,w*12);cam.pitch=-0.05;cam.edY=0}

// ---- input. Capture-phase on window, so the main script's camera drag only sees what we let through.
function init(){if(st.inited)return;st.inited=true;HOOK.edStill=true;HOOK.edDraw=draw;HOOK.edOverlay=overlay;
  const css=document.createElement('style');css.textContent=`
.bmounts{display:flex;gap:2px;align-items:center;flex-wrap:wrap;margin-top:4px;color:var(--fg)}.bmounts button{padding:0 4px;font-size:11px}.bmounts button.on{background:var(--acc);color:#000}
.blsave{display:flex;gap:4px;margin:2px 0 4px}.blsave input{flex:1;min-width:0;font:inherit;font-size:11px;background:rgba(0,0,0,.3);color:inherit;border:1px solid var(--line);padding:1px 4px}
.blrow{display:flex;gap:4px;align-items:center;margin:2px 0}.blrow button:first-child{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.blrow .dim{font-size:10.5px;white-space:nowrap}.blrow button[data-libdel]{padding:0 5px}
.pcat{color:var(--acc);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;margin:8px 0 2px}
#palette button.lock{opacity:.5}#palette button.lock span{color:var(--warn)}
.bbar{display:flex;flex-direction:column;gap:4px;margin-bottom:6px}.bgrp{display:flex;gap:3px;flex-wrap:wrap;align-items:center}.bgrp .dim{margin-right:3px}
.bbar button,.bsel button{padding:1px 6px;font-size:11px}.bbar button:disabled{opacity:.35;cursor:default}
.bsel{border-top:1px solid var(--line);padding-top:6px}.bhd{font-size:13px}.brow{display:flex;gap:3px;align-items:center;flex-wrap:wrap;margin-top:4px}.brow>.dim{min-width:70px}
.bstg{border-top:1px solid var(--line);padding:6px 0 4px;margin-bottom:4px}.bhd2{display:flex;gap:6px;align-items:center;color:var(--acc);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px}.bhd2 button{margin-left:auto;text-transform:none;letter-spacing:0;padding:0 6px;font-size:10.5px}
.shint{font-size:10.5px;margin-bottom:3px}.snum{cursor:grab}.schip{cursor:grab}.srow.over{background:rgba(127,209,255,.14)}.sgap{height:3px;border-radius:3px}.bstg.dragging .sgap{height:8px}.sgap.over{height:16px;border:1px dashed var(--acc);background:rgba(127,209,255,.1)}.smerge{margin-left:auto;padding:0 5px;font-size:10.5px}
.srow{display:flex;flex-wrap:wrap;gap:3px;align-items:center;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05)}.srow>b{color:var(--warn);min-width:16px}
.schip{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:3px;padding:0 2px 0 5px;font-size:11px}.schip.d{border-color:rgba(255,180,84,.5)}.schip.i{border-color:rgba(125,255,168,.45)}.schip.c{border-color:rgba(127,209,255,.5)}.schip button{padding:0 3px;font-size:10px;border:0;background:none}.schip button:hover{background:rgba(127,209,255,.2)}
#partcard{position:fixed;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:6px 10px;font-size:11.5px;display:none;z-index:6;width:260px}
#partcard table{border-collapse:collapse;margin-top:4px;width:100%}#partcard td{padding:1px 0;vertical-align:top;text-align:left}#partcard td:first-child{color:var(--dim);padding-right:8px;white-space:nowrap}
.pcs{color:var(--fg);margin:2px 0;line-height:1.35}#bldtip .pcs{max-width:260px;white-space:normal}
#bldtip{position:fixed;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:4px 8px;font-size:11.5px;display:none;z-index:5}
#bldhelp{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);font-size:11px;color:var(--dim);background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:3px 10px;pointer-events:none;white-space:nowrap}
#bldhelp b{color:var(--fg);font-weight:normal}`;document.head.appendChild(css);
  const help=document.createElement('div');help.id='bldhelp';help.innerHTML='<b>click</b> pick/place (in the air: park) · <b>right-click</b> options/drop · <b>X</b> radial mounts · <b>C</b> snap · <b>R</b> decoupler · <b>Del</b> delete · <b>Ctrl+Z</b> undo · <b>drag</b> orbit · <b>Shift+wheel</b> up/down';
  el('editor').appendChild(help);
  const cvs=el('gl'),cpos=e=>[e.clientX*cvs.width/cvs.clientWidth,e.clientY*cvs.height/cvs.clientHeight];
  addEventListener('mousedown',e=>{if(mode!=='editor'||e.target!==cvs)return;st.mouse=cpos(e);update();
    if(e.button===1||e.button===0&&e.shiftKey&&!st.held){st.pan=[e.clientY];e.preventDefault();e.stopPropagation();return}
    st.press={x:e.clientX,y:e.clientY,b:e.button,mod:{ctrl:e.ctrlKey||e.metaKey||e.altKey,shift:e.shiftKey}};
    if(e.button===0&&(st.held||st.hover))e.stopPropagation()},true);   // left on a part or while holding: ours; elsewhere: orbit
  addEventListener('mousemove',e=>{if(mode!=='editor')return;
    if(st.pan){const dy=e.clientY-st.pan[0];st.pan[0]=e.clientY;cam.edY=clamp((cam.edY||0)+dy*cam.dist*.0016,-S.len,S.len);return}
    st.mouse=e.target===cvs?cpos(e):null;if(st.press&&Math.hypot(e.clientX-st.press.x,e.clientY-st.press.y)>5)st.press.drag=true;update()});
  addEventListener('mouseup',e=>{if(mode!=='editor')return;const p=st.press;st.press=null;if(st.pan){st.pan=false;return}
    if(!p||p.drag||e.target!==cvs)return;
    if(p.b===0){if(st.held){const s=st.slot;if(s&&!s.bad)place(s,p.mod.shift);else if(s&&s.bad)note('Blocked: it would overlap a part');else if(!s)parkHeld(p.mod.shift)}
      else if(st.hover){const pp=S.parts.find(q=>q.on&&q.dn===st.hover&&!q.inst.rdec)||S.parts.find(q=>q.dn===st.hover)||parkedInst().find(q=>q.dn===st.hover);if(pp)pickUp(pp,p.mod.ctrl)}
      else if(st.sel){st.sel=null;refresh()}}
    else if(p.b===2){if(st.held)drop();else if(st.hover){st.sel=st.hover;refresh()}else if(st.sel){st.sel=null;refresh()}}
    update()});
  cvs.addEventListener('contextmenu',e=>{if(mode==='editor')e.preventDefault()});
  addEventListener('wheel',e=>{if(mode!=='editor'||e.target!==cvs||!e.shiftKey)return;e.preventDefault();e.stopPropagation();
    const d=(e.deltaY||e.deltaX)*(e.deltaMode===1?33:e.deltaMode===2?400:1);   // pixels; one mouse notch ≈ 100
    cam.edY=clamp((cam.edY||0)-clamp(d,-150,150)/100*cam.dist*.015,-S.len,S.len)},{capture:true,passive:false});
  addEventListener('keydown',e=>{if(mode!=='editor'||typeof atHQ!=='undefined'&&(atHQ||atDeb||atRoll||atMC)||e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?restore(st.redo,st.undo):restore(st.undo,st.redo);return}
    if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();restore(st.redo,st.undo);return}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(k==='x'){const i=SYM.indexOf(st.sym);st.sym=SYM[(i+(e.shiftKey?SYM.length-1:1))%SYM.length];st.ghostKey='';refresh()}
    else if(k==='c'){st.snap=!st.snap;refresh()}
    else if(k==='r'){st.dec=!st.dec;refresh()}
    else if(k==='escape'){if(st.held)drop();else if(st.sel){st.sel=null;refresh()}}
    else if(k==='delete'||k==='backspace'){e.preventDefault();if(st.held){const h=st.held;drop();note(`${name(h.k)} discarded (undo brings it back)`)}else if(st.hover)del(st.hover);else if(st.sel)del(st.sel)}});
  el('target').addEventListener('click',e=>{const b=e.target.closest('[data-sym]');if(!b)return;st.sym=+b.dataset.sym;st.ghostKey='';refresh()});
  palette()}
return{stgEdit,parkedInst,proj,aimCant,ensureIds,reroot,rootPath,init,panel:changed,palette,frameCam,isEmpty,design,draw,overlay,grab,drop,cancel:drop,load:loadDesign,foot,partInfo,partSpecs,st};
})();
