// tests/look.mjs — test sections: look & sound (aerofx, sound). Not a module on its own: shards.mjs splices every file in tests/ (in the
// order of TEST_FILES) between test.mjs's prelude (the SIM as `api`, `check`) and its summary, and runs that as one module.
// Add a section at the end of your lane's file: "// <lane>-<n>. Title" at column 0, then a { block }. NOTES § "Test shards".

// sound-1. Sound (sound session; open thread 7). The pure mix block (flight state → layer levels) behaves physically,
// and an Orbiter ascent flown on the SIM gives a launch that is loudest on the pad, roars through max-q, buffets at
// Mach 1 and goes quiet but for the structure in vacuum. Also: F4 is in Help, and the page wires sndTick into frame().
{
  const H = html.replace(/\r\n/g, '\n'), blk = H.slice(H.indexOf('// ==== SOUND MIX BEGIN'), H.indexOf('// ==== SOUND MIX END'));
  const { sndMix, sndBoom } = new Function(blk + ';return {sndMix,sndBoom}')();
  const pad = sndMix({ T: 4e6, pr: 1, M: 0, q: 0, agl: 0 }), up = sndMix({ T: 4e6, pr: 1, M: 0.3, q: 5e3, agl: 2000 }),
    thin = sndMix({ T: 4e6, pr: 0.05, M: 3, q: 8e3, agl: 3e4 }), vac = sndMix({ T: 4e6, pr: 0, M: 0, q: 0 }), off = sndMix({ T: 0, pr: 1 });
  check('sound mix: the pad is loudest (ground reflection); thin air is quieter and darker; vacuum leaves only the structure; no engines, no roar',
    pad.air > up.air && up.air > 3 * thin.air && thin.airLp < up.airLp && vac.air === 0 && vac.str > 0 && off.air === 0 && off.str === 0 && off.sub === 0,
    `air ${pad.air.toFixed(2)} → ${up.air.toFixed(2)} → ${thin.air.toFixed(3)} → ${vac.air}; lowpass ${up.airLp.toFixed(0)} → ${thin.airLp.toFixed(0)} Hz`);
  const sub = sndMix({ T: 4e6, pr: 0.5, M: 0.8, q: 2e4 }), sup = sndMix({ T: 4e6, pr: 0.5, M: 1.5, q: 2e4 }),
    sol = sndMix({ T: 4e6, pr: 1, solid: 1 }), liq = sndMix({ T: 4e6, pr: 1, solid: 0 }), small = sndMix({ T: 2e4, pr: 1 });
  check('sound mix: past Mach 1 the exhaust falls behind; solids crackle more than liquids; a 20 kN engine is quieter, not silent',
    sup.air < 0.4 * sub.air && sol.crk > 3 * liq.crk && small.air > 0.1 && small.air < 0.3 * liq.air,
    `M 0.8 → 1.5: ${sub.air.toFixed(2)} → ${sup.air.toFixed(2)}; crackle solid ${sol.crk.toFixed(2)} / liquid ${liq.crk.toFixed(2)}; 20 kN ${small.air.toFixed(2)}`);
  const near = sndBoom(100, 1, 1, false), far = sndBoom(5000, 1, 1, false), space = sndBoom(100, 0, 1, false), me = sndBoom(0, 0, 1, true);
  check('sound mix: a blast arrives late and dull from afar, not at all through vacuum, and our own ship is heard through its structure',
    near.gain > 2 * far.gain && Math.abs(far.delay - 5000 / 340) < 1e-9 && far.lp < near.lp && space.gain === 0 && me.gain > 0 && me.delay === 0,
    `100 m ${near.gain.toFixed(2)} @ ${near.delay.toFixed(2)} s; 5 km ${far.gain.toFixed(2)} @ ${far.delay.toFixed(1)} s, lowpass ${far.lp.toFixed(0)} Hz`);
  // a real ascent: the Orbiter's gravity turn (as §3), the mix sampled every second
  api.t = 0; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.sas = false; s.throttle = 1; api.stage(s);
  const point = pd => { const f = api.localFrame(s.r), p = pd * Math.PI / 180, Y = norm(add(mul(f.e, Math.cos(p)), mul(f.up, Math.sin(p)))), X = norm(cross(Y, f.n));
    s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  const tr = []; let next = 0, n = 0;
  while (n++ < 300000 && s.alive) { const h = len(s.r) - TELLUS.R, el = elements(s.r, s.v, TELLUS.mu);
    point(90 * (1 - Math.pow(Math.min(1, Math.max(0, (h - 1000 * AS) / (44000 * AS))), 0.6)));
    if (el.ap - TELLUS.R > ATM + 10000) break;
    if (api.dvRemaining(s).cur <= 0.5 && s.evIdx < s.events.length) api.stage(s);
    api.physStep(s, api.DT);
    if (api.t >= next) { next += 1; const pr = h < ATM ? Math.exp(-h / TELLUS.H) : 0;
      tr.push({ t: api.t, h, M: s.mach || 0, q: s.qdyn || 0, m: sndMix({ T: s.thrust, pr, M: s.mach || 0, q: s.qdyn || 0, v: (s.mach || 0) * 340, agl: h }) }); } }
  const at = f => tr.reduce((b, x) => f(x) < f(b) ? x : b), mq = tr.reduce((b, x) => x.q > b.q ? x : b),
    m1 = at(x => Math.abs(x.M - 1)), k30 = at(x => Math.abs(x.h - 3e4)), k80 = at(x => Math.abs(x.h - 8e4)), row = x => `T+${x.t.toFixed(0)} ${(x.h / 1e3).toFixed(1)} km: roar ${x.m.air.toFixed(2)} wind ${x.m.wind.toFixed(2)} buffet ${x.m.buf.toFixed(2)}`;
  console.log(`      sound over an Orbiter ascent: ${[tr[0], m1, mq, k30, k80].map(row).join(' | ')}`);
  check('sound over an Orbiter ascent: roar loudest on the pad, buffet at Mach 1, wind loudest near max-q, faint by 30 km, only the structure near the top of the air',
    tr[0].m.air > m1.m.air && m1.m.buf > 0.5 && Math.abs(tr.reduce((b, x) => x.m.wind > b.m.wind ? x : b).t - mq.t) < 15 && k30.m.air < 0.25 * tr[0].m.air && k80.m.air < 0.02 && k80.m.str > 0,
    `${tr.length} samples; max-q ${(mq.q / 1e3).toFixed(1)} kPa at T+${mq.t.toFixed(0)}`);
  const P = H.slice(H.indexOf('// ==== SIM END'));
  check('sound is wired: F4 in KEYS.all, sndTick called from frameBody() (the frame, R9) and not from render()',
    /all:\[[^\n]*k:\['f4'\]/.test(P) && /function frameBody\(now\)\{[^]*?sndTick\(dtR\)/.test(P) && !/function render\(\)\{[^]*?\n\}/.exec(P)?.[0].includes('sndTick'));
}

// aerofx-1. The plasma shell needs speed, not just heat (look & sound effects beat, QUEUE Q20 / PLAYTEST #17): the
// glow's heat level is the stagnation flux faded in by airspeed over .85–1.05 PLASMA_V (terrain's blackout threshold),
// so a hot climb at 1 km/s draws nothing, an orbital-speed entry draws the full shell, and it grows in smoothly. The
// render call must go through plasmaHeat for both the ship and falling stages (no bare heat-flux gate).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const fn = pg.slice(pg.indexOf('function plasmaHeat('), pg.indexOf('\n', pg.indexOf('function plasmaHeat(')));
  const { TELLUS: T, PLASMA_V: PV } = api, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const plasmaHeat = new Function('len', 'sub', 'surfVel', 'clamp', 'PLASMA_V', fn + ';return plasmaHeat')(len, sub, api.surfVel, clamp, PV);
  const r = api.fromPF(T, mul(api.SITES[0].u, T.R + 20e3), 0), e = api.localFrame(r).e, at = va => plasmaHeat(T, r, add(api.surfVel(T, r), mul(e, va)), 7.7e4);
  const ramp = []; for (let v = 0.8 * PV; v <= 1.1 * PV; v += PV / 200) ramp.push(at(v));
  const mono = ramp.every((q, i) => !i || q >= ramp[i - 1]), jump = Math.max(...ramp.map((q, i) => i ? q - ramp[i - 1] : 0));
  check('plasma shell: no glow from a hot climb at 1 km/s or at .85 PLASMA_V; full heat by 1.05 PLASMA_V; rises smoothly',
    at(1041) === 0 && at(0.85 * PV) === 0 && Math.abs(at(1.05 * PV) - 7.7e4) < 1 && at(2600) === 7.7e4 && mono && jump < 7.7e4 * 0.05,
    `PLASMA_V ${PV} · 1041 m/s ${at(1041)} · PLASMA_V ${at(PV).toFixed(0)} · 2600 m/s ${at(2600)} · largest step ${jump.toFixed(0)}`);
  const blk = pg.slice(pg.indexOf('if(PLASMA_FX&&near)'), pg.indexOf('\n  // RCS:'));
  check('plasma shell: the ship and debris draws are gated by plasmaHeat, not the bare heat flux',
    (blk.match(/plasmaHeat\(/g) || []).length === 2 && !/qHeat>1\.5e4|g\.q>1\.5e4/.test(blk), blk.slice(0, 120));
}

// aerofx-2. The plasma lights the hull (look & sound effects beat, QUEUE Q63): plasmaLight makes the shock layer the
// scene's point light (PLT) while it outshines the plumes, upstream of the leading face; nothing on a hot climb (the
// same speed gate as the shell); a brighter light already in PLT (an explosion's flash) keeps it. Called between the
// plumes' and the explosions' lights, before the mesh pass reads PLT.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const fsrc = pg.slice(pg.indexOf('function plasmaLight('), pg.indexOf('\nlet PLASMA_LK'));
  const hsrc = pg.slice(pg.indexOf('function plasmaHeat('), pg.indexOf('\n', pg.indexOf('function plasmaHeat(')));
  const { TELLUS: T } = api, clamp = (x, a, b) => Math.min(b, Math.max(a, x)), PLT = { p: new Float32Array(4), c: new Float32Array(3), p2: new Float32Array(4), c2: new Float32Array(3), g: 1 };
  const S = { body: T, alive: true, radius: 0.66, yTop: 0.72, yBot: -0.48, qHeat: 1.6e5 };
  const env = { PLASMA_LIGHT: true, PLASMA_FX: true, mode: 'flight', S, PLT, simT: 0, PLASMA_LK: 5, len, sub, add, mul, dot, clamp,
    surfVel: api.surfVel, qrot: api.qrot, bodyPos: () => [0, 0, 0], PLASMA_V: api.PLASMA_V };
  const plasmaLight = new Function(...Object.keys(env), hsrc + ';' + fsrc + ';return plasmaLight')(...Object.values(env));
  S.r = api.fromPF(T, mul(api.SITES[0].u, T.R + 50e3), 0); const e = api.localFrame(S.r).e;
  const fly = (va, qH, shieldFirst) => { S.v = add(api.surfVel(T, S.r), mul(e, va)); S.qHeat = qH; const Y = mul(e, shieldFirst ? -1 : 1), X = norm(cross(Y, norm(S.r)));
    S.q = api.qFromBasis(X, Y, cross(X, Y)); PLT.c.fill(0); PLT.g = 1; plasmaLight([0, 0, 0]); return { c: [...PLT.c], up: dot(sub([...PLT.p].slice(0, 3), S.r), e), w: PLT.p[3], g: PLT.g }; };
  const entry = fly(2600, 1.6e5, true), climb = fly(1041, 7.7e4, false);
  PLT.c.set([500, 300, 150]); S.v = add(api.surfVel(T, S.r), mul(e, 2600)); S.qHeat = 1.6e5; plasmaLight([0, 0, 0]); const boomKept = PLT.c[0] === 500;
  const rnd = H.slice(H.indexOf('plumeLight(camW);'), H.indexOf('gl.uniform4fv(m.uPl,PLT.p)'));
  check('plasma light: an entry lights the hull from just upstream (warm, no ground pool); a hot climb and a brighter flash leave PLT alone',
    entry.c[0] > 0 && entry.c[0] >= entry.c[1] && entry.up > 0.48 && entry.up < 2 && entry.g === null && climb.c.every(x => x === 0) && climb.g === 1 && boomKept
      && /plumeLight\(camW\);plasmaLight\(camW\);boomLight\(camW\)/.test(rnd),
    `entry rgb ${entry.c.map(x => x.toFixed(1)).join(',')} at ${entry.up.toFixed(2)} m upstream, core ${entry.w.toFixed(2)} m · climb ${climb.c.join(',')} · flash kept ${boomKept}`);
  const vsrc = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  // aerofx-3 rides along here (same page slices): QUEUE Q64, vapor collars on side boosters. Each stack line gets its own
  // profile and shoulders: a Heavy has its core plus one line per booster, each booster's nose cone a shoulder near its
  // top; an Orbiter (one line) keeps exactly the shoulders the old whole-envelope profile gave.
  const cutFn = name => pg.slice(pg.indexOf('function ' + name + '('), pg.indexOf('\n', pg.indexOf('function ' + name + '(')));
  const vsrcFns = ['hullProfile', 'hullShoulders', 'lineProfile', 'vaporLines'].map(n => {
    const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); }).join('\n');
  const V = new Function('HULLPR', 'VLPR', vsrcFns + ';return {hullProfile,hullShoulders,lineProfile,vaporLines}')(new Float32Array(32), new Float32Array(32));
  const sh = s => V.vaporLines(s).map(l => ({ l, sh: V.hullShoulders(V.lineProfile(l.parts, l.lo, l.hi, l.ax, l.az), -1) }));
  const hv = api.newShip(api.PRESETS.Heavy), hL = sh(hv), ob = api.newShip(api.PRESETS.Orbiter), oL = sh(ob);
  const oldOb = V.hullShoulders(V.hullProfile(ob), -1).map(x => x.map(v => +v.toFixed(3))), newOb = oL[0].sh.map(x => x.map(v => +v.toFixed(3)));
  const boosters = hL.slice(1), noseOK = boosters.every(({ l, sh }) => sh.length && sh[0][0] >= 24 && Math.hypot(l.ax, l.az) > 0.5);
  check('vapor collars: each side booster gets its own line and a nose shoulder near its top; the Orbiter keeps its old collars',
    hL.length === 3 && noseOK && oL.length === 1 && JSON.stringify(oldOb) === JSON.stringify(newOb),
    `Heavy lines ${hL.length}: ${hL.map(({ l, sh }) => `(${l.ax.toFixed(2)},${l.az.toFixed(2)}) ${JSON.stringify(sh.map(x => x.map(v => +v.toFixed(2))))}`).join(' ')} · Orbiter old ${JSON.stringify(oldOb)} new ${JSON.stringify(newOb)}`);
  // aerofx-3 also: QUEUE Q23, moving parts. The bell turns about its throat by the quaternion from tdir to tdir + gv, and
  // the plume's frame follows: tilted the same way, leaving from the turned exit. Steerable plates and gimbals reach the
  // mesh shader through setMarks → setMoves; the reaction wheel has its own case.
  {
    const SIMF = new Function(src + 'return {qFromTo,qrot,norm,add,sub,cross,qFromBasis}')();
    const mfn = ['tiltQ', 'engMove', 'plumeFrame'].map(n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0;
      for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); }).join('\n');
    const M = new Function('qFromTo', 'qrot', 'norm', 'add', 'sub', 'cross', 'qFromBasis', 'bellThroat', 'MOVES_FX', mfn + ';return {engMove,plumeFrame}')(
      SIMF.qFromTo, SIMF.qrot, SIMF.norm, SIMF.add, SIMF.sub, SIMF.cross, SIMF.qFromBasis, () => 0.75, true);
    const a = 5 * Math.PI / 180, e = { d: { key: 'kestrel' }, pos: [0, 0, 0], y0: 10, h: 1.3, gv: [Math.sin(a), 0, 0] };
    const f0 = M.plumeFrame({ ...e, gv: null }), f1 = M.plumeFrame(e), down = SIMF.qrot(f1.qt, [0, -1, 0]);
    const lateral = f1.ex[0], expect = -0.75 * Math.sin(a);   // the exit swings opposite the thrust's tilt
    // a canted engine's exit hangs from its mount along −tdir (it was left at the untilted spot)
    const c10 = 10 * Math.PI / 180, fc = M.plumeFrame({ ...e, gv: null, tdir: [-Math.sin(c10), Math.cos(c10), 0] }), want = [1.3 * Math.sin(c10), 11.3 - 1.3 * Math.cos(c10)];
    check('moving parts: a canted engine\'s plume leaves from its tilted nozzle exit', Math.hypot(fc.ex[0] - want[0], fc.ex[1] - want[1]) < 1e-6,
      `exit (${fc.ex[0].toFixed(3)}, ${fc.ex[1].toFixed(3)}) vs (${want[0].toFixed(3)}, ${want[1].toFixed(3)})`);
    check('moving parts: a gimballed bell turns about its throat and the plume follows it (tilt and exit); at rest nothing moves',
      f0.qt === null && f0.ex[0] === 0 && Math.abs(lateral - expect) < 0.01 && Math.abs(down[0] + Math.sin(a)) < 0.02 && M.engMove({ ...e, gv: [0, 0, 0] }) === null
        && /uniform vec4 uMv\[48\]/.test(pg) && pg.includes("setMoves(u,parts)}") && pg.includes("case'rwheel':") && /pf=plumeFrame\(e\)/.test(pg)
        && (pg.match(/pf=plumeFrame\(e\)/g) || []).length === 2,
      `exit swings ${lateral.toFixed(3)} m (expect ${expect.toFixed(3)}), plume axis x ${down[0].toFixed(3)}`);
  }
  check('plasma light: views 46–47 are the shield-first capsule', /46: \[\['chute', 'bio', 'shield'\], [\d.]+, \d+, 'shield'/.test(vsrc) && /47: \[\[[^\]]*\], [\d.]+, \d+, 'shield'/.test(vsrc) && vsrc.includes("aoa === 'shield'"));
}

