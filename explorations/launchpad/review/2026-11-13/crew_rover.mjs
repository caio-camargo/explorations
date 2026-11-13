// M3 readiness (review 2 session, 2026-11-13): can a crew that flew to Selene deploy the default two-seat rover?
// A crewed lander as a fresh flight builds it (no registry load), landed on Selene. Run: node crew_rover.mjs
import { mk } from '../2026-11-11/h.mjs';
const mul = (a, k) => a.map(x => x * k);
const D = mk('newShip,syncLanded,groundR,qFromTo,qmul,qaxis,SELENE,PROG,HOOK,rvDeployCheck,rvDefault,crewOn,missionTick');
const B = D.SELENE;
const lander = pod => { D.t = 0; const root = { k: pod, c: [{ k: 't1', at: 'd', c: [{ k: 'sparrow', at: 'd' }] }, { k: 'rvfold', at: { y: .3, a: 0, n: 1 }, rvd: D.rvDefault() }] };
  const s = D.newShip({ v: 2, root }), u = [1, 0, 0]; Object.assign(s, { body: B, landed: true, alive: true, sas: false, throttle: 0 });
  s.pf = mul(u, D.groundR(B, mul(u, B.R)) - s.yBot); s.qLocal = D.qFromTo([0, 1, 0], u); D.syncLanded(s); s.rec.launched = true; D.S = s; return s; };
for (const pod of ['pod', 'crew']) {
  let s; try { s = lander(pod); } catch (e) { console.log(pod, 'build failed:', e.message); continue; }
  D.PROG.done = { ...(D.PROG.done || {}), maxqabort: 1 };
  try { D.missionTick && D.missionTick(s, 0.1, true); } catch (e) { }
  const rp = s.parts.find(p => p.d.kind === 'rover'), c = D.rvDeployCheck(s, rp);
  console.log(`${pod}: seats ${s.parts.reduce((a, p) => a + (p.on && p.d.crew || 0), 0)}, rec.crewed ${s.rec.crewed}, crewOn ${D.crewOn(s)}, deploy ${c.ok ? 'ok' : 'refused: ' + c.why}`);
}
