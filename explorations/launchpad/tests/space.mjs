// tests/space.mjs — test sections: space (and bodies). Not a module on its own: shards.mjs splices every file in tests/ (in the
// order of TEST_FILES) between test.mjs's prelude (the SIM as `api`, `check`) and its summary, and runs that as one module.
// Add a section at the end of your lane's file: "// <lane>-<n>. Title" at column 0, then a { block }. NOTES § "Test shards".

// bodies-1. The Selene and Nyx ladders, flown from the pad by procedures on the Probe and Sample Return presets (bodies
// session; the flights are fly_ladder.mjs). Only each mission's prerequisites are done; the mission's own check decides.
// The executor's options get exercised: the far side lit on arrival, near-side impact and landing, a retrograde capture at
// Nyx (and the same orbit prograde, which Tellus's tide should wreck), and a sample brought home.
{
  const P = api.PROG, saved = JSON.stringify(P), rows = flyLadder(api), row = id => rows.find(r => r.id === id) || {};
  const fmt = r => `${r.at}, ${r.days} days, ${r.dv} m/s in all, ${r.left} m/s left${r.touch ? `, touchdown ${r.touch} m/s` : ''}; ${r.cost}M`;
  for (const [id, what] of [['farside', 'the sunlit far side photographed and the pictures sent home'], ['selimp', 'an impactor heard to the end on the near side'],
    ['selland', 'a soft landing on the near side'], ['selsample', 'a Selene sample landed back on Tellus'], ['nyxfind', 'Nyx weighed by tracking residuals'],
    ['nyxfly', 'a Nyx flyby with camera and antenna'], ['nyxorb', 'a retrograde orbit round Nyx that lasts two Nyx orbits'], ['nyxland', 'a soft landing on Nyx']])
    check(`mission ladders: ${id} flown from the pad by procedure (${row(id).preset}): ${what}`, row(id).ok === true, fmt(row(id)));
  const pro = row('nyxorb:pro');
  check('mission ladders: the same Nyx orbit flown prograde does not last (Tellus\'s tide wrecks it: which way round matters)', pro.ok === false && pro.days < 4.3, fmt(pro));
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// bodies-2. Procedures flown headless, for dispatch (bodies session): procFly flies a stored procedure in isolation (the
// flight on screen, the fleet, the clock and the hooks put back as they were); a procedure that can't make its goal stops
// with a deviation and a registry entry of the craft where it stopped; dispatchRun flies dispatched contracts for real.
{
  const P = api.PROG, saved = JSON.stringify(P), st = api.PRESETS.Orbiter, key = api.procKey(st);
  api.HOOK.news = () => {}; api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  P.procs = {}; handAscent(api, st); const proc = P.procs[key];
  // isolation: a "flight in progress" (S, its clock, a fleet vessel, the hooks) is exactly as it was afterwards
  const S0 = api.newShip(['pod']), mark = () => {}; api.S = S0; api.t = 1234.5; api.FLEET.push(S0); api.HOOK.msg = mark; const T00 = api.ORB_T0;
  let f = api.procFly(st, proc, { pe: 180e3, ap: 180e3 });
  check('dispatch flights: a procedure flown headless reaches the asked orbit, and the flight in progress is untouched (S, clock, fleet, hooks)',
    f.ok && Math.abs(f.orb.ap - 180e3) < 15e3 && f.orb.pe > 150e3 && api.S === S0 && api.t === 1234.5 && api.FLEET.length === 1 && api.FLEET[0] === S0 && api.HOOK.msg === mark && api.ORB_T0 === T00 && P.procs[key] === proc,
    f.ok ? `${(f.orb.pe / 1e3).toFixed(0)}×${(f.orb.ap / 1e3).toFixed(0)} km, ${f.dv.toFixed(0)} m/s, ${(f.t / 60).toFixed(0)} min of flight` : JSON.stringify(f.dev || f.why));
  api.FLEET.length = 0; api.HOOK.msg = () => {};
  // short of propellant: the ballast variant (as in §28) deviates, and its entry rebuilds the craft where it stopped
  f = api.procFly(['chute', 'pod', 'ballast', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], proc);
  const vS = f.entry && api.vesselOf(f.entry, f.entry.epoch);
  check('dispatch flights: a design that can\'t make it deviates ("short") and hands over a registry entry that rebuilds the craft where it stopped',
    !f.ok && f.dev && f.dev.kind === 'short' && vS && vS.alive && len(sub(vS.r, f.s.r)) < 1 && Math.abs(api.dvRemaining(vS).tot - api.dvRemaining(f.s).tot) < 1,
    f.dev ? `${f.dev.kind}: ${f.dev.why} (${(f.t / 60).toFixed(1)} min in, ${((len(f.s.r) - TELLUS.R) / 1e3).toFixed(0)} km up)` : JSON.stringify(f.why));
  // the upper stage won't relight: handed over coasting up to apoapsis, with what circularising needs still aboard
  f = api.procFly(st, proc, null, { noRelight: true }); const el = elements(f.s.r, f.s.v, TELLUS.mu), need = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a));
  check('dispatch flights: a relight failure hands the craft over near apoapsis, periapsis in the air, the circularisation still possible by hand',
    f.dev && f.dev.kind === 'relight' && el.pe - TELLUS.R < ATM && api.dvRemaining(f.s).tot > need,
    f.dev ? `${((len(f.s.r) - TELLUS.R) / 1e3).toFixed(0)} km up, periapsis ${((el.pe - TELLUS.R) / 1e3).toFixed(0)} km; needs ${need.toFixed(0)} m/s, has ${api.dvRemaining(f.s).tot.toFixed(0)}` : 'no deviation');
  // dry runs: a new design borrows a stored procedure, provisionally, if a headless run gets it to orbit; its own first flight replaces it
  P.procs = { [key]: proc }; const heavy = ['chute', 'pod', 't1', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], hk = api.procKey(heavy);   // a tonne more on the upper stage
  const ad = api.procAdopt(heavy), weak = api.procAdopt(['chute', 'pod', 'ballast', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel']), one = api.procAdopt(['sci', 't8', 'kestrel']);
  const hot = api.procAdopt(['chute', 'pod', 't4', 'petrel', 'dec', 't8', 'fins', 'kestrel']);   // two tonnes more: Δv to spare on paper, but slower off the pad
  check('dry runs: a heavier variant borrows the Orbiter\'s procedure provisionally (measured on itself); one that can\'t make orbit, or stages differently, does not',
    ad.ok && P.procs[hk] && P.procs[hk].prov && P.procs[hk].from === 'Orbiter' && ad.margin > 0 && !weak.ok && !one.ok && one.tried.every(t => t.why === 'different staging'),
    `heavy: ${ad.ok ? `${ad.proc.dv.toFixed(0)} m/s to orbit, ${ad.margin.toFixed(0)} m/s to spare` : ad.why} · ballast: ${weak.why} (${(weak.tried || []).map(t => t.why).join('; ')}) · single stage: ${one.why}`);
  check('dry runs: a variant with Δv to spare on paper is still refused when the borrowed climb fails it (two tonnes more, lower thrust-to-weight: it falls back before cut-off)',
    !hot.ok && hot.tried.some(t => /falling back/.test(t.why)), `${hot.why}: ${(hot.tried || []).map(t => t.why).join('; ')}`);
  const provDv = P.procs[hk] ? P.procs[hk].dv : NaN; handAscent(api, heavy);
  check('dry runs: the design\'s own first flight replaces the borrowed procedure (records only improve, but a borrowed one always gives way)', P.procs[hk] && !P.procs[hk].prov, `borrowed ${provDv.toFixed(0)} m/s → own ${P.procs[hk] ? P.procs[hk].dv.toFixed(0) : '?'} m/s`);
  // the corridor (Q12): a climb that has already failed is handed over early, alive. Injected faults: an 8 s tumble at
  // 40 km (a stuck gimbal, say), and a recording that claims a much faster climb than this one can fly
  const flyWith = (pr, fault) => { api.t = 0; const s = api.newShip(st); api.S = s; s.noRec = true; api.procStart(s, pr); let k = 0;
    while (s.alive && s.proc && !s.proc.done && k++ < 200000) { if (fault) fault(s); api.advPhys(s); } return s; };
  let tSpin = null; const spun = flyWith(proc, s => { const h = len(s.r) - TELLUS.R; if (h > 40e3 && tSpin == null) tSpin = api.t; if (tSpin != null && api.t < tSpin + 8) s.w = [0.8, 0, 0]; });
  let tB = null; const brief = flyWith(proc, s => { const h = len(s.r) - TELLUS.R; if (h > 40e3 && tB == null) tB = api.t; if (tB != null && api.t < tB + 2) s.w = [0.8, 0, 0]; });
  const fast = flyWith({ ...proc, vel: proc.vel.map(([h, v]) => [h, v * 1.6]) });
  check('corridor: the climb is handed over early and alive when control is lost (the nose 20° off for 5 s; a 2 s tumble the SAS recovers from is not enough) or it falls far behind its recorded speed',
    spun.procDev && spun.procDev.kind === 'control' && spun.alive && !brief.procDev && brief.proc && brief.proc.done && fast.procDev && fast.procDev.kind === 'slow' && fast.alive && proc.vel.length > 10,
    `spun: ${spun.procDev ? spun.procDev.why : 'no deviation'} (${((len(spun.r) - TELLUS.R) / 1e3).toFixed(0)} km) · 2 s tumble: ${brief.procDev ? brief.procDev.why : brief.proc && brief.proc.done ? 'recovered, in orbit' : 'not done'} · fast recording: ${fast.procDev ? fast.procDev.why : 'no deviation'}`);
  // a dispatched contract, flown: the orbit is the procedure's, not a roll; the same seed gives the same flight
  const sst = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'];   // a satellite (the economy's §38 design): its own ascent, flown by hand once
  P.procs = {}; handAscent(api, sst); const sproc = P.procs[api.procKey(sst)];
  api.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, done: { beeper: { flight: 0, day: 0 } }, kh: {}, lines: {}, flights: 3, own: null, decisions: [], active: [], offers: [], fac: {}, studies: {}, studyQ: [], dispatch: [], procs: { [api.procKey(sst)]: sproc }, staged: {} });
  api.chooseStart('agency'); P.funds = 2000; P.day = 10; for (const p of api.newShip(sst).parts) { P.kh[p.d.key] = { use: 0.97, reg: {} }; P.cert[p.d.key] = 1; }
  const c = { id: 921, type: 'sat', src: 'com', client: 0, p: { alt: 160, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 }; P.active = [c];
  const before = JSON.stringify(P), fly = () => { api.orderDispatch(c, sst); const L = P.dispatch[0].launch; let n = 0; while (P.day < L + 1 && n++ < 30) { P.decisions = []; api.advanceTo(L + 1); } return P.dispatch[0]; };
  const D1 = fly(), o1 = D1.orb && { ...D1.orb }, paid = !P.active.includes(c), kept = (P.sats || []).filter(q => !q.junk).length; Object.assign(P, JSON.parse(before)); P.sats = JSON.parse(before).sats || []; P.active = [c]; const D2 = fly();   // the same world: the first payload (now registered, Q49) isn't up for the second
  check('dispatch flights: a dispatched contract is flown by its procedure to the contract\'s orbit and paid; the same seed flies the same flight',
    D1.status === 'done' && o1 && Math.abs((o1.pe + o1.ap) / 2 - 160e3) < 20e3 && paid && kept === 1 && D2.status === 'done' && D2.orb && Math.abs(D2.orb.pe - o1.pe) < 1 && Math.abs(D2.orb.ap - o1.ap) < 1,
    o1 ? `${D1.status}: ${(o1.pe / 1e3).toFixed(1)}×${(o1.ap / 1e3).toFixed(1)} km (contract 160 ± 20), paid ${paid}, payload registered ${kept}; again: ${D2.status} ${D2.orb ? (D2.orb.pe / 1e3).toFixed(1) + '×' + (D2.orb.ap / 1e3).toFixed(1) : ''}` : `${D1.status} ${D1.why || ''}`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// bodies-3. Landing on a chosen point (QUEUE Q13): the transfer aims the orbit's plane through the site, the capture is low,
// the descent steers to the velocity that would stop it there. Mid-latitude, near the pole, the far side, and on Nyx.
{
  const P = api.PROG, saved = JSON.stringify(P);
  for (const [preset, body, lat, lon, what] of [['Probe', 'Selene', 20, 15, 'Selene, 20°N 15°E of the point under Tellus'], ['Probe', 'Selene', 85, 0, 'Selene, near the pole (a polar orbit)'],
    ['Probe', 'Selene', -10, 170, 'the far side of Selene'], ['Probe', 'Nyx', 30, 20, 'Nyx (inclined, eccentric, its tide strong)']]) {
    const r = flySite(api, preset, body, lat, lon);
    check(`targeted landing: ${what}, within 100 m (a base takes in what lands within 500 m)`, r.landed && r.alive && r.miss < 100 && r.touch < 3,
      r.landed ? `${r.miss.toFixed(0)} m off at ${r.touch.toFixed(1)} m/s, ${r.left.toFixed(0)} m/s left, ${r.days.toFixed(2)} days` : `not landed: ${r.dev ? r.dev.why : r.alive ? 'still flying' : 'lost'}`); }
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// space-1. Station-keeping as a fuel lifetime (space session, QUEUE Q50, ROADMAP W2): a satellite holds its orbit by
// spending its own propellant against the moons' tides, at a rate measured once for its orbit (study_slot.mjs); dry, the
// tide steps it between flights and it drifts off its slot. Low orbits feel no tide in the game (pertNear) and cost nothing.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,satAt,kepler,elements,slotRate,slotTilt,skDv,skLife,isTV,capital,rotY,absTh,TELLUS,SELENE,PROG,HOOK,DAY_S,STAT_R,YEAR_D};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, G0 = 9.80665; P.sats = []; P.day = 0;
  // a Probe left in a circular orbit of radius a, inclination inc; then its tanks set to hold dv m/s (null: as launched)
  const reg = (a, inc, dv = null) => { const s = D.newShip(D.PRESETS.Probe), vc = Math.sqrt(T.mu / a), c = Math.cos(inc * Math.PI / 180), si = Math.sin(inc * Math.PI / 180);
    Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, vc * si, -vc * c] }); D.satRegister(s, { day0: 0 }); const q = P.sats.at(-1);
    if (dv != null) { let tk = null; for (const o of q.shape) if (o.res) for (const k of ['fuel', 'gas']) if (o.res[k] > 0) { q.mass -= o.res[k] * 1000; o.res[k] = 0; if (k === 'fuel') tk = o; }
      const m0 = q.mass; let lo = 0, hi = m0 * 0.9;   // the fuel that gives dv, by bisection on skDv
      if (dv > 0) for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; tk.res.fuel = mid; q.mass = m0 + mid * 1000; if (D.skDv(q) < dv) lo = mid; else hi = mid; } }
    return q; };
  const R = T.R, low = reg(R + 300e3, 0), nav = reg(R + 3000e3, 60), stat = reg(D.STAT_R, 0), k = q => D.slotRate(q);
  check('station-keeping: holding an orbit’s size and shape costs what the tides pull, nothing in low orbit, ~0.02–0.06 m/s a day at 3,000 km, ~0.05–0.3 stationary; the tilt is let go (re-tuned for MIDGAME § Satellites; study_slot.mjs)',
    k(low) === 0 && k(nav) > 0.02 && k(nav) < 0.06 && k(stat) > 0.05 && k(stat) < 0.3 && D.slotTilt(stat) > 3e-5 && D.slotTilt(low) < 3e-5,
    `low ${k(low)}, nav ${k(nav).toFixed(3)}, stationary ${k(stat).toFixed(3)} m/s a day; stationary tilt ${(D.slotTilt(stat) * 400 * 180 / Math.PI).toFixed(2)}° a year`);
  // a stationary satellite with tanks for 100 m/s holds its rails for ~250 days; one with 4 days' worth goes adrift on day 4
  P.sats = []; news.length = 0; const held = reg(D.STAT_R, 0, 100), short = reg(D.STAT_R, 0, 4 * k(held)), none = reg(D.STAT_R, 0, 0);
  const r0 = D.satAt(held, 30 * D.DAY_S)[0], ep0 = held.epoch, m0 = held.mass, life0 = D.skLife(held);
  D.advanceDays(30);
  const spent = 100 - D.skDv(held), off = q => len(sub(D.satAt(q, 30 * D.DAY_S)[0], D.kepler([D.STAT_R, 0, 0], [0, 0, -Math.sqrt(T.mu / D.STAT_R)], 30 * D.DAY_S, T.mu)[0]));
  const el0 = D.elements([D.STAT_R, 0, 0], [0, 0, -Math.sqrt(T.mu / D.STAT_R)], T.mu), el1 = D.elements(held.r, held.v, T.mu), tilt = Math.acos(Math.min(1, el1.h[1] / el1.hl));
  check('station-keeping: with propellant it holds its orbit’s size and shape, its tilt wanders a little, and it pays the rate from its own tanks (mass and Δv drop)',
    Math.abs(el1.a - el0.a) < 1 && Math.abs(el1.e - el0.e) < 1e-6 && tilt > 0 && tilt < 0.01 && Math.abs(spent - 30 * k(held)) < 0.01 * spent && held.mass < m0 && held.adrift == null && Math.abs(D.skLife(held) - (life0 - 30)) < 0.5,
    `spent ${spent.toFixed(2)} m/s in 30 days (rate ${(30 * k(held)).toFixed(2)}); tilt ${(tilt * 180 / Math.PI).toFixed(3)}°; life ${life0.toFixed(0)} → ${D.skLife(held).toFixed(0)} days; ${(m0 - held.mass).toFixed(1)} kg lighter`);
  check('station-keeping: dry, it drifts off its slot under the tide (news once, only for one that had propellant), and nothing is lost',
    Math.abs(short.adrift - 4) < 0.05 && none.adrift === 0 && off(short) > 100e3 && off(none) > 100e3 && off(held) < 50e3 && P.sats.length === 3 &&
    news.filter(m => /last of its propellant/.test(m)).length === 1 && news.some(m => m.startsWith(short.name)),
    `adrift on day ${short.adrift?.toFixed(2)} and ${none.adrift}; off the slot after 30 days: ${(off(short) / 1e3).toFixed(0)} km and ${(off(none) / 1e3).toFixed(0)} km (held, its tilt only: ${(off(held) / 1e3).toFixed(1)} km)`);
  // around a moon too: the 2,000 km polar Selene orbit that Tellus's tide pulls into the ground in ~41 days (test 40) holds with propellant
  P.sats = []; news.length = 0; const B = D.SELENE, s = D.newShip(D.PRESETS.Probe), vs = Math.sqrt(B.mu / (B.R + 2000e3));
  Object.assign(s, { alive: true, landed: false, body: B, r: [B.R + 2000e3, 0, 0], v: [0, vs, 0] }); D.satRegister(s, { day0: P.day }); const sq = P.sats.at(-1), sel0 = D.elements(sq.r, sq.v, B.mu), dv0 = D.skDv(sq);
  D.advanceDays(45);
  check('station-keeping: around Selene, a polar orbit the tide would pull into the ground holds while its tanks last',
    P.sats.includes(sq) && Math.abs(D.elements(sq.r, sq.v, B.mu).a - sel0.a) < 1 && Math.abs(D.elements(sq.r, sq.v, B.mu).e - sel0.e) < 1e-6 && sq.adrift == null && D.skDv(sq) < dv0 && !news.some(m => /came down/.test(m)),
    `${D.slotRate(sq).toFixed(2)} m/s a day; ${(dv0 - D.skDv(sq)).toFixed(0)} of ${dv0.toFixed(0)} m/s spent in 45 days`);
  // a TV satellite over the capital, held: two years on its tilt is past the old 3° limit and the capital still sees it all day
  P.sats = []; P.day = 0; const c = D.capital(), u = D.rotY(c.u, D.absTh(0)), lon = Math.atan2(u[2], u[0]), aS = D.STAT_R, vS = Math.sqrt(T.mu / aS), tvs = D.newShip(D.PRESETS.Probe);
  Object.assign(tvs, { alive: true, landed: false, body: T, r: [aS * Math.cos(lon), 0, aS * Math.sin(lon)], v: [vS * Math.sin(lon), 0, -vS * Math.cos(lon)] }); D.satRegister(tvs, { day0: 0 }); const tq = P.sats.at(-1);
  let tvDays = 0; const tv0 = D.isTV(tq, 0); for (let d = 0; d < 2 * D.YEAR_D; d++) { D.advanceDays(1); if (D.isTV(tq, P.day * D.DAY_S)) tvDays++; }
  const tel = D.elements(tq.r, tq.v, T.mu), tilt2 = Math.acos(Math.min(1, tel.h[1] / tel.hl)) * 180 / Math.PI;
  check('station-keeping: a held TV satellite’s tilt wanders past 3° in two years and the capital still sees it all day, so TV pays on',
    tv0 && tilt2 > 3 && tvDays === 2 * D.YEAR_D, `tilt ${tilt2.toFixed(1)}° after two years; TV on ${tvDays} of ${2 * D.YEAR_D} days`);
}

