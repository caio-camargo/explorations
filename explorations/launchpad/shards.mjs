// Test shards for test.mjs (platform session, ROADMAP § Platform lane step 1). test.mjs hands its arguments here:
//   node test.mjs                       the full suite, as always
//   node test.mjs --list                every section: label, file:line, title
//   node test.mjs --only 12,#53,docking  sections by label (all that carry it), --list position, or a word in the header
//   node test.mjs --smoke               all but the SLOW sections below, under a minute
//   node test.mjs --skip 27,docking     all but these (same selectors as --only; combines with --only)
//   node test.mjs --times               the full suite with the seconds each section takes
//   … --jobs 4                          with --only/--skip/--smoke/--times/--isolation: N processes at once
//   node test.mjs --isolation [--jobs 4] [--only …]  each section run alone vs the full run: which checks change
// A section is a top-level comment at column 0 like "// 12. Title" or "// control-3. Title", up to the next one.
// Since Q68 the sections live in tests/<lane>.mjs (TEST_FILES, in that order), not in test.mjs: each lane appends to its
// own file. parse() puts them back between test.mjs's prelude and its summary, so every run is one module, as before.
// Everything before the first section (the SIM, `api`, `check`) runs in every shard, and so does everything after the
// "// ==== END OF SECTIONS" line (the summary and exit code). A section that uses a top-level function another section
// declares (`fly` in §3) pulls that section in. NOTES § "Test shards" says which sections cover what.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The smoke set is everything but the long flights: on 2026-10-08 the full suite took 286 s, of which the crewed Selene
// landing (§27) took 111 s and the ladders (bodies-1) 102 s. Five sections over 5 s make 233 s; the other 77 make 53 s.
// Selectors as for --only (titles here, since labels repeat). Re-time with `--times` when the suite grows; keep the
// smoke run under a minute by adding the next slowest section here, not by dropping areas.
export const SLOW = ['crewed selene landing and return', 'ladders, flown from the pad', 'the program (v1.12)',
  'procedures flown headless', 'procedures (bodies session)'];

const HEAD = /^\/\/ ([0-9]+[a-z]?|[a-z]+-[0-9]+)\. (.*)$/, END = '// ==== END OF SECTIONS', MARK = '// ==== SECTIONS: tests/';
// the section files, in run order (QUEUE Q68): the first suite, then the lanes in ROADMAP's order. A new file goes here.
export const TEST_FILES = ['core', 'flow', 'economy', 'vehicle', 'space', 'world', 'look', 'qa', 'platform'];
const lines0 = text => text.replace(/\r\n/g, '\n').split('\n');

// the sections in lines[from, to) of one file, appended to secs
function collect(lines, file, from, to, secs) {
  const at = [];
  for (let i = from; i < to; i++) { const m = HEAD.exec(lines[i]); if (m) at.push({ label: m[1], title: m[2], file, line: i + 1, from: i }); }
  at.forEach((s, k) => {
    s.ord = secs.length + 1; s.to = k + 1 < at.length ? at[k + 1].from : to;
    const own = lines.slice(s.from, s.to);
    s.body = own.join('\n');
    // top-level declarations (column 0) other sections may use
    s.decls = [...s.body.matchAll(/^(?:async )?function\*? ?([\w$]+)|^(?:const|let|var) ([\w$]+)/gm)].map(m => m[1] || m[2]);
    s.text = [s.label, s.title, ...own.slice(1).filter(l => l.startsWith('//')).map(l => l.slice(3))].join(' ').toLowerCase();
    secs.push(s);
  });
}

// test.mjs's text → {prelude, secs, epilogue}. Sections still written inline in test.mjs (an old branch) run first.
export function parse(text, url) {
  const lines = lines0(text), end = lines.findIndex(l => l.startsWith(END)), mark = lines.findIndex(l => l.startsWith(MARK));
  if (end < 0) throw new Error(`test.mjs has no "${END}" line`);
  const secs = []; collect(lines, 'test.mjs', 0, end, secs);
  const pre = secs.length ? secs[0].from : mark >= 0 ? mark : end;
  if (mark >= 0) for (const f of TEST_FILES) {
    const fl = lines0(readFileSync(new URL(`tests/${f}.mjs`, url), 'utf8'));
    collect(fl, `tests/${f}.mjs`, 0, fl.length, secs);
  }
  if (!secs.length) throw new Error('no test sections found');
  return { prelude: lines.slice(0, pre).join('\n'), secs, epilogue: lines.slice(end).join('\n') };
}

