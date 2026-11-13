// apphost.mjs — the whole page, headless (QUEUE R34; from review/2026-11-11/app/harness.cjs, review 2's harness).
// Every script index.html loads, in page order, runs in one node:vm context with stubs for the DOM, storage, timers and
// WebGL, over the real SIM; the app layer (screens, clicks, keys, the frame loop) runs as it does in a browser.
//   import { boot } from './apphost.mjs';
//   const H = boot({ search: '?tester', storage: {}, seed: 1 });   // a fresh page; storage: a localStorage snapshot to
//   load from; seed: Math.random's (default 1, null for unseeded); renderEvery: frames per render() (default 120)
//   H.run('screenNow()'); H.click({ go: 'program' }); H.key('r'); H.keyup('r'); H.frame(60); H.timers(); H.errs
// Used by tests/app.mjs. Platform session, 2026-11-13.
//
// Speed: in a vm context every lookup of a global name (Math, Float32Array, document, and the page's own top-level
// functions) goes through the context's interceptor, which made the page take ~2 minutes to load. So the scripts run
// as ONE function inside the context, with the builtins and the stubs as its parameters: the page's names are that
// function's locals (about 1 s to load). The differences from a browser that follow, and what covers them:
//   - a function declared in a later file is visible at load time here (hoisting spans the files): test platform-1
//     loads the SIM file by file the browser's way, and lint.mjs (platform-12) checks load-time uses of later lets;
//   - a top-level let/const (at column 0) becomes var, so `typeof X` before X's file has run is 'undefined' as in a
//     browser, not a TDZ error (screens.js's go() asks `typeof UNL` while the page loads);
//   - a load-time throw stops the remaining files (a browser runs them): `errs` names the file and line;
//   - `window.x = …` is a property of the stub window, read as bare `x` through the context's global (slow, rare).
// The stub DOM: an element is a plain object with classList, dataset, innerHTML (text only: querySelector finds
// nothing), handlers in `_h`; `unknown` collects element properties the page read that the stub doesn't have.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = new URL('./', import.meta.url);
const read = f => readFileSync(new URL(f, here), 'utf8');
const NL = String.fromCharCode(10);
const BUILTINS = ('Math JSON Object Array Number String Boolean Symbol Date RegExp Error TypeError RangeError SyntaxError ReferenceError ' +
  'Map Set WeakMap WeakSet Promise Reflect Proxy BigInt Intl ArrayBuffer DataView Float32Array Float64Array Int8Array Int16Array ' +
  'Int32Array Uint8Array Uint8ClampedArray Uint16Array Uint32Array Infinity NaN isFinite isNaN parseFloat parseInt ' +
  'encodeURIComponent decodeURIComponent').split(' ');
const STUBS = ('window self globalThis console document localStorage sessionStorage location navigator performance ' +
  'requestAnimationFrame cancelAnimationFrame setTimeout clearTimeout setInterval clearInterval addEventListener ' +
  'removeEventListener innerWidth innerHeight devicePixelRatio confirm alert prompt URLSearchParams URL Blob Image ' +
  'matchMedia getComputedStyle structuredClone Path2D ImageData OffscreenCanvas').split(' ');

