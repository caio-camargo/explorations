// app/title.js — the title screen and the founding charter, a room (flow session, QUEUE Q241 R3; NOTES § UI "Plan: real
// screens", mock-up mockups/screens/?s=title). A classic script sharing one global scope with the others; index.html loads
// it after desk.js. 'use strict';
'use strict';
// The page opens here. A night pad, dimmed, with the menu at the left (Continue, New program, Settings, Tester) and the
// program's charter on it. A new career fills the charter in: Article 1 whose program (the power's archetype), Article 2
// how it starts (START), then signs it (Found the program: chooseStart, then the desk). A career already under way shows its
// charter signed and in force, and Continue (Enter) goes straight to the desk: the charter is never asked twice. This
// replaces the first-run gate that sat in the Program's folder (Q41, Q269); its handlers (data-arch, data-start) live here.
let ttlPick=null,ttlArm=false;   // the start ticked on Article 2 (null: the first); New program armed (a second click resets)
const needCharter=()=>!own().chosen&&!PROG.flights;   // a career not founded yet: the desk waits for the charter
const charterName=k=>{const H=POWERS[HOME];return k==='company'?`${H.root} Aerospace`:k==='consortium'?'Joint Space Organisation':`${H.root} Space Agency`};   // progName's rule, before the program exists
// the charter: open to fill (signed=false) or as signed (the career's own choices, ticked, nothing to click)
function charterHTML(signed){const o=own(),kinds=Object.keys(START),pick=signed?o.kind:(ttlPick&&START[ttlPick]?ttlPick:kinds[0]),arch=PROG.homeArch||'';
  const opt=(on,attr,name,blurb)=>signed?`<div class="opt${on?' on':''}"><span class="bx"></span><span><b>${name}</b> — ${blurb}</span></div>`
    :`<button class="opt${on?' on':''}" ${attr}><span class="bx"></span><span><b>${name}</b> — ${blurb}</span></button>`;
  const a1=[['',`Random world`,`whatever the launch site's power was generated as: a ${ARCH[POWERS[0].arch].name.toLowerCase()} this time.`],...Object.entries(ARCH).map(([k,v])=>[k,v.name,v.blurb])]
    .map(([k,n,b])=>opt(arch===k,`data-arch="${k}"`,n,b)).join('');
  const a2=kinds.map(k=>opt(pick===k,`data-cstart="${k}"`,`${START[k].name} · ${fmtM(START[k].funds)}`,START[k].blurb)).join('');
  const a3=Object.entries(LEVELS).map(([k,v])=>opt(lvlKey()===k,`data-lvl="${k}"`,v.name,v.d)).join('');   // (Q476, D25)
  const name=signed?progName():charterName(pick);
  return`<div class="t1">LAUNCHPAD</div><div class="t2">Charter of a space program</div><div class="rule"></div>`
    +`<div class="q">Article 1 · Whose program?</div><div class="why">The country behind the launch site: how the money arrives, what the public wants from you, and what a failure costs.</div>${a1}`
    +`<div class="q">Article 2 · How does it start?</div><div class="why">Who owns it: where the money comes from, and who you answer to.</div>${a2}`
    +`<div class="q">Article 3 · How hard?</div><div class="why">How much the engines and the air forgive. Changeable later in Settings; a record or an autopilot keeps the level it was flown on.</div>${a3}`
    +`<div class="sign"><div>Signed, for the program:<br><span class="sig">${name}</span><br><span class="dim">Director · ${signed?'day 1':'today'}</span></div>`
    +(signed?`<span class="inforce">In force · ${fmtDate(PROG.day||0)}</span>`:`<button id="bFound" data-start="${pick}">Found the program ▶</button>`)+`</div>`
    +`<div class="seal">${name.replace(/ /g,'<br>')}</div>`}
