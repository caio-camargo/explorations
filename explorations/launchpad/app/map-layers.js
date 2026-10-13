// app/map-layers.js — what the map shows (flow session, QUEUE Q261, PLAYTEST #61). A classic script sharing one global scope
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
