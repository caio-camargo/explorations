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

// ---- design access. A preset stays in the old array format (so its saved autopilot tape still matches) until the
// first edit; then the tree that the current ship was assembled from becomes the design, so S.parts[].dn are its nodes.
function design(){
  if(!isV2(stackDef)){if(isEmpty(stackDef))stackDef={v:2,root:null};else{const r=S.parts.map(p=>p.dn).find(n=>!n.at);stackDef={v:2,root:r}}}
  return stackDef}
function snapshot(){st.undo.push(JSON.stringify(design()));if(st.undo.length>80)st.undo.shift();st.redo.length=0}
function restore(from,to){if(!from.length)return;to.push(JSON.stringify(stackDef));stackDef=JSON.parse(from.pop());st.held=null;st.sel=null;st.hover=null;editorChanged()}
function loadDesign(d){st.held=null;st.sel=null;st.hover=null;stackDef=cl(d);st.reframe=true;editorChanged()}
function detachNode(n){const D=design();if(n===D.root){D.root=null;return}const p=parentOf(D.root,n);if(p)p.c.splice(p.c.indexOf(n),1)}

// ---- geometry: vessel frame (y along the stack, the ship's own coordinates) ↔ world ↔ screen
const V=()=>HOOK.view;
function toWorld(v){return add(shipWorld(),qrot(S.q,sub(v,S.cm)))}
function proj(v){const w=V();if(!w)return null;const q=sub(toWorld(v),w.camW),z=dot(q,w.Fw);if(z<=0)return null;
  return[w.W/2*(1+dot(q,w.R)/(z*w.tanX)),w.H/2*(1-dot(q,w.U)/(z*w.tanY))]}
function mouseRay(){const w=V(),m=st.mouse;if(!w||!m)return null;const x=(2*m[0]/w.W-1)*w.tanX,y=(1-2*m[1]/w.H)*w.tanY;
  const dw=norm(add(w.Fw,add(mul(w.R,x),mul(w.U,y)))),qi=qconj(S.q);return{o:add(qrot(qi,sub(w.camW,shipWorld())),S.cm),d:qrot(qi,dw)}}
// a ray against one part's surface of revolution: each profile segment is a cone frustum around the part's axis
function hitPart(p,o,d){const pr=p.inst&&p.inst.rdec?[[.2,0],[.2,p.h]]:p.d.prof,ax=o[0]-p.pos[0],az=o[2]-p.pos[2];let best=null;
  for(let i=0;i<pr.length-1;i++){let[r0,ya]=pr[i],[r1,yb]=pr[i+1];ya+=p.y0;yb+=p.y0;if(yb-ya<1e-6)continue;
    const k=(r1-r0)/(yb-ya),c=r0+k*(o[1]-ya),A=d[0]*d[0]+d[2]*d[2]-k*k*d[1]*d[1],B=2*(ax*d[0]+az*d[2]-c*k*d[1]),C=ax*ax+az*az-c*c;
    const ts=[];if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)ts.push(-C/B)}else{const D=B*B-4*A*C;if(D>=0){const s=Math.sqrt(D);ts.push((-B-s)/(2*A),(-B+s)/(2*A))}}
    for(const t of ts){if(t<=0)continue;const y=o[1]+t*d[1];if(y<ya-1e-6||y>yb+1e-6||c+k*t*d[1]<0)continue;if(!best||t<best.t)best={t,y}}}
  return best}
function rayHit(r){let best=null;if(!r||isEmpty(stackDef))return null;
  for(const p of S.parts){if(!p.on)continue;const h=hitPart(p,r.o,r.d);if(h&&(!best||h.t<best.t))best={p,t:h.t,pt:add(r.o,mul(r.d,h.t))}}return best}

// ---- where the held part would go. Stack nodes near the cursor win; else the surface under it; else nowhere.
function heldNeeds(h){const k=kids(h);return{top:!k.some(c=>c.at==='u'),bot:!k.some(c=>c.at==='d')}}
function stackSlots(){const out=[];if(isEmpty(stackDef))return out;
  for(const p of S.parts){if(!p.on||p.inst.rdec)continue;const n=p.dn,k=kids(n);
    const topFree=n.at!=='d'&&!k.some(c=>c.at==='u'),botFree=n.at!=='u'&&!k.some(c=>c.at==='d');
    if(topFree)out.push({p,side:'u',v:[p.pos[0],p.y0+p.h,p.pos[2]]});if(botFree)out.push({p,side:'d',v:[p.pos[0],p.y0,p.pos[2]]})}
  return out}
