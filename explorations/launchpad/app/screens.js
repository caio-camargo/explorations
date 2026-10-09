// app/screens.js — screens, overlays, keys (go, KEYS, Help). Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ screens, overlays, keys (ui session; NOTES § "UI: screens and navigation")
// One name for where you are. `mode`/`view` are still the state everything reads; go() is the one place that changes them.
let atHQ=false;   // the Program screen: mode stays 'editor' (the ship waits on the pad behind it), atHQ hides the Assembly panels
let atDeb=false,debNext='program',debShown=null,atRoll=false;   // atRoll: the Rollout screen (slice 5), a panel beside the ship on the pad   // the Debrief screen (slice 3): a panel over the pad like Program; debNext: where you were going
const screenNow=()=>mode==='drive'?'rover':mode==='editor'?(atDeb?'debrief':atHQ?'program':atRoll?'rollout':'assembly'):view==='map'?'map':'flight';
function go(s){const from=screenNow();if(s===from)return;
  if((from==='flight'||from==='map')&&s!=='flight'&&s!=='map'&&S){flightLeave(S);   // leaving a flight settles it (PLAYTEST #21)
    const D=S.rec&&S.rec.debrief;   // ...and a flight that flew is debriefed on the way out, once
    if(D&&D!==debShown&&s!=='rover'){debNext=s==='assembly'?'assembly':'program';debShown=D;s='debrief'}else if(s==='debrief')s='assembly'}
  else if(s==='debrief'){if(!DEBRIEF_LAST)return;debShown=DEBRIEF_LAST;debNext=from==='assembly'?'assembly':'program'}   // the last flight's, again
  if(s==='rover'&&from==='program'&&progGate){HOOK.msg('Choose whose program it is, and how it starts');return}
  if(s==='map'&&mode!=='flight')return;
  if(from==='rover')rvLeave();
  if(s==='rollout'&&(mode!=='editor'||BLD.isEmpty(stackDef)))return;   // only from the Assembly, with something on the pad
  atDeb=s==='debrief';atRoll=s==='rollout';
  if(from==='program')newsSeen=0;   // (the Inbox's news are "new" until you leave the Program)
  if(s==='program'){mode='editor';view='flight';atHQ=true;if(BLD.st&&BLD.st.held)BLD.drop();renderProgram()}
  else if(s==='assembly'){if(from==='program'&&progGate){HOOK.msg('Choose whose program it is, and how it starts');return}mode='editor';view='flight';atHQ=false;editorChanged()}
  else if(s==='flight'){mode='flight';view='flight';atHQ=false}
  else if(s==='rover'){mode='drive';view='flight';atHQ=false;rvEnter()}
  else if(s==='rollout'){mode='editor';view='flight';atHQ=false;BLD.drop();renderSites();renderRollout()}
  else if(s==='debrief'){mode='editor';view='flight';atHQ=false;if(BLD.st&&BLD.st.held)BLD.drop();renderDebrief()}
  else if(s==='map'){if(mode!=='flight')return;view='map';cam.focus=0;const el=elements(S.r,S.v,S.body.mu);cam.mDist=clamp(3*Math.max(S.body.R*1.6,isFinite(el.ap)?el.ap:0),TELLUS.R*2,TELLUS.R*133)}
  $('editor').classList.toggle('hidden',mode!=='editor'||atHQ||atDeb||atRoll);$('roll').classList.toggle('hidden',!atRoll);$('prog').classList.toggle('hidden',!atHQ);$('deb').classList.toggle('hidden',!atDeb);$('hud').classList.toggle('hidden',mode!=='flight');$('rover').classList.toggle('hidden',mode!=='drive');
  ovClose('escm');if(!$('help').classList.contains('hidden'))renderHelp();hudLayout()}
