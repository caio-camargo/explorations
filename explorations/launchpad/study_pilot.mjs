// Pilot-margin study (test bench, 2026-10-30, QUEUE Q474 / PLAYTEST #119): how much Δv a sloppy hand-flown ascent loses
// against the scripted one the presets, studies and contracts are sized to. Each orbital preset flies the scripted
// ascent (fly_ladder's handAscent: vertical to 200 m, flat by 38 km, the ideal circularisation), then "pilot" profiles
// that each get one thing wrong, then a typical pilot who gets several a little wrong. Attitude is set directly each step
// (as handAscent does), except `srfpro`, which flies on the game's own SAS after a kick.
//   node study_pilot.mjs                  every orbital preset, every profile
//   node study_pilot.mjs Orbiter Lunar    just those presets   (-v: a line per flight; -p=steep,guide: just those profiles)
//   -l=easy|hard: fly at that difficulty (flow, Q476: PROG.lvl; Easy's engines and air differ, Hard's don't)
// Reports per preset: Δv spent to orbit (s.rec.dv), the loss against the script, and Δv left; a flight that runs dry
// reports what it was short (circular speed at apoapsis minus the speed it had there).   NOTES: notes/qa.md § "Pilot margin"
import { pageSource } from './page.mjs';
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `return {PRESETS,TELLUS,PROG,speedRef,turnGuide,newShip,stage,advPhys,localFrame,qFromBasis,elements,timeToNu,dvRemaining,engAcc,HOOK,len,norm,add,sub,mul,dot,cross,
  get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)();
const { TELLUS, len, norm, add, sub, mul, dot, cross, elements } = api, R = TELLUS.R, ATM = TELLUS.atm, AS = ATM / 7e4, TGT = ATM + 10000;
for (const k of ['msg', 'news', 'save', 'debris', 'rebuild', 'boom']) api.HOOK[k] = () => {};

// a profile: hv (vertical until, m), hf (flat by, m) — both on a 70 km air, scaled by AS to the body's (×1.43 on Tellus), as
// handAscent's are — ex (the turn's shape exponent), wob (deg, period s), bias(h) (deg
// added to the pitch), ap (apoapsis aimed for), circ: 'ideal' | 'pro' (prograde from half the burn before apoapsis) |
// 'late' (the same from apoapsis), guide: {every} the ◇ on the gyro autopilot, srf: kick then SAS prograde (held through the coast)
const P0 = { hv: 200, hf: 38000, ex: 0.6, wob: null, bias: null, ap: TGT, circ: 'ideal', srf: null };
const PROFILES = [
  ['script', {}, 'the scripted ascent (handAscent)'],
  ['late', { hv: 2000 }, 'vertical to 2.9 km before turning (the script: 286 m)'],
  ['steep', { hf: 60000 }, 'turns too little: flat by 86 km (the script: 54 km)'],
  ['shallow', { hf: 25000 }, 'turns too much: flat by 36 km'],
  ['wobble', { wob: [4, 10] }, '±4° pitch wobble, 10 s period'],
  ['oversteer', { bias: h => h < 15000 * AS ? -6 : h < 35000 * AS ? 6 : 0 }, '6° low below 21 km, then 6° high to 50 km'],
  ['apover', { ap: TGT + 40000 }, 'apoapsis 40 km too high, circularised there'],
  ['circpro', { circ: 'pro' }, 'circularises along the horizon, nose up when falling (not the ideal vector)'],
  ['circlate', { circ: 'late' }, 'circularises prograde, starting at apoapsis'],
  // the gravity turn by hand: a kick, then SAS prograde to orbit. Swept on the Orbiter (2026-10-30): at 30 m/s 12–15° flies
  // as well as the script, 8° +175 m/s, 20° turns flat into the sea; at 60 m/s it takes 25° (+188), 15° runs dry
  ['srfpro', { srf: { v: 30, deg: 12 } }, 'a 12° kick at 30 m/s, then SAS prograde (a good hand gravity turn)'],
  ['srfshy', { srf: { v: 30, deg: 8 } }, 'the same with a timid 8° kick'],
  ['srflate', { srf: { v: 60, deg: 15 } }, 'a 15° kick at 60 m/s (kicked late)'],
  // the navball's ◇ (flow, Q434 v1.234: turnGuide, the scripted profile) flown in Stability on the gyro autopilot, which has
  // no Prograde: the hold set onto the ◇ every step, then only every 10 s (a pilot who nudges it now and then); level once
  // the ◇ goes (the apoapsis out of the air)
  ['guide', { guide: { every: 0 } }, 'the ◇ in Stability on the gyro autopilot, every step'],
  ['guide10', { guide: { every: 10 } }, 'the same, the hold moved onto the ◇ every 10 s'],
  ['pilot', { hv: 1000, hf: 50000, wob: [2, 12], ap: TGT + 15000, circ: 'pro' }, 'a typical pilot: vertical to 1.4 km, flat by 71 km, ±2°, apoapsis 15 km high, horizon circularisation'],
];

function fly(st, o) {
  o = { ...P0, ...o }; api.PROG.procs = {}; api.PROG.funds = 1e6; if (LVL) api.PROG.lvl = LVL;
  api.t = 0; const s = api.newShip(st); api.S = s; api.advPhys(s); s.sas = false; s.throttle = 1; api.stage(s);
  const dv0 = api.dvRemaining(s).tot; let k = 0, phase = 'up', kicked = false, nextG = 0, horizon = false, runaway = false, burns = 0;
  const point = Y => { const f = api.localFrame(s.r), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  const pitch = d => { const f = api.localFrame(s.r), r = d * Math.PI / 180; point(norm(add(mul(f.e, Math.cos(r)), mul(f.up, Math.sin(r))))); };
  const dry = () => api.dvRemaining(s).cur <= 0.5 && s.evIdx >= s.events.length;
  while (s.alive && k++ < 400000) { const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - R;
    if (phase === 'up') {
      if (o.guide) { if (!s.sas) { s.av = 0; s.sas = true; s.sasMode = 'stab'; }   // the gyro autopilot: Stability and Retrograde only
        // no ◇ on the pad or below it: straight up; past it: level
        if (api.t >= nextG) { const g = api.turnGuide(s), f = api.localFrame(s.r); s.hold = g ? g.u : s.landed || el.ap - R < ATM ? f.up : norm(sub(s.v, mul(f.up, dot(s.v, f.up)))); nextG = api.t + o.guide.every; } }
      else if (o.srf) { if (!kicked) { pitch(90); if (len(api.speedRef(s).v) > o.srf.v) { pitch(90 - o.srf.deg); kicked = true; s.sas = true; s.sasMode = 'pro'; } } }
      else { const f = Math.min(1, Math.max(0, (h - o.hv * AS) / (o.hf * AS - o.hv * AS)));
        let d = 90 * (1 - Math.pow(f, o.ex)); if (o.bias) d += o.bias(h); if (o.wob && h > o.hv * AS) d += o.wob[0] * Math.sin(2 * Math.PI * api.t / o.wob[1]);
        pitch(Math.max(0, Math.min(90, d))); }
      if (el.ap - R > o.ap) { s.throttle = 0; phase = 'coast'; if (o.guide) s.sas = false; } }
    else if (phase === 'coast') { if (!o.srf) pitch(0); s.throttle = h < ATM && el.ap - R < o.ap - 500 ? 0.3 : 0;
      const dvC = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a)), half = 0.5 * dvC / Math.max(api.engAcc(s), 0.1);
      if (h > ATM && api.timeToNu(el, Math.PI) < (o.circ === 'late' ? 1 : Math.max(o.circ === 'ideal' ? 25 : 0, half))) { phase = 'circ'; s.sas = false; } }
    else if (phase === 'coast2') { const f = api.localFrame(s.r); point(norm(sub(s.v, mul(f.up, dot(s.v, f.up))))); s.throttle = 0;
      const dvC = Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(TELLUS.mu * (2 / el.ap - 1 / el.a));
      if (api.timeToNu(el, Math.PI) < 0.5 * dvC / Math.max(api.engAcc(s), 0.1)) phase = 'circ'; }
    else { const f = api.localFrame(s.r), vz = dot(s.v, f.up), hv = norm(sub(s.v, mul(f.up, vz))), need = sub(mul(hv, Math.sqrt(TELLUS.mu / len(s.r))), s.v);
      if (o.circ === 'ideal' && len(need) < 3) { if (el.pe - R > ATM) { s.throttle = 0; break; } horizon = true; }   // circular, but under the line: burn on
      // a pilot's law: along the horizon, the nose lifted 0.5° per m/s of fall (up to 30°). Burning along the velocity itself
      // runs away once past apoapsis (it raises apoapsis, not periapsis: Big Lunar and the Probe escaped)
      const a = Math.min(30, Math.max(0, -0.5 * vz)) * Math.PI / 180;
      point(o.circ === 'ideal' && !horizon ? norm(need) : norm(add(mul(hv, Math.cos(a)), mul(f.up, Math.sin(a))))); s.throttle = 1;
      if (el.pe - R > ATM + 2000) { s.throttle = 0; break; }
      // a weak upper stage that circularised under the line (a steep climb, a Lunar's 0.6 g stage) only raises apoapsis from
      // there: like a pilot, stop at the aimed apoapsis, coast up to it and burn again (at most three tries)
      if (horizon && el.ap - R > o.ap && el.e < 1) { s.throttle = 0; phase = 'coast2'; if (++burns > 3) { runaway = true; break; } }
      if (!(el.e < 1) || el.ap - R > 2000e3) { s.throttle = 0; runaway = true; break; } }
    if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) api.stage(s);
    if (s.throttle > 0 && dry()) break;
    api.advPhys(s); }
  const el = elements(s.r, s.v, TELLUS.mu), orbit = s.alive && el.pe - R > ATM;
  const short = orbit || !s.alive || !(el.e < 1) ? 0 : Math.sqrt(TELLUS.mu / el.ap) - Math.sqrt(Math.max(0, TELLUS.mu * (2 / el.ap - 1 / el.a)));
  return { orbit: orbit && !runaway, runaway, alive: s.alive, why: s.lossWhy || '', spent: s.rec ? s.rec.dv : dv0 - api.dvRemaining(s).tot, left: api.dvRemaining(s).tot, dv0, short,
    ap: (el.ap - R) / 1e3, pe: (el.pe - R) / 1e3, t: api.t };
}

const LVL = (process.argv.find(a => a.startsWith('-l=')) || '').slice(3) || null;
const want = process.argv.slice(2).filter(a => !a.startsWith('-')), V = process.argv.includes('-v'), only = (process.argv.find(a => a.startsWith('-p=')) || '').slice(3).split(',').filter(Boolean);
const names = Object.keys(api.PRESETS).filter(n => !want.length || want.includes(n)), rows = [];
for (const n of names) {
  const st = api.PRESETS[n], base = fly(st, {});
  if (!base.orbit) { console.log(`${n}: scripted ascent doesn't orbit (${base.alive ? `ap ${base.ap.toFixed(0)} km, pe ${base.pe.toFixed(0)} km` : 'lost: ' + base.why}), skipped`); continue; }
  const row = { preset: n, '∆v': Math.round(base.dv0), script: Math.round(base.spent), spare: Math.round(base.left) };
  for (const [id, o] of PROFILES.slice(1)) { if (only.length && !only.includes(id)) continue; const r = fly(st, o);
    row[id] = !r.alive ? 'LOST' : r.runaway ? 'ESC' : r.orbit ? `+${Math.round(r.spent - base.spent)}` : `✗−${Math.round(r.short)}`;
    if (V) console.log(`${n} ${id}: ${!r.alive ? 'lost (' + r.why + ')' : r.orbit ? 'orbit' : 'short ' + r.short.toFixed(0)} spent ${r.spent.toFixed(0)} left ${r.left.toFixed(0)} ${r.ap.toFixed(0)}×${r.pe.toFixed(0)} km t=${r.t.toFixed(0)}`); }
  rows.push(row); console.log(`${n} done`);
}
console.log('Δv spent to orbit by the script, m/s, and what each profile spent beyond it (+n); ✗−n ran dry n m/s short; LOST burned up or crashed; ESC apoapsis ran away, or still under the line after three burns; spare = left after the script');
for (const [id, , what] of PROFILES) console.log(`  ${id.padEnd(10)} ${what}`);
console.table(rows);
