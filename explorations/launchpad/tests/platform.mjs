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
  const ctx = vm.createContext({ console, performance, structuredClone }), bad = [];   // (the browser's globals the SIM uses at load)
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
  const blk = pg.slice(pg.indexOf('const SAVE_V='), pg.indexOf('// Loading (R10)'));
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
  Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: api.FUNDS0, bailouts: 0, offers: [], active: [], back: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], kh: {}, log: {} });
  api.t = 0; const s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); let armed = false, n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  api.flightLeave(s);
  const kinds = new Set(api.LOG.map(e => e.kind)), td = api.LOG.find(e => e.kind === 'contact');
  check('platform-4: the verbose log is silent when off; on, a Sounding flight logs its staging, touchdown speed and pay',
    offQuiet && kinds.has('stage') && !!td && /at [0-9.]+ m\/s, limit [0-9.]+/.test(td.text) && kinds.has('pay') && api.LOG.every(e => e.t >= 0 && e.day >= 0),
    `off quiet ${offQuiet} · ${api.LOG.length} lines: ${api.LOG.slice(0, 6).map(e => e.kind + ' ' + e.text).join(' | ')}`);
  Object.assign(T, keep); api.LOG.length = 0;
}

// platform-5. The session recorder (QUEUE Q275 = Q225 R1; NOTES § "Plan: record and replay"): a Sounding flight recorded in
// this SIM instance, serialised, then replayed in a fresh instance (the "across a reload" case) from the recording's
// starting save: the vessel's hash at both ends and the save after the flight settles must match exactly, and the
// save rebuilt from the start plus every diff must be the save the recorder ended on. Also: jdiff/jpatch round trips.
{
  const A = api, P = A.PROG, J = o => JSON.parse(JSON.stringify(o));
  const cases = [[{ a: 1, b: [1, 2], c: { d: 1 } }, { a: 2, b: [1, 3], e: null }], [[1, 2], [1, 2, 3]], [{ x: { y: [{ z: 1 }] } }, { x: { y: [{ z: 2, w: 'q' }] } }], [{ a: 1 }, 5]];
  const round = cases.every(([a, b]) => JSON.stringify(A.jpatch(J(a), A.jdiff(a, b))) === JSON.stringify(b));
  // the page loads a save, then recording starts: the same here, through recLoad
  A.recLoad({ prog: { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: api.FUNDS0, bailouts: 0, offers: [], active: [], back: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], kh: {}, log: {}, day: 3, wseed: 4242 } });
  A.HOOK.news = () => {}; A.t = 0; A.REC.clock = () => A.t * 1000;
  A.recStart({ 'launchpad-volume': '0.5' }, { built: 'test' }); A.recEv('screen', { s: 'flight' });
  const s = A.newShip(A.PRESETS.Sounding), T = A.tapeNew(A.PRESETS.Sounding, null); A.S = s; s.throttle = 1;
  A.recFlightStart(s, T); A.tapeStage(T, s); let armed = false, n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { A.tapeStage(T, s); armed = true; } A.tapePhys(T, s); }
  A.recFlightEnd(s, T); A.flightLeave(s); A.recProg(); A.recStop();
  const text = JSON.stringify(A.recFile()), file = JSON.parse(text), endProg = JSON.stringify(P);
  const fs = file.events.find(e => e.k === 'flightStart'), fe = file.events.find(e => e.k === 'flightEnd');
  const rebuilt = JSON.stringify(A.recProgAt(file, Infinity)) === endProg;
  // the fresh instance: its own PROG, simT, everything; only the file crosses over
  const B = new Function(src + 'return {PROG,recLoad,newShip,tapePlay,stateHash,flightLeave,HOOK,set S(v){S=v},set t(v){simT=v}};')();
  B.recLoad(file.start); B.HOOK.news = () => {}; B.t = fs.simT;
  const b = B.newShip(fe.tape.stack); B.S = b; const h0 = B.stateHash(b), pl = { tape: fe.tape, i: 0, n: 0 };
  while (B.tapePlay(pl, b, 5000));
  const h1 = B.stateHash(b); B.flightLeave(b); const sameProg = JSON.stringify(B.PROG) === endProg;
  check('platform-5: a recorded flight replays in a fresh SIM to the same vessel hash at both ends, and the same save after it settles; save diffs rebuild the save; jdiff/jpatch round trip',
    round && rebuilt && h0 === fs.hash && h1 === fe.hash && sameProg && b.landed,
    `round trips ${round} · rebuilt ${rebuilt} · start ${h0 === fs.hash} · end ${h1 === fe.hash} (${fe.tape.ops.length} ops) · save ${sameProg} · ${file.events.length} events, ${(text.length / 1024).toFixed(1)} KB`);
  A.REC.on = false;
}