// aerofx-3. A different galaxy each playthrough (look & sound effects beat, QUEUE Q21): the sky's galaxy comes from the
// program's own seed PROG.gseed, drawn once and kept (saved with PROG); a different seed gives a different sky; a program
// reset clears it; the reference views pin it to WSEED so they stay the same pictures.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const SIMF = new Function(src + 'return {rng,norm,add,sub,mul,dot,WSEED,PROG_SCHEMA}')(), P = {};
  const G = new Function('rng', 'norm', 'add', 'sub', 'mul', 'dot', 'WSEED', 'PROG', body('makeGal') + body('galSights') + ';let GAL=makeGal(WSEED);' + body('galaxy') + ';return {makeGal,galaxy}')(
    SIMF.rng, SIMF.norm, SIMF.add, SIMF.sub, SIMF.mul, SIMF.dot, SIMF.WSEED, P);
  const a = G.galaxy(), s1 = P.gseed, b = G.galaxy(), w = G.makeGal(SIMF.WSEED), o = G.makeGal(s1 + 1);
  P.gseed = null; const c = G.galaxy(), s2 = P.gseed;
  const vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8'), ed = readFileSync(new URL('./app/editor.js', import.meta.url), 'utf8');
  check('galaxy per program: drawn once and kept, different seeds differ, a reset draws a new one; views pin WSEED',
    s1 > 0 && a === b && a.seed === s1 && Math.abs(dot(w.gx, o.gx)) < 0.9999 && s2 > 0 && s2 !== s1 && c.seed === s2
      && vj.includes('PROG.gseed = WSEED') && ed.includes('function resetProgram(){programNew()') && SIMF.PROG_SCHEMA.gseed[0] === null && SIMF.PROG_SCHEMA.gseed[1] === 'career' && /galaxy\(\);gl\.uniform3fv\(u\.uGx/.test(pg),
    `seeds ${s1} → reset ${s2}; WSEED vs other gx·gx ${dot(w.gx, o.gx).toFixed(3)}`);
  // QUEUE Q116 (PLAYTEST #32): near an airless body the lighting's fill comes from its sunlit ground, about its own up:
  // on Selene's day side the ground term is lit; on its night side it is dark; far out in space there is none
  {
    const SM = new Function(src + 'return {BODIES,TELLUS,SELENE,bodyPos,norm,sub,add,mul,len,dot,cross,SUN_DIR,get t(){return simT}}')();
    const F = new Function('BODIES', 'TELLUS', 'bodyPos', 'norm', 'sub', 'len', 'dot', 'SUN', 'simT', 'FILL_FX', body('diskOf') + body('airlessFill') + ';return airlessFill')(
      SM.BODIES, SM.TELLUS, SM.bodyPos, SM.norm, SM.sub, SM.len, SM.dot, SM.SUN_DIR, SM.t, true);
    const C = SM.bodyPos(SM.SELENE, SM.t), at = (u, h) => SM.add(C, SM.mul(SM.norm(u), SM.SELENE.R + h));
    const w = SM.norm(SM.cross(SM.SUN_DIR, [0, 0, 1])), day = F(at(SM.add(SM.mul(SM.SUN_DIR, Math.sin(0.35)), SM.mul(w, Math.cos(0.35))), 2)),
      night = F(at(SM.mul(SM.SUN_DIR, -1), 2)), far = F(SM.mul(SM.SUN_DIR, 2e8)), high = F(at(SM.SUN_DIR, SM.SELENE.R));
    check('airless fill: a lander on Selene\'s day side gets light from the ground (its own up); none at night, less higher up, none in deep space',
      day && day.gnd[0] > 0.1 && day.gnd[0] < 0.4 && Math.abs(SM.dot(day.up, SM.norm(SM.sub(at(w, 0), C))) - Math.cos(0.35)) < 0.01 && night && night.gnd[0] === 0
        && far === null && high && high.gnd[0] < day.gnd[0] && /function lightEnv\(p\)\{const af=airlessFill\(p\);if\(af\)return af;/.test(pg),
      `day ground ${day && day.gnd[0].toFixed(3)}, night ${night && night.gnd[0]}, 1 R up ${high && high.gnd[0].toFixed(3)}`);
  }
  // QUEUE Q65: the ground under the cloud volume takes the volume's own shadow (cloudShadowV, blended by uVk and the bake's
  // edge), with its A/B uniforms uploaded; the deck's variety is behind its own toggle
  // (Q379: the march toward the sun is baked, SHD_FS; cloudShadowV reads it)
  check('cloud volume shadows: the ground shading uses cloudShadowV, from cloudDens marched toward the sun (baked, Q379); toggles wired',
    pg.includes('col=alb*(ndb*st*5.*cloudShadowV(p)+') && /float cloudShadowV\(vec3 p\)\{float sh=cloudShadow\(p\);/.test(pg) && /od\+=cloudDens\(P\+uSun\*/.test(pg) && /texture\(uShd,uq\)/.test(pg)
      && pg.includes('gl.uniform1f(u.uVs,CLOUD_SHADOW_V?1:0);') && pg.includes('gl.uniform1f(u.uVv,CLOUD_VARY?1:0);') && /uniform float uCvX,uVk,uVD,uVs,uVv;/.test(pg));
  // QUEUE Q66: per-engine voices. Smaller nozzles sing higher; voices go by kind of engine (two Kestrels are one voice), the
  // biggest thrust shares first, at most four; nothing when nothing burns; equal shares sum to the airborne level in power
  {
    const blk = H.slice(H.indexOf('// ==== SOUND MIX BEGIN'), H.indexOf('// ==== SOUND MIX END'));
    const { sndVoices } = new Function(blk + ';return {sndVoices}')();
    const wren = sndVoices([{ key: 'wren', T: 18e3, exit: 0.25 }], 1), alb = sndVoices([{ key: 'albatross', T: 1.1e6, exit: 1.1 }], 1);
    const mix = sndVoices([{ key: 'kestrel', T: 230e3, exit: 0.55 }, { key: 'kestrel', T: 230e3, exit: 0.55 }, { key: 'condor', T: 460e3, exit: 0.62 }], 0.8);
    const many = sndVoices(['a', 'b', 'c', 'd', 'e'].map((k, i) => ({ key: k, T: 1e5 * (i + 1), exit: 0.3 + 0.1 * i })), 1);
    // (Q514) the peak at a rocket's Strouhal number, 0.03: tens of hertz to ~150, not a hiss at 450 Hz to 1 kHz
    check('engine voices: a small nozzle sings higher than a big one; one voice per kind; ≤ 4, biggest first; silent when off (and the volume slider, Q35, is wired)',
      wren[0].f > 95 && wren[0].f < 105 && alb[0].f < 40 && alb[0].f >= 28 && Math.abs(mix[0].f - 45.5) < 1 && mix.length === 2 && Math.abs(mix[0].g ** 2 + mix[1].g ** 2 - 0.64) < 1e-9 && many.length === 4 && many[0].f < many[3].f
        && /ice\*=1\.-\.85\*bare\*uIv;sn\*=1\.-\.85\*bare\*uIv;/.test(H) && /gl\.uniform1f\(u\.uIv,ICE_VARY\?1:0\)/.test(H)
        && /function sndSettings\(el\)/.test(H) && /if\(typeof sndSettings==='function'\)sndSettings\(\$\('setSound'\)\)/.test(H) && /localStorage\.getItem\('launchpad-volume'\)/.test(H)
        && sndVoices([], 1).length === 0 && sndVoices([{ key: 'x', T: 0, exit: 0.5 }], 1).length === 0 && /AUD\.V=\[0,1,2,3\]\.map/.test(H) && /sndVoices\(st\.engs,m\.air\)/.test(H),
      `Wren ${wren[0].f.toFixed(0)} Hz, Albatross ${alb[0].f.toFixed(0)} Hz, Kestrel×2 + Condor: ${mix.map(v => v.f.toFixed(0) + ' Hz ' + v.g.toFixed(2)).join(', ')}`);
    // QUEUE Q67: the plasma's sound follows the heating like the drawn shell (flux on its log scale, the same airspeed gate);
    // sounds from elsewhere fall with distance, pan toward their side, need air at both ends
    const { sndPlasma, sndOthers } = new Function(blk + ';return {sndPlasma,sndOthers}')(), PV = api.PLASMA_V;
    const climb = sndPlasma(7.7e4, 1041, PV), peak = sndPlasma(1.6e5, 2600, PV), onset = sndPlasma(2e4, 2600, PV), cool = sndPlasma(0, 3000, PV), moon = sndPlasma(1e5, 2600, 0);
    const near = sndOthers([{ d: 200, T: 2.3e5, air: 1, x: 1 }]), far = sndOthers([{ d: 8000, T: 2.3e5, air: 1, x: 1 }]), left = sndOthers([{ d: 200, T: 2.3e5, air: 1, x: -0.8 }]),
      vac = sndOthers([{ d: 200, T: 2.3e5, air: 0, x: 1 }]), deb = sndOthers([{ d: 500, T: 0, whoosh: 0.5, air: 0.5, x: 0 }]);
    check('plasma sound: none on a hot climb or cool air, faint at onset, full at an orbital entry\'s peak; elsewhere: nearer is louder, panned, silent in vacuum',
      climb === 0 && cool === 0 && moon === 0 && onset > 0 && onset < 0.2 && peak > 0.95 && near.g > 2 * far.g && near.pan > 0.9 && left.pan < -0.7 && vac.g === 0 && deb.g > 0 && near.lp > far.lp
        && /sndPlasma\(st\.qh,st\.va,st\.pv\)/.test(H) && /sndOthers\(st\.others\)/.test(H),
      `plasma: climb ${climb}, onset ${onset.toFixed(2)}, peak ${peak.toFixed(2)} · others: 200 m ${near.g.toFixed(2)}, 8 km ${far.g.toFixed(3)}, debris ${deb.g.toFixed(2)}`);
  }
  // QUEUE Q102 (steps 1–3): hardware schools. A power's school is drawn once from its archetype's affinity (stable per
  // world and power); all six national schools are built (Q228); a part draws in its maker's school (an import: the seller's);
  // the school rides in the vertex's kind (+32·school) and both mesh shaders decode it; reference views pin Cape
  {
    const SM = new Function(src + 'return {rng,WSEED,POWERS,HOME,archOf:typeof archOf==="function"?archOf:null}')();
    const env = { rng: SM.rng, WSEED: SM.WSEED, HOME: SM.HOME, SCHOOL_FORCE: null };
    const mk = (POW, arch, srcFn) => new Function('rng', 'WSEED', 'HOME', 'POWERS', 'archOf', 'sourceOf', 'SCHOOL_FORCE',
      pg.slice(pg.indexOf('const SCHOOL_IDS='), pg.indexOf('let SCHOOL_FORCE=')) + body('schoolOf') + ';' + body('partMaker') + ';' + body('partSchool') + ';return {schoolOf,partSchool}')(
      env.rng, env.WSEED, env.HOME, POW, arch, srcFn, null);
    const pows = Array.from({ length: 400 }, (_, i) => ({ arch: i % 2 ? 'closedSuper' : 'openSuper' })), A = i => pows[i].arch;
    const S1 = mk(pows, A, () => ({ how: 'home' })), S2 = mk(pows, A, () => ({ how: 'home' }));
    const closed = pows.map((_, i) => i).filter(i => i % 2), steppeShare = closed.filter(i => S1.schoolOf(i) === 1).length / closed.length;
    const stable = pows.every((_, i) => S1.schoolOf(i) === S2.schoolOf(i)), open = pows.map((_, i) => i).filter(i => !(i % 2)), capeShare = open.filter(i => S1.schoolOf(i) === 0).length / open.length,
      openCape = capeShare > 0.5 && capeShare < 0.7 && open.every(i => [0, 3, 4].includes(S1.schoolOf(i))) && closed.every(i => [1, 2].includes(S1.schoolOf(i)));   // open: Cape .6, Coastal and Mountain .2; closed: Steppe .7, Arsenal .3
    const imp = mk(pows, A, () => ({ how: 'import', from: 1 })).partSchool({ d: { key: 't2' } }), own = mk(pows, A, () => ({ how: 'home' })).partSchool({ d: { key: 't2' } });
    check('hardware schools: a power\'s school follows its affinity (closed superpowers mostly Steppe, else Arsenal; open ones mostly Cape, else Coastal or Mountain) and never changes; a part draws in its maker\'s school',
      steppeShare > 0.6 && steppeShare < 0.8 && stable && openCape && imp === S1.schoolOf(1) && own === S1.schoolOf(env.HOME)
        && /int k=int\(aK\.x\+\.5\)%32;/.test(pg) && /hq=k\/256,sch=\(k\/32\)%8;k=k%32;/.test(pg) && /PK\.k\+32\*\(PK\.sch\|\|0\)\+256\*\(PK\.hq\|\|0\)/.test(pg)
        && /rdl=roundel\(vec2\(s-1\.5708\*R,v-h\*\.5\)\/rs,sch,fp\/rs,hue\)/.test(pg) && pg.indexOf(' alb=mix(alb,rdl.rgb,rdl.a);') > pg.indexOf('Steppe (Q102): grey-green enamel')
        && /if\(INTERSTAGE_FX&&p\.d\.kind==='dec'\)/.test(pg) && /sch=partSchool\(p\);PK=\{o:\[x,y0,z\],k:KIND\.collar/.test(pg)
        && /SCHOOL_FORCE = 0;/.test(readFileSync(new URL('./views.js', import.meta.url), 'utf8')),
      `closed superpowers drawing Steppe: ${(steppeShare * 100).toFixed(0)} % (0.7 expected)`);
  }
  // QUEUE Q24: char on dark paint heat-tints (it can't blacken black); a bay door's inside is a different colour from its
  // outside, and it has hinge brackets
  check('char on dark paint tints; bay doors have an inside and hinges',
    /float dk=1\.-smoothstep\(\.04,\.18,dot\(alb,vec3\(\.3,\.59,\.11\)\)\);/.test(pg) && /alb=mix\(alb,mix\(vec3\([^)]*\),vec3\([^)]*\),nz2\),dk\*/.test(pg)
      && /pv\(out,z,mul\(n,-1\),cin\)/.test(body('bayDoor')) && /for\(const zz of\[-\.55,0,\.55\]\)rbox/.test(body('bayDoor')));
  // QUEUE Q97: the leg and the power parts have their own looks (placeholders gone); the deployed leg puts its footpad
  // where the sim's legFoot puts the foot (reach out, drop below), one case each
  const leg = body('partBody').slice(body('partBody').indexOf("case'leg':"));
  check('part looks: leg, solar wing, body cells, battery and computer are drawn; the deployed leg\'s foot is legFoot\'s',
    ["case'leg':", "case'wpanel':", "case'bpanel':", "case'batt':", "case'ocomp':"].every(c => pg.split(c).length === 2) && !pg.includes('placeholder until the parts & pad beat')
      && !pg.includes('placeholders until the parts & pad beat') && /F1=\[x\+n\[0\]\*d\.reach,y-d\.drop,z\+n\[2\]\*d\.reach\]/.test(leg)
      && /const legFoot=p=>\{const a=p\.phi\|\|0;return\[p\.pos\[0\]\+p\.d\.reach\*Math\.cos\(a\),p\.y0-p\.d\.drop/.test(H));
}

// aerofx-4. The Steppe pad (look & sound effects beat, QUEUE Q159, Q102 step 7). A site's pad is in its owner's school
// (SCHOOL_FORCE overrides); Steppe's rig (support arms, cable masts, service halves, the erector) comes from the page's
// own buildRig/padRig with stubs, for every preset: the arms clamp the rocket without passing through it, the closed
// service halves, the masts' arms and the erector's cradle arms stop short of it, the table ring clears its base
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (a, b) => { const i = page.indexOf(a); return i < 0 ? '' : page.slice(i, page.indexOf(b, i + a.length)); };
  const D = new Function(src + `let mode='flight';const LIFT=3,PAD_GX=10.5;${cut('const PIT_W=', '\n')}
    const box=(o,c,hx,hy,hz)=>o.push({c:c.slice(),h:[hx,hy,hz]}),lattice=(o,x,z,w,Hh)=>o.push({c:[x,Hh/2,z],h:[w/2,Hh/2,w/2]}),tube=(o,A,B,r)=>o.push({A:A.slice(),B:B.slice(),r}),
      lathe=(o,prof)=>o.push({prof}),makeMesh=a=>({a,free(){}});
    ${cut('function buildRig(TH,rig,sch=0){', '\n// The tower is sized')}\n${cut('function padRig(TH){', '\nfunction padSync')}
    return {buildRig,padRig,newShip,PRESETS,set S(v){S=v}};`)();
  const bad = [], seen = [];
  for (const [k, st] of Object.entries(D.PRESETS)) {
    const s = D.newShip(st); D.S = s; const TH = Math.min(60, Math.max(12.5, Math.ceil((s.len + 3) / 2.5) * 2.5)), rig = D.padRig(TH), R = D.buildRig(TH, rig, 1);
    const inside = (q, r) => s.parts.find(p => { const y0 = p.y0 + rig.base; return p.d.kind !== 'rdec' && q[1] >= y0 && q[1] <= y0 + p.h && Math.hypot(q[0] - p.pos[0], q[2] - p.pos[2]) < p.d.r + r - 1e-6; });   // (a radial decoupler is a bracket, not a cylinder)
    const sweep = (T, P, u1, what) => { for (let i = 0; i <= 40; i++) { const u = u1 * i / 40, q = T.A.map((v, j) => P[j] + v + (T.B[j] - v) * u), p = inside(q, T.r); if (p) { bad.push(`${k}: ${what} through ${p.d.key}`); return true; } } };
    if (R.sch !== 1) { bad.push(`${k}: not Steppe's rig`); continue; }
    let clampOff = 0;
    for (const Hd of R.holds) { for (const T of Hd.mesh.a.filter(x => x.A).slice(0, 2)) if (sweep(T, Hd.P, 0.9, 'support arm')) break;
      const E = Hd.mesh.a[0].B, at = [Hd.P[0] + E[0], Hd.P[1] + E[1], Hd.P[2] + E[2]];   // the arm's top: at the rocket's skin
      const gap = Math.min(...s.parts.filter(p => { const y0 = p.y0 + rig.base; return at[1] >= y0 && at[1] <= y0 + p.h; }).map(p => Math.hypot(at[0] - p.pos[0], at[2] - p.pos[2]) - p.d.r), 9);
      clampOff = Math.max(clampOff, Math.abs(gap)); if (gap > 0.6) bad.push(`${k}: a support arm ends ${gap.toFixed(2)} m short`); }
    for (const M of R.arms) sweep(M.mesh.a.find(x => x.A), M.P, 1, 'cable mast arm');
    for (const T of R.boom.a.filter(x => x.A && x.A[2] === 0 && x.B[2] > 0)) sweep(T, R.bP, 1, 'erector cradle');
    // the closed halves (east as built, west turned 180°): every deck tube and column outside the rocket's reach
    for (const T of R.gantry.a) { const xs = T.A ? [T.A[0], T.B[0]] : [T.c[0] - T.h[0], T.c[0] + T.h[0]];
      if (Math.min(...xs.map(x => R.xh + x)) < rig.ext + 0.3) { bad.push(`${k}: service half within ${rig.ext.toFixed(2)} m`); break; } }
    const ring = R.posts.a.find(x => x.prof); if (!ring || ring.prof[0][0] < rig.ext + 0.3) bad.push(`${k}: table ring inside the rocket`);
    seen.push(`${k} ${clampOff.toFixed(2)}`);
  }
  check('Steppe pad: support arms clamp every preset without passing through it; masts, erector and the closed service halves stop short; the ring clears its base',
    !bad.length, bad.slice(0, 4).join(' | ') || `clamp gaps (m): ${seen.join(', ')}`);
  // the school per site, the per-site draw, the Cape pad untouched, the views
  const P = new Function('SCHOOL_FORCE', 'schoolOf', 'HOME', cut('const padSchoolOf=', '\n') + ';return padSchoolOf');
  const sch = i => i === 3 ? 1 : 0, vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  check('Steppe pad: a site is built in its owner\'s school (sea: home\'s), the tester\'s force wins; every site draws its own; views 116–119',
    P(null, sch, 0)({ power: 3 }) === 1 && P(null, sch, 0)({ power: 0 }) === 0 && P(null, sch, 3)({ power: null }) === 1 && P(0, sch, 0)({ power: 3 }) === 0 && P(1, sch, 0)({ power: 0 }) === 1
      && /drawMesh\(padFor\(t\),M,site\)/.test(H) && /function buildPad\(TH,sch=0,pw=null\)\{[^\n]*\n  if\(sch===1\)steppeTable\(a,CO,STL,DK\);else if/.test(page)
      && /if\(key===padKey\)return;const pw=curSite\(\)\.power;if\(H!==padTH\|\|sch!==padSch\|\|pw!==padPw\)/.test(page) && /if\(RIG\.sch===1\)return drawSteppeRig/.test(page) && /SCHOOL_FORCE = 1;/.test(vj) && /n >= 116 && n <= 119/.test(vj));
}

// aerofx-5. The crew's look, slice 1 (look & sound effects beat, QUEUE Q195; Caio: W19 stylised human, suits by school and
// epoch from the default). The figure is built from app/crew-look.js with a recording pv: about 1.78 m tall standing on
// its own feet, the waving glove above the helmet's top, the faceplate open (the face shows); every national school has
// its three launch suits (Q229), no two generations of a school sharing a dominant colour; unknown ones fall back to the default. Cape's crew arm (buildRig with stubs): at the hatch of every crewed design, its deck ending short of the
// capsule, a swing arm at the same height standing down; Steppe's rig has none yet; the crew are drawn in the editor only.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (a, b) => { const i = page.indexOf(a); return i < 0 ? '' : page.slice(i, page.indexOf(b, i + a.length)); };
  const C = new Function(src + `const P=[];const pv=(o,p,n,c)=>{o.push(p);P.push({p,c})},tube=(o,A,B)=>{o.push(A,B)},lathe=(o,prof)=>{for(const[r,y]of prof)o.push([r,y,0])};
    ${cut('const SUIT_DEFAULT=', '\n// The crew on the access arm')}
    return {crewFigure,suitOf,SUIT_DEFAULT,SUITS,CREW_C,CREW_PEOPLE,CREW_EX,P};`)();
  const lines = [0, 1, 2, 3, 4, 5].map(k => C.SUITS[k]), key = c => c.slice(0, 3).map(x => x.toFixed(2)).join(),
    suitsOk = lines.every(L => L && L.length === 3 && new Set(L.map(x => key(x.c1))).size === 3) && C.suitOf(9, 0) === C.SUIT_DEFAULT && C.suitOf(1, 2) !== C.SUIT_DEFAULT;
  const pts = a => a.filter(Array.isArray), st = pts(C.crewFigure(C.suitOf(0, 0), 'stand', 0)), wv = pts(C.crewFigure(C.suitOf(1, 2), 'wave', 1));
  const ys = st.map(p => p[1]), top = Math.max(...ys), foot = Math.min(...ys), wTop = Math.max(...wv.map(p => p[1]));
  const sk0 = C.CREW_PEOPLE[0].skin, skin = C.P.filter(v => v.c[0] === sk0[0] && v.c[1] === sk0[1] && v.c[2] === sk0[2]).map(v => v.p), faceFwd = skin.filter(p => p[2] > C.CREW_C.head * 0.7 && p[1] > 1.4).length;
  check('crew look: a stylised astronaut ~1.78 m tall on its own feet; the waving glove rises above the helmet; the face shows; six schools × three suits, each generation its own colour',
    top > 1.74 && top < 1.82 && Math.abs(foot) < 0.02 && wTop > top && faceFwd > 20 && suitsOk,
    `height ${top.toFixed(3)} m, feet at ${foot.toFixed(3)}, waving hand to ${wTop.toFixed(2)} m; ${faceFwd} face vertices forward`);
  // Q532 (D26): the ligne-claire head. Dot eyes (no whites) in the neutral face, whites when wide open; each of the five
  // expressions draws a different face; the roster spans every skin tone (darkest under a third of the lightest's
  // luminance) with several hair styles and moustaches; and every launch suit's helmet holds the whole head and hair.
  {
    const lum = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2], white = v => v.c[0] > .95 && v.c[1] > .95 && v.c[2] > .95 && v.c[3] === 0;
    const faceOf = (k, ex) => { C.P.length = 0; C.crewFigure(C.SUIT_DEFAULT, 'stand', k, ex); return C.P.filter(v => v.c[3] === 2 && v.c[0] < .06 || white(v) || v.c[0] === .38).map(v => v.p.map(x => x.toFixed(4)).join()).sort().join('|') };
    const ex = Object.keys(C.CREW_EX), faces = new Set(ex.map(e => faceOf(0, e)));
    C.P.length = 0; C.crewFigure(C.SUIT_DEFAULT, 'stand', 0, 'neutral'); const neutralWhites = C.P.filter(white).length;
    C.P.length = 0; C.crewFigure(C.SUIT_DEFAULT, 'stand', 0, 'alarm'); const alarmWhites = C.P.filter(white).length;
    const L = C.CREW_PEOPLE.map(p => lum(p.skin)), styles = new Set(C.CREW_PEOPLE.map(p => p.style)), mous = C.CREW_PEOPLE.filter(p => p.mous).length;
    const s = C.CREW_C, hip = s.legL + s.boot[1] * 1.2, neck = hip + s.tH + s.head * .25, HC = [0, neck + s.head * 1.05, s.head * .05], misfit = [];
    for (let sc = 0; sc < 6; sc++) for (let g = 0; g < 3; g++) for (let k = 0; k < C.CREW_PEOPLE.length; k++) {
      const su = C.suitOf(sc, g), HR = (su.helm && su.helm.R) || s.helmR, pe = C.CREW_PEOPLE[k], cols = [pe.skin, pe.hair].map(c => c.join());
      C.P.length = 0; C.crewFigure(su, 'stand', k, 'neutral');
      const far = Math.max(...C.P.filter(v => cols.includes(v.c.slice(0, 3).join())).map(v => Math.hypot(v.p[0] - HC[0], v.p[1] - HC[1], v.p[2] - HC[2])));
      if (far > HR * (su.helm && su.helm.egg ? 1.2 : 1)) misfit.push(`${sc}·${g} person ${k}: ${far.toFixed(3)} > ${HR}`);
    }
    check('crew look: the ligne-claire head (Q532): dot eyes, five expressions each its own face, a roster across every skin tone with several hair styles and moustaches, every launch helmet holds the head',
      neutralWhites === 0 && alarmWhites > 0 && faces.size === ex.length && ex.length === 5 && Math.min(...L) < Math.max(...L) / 3 && styles.size >= 6 && mous >= 2 && !misfit.length,
      misfit.slice(0, 3).join(' | ') || `${faces.size} faces; skin luminance ${Math.min(...L).toFixed(2)}–${Math.max(...L).toFixed(2)}; ${styles.size} hair styles, ${mous} moustaches; whites ${neutralWhites}/${alarmWhites}`);
  }
  const D = new Function(src + `let mode='flight';const LIFT=3,PAD_GX=10.5;${cut('const PIT_W=', '\n')}
    const box=(o,c,hx,hy,hz)=>o.push({c:c.slice(),h:[hx,hy,hz]}),lattice=()=>{},tube=(o,A,B,r)=>o.push({A:A.slice(),B:B.slice(),r}),lathe=(o,prof)=>o.push({prof}),makeMesh=a=>({a,free(){}}),
      crewMeshes=(n,sch)=>Array.from({length:Math.min(n,2)},(_,k)=>({mesh:{free(){}},k}));
    ${cut('function buildRig(TH,rig,sch=0){', '\n// The tower is sized')}\n${cut('function padRig(TH){', '\nfunction padSync')}
    return {buildRig,padRig,newShip,PRESETS,set S(v){S=v},set mode(v){mode=v}};`)();
  const bad = [], seen = [], designs = Object.entries(D.PRESETS).filter(([, st]) => JSON.stringify(st).includes('"crew"'));
  designs.push(['small crewed', ['les', 'chute', 'crew', 'shield', 'dec', 't4', 'kestrel']]);
  for (const md of ['flight', 'editor']) for (const [k, st] of designs) {
    D.mode = md; const s = D.newShip(st); D.S = s; const TH = Math.min(60, Math.max(12.5, Math.ceil((s.len + 3) / 2.5) * 2.5)), rig = D.padRig(TH), R = D.buildRig(TH, rig);
    const cp = s.parts.find(p => p.d.crew), y0 = cp.y0 + rig.base;
    if (!R.crew) { bad.push(`${k} (${md}): no crew arm`); continue; }
    if (R.crew.h < y0 || R.crew.h > y0 + cp.h) bad.push(`${k}: the arm misses the capsule (${R.crew.h.toFixed(2)} m)`);
    const deckEnd = 5.5 - R.crew.L; if (deckEnd < cp.pos[0] + cp.d.r) bad.push(`${k}: the deck reaches into the capsule`);
    if (R.arms.some(A => !A.skip && Math.abs(A.h - R.crew.h) < 1.6)) bad.push(`${k}: a swing arm at the crew arm's height`);
    if (R.crewFig.length !== 2) bad.push(`${k}: ${R.crewFig.length} crew`);
    seen.push(`${k} ${md} at ${R.crew.h.toFixed(1)} m, gap ${(deckEnd - cp.pos[0] - cp.d.r).toFixed(2)}`);
  }
  D.mode = 'flight'; { const s = D.newShip(D.PRESETS.Orbiter); D.S = s; if (D.buildRig(20, D.padRig(20)).crew) bad.push('Orbiter (no crew): a crew arm'); }
  { const s = D.newShip(D.PRESETS['Crewed Lunar']); D.S = s; if (D.buildRig(45, D.padRig(45), 1).crew) bad.push('Steppe: a crew arm (not built yet)'); }
  check('crew look: Cape\'s crew arm reaches every crewed design\'s hatch and stops short of it; a swing arm there stands down; none without crew; the crew are drawn in the Assembly only',
    !bad.length && /drawPadCrew\(drawMesh,camW\);/.test(H) && /mode!=='editor'\|\|HOOK\.noRig\)return;/.test(page) && /<script src="app\/crew-look\.js"><\/script>/.test(readFileSync(new URL('./index.html', import.meta.url), 'utf8')),
    bad.slice(0, 4).join(' | ') || seen.join('; '));
}

// aerofx-6. The other four schools' pads (look & sound parts & pad beat, QUEUE Q231, Q102 step 7). Their rigs come from
// the page's own buildRig/padRig with stubs, for every preset in each school: what is built round the rocket (the
// Coastal table, the masts and their arms, Mountain's rail launcher and its closed shelter, Isle's strongback) stops
// short of it; Mountain hangs a small uncrewed rocket on the rail and stands anything else in the shelter; a crewed
// rocket gets Cape's crew arm in every one of the four. The static complexes build and stay on the sea platform's deck.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (a, b) => { const i = page.indexOf(a); return i < 0 ? '' : page.slice(i, page.indexOf(b, i + a.length)); };
  const D = new Function(src + `let mode='flight';const LIFT=3,PAD_GX=10.5;${cut('const PIT_W=', '\n')}
    const box=(o,c,hx,hy,hz)=>o.push({c:c.slice(),h:[hx,hy,hz]}),lattice=(o,x,z,w,Hh)=>o.push({c:[x,Hh/2,z],h:[w/2,Hh/2,w/2]}),tube=(o,A,B,r)=>o.push({A:A.slice(),B:B.slice(),r}),
      lathe=(o,prof)=>o.push({prof}),makeMesh=a=>({a,free(){}});
    ${cut('function buildRig(TH,rig,sch=0){', '\n// The tower is sized')}\n${cut('function padRig(TH){', '\nfunction padSync')}
    return {buildRig,padRig,newShip,PRESETS,set S(v){S=v}};`)();
  const bad = [], seen = [];
  for (const sch of [2, 3, 4, 5]) for (const [k, st] of Object.entries(D.PRESETS)) {
    const s = D.newShip(st); D.S = s; const TH = Math.min(60, Math.max(12.5, Math.ceil((s.len + 3) / 2.5) * 2.5)), rig = D.padRig(TH), R = D.buildRig(TH, rig, sch), tag = `${sch} ${k}`;
    if (R.sch !== sch) { bad.push(`${tag}: not its school's rig`); continue; }
    const body = s.parts.filter(p => p.d.kind !== 'rdec');
    const inBox = (c, h) => body.find(p => { const y0 = p.y0 + rig.base; if (c[1] + h[1] < y0 || c[1] - h[1] > y0 + p.h) return false;
      const dx = Math.max(Math.abs(p.pos[0] - c[0]) - h[0], 0), dz = Math.max(Math.abs(p.pos[2] - c[2]) - h[2], 0); return Math.hypot(dx, dz) < p.d.r - 0.03; });
    const inTube = (A, B, r) => { for (let i = 0; i <= 30; i++) { const q = A.map((v, j) => v + (B[j] - v) * i / 30), p = body.find(p => { const y0 = p.y0 + rig.base; return q[1] >= y0 && q[1] <= y0 + p.h && Math.hypot(q[0] - p.pos[0], q[2] - p.pos[2]) < p.d.r + r - 0.03; }); if (p) return p; } };
    const clear = (items, P, what) => { for (const T of items) { const o = (v) => v.map((x, j) => x + P[j]);
      const p = T.prof ? (T.prof[0][0] < rig.ext + 0.2 ? body[0] : null) : T.A ? inTube(o(T.A), o(T.B), T.r) : inBox(o(T.c), T.h);
      if (p) { bad.push(`${tag}: ${what} through ${p.d.key}`); return; } } };
    if (R.fixed) clear(R.fixed.a, [0, 0, 0], 'the fixed rig');
    for (const M of R.movers) clear(M.mesh.a, M.P, 'a mast or strongback');
    for (const Dr of R.doors) clear(Dr.mesh.a, Dr.P, 'the closed shelter');
    const crewed = s.parts.some(p => p.d.crew), small = !crewed && !rig.side && rig.L <= 24;
    if (sch === 4 && R.rail !== small) bad.push(`${tag}: rail ${R.rail}, expected ${small}`);
    if (crewed && !R.crew) bad.push(`${tag}: crewed, no crew arm`);
    if (!crewed && R.crew) bad.push(`${tag}: a crew arm, no crew`);
    if (sch === 4) seen.push(`${k}: ${R.rail ? 'rail' : 'shelter'}`);
  }
  check('school pads: Arsenal, Coastal, Mountain, Isle rigs stop short of every preset; Mountain: rail for small uncrewed rockets, the shelter otherwise; a crew arm for crewed ones',
    !bad.length, bad.slice(0, 4).join(' | ') || [...new Set(seen)].slice(0, 6).join(', '));
  // the static complexes: each builds, and nothing leaves the sea platform's deck (x −256…86, z −194…80)
  const pts = [], P = new Function(src + `const pts=[],C={W:[1,1,1],D:[0,0,0],GL:[0,0,0,4],BK:[0,0,0]};
    const pv=(o,p)=>pts.push(p),box=(o,c,hx,hy,hz)=>{pts.push([c[0]-hx,c[1],c[2]-hz],[c[0]+hx,c[1],c[2]+hz])},rbox=(o,c,hx,hy,hz)=>{const m=Math.max(hx,hz);pts.push([c[0]-m,c[1],c[2]-m],[c[0]+m,c[1],c[2]+m])},
      tube=(o,A,B)=>pts.push(A,B),lathe=(o,prof,c=[0,0,0])=>{const m=Math.max(...prof.map(q=>q[0]));pts.push([c[0]-m,0,c[2]-m],[c[0]+m,0,c[2]+m])},strip=(o,A,B)=>pts.push([A[0],0,A[1]],[B[0],0,B[1]]),
      lattice=(o,x,z,w)=>pts.push([x-w,0,z-w],[x+w,0,z+w]);
    ${cut("// ---- the other four schools' pads", "// the school a site's pad is built in")}
    return {pads:[arsenalPad,coastalPad,mountainPad,islePad],pts};`)();
  const out = [];
  P.pads.forEach((f, i) => { const n = P.pts.length; f([], 40, [0, 0, 0, 2], [0, 0, 0, 1], [0, 0, 0, 2]); const mine = P.pts.slice(n);
    if (mine.length < 50) out.push(`${i + 2}: only ${mine.length} points`);
    const o = mine.find(p => p[0] < -256 || p[0] > 86 || p[2] < -194 || p[2] > 80); if (o) out.push(`${i + 2}: off the deck at ${o.map(v => v.toFixed(0))}`); });
  const vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  check('school pads: the four complexes build and stay on the sea platform\'s deck; buildPad and drawPadRig dispatch them; views 145–151',
    !out.length && /else if\(sch>=2\)\[arsenalPad,coastalPad,mountainPad,islePad\]\[sch-2\]\(a,TH,CO,STL,DK,padName\(sch,pw\)\)/.test(page) && /if\(RIG\.sch>=2\)return drawSchoolRig/.test(page) && /n >= 145 && n <= 151/.test(vj), out.join(' | '));
}

// aerofx-7. The desk's polish (look & sound parts & pad beat, QUEUE Q276, from Q242; v1.132). The drafting board's title
// block is lettered with the design's name (the player's own if saved, v1.129) and its kit scale in a 5×7 font that
// covers every letter, digit and the scale's punctuation, each glyph distinct; the mesh is keyed on what it shows; the
// figure on the base plate is one of our crew in the program's suit.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (a, b) => { const i = page.indexOf(a); return i < 0 ? '' : page.slice(i, page.indexOf(b, i + a.length)); };
  const F = new Function(cut('const DESK_FONT=', '\n// what the desk shows') + ';return DESK_FONT')(), need = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-./';
  const miss = [...need].filter(c => !F[c] || F[c].length !== 7 || F[c].some(r => !(r >= 0 && r < 32)) || !F[c].some(r => r));
  const rows = [...need].map(c => F[c] && F[c].join()), dup = need[rows.findIndex((r, i) => rows.indexOf(r) !== i)];
  const name = /sv=k&&SV\.find\(d=>K\(d\.stack\)===k\)/.test(page) && /String\(sv&&sv\.name\|\|typeof designName==='function'&&designName\(st\)/.test(page);
  const keyed = /function deskMesh\(N\)\{const key=deskKey\(N\);if\(deskMeshes\.has\(key\)\)/.test(page) && /sc=`SCALE 1:\$\{N\}`/.test(page);
  const crew = /crewFigure\(suitOf\(schoolOf\(0\),crewGen\(\)\),'stand',0\)/.test(page);
  check('desk polish: the title block\'s font covers A–Z, 0–9 and ":-./" with distinct glyphs; the player\'s saved name, else the design\'s; the mesh keyed on name and scale; a suited crew figure',
    !miss.length && !dup && name && keyed && crew, `missing ${miss.join('') || 'none'} · duplicate ${dup || 'none'} · name ${name} · keyed ${keyed} · crew ${crew}`);
}

// aerofx-8. The reference views and two settings (look & sound effects beat, BEAUTY Q312). The views stand on the pad
// (the Assembly's model desk only in 152), enter the builder through the Assembly screen (the Program is a room that
// stops the 3D draw), hide the overlay's labels, and pin the effects clock so 90–93 catch the fireball; 152–158 are the
// beauty pass's moments. Graphics are Low and High: Low keeps the 30 fps iGPU floor, a saved 'medium' becomes Low.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const pad = /DESK_FX = n === 152;/.test(vj) && /HOOK\.fxT = null; ov\.style\.visibility = '';/.test(vj) && /'\.ui,#perf,#news,#msg,#deb,#ov'/.test(vj);
  const asm = /screenNow\(\) !== 'assembly'\) go\('assembly'\)/.test(vj) && !/if \(mode !== 'editor'\) document\.getElementById\('bEditor'\)\.click\(\);\n/.test(vj.replace(/const toBuilder[^\n]*\n/, ''));
  const clock = /HOOK\.fxT = b\.t0 \+ age \* 1000/.test(vj) && /const nowMs=fxNow\(\)/.test(page) && /function boomLight\(camW\)\{const now=fxNow\(\)/.test(page) && /const fxNow=\(\)=>HOOK\.fxT\?\?FXT/.test(page);
  const moments = [152, 154].every(n => vj.includes(`n === ${n}`)) && /n >= 156 && n <= 158/.test(vj) && /153: \['Orbiter'/.test(vj) && /155: \['Lunar', 60000, 'stage'/.test(vj);
  const Q = new Function(page.slice(page.indexOf('const QUAL={'), page.indexOf('const setGet=')) + ';return {QUAL,QUAL_OLD}')();
  const pick = q => Q.QUAL[q] ? q : Q.QUAL_OLD[q] || 'high';   // as settings.js reads a saved setting
  const two = Object.keys(Q.QUAL).join() === 'high,low' && pick('medium') === 'low' && pick('low') === 'low' && pick('nonsense') === 'high'
    && /let quality=\(q=>QUAL\[q\]\?q:QUAL_OLD\[q\]\|\|'high'\)\(setGet\('launchpad-quality','high'\)\);/.test(page) && Object.values(Q.QUAL.low.fx).every(v => v === 0);
  check('reference views on the pad (the desk only in 152), through the Assembly screen, overlay hidden, the boom clock pinned; 152–158 the beauty moments; graphics Low/High (medium → Low)',
    pad && asm && clock && moments && two, `pad ${pad} · assembly ${asm} · clock ${clock} · moments ${moments} · low/high ${two}`);
}

// aerofx-9. The cloud deck at half resolution (look & sound effects beat, BEAUTY Q313). The 72-step slab march left the
// sky shader's main for its own pass (the sky's functions + SLAB_MAIN, two outputs) run after the depth pre-pass and
// before the sky, which upsamples it by depth and applies the air between; no pass, no volume (the flat shell). The
// pass profiler (profMark) is off by default and the frame timer stands aside while it runs.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const sky = page.slice(page.indexOf('const SKY_FS=`'), page.indexOf('`;', page.indexOf('const SKY_FS=`'))), main = sky.slice(sky.indexOf('void main(){'));
  const out = !/const int N=72/.test(main) && /texelFetch\(uSlabA,c,0\)/.test(main) && /exp\(-abs\(log\(1\.\+min\(bb\.z,1e9\)\)-lh\)\*6\.\)/.test(main) && /layout\(location=0\) out vec4 o;/.test(sky);
  const pass = /const SLAB_MAIN=`layout\(location=1\) out vec4 o2;/.test(page) && /const PSLAB=PDEPTH\?mkProg\(QUAD_VS,SKY_FS\.slice\(0,SKY_FS\.indexOf\('void main\(\)\{'\)\)\+SLAB_MAIN\):null;/.test(page)
    && /SLAB_MAIN=[\s\S]*?const int N=72;/.test(page) && /gl\.drawBuffers\(\[gl\.COLOR_ATTACHMENT0,gl\.COLOR_ATTACHMENT1\]\)/.test(page);
  const r = page.slice(page.indexOf('function render(){')), iD = r.indexOf("profMark('sky depth')"), iS = r.indexOf("profMark('cloud slab')"), iK = r.indexOf("profMark('sky');");
  const order = iD > 0 && iS > iD && iK > iS && /VK=CLOUD_VOL&&PSLAB&&mode!=='editor'/.test(r);
  const prof = /const PROF=\{on:false,/.test(page) && /function gpuTimerBegin\(\)\{if\(!TQ\|\|PROF\.on\)return;/.test(page) && (r.match(/profMark\(/g) || []).length >= 18;
  check('cloud deck: marched at half resolution in its own pass (depth pre-pass → slab → sky), upsampled by depth, out of SKY_FS main; volume needs the pass; pass profiler off by default',
    out && pass && order && prof, `out of sky main ${out} · pass ${pass} · order ${order} · profiler ${prof}`);
}

// aerofx-10. The HDR scene (look & sound effects beat, BEAUTY Q314). No shader tone-maps itself any more: the frame is
// drawn in linear light into an RGBA16F target on both settings, and the composite does bloom (no threshold), the
// exposure, a vignette, AgX, the grade LUT and grain, once. The exposure is read back without stalling (a pixel-pack
// buffer and a fence) and eased; the reference views settle it at once; map lines divide by it.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const shaders = [...page.matchAll(/const ([A-Z_]+_FS)=`([\s\S]*?)`;/g)].filter(m => m[1] !== 'COMP_FS' && m[1] !== 'BV_FS');
  const selfTm = shaders.filter(m => /aces\(|2\.51\*c|pow\(c(ol)?,vec3\(1\.\/2\.2\)\)|1\.-exp\(-C\)/.test(m[2])).map(m => m[1]);
  const comp = page.slice(page.indexOf('const COMP_FS=`'), page.indexOf('`;', page.indexOf('const COMP_FS=`')));
  const once = /vec3 agx\(vec3 c\)/.test(comp) && /texture\(uLut,agx\(c\)/.test(comp) && /c\*=uE\*/.test(comp) && /uGr/.test(comp);
  const target = /renderbufferStorageMultisample\(gl\.RENDERBUFFER,ns,HDR_RT\?gl\.RGBA16F:gl\.RGBA8,w,h\)/.test(page) && /function bloomBegin\(w,h\)\{SCN\.on=false;const T=sceneTarget/.test(page);
  const expo = /gl\.fenceSync\(gl\.SYNC_GPU_COMMANDS_COMPLETE,0\)/.test(page) && /gl\.readPixels\(0,0,c\.w,c\.h,gl\.RGBA,gl\.FLOAT,0\)/.test(page) && /function expoNow\(\)/.test(page)
    && /uniform1f\(PLINE\.u\.uLk,1\/EXPO\.E\)/.test(page) && /expoNow\(\); render\(\)/.test(vj);
  check('HDR scene: no shader tone-maps itself; linear RGBA16F target on both settings; one composite (bloom, exposure, AgX, LUT, grain); exposure read back without a stall',
    selfTm.length === 0 && once && target && expo, `self-tone-mapping ${selfTm.join(', ') || 'none'} · composite ${once} · target ${target} · exposure ${expo}`);
}

// aerofx-11. Re-entry, the hull glows (look & sound effects beat, BEAUTY Q318 B4.1–4.2). The windward skin's surface
// temperature follows the plasma's heat level k (wallT: the sim's p.T is the part's bulk and peaks far lower), eases in
// over ~2 s and out over ~6 s, on the ship and on falling stages, and goes to MESH_FS as uHt. The shader's blackbody (a
// Wien fit per channel, scene units with sunlit white paint ≈ 4) is invisible at 1,000 K, a dull red at 1,200 K, out-glows
// sunlit paint at 1,700 K (k ≈ 1, a low-orbit return) and is yellow-white at 2,200 K (k ≈ 1.5, from Selene).
// The plasma's stagnation point is white-yellow and its edge lavender; plasmaLight takes the core's colour.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const wl = page.match(/const wallT=(k=>[^,]+),/), w = wl && new Function('return ' + wl[1])();
  const fs = page.match(/emis\+=\.85\*exp\(vec3\(([^)]*)\)-vec3\(([^)]*)\)\/Tl\)/), A = fs && fs[1].split(',').map(Number), X = fs && fs[2].split(',').map(Number);
  const bb = T => A.map((a, i) => .85 * Math.exp(a - X[i] / T)), Y = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  const c10 = fs && bb(1000), c12 = fs && bb(1200), c17 = fs && bb(1700), c22 = fs && bb(2200);
  const wired = /hotTo\(m,kH,dt\);if\(kH>0&&sp>1\)m\.cd=/.test(page) && /const kH=d\.body\.atm\?DEBH\.get\(d\)\?\.k\|\|0:0;/.test(page) && /g\.k=0;if\(g\.q<1\.5e4\)continue;const k=g\.k=/.test(page)
    && /HTA\[i\]=m\.hot\|\|0/.test(page) && /gl\.uniform4fv\(u\['uHt\[0\]'\],HTA\)/.test(page) && /float ht=uHt\[pi\/4\]\[pi%4\];/.test(page);
  const plasma = /vec3 cs=mix\(ce,cc,/.test(page) && /c=\[1,\.45\+\.41\*b,\.12\+\.5\*b\]/.test(page);
  check('re-entry hull glow: skin temperature from the heat level, eased, on ship and stages; a blackbody that is dark at 1,000 K, dull red at 1,200 K, brighter than sunlit paint at 1,700 K, yellow-white at 2,200 K; the plasma white-yellow at the stagnation point',
    w && w(0) === 290 && w(1) === 1700 && w(1.5) === 2200 && wired && plasma && Y(c10) < 1e-3 && Y(c12) < .05 && c12[0] > 5 * c12[1] && Y(c17) > 4 && c22[1] / c22[0] > .25 && Y(c22) > 30,
    fs ? `luminance (sunlit white ≈ 4): 1,000 K ${Y(c10).toExponential(1)}, 1,200 K ${Y(c12).toFixed(3)}, 1,700 K ${Y(c17).toFixed(1)}, 2,200 K ${Y(c22).toFixed(0)}; g/r at 2,200 K ${(c22[1] / c22[0]).toFixed(2)} · wired ${wired} · plasma ${plasma}` : 'shader glow not found');
}

// aerofx-12. The craft's quick wins (look & sound parts & pad beat, BEAUTY B1.1–1.2, Q315). Bells follow Rao's parabola from the
// throat (steep) to the lip (θe), same exit radius and throat as the part; the nose is a tangent ogive (tangent to the
// hull, a point at its top); lathe normals are smooth along a curve and hard at a real edge; the body below is a disc of
// light: at the pad the old hemisphere (same ground colour), from orbit smaller and blue-white, with its limb.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const F = new Function('SMOOTH_FX', 'SMOOTH_DEG', body('raoBell') + body('ogive') + body('latheN') + ';return {raoBell,ogive,latheN}')(true, 24);
  const b = F.raoBell(.6, .15, .7, .72, 8, [0, 0, 0, 1], [1, 1, 1]), sl = i => (b[i + 1][0] - b[i][0]) / (b[i + 1][1] - b[i][1]);
  const bell = b.length === 8 && b[0][0] === .6 && b[0][1] === 0 && Math.abs(b[7][0] - .15) < 1e-9 && Math.abs(b[7][1] - .7) < 1e-9
    && b.every((p, i) => !i || p[0] < b[i - 1][0] && p[1] > b[i - 1][1]) && Math.abs(Math.atan(-sl(0)) * 180 / Math.PI - 8) < 5 && Math.atan(-sl(6)) * 180 / Math.PI > 45;
  const og = F.ogive(.625, 1.6, 1.25, [1], [0]), nose = og[0][0] === .625 && og[og.length - 1][0] < 1e-6 && og.every((p, i) => !i || p[0] <= og[i - 1][0]) && Math.abs(og[1][0] - .625) < .025;
  const E = F.latheN([[.625, 0], [.625, 1], [.3, 1.4], [0, 1.5]]), Ec = F.latheN(og);
  const smooth = E[0][1][0] === 1 && E[1][0][1] > .5 && Ec[2][1][0] === Ec[3][0][0] && Ec[5] === null && Ec[4][1][0] === Ec[6][0][0];   // shoulder hard; ogive and its colour band smooth
  const geo = /lathe\(out,BELL_FX&&RB&&ti===1\?raoBell\(/.test(pg) && /case'cone':lathe\(out,OGIVE_FX\?ogive\(/.test(pg);
  const fs = pg.slice(pg.indexOf('const MESH_FS=`'), pg.indexOf('`;', pg.indexOf('const MESH_FS=`')));
  const shader = /amb=mix\(uSky,uGnd,wp\)/.test(fs) && /uLimb\*exp\(-lb\*lb\*4\.\)/.test(fs) && /gl\.uniform4fv\(m\.uDsk,E\.dsk\)/.test(H) && /gl\.uniform4fv\(m\.uDsk,\[1,0,\.2,0\]\)/.test(H);
  const SM = new Function(src + 'return {TELLUS,SUN_DIR,norm,len,dot,madd,clamp}')();
  const L = new Function('airlessFill', 'TELLUS', 'norm', 'len', 'dot', 'madd', 'clamp', 'SUN', 'PLANET_FX', body('diskOf') + body('lightEnv') + ';return lightEnv')(
    () => null, SM.TELLUS, SM.norm, SM.len, SM.dot, SM.madd, SM.clamp, SM.SUN_DIR, true);
  const Lo = new Function('airlessFill', 'TELLUS', 'norm', 'len', 'dot', 'madd', 'clamp', 'SUN', 'PLANET_FX', body('diskOf') + body('lightEnv') + ';return lightEnv')(
    () => null, SM.TELLUS, SM.norm, SM.len, SM.dot, SM.madd, SM.clamp, SM.SUN_DIR, false);
  const at = h => SM.norm([SM.SUN_DIR[0] + .3, SM.SUN_DIR[1], SM.SUN_DIR[2] + .3]).map(x => x * (SM.TELLUS.R + h));
  const pad = L(at(2)), padO = Lo(at(2)), leo = L(at(200e3)), far = L(at(4e6));
  const light = Math.abs(pad.gnd[0] - padO.gnd[0]) < .01 && pad.dsk[0] > .99 && leo.gnd[2] > leo.gnd[0] && leo.dsk[0] < .9 && far.dsk[0] < leo.dsk[0] && leo.limb[2] > 0 && pad.limb[2] < .01;
  check('craft quick wins: Rao bells (steep at the throat, θe at the lip), tangent ogive nose, smooth profile normals with hard edges; the planet as a disc of light (the pad unchanged, blue-white and smaller from orbit)',
    bell && nose && smooth && geo && shader && light, `bell ${bell} · nose ${nose} · normals ${smooth} · geometry ${geo} · shader ${shader} · light ${light} (pad gnd ${pad.gnd[0].toFixed(3)} vs ${padO.gnd[0].toFixed(3)}, LEO ${leo.gnd.map(x => x.toFixed(3))} disc ${leo.dsk[0].toFixed(3)})`);
}

// aerofx-13. The flames, slice 1 (look & sound effects beat, BEAUTY Q319 B2.1–2.6). A plume's gas cools as it expands, so
// its own glow falls with the widening, (re/rb)^1.6, unless air mixes in; sunlight scattered by the exhaust (forward
// Henyey–Greenstein, g 0.7) lights it instead, in the planet's shadow not at all. The sea-level core is turbulent; shock
// diamonds strengthen off design and the first has a Mach disk; a kerolox root wears a dark curtain; a hypergolic start puffs
// brown. The contrail runs to ~33 km with up to 4,000 puffs, in a wind that turns with height and peaks near 11 km.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const fs = page.slice(page.indexOf('const PLUME_FS=`'), page.indexOf('`;', page.indexOf('const PLUME_FS=`')));
  const shader = /float cool=mix\(pow\(min\(1\.,re\/b\),1\.6\),1\.,max\(uS\.w,uSc\.y\)\);/.test(fs) && /\*\.18\*cool\)/.test(fs) && /\+sunS\*uSc\.x\*uI\*prof\*d\*fade/.test(fs)   // (Q642) × the propellant's scatter; a solid stays hot
    && /ph=\.5\*\(\.51\/pow\(1\.49-1\.4\*cs,1\.5\)\+1\.\)\/12\.566/.test(fs) && /if\(k==1\.\)dm\+=od\*2\.\*exp/.test(fs) && /\(uK\.w\+uPf\)\*rich/.test(fs) && /\(\.65\+\.7\*ne\)/.test(fs);
  const wired = /gl\.uniform3fv\(pu\.uSunL,qrot\(qconj\(Q\),SUN\)\);gl\.uniform3fv\(pu\.uSunC,PSUN\)/.test(page) && /PSUN=lightEnv\(p\)\.sun\.map\(x=>x\*lit\(p\)\)/.test(page)
    && /gl\.uniform1f\(pu\.uPf,P\.pf\|\|0\)/.test(page) && /const K=PLUME_LK\*/.test(page);
  const pr = page.match(/hypergolic:\{[^}]*so:\[([^\]]*)\][^}]*pf:([\d.]+)\}/), so = pr && pr[1].split(',').map(Number);
  const brown = pr && +pr[2] > 0 && so[2] > so[1] && so[1] > so[0];
  const hg = cs => .5 * (.51 / Math.pow(1.49 - 1.4 * cs, 1.5) + 1) / 12.566, fwd = hg(1) / hg(-1);
  const trail = /rho<0\.006\)return;/.test(page) && /smoke\.length>SMOKE_MAX\)smokeDrop\(smoke\);/.test(page) && /life:TRAIL_LIFE\*\(1\+\.3\*Math\.random\(\)\),/.test(page)   /* (Q566) the trail's life and list: aerofx-55 */
    && /Math\.exp\(-\(\(\(h-11000\)\/4000\)\*\*2\)\),th=h\/6000/.test(page) && !/q\.wf/.test(page);
  check('flames slice 1: vacuum glow cools with expansion, sunlight scatters forward (none in shadow), turbulent core, Mach disk, kerolox curtain, a brown hypergolic puff; a longer, sheared contrail',
    shader && wired && brown && fwd > 10 && trail, `shader ${shader} · wired ${wired} · hypergolic puff ${brown} (so ${so}) · forward/back scattering ${fwd.toFixed(0)}× · contrail ${trail}`);
}

