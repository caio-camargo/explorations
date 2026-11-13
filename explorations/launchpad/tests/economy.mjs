// tests/economy.mjs — test sections: economy. Not a module on its own: shards.mjs splices every file in tests/ (in the
// order of TEST_FILES) between test.mjs's prelude (the SIM as `api`, `check`) and its summary, and runs that as one module.
// Add a section at the end of your lane's file: "// <lane>-<n>. Title" at column 0, then a { block }. NOTES § "Test shards".

// econ-1. A failed attempt at the next step is mostly covered (economy session, QUEUE W12 / Q44): a flight on the priciest
// rocket yet that comes to nothing gets 75 % of its loss back from the sponsor, once per epoch (the newest one with firsts
// open). Retries, cheaper losses and flights that earned something are not covered. Own SIM copy, like §37.
{
  const D = new Function(src + 'return {coverLoss,COVER,PROG,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, cert: {}, kh: {}, lines: {}, own: null, decisions: [], active: [], offers: [], fac: {},
    done: { weather: { flight: 1 }, loads: { flight: 2 } }, flights: 5, recs: { maxCost: 30 } });
  D.chooseStart('agency');
  const lose = (cost, refund = 0) => D.coverLoss({}, { cost, refund, cdone: [] });
  P.funds = 0; const x1 = lose(80), f1 = P.funds, ep = Object.keys(P.recs.cover || {});
  check('cover: the first lost flight on the priciest rocket yet gets 75 % back, keyed to the newest open epoch (2: beeper, hop)',
    Math.abs(x1 - 0.75 * 80) < 1e-9 && Math.abs(f1 - 60) < 1e-9 && ep.join() === '2' && /cover/.test(news.at(-1) || ''), `${x1} back, epochs ${ep}`);
  P.flights = 6; const x2 = lose(95);
  check('cover: once per epoch (a second, pricier loss in epoch 2 gets nothing)', x2 === 0);
  P.recs = { maxCost: 100 }; P.flights = 7; const x3 = lose(80);
  check('cover: a loss on a rocket cheaper than one flown before is not covered', x3 === 0);
  P.recs = { maxCost: 30 }; const x4 = lose(80, 30);
  check('cover: a flight that came home for refurbishment (a quarter or more back) is not a loss', x4 === 0);
  P.recs = { maxCost: 30 }; P.flights = 8; P.done.hop = { flight: 8 }; const x5 = lose(80); delete P.done.hop;
  check('cover: a flight that completed a first is not covered', x5 === 0);
  P.recs = { maxCost: 30 }; const x6 = D.coverLoss({}, { cost: 80, refund: 0, cdone: ['a contract'] });
  check('cover: a flight that completed a contract is not covered', x6 === 0);
  P.recs = { maxCost: 30 }; P.flights = 9; const x7 = D.coverLoss({}, { cost: 80, refund: 0, cdone: [], orbit: true });
  check('cover: a rocket that reached orbit worked, even with nothing completed: no cover (PLAYTEST #33)', x7 === 0);
  const H = html.replace(/\r\n/g, '\n');
  const SCH = new Function(src + 'return PROG_SCHEMA;')();   // (R1b) a new game is programNew, built from the table
  check('cover: kept in PROG.recs, which a new game resets', H.length > 0 && JSON.stringify(SCH.recs.slice(0, 2)) === '[{},"career"]');
}

// econ-2. Who may launch where (economy session, QUEUE Q6): siteAccess(site) → {ok, why, fee}. Our sites free; a sea
// platform a service fee; a consortium member's site shared; others leased (cheaper with better relations), refused under
// sanctions or hostile relations. Launch charges the fee and records R.site / R.siteFee; the debrief lists it.
{
  const D = new Function(src + 'return {siteAccess,siteAccessOf,LEASE,SEA_FEE,SITES,PROG,HOOK,POWERS,pairKey,newShip,missionTick,debriefOf,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart,set t(v){simT=v}};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, kh: {}, lines: {}, own: null, decisions: [], active: [], offers: [], fac: {},
    done: {}, flights: 0, recs: {}, atm: {}, stand: {}, studies: {}, studyQ: [] });
  D.chooseStart('agency');
  const home = D.SITES.find(t => t.power === 0), abroad = D.SITES.find(t => t.power != null && t.power !== 0 && t.kind !== 'sea'), sea = D.SITES.find(t => t.kind === 'sea');
  const k = abroad && D.pairKey(0, abroad.power), at = r => { P.rel[k] = r; return D.siteAccess(abroad); };
  const h = D.siteAccess(home), good = at(0.8), cool = at(0), bad = at(-0.5);
  check('sites: ours are free; abroad is leased, cheaper with better relations; hostile relations refuse', h.ok && h.fee === 0 && abroad && good.ok && cool.ok && good.fee < cool.fee && cool.fee === D.LEASE && !bad.ok && /relations/.test(bad.why),
    `${abroad && abroad.name}: rel 0.8 → ${good.fee}M, 0 → ${cool.fee}M, −0.5 → ${bad.why}`);
  P.rel[k] = 0.5; P.sanc = { [abroad.power]: P.day + 30 }; const sx = D.siteAccess(abroad); P.sanc = {};
  check('sites: a power that sanctions the program closes its sites', !sx.ok && /sanctions/.test(sx.why), sx.why);
  P.own = { kind: 'consortium', st: { 0: 0.4, [abroad.power]: 0.3 }, pv: 0, chosen: true, debt: 0 }; const mem = D.siteAccess(abroad); D.chooseStart('agency');
  check('sites: a consortium member\'s site is shared, free', mem.ok && mem.fee === 0);
  const sv = sea ? D.siteAccess(sea) : { ok: true, fee: D.SEA_FEE };
  check('sites: a sea platform is open to all, for a service fee', sv.ok && sv.fee === D.SEA_FEE && D.siteAccessOf(abroad).fee === D.siteAccess(abroad).fee);
  P.rel[k] = 0; P.funds = 500; const s = D.newShip(['chute', 'sci', 't1', 'fins', 'sparrow'], abroad); D.t = 0; s.landed = false; D.missionTick(s, 0, false);
  const R = s.rec, spent = 500 - P.funds;
  check('sites: launch charges the lease with hardware and operations, and records the site', R.site === abroad.id && R.siteFee === D.LEASE && Math.abs(spent - (R.cost + R.ops + R.siteFee)) < 1e-6,
    `site ${R.site}, fee ${R.siteFee}, spent ${spent.toFixed(1)}`);
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('sites: the debrief lists the lease; the builder\'s budget check and picker include the fee', H.includes("add('Site lease',-(R.siteFee||0)") && /const fee=siteAccessOf\(curSite\(\)\)\.fee/.test(pg) && pg.includes('a launch`'));
}