// the page's scripts, joined once per process (the text doesn't change during a run)
let PAGE = null;
function page() {
  if (PAGE) return PAGE;
  const html = read('index.html'), files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  const cls0 = {};
  for (const m of html.matchAll(/<[a-z0-9]+\b[^>]*\bid="([^"]+)"[^>]*>/g)) { const c = /\bclass="([^"]*)"/.exec(m[0]); cls0[m[1]] = c ? c[1].split(/\s+/).filter(Boolean) : []; }
  let body = '', line = 3; const at = [];   // at: [first line in the joined text, file]
  for (const f of files) { const t = read(f).replace(/\r\n/g, NL).replace(/^(?:let|const)(?=[ {[])/gm, 'var'); at.push([line, f]); body += t + NL + ';' + NL; line += t.split(NL).length + 1; }
  const src = `(function(${BUILTINS.join(',')}){return function(${STUBS.join(',')}){` + NL + `'use strict';` + NL + body +
    `return {run:s=>eval(s)}}})`;
  PAGE = { files, cls0, at, script: new vm.Script(src, { filename: 'page' }) };
  return PAGE;
}
// "page:1234:5" in a stack → "app/x.js:56:5"
function where(text) {
  const { at } = page();
  return String(text).replace(/page:(\d+)(:\d+)?/g, (m, l, c) => { l = +l; let k = 0; while (k + 1 < at.length && at[k + 1][0] <= l) k++; return `${at[k][1]}:${l - at[k][0] + 1}${c || ''}`; });
}
const firstLines = (e, n) => where(e && e.stack ? e.stack : String(e)).split(NL).slice(0, n).join(' | ');

export function boot(opt = {}) {
  const { cls0, script } = page();
  const unknown = new Set(), log = [], errs = [];
  // the universal stub: callable, any property is itself, 0 as a number, iterates empty (the GL context, audio, canvas 2D)
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
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }), focus() { }, blur() { },
      click() { const ev = { target: e, currentTarget: e, preventDefault() { }, stopPropagation() { } }; if (e.onclick) e.onclick(ev); for (const f of hs.click || []) f(ev); },
      getContext: () => U, toDataURL: () => '', toBlob() { }, play() { }, pause() { },
    };
    return new Proxy(e, { get(t, p) { if (!(p in t) && typeof p === 'string' && !/^on|^_|^@/.test(p)) { if (/^(firstChild|lastChild|firstElementChild|lastElementChild|nextSibling|previousSibling|nextElementSibling|content|parentElement)$/.test(p)) return t[p] = mkEl(''); unknown.add(p); } return t[p]; }, set(t, p, v) { t[p] = v; return true; } });
  }
  const getEl = id => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); };
  const store = new Map(Object.entries(opt.storage || {})), session = new Map();
  const storage = m => ({ getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { if (opt.full) { const x = new Error('quota'); x.name = 'QuotaExceededError'; throw x; } m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, clear: () => m.clear() });
  const body = mkEl('body', 'BODY');
  const sandbox = {
    console: { log: (...a) => log.push(a.join(' ')), warn: (...a) => log.push('WARN ' + a.join(' ')), error: (...a) => log.push('ERR ' + a.join(' ')), info() { }, debug() { } },
    document: { getElementById: getEl, body, documentElement: mkEl('html'), head: mkEl('head'), createElement: t => mkEl('', String(t).toUpperCase()), createElementNS: () => mkEl(''), querySelector: () => null, querySelectorAll: () => [], addEventListener: (t, f) => { (handlers.doc[t] = handlers.doc[t] || []).push(f); }, removeEventListener() { }, hidden: false, fonts: U, activeElement: null, createTextNode: () => mkEl('') },
    localStorage: storage(store), sessionStorage: storage(session),
    location: { search: opt.search || '', href: 'http://x/index.html' + (opt.search || ''), reload() { log.push('RELOAD'); }, replace() { } },
    navigator: { userAgent: 'node', gpu: undefined, language: 'en' }, performance: { now: () => sandbox.__now }, __now: 1000,
    requestAnimationFrame: f => { sandbox.__raf = f; return 1; }, cancelAnimationFrame() { }, setTimeout: f => { (sandbox.__timers = sandbox.__timers || []).push(f); return 1; }, clearTimeout() { }, setInterval: () => 1, clearInterval() { },
    addEventListener: (t, f) => { (handlers.win[t] = handlers.win[t] || []).push(f); }, removeEventListener() { }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    confirm: () => opt.confirm !== false, alert() { }, prompt: () => null, URLSearchParams, URL, Blob: U, Image: U, matchMedia: () => ({ matches: false, addEventListener() { } }), getComputedStyle: () => ({ getPropertyValue: () => '' }),
    structuredClone, Path2D: U, ImageData: U, OffscreenCanvas: U,
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const B = vm.runInContext(`[${BUILTINS.join(',')}]`, ctx);
  // Math.random seeded (opt.seed, default 1; null keeps it random), so a run is the same every time: ignition dice,
  // weather, effects. mulberry32
  if (opt.seed !== null) vm.runInContext(`{let a=${(opt.seed ?? 1) >>> 0};Math.random=()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}`, ctx);
  let api = null;
  try { api = script.runInContext(ctx)(...B)(...STUBS.map(k => sandbox[k])); }
  catch (e) { errs.push('load: ' + firstLines(e, 4)); }
  const run = s => { if (!api) throw new Error('the page did not load: ' + errs[0]); return api.run(s); };
  const ev = (e, o) => Object.assign({ preventDefault() { }, stopPropagation() { }, repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, e, o);
  let fc = 0, render = null;
  return {
    run, errs, log, unknown, store, session, handlers, els, getEl, mkEl, ctx, where,
    // a click anywhere on the page with these data-* values (the page's document click handler reads `dataset`)
    click(dataset, extra = {}) { const t = mkEl(extra.id || '', extra.tag || 'BUTTON'); Object.assign(t.dataset, dataset); if (extra.self) t.closest = () => t; const e = ev({ target: t, currentTarget: t }); for (const f of handlers.doc.click || []) f(e); },
    key(k, o = {}) { const e = ev({ key: k, target: body }, o); for (const f of handlers.win.keydown || []) f(e); for (const f of handlers.doc.keydown || []) f(e); },
    keyup(k) { const e = ev({ key: k, target: body }); for (const f of handlers.win.keyup || []) f(e); },
    // n animation frames of dtMs. render() on the stub GL is the costly part, so it runs every opt.renderEvery frames
    // (default 120; 1 = always); a frame that throws is recorded in errs and the loop keeps its callback
    frame(n = 1, dtMs = 16.7) {
      if (api && !render) { run('globalThis.__render=render;globalThis.__norender=function(){}'); render = true; }
      for (let i = 0; i < n; i++) {
        sandbox.__now += dtMs; fc++;
        if (api) run(fc % (opt.renderEvery || 120) === 0 ? 'render=__render' : 'render=__norender');
        const f = sandbox.__raf; sandbox.__raf = null;
        if (f) try { f(sandbox.__now); } catch (e) { errs.push('frame: ' + firstLines(e, 5)); sandbox.__raf = f; }
      }
    },
    // run the setTimeout callbacks queued so far
    timers() { const t = sandbox.__timers || []; sandbox.__timers = []; for (const f of t) try { f(); } catch (e) { errs.push('timer: ' + firstLines(e, 4)); } },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t0 = Date.now(), H = boot({ search: process.argv[2] || '' });
  console.log('load', Date.now() - t0, 'ms; errors', H.errs.length, H.errs.join(NL), '; screen', H.errs.length ? '?' : H.run('screenNow()'));
}