// a selector is a label ("12", "control-3": every section with it), "#53" (the position --list shows; it moves when
// sections are added above), or else a word or phrase in the header comment
export function select(secs, sels, deps = true) {
  const picked = new Set(), unknown = [];
  for (const raw of sels) {
    const q = raw.trim().toLowerCase(); if (!q) continue;
    const hit = q[0] === '#' ? secs.filter(s => s.ord === +q.slice(1))
      : secs.some(s => s.label === q) ? secs.filter(s => s.label === q) : secs.filter(s => s.text.includes(q));
    if (!hit.length) unknown.push(raw);
    hit.forEach(s => picked.add(s));
  }
  const pulled = deps ? withDeps(secs, picked) : new Map();
  return { picked: secs.filter(s => picked.has(s)), pulled, unknown };
}

// pull in the sections declaring top-level names the picked ones use, until nothing new comes in; returns section → name
const uses = (body, d) => new RegExp(`(?<![\\w$.])${d.replace(/\$/g, '\\$')}\\b`).test(body);
function withDeps(secs, picked) {
  const pulled = new Map();
  for (let grew = true; grew;) {
    grew = false;
    for (const s of [...picked]) for (const o of secs) {
      if (picked.has(o)) continue;
      const name = o.decls.find(d => uses(s.body, d));
      if (name) { picked.add(o); pulled.set(o, name); grew = true; }
    }
  }
  return pulled;
}

