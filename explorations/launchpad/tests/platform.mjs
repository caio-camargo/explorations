// tests/platform.mjs — test sections: platform. Not a module on its own: shards.mjs splices every file in tests/ (in the
// order of TEST_FILES) between test.mjs's prelude (the SIM as `api`, `check`) and its summary, and runs that as one module.
// Add a section at the end of your lane's file: "// <lane>-<n>. Title" at column 0, then a { block }. NOTES § "Test shards".

// platform-1. The file split (platform session): index.html's script is now classic scripts in sim/ and app/, loaded in
// order and sharing one global scope (NOTES § "The file split"). The tests read them as one text (page.mjs), so they
// can't see what a browser would: a function is hoisted only within its own file, so a top-level call into a later
// file breaks the page. Here each SIM file runs as its own script, in page order, the way the browser runs them. Also:
// every file in sim/ and app/ is on the page (a new file nobody loads is a silent no-op), and each one runs strict.
{
  const vm = await import('node:vm'), fs = await import('node:fs'), files = pageScripts();
  const read = f => fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8'), sim = files.filter(f => f.startsWith('sim/'));
  const ctx = vm.createContext({ console, performance }), bad = [];
  for (const f of sim) try { new vm.Script(read(f), { filename: f }).runInContext(ctx); } catch (e) { bad.push(`${f}: ${e.message}`); }
  check('split: each SIM file loads as its own script, in page order (no top-level call into a later file)',
    !bad.length && vm.runInContext('typeof physStep === "function" && typeof dispatchRun === "function" && PROG.funds > 0', ctx), bad.join('; ') || `${sim.length} files`);
  const disk = ['sim', 'app'].flatMap(d => fs.readdirSync(new URL('./' + d + '/', import.meta.url)).filter(x => x.endsWith('.js')).map(x => d + '/' + x));
  check('split: index.html loads every file in sim/ and app/, and each file it loads exists',
    disk.every(f => files.includes(f)) && files.every(f => disk.includes(f)), `${files.length} on the page; not loaded: ${disk.filter(f => !files.includes(f)).join(', ') || 'none'}`);
  const lax = files.filter(f => !/^(\/\/[^\n]*\n)*'use strict';/.test(read(f).replace(/\r\n/g, '\n')));
  check("split: every file starts 'use strict' (a classic script doesn't inherit it from the one before)", !lax.length, lax.join(', ') || 'all strict');
}

// platform-2. Save versions (QUEUE Q57): a save carries `ver`; the loader runs MIGRATE from the save's version up to
// SAVE_V. Fixtures: a version-0 save (no `ver`, no rel/op, a docked satellite, a broken day) comes up current and clean;
// a current save passes through unchanged; a save from a newer game is left alone and flagged; garbage loads as nothing;
// saving never lowers a newer save's version. When SAVE_V goes up, add the new step's fixture here.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const blk = pg.slice(pg.indexOf('const SAVE_V='), pg.indexOf('try{const j=migrateSave('));
  const { SAVE_V, MIGRATE, migrateSave } = new Function(blk + ';return {SAVE_V,MIGRATE,migrateSave}')();
  const v0 = migrateSave({ funds: 50, day: NaN, sats: [{ id: 1, docked: true }], done: { beeper: 1 } });
  const cur = { ver: SAVE_V, funds: 70, day: 12, rel: { 1: 0.2 }, op: {}, sats: [] }, curOut = migrateSave(JSON.parse(JSON.stringify(cur)));
  const fut = migrateSave({ ver: SAVE_V + 5, funds: 1, odd: 'x' });
  check('save versions: an old save comes up current and clean; a current one is unchanged; a newer one is left alone and flagged',
    MIGRATE.length === SAVE_V && v0.ver === SAVE_V && v0.day === 0 && !('docked' in v0.sats[0]) && v0.rel && v0.op && v0.done.beeper === 1 && v0.funds === 50
      && JSON.stringify(curOut) === JSON.stringify(cur) && fut.ver === SAVE_V + 5 && fut.newerSave === true && fut.odd === 'x'
      && migrateSave(null) === null && migrateSave('junk') === null && /PROG\.ver=Math\.max\(PROG\.ver\|0,SAVE_V\)/.test(pg),
    `SAVE_V ${SAVE_V}, ${MIGRATE.length} step(s)`);
}

// platform-3. No repeated numbers (QUEUE Q160): a `## v1.N` in NOTES, a TESTING or PLAYTEST row, a Q/W/D item in QUEUE.
// Two branches that each take the next number merge cleanly and leave it twice. `node check_numbers.mjs` also checks
// against origin/main (a number both sides added) and prints the next free ones; this half needs no git.
{
  const { repeats } = await import('./check_numbers.mjs'), bad = repeats();
  check('platform-3: no number is used twice in NOTES, TESTING, PLAYTEST or QUEUE (renumber yours: node check_numbers.mjs)', !bad.length,
    bad.map(b => `${b.file} ${b.key} on lines ${b.lines.join(', ')}`).join('; ') || 'none repeated');
}

// platform-4. The tester's verbose log (QUEUE Q265, PLAYTEST #65): logEv keeps nothing unless the tester has "Verbose log"
// on; on, a flown Sounding rocket leaves its staging, its touchdown speed against the limit, and its pay in LOG
// (app/testlog.js adds messages, news, saves, money and contracts in the page).
{
  const T = api.TEST, keep = { on: T.on, log: T.log }, P = api.PROG; api.LOG.length = 0;
  Object.assign(T, { on: true, log: false }); api.logEv('tester', 'off'); const offQuiet = api.LOG.length === 0;
  T.log = true; api.HOOK.news = () => {};
  Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: api.FUNDS0, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], kh: {}, log: {} });
  api.t = 0; const s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); let armed = false, n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  api.flightLeave(s);
  const kinds = new Set(api.LOG.map(e => e.kind)), td = api.LOG.find(e => e.kind === 'contact');
  check('platform-4: the verbose log is silent when off; on, a Sounding flight logs its staging, touchdown speed and pay',
    offQuiet && kinds.has('stage') && !!td && /at [0-9.]+ m\/s, limit [0-9.]+/.test(td.text) && kinds.has('pay') && api.LOG.every(e => e.t >= 0 && e.day >= 0),
    `off quiet ${offQuiet} · ${api.LOG.length} lines: ${api.LOG.slice(0, 6).map(e => e.kind + ' ' + e.text).join(' | ')}`);
  Object.assign(T, keep); api.LOG.length = 0;
}
