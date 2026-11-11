// Q573 measurement 2: can the chapter-1 kit reach orbit? tests/core.mjs's scripted gravity turn (attitude set directly) on any stack
const { mk } = await import(new URL('../h.mjs', import.meta.url).href);
const api = mk('PROG,HOOK,PRESETS,PARTS,newShip,stage,physStep,DT,TELLUS,len,elements,dvRemaining,localFrame,qFromBasis,norm,add,sub,mul,dot,cross,timeToNu,vesselCost');
const { TELLUS, len, elements, norm, add, sub, mul, dot, cross } = api, ATM = TELLUS.atm;
function fly(stack, { turnStart = 1000, turnEnd = 45000, target = ATM + 10000, pw = 0.6 } = {}) {
  api.t = 0; const s = api.newShip(stack); api.S = s; s.sas = false; s.throttle = 1; api.stage(s);
  let phase = 'ascent', maxQ = 0, maxG = 0, guard = 0;
  const point = d => { const f = api.localFrame(s.r), p = d * Math.PI / 180, Y = norm(add(mul(f.e, Math.cos(p)), mul(f.up, Math.sin(p)))), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  while (guard++ < 400000 && s.alive) {
    const h = len(s.r) - TELLUS.R, el = elements(s.r, s.v, TELLUS.mu);
    if (phase === 'ascent') { const f = Math.min(1, Math.max(0, (h - turnStart) / (turnEnd - turnStart))); point(90 * (1 - Math.pow(f, pw))); if (el.ap - TELLUS.R > target) { s.throttle = 0; phase = 'coast'; } }
    else if (phase === 'coast') { point(0); if (h > ATM && el.ap - TELLUS.R < target - 500) s.throttle = 0.3; else if (h < ATM) s.throttle = el.ap - TELLUS.R < target ? 0.2 : 0; else s.throttle = 0;
      if (h > ATM && api.timeToNu(el, Math.PI) < 25) phase = 'circ'; if (h < 20000 && dot(s.v, s.r) < 0) break; }
    else if (phase === 'circ') { const f = api.localFrame(s.r), hv = norm(sub(s.v, mul(f.up, dot(s.v, f.up)))), X = norm(cross(hv, f.n)); s.q = api.qFromBasis(X, hv, cross(X, hv)); s.w = [0, 0, 0]; s.throttle = 1;
      if (el.pe - TELLUS.R > ATM + 2000) { s.throttle = 0; phase = 'done'; break; } if (h < ATM - 5000) break; }
    if (s.throttle > 0 && api.dvRemaining(s).cur <= 0.5) { if (s.evIdx < s.events.length) api.stage(s); else if (phase !== 'ascent' || api.dvRemaining(s).tot <= 0.5) { if (api.dvRemaining(s).tot <= 0.5) break; } }
    api.physStep(s, api.DT); maxQ = Math.max(maxQ, s.qdyn); maxG = Math.max(maxG, s.gload);
  }
  const el = elements(s.r, s.v, TELLUS.mu); return { phase, ap: (el.ap - TELLUS.R) / 1e3, pe: (el.pe - TELLUS.R) / 1e3, left: api.dvRemaining(s).tot, maxQ, maxG, alive: s.alive, why: s.lossWhy || '' };
}
const cost = st => api.vesselCost(api.newShip(st).parts).cost;
const D = {
  'Beeper preset': api.PRESETS.Beeper,
  'A: cone sci t2 sp / dec t4 fins sp': ['cone', 'sci', 't2', 'sparrow', 'dec', 't4', 'fins', 'sparrow'],
  'B: cone sci t1 sp / dec t4 fins sp': ['cone', 'sci', 't1', 'sparrow', 'dec', 't4', 'fins', 'sparrow'],
  'C: cone sci t1 sp / t2 sp / t4 fins sp': ['cone', 'sci', 't1', 'sparrow', 'dec', 't2', 'sparrow', 'dec', 't4', 'fins', 'sparrow'],
  'D: cone sci t2 sp / dec t4 t4 fins sp': ['cone', 'sci', 't2', 'sparrow', 'dec', 't4', 't4', 'fins', 'sparrow'],
  'E: cone sci t4 sp / dec t4 t4 fins sp': ['cone', 'sci', 't4', 'sparrow', 'dec', 't4', 't4', 'fins', 'sparrow'],
  'F: Kestrel + Sparrow upper (no Petrel)': ['cone', 'sci', 't2', 'sparrow', 'dec', 't8', 'fins', 'kestrel'],
  'G: Kestrel single stage': ['cone', 'sci', 't8', 'fins', 'kestrel'],
};
for (const [n, st] of Object.entries(D)) { let best = null;
  for (const turnEnd of [35000, 45000, 60000]) for (const pw of [0.5, 0.6, 0.8]) { let r; try { r = fly(st, { turnEnd, pw }); } catch (e) { r = { phase: 'ERR ' + e.message, pe: -1e9, ap: 0, left: 0, maxQ: 0, maxG: 0 }; }
    if (!best || (r.phase === 'done') > (best.phase === 'done') || ((r.phase === 'done') === (best.phase === 'done') && (r.phase === 'done' ? r.left > best.left : r.pe > best.pe))) best = { ...r, turnEnd, pw }; }
  console.log(n.padEnd(40), `${cost(st).toFixed(0).padStart(3)} M  ${best.phase.padEnd(7)} Ap ${best.ap.toFixed(0)} Pe ${best.pe.toFixed(0)} km  left ${best.left.toFixed(0)} m/s  max-q ${(best.maxQ / 1e3).toFixed(0)} kPa ${best.maxG.toFixed(1)} g  (turn ${best.turnEnd / 1e3} km, ^${best.pw}) ${best.alive === false ? 'LOST ' + best.why : ''}`); }
