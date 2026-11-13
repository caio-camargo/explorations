// tests/app.mjs — test sections: the app layer, the whole page headless (QUEUE R34). Not a module on its own: shards.mjs
// splices every file in tests/ (TEST_FILES) between test.mjs's prelude and its summary. Each section boots its own page
// with apphost.mjs (every script index.html loads, in order, in a vm with DOM, storage and GL stubs, ~1 s): sections share
// nothing, as R2 wants. Add a section at the end: "// app-<n>. Title" at column 0, then a { block }. notes/platform.md
// § v1.343 (R34). A check for an app-layer fix goes here when it needs the real screens, clicks, keys and frame loop.

// app-1. The page loads headless (R34): every script, in page order, with 0 errors, on a career and with ?tester; it opens
// on the title; 30 frames of the title (render() on the stub GL every frame) throw nothing. `unknown` lists element
// properties the page read that the stub DOM lacks (shown, not failed: a new one may want a stub).
{
  const { boot } = await import(new URL('./apphost.mjs', import.meta.url));
  const out = ['', '?tester'].map(search => {
    const t0 = performance.now(), H = boot({ search, renderEvery: 1 }), ms = performance.now() - t0;
    const scr = H.errs.length ? '?' : H.run('screenNow()'); H.frame(30); H.timers();
    return { search, ms, scr, errs: H.errs, unknown: [...H.unknown] };
  });
  check('app-1: the page loads headless with 0 errors, on a career and with ?tester; it opens on the title; frames and timers throw nothing (R34)',
    out.every(o => !o.errs.length && o.scr === 'title'),
    out.map(o => `${o.search || 'career'}: ${o.ms.toFixed(0)} ms, ${o.scr}, ${o.errs.length} errors${o.errs.length ? ' (' + o.errs[0].slice(0, 160) + ')' : ''}; stub gaps: ${o.unknown.join(' ') || 'none'}`).join(' · '));
}

// app-2. A first flight through the real screens (R34): found the program on the title, the Assembly with the Sounding
// rocket (the one design whose parts are all open on day 0), the Rollout, LAUNCH, Z and Space, 45 s of flight past
// 10 km at 1× (render() on the stub GL every 4th frame), then End flight from the Esc menu (two clicks) and the Debrief.
// 0 errors, and the program counts the flight.
{
  const { boot } = await import(new URL('./apphost.mjs', import.meta.url));
  const H = boot({ renderEvery: 4 }), r = H.run, path = [];
  const at = () => { path.push(r('screenNow()')); return path.at(-1); };
  r('ttlFound()'); H.click({ go: 'assembly' }); at();
  r('stackDef=JSON.parse(JSON.stringify(PRESETS.Sounding));editorChanged()');
  H.click({ go: 'rollout' }); at(); H.getEl('launch').click(); H.frame(5); at();
  const why = r('partLaunchWhy(S.parts)'), f0 = r('PROG.flights');
  H.key('z'); H.keyup('z'); H.key(' '); H.keyup(' ');
  let n = 0; while (n < 6000 && r('S.alive&&simT<45')) { H.frame(100); n += 100; }
  const alt = r('Math.round(len(S.r)-S.body.R)'), flew = r('!!S.rec.launched&&S.alive&&!S.landed');
  H.key('escape'); H.click({ esc: 'end' }); H.click({ esc: 'end' }); H.frame(5); at();
  const f1 = r('PROG.flights');
  check('app-2: a first flight through the real screens: title, Assembly (Sounding), Rollout, LAUNCH, 45 s up past 10 km, End flight, the Debrief; 0 errors; the flight is counted (R34)',
    !H.errs.length && !why && path.join(',') === 'assembly,rollout,flight,debrief' && flew && alt > 10000 && f1 === f0 + 1,
    `screens ${path.join(' → ')}; launch refused: ${why || 'no'}; ${n} frames, at ${alt} m; flights ${f0} → ${f1}; errors: ${H.errs[0] || 'none'}`);
}

