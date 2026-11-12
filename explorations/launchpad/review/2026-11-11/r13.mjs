// R13 b,c,d,e,f,g,h: the app layer can't run headless (DOM/WebGL), so each section either does the arithmetic with the
// code's own text and constants, or runs the extracted function text against small stubs. Each section says which.
// Run: node r13.mjs            (all)   |   node r13.mjs c   (one section)
import { readFileSync } from 'node:fs';
import { makeSim, ROOT } from './sim.mjs';
const rd = f => readFileSync(ROOT + f, 'utf8'), want = process.argv[2], on = k => !want || want === k;
const lineOf = (txt, needle) => txt.slice(0, txt.indexOf(needle)).split('\n').length;
const line = (f, needle) => `${f}:${lineOf(rd(f), needle)}`;
const ev = makeSim(); ev('HOOK.msg=()=>{};HOOK.news=()=>{}');
const DT = ev('DT'), WARPS = new Function(/const WARPS=\[[^\]]*\]/.exec(rd('app/state.js'))[0] + ';return WARPS')();
const APP = ['app/sound.js', 'app/loop.js', 'app/input.js', 'app/screens.js', 'app/state.js', 'app/gl.js', 'app/render.js', 'app/hud.js', 'app/settings.js', 'builder.js', 'views.js', 'index.html'];

