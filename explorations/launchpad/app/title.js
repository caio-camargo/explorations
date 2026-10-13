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
  const name=signed?progName():charterName(pick);
  return`<div class="t1">LAUNCHPAD</div><div class="t2">Charter of a space program</div><div class="rule"></div>`
    +`<div class="q">Article 1 · Whose program?</div><div class="why">The country behind the launch site: how the money arrives, what the public wants from you, and what a failure costs.</div>${a1}`
    +`<div class="q">Article 2 · How does it start?</div><div class="why">Who owns it: where the money comes from, and who you answer to.</div>${a2}`
    +`<div class="sign"><div>Signed, for the program:<br><span class="sig">${name}</span><br><span class="dim">Director · ${signed?'day 1':'today'}</span></div>`
    +(signed?`<span class="inforce">In force · ${fmtDate(PROG.day||0)}</span>`:`<button id="bFound" data-start="${pick}">Found the program ▶</button>`)+`</div>`
    +`<div class="seal">${name.replace(/ /g,'<br>')}</div>`}
function renderTitle(){if(!$('ttl'))return;const fresh=needCharter(),b=(a,t,on)=>`<button data-ttl="${a}"${on?' class="on"':''}>${t}</button>`;
  $('ttlMenu').innerHTML=(fresh?'':b('continue',`Continue<small>${fmtDate(PROG.day||0)} · Enter</small>`,true))
    +b('new',fresh?'New program':ttlArm?'Click again: forget this program':'New program',fresh||ttlArm)+b('settings','Settings')+(TEST.on?b('tester','Tester [F2]'):'');
  $('ttlCharter').innerHTML=charterHTML(!fresh);$('ttlCharter').classList.toggle('signed',!fresh)}
function ttlFound(k){chooseStart(k||ttlPick||Object.keys(START)[0]);ttlPick=null;renderProgram();editorChanged();go('program')}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-arch],[data-cstart],[data-start],[data-ttl]');if(!t||!t.closest('#ttl'))return;const ds=t.dataset;
  if(ds.arch!=null){PROG.homeArch=ds.arch||null;RIVALS=raceSchedule();HOOK.save();renderTitle()}
  else if(ds.cstart){ttlPick=ds.cstart;renderTitle()}
  else if(ds.start){ttlFound(ds.start)}
  else if(ds.ttl==='continue')go('program');
  else if(ds.ttl==='new'){if(needCharter())return;if(!ttlArm){ttlArm=true;renderTitle();return}ttlArm=false;resetProgram();renderTitle()}
  else if(ds.ttl==='settings')ovOpen('settings');
  else if(ds.ttl==='tester')ovOpen('tester')});
