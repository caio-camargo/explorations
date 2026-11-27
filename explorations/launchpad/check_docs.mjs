// Document check (QUEUE Q298; ROADMAP § Documents, rule 7). Reads the launchpad's docs and reports what has drifted:
//   header   a doc's header **Version** differs from the newest version in its own "## Version history"
//   index    a top-level doc linked from neither the root INDEX.md nor ROADMAP.md (its catalog, or anywhere in it)
//   link     a relative link to a file that isn't there (top-level docs, notes/, mockups/README.md; archive/ is left alone)
//   after    a QUEUE row still waiting "after Qn" when every Qn it names is ✓ (in QUEUE or archive/queue-*.md)
//   node check_docs.mjs            every finding, one per line; exit 1 if any
//   node check_docs.mjs --json     the same as JSON
//   node check_docs.mjs --only link,header
// Not checked yet (rule 7 names them): QUEUE rows naming answered W/D questions, size budgets.
// Test platform-15 runs it on fixtures and prints the live tree's counts.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const KINDS = ['header', 'index', 'link', 'after'];

const semKey = v => v.replace(/^v/, '').split('.').map(Number);
const semCmp = (a, b) => { const x = semKey(a), y = semKey(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
const lines = t => t.replace(/\r\n/g, '\n').split('\n');

// header: {have, newest} for one doc's text, or null when it has no header version or no history
export function headerCheck(text) {
  const L = lines(text), m = L.slice(0, 12).join('\n').match(/\*\*Version\*\*:\s*v?(\d+\.\d+\.\d+)/);
  if (!m) return null;
  const h = L.findIndex(l => /^#{2,3} (Version history|History|Changelog)\b/i.test(l));
  if (h < 0) return null;
  let newest = null;
  for (const l of L.slice(h + 1)) {
    if (/^#{1,2} /.test(l)) break;
    const v = l.match(/^\s*(?:[-*]|\|)\s*(?:\*\*)?v?(\d+\.\d+\.\d+)/);
    if (v && (!newest || semCmp(v[1], newest) > 0)) newest = v[1];
  }
  return newest ? { have: m[1], newest } : null;
}

// links: [{line, target}] of relative links in a markdown text (fenced code and inline code skipped)
export function relLinks(text) {
  const out = []; let fence = false;
  lines(text).forEach((l, i) => {
    if (/^\s*```/.test(l)) { fence = !fence; return; }
    if (fence) return;
    for (const m of l.replace(/`[^`]*`/g, '``').matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const t = m[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(t) || t.startsWith('<')) continue;
      out.push({ line: i + 1, target: t });
    }
  });
  return out;
}
const linkPath = (from, t) => { let p = t.split('#')[0].split('?')[0]; try { p = decodeURIComponent(p); } catch { } return p ? resolve(dirname(from), p) : null; };

// after: [{line, id, waits}] for QUEUE rows whose state waits on items that are all done. `done(id)` → bool
const cells = l => l.split('|').map(c => c.trim());
export function staleAfter(queueText, done) {
  const out = [];
  lines(queueText).forEach((l, i) => {
    const m = l.match(/^\| (?:~~)?([QWDR]\d+[a-z]?)(?:~~)? \|/); if (!m) return;
    const st = cells(l)[6] || '', a = st.match(/^after ([^;(]*)/i); if (!a) return;
    const ids = [...a[1].matchAll(/\b([QWDR]\d+[a-z]?)\b/g)].map(x => x[1]);
    if (ids.length && ids.every(done)) out.push({ line: i + 1, id: m[1], waits: ids.join(', ') });
  });
  return out;
}
// id → done (✓ state) over QUEUE and its archives
export function doneSet(texts) {
  const d = new Set();
  for (const t of texts) for (const l of lines(t)) {
    const m = l.match(/^\| (?:~~)?([QWDR]\d+[a-z]?)(?:~~)? \|/); if (!m) continue;
    const c = cells(l);
    if (/^~~/.test(c[1]) || c.slice(6).some(x => /^(?:\*\*)?✓/.test(x))) d.add(m[1]);
  }
  return d;
}

const mdIn = dir => existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.md')).map(f => join(dir, f)) : [];

// every finding in a launchpad tree at `dir` (the repo root is two up, for INDEX.md)
export function findings(dir = HERE, only = KINDS) {
  const out = [], rd = f => readFileSync(f, 'utf8'), rel = f => relative(dir, f).replace(/\\/g, '/');
  const top = mdIn(dir), docs = [...top, ...mdIn(join(dir, 'notes')), ...[join(dir, 'mockups', 'README.md')].filter(existsSync)];
  if (only.includes('header')) for (const f of top) {
    const h = headerCheck(rd(f));
    if (h && h.have !== h.newest) out.push({ kind: 'header', file: rel(f), line: 0, text: `header says ${h.have}, its history's newest is ${h.newest}` });
  }
  if (only.includes('index')) {
    const idx = join(dir, '..', '..', 'INDEX.md'), road = join(dir, 'ROADMAP.md');
    const linked = new Set();
    for (const [f, t] of [[idx, existsSync(idx) ? rd(idx) : ''], [road, existsSync(road) ? rd(road) : '']])
      for (const l of relLinks(t)) { const p = linkPath(f, l.target); if (p) linked.add(p.toLowerCase()); }
    for (const f of top) if (!/[\\/]ROADMAP\.md$/.test(f) && !linked.has(f.toLowerCase()))
      out.push({ kind: 'index', file: rel(f), line: 0, text: 'linked from neither INDEX.md nor ROADMAP.md' });
  }
  if (only.includes('link')) for (const f of docs) for (const l of relLinks(rd(f))) {
    const p = linkPath(f, l.target);
    if (p && !existsSync(p)) out.push({ kind: 'link', file: rel(f), line: l.line, text: `broken link: ${l.target}` });
  }
  if (only.includes('after')) {
    const q = join(dir, 'QUEUE.md');
    if (existsSync(q)) {
      const arch = mdIn(join(dir, 'archive')).filter(f => /[\\/]queue-[^\\/]*\.md$/.test(f)).map(rd), d = doneSet([rd(q), ...arch]);
      for (const s of staleAfter(rd(q), id => d.has(id))) out.push({ kind: 'after', file: 'QUEUE.md', line: s.line, text: `${s.id} waits on ${s.waits}, all ✓` });
    }
  }
  return out;
}

export function main(argv) {
  const o = argv.indexOf('--only'), only = o >= 0 ? argv[o + 1].split(',') : KINDS;
  const f = findings(HERE, only);
  if (argv.includes('--json')) console.log(JSON.stringify(f, null, 1));
  else {
    for (const x of f) console.log(`${x.kind.padEnd(6)}  ${x.file}${x.line ? ':' + x.line : ''}  ${x.text}`);
    console.log(`${f.length ? 'FAIL' : 'ok'}: ${only.map(k => `${f.filter(x => x.kind === k).length} ${k}`).join(', ')}`);
  }
  return f.length ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(main(process.argv.slice(2)));