// platform-6. One `PROG` schema (QUEUE R1a; notes/platform.md § "Plan: one PROG schema"): PROG_SCHEMA in sim/program.js
// lists every field with its default, what New program does with it and what it is. Static: every `PROG.x` in sim/,
// app/, builder.js and career.mjs (its `P.x`) is a row and every row is used; a `PROG.x||<literal>` (or `??`) read whose
// literal differs from the row's default fails (a null or absent default is exempt: the read is the guard). And the
// three lists that still exist on their own agree with it: PROG's starting literal, resetProgram's, and progFresh.
{
  const G = new Function(src + 'return {PROG_SCHEMA,progFresh,FUNDS0};')(), T = G.PROG_SCHEMA, rd = f => readFileSync(new URL('./' + f, import.meta.url), 'utf8');
  const code = [...pageScripts(), 'builder.js'].map(f => [f, rd(f)]), car = rd('career.mjs'), used = new Map(), add = (k, f) => used.set(k, (used.get(k) || new Set()).add(f));
  for (const [f, s] of code) for (const m of s.matchAll(/\bPROG\.([A-Za-z_$][\w$]*)/g)) add(m[1], f);
  for (const m of car.matchAll(/(?<![\w$.])P\.([A-Za-z_$][\w$]*)/g)) add(m[1], 'career.mjs');
  const missing = [...used.keys()].filter(k => !(k in T)), unused = Object.keys(T).filter(k => !used.has(k));
  const KEEP = ['career', 'library', 'pref', 'meta', 'transient'], badRow = Object.entries(T).filter(([, r]) => !(Array.isArray(r) && r.length === 3 && KEEP.includes(r[1]) && typeof r[2] === 'string' && r[2].length > 3));
  check('platform-6: every PROG field the code uses is a PROG_SCHEMA row, every row is used, and each row is [default, keep, why]',
    !missing.length && !unused.length && !badRow.length, `${used.size} fields used, ${Object.keys(T).length} rows; not in the table: ${missing.join(', ') || 'none'}; unused rows: ${unused.join(', ') || 'none'}; bad rows: ${badRow.map(r => r[0]).join(', ') || 'none'}`);
  const J = v => JSON.stringify(v), lit = { '{}': {}, '[]': [], 'null': null, 'false': false, 'true': true, "''": '' }, off = [];
  for (const [f, s] of code) for (const m of s.matchAll(/\bPROG\.([A-Za-z_$][\w$]*)\s*(?:\|\||\?\?)\s*(\{\}|\[\]|null|false|true|''|-?\d+(?:\.\d+)?(?![\w.]))/g)) {
    const r = T[m[1]]; if (!r || r[0] == null || typeof r[0] === 'function') continue;
    const v = m[2] in lit ? lit[m[2]] : Number(m[2]); if (J(v) !== J(r[0])) off.push(`${m[1]}||${m[2]} (${f}; the table: ${J(r[0])})`); }
  check('platform-6: a PROG.x||<literal> read uses the table\'s default (null and absent defaults exempt)', !off.length, off.join('; ') || 'all agree');
  // the starting literal: each value is the table's default (wseed is a seed: only its presence); resetProgram has no list of its own (R1b)
  const objOf = (s, re) => new Function('FUNDS0', 'freshSeed', 'return ' + s.match(re)[1])(G.FUNDS0, () => 7), diff = (o, name) => Object.entries(o).filter(([k, v]) => k !== 'wseed' && !(k in T && J(v) === J(T[k][0]))).map(([k, v]) => `${name}.${k}=${J(v)}`);
  const start = objOf(rd('sim/program.js'), /const PROG=(\{[^\n]*?\});/), F = G.progFresh(), ownList = !/function resetProgram\(\)\{programNew\(\);/.test(rd('app/editor.js')) || /Object\.assign\(P, \{ done:/.test(car);
  const bad = diff(start, 'start'), fresh = Object.keys(F).every(k => T[k][1] === 'career' && T[k][0] !== undefined) && F.funds === G.FUNDS0 && Number.isInteger(F.wseed) && F.done !== G.progFresh().done;
  const kept = G.progFresh({ designs: { saved: [1] }, lvl: 'hard', sats: [1], funds: 5 }), carry = J(kept.designs) === J({ saved: [1] }) && kept.lvl === 'hard' && J(kept.sats) === '[]' && kept.funds === G.FUNDS0;
  check('platform-6: PROG\'s starting literal agrees with the table; resetProgram and career.mjs keep no list of their own; progFresh builds the career fields fresh (no shared objects) and carries the library and the level over',
    !bad.length && !ownList && fresh && carry, `${bad.join(', ') || 'the start agrees'}; own lists ${ownList}; progFresh: ${Object.keys(F).length} fields, fresh ${fresh}, carries ${carry}`);
  // R1b: a program reset after 300 days of play is the same object as a new one in a fresh SIM (same seed), but for the
  // player's designs (launch history emptied) and the level. R17's repro: the sanction and the lost race are gone.
  const mk = () => { const X = new Function(src + 'return {PROG,programNew,advanceDays,sanction,sanctioned,raceLost,progLossy,HOOK,get home(){return HOME}};')(); X.HOOK.news = () => {}; X.HOOK.msg = () => {}; return X; };
  const A = mk(), B = mk(); A.programNew({ wseed: 5 }); A.advanceDays(300); A.sanction(1, 500, 'test'); Object.assign(A.PROG, { raceLost: { beeper: 2 }, home: 2, lvl: 'hard', designs: { saved: [{ name: 'x' }], launched: [{ n: 1 }] } }); A.PROG.sats.push({ id: 1 });
  const dirty = A.sanctioned(1) && A.raceLost('beeper') === 2 && A.PROG.day >= 300, played = A.progLossy(A.PROG);   // (R1c, below)
  A.programNew({ wseed: 5 }); B.programNew({ wseed: 5 });
  const lib = J(A.PROG.designs) === J({ saved: [{ name: 'x' }], launched: [] }) && A.PROG.lvl === 'hard', strip = P => { const o = { ...P }; delete o.designs; delete o.lvl; return J(o); };
  const same = strip(A.PROG) === strip(B.PROG), gone = !A.sanctioned(1) && A.raceLost('beeper') === null && A.home === 0 && A.PROG.sats.length === 0;
  const dk = Object.keys(A.PROG).filter(k => J(A.PROG[k]) !== J(B.PROG[k]) && k !== 'designs' && k !== 'lvl');
  check('platform-6: New program after 300 days of play equals a new program in a fresh SIM (same seed), the designs and level aside; the sanction, the lost race, the satellites and the home power are gone (R17)',
    dirty && same && gone && lib, `played ${dirty}; same ${same}${dk.length ? ` (differ: ${dk.join(', ')})` : ''}; R17 gone ${gone}; designs and level kept ${lib}`);
  // career.mjs: a row's numbers don't depend on the rows run before it
  const { execFileSync } = await import('node:child_process'), { fileURLToPath } = await import('node:url');
  const row = archs => execFileSync(process.execPath, [fileURLToPath(new URL('./career.mjs', import.meta.url)), '1', '1', 'base', 'agency'], { env: { ...process.env, ARCHS: archs }, encoding: 'utf8' }).trim().split('\n').pop();
  const alone = row('frugal'), after = row('resource,openSuper,frugal');
  check('platform-6: a career.mjs row gives the same numbers alone and after other rows (one reset, the game\'s)', alone === after && /^frugal/.test(alone), `${alone.replace(/\s+/g, ' ').slice(0, 90)}${alone === after ? '' : ` · after others: ${after.replace(/\s+/g, ' ').slice(0, 90)}`}`);
  // R1c: one serializer. No snapshot of PROG is taken any other way; progLossy finds what JSON would lose; 300 days of
  // play lose nothing; in tester mode the save says so once per value (R16's core bound as the example); a restore
  // drops what the snapshot lacked; a transient field is never written.
  const own = code.filter(([, s]) => /JSON\.stringify\(PROG\)|jclone\(PROG\)|JSON\.parse\(REVERT0/.test(s)).map(([f]) => f);
  const L = new Function(src + 'return {PROG,progLossy,progJSON,progRestore,TEST,HOOK,PROG_LOSSY};')();
  const planted = L.progLossy({ a: Infinity, b: NaN, c: () => 1, d: new Map(), e: [1, undefined], f: new Float32Array(2), g: { h: -Infinity }, ok: [null, 'x', { y: 0 }] });
  const plantedOK = planted.length === 7 && planted.includes('PROG.g.h=-Infinity') && planted.includes('PROG.e[1]: undefined') && !planted.some(p => p.includes('ok'));
  L.HOOK.news = () => {}; const said = []; L.HOOK.msg = m => said.push(m); L.TEST.on = true;
  L.PROG.sel = { core: { lo: 0, hi: Infinity, n: 1 } }; L.progJSON(); const text = L.progJSON(); L.TEST.on = false;
  const told = said.length === 1 && /PROG\.sel\.core\.hi=Infinity/.test(said[0]) && JSON.parse(text).sel.core.hi === null;
  L.PROG.funds = 7; L.PROG.newerSave = true; const snap = L.progJSON(); L.PROG.funds = 99; L.PROG.extra = 1; L.progRestore(snap);
  const back = L.PROG.funds === 7 && !('extra' in L.PROG) && !('newerSave' in L.PROG) && !/newerSave/.test(snap);
  check('platform-6: every PROG snapshot goes through progJSON/progRestore; progLossy finds Infinity, NaN, functions, Maps, typed arrays and holes; 300 days of play lose nothing; the tester hears of a lossy value once; a restore drops what the snapshot lacked',
    !own.length && plantedOK && !played.length && told && back,
    `own snapshots: ${own.join(', ') || 'none'}; planted ${planted.length}/7; after 300 days: ${played.join(', ') || 'nothing lost'}; tester told ${told} (${said.length}× "${(said[0] || '').slice(0, 60)}"); restore ${back}`);
}

// platform-7. A bad save must not brick the page (QUEUE R10; review 2026-11-09 § 2). The page's own loading and saving
// code (app/state.js, from SAVE_V to the `storage` listener) runs here against the SIM with a fake localStorage. The
// review's three saves (`home` 99, `done` null, `rel` null) and two more broken shapes each threw on every reload: now
// each loads, repaired, and plays a day. A save that still stops the game (a satellite that is a number) or isn't JSON is
// copied to the -bad key and a new program starts; with no room for the copy, the tab never saves over it. A failed save
// is said (quota), not swallowed; another tab's save makes this tab stop saving. A good played save loads unchanged and
// the load's probe day leaves no trace (30 more days from it match 30 from a plain restore).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const blk = pg.slice(pg.indexOf('const SAVE_V='), pg.indexOf('// dropped stages leave the simulation'));
  const boot = (raw, { full = false, key = 'launchpad-program-v1' } = {}) => {
    const store = new Map(raw == null ? [] : [[key, raw]]), said = [], news = [], heard = [];
    const localStorage = { getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => { if (full) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } store.set(k, String(v)); } };
    const X = new Function('localStorage', 'setTimeout', 'performance', 'addEventListener', 'console',
      src + `const PROG_KEY=${JSON.stringify(key)};\n` + blk + `;return {PROG,HOOK,advanceDays,progLoaded,get held(){return progHeld},PROG_BAD,get home(){return HOME}}`);
    const api2 = X(localStorage, f => f(), { now: () => 1e9 }, (ev, f) => heard.push([ev, f]), { error() {} });
    api2.HOOK.msg = m => said.push(m); api2.HOOK.news = (t, c) => news.push(c);
    return Object.assign(api2, { store, said, news, heard, key });   // (not a spread: it would freeze the `held` getter)
  };
  // the HOOKs are swapped in after boot, so boot's own words are caught by running the timers late: re-run with hooks set
  const bootSaid = (raw, o) => { const said = [], news = []; const hk = { msg: m => said.push(m), news: (t, c) => news.push(c) };
    let q = []; const B = (() => { const store = new Map(raw == null ? [] : [[(o && o.key) || 'launchpad-program-v1', raw]]);
      const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => { if (o && o.full) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } store.set(k, String(v)); } };
      const X = new Function('localStorage', 'setTimeout', 'performance', 'addEventListener', 'console',
        src + `const PROG_KEY='launchpad-program-v1';\n` + blk + `;return {PROG,HOOK,advanceDays,progLoaded,get held(){return progHeld},get home(){return HOME},POWERS}`);
      const r = X(localStorage, f => q.push(f), { now: () => 1e9 }, () => {}, { error() {} }); return { ...r, store }; })();
    B.HOOK.msg = hk.msg; B.HOOK.news = hk.news; q.forEach(f => f()); return { ...B, said, news }; };
  const J = v => JSON.stringify(v), plays = B => { try { B.advanceDays(3); return true; } catch (e) { return e.message; } };
  // (`rel` null is mended by the version-0 migration, so nothing is named; the others name their field)
  const repaired = [['{"ver":1,"home":99}', 1], ['{"done":null}', 1], ['{"rel":null}', 0], ['{"ver":1,"active":null,"offers":[]}', 1], ['{"ver":1,"funds":"lots"}', 1]].map(([raw, named]) => {
    const B = bootSaid(raw), ok = plays(B);
    return { raw, ok: B.progLoaded && ok === true && !B.store.has('launchpad-program-v1-bad') && B.said.some(m => /damaged/.test(m)) === !!named && B.home < B.POWERS.length, why: ok };
  });
  const rOK = repaired.every(r => r.ok);
  check('platform-7: the review\'s three bricking saves and two more broken shapes load, repaired and named, and play on',
    rOK, repaired.map(r => `${r.raw} ${r.ok ? 'ok' : `✗ (${r.why})`}`).join('; '));
  // (`offers` has a null default, so its kind isn't checked: the probe day catches it)
  const bad = ['{"ver":1,"sats":[5]}', '{"ver":1,"offers":5}', '{not json', '"a string"'].map(raw => {
    const B = bootSaid(raw), ok = plays(B), kept = B.store.get('launchpad-program-v1-bad') === raw;
    return { raw, ok: !B.progLoaded && kept && ok === true && B.said.some(m => /can't be loaded/.test(m)) && B.news.includes('bad') && B.PROG.day < 10, why: ok };
  });
  const full = bootSaid('{"ver":1,"sats":[5]}', { full: true }); full.HOOK.save(); const fullOK = full.held && full.store.get('launchpad-program-v1') === '{"ver":1,"sats":[5]}' && full.said.some(m => /no room/.test(m));
  check('platform-7: a save that stops the game or isn\'t a program is kept as -bad and a new program starts; with no room for the copy the tab never saves over it',
    bad.every(r => r.ok) && fullOK, `${bad.map(r => `${r.raw} ${r.ok ? 'kept' : `✗ (${r.why})`}`).join('; ')}; storage full: held ${fullOK}`);
  // saving: quota said once a minute at most; another tab's write stops this tab's saves
  const Q = boot(null, { full: true }); Q.HOOK.save(); Q.HOOK.save(); const quotaOK = Q.said.length === 1 && /storage is full/.test(Q.said[0]);
  const T = boot(null), lis = T.heard.find(([ev]) => ev === 'storage'); T.HOOK.save(); const first = T.store.get(T.key);
  lis[1]({ key: 'other' }); const still = !T.held; lis[1]({ key: T.key }); T.PROG.funds = 12345; T.HOOK.save();
  const tabsOK = !!first && still && T.held && T.store.get(T.key) === first && T.said.some(m => /another tab/.test(m));
  check('platform-7: a failed save is said (quota, once), and a save from another tab stops this tab from saving over it', quotaOK && tabsOK, `quota ${quotaOK} (${Q.said.length} said); two tabs ${tabsOK}`);
  // a good save: loads exactly, and the probe day leaves no trace
  const P = new Function(src + 'return {PROG,programNew,advanceDays,progJSON,progRestore,progDerive,progLoad,HOOK,PROG_REPAIRED:()=>PROG_REPAIRED};');
  const mkP = () => { const X = P(); X.HOOK.news = () => {}; X.HOOK.msg = () => {}; return X; };
  const A = mkP(); A.programNew({ wseed: 7 }); A.advanceDays(200); const save = A.progJSON();
  const srt = t => { const o = JSON.parse(t); return J(Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]))); };   // (field order differs: the load starts from PROG's literal)
  const R1 = mkP(); R1.progRestore(save); R1.progDerive(); const loadedPlain = srt(R1.progJSON()); R1.advanceDays(30); const plain = srt(R1.progJSON());
  const R2 = mkP(); const err = R2.progLoad(JSON.parse(save)); const loadedProbe = srt(R2.progJSON()), rep = R2.PROG_REPAIRED(); R2.advanceDays(30); const probed = srt(R2.progJSON());
  check('platform-7: a played save (200 days) loads with nothing repaired, as a plain restore would; 30 days on from it match',
    !err && !rep.length && loadedPlain === loadedProbe && plain === probed, `error ${err && err.message}; repaired ${rep.join(', ') || 'nothing'}; load same ${loadedPlain === loadedProbe}; 30 days same ${plain === probed}`);
}

