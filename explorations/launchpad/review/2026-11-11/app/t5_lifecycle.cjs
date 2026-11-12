// State lifecycle, mechanically: every top-level let/const of the app layer is fingerprinted on the Assembly before a flight (t0),
// in the middle of a busy flight (t1), and back on the Assembly after it (t2: revert, or end + debrief). Prints what t2 != t0.
const {boot}=require('./harness.cjs');const fs=require('fs');
const G=JSON.parse(fs.readFileSync(__dirname+'/globals.json','utf8')).filter(([k,v])=>/^(app\/|builder\.js)/.test(v[0].file)&&v[0].kind!=='function'&&v[0].file!=='app/gl.js');
const how=process.argv[2]||'revert';
const H=boot();const r=s=>{try{return H.run(s)}catch(e){return 'THROW '+e.message}};
H.run(`globalThis.__fp=function(v,d){d=d||0;const t=typeof v;if(v===null||t==='number'||t==='string'||t==='boolean'||t==='undefined')return t==='number'?+v.toPrecision(6):v;if(t==='function')return 'fn';
  if(Array.isArray(v))return 'arr'+v.length+(d<1&&v.length<8?':'+v.map(x=>__fp(x,d+1)).join(','):'');if(v instanceof Set||v instanceof Map)return 'col'+v.size;if(ArrayBuffer.isView(v))return 'ta'+v.length;
  if(d>1)return 'obj';try{return '{'+Object.keys(v).slice(0,14).map(k=>k+'='+__fp(v[k],d+1)).join(' ')+'}'}catch(e){return 'obj?'}}`);
const snap=()=>{const o={};for(const[k,v]of G){let x;try{x=H.run(`__fp(typeof ${k}==='undefined'?undefined:${k})`)}catch(e){x='ERR'}o[k]=String(x)}return o};
r('ttlFound()');r("go('assembly')");H.frame(5);const t0=snap();
H.getEl('launch').click();H.key('z');H.key(' ');H.frame(500);
r("S.sas=true");H.key('m');H.frame(20);H.key('n');H.key('g');H.key('.');H.key('.');H.frame(60);H.key('c');H.key('tab');H.frame(10);H.key('m');H.frame(60);
// a click on the map's canvas and a wheel, the Esc menu, a card folded, a help overlay
H.click({cfold:'dv'});H.click({warp:'1'});H.key('h');H.key('h');H.frame(30);
const t1=snap();
if(how==='revert'){H.key('x');H.key('escape');H.click({esc:'revert'});H.click({esc:'revert'});H.frame(5);H.key('escape');H.click({esc:'assembly'});H.click({esc:'assembly'})}
else{H.key('escape');H.click({esc:'end'});H.click({esc:'end'});H.frame(3);r("go('assembly')")}
H.frame(5);const t2=snap();
console.log('how',how,'screen',r('screenNow()'),'errs',H.errs.length,H.errs[0]||'');
const where=Object.fromEntries(G.map(([k,v])=>[k,v[0].file+':'+v[0].line]));
for(const k in t0)if(t0[k]!==t2[k])console.log(`${k} (${where[k]})\n    before ${t0[k].slice(0,110)}\n    flight ${t1[k].slice(0,110)}\n    after  ${t2[k].slice(0,110)}`);