// aerofx-14. The air and the wake (look & sound effects beat, BEAUTY Q320 B3.1–3.2, B4.3–4.4). Vapor collars are stacked
// thin rings with sharp trailing edges that flicker; the camera buffets through max-q (worst near Mach 1) and rumbles in
// re-entry, deterministic on sim time and off in the map; the ship sheds sparks of ablator from its hot face; the plasma
// wake flickers in ragged streamers and its light flickers with it.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const vfs = page.slice(page.indexOf('const VAPOR_FS=`'), page.indexOf('`;', page.indexOf('const VAPOR_FS=`')));
  // (PLAYTEST #88) the rings read as separate bands: now one streaked sheet hugging the hull, flickering as a whole, a thin
  // mist, from the strongest shoulder only
  const rings = !/fract\(rn\)/.test(vfs) && /\(\.75\+\.5\*st\)\*fl;\}/.test(vfs) && /dens\*uV\*1\.\/max/.test(vfs) && /x\[2\]>=\.9\*a\[0\]\[2\]/.test(page);
  const cs = page.match(/const SHK=\{[^\n]*\nfunction camShake\(\)\{[\s\S]*?\n  return\[[^\n]*\]\}/), env = { SHAKE_FX: true, SHAKE_LV: 1, mode: 'flight', view: 'ship', simT: 12.3,
    sstep: (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }, clamp: (x, a, b) => Math.min(b, Math.max(a, x)), plasmaHeat: () => 0 };
  const shake = cs && (S => new Function(...Object.keys(env), 'S', cs[0] + ';return camShake()')(...Object.values(env), S));
  const amp = r => r ? Math.hypot(r[0], r[1]) : 0, ship = (M, q) => ({ alive: true, body: { atm: 1 }, mach: M, qdyn: q, r: [], v: [], qHeat: 0, parts: [] });
  const calm = shake && shake(ship(.3, 2e3)), maxq = shake && shake(ship(1, 32e3)), sup = shake && shake(ship(2, 32e3)), again = shake && shake(ship(1, 32e3));
  const wired = /const sh=camShake\(\);if\(sh\)\{Fw=norm\(add\(Fw/.test(page) && /SPK\.n\+=dt\*kH\*\(abl\?45:12\)/.test(page) && /fxPuff\(madd\(S\.r,u,S\.radius\*\.8\)/.test(page)
    && /PLT\.c\.set\(c\.map\(x=>x\*K\*fl\)\)/.test(page) && /xe\/\(uEp\*3\.\)-uT\*11\./.test(page);
  check('the air and the wake: one thin flickering vapor collar per stack (PLAYTEST #88); a max-q buffet worst near Mach 1, none in calm air, repeatable; ship sparks, a ragged wake and a flickering plasma light',
    rings && wired && calm === null && amp(maxq) > 0 && amp(maxq) < 0.01 && Math.abs(amp(maxq) - amp(again)) < 1e-12 && amp(maxq) > amp(sup),
    `rings ${rings} · wired ${wired} · shake: calm ${calm} · max-q at M 1 ${amp(maxq).toFixed(4)} rad · at M 2 ${amp(sup).toFixed(4)} rad`);
}

// aerofx-15. A structural failure shows (look & sound effects beat, QUEUE Q294, PLAYTEST #75). The sim calls HOOK.crack at
// the broken joint and logs the cause; the page sprays sparks and shards there, a broken tank vents until its propellant
// is gone, and a well-filled one in air bursts into a fireball sized by what it holds.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const sim = /logEv\('structure',`\$\{p\.d\.name\} \/ \$\{p\.parent\.d\.name\} failed in/.test(src) && /HOOK\.crack\(s,p\);[^\n]*\n\s*detach\(s,subtree\(p\)/.test(src) && /crack\(\)\{\}/.test(src);
  const page2 = /HOOK\.crack=\(s,p\)=>/.test(page) && /if\(air>\.05&&m>\.2\*t\.cap\.fuel\)HOOK\.boom\(b,J,simT,clamp\(Math\.cbrt\(m\/500\),\.5,3\)\)/.test(page) && /VENTS\.push\(\{t,up,m0:m,m,air\}\)/.test(page)
    && /ventTick\(dt\);/.test(page) && /out=Math\.min\(V\.m,dt\*V\.m0\/6\)/.test(page);
  // and the sim really calls it: an Orbiter broadside at 600 m/s through the air (core's structural test) breaks somewhere
  let crack = null; api.HOOK.crack = (s, p) => { crack = p.d.name + ' / ' + p.parent.d.name };
  api.t = 0; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; api.HOOK.msg = () => {}; s.landed = false; s.r = [TELLUS.R + 3000, 0, 0]; s.v = add(api.surfVel(TELLUS, s.r), [0, 0, -600]);
  for (let k = 0; k < 500 && !crack; k++) api.advPhys(s);
  api.HOOK.crack = () => {};
  check('structural failure: the sim calls HOOK.crack at the broken joint and logs it; the page sprays shards, vents a broken tank, bursts a loaded one in air',
    sim && page2 && !!crack, `sim ${sim} · page ${page2} · a broadside Orbiter cracked at ${crack || 'nothing'}`);
}

// aerofx-16. A splash at splashdown (look & sound effects beat, QUEUE Q267, PLAYTEST #67): the moment the craft hits the
// sea (s.wet), once, spray thrown up and out and a ring racing across the surface, scaled by touchdown speed and mass.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const fn = page.match(/function splashFx\(s\)\{[\s\S]*?\/\/ the ring/);
  const once = /if\(S\.wet&&!S\.mkSplash\)\{S\.mkSplash=true;splashFx\(S\)\}/.test(page);
  const scaled = fn && /k=clamp\(\(s\.touchV\|\|5\)\/8\*Math\.sqrt\(s\.mass\/3000\),\.3,2\.5\)/.test(fn[0]) && /i<90\+110\*k/.test(fn[0]) && /fxPuff\(madd\(madd\(P,h,r0\),up,\.2\)/.test(fn[0]);
  const wetSet = /if\(!s\.wet\)\{if\(!touchdown\(s\)\)return;s\.wet=true;/.test(src);
  check('splashdown: spray and a racing ring once, when the sim sets s.wet, scaled by speed and mass', once && scaled && wetSet, `once ${once} · scaled ${!!scaled} · sim sets s.wet ${wetSet}`);
}

// aerofx-17. Heat haze (look & sound effects beat, BEAUTY Q319 B2.6): High only. Each jet firing in air adds a screen
// segment (up to four) that the composite looks the scene up a little off along, in ripples that scroll down the jet.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const comp = page.slice(page.indexOf('const COMP_FS=`'), page.indexOf('`;', page.indexOf('const COMP_FS=`')));
  const shader = /if\(uHn>0\)\{/.test(comp) && /uv\+=off\*vec2\(1\.\/as,1\.\)\*\.5;\}\n vec3 c=fin\(texture\(uS,uv\)\.rgb\);/.test(comp);
  const wired = /HAZE\.n=0;/.test(page) && /if\(S\.body\.atm\)hazeAdd\(VP,o,qrot\(Q,\[0,-1,0\]\),L,e\.d\.exit,R,thr\*Math\.min\(1,pa\*3\),W\/H,tanY\)/.test(page)
    && /gl\.uniform1i\(c\.uHn,HAZE\.n\)/.test(page) && /high:\{[^}]*HAZE_FX:1\}/.test(page) && /HAZE_FX=!!f\.HAZE_FX;/.test(page) && !/low:\{[^}]*HAZE_FX:1/.test(page);
  const fn = page.match(/function hazeAdd\([\s\S]*?\n  HAZE\.a\.set[^\n]*\}/), HZ = { n: 0, a: new Float32Array(16), b: new Float32Array(16) };
  const add2 = fn && new Function('HAZE_FX', 'HAZE', 'madd', fn[0] + ';return hazeAdd')(true, HZ, (a, d, k) => a.map((x, i) => x + d[i] * k));
  const VP = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, -1, 0, 0, -.2, 0];   // looking down −z, w = distance
  if (add2) { for (let i = 0; i < 6; i++) add2(VP, [0, 0, -50], [0, -1, 0], 20, .5, 3, 1, 1.6, 1); add2(VP, [0, 0, 50], [0, -1, 0], 20, .5, 3, 1, 1.6, 1) }
  const proj = add2 && HZ.n === 4 && Math.abs(HZ.a[0]) < 1e-9 && HZ.a[3] < HZ.a[1] && HZ.b[1] > HZ.b[0];
  check('heat haze: on High only, up to four jets in air, projected to screen segments that widen down the jet; the composite looks the scene up off them',
    shader && wired && proj, `shader ${shader} · wired ${wired} · projection ${proj} (n ${HZ.n}, behind the camera skipped)`);
}

// aerofx-18. No bands at the terminator (look & sound effects beat, QUEUE Q352, PLAYTEST #87): the sky's view-ray march
// starts each pixel's 12 steps at its own offset (interleaved gradient noise), so the count of steps in the planet's
// shadow no longer steps in unison across the terminator. (Q250) Only from above 15–50 km: low down it hatched the day sky.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const sc = page.slice(page.indexOf('vec3 scatter(vec3 d,float tMax,out vec3 trans){'), page.indexOf('return SUNI*(sR*BR*pR+sM*BM*pM);}'));
  const jit = /jt=mix\(\.5,fract\(52\.9829189\*fract\(dot\(gl_FragCoord\.xy,vec2\(\.06711056,\.00583715\)\)\)\),smoothstep\(15e3,50e3,length\(uPc\)-uPR\)\*step\(\.5,abs\(s0-s1\)\+abs\(s1-s2\)\)\)/.test(sc) && /float t=t0\+\(float\(i\)\+jt\)\*ds;/.test(sc) && !/\(float\(i\)\+\.5\)\*ds;vec3 p=d\*t-uPc/.test(sc);
  check('the terminator from orbit: scatter\'s view-ray steps are jittered per pixel, so the shadowed-step count no longer draws bands', jit, `jittered ${jit}`);
}

// aerofx-19. A plume light per side of a wide rocket (look & sound effects beat, BEAUTY Q319 B2.5): engines spread over
// 2.5 m split across their widest spread into two lights (the core between them feeds both); the mesh and smoke shaders
// take the second light; the ground pool takes the total; an explosion or the plasma taking over clears it.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const shaders = (page.match(/uniform vec4 uPl,uPl2;uniform vec3 uPlC,uPlC2;/g) || []).length === 2 && /if\(uPlC2\.r\+uPlC2\.g>0\.\)\{vec3 L=uPl2\.xyz-vP;/.test(page) && /uPlC2\*\.18\/\(dot\(L2,L2\)/.test(page);
  const split = /let ax=null,dm=2\.5;/.test(page) && /if\(Math\.abs\(t\)<\.35\)\{const h=\{\.\.\.r,w:r\.w\/2,ce:r\.ce\.map\(x=>x\/2\)\}/.test(page) && /sum\(G2\[0\],PLT\.p,PLT\.c\);sum\(G2\[1\],PLT\.p2,PLT\.c2\)/.test(page);
  const wired = /gl\.uniform4fv\(m\.uPl2,PLT\.p2\);gl\.uniform3fv\(m\.uPlC2,PLT\.c2\)/.test(page) && /gl\.uniform4fv\(su\.uPl2,PLT\.p2\);gl\.uniform3fv\(su\.uPlC2,PLT\.c2\)/.test(page)
    && /gl\.uniform3f\(u\.uPlC,PLT\.c\[0\]\+PLT\.c2\[0\]/.test(page) && (page.match(/PLT\.c2\[2\]\)return;PLT\.c2\.fill\(0\);/g) || []).length === 2 && /PLT\.c\.fill\(0\);PLT\.c2\.fill\(0\);PLT\.g=null;/.test(page);
  check('plume light per side: a wide rocket gets two lights (the core feeding both), shaders take both, the pool the total, a flash or the plasma clears the second',
    shaders && split && wired, `shaders ${shaders} · split ${split} · wired ${wired}`);
}

