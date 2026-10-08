// The Selene and Nyx mission ladders (epochs 4–5), flown from the pad by procedures on two uncrewed presets, Probe and
// Sample Return (bodies session, 2026-10-08). Each design's ascent is hand-flown once (attitude set directly, as in test.mjs
// §28) and recorded as its procedure; then each mission is a list of procedure phases, flown by the game's executor (SAS,
// staging, the predictor, rails) with only that mission's prerequisites done. A mission counts when its own check passes.
//   node fly_ladder.mjs                 the whole ladder, a table at the end
//   node fly_ladder.mjs selland nyxorb  just those (add -v for each flight's phase log)
// 'nyxorb:pro' is a control, not a mission: the same Nyx orbit forced prograde, which Tellus's tide should wreck.
export const LADDER = SR => [
  // [mission, preset, phases, prerequisites done]
  ['farside', 'Probe', [{ k: 'transfer', to: 'Selene', pass: 150e3, side: 'far', sunFar: true }], ['beeper']],
  ['selimp', 'Probe', [{ k: 'transfer', to: 'Selene', pass: -0.4 * SR, side: 'near' }], ['beeper', 'farside']],
  ['selland', 'Probe', [{ k: 'transfer', to: 'Selene', pass: 30e3, side: 'near' }, { k: 'capture', ap: 200e3, pe: 20e3 }, { k: 'land' }], ['beeper', 'farside', 'selimp']],
  ['selsample', 'Sample Return', [{ k: 'transfer', to: 'Selene', pass: 15e3 }, { k: 'capture', ap: 100e3, pe: 15e3 }, { k: 'land' }, { k: 'surface', t: 600 },
    { k: 'ascend', stage: 0, pitchH: 3000, ap: 20e3, pe: 15e3 }, { k: 'return', perigee: 45e3 }], ['beeper', 'farside', 'selimp', 'selland']],
  ['nyxfind', 'Probe', [{ k: 'transfer', to: 'Nyx', pass: 300e3 }], ['beeper', 'farside']],
  ['nyxfly', 'Probe', [{ k: 'transfer', to: 'Nyx', pass: 200e3 }], ['beeper', 'farside', 'nyxfind']],
  ['nyxorb', 'Probe', [{ k: 'transfer', to: 'Nyx', pass: 40e3, retro: true }, { k: 'capture', ap: 80e3, pe: 30e3 }], ['beeper', 'farside', 'nyxfind', 'nyxfly']],
  ['nyxorb:pro', 'Probe', [{ k: 'transfer', to: 'Nyx', pass: 40e3, retro: false }, { k: 'capture', ap: 80e3, pe: 30e3 }], ['beeper', 'farside', 'nyxfind', 'nyxfly']],
  ['nyxland', 'Probe', [{ k: 'transfer', to: 'Nyx', pass: 100e3 }, { k: 'capture', ap: 300e3, pe: 40e3 }, { k: 'land' }], ['beeper', 'farside', 'nyxfind', 'nyxfly']],
];
// a hand-flown ascent to a low orbit (vertical to 200 m, flat by 38 km, circularised toward circular-orbit velocity); the
// game records it as the design's procedure
export function handAscent(api, st) {
  const { TELLUS, len, norm, add, sub, mul, dot, cross, elements } = api, ATM = TELLUS.atm, AS = ATM / 7e4, tgt = ATM + 10000;
  api.t = 0; const s = api.newShip(st); api.S = s; api.advPhys(s); s.sas = false; s.throttle = 1; api.stage(s); let k = 0, phase = 'up';
  const point = Y => { const f = api.localFrame(s.r), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  const pitch = d => { const f = api.localFrame(s.r), r = d * Math.PI / 180; point(norm(add(mul(f.e, Math.cos(r)), mul(f.up, Math.sin(r))))); };
  while (s.alive && k++ < 400000) { const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - TELLUS.R;
    if (phase === 'up') { const f = Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))); pitch(90 * (1 - Math.pow(f, 0.6))); if (el.ap - TELLUS.R > tgt) { s.throttle = 0; phase = 'coast'; } }
    else if (phase === 'coast') { pitch(0); s.throttle = h < ATM && el.ap - TELLUS.R < tgt - 500 ? 0.3 : 0;
      const dvC = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a));   // a weak upper stage starts early: half its burn before apoapsis
      if (h > ATM && api.timeToNu(el, Math.PI) < Math.max(25, 0.5 * dvC / Math.max(api.engAcc(s), 0.1))) phase = 'circ'; }
    else { const f = api.localFrame(s.r), hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), need = sub(mul(hv, Math.sqrt(TELLUS.mu / len(s.r))), s.v); point(norm(need)); s.throttle = 1;
      if (el.pe - TELLUS.R > ATM + 2000 || len(need) < 3) { s.throttle = 0; api.advRails(s, 10, 100); break; } }
    if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) api.stage(s);
    api.advPhys(s); }
  return s;
}
// fly the listed missions (all by default); returns one row per flight
export function flyLadder(api, ids = null, say = () => {}) {
  const { TELLUS, len } = api, P = api.PROG, asc = {}, out = [];
  api.HOOK.msg = m => { if (!/Logbook/.test(m)) say(`  [${(api.t / 3600).toFixed(2)} h] ${m}`); }; api.HOOK.news = m => { if (/✔|Procedure|pictures|impactor|Down on/i.test(m)) say(`  news [${(api.t / 3600).toFixed(2)} h] ${m}`); }; api.HOOK.save = () => {};
  for (const [id, pre, phases, done] of LADDER(api.SELENE.R)) { if (ids && !ids.includes(id)) continue;
    const st = api.PRESETS[pre], key = api.procKey(st), M = api.MISSIONS.find(m => m.id === id.split(':')[0]);
    if (!asc[pre]) { P.procs = {}; P.done = { beeper: { flight: 0, day: 0 } }; P.funds = 1e6; const s = handAscent(api, st); asc[pre] = P.procs[key];
      say(`${pre}: hand-flown ascent ${s.alive && asc[pre] ? 'recorded' : 'FAILED'}, ${s.rec.dv.toFixed(0)} m/s`); if (!asc[pre]) continue; }
    // only this mission's prerequisites; Nyx is on the map once it has been weighed (nyxfind)
    P.procs = { [key]: asc[pre] }; P.done = Object.fromEntries(done.map(k => [k, { flight: 0, day: 0 }])); P.funds = 1e6; P.log = P.log || {};
    if (done.includes('nyxfind')) P.log.nyx = P.log.nyx || { v: {} }; else delete P.log.nyx;
    say(`== ${id} (${pre})`);
    api.t = 0; const s = api.newShip(st); api.S = s; api.advPhys(s); api.procStart(s, { ...asc[pre], kind: 'mission', phases }); let k = 0, tEnd = null, last = '';
    while (s.alive && k++ < 3e6 && !M.ok(s.rec)) { const X = s.proc;
      if (X.done) { if (tEnd == null) tEnd = api.t; if (api.t - tEnd > 5 * 86400 || s.landed) break; if (api.railsOK(s)) api.advRails(s, 600, 1000); else api.advPhys(s); continue; }   // the procedure's done: coast up to 5 days for the rest (pictures home, an orbit that lasts)
      if (X.wake > api.t + 2 && api.railsOK(s)) api.advRails(s, Math.min(600, X.wake - api.t), 1000); else api.advPhys(s);
      const tag = `${X.phase}:${X.mi ?? ''}:${X.sub || ''}`; if (tag !== last) { last = tag; say(`  [${(api.t / 3600).toFixed(2)} h] ${tag} ${s.body.name} ${((len(s.r) - s.body.R) / 1e3).toFixed(1)} km, left ${api.dvPlan(s, 0).map(x => x.dv.toFixed(0)).join('/')}`); } }
    out.push({ id, preset: pre, ok: !!M.ok(s.rec), alive: s.alive, at: s.body.name, days: +(api.t / 86400).toFixed(2), dv: Math.round(s.rec.dv), left: Math.round(api.dvRemaining(s).tot),
      touch: +(s.touchV || s.crashSpeed || 0).toFixed(1), cost: Math.round(api.vesselCost(api.newShip(st).parts).cost) }); }
  return out;
}
// a landing on a chosen point (QUEUE Q13): lat/lon in degrees from the point under Tellus (Y is the spin axis); returns how
// far from it the craft came down. Needs a Probe-like design (the ascent is hand-flown and recorded first).
export function siteOf(api, B, lat, lon) {
  const { norm, mul, add, cross } = api, near = norm(api.toPF(B, norm(mul(api.bodyRel(B, 0)[0], -1)), 0)), east = norm(cross([0, 1, 0], near)), la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
  return norm(add(mul(add(mul(near, Math.cos(lo)), mul(east, Math.sin(lo))), Math.cos(la)), mul([0, 1, 0], Math.sin(la))));
}
export function flySite(api, preset, bodyName, lat, lon) {
  const { len, sub } = api, P = api.PROG, st = api.PRESETS[preset], key = api.procKey(st), B = api.BODIES.find(b => b.name === bodyName), site = siteOf(api, B, lat, lon);
  api.HOOK.msg = () => {}; api.HOOK.news = () => {}; api.HOOK.save = () => {};
  P.procs = {}; P.done = { beeper: { flight: 0, day: 0 } }; P.funds = 1e6; handAscent(api, st); const asc = P.procs[key];
  P.done = Object.fromEntries(['beeper', 'farside', 'selimp', 'nyxfind', 'nyxfly'].map(k => [k, { flight: 0, day: 0 }])); P.log = P.log || {}; P.log.nyx = P.log.nyx || { v: {} };
  const low = B.name === 'Nyx' ? { pass: 15e3, ap: 25e3, pe: 10e3 } : { pass: 10e3, ap: 20e3, pe: 8e3 };
  const phases = [{ k: 'transfer', to: B.name, pass: low.pass, site }, { k: 'capture', ap: low.ap, pe: low.pe }, { k: 'land', site }];
  api.t = 0; const s = api.newShip(st); api.S = s; api.advPhys(s); api.procStart(s, { ...asc, kind: 'mission', phases }); let k = 0;
  while (s.alive && s.proc && !s.proc.done && k++ < 3e6) { const X = s.proc; if (X.wake > api.t + 2 && api.railsOK(s)) api.advRails(s, Math.min(600, X.wake - api.t), 1000); else api.advPhys(s); }
  return { alive: s.alive, landed: s.landed && s.body === B, touch: s.touchV || 0, miss: s.landed ? len(sub(s.r, api.siteAt(B, site, api.t))) : null, left: api.dvRemaining(s).tot, days: api.t / 86400, dev: s.procDev };
}
// run directly: build the SIM from index.html, fly, print the table
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('fly_ladder.mjs')) {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
  const api = new Function(src + `return {PRESETS,TELLUS,SELENE,MISSIONS,newShip,stage,advPhys,advRails,railsOK,localFrame,qFromBasis,elements,timeToNu,dvRemaining,dvPlan,engAcc,HOOK,PROG,len,norm,add,sub,mul,dot,cross,procStart,procKey,vesselCost,
    get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)();
  const ids = process.argv.slice(2).filter(a => !a.startsWith('-')), v = process.argv.includes('-v');
  console.table(flyLadder(api, ids.length ? ids : null, m => { if (v || !/^\s/.test(m)) console.log(m); }));
}