// space-2. Orbital decay (space session, QUEUE Q25): above the flight's air a thin upper atmosphere (Vallado's exponential
// table) drags on low orbits between flights. A satellite with propellant pays to hold its orbit (with Q50's tides); a dry
// one sinks on its rails (orbit-averaged drag, study_decay.mjs) and re-enters when its periapsis reaches the air's top.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,satAt,kepler,elements,thinAir,dragK,dragRate,holdRate,decayLife,decayStep,skDv,skLife,TELLUS,PROG,HOOK,DAY_S,len,add,mul};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R; P.sats = []; P.day = 0;
  // a Probe left in a circular equatorial orbit at alt, its tanks emptied unless keep
  const reg = (alt, keep = false) => { const s = D.newShip(D.PRESETS.Probe), a = R + alt, vc = Math.sqrt(T.mu / a);
    Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -vc] }); D.satRegister(s, { day0: P.day }); const q = P.sats.at(-1);
    if (!keep) for (const o of q.shape) if (o.res) for (const k of ['fuel', 'gas']) if (o.res[k] > 0) { q.mass -= o.res[k] * 1000; o.res[k] = 0; }
    return q; };
  const ok1 = Math.abs(D.thinAir(200e3) / 2.789e-10 - 1) < 1e-9 && D.thinAir(99e3) === 0 && D.thinAir(150e3) < D.thinAir(140e3);
  const lo = reg(200e3), hi = reg(700e3), K = D.dragK(lo), L = D.decayLife(lo);
  check('decay: the upper air thins with height; a dry Probe at 200 km has a lifetime of tens of days, one at 700 km lasts',
    ok1 && K > 0.005 && K < 0.05 && L > 10 && L < 200 && D.decayLife(hi) === Infinity, `Cd·A/m ${K.toFixed(4)} m²/kg; life at 200 km ${L.toFixed(1)} days`);
  const pe0 = D.elements(lo.r, lo.v, T.mu).pe, hr0 = hi.r.slice(), hv0 = hi.v.slice();
  D.advanceDays(Math.floor(L / 2)); const pe1 = D.elements(lo.r, lo.v, T.mu).pe, L1 = D.decayLife(lo), hiMoved = Math.abs(D.elements(hi.r, hi.v, T.mu).pe - D.elements(hr0, hv0, T.mu).pe);
  D.advanceDays(Math.ceil(L - Math.floor(L / 2)) + 1);
  check('decay: dry, it sinks on its rails as predicted, is warned about, and re-enters; the high one barely feels it',
    pe1 < pe0 - 5e3 && Math.abs(L1 - (L - Math.floor(L / 2))) < 0.05 * L + 0.5 && !P.sats.includes(lo) && P.sats.includes(hi) && hiMoved < 100 &&
    news.some(m => m.startsWith(lo.name) && /within/.test(m)) && news.some(m => m.startsWith(lo.name) && /re-entered/.test(m)),
    `periapsis ${((pe0 - R) / 1e3).toFixed(0)} → ${((pe1 - R) / 1e3).toFixed(0)} km by day ${Math.floor(L / 2)}; life then ${L1.toFixed(1)} (expected ${(L - Math.floor(L / 2)).toFixed(1)}); 700 km periapsis moved ${hiMoved.toFixed(2)} m; news: ${news.filter(m => m.startsWith(lo.name)).join(' / ')}`);
  // with its tanks, it holds: on its rails, paying the drag
  P.sats = []; news.length = 0; P.day = 0; const held = reg(200e3, true), ep = held.epoch, dv0 = D.skDv(held), g = D.dragRate(held);
  D.advanceDays(30);
  check('decay: with propellant it holds its orbit, paying what the drag takes, and says how long that lasts',
    P.sats.includes(held) && held.epoch === ep && held.adrift == null && Math.abs(dv0 - D.skDv(held) - 30 * D.holdRate(held)) < 0.05 * 30 * g && g > 0 && D.skLife(held) < Infinity,
    `${g.toFixed(3)} m/s a day; ${(dv0 - D.skDv(held)).toFixed(2)} m/s in 30 days; ${D.skLife(held).toFixed(0)} days left`);
  // the averaged rails against a direct RK4 with the same drag (no tides), 150 km down to 130 km
  { const q = reg(150e3), K2 = D.dragK(q), a0 = R + 150e3; let r = [a0, 0, 0], v = [0, 0, -Math.sqrt(T.mu / a0)], t = 0; const h = 2, { add, mul, len } = D;
    const acc = (r, v) => { const rl = len(r), vl = len(v), f = 0.5 * D.thinAir(rl - R) * vl * K2; return add(mul(r, -T.mu / rl ** 3), mul(v, -f)); };
    while (D.elements(r, v, T.mu).pe > R + 130e3) { const a1 = acc(r, v), r2 = add(r, mul(v, h / 2)), v2 = add(v, mul(a1, h / 2)), a2 = acc(r2, v2), r3 = add(r, mul(v2, h / 2)), v3 = add(v, mul(a2, h / 2)), a3 = acc(r3, v3), r4 = add(r, mul(v3, h)), v4 = add(v, mul(a3, h)), a4 = acc(r4, v4);
      r = add(r, mul(add(add(v, mul(v2, 2)), add(mul(v3, 2), v4)), h / 6)); v = add(v, mul(add(add(a1, mul(a2, 2)), add(mul(a3, 2), a4)), h / 6)); t += h; }
    q.epoch = 0; q.r = [a0, 0, 0]; q.v = [0, 0, -Math.sqrt(T.mu / a0)]; let tr = 0; while (D.elements(q.r, q.v, T.mu).pe > R + 130e3) { tr += 600; D.decayStep(q, tr); }
    check('decay: the averaged rails agree with a direct integration of the drag (150 → 130 km) to a few percent', Math.abs(tr / t - 1) < 0.05, `direct ${(t / 3600).toFixed(1)} h, rails ${(tr / 3600).toFixed(1)} h`); }
}

