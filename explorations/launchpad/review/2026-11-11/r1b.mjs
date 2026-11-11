import { mk } from './h.mjs';
const N = 'PROG,HOOK,programNew,chooseStart,advanceDays,progJSON,progRestore,buildStation,coverOf,TELLUS,SELENE,satRegister,FLEET,POWERS,acceptOffer,sanction,MISSIONS,buildFac,careerMove,PROG_SCHEMA';
const J = JSON.stringify;
const run = (X, d) => { X.programNew({ wseed: 5 }); X.chooseStart('agency'); X.advanceDays(d); return X; };
const A = mk(N), B = mk(N);
run(A, 700);
// dirty the first career through the game's own calls where they exist
const P = A.PROG; let did = [];
try { for (const o of (P.offers || []).slice(0, 3)) { A.acceptOffer(o.id); } did.push('accepted ' + P.active.length); } catch (e) { did.push('accept threw ' + e.message); }
try { A.sanction(1, 500, 'x'); A.sanction(2, 500, 'x'); did.push('sanctions'); } catch (e) { did.push(e.message); }
try { P.funds = 5000; const r = A.buildStation && A.buildStation(0); did.push('station ' + J(r).slice(0, 60) + ' n=' + P.stations.length); } catch (e) { did.push('station threw ' + e.message); }
try { A.coverOf(A.TELLUS); A.coverOf(A.SELENE); did.push('coverOf'); } catch (e) { did.push('cover threw ' + e.message); }
try { A.careerMove && did.push('careerMove ' + J(A.careerMove(2)).slice(0, 40)); } catch (e) { did.push('careerMove threw ' + e.message); }
A.advanceDays(300);
console.log('dirty:', did.join('; '), '| day', P.day.toFixed(0), 'home', A.HOME, 'POWERS state', J(A.POWERS).length);
const pw0 = J(B.POWERS), pwA = J(A.POWERS);
console.log('POWERS mutated by play:', pw0 !== pwA);
run(A, 400); run(B, 400);
const dk = Object.keys({ ...A.PROG, ...B.PROG }).filter(k => J(A.PROG[k]) !== J(B.PROG[k]));
console.log('after reset + 400 days, fields that differ from a fresh SIM:', dk.join(', ') || 'none');
for (const k of dk.slice(0, 6)) console.log(' ', k, J(A.PROG[k]).slice(0, 160), '|', J(B.PROG[k]).slice(0, 160));
console.log('RIVALS same:', J(A.RIVALS) === J(B.RIVALS), 'HOME', A.HOME, B.HOME, 'POWERS same', J(A.POWERS) === J(B.POWERS));