if (on('b')) {
  console.log('\n=== R13b engine sound in a hidden tab  [static: text search; the behaviour itself needs a browser]');
  for (const w of ['visibilitychange', 'pagehide', '.suspend(']) console.log(`  "${w}" occurrences in ${APP.length} app files:`, APP.reduce((n, f) => n + rd(f).split(w).length - 1, 0));
  const s = rd('app/sound.js'), l = rd('app/loop.js');
  console.log('  master gain (' + line('app/sound.js', 'set(AUD.master.gain') + '):', /set\(AUD\.master\.gain,[^;]*;/.exec(s)[0]);
  console.log('  sndTick( call sites outside sound.js:', APP.filter(f => f !== 'app/sound.js').map(f => [f, rd(f).split('sndTick(').length - 1]).filter(x => x[1]).map(x => x.join(' x')).join(', '), '(inside frame(), a requestAnimationFrame callback)');
  console.log('  => the only reader of document.hidden runs from requestAnimationFrame, which browsers stop in a hidden tab, so the last gain target (audible) stands. INFERRED, not run.');
}

if (on('c')) {
  console.log('\n=== R13c autopilot replay speed vs refresh rate  [arithmetic with the code\'s own expression, ' + line('app/loop.js', 'tapePlay(player,S,') + ']');
  const expr = /tapePlay\(player,S,(Math\.max\(1,Math\.round\(dtR\*WARPS\[Math\.min\(warpIdx,5\)\]\/DT\)\))\)/.exec(rd('app/loop.js'))[1];
  console.log('  steps per frame =', expr, ' DT =', DT, ' WARPS =', JSON.stringify(WARPS));
  const f = new Function('dtR', 'warpIdx', 'WARPS', 'DT', 'return ' + expr);
  console.log('  refresh   ' + [0, 1, 2, 3, 4, 5].map(i => `warp ${WARPS[i]}x`.padStart(11)).join(''));
  for (const hz of [30, 50, 60, 75, 90, 120, 144, 165, 240]) console.log(`  ${String(hz).padStart(4)} Hz  ` + [0, 1, 2, 3, 4, 5].map(i => (f(1 / hz, i, WARPS, DT) * DT * hz).toFixed(2).padStart(10) + 'x').join(''));
  console.log('  (each cell: flight seconds replayed per real second; expected = the warp level in every row)');
}

if (on('d')) {
  console.log('\n=== R13d the HUD tick  [gate: text; storage: extracted functions on stubs; tape size and town check: run on the sim]');
  const l = rd('app/loop.js'), p = rd('app/program-ui.js');
  console.log('  gate (' + line('app/loop.js', 'hudT-=dtR') + '):', /hudT-=dtR;[^}]*\}/.exec(l)[0]);
  const body = p.slice(p.indexOf('function updateHUD(){'), p.indexOf('let rangeWarned=false'));
  console.log('  updateHUD (' + line('app/program-ui.js', 'function updateHUD(){') + ') per call:', ['innerHTML=', 'renderCards()', 'renderStages()', 'updateNodePanel()', 'updateAutoBtn()', 'settleDrops()', 'heard.add', 'predictImpact(S', 'rangeVerdict(', 'HOOK.news('].map(k => `${k} x${body.split(k).length - 1}`).join(', '));
  // storage reads per HUD tick: tapeKey/loadTape/updateAutoBtn as written, on stubs
  const a = p.indexOf('const tapeKey='), b = p.indexOf('const procsOf='), c = p.indexOf('function updateAutoBtn(){'), d = p.indexOf('\n', c);
  const st = { get: 0 };
  ev(`simT=0;S=newShip(PRESETS.Beeper);globalThis.__T=tapeNew(PRESETS.Beeper,S.site);S.sas=true;S.throttle=1;stage(S);for(let i=0;i<10000&&S.alive;i++){if(i%25===0)INP.pitch=(i/25)%3-1;tapePhys(__T,S)}INP.pitch=0`);   // a real tape: the Beeper flown 200 s, a pitch key changing twice a second
  const tape = JSON.stringify(ev('({v:tapeV(),stack:PRESETS.Beeper,ops:__T.ops,site:__T.site})'));
  const els = {}, $ = id => els[id] || (els[id] = { classList: { toggle() { } }, textContent: '' });
  const fn = new Function('localStorage', 'tapeV', 'stackDef', '$', 'updateProcBtn', 'prelaunch', 'player', 'fmtT', 'tapeDuration', p.slice(a, b) + p.slice(c, d) + ';return updateAutoBtn');
  const upd = fn({ getItem() { st.get++; return tape; } }, ev('tapeV'), ev('PRESETS.Beeper'), $, () => { }, () => false, null, x => x, ev('tapeDuration'));
  const t0 = performance.now(); for (let i = 0; i < 100; i++) upd(); const ms = (performance.now() - t0) / 100;
  console.log(`  updateAutoBtn x100 (one per HUD tick, here with prelaunch()=false, i.e. in flight, button hidden): localStorage.getItem calls ${st.get} (expected 0)`);
  console.log(`     a 200 s tape is ${(tape.length / 1024).toFixed(0)} KB (${ev('__T.ops.length')} ops); read + JSON.parse + tapeDuration each tick: ${ms.toFixed(2)} ms in Node = ${(ms * 10).toFixed(1)} ms of every second`);
  console.log('  simulate() gate:', /function simulate\(dtR\)\{[\s\S]*?if\(mode!=='flight'\)return;/.exec(l)[0].replace(/\s+/g, ' ').slice(0, 95));
  console.log('  => map view keeps mode===\'flight\', so the tick still runs there; on every other screen the flight is frozen too. The logic does NOT stop while the flight runs (claim\'s "consequence to show": refuted).');
  console.log('  what is true instead: the tick is 10 per REAL second, so under warp the game logic in it samples the flight sparsely:');
  for (const w of [1, 100, 1000, 10000, 100000]) {
    const n = ev(`(()=>{const r=TELLUS.R+150e3,v=Math.sqrt(TELLUS.mu/r),inc=0.6,R=[r,0,0],V=[0,v*Math.sin(inc),-v*Math.cos(inc)],P=2*Math.PI*Math.sqrt(r*r*r/TELLUS.mu),h=0.1*${w},seen=new Set();
      for(let t=0;t<5*P;t+=h){const[a]=kepler(R,V,t,TELLUS.mu),c=nearestCity(toPF(TELLUS,a,t));if(c.dist<350e3)seen.add(c.city.name)}return{n:seen.size,km:v*h/1e3}})()`);
    console.log(`     warp ${String(w).padStart(6)}x: ${n.km.toFixed(1).padStart(8)} km of track between HUD ticks; towns that "hear the beeper" in 5 orbits (150 km, 34 deg): ${n.n}`);
  }
  console.log('     range safety (under thrust, so physics warp <= 100x): impact re-predicted every 0.25 s of flight at 1x, every ' + (0.1 * 100).toFixed(0) + ' s of flight at 100x');
}

