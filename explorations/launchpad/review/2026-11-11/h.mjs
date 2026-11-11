// harness: build the sim with extra exported names
import { pathToFileURL, fileURLToPath } from 'node:url';
const L = fileURLToPath(new URL('../../', import.meta.url)).split(String.fromCharCode(92)).join('/');
const { pageSource } = await import(pathToFileURL(L + 'page.mjs').href);
const html = pageSource();
export const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
export const mk = names => { const X = new Function(src + `return {${names},get HOME(){return HOME},get RIVALS(){return RIVALS},get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)(); X.HOOK.news = () => {}; X.HOOK.msg = () => {}; X.HOOK.save = () => {}; return X; };
