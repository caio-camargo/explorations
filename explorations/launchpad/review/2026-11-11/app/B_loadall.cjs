// node B_glrun.cjs : runs builder.js + sim/*.js + app/gl.js against a stub GL/DOM, captures every program's GLSL, writes B_progs.json
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const upto = process.argv[2] || 'app/gl.js';
let src = ''; const used = [];
for (const f of files) { src += fs.readFileSync(ROOT + f, 'utf8') + '\n;'; used.push(f); if (f === upto) break; }
const names = [...src.matchAll(/\b([A-Z][A-Z0-9_]*)=(?:[^;=,]{0,60}\?)?mkProg\(/g)].map(m => m[1]);
const progs = [], shaders = new Map(); let cur = 0;
const U = new Proxy(function () { }, {
  get(t, k) { if (k === Symbol.toPrimitive) return () => 0; if (k === 'length') return 0; if (k === Symbol.iterator) return function* () { }; if (k === 'then') return undefined; return U; },
  apply() { return U; }, construct() { return U; }, set() { return true; }, has() { return true; }
});
const glT = {
  createProgram() { const p = { id: progs.length, vs: null, fs: null }; progs.push(p); return p; },
  createShader(t) { return { t, s: '' }; }, shaderSource(sh, s) { sh.s = s; }, compileShader() { }, getShaderParameter() { return true; },
  attachShader(p, sh) { if (sh.t === 'VS') p.vs = sh.s; else p.fs = sh.s; }, linkProgram() { },
  getProgramParameter(p, w) { if (w === 'AU') { p.un = [...new Set([...(p.vs + p.fs).matchAll(/uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?\w+\s+([^;]+);/g)].flatMap(m => m[1].split(',').map(s => s.trim().replace(/\[.*$/, ''))))]; return p.un.length; } return true; },
  getActiveUniform(p, i) { return { name: p.un[i] }; }, getUniformLocation(p, n) { return { p: p.id, n }; },
  VERTEX_SHADER: 'VS', FRAGMENT_SHADER: 'FS', ACTIVE_UNIFORMS: 'AU', LINK_STATUS: 'LS', COMPILE_STATUS: 'CS',
  getExtension() { return U; }, getParameter() { return 'GPU'; },
};
const gl = new Proxy(glT, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) return k; return () => U; } });
const el = () => new Proxy({ style: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, getContext(k) { return k === 'webgl2' ? gl : U; }, width: 800, height: 600, addEventListener() { }, appendChild() { }, querySelector() { return el(); }, querySelectorAll() { return []; }, getBoundingClientRect() { return { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }; } }, { get(t, k) { return k in t ? t[k] : (typeof k === 'symbol' ? undefined : U); }, set(t, k, v) { t[k] = v; return true; } });
const document = { getElementById: () => el(), createElement: () => el(), querySelector: () => el(), querySelectorAll: () => [], body: el(), head: el(), addEventListener() { }, documentElement: el() };
const ls = { getItem: () => null, setItem() { }, removeItem() { } };
const win = { addEventListener() { }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
let out;
try {
  out = new Function('document', 'localStorage', 'window', 'addEventListener', 'innerWidth', 'innerHeight', 'devicePixelRatio', 'location', 'performance', 'requestAnimationFrame', 'navigator', 'self',
    src + `\n;if(typeof BV_FS!=="undefined")PBV=mkProg(QUAD_VS,BV_FS);return {${names.join(',')}};`)(document, ls, win, () => { }, 800, 600, 1, { search: '', href: '' }, { now: () => 0 }, () => { }, { userAgent: '' }, win);
} catch (e) { console.log('RUN FAIL', e.stack.split('\n').slice(0, 4).join('\n')); process.exit(1); }
const res = {};
for (const n of names) { const P = out[n]; if (!P || !P.p) { console.log('no prog', n); continue; } res[n] = { vs: P.p.vs, fs: P.p.fs, un: Object.keys(P.u) }; }
console.log('programs created', progs.length, 'named', Object.keys(res).length, 'files', used.length);
const anon = progs.filter(p => !Object.values(out).some(P => P && P.p === p)); console.log('unnamed programs', anon.length);