// space-3. Debris, slice 1 (space session, QUEUE Q26; NOTES § "Plan: debris and Kessler"): big pieces are objects. A
// spent stage of 100 kg or more left in a closed orbit clear of the air joins the registry at flight end as Debris:
// on its rails, targetable, never flyable; low ones decay and re-enter quietly; suborbital or small pieces don't count.
{
  const D = new Function(src + 'return {newShip,PRESETS,detach,junkRegister,JUNK,satKind,satAt,elements,orbitsAt,flyable,advanceDays,partMass,TELLUS,PROG,HOOK,DAY_S,len,sub};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R; P.sats = []; P.day = 0;
  // an Orbiter in a circular orbit at alt (speed × f of circular), flying a program flight; it drops its first stage
  const fly = (alt, f = 1) => { const s = D.newShip(D.PRESETS.Orbiter), a = R + alt, vc = Math.sqrt(T.mu / a) * f;
    Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -vc], rec: { launched: true, day0: P.day } }); return s; };
  const drop = s => { const ev = s.events.find(e => e.decouple.length), list = s.parts.filter(p => p.on && ev.decouple.includes(p.seg)); D.detach(s, list, [0, -1, 0], 0); return list; };
  const hi = fly(400e3), dl = drop(hi), dm = dl.reduce((a, p) => a + D.partMass(p), 0) * 1000, n1 = D.junkRegister(hi.rec), q = P.sats.at(-1);
  const at = q && D.satAt(q, q.epoch)[0], j0 = q && D.elements(q.r, q.v, T.mu);
  check('debris: a spent stage left in orbit joins the registry as Debris, on its rails, targetable, not flyable',
    n1 === 1 && q.junk && D.satKind(q) === 'Debris' && /\(debris\)$/.test(q.name) && Math.abs(q.mass - dm) < 1 && D.len(D.sub(at, q.r)) < 1e-6 && j0.pe - R > 390e3 &&
    D.orbitsAt(T).includes(q) && !D.flyable(q) && news.some(m => /stays in orbit as debris/.test(m)) && D.JUNK.length === 0,
    `${q ? q.name : '—'}: ${(dm / 1000).toFixed(2)} t at ${q ? ((j0.pe - R) / 1e3).toFixed(0) : '—'}–${q ? ((j0.ap - R) / 1e3).toFixed(0) : '—'} km`);
  // low: registered, then gone within a day, quietly; suborbital and small pieces, or another flight's, never count
  news.length = 0; const lo = fly(105e3); drop(lo); const n2 = D.junkRegister(lo.rec), ql = P.sats.at(-1);
  const sub = fly(300e3, 0.8); drop(sub); const n3 = D.junkRegister(sub.rec);
  const sm = fly(400e3), tiny = sm.parts.filter(p => p.on && D.partMass(p) < 0.1 && p.seg === sm.events.find(e => e.decouple.length).decouple[0]).slice(0, 1);
  if (tiny.length) D.detach(sm, tiny, [0, -1, 0], 0); const n4 = D.junkRegister(sm.rec);
  const other = fly(400e3); drop(other); const n5 = D.junkRegister({ launched: true, day0: 0 });
  const nBefore = P.sats.length; D.advanceDays(1);
  check('debris: a low piece re-enters within a day without news; suborbital, small (<100 kg) and other flights’ pieces never join',
    n2 === 1 && ql.junk && !P.sats.includes(ql) && P.sats.length === nBefore - 1 && !news.some(m => /re-entered|sinking/.test(m)) && n3 === 0 && n4 === 0 && tiny.length === 1 && n5 === 0,
    `low ${n2}, suborbital ${n3}, small ${n4} (${tiny.length ? (D.partMass(tiny[0]) * 1000).toFixed(0) + ' kg' : 'none found'}), another flight's ${n5}`);
  // the high one, a month on: still there, decaying by metres
  D.advanceDays(30); const j1 = D.elements(q.r, q.v, T.mu);
  check('debris: a piece at 400 km stays, on its rails plus a trace of decay', P.sats.includes(q) && j0.pe - j1.pe >= 0 && j0.pe - j1.pe < 500, `periapsis down ${(j0.pe - j1.pe).toFixed(1)} m in 31 days`);
}

// space-4. Debris, slice 2 (space session, QUEUE Q146): conjunctions between flights. Big objects against active entries
// only, at Rs² v / (2π r² W cos(Δi/2)) a pair per band (study_debris.mjs: a Monte Carlo agrees within its noise). A hit:
// crewed entries are always warned and move; tracked ones (mainframe era on) with fuel dodge; the rest are destroyed with
// the object and the breakup is recorded. The pressure is a world setting (off / light / real).
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,detach,junkRegister,conjTick,pairRate,resid,bandR,BAND_W,skDv,TELLUS,PROG,HOOK,DAY_S};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R, deg = Math.PI / 180;
  const orbit = (s, alt, inc) => { const a = R + alt, vc = Math.sqrt(T.mu / a); Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, vc * Math.sin(inc * deg), -vc * Math.cos(inc * deg)] }); return s; };
  const sat = (alt, inc, { fuel = false, crew = false } = {}) => { const s = orbit(D.newShip(D.PRESETS.Probe), alt, inc); D.satRegister(s, { day0: P.day }); const q = P.sats.at(-1);
    if (!fuel) for (const o of q.shape) if (o.res) for (const k of ['fuel', 'gas']) if (o.res[k] > 0) { q.mass -= o.res[k] * 1000; o.res[k] = 0; }
    if (crew) q.shape[0].crew = 2; return q; };
  const junk = (alt, inc) => { const s = orbit(D.newShip(D.PRESETS.Orbiter), alt, inc); s.rec = { launched: true, day0: P.day };
    const ev = s.events.find(e => e.decouple.length); D.detach(s, s.parts.filter(p => p.on && ev.decouple.includes(p.seg)), [0, -1, 0], 0); D.junkRegister(s.rec); return P.sats.at(-1); };
  const reset = (day, mode) => { P.sats = []; P.day = day; P.breakups = []; P.pressures = { debris: mode }; news.length = 0; };
  reset(0, 'real'); const a = sat(425e3, 0), o = junk(425e3, 60), far = junk(1500e3, 60);
  const ra = D.resid(a), ro = D.resid(o), rb = D.bandR(6), Rs = ra.R + ro.R, want = Rs * Rs * Math.sqrt(T.mu / rb) / (2 * Math.PI * rb * rb * D.BAND_W * Math.cos(30 * deg)) * D.DAY_S;
  check('debris conjunctions: a pair sharing a band meets at Rs² v / (2π r² W cos(Δi/2)) a day; a pair in different bands never',
    Math.abs(ra.f[6] - 1) < 1e-9 && Math.abs(ro.f[6] - 1) < 1e-9 && Math.abs(D.pairRate(a, o) / want - 1) < 0.02 && D.pairRate(a, far) === 0,
    `${D.pairRate(a, o).toExponential(3)} a day (formula ${want.toExponential(3)}), Rs ${Rs.toFixed(1)} m; 1,500 km: ${D.pairRate(a, far)}`);
  const hit = () => 0, miss = () => 0.999999, T1 = d => (P.day + d) * D.DAY_S;
  reset(0, 'off'); { const a1 = sat(425e3, 0), o1 = junk(425e3, 60); D.conjTick(T1(0), T1(1), hit); const offKept = P.sats.includes(a1) && P.sats.includes(o1);
    reset(0, 'real'); const a2 = sat(425e3, 0), o2 = junk(425e3, 60); news.length = 0; D.conjTick(T1(0), T1(1), miss); const missed = P.sats.length === 2 && !news.length;
    D.conjTick(T1(0), T1(1), hit); const gone = !P.sats.includes(a2) && !P.sats.includes(o2) && P.breakups.length === 1 && Math.abs(P.breakups[0].h - 425e3) < 1e3 && news.some(m => /struck by/.test(m));
    check('debris conjunctions: off does nothing; a miss leaves both; an untracked hit destroys both and records the breakup',
      offKept && missed && gone, `breakup at ${P.breakups[0] ? (P.breakups[0].h / 1e3).toFixed(0) + ' km, ' + (P.breakups[0].mass / 1000).toFixed(1) + ' t' : '—'}`); }
  reset(3000, 'real'); { const a3 = sat(425e3, 0, { fuel: true }), o3 = junk(425e3, 60), dv0 = D.skDv(a3); D.conjTick(T1(0), T1(1), hit);
    const dodged = P.sats.includes(a3) && P.sats.includes(o3) && Math.abs(dv0 - D.skDv(a3) - 0.5) < 0.01 && news.some(m => /dodged/.test(m));
    reset(0, 'real'); const a4 = sat(425e3, 0, { crew: true }), o4 = junk(425e3, 60); D.conjTick(T1(0), T1(1), hit);
    const warned = P.sats.includes(a4) && P.sats.includes(o4) && news.some(m => /was warned/.test(m)) && !P.breakups.length;
    check('debris conjunctions: tracked (mainframe era) with fuel, it dodges for 0.5 m/s; crewed, it is always warned, even untracked and dry',
      dodged && warned, `dodged ${dodged}, crewed warned ${warned}`); }
}

// space-5. Debris, slice 3 (space session, QUEUE Q147): fragments as a density per band. Breakups add 1 cm+ fragments
// by NASA's model, spread around their height; drag drains each band into the one below; a hit kills an uncrewed entry
// (a dead hulk stays up) and only a large fragment shatters it; crewed entries are warned, never hit by surprise; the
// cascade (R0 ≥ 1 and the next breakup due within 50 years) is news; an anti-satellite test fouls a band.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,detach,junkRegister,fragTick,breakup,fragsOf,fragBands,fragRate,catFrac,asatTest,CASC_STAT,BAND_N,TELLUS,PROG,HOOK,DAY_S,YEAR_D};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R, deg = Math.PI / 180, sum = () => D.fragBands().reduce((a, x) => a + x, 0);
  const reset = mode => { P.sats = []; P.day = 0; P.frag = null; P.breakups = []; P.casc = {}; P.pressures = { debris: mode }; news.length = 0; };
  const orbit = (s, alt, inc) => { const a = R + alt, vc = Math.sqrt(T.mu / a); Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, vc * Math.sin(inc * deg), -vc * Math.cos(inc * deg)] }); return s; };
  const sat = (alt, inc, crew = false) => { D.satRegister(orbit(D.newShip(D.PRESETS.Probe), alt, inc), { day0: 0 }); const q = P.sats.at(-1); if (crew) q.shape[0].crew = 2; return q; };
  const junk = (alt, inc) => { const s = orbit(D.newShip(D.PRESETS.Orbiter), alt, inc); s.rec = { launched: true, day0: 0 }; const ev = s.events.find(e => e.decouple.length);
    D.detach(s, s.parts.filter(p => p.on && ev.decouple.includes(p.seg)), [0, -1, 0], 0); D.junkRegister(s.rec); const q = P.sats.at(-1); q.mass = 2000; return q; };
  reset('real'); const n1 = D.breakup(800e3, 1000), F = D.fragBands(), pk = F.indexOf(Math.max(...F)), s1 = sum();
  reset('real'); D.breakup(150e3, 1000); const lowKept = sum() / D.fragsOf(1000);
  check('fragments: a 1 t breakup makes ~47,000 pieces of 1 cm and more (NASA), spread around its height; a low one loses what falls below the air',
    Math.abs(n1 - 0.1 * 1000 ** 0.75 * 0.01 ** -1.71) < 1 && (pk === 13 || pk === 14) && Math.abs(s1 / n1 - 1) < 1e-6 && lowKept < 0.9,
    `${Math.round(n1)} fragments, peak band ${pk}; a breakup at 150 km keeps ${(lowKept * 100).toFixed(0)} % in the bands`);
  reset('off'); D.breakup(400e3, 1000); D.breakup(800e3, 1000); const lo0 = D.fragBands().slice(0, 9).reduce((a, x) => a + x, 0), hi0 = D.fragBands().slice(12).reduce((a, x) => a + x, 0);
  D.fragTick(0, D.YEAR_D * D.DAY_S); const lo1 = D.fragBands().slice(0, 9).reduce((a, x) => a + x, 0), hi1 = D.fragBands().slice(12).reduce((a, x) => a + x, 0);
  check('fragments: drag drains low bands within a year and barely touches 800 km (even with the setting off, drag is physics)',
    lo1 / lo0 < 0.7 && hi1 / hi0 > 0.99, `below 550 km ${(lo1 / lo0 * 100).toFixed(0)} % left, above 700 km ${(hi1 / hi0 * 100).toFixed(1)} %`);
  // a thick cloud at 425 km: an uncrewed satellite dies (a hulk stays), a crewed one is warned and lives, a big object shatters
  reset('real'); D.breakup(425e3, 1e9); const a = sat(425e3, 0), c = sat(425e3, 0, true), o = junk(425e3, 60), nB = sum();
  const La = D.fragRate(a), cf = D.catFrac(a.mass, 3000); D.fragTick(0, D.DAY_S, () => 0.001);
  const dead = P.sats.includes(a) && a.junk && /\(dead\)$/.test(a.name) && a.ant === 0, crewOK = P.sats.includes(c) && !c.junk && news.some(m => /crew are warned/.test(m));
  const shattered = !P.sats.includes(o) && sum() > nB * 0.99 && news.some(m => /shattered by a large fragment/.test(m)) && news.some(m => /gone silent/.test(m));
  check('fragments: in a thick cloud an uncrewed satellite goes silent (its hulk stays up as debris), a crewed one is warned and lives, a spent stage is shattered into more',
    La > 1 && cf < 0.01 && dead && crewOK && shattered, `hits a day ${La.toFixed(1)}, shattering share ${cf.toExponential(1)}; dead ${dead}, crew ${crewOK}, shattered ${shattered}`);
  // a thinner cloud, the same roll: the satellite dies, the stage (only large fragments can shatter it) survives
  reset('real'); D.breakup(425e3, 1e7); const a3 = sat(425e3, 0), o3 = junk(425e3, 60); D.fragTick(0, D.DAY_S, () => 0.01);
  check('fragments: a hit that kills a satellite leaves a spent stage whole (shattering takes 40 J per gram of it)',
    a3.junk && P.sats.includes(o3), `satellite ${a3.junk ? 'dead' : 'alive'}, stage ${P.sats.includes(o3) ? 'whole' : 'shattered'}`);
  reset('off'); D.breakup(425e3, 1e7); const a2 = sat(425e3, 0); D.fragTick(0, D.DAY_S, () => 0); const offOK = P.sats.includes(a2) && !a2.junk;
  // the cascade: thirty spent stages at 800–850 km and a big breakup there: R0 ≥ 1, the next breakup due within 50 years, news once
  reset('real'); for (let i = 0; i < 30; i++) junk(825e3, (i * 37) % 180); D.breakup(825e3, 2e5); D.fragTick(0, D.DAY_S, () => 0.999999); D.fragTick(D.DAY_S, 2 * D.DAY_S, () => 0.999999);
  const cs = D.CASC_STAT[14] || {}, casc = news.filter(m => /feeds itself/.test(m)).length;
  const asat = (P.frag = null, D.asatTest('A rival', 600e3)), asatOK = asat > 4e4 && D.fragBands()[9] > 1000 && news.some(m => /anti-satellite/.test(m));
  check('fragments: off spares satellites; a crowded band past R0 = 1 with the next breakup due within 50 years is news, once; an anti-satellite test fouls its band',
    offOK && cs.R0 >= 1 && cs.gen <= 50 && casc === 1 && asatOK, `R0 ${cs.R0?.toFixed(1)}, next in ${cs.gen?.toFixed(1)} years, news ${casc}; ASAT ${Math.round(asat)} fragments`);
}

