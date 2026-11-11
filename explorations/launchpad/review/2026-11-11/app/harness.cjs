// Headless page: loads every classic script of index.html, in order, into one vm context with DOM/GL stubs.
// const H=require('./harness.cjs').boot({search:'', storage:{}}); H.run('expr'); H.click({go:'program'}); H.key('r'); H.frame(n)
const vm = require('vm'), fs = require('fs');
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
function boot(opt = {}) {
  const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
  const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  const cls0 = {}; for (const m of html.matchAll(/<[a-z0-9]+\b[^>]*\bid="([^"]+)"[^>]*>/g)) { const c = /\bclass="([^"]*)"/.exec(m[0]); cls0[m[1]] = c ? c[1].split(/\s+/).filter(Boolean) : []; }
  const unknown = new Set(), log = [];
  // universal stub: callable, any property is itself, numeric value 0, iterates empty
  const U = new Proxy(function () { }, { get(t, p) { if (p === Symbol.toPrimitive) return () => 0; if (p === Symbol.iterator) return function* () { }; if (p === 'length') return 0; if (p === 'then') return undefined; return U; }, apply() { return U; }, construct() { return U; }, set() { return true; } });
  const els = new Map(), handlers = { doc: {}, win: {} };
  function mkEl(id, tag = 'DIV') {
    const cl = new Set(id && cls0[id] || []), hs = {}; let inner = '';
    const e = {
      id: id || '', tagName: tag, style: {}, dataset: {}, children: [], childNodes: [], parentNode: null, _h: hs, disabled: false, value: '', checked: false, title: '', open: false,
      width: 1280, height: 720, clientWidth: 1280, clientHeight: 720, offsetWidth: 100, offsetHeight: 20, offsetParent: null, scrollTop: 0, scrollHeight: 0,
      classList: { add: (...a) => a.forEach(x => cl.add(x)), remove: (...a) => a.forEach(x => cl.delete(x)), contains: x => cl.has(x), toggle: (x, f) => { const on = f === undefined ? !cl.has(x) : !!f; on ? cl.add(x) : cl.delete(x); return on; } },
      get className() { return [...cl].join(' '); }, set className(v) { cl.clear(); String(v).split(/\s+/).filter(Boolean).forEach(x => cl.add(x)); },
      get innerHTML() { return inner; }, set innerHTML(v) { inner = String(v); e.children = []; for (const m of inner.matchAll(/\bid="([^"]+)"/g)) els.delete(m[1]); },
      get textContent() { return inner.replace(/<[^>]*>/g, ''); }, set textContent(v) { inner = String(v); },
      get outerHTML() { return `<div>${inner}</div>`; },
      addEventListener: (t, f) => { (hs[t] = hs[t] || []).push(f); }, removeEventListener() { },
      appendChild: c => { e.children.push(c); if (c && typeof c === 'object') c.parentNode = e; return c; }, replaceChildren: (...c) => { e.children = c; }, after() { }, remove() { }, cloneNode: () => mkEl('', tag),
      setAttribute(k, v) { e['@' + k] = v; }, getAttribute: k => e['@' + k], querySelector: () => mkEl(''), querySelectorAll: () => [], closest: () => null, contains: () => false,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }), focus() { }, blur() { }, click() { if (e.onclick) e.onclick({ target: e, currentTarget: e, preventDefault() { }, stopPropagation() { } }); for (const f of hs.click || []) f({ target: e, currentTarget: e, preventDefault() { } }); },
      getContext: k => k === 'webgl2' || k === 'webgl' ? U : U, toDataURL: () => '', toBlob() { }, play() { }, pause() { },
    };
    return new Proxy(e, { get(t, p) { if (!(p in t) && typeof p === 'string' && !/^on|^_|^@/.test(p)) { if (/^(firstChild|lastChild|firstElementChild|lastElementChild|nextSibling|previousSibling|nextElementSibling|content|parentElement)$/.test(p)) return t[p] = mkEl(''); unknown.add(p); } return t[p]; }, set(t, p, v) { t[p] = v; return true; } });
  }
  const getEl = id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); };
  const store = new Map(Object.entries(opt.storage || {}));
  const body = mkEl('body', 'BODY');
  const sandbox = {
    console: { log: (...a) => log.push(a.join(' ')), warn: (...a) => log.push('WARN ' + a.join(' ')), error: (...a) => log.push('ERR ' + a.join(' ')), info() { }, debug() { } },
    document: { getElementById: getEl, body, documentElement: mkEl('html'), head: mkEl('head'), createElement: t => mkEl('', String(t).toUpperCase()), createElementNS: () => mkEl(''), querySelector: () => null, querySelectorAll: () => [], addEventListener: (t, f) => { (handlers.doc[t] = handlers.doc[t] || []).push(f); }, removeEventListener() { }, hidden: false, fonts: U, activeElement: null, createTextNode: () => mkEl('') },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => { store.set(k, String(v)); }, removeItem: k => { store.delete(k); }, key: i => [...store.keys()][i] ?? null, get length() { return store.size; } },
    location: { search: opt.search || '', href: 'http://x/index.html' + (opt.search || ''), reload() { log.push('RELOAD'); }, replace() { } },
    navigator: { userAgent: 'node', gpu: undefined, language: 'en' }, performance: { now: () => sandbox.__now }, __now: 1000,
    requestAnimationFrame: f => { sandbox.__raf = f; return 1; }, cancelAnimationFrame() { }, setTimeout: (f, ms) => { (sandbox.__timers = sandbox.__timers || []).push(f); return 1; }, clearTimeout() { }, setInterval: () => 1, clearInterval() { },
    addEventListener: (t, f) => { (handlers.win[t] = handlers.win[t] || []).push(f); }, removeEventListener() { }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    confirm: () => opt.confirm !== false, alert() { }, prompt: () => null, URLSearchParams, URL, Blob: U, Image: U, matchMedia: () => ({ matches: false, addEventListener() { } }), getComputedStyle: () => ({ getPropertyValue: () => '' }),
    Math, JSON, Date, structuredClone, Path2D: U, ImageData: U, OffscreenCanvas: U,
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const errs = [];
  for (const f of files) { try { new vm.Script(fs.readFileSync(ROOT + f, 'utf8'), { filename: f }).runInContext(ctx); } catch (e) { errs.push(`${f}: ${e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e}`); if (opt.stopOnErr) break; } }
  const run = s => vm.runInContext(s, ctx);
  const ev = (o = {}) => Object.assign({ target: Object.assign(mkEl(''), o.target || {}), preventDefault() { }, stopPropagation() { }, repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, o, o.target ? { target: Object.assign(mkEl(''), o.target) } : {});
  return {
    run, errs, log, unknown, store, handlers, els, getEl, ctx,
    click(dataset, extra = {}) { const t = mkEl(extra.id || '', extra.tag || 'BUTTON'); Object.assign(t.dataset, dataset); if (extra.self) t.closest = () => t; const e = { target: t, currentTarget: t, preventDefault() { }, stopPropagation() { } }; for (const f of handlers.doc.click || []) f(e); },
    key(k, o = {}) { const e = { key: k, target: body, repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault() { }, ...o }; for (const f of handlers.win.keydown || []) f(e); for (const f of handlers.doc.keydown || []) f(e); },
    keyup(k) { const e = { key: k, target: body }; for (const f of handlers.win.keyup || []) f(e); },
    // the real render() costs ~0.8 s a frame against the stub GL, so it runs once every opt.renderEvery frames (default 120; 1 = always)
    frame(n = 1, dtMs = 16.7) { for (let i = 0; i < n; i++) { sandbox.__now += dtMs; if (!errs.length || sandbox.__render) { if (!sandbox.__render) { try { run('globalThis.__render=render;globalThis.__norender=function(){}'); } catch (e) { } } sandbox.__fc = (sandbox.__fc || 0) + 1; try { run((sandbox.__fc % (opt.renderEvery || 120) === 0) ? 'render=__render' : 'render=__norender'); } catch (e) { } } const f = sandbox.__raf; sandbox.__raf = null; if (f) { try { f(sandbox.__now); } catch (e) { errs.push("frame: " + (e.stack || e).toString().split(String.fromCharCode(10)).slice(0, 5).join(" | ")); sandbox.__raf = f; } } } },
    timers() { const t = sandbox.__timers || []; sandbox.__timers = []; t.forEach(f => { try { f(); } catch (e) { errs.push('timer: ' + e.message); } }); },
  };
}
module.exports = { boot };
if (require.main === module) { const t0 = Date.now(); const H = boot(); console.log('load ms', Date.now() - t0, 'errors', H.errs.length); H.errs.forEach(e => console.log(' ', e)); console.log('unknown el props', [...H.unknown].join(' ')); console.log('screen', H.errs.length ? '?' : H.run('screenNow()')); console.log(H.log.slice(0, 10).join('\n')); }
