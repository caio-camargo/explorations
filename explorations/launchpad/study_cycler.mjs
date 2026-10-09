// Cycler study (space session, QUEUE Q108, 2026-10-09): an Aldrin-style Tellus–Enyo cycler on our scaled system
// (sim/system.js: TU from the 400-day year, Helios μ 1.17e18; Enyo at 1.52 TU, synodic 2.14 y, as Mars). The cycler's
// shape in TU is Aldrin's (a 1.60, e 0.393); what changes is speed (×~0.29) against each planet's pull, so the question is
// whether a Tellus flyby can turn the cycler's v∞ as far as each cycle needs (real Earth can't quite: Aldrin's cycler pays
// a little Δv per cycle), and what a taxi pays to meet it. usage: node study_cycler.mjs   (NOTES § "Q108: a cycler")
import { pageSource } from './page.mjs';
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const D = new Function(src + `return {TU,HELIOS_MU,TELLUS,DAY_S,YEAR_D,planetPeriod,SYSTEM_BODIES};`)();
const mu = D.HELIOS_MU, TU = D.TU(), T = D.TELLUS, yr = D.YEAR_D * D.DAY_S;
const enyo = D.SYSTEM_BODIES.find(b => b.name === 'Enyo'), muE = enyo.g * enyo.R ** 2;
const syn = 1 / (1 / 1 - 1 / (D.planetPeriod('Enyo') / yr));   // years
// the cycler: Aldrin's elements in TU
const a = 1.60 * TU, e = 0.393, P = 2 * Math.PI * Math.sqrt(a ** 3 / mu) / yr, h = Math.sqrt(mu * a * (1 - e * e));
// crossing radius r: speed, transverse and radial parts; against a planet on a circular orbit there (its speed V)
const cross = r => { const v = Math.sqrt(mu * (2 / r - 1 / a)), vt = h / r, vr = Math.sqrt(Math.max(0, v * v - vt * vt)), V = Math.sqrt(mu / r);
  const vinf = Math.hypot(vr, vt - V), turn = 2 * Math.atan2(vr, Math.abs(vt - V)); return { v, vt, vr, V, vinf, turn }; };
// the most a flyby can turn v∞ (periapsis rp): δ = 2 asin(1 / (1 + rp v∞² / μ))
const maxTurn = (vinf, muP, rp) => 2 * Math.asin(1 / (1 + rp * vinf * vinf / muP));
const deg = 180 / Math.PI, aT = TU, aE = enyo.a * TU;
const cT = cross(aT), cE = cross(aE);
console.log(`TU ${(TU / 1e9).toFixed(2)} Gm; Tellus–Enyo synodic period ${syn.toFixed(3)} y; the cycler: a 1.60 TU, e 0.393, perihelion ${(a * (1 - e) / TU).toFixed(3)} TU, aphelion ${(a * (1 + e) / TU).toFixed(3)} TU, period ${P.toFixed(3)} y`);
console.log(`at Tellus: cycler ${(cT.v / 1e3).toFixed(2)} km/s, Tellus ${(cT.V / 1e3).toFixed(2)} km/s, v∞ ${(cT.vinf / 1e3).toFixed(2)} km/s; the turn each cycle needs (inbound to outbound branch) ${(cT.turn * deg).toFixed(1)}°`);
for (const alt of [100e3, 300e3, 1000e3]) { const m = maxTurn(cT.vinf, T.mu, T.R + alt); console.log(`  a Tellus flyby at ${alt / 1e3} km turns v∞ up to ${(m * deg).toFixed(1)}° → ${m >= cT.turn ? 'enough: ballistic' : `short by ${((cT.turn - m) * deg).toFixed(1)}°`}`); }
// for comparison, the real Earth (Aldrin's numbers): v∞ 6.54 km/s, μ 3.986e14, rp 6,678 km
console.log(`  (the real Earth: v∞ 6.54 km/s, a flyby at 300 km turns up to ${(maxTurn(6540, 3.986e14, 6678e3) * deg).toFixed(1)}°: the same geometry needs ${(cT.turn * deg).toFixed(1)}°, so Aldrin's cycler pays Δv; ours doesn't)`);
console.log(`at Enyo: cycler ${(cE.v / 1e3).toFixed(2)} km/s, Enyo ${(cE.V / 1e3).toFixed(2)} km/s, v∞ ${(cE.vinf / 1e3).toFixed(2)} km/s`);
// taxis: from a 300 km orbit at Tellus onto the cycler's hyperbola, and from a low Enyo orbit (or the other way)
const taxi = (vinf, muP, r) => Math.sqrt(vinf * vinf + 2 * muP / r) - Math.sqrt(muP / r);
console.log(`taxi Δv: from 300 km at Tellus ${taxi(cT.vinf, T.mu, T.R + 300e3).toFixed(0)} m/s; from 30 km at Enyo ${taxi(cE.vinf, muE, enyo.R + 30e3).toFixed(0)} m/s (aerobraking in Enyo's 0.006 bar can take part of the arrival)`);
console.log(`for comparison, a Hohmann departure from 300 km to Enyo: ${taxi(Math.sqrt(mu / aT) * (Math.sqrt(2 * aE / (aT + aE)) - 1), T.mu, T.R + 300e3).toFixed(0)} m/s`);
