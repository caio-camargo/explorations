// tests/flow.mjs — test sections: flow. Not a module on its own: shards.mjs splices every file in tests/ (in the
// order of TEST_FILES) between test.mjs's prelude (the SIM as `api`, `check`) and its summary, and runs that as one module.
// Add a section at the end of your lane's file: "// <lane>-<n>. Title" at column 0, then a { block }. NOTES § "Test shards".

// flow-1. Debrief (flow session, UI slice 3; QUEUE Q2): a settled flight leaves a summary record (sim/debrief.js) that the
// Debrief screen renders: outcome, money line by line (adding up to what the program actually gained or lost), missions,
// certifications, logbook records, incidents, know-how. Built once, at settlement; the page sends a flight that settles
// on the way out to the Debrief screen.
{
  const P = api.PROG; api.HOOK.news = () => {};
  Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: api.FUNDS0, bailouts: 0, offers: [], active: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], kh: {}, log: {} });
  api.t = 0; let s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); let armed = false, n = 0;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  const b = s.rec.deb0, out = api.flightLeave(s), D = out && out.debrief, M = D ? D.money : [];
  const sum = M.reduce((a, m) => a + m.v, 0), row = l => M.find(m => m.l.startsWith(l));
  check('flow-1: a landed flight, once settled, has a debrief record (returned, on the record, and the last one)',
    !!b && !!D && D === s.rec.debrief && D === api.DEBRIEF_LAST && D.outcome.k === 'landed' && D.flight === P.flights, D ? `${D.outcome.t}: ${D.outcome.d}` : 'none');
  check('flow-1: the money adds up: hardware, operations, refurbishment, the rest; their sum is what the program gained or lost',
    D && Math.abs(sum - D.net) < 1e-6 && Math.abs(D.net - (P.funds - b.funds)) < 1e-6 && row('Hardware').v === -s.rec.cost && Math.abs(row('Refurbishment').v - s.rec.refund) < 1e-9,
    M.map(m => `${m.l} ${m.v.toFixed(1)}`).join(' · ') + ` = ${D && D.net.toFixed(1)}M`);
  const newly = Object.keys(P.done).filter(k => !b.done.includes(k)).map(k => api.MISSIONS.find(x => x.id === k).name);
  check('flow-1: missions done on the flight are listed with their pay; know-how gained is listed by part',
    D && D.missions.length === newly.length && D.missions.every(m => newly.includes(m.l) && row(m.l)) && D.kh.some(k => /Sparrow/.test(k.l) && k.b > k.a),
    `missions: ${D && D.missions.map(m => `${m.l} +${m.pay.toFixed(0)}`).join(', ') || 'none'} · know-how: ${D && D.kh.map(k => `${k.l} ${(k.a * 100).toFixed(0)}→${(k.b * 100).toFixed(0)}%`).join(', ')}`);
  check('flow-1: settled once: leaving again builds no second record', api.flightLeave(s) === null && api.DEBRIEF_LAST === D);
  // a flight lost in the air
  api.t = 0; s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); n = 0;
  while (s.alive && api.t < 20 && n++ < 200000) api.advPhys(s);
  s.alive = false; const L = api.flightLeave(s);
  check('flow-1: a vessel destroyed in flight is debriefed as lost', L && L.debrief && L.debrief.outcome.k === 'lost' && L.debrief.flight === D.flight + 1, L && L.debrief && `${L.debrief.outcome.t}: ${L.debrief.outcome.d}`);
  // the page: go() debriefs a flight that settles on the way out; the screen has its keys; the Esc menu can end a flight
  const H = html.replace(/\r\n/g, '\n'), gi = H.indexOf('function go(s){'), goSrc = gi < 0 ? '' : H.slice(gi, H.indexOf('\n// Keys, one table', gi));
  check('flow-1: leaving a flight goes to Debrief first; Debrief has keys and exits; the Esc menu has End flight',
    /s='debrief'/.test(goSrc) && /debrief:\[\{k:\['p'\]/.test(H) && /b\('end','End flight/.test(H) && /id="bDebAgain"/.test(H) && /id="bEnd"/.test(H));
  Object.assign(P, { done: {}, flights: 0, funds: api.FUNDS0, kh: {}, log: {} });
}

// flow-2. What to do next (flow session, QUEUE Q40): the Program screen's one suggestion. A new career is pointed at the
// cheapest first step a preset can fly; a decision or an accepted contract comes first; done missions move it on.
{
  const P = api.PROG, save = { done: P.done, decisions: P.decisions, active: P.active, offers: P.offers, raceLost: P.raceLost };
  Object.assign(P, { done: {}, decisions: [], active: [], offers: [], raceLost: {} });
  const a = api.nextStep(); P.done.weather = P.done.loads = { flight: 1 }; const b = api.nextStep(); P.done.hop = P.done.beeper = { flight: 2 }; const c = api.nextStep();
  P.decisions = [{ title: 'A public launch', expires: (P.day || 0) + 12, opts: [] }]; const d = api.nextStep();
  check('flow-2: next step: a new career starts with a preset-flyable first step; then first orbit or a passenger; then what is left; a decision comes first',
    a && a.id === 'weather' && a.preset === 'Sounding' && /opens/.test(a.why) && b && ['hop', 'beeper'].includes(b.id) && /be first/.test(b.why) && c && c.kind === 'mission' && !['weather', 'loads', 'hop', 'beeper'].includes(c.id) && d && d.kind === 'decision',
    [a, b, c, d].map(x => x && `${x.title} (${x.why}${x.how ? '; ' + x.how : ''})`).join(' → '));
  Object.assign(P, save);
}

// flow-3. A landing site picked on the map (flow session, QUEUE Q62): the click's ray meets a moon's near side and gives a
// site in that body's frame (pf, what bodies' landAt flies to); a ray at Tellus picks nothing; the site goes into a
// landing procedure for that body (its transfer and its descent) and leaves any other procedure alone.
{
  const B = api.SELENE, t0 = 1234, c = api.bodyPos(B, t0), o = add(c, [0, 0, 5 * B.R]), d = norm(sub(add(c, [B.R * 0.3, B.R * 0.2, 0]), o));
  const hit = api.surfacePick(o, d, t0), back = hit && add(c, api.fromPF(B, hit.pf, t0));
  const miss = api.surfacePick([0, 0, 5 * TELLUS.R], [0, 0, -1], t0);
  const land = { kind: 'mission', sig: 'Selene:land', phases: [{ k: 'transfer', to: 'Selene', pass: 40e3 }, { k: 'capture', ap: 40e3, pe: 10e3 }, { k: 'land' }, { k: 'surface', t: 600 }, { k: 'return', perigee: 45e3 }] };
  const fly = { kind: 'mission', sig: 'Selene:flyby', phases: [{ k: 'transfer', to: 'Selene', pass: 40e3 }] };
  const L = hit && api.procWithSite(land, 'Selene', hit.pf), F = hit && api.procWithSite(fly, 'Selene', hit.pf);
  check('flow-3: a map click on Selene gives a site on its near side; one at Tellus gives none; the site goes into a landing procedure (transfer and descent) only',
    hit && hit.body === 'Selene' && Math.abs(len(api.fromPF(B, hit.pf, t0)) - B.R) < 1 && dot(sub(back, c), sub(o, c)) > 0 && miss === null
      && L !== land && L.phases[0].site === hit.pf && L.phases[2].site === hit.pf && !L.phases[1].site && !land.phases[2].site && F === fly && api.procLandsOn(land, 'Nyx') === false,
    hit ? `${hit.body} ${api.sitePlace(hit.pf)} (${(len(api.fromPF(B, hit.pf, t0)) / 1e3).toFixed(1)} km from the centre)` : 'no hit');
}

// flow-4. The planets on the map (flow session, QUEUE Q175, Q87 slice 1's drawing; PLAYTEST #11): Helios and the five
// other planets, each at fromTellus's place that day, its distance in TU, a disc sized by class (Hyperion biggest,
// Astraea and Erebus at the 2 px floor), its direction laid into the ecliptic for the map's ring, never Tellus itself;
// a planet moves across the sky as the days pass.
{
  const D = new Function(src + 'return {planetMarks,fromTellus,eclFrame,TU,DAY_S,len,dot,norm,sub,mul};')(), N = D.eclFrame().N;
  const T = 123 * D.DAY_S, M = D.planetMarks(T), by = n => M.find(m => m.name === n), names = M.map(m => m.name).join();
  const placeOK = M.every(m => D.len(m.p) > 0 && D.dot(D.norm(m.p), D.norm(D.fromTellus(m.name, T))) > 1 - 1e-12 && Math.abs(m.d - D.len(m.p) / D.TU()) < 1e-12
    && Math.abs(D.len(m.u) - 1) < 1e-12 && Math.abs(D.dot(m.u, N)) < 1e-12 && D.dot(m.u, D.norm(D.sub(m.p, D.mul(N, D.dot(m.p, N))))) > 1 - 1e-12);   // the ring: in the ecliptic, at its longitude
  const pxOK = by('Hyperion').px === 6 && by('Astraea').px === 2 && by('Erebus').px === 2 && by('Hesper').px > by('Enyo').px && by('Helios').px === 7;
  const moved = Math.acos(Math.min(1, D.dot(D.norm(D.planetMarks(T + 60 * D.DAY_S).find(m => m.name === 'Enyo').p), D.norm(by('Enyo').p)))) * 180 / Math.PI;
  check('flow-4: the map has Helios and the five other planets (not Tellus) where they are that day (ring direction in the ecliptic), their distance in TU and a disc by class; Enyo moves across the sky in 60 days',
    names === 'Helios,Hesper,Enyo,Astraea,Hyperion,Erebus' && placeOK && pxOK && Math.abs(by('Helios').d - 1) < 0.02 && moved > 5,
    `${M.map(m => `${m.name} ${m.d.toFixed(2)} TU ${m.px.toFixed(1)} px`).join(', ')}; Enyo moved ${moved.toFixed(1)}° in 60 days`);
}

// flow-5. The flight readout's core and cards (flow session, UI slice 4a, QUEUE Q3; NOTES § UI "Slice 4 plan"): the core
// in updateHUD has at most 6 rows and calls none of the row helpers; each helper sits in a card in app/hud.js's
// HUD_CARDS; when the column is too tall, the oldest unpinned cards fold to their title bars first, pinned ones never.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  const hud = cut(page, 'function updateHUD(){', '\nlet rangeWarned'), core = cut(hud, 'const core=[', "$('info').innerHTML");
  // count the core array's top-level entries: commas at bracket depth 1, outside strings and template text
  let depth = 0, n = 0, q = null, tl = [];
  for (let i = 'const core='.length; i < core.length; i++) { const ch = core[i];
    if (q) { if (ch === '\\') { i++; continue } if (q === '`' && ch === '$' && core[i + 1] === '{') { tl.push(depth); q = null; depth++; i++; continue } if (ch === q) q = null; continue }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue }
    if (ch === '}' && tl.length && depth - 1 === tl[tl.length - 1]) { depth = tl.pop(); q = '`'; continue }
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) { depth--; if (depth === 0) { n++; break } } else if (ch === ',' && depth === 1) n++; }
  const helpers = ['spinRows', 'wheelRows', 'rcsRows', 'tgtRows', 'dockRows', 'fleetRows', 'bayRows', 'armRows', 'rvRows', 'payloadRows'];
  const cards = cut(page, 'const HUD_CARDS=[', '\n// Which cards fold'), inHud = helpers.filter(h => hud.includes(h + '(')), noCard = helpers.filter(h => !cards.includes(h));
  check('flow-5: the flight readout\'s core has at most 6 rows and no helper rows; every row helper has a card (HUD_CARDS)',
    core.length > 100 && n >= 4 && n <= 6 && !inHud.length && !noCard.length, `${n} core rows${inHud.length ? '; in updateHUD: ' + inHud.join(' ') : ''}${noCard.length ? '; no card: ' + noCard.join(' ') : ''}`);
  const cardFolds = new Function(cut(page, 'function cardFolds(', '\nconst hudPins') + ';return cardFolds')();
  const C = [{ id: 'a', h: 100, ht: 20, since: 3 }, { id: 'b', h: 120, ht: 20, since: 1, pinned: true }, { id: 'c', h: 80, ht: 20, since: 2 }, { id: 'd', h: 60, ht: 20, since: 4 }];
  const f = a => [...cardFolds(C, a)].join('');
  check('flow-5: a column too tall folds the oldest unpinned cards to their title bars first, never a pinned one, and only as many as it takes',
    f(1000) === '' && f(320) === 'c' && f(260) === 'ca' && f(100) === 'cad', `fits: "${f(1000)}", 320 px: "${f(320)}", 260: "${f(260)}", 100: "${f(100)}"`);
}

