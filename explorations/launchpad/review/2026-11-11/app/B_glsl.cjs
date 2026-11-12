// node --expose-internals B_glsl.cjs : uniforms declared vs set, varyings vs/fs, per program (needs B_progs.json from B_glrun.cjs)
const acorn = require('internal/deps/acorn/acorn/dist/acorn');
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const progs = JSON.parse(fs.readFileSync(__dirname + '/B_progs.json', 'utf8'));
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !f.startsWith('sim/'));
if (process.argv.includes('--views')) files.push('views.js');
const strip = s => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const decl = (s, kw) => [...strip(s).matchAll(new RegExp('(?:^|[;\\n}])\\s*(?:layout\\([^)]*\\)\\s*)?(?:flat\\s+|smooth\\s+|centroid\\s+)?' + kw + '\\s+(?:highp\\s+|mediump\\s+|lowp\\s+)?(\\w+)\\s+([^;]+);', 'g'))].flatMap(m => m[2].split(',').map(x => ({ type: m[1], name: x.trim().replace(/\[.*$/, '') })));
// usage count of an identifier in the shader body
const uses = (s, n) => (strip(s).match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
// JS side
const sets = [];   // {name, prog|null, loc}
const reads = [];  // any X.u.name / alias.name read (to catch uniform passed through helpers)
for (const f of files) {
  const src = fs.readFileSync(ROOT + f, 'utf8'); const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true });
  const txt = n => src.slice(n.start, n.end);
  const progOf = (e, stack) => {   // expression that should evaluate to a `.u` table
    if (!e) return null;
    if (e.type === 'MemberExpression' && !e.computed && e.property.name === 'u') { if (e.object.type === 'Identifier' && progs[e.object.name]) return [e.object.name]; return ['?' + txt(e.object)]; }
    if (e.type === 'ConditionalExpression') { const a = progOf(e.consequent, stack), b = progOf(e.alternate, stack); return a && b ? [...a, ...b] : null; }
    if (e.type === 'Identifier') { for (let i = stack.length - 1; i >= 0; i--) { const d = stack[i].get(e.name); if (d !== undefined) return d; } return null; }
    return null;
  };
  (function walk(n, stack) {
    if (!n || typeof n.type !== 'string') return;
    let st = stack;
    if (/Function/.test(n.type) || n.type === 'Program' || n.type === 'BlockStatement') { st = [...stack, new Map()]; if (n.params) for (const p of n.params) if (p.type === 'Identifier') st[st.length - 1].set(p.name, null); }
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) { const p = progOf(n.init, st); if (p) st[st.length - 1].set(n.id.name, p); else if (st[st.length - 1].has(n.id.name) === false) { /* shadow unknown */ let known = false; for (const m of st) if (m.get(n.id.name)) known = true; if (known) st[st.length - 1].set(n.id.name, null); } }
    if (n.type === 'VariableDeclarator' && n.id.type === 'ObjectPattern' && n.init) for (const q of n.id.properties) if (q.key && q.key.name === 'u' && q.value.type === 'Identifier') { st[st.length - 1].set(q.value.name, n.init.type === 'Identifier' && progs[n.init.name] ? [n.init.name] : ['?' + txt(n.init)]); }
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.type === 'Identifier' && n.callee.object.name === 'gl' && /^uniform/.test(n.callee.property.name || '')) {
      const a = n.arguments[0]; const loc = f + ':' + n.loc.start.line;
      if (a && a.type === 'MemberExpression' && !a.computed) sets.push({ name: a.property.name, prog: progOf(a.object, st), loc, fn: n.callee.property.name, objTxt: txt(a.object) });
      else sets.push({ name: null, prog: null, loc, raw: a ? txt(a).slice(0, 60) : '' });
    }
    for (const k in n) { if (k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(x => walk(x, st)); else if (v && typeof v.type === 'string') walk(v, st); }
  })(ast, []);
}
const resolved = sets.filter(s => s.prog && s.prog.every(p => !p.startsWith('?'))), unresolved = sets.filter(s => !resolved.includes(s));
console.log('uniform calls', sets.length, 'resolved to a program', resolved.length, 'unresolved', unresolved.length);
const anyNames = new Map(); for (const s of unresolved) if (s.name) { if (!anyNames.has(s.name)) anyNames.set(s.name, []); anyNames.get(s.name).push(s.loc + '(' + s.objTxt + ')'); }
const dynamic = unresolved.filter(s => !s.name); console.log('dynamic first-arg calls:', dynamic.map(s => s.loc + ' ' + s.raw).join(' | '));
console.log('\n== (a) declared in GLSL, used in the shader body, never set by any JS call (resolved or unresolved name)');
for (const [pn, P] of Object.entries(progs)) {
  const both = P.vs + '\n' + P.fs;
  for (const u of P.un) {
    const set = resolved.some(s => s.name === u && s.prog.includes(pn)) || anyNames.has(u);
    const used = uses(both, u) > 1;
    if (!set) console.log(`  ${pn}.${u}  ${used ? 'USED in shader' : '(declared only, dead)'}`);
    else if (!resolved.some(s => s.name === u && s.prog.includes(pn))) (P.viaAny = P.viaAny || []).push(u);
  }
  if (P.viaAny) console.log(`     [${pn}: set only via unresolved alias: ${P.viaAny.join(' ')}]`);
}
console.log('\n== (b) JS sets a name the resolved program does not declare (silent no-op)');
for (const s of resolved) for (const p of s.prog) if (!progs[p].un.includes(s.name)) console.log(`  ${s.loc} ${p}.u.${s.name} (${s.fn})`);
console.log('   unresolved-alias names that NO program declares:');
const allU = new Set(Object.values(progs).flatMap(P => P.un)); for (const [n, l] of anyNames) if (!allU.has(n)) console.log('  ', n, l.slice(0, 4).join(' '));
console.log('\n== (c) varyings');
for (const [pn, P] of Object.entries(progs)) {
  const vo = decl(P.vs, 'out'), fi = decl(P.fs, 'in');
  for (const v of vo) { const m = fi.find(x => x.name === v.name); if (!m) { if (uses(P.vs, v.name) > 1) console.log(`  ${pn}: VS writes ${v.type} ${v.name}, FS does not declare it`); } else if (m.type !== v.type) console.log(`  ${pn}: ${v.name} type mismatch VS ${v.type} / FS ${m.type}`); }
  for (const v of fi) if (!vo.find(x => x.name === v.name)) console.log(`  ${pn}: FS reads ${v.type} ${v.name}, VS does not write it  <-- LINK ERROR`);
  for (const v of vo) if (uses(P.vs, v.name) < 2) console.log(`  ${pn}: VS declares out ${v.name} but never assigns it`);
}
console.log('\n== (d) attributes per program'); for (const [pn, P] of Object.entries(progs)) { const a = [...strip(P.vs).matchAll(/layout\(location=(\d+)\)\s*in\s+(\w+)\s+(\w+)/g)].map(m => m[1] + ':' + m[2] + ' ' + m[3]); const bare = decl(P.vs, 'in').length - a.length; console.log(`  ${pn}: ${a.join(', ')}${bare ? '  + ' + bare + ' WITHOUT layout location' : ''}`); }
fs.writeFileSync(__dirname + '/B_sets.json', JSON.stringify(sets));
