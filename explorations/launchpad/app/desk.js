// app/desk.js — the Program as the director's desk (flow session, QUEUE Q239 R1; NOTES § UI "Plan: real screens").
// A classic script sharing one global scope with the others; index.html loads it after screens.js and before
// program-ui.js (whose last line lays the Program out, which calls deskLayout). 'use strict';
'use strict';
// ---- the photo of the last flight: one frame, a moment after liftoff, kept per browser (it isn't game state).
// The WebGL canvas is read in the same task it was drawn in, so preserveDrawingBuffer isn't needed.
const PHOTO_KEY='launchpad-photo',PHOTO_AT=2.5;   // seconds after liftoff: clear of the tower, plume lit
let photoRec=null,photoT0=null;
function deskPhotoTick(){
  if(mode!=='flight'||!S||!S.rec||!S.rec.launched||S.rec===photoRec)return;
  if(photoT0===null||photoT0.rec!==S.rec){photoT0={rec:S.rec,t:simT};return}
  if(simT-photoT0.t<PHOTO_AT)return;
  photoRec=S.rec;
  try{const g=$('gl'),W=360,H=240,c=document.createElement('canvas');c.width=W;c.height=H;
    const k=Math.min(g.width/W,g.height/H)*0.8,sw=W*k,sh=H*k;   // a little tighter than the screen: the ship fills it
    c.getContext('2d').drawImage(g,(g.width-sw)/2,(g.height-sh)/2,sw,sh,0,0,W,H);
    const ph={url:c.toDataURL('image/jpeg',0.72),prog:progName(),flight:(PROG.flights||0)+1,design:designName(stackDef)||'our design',day:PROG.day||0};
    localStorage.setItem(PHOTO_KEY,JSON.stringify(ph))}catch(e){}}
function deskPhoto(){try{const p=JSON.parse(localStorage.getItem(PHOTO_KEY)||'null');
  return p&&p.prog===progName()&&p.flight<=(PROG.flights||0)+1?p:null}catch(e){return null}}   // another career's photo isn't ours

// ---- the desk: letterhead, in-tray, the open folder, the wall. progLayout (screens.js) sorts the sections; this places them.
const deskYear=d=>1+Math.floor(d/YEAR_D),deskDay=d=>1+Math.floor(d%YEAR_D);
function deskLayout(box,gate){
  const H=POWERS[HOME],d=PROG.day||0;
  $('deskLH').innerHTML=`${H?flagSVG(H,62):''}<div class="org"><div class="n">${progName()}</div>
    <div class="s">Office of the Director · ${ownKind()}${H?` · ${H.name}`:''}</div></div>
    <div class="ledger">funds<b>${fmtM(PROG.funds||0)}</b></div>
    <div class="cal"><div class="m">YEAR ${deskYear(d)}</div><div class="d">${deskDay(d)}</div><div class="y">day</div></div>`;
  // the in-tray: the Inbox (decisions first, offers, what's coming up, news)
  const n=gate?0:box.inbox.filter(x=>x.classList.contains('ms')).length;
  $('deskTrayN').textContent=n?`IN · ${n}`:'IN';
  $('deskTrayBox').replaceChildren(...(gate?[]:box.inbox));
  if(!gate&&!box.inbox.length)$('deskTrayBox').innerHTML='<div class="none">Nothing waiting for an answer.</div>';
  $('deskTray').classList.toggle('hidden',gate);
  $('deskWall').innerHTML=gate?'':deskWall()}
function deskWall(){let h='';const ph=deskPhoto();
  h+=deskPhotoCard(ph,'no flights yet',"the first flight's photo goes here");
  const nw=deskNews(NEWS);
  if(nw)h+=deskClipping(nw);
  const firsts=RACE.filter(id=>PROG.done[id]&&raceLost(id)==null).map(id=>({M:MISSIONS.find(m=>m.id===id),at:PROG.done[id]})).filter(x=>x.M)
    .sort((a,b)=>b.at.day-a.at.day).slice(0,2);
  for(const[i,f]of firsts.entries())h+=`<div class="cert" style="transform:rotate(${i?-1:1.5}deg)"><div class="t">FIRST: ${f.M.name}</div><div class="s">awarded to ${progName()}<br>flight ${f.at.flight} · ${fmtDate(f.at.day)}</div></div>`;
  return h}
// the pinned photo, or its empty frame; the Debrief pins the same card (Q241 R2)
const deskPhotoCard=(ph,none,cap)=>ph?`<div class="photo" style="transform:rotate(2deg)"><i class="pin"></i><img src="${ph.url}" alt="flight ${ph.flight}"><div class="cap">Flight ${ph.flight} · ${ph.design}</div></div>`
  :`<div class="photo empty" style="transform:rotate(2deg)"><i class="pin"></i><div class="img">${none}</div><div class="cap">${cap}</div></div>`;
// the papers print our own news first, then the latest that isn't a warning
function deskNews(L){const H=POWERS[HOME],ours=x=>[progName(),H&&H.root,H&&H.name].some(n=>n&&x.t.includes(n));
  return L.find(x=>ours(x)&&x.cls!=='warn'&&x.cls!=='bad')||L.find(x=>!x.cls||x.cls==='good')||L[0]}
const deskPaper=()=>`The ${POWERS[HOME]?POWERS[HOME].root:'Coastal'} Herald`;
const deskClipping=(nw,cls='clip',more='')=>`<div class="${cls}" style="transform:rotate(-1.5deg)"><div class="pp">${deskPaper()} · day ${Math.floor(nw.day)+1}</div><div class="hd">${nw.t}</div>${more}</div>`;