// flow-6. The crew in the Debrief (flow session, QUEUE Q191; PLAYTEST #34): a crewed flight records its seats at liftoff,
// and the Debrief says how it ended for the people: home safe after so many days, aboard and well, or how they were lost.
// Test dummies (before the escape tower is qualified) get no crew line.
{
  const P = api.PROG, d0 = P.done; api.HOOK.news = () => {}; api.HOOK.msg = () => {};
  const fly = (people, end) => { P.done = { ...d0, maxqabort: people ? 1 : undefined }; if (!people) delete P.done.maxqabort;
    api.t = 0; const s = api.newShip(['chute', 'crew', 't2', 'petrel']); api.S = s; s.landed = false; api.missionTick(s, 0, false); end(s); return { s, D: api.debriefOf(s, s.rec, []) }; };
  const home = fly(true, s => { s.landed = true; s.alive = true; api.t = 2.5 * api.DAY_S; s.rec.crewOK = true; });
  const lost = fly(true, s => { s.alive = false; api.t = 300; api.missionTick(s, 0, false); });
  const up = fly(true, s => { api.t = 3600; });
  const dummies = fly(false, s => { s.landed = true; });
  P.done = d0; api.t = 0;
  check('flow-6: the Debrief has the crew: home safe after the days flown, aboard and well, or lost and why; dummies get no line',
    home.s.rec.crewN === 2 && home.D.crew && /^Crew of 2 home safe after 2\.5 days$/.test(home.D.crew.line) && lost.D.crew && !lost.D.crew.ok && /^The crew of 2 were lost$/.test(lost.D.crew.line)
      && up.D.crew && /aboard, all well/.test(up.D.crew.line) && !dummies.D.crew,
    [home, lost, up].map(x => x.D.crew ? x.D.crew.line : 'none').join(' · ') + ` · dummies: ${dummies.D.crew ? dummies.D.crew.line : 'no line'}`);
}