// Keys, one table per screen: Help is generated from it, and test.mjs checks every key the handlers read is listed here.
// k: the e.key names (lower case) the handlers match; l: label; d: what it does; go: the screen that key moves to, or act: what
// it calls (the shared handler acts on both). Map shows its own rows, then Flight's.
const KEYS={
  all:[{k:['h'],l:'H',d:'this list'},{k:['f2'],l:'F2',d:'tester menu',tester:true},{k:['f'],l:'F',d:'logbook'},{k:['escape'],l:'Esc',d:'close the top panel · menu'},{k:['f4'],l:'F4',d:'sound on/off'}],
  flight:[{k:[' '],l:'Space',d:'next stage (ignite / decouple / chute) · driving a rover: brake'},{k:['backspace'],l:'Backspace',d:'abort'},
    {k:['shift','control'],l:'Shift / Ctrl',d:'throttle up / down (hold)'},{k:['z','x'],l:'Z / X',d:'full / cut throttle'},
    {k:['w','s','a','d'],l:'W S A D',d:'pitch / yaw · driving a rover: drive and steer'},{k:['q','e'],l:'Q E',d:'roll'},{k:['t'],l:'T',d:'SAS on/off (modes: buttons)'},
    {k:['v'],l:'V',d:'RCS on/off'},{k:['i','k','j','l','u','o'],l:'I K · J L · U O',d:'RCS translate: along the nose · sideways · sideways'},
    {k:[',','.','/'],l:', . /',d:'warp down / up / 1×'},{k:['m'],l:'M',d:'map'},{k:['g'],l:'G',d:'cycle the target'},
    {k:['b'],l:'B',d:'cargo bay doors open/close'},{k:['y'],l:'Y',d:'landing legs down/up'},{k:['[',']'],l:'[ ]',d:'switch to another vessel in this flight, or one of yours within 2.5 km · ] drives a deployed rover (then the next), [ back to the lander'},
    {k:['n','delete'],l:'N · Del',d:'node at next apoapsis · delete node'},{k:['r'],l:'R',d:'revert (after a crash or landing)'},
    {l:'drag · wheel',d:'orbit camera · zoom'},
    {l:'Autopilot',d:'menu → "Save as autopilot"; the next launch of the same design offers ▶ Autopilot (any control key takes over)'}],
  map:[{k:['tab'],l:'Tab',d:'cycle the camera focus between bodies'},{l:'click',d:'place a maneuver node on your orbit · target a satellite'},
    {l:'drag handle',d:'change the node (the further, the faster)'},{k:['c'],l:'C',d:'atlas: biomes → powers → off (point at the ground to read it)'}],
  rollout:[{k:['b'],l:'B',d:'back to Assembly',go:'assembly'},{l:'LAUNCH',d:'the button: checks, then the pad'}],
  debrief:[{k:['p'],l:'P',d:'Program',go:'program'},{k:['b'],l:'B',d:'Assembly: change the design',go:'assembly'},{k:['a'],l:'A',d:'fly the same design again',act:()=>debAgain()}],
  program:[{k:['b'],l:'B',d:'build: go to Assembly',go:'assembly'},{l:'tabs',d:'Inbox holds what needs an answer: decisions with deadlines, contract offers'}],
  assembly:[{k:['p'],l:'P',d:'Program',go:'program'},{l:'click',d:'pick up / place a part'},{l:'Shift+click · Ctrl+click',d:'place a copy · pick up a copy'},
    {l:'right-click',d:'part options · drop the held part'},{k:['x'],l:'X / Shift+X',d:'symmetry'},{k:['c'],l:'C',d:'snap'},
    {k:['r'],l:'R',d:'radial decoupler'},{k:['escape'],l:'Esc',d:'drop the held part · deselect (then: menu)'},
    {k:['delete','backspace'],l:'Del',d:'delete'},{k:['z','y'],l:'Ctrl+Z · Ctrl+Y',d:'undo · redo (Ctrl+Shift+Z too)'},
    {l:'drag · wheel',d:'orbit camera · zoom'},{l:'middle-drag · Shift+wheel',d:'move up / down the rocket'}],
  rover:[{k:['w','s'],l:'W / S',d:'drive forward / back'},{k:['a','d'],l:'A / D',d:'steer (front and rear wheels, opposite ways)'},{k:[' '],l:'Space',d:'brake (stopped, it holds itself)'},
    {k:['r'],l:'R',d:'back to the start, upright'},{k:['p'],l:'P',d:'Program',go:'program'},{l:'drag · wheel',d:'orbit camera · zoom (it swings back behind the rover as it drives)'}]};
