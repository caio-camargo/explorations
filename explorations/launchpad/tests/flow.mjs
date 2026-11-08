// tests/flow.mjs — test sections: flow. Not a module on its own: shards.mjs splices every file in tests/ (in the
// order of TEST_FILES) between test.mjs's prelude (the SIM as `api`, `check`) and its summary, and runs that as one module.
// Add a section at the end of your lane's file: "// <lane>-<n>. Title" at column 0, then a { block }. NOTES § "Test shards".

// flow-1. Debrief (flow session, UI slice 3; QUEUE Q2): a settled flight leaves a summary record (sim/debrief.js) that the
// Debrief screen renders: outcome, money line by line (adding up to what the program actually gained or lost), missions,
// certifications, logbook records, incidents, know-how. Built once, at settlement; the page sends a flight that settles
// on the way out to the Debrief screen.
{
  const P = api.PROG; api.HOOK.news = () => {};
  Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 0, funds: api.FUNDS0, bailouts: 0, offers: [], active: [], back: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], kh: {}, log: {} });
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
  const rooms = /const ROOMS=new Set\(\['title','program','debrief','mission'\]\)/.test(page), gate = /if\(!inRoom\(\)\)\{adaptRes\(dtR\);render\(\);deskPhotoTick\(\)\}/.test(page);
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
  const arcs = /fallIn=k===0&&!dash&&pt\.b\.atm&&impact/.test(page) && /if\(fallIn&&t>=simT&&rl<top&&up\)/.test(page) && /return f&&f\.capped\?null:f\}/.test(H) && /capped:i>=40000/.test(H) && /fallLine\(impact,impact\.t-1\.05\*P\)/.test(page);   // (Q489) the last revolution: fallLine's tMin
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

// flow-15. Watch mode (flow session, QUEUE Q43; NOTES economy § "Dispatch — the economy's answers" 5): a dispatch you
// watch stops the clock at its launch and waits there (half a day, then it flies itself); on screen it's the same
// procedure with the same seeded rolls (watchPlan), so left alone it reaches the orbit the headless flight reaches; a
// rolled break-up or dead engine ends it in the climb with the headless reason; a failed relight stops it at the
// circularisation. Its liftoff adds no stacking or pad wait (it was stacked in the queue).
{
  const P = api.PROG, saved = JSON.stringify(P), news = [], hk = { ...api.HOOK }; api.HOOK.news = m => news.push(m); api.HOOK.msg = () => {}; api.HOOK.save = () => {};
  const sst = ['sci', 't2', 'petrel', 'dec', 't8', 'fins', 'kestrel'];   // bodies-2's satellite, its ascent flown by hand once
  P.procs = {}; handAscent(api, sst); const sproc = P.procs[api.procKey(sst)];
  api.resetHome(); Object.assign(P, { homeArch: 'openSuper', day: 10, rel: {}, op: {}, sanc: {}, cert: {}, done: { beeper: { flight: 0, day: 0 } }, kh: {}, lines: {}, flights: 3, own: null, decisions: [], active: [], offers: [], fac: {}, studies: {}, studyQ: [], dispatch: [], procs: { [api.procKey(sst)]: sproc }, staged: {} });
  api.chooseStart('agency'); P.funds = 2000; P.day = 10; for (const p of api.newShip(sst).parts) { P.kh[p.d.key] = { use: 0.97, reg: {} }; P.cert[p.d.key] = 1; }
  const c = { id: 931, type: 'sat', src: 'com', client: 0, p: { alt: 160, tol: 20, inc: 0, itol: 3, pay: 50, dur: 300 }, deadline: P.day + 300 }; P.active = [c];
  api.orderDispatch(c, sst); const D = P.dispatch[0], L = D.launch; D.watch = true;
  const ev = api.upcoming().find(e => e.kind === 'dispatch'); let st = null, n = 0; while (P.day < L - 1e-9 && n++ < 20) { P.decisions = []; st = api.advanceTo(L + 5); }
  const stops = ev && ev.stop && st && st.kind === 'dispatch' && Math.abs(P.day - L) < 1e-3 && D.status === 'queued';
  api.advanceDays(0.2); const waits = D.status === 'queued';
  // on screen: the plan, flown as the page flies it (procStart + procStep's relight check), against the headless flight
  const w = api.watchPlan(D, c), fly = (noRelight) => { api.t = 0; const s = api.newShip(sst, w.site); api.S = s; s.noRec = true; s.rec = api.recNew(); Object.assign(s.rec, { launched: true, ended: true, day0: Math.ceil(P.day) });
    api.procStart(s, w.proc, w.target); s.proc.noRelight = noRelight; let k = 0; while (s.alive && s.proc && !s.proc.done && k++ < 3e6) api.advPhys(s); return s; };
  const s1 = fly(w.noRelight), e1 = elements(s1.r, s1.v, TELLUS.mu), o1 = { pe: e1.pe - TELLUS.R, ap: e1.ap - TELLUS.R };
  const s2 = fly(true), relight = s2.alive && s2.procDev && s2.procDev.kind === 'relight';
  n = 0; while (D.status === 'queued' && n++ < 6) api.advanceDays(D.launch + 0.6 - P.day);   // past its wait (a weather scrub slips it a day: it waits again)
  const self = D.status === 'done' && D.orb && !D.watch;
  const same = self && !w.doom && !w.noRelight && Math.abs(D.orb.pe - o1.pe) < 2e3 && Math.abs(D.orb.ap - o1.ap) < 2e3;
  // the rolls: wherever the plan ends a flight in the climb, the headless run gives the same reason (it returns before flying)
  for (const p of api.newShip(sst).parts) { P.kh[p.d.key] = { use: 0.3, reg: {} }; P.cert[p.d.key] = 0.2; }
  let doomed = 0, agree = 0; for (let sd = 1; sd <= 200; sd++) { const X = { ...D, seed: sd * 7919, status: 'queued' }, pl = api.watchPlan(X, c); if (!pl.doom) continue; doomed++;
    const r = api.dispatchRun(X, api.newShip(sst), c); if (r.ok === false && r.why === pl.doom.why && pl.doom.t > 30 && pl.doom.t < 150) agree++; }
  // the page: Watch / Watch now / Let it fly in mission control, followed each frame; a watched liftoff skips prep and pad waits
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const ui = ['data-dwatch', 'data-dwgo', 'data-dwfly'].every(d => page.includes(d)) && /simulate\(dtR\);watchTick\(\);/.test(page) && /S\.proc\.noRelight=w\.noRelight/.test(page)
    && /R\.prep=TEST\.fast\|\|R\.watch(\|\|R\.sim)?\?0/.test(src) && /R\.padWait=R\.watch(\|\|R\.sim)?\?0:padWait\(\)/.test(src);
  check('flow-15: watch mode: a watched dispatch stops the clock at its launch and waits; on screen it flies to the headless orbit; the same rolls end it in the climb; a failed relight stops it at the circularisation',
    stops && waits && relight && same && doomed > 5 && agree === doomed && ui,
    `stops ${stops} · waits ${waits} · on screen ${(o1.pe / 1e3).toFixed(1)}×${(o1.ap / 1e3).toFixed(1)} km, headless ${D.orb ? (D.orb.pe / 1e3).toFixed(1) + '×' + (D.orb.ap / 1e3).toFixed(1) : D.status} · relight ${relight} · rolls ${agree}/${doomed} · ui ${ui}`);
  Object.assign(api.HOOK, hk); for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
}

// flow-16. Paying along the way in flight (flow session, QUEUE Q167; Q49 slice 4; economy v1.44's staged pay): a vessel
// left on its way to Selene pays its mission's two shares when it enters Selene's sphere between flights, as it would
// have in the flight; only for missions open when its flight launched (W11). Mission control's Flight row and the
// timeline's arrival say what it will pay.
{
  const D = new Function(src + 'return {newShip,PRESETS,satRegister,advanceTo,upcoming,predictFrom,cruiseNext,cruisePayNote,MISSIONS,missionOpen,TELLUS,SELENE,PROG,HOOK,DAY_S,set ORB_T0(v){ORB_T0=v}};')();
  const news = []; D.HOOK.news = m => news.push(m); D.HOOK.msg = () => {}; D.HOOK.save = () => {};
  const P = D.PROG, T = D.TELLUS, Sl = D.SELENE, R = T.R; D.ORB_T0 = 0;
  const r0 = R + 300e3, vT = Math.sqrt(T.mu * (2 / r0 - 2 / (r0 + Sl.a))) * 1.002; let tr = null;
  for (let k = 0; k < 360 && !tr; k++) { const a = k * Math.PI / 180, r = [r0 * Math.cos(a), 0, r0 * Math.sin(a)], v = [vT * Math.sin(a), 0, -vT * Math.cos(a)], L = D.predictFrom({ b: T, r, v, t: 0 });
    if (L[0].endKind === 'enc' && L[1] && L[1].b === Sl) tr = { r, v, L }; }
  const run = open0 => { Object.assign(P, { sats: [], day: 0, decisions: [], active: [], dispatch: [], offers: [], staged: {}, funds: 500, done: { weather: { flight: 1, day: 0 }, beeper: { flight: 1, day: 0 } } }); news.length = 0;
    const M = D.MISSIONS.find(x => x.to === 'Selene' && D.missionOpen(x) && !x.crew), s = D.newShip(D.PRESETS.Probe); Object.assign(s, { alive: true, landed: false, body: T, r: tr.r, v: tr.v });
    D.satRegister(s, { day0: 0, open0: open0(M) }); const q = P.sats.at(-1), cr = D.cruiseNext(q, 0), note = cr.to ? D.cruisePayNote(q, cr.to) : '', ev = D.upcoming().find(x => x.kind === 'cruise'), f0 = P.funds;
    D.advanceTo(tr.L[0].endT / D.DAY_S + 1); return { M, q, cr, note, ev, paid: P.funds - f0, st: P.staged[M.id] || {} }; };
  const a = run(M => [M.id]), b = run(() => []);
  const want = a.M.pay * 0.4, ui = html.includes("cruisePayNote(q,cr.to)");
  check('flow-16: a vessel left on its way to Selene pays its mission\'s two shares on arrival between flights; one whose flight wasn\'t launched for it pays nothing; mission control and the timeline say so',
    a.cr.to === Sl && /pays/.test(a.note) && a.ev && /pays/.test(a.ev.text) && a.q.bodyName === 'Selene' && Math.abs(a.paid - want) < 1e-6 && a.st.bound && a.st.arrive
      && b.paid === 0 && !b.st.arrive && !b.note && ui,
    `${a.M.name}: "${a.note}" · timeline "${a.ev && a.ev.text}" · paid ${a.paid.toFixed(1)}M of ${want.toFixed(1)}M · not launched for it: ${b.paid.toFixed(1)}M · ui ${ui}`);
}

// flow-17. The network's nodes (flow session, QUEUE Q170, N2; NOTES § UI "Network screen plan"): mission control's wall has
// a third page (W cycles track → pads → net) drawing netModel()'s nodes as a schematic: bodies as columns, Tellus first, the
// orbit bands above the surface; a crewed node's supplies and days; the bottleneck on top and its node marked. The screen
// reads netModel() only: netFallback is gone.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const wired = !/netFallback\(/.test(page) && /const netData=\(\)=>netModel\(\);/.test(page) && H.includes('id="mcNet"')
    && /MC_PAGES=\['track','pads','net'\]/.test(page) && /\$\('mcNet'\)\.innerHTML=netNodesHTML\(N\)/.test(page);
  const fn = new Function(page.slice(page.indexOf('const NET_SLOTS'), page.indexOf('// the pads\' calendar:')) + 'return netNodesHTML;')();
  const X = new Function(src + 'return {netModel,newShip,PRESETS,satRegister,TELLUS,PROG,HOOK};')();
  const P = X.PROG, T = X.TELLUS; X.HOOK.news = () => {}; X.HOOK.msg = () => {}; X.HOOK.save = () => {}; P.sats = []; P.day = 0; P.dispatch = [];
  const s = X.newShip(X.PRESETS.Probe), a = T.R + 300e3;
  Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -Math.sqrt(T.mu / a)] }); X.satRegister(s, { day0: 0 });
  const N = X.netModel(), q = P.sats.at(-1), probe = N.nodes.find(n => n.id === `reg:${q.id}`);
  const h0 = fn(N), band = (h, l, m) => h.slice(h.indexOf(`<div class="nl">${l}</div>`), m ? h.indexOf(`<div class="nl">${m}</div>`) : undefined);
  const placed = probe && probe.slot === 'low' && band(h0, 'Low orbit', 'Surface').includes(`<b>${q.name}</b>`)
    && N.nodes.filter(n => n.slot === 'surface').every(n => band(h0, 'Surface').includes(`<b>${n.name}</b>`)) && /No bottleneck/.test(h0);
  const base = { id: 'reg:999', kind: 'base', body: 'Selene', slot: 'surface', name: 'Selene Base 1', stock: { supplies: 400 }, need: { supplies: 40 }, days: 10, paused: false };
  const M = { ...N, nodes: [...N.nodes, base], bottleneck: { text: 'Selene Base 1 has 10 days of supplies left', node: 'reg:999', good: 'supplies' } }, h1 = fn(M);
  const cols = h1.indexOf('<div class="nb">Tellus</div>') > 0 && h1.indexOf('<div class="nb">Tellus</div>') < h1.indexOf('<div class="nb">Selene</div>');
  const bn = /class="nbn bad">Bottleneck: Selene Base 1 has 10 days/.test(h1) && /class="nn bn" data-node="reg:999"/.test(h1) && /supplies 400 kg · eats 40 kg\/d/.test(h1) && /10 days left/.test(h1);
  check('flow-17: mission control\'s third wall page draws netModel()\'s nodes (bodies as columns, orbit bands over the surface), a crewed node\'s supplies and the bottleneck; netFallback is gone',
    wired && placed && cols && bn, `wired ${wired} · placed ${placed} (${N.nodes.length} nodes, probe ${probe && probe.slot}) · columns ${cols} · bottleneck ${bn}`);
}

// flow-18. The title screen and the charter (flow session, QUEUE Q241 R3; NOTES § UI "Plan: real screens"): the page opens
// on a room of its own; a new career fills in the charter (Article 1 whose program, Article 2 how it starts) and signs it
// (Found the program); the desk never shows before that; a career under way shows its charter signed, nothing to click.
// The first-run gate left the Program's folder.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const wired = /ROOMS=new Set\(\['title',/.test(page) && /renderEditor\(\);go\('title'\);/.test(page) && /if\(s==='program'&&needCharter\(\)\)s='title';/.test(page)
    && H.includes('id="ttl"') && /title:\[\{k:\['enter'\]/.test(page) && !/data-start=/.test(page.slice(page.indexOf('function ownershipHTML'), page.indexOf('function contractsHTML')));
  const T = page.slice(page.indexOf('let ttlPick=null'), page.indexOf('function renderTitle'));
  const X = new Function(src + T + 'return {charterHTML,needCharter,chooseStart,START,ARCH,PROG,HOOK,set pick(k){ttlPick=k}};')();
  X.HOOK.save = () => {}; const kinds = Object.keys(X.START), btn = (h, k) => new RegExp(`id="bFound" data-start="${k}"`).test(h);
  const before = X.needCharter(), h0 = X.charterHTML(false);
  const open = before && ['', ...Object.keys(X.ARCH)].every(k => h0.includes(`data-arch="${k}"`)) && kinds.every(k => h0.includes(`data-cstart="${k}"`)) && btn(h0, kinds[0]);
  X.pick = 'company'; const h1 = X.charterHTML(false), picked = btn(h1, 'company') && /class="sig">[^<]*Aerospace</.test(h1);
  X.chooseStart('company'); const h2 = X.charterHTML(true);
  const signed = !X.needCharter() && !h2.includes('<button') && /In force/.test(h2) && /class="opt on"><span class="bx"><\/span><span><b>[^<]*· /.test(h2);
  check('flow-18: the page opens on the title screen; the charter asks whose program and how it starts, then signs it; no desk before; a founded career shows it signed',
    wired && open && picked && signed, `wired ${wired} · open ${open} · picked ${picked} · signed ${signed}`);
}

// flow-19. Map layers (flow session, QUEUE Q261, PLAYTEST #61): each of drawMap's passes belongs to a layer that mapShow
// gates; a layer never touched follows the era (cities before the first orbit, then satellites, debris and the planets);
// one the player set stays set. The target is drawn whatever its layer.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END')), dm = page.slice(page.indexOf('function drawMap('), page.indexOf('// ---- navball'));
  const wired = ['moons', 'links', 'planets', 'cities', 'targets', 'stations', 'names'].every(k => dm.includes(`mapShow('${k}')`)) && dm.includes(`mapShow(q.junk?'debris':'sats')`)
    && /if\(q\.id!==S\.target&&!mapShow\(q\.junk\?'debris':'sats'\)\)continue/.test(dm) && H.includes('id="bLay"') && H.includes('id="mapLay"');
  const L = page.slice(page.indexOf('const MAP_LAYERS'), page.indexOf('function renderMapLay'));
  const X = new Function(src + L + 'return {mapShow,MAP_LAYERS,PROG,set:o=>{mapLaySet=o}};')();
  X.PROG.done = {}; const e1 = X.MAP_LAYERS.map(([k]) => X.mapShow(k));
  const early = X.mapShow('cities') && !X.mapShow('planets') && X.mapShow('sats') && X.mapShow('moons');
  X.PROG.done.beeper = true; const later = !X.mapShow('cities') && X.mapShow('planets') && X.mapShow('debris');
  X.set({ cities: true, sats: false }); const mine = X.mapShow('cities') && !X.mapShow('sats') && X.mapShow('planets');
  check('flow-19: map layers: every drawMap pass is gated; the era picks the defaults (cities before the first orbit, then satellites, debris and planets); a layer you set stays set; the target always shows',
    wired && early && later && mine, `wired ${wired} · early ${early} (${e1.map(Number).join('')}) · after the beeper ${later} · set by you ${mine}`);
}

