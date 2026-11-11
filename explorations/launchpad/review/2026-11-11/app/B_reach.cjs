// node B_reach.cjs : per program, uniforms reachable from main() (crude GLSL call graph) vs the uniform names the JS that
// draws with that program sets. Needs B_progs.json and B_sets.json.
const fs = require('fs');
const progs = JSON.parse(fs.readFileSync(__dirname + '/B_progs.json', 'utf8')), sets = JSON.parse(fs.readFileSync(__dirname + '/B_sets.json', 'utf8'));
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const strip = s => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
function funcs(src) {   // top-level function bodies by brace matching
  const s = strip(src), out = {}; let depth = 0, start = -1, name = null, globals = '';
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') { if (depth === 0) { const head = s.slice(last, i); const m = /(\w+)\s*\([^()]*\)\s*$/.exec(head); name = m ? m[1] : null; start = i; if (!m) globals += head; else globals += head.slice(0, m.index); } depth++; }
    else if (c === '}') { depth--; if (depth === 0) { if (name) out[name] = (out[name] || '') + s.slice(start, i + 1); else globals += s.slice(start, i + 1); last = i + 1; } }
  }
  return { out, globals: globals + s.slice(last) };
}
function reachUniforms(P) {
  const res = new Set();
  for (const src of [P.vs, P.fs]) {
    const { out, globals } = funcs(src); const seen = new Set(), todo = ['main'];
    let text = globals;   // global initialisers / consts may reference uniforms (rare)
    while (todo.length) { const f = todo.pop(); if (seen.has(f) || !out[f]) continue; seen.add(f); text += out[f]; for (const g of Object.keys(out)) if (!seen.has(g) && new RegExp('\\b' + g + '\\s*\\(').test(out[f])) todo.push(g); }
    // #define macros: treat all as reachable text
    for (const u of P.un) if (new RegExp('\\b' + u + '\\b').test(text.replace(/uniform[^;]+;/g, ''))) res.add(u);
  }
  return res;
}
// names set per program: resolved sets, plus unresolved sets attributed by the function they sit in
const lines = {}; const lineOf = loc => { const [f, l] = loc.split(':'); lines[f] = lines[f] || fs.readFileSync(ROOT + f, 'utf8').split('\n'); return lines[f][+l - 1]; };
const setBy = {}; for (const pn in progs) setBy[pn] = new Set();
const unres = [];
for (const s of sets) {
  let name = s.name; if (!name) { const m = /\['(\w+)\[0\]'\]/.exec(s.raw); if (m) name = m[1]; }
  if (!name) continue;
  if (s.prog && s.prog.every(p => !p.startsWith('?'))) { for (const p of s.prog) setBy[p].add(name); continue; }
  unres.push({ ...s, name });
}
// attribute unresolved by hand-known owners (the object text tells): render.js:93 loop `prog.u` covers PDEPTH, PSLAB, PSKY
const owners = [];
for (const s of unres) {
  const [f, l] = s.loc.split(':'); const L = +l;
  let own = null;
  if (f === 'app/render.js' && L >= 93 && L <= 117) own = ['PDEPTH', 'PSLAB', 'PSKY'];
  owners.push({ s, own }); if (own) for (const p of own) setBy[p].add(s.name);
}
const left = owners.filter(o => !o.own); const byLoc = {}; for (const o of left) { const k = o.s.loc + ' ' + (o.s.objTxt || o.s.raw); (byLoc[k] = byLoc[k] || []).push(o.s.name); }
console.log('unresolved uniform calls not attributed (object, names):'); for (const k in byLoc) console.log('  ', k, '->', byLoc[k].join(' '));
console.log('\nreachable-from-main uniforms with no attributed setter:');
for (const pn in progs) { const R = reachUniforms(progs[pn]); const miss = [...R].filter(u => !setBy[pn].has(u)); console.log(`  ${pn} (reachable ${R.size}/${progs[pn].un.length}):`, miss.join(' ') || '-'); }
