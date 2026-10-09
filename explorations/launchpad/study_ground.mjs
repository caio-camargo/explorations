// study_ground.mjs — measures a body's ground recipe headless (world session, GROUND.md slice G2): bake time and
// sample cost, continuity across the crater cells' cube-face seams, crater counts against the target, relief, slopes
// by unit, flat ground for landers, and the ground that never sees the sun. Selene for now.
//   node study_ground.mjs            (about a minute)
//   node study_ground.mjs quick      (skips the polar darkness scan)
import { pageSource } from './page.mjs';
const html = pageSource(), src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const G = new Function(src + 'return {SELENE,SELENE_GROUND,seleneMap,seleneH,craterBands,grBands,GR_C,GR_MARE_THIN,geoAt,terrainSlope,groundAlt,bodyH,ih3,SUN_DIR,norm,dot,cross,add,mul,sub,len};')();
const { SELENE: B, norm, dot, cross, add, mul } = G, R = B.R, D2R = Math.PI / 180, quick = process.argv.includes('quick');
B.ground = G.SELENE_GROUND;
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))], f1 = x => x.toFixed(1), f0 = x => x.toFixed(0);
let rs = 1; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
const sph = () => { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), q = Math.sqrt(1 - z * z); return [q * Math.cos(t), z, q * Math.sin(t)]; };

// 1. bake and cost
let t0 = performance.now(); const M = G.seleneMap(); const tBake = performance.now() - t0;
const U = []; for (let i = 0; i < 20000; i++) U.push(sph());
t0 = performance.now(); let acc = 0; for (const u of U) acc += G.seleneH(u); const tH = (performance.now() - t0) / U.length * 1000;
console.log(`bake ${f0(tBake)} ms (map ${M.W}×${M.H}, ${(R * 2 * Math.PI / M.W / 1000).toFixed(2)} km a texel at the equator, ${M.craters.length} baked craters ≥ 20 km); one height ${tH.toFixed(1)} µs`);
console.log(`bands: ${G.grBands(R).map(b => `${f1(b.Dlo / 1000)}–${f1(b.Dhi / 1000)} km (n ${b.n}, λ ${b.lam.toFixed(2)})`).join(' · ')}`);

// 2. relief
const H = U.map(u => G.seleneH(u)).sort((a, b) => a - b);
console.log(`relief: map ${f0(M.lo)}…${f0(M.hi)} m; sampled p0.1 ${f0(pct(H, .001))}, p50 ${f0(pct(H, .5))}, p99.9 ${f0(pct(H, .999))}, max ${f0(H[H.length - 1])} m (recipe top ${G.SELENE_GROUND.top})`);

