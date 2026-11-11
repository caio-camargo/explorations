// node --expose-internals scan.cjs  : no-undef + duplicate top-level + load-time forward refs across classic scripts
const acorn = require('internal/deps/acorn/acorn/dist/acorn');
const fs = require('fs'), path = require('path');
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (process.argv.includes('--views')) files.push('views.js');
const BROWSER = new Set(('window document navigator location localStorage sessionStorage console performance requestAnimationFrame cancelAnimationFrame setTimeout clearTimeout setInterval clearInterval ' +
  'Math JSON Object Array String Number Boolean Date RegExp Error TypeError RangeError Map Set WeakMap WeakSet Promise Symbol Infinity NaN undefined isNaN isFinite parseFloat parseInt ' +
  'Float32Array Float64Array Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array Uint8ClampedArray ArrayBuffer DataView URLSearchParams URL Blob File FileReader Image Audio AudioContext webkitAudioContext ' +
  'fetch alert confirm prompt atob btoa structuredClone innerWidth innerHeight devicePixelRatio addEventListener removeEventListener dispatchEvent Event KeyboardEvent MouseEvent CustomEvent ' +
  'HTMLElement HTMLCanvasElement Element Node getComputedStyle matchMedia history screen crypto TextEncoder TextDecoder globalThis self arguments encodeURIComponent decodeURIComponent encodeURI decodeURI ' +
  'queueMicrotask ResizeObserver MutationObserver IntersectionObserver OffscreenCanvas ImageData createImageBitmap Path2D WebGL2RenderingContext WebGLRenderingContext Intl BigInt Reflect Proxy eval Function ' +
  'MediaRecorder Worker open close focus scrollTo requestIdleCallback CompressionStream DecompressionStream Response Request Headers AbortController navigator speechSynthesis DOMParser XMLSerializer CSS escape unescape SyntaxError ReferenceError EvalError URIError AggregateError WeakRef FinalizationRegistry Atomics SharedArrayBuffer BigInt64Array BigUint64Array GainNode OscillatorNode top parent frames name status event onerror onload print stop scrollX scrollY pageXOffset pageYOffset outerWidth outerHeight visualViewport indexedDB caches origin isSecureContext').split(/\s+/));