function findSlot(){const h=st.held;if(!h||!st.mouse)return null;
  if(isEmpty(stackDef))return{root:true};
  const need=heldNeeds(h),m=st.mouse;let best=null,bd=NODE_PX*DPR();
  for(const s of stackSlots()){if(s.side==='u'&&!need.bot||s.side==='d'&&!need.top)continue;const q=proj(s.v);if(!q)continue;
    const dd=Math.hypot(q[0]-m[0],q[1]-m[1]);if(dd<bd){bd=dd;best=s}}
  if(best)return{p:best.p,at:best.side};
  const hit=rayHit(mouseRay());if(!hit||hit.p.inst.rdec)return null;
  const p=hit.p,I=p.inst;let a=Math.atan2(hit.pt[2]-p.pos[2],hit.pt[0]-p.pos[0])-I.rot,y=clamp(hit.pt[1]-p.y0,0,p.h);
  if(st.snap)a=Math.round(a/SNAP_A)*SNAP_A;a=((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  const cy=PARTS[h.k].h/2;
  if(st.snap){ // align the held line's bottom or top with a part boundary on the host's line, when close
    const L=lineOf(h),lo=Math.min(...L.map(q=>q.y)),hi=Math.max(...L.map(q=>q.y+PARTS[q.nd.k].h)),yb=p.y0+y-cy;let bestD=SNAP_Y,dy=0;
    for(const q of S.parts)if(q.on&&!q.inst.rdec&&q.inst.line===I.line)for(const b of[q.y0,q.y0+q.h])for(const e of[yb+lo,yb+hi])if(Math.abs(b-e)<bestD){bestD=Math.abs(b-e);dy=b-e}
    y=clamp(y+dy,0,p.h)}
  const at={y:+y.toFixed(3),a:+a.toFixed(5),n:st.sym,cy};if(st.dec)at.dec=true;
  return{p,at}}
// lay the design out with the held part tentatively attached; returns the held instances in vessel coordinates
function trial(slot){const h=st.held,old=h.at,D=design();let L;
  if(slot.root||!slot.p){delete h.at;L=layoutDesign({v:2,root:h})}
  else{const host=slot.p.dn;h.at=slot.at;kids(host).push(h);try{L=layoutDesign(D)}finally{host.c.pop()}}
  if(old===undefined)delete h.at;else h.at=old;
  const set=new Set(nodes(h)),sh=isEmpty(stackDef)?0:S.parts[0].y0-S.parts[0].inst.y0;
  return L.inst.filter(q=>set.has(q.nd)).map(q=>({d:q.d,pos:[q.x,0,q.z],y0:q.y0+sh,h:q.d.h,phi:q.phi,rdec:q.rdec}))}
function collides(G){const ex=isEmpty(stackDef)?[]:S.parts.filter(p=>p.on&&!p.inst.rdec);const all=[...G.filter(g=>!g.rdec)];
  const hit=(a,b)=>{const dx=Math.hypot(a.pos[0]-b.pos[0],a.pos[2]-b.pos[2]),oy=Math.min(a.y0+a.h,b.y0+b.h)-Math.max(a.y0,b.y0);
    return dx<1e-3?oy>1e-3:dx<a.d.r+b.d.r-0.02&&oy>0.02};
  for(let i=0;i<all.length;i++){for(const e of ex)if(hit(all[i],e))return true;for(let j=i+1;j<all.length;j++)if(hit(all[i],all[j]))return true}
  return false}
function place(slot,keep){const h=st.held;snapshot();const D=design(),put=keep?cl(h):h;
  if(slot.root){delete put.at;D.root=put;st.reframe=true}else{put.at=cl(slot.at);kids(slot.p.dn).push(put)}
  if(!keep){st.held=null;st.sel=put}st.ghostKey='';editorChanged()}
function pickUp(p,copy){const n=p.dn,D=design();
  if(!copy&&n===D.root&&kids(n).length){note('That is the root part: everything hangs from it. Pick up the parts around it instead.');return}
  if(copy){st.held=cl(n);delete st.held.at;st.sel=null;st.ghostKey='';refresh();return}
  snapshot();detachNode(n);st.held=n;st.sel=null;st.ghostKey='';editorChanged()}
function grab(k){st.held={k,c:[]};st.sel=null;st.ghostKey='';refresh();note(`${name(k)}: click a glowing node or the side of a part`)}
function drop(){if(!st.held)return;st.held=null;st.ghostKey='';refresh()}
function del(n){if(!n)return;snapshot();detachNode(n);if(st.sel&&nodes(n).includes(st.sel))st.sel=null;editorChanged()}
let noteT=0;function note(t){st.msg=t;noteT=performance.now();const e=el('target');if(e)e.innerHTML=statusHTML()}
function statusHTML(){
  if(st.msg&&performance.now()-noteT<6000)return`<span class="acc">${st.msg}</span>`;
  if(st.held)return`holding <b>${name(st.held.k)}</b>${nodes(st.held).length>1?` +${nodes(st.held).length-1}`:''} · click a glowing node or a surface · right-click drops it`;
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
function hiMesh(){const key=st.hover?String(S.parts.findIndex(p=>p.dn===st.hover))+(st.sel===st.hover):'';
  const sel=st.sel&&!st.held?S.parts.filter(p=>p.on&&p.dn===st.sel):[],hov=st.hover?S.parts.filter(p=>p.on&&p.dn===st.hover):[];
  const k2=key+'|'+sel.map(p=>p.i).join(',');if(k2===st.hiKey)return st.hi;st.hiKey=k2;
  if(st.hi){st.hi.h&&st.hi.h.free();st.hi.s&&st.hi.s.free()}st.hi={h:meshOf(hov,[.5,.8,1]),s:meshOf(sel,[1,.75,.3])};return st.hi}
// called from render() after the ship is drawn, with the mesh program bound
function draw(drawMesh,m,Mship,pw){
  if(mode!=='editor')return;
  const g=st.held?ghostMeshes():null,hi=hiMesh();
  if(g&&g.solid){gl.uniform1f(m.uSeam,1);drawMesh(g.solid,Mship,pw);gl.uniform1f(m.uSeam,0)}
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);gl.depthFunc(gl.LEQUAL);
  const pulse=.5+.5*Math.sin(performance.now()/180);
  if(hi.h){gl.uniform1f(m.uGlow,.22);drawMesh(hi.h,Mship,pw)}
  if(hi.s){gl.uniform1f(m.uGlow,.16+.1*pulse);drawMesh(hi.s,Mship,pw)}
  if(g&&g.glow){let M=Mship;
    if(g.float){const r=mouseRay();if(r){const w=V(),dist=len(sub(w.camW,shipWorld())),T=add(r.o,mul(r.d,dist));M=mmul(Mship,mat4([1,0,0],[0,1,0],[0,0,1],[T[0],T[1]-g.c,T[2]]))}}
    gl.uniform1f(m.uGlow,g.float?.35:g.bad?.55:.18+.12*pulse);drawMesh(g.glow,M,pw)}
  gl.uniform1f(m.uGlow,0);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND)}
// called from render() on the 2D overlay
function overlay(o){
  if(mode!=='editor'||isEmpty(stackDef))return;const k=DPR();o.save();o.font=`${11*k}px ui-monospace,Consolas,monospace`;o.textAlign='left';
  if(st.loads&&!st.held){const seen=[];
    for(const p of S.parts){if(!p.on||!p.parent)continue;const f=certFrac(p);if(f==null)continue;const q=proj(p.jP);if(!q)continue;
      const c=f>1?'#ff6b6b':f>.7?'#ffb454':'#7dffa8';o.fillStyle=c;o.beginPath();o.arc(q[0],q[1],(f>.7?3.5:2.5)*k,0,7);o.fill();
      if(f<.3||seen.some(s=>Math.hypot(s[0]-q[0],s[1]-q[1])<26*k))continue;seen.push(q);
      o.lineWidth=3*k;o.strokeStyle='rgba(0,0,0,.8)';const t=(f*100).toFixed(0)+'%';o.strokeText(t,q[0]+6*k,q[1]+4*k);o.fillText(t,q[0]+6*k,q[1]+4*k)}}
  if(st.held){const need=heldNeeds(st.held),s=st.slot;
    for(const n of stackSlots()){if(n.side==='u'&&!need.bot||n.side==='d'&&!need.top)continue;const q=proj(n.v);if(!q)continue;
      const on=s&&s.p===n.p&&s.at===n.side;o.strokeStyle=on?(s.bad?'#ff6b6b':'#7dffa8'):'rgba(127,209,255,.75)';o.lineWidth=(on?2.5:1.5)*k;
      o.beginPath();o.arc(q[0],q[1],(on?8:5)*k,0,7);o.stroke()}
    if(s&&radAt(s.at)){const m=st.mouse;o.fillStyle=s.bad?'#ff6b6b':'#7dffa8';o.lineWidth=3*k;o.strokeStyle='rgba(0,0,0,.8)';
      const t=`${s.bad?'blocked · ':''}radial ×${s.at.n} · ${(s.at.a*180/Math.PI).toFixed(0)}° · ${s.at.y.toFixed(2)} m up ${name(s.p.d.key)}${s.at.dec?' · decoupler':''}`;
      o.strokeText(t,m[0]+16*k,m[1]+28*k);o.fillText(t,m[0]+16*k,m[1]+28*k)}
    else if(s&&s.bad){const m=st.mouse;o.fillStyle='#ff6b6b';o.fillText('blocked: it would overlap a part',m[0]+16*k,m[1]+28*k)}}
  o.restore()}

// ---- tooltip and panels
function tooltip(){let t=el('bldtip');if(!t){t=document.createElement('div');t.id='bldtip';document.body.appendChild(t)}
  const n=st.hover;if(!n||mode!=='editor'||st.held||!st.mouse){t.style.display='none';return}
  const ps=S.parts.filter(p=>p.on&&p.dn===n),w=ps.reduce((a,p)=>{const f=certFrac(p);return f!=null&&f>(a?a.f:-1)?{f,p}:a},null);
  t.innerHTML=`<b>${name(n.k)}</b>${ps.filter(p=>!p.inst.rdec).length>1?` <span class="dim">×${ps.filter(p=>!p.inst.rdec).length}</span>`:''}`+
    (w?`<br>joint <span class="${w.f>1?'bad':w.f>.7?'warn':'ok'}">${(w.f*100).toFixed(0)}%</span> <span class="dim">${w.p.anaKind||''}</span>`:'')+
    `<br><span class="dim">click: pick up · right-click: options</span>`;
  const k=V()?V().W/innerWidth:1;t.style.display='block';t.style.left=(st.mouse[0]/k+14)+'px';t.style.top=(st.mouse[1]/k+14)+'px'}
function btn(parent,label,on,fn,tip){const b=document.createElement('button');b.textContent=label;if(on)b.className='on';if(tip)b.title=tip;b.onclick=e=>{e.stopPropagation();fn()};parent.appendChild(b);return b}
function edit(fn){snapshot();fn();editorChanged()}
function panel(){
  const box=el('stack');if(!box)return;box.innerHTML='';
  const bar=document.createElement('div');bar.className='bbar';box.appendChild(bar);
  const sy=document.createElement('div');sy.className='bgrp';sy.innerHTML='<span class="dim">symmetry</span>';for(const n of SYM)btn(sy,'×'+n,st.sym===n,()=>{st.sym=n;refresh()},'radial copies around the host part [X]');bar.appendChild(sy);
  const t2=document.createElement('div');t2.className='bgrp';bar.appendChild(t2);
  btn(t2,'snap',st.snap,()=>{st.snap=!st.snap;refresh()},'snap radial angles to 15° and line ends to the host\'s part boundaries [C]');
  btn(t2,'radial decoupler',st.dec,()=>{st.dec=!st.dec;refresh()},'radial parts go on through a decoupler, so they become a stage you can drop [R]');
  btn(t2,'loads',st.loads,()=>{st.loads=!st.loads;refresh()},'joint loads (worst of liftoff and max-q, against certified ratings) at every joint');
  const t3=document.createElement('div');t3.className='bgrp';bar.appendChild(t3);
  btn(t3,'↶ undo',false,()=>restore(st.undo,st.redo),'Ctrl+Z').disabled=!st.undo.length;
  btn(t3,'↷ redo',false,()=>restore(st.redo,st.undo),'Ctrl+Y').disabled=!st.redo.length;
  btn(t3,'clear',false,()=>{if(isEmpty(stackDef))return;snapshot();stackDef={v:2,root:null};st.sel=null;editorChanged()},'remove every part (undo brings them back)');
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
  if(radAt(n.at)){const a=n.at;
    {const r=row('copies');for(const k of SYM)btn(r,'×'+k,a.n===k,()=>edit(()=>{a.n=k}))}
    {const r=row('decoupler');btn(r,a.dec?'radial decoupler':'fixed',!!a.dec,()=>edit(()=>{if(a.dec){delete a.dec;delete a.x}else a.dec=true}),'with a decoupler the radial parts are a stage of their own; without, they stay on for good');
      if(a.dec)btn(r,a.x?'crossfeed ✓':'no crossfeed',!!a.x,()=>edit(()=>{if(a.x)delete a.x;else a.x=true}),'the radial parts feed the engines they hang on too, and run dry first')}
    {const r=row('move');const hp=PARTS[par.k].h;
      btn(r,'▲',false,()=>edit(()=>{a.y=+Math.min(hp,a.y+.1).toFixed(3)}),'up 0.1 m');btn(r,'▼',false,()=>edit(()=>{a.y=+Math.max(0,a.y-.1).toFixed(3)}),'down 0.1 m');
      btn(r,'⟲',false,()=>edit(()=>{a.a=+(a.a-SNAP_A).toFixed(5)}),'rotate −15°');btn(r,'⟳',false,()=>edit(()=>{a.a=+(a.a+SNAP_A).toFixed(5)}),'rotate +15°')}}
  {const r=row('');btn(r,'pick up',false,()=>{const p=ps.find(p=>!p.inst.rdec)||ps[0];if(p)pickUp(p,false)});btn(r,'copy',false,()=>{const p=ps[0];if(p)pickUp(p,true)});
    btn(r,'delete'+(sub?` (+${sub})`:''),false,()=>{if(n===D.root&&!confirm('Delete the root part and everything on it?'))return;del(n)})}}
function palette(){const pal=el('palette');pal.innerHTML='';
  const CAT=[['Command & payload',['pod','bio','sci','ballast']],['Tanks',['tank']],['Engines',['engine']],['Structure',['dec','adapt']],['Aero & recovery',['cone','fins','chute','shield']]];
  for(const[cat,kinds]of CAT){const h=document.createElement('div');h.className='pcat';h.textContent=cat;pal.appendChild(h);
    for(const k in PARTS){const d=PARTS[k];if(d.radialOnly||!kinds.includes(d.kind))continue;const b=document.createElement('button');
      const spec=d.kind==='engine'?`${d.thrust} kN · ${d.ispV}s`:d.kind==='tank'?`${d.wet} t`:`${d.m} t`;
      b.innerHTML=`${d.name}<span>${spec}</span>`;if(st.held&&st.held.k===k&&!kids(st.held).length)b.className='on';
      b.onclick=()=>st.held&&st.held.k===k&&!kids(st.held).length?drop():grab(k);pal.appendChild(b)}}
  const pre=el('presets');pre.innerHTML='';
  for(const k in PRESETS){const b=document.createElement('button');b.textContent=k;b.style.margin='0 4px 4px 0';b.onclick=()=>{snapshot();loadDesign(PRESETS[k])};pre.appendChild(b)}}
// light refresh (no reassembly): the toolbar, palette highlight, status line
function refresh(){panel();palette();const t=el('target');if(t)t.innerHTML=statusHTML();update()}
// after editorChanged has rebuilt S from the design
const LIFT=3;   // in the editor the ship hangs this far above the pad (as in a VAB), so parts can go under its bottom
function changed(){
  if(isEmpty(stackDef)){shipMesh&&shipMesh.free();shipMesh=null;if(S)S.ana=null}
  else{S.pf=[TELLUS.R-S.yBot+LIFT,0,0];syncLanded(S)}
  st.hover=null;st.ghostKey='';st.hiKey='';refresh()}
function frameCam(){if(!st.reframe||isEmpty(stackDef))return;st.reframe=false;
  let w=0;for(const p of S.parts)w=Math.max(w,Math.hypot(p.pos[0],p.pos[2])+p.d.r);cam.dist=Math.max(14,S.len*1.5,w*12);cam.pitch=-0.05;cam.edY=0}

// ---- input. Capture-phase on window, so the main script's camera drag only sees what we let through.
function init(){if(st.inited)return;st.inited=true;HOOK.edStill=true;HOOK.edDraw=draw;HOOK.edOverlay=overlay;
  const css=document.createElement('style');css.textContent=`
.pcat{color:var(--acc);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;margin:8px 0 2px}
.bbar{display:flex;flex-direction:column;gap:4px;margin-bottom:6px}.bgrp{display:flex;gap:3px;flex-wrap:wrap;align-items:center}.bgrp .dim{margin-right:3px}
.bbar button,.bsel button{padding:1px 6px;font-size:11px}.bbar button:disabled{opacity:.35;cursor:default}
.bsel{border-top:1px solid var(--line);padding-top:6px}.bhd{font-size:13px}.brow{display:flex;gap:3px;align-items:center;flex-wrap:wrap;margin-top:4px}.brow>.dim{min-width:70px}
#bldtip{position:fixed;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:4px 8px;font-size:11.5px;display:none;z-index:5}
#bldhelp{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);font-size:11px;color:var(--dim);background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:3px 10px;pointer-events:none;white-space:nowrap}
#bldhelp b{color:var(--fg);font-weight:normal}`;document.head.appendChild(css);
  const help=document.createElement('div');help.id='bldhelp';help.innerHTML='<b>click</b> pick/place · <b>right-click</b> options/drop · <b>X</b> symmetry · <b>C</b> snap · <b>R</b> decoupler · <b>Del</b> delete · <b>Ctrl+Z</b> undo · <b>drag</b> orbit · <b>Shift+wheel</b> up/down';
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
    if(p.b===0){if(st.held){const s=st.slot;if(s&&!s.bad)place(s,p.mod.shift);else if(s&&s.bad)note('Blocked: it would overlap a part')}
      else if(st.hover){const pp=S.parts.find(q=>q.on&&q.dn===st.hover&&!q.inst.rdec)||S.parts.find(q=>q.dn===st.hover);if(pp)pickUp(pp,p.mod.ctrl)}
      else if(st.sel){st.sel=null;refresh()}}
    else if(p.b===2){if(st.held)drop();else if(st.hover){st.sel=st.hover;refresh()}else if(st.sel){st.sel=null;refresh()}}
    update()});
  cvs.addEventListener('contextmenu',e=>{if(mode==='editor')e.preventDefault()});
  addEventListener('wheel',e=>{if(mode!=='editor'||e.target!==cvs||!e.shiftKey)return;e.preventDefault();e.stopPropagation();
    cam.edY=clamp((cam.edY||0)-Math.sign(e.deltaY||e.deltaX)*cam.dist*.06,-S.len,S.len)},{capture:true,passive:false});
  addEventListener('keydown',e=>{if(mode!=='editor'||e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?restore(st.redo,st.undo):restore(st.undo,st.redo);return}
    if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();restore(st.redo,st.undo);return}
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(k==='x'){const i=SYM.indexOf(st.sym);st.sym=SYM[(i+(e.shiftKey?SYM.length-1:1))%SYM.length];st.ghostKey='';refresh()}
    else if(k==='c'){st.snap=!st.snap;refresh()}
    else if(k==='r'){st.dec=!st.dec;refresh()}
    else if(k==='escape'){if(st.held)drop();else if(st.sel){st.sel=null;refresh()}}
    else if(k==='delete'||k==='backspace'){e.preventDefault();if(st.held){const h=st.held;drop();note(`${name(h.k)} discarded (undo brings it back)`)}else if(st.hover)del(st.hover);else if(st.sel)del(st.sel)}});
  palette()}
return{init,panel:changed,palette,frameCam,isEmpty,design,draw,overlay,grab,drop,cancel:drop,load:loadDesign,st};
})();
