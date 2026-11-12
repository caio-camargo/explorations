// app/unlock.js — the unlock overlay (flow, QUEUE Q572; PROGRESSION § 3). A classic script sharing one global scope with
// the others; index.html loads it after app/debrief.js. 'use strict';
'use strict';
// Caio: "very visible: you end the mission, they appear as an overlay, *Part unlocked!*, with a picture of the part"; D42: the fanfare
// comes after the flight, each mission and each part by name, one card each. The cards are data (unlockCards, sim/debrief.js): the Debrief shows a flight's once, over the report; missions done between
// flights (PROG.cardQ) show theirs at the desk. One card at a time, any key or a click moves on, Esc closes them all, D
// takes the part to the design table. Never in a flight: only the two rooms call it, and leaving them closes it.
let UNL={q:[],i:0,on:false};
function unlockEl(){let el=$('unlock');if(el)return el;el=document.createElement('div');el.id='unlock';el.className='hidden';
  el.innerHTML='<div class="uc"><div class="uk"></div><canvas class="um" width="448" height="350"></canvas><div class="un"></div><div class="uw"></div><div class="ul"></div><div class="ua"></div><div class="ux"></div></div>';
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.dataset.ugo){unlockToTable(b.dataset.ugo);return}if(b&&b.dataset.uend){unlockClose();return}unlockNext()});
  document.body.appendChild(el);return el}
const UNL_KICK={done:'Mission complete',part:'Part unlocked',room:'A new room',rover:'Rover parts unlocked',mission:'New mission',chapter:'Next chapter'};
function unlockShow(cards){if(!cards||!cards.length)return false;if(UNL.on){UNL.q.push(...cards);unlockRender();return true}
  UNL={q:cards.slice(),i:0,on:true};unlockEl().classList.remove('hidden');unlockRender();return true}
function unlockRender(){const el=unlockEl(),c=UNL.q[UNL.i];if(!c){unlockClose();return}
  const q=s=>el.querySelector(s),n=UNL.q.length,cv=q('.um'),ps=c.parts||[];
  el.querySelector('.uc').className=`uc k-${c.k}`;if(typeof sndUnlock==='function'){try{sndWake();sndUnlock(c.k)}catch(e){}}   // a sound per card
  q('.uk').textContent=(UNL_KICK[c.k]||'Unlocked')+(c.fam?` · ${c.fam.name}, ${c.fam.i+1} of ${c.fam.n}`:'');
  q('.un').textContent=c.name;q('.uw').textContent=c.why||'';
  q('.ul').innerHTML=c.k==='done'?(c.pay!=null?`<span class="up">+${fmtM(c.pay)}</span>`:'')
    :c.k==='mission'?`<span class="dim">On the Missions tab · pays ${fmtM(c.pay)}</span>`
    :c.k==='chapter'?`<span class="dim">${c.done} is done.</span> ${CHAPTERS.find(x=>x.id===c.id).missions.map(id=>{const M=MISSIONS.find(m=>m.id===id);return M?M.name:id}).join(' · ')}`
    :ps.length?'<span class="dim">It arrives unproven: the test stand and its first flights raise its know-how.</span>':'';
  const drawn=ps.length&&typeof pmStart==='function'&&pmStart(cv,ps);if(!drawn&&typeof pmStop==='function')pmStop();cv.classList.toggle('hidden',!drawn);
  q('.ua').innerHTML=(ps.length?`<button data-ugo="${ps[0]}" title="the design table, with the ${tipEsc(PARTS[ps[0]].name.toLowerCase())} in hand">To the design table ▸ [D]</button>`:'')
    +`<button data-uend="1">${UNL.i+1<n?`Skip the rest (${n-UNL.i-1}) [Esc]`:'Close [Esc]'}</button>`;
  q('.ux').textContent=`${UNL.i+1} of ${n} · `+(UNL.i+1<n?'any key: the next':'any key: back')}
function unlockNext(){if(!UNL.on)return;UNL.i++;if(UNL.i>=UNL.q.length)unlockClose();else unlockRender()}
function unlockClose(){if(typeof pmStop==='function')pmStop();UNL={q:[],i:0,on:false};const el=$('unlock');if(el)el.classList.add('hidden')}
function unlockToTable(k){unlockClose();go('assembly');if(screenNow()==='assembly'&&PARTS[k]&&typeof BLD!=='undefined')BLD.grab(k)}
// the keys while it shows: capture phase, ahead of the screens' own (Esc, D, anything else)
addEventListener('keydown',e=>{if(!UNL.on||e.repeat)return;if(['Shift','Control','Alt','Meta'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();
  const c=UNL.q[UNL.i];if(e.key==='Escape')unlockClose();else if((e.key==='d'||e.key==='D')&&c&&c.parts&&c.parts.length)unlockToTable(c.parts[0]);else unlockNext()},true);
// the Debrief's cards, once per flight (the record keeps that they were shown: a reload doesn't show them again)
function unlockDebrief(D){if(!D||D.cardsShown||!D.cards||!D.cards.length)return;D.cardsShown=true;if(HOOK.save)HOOK.save();setTimeout(()=>{if(screenNow()==='debrief'&&debShown===D)unlockShow(D.cards)},450)}
// at the desk: missions done between flights (PROG.cardQ), shown when the Program is up and nothing else is
function unlockDesk(){const Q=PROG.cardQ;if(!Q||!Q.length||UNL.on||screenNow()!=='program'||(typeof progGate!=='undefined'&&progGate))return;
  PROG.cardQ=[];if(HOOK.save)HOOK.save();const C=unlockCards(Q).filter(c=>c.k!=='done');if(C.length)unlockShow(C)}   // (the desk's centred notice still says it was done: Q600)
