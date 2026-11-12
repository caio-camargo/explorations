// Copy audit (review 2 session, 2026-11-12; Caio: "review the copy... a lot of explanations can be tooltips").
// Loads the page headless, visits the screens, and lists the text of every panel: the runs of 8+ words that can stand
// on a screen, and the tooltips of 15+. The stub DOM cannot tell a shown panel from a hidden one, and misses text set
// through querySelector, so this is a list to read, not a count per screen. Run: node copy_words.cjs   (no GPU, no browser)
const H = require('../2026-11-11/app/harness.cjs').boot({ search: '', storage: {} });
const words = s => (s.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g) || []).length;
function walk(e, out, seen) {
  if (!e || typeof e !== 'object' || seen.has(e)) return; seen.add(e);
  let html = ''; try { html = String(e.innerHTML || ''); } catch { }
  for (const m of html.matchAll(/\btitle="([^"]*)"/g)) if (m[1]) out.tips.push(m[1]);
  for (const m of html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').matchAll(/>([^<]+)<|^([^<]+)|>([^<]+)$/g)) { const t = (m[1] || m[2] || m[3] || '').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim(); if (t) out.runs.push(t); }
  try { if (e.title) out.tips.push(String(e.title)); } catch { }
  let kids = []; try { kids = e.children || []; } catch { }
  for (const c of kids) walk(c, out, seen);
}
const SCREENS = [
  ['title', "go('title')"],
  ['design table', "ttlFound();go('assembly')"],
  ['design table (Orbiter)', "stackDef=JSON.parse(JSON.stringify(PRESETS.Orbiter));S=newShip(stackDef);BLD.init();editorChanged()"],
  ['rollout', "go('rollout')"],
  ['program', "go('program')"],
  ['flight (on the pad)', "go('assembly');document.getElementById('launch').click()"],
];
for (const [name, js] of SCREENS) { try { H.run(js); } catch (e) { console.log(name, 'ERR', e.message); } }
const out = { runs: [], tips: [] }, seen = new Set();
for (const id of [...H.els.keys()]) walk(H.getEl(id), out, seen);
const runs = [...new Set(out.runs)], tipsAll = [...new Set(out.tips)];
const long = runs.filter(r => words(r) >= 8).sort((a, b) => words(b) - words(a)), tips = tipsAll.filter(t => words(t) >= 15).sort((a, b) => words(b) - words(a));
console.log(`${runs.reduce((a, r) => a + words(r), 0)} words of text in ${runs.length} runs; ${long.length} runs of 8+ words hold ${long.reduce((a, r) => a + words(r), 0)}; ${tipsAll.length} tooltips, ${tips.length} of 15+ words`);
for (const r of long) console.log(`  [${words(r)}] ${r}`);
for (const t of tips) console.log(`  tip [${words(t)}] ${t}`);
if (H.errs.length) console.log('errs:', H.errs.slice(0, 3));