// aerofx-22. The space sky (look & sound sky & bodies beat, BEAUTY Q321 B5, W39; mockups/sky/). The band, a nebula and a
// spiral are baked once per program into a cube map (GAL_FS, galBake on unit 12) and SKY_FS's main only samples it; the
// stars are three power-law layers with a floor and a twinkle; the sun has no spikes; SKY_B5 keeps the old code for an
// A/B. Each program's nebula sits 22° off the band's midline and its spiral 40° off, for any seed.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const SM = new Function(src + 'return {rng,norm,add,sub,mul,dot,WSEED}')();
  const mk = new Function('rng', 'norm', 'add', 'sub', 'mul', 'dot', body('makeGal') + body('galSights') + ';return makeGal')(SM.rng, SM.norm, SM.add, SM.sub, SM.mul, SM.dot);
  const offs = [1, 2, 7, 12345, SM.WSEED].map(seed => { const g = mk(seed), a = v => Math.asin(Math.abs(SM.dot(v, g.gx))) * 180 / Math.PI; return [a(g.nd), a(g.sd)] });
  const placed = offs.every(([n, s]) => Math.abs(n - 22) < .01 && Math.abs(s - 40) < .01);
  const sky = /const SKY_B5=true;/.test(pg) && /vec3 galaxy\(vec3 d,out float band\)\{vec4 g=texture\(uGalC,d\);/.test(pg) && /uniform samplerCube uGalC;/.test(pg)
    && /\$\{SKY_B5\?`/.test(pg) && /pow\(abs\(cos\(a\*2\.\)\),600\.\)/.test(pg);   // the new code, and the old one kept behind SKY_B5
  const bake = /const GAL_FS=`/.test(pg) && /function galBake\(\)/.test(pg) && /gl\.TEXTURE_CUBE_MAP_POSITIVE_X\+f/.test(pg) && /gl\.generateMipmap\(gl\.TEXTURE_CUBE_MAP\)/.test(pg)
    && /if\(!desk&&SKY_B5\)galBake\(\);/.test(pg) && /gl\.uniform1i\(u\.uGalC,12\)/.test(pg) && /Math\.max\(1,1\.2\/EXPO\.E\)/.test(pg);
  const newSun = (() => { const i = pg.indexOf('${SKY_B5?`'), j = pg.indexOf('`:`', i); const n = pg.slice(i, j); return /float th=\(k==0\?\.9967/.test(n) && /tw=max\(1\.\+\.35\*/.test(n) && !/cos\(a\*2\.\)/.test(n) })();
  check('space sky: band, nebula and spiral baked to a cube once per program (unit 12), SKY_FS samples it; sharp stars with a floor and a twinkle; no sun spikes; nebula 22° and spiral 40° off the band for any seed; the old code kept behind SKY_B5',
    placed && sky && bake && newSun, `offsets (nebula, spiral °) ${offs.map(o => o.map(x => x.toFixed(1)).join('/')).join(', ')} · shader ${sky} · bake ${bake} · new stars/sun ${newSun}`);
}

// aerofx-20. An incoming fragment and its strike (look & sound effects beat, QUEUE Q302): HOOK.fragIn's fragment is drawn
// as a sunlit streak on its path, at the strike a flash and sparks; and the plasma light can't go NaN when the heat flux
// is unset (a NaN light turned every smoke puff in vacuum black).
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const draw = /HOOK\.fragIn=\(s,x\)=>\{FRAGS\.push\(\{s,x\}\)\}/.test(page) && /function fragDraw\(VP,camW,lit\)/.test(page) && /fragDraw\(VP,camW,lit\);/.test(page)
    && /Pf=madd\(s\.r,x\.dir,-x\.vr\*left\),Pt=madd\(Pf,x\.dir,-x\.vr\*\.06\)/.test(page) && /if\(left<-\.5\)\{FRAGS\.splice\(i,1\);continue\}/.test(page);
  const ph = page.match(/function plasmaHeat\(b,r,v,q\)\{[^\n]*\}/), env = { len: a => Math.hypot(...a), sub: (a, b) => a.map((x, i) => x - b[i]), surfVel: () => [0, 0, 0], clamp: (x, a, b) => Math.min(b, Math.max(a, x)), PLASMA_V: 1000 };
  const heat = ph && new Function(...Object.keys(env), ph[0] + ';return plasmaHeat')(...Object.values(env));
  const noNaN = heat && heat({}, [0, 0, 0], [3000, 0, 0], undefined) === 0 && /const qE=plasmaHeat\(S\.body,S\.r,S\.v,S\.qHeat\);if\(!\(qE>1\.5e4\)\)return;/.test(page);
  const sim = /HOOK\.fragIn&&HOOK\.fragIn\(s,s\.fragIn\)/.test(src);
  check('incoming fragment: drawn on its path as a sunlit streak, a flash and sparks at the strike; no NaN plasma light when the heat flux is unset',
    draw && noNaN && sim, `draw ${draw} · no NaN ${noNaN} · sim hands it over ${sim}`);
}

// aerofx-21. A spent stage under its chutes, and anything afloat (look & sound effects beat, QUEUE Q335): one canopy per
// chute part trailing up the airflow while the sim's d.chA is open; a stage that comes down in the sea splashes once
// (Q267's splash, at the speed it had) and, like the ship afloat, laps the sea along its waterline.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const can = /function debrisCanopies\(d,camW,drawMesh\)/.test(page) && /for\(const d of debris\)if\(d\.chA>0&&!d\.float\)debrisCanopies\(d,camW,drawMesh\);/.test(page) && /drawMesh\(CANOPY,modelQ\(q,sub\(P,camW\),0,\[k,k\*\.6,k\]\),P\)/.test(page);
  const sea = /if\(!d\.mkSplash\)\{d\.mkSplash=true;splashFx\(\{body:d\.body,r:d\.r,touchV:d\.mkV\|\|10,mass:d\.mass,radius:d\.mkR\}\)\}surfFx\(d,/.test(page)
    && /if\(S\.landed&&S\.water\)surfFx\(S,b,S\.r,S\.q,/.test(page) && /function surfFx\(o,b,r,q,L0,rad,dt\)/.test(page);
  const sim = /d\.chA=/.test(src) && /d\.float=\{pf:pfc/.test(src);
  check('falling stage: a canopy per chute while d.chA is open; at sea a splash once, then the waterline laps (stage and ship)', can && sea && sim, `canopies ${can} · sea ${sea} · sim ${sim}`);
}

// sound-2. The effects' sounds (look & sound effects beat as sound overflow, QUEUE Q363, Q362): a venting tank hisses
// through our own structure even in vacuum and fades as it empties, from elsewhere only through the air; a structural
// crack (with a groan) and a splash are queued by the page (FXSND) and heard like booms; the radio blackout's edges sound
// (static cut dead going in; a squelch and a 2,525 Hz Quindar tone coming out).
{
  const H = html.replace(/\r\n/g, '\n'), blk = H.slice(H.indexOf('// ==== SOUND MIX BEGIN'), H.indexOf('// ==== SOUND MIX END'));
  const { sndVent } = new Function(blk + ';return {sndVent}')();
  const own = sndVent([{ rate: 1, own: true, air: 0, d: 0 }]), half = sndVent([{ rate: .25, own: true }]), vac = sndVent([{ rate: 1, own: false, air: 0, d: 50 }]),
    near = sndVent([{ rate: 1, own: false, air: 1, d: 50 }]), far = sndVent([{ rate: 1, own: false, air: 1, d: 5000 }]);
  const wired = /FXSND\.push\(\{k:'crack',b,r:J,/.test(H) && /FXSND\.push\(\{k:'splash',b,r:P,sz:k,own:s===S\}\)/.test(H) && /if\(live\)\{sndEvents\(st\);sndBooms\(\);sndFx\(\)\}/.test(H)
    && /sndBeep\(2525,0\.25,0\.12,0\.3\)/.test(H) && /const bo=S\.alive&&S\.body===TELLUS&&plasmaOn\(S\)/.test(H) && /set\(AUD\.VH\.g\.gain,0\.3\*sndVent\(st\.vents\)/.test(H);
  check('effects\' sounds: a vent hisses through our structure in vacuum and fades as it empties, from elsewhere only through air; crack, splash and the blackout\'s edges are wired',
    own === 1 && half === .5 && vac === 0 && near > .8 && far < .1 && wired, `own ${own}, quarter left ${half}, elsewhere in vacuum ${vac}, 50 m in air ${near.toFixed(2)}, 5 km ${far.toFixed(2)} · wired ${wired}`);
}

// sound-3. The Steppe rollout's sound (look & sound effects beat, QUEUE Q222): the car's rumble follows its speed (still at
// both ends, loudest mid-way), a double clack at each 12.5 m rail joint, the boom's pump whining up in pitch while it raises
// the rocket and the arms' rams after, a clunk as each phase ends; heard on the Rollout screen only.
{
  const H = html.replace(/\r\n/g, '\n'), blk = H.slice(H.indexOf('// ==== SOUND MIX BEGIN'), H.indexOf('// ==== SOUND MIX END'));
  const { sndRoll } = new Function(blk + ';return {sndRoll}')(), P = [7, 5, 1.5], L = 118;
  const a = sndRoll(0, P, L), m = sndRoll(3.5, P, L), e = sndRoll(7, P, L), b1 = sndRoll(8, P, L), b2 = sndRoll(11, P, L), ar = sndRoll(12.75, P, L), z = sndRoll(20, P, L);
  const ok = a.rumble === 0 && m.rumble === 1 && e.rumble === 0 && e.joint === Math.floor(L / 12.5) && a.hyd === 0 && m.hyd === 0 && b1.hyd > .45 && b2.hydF > b1.hydF
    && ar.hyd > 0 && ar.hyd < b1.hyd && z.hyd === 0 && z.rumble === 0 && z.done.every(Boolean) && !m.done[0] && e.done[0] && !b2.done[1];
  const wired = /RP=sc==='rollout'&&typeof rollPhase==='function'\?rollPhase\(\):null/.test(H) && /if\(ro\)sndRollEvents\(ro,RP\.t\)/.test(H) && /\(live\|\|ro\)\?AUD\.vol/.test(H)
    && /fire\('clack',SHOT\.clack\(/.test(H) && /fire\('clunk',SHOT\.clunk\(/.test(H);
  check('the Steppe rollout sounds: rumble with the car\'s speed, a clack per rail joint, the pump rising while the boom lifts, the arms after, a clunk per phase', ok && wired,
    `rumble ${a.rumble}/${m.rumble}/${e.rumble}, joints ${e.joint}, pump ${b1.hyd.toFixed(2)} at ${b1.hydF.toFixed(0)} → ${b2.hydF.toFixed(0)} Hz, arms ${ar.hyd.toFixed(2)} · wired ${wired}`);
}

// aerofx-23. Tellus from above (look & sound sky & bodies beat, BEAUTY Q323 B6.1, 6.3, 6.4). The cloud cover's far-field
// widening is even about the threshold's centre (it was lopsided: a blurred pixel came out ~4× cloudier than the ground
// under it), starts once the finest octave is under a pixel (fw × 15), and the coverage has a milder stretch, a
// patchiness term and latitude belts; sim/space.js cloudAt carries the same formula, so scrubs and photo windows follow
// the drawn weather. The sea has Fresnel sky light and a Beckmann sunglint; the city lights are read at their mip.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const fs = pg.slice(pg.indexOf('float cloudCovF('), pg.indexOf('float cloudCov(vec3 u)'));
  const shader = /vec3\(7\.,8\.75,7\.\)/.test(fs) && /belt=\.03\*/.test(fs) && /-\.05\*smoothstep\(\.16,\.26,la\)/.test(fs) && /\.18\*\(vn\(u\*2\.6/.test(fs)
    && /k=clamp\(fw\*15\.,0\.,\.3\);return smoothstep\(\.55-k,\.72\+k,c\)/.test(fs);
  const cpu = /\*7\+t,\(u\[1\]\+w\[1\]\*\.26\)\*8\.75/.test(src) && /belt=\.03\*\(1-ss\(0,\.16,la\)\)-\.05\*ss\(\.16,\.26,la\)/.test(src) && /\.18\*\(vn\(u\[0\]\*2\.6\+7/.test(src) && /x=clamp\(\(c-\.55\)\/\.17,0,1\)/.test(src);
  const sea = /Fr=\.02\+\.98\*pow\(1\.-cv,5\.\)/.test(pg) && /m2=\.0324/.test(pg) && /textureLod\(uCity,eq,max\(0\.,log2\(fw\/3900\.\)\)\)/.test(pg) && /gl\.generateMipmap\(gl\.TEXTURE_2D\);gl\.texParameteri\(gl\.TEXTURE_2D,gl\.TEXTURE_MIN_FILTER,gl\.LINEAR_MIPMAP_LINEAR\)/.test(pg);
  check('Tellus from above: even far-field cloud filter, milder stretch, patchiness and belts in the shader and in cloudAt alike; the sea\'s Fresnel and sunglint; city lights by mip',
    shader && cpu && sea, `shader ${shader} · cloudAt ${cpu} · sea and lights ${sea}`);
}

// aerofx-24. The exposure's highlight reads the brightest spot, not the blur (look & sound sky & bodies beat, QUEUE Q385):
// the bloom chain's alpha carries each block's max luminance down to 1/16, and expoMean's H is the 98th percentile of
// it, so a disc of small bright clouds on black space (blurred ~0.9, brightest ~2.2) is exposed for its clouds; hi 2.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const bl = pg.slice(pg.indexOf('const BLOOM_FS='), pg.indexOf('const COMP_FS='));
  const chain = /uniform int uMx;/.test(bl) && /texelFetch\(uT,min\(q\*2\+ivec2\(i,j\),sz\),0\)\.a/.test(bl) && /o=vec4\(c\/ws,min\(m,6e4\)\);/.test(bl)
    && /gl\.uniform1i\(u\.uMx,i===0\?0:1\)/.test(pg) && /gl\.uniform1i\(u\.uMx,2\)/.test(pg);
  const fn = (n, l) => { const i = pg.indexOf('function ' + n + '('); let j = i; for (let k = 0; k < l; k++) j = pg.indexOf('\n', j) + 1; return pg.slice(i, j) };   // its first l lines
  const ex = pg.slice(pg.indexOf('const EXPO={'), pg.indexOf('\n', pg.indexOf('const EXPO={')));
  const { EXPO, expoMean, expoTarget } = new Function(ex + '\n' + fn('expoTarget', 1) + fn('expoMean', 2) + ';return {EXPO,expoMean,expoTarget}')();
  const w = 120, h = 68, a = new Float32Array(w * h * 4);   // black space, a disc 20 blocks across: blurred 0.9, brightest 2.2
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - 60) ** 2 + (y - 34) ** 2 < 400) { const k = (y * w + x) * 4; a[k] = a[k + 1] = a[k + 2] = .9; a[k + 3] = 2.2 }
  const L = expoMean(a, w, h), E = expoTarget(L, EXPO.H);
  check('exposure: the highlight is each 1/16 block\'s brightest spot (the chain\'s alpha), so a bright disc on black is exposed for its clouds',
    chain && EXPO.hi === 2 && Math.abs(EXPO.H - 2.2) < 1e-6 && Math.abs(E - 2 / 2.2) < .01, `chain ${chain} · hi ${EXPO.hi} · H ${EXPO.H} · E ${E.toFixed(3)} (want ${(2 / 2.2).toFixed(3)})`);
}

// aerofx-25. The sunglint at full strength, and a view that shows it (look & sound sky & bodies beat, QUEUE Q387): the
// sea's Beckmann glint is no longer quartered (BRDF × cos, the same scale as the diffuse sea), and view 162 puts the
// ship 400 km over clear open sea with the sun ~40° up, looking down toward the sun.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const glint = /col\+=st\*5\.\*gl\*max\(ndl,0\.\)\+Fr\*/.test(pg) && !/gl\*max\(ndl,0\.\)\*\.25/.test(pg);
  const view = /if \(n === 162\)/.test(vj) && /Math\.sin\(40 \/ 57\.3\)/.test(vj) && /terrainH\(c\) > -1000/.test(vj) && /TELLUS\.R \+ 4e5/.test(vj);
  check('the sunglint at full strength (no quarter), and view 162 over clear open sea with the sun 40° up', glint && view, `glint ${glint} · view 162 ${view}`);
}

// aerofx-26. The air's transmittance table, and airglow (look & sound sky & bodies beat, BEAUTY Q322 B6.2): sunTrans and
// scatter's light toward the sun read a 256 × 64 table baked once (TRL_TEX, Bruneton's (r, mu) layout, unit 13) instead
// of marching (6 steps per call, 12 × 4 in scatter); below the horizon the ground hides the sun. A thin green airglow
// layer ~85 km up shows on the night limb only. View 163 looks at it.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const sky = pg.slice(pg.indexOf('const SKY_FS='), pg.indexOf('float sst(float a'));
  const table = /vec3 trL\(float r,float mu\)/.test(sky) && /return trL\(r,dot\(p,uSun\)\/r\);/.test(sky) && /\*trL\(r,b\/r\);/.test(sky) && !/for\(int j=0;j<[46];j\+\+\)/.test(sky)
    && /const TRL_TEX=/.test(pg) && /gl\.TEXTURE13/.test(pg) && /if\(u\.uTrL\)gl\.uniform1i\(u\.uTrL,13\)/.test(pg);
  const glow = /exp\(-pow\(\(hm-85e3\)\/5e3,2\.\)\)/.test(sky) && /smoothstep\(\.05,-\.2,dot\(normalize\(pt\),uSun\)\)/.test(sky);
  check('the air\'s transmittance from a table baked once (no march toward the sun), and airglow on the night limb (view 163)', table && glow && /if \(n === 163\)/.test(vj),
    `table ${table} · airglow ${glow} · view 163 ${/if \(n === 163\)/.test(vj)}`);
}

// aerofx-27. The bright stars' halo isn't cut at a cell's border (look & sound sky & bodies beat, PLAYTEST #96): starsAt
// draws the brightest layer's halo from the 2×2×2 cells nearest the pixel, each star kept by the band at its own place,
// and the halo fades to nothing within half a cell, which those cells always cover.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), sky = pg.slice(pg.indexOf('vec3 starsAt('), pg.indexOf('vec3 sunAt('));
  const ok = /vec3 c0=floor\(d\*90\.-\.5\);for\(int x=0;x<2;x\+\+\)for\(int y=0;y<2;y\+\+\)for\(int z=0;z<2;z\+\+\)/.test(sky) && /textureLod\(uGalC,sd,0\.\)\.a/.test(sky)
    && /\*smoothstep\(\.5\/90\.,\.15\/90\.,r\);/.test(sky) && !/if\(k==0&&br>1\.2\)c\+=/.test(sky);
  check('star halos: from the nearest 2×2×2 cells, fading out within half a cell (no straight edge at a cell border)', ok, `halo ${ok}`);
}

// aerofx-28. No aliasing on the clouds at liftoff (look & sound effects beat, QUEUE Q250, PLAYTEST #48): from low in
// the air the sky's view-ray march starts mid-step (the per-pixel offset drew a fixed hatch over the day sky, which
// crawled as the rocket climbed); the deck's billow detail fades once a pixel's footprint outgrows it, and the cloud
// volume's finest noise once the march's steps do.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const sky = /smoothstep\(15e3,50e3,length\(uPc\)-uPR\)\*step\(\.5,abs\(s0-s1\)\+abs\(s1-s2\)\)\);vec3 sR=vec3\(0\.\)/.test(page);
  const deck = /float fm=fw\*uCR;dn=\.5\+\(vn\(cu\*2600\.\+uCT\*3\.\)-\.5\)\*\.6\*\(1\.-smoothstep\(800\.,3200\.,fm\)\)\+\(vn\(cu\*7800\.\)-\.5\)\*\.4\*\(1\.-smoothstep\(250\.,1000\.,fm\)\)/.test(page);
  const vol = /float cdLod=0\.;/.test(page) && /mix\(vn\(w\/230\.\),\.5,cdLod\)/.test(page) && /cdLod=smoothstep\(230\.,700\.,ds\);float dn=cloudDens\(q\)/.test(page);
  check('clouds at liftoff: the sky march starts mid-step low down, the deck\'s detail fades by footprint and the volume\'s by step length', sky && deck && vol,
    `sky ${sky} · deck ${deck} · volume ${vol}`);
}

// aerofx-29. The igniter flashes when the engine lights, not when it is first drawn (look & sound effects beat, QUEUE
// Q368): the spool only moves on drawn frames; after more than half a second of sim time undrawn (a script stepping the
// physics, as the reference views do; the camera far away) it takes its target with no flash, rich start or puff, and a
// new flight (the clock going back) forgets the last frame.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const frame = /function spoolFrame\(\)\{if\(simT<SPOOL_F\[1\]\)SPOOL_F\[1\]=-1e9;if\(simT!==SPOOL_F\[1\]\)\{SPOOL_F\[0\]=SPOOL_F\[1\];SPOOL_F\[1\]=simT\}\}/.test(page) && /function render\(\)\{spoolFrame\(\);/.test(page);
  const gap = /sp=\{k:0,t:SPOOL_F\[0\],ig:-1e9,off:-1e9,tg:0\}\);const gap=simT-sp\.t,dt=clamp\(gap,0,5\);sp\.t=simT;/.test(page) && /if\(gap>\.5\)\{sp\.k=tg;sp\.tg=tg;return sp\}if\(sp\.k<\.02&&tg>0\)sp\.ig=simT;/.test(page);
  check('the igniter flash follows the ignition: an engine first drawn long after it lit takes its spool with no flash; a new flight forgets the last frame', frame && gap,
    `frames ${frame} · gap ${gap}`);
}

// aerofx-30. Selene out of the sky shader (look & sound sky & bodies beat, BEAUTY Q322 B6.5, Q250's Selene half): SKY_FS's
// main only finds Selene (its air in front, and in alpha how much the clouds let through); the moon pass (MOON_FS,
// drawMoons) shades it on top (blend DST_ALPHA, ONE), with every crater and fbm octave faded by the pixel's footprint, the
// relief's slope taken over the footprint, lunar-Lambert photometry, an opposition surge and earthshine. Nyx shares it.
// Views 164–168 look at it. The fade is checked numerically: from low Tellus orbit (a 13 px disc) no crater octave is left.
// (Q493, v1.242: the fade moved from w·f .25 → .6 to .06 → .2, see aerofx-48)
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const sky = pg.slice(pg.indexOf('const SKY_FS='), pg.indexOf('const SKY_FS=') + pg.slice(pg.indexOf('const SKY_FS=')).indexOf('}`;'));
  const mainSky = sky.slice(sky.lastIndexOf('void main(){')), moon = pg.slice(pg.indexOf('const MOON_FS='), pg.indexOf('const PMOON='));
  const out = !/crat\(/.test(mainSky) && /col=ins;vis=1\.;/.test(mainSky) && /o=vec4\(col,vis\);/.test(mainSky);
  const pass = /uSel>0\./.test(moon) && /blendFuncSeparate\(gl\.DST_ALPHA,gl\.ONE,gl\.ZERO,gl\.ONE\)/.test(pg) && /for\(const b of BODIES\)\{if\(!b\.parent\)continue;/.test(pg);
  const photo = /2\.42e-4\*g\*g/.test(moon) && /\.6\/\(1\.\+/.test(moon) && /es=100\.\*\.35\*/.test(moon) && /smoothstep\(\.06,\.2,w\*f\)/.test(moon) && /fbmF\(/.test(moon);
  // the footprint in Selene radii from 200 km over Tellus (fov 1 rad, 800 px) and the finest crater octave left
  const w = (3.844e7 - 1.274e6 - 2e5) * 2 * Math.tan(0.5) / 800 / 3.48e5, left = [12.6, 37.8, 113.4, 340.2, 1020.6].filter(f => w * f < 0.2).length;
  const w100 = 1e5 * 2 * Math.tan(0.5) / 800 / 3.48e5, left100 = [12.6, 37.8, 113.4, 340.2, 1020.6].filter(f => w100 * f < 0.2).length;
  check('Selene drawn by the moon pass, filtered by footprint, with lunar photometry and earthshine (views 164–168)', out && pass && photo && left === 0 && left100 >= 4 && /if \(n >= 164 && n <= 168\)/.test(vj),
    `out of SKY_FS ${out} · pass ${pass} · photometry ${photo} · crater octaves from low orbit ${left}, from 100 km ${left100}`);
}

// aerofx-31. Lettering on the pads (look & sound effects beat, QUEUE Q245): a 5×7 font built as boxes, one per run of lit
// pixels on a row; Coastal's agency name over its assembly building's door (two lines), Isle's company on the hangar's
// sign, from the site's owner; the pad is rebuilt (and cached) per power, so another owner's site shows its own name.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('const FONT57='), page.indexOf('function coastalPad('));
  const T = new Function('POWERS', src + 'const out=[],box=(o,c,hx,hy,hz)=>out.push({c,hx,hy});return {padText,padName,out}')([{ root: 'Asaro' }, { root: 'Mirtov' }]);
  T.padText(null, 'I', [0, 0, 0], 7, 100, 0); const I = T.out.splice(0);   // I: a bar of 3, five single pixels, a bar of 3
  T.padText(null, 'HÉ\nL', [0, 10, 0], 16, 100, 0); const two = T.out.splice(0), ys = two.map(b => b.c[1]);
  T.padText(null, 'WWWWWWWWWW', [0, 0, 0], 7, 5.9, 0); const fit = Math.max(...T.out.map(b => Math.abs(b.c[0]) + b.hx));
  const names = T.padName(3, 0) === 'Centre Spatial\nAsaro' && T.padName(5, 1) === 'Mirtov Launch Co' && T.padName(2, 0) === '' && T.padName(3, null) === '';
  const ok = I.length === 7 && I[0].hx === 1.5 && two.length > 15 && Math.max(...ys) - Math.min(...ys) > 8 && fit <= 2.95 + 1e-9 && names;
  const wired = /padText\(a,name,\[0,27\.95,-129\],3\.5,21,/.test(page) && /padText\(a,name,\[0,8\.9,-74\.9\],1\.05,16\.5,C\.W\)/.test(page)
    && /PADX\[x\]\|\|\(PADX\[x\]=buildPad\(32,k,pw\)\)/.test(page) && /sch\+'\|'\+curSite\(\)\.power\+'\|'/.test(page);
  check('lettering on the pads: a 5×7 font as boxes (runs merged, lines stacked, fitted to the width); Coastal\'s agency and Isle\'s company from the site\'s owner', ok && wired,
    `I ${I.length} boxes · two lines ${two.length} · width ${fit.toFixed(2)} of 2.95 · names ${names} · wired ${wired}`);
}

// aerofx-32. The volume cloud shadow baked (look & sound sky & bodies beat, QUEUE Q379, Q326's measurement): cloudShadowV
// no longer marches 5 cloudDens toward the sun per ground pixel; SHD_FS bakes the light through the slab from its base
// (2 km) on the coverage's grid, re-baked with the coverage or when the sun has turned 0.1° over the ground, and a ground
// point reads it where its sun ray reaches 2 km. (The pad's sky pass ~0.9 ms faster; the shadows match.)
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const f = pg.slice(pg.indexOf('float cloudShadowV('), pg.indexOf('void main(){', pg.indexOf('float cloudShadowV(')));
  const look = !/cloudDens\(/.test(f) && /texture\(uShd,uq\)\.r/.test(f) && /max\(2000\.-\(length\(p\)-uPR\),0\.\)\/s/.test(f);
  const bake = /const SHD_FS=/.test(pg) && /od\+=cloudDens\(P\+uSun\*\(float\(i\)\+\.5\)\*dt\)/.test(pg) && /dot\(sp,SHD\.sp\)>Math\.cos\(\.0017\)/.test(pg)
    && /if\(VK>0\)\{covBake\(camW\);shdBake\(\)\}/.test(pg) && /gl\.uniform1i\(u\.uShd,14\)/.test(pg);
  check('volume cloud shadow: baked once on the coverage grid (SHD_FS), a lookup per ground pixel', look && bake, `lookup ${look} · bake ${bake}`);
}

// aerofx-33. The planets in the sky, a moon under a pixel, stars by the sky's contrast, a faint airglow (look & sound sky
// & bodies beat, QUEUE Q374, Q395, Q407; PLAYTEST #11, #92, #103): planetSky turns each planet's magnitude (albedo,
// radius, distances, phase) into the stars' br and SKY_FS's planetsAt draws them; a moon whose disc is under 1.5 px is
// the moon pass's point with the whole disc's light; stars, planets and the galaxy lose SKY_CK × the sky's luminance
// behind them; the airglow's line is a quarter of v1.183's. Views 169 (the planets), 170 (Selene as a point), 171 (dusk).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const planets = /function planetSky\(T\)/.test(pg) && /-26\.74-2\.5\*Math\.log10\(/.test(pg) && /vec3 planetsAt\(vec3 d\)/.test(pg) && /planetsAt\(d\)/.test(pg) && /gl\.uniform1i\(u\.uNPl,P\.length\)/.test(pg);
  const point = /if\(pt&&\(aR>uPix\*1\.5\|\|th>uPix\*3\.\)\)discard;/.test(pg) && /\(aR\*aR\/\(rho\*rho\)\)/.test(pg) && /uMR<uPix\*1\.5\*length\(uMc\)/.test(pg);
  const contrast = /const SKY_CK=30;/.test(pg) && /stp\*=max\(0\.,1\.-Ys\//.test(pg) && /gl3\*=max\(0\.,1\.-Ys\//.test(pg);
  const glow = /vec3 glow=vec3\(\.3,1\.,\.4\)\*\.003\*ag\*/.test(pg);
  // the stars' scale: a magnitude −1.5 planet is the brightest star (br 2.45); five magnitudes fainter is 1 % of it
  const br = m => Math.min(8, 2.45 * 10 ** (-0.4 * (m + 1.5))), scale = Math.abs(br(-1.5) - 2.45) < 1e-9 && Math.abs(br(3.5) / br(-1.5) - 0.01) < 1e-9;
  check('the planets as points on the stars\' scale, a sub-pixel moon as a point, stars faded by the sky behind them, a faint airglow (views 169–171)',
    planets && point && contrast && glow && scale && /if \(n === 171\)/.test(vj) && /if \(n === 169 \|\| n === 170\)/.test(vj),
    `planets ${planets} · point ${point} · contrast ${contrast} · airglow ${glow} · scale ${scale}`);
}

// aerofx-34. A display rod under a hanging model (look & sound effects beat, QUEUE Q330): while parts below were removed
// the design hangs over the desk's base plate (BLD.foot, Q247); a steel rod rises from the plate's pin to its bottom, with
// a collar, and the desk mesh is rebuilt when the gap changes.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const ok = /\|\$\{\(S\.yBot-deskFoot\(\)\)\.toFixed\(2\)\}`;/.test(page) && /\{const g=S\.yBot-deskFoot\(\);if\(g>\.006\*k\)\{const ST=\[\.62,\.63,\.66,1\];lathe\(a,\[\[\.004\*k,\.004\*k,ST\],\[\.004\*k,g,ST\]\],\[0,0,0\],12\);/.test(page);
  check('a hanging model stands on a display rod from the base plate\'s pin to its bottom; the desk is rebuilt when the gap changes', ok, `rod ${ok}`);
}

// aerofx-35. A calmer camera shake, short jolts, and a choice (look & sound effects beat, QUEUE Q360, Q402; PLAYTEST #98;
// Caio 2026-10-13: "too intense and unpleasant to watch"): a sway at 1.5–4 Hz (no term faster than 26 rad/s, so nothing
// strobes against the frame rate), only from 15 kPa (transonic and peak q), at most ~0.12° at Mach 1's max-q on Gentle
// (was ~0.45°); a damped knock going through Mach 1 and at each staging; Settings › Screens › Off / Gentle / Full.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cs = page.match(/const SHK=\{[^\n]*\nfunction camShake\(\)\{[\s\S]*?\n  return\[[^\n]*\]\}/), base = { SHAKE_FX: true, SHAKE_LV: 1, mode: 'flight', view: 'ship',
    sstep: (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }, clamp: (x, a, b) => Math.min(b, Math.max(a, x)), plasmaHeat: () => 0 };
  // a run: f(t) gives the ship's state; returns the shake's size at each step (one closure, so SHK carries between calls)
  const run = (f, lv = 1, T = 20) => { const env = { ...base, SHAKE_LV: lv }; let simT = 0, S = null;
    const call = new Function(...Object.keys(env), 'get', cs[0] + ';return ()=>{const g=get();S=g.S;simT=g.t;return camShake()}');
    let cur; const go = call(...Object.values(env), () => cur); const out = [];
    for (let t = 0; t < T; t += 0.01) { cur = { S: f(t), t }; const r = (() => { const g = cur; return go() })(); out.push(r ? Math.hypot(r[0], r[1]) : 0) } return out };
  const mk = (M, q, n) => ({ alive: true, body: { atm: 1 }, mach: M, qdyn: q, r: [], v: [], qHeat: 0, parts: Array.from({ length: n }, () => ({ on: true })) });
  const keep = {}, steady = t => keep.s || (keep.s = mk(1, 32e3, 10)); Object.assign(keep, {});
  const peak = Math.max(...run(t => { const s = keep.a || (keep.a = mk(1, 32e3, 10)); return s }));
  const low = Math.max(...run(t => { const s = keep.b || (keep.b = mk(.5, 10e3, 10)); s.qdyn = 10e3; return s }));
  const stg = run(t => { const s = keep.c || (keep.c = mk(3, 1e3, 10)); s.parts.length = t < 5 ? 10 : 7; return s }), knock = Math.max(...stg.slice(500, 560)), after = Math.max(...stg.slice(700, 800));
  const full = Math.max(...run(t => keep.d || (keep.d = mk(1, 32e3, 10)), 2)), off = Math.max(...run(t => keep.e || (keep.e = mk(1, 32e3, 10)), 0));
  const rates = [...cs[0].matchAll(/Math\.sin\(t\*([\d.]+)/g)].map(m => +m[1]), slow = rates.length === 6 && Math.max(...rates) <= 26 && Math.min(...rates) >= 9;
  const sw = /SHAKE_LV=Math\.min\(2,Math\.max\(0,\+setGet\('launchpad-shake','1'\)\|\|0\)\);SHAKE_FX=SHAKE_LV>0;/.test(H) && /\['Off','Gentle','Full'\]\.map\(\(l,k\)=>`<button data-shake=/.test(H)
    && /if\(sk!=null\)\{SHAKE_LV=\+sk;SHAKE_FX=SHAKE_LV>0;setPut\('launchpad-shake',sk\)/.test(H);
  check('camera shake: a slow sway only round transonic and peak q, ~0.12° on Gentle; a knock at staging that dies within a second; Off / Gentle / Full kept per browser',
    slow && peak < .0025 && peak > .0012 && low === 0 && knock > .0008 && after === 0 && Math.abs(full / peak - 2) < .05 && off === 0 && sw,
    `rates ${rates.join(', ')} · peak ${(peak * 57.3).toFixed(3)}° · at 10 kPa ${low} · staging knock ${(knock * 57.3).toFixed(3)}°, 2 s on ${after} · full ×${(full / peak).toFixed(2)} · off ${off} · setting ${sw}`);
}

// aerofx-36. Effects stop with the pause (look & sound effects beat, QUEUE Q393, PLAYTEST #90): one effects clock (FXT,
// fxNow) that frame() advances by real time only while the game isn't paused; the plume, plasma, dust, impact and
// composite shaders, explosions' ages and light, and the stars' twinkle read it (HOOK.fxT still pins it for the views);
// none of them reads performance.now() any more.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const clock = /let FXT=0;const fxNow=\(\)=>HOOK\.fxT\?\?FXT;/.test(page) && /if\(!gamePaused\(\)\)FXT\+=dtR\*1000;/.test(page);
  const readers = [/gl\.useProgram\(PPLASMA\.p\);[^\n]*uT,fxNow\(\)\/1000%1000\)/, /gl\.useProgram\(PDUST\.p\);[^\n]*uT,fxNow\(\)\/1000%1000\)/, /function drawImpact[^\n]*uT,fxNow\(\)\/1000%1000\)/,
    /gl\.uniform1f\(c\.uT,fxNow\(\)%997\)/, /function boomLight\(camW\)\{const now=fxNow\(\);/, /const nowMs=fxNow\(\);/, /t0:fxNow\(\),sz,air/, /uStT,\(fxNow\(\)\/1000\)%1000\)/,
    /gl\.uniform1f\(pu\.uFc,FC\);gl\.uniform1f\(pu\.uT,fxNow\(\)\/1000%1000\);/].map(r => r.test(page));
  const stray = (page.match(/uT,performance\.now\(\)|t0:performance\.now\(\)|HOOK\.fxT\?\?performance\.now\(\)/g) || []).length;
  check('effects stop with the pause: one effects clock advanced only while unpaused, read by every effect shader, explosion and the twinkle', clock && readers.every(Boolean) && stray === 0,
    `clock ${clock} · readers ${readers.map(Number).join('')} · wall-clock effects left ${stray}`);
}

// aerofx-37. The haze without dither (look & sound sky & bodies beat, QUEUE Q392, PLAYTEST #89): measured, most of the
// noise in a smooth hazy sky was the composite's grain (low and mid air) and scatter's per-pixel jitter (from orbit). The
// jitter now applies only on rays that cross the planet's shadow (where it hides Q352's bands), and the grain is .012.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const sc = pg.slice(pg.indexOf('vec3 scatter(vec3 d'), pg.indexOf('return SUNI*', pg.indexOf('vec3 scatter(vec3 d')));
  const jit = /float s0=b0<0\.&&dot\(q0,q0\)-b0\*b0<uPR\*uPR\?1\.:0\./.test(sc) && /\*step\(\.5,abs\(s0-s1\)\+abs\(s1-s2\)\)\)/.test(sc);
  const grain = /const GRADE=\{[^}]*gr:\.012\}/.test(pg);
  check('haze without dither: scatter jitters only rays crossing the planet\'s shadow; grain .012', jit && grain, `jitter ${jit} · grain ${grain}`);
}

// aerofx-38. Farmland and soft coasts (look & sound sky & bodies beat, QUEUE Q401, Q403; PLAYTEST #95, #99): tellus()
// farms what's green, mild, flat and settled (farmSettle: the city texture blurred, each pad's town) with fields, hedges,
// roads, woods and villages, every part filtered by the footprint; the coast blends sea and land over the height's change
// across the pixel (fwidth in main, none at a silhouette) with the fringe widening. Views 175–177 from the air.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const farm = /float farmSettle\(vec3 pf\)/.test(pg) && /vec3 farmland\(vec3 pf,vec2 gx,float W,float fw,float frac,vec3 nat,float det,float fade\)/.test(pg)
    && /const FARM_FX=true;/.test(pg) && /float fline\(float d,float w,float fw,float sz\)/.test(pg) && /farmland\(pf,gx,W,fw,frac,col,det,fade\)/.test(pg)
    && !/vec2 cl2=mod\(floor\(gx\/260\.\),4096\.\)/.test(pg);
  const coast = /float hwT=fwidth\(tP\)<\.3\*tP\?min\(fwidth\(hT\),2000\.\):0\.;/.test(pg) && /float sea=hw>1\.\?sst\(\.5\*hw,-\.5\*hw,h\):step\(h,0\.\);/.test(pg)
    && /return mix\(mix\(col,snow,max\(sn,ice\)\),seaC,sea\);/.test(pg) && /tellus\(pf,npf,hT,gx,det,fade,fw,hwT,oc\)/.test(pg);
  check('farmland round settled land, filtered by footprint; the coast blended over the pixel (views 175–177)', farm && coast && /if \(n >= 175 && n <= 177\)/.test(vj),
    `farmland ${farm} · coast ${coast}`);
}

// aerofx-39. No bright band at the horizon from inside the deck (look & sound sky & bodies beat, QUEUE Q420): with the
// camera in the 2–5.5 km slab, a ray that stays in the slab past uVD/2 (where the volume fades out) is fogged in the
// volume's own mean colour along it (or, through a gap, the far deck at half brightness), not drawn as the shell's lit top.
// Views 178–179 look along the horizon at 2.4 km.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const ok = /float T=A\.a;if\(T<\.95\)vAvg=A\.rgb\/\(1\.-T\);/.test(pg) && /inC=uVk\*smoothstep\(1500\.,2200\.,hc\)\*smoothstep\(6000\.,5000\.,hc\)/.test(pg)
    && /col=mix\(col,vAvg\.x>=0\.\?vAvg:col\*\.5,f\);vis\*=1\.-f;/.test(pg) && /178: \[2400, 1\.75, 0\.0, 40\], 179: \[2400, 0\.2, 0\.0, 40\]/.test(vj);
  check('inside the deck: rays that stay in the slab past the volume\'s reach are fogged in its own colour (no bright horizon band; views 178–179)', ok, `fog ${ok}`);
}

// aerofx-40. The new parts' look (look & sound effects beat, QUEUE Q396; PROBES § 7): the octagonal frame's bays (silver
// foil, two black radiators with louvres), corner posts and belt; each side box with an outline of its own (the camera's
// hood, the instruments' mouth, the battery's ribs, band and terminals, the computer's fins); the whip's spring and tip;
// the boom antenna as a lattice with a crossed dipole; the fairing's separation rails; fins' doublers by size and a
// stiffener on the big ones; foil crinkles on the frame and computer too (kind 7), and a silver foil.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const body = page.slice(page.indexOf('function partBody(out,p){'), page.indexOf('\nfunction ', page.indexOf('function partBody(out,p){') + 10));
  const has = {
    silver: /AG:\[\.78,\.8,\.84,5\]/.test(page) && /frame:7,comp:7\}/.test(page),
    frame: /rad\?C\.BK:C\.AG,a\)/.test(body) && /\/\/ louvres/.test(body) && /\/\/ corner posts/.test(body),
    boxes: /\/\/ hood, lens/.test(body) && /\/\/ the sensor's mouth/.test(body) && /\/\/ cell ribs/.test(body) && /\/\/ band, terminals/.test(body) && /\/\/ heat-sink fins/.test(body),
    whip: /case'whip':[\s\S]*?for\(let j=0;j<3;j\+\+\)lathe/.test(body),
    boom: /case'bant':[\s\S]*?lon=\[\[0,e\]/.test(body) && /\/\/ the hinge/.test(body),
    fairing: /function fairSeams\(out,pr,o\)/.test(page) && (body.match(/fairSeams\(out,pr,o\)/g) || []).length === 2,
    fins: /case'rfin':case'cfin':\{const k=d\.span\/\.9/.test(body) && /shoe:true,rib:k>1\.2/.test(body)
  };
  check('the new parts\' look: frame bays and radiators, side boxes each readable, whip and lattice boom, fairing rails, fins by size, foil that crinkles',
    Object.values(has).every(Boolean), Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-41. Deploying animates (look & sound effects beat, QUEUE Q411): the sim stamps p.depT when a wing, boom antenna
// or leg starts out or back (wingOp, legOp); depF follows it in sim time (wing 6 s since Q565, antenna 3 s, leg 1.6 s), at once with
// no stamp; the wing's panels unfold one after another, the antenna swings then extends, the leg swings down; the ship's
// mesh is rebuilt while a fraction moves.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('const DEP_S='), page.indexOf('const depKey='));
  const F = (simT, p) => new Function('simT', 'clamp', src + 'return depF')(simT, (x, a, b) => Math.min(b, Math.max(a, x)))(p);
  const W = { d: { kind: 'solar', wing: true } }, L = { d: { kind: 'leg' } };
  const vals = [F(5, { ...W, dep: true }), F(3, { ...W, dep: true, depT: 0 }), F(6, { ...W, dep: true, depT: 0 }), F(0.8, { ...L, dep: true, depT: 0 }), F(0.8, { ...L, dep: false, depT: 0 }), F(9, { ...L, dep: false, depT: 0 })];
  const fr = vals[0] === 1 && vals[1] === .5 && vals[2] === 1 && vals[3] === .5 && vals[4] === .5 && vals[5] === 0;
  const stamp = /p\.dep=o;p\.depT=simT;n\+\+;/.test(H) && /\{p\.dep=dn;p\.depT=simT;n\+\+\}/.test(H);
  const draw = (page.match(/const f=depF\(p\);if\(f>0\)\{/g) || []).length === 3 && /let H=P\(b0,h\/2\);for\(let k=0;k<4;k\+\+\)\{const g=sstep\(0,1,u\),/.test(page)
    && /const k=bayKey\(S\)\+'\|'\+depKey\(S\);/.test(page) && /bayKey\(v\)\+'\|'\+depKey\(v\)/.test(page);
  check('deploying animates: stamped by the sim, followed in sim time (at once without a stamp), the panels together; the mesh rebuilt while it moves', fr && stamp && draw,
    `fractions ${vals.join(', ')} · stamps ${stamp} · drawing ${draw}`);
}

// aerofx-42. No far ground drawn in the sky (look & sound sky & bodies beat, QUEUE Q445, PLAYTEST #117; Q419): where none
// of the quarter-resolution pre-pass's 3×3 neighbours hit the terrain, coarseStart says so (−1) and the full-resolution
// march returns sky at once. Marching from 0 there, a ray grazing the horizon ran out of its 64 steps and was called a
// hit: 1-px lines of ground above the horizon, black at night (views 19, 65), grey lenses by day.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const ok = /return m>1e29\?-1\.:max\(m\*\.985-1\.,0\.\);\}/.test(pg) && /float march\(vec3 d,out float hh,float tS\)\{hh=0\.;if\(tS<0\.\)return 1e30;/.test(pg);
  check('no far ground in the sky: a pixel whose coarse neighbours all missed the terrain is sky, not a march that ran out of steps', ok, `sentinel ${ok}`);
}

// aerofx-43. No pale streak at the horizon from inside the deck (look & sound sky & bodies beat, QUEUE Q453, after Q420):
// seen from below, where the volume has cloud on the ray, the far deck's underside (the shell) takes the volume's mean
// colour, and from inside the deck that colour without the air; rays leaving through the slab's base had drawn the
// shell's underside lit at .45 of a sunlit top, plus 100–200 km of haze, as a cream line (views 178–179).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const ok = /if\(below>\.5&&vAvg\.x>=0\.\)cc=mix\(cc,vAvg,uVk\);float hk=length\(uPc\)-uPR,iD=below\*step\(0\.,vAvg\.x\)\*uVk\*/.test(pg)
    && /col=mix\(col,mix\(cc\*tr\+ic,vAvg,iD\),cov\*\.95\*shW\*\(1\.-\.85\*uAtl\)\);/.test(pg);
  check('under and inside the deck: the far deck\'s underside in the volume\'s own colour (no pale streak at the horizon; views 178–179)', ok, `underside ${ok}`);
}

// aerofx-44. Earthshine on meshes (look & sound sky & bodies beat, QUEUE Q428): near an airless body, lightEnv's sky term
// carries Tellus's lit face as the moon pass lights the ground (albedo .35, a Lambert sphere's phase, ×100), so a lander on
// Selene's night side under a full Tellus is lit like its ground (view 182), and fades as Tellus sets or wanes.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const ok = /const es=5\*100\*\.35\*\.6667\*\(TELLUS\.R\/dT\)\*\*2\*Ph\*Math\.max\(0,Math\.min\(1,\.35\+\.65\*eu\)\)\*k\*k\*\(3-2\*k\);/.test(pg)
    && /sky:\[\.006,\.007,\.01\]\.map\(\(x,i\)=>x\+es\*/.test(pg) && /if \(n === 182\) \{/.test(vj);
  check('earthshine on meshes near an airless body: a lander on Selene\'s night side lit by a full Tellus (view 182)', ok, `earthshine ${ok}`);
}

// aerofx-45. Clouds in front of Selene have a reference view (look & sound sky & bodies beat, QUEUE Q429): 183 searches the
// weather for 50–85 % cover where Selene's ray crosses 3.5 km, from 1.5 km over the night side (view 168 found clear air).
{
  const vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const ok = /if \(n === 183\) \{/.test(vj) && /const cv = cloudAt\(cu, tNow\(\) \+ k \* 300\); if \(cv > 0\.5 && cv < 0\.85\)/.test(vj);
  check('a reference view of clouds in front of Selene (view 183: cover searched on its ray)', ok, `view ${ok}`);
}

// aerofx-46. Each school's ground plan and the road out (look & sound effects beat, QUEUE Q426, Q404; PLAYTEST #100):
// padGround branches per school (Steppe's hall slab, Arsenal's earth yard, Coastal's white plaza and rail corridor,
// Mountain's asphalt yard, Isle's gravel); the road is the site's drive then a route found over the ground (siteRoad: A*,
// the sea shut out, grades priced) through the fence to a town up-range, passed to the sky shader (uRd, uRdN, uTown,
// uGate) and painted out to 12 km, outside the camera's 4 km detail fade; the fence, gate and site office are siteMesh's,
// drawn with the pad; Coastal's jungle is cleared along the road and the fence.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const pg = page.slice(page.indexOf('vec3 padGround(vec2 x,'), page.indexOf('return c*(1.-.85*min(soot,1.));}', page.indexOf('vec3 padGround(vec2 x,')));
  const has = {
    schools: /if\(k<=1\)/.test(pg) && /else if\(k==2\)/.test(pg) && /else if\(k==3\)/.test(pg) && /else if\(k==4\)/.test(pg) && /vec2\(0\.,-152\.\),vec2\(18\.,34\.\)/.test(pg),
    road: /uniform vec2 uRd\[32\];uniform int uRdN;uniform vec4 uTown;uniform vec3 uGate;/.test(page) && /float rd=uRdN>1\?roadD\(x,al,dir\)/.test(pg) && /c=townG\(x,c,fw,k,tm\)/.test(pg),
    reach: /if\(dot\(pv,pv\)<1\.44e8\)\{vec2 q=vec2\(dot\(pv,uPadE\),dot\(pv,uPadS\)\);alb=padGround\(q,alb,fw,paved\);\}\}\n  if\(fade>0\.&&oc<\.5\)\{/.test(page),
    astar: /function siteRoad\(t\)\{/.test(page) && /shut\[i\]=h\[i\]<2\|\|/.test(page) && /L\*\(1\+\(gr\/\.05\)\*\*2\)/.test(page) && /while\(r\.length>32-P\.d\.length\+1\)/.test(page),
    mesh: /function siteMesh\(t\)\{/.test(page) && /drawMesh\(padFor\(t\),M,site\);const sm=siteMesh\(t\);if\(sm\)drawMesh\(sm,M,site\)/.test(page),
    uniforms: /gl\.uniform2fv\(u\['uRd\[0\]'\],A\);gl\.uniform1i\(u\.uRdN/.test(page),
    jungle: /\*\(uRdN>1\?sst\(6\.,11\.,roadD\(q,al_,dr_\)\):1\.\)/.test(page)
  };
  check('each school\'s ground plan, and the road found over the ground through a gate to the site\'s town, painted to 12 km',
    Object.values(has).every(Boolean), Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-47. Village and farm lights at night, and the site's town (look & sound effects beat, QUEUE Q447): a shader
// global gLit, reset in main before tellus, that farmland's villages (times the farmed fraction) and townG add lamp
// pools to (lampPools, filtered to their mean); the night term adds NIGHT_VIL × gLit beside the city texture's lights
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const has = {
    knob: /const NIGHT_VIL=[1-9][\d.]*;/.test(page),
    pools: /float gLit=0\.;\nfloat lampPools\(vec2 x,float sp,float fw\)\{/.test(page) && /return mix\(p,157\.\/\(sp\*sp\),/.test(page),
    village: /gLit\+=vil\*mix\(1\.-roof,1\.,sst\(5\.,20\.,fw\)\)\*lampPools\(gx\+7\.,28\.,fw\);/.test(page) && /farmland\(pf,gx,W,fw,frac,col,det,fade\),fm\);gLit\*=fm;/.test(page),
    town: /gLit\+=tm\*dens\*.*lampPools\(g,25\.,fw\)/.test(page),
    night: /gLit=0\.;vec3 alb=tellus\(/.test(page) && /\+\$\{NIGHT_VIL\.toFixed\(2\)\}\*gLit\)\*\(1\.-oc\)\*\.55\*\(1\.-smoothstep\(-\.12,\.05,ndl\)\)/.test(page)
  };
  check('villages and the site\'s town lit at night (lamp pools into gLit, added by the night term)',
    Object.values(has).every(Boolean), Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-48. Selene without the flashing grain (look & sound sky & bodies beat, QUEUE Q493, PLAYTEST #128): the moon
// pass's crater octaves are whole only while their craters are 2 px across or more and gone by ~1 px (w·f .06 → .2), and
// its near-field detail is detailF, filtered by the footprint; the footprint grows toward the horizon (1/mu down to .005;
// it stopped at .2 and craters aliased into bright dashes along the horizon at the lander, views 112–113). Sub-pixel
// crater rims had turned pixels black and flashed as the camera moved (82 dark dots per 10k pixels from 100 km → 20,
// floor 15; frame-to-frame change 0.71 → 0.21).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const ok = /float mu=max\(dot\(n,V\),0\.\),w=tN\*uPix\/uNR\/max\(mu,\.005\);/.test(pg)
    && /float k=1\.-smoothstep\(\.06,\.2,w\*f\);if\(k<=0\.\)break;\n vec4 c=cratG\(/.test(pg)
    && /det=fade>0\.\?detailF\(MB\(d\*tN\)\+uNdet,w\*uNR\):\.5;/.test(pg);
  check('Selene\'s craters and near detail filtered by the footprint (no flashing grain)', ok, `filtered ${ok}`);
}

// aerofx-49. Selene up close isn't plain grey (look & sound sky & bodies beat, QUEUE Q324, PLAYTEST #143): the moon
// pass's albedo is mottled from 12 km down to the regolith's 25 cm (two more filtered fbm scales, detailF stronger and out
// to 8 km), and within a few hundred metres boulders stand on the ground (rocksL: half ellipsoids hit by the view ray, lit,
// lumpy, shadows cast down-sun up to 3 heights long, faded by their footprint). The relief itself waits for GROUND G3.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const moon = pg.slice(pg.indexOf('const MOON_FS='), pg.indexOf('const PMOON='));
  const has = {
    mottle: /\+\.16\*fade\*\(det-\.5\)\+\.09\*\(fbmF\(nb\*300\.,w\*300\.\)-\.5\)\+\.06\*\(fbmF\(nb\*30\.,w\*30\.\)-\.5\)\)/.test(moon) && /fade=smoothstep\(8000\.,300\.,tN\)/.test(moon),
    rocks: /float rocksL\(vec3 l,vec3 up,vec3 sb,vec3 V,float fw\)\{/.test(moon) && /k=1\.-smoothstep\(\.6\*r,1\.5\*r,fw\);if\(k<=0\.\)continue;/.test(moon),
    used: /if\(uSel>0\.&&w\*uNR<\.5\)refl\*=rocksL\(MB\(d\*tN\)\+uNdet,nb,MB\(uSun\),MB\(V\),w\*uNR\);/.test(moon)
  };
  check('Selene up close: mottled regolith and boulders with long shadows (views 112–113)', Object.values(has).every(Boolean), Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-50. The game's suits on the EVA lab's walker (look & sound, astronauts, QUEUE Q535). eva-lab.html builds each
// launch suit with crewFigure, binds every vertex to one bone of the lab's pose and moves it with that bone. Posed back
// at the suit's own skeleton, every suit comes back unmoved; in a long stride (knees and elbows bent, a lean) no
// triangle tears: no edge grows by more than 6 cm except a hose's, which may stretch between two bones.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END')), lab = readFileSync(new URL('./eva-lab.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const cutOf = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  const L = new Function(src + `const Q=new URLSearchParams('');
    ${cutOf(lab, 'function pv(', '</script>')}
    ${cutOf(page, 'const SUIT_DEFAULT=', '\n// The crew on the access arm')}
    ${cutOf(lab, 'function legIK(', '\nfunction lerpJ')}
    ${cutOf(lab, 'const SUIT_SCH=', '\nfunction prints')}
    return {crewFigure,suitOf,joints,buildRig,drawSuit,set:(i,k)=>{suitI=i;personI=k;RIG=null},rig:()=>RIG};`)();
  const HOSE_C = [.55, .56, .56], isHose = (o, i) => Math.abs(o[i + 6] - HOSE_C[0]) < 1e-6 && Math.abs(o[i + 7] - HOSE_C[1]) < 1e-6;
  const bad = [];
  for (let si = 0; si < 18; si++) {
    L.set(si, si % 8); const raw = L.crewFigure(L.suitOf(Math.floor(si / 3), si % 3), 'stand', si % 8), r = raw.rig, n = raw.length / 9;
    const lg = k => r.legs.find(l => (l.sx > 0) === (k === 0)), ar = k => r.arms.find(a => (a.sx > 0) === (k === 0));
    const rest = { hip: [0, r.hip, 0], sh: [0, r.sh, 0], tu: [0, 1, 0], R: [-1, 0, 0], F: [0, 0, 1], hips: [0, 1].map(k => lg(k).h), knees: [0, 1].map(k => lg(k).kn),
      feet: [0, 1].map(k => [lg(k).an[0], 0, lg(k).an[2]]), shs: [0, 1].map(k => ar(k).a), elb: [0, 1].map(k => ar(k).e), hands: [0, 1].map(k => ar(k).g) };
    const o0 = []; L.drawSuit(o0, rest); let back = 0; for (let i = 0; i < o0.length; i++) back = Math.max(back, Math.abs(o0[i] - raw[i]));
    // a long stride: the +x foot ahead, the other behind and lifted, arms swinging against the legs, a 12° lean
    const tu = [0, Math.cos(.21), Math.sin(.21)], hip = [0, .84, 0];
    const J = L.joints(hip, tu, [-1, 0, 0], [[.11, 0, .42], [-.11, .12, -.38]], [[.3, .72, -.25], [-.3, .76, .3]], [0, 0, 1], [0, 0, -1]);
    const o = []; L.drawSuit(o, J); let worst = 0, at = '';
    for (let t = 0; t < n; t += 3) {
      if ([0, 1, 2].some(k => isHose(raw, (t + k) * 9))) continue;
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const A = (t + a) * 9, B = (t + b) * 9, d = (x, i, j) => Math.hypot(x[i] - x[j], x[i + 1] - x[j + 1], x[i + 2] - x[j + 2]), g = d(o, A, B) - d(raw, A, B);
        if (g > worst) { const bn = L.rig().bone; worst = g; at = `y ${raw[A + 1].toFixed(2)} [${raw.slice(A, A + 3).map(v => v.toFixed(2))}]→[${raw.slice(B, B + 3).map(v => v.toFixed(2))}] bones ${bn[t + a]},${bn[t + b]}` }
      }
    }
    if (back > 1e-4 || worst > .06) bad.push(`suit ${si}: back ${back.toExponential(1)}, an edge +${(worst * 100).toFixed(1)} cm at ${at}`);
  }
  check('EVA lab wears the game\'s suits (Q535): all 18 launch suits bound to the walker\'s bones come back unmoved at rest, and tear nowhere in a long stride (hoses may stretch)',
    !bad.length && /<script src="app\/crew-look\.js"><\/script>/.test(lab) && /if\(suitI>=0\)drawSuit\(o,J\);else drawJ\(o,J\)/.test(lab),
    bad.slice(0, 18).join(' | ') || '18 suits, rest exact, no tear over 6 cm');
}

// aerofx-51. The resolution scaler uses the frame it has (review session, QUEUE Q559; Caio: "a lot of pixelation"). The
// old rule aimed at 7 ms and grew back only under 3.85 ms, so a heavy moment left the view at half resolution with half
// the GPU idle. resNext is run here against a GPU whose cost is a fixed part plus one that goes as the pixel count.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const i = pg.indexOf('const RS_MIN='), j = pg.indexOf('// Without timer queries', i);
  const { resNext, RS_MIN, GPU_BUDGET } = new Function(pg.slice(i, j) + ';return{resNext,RS_MIN,GPU_BUDGET}')();
  // one 0.6 s step of the game's loop: the load the scaler sees is the smoothed GPU time over the budget
  const run = (rs, cap, costs) => { const tr = []; let avg = null;
    for (const [n, fixed, perPx] of costs) for (let k = 0; k < n; k++) { const ms = fixed + perPx * rs * rs; avg = avg == null ? ms : avg * .3 + ms * .7; rs = resNext(rs, avg / GPU_BUDGET, cap); tr.push([rs, fixed + perPx * rs * rs]); }
    return tr; };
  const heavy = run(1, 1, [[40, 2, 20]]), endH = heavy.at(-1), still = heavy.slice(-20).every(x => x[0] === endH[0]);   // 22 ms at full size
  const back = run(endH[0], 1, [[40, 1, 5]]), tBack = back.findIndex(x => x[0] === 1);                                 // then 6 ms at full size
  const low = run(1, .6, [[5, 1, 5]]).at(-1), floor = run(1, 1, [[60, 30, 60]]).at(-1);
  const light = run(1, 1, [[20, 1, 8]]).every(x => x[0] === 1);                                                          // 9 ms: never touched
  check('the scaler uses the frame it has (Q559): a 22 ms scene settles and stays between 70 % and 105 % of the budget; when the scene lightens the view is back at full size within 6 s; a 9 ms scene is never scaled; the Low cap and the floor hold',
    still && endH[1] > .7 * GPU_BUDGET && endH[1] < 1.05 * GPU_BUDGET && tBack >= 0 && tBack < 10 && light && low[0] <= .6 && Math.abs(floor[0] - RS_MIN) < 1e-9,
    `heavy: ${(endH[0] * 100).toFixed(0)} % at ${endH[1].toFixed(1)} ms${still ? '' : ' (still moving)'}; back to 100 % after ${tBack < 0 ? 'never' : (tBack + 1) * .6 + ' s'}; Low ${(low[0] * 100).toFixed(0)} %; floor ${(floor[0] * 100).toFixed(0)} %`);
}

// aerofx-52. The upscale pass's filter (review session, QUEUE Q560). UPS_FS can't run here, but its Catmull-Rom weights
// can: lifted from the shader's text and evaluated, they must sum to 1 at every sub-texel position (no brightening or
// darkening as the scaler moves), rebuild a straight ramp exactly, and overshoot a hard step (which is the sharpening
// the clamp to the four nearest texels then keeps from ringing).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const i = pg.indexOf('const UPS_FS='), sh = pg.slice(i, pg.indexOf('`;', i)), m = /vec2 (w0=.*?),w12=w1\+w2;/.exec(sh);
  const wf = m && new Function('f', 'const ' + m[1].replace(/(\d)\.(?!\d)/g, '$1') + ';return[w0,w1,w2,w3]');
  let sum = 0, ramp = 0, over = 0;
  if (wf) for (let f = 0; f <= 1; f += .05) { const w = wf(f); sum = Math.max(sum, Math.abs(w[0] + w[1] + w[2] + w[3] - 1));
    ramp = Math.max(ramp, Math.abs(-w[0] + w[2] + 2 * w[3] - f)); over = Math.max(over, -w[0], -w[3]); }   // texels at -1, 0, 1, 2; a step just before or after the pair rebuilds as 1 - w0 or 1 - w3
  check('the upscale filter is a true Catmull-Rom (Q560): weights sum to 1, a ramp comes back exact, a step overshoots (the clamp holds it), and the pass clamps to the four nearest texels',
    !!wf && sum < 1e-12 && ramp < 1e-12 && over > .03 && over < .12 && /c=clamp\(c\+uSh\*\(c-\(a\+b\+d\+e\)\*\.25\),lo,hi\)/.test(sh),
    wf ? `sum off by ${sum.toExponential(1)}, ramp by ${ramp.toExponential(1)}, step overshoot ${(over * 100).toFixed(1)} %` : 'weights not found in UPS_FS');
}

// aerofx-53. The solar wing's cells (look & sound parts & pad, QUEUE Q565): rboxUV gives a box of cells its own kind
// (SOLAR_K, no school bits, so a school's repaint can't grey the cells) and, on its broad faces, the position in metres
// from the face's corner with the face's size; the narrow edges carry R = -1. The wing panel (thin along z) and the body
// tile (thin along x) both map; MESH_FS has the branch, and no part kind collides with SOLAR_K.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('const VX=16'), page.indexOf('const KIND=')) + page.slice(page.indexOf('function pv('), page.indexOf('// surface of revolution')) +
    page.slice(page.indexOf('function box('), page.indexOf('// a swept, tapered fin'));
  const { rboxUV, SOLAR_K, KIND } = new Function('rotY', src + ';const KIND=' + /const KIND=(\{[^}]*\})/.exec(page)[1] + ';return{rboxUV,SOLAR_K,KIND}')(
    (v, th) => { const c = Math.cos(th), s = Math.sin(th); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]] });
  const map = (hx, hy, hz, phi) => { const o = []; rboxUV(o, [1, 2, 3], hx, hy, hz, [.1, .1, .3, 4], phi); const V = [];
    for (let i = 0; i < o.length; i += 16) V.push({ u: o[i + 10], v: o[i + 11], R: o[i + 12], h: o[i + 13], k: o[i + 14], y: o[i + 1] - 2 }); return V };
  const ok = (V, W, Hh) => { const b = V.filter(x => x.R > 0), e = V.filter(x => x.R < 0);
    return b.length === 12 && e.length === 24 && V.every(x => x.k === SOLAR_K) && b.every(x => Math.abs(x.R - W) < 1e-9 && Math.abs(x.h - Hh) < 1e-9 && x.u > -1e-9 && x.u < W + 1e-9 && Math.abs(x.v - (x.y + Hh / 2)) < 1e-9)
      && new Set(b.map(x => x.u.toFixed(6))).size === 2 };
  const wing = ok(map(.285, .28, .008, .7), .57, .56), tile = ok(map(.004, .088, .046, 2.1), .092, .176);
  const shader = /else if\(k==17\)\{/.test(page) && SOLAR_K === 17 && !Object.values(KIND).includes(SOLAR_K);
  const used = /rboxUV\(out,c,w\/2-\.015,h\/2-\.02,\.008,CELL,a\+th\)/.test(page) && /rboxUV\(out,\[cx\+c\*\(R\+\.014\)/.test(page);
  check('the solar wing\'s cells (Q565): rboxUV maps the broad faces in metres for the wing panel and the body tile, edges flagged, its own kind with a shader branch, used by both parts',
    wing && tile && shader && used, `wing ${wing} · body tile ${tile} · shader ${shader} · used ${used}`);
}

// aerofx-54. Staging (review session, QUEUE Q564; PLAYTEST #159 "the camera instantly recenters on the craft", #160 "more
// oomph"). The camera looks at the centre of mass, which jumps when parts leave: detach reports the jump (HOOK.cmShift)
// and the page eases over it (camLagStep, a critically damped spring). The separation's puffs fall with the craft: an
// Orbiter is staged in a 300 km orbit, flown on for a second, and the gas ring must still be centred on the seam.
// (Q591) sepFx draws its puffs with Math.random, and `d0 > 3` (the ring's offset without the fall) sat on that draw: over
// 300 seeds d0 ran 2.62–3.93 m and was ≤ 3 in 11 % (CI failed on it), while the claim itself (dG, with the fall) never
// passed 0.96 m. The puffs are drawn from world.js's rng(1) here (d0 3.4 m, dG 0.36 m), so the check gives one answer.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const i = pg.indexOf('const CAML='), j = pg.indexOf('HOOK.sep=sepFx;', i);
  const D = new Function(src + `const PUFFS=[];function fxPuff(r,v,o){PUFFS.push({r,v,o})}` + pg.slice(i, j) +
    `;return{CAML,camLagStep,sepFx,PUFFS,newShip,stage,advPhys,PRESETS,HOOK,TELLUS,DT,rng,set S(v){S=v},set t(v){simT=v}}`)();
  const T = D.TELLUS, sep = alt => { D.t = 0; D.PUFFS.length = 0; const s = D.newShip(D.PRESETS.Orbiter); D.S = s; s.landed = false; s.throttle = 0; s.sas = false;
    const r = T.R + alt; s.r = [r, 0, 0]; s.v = [0, 0, Math.sqrt(T.mu / r)]; D.CAML.s = s; D.CAML.x = [0, 0, 0]; D.CAML.v = [0, 0, 0];
    const r0 = s.r.slice(); let at = null; D.HOOK.msg = () => {}; D.HOOK.debris = d => { at = at || d; const real = Math.random; Math.random = D.rng(1); try { D.sepFx(d) } finally { Math.random = real } };   // (Q591) seeded puffs
    for (let k = 0; k < 6 && !at; k++) D.stage(s);
    return { s, r0, at } };
  const o = sep(300e3), jump = sub(o.s.r, o.r0), seen = add(o.s.r, D.CAML.x);
  const held = !!o.at && len(jump) > 1 && len(sub(seen, o.r0)) < 1e-6;   // the camera's target has not moved, though the craft's centre has
  // the spring: 60 frames a second from the jump
  const x0 = len(D.CAML.x), tr = []; for (let k = 0; k < 72; k++) tr.push(len(D.camLagStep(D.CAML, 1 / 60)));
  const soft = tr[0] > .99 * x0, mono = tr.every((x, k) => x <= (k ? tr[k - 1] : x0) + 1e-12), there = tr[65] < .05 * x0 && tr[29] > .1 * x0;
  // the puffs: each carries the fall; the gas ring (hot .25) a second later, against the craft flown on for that second
  const P = D.PUFFS.slice(), g = T.mu / (T.R + 300e3) ** 2, allG = P.length > 100 && P.every(p => p.o.g && Math.abs(len(p.o.g) / g - 1) < .01);
  const ring = P.filter(p => p.o.hot === .25), flecks = P.filter(p => p.o.life >= 3 && !p.o.grow).length, flash = P.filter(p => p.o.hot === 3).length;
  const seam = ring.reduce((a, p) => add(a, mul(p.r, 1 / ring.length)), [0, 0, 0]), rS = o.s.r.slice();
  for (let k = 0; k < Math.round(1 / D.DT); k++) D.advPhys(o.s);
  const cen = fall => ring.reduce((a, p) => add(a, mul(add(add(p.r, p.v), fall ? mul(p.o.g, .5) : [0, 0, 0]), 1 / ring.length)), [0, 0, 0]);
  const off = fall => len(sub(sub(cen(fall), o.s.r), sub(seam, rS))), dG = off(true), d0 = off(false);
  // on the way up, in thick air: no flecks (the wind would take them) and no fall added
  const lo = sep(2000), loP = D.PUFFS, loOk = !!lo.at && loP.length > 60 && !loP.some(p => p.o.life >= 3 && !p.o.grow) && loP.every(p => len(p.o.g) < .5 * g);
  check('staging: the camera holds its target over the jump and eases to the craft in about a second; the separation gas stays on the seam in orbit, with a flash and drifting flecks (Q564)',
    held && soft && mono && there && allG && ring.length === 28 && flecks === 36 && flash === 1 && dG < 1.5 && d0 > 3 && loOk,
    `the centre jumped ${len(jump).toFixed(1)} m, the target ${len(sub(seen, o.r0)).toExponential(0)} m; first frame keeps ${(tr[0] / x0 * 100).toFixed(1)} %, ${(tr[29] / x0 * 100).toFixed(0)} % left at 0.5 s, ${(tr[65] / x0 * 100).toFixed(1)} % at 1.1 s; ` +
    `${P.length} puffs (${flecks} flecks); the ring is ${dG.toFixed(2)} m off the seam after 1 s (${d0.toFixed(1)} m without the fall); at 2 km ${loP.length} puffs, flecks ${loP.filter(p => p.o.life >= 3 && !p.o.grow).length}`);
}

// aerofx-55. The whole exhaust trail (review session, QUEUE Q566; PLAYTEST #161, Caio: "the player should be able to see
// the full smoke trail from the launch pad as the rocket leaves the atmosphere"). A three-engine rocket climbs at 12 m/s²
// and lays its trail by emitSmoke's rule (a puff every 0.35 widths of 2.5 m + 3.5 % of the speed, born at half that, to
// 33 km); trailThin runs every second, as in the game, for 300 s (the craft is out of the air by ~200 s).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const i = pg.indexOf('const TRAIL_LIFE='), j = pg.indexOf('function emitSmoke(dt){', i);
  const { TRAIL_LIFE, TRAIL_GAP, SMOKE_MAX, trailThin, smokeDrop } = new Function(pg.slice(i, j) + ';return{TRAIL_LIFE,TRAIL_GAP,SMOKE_MAX,trailThin,smokeDrop}')();
  let rs = 7; const R = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const run = (thin, eng = 3) => { let list = [], acc = 0, peak = 0, laid = 0;
    for (let k = 0; k < 300 * 50; k++) { const t = k / 50, sp = 12 * t, h = 6 * t * t;
      if (h < 33000) { const s0 = 2.5 + sp * .035, gap = Math.max(.008, .35 * s0 / Math.max(sp, 1)); acc += 1 / 50;
        while (acc > gap) { acc -= gap; for (let e = 0; e < eng; e++) { if (thin && list.length > SMOKE_MAX) smokeDrop(list); list.push({ tr: 1, pf: [h + (R() - .5) * s0 * .45, e * 1.2 + (R() - .5) * s0 * .45, (R() - .5) * s0 * .45], t0: t, s0: s0 * (.8 + .4 * R()) * .5, grow: 4 + 3 * R(), life: TRAIL_LIFE * (1 + .3 * R()) }); laid++ } } }
      if (thin && k % 25 === 24) { trailThin(list, t); list = list.filter(q => t - q.t0 <= q.life && !(q.kt && t - q.kt > 3)) }
      peak = Math.max(peak, list.length) }
    return { list: list.filter(q => !q.kt), peak, laid } };
  const A = run(true), B = run(false), N = run(true, 9), T = 300, sz = q => q.s0 + q.grow * Math.sqrt(T - q.t0), L = A.list.slice().sort((a, b) => a.pf[0] - b.pf[0]);
  // the trail as it stands at 300 s: it starts at the pad, ends at 33 km, and no step along it is wider than a puff's half-width
  let gap = 0, gAt = 0; for (let k = 1; k < L.length; k++) { const g = (L[k].pf[0] - L[k - 1].pf[0]) / Math.min(sz(L[k]), sz(L[k - 1])); if (g > gap) { gap = g; gAt = L[k].pf[0] } }
  const whole = L.length > 100 && L[0].pf[0] < 30 && L.at(-1).pf[0] > 32500 && gap < .7, alive = L.every(q => T - q.t0 < q.life) && TRAIL_LIFE >= 400;
  // drawSmoke itself, on a GL that does nothing: a far puff is brought up to 1.5 px and thinned by the same ratio, a near
  // one is left alone, a retired one is half gone after 1.5 s and out of the list after 3
  const k0 = pg.indexOf('let smokeV='), k1 = pg.indexOf('const rcsSeen', k0);
  const G = new Function(src + `const smoke=[],H=1000,FC=1,SUN=[1,0,0],PLT={p:[0,0,0,0],c:[0,0,0],p2:[0,0,0,0],c2:[0,0,0]},smokeVAO=0,smokeBuf=0,PSMOKE={p:0,u:{}},PMESH={p:0};
    const gl=new Proxy({},{get:()=>()=>{}}),lightEnv=()=>({sun:[1,1,1],sky:[0,0,0],gnd:[0,0,0]});` + pg.slice(k0, k1) +
    `;return{smoke,drawSmoke,get P(){return smokeP},TELLUS,toPF,set t(v){simT=v}}`)();
  G.t = 0; const cam = [G.TELLUS.R + 100e3, 0, 0], puff = (d, o = {}) => ({ pf: G.toPF(G.TELLUS, [G.TELLUS.R + 100e3 - d, 0, 0], 0), t0: 0, s0: 50, grow: 0, a0: .4, life: 1000, rise: 0, seed: 1, ux: 1, uy: 0, uz: 0, wx: 0, wy: 0, wz: 0, ...o });
  G.t = 0; G.smoke.push(puff(100e3), puff(1000), puff(1000, { kt: -1.5 }), puff(1000, { kt: -3.5 })); let drew = '';
  try { G.drawSmoke(new Float32Array(16), cam, [0, 0, 1], [0, 1, 0]) } catch (e) { drew = String(e) }
  const far = [G.P[3], G.P[4]], near = [G.P[9], G.P[10]], fade = G.P[16];
  const drawOk = !drew && G.smoke.length === 3 && Math.abs(far[0] - 82) < .5 && Math.abs(far[1] - .4 * 50 / 82) < .005 && near[0] === 50 && Math.abs(near[1] - .4) < 1e-9 && Math.abs(fade - .2) < 1e-9;
  check('the exhaust trail lasts the climb (Q566): thinned as its puffs widen it fits the list from the pad to 33 km, as solid as it was laid, 300 s after liftoff; unthinned it would overflow and lose the pad end',
    whole && alive && A.peak < SMOKE_MAX * .6 && B.peak > SMOKE_MAX && TRAIL_GAP < .7 && Math.min(...N.list.map(q => q.pf[0])) < 30 && N.list.length > 100 && drawOk,
    `${A.laid} puffs laid; at most ${A.peak} held with thinning (the list takes ${SMOKE_MAX}), ${B.peak} without; at 300 s ${L.length} puffs from ${L[0].pf[0].toFixed(0)} m to ${(L.at(-1).pf[0] / 1000).toFixed(1)} km, the widest step ${gap.toFixed(2)} of a puff's half-width (at ${(gAt / 1000).toFixed(1)} km); nine engines: at most ${N.peak} held, the trail still starts at ${Math.min(...N.list.map(q => q.pf[0])).toFixed(0)} m; drawn: ${drew || `a 50 m puff at 100 km is ${far[0].toFixed(0)} m at opacity ${far[1].toFixed(2)} (was 0.40), at 1 km ${near[0]} m at ${near[1].toFixed(2)}, retired 1.5 s ago ${fade.toFixed(2)}, ${G.smoke.length} of 4 left`}`);
}
// aerofx-56. The landing dust is round, not a square (look & sound effects beat, QUEUE Q543, PLAYTEST #149). The dust sheet
// (DUST_FS) and the hot-gas splash (IMP_FS) are raymarched inside a box; their density fell off exponentially and never
// reached zero, so a grazing ray summed the remainder at the box's sides into a pale square round the lander. Both are now
// windowed to zero inside their box: the dust's radial window ends at 1.5 uRd (box half-width 1.6 Rd) and a height window
// under the lid (2 + .12 Rd) caps it; the splash ends at 9 re (its box's half-width). No cut-off threshold
// (if(d<.002)continue drew a contour of its own).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const dust = pg.slice(pg.indexOf('const DUST_FS=`'), pg.indexOf('`;', pg.indexOf('const DUST_FS=`'))), imp = pg.slice(pg.indexOf('const IMP_FS=`'), pg.indexOf('`;', pg.indexOf('const IMP_FS=`')));
  const dd = pg.slice(pg.indexOf('function drawDust('), pg.indexOf('\nconst IPA='));
  const has = {
    radial: /fall=exp\(-2\.6\*rho\/uRd\)\*smoothstep\(1\.5\*uRd,\.75\*uRd,rho\)\*smoothstep\(Hb,\.5\*Hb,p\.y\)/.test(dust),
    lid: /float Hb=2\.\+\.12\*uRd,H=min\(\.45\+\.09\*rho,\.25\*Hb\)/.test(dust) && /Hb=2\+\.12\*Rd/.test(dd),
    box: /lo=\[ip\[0\]-Rd\*1\.6,0,ip\[2\]-Rd\*1\.6\],hi=\[ip\[0\]\+Rd\*1\.6,Hb,ip\[2\]\+Rd\*1\.6\]/.test(dd),
    noCutoff: !/if\(d<\.002\)continue/.test(dust),
    splash: /sp\+=uIP\[k\]\.z\*exp\(-rk\/\(re\*3\.2\)\)\*smoothstep\(re\*9\.,re\*6\.,rk\)\*/.test(imp) && /Rs=h\.re\*9/.test(pg)
  };
  // computed: the window at the box's side and corner and at half the reach, and the old fall at the side
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, Rd = 50, win = rho => ss(1.5 * Rd, .75 * Rd, rho);
  const edge = win(1.6 * Rd), corner = win(1.6 * Rd * Math.SQRT2), mid = win(.5 * Rd), old = Math.exp(-2.6 * 1.6);
  check('the landing dust and the splash fade to nothing inside their boxes: radial and lid windows, no cut-off threshold, so no square edge (the old fall left 1.6 % at the box side)',
    Object.values(has).every(Boolean) && edge === 0 && corner === 0 && mid === 1, Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · ') + ` · window: side ${edge}, corner ${corner}, half-reach ${mid}; old fall at the side ${(old * 100).toFixed(1)} %`);
}

// aerofx-57. The ship shades itself (look & sound parts & pad, BEAUTY B1.3, QUEUE Q316 slice 1). On High the ship is
// drawn once from the light into a depth map fitted to it (shadowFit), and MESH_FS compares against the map: boosters
// shade the core. The fit holds every corner of the ship's bounds (and of what is docked) inside the map with a margin,
// puts the ship's long axis along the map's x so the texels across the stack are the fine ones, orders depth toward
// the light, and stays finite when the light looks straight down the stack. Low never draws the map.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    len = a => Math.hypot(a[0], a[1], a[2]), norm = a => mul(a, 1 / len(a)), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const shadowFit = new Function('dot', 'sub', 'mul', 'len', 'norm', 'cross', body('shadowFit') + ';return shadowFit')(dot, sub, mul, len, norm, cross);
  const clip = (m, p) => [0, 1, 2].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
  const M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 40, -20, 300, 1], bb = [-3, 0, -3, 3, 50, 3], corners = (M, bb) => Array.from({ length: 8 }, (_, i) => [bb[i & 1 ? 3 : 0] + M[12], bb[i & 2 ? 4 : 1] + M[13], bb[i & 4 ? 5 : 2] + M[14]]);
  const inside = (F, ps) => ps.every(p => clip(F.m, p).every(x => Math.abs(x) < .98 && Number.isFinite(x)));
  const side = shadowFit([[M, bb]], norm([1, .3, .2])), down = shadowFit([[M, bb]], [0, 1, 0]), tilt = shadowFit([[M, bb]], norm([.2, .97, -.1]));
  const holds = inside(side, corners(M, bb)) && inside(down, corners(M, bb)) && inside(tilt, corners(M, bb));
  const along = side.hx > 25 && side.hx < 30 && side.hy > 3 && side.hy < 6;   // the 50 m stack along x, its 6 m across y
  const L = norm([1, .3, .2]), c0 = [40, 5, 300], near = clip(side.m, [c0[0] + L[0] * 2, c0[1] + L[1] * 2, c0[2] + L[2] * 2])[2], far = clip(side.m, c0)[2];
  const depth = near < far && Math.abs((far - near) - 2 * 2 / side.dz) < 1e-9;
  const M2 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 52, -10, 300, 1], bb2 = [-2, -2, -2, 2, 2, 2], both = shadowFit([[M, bb], [M2, bb2]], L);
  const docked = inside(both, [...corners(M, bb), ...corners(M2, bb2)]) && !inside(side, corners(M2, bb2));
  const fs = pg.slice(pg.indexOf('const MESH_FS=`'), pg.indexOf('`;', pg.indexOf('const MESH_FS=`'))), vs = pg.slice(pg.indexOf('const MESH_VS=`'), pg.indexOf('`;', pg.indexOf('const MESH_VS=`')));
  const Q = new Function(pg.slice(pg.indexOf('const QUAL={'), pg.indexOf('const setGet=')) + ';return QUAL')();
  const has = {
    lookup: /if\(uShB\.x>0\.&&ndl>0\.\)/.test(fs) && /uniform highp sampler2DShadow uShT;/.test(fs) && /sun\*=mix\(1\.,sh,uShB\.x\*smoothstep\(0\.,\.1,ndl\)\);/.test(fs),
    unit: /if\(u\.uShT\)\{gl\.useProgram\(p\);gl\.uniform1i\(u\.uShT,16\)\}/.test(pg) && /\nssmTarget\(1\);/.test(pg),
    depthVS: vs.includes('gl_Position.z=(log2(max(1e-6,1.+gl_Position.w))*uFc-1.)*gl_Position.w;') && /const SSM_VS=MESH_VS\.replace\('gl_Position\.z=\(log2\(max\(1e-6,1\.\+gl_Position\.w\)\)\*uFc-1\.\)\*gl_Position\.w;',''\)/.test(pg),
    pass: /SH=shipShadow\(L,DF\?DF\.lamp:SUN\);gl\.bindFramebuffer\(gl\.FRAMEBUFFER,sceneFB\(\)\);gl\.viewport\(0,0,W,H\);gl\.useProgram\(PMESH\.p\)/.test(pg)
      && pg.indexOf('SH=shipShadow(') < pg.indexOf('setMarks(m,S.parts);gl.uniform1f(m.uSeam,1);drawMesh(shipMesh,Mship,p);') && /if\(SH\)gl\.uniform4f\(m\.uShB,0,0,0,0\);/.test(pg),
    bounds: /const me=makeMesh\(a\);me\.bb=bb;/.test(pg),
    quality: Q.high.fx.SHIP_SHADOW === 1 && !Q.low.fx.SHIP_SHADOW && /SHIP_SHADOW=!!f\.SHIP_SHADOW;/.test(pg)
  };
  check('the ship shades itself on High (Q316): the light\'s box holds the ship and what is docked with a margin, the stack lies along the map, depth runs toward the light; Low draws no map',
    holds && along && depth && docked && Object.values(has).every(Boolean),
    `corners inside (light from the side, straight down the stack, nearly so): ${holds} · box ${side.hx.toFixed(1)} × ${side.hy.toFixed(1)} m for a 50 × 6 m stack, a texel ${(2 * side.hx / 2048 * 100).toFixed(1)} cm along and ${(2 * side.hy / 2048 * 100).toFixed(1)} cm across · 2 m toward the light is ${((far - near) / 2 * side.dz).toFixed(2)} m of depth · docked body inside the wider box ${docked} · ` + Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-58. Ambient occlusion at joints and steps (look & sound parts & pad, BEAUTY B1.3, QUEUE Q316 slice 1b). shipAO,
// run when a ship's mesh is built: a side booster darkens the strip of the core that faces it (and its own side toward
// the core), baked per vertex into the fraction of the part's kind, with the span of the part's height that has the neighbour
// alongside; a narrower part under or over a wider one gets the ledge's width, which MESH_FS turns into occlusion per
// pixel. Fins and posed parts neither give nor take. The ambient light and the reflection are scaled, never the sun.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const VX = 16, AOS = new WeakMap(), ROUND = new Function(pg.slice(pg.indexOf('AO_ROUND={') - 6, pg.indexOf(';', pg.indexOf('AO_ROUND={'))).replace(/^.*?AO_ROUND=/, 'return '))();
  const shipAO = new Function('VX', 'AOS', 'AO_ROUND', body('shipAO') + ';return shipAO')(VX, AOS, ROUND);
  // a wall: rings at y0 and y1, 28 round, material mat
  const cyl = (a, x, z, y0, y1, r0, r1, mat = 0) => { for (const [y, r] of [[y0, r0], [y1, r1]]) for (let k = 0; k < 28; k++) { const g = k / 28 * 2 * Math.PI, c = Math.cos(g), s = Math.sin(g);
    a.push(x + c * r, y, z + s * r, c, 0, s, 1, 1, 1, mat, k / 28, y - y0, r0, y1 - y0, 1, 0) } };
  const part = (kind, x, z, y0, more) => ({ d: { kind }, pos: [x, 0, z], y0, ...more }), a = [], rg = [];
  const add = (p, y1, r0, r1, mat) => { const n = a.length; cyl(a, p.pos[0], p.pos[2], p.y0, y1, r0, r1, mat); rg.push([p, n, a.length]); return n };
  const core = part('tank', 0, 0, 0), boo = part('tank', 1.9, 0, 2), fins = part('fins', 0, 0, 0), top = part('tank', 0, 0, 10), eng = part('engine', 0, 0, -1.5), posed = part('tank', 1.9, 0, 3, { pose: {} });
  const nC = add(core, 10, 1.25, 1.25, 2), nB = add(boo, 8, .6, .6), nF = add(fins, 1, 2.5, 2.5), nT = add(top, 14, .6, .6), nE = add(eng, 0, .5, .3), nP = add(posed, 5, .6, .6);
  shipAO(a, rg);
  const fr = (n0, ring, k) => { const m = a[n0 + (ring * 28 + k) * VX + 14]; return m - Math.round(m) }, mat = (n0, k) => a[n0 + k * VX + 9], kind = (n0, k) => Math.round(a[n0 + k * VX + 14]);
  const occ = f => f / .45, wC = AOS.get(core), wB = AOS.get(boo), wT = AOS.get(top), wE = AOS.get(eng), wF = AOS.get(fins);
  const crease = occ(fr(nC, 0, 0)) > .5 && occ(fr(nC, 0, 0)) < .7 && fr(nC, 0, 1) > 0 && fr(nC, 0, 1) < fr(nC, 0, 0) && fr(nC, 0, 7) === 0 && fr(nC, 0, 14) === 0 && fr(nC, 1, 0) === fr(nC, 0, 0)
    && occ(fr(nB, 0, 14)) > .5 && fr(nB, 0, 0) === 0 && mat(nC, 0) === 2 && mat(nB, 14) === 0 && kind(nC, 0) === 1 && kind(nB, 14) === 1 && kind(nC, 14) === 1;   // the material untouched, the kind still reads
  const span = wC[2] === 2 && wC[3] === 8 && wB[2] === -3.5 && wB[3] === 12 && wT[2] === 0 && wT[3] === 0;   // the booster runs from 2 to 8 m up the core; the core stack (engine to top stage) runs from 3.5 m under the booster.s foot to 12 m over it
  const steps = Math.abs(wT[0] - .65) < 1e-9 && wT[1] === 0 && Math.abs(wE[1] - .95) < 1e-9 && wE[0] === 0 && wC[0] === 0 && wC[1] === 0 && wF.every(x => x === 0);
  const none = !AOS.has(posed) && Array.from({ length: 56 }, (_, k) => fr(nP, 0, k)).every(x => x === 0) && Array.from({ length: 56 }, (_, k) => fr(nF, 0, k)).every(x => x === 0);
  // the ledge, as MESH_FS computes it: the share of sky left at d from a ledge of width w
  const left = (d, w) => .5 + .5 * d / Math.sqrt(d * d + w * w), ledge = left(0, .65) === .5 && Math.abs(left(.65, .65) - .8536) < 1e-3 && left(6.5, .65) > .99;
  const fs = pg.slice(pg.indexOf('const MESH_FS=`'), pg.indexOf('`;', pg.indexOf('const MESH_FS=`')));
  const has = {
    decode: /k=k%32;float ao=clamp\(1\.-\(vK\.x-floor\(vK\.x\+\.5\)\)\/\.45,0\.,1\.\);/.test(fs),
    cut: /ao=1\.-\(1\.-ao\)\*smoothstep\(aw\.z-fl,aw\.z,v\)\*\(1\.-smoothstep\(aw\.w,aw\.w\+fl,v\)\);/.test(fs),
    ledge: /if\(side&&aw\.x>0\.\)ao\*=\.5\+\.5\*db\*inversesqrt\(db\*db\+aw\.x\*aw\.x\);if\(side&&aw\.y>0\.\)ao\*=\.5\+\.5\*dt\*inversesqrt\(dt\*dt\+aw\.y\*aw\.y\);/.test(fs),
    light: /amb=mix\(uSky,uGnd,wp\)\*ao;/.test(fs) && /\n env\*=ao;\n/.test(fs) && /vec3 sun=uSunCol\*uLit,/.test(fs),
    bake: /partShape\(a,p\);rg\.push\(\[p,n0,a\.length\]\);/.test(pg) && /if\(AO_FX\)shipAO\(a,rg\);/.test(pg),
    uniform: /if\(w&&i!=null&&i>=0&&i<96\)AOA\.set\(w,i\*4\)/.test(pg) && /gl\.uniform4fv\(u\['uAo\[0\]'\],AOA\);/.test(pg)
  };
  check('ambient occlusion at joints and steps (Q316): a booster darkens the strip of the core that faces it, along its own span; a narrow stage under or over a wide one gets its ledge; fins and posed parts neither give nor take; the sun is untouched',
    crease && span && steps && none && ledge && Object.values(has).every(Boolean),
    `core facing the booster ${(occ(fr(nC, 0, 0)) * 100).toFixed(0)} % hidden, 13° round ${(occ(fr(nC, 0, 1)) * 100).toFixed(0)} %, at 90° ${(occ(fr(nC, 0, 7)) * 100).toFixed(0)} % · booster toward the core ${(occ(fr(nB, 0, 14)) * 100).toFixed(0)} % · span on the core ${wC[2]}–${wC[3]} m · ledges: the stage over the core ${wT[0].toFixed(2)} m, the engine under it ${wE[1].toFixed(2)} m · sky left at a ledge: ${left(0, .65)} at the corner, ${left(.65, .65).toFixed(2)} one width away · crease ${crease} span ${span} steps ${steps} none ${none} · ` + Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-59. The surface pass (look & sound parts & pad, BEAUTY B1.4, QUEUE Q316 slice 2; Q259). In MESH_FS: Steppe's
// tanks carry one set of seams (Cape's weld rings no longer come through the enamel 5 cm a bay off Steppe's own), thin,
// with rivet rows; tanks, nose cones and adapters get the skin block: Cape's gloss, the gloss varying, the skin bowing
// between frames at the school's own pitch, stringers on the skirts of a tall tank and on an adapter's cone, grime
// toward each joint. The geometry it relies on: a tank's skirt ends under its roundel.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const fs = pg.slice(pg.indexOf('const MESH_FS=`'), pg.indexOf('`;', pg.indexOf('const MESH_FS=`')));
  const has = {
    on: /const bool SKIN_ON=true;/.test(fs),
    steppeOneSet: /if\(sch==1\)ring=seam=0\.;/.test(fs) && /float vb=k==1\?v-\.07\*sc:v,P=1\.3\*sc,/.test(fs) && /bay=\(sch==1\?1\.3:1\.25\)\*sc/.test(fs),
    steppeSeams: /alb\*=1\.-\.6\*min\(1\.,lin\(vb,P,\.004,fv\)\+lin\(s,\.7854\*R,\.004,fs\)\);/.test(fs) && /dots\(s,dv,\.03\*sc,\.06\*sc,\.006\*sc,fp\),dots\(v,da,\.03\*sc,\.06\*sc,\.006\*sc,fp\)/.test(fs),
    kinds: /if\(SKIN_ON&&uSeam>0\.&&side&&\(k==1\|\|k==4\|\|k==12\)\)/.test(fs),
    gloss: /if\(sch==0&&m==0\)rough=\.3;rough=clamp\(rough\*\(\.8\+\.45\*g1\),\.05,1\.\);/.test(fs),
    bows: /\(fract\(vU\.x\*8\.\)-\.5\)\*\.05\+vec3\(0\.,1\.,0\.\)\*\(fract\(\(v-b\)\/bay\)-\.5\)\*\.05\)\*pb/.test(fs),
    ribs: /bool ribs=sch<=2\|\|sch==4;/.test(fs) && /h>1\.5\*sc\?band\(v,b,b\+\.32\*sc,fv\)\+band\(v,h-b-\.32\*sc,h-b,fv\):0\.;/.test(fs),
    grime: /alb\*=1\.-\.3\*gj\*\(\.45\+1\.1\*g3\*g1\);/.test(fs),
    order: fs.indexOf('alb=mix(alb,rdl.rgb,rdl.a);') < fs.indexOf('if(SKIN_ON&&') && fs.indexOf('if(SKIN_ON&&') < fs.indexOf('vec4 mk=uMk[pi]')   // over the paint and the roundel, under soot, char and frost
  };
  // lengths in units of sc (the part's radius / 0.625 m): the flange b, the skirt, the roundel's radius and the shortest tank that has both
  const b = .07, skirt = .32, rs = .3, hMin = 1.5, clear = hMin / 2 - rs - (b + skirt);
  // the sun's highlight on paint (F0 .04): the peak of the shader's normalised Blinn–Phong term at a roughness
  const peak = r => { const ex = 2 / (r ** 4 + 1e-4) - 2; return (ex + 8) / 25.13 * .25 * .04; };
  check('aerofx-59: the surface pass (Q316, Q259): Steppe tanks carry one set of seams with rivet rows; tanks, noses and adapters get gloss that varies, bowed bays, stringer skirts and grime at joints; a skirt ends under the roundel',
    Object.values(has).every(Boolean) && clear > 0 && peak(.3) > 3 * peak(.42),
    `a skirt ends ${(clear * 62.5).toFixed(1)} cm under the roundel on the shortest 1.25 m tank that has both · the sun's highlight on Cape's gloss white ${(peak(.3) * 100).toFixed(1)} % of the sun at its peak (was ${(peak(.42) * 100).toFixed(1)} %) · ` + Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-60. Greebles (look & sound parts & pad, BEAUTY B1.5, QUEUE Q316 slice 3). In the whole page headless: a tank
// 1.5 m or taller and a capsule get small real geometry chosen from their data (raceway, feed line, umbilical plate,
// retro and ullage motors; thruster blocks, handrails), after everything else in the ship's buffer, so a far ship is drawn
// without it. Each stands on its host's skin, keeps clear of side boosters, carries the host's part index with kind
// GREEBLE_K and baked occlusion, and differs by school.
{
  const { boot } = await import(new URL('./apphost.mjs', import.meta.url));
  const H = boot({ renderEvery: 1 }), r = H.run;
  r('ttlFound()'); H.click({ go: 'assembly' });
  const got = JSON.parse(r(`(() => { const out = {};
    const G = (p, ps) => { const g = []; UPPER = upperOf(ps); greebles(g, p, ps); UPPER = null; return g };
    for (const n of ['Orbiter', 'Heavy']) { SCHOOL_FORCE = 0; stackDef = JSON.parse(JSON.stringify(PRESETS[n])); editorChanged(); HOOK.rebuild();
      const ps = S.parts.filter(p => p.on), rows = [];
      for (const p of ps) { const g = G(p, ps); if (!g.length) continue; const R = p.d.r || .625, k = R / .625, pod = p.d.kind === 'pod';
        let rMin = 1e9, rMax = 0, kinds = true, idx = true, aoMax = 0, inB = 0;
        const side = ps.filter(q => q !== p && q.d.kind === 'tank' && Math.hypot(q.pos[0] - p.pos[0], q.pos[2] - p.pos[2]) > .1 && q.y0 < p.y0 + p.d.h && q.y0 + q.d.h > p.y0);
        for (let i = 0; i < g.length; i += 16) { const rr = Math.hypot(g[i] - p.pos[0], g[i + 2] - p.pos[2]); if (!pod) { rMin = Math.min(rMin, rr - R); rMax = Math.max(rMax, rr - R) }
          const kk = Math.round(g[i + 14]); kinds = kinds && kk % 32 === GREEBLE_K; idx = idx && g[i + 15] === p.i; aoMax = Math.max(aoMax, g[i + 14] - kk);
          for (const q of side) if (Math.hypot(g[i] - q.pos[0], g[i + 2] - q.pos[2]) < (q.d.r || .625) && g[i + 1] > q.y0 && g[i + 1] < q.y0 + q.d.h) inB++ }
        rows.push({ key: p.d.key, n: g.length / 16, k, rMin: pod ? 0 : rMin / k, rMax: pod ? 0 : rMax / k, kinds, idx, aoMax, inB, side: side.length }) }
      out[n] = { rows, nMain: shipMesh.nMain, nAll: shipMesh.nAll } }
    const ps = S.parts.filter(p => p.on), t = ps.find(p => p.d.kind === 'tank' && p.d.h >= 3); out.bySchool = [0, 1, 3, 5].map(s => { SCHOOL_FORCE = s; return G(t, ps).length / 16 });
    SCHOOL_FORCE = 0; const q0 = quality; quality = 'high'; meshLod(shipMesh, 149); const a = shipMesh.n; meshLod(shipMesh, 151); const b = shipMesh.n; quality = 'low'; meshLod(shipMesh, 59); const c = shipMesh.n; meshLod(shipMesh, 61); const d = shipMesh.n; quality = q0;
    out.lod = [a === shipMesh.nAll, b === shipMesh.nMain, c === shipMesh.nAll, d === shipMesh.nMain];
    GREEBLE_FX = false; const m = partsMesh(ps); out.off = m.nAll === m.nMain; m.free(); GREEBLE_FX = true; SCHOOL_FORCE = null; return JSON.stringify(out) })()`));
  const rows = [...got.Orbiter.rows, ...got.Heavy.rows], fsrc = r('MESH_FS');
  const ok = !H.errs.length && rows.length >= 5 && rows.some(x => x.key === 'pod' || x.key === 'crew') && rows.some(x => x.side > 0)
    && rows.every(x => x.kinds && x.idx && x.inB === 0 && x.n <= 2000 && x.aoMax > .1 && x.aoMax <= .2251 && x.rMin > -.09 && x.rMax < .2)   /* a feed line's elbows run into the hull */
    && got.Orbiter.nAll > got.Orbiter.nMain && got.Heavy.nAll > got.Heavy.nMain && new Set(got.bySchool).size === 4 && got.lod.every(Boolean) && got.off
    && fsrc.includes('if(k==18);') && r('GREEBLE_K') === 18 && r('SOLAR_K') !== 18;
  check('aerofx-60: greebles (Q316): tanks and capsules carry small real geometry chosen from their data, on the skin, clear of side boosters, with the host\'s index and baked occlusion, different by school; a far ship is drawn without them',
    ok, `Orbiter ${got.Orbiter.nMain} + ${got.Orbiter.nAll - got.Orbiter.nMain} vertices, Heavy ${got.Heavy.nMain} + ${got.Heavy.nAll - got.Heavy.nMain} · per part: ${rows.map(x => `${x.key} ${x.n}`).join(', ')} · a tall tank by school (Cape, Steppe, Coastal, Isle): ${got.bySchool.join(', ')} · off the skin ${Math.min(...rows.map(x => x.rMin)).toFixed(3)} to ${Math.max(...rows.map(x => x.rMax)).toFixed(3)} m · inside a booster: ${rows.reduce((s, x) => s + x.inB, 0)} · lod ${got.lod} · off ${got.off} · errors: ${H.errs[0] || 'none'}`);
}

// aerofx-61. The edge filter on the graded frame (look & sound, QUEUE Q316's follow-up; Caio 2026-11-18: jagged edges on
// bright things). AA_FS can't run headless, so its edge walk is ported here line for line (bilinear lookups on a small
// grey image) and the shader is checked to hold the same lines: a staircase edge (a hull against space) becomes a ramp;
// a single bright pixel (a star) and a straight one-pixel line come through exactly; flat areas are untouched. The
// composite grades into SCN.out when the filter is on, and the grain is added after it.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const fs = pg.slice(pg.indexOf('const AA_FS=`'), pg.indexOf('`;', pg.indexOf('const AA_FS=`')));
  const filter = (img, W, Hh) => {
    const at = (x, y) => img[Math.min(Hh - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
    const tex = (x, y) => { const fx = x - .5, fy = y - .5, x0 = Math.floor(fx), y0 = Math.floor(fy), a = fx - x0, b = fy - y0;   // bilinear, texel centres at +.5
      return (at(x0, y0) * (1 - a) + at(x0 + 1, y0) * a) * (1 - b) + (at(x0, y0 + 1) * (1 - a) + at(x0 + 1, y0 + 1) * a) * b; };
    const out = new Float64Array(W * Hh);
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const ux = i + .5, uy = j + .5; let c = tex(ux, uy);
      const lM = c, lN = tex(ux, uy + 1), lS = tex(ux, uy - 1), lE = tex(ux + 1, uy), lW = tex(ux - 1, uy);
      const mx = Math.max(lM, lN, lS, lE, lW), mn = Math.min(lM, lN, lS, lE, lW);
      if (mx - mn >= Math.max(.05, mx * .125)) {
        const lNE = tex(ux + 1, uy + 1), lSW = tex(ux - 1, uy - 1), lNW = tex(ux - 1, uy + 1), lSE = tex(ux + 1, uy - 1);
        const eH = Math.abs(lNW + lSW - 2 * lW) + 2 * Math.abs(lN + lS - 2 * lM) + Math.abs(lNE + lSE - 2 * lE), eV = Math.abs(lNW + lNE - 2 * lN) + 2 * Math.abs(lW + lE - 2 * lM) + Math.abs(lSW + lSE - 2 * lS);
        const hz = eH >= eV, l1 = hz ? lS : lW, l2 = hz ? lN : lE, g1 = Math.abs(l1 - lM), g2 = Math.abs(l2 - lM), gs = .25 * Math.max(g1, g2); let st = 1, lA;
        if (g1 >= g2) { st = -st; lA = .5 * (l1 + lM); } else lA = .5 * (l2 + lM);
        let px = ux, py = uy; const ox = hz ? 1 : 0, oy = hz ? 0 : 1; if (hz) py += st * .5; else px += st * .5;
        let p1x = px - ox, p1y = py - oy, p2x = px + ox, p2y = py + oy, e1 = tex(p1x, p1y) - lA, e2 = tex(p2x, p2y) - lA, r1 = Math.abs(e1) >= gs, r2 = Math.abs(e2) >= gs;
        for (let k = 0; k < 10; k++) { if (r1 && r2) break; const q = k < 4 ? 1 : k < 6 ? 1.5 : k < 9 ? 2 : 4;
          if (!r1) { p1x -= ox * q; p1y -= oy * q; e1 = tex(p1x, p1y) - lA; r1 = Math.abs(e1) >= gs; } if (!r2) { p2x += ox * q; p2y += oy * q; e2 = tex(p2x, p2y) - lA; r2 = Math.abs(e2) >= gs; } }
        const d1 = hz ? ux - p1x : uy - p1y, d2 = hz ? p2x - ux : p2y - uy, po = .5 - Math.min(d1, d2) / (d1 + d2);
        if (((d1 < d2 ? e1 : e2) < 0) !== (lM < lA)) c = hz ? tex(ux, uy + po * st) : tex(ux + po * st, uy);
      }
      out[j * W + i] = c;
    }
    return out;
  };
  const W = 48, Hh = 24, mk = f => { const a = new Float64Array(W * Hh); for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) a[j * W + i] = f(i, j); return a; };
  // a hull's edge against space, one pixel up every eight along: bright (.9) above the line, dark (.05) below
  const stair = mk((i, j) => j >= 8 + Math.floor(i / 8) ? .9 : .05), sOut = filter(stair, W, Hh);
  const row = 11, before = Array.from({ length: 8 }, (_, k) => stair[row * W + 24 + k]), after = Array.from({ length: 8 }, (_, k) => sOut[row * W + 24 + k]);   // row 11 is the step's own row over columns 24–31
  const under = Array.from({ length: 8 }, (_, k) => sOut[(row - 1) * W + 24 + k]), mid = a => a.filter(v => v > .1 && v < .88).length, mono = a => a.every((v, k) => !k || v <= a[k - 1] + 1e-9);   // the row under it: dark before, lifted toward the step
  const mids = mid(after) + mid(under), flat0 = before.every(v => v === .9), spread = Math.max(...after) - Math.min(...under);
  const star = mk((i, j) => i === 20 && j === 10 ? 1 : .02), stOut = filter(star, W, Hh), starSame = star.every((v, k) => Math.abs(stOut[k] - v) < 1e-9);
  const line = mk((i, j) => j === 12 ? .8 : .03), lnOut = filter(line, W, Hh), lineSame = line.every((v, k) => Math.abs(lnOut[k] - v) < 1e-9);
  const ramp = mk((i, j) => .2 + .01 * i), rpOut = filter(ramp, W, Hh), rampSame = ramp.every((v, k) => Math.abs(rpOut[k] - v) < 1e-9);
  const has = {
    gate: fs.includes('if(mx-mn>=max(.05,mx*.125)){'),
    way: fs.includes('float eH=abs(lNW+lSW-2.*lW)+2.*abs(lN+lS-2.*lM)+abs(lNE+lSE-2.*lE),eV=abs(lNW+lNE-2.*lN)+2.*abs(lW+lE-2.*lM)+abs(lSW+lSE-2.*lS);'),
    side: fs.includes('if(g1>=g2){st=-st;lA=.5*(l1+lM);}else lA=.5*(l2+lM);'),
    walk: fs.includes('for(int i=0;i<10;i++){if(r1&&r2)break;float q=i<4?1.:i<6?1.5:i<9?2.:4.;'),
    shift: fs.includes('po=.5-min(d1,d2)/(d1+d2);') && fs.includes('if(((d1<d2?e1:e2)<0.)!=(lM<lA)){vec2 f=uv;if(hz)f.y+=po*st;else f.x+=po*st;c=texture(uS,f).rgb;}}'),
    on: pg.includes('let EDGE_AA=true;'),
    wiring: pg.includes('const aa=EDGE_AA&&!!PAA;') && pg.includes('gl.bindFramebuffer(gl.FRAMEBUFFER,up||aa?T.out.fb:null);') && pg.includes('gl.uniform1f(c.uGr,up||aa?0:GRADE.gr);')
      && pg.includes('gl.bindFramebuffer(gl.FRAMEBUFFER,up?T.aa.fb:null);') && pg.includes('gl.bindTexture(gl.TEXTURE_2D,aa?T.aa.t:T.out.t);') && pg.includes('aa=texRT(w,h,true),')
  };
  check('aerofx-61: the edge filter on the graded frame: a staircase edge becomes a ramp; a star, a straight one-pixel line and a smooth gradient come through exactly; the grade goes to a target and the grain comes after',
    flat0 && mid(after) >= 3 && mid(under) >= 3 && mono(after) && mono(under) && Math.abs(after[7] - .5) < .1 && starSame && lineSame && rampSame && Object.values(has).every(Boolean),
    `one step of the stair, its row: before ${before.map(v => v.toFixed(2)).join(' ')} → after ${after.map(v => v.toFixed(2)).join(' ')} and the row under it ${under.map(v => v.toFixed(2)).join(' ')} (${mids} of 16 between) · star same ${starSame} · line same ${lineSame} · gradient same ${rampSame} · ` + Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-62. The 3D view drawn above the screen's pixels when the GPU has room (look & sound; Caio 2026-11-18, on the
// edge filter: "the greebling on the craft and other elements still have the same issue"). Things about a pixel wide
// need more samples, averaged after the grade. High's cap is 150 %; resNext goes above 100 % only while the grown frame
// stays under SS_ROOM of the budget and steps back past SS_OVER; from below it stops at 100 % first; Low is as before.
// The pass that brought the frame up brings it down (at 2× exactly the 2×2 box), and the stars keep the screen's pixel.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const i = pg.indexOf('const RS_MIN='), j = pg.indexOf('// Without timer queries', i);
  const { resNext, GPU_BUDGET, SS_ROOM, SS_OVER } = new Function(pg.slice(i, j) + ';return{resNext,GPU_BUDGET,SS_ROOM,SS_OVER}')();
  const Q = new Function(pg.slice(pg.indexOf('const QUAL={'), pg.indexOf('const setGet=')) + ';return QUAL')();
  // the game's loop, 0.6 s a step: a GPU whose frame is a fixed part plus one that goes as the pixel count
  const run = (rs, cap, fixed, perPx, n = 60) => { let avg = null; const tr = []; for (let k = 0; k < n; k++) { const ms = fixed + perPx * rs * rs; avg = avg == null ? ms : avg * .3 + ms * .7; rs = resNext(rs, avg / GPU_BUDGET, cap); tr.push(rs); } return tr; };
  const end = tr => tr.at(-1), still = tr => tr.slice(-20).every(r => r === tr.at(-1)), ms = (rs, f, p) => f + p * rs * rs;
  const light = run(1, Q.high.rs, 1, 2), mid = run(1, Q.high.rs, 1, 4), busy = run(1, Q.high.rs, 2, 6);   // 3, 5 and 8 ms at 100 %
  const met = run(Q.high.rs, Q.high.rs, 2, 6), up = run(.6, Q.high.rs, 2, 6), low = run(.6, Q.low.rs, .5, 1);   // the 8 ms scene met at 150 %; and come to from below
  const sizes = Q.high.rs === 1.5 && Q.low.rs === .6;
  const scaler = end(light) === 1.5 && still(light) && end(mid) > 1 && end(mid) < 1.5 && still(mid) && ms(end(mid), 1, 4) < SS_ROOM * GPU_BUDGET
    && busy.every(r => r === 1) && still(met) && end(met) >= 1 && end(met) < 1.2 && ms(end(met), 2, 6) < SS_OVER * GPU_BUDGET && end(up) === 1 && still(up) && low.every(r => r === .6);
  // the down filter in one dimension: four bilinear taps, a quarter of a canvas pixel either side of its centre
  const tap = (img, x) => { const f = x - .5, x0 = Math.floor(f), a = f - x0, at = k => img[Math.min(img.length - 1, Math.max(0, k))]; return at(x0) * (1 - a) + at(x0 + 1) * a; };
  const down = (img, k) => Array.from({ length: Math.floor(img.length / k) }, (_, d) => { const c = (d + .5) * k; return .5 * (tap(img, c - .25 * k) + tap(img, c + .25 * k)); });
  const stripes = Array.from({ length: 32 }, (_, k) => k % 2), half = down(stripes, 2).every(v => Math.abs(v - .5) < 1e-12);   // one-texel stripes: an even grey, not a beat
  const step = down(Array.from({ length: 32 }, (_, k) => k >= 15 ? 1 : 0), 2), box = step[6] === 0 && Math.abs(step[7] - .5) < 1e-12 && step[8] === 1;
  const flat = down(new Array(30).fill(.37), 1.5).every(v => Math.abs(v - .37) < 1e-12);
  const has = {
    down: pg.includes('if(uDn>1.){vec2 q=.25*uDn*px;c=(texture(uS,uv-q).rgb+texture(uS,uv+vec2(q.x,-q.y)).rgb+texture(uS,uv+vec2(-q.x,q.y)).rgb+texture(uS,uv+q).rgb)*.25;}else{'),
    wiring: pg.includes('gl.uniform1f(q.uSh,Math.max(0,Math.min(1,1.6*(1-w/cv.width))));gl.uniform1f(q.uDn,w/cv.width);'),
    stars: pg.includes('float rad=min(uSPx*(.6+.45*sqrt(br)),.22/sc);') && pg.includes('exp(-r/(uSPx*5.))') && pg.includes('rad=uSPx*uPlnC[i].w;') && pg.includes('if(u.uSPx)gl.uniform1f(u.uSPx,2*tanY/H*Math.max(1,W/cv.width));'),
    blind: pg.includes('else if(!late&&RS<Math.min(1,RS_MAX)&&RSP.t>RSP.wait){RS=Math.min(1,RS_MAX,RS*1.12);')
  };
  check('aerofx-62: the 3D view above the screen\'s pixels when the GPU has room: High up to 150 %, only while the frame stays under 60 % of the budget, back toward 100 % past 85 %; from below it stops at 100 %; Low as before; the down filter is the 2×2 box at 2×; the stars keep the screen\'s pixel',
    sizes && scaler && half && box && flat && Object.values(has).every(Boolean),
    `3 ms scene → ${(end(light) * 100).toFixed(0)} % · 5 ms → ${(end(mid) * 100).toFixed(0)} % at ${ms(end(mid), 1, 4).toFixed(1)} ms · 8 ms → ${busy.every(r => r === 1) ? '100 % throughout' : (end(busy) * 100).toFixed(0) + ' %'} · met at 150 % → ${(end(met) * 100).toFixed(0)} % at ${ms(end(met), 2, 6).toFixed(1)} ms · from 60 % → ${(end(up) * 100).toFixed(0)} % · Low ${(end(low) * 100).toFixed(0)} % · stripes ${half} · box ${box} · flat ${flat} · ` + Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-63. Fins with a section, and a flap on the ones that steer (look & sound parts & pad, QUEUE Q635; Caio
// 2026-11-25: "the fins, which look boxy. also, if they have a control element, like flaps, i'd like that graphically
// represented"). fin() built headless: the plate is an aerofoil (thickest 30 % back, a round nose, a thin trailing edge,
// thinner at the tip, flaring into the hull), every normal points out of it; a steerable fin is cut for a flap of its own
// kind (FLAP_K), which clears the cove at any swing, and nothing fixed stands in the flap's way. MESH_VS turns only that
// kind about the hinge setMoves gives it; the sim's plate is untouched.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const src = pg.slice(pg.indexOf('const VX=16'), pg.indexOf('const KIND=')) + pg.slice(pg.indexOf('function pv('), pg.indexOf('// surface of revolution')) +
    pg.slice(pg.indexOf('const C={W:'), pg.indexOf('function box(')) + pg.slice(pg.indexOf('let FIN_FX=true;'), pg.indexOf('// station trim')) + body('tube');
  const K = new Function('return ' + /const KIND=(\{[^}]*\})/.exec(pg)[1])();
  const { fin, FLAP_K, FLAP_CH, FLAP_IN, FLAP_GAP, FLAP_GAIN, FIN_TIP, FIN_RND, C, slab } = new Function('norm', 'cross', 'sub', 'mul', 'add', 'len', 'clamp',
    src + ';return{fin,FLAP_K,FLAP_CH,FLAP_IN,FLAP_GAP,FLAP_GAIN,FIN_TIP,FIN_RND,C,slab:(...a)=>{FIN_FX=false;try{fin(...a)}finally{FIN_FX=true}}}')(norm, cross, sub, mul, add, len, (x, a, b) => Math.min(b, Math.max(a, x)));
  const R = .625, sp = .9, ch = .9, t = .035, yh = FLAP_CH * ch;
  const mk = (f, opt) => { const o = []; f(o, [0, 0, 0], 0, R, sp, ch, t, C.W, opt); const V = [];
    for (let i = 0; i < o.length; i += 16) V.push({ r: o[i], y: o[i + 1], z: o[i + 2], n: [o[i + 3], o[i + 4], o[i + 5]], k: o[i + 14] }); return V };
  const fixed = mk(fin), steer = mk(fin, { flap: true }), old = mk(slab), all = [...fixed, ...steer];
  const finite = all.every(v => [v.r, v.y, v.z, ...v.n].every(Number.isFinite)) && all.every(v => Math.abs(len(v.n) - 1) < 1e-6);
  const tubes = v => Math.abs(v.r - (R + .24 * sp)) < .02;   // the horns and the actuators' fairings: round, so half of each faces the plate
  const outward = all.every(v => Math.abs(v.z) < 1e-4 || v.n[2] * v.z > -1e-9 || tubes(v)) && fixed.every(v => !tubes(v));
  // the section: half-thickness where the plate is thickest, by distance from the hull; and along the chord at mid-span
  const thick = (V, r0, r1) => Math.max(...V.filter(v => v.r >= r0 && v.r <= r1).map(v => Math.abs(v.z)));
  const root = thick(fixed, R - .05, R + 1e-6), mid = thick(fixed, R + FLAP_IN * sp - 1e-6, R + FLAP_IN * sp + 1e-6), tip = thick(fixed, R + sp - 1e-6, R + sp + 1e-6);
  const at65 = fixed.filter(v => Math.abs(v.r - (R + sp)) < 1e-6 && v.z > 0), cLE = ch * (.45 - FIN_RND), xOf = v => 1 - v.y / cLE,
    best = at65.reduce((b, v) => v.z > b.z ? v : b), te = Math.max(...at65.filter(v => xOf(v) > .999).map(v => v.z)), nose = fixed.filter(v => v.n[2] === 0 && v.n[1] > .5 && v.n[0] > .3);
  const section = root > 1.4 * t && root < 1.75 * t && mid < t && mid > .7 * t && Math.abs(tip - FIN_TIP * t) < .08 * t && Math.abs(xOf(best) - .3) < .01 && te < .15 * best.z && nose.length > 6
    && new Set(fixed.map(v => v.n.map(x => x.toFixed(3)).join())).size > 80 && new Set(old.map(v => v.n.map(x => x.toFixed(3)).join())).size === 6;
  const bounds = all.every(v => v.r >= R - .031 && v.r <= R + sp + 1e-9 && v.y >= -1e-9 && v.y <= ch + 1e-9) && fixed.every(v => v.k === 0);
  // the flap: its own kind, outboard of the cut's inner wall, and nothing fixed in the space it swings through
  const flap = steer.filter(v => v.k === FLAP_K), rest = steer.filter(v => v.k !== FLAP_K), rin = R + FLAP_IN * sp;
  const noseAt = r => Math.max(0, ...flap.filter(v => v.y > yh && Math.abs(v.r - r) < .02).map(v => Math.hypot(v.y - yh, v.z))), reach = Math.max(...flap.filter(v => v.y > yh).map(v => Math.hypot(v.y - yh, v.z)));
  const out = rest.filter(v => v.r > rin + 1e-6), cove = Math.min(...out.map(v => v.y - yh)), clear = out.every(v => { const n = noseAt(v.r); return v.y - yh >= (n ? n + FLAP_GAP - 1e-6 : reach) });   // station by station: the fin stops a gap ahead of the flap's round nose
  const cut = flap.length > 250 && rest.every(v => v.k === 0) && flap.every(v => v.r >= rin + FLAP_GAP - 1e-9 && v.y <= yh + reach + 1e-9)
    && reach > .01 && clear
    && rest.filter(v => v.r <= rin + 1e-6).some(v => v.y < 1e-9);   // the inboard stub keeps the whole chord
  const free = FLAP_K !== 17 && FLAP_K !== 18 && FLAP_K < 32 && !Object.values(K).includes(FLAP_K) && /SOLAR_K=17/.test(pg) && /GREEBLE_K=18/.test(pg);
  const vs = pg.slice(pg.indexOf('const MESH_VS='), pg.indexOf('const MESH_FS=')), sm = body('setMoves'), pb = body('partBody');
  const has = {
    vs: vs.includes('if((k==2||k==19||k==20)&&aK.y>-.5)') && vs.includes('else if(k!=19);') && !vs.includes('k==6'),
    fs: pg.includes('else if(k==6||k==19){'),
    moves: sm.includes('p.y0+FLAP_CH*d.chord,p.pos[2],i,2,') && sm.includes('p.y0+FLAP_CH*d.h,p.pos[2],i,3,Math.cos(p.phi),Math.sin(p.phi)') && sm.includes('FIN_FX?FLAP_GAIN:0'),
    parts: (pb.match(/flap:!!d\.ctl/g) || []).length === 2,
    gain: FLAP_GAIN * 20 <= 35   // 20° of plate is at most 35° of flap
  };
  check('fins have a section and the steerable ones a flap (Q635): an aerofoil thickest 30 % back, thinner to the tip, flaring into the hull, normals out; the flap its own kind, clear of its cove, turned alone by MESH_VS about the hinge; the sim\'s plate untouched',
    finite && outward && section && bounds && cut && free && Object.values(has).every(Boolean),
    `fixed fin ${fixed.length} vertices (slab ${old.length}), steerable ${steer.length} of which flap ${flap.length} · half-thickness root ${(root * 1000).toFixed(0)} mm, ${(FLAP_IN * 100).toFixed(0)} % span ${(mid * 1000).toFixed(0)}, tip ${(tip * 1000).toFixed(0)}; thickest at ${(xOf(best) * 100).toFixed(0)} % chord, trailing edge ${(te * 1000).toFixed(1)} mm · flap nose reach ${(reach * 1000).toFixed(0)} mm, cove at ${(cove * 1000).toFixed(0)} · ` +
    `finite ${finite} outward ${outward} section ${section} bounds ${bounds} cut ${cut} free ${free} · ` + Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' '));
}

// aerofx-64. The RCS jet (look & sound, effects; Q634, PLAYTEST #168: "the gas release is still a placeholder graphic").
// A cold-gas jet per nozzle in place of the glowing box: short, gone a tenth of a second after its pulse, mostly
// transparent, white in the sun and next to nothing in a body's shadow. The numbers are RCS_JET's; the picture is JET_FS
// (its column of gas across the axis is mirrored here from the same numbers).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const i = pg.indexOf('const RCS_JET='), j = pg.indexOf('const VTR_VS=', i);
  const { RCS_JET: K, rcsJet, rcsJetCol } = new Function('clamp', pg.slice(i, j) + ';return{RCS_JET,rcsJet,rcsJetCol}')((x, a, b) => x < a ? a : x > b ? b : x);
  // one 20 ms pulse is seen, and it is gone soon after; never brighter later than earlier
  const ages = Array.from({ length: 40 }, (_, k) => k * K.T / 40), js = ages.map(a => rcsJet(150, a));
  const seen = !!rcsJet(150, .02) && rcsJet(150, 0).a === 1 && rcsJet(150, 0).gone === 0, gone = rcsJet(150, K.T) === null && rcsJet(150, -1) === null && K.T <= .15;
  const fades = js.every((q, k) => q && (!k || (q.a < js[k - 1].a && q.gone > js[k - 1].gone)));
  // short, and it goes with the thrust within bounds
  const L = rcsJet(150, 0).L, short = L > .6 && L < 2 && rcsJet(600, 0).L > L && rcsJet(1e6, 0).L <= 2.5 * K.L && rcsJet(1, 0).L >= .6 * K.L;
  // the light: the sun as it is in orbit (lightEnv's 5 a channel), no fill; then the same place in a body's shadow
  const E = { sun: [5, 5, 5], sky: [0, 0, 0], gnd: [0, 0, 0] }, sun = rcsJetCol(E, 1), dark = rcsJetCol(E, 0);
  const white = Math.max(...sun) / Math.min(...sun) < 1.05 && sun[0] > 1, faint = dark[0] > 0 && dark[0] < .1 && sun[0] / dark[0] > 20;
  // what a ray across the axis meets, y metres from the bell (JET_FS's sum, done exactly: a Gaussian's integral)
  const al = y => { const s = K.r0 + y * K.tan, e = 1 - y / L; return Math.max(0, K.op * (1 - Math.exp(-K.k * Math.sqrt(Math.PI) * K.r0 / s * e * e * e)) - .003); };
  const thin = K.op <= .5 && al(0) > .2 && al(L / 2) < .1 && al(.95 * L) === 0;
  const has = {
    drawn: pg.includes('gl.uniform3fv(u.uCol,rcsJetCol(lightEnv(p),lit(p)));') && pg.includes('gl.uniform4f(u.uJ,jt.L,jt.a,jt.gone,RCS_JET.op);'),
    shader: pg.includes('float al=uJ.w*uJ.y*(1.-exp(-KD*c*ds/R0))-.003;') && pg.includes('R0*R0/(s*s)*exp(-dot(p.xz,p.xz)/(s*s))*e*e*e*smoothstep(.6*uJ.z,uJ.z+1e-4,p.y)'),
    box: !pg.includes('PUFF.vao') && !pg.includes('const PUFF='),
    back: pg.includes('if(on){gl.cullFace(gl.BACK);gl.disable(gl.CULL_FACE);gl.blendFunc(gl.ONE,gl.ONE);gl.useProgram(PMESH.p)}}')
  };
  check('aerofx-64: the RCS jet: a pulse is seen and gone within ' + K.T * 1000 + ' ms, fading all the way; short; white in the sun, over 20 times fainter in shadow but not nothing; mostly transparent; the placeholder box is gone',
    seen && gone && fades && short && white && faint && thin && Object.values(has).every(Boolean),
    `seen ${seen} · gone ${gone} · fades ${fades} · ${L.toFixed(2)} m at 150 N · sun ${sun[0].toFixed(2)} · shadow ${dark[0].toFixed(3)} (1/${(sun[0] / dark[0]).toFixed(0)}) · covers ${(al(0) * 100).toFixed(0)} % at the bell, ${(al(L / 2) * 100).toFixed(1)} % halfway · ` + Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' · '));
}

// aerofx-65. The craft's surface (look & sound parts & pad, QUEUE Q637; Caio 2026-11-25): the home power's name
// stencilled down a tall tank, bare metal with a turned grain, the cabin's light in the capsule's window. All in
// MESH_FS, no geometry. hullBits packs a word as FONT57's 35 bits a letter in two ints, the way the shader's gbit reads
// them back (checked here by reading every letter back, pixel by pixel); accents, case, length and letters the font
// lacks are handled; the shader has the three pieces and their A/B switches.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const FONT57 = new Function('return ' + /const FONT57=(\{[^}]*\})/.exec(pg)[1])();
  const hullBits = new Function('FONT57', body('hullBits') + ';return hullBits')(FONT57);
  // the shader's gbit, in JS: row r from the top, column c from the left
  const gbit = (hi, lo, r, c) => r < 0 || r > 6 || c < 0 || c > 4 ? 0 : r < 4 ? (hi >> (19 - r * 5 - c)) & 1 : (lo >> (14 - (r - 4) * 5 - c)) & 1;
  const fontBit = (ch, r, c) => Math.floor(parseInt(FONT57[ch], 36) / 2 ** (34 - r * 5 - c)) & 1;   // as padText reads it
  const abc = Object.keys(FONT57).filter(k => k !== '-'), all = hullBits(abc.slice(0, 12).join('')), rest = hullBits(abc.slice(12, 24).join('')), last = hullBits(abc.slice(24).join(''));
  let back = true; [[all, abc.slice(0, 12)], [rest, abc.slice(12, 24)], [last, abc.slice(24)]].forEach(([b, L]) => L.forEach((ch, i) => { for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gbit(b.a[i * 2], b.a[i * 2 + 1], r, c) !== fontBit(ch, r, c)) back = false }));
  const fits = [all, rest, last].every(b => b.a.every(v => v >= 0 && v < 2 ** 20));   // both halves fit an int with room
  const w = hullBits('Dünnzar'), same = hullBits('DUNNZAR'), long = hullBits('abcdefghijklmnopqrstuvwxyz'), odd = hullBits('a1b'), none = hullBits('');
  const words = w.n === 7 && w.a.join() === same.a.join() && long.n === 12 && odd.n === 2 && none.n === 0 && none.a.every(v => v === 0) && abc.length === 26;
  const fs = pg.slice(pg.indexOf('const MESH_FS='), pg.indexOf('function mkProg('));
  const has = {
    read: fs.includes('float gbit(ivec2 g,int r,int c){if(r<0||r>6||c<0||c>4)return 0.;return float(r<4?(g.x>>(19-r*5-c))&1:(g.y>>(14-(r-4)*5-c))&1);}'),
    letters: fs.includes('if(uTxN>0&&h>3.*sc){') && fs.includes('ltr=glyph(uTx[li],vec2(2.5-x/px,fract(tl)*9.-1.)') && fs.includes('if(ltr>0.)alb=mix(alb,dot(alb,vec3(.3,.59,.11))>.1?vec3(.012,.012,.014):vec3(.75),ltr);'),
    afterPaint: fs.indexOf('if(ltr>0.)alb=mix(') > fs.indexOf('alb=mix(alb,rdl.rgb,rdl.a);') && fs.indexOf('if(ltr>0.)alb=mix(') < fs.indexOf('// (Q316, BEAUTY B1.4) the skin under the paint'),
    grain: fs.includes('if(uSf.x>0.&&uSeam>0.&&metal>.5&&m!=5&&k!=2&&k!=3&&k!=17&&side){') && fs.includes('if(bsp>0.){vec3 ax=normalize(mat3(uM)*vec3(0.,1.,0.))*bsp;'),
    cabin: fs.includes('*win*uSf.y*(1.-.95*clamp(dot(uSunCol,vec3(.33))*uLit,0.,1.));'),
    wired: pg.includes('function setMarks(u,parts){setHull(u);') && body('setHull').includes('gl.uniform2iv(u[\'uTx[0]\'],HULL.a)') && body('setHull').includes('GRAIN_FX?1:0,CABIN_FX?1:0') && pg.includes('let HULL_FX=true,GRAIN_FX=true,CABIN_FX=true;')
  };
  check('the craft\'s surface (Q637): the home power\'s name down a tall tank (FONT57 read back bit for bit as the shader reads it; accents, case, 12 letters at most), laid on after the school\'s paint; a turned grain on bare metal; the cabin\'s light in the window, faint in sunlight',
    back && fits && words && Object.values(has).every(Boolean),
    `${abc.length} letters read back ${back} · halves fit ${fits} · words ${words} (Dünnzar → ${w.n} letters, 26 letters → ${long.n}) · ` + Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' '));
}

