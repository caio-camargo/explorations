// Scope of winged flight (notes/vehicle.md): the lift-to-drag today's aero gives a capsule whose fin plates are resized to wings.
// Run from explorations/launchpad: node review/2026-11-11/glide.mjs
const { mk } = await import(new URL('./h.mjs', import.meta.url).href);
const A = mk('HOOK,PARTS,newShip,aeroPass,geom,SND,TELLUS,density,physStep,DT,len,localFrame,qFromBasis,norm,add,mul,cross,sub,dot,surfVel,stage');
function LD(stack, span, chord, M, aoa) {
  const s = A.newShip(stack); A.geom(s);
  for (const p of s.fins) p.d = { ...p.d, span, chord };
  for (const p of s.parts) { p.F = [0, 0, 0]; p.L = [0, 0, 0]; }
  const h = 5000, v = M * A.SND(h), rho = A.density(A.TELLUS, h), a = aoa * Math.PI / 180, vb = [v * Math.sin(a), v * Math.cos(a), 0];   // falling nose-up: air comes from below (-y is the tail)
  A.aeroPass(s, vb, [0, 0, 0], rho, M, false);
  let F = [0, 0, 0]; for (const p of s.parts) if (p.on) F = A.add(F, p.F);
  const u = A.mul(vb, 1 / v), D = -A.dot(F, u), Lv = A.sub(F, A.mul(u, -D)), Lf = A.len(Lv);
  return { LD: Lf / D, L: Lf, D, m: s.mass, v, W: s.mass * 9.81 };
}
for (const [name, st, sp, ch] of [
  ['pod + t1, fin ring 0.9 x 0.9 (stock)', ['pod', 't1', 'fins'], 0.9, 0.9],
  ['cone + pod + t1, plates 5 x 2 m', ['cone', 'pod', 't1', 'fins'], 5, 2],
  ['pod + t1, plates 3 x 2 m', ['pod', 't1', 'fins'], 3, 2],
  ['pod + t1, plates 5 x 2 m', ['pod', 't1', 'fins'], 5, 2],
]) {
  console.log(name);
  for (const M of [0.3, 0.8, 3]) console.log('  M', M, [5, 10, 15, 20, 30, 45].map(a => { const r = LD(st, sp, ch, M, a); return `${a}deg L/D ${r.LD.toFixed(2)} L/W ${(r.L / r.W).toFixed(2)}`; }).join(' | '));
}