// one runnable module: prelude, the picked sections in file order (each announcing itself), epilogue. Relative paths
// are made absolute, since the module arrives on stdin.
function build(P, picked, url) {
  const dir = url.slice(0, url.lastIndexOf('/') + 1), mark = s => `console.log(${JSON.stringify(`#SECTION ${s.ord} ${s.label}`)} + ' ' + performance.now().toFixed(0));`;
  return [P.prelude, ...picked.map(s => mark(s) + '\n' + s.body), `console.log('#SECTION end - ' + performance.now().toFixed(0));`, P.epilogue]
    .join('\n').replaceAll('import.meta.url', JSON.stringify(url)).replace(/from '\.\//g, `from '${dir}`);
}

// run a module on a child node; resolves {code, out, secs: Map(ord → {ms, pass, fail: [names]})}
function run(src, { echo = true } = {}) {
  return new Promise(res => {
    const ch = spawn(process.execPath, ['--input-type=module'], { stdio: ['pipe', 'pipe', 'inherit'] });
    const secs = new Map(); let cur = null, t0 = 0, buf = '', out = '';
    const line = l => {
      const m = /^#SECTION (\S+) \S+ (\d+)$/.exec(l);
      if (m) { if (cur) cur.ms = +m[2] - t0; t0 = +m[2]; cur = m[1] === 'end' ? null : { ms: 0, pass: 0, fail: [] }; if (cur) secs.set(+m[1], cur); return; }
      if (cur && l.startsWith('PASS  ')) cur.pass++;
      if (cur && l.startsWith('FAIL  ')) cur.fail.push(l.slice(6).split('  — ')[0]);
      out += l + '\n'; if (echo) console.log(l);
    };
    ch.stdout.on('data', d => { buf += d; const ls = buf.split(/\r?\n/); buf = ls.pop(); ls.forEach(line); });
    ch.on('close', code => { if (buf) line(buf); res({ code, out, secs }); });
    ch.stdin.end(src);
  });
}

const fmt = ms => (ms / 1000).toFixed(1).padStart(6) + ' s';

export async function main(argv, url) {
  const P = parse(readFileSync(fileURLToPath(url), 'utf8'), url);
  const opt = (k) => { const i = argv.findIndex(a => a === k || a.startsWith(k + '=')); if (i < 0) return null;
    return argv[i].includes('=') ? argv[i].split('=').slice(1).join('=') : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''); };
  const known = ['--list', '--only', '--skip', '--smoke', '--times', '--isolation', '--jobs'];
  const bad = argv.filter(a => a.startsWith('--') && !known.includes(a.split('=')[0]));
  if (bad.length) { console.log(`unknown option ${bad.join(' ')}; options: ${known.join(' ')}`); return 2; }

  if (opt('--list') !== null) {
    const dup = l => P.secs.filter(s => s.label === l).length > 1 ? '*' : ' ';
    for (const s of P.secs) console.log(`${String(s.ord).padStart(3)}  ${(s.label + dup(s.label)).padEnd(11)} ${(s.file.replace('tests/', '') + ':' + s.line).padEnd(17)} ${s.title.slice(0, 90)}`);
    console.log(`\n${P.secs.length} sections; * = a label more than one section carries (--only picks them all; a title word picks one)`);
    return 0;
  }
  const only = opt('--only'), skip = [...(opt('--skip') ?? '').split(','), ...(opt('--smoke') !== null ? SLOW : [])].filter(Boolean);
  const sels = only !== null || skip.length;
  const base = only !== null ? select(P.secs, only.split(',')) : { picked: P.secs, unknown: [] }, out = select(P.secs, skip, false);
  const unknown = [...base.unknown, ...out.unknown], keep = new Set(base.picked.filter(s => !out.picked.includes(s)));
  const pulled = withDeps(P.secs, keep), picked = P.secs.filter(s => keep.has(s));
  if (unknown.length) { console.log(`no section matches: ${unknown.join(', ')} (see --list)`); return 2; }

  if (opt('--isolation') !== null) return isolation(P, picked, url, Math.max(1, +(opt('--jobs') || 1)));

  if (sels) console.log(`shard: ${picked.length} of ${P.secs.length} sections: ${picked.map(s => s.label + (pulled.has(s) ? ` (for ${pulled.get(s)})` : '')).join(', ')}\n`);
  const t = performance.now(), jobs = Math.max(1, +(opt('--jobs') || 1));
  const r = jobs > 1 ? await parallel(P, picked, url, jobs) : await run(build(P, picked, url));
  if (opt('--times') !== null || sels) {
    console.log(`\nseconds per section (${fmt(performance.now() - t).trim()} in all${jobs > 1 ? `, ${jobs} processes` : ''}):`);
    const rows = picked.map(s => ({ s, ms: r.secs.get(s.ord)?.ms ?? NaN }));
    if (opt('--times') !== null) rows.sort((a, b) => b.ms - a.ms);
    for (const { s, ms } of rows) console.log(`${fmt(ms)}  ${s.label.padEnd(10)} ${s.title.slice(0, 90)}`);
  }
  if (jobs > 1) console.log(r.code ? `\nFAILED (${r.fails} checks)` : '\nall passed');
  return r.code;
}

// --jobs N: the picked sections dealt into N child processes (the SLOW ones first, one per process), each with what it
// pulls in; output is printed per process when all are done. Sound because every section passes alone (--isolation).
async function parallel(P, picked, url, jobs) {
  const slow = new Set(select(P.secs, SLOW, false).picked), bins = Array.from({ length: jobs }, () => ({ w: 0, s: [] }));
  for (const s of [...picked].sort((a, b) => slow.has(b) - slow.has(a))) {
    const b = bins.reduce((m, x) => x.w < m.w ? x : m); b.s.push(s); b.w += slow.has(s) ? 50 : 1;
  }
  const rs = await Promise.all(bins.filter(b => b.s.length).map(b => {
    const own = new Set(b.s); withDeps(P.secs, own);
    return run(build(P, P.secs.filter(o => own.has(o)), url), { echo: false });
  }));
  const secs = new Map(); let code = 0, fails = 0;
  rs.forEach((r, i) => { console.log(`==== process ${i + 1} of ${rs.length}`); process.stdout.write(r.out);
    if (r.code) code = 1; for (const [k, v] of r.secs) { secs.set(k, v); fails += v.fail.length; } });
  return { code, fails, secs };
}

// Each picked section alone (plus what it pulls in) against the same section in one full run. A section whose checks
// pass in the full run but not alone leans on state an earlier section left behind; one that passes alone but not in
// the full run is disturbed by an earlier one. Both are worth fixing: shards only mean something if sections stand alone.
async function isolation(P, picked, url, jobs) {
  console.log(`full run…`);
  const full = await run(build(P, P.secs, url), { echo: false }), diff = [];
  console.log(`full run: exit ${full.code}; now ${picked.length} sections alone, ${jobs} at a time`);
  const queue = [...picked];
  const worker = async () => {
    for (let s; (s = queue.shift());) {
      const own = new Set([s]); withDeps(P.secs, own);
      const r = await run(build(P, P.secs.filter(o => own.has(o)), url), { echo: false });
      const a = r.secs.get(s.ord) || { pass: 0, fail: ['(did not run)'] }, f = full.secs.get(s.ord) || { pass: 0, fail: [] };
      const same = a.pass === f.pass && a.fail.join('|') === f.fail.join('|') && (r.code === 0) === !a.fail.length;
      console.log(`${same ? 'same' : 'DIFF'}  ${s.label.padEnd(10)} alone ${a.pass} pass ${a.fail.length} fail, full ${f.pass}/${f.fail.length}${fmt(a.ms).replace(/^ */, '  ')}  ${s.title.slice(0, 60)}`);
      if (!same) diff.push({ s, a, f, code: r.code, tail: r.out.split('\n').slice(-8).join('\n') });
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  for (const d of diff) {
    console.log(`\n--- ${d.s.label} (${d.s.file}:${d.s.line}) ${d.s.title.slice(0, 80)}\n  alone fails: ${d.a.fail.join(' / ') || '-'}\n  full fails:  ${d.f.fail.join(' / ') || '-'}\n  alone exit ${d.code}; last lines:\n${d.tail}`);
  }
  console.log(`\n${diff.length} of ${picked.length} sections behave differently alone`);
  return diff.length ? 1 : 0;
}
