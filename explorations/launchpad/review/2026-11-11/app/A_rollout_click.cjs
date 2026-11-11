// A plain left click on the rocket while on the Rollout screen (mode 'editor', atRoll true): does builder.js pick a part up?
require('./A_harness.cjs')(`
stackDef=JSON.parse(JSON.stringify(PRESETS.Orbiter));S=newShip(stackDef);BLD.init();editorChanged();
const cvs=document.getElementById('gl');
function aim(){const q=S.q,o=add(qrot(q,[30,0,0]),[0,0,0]);HOOK.view={camW:o,Fw:qrot(q,[-1,0,0]),R:qrot(q,[0,0,1]),U:qrot(q,[0,1,0]),tanX:.6,tanY:.5,W:1000,H:800}}
function click(btn){aim();const e={target:cvs,clientX:500,clientY:400,button:btn||0,preventDefault(){},stopPropagation(){this.stopped=true}};
  fire('mousemove',e);fire('mousedown',e);fire('mouseup',e);return e}
const parts0=S.parts.length,isArr0=Array.isArray(stackDef);
for(const scr of ['rollout','assembly']){
  stackDef=JSON.parse(JSON.stringify(PRESETS.Orbiter));S=newShip(stackDef);editorChanged();BLD.st.held=null;BLD.st.undo.length=0;
  atRoll=scr==='rollout';const n0=EDN;const e=click(0);
  console.log(scr+': parts before',parts0,'after',BLD.isEmpty(stackDef)?0:S.parts.length,'| held:',BLD.st.held?BLD.st.held.k:null,'| design still a preset array:',Array.isArray(stackDef),'(was',isArr0+')','| editorChanged calls:',EDN-n0,'| undo steps:',BLD.st.undo.length,'| stopPropagation:',!!e.stopped);
}
// keys at Rollout: the keydown guard does cover atRoll
atRoll=true;stackDef=JSON.parse(JSON.stringify(PRESETS.Orbiter));S=newShip(stackDef);editorChanged();BLD.st.held=null;const s0=BLD.st.sym;
fire('keydown',{key:'x',target:{tagName:'BODY'},preventDefault(){}});console.log('rollout key X changes symmetry:',BLD.st.sym!==s0);
`);
