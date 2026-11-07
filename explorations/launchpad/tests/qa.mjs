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

// qa-6. Infinite fuel (QA + space, QUEUE Q542, PLAYTEST #148): with the tester's flag a full-throttle burn leaves every
// tank as it was and the craft keeps accelerating; off (or outside tester mode) the same burn drains them. Own SIM copy.
{
  const F = new Function(src + 'return {TEST,PROG,HOOK,PRESETS,newShip,placeCraft,physStep,set S(v){S=v},set t(v){simT=v},len};')();
  F.HOOK.msg = () => {}; F.HOOK.news = () => {}; F.HOOK.save = () => {}; F.HOOK.rebuild = () => {}; F.HOOK.debris = () => {};
  const burn = on => { F.TEST.on = on; F.TEST.fuel = on; F.t = 0; const s = F.newShip(F.PRESETS.Orbiter); F.placeCraft(s, { body: 'Tellus', alt: 300e3, T: 0 }); F.S = s;
    const f0 = s.parts.map(p => p.res.fuel || 0), v0 = F.len(s.v); s.throttle = 1; for (let i = 0; i < 1500; i++) F.physStep(s, 0.02);
    const f1 = s.parts.map(p => p.res.fuel || 0); return { same: f0.every((x, i) => x === f1[i]), used: f0.reduce((a, x, i) => a + x - f1[i], 0), dv: F.len(s.v) - v0 }; };
  const a = burn(true), b = burn(false); F.TEST.on = false; F.TEST.fuel = false;
  check('tester: infinite fuel keeps every tank full through a 30 s burn in orbit (the craft still speeds up); without it the same burn drains them',
    a.same && Math.abs(a.dv) > 50 && !b.same && b.used > 0.1,
    `on: tanks unchanged ${a.same}, |v| changed ${a.dv.toFixed(0)} m/s · off: ${(b.used * 1000).toFixed(0)} kg burnt, ${b.dv.toFixed(0)} m/s`);
}