// platform-8. The loader fills a save from the schema (QUEUE R1d; notes/platform.md § "Plan: one PROG schema", step 4): a
// sparse save (funds, and a field this game doesn't know) loads with every PROG_SCHEMA row that has a default present and
// of its default's kind, its own funds, world 12345 (a save from before `wseed` keeps the world it always loaded with),
// the unknown field kept and named in the tester's log; and a save that has a field keeps its value, not the default.
{
  const X = new Function(src + 'return {PROG,PROG_SCHEMA,progLoad,TEST,LOG,HOOK,unknown:()=>PROG_UNKNOWN};')(); X.HOOK.news = () => {}; X.HOOK.msg = () => {};
  X.TEST.on = true; X.TEST.log = true;
  const err = X.progLoad({ ver: 1, funds: 5, zzz: { a: 1 } });
  const kindOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  const missing = Object.entries(X.PROG_SCHEMA).filter(([k, [d, keep]]) => d !== undefined && keep !== 'meta' && keep !== 'transient'
    && (!(k in X.PROG) || (d !== null && typeof d !== 'function' && kindOf(X.PROG[k]) !== kindOf(d)))).map(([k]) => k);
  const logged = X.LOG.some(e => e.kind === 'save' && /zzz/.test(e.text));
  X.TEST.on = false; X.TEST.log = false;
  const ok1 = !err && !missing.length && X.PROG.funds === 5 && X.PROG.wseed === 12345 && X.PROG.zzz && X.PROG.zzz.a === 1 && X.unknown().join() === 'zzz' && logged;
  const Y = new Function(src + 'return {PROG,progLoad,HOOK};')(); Y.HOOK.news = () => {}; Y.HOOK.msg = () => {};
  const err2 = Y.progLoad({ ver: 1, done: { beeper: { flight: 1 } }, bailouts: 3, wseed: 99 });
  const ok2 = !err2 && Y.PROG.done.beeper && Y.PROG.bailouts === 3 && Y.PROG.wseed === 99;
  check('platform-8: a sparse save loads with every schema field filled (its default\'s kind), its own values kept, world 12345 without a wseed, an unknown field kept and named in the tester\'s log',
    ok1 && ok2, `error ${err && err.message}; missing or wrong kind: ${missing.join(', ') || 'none'}; funds ${X.PROG.funds}; wseed ${X.PROG.wseed}; unknown ${X.unknown().join()} logged ${logged}; own values kept ${ok2}`);
}