// econ-3. The ballistic test's target from the program's site (economy session, QUEUE Q7): the target lies 300–900 km
// downrange of the site the program flies from (true distances, not the old 600 km-radius radians from +X), at sea, and
// the test counts only when flown from that site. Contracts saved before Q7 (no p.site) count from anywhere.
{
  const D = new Function(src + 'return {CT,SITES,PROG,HOOK,TELLUS,curSite,isLand,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 0, rel: {}, op: {}, sanc: {}, done: {}, own: null, decisions: [], site: null }); D.chooseStart('agency');
  const B = D.CT.ballistic, km = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * D.TELLUS.R / 1e3;
  const far = D.SITES.find(t => t.kind !== 'sea' && km(t.u, D.SITES[0].u) > 1000) || D.SITES[1];
  let okAll = true, worst = 0; const R = D.rng(77);
  for (const t of [D.SITES[0], far]) { P.site = t.id; for (let i = 0; i < 20; i++) { const p = B.gen(R); if (!p) continue; const d = km(p.u, t.u);
    worst = Math.max(worst, Math.abs(d - p.rg)); okAll = okAll && p.site === t.id && !D.isLand(p.u) && d >= 299 && d <= 901 && Math.abs(d - p.rg) < 1; } }
  check('ballistic: the target is at sea, its stated distance downrange of the program\'s current site', okAll, `worst distance error ${worst.toFixed(2)} km; second site ${far.name}`);
  P.site = D.SITES[0].id; const p = B.gen(D.rng(5)), at = p.u.map(x => x * D.TELLUS.R);
  check('ballistic: counts on target from its own site, not from another, and the brief names the site',
    B.ok({ endPf: at, endSci: true, site: p.site }, p) && !B.ok({ endPf: at, endSci: true, site: far.id }, p) && B.brief(p).includes(p.sname));
  const old = { u: p.u, rg: p.rg, rad: 40 };
  check('ballistic: a contract saved before Q7 (no site) still counts from anywhere', B.ok({ endPf: at, endSci: true, site: far.id }, old));
}

// econ-4. Every offer says why it appeared (economy session, QUEUE Q45): whyOf picks the strongest true reason (a first
// that opened the type, tension, the business cycle, tourism standing, home government, the client's priorities, our
// standing, else routine) when the offer is made; the Contracts tab shows it.
{
  const D = new Function(src + 'return {whyOf,genOffer,econTick,ensureBoard,PROG,HOOK,POWERS,pairKey,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 200, rel: {}, op: {}, sanc: {}, stand: {}, done: { weather: { day: 10 } }, own: null, decisions: [], cycle: 0, offers: null, active: [], cdone: 0, flights: 3, wseed: 99 });
  D.chooseStart('agency');
  const other = D.POWERS.find(p => p.i !== 0).i;
  P.done.beeper = { day: 180 }; const fresh = D.whyOf('sat', 'com', other); P.done.beeper.day = 50; const stale = D.whyOf('sat', 'com', other);
  check('why: a type opened by a recent first says so; after 60 days it no longer does', /New since you did “The beeper”/.test(fresh) && !/New since/.test(stale), `${fresh} / ${stale}`);
  for (const p of D.POWERS) if (p.i !== other) P.rel[D.pairKey(other, p.i)] = -0.8; const tense = D.whyOf('ballistic', 'mil', other); P.rel = {};
  P.cycle = 0.6; const boom = D.whyOf('test', 'com', other); P.cycle = -0.6; const rec = D.whyOf('test', 'com', other); P.cycle = 0;
  check('why: tension for military work, the cycle for commercial work', /nervous/.test(tense) && /Boom/.test(boom) && /recession/.test(rec), `${tense} · ${boom} · ${rec}`);
  const gov = D.whyOf('landing', 'gov', 0), plain = D.whyOf('apex', 'sci', other);
  P.stand = { sci: 85 }; const st = D.whyOf('apex', 'sci', other); P.stand = {};
  check('why: home government, then the client\'s priorities or our standing, else routine work', /government/.test(gov) && /(cares about|standing|Routine)/.test(plain) && /(cares about|standing \(85\))/.test(st), `${gov} · ${plain} · ${st}`);
  P.offers = null; D.ensureBoard(); for (let k = 0; k < 20; k++) { P.day += 10; D.econTick(10, D.rng(k + 1)); }
  const ws = P.offers.map(o => o.why);
  check('why: every offer on a real board carries a one-line reason', ws.length > 0 && ws.every(w => typeof w === 'string' && w.length > 5 && w.length < 80 && !w.includes('\n')), ws.join(' | '));
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('why: the Contracts tab shows it, as the tooltip on its name (Q603)', pg.includes('title="${c.why}"') && pg.includes('<b${tip(c)}>${cTitle(c)}</b>'));
}

// econ-5. Dry runs as the trajectory office's study (economy session, QUEUE Q46): dryQuote prices it like a study (era,
// centre, procedures tried); orderDryRun pays, lets the days pass, runs procAdopt and keeps the measured margin; a
// provisional procedure's estimate is PROV_UNC wider and uses that margin; the dispatch line offers it for the design
// in Assembly when nothing stored can fly the contract.
{
  const P = api.PROG, saved = JSON.stringify(P), st = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], heavy = ['sci', 't1', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], hk = api.procKey(heavy);
  api.HOOK.news = () => {}; api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  P.procs = {}; P.done = { beeper: { flight: 0, day: 0 } }; P.funds = 1e6; handAscent(api, st);
  const c = { id: 931, type: 'sat', src: 'com', client: 0, p: { alt: 160, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 }; P.active = [c];
  const line0 = api.dispatchLine(c, heavy), q = api.dryQuote(heavy), qOwn = api.dryQuote(st), qNone = api.dryQuote(null);
  check('dry run: priced like a study (days and money), refused for a design with its own procedure or no design', q.ok && q.n === 1 && q.cost > 0 && q.days > 0 && !qOwn.ok && !qNone.ok, `${q.days} d, ${q.cost}M; own: ${qOwn.why}`);
  P.funds = q.cost - 0.1; const poor = api.orderDryRun(heavy), none = !P.procs[hk]; P.funds = 1e6;
  const d0 = P.day, r = api.orderDryRun(heavy), pr = P.procs[hk];
  check('dry run: ordering it pays, lets its days pass, and adopts the procedure with the measured margin kept',
    !poor.ok && none && r.ok && r.cost === q.cost && pr && pr.prov && Math.abs(pr.margin - r.margin) < 1e-9 && Math.abs(P.day - d0 - q.days) < 1e-6 && !api.dryQuote(heavy).ok,
    `${r.ok ? `${r.margin.toFixed(0)} m/s to spare` : r.why}; ${(P.day - d0).toFixed(1)} d, ${r.cost}M; short of money: ${poor.why}`);
  const e1 = api.dispatchEstimate(heavy, c); pr.prov = false; const e2 = api.dispatchEstimate(heavy, c); pr.prov = true;
  const m0 = pr.margin; pr.margin = m0 + 500; const e3 = api.dispatchEstimate(heavy, c); pr.margin = m0;
  check('dry run: a provisional procedure\'s estimate is wider, and its margin is the measured one', e1.ok && e2.ok && (e1.hi - e1.lo) > (e2.hi - e2.lo) && Math.abs(e3.margin - e1.margin - 500) < 1e-6,
    `${Math.round(e1.lo * 100)}–${Math.round(e1.hi * 100)}% vs ${Math.round(e2.lo * 100)}–${Math.round(e2.hi * 100)}% if it were its own`);
  P.procs = {}; const lineNo = api.dispatchLine(c, heavy);
  check('dry run: the contract\'s dispatch line offers it for the design in Assembly (which has no procedure)', /data-dry="931"/.test(line0) && /Dispatch /.test(line0), line0.replace(/<[^>]+>/g, ' ').slice(0, 160));
  check('dry run: …and not when there is no stored procedure to try', !/data-dry/.test(lineNo));
  Object.keys(P).forEach(k => delete P[k]); Object.assign(P, JSON.parse(saved));
}

// econ-6. Rover part prices and gates; Selene science contracts (economy session, QUEUE Q10). A packed rover's price is
// its parts'; a rocket can't carry a rover with a part not yet open (the yard is free). The R4 contracts are judged
// between flights on science received since they were taken.
{
  const D = new Function(src + 'return {rvPrice,rvLocked,rvLaunchWhy,rvPartOpen,rvDefault,partPrice,PARTS,CT,selN,selSci,selTick,sciGot,genOffer,acceptOffer,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, stand: {}, done: {}, own: null, decisions: [], offers: [], active: [], back: [], cdone: 0, flights: 3, kh: {}, sel: null }); D.chooseStart('agency');
  const apollo = D.rvDefault(), basic = { name: 'Yard cart', ch: 's', wh: 's', n: 4, slots: ['bat', 'cam', null] };
  const part = d => ({ d: D.PARTS.rvdeck, dn: { rvd: d } }), bare = D.partPrice({ d: D.PARTS.rvdeck, dn: {} });
  check('rovers: a packed rover costs its parts (the default two-seater 24M), on top of the deck', D.rvPrice(apollo) === 24 && Math.abs(D.partPrice(part(apollo)) - bare - 24) < 1e-9 && D.rvPrice(basic) === 9,
    `two-seater ${D.rvPrice(apollo)}M, yard cart ${D.rvPrice(basic)}M, deck ${bare}M`);
  const lk0 = D.rvLocked(apollo).map(x => x.k).join(), why0 = D.rvLaunchWhy([part(apollo)]), cart = D.rvLaunchWhy([part(basic)]);
  P.done = { farside: { day: 1 }, orbiter: { day: 1 } }; const lk1 = D.rvLocked(apollo).length, why1 = D.rvLaunchWhy([part(apollo)]);
  check('rovers: parts open with firsts; a rocket can\'t carry a rover with a locked part; the basic cart flies from the start',
    lk0 === 'm,m,seat' && /can't fly yet/.test(why0) && /The far side/.test(why0) && cart === '' && lk1 === 0 && why1 === '', `locked at start: ${lk0} · ${why0}`);
  P.done.selland = { day: 1 }; P.sel = null; const S = D.selSci();
  const mk = (type, p) => { const c = { id: 900 + P.active.length, type, src: 'sci', client: 0, p: { ...p }, deadline: P.day + 300 }; c.base = D.selN(); P.active.push(c); return c; };
  D.sciGot({ k: 'spec', unit: 'mare', FeO: 10, TiO2: 2, Al2O3: 10, pf: [-1, 0, 0] }, 'R');   // one from before: doesn't count
  const read = mk('selRead', { unit: 'mare', n: 2, pay: 50 }), pano = mk('selPano', { q: 0.8, pay: 60 }), far = mk('selFar', { n: 1, pay: 90 });
  D.sciGot({ k: 'spec', unit: 'mare', FeO: 11, TiO2: 3, Al2O3: 10, pf: [-1, 0, 0] }, 'R'); D.sciGot({ k: 'pano', q: 0.7, el: 30, unit: 'mare' }, 'R'); const f0 = P.funds; D.selTick(); const after1 = P.active.length, f1 = P.funds;
  D.sciGot({ k: 'spec', unit: 'mare', FeO: 12, TiO2: 3, Al2O3: 10, pf: [1, 0, 0] }, 'R'); D.sciGot({ k: 'pano', q: 0.85, el: 10, unit: 'high' }, 'R'); D.selTick();
  check('Selene contracts: readings, a good enough panorama and far-side science complete between flights, not before they arrive',
    after1 === 3 && f1 === f0 && !P.active.includes(read) && !P.active.includes(pano) && !P.active.includes(far) && P.funds > f0 && D.selN().far === 1, `paid ${(P.funds - f0).toFixed(0)}M; after the first results ${after1} open; left ${P.active.map(c => c.type).join(',') || 'none'}`);
  const types = () => { const seen = new Set(); const R = D.rng(3); for (let k = 0; k < 300; k++) { const o = D.genOffer('sci', R); if (o) seen.add(o.type); } return seen; };
  const t0 = types(); S.seis = [{ id: 1 }, { id: 2 }, { id: 3 }]; const t1 = types();
  check('Selene contracts: located quakes are offered only once three stations stand; the network only while it has fewer than four',
    !t0.has('selQuake') && t0.has('selSeis') && t0.has('selRead') && t1.has('selQuake') && !t1.has('selCore'), `${[...t1].filter(x => x.startsWith('sel')).join(', ')}`);
}

// econ-7. Dispatch to a base (economy session, QUEUE Q61): a supply run flies the design's ascent procedure, then a
// transfer, capture and landing at the base's beacon (landAt); the lander is registered there and joins the base.
// Repeats only: refused before the body's landing first and for a design with no ascent procedure.
{
  const P = api.PROG, saved = JSON.stringify(P), st = api.PRESETS.Probe, B = api.BODIES.find(b => b.name === 'Selene');
  api.HOOK.news = () => {}; api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  P.procs = {}; P.done = { beeper: { flight: 0, day: 0 } }; P.funds = 1e6; handAscent(api, st);
  const site = siteOf(api, B, 20, 15), base = { id: 777, landed: true, beacon: true, bodyName: 'Selene', pf: site.map(x => x * B.R), ql: [0, 0, 0, 1], name: 'Selene Base 1', shape: [], born: 0, imgs: 0, pending: [] };
  P.sats = [base]; P.satN = 777; P.dispatch = []; P.day = 10;
  P.done.selland = { flight: 0, day: 0 }; const handEra = api.baseRunQuote(base, st); while (api.compEra() < 2 && P.day < 40000) P.day += 100;   // D7: onboard computers
  delete P.done.selland; const early = api.baseRunQuote(base, st); P.done.selland = { flight: 0, day: 0 }; const none = api.baseRunQuote(base, ['sci', 't8', 'kestrel']), q = api.baseRunQuote(base, st);
  check('supply run: refused before onboard computers (the automation ladder, D7)', !handEra.ok && /onboard computers/.test(handEra.why), `${handEra.why}; onboard computers from day ${P.day}`);
  check('supply run: refused before the landing first and for a design with no ascent procedure; quoted otherwise', !early.ok && /by hand first/.test(early.why) && !none.ok && q.ok && q.cost > 0,
    `${early.why} · ${none.why} · ${q.ok ? `${q.cost.toFixed(0)}M, launch day ${q.launch.toFixed(0)}` : q.why}`);
  { const w = q.win, lit = api.dot(api.norm(api.fromPF(B, base.pf, (q.launch + q.rule.lead) * api.DAY_S)), api.SUN_DIR);   // Q185: the run lands in daylight
    check('supply run: launches at its window, so it arrives in daylight at the base (MIDGAME § Windows)', q.rule.k === 'light' && w && lit > 0 && q.launch >= q.start + q.prep - 1e-9, `waits ${w ? w.wait.toFixed(2) : '?'} d; sun ${(Math.asin(lit) * 57.3).toFixed(0)}° up on arrival`); }
  const line = api.baseRunLine(base, st), r = api.orderBaseRun(base, st), D = P.dispatch[0];
  for (let k = 0; k < 8 && D.status === 'queued'; k++) { P.day = D.launch; api.dispatchTick(); }
  const lander = api.landedUp().find(x => x.id !== 777), b = api.baseOf(base);
  check('supply run: the Probe lands at the beacon and joins the base', /data-baserun="777"/.test(line) && r.ok && D.status === 'done' && lander && b && b.members.length === 2,
    `${D.status}${D.why ? ': ' + D.why : ''}; ${lander ? `${lander.name}, ${(Math.acos(Math.min(1, api.dot(api.norm(lander.pf), site))) * B.R).toFixed(0)} m from the beacon` : 'nothing landed'}; base of ${b ? b.members.length : 0}`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// econ-8. Staged pay only for a mission open when the flight launched (economy session, QUEUE Q112 / PLAYTEST #28): a
// probe parked at Nyx used to collect the first two shares of every Nyx mission as each one unlocked.
{
  const D = new Function(src + 'return {stagedTick,MISSIONS,NYX,PROG,HOOK,recNew,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 5, staged: {},
    done: Object.fromEntries(['weather', 'beeper', 'farside', 'nyxfind'].map(k => [k, { flight: 1, day: 1 }])) }); D.chooseStart('agency');
  const R = D.recNew(); R.paid = []; R.open0 = D.MISSIONS.filter(M => !P.done[M.id] && (M.req || []).every(r => P.done[r])).map(M => M.id);
  const s = { alive: true, landed: false, body: D.NYX }, f0 = P.funds;
  D.stagedTick(s, R); const fly = P.staged.nyxfly || {}, f1 = P.funds;
  P.done.nyxfly = { flight: 6, day: 120 }; P.done.nyxorb = { flight: 6, day: 121 }; D.stagedTick(s, R);
  const land = P.staged.nyxland || {};
  check('staged pay: the flyby launched for pays its shares; Landing on Nyx, opened mid-flight, pays nothing to the same probe',
    fly.bound && fly.arrive && f1 > f0 && !land.bound && !land.arrive && P.funds === f1, `flyby +${(f1 - f0).toFixed(0)}M; after the orbit opened the landing: +${(P.funds - f1).toFixed(0)}M`);
  const R2 = D.recNew(); R2.paid = []; R2.open0 = ['nyxland']; D.stagedTick(s, R2);
  check('staged pay: a flight launched after it opened does collect', (P.staged.nyxland || {}).bound && P.funds > f1);
}

// econ-9. Pay floors and withdrawing (economy session, QUEUE Q93 / Q118): every offer pays at least 1.3× the net cost of
// the cheapest preset that can fly it, whatever the world; a taken contract can be withdrawn at a missed deadline's cost.
{
  const D = new Function(src + 'return {genOffer,payFloor,withdrawContract,standOf,opOf,CT,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'frugal', day: 50, rel: {}, op: {}, sanc: {}, stand: { sci: 10, com: 10 }, cycle: -0.9, done: { weather: { day: 1 }, loads: { day: 1 }, hop: { day: 1 }, beeper: { day: 1 } },
    own: null, decisions: [], offers: [], active: [], back: [], flights: 3 }); D.chooseStart('company');
  const R = D.rng(11); let n = 0, low = []; for (let k = 0; k < 400; k++) for (const src of ['sci', 'com', 'gov', 'tour', 'mil']) { const o = D.genOffer(src, R); if (!o) continue; n++; const f = D.payFloor(o.type); if (o.p.pay < f - 1e-9) low.push(`${o.type} ${o.p.pay} < ${f}`); }
  check('pay floor: in a frugal world, low standing and a deep recession, no offer pays under its floor', n > 500 && !low.length && D.payFloor('apex') > 10 && D.payFloor('sat') > D.payFloor('apex'),
    `${n} offers; floors: sounding ${D.payFloor('apex')}M, test ${D.payFloor('test')}M, hop ${D.payFloor('bioHop')}M, satellite ${D.payFloor('sat')}M${low.length ? '; under: ' + low.slice(0, 3).join(', ') : ''}`);
  const c = { id: 501, type: 'apex', src: 'sci', client: 1, p: { lo: 20, hi: 30, pay: 15, dur: 100 }, deadline: P.day + 100 }; P.active = [c];
  const s0 = D.standOf('sci'), o0 = D.opOf(1), ok = D.withdrawContract(501), again = D.withdrawContract(501);
  check("withdraw: frees the slot at once, at a missed deadline's cost: a wait, no standing or opinion lost (Q295)", ok && !again && P.active.length === 0 && D.standOf('sci') === s0 && D.opOf(1) === o0 && (P.back || []).some(b => b.c.id === 501),
    `standing ${s0} → ${D.standOf('sci')}, opinion ${o0.toFixed(1)} → ${D.opOf(1).toFixed(1)}`);
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('withdraw: taken contracts show the button', pg.includes('data-wd="${c.id}"') && pg.includes('withdrawContract(+ds.wd)'));
}

// econ-10. Dispatched flights launch from their procedure's site and pay its lease (economy session, QUEUE Q95).
{
  const D = new Function(src + 'return {dispatchQuote,dispatchSite,baseRunQuote,siteAccess,procKey,SITES,PROG,HOOK,pairKey,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, kh: {}, lines: {}, own: null, decisions: [], active: [], offers: [], fac: {}, dispatch: [],
    done: { weather: { flight: 0, day: 0 }, loads: { flight: 0, day: 0 }, beeper: { flight: 0, day: 0 } }, flights: 3, funds: 2000 }); D.chooseStart('agency');
  const st = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], key = D.procKey(st), abroad = D.SITES.find(t => t.power != null && t.power !== 0 && t.kind !== 'sea');
  const c = { id: 941, type: 'sat', src: 'com', client: 0, p: { alt: 160, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 };
  P.procs = { [key]: { kind: 'orbit', dv: 4300, target: { pe: 160e3, ap: 160e3 }, site: null } }; const qHome = D.dispatchQuote(c, st);
  P.procs[key].site = abroad.id; P.rel[D.pairKey(0, abroad.power)] = 0; const qAbroad = D.dispatchQuote(c, st), fee = D.siteAccess(abroad).fee;
  P.rel[D.pairKey(0, abroad.power)] = -0.8; const qBad = D.dispatchQuote(c, st);
  check('dispatch abroad: launches from the procedure\'s site, its lease on the price; refused when the site is closed to us',
    qHome.ok && qHome.fee === 0 && qAbroad.ok && qAbroad.site === abroad.id && Math.abs(qAbroad.cost - qHome.cost - fee) < 1e-9 && fee > 0 && !qBad.ok && /relations/.test(qBad.why),
    `home ${qHome.cost.toFixed(1)}M · ${abroad.name} ${qAbroad.cost.toFixed(1)}M (lease ${fee}M) · hostile: ${qBad.why}`);
}

// econ-11. Obsolescence and servicing (economy session, QUEUE Q126, MIDGAME.md § Satellites): a satellite earns less
// for each computing era it falls behind; servicing a valuable one (a contract completed by docking with it) brings it
// up to date.
{
  const D = new Function(src + 'return {satQual,satEra,obsTick,serviceTarget,genOffer,contractEval,compEra,CT,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, stand: {}, done: { beeper: { day: 1 } }, own: null, decisions: [], offers: [], active: [], back: [], flights: 3, cdone: 0 }); D.chooseStart('agency');
  const tv = { id: 31, name: 'TV 1', ant: 1, r: [7e6, 0, 0], v: [0, 7e3, 0], epoch: 0, tvOn: true, pending: [], imgs: 0 }, cam = { id: 32, name: 'Eye 1', cam: 1, ant: 1, contact: 0.1, r: [7e6, 0, 0], v: [0, 7e3, 0], epoch: 0, pending: [], imgs: 0 };
  P.sats = [tv, cam]; const e0 = D.compEra(); D.obsTick(); const q0 = D.satQual(tv);
  while (D.compEra() < e0 + 1 && P.day < 20000) P.day += 50; news.length = 0; D.obsTick(); D.obsTick(); const q1 = D.satQual(tv), n1 = news.filter(t => /generation/.test(t)).length;
  check('obsolescence: a satellite earns in full in its own era, 74 % one era behind; the news says so once per satellite', q0 === 1 && Math.abs(q1 - 1 / 1.35) < 1e-9 && n1 === 2,
    `era ${e0} → ${D.compEra()} on day ${P.day}: ${Math.round(q1 * 100)} %, ${n1} news`);
  const tgt = D.serviceTarget();
  check('servicing: offered for a valuable satellite that has fallen behind (TV in view), not a poorly placed imager', tgt === tv);
  const c = { id: 961, type: 'service', src: 'gov', client: 0, p: D.CT.service.gen(D.rng(1)), deadline: P.day + 300 }; P.active = [c];
  const R = { cdone: [], paid: [] }, f0 = P.funds; D.contractEval({ rec: R, att: [] }); const before = P.active.length;
  D.contractEval({ rec: R, att: [{ e: tv }] });
  check('servicing: a flight docked with it completes the contract, and the satellite is up to date again', before === 1 && P.active.length === 0 && P.funds > f0 && D.satEra(tv) === D.compEra() && D.satQual(tv) === 1 && !D.serviceTarget(),
    `paid ${(P.funds - f0).toFixed(0)}M; ${c.p.name}, ${c.p.n} era behind`);
}

// econ-12. A mission counts only on a flight launched while it was open (economy session, W11 defaulted; QUEUE Q113 /
// PLAYTEST #29): chained firsts no longer complete together (a 2 t flight earned Heavy Lift I and II; the tracking flight
// that weighs Nyx earned the flyby too). The flight's launch record lists what was open (R.open0, v1.74).
{
  const D = new Function(src + 'return {missionEval,recNew,MISSIONS,PROG,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 50, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 4, cdone: 0, staged: {},
    done: { weather: { flight: 1, day: 1 }, beeper: { flight: 2, day: 2 } } }); D.chooseStart('agency');
  const open = () => D.MISSIONS.filter(M => !P.done[M.id] && (M.req || []).every(r => P.done[r])).map(M => M.id);
  const R = D.recNew(); R.open0 = open(); Object.assign(R, { orbit: true, lift: 2, orb: { pe: 150e3, ap: 160e3, inc: 0 }, paid: [] });
  D.missionEval({ rec: R, parts: [] }); D.missionEval({ rec: R, parts: [] });
  const one = !!P.done.lift1 && !P.done.lift2;
  const R2 = D.recNew(); R2.open0 = open(); Object.assign(R2, { orbit: true, lift: 2, orb: R.orb, paid: [] }); D.missionEval({ rec: R2, parts: [] });
  check('W11: a 2 t flight launched with only Heavy Lift I open earns that one; the next flight earns Heavy Lift II', one && !!P.done.lift2, `after the first flight: lift1 ${!!P.done.lift1}, lift2 ${one ? 'not yet' : 'too'}`);
}

// econ-13. Powers as content (economy session, QUEUE Q103, POWERS.md): a hardware school per power from its archetype's
// affinities (the same draw the look lane's schoolOf used, now read from POWERS), names from the school's syllables and
// the archetype's forms of government, sites named after them; rivals' news by archetype.
{
  const D = new Function(src + 'return {POWERS,SITES,SCHOOLS,ARCH_FORMS,RIVAL_WIN,raceTick,MISSIONS,PROG,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},get RIVALS(){return RIVALS},set RIVALS(v){RIVALS=v},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const W = D.POWERS, sup = W.filter(p => /Super$/.test(p.arch)), roots = W.map(p => p.root);
  const formOk = p => D.ARCH_FORMS[p.arch].some(f => f.replace('#', p.root) === p.name);
  check('powers: every power has a school (a resource state its contractor\'s), the superpowers\' differ, names unique and in their archetype\'s forms',
    W.every(p => D.SCHOOLS[p.school]) && sup.length === 2 && sup[0].school !== sup[1].school && new Set(roots).size === roots.length && W.every(formOk)
    && W.filter(p => p.arch === 'resource').every(p => p.contractor != null && W[p.contractor].school === p.school),
    W.map(p => `${p.name} (${p.arch}, ${p.school})`).join('; '));
  check('powers: launch sites carry the new names', D.SITES.filter(t => t.power != null).every(t => t.name.startsWith(W[t.power].root)), D.SITES.slice(0, 4).map(t => t.name).join(', '));
  const H = html.replace(/\r\n/g, '\n');
  check('powers: the look lane reads the SIM\'s school (one source of truth)', H.includes('if(POWERS[i].school&&') && H.includes('return SCHOOL_IDS[POWERS[i].school]'));
  D.resetHome(); Object.assign(P, { homeArch: null, day: 0, rel: {}, op: {}, done: {}, raceLost: {}, raceAnn: {} }); D.chooseStart('agency');
  const open = W.find(p => p.arch === 'openSuper'), closed = W.find(p => p.arch === 'closedSuper');
  D.RIVALS = { beeper: { i: open.i, day: 100 }, hop: { i: closed.i, day: 100 } };
  P.day = 69; D.raceTick(); const n0 = news.length; P.day = 70; D.raceTick(); const ann = news.slice(n0); P.day = 90; D.raceTick(); const rum = news.slice(n0 + ann.length);
  P.day = 100; news.length = 0; D.raceTick();
  check('rivals: the open superpower announces 30 days ahead, the closed one is preceded by rumours; each wins in its own tone',
    ann.length === 1 && /announces an attempt at The beeper/.test(ann[0]) && rum.length === 1 && /Rumours from/.test(rum[0]) && news.some(t => /Live on every channel/.test(t)) && news.some(t => /state bulletin/.test(t)),
    [...ann, ...rum, ...news].join(' | '));
}

// econ-14. The network screen's model (economy session, QUEUE Q154): netModel() gives the screen its fleet and pads (as
// flow's fallback did), today's nodes with stock and need, no routes yet, and the bottleneck (the crewed node shortest of
// supplies). The screen reads it and computes nothing.
{
  const D = new Function(src + 'return {netModel,padsN,TELLUS,SELENE,PROG,HOOK,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 5, fac: {}, stations: [] }); D.chooseStart('agency');
  const R0 = D.TELLUS.R + 400e3, v0 = Math.sqrt(D.TELLUS.mu / R0), u = [-1, 0, 0].map(x => x * D.SELENE.R);
  const sat = { id: 41, name: 'Lookout 1', cam: 1, ant: 1, r: [R0, 0, 0], v: [0, 0, v0], epoch: 0, pending: [], imgs: 0, shape: [] };
  const base = { id: 42, name: 'Selene Base 1', landed: true, beacon: true, bodyName: 'Selene', pf: u, ql: [0, 0, 0, 1], shape: [{ k: 'hab', crew: 2, res: { sup: 0.1 } }], pending: [], imgs: 0 };
  P.sats = [sat, base];
  P.dispatch = [{ id: 1, title: 'Supply run to Selene Base 1', base: 42, stack: ['sci', 't8', 'kestrel'], pad: 0, launch: 140, ordered: 100, status: 'queued' },
    { id: 2, title: 'Dispatched: a satellite contract', cid: 9, stack: ['sci', 't8', 'kestrel'], pad: 0, launch: 90, status: 'deviated', dev: { why: 'the upper stage failed to relight' } }];
  const M = D.netModel(), bn = M.nodes.find(n => n.id === 'reg:42'), sn = M.nodes.find(n => n.id === 'reg:41');
  check('network model: fleet (craft, queued and deviated dispatches) and the pads\' bookings, as the screen draws them',
    M.fleet.length === 4 && M.fleet.some(f => /needs you/.test(f.next)) && M.pads.length === D.padsN() && M.pads[0].bars.length === 1 && M.pads[0].bars[0].to === 140 && Array.isArray(M.routes) && !M.routes.length,
    M.fleet.map(f => `${f.name}: ${f.next}`).join(' · '));
  check('network model: nodes for our sites, the satellite by orbit band, the base with its stock and need; the bottleneck names it',
    M.nodes.some(n => n.kind === 'site') && sn && sn.slot === 'low' && bn && bn.kind === 'base' && bn.stock.supplies === 100 && bn.need.supplies === 10 && Math.round(bn.days) === 10
    && M.bottleneck && M.bottleneck.node === 'reg:42' && /10 days of supplies/.test(M.bottleneck.text), M.bottleneck ? M.bottleneck.text : 'no bottleneck');
  const N = readFileSync(new URL('./app/network.js', import.meta.url), 'utf8');
  check('network model: the screen reads netModel() (its fallback went with N2, flow Q170)', /const netData=\(\)=>netModel\(\);/.test(N) && !/function netFallback/.test(N));
}

// econ-15. Rival personalities in the race and the program's own voice (economy session, QUEUE Q165, POWERS.md): a
// frugal power doesn't race; a rising power copies the first of the race's firsts, then catches up; our firsts are
// announced in the home archetype's voice.
{
  const D = new Function(src + 'return {raceSchedule,RACE,POWERS,missionComplete,MISSIONS,PROG,HOOK,resetHome:()=>{HOME=0},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'frugal', day: 10, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 1, done: {}, raceLost: {}, staged: {} }); D.chooseStart('agency');
  const W = D.POWERS, x = W.find(p => p.i !== 0 && !/Super$/.test(p.arch)), keep = { arch: x.arch, tech: x.tech, econ: x.econ };
  Object.assign(x, { arch: 'frugal', tech: 5, econ: 5 }); const Sf = D.raceSchedule();
  Object.assign(x, { arch: 'rising' }); const Sr = D.raceSchedule(); Object.assign(x, keep);
  check('race: a frugal power never holds a first, however fast; a rising one leaves the first of them to others and wins later ones',
    D.RACE.every(id => !Sf[id] || Sf[id].i !== x.i) && Sr[D.RACE[0]] && Sr[D.RACE[0]].i !== x.i && D.RACE.slice(1).some(id => Sr[id] && Sr[id].i === x.i),
    `rising ${x.root}: ${D.RACE.map(id => `${id} → ${Sr[id] ? W[Sr[id].i].root : '—'}`).join(', ')}`);
  D.missionComplete(D.MISSIONS.find(m => m.id === 'beeper'), null);
  check('our own first is announced in the home archetype\'s voice (frugal: the science desk)', news.some(t => /FIRST IN THE WORLD/.test(t) && /motorway bridge/.test(t)), news.find(t => /FIRST/.test(t)));
}

// econ-16. Station work (economy session, QUEUE Q162, Q9's plan slice 1): resupply, lab time and expansion contracts,
// offered for our stations and judged between flights on the station's state since they were taken.
{
  const D = new Function(src + 'return {CT,genOffer,acceptOffer,selTick,stState,stPick,TELLUS,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 5, cdone: 0, done: { beeper: { day: 1, flight: 1 } } }); D.chooseStart('agency');
  const R0 = D.TELLUS.R + 400e3, v0 = Math.sqrt(D.TELLUS.mu / R0);
  const st = { id: 51, name: 'Station 1', r: [R0, 0, 0], v: [0, 0, v0], epoch: 0, pending: [], imgs: 0, shape: [{ k: 'hab', crew: 2, res: { sup: 0.35 } }, { k: 'lab' }], attached: [], labDays: 7 };
  P.sats = [st];
  const R = D.rng(5); let o = null; for (let k = 0; k < 400 && !o; k++) { const x = D.genOffer(k % 2 ? 'gov' : 'com', R); if (x && x.type === 'stResupply') o = x; }
  check('station work: a crewed station short of supplies gets a resupply offer, due when they run out, saying why', o && o.p.st === 51 && o.p.days === 35 && o.p.kg === 600 && /35 days of supplies/.test(o.why), o ? `${D.CT[o.type].title(o.p)}: ${o.p.kg} kg in ${o.p.dur} days, ${o.p.pay.toFixed(0)}M; ${o.why}` : 'no offer');
  P.offers = [o]; D.acceptOffer(o.id); const c = P.active[0], f0 = P.funds; D.selTick(); const before = P.active.length;
  st.attached.push({ e: { id: 52, shape: [{ k: 'hab', res: { sup: 0.3 } }] } }); D.selTick(); const half = P.active.includes(c);
  st.attached.push({ e: { id: 54, shape: [{ k: 'hab', res: { sup: 0.3 } }] } }); D.selTick();
  check('station work: the resupply completes once 600 kg have docked (two habitats of 300 kg), not after the first', before === 1 && half && !P.active.includes(c) && P.funds > f0, `paid ${(P.funds - f0).toFixed(0)}M`);
  const lab = { id: 901, type: 'stLab', src: 'sci', client: 0, p: { st: 51, name: 'Station 1', n: 10, pay: 64 }, deadline: P.day + 90 }, exp = { id: 902, type: 'stExpand', src: 'com', client: 0, p: { st: 51, name: 'Station 1', kind: 'lab', pay: 100 }, deadline: P.day + 300 };
  P.offers = [lab, exp]; D.acceptOffer(901); D.acceptOffer(902); st.labDays = 12; D.selTick(); const midLab = P.active.includes(lab), midExp = P.active.includes(exp);
  st.labDays = 17; st.attached.push({ e: { id: 53, shape: [{ k: 'lab' }] } }); D.selTick();
  check('station work: lab time counts lab-days earned since taken; expansion counts a module docked since taken', midLab && midExp && !P.active.includes(lab) && !P.active.includes(exp) && D.stState(51, 'lab') === 2,
    `lab-days 7 → 12 (not yet) → 17 (done); labs ${D.stState(51, 'lab')}`);
}

// econ-17. The first-station firsts (economy session, QUEUE Q163; Q9's plan slice 2): a habitat with two free ports in
// orbit, then a crew aboard, then a lab, then thirty crewed days, judged between flights (world missions), in that order.
{
  const D = new Function(src + 'return {utilTick,stationOf,TELLUS,PROG,HOOK,MISSIONS,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 5, cdone: 0, staged: {},
    done: Object.fromEntries(['weather', 'loads', 'beeper', 'wxsat', 'tv', 'hop', 'orbiter', 'padabort', 'maxqabort'].map((k, i) => [k, { day: 1 + i, flight: 1 + i }])) }); D.chooseStart('agency');   // a station after TV, a crew after the max-q abort (Q577)
  const R0 = D.TELLUS.R + 400e3, v0 = Math.sqrt(D.TELLUS.mu / R0);
  const hab = { k: 'hab', i: 0, pos: [0, 0, 0], y0: 0, h: 3.2 }, top = { k: 'port', i: 1, pos: [0, 0, 0], y0: 3.2, h: 0.3 }, side = { k: 'rport', i: 2, pos: [0, 0, 0], y0: 1, h: 0.6, phi: 0 };
  const st = { id: 61, name: 'Station 1', r: [R0, 0, 0], v: [0, 0, v0], epoch: 0, pending: [], imgs: 0, shape: [hab, top, side], attached: [] };
  P.sats = [st]; const step = () => { D.utilTick(1); P.day += 1; return Object.keys(P.done).filter(k => /^station/.test(k)).join(','); };
  const s1 = step(); hab.crew = 2; hab.res = { sup: 0.6 }; const s2 = step(); st.shape.push({ k: 'lab', i: 3, pos: [0, 0, 0], y0: -3.2, h: 3.2 }); const s3 = step();
  for (let k = 0; k < 29; k++) step(); const s4 = step();
  check('first station: a habitat with two free ports, then a crew, then a lab, then thirty crewed days, each a first in turn',
    s1 === 'station1' && s2 === 'station1,stationcrew' && s3 === 'station1,stationcrew,stationlab' && /station30/.test(s4) && news.some(t => /A station/.test(t)),
    `${s1} → ${s2} → ${s3} → ${s4}; ${Math.floor(st.crewDays)} crewed days`);
}

// econ-18. Base work (economy session, Q9's plan slice 3): the station contracts of v1.89.3 for a base too, read with
// baseOf (everything landed within 500 m of the beacon): a resupply is met by landing supplies there.
{
  const D = new Function(src + 'return {CT,genOffer,acceptOffer,selTick,stState,SELENE,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 5, cdone: 0, done: { beeper: { day: 1, flight: 1 } } }); D.chooseStart('agency');
  const at = (dx) => { const u = [-1, dx / D.SELENE.R, 0], l = Math.hypot(...u); return u.map(x => x / l * D.SELENE.R); };
  const beacon = { id: 71, name: 'Selene Base 1', landed: true, beacon: true, bodyName: 'Selene', pf: at(0), ql: [0, 0, 0, 1], shape: [], pending: [], imgs: 0 };
  const hab = { id: 72, name: 'Selene lander 1', landed: true, bodyName: 'Selene', pf: at(100), ql: [0, 0, 0, 1], shape: [{ k: 'hab', crew: 2, res: { sup: 0.1 } }], pending: [], imgs: 0 };
  P.sats = [beacon, hab];
  const R = D.rng(9); let o = null; for (let k = 0; k < 400 && !o; k++) { const x = D.genOffer(k % 2 ? 'gov' : 'com', R); if (x && x.type === 'stResupply') o = x; }
  check('base work: a crewed base short of supplies gets a resupply offer that says to land the module', o && o.p.st === 71 && o.p.base && /land a module/.test(D.CT.stResupply.brief(o.p)) && o.p.days === 10,
    o ? `${D.CT.stResupply.title(o.p)}: ${o.p.kg} kg in ${o.p.days} days` : 'no offer');
  P.offers = [o]; D.acceptOffer(o.id); const c = P.active[0];
  P.sats.push({ id: 73, name: 'Selene lander 2', landed: true, bodyName: 'Selene', pf: at(300), ql: [0, 0, 0, 1], shape: [{ k: 'hab', res: { sup: 0.3 } }], pending: [], imgs: 0 }); D.selTick(); const half = P.active.includes(c);
  P.sats.push({ id: 74, name: 'Selene lander 3', landed: true, bodyName: 'Selene', pf: at(4000), ql: [0, 0, 0, 1], shape: [{ k: 'hab', res: { sup: 0.6 } }], pending: [], imgs: 0 }); D.selTick(); const far = P.active.includes(c);
  P.sats.push({ id: 75, name: 'Selene lander 4', landed: true, bodyName: 'Selene', pf: at(-200), ql: [0, 0, 0, 1], shape: [{ k: 'hab', res: { sup: 0.3 } }], pending: [], imgs: 0 }); D.selTick();
  check('base work: supplies landed within 500 m count (4 km away doesn\'t); 600 kg completes it', half && far && !P.active.includes(c), `supplies at the base ${D.stState(71, 'sup').toFixed(2)} t`);
}

// econ-19. Rendezvous and retrieval (economy session, QUEUE Q180; Q9's plan slice 4): a rendezvous is a near pass during
// the flight (within 100 m, under 1 m/s, sampled each tick); a retrieval lands a dead satellite at home stowed in a
// closed bay, and its hardware comes back refurbished. Retrieval waits for the first docking (stationcrew).
{
  const D = new Function(src + 'return {CT,genOffer,contractEval,rdvTick,rdvTarget,retrieveTarget,satAt,progT,compEra,TELLUS,PROG,HOOK,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, T = D.TELLUS; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 5, cdone: 0, done: { beeper: { day: 1, flight: 1 } } }); D.chooseStart('agency');
  const r0 = T.R + 400e3, v0 = Math.sqrt(T.mu / r0);
  const stage = { id: 81, name: 'Spent stage 1', junk: true, r: [r0, 0, 0], v: [0, v0, 0], epoch: 0, pending: [], imgs: 0 };
  const dead = { id: 82, name: 'Beeper 2', sci: 1, r: [0, r0, 0], v: [-v0, 0, 0], epoch: 0, era: 0, pending: [], imgs: 0, shape: [{ k: 'core' }, { k: 'bat' }, { k: 'ant' }, { k: 'tank' }] };
  const tv = { id: 83, name: 'TV 1', ant: 1, tvOn: true, r: [-r0, 0, 0], v: [0, -v0, 0], epoch: 0, era: 0, pending: [], imgs: 0, shape: [{ k: 'core' }, { k: 'ant' }] };
  P.sats = [stage, dead, tv]; const e0 = D.compEra(); while (D.compEra() < 1 && P.day < 20000) P.day += 50;
  const kinds = R => { const n = {}; for (let k = 0; k < 300; k++) { const o = D.genOffer('gov', R); if (o) n[o.type] = (n[o.type] || 0) + 1; } return n; };
  const n0 = kinds(D.rng(3)); P.done.stationcrew = { day: 5, flight: 4 }; const n1 = kinds(D.rng(3));
  check('rendezvous offered for spent hardware; retrieval only after the first docking, for a dead satellite, never for one still earning',
    n0.rdv > 0 && !n0.retrieve && n1.retrieve > 0 && D.rdvTarget() === stage && D.retrieveTarget() === dead, `era ${e0}→${D.compEra()}; before ${JSON.stringify(n0)}; after ${JSON.stringify(n1)}`);
  // rendezvous: a far pass and a fast pass don't count; a slow one within 100 m does
  const c = { id: 991, type: 'rdv', src: 'gov', client: 0, p: { sat: 81, name: stage.name, pay: 100, dur: 300 }, deadline: P.day + 300 }; P.active = [c];
  const R = { launched: true, day0: P.day, cdone: [], paid: [] }, s = { rec: R, alive: true, landed: false, body: T };
  const [r, v] = D.satAt(stage, D.progT(s)), at = (d, dv) => { s.r = [r[0] + d, r[1], r[2]]; s.v = [v[0], v[1] + dv, v[2]]; D.rdvTick(s, R); D.contractEval(s); return P.active.includes(c); };
  const far = at(150, 0), fast = at(50, 3), near = at(50, 0.4);
  check('rendezvous: within 100 m under 1 m/s completes it (150 m or 3 m/s don\'t)', far && fast && !near, `${far} ${fast} ${near}`);
  // retrieval: landed home with it in a closed bay; held on a port, or with the doors open, doesn't count
  const w = D.CT.retrieve.gen(D.rng(2)), k = { id: 992, type: 'retrieve', src: 'gov', client: 0, p: w, deadline: P.day + 500 }; P.active = [k];
  const bay = { open: false }, s2 = { rec: { cdone: [], paid: [] }, alive: true, landed: true, body: T, parts: [bay], att: [{ kind: 'port', e: dead, hpi: 0 }] };
  D.contractEval(s2); const onPort = P.active.includes(k); s2.att[0].kind = 'bay'; bay.open = true; D.contractEval(s2); const open = P.active.includes(k);
  bay.open = false; const f0 = P.funds; D.contractEval(s2);
  check('retrieval: landed home in a closed bay completes it and pays its hardware back (on a port or with the doors open: no)',
    onPort && open && !P.active.includes(k) && w.worth >= 8 && P.funds - f0 > w.pay + w.worth - 1e-6 && s2.rec.paid.some(x => x.k === 'refurb'), `pay ${w.pay}M + hardware ${w.worth}M; got ${(P.funds - f0).toFixed(1)}M`);
}

// econ-20. Windows (economy session, QUEUE Q185, Q127 slice 2; MIDGAME § Windows): a routine's rule finds its next
// valid window. 'any' launches when ready; 'light' waits for daylight at a Selene site on arrival (its day is the 13-day
// orbit, so never more than about half of it); 'plane' waits for a target plane to pass over the site (twice a rotation).
{
  const D = new Function(src + 'return {windowRule,nextWindow,fromPF,SITES,TELLUS,SELENE,SUN_DIR,DAY_S,dot,norm,PROG};')();
  const S = D.SELENE, pf = [-S.R, 0, 0], rule = D.windowRule('light', { body: 'Selene', pf, name: 'Base' }), sun = t => D.dot(D.norm(D.fromPF(S, pf, (t + rule.lead) * D.DAY_S)), D.SUN_DIR);
  const any = D.nextWindow(D.windowRule('any'), 12.3);
  let maxW = 0, zero = 0, bad = 0; for (let T = 0; T < 13; T += 0.25) { const w = D.nextWindow(rule, T); maxW = Math.max(maxW, w.wait); if (w.wait === 0) zero++; if (sun(w.day) < Math.sin(5 * Math.PI / 180) - 1e-9 || (w.wait > 0.02 && sun(w.day - 0.02) >= Math.sin(5 * Math.PI / 180))) bad++; }
  check('windows: "any" launches when ready; "light" lands in daylight, at the first lit moment, never waiting more than ~half of Selene’s 13-day day',
    any.day === 12.3 && any.wait === 0 && rule.lead > 1 && rule.lead < 3 && bad === 0 && zero > 10 && maxW > 4 && maxW < 7.2, `lead ${rule.lead.toFixed(2)} d; longest wait ${maxW.toFixed(2)} d; ${zero}/52 at once; ${bad} wrong`);
  const i = 30 * Math.PI / 180, O = 1.1, n = [Math.sin(i) * Math.sin(O), Math.cos(i), -Math.sin(i) * Math.cos(O)], pr = D.windowRule('plane', { n });
  let maxP = 0, offP = 0; for (let T = 0; T < 2; T += 0.1) { const w = D.nextWindow(pr, T); maxP = Math.max(maxP, w.wait); offP = Math.max(offP, Math.abs(D.dot(D.norm(D.fromPF(D.TELLUS, D.SITES[0].u, w.day * D.DAY_S)), n))); }
  check('windows: a 30° plane passes over the equatorial pad twice a rotation (never over half a day’s wait), the pad in the plane at the window', maxP <= 0.5 + 1e-6 && offP < 1e-6, `longest wait ${maxP.toFixed(3)} d; off the plane ${offP.toExponential(1)}`);
}

// econ-21. Rivals as programs from epoch 1 (economy session, QUEUE Q188, W26.1; NOTES § "Q188 amendment"): each rival
// works through the race's firsts with progress, a treasury and attempts that can fail; RIVALS is the forecast; worlds
// differ; a first we win spurs the rivals; old saves and defections rebuild the state.
{
  const D = new Function(src + 'return {raceSchedule,rivTick,rivRate,rivSpur,raceTick,missionComplete,careerMove,RACE,POWERS,MISSIONS,PROG,HOOK,flav,archOf,chooseStart,setHome:h=>{HOME=h;PROG.home=h},get RIVALS(){return RIVALS},set RIVALS(v){RIVALS=v}};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const fresh = (seed, day = 0) => { Object.assign(P, { homeArch: null, wseed: seed, day, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 1, done: {}, raceLost: {}, raceAnn: {}, staged: {}, riv: null, comm: 0 }); D.setHome(0); D.RIVALS = D.raceSchedule(); D.chooseStart('agency'); };
  const W = D.POWERS, racer = W.find(p => p.i !== 0 && D.archOf(p.i) === 'openSuper'), res = W.find(p => p.i !== 0 && D.archOf(p.i) === 'resource');
  fresh(1000);
  const S0 = D.RIVALS, ws = [1000, 1077, 1154].map(s => { fresh(s, 300); return D.RACE.map(id => (D.RIVALS[id] || {}).day).join('/'); });
  check('rivals: at day 0 every first has a forecast rival in the future; worlds differ (a seeded program, not one schedule)',
    D.RACE.every(id => S0[id] && S0[id].day > 0 && D.archOf(S0[id].i) !== 'frugal') && new Set(ws).size > 1, `day 0: ${D.RACE.map(id => `${id} ${W[S0[id].i].root}@${S0[id].day}`).join(', ')}; at day 300 in three worlds: ${ws.join(' · ')}`);
  fresh(1000); const r = P.riv[racer.i]; r.k = 0; r.p = r.w - 1e-3; news.length = 0;
  D.rivTick(1, () => 0.999);
  const failed = Math.abs(r.p - r.w * 2 / 3) < 1e-9 && r.k === 0 && news.some(t => /attempt at The beeper fails/.test(t));
  r.p = r.w - 1e-3; D.rivTick(1, () => 0); D.raceTick();
  check('rivals: reaching the work is an attempt: a failure sets progress back a third (the open superpower\'s is news); a success is a real day in RIVALS, and the race is lost',
    failed && r.k === 1 && r.got.beeper != null && D.RIVALS.beeper.i === racer.i && D.RIVALS.beeper.day <= P.day && P.raceLost.beeper === racer.i, `${news.join(' | ')}; got ${JSON.stringify(r.got)}`);
  fresh(1000); const before = D.RIVALS.hop.day, rate0 = D.rivRate(racer.i, P.riv[racer.i], 1);
  D.missionComplete(D.MISSIONS.find(m => m.id === 'beeper'), null); const rate1 = D.rivRate(racer.i, P.riv[racer.i], 1);
  D.rivTick(1, () => 0.5);
  check('rivals: a first we win spurs every rival still racing for it (× 1 + ½ prestige appetite, a year), and their forecasts come closer',
    Math.abs(rate1 / rate0 - (1 + 0.5 * D.flav(racer.i).pri.prestige)) < 1e-9 && P.riv[racer.i].spur === P.day + 365 && D.RIVALS.hop.day <= before, `rate ×${(rate1 / rate0).toFixed(3)}; hop forecast day ${before} → ${D.RIVALS.hop.day}`);
  fresh(1000); const rr = P.riv[res.i]; P.comm = -1; const bust = D.rivRate(res.i, rr, 1); P.comm = 1; const boom = D.rivRate(res.i, rr, 1); P.comm = 0;
  check('rivals: a resource state races on its commodity money (a bust halves its pace, a boom adds half)', Math.abs(bust / boom - 1 / 3) < 1e-9, `bust ${bust.toFixed(5)}/d, boom ${boom.toFixed(5)}/d`);
  fresh(1000, 400); const ff = D.RACE.filter(id => D.RIVALS[id] && D.RIVALS[id].day <= 400);
  Object.assign(P, { done: { beeper: { day: 50, flight: 2 }, hop: { day: 120, flight: 3 } } }); P.riv.day = 400;
  const keepRacer = JSON.stringify(P.riv[racer.i]);
  D.careerMove({ kind: 'defect', power: racer.i, amt: 50 });
  const oldHome = P.riv[0];
  check('rivals: an old save (no state) fast-forwards to today; a defection keeps the other rivals\' programs, and the old home races on from the firsts we flew for it',
    ff.length >= 2 && P.riv.home === racer.i && !P.riv[racer.i] && oldHome && oldHome.k === 2 && oldHome.got.beeper === 50 && oldHome.got.hop === 120 && P.riv[res.i] != null && keepRacer.length > 0,
    `by day 400 rivals had ${ff.join(', ')}; old home ${JSON.stringify(oldHome)}`);
}

// econ-22. The commercial giant (economy session, QUEUE Q206, D10; POWERS.md § Commercial giant): a company, not a power,
// arriving in world year 18–21 with a year of exploding prototypes, then orbit; from then on it sells parts to anyone
// (undercutting imports) and takes a growing share of the commercial market, which commercial offers' pay loses (floored);
// its power's sanctions reach it.
{
  const D = new Function(src + 'return {giantTick,giantShare,giantSells,giantYear,sourceOf,relOf,genOffer,payFloor,PROG,HOOK,POWERS,YEAR_D,IMPORT_K,rng,chooseStart,setHome:h=>{HOME=h;PROG.home=h}};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  Object.assign(P, { homeArch: 'resource', wseed: 1000, day: 0, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 1, done: { beeper: { day: 1 } }, giant: null, cycle: 0 });
  D.setHome(0); D.chooseStart('company');
  const k = 'pod', before = D.sourceOf(k), R = D.rng(7);
  const y0 = D.giantYear(); P.day = Math.floor((y0 - 0.01) * D.YEAR_D); D.giantTick(1, R); const early = P.giant;
  P.day = Math.ceil(y0 * D.YEAR_D) + 1; D.giantTick(1, R); const G = P.giant;
  const arrived = G && G.day === P.day && news.some(t => t.includes(G.name) && /prototype/.test(t)) && !D.giantSells() && D.giantShare() === 0;
  for (let d = P.day; d < G.orbit; d += 5) { P.day = d; D.giantTick(5, R); }
  const ruds = G.rud; P.day = G.orbit; D.giantTick(1, R); const up = news.some(t => /reaches orbit/.test(t));
  const sell0 = D.giantSells(), at0 = D.sourceOf(k);
  check('giant: none before its year; arrives with a prototype on the news, sells nothing while prototypes blow up, then reaches orbit and sells us parts cheaper than an import',
    early === null && arrived && ruds <= 2 && up && sell0 && at0.how === 'giant' && at0.k < D.IMPORT_K && before.how !== 'home' && before.how !== 'giant',
    `year ${y0.toFixed(2)}; ${G.name} in ${D.POWERS[G.i].root}, day ${G.day}, orbit ${G.orbit}, ${ruds} RUD; ${k}: ${before.how} ×${before.k} → ${at0.how} ×${at0.k}`);
  const offerPay = (share) => { P.day = G.orbit + share * 4 * D.YEAR_D / 0.4; const o = [], r = D.rng(99); for (let n = 0; n < 40; n++) { const x = D.genOffer('com', r); if (x) o.push(x); } return o; };
  const a = offerPay(0), b = offerPay(0.4), sumA = a.reduce((s, x) => s + x.p.pay, 0), sumB = b.reduce((s, x) => s + x.p.pay, 0);
  const floored = b.every(x => x.p.pay >= D.payFloor(x.type) - 1e-9);
  P.day = G.orbit + 5 * D.YEAR_D; news.length = 0; D.giantTick(1, R);
  check('giant: its market share grows to 40 % over four years; commercial offers pay less by it (never under the floor); yearly price-cut news; its parts fall to our own price',
    Math.abs(D.giantShare() - 0.4) < 1e-9 && sumB < sumA * 0.85 && floored && D.sourceOf(k).k === 1 && news.some(t => /cuts its prices/.test(t)),
    `com pay over 40 offers ${sumA.toFixed(0)} → ${sumB.toFixed(0)}; part ×${D.sourceOf(k).k}`);
  const i0 = G.i, other = D.POWERS.find(p => p.i !== 0 && D.relOf(0, p.i) > -0.2); G.i = other.i; const ok1 = D.sourceOf(k).how === 'giant';
  P.sanc[G.i] = P.day + 100; const sancd = ok1 && D.giantSells() === null && D.sourceOf(k).how !== 'giant';
  check("giant: it answers to its power's law: sanctions from that power stop its sales to us", sancd, `based in ${other.root}: before ${ok1 ? 'giant' : '?'}, sanctioned ${D.sourceOf(k).how}`);
  G.i = i0;
}

// econ-23. A missed deadline costs a wait (economy session, QUEUE Q295, DECISIONS D17.4): the job is lost with no
// standing or opinion lost, and the client posts it again 60–120 days later, same job and pay; not while it sanctions
// us; a job whose reason is gone drops; a full board makes it wait.
{
  const D = new Function(src + 'return {econTick,backTick,contractLost,standOf,opOf,CT,PROG,HOOK,BOARD_MAX,rng,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { wseed: 77, day: 100, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 1, done: {}, cycle: 0, funds: 500 });
  D.chooseStart('agency');
  const job = { id: 901, type: 'apex', src: 'sci', client: 1, p: { lo: 50, hi: 65, pay: 17, dur: 100 }, deadline: 105 };
  P.active = [job]; const s0 = D.standOf('sci'), o0 = D.opOf(1);
  P.day = 110; D.econTick(10, D.rng(3)); const b = P.back[0];
  const lost = P.active.length === 0 && D.standOf('sci') === s0 && Math.abs(D.opOf(1) - o0) < 1 && b && b.day >= 170 && b.day <= 230 && news.some(t => /Missed deadline.*ask again/.test(t));
  P.offers = []; P.day = b.day - 1; D.backTick(); const early = P.offers.length;
  P.day = b.day; D.backTick(); const o = P.offers.find(x => x.back);
  check('missed deadline: no standing or opinion lost; the same job and pay come back as an offer 60–120 days later, saying why',
    lost && early === 0 && o && o.type === 'apex' && o.p.pay === 17 && o.client === 1 && /Asked again/.test(o.why) && !P.back.length && news.some(t => /Back on offer/.test(t)),
    `back on day ${b && b.day}; offer ${o && `${o.type} ${o.p.pay}M, "${o.why}"`}`);
  P.back = [{ c: job, day: P.day }]; P.offers = Array.from({ length: D.BOARD_MAX }, (_, k) => ({ id: 1000 + k, type: 'apex', src: 'sci', client: 1, p: job.p, expires: P.day + 50 }));
  D.backTick(); const waits = P.back.length === 1; P.offers = []; P.sanc = { 1: P.day + 50 }; D.backTick(); const dropped = !P.back.length && !P.offers.length;
  P.sanc = {}; P.back = [{ c: { id: 902, type: 'service', src: 'gov', client: 0, p: { sat: 'gone', pay: 60, dur: 300 } }, day: P.day }]; D.backTick();
  check('missed deadline: a full board makes the job wait; a client sanctioning us, or a job whose reason is gone (no satellite to service), drops it',
    waits && dropped && !P.back.length && !P.offers.length, `waits ${waits}, sanctioned dropped ${dropped}`);
}

// econ-24. Overflight (economy session, QUEUE Q181, W23; NOTES § "Plan: overflight politics"): low flight only. Below
// 150 km and within 1,000 km of the launch point, the powers whose land passes under the vessel are recorded; orbit
// heights and far-off points don't count; home and the site's host don't. At the end each costs opinion and relation
// scaled by the relationship (an ally nothing, a rival the most, a security state double), one headline a year.
{
  const D = new Function(src + 'return {overTick,overEnd,overK,debriefOf,norm,cross,len,SITES,POWERS,PROG,HOOK,TELLUS,powerAt,alongAz,rotY,bodyTheta,pairKey,relOf,opOf,archOf,OVER_OP,YEAR_D,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart,set t(v){simT=v}};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { wseed: 5, day: 50, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 1, done: {}, overNews: {} });
  D.chooseStart('agency'); D.t = 0;
  const site = D.SITES.find(t => t.power === 0) || D.SITES[0], u0 = site.u, Rt = D.TELLUS.R;
  let far = null; for (let km = 100; km <= 900 && !far; km += 50) for (let a = 0; a < 36 && !far; a++) { const u = D.alongAz(u0, a * Math.PI / 18, km * 1e3 / Rt), p = D.powerAt(u); if (p && p.i !== 0 && p.i !== site.power) far = { u, p, km }; }
  const at = (u, h) => D.rotY(u.map(x => x * (Rt + h)), D.bodyTheta(D.TELLUS, 0));
  const fly = (u, h, orb) => { const R = { launchPf: u0.map(x => x * Rt), site: site.id }, r = at(u, h), up = D.norm(r), side = D.norm(D.cross(up, [0, 1, 0])), vc = Math.sqrt(D.TELLUS.mu / D.len(r));
    D.overTick({ r, v: orb ? side.map(x => x * vc) : [0, 0, 0] }, R, 1.5); return R; };
  const low = fly(far.u, 60e3), high = fly(far.u, 300e3), homeLand = fly(u0, 20e3), orbit = fly(far.u, 120e3, true), climb = fly(far.u, 120e3);
  check('overflight: low over a foreign power within 1,000 km is recorded (climbing at 120 km too); in orbit at 120 km, above 150 km, or over home, it is not',
    low.over && low.over[far.p.i] === 1 && climb.over && !orbit.over && !high.over && !homeLand.over, `${far.p.name} ${far.km} km out: low ${JSON.stringify(low.over)}, at 300 km ${JSON.stringify(high.over)}`);
  const i = far.p.i, key = D.pairKey(0, i);
  P.rel[key] = 0.6; const o0 = D.opOf(i); D.overEnd(low); const ally = D.opOf(i) === o0 && low.overK[i] === 0 && !news.length;
  P.rel[key] = -1; const o1 = D.opOf(i), k1 = D.overK(i); D.overEnd(low); const hit = D.opOf(i) < o1 - 2.9 && D.relOf(0, i) <= -1 + 1e-9 && news.length === 1;
  D.overEnd(low); const once = news.length === 1;
  check('overflight: an ally doesn\'t mind; a rival protests (opinion −3, × 2 for a security state), one headline a program year',
    ally && hit && once && Math.abs(k1 - (D.archOf(i) === 'security' ? 2 : 1)) < 1e-9, `${far.p.name} (${D.archOf(i)}): opinion ${o1.toFixed(1)} → ${D.opOf(i).toFixed(1)}; ${news.join(' | ')}`);
}

// econ-25. Routines (economy session, QUEUE Q184, Q110 slice 1; W27, D17.1): a route keeps N satellites of one design up
// in one orbit. Its runs are dispatches with no contract, flown headless, and what they put up joins the route. Ordered
// by hand at first; after three clean runs, and with the mainframes era, it may repeat by itself, ordering a run when
// fewer than N are up.
{
  const P = api.PROG, saved = JSON.stringify(P), st = api.PRESETS.Beeper, news = [];
  api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  P.procs = {}; P.done = { beeper: { flight: 0, day: 0 } }; P.funds = 1e6; P.day = 0; P.dispatch = []; P.dispN = 0; P.routes = []; P.wseed = 4242; P.fac = {}; P.sanc = {}; P.lines = {}; P.dev = {};
  P.kh = {}; P.cert = {}; for (const p of api.newShip(st).parts) { P.kh[p.d.key] = { use: 0.97, reg: {} }; P.cert[p.d.key] = 1; }   // known parts: the runs' rolls are not what this tests
  const s = handAscent(api, st);
  const q0 = { id: 900, name: 'Beeper 1', stack: st, r: s.r.slice(), v: s.v.slice(), epoch: api.t, mass: s.mass, born: 0, imgs: 0, pending: [], sci: 1 };
  P.sats = [q0]; P.satN = 900;
  const line0 = api.routeLine(q0), mk = api.makeRoute(q0, 1), r = mk.route;
  const fly = () => { const o = api.orderRoute(r.id); const D = P.dispatch[P.dispatch.length - 1]; for (let k = 0; k < 8 && D.status === 'queued'; k++) { P.day = D.launch; api.dispatchTick(); } return { o, D }; };
  const runs = [fly(), fly(), fly()], ups = api.routeSats(r).length, tagged = P.sats.filter(q => q.route === r.id).length;
  check('routine: made from a satellite whose design has a procedure; three runs ordered by hand fly headless, each puts a satellite up on the route, all clean (at 106 km most re-enter within the 30-day lead, so they do not count as up)',
    /data-mkroute="900"/.test(line0) && mk.ok && runs.every(x => x.o.ok && x.D.status === 'done') && r.runs === 3 && r.clean === 3 && tagged === 4 && ups >= 1,
    `${r.name}; runs ${runs.map(x => x.D.status + (x.D.why ? ` (${x.D.why})` : '')).join(', ')}; ${ups} of the route's ${tagged} up and holding`);
  const early = api.setRouteAuto(r.id, true), eraWhy = api.routeAutoWhy(r);
  let d = P.day; while (!api.autoAllowed('deploy').ok && d < 40000) { d += 100; P.day = d; }
  const on = api.setRouteAuto(r.id, true); r.keep = ups + 1; const n0 = P.dispatch.length; api.routeTick(); const auto = P.dispatch[P.dispatch.length - 1];
  api.routeTick(); const once = P.dispatch.length === n0 + 1;
  const net = api.netModel().routes[0], bar = api.netModel().pads.flatMap(p => p.bars).find(b => b.route === r.id);
  check('routine: repeating by itself waits for the mainframes era; then a route short of its number orders one run (not two), shown on the network model and the pad calendar',
    !early.ok && /mainframe/i.test(eraWhy) && on.ok && P.dispatch.length === n0 + 1 && auto.route === r.id && auto.auto && once && net && net.keep === ups + 1 && net.next != null && bar,
    `before: "${eraWhy}"; from day ${d}; routine run on day ${auto && auto.launch.toFixed(1)}; network route ${net ? `${net.up}/${net.keep} to ${net.to}` : 'none'}`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// econ-26. A dry satellite on a routine counts as up by its real lifetime (economy session 2, QUEUE Q414, PLAYTEST #104):
// a low orbit only fights drag, so with no propellant it still serves until it re-enters; a slot the tides move is lost
// once it can't hold it.
{
  const P = api.PROG, saved = JSON.stringify(P), st = api.PRESETS.Beeper, R0 = api.TELLUS.R, mu = api.TELLUS.mu;
  api.HOOK.news = () => {}; api.HOOK.save = () => {}; P.day = 0;
  const ship = api.newShip(st), shape = api.shapeOf(ship.parts.filter(p => p.on !== false));
  for (const o of shape) if (o.res) for (const k in o.res) o.res[k] = 0;
  const dry = (id, km) => { const r = R0 + km * 1e3; return { id, name: `Dry ${km}`, route: 77, shape: JSON.parse(JSON.stringify(shape)), r: [r, 0, 0], v: [0, 0, -Math.sqrt(mu / r)], epoch: 0, mass: ship.mass, born: 0, imgs: 0, pending: [] }; };
  const low = dry(1, 300), sank = dry(2, 106), slot = dry(3, 3000);
  P.sats = [low, sank, slot]; const up = api.routeSats({ id: 77 }).map(q => q.id);
  const L = q => `${q.name}: holds ${api.skLife(q).toFixed(0)} d, decays ${api.decayLife(q) < Infinity ? api.decayLife(q).toFixed(0) + ' d' : 'never'}, slot ${api.slotRate(q).toFixed(2)} m/s/d`;
  check('routine: a dry satellite at 300 km (no propellant to fight drag) counts as up while its decay lasts; one re-entering within 30 days does not; a dry one in a slot the tides move does not',
    api.skLife(low) === 0 && api.decayLife(low) > 30 && up.includes(1) && !up.includes(2) && api.slotRate(slot) > 0 && !up.includes(3),
    `up: [${up}]; ${[low, sank, slot].map(L).join('; ')}`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// econ-27. Recovering a spent stage (economy session 2, QUEUE Q332, from Q300 v1.142): a stage with chutes coming down at
// sea has its fate judged at the drop (it floats or not, for how long), so it survives the stage leaving the scene; the
// ships fetch it if it is still afloat when they arrive, and it is refurbished like a vessel. Own SIM copy.
{
  const G = new Function(src + 'return {PRESETS,TELLUS,PROG,HOOK,newShip,geom,stage,seaAt,bodyH,fromPF,surfVel,stepDebris,debris,dropVerdict,dropRecord,stageRecover,RECOVER_LOCAL,setT:t=>{simT=t},getT:()=>simT,DT};')();
  const T = G.TELLUS, P = G.PROG, got = [], news = []; G.HOOK.msg = () => {}; G.HOOK.boom = () => {}; G.HOOK.rebuild = () => {}; G.HOOK.debris = d => got.push(d); G.HOOK.news = t => news.push(t);
  let a = 0; const at = x => norm([Math.cos(x), 0.05, Math.sin(x)]); while (!(T.ground.sea - G.bodyH(T, mul(at(a), T.R)) > 200 && G.dropVerdict(T, mul(at(a), T.R)).kind === 'sea')) a += 0.002;
  const open = at(a), pf = mul(open, T.R);
  G.setT(0); const s = G.newShip(G.PRESETS.Orbiter); for (const p of s.parts) if (p.on && p.res.fuel != null) p.res.fuel = 0; G.geom(s); G.stage(s); G.stage(s);
  const d0 = got.find(d => d.parts.some(p => p.d.kind === 'tank')), mk = n => ({ ...d0, chutes: n, impact: { b: T, pf }, verdict: G.dropVerdict(T, pf) });
  const bare = G.dropRecord(mk(0)), one = G.dropRecord(mk(1));
  // the live fall (as sea-2): the same stage under one chute, stepped down to the water; debAfloat rewrites its record
  const live = mk(1), r0 = G.fromPF(T, mul(open, T.R + 3000), 0); Object.assign(live, { r: r0, v: add(G.surfVel(T, r0), mul(norm(r0), -120)), w: [0.3, 0.1, 0.2], t: 0, chA: 0, float: null, dead: false, mesh: null });
  G.dropRecord(live); const pre = live.drop.sea; G.debris.length = 0; G.debris.push(live);
  for (let t = 0; t < 1500 && G.debris.length && !live.float; t += G.DT) { G.stepDebris(G.DT); G.setT(G.getT() + G.DT); }
  const post = live.drop.sea;
  Object.assign(P, { funds: 100, led: {}, fac: {} });
  const near = { launchPf: pf, drops: [{ ...one }] }, far = { launchPf: mul(at(a + 0.6), T.R), drops: [{ ...one }] }, nochute = { launchPf: pf, drops: [{ ...bare }] };
  const f0 = P.funds; G.stageRecover(near); const back = P.funds - f0; G.stageRecover(far); G.stageRecover(nochute); const after = P.funds - f0;
  check('stage recovery: a chuted stage at sea is judged afloat at the drop (the same as when it comes down in view), fetched by local ships and refurbished; one beyond their reach is lost; a bare one is left to the fleet',
    !bare.sea && one.sea && one.sea.fate === 'afloat' && one.sea.sp < 14 && post && post.fate === 'afloat' && Math.abs(post.afloat - one.sea.afloat) < 0.25 * one.sea.afloat &&
      back > 0 && near.drops[0].fate === 'recovered' && Math.abs(P.led.stages - back) < 1e-9 && far.drops[0].fate === 'beyond our ships' && Math.abs(after - back) < 1e-9 && !nochute.drops[0].fate,
    `predicted ${one.sea && one.sea.sp.toFixed(1)} m/s, afloat ${(one.sea.afloat / 3600).toFixed(1)} h; in view ${post && post.sp.toFixed(1)} m/s, ${post && (post.afloat / 3600).toFixed(1)} h; refurbished +${back.toFixed(2)}M; ${news.join(' | ')}`);
}

// econ-28. Overflight rights (economy session 2, QUEUE Q380, W23): a year's consent from a power that minds, priced by
// how much it minds; with it, flying low over its land costs nothing; refused under sanctions, at poor relations, and
// by a rival in the race on poor terms. Own SIM copy.
{
  const D = new Function(src + 'return {overEnd,overK,overQuote,buyOver,overHave,POWERS,PROG,HOOK,pairKey,relOf,opOf,archOf,YEAR_D,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { wseed: 5, day: 50, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 1, done: {}, overNews: {} });
  D.chooseStart('agency'); Object.assign(P, { funds: 100, led: {}, overR: {}, riv: null });
  const i = D.POWERS.find(p => p.i !== 0 && D.archOf(p.i) !== 'security').i, key = D.pairKey(0, i), fly = () => ({ over: { [i]: 1 } });
  P.rel[key] = 0.6; const ally = D.overQuote(i);
  P.rel[key] = 0; const q0 = D.overQuote(i), f0 = P.funds, bought = D.buyOver(i), paid = f0 - P.funds, o0 = D.opOf(i), R1 = fly(); news.length = 0; D.overEnd(R1);
  const free = D.opOf(i) === o0 && R1.overK[i] === -1 && !news.length && D.overQuote(i).have;
  P.day += D.YEAR_D + 1; const R2 = fly(); D.overEnd(R2); const lapsed = D.opOf(i) < o0 && R2.overK[i] > 0;
  P.rel[key] = -0.6; const poor = D.overQuote(i);
  P.rel[key] = -0.2; const plain = D.overQuote(i); P.riv = { [i]: { got: {} } }; const rival = D.overQuote(i); P.riv = null;
  P.sanc[i] = P.day + 100; const sanc = D.overQuote(i); P.sanc = {};
  check('overflight rights: an ally needs none; at relation 0 a year\'s consent costs 2M (on the ledger) and makes flying over it free, for a year; refused at −0.6, by a rival in the race at −0.2 (not by a non-rival), and under sanctions',
    !ally.ok && q0.ok && Math.abs(q0.fee - 2) < 0.051 && bought && Math.abs(paid - q0.fee) < 1e-9 && Math.abs(P.led.over + q0.fee) < 1e-9 && free && lapsed &&
      !poor.ok && /refuses/.test(poor.why) && plain.ok && plain.fee > q0.fee && !rival.ok && /rival/.test(rival.why) && !sanc.ok,
    `${D.POWERS[i].name}: ally "${ally.why}"; at 0 ${q0.fee}M; at −0.2 ${plain.fee}M; ${poor.why}; ${rival.why}; ${sanc.why}`);
}

// econ-29. The simulator core (economy session 2, QUEUE Q449, Q282 slice 1, W42 on its defaults): a run lifts off with no
// charges or waits, collects its news and mutes saves, flies the believed world (each part's strength between certified
// and true, unsampled air ±25 %), and ends discarded: the program as before except the days (a day per simulated hour,
// half a day at least) and the design's simulator hours. A joint loaded between its believed and true ratings breaks in
// the simulator and not in a real flight. Own SIM copy.
{
  const mk = () => { const D = new Function(src + 'return {simStart,simEnd,simK,missionTick,missionEnd,newShip,probe,density,advanceDays,TELLUS,PROG,HOOK,certOf,designKey,getSIM:()=>SIM,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
    D.HOOK.msg = () => {}; D.resetHome(); Object.assign(D.PROG, { wseed: 5, day: 40, rel: {}, op: {}, sanc: {}, cert: {}, kh: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 3, done: {}, atm: { 0: 1 } });
    D.chooseStart('agency'); D.PROG.funds = 200; return D; };
  const D = mk(), C = mk(), P = D.PROG, news = []; let saves = 0; D.HOOK.news = t => news.push(t); D.HOOK.save = () => { saves++; }; C.HOOK.news = C.HOOK.save = () => {};
  const stack = ['chute', 'pod', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], before = JSON.stringify(P);
  const s = D.newShip(stack); s.landed = false; const started = D.simStart(s), f0 = P.funds, d0 = P.day;
  D.missionTick(s, 0, false); const S = D.getSIM(), free = s.rec.launched && P.funds === f0 && P.day === d0;
  const air = [5e3, 25e3, 45e3].map(h => D.density(D.TELLUS, h) / (D.TELLUS.rho0 * Math.exp(-h / D.TELLUS.H)));
  const ks = [...new Set(stack)], kOK = ks.every(k => { const b = D.simK(k), c = D.certOf(k); return b >= c - 1e-12 && b <= 1 + 1e-12; }) && ks.some(k => D.simK(k) < 0.999), kv = ks.map(k => `${k} ${D.simK(k).toFixed(2)}/${D.certOf(k).toFixed(2)}`).join(" ");
  news.length = 0; saves = 0; D.HOOK.news('Something in the papers'); D.HOOK.save(); const muted = !news.length && !saves && S.log.length === 1;
  s.rec.simS = 2 * 3600; P.funds -= 50; const out = D.missionEnd(s);
  C.advanceDays(2);   // the control: the same program, two days on, no simulator
  const after = JSON.parse(JSON.stringify(P)), b0 = JSON.parse(before), key = D.designKey(stack);
  const days = after.day - b0.day, hrs = after.simH && after.simH[key]; delete after.simH;
  const same = JSON.stringify(after) === JSON.stringify(C.PROG), restored = D.getSIM() === null && saves === 1;
  D.HOOK.news('after'); const unmuted = news.length === 1;
  // a short run is half a day
  const s2 = D.newShip(stack); s2.landed = false; D.simStart(s2); D.missionTick(s2, 0, false); s2.rec.simS = 600; const day1 = P.day, o2 = D.missionEnd(s2);
  const short = P.day - day1;
  // a joint loaded between its believed and true ratings
  const s3 = D.newShip(stack); let q = 2000, wr = null; for (; q < 2e5; q *= 1.15) { wr = D.probe(s3, { M: 1.2, aoa: 8, q, h: 9000, thr: 1 }).worst; if (wr.frac > 0.8) break; }
  const p = wr.p, real = wr.frac; const s4 = D.newShip(stack); s4.landed = false; D.simStart(s4); D.missionTick(s4, 0, false); const S4 = D.getSIM();
  for (const k of ks) S4.k[k] = D.certOf(k);   // the pessimistic edge of the draw
  const sim = D.probe(D.newShip(stack), { M: 1.2, aoa: 8, q, h: 9000, thr: 1 }).worst.frac; D.missionEnd(s4);
  const realAgain = D.probe(D.newShip(stack), { M: 1.2, aoa: 8, q, h: 9000, thr: 1 }).worst.frac;
  check('simulator: a run lifts off free (no money, no days), flies believed air (sampled band true, unsampled ±25 %) and believed strength (between certified and true), collects its news, saves nothing',
    started && free && Math.abs(air[0] - 1) < 1e-12 && air.slice(1).every(x => x >= 0.75 && x <= 1.25) && air.slice(1).some(x => Math.abs(x - 1) > 1e-6) && kOK && muted,
    `air ×${air.map(x => x.toFixed(3)).join(', ')}; simK/cert ${kv}`);
  check('simulator: the end discards the run whole: the program as before but for 2 days (2 simulated hours) and the design\'s 2 simulator hours; a 10-minute run costs half a day; hooks restored',
    out && out.sim && same && Math.abs(days - 2) < 1e-9 && Math.abs(hrs - 2) < 1e-9 && restored && unmuted && Math.abs(short - 0.5) < 1e-9 && o2.days === 0.5,
    `${days} days, ${hrs} h, same ${same}; short run ${o2 && o2.days} d`);
  check('simulator: a joint at 80–95 % of its true rating breaks at the believed (certified) edge and not in a real flight',
    real > 0.8 && real < 1 && sim > 1 && Math.abs(realAgain - real) < 1e-9, `${p && p.d.name}: real ${(real * 100).toFixed(0)} %, simulator ${(sim * 100).toFixed(0)} % at q ${q.toFixed(0)} Pa`);
}

// econ-30. A routine's runs count clean (economy session, QUEUE Q500, PLAYTEST #134): the robot's m2 made a route from a
// weather satellite (the Satellite preset flown north into a polar orbit, then raised to ~300 km) and ordered three runs;
// each flew and finished on the route's orbit, yet none counted clean, so Repeat never unlocked.
{
  const P = api.PROG, saved = JSON.stringify(P), st = api.PRESETS.Satellite, news = [], mu = api.TELLUS.mu;
  api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  P.procs = {}; P.done = { beeper: { flight: 0, day: 0 } }; P.funds = 1e6; P.day = 0; P.dispatch = []; P.dispN = 0; P.routes = []; P.wseed = 4242; P.fac = {}; P.sanc = {}; P.lines = {}; P.dev = {};
  P.kh = {}; P.cert = {}; for (const p of api.newShip(st).parts) { P.kh[p.d.key] = { use: 0.97, reg: {} }; P.cert[p.d.key] = 1; }
  const s = handAscent(api, st, 3), r1 = api.TELLUS.R + 298e3, up = api.norm(s.r), h = api.norm(api.cross(s.r, s.v)), along = api.norm(api.cross(h, up));
  const q0 = { id: 950, name: 'Weather satellite 1', stack: st, r: up.map(x => x * r1), v: along.map(x => x * Math.sqrt(mu / r1)), epoch: api.t, mass: s.mass, born: 0, imgs: 0, pending: [], cam: 1 };
  P.sats = [q0]; P.satN = 950;
  const mk = api.makeRoute(q0, 1), r = mk.route;
  const fly = () => { const o = api.orderRoute(r.id); const D = P.dispatch[P.dispatch.length - 1]; for (let k = 0; k < 8 && D.status === 'queued'; k++) { P.day = D.launch; api.dispatchTick(); } return { o, D }; };
  const runs = [fly(), fly(), fly()], why = api.routeAutoWhy(r);
  check('routine (Q500): a polar weather satellite\'s route at ~300 km; three runs ordered by hand fly and finish on its orbit, each counts clean, and Repeat is no longer held for clean runs',
    mk.ok && runs.every(x => x.o.ok && x.D.status === 'done') && r.runs === 3 && r.clean === 3 && !/clean run/.test(why),
    `${r.name}; runs ${runs.map(x => `${x.D.status}${x.D.orb ? ` ${x.D.orb.pe / 1e3 | 0}×${x.D.orb.ap / 1e3 | 0} km ${x.D.orb.inc != null ? x.D.orb.inc.toFixed(1) + '°' : ''}` : ''}${x.D.why ? ` (${x.D.why})` : ''}`).join(', ')}; clean ${r.clean}; "${why}"; ${news.filter(t => /run \d/.test(t)).slice(-3).join(' | ')}`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// econ-31. A missed deadline leaves no opinion behind, then or later (economy worker, QUEUE Q446, TESTING 247; DECISIONS
// D17.4): two copies of a fresh world, one takes the first offer and lets it lapse, both wait to the same days up to ~200;
// the client's opinion matches the twin's at every one. The robot's 4-point gap was the world's own dice: each tick was
// seeded by its length (until Q526, v1.261: econ-32), and a taken contract adds calendar stops (its deadline), so the two worlds drift apart; there the
// relation to a rival fell below zero in one run only and that rival's first cost home −4.6. So the chance movers of
// opinion are held still here: no rival races and home is open (no leadership demands). notes/economy.md § "Q446".
{
  const mk = () => { const D = new Function(src + 'return {PROG,HOOK,opOf,acceptOffer,advanceTo,ensureBoard,cTitle,noRace:()=>{HOME=0;PROG.riv={home:0,day:0};RIVALS=raceSchedule()}};')();
    D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {}; D.noRace(); D.PROG.homeArch = 'openSuper'; D.ensureBoard(); D.PROG.funds = 1e5; return D; };
  const A = mk(), B = mk(), o = A.PROG.offers[0], took = A.acceptOffer(o.id), c = A.PROG.active.at(-1), op0 = A.opOf(c.client);
  const days = [];
  for (let d = 30; d < c.deadline + 2; d += 30) days.push(d);
  days.push(c.deadline + 2); for (let d = c.deadline + 12; d <= 202; d += 10) days.push(d);
  const trail = [], to = (X, d) => { for (let k = 0; X.PROG.day < d - 1e-6 && k < 20; k++) X.advanceTo(d); };   // advanceTo stops at the deadline's warnings
  for (const d of days) { to(A, d); to(B, d); trail.push(A.opOf(c.client) - B.opOf(c.client)); }
  const missed = !A.PROG.active.some(x => x.id === c.id), back = (A.PROG.back || []).some(b => b.c.id === c.id) || (A.PROG.offers || []).some(x => A.cTitle(x) === A.cTitle(c));
  check('missed deadline (Q446): to day ~200 the client\'s opinion stays equal to a no-contract twin\'s waiting to the same days',
    took && missed && back && trail.every(x => Math.abs(x) < 1e-6),
    `${A.cTitle(c)} for power ${c.client}, deadline day ${c.deadline.toFixed(0)}; opinion ${op0.toFixed(2)} → ${A.opOf(c.client).toFixed(2)} (twin ${B.opOf(c.client).toFixed(2)}), largest gap ${Math.max(...trail.map(Math.abs)).toExponential(1)}`);
}

// econ-32. The world doesn't care how you wait (economy worker, QUEUE Q526, from Q446): the world's dice are the
// calendar's, one roll a whole day from the save's seed and the day (wDice), so one save waited to day 200 in 1-day steps,
// in 10-day steps, or with a contract taken (its deadline stops, advanceTo's uneven steps) gets the same relations,
// opinions, rival progress and race. A closed home (leadership demands on), rivals racing. Before Q526 each tick was
// seeded by its length and these drifted apart (Δrelation ~0.6, Δopinion ~10). notes/economy.md § "Q526".
{
  const mk = () => { const D = new Function(src + 'return {PROG,HOOK,POWERS,opOf,acceptOffer,advanceDays,advanceTo,ensureBoard,chooseStart,home:()=>{HOME=0;PROG.riv=null;RIVALS=raceSchedule()}};')();
    D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
    Object.assign(D.PROG, { homeArch: 'closedSuper', wseed: 1077, flights: 1, done: { beeper: { day: 0 } } }); D.home(); D.chooseStart('agency'); D.ensureBoard(); D.PROG.funds = 1e5; return D; };
  const A = mk(), B = mk(), C = mk(), END = 200;
  while (A.PROG.day < END - 1e-9) A.advanceDays(1);
  while (B.PROG.day < END - 1e-9) B.advanceDays(10);
  const took = C.acceptOffer(C.PROG.offers[0].id);
  for (let k = 0; C.PROG.day < END - 1e-9 && k < 200; k++) C.advanceTo(Math.min(END, C.PROG.day + 7));   // stops at its deadline's warnings, and at decisions
  const W = X => ({ rel: X.PROG.rel, op: X.POWERS.map(p => X.opOf(p.i)), riv: X.POWERS.map(p => X.PROG.riv[p.i] ? X.PROG.riv[p.i].k + X.PROG.riv[p.i].p : 0), lost: JSON.stringify(X.PROG.raceLost) });
  const gap = (x, y) => Math.max(...Object.keys(x.rel).map(k => Math.abs(x.rel[k] - y.rel[k])), ...x.op.map((v, i) => Math.abs(v - y.op[i])), ...x.riv.map((v, i) => Math.abs(v - y.riv[i])));
  const a = W(A), b = W(B), c = W(C), gb = gap(a, b), gc = gap(a, c);
  check('the world doesn\'t care how you wait (Q526): one save to day 200 in 1-day steps, 10-day steps, or with a contract taken (uneven stops) has the same relations, opinions, rival progress and race (to 1e-3)',
    took && gb < 1e-3 && gc < 1e-3 && a.lost === b.lost && a.lost === c.lost && Object.keys(a.rel).length > 0,
    `largest gap: 10-day ${gb.toExponential(1)}, contract ${gc.toExponential(1)}; home opinion ${a.op[0].toFixed(2)}/${b.op[0].toFixed(2)}/${c.op[0].toFixed(2)}; race ${a.lost}`);
}

// econ-33. The money curve after day-sized ticks (economy worker, QUEUE Q528): v1.261 rolled the world once a day, so
// the board no longer starves during a flight's long preparation, and tourism (rate × (standing/50)², +5 standing a job
// done) and military work snowballed: in `career.mjs 3 6` tourism and military offers 2.9 + 2.1 → 22.5 + 14.8 a career,
// mean final funds 649 → 1,110M. Their rates went 1/22 → 1/90 and 1/35 → 1/100 a day (v1.270). A small career run
// (career.mjs OFFERS=1, open superpower and frugal, agency and company, 2 years, 2 seeds; ~8 s) keeps tourism and military
// offers under 10 a career (v1.261 gave 13–24 on four seed sets, now 5–8) and mean funds in a band (now 301–477).
// notes/economy.md § "v1.270".
{
  const { execFileSync } = await import('node:child_process'), { fileURLToPath } = await import('node:url');
  const out = execFileSync(process.execPath, [fileURLToPath(new URL('./career.mjs', import.meta.url)), '2', '2', 'base', 'agency,company'],
    { env: { ...process.env, OFFERS: '1', ARCHS: 'openSuper,frugal', SEED0: '1' }, encoding: 'utf8' });
  const M = /MEAN over (\d+) careers: final\s+(-?\d+) .*\| offers sci ([\d.]+) com ([\d.]+) gov ([\d.]+) tour ([\d.]+) mil ([\d.]+)/.exec(out) || [];
  const [n, fin, sci, com, gov, tour, mil] = M.slice(1).map(Number);
  check('money curve (Q528): a small career run keeps tourism + military offers under 10 a career and mean funds in 150–650M',
    n === 8 && tour + mil < 10 && fin > 150 && fin < 650 && sci + com + gov > 3 * (tour + mil),
    `${n} careers: final ${fin}M; offers a career sci ${sci} com ${com} gov ${gov} tour ${tour} mil ${mil}`);
}

// econ-34. A new save draws its own world (economy worker, QUEUE Q529): since v1.261 the world's dice come from the save's
// seed, so the page draws one (freshSeed) when no save loads, before the first board is drawn; Reset program draws one
// too. The SIM itself still starts on 12345, so headless tests stay repeatable. Two fresh seeds give different boards.
{
  const A = new Function(src + 'return {PROG,HOOK,freshSeed,ensureBoard};')(), seed0 = A.PROG.wseed, seeds = Array.from({ length: 20 }, () => A.freshSeed());
  A.HOOK.save = () => {}; A.PROG.wseed = seeds[0]; A.ensureBoard(); const B = { PROG: { offers: A.PROG.offers } }; A.PROG.offers = null; A.PROG.wseed = seeds[1]; A.ensureBoard(); const C = A;
  const st = readFileSync(new URL('./app/state.js', import.meta.url), 'utf8'), ed = readFileSync(new URL('./app/editor.js', import.meta.url), 'utf8');
  const iSet = st.indexOf('progLoaded=true'), iNew = st.indexOf('if(!progLoaded&&!why){PROG.wseed=freshSeed();'), iBoard = st.indexOf('progDerive()', iNew);   // (R10: progDerive deals the board)
  const board = D => JSON.stringify(D.PROG.offers.map(o => [o.type, o.client, o.p.pay]));
  // Reset is programNew since R1b: it draws a seed each time
  const resetSeeds = () => { const X = new Function(src + 'return {PROG,HOOK,programNew};')(); X.HOOK.save = () => {}; X.programNew(); const s1 = X.PROG.wseed; X.programNew(); return Number.isInteger(s1) && s1 !== 12345 && X.PROG.wseed !== s1; };
  check('new save (Q529): the page draws a fresh world seed when no save loads, before the first board; Reset draws one; the SIM stays on 12345',
    seed0 === 12345 && new Set(seeds).size === 20 && seeds.every(s => Number.isInteger(s) && s >= 0 && s < 2 ** 32)
      && iSet > 0 && iNew > iSet && iBoard > iNew && /function resetProgram\(\)\{programNew\(\)/.test(ed) && resetSeeds() && board(B) !== board(C),
    `seeds ${seeds.slice(0, 3).join(', ')}…; boards ${board(B).slice(0, 60)} | ${board(C).slice(0, 60)}`);
}

// econ-35. A dispatched flight settles its contract with a whole flight record (worker session, QUEUE R14, review
// 2026-11-09 § 2, P1): the dispatch handed `contractEval` a stub record ({orb, cdone, dv}), and every active contract's
// check reads it, so a "Qualify the X" contract on the books (`R.qPart[...]`) threw inside the world tick: the dispatch
// was charged and marked done, the day's tick and the orbits' skipped. Own SIM copy; the flight itself is a stand-in.
{
  const A = new Function(src + 'return {PROG,HOOK,programNew,chooseStart,procKey,orderDispatch,advanceDays};')(), P = A.PROG, news = [];
  A.HOOK.save = () => {}; A.HOOK.msg = () => {}; A.HOOK.news = m => news.push(m); A.programNew(); A.chooseStart('agency');
  Object.assign(P, { funds: 2000, day: 10, flights: 3, done: { weather: { flight: 0, day: 0 }, loads: { flight: 0, day: 0 }, beeper: { flight: 0, day: 0 } } });   // the Kestrel kit opens with the structural test (Q577)
  const st = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'], orb = { pe: 150e3, ap: 152e3, inc: 0, sci: true };
  P.procs = { [A.procKey(st)]: { kind: 'orbit', target: { pe: 150e3, ap: 152e3 }, dv: 4445 } };
  const sat = { id: 921, type: 'sat', src: 'com', client: 0, p: { alt: 150, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 },
    test = { id: 922, type: 'test', src: 'com', client: 0, p: { k: 'kestrel', q: 25, pay: 20, dur: 300 }, deadline: P.day + 300 },
    sample = { id: 923, type: 'sample', src: 'sci', client: 0, p: { k: 2, pay: 14, dur: 300 }, deadline: P.day + 300 };
  P.active = [test, sample, sat];
  A.HOOK.dispatchRun = () => ({ ok: true, orb, dv: 4400 });
  A.orderDispatch(sat, st); const D = P.dispatch[0], L0 = D.launch; let err = null;
  try { for (let n = 0; n < 20 && D.status !== 'done' && D.status !== 'failed'; n++) { P.decisions = []; A.advanceDays(5); } } catch (e) { err = e; }
  check('econ-35: a dispatched flight settles its contract with a whole record: a "Qualify the X" and an air-sample contract on the books don\'t throw in the world tick; the satellite contract is paid, the other two stay open',
    !err && D.status === 'done' && !P.active.includes(sat) && P.active.includes(test) && P.active.includes(sample) && P.day > L0 && news.some(m => /Dispatched flight to orbit/.test(m)),
    err ? `threw: ${err.message}` : `${D.status} on day ${(D.flown ?? 0).toFixed(1)} (launch ${L0.toFixed(1)}), day now ${P.day.toFixed(1)}; open: ${P.active.map(c => c.type).join(', ')}`);
}

// econ-36. No government top-up while a flight is open (economy, QUEUE R15, review 2026-11-09 § 2): liftoff debits the
// rocket, then the study, pad, prep and flight days tick the world, and `econTick` → `floorCheck` topped the program up
// to the floor before the flight's own pay and refunds came in (49 of 51 in-flight bailouts in `career.mjs 3 3` were
// unneeded). Now the floor waits for `missionEnd`, which checks once everything is settled; a revert clears the hold.
{
  const D = new Function(src + 'return {missionTick,missionEnd,missionDiscard,newShip,advanceDays,PROG,HOOK,vesselCost,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  D.HOOK.msg = () => {}; D.HOOK.save = () => {}; D.HOOK.news = () => {}; D.resetHome();
  Object.assign(D.PROG, { wseed: 5, day: 40, rel: {}, op: {}, sanc: {}, cert: {}, kh: {}, own: null, decisions: [], offers: [], active: [], back: [], flights: 3, done: {}, atm: { 0: 1 } });
  D.chooseStart('agency'); const P = D.PROG, stack = ['chute', 'pod', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'];
  const fly = (pay, end) => { const s = D.newShip(stack), c = D.vesselCost(s.parts).cost; P.funds = c + 10; P.bailouts = 0; s.landed = false; D.t = 0;
    D.missionTick(s, 0, false); const low = P.funds < 25; D.advanceDays(30); const mid = P.bailouts; P.funds += pay; end(s); return { low, mid, after: P.bailouts, funds: P.funds }; };
  const a = fly(100, s => D.missionEnd(s)), b = fly(0, s => D.missionEnd(s)), c = fly(0, s => D.missionDiscard(s));
  D.advanceDays(5); const cAfter = P.bailouts;
  check('econ-36: no top-up while a flight is open: below the floor after liftoff and 30 days on, no bailout; the flight\'s pay settles it with none; a flight that still ends short gets one at missionEnd; a revert leaves no hold',
    a.low && a.mid === 0 && a.after === 0 && b.low && b.mid === 0 && b.after === 1 && b.funds >= 25 - 1e-9 && c.low && c.mid === 0 && cAfter === 0,
    `paid: low ${a.low} mid ${a.mid} end ${a.after}; short: mid ${b.mid} end ${b.after} funds ${b.funds.toFixed(1)}; reverted: mid ${c.mid} later ${cAfter} funds ${P.funds.toFixed(1)}`);
}

// econ-37. A job's conditions as data (economy worker, QUEUE Q547; notes/flow.md § "Plan: the aim and the mission card",
// slice 1): every contract type and mission carries needs, conds and legs. On flight records (a met one per type, every
// one-field step short of it, and fuzzed records near every threshold), all conds met ⇔ ok, for the 17 flight-judged
// types and the flight missions; labels and states are sane; a cond turns lost when it must (apex past the band, over the
// g, launched elsewhere, down without the package) and stays lost; the between-flight types and world missions are one
// "judged at home" cond. procKey ignores stack.aim.
{
  const D = new Function(src + 'return {CT,MISSIONS,PROG,HOOK,TELLUS,SELENE,NYX,rng,recNew,jobConds,jobMet,jobNeeds,newShip,PRESETS,procKey,norm,cross,add,mul,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG, T = D.TELLUS; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 0, rel: {}, op: {}, sanc: {}, done: {}, own: null, decisions: [], site: null }); D.chooseStart('agency');
  const FLIGHT = Object.keys(D.CT).filter(k => !D.CT[k].sel && k !== 'image'), HOMEJ = Object.keys(D.CT).filter(k => !FLIGHT.includes(k));
  const SAT = { sat: 5, name: 'Beeper 2', n: 1, worth: 3, pay: 100, dur: 300 };
  const params = k => { if (['service', 'rdv', 'retrieve'].includes(k)) return [SAT]; const out = [], R = D.rng(11 + k.length); for (let i = 0; i < 40 && out.length < 3; i++) { const p = D.CT[k].gen(R); if (p) out.push(p); } return out; };
  const at = (u, d) => { const w = D.norm(D.cross(u, [0, 1, 0])), a = d / T.R; return D.mul(D.add(D.mul(u, Math.cos(a)), D.mul(w, Math.sin(a))), T.R); };
  const pick = (R, a) => a[R() * a.length | 0], B = R => R() < 0.5, NYXT = 4 * Math.PI / D.NYX.n;
  const pool = p => { const v = [0, 0.5, 1, 2, 1e4, 2e4, 15000, 25000, 199, 200, 1e9, 4.9, 5.1, 7.9, 8.1, NYXT - 1, NYXT + 1];
    for (const x of Object.values(p || {})) if (typeof x === 'number') for (const y of [x, x * 1e3]) v.push(y, y - 1, y + 1, y - 1e-6, y + 1e-6); return v; };
  const FLAGS = ['launched', 'ended', 'bio', 'bioOK', 'bioSpace', 'aurora', 'endSci', 'approved', 'orbitSci', 'weather', 'tv', 'farPhoto', 'farSent', 'selImpact', 'selLand',
    'selSampled', 'capHome', 'crewed', 'crewOK', 'crewInit', 'crewSel', 'crewSelLand', 'nyxFound', 'nyxLook', 'nyxFly', 'nyxLand'];
  function fuzz(R, p) { const V = pool(p), n = () => pick(R, V), landed = B(R), r = D.recNew(); for (const k of FLAGS) r[k] = B(R);
    Object.assign(r, { landed, recSci: landed && B(R), apexSci: n(), apex: n(), landDist: n(), gMax: n(), bioOrbits: n(), lift: n(), sciQ: n(), cgMax: n(), nyxOrbT: n(), qMax: n(), farGot: n(), nyxTrack: n(),
      qPart: p && p.k ? { [p.k]: n() } : {}, landBiome: pick(R, [p && p.b, 3, 0]), site: pick(R, [p && p.site, 'elsewhere', null]), rdv: pick(R, [undefined, { 5: 1 }, { 6: 1 }]),
      abort: B(R) ? null : { alt: pick(R, [100, 199.9, 200, 500]), q: pick(R, [14999, 15000, 20000]) } });
    for (let k = 0; k < 10; k++) if (B(R)) r.bands[k] = 1;
    r.orb = B(R) ? null : { pe: n(), ap: n(), inc: p && p.inc != null ? pick(R, [p.inc, p.inc + p.itol, p.inc + p.itol + 0.01, p.inc - p.itol - 0.01, 90]) : n(), sci: B(R) };
    r.endPf = p && p.u && B(R) ? at(p.u, pick(R, [0, p.rad * 1e3 - 1, p.rad * 1e3 + 1, 5e5])) : null;
    const s = B(R) ? undefined : { rec: r, alive: B(R), landed: B(R), body: pick(R, [T, D.SELENE]), r: [T.R + 5e4, 0, 0], v: [pick(R, [-100, 100]), 0, 0], parts: [{ open: B(R) }],
      att: B(R) ? [] : [{ kind: pick(R, ['bay', 'port']), e: { id: pick(R, [5, 6]) }, hpi: pick(R, [0, 1]) }] };
    P.atm = {}; for (let k = 0; k < 4; k++) if (R() < 0.7) P.atm[k] = 1; P.streak = pick(R, [0, 2, 3]); return { r, s }; }
  // a met record for each flight-judged type
  const GOOD = { apex: p => ({ landed: true, recSci: true, apexSci: (p.lo + p.hi) / 2 * 1e3 }), sample: p => ({ landed: true, recSci: true, bands: { [p.k]: 1 } }),
    test: p => ({ qPart: { [p.k]: p.q * 1000 + 1 } }), landing: p => ({ landed: true, apex: 3e4, landDist: 0 }),
    bioHop: () => ({ landed: true, bio: true, bioOK: true, bioSpace: true, gMax: 1 }), touristHop: () => ({ landed: true, bio: true, bioOK: true, bioSpace: true, gMax: 1 }),
    touristOrbit: () => ({ landed: true, bio: true, bioOK: true, bioOrbits: 1.2, gMax: 1 }), sat: p => ({ orb: { pe: p.alt * 1e3, ap: p.alt * 1e3, inc: p.inc, sci: true } }),
    recon: p => ({ orb: { pe: p.alt * 1e3, ap: p.alt * 1e3, inc: p.inc, sci: true } }), field: p => ({ landed: true, recSci: true, landBiome: p.b }),
    aurora: () => ({ landed: true, recSci: true, aurora: 1 }), lift: p => ({ lift: p.m }), milLift: p => ({ lift: p.m }),
    ballistic: p => ({ endPf: at(p.u, 0), endSci: true, site: p.site }), service: () => ({}), rdv: () => ({ rdv: { 5: 1 } }), retrieve: () => ({}) };
  const GOODS = { service: () => ({ alive: true, att: [{ e: { id: 5 } }] }), retrieve: () => ({ alive: true, landed: true, body: T, parts: [{ open: false }], att: [{ kind: 'bay', e: { id: 5 }, hpi: 0 }] }) };
  const STATES = new Set(['met', 'lost', 'open', 'pending']), bad = [], mis = [], cover = {};
  const sane = (x, R, s, where) => { const C = D.jobConds(x, R, s), ids = new Set(C.map(c => c.id));
    if (!C.length || ids.size !== C.length || C.some(c => !STATES.has(c.state) || typeof c.t !== 'string' || !c.t || typeof c.now !== 'string' || /undefined|NaN/.test(c.t + c.now))) bad.push(`${where}: ${JSON.stringify(C).slice(0, 160)}`); };
  const same = (x, ok, R, s, where) => { const m = D.jobMet(x, R, s); if (m !== !!ok) mis.push(`${where}: ok ${!!ok} conds ${JSON.stringify(D.jobConds(x, R, s).map(c => c.id + ':' + c.state))}`); return m; };
  const R0 = D.rng(547);
  for (const k of FLIGHT) { const CTk = D.CT[k]; cover[k] = { met: 0, not: 0 };
    for (const p of params(k)) { const c = { type: k, p };
      const g = Object.assign(D.recNew(), { launched: true }, GOOD[k](p)), gs = GOODS[k] ? GOODS[k]() : undefined;
      if (!CTk.ok(g, p, gs) || !D.jobMet(c, g, gs)) mis.push(`${k}: the met fixture isn't met (ok ${!!CTk.ok(g, p, gs)}, conds ${JSON.stringify(D.jobConds(c, g, gs).map(x => x.id + ':' + x.state))})`);
      // every one-field step short of it
      for (const f of Object.keys(GOOD[k](p))) for (const v of [false, 0, 1e9, null, {}]) { const r = { ...g, [f]: v }; let ok;
        try { ok = CTk.ok(r, p, gs); } catch (e) { continue; }   // ok() itself can't read this shape (an orbit of null): not a record a flight makes
        same(c, ok, r, gs, `${k} ${f}=${JSON.stringify(v)}`); }
      if (gs) for (const [f, v] of [['alive', false], ['landed', false], ['body', D.SELENE], ['att', []], ['parts', [{ open: true }]]]) { const s = { ...gs, [f]: v }; same(c, CTk.ok(g, p, s), g, s, `${k} s.${f}`); }
      for (let i = 0; i < 800; i++) { const { r, s } = fuzz(R0, p); const ok = CTk.ok(r, p, s); cover[k][ok ? 'met' : 'not']++; same(c, ok, r, s, `${k} fuzz ${i}`); if (i < 200) sane(c, r, s, `${k} fuzz ${i}`); } } }
  const MF = D.MISSIONS.filter(M => !M.world), MW = D.MISSIONS.filter(M => M.world);
  for (const M of MF) { cover['m:' + M.id] = { met: 0, not: 0 };
    for (let i = 0; i < 800; i++) { const { r, s } = fuzz(R0, null); const ok = M.ok(r, s); cover['m:' + M.id][ok ? 'met' : 'not']++; same(M, ok, r, s, `m:${M.id} fuzz ${i}`); if (i < 200) sane(M, r, s, `m:${M.id} fuzz ${i}`); } }
  const thin = MF.filter(M => !cover['m:' + M.id].met).map(M => M.id);
  check(`job conditions (Q547): all conds met ⇔ ok for the ${FLIGHT.length} flight-judged contract types and ${MF.length} flight missions (met fixtures, one-field steps short, fuzz); labels and states sane`,
    FLIGHT.length === 17 && MF.length + MW.length === 29 && !mis.length && !bad.length && !thin.length && D.MISSIONS.every(M => M.conds && M.needs && M.legs) && Object.values(D.CT).every(t => t.conds && t.needs && t.legs),
    `${mis.length} mismatches${mis.length ? ': ' + mis.slice(0, 3).join(' | ') : ''}; ${bad.length} insane${bad.length ? ': ' + bad[0] : ''}; missions never met in fuzz: ${thin.join(',') || 'none'}; fuzz met e.g. retrieve ${cover.retrieve.met}, m:crewland ${cover['m:crewland'].met}`);
  // lost when it must, and it stays lost; pending for recovered; open with its now
  const st = (x, R, s) => Object.fromEntries(D.jobConds(x, R, s).map(c => [c.id, c.state])), now = (x, R, s, id) => D.jobConds(x, R, s).find(c => c.id === id).now;
  const ap = { type: 'apex', p: { lo: 40, hi: 55, pay: 10, dur: 60 } }, Ra = Object.assign(D.recNew(), { launched: true, apexSci: 47e3 }), sa = { alive: true, landed: false, body: T, r: [T.R + 47e3, 0, 0], v: [100, 0, 0] };
  const up = st(ap, Ra, sa), upNow = now(ap, Ra, sa, 'apex'); sa.v = [-100, 0, 0]; const down = st(ap, Ra, sa);
  Object.assign(Ra, { landed: true, recSci: true }); sa.landed = true; const home = st(ap, Ra, sa), paid = !!D.CT.apex.ok(Ra, ap.p) && D.jobMet(ap, Ra, sa);
  const Rb = Object.assign(D.recNew(), { launched: true, apexSci: 56e3 }), high = st(ap, Rb, sa); Object.assign(Rb, { landed: true, recSci: true }); const highHome = st(ap, Rb, sa);
  const Rc = Object.assign(D.recNew(), { launched: true, apexSci: 47e3, landed: true, recSci: false }), noPkg = st(ap, Rc, sa);
  check('job conditions: the sounding run reads open "now 47 km" climbing, met falling, recovered pending, then all met; past 55 km lost and still lost once home; down without the package: recovered lost',
    up.apex === 'open' && upNow === 'now 47 km' && up.rec === 'pending' && down.apex === 'met' && down.rec === 'pending' && home.apex === 'met' && home.rec === 'met' && paid
      && high.apex === 'lost' && highHome.apex === 'lost' && noPkg.rec === 'lost', JSON.stringify({ up, upNow, down, home, high, highHome, noPkg }));
  const bh = { type: 'bioHop', p: { g: 5 } }, Rg = Object.assign(D.recNew(), { launched: true, bio: true, bioSpace: true, gMax: 6.2 }), g1 = st(bh, Rg); Rg.landed = true; const g2 = st(bh, Rg);
  const bp = D.CT.ballistic.gen(D.rng(5)), bl = { type: 'ballistic', p: bp }, b0 = st(bl, D.recNew()), b1 = st(bl, Object.assign(D.recNew(), { launched: true, site: 'elsewhere' }));
  const sat = { type: 'sat', p: { alt: 300, tol: 25, inc: 45, itol: 3 } }, ended = st(sat, Object.assign(D.recNew(), { launched: true, ended: true })), live = st(sat, Object.assign(D.recNew(), { launched: true }));
  const rangeM = D.MISSIONS.find(M => M.id === 'range'); P.streak = 2; const rg = st(rangeM, Object.assign(D.recNew(), { ended: true }));
  check('job conditions: over 5 g is lost and stays lost on landing; a ballistic test open before launch, lost from another site; an orbit open in flight, lost once the flight is over; the range streak waits (pending), never lost',
    g1.g === 'lost' && g2.g === 'lost' && g2.safe === 'met' && g2.space === 'met' && b0.site === 'open' && b1.site === 'lost' && live.inc === 'open' && ended.inc === 'lost' && ended.orbit === 'lost' && rg.streak === 'pending',
    JSON.stringify({ g1, g2, b0, b1, live, ended, rg }));
  // the between-flight types and world missions: one cond, judged at home; needs and legs well formed; procKey ignores the aim
  const homeOK = [...HOMEJ.map(k => ({ type: k, p: params(k)[0] || { st: 1, ci: 0 } })), ...MW].every(x => { const C = D.jobConds(x, D.recNew()); return C.length === 1 && C[0].home && C[0].state === 'pending'; });
  const LEGK = new Set(['orbit', 'hop', 'flyby', 'land', 'meet', 'home', 'stay']), hopper = D.newShip(D.PRESETS.Hopper);
  const legsOK = FLIGHT.every(k => params(k).every(p => { const L = D.CT[k].legs(p); return L.length > 0 && L.length <= 3 && L.every(l => LEGK.has(l.k)); })) && MF.every(M => M.legs().length > 0 && M.legs().every(l => LEGK.has(l.k)));
  const nApex = D.jobNeeds({ type: 'apex', p: ap.p }, hopper), nLift = D.jobNeeds({ type: 'lift', p: { m: 1 } }, hopper), nTest = D.jobNeeds({ type: 'test', p: { k: 'kestrel', q: 20 } }, hopper);
  const needsOK = nApex.length === 2 && !nApex.find(n => n.id === 'sci').ok && nApex.find(n => n.id === 'chute').ok && !nLift[0].ok && nTest.find(n => n.id === 'part:kestrel').ok
    && [...FLIGHT.flatMap(k => params(k).map(p => ({ type: k, p }))), ...D.MISSIONS].every(x => D.jobNeeds(x, hopper).every(n => n.id && n.t && !/undefined|NaN/.test(n.t) && typeof n.ok === 'boolean'));
  const tree = { k: 'pod', ch: [{ k: 't2' }] }, keyOK = D.procKey({ ...tree, aim: { jobs: ['m:beeper'], legs: [{ k: 'orbit', b: 'Tellus', alt: 300, inc: 'pad' }] } }) === D.procKey(tree)
    && D.procKey(Object.assign(D.PRESETS.Hopper.slice(), { aim: { jobs: [1] } })) === D.procKey(D.PRESETS.Hopper);
  check('job conditions: the between-flight types and world missions are one "judged at home" cond (pending); legs well formed (1–3, known kinds); needs read a design (the Hopper: chute yes, package no, a Kestrel aboard); procKey ignores stack.aim',
    homeOK && legsOK && needsOK && keyOK, `home ${homeOK}; legs ${legsOK}; needs ${needsOK} ${JSON.stringify(nApex)}; procKey ${keyOK}`);
}

// econ-38. What a mission opens (economy reader for flow, QUEUE Q570; Caio 2026-11-11, the gameplay loop): opensOf(id)
// lists the missions whose last missing req it is, the contract types it gates (CT.req), the parts and rover parts it
// unlocks (PART_GATE, RV_GATE). For each of the 29 missions, in two programs (only its ancestors done; everything done but
// it and what follows from it), opensOf, asked before and after, equals the before/after diff of missionOpen, of
// offerTypes over every source (the world's own gates, CT.open, set aside: they wait on a station or a satellite, not on
// the mission) and of partOpen / rvPartOpen. The beeper opens 2 missions, 6 kinds of contract, 21 parts (since Q577's map, 20; the shaped frame, Q617; 5, 8 and 7 before) and the rover
// antenna; opensNames merges several missions' lists (one done by another isn't "opened") and opensLine says it in a line.
{
  const D = new Function(src + 'return {CT,MISSIONS,PROG,HOOK,PARTS,RV_GATE,opensOf,opensNames,opensLine,offerTypes,missionOpen,partOpen,rvPartOpen,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 0, rel: {}, op: {}, sanc: {}, done: {}, own: null, decisions: [], site: null }); D.chooseStart('agency');
  const M = D.MISSIONS, byId = id => M.find(m => m.id === id), SRC = [...new Set(Object.values(D.CT).flatMap(t => t.src))];
  const anc = id => { const out = new Set(), go = x => { for (const r of byId(x).req || []) if (!out.has(r)) { out.add(r); go(r); } }; go(id); return out; };
  const desc = id => M.filter(m => m.id !== id && anc(m.id).has(id)).map(m => m.id);
  for (const k in D.CT) if (D.CT[k].open) { D.CT[k].open0 = D.CT[k].open; delete D.CT[k].open; }   // the world's gates aside
  const snap = () => ({ m: M.filter(m => !P.done[m.id] && D.missionOpen(m)).map(m => m.id), c: [...new Set(SRC.flatMap(s => D.offerTypes(s)))],
    p: Object.keys(D.PARTS).filter(k => D.partOpen(k).ok), r: Object.entries(D.RV_GATE).flatMap(([kind, o]) => Object.keys(o).filter(k => D.rvPartOpen(kind, k).ok).map(k => kind + ':' + k)) });
  const diff = (a, b) => b.filter(x => !a.includes(x)).sort().join(','), srt = L => L.slice().sort().join(',');
  const got = O => ({ m: srt(O.missions), c: srt(O.contracts), p: srt(O.parts), r: srt(O.rover) }), bad = [];
  let runs = 0, any = 0;
  for (const m of M) for (const [state, done] of [['ancestors', [...anc(m.id)]], ['all else', M.map(x => x.id).filter(x => x !== m.id && !desc(m.id).includes(x))]]) {
    P.done = Object.fromEntries(done.map(x => [x, { flight: 1, day: 0 }])); const a = snap(), O = D.opensOf(m.id);
    P.done[m.id] = { flight: 1, day: 0 }; const b = snap(), O2 = D.opensOf(m.id);
    const want = { m: diff(a.m, b.m), c: diff(a.c, b.c), p: diff(a.p, b.p), r: diff(a.r, b.r) };
    for (const g of [got(O), got(O2)]) { runs++; if (JSON.stringify(want) !== JSON.stringify(g)) bad.push(`${m.id} (${state}): want ${JSON.stringify(want)} got ${JSON.stringify(g)}`); }
    if (want.m || want.c || want.p || want.r) any++; }
  for (const k in D.CT) if (D.CT[k].open0) { D.CT[k].open = D.CT[k].open0; delete D.CT[k].open0; }
  P.done = { weather: { flight: 1, day: 0 }, loads: { flight: 1, day: 0 } }; const B = D.opensOf('beeper'), N = D.opensNames(['beeper']), line = D.opensLine(N), full = D.opensLine(N, true);
  P.done = {}; const two = D.opensNames(['weather', 'beeper']), none = D.opensLine(D.opensNames(['nyxland']));
  const facts = B.missions.length === 2 && B.contracts.length === 6 && B.parts.length === 21 && B.rover.join() === 'it:ant'
    && line === '2 missions · 6 kinds of contract · 22 parts' && full.includes('Weather satellite') && full.includes('rover high-gain antenna')
    && N.contracts.every(x => x.t && !/^[a-z]+[A-Z]/.test(x.t)) && none === ''
    && !two.missions.some(x => x.id === 'beeper') && two.missions.length === 2 && two.contracts.length === 7;   // (the unlock map, Q577: the satellite bench; the hop and the beeper wait for the structural test)
  check('econ-38: opensOf, for all 29 missions in two programs and asked before and after, equals the before/after diff of missionOpen, offerTypes and partOpen/rvPartOpen; the beeper opens 2 missions, 6 kinds of contract, 21 parts (the satellite bench, Q577) and the rover antenna; opensNames merges; opensLine',
    M.length === 29 && !bad.length && any >= 20 && facts,
    `${runs} comparisons, ${bad.length} wrong${bad.length ? `: ${bad.slice(0, 3).join(' | ')}` : ''}; ${any} openings non-empty · beeper: "${full}" · weather+beeper: ${two.missions.length} missions, ${two.contracts.length} kinds`);
}

// econ-39. The unlock map as data (economy, QUEUE Q577; the plan Q573, notes/economy.md § "Plan: the unlock map and
// chapters"; review/2026-11-11/q573/m3.mjs's checks): every part is open at the start, gated by a mission or by its era;
// with only a mission's req closure done, its needs and its NEXT_PRESET are open; each contract type's needs are open at
// its req; a part already flown stays open; the qualification contract draws only open parts; the structural test's bar.
{
  const D = new Function(src + 'return {PROG,HOOK,PARTS,PART_GATE,MISSIONS,CT,CT_JOB,NEXT_PRESET,PRESETS,newShip,partOpen,partLaunchWhy,kinOf,rng,LOADS_Q,M_JOB,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 0, rel: {}, op: {}, sanc: {}, cert: {}, done: {}, kh: {}, flights: 1, decisions: [], offers: [], active: [] }); D.chooseStart('agency');
  const START = ['sparrow', 't1', 't2', 'cone', 'chute', 'sci', 'dec', 'fins', 'rfin', 'ballast', 'bwt', 'spin'], keys = Object.keys(D.PARTS);
  const era = keys.filter(k => D.PARTS[k].era != null), gated = keys.filter(k => D.PART_GATE[k]), free = keys.filter(k => D.PARTS[k].era == null && !D.PART_GATE[k]);
  const ids = new Set(D.MISSIONS.map(M => M.id)), badGate = gated.filter(k => !ids.has(D.PART_GATE[k])), badKey = Object.keys(D.PART_GATE).filter(k => !D.PARTS[k]);
  check('unlock map: twelve parts at the start, the rest on a mission or an era, every gate a real mission and a real part',
    free.slice().sort().join() === START.slice().sort().join() && gated.length === 69 && era.length + gated.length + free.length === keys.length && !badGate.length && !badKey.length,
    `${keys.length} parts: ${free.length} at the start, ${gated.length} on ${new Set(gated.map(k => D.PART_GATE[k])).size} missions, ${era.length} by era${badGate.length ? '; bad gates ' + badGate : ''}${badKey.length ? '; no such part ' + badKey : ''}`);
  const M = Object.fromEntries(D.MISSIONS.map(x => [x.id, x])), clos = ids0 => { const S = new Set(); const go = id => { for (const r of M[id].req || []) if (!S.has(r)) { S.add(r); go(r); } }; ids0.forEach(go); return S; };
  const at = S => { P.done = Object.fromEntries([...S].map(id => [id, { day: 0, flight: 1 }])); P.kh = {}; return { parts: keys.filter(k => D.partOpen(k).ok).map(k => ({ d: D.PARTS[k], on: true })) }; };
  const needsOf = (J, p) => { try { return (typeof J.needs === 'function' ? J.needs(p) : J.needs) || []; } catch (e) { return []; } };
  const has = (n, v) => n.id === 'mass' ? v.parts.some(p => p.d.kind === 'ballast') : n.has(v);   // (a mass need is a quantity: the simulators being open is the gate)
  const badM = [];
  for (const X of D.MISSIONS) { const v = at(clos([X.id])), J = D.M_JOB[X.id] || {}, miss = needsOf(J, {}).filter(n => !has(n, v)).map(n => n.id), pk = D.NEXT_PRESET[X.id], pw = pk ? D.partLaunchWhy(D.newShip(D.PRESETS[pk]).parts) : '';
    if (miss.length || pw) badM.push(`${X.id}: ${miss.join(',')}${pw ? ' ' + pk + ' ' + pw : ''}`); }
  const badC = [];
  for (const t in D.CT) { const T = D.CT[t], S = T.req ? clos([T.req]) : new Set(); if (T.req) S.add(T.req); const v = at(S), J = D.CT_JOB[t] || T;
    const miss = needsOf(J, { k: 'sparrow', m: 0.5, kind: 'hab', sat: 1, name: 'x' }).filter(n => !has(n, v)).map(n => n.id); if (miss.length) badC.push(`${t} (req ${T.req || '-'}): ${miss}`); }
  check('unlock map: with only its req closure done, each mission\'s needs and NEXT_PRESET are open; each contract type\'s needs at its req', !badM.length && !badC.length,
    [...badM, ...badC].join(' · ') || `${D.MISSIONS.length} missions, ${Object.keys(D.CT).length} contract types`);
  const req = id => (M[id].req || []).slice().sort().join('+');
  check('unlock map: the six req changes (beeper and hop after weather and the structural test, TV after the weather satellite, a station after TV, the far side after the weather satellite and Heavy lift II, servicing and modules after TV); and a crew aboard after the max-q abort (a crew flies only after it)',
    req('beeper') === 'loads+weather' && req('hop') === 'loads+weather' && req('tv') === 'wxsat' && req('station1') === 'tv' && req('farside') === 'lift2+wxsat' && req('stationcrew') === 'maxqabort+station1' && D.CT.service.req === 'tv' && D.CT.stExpand.req === 'tv',
    ['beeper', 'hop', 'tv', 'station1', 'farside', 'stationcrew'].map(id => id + '←' + req(id)).join(' '));
  at(new Set()); const shut = !D.partOpen('kestrel').ok && /Structural test flight/.test(D.partOpen('kestrel').why);
  P.kh = { kestrel: { use: 0.3, reg: {} } }; const flown = D.partOpen('kestrel').ok, other = !D.partOpen('petrel').ok;
  const side = keys.find(k => D.PARTS[k].kin && D.PART_GATE[k]); let kin = true; if (side) { P.kh = { [D.kinOf(side)]: { use: 0.3, reg: {} } }; kin = D.partOpen(side).ok; }
  check('unlock map: a part already flown stays open (an old save keeps it); one never flown follows the map', shut && flown && other && kin, `kestrel closed, open once flown; petrel still closed${side ? `; ${side} open by its kin ${D.kinOf(side)}` : ''}`);
  at(new Set()); const R = D.rng(7), drawn = new Set(); for (let i = 0; i < 200; i++) { const o = D.CT.test.gen(R); if (o) drawn.add(o.p ? o.p.k : o.k); }
  at(new Set(['weather', 'loads'])); const R2 = D.rng(7), drawn2 = new Set(); for (let i = 0; i < 200; i++) { const o = D.CT.test.gen(R2); if (o) drawn2.add(o.p ? o.p.k : o.k); }
  check('unlock map: the qualification contract draws only open parts (the Kestrel after the structural test, never the Condor before Heavy lift I)',
    [...drawn].every(k => START.includes(k)) && drawn2.has('kestrel') && !drawn2.has('condor'), `start: ${[...drawn]} · after the structural test: ${[...drawn2]}`);
  const L = M.loads, ok = q => L.ok({ sciQ: q });
  check('unlock map: the structural test\'s bar is 20 kPa (W50), in the mission and its job\'s condition', D.LOADS_Q === 20000 && ok(20000) && !ok(19900) && /20 kPa/.test(L.brief) && /20 kPa/.test(D.M_JOB.loads.conds[0].t || ''),
    `ok at 20.0 kPa: ${ok(20000)}, at 19.9: ${ok(19900)}`);
  P.done = {}; P.kh = {};
}

// econ-41. Economy on intent (economy, QUEUE R18, W47's defaults, review 2026-11-09 § 2): a market saturates (each
// further satellite selling TV or imagery adds half the one before: `mktShare`), a privatization is sold once per
// career, and each foreign power buys a stake once (the same friend used to come back for a second 15 %).
{
  const A = new Function(src + 'return {PROG,HOOK,mktShare,decisionTick,resolveDecision,programNew,chooseStart,rng,own,POWERS,pairKey,careerMove};')(), P = A.PROG;
  A.HOOK.save = () => {}; A.HOOK.msg = () => {}; A.HOOK.news = () => {}; A.programNew(); A.chooseStart('agency');
  const tot = n => n * A.mktShare(n), sat = [1, 2, 3, 5, 10].map(tot);
  Object.assign(P, { done: { a: {}, b: {}, c: {} }, day: 500 });
  const friend = A.POWERS.find(p => p.i !== P.home); P.rel[A.pairKey(P.home, friend.i)] = 0.9;
  for (const p of A.POWERS) if (p.i !== P.home && p !== friend) P.rel[A.pairKey(P.home, p.i)] = -0.5;
  const R = A.rng(7); let ipos = 0, stakes = 0;
  for (let n = 0; n < 400; n++) { P.day += 30; A.decisionTick(30, R, 30);
    for (const d of [...P.decisions]) { if (d.kind === 'ipo') { ipos++; A.resolveDecision(d.id, 'yes'); } else if (d.kind === 'stake') { stakes++; A.resolveDecision(d.id, 'yes'); } else A.resolveDecision(d.id, d.opts ? d.opts[d.opts.length - 1][0] : 'no'); } }
  const fr = A.own().st[friend.i] || 0;
  A.careerMove({ kind: 'hire', co: 'Testco', amt: 100 }); const reset = P.ipoSold === false && !Object.keys(P.stakeBy).length;
  check('econ-41: satellite markets saturate (1, 2, 3, 5, 10 satellites earn 1, 1.5, 1.75, 1.94, 2.0× one); in 33 years of offers, one privatization and one stake from the one friendly power (15 %, not 30 %); a career move starts the books over',
    Math.abs(sat[0] - 1) < 1e-12 && Math.abs(sat[1] - 1.5) < 1e-12 && Math.abs(sat[3] - 1.9375) < 1e-12 && sat[4] < 2 && ipos === 1 && stakes === 1 && Math.abs(fr - 0.15) < 1e-9 && reset,
    `totals ${sat.map(x => x.toFixed(3)).join(' ')}; ipos ${ipos}, stakes ${stakes}, friend's share ${(fr * 100).toFixed(0)} %, reset ${reset}`);
}

// econ-40. No `Infinity` in the saved core bracket (economy, QUEUE R16, review 2026-11-09 § 2): `seisLocate` started
// Selene's core bracket at `hi: Infinity`; a save (or the simulator's snapshot) turns that into `null`, `null < Infinity`
// is true, `coreW` went negative and "Bound Selene's core" paid at once. Now `hi: null` means no bound yet; readers take
// both null and an old in-memory Infinity as unbounded.
{
  const A = new Function(src + 'return {PROG,HOOK,selSci,selN,progJSON,progRestore,progLossy,LOGF,CT};')(), P = A.PROG;
  A.HOOK.save = () => {}; A.HOOK.msg = () => {}; A.HOOK.news = () => {};
  const S = A.selSci(); S.quakes = [{ id: 1 }]; S.core = { lo: 3e5, hi: null, n: 1 };
  const lossy = A.progLossy(P), w0 = A.selN().coreW; A.progRestore(A.progJSON()); const w1 = A.selN().coreW;
  P.sel.core.hi = Infinity; const wInf = A.selN().coreW; A.progRestore(A.progJSON()); const w2 = A.selN().coreW;
  const fmt = A.LOGF.find(f => f.id === 'secore').fmt, txt = fmt({ lo: 3e5, hi: null, n: 1 });
  const dn = A.CT.selCore.done({ p: { w: 300 } }, A.selN()); P.sel.core = { lo: 3e5, hi: 5e5, n: 2 }; const wB = A.selN().coreW;
  check('econ-40: Selene\'s core bracket survives a save: unbounded stays unbounded (null or an old Infinity), "Bound Selene\'s core" is not done by a reload; a real bracket still measures',
    !lossy.length && w0 === Infinity && w1 === Infinity && wInf === Infinity && w2 === Infinity && !dn && /no S-wave shadow/.test(txt) && Math.abs(wB - 200) < 1e-9,
    `done ${dn}; lossy [${lossy.join(', ')}]; widths ${w0} ${w1} ${wInf} ${w2}, bracket ${wB}; log "${txt.slice(0, 40)}"`);
}

// econ-42. Families, reasons and chapters as data (economy, QUEUE Q579; plan Q573 rules 3 and 6; D34): a family is every
// part one mission opens, named (one unlock card, one reason line); every gated part has a "what it makes possible" line;
// every mission sits in one chapter, whose capstone is one of its own; no closed part goes on the stand, into development
// or onto a production line (a run would write its know-how, and a part fired or flown stays open); a mission done
// between flights waits in PROG.cardQ for the desk's cards.
{
  const A = new Function(src + 'return {PROG,HOOK,PARTS,PART_GATE,PART_FAMILY,famOf,famParts,partWhy,CHAPTERS,chapterOf,chaptersNow,MISSIONS,programNew,chooseStart,partOpen,startTest,prodQuote,devQuote,missionComplete,PROG_SCHEMA};')(), P = A.PROG;
  A.HOOK.save = () => {}; A.HOOK.msg = () => {}; A.HOOK.news = () => {}; A.HOOK.done = () => {}; A.programNew(); A.chooseStart('agency');
  const gated = Object.keys(A.PARTS).filter(k => A.PART_GATE[k] || A.PARTS[k].era != null), noWhy = gated.filter(k => !A.partWhy(k));
  const fams = Object.keys(A.PART_FAMILY), famBad = fams.filter(f => { const ps = A.famParts(f), m = A.PART_FAMILY[f].m;
    return ps.length < 2 || ps.some(k => A.famOf(k) !== f) || Object.keys(A.PART_GATE).some(k => A.PART_GATE[k] === m && A.PARTS[k] && !ps.includes(k)) || !A.PART_FAMILY[f].name || !A.PART_FAMILY[f].why; });
  const inCh = A.CHAPTERS.flatMap(c => c.missions), chBad = A.CHAPTERS.filter(c => !c.missions.includes(c.capstone) || !c.question || !c.grants.length || !c.name);
  const cover = A.MISSIONS.every(M => inCh.filter(id => id === M.id).length === 1) && inCh.length === A.MISSIONS.length;
  const now0 = A.chaptersNow().map(c => c.id).join(); P.done = { weather: { day: 0 }, loads: { day: 0 } }; const now1 = A.chaptersNow().map(c => c.id).join();
  P.done = {}; P.funds = 5000; P.stand2 = { ready: 0, job: null, done: 0 };
  const shut = !A.partOpen('kestrel').ok, stand = A.startTest('kestrel', 'qual') === false && !P.stand2.job && !(P.kh || {}).kestrel, standOK = A.startTest('sparrow', 'qual') === true;
  const pq = A.prodQuote('kestrel'), dq = A.devQuote('kestrel', 'cheap'), prod = !pq.own.ok && !pq.lic.ok && /not open yet/.test(pq.own.why) && /not open yet/.test(pq.lic.why) && !dq.ok && /not open yet/.test(dq.why);
  P.cardQ = []; A.missionComplete(A.MISSIONS.find(m => m.id === 'diswatch'), null); const q = P.cardQ.join() === 'diswatch' && !!A.PROG_SCHEMA.cardQ;
  check('econ-42: families match the map (each is one mission\'s parts, named, with its line); every gated part says what it makes possible; every mission in one chapter, each capstone its own; a fresh program is in chapter 1, after the structural test in chapter 2; no closed part on the stand, in development or on a line; a world mission queues its cards',
    !noWhy.length && fams.length >= 5 && !famBad.length && !chBad.length && cover && now0 === 'c1' && now1 === 'c2' && shut && stand && standOK && prod && q,
    `no why: ${noWhy.join(',') || '-'}; families ${fams.map(f => `${f} ${A.famParts(f).length}`).join(', ')} (bad: ${famBad.join(',') || '-'}); chapters bad ${chBad.map(c => c.id).join(',') || '-'}, cover ${cover}; now ${now0} → ${now1}; stand ${stand}/${standOK}; line/dev ${prod}; cardQ ${q}`);
}

// econ-43. One formula each, no copies (economy, QUEUE R19, review 2026-11-09 § 2): a launch's operations fee
// (`opsOf`), its stacking days (`stackDays`), an engine's odds of not lighting (`ignFail`, with development's "reliable"
// steps, which career.mjs's copy lacked) and the two pay premiums (`PAY_MIL`, `PAY_FAR`, were a literal *1.6 in 15 pays).
{
  const A = new Function(src + 'return {PROG,HOOK,ignFail,IGN_FAIL,khUse,opsOf,OPS_FIX,OPS_FRAC,stackDays,prepDays,khVessel,FAC,facLv,newShip,PRESETS,vesselCost,PAY_MIL,PAY_FAR,CT,rng,programNew,chooseStart};')();
  const P = A.PROG; A.HOOK.save = () => {}; A.HOOK.msg = () => {}; A.HOOK.news = () => {}; A.programNew(); A.chooseStart('agency');
  const k = 'petrel', f0 = A.ignFail(k), want = A.IGN_FAIL * (1 - A.khUse(k)) ** 2; P.dev = { [k]: { rel: 2 } }; const f2 = A.ignFail(k); P.dev = {};
  const v = A.newShip(A.PRESETS.Orbiter), c = A.vesselCost(v.parts).cost, ops = A.opsOf(c), days = A.stackDays(c, v);
  const opsOK = Math.abs(ops - (A.OPS_FIX + A.OPS_FRAC * c)) < 1e-12, daysOK = Math.abs(days - A.prepDays(c) * (1 + 0.5 * (1 - A.khVessel(v))) * A.FAC.hall.eff[A.facLv('hall')]) < 1e-12;
  const rd = f => readFileSync(new URL('./' + f, import.meta.url), 'utf8'), sim = ['sim/program.js', 'sim/contracts.js', 'app/rollout.js', 'career.mjs'].map(f => [f, rd(f)]);
  const copies = sim.flatMap(([f, s]) => [/OPS_FIX\s*\+\s*OPS_FRAC/, /IGN_FAIL\s*\*/, /prepDays\([^)]*\)\s*\*\s*\(1\s*\+\s*0\.5/, /\*\s*1\.6(?=[,}])/].filter(re => (s.match(new RegExp(re.source, 'g')) || []).length > (f === 'sim/program.js' && re.source !== '\*\s*1\.6(?=[,}])' ? 1 : 0)).map(re => f + ' ' + re.source));
  const R = A.rng(3), mil = A.CT.recon.gen(R), mil2 = A.CT.milLift.gen(R);
  check('econ-43: one formula each: ignFail is the know-how odds and two "reliable" steps take it to 0.36×; opsOf and stackDays are the launch\'s fee and days; no copies left in the sim, Rollout or career.mjs; the pay premiums are named (1.6 each)',
    Math.abs(f0 - want) < 1e-12 && Math.abs(f2 - 0.36 * f0) < 1e-12 && opsOK && daysOK && !copies.length && A.PAY_MIL === 1.6 && A.PAY_FAR === 1.6 && mil && mil2 && Math.abs(mil2.pay - 22 * mil2.m * 1.6) < 1e-9,
    `ignFail ${f0.toFixed(4)} (want ${want.toFixed(4)}), rel 2: ${f2.toFixed(4)}; ops ${ops.toFixed(2)}, days ${days.toFixed(1)}; copies: ${copies.join(' · ') || 'none'}`);
}

// econ-44. A failed automatic run asks the player (QA, QUEUE Q580; Caio 2026-11-12: "a failure should alert the player,
// who decides what to do"): three clean runs certify a route once; when an automatic run then fails, the routine holds and
// a decision waits in the in-tray, keep repeating or stop. Before, the failure quietly sent the route back to three more
// clean runs by order, and the robot's m2 (which only waits) never saw it repeat again. Own SIM copy.
{
  const D = new Function(src + 'return {PROG,HOOK,routeRun,routeAutoWhy,setRouteAuto,resolveDecision,routeCtl};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  Object.assign(P, { day: 2600, decisions: [], dispatch: [], sats: [], routes: [{ id: 1, name: 'Lookouts at 300 km, 82°', stack: [], alt: 300, inc: 82, keep: 2, auto: false, paused: false, runs: 3, clean: 3 }] });
  const r = P.routes[0], fail = n => D.routeRun({ route: 1, title: `Lookouts, run ${n}`, satId: null }, { ok: false, why: 'it broke up in the climb' });
  const on = D.setRouteAuto(1, true).ok;
  fail(4); const d1 = P.decisions.find(d => d.kind === 'routine'), held = r.paused && r.auto, why1 = D.routeAutoWhy(r), ctl = D.routeCtl(r);
  D.resolveDecision(d1.id, 'keep'); const kept = r.auto && !r.paused && D.routeAutoWhy(r) === '';
  fail(5); const d2 = P.decisions.find(d => d.kind === 'routine'); D.resolveDecision(d2.id, 'stop'); const stopped = !r.auto && !r.paused;
  fail(6); const quiet = !P.decisions.some(d => d.kind === 'routine');   // Repeat off: an ordered run's failure is just news
  const again = D.setRouteAuto(1, true).ok && r.auto;                    // certified once: Repeat can come back without the ladder
  check('routine (Q580): a failed automatic run holds the routine and asks (keep repeating or stop); the answer is kept; Repeat, once earned, needs no new clean runs',
    on && !!d1 && held && /in-tray/.test(why1) && !/clean run/.test(why1) && /held after a failed run/.test(ctl) && d1.opts.map(o => o[0]).join() === 'keep,stop' && kept && !!d2 && stopped && quiet && again,
    `${d1 && d1.title}: "${d1 && d1.text}" · held: "${why1}" · ${news.filter(t => /Your call|routine/.test(t)).slice(0, 3).join(' | ')}`);
}
