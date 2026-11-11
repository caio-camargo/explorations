// Q574: the share of a circular orbit in contact, with the pad station alone and with 1, 2, 3 more of the stations a new
// program may build (gsCheck ok on day 0: home cities and friendly powers), added greedily (the one that adds most).
// Geometry on the game's own gsSees (terrain masks, 5 deg minimum elevation), three days sampled every 5 s.
import { mk } from './api.mjs';
const a = mk(), { TELLUS, len, norm, mul, add, cross, dot } = a, R = TELLUS.R, deg = x => x * 180 / Math.PI;
const site = a.curSite(), cand = a.gsSites().filter(ci => a.gsCheck(ci).ok).map(ci => ({ name: a.CITIES[ci].name + (a.CITIES[ci].power && a.CITIES[ci].power.i !== a.HOME ? '*' : ''), u: a.CITIES[ci].u }));
console.log('site', site.name, '| buildable on day 0 (* = abroad):', cand.map(c => c.name).join(', '));
function track(h, incDeg) { const r0 = R + h, v = Math.sqrt(TELLUS.mu / r0), i = incDeg * Math.PI / 180, P = 2 * Math.PI * Math.sqrt(r0 ** 3 / TELLUS.mu);
  // start over the site (planet-fixed -> inertial at t=0 is the same rotation the game uses: go through toPF's inverse by sampling)
  const up = norm(site.u), east = norm(cross([0, 1, 0], up)), north = cross(up, east), dir = norm(add(mul(east, Math.cos(i)), mul(north, Math.sin(i))));
  const pts = []; for (let t = 0; t < 3 * a.DAY_S; t += 5) { const th = 2 * Math.PI * t / P, r = add(mul(up, r0 * Math.cos(th)), mul(dir, r0 * Math.sin(th))); pts.push(a.toPF(TELLUS, r, t)); }
  // toPF at t=0 is not the identity (th0): rotate the start so the track begins over the site in the planet's frame
  const off = a.toPF(TELLUS, mul(up, r0), 0), dl = Math.atan2(up[0], up[2]) - Math.atan2(off[0], off[2]), c = Math.cos(dl), s = Math.sin(dl);
  return { P, pts: pts.map(p => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]) }; }
function stats(pts, sts) { let n = 0, gap = 0, mx = 0; for (const p of pts) { if (sts.some(st => a.gsSees(st, p))) { n++; gap = 0; } else { gap += 5; if (gap > mx) mx = gap; } } return { share: n / pts.length, gap: mx }; }
for (const [h, inc] of [[150e3, 0], [500e3, 0], [150e3, 85], [500e3, 85], [a.STAT_R - R, 0]]) { const T = track(h, inc); let sts = [{ name: site.name, u: site.u }], left = cand.slice();
  const line = [`${(h / 1e3).toFixed(0)} km, ${inc} deg (period ${(T.P / 60).toFixed(1)} min):`]; let x = stats(T.pts, sts); line.push(`pad alone ${(100 * x.share).toFixed(1)} %, longest gap ${(x.gap / 60).toFixed(0)} min`);
  for (let k = 0; k < 3 && left.length; k++) { let best = null; for (const c of left) { const y = stats(T.pts, [...sts, c]); if (!best || y.share > best.y.share) best = { c, y }; }
    sts.push(best.c); left = left.filter(c => c !== best.c); line.push(`+ ${best.c.name} ${(100 * best.y.share).toFixed(1)} % (gap ${(best.y.gap / 60).toFixed(0)} min)`); }
  x = stats(T.pts, [...sts, ...left]); line.push(`all ${cand.length} buildable ${(100 * x.share).toFixed(1)} % (gap ${(x.gap / 60).toFixed(0)} min)`);
  console.log(line.join('\n    ')); }
// the horizon: how far downrange (along the equator, east) the pad still sees a craft at altitude h
for (const h of [70e3, 100e3, 110e3, 150e3, 300e3, 500e3]) { const up = norm(site.u), east = norm(cross([0, 1, 0], up)); let d = 0;
  for (let th = 0; th < 1.6; th += 0.0005) { const p = add(mul(up, (R + h) * Math.cos(th)), mul(east, (R + h) * Math.sin(th))); if (!a.gsSees({ name: 's', u: site.u }, p)) { d = th; break; } }
  console.log(`pad horizon for a craft at ${(h / 1e3).toFixed(0)} km: ${(d * R / 1e3).toFixed(0)} km downrange east (${deg(d).toFixed(1)} deg)`); }
