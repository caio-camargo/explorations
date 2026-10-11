// tests/world.mjs — test sections: world (ground). Not a module on its own: shards.mjs splices every file in tests/ (in the
// order of TEST_FILES) between test.mjs's prelude (the SIM as `api`, `check`) and its summary, and runs that as one module.
// Add a section at the end of your lane's file: "// <lane>-<n>. Title" at column 0, then a { block }. NOTES § "Test shards".

// ground-1. The ground of every body (world session, GROUND.md slice G1): a body's `ground` recipe replaces every
// `b === TELLUS` ground test. Neutral today (Tellus as before, the moons smooth spheres), and live: a recipe given to
// Selene reaches contact, landing, slope and the ground normal with no other change. Own SIM copy, so Selene's recipe
// doesn't leak.
{
  const G = new Function(src + 'return {TELLUS,SELENE,NYX,BODIES,GROUND_GEN,bodyH,bodyTop,seaAt,groundAlt,groundR,terrainH,terrainSlope,groundNormal,TERR_TOP,newShip,physStep,fromPF,toPF,surfVel,qFromBasis,qrot,HOOK,DT,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const T = G.TELLUS, Se = G.SELENE, D = Math.PI / 180; G.HOOK.msg = () => {}; G.HOOK.boom = () => {};
  let rs = 7, bad = 0, sea = 0, wet = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const u = norm([rnd() - .5, rnd() - .5, rnd() - .5]), h = G.terrainH(u);
    if (G.groundAlt(T, u) !== Math.max(0, h) || G.seaAt(T, u) !== (h < 0) || G.bodyH(T, u) !== h) bad++; if (h < 0) sea++; }
  for (const b of G.BODIES) if (b !== T && (G.groundAlt(b, [b.R, 0, 0]) !== 0 || G.terrainSlope(b, [0, 1, 0]) !== 0 || G.seaAt(b, [b.R, 0, 0]) || G.bodyTop(b) !== 0)) wet++;
  check('ground-1: neutral: Tellus ground is terrainH clamped at the sea, as before (2,000 points); every other body a smooth sphere',
    bad === 0 && sea > 1000 && wet === 0 && G.bodyTop(T) === G.TERR_TOP && T.ground.sea === 0 && !Se.ground && !G.NYX.ground, `${bad} differ, ${sea} at sea, top ${G.bodyTop(T)} m`);
  // a test recipe on Selene: a 500 m plateau rising to the north at 20° (h = 500 m + tan 20° × the arc north of 1°N)
  const S20 = Math.tan(20 * D), lat = u => Math.asin(Math.max(-1, Math.min(1, norm(u)[1])));
  G.GROUND_GEN.g1test = pf => 500 + Se.R * S20 * Math.max(0, lat(pf) - 1 * D);
  Se.ground = { gen: 'g1test', top: 4e4 };
  const drop = la => { G.t = 0; const s = G.newShip(['chute', 'pod']); G.S = s; s.body = Se; s.landed = false; let last = ''; G.HOOK.msg = m => { last = m; };
    const u = [Math.cos(la * D), Math.sin(la * D), 0]; s.r = G.fromPF(Se, mul(u, Se.R + G.groundAlt(Se, u) - s.yBot + 0.2), 0); const up = norm(s.r), e = norm(cross([0, 1, 0], up));
    s.v = add(G.surfVel(Se, s.r), mul(up, -1)); s.q = G.qFromBasis(e, up, cross(e, up)); s.w = [0, 0, 0]; s.sas = true; s.sasMode = 'stab';
    for (let i = 0; i < 4000 && s.alive && !s.landed; i++) G.physStep(s, G.DT);
    return { s, last, h: len(G.toPF(Se, s.r, G.t)) - Se.R + s.yBot }; };
  const flat = drop(0), u5 = [Math.cos(5 * D), Math.sin(5 * D), 0], slope = G.terrainSlope(Se, u5), nrm = G.groundNormal(Se, G.toPF(Se, G.fromPF(Se, u5, G.t), G.t)),
    tilt = Math.acos(Math.min(1, dot(nrm, norm(G.fromPF(Se, u5, G.t))))) / D;
  check('ground-1: live: a recipe on Selene holds a pod up on its 500 m plateau, and its 20° rise reads as slope and as a tilted normal',
    flat.s.alive && flat.s.landed && Math.abs(flat.h - 500) < 0.5 && Math.abs(slope / D - 20) < 0.5 && Math.abs(tilt - 20) < 0.5,
    `${flat.last || 'not landed'} · rests ${flat.h.toFixed(2)} m above R · slope ${(slope / D).toFixed(2)}° · normal tilted ${tilt.toFixed(2)}°`);
  Se.ground = { gen: 'g1test', top: 4e4, sea: 600 };
  check('ground-1: a recipe\'s liquid level: below it is sea, and the ground there is the liquid\'s surface', G.seaAt(Se, [Se.R, 0, 0]) && G.groundAlt(Se, [Se.R, 0, 0]) === 600 && !G.seaAt(Se, u5));
  delete Se.ground;
}

