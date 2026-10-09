// study_ground.mjs — measures a body's ground recipe headless (world session, GROUND.md G2/G7): bake time and sample
// cost, continuity across the crater cells' cube-face seams, crater counts against the target, relief, slopes by unit,
// flat ground for landers, and (Selene) the ground that never sees the sun.
//   node study_ground.mjs [selene|enyo|hesper|astraea|theia|eos|tethys|phoebe|erebus|small:<kind>:<R m>:<seed>] [quick]      (selene by default; quick skips the polar darkness scan)
import { pageSource } from './page.mjs';
const html = pageSource(), src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const G = new Function(src + 'return {SELENE,SELENE_GROUND,seleneMap,seleneH,ENYO_GROUND,enyoMap,enyoH,GROUND_STUBS,ENYO_UNITS,EN,HESPER_GROUND,hesperMap,hesperH,HESPER_UNITS,HE,ASTRAEA_GROUND,astraeaMap,astraeaH,ASTRAEA_UNITS,AS,THEIA_GROUND,theiaMap,theiaH,THEIA_UNITS,EOS_GROUND,eosMap,eosH,EOS_UNITS,EO,TETHYS_GROUND,tethysMap,tethysH,TETHYS_UNITS,TT,PHOEBE_GROUND,phoebeMap,phoebeH,PH,EREBUS_GROUND,erebusMap,erebusH,EREBUS_UNITS,ER,smallBodyGround,smallH,smallMap,SB_KINDS,craterBands,grBands,GR_C,ptan,geoAt,terrainSlope,surfaceAt,ih3,SUN_DIR,norm,dot,cross,add,mul};')();
const { norm, dot, cross, add, mul } = G, D2R = Math.PI / 180, args = process.argv.slice(2), quick = args.includes('quick');
const stub = (name, ground, map, h, c, salt, units, nb) => { const S = G.GROUND_STUBS[name], b = { name, R: S.R, mu: S.g * S.R * S.R, ground }; const m = map();
  return { b, m, h, c, salt, nb, unit: ground.unit, units, dark: false }; };
const BODY = {
  selene: () => { const b = G.SELENE; b.ground = G.SELENE_GROUND; const m = G.seleneMap();
    return { b, m, h: G.seleneH, c: G.GR_C, salt: 0, unit: u => G.geoAt(b, u).unit, units: ['mare', 'high'], young: 'mare', dark: true }; },
  enyo: () => { const S = G.GROUND_STUBS.Enyo, b = { name: S.name, R: S.R, mu: S.g * S.R * S.R, ground: G.ENYO_GROUND }; const m = G.enyoMap();
    return { b, m, h: G.enyoH, c: G.EN.c, salt: G.EN.salt, unit: G.ENYO_GROUND.unit, units: G.ENYO_UNITS, young: 'lowland plains', dark: false }; },
  hesper: () => { const S = G.GROUND_STUBS.Hesper, b = { name: S.name, R: S.R, mu: S.g * S.R * S.R, ground: G.HESPER_GROUND }; const m = G.hesperMap();
    return { b, m, h: G.hesperH, c: G.HE.c, salt: G.HE.salt, nb: G.HE.bands, unit: G.HESPER_GROUND.unit, units: G.HESPER_UNITS, dark: false }; },
  astraea: () => { const S = G.GROUND_STUBS.Astraea, b = { name: S.name, R: S.R, mu: S.g * S.R * S.R, ground: G.ASTRAEA_GROUND }; const m = G.astraeaMap();
    return { b, m, h: G.astraeaH, c: G.AS.c, salt: G.AS.salt, unit: G.ASTRAEA_GROUND.unit, units: G.ASTRAEA_UNITS, dark: false }; },
  theia: () => stub('Theia', G.THEIA_GROUND, G.theiaMap, G.theiaH, 0, 0, G.THEIA_UNITS, 0),
  eos: () => stub('Eos', G.EOS_GROUND, G.eosMap, G.eosH, G.EO.c, G.EO.salt, G.EOS_UNITS),
  tethys: () => stub('Tethys', G.TETHYS_GROUND, G.tethysMap, G.tethysH, G.TT.c, G.TT.salt, G.TETHYS_UNITS),
  phoebe: () => ({ ...stub('Phoebe', G.PHOEBE_GROUND, G.phoebeMap, G.phoebeH, G.PH.c, G.PH.salt, ['regolith']), b0: G.PH.b0 }),
  erebus: () => stub('Erebus', G.EREBUS_GROUND, G.erebusMap, G.erebusH, G.ER.c, G.ER.salt, G.EREBUS_UNITS),
}[args.find(a => a !== 'quick') || 'selene'] || (() => {   // small:<kind>:<R m>:<seed>, a seeded small body
  const [, kind, Rs, seed] = (args.find(a => a.startsWith('small:')) || 'small:stony:5000:1').split(':'), rc = G.smallBodyGround({ kind, R: +Rs, seed: +seed }), b = { name: `${kind} ${Rs} m #${seed}`, R: rc.R, mu: rc.g * rc.R * rc.R, ground: rc }, m = G.smallMap(rc);
  return { b, m: { ...m, thin: () => 0 }, h: (u, bands) => G.smallH(u, rc, bands), b0: rc.b0, c: rc.K.c, salt: rc.salt, unit: rc.unit, units: ['pit', 'boulder', 'ridge', 'regolith'], dark: false }; });