const glob = new Map();      // name -> [{file,line,kind}]
const progs = [];
for (const f of files) {
  const src = fs.readFileSync(ROOT + f, 'utf8');
  let ast; try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true }); } catch (e) { console.log('PARSE FAIL', f, e.message); continue; }
  progs.push({ f, ast, src });
}
function patNames(p, out) {
  if (!p) return; switch (p.type) {
    case 'Identifier': out.push(p); break;
    case 'ObjectPattern': for (const q of p.properties) patNames(q.type === 'RestElement' ? q.argument : q.value, out); break;
    case 'ArrayPattern': for (const q of p.elements) patNames(q, out); break;
    case 'AssignmentPattern': patNames(p.left, out); break;
    case 'RestElement': patNames(p.argument, out); break;
  }
}
const isFn = n => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
function kids(n) { const o = []; for (const k in n) { if (k === 'loc' || k === 'type') continue; const v = n[k]; if (Array.isArray(v)) { for (const x of v) if (x && typeof x.type === 'string') o.push(x); } else if (v && typeof v.type === 'string') o.push(v); } return o; }
// hoist var + function decls (function scope)
function hoistVars(n, scope, top) {
  if (!n) return;
  if (n.type === 'VariableDeclaration' && n.kind === 'var') { for (const d of n.declarations) { const a = []; patNames(d.id, a); for (const i of a) scope.add(i.name, i, 'var'); } }
  if (isFn(n) && !top) return; if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') { /* methods are functions */ }
  for (const c of kids(n)) { if (isFn(c)) continue; hoistVars(c, scope, false); }
}
function blockDecls(stmts, scope) {
  for (const s of stmts) {
    if (!s) continue;
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') for (const d of s.declarations) { const a = []; patNames(d.id, a); for (const i of a) scope.add(i.name, i, s.kind); }
    if (s.type === 'FunctionDeclaration') scope.add(s.id.name, s.id, 'function');
    if (s.type === 'ClassDeclaration') scope.add(s.id.name, s.id, 'class');
  }
}
class Scope { constructor(parent, file) { this.parent = parent; this.m = new Map(); this.file = file; } add(n, node, kind) { if (!this.m.has(n)) this.m.set(n, []); this.m.get(n).push({ node, kind }); } has(n) { for (let s = this; s; s = s.parent) if (s.m.has(n)) return s; return null; } }
const G = new Scope(null); G.isGlobal = true;
G.add = function (n, node, kind) { if (!glob.has(n)) glob.set(n, []); glob.get(n).push({ file: this.cur, line: node.loc.start.line, kind }); Scope.prototype.add.call(this, n, node, kind); };
const undef = new Map(), topRefs = [], implicit = new Map();
function ref(id, scope, file, depth, assign) {
  const s = scope.has(id.name);
  if (!s) { if (BROWSER.has(id.name)) return; const m = assign ? implicit : undef; if (!m.has(id.name)) m.set(id.name, []); m.get(id.name).push(file + ':' + id.loc.start.line); return; }
  if (s.isGlobal && depth === 0) topRefs.push({ name: id.name, file, line: id.loc.start.line, col: id.loc.start.column });
}
function visit(n, scope, file, depth) {
  if (!n) return;
  switch (n.type) {
    case 'Identifier': ref(n, scope, file, depth); return;
    case 'MemberExpression': visit(n.object, scope, file, depth); if (n.computed) visit(n.property, scope, file, depth); return;
    case 'Property': if (n.computed) visit(n.key, scope, file, depth); visit(n.value, scope, file, depth); return;
    case 'MethodDefinition': case 'PropertyDefinition': if (n.computed) visit(n.key, scope, file, depth); visit(n.value, scope, file, depth); return;
    case 'LabeledStatement': visit(n.body, scope, file, depth); return;
    case 'BreakStatement': case 'ContinueStatement': return;
    case 'AssignmentExpression': if (n.left.type === 'Identifier') { ref(n.left, scope, file, depth, n.operator === '='); } else visit(n.left, scope, file, depth); visit(n.right, scope, file, depth); return;
    case 'VariableDeclaration': for (const d of n.declarations) { visitPat(d.id, scope, file, depth); visit(d.init, scope, file, depth); } return;
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': {
      const fs_ = new Scope(scope);
      if (n.type === 'FunctionExpression' && n.id) fs_.add(n.id.name, n.id, 'fname');
      for (const p of n.params) { const a = []; patNames(p, a); for (const i of a) fs_.add(i.name, i, 'param'); }
      if (n.type !== 'ArrowFunctionExpression') fs_.add('arguments', n, 'param');
      hoistVars(n.body, fs_, true);
      for (const p of n.params) visitPat(p, fs_, file, depth + 1);
      if (n.body.type === 'BlockStatement') { blockDecls(n.body.body, fs_); for (const s of n.body.body) visit(s, fs_, file, depth + 1); } else visit(n.body, fs_, file, depth + 1);
      return;
    }
    case 'ClassDeclaration': case 'ClassExpression': { const cs = new Scope(scope); if (n.id) cs.add(n.id.name, n.id, 'class'); visit(n.superClass, cs, file, depth); visit(n.body, cs, file, depth); return; }
    case 'BlockStatement': case 'StaticBlock': { const bs = new Scope(scope); blockDecls(n.body, bs); for (const s of n.body) visit(s, bs, file, depth); return; }
    case 'SwitchStatement': { visit(n.discriminant, scope, file, depth); const bs = new Scope(scope); for (const c of n.cases) blockDecls(c.consequent, bs); for (const c of n.cases) { visit(c.test, bs, file, depth); for (const s of c.consequent) visit(s, bs, file, depth); } return; }
    case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': { const bs = new Scope(scope); const init = n.init || n.left; if (init && init.type === 'VariableDeclaration') blockDecls([init], bs); for (const c of kids(n)) visit(c, bs, file, depth); return; }
    case 'CatchClause': { const bs = new Scope(scope); if (n.param) { const a = []; patNames(n.param, a); for (const i of a) bs.add(i.name, i, 'param'); } visit(n.body, bs, file, depth); return; }
    default: for (const c of kids(n)) visit(c, scope, file, depth);
  }
}
function visitPat(p, scope, file, depth) {
  if (!p) return; switch (p.type) {
    case 'Identifier': return;
    case 'ObjectPattern': for (const q of p.properties) { if (q.type === 'RestElement') continue; if (q.computed) visit(q.key, scope, file, depth); visitPat(q.value, scope, file, depth); } return;
    case 'ArrayPattern': for (const q of p.elements) visitPat(q, scope, file, depth); return;
    case 'AssignmentPattern': visitPat(p.left, scope, file, depth); visit(p.right, scope, file, depth); return;
    case 'RestElement': return;
    default: visit(p, scope, file, depth);
  }
}
// pass 1: globals of all files
for (const p of progs) { G.cur = p.f; hoistVars(p.ast, G, true); blockDecls(p.ast.body, G); }
// pass 2
for (const p of progs) for (const s of p.ast.body) visit(s, G, p.f, 0);
console.log('== UNDEFINED names:', undef.size);
for (const [k, v] of undef) console.log('  ', k, v.length, v.slice(0, 6).join(' '));
console.log('== IMPLICIT global assignment (never declared):', implicit.size);
for (const [k, v] of implicit) console.log('  ', k, v.slice(0, 6).join(' '));
console.log('== DUPLICATE top-level declarations');
let nd = 0; for (const [k, v] of glob) if (v.length > 1) { nd++; console.log('  ', k, v.map(x => `${x.kind}@${x.file}:${x.line}`).join('  ')); }
console.log('dups', nd, 'globals', glob.size);
// load-time forward references: top-level (depth 0) refs to a let/const/class declared in a later file, or later in the same file
const order = new Map(files.map((f, i) => [f, i]));
console.log('== LOAD-TIME forward refs (depth 0) to let/const/class declared later');
let nf = 0; for (const r of topRefs) { const d = glob.get(r.name)[0]; if (d.kind === 'function' || d.kind === 'var') continue; const later = order.get(d.file) > order.get(r.file) || (d.file === r.file && d.line > r.line); if (later) { nf++; console.log('  ', r.name, `${r.file}:${r.line}`, '-> decl', `${d.kind}@${d.file}:${d.line}`); } }
console.log('forward', nf);
fs.writeFileSync(path.join(__dirname, 'globals.json'), JSON.stringify([...glob].map(([k, v]) => [k, v])));
