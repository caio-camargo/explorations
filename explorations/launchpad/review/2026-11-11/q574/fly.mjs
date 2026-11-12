// Q574: fly the first-hour presets to a low orbit (tests' handAscent, copied and instrumented) and log where the pad
// station's link is lost against where each burn falls. node fly.mjs [preset names...]   (cwd = explorations/launchpad)
import { src } from './api.mjs';
const mkX = () => { const X = new Function(src + `return {PRESETS,TELLUS,PROG,HOOK,newShip,stage,advPhys,advRails,localFrame,qFromBasis,elements,timeToNu,dvRemaining,engAcc,
  len,norm,add,sub,mul,dot,cross,kepler,linkOf,stationsAll,gsSees,gsSites,gsCheck,toPF,curSite,plasmaOn,nodeBurnTime,statXfer,capital,CITIES,STAT_R,avOf,isLand,alongAz,
  get HOME(){return HOME},get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)(); X.HOOK.news = () => {}; X.HOOK.msg = () => {}; X.HOOK.save = () => {}; return X; };
const km = x => (x / 1e3).toFixed(0), deg = x => x * 180 / Math.PI;

// mode: 'guided' (the tests' circularisation: steer at the velocity still needed) · 'held' (the aim at the burn's start, held
// inertially, for the guided burn's duration `dur`) · 'apo' (prograde-at-apoapsis held inertially, a burn of the computed
// duration centred on apoapsis: the "one stored command")
function fly(api, name, mode = 'guided', dur = 0, log = () => {}) {
  const { TELLUS, len, norm, add, sub, mul, dot, cross, elements } = api, ATM = TELLUS.atm, AS = ATM / 7e4, tgt = ATM + 10000, R = TELLUS.R, st = api.PRESETS[name];
  // AZ: the launch azimuth, degrees from north (90 = east); SHIP: a tracking ship that many km downrange along it
  const AZ = +(process.env.AZ || 90), SHIP = +(process.env.SHIP || 0), ship = SHIP ? { name: 'ship', u: api.alongAz(api.curSite().u, AZ * Math.PI / 180, SHIP * 1e3 / TELLUS.R) } : null;
  const linkOf = s => { const L = api.linkOf(s); if (!L.ok && L.why === 'no station in view' && ship && api.gsSees(ship, api.toPF(TELLUS, s.r, api.t))) return { ok: true, why: 'ship' }; return L; };
  api.t = 0; const s = api.newShip(st); api.S = s; api.advPhys(s); s.sas = false; s.throttle = 1; api.stage(s); let k = 0, phase = 'up';
  const u0 = norm(api.toPF(TELLUS, s.r, api.t)), down = () => Math.acos(Math.max(-1, Math.min(1, dot(norm(api.toPF(TELLUS, s.r, api.t)), u0)))) * R;
  const ev = [], mark = (what, extra = {}) => { const e = { what, t: api.t, down: down(), h: len(s.r) - R, link: linkOf(s).ok, stage: s.evIdx, ...extra }; ev.push(e); log(e); };
  const point = Y => { const f = api.localFrame(s.r), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  const pitch = d => { const f = api.localFrame(s.r), r = d * Math.PI / 180, A = AZ * Math.PI / 180, hz = AZ === 90 ? f.e : norm(add(mul(f.n, Math.cos(A)), mul(f.e, Math.sin(A)))); point(norm(add(mul(hz, Math.cos(r)), mul(f.up, Math.sin(r))))); };
  let link = true, nSamp = 0, hold = null, tStart = 0, tEnd = 0, lastStage = s.evIdx;
  const sample = () => { if (nSamp++ % 25) return; const L = linkOf(s); if (L.ok !== link) { link = L.ok; mark(link ? 'AOS' : 'LOS', { why: L.why }); } };
  while (s.alive && k++ < 400000) { const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - R;
    if (phase === 'up') { const f = Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))); pitch(90 * (1 - Math.pow(f, 0.6))); if (el.ap - R > tgt) { s.throttle = 0; phase = 'coast'; mark('ascent burn ends', { ap: el.ap - R, pe: el.pe - R }); } }
    else if (phase === 'coast') { pitch(0); const thr = h < ATM && el.ap - R < tgt - 500 ? 0.3 : 0; s.throttle = thr;
      const dvC = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a)), tb = api.nodeBurnTime(s, dvC), lead = mode === 'apo' ? tb / 2 : Math.max(25, 0.5 * dvC / Math.max(api.engAcc(s), 0.1));
      if (h > ATM && api.timeToNu(el, Math.PI) < lead) { phase = 'circ'; tStart = api.t; tEnd = tStart + (mode === 'apo' ? tb : dur);
        if (mode === 'held') { const f = api.localFrame(s.r), hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))); hold = norm(sub(mul(hv, Math.sqrt(TELLUS.mu / len(s.r))), s.v)); }
        if (mode === 'apo') { const hh = cross(s.r, s.v), e = sub(mul(cross(s.v, hh), 1 / TELLUS.mu), norm(s.r)); hold = norm(cross(norm(hh), mul(norm(e), -1))); }
        mark('circ burn starts', { dvC, tb, toAp: api.timeToNu(el, Math.PI), ap: el.ap - R, pe: el.pe - R }); } }
    else { if (mode === 'guided') { const f = api.localFrame(s.r), hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), need = sub(mul(hv, Math.sqrt(TELLUS.mu / len(s.r))), s.v); point(norm(need)); s.throttle = 1;
        if (el.pe - R > ATM + 2000 || len(need) < 3) { s.throttle = 0; mark('circ burn ends', { ap: el.ap - R, pe: el.pe - R, dur: api.t - tStart }); break; } }
      else { point(hold); s.throttle = 1; if (api.t >= tEnd) { s.throttle = 0; mark('circ burn ends', { ap: el.ap - R, pe: el.pe - R, dur: api.t - tStart }); break; } } }
    if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) api.stage(s);
    if (s.evIdx !== lastStage) { lastStage = s.evIdx; mark('staged', { phase }); }
    api.advPhys(s); sample(); }
  return { s, ev, link };
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : ['Beeper', 'Passenger Orbiter', 'Satellite', 'TV Satellite'];
for (const name of names) {
  const api = mkX(), { TELLUS, len } = api, R = TELLUS.R;
  if (process.env.SHIP) { const u = api.alongAz(api.curSite().u, +(process.env.AZ || 90) * Math.PI / 180, +process.env.SHIP * 1e3 / R); console.log(`ship ${process.env.SHIP} km along azimuth ${process.env.AZ || 90}: ${api.isLand(u) ? 'LAND there' : 'sea there'}`); }
  if (process.env.ONLYASC) { fly(api, name, 'guided', 0, e => console.log(`  t ${e.t.toFixed(0).padStart(5)} s  ${e.what.padEnd(18)} down ${km(e.down).padStart(5)} km  alt ${km(e.h).padStart(4)} km  link ${e.link ? 'yes' : 'NO '}${e.why ? '  (' + e.why + ')' : ''}${e.pe != null ? `  ap ${km(e.ap)} pe ${km(e.pe)}` : ''}`)); continue; }
  console.log(`\n=== ${name}  (site ${api.curSite().name}; stations: ${api.stationsAll().map(x => x.name).join(', ')})`);
  const show = e => console.log(`  t ${e.t.toFixed(0).padStart(5)} s  ${e.what.padEnd(18)} down ${km(e.down).padStart(5)} km  alt ${km(e.h).padStart(4)} km  link ${e.link ? 'yes' : 'NO '}  stage ${e.stage}` +
    (e.ap != null ? `  ap ${km(e.ap)} pe ${km(e.pe)}` : '') + (e.dvC != null ? `  dvC ${e.dvC.toFixed(0)} m/s, burn ${e.tb.toFixed(0)} s, ${e.toAp.toFixed(0)} s to apoapsis` : '') + (e.dur != null ? `  burned ${e.dur.toFixed(1)} s` : '') + (e.why ? `  (${e.why})` : ''));
  const G = fly(api, name, 'guided', 0, show), s = G.s; if (!s.alive) { console.log('  LOST', s.lossWhy); continue; }
  const los = G.ev.find(e => e.what === 'LOS' && e.why === 'no station in view'), cs = G.ev.find(e => e.what === 'circ burn starts'), ce = G.ev.find(e => e.what === 'circ burn ends'), ab = G.ev.find(e => e.what === 'ascent burn ends');
  console.log(`  -> contact lost ${los ? (cs.t - los.t).toFixed(0) + ' s BEFORE' : 'not before'} the circularising burn starts; coast from cutoff to the burn ${(cs.t - ab.t).toFixed(0)} s; ` + (los ? `the horizon takes the link ${(los.t - ab.t).toFixed(0)} s after the ascent cutoff` : ''));
  // two orbits on rails, the link sampled every 5 s
  const el = api.elements(s.r, s.v, TELLUS.mu), t0 = api.t; let link = api.linkOf(s).ok, inC = 0, n = 0; const tr = [];
  while (api.t - t0 < 2 * el.period) { api.advRails(s, 5, 100); const L = api.linkOf(s).ok; n++; if (L) inC++; if (L !== link) { link = L; tr.push(`${L ? 'AOS' : 'LOS'} +${((api.t - ce.t) / 60).toFixed(1)} min`); } }
  console.log(`  orbit ${km(el.pe - R)} x ${km(el.ap - R)} km, period ${(el.period / 60).toFixed(1)} min; over two orbits: ${tr.join(', ') || 'no change'}; in contact ${(100 * inC / n).toFixed(1)} % of the time`);
  // the stored command: the same burn held inertially
  const H = fly(mkX(), name, 'held', ce.dur), eh = H.ev.find(e => e.what === 'circ burn ends');
  const A = fly(mkX(), name, 'apo'), ea = A.ev.find(e => e.what === 'circ burn ends');
  console.log(`  circularising: guided ${km(ce.pe)} x ${km(ce.ap)} km in ${ce.dur.toFixed(1)} s | start aim held, same duration: ${eh ? km(eh.pe) + ' x ' + km(eh.ap) + ' km' : 'lost'} | prograde-at-apoapsis held, computed ${ea ? ea.dur.toFixed(1) + ' s centred: ' + km(ea.pe) + ' x ' + km(ea.ap) + ' km' : 'lost'}`);
  if (name === 'TV Satellite') { const X = api.statXfer(s); if (!X) { console.log('  statXfer: null'); continue; }
    const sees = (r, T) => { const pf = api.toPF(TELLUS, r, T); return [api.curSite(), ...api.gsSites().filter(ci => api.gsCheck(ci).ok).map(ci => api.CITIES[ci])].filter(st => api.gsSees({ name: st.name, u: st.u }, pf)).map(st => st.name); };
    const tB = api.t + X.dt, a = (len(X.r) + api.STAT_R) / 2, half = Math.PI * Math.sqrt(a ** 3 / TELLUS.mu), [r1, v1] = api.kepler(s.r, s.v, X.dt, TELLUS.mu), vb = api.add(v1, api.mul(api.norm(v1), X.dv)), [r2] = api.kepler(r1, vb, half, TELLUS.mu);
    console.log(`  transfer burn (statXfer): in ${(X.dt / 60).toFixed(1)} min, ${X.dv.toFixed(0)} m/s, ${api.nodeBurnTime(s, X.dv).toFixed(0)} s on the engine now lit; seen there by: ${sees(X.r, tB).join(', ') || 'NO STATION (pad or any buildable)'}`);
    console.log(`  apogee ${(half / 60).toFixed(0)} min later at ${km(len(r2) - R)} km; seen there by: ${sees(r2, tB + half).join(', ') || 'no station'}`); }
  if (name === 'Passenger Orbiter') { const { norm, mul, cross } = api, p = s; api.advRails(p, 0, 10);
    // the vehicle test's return: the deorbit burn one period after insertion (two were coasted above: same place), retrograde hold, chute armed at 20 km
    const u0 = norm(api.curSite().u), dn = () => Math.acos(Math.max(-1, Math.min(1, api.dot(norm(api.toPF(TELLUS, p.r, api.t)), u0)))) * R / 1e3;
    const say = w => console.log(`  ${w.padEnd(26)} +${((api.t - ce.t) / 60).toFixed(1)} min  alt ${km(len(p.r) - R)} km  ${dn().toFixed(0)} km from the pad  link ${api.linkOf(p).ok ? 'yes' : 'NO (' + api.linkOf(p).why + ')'}`);
    const retro = () => { const v = mul(norm(p.v), -1), f = api.localFrame(p.r), X = norm(cross(v, f.n)); p.q = api.qFromBasis(X, v, cross(X, v)); p.w = [0, 0, 0]; };
    say('deorbit burn starts'); p.throttle = 1; for (let k = 0; k < 20000 && p.alive; k++) { retro(); api.advPhys(p); if (api.elements(p.r, p.v, TELLUS.mu).pe - R < 40e3 || api.dvRemaining(p).cur < 1) break; }
    p.throttle = 0; say('deorbit burn ends'); p.av = 0; p.sas = true; p.sasMode = 'retro'; let armed = false, bl = false, lk = api.linkOf(p).ok;
    for (let k = 0; k < 2e6 && p.alive && !p.landed; k++) { const h = len(p.r) - R; if (h > TELLUS.atm + 5e3) { api.advRails(p, 20, 10); continue; } api.advPhys(p);
      if (k % 25 === 0) { const L = api.linkOf(p); if (L.ok !== lk) { lk = L.ok; say(L.ok ? 'AOS' : 'LOS: ' + L.why); } }
      if (!armed && h < 20e3) { armed = true; say('chute armed (staged)'); while (p.evIdx < p.events.length) api.stage(p); } }
    say(p.landed ? 'landed' : 'not landed: ' + p.lossWhy); }
}