// space-6. Dispatched flights leave debris too (space session, QUEUE Q149): procFly hands back what its flight dropped
// (keepJunk) and dispatchRun registers the pieces that stay up, dated from the flight's start; dry runs leave none.
{
  const D = new Function(src + 'return {PRESETS,PROG,HOOK,procKey,procFly,junkAdd,JUNK,newShip,detach,TELLUS,DAY_S,satKind,BODIES,MISSIONS,SELENE,advPhys,advRails,bodyRel,dvPlan,dvRemaining,engAcc,localFrame,procStart,qFromBasis,railsOK,siteAt,stage,timeToNu,toPF,vesselCost,len,norm,add,sub,mul,dot,cross,elements,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, st = D.PRESETS.Orbiter; P.sats = []; P.day = 10; P.procs = {}; handAscent(D, st); const proc = P.procs[D.procKey(st)];
  D.JUNK.length = 0; D.JUNK.push({ marker: true }); const before = D.JUNK.length, day = P.day;
  const f = D.procFly(st, proc, { pe: 180e3, ap: 180e3 }, { keepJunk: true }), j1 = D.JUNK.map(j => j.marker ? 'M' : Math.round(j.mass)).join(','), dry = D.procFly(st, proc, { pe: 180e3, ap: 180e3 }), j2 = D.JUNK.map(j => j.marker ? 'M' : Math.round(j.mass)).join(',');
  const kept = D.JUNK.length === 1 && D.JUNK[0].marker, n0 = D.junkAdd(f.junk || [], f.T0);   // the booster falls back: nothing stays up
  // a piece dropped by the orbiting craft: registered, its epoch from the flight's start
  const s = f.s; s.rec = { launched: true, day0: 0 }; const part = s.parts.filter(p => p.on && p.d.kind === 'tank').slice(-1);
  D.JUNK.length = 0; D.detach(s, part, [0, -1, 0], 0); const piece = D.JUNK[0]; piece.mass = Math.max(piece.mass, 200); const n1 = D.junkAdd([piece], f.T0), q = P.sats.at(-1);
  check('dispatched debris: procFly hands back its flight’s pieces (keepJunk), the global list untouched, dry runs return none; what stays up is registered from the flight’s start',
    f.ok && Array.isArray(f.junk) && f.junk.length >= 1 && f.junk.every(j => j.rec) && !('junk' in dry) && before === 1 && kept && f.T0 === Math.ceil(day - 1e-9) * D.DAY_S &&
    n0 === 0 && n1 === 1 && q.junk && D.satKind(q) === 'Debris' && Math.abs(q.epoch - (f.T0 + piece.t)) < 1e-6,
    `${f.junk ? f.junk.length : '—'} piece(s) dropped (${f.junk ? f.junk.map(j => Math.round(j.mass) + ' kg').join(', ') : ''}); registered ${n0} then ${n1}; list kept ${kept} (after the flight ${j1}, after the dry run ${j2}); T0 ${f.T0 / D.DAY_S} (day ${day}); epoch off by ${q ? (q.epoch - f.T0 - piece.t).toExponential(1) : '—'}`);
}

// space-7. The orbital period goes in the logbook once the engines stop (space session, QUEUE Q114, PLAYTEST #30): it
// used to be logged the first moment the orbit was bound, mid-burn (a probe captured into 200 × 20 km logged "1,521.9 min
// at 3,112 km"). The Δv to orbit is still noted at the moment the orbit closes.
{
  const D = new Function(src + 'return {newShip,PRESETS,missionTick,elements,TELLUS,SELENE,PROG,HOOK,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG; P.day = 0; P.log = {};
  const run = (B, alt, apAlt) => { const x = D.newShip(D.PRESETS.Probe); D.S = x; x.landed = false; D.t = 0; D.missionTick(x, 0, false);
    const rp = B.R + alt, ra = B.R + apAlt, a = (rp + ra) / 2, vp = Math.sqrt(B.mu * (2 / rp - 1 / a));
    Object.assign(x, { alive: true, landed: false, body: B, r: [rp, 0, 0], v: [0, 0, -vp], throttle: 1 }); x.rec.dv = 900; x.rec.launched = true;
    x.parts.filter(p => p.on && p.d.kind === 'engine').forEach(p => { x.segs[p.seg].ignited = true; });
    const id = B === D.SELENE ? 'sorbit' : 'period'; delete P.log[id]; D.missionTick(x, 0.1, true); const burning = !!P.log[id];
    x.throttle = 0; D.missionTick(x, 0.1, true); const L = P.log[id], el = D.elements(x.r, x.v, B.mu);
    return { burning, ok: !!L && Math.abs(L.v.p - el.period) < 1e-6, L, el }; };
  const sel = run(D.SELENE, 20e3, 200e3), tel = run(D.TELLUS, 300e3, 300e3);
  check('logbook: the orbital period is noted once the engines stop, around Selene and Tellus, not mid-burn',
    !sel.burning && sel.ok && !tel.burning && tel.ok && D.PROG.log.orbit,
    `Selene ${sel.L ? (sel.L.v.p / 60).toFixed(1) + ' min' : '—'} (logged while burning: ${sel.burning}); Tellus ${tel.L ? (tel.L.v.p / 60).toFixed(1) + ' min' : '—'} (while burning: ${tel.burning})`);
}

// space-8. Missions in flight, slice 1 (space session, QUEUE Q49): a vessel still coasting above the air at flight end
// that isn't in a lasting orbit becomes a cruise entry, carried between flights leg by leg as the predictor sees it.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,satAt,elements,kepler,predictFrom,cruiseNext,flyable,satsUp,TELLUS,SELENE,PROG,HOOK,DAY_S,STAT_R,len,sub,set ORB_T0(v){ORB_T0=v}};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, Sl = D.SELENE, R = T.R; D.ORB_T0 = 0;
  const reg = (r, v) => { const s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r, v }); const n = P.sats.length; D.satRegister(s, { day0: 0 }); return P.sats.length > n ? P.sats.at(-1) : null; };
  const reset = () => { P.sats = []; P.day = 0; news.length = 0; };
  // a transfer to Selene: from 300 km, aimed so the predictor finds the encounter
  const r0 = R + 300e3, vT = Math.sqrt(T.mu * (2 / r0 - 2 / (r0 + Sl.a))) * 1.002; let tr = null;
  for (let k = 0; k < 360 && !tr; k++) { const a = k * Math.PI / 180, r = [r0 * Math.cos(a), 0, r0 * Math.sin(a)], v = [vT * Math.sin(a), 0, -vT * Math.cos(a)], L = D.predictFrom({ b: T, r, v, t: 0 });
    if (L[0].endKind === 'enc' && L[1] && L[1].b === Sl) tr = { r, v, L }; }
  reset(); const qt = reg(tr.r, tr.v), tArr = tr.L[0].endT; D.advanceDays(Math.ceil(tArr / D.DAY_S) + 0.01);
  const arrived = qt && qt.bodyName === 'Selene' && news.some(m => /entered Selene/.test(m));
  const back = qt && (qt.cruise || !P.sats.includes(qt) || qt.bodyName === 'Selene');
  check('in flight: a Selene transfer left at flight end is carried between flights and enters Selene’s sphere when the predictor said',
    !!tr && qt && qt.cruise !== undefined && arrived && back, `found an aim: ${!!tr}; arrives on day ${(tArr / D.DAY_S).toFixed(2)}; now around ${qt ? (qt.bodyName || 'Tellus') : '—'}; ${news.filter(m => /entered|settled|struck|left/.test(m)).join(' / ')}`);
  // an escape stays on its rails; a return halts at the top of the air (flyable, waiting); lasting orbits are satellites
  reset(); const ve = Math.sqrt(2 * T.mu / r0) * 1.05, qe = reg([r0, 0, 0], [0, 0, -ve]); D.advanceDays(3); const eExp = D.kepler([r0, 0, 0], [0, 0, -ve], 3 * D.DAY_S, T.mu)[0], qeUp = D.satsUp().includes(qe);
  reset(); const ra = R + 5000e3, rp = R + 50e3, aa = (ra + rp) / 2, va = Math.sqrt(T.mu * (2 / ra - 1 / aa)), qr = reg([ra, 0, 0], [0, 0, -va]); D.advanceDays(1); const hr = qr && D.len(qr.r) - R, ep1 = qr && qr.epoch; D.advanceDays(1);
  const halted = qr && qr.cruise && qr.halt && qr.halt.kind === 'air' && Math.abs(hr - T.atm) < 1 && qr.epoch > ep1 && Math.abs(D.len(D.satAt(qr, qr.epoch)[0]) - R - T.atm) < 1 && D.flyable(qr) && news.some(m => /top of Tellus/.test(m));
  reset(); const ql = reg([R + 300e3, 0, 0], [0, 0, -Math.sqrt(T.mu / (R + 300e3))]), qs = reg([D.STAT_R, 0, 0], [0, 0, -Math.sqrt(T.mu / D.STAT_R)]);
  check('in flight: an escape carries on outward (the moons perturb it as in flight); a return waits at the top of the air, flyable; low and stationary orbits are still satellites',
    qe && qe.cruise && Math.abs(qe.epoch - 3 * D.DAY_S) < 1 && D.len(qe.r) > 0.9 * D.len(eExp) && D.elements(qe.r, qe.v, T.mu).e > 1 && halted && ql && !ql.cruise && qs && !qs.cruise && D.satsUp().includes(qs) && !qeUp,
    `escape at ${qe ? (D.len(qe.r) / 1e6).toFixed(0) : '—'} Mm after 3 days (pure Kepler ${(D.len(eExp) / 1e6).toFixed(0)}, ${qe ? (D.len(D.sub(qe.r, eExp)) / 1e3).toFixed(0) : '—'} km apart); return halted at ${hr ? (hr / 1e3).toFixed(1) : '—'} km`);
}

// space-9. Missions in flight, slice 2 (space session, QUEUE Q49): cruise events on the timeline, and "no silent
// misses": entering a moon's sphere and the closest approach there stop time once per vessel and body; an atmosphere or
// an impact course always stops it (an impact 3 h ahead, so it can be flown).
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,advanceTo,upcoming,cruiseEvents,cruiseSeen,predictFrom,elements,tPe,satAt,TELLUS,SELENE,PROG,HOOK,DAY_S,len,set ORB_T0(v){ORB_T0=v}};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, Sl = D.SELENE, R = T.R; D.ORB_T0 = 0;
  const reg = (r, v) => { const s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r, v }); D.satRegister(s, { day0: 0 }); return P.sats.at(-1); };
  const reset = () => { P.sats = []; P.day = 0; news.length = 0; P.decisions = []; P.active = []; P.dispatch = []; };
  const r0 = R + 300e3, vT = Math.sqrt(T.mu * (2 / r0 - 2 / (r0 + Sl.a))) * 1.002; let tr = null;
  for (let k = 0; k < 360 && !tr; k++) { const a = k * Math.PI / 180, r = [r0 * Math.cos(a), 0, r0 * Math.sin(a)], v = [vT * Math.sin(a), 0, -vT * Math.cos(a)], L = D.predictFrom({ b: T, r, v, t: 0 });
    if (L[0].endKind === 'enc' && L[1] && L[1].b === Sl) tr = { r, v, L }; }
  reset(); const q = reg(tr.r, tr.v), ev1 = D.upcoming().find(x => x.kind === 'cruise'), arr = tr.L[0].endT / D.DAY_S;
  const st1 = D.advanceTo(arr + 20), day1 = P.day, ev2 = D.upcoming().find(x => x.kind === 'cruise'), st2 = D.advanceTo(arr + 20), day2 = P.day;
  const [rq, vq] = D.satAt(q, day2 * D.DAY_S), eq = D.elements(rq, vq, Sl.mu), toPe = (D.tPe(eq, 0) - D.tPe(eq, eq.nu)) / D.DAY_S;
  check('in flight: the arrival at Selene is on the timeline and stops time there; the next stop is the closest approach (or an impact warning) 3 h ahead',
    ev1 && /enters Selene/.test(ev1.text) && ev1.stop && Math.abs(ev1.day - arr) < 1e-6 && st1 && st1.kind === 'cruise' && Math.abs(day1 - arr) < 1e-3 && q.bodyName === 'Selene' && q.seen && q.seen['enc:Selene'] &&
    ev2 && ev2.stop && /capture burn|strike/.test(ev2.text) && st2 && st2.kind === 'cruise' && day2 > day1 && (!/capture burn/.test(ev2.text) || Math.abs(toPe - 3 / 24) < 0.01),
    `listed: ${ev1 ? ev1.text + ' (day ' + ev1.day.toFixed(2) + ')' : '—'}; stopped on day ${day1.toFixed(3)}; next: ${ev2 ? ev2.text : '—'}, stopped on day ${day2.toFixed(3)}, ${(toPe * 24).toFixed(2)} h before periapsis`);
  // seen once: the same kind of stop for that body doesn't stop time again
  const evs = D.cruiseEvents(P.day * D.DAY_S), again = evs.find(x => x.key), seenOK = !again || (D.cruiseSeen(again), !D.cruiseEvents(P.day * D.DAY_S).find(x => x.key === again.key && x.stop));
  // a return to Tellus stops at the top of the air
  reset(); const ra = R + 5000e3, rp = R + 50e3, aa = (ra + rp) / 2, va = Math.sqrt(T.mu * (2 / ra - 1 / aa)), qr = reg([ra, 0, 0], [0, 0, -va]);
  const ea = D.upcoming().find(x => x.kind === 'cruise'), sta = D.advanceTo(5);
  check('in flight: a stop seen once is shown but doesn’t stop time again; a return stops at the top of the air, where it waits',
    seenOK && ea && /reaches Tellus's air/.test(ea.text) && ea.stop && sta && sta.kind === 'cruise' && qr.halt && Math.abs(P.day - ea.day) < 1e-3,
    `return: ${ea ? ea.text + ' on day ' + ea.day.toFixed(3) : '—'}; stopped on day ${P.day.toFixed(3)}, halted ${!!qr.halt}`);
}

