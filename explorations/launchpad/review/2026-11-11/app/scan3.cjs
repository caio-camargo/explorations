const acorn = require('internal/deps/acorn/acorn/dist/acorn');const fs=require('fs');
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const ps=fs.readFileSync(ROOT+'sim/program.js','utf8');const a=ps.indexOf('const PROG_SCHEMA={'),b=ps.indexOf('const progClone');
const schema=new Function('FUNDS0','freshSeed',ps.slice(a,b).replace(/\b[A-Z_][A-Z0-9_]*\b(?=[,\]])/g,m=>m==='FUNDS0'?m:'0')+';return PROG_SCHEMA');
let SC; try{SC=schema(0,()=>0)}catch(e){console.log('schema eval fail',e.message); const keys=[...ps.slice(a,b).matchAll(/^\s*([A-Za-z_]\w*):\[/gm)].map(m=>m[1]); SC=Object.fromEntries(keys.map(k=>[k,1]))}
console.log('schema keys',Object.keys(SC).length);
const use=new Map(), hook={set:new Map(),use:new Map()}, test=new Map(), ids=new Map(), ael=[];
function walk(n,f,fnDepth,anc){ if(!n||typeof n.type!=='string')return;
 if(n.type==='MemberExpression'&&!n.computed&&n.object.type==='Identifier'){const o=n.object.name,p=n.property.name,loc=f+':'+n.loc.start.line;
  if(o==='PROG'){if(!use.has(p))use.set(p,[]);use.get(p).push(loc)}
  if(o==='HOOK'){const par=anc[anc.length-1];const isSet=par&&par.type==='AssignmentExpression'&&par.left===n;const m=isSet?hook.set:hook.use;if(!m.has(p))m.set(p,[]);m.get(p).push(loc)}
  if(o==='TEST'){if(!test.has(p))test.set(p,[]);test.get(p).push(loc)}}
 if(n.type==='CallExpression'){const c=n.callee;const nm=c.type==='Identifier'?c.name:c.type==='MemberExpression'&&!c.computed?c.property.name:null;
  if((nm==='$'||nm==='getElementById')&&n.arguments[0]&&n.arguments[0].type==='Literal'){const id=n.arguments[0].value;if(!ids.has(id))ids.set(id,[]);ids.get(id).push(f+':'+n.loc.start.line)}
  if(nm==='addEventListener'){ael.push({f,line:n.loc.start.line,depth:fnDepth,ev:n.arguments[0]&&n.arguments[0].value,tgt:c.type==='MemberExpression'?fs_src[f].slice(c.object.start,Math.min(c.object.end,c.object.start+40)):'window'})}}
 const d=fnDepth+(/Function/.test(n.type)?1:0); anc.push(n);
 for(const k in n){if(k==='loc')continue;const v=n[k];if(Array.isArray(v))v.forEach(x=>walk(x,f,d,anc));else if(v&&typeof v.type==='string')walk(v,f,d,anc)} anc.pop()}
const fs_src={};
for(const f of files){const src=fs.readFileSync(ROOT+f,'utf8');fs_src[f]=src;walk(acorn.parse(src,{ecmaVersion:'latest',locations:true}),f,0,[])}
console.log('== PROG fields used:',use.size);
for(const [k,v] of use) if(!(k in SC)) console.log('  NOT IN SCHEMA',k,v.length,v.slice(0,5).join(' '));
for(const k in SC) if(!use.has(k)) console.log('  schema field never referenced as PROG.x:',k);
console.log('== HOOK called/read but never assigned'); for(const [k,v] of hook.use) if(!hook.set.has(k)) console.log('  ',k,v.slice(0,4).join(' '));
console.log('== HOOK assigned but never used'); for(const [k,v] of hook.set) if(!hook.use.has(k)) console.log('  ',k,v.slice(0,4).join(' '));
console.log('== HOOK assigned more than once'); for(const [k,v] of hook.set) if(v.length>1) console.log('  ',k,v.join(' '));
console.log('== TEST fields'); for(const [k,v] of test) console.log('  ',k,v.length);
// ids
const all=Object.values(fs_src).join('\n')+html; 
console.log('== ids looked up but not in index.html nor in any id="…" string in scripts');
for(const [id,v] of ids){ const hit=['id="'+id+'"',"id='"+id+"'",'id='+id+' ','id='+id+'>',"id='"+id,'id="'+id,".id='"+id+"'",'.id="'+id+'"'].some(s=>all.includes(s)); if(!hit) console.log('  ',id,v.slice(0,4).join(' ')) }
console.log('== addEventListener inside functions (depth>0), app layer');
for(const e of ael) if(e.depth>0&&!e.f.startsWith('sim/')) console.log('  ',e.f+':'+e.line,e.ev,'on',e.tgt.replace(/\s+/g,' '),'depth',e.depth);
console.log('ael total',ael.length);
