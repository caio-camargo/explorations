// Q612 (review 2 session, 2026-11-13): the survey behind SEL_PLACE_T (sim/ground.js). Every baked crater that the rule
// (selPlaceRule) makes a place, largest first, with the game's own craterSurvey; prints the table's rows for the names
// given in order. Run: node survey.mjs            (the list)      node survey.mjs table      (rows to paste)
import { mk } from '../2026-11-11/h.mjs';
const D = mk('HOOK,SELENE,SELENE_GROUND,selCraters,craterSurvey,selPlaceRule,selSide,selMare,SEL_PLACE_T');
D.SELENE.ground = D.SELENE_GROUND;
const deg = 180 / Math.PI, cr = D.selCraters();
const NAMES = ('Endymion Pandia Ersa Latmos Mene Nemea Hekate Asteria Leto Koios Krios Hypnos Morpheus Aether Hemera Astraios Perses Lelantos Aura Lampetia ' +
  'Phaethusa Aigle Arke Iris Zephyros Boreas Notos Euros Pleione Maia Elektra Taygete Alkyone Kelaino Sterope Merope Atlas Orion Kallisto Arkas ' +
  'Kynosura Helike Ariadne Andromeda Kepheus Kassiopeia Perseus Pegasos Lyra Kyknos Seirios Prokyon Arktouros Kanopos Hyas Ambrosia Dione Mnemosyne Themis Rhea ' +
  'Okeanos Iapetos Klymene Eurybia Pallas Styx Nike Zelos Bia Kratos').split(' ');
const rows = cr.map((c, i) => ({ i, c, S: D.craterSurvey(c) })).map(x => ({ ...x, g: D.selPlaceRule(x.c, x.S) })).filter(x => x.g).sort((a, b) => b.c.D - a.c.D);
if (rows.length > NAMES.length) throw new Error('names: ' + rows.length);
if (process.argv[2] === 'table') { let out = []; rows.forEach((r, k) => out.push(`[${r.i},'${NAMES[k]}','${r.g}']`)); const lines = []; for (let k = 0; k < out.length; k += 8) lines.push('  ' + out.slice(k, k + 8).join(',')); console.log(lines.join(',\n')); }
else { rows.forEach((r, k) => console.log(`${String(r.i).padStart(3)} ${NAMES[k].padEnd(11)} ${r.g}  ${(r.c.D / 1e3).toFixed(0).padStart(4)} km  lat ${(Math.asin(r.c.c[1]) * deg).toFixed(0).padStart(4)}  lon ${(Math.atan2(r.c.c[2], -r.c.c[0]) * deg).toFixed(0).padStart(5)} (0 = facing Tellus)  ${D.selSide(r.c.c).padEnd(4)}  ${D.selMare(r.c.c) > .3 ? 'mare' : 'high'}  floor ${(100 * r.S.flat).toFixed(0).padStart(3)} % standable  rim ${r.S.depth.toFixed(0).padStart(5)} m up${r.c.young ? '  young' : ''}`));
  const n = g => rows.filter(r => r.g === g).length; console.log(`${rows.length} places: A ${n('A')}, B ${n('B')}, C ${n('C')}; the table in the code has ${D.SEL_PLACE_T.length}`); }