// ground-2. Selene's ground (world session, GROUND.md slice G2): a baked map (highland swell, big craters, maria flooded
// into the near-side mare mask) plus procedural crater bands on an equiangular cube. Not live in play until the shader
// draws it (G3), so this copy switches it on. Numbers behind each parameter: study_ground.mjs.
{
  const G = new Function(src + 'return {SELENE,SELENE_GROUND,seleneMap,seleneH,grBands,GR_C,geoAt,terrainSlope,groundAlt,bodyTop,ih3,newShip,physStep,fromPF,toPF,surfVel,qFromBasis,qrot,HOOK,DT,get SEL_MAP(){return SEL_MAP},get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const B = G.SELENE, R = B.R, D = Math.PI / 180, lazy = G.SEL_MAP === null; G.HOOK.msg = () => {}; G.HOOK.boom = () => {};
  check('ground-2: Selene\'s recipe is not live in play (no ground until the shader draws it), and its map is baked on first use, not at load',
    !B.ground && lazy && G.groundAlt(B, [R, 0, 0]) === 0);
  B.ground = G.SELENE_GROUND; const M = G.seleneMap(), area = 4 * Math.PI * (R / 1000) ** 2;
  const pts = []; for (let i = 0; i < 4000; i++) { const z = 1 - (2 * i + 1) / 4000, a = i * 2.39996, q = Math.sqrt(1 - z * z); pts.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = pts.map(u => G.seleneH(u)), hmax = Math.max(...H), hmin = Math.min(...H);
  // the band cells: each holds a crater with probability λ (one band enumerated in full); the baked count is GR_C's
  const b2 = G.grBands(R)[2]; let full = 0; for (let f = 0; f < 6; f++) for (let i = 0; i < b2.n; i++) for (let j = 0; j < b2.n; j++) if (G.ih3(f * 65536 + i, j * 8 + 2 * 131072, 7001) < b2.lam) full++;
  const occ = full / (6 * b2.n * b2.n);
  check('ground-2: relief within the recipe\'s bounds; crater counts on target (baked ≥ 20 km = GR_C·area/400; band cells filled at λ)',
    hmax < G.bodyTop(B) && hmin > -5000 && M.craters.length === Math.round(G.GR_C / 400 * area) && Math.abs(occ / b2.lam - 1) < 0.03,
    `${hmin.toFixed(0)}…${hmax.toFixed(0)} m (top ${G.bodyTop(B)}) · ${M.craters.length} baked craters · band ${(b2.Dlo / 1e3).toFixed(1)}–${(b2.Dhi / 1e3).toFixed(1)} km: ${(occ * 100).toFixed(1)} % of cells (λ ${(b2.lam * 100).toFixed(1)} %)`);
  // no seams: the steepest 0.5 m step on the cube's face edges is a crater wall, not a cliff
  let rs = 3, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 3000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(G.seleneH(v) - G.seleneH(n)) / 0.5); }
  check('ground-2: continuous across the crater cells\' cube-face seams (steepest 0.5 m step there under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
  // the units: maria low and smooth, highlands rough; landing spots from the same samples
  const by = { mare: [], high: [] }, ht = { mare: [], high: [] };
  pts.forEach((u, i) => { const k = G.geoAt(B, u).unit; by[k].push({ u, sl: G.terrainSlope(B, u) / D }); ht[k].push(H[i]); });
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], over = (a, t) => a.filter(x => x.sl > t).length / a.length;
  const mS = med(by.mare.map(x => x.sl)), hS = med(by.high.map(x => x.sl)), mH = med(ht.mare), hH = med(ht.high);
  check('ground-2: maria are low, smooth plains; highlands are rough (median slope, share past TOPPLE, median height)',
    mS < hS / 2 && over(by.mare, 24) < over(by.high, 24) && mH < hH - 800 && over(by.high, 24) > .02,
    `slope ${mS.toFixed(1)}° vs ${hS.toFixed(1)}° · past 24°: ${(over(by.mare, 24) * 100).toFixed(1)} % vs ${(over(by.high, 24) * 100).toFixed(1)} % · height ${mH.toFixed(0)} vs ${hH.toFixed(0)} m`);
  // live in the physics: a pod comes to rest on a flat mare spot at the ground's height; on a crater wall it doesn't stay put
  const drop = (u, stack = ['chute', 'pod']) => { G.t = 0; const s = G.newShip(stack); G.S = s; s.body = B; s.landed = false; let last = ''; G.HOOK.msg = m => { last = m; };
    s.r = G.fromPF(B, mul(u, R + G.groundAlt(B, u) - s.yBot + 0.2), 0); const up = norm(s.r), e = norm(cross([0, 1, 0], up));
    s.v = add(G.surfVel(B, s.r), mul(up, -1)); s.q = G.qFromBasis(e, up, cross(e, up)); s.w = [0, 0, 0]; s.sas = true; s.sasMode = 'stab';
    const p0 = G.toPF(B, s.r, 0); for (let i = 0; i < 3000 && s.alive && !s.landed; i++) G.physStep(s, G.DT);
    const pf = G.toPF(B, s.r, G.t); return { s, last, gap: len(pf) - R - G.groundAlt(B, pf) + s.yBot, moved: len(sub(pf, p0)) }; };
  const flat = by.mare.find(x => x.sl < 2 && Math.abs(x.u[1]) < .7), wall = by.high.find(x => x.sl > 32 && x.sl < 40);
  const a = drop(flat.u), w = drop(wall.u);
  check('ground-2: in the physics: a pod rests on a flat mare spot, at the ground\'s height; on a crater wall it slides or tips instead',
    a.s.alive && a.s.landed && Math.abs(a.gap) < 0.3 && !(w.s.landed && w.moved < 1),
    `mare ${flat.sl.toFixed(1)}°: ${a.last} (gap ${a.gap.toFixed(2)} m) · wall ${wall.sl.toFixed(0)}°: ${w.last || (w.s.landed ? 'landed' : 'still sliding')}, moved ${w.moved.toFixed(1)} m`);
  delete B.ground;
}

// ground-3. Enyo's ground (world session, GROUND.md G7), the first planet: on the CPU, not live (no Enyo in the body tree
// yet; the recipe hangs on a stub with SYSTEM.md's radius and gravity). SYSTEM.md's ground brief, feature by feature:
// the dichotomy, the giant shield, the canyon a third of the way round, the polar caps; craters, seams and surfaces as on
// Selene. Numbers behind each parameter: `node study_ground.mjs enyo`.
{
  const G = new Function(src + 'return {ENYO_GROUND,enyoMap,enyoH,GROUND_STUBS,EN,llU,grBands,BODIES,SELENE,surfaceAt,terrainSlope,groundAlt,bodyTop,get ENYO_MAP(){return ENYO_MAP}};')();
  const S = G.GROUND_STUBS.Enyo, R = S.R, B = { name: S.name, R, mu: S.g * R * R, ground: G.ENYO_GROUND }, D = Math.PI / 180;
  check('ground-3: Enyo\'s recipe is not live (no Enyo in the body tree), and its map is baked on first use',
    G.ENYO_MAP === null && !G.BODIES.some(b => b.name === 'Enyo'));
  const M = G.enyoMap(), h = u => G.enyoH(u), area = 4 * Math.PI * (R / 1000) ** 2;
  const pts = []; for (let i = 0; i < 4000; i++) { const z = 1 - (2 * i + 1) / 4000, a = i * 2.39996, q = Math.sqrt(1 - z * z); pts.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = pts.map(h), un = pts.map(G.ENYO_GROUND.unit), share = k => un.filter(x => x === k).length / un.length;
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], hOf = k => med(H.filter((_, i) => un[i] === k));
  const b1 = G.grBands(R, G.EN.c)[1];
  check('ground-3: relief within the recipe\'s top; craters on target (baked ≥ 20 km = c·area/400, c 0.02); band λ scaled by c',
    Math.max(...H) < G.bodyTop(B) && Math.min(...H) > -8000 && M.craters.length === Math.round(G.EN.c / 400 * area) && Math.abs(b1.lam / G.grBands(R)[1].lam - G.EN.c / 0.055) < 1e-6   /* λ is a float32 (G3.0) */,
    `${Math.min(...H).toFixed(0)}…${Math.max(...H).toFixed(0)} m (top ${G.bodyTop(B)}) · ${M.craters.length} baked craters`);
  // the dichotomy: northern lowlands low and smooth, a third or so of the globe
  const sl = k => med(pts.filter((_, i) => un[i] === k).slice(0, 400).map(u => G.terrainSlope(B, u)));
  check('ground-3: the dichotomy: northern lowland plains (30–45 % of Enyo) lie 3+ km below the highlands and are smoother',
    share('lowland plains') > .30 && share('lowland plains') < .45 && hOf('lowland plains') < hOf('highlands') - 3000 && sl('lowland plains') < sl('highlands'),
    `lowlands ${(share('lowland plains') * 100).toFixed(1)} %, median ${hOf('lowland plains').toFixed(0)} m vs highlands ${hOf('highlands').toFixed(0)} m`);
  // the giant shield: its summit rim stands 10+ km above the plains at its foot; the caldera is a pit in it
  const sv = G.llU(...G.EN.shield.at), off = (u, km, az) => { const e = norm(cross([0, 1, 0], u)), n = cross(u, e), d = norm(add(mul(e, Math.cos(az)), mul(n, Math.sin(az)))), a = km * 1e3 / R; return norm(add(mul(u, Math.cos(a)), mul(d, Math.sin(a)))); };
  const rim = Math.max(...[0, 1, 2, 3].map(k => h(off(sv, G.EN.shield.R / 1e3 * .2, k * Math.PI / 2)))), foot = med([0, 1, 2, 3, 4, 5].map(k => h(off(sv, G.EN.shield.R / 1e3 * 1.25, k * 1.05)))), pit = h(sv);
  check('ground-3: the giant shield stands 10+ km above the plains at its foot, with a summit caldera below its rim',
    rim - foot > 10000 && pit < rim - 1000, `rim ${rim.toFixed(0)} m, foot ${foot.toFixed(0)} m, caldera floor ${pit.toFixed(0)} m`);
  // the canyon: along its great circle, 3+ km below the ground 150 km to either side, for over 1,000 km
  const ca = G.llU(...G.EN.canyon.from), ce = norm(cross(ca, [0, 1, 0])), cn = cross(ca, ce);
  let deep = 0; for (let s = 0; s < G.EN.canyon.len; s += 20e3) { const a = s / R, u = norm(add(mul(ca, Math.cos(a)), mul(ce, Math.sin(a)))), side = [-1, 1].map(k => h(norm(add(u, mul(cn, k * 150e3 / R)))));
    if (Math.max(...side) - h(u) > 3000) deep += 20e3; }   // below its higher wall: at its mouth one wall can be the lowlands, as on Mars
  check('ground-3: the canyon: 3+ km below its higher wall for over 1,000 km along its arc (a third of the way round), terraced walls',
    deep > 1.0e6 && share('canyon') > .005, `deep for ${(deep / 1e3).toFixed(0)} km; ${(share('canyon') * 100).toFixed(1)} % of Enyo`);
  // caps and surfaces: the north pole is an ice dome you land on as ice; dunes are sand; Selene keeps its regolith
  const np = [0, 1, 0], su = G.surfaceAt(B, np), dun = pts.find((u, i) => un[i] === 'dunes');
  check('ground-3: the north polar cap is an ice dome (ice to land on); dune fields are sand; a recipe without surfaces keeps regolith',
    su.name === 'water ice' && h(np) > hOf('lowland plains') + 1500 && dun && G.surfaceAt(B, dun).name === 'dune sand' && G.surfaceAt(G.SELENE, [G.SELENE.R, 0, 0]).name === 'regolith',
    `pole ${h(np).toFixed(0)} m on ${su.name}; dunes ${dun ? G.surfaceAt(B, dun).name : '—'}`);
  // no seams on the cube faces
  let rs = 5, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(h(v) - h(n)) / 0.5); }
  check('ground-3: continuous across the crater cells\' cube-face seams (under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
}

