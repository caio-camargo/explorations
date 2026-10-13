// app/map-layers.js — what the map shows (flow session, QUEUE Q261, PLAYTEST #61) and what it's centred on (Q262, PLAYTEST #62). A classic script sharing one global scope
// with the others; index.html loads it before render.js. 'use strict';
'use strict';
// The map got busy (Caio, 2026-10-10). Each of drawMap's passes belongs to a layer, and mapShow(k) says whether it's drawn.
// Layers [≡] beside Map [M] (map view only) opens the panel: one checkbox per layer, then Defaults. A layer you set is
// remembered per browser (localStorage, only what you changed); one you never touched follows the era's default, so a new
// thing turns up when it starts to matter. Your own ship, its orbit and plan, nodes, the target and impacts are always drawn.
const MAP_LAYERS=[['cities','Cities'],['stations','Ground stations'],['targets','Contract targets'],['sats','Our satellites and landers'],
  ['debris','Debris and spent stages'],['links','Links home'],['moons','Moons\' orbits and spheres of influence'],['planets','The planets and Helios'],['names','Names']];
const MAP_LAY_KEY='launchpad-map-layers';
let mapLaySet=(()=>{try{return JSON.parse(localStorage.getItem(MAP_LAY_KEY)||'{}')||{}}catch(e){return{}}})();
// the era's defaults: before anything of ours is in orbit the cities are the map's landmarks and the planets are far off;
// once it is (the beeper flown), the cities give way to the satellites and the planets come in (their missions are ahead)
function mapLayDefault(k){const orbit=eraOf()>=2;
  return k==='cities'?!orbit:k==='planets'?orbit:k==='debris'?orbit:true}
const mapShow=k=>k in mapLaySet?!!mapLaySet[k]:mapLayDefault(k);
function mapLaySave(){try{localStorage.setItem(MAP_LAY_KEY,JSON.stringify(mapLaySet))}catch(e){}}
function renderMapLay(){const el=$('mapLay');if(!el)return;
  el.innerHTML=`<div class="mlh">Show on the map <span class="x" data-ov="mapLay">✕</span></div>`
    +MAP_LAYERS.map(([k,l])=>`<label title="${k in mapLaySet?'set by you':'the default for this era'}"><input type="checkbox" data-mlay="${k}"${mapShow(k)?' checked':''}> ${l}${k in mapLaySet?'':' <span class="dim">auto</span>'}</label>`).join('')
    +`<div><button data-mlay-reset>Defaults</button> <span class="dim">auto: the era's default, until you set it</span></div>`}
$('bLay').onclick=()=>{const el=$('mapLay');if(el.classList.contains('hidden')){renderMapLay();ovOpen('mapLay')}else ovClose('mapLay')};
document.addEventListener('change',e=>{const k=e.target.dataset&&e.target.dataset.mlay;if(!k)return;mapLaySet[k]=e.target.checked;mapLaySave();renderMapLay()});
document.addEventListener('click',e=>{if(!e.target.dataset||e.target.dataset.mlayReset==null)return;mapLaySet={};mapLaySave();renderMapLay()});

// ---- what the map is centred on (QUEUE Q262, PLAYTEST #62; KSP's focus): the ship, a body, or one of our craft. It was
// only Tab, unlabelled. Now the Focus picker beside Layers lists them in words, a double-click on a body or a craft centres
// on it, Tab cycles the same list and Home comes back to the ship (not Backspace, KSP's key: here Backspace aborts).
// cam.focus stays the ship (0) or a body (its BODIES index + 1); mapFoc names a craft: {sat: registry id} or {ves: a vessel
// of this flight}. A craft that's gone (re-entered, docked, lost) hands the focus back to the ship.
let mapFoc=null;
function mapFocusList(){const L=[{key:'ship',name:`The ship${S&&S.name?`: ${S.name}`:''}`}];
  BODIES.forEach((b,i)=>{if(knownBody(b))L.push({key:`b:${i}`,name:b.name})});
  for(const q of[...satsUp(),...moonSats(),...landedUp()])if(!q.junk&&!q.docked)L.push({key:`s:${q.id}`,name:`${q.name}${q.landed?' (landed)':''}`});
  FLEET.forEach((v,i)=>{if(v.alive&&v!==S)L.push({key:`v:${i}`,name:`${v.name} (this flight)`})});
  return L}
