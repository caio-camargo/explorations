// Spin study (control session, 2026-10-08): does spinning a stage hold its pointing? Measures a free spinning stage
// (angular momentum and energy kept, nutation rate against Euler's equations) and a kick stage burning with its thrust
// 0.5° off the axis, SAS off, at several spin rates. usage: node study_spin.mjs   (NOTES: "Spin stabilisation")
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `
return {newShip,stage,physStep,qrot,qconj,TELLUS,HOOK,INP,DT,len,sub,add,mul,dot,cross,norm,
  get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)();
const { TELLUS, len, dot, cross, norm, mul, add, sub } = api;
const R = TELLUS.R, deg = 180 / Math.PI;
api.HOOK.msg = () => {}; api.HOOK.debris = () => {}; api.HOOK.rebuild = () => {}; api.HOOK.boom = () => {};
const toB = (s, v) => api.qrot(api.qconj(s.q), v), toI = (s, v) => api.qrot(s.q, v);
const KICK = ['core', 't1', 'petrel'];

function inOrbit(stack) {
  api.t = 0; const s = api.newShip(stack); api.S = s; s.landed = false;
  const h = TELLUS.atm + 100e3, v = Math.sqrt(TELLUS.mu / (R + h)); s.r = [R + h, 0, 0]; s.v = [0, 0, -v];
  s.sas = false; s.throttle = 0; return s;
}
// inertial angular momentum (vessel + wheels) and rotational energy
function LE(s) { const wb = toB(s, s.w), I = s.I, Lb = [I[0] * wb[0], I[1] * wb[1], I[2] * wb[2]];
  return { L: toI(s, add(Lb, s.wH || [0, 0, 0])), E: 0.5 * (Lb[0] * wb[0] + Lb[1] * wb[1] + Lb[2] * wb[2]) }; }

// 1. a free spinning stage: 2 rev/s about its axis, a small wobble
{
  const s = inOrbit(KICK), ws = 4 * Math.PI; s.w = toI(s, [0.05, ws, 0.02]);
  const a = LE(s), I = s.I; let t = 0, ang0 = Math.atan2(0.02, 0.05), turned = 0, last = ang0, Lmax = 0, Emax = 0, coneMax = 0;
  while (t < 60) { api.physStep(s, api.DT); t += api.DT; const wb = toB(s, s.w), ang = Math.atan2(wb[2], wb[0]);
    let d = ang - last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; turned += d; last = ang;
    const b = LE(s); Lmax = Math.max(Lmax, len(sub(b.L, a.L)) / len(a.L)); Emax = Math.max(Emax, Math.abs(b.E - a.E) / a.E);
    coneMax = Math.max(coneMax, Math.acos(Math.min(1, dot(norm(toI(s, [0, 1, 0])), norm(a.L))))); }
  const It = (I[0] + I[2]) / 2, want = (I[1] - It) / It * ws;
  console.log(`free spin, kick stage (I = ${I.map(x => x.toFixed(0)).join(' / ')} kg·m²), 2 rev/s, 60 s:`);
  console.log(`  angular momentum drift ${(Lmax * 100).toFixed(3)} %, energy drift ${(Emax * 100).toFixed(3)} %, axis within ${(coneMax * deg).toFixed(2)}° of L`);
  console.log(`  body-frame wobble rate ${Math.abs(turned / 60).toFixed(3)} rad/s (Euler: ${Math.abs(want).toFixed(3)})`);
}

// 2. a kick stage burning with its thrust 0.5° off the axis, SAS off: where does it point and where does the Δv go?
console.log('\nkick stage burn, thrust 0.5° off axis, SAS off:');
console.log('  spin       axis off at burnout   Δv direction off   burn');
for (const rps of [0, 0.5, 1, 2, 4]) {
  const s = inOrbit(KICK), e = s.parts.find(p => p.d.kind === 'engine'), c = 0.5 / deg;
  e.tdir = [Math.sin(c), Math.cos(c), 0];
  s.w = toI(s, [0, rps * 2 * Math.PI, 0]); api.stage(s); s.throttle = 1;
  // Δv from thrust alone (the non-gravitational acceleration, summed), so gravity doesn't bend the answer
  const Y0 = toI(s, [0, 1, 0]); let t = 0, dv = [0, 0, 0];
  while (t < 300) { api.physStep(s, api.DT); t += api.DT; if (s.thrust === 0) break; dv = add(dv, mul(toI(s, s.aB), api.DT)); }
  const off = Math.acos(Math.min(1, dot(toI(s, [0, 1, 0]), Y0))) * deg;
  const along = dot(dv, Y0), across = len(sub(dv, mul(Y0, along)));
  console.log(`  ${rps.toFixed(1).padStart(3)} rev/s   ${off.toFixed(1).padStart(8)}°            ${(Math.atan2(across, along) * deg).toFixed(2).padStart(6)}°        ${t.toFixed(0)} s, Δv ${len(dv).toFixed(0)} m/s`);
}

// 3. the same burn with SAS on a spun stage (roll left free): only damping the wobble, or also holding the start axis
console.log('\nkick stage burn, thrust 0.5° off axis, SAS on a spun stage (roll free):');
console.log('  spin       SAS                axis off   Δv off    peak wobble');
for (const rps of [1, 2]) for (const mode of ['off', 'damp', 'hold']) {
  const s = inOrbit(KICK), e = s.parts.find(p => p.d.kind === 'engine'), c = 0.5 / deg;
  e.tdir = [Math.sin(c), Math.cos(c), 0];
  s.w = toI(s, [0, rps * 2 * Math.PI, 0]); api.stage(s); s.throttle = 1;
  const Y0 = toI(s, [0, 1, 0]); s.spun = mode !== 'off'; s.sas = mode !== 'off'; s.sasMode = 'stab'; s.hold = mode === 'hold' ? Y0 : null;
  let t = 0, dv = [0, 0, 0], wob = 0;
  while (t < 300) { api.physStep(s, api.DT); t += api.DT; if (s.thrust === 0) break; dv = add(dv, mul(toI(s, s.aB), api.DT));
    const Y = toI(s, [0, 1, 0]); wob = Math.max(wob, len(sub(s.w, mul(Y, dot(s.w, Y))))); }
  const off = Math.acos(Math.min(1, dot(toI(s, [0, 1, 0]), Y0))) * deg, along = dot(dv, Y0), across = len(sub(dv, mul(Y0, along)));
  console.log(`  ${rps.toFixed(1).padStart(3)} rev/s   ${mode.padEnd(6)}   ${off.toFixed(2).padStart(14)}°  ${(Math.atan2(across, along) * deg).toFixed(2).padStart(6)}°   ${wob.toFixed(3)} rad/s, spin left ${(dot(s.w, toI(s, [0, 1, 0])) / 2 / Math.PI).toFixed(2)} rev/s`);
}

// 4. staged: spin motors under the kick stage fire at the separation that lights it
{
  const msgs = []; api.HOOK.msg = m => msgs.push(m);
  const s = inOrbit(['core', 't1', 'petrel', 'spin', 'dec', 't2', 'kestrel']); s.sas = true; s.sasMode = 'stab';
  api.stage(s); s.throttle = 0; for (let i = 0; i < 50; i++) api.physStep(s, api.DT);
  api.stage(s); s.throttle = 1; let t = 0;
  while (t < 3) { api.physStep(s, api.DT); t += api.DT; }
  const Y = toI(s, [0, 1, 0]), sp = dot(s.w, Y);
  console.log(`\nstaged: ${msgs.join(' | ')}; after 3 s ${(sp * 60 / 2 / Math.PI).toFixed(0)} rpm, spun ${s.spun}, wobble ${len(sub(s.w, mul(Y, sp))).toFixed(3)} rad/s`);
  api.HOOK.msg = () => {};
}