// Chapter starts (QA, QUEUE Q571; PROGRESSION.md § 6): the menu's "Start at" line opens a program in the middle of the game,
// played there by career.mjs's scripted player (chapters.mjs writes starts/<id>.js, loaded when picked). It goes into its
// own slot (PROG_SLOT, app/state.js), the career untouched; "Back to your career" opens that again. In tester mode it
// replaces the tester's program instead, flags and all. The library (designs) and the level come along.
const CHAPTER_STARTS=[{id:'orbit',name:'First orbit done'},{id:'station',name:'First station up'},{id:'selene',name:'Landed on Selene'}];
function chapterStart(id){const c=CHAPTER_STARTS.find(x=>x.id===id);if(!c)return false;
  const put=()=>{const C=(window.CHAPTER_SAVES||{})[id];if(!C){HOOK.msg(`The "${c.name}" start didn't load`);return}
    const j=JSON.parse(JSON.stringify(C.save));for(const k in PROG_SCHEMA){const kp=PROG_SCHEMA[k][1];if((kp==='library'||kp==='pref')&&PROG[k]!==undefined)j[k]=progClone(PROG[k])}
    try{localStorage.setItem(TEST.on?PROG_KEY:CHAPTER_KEY,JSON.stringify(j));if(!TEST.on)localStorage.setItem('launchpad-slot','chapter')}
    catch(e){HOOK.msg("The browser wouldn't store the start");return}
    HOOK.save=()=>{};location.reload()};   // (no save on the way out: it would write this program over the start)
  if((window.CHAPTER_SAVES||{})[id])put();else{const s=document.createElement('script');s.src=`starts/${id}.js`;s.onload=put;s.onerror=()=>HOOK.msg(`The "${c.name}" start is missing`);document.head.appendChild(s)}
  return true}
function chapterLeave(){HOOK.save();try{localStorage.setItem('launchpad-slot','career')}catch(e){}HOOK.save=()=>{};location.reload()}
function renderTitle(){if(!$('ttl'))return;const fresh=needCharter(),b=(a,t,on)=>`<button data-ttl="${a}"${on?' class="on"':''}>${t}</button>`;
  const ch=PROG_SLOT&&!TEST.on,at=`<div class="ttlAt"><small>Start at</small>${CHAPTER_STARTS.map(c=>`<button data-chapter="${c.id}">${c.name}</button>`).join('')}</div>`;
  $('ttlMenu').innerHTML=(fresh?'':b('continue',`Continue<small>${fmtDate(PROG.day||0)}${ch?' · a chapter start':''} · Enter</small>`,true))
    +(ch?b('career','Back to your career'):b('new',fresh?'New program':ttlArm?'Click again: forget this program':'New program',fresh||ttlArm))+at+b('settings','Settings')+(TEST.on?b('tester','Tester [F2]'):'');
  $('ttlCharter').innerHTML=charterHTML(!fresh);$('ttlCharter').classList.toggle('signed',!fresh)}
function ttlFound(k){chooseStart(k||ttlPick||Object.keys(START)[0]);ttlPick=null;renderProgram();editorChanged();go('program')}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-arch],[data-cstart],[data-lvl],[data-start],[data-ttl],[data-chapter]');if(!t||!t.closest('#ttl'))return;const ds=t.dataset;
  if(ds.lvl){setLevel(ds.lvl);renderTitle()}
  else if(ds.arch!=null){PROG.homeArch=ds.arch||null;RIVALS=raceSchedule();HOOK.save();renderTitle()}
  else if(ds.cstart){ttlPick=ds.cstart;renderTitle()}
  else if(ds.start){ttlFound(ds.start)}
  else if(ds.chapter)chapterStart(ds.chapter);
  else if(ds.ttl==='career')chapterLeave();
  else if(ds.ttl==='continue')go('program');
  else if(ds.ttl==='new'){if(needCharter())return;if(!ttlArm){ttlArm=true;renderTitle();return}ttlArm=false;resetProgram();renderTitle()}
  else if(ds.ttl==='settings')ovOpen('settings');
  else if(ds.ttl==='tester')ovOpen('tester')});