// 3. continuity: pairs 0.5 m apart everywhere, and on the cube's face edges (|x| = |y| etc.)
const jump = (u, k) => { const e = norm(cross(u, Math.abs(u[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(u, mul(e, 0.5 / R))); return Math.abs(G.seleneH(v) - G.seleneH(u)) / 0.5; };
let worst = 0, worstE = 0;
for (let i = 0; i < 20000; i++) worst = Math.max(worst, jump(U[i]));
for (let i = 0; i < 20000; i++) { const a = 2 * rnd() - 1, b = 2 * rnd() - 1, ax = i % 3, u = [0, 0, 0]; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = a; worstE = Math.max(worstE, jump(norm(u))); }
console.log(`continuity: steepest 0.5 m step ${f1(Math.atan(worst) / D2R)}° anywhere, ${f1(Math.atan(worstE) / D2R)}° on cube-face edges (a seam would show as a near-vertical step)`);

// 4. crater counts: enumerate the band cells (the finest band sampled), cumulative N(>D) per km² against GR_C·D⁻²
const area = 4 * Math.PI * (R / 1000) ** 2, bins = [20, 10, 5, 2, 1, .5, .2];
const cnt = Object.fromEntries(bins.map(d => [d, 0])); let mareN = 0, highN = 0;
for (const c of M.craters) for (const d of bins) if (c.D / 1000 >= d) cnt[d]++;
G.grBands(R).forEach((b, bi) => {
  const n = b.n, frac = n > 900 ? 0.02 : 1;   // the finest bands are sampled
  for (let f = 0; f < 6; f++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (frac < 1 && G.ih3(i, j, f + 99) > frac) continue;
    const key = f * 65536 + i, zz = j * 8 + bi * 131072; if (G.ih3(key, zz, 7001) >= b.lam) continue;
    const ax = f >> 1, sg = f & 1 ? -1 : 1, p1 = [1, 0, 0][ax] === 1 ? 1 : 0, c = [0, 0, 0], FACE = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]][ax * 2];
    c[ax] = sg; c[FACE[1]] = Math.tan(((i + G.ih3(key, zz, 7002)) / n * 2 - 1) * Math.PI / 4); c[FACE[2]] = Math.tan(((j + G.ih3(key, zz, 7003)) / n * 2 - 1) * Math.PI / 4);
    const cu = norm(c), Mc = G.geoAt(B, cu).M, fl = Math.min(1, Math.max(0, (Mc - .05) / .45)), kept = !(G.ih3(key, zz, 7005) < G.GR_MARE_THIN * fl * fl * (3 - 2 * fl)); if (!kept) continue;
    const D = 1 / Math.sqrt(1 / b.Dlo ** 2 - G.ih3(key, zz, 7004) * (1 / b.Dlo ** 2 - 1 / b.Dhi ** 2)) / 1000;
    for (const d of bins) if (D >= d) cnt[d] += 1 / frac;
    if (D >= 1) { if (Mc >= .2) mareN += 1 / frac; else highN += 1 / frac; } } });
console.log('craters N(>D) per km², measured / target GR_C·D⁻² (before mare thinning): ' + bins.map(d => `>${d} km ${(cnt[d] / area).toExponential(2)} / ${(G.GR_C / d / d).toExponential(2)}`).join(' · '));
const mareShare = U.filter(u => G.geoAt(B, u).unit === 'mare').length / U.length;
console.log(`craters ≥ 1 km per 1,000 km²: highland ${f1(highN / (area * (1 - mareShare)) * 1e3)}, mare ${f1(mareN / (area * mareShare) * 1e3)} (mare ${f1(mareShare * 100)} % of Selene)`);

// 5. slopes by unit, as the lander sees them (terrainSlope: ±15 m), and flat ground
const sl = { mare: [], high: [] };
for (let i = 0; i < 6000; i++) { const u = U[i]; sl[G.geoAt(B, u).unit].push(G.terrainSlope(B, u) / D2R); }
for (const k in sl) { const a = sl[k].sort((x, y) => x - y), sh = t => f1(a.filter(x => x > t).length / a.length * 100);
  console.log(`slopes on ${k}: median ${f1(pct(a, .5))}°, p90 ${f1(pct(a, .9))}°, p99 ${f1(pct(a, .99))}°, max ${f1(a[a.length - 1])}° · over 10° ${sh(10)} %, over TOPPLE 24° ${sh(24)} %, under 5° ${f1(a.filter(x => x < 5).length / a.length * 100)} %`); }

// 6. never in the sun: SUN_DIR is fixed (6.8° above Selene's equator) and Selene turns once an orbit, so over a lunar
// day the sun circles each point's sky at a fixed declination. A point is dark for good if, at every hour, the ground
// toward the sun stands above it (marched out to 60 km, curvature included). Sampled south of 70°S.
if (!quick) {
  const dec = Math.asin(G.SUN_DIR[1] / Math.hypot(...G.SUN_DIR)), out = [];
  for (const la0 of [-70, -75, -80, -83, -86, -89]) { let dark = 0, n = 0;
    for (let k = 0; k < 120; k++) { const lo = 2 * Math.PI * rnd(), la = (la0 - 2.5 * rnd()) * D2R, u = [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)], h0 = G.seleneH(u) + 2;
      let lit = false; n++;
      for (let hr = 0; hr < 48 && !lit; hr++) { const ha = hr / 48 * 2 * Math.PI, s = [Math.cos(dec) * Math.cos(ha), Math.sin(dec), Math.cos(dec) * Math.sin(ha)];
        const el = Math.asin(dot(s, u)); if (el < -0.02) continue;
        const az = norm(add(s, mul(u, -dot(s, u)))); let blocked = false;
        for (let d = 60; d < 60e3 && !blocked; d *= 1.12) { const a = d / R, p = norm(add(mul(u, Math.cos(a)), mul(az, Math.sin(a)))), ray = h0 + d * Math.tan(el) - d * d / (2 * R);
          if (G.seleneH(p, d > 8e3 ? 2 : d > 2e3 ? 4 : 6) > ray) blocked = true; }
        if (!blocked) lit = true; }
      if (!lit) dark++; }
    out.push(`${la0}°: ${f0(dark / n * 100)} %`); }
  console.log(`never sunlit (2 m above the ground, 120 points per 2.5° band): ${out.join(' · ')}`);
}
