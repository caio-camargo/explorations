// Shared harness: builds a fresh copy of the sim (as test.mjs does) and exposes ev(code) = eval inside the sim's scope.
// Usage: import { makeSim } from './sim.mjs'; const ev = makeSim(); ev('simT=0'); ...
import { pathToFileURL, fileURLToPath } from 'node:url';
export const ROOT = fileURLToPath(new URL('../../', import.meta.url)).split(String.fromCharCode(92)).join('/');
const { pageSource } = await import(pathToFileURL(ROOT + 'page.mjs').href);
const html = pageSource();
export const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
export function makeSim() { return new Function(src + '\nreturn c=>eval(c);')(); }