// aerofx-66. Engine plumbing and the thrust structure (look & sound parts & pad, QUEUE Q638; the rest of BEAUTY B1.5).
// enginePlumbing built headless for each engine: a manifold ring and two downcomers of a kind of their own (FIT_K), which
// MESH_VS's mode 1 turns with the bell, all of it on the bell's wall (the brackets seated in it) and below the throat; two actuators of the
// mount's kind (fixed) from the cone to brackets on the bell. The mount's cone has ribs in MESH_FS. Fins: the tip's
// leading corner is rounded (the nose line drops FIN_RND of the chord over the last tenth of the span).
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const K = new Function('return ' + /const KIND=(\{[^}]*\})/.exec(pg)[1])();
  const src = pg.slice(pg.indexOf('const VX=16'), pg.indexOf('const KIND=')) + pg.slice(pg.indexOf('function pv('), pg.indexOf('// surface of revolution')) +
    pg.slice(pg.indexOf('const C={W:'), pg.indexOf('function box(')) + pg.slice(pg.indexOf('let BELL_FX=true;'), pg.indexOf('function engine(')) + body('tube');
  const clampJ = (x, a, b) => Math.min(b, Math.max(a, x));
  const { enginePlumbing, FIT_K, raoBell, BELL_RAO } = new Function('norm', 'cross', 'sub', 'mul', 'add', 'len', 'clamp', 'KIND', src + ';return{enginePlumbing,FIT_K,raoBell,BELL_RAO}')(norm, cross, sub, mul, add, len, clampJ, K);
  const rows = [], bad = [];
  for (const key of ['wren', 'sparrow', 'petrel', 'kestrel', 'condor']) { const d = api.PARTS[key], prof = d.prof.map(([r, y]) => [r, y, [.5, .5, .5]]); let ti = 0; for (let i = 1; i < prof.length; i++) if (prof[i][0] < prof[ti][0]) ti = i;
    const [rt, yt] = prof[ti], RB = BELL_RAO[key], bell = RB && ti === 1 ? raoBell(prof[0][0], rt, yt, RB[0], RB[1], [0, 0, 0], [0, 0, 0]) : prof.slice(0, ti + 1);
    const rAt = y => { for (let i = 0; i < bell.length - 1; i++) { const [r0, y0] = bell[i], [r1, y1] = bell[i + 1]; if (y <= y1 + 1e-9) return r0 + (r1 - r0) * (y - y0) / Math.max(y1 - y0, 1e-9) } return rt };
    const o = []; enginePlumbing(o, { d: { key } }, prof, ti, [0, 0, 0], { o: [0, 0, 0], k: K.mount, R: d.r || .625, h: d.h, i: 3 });
    const V = []; for (let i = 0; i < o.length; i += 16) V.push({ r: Math.hypot(o[i], o[i + 2]), y: o[i + 1], k: o[i + 14], pi: o[i + 15], ok: [o[i], o[i + 1], o[i + 2], o[i + 3], o[i + 4], o[i + 5]].every(Number.isFinite) });
    const fit = V.filter(v => v.k === FIT_K), fix = V.filter(v => v.k === K.mount), clear = Math.min(...fit.map(v => v.r - rAt(Math.max(v.y, 0))));
    if (!V.every(v => v.ok && v.pi === 3)) bad.push(key + ': a bad vertex');
    if (fit.length < 300 || fix.length < 100 || fit.length + fix.length !== V.length) bad.push(`${key}: ${fit.length} fitting + ${fix.length} fixed of ${V.length}`);
    if (clear < -.04) bad.push(`${key}: a fitting ${(-clear * 1000).toFixed(0)} mm inside the bell`);
    if (!fit.every(v => v.y > 0 && v.y < yt + .02) || !fix.every(v => v.y > yt * .6 && v.y < d.h)) bad.push(key + ': out of its span');
    rows.push(`${key} ${V.length} (clear ${(clear * 1000).toFixed(0)} mm)`) }
  const vs = pg.slice(pg.indexOf('const MESH_VS='), pg.indexOf('const MESH_FS=')), fsh = pg.slice(pg.indexOf('const MESH_FS='), pg.indexOf('function mkProg('));
  const has = {
    free: FIT_K === 20 && !Object.values(K).includes(FIT_K) && /SOLAR_K=17/.test(pg) && /GREEBLE_K=18/.test(pg) && /FLAP_K=19/.test(pg),
    moves: vs.includes('if((k==2||k==19||k==20)&&aK.y>-.5)') && vs.includes('if(B.x<1.5){if(k==2||k==20){P=A.xyz+qrv(Q,d);N=qrv(Q,N);}}'),
    called: body('engine').includes('if(PLUMB_FX)enginePlumbing(out,p,prof,ti,o,K);') && pg.indexOf('if(PLUMB_FX)enginePlumbing(') > pg.indexOf('PK={...K,k:KIND.mount};lathe(out,prof.slice(ti),o,28,[false,true]);'),   // after the bell, so bellThroat still finds the bell first
    ribs: fsh.includes('if(MOUNT_ON&&vNo.y<-.3&&m==0){') && fsh.includes('const bool MOUNT_ON=true;'),
    tip: pg.includes('FIN_US=[0,.05,FLAP_IN,.9,.965,1],FIN_RND=.11;') && pg.includes('const w=clamp((u-.9)/.1,0,1);return ch*(1-.55*u-FIN_RND*(1-Math.sqrt(1-w*w)))')
  };
  check('engine plumbing and the thrust structure (Q638): a manifold and downcomers that turn with the bell (their own kind, on its wall: the brackets seated up to 4 cm in), actuators fixed to the mount, ribs on the cone; the fins\' tips rounded',
    !bad.length && Object.values(has).every(Boolean), (bad.length ? bad.join('; ') + ' · ' : '') + rows.join(' · ') + ' · ' + Object.entries(has).map(([k, v]) => `${k} ${v}`).join(' '));
}

