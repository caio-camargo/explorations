// Screenshots of the live page on the real GPU, for judging graphics from the CLI (no app preview pane needed).
// usage: node shot.mjs <url> <outPrefix> <js expr>...  — each expression is evaluated (awaited) in the page, then a PNG
// <outPrefix><i>.png is captured. Inject views.js first to get refView(n), e.g.:
//   node shot.mjs http://localhost:8776/launchpad/index.html out/v_ "(async()=>{const s=document.createElement('script');s.src='views.js';document.head.appendChild(s);await new Promise(r=>s.onload=r)})()" "refView(4)"
// Headless Chrome over CDP (Node 22+ has WebSocket built in); --use-angle=d3d11 keeps it on the real GPU. Console errors are printed.
import {spawn} from 'node:child_process';
const [url,out,...exprs]=process.argv.slice(2), port=9300+Math.floor(Math.random()*500);
const ch=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new',`--remote-debugging-port=${port}`,...(process.env.SHOT_FLAGS?process.env.SHOT_FLAGS.split(' '):['--use-angle=d3d11','--enable-gpu']),'--ignore-gpu-blocklist','--hide-scrollbars','--window-size=1280,800',`--user-data-dir=${process.env.TEMP}/shotprof${port}`,'about:blank'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let tabs;
for(let i=0;i<50;i++){try{tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();if(tabs.find(t=>t.type==='page'))break}catch{}await wait(200)}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map(),logs=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}
  else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')logs.push(m.params.args.map(a=>a.value??a.description).join(' '));
  else if(m.method==='Runtime.exceptionThrown')logs.push('EXC '+m.params.exceptionDetails.exception?.description)};
const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Page.navigate',{url});await wait(4000);
const fs=await import('node:fs');
for(let k=0;k<exprs.length;k++){const r=await cmd('Runtime.evaluate',{expression:exprs[k],awaitPromise:true,returnByValue:true});
  console.log(k,JSON.stringify(r.result?.result?.value??r.result?.exceptionDetails?.exception?.description));await wait(300);
  const s=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${out}${k}.png`,Buffer.from(s.result.data,'base64'))}
if(logs.length)console.log('console errors:',logs.slice(0,10));ws.close();ch.kill();process.exit(0);
