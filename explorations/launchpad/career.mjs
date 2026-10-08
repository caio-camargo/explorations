// Career runner: plays whole programs for a few in-game years through the real economy code (contracts, budget days,
// decisions, the race, sanctions, opinion), with each flight abstracted: a scripted player picks a design, pays its
// real price (real presets, real sourcing), and gets the flight record that design produces, succeeding with a set
// probability. Everything after the flight is the game's own code. Run: node career.mjs [years] [seeds]
// Output: one line per archetype × ownership start, averaged over seeds.
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `
return {missionTick,missionEval,missionEnd,missionDrop,contractEval,acceptOffer,declineOffer,resolveDecision,advanceDays,chooseStart,ensureBoard,
  PROG,CT,MISSIONS,newShip,vesselCost,POWERS,ARCH,flav,opOf,own,ownKind,stateShare,raceLost,RACE,RIVALS,sanctioned,capOf,offerRisk,missionOpen,
  TELLUS,HOOK,rng,raceSchedule,PRESETS,PARTS,PRICE,norm,cross,khUse,FAC,facLv,facQuote,buildFac,standReady,buildStand,testQuote,startTest,STAND_COST,devQuote,startDev,devLv,prodLine,prodQuote,startProdLine,sourceOf,tierOf,IGN_FAIL,get home(){return HOME},resetWorld(){HOME=0;RIVALS=raceSchedule()},set S(v){S=v},set t(v){simT=v},get t(){return simT}};`)();
const { PROG: P, CT, TELLUS } = api;
const YEARS = +(process.argv[2] || 3), SEEDS = +(process.argv[3] || 3), VARIANT = process.argv[4] || 'base', DAYS = 400 * YEARS, ATMK = TELLUS.atm / 1e3;
const news = []; api.HOOK.news = t => news.push(t); api.HOOK.msg = () => {}; api.HOOK.save = () => {};

