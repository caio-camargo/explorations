const acorn = require('internal/deps/acorn/acorn/dist/acorn');const fs=require('fs');
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !f.startsWith('sim/'));
for(const f of files){const src=fs.readFileSync(ROOT+f,'utf8');acorn.parse(src,{ecmaVersion:'latest',locations:true,onComment:(b,t,s,e,ls)=>{if(b)return;
 const m=/(?:^|[\s;)}])((?:if\(|for\(|const |let |return[ ;]|[A-Za-z_$][\w$.\[\]]*\s*(?:[-+*|&]?=(?![=>])|\+\+|\())[^\n]*)$/.exec(t); if(!m)return; const tail=m[1];
 if(!/[;}]/.test(tail)&&!/\)\s*$/.test(tail))return; if(/^[A-Za-z]+ \(/.test(tail))return; if(/^[\w.]+\s*\([QA-Z#]?[\w\s,/.§#:-]*\)\s*[;.]?$/.test(tail)&&!/\(\)/.test(tail)) return;
 console.log(f+':'+ls.line+'  '+tail.slice(0,200))}})}
