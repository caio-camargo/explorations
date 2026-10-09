// The page as one text, the way Node tools have always read it: index.html with its split scripts (sim/*.js, app/*.js)
// put back in order as one <script> block. Platform session, 2026-10-08; NOTES § "The file split".
//   import { pageSource } from './page.mjs';  const html = pageSource();   // was readFileSync('index.html')
import { readFileSync } from 'node:fs';

const here = new URL('./', import.meta.url);
const TAG = /^<script src="((?:sim|app)\/[\w-]+\.js)"><\/script>\r?$/;

// the split scripts in page order
export function pageScripts() {
  return readFileSync(new URL('index.html', here), 'utf8').split('\n').map(l => TAG.exec(l)?.[1]).filter(Boolean);
}

export function pageSource() {
  const lines = readFileSync(new URL('index.html', here), 'utf8').split('\n'), out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!TAG.test(lines[i])) { out.push(lines[i]); continue; }
    const cr = lines[i].endsWith('\r') ? '\r' : '';
    let body = '';
    for (; i < lines.length && TAG.test(lines[i]); i++) body += readFileSync(new URL(TAG.exec(lines[i])[1], here), 'utf8');
    i--;
    out.push('<script>' + cr, ...body.replace(/\n$/, '').split('\n'), '</script>' + cr);   // lines keep their own \r
  }
  return out.join('\n');
}