// ---- designs: what each costs (real presets) and the flight record it produces
const SOUND_S = ['chute', 'sci', 't1', 'fins', 'sparrow'], SOUND_B = ['chute', 'sci', 't2', 'fins', 'sparrow'], QUAL = ['chute', 'sci', 't2', 'fins', 'kestrel'];
const cost = st => api.vesselCost(api.newShip(st).parts).cost;
const PLANS = {
  sound: a => ({ kind: 'sound', stack: a > 20 ? SOUND_B : SOUND_S, apex: a, p: 0.93, dur: 900 }),
  qual: (k, q) => ({ kind: 'qual', stack: [...QUAL, ...(k && !QUAL.includes(k) ? [k] : [])], q: Math.max(q, 40), apex: 17, p: 0.88, dur: 700 }),
  hop: g => ({ kind: 'hop', stack: api.PRESETS?.Passenger || ['chute', 'bio', 'dec', 't4', 'fins', 'sparrow'], g: g < 7.1 ? 5.0 : 7.1, gentle: g < 7.1, p: 0.9, dur: 1300, drops: 1 }),
  orbit: (alt, inc, m = 0) => ({ kind: 'orbit', stack: m > 1 ? 'Heavy' : 'Orbiter', alt, inc, m, p: 0.86, dur: 3600, drops: 2 }),
  passOrbit: g => ({ kind: 'passOrbit', stack: 'Orbiter', g, p: 0.8, dur: 9000, drops: 2, bio: true }),
  ballistic: u => ({ kind: 'ballistic', stack: SOUND_B, u, apex: 90, p: 0.9, dur: 1200 }),
};
function planCost(pl) {
  let st = typeof pl.stack === 'string' ? api.PRESETS[pl.stack] : pl.stack;
  if (pl.kind === 'orbit') st = [...(pl.m > 1 ? api.PRESETS.Heavy : api.PRESETS.Orbiter), 'sci', ...Array(Math.round(pl.m / 0.5)).fill('ballast')];
  if (pl.kind === 'passOrbit') st = ['chute', 'bio', 'pod', 'shield', ...api.PRESETS.Orbiter.slice(2)];
  let c = cost(st);
  if (pl.kind === 'orbit') c *= 1 + pl.alt / 1500 + pl.inc / 120;   // more fuel for higher and more inclined orbits
  if (pl.gentle) c *= 1.25;
  return { c, st };
}
// the flight record a successful flight of this plan produces (filled into s.rec before the game evaluates it)
function outcome(pl, R, rnd) {
  const pad = () => { R.landDist = (5 + 55 * rnd()) * 1e3; };
  if (pl.kind === 'sound' || pl.kind === 'qual' || pl.kind === 'ballistic') {
    const a = Math.min(pl.apex, 140) * 1e3; R.apex = R.apexSci = a; for (let k = 0; k * 1e4 < Math.min(a, TELLUS.atm); k++) R.bands[k] = 1;
    R.sciQ = pl.kind === 'qual' ? pl.q * 1e3 : 18e3; for (const k of R._keys) R.qPart[k] = R.sciQ;
    if (pl.kind === 'ballistic') { R.endSci = true; const off = rnd() < 0.6 ? 0.02 * rnd() : 0.2; R.endPf = [pl.u[0], pl.u[1] + off, pl.u[2]].map(x => x * TELLUS.R); return 'sea'; }
    pad(); return 'land';
  }
  if (pl.kind === 'hop') { R.apex = 98e3; R.bioSpace = true; R.gMax = pl.g; pad(); return 'land'; }
  if (pl.kind === 'orbit') { const e = (rnd() * 15 + 2) * 1e3; R.orbit = R.orbitSci = true; R.orb = { pe: pl.alt * 1e3 - e, ap: pl.alt * 1e3 + e * rnd(), inc: pl.inc + (rnd() - 0.5), sci: true }; R.lift = pl.m; return 'orbit'; }
  if (pl.kind === 'passOrbit') { R.orbit = true; R.bioSpace = true; R.bioOrbits = 1.2; R.gMax = 4.3; pad(); return 'land'; }
}
// what a candidate flight would satisfy, by running the game's own checks on the record it would produce
function wouldDo(pl) {
  const R = { bands: {}, qPart: {}, _keys: [pl.qk].filter(Boolean), apex: 0, apexSci: 0, recSci: true, landed: true, bio: !!(pl.kind === 'hop' || pl.bio), bioOK: true, approved: true, lift: 0, landDist: 1e9 };
  const k = outcome(pl, R, () => 0.5); if (k === 'orbit') R.landed = false;
  let pay = 0; for (const c of P.active) if (CT[c.type].ok(R, c.p)) pay += c.p.pay;
  // firsts are worth more than their reward: they unlock contract types and the next firsts (a player goes for them)
  for (const M of api.MISSIONS) if (!P.done[M.id] && api.missionOpen(M)) { try { if (M.ok(R)) pay += M.pay * (api.RACE.includes(M.id) ? 1.8 : 1) + 60; } catch (e) {} }
  return pay;
}
function fitContract(c) {
  const p = c.p;
  switch (c.type) {
    case 'apex': return PLANS.sound((p.lo + p.hi) / 2);
    case 'sample': return (p.k + 1) * 10 <= ATMK + 30 ? PLANS.sound(p.k * 10 + 8) : null;
    case 'test': { const pl = PLANS.qual(p.k, p.q); pl.qk = p.k; return pl; }
    case 'landing': return PLANS.sound(30);
    case 'bioHop': case 'touristHop': return PLANS.hop(p.g);
    case 'touristOrbit': return PLANS.passOrbit(p.g);
    case 'sat': case 'recon': return PLANS.orbit(p.alt, p.inc);
    case 'lift': case 'milLift': return PLANS.orbit(150, 0, p.m);
    case 'ballistic': return PLANS.ballistic(p.u);
    default: return null;   // imaging needs a camera satellite: outside this runner
  }
}
const FIRST_PLAN = { weather: () => PLANS.sound(15), air: () => PLANS.sound(45), loads: () => PLANS.qual('kestrel', 40), range: () => PLANS.hop(7.5),
  beeper: () => PLANS.orbit(150, 0), hop: () => PLANS.hop(7.5), orbiter: () => PLANS.passOrbit(5), lift1: () => PLANS.orbit(150, 0, 0.5), lift2: () => PLANS.orbit(150, 0, 2) };