const SCREEN_NAME={program:'Program',assembly:'Assembly',flight:'Flight',map:'Map',rover:'Rover yard',debrief:'Debrief',rollout:'Rollout'};
function renderHelp(){const sc=screenNow(),row=r=>`<tr><td>${r.l}</td><td>${r.d}</td></tr>`,
    sec=(t,L)=>`<h3>${t}</h3><table>${L.filter(r=>!r.tester||TEST.on).map(row).join('')}</table>`;
  $('help').innerHTML=`<span class="x" data-ov="help">✕</span><h2>Keys · ${SCREEN_NAME[sc]}</h2>`+(sc==='map'?sec('Map',KEYS.map)+sec('Flight',KEYS.flight):sec(SCREEN_NAME[sc],KEYS[sc]))
    +sec('Everywhere',KEYS.all)+`<div class="sub" style="margin-top:6px">Careful: Ctrl+W closes the tab in most browsers — the page will ask first during a flight.</div>`}
function toggleHelp(){if($('help').classList.contains('hidden'))renderHelp();ovToggle('help')}
// Overlays stack: Esc closes the one opened last. Panels opened by their own buttons (the logbook's) still count.
const OVS=['escm','help','logbook','tester','settings'],OV=[];
const ovOpen=id=>{$(id).classList.remove('hidden');OV.splice(0,OV.length,...OV.filter(x=>x!==id),id);if(id==='escm')renderEsc();if(id==='tester')renderTester();if(id==='settings')renderSettings()},
  ovClose=id=>{$(id).classList.add('hidden');const i=OV.indexOf(id);if(i>=0)OV.splice(i,1);if(id==='escm')escArm=null},
  ovToggle=id=>$(id).classList.contains('hidden')?ovOpen(id):ovClose(id),
  ovTop=()=>[...OV].reverse().find(id=>!$(id).classList.contains('hidden'))||OVS.find(id=>!$(id).classList.contains('hidden'));
// The Esc menu. Leaving a flight that is still going asks twice: the second click is the confirmation.
// It pauses the game (W5, QUEUE Q39): while it's open the frame loop skips the simulation (flight, warp, rover), the mix
// goes quiet and the flight keys do nothing; closing it carries on where it was, at the same warp.
const gamePaused=()=>!$('escm').classList.contains('hidden')||!$('settings').classList.contains('hidden');   // (Settings, opened from it, too)
let escArm=null;
const flying=()=>mode==='flight'&&S&&S.alive&&!S.landed;
let perfOn=false;try{perfOn=localStorage.getItem('launchpad-perf')==='1'}catch(e){}
document.body.classList.toggle('noperf',!perfOn);
function renderEsc(){const fl=mode==='flight',b=(a,t,arm)=>`<button data-esc="${a}"${escArm===a?' class="arm"':''}>${escArm===a?arm:t}</button>`;
  $('escm').innerHTML=`<span class="x" data-ov="escm">✕</span><h2>${SCREEN_NAME[screenNow()]}${['flight','map','rover'].includes(screenNow())?' · paused':''}</h2>`+b('close','Resume  [Esc]')
    +(fl?b('revert','Revert to launch','Click again: this flight is lost')+b('end','End flight: debrief','Click again: this flight ends here')+b('assembly','Back to Assembly','Click again: this flight ends here')+b('tape','Save as autopilot'):'')
    +(['assembly','rover','debrief','rollout'].includes(screenNow())?b('program','Program  [P]'):'')+b('log','Logbook  [F]')+b('keys','Keys  [H]')+b('settings','Settings')+(TEST.on?b('tester','Tester menu  [F2]'):'')}   // (the performance readout moved to Settings, Q42)
