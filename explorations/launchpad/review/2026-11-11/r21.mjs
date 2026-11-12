// Audit of fix R21 (v1.301): the drag table after a fairing jettison, bay doors, a part lost, against a table built from nothing
import { mk } from './h.mjs';
const A = mk('PROG,HOOK,PRESETS,newShip,dragTable,fairJettison,bayDoors,bayTick,programNew');
const J = t => JSON.stringify(t.map(x => +x.toFixed(3))), fresh = (s, a) => { const k = s.dragTab; s.dragTab = null; const t = A.dragTable(s, a).slice(); s.dragTab = k; return t; };
for (const [name, def] of Object.entries(A.PRESETS)) { const s = A.newShip(def.stack || def); const out = [];
  const cmp = tag => { for (const a of [0, 20]) { const c = A.dragTable(s, a).slice(), f = fresh(s, a); if (J(c) !== J(f)) out.push(`${tag} aoa ${a}: cached ${J(c)} fresh ${J(f)}`); } };
  cmp('start'); let did = [];
  try { const F = (s.events || []).find(e => e.fair); if (F) { const b = JSON.stringify(A.dragTable(s, 0)); A.fairJettison(s, F.fair); did.push(JSON.stringify(fresh(s, 0)) !== b ? 'fairing' : 'fairing(same)'); cmp('after fairing'); } } catch (e) { did.push('fairJettison threw ' + e.message); }
  try { const n0 = J(A.dragTable(s, 0)); A.bayDoors(s, true); for (let i = 0; i < 400; i++) A.bayTick(s, 0.05); if (J(fresh(s, 0)) !== n0) did.push('bay'); cmp('after bay doors'); } catch (e) { }
  const p = s.parts.filter(q => q.on).pop(); if (p) { p.on = false; cmp('after a part is lost'); p.on = true; }
  console.log(name.padEnd(22), did.join(',').padEnd(14), out.length ? '\n   STALE ' + out.join('\n   STALE ') : 'cached = fresh'); }
