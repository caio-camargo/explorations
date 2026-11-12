// A_harness.cjs: builder.js + the real sim in one scope, DOM/GL stubbed. require('./A_harness.cjs')(testBody) runs testBody text inside that scope.
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => f === 'builder.js' || f.startsWith('sim/'));
const prelude = `
const LISTEN={};const addEventListener=(t,f)=>{(LISTEN[t]=LISTEN[t]||[]).push(f)};
const fire=(t,e)=>{for(const f of LISTEN[t]||[])f(e)};
const mkEl=(tag)=>{const e={tagName:(tag||'div').toUpperCase(),children:[],style:{},dataset:{},_h:'',classList:{add(){},remove(){},toggle(){},contains(){return false}},
  appendChild(c){e.children.push(c);return c},append(...c){e.children.push(...c)},addEventListener(t,f){(e['on_'+t]=e['on_'+t]||[]).push(f)},
  querySelector(){return mkEl()},querySelectorAll(){return[]},getBoundingClientRect(){return{left:0,top:0,right:0,bottom:0,width:0,height:0}},
  scrollIntoView(){},focus(){},blur(){},click(){},closest(){return null},get firstChild(){return e._fc||(e._fc=mkEl())},
  set innerHTML(v){e._h=v;e.children.length=0},get innerHTML(){return e._h},textContent:'',width:1000,height:800,clientWidth:1000,clientHeight:800};return e};
const ELS={};const document={getElementById:id=>ELS[id]||(ELS[id]=mkEl()),createElement:t=>mkEl(t),head:mkEl(),body:mkEl(),querySelector:()=>null};
const performance={now:()=>NOW};let NOW=100000;const innerWidth=1000,innerHeight=800;const localStorage={getItem:()=>null,setItem(){}};
const confirm=()=>true;
// app-layer stubs
let stackDef=null,mode='editor',view='flight',shipMesh=null,atHQ=false,atDeb=false,atRoll=false,atMC=false,atTitle=false,EDN=0;
const cam={yaw:0,pitch:0,dist:28,edY:0};
const $=id=>document.getElementById(id);
const screenNow=()=>mode==='editor'?(atTitle?'title':atDeb?'debrief':atMC?'mission':atHQ?'program':atRoll?'rollout':'assembly'):'flight';
const shipWorld=()=>[0,0,0];const ovPx=()=>1;const VX=12;const makeMesh=a=>({n:a.length,free(){}});const partShape=(a,p)=>{a.push(0)};
const gl=new Proxy({},{get:(t,k)=>typeof k==='string'&&/^[A-Z_0-9]+$/.test(k)?0:()=>{}});
const mmul=(a,b)=>a,mat4=()=>[];const certFrac=()=>null;
function editorChanged(){EDN++;const empty=BLD.isEmpty(stackDef),bench=BLD.bench();if(!bench&&isV2(stackDef))paySync(stackDef);if(!empty){S=newShip(stackDef);S.ana=null}BLD.panel()}
`;
module.exports = body => {
  const src = prelude + files.map(f => fs.readFileSync(ROOT + f, 'utf8')).join('\n;\n') + '\n;\n' + body;
  return new Function('console', src)(console);
};