document.addEventListener('click',e=>{const d=e.target.dataset||{};
  if(d.ov){ovClose(d.ov);return}
  if(d.go){go(d.go);return}
  const a=d.esc;if(!a)return;
  if((a==='revert'||a==='assembly'||a==='end')&&flying()&&escArm!==a){escArm=a;renderEsc();return}
  ovClose('escm');
  if(a==='revert')$('bRevert').click();else if(a==='assembly')go('assembly');else if(a==='end')go('debrief');else if(a==='tape')$('bSaveTape').click();else if(a==='program')go('program');
  else if(a==='log'){ovClose('help');toggleLog();if(!$('logbook').classList.contains('hidden'))ovOpen('logbook')}else if(a==='keys')toggleHelp();else if(a==='settings')ovOpen('settings');else if(a==='tester')ovOpen('tester')});
// Keys every screen shares. Registered before builder.js's handler, so a part in hand (or selected) keeps Esc for itself.
addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const k=e.key.toLowerCase();
  if(k==='escape'){if(screenNow()==='assembly'&&BLD.st&&(BLD.st.held||BLD.st.sel))return;const t=ovTop();if(t)ovClose(t);else ovOpen('escm')}
  else if(k==='h')toggleHelp();
  else if(k==='f2'&&TEST.on){e.preventDefault();ovToggle('tester')}
  else if(k==='f'){toggleLog();if(!$('logbook').classList.contains('hidden'))ovOpen('logbook');else ovClose('logbook')}
  else{const r=(KEYS[screenNow()]||[]).find(r=>(r.go||r.act)&&r.k.includes(k));if(r)r.go?go(r.go):r.act()}});
// ---- the tester menu (tester session; PLAYTEST #1). Only reachable with ?tester. Flags persist per browser in
// 'launchpad-tester-flags'; the sandbox program lives in 'launchpad-program-tester'. The rules it bends are in the SIM tester block.
const TEST_FLAGS=[['money','Infinite money','funds never drop below '+fmtM(TEST_FUNDS)],['kh','Full know-how and certification','every part flies as if well known; flight safety signs off'],
  ['tools','All tools','impact prediction, maneuver planning, encounter forecasts'],['nofail','No ignition failures',''],['fast','Instant stacking','launches take no preparation days']];