// space-10. Missions in flight, slice 3 (space session, QUEUE Q166): planned burns go with a vessel's entry and come back
// when it's flown; each stops time 3 h ahead; handed to mission control it's flown at its time with the era's error from
// the vessel's own tanks; passed with nobody at the controls it's dropped; a burn out of orbit puts the vessel in flight.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,vesselOf,advanceDays,advanceTo,upcoming,nodeHandOff,elements,skDv,compEra,autoAllowed,entryLink,TELLUS,PROG,HOOK,DAY_S,BURN_ERR,len};')();
  const seen = q => { let t = q.nodes[0].T; while (!D.entryLink(q, t).ok) t += 30; q.nodes[0].T = t; };   // in view of a station then (Q186: mission control needs contact before onboard computers)
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, R = T.R, a0 = R + 300e3, vc = Math.sqrt(T.mu / a0);
  const reset = () => { P.sats = []; P.day = 2000; news.length = 0; P.decisions = []; P.active = []; P.dispatch = []; };   // the mainframe era: mission control flies burns (Q127)
  const reg = (dv, t = 30000) => { const s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r: [a0, 0, 0], v: [0, 0, -vc], node: { t, dv: [dv, 0, 0], b: 'Tellus' }, nodeQ: [{ t: t + 9000, dv: [5, 0, 0], b: 'Tellus' }] });
    D.satRegister(s, { day0: 2000 }); return P.sats.at(-1); };
  reset(); const q = reg(50), T0 = 2000 * D.DAY_S, v = D.vesselOf(q, T0 + 500);
  const carried = q.nodes && q.nodes.length === 2 && q.nodes[0].T === T0 + 30000 && v.node && v.node.t === 29500 && v.nodeQ.length === 1 && v.nodeQ[0].t === 38500;
  const ev = D.upcoming().find(x => x.kind === 'burn'), st = D.advanceTo(2010), stDay = P.day;
  check('planned burns: a vessel’s nodes go with its entry and come back in the next flight’s time; the burn is on the timeline and stops time 3 h ahead',
    carried && ev && ev.stop && Math.abs(ev.day - (T0 + 30000 - 3 / 24 * D.DAY_S) / D.DAY_S) < 1e-6 && st && st.kind === 'burn' && Math.abs(stDay - ev.day) < 1e-3,
    `carried ${carried}; ${ev ? ev.text : '—'} on day ${ev ? ev.day.toFixed(3) : '—'}; stopped on day ${stDay.toFixed(3)}`);
  // handed to mission control: flown at its time, with the era's error, from its own tanks; the next one missed
  seen(q); const e0 = D.elements(q.r, q.v, T.mu), dv0 = D.skDv(q); D.nodeHandOff(q.id); D.advanceDays(2);
  const e1 = D.elements(q.r, q.v, T.mu), want = vc * 2 * (50 / vc), dA = e1.a - e0.a, aExp = e0.a * (1 + 2 * 50 / vc), spent = dv0 - D.skDv(q), er = D.BURN_ERR[D.compEra()];
  const aAt = dv => T.mu / (2 * T.mu / a0 - (vc + dv) ** 2), aLo = aAt(50 * (1 - 3 * er)) - 1e3, aHi = aAt(50 * (1 + 3 * er)) + 1e3;   // vis-viva, exact (a linear guess missed ~0.14 %)
  const flown = news.some(m => /Mission control flew/.test(m)) && e1.a > aLo && e1.a < aHi && Math.abs(spent - 50) < 3 * er * 50 + 0.5;
  const missed = news.some(m => /passed with nobody at the controls/.test(m)) && !q.nodes;
  check('planned burns: mission control flies one at its time within the era’s error, paying from the tanks; an unhanded one is missed and dropped',
    flown && missed, `a ${((e0.a - R) / 1e3).toFixed(0)} → ${((e1.a - R) / 1e3).toFixed(1)} km (planned ${((aAt(50) - R) / 1e3).toFixed(1)}); spent ${spent.toFixed(2)} m/s of 50`);
  // a burn out of orbit: the satellite becomes a vessel in flight
  reset(); const qx = reg(2000); seen(qx); D.nodeHandOff(qx.id); D.advanceDays(2);
  check('planned burns: a burn that leaves the orbit puts the vessel in flight', qx.cruise === 1 && D.elements(qx.r, qx.v, T.mu).e > 1, `e ${D.elements(qx.r, qx.v, T.mu).e.toFixed(2)}, in flight ${!!qx.cruise}`);
}

// space-11. The star system on paper (space session, QUEUE Q87 slice 1): the planets from SYSTEM.md at their real places
// (heliocentric Kepler, no physics yet), for the map from epoch 1. The year fixes the scale; the ecliptic is tilted 23° to
// the equator and turned so the sun on day 0 is where the renderer draws it.
{
  const D = new Function(src + 'return {TU,helioPos,fromTellus,planetPeriod,eclFrame,SYSTEM_BODIES,SUN_DIR,DAY_S,YEAR_D,len,dot,norm,sub};')();
  const yr = n => D.planetPeriod(n) / D.DAY_S / D.YEAR_D, want = { Hesper: 244 / 400, Enyo: 1.87, Astraea: 4.61, Hyperion: 11.9, Erebus: 23.7 };
  const per = Object.entries(want).map(([n, w]) => [n, yr(n), w]), perOK = per.every(([n, y, w]) => Math.abs(y / w - 1) < 0.01);
  check('system: Tellus’s year is exactly 400 days and the planets’ periods are SYSTEM.md’s (Hesper 244 d, Enyo 1.87 y, Astraea 4.61, Hyperion 11.9, Erebus 23.7)',
    Math.abs(yr('Tellus') - 1) < 1e-12 && Math.abs(D.TU() / 15.8e9 - 1) < 0.01 && perOK, per.map(([n, y]) => `${n} ${y.toFixed(2)} y`).join(', ') + `; TU ${(D.TU() / 1e9).toFixed(2)} Gm`);
  const F = D.eclFrame(), tilt = Math.acos(F.N[1]) * 180 / Math.PI, sun0 = D.dot(D.norm(D.fromTellus('Helios', 0)), D.SUN_DIR);
  let inside = true; for (const b of D.SYSTEM_BODIES) for (let k = 0; k < 20; k++) { const r = D.len(D.helioPos(b.name, k * 37.3 * D.DAY_S)), a = b.a * D.TU(); if (r < a * (1 - b.e) * 0.999999 || r > a * (1 + b.e) * 1.000001) inside = false; }
  // Enyo's closest approaches to Tellus over 9 years: their spacing is the synodic period (the launch windows: 2.14 y)
  const dEn = t => D.len(D.fromTellus('Enyo', t)), mins = []; let prev = dEn(0), down = false;
  for (let d = 1; d < 9 * D.YEAR_D; d++) { const x = dEn(d * D.DAY_S); if (x > prev && down) mins.push(d - 1); down = x < prev; prev = x; }
  const gaps = mins.slice(1).map((m, i) => (m - mins[i]) / D.YEAR_D), gapOK = gaps.length >= 2 && gaps.every(g => Math.abs(g - 2.14) < 0.2);
  check('system: the sun on day 0 is the renderer’s, the ecliptic is 23° from the equator, every planet stays between its perihelion and aphelion, Enyo comes close every ~2.14 years',
    sun0 > 1 - 1e-9 && Math.abs(tilt - 23) < 1e-6 && inside && gapOK, `sun ${sun0.toFixed(9)}, tilt ${tilt.toFixed(3)}°, Enyo's closest approaches ${gaps.map(g => g.toFixed(2)).join(', ')} years apart`);
}

// space-12. The automation ladder, slice 1 (space session, QUEUE Q127): one table says what each computing era lets run
// as a routine; mission control's burns wait for mainframes, uncrewed runs to the moons for onboard computers, and a
// refusal says which era unlocks it.
{
  const D = new Function(src + 'return {autoAllowed,AUTO_LADDER,compEra,newShip,PRESETS,satRegister,nodeHandOff,entryLink,PROG,HOOK,TELLUS};')();
  D.HOOK.news = () => {}; const msgs = []; D.HOOK.msg = m => msgs.push(m); D.HOOK.save = () => {};
  const P = D.PROG, at = (day, k) => { P.day = day; return D.autoAllowed(k); };
  const e0 = at(0, 'burn'), e1 = at(2000, 'burn'), m1 = at(2000, 'moon'), m2 = at(3000, 'moon'), a0 = at(0, 'ascent');
  // a hand-off before mainframes is refused with the reason; in their era it goes through
  P.sats = []; P.day = 0; const T = D.TELLUS, a = T.R + 300e3, s = D.newShip(D.PRESETS.Probe);
  Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -Math.sqrt(T.mu / a)], node: { t: 30000, dv: [10, 0, 0], b: 'Tellus' } }); D.satRegister(s, { day0: 0 });
  const q = P.sats.at(-1); while (!D.entryLink(q, q.nodes[0].T).ok) q.nodes[0].T += 30;   // in view of a station (Q186)
  const r0 = D.nodeHandOff(q.id), mc0 = !!q.nodes[0].mc; P.day = 2000; const r1 = D.nodeHandOff(q.id);
  check('automation ladder: burns by mission control from mainframes, uncrewed moon runs from onboard computers, a flown ascent always; a refusal says which era',
    !e0.ok && /mainframes/.test(e0.why) && e1.ok && !m1.ok && /onboard computers/.test(m1.why) && m2.ok && a0.ok && r0 && r0.refused && !mc0 && r1 === q && q.nodes[0].mc && msgs.some(m => /Mission control needs mainframes/.test(m)),
    `day 0: burn "${e0.why}"; day 2000 (era ${(P.day = 2000, D.compEra())}): burn ${e1.ok}, moon "${m1.why}"; day 3000: moon ${m2.ok}`);
}

// space-13. The link budget, slice 1 (space session, QUEUE Q171, Q51): every link also says its rate (bit/s, the free-space
// law: LINK_K · P · Gt · Gr / d²) and its light delay, without changing which links exist; the rover's path through a
// relay runs at its weaker hop.
{
  const D = new Function(src + 'return {newShip,PRESETS,linkOf,linkRate,LINK_FLOOR,G_STATION,G_WHIP,P_RADIO,curSite,toPF,fromPF,TELLUS,SELENE,bodyPos,rotY,absTh,len,sub,mul,set t(v){simT=v},set ORB_T0(v){ORB_T0=v}};')();
  const T = D.TELLUS, R = T.R; D.t = 0; D.ORB_T0 = 0;
  const r1 = D.linkRate(5, 1, D.G_STATION, 1e6), r2 = D.linkRate(5, 1, D.G_STATION, 2e6);
  // a Probe 300 km straight over the pad (the pad's station sees it), and one around Selene (deep space)
  const u = D.curSite().u, over = D.rotY(D.mul(u, R + 300e3), D.absTh(0)), s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r: over, v: [0, 0, 0] });
  const L = D.linkOf(s), m = D.newShip(D.PRESETS.Probe); Object.assign(m, { alive: true, landed: false, body: D.SELENE, r: [D.SELENE.R + 100e3, 0, 0], v: [0, 0, 0] }); const Ls = D.linkOf(m);
  check('link budget: the rate falls with distance squared; a whip 300 km over the pad gets ~0.3 Mbit/s, one at Selene tens of bit/s, still above the telemetry floor; the delay is the light time',
    Math.abs(r1 / r2 - 4) < 1e-9 && L.ok && L.st && L.rate > 1e5 && L.rate < 1e6 && Math.abs(L.d - 300e3) < 5e3 && Ls.ok && Ls.rate > D.LINK_FLOOR && Ls.rate < 100 && Math.abs(Ls.delay - 2 * Ls.d / 299792458) < 1e-12,
    `over the pad: ${(L.rate / 1e3).toFixed(0)} kbit/s at ${(L.d / 1e3).toFixed(0)} km; at Selene: ${Ls.rate.toFixed(1)} bit/s at ${(Ls.d / 1e6).toFixed(1)} Mm, ${(Ls.delay * 1000).toFixed(0)} ms round trip`);
}

// space-14. The last Debrief survives a reload (QUEUE Q100; space overflow), and a flight left coasting above the air is
// "In flight" in it, not "written off" (it carries on as a cruise entry since v1.90).
{
  const mk = () => new Function(src + 'return {newShip,PRESETS,recNew,missionEnd,debRestore,get DEBRIEF_LAST(){return DEBRIEF_LAST},TELLUS,PROG,HOOK};')();
  const D = mk(); D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {}; D.HOOK.logged = () => {};
  const P = D.PROG, T = D.TELLUS, r0 = T.R + 300e3; P.sats = []; P.day = 0; P.done = P.done || {};
  const ra = T.R + 5000e3, rp = T.R + 50e3, va = Math.sqrt(T.mu * (2 / ra - 2 / (ra + rp))), s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r: [ra, 0, 0], v: [0, 0, -va] });   // high, on a path that comes down
  s.rec = D.recNew(); Object.assign(s.rec, { launched: true, day0: 0 }); D.missionEnd(s);
  const out = s.rec.debrief && s.rec.debrief.outcome, saved = JSON.stringify(P);
  const E = mk(); Object.assign(E.PROG, JSON.parse(saved)); const back = E.debRestore();
  check('debrief: a flight left coasting above the air reads "In flight"; the last Debrief is kept with the save and comes back after a reload',
    out && out.k === 'cruise' && /In flight/.test(out.t) && P.lastDebrief && back && JSON.stringify(back) === JSON.stringify(D.DEBRIEF_LAST) && E.DEBRIEF_LAST === back,
    `outcome ${out ? out.k + ' "' + out.t + ': ' + out.d + '"' : '—'}; restored ${!!back}`);
}