const mapFocusKey=()=>mapFoc?(mapFoc.sat!=null?`s:${mapFoc.sat}`:`v:${FLEET.indexOf(mapFoc.ves)}`):cam.focus?`b:${cam.focus-1}`:'ship';
function mapCraftPos(){if(!mapFoc)return null;
  if(mapFoc.sat!=null){const q=(PROG.sats||[]).find(x=>x.id===mapFoc.sat);if(!q||q.junk||q.docked)return null;
    if(q.landed){const b=landedBody(q);return b?add(bodyPos(b,simT),fromPF(b,q.pf,simT)):null}
    try{return add(bodyPos(orbBody(q),simT),satAt(q,tNow())[0])}catch(e){return null}}
  const v=mapFoc.ves;return v&&v.alive&&FLEET.includes(v)?add(bodyPos(v.body,simT),v.r):null}
// the map camera's centre (render.js): the craft in focus, else the body, else the ship
function mapFocusPos(){if(mapFoc){const p=mapCraftPos();if(p)return p;mapFoc=null;renderMapFocus()}
  return cam.focus===0?shipWorld():bodyPos(BODIES[cam.focus-1],simT)}
function setMapFocus(key){const[k,x]=key.split(':');mapFoc=null;
  if(k==='ship'){cam.focus=0;const el=elements(S.r,S.v,S.body.mu);cam.mDist=clamp(3*Math.max(S.body.R*1.6,isFinite(el.ap)?el.ap:0),TELLUS.R*2,TELLUS.R*133)}
  else if(k==='b'){cam.focus=+x+1;const b=BODIES[+x];cam.mDist=b&&b.parent?b.R*9.15:5*TELLUS.R}
  else{cam.focus=0;mapFoc=k==='s'?{sat:+x}:{ves:FLEET[+x]};const p=mapCraftPos();if(!p){mapFoc=null;return setMapFocus('ship')}
    const q=k==='s'?(PROG.sats||[]).find(y=>y.id===+x):null,B=q?(q.landed?landedBody(q):orbBody(q)):mapFoc.ves.body;
    cam.mDist=clamp(3*Math.max(B.R*1.6,len(sub(p,bodyPos(B,simT)))),B.R*2,TELLUS.R*133)}   // (as the ship's: its body and orbit in view)
  renderMapFocus()}
function mapFocusCycle(d){const L=mapFocusList(),i=L.findIndex(f=>f.key===mapFocusKey());setMapFocus(L[(i+d+L.length)%L.length].key)}
function renderMapFocus(){const el=$('mapFocus');if(!el)return;const k=mapFocusKey();
  el.innerHTML=mapFocusList().map(f=>`<option value="${f.key}"${f.key===k?' selected':''}>Focus: ${f.name}</option>`).join('')}
$('mapFocus').addEventListener('mousedown',renderMapFocus);   // (the list as it is now: craft come and go)
$('mapFocus').addEventListener('change',e=>{setMapFocus(e.target.value);e.target.blur()});
// a double-click on the map: the body or craft under the pointer (a body by its disc, at least 14 px; a craft within 12 px)
cv.addEventListener('dblclick',e=>{if(view!=='map'||mode!=='flight')return;const V=HOOK.view;if(!V)return;const m=toCv(e),px=cv.width/cv.clientWidth;
  const at=p=>{const d=sub(p,V.camW),z=dot(d,V.Fw);return z>0?[(dot(d,V.R)/z/V.tanX+1)/2*V.W,(1-dot(d,V.U)/z/V.tanY)/2*V.H,z]:null};
  let best=null;const cand=(key,p,r)=>{const s=at(p);if(!s)return;const dd=Math.hypot(s[0]-m[0],s[1]-m[1]);if(dd<r&&(!best||dd<best.d))best={key,d:dd}};
  BODIES.forEach((b,i)=>{if(!knownBody(b))return;const p=bodyPos(b,simT),s=at(p);if(s)cand(`b:${i}`,p,Math.max(14*px,b.R/s[2]/V.tanY*V.H/2))});
  for(const f of mapFocusList()){if(f.key[0]!=='s'&&f.key[0]!=='v')continue;const save=mapFoc;mapFoc=f.key[0]==='s'?{sat:+f.key.slice(2)}:{ves:FLEET[+f.key.slice(2)]};const p=mapCraftPos();mapFoc=save;if(p)cand(f.key,p,12*px)}
  if(best){setMapFocus(best.key);HOOK.msg(`Map centred on ${mapFocusList().find(f=>f.key===best.key).name} · Home: back to the ship`)}});