let testArm=null;
const testEpochNow=()=>Math.min(6,...MISSIONS.filter(m=>!PROG.done[m.id]).map(m=>m.ep));
function renderTester(){const el=$('tester');if(!el||!TEST.on)return;const fl=mode==='flight',ep=testEpochNow(),dis=fl?' disabled':'',era=compEra(),
    misOpen=!!(el.querySelector('details.tmis')||{}).open,
    act=(a,t,arm)=>`<button data-test-act="${a}"${testArm===a?' class="arm"':''}>${testArm===a?arm:t}</button>`;
  el.innerHTML=`<span class="x" data-ov="tester">✕</span><h2>Tester</h2><div class="sub">A sandbox program, saved apart from your career. Cheats:</div>`
    +TEST_FLAGS.map(([k,l,d])=>`<label title="${d}"><input type="checkbox" data-test-flag="${k}"${TEST[k]?' checked':''}> ${l}</label>`).join('')
    +`<h3>Epoch</h3><div>${[1,2,3,4,5].map(n=>`<button data-test-ep="${n}"${n===ep?' class="on"':''}${fl?' disabled':''}>${n}</button>`).join('')}</div>`
    +`<div class="sub">Marks every mission of the earlier epochs done, and clears the later ones.</div>`
    +`<h3>World date · ${fmtDate(PROG.day)}</h3><div>${[[1,'+1 day'],[10,'+10 days'],[100,'+100 days'],[YEAR_D,'+1 year']].map(([d,l])=>`<button data-test-day="${d}"${fl?' disabled':''}>${l}</button>`).join('')}</div>`
    +`<div><input type="number" id="testDayIn" min="0" step="1" value="${Math.round(PROG.day)}" style="width:7em"${dis}> <button data-test-act="goto"${dis}>Go to day</button></div>`
    +`<div class="sub">Forward runs every day's rules; back moves only the calendar.</div>`
    +`<h3>Computing era · ${COMP_ERAS[era].name}</h3><div>${COMP_ERAS.map((E,j)=>`<button data-test-era="${j}"${j===era?' class="on"':''}${fl||j<=era?' disabled':''}>${E.name}</button>`).join('')}</div>`
    +`<div class="sub">The date runs on until that era reaches the program.</div>`
    +`<h3>Funds · ${fmtM(PROG.funds)}</h3><div><input type="number" id="testFundsIn" step="1" value="${Math.round(PROG.funds)}" style="width:7em"${dis}> M <button data-test-act="funds"${dis}>Set funds</button></div>`
    +`<div class="sub">Turns infinite money off, so the program can go broke.</div>`
    +`<details class="tmis"${misOpen?' open':''}><summary>Missions · ${MISSIONS.filter(M=>PROG.done[M.id]).length} of ${MISSIONS.length} done</summary>`
    +[...new Set(MISSIONS.map(M=>M.ep))].map(n=>`<div class="sub">Epoch ${n}</div>`+MISSIONS.filter(M=>M.ep===n).map(M=>`<label><input type="checkbox" data-test-mis="${M.id}"${PROG.done[M.id]?' checked':''}${dis}> ${M.name}</label>`).join('')).join('')
    +`</details>`
    +(fl?'<div class="sub">Epoch, date, era, funds and missions wait until the flight is over.</div>':'')
    +`<h3>Go to body</h3><div>${BODY_CAT.map(b=>`<button data-test-body="${b.name}"${dis}>${b.name}</button>`).join('')}</div><div class="sub">SYSTEM.md's bodies drawn alone, placeholder looks (Q79). Esc comes back.</div>`
    +`<h3>Jobs</h3>${act('jobs','Finish every job in progress now')}`
    +`<h3>Sandbox</h3>${act('copy','Copy my career into the sandbox','Click again: the sandbox is replaced')}${act('fresh','Fresh sandbox','Click again: the sandbox is wiped')}<br>`
    +`${act('leave','Leave tester mode')}`}
function testDone(){testTopUp();HOOK.save();renderProgram();renderTester();if(screenNow()==='assembly')editorChanged()}
function testSaveFlags(){try{const f={};for(const[x]of TEST_FLAGS)f[x]=TEST[x];localStorage.setItem('launchpad-tester-flags',JSON.stringify(f))}catch(x){}}
document.addEventListener('change',e=>{const d=e.target.dataset||{};if(!TEST.on)return;
  if(d.testMis){testMission(d.testMis,e.target.checked);testDone();return}
  const k=d.testFlag;if(!k)return;TEST[k]=e.target.checked;testSaveFlags();testDone()});
document.addEventListener('click',e=>{const d=e.target.dataset||{};if(!TEST.on)return;
  if(e.target.id==='testerBadge'){ovToggle('tester');return}
  if(d.testEp){testEpoch(+d.testEp);HOOK.msg(`Tester: epoch ${d.testEp}`);testDone();return}
  if(d.testDay){testAdvance(+d.testDay);testDone();return}
  if(d.testBody){ovClose('tester');bodyViewOpen(d.testBody,1);return}
  if(d.testEra){const ok=testEra(+d.testEra);HOOK.msg(ok?`Tester: ${COMP_ERAS[compEra()].name.toLowerCase()}, ${fmtDate(PROG.day)}`:"Tester: that era doesn't reach this program within 60 years");testDone();return}
  const a=d.testAct;if(!a)return;
  if((a==='copy'||a==='fresh')&&testArm!==a){testArm=a;renderTester();return}testArm=null;
  if(a==='jobs'){testFinishJobs();HOOK.msg('Tester: every job finished');testDone()}
  else if(a==='goto'){if(testGoto($('testDayIn').value))testDone()}
  else if(a==='funds'){if(testFunds($('testFundsIn').value)){testSaveFlags();HOOK.msg(`Tester: funds ${fmtM(PROG.funds)}, infinite money off`);testDone()}}
  else if(a==='copy'||a==='fresh'){try{if(a==='copy')localStorage.setItem(PROG_KEY,localStorage.getItem('launchpad-program-v1')||'null');else localStorage.removeItem(PROG_KEY)}catch(x){}
    HOOK.save=()=>{};location.reload()}   // (no save on the way out: it would write the old sandbox back)
  else if(a==='leave'){const u=new URL(location.href);u.searchParams.delete('tester');location.href=u.href}});
