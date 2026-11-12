const fs=require('fs');const G=new Map(JSON.parse(fs.readFileSync(__dirname+'/globals.json','utf8')));
const src=fs.readFileSync(require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/'+process.argv[2],'utf8');
const ids=new Set(src.match(/[A-Za-z_$][\w$]*/g));const out={};
for(const id of ids){const d=G.get(id);if(d&&d[0].file.startsWith('app/')&&d[0].file!==process.argv[2])(out[d[0].file]=out[d[0].file]||[]).push(id)}
console.log(JSON.stringify(out,null,0).replace(/\],/g,'],\n'));