// ground-4. Hesper's ground (world session, GROUND.md G7): on the CPU, not live (stub body). Venus's character: craters
// few, fresh and none small (the thick air), mostly smooth basalt plains, raised and rough slab rock, one high massif,
// gentle shields, coronae, narrow lava channels. Numbers behind each parameter: `node study_ground.mjs hesper`.
{
  const G = new Function(src + 'return {HESPER_GROUND,hesperMap,hesperH,hesperChan,GROUND_STUBS,HE,llU,grBands,BODIES,surfaceAt,terrainSlope,bodyTop,get HESPER_MAP(){return HESPER_MAP}};')();
  const S = G.GROUND_STUBS.Hesper, R = S.R, B = { name: S.name, R, mu: S.g * R * R, ground: G.HESPER_GROUND }, D = Math.PI / 180;
  check('ground-4: Hesper\'s recipe is not live (no Hesper in the body tree), and its map is baked on first use', G.HESPER_MAP === null && !G.BODIES.some(b => b.name === 'Hesper'));
  const M = G.hesperMap(), h = u => G.hesperH(u), area = 4 * Math.PI * (R / 1000) ** 2, bs = G.grBands(R, G.HE.c).slice(0, G.HE.bands);
  const pts = []; for (let i = 0; i < 6000; i++) { const z = 1 - (2 * i + 1) / 6000, a = i * 2.39996, q = Math.sqrt(1 - z * z); pts.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = pts.map(h), un = pts.map(G.HESPER_GROUND.unit), share = k => un.filter(x => x === k).length / un.length;
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], at = k => pts.filter((_, i) => un[i] === k), hOf = k => med(H.filter((_, i) => un[i] === k));
  const nBig = Math.round(G.HE.c / 4 * area);   // craters over 2 km expected on the whole planet
  check('ground-4: craters are few and none small: ~' + nBig + ' over 2 km on all of Hesper, the finest band stops at 1.3 km; relief within top',
    nBig > 80 && nBig < 250 && bs[bs.length - 1].Dlo > 1200 && Math.max(...H) < G.bodyTop(B) && M.craters.length <= 3,
    `${nBig} over 2 km · smallest ${(bs[bs.length - 1].Dlo / 1e3).toFixed(1)} km · ${Math.min(...H).toFixed(0)}…${Math.max(...H).toFixed(0)} m (top ${G.bodyTop(B)})`);
  const sl = k => med(at(k).slice(0, 300).map(u => G.terrainSlope(B, u) / D));
  check('ground-4: smooth basalt plains cover most of Hesper; slab rock (~10 %) stands 1.5+ km above them and is rougher',
    share('plains') > .7 && share('slab rock') > .05 && share('slab rock') < .2 && hOf('slab rock') > hOf('plains') + 1500 && sl('slab rock') > 3 * sl('plains'),
    `plains ${(share('plains') * 100).toFixed(1)} % (${sl('plains').toFixed(1)}°), slab rock ${(share('slab rock') * 100).toFixed(1)} % (${sl('slab rock').toFixed(1)}°, ${(hOf('slab rock') - hOf('plains')).toFixed(0)} m higher)`);
  const ma = G.llU(...G.HE.massif.at), shields = G.HE.shields.map(s => { const c = G.llU(s[0], s[1]), e = norm(cross([0, 1, 0], c)), n = cross(c, e), foot = Math.min(...[0, 1, 2, 3, 4, 5].map(k => h(norm(add(c, mul(add(mul(e, Math.cos(k * 1.05)), mul(n, Math.sin(k * 1.05))), 1.3 * s[2] / R)))))); return h(norm(add(c, mul(e, .1 * s[2] / R)))) - foot; });   // the foot: the lowest ground round it
  check('ground-4: the massif rises past 8 km; every shield stands 3+ km above its foot', h(ma) > 8000 && shields.every(x => x > 3000), `massif ${h(ma).toFixed(0)} m; shields ${shields.map(x => x.toFixed(0)).join(', ')} m`);
  const co = G.HE.coronae.map(s => { const c = G.llU(s[0], s[1]), e = norm(cross([0, 1, 0], c)), p = r => h(norm(add(c, mul(e, r * s[2] / R)))); return [p(0), p(.85), p(1.08)]; });
  check('ground-4: coronae are rings: the rim stands above both the centre and the moat outside', co.every(([c, r, o]) => r > c + 300 && r > o + 300), co.map(x => x.map(v => v.toFixed(0)).join('/')).join(' · '));
  // a lava channel: a narrow trough. 3 km out, the ground is higher across it and level along it
  let rs = 9; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647, chs = [];
  for (let i = 0; i < 400000 && chs.length < 5; i++) { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), q = Math.sqrt(1 - z * z), u = [q * Math.cos(t), z, q * Math.sin(t)]; if (G.hesperChan(u, R, M) > .95) chs.push(u); }
  // across a channel (the direction where both sides 3 km out are highest) the floor is 40+ m lower on both sides; along it
  // (at right angles, 1 km out: channels meander, so 3 km along the tangent leaves them) it isn't: a channel, not a pit.
  // The median of five channel points (the plains' wrinkle ridges make any one profile wander)
  const prof = ch => { const e1 = norm(cross([0, 1, 0], ch)), n1 = cross(ch, e1), side = (a, r) => [-1, 1].map(k => h(norm(add(ch, mul(add(mul(e1, Math.cos(a)), mul(n1, Math.sin(a))), k * r / R)))));
    let best = null; for (let k = 0; k < 18; k++) { const a = k * Math.PI / 18, d = Math.min(...side(a, 3e3)) - h(ch); if (!best || d > best.d) best = { a, d }; }
    return { across: best.d, along: Math.min(...side(best.a + Math.PI / 2, 1e3)) - h(ch) }; };
  const P = chs.map(prof), acr = med(P.map(p => p.across)), alg = med(P.map(p => p.along));
  check('ground-4: lava channels are narrow troughs in the plains (3 km across: 40+ m higher on both sides; 1 km along: not; median of 5)',
    chs.length === 5 && acr > 40 && alg < acr / 2 && chs.every(u => G.surfaceAt(B, u).name === 'channel floor'), `across +${acr.toFixed(0)} m, along ${alg.toFixed(0)} m (${chs.length} channel points)`);
  let worst = 0; for (let i = 0; i < 2000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(h(v) - h(n)) / 0.5); }
  check('ground-4: surfaces by unit (basalt plains, slab rock); no seams on the cube faces',
    G.surfaceAt(B, at('plains')[0]).name === 'basalt plains' && G.surfaceAt(B, at('slab rock')[0]).name === 'slab rock' && Math.atan(worst) / D < 60, `steepest seam step ${(Math.atan(worst) / D).toFixed(1)}°`);
}

