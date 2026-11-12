// The NaN in glide_e2e.mjs, traced: the plates' rate damping is integrated explicitly, so a light craft with big
// plates in thick, fast air overshoots its own roll damping each step (stable only while c*dt/I < 2).
// Run from explorations/launchpad: node review/2026-11-11/rollnan.mjs [fix]
const H = await import(new URL('./h.mjs', import.meta.url).href);
const FIX = process.argv[2] === 'fix';
let src = H.src;
if (FIX) {   // the guard tried: the plates' damping taken implicitly, dw = tau*dt/(I + c*dt), c from the plates alone
  const a = 'const alB=[(tau[0]+tauW[0])/s.I[0],(tau[1]+tauW[1])/s.I[1],(tau[2]+tauW[2])/s.I[2]];';
  if (src.split(a).length !== 2) throw new Error('anchor');
  src = src.replace(a, 'const cD=plateDamp(s,vb,rho),alB=[(tau[0]+tauW[0])/(s.I[0]+cD[0]*dt),(tau[1]+tauW[1])/(s.I[1]+cD[1]*dt),(tau[2]+tauW[2])/(s.I[2]+cD[2]*dt)];');
  src += `
function plateDamp(s,vb,rho){const c=[0,0,0];if(!(rho>0)||!s.fins.length)return c;const sp=len(vb);if(sp<1)return c;
  for(const p of s.fins){const d=p.d,A=d.span*d.chord,py=p.y0+d.chord/2,one=d.kind==='rfin',rr=one?d.span/2:d.r+d.span/2;
    for(const[ax,az]of one?[[Math.cos(p.phi),Math.sin(p.phi)]]:FIN4){const px=p.pos[0]+ax*rr,pz=p.pos[2]+az*rr,n=[-az,0,ax],r=[px-s.cm[0],py-s.cm[1],pz-s.cm[2]];
      const k=0.5*rho*sp*A*3.5,m=cross(r,n);   // dN/d(normal speed) = q*A*3.5/v; a turn w about axis i moves the plate along its normal by m[i]
      c[0]+=k*m[0]*m[0];c[1]+=k*m[1]*m[1];c[2]+=k*m[2]*m[2]}}
  return c}`;
}
const mk = names => { const X = new Function(src + `return {${names},get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)(); X.HOOK.news = () => {}; X.HOOK.msg = () => {}; X.HOOK.save = () => {}; return X; };
const A = mk('HOOK,newShip,geom,TELLUS,density,physStep,DT,len,norm,add,mul,cross,sub,dot,surfVel,qrot,qconj,qFromBasis');
const B = A.TELLUS;

// a craft flying level, nose first, at speed v and height h, given a small roll rate: does the roll die out or run away?
function drop(stack, span, chord, h, v, tmax = 4) {
  const s = A.newShip(stack); A.geom(s);
  for (const p of s.fins) p.d = { ...p.d, span, chord };
  for (const p of s.parts) p.d = { ...p.d, Tmax: 1e9, T: 1e9, C: 1e9, B: 1e9, S: 1e9 };   // no heat, no breaking: the rotation alone
  A.geom(s);
  const r0 = B.R + h; s.landed = false; s.r = [r0, 0, 0];
  const vs = A.surfVel(B, s.r), nose = [0, 0, 1]; s.v = A.add(vs, A.mul(nose, v));   // level flight, nose first
  const X = [0, 1, 0], Z = A.cross(X, nose); s.q = A.qFromBasis(X, nose, Z);
  s.w = A.mul(nose, 0.1); s.sas = false; s.throttle = 0;
  const rho = A.density(B, h); let wmax = 0, t = 0, flips = 0, lastSign = 1;
  // the stability number for roll: c*dt/I with c = sum over plates of q*A*3.5*r^2/v
  const fin = s.fins[0], rr = fin.d.r + span / 2, c = 4 * 0.5 * rho * v * span * chord * 3.5 * rr * rr, num = c * A.DT / s.I[1];
  while (t < tmax) { A.physStep(s, A.DT); t += A.DT; const wb = A.qrot(A.qconj(s.q), s.w);
    if (!isFinite(wb[1])) return { num, I: s.I[1], out: 'NaN at ' + t.toFixed(2) + ' s' };
    if (Math.sign(wb[1]) !== lastSign) { flips++; lastSign = Math.sign(wb[1]); } wmax = Math.max(wmax, Math.abs(wb[1])); }
  const wb = A.qrot(A.qconj(s.q), s.w);
  return { num, I: s.I[1], out: `roll ${Math.abs(wb[1]).toExponential(1)} rad/s after ${tmax} s (peak ${wmax.toExponential(1)}, ${flips} sign flips)` };
}
console.log(FIX ? 'WITH the implicit damping guard' : 'the game as it is');
for (const [name, stack, span, chord] of [
  ['stock fin ring 0.9 x 0.9 on pod + 1 t tank', ['pod', 't1', 'fins'], 0.9, 0.9],
  ['fin ring at the largest fin size, 2 x 2', ['pod', 't1', 'fins'], 2, 2],
  ['wing plates 3 x 2', ['pod', 't1', 'fins'], 3, 2],
  ['wing plates 5 x 2', ['pod', 't1', 'fins'], 5, 2]]) {
  console.log(name);
  for (const [h, v] of [[500, 100], [500, 250], [500, 500], [5000, 500], [10000, 800], [25000, 1500]]) {
    const r = drop(stack, span, chord, h, v);
    console.log(`  h ${(h / 1e3).toFixed(1)} km, ${v} m/s: c*dt/I = ${r.num.toFixed(2)} (roll inertia ${r.I.toFixed(0)} kg m2) -> ${r.out}`);
  }
}