// the regimes each part went through, as the game's own khMark would record them for this kind of flight
function khFill(s, R, pl, ok) {
  const orbit = pl.kind === 'orbit' || pl.kind === 'passOrbit', high = orbit || (pl.apex || 98) * 1e3 > TELLUS.atm, landed = ok && !(pl.kind === 'orbit');
  const first = new Set((s.events[0] && s.events[0].ignite) || []);
  for (const p of s.parts) { const k = p.d.key, set = R.khSeen[k] || (R.khSeen[k] = {}); set.fly = 1; if (!ok) { set.fail = 1; continue; }
    set.maxq = 1; if (high) set.vac = 1; if (orbit) set.orbit = 1; if (landed && high) set.heat = 1; if (landed) set.land = 1;
    if (p.d.kind === 'engine') { set.burn = 1; if (high && !first.has(p.seg)) set.vburn = 1; } }
}
// an upper-stage engine that won't light loses the flight (a first-stage one just scrubs and is retried)
function ignitionFails(s) { const first = new Set((s.events[0] && s.events[0].ignite) || []); let okP = 1;
  for (const p of s.parts) { if (p.d.kind !== 'engine' || first.has(p.seg)) continue; const L = api.prodLine(p.d.key);
    okP *= 1 - api.IGN_FAIL * (1 - api.khUse(p.d.key)) ** 2 * (L ? 2 - L.m : 1); }
  return 1 - okP; }
const SUPPORT_K = 1.5, SUPPORT_USE = 0.45, seenParts = new Set();
function fly(pl, rnd, m) {
  const { st } = planCost(pl); api.t = 0;
  const s = api.newShip(st); api.S = s;
  if (VARIANT === 'support') for (const k of new Set(s.parts.map(q => q.d.key))) {   // runner-only model of a support package
    if (seenParts.has(k)) continue; seenParts.add(k); const x = api.sourceOf(k); if (x.how !== 'import') continue;
    P.funds -= SUPPORT_K * (api.PRICE[k] ?? 3); P.kh = P.kh || {}; const e = P.kh[k] || (P.kh[k] = { use: 0, reg: {} }); e.use = Math.max(e.use || 0, SUPPORT_USE); m.support++; }
  s.landed = false;
  api.missionTick(s, 0, false);                   // the launch: charged, stacking days pass
  const R = s.rec; R._keys = [...new Set(s.parts.map(q => q.d.key))];
  const ign = rnd() < ignitionFails(s); if (ign) m.ign++;
  const ok = !ign && rnd() < pl.p;
  khFill(s, R, pl, ok);
  if (!ok) { s.alive = false; R.apex = 5e3; if (R.bio) { R.bioOK = false; R.bioWhy = 'was lost with the vessel'; } }
  else {
    const k = outcome(pl, R, rnd);
    if (k === 'orbit') { s.landed = false; s.alive = true; }
    else { s.landed = true; s.alive = true; s.touchV = 5; s.pf = [TELLUS.R, 0, 0]; const ld = R.landDist; R.landed = false; api.missionTick(s, 0, false); R.landDist = ld; }
    api.missionEval(s);
  }
  const dropSegs = s.events.flatMap(e => e.decouple || []);
  for (let i = 0; i < (pl.drops || 0); i++) { const x = rnd(), seg = dropSegs[i], parts = seg != null ? s.parts.filter(q => q.seg === seg) : [];
    const u = R.launchPf ? api.norm(R.launchPf) : [1, 0, 0], a = (300 + 600 * rnd()) * 1e3 / TELLUS.R, t = rnd() * 6.2832, e1 = api.norm(api.cross(u, [0, 1, 0])), e2 = api.cross(u, e1);
    const pf = u.map((c, k) => (c * Math.cos(a) + (e1[k] * Math.cos(t) + e2[k] * Math.sin(t)) * Math.sin(a)) * TELLUS.R);
    api.missionDrop(s, { kind: x < 0.85 ? 'sea' : x < 0.97 ? 'land' : 'near', power: null, pf, parts }); }
  api.t = pl.dur; api.missionEnd(s);
  return ok;
}