// flow-20. What the map is centred on (flow session, QUEUE Q262, PLAYTEST #62): the Focus list names the ship, the known
// bodies, our satellites and landers and this flight's other vessels; centring on a satellite puts the camera's centre on
// it; Tab cycles the list; a craft that's gone hands the focus back to the ship. Home (not Backspace: it aborts) returns.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const wired = /const foc=mapFocusPos\(\);/.test(page) && /k==='tab'&&view==='map'\)mapFocusCycle\(1\)/.test(page) && /k==='home'&&view==='map'\)setMapFocus\('ship'\)/.test(page)
    && /\{k:\['home'\],l:'Home'/.test(page) && H.includes('id="mapFocus"') && /cv\.addEventListener\('dblclick'/.test(page);
  const F = page.slice(page.indexOf('let mapFoc=null;'), page.indexOf('function renderMapFocus'));
  let X, err = '';
  try {
    X = new Function(src + 'var cam={focus:0,mDist:1};const knownBody=b=>true,renderMapFocus=()=>{},shipWorld=()=>add(bodyPos(S.body,simT),S.r),tNow=()=>(PROG.day||0)*DAY_S+simT;' + F
      + 'return {mapFocusList,mapFocusKey,mapFocusPos,setMapFocus,mapFocusCycle,newShip,PRESETS,satRegister,TELLUS,BODIES,PROG,HOOK,cam,setS:s=>{S=s},bodyPos,satAt,tNow,add,len,sub};')();
  } catch (e) { err = e.message; }
  let ok = false, info = err;
  if (X) {
    X.HOOK.news = () => {}; X.HOOK.msg = () => {}; X.HOOK.save = () => {}; const P = X.PROG, T = X.TELLUS; P.sats = []; P.day = 0;
    const s = X.newShip(X.PRESETS.Probe), a = T.R + 400e3; Object.assign(s, { alive: true, landed: false, body: T, r: [a, 0, 0], v: [0, 0, -Math.sqrt(T.mu / a)], name: 'Probe' });
    X.satRegister(s, { day0: 0 }); const q = P.sats.at(-1);
    const me = X.newShip(X.PRESETS.Probe); Object.assign(me, { alive: true, landed: false, body: T, r: [0, 0, a], v: [Math.sqrt(T.mu / a), 0, 0] }); X.setS(me);
    const L = X.mapFocusList(), keys = L.map(f => f.key);
    const listed = keys[0] === 'ship' && X.BODIES.every((b, i) => keys.includes(`b:${i}`)) && keys.includes(`s:${q.id}`);
    X.setMapFocus(`s:${q.id}`); const qp = X.add(X.bodyPos(T, X.tNow()), X.satAt(q, X.tNow())[0]), on = X.len(X.sub(X.mapFocusPos(), qp)) < 1 && X.mapFocusKey() === `s:${q.id}`;
    X.setMapFocus('ship'); X.mapFocusCycle(1); const cyc = X.mapFocusKey() === keys[1] && X.cam.focus === 1;
    X.setMapFocus(`s:${q.id}`); q.junk = true; X.mapFocusPos(); const back = X.mapFocusKey() === 'ship';
    ok = listed && on && cyc && back; info = `listed ${listed} (${keys.join(' ')}) · centred on it ${on} · Tab ${cyc} · gone → ship ${back}`;
  }
  check('flow-20: the map centres on the ship, a body or one of our craft (the Focus list, Tab, double-click, Home); a craft that\'s gone hands it back to the ship',
    wired && ok, `wired ${wired} · ${info}`);
}

// flow-21. Hover terms (flow session, QUEUE Q287; UI.md rule 9): jargon is a word you hover, explained once in TERMS and
// shown by one tooltip every screen shares; every term is used somewhere on screen; one level deep (no markup inside an
// explanation); the HUD's Ap · Pe and Δv, the builder's stage rows, stability and max-q, the rollout's TWR and the
// know-how headings are marked; the builder's "(CoM ahead of CoP, calibers)" sub-line went into its term.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const X = new Function(page.slice(page.indexOf('const TERMS='), page.indexOf('// the tooltip:')) + 'return {TERMS,term};')();
  const keys = Object.keys(X.TERMS), rest = page.replace(page.slice(page.indexOf('const TERMS='), page.indexOf('// the tooltip:')), ''), sas = rest.slice(rest.indexOf('const SASM_TERM='), rest.indexOf('const SASM=')), used = keys.filter(k => rest.includes("term('" + k + "'") || sas.includes(":'" + k + "'"));   // (Q384) the SAS modes carry theirs as data-term
  const flat = keys.every(k => !/[<>]/.test(X.TERMS[k].d) && X.TERMS[k].d.length > 40);
  const mark = /^<span class="term" data-term="dv">Δv<\/span>$/.test(X.term('dv', 'Δv')) && X.term('nope', 'x') === 'x';
  const sites = [/\[`\$\{term\('ap','Ap'\)\} · \$\{term\('pe','Pe'\)\}`/, /\[term\('dv','Δv'\),/, /\$\{term\('stab','Stability'\)\}/, /\$\{term\('maxq','Max-q'\)\}/, /can't lift off: \$\{term\('twr','TWR'\)\}/, /sec\(term\('kh','Know-how'\)/]
    .every(r => r.test(page)) && !/CoM ahead of CoP, calibers/.test(page) && H.includes('id="termTip"');
  check('flow-21: hover terms: one glossary, one tooltip; every term used on screen, none nested; the HUD, builder, rollout and know-how marked; the stability sub-line folded into its term',
    used.length === keys.length && flat && mark && sites, `used ${used.length}/${keys.length} (${keys.filter(k => !used.includes(k)).join(',') || 'all'}) · flat ${flat} · markup ${mark} · sites ${sites}`);
}

// flow-22. The tooltip grows past terms (flow session, QUEUE Q340; PROBES.md § 8, D21, D22's Checks rows). Warnings that
// explain themselves: every amber or red mark in the Assembly's readout goes through whyMark, which carries what's wrong,
// why it matters and the fixes into the one tooltip (#termTip); a mark that's fine stays plain. A fairing with something
// poking out says so. Part cards: every part says what it pairs with, on the palette card and on the craft's hover.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const X = new Function(page.slice(page.indexOf('const TERMS='), page.indexOf('// the tooltip:')) + 'return {whyMark,fixText,TERMS};')();
  const W = { t: 'Too "hot" <b>', d: 'Why it is', fix: ['One fix.', 'RCS thrusters'] }, m = X.whyMark('bad', '9%', W), plain = X.whyMark('ok', '9%', W);
  const mk = plain === '<b class="ok">9%</b>' && X.whyMark('warn', 'x', null) === '<b class="warn">x</b>' && m.startsWith('<b class="bad term" data-wt="Too &quot;hot&quot; &lt;b&gt;"')
    && m.includes('data-wf="one fix; or RCS thrusters."') && X.fixText('Fix it.') === 'fix it.' && !!X.TERMS.trim;
  const ed = page.slice(page.indexOf('function trimHTML'), page.indexOf('function renderSites')), n = ed.split('whyMark(').length - 1;
  const old = ['<b class="${cl}">', '<b class="${c(ok', 'class="${tw}"', '<b class="${cc(', '<b class="${lc(', '<div class="warn">No reaction', 'Cost <b class="${ok?'].filter(x => ed.includes(x));
  const F = new Function('whyMark', page.slice(page.indexOf('function fitHTML'), page.indexOf('function standHTML')) + 'return fitHTML;')(X.whyMark);
  const f = { on: true, d: { kind: 'fair', r: 0.6, name: 'Payload fairing' }, profF: [[0.6, 0], [0.6, 0.3], [0.6, 2.3]], y0: 10, h: 0.3, pos: [0, 10, 0] };
  const inside = { on: true, d: { kind: 'sci', r: 0.3, name: 'Instruments' }, y0: 10.4, h: 0.5, pos: [0, 10.4, 0], inFair: f }, out = { ...inside, inFair: null, d: { kind: 'ant', r: 0.1, name: 'Boom antenna' }, dep: true };
  const fit0 = F({ parts: [f, inside] }), fit1 = F({ parts: [f, inside, out] });
  const fit = fit0 === '' && fit1.includes('1 part outside the shell') && fit1.includes('Boom antenna pokes out of the fairing') && fit1.includes('fold it for launch');
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const B = new Function(bsrc.slice(bsrc.indexOf('const PART_INFO='), bsrc.indexOf('function partSpecs')) + 'return {partPairs,partInfo};')();
  const parts = Object.values(api.PARTS), noPair = parts.filter(d => !B.partPairs(d)).map(d => d.key), bare = parts.filter(d => B.partPairs(d).includes('<')).map(d => d.key);
  const shown = bsrc.includes('Pairs with</span> ${partPairs(d)}') && bsrc.includes('Pairs with</span> ${partPairs(pdef(n.k))}')   /* pdef: a payload block (vehicle, Q416) has no PARTS entry */;
  check('flow-22: warnings explain themselves (what, why, the fixes, one tooltip; fine marks stay plain); a fairing with a part poking out says so; every part says what it pairs with, on its card and on the craft',
    mk && n >= 14 && !old.length && fit && !noPair.length && !bare.length && shown,
    `whyMark ${mk} · ${n} marks, old ${old.join(' ') || 'none'} · fit ${fit} · pairs missing ${noPair.join(',') || 'none'} · markup ${bare.join(',') || 'none'} · shown ${shown}`);
}

// flow-23. Losses explained (flow session, QUEUE Q293; REVIEW-2026-10-11 § 3 gap 1): a flight keeps the failures on its
// way (debFail: a joint that broke, a part that burned up, an engine that didn't light) with the time and the height; a
// loss's Debrief shows that chain, the end, and what would help; a flight that got home lists them as incidents. The
// money between liftoff and the settling is named line by line (budget day, running the program, debt repaid, ...) from
// a ledger (PROG.led), not lumped as "days passing", and still adds up to what the program gained or lost.
{
  const P = api.PROG; api.HOOK.news = () => {}; const P0 = JSON.stringify(P);   // (put back at the end: a started program turns know-how on for later sections)
  Object.assign(P, { done: {}, cert: {}, atm: {}, streak: 0, flights: 3, funds: 200, bailouts: 0, offers: [], active: [], back: [], cdone: 0, stand: {}, recs: {}, cycle: 0, own: null, decisions: [], kh: {}, log: {}, day: 95 });
  // a loss: a joint breaks at 9 s, then the nose hits the ground
  api.t = 0; let s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); let n = 0;
  while (s.alive && api.t < 9 && n++ < 200000) api.advPhys(s);
  api.debFail(s, 'structure', 'structural failure: Sparrow / Tank 1 broke in bending, at 131% of its strength');
  s.alive = false; s.lossWhy = 'destroyed: the nose hit Tellus at 80 m/s';
  const L = api.flightLeave(s), D = L && L.debrief, ch = D && D.loss;
  const lost = !!ch && ch.chain.length === 1 && ch.chain[0].k === 'structure' && ch.chain[0].met > 8 && ch.chain[0].h > 100 && ch.end.why.includes('the nose hit') && ch.help.includes('joint') && D.outcome.k === 'lost';
  // a flight that lands, with an engine that failed to light on the way; 120 days pass before it settles, over a budget day, with a debt (running the program costs
  // nothing today, OVERHEAD = 0: a zero line is left out)
  api.own().debt = 4; api.t = 0; s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); let armed = false; n = 0;
  api.debFail(s, 'ignite', 'the Sparrow failed to light (know-how 10%)');
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) { if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; } api.advPhys(s); }
  s.rec.fails = s.rec.fails || []; if (!s.rec.fails.length) s.rec.fails.push({ k: 'ignite', why: 'the Sparrow failed to light (know-how 10%)', met: 0, h: 0 });
  api.income(10); api.advanceDays(120);
  const L2 = api.flightLeave(s), E = L2 && L2.debrief, M = E ? E.money : [], row = l => M.find(m => m.l.startsWith(l)), sum = M.reduce((a, m) => a + m.v, 0);
  const named = E && !M.some(m => /days passing/.test(m.l)) && row('Budget day') && row('Budget day').v > 0 && !row('Running the program') && row('Debt repaid') && row('Debt repaid').v < 0
    && Math.abs(sum - E.net) < 1e-6 && !row('Other');
  const inc = E && !E.loss && E.incidents.some(t => t.startsWith('The Sparrow failed to light'));
  const helps = ['structure', 'heat', 'ignite'].every(k => api.debHelp(k, '').length > 20) && api.debHelp(null, 'toppled over on Selene').includes('legs') && api.debHelp(null, 'sank: it filled').includes('land');
  check('flow-23: losses explained: the failures on the way, the end and what helps; a landed flight lists them as incidents; the money between liftoff and settling named line by line, adding up',
    lost && named && inc && helps, `chain ${ch ? ch.chain.map(f => `${f.k} T+${f.met.toFixed(0)}s ${(f.h / 1000).toFixed(1)} km`).join(', ') + ' → ' + ch.end.why + ' · help: ' + ch.help.slice(0, 40) : 'none'} · money ${M.map(m => `${m.l} ${m.v.toFixed(1)}`).join(' · ')} = ${E && E.net.toFixed(1)} · incident ${inc} · helps ${helps}`);
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(P0));
}

// flow-24. The dark cockpit (flow session, QUEUE Q286 slice 1; UI.md § 3 Flight row, D16): the phase (the climb, a burn, a
// landing, or quiet) holds the news and folds every card that isn't the phase's unless pinned; one MASTER CAUTION names
// what's red (heat over 90 %, a joint over its rating, the impact point over a town); hold modes the vessel can't fly
// aren't shown (SAS's title says when they come); Ap · Pe isn't shown landed and reads "under the surface" below it.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('function cpPhase'), page.indexOf('function cockpit'));
  const mk = (S, low) => new Function('mode', 'S', 'ascentOn', 'certOf', 'dot', 'turnFlat', src + 'return {cpPhase, cautions, CP_CARDS};')('flight', S, () => low, () => 1, (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], () => null);   // (Q483's flat warning: flow-41)
  const ship = o => ({ alive: true, landed: false, rec: { launched: true }, thrust: 0, v: [0, 0, 1], r: [0, 0, 7e6], ...o });
  const ph = [mk(ship({ rec: { launched: false } }), true), mk(ship({ thrust: 1e5 }), true), mk(ship({ thrust: 1e5 }), false), mk(ship({}), false), mk(ship({ v: [0, 0, -50] }), true), mk(ship({ landed: true }), true)].map(x => x.cpPhase());
  const phases = JSON.stringify(ph) === JSON.stringify([null, 'ascent', 'burn', null, 'landing', null]);
  const hot = mk(ship({ hot: { T: 950, d: { Tmax: 1000, name: 'Nose cone' } } }), false).cautions(), cool = mk(ship({ hot: { T: 500, d: { Tmax: 1000, name: 'Nose cone' } } }), false).cautions();
  const load = mk(ship({ maxLoadP: { on: true, sk1: 'a', sk2: 'b', d: { name: 'Kestrel' }, parent: { d: { name: 'Tank 8' } } }, maxLoad: 1.2 }), false).cautions();
  const range = mk(ship({ rangeWarn: { city: { name: 'Kaos Beach' } } }), false).cautions();
  const caut = hot.length === 1 && hot[0].includes('95%') && !cool.length && load[0].includes('Kestrel / Tank 8 at 120%') && range[0].includes('Kaos Beach');
  const wired = page.includes("cpPhase()&&!CP_CARDS.includes(c.id)") && page.includes("if(typeof cockpit==='function')cockpit();") && H.includes('#news.held{display:none}')
    && page.indexOf('function cpPhase') > page.indexOf('const HUD_CARDS');   // (loaded after hud.js: the page source inlines the scripts in order)
  const sas = page.slice(page.indexOf('function renderSAS'), page.indexOf('function renderStages')), modes = !sas.includes('b.disabled=true') && sas.includes('continue}') && sas.includes('Not yet: ');
  const hud = page.slice(page.indexOf('function updateHUD'), page.indexOf('let rangeWarned')), apPe = hud.includes("...(S.landed?[]:[[`${term('ap','Ap')}") && hud.includes('under the surface');
  check('flow-24: the dark cockpit: the phase (climb, burn, landing, quiet) holds the news and the off-phase cards; a master caution names what is red; unflyable hold modes hidden; Ap · Pe not landed, no underground number',
    phases && caut && wired && modes && apPe, `phases ${JSON.stringify(ph)} · cautions ${[...hot, ...load, ...range].join(' | ')} · wired ${wired} · modes ${modes} · Ap/Pe ${apPe}`);
}

