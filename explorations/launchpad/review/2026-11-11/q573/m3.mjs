// Q573 measurement 3: the proposed unlock map checked against the game's own data: every part placed, every mission's
// needs and NEXT_PRESET open when the mission opens, every contract type's needs open at its req, each preset's chapter.
const { mk } = await import(new URL('../h.mjs', import.meta.url).href);
const A = mk('PROG,HOOK,PRESETS,PARTS,PART_GATE,MISSIONS,CT,CT_JOB,NEXT_PRESET,newShip,kinOf,jobNeeds,RV_GATE');
const START = ['sparrow', 't1', 't2', 'cone', 'chute', 'sci', 'dec', 'fins', 'rfin', 'ballast', 'bwt', 'spin'];
const MAP = {   // mission -> the parts it opens
  weather: ['bio', 't4', 'cfins', 'cfin'],
  loads: ['kestrel', 't8', 'petrel', 'istage', 'rwheel'],
  range: ['rdec'],
  hop: ['pod', 'shield'],
  beeper: ['core', 'core6', 'core3', 'batt', 'sbatt', 'batt6', 'batt3', 'bpanel', 'cam', 'scam', 'ant', 'whip', 'ssci', 'fair', 'oct', 'octl', 'octl6', 'padapt', 'padapt6', 'padapt3'],
  orbiter: ['crew', 'les'],
  lift1: ['condor'],
  lift2: ['albatross', 'T16', 'T32', 'adapt', 'dec25', 'fins25', 'cfins25', 'cone25', 'fair25'],
  wxsat: ['wpanel', 'bant', 'apogee', 'hthr', 'sph4', 'sph7', 'kick30', 'kick80', 'kick200', 'rwheel6', 'rwheel3'],
  tv: ['port', 'rport', 'rcs', 'gas', 'claw', 'hab'],
  station1: ['arm', 'bay'],
  stationcrew: ['lab'],
  farside: ['leg', 'wren', 'rvfold', 'rvdeck'],
  selland: ['beacon'],
};
const REQ = { hop: ['weather', 'loads'], beeper: ['weather', 'loads'], tv: ['wxsat'], station1: ['tv'], farside: ['wxsat', 'lift2'] };   // req changes the map needs (others as today)
const gate = {}; for (const m in MAP) for (const k of MAP[m]) { if (gate[k]) console.log('TWICE', k); gate[k] = m; }
const M = Object.fromEntries(A.MISSIONS.map(x => [x.id, x])), req = id => REQ[id] || M[id].req || [];
const clos = ids => { const S = new Set(); const go = id => { for (const r of req(id)) if (!S.has(r)) { S.add(r); go(r); } }; ids.forEach(go); return S; };
// 1. every part placed
const un = Object.keys(A.PARTS).filter(k => !START.includes(k) && !gate[k] && A.PARTS[k].era == null);
console.log('parts', Object.keys(A.PARTS).length, '· start', START.length, '· gated', Object.keys(gate).length, '· by era', Object.keys(A.PARTS).filter(k => A.PARTS[k].era != null).length, '· unplaced:', un.join(' ') || 'none');
for (const k of [...START, ...Object.keys(gate)]) if (!A.PARTS[k]) console.log('NO SUCH PART', k);
for (const k in A.PART_GATE) if (gate[k] !== A.PART_GATE[k]) console.log(`moved: ${k} ${A.PART_GATE[k]} -> ${gate[k]}`);
// open(k, done): the part is open when its mission is in the set
const openIn = (k, S) => START.includes(k) || (gate[k] && S.has(gate[k])) || (A.PARTS[k].era != null);
const kinds = S => new Set(Object.keys(A.PARTS).filter(k => openIn(k, S) && A.PARTS[k].era == null).map(k => A.PARTS[k].kind));
// 2. each mission: its needs' kinds and its NEXT_PRESET open with only its req closure done
const needKind = { sci: 'sci', bio: 'bio', cam: 'cam', ant: 'ant', dock: 'port', bay: 'bay', les: 'les', hab: 'hab', lab: 'lab' };
const needOK = (n, S) => { if (n.id === 'chute') return ['chute', 'leg'].some(k => kinds(S).has(k)); if (n.id === 'crew') return openIn('crew', S); if (n.id === 'mass') return openIn('ballast', S);
  if (n.id.startsWith('part:')) return openIn(n.id.slice(5), S); return kinds(S).has(needKind[n.id]); };
const presetParts = n => [...new Set(A.newShip(A.PRESETS[n]).parts.map(p => p.d.key))];
let bad = 0;
for (const X of A.MISSIONS) { const S = clos([X.id]), J = A.CT_JOB[X.id] || {}, needs = typeof J.needs === 'function' ? J.needs({}) : J.needs || [];
  const miss = needs.filter(n => !needOK(n, S)).map(n => n.id), P = A.NEXT_PRESET[X.id], pm = P ? presetParts(P).filter(k => !openIn(k, S)) : [];
  if (miss.length || pm.length) { bad++; console.log(`MISSION ${X.id}: needs closed [${miss}]  preset ${P || '-'} closed parts [${pm.map(k => k + '<' + gate[k]).join(' ')}]`); } }
console.log('missions with a closed need or preset part:', bad);
// 3. each contract type at its req
bad = 0; for (const t in A.CT) { const T = A.CT[t], S = clos(T.req ? [T.req] : []); if (T.req) S.add(T.req); let needs = []; try { needs = (A.CT_JOB[t] && A.CT_JOB[t].needs || T.needs || (() => []))({ k: 'sparrow', m: 0.5, kind: 'hab' }) } catch (e) { }
  const miss = needs.filter(n => !needOK(n, S)).map(n => n.id); if (miss.length) { bad++; console.log(`CONTRACT ${t} (req ${T.req || '-'}): closed [${miss}]`); } }
console.log('contract types with a closed need at their req:', bad);
// 4. each preset: the missions it waits for, and how many cards each mission shows
for (const n in A.PRESETS) { let ks; try { ks = presetParts(n); } catch (e) { continue; } const w = [...new Set(ks.map(k => gate[k]).filter(Boolean))], era = ks.filter(k => A.PARTS[k].era != null);
  const top = w.filter(m => !w.some(o => o !== m && clos([o]).has(m))); console.log('PRESET', n.padEnd(18), 'after', top.join(' + ') || '(start)', era.length ? `+ era (${era})` : ''); }
console.log(); for (const X of A.MISSIONS) { const g = MAP[X.id] || []; const opens = A.MISSIONS.filter(y => req(y.id).includes(X.id)).map(y => y.id), cts = Object.keys(A.CT).filter(t => A.CT[t].req === X.id);
  console.log(`ep${X.ep} ${X.id.padEnd(12)} req [${req(X.id)}]`.padEnd(46), `parts ${String(g.length).padStart(2)}  missions ${opens.length}  contract types ${cts.length}`); }
