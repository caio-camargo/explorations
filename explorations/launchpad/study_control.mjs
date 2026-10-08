// Control-budget study (control session, 2026-10-08): where the attitude torque comes from, and how close it runs to its
// limits, before the gimbal and control surfaces are made real. usage: node study_control.mjs   (NOTES: "Attitude control")
// A study, not a test: it wraps ctrlAccel and aeroPass to read the commanded control torque and the aero moment each step.
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `
{const _ca=ctrlAccel;ctrlAccel=function(s,r){const a=_ca(s,r);if(!r)s._alC=a;return a}}
{const _ap=aeroPass;aeroPass=function(s,...a){const L0=s.parts.map(p=>p.L.slice()),F0=s.parts.map(p=>p.F.slice());_ap(s,...a);
  let F=[0,0,0],L=[0,0,0];s.parts.forEach((p,i)=>{F=add(F,sub(p.F,F0[i]));L=add(L,sub(p.L,L0[i]))});s._tauA=sub(L,cross(s.cm,F))}}
return {newShip,stage,physStep,elements,dvRemaining,timeToNu,ctrlAuthority,ctrlAuthRoll:typeof ctrlAuthRoll==='function'?ctrlAuthRoll:null,activeEngines,qrot,qconj,PRESETS,TELLUS,HOOK,INP,DT,len,sub,add,mul,dot,cross,norm,
  get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)();
const { TELLUS, len, dot, cross, norm, mul, add, sub, elements } = api;
const R = TELLUS.R, ATM = TELLUS.atm, deg = 180 / Math.PI;
api.HOOK.msg = () => {}; api.HOOK.debris = () => {}; api.HOOK.rebuild = () => {}; api.HOOK.boom = () => {};
const body = (s, v) => api.qrot(api.qconj(s.q), v);

// the usual scripted ascent of the tests: a pitch kick at 8 s, then SAS prograde; cut at apoapsis, circularize
function ascent(name, stack) {
  api.t = 0; const s = api.newShip(stack); api.S = s; s.throttle = 1; api.stage(s); let ph = 'asc';
  const A = { name, n: 0, sat: 0, satPow: 0, nPow: 0, gimShare: 0, tauTot: 0, magicRoll: 0, peakA: 0, peakAq: 0, peakC: 0, peakAuth: 0,
    aoaPow: 0, aoaCoast: 0, wheel: s.torque, lost: '' };
  while (api.t < 900 && s.alive && ph !== 'done') {
    api.INP.pitch = (api.t >= 8 && api.t < 8.8) ? 1 : 0; if (api.t > 9.8) s.sasMode = 'pro';
    const el = elements(s.r, s.v, TELLUS.mu), h = len(s.r) - R;
    if (ph === 'asc' && el.ap - R > ATM + 10000) { s.throttle = 0; ph = 'coast'; }
    if (ph === 'coast' && h > ATM && api.timeToNu(el, Math.PI) < 25) { s.throttle = 1; ph = 'circ'; }
    if (ph === 'circ' && el.pe - R > ATM) { s.throttle = 0; ph = 'done'; }
    if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length - 1) api.stage(s);
    s._tauA = null; s._alC = null; api.physStep(s, api.DT);
    if (!s.alC && !s._alC) continue;
    const a = body(s, s._alC), I = s.I, tc = [a[0] * I[0], a[1] * I[1], a[2] * I[2]], tpy = Math.hypot(tc[0], tc[2]);
    const pow = s.thrust > 0, auth = api.ctrlAuthority(s, api.activeEngines(s), s.throttle);
    A.n++; if (pow) A.nPow++;
    if (tpy > 0.99 * auth) { A.sat++; if (pow) A.satPow++; }
    A.tauTot += len(tc); A.gimShare += Math.max(0, len(tc) - s.torque);
    // roll torque asked beyond what can make it: the wheels, plus (since the real gimbal) engines off the axis
    const rollAuth = api.ctrlAuthRoll ? api.ctrlAuthRoll(s, api.activeEngines(s), s.throttle) : s.torque;
    if (Math.abs(tc[1]) > rollAuth + 1) A.magicRoll++;
    if (tpy > A.peakC) { A.peakC = tpy; A.peakAuth = auth; }
    if (s._tauA) { const ta = Math.hypot(s._tauA[0], s._tauA[2]); if (ta > A.peakA) { A.peakA = ta; A.peakAq = s.qdyn; } }
    if (len(s.r) - R < ATM && s.qdyn > 500) { if (pow) A.aoaPow = Math.max(A.aoaPow, s.aoa * deg); else A.aoaCoast = Math.max(A.aoaCoast, s.aoa * deg); }
  }
  api.INP.pitch = 0;
  const el = elements(s.r, s.v, TELLUS.mu);
  A.out = !s.alive ? 'LOST' : ph === 'done' ? `orbit ${((el.ap - R) / 1e3).toFixed(0)}×${((el.pe - R) / 1e3).toFixed(0)} km` : `${ph} at t=${api.t.toFixed(0)}`;
  return A;
}

// a 90° turn in vacuum under SAS (stab hold on a perpendicular axis): wheels alone, then with the engines at full throttle
function turn90(stack, thr) {
  api.t = 0; const s = api.newShip(stack); api.S = s; s.landed = false;
  const v = Math.sqrt(TELLUS.mu / (R + ATM + 50e3)); s.r = [R + ATM + 50e3, 0, 0]; s.v = [0, 0, -v]; s.w = [0, 0, 0];
  api.stage(s); s.throttle = thr;
  const Y0 = api.qrot(s.q, [0, 1, 0]), X0 = api.qrot(s.q, [1, 0, 0]);
  s.sas = true; s.sasMode = 'stab'; s.hold = X0;
  let t = 0; while (t < 300) { api.physStep(s, api.DT); t += api.DT; const Y = api.qrot(s.q, [0, 1, 0]);
    if (Math.acos(Math.min(1, dot(Y, X0))) < 2 / deg && len(s.w) < 0.01) return t; }
  return Infinity;
}

const P = api.PRESETS, noFins = st => st.filter(k => k !== 'fins');
const cases = [['Sounding', P.Sounding], ['Hopper', P.Hopper], ['Orbiter', P.Orbiter], ['Orbiter, no fins', noFins(P.Orbiter)],
  ['Heavy', P.Heavy], ['Lunar', P.Lunar]];
console.log('ASCENT under SAS (kick at 8 s, then prograde). τ in kN·m.');
console.log('case               | wheel | peak ctrl / authority there | % steps saturated (powered) | gimbal share of ctrl | magic-roll steps | peak aero τ (at q kPa) | max AoA pow / coast | outcome');
for (const [n, st] of cases) {
  const A = ascent(n, st);
  console.log(`${n.padEnd(18)} | ${(A.wheel / 1e3).toFixed(0).padStart(5)} | ${(A.peakC / 1e3).toFixed(1).padStart(7)} / ${(A.peakAuth / 1e3).toFixed(0).padStart(5)}` +
    `${''.padStart(13)}| ${(100 * A.sat / A.n).toFixed(1).padStart(5)} (${(100 * A.satPow / Math.max(1, A.nPow)).toFixed(1)})${''.padStart(14)}| ` +
    `${(100 * A.gimShare / Math.max(1, A.tauTot)).toFixed(0).padStart(4)} %${''.padStart(14)}| ${String(A.magicRoll).padStart(6)}${''.padStart(11)}| ` +
    `${(A.peakA / 1e3).toFixed(1).padStart(6)} (${(A.peakAq / 1e3).toFixed(1)})${''.padStart(10)}| ${A.aoaPow.toFixed(1)}° / ${A.aoaCoast.toFixed(1)}° | ${A.out}`);
}
console.log('\nVACUUM 90° turn under SAS (s), full stack, first stage lit: wheels only (throttle 0) / wheels + gimbal (throttle 1)');
for (const [n, st] of cases) console.log(`${n.padEnd(18)} ${turn90(st, 0).toFixed(1).padStart(6)} / ${turn90(st, 1).toFixed(1).padStart(6)}`);
console.log(`${'Pod alone'.padEnd(18)} ${turn90(['chute', 'pod'], 0).toFixed(1).padStart(6)}`);