if (on('e')) {
  console.log('\n=== R13e landPick never cleared  [text search + the pick handler run on stubs + procWithSite run on the sim]');
  for (const f of ['app/state.js', 'app/screens.js', 'app/program-ui.js', 'app/render.js', 'app/mission.js', 'app/title.js', 'app/editor.js', 'app/input.js', 'app/debrief.js', 'builder.js', 'views.js']) { const t = rd(f); for (const x of t.matchAll(/landPick\s*=[^=]/g)) console.log(`  assignment at ${f}:${t.slice(0, x.index).split('\n').length}: ${t.slice(x.index, x.index + 14)}`); }
  const s = rd('app/screens.js'), a = s.indexOf('function pickLandSite(m){'), b = s.indexOf('\nlet drag=null', a);
  const mk = new Function('HOOK', 'norm', 'add', 'mul', 'surfacePick', 'procsOf', 'procLandsOn', 'updateAutoBtn', 'sitePlace', 'simT', `let landPick=null,stackDef=null;${s.slice(a, b)};return{pick:(m,sd)=>{stackDef=sd;pickLandSite(m)},get landPick(){return landPick}}`);
  const procA = { kind: 'mission', sig: 'selland', phases: [{ k: 'transfer', to: 'Selene' }, { k: 'capture' }, { k: 'land' }] };
  let hit = { body: 'Selene', pf: [100000, 200000, 250000] };
  const G = mk({ view: { Fw: [0, 0, 1], R: [1, 0, 0], U: [0, 1, 0], W: 800, H: 600, tanX: 1, tanY: 1 }, msg() { } }, ev('norm'), ev('add'), ev('mul'), () => hit, sd => sd === 'A' ? [procA] : [], ev('procLandsOn'), () => { }, ev('sitePlace'), 0);
  G.pick([400, 300], 'A'); console.log('  click on Selene with design A:            landPick =', JSON.stringify(G.landPick));
  hit = null; G.pick([10, 10], 'A'); console.log('  click on empty sky:                       landPick =', JSON.stringify(G.landPick), ' (no way to unpick)');
  hit = { body: 'Nyx', pf: [1, 2, 3] }; G.pick([400, 300], 'B'); console.log('  design B (no Nyx procedure) clicks Nyx:   landPick =', JSON.stringify(G.landPick), ' (refused, old pick kept)');
  console.log('  resetShip (' + line('app/state.js', 'function resetShip(){') + ') mentions landPick:', /function resetShip\(\)\{[^\n]*/.exec(rd('app/state.js'))[0].includes('landPick'));
  ev('globalThis.__pb=' + JSON.stringify({ kind: 'mission', sig: 'selsample', phases: [{ k: 'transfer', to: 'Selene' }, { k: 'capture' }, { k: 'land' }, { k: 'ascend' }] }) + ';globalThis.__lp=' + JSON.stringify(G.landPick));
  console.log('  a later flight, another design, same page session (bProc.onclick: procStart(S, landPick ? procWithSite(pr, landPick.body, landPick.pf) : pr)):');
  console.log('     its land phase is flown as', JSON.stringify(ev('procWithSite(__pb,__lp.body,__lp.pf).phases.find(p=>p.k==="land")')), ' expected {"k":"land"} unless a site was picked for this flight');
}

if (on('f')) {
  console.log('\n=== R13f the flight-reset list, copied  [text: every line that clears pendingDrops, cut to the list and compared]');
  const copies = [];
  for (const f of ['app/state.js', 'app/mission.js', 'app/program-ui.js', 'app/screens.js', 'app/editor.js', 'app/debrief.js', 'app/rover-yard.js', 'app/title.js']) { const L = rd(f).split('\n'); L.forEach((ln, i) => { if (!ln.includes('pendingDrops.length=0')) return; let fnm; for (let j = i; j >= 0 && !fnm; j--) fnm = (/^function (\w+)\(/.exec(L[j]) || [])[1]; copies.push({ at: `${f}:${i + 1}`, fnm, ln }); }); }
  const cut = c => { const a = c.ln.indexOf('if(S)'), s = c.ln.slice(a), e = s.indexOf('booms.length=0;'); return s.slice(0, e + 15); };
  const tail = s => s.slice(s.indexOf('FLEET.length=0')), ref = tail(cut(copies[0]));
  for (const c of copies) { const L = cut(c); console.log(`  ${c.at.padEnd(24)} ${String(c.fnm).padEnd(14)} before the list: ${L.slice(0, L.indexOf('FLEET.length=0')).padEnd(50)} list same as resetShip's: ${tail(L) === ref}`); }
  console.log('  the list:', ref);
  const cand = ['rangeWarned', 'impST', 'impT', 'landPick', 'predCache', 'planCache', 'statXc', 'ndSel', 'mapFoc'];
  const all = ['app/state.js', 'app/program-ui.js', 'app/loop.js', 'app/screens.js', 'app/hud.js', 'app/mission.js', 'app/render.js', 'app/input.js'].map(rd).join('\n');
  console.log('  per-flight globals not in the list (declared in app/*.js):', cand.filter(k => new RegExp('\\b' + k + '\\b').test(all) && !ref.includes(k)).join(', '));
  for (const c of copies) { const [f, n] = c.at.split(':'), L = rd(f).split('\n'), rest = L.slice(+n - 1, +n + 7).join(' '), after = rest.slice(rest.indexOf('booms.length=0;')), iM = L[+n - 1].indexOf('missionEnd(S)'), iR = rest.indexOf('recFlightEnd(S');
    console.log(`     ${String(c.fnm).padEnd(14)} warpIdx=0;physAcc=0 later in the function: ${after.includes('warpIdx=0;physAcc=0')} · recFlightEnd comes ${iR < rest.indexOf('missionEnd(S)') ? 'BEFORE missionEnd' : 'AFTER missionEnd and the list (so recTapeNow() sees player=null)'}`); }
}

if (on('g')) {
  console.log('\n=== R13g the builder\'s keys on the title  [the handler\'s own guard, evaluated with each screen\'s flags]');
  const b = rd('builder.js'), m = /addEventListener\('keydown',e=>\{if\((mode!=='editor'.*?tagName\))\)return;/.exec(b);
  console.log('  guard (' + line('builder.js', "addEventListener('keydown',e=>{if(mode!=='editor'") + '): return if', m[1]);
  const f = new Function('mode', 'atHQ', 'atDeb', 'atRoll', 'atMC', 'atTitle', 'e', 'return ' + m[1]), e = { target: { tagName: 'BODY' } };
  for (const [nm, mode, hq, deb, roll, mc, ttl] of [['assembly', 'editor', 0, 0, 0, 0, 0], ['program', 'editor', 1, 0, 0, 0, 0], ['debrief', 'editor', 0, 1, 0, 0, 0], ['rollout', 'editor', 0, 0, 1, 0, 0], ['mission', 'editor', 0, 0, 0, 1, 0], ['title', 'editor', 0, 0, 0, 0, 1], ['flight', 'flight', 0, 0, 0, 0, 0]])
    console.log(`     ${nm.padEnd(9)} builder keys ignored: ${!!f(mode, !!hq, !!deb, !!roll, !!mc, !!ttl, e)}${nm === 'title' ? '   <-- expected true (go() hides #editor when atTitle)' : ''}`);
  console.log('  keys that then act unseen: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (undo, redo the design), X (symmetry), C (snap), R, V, T (top view), Escape, Delete/Backspace (deletes the hovered or selected part, with preventDefault)');
  console.log('  mouse handlers guarded by mode!==\'editor\' alone:', (b.match(/addEventListener\('mouse(?:move|up|down)',e=>\{if\(mode!=='editor'\)return/g) || []).length);
}

if (on('h')) {
  console.log('\n=== R13h rvMeshC  [rvBodyMesh/rvWheelMesh as written, makeMesh stubbed to count GL meshes]');
  const r = rd('app/rover-yard.js'), a = r.indexOf('const rvMeshC=new Map();'), l1 = r.indexOf('\n', r.indexOf('function rvBodyMesh(d){')), w = /function rvWheelMesh\(k\)\{[^\n]*/.exec(r)[0];
  let made = 0; const M = new Function('makeMesh', 'rvBodyArr', 'rvWheelArr', r.slice(a, l1) + ';' + w + ';return{rvBodyMesh,rvWheelMesh,rvMeshC}')(() => ({ id: ++made, free() { } }), () => [], () => []);
  console.log('  ' + line('app/rover-yard.js', 'const rvMeshC=new Map();') + ' · mentions of rvMeshC in all app files:', ['app/rover-yard.js', 'app/gl.js', 'app/render.js', 'app/screens.js', 'app/state.js'].reduce((n, f) => n + rd(f).split('rvMeshC').length - 1, 0), '· rvMeshC.delete / .clear:', /rvMeshC\.(delete|clear)/.test(r) ? 'yes' : 'none');
  const d = ev('rvDefault()'), items = ev('Object.keys(RV_IT)'); M.rvBodyMesh(d); M.rvWheelMesh(d.wh);
  console.log('  default design drawn:                       meshes made', made, ', cache size', M.rvMeshC.size);
  for (let i = 0; i < 300; i++) M.rvBodyMesh(d); console.log('  same design drawn 300 more frames:          meshes made', made, '(no growth per frame)');
  let edits = 0; for (const it of items) { d.slots[4] = it; M.rvBodyMesh(d); edits++; } for (const ch of ['s', 'l', 'm']) { d.ch = ch; d.slots = d.slots.slice(0, ev(`RV_CH.${ch}.slots`)); M.rvBodyMesh(d); edits++; } for (const n of [6, 4]) { d.n = n; M.rvBodyMesh(d); edits++; }
  console.log(`  ${edits} edits (slot 5 through all ${items.length} items, chassis s/l/m, wheels 6/4):  meshes made ${made}, cache size ${M.rvMeshC.size}   expected: the replaced design's mesh freed, a handful live`);
  const before = made; for (const n of [6, 4]) { d.n = n; M.rvBodyMesh(d); } console.log('  two of those edits again:                   new meshes', made - before, '(a configuration seen before is reused: growth is per NEW configuration, not per edit)');
  console.log(`  distinct deck fillings alone: ${items.length + 1}^slots = ${(items.length + 1) ** 3} (small), ${(items.length + 1) ** 5} (medium), ${(items.length + 1) ** 8} (large): each a VAO + vertex buffer, never freed`);
}