// ground-5. Astraea's ground (world session, GROUND.md G7): Ceres's character on a 94 km body with g 0.28, on the CPU,
// not live (stub body). Its weak icy crust turns craters complex at 12.5 km and keeps the big ones shallow; one young
// bright crater with salt on its floor; one lonely mountain. Numbers behind each parameter: `node study_ground.mjs astraea`.
{
  const G = new Function(src + 'return {ASTRAEA_GROUND,astraeaMap,astraeaH,GROUND_STUBS,AS,llU,BODIES,surfaceAt,terrainSlope,bodyTop,get ASTRAEA_MAP(){return ASTRAEA_MAP}};')();
  const S = G.GROUND_STUBS.Astraea, R = S.R, B = { name: S.name, R, mu: S.g * R * R, ground: G.ASTRAEA_GROUND }, D = Math.PI / 180;
  check('ground-5: Astraea\'s recipe is not live (no Astraea in the body tree), and its map is baked on first use', G.ASTRAEA_MAP === null && !G.BODIES.some(b => b.name === 'Astraea'));
  const M = G.astraeaMap(), h = u => G.astraeaH(u), area = 4 * Math.PI * (R / 1000) ** 2;
  const pts = []; for (let i = 0; i < 3000; i++) { const z = 1 - (2 * i + 1) / 3000, a = i * 2.39996, q = Math.sqrt(1 - z * z); pts.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = pts.map(h), at = (c, km, az) => { const e = norm(cross([0, 1, 0], c)), n = cross(c, e), d = norm(add(mul(e, Math.cos(az)), mul(n, Math.sin(az)))), a = km * 1e3 / R; return norm(add(mul(c, Math.cos(a)), mul(d, Math.sin(a)))); };
  // the biggest crater: relaxed shallow (the complex depth law above the crust's 12.5 km), not a 20 km-deep bowl
  const big = M.craters.slice().sort((a, b) => b.D - a.D)[0], bigDepth = Math.min(...[0, 1, 2, 3].map(k => h(at(big.c, big.D / 2e3, k * Math.PI / 2)))) - h(big.c);
  check('ground-5: craters on target (baked ≥ 20 km = c·area/400); the crust turns them complex at ~12.5 km and keeps the biggest shallow; relief within top',
    M.craters.length === Math.round(G.AS.c / 400 * area) && M.Dt > 12e3 && M.Dt < 13e3 && bigDepth > 300 && bigDepth < 5000 && Math.max(...H) < G.bodyTop(B),
    `${M.craters.length} baked craters; transition ${(M.Dt / 1e3).toFixed(1)} km; the biggest (${(big.D / 1e3).toFixed(0)} km) ${bigDepth.toFixed(0)} m deep; ${Math.min(...H).toFixed(0)}…${Math.max(...H).toFixed(0)} m`);
  // Ahuna Mons: 3.5+ km above the ground around it, flanks steep but standing (25–45°), a flat-ish top
  const ah = G.llU(...G.AS.ahuna.at), foot = Math.min(...[0, 1, 2, 3, 4, 5].map(k => h(at(ah, 15, k * 1.05)))), fl = Math.max(...[0, 1, 2, 3].map(k => G.terrainSlope(B, at(ah, 6, k * Math.PI / 2)) / D)), top = G.terrainSlope(B, ah) / D;
  check('ground-5: the lonely mountain stands 3.5+ km above its surroundings, its flanks 25–45°, its top flat-ish', h(ah) - foot > 3500 && fl > 25 && fl < 45 && top < 10,
    `summit ${(h(ah) - foot).toFixed(0)} m above its foot; steepest flank ${fl.toFixed(0)}°; top ${top.toFixed(1)}°`);
  // the bright crater: its rim 1.5+ km above its floor, a central pit, salt on the floor (and dark regolith outside)
  const oc = G.llU(...G.AS.occ.at), oR = G.AS.occ.D / 2e3, rim = Math.max(...[0, 1, 2, 3].map(k => h(at(oc, oR, k * Math.PI / 2)))), floor = h(at(oc, oR * .45, 1)), pit = h(oc);
  const salt = [0, 1, 2, 3, 4, 5, 6, 7].map(k => G.surfaceAt(B, at(oc, oR * .2, k * Math.PI / 4)).name).filter(n => n === 'salt deposits').length;
  check('ground-5: the young bright crater: rim 1.5+ km above its floor, a central pit, salt deposits on the floor, dark regolith outside',
    rim - floor > 1500 && pit < floor - 200 && salt >= 3 && G.surfaceAt(B, at(oc, oR * 2.5, 0)).name === 'dark regolith',
    `rim ${(rim - floor).toFixed(0)} m above the floor; pit ${(floor - pit).toFixed(0)} m deeper; salt at ${salt}/8 points on the inner floor`);
  let rs = 11, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(h(v) - h(n)) / 0.5); }
  check('ground-5: continuous across the crater cells\' cube-face seams (under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
}

