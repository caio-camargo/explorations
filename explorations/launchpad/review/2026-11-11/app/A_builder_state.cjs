// builder.js state seams, run against the real builder + sim (A_harness.cjs)
require('./A_harness.cjs')(`
const cvs=document.getElementById('gl');
function aim(){const q=S.q;HOOK.view={camW:qrot(q,[30,0,0]),Fw:qrot(q,[-1,0,0]),R:qrot(q,[0,0,1]),U:qrot(q,[0,1,0]),tanX:.6,tanY:.5,W:1000,H:800}}
function click(){aim();const e={target:cvs,clientX:500,clientY:400,button:0,preventDefault(){},stopPropagation(){}};fire('mousemove',e);fire('mousedown',e);fire('mouseup',e)}
const key=e=>fire('keydown',Object.assign({target:{tagName:'BODY'},preventDefault(){}},e));
const fresh=()=>{stackDef=JSON.parse(JSON.stringify(PRESETS.Orbiter));S=newShip(stackDef);editorChanged();BLD.st.held=null;BLD.st.undo.length=0;BLD.st.redo.length=0};
BLD.init();

// 1. a preset, one part picked up by mistake, Ctrl+Z
fresh();const tk=()=>JSON.stringify(stackDef).length+':'+(JSON.stringify(stackDef)===JSON.stringify(PRESETS.Orbiter));
console.log('1 before: designName =',designName(stackDef),'| stackDef is the preset JSON:',JSON.stringify(stackDef)===JSON.stringify(PRESETS.Orbiter));
click();console.log('1 picked up:',BLD.st.held&&BLD.st.held.k,'parts',S.parts.length);
key({key:'z',ctrlKey:true});
console.log('1 after Ctrl+Z: parts',S.parts.length,'| designName =',designName(stackDef),'| stackDef is the preset JSON:',JSON.stringify(stackDef)===JSON.stringify(PRESETS.Orbiter),'| isV2:',isV2(stackDef));

// 2. the payload bench, then a design loaded from the logbook: go('assembly') returns at "if(s===from)return", then BLD.load(stack)
fresh();BLD.benchOpen(null);const id=BLD.bench().id;
stackDef={v:2,root:{k:'core',c:[]}};editorChanged();      // something small built on the bench
console.log('2 on the bench: payload parts',S.parts.length,'bench id',id);
BLD.load(JSON.parse(JSON.stringify(PRESETS.Orbiter)));     // app/program-ui.js:146
console.log('2 after the logbook load: still on the bench:',!!BLD.bench(),'| parts on the bench',S.parts.length,'| undo steps',BLD.st.undo.length);
BLD.benchClose(false);const e=payById(id);
const cnt=n=>n?1+(n.c||[]).reduce((a,c)=>a+cnt(c),0):0;
console.log('2 after Done: payload "'+e.name+'" now holds',cnt(e.d.root),'design nodes, mass',(e.m).toFixed(2),'t; root part',e.d.root&&e.d.root.k);

// 3. the rocket hanging over the plate, a trip to the bench and back
fresh();BLD.design();BLD.st.hang=4;editorChanged();console.log('3 gap before the bench',BLD.st.gap);
BLD.benchOpen(null);BLD.benchClose(false);console.log('3 gap after the bench',BLD.st.gap);

// 4. top view left on, a launch (editor.js:179 sets cam.pitch=0.12), then a design loaded back in the Assembly
fresh();BLD.frameCam();console.log('4 pitch on a fresh design',cam.pitch);
key({key:'t'});console.log('4 T: pitch',cam.pitch.toFixed(3));
cam.pitch=0.12;                                            // $('launch').onclick
BLD.load(PRESETS.Orbiter);BLD.frameCam();console.log('4 after a flight, a design loaded: pitch',cam.pitch.toFixed(3),'(top view again, unasked)');
cam.pitch=-0.05;key({key:'t'});console.log('4 T pressed for the top view: pitch',cam.pitch.toFixed(3),'(it went "back" instead)');
`);