// space-15. Data as a volume (space session, QUEUE Q172, Q51 slice 2): a camera fills its recorder, contact drains it at
// the link's rate and imagery sells per bit received; the far side's slow-scan pictures trickle home; a recorder plays a
// blackout's readings back once the link returns.
{
  const D = new Function(src + 'return {PROG,HOOK,TELLUS,SELENE,DAY_S,advanceDays,CAM_BPS,REC_CAP,FAR_BITS,TLM_BITS,newShip,PRESETS,missionTick,physStep,advRails,linkOf,fromPF,curSite,bodyRel,SUN_DIR,DT,get t(){return simT},set t(v){simT=v},set ORB_T0(v){ORB_T0=v}};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {}; D.HOOK.logged = () => {};
  const P = D.PROG, T = D.TELLUS; D.ORB_T0 = 0;
  const fresh = () => Object.assign(P, { done: { beeper: {} }, cert: {}, atm: {}, streak: 0, flights: 0, funds: 500, bailouts: 0, offers: [], active: [], back: [], cdone: 0, stand: {}, recs: {}, cycle: 0, day: 0, sats: [], satN: 0, wseed: 4242, rel: {}, op: {}, stations: [] });
  const sat = altKm => { fresh(); const r0 = T.R + altKm * 1e3, v = Math.sqrt(T.mu / r0); P.sats.push({ id: 1, name: 'L', epoch: 0, r: [r0, 0, 0], v: [0, v, 0], imgs: 0, pending: [], cam: 1, ant: 1, sci: 0, ballast: 0, bio: 0 });
    for (let k = 0; k < 10; k++) D.advanceDays(2); const q = P.sats[0]; return { q, share: q.got / (D.CAM_BPS * D.DAY_S * 20), contact: q.contact, rate: q.rate }; };
  const lo = sat(300), hi = sat(2000);
  // the far side: a Probe-like craft past Selene's sunlit far side with its picture taken, then in sight of Tellus
  const toT = t => norm(mul(D.bodyRel(D.SELENE, t)[0], -1)); let tF = 0; while (dot(toT(tF), D.SUN_DIR) > -0.6) tF += 3600;
  fresh(); D.t = tF; const rF = 3 * D.SELENE.R, uN = toT(tF), wN = norm(cross(uN, [0, 1, 0])), f = D.newShip(['ant', 'cam', 't2', 'petrel']);
  Object.assign(f, { alive: true, landed: false, body: D.SELENE, r: mul(uN, rF), v: mul(wN, Math.sqrt(D.SELENE.mu / rF)), throttle: 0 }); Object.assign(f.rec, { launched: true, dv: 5000, farPhoto: true });
  let at5 = null; while (D.t < tF + 4 * 3600 && !f.rec.farSent) { D.advRails(f, 60, 1); if (at5 === null && D.t >= tF + 300) at5 = !!f.rec.farSent; }
  const farMin = (D.t - tF) / 60;
  // the recorder: strain logged out of contact (the far side of the planet), then the craft passes over the pad
  D.t = 0; const home = D.curSite(), x = D.newShip(['sci', 'pod']); x.landed = false; x.rec.launched = true;
  x.r = D.fromPF(T, mul(mul(home.u, -1), T.R + 50e3), 0); x.v = [0, 0, 0]; D.physStep(x, D.DT); for (const p of x.order) if (p.on && p.sk1) { p.sf1 = 0.3; p.sf2 = 0.3; } x.rec.lkT = undefined; D.missionTick(x, D.DT, true);
  const nRec = Object.keys(x.rec.sfRec || {}).length; for (const p of x.order) if (p.on && p.sk1) { p.sf1 = 0; p.sf2 = 0; }
  x.r = D.fromPF(T, mul(home.u, T.R + 300e3), 0); x.rec.lkT = undefined; for (let i = 0; i * D.DT < 1; i++) D.missionTick(x, D.DT, true);   // a second of playback
  const back = Object.keys(x.rec.sf).length, left = Object.keys(x.rec.sfRec).length;
  check('data as a volume: a 300 km camera downlinks about its contact share of a day\'s take (sales as before); at 2,000 km it\'s seen longer but drains far less; the recorder never overfills',
    lo.share > 0.7 * lo.contact && lo.share < 1.05 * lo.contact && hi.contact > 2 * lo.contact && hi.share < 0.5 * lo.share && lo.q.rec <= D.REC_CAP && hi.q.rec <= D.REC_CAP,
    `300 km: contact ${(lo.contact * 100).toFixed(1)}% at ${(lo.rate / 1e3).toFixed(0)} kbit/s → ${(lo.share * 100).toFixed(1)}% of the take home; 2,000 km: ${(hi.contact * 100).toFixed(1)}% at ${(hi.rate / 1e3).toFixed(1)} kbit/s → ${(hi.share * 100).toFixed(1)}%`);
  check('data as a volume: the far side\'s pictures trickle home from Selene (not in the first 5 minutes, done within an hour); a blackout\'s readings play back once the link returns',
    f.rec.farSent && at5 === false && farMin < 60 && f.rec.farGot >= D.FAR_BITS && nRec > 0 && back === nRec && left === 0,
    `far side home after ${farMin.toFixed(0)} min (${(D.FAR_BITS / 1e3).toFixed(0)} kbit); recorder: ${nRec} readings held out of contact, ${back} played back over the pad`);
}

// space-16. Contact gates automation (space session, QUEUE Q186, Q127 slice 3): before onboard computers mission control
// needs a link at a burn's time: a hand-off it can't reach is refused with the reason, and a burn whose link is gone when
// it comes passes; with onboard computers it runs out of contact. A link needs line of sight and a rate above the floor.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,nodeHandOff,entryLink,elements,TELLUS,SELENE,PROG,HOOK,DAY_S};')();
  const news = [], msgs = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = m => msgs.push(m); D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, a0 = T.R + 300e3, vc = Math.sqrt(T.mu / a0);
  const reg = day => { P.sats = []; P.day = day; P.stations = []; P.decisions = []; P.active = []; P.dispatch = []; news.length = 0; msgs.length = 0;
    const s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r: [a0, 0, 0], v: [0, 0, -vc], node: { t: 30000, dv: [20, 0, 0], b: 'Tellus' } });
    D.satRegister(s, { day0: day }); const q = P.sats.at(-1); while (D.entryLink(q, q.nodes[0].T).ok) q.nodes[0].T += 30; return q; };   // a burn out of every station's view
  let q = reg(2000); const r = D.nodeHandOff(q.id), refused = r && r.refused && /can't reach/.test(r.refused) && !q.nodes[0].mc && msgs.some(m => /can't reach/.test(m));
  q.nodes[0].mc = true; const a1 = D.elements(q.r, q.v, T.mu).a; D.advanceDays(2);   // handed over anyway (a station that closed since)
  const passed = news.some(m => /couldn't reach .* the burn passed/.test(m)) && !q.nodes && Math.abs(D.elements(q.r, q.v, T.mu).a - a1) < 1;
  q = reg(3000); const r3 = D.nodeHandOff(q.id), a3 = D.elements(q.r, q.v, T.mu).a; D.advanceDays(2);
  const blind = r3 === q && news.some(m => /Mission control flew/.test(m)) && D.elements(q.r, q.v, T.mu).a > a3 + 20e3;
  // at Selene: a whip is heard unless Selene is in the way; a craft with no antenna (a 1 W beacon) is too far to reach
  const B = D.SELENE, rs = B.R + 100e3, sel = { bodyName: 'Selene', ant: 1, r: [rs, 0, 0], v: [0, Math.sqrt(B.mu / rs), 0], epoch: 0, shape: [] };
  let side = { ok: 0, behind: 0 }; for (let k = 0; k < 24; k++) { const th = k / 24 * 2 * Math.PI, L = D.entryLink(sel, 0, [rs * Math.cos(th), 0, rs * Math.sin(th)]); if (L.ok) side.ok++; else if (/behind Selene/.test(L.why)) side.behind++; }
  const mute = D.entryLink({ ...sel, ant: 0 }, 0, [0, rs, 0]);
  check('contact gates automation: before onboard computers a burn out of every station\'s view is refused at hand-off and passes unflown if handed over; with onboard computers it flies out of contact',
    refused && passed && blind, `mainframes: "${r && r.refused}"; passed ${passed}; onboard computers: flown ${blind}`);
  check('contact gates automation: around Selene a whip is heard except from behind it; a craft with only a beacon is too far for its radio',
    side.ok > 6 && side.behind > 6 && side.ok + side.behind === 24 && !mute.ok && /too far/.test(mute.why), `24 points round Selene: ${side.ok} heard, ${side.behind} behind it; beacon only: ${mute.why}`);
}

// space-17. The Probe makes its own power (space session as vehicle overflow, QUEUE Q164): body cells on its upper tank
// cover its antenna and camera in low orbit and at Selene, so ten days on rails don't run it flat (before: the core
// battery's 0.5 kWh against 15 W, flat in ~33 h). Unblocks Q27's service gating.
{
  const D = new Function(src + 'return {PRESETS,newShip,powerBudget,powerRails,TELLUS,SELENE,DAY_S,HOOK,set t(v){simT=v}};')();
  D.HOOK.msg = () => {}; D.t = 0;
  const s = D.newShip(D.PRESETS.Probe), lo = D.powerBudget(s), sel = D.powerBudget(s, { body: D.SELENE, r: D.SELENE.R + 100e3 });
  const T = D.TELLUS, a = T.R + 300e3, up = s.parts.filter(p => p.d.kind === 'solar'), ant = s.parts.find(p => p.d.kind === 'ant');
  Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -Math.sqrt(T.mu / a)] });
  let minE = Infinity; for (let k = 0; k < 10 * 24; k++) { D.powerRails(s, D.DAY_S / 24); minE = Math.min(minE, s.E); }
  check('the Probe makes its own power: positive in low orbit and at Selene, never flat over ten days on rails, its cells on the stage it keeps',
    lo.ok && lo.avg > lo.use && sel.ok && up.length === 3 && up.every(p => p.seg === ant.seg) && minE > 0.5 * s.Emax && !s.pwrOut,
    `low orbit ${lo.avg.toFixed(1)} W average vs ${lo.use} W (eclipse ${(lo.ecl * 100).toFixed(0)} %), Selene ${sel.avg.toFixed(1)} W; lowest charge ${(minE / 3.6e3).toFixed(0)} of ${(s.Emax / 3.6e3).toFixed(0)} Wh`);
}

// space-18. Power gates service (space session, QUEUE Q27): a registered satellite keeps its power budget for its orbit and
// its charge. A design with no cells (the Probe before v1.105) runs its battery flat in ~4 days and goes quiet: no
// pictures, no link; one with too few cells works only in sunlight once flat; the powered Probe never runs down.
{
  const D = new Function(src + 'return {PRESETS,newShip,toV2,satRegister,satDuty,advanceDays,entryLink,PROG,HOOK,TELLUS,DAY_S};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, a = T.R + 300e3, vc = Math.sqrt(T.mu / a), OLD = ['ant', 'cam', 'sci', 'core', 't4', 't4', 'petrel', 'istage', 'adapt', 'T32', 'T16', 'fins25', 'albatross'];
  const oneCell = (() => { const d = D.toV2(OLD), f = n => n.k === 't4' ? n : (n.c || []).map(f).find(Boolean); f(d.root).c.push({ k: 'bpanel', at: { y: 2.6, a: 0, n: 1, cy: 0.4 }, c: [] }); return d; })();
  const reg = st => { const s = D.newShip(st); Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, vc * Math.sin(1.4), -vc * Math.cos(1.4)] }); D.satRegister(s, { day0: P.day }); return P.sats.at(-1); };
  Object.assign(P, { sats: [], satN: 0, day: 0, stations: [], active: [], offers: [], decisions: [], dispatch: [], funds: 1000, cycle: 0 }); news.length = 0;
  const dead = reg(OLD), weak = reg(oneCell), good = reg(D.PRESETS.Probe);
  D.advanceDays(3); const d3 = [D.satDuty(dead), D.satDuty(weak), D.satDuty(good)], got3 = dead.got || 0;
  D.advanceDays(9); const d12 = [D.satDuty(dead), D.satDuty(weak), D.satDuty(good)], got12 = dead.got || 0, L = D.entryLink(dead, P.day * D.DAY_S);
  D.advanceDays(30); const gotLate = dead.got || 0;
  check('power gates service: a satellite with no cells runs flat in days and goes quiet (no pictures, no link); one with too few cells works only in sunlight; the powered Probe never runs down',
    d3.every(x => x === 1) && d12[0] === 0 && d12[1] > 0.3 && d12[1] < 0.8 && d12[2] === 1 && got12 > 0 && gotLate === got12 && !L.ok && /flat/.test(L.why)
      && news.some(m => /has gone quiet/.test(m)) && news.some(m => /only in sunlight/.test(m)) && news.some(m => /Its battery lasts about \d+ days; then it goes quiet/.test(m)),
    `day 3: ${d3.map(x => x.toFixed(2)).join(' / ')}; day 12: no cells ${d12[0].toFixed(2)}, one panel ${d12[1].toFixed(2)}, Probe ${d12[2].toFixed(2)}; budgets ${[dead, weak, good].map(q => `${q.pw.avg.toFixed(1)}/${q.pw.use} W`).join(', ')}; link: ${L.why || 'ok'}`);
}

