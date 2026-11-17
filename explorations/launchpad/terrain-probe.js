// Terrain agreement probe: does the GPU draw the ground where the physics thinks it is? Load into the page
// (like views.js) and call terrainProbe(). It compiles a tiny program from the sky shader's own source that writes
// terr(pf) for many directions into a float texture, reads it back, and compares with the CPU's terrainH(pf).
// Also: overView(lat, lon, alt, yaw, pitch, dist, hour) puts the camera over any spot at a given local hour, and
// gpuTime() times one frame on the GPU at full resolution.
window.terrainProbe = () => {
  gl.getExtension('EXT_color_buffer_float');
  const src = SKY_FS.slice(0, SKY_FS.indexOf('void main(){')) + `uniform highp sampler2D uDirs;
void main(){ivec2 c=ivec2(gl_FragCoord.xy);vec3 pf=texelFetch(uDirs,c,0).xyz;o=vec4(terr(pf,9.),0.,0.,1.);}`;
  const P = mkProg(QUAD_VS, src), rnd = rng(5), D = Math.PI / 180;
  const run = (N, mk) => {
    const dirs = new Float32Array(N * N * 4), cpu = [];
    for (let i = 0; i < N * N; i++) { const u = mk(); dirs.set([u[0], u[1], u[2], 0], i * 4); cpu.push(terrainH(u)); }
    const tex = (unit, data) => { gl.activeTexture(gl.TEXTURE0 + unit); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, data); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
    const td = tex(3, dirs), rt = tex(4, null), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt, 0);
    gl.useProgram(P.p); const u = P.u; gl.uniform1i(u.uDirs, 3);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, WORLD_TEX.w); gl.uniform1i(u.uWorld, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, WORLD_TEX.c); gl.uniform1i(u.uClim, 2);
    gl.uniform2f(u.uGen, Math.cos(-WORLD.lon0), Math.sin(-WORLD.lon0)); { const ns = sitesNear([1, 0, 0], 4), a = new Float32Array(16); ns.forEach((x, i) => a.set([x.u[0], x.u[1], x.u[2], x.h], i * 4)); gl.uniform4fv(u['uSites[0]'], a); gl.uniform1i(u.uNS, ns.length); } gl.uniform1f(u.uPR, TELLUS.R);
    gl.viewport(0, 0, N, N); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND);
    gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    const out = new Float32Array(N * N * 4); gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(td); gl.deleteTexture(rt); gl.activeTexture(gl.TEXTURE0);
    const e = cpu.map((c, i) => Math.abs(out[i * 4] - c)).sort((a, b) => a - b);
    return { n: e.length, median_m: +e[e.length >> 1].toFixed(4), p99_m: +e[Math.floor(e.length * .99)].toFixed(3), max_m: +e[e.length - 1].toFixed(3) };
  };
  const sph = () => { const z = rnd() * 2 - 1, ph = rnd() * 6.283, q = Math.sqrt(1 - z * z); return [q * Math.cos(ph), z, q * Math.sin(ph)]; };
  const r = {
    global: run(64, sph),
    nearPad: run(32, () => { const a = rnd() * 6.283, s = rnd() * 8000 / TELLUS.R; return norm([1, s * Math.cos(a), s * Math.sin(a)]); }),
    mountains: run(32, () => { const la = (64 + rnd() * 4) * D, lo = (57 + rnd() * 10) * D; return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]; }),
  };
  render(); return r;
};
window.overView = async (latD, lonD, alt, yaw, pitch, dist, hour = 11) => {
  const D = Math.PI / 180, P = 2 * Math.PI / TELLUS.rot, u = [Math.cos(latD * D) * Math.cos(lonD * D), Math.sin(latD * D), Math.cos(latD * D) * Math.sin(lonD * D)];
  if (mode !== 'flight') { stackDef = JSON.parse(JSON.stringify(PRESETS.Orbiter)); editorChanged(); document.getElementById('launch').click(); }
  let noon = 0, best = -2; for (let k = 0; k < 720; k++) { const t = k / 720 * P, e = dot(fromPF(TELLUS, u, t), SUN); if (e > best) { best = e; noon = t; } }
  simT = P * 3 + noon + (hour - 12) / 24 * P;   // after the launch click, which resets the clock
  S.landed = false; S.throttle = 0; S.ana = null;
  const gH = Math.max(0, terrainH(u)); S.r = fromPF(TELLUS, mul(u, TELLUS.R + gH + alt), simT); S.v = surfVel(TELLUS, S.r);
  cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; document.querySelectorAll('.ui,#perf,#news,#msg').forEach(e => e.style.visibility = 'hidden');
  RS = 1; render(); return { ground_m: Math.round(gH), biome: biomeAt(u).name };
};
window.gpuTime = async (n = 3) => {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), res = [];
  for (let i = 0; i < n; i++) { RS = 1; render(); const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); RS = 1; render(); gl.endQuery(ext.TIME_ELAPSED_EXT);
    for (let k = 0; k < 100; k++) { await new Promise(r => setTimeout(r, 8)); if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; }
    res.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
  res.sort((a, b) => a - b); return +res[n >> 1].toFixed(2);
};
// (Q91, GROUND.md G3) Selene's probe: selH(pf, 6 bands) in the sky shader's own source against the CPU's seleneH(pf).
// Global, near the place Endymion, and in the highlands' small craters (directions within 3 km of one spot). Lights
// Selene's ground for the run if it isn't live (the map is baked on first use).
window.selProbe = () => {
  gl.getExtension('EXT_color_buffer_float');
  const was = SELENE.ground; SELENE.ground = SELENE_GROUND; seleneMap(); selTex();
  const src = SKY_FS.slice(0, SKY_FS.indexOf('void main(){')) + `uniform highp sampler2D uDirs;
void main(){ivec2 c=ivec2(gl_FragCoord.xy);vec3 pf=texelFetch(uDirs,c,0).xyz;o=vec4(selH(pf,6.),0.,0.,1.);}`;
  const P = mkProg(QUAD_VS, src), rnd = rng(7);
  const run = (N, mk) => {
    const dirs = new Float32Array(N * N * 4), cpu = [];
    for (let i = 0; i < N * N; i++) { const u = mk(); dirs.set([u[0], u[1], u[2], 0], i * 4); cpu.push(seleneH(u)); }
    const tex = (unit, data) => { gl.activeTexture(gl.TEXTURE0 + unit); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, N, 0, gl.RGBA, gl.FLOAT, data); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
    const td = tex(3, dirs), rt = tex(4, null), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rt, 0);
    gl.useProgram(P.p); gl.uniform1i(P.u.uDirs, 3); gl.activeTexture(gl.TEXTURE15); gl.bindTexture(gl.TEXTURE_2D, SELTEX.tex); gl.uniform1i(P.u.uSelM, 15); gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, SELTEX.e); gl.uniform1i(P.u.uSelE, 9);
    gl.viewport(0, 0, N, N); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND);
    gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    const out = new Float32Array(N * N * 4); gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(td); gl.deleteTexture(rt); gl.activeTexture(gl.TEXTURE0);
    const e = cpu.map((c, i) => Math.abs(out[i * 4] - c)).sort((a, b) => a - b);
    return { n: e.length, median_m: +e[e.length >> 1].toFixed(4), p99_m: +e[Math.floor(e.length * .99)].toFixed(3), max_m: +e[e.length - 1].toFixed(3) };
  };
  const sph = () => { const z = rnd() * 2 - 1, ph = rnd() * 6.283, q = Math.sqrt(1 - z * z); return [q * Math.cos(ph), z, q * Math.sin(ph)]; };
  const near = (c, km) => () => { const e = norm(cross(Math.abs(c[1]) < .9 ? [0, 1, 0] : [1, 0, 0], c)), n = cross(c, e), a = rnd() * 6.283, s = Math.sqrt(rnd()) * km * 1e3 / SELENE.R;
    return norm(add(c, add(mul(e, s * Math.cos(a)), mul(n, s * Math.sin(a))))); };
  const P0 = selPlaces()[0];
  const r = { global: run(64, sph), endymion: run(48, near(P0.c, P0.D / 2e3 * 1.3)), spot3km: run(48, near(norm([-.6, .3, .74]), 3)) };
  SELENE.ground = was; render(); return r;
};