// flow-25. The declutter, the Program and the map (flow session, QUEUE Q286 slice 2; UI.md § 3 Program and Map rows):
// an offer is one line (name, pay, days left, Take and Pass, ⚠ for a sanction risk) and opens to its full text; an epoch
// beyond the next, all locked, is one line with a count; no empty photo frame on the wall; the name is a letterhead; a
// planet's map label gives the trip in days (half a transfer orbit), not its distance in TU.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const ct = page.slice(page.indexOf('function contractsHTML'), page.indexOf('function contractsHTML') + 4000);
  const offers = ct.includes('<details class="ms of"><summary><b>${cTitle(c)}</b>') && ct.includes('Why: ${c.why}') && ct.includes('data-acc="${c.id}"') && ct.includes('data-dec="${c.id}"');
  const rp = page.slice(page.indexOf('function renderProgram'), page.indexOf('function renderProgram') + 2500), epochs = rp.includes('ep>epNow+1&&Ms.every(') && rp.includes('mission${Ms.length>1?');
  const wall = page.slice(page.indexOf('function deskWall'), page.indexOf('function deskWall') + 400), frame = wall.includes('if(ph)h+=deskPhotoCard(ph)') && !wall.includes('no flights yet');
  const lh = H.includes("#deskLH .org .n{font:22px/1");
  const line = page.slice(page.indexOf('const xferDays='), page.indexOf('\n', page.indexOf('const xferDays=')));
  const xd = new Function('SYSTEM_BODIES', 'YEAR_D', line + 'return xferDays;')(api.SYSTEM_BODIES || [{ name: 'Enyo', a: 1.52 }, { name: 'Hyperion', a: 5.2 }], 365.25);
  const days = xd('Enyo') === '~260 days there' && xd('Hyperion') === '~1000 days there' && !page.includes('.toFixed(2)} TU`');
  check('flow-25: the Program and the map decluttered: offers one line each (the rest on a click), far epochs a count, no empty photo frame, a letterhead; planets labelled with the trip in days',
    offers && epochs && frame && lh && days, `offers ${offers} · epochs ${epochs} · frame ${frame} · letterhead ${lh} · days ${xd('Enyo')}, ${xd('Hyperion')}, no TU ${!page.includes('.toFixed(2)} TU`')}`);
}

// flow-26. One tooltip (flow session, QUEUE Q391; UI.md rule 9): the builder's part card (beside the parts list) and the
// hover over a part on the craft (at the pointer) show in #termTip, like the terms and the self-explaining warnings; each
// use names itself, so moving off one never closes another's; it stays inside the window. The Rollout's warnings and
// stops explain themselves (whyMark), and so does the part panel's joint chip.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('function tipShow'), page.indexOf("document.addEventListener('mouseover'", page.indexOf('function tipShow')));
  const el = { dataset: {}, style: {}, innerHTML: '', offsetWidth: 270, offsetHeight: 300, cls: new Set(['hidden']) };
  el.classList = { toggle: (c, on) => on ? el.cls.add(c) : el.cls.delete(c), remove: c => el.cls.delete(c), add: c => el.cls.add(c), contains: c => el.cls.has(c) };
  const T = new Function('$', 'innerWidth', 'innerHeight', src + 'return {tipShow, tipHide};')(() => el, 1280, 800);
  T.tipShow('card', '<b>Card</b>', { r: { left: 10, right: 200, top: 700, bottom: 720 }, side: true });
  const side = el.style.left === '210px' && el.style.top === '494px' && el.dataset.own === 'card' && el.cls.has('card') && !el.cls.has('hidden');
  T.tipHide('term'); const kept = !el.cls.has('hidden'); T.tipHide('card'); const gone = el.cls.has('hidden');
  T.tipShow('craft', 'x', { x: 1200, y: 100 }); const ptr = el.style.left === '916px' && el.style.top === '114px';
  T.tipShow('term', 't', { r: { left: 1250, right: 1270, top: 780, bottom: 795 } }); const term = el.style.left === '1004px' && el.style.top === '474px' && !el.cls.has('card');
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
  const one = !bsrc.includes("'partcard'") && !bsrc.includes("'bldtip'") && bsrc.includes("tipShow('card',partCardHTML(k)") && bsrc.includes("tipShow('craft',html,") && bsrc.includes("wt:`The joint ${w.p.d.name}");
  const ro = page.slice(page.indexOf('function rollChecks'), page.indexOf('function renderRollout')), nW = ro.split(',{t:').length - 1 + ro.split('{...tw,t:').length - 1;
  const roll = nW >= 10 && page.includes("whyMark(k,fold(x),W,'span')");
  check('flow-26: one tooltip: part cards and the craft hover in #termTip, each use keeps its own, inside the window; the Rollout\'s checks and the joint chip explain themselves',
    side && kept && gone && ptr && term && one && roll, `beside ${side} (${el.style.left},${el.style.top}) · owners ${kept}/${gone} · pointer ${ptr} · term ${term} · builder ${one} · rollout ${nW} explained, ${roll}`);
}

// flow-27. How folded parts deploy (flow session, QUEUE Q400's remainder, PLAYTEST #97; the buttons are vehicle's v1.184
// and v1.188): the part panel and the part card say how each deploys (the key and the flight-bar button); the first time
// a craft with folded parts is out of the thick air and nothing critical is happening, one hint says so (once per browser).
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('const DEP_HINT_KEY'), page.indexOf('function depHint()'));
  const store = { k: null }, LS = { getItem: () => store.k, setItem: (k, v) => { store.k = v } };
  const mk = (S, ph = null, seen = null) => { store.k = seen; return new Function('mode', 'S', 'cpPhase', 'unfolds', 'len', 'localStorage', src + 'return depHintDue();')('flight', S, () => ph, d => !!(d.wing || d.fold), v => Math.hypot(...v), LS) };
  const body = { R: 6e6, atm: 1e5 }, wing = { on: true, d: { wing: true }, dep: false }, ship = o => ({ alive: true, landed: false, rec: { launched: true }, body, r: [0, 0, 6.3e6], parts: [wing], ...o });
  const space = mk(ship()), air = mk(ship({ r: [0, 0, 6.05e6] })), busy = mk(ship(), 'burn'), out = mk(ship({ parts: [{ ...wing, dep: true }] })), seen = mk(ship(), null, '1'),
    bay = mk(ship({ parts: [{ on: true, d: { kind: 'bay' }, open: false }] }));
  const F = { fj: false }, shut = mk(ship({ parts: [{ ...wing, inFair: F }] })); F.fj = true; const dropped = mk(ship({ parts: [{ ...wing, inFair: F }] }));   // inside a fairing: not yet; once it's dropped: yes
  const hint = space && space.id === 'bWings' && space.t.includes('P unfolds') && !air && !busy && !out && !seen && bay && bay.id === 'bBay' && !shut && dropped && dropped.id === 'bWings';
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
  const told = bsrc.includes('In flight: ${DEP_HOW[w]}.') && bsrc.includes("L.push(['deploys',DEP_HOW[w].split(':')[0]])") && ['leg:', 'wing:', 'bay:'].every(k => bsrc.slice(bsrc.indexOf('const DEP_HOW='), bsrc.indexOf('const DEP_HOW=') + 500).includes(k));
  check('flow-27: folded parts say how they deploy (the part panel and its card); one first-time hint once out of the air, quiet, folded, not seen before',
    hint && told, `space ${space && space.id} · air ${!!air} · busy ${!!busy} · out ${!!out} · seen ${!!seen} · bay ${bay && bay.id} · told ${told}`);
}

// flow-28. The camera looks straight down (flow session, QUEUE Q405, PLAYTEST #101): the pitch reaches ±90° in flight and
// in the Assembly; the view's right-hand vector comes from the yaw, so it is the same as before at any other angle and
// still defined (no flip, no spin) at the pole; T in the Assembly toggles a top view, kept through a reframe.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const i = page.indexOf('const hz='), line = page.slice(i, page.indexOf('\n', i));
  const { cross, norm, add, mul, dot, sub, len } = api;
  const f = { n: [1, 0, 0], e: [0, 0, 1], up: [0, 1, 0] };
  const basis = (yaw, pitch) => { const cam = { yaw, pitch }, cp = Math.cos(pitch), sp = Math.sin(pitch), off = add(add(mul(f.n, -cp * Math.cos(yaw)), mul(f.e, cp * Math.sin(yaw))), mul(f.up, sp));
    const Fw = norm(mul(off, -1)), r = new Function('f', 'cam', 'cross', 'norm', 'add', 'mul', 'dot', 'sub', line + ';return rgt;')(f, cam, cross, norm, add, mul, dot, sub)(Fw);
    return { Fw, R: r, U: cross(r, Fw), old: len(cross(Fw, f.up)) > 1e-9 ? norm(cross(Fw, f.up)) : null } };
  const same = [[0.35, 0.12], [2, -0.8], [-1, 1.2]].every(([y, p]) => { const b = basis(y, p); return len(sub(b.R, b.old)) < 1e-9 });
  const top = basis(0.35, Math.PI / 2), ortho = Math.abs(len(top.R) - 1) < 1e-9 && Math.abs(dot(top.R, top.Fw)) < 1e-9 && Math.abs(len(top.U) - 1) < 1e-9;
  const near = basis(0.35, Math.PI / 2 - 1e-4), cont = len(sub(near.R, top.R)) < 1e-3 && len(sub(near.U, top.U)) < 1e-3;   // no flip at the pole
  const clamp = page.includes('cam.pitch=clamp(cam.pitch+dy*.005,-Math.PI/2,Math.PI/2)');
  const bsrc = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
  const tkey = bsrc.includes("else if(k==='t'){topView()}") && bsrc.includes('<b>T</b> top view') && bsrc.includes('cam.pitch=topPrev?Math.PI/2:-0.05');
  check('flow-28: the camera looks straight down: the same view at other angles, an orthonormal basis with no flip at the pole, the pitch to ±90°, T for a top view in the Assembly',
    same && ortho && cont && clamp && tkey, `same ${same} · orthonormal at the pole ${ortho} · continuous ${cont} · clamp ${clamp} · T ${tkey}`);
}

// flow-29. Heat and load you notice (flow session, QUEUE Q271, PLAYTEST #71; W36's default): HEAT and LOAD beside the
// navball in every phase, the hottest part against its limit and the most loaded joint against its certified rating;
// faint under 50 %, amber from 50 %, red from 90 %; the master caution blinks when its reasons change.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('function hlFracs'), page.indexOf('function hlGauges'));
  const X = S => new Function('mode', 'S', 'certOf', src + 'return {hlFracs, hlCls};')('flight', S, () => 2);
  const S = { alive: true, hot: { T: 700, d: { Tmax: 1000, name: 'Nose cone' } }, maxLoadP: { on: true, sk1: 'a', sk2: 'b', d: { name: 'Kestrel' }, parent: { d: { name: 'Tank 8' } } }, maxLoad: 1.9 };
  const f = X(S).hlFracs(), c = X(S).hlCls, none = X({ alive: true }).hlFracs();
  const fr = Math.abs(f.heat - 0.7) < 1e-9 && Math.abs(f.load - 0.95) < 1e-9 && f.hp === 'Nose cone' && f.lp === 'Kestrel / Tank 8' && none.heat === 0 && none.load === 0;
  const cls = c(0.3) === '' && c(0.5) === 'warn' && c(0.89) === 'warn' && c(0.9) === 'bad';
  const wired = H.includes('<div id="hlg"><div class="g" id="gHeat">') && H.includes('<b>H</b>') && H.includes('id="gLoad"') && page.includes('depHint();turnHint();circHint();hlGauges();') && H.includes('#mcau.new{animation') && page.includes("m.classList.add('new')");
  check('flow-29: heat and load you notice: HEAT and LOAD by the navball in every phase (part vs limit, joint vs rating), faint, amber from 50 %, red from 90 %; the master caution blinks on a new reason',
    fr && cls && wired, `fracs ${fr} (${f.heat.toFixed(2)}, ${f.load.toFixed(2)}) · classes ${cls} · wired ${wired}`);
}

// flow-30. The model's scale in the Assembly strip (flow session, QUEUE Q277): "model 1:48 · 14.5 m" beside the program's
// line, a hover term saying what the scale means; the same kit scale the desk's title block prints.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('function modelScaleHTML'), page.indexOf('function deskFrame'));
  const X = (S, fx = true) => new Function('DESK_FX', 'mode', 'S', 'deskFoot', 'deskScaleFor', 'term', src + 'return modelScaleHTML();')
    (fx, 'editor', S, () => S.yBot, h => [20, 24, 32, 48, 72, 96, 144, 200, 288, 400, 500].find(n => h / n <= 0.45) || 500, (k, t) => `<span data-term="${k}">${t}</span>`);
  const orb = X({ alive: true, len: 14.5, yBot: 0 }), big = X({ alive: true, len: 120, yBot: 0 });
  const txt = orb.includes('model 1:48</span> · 14.5 m') && big.includes('model 1:288') && orb.includes('data-term="scale"');
  const off = X({ alive: true, len: 14.5, yBot: 0 }, false) === '' && X({ alive: false, len: 14.5, yBot: 0 }) === '';
  const wired = H.includes("typeof modelScaleHTML==='function'?modelScaleHTML():''") && H.includes("scale:{t:") && H.includes("term('scale',");
  check('flow-30: the Assembly strip names the model\'s scale (model 1:48 · 14.5 m; 1:288 for a 120 m rocket) with a hover term; nothing without the desk',
    txt && off && wired, `text ${txt} (${orb.replace(/<[^>]+>/g, '')}) · off ${off} · wired ${wired}`);
}