let t0 = performance.now(); const X = BODY(), tBake = performance.now() - t0, { b: B, m: M } = X, R = B.R;
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))], f1 = x => x.toFixed(1), f0 = x => x.toFixed(0);
let rs = 1; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
const sph = () => { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), q = Math.sqrt(1 - z * z); return [q * Math.cos(t), z, q * Math.sin(t)]; };
console.log(`== ${B.name}: R ${R < 1e4 ? f0(R) + ' m' : f0(R / 1000) + ' km'}, g ${(B.mu / R / R).toPrecision(3)}, simple → complex at ${M.Dt > 1e6 ? 'never (all simple)' : f1(M.Dt / 1000) + ' km'}`);

// 1. bake and cost
const U = []; for (let i = 0; i < 20000; i++) U.push(sph());
t0 = performance.now(); for (const u of U) X.h(u); const tH = (performance.now() - t0) / U.length * 1000;
console.log(`bake ${f0(tBake)} ms (map ${M.W}×${M.H}, ${(R * 2 * Math.PI / M.W / 1000).toFixed(2)} km a texel at the equator, ${M.craters.length} baked craters); one height ${tH.toFixed(1)} µs`);
const inUse = (b, i) => i >= (X.b0 || 0) && i < (X.nb || 6);   // the bands this body runs (a tiny body starts at b0)
console.log(`bands: ${G.grBands(R, X.c).filter(inUse).map(b => `${f1(b.Dlo / 1000)}–${f1(b.Dhi / 1000)} km (n ${b.n}, λ ${b.lam.toFixed(2)})`).join(' · ')}`);

// 2. relief, and the share of each unit
const H = U.map(u => X.h(u)), Hs = H.slice().sort((a, b) => a - b), un = U.map(X.unit);
console.log(`relief: map ${f0(M.lo)}…${f0(M.hi)} m; sampled p0.1 ${f0(pct(Hs, .001))}, p50 ${f0(pct(Hs, .5))}, p99.9 ${f0(pct(Hs, .999))}, max ${f0(Hs[Hs.length - 1])} m (recipe top ${f0(B.ground.top)})`);
console.log('units: ' + X.units.map(k => { const i = un.map((x, j) => x === k ? j : -1).filter(j => j >= 0), hh = i.map(j => H[j]).sort((a, b) => a - b);
  return `${k} ${f1(i.length / U.length * 100)} % (median ${i.length ? f0(pct(hh, .5)) : '—'} m)`; }).join(' · '));

