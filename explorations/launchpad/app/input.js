// app/input.js — input. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ input
addEventListener('keydown',e=>{
  if(mode!=='flight')return;const k=e.key.toLowerCase();
  if([' ','tab'].includes(k)||e.ctrlKey)e.preventDefault();
  if(e.repeat&&!['shift','control'].includes(k)){keys.add(k);return}
  keys.add(k);
  if(RVA&&rvFlightKey(k))return;
  if(player&&['w','a','s','d','q','e','z','x','t',' ','shift','control','n','delete','backspace'].includes(k))takeOver();
  if(S&&S.proc&&!S.proc.done&&['w','a','s','d','q','e','z','x','t',' ','shift','control','backspace'].includes(k)){S.proc=null;HOOK.msg('Procedure off — you have control')}
  if(k===' ')tapeStage(recTape,S);
  else if(k==='backspace'){e.preventDefault();tapeAbort(recTape,S)}
  else if(k==='z')S.throttle=1;else if(k==='x')S.throttle=0;
  else if(k==='t'){S.sas=!S.sas;S.hold=null;renderSAS()}
  else if(k==='m')toggleMap();
  else if(k==='.'){warpTo=null;warpIdx=Math.min(WARPS.length-1,warpIdx+1)}
  else if(k===','){warpTo=null;warpIdx=Math.max(0,warpIdx-1)}
  else if(k==='/'){warpTo=null;warpIdx=0}
  else if(k==='c'&&view==='map')cycleAtlas();
  else if(k==='tab'&&view==='map'){cam.focus=(cam.focus+1)%(BODIES.length+1);const fb=BODIES[cam.focus-1];cam.mDist=fb&&fb.parent?fb.R*9.15:5*TELLUS.R}
  else if(k==='g')cycleTarget();
  else if(k==='b'&&S.alive&&S.parts.some(p=>p.on&&p.d.kind==='bay'))tapeBay(recTape,S,S.parts.some(p=>p.on&&p.d.kind==='bay'&&p.open)?'close':'open');
  else if(k==='y'&&S.alive&&S.parts.some(p=>p.on&&p.d.kind==='leg'))tapeLegs(recTape,S,legsDown(S)?'up':'down');
  else if(k==='['||k===']')cycleVessel(k===']'?1:-1);
  else if(k==='v'&&S.alive&&rcsJets(S)){S.rcs=!S.rcs;renderSAS();HOOK.msg(S.rcs?'RCS on':'RCS off')}
  else if(k==='n')nodeAtApoapsis();
  else if(k==='delete'&&S.node){S.node=null;HOOK.msg('Node deleted')}
  else if(k==='r'&&(!S.alive||S.landed&&simT>5)){resetShip();go('flight');HOOK.msg('Reverted to launch')}});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
addEventListener('beforeunload',e=>{if(mode==='flight'&&S&&S.alive&&!S.landed){e.preventDefault();e.returnValue=''}});
function toggleMap(){go(view==='map'?'flight':'map')}