// a prudent investor: keeps a reserve, qualifies only parts it doesn't know yet, develops only parts it flies a lot
const INV = (process.env.INV || 'fac,stand,test,dev').split(','), RESERVE = +(process.env.RESERVE || 250), KH_TEST = 0.7, DEV_MIN = 5;
function invest(m) {
  for (const id of ['hall', 'fleet']) if (INV.includes('fac') || INV.includes(id)) { const q = api.facQuote(id); if (q.ok && q.cost != null && P.funds > q.cost + RESERVE && api.buildFac(id)) { m.facSpend += q.cost; m.fac++; } }
  if (INV.includes('test') && !P.stand2 && P.funds > api.STAND_COST + RESERVE && api.buildStand()) { m.facSpend += api.STAND_COST; m.fac++; }
  const used = Object.keys(m.used).filter(k => api.PARTS[k]).sort((a, b) => m.used[b] - m.used[a]).slice(0, 6);
  if (INV.includes('test') && api.standReady() && !P.stand2.job) { const k = used.filter(k => api.khUse(k) < KH_TEST).sort((a, b) => api.khUse(a) - api.khUse(b))[0]; if (k) { const q = api.testQuote(k, 'qual'); if (P.funds > q.cost + RESERVE && api.startTest(k, 'qual')) { m.testSpend += q.cost; m.tests++; } } }
  if (INV.includes('dev') && !P.devJob) for (const k of used.filter(k => m.used[k] >= DEV_MIN)) for (const g of ['cheap', 'rel', 'dur']) { const q = api.devQuote(k, g); if (q.ok && P.funds > q.cost + RESERVE && api.startDev(k, g)) { m.devSpend += q.cost; m.devs++; return; } }
}
function run(arch, start, seed) {
  api.resetWorld(); seenParts.clear();
  Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: 60, bailouts: 0, day: 0, rel: {}, op: {}, offers: null, active: [], cdone: 0, stand: {}, recs: {},
    cycle: 0, cyc: null, own: null, decisions: [], sanc: {}, home: 0, history: [], homeArch: arch, nat: {}, hush: 0, hushPen: 0, bmult: 1, demand: null, cancelled: false,
    nextElection: null, comm: 0, commPh: null, wseed: 1000 + seed * 77, raceLost: {}, sats: [], stations: [], kh: {}, lines: {}, fac: {}, stand2: null, dev: {}, devJob: null });
  api.resetWorld(); api.chooseStart(start); api.ensureBoard(); news.length = 0;
  const rnd = api.rng(seed * 9973 + 1), m = { fl: 0, fail: 0, minF: P.funds, at: {}, firsts: {}, careers: 0, sanc: 0, idle: 0, ign: 0, support: 0, lines: 0, lineSpend: 0, used: {}, fac: 0, facSpend: 0, tests: 0, testSpend: 0, devs: 0, devSpend: 0 };
  while (P.day < DAYS && m.fl < 600) {
    // decisions: take a loan when rescued, otherwise decline offers (a conservative player)
    for (const d of [...(P.decisions || [])]) { if (d.kind === 'rescue') api.resolveDecision(d.id, 'loan'); else if (d.kind === 'defect' || d.kind === 'hire') m.careers++; }
    // take the best-paying offers we have a design for, avoiding certain home sanctions
    for (const c of [...P.offers].sort((a, b) => b.p.pay - a.p.pay)) {
      if (P.active.length >= api.capOf()) break; const pl = fitContract(c); if (!pl) continue;
      if (api.offerRisk(c).now.includes(api.home)) continue; if (planCost(pl).c > P.funds + c.p.pay) continue; api.acceptOffer(c.id);
    }
    // the flight worth most (pay of everything it would complete, minus cost) that we can afford
    const cands = [...P.active.map(fitContract), ...api.MISSIONS.filter(M => !P.done[M.id] && api.missionOpen(M)).map(M => FIRST_PLAN[M.id]?.())].filter(Boolean);
    let best = null; for (const pl of cands) { const c = planCost(pl).c; if (c > P.funds) continue; const v = wouldDo(pl) * pl.p - c; if (!best || v > best.v) best = { pl, v }; }
    if (best && best.v > -5) { const ok = fly(best.pl, rnd, m); m.fl++; if (!ok) m.fail++;
      for (const k of new Set(planCost(best.pl).st)) m.used[k] = (m.used[k] || 0) + 1;
      // lines policy: a part flown three times and bought abroad gets a line, if there's money to spare
      if (VARIANT === 'lines' || VARIANT === 'all') for (const k of Object.keys(m.used).filter(k => m.used[k] >= 3).sort((a, b) => m.used[b] - m.used[a])) {
        const x = api.sourceOf(k); if (x.how !== 'import' && x.how !== 'grey') continue; if ((P.lines || {})[k]) continue;
        const q = api.prodQuote(k), mode = q.lic.ok ? 'lic' : q.own.ok ? 'own' : null; if (!mode || P.funds < q[mode].cost + 120) continue;
        if (api.startProdLine(k, mode)) { m.lines++; m.lineSpend += q[mode].cost; } break; }
      if (VARIANT === 'all') invest(m); }
    else { api.advanceDays(10); m.idle += 10; }
    m.minF = Math.min(m.minF, P.funds);
    for (const y of [1, 2, 3, 4, 5]) if (P.day >= 400 * y && m.at[y] == null) m.at[y] = P.funds;
    for (const id in P.done) if (m.firsts[id] == null) m.firsts[id] = Math.round(P.day);
  }
  m.sanc = news.filter(t => /imposes sanctions/.test(t)).length;
  return { ...m, final: P.funds, kh: avg(Object.keys(P.kh || {}).map(k => api.khUse(k))) || 0, kind: api.ownKind(), bail: P.bailouts || 0, debt: (api.own().debt || 0), cd: P.cdone || 0, op: api.opOf(api.home),
    race: api.RACE.map(id => P.done[id] ? (api.raceLost(id) != null ? '2' : '1') : (api.raceLost(id) != null ? 'L' : '-')).join(''), home: api.home };
}