// flow-7. Slice 4c, the map trims (flow session, QUEUE Q3; NOTES § UI "Slice 4 plan" 5): in the map the core stays, the
// navball becomes a heading line (body.mapv once hid the ball and the throttle bar; since Q254, v1.128, a smaller ball shows beside the line, which carries the throttle), the gauges
// and every card but Target hide.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const css = /body\.mapv #nav\{width:130px/.test(H) && /body\.mapv #navtxt\{position:static/.test(H);   // (Q254, v1.128) the ball shows on the map again, smaller, with its heading line
  const tog = /const mv=mode==='flight'&&view==='map';[^\n]*toggle\('mapv',mv\)/.test(page), thr = /view==='map'\?`  THR /.test(page);
  const cards = /view!=='map'\|\|c\.id==='target'/.test(page), gauges = /function gaugeSlot\(\)[^\n]*view!=='map'/.test(page);
  check('flow-7: in the map the navball is a heading line with the throttle, the gauges hide and only the Target card shows',
    css && tog && thr && cards && gauges, `css ${css} · toggle ${tog} · throttle ${thr} · cards ${cards} · gauges ${gauges}`);
}

// flow-8. The rollout lying down (flow session with look & sound, QUEUE Q193): on a Steppe pad the Rollout rolls the rocket
// from the hall on the erector's car, raises it on the boom, then closes the arms (rollPhase, app/rollout.js); gl.js
// draws the car, boom, arms and the ship from that clock. Checked in the source, and the clock's three phases run in turn.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  const src = cut(page, 'const ROLL_S=', '\nfunction rollChecks');
  let now = 0, site = {}, sch = 1;
  const rp = new Function('atRoll', 'mode', 'padSchoolOf', 'curSite', 'performance', 'sstep', 'clamp', src + ';return rollPhase')(true, 'editor', () => sch, () => site, { now: () => now },
    (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }, (x, a, b) => Math.min(b, Math.max(a, x)));
  const at = ms => { now = ms; const r = rp(); return r && [r.roll, r.up, r.arms].map(x => +x.toFixed(2)).join('/') };
  const seq = [at(0), at(3500), at(9500), at(12750), at(20000)]; sch = 0; const cape = rp(); sch = 1; site = {}; const again = at(20500);
  const wired = /function drawSteppeRig[^\n]*rollPhase\(\)/.test(page) && /Mship=rollTilt\(camW,/.test(page) && /s==='rollout'\)\{[^\n]*rollSite=null/.test(page);
  check('flow-8: on a Steppe pad the Rollout rolls the rocket out lying down, raises it, then closes the arms; a Cape pad has none; another site restarts it',
    wired && seq.join(' ') === '0/0/0 0.5/0/0 1/0.5/0 1/1/0.5 1/1/1' && cape === null && again === '0/0/0', `${seq.join(' ')} · cape ${cape} · new site ${again} · wired ${wired}`);
}

// flow-9. Flags and roundels (flow session, QUEUE Q104; POWERS.md § Schools "Flag motifs"): every school and variant
// draws a well-formed flag and roundel in the power's hue; this world's powers fly different flags; a resource state has
// its own (not its contractor's); a news line gets the roundel of the first power it names.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  const F = new Function('POWERS', cut(page, 'const FLAG_W=', '\nconst powerMark') + ';' + cut(page, 'function newsMark(', '\n') + ';return {flagSVG, roundelSVG, newsMark, flagVar, flagKind}');
  const tags = s => { const st = []; for (const m of s.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) { if (m[3]) continue; if (m[1]) { if (st.pop() !== m[2]) return false } else st.push(m[2]) } return !st.length };
  const f0 = F([]), bad = [];
  for (const school of ['cape', 'steppe', 'arsenal', 'coastal', 'mountain', 'isle']) for (const c of [null, 1]) for (const nm of ['Kingdom of X', 'Emirate of X', 'X Union']) for (const hue of [0, 137, 275]) for (let k = 0; k < 12; k++) {
    const p = { name: nm, root: 'R' + k, school, contractor: c, hue }, a = f0.flagSVG(p, 24), b = f0.roundelSVG(p, 14);
    if (!tags(a) || !tags(b) || /NaN|undefined/.test(a + b) || !a.includes(`hsl(${hue},70%,42%)`)) bad.push(`${school}/${c}/${nm}/${hue}/${k}`) }
  const P = api.POWERS, f1 = F(P), flags = P.map(p => f1.flagSVG(p, 24)), distinct = new Set(flags).size;
  const res = P.find(p => p.contractor != null), own = res ? f1.flagKind(res) !== res.school : true;
  const two = P.slice(1, 3), line = `${two[1].root} answers ${two[0].name}'s launch`, nm = f1.newsMark(line), none = f1.newsMark('A quiet day');
  check('flow-9: flags and roundels: every school and variant draws in the power\'s hue; this world\'s powers fly different flags; a resource state has its own; news gets the first named power\'s roundel',
    !bad.length && distinct === P.length && own && nm.includes(two[1].name) && none === '', `${bad.length} bad${bad.length ? ' (' + bad.slice(0, 3).join(', ') + ')' : ''} · ${distinct}/${P.length} distinct · resource state's own ${own} · news "${line}" → ${(nm.match(/aria-label="([^"]*)"/) || [])[1]}`);
}

