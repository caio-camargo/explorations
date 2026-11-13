// Q616 (review 2 session, 2026-11-13): if "recovered" has to be true (DECISIONS D48), which early contracts does it touch?
// For each power as home and each of its launch sites: the recovery verdict (landingVerdict, the game's own) around the
// pad, at the nearest point of each field-station biome, and under the auroral zone; with no recovery fleet and with
// each fleet level. Relations are a new program's. Run: node recover.mjs
import { mk } from '../2026-11-11/h.mjs';
const D = mk('HOOK,SITES,TELLUS,PROG,POWERS,programNew,landingVerdict,alongAz,biomeAt,FIELD_IDS,AURORA_LAT,facLv');
const R = D.TELLUS.R, deg = Math.PI / 180;
const tally = () => ({ n: 0, ok: 0, kinds: {} }), add = (t, v) => { t.n++; if (v.recovered) t.ok++; t.kinds[v.kind] = (t.kinds[v.kind] || 0) + 1; };
const show = t => `${t.ok}/${t.n} (${Object.entries(t.kinds).map(([k, n]) => k + ' ' + n).join(', ')})`;
for (const lv of [0, 1, 2]) {
  const near = tally(), mid = tally(), far = tally(), field = tally(), aur = tally(); let sites = 0;
  for (const p of D.POWERS) { D.programNew({ home: p.i }); if (lv) D.PROG.fac = { ...(D.PROG.fac || {}), fleet: { lv } }; if (D.facLv('fleet') !== lv) throw new Error('fleet level');
    for (const t of D.SITES.filter(t => t.power === p.i)) { sites++; const V = u => D.landingVerdict(D.TELLUS, u, { from: t.u });
      for (let a = 0; a < 8; a++) { add(near, V(D.alongAz(t.u, a * 45 * deg, 10e3 / R))); add(mid, V(D.alongAz(t.u, a * 45 * deg, 150e3 / R))); add(far, V(D.alongAz(t.u, a * 45 * deg, 400e3 / R))); }
      const seen = {}; for (let k = 1; k <= 60; k++) for (let a = 0; a < 24; a++) { const u = D.alongAz(t.u, a * Math.PI / 12, k * 20e3 / R), id = D.biomeAt(u).id; if (D.FIELD_IDS.includes(id) && !seen[id]) { seen[id] = 1; add(field, V(u)); } }
      const s = t.u[1] >= 0 ? 1 : -1, la = s * (D.AURORA_LAT + 100e3 / R), lo0 = Math.atan2(t.u[2], t.u[0]);
      for (const dl of [-30, 0, 30]) { const lo = lo0 + dl * deg; add(aur, V([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)])); } } }
  console.log(`fleet ${lv}, ${sites} home sites; recovered: 10 km from the pad ${show(near)} · 150 km ${show(mid)} · 400 km ${show(far)} · field stations ${show(field)} · under the aurora ${show(aur)}`);
}