// 3. continuity: pairs 0.5 m apart everywhere, and on the cube's face edges
const jump = u => { const e = norm(cross(u, Math.abs(u[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(u, mul(e, 0.5 / R))); return Math.abs(X.h(v) - X.h(u)) / 0.5; };
let worst = 0, worstE = 0;
for (let i = 0; i < 20000; i++) worst = Math.max(worst, jump(U[i]));
for (let i = 0; i < 20000; i++) { const a = 2 * rnd() - 1, ax = i % 3, u = [0, 0, 0]; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = a; worstE = Math.max(worstE, jump(norm(u))); }
console.log(`continuity: steepest 0.5 m step ${f1(Math.atan(worst) / D2R)}° anywhere, ${f1(Math.atan(worstE) / D2R)}° on cube-face edges (a seam would show as a near-vertical step)`);

// 4. crater counts: enumerate the band cells (the finest bands sampled), cumulative N(>D) per km² against c·D⁻²
const area = 4 * Math.PI * (R / 1000) ** 2, bins = [20, 10, 5, 2, 1, .5, .2], cnt = Object.fromEntries(bins.map(d => [d, 0])), s0 = 7001 + X.salt * 16;
const per = {}; for (const k of X.units) per[k] = 0;
for (const c of M.craters) for (const d of bins) if (c.D / 1000 >= d) cnt[d]++;
G.grBands(R, X.c).forEach((b, bi) => { if (!inUse(b, bi)) return; const n = b.n, frac = n > 900 ? 0.02 : 1;
  for (let f = 0; f < 6; f++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (frac < 1 && G.ih3(i, j, f + 99) > frac) continue;
    const key = f * 65536 + i, zz = j * 8 + bi * 131072; if (G.ih3(key, zz, s0) >= b.lam) continue;
    const ax = f >> 1, sg = f & 1 ? -1 : 1, FACE = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]][ax * 2], c = [0, 0, 0];
    c[ax] = sg; c[FACE[1]] = G.ptan(((i + G.ih3(key, zz, s0 + 1)) / n * 2 - 1) * Math.PI / 4); c[FACE[2]] = G.ptan(((j + G.ih3(key, zz, s0 + 2)) / n * 2 - 1) * Math.PI / 4);
    const cu = norm(c); if (G.ih3(key, zz, s0 + 4) < M.thin(cu)) continue;
    const D = 1 / Math.sqrt(1 / b.Dlo ** 2 - G.ih3(key, zz, s0 + 3) * (1 / b.Dlo ** 2 - 1 / b.Dhi ** 2)) / 1000;
    for (const d of bins) if (D >= d) cnt[d] += 1 / frac;
    if (D >= 1) per[X.unit(cu)] += 1 / frac; } });
if (X.c) console.log('craters N(>D) per km², measured / target c·D⁻² (c ' + X.c + ', after thinning: young plains, ice): ' + bins.map(d => `>${d} km ${(cnt[d] / area).toExponential(2)} / ${(X.c / d / d).toExponential(2)}`).join(' · '));
console.log('craters ≥ 1 km per 1,000 km²: ' + X.units.map(k => { const sh = un.filter(x => x === k).length / U.length; return `${k} ${sh ? f1(per[k] / (area * sh) * 1e3) : '—'}`; }).join(' · '));

// 5. slopes by unit, as the lander sees them (terrainSlope: ±15 m), and flat ground; the surface each unit lands as
const sl = Object.fromEntries(X.units.map(k => [k, []])); for (let i = 0; i < 8000; i++) sl[un[i]].push(G.terrainSlope(B, U[i]) / D2R);
for (const k of X.units) { const a = sl[k].sort((x, y) => x - y); if (a.length < 20) { console.log(`slopes on ${k}: ${a.length} samples`); continue; }
  const sh = t => f1(a.filter(x => x > t).length / a.length * 100), su = G.surfaceAt(B, U[un.indexOf(k)]);
  console.log(`slopes on ${k} (${su.name}, μ ${su.mu}): median ${f1(pct(a, .5))}°, p90 ${f1(pct(a, .9))}°, p99 ${f1(pct(a, .99))}°, max ${f1(a[a.length - 1])}° · over 10° ${sh(10)} %, over TOPPLE 24° ${sh(24)} %, under 5° ${f1(a.filter(x => x < 5).length / a.length * 100)} %`); }

// 6. never in the sun (Selene: SUN_DIR is fixed, 6.8° above its equator, and it turns once an orbit, so over a lunar day
// the sun circles each point's sky at a fixed declination). Dark for good if at every hour the ground toward the sun
// stands above the point (marched out to 60 km, curvature included). Sampled south of 70°S.
if (X.dark && !quick) {
  const dec = Math.asin(G.SUN_DIR[1] / Math.hypot(...G.SUN_DIR)), out = [];
  for (const la0 of [-70, -75, -80, -83, -86, -89]) { let dark = 0, n = 0;
    for (let k = 0; k < 120; k++) { const lo = 2 * Math.PI * rnd(), la = (la0 - 2.5 * rnd()) * D2R, u = [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)], h0 = X.h(u) + 2;
      let lit = false; n++;
      for (let hr = 0; hr < 48 && !lit; hr++) { const ha = hr / 48 * 2 * Math.PI, s = [Math.cos(dec) * Math.cos(ha), Math.sin(dec), Math.cos(dec) * Math.sin(ha)];
        const el = Math.asin(dot(s, u)); if (el < -0.02) continue;
        const az = norm(add(s, mul(u, -dot(s, u)))); let blocked = false;
        for (let d = 60; d < 60e3 && !blocked; d *= 1.12) { const a = d / R, p = norm(add(mul(u, Math.cos(a)), mul(az, Math.sin(a)))), ray = h0 + d * Math.tan(el) - d * d / (2 * R);
          if (X.h(p, d > 8e3 ? 2 : d > 2e3 ? 4 : 6) > ray) blocked = true; }
        if (!blocked) lit = true; }
      if (!lit) dark++; }
    out.push(`${la0}°: ${f0(dark / n * 100)} %`); }
  console.log(`never sunlit (2 m above the ground, 120 points per 2.5° band): ${out.join(' · ')}`);
}