// flow-31. More hover terms and a tap on touch (flow session, QUEUE Q384, from Q287): SOI, prograde, retrograde,
// normal, radial, inclination, the ground's free speed (Isp is a gloss on the part card, which is a tooltip itself); marked on the SAS modes, the readout's escape, the site
// picker; a tap shows a term on touch (again or elsewhere closes it; a button keeps its tap).
{
  const H = html.replace(/\r\n/g, '\n');
  const tsrc = readFileSync(new URL('./app/terms.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const T = new Function(tsrc.slice(tsrc.indexOf('const TERMS='), tsrc.indexOf('const term=')) + 'return TERMS;')();
  const keys = ['soi', 'pro', 'retro', 'nrm', 'rad', 'inc', 'spin'], have = keys.every(k => T[k] && T[k].t && T[k].d.length > 60 && !T[k].d.includes('<'));
  const marked = H.includes("SASM_TERM={pro:'pro',retro:'retro',normal:'nrm',anti:'nrm',radout:'rad',radin:'rad'}") && H.includes('b.dataset.term=SASM_TERM[k]')
    && H.includes("sit=term('soi','escaping')") && H.includes(":term('soi','escape')}") && H.includes("${term('inc','lowest inclination')}") && H.includes("${term('spin','free')}");
  const tap = tsrc.includes("document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;") && tsrc.includes("el===tipTap.el||el.closest('button')") && tsrc.includes('performance.now()-tipTap.t<900') && tsrc.includes('function termTipHTML(el)');
  const gloss = readFileSync(new URL('./builder.js', import.meta.url), 'utf8').includes('(higher: more Δv from a tank)') && !T.isp;   // the part card is the tooltip itself: Isp glossed there, not a term
  check('flow-31: more hover terms (SOI, prograde, retrograde, normal, radial, inclination, free speed; Isp glossed on the part card) on the SAS modes, the readout and the site picker; a tap shows a term on touch',
    have && marked && tap && gloss, `terms ${have} · marked ${marked} · tap ${tap} · Isp gloss ${gloss}`);
}

// flow-32. A routine with nothing up keeps its controls (flow session, QUEUE Q415, PLAYTEST #105; test bench's `m2`):
// a route's controls were only the Fleet line under one of its satellites, so once they all came down there was no
// *Order a run* or *End* left. Now such a route has its own line under "Routines with nothing up"; one with a satellite
// up stays on that satellite's line only.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('function routesBareHTML'), page.indexOf('function gsHTML'));
  const routes = [{ id: 7, name: 'Beepers at 300 km, 0°' }, { id: 8, name: 'Beepers at 900 km, 60°' }];
  const X = L => new Function('PROG', 'routeCtl', src + 'return routesBareHTML;')({ routes }, r => ` · routine ${r.id} <button data-rorder="${r.id}">Order a run</button> <button data-rdrop="${r.id}">End</button>`)(L);
  const bare = X([]), one = X([{ route: 7 }, { route: undefined }]), none = new Function('PROG', 'routeCtl', src + 'return routesBareHTML;')({}, () => '')([]);
  const ok0 = bare.includes('Routines with nothing up') && /data-route-line="7"[^]*data-rorder="7"[^]*data-route-line="8"[^]*data-rdrop="8"/.test(bare);
  const ok1 = !one.includes('data-route-line="7"') && one.includes('data-route-line="8"') && none === '';
  // the satellite's own line still goes through routeCtl (same controls), and the Fleet tab adds the bare routes
  const P = api.PROG, saved = JSON.stringify(P); api.HOOK.save = () => {}; P.dispatch = []; P.routes = [{ id: 7, name: 'x', keep: 1, auto: false, paused: false, runs: 1, clean: 0 }]; P.sats = [];
  const line = api.routeLine({ id: 901, route: 7 });
  for (const k of Object.keys(P)) delete P[k]; Object.assign(P, JSON.parse(saved));
  const ok2 = /routine: 0 of 1 up/.test(line) && line.includes('data-rorder="7"') && line.includes('data-rdrop="7"') && H.includes("${routeLine(q)}</div>`}).join('')+routesBareHTML(L)}") && H.includes('function routeCtl(r){') && H.includes("Rovers in the field|Routines)/.test(h)?'fleet'");   // its heading sorts into the Fleet tab, not More
  check('flow-32: a routine whose satellites have all come down keeps a Fleet line with Order a run and End; with one up, only its satellite\'s line carries them',
    ok0 && ok1 && ok2, `nothing up ${ok0} (${bare.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}) · one up ${ok1} · wired ${ok2}`);
}

// flow-33. Range safety and the site's own town (flow session, QUEUE Q444, PLAYTEST #116): Dunnzar Cape's support town
// Kaos Beach is 15 km off, inside its own 15 km "near" margin of the pad, so a climb's first impact points alarmed on every
// Cape launch. From its own site a town counts only when the impact is over it; any other town keeps its margin.
{
  const T = api.TELLUS, D = Math.PI / 180, pads = api.SITES.filter(t => t.kind === 'pad' && api.CITIES.some(c => c.town === t.id));
  const own = t => api.CITIES.find(c => c.town === t.id), cape = pads.find(t => own(t).km <= 18) || pads[0], k = own(cape);
  const was = api.dropVerdict(T, cape.u).kind;   // the old reading at the pad
  const quiet = pads.filter(t => ['city', 'near'].includes(api.rangeVerdict(t, T, t.u).kind)).map(t => t.name);
  const over = api.rangeVerdict(cape, T, k.u).kind;   // right over the town: still a city
  const other = pads.find(t => t !== cape), nearOther = api.alongAz(own(other).u, 0, (own(other).rad + 5e3) / T.R);
  const elsewhere = api.rangeVerdict(cape, T, nearOther).kind;   // another site's town keeps its margin
  const wired = html.includes('.map(x=>rangeVerdict(S.site,TELLUS,x.pf))');
  check('flow-33: range safety: no pad reads as near its own support town (Kaos Beach was, 15 km from Dunnzar Cape); an impact over the town still alarms; other towns keep their 15 km margin',
    !quiet.length && over === 'city' && elsewhere === 'near' && wired,
    `${cape.name} → ${k.name} ${k.km} km: was "${was}" at the pad · pads near their own town now: ${quiet.join(', ') || 'none'} · over it: ${over} · near ${own(other).name}: ${elsewhere} · wired ${wired}`);
}

// flow-34. Teach the gravity turn (flow session, QUEUE Q434, PLAYTEST #109: "the rocket mostly goes straight up"). The
// standard ascent (vertical to 286 m, flat by 54 km on Tellus) is one function now, ascentPitch, and the navball draws it:
// turnGuide is where the nose should be while the climb is in the air, until the apoapsis is out of it. Flown on that profile
// the marker sits on the nose; flown straight up it stays east of it; a first-flight hint says how to turn.
{
  const T = api.TELLUS, AS = T.atm / 7e4, D = 180 / Math.PI;
  const same = [0, 100, 286, 1000, 5000, 20000, 40000, 54000, 80000].every(h => Math.abs(api.ascentPitch(T, h) - 90 * (1 - Math.pow(Math.min(1, Math.max(0, (h - 200 * AS) / (38000 * AS - 200 * AS))), 0.6))) < 1e-9);
  const ends = api.ascentPitch(T, 0) === 90 && api.ascentPitch(T, 38000 * AS) === 0;
  const point = (s, p) => { const f = api.localFrame(s.r), r = p / D, Y = norm(add(mul(f.e, Math.cos(r)), mul(f.up, Math.sin(r)))), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  const run = (prof) => { api.t = 0; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.sas = false; s.throttle = 1; api.stage(s);
    let off = 0, first = null, gone = null, n = 0, pre = null;
    while (s.alive && n++ < 60000) { const h = len(s.r) - T.R; point(s, prof(h)); let g = api.turnGuide(s);
      if (g && g.ph !== 'climb') g = null;   // flow-37 tests the coast and the burn
      if (g && h > 300) { first = first || { h, p: g.p }; if (s.mach < 2.5) off = Math.max(off, Math.acos(Math.min(1, dot(g.u, api.qrot(s.q, [0, 1, 0])))) * D); pre = g; }   // past Mach 2.5 the ◇ leans toward prograde (Q482, flow-39)
      if (!g && first && dot(s.v, s.r) > 0 && !gone) { gone = { h, ap: elements(s.r, s.v, T.mu).ap - T.R }; break; }
      if (!s.landed && dot(s.v, s.r) < 0) break;
      if (s.evIdx < s.events.length && api.activeEngines(s).length === 0) api.stage(s);
      api.advPhys(s); }
    return { off, first, gone, last: pre }; };
  const prof = run(h => api.ascentPitch(T, h)), up = run(() => 90);
  const onNose = prof.off < 2 && prof.gone && prof.gone.ap > T.atm && prof.gone.h > 38000 * AS;   // level past 54 km until the apoapsis is out
  const east = up.last && up.last.nose > 89 && up.last.p < 85 &&   // (Q482: at speed the ◇ leans only q·α allows off a vertical climb; was < 60)
    (f => { const hz = sub(up.last.u, mul(f.up, dot(up.last.u, f.up))); return dot(norm(hz), f.e) > 0.9; })(api.localFrame(api.S.r));   // its heading is east
  const wired = html.includes('turnGuide(S):null') && html.includes('function turnHint(){') && html.includes('depHint();turnHint();') && html.includes("localStorage.getItem(TURN_HINT_KEY)");
  check('flow-34: the gravity turn: one standard profile (ascentPitch), its marker on the navball sits on the nose when flown and east of it when flown straight up, gone once the apoapsis is out of the air; a first-flight hint',
    same && ends && onNose && east && wired,
    `profile ${same && ends} · flown: marker ≤ ${prof.off.toFixed(2)}° off the nose, gone at ${prof.gone ? `${(prof.gone.h / 1e3).toFixed(1)} km (Ap ${(prof.gone.ap / 1e3).toFixed(0)} km)` : 'never'} · straight up: last marker ${up.last ? `${up.last.p.toFixed(0)}° vs nose ${up.last.nose.toFixed(0)}°` : 'none'} · wired ${wired}`);
}

// flow-35. The navball's surface→orbit blend (flow session, QUEUE Q435, PLAYTEST #110: "like it's switching its frame of
// reference"). speedRef switched from the ground's speed to the orbit's at 50 km, and prograde (and a SAS holding it) jumped
// by the ground's spin. Now it blends through 40–60 km, so the marker slides; a click on the label holds either frame, and
// the tape carries that choice with the controls.
{
  const T = api.TELLUS, D = 180 / Math.PI, s = api.newShip(api.PRESETS.Orbiter); api.S = s; api.t = 0;
  const up = [Math.cos(0.3), 0, Math.sin(0.3)], east = norm(cross([0, 1, 0], up));
  const at = h => { s.landed = false; s.r = mul(up, T.R + h); s.v = add(mul(up, 900), mul(east, 1400)); return api.speedRef(s); };
  const ang = (a, b) => Math.acos(Math.min(1, dot(norm(a), norm(b)))) * D;
  let step = 0, prev = at(39000).v, mono = true, w0 = 0;
  for (let h = 39100; h <= 61000; h += 100) { const r = at(h); step = Math.max(step, ang(prev, r.v)); prev = r.v; if (r.w < w0 - 1e-12) mono = false; w0 = r.w; }
  const old = ang(sub(s.v, api.surfVel(T, s.r)), s.v);   // what the switch jumped by at 50 km, this climb
  const ends = at(39000).w === 0 && at(30000).srf && at(61000).w === 1 && !at(61000).srf && Math.abs(at(50000).w - 0.5) < 1e-6;
  s.sas = true; s.sasMode = 'pro'; at(50000); const sasOK = ang(api.sasTarget(s), api.speedRef(s).v) < 1e-6;
  s.navRef = 'srf'; const hs = at(80000), hsOK = ang(hs.v, sub(s.v, api.surfVel(T, s.r))) < 1e-9 && hs.srf;
  s.navRef = 'orb'; const ho = at(10000), hoOK = ang(ho.v, s.v) < 1e-9 && !ho.srf;
  const c = api.controls(s); s.navRef = null; api.setControls(s, c); const back = s.navRef === 'orb';
  s.navRef = null; const c0 = api.controls(s), plain = !('ref' in c0); s.navRef = 'srf'; api.setControls(s, c0); const cleared = s.navRef === null;
  const tapeV = html.includes('procStep,speedRef,sasTarget,velFrame].map');
  const ui = html.includes('<span id="navref"') && html.includes("$('navref').onclick=()=>navRefNext()") && html.includes('rt=navRefLabel(S,sr)');
  check('flow-35: the navball blends surface → orbit speed over 40–60 km (prograde slides, SAS follows), the label holds either frame, the tape carries it',
    step < 0.6 && mono && ends && sasOK && hsOK && hoOK && back && plain && cleared && tapeV && ui,
    `largest step per 100 m ${step.toFixed(2)}° (the old switch: ${old.toFixed(1)}° at once) · w monotonic ${mono} · ends ${ends} · SAS on the blend ${sasOK} · held surface ${hsOK} / orbit ${hoOK} · tape ${back} ${plain} ${cleared} ${tapeV} · UI ${ui}`);
}

// flow-36. SAS buttons as symbols (flow session, QUEUE Q436, PLAYTEST #111: "can they be symbols, some visual shorthand?").
// Each mode's button is the mark the navball draws for it (SAS_MARK: one path for the ball's Path2D and the button's SVG), its
// word on hover and in Help; the navball now draws normal and radial marks too, from velFrame, the directions the SAS holds.
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const src = page.slice(page.indexOf('const MK_O='), page.indexOf('// ---- navball: per-pixel'));
  const M = new Function('Path2D', src + 'return {SAS_MARK, sasIcon};')(function () {});
  const sasm = page.slice(page.indexOf('const SASM=['), page.indexOf('];', page.indexOf('const SASM=[')) + 2);
  const modes = new Function(sasm + 'return SASM;')().map(x => x[0]);
  const every = modes.every(k => M.SAS_MARK[k] && /^<svg[^]*<path d="M[^"]+" fill="none" stroke="#[0-9a-f]{6}"/.test(M.sasIcon(k)));
  const paths = new Set(modes.map(k => M.SAS_MARK[k].d + M.SAS_MARK[k].c)).size === modes.length;   // no two modes look alike
  const pair = (a, b) => M.SAS_MARK[a].c === M.SAS_MARK[b].c;
  const kin = pair('pro', 'retro') && pair('normal', 'anti') && pair('radout', 'radin') && pair('tgt', 'antitgt') && pair('rpro', 'rretro') && !pair('pro', 'normal') && !pair('normal', 'radout');
  const T = api.TELLUS, s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.landed = false; s.r = [T.R + 2e5, 0, 0]; s.v = [0, 0, Math.sqrt(T.mu / (T.R + 2e5))];
  const V = api.velFrame(s); let held = true;
  for (const [m, u] of [['pro', V.pro], ['normal', V.nrm], ['anti', mul(V.nrm, -1)], ['radout', V.rad], ['radin', mul(V.rad, -1)]]) { s.sasMode = m; held = held && len(sub(api.sasTarget(s), u)) < 1e-12; }
  const radOut = dot(V.rad, norm(s.r)) > 0.99;
  const ui = H.includes("b.innerHTML=sasIcon(k);b.className='mk';b.setAttribute('aria-label',n);") && H.includes("if(V.nrm&&sr.w>0){mark(V.nrm,'normal',1.6)") && H.includes('r.marks?sasLegend():r.d') && H.includes('nctx.stroke(mkPath(k))');
  check('flow-36: SAS buttons are the navball\'s marks (one drawing each, distinct, paired colours), the word on hover and in Help; the ball draws normal and radial, where the SAS points',
    every && paths && kin && held && radOut && ui, `${modes.length} modes drawn ${every} · distinct ${paths} · colours ${kin} · SAS = marks ${held} · radial out is up ${radOut} · wired ${ui}`);
}

// flow-37. The ◇ through the coast and the burn (flow session 2, QUEUE Q485, PLAYTEST #121: "maybe I should have coasted to
// apoapsis… I ran out of fuel"). Past the climb the guide doesn't vanish: it coasts, dashed on the horizon, then from half the
// burn before the apoapsis it is a burn toward a circular orbit, until the periapsis is out of the air. Flown by hand on the
// guide alone (the nose on the ◇, full throttle except while coasting), the Orbiter reaches orbit with propellant left.
{
  const T = api.TELLUS;
  const aim = (s, u) => { const f = api.localFrame(s.r), Y = norm(u), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  api.t = 0; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.sas = false; s.throttle = 1; api.stage(s);
  const seen = []; let n = 0, coast = null, burn = null, end = null;
  while (s.alive && n++ < 200000) { const g = api.turnGuide(s), ph = g ? g.ph : (seen.length ? 'none' : null);
    if (ph && seen[seen.length - 1] !== ph) seen.push(ph);
    if (g && g.ph === 'coast' && !coast) coast = { h: len(s.r) - T.R, tAp: g.tAp, tb: g.tb, p: g.p, ap: 1e9 };
    if (g && g.ph === 'coast') coast.ap = Math.min(coast.ap, elements(s.r, s.v, T.mu).ap - T.R);
    if (g && g.ph === 'burn' && !burn) burn = { tAp: g.tAp, tb: g.tb, dv: g.dv };
    if (!g && seen.includes('burn')) { const el = elements(s.r, s.v, T.mu); end = { pe: el.pe - T.R, ap: el.ap - T.R, left: api.dvRemaining(s).tot }; break; }
    if (g) aim(s, g.u); s.throttle = g && g.ph === 'coast' ? 0 : 1;
    if (!s.landed && dot(s.v, s.r) < 0 && !g) break;
    if (s.evIdx < s.events.length && api.activeEngines(s).length === 0 && s.throttle > 0) api.stage(s);
    api.advPhys(s); }
  const order = seen.join('>') === 'climb>coast>burn>none';
  const timely = burn && Math.abs(burn.tAp - burn.tb / 2) < 3;   // the burn starts half its length before the apoapsis
  const orbit = end && end.pe > T.atm && end.left > 0;
  const H = html, ui = H.includes("setLineDash(tg.ph==='coast'?[4,3]:[])") && H.includes('function guideTxt(g)') && H.includes('circHint();') && H.includes("g.ph!=='climb'||turnHintN>=2");
  check('flow-37: the ◇ guides the end of the climb: coast (dashed, on the horizon) to half a burn before the apoapsis, then burn on it until the periapsis is out of the air; flown on it alone, the Orbiter makes orbit',
    order && coast && Math.abs(coast.p) < 1e-9 && timely && orbit && ui,
    `phases ${seen.join(' > ')} · coast from ${coast ? `${(coast.h / 1e3).toFixed(1)} km, Ap ≥ ${(coast.ap / 1e3).toFixed(1)}` : '—'} km · burn ${burn ? `${burn.tAp.toFixed(1)} s before Ap (half of ${burn.tb.toFixed(1)} s), ${burn.dv.toFixed(0)} m/s` : 'never'} · ${end ? `orbit ${(end.pe / 1e3).toFixed(0)} × ${(end.ap / 1e3).toFixed(0)} km, ${end.left.toFixed(0)} m/s left` : 'no orbit'} · wired ${ui}`);
}

// flow-38. Easy / Normal / Hard (flow session, QUEUE Q476, DECISIONS D25; PLAYTEST #119). PROG.lvl picks a row of LEVELS:
// Easy burns less propellant for the same thrust (Isp ×1.15), the body's air pushes and heats at ×0.75 (fins and chutes at
// the true air), engines always light and deadlines stretch ×1.5; Hard's budget has no pilot's margin and no revert. Normal
// is the game as it was. Tapes, studies and logbook records carry their level.
{
  const P0 = structuredClone(api.PROG), at = k => { if (k === 'normal') delete api.PROG.lvl; else api.PROG.lvl = k; };
  const dv = k => { at(k); return api.stageStats(api.PRESETS.Orbiter).stages.map(x => x.dvV); };
  const dN = dv('normal'), dE = dv('easy'), dH = dv('hard');
  const isp = dE.every((x, i) => Math.abs(x / dN[i] - 1.15) < 1e-6) && dH.every((x, i) => Math.abs(x - dN[i]) < 1e-9);
  // one step at full throttle: the same push, less propellant
  const burn = k => { at(k); const s = api.newShip(api.PRESETS.Orbiter); api.S = s; api.t = 0; s.throttle = 1; api.stage(s);
    const f0 = s.parts.reduce((a, p) => a + (p.res.fuel || 0), 0); api.physStep(s, api.DT);
    return { used: f0 - s.parts.reduce((a, p) => a + (p.res.fuel || 0), 0), T: s.thrust }; };
  const bN = burn('normal'), bE = burn('easy'), flow = bN.used > 0 && Math.abs(bE.used / bN.used - 1 / 1.15) < 1e-6 && Math.abs(bE.T / bN.T - 1) < 1e-9;
  // the body's air at ×0.75 (the Orbiter without its fins and chute: every aero force left is the body's)
  const aero = k => { at(k); const s = api.newShip(api.PRESETS.Orbiter); api.geom(s); s.fins = []; s.chute = false; for (const p of s.parts) { p.F = [0, 0, 0]; p.L = [0, 0, 0]; p.Q = 0; }
    api.aeroPass(s, [30, 600, 0], [0, 0, 0], 0.4, 1.8, false); return s.parts.reduce((a, p) => a + len(p.F), 0); };
  const aN = aero('normal'), aE = aero('easy'), air = aN > 0 && Math.abs(aE / aN - 0.75) < 1e-9;
  // the margin: Normal carries the pilot's, Hard none
  at('normal'); const mN = api.orbitNeed(api.PRESETS.Orbiter, []).margin; at('hard'); const mH = api.orbitNeed(api.PRESETS.Orbiter, []).margin;
  const margin = mN > 0 && mH === 0;
  // ignition never fails on Easy: an engine the program has never flown, rolled over many flights
  const ign = k => { at(k); const s = api.newShip(api.PRESETS.Orbiter); s.rec = api.recNew(); s.rec.khSeen = {}; let fails = 0; const f0 = api.PROG.flights, msg = api.HOOK.msg; api.HOOK.msg = () => {};
    for (let n = 0; n < 200; n++) { api.PROG.flights = n; if (!api.igniteOK(s, s.parts.find(p => p.d.kind === 'engine').seg)) fails++; } api.HOOK.msg = msg; api.PROG.flights = f0; return fails; };
  api.PROG.flights = 3; const fN = api.khOn() ? ign('normal') : -1, fE = ign('easy'), noFail = fE === 0 && fN !== 0;
  // deadlines
  const due = k => { at(k); api.PROG.offers = null; api.PROG.active = []; api.ensureBoard(); const o = api.PROG.offers[0]; api.acceptOffer(o.id); const c = api.PROG.active.find(x => x.id === o.id); return c ? (c.deadline - api.PROG.day) / o.p.dur : NaN; };
  const loose = Math.abs(due('easy') - 1.5) < 1e-9 && Math.abs(due('normal') - 1) < 1e-9;
  // what carries the level
  at('normal'); const tn = api.tapeNew(api.PRESETS.Orbiter, null).v, sn = api.studyKey(api.newShip(api.PRESETS.Orbiter));
  at('easy'); const te = api.tapeNew(api.PRESETS.Orbiter, null).v, se = api.studyKey(api.newShip(api.PRESETS.Orbiter));
  const s = api.newShip(api.PRESETS.Orbiter); s.rec = api.recNew(); s.rec.dv = 100; s.rec.newLog = []; api.PROG.log = {}; const news = api.HOOK.news; api.HOOK.news = () => {};
  api.logNote(s, 'apex', 5e5); api.HOOK.news = news; const rec = api.PROG.log.apex && api.PROG.log.apex.lvl === 'easy';
  const carried = tn === api.TAPE_V && te === api.TAPE_V + ':easy' && sn !== se && se.endsWith('@easy') && rec;
  const H = html.replace(/\r\n/g, '\n');
  const ui = H.includes('Article 3 · How hard?') && H.includes("if(ds.lvl){setLevel(ds.lvl);renderTitle()}") && H.includes('<h3>Difficulty</h3>')
    && H.includes("if(!revertOK()){HOOK.msg('No revert on Hard") && H.includes("+(fl?(revertOK()?b('revert'");
  for (const k of Object.keys(api.PROG)) delete api.PROG[k]; Object.assign(api.PROG, P0);
  check('flow-38: Easy / Normal / Hard: Easy\'s Isp ×1.15 on the same thrust, body air ×0.75, no ignition failures, deadlines ×1.5; Hard has no pilot\'s margin and no revert; tapes, studies and records carry the level',
    isp && flow && air && margin && noFail && loose && carried && ui,
    `Δv ×${(dE[0] / dN[0]).toFixed(3)} (Hard = Normal ${dH.every((x, i) => x === dN[i])}) · a step's propellant ×${(bE.used / bN.used).toFixed(3)}, thrust ×${(bE.T / bN.T).toFixed(3)} · body air ×${(aE / aN).toFixed(3)} · margin Normal ${mN} / Hard ${mH} · ignition fails of 200: Normal ${fN}, Easy ${fE} · deadlines ${loose} · tape/study/record ${carried} · wired ${ui}`);
}

// flow-39. The ◇ keeps the angle of attack small at speed (flow session, QUEUE Q482, PLAYTEST #120). The profile ran ~7°
// below the surface prograde at 35 km (Mach 4.7, 12 kPa); the Passenger Orbiter staged there, and its finless upper stage
// flipped and ran dry. Past Mach 3 turnGuide keeps q·α under 36 kPa·°. Flown here as the gyro autopilot flies it: the
// hold set onto the ◇ every step, staging when the engines run out, until the apoapsis is 10 km out of the air.
{
  const T = api.TELLUS, D = 180 / Math.PI, s = api.newShip(api.PRESETS['Passenger Orbiter']); api.S = s; api.t = 0;
  const msg = api.HOOK.msg; api.HOOK.msg = () => {};
  api.advPhys(s); s.throttle = 1; api.stage(s); s.av = 0; s.sas = true; s.sasMode = 'stab';
  let maxA = 0, worst = 0, fast = 0, done = false, at = '', jump = 0, g0 = null;
  for (let k = 0; k < 200000 && s.alive; k++) {
    const h = len(s.r) - T.R, f = api.localFrame(s.r), el = api.elements(s.r, s.v, T.mu), g = api.turnGuide(s);
    if (el.ap - T.R > T.atm + 10000) { done = true; break; }
    if (g && g0 && g.ph === 'climb') jump = Math.max(jump, Math.acos(Math.min(1, dot(g.u, g0))) * D); g0 = g && g.ph === 'climb' ? g.u : null;
    s.hold = g ? g.u : s.landed || el.ap - T.R < T.atm ? f.up : norm(sub(s.v, mul(f.up, dot(s.v, f.up))));
    if (g && g.ph === 'climb' && s.mach > 3.2 && s.qdyn > 1000) {   // the ◇ itself within budget (a step's lag aside)
      const va = sub(s.v, api.surfVel(T, s.r)), a = Math.acos(Math.min(1, dot(g.u, norm(va)))) * D; worst = Math.max(worst, a * s.qdyn / 36000); fast++; }
    if (s.evIdx < s.events.length && api.activeEngines(s).length === 0) api.stage(s);
    api.advPhys(s); const qa = s.qdyn * s.aoa * D / 1000; if (h > 3000 && s.mach > 3 && qa > maxA) { maxA = qa; at = `${(h / 1e3).toFixed(1)} km, Mach ${s.mach.toFixed(1)}, ${(s.aoa * D).toFixed(1)}°, stage ${s.evIdx}`; }
  }
  api.HOOK.msg = msg;
  check('flow-39: from Mach 3 (faded in from 2.5, no jump) the ◇ keeps q·α under 36 kPa·°: the Passenger Orbiter flown on it stages at 35 km without flipping (q·α under 60 kPa·° past Mach 3) and climbs out of the air',
    s.alive && done && maxA < 60 && fast > 50 && worst < 1.05 && jump < 0.3,
    `alive ${s.alive} · apoapsis out ${done} · largest q·α past Mach 3 ${maxA.toFixed(0)} kPa·° at ${at} (the flip: ~1,500) · the ◇ at ${(worst * 100).toFixed(0)} % of its budget over ${fast} fast steps · its largest step ${jump.toFixed(2)}°`);
}

// flow-40. The current stage's Δv in flight (flow session 2, QUEUE Q495, PLAYTEST #130: "it would be nice to have"). A Δv
// card: the stage burning now at this air's exhaust speed (the core's line is vacuum) with its burn at full throttle, the
// stages after it, and past the climb what the ◇'s burn to orbit needs against all that's left. Kept in the dark cockpit.
{
  const T = api.TELLUS;
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  const fmtT = new Function(cut(page, 'function fmtT(', "+x+'s'}") + "+x+'s'};return fmtT")();
  const mk = new Function('S', 'density', 'dvPlan', 'len', 'fmtT', 'turnGuide', cut(page, 'function dvRows(', '\nconst aoaRow') + ';return dvRows()');
  const rows = s => { s.rec = { launched: true }; try { return mk(s, api.density, api.dvPlan, len, fmtT, api.turnGuide); } finally { delete s.rec; } };   // a recorded flight makes advPhys tick a mission
  const txt = R => R.map(r => `${r[0]}: ${r[1].replace(/<[^>]+>/g, '')}`).join(' | ');
  api.t = 0; const s = api.newShip(api.PRESETS.Orbiter); api.S = s;
  const pad = rows(s);
  s.sas = false; s.throttle = 1; api.stage(s);
  const aim = u => { const f = api.localFrame(s.r), Y = norm(u), X = norm(cross(Y, f.n)); s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; };
  let low = null, coast = null, n = 0;
  while (s.alive && n++ < 200000) { const g = api.turnGuide(s), h = len(s.r) - T.R;
    if (!low && h > 1000) low = rows(s);
    if (g && g.ph === 'coast' && !coast) { coast = rows(s); break; }
    if (g) aim(g.u); s.throttle = 1;
    if (s.evIdx < s.events.length && api.activeEngines(s).length === 0) api.stage(s);
    api.advPhys(s); }
  const num = (R, k, re) => { const r = R && R.find(x => x[0] === k); const m = r && r[1].replace(/<[^>]+>/g, '').match(re); return m ? m.slice(1).map(Number) : null; };
  const padOK = pad.length >= 2 && num(pad, 'This stage', /^(\d+) m\/s \((\d+) vac\)/) && pad.some(r => r[0] === 'Then');
  const hv = num(low, 'This stage', /^(\d+) m\/s \((\d+) vac\)/), lowOK = hv && hv[0] < hv[1] && low.some(r => r[0] === 'Full burn');
  const orb = num(coast, 'To orbit', /^(\d+) m\/s · .* burn · \+(\d+)$/), orbOK = !!orb && orb[0] > 0;
  const wired = page.includes("title:'<span style=\"text-transform:none\">Δv</span>',rows:dvRows}") && page.includes("CP_CARDS=['ascent','descent','target','dv']");
  check('flow-40: a Δv card in flight: this stage at this air\'s exhaust speed with its burn time, the stages after it, and the burn to orbit against what\'s left; kept in the dark cockpit',
    padOK && lowOK && orbOK && wired, `pad: ${txt(pad)} · 1 km: ${low ? txt(low) : '—'} · coasting: ${coast ? txt(coast) : '—'} · wired ${wired}`);
}

// flow-41. Warn before the turn goes flat into the heat (flow session 2, QUEUE Q483; PLAYTEST #119, Q474's sweep: flat by
// 43 km instead of 54 the Orbiter's pod burns up). turnFlat: burning, fast and low, the path more than 4° under the standard
// profile ('turn'), or the apoapsis still in the air and under 35 s away ('level'); the master caution names it and the ◇
// turns red with a chevron skyward. Flown here with the nose on a profile flat by X km until the ◇ leaves the climb, then on
// the ◇'s coast and burn (Q485), or, obeying, on the ◇ from the warning on: quiet on the standard climb and flat by 51 km;
// flat by 46 and 40 km it fires with the pod under 90 % of its limit, and the pilot who obeys it makes orbit.
{
  const T = api.TELLUS, D = 180 / Math.PI;
  const fly = (P, fk, obey) => { api.t = 0; const s = api.newShip(api.PRESETS[P]); api.S = s; s.sas = false; s.throttle = 1; api.stage(s);
    let n = 0, w = null, peak = 0, out = 'lost';
    while (s.alive && n++ < 300000) { const h = len(s.r) - T.R, f = api.localFrame(s.r), G = api.turnGuide(s), low = h < 2000 && !G;
      const own = !(obey && w) && (G ? G.ph === 'climb' : h < T.atm), x = Math.min(1, Math.max(0, (h - 286) / (fk * 1000 - 286))), p = 90 * (1 - Math.pow(x, 0.6)) / D;
      const Y = own ? norm(add(mul(f.e, Math.cos(p)), mul(f.up, Math.sin(p)))) : G ? G.u : norm(sub(s.v, api.surfVel(T, s.r))), X = norm(cross(Y, f.n));
      s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; s.throttle = G && G.ph === 'coast' ? 0 : G || low || h < T.atm && !(obey && w) ? 1 : 0;
      const F = api.turnFlat(s), heat = s.hot ? s.hot.T / s.hot.d.Tmax : 0; peak = Math.max(peak, heat); if (F && !w) w = { h, heat, why: F.why };
      const el = elements(s.r, s.v, T.mu); if (!G && el.pe - T.R > T.atm) { out = 'orbit'; break; }
      if (!G && !low && dot(s.v, s.r) < 0 && h < T.atm * 0.9) { out = 'fell'; break; }
      if (s.evIdx < s.events.length && api.activeEngines(s).length === 0 && s.throttle > 0) api.stage(s);
      api.advPhys(s); }
    return { out: s.alive ? out : 'burned up', w, peak }; };
  const R = {};
  for (const P of ['Orbiter', 'Lunar', 'Heavy']) R[`${P} 54`] = fly(P, 54);
  R['Orbiter 51'] = fly('Orbiter', 51);
  for (const k of [46, 40]) { R[`Orbiter ${k}`] = fly('Orbiter', k); R[`Orbiter ${k}, obeyed`] = fly('Orbiter', k, true); }
  const quiet = ['Orbiter 54', 'Lunar 54', 'Heavy 54', 'Orbiter 51'].every(k => !R[k].w && R[k].out === 'orbit');
  // unheeded it's lost, or (since Q515's burn hold, which can save the flat-by-46 Orbiter flown on the ◇ past the climb) the pod reaches its limit
  const early = [46, 40].every(k => R[`Orbiter ${k}`].w && R[`Orbiter ${k}`].w.heat < 0.9 && (R[`Orbiter ${k}`].out !== 'orbit' || R[`Orbiter ${k}`].peak >= 0.99) && R[`Orbiter ${k}, obeyed`].out === 'orbit');
  const H = html, ui = H.includes('const F=S.proc?null:turnFlat(S);if(F)L.push(') && H.includes("fl=tg&&!S.proc&&turnFlat(S),gc=fl?'#ff5a3a':'#fff1c8'") && H.includes("${fl?' ▲':''}");
  check('flow-41: too flat, too low: quiet on the standard climb (Orbiter, Lunar, Heavy) and flat by 51 km; flat by 46 and 40 km the master caution and a red ◇ fire with the pod under 90 % of its limit, and obeyed the Orbiter makes orbit',
    quiet && early && ui,
    Object.entries(R).map(([k, r]) => `${k}: ${r.out}, ${r.w ? `${r.w.why} at ${(r.w.h / 1e3).toFixed(0)} km, pod ${(r.w.heat * 100).toFixed(0)} %` : 'quiet'} (peak ${(r.peak * 100).toFixed(0)} %)`).join(' · ') + ` · wired ${ui}`);
}

// flow-42. A crash on Selene gets landing-burn advice, not a parachute (flow session 2, QUEUE Q497, PLAYTEST #133). debFail
// notes whether there was air where it went wrong; debHelp answers a hit there with a landing burn started high enough, legs
// down, and drops the air-only lines (heat shield, nose cone).
{
  const sel = { rec: { launched: true }, r: [0, 1738e3 + 5, 0], body: { R: 1738e3, atm: 0, name: 'Selene' } };
  api.debFail(sel, 'hit', 'hit Selene at 38 m/s'); const rec = sel.rec.fails[0];
  const noAir = api.debHelp(null, 'hit Selene at 38 m/s', rec.air), air = api.debHelp(null, 'hit Tellus at 38 m/s');
  const ok = rec.air === false && /landing burn/.test(noAir) && !/parachute opened/.test(noAir) && /legs/.test(noAir) && /parachute/.test(air)
    && api.debHelp('heat', 'burned up', false) === '' && /heat shield/.test(api.debHelp('heat', 'burned up'));
  const wired = html.includes('F.length&&F[0].air!=null?F[0].air:!!s.body.atm)');
  check('flow-42: a crash on an airless body is told to burn for the landing (start high, legs down), not to open a parachute; no heat shield advice there',
    ok && wired, `Selene: "${noAir}" · Tellus: "${air}" · wired ${wired}`);
}

// flow-43. A falling orbit is one line to the ground (flow, QUEUE Q489; PLAYTEST #126, P1). The map's blue orbit stops at the
// top of the air; the predictor's red (fallLine) must go on from that very point, in the same non-rotating frame (each point
// where it will be at its own time), and end on the ground at the X. It used to be drawn "over the ground as it is now" (the
// path in the rotating frame, placed at simT): it repeated the vacuum arc and started tens of km off the blue; and it was
// pushed after the map's lines went to the GPU, so only the notebook map drew it at all.
{
  const top = TELLUS.R + TELLUS.atm, cases = [[150e3, 2000, 0], [300e3, 3000, 0], [120e3, 2500, -300], [60e3, 2000, -300]], rows = [];
  let ok = typeof api.fallLine === 'function', oldOff = 0;
  for (const [h, vh, vv] of cases) {
    if (!ok) break;
    api.t = 1000; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.landed = false; s.r = [TELLUS.R + h, 0, 0]; s.v = [vv, 0, -vh]; s.throttle = 0;
    const f = api.predictImpact(s), L = f && api.fallLine(f);
    if (!L) { ok = false; rows.push(`${h / 1e3} km: no line`); break; }
    let start = s.r;   // already in the air: from the ship; above it: from where the orbit (the blue) meets the top of the air
    if (len(s.r) > top + 1) { const el = elements(s.r, s.v, TELLUS.mu), c = (el.p / top - 1) / el.e; start = kepler(s.r, s.v, api.timeToNu(el, -Math.acos(c)), TELLUS.mu)[0]; }
    const d0 = len(sub(L.pts[0], start)), hi = Math.max(...L.pts.map(p => len(p))) - top;
    let gap = 0; for (let i = 1; i < L.pts.length; i++) gap = Math.max(gap, len(sub(L.pts[i], L.pts[i - 1])));
    const gEnd = len(L.end) - TELLUS.R - api.groundAlt(TELLUS, f.pf), last = L.pts[L.pts.length - 1];
    const own = L.ts.every((t, i) => !i || t >= L.ts[i - 1]) && L.ts[L.ts.length - 1] === f.t && len(sub(last, L.end)) < 1e-6 && len(sub(L.end, api.fromPF(TELLUS, f.pf, f.t))) < 1e-6;
    const k = f.pathT.findIndex(t => t >= (f.tAir ?? 0)); oldOff = Math.max(oldOff, k >= 0 ? len(sub(api.fromPF(TELLUS, f.path[k], api.t), L.pts[0])) : 0);
    ok = ok && d0 < 50 && hi < Math.max(0, len(s.r) - top) + 1 && gap < 30e3 && Math.abs(gEnd) < 20 && own;
    rows.push(`${h / 1e3} km: start ${d0.toFixed(1)} m off, top ${(hi / 1e3).toFixed(1)} km over the air, steps ≤ ${(gap / 1e3).toFixed(0)} km, end ${gEnd.toFixed(1)} m off the ground`);
  }
  const R = html.slice(html.indexOf('function drawMap('), html.indexOf('function drawMap(') + 40000), iL = R.indexOf('fallLine('), iG = R.indexOf('gl.drawArrays(gl.LINES,0,out.length/7)');
  const drawn = iL > 0 && iG > 0 && iL < iG;
  check('flow-43: a falling orbit is one line: the red starts where the blue stops (top of the air, or the ship in it), same frame, and ends on the ground at the X; drawn before the map lines go to the GPU',
    ok && drawn, `${rows.join(' · ')} · the old drawing was up to ${(oldOff / 1e3).toFixed(0)} km off · drawn in time ${drawn}`);
}

// flow-44. Where a craft comes down, and who brings it back (flow, QUEUE Q488; PLAYTEST #123, P1). One verdict
// (landingVerdict, sim/world.js) for every point: our land is trucked home; the sea within our ships' reach of the launch
// point is fished out (~hours), beyond it lost, and what sinks before the ships arrive is lost; another power's land by
// relations (sent back, back worn, kept); Selene: no recovery. recoveryOf (the landing settled) is the same verdict, and a
// Sounding flight's predicted verdict (fallVerdict on predictImpact) is what it gets when it lands. The map's X, the Descent
// card, the node's landing and the Rollout's check all read it.
{
  const P = api.PROG, R = TELLUS.R, home = api.SITES[0], keepRel = JSON.parse(JSON.stringify(P.rel || {})), keepFac = P.fac, from = home.u, rows = [];
  // the Sounding flight below completes missions, pays, logs: the whole program is put back after (it moved the next step on,
  // and with it the Δv aims later sections' launch warnings read)
  const keepProg = structuredClone(P), keepS = api.S, keepT = api.t;
  P.fac = {};
  const V = (u, o = {}) => api.landingVerdict(TELLUS, mul(norm(u), R), { from, ...o });
  const homeCity = api.CITIES.find(c => c.power && c.power.i === api.HOME && api.isLand(c.u));
  let near = null, far = null;
  for (let k = 1; k <= 60 && !(near && far); k++) for (let a = 0; a < 12; a++) { const q = api.alongAz(from, a * Math.PI / 6, k * 20e3 / R);
    if (api.isLand(q) || V(q).where !== 'the sea') continue; const d = k * 20; if (!near && d >= 60 && d <= 180) near = [q, d]; if (!far && d >= 900) far = [q, d]; }
  const vh = V(homeCity.u), vn = V(near[0]), vs = V(near[0], { afloat: 600 }), vf = V(far[0]);
  const city = api.CITIES.find(c => c.power && c.power.i !== api.HOME && api.isLand(c.u)), key = api.pairKey(api.HOME, city.power.i);
  P.rel[key] = 0.5; const vFr = V(city.u); P.rel[key] = -0.1; const vTe = V(city.u); P.rel[key] = -0.6; const vHo = V(city.u);
  const zHo = api.recoveryZone(norm(city.u), from, true, city.power), zN = api.recoveryZone(near[0], from, false), zF = api.recoveryZone(far[0], from, false);
  // recoveryOf, the settled landing, is the same verdict
  const at = (u, water) => { const s = api.newShip(['chute', 'pod']); s.landed = true; s.water = water; s.pf = mul(norm(u), R); return s; }, Rr = { launchPf: mul(from, R) };
  const same = [[homeCity.u, false, vh], [near[0], true, vn], [far[0], true, vf], [city.u, false, vHo]].every(([u, w, v]) => { const r = api.recoveryOf(at(u, w), Rr); return r.factor === v.refund && r.kind === v.kind; });
  P.rel = keepRel;
  const vSel = api.landingVerdict(SELENE, [SELENE.R, 0, 0], { from });
  const hrs = (3600 + near[1] * 1e3 / 10) / 3600;
  const ok1 = vh.recovered && vh.refund === 1 && vh.kind === 'land' && /trucked home/.test(vh.text)
    && vn.recovered && vn.who === 'our ships' && Math.abs(vn.hours - hrs) < 0.2 && new RegExp(`recovered by our ships, ~${Math.max(1, Math.round(hrs))} h`).test(vn.text)
    && !vs.recovered && vs.kind === 'sank' && !vf.recovered && vf.kind === 'lost' && vf.hours === null
    && vFr.recovered && vFr.refund === 1 && vTe.recovered && vTe.refund === 0.8 && !vHo.recovered && vHo.refund === 0 && vHo.who === city.power.name && vHo.text === `lands in ${city.power.name}: they keep it`
    && !vSel.recovered && vSel.kind === 'none' && vSel.where === 'Selene' && zHo === 'hostile' && zN === 'reach' && zF === 'far' && same;
  rows.push(vh.text, vn.text, vs.text, vf.text, vFr.text, vTe.text, vHo.text, vSel.text);
  check('flow-44: one landing verdict: our land trucked home, the sea within reach fished out in ~hours (lost if it sinks first, lost beyond reach), a power\'s land by relations (sent back, worn, kept), Selene none; recoveryOf agrees',
    ok1, rows.join(' · '));
  // a Sounding flight: the verdict predicted on the way down is the one it gets on landing
  api.t = 0; const s = api.newShip(api.PRESETS.Sounding); api.S = s; s.throttle = 1; api.stage(s); let armed = false, n = 0, pv = null;
  while (s.alive && !(s.rec.launched && s.landed) && n++ < 200000) {
    if (!armed && s.rec.launched && dot(s.v, norm(s.r)) < 0) { api.stage(s); armed = true; }
    if (armed && !pv && len(s.r) - R < 30e3) pv = api.fallVerdict(api.predictImpact(s), s);
    api.advPhys(s);
  }
  const got = s.landed ? api.recoveryOf(s, s.rec) : null;
  check('flow-44: a Sounding flight\'s landing verdict, predicted at 30 km on the way down, is the recovery it gets',
    !!pv && !!got && pv.kind === got.kind && pv.refund === got.factor, `predicted: ${pv ? pv.text : 'none'} · landed: ${got ? `${got.kind} ${got.why}` : 'not landed'} · reach ${(api.recoveryReach() / 1e3).toFixed(0)} km`);
  P.fac = keepFac; for (const k of Object.keys(P)) if (!(k in keepProg)) delete P[k]; Object.assign(P, keepProg); api.S = keepS; api.t = keepT;
  // the readers: the map's X (and the node's), the Descent card, the Rollout's check and the Recovery layer all go through it
  const has = (...a) => a.every(x => html.indexOf(x) >= 0);
  const readers = has('impact.verdict=fallVerdict(impact,S)', "t2:V?V.t:''", 'function landRow()', 'impactRow(),...landRow()', 'ok(recoveryRule())', 'planImp.v.text', "['recovery','Recovery zones", 'recoveryZone(atlasU(x,y)');
  check('flow-44: the map X, the node\'s landing, the Descent card, the Rollout check and the Recovery zones layer read the verdict', readers, api.recoveryRule());
}

// flow-45. The warp readout drops "(physics)" (flow, QUEUE Q511; Caio 2026-10-31: "physics should hold throughout"). It
// does: up to 100× off rails the loop takes the same fixed step more times a frame. The readout is just N×; the levels the
// loop won't take now are dimmed beside it, with why (railsWhy, the same tests as railsOK; warpCap, the loop's own caps).
{
  const H = html.replace(/\r\n/g, '\n'), page = H.slice(H.indexOf('// ==== SIM END'));
  const cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  const S0 = api.S, t0 = api.t, F0 = api.FLEET.slice();
  const ro = cut(page, "$('warpN').textContent=", ';'), blk = cut(page, '// the warp readout (Q511)', 'renderStages()'), ctl = cut(H, '<span id="warp"', '</span><button id="bMap"');
  const src = cut(page, 'function warpCap(', '\n// a step of the warp control');
  const wc = src && new Function('S', 'player', 'simT', 'FLEET', 'WARPS', 'flightRailsOK', 'railsWhy', 'railsOK', 'dot', 'norm', 'groundGap', src + ';return warpCap');
  const cap = s => wc(s, null, api.t, [], [1, 2, 4, 10, 50, 100, 1000, 10000, 100000], () => api.railsOK(s), api.railsWhy, api.railsOK, dot, norm, api.groundGap)();
  const ship = (b, h, vUp, vSide) => { api.t = 1000; const s = api.newShip(api.PRESETS.Orbiter); api.S = s; s.landed = false; s.body = b; s.r = [b.R + h, 0, 0]; s.v = [vUp, 0, -vSide]; s.throttle = 0; return s; };
  const gnd = (b, h) => h + api.groundAlt(b, api.toPF(b, [b.R + h, 0, 0], 1000)), rows = [], C = [];
  const pad = api.newShip(api.PRESETS.Orbiter); api.S = pad; api.stage(pad); pad.throttle = 1;
  C.push(['on the pad, lit', pad, 5, /engines running/]);
  C.push(['in orbit, coasting', ship(TELLUS, 300e3, 0, Math.sqrt(TELLUS.mu / (TELLUS.R + 300e3))), 8, /^$/]);
  C.push(['climbing at 40 km', ship(TELLUS, 40e3, 800, 1500), 5, /in the air/]);
  C.push(['falling at 1 km', ship(TELLUS, gnd(TELLUS, 1000), -300, 0), 0, /ground/]);
  C.push(['3 km over Selene', ship(api.SELENE, gnd(api.SELENE, 3000), 0, 1500), 5, /near the ground/]);
  let ok = !!wc && typeof api.railsWhy === 'function';
  for (const [l, s, max, re] of C) {
    if (!ok) break;
    const w = api.railsWhy(s), c = cap(s), good = (w === '') === api.railsOK(s) && c.max === max && re.test(c.why);
    ok = ok && good; rows.push(`${l}: ${c.max === 8 ? 'all open' : `up to ${[1, 2, 4, 10, 50, 100][c.max]}× (${c.why})`}${good ? '' : ' ✗'}`);
  }
  const ui = !/physics/i.test(ro) && !/physics/i.test(ctl) && ro.length > 10 && blk.includes('c=warpCap()') && /'lock'/.test(blk) && ctl.includes('id="warpL"')
    && page.includes('warpIdx=Math.min(warpIdx,warpCap(false).max)') && page.includes("k==='.')warpStep(1)") && page.includes('warpStep(+d.warp)');
  check('flow-45: the warp readout says N× with no "(physics)"; the levels the loop won\'t take are dimmed with why (engines, the air, the ground, another craft), from the same tests the loop uses',
    ok && ui, `${rows.join(' · ')} · ui ${ui}`);
  api.S = S0; api.t = t0; api.FLEET.length = 0; api.FLEET.push(...F0);   // put back: later shards see the state they had
}

// flow-46. The ◇ saves a Lunar-class climb that went flat (flow, QUEUE Q515; from Q483). Before: obeyed from the warning (9 km,
// flat by 40) the Lunar coasted to ~104 km with little speed across, and its 0.16 g upper stage, burning on the 'circ' aim,
// sank to 62 km while the ◇ flipped climb ↔ burn (the coast's 100/110 km band) and it fell. Now the burn's length counts the
// stages (stagedBurnTime: the weak stage's long burn starts early), the burn ◇ lifts to hold the height (guideHold: thrust
// upward against gravity less the centripetal part), a begun burn never turns back into a climb, and levelling off in the
// air (Q483's 'level', 59 km on a climb flat by 43) the climb ◇ lifts too. Flown as flow-41 does, the ◇ obeyed from the warning.
{
  const T = api.TELLUS, D = 180 / Math.PI, P = api.PROG, keepProg = structuredClone(P), keepS = api.S, keepT = api.t, F0 = api.FLEET.slice();
  const fly = (Pn, fk) => { api.t = 0; const s = api.newShip(api.PRESETS[Pn]); api.S = s; s.sas = false; s.throttle = 1; api.stage(s);
    let n = 0, w = null, out = 'lost', burn = null, low = Infinity, back = 0, coast = null; const seen = [];
    while (s.alive && n++ < 300000) { const h = len(s.r) - T.R, f = api.localFrame(s.r), G = api.turnGuide(s), pad = h < 2000 && !G;
      if (G && seen[seen.length - 1] !== G.ph) seen.push(G.ph);
      if (G && G.ph === 'coast' && !coast) coast = { tb: G.tb, one: api.nodeBurnTime(s, G.dv) };
      if (G && G.ph === 'burn' && !burn) burn = { h }; if (burn) { low = Math.min(low, h); if (G && G.ph === 'climb') back++; }
      const own = !w && (G ? G.ph === 'climb' : h < T.atm), x = Math.min(1, Math.max(0, (h - 286) / (fk * 1000 - 286))), p = 90 * (1 - Math.pow(x, 0.6)) / D;
      const Y = own ? norm(add(mul(f.e, Math.cos(p)), mul(f.up, Math.sin(p)))) : G ? G.u : norm(sub(s.v, api.surfVel(T, s.r))), X = norm(cross(Y, f.n));
      s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; s.throttle = G && G.ph === 'coast' ? 0 : G || pad || h < T.atm && !w ? 1 : 0;
      const F = api.turnFlat(s); if (F && !w) w = { h, why: F.why };
      const el = elements(s.r, s.v, T.mu); if (!G && el.pe - T.R > T.atm) { out = 'orbit'; break; }
      if (!G && !pad && dot(s.v, s.r) < 0 && h < T.atm * 0.9) { out = 'fell'; break; }
      if (s.evIdx < s.events.length && api.activeEngines(s).length === 0 && s.throttle > 0) api.stage(s);
      api.advPhys(s); }
    const el = elements(s.r, s.v, T.mu);
    return { out: s.alive ? out : 'burned up', w, burn, low, back, coast, seen, pe: el.pe - T.R, ap: el.ap - T.R, left: api.dvRemaining(s).tot }; };
  const R = { 'flat by 40': fly('Lunar', 40), 'flat by 43': fly('Lunar', 43) }, a = R['flat by 40'];
  const ok = Object.values(R).every(r => r.w && r.out === 'orbit' && r.pe > T.atm && r.burn && r.back === 0 && r.low > 0.7 * T.atm);
  const staged = a.coast && a.coast.tb > 2 * a.coast.one;   // the coast's burn time counts the weak stage after the booster
  check('flow-46: the Lunar obeying the ◇ from the warning (flat by 40: \'turn\' at 9 km; flat by 43: \'level\' at 59 km) makes orbit: the burn holds the height (lowest over 70 km, was 62), never flips back to the climb, and starts early for the weak stage',
    ok && staged,
    Object.entries(R).map(([k, r]) => `${k}: ${r.w ? `${r.w.why} at ${(r.w.h / 1e3).toFixed(0)} km` : 'quiet'}, ${r.seen.join(' > ')}, burn from ${r.burn ? (r.burn.h / 1e3).toFixed(1) : '—'} km, lowest ${(r.low / 1e3).toFixed(1)} km, ${r.back} back to climb, ${r.out} ${(r.pe / 1e3).toFixed(0)} × ${(r.ap / 1e3).toFixed(0)} km, ${r.left.toFixed(0)} m/s left`).join(' · ')
      + ` · coast's burn ${a.coast ? `${a.coast.tb.toFixed(0)} s through the stages (this stage alone ${a.coast.one.toFixed(0)} s)` : '—'}`);
  for (const k of Object.keys(P)) if (!(k in keepProg)) delete P[k]; Object.assign(P, keepProg);
  api.S = keepS; api.t = keepT; api.FLEET.length = 0; api.FLEET.push(...F0);   // put back: later shards see the state they had
}

// flow-47. Recovery zones polish (flow, QUEUE Q536; from Q488's screenshots). One reach rule: spent stages fetched from the
// sea (stageRecover) and the fleet's salvage (fleetSalvage) use the verdict's recoveryReach and recoveryDist, not their own,
// so a stage just inside the reach is fetched and one just past it isn't, at every fleet level, as landingVerdict says. The
// Recovery legend is compact (a fifth of the window at most, at 1280×720 and 1024×600; folded, one line), sized in CSS
// pixels; the landing verdict under the X sits on a plate and moves off other labels; the powers' names give way to it.
{
  const P = api.PROG, keepProg = structuredClone(P), news0 = api.HOOK.news, keepS = api.S, keepT = api.t, R = TELLUS.R, from = api.SITES[0].u, rows = [];
  const H = html.replace(/\r\n/g, '\n'), cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  let said = []; api.HOOK.news = m => said.push(m);
  const parts = () => api.newShip(['chute', 'pod']).parts;
  const drop = d => ({ kind: 'sea', pf: mul(api.alongAz(from, 1.1, d / R), R), parts: parts(), sea: { fate: 'afloat', afloat: Infinity, sp: 3 } });
  let ok = true;
  for (const lv of [0, 1, 2]) {
    P.fac = lv ? { fleet: { lv } } : {}; const reach = api.recoveryReach(), ds = [reach - 5e3, reach + 5e3];
    const Rr = { launchPf: mul(from, R), drops: ds.map(drop) }; said = []; api.stageRecover(Rr);
    const fates = Rr.drops.map(v => v.fate), want = ds.map(d => api.landingVerdict(TELLUS, mul(api.alongAz(from, 1.1, d / R), R), { from, sea: true }).kind === 'sea');
    const agree = fates.every((f, i) => (f === 'recovered') === want[i]) && Math.abs(api.recoveryDist(norm(Rr.drops[0].pf), from) - ds[0]) < 1;
    let salv = 'n/a';
    if (lv) { const R2 = { launchPf: mul(from, R), drops: ds.map(drop) }; said = []; api.fleetSalvage(R2); salv = said.join(' '); if (!/: 1 stage fished/.test(salv)) ok = false; }
    ok = ok && agree; rows.push(`fleet ${lv} (reach ${(reach / 1e3).toFixed(0)} km): ${fates.join(' / ')}${lv ? `; salvage: ${/: (\d+) stage/.exec(salv)?.[1] ?? 0} of 2` : ''}`);
  }
  const src = cut(H, 'function stageRecover(', '\n// salvaged') + cut(H, 'function fleetSalvage(', '\nfunction facilitiesHTML');
  const one = src.length > 200 && (src.match(/recoveryReach\(\)/g) || []).length === 2 && (src.match(/recoveryDist\(/g) || []).length === 2 && !/FAC\.fleet\.range|RECOVER_LOCAL|Math\.acos/.test(src);
  check('flow-47: one reach rule: spent stages fetched from the sea and the fleet\'s salvage use recoveryReach/recoveryDist; just inside the reach fetched, just past it not, at fleet levels 0-2, as the landing verdict says',
    ok && one, rows.join(' · ') + ` · one rule in the source ${one}`);
  for (const k of Object.keys(P)) if (!(k in keepProg)) delete P[k]; Object.assign(P, keepProg);
  api.HOOK.news = news0; api.S = keepS; api.t = keepT;   // put back: later shards see the state they had
  // the legend: its layout is pure (recLegLayout); text measured at 0.55 em a character, a little wide for a sans
  const lsrc = cut(H, 'function recLegLayout(', '\nconst recLegOn'), rsrc = cut(H, 'const REC_LEG=', '\nlet recLegShut');
  const lay = lsrc && new Function(lsrc + ';return recLegLayout')(), legRows = rsrc && new Function('recoveryReach', rsrc + ';return REC_LEG')(() => 1500e3)();
  const tw = (t, f) => t.length * f * 0.55, L = [];
  let ok2 = !!lay && Array.isArray(legRows) && legRows.length === 6;
  for (const [iw, ih] of [[1280, 720], [1024, 600], [1920, 1080]]) { if (!ok2) break;
    const a = lay(iw, ih, legRows, true, tw), z = lay(iw, ih, legRows, false, tw);
    ok2 = ok2 && a.h <= 0.2 * ih && a.w <= 0.2 * iw && a.fs <= 10.5 && a.x + a.w <= iw && a.y + a.h <= ih && z.h <= 2 * z.fs && z.w < a.w;
    L.push(`${iw}×${ih}: ${Math.round(a.w)}×${Math.round(a.h)} px at ${a.fs.toFixed(1)} px (${(100 * a.h / ih).toFixed(0)}% high), folded ${Math.round(z.w)}×${Math.round(z.h)}`); }
  const wired = H.includes('if(recLegOn(era)){const g=recLegRect();put.push(') && H.includes('else if(recLegOn(era))recLegDraw(o,recLegRect())') && H.includes('recLegToggle();drag=null')
    && H.includes("c:L.c2||L.c,o:0,plate:1") && /if\(T\.plate\)\{[\s\S]{0,400}P\.find\(/.test(H) && H.includes('if(MAP_PUT.some(') && H.includes('const c=ovPx()');
  check('flow-47: the Recovery legend is compact (under a fifth of the window, ≤ 10.5 px type, folds to one line), sized in CSS pixels; the verdict under the X is on a plate and moves off labels and the legend; powers\' names give way to it',
    ok2 && wired, L.join(' · ') + ` · wired ${wired}`);
}

// flow-48. Map overlay text the same size at any render scale (flow, QUEUE Q539; from Q536). The overlay is drawn in the 3D
// view's pixels (W = innerWidth·min(dpr,1.5)·RS), so a size of N·min(dpr,1.5) grew by 1/RS when the adaptive resolution
// dropped on a slow GPU (×2.9 at RS 0.35: the X's labels, cities, powers' names, node handles, the readout). Every overlay
// mark and text is now sized by one helper, ovPx() (W/innerWidth, app/render.js): N·ovPx() is N CSS px at any RS. Source:
// nothing sizes from min(devicePixelRatio…) but the canvases themselves; computed: 12 px type is 12 CSS px at RS 1 and 0.35.
{
  const H = html.replace(/\r\n/g, '\n'), B = readFileSync(new URL('./builder.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  // the only min(devicePixelRatio…) left: the 3D view's size, the overlay canvas's size, the mission track's own canvas
  const allowed = [/const dpr=Math\.min\(devicePixelRatio\|\|1,1\.5\)\*RS,w=Math\.round\(innerWidth\*dpr\)/, /const od=Math\.min\(devicePixelRatio\|\|1,2\),ow=/, /^function mcTrackDraw\(\)/];
  const stray = (H + '\n' + B).split('\n').filter(l => /min\(devicePixelRatio/.test(l) && !allowed.some(r => r.test(l.trim()))).map(l => l.trim().slice(0, 60));
  const drawers = { 'drawMap and the flight markers': cut(H, '// ---- 2D overlay', '\nfunction nuToT('), atlasOverlay: cut(H, 'function atlasOverlay(', '\nfunction eraInk('),
    drawEraMap: cut(H, 'function drawEraMap(', '\nfunction gateMsg('), recLegRect: cut(H, 'function recLegRect(', '\nfunction recLegDraw('), rvLabels: cut(H, 'function rvLabels(', '\n'),
    'map picking': cut(H, 'const toCv=', '\nfunction pickOrbit') + cut(H, 'function pickOrbit(', '\n'), 'node handle drag': cut(H, 'if(hDrag&&S.node){', '\n'), 'builder overlay': cut(B, 'const DPR=', '\n') };
  const missing = Object.entries(drawers).filter(([, s]) => !s || !s.includes('ovPx()')).map(([n]) => n);
  // no fixed-size font in the map's drawers (a font is N·k, k = ovPx())
  const fixed = [drawers['drawMap and the flight markers'], drawers.atlasOverlay, drawers.drawEraMap].join('\n').match(/font=`(?:bold |600 )?\d+(?:\.\d+)?px/g) || [];
  check('flow-48: every map overlay text and mark sizes from one helper, ovPx(), not min(devicePixelRatio…) (the X\'s labels, cities, powers\' names, node handles, the readout, the notebook/terminal maps, the flight markers, the rover yard, the builder)',
    !stray.length && !missing.length && !fixed.length && /function ovPx\(w=W,iw=innerWidth\)\{return w\/iw\}/.test(H),
    `stray ${stray.length ? stray.join(' | ') : 'none'} · without the helper ${missing.join(', ') || 'none'} · fixed fonts ${fixed.join(' ') || 'none'}`);
  // computed: the 3D view's width as render() sets it, the helper from the source, 12 px type at RS 1 and 0.35, dpr 1 and 2
  const ovPx = new Function(cut(H, 'function ovPx(', '\n') + ';return ovPx')(), iw = 1280, rows = [];
  let same = /const dpr=Math\.min\(devicePixelRatio\|\|1,1\.5\)\*RS,w=Math\.round\(innerWidth\*dpr\)/.test(H);
  for (const dpr of [1, 2]) for (const RS of [1, 0.35]) {
    const W = Math.round(iw * Math.min(dpr, 1.5) * RS), css = u => 12 * u * iw / W;   // drawing units → CSS px (the overlay spans the window)
    const now = css(ovPx(W, iw)), was = css(Math.min(dpr, 1.5));
    same = same && Math.abs(now - 12) < 0.05; rows.push(`dpr ${dpr} RS ${RS}: ${now.toFixed(2)} CSS px (was ${was.toFixed(1)})`); }
  check('flow-48: the helper keeps 12 px type at 12 CSS px at RS 1 and RS 0.35 (dpr 1 and 2); before, it grew to ~34 px at RS 0.35', same, rows.join(' · '));
}

// flow-49. A cue when a stage still attached has run dry (flow, QUEUE Q538; from Q537). A pilot who keeps the Crewed Lunar's
// four empty boosters (~10 t) through the core's last 62 s levels off in the air. spentCue (sim/flight.js): the next staging
// event is a drop, everything it drops is dry (a lit engine, none drawing fuel, no fuel left) and has been for 2 s; then
// the staging list's row lights ("empty: drop them (Space)") and one line goes to the message area, once per stage. Flown on
// the standard climb (flat by 54, then the ◇): boosters kept (staging only when every engine is out, flow-41's flier), the
// cue comes ~2 s after their burnout, names them and clears when staged; staged as designed it never shows; a drop that
// would take a burning engine with it, or a next event that drops nothing, gets none. Never stages by itself.
{
  const T = api.TELLUS, D = 180 / Math.PI, P = api.PROG, keepProg = structuredClone(P), keepS = api.S, keepT = api.t, F0 = api.FLEET.slice();
  const keepNews = api.HOOK.news; api.HOOK.news = () => {};
  const fly = (Pn, designed, at) => { api.t = 0; const s = api.newShip(api.PRESETS[Pn]); api.S = s; s.sas = false; s.throttle = 1; api.stage(s);
    let n = 0, out = 'lost', on = 0, longest = 0, raw = null, cue = null, says = 0, auto = 0; const R = { s };
    while (s.alive && n++ < 300000) { const h = len(s.r) - T.R, f = api.localFrame(s.r), G = api.turnGuide(s), pad = h < 2000 && !G;
      const own = G ? G.ph === 'climb' : h < T.atm, x = Math.min(1, Math.max(0, (h - 286) / (54000 - 286))), p = 90 * (1 - Math.pow(x, 0.6)) / D;
      const Y = own ? norm(add(mul(f.e, Math.cos(p)), mul(f.up, Math.sin(p)))) : G ? G.u : norm(sub(s.v, api.surfVel(T, s.r))), X = norm(cross(Y, f.n));
      s.q = api.qFromBasis(X, Y, cross(X, Y)); s.w = [0, 0, 0]; s.throttle = G && G.ph === 'coast' ? 0 : G || pad || h < T.atm ? 1 : 0;
      const el = elements(s.r, s.v, T.mu); if (!G && el.pe - T.R > T.atm) { out = 'orbit'; break; }
      if (!G && !pad && dot(s.v, s.r) < 0 && h < T.atm * 0.9) { out = 'fell'; break; }
      if (s.evIdx < s.events.length && s.throttle > 0 && (api.activeEngines(s).length === 0 || designed && api.dvRemaining(s).cur <= 0.5)) api.stage(s);
      const e0 = s.evIdx; api.advPhys(s); if (s.evIdx !== e0) auto++;   // the sim staging by itself (it mustn't)
      const d = api.spentStage(s), c = api.spentCue(s);
      if (d && !raw) raw = { t: api.t, i: d.i, h };
      if (c) { on += api.DT; longest = Math.max(longest, on); if (c.say) says++; if (!cue) cue = { t: api.t, ...c }; } else on = 0;
      if (at && at(s, R, d, c)) break; }
    return Object.assign(R, { out: s.alive ? out : 'burned up', longest, raw, cue, says, auto, left: api.dvRemaining(s).tot }); };
  // boosters kept: the cue lit for 5 s, then the pilot stages; 5 s on, done
  const K = fly('Crewed Lunar', false, (s, R, d, c) => {
    if (c && !R.lit) R.lit = { t: api.t, ev: s.evIdx };
    if (R.lit && !R.staged && api.t - R.lit.t > 5) {   // before staging: a next event that drops nothing gets no cue
      const ev = s.events[s.evIdx]; s.events[s.evIdx] = { ...ev, decouple: [] }; R.noDrop = api.spentStage(s); s.events[s.evIdx] = ev;
      R.staged = { t: api.t, ev: s.evIdx, what: s.segs[ev.decouple[0]].label }; api.stage(s); R.after = api.spentCue(s); }
    if (R.staged && !R.cleared && api.t - R.staged.t > 0.5) R.cleared = { cue: api.spentCue(s), ev: s.evIdx };
    return R.staged && api.t - R.staged.t > 5; });
  // a drop that would take a burning engine: as the boosters run dry, one of the four gets 0.5 t back
  const B = fly('Crewed Lunar', false, (s, R, d) => {
    if (d && !R.fed) { const tk = s.parts.find(p => p.on && p.seg === s.events[d.i].decouple[0] && p.cap && p.cap.fuel > 0.5); if (tk) { tk.res.fuel = 0.5; R.fed = { t: api.t }; } }
    if (R.fed) { const e = s.events[s.evIdx]; R.burning = R.burning || api.activeEngines(s).some(p => e.decouple.includes(p.seg)); }
    return R.fed && api.t - R.fed.t > 8; });
  const S0 = fly('Crewed Lunar', true);
  // physStep's old one-liner ("boosters empty — stage to drop them") now only for a crossfed group whose engines run on
  // (the Asparagus), so a burnt-out stage gets one line, not two
  const keepMsg = api.HOOK.msg, M = []; api.HOOK.msg = m => M.push(m);
  const K2 = fly('Crewed Lunar', false, () => api.t > 110), kM = M.splice(0), A = fly('Asparagus', false, () => api.t > 60), aM = M.splice(0);
  api.HOOK.msg = keepMsg;
  const one = !kM.some(m => /stage to drop them/.test(m)) && kM.includes('Booster burnout') && K2.says === 1 && aM.some(m => /^boosters empty — stage to drop them$/.test(m)) && A.says === 0;
  const kept = K.raw && K.cue && K.cue.i === 1 && K.cue.what === 'boosters ×4' && K.cue.many && K.cue.t - K.raw.t <= 3 && K.says === 1
    && K.staged && K.staged.ev === 1 && !K.after && K.cleared && !K.cleared.cue && K.noDrop === null && K.auto === 0;
  const burn = B.fed && B.burning && B.longest === 0 && B.says === 0;
  const designed = S0.out === 'orbit' && S0.longest <= 2 && S0.says === 0 && S0.auto === 0;
  const H = html, ui = H.includes('function dryHint(){const c=S&&mode===\'flight\'?spentCue(S):null') && H.includes('empty — Space drops ${c.many?\'them\':\'it\'} (stage ${c.i+1})')
    && H.includes('else if(!g.flamed&&!g.dryNote&&next&&next.decouple.includes(k)') && one
    && H.includes('<div class="dryc">empty: drop ${dry.many?\'them\':\'it\'} (Space)</div>') && /\.stg\.dry\{[^}]*var\(--warn\)/.test(H) && H.includes('hlGauges();dryHint();');
  check('flow-49: a spent stage still attached: kept, the Crewed Lunar\'s dry boosters get the cue within ~2 s of burnout (named, once), cleared when staged; staged as designed it never shows; none when the drop takes a burning engine or drops nothing; never auto-stages; wired (the lit row, the message)',
    kept && burn && designed && ui,
    `kept: boosters dry at ${K.raw ? `${K.raw.t.toFixed(1)} s, ${(K.raw.h / 1e3).toFixed(1)} km` : '—'}, cue ${K.cue ? `at ${K.cue.t.toFixed(1)} s ("${K.cue.what}", stage ${K.cue.i + 1})` : 'never'}, said ${K.says}×, staged at ${K.staged ? K.staged.t.toFixed(1) : '—'} s → cleared ${K.cleared ? !K.cleared.cue : '—'}, no-drop event ${K.noDrop === null ? 'quiet' : 'cued'}`
      + ` · one booster fed 0.5 t: burning ${!!B.burning}, cue ${B.longest.toFixed(1)} s · staged as designed: ${S0.out}, ${S0.left.toFixed(0)} m/s left, cue at most ${S0.longest.toFixed(1)} s · auto-staged ${K.auto + B.auto + S0.auto} · messages kept: ${kM.join(" / ")}; Asparagus: ${aM.filter(m => /empty/.test(m)).join(" / ") || "none"} · wired ${ui}`);
  api.HOOK.news = keepNews; for (const k of Object.keys(P)) if (!(k in keepProg)) delete P[k]; Object.assign(P, keepProg);
  api.S = keepS; api.t = keepT; api.FLEET.length = 0; api.FLEET.push(...F0);   // put back: later shards see the state they had
}

// flow-50. A toppled lander on screen (flow, QUEUE Q527; from Q508). Seen in the game: it lies on the ground, still, framed;
// the Debrief and news read right. What read wrong: nothing said which parts the fall put out of use, the Fleet tab didn't
// say it lies on its side, and the map drew a landed craft's own "orbit" (its ground turning) with "Impact in 1s". Now
// tipState (sim/flight.js) feeds the flight's "On its side" card: buried antennas, wings, cameras and why each is out (no
// sky, no sun, no view), alike ones grouped; broken and damaged parts. Its own sim, as vehicle-38's drop (nothing shared).
{
  const D = new Function(src + 'return {newShip,toV2,HOOK,SELENE,fromPF,groundAlt,terrainSlope,surfaceAt,surfaceHit,surfVel,qFromBasis,physStep,DT,footPoints,tipSpeed,tipState,recNew,len,norm,add,mul,cross,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  Object.assign(D.HOOK, { msg: () => {}, boom: () => {}, rebuild: () => {}, news: () => {}, debris: () => {} });
  const B = D.SELENE, DG = Math.PI / 180, U = (la, lo) => [Math.cos(la * DG) * Math.cos(lo * DG), Math.sin(la * DG), Math.cos(la * DG) * Math.sin(lo * DG)];
  let u = null; for (let la = -30; la <= 30 && !u; la += 0.5) for (let lo = -60; lo < 60; lo += 0.5) { const w = U(la, lo); if (D.surfaceHit(D.surfaceAt(B, w), w, B) > 0) continue; if (D.terrainSlope(B, w) < 0.02) { u = w; break; } }
  const des = D.toV2(['sci', 'core', 't1', 'wren']), fd = (n, k) => n.k === k ? n : (n.c || []).map(c => fd(c, k)).find(Boolean);
  fd(des.root, 't1').c.push({ k: 'whip', at: { y: 0.5, a: 0, n: 1 }, c: [] }, { k: 'whip', at: { y: 0.5, a: Math.PI, n: 1 }, c: [] }, { k: 'wpanel', at: { y: 0.3, a: 0, n: 1 }, c: [] }, { k: 'wpanel', at: { y: 0.3, a: Math.PI, n: 1 }, c: [] });
  D.t = 0; const s = D.newShip(des); D.S = s; Object.assign(s, { landed: false, body: B, sas: false, throttle: 0 }); s.rec = D.recNew(); s.rec.launched = true;
  const vt = D.tipSpeed(s, B.mu / B.R ** 2), fy = Math.min(...D.footPoints(s).map(f => f.pt[1])) - s.cm[1];
  s.r = D.fromPF(B, D.mul(u, B.R + D.groundAlt(B, u) - fy + 0.2), 0); const up = D.norm(s.r), e = D.norm(D.cross([0, 1, 0], up));
  s.v = D.add(D.surfVel(B, s.r), D.add(D.mul(up, -1), D.mul(e, 1.5 * vt))); s.q = D.qFromBasis(e, up, D.cross(e, up)); s.w = [0, 0, 0];
  for (let i = 0; i < 40 / D.DT && s.alive && !s.landed; i++) D.physStep(s, D.DT);
  const T = D.tipState(s), up0 = D.tipState(D.newShip(des));
  const w2 = s.parts.find(p => p.on && p.d.key === 'whip' && !p.buried); if (w2) w2.buried = true; const T2 = D.tipState(s); if (w2) w2.buried = false;
  check('flow-50: a lander on its side says what the fall put out of use: the buried whip (no sky) and wing (no sun), the damaged parts with how much; alike ones grouped; an upright craft lists nothing',
    s.alive && !!s.tipped && T.under.includes('whip antenna: no sky') && T.under.includes('solar wing: no sun') && T.under.length === 2 && T.broke.length === 0
      && T.hurt.length === s.tipped.hurt && T.hurt.every(h => /^[a-z ]+ \d+ %$/.test(h)) && T2.under.includes('2 × whip antenna: no sky')
      && !up0.under.length && !up0.broke.length && !up0.hurt.length,
    `${s.alive ? `under: ${T.under.join(' · ')}; damaged: ${T.hurt.join(', ') || 'none'}; broken: ${T.broke.join(', ') || 'none'}; both whips: ${T2.under.join(' · ')}` : s.lossWhy}`);
  const H = html;
  check('flow-50: wired: the "On its side" card (tipRows), the Fleet tab\'s "on its side", no own trajectory on the map once landed, the blocked line says "drop a stage"',
    H.includes("{id:'tipped',title:'On its side',rows:()=>tipRows()}") && H.includes('function tipRows(){if(!S.alive||!S.landed||!S.tipped)return[];const T=tipState(S);')
      && H.includes("${q.bodyName}${q.tipped?' · <span class=\"warn\">on its side</span>':''}") && H.includes('if(!S.landed)drawPatches(gateLegs(predCache.p,labels)')
      && H.includes("TIP_NO=\"It lies on its side: it can't lift off or drop a stage"));
}

// flow-51. A wing under a toppled lander stays folded; the map's body names sit on their bodies (flow, QUEUE Q540, Q541;
// from Q527). On its side, P unfolded a wing lying under the hull (drawn into the ground). Now a deployable pressed under it
// (p.buried) stays folded and says why ("the solar wing is pinned under it"); the others unfold, by P, a group or a stage.
// (Staging and thrust on its side are left to the simulation: Q545.) The map put a body's dot and name at bodyPos + 1.3 R in
// world y: zoomed in, off the disc; now the dot is the centre and the name sits over the limb (bodyRadPx, app/render.js).
// The same drop as flow-50, its own sim.
{
  const D = new Function(src + 'return {newShip,toV2,HOOK,SELENE,fromPF,groundAlt,terrainSlope,surfaceAt,surfaceHit,surfVel,qFromBasis,physStep,DT,footPoints,tipSpeed,recNew,len,norm,add,mul,cross,wingOp,legOp,agFire,stage,pinned,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};')();
  const M = []; Object.assign(D.HOOK, { msg: m => M.push(m), boom: () => {}, rebuild: () => {}, news: () => {}, debris: () => {} });
  const B = D.SELENE, DG = Math.PI / 180, U = (la, lo) => [Math.cos(la * DG) * Math.cos(lo * DG), Math.sin(la * DG), Math.cos(la * DG) * Math.sin(lo * DG)];
  let u = null; for (let la = -30; la <= 30 && !u; la += 0.5) for (let lo = -60; lo < 60; lo += 0.5) { const w = U(la, lo); if (D.surfaceHit(D.surfaceAt(B, w), w, B) > 0) continue; if (D.terrainSlope(B, w) < 0.02) { u = w; break; } }
  const des = D.toV2(['sci', 'core', 't1', 'wren']), fd = (n, k) => n.k === k ? n : (n.c || []).map(c => fd(c, k)).find(Boolean);
  fd(des.root, 't1').c.push({ k: 'whip', at: { y: 0.5, a: 0, n: 1 }, c: [] }, { k: 'whip', at: { y: 0.5, a: Math.PI, n: 1 }, c: [] }, { k: 'wpanel', at: { y: 0.3, a: 0, n: 1 }, c: [] }, { k: 'wpanel', at: { y: 0.3, a: Math.PI, n: 1 }, c: [] });
  D.t = 0; const s = D.newShip(des); D.S = s; Object.assign(s, { landed: false, body: B, sas: false, throttle: 0 }); s.rec = D.recNew(); s.rec.launched = true;
  const vt = D.tipSpeed(s, B.mu / B.R ** 2), fy = Math.min(...D.footPoints(s).map(f => f.pt[1])) - s.cm[1];
  s.r = D.fromPF(B, D.mul(u, B.R + D.groundAlt(B, u) - fy + 0.2), 0); const up = D.norm(s.r), e = D.norm(D.cross([0, 1, 0], up));
  s.v = D.add(D.surfVel(B, s.r), D.add(D.mul(up, -1), D.mul(e, 1.5 * vt))); s.q = D.qFromBasis(e, up, D.cross(e, up)); s.w = [0, 0, 0];
  for (let i = 0; i < 40 / D.DT && s.alive && !s.landed; i++) D.physStep(s, D.DT);
  const W = s.parts.filter(p => p.on && p.d.key === 'wpanel'), Wb = W.find(p => p.buried), Wu = W.find(p => !p.buried);
  // P: the free wing unfolds, the buried one stays folded and the message says why; folded again; then both pinned: nothing moves
  M.length = 0; const n1 = D.wingOp(s, 'out'), m1 = M.join(' | '), ok1 = n1 === 1 && !!Wu && !!Wu.dep && !!Wb && !Wb.dep && /the solar wing is pinned under it/.test(m1);
  let n2 = -1, m2 = '', n3 = -1, ok2 = false, ok3 = false;
  if (Wu && Wb) { D.wingOp(s, 'in'); Wu.buried = true; M.length = 0; n2 = D.wingOp(s, 'out'); m2 = M.join(' | '); ok2 = n2 === 0 && W.every(p => !p.dep) && /^2 solar wings are pinned under it: they stay folded$/.test(m2);
    M.length = 0; n3 = D.agFire(s, 'sol'); ok3 = n3 === 0 && W.every(p => !p.dep) && /pinned under it/.test(M.join());   // the stock group (P's) and the Unfold button take the same path
    Wu.buried = false; }
  check('flow-51: on its side, a wing pressed under the hull stays folded and says why ("the solar wing is pinned under it"); the free one unfolds; with both under it, P and the Solar panels group move nothing',
    s.alive && !!s.tipped && ok1 && ok2 && ok3, `${s.alive ? `P: ${n1} out, "${m1}"; both under: "${m2}"; group: ${n3}` : s.lossWhy}`);
  // a stage of action groups only (Solar panels): the free wing unfolds, the buried one doesn't; an upright craft pins nothing
  const i0 = s.evIdx, harm = { decouple: [], ignite: [], ag: ['sol'] };
  s.events.splice(i0, 0, harm); M.length = 0; D.stage(s); const okH = s.evIdx === i0 + 1 && !!Wu && !!Wu.dep && !!Wb && !Wb.dep && /pinned under it/.test(M.join());
  s.events.splice(i0, 1); s.evIdx = i0; D.wingOp(s, 'in');
  const s2 = D.newShip(des); s2.landed = true; s2.parts.forEach(p => { p.buried = true; }); const okU = !s2.parts.some(p => D.pinned(s2, p));
  check('flow-51: a staged action group on its side unfolds the free wing and leaves the pinned one; a buried flag without s.tipped pins nothing',
    okH && okU, `stage ${okH} · upright ${okU}`);
  const H = html.replace(/\r\n/g, '\n');
  check('flow-51: wired: the Unfold button says when all it could unfold is pinned; legs and action groups leave pinned parts folded',
    H.includes("pin=!out&&f.length&&f.every(p=>pinned(S,p)),t=pin?`${nm} pinned under it`") && H.includes("if(dn&&pinned(s,p))pin.push(p);else{p.dep=dn;p.depT=simT;n++}")
      && H.includes("if(out&&(unfolds(p.d)||p.d.kind==='leg')&&pinned(s,p)){pin.push(p);continue}"));
  // Q541, computed: a body seen close and off-axis from a tilted camera, projected as render() does. The dot is the projected
  // centre; the name sits 8 px over the limb (bodyRadPx: the disc's true radius on screen); the old anchor, 1.3 R up in world y,
  // was well off the disc
  const cut = (t, a, b) => { const i = t.indexOf(a); return i < 0 ? '' : t.slice(i, t.indexOf(b, i + a.length)); };
  const bodyRadPx = new Function(cut(H, 'function bodyRadPx(', '\n') + ';return bodyRadPx')();
  const V = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nz = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
  const Wd = 1280, Hd = 800, tanY = Math.tan(0.45), tanX = tanY * Wd / Hd, Rb = 1.0e6, cen = [3e8, 0, 1e8], camW = [cen[0] - 2.2e6, cen[1] + 2.6e6, cen[2] + 1.4e6];
  const Fw = nz(V([cen[0] + 4e5, cen[1], cen[2] - 3e5], camW)), Rr = nz(cr(Fw, [0, 1, 0])), Uu = cr(Rr, Fw);
  const project = p => { const q = V(p, camW), z = dt(q, Fw); return z <= 0 ? null : [Wd / 2 * (1 + dt(q, Rr) / (z * tanX)), Hd / 2 * (1 - dt(q, Uu) / (z * tanY))]; };
  const c = project(cen), d = Math.hypot(...V(cen, camW)), rp = bodyRadPx(Rb, d, Hd, tanY);
  let lim = 0; const vd = nz(V(cen, camW)), a1 = nz(cr(vd, [0, 1, 0])), a2 = cr(a1, vd), ca = Rb / d, sa = Math.sqrt(1 - ca * ca);   // the limb: the tangent circle seen from the camera
  for (let i = 0; i < 360; i++) { const t = i * DG, P = [0, 1, 2].map(j => cen[j] - vd[j] * Rb * ca + (a1[j] * Math.cos(t) + a2[j] * Math.sin(t)) * Rb * sa), q = project(P); lim += Math.hypot(q[0] - c[0], q[1] - c[1]) / 360; }
  const old = project([cen[0], cen[1] + 1.3 * Rb, cen[2]]), oldOff = Math.hypot(old[0] - c[0], old[1] - c[1]) / lim, txtY = c[1] - (rp + 8);
  check('flow-51: the map\'s body label: its dot is the body\'s projected centre and its name 8 px over the limb (bodyRadPx within 3 % of the drawn disc, close and off-axis); the old anchor, 1.3 R up in world y, sat off the disc',
    H.includes("...BODIES.map(b=>({p:bodyPos(b,simT),mark:'body',R:b.R,") && H.includes("L.mark==='body'?bodyRadPx(L.R,len(sub(L.p,camW)),H,tanY)+8*k") && H.includes('const rp=bodyRadPx(b.R,d,H,tanY);')
      && Math.abs(rp / lim - 1) < 0.03 && txtY < c[1] - lim && txtY > c[1] - lim - 20 && oldOff > 1.1,
    `disc ${lim.toFixed(0)} px, bodyRadPx ${rp.toFixed(0)} px; name ${(c[1] - txtY).toFixed(0)} px over the centre; the old anchor ${oldOff.toFixed(2)} radii from it`);
}

// flow-52. Two planets close on the map's ring share one label (flow, QUEUE Q192; v1.99's open end). The overlap rule
// (PLAYTEST #31) dropped one planet's label in a conjunction and left a nameless dot; mergePlanetTexts (app/render.js)
// now joins them, `Hesper, Astraea`, and three in a row join the same way. Planets apart keep their own labels, and a
// label that isn't a planet's is never merged. Computed on mergePlanetTexts with 7 px per character, 13 px high.
{
  const H = html.replace(/\r\n/g, '\n'), i = H.indexOf('function mergePlanetTexts('), fsrc = i < 0 ? '' : H.slice(i, H.indexOf('\nfunction ', i + 10));
  const merge = fsrc ? new Function(fsrc + 'return mergePlanetTexts;')() : null, w = t => t.length * 7, P = (n, x, y) => ({ t: `${n} · ~150 days there`, x, y, o: 5 });
  const run = T => { merge(T, w, 13); return T.map(t => t.t); };
  const two = merge && run([P('Hesper', 300, 200), P('Astraea', 330, 205), P('Enyo', 700, 200)]);
  const three = merge && run([P('Hesper', 300, 200), P('Astraea', 360, 200), P('Erebus', 420, 200)]);
  const other = merge && run([{ t: 'Selene', x: 300, y: 200, o: 1 }, P('Hesper', 305, 200)]);
  check('flow-52: two planets close on the map share one label (`Hesper, Astraea`), three in a row too; planets apart keep theirs, and a body\'s label is never merged into a planet\'s',
    !!merge && /^\s*mergePlanetTexts\(texts,/m.test(H) && two.join('|') === 'Hesper, Astraea|Enyo · ~150 days there' && three.join('|') === 'Hesper, Astraea, Erebus'
      && other.join('|') === 'Selene|Hesper · ~150 days there',
    merge ? `${two.join(' / ')}; ${three.join(' / ')}; ${other.join(' / ')}` : 'no mergePlanetTexts');
}
