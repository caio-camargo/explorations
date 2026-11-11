// Prototype for R3(a): a // comment whose tail parses as statements. Fixtures: the five lines of R4 (from 8154e737^).
import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process'; import { readFileSync, readdirSync } from 'node:fs';
const L = fileURLToPath(new URL('../../', import.meta.url)).split(String.fromCharCode(92)).join('/');
const BS = String.fromCharCode(92);
// where the line's // comment starts, skipping strings, templates (one line) and regex literals; -1 if none
function commentAt(l) { let q = null, re = false, cls = false, prev = '';
  for (let i = 0; i < l.length; i++) { const c = l[i];
    if (q) { if (c === BS) i++; else if (c === q) q = null; continue; }
    if (re) { if (c === BS) i++; else if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) re = false; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && l[i + 1] === '/') return i;
    if (c === '/' && l[i + 1] === '*') { const e = l.indexOf('*/', i + 2); if (e < 0) return -1; i = e + 1; continue; }
    if (c === '/' && (prev === '' || /[(,=:[!&|?{};+*%<>~^-]/.test(prev) || /(?:return|typeof)$/.test(l.slice(0, i).trimEnd()))) { re = true; cls = false; continue; }
    if (c.trim()) prev = c; }
  return -1; }
// the comment's tail, from a place a statement could begin, must parse as statements and end in ; or }
const START = /^(?:(?:const|let|var)[ ]|if[ ]*[(]|for[ ]*[(]|while[ ]*[(]|return[ ;]|[A-Za-z_$][A-Za-z0-9_$.]*(?:[[][^\]]*[\]])?[ ]*(?:[-+*/%|&^]?=(?!=)|[(]|[+][+]|--))/;
function swallowed(cm) {
  for (const m of cm.matchAll(/[A-Za-z_$][A-Za-z0-9_$.]*/g)) { const tail = cm.slice(m.index).trim();
    if (!/[;}]$/.test(tail) || !START.test(tail)) continue;
    try { new Function('async function*_(){' + tail + '\n}'); } catch { continue; }
    const glued = m.index > 0 && cm[m.index - 1].trim() !== '';
    // prose that only names one call or one assignment after a space ("see foo(x);") is not flagged unless glued to the text before it
    if (!glued && /^[A-Za-z0-9_$.]+[(][^()]*[)];?$/.test(tail)) continue;
    return (glued ? 'GLUED ' : 'tail  ') + tail.slice(0, 80); }
  return null; }
const scan = (name, text) => { const out = []; text.split(/\r?\n/).forEach((l, i) => { const at = commentAt(l); if (at < 0) return; const h = swallowed(l.slice(at + 2)); if (h) out.push(`${name}:${i + 1}  ${h}`); }); return out; };
const files = [...readdirSync(L + 'sim').map(f => 'sim/' + f), ...readdirSync(L + 'app').map(f => 'app/' + f), 'builder.js', 'views.js'].filter(f => f.endsWith('.js'));
const old = f => execFileSync('git', ['-C', L, 'show', `8154e737^:explorations/launchpad/${f}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
const fx = ['app/editor.js', 'app/screens.js', 'app/render.js', 'builder.js', 'sim/ground.js'];
console.log('--- before R4 (expect one hit in each of five files):'); for (const f of fx) { const h = scan(f, old(f)); console.log(`${f}: ${h.length} hit(s)` + h.map(x => '\n    ' + x).join('')); }
console.log('--- now, every sim/app script:'); let n = 0; for (const f of files) for (const h of scan(f, readFileSync(L + f, 'utf8'))) { n++; console.log('  ' + h); } console.log(n, 'hits in', files.length, 'files');
const tests = readdirSync(L + 'tests').filter(f => f.endsWith('.mjs')).map(f => 'tests/' + f).concat(readdirSync(L).filter(f => f.endsWith('.mjs'))); const th = [];
for (const f of tests) th.push(...scan(f, readFileSync(L + f, 'utf8'))); console.log('--- tests and tools:', th.length, 'hits'); console.log(th.slice(0, 14).map(x => '  ' + x).join('\n'));
