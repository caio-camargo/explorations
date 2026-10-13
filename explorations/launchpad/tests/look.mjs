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
  check('sound is wired: F4 in KEYS.all, sndTick called from frame() and not from render()',
    /all:\[[^\n]*k:\['f4'\]/.test(P) && /function frame\(now\)\{[^]*?sndTick\(dtR\)[^]*?requestAnimationFrame\(frame\)\}/.test(P) && !/function render\(\)\{[^]*?\n\}/.exec(P)?.[0].includes('sndTick'));
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
  const SIMF = new Function(src + 'return {rng,norm,add,sub,mul,dot,WSEED}')(), P = {};
  const G = new Function('rng', 'norm', 'add', 'sub', 'mul', 'dot', 'WSEED', 'PROG', body('makeGal') + body('galSights') + ';let GAL=makeGal(WSEED);' + body('galaxy') + ';return {makeGal,galaxy}')(
    SIMF.rng, SIMF.norm, SIMF.add, SIMF.sub, SIMF.mul, SIMF.dot, SIMF.WSEED, P);
  const a = G.galaxy(), s1 = P.gseed, b = G.galaxy(), w = G.makeGal(SIMF.WSEED), o = G.makeGal(s1 + 1);
  P.gseed = null; const c = G.galaxy(), s2 = P.gseed;
  const vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8'), ed = readFileSync(new URL('./app/editor.js', import.meta.url), 'utf8');
  check('galaxy per program: drawn once and kept, different seeds differ, a reset draws a new one; views pin WSEED',
    s1 > 0 && a === b && a.seed === s1 && Math.abs(dot(w.gx, o.gx)) < 0.9999 && s2 > 0 && s2 !== s1 && c.seed === s2
      && vj.includes('PROG.gseed = WSEED') && ed.includes('Object.assign(PROG,{gseed:null,') && /galaxy\(\);gl\.uniform3fv\(u\.uGx/.test(pg),
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
  check('cloud volume shadows: the ground shading uses cloudShadowV, which marches cloudDens toward the sun; toggles wired',
    pg.includes('col=alb*(ndb*st*5.*cloudShadowV(p)+') && /float cloudShadowV\(vec3 p\)\{float sh=cloudShadow\(p\);/.test(pg) && /od\+=cloudDens\(p\+uSun\*/.test(pg)
      && pg.includes('gl.uniform1f(u.uVs,CLOUD_SHADOW_V?1:0);') && pg.includes('gl.uniform1f(u.uVv,CLOUD_VARY?1:0);') && /uniform float uCvX,uVk,uVD,uVs,uVv;/.test(pg));
  // QUEUE Q66: per-engine voices. Smaller nozzles sing higher; voices go by kind of engine (two Kestrels are one voice), the
  // biggest thrust shares first, at most four; nothing when nothing burns; equal shares sum to the airborne level in power
  {
    const blk = H.slice(H.indexOf('// ==== SOUND MIX BEGIN'), H.indexOf('// ==== SOUND MIX END'));
    const { sndVoices } = new Function(blk + ';return {sndVoices}')();
    const wren = sndVoices([{ key: 'wren', T: 18e3, exit: 0.25 }], 1), alb = sndVoices([{ key: 'albatross', T: 1.1e6, exit: 1.1 }], 1);
    const mix = sndVoices([{ key: 'kestrel', T: 230e3, exit: 0.55 }, { key: 'kestrel', T: 230e3, exit: 0.55 }, { key: 'condor', T: 460e3, exit: 0.62 }], 0.8);
    const many = sndVoices(['a', 'b', 'c', 'd', 'e'].map((k, i) => ({ key: k, T: 1e5 * (i + 1), exit: 0.3 + 0.1 * i })), 1);
    check('engine voices: a small nozzle sings higher than a big one; one voice per kind; ≤ 4, biggest first; silent when off (and the volume slider, Q35, is wired)',
      wren[0].f > 900 && alb[0].f < 260 && mix.length === 2 && Math.abs(mix[0].g ** 2 + mix[1].g ** 2 - 0.64) < 1e-9 && many.length === 4 && many[0].f < many[3].f
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
      && !pg.includes('placeholders until the parts & pad beat') && /F=\[x\+n\[0\]\*d\.reach,y-d\.drop,z\+n\[2\]\*d\.reach\]/.test(leg)
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
    return {crewFigure,suitOf,SUIT_DEFAULT,SUITS,CREW_C,P};`)();
  const lines = [0, 1, 2, 3, 4, 5].map(k => C.SUITS[k]), key = c => c.slice(0, 3).map(x => x.toFixed(2)).join(),
    suitsOk = lines.every(L => L && L.length === 3 && new Set(L.map(x => key(x.c1))).size === 3) && C.suitOf(9, 0) === C.SUIT_DEFAULT && C.suitOf(1, 2) !== C.SUIT_DEFAULT;
  const pts = a => a.filter(Array.isArray), st = pts(C.crewFigure(C.suitOf(0, 0), 'stand', 0)), wv = pts(C.crewFigure(C.suitOf(1, 2), 'wave', 1));
  const ys = st.map(p => p[1]), top = Math.max(...ys), foot = Math.min(...ys), wTop = Math.max(...wv.map(p => p[1]));
  const skin = C.P.filter(v => Math.abs(v.c[0] - 0.95) < 1e-9 && Math.abs(v.c[1] - 0.76) < 1e-9).map(v => v.p), faceFwd = skin.filter(p => p[2] > C.CREW_C.head * 0.7 && p[1] > 1.4).length;
  check('crew look: a stylised astronaut ~1.78 m tall on its own feet; the waving glove rises above the helmet; the face shows; six schools × three suits, each generation its own colour',
    top > 1.74 && top < 1.82 && Math.abs(foot) < 0.02 && wTop > top && faceFwd > 20 && suitsOk,
    `height ${top.toFixed(3)} m, feet at ${foot.toFixed(3)}, waving hand to ${wTop.toFixed(2)} m; ${faceFwd} face vertices forward`);
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
  const clock = /HOOK\.fxT = b\.t0 \+ age \* 1000/.test(vj) && /const nowMs=HOOK\.fxT\?\?performance\.now\(\)/.test(page) && /function boomLight\(camW\)\{const now=HOOK\.fxT\?\?performance\.now\(\)/.test(page);
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
  const shader = /float cool=mix\(pow\(min\(1\.,re\/b\),1\.6\),1\.,uS\.w\);/.test(fs) && /\*\.18\*cool\)/.test(fs) && /\+sunS\*uI\*prof\*d\*fade/.test(fs)
    && /ph=\.5\*\(\.51\/pow\(1\.49-1\.4\*cs,1\.5\)\+1\.\)\/12\.566/.test(fs) && /if\(k==1\.\)dm\+=od\*2\.\*exp/.test(fs) && /\(uK\.w\+uPf\)\*rich/.test(fs) && /\(\.65\+\.7\*ne\)/.test(fs);
  const wired = /gl\.uniform3fv\(pu\.uSunL,qrot\(qconj\(Q\),SUN\)\);gl\.uniform3fv\(pu\.uSunC,PSUN\)/.test(page) && /PSUN=lightEnv\(p\)\.sun\.map\(x=>x\*lit\(p\)\)/.test(page)
    && /gl\.uniform1f\(pu\.uPf,P\.pf\|\|0\)/.test(page) && /const K=PLUME_LK\*/.test(page);
  const pr = page.match(/hypergolic:\{[^}]*so:\[([^\]]*)\][^}]*pf:([\d.]+)\}/), so = pr && pr[1].split(',').map(Number);
  const brown = pr && +pr[2] > 0 && so[2] > so[1] && so[1] > so[0];
  const hg = cs => .5 * (.51 / Math.pow(1.49 - 1.4 * cs, 1.5) + 1) / 12.566, fwd = hg(1) / hg(-1);
  const trail = /rho<0\.006\)return;/.test(page) && /smoke\.length>4000\)smoke\.shift\(\);/.test(page) && /life:110\+Math\.random\(\)\*60,/.test(page)
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
  const cs = page.match(/function camShake\(\)\{[\s\S]*?\n  return\[[^\n]*\]\}/), env = { SHAKE_FX: true, mode: 'flight', view: 'ship', simT: 12.3,
    sstep: (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }, clamp: (x, a, b) => Math.min(b, Math.max(a, x)), plasmaHeat: () => 0 };
  const shake = cs && (S => new Function(...Object.keys(env), 'S', cs[0] + ';return camShake()')(...Object.values(env), S));
  const amp = r => r ? Math.hypot(r[0], r[1]) : 0, ship = (M, q) => ({ alive: true, body: { atm: 1 }, mach: M, qdyn: q, r: [], v: [], qHeat: 0 });
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
  const jit = /jt=mix\(\.5,fract\(52\.9829189\*fract\(dot\(gl_FragCoord\.xy,vec2\(\.06711056,\.00583715\)\)\)\),smoothstep\(15e3,50e3,length\(uPc\)-uPR\)\)/.test(sc) && /float t=t0\+\(float\(i\)\+jt\)\*ds;/.test(sc) && !/\(float\(i\)\+\.5\)\*ds;vec3 p=d\*t-uPc/.test(sc);
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
  const sky = /smoothstep\(15e3,50e3,length\(uPc\)-uPR\)\);vec3 sR=vec3\(0\.\)/.test(page);
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
{
  const H = html.replace(/\r\n/g, '\n'), pg = H.slice(H.indexOf('// ==== SIM END')), vj = readFileSync(new URL('./views.js', import.meta.url), 'utf8');
  const sky = pg.slice(pg.indexOf('const SKY_FS='), pg.indexOf('const SKY_FS=') + pg.slice(pg.indexOf('const SKY_FS=')).indexOf('}`;'));
  const mainSky = sky.slice(sky.lastIndexOf('void main(){')), moon = pg.slice(pg.indexOf('const MOON_FS='), pg.indexOf('const PMOON='));
  const out = !/crat\(/.test(mainSky) && /col=ins;vis=1\.;/.test(mainSky) && /o=vec4\(col,vis\);/.test(mainSky);
  const pass = /uSel>0\./.test(moon) && /blendFuncSeparate\(gl\.DST_ALPHA,gl\.ONE,gl\.ZERO,gl\.ONE\)/.test(pg) && /for\(const b of BODIES\)\{if\(!b\.parent\)continue;/.test(pg);
  const photo = /2\.42e-4\*g\*g/.test(moon) && /\.6\/\(1\.\+/.test(moon) && /es=100\.\*\.35\*/.test(moon) && /smoothstep\(\.25,\.6,w\*f\)/.test(moon) && /fbmF\(/.test(moon);
  // the footprint in Selene radii from 200 km over Tellus (fov 1 rad, 800 px) and the finest crater octave left
  const w = (3.844e7 - 1.274e6 - 2e5) * 2 * Math.tan(0.5) / 800 / 3.48e5, left = [12.6, 37.8, 113.4, 340.2, 1020.6].filter(f => w * f < 0.6).length;
  const w100 = 1e5 * 2 * Math.tan(0.5) / 800 / 3.48e5, left100 = [12.6, 37.8, 113.4, 340.2, 1020.6].filter(f => w100 * f < 0.6).length;
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