function avg(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
const f0 = x => x.toFixed(0).padStart(5);
console.log(`career runner [${VARIANT}]: ${YEARS} years (${DAYS} days), ${SEEDS} seeds each · race: 1 first, 2 second, L lost (not done), - open (beeper/hop/orbiter)`);
console.log('archetype    start       flights fail% idle%  firsts  day:beeper/orbiter  contracts  funds y1/y2/final  min  bail debt  op  careers sanc race   | ignF  kh%  lines spent  support');
for (const arch of Object.keys(api.ARCH)) for (const start of (process.argv[5] || 'agency,company,consortium').split(',')) {
  const rs = []; for (let k = 0; k < SEEDS; k++) rs.push(run(arch, start, k + 1));
  const day = id => { const d = rs.map(r => r.firsts[id]).filter(x => x != null); return d.length ? f0(avg(d)) + (d.length < rs.length ? '*' : ' ') : '   — '; };
  if (process.env.SPEND) { console.log(`${arch.padEnd(12)} ${start.padEnd(10)} final ${f0(avg(rs.map(r => r.final)))} fl ${f0(avg(rs.map(r => r.fl)))} bail ${(avg(rs.map(r => r.bail))).toFixed(1)} | lines ${f0(avg(rs.map(r => r.lineSpend)))} facilities ${f0(avg(rs.map(r => r.facSpend)))} (${(avg(rs.map(r => r.fac))).toFixed(1)}) tests ${f0(avg(rs.map(r => r.testSpend)))} (${(avg(rs.map(r => r.tests))).toFixed(0)}) dev ${f0(avg(rs.map(r => r.devSpend)))} (${(avg(rs.map(r => r.devs))).toFixed(0)}) kh ${f0(100 * avg(rs.map(r => r.kh)))}%`); continue; }
  console.log(`${arch.padEnd(12)} ${start.padEnd(10)} ${f0(avg(rs.map(r => r.fl)))}  ${f0(100 * avg(rs.map(r => r.fail / Math.max(1, r.fl))))} ${f0(100 * avg(rs.map(r => r.idle / DAYS)))}   ${(avg(rs.map(r => Object.keys(r.firsts).length))).toFixed(1).padStart(4)}   ${day('beeper')}/${day('orbiter')}        ${f0(avg(rs.map(r => r.cd)))}   ${f0(avg(rs.map(r => r.at[1] ?? r.final)))}/${f0(avg(rs.map(r => r.at[2] ?? r.final)))}/${f0(avg(rs.map(r => r.final)))} ${f0(avg(rs.map(r => r.minF)))} ${(avg(rs.map(r => r.bail))).toFixed(1).padStart(4)} ${f0(avg(rs.map(r => r.debt)))} ${f0(avg(rs.map(r => r.op)))}  ${(avg(rs.map(r => r.careers))).toFixed(1).padStart(4)}  ${(avg(rs.map(r => r.sanc))).toFixed(1).padStart(4)}  ${rs.map(r => r.race).join(' ')} | ${(avg(rs.map(r => r.ign))).toFixed(1).padStart(4)} ${f0(100 * avg(rs.map(r => r.kh)))} ${(avg(rs.map(r => r.lines))).toFixed(1).padStart(5)} ${f0(avg(rs.map(r => r.lineSpend)))}  ${(avg(rs.map(r => r.support))).toFixed(1).padStart(5)}`);
}
