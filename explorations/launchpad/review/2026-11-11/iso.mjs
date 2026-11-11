// Prototype for R2: the same sections run (a) as today, sharing one api, and (b) with a fresh SIM before each section.
// usage: node iso.mjs <file list, e.g. economy,platform> [skipTitlesRegex]
import { pathToFileURL, fileURLToPath } from 'node:url'; import { readFileSync, writeFileSync } from 'node:fs'; import { spawnSync } from 'node:child_process';
const L = fileURLToPath(new URL('../../', import.meta.url)).split(String.fromCharCode(92)).join('/'), url = pathToFileURL(L + 'test.mjs').href;
const { parse, SLOW } = await import(pathToFileURL(L + 'shards.mjs').href);
const P = parse(readFileSync(L + 'test.mjs', 'utf8'), url), files = process.argv[2].split(','), skip = new RegExp(process.argv[3] || '^$', 'i');
const slow = s => SLOW.some(q => s.text.includes(q)) || skip.test(s.title);
const picked = P.secs.filter(s => files.includes(s.file.replace(/tests\/|\.mjs/g, '')) && !slow(s));
const dir = url.slice(0, url.lastIndexOf('/') + 1), abs = t => t.replaceAll('import.meta.url', JSON.stringify(url)).replace(/from '\.\//g, `from '${dir}`);
const mark = s => `console.log(${JSON.stringify(`#SECTION ${s.ord} ${s.label}`)});`;
// (b) prelude with a factory
let pre = P.prelude; const a = pre.indexOf('const api = new Function('), b = pre.indexOf('`)();', a) + 5;
if (a < 0 || b < 5) throw new Error('prelude shape changed');
pre = pre.slice(0, a) + 'const fresh = () => ' + pre.slice(a + 'const api = '.length, b) + '\nlet api = fresh();' + pre.slice(b);
pre = pre.replace('const { kepler,', 'let { kepler,');
const hook = "api.HOOK.msg = m => log.push(`[t=${api.t.toFixed(1)}] ${m}`);";
if (!pre.includes(hook)) throw new Error('hook line changed');
const reset = `api = fresh(); ({ kepler, elements, len, sub, add, mul, dot, norm, cross, TELLUS, SELENE } = api); log.length = 0; ${hook}`;
const A = abs([P.prelude, ...picked.map(s => mark(s) + '\n' + s.body), P.epilogue].join('\n'));
const B = abs([pre, ...picked.map(s => mark(s) + '\n' + reset + '\n' + s.body), P.epilogue].join('\n'));
const run = (src, tag) => { const t = performance.now(), r = spawnSync(process.execPath, ['--input-type=module'], { input: src, encoding: 'utf8', maxBuffer: 1 << 28, cwd: L });
  const by = new Map(); let cur = null; for (const l of r.stdout.split(/\r?\n/)) { const m = /^#SECTION (\S+) (\S+)$/.exec(l); if (m) { by.set(m[1], cur = { label: m[2], lines: [] }); continue; } if (cur && /^(PASS|FAIL)  /.test(l)) cur.lines.push(l); }
  console.log(`${tag}: exit ${r.status}, ${((performance.now() - t) / 1000).toFixed(0)} s, ${[...by.values()].reduce((n, x) => n + x.lines.length, 0)} checks, ${[...by.values()].reduce((n, x) => n + x.lines.filter(l => l.startsWith('FAIL')).length, 0)} FAIL${r.status && !/FAIL/.test(r.stdout) ? '\n' + r.stderr.slice(0, 1500) : ''}`); return by; };
console.log(`${picked.length} sections from ${files.join(', ')}`);
const ra = run(A, 'shared api (today)'), rb = run(B, 'fresh api per section');
const norm = l => l.replace(/\d+(\.\d+)? ?(ms|s)\b/g, '<t>'); let nd = 0, nf = 0; const out = [];
for (const [ord, x] of ra) { const y = rb.get(ord); if (!y) { out.push(`${x.label}: did not run with a fresh api`); continue; }
  x.lines.forEach((l, i) => { const m = y.lines[i]; if (m === undefined) { out.push(`${x.label}: check missing fresh: ${l.slice(0, 90)}`); return; } if (norm(l) !== norm(m)) { nd++; const flip = l.slice(0, 4) !== m.slice(0, 4); if (flip) nf++; out.push(`${flip ? 'FLIP' : 'diff'} ${x.label}\n   shared: ${l.slice(0, 260)}\n   fresh:  ${m.slice(0, 260)}`); } }); }
console.log(`${nd} checks print something different with a fresh api; ${nf} of them change pass/fail`); writeFileSync(`iso-${files.join('-')}.out.txt`, out.join('\n')); console.log(out.slice(0, 14).join('\n'));