// flow-10. Rooms (flow session, QUEUE Q239 R0+R1, Q241 R2; NOTES § UI "Plan: real screens"): the Program is a room, so frame() draws
// no 3D behind it (and takes the liftoff photo only after a real draw); go() marks the body; the Inbox is the desk's
// in-tray, not a folder tab, and its button (the tray's label) still answers data-ptab="inbox".
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const rooms = /const ROOMS=new Set\(\['program','debrief','mission'\]\)/.test(page), gate = /if\(!inRoom\(\)\)\{adaptRes\(dtR\);render\(\);deskPhotoTick\(\)\}/.test(page);
  const bare = (page.match(/(^|[^.\w])render\(\);/gm) || []).length;   // the one draw call is the gated one
  const body = /toggle\('room',inRoom\(\)\)/.test(page), tabs = /filter\(\(\[k\]\)=>k!=='inbox'&&/.test(page);
  const tray = /<button id="deskTrayN" data-ptab="inbox"/.test(H) && /<div id="deskTrayBox">/.test(H) && /deskLayout\(box,progGate\)/.test(page);
  const fonts = ['special-elite', 'courier-prime', 'courier-prime-bold', 'bebas-neue'].every(f => H.includes(`url(fonts/${f}.woff2)`));
  // (Q241 R2) the Debrief is the flight report on the same desk: its exits keep their ids, its wall pins this flight's photo
  const report = /<div id="debActs"><button id="bDebAgain">/.test(H) && /id="bDebProg" data-go="program"/.test(H) && /ph&&ph\.flight===D\.flight\?ph:null/.test(page) && /deskClipping\(nw,'clipn'\)/.test(page);
  check('flow-10: the Program and the Debrief are rooms (no 3D draw behind them, body.room), the Inbox is the in-tray, the Debrief a report with the flight photo, the paperwork fonts are bundled',
    rooms && gate && bare === 1 && body && tabs && tray && report && fonts, `rooms ${rooms} · gated draw ${gate} · draw calls ${bare} · body ${body} · tabs ${tabs} · tray ${tray} · report ${report} · fonts ${fonts}`);
}

