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
  check('cover: kept in PROG.recs, which a new game resets', /recs:\{\}/.test(H.slice(H.indexOf('// ==== SIM END'))));
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
  check('why: the Contracts tab shows it', pg.includes('Why: ${c.why}'));
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
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, stand: {}, done: {}, own: null, decisions: [], offers: [], active: [], cdone: 0, flights: 3, kh: {}, sel: null }); D.chooseStart('agency');
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
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], flights: 5, staged: {},
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
    own: null, decisions: [], offers: [], active: [], flights: 3 }); D.chooseStart('company');
  const R = D.rng(11); let n = 0, low = []; for (let k = 0; k < 400; k++) for (const src of ['sci', 'com', 'gov', 'tour', 'mil']) { const o = D.genOffer(src, R); if (!o) continue; n++; const f = D.payFloor(o.type); if (o.p.pay < f - 1e-9) low.push(`${o.type} ${o.p.pay} < ${f}`); }
  check('pay floor: in a frugal world, low standing and a deep recession, no offer pays under its floor', n > 500 && !low.length && D.payFloor('apex') > 10 && D.payFloor('sat') > D.payFloor('apex'),
    `${n} offers; floors: sounding ${D.payFloor('apex')}M, test ${D.payFloor('test')}M, hop ${D.payFloor('bioHop')}M, satellite ${D.payFloor('sat')}M${low.length ? '; under: ' + low.slice(0, 3).join(', ') : ''}`);
  const c = { id: 501, type: 'apex', src: 'sci', client: 1, p: { lo: 20, hi: 30, pay: 15, dur: 100 }, deadline: P.day + 100 }; P.active = [c];
  const s0 = D.standOf('sci'), o0 = D.opOf(1), ok = D.withdrawContract(501), again = D.withdrawContract(501);
  check('withdraw: frees the slot at once, at a missed deadline\'s cost in standing and the client\'s opinion', ok && !again && P.active.length === 0 && D.standOf('sci') === Math.max(0, s0 - 10) && D.opOf(1) < o0,
    `standing ${s0} → ${D.standOf('sci')}, opinion ${o0.toFixed(1)} → ${D.opOf(1).toFixed(1)}`);
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  check('withdraw: taken contracts show the button', pg.includes('data-wd="${c.id}"') && pg.includes('withdrawContract(+ds.wd)'));
}

// econ-10. Dispatched flights launch from their procedure's site and pay its lease (economy session, QUEUE Q95).
{
  const D = new Function(src + 'return {dispatchQuote,dispatchSite,baseRunQuote,siteAccess,procKey,SITES,PROG,HOOK,pairKey,resetHome:()=>{HOME=0;RIVALS=raceSchedule()},chooseStart};')();
  const P = D.PROG; D.HOOK.news = () => {}; D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, kh: {}, lines: {}, own: null, decisions: [], active: [], offers: [], fac: {}, dispatch: [],
    done: { beeper: { flight: 0, day: 0 } }, flights: 3, funds: 2000 }); D.chooseStart('agency');
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
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, stand: {}, done: { beeper: { day: 1 } }, own: null, decisions: [], offers: [], active: [], flights: 3, cdone: 0 }); D.chooseStart('agency');
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
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 50, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], flights: 4, cdone: 0, staged: {},
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
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], flights: 5, fac: {}, stations: [] }); D.chooseStart('agency');
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
  check('network model: the screen reads netModel() when it exists', /typeof netModel==='function'\?netModel\(\)/.test(N));
}

// econ-15. Rival personalities in the race and the program's own voice (economy session, QUEUE Q165, POWERS.md): a
// frugal power doesn't race; a rising power copies the first of the race's firsts, then catches up; our firsts are
// announced in the home archetype's voice.
{
  const D = new Function(src + 'return {raceSchedule,RACE,POWERS,missionComplete,MISSIONS,PROG,HOOK,resetHome:()=>{HOME=0},chooseStart};')();
  const P = D.PROG, news = []; D.HOOK.news = t => news.push(t); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  D.resetHome(); Object.assign(P, { homeArch: 'frugal', day: 10, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], flights: 1, done: {}, raceLost: {}, staged: {} }); D.chooseStart('agency');
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
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], flights: 5, cdone: 0, done: { beeper: { day: 1, flight: 1 } } }); D.chooseStart('agency');
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
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, own: null, decisions: [], offers: [], active: [], flights: 5, cdone: 0, staged: {},
    done: { weather: { day: 1, flight: 1 }, beeper: { day: 2, flight: 2 } } }); D.chooseStart('agency');
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
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 100, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], flights: 5, cdone: 0, done: { beeper: { day: 1, flight: 1 } } }); D.chooseStart('agency');
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
  D.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, stand: {}, own: null, decisions: [], offers: [], active: [], flights: 5, cdone: 0, done: { beeper: { day: 1, flight: 1 } } }); D.chooseStart('agency');
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
