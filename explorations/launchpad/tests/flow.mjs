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
    && /R\.prep=TEST\.fast\|\|R\.watch\?0/.test(src) && /R\.padWait=R\.watch\?0:padWait\(\)/.test(src);
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
  const keys = Object.keys(X.TERMS), rest = page.replace(page.slice(page.indexOf('const TERMS='), page.indexOf('// the tooltip:')), ''), used = keys.filter(k => rest.includes("term('" + k + "'"));
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
  const mk = (S, low) => new Function('mode', 'S', 'ascentOn', 'certOf', 'dot', src + 'return {cpPhase, cautions, CP_CARDS};')('flight', S, () => low, () => 1, (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
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
  const wired = H.includes('<div id="hlg"><div class="g" id="gHeat">') && H.includes('id="gLoad"') && page.includes('depHint();hlGauges();') && H.includes('#mcau.new{animation') && page.includes("m.classList.add('new')");
  check('flow-29: heat and load you notice: HEAT and LOAD by the navball in every phase (part vs limit, joint vs rating), faint, amber from 50 %, red from 90 %; the master caution blinks on a new reason',
    fr && cls && wired, `fracs ${fr} (${f.heat.toFixed(2)}, ${f.load.toFixed(2)}) · classes ${cls} · wired ${wired}`);
}