// qa-7. Start in orbit (QA + space, QUEUE Q542, PLAYTEST #148): placeCraft puts the design, minus the stages its climb
// spent, on a circular orbit of the body asked for (altitude, inclination), beside a target (a Docking dummy a few km
// behind on its orbit), standing upright on Selene, or on a transfer that enters Selene's sphere within minutes. A tester
// flight earns nothing: its end puts the program back as it was, the dummy gone. Own SIM copy.
{
  const P = new Function(src + 'return {TEST,PROG,HOOK,PRESETS,BODIES,TELLUS,SELENE,newShip,placeCraft,placeSteps,placeAuto,placeNeed,physStep,advPhys,advRails,missionEnd,recNew,satAt,kepler,elements,qrot,norm,len,sub,dot,set S(v){S=v},set t(v){simT=v},get t(){return simT},set REV(v){REVERT0=v}};')();
  P.HOOK.msg = () => {}; P.HOOK.news = () => {}; P.HOOK.save = () => {}; P.HOOK.rebuild = () => {}; P.HOOK.debris = () => {}; P.TEST.on = true; P.t = 0;
  const D = Math.PI / 180, inc = (s) => { const e = P.elements(s.r, s.v, s.body.mu); return Math.acos(e.h[1] / e.hl) / D; };
  const orb = (s) => { const e = P.elements(s.r, s.v, s.body.mu); return { alt: (e.a - s.body.R) / 1e3, e: e.e, inc: Math.acos(e.h[1] / e.hl) / D }; };
  // (1) Tellus, 250 km at 51.6°: the Orbiter's first stage dropped (auto), the upper stage lit and full
  const s1 = P.newShip(P.PRESETS.Orbiter), n1 = s1.parts.filter(p => p.on).length, r1 = P.placeCraft(s1, { body: 'Tellus', alt: 250e3, inc: 51.6, T: 0 }), o1 = orb(s1);
  const ok1 = r1.ok && r1.drop === 1 && s1.body === P.TELLUS && Math.abs(o1.alt - 250) < 0.01 && o1.e < 1e-9 && Math.abs(o1.inc - 51.6) < 0.01 && !s1.landed
    && !s1.parts.some(p => p.on && p.d.key === 'kestrel') && s1.parts.filter(p => p.on && p.res.fuel > 0).every(p => Math.abs(p.res.fuel - (p.d.res0 ? p.d.res0.fuel : p.res.fuel)) < 1e-9);
  // (2) Selene, 40 km polar, the Lunar preset: its booster stage and the climb's upper stage dropped, the lander's stage kept
  const s2 = P.newShip(P.PRESETS.Lunar), st2 = P.placeSteps(s2.stack), r2 = P.placeCraft(s2, { body: 'Selene', alt: 40e3, inc: 90, T: 0 }), o2 = orb(s2);
  const s2b = P.newShip(P.PRESETS.Lunar), r2b = P.placeCraft(s2b, { body: 'Selene', alt: 40e3, inc: 90, drop: 2, T: 0 });
  const ok2 = r2.ok && s2.body === P.SELENE && Math.abs(o2.alt - 40) < 0.01 && Math.abs(o2.inc - 90) < 0.01 && r2.drop >= 1 && r2.drop < st2.length && r2b.ok && r2b.drop === 2
    && s2b.parts.filter(p => p.on).length < s2.parts.filter(p => p.on).length;
  // refused: under Tellus's air, outside Selene's sphere, landing on Tellus
  const bad = ['Tellus', 'Selene', 'Tellus'].map((b, i) => P.placeCraft(P.newShip(P.PRESETS.Orbiter), { body: b, alt: [80e3, 9000e3, 0][i], where: i === 2 ? 'landed' : 'orbit', T: 0 }));
  check('tester start: in orbit round Tellus (250 km, 51.6°) and Selene (40 km polar), the climb\'s stages dropped (auto, or as many as asked), full tanks; refused below the air, outside the sphere, landed on Tellus',
    ok1 && ok2 && bad.every(x => !x.ok),
    `Tellus ${o1.alt.toFixed(2)} km e ${o1.e.toExponential(1)} ${o1.inc.toFixed(2)}°, drop ${r1.drop} (${n1}→${s1.parts.filter(p => p.on).length} parts) · Selene ${o2.alt.toFixed(2)} km ${o2.inc.toFixed(2)}°, drop ${r2.drop} of ${st2.length} stages (asked 2: ${r2b.drop}) · refused: ${bad.map(x => x.why).join(' | ')}`);
  // (3) beside a fresh Docking dummy on a 300 km orbit, 3 km behind: in the register, the target, co-orbital (still ~3 km apart an hour on)
  const P0 = P.PROG, snap = JSON.stringify(P0), sats0 = (P0.sats || []).length, flights0 = P0.flights, funds0 = P0.funds;
  P.t = 0; const s3 = P.newShip(P.PRESETS.Orbiter); s3.rec = Object.assign(P.recNew(), { launched: true, day0: 0, tester: { where: 'beside' } }); P.REV = { R: s3.rec, prog: snap };
  const r3 = P.placeCraft(s3, { body: 'Tellus', where: 'beside', alt: 300e3, inc: 28, target: 'dummy', T: 0 }), q3 = (P0.sats || []).find(q => q.id === r3.target);
  const [tr, tv] = q3 ? P.satAt(q3, 0) : [[0, 0, 0], [0, 0, 0]], d0 = P.len(P.sub(tr, s3.r)), [ar] = P.kepler(s3.r, s3.v, 3600, s3.body.mu), [br] = P.kepler(tr, tv, 3600, s3.body.mu), d1 = P.len(P.sub(ar, br));
  const eS = P.elements(s3.r, s3.v, s3.body.mu), eT = P.elements(tr, tv, s3.body.mu);
  const ok3 = r3.ok && !!q3 && s3.target === q3.id && /Target dummy/.test(q3.name) && q3.shape.some(o => o.k === 'port') && (P0.sats || []).length === sats0 + 1
    && Math.abs(d0 - 3000) < 5 && Math.abs(d1 - 3000) < 20 && Math.abs(eS.a - eT.a) < 1 && P.dot(P.sub(tr, s3.r), s3.v) > 0;
  // its end: discarded whole (no flight counted, no pay, the dummy gone)
  P.S = s3; P.missionEnd(s3);
  const ok3b = (P0.sats || []).length === sats0 && P0.flights === flights0 && P0.funds === funds0 && s3.rec.ended;
  check('tester start beside a target: a Docking dummy registered on the orbit asked for, the craft 3 km behind it on the same orbit (still 3 km after an hour), targeted; the flight\'s end leaves the program as it was',
    ok3 && ok3b, `dummy ${q3 ? q3.name : 'none'}, ${d0.toFixed(0)} m behind, ${d1.toFixed(0)} m after an hour, Δa ${Math.abs(eS.a - eT.a).toFixed(2)} m · after the end: ${(P0.sats || []).length} objects (was ${sats0}), flights ${P0.flights}`);
  // (4) landed on Selene at 10°N 170°E, the lander stage: at rest upright, still standing 5 s on
  P.t = 0; const s4 = P.newShip(P.PRESETS.Lunar); s4.rec = Object.assign(P.recNew(), { launched: true, day0: 0, tester: {} });
  const r4 = P.placeCraft(s4, { body: 'Selene', where: 'landed', lat: 10, lon: 170, T: 0 }); P.S = s4;
  const up4 = () => P.dot(P.norm(P.qrot(s4.q, [0, 1, 0])), P.norm(s4.r)), u0 = up4(), lat4 = Math.asin(P.norm(s4.pf)[1]) / D;
  for (let i = 0; i < 250; i++) P.advPhys(s4);
  check('tester start landed on Selene: the lander stage stands upright at the spot asked for, at rest, and stays there',
    r4.ok && r4.drop >= 1 && s4.body === P.SELENE && s4.landed && s4.alive && !s4.tipped && u0 > 0.9999 && up4() > 0.9999 && Math.abs(lat4 - 10) < 0.01 && P.len(P.sub(s4.v, [0, 0, 0])) < 10,
    `drop ${r4.drop}, up·nose ${u0.toFixed(5)} → ${up4().toFixed(5)}, lat ${lat4.toFixed(2)}°, landed ${s4.landed}, alive ${s4.alive}`);
  // (5) entering Selene's sphere: on a transfer in Tellus's frame, inside Selene's sphere within minutes, a flyby periapsis near the 100 km asked
  P.t = 0; const s5 = P.newShip(P.PRESETS.Lunar); s5.rec = Object.assign(P.recNew(), { launched: true, day0: 0, tester: {} });
  const r5 = P.placeCraft(s5, { body: 'Selene', where: 'soi', alt: 100e3, T: 0 }); P.S = s5; const b0 = s5.body.name;
  let n = 0; while (s5.body !== P.SELENE && n++ < 120) P.advRails(s5, 10, 10);
  const pe5 = s5.body === P.SELENE ? (P.elements(s5.r, s5.v, P.SELENE.mu).pe - P.SELENE.R) / 1e3 : NaN;
  check('tester start entering Selene\'s sphere: it starts round Tellus and crosses into Selene\'s sphere within minutes, on a flyby near the periapsis asked for',
    r5.ok && b0 === 'Tellus' && s5.body === P.SELENE && P.t < 600 && Math.abs(pe5 - 100) < 30,
    `from ${b0}, in Selene's sphere after ${P.t.toFixed(0)} s, periapsis ${pe5.toFixed(1)} km (asked 100)`);
  P.TEST.on = false;
}