// flow-11. The model on the desk (flow session at Caio's ask, QUEUE Q242; PLAYTEST #45): in the Assembly the design is a
// scale model on a drafting table. render() skips the sky, the pads, the pad rig and crew, the cities and the floodlights
// there, lights by the lamp, and shadows the model onto the drawing; the scale is a kit scale that keeps the model under
// 45 cm. Only the Assembly: the Rollout and the flight stay on the real pad.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  const sc = new Function(cut(page, 'const DESK_SCALES=', ';\nconst DESK_BG') + ';' + cut(page, 'const deskScaleFor=', '\n') + ';return deskScaleFor')();
  const picks = [1, 9, 14.47, 30, 60, 120, 400].map(h => [h, sc(h)]), fit = picks.every(([h, n]) => h / n <= 0.45 || n === 500), tight = picks.every(([h, n]) => n === 20 || h / [20, 24, 32, 48, 72, 96, 144, 200, 288, 400, 500][[20, 24, 32, 48, 72, 96, 144, 200, 288, 400, 500].indexOf(n) - 1] > 0.45);
  const only = /const deskScene=\(\)=>DESK_FX&&mode==='editor'&&[^\n]*screenNow\(\)==='assembly'/.test(page);
  const r = cut(page, 'function render(){', '\nfunction nuToT');
  const skips = /if\(!desk\)\{for\(const prog of PDEPTH/.test(r) && /if\(!DF\)\{const th=bodyTheta\(TELLUS,simT\);for\(const t of SITES\)/.test(r) && /if\(!DF\)\{gl\.uniform1f\(m\.uPadM,1\);drawPadRig/.test(r)
    && /if\(!DF&&len\(camW\)<TELLUS\.R\+80000\)/.test(r) && /if\(!DF\)drawPadGlow/.test(r);
  const lamp = /const lit=DF\?\(\)=>1:/.test(r) && /if\(DF\)deskLight\(m,DF\)/.test(r) && /deskShadowM\(DF,camW,Mship\)/.test(r) && /if\(DF\)deskDraw\(drawMesh,m,DF\)/.test(r);
  check('flow-11: the Assembly is a scale model on a desk (a kit scale under 45 cm; no sky, pads or cities there; lamp light and its shadow); only the Assembly',
    fit && tight && only && skips && lamp, `scales ${picks.map(([h, n]) => `${h} m→1:${n}`).join(', ')} · fit ${fit} · tight ${tight} · assembly only ${only} · skips ${skips} · lamp ${lamp}`);
}

// flow-12. Small playtest fixes (flow session, 2026-10-11; QUEUE Q273, Q263, Q255, Q260, Q266, Q256, Q272, Q269, Q254,
// Q258): the node panel's Delete reaches the delete (its 'del' used to match the Δv nudges) and deletes the selected node;
// a landed vessel at home is recovered; the map draws one arc and one impact (the leg stops at the top of the air) and a
// slow decay that outlasts the fall's steps is no impact; the planets' ring sits outside the moons; the player reads
// "Design table"; the overlay is drawn at device pixels; flight HUD buttons sit on an opaque plate.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const del = /if\(\/\^d\[012\]\[\+-\]\$\/\.test\(a\)\)/.test(page) && /else if\(a==='del'\)nodeDelSel\(\)/.test(page) && /k==='delete'&&S\.node\)nodeDelSel\(\)/.test(page) && /else S\.nodeQ\.splice\(k-1,1\)/.test(page);
  const rec = /const debRecover=\(\)=>!!\(S&&S\.alive&&S\.landed&&S\.body===TELLUS\)/.test(page) && /'Recover vessel ▸ \[Enter\]'/.test(page);
  const arcs = /fallIn=k===0&&!dash&&pt\.b\.atm&&impact/.test(page) && /if\(fallIn&&t>=simT&&rl<top&&up\)/.test(page) && /return f&&f\.capped\?null:f\}/.test(H) && /capped:i>=40000/.test(H) && /if\(T&&T\[i\]<t0\)continue/.test(page);
  const ring = /rr=moons<2\.5\*cam\.mDist\?Math\.max\(cam\.mDist\*\.3,moons\)/.test(page) && /not to scale/.test(page);
  const named = /assembly:'Design table'/.test(page) && /<button id="bEditor">Design table<\/button>/.test(H) && !/>Assembly \[B\]</.test(H) && /TO THE DESIGN TABLE/.test(H);
  const crisp = /octx\.setTransform\(OV_K,0,0,ov\.height\/H,0,0\)/.test(page) && /shadowBlur=6\*k\*OV_K/.test(page);
  const plate = /#hud button\{background:rgba\(9,15,24,\.86\)/.test(H);
  const nav = /body\.mapv #nav\{width:130px/.test(H) && /\['N',f\.n,'#ff4a3a'\]/.test(page);
  check('flow-12: small fixes: node Delete, Recover vessel, one arc and one impact, no decay round the planet, the planets ring, Design table, crisp overlay, toolbar plate, navball on the map',
    del && rec && arcs && ring && named && crisp && plate && nav, `delete ${del} · recover ${rec} · arcs ${arcs} · ring ${ring} · named ${named} · crisp ${crisp} · plate ${plate} · navball ${nav}`);
}

// flow-13. Mission control (flow session, QUEUE Q241 R4; NOTES § UI "Plan: real screens"): a room (no 3D behind it) that
// took the Network screen's place: C from the Program (N still works), the same opening rule (netOpen). A wall (clocks,
// the ground track or the pads' calendar, the pads) over four consoles whose buttons are the Program's own. netModel's
// fleet rows carry the registry id (or the dispatch's), and a decaying craft says when it re-enters, not "0 more days" (Q203).
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const room = /atMC\?'mission'/.test(page) && /\$\('mc'\)\.classList\.toggle\('hidden',!atMC\)/.test(page) && !/atNet|renderNetwork|id="net"/.test(H)
    && /if\(s==='mission'&&!netOpen\(\)\)/.test(page) && /k:\['c','n'\],l:'C',d:'mission control/.test(page) && /<button id="bMC" data-go="mission"/.test(H);
  const parts = ['mcClock', 'mcTrack', 'mcCal', 'mcPads', 'mcCons'].every(id => H.includes(`id="${id}"`)) && ['Flight', 'Network', 'Trajectory', 'Dispatch'].every(n => page.includes(`mcCon('${n}'`))
    && ['data-fly', 'data-mc', 'data-devtake', 'data-devlose', 'data-adv'].every(d => new RegExp(`<button ${d}=`).test(page.slice(page.indexOf('function renderMission'))));
  const font = H.includes('url(fonts/vt323.woff2)');
  const X = new Function(src + 'return {netModel,newShip,PRESETS,satRegister,TELLUS,PROG,HOOK};')();
  const P = X.PROG, T = X.TELLUS; X.HOOK.news = () => {}; X.HOOK.msg = () => {}; X.HOOK.save = () => {}; P.sats = []; P.day = 0;
  const s = X.newShip(X.PRESETS.Probe), a = T.R + 200e3;   // a Probe at 200 km with its tanks emptied (as space's decay check)
  Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -Math.sqrt(T.mu / a)] }); X.satRegister(s, { day0: 0 });
  const q = P.sats.at(-1); for (const o of q.shape) if (o.res) for (const k of ['fuel', 'gas']) if (o.res[k] > 0) { q.mass -= o.res[k] * 1000; o.res[k] = 0; }
  const f = X.netModel().fleet.find(x => x.id === q.id);
  const q203 = f && /re-enters in about/.test(f.next) && !/0 more days/.test(f.next) && f.t > 0;
  check('flow-13: mission control is a room in the Network screen\'s place (C), a wall over four consoles using the Program\'s buttons; fleet rows carry ids; a decaying craft says when it re-enters (Q203)',
    room && parts && font && q203, `room ${room} · parts ${parts} · font ${font} · fleet ${f ? f.next : 'no row'}`);
}

