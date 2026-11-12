// Q592 prototype: the plate formula a winged return needs, tried OUTSIDE the game code. The sim's source is patched in
// memory (three string replacements, each checked) and flown with the game's real physics step. Nothing here ships.
//   1. a part with d.wing gets wingCN() in place of the plate line: aspect ratio, a stall, a Mach term, leading-edge drag
//   2. such a plate takes heat (wingQ)
//   3. the plates' rate damping is taken implicitly above c*dt/I = 0.5 (rollnan.mjs: the NaN), unchanged below it
// A fin without d.wing runs the game's own line, so a rocket's fins are untouched (checked by run 'fins').
// Run from explorations/launchpad: node review/2026-11-11/wing_proto.mjs [table|fly|sas|fins]
const H = await import(new URL('./h.mjs', import.meta.url).href);
function patch(src, on) {
  if (!on) return src;
  const rep = (a, b) => { if (src.split(a).length !== 2) throw new Error('anchor: ' + a.slice(0, 40)); src = src.replace(a, () => b); };
  rep('N=qL*A*(3.5*sa*ca+1.2*sa*Math.abs(sa)),sf=qL*A*0.012/fl;',
    'W=d.wing?wingCN(sa,ca,M,d):null,N=qL*A*(W?W.cn:3.5*sa*ca+1.2*sa*Math.abs(sa)),sf=qL*A*(0.012+(W?W.cd0:0))/fl;if(W)p.Q+=wingQ(rho,fl,Math.abs(sa),d);');
  rep('const alB=[(tau[0]+tauW[0])/s.I[0],(tau[1]+tauW[1])/s.I[1],(tau[2]+tauW[2])/s.I[2]];',
    'const cD=plateDamp(s,vb,rho,dt),alB=[(tau[0]+tauW[0])/(s.I[0]+cD[0]),(tau[1]+tauW[1])/(s.I[1]+cD[1]),(tau[2]+tauW[2])/(s.I[2]+cD[2])];');
  return src + `
const WING={tc:0.06,le:0.03,sweep:0.5,stall:14,stallLowAR:3.5,stallBand:6};   // thickness/chord, leading-edge radius/chord, cos^2 of the sweep, stall angle (deg) at AR>=4, extra deg per unit AR under 4, the band it stalls over
function wingK0(d){const AR=2*d.span/d.chord;return 6.2832*AR/(2+Math.sqrt(4+AR*AR))}   // Helmbold: the lift slope of a mirrored pair of plates
function wingCN(sa,ca,M,d){const s=Math.abs(sa),AR=2*d.span/d.chord,k0=wingK0(d),kM=Math.min(k0,4/Math.sqrt(Math.max(M*M-1,0.01)));
  const as=(WING.stall+WING.stallLowAR*clamp(4-AR,0,3))*0.01745,x=clamp((Math.asin(Math.min(1,s))-as)/(WING.stallBand*0.01745),0,1),att=1-x*x*(3-2*x);
  const sub=att*k0*s*ca+(1-att)*1.364*6.2832*s/(4+3.1416*s);   // attached, then a separated flat plate (Kirchhoff, scaled to 1.2 broadside)
  const sup=kM*s*ca+cpMax(M)*s*s,w=clamp((M-0.9)/0.4,0,1);    // linear supersonic lift falling as 4/sqrt(M^2-1), plus the Newtonian impact term
  return{cn:Math.sign(sa)*((1-w)*sub+w*sup),cd0:w*WING.tc*1.2*WING.sweep}}   // a blunt leading edge's wave drag, supersonic only
function wingQ(rho,fl,s,d){const A=d.span*d.chord,rle=WING.le*d.chord;
  return HEAT_GAIN*SG*fl*fl*fl*(Math.sqrt(rho/d.chord)*s*A+Math.sqrt(rho/rle)*0.7*d.span*3.1416*rle)}   // the windward face as a blunt body one chord across, plus the leading edge
function plateDamp(s,vb,rho,dt){const c=[0,0,0];if(!(rho>0)||!s.fins.length)return c;const sp=len(vb);if(sp<1)return c;
  for(const p of s.fins){const d=p.d,A=d.span*d.chord,py=p.y0+d.chord/2,one=d.kind==='rfin',rr=one?d.span/2:d.r+d.span/2,k=0.5*rho*sp*A*(d.wing?wingK0(d):3.5);
    for(const[ax,az]of one?[[Math.cos(p.phi),Math.sin(p.phi)]]:FIN4){const m=cross([p.pos[0]+ax*rr-s.cm[0],py-s.cm[1],p.pos[2]+az*rr-s.cm[2]],[-az,0,ax]);
      c[0]+=k*m[0]*m[0];c[1]+=k*m[1]*m[1];c[2]+=k*m[2]*m[2]}}
  return c.map((x,i)=>{const e=Math.max(0,x*dt-0.5*s.I[i]);if(e>0&&globalThis.DBG)globalThis.DBG(i,x*dt/s.I[i],sp,rho);return e})}   // only the excess over c*dt/I = 0.5, so anything flying today is bit-for-bit the same
`;
}
const mkP = (on, names) => { const X = new Function(patch(H.src, on) + `return {${names},get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)(); X.HOOK.news = () => {}; X.HOOK.save = () => {}; X.msgs = []; X.HOOK.msg = m => X.msgs.push(m); return X; };
const NAMES = 'HOOK,PARTS,newShip,aeroPass,geom,SND,TELLUS,density,physStep,DT,G0,len,norm,add,mul,cross,sub,dot,surfVel,qrot,qconj,qFromBasis,toPF,groundR,seaAt';
const A = mkP(true, NAMES), B = A.TELLUS, D2R = Math.PI / 180;
const rotAbout = (v, k, a) => A.add(A.add(A.mul(v, Math.cos(a)), A.mul(A.cross(k, v), Math.sin(a))), A.mul(k, A.dot(k, v) * (1 - Math.cos(a))));
const WKG = 40;   // kg per square metre of plate: a shuttle's wing group with its tiles is about 38

// the craft: a stack with one wing ring (four plates: two lift, two stand as fins) resized, and optionally a steerable tail ring
function build(X, { stack, span, chord, tail, wing = true, noHeat = false, empty = false }) {
  const s = X.newShip(stack); X.geom(s);
  if (empty) for (const p of s.parts) if (p.res.fuel) p.res.fuel = 0;   // home from orbit: the tanks are dry
  for (const p of s.fins) {
    if (p.d.ctl) { if (tail) p.d = { ...p.d, span: tail[0], chord: tail[1], h: tail[1], m: 4 * tail[0] * tail[1] * WKG / 1000, wing, Tmax: 1900 }; }
    else p.d = { ...p.d, span, chord, h: chord, m: 4 * span * chord * WKG / 1000, wing, Tmax: 1900 };   // tiles and carbon: 1500 to 1900 K
  }
  if (noHeat) for (const p of s.parts) p.d = { ...p.d, Tmax: 1e9 };
  X.geom(s); return s;
}

// ---- table: lift-to-drag by Mach and angle, old line against new
function table() {
  for (const [name, cfg] of [['3 x 2 m plates on pod + 1 t tank', { stack: ['pod', 't1', 'fins'], span: 3, chord: 2 }], ['5 x 2 m', { stack: ['pod', 't1', 'fins'], span: 5, chord: 2 }]]) {
    console.log(name);
    for (const wing of [false, true]) for (const M of [0.3, 0.8, 2, 5, 15]) {
      const row = [5, 10, 15, 20, 30, 40].map(aoa => { const s = build(A, { ...cfg, wing });
        for (const p of s.parts) { p.F = [0, 0, 0]; p.L = [0, 0, 0]; p.Q = 0; }
        const h = 5000, v = M * A.SND(h), a = aoa * D2R, vb = [v * Math.sin(a), v * Math.cos(a), 0];
        A.aeroPass(s, vb, [0, 0, 0], A.density(B, h), M, false);
        let F = [0, 0, 0]; for (const p of s.parts) F = A.add(F, p.F);
        const u = A.mul(vb, 1 / v), D = -A.dot(F, u), L = A.len(A.sub(F, A.mul(u, -D))), q = 0.5 * A.density(B, h) * v * v;
        return `${aoa}: ${(L / D).toFixed(2)} (CL ${(L / (q * 2 * cfg.span * cfg.chord)).toFixed(2)})`; });
      console.log(`  ${wing ? 'new' : 'old'} M ${String(M).padEnd(4)} ` + row.join(' | '));
    }
  }
}

// ---- fly: an entry from 120 km to the ground. aoa is a schedule on Mach: hi above M 5, lo below M 2.
function fly(X, { name, cfg, hi, lo, bank = 0, mode = 'kin', flare = null, h0 = 120e3, gamma = -1.5, vk = 0.99, tmax = 9000 }) {
  X.msgs.length = 0; const s = build(X, cfg);
  const r0 = B.R + h0, vc = Math.sqrt(B.mu / r0) * vk, g = gamma * D2R;
  s.landed = false; s.r = [r0, 0, 0]; s.v = [vc * Math.sin(g), 0, -vc * Math.cos(g)];
  if (X.dot(s.v, X.surfVel(B, s.r)) < 0) s.v[2] = -s.v[2];
  s.w = [0, 0, 0]; s.sas = mode === 'sas'; s.sasMode = 'stab'; s.throttle = 0;
  const t0 = X.t, m0 = s.mass, S = 2 * cfg.span * cfg.chord, bands = { 'M>5': [0, 0, 0], 'M2-5': [0, 0, 0], 'M0.3-0.9': [0, 0, 0] };
  let gmax = 0, qmax = 0, wingT = 0, hot = 0, hotName = '', track = 0, err = 0, errN = 0, errMax = 0, km1 = null, last = null, why = '', steps = 0, n0 = s.parts.filter(p => p.on).length;
  const wall = performance.now();
  while (X.t - t0 < tmax) {
    const up = X.norm(s.r), vA = X.sub(s.v, X.surfVel(B, s.r)), sp = X.len(vA), u = X.mul(vA, 1 / sp), h = X.len(s.r) - B.R, agl = X.len(s.r) - X.groundR(B, X.toPF(B, s.r, X.t)), M = sp / X.SND(h);
    let n = X.norm(X.cross(u, up)); if (!isFinite(n[0])) n = [0, 1, 0];
    const liftDir = rotAbout(X.norm(X.cross(n, u)), u, bank * D2R), sink0 = -X.dot(vA, up);
    let aoa = M > 5 ? hi : M < 2 ? lo : lo + (hi - lo) * (M - 2) / 3;
    if (flare && flare.appr && agl < 3000) aoa = flare.appr;   // the approach: a low angle, so fast, with speed in hand for the flare
    if (flare && agl < flare.below) aoa = Math.min(flare.max, Math.max(2, (flare.appr || lo) + flare.k * (sink0 - Math.max(flare.sink, agl / flare.tau))));
    const a = aoa * D2R, nose = X.norm(X.add(X.mul(u, Math.cos(a)), X.mul(liftDir, Math.sin(a))));
    if (mode === 'kin') { const Xa = X.norm(X.cross(nose, X.cross(liftDir, nose))); s.q = X.qFromBasis(Xa, nose, X.cross(Xa, nose)); s.w = [0, 0, 0]; } else s.hold = nose;
    const vb = X.qrot(X.qconj(s.q), vA);
    X.physStep(s, X.DT); steps++;
    if (!isFinite(s.r[0]) || !isFinite(s.w[0])) { why = 'NaN'; break; }
    let F = [0, 0, 0]; for (const p of s.parts) if (p.on) F = X.add(F, p.F);
    const ub = X.mul(vb, 1 / sp), Dr = -X.dot(F, ub), Lf = X.len(X.sub(F, X.mul(ub, -Dr))), bk = M > 5 ? 'M>5' : M > 2 ? 'M2-5' : M > 0.3 && M < 0.9 ? 'M0.3-0.9' : null;
    if (bk && h < 90e3) { bands[bk][0] += Lf; bands[bk][1] += Dr; bands[bk][2]++; }
    for (const p of s.fins) wingT = Math.max(wingT, p.T);
    for (const p of s.parts) if (p.on && !p.d.wing && p.T > hot) { hot = p.T; hotName = p.d.name; }
    if (h < 95e3 && agl > 200) { gmax = Math.max(gmax, s.gload); qmax = Math.max(qmax, s.qdyn); }
    if (mode === 'sas' && h < 90e3) { const e = Math.acos(Math.min(1, X.dot(X.qrot(s.q, [0, 1, 0]), nose))) / D2R; err += e; errN++; errMax = Math.max(errMax, e); }
    const vv = X.dot(vA, up), vh = Math.sqrt(Math.max(0, sp * sp - vv * vv)); track += vh * X.DT * B.R / X.len(s.r);
    if (agl < 1000 && !km1) km1 = { sink: -vv, vh };
    last = { h, agl, sp, sink: -vv, vh, M };
    if (!s.alive) { why = s.lossWhy || 'lost'; break; }
    if (s.landed) { why = 'landed'; break; }
    if (agl < 3) { why = 'at the ground'; break; }
    if (s.parts.filter(p => p.on).length < n0) { why = 'broke: ' + (X.msgs.find(m => /Structural|burned/.test(m)) || '?'); break; }
  }
  const LD = k => bands[k][2] ? (bands[k][0] / bands[k][1]).toFixed(2) : '-';
  console.log(`${name}  [${mode}] ${m0.toFixed(0)} kg, ${(m0 / S).toFixed(0)} kg/m2`);
  console.log(`  end: ${why || 'time out'} after ${(X.t - t0).toFixed(0)} s (${((performance.now() - wall) / steps * 1000).toFixed(0)} us a step) | track ${(track / 1e3).toFixed(0)} km | peak ${gmax.toFixed(1)} g, q ${(qmax / 1e3).toFixed(1)} kPa | wings ${wingT.toFixed(0)} K, hottest other ${hotName} ${hot.toFixed(0)} K`);
  console.log(`  L/D  M>5 ${LD('M>5')} | M2-5 ${LD('M2-5')} | M0.3-0.9 ${LD('M0.3-0.9')}` + (km1 && last ? ` | at 1 km: forward ${km1.vh.toFixed(0)}, sink ${km1.sink.toFixed(0)} | at ${last.agl.toFixed(0)} m: forward ${last.vh.toFixed(0)} m/s, sink ${last.sink.toFixed(1)}` : last ? ` | last h ${(last.h / 1e3).toFixed(1)} km, M ${last.M.toFixed(1)}` : ''));
  if (mode === 'sas') console.log(`  attitude: mean error ${(err / Math.max(1, errN)).toFixed(1)} deg, worst ${errMax.toFixed(0)}`);
  return { track, why };
}

const what = process.argv[2] || 'all';
const W3 = { stack: ['pod', 't1', 'fins'], span: 3, chord: 2 }, W3H = { stack: ['pod', 't4', 'fins'], span: 3, chord: 2 };
const FL = { below: +process.argv[3] || 250, sink: 1.5, tau: +process.argv[4] || 5, k: +process.argv[5] || 1.5, appr: +process.argv[6] || 6, max: 16 };   // an exponential flare: the sink wanted is the height over tau, down to 1.5 m/s
if (what === 'table' || what === 'all') table();
if (what === 'fly' || what === 'all') {
  fly(A, { name: 'heavy (4 t tank), 40 deg hypersonic then 12, approach and flare', cfg: W3H, hi: 40, lo: 12, flare: FL });
  fly(A, { name: 'light (1 t tank), 40 then 12, approach and flare', cfg: W3, hi: 40, lo: 12, flare: FL });
  if (process.argv[3]) process.exit();
  fly(A, { name: 'light, 15 deg all the way', cfg: W3, hi: 15, lo: 12, flare: FL });
  fly(A, { name: 'heavy, 15 deg all the way', cfg: W3H, hi: 15, lo: 12, flare: FL });
  fly(A, { name: 'heavy, 40 then 12, bank 45', cfg: W3H, hi: 40, lo: 12, bank: 45 });
  fly(A, { name: 'heavy, 40 then 12, no flare', cfg: W3H, hi: 40, lo: 12 });
}
if (what === 'sas' || what === 'all') {
  // can the game's own control hold it? wing ring amidships, a small steerable ring at the tail as elevons
  for (const [name, cfg] of [
    ['wing at the tail, wheels only', W3H],
    ['wing amidships + 1.2 x 0.9 steerable tail', { stack: ['pod', 'fins', 't4', 'cfins'], span: 3, chord: 2, tail: [1.2, 0.9] }],
    ['wing amidships (tank above it) + steerable tail', { stack: ['pod', 't2', 'fins', 't2', 'cfins'], span: 3, chord: 2, tail: [1.2, 0.9] }],
    ['the same, no tail ring: wheels only', { stack: ['pod', 't2', 'fins', 't2'], span: 3, chord: 2 }],
    ['the same with its tail, tanks dry', { stack: ['pod', 't2', 'fins', 't2', 'cfins'], span: 3, chord: 2, tail: [1.2, 0.9], empty: true }],
    ['tanks dry, wing moved up one tank to follow the centre of mass', { stack: ['pod', 'fins', 't2', 't2', 'cfins'], span: 3, chord: 2, tail: [1.2, 0.9], empty: true }]]) {
    if (process.argv[3] && !name.includes(process.argv[3])) continue;
    const s = build(A, cfg), w = s.fins.find(p => !p.d.ctl);
    console.log(`${name}: centre of mass y ${s.cm[1].toFixed(2)} m, wing centre y ${(w.y0 + w.d.chord / 2).toFixed(2)} m, pitch inertia ${s.I[0].toFixed(0)}, wheels ${s.torque} N m`);
    fly(A, { name: '  ' + name, cfg: { ...cfg, noHeat: true }, hi: 40, lo: 12, mode: 'sas' });
  }
}
if (what === 'fins' || what === 'all') {
  // a rocket's fins: the same entry with the game as it is and with the patch, no part marked as a wing
  const O = mkP(false, NAMES), cfg = { stack: ['pod', 't1', 'fins'], span: 0.9, chord: 0.9, wing: false };
  const plain = X => { const s = X.newShip(cfg.stack); X.geom(s); const r0 = B.R + 60e3; s.landed = false; s.r = [r0, 0, 0]; s.v = X.add(X.surfVel(B, s.r), [-300, 0, 1500]); s.w = [0.02, 0.1, 0.03]; s.sas = false;
    for (let i = 0; i < 6000 && s.alive && !s.landed; i++) X.physStep(s, X.DT); return [...s.r, ...s.v, ...s.w, ...s.q].join(','); };
  const O2 = mkP(false, NAMES), A2 = mkP(true, NAMES), a = plain(O), b = plain(A2), c = plain(O2);
  console.log('a stock fin ring through 120 s of entry: the game twice ' + (a === c ? 'identical' : 'DIFFERENT (the run is not repeatable)') + '; the game against the patch ' + (a === b ? 'identical to the last bit' : 'DIFFERENT'));
  if (a !== b) { console.log(a); console.log(b); }
}
