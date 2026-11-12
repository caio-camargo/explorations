import { mk } from './h.mjs';
const A = mk('PROG,HOOK,CT,recNew,rng,newShip,PRESETS,programNew,contractEval,chooseStart');
A.programNew({ wseed: 5 }); A.chooseStart('agency');
const v = A.newShip(Object.values(A.PRESETS)[0].stack || Object.values(A.PRESETS)[0]);
const orbs = [null, { pe: 300e3, ap: 300e3, inc: 0, sci: true }, { pe: 36000e3, ap: 36000e3, inc: 0, sci: true, tv: true }];
const out = {};
for (const k in A.CT) { const T = A.CT[k]; let thr = 0, pass = 0, n = 0, err = '';
  for (let i = 0; i < 300; i++) { let p; try { p = T.gen(A.rng(i + 1)); } catch (e) { err = 'gen: ' + e.message; break; }
    for (const orb of orbs) { const R = { ...A.recNew(), orb, dv: 100, dispatched: true }, s = { rec: R, parts: v.parts }; n++;
      try { if (T.ok(R, p, s)) { pass++; if (T.bonus) T.bonus(R, p); if (T.after) T.after({ p, type: k, id: 1, client: 0, src: 'gov' }, s); } } catch (e) { thr++; err = e.message; } } }
  out[k] = `${n} tried, pass ${pass}, threw ${thr}${err ? ' (' + err + ')' : ''}`; }
console.log(Object.keys(A.CT).length, 'types'); for (const k in out) if (!/pass 0, threw 0$/.test(out[k])) console.log(k, out[k]);
console.log('uses 3rd arg:', Object.keys(A.CT).filter(k => /^\(?\s*\w+\s*,\s*\w+\s*,\s*\w+/.test(A.CT[k].ok.toString())).join(' '));
console.log('has after:', Object.keys(A.CT).filter(k => A.CT[k].after).join(' '));