if(TEST.on){$('testerBadge').classList.remove('hidden');testTopUp()}   // (also each frame, and after every menu action)
// ---- the Program screen (slice 2). renderProgram (economy/bodies) still writes one long column into the hidden #program;
// progLayout() sorts its sections into tabs by their heading. A heading it doesn't know goes to "More", so a new section
// is never lost; test.mjs §32 lists any heading that would land there. Add it to progTabOf.
const PROG_TABS=[['inbox','Inbox'],['missions','Missions'],['contracts','Contracts'],['fleet','Fleet'],['world','World'],['industry','Industry'],['company','Company'],['more','More']];
const progTabOf=h=>/^(Whose program|How does the program start)/.test(h)?'gate':/^(Offers|Coming up|News)/.test(h)?'inbox':/^(Contracts|The race)/.test(h)?'contracts':
  /^Epoch/.test(h)?'missions':/^(Ground stations|In orbit|On the surface|Rovers in the field)/.test(h)?'fleet':/^The world/.test(h)?'world':
  /^(Know-how|Test stand|Facilities|Development|Production|What we know|Compute)/.test(h)?'industry':h.startsWith(progName())?'company':'more';
let progTab=null,progGate=false,progInbox=0;   // the tab isn't remembered across reloads: a fresh session opens on the Inbox (or Missions)
function progLayout(){const kids=[...$('program').children];if(!kids.length)return;
  const box={gate:[]};for(const[k]of PROG_TABS)box[k]=[];let cur='more';
  const head=kids.shift();$('progHead').replaceChildren(head);
  {const tp=document.createElement('template');tp.innerHTML=newsHTML();kids.push(...tp.content.children)}   // the news, last in the Inbox (Q99)
  for(const n of kids){if(n.classList.contains('ep'))cur=progTabOf(n.textContent.trim());
    if(n.id==='progReset')box.company.push(n);
    else if(n.querySelector('[data-dk]'))box.inbox.unshift(n);   // a decision with a deadline: first thing you see
    else if(cur==='inbox'&&/^Standing/.test(n.textContent))box.contracts.splice(1,0,n);
    else box[cur].push(n)}
  progGate=box.gate.length>0;progInbox=box.inbox.filter(n=>n.classList.contains('ms')).length;
  const nx=progGate?null:nextStep(),pn=$('progNext');pn.classList.toggle('hidden',!nx);   // what to do next (Q40), above the tabs
  if(nx)pn.innerHTML=`<b>NEXT</b> ${nx.title} <span class="dim">· ${nx.why}</span>${nx.how?` <span class="acc">· try ${nx.how}</span>`:''}<button data-ptab="${nx.tab}">${PROG_TABS.find(t=>t[0]===nx.tab)[1]} ▸</button>`;
  $('bBuild').disabled=progGate;$('bDebLast').classList.toggle('hidden',!DEBRIEF_LAST||progGate);
  const body=$('progBody');body.classList.toggle('gate',progGate);
  if(progGate){$('progTabs').replaceChildren();body.replaceChildren(...box.gate)}
  else{if(!progTab||!box[progTab])progTab=progInbox?'inbox':'missions';
    $('progTabs').innerHTML=PROG_TABS.filter(([k])=>k!=='more'||box.more.length).map(([k,l])=>
      `<button data-ptab="${k}" class="${k===progTab?'on':''}">${l}${k==='inbox'&&progInbox?`<span class="n">${progInbox}</span>`:''}</button>`).join('');
    body.replaceChildren(...box[progTab]);if(!box[progTab].length)body.innerHTML=`<div class="none">${progTab==='inbox'?'Nothing waiting for an answer.':'Nothing here yet.'}</div>`}
  $('hqStrip').innerHTML=`${head.outerHTML}<span class="sp" style="flex:1"></span>${progInbox?`<span class="n">Inbox ${progInbox}</span>`:''}<button data-go="program">← Program [P]</button>`}
{const raw=renderProgram;renderProgram=function(){raw();progLayout()}}
document.addEventListener('click',e=>{const t=e.target.dataset&&e.target.dataset.ptab;if(!t)return;progTab=t;try{localStorage.setItem('launchpad-progtab',t)}catch(x){}renderProgram()});
$('bLog3').onclick=()=>{toggleLog();if(!$('logbook').classList.contains('hidden'))ovOpen('logbook')};