// app-3. The builder acts only on the Assembly, in the page (QUEUE R28, v1.336; vehicle-46 checks it on builder.js alone):
// the camera aimed at the rocket, a click through the window's real mouse handlers picks a part up on the Assembly and
// does nothing to the design on the Rollout (where it had picked parts up, and LAUNCH flew without them).
{
  const { boot } = await import(new URL('./apphost.mjs', import.meta.url));
  const H = boot(), r = H.run;
  r('ttlFound()');
  const click = scr => {
    H.click({ go: scr });
    r('stackDef=JSON.parse(JSON.stringify(PRESETS.Orbiter));editorChanged();BLD.st.held=null;BLD.st.undo.length=0');
    r('{const q=S.q;HOOK.view={camW:add(shipWorld(),qrot(q,[30,0,0])),Fw:qrot(q,[-1,0,0]),R:qrot(q,[0,0,1]),U:qrot(q,[0,1,0]),tanX:.6,tanY:.5,W:1000,H:800}}');
    const n0 = r('S.parts.length'), e = { target: H.getEl('gl'), clientX: 500, clientY: 400, button: 0, preventDefault() { }, stopPropagation() { } };
    for (const t of ['mousemove', 'mousedown', 'mouseup']) for (const f of H.handlers.win[t] || []) f(e);
    return { scr: r('screenNow()'), parts: [n0, r('S.parts.length')], held: r('BLD.st.held&&BLD.st.held.k'), undo: r('BLD.st.undo.length') };
  };
  const A = click('assembly'), R = click('rollout');
  check('app-3: in the page, a click on the rocket picks a part up on the Assembly and changes nothing on the Rollout (R28)',
    !H.errs.length && A.scr === 'assembly' && !!A.held && A.parts[1] < A.parts[0] && R.scr === 'rollout' && !R.held && R.parts[0] === R.parts[1] && !R.undo,
    `Assembly: parts ${A.parts.join(' → ')}, holding ${A.held}; Rollout: parts ${R.parts.join(' → ')}, holding ${R.held || 'nothing'}, undo steps ${R.undo}; errors: ${H.errs[0] || 'none'}`);
}

// app-4. The Debrief's part links show the part's card (R3's lint found it, v1.330): hovering a part named in the *Opened*
// block calls builder.js's card through `BLD.partCardHTML`; before, it called `tipOK`/`partCardHTML`, which live inside
// BLD, and threw. Through the real mouseover/mouseout handlers on #debBody.
{
  const { boot } = await import(new URL('./apphost.mjs', import.meta.url));
  const H = boot(), r = H.run;
  r('ttlFound()'); r("globalThis.__tips=[];{const s=tipShow,h=tipHide;tipShow=(o,html,a)=>{__tips.push(['show',o,String(html).length]);return s(o,html,a)};tipHide=o=>{__tips.push(['hide',o]);return h(o)}}");
  const k = r('Object.keys(PARTS)[0]'), body = H.getEl('debBody'), t = H.mkEl(''); t.dataset.pcard = k; t.closest = sel => sel === '[data-pcard]' ? t : null;
  const fire = (ty) => { for (const f of body._h[ty] || []) f({ target: t, preventDefault() { }, stopPropagation() { } }); };
  let thrown = null; try { fire('mouseover'); fire('mouseout'); } catch (e) { thrown = e.message; }
  const tips = r('__tips');
  check('app-4: hovering a part link on the Debrief shows its card and leaving hides it, without an error (R3)',
    !thrown && !H.errs.length && tips.length === 2 && tips[0][0] === 'show' && tips[0][1] === 'card' && tips[0][2] > 20 && tips[1][0] === 'hide',
    `part ${k}: ${thrown ? 'threw ' + thrown : tips.map(x => x.join(' ')).join(', ')}`);
}