// flow-14. A planned burn moved to the next contact (flow session, QUEUE Q196): in the mainframe era a burn no station sees
// can't be handed over (v1.102); mission control's Trajectory console offers "Fly at the next contact": the same burn whole
// orbits later, where the craft is at the same place in its orbit and a station sees it. Later burns move with it, the
// first is handed over, and it does what the planned one would have (here: the same raise, within the era's error).
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceDays,nodeHandOff,nodeNextPass,nodeToPass,entryLink,elements,TELLUS,PROG,HOOK};')();
  const news = [], msgs = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = m => msgs.push(m); D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, a0 = T.R + 300e3, vc = Math.sqrt(T.mu / a0);
  const reg = day => { P.sats = []; P.day = day; P.stations = []; P.decisions = []; P.active = []; P.dispatch = []; news.length = 0; msgs.length = 0;
    const s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r: [a0, 0, 0], v: [0, 0, -vc], node: { t: 30000, dv: [20, 0, 0], b: 'Tellus' } });
    D.satRegister(s, { day0: day }); const q = P.sats.at(-1); while (D.entryLink(q, q.nodes[0].T).ok) q.nodes[0].T += 30; return q; };   // a burn out of every station's view
  let q = reg(2000); const T0 = q.nodes[0].T; q.nodes.push({ ...q.nodes[0], T: T0 + 2700 });   // a second burn, half an orbit on
  const refused = !!(D.nodeHandOff(q.id) || {}).refused, p = D.nodeNextPass(q), period = 2 * Math.PI * Math.sqrt(a0 ** 3 / T.mu);
  const found = p.k >= 1 && D.entryLink(q, p.T).ok && Math.abs((p.T - T0) - p.k * period) < 60;
  const moved = D.nodeToPass(q.id) === q && q.nodes[0].T === p.T && q.nodes[0].mc && q.nodes[1].T - q.nodes[0].T === 2700 && news.some(m => /burn moved \d+ orbits? later/.test(m));
  q.nodes.length = 1; const a1 = D.elements(q.r, q.v, T.mu).a; D.advanceDays(2);   // (as space-16: the burn falls inside the step)
  const da = D.elements(q.r, q.v, T.mu).a - a1, want = 2 * a0 * 20 / vc;   // a small prograde burn raises a by 2a·dv/v
  const flown = news.some(m => /Mission control flew/.test(m)) && Math.abs(da - want) < 0.1 * want;
  const H = html.replace(/\r\n/g, '\n'), ui = /data-mcpass="\$\{q\.id\}"/.test(H) && /Fly at the next contact/.test(H) && /nodeToPass\(\+pa\)/.test(H);
  check('flow-14: a burn out of contact moves to the next contact (whole orbits later, a station in view), later burns with it, handed over, and flies the same raise',
    refused && found && moved && flown && ui, `refused ${refused} · next pass ${p.k} orbits later (${((p.T - T0) / 3600).toFixed(1)} h) over ${p.st && p.st.name} · moved ${moved} · a +${(da / 1e3).toFixed(1)} km (planned +${(want / 1e3).toFixed(1)}) · ui ${ui}`);
}