// ground-6. Hyperion's moons (world session, GROUND.md G7), on the CPU, not live (stub bodies): Theia (Io: no craters,
// paterae, tilted mountains), Eos (Europa + Enceladus: flat ridged ice, chaos, the tiger stripes), Tethys (Titan: methane
// lakes you splash into, linear dunes, a rugged highland), Phoebe (a cratered lump). And every body's poles, Tellus's too:
// the equirectangular maps' polar rows used to make near-vertical steps there (polesFix). `node study_ground.mjs <moon>`.
{
  const G = new Function(src + 'return {GROUND_GEN,GROUND_STUBS,THEIA_GROUND,theiaMap,theiaH,EOS_GROUND,eosMap,eosH,worleyEdge,eosStripe,EO,TETHYS_GROUND,tethysMap,tethysH,TT,PHOEBE_GROUND,phoebeMap,phoebeH,BODIES,TELLUS,SELENE,terrainH,surfaceAt,terrainSlope,seaAt,groundAlt,bodyTop,get THEIA_MAP(){return THEIA_MAP},get EOS_MAP(){return EOS_MAP},get TETHYS_MAP(){return TETHYS_MAP},get PHOEBE_MAP(){return PHOEBE_MAP}};')();
  const D = Math.PI / 180, body = (n, g) => { const S = G.GROUND_STUBS[n]; return { name: n, R: S.R, mu: S.g * S.R * S.R, ground: g }; };
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], fib = n => { const o = []; for (let i = 0; i < n; i++) { const z = 1 - (2 * i + 1) / n, a = i * 2.39996, q = Math.sqrt(1 - z * z); o.push([q * Math.cos(a), z, q * Math.sin(a)]); } return o; };
  const at = (c, R, m, az) => { const e = norm(cross(Math.abs(c[1]) < .9 ? [0, 1, 0] : [1, 0, 0], c)), n = cross(c, e), d = norm(add(mul(e, Math.cos(az)), mul(n, Math.sin(az)))), a = m / R; return norm(add(mul(c, Math.cos(a)), mul(d, Math.sin(a)))); };
  check('ground-6: none of Hyperion\'s moons is live (not in the body tree), and no map is baked before first use',
    ['Theia', 'Eos', 'Tethys', 'Phoebe'].every(n => !G.BODIES.some(b => b.name === n)) && !G.THEIA_MAP && !G.EOS_MAP && !G.TETHYS_MAP && !G.PHOEBE_MAP);
  // Theia: no craters at all; paterae are flat-floored pits with steep walls and fresh lava; tilted blocks stand 4+ km
  { const Rt = G.GROUND_STUBS.Theia.R, Bt = body('Theia', G.THEIA_GROUND), M = G.theiaMap(), h = u => G.theiaH(u);
    const pit = M.paterae.map(p => Math.max(...[0, 1, 2, 3, 4, 5].map(k => h(at(p.c, Rt, p.R * 1.25, k * 1.05)))) - h(p.c)), lava = M.paterae.filter(p => G.surfaceAt(Bt, p.c).name === 'fresh lava').length;
    const tall = Math.max(...M.mtns.map(t => h(t.c) - Math.min(...[0, 1, 2, 3, 4, 5].map(k => h(at(t.c, Rt, t.R * 1.4, k * 1.05))))));
    check('ground-6: Theia: no impact craters; paterae sink 400+ m below their rims (median) with fresh lava floors; its mountains rise 4+ km',
      M.craters.length === 0 && med(pit) > 400 && lava >= M.paterae.length * .8 && tall > 4000, `${M.paterae.length} paterae, median ${med(pit).toFixed(0)} m deep, ${lava} on fresh lava; tallest mountain ${tall.toFixed(0)} m`); }
  // Eos: flat (relief under 1 km); the ridges are double (crests 600 m either side of a lower centre line); chaos rougher;
  // the tiger stripes: rifts 400+ m deep near the south pole, frosted
  { const Re = G.GROUND_STUBS.Eos.R, Be = body('Eos', G.EOS_GROUND), h = u => G.eosH(u), P = fib(3000), H = P.map(h), L = G.EO.ridge[0][0];
    const bin = { edge: [], crest: [] }; let rs = 3; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 60000; i++) { const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), q = Math.sqrt(1 - z * z), u = [q * Math.cos(t), z, q * Math.sin(t)], d = G.worleyEdge(u[0] * Re / L, u[1] * Re / L, u[2] * Re / L) * L;
      if (d < 100) bin.edge.push(h(u)); else if (Math.abs(d - G.EO.dr.w) < 100) bin.crest.push(h(u)); }
    const un = P.map(G.EOS_GROUND.unit), sl = k => P.filter((_, i) => un[i] === k).slice(0, 300).map(u => G.terrainSlope(Be, u) / D).sort((a, b) => a - b), p90 = a => a[Math.floor(a.length * .9)];
    const s0 = norm([G.EO.stripes.gap * .5 / Re, -1, 0]), sDepth = Math.min(h(at(s0, Re, 3e3, Math.PI / 2)), h(at(s0, Re, 3e3, -Math.PI / 2))) - h(s0);   // across the stripe (x); az 0 here runs along it
    check('ground-6: Eos: flat ice (relief under 1 km); double ridges (crests above their centre lines); chaos rougher than ridged ice; tiger stripes 400+ m deep, frosted',
      Math.max(...H) - Math.min(...H) < 1000 && med(bin.crest) > med(bin.edge) + 100 && p90(sl('chaos')) > p90(sl('ridged ice')) && sDepth > 400 && G.surfaceAt(Be, s0).name === 'fresh plume frost',
      `relief ${(Math.max(...H) - Math.min(...H)).toFixed(0)} m; crests ${(med(bin.crest) - med(bin.edge)).toFixed(0)} m above the centre line; p90 slope chaos ${p90(sl('chaos')).toFixed(1)}° vs ${p90(sl('ridged ice')).toFixed(1)}°; stripe ${sDepth.toFixed(0)} m deep`); }
  // Tethys: methane lakes (a liquid level: seaAt, the ground is the surface), mostly north; linear dunes run east–west
  { const Rh = G.GROUND_STUBS.Tethys.R, Bh = body('Tethys', G.TETHYS_GROUND), h = u => G.tethysH(u), P = fib(4000), un = P.map(G.TETHYS_GROUND.unit);
    const lakes = P.filter((_, i) => un[i] === 'lake'), north = lakes.filter(u => u[1] > 0).length, lk = lakes.find(u => u[1] > .8);
    const dn = P.filter((_, i) => un[i] === 'dunes'), rng2 = (u, az) => { const v = [-1000, -500, 0, 500, 1000].map(m => h(at(u, Rh, m, az))); return Math.max(...v) - Math.min(...v); };
    const ns = med(dn.slice(0, 60).map(u => rng2(u, Math.PI / 2))), ew = med(dn.slice(0, 60).map(u => rng2(u, 0)));   // az 0 is east, π/2 north
    check('ground-6: Tethys: methane lakes (2–8 %, mostly north) are a liquid you splash into; linear dunes in the equatorial belt run east–west',
      lakes.length / P.length > .02 && lakes.length / P.length < .08 && north > lakes.length * .6 && !!lk && G.seaAt(Bh, lk) && G.groundAlt(Bh, lk) === 0 && dn.every(u => Math.abs(u[1]) < .55) && ns > 2 * ew && ns > 50,
      `lakes ${(lakes.length / P.length * 100).toFixed(1)} % (${north} of ${lakes.length} north); dunes: ${ns.toFixed(0)} m relief over 2 km north–south vs ${ew.toFixed(0)} m east–west`); }
  // Phoebe: a lump (its outline not round), saturated with craters (30+ % of its ground over 10°)
  { const Rp = G.GROUND_STUBS.Phoebe.R, Bp = body('Phoebe', G.PHOEBE_GROUND), h = u => G.phoebeH(u), P = fib(2000), H = P.map(h), steep = P.slice(0, 600).filter(u => G.terrainSlope(Bp, u) > 10 * D).length / 600;
    check('ground-6: Phoebe: a lump (relief over 12 % of its radius) saturated with craters (30+ % of it over 10°), landing on regolith',
      (Math.max(...H) - Math.min(...H)) / Rp > .12 && steep > .3 && G.surfaceAt(Bp, P[0]).name === 'regolith', `relief ${((Math.max(...H) - Math.min(...H)) / Rp * 100).toFixed(0)} % of R; ${(steep * 100).toFixed(0)} % over 10°`); }
  // every body's poles: no step (the polar rows of the equirectangular maps); Tellus is live, so this one matters in play
  { const bodies = [['Tellus', G.TELLUS.R, u => G.terrainH(u)], ['Selene', G.SELENE.R, u => G.GROUND_GEN.selene(u)], ...['Enyo', 'Hesper', 'Astraea', 'Theia', 'Eos', 'Tethys', 'Phoebe', 'Erebus'].map(n => [n, G.GROUND_STUBS[n].R, u => G.GROUND_GEN[n.toLowerCase()](u)])];
    const worst = bodies.map(([n, R, f]) => { let w = 0; for (const sg of [1, -1]) for (let i = 0; i < 400; i++) { const a = i * 2.39996, r = (i % 40) / 40 * 2e3 / R, u = norm([Math.sin(r) * Math.cos(a), sg * Math.cos(r), Math.sin(r) * Math.sin(a)]), v = norm(add(u, mul(norm(cross(u, [1, 0, 0])), .5 / R))); w = Math.max(w, Math.abs(f(v) - f(u)) / .5); } return [n, Math.atan(w) / D]; });
    check('ground-6: no step at any body\'s poles, Tellus\'s included (steepest 0.5 m step within 2 km of a pole under 60°)', worst.every(([, d]) => d < 60), worst.map(([n, d]) => `${n} ${d.toFixed(0)}°`).join(' · ')); }
}

