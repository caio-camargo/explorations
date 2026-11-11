// random walk over the app layer: keys, screen changes, buttons, frames. Reports each distinct exception with the trail of actions.
const {boot}=require('./harness.cjs');
const seed0=+process.argv[2]||1,N=+process.argv[3]||1500,search=process.argv[4]||'';
let sd=seed0;const R=()=>{sd=(sd*1664525+1013904223)>>>0;return sd/4294967296},pick=a=>a[Math.floor(R()*a.length)];
const H=boot({search});const seen=new Map(),trail=[];
const KEYS=[...'abcdefghijklmnopqrstuvwxyz123456789',' ','enter','escape','backspace','delete','tab','home',',','.','/','[',']','shift','control','f2'];
const BTN=['launch','bRevert','bEnd','bAuto','bProc','bSaveTape','bDebAgain','bMap','bEditor','bHelp','bMenu','bLog','bWings','bLegs','bBay','navref','bRoll','bBuild','bDebLast','bMC','bDebProg','bDebAsm','progReset'];
const SCR=['title','program','assembly','flight','map','rover','debrief','rollout','mission'];
const ESC=['close','revert','end','assembly','tape','program','log','keys','settings','title'];
const INV=`(()=>{const hid=id=>document.getElementById(id).classList.contains("hidden");if(!isFinite(PROG.funds))return "funds "+PROG.funds;if(!isFinite(PROG.day))return "day "+PROG.day;if(!isFinite(simT))return "simT";if(S&&!(S.r.every(isFinite)&&S.v.every(isFinite)))return "S.r/S.v not finite";if((mode==="flight")===hid("hud"))return "hud visibility vs mode "+mode;if([atTitle,atDeb,atMC,atHQ,atRoll].filter(Boolean).length>1)return "two screen flags";if(mode!=="editor"&&(atTitle||atDeb||atMC||atHQ||atRoll))return "screen flag set in mode "+mode;if(mode==="flight"&&!S)return "flight without S";const L=progLossy(PROG);if(L.length)return "save loses "+L[0];if(S&&mode==="flight"&&S.rec&&S.rec.ended&&S.alive&&!S.landed&&screenNow()!=="debrief")return "flying an ended flight";return ""})()`;
function act(){const k=R(),sc=H.run('screenNow()'),vis=id=>!H.getEl(id).classList.contains('hidden');let d;
  const GO={assembly:['rollout','program'],program:['assembly','rover',...(vis('bDebLast')?['debrief']:[]),...(vis('bMC')?['mission']:[])],rollout:['assembly'],mission:['program'],debrief:['assembly','program'],rover:['program'],title:[],flight:[],map:[]}[sc];
  const fl=sc==='flight'||sc==='map',BT={flight:['bRevert','bMap','bEditor','bHelp','bMenu','bLog2','navref',...['bEnd','bAuto','bProc','bWings','bLegs','bBay'].filter(vis)],rollout:['launch'],program:['bLog3'],debrief:['bDebAgain'],assembly:['bLog']};BT.map=BT.flight;
  const escOpen=vis('escm');
  if(!escOpen&&sc==='assembly'&&R()<.3){H.click({go:'rollout'});H.getEl('launch').click();if(R()<.8){H.key('z');H.key(' ');H.keyup('z');H.keyup(' ')}return 'LAUNCH'}
  if(escOpen&&k<.5){const opts=['close','log','keys','settings','title',...(fl?['end','assembly','tape',...(H.run('revertOK()')?['revert']:[])]:[]),...(['assembly','rover','debrief','rollout','mission'].includes(sc)?['program']:[])],a=pick(opts);d='esc '+a;H.click({esc:a})}
  else if(k<.30){const key=pick(KEYS);d='key '+key;H.key(key);if(R()<.7)H.keyup(key)}
  else if(k<.55){const n=1+Math.floor(R()*40);d='frame '+n;H.frame(n)}
  else if(k<.63){if(GO.length){const s=pick(GO);d='go '+s;H.click({go:s})}else if(sc==='title'){if(H.run('needCharter()')){d='found';H.run('ttlFound()')}else{const a=pick(['continue','continue','new']);d='ttl '+a;H.click({ttl:a},{self:1})}}else d='noop'}
  else if(k<.72){const L=BT[sc]||[];if(L.length){const b=pick(L);d='btn '+b;H.getEl(b).click()}else d='noop'}
  else if(k<.78&&sc==='program'){const o=H.run('(PROG.offers||[]).map(c=>c.id)');if(o.length){const id=pick(o);d='acc '+id;H.click({acc:String(id)})}else d='noop'}
  else if(k<.84&&(sc==='program'||sc==='mission')){const ev=H.run('upcoming().map(e=>e.day)');if(ev.length){d='adv';H.click({adv:String(ev[0])})}else d='noop'}
  else if(k<.88&&(sc==='program'||sc==='mission')){const o=H.run('(PROG.sats||[]).filter(q=>flyable(q)).map(q=>q.id)');if(o.length){d='fly';H.click({fly:String(pick(o))})}else d='noop'}
  else if(k<.91&&sc==='program'){d='ptab';H.click({ptab:pick(['inbox','missions','contracts','fleet','world','industry','company','more'])})}
  else if(k<.96&&(fl||sc==='assembly'||sc==='rollout')){d='mouse';const cv=H.getEl('gl'),x=R()*1280,y=R()*720,e={clientX:x,clientY:y,target:cv,button:0,preventDefault(){},stopPropagation(){},shiftKey:false,ctrlKey:false};
    for(const f of cv._h.mousedown||[])f(e);for(const f of H.handlers.win.mousedown||[])f(e);if(R()<.5){e.clientX+=40;for(const f of H.handlers.win.mousemove||[])f(e)}for(const f of H.handlers.win.mouseup||[])f(e)}
  else{d='timers';H.timers()}
  return d}
for(let i=0;i<N;i++){let d='?';const n0=H.errs.length;try{d=act()}catch(e){const st=(e.stack||String(e)).split('\n'),key=st[0]+' '+(st[1]||'').trim();if(!seen.has(key))seen.set(key,{n:0,i,trail:trail.slice(-10).join(' > '),st:st.slice(0,6).join('\n   '),scr:(()=>{try{return H.run('screenNow()')}catch(x){return'?'}})()});seen.get(key).n++;d+='!'}
  trail.push(d);
  try{const bad=H.run(INV);if(bad){const key="INVARIANT "+bad;if(!seen.has(key))seen.set(key,{n:0,i,trail:trail.slice(-12).join(" > "),st:key,scr:H.run("screenNow()")});seen.get(key).n++}}catch(e){const key="INV-THROW "+e.message;if(!seen.has(key))seen.set(key,{n:0,i,trail:trail.slice(-12).join(" > "),st:key,scr:"?"});seen.get(key).n++}
  for(const m of H.errs.splice(n0)){const key=m.slice(0,160);if(!seen.has(key))seen.set(key,{n:0,i,trail:trail.slice(-10).join(' > '),st:m,scr:'frame'});seen.get(key).n++}}
console.log(`seed ${seed0} actions ${N} distinct exceptions ${seen.size} final screen ${H.run('screenNow()')} flights ${H.run('PROG.flights')} day ${H.run('PROG.day').toFixed(1)}`);
for(const[k,v]of seen)console.log(`--- x${v.n} first at #${v.i} on ${v.scr}\n   ${v.st}\n   trail: ${v.trail}`);
