// lint.mjs — the lint step (QUEUE R3; plan REVIEW-2026-11-11.md § 4; platform session 2026-11-12). Two checks, no dependency:
//   (a) code swallowed by a // comment: a line's comment whose tail parses as statements (R4's five lines, R25's five);
//   (b) no-undef across the page's shared scope: index.html's scripts (inline and src, in page order, plus views.js, which
//       the reference shots inject after load) parsed as one global scope with Node's own acorn: names used and declared
//       nowhere, assignments to a name never declared, duplicate top-level declarations, load-time uses of a later let/const.
// Run: node --expose-internals lint.mjs [--json]   (exits 1 on a finding). Test platform-12 runs it in --smoke.
// Acorn is Node's internal copy (internal/deps/acorn/acorn/dist/acorn); if a Node release moves it, this fails loudly.
// A name only ever read behind `typeof X` somewhere (an optional global: DEBUG_PROC, LIFT, recMenu) is reported, not failed.
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = new URL('./', import.meta.url);
const read = f => readFileSync(new URL(f, here), 'utf8');
const BS = String.fromCharCode(92);

// ---- (a) swallowed code ----
// where the line's // comment starts, skipping strings, one-line templates and regex literals; -1 if none
export function commentAt(l) {
  let q = null, re = false, cls = false, prev = '';
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === BS) i++; else if (c === q) q = null; continue; }
    if (re) { if (c === BS) i++; else if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) re = false; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && l[i + 1] === '/') return i;
    if (c === '/' && l[i + 1] === '*') { const e = l.indexOf('*/', i + 2); if (e < 0) return -1; i = e + 1; continue; }
    if (c === '/' && (prev === '' || /[(,=:[!&|?{};+*%<>~^-]/.test(prev) || /(?:return|typeof)$/.test(l.slice(0, i).trimEnd()))) { re = true; cls = false; continue; }
    if (c.trim()) prev = c;
  }
  return -1;
}
// a tail of the comment that starts like a statement (a declaration, if/for/while/return, an assignment, or a call with
// no space before its paren: prose like "baked by atlasBake (SIM);" is not code), ends in ; or } and parses
const START = /^(?:(?:const|let|var)[ ]|if[ ]*[(]|for[ ]*[(]|while[ ]*[(]|return[ ;]|[A-Za-z_$][A-Za-z0-9_$.]*(?:[[][^\]]*[\]])?(?:[ ]*(?:[-+*/%|&^]?=(?!=)|[+][+]|--)|[(]))/;
export function swallowed(comment) {
  for (const m of comment.matchAll(/[A-Za-z_$][A-Za-z0-9_$.]*/g)) {
    const tail = comment.slice(m.index).trim();
    if (!/[;}]$/.test(tail) || !START.test(tail)) continue;
    try { new Function('async function*_(){' + tail + '\n}'); } catch { continue; }
    const glued = m.index > 0 && comment[m.index - 1].trim() !== '';
    // prose naming one call after a space ("see foo(x);") passes unless glued to the word before it
    if (!glued && /^[A-Za-z0-9_$.]+[(][^()]*[)];?$/.test(tail)) continue;
    return tail;
  }
  return null;
}
export const swallowScan = (name, text) => text.split(/\r?\n/).flatMap((l, i) => {
  const at = commentAt(l), h = at < 0 ? null : swallowed(l.slice(at + 2));
  return h ? [`${name}:${i + 1}  ${h.slice(0, 90)}`] : [];
});
// the files (a) reads: the game's scripts, the reference views, the tests and the tools
export function swallowFiles() {
  const js = d => readdirSync(new URL(d + '/', here)).filter(f => /[.]m?js$/.test(f)).map(f => d + '/' + f);
  return [...js('sim'), ...js('app'), 'builder.js', 'views.js', ...js('tests'), ...readdirSync(here).filter(f => f.endsWith('.mjs'))];
}
// fixtures: each must be flagged (R4's five, from 8154e737^; R25's five) or must not be (prose, from today's tree)
export const FIXTURES = {
  hit: [
    "ASM_TERM[k];else b.title=n;   // (Q436) the navball's mark; the word on hoverif(S.sas&&S.sasMode===k)b.classList.add('on');",
    "  progGate=needCharter();   // (the charter is the title screen now, Q241 R3; the desk never shows unfounded)progInbox=box.inbox.filter(n=>n.classList.contains('ms')).length;",
    "sCanopies(d,camW,drawMesh);   // (Q335) a falling stage under its chutesgl.uniform1f(m.uSeam,0);setMarks(m,[]);",
    "hrustLine(o);const k=DPR();   // not on the Program screen: S there is the flown vessel (PLAYTEST #27)o.save();o.font=`${11*k}px ui-monospace,Consolas,monospace`;o.textAlign='left';",
    "m;N[k]*=sstep(.95,1.25,rm);   // a block's flanks aren't glacier floorconst rb=angTo(u,bc)/ER.basin.r;Bl[k]=rb>1.05&&rb<1.9&&inArc(u,ER.blades.az)?sstep(1.05,1.25,rb)*sstep(1.9,1.6,rb):0;",
    ", vc * 1.01), mul(dir, -vc * 0.035));   // just above orbital speed, ~2° down S.throttle = 0; S.sasMode = 'retro'; markT = simT;",
    "  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));   // the whole program state back api.HOOK.news = () => {};",
    "Object.assign(P, JSON.parse(saved));   // the whole program state back: later sections see what they would have without this one api.HOOK.news = () => {};",
    "Object.assign(P, JSON.parse(saved));   // the whole program state back: later sections see what they would have without this one api.HOOK.news = () => {}; api.HOOK.msg = m => log.push(`[t=${api.t.toFixed(1)}] ${m}`);",
    "  for (const k of Object.keys(P)) delete P[k];   // the whole program state back: later sections see what they would have without this one api.HOOK.news = () => {};",
  ],
  miss: [
    "// ---- the program calendar, in Tellus days (8 h, one turn of the planet). Stacking a rocket takes days (bigger, longer);",
    "// (slice 4b) the strip's place is #gslot, the left of the bottom cluster (gauges | throttle | navball | SAS);",
    "// (Q-something, session): C cycles biomes → powers → off. The grid is baked by atlasBake (SIM);",
    "// a share of the commercial market, which commercial offers' pay loses (floored);",
    "// REF_EVAL='js' runs in the page after load, for A/B runs (e.g. REF_EVAL='CLOUD_VOL=false');",
    "x = 1;   // see foo(x);",
  ],
};
export function fixtures() {
  const flag = l => { const at = commentAt(l); return at >= 0 && !!swallowed(l.slice(at + 2)); };
  return { missed: FIXTURES.hit.filter(l => !flag(l)), flagged: FIXTURES.miss.filter(flag) };
}

// ---- (b) no-undef across the shared scope ----
const BROWSER = new Set(('window document navigator location localStorage sessionStorage console performance requestAnimationFrame cancelAnimationFrame setTimeout clearTimeout setInterval clearInterval ' +
  'Math JSON Object Array String Number Boolean Date RegExp Error TypeError RangeError Map Set WeakMap WeakSet Promise Symbol Infinity NaN undefined isNaN isFinite parseFloat parseInt ' +
  'Float32Array Float64Array Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array Uint8ClampedArray ArrayBuffer DataView URLSearchParams URL Blob File FileReader Image Audio AudioContext webkitAudioContext ' +
  'fetch alert confirm prompt atob btoa structuredClone innerWidth innerHeight devicePixelRatio addEventListener removeEventListener dispatchEvent Event KeyboardEvent MouseEvent CustomEvent ' +
  'HTMLElement HTMLCanvasElement Element Node getComputedStyle matchMedia history screen crypto TextEncoder TextDecoder globalThis self arguments encodeURIComponent decodeURIComponent encodeURI decodeURI ' +
  'queueMicrotask ResizeObserver MutationObserver IntersectionObserver OffscreenCanvas ImageData createImageBitmap Path2D WebGL2RenderingContext WebGLRenderingContext Intl BigInt Reflect Proxy eval Function ' +
  'MediaRecorder Worker open close focus scrollTo requestIdleCallback CompressionStream DecompressionStream Response Request Headers AbortController speechSynthesis DOMParser XMLSerializer CSS escape unescape ' +
  'SyntaxError ReferenceError EvalError URIError AggregateError WeakRef FinalizationRegistry Atomics SharedArrayBuffer BigInt64Array BigUint64Array GainNode OscillatorNode top parent frames ' +
  'scrollX scrollY pageXOffset pageYOffset outerWidth outerHeight visualViewport indexedDB caches origin isSecureContext').split(/\s+/));
// index.html's scripts in page order (src and inline), then views.js
export function pageSources() {
  const html = read('index.html'), out = [];
  for (const m of html.matchAll(/<script( src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    if (m[2]) out.push({ f: m[2], src: read(m[2]), line0: 0 });
    else out.push({ f: 'index.html', src: m[3], line0: html.slice(0, m.index).split('\n').length - 1 });
  }
  out.push({ f: 'views.js', src: read('views.js'), line0: 0 });
  return out;
}
export function undefScan(sources = pageSources()) {
  let acorn;
  try { acorn = createRequire(import.meta.url)('internal/deps/acorn/acorn/dist/acorn'); }
  catch (e) { throw new Error(`lint.mjs: Node's acorn not found (run with node --expose-internals; a Node release may have moved internal/deps/acorn): ${e.message}`); }
  const glob = new Map(), progs = [], parseFail = [];
  for (const s of sources) {
    try { progs.push({ ...s, ast: acorn.parse(s.src, { ecmaVersion: 'latest', sourceType: 'script', locations: true }) }); }
    catch (e) { parseFail.push(`${s.f}: ${e.message}`); }
  }
  const at = (p, node) => `${p.f}:${p.line0 + node.loc.start.line}`;
  const patNames = (p, out) => {
    if (!p) return;
    if (p.type === 'Identifier') out.push(p);
    else if (p.type === 'ObjectPattern') for (const q of p.properties) patNames(q.type === 'RestElement' ? q.argument : q.value, out);
    else if (p.type === 'ArrayPattern') for (const q of p.elements) patNames(q, out);
    else if (p.type === 'AssignmentPattern') patNames(p.left, out);
    else if (p.type === 'RestElement') patNames(p.argument, out);
  };
  const isFn = n => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
  const kids = n => { const o = []; for (const k in n) { if (k === 'loc' || k === 'type') continue; const v = n[k]; if (Array.isArray(v)) { for (const x of v) if (x && typeof x.type === 'string') o.push(x); } else if (v && typeof v.type === 'string') o.push(v); } return o; };
  class Scope {
    constructor(parent) { this.parent = parent; this.m = new Map(); }
    add(n) { this.m.set(n, true); }
    has(n) { for (let s = this; s; s = s.parent) if (s.m.has(n)) return s; return null; }
  }
  const G = new Scope(null); G.isGlobal = true; let cur = null;
  G.add = function (n, node, kind) { if (!glob.has(n)) glob.set(n, []); glob.get(n).push({ at: at(cur, node), ord: progs.indexOf(cur), line: node.loc.start.line, kind }); this.m.set(n, true); };
  const hoistVars = (n, scope, top) => {
    if (!n) return;
    if (n.type === 'VariableDeclaration' && n.kind === 'var') for (const d of n.declarations) { const a = []; patNames(d.id, a); for (const i of a) scope.add(i.name, i, 'var'); }
    if (isFn(n) && !top) return;
    for (const c of kids(n)) if (!isFn(c)) hoistVars(c, scope, false);
  };
  const blockDecls = (stmts, scope) => {
    for (const s of stmts) {
      if (!s) continue;
      if (s.type === 'VariableDeclaration' && s.kind !== 'var') for (const d of s.declarations) { const a = []; patNames(d.id, a); for (const i of a) scope.add(i.name, i, s.kind); }
      if (s.type === 'FunctionDeclaration') scope.add(s.id.name, s.id, 'function');
      if (s.type === 'ClassDeclaration') scope.add(s.id.name, s.id, 'class');
    }
  };
  const undef = new Map(), implicit = new Map(), guarded = new Set(), topRefs = [];
  const note = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  let P = null;
  const ref = (id, scope, depth, assign) => {
    const s = scope.has(id.name);
    if (!s) { if (!BROWSER.has(id.name) && !winNames.has(id.name)) note(assign ? implicit : undef, id.name, at(P, id)); return; }
    if (s.isGlobal && depth === 0) topRefs.push({ name: id.name, at: at(P, id), ord: progs.indexOf(P), line: id.loc.start.line });
  };
  const visitPat = (p, scope, depth) => {
    if (!p) return;
    switch (p.type) {
      case 'Identifier': case 'RestElement': return;
      case 'ObjectPattern': for (const q of p.properties) { if (q.type === 'RestElement') continue; if (q.computed) visit(q.key, scope, depth); visitPat(q.value, scope, depth); } return;
      case 'ArrayPattern': for (const q of p.elements) visitPat(q, scope, depth); return;
      case 'AssignmentPattern': visitPat(p.left, scope, depth); visit(p.right, scope, depth); return;
      default: visit(p, scope, depth);
    }
  };
  function visit(n, scope, depth) {
    if (!n) return;
    switch (n.type) {
      case 'Identifier': ref(n, scope, depth); return;
      case 'UnaryExpression': if (n.operator === 'typeof' && n.argument.type === 'Identifier' && !scope.has(n.argument.name)) { guarded.add(n.argument.name); return; } visit(n.argument, scope, depth); return;
      case 'MemberExpression': visit(n.object, scope, depth); if (n.computed) visit(n.property, scope, depth); return;
      case 'Property': if (n.computed) visit(n.key, scope, depth); visit(n.value, scope, depth); return;
      case 'MethodDefinition': case 'PropertyDefinition': if (n.computed) visit(n.key, scope, depth); visit(n.value, scope, depth); return;
      case 'LabeledStatement': visit(n.body, scope, depth); return;
      case 'BreakStatement': case 'ContinueStatement': return;
      case 'AssignmentExpression': if (n.left.type === 'Identifier') ref(n.left, scope, depth, n.operator === '='); else visit(n.left, scope, depth); visit(n.right, scope, depth); return;
      case 'VariableDeclaration': for (const d of n.declarations) { visitPat(d.id, scope, depth); visit(d.init, scope, depth); } return;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': {
        const fs = new Scope(scope);
        if (n.type === 'FunctionExpression' && n.id) fs.add(n.id.name);
        for (const p of n.params) { const a = []; patNames(p, a); for (const i of a) fs.add(i.name); }
        if (n.type !== 'ArrowFunctionExpression') fs.add('arguments');
        hoistVars(n.body, fs, true);
        for (const p of n.params) visitPat(p, fs, depth + 1);
        if (n.body.type === 'BlockStatement') { blockDecls(n.body.body, fs); for (const s of n.body.body) visit(s, fs, depth + 1); } else visit(n.body, fs, depth + 1);
        return;
      }
      case 'ClassDeclaration': case 'ClassExpression': { const cs = new Scope(scope); if (n.id) cs.add(n.id.name); visit(n.superClass, cs, depth); visit(n.body, cs, depth); return; }
      case 'BlockStatement': case 'StaticBlock': { const bs = new Scope(scope); blockDecls(n.body, bs); for (const s of n.body) visit(s, bs, depth); return; }
      case 'SwitchStatement': { visit(n.discriminant, scope, depth); const bs = new Scope(scope); for (const c of n.cases) blockDecls(c.consequent, bs); for (const c of n.cases) { visit(c.test, bs, depth); for (const s of c.consequent) visit(s, bs, depth); } return; }
      case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': { const bs = new Scope(scope); const init = n.init || n.left; if (init && init.type === 'VariableDeclaration') blockDecls([init], bs); for (const c of kids(n)) visit(c, bs, depth); return; }
      case 'CatchClause': { const bs = new Scope(scope); if (n.param) { const a = []; patNames(n.param, a); for (const i of a) bs.add(i.name); } visit(n.body, bs, depth); return; }
      default: for (const c of kids(n)) visit(c, scope, depth);
    }
  }
  for (const p of progs) { cur = p; hoistVars(p.ast, G, true); blockDecls(p.ast.body, G); }
  // `window.name = …` anywhere makes a global too (views.js's refView)
  const winNames = new Set(), win = n => { if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && !n.left.computed
    && n.left.object.type === 'Identifier' && n.left.object.name === 'window') winNames.add(n.left.property.name); for (const c of kids(n)) win(c); };
  for (const p of progs) win(p.ast);
  for (const p of progs) { P = p; for (const s of p.ast.body) visit(s, G, 0); }
  const obj = m => Object.fromEntries([...m].map(([k, v]) => [k, v.slice(0, 6)]));
  const optional = new Map([...undef].filter(([k]) => guarded.has(k)));
  for (const k of optional.keys()) undef.delete(k);
  const dups = [...glob].filter(([, v]) => v.length > 1).map(([k, v]) => `${k}: ${v.map(x => `${x.kind} ${x.at}`).join(', ')}`);
  const forward = topRefs.flatMap(r => {
    const d = glob.get(r.name)[0];
    if (d.kind === 'function' || d.kind === 'var') return [];
    return d.ord > r.ord || (d.ord === r.ord && d.line > r.line) ? [`${r.name} at ${r.at}, declared (${d.kind}) at ${d.at}`] : [];
  });
  return { files: progs.length, globals: glob.size, parseFail, undef: obj(undef), implicit: obj(implicit), optional: [...optional.keys()], dups, forward };
}

export function lint() {
  const swallow = swallowFiles().flatMap(f => swallowScan(f, read(f)));
  return { swallow, fixtures: fixtures(), scope: undefScan() };
}
export const failures = r => [
  ...r.swallow.map(x => 'swallowed: ' + x),
  ...r.fixtures.missed.map(x => 'fixture not flagged: ' + x.slice(0, 80)), ...r.fixtures.flagged.map(x => 'prose flagged: ' + x.slice(0, 80)),
  ...r.scope.parseFail.map(x => 'parse: ' + x),
  ...Object.entries(r.scope.undef).map(([k, v]) => `undefined: ${k} (${v.join(' ')})`),
  ...Object.entries(r.scope.implicit).map(([k, v]) => `assigned, never declared: ${k} (${v.join(' ')})`),
  ...r.scope.dups.map(x => 'declared twice: ' + x), ...r.scope.forward.map(x => 'used at load before its declaration: ' + x),
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = lint(), bad = failures(r);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r));
  else {
    console.log(`lint: ${swallowFiles().length} files read for swallowed code; ${r.scope.files} scripts, ${r.scope.globals} top-level names; optional (typeof-guarded): ${r.scope.optional.join(', ') || 'none'}`);
    console.log(bad.length ? bad.join('\n') : 'clean');
  }
  process.exit(bad.length ? 1 : 0);
}