// platform-9. A frame that throws must not end the game (QUEUE R9; review 2026-11-09 § 2). Static: frame() (app/loop.js)
// is only a try/catch around frameBody that schedules the next frame whatever happened, and frameBody schedules none of
// its own; app/fault.js loads first of the app scripts. Run (app/fault.js against a stub document): an error, a script
// error and a rejected promise each reach the panel, with what broke, where and how often; Keep playing hides it until an
// error it hasn't shown; Export the old save appears only when R10 kept one. (The page itself, headless: a scratch run
// of review/2026-11-11/app/harness.cjs, notes/platform.md v1.312; R34 adopts that harness.)
{
  const { readFileSync } = await import('node:fs'), rd = f => readFileSync(new URL(f, import.meta.url), 'utf8');
  const loop = rd('./app/loop.js'), fault = rd('./app/fault.js'), idx = rd('./index.html');
  const body = loop.slice(loop.indexOf('function frameBody('), loop.indexOf('\n', loop.indexOf('function frameBody(')) + 1);
  const fbEnd = loop.indexOf('\nfunction ', loop.indexOf('function frameBody(') + 10), fb = loop.slice(loop.indexOf('function frameBody('), fbEnd < 0 ? undefined : fbEnd);
  const staticOK = /function frame\(now\)\{try\{frameBody\(now\)\}catch\(e\)\{gameFault\(e,'frame'\)\}requestAnimationFrame\(frame\)\}/.test(loop)
    && !/requestAnimationFrame/.test(fb) && body.length > 0
    && idx.indexOf('<script src="app/fault.js">') >= 0;
  const firstApp = /<script src="(app\/[\w-]+\.js)">/.exec(idx);
  const mk = store => { const els = [], win = {}; const el = () => ({ style: {}, dataset: {}, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; }, click() {}, remove() {} });
    const document = { body: { appendChild: e => els.push(e) }, createElement: el };
    const X = new Function('document', 'addEventListener', 'localStorage', 'console', 'URL', 'Blob', 'PROG', 'progJSON', 'location', 'logEv',
      fault + ';return {FAULT,gameFault,hasBadSave,setBad(k){globalThis.PROG_BAD=k}}');
    const r = X(document, (t, f) => { win[t] = f; }, { getItem: k => store[k] ?? null }, { error() {} }, {}, function () {}, { day: 3 }, () => '{}', {}, () => {});
    return { ...r, els, win }; };
  const A = mk({});
  const thrown = (() => { try { null.x; } catch (e) { return e; } })();
  A.gameFault(thrown, 'frame'); A.gameFault(thrown, 'frame'); A.win.error({ error: new Error('script') }); A.win.unhandledrejection({ reason: 'lost' });
  const p = A.FAULT.el, html = p.innerHTML;
  const shows = A.FAULT.n === 4 && A.els.length === 1 && /Something went wrong/.test(html) && /4×/.test(html) && /data-fault="reload"/.test(html) && /data-fault="save"/.test(html) && !/data-fault="bad"/.test(html);
  p.onclick({ target: { dataset: { fault: 'keep' } } }); const hid = p.style.display === 'none';
  A.gameFault(thrown, 'frame'); const stayed = p.style.display === 'none';
  A.gameFault(new Error('a new one'), 'frame'); const back = p.style.display === '' && /a new one/.test(p.innerHTML);
  globalThis.PROG_BAD = 'launchpad-program-v1-bad'; const B = mk({ 'launchpad-program-v1-bad': '{"x":1}' }); B.gameFault(new Error('e'), 'frame'); const badBtn = /data-fault="bad"/.test(B.FAULT.el.innerHTML); delete globalThis.PROG_BAD;
  check('platform-9: frame() catches and always schedules the next frame; app/fault.js loads first and shows a panel (what, where, how often; Reload, Export save) for a frame error, a script error and a lost promise; Keep playing hides it until a new error; the old save\'s button only when R10 kept one',
    staticOK && firstApp && firstApp[1] === 'app/fault.js' && shows && hid && stayed && back && badBtn,
    `static ${staticOK} (first app script ${firstApp && firstApp[1]}); shows ${shows} (${A.FAULT.n} faults); keep hides ${hid}, same error stays hidden ${stayed}, new one back ${back}; old-save button ${badBtn}`);
}