// ground-7. Erebus's ground (world session, GROUND.md G7), the last hand-made body: Pluto's character on the CPU, not
// live (stub body). The nitrogen-ice basin (flat, crater-free, broken into convection cells), the water-ice mountains on
// its margin, the dark tholin highlands (the most cratered), bladed terrain. `node study_ground.mjs erebus`.
{
  const G = new Function(src + 'return {EREBUS_GROUND,erebusMap,erebusH,worleyEdge,ER,GROUND_STUBS,llU,BODIES,surfaceAt,terrainSlope,bodyTop,get EREBUS_MAP(){return EREBUS_MAP}};')();
  const S = G.GROUND_STUBS.Erebus, R = S.R, B = { name: S.name, R, mu: S.g * R * R, ground: G.EREBUS_GROUND }, D = Math.PI / 180, h = u => G.erebusH(u);
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)], at = (c, m, az) => { const e = norm(cross([0, 1, 0], c)), n = cross(c, e), d = norm(add(mul(e, Math.cos(az)), mul(n, Math.sin(az)))), a = m / R; return norm(add(mul(c, Math.cos(a)), mul(d, Math.sin(a)))); };
  check('ground-7: Erebus\'s recipe is not live (no Erebus in the body tree), and its map is baked on first use', G.EREBUS_MAP === null && !G.BODIES.some(b => b.name === 'Erebus'));
  const M = G.erebusMap(), P = []; for (let i = 0; i < 4000; i++) { const z = 1 - (2 * i + 1) / 4000, a = i * 2.39996, q = Math.sqrt(1 - z * z); P.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const H = P.map(h), un = P.map(G.EREBUS_GROUND.unit), of = k => P.filter((_, i) => un[i] === k), sl = k => of(k).slice(0, 300).map(u => G.terrainSlope(B, u) / D).sort((a, b) => a - b);
  const bc = G.llU(...G.ER.basin.at), rim = med([0, 1, 2, 3, 4, 5].map(k => h(at(bc, G.ER.basin.r * R * 1.3, k * 1.05)))), ni = sl('nitrogen ice');
  check('ground-7: the nitrogen-ice basin: 2+ km below the land round it, its floor flat (median under 1°, p99 under 10°), relief within top',
    rim - h(bc) > 2000 && med(ni) < 1 && ni[Math.floor(ni.length * .99)] < 10 && Math.max(...H) < G.bodyTop(B) && G.surfaceAt(B, bc).name === 'nitrogen ice',
    `basin ${(rim - h(bc)).toFixed(0)} m below the land round it; floor slope median ${med(ni).toFixed(1)}°, p99 ${ni[Math.floor(ni.length * .99)].toFixed(1)}°; max ${Math.max(...H).toFixed(0)} m (top ${G.bodyTop(B)})`);
  // convection cells: on the floor, the troughs along the cell edges lie lower than the cells' middles
  const L = G.ER.cells.L, edge = [], mid = []; for (let i = 0; i < 4000; i++) { const u = at(bc, (i % 63) / 63 * .8 * G.ER.basin.r * R, i * 2.39996), d = G.worleyEdge(u[0] * R / L + 3, u[1] * R / L + 3, u[2] * R / L + 3) * L; if (d < 300) edge.push(h(u)); else if (d > 5e3) mid.push(h(u)); }
  check('ground-7: the basin floor is broken into convection cells: troughs along their edges 50+ m below their middles', med(mid) - med(edge) > 50, `${(med(mid) - med(edge)).toFixed(0)} m (${edge.length} trough points, ${mid.length} mid-cell)`);
  const tall = Math.max(...M.mtns.map(t => h(t.c) - Math.min(...[0, 1, 2, 3, 4, 5].map(k => h(at(t.c, t.R * 1.4, k * 1.05)))))), mtS = sl('mountains');
  check('ground-7: water-ice mountains on the basin\'s margin: 2.5+ km above their foot, steep (p90 over 30°), on bedrock',
    tall > 2500 && mtS[Math.floor(mtS.length * .9)] > 30 && G.surfaceAt(B, M.mtns[0].c).name === 'water-ice bedrock', `tallest ${tall.toFixed(0)} m; p90 flank ${mtS[Math.floor(mtS.length * .9)].toFixed(0)}°`);
  // the tholin highlands keep all their craters (old crust); the uplands lose half, the basin all
  const th = of('tholin highlands'), up = of('uplands'), p90 = a => a[Math.floor(a.length * .9)];
  check('ground-7: the dark tholin highlands are the most cratered (no thinning there, half on the uplands, all on the ice) and rougher than the uplands',
    th.length > 50 && med(th.map(M.thin)) < .05 && Math.abs(med(up.map(M.thin)) - .5) < .05 && M.thin(bc) > .95 && p90(sl('tholin highlands')) > p90(sl('uplands')) && G.surfaceAt(B, th[0]).name === 'dark tholin dust',
    `thinning: tholin ${med(th.map(M.thin)).toFixed(2)}, uplands ${med(up.map(M.thin)).toFixed(2)}, ice ${M.thin(bc).toFixed(2)}; p90 slope ${p90(sl('tholin highlands')).toFixed(1)}° vs ${p90(sl('uplands')).toFixed(1)}°`);
  let rs = 13, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const n = norm(u);
    const e = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(n, mul(e, 0.5 / R))); worst = Math.max(worst, Math.abs(h(v) - h(n)) / 0.5); }
  check('ground-7: continuous across the crater cells\' cube-face seams (under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
}

