// app/settings.js — the Settings overlay (flow session, QUEUE Q42). Part of index.html's script (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// Opened from the Esc menu. Sound (on/off; Q35's volume slider goes in #setSound), graphics quality, the performance
// readout, the gauges, the era look, and leaving tester mode. Each setting is kept per browser. Loaded last: a quality
// preset sets aerofx's effect flags (gl.js) and the resolution cap adaptRes keeps to (render.js).
const QUAL={
  high:{l:'High',rs:1,d:'everything on',fx:{CLOUD_VOL:1,BLOOM:1,PLUME_LIGHT:1,IMPACT_FX:1,VAPOR_FX:1,HAZE_FX:1}},
  low:{l:'Low',rs:.6,d:'for integrated graphics: flat clouds; no bloom, plume light, ground glow, vapor cones or heat haze; resolution up to 60 %',fx:{CLOUD_VOL:0,BLOOM:0,PLUME_LIGHT:0,IMPACT_FX:0,VAPOR_FX:0}}};
// Two settings (ROADMAP § "Graphics budget"; BEAUTY Q312). Medium is gone: on the Intel iGPU it missed the 30 fps floor
// even at the 35 % resolution floor (the Heavy's vapor, view 54: 37.7 ms; Low 21.5 ms), so a saved 'medium' becomes Low
const QUAL_OLD={medium:'low'};
const setGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},setPut=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
let quality=(q=>QUAL[q]?q:QUAL_OLD[q]||'high')(setGet('launchpad-quality','high'));
function applyQuality(q){const Q=QUAL[q]||QUAL.high,f=Q.fx;quality=QUAL[q]?q:'high';
  CLOUD_VOL=!!f.CLOUD_VOL;BLOOM=!!f.BLOOM;PLUME_LIGHT=!!f.PLUME_LIGHT;IMPACT_FX=!!f.IMPACT_FX;VAPOR_FX=!!f.VAPOR_FX;HAZE_FX=!!f.HAZE_FX;   // (the re-entry plasma stays: it tells you something)
  RS_MAX=Q.rs;RS=Math.min(RS,RS_MAX)}
applyQuality(quality);
GAUGES=setGet('launchpad-gauges','1')!=='0';SHAKE_LV=Math.min(2,Math.max(0,+setGet('launchpad-shake','1')||0));SHAKE_FX=SHAKE_LV>0;   // (Q360, Q402) the camera shake: 0 off, 1 gentle, 2 full
function renderSettings(){const el=$('settings');if(!el)return;const ck=(id,on,l,t='')=>`<label title="${t}"><input type="checkbox" id="${id}"${on?' checked':''}> ${l}</label>`;
  el.innerHTML=`<span class="x" data-ov="settings">✕</span><h2>Settings</h2>`
    +`<h3>Sound</h3>${ck('setSnd',AUD.on,'sound  [F4]')}<div id="setSound"></div>`
    +`<h3>Graphics</h3><div>${Object.entries(QUAL).map(([k,v])=>`<button data-qual="${k}"${k===quality?' class="on"':''}>${v.l}</button>`).join('')}</div>`
    +`<div class="sub">${QUAL[quality].d}. The resolution also drops by itself while frames are slow.</div>`
    +ck('setPerf',perfOn,'performance readout')
    +`<h3>Screens</h3>${ck('setGauges',GAUGES,'flight gauges (altitude, air, q, Mach, heat)')}<div>camera shake (max-q, Mach 1, staging, re-entry): ${['Off','Gentle','Full'].map((l,k)=>`<button data-shake="${k}"${k===SHAKE_LV?' class="on"':''}>${l}</button>`).join('')}</div>${ck('setModern',modernUI(),'modern look for the logbook and the map','instead of the era\'s notebook or terminal')}`
    +`<h3>Difficulty</h3><div>${Object.entries(LEVELS).map(([k,v])=>`<button data-lvl="${k}"${k===lvlKey()?' class="on"':''}${mode==='flight'?' disabled':''}>${v.name}</button>`).join('')}</div>`
    +`<div class="sub">${lvl().d}.${mode==='flight'?' Changes between flights.':' Records and autopilots keep the level they were flown on.'}</div>`
    +`<h3>Tester</h3>`+(TEST.on?`<button data-test-act="leave">Leave tester mode</button><div class="sub">Back to your own career (the sandbox is kept).</div>`
      :`<div class="sub">Off. Add <code>?tester</code> to the address for the tester menu and its sandbox career.</div>`);
  if(typeof sndSettings==='function')sndSettings($('setSound'))}   // the volume slider (sound, Q35)
// the level (Q476): PROG.lvl, saved with the career; off a flight only, since a flight flies the physics it lifted off with
function setLevel(k){if(!LEVELS[k]||k===lvlKey()||mode==='flight')return;const was=lvlKey();if(k==='normal')delete PROG.lvl;else PROG.lvl=k;
  if(PROG.flights)HOOK.news(`Difficulty: ${LEVELS[k].name} (was ${LEVELS[was].name}). Records and autopilots keep the level they were flown on`,'ok');HOOK.save();editorChanged()}
document.addEventListener('click',e=>{const lv=e.target.closest&&e.target.closest('#settings [data-lvl]');if(lv){setLevel(lv.dataset.lvl);renderSettings();return}
  const sk=e.target.dataset&&e.target.dataset.shake;if(sk!=null){SHAKE_LV=+sk;SHAKE_FX=SHAKE_LV>0;setPut('launchpad-shake',sk);renderSettings();return}   // (Q402)
  const q=e.target.dataset&&e.target.dataset.qual;if(!q)return;applyQuality(q);setPut('launchpad-quality',quality);renderSettings()});
document.addEventListener('change',e=>{const id=e.target.id,on=e.target.checked;
  if(id==='setSnd'){AUD.on=on;setPut('launchpad-sound',on?'1':'0');if(on)sndWake()}
  else if(id==='setPerf'){perfOn=on;document.body.classList.toggle('noperf',!perfOn);setPut('launchpad-perf',on?'1':'0')}
  else if(id==='setGauges'){GAUGES=on;setPut('launchpad-gauges',on?'1':'0')}
  else if(id==='setModern'){setPut('launchpad-modern-ui',on?'1':'0');if(!$('logbook').classList.contains('hidden'))renderLog()}});
