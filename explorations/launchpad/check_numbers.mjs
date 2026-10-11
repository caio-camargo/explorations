// Duplicate-number check (QUEUE Q160, platform). Every lane numbers things in shared files: versions in NOTES (`## v1.N`),
// rows in TESTING and PLAYTEST, and Q/W/D items in QUEUE. Two branches that each take "the next number" merge without a
// conflict (different places in the file) and leave two v1.117s, or two Q228s with one's ✓ on the other.
//   node check_numbers.mjs                   repeats in this tree, plus collisions with origin/main, plus the next free numbers
//   node check_numbers.mjs --against <ref>   the same against another ref (`--against none`: this tree only)
// A collision is a number both sides added since their merge base with different text: run it after merging origin/main
// into your branch (it then sees the repeat) or before (it sees the collision). Exit 1 on either. test.mjs `platform-3`
// runs the in-tree half. The merge recipe: ACTIVE_WORK.md § Launchpad worktrees, NOTES § "Numbering".
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = new URL('./', import.meta.url);
const cells = l => l.split('|').map(c => c.trim());
// series: which file, how a numbered line looks, the key, the text that names it (so the same entry on both sides isn't a collision)
export const SERIES = [
  { name: 'NOTES versions', file: 'NOTES.md', re: /^#{2,6} (v1\.\d+(?:\.\d+)?)(?=[\s—]|$)(.*)$/, text: m => m[2].replace(/^\s*—\s*/, '') },
  { name: 'TESTING rows', file: 'TESTING.md', re: /^\| [✓~✗ ]*(\d+)(?: \(robot\))?(?: → P#\d+)? \|/,   // a played row: `✓ 12`, `~ 35 (robot)`, `✗ 12 → P#15` (qa-3's pattern)
    text: (m, l) => cells(l)[2] },
  { name: 'PLAYTEST rows', file: 'PLAYTEST.md', re: /^\| (\d+) \|/, text: (m, l) => cells(l)[3] },
  { name: 'QUEUE items', file: 'QUEUE.md', re: /^\| (?:~~)?([QWD]\d+[a-z]?)(?:~~)? \|/, text: (m, l) => cells(l)[2] },
];

// key → [{line, text}] for one file's text
export function scan(text, s) {
  const out = new Map();
  text.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    const m = l.match(s.re); if (!m) return;
    const t = (s.text(m, l) || '').replace(/~~|\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase();
    if (!out.has(m[1])) out.set(m[1], []);
    out.get(m[1]).push({ line: i + 1, text: t });
  });
  return out;
}

// the in-tree half: [{series, key, lines}] for every number used twice. `read(file)` → text (defaults to this folder)
export function repeats(read = f => readFileSync(new URL(f, DIR), 'utf8')) {
  const bad = [];
  for (const s of SERIES) for (const [key, at] of scan(read(s.file), s)) if (at.length > 1) bad.push({ series: s.name, file: s.file, key, lines: at.map(a => a.line) });
  return bad;
}

const sortKey = k => k.match(/\d+/g).map(Number);
// the next free number per series (and per letter in QUEUE), over every map given
export function nextFree(maps) {
  const out = [];
  SERIES.forEach((s, i) => {
    const keys = maps.flatMap(m => [...m[i].keys()]);
    if (s.file === 'NOTES.md') out.push('v1.' + (Math.max(0, ...keys.map(k => sortKey(k)[1])) + 1));
    else if (s.file === 'QUEUE.md') for (const L of 'QWD') out.push(L + (Math.max(0, ...keys.filter(k => k[0] === L).map(k => sortKey(k)[0])) + 1));
    else out.push(`${s.file.replace('.md', '')} ${s.file === 'PLAYTEST.md' ? '#' : ''}${Math.max(0, ...keys.map(Number)) + 1}`);
  });
  return out;
}

const git = (...a) => execFileSync('git', a, { cwd: fileURLToPath(DIR), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 });
const atRef = (ref, f) => { try { return git('show', `${ref}:./${f}`); } catch { return ''; } };

export function main(argv) {
  const i = argv.indexOf('--against'), ref = i >= 0 ? argv[i + 1] : 'origin/main';
  const here = SERIES.map(s => scan(readFileSync(new URL(s.file, DIR), 'utf8'), s)), maps = [here];
  let fails = 0;
  for (const r of repeats()) { fails++; console.log(`REPEAT  ${r.file}: ${r.key} on lines ${r.lines.join(', ')}`); }
  let against = 'no ref';
  if (ref && ref !== 'none') {
    let base = '';
    try { git('rev-parse', '--verify', '--quiet', ref); base = git('merge-base', 'HEAD', ref).trim(); } catch {}
    if (!base) against = `${ref} not found (fetch it, or --against none)`;
    else {
      const theirs = SERIES.map(s => scan(atRef(ref, s.file), s)), was = SERIES.map(s => scan(atRef(base, s.file), s));
      maps.push(theirs); against = `${ref} (merge base ${base.slice(0, 7)})`;
      SERIES.forEach((s, j) => {
        for (const [key, mine] of here[j]) {
          const other = theirs[j].get(key);
          if (!other || was[j].has(key)) continue;
          const texts = new Set(mine.map(a => a.text)), clash = other.filter(a => !texts.has(a.text));
          if (clash.length) { fails++; console.log(`COLLIDES  ${s.file}: ${key} is "${mine[0].text}" here (line ${mine[0].line}) and "${clash[0].text}" on ${ref} (line ${clash[0].line}); both added since ${base.slice(0, 7)}`); }
        }
      });
    }
  }
  const counts = SERIES.map((s, j) => `${here[j].size} ${s.name}`).join(', ');
  console.log(`${fails ? 'FAIL' : 'ok'}: ${counts}; checked against ${against}`);
  console.log(`next free: ${nextFree(maps).join(' · ')}`);
  return fails ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