// ground-8. The seeded small bodies (world session, GROUND.md G7): a recipe factory, smallBodyGround({kind, R, seed}), for
// the classes SYSTEM.md seeds per world. None exists in the game yet, so the checks drive recipes directly, and through a
// stand-in body to show they work as any body's `ground`. `node study_ground.mjs small:<kind>:<R>:<seed>`.
{
  const G = new Function(src + 'return {smallBodyGround,smallH,smallShape,smallMap,smallBoulders,smallPit,SB_KINDS,SB_CLASSES,SB_G,groundAlt,surfaceAt,bodyTop};')();
  const D = Math.PI / 180, P = []; for (let i = 0; i < 1500; i++) { const z = 1 - (2 * i + 1) / 1500, a = i * 2.39996, q = Math.sqrt(1 - z * z); P.push([q * Math.cos(a), z, q * Math.sin(a)]); }
  const mk = (kind, R, seed) => G.smallBodyGround({ kind, R, seed }), body = rc => ({ name: 'rock', R: rc.R, mu: rc.g * rc.R * rc.R, ground: rc });
  // the same seed makes the same rock; another seed another; gravity from density
  const a1 = mk('stony', 5000, 11), a2 = mk('stony', 5000, 11), a3 = mk('stony', 5000, 12);
  check('ground-8: a seed makes the same rock every time and another seed another; gravity is G·(4/3)πρR; every class draws from known kinds',
    P.slice(0, 200).every(u => G.smallH(u, a1) === G.smallH(u, a2)) && a1.ax.join() !== a3.ax.join() && Math.abs(a1.g - G.SB_G * 4 / 3 * Math.PI * 2000 * 5000) < 1e-12 && Object.values(G.SB_CLASSES).flat().every(k => G.SB_KINDS[k]),
    `axes ${a1.ax.map(x => (x / 1e3).toFixed(2)).join('×')} km vs ${a3.ax.map(x => (x / 1e3).toFixed(2)).join('×')} km; g ${a1.g.toExponential(2)} m/s²`);
  // every kind, a few sizes and seeds: finite, within its own bound, and usable as a body's ground (groundAlt, surfaceAt)
  let bad = [], n = 0; for (const kind of Object.keys(G.SB_KINDS)) for (const [R, seed] of [[200, 1], [2000, 2], [20000, 3]]) { const rc = mk(kind, R, seed), B = body(rc);
    for (const u of P.slice(0, 400)) { const h = G.smallH(u, rc); n++; if (!Number.isFinite(h)) bad.push(`${kind} ${R} m: not finite`); else if (h > G.bodyTop(B)) bad.push(`${kind} ${R} m: over top`); else if (Math.abs(G.groundAlt(B, mul(u, R)) - h) > 1e-6 * R) bad.push(`${kind} ${R} m: groundAlt differs`); }
    if (G.surfaceAt(B, [R, 0, 0]).name !== G.SB_KINDS[kind].surf.name) bad.push(`${kind} surface`); }
  check('ground-8: every kind at 0.2, 2 and 20 km: heights finite and under the recipe\'s top, the same through groundAlt, its own surface', !bad.length, bad.length ? [...new Set(bad)].join(', ') : `${n} heights`);
  // shapes: a visitor is a needle (4:1 or more); some comets are contact binaries with a waist; rubble piles have a ridge
  const vis = mk('visitor', 200, 7), vr = P.map(u => G.smallShape(u, vis)), bi = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => mk('comet', 2000, s)).find(c => c.lobes);
  const waist = bi && G.smallShape([0, 1, 0], bi) < .85 * Math.max(G.smallShape([1, 0, 0], bi), G.smallShape([-1, 0, 0], bi));
  const rb = mk('rubble', 500, 4), noShape = u => G.smallH(u, rb) - (G.smallShape(u, rb) - 500), eq = P.filter(u => Math.abs(u[1]) < .05).map(noShape), mid = P.filter(u => Math.abs(Math.abs(u[1]) - .5) < .1).map(noShape), avg = a => a.reduce((s, x) => s + x, 0) / a.length;   // noShape: the ridge itself, not the flattened shape
  check('ground-8: shapes: a visitor is a needle (4:1+), some comets are contact binaries with a waist, rubble piles a spinning-top ridge',
    Math.max(...vr) / Math.min(...vr) > 4 && !!bi && waist && avg(eq) - avg(mid) > .02 * 500,
    `visitor ${(Math.max(...vr) / Math.min(...vr)).toFixed(1)}:1; comet seed ${bi ? bi.seed : '—'} bilobe, waist ${waist}; ridge +${(avg(eq) - avg(mid)).toFixed(0)} m on a 500 m rubble pile`);
  // surface features: rubble piles are covered in boulders; comets have pits; a visitor has neither, nor craters
  const bShare = P.filter(u => G.smallBoulders(u, 500, rb) > .5).length / P.length, cm = mk('comet', 2000, 6), pits = P.filter(u => G.smallPit(u, 2000, cm) < -.1 * cm.pL).length;
  check('ground-8: rubble piles are strewn with boulders (5+ % of the ground under one); comets have steep pits; a visitor has no craters, boulders or pits',
    bShare > .05 && pits > 3 && G.smallMap(vis).craters.length === 0 && !G.SB_KINDS.visitor.boulders && !G.SB_KINDS.visitor.pits, `boulders on ${(bShare * 100).toFixed(1)} % of the rubble pile; ${pits} comet points in pits`);
  // boulders and pits are steep by design but continuous: every feature that touches a point is among its 27 neighbouring
  // cells, so searching 125 finds nothing more (a feature the 27 missed would appear from one point and not the next)
  let missB = 0, missP = 0, r3 = 7; const rn3 = () => (r3 = (r3 * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 20000; i++) { const z = 2 * rn3() - 1, t = 2 * Math.PI * rn3(), q = Math.sqrt(1 - z * z), u = [q * Math.cos(t), z, q * Math.sin(t)];
    if (G.smallBoulders(u, 500, rb) !== G.smallBoulders(u, 500, rb, 2)) missB++; if (G.smallPit(u, 2000, cm) !== G.smallPit(u, 2000, cm, 2)) missP++; }
  check('ground-8: boulders and pits are continuous: at 20,000 points the 27 neighbouring cells find every feature 125 do', !missB && !missP, `missed: boulders ${missB}, pits ${missP}`);
  // the crater bands across the cube-face seams (boulders and pits are steep by design, so they're left out here)
  const st = mk('stony', 20000, 5), cr = u => G.smallH(u, st) - G.smallBoulders(u, 20000, st); let rs = 17, worst = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1500; i++) { const u = [0, 0, 0], ax = i % 3; u[ax] = rnd() < .5 ? 1 : -1; u[(ax + 1) % 3] = u[ax] * (rnd() < .5 ? 1 : -1); u[(ax + 2) % 3] = 2 * rnd() - 1; const nn = norm(u);
    const e = norm(cross(nn, Math.abs(nn[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = norm(add(nn, mul(e, 0.5 / 20000))); worst = Math.max(worst, Math.abs(cr(v) - cr(nn)) / 0.5); }
  check('ground-8: a 20 km stony body\'s craters are continuous across the cube-face seams (under 60°)', Math.atan(worst) / D < 60, `${(Math.atan(worst) / D).toFixed(1)}°`);
}

// ground-9. G3.0 (world session, QUEUE Q107; GROUND.md § G3): the crater cells' trigonometry goes through approximations
// the shader will copy exactly (GLSL's tan/atan are only good to ~1e-5 rad: 3.5 m on Selene). The bands must not call the
// built-ins again, and the approximations must stay as good as measured.
{
  const G = new Function(src + 'return {ptan,patanJ,craterBands,grBands};')();
  let et = 0, ea = 0; for (let i = 0; i <= 20000; i++) { const x = (i / 20000 * 2 - 1) * Math.PI / 4, y = Math.tan(x) * 1.3; et = Math.max(et, Math.abs(G.ptan(x) - Math.tan(x))); ea = Math.max(ea, Math.abs(G.patanJ(y, 1) - Math.atan(y))); }
  const srcB = G.craterBands.toString(), lam = G.grBands(3.48e5)[2].lam;
  check('ground-9: crater cells use ptan (≤1e-12) and patanJ (≤5e-8 rad), not Math.tan/atan; λ is a float32',
    et < 1e-12 && ea < 5e-8 && !/Math\.(tan|atan)\(/.test(srcB) && lam === Math.fround(lam), `ptan ${et.toExponential(1)}, patanJ ${ea.toExponential(1)} rad`);
}

// sea-1. The sea is a fluid (world session, QUEUE Q274, PLAYTEST #74; NOTES § v1.118): a splashdown floats on its own
// buoyancy (study_sea.mjs drops every preset). The Orbiter's returning piece, dropped upright with SAS off, settles on
// its side, partly dry; a capsule with flotation bags floats upright; a piece too dense sinks at once. Afloat, it heaves on
// the swell, drifts, and sinks when its parts have flooded; the recovery ships must get there first. Own SIM copy.
{
  const G = new Function(src + 'return {PRESETS,TELLUS,newShip,detach,geom,physStep,seaAt,seaPts,siteFrame,surfVel,qFromBasis,HOOK,recoveryOf,syncLanded,setT:t=>{simT=t},getT:()=>simT,DT};')();
  const T = G.TELLUS; G.HOOK.msg = () => {}; G.HOOK.boom = () => {}; G.HOOK.rebuild = () => {}; G.HOOK.debris = () => {};
  let u = null; for (let a = 0; a < 6.28 && !u; a += 0.01) { const c = norm([Math.cos(a), 0.05, Math.sin(a)]); if (G.seaAt(T, mul(c, T.R)) && G.seaAt(T, mul(norm(add(c, [0.003, 0, 0.003])), T.R)) && G.seaAt(T, mul(norm(add(c, [-0.003, 0, -0.003])), T.R))) u = c; }
  const drop = (st, heavy) => { G.setT(0); const s = G.newShip(st);
    const dec = s.parts.filter(p => p.on && p.d.kind === 'dec' && !p.pos[0] && !p.pos[2]).sort((a, b) => b.y0 - a.y0)[0];
    if (dec) G.detach(s, s.parts.filter(p => p.on && p.y0 <= dec.y0 + 1e-6), [0, 0, 0], 0);
    for (const p of s.parts) if (p.on && p.res.fuel != null) p.res.fuel = heavy && p.d.kind === 'tank' ? 50 : 0; G.geom(s);
    const f = G.siteFrame(u); s.landed = false; s.chute = false; s.sas = false; s.q = G.qFromBasis(norm(cross(f.up, f.n)), f.up, f.n);
    s.r = mul(u, T.R - s.yBot + 2); s.v = add(G.surfVel(T, s.r), mul(f.up, -7)); s.w = [0, T.rot, 0];
    let t = 0; for (; t < 120 && s.alive && !s.landed; t += G.DT) G.physStep(s, G.DT); return { s, t }; };
  const o = drop(G.PRESETS.Orbiter), F = o.s.float, c = drop(['chute', 'crew', 'shield']), h = drop(G.PRESETS.Hopper, true);
  check('sea-1: the Orbiter\'s capsule and stage float on their side, 30–90 % dry; a crew capsule with its bags upright; a piece too dense sinks',
    o.s.landed && o.s.water && F && F.tilt > 1.2 && F.dry > .3 && F.dry < .9 && c.s.landed && c.s.float.tilt < .2 && !h.s.alive && h.s.sunk && h.t < 5,
    `Orbiter afloat after ${o.t.toFixed(1)} s at ${(F.tilt * 57.3).toFixed(0)}°, ${(F.dry * 100).toFixed(0)} % dry; crew capsule ${(c.s.float.tilt * 57.3).toFixed(0)}°; overweight Hopper sank after ${h.t.toFixed(1)} s`);
  // afloat: heave within the swell, a drift of ~0.25 m/s, and the sinking at sinkAt
  const s = o.s, r0 = len(s.pf); let lo = Infinity, hi = -Infinity;
  for (let t = 30; t <= 90; t += 0.5) { G.setT(F.t + t); G.syncLanded(s); lo = Math.min(lo, len(s.pf) - r0); hi = Math.max(hi, len(s.pf) - r0); }
  const drift = Math.acos(Math.min(1, dot(norm(s.pf), norm(F.pf)))) * T.R / (G.getT() - F.t);
  const at = k => ({ launchPf: mul(norm(add(norm(s.pf), [0, k, 0])), T.R) }), sailNear = G.recoveryOf(s, at(0.04)), leak = { ...F };
  s.float = { ...F, sinkAt: F.t + 3600 }; const sailLate = G.recoveryOf(s, at(0.04)); s.float = leak;   // a hull that floods in an hour, 50 km out
  G.setT(F.sinkAt + 1); G.syncLanded(s);
  check('sea-1: afloat it heaves 0.8–2 m peak to peak on the swell and drifts ~0.25 m/s; it sinks when flooded; ships that arrive after that find nothing',
    hi - lo > 0.8 && hi - lo < 2 && drift > 0.2 && drift < 0.3 && !s.alive && s.sunk && sailNear.kind === 'sea' && sailNear.factor === 1 && sailLate.kind === 'sank' && sailLate.factor === 0,
    `heave ${(hi - lo).toFixed(2)} m peak to peak, drift ${drift.toFixed(2)} m/s, sinks ${((F.sinkAt - F.t) / 3600).toFixed(0)} h in; ${sailNear.why}; a leaky one ${sailLate.why}`);
}
