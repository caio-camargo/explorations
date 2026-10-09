// app/settings.js — the Settings overlay (flow session, QUEUE Q42). Part of index.html's script (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// Opened from the Esc menu. Sound (on/off; Q35's volume slider goes in #setSound), graphics quality, the performance
// readout, the gauges, the era look, and leaving tester mode. Each setting is kept per browser. Loaded last: a quality
// preset sets aerofx's effect flags (gl.js) and the resolution cap adaptRes keeps to (render.js).
const QUAL={
  high:{l:'High',rs:1,d:'everything on',fx:{CLOUD_VOL:1,BLOOM:1,PLUME_LIGHT:1,IMPACT_FX:1,VAPOR_FX:1}},
  medium:{l:'Medium',rs:.8,d:'flat clouds, no plume glow on the ground, resolution up to 80 %',fx:{CLOUD_VOL:0,BLOOM:1,PLUME_LIGHT:1,IMPACT_FX:0,VAPOR_FX:1}},
  low:{l:'Low',rs:.6,d:'also no bloom, plume light or vapor cones, resolution up to 60 %',fx:{CLOUD_VOL:0,BLOOM:0,PLUME_LIGHT:0,IMPACT_FX:0,VAPOR_FX:0}}};
const setGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},setPut=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
let quality=QUAL[setGet('launchpad-quality','high')]?setGet('launchpad-quality','high'):'high';
function applyQuality(q){const Q=QUAL[q]||QUAL.high,f=Q.fx;quality=QUAL[q]?q:'high';
  CLOUD_VOL=!!f.CLOUD_VOL;BLOOM=!!f.BLOOM;PLUME_LIGHT=!!f.PLUME_LIGHT;IMPACT_FX=!!f.IMPACT_FX;VAPOR_FX=!!f.VAPOR_FX;   // (the re-entry plasma stays: it tells you something)
  RS_MAX=Q.rs;RS=Math.min(RS,RS_MAX)}
applyQuality(quality);
GAUGES=setGet('launchpad-gauges','1')!=='0';
function renderSettings(){const el=$('settings');if(!el)return;const ck=(id,on,l,t='')=>`<label title="${t}"><input type="checkbox" id="${id}"${on?' checked':''}> ${l}</label>`;
  el.innerHTML=`<span class="x" data-ov="settings">✕</span><h2>Settings</h2>`
    +`<h3>Sound</h3>${ck('setSnd',AUD.on,'sound  [F4]')}<div id="setSound"></div>`
    +`<h3>Graphics</h3><div>${Object.entries(QUAL).map(([k,v])=>`<button data-qual="${k}"${k===quality?' class="on"':''}>${v.l}</button>`).join('')}</div>`
    +`<div class="sub">${QUAL[quality].d}. The resolution also drops by itself while frames are slow.</div>`
    +ck('setPerf',perfOn,'performance readout')
    +`<h3>Screens</h3>${ck('setGauges',GAUGES,'flight gauges (altitude, air, q, Mach, heat)')}${ck('setModern',modernUI(),'modern look for the logbook and the map','instead of the era\'s notebook or terminal')}`
    +`<h3>Tester</h3>`+(TEST.on?`<button data-test-act="leave">Leave tester mode</button><div class="sub">Back to your own career (the sandbox is kept).</div>`
      :`<div class="sub">Off. Add <code>?tester</code> to the address for the tester menu and its sandbox career.</div>`)}
document.addEventListener('click',e=>{const q=e.target.dataset&&e.target.dataset.qual;if(!q)return;applyQuality(q);setPut('launchpad-quality',quality);renderSettings()});
document.addEventListener('change',e=>{const id=e.target.id,on=e.target.checked;
  if(id==='setSnd'){AUD.on=on;setPut('launchpad-sound',on?'1':'0');if(on)sndWake()}
  else if(id==='setPerf'){perfOn=on;document.body.classList.toggle('noperf',!perfOn);setPut('launchpad-perf',on?'1':'0')}
  else if(id==='setGauges'){GAUGES=on;setPut('launchpad-gauges',on?'1':'0')}
  else if(id==='setModern'){setPut('launchpad-modern-ui',on?'1':'0');if(!$('logbook').classList.contains('hidden'))renderLog()}});
