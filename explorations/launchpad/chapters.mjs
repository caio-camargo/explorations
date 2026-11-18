// Chapter starts (QA, QUEUE Q571; PROGRESSION.md § 6): three saves to start a program in the middle of the game, so the
// middle can be played without the hours before it. Each is produced by playing the real code headless: career.mjs's
// scripted player (the prudent one: a reserve, declines offers but a rescue loan) plays one career through the game's own
// economy, the race, opinion and the calendar; its flights are abstracted as career.mjs does, and what they leave up or on
// Selene joins the registry through the game's own satRegister (career.mjs opts.registry). One career, snapshot at each
// chapter, so each start carries on from the one before. Nothing here is a tester cheat.
//   node chapters.mjs            regenerate starts/*.js (when the save schema moves: QUEUE Q571, notes/flow.md)
//   node chapters.mjs --dry      play it and print the summary, write nothing
// The title menu's "Start at" line loads starts/<id>.js (window.CHAPTER_SAVES[id]) into its own save slot (app/title.js).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { run, api, planCost, FIRST_PLAN, MORE_PLAN } from './career.mjs';

// the career that makes them: a random world (as the charter's default), a national agency, world seed 1000 + 77·SEED
const ARCH = null, START = 'agency', SEED = 1, YEARS = 30;
const has = (...ids) => P => ids.every(id => P.done[id]);
export const CHAPTERS = [
  { id: 'orbit', name: 'First orbit done', blurb: 'The beeper in orbit and a passenger round the world and home: satellites, a station and Selene are open.', goals: ['air'], until: has('beeper') },
  { id: 'station', name: 'First station up', blurb: 'A habitat with two free ports in orbit, and the escape tower qualified for a crew.', pilot: true,
    goals: ['air', 'wxsat', 'tv', 'padabort', 'maxqabort', 'station1'], until: has('station1', 'maxqabort') },
  { id: 'selene', name: 'Landed on Selene', blurb: 'A probe standing on Selene, the far side photographed: crews to Selene are next.',
    pilot: true, goals: ['air', 'wxsat', 'tv', 'padabort', 'maxqabort', 'station1', 'lift1', 'lift2', 'farside', 'selimp', 'selland'], until: has('station1', 'maxqabort', 'selland') },
];

// presets built for a mission that NEXT_PRESET doesn't list (sim/vessel.js: the vehicle and bodies sessions' notes on each)
const FOR_MISSION = { selsample: 'Sample Return', crewaround: 'Crewed Lunar', nyxfind: 'Probe' };
const DRY = process.argv.includes('--dry'), P = api.PROG, out = [];
// the save's version: app/state.js's SAVE_V (the save is made by today's code, so no migration step should run on it)
const SAVE_V = +readFileSync(new URL('./app/state.js', import.meta.url), 'utf8').match(/const SAVE_V=(\d+)/)[1];
// (Q631, PLAYTEST #175) a start with a station to dock to has a pilot trained for it: the most senior pilot gets the crew
// capsule's type, rendezvous and docking the way the simulator gives them (2 h in type, two clean runs of each), so a
// chapter start can dock under SAS (the pilot's modes, Q625). Written into the save only: the career itself plays on as it was
function trainPilot(save) {
  const fly = (save.crew || []).filter(a => a.status !== 'lost' && (a.spec || 'fly') === 'fly')
    .sort((a, b) => b.sen.length - a.sen.length || b.rec.flights - a.rec.flights || a.cls - b.cls || a.id - b.id)[0];   // crewRank (sim/crew.js)
  if (!fly) throw new Error('no pilot on the roster to train');
  const d = save.day; fly.quals = { ...fly.quals, types: { ...(fly.quals || {}).types, crew: d }, rdv: d, dock: d };
  fly.type = { ...fly.type, crew: { h: Math.max(2, ((fly.type || {}).crew || { h: 0 }).h), flights: ((fly.type || {}).crew || { flights: 0 }).flights } };
  fly.simN = { ...fly.simN, rdv: 2, dock: 2 };
  return fly.name;
}
for (const [i, ch] of CHAPTERS.entries()) {
  const m = run(ARCH, START, SEED, { keep: i > 0, goals: ch.goals, until: ch.until, registry: true, days: YEARS * 400 });
  if (!ch.until(P)) throw new Error(`chapter ${ch.id}: the scripted player didn't get there in ${YEARS} years (day ${Math.round(P.day)}, done ${Object.keys(P.done).join(',')})`);
  const save = JSON.parse(api.progJSON()); save.ver = SAVE_V;
  const pilot = ch.pilot ? trainPilot(save) : null;
  save.cardQ = [];   // (Q572) the run's world missions: no unlock cards waiting at a chapter start
  const sats = (P.sats || []).filter(q => !q.junk).map(q => q.name + (q.bodyName ? ` (${q.bodyName})` : '')), nx = api.nextStep();
  // the next mission to fly, and what to fly for it: its NEXT_PRESET, else the design the scripted player flies for it
  // (the first in NEXT's order that has one: a world mission such as Disaster watch is met between flights)
  const M0 = api.missionsInOrder(api.MISSIONS.filter(M => !P.done[M.id] && api.missionOpen(M))).find(M => api.NEXT_PRESET[M.id] || FIRST_PLAN[M.id] || MORE_PLAN[M.id] || FOR_MISSION[M.id]), pk = M0 && (api.NEXT_PRESET[M0.id] || FOR_MISSION[M0.id]), pf = M0 && (FIRST_PLAN[M0.id] || MORE_PLAN[M0.id]);
  if (!M0 || !(pk || pf)) throw new Error(`chapter ${ch.id}: no next mission with a design to fly (${M0 ? M0.id : 'none open'})`);
  const next = { id: M0.id, name: M0.name, preset: pk || null, stack: pk ? null : planCost(pf()).st };
  const sum = `${ch.name}: day ${Math.round(P.day)} (${(P.day / 400).toFixed(1)} years), ${P.flights} flights, funds ${P.funds.toFixed(0)}M, `
    + `${Object.keys(P.done).length} firsts (${Object.keys(P.done).join(', ')}), ${P.cdone || 0} contracts, registry: ${sats.join(', ') || 'empty'}; `
    + `crew: ${(save.crew || []).filter(a => a.status !== 'lost').length}${pilot ? ` (${pilot} trained to dock)` : ''}; `
    + `NEXT: ${nx ? nx.kind + ' ' + nx.title : 'none'}; next mission ${next.name} (${next.preset ? 'the ' + next.preset + ' preset' : "the scripted player's design"})`;
  console.log(sum); out.push({ ch, save, sum, next });
}
if (!DRY) {
  mkdirSync(new URL('./starts/', import.meta.url), { recursive: true });
  for (const { ch, save, sum, next } of out) {
    const meta = { id: ch.id, name: ch.name, blurb: ch.blurb, day: save.day, funds: save.funds, next };
    writeFileSync(new URL(`./starts/${ch.id}.js`, import.meta.url),
      `// Chapter start "${ch.name}" (QUEUE Q571): GENERATED by \`node chapters.mjs\`, don't edit. Regenerate it when the save\n`
      + `// schema moves. A random world, a national agency (seed ${SEED}), played by career.mjs's scripted player:\n// ${sum}\n`
      + `(window.CHAPTER_SAVES=window.CHAPTER_SAVES||{})[${JSON.stringify(ch.id)}]={meta:${JSON.stringify(meta)},save:${JSON.stringify(save)}};\n`);
  }
  console.log(`wrote starts/${out.map(o => o.ch.id + '.js').join(', starts/')}`);
}
