// Q573 measurement 1: what the chapter-1 kit (Sparrow, tanks 1-4 t) can do: max-q, apex, and stage maths against the Beeper
const { mk } = await import(new URL('../h.mjs', import.meta.url).href);
const A = mk('PROG,HOOK,PRESETS,PARTS,PRICE,newShip,stage,physStep,DT,TELLUS,len,elements,stageStats,vesselCost,dvRemaining,localFrame,qFromBasis,norm,add,mul,cross,programNew');
const T = A.TELLUS;
function up(stack, { thr = 1, tilt = 0 } = {}) {   // straight up (or a fixed tilt from vertical, degrees), staging when empty; returns max-q, apex, max g
  A.t = 0; const s = A.newShip(stack); A.S = s; s.sas = false; s.throttle = thr; A.stage(s);
  let qMax = 0, apex = 0, gMax = 0, n = 0, vMax = 0;
  const f0 = A.localFrame(s.r), p = (90 - tilt) * Math.PI / 180, Y = A.norm(A.add(A.mul(f0.e, Math.cos(p)), A.mul(f0.up, Math.sin(p)))), X = A.norm(A.cross(Y, f0.n)), q0 = A.qFromBasis(X, Y, A.cross(X, Y));
  while (n++ < 60000 && s.alive) {
    s.q = q0.slice(); s.w = [0, 0, 0];
    if (s.throttle > 0 && A.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) A.stage(s);
    A.physStep(s, A.DT); const h = A.len(s.r) - T.R; qMax = Math.max(qMax, s.qdyn); gMax = Math.max(gMax, s.gload); apex = Math.max(apex, h); vMax = Math.max(vMax, A.len(s.v));
    if (h < apex - 2000) break;
  }
  return { qMax, apex, gMax, alive: s.alive, why: s.lossWhy || '' };
}
const cost = st => A.vesselCost(A.newShip(st).parts).cost;
const row = (name, st, o) => { const r = up(st, o); console.log(name.padEnd(34), `max-q ${(r.qMax / 1e3).toFixed(1).padStart(5)} kPa  apex ${(r.apex / 1e3).toFixed(0).padStart(4)} km  ${r.gMax.toFixed(1).padStart(4)} g  ${cost(st).toFixed(0).padStart(3)} M ${r.alive ? '' : 'LOST ' + r.why}`); };
console.log('atmosphere top', T.atm / 1e3, 'km');
row('Sounding preset', A.PRESETS.Sounding);
row('sci t1 sparrow (no fins)', ['chute', 'sci', 't1', 'sparrow']);
row('sci t2 fins sparrow', ['chute', 'sci', 't2', 'fins', 'sparrow']);
row('sci t4 fins sparrow', ['chute', 'sci', 't4', 'fins', 'sparrow']);
row('Sounding, 20 deg off vertical', A.PRESETS.Sounding, { tilt: 20 });
row('Sounding, 45 deg off vertical', A.PRESETS.Sounding, { tilt: 45 });
row('sci t2 fins sparrow, 45 deg', ['chute', 'sci', 't2', 'fins', 'sparrow'], { tilt: 45 });
row('QUAL (runner): sci t2 fins kestrel', ['chute', 'sci', 't2', 'fins', 'kestrel']);
row('Passenger preset', A.PRESETS.Passenger);
row('Hopper preset', A.PRESETS.Hopper);
console.log('\nstage maths (vacuum dv per stage, TWR at ignition)');
const ss = (name, st) => { try { const { stages, mass } = A.stageStats(st); console.log(name.padEnd(34), `${mass.toFixed(1).padStart(5)} t  ` + stages.map(x => `${x.dvV.toFixed(0)} @${x.twr.toFixed(2)}`).join(' | ') + `  = ${stages.reduce((a, x) => a + x.dvV, 0).toFixed(0)} m/s  ${cost(st).toFixed(0)} M`); } catch (e) { console.log(name, 'ERR', e.message); } };
ss('Beeper preset', A.PRESETS.Beeper);
ss('Orbiter preset', A.PRESETS.Orbiter);
ss('Sparrow x2: sci t1 sp / t4 sp', ['cone', 'sci', 't1', 'sparrow', 'dec', 't4', 'fins', 'sparrow']);
ss('Sparrow x2: sci t2 sp / t4 sp', ['cone', 'sci', 't2', 'sparrow', 'dec', 't4', 'fins', 'sparrow']);
ss('Sparrow x3: sci t1 / t2 / t4', ['cone', 'sci', 't1', 'sparrow', 'dec', 't2', 'sparrow', 'dec', 't4', 'fins', 'sparrow']);
ss('Kestrel + Sparrow upper', ['cone', 'sci', 't2', 'sparrow', 'dec', 't8', 'fins', 'kestrel']);
ss('Kestrel single: sci t8 kestrel', ['cone', 'sci', 't8', 'fins', 'kestrel']);
console.log('\nengines'); for (const k of ['sparrow', 'petrel', 'kestrel', 'condor', 'albatross', 'wren']) { const d = A.PARTS[k]; console.log(k.padEnd(10), `${d.thrust} kN  Isp ${d.isp || d.ispV || '?'}/${d.ispSL || d.isp0 || '?'}  mass ${d.mass ?? d.m ?? '?'} t  ${A.PRICE[k]} M`, JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k2, v]) => typeof v === 'number' && /isp|ve|mass|^m$/i.test(k2))))); }