let drag=null,downAt=null,hDrag=null,nDrag=false;
// map: handles (Δv), the node itself (time), or a click on the orbit (place/move the node); otherwise orbit the camera
const toCv=e=>[e.clientX*cv.width/cv.clientWidth,e.clientY*cv.height/cv.clientHeight],near=(a,b,r)=>Math.hypot(a[0]-b[0],a[1]-b[1])<r*Math.min(devicePixelRatio||1,1.5);
function pickOrbit(m){let best=null,bd=1e9;for(const q of mapUI.pick){const d=Math.hypot(q.x-m[0],q.y-m[1]);if(d<bd){bd=d;best=q}}return bd<16*Math.min(devicePixelRatio||1,1.5)?best:null}
cv.addEventListener('mousedown',e=>{drag=[e.clientX,e.clientY];downAt=[e.clientX,e.clientY];
  if(view==='map'&&mode==='flight'){const m=toCv(e),h=mapUI.handles.find(h=>near(m,[h.x,h.y],11));
    if(h&&S.node&&!S.node.burning){hDrag={h,cur:m};drag=null;return}
    if(S.node&&!S.node.burning&&mapUI.node&&near(m,mapUI.node,11)){nDrag=true;drag=null}}});
addEventListener('mouseup',e=>{
  if(!hDrag&&!nDrag&&downAt&&view==='map'&&mode==='flight'&&e.target===cv&&Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])<5){
    const st=(mapUI.sats||[]).find(x=>near(toCv(e),[x.x,x.y],9)),q=st?null:pickOrbit(toCv(e));if(st)setTarget(S.target===st.id?null:st.id);
    if(q&&S.alive&&!S.landed&&!S.node&&!toolOK('nodes'))HOOK.msg(gateMsg('nodes'));
    else if(q&&S.alive&&!S.landed){if(S.node){if(!S.node.burning)S.node.t=q.t}else{S.node={t:q.t,dv:[0,0,0]};HOOK.msg('Node placed — drag its handles')}}}
  drag=null;downAt=null;hDrag=null;nDrag=false});
addEventListener('mousemove',e=>{
  mapUI.mouse=e.target===cv?[e.clientX,e.clientY]:null;   // the atlas readout (terrain session); CSS pixels, the canvas resizes
  if(hDrag){hDrag.cur=toCv(e);return}
  if(nDrag){const q=pickOrbit(toCv(e));if(q&&S.node)S.node.t=q.t;return}
  if(!drag)return;const dx=e.clientX-drag[0],dy=e.clientY-drag[1];drag=[e.clientX,e.clientY];
  if(view==='map'){cam.mYaw-=dx*.005;cam.mPitch=clamp(cam.mPitch+dy*.005,-1.5,1.5)}else{cam.yaw-=dx*.005;cam.pitch=clamp(cam.pitch+dy*.005,-1.45,1.45)}});
cv.addEventListener('wheel',e=>{e.preventDefault();const f=Math.exp(clamp(e.deltaY,-300,300)*.0025);if(view==='map')cam.mDist=clamp(cam.mDist*f,TELLUS.R*.37,TELLUS.R*333);else cam.dist=clamp(cam.dist*f,4,2e5)},{passive:false});

