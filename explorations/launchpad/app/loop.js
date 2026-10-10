// app/loop.js — the main loop. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ main loop
let last=performance.now(),fpsT=0,fpsN=0,fpsShow=0,frameMs=0,stepsN=0,hudT=0;
function shipWorld(){return add(bodyPos(S.body,simT),S.r)}
function simulate(dtR){
  if(mode==='drive'){rvTick(dtR);return}
  if(mode!=='flight')return;
  if(player){ // autopilot: the tape drives; warp just sets how many steps per frame
    if(!S.alive){player=null;return}
    const more=tapePlay(player,S,Math.max(1,Math.round(dtR*WARPS[Math.min(warpIdx,5)]/DT)));
    if(!more){recTape=tapeCut(player);player=null;warpIdx=0;HOOK.msg('Autopilot tape ended — you have control')}return}
  if(!RVA&&keys.has('shift'))S.throttle=Math.min(1,S.throttle+dtR);
  if(!RVA&&keys.has('control'))S.throttle=Math.max(0,S.throttle-dtR);
  INP.pitch=(keys.has('w')?1:0)-(keys.has('s')?1:0);INP.yaw=(keys.has('d')?1:0)-(keys.has('a')?1:0);INP.roll=(keys.has('q')?1:0)-(keys.has('e')?1:0);
  INP.ty=(keys.has('i')?1:0)-(keys.has('k')?1:0);INP.tx=(keys.has('l')?1:0)-(keys.has('j')?1:0);INP.tz=(keys.has('u')?1:0)-(keys.has('o')?1:0);
  if(RVA)for(const k in INP)INP[k]=0;
  if(!S.alive){simT+=dtR;stepDebris(dtR);warpIdx=0;return}
  const onRails=flightRailsOK()&&!(S.proc&&!S.proc.done&&!(S.proc.wake>simT+1));   // a procedure flies on physics, except while it waits for a wake time
  if(warpTo!==null){const rem=warpTo-simT;if(rem<=0.05||!S.alive){warpTo=null;warpIdx=0}
    else{let i=WARPS.length-1;while(i>0&&WARPS[i]*dtR*4>rem)i--;warpIdx=i}}
  if(S.proc&&!S.proc.done&&S.proc.wake>simT+2&&!(S.throttle>0)&&warpTo===null)warpTo=S.proc.wake;   // a procedure coasting to its next step: warp there
  if(!onRails&&warpIdx>5)warpIdx=5;   // physics warp: same fixed step, more steps per frame — results are identical
  if(!onRails&&warpIdx>0&&!S.landed){const vs=dot(S.v,norm(S.r)),hb=groundGap(S),tg=vs<0?hb/-vs:Infinity;   // time to the ground under the ship, not the sea
    if(tg<4||S.maxLoad>0.7)warpIdx=0;else if(tg<15&&warpIdx>2)warpIdx=2}
  const warp=WARPS[warpIdx],dt=dtR*warp;stepsN=0;
  if(onRails){
    if(!tapeRails(recTape,S,warpTo!==null?Math.min(dt,warpTo-simT):dt,warp)){warpIdx=0;warpTo=null;HOOK.msg('Warp stopped')}
  }else{
    physAcc+=dt;evt=false;while(physAcc>=DT&&stepsN<800){tapePhys(recTape,S);physAcc-=DT;stepsN++;if(!S.alive)break;if(evt&&warpIdx>0){warpIdx=0;physAcc=0;break}}
    if(stepsN>=800)physAcc=0}
  rvFlightTick(dt,dtR)}
function frame(now){
  const dtR=Math.min(0.1,(now-last)/1000);last=now;const t0=performance.now();
  testTopUp();const t0s=simT;if(!gamePaused())simulate(dtR);emitSmoke(simT-t0s);sndTick(dtR);
  if(hDrag&&S.node){const h=hDrag.h,off=(hDrag.cur[0]-h.x)*h.ux+(hDrag.cur[1]-h.y)*h.uy,k=Math.min(devicePixelRatio||1,1.5);
    const nd=ndNodes()[ndSel]||S.node;nd.dv[h.axis]+=h.sign*0.02*(off/k)*Math.abs(off/k)*dtR}   // (flow, Q157) the node the panel has selected
  adaptRes(dtR);
  render();
  frameMs=frameMs*.9+(performance.now()-t0)*.1;
  fpsN++;fpsT+=dtR;if(fpsT>0.5){fpsShow=fpsN/fpsT;fpsN=0;fpsT=0;$('perf').textContent=`${fpsShow.toFixed(0)} fps · gpu ${gpuMs==null?'?':gpuMs.toFixed(1)} ms · cpu ${frameMs.toFixed(1)} ms · res ${Math.round(RS*100)}% · ${GPU_NAME}`}
  hudT-=dtR;if(hudT<=0&&mode==='flight'){hudT=0.1;updateHUD()}
  if(msgTimer>0){msgTimer-=dtR;if(msgTimer<=0)$('msg').style.opacity=0}
  requestAnimationFrame(frame)}