// aerofx-67. Ice off the tanks at liftoff, vapor from them on the pad (look & sound parts & pad, QUEUE Q639; BEAUTY
// B1.6). iceTick run headless on a two-tank ship: on the pad only wisps, about ICE.wisps a second per tank, slow and
// faint; after liftoff flakes for ICE.T seconds, most of them early, from the skin of frosted tanks below the fuel
// line, leaving with the rocket's speed and falling; none from a tank with no frost, off Tellus, in thin air, with the
// setting off; half on Low; a long step (time warp) does not burst.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const decl = /let ICE_FX=true;const ICE=\{[^}]*\};/.exec(pg)[0];
  const mk = () => new Function('add', 'sub', 'mul', 'norm', 'len', 'qrot', 'clamp', 'surfVel', 'localFrame', 'TELLUS', 'env',
    `${decl}let S=null,simT=0,quality='high';const fxPuff=(r,v,o)=>env.puffs.push({r,v,o}),markOf=p=>p.mark;${body('iceTick')}
     return{ICE,tick:(dt,pad,pr)=>iceTick(dt,pad,pr),set:(s,t,q)=>{S=s;simT=t;if(q)quality=q},off:()=>{ICE_FX=false}}`);
  const up = [1, 0, 0], frame = () => ({ up, n: [0, 1, 0], e: [0, 0, 1] }), R0 = [6e5, 0, 0], V0 = [12, 0, 180];
  const ship = (frost = 1) => ({ alive: true, body: TELLUS, r: R0, v: V0, q: [0, 0, 0, 1], cm: [0, 5, 0], mkLiftT: 0, parts: [
    { on: true, d: { kind: 'tank', r: .625 }, pos: [0, 0, 0], y0: 0, h: 7, cap: { fuel: 8 }, res: { fuel: 6 }, mark: { frost } },
    { on: true, d: { kind: 'tank', r: .625 }, pos: [0, 0, 0], y0: 8, h: 2, cap: { fuel: 2 }, res: { fuel: 2 }, mark: { frost } },
    { on: true, d: { kind: 'engine', r: .625 }, pos: [0, 0, 0], y0: -1.3, h: 1.3, cap: {}, res: {}, mark: { frost: 0 } }] });
  const run = (o = {}) => { const env = { puffs: [] }, M = mk()(add, sub, mul, norm, len, (q, v) => v, (x, a, b) => Math.min(b, Math.max(a, x)), () => [0, 0, 180], frame, o.body || TELLUS, env);
    const s = ship(o.frost ?? 1); if (o.body2) s.body = o.body2; if (o.off) M.off(); const real = Math.random; let seed = 7; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    try { const dt = o.dt || 1 / 60; for (let t = 0; t < (o.T || 12); t += dt) { M.set(s, t, o.q); M.tick(dt, !!o.pad, o.pr ?? 1) } } finally { Math.random = real } return { p: env.puffs, ICE: M.ICE } };
  const padRun = run({ pad: true, T: 20 }), fly = run(), ICE = fly.ICE, flakes = fly.p, expect = ICE.rate * 2 * ICE.tau * (1 - Math.exp(-ICE.T / ICE.tau));
  const hy = p => p.r[1] + 5, rad = p => Math.hypot(p.r[0] - R0[0], p.r[2]);   // the ship's frame is the world's here (q = identity): height above the first tank's foot, distance from the axis
  const wisps = padRun.p.length > 20 * 2 * ICE.wisps * .8 && padRun.p.length < 20 * 2 * ICE.wisps * 1.2 && padRun.p.every(p => !p.o.g && p.o.a0 < .4 && p.o.grow > 0 && len(sub(p.v, [0, 0, 180])) < 1.6 && rad(p) > .62);
  const count = Math.abs(flakes.length - expect) < .15 * expect;
  const shape = flakes.every(p => p.o.g && Math.abs(p.o.g[0] + ICE.g) < 1e-9 && p.o.grow === 0 && p.o.s0 < .1 && p.o.life < 3.5 && len(sub(p.v, V0)) < 1.7 && Math.abs(rad(p) - .645) < 1e-6 && ((hy(p) >= 0 && hy(p) <= 7 * .75 + 1e-9) || (hy(p) >= 8 && hy(p) <= 10 + 1e-9)));
  const none = [run({ frost: 0 }), run({ pr: .2 }), run({ off: true }), run({ body2: {} })].every(x => x.p.length === 0);
  const low = run({ q: 'low' }).p.length, warp = run({ dt: 4 }).p.length, lowOk = Math.abs(low - expect / 2) < .2 * expect / 2, warpOk = warp <= 2 * ICE.max * .1 * 3 + 2;
  const has = { call: pg.includes('iceTick(dt,pad,pr);   // (Q639)'), setting: H.includes("ICE_FX=setGet('launchpad-ice','0')==='1';") && H.includes("else if(id==='setIce'){ICE_FX=on;setPut('launchpad-ice',on?'1':'0')}") && H.includes("ck('setIce',ICE_FX,") };
  check('ice and vapor off the tanks (Q639): wisps on the pad, slow and faint; flakes for a few seconds after liftoff, from frosted skin below the fuel line, falling; none without frost, off Tellus, in thin air or switched off; half on Low; no burst in a long step',
    wisps && count && shape && none && lowOk && warpOk && Object.values(has).every(Boolean),
    `pad 20 s: ${padRun.p.length} wisps · liftoff: ${flakes.length} flakes (expected ${expect.toFixed(0)}), Low ${low}, a 4 s step ${warp} · wisps ${wisps} count ${count} shape ${shape} none ${none} low ${lowOk} warp ${warpOk} · call ${has.call} setting ${has.setting}`);
}

