// (Q91, world session, 2026-11-17) a bench for Selene's ground pass (notes/world.md § v1.350): load into the page after views.js
// (review/2026-11-17/selbench.js). selBench(): PSELD's ms per shader variant in the current view; selCount/selCountPre: height calls per pixel.
window.selBench = async () => {
  const pre = SKY_FS.slice(0, SKY_FS.indexOf('void main(){')), main = 'void main(){vec3 d=normalize(uR*vNdc.x*uTan.x+uU*vNdc.y*uTan.y+uF);float hs,t=marchS(d,hs,coarseStartS());o=vec4(t,hs,0.,1.);}';
  const V = {
    base: pre,
    noThin: pre.replace('sst(.05,.5,sNear(ax==0?cq:ax==1?cq.yxz:cq.yzx).x)', '0.'),
    noFresh: pre.replace('if(r<1.2)sFresh=max(sFresh,wb*fr*(1.-r/1.2));', ''),
    face1: pre.replace('if(abs(q.x)<SBUA0)continue;', 'if(abs(q.x)<.577)continue;'),
    mapOnly: pre.replace('float selBands(vec3 u,float nb){', 'float selBands(vec3 u,float nb){sFresh=0.;return 0.;'),
    noShape: pre.replace('float gcH(float r,float D,float Dt,float fr,float lob){', 'float gcH(float r,float D,float Dt,float fr,float lob){return -r;'),

    bands3: pre.replace('float selBands(vec3 u,float nb){', 'float selBands(vec3 u,float nb){nb=min(nb,3.);'),
  };
  const keep = { p: PSELD.p, u: PSELD.u }, out = {};
  for (const [k, src] of Object.entries(V)) {
    const P = mkProg(QUAD_VS, src + main); PSELD.p = P.p; PSELD.u = P.u;
    Object.assign(PROF, { on: true, ms: {}, n: {} });
    for (let i = 0; i < 8; i++) { RS = 1; render(); profMark(null); await new Promise(r => setTimeout(r, 50)); }
    for (let i = 0; i < 10; i++) { profMark(null); await new Promise(r => setTimeout(r, 30)); }
    PROF.on = false; out[k] = +(PROF.ms['selene ground'] / PROF.n['selene ground']).toFixed(2);
  }
  PSELD.p = keep.p; PSELD.u = keep.u; render(); return out;
};
// the mean count of selH calls per pixel in Selene's ground pass, and in its pre-pass (x: full res, y: pre)
window.selCount = async () => {
  const pre = SKY_FS.slice(0, SKY_FS.indexOf('void main(){')).replace('float selH(vec3 pf,float nb){', 'int nCalls=0;float selH(vec3 pf,float nb){nCalls++;');
  const P = mkProg(QUAD_VS, pre + 'void main(){vec3 d=normalize(uR*vNdc.x*uTan.x+uU*vNdc.y*uTan.y+uF);float hs,t=marchS(d,hs,coarseStartS());o=vec4(float(nCalls),t<1e29?1.:0.,0.,1.);}');
  const keep = { p: PSELD.p, u: PSELD.u }; PSELD.p = P.p; PSELD.u = P.u; RS = 1; render();
  const T = SELD_RT, buf = new Float32Array(T.w * T.h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.readPixels(0, 0, T.w, T.h, gl.RGBA, gl.FLOAT, buf); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  PSELD.p = keep.p; PSELD.u = keep.u; let s = 0, n = 0, mx = 0, hits = 0; for (let i = 0; i < T.w * T.h; i++) { s += buf[i * 4]; n++; mx = Math.max(mx, buf[i * 4]); hits += buf[i * 4 + 1]; }
  return { mean: +(s / n).toFixed(2), max: mx, hitShare: +(hits / n).toFixed(2) };
};
// the same count for the pre-pass's march (from 0, one secant step), at full resolution
window.selCountPre = async () => {
  const pre = SKY_FS.slice(0, SKY_FS.indexOf('void main(){')).replace('float selH(vec3 pf,float nb){', 'int nCalls=0;float selH(vec3 pf,float nb){nCalls++;').replace('int sec=0,ns=uSelPre>.5?1:2;', 'int sec=0,ns=1;');
  const P = mkProg(QUAD_VS, pre + 'void main(){vec3 d=normalize(uR*vNdc.x*uTan.x+uU*vNdc.y*uTan.y+uF);float hs,t=marchS(d,hs,0.);o=vec4(float(nCalls),t<1e29?1.:0.,0.,1.);}');
  const keep = { p: PSELD.p, u: PSELD.u }; PSELD.p = P.p; PSELD.u = P.u; RS = 1; render();
  const T = SELD_RT, buf = new Float32Array(T.w * T.h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.readPixels(0, 0, T.w, T.h, gl.RGBA, gl.FLOAT, buf); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  PSELD.p = keep.p; PSELD.u = keep.u; const h = new Array(11).fill(0); let s = 0, n = 0; for (let i = 0; i < T.w * T.h; i++) { const c = buf[i * 4]; s += c; n++; h[Math.min(10, Math.floor(c / 10))]++; }
  return { mean: +(s / n).toFixed(2), hist: h.map(x => +(x / n).toFixed(3)) };
};