// space-19. Relays as nodes (space session, QUEUE Q173, Q51 slice 3): an entry out of contact reaches home through a
// powered satellite that has a link, one hop, by the link budget (whip to whip ~300 km); a flat relay relays nothing.
// Coverage: a far-side lander on Selene reaches home only through a relay (one polar relay at 1,000 km: ~35 %, test 40's
// figure); the network's links flag a burn mission control can't reach.
{
  const D = new Function(src + 'return {PROG,TELLUS,SELENE,coverOf,netLinks,entryLink,satOn,DAY_S,HOOK};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {};
  const P = D.PROG, T = D.TELLUS, B = D.SELENE; Object.assign(P, { sats: [], day: 0, stations: [], procs: {}, done: {} });
  const ent = o => ({ ant: 1, epoch: 0, shape: [], pending: [], imgs: 0, ...o });
  const moon = (id, alt, inc) => { const r = B.R + alt * 1e3, v = Math.sqrt(B.mu / r); return ent({ id, name: 'Relay ' + id, bodyName: 'Selene', r: [r, 0, 0], v: [0, v * Math.sin(inc), v * Math.cos(inc)] }); };
  const c0 = D.coverOf(B); P.sats.push(moon(1, 1000, 1.4)); P.day = 1; const c1 = D.coverOf(B);
  P.sats[0].pw = { avg: 0, use: 15, ecl: 0.3, cap: 0, need: 1, peak: 0, rtg: 0 }; P.sats[0].Ewh = 0; P.day = 2; const cFlat = D.coverOf(B), offNow = D.satOn(P.sats[0], 2 * D.DAY_S);
  // two Tellus satellites 150 km apart in one polar orbit: the trailing one is out of view while the leading one has the pad
  const a = T.R + 300e3, vc = Math.sqrt(T.mu / a), th = 150e3 / a, tel = (id, f) => ent({ id, name: 'Sat ' + id, r: [a * Math.cos(f), 0, a * Math.sin(f)], v: [-vc * Math.sin(f) * Math.cos(1.4), vc * Math.sin(1.4), vc * Math.cos(f) * Math.cos(1.4)] });
  P.sats = [tel(10, 0), tel(11, th)]; let via = null, viaOff = null;
  for (let t = 0; t < D.DAY_S && !via; t += 30) { const L = D.entryLink(P.sats[1], t); if (L.ok && L.via) via = { t, L }; }
  if (via) { P.sats[0].pw = { avg: 0, use: 15, ecl: 0.3, cap: 0, need: 1, peak: 0, rtg: 0 }; P.sats[0].Ewh = 0; viaOff = D.entryLink(P.sats[1], via.t); delete P.sats[0].pw; }
  const far = ent({ id: 12, name: 'Sat 12', r: [a * 3, 0, 0], v: [0, Math.sqrt(T.mu / (3 * a)), 0] }); P.sats.push(far);   // 3 radii out: no relay reaches it
  let gapT = 0; for (let t = 0; t < D.DAY_S; t += 300) if (!D.entryLink(P.sats[1], t).ok) { gapT = t; break; }
  P.sats[1].nodes = [{ T: gapT, mc: true }]; const NL = D.netLinks(0), n11 = NL.find(x => x.id === 11);
  check('relays as nodes: one hop through a powered satellite with a link (none through a flat one); a far-side lander reaches home only through a relay; a burn in a gap is flagged',
    c0.near === 1 && c0.far === 0 && c1.far > 0.25 && c1.far < 0.5 && cFlat.far === 0 && !offNow && !!via && via.L.via === 'Sat 10' && via.L.rate >= 10 && viaOff && !viaOff.ok
      && n11 && /can't reach it at its burn/.test(n11.flag) && n11.share > 0 && n11.share < 0.3 && NL.length === 3,
    `Selene far side: alone ${c0.far}, one relay ${c1.far.toFixed(2)}, flat ${cFlat.far}; hop: ${via ? `${via.L.via} at ${via.L.rate.toFixed(0)} bit/s` : 'none'}, flat relay ${viaOff && viaOff.ok}; links: ${NL.map(x => `${x.name} ${(x.share * 100).toFixed(0)}% ${x.flag}`).join('; ')}`);
}

// space-20. A revert discards the flight (space session, QUEUE Q257; PLAYTEST #56): the program is back as it was at
// liftoff (no registry entry, no pay, no flight counted, the launch's cost and days given back), and nothing settles it after.
{
  const P = api.PROG, saved = JSON.stringify(P);
  api.t = 0; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.throttle = 1; const pre = JSON.stringify(P), sat0 = (P.sats || []).length;
  api.stage(s); for (let k = 0; k < 40 / api.DT && s.alive; k++) api.advPhys(s);
  const spent = JSON.stringify(P) !== pre, gone = api.missionDiscard(s), later = api.missionEnd(s);
  check('space Q257 #56: a revert discards the flight: the program as it was at liftoff, nothing registered, paid or counted',
    s.rec.launched && spent && gone && s.rec.ended && later === null && JSON.stringify(P) === pre && (P.sats || []).length === sat0,
    `launched ${s.rec.launched}, changed in flight ${spent}, discarded ${gone}, settled after ${later !== null}, program restored ${JSON.stringify(P) === pre}`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// space-21. A rotation's days in space in the Debrief (space session, QUEUE Q214; PLAYTEST #34's follow-up): a crew
// registered aboard keeps the day it went up (shapeOf's `up`), through the registry and back (vesselOf's `crewUp`), so a
// crew brought home from a station counts its days since then, not only this flight's.
{
  const P = api.PROG, saved = JSON.stringify(P); api.HOOK.news = () => {}; api.HOOK.msg = () => {};
  const stack = ['chute', 'crew', 't2'], s0 = api.newShip(stack); P.day = 10;
  const a = api.TELLUS.R + 300e3, q = { stack, shape: api.shapeOf(s0.parts.filter(p => p.on), true), epoch: 0, r: [a, 0, 0], v: [0, Math.sqrt(api.TELLUS.mu / a), 0], qo: [0, 0, 0, 1] }, cap = q.shape.find(o => o.crew);
  P.day = 40; const v = api.vesselOf(q, 40 * api.DAY_S), carried = v.parts.find(p => p.crewAboard);
  const again = api.shapeOf(v.parts.filter(p => p.on), true).find(o => o.crew);   // registered again: still the day they went up
  Object.assign(v.rec, { launched: true, day0: 40, crewed: true, crewOK: true, crewN: 2 }); api.S = v; v.landed = true; v.alive = true; api.t = 2.5 * api.DAY_S;
  const D = api.debriefOf(v, v.rec, []);
  const f = api.newShip(stack); Object.assign(f.rec, { launched: true, day0: 40, crewed: true, crewOK: true, crewN: 2 }); f.landed = true; f.alive = true;
  const Df = api.debriefOf(f, f.rec, []);   // a fresh crew: this flight's days only, as flow-6
  api.t = 0; for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
  check('space Q214: a crew brought home from a station counts its days since it went up; a fresh crew only this flight',
    cap && cap.up === 10 && carried && carried.crewUp === 10 && again && again.up === 10 && D.crew && D.crew.before === 30
      && /^Crew of 2 home safe after 33 days in space$/.test(D.crew.line) && Df.crew && /^Crew of 2 home safe after 2\.5 days$/.test(Df.crew.line),
    `went up day ${cap && cap.up}, carried ${carried && carried.crewUp}, re-registered ${again && again.up}; "${D.crew && D.crew.line}" · fresh "${Df.crew && Df.crew.line}"`);
}

// space-22. Rover science as volumes (space session, QUEUE Q198): a reading is bits (RV_BITS) and goes home at the
// contact's rate, oldest first; an older save's reading (no `b`) goes at once. Own sim instance. Prints the send times.
{
  const D = new Function(src + 'return {geoAt,rvNew,rvSciSend,rvContact,RV_BITS,SELENE,TELLUS,PROG,HOOK,bodyPos,linkRate,P_ROVER,P_RADIO,G_WHIP,G_RVHG,G_STATION,selSci};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {}; const B = D.SELENE, P = D.PROG; P.day = 0; P.sats = []; P.log = {};
  const u = [-1, 0, 0], R = D.rvNew({ name: 'x', ch: 'l', wh: 'm', n: 6, spr: 'S', slots: ['spec', 'cam', 'ant', 'bat', 'sol', null, null, null] }, B, mul(u, B.R), [0, 1, 0], {});
  R.name = 'Vol'; const c = D.rvContact(R, 0, []), S = D.selSci(), n0 = S.panos.length, s0 = (S.spec.mare || []).length + (S.spec.high || []).length;
  const spec = () => ({ k: 'spec', unit: 'mare', T: 0, pf: R.p.slice(), FeO: 15, TiO2: 3, Al2O3: 10, b: D.RV_BITS.spec });
  R.data = [{ k: 'pano', q: 1, el: 10, unit: 'mare', T: 0, b: D.RV_BITS.pano }, spec()];
  const tPano = D.RV_BITS.pano / c.rate, early = D.rvSciSend(R, c, 0.9 * tPano), mid = R.data.length;
  const done = D.rvSciSend(R, c, 0.2 * tPano), got = S.panos.length - n0;
  const old = { k: 'spec', unit: 'mare', T: 0, pf: R.p.slice(), FeO: 15, TiO2: 3, Al2O3: 10 }; R.data = [old]; const instant = D.rvSciSend(R, c, 0);
  const dSel = len(D.bodyPos(B, 0)), whip = Math.min(D.linkRate(D.P_ROVER, D.G_WHIP, D.G_WHIP, 1000e3), D.linkRate(D.P_RADIO, D.G_WHIP, D.G_STATION, dSel));
  check('space Q198: rover readings go home at the link\'s rate, oldest first: a panorama on the high-gain dish in minutes, not at once; old readings at once',
    c.ok && c.rate > 0 && early === 0 && mid === 2 && done === 2 && got === 1 && instant === 1 && tPano > 60 && tPano < 3600,
    `high-gain from the near side ${c.rate.toFixed(0)} bit/s: panorama ${(tPano / 60).toFixed(1)} min, spectrum ${(D.RV_BITS.spec / c.rate).toFixed(0)} s; `
    + `a whip through a relay 1,000 km up: ${whip.toFixed(0)} bit/s, panorama ${(D.RV_BITS.pano / whip / 3600).toFixed(1)} h, spectrum ${(D.RV_BITS.spec / whip / 60).toFixed(1)} min`);
}

// space-23. Landed entries' power and recharging by servicing (space session, QUEUE Q213): a lander on Selene keeps a
// battery through its site's day and night (landPowInit); flat, it works only by day, and a relay it carries with it;
// flying an entry gives it the charge it has now; docking tops up the emptier battery from the fuller one. Own instance.
{
  const D = new Function(src + 'return {newShip,PRESETS,landPowInit,landLit,satOn,satDuty,satPowTick,dockCharge,powCap,powPeak,vesselOf,SELENE,TELLUS,PROG,HOOK,DAY_S};')();
  D.HOOK.news = () => {}; D.HOOK.msg = () => {}; const B = D.SELENE, P = D.PROG; P.sats = [];
  const s = D.newShip(D.PRESETS.Probe); Object.assign(s, { body: B, landed: true, alive: true });
  const q = { landed: true, bodyName: B.name, pf: [-B.R, 0, 0] }; D.landPowInit(s, q, 0); P.sats.push(q);
  const w = q.pw, Pd = 2 * Math.PI / B.n, mean = w ? (w.avg - w.rtg) / w.peak : 0;
  // when is it day there? sample the next lunar day for a noon and a midnight
  let noon = 0, mid = 0, cn = -2, cm = 2; for (let i = 0; i < 96; i++) { const T = i * Pd / 96, c = D.landLit(q, T); if (c > cn) { cn = c; noon = T; } if (c < cm) { cm = c; mid = T; } }
  const full = D.satDuty(q); let days = 0; while (q.Ewh > 0 && days < 60) { D.satPowTick(1); days++; }
  const flat = D.satDuty(q), onNoon = D.satOn(q, noon), onMid = D.satOn(q, mid);
  // flying it: the charge it has now (flat), not what it was registered with
  const a = 6.9e6, o = { stack: s.stack, shape: [], vst: { E: D.powCap(s) }, pw: { avg: 1, use: 2, ecl: .3, cap: 1, need: 1, peak: 1, rtg: 0 }, Ewh: 0, epoch: 0, r: [a, 0, 0], v: [0, 7.6e3, 0], qo: [0, 0, 0, 1] };
  o.shape = s.parts.filter(p => p.on).map(p => ({ k: p.d.key, pos: p.pos.slice(), y0: p.y0, h: p.h, i: p.i, oi: p.i }));
  const v = D.vesselOf(o, 0), flown = v.E;
  // servicing: a full visitor docks with the flat satellite
  const vis = D.newShip(D.PRESETS.Probe); vis.E = D.powCap(vis); v.E = 0; const moved = D.dockCharge(vis, v);
  check('space Q213: a Selene lander runs on its site\'s day and night, flat it works by day only; a flown entry keeps its charge; docking recharges it',
    w && Math.abs(w.ecl - 0.5) < 0.06 && Math.abs(mean - 1 / Math.PI) < 0.03 && full === 1 && days < 60 && flat > 0 && flat < 1 && onNoon && !onMid
      && flown === 0 && moved > 0 && v.E === moved && vis.E >= D.powCap(vis) / 2 - 1,
    `Selene day ${(Pd / 3600).toFixed(0)} h: night ${(w.ecl * 100).toFixed(0)} %, cells give ${(mean * 100).toFixed(0)} % of peak on average; load ${w.use} W vs ${w.avg.toFixed(1)} W; `
    + `flat after ${days} days, then ${(flat * 100).toFixed(0)} % (noon ${onNoon}, midnight ${onMid}); flown with ${flown} J; docking moved ${(moved / 3600).toFixed(0)} Wh`);
}

// space-24. Debris that exists only as you pass (space session, QUEUE Q200): in orbit, a flight rolls the band's
// fragments each step; a hit is scheduled FRAG_LEAD seconds ahead (s.fragIn, HOOK.fragIn) and strikes one part when it
// arrives: cells or an antenna are lost to any piece, the rest only to 40 J/g. Crewed craft get a warning, not a hit.
{
  const D = new Function(src + 'return {newShip,PRESETS,fragPass,fragStrike,breakup,fragBands,partMass,TELLUS,PROG,HOOK,BAND_W,DAY_S,YEAR_D,FRAG_LEAD,get t(){return simT},set t(v){simT=v}};')();
  const msgs = [], seen = []; D.HOOK.msg = m => msgs.push(m); D.HOOK.news = () => {}; D.HOOK.boom = () => {}; D.HOOK.rebuild = () => {}; D.HOOK.fragIn = (s, x) => seen.push(x);
  const P = D.PROG, T = D.TELLUS; P.pressures = { debris: 'real' }; P.frag = null;
  const orbit = (s, h) => { const r = T.R + h; Object.assign(s, { body: T, landed: false, alive: true, r: [r, 0, 0], v: [0, 0, Math.sqrt(T.mu / r)] }); s.rec.launched = true; return s; };
  // the real odds: one 1 t breakup at 400 km, a Probe flying through the thickest band
  D.breakup(400e3, 1000); const s = orbit(D.newShip(D.PRESETS.Probe), 400e3), lam = D.fragPass(s, 0, () => 1), perYear = lam * D.DAY_S * D.YEAR_D;
  // a hit, forced: the roll says yes, then size, angle, speed
  const seq = [0, 0.99, 0.25, 0.5]; let k = 0; D.t = 100; D.fragPass(s, 1, () => seq[k++] ?? 0.5); const x = s.fragIn, coming = !!x && seen.length === 1 && x.at === 100 + D.FRAG_LEAD;
  D.t = 100 + D.FRAG_LEAD - 0.5; D.fragPass(s, 0.5, () => 1); const notYet = !!s.fragIn;
  // when it arrives: aim the roll at the cells, then at the heaviest part (the full 32 t tank: 1.3 GJ to shatter, so a
  // 30 cm piece at 10 km/s, 0.7 GJ, isn't enough; 50 cm is)
  const on = s.parts.filter(p => p.on), w = on.map(p => Math.cbrt(D.partMass(p)) ** 2), W = w.reduce((a, c) => a + c, 0), at = i => (w.slice(0, i).reduce((a, c) => a + c, 0) + w[i] / 2) / W;
  const iSol = on.findIndex(p => p.d.kind === 'solar'), iBig = w.indexOf(Math.max(...w));
  D.t = 100 + D.FRAG_LEAD; D.fragPass(s, 0.5, () => at(iSol)); const solLost = !on[iSol].on, landed = !s.fragIn;
  const dent = D.fragStrike(s, { L: 0.01, m: 1000 * Math.PI / 6 * 1e-6, vr: 10e3 }, () => at(iBig)), bigOK = on[iBig].on && dent && !dent.lost;
  const huge = D.fragStrike(s, { L: 0.5, m: 1000 * Math.PI / 6 * 0.125, vr: 10e3 }, () => at(iBig)), bigLost = huge && huge.lost && !on[iBig].on;
  // crewed: no strike, one warning (the band thickened so the warning applies)
  P.frag[Math.floor(400e3 / D.BAND_W) - 2] *= 1e4; const c = orbit(D.newShip(D.PRESETS.Probe), 400e3); c.rec.crewed = true; const m0 = msgs.length;
  D.fragPass(c, 1, () => 0); D.fragPass(c, 1, () => 0); const warned = msgs.length - m0 === 1 && !c.fragIn;
  D.t = 0; P.frag = null; P.pressures = {};
  check('space Q200: fragments rolled as you pass: seen coming, they strike a part when they arrive (cells to any piece, the rest to 40 J/g); crewed craft are warned',
    perYear > 0 && coming && notYet && solLost && landed && bigOK && bigLost && warned,
    `real odds after a 1 t breakup at 400 km: ${perYear.toExponential(1)} hits a year for the Probe; forced: a ${(x.L * 100).toFixed(0)} cm piece at ${(x.vr / 1e3).toFixed(1)} km/s, `
    + `cells lost ${solLost}, 1 cm on the ${on[iBig].d.name} is not lost (${(dent.E / 1e3).toFixed(0)} kJ), 50 cm destroys it (${(huge.E / 1e9).toFixed(1)} GJ); crewed: "${msgs[m0] || ''}" · ${JSON.stringify({ coming, notYet, solLost, landed, bigOK, bigLost, warned })}`);
}

// space-25. A debris hit that holes a tank or damages a part (space session, QUEUE Q303): a piece that gets through a tank's
// wall leaves a hole that leaks by the orifice law (fuel at 3 bar, gas from 200 bar), its jet pushing and turning the craft;
// a glancing piece only dents; a solar wing loses a string; other parts gather damage until it adds to their loss; a tank
// still leaking at flight end joins the registry empty.
{
  const D = new Function(src + 'return {newShip,PRESETS,fragStrike,leakTick,leakDry,leakRate,partMass,powPeak,TELLUS,HOOK,CAT_E};')();
  const msgs = []; D.HOOK.msg = m => msgs.push(m); D.HOOK.boom = () => {}; D.HOOK.rebuild = () => {};
  const T = D.TELLUS, orbit = s => { const r = T.R + 400e3; Object.assign(s, { body: T, landed: false, alive: true, r: [r, 0, 0], v: [0, 0, Math.sqrt(T.mu / r)], w: [0, 0, 0] }); return s; };
  const piece = (L, vr) => ({ L, m: 1000 * Math.PI / 6 * L ** 3, vr, dir: [0, 0, 1] });
  // aim the part roll at part p, then the remaining rolls in turn
  const aim = (s, p, ...rest) => { const on = s.parts.filter(q => q.on), w = on.map(q => Math.cbrt(D.partMass(q)) ** 2), W = w.reduce((a, c) => a + c, 0), i = on.indexOf(p);
    const seq = [(w.slice(0, i).reduce((a, c) => a + c, 0) + w[i] / 2) / W, ...rest]; let k = 0; return () => seq[k++] ?? 0.5; };
  // a 1 cm piece at 7 km/s, square on, into the full 8 t tank: holed, ~1.15 kg/s of fuel
  const s = orbit(D.newShip(['t8', 'kestrel'])), tank = s.parts.find(p => p.d.kind === 'tank'), eng = s.parts.find(p => p.d.kind === 'engine'), f0 = tank.res.fuel;
  const h = D.fragStrike(s, piece(0.01, 7000), aim(s, tank, 1)), rate = s.leaks && s.leaks.length === 1 ? D.leakRate(tank, 'fuel', s.leaks[0].A) : 0;
  const holed = h && !h.lost && h.hole > 0 && rate > 1 && rate < 1.4 && /holed: fuel leaking/.test(msgs.at(-1));
  // a minute of physics steps: the fuel goes, the jet (~28 N) pushes and turns it
  const v0 = s.v.slice(); for (let i = 0; i < 60; i++) D.leakTick(s, 1, true); const lostKg = (f0 - tank.res.fuel) * 1000, dv = Math.hypot(...s.v.map((x, i) => x - v0[i])), spin = Math.hypot(...s.w);
  const leaks = Math.abs(lostKg - rate * 60) < 0.02 * rate * 60 && dv > 0.5 * rate * 24.5 * 60 / s.mass && dv < 1.5 * rate * 24.5 * 60 / s.mass && spin > 0;
  // on rails it only drains; at flight end it is emptied
  const w1 = s.w.slice(); D.leakTick(s, 600, false); const rails = s.w.every((x, i) => x === w1[i]) && tank.res.fuel < f0;
  D.leakDry(s); const dry = tank.res.fuel === 0 && s.leaks.length === 0;
  // a glancing piece (cos θ 0.1) dents it
  const s2 = orbit(D.newShip(['t8', 'kestrel'])), t2 = s2.parts.find(p => p.d.kind === 'tank'), g = D.fragStrike(s2, piece(0.01, 7000), aim(s2, t2, 0.01)), dent = g && !g.hole && !(s2.leaks || []).length && /dented/.test(msgs.at(-1));
  // gas: a 15 kg bottle at 200 bar through a 1 cm hole: ~2.2 kg/s, falling as it empties
  const s3 = orbit(D.newShip(['t8', 'kestrel'])), b = s3.parts.find(p => p.d.kind === 'tank'); b.res = { gas: 0.015 }; b.cap = { gas: 0.015 };
  D.fragStrike(s3, piece(0.01, 7000), aim(s3, b, 1)); const g0 = D.leakRate(b, 'gas', s3.leaks[0].A); for (let i = 0; i < 50; i++) D.leakTick(s3, 0.1, true); const g1 = D.leakRate(b, 'gas', s3.leaks[0]?.A ?? 0);
  const gas = g0 > 1.8 && g0 < 2.6 && g1 < g0 && Math.hypot(...s3.w) > 0;
  // a solar wing (the Probe's cells) loses a string to a centimetre piece
  const pr = orbit(D.newShip(D.PRESETS.Probe)), sol = pr.parts.find(p => p.d.kind === 'solar'), W0 = D.powPeak(pr);
  const sh = D.fragStrike(pr, piece(0.01, 7000), aim(pr, sol)), W1 = D.powPeak(pr), string = sh && !sh.lost && sol.on && Math.abs(sol.dmg - 0.25) < 1e-9 && W1 < W0 && /string cut/.test(msgs.at(-1));
  // the engine: half its shattering energy damages it, twice loses it
  const Es = D.CAT_E * D.partMass(eng) * 1000, half = vr => Math.cbrt(Es * 0.5 * 2 / (vr * vr) / (1000 * Math.PI / 6)), s4 = orbit(D.newShip(['t8', 'kestrel'])), e4 = s4.parts.find(p => p.d.kind === 'engine');
  const d1 = D.fragStrike(s4, piece(half(7000), 7000), aim(s4, e4)), dmg1 = d1 && !d1.lost && Math.abs(e4.dmg - 0.5) < 0.01 && /damaged \(50 %\)/.test(msgs.at(-1));
  const d2 = D.fragStrike(s4, piece(half(7000) * 1.01, 7000), aim(s4, e4)), dmg2 = d2 && d2.lost && !e4.on;
  check('space Q303: a debris hit holes a tank (it leaks by the orifice law, the jet pushes and turns the craft; empty at flight end), a glancing one dents, cells lose a string, damage adds up to a loss',
    holed && leaks && rails && dry && dent && gas && string && dmg1 && dmg2,
    `1 cm at 7 km/s on the tank: hole ${(h?.hole * 1000).toFixed(1)} mm, ${rate.toFixed(2)} kg/s, ${lostKg.toFixed(0)} kg in 60 s, Δv ${(dv * 1000).toFixed(1)} mm/s, spin ${spin.toExponential(1)} rad/s; `
    + `gas ${g0.toFixed(2)} → ${g1.toFixed(2)} kg/s; cells ${Math.round(W0)} → ${Math.round(W1)} W · ${JSON.stringify({ holed, leaks, rails, dry, dent, gas, string, dmg1, dmg2 })}`);
}

// space-26. A docked composite's power counts its passengers (space session, QUEUE Q304; v1.126's limit): docked, the
// passengers' batteries join the vessel's store with their charge, their loads draw on it, their cells (seen through
// their attitude on the vessel) and RTGs fill it; undocked, the store is split by battery capacity.
{
  const D = new Function(src + 'return {newShip,physStep,contactStep,satRegister,undock,powCap,powLoad,powPeak,powSun,powerBudget,PROG,TELLUS,HOOK,DT,qrot,qmul,qaxis,KWH,get t(){return simT},set t(v){simT=v}};')();
  D.HOOK.msg = () => {}; const T = D.TELLUS, P = D.PROG; Object.assign(P, { day: 0, sats: [], satN: 0 }); D.t = 0;
  // the core docking scene: a battery on the vessel (full), a camera satellite with a battery, body cells and a wing
  const s = D.newShip(['port', 'pod', 'batt', 't1', 'kestrel']), r0 = T.R + 300e3; Object.assign(s, { landed: false, sas: false, throttle: 0, w: [0, 0, 0] });
  s.rec.launched = true; s.rec.day0 = 0; s.q = [0, 0, -Math.SQRT1_2, Math.SQRT1_2]; s.r = [r0, 0, 0]; s.v = [0, 0, -Math.sqrt(T.mu / r0)];
  const Y = D.qrot(s.q, [0, 1, 0]), k = D.newShip(['port', 'batt', 'cam', 'petrel']); k.landed = false; k.rec.launched = true; k.rec.day0 = 0;
  k.q = D.qmul(D.qaxis([0, 0, 1], Math.PI + 3 * Math.PI / 180), s.q); k.r = add(add(s.r, mul(Y, s.yTop + 0.3 + k.yTop)), [0, 0.04, 0]); k.v = s.v.slice(); D.satRegister(k, { day0: 0 });
  const q = P.sats[0]; q.shape.push({ k: 'bpanel', pos: [0, 0, 0], y0: 0, h: 0.8, i: 98, oi: 98 }, { k: 'wpanel', pos: [0, 0, 0], y0: 0, h: 0.6, i: 99, oi: 99, phi: 0 });
  q.vst.dep = [...(q.vst.dep || []), 99]; q.Ewh = 200; const cap0 = D.powCap(s), load0 = D.powLoad(s), peak0 = D.powPeak(s); s.E = cap0;
  s.v = add(s.v, mul(Y, 0.2)); for (let i = 0; i < 300 && !(s.att || []).length; i++) { D.physStep(s, D.DT); D.contactStep(s, D.DT); }
  const a = (s.att || [])[0], K = D.KWH;
  // docked: one store, the passenger's load and cells counted
  const cap1 = D.powCap(s), E1 = s.E, load1 = D.powLoad(s), peak1 = D.powPeak(s), b = D.powerBudget(s);
  const store = a && Math.abs(cap1 - cap0 - 1 * K) < 1 && Math.abs(E1 - cap0 - 200 * 3600) < 1;
  const draws = Math.abs(load1 - load0 - 10) < 1e-9 && Math.abs(peak1 - peak0 - (40 * 0.32 + 300 * 0.9)) < 1e-6 && b.use === load1;
  // the wing sees the sun through the passenger's attitude: edge-on along its arm, square across it
  const wEdge = a ? D.powSun(s, D.qrot(a.q, [1, 0, 0])) : NaN, wSquare = a ? D.powSun(s, D.qrot(a.q, [0, 1, 0])) : NaN;
  const turned = Math.abs(wEdge - 40 * 0.32) < 1e-6 && Math.abs(wSquare - (40 * 0.32 + 270)) < 1e-6;
  // undocked: split by capacity (1 kWh each side, so half each)
  const Et = s.E; D.undock(s, q.id); const split = Math.abs(s.E - Et / 2) < 1 && Math.abs(q.Ewh * 3600 - Et / 2) < 1 && D.powCap(s) === cap0;
  P.sats = []; D.t = 0;
  check('space Q304: docked, the passengers\' batteries, loads and cells count (cells through their attitude on the vessel); undocked, the store is split by capacity',
    store && draws && turned && split,
    `vessel ${(cap0 / K).toFixed(1)} kWh full + passenger 1 kWh at 0.2: ${(cap1 / K).toFixed(1)} kWh, ${(E1 / K).toFixed(2)} kWh stored; load ${load0} → ${load1} W; peak ${peak0.toFixed(0)} → ${peak1.toFixed(0)} W; `
    + `the wing edge-on ${wEdge.toFixed(0)} W, square ${wSquare.toFixed(0)} W; undocked ${(s.E / K).toFixed(2)} + ${(q.Ewh / 1000).toFixed(2)} kWh · ${JSON.stringify({ docked: !!a, store, draws, turned, split })}`);
}