// aerofx-68. The plume, brighter and with weight (look & sound effects, QUEUE Q640; PLAYTEST #181, #122). plumeShape:
// a kerolox flame at sea level is twice the old length and nearly a column (its edge spreads under a tenth of its
// length), hydrogen's is the old length, all are 2.4 × in vacuum as before; the vacuum plume is a bulb (it has done most
// of its widening by a third of its length); the proxy's radius covers the jet's edge at its end. The shader: the
// radiance gain and each propellant's own, the body of the flame, the halo, the fades before the proxy's cap and side.
// The proxy mesh: its far cap is wound like its wall (the hole seen from behind). And the engine's sound (Q514,
// PLAYTEST #146): the roar's lowpass under 900 Hz on the pad, the low end as noise with a clipped upper-bass layer.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const body = n => { const i = pg.indexOf('function ' + n + '('); let j = i, d = 0; for (; j < pg.length; j++) { if (pg[j] === '{') d++; else if (pg[j] === '}' && --d === 0) break; } return pg.slice(i, j + 1); };
  const consts = /const PL_B=\[[^\]]*\],PL_AIR=[^;]*;/.exec(pg)[0], props = pg.slice(pg.indexOf('const PROPS={'), pg.indexOf('const pfxOf=')), pfx = /const pfxOf=[^\n]*/.exec(pg)[0];
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
  const M = new Function('sstep', 'clamp', /const PL_VAC=[^;]*;/.exec(pg)[0] + consts + props + pfx + body('plumeShape') + ';return{plumeShape,PROPS,PL_B,PL_AIR,PL_TAIL,PLK,PL_HALO}')(ss, (x, a, b) => Math.min(b, Math.max(a, x)));
  const K = { key: 'kestrel', exit: .55, ispA: 285, ispV: 315 }, P = { key: 'petrel', exit: .6, ispA: 90, ispV: 345 };
  const [, tn0, L0, R0] = M.plumeShape(K, 1, 1), [, tnV, LV, RV] = M.plumeShape(P, 1, 0), Lh = M.plumeShape(K, .5, 1)[2];
  // rb as the shader has it (no igniter), from the same constants
  const rb = (s, re, n, tn, pa, L) => re * (1 + (Math.sqrt(Math.min(1, Math.max(.3, n))) - 1) * ss(0, 1.5 * re, s)) + tn * (M.PL_B[0] * re * (1 - Math.exp(-s / (M.PL_B[1] * re))) + M.PL_B[2] * s) + pa * s * (M.PL_AIR + M.PL_TAIL * ss(.35 * L, L, s));
  const col = rb(L0, .55, .75, tn0, 1, L0) - rb(0, .55, .75, tn0, 1, L0), third = rb(LV / 3, .6, 1e3, tnV, 0, LV) / rb(LV, .6, 1e3, tnV, 0, LV);
  const shape = Math.abs(L0 - .55 * 22 * 2) < 1e-9 && Math.abs(LV - .6 * 22 * 2.4) < 1e-9 && Lh < L0 && col < .1 * L0 && third > .5 && R0 >= rb(L0, .55, .75, tn0, 1, L0) && RV >= rb(LV, .6, 1e3, tnV, 0, LV);
  const pr = Object.values(M.PROPS).every(p => p.len >= 1 && p.len <= 2.4 && p.lum > 0) && M.PROPS.kerolox.len === 2 && M.PROPS.hydrolox.len === 1 && M.PROPS.solid.lum > M.PROPS.kerolox.lum && M.PROPS.hydrolox.lum < .3 && M.PLK >= 6;
  const fs = pg.slice(pg.indexOf('const PLUME_FS=`'), pg.indexOf('`;', pg.indexOf('const PLUME_FS=`'))), mesh = /const PLUME=\(\(\)=>\{[^\n]*\n[^\n]*/.exec(pg)[0];
  const sh = { gain: fs.includes('vec3 e=uI*PLK*uLm*('), body: fs.includes('bc*body*.3') && fs.includes('+body*.12))*st)'), halo: fs.includes('if(u>1.4){C+=Tr*uI*PLK*uLm*HALO*burn'),
    fades: fs.includes('*smoothstep(R,.82*R,r)') && fs.includes('*smoothstep(L,.86*L,s)'), core: fs.includes('Lp=re*(3.5+2.5*uS.w)*mix(1.,uLn,uS.w)'),
    set: pg.includes('gl.uniform1f(pu.uLn,P.len||1);gl.uniform1f(pu.uLm,P.lum||1);'), rbS: /const PLUME_RB=`[^`]*PL_B\[0\][^`]*PL_TAIL[^`]*`;/.test(pg),
    cap: mesh.includes('lathe(a,pr,[0,0,0],n,[true,false])') && mesh.includes('pv(a,[0,-1,0],[0,-1,0],w);pv(a,[Math.cos(a1),-1,Math.sin(a1)],[0,-1,0],w);pv(a,[Math.cos(a0),-1,Math.sin(a0)],[0,-1,0],w)') };
  check('the plume (Q640): a kerolox flame twice as long and nearly a column at sea level, a bulb in vacuum; each propellant its length and brightness; the gain, the body, the halo and the fades in the shader; the proxy\'s far cap wound like its wall',
    shape && pr && Object.values(sh).every(Boolean),
    `Kestrel at sea level ${L0.toFixed(1)} m long (half throttle ${Lh.toFixed(1)}), its edge ${col.toFixed(2)} m wider at the end; Petrel in vacuum ${LV.toFixed(1)} m, ${(third * 100).toFixed(0)} % of its width by a third · shape ${shape} props ${pr} · ${Object.entries(sh).map(([k, v]) => k + ' ' + v).join(' ')}`);
  const blk = H.slice(H.indexOf('// ==== SOUND MIX BEGIN'), H.indexOf('// ==== SOUND MIX END')), { sndMix, sndVoices } = new Function(blk + ';return {sndMix,sndVoices}')();
  const pad = sndMix({ T: 4e6, pr: 1, M: 0, q: 0, agl: 0 }), up = sndMix({ T: 4e6, pr: 1, M: 0, q: 0, agl: 2000 }), liq = sndMix({ T: 4e6, pr: 1 }), sol = sndMix({ T: 4e6, pr: 1, solid: 1 });
  const snd = { lp: pad.airLp < 400 && pad.airLp > 250, refl: pad.air / up.air > 1.5, crk: liq.crk < .3 * sol.crk, kestrel: Math.abs(sndVoices([{ key: 'k', T: 1, exit: .55 }], 1)[0].f - 45.5) < 1,
    voices: H.includes("AUD.V=[0,1,2,3].map(()=>layer('brown','lowpass',150,0.9,rum));") && H.includes('set(v.f.frequency,SND_VLP*x.f,0.2)'), noSines: !H.includes('for(const f of[37,52])'),
    sub: H.includes("fl.type='lowpass';fl.frequency.value=55;") && H.includes('og.connect(swell.gain)'), bass: H.includes('c.createWaveShaper()') && H.includes('set(L.bass.gain,SND_G.bass*m.sub)'),
    // (Q641) the rumble's roughness: the airborne engine layers go through one gain shaken by noise held under 11 and 4 Hz
    rum: H.includes('g.connect(rum.gain)') && H.includes('sub.connect(rum)') && H.includes('bass.connect(rum)') && H.includes("air:layer('brown','lowpass',2000,0.5,rum)") && /const SND_G=\{[^}]*rum:\d/.test(H) };
  check('the engine\'s sound (Q514): the roar under 900 Hz on the pad and thrown back by the ground, a Kestrel\'s voice near 70 Hz as lowpassed brown noise, the sub as noise that swells, a clipped upper-bass layer; liquids crackle little',
    Object.values(snd).every(Boolean), `roar lowpass ${pad.airLp.toFixed(0)} Hz on the pad, ${(pad.air / up.air).toFixed(2)} × the level at 2 km; ${Object.entries(snd).map(([k, v]) => k + ' ' + v).join(' ')}`);
}

// aerofx-69. The plume in space by kind of engine: solid and liquid (look & sound effects, QUEUE Q642). Every solid
// motor is drawn as a solid (the kick motors, which have no PFX entry, drew a kerosene flame) and counts as one for the
// sound's crackle; a solid scatters several times the sunlight of any liquid and keeps its own glow down the plume in
// vacuum, a liquid does not; the shader uses both; the jet spreads wider in vacuum than it did.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const props = pg.slice(pg.indexOf('const PROPS={'), pg.indexOf('const pfxOf=')), pfx = /const pfxOf=[^\n]*/.exec(pg)[0], vac = /const PL_VAC=[^;]*;/.exec(pg)[0];
  const M = new Function(vac + props + pfx + ';return{PROPS,PFX,pfxOf,PL_VAC}')(), P = M.PROPS, liq = ['kerolox', 'alcohol', 'hypergolic', 'hydrolox'];
  const kick = M.pfxOf({ key: 'kick80', solid: true, ispA: 255, ispV: 285 }), les = M.pfxOf({ key: 'les', solid: true }), kes = M.pfxOf({ key: 'kestrel' }), other = M.pfxOf({ key: 'x', ispA: 90, ispV: 345 });
  const kinds = kick.prop === 'solid' && les.prop === 'solid' && kes.prop === 'kerolox' && other.prop === 'kerolox' && other.pe < .1;
  const vals = liq.every(k => P[k].sc > 0 && P[k].sc <= .5 && P[k].hot === 0) && P.solid.sc >= 3 * Math.max(...liq.map(k => P[k].sc)) && P.solid.hot > .3 && P.hydrolox.sc < P.kerolox.sc && M.PL_VAC > .52 && M.PL_VAC <= 1;
  const fs = pg.slice(pg.indexOf('const PLUME_FS=`'), pg.indexOf('`;', pg.indexOf('const PLUME_FS=`')));
  const sh = { scatter: fs.includes('+sunS*uSc.x*uI*prof*d*fade'), hot: fs.includes('float cool=mix(pow(min(1.,re/b),1.6),1.,max(uS.w,uSc.y));'), set: pg.includes('gl.uniform2f(pu.uSc,P.sc??1,P.hot||0);'),
    spread: pg.includes('tn=.03+PL_VAC*sstep(0,2.5,Math.log10(Math.max(n,1)))'), sound: H.includes("if(pfxOf(e.d).prop==='solid')Ts+=t") };
  check('the plume in space by kind (Q642): every solid motor is a solid (kick motors too); a solid scatters several times a liquid\'s sunlight and stays hot down the plume, a liquid does not; the jet spreads wider in vacuum',
    kinds && vals && Object.values(sh).every(Boolean),
    `kick motor: ${kick.prop}, escape tower: ${les.prop}, Kestrel: ${kes.prop}; scatter ${[...liq, 'solid'].map(k => k + ' ' + P[k].sc).join(', ')}; a solid's glow lasts ${P.solid.hot}; spread ${M.PL_VAC} · kinds ${kinds} values ${vals} · ${Object.entries(sh).map(([k, v]) => k + ' ' + v).join(' ')}`);
}

// aerofx-70. The plume from the air to space, and with the throttle (look & sound effects, QUEUE Q644). The flame's
// brightness follows the throttle from near nothing (it was half of full at the lowest setting); the gas glow's gain
// falls with the air and its colour pales; what burns in the air (mantle, body) goes faster than the pressure. And the
// sound's third pass (Q643): the shake slower and shallow enough that its gain cannot reach zero, one more lowpass on
// everything airborne.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const gain = new Function('clamp', /const plumeGain=[^\n]*/.exec(pg)[0] + ';return plumeGain')((x, a, b) => Math.min(b, Math.max(a, x)));
  const g = [0, .1, .5, 1].map(gain), ramp = g[0] < .1 && g[1] < .15 && g[2] > .35 && g[2] < .5 && Math.abs(g[3] - 1) < 1e-9 && g.every((x, i) => !i || x > g[i - 1]);
  const fs = pg.slice(pg.indexOf('const PLUME_FS=`'), pg.indexOf('`;', pg.indexOf('const PLUME_FS=`'))), vg = +/const PL_VG=([.\d]+);/.exec(pg)[1];
  const sh = { used: pg.includes('gl.uniform1f(pu.uI,plumeGain(thr)*('), thin: fs.includes('float thin=smoothstep(0.,.08,uS.w);') && fs.includes('*mix(max(PLVG,uSc.y),1.,thin);') && fs.includes('+gv*prof*d*fade*(.6+.4*nn)*.18*cool)'),
    burn: fs.includes('float burn=uS.w*smoothstep(.008,.07,uS.w);') && fs.includes('float mantle=uK.z*burn*') && fs.includes('float body=burn*uK.z*'), vg: vg > 0 && vg <= .2 };
  // the shake's depth: the noise under 5 Hz has an rms near 0.045 before SND_G.rum (an estimate from the buffer's spectrum;
  // the measured loudness variation agrees: 21 % at rum = 4), so the gain's rms swing is rum × 0.045. Kept under a quarter,
  // zero is four deviations away: no dropouts (at Q641's 7 and 11 Hz it was 0.44, and it stuttered)
  const G = new Function(/const SND_G=\{[^}]*\};/.exec(H)[0] + 'return SND_G')();
  const snd = { depth: G.rum * .045 < .25 && G.rum >= 2, slow: H.includes('for(const[rate,lp,d]of[[0.61,5,SND_G.rum],[0.37,1.5,SND_G.rum*0.6]])'),
    lp: H.includes("rumLp.type='lowpass';rumLp.frequency.value=220;") && H.includes('rum.connect(rumLp);rumLp.connect(AUD.master);'), st: H.includes('const SND_ST=0.02,') };
  check('the plume from air to space and with the throttle (Q644): brightness ramps from near nothing; the gas glow and the afterburning fade as the air thins; the sound\'s shake slower and never to zero, everything airborne an octave down (Q643)',
    ramp && Object.values(sh).every(Boolean) && Object.values(snd).every(Boolean),
    `brightness at throttle 0, 10, 50, 100 %: ${g.map(x => x.toFixed(2)).join(', ')}; the glow keeps ${vg} of its gain in vacuum; shake ${G.rum} · ${Object.entries({ ...sh, ...snd }).map(([k, v]) => k + ' ' + v).join(' ')}`);
}

