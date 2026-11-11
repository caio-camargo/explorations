const fs=require('fs');const ROOT=require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const files=['index.html','builder.js',...fs.readdirSync(ROOT+'app').map(f=>'app/'+f)];const emit=new Map(),read=new Map();
const camel=s=>s.replace(/-([a-z])/g,(m,c)=>c.toUpperCase());
for(const f of files){const src=fs.readFileSync(ROOT+f,'utf8');const lines=src.split('\n');
  lines.forEach((l,i)=>{for(const m of l.matchAll(/data-([a-z][a-z0-9-]*)(?==|\b)/g)){const k=camel(m[1]);const after=l.slice(m.index+m[0].length,m.index+m[0].length+2);
      const inSel=/\[\s*$/.test(l.slice(Math.max(0,m.index-2),m.index))||l[m.index-1]==='[';(inSel?read:emit).set(k,[...((inSel?read:emit).get(k)||[]),f+':'+(i+1)])}
    for(const m of l.matchAll(/dataset\.([A-Za-z0-9_]+)/g)){const k=m[1];const isSet=/^\s*=[^=]/.test(l.slice(m.index+m[0].length));(isSet?emit:read).set(k,[...((isSet?emit:read).get(k)||[]),f+':'+(i+1)])}
    for(const m of l.matchAll(/\b(?:d|ds|D)\.([a-z][A-Za-z0-9]*)\b/g)){/* alias reads: const d=e.target.dataset */ if(/dataset/.test(l)){read.set(m[1],[...(read.get(m[1])||[]),f+':'+(i+1)])}}})}
console.log('emitted, never read:');for(const[k,v]of emit)if(!read.has(k))console.log('  data-'+k,v.slice(0,3).join(' '));
console.log('read, never emitted:');for(const[k,v]of read)if(!emit.has(k)&&!/^(length|map|filter|some|find|k|i|x|id|t|a)$/.test(k))console.log('  '+k,v.slice(0,3).join(' '));
