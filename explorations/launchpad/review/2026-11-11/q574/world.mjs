// Q574: the default world: the site, the stations, the candidate cities, the capital
import { mk } from './api.mjs';
const a = mk(); const { TELLUS, len, dot, norm } = a;
const deg = x => x * 180 / Math.PI, ang = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(norm(u), norm(v)))));
const site = a.curSite(); console.log('HOME', a.HOME, a.POWERS[a.HOME].name, '| site', site.name, 'lat', deg(Math.asin(site.u[1])).toFixed(1), 'power', site.power);
console.log('stationsAll', a.stationsAll().map(s => s.name));
console.log('PROG.site', a.PROG.site, 'flights', a.PROG.flights, 'funds', a.PROG.funds, 'compEra', a.compEra());
const cap = a.capital(); console.log('capital', cap.name, 'lat', deg(Math.asin(cap.u[1])).toFixed(1), 'arc from site', deg(ang(cap.u, site.u)).toFixed(1), 'deg =', (ang(cap.u, site.u) * TELLUS.R / 1e3).toFixed(0), 'km');
for (const ci of a.gsSites()) { const c = a.CITIES[ci], pw = c.power ? c.power.i : a.HOME, ck = a.gsCheck(ci);
  const dl = Math.atan2(c.u[0], c.u[2]) - Math.atan2(site.u[0], site.u[2]);
  console.log(String(ci).padStart(3), c.name.padEnd(16), 'power', pw, pw === a.HOME ? 'HOME' : `rel ${a.relOf(a.HOME, pw).toFixed(2)} op ${a.opOf(pw).toFixed(0)}`, 'lat', deg(Math.asin(c.u[1])).toFixed(1).padStart(6), 'dlon', (((deg(dl) % 360) + 540) % 360 - 180).toFixed(0).padStart(5), 'arc', deg(ang(c.u, site.u)).toFixed(0).padStart(4), '| ok', ck.ok, 'cost', ck.cost, ck.why); }
console.log('R', TELLUS.R, 'atm', TELLUS.atm, 'STAT alt km', ((a.STAT_R - TELLUS.R) / 1e3).toFixed(0), 'STA_MIN deg', deg(Math.asin(a.STA_MIN)).toFixed(1), 'GS_REACH', a.GS_REACH);
console.log('AV', a.AV.map(x => x.name + ':' + (x.modes || ['all']).join('/')).join(' | '));