// aerofx-71. The plume's end, the wide cloud at the air's edge, and starting and stopping in vacuum (look & sound effects,
// QUEUE Q645); the sound's mid band (Q646). In air the flame tapers and ends in tongues (it widened and faded); what needs
// air to burn or glow (mantle, body, soot, halo) is gone by 34 km and the contrail fades out from 24 km; in vacuum the
// fuel-rich start and tail-off do not glow or widen the jet and the cutoff puff is a wisp.
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END'));
  const fs = pg.slice(pg.indexOf('const PLUME_FS=`'), pg.indexOf('`;', pg.indexOf('const PLUME_FS=`'))), rb = /const PLUME_RB=`[^`]*`;/.exec(pg)[0];
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
  const taper = +/PL_TAPER=([.\d]+)/.exec(pg)[1], tail = +/PL_TAIL=([.\d]+)/.exec(pg)[1];
  const bm = /float burn=uS\.w\*smoothstep\(([.\d]+),([.\d]+),uS\.w\);/.exec(fs), burn = p => p * ss(+bm[1], +bm[2], p);
  const end = { taper: taper >= .3 && taper <= .7 && tail === 0 && fs.includes('float tp=1.-TAPER*thin*smoothstep(.4*L,L,s);') && fs.includes('float u=r/(b*tp*('),
    tongues: fs.includes('Le=L*(.5+.5*tg);') && fs.includes('smoothstep(Le,.72*Le,s+(nn-.5)*L*.12),thin)*smoothstep(L,.86*L,s);') };
  // pressures: 0.063 atm at 20 km, 0.0167 at 30 km, 0.0063 at 36 km
  const air = { burn: burn(1) === 1 && burn(.063) > .05 && burn(.0167) < .002 && burn(.0063) === 0, halo: fs.includes('HALO*burn*uK.x*'), soot: fs.includes('float soot=uK.w*burn*('),
    trail: pg.includes('a0:.45*clamp(rho*1.1,.12,1)*sstep(.006,.03,rho),') };
  const pm = /a0:\(\.35\+\.3\*\(P\.tail\|\|\.3\)\)\*\(([.\d]+)\+([.\d]+)\*sstep\(0,\.08,pa\)\)/.exec(pg);
  const vac = { rich: fs.includes('float rich=uIg.w*thin*(.5+nn);') && fs.includes('+rich*prof*fade*.6)'), wide: rb.includes('uIg.w*mix(.15,1.,smoothstep(0.,.08,uS.w))*'),
    len: pg.includes('.6*ig[3]*(.25+.75*sstep(0,.08,pa))'), puff: !!pm && +pm[1] <= .05 && Math.abs(+pm[1] + +pm[2] - 1) < 1e-9 && pg.includes('hot:.4*sstep(0,.08,pa)})') };
  const G = new Function(/const SND_G=\{[^}]*\};/.exec(H)[0] + 'return SND_G')();
  const snd = { gain: G.mid >= .3 && G.mid <= 2, layer: H.includes("mid:layer('brown','bandpass',320,0.7,midG),") && H.includes('midG.connect(AUD.master);'),
    shake: H.includes('g.connect(rum.gain);g.connect(midG.gain);'), tick: H.includes('set(L.mid.g.gain,SND_G.mid*m.air);set(L.mid.f.frequency,m.airLp);') };
  const all = { ...end, ...air, ...vac, ...snd };
  check('the plume\'s end tapers into tongues in air; nothing that needs air glows past 34 km and the contrail fades out; in vacuum no fuel-rich flash at the start and a wisp at cutoff (Q645); a mid band beside the rumble (Q646)',
    Object.values(all).every(Boolean),
    `taper ${taper}; burn at 20, 30, 36 km: ${[.063, .0167, .0063].map(p => burn(p).toFixed(4)).join(', ')}; cutoff puff in vacuum ${pm ? pm[1] : '?'} of its opacity; mid gain ${G.mid} · ${Object.entries(all).map(([k, v]) => k + ' ' + v).join(' ')}`);
}