// app-5. The random walk (R34; review 2's monkey.cjs, which found R28–R32): seeded runs of 1,400 player-reachable actions
// each (keys, screen changes, the Esc menu, buttons, offers, waits, Fly, Program tabs, mouse on the canvas, frames,
// timers), on a career and with ?tester. After every action, invariants: funds, day, time, position finite; the HUD shown
// iff flying; one screen flag at most and none in flight; the save loses nothing (progLossy); no ended flight still
// flying. Fails on any exception or broken invariant, printing the first ones with the actions before them. LAUNCH puts
// the Sounding rocket on the table when the design's parts aren't open yet (a new career's are not). In the SLOW set.
{
  const { boot } = await import(new URL('./apphost.mjs', import.meta.url));
  const INV = `(()=>{const hid=id=>document.getElementById(id).classList.contains("hidden");if(!isFinite(PROG.funds))return "funds "+PROG.funds;if(!isFinite(PROG.day))return "day "+PROG.day;if(!isFinite(simT))return "simT";if(S&&!(S.r.every(isFinite)&&S.v.every(isFinite)))return "S.r/S.v not finite";if((mode==="flight")===hid("hud"))return "hud visibility vs mode "+mode;if([atTitle,atDeb,atMC,atHQ,atRoll].filter(Boolean).length>1)return "two screen flags";if(mode!=="editor"&&(atTitle||atDeb||atMC||atHQ||atRoll))return "screen flag set in mode "+mode;if(mode==="flight"&&!S)return "flight without S";const L=progLossy(PROG);if(L.length)return "save loses "+L[0];if(S&&mode==="flight"&&S.rec&&S.rec.ended&&S.alive&&!S.landed&&screenNow()!=="debrief")return "flying an ended flight";return ""})()`;
  const KEYS = [...'abcdefghijklmnopqrstuvwxyz123456789', ' ', 'enter', 'escape', 'backspace', 'delete', 'tab', 'home', ',', '.', '/', '[', ']', 'shift', 'control', 'f2'];
  function walk(seed, N, search) {
    let sd = seed; const R = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; }, pick = a => a[Math.floor(R() * a.length)];
    const H = boot({ search }), seen = new Map(), trail = [], screens = {};
    const note = (key, i, st) => { if (!seen.has(key)) seen.set(key, { n: 0, i, st, trail: trail.slice(-10).join(' > ') }); seen.get(key).n++; };
    function act() {
      const k = R(), sc = H.run('screenNow()'), vis = id => !H.getEl(id).classList.contains('hidden');
      const GO = { assembly: ['rollout', 'program'], program: ['assembly', 'rover', ...(vis('bDebLast') ? ['debrief'] : []), ...(vis('bMC') ? ['mission'] : [])], rollout: ['assembly'], mission: ['program'], debrief: ['assembly', 'program'], rover: ['program'], title: [], flight: [], map: [] }[sc] || [];
      const fl = sc === 'flight' || sc === 'map', BT = { flight: ['bRevert', 'bMap', 'bEditor', 'bHelp', 'bMenu', 'bLog2', 'navref', ...['bEnd', 'bAuto', 'bProc', 'bWings', 'bLegs', 'bBay'].filter(vis)], rollout: ['launch'], program: ['bLog3'], debrief: ['bDebAgain'], assembly: ['bLog'] }; BT.map = BT.flight;
      const escOpen = vis('escm');
      if (!escOpen && sc === 'assembly' && R() < .3) {
        H.click({ go: 'rollout' });
        if (H.run('partLaunchWhy(S.parts).length>0')) H.run('stackDef=JSON.parse(JSON.stringify(PRESETS.Sounding));editorChanged()');
        H.getEl('launch').click(); if (R() < .8) { H.key('z'); H.key(' '); H.keyup('z'); H.keyup(' '); } return 'LAUNCH';
      }
      if (escOpen && k < .5) { const a = pick(['close', 'log', 'keys', 'settings', 'title', ...(fl ? ['end', 'assembly', 'tape', ...(H.run('revertOK()') ? ['revert'] : [])] : []), ...(['assembly', 'rover', 'debrief', 'rollout', 'mission'].includes(sc) ? ['program'] : [])]); H.click({ esc: a }); return 'esc ' + a; }
      if (k < .30) { const key = pick(KEYS); H.key(key); if (R() < .7) H.keyup(key); return 'key ' + key; }
      if (k < .55) { const n = 1 + Math.floor(R() * 40); H.frame(n); return 'frame ' + n; }
      if (k < .63) {
        if (GO.length) { const s = pick(GO); H.click({ go: s }); return 'go ' + s; }
        if (sc === 'title') { if (H.run('needCharter()')) { H.run('ttlFound()'); return 'found'; } const a = pick(['continue', 'continue', 'new']); H.click({ ttl: a }, { self: 1 }); return 'ttl ' + a; }
        return 'noop';
      }
      if (k < .72) { const L = BT[sc] || []; if (!L.length) return 'noop'; const b = pick(L); H.getEl(b).click(); return 'btn ' + b; }
      if (k < .78 && sc === 'program') { const o = H.run('(PROG.offers||[]).map(c=>c.id)'); if (!o.length) return 'noop'; const id = pick(o); H.click({ acc: String(id) }); return 'acc ' + id; }
      if (k < .84 && (sc === 'program' || sc === 'mission')) { const e = H.run('upcoming().map(e=>e.day)'); if (!e.length) return 'noop'; H.click({ adv: String(e[0]) }); return 'adv'; }
      if (k < .88 && (sc === 'program' || sc === 'mission')) { const o = H.run('(PROG.sats||[]).filter(q=>flyable(q)).map(q=>q.id)'); if (!o.length) return 'noop'; H.click({ fly: String(pick(o)) }); return 'fly'; }
      if (k < .91 && sc === 'program') { const t = pick(['inbox', 'missions', 'contracts', 'fleet', 'world', 'industry', 'company', 'more']); H.click({ ptab: t }); return 'ptab ' + t; }
      if (k < .96 && (fl || sc === 'assembly' || sc === 'rollout')) {
        const cv = H.getEl('gl'), e = { clientX: R() * 1280, clientY: R() * 720, target: cv, button: 0, preventDefault() { }, stopPropagation() { }, shiftKey: false, ctrlKey: false };
        for (const f of cv._h.mousedown || []) f(e); for (const f of H.handlers.win.mousedown || []) f(e);
        if (R() < .5) { e.clientX += 40; for (const f of H.handlers.win.mousemove || []) f(e); }
        for (const f of H.handlers.win.mouseup || []) f(e); return 'mouse';
      }
      H.timers(); return 'timers';
    }
    if (H.errs.length) note('load ' + H.errs[0].slice(0, 160), -1, H.errs[0]);
    for (let i = 0; i < N && !H.errs.length; i++) {
      let d = '?'; const n0 = H.errs.length;
      try { screens[H.run('screenNow()')] = (screens[H.run('screenNow()')] || 0) + 1; d = act(); }
      catch (e) { const st = H.where(e.stack || String(e)).split('\n'); note(st[0] + ' ' + (st[1] || '').trim(), i, st.slice(0, 5).join(' | ')); d += '!'; }
      trail.push(d);
      try { const bad = H.run(INV); if (bad) note('INVARIANT ' + bad, i, 'INVARIANT ' + bad); } catch (e) { note('INV-THROW ' + e.message, i, e.message); }
      for (const m of H.errs.splice(n0)) note(m.slice(0, 160), i, m);
    }
    return { seed, search, seen, screens, flights: H.run('PROG.flights'), day: H.run('PROG.day') };
  }
  const t0 = performance.now(), runs = [[1, ''], [2, ''], [3, '?tester'], [4, '?tester']].map(([s, q]) => walk(s, 1400, q));
  const bad = runs.flatMap(w => [...w.seen].map(([k, v]) => `seed ${w.seed}${w.search}: ×${v.n} first at #${v.i}: ${v.st.slice(0, 220)} [after: ${v.trail}]`));
  check('app-5: the random walk: 4 × 1,400 player actions (2 on a career, 2 with ?tester) throw nothing and break no invariant (R34)',
    !bad.length,
    `${(performance.now() - t0) / 1e3 | 0} s; ${runs.map(w => `seed ${w.seed}${w.search}: ${w.flights} flights, day ${w.day.toFixed(0)}, screens ${Object.entries(w.screens).map(([k, v]) => k + ' ' + v).join(' ')}`).join(' · ')}${bad.length ? ' — ' + bad.slice(0, 4).join(' — ') : ''}`);
}