// platform-10. Export and import a save (QUEUE Q599, R9's follow-up; Settings › Saved program). The page's load/save block
// (app/state.js, as platform-7 runs it) with a fake localStorage: a played program's file imports into another tab's
// program, replaces the slot's save, keeps the replaced one as -before-import and stops the tab saving until the reload. A
// file that isn't JSON, isn't a program, or stops the game, and a full storage, leave the program and the store as they
// were. Static: Settings offers Export and Import (Import asks twice and waits for the end of a flight or drive) and the
// page tells what the import said after its reload.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const blk = pg.slice(pg.indexOf('const SAVE_V='), pg.indexOf('// dropped stages leave the simulation'));
  const KEY = 'launchpad-program-v1', PREV = KEY + '-before-import';
  const tab = (raw, { full = false } = {}) => {
    const store = new Map(raw == null ? [] : [[KEY, raw]]), q = [];
    const localStorage = { getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => { if (full) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } store.set(k, String(v)); } };
    const X = new Function('localStorage', 'setTimeout', 'performance', 'addEventListener', 'console',
      src + `const PROG_KEY=${JSON.stringify(KEY)};\n` + blk + `;return {get PROG(){return PROG},HOOK,advanceDays,importSave,progJSON,get held(){return progHeld},PROG_PREV}`);
    const T = X(localStorage, f => q.push(f), { now: () => 1e9 }, () => {}, { error() {} });
    T.HOOK.msg = () => {}; T.HOOK.news = () => {}; return Object.assign(T, { store });
  };
  // the file: a program played 40 days from a new one; the tab importing it has its own, 5 days in and saved
  const A = tab(null); A.advanceDays(40); const file = A.progJSON(), fileDay = A.PROG.day;
  const B = tab(null); B.advanceDays(5); B.HOOK.save(); const mine = B.progJSON(), mineStored = B.store.get(KEY);
  const r = B.importSave(file);
  const good = r.ok && r.day === fileDay && B.PROG.day === fileDay && B.store.get(KEY) === B.progJSON() && B.store.get(PREV) === mine
    && B.held && r.kept && !r.newer && r.rep.length === 0 && B.PROG_PREV === PREV;
  B.HOOK.save(); const noSave = B.store.get(KEY) === B.progJSON();   // (held: the save is the import's, whatever this tab does)
  // and the reload: the next tab opens on the imported program
  const C = tab(B.store.get(KEY)), reopened = C.PROG.day === fileDay && C.progJSON() === B.store.get(KEY);
  // files that must not land: the program and the store stay as they were
  const refuse = [['{not json', /not a saved program/], ['"a string"', /not a saved program/], ['[1,2]', /not a saved program/], ['{"funds":5}', /not a saved program/],
    ['{"ver":1,"day":3,"sats":[5]}', /stops the game/]].map(([raw, why]) => {
      const D = tab(mineStored), before = D.progJSON(), x = D.importSave(raw);
      return { raw, ok: !x.ok && why.test(x.why) && D.progJSON() === before && D.store.get(KEY) === mineStored && !D.store.has(PREV) && !D.held, why: x.why };
    });
  const F = tab(mineStored, { full: true }), fBefore = F.progJSON(), fx = F.importSave(file);
  const fullOK = !fx.ok && /storage is full/.test(fx.why) && F.progJSON() === fBefore && F.store.get(KEY) === mineStored && !F.held;
  // static: the Settings section, its two-click import, the flight wait, the told-after-reload
  const st = readFileSync(new URL('./app/settings.js', import.meta.url), 'utf8'), sc = readFileSync(new URL('./app/screens.js', import.meta.url), 'utf8');
  const staticOK = /data-save-act="export"/.test(st) && /data-save-act="import"/.test(st) && /if\(!impArm\)\{impArm=true/.test(st)
    && /impBlocked=\(\)=>mode==='flight'\|\|mode==='drive'/.test(st) && /sessionStorage\.setItem\('launchpad-import-said'/.test(st)
    && /sessionStorage\.getItem\('launchpad-import-said'\)/.test(st) && /saveHTML\(\)/.test(st) && /id==='settings'&&typeof impArm/.test(sc);
  check('platform-10: a save exported from one program imports into another (the slot replaced, the old one kept, no save over it before the reload); a file that isn\'t a program or stops the game, or a full storage, changes nothing (Q599)',
    good && noSave && reopened && refuse.every(x => x.ok) && fullOK && staticOK,
    `import ${good} (day ${r.day} of ${fileDay}; kept ${r.kept}); held ${noSave}; reopens ${reopened}; refused: ${refuse.map(x => `${x.raw} ${x.ok ? 'ok' : `✗ (${x.why})`}`).join('; ')}; storage full ${fullOK}; static ${staticOK}`);
}
