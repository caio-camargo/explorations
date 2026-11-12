// node --expose-internals scan2.cjs : // comments with a code-like tail; duplicate object keys; duplicate switch cases; duplicate decls in nested scopes
const acorn = require('internal/deps/acorn/acorn/dist/acorn');
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !f.startsWith('sim/')); files.push('views.js');
const parses = t => { try { const a = acorn.parse(t, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }); return a.body.length ? a : null; } catch (e) { return null; } };
let nc = 0, flagged = 0;
for (const f of files) {
  const src = fs.readFileSync(ROOT + f, 'utf8'), comments = [];
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, onComment: (block, text, s, e, ls) => { if (!block) comments.push({ text, line: ls.line, s }); } });
  for (const c of comments) {
    nc++; const T = c.text;
    // candidate start points: after '   ', after ') ', after '; ', after ': '
    let best = null;
    for (let i = 1; i < T.length; i++) {
      if (!/[\s;)]/.test(T[i - 1]) || /\s/.test(T[i])) continue;
      const tail = T.slice(i).trim(); if (tail.length < 10 || !/[=(]/.test(tail) || !/[;})]\s*$/.test(tail)) continue;
      // also allow the tail to be closing an enclosing block: try with up to 3 stripped trailing } or )
      let t = tail, ok = null; for (let k = 0; k < 4 && !ok; k++) { ok = parses(t); if (!ok) t = t.replace(/[})\]]\s*$/, ''); }
      if (ok) { const st = ok.body; const GL=new Set(JSON.parse(fs.readFileSync(__dirname+'/globals.json','utf8')).map(x=>x[0]));const live = st.length>1 || st.some(s => s.type !== 'ExpressionStatement' || ['AssignmentExpression', 'UpdateExpression'].includes(s.expression.type) || (s.expression.type==='CallExpression' && (s.expression.callee.type==='MemberExpression' || GL.has(s.expression.callee.name)))); if (live) { best = tail; break; } }
    }
    if (best) { flagged++; console.log(`CMT ${f}:${c.line}  …${best.slice(0, 170)}`); }
  }
  // duplicate keys / cases / nested dup decl
  (function walk(n, fnScope) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'ObjectExpression') { const seen = new Map(); for (const p of n.properties) { if (p.type !== 'Property' || p.computed) continue; const k = p.key.name ?? String(p.key.value); if (seen.has(k) && p.kind === 'init' && seen.get(k) === 'init') console.log(`DUPKEY ${f}:${p.loc.start.line} "${k}"`); seen.set(k, p.kind); } }
    if (n.type === 'SwitchStatement') { const seen = new Set(); for (const c of n.cases) { if (!c.test) continue; const k = src.slice(c.test.start, c.test.end); if (seen.has(k)) console.log(`DUPCASE ${f}:${c.loc.start.line} ${k}`); seen.add(k); } }
    if (n.type === 'BlockStatement' || n.type === 'Program') { const seen = new Map(); for (const s of n.body) { if (s.type === 'FunctionDeclaration') { if (seen.has(s.id.name)) console.log(`DUPFN ${f}:${s.loc.start.line} ${s.id.name} (also line ${seen.get(s.id.name)})`); seen.set(s.id.name, s.loc.start.line); } } }
    if (/Function/.test(n.type)) { const names = new Set(); for (const p of n.params) { const nm = p.type === 'Identifier' ? p.name : p.type === 'AssignmentPattern' && p.left.type === 'Identifier' ? p.left.name : null; if (nm) { if (names.has(nm)) console.log(`DUPPARAM ${f}:${n.loc.start.line} ${nm}`); names.add(nm); } } }
    for (const k in n) { if (k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(x => walk(x)); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
}
console.log('line comments', nc, 'flagged', flagged);
