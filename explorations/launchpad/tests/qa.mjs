// tests/qa.mjs — test sections: QA. Not a module on its own: shards.mjs splices every file in tests/ (in the
// order of TEST_FILES) between test.mjs's prelude (the SIM as `api`, `check`) and its summary, and runs that as one module.
// Add a section at the end of your lane's file: "// <lane>-<n>. Title" at column 0, then a { block }. NOTES § "Test shards".

// qa-1. More tester cheats (QA session, QUEUE Q16): go to any day (forward runs the days, back moves only the calendar),
// set funds (which turns infinite money off), skip to a computing era, one mission at a time. Own SIM copy, like §37.
{
  const D = new Function(src + 'return {TEST,testGoto,testFunds,testEra,testMission,testTopUp,compEra,COMP_ERAS,YEAR_D,PROG,MISSIONS,missionOpen,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, T = D.TEST; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, lines: {}, flights: 1, own: null, decisions: [], active: [], offers: [], fac: {} });
  D.chooseStart('agency'); T.on = true;
  D.testGoto(250); const fwd = P.day; D.testGoto(40); const back = P.day; const bad = D.testGoto('x');
  check('tester: go to any day, forward and back; nonsense is refused', fwd === 250 && back === 40 && bad === false && P.day === 40, `→ ${fwd}, back → ${back}`);
  T.money = true; D.testTopUp(); D.testFunds(3); D.testTopUp();
  check('tester: set funds to an exact number, which turns infinite money off (so the program can go broke)', P.funds === 3 && T.money === false, `funds ${P.funds}, money ${T.money}`);
  D.testFunds(-20);
  check('tester: funds can be set below zero', P.funds === -20);
  const e0 = D.compEra(), ok1 = D.testEra(1), d1 = P.day, e1 = D.compEra(), ok2 = D.testEra(2), e2 = D.compEra();
  check('tester: skip to a computing era: the date runs on until it reaches the program, then stops', e0 === 0 && ok1 && e1 === 1 && ok2 && e2 === 2 && d1 > 0,
    `${D.COMP_ERAS[e1].name} on day ${d1.toFixed(0)}, ${D.COMP_ERAS[e2].name} on day ${P.day.toFixed(0)}`);
  const dEra = P.day; D.testGoto(dEra - 1); const e2b = D.compEra(); D.testGoto(dEra);
  check('tester: the era skip stops on the first day of the era (a day earlier is still the one before)', e2b === 1, `day ${dEra - 1}: era ${e2b}`);
  const bp = D.MISSIONS.find(m => m.id === 'beeper'), open0 = D.missionOpen(bp); D.testMission('weather', true); const open1 = D.missionOpen(bp), mark = P.done.weather;
  D.testMission('weather', false); const open2 = D.missionOpen(bp), none = D.testMission('nope', true);
  check('tester: one mission at a time: ticking "Above the weather" opens the beeper, unticking closes it; unknown ids refused',
    !open0 && open1 && mark && mark.test === true && !open2 && !P.done.weather && none === false);
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('tester menu: day, era, funds and mission controls are drawn, and disabled in flight', ['id="testDayIn"', 'data-test-era=', 'id="testFundsIn"', 'data-test-mis='].every(s => pg.includes(s)) && /data-test-mis="\$\{M\.id\}"[^`]*\$\{dis\}/.test(pg));
  Object.assign(T, { on: false, money: false, kh: false, tools: false, nofail: false, fast: false });
}

// qa-2. The tester's "go to body" view (QA session, QUEUE Q79): its catalogue holds every SYSTEM.md body with the
// radius and tilt SYSTEM.md gives, render() hands it the frame, and the tester menu and views.js reach it.
{
  const bv = readFileSync(new URL('./app/bodyview.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const CAT = new Function(bv.slice(bv.indexOf('const BODY_CAT='), bv.indexOf('];', bv.indexOf('const BODY_CAT=')) + 2) + 'return BODY_CAT')();
  const sys = readFileSync(new URL('./SYSTEM.md', import.meta.url), 'utf8'), num = s => +s.replace(/,/g, '');
  const want = {}; for (const m of sys.matchAll(/^### (\w+)[^\n]*\n- \*\*Physical:\*\* R ([\d,]+) km[^\n]*?(?:tilt (?:\*\*)?(\d+)°)?/gm)) want[m[1]] = {R: num(m[2]) * 1e3, tilt: m[3] != null ? +m[3] : null};
  for (const m of sys.matchAll(/\*\*(\w+)\*\* \([^)]*\): R ~?([\d,]+) km/g)) want[m[1]] = {R: num(m[2]) * 1e3, tilt: null};
  for (const m of sys.matchAll(/\*\*(Pavor|Metus)\*\* \(R ~(\d+) km\)/g)) want[m[1]] = {R: +m[2] * 1e3, tilt: null};
  const bad = Object.entries(want).filter(([k, w]) => { const c = CAT.find(b => b.name === k); return !c || Math.abs(c.R - w.R) > 1 || (w.tilt != null && c.tilt !== w.tilt); }).map(([k]) => k);
  check('go to body: every SYSTEM.md body is in the catalogue with its radius and tilt', Object.keys(want).length >= 11 && !bad.length && CAT.length === Object.keys(want).length,
    `${Object.keys(want).length} in SYSTEM.md (${Object.keys(want).join(', ')}), ${CAT.length} in the catalogue; mismatched: ${bad.join(', ') || 'none'}`);
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  check('go to body: render() hands over the frame first; the tester menu and refView(200 + 3·i + k) open it',
    /function render\(\)\{(?:spoolFrame\(\);)?\n\s*if\(self\.bodyViewDraw&&self\.bodyViewDraw\(\)\)return;/.test(pg) && /data-test-body=/.test(pg) && /bodyViewOpen\(d\.testBody/.test(pg) && /n >= 200 && typeof BODY_CAT/.test(vj) && /bodyViewClose\(\)/.test(vj));   // (Q432) spoolFrame (Q368) only books the frame's time
}

// qa-3. TESTING.md's row numbers (QA session, LESSONS #37): sessions number rows at once and collide (131, 133, 134 and
// 168 were each used twice). Every row number once, and "Next free number" above them all, so a collision fails here.
{
  const T = readFileSync(new URL('./TESTING.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const nums = [...T.matchAll(/^\| [✓~✗ ]*(\d+)(?: \(robot\))?(?: → P#\d+)? \|/gm)].map(m => +m[1]), seen = new Set(), dup = [...new Set(nums.filter(n => seen.has(n) || !seen.add(n)))];
  const next = +((T.match(/Next free number: \*\*(\d+)\*\*/) || [])[1] || 0);
  check('TESTING.md: every row number is used once, and "Next free number" is above them all', nums.length > 100 && !dup.length && next > Math.max(...nums),
    `${nums.length} rows, highest ${Math.max(...nums)}, next free ${next}; doubled: ${dup.join(', ') || 'none'} (renumber the newer row, fix its references)`);
}

// qa-4. Debris by hand (QA session, QUEUE Q161): the tester's breakup, ASAT test and clutter put fragments and dead stages
// where they say; below the air nothing happens. Own SIM copy.
{
  const D = new Function(src + 'return {TEST,testBreakup,testAsat,testClutter,fragBands,fragsOf,BAND_W,PROG,TELLUS,POWERS,HOOK,elements,satsUp};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG; Object.assign(P, { day: 0, frag: null }); delete P.sats; delete P.satN; D.TEST.on = true;   // a fresh program has neither
  const tot = () => D.fragBands().reduce((a, b) => a + b, 0), b400 = Math.floor((400e3 - D.TELLUS.atm) / D.BAND_W);
  const n1 = D.testBreakup(400, 1), t1 = tot(), peak = D.fragBands().indexOf(Math.max(...D.fragBands())), none = D.testBreakup(60, 1) + D.testAsat(50) + D.testClutter(10, 80);
  const n2 = D.testAsat(800), t2 = tot();
  check('tester debris: a 1 t breakup at 400 km adds NASA\'s 46,774 fragments, thickest in the 400 km band; an ASAT test names a foreign power; below the air nothing',
    Math.abs(n1 - D.fragsOf(1000)) < 1 && Math.abs(t1 - n1) < n1 * 0.02 && Math.abs(peak - b400) <= 1 && none === 0 && t2 > t1 && news.some(m => /tests an anti-satellite weapon at 800 km/.test(m)) && !news.some(m => /Tester: a 1 t breakup at 60/.test(m)),
    `${Math.round(n1)} fragments (in the bands ${Math.round(t1)}), peak band ${peak} (400 km is ${b400}); ASAT ${Math.round(n2)}; news: ${news.find(m => /anti-satellite/.test(m)) || 'none'}`);
  const k = D.testClutter(50, 800), J = P.sats.filter(q => q.junk), hs = J.map(q => { const el = D.elements(q.r, q.v, D.TELLUS.mu); return (el.a - D.TELLUS.R) / 1e3; });
  check('tester debris: clutter adds dead 2 t stages near the height, on many planes', k === 50 && J.length === 50 && J.every(q => q.mass === 2000) && Math.min(...hs) > 770 && Math.max(...hs) < 830 && new Set(J.map(q => Math.round(Math.acos(q.r[1] / Math.hypot(...q.r)) * 10))).size > 20,
    `${k} added, heights ${Math.min(...hs).toFixed(0)}–${Math.max(...hs).toFixed(0)} km`);
  D.TEST.on = false;
}

// qa-5. The tester's school picker (QA session, QUEUE Q106): Auto plus every school in SCHOOLS; the ones without a look
// yet are disabled, and a pick sets SCHOOL_FORCE and redraws the ship.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('tester: the school picker lists Auto and every school, and a pick sets SCHOOL_FORCE and rebuilds the ship',
    /data-test-school="\$\{k\}"/.test(pg) && /\['auto',\.\.\.Object\.keys\(SCHOOLS\)\]/.test(pg) && /if\(d\.testSchool\)\{SCHOOL_FORCE=[^}]*HOOK\.rebuild\(\)/.test(pg));
}
