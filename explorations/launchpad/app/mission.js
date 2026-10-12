// app/mission.js — mission control, a room (flow session, QUEUE Q241 R4; NOTES § UI "Plan: real screens", § v1.N).
// A classic script sharing one global scope with the others; index.html loads it after network.js. 'use strict';
'use strict';
// A control room, instrument panels (W14): a wall (clocks, the ground track or the pads' calendar, the pads) over four
// consoles: FLIGHT (everything of ours out there and what it does next: fly it, take a deviated dispatch), NETWORK
// (stations, each craft's link home, coverage), TRAJECTORY (planned burns: hand them to mission control or take them back)
// and DISPATCH (queued launches, ones that need you, the last results). It draws from netModel() (economy's, Q154) and the
// registry, and changes nothing itself: its buttons are the Program's (data-fly, data-mc, data-devtake, data-devlose,
// data-adv), so they do what they did there. Opens with the old Network screen's rule (netOpen: something of ours out there).
let mcPage='track';   // the wall: 'track' (the ground track) or 'pads' (the pads' calendar)
const mcHM=d=>{const f=((d%1)+1)%1,m=Math.floor(f*1440);return`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`},   // a day as a 24-hour clock
  mcIn=d=>d<=0?'now':d<1?`${Math.max(1,Math.round(d*24))} h`:d<YEAR_D?`${Math.round(d)} d`:`${(d/YEAR_D).toFixed(1)} y`,
  mcLamp=(t,c='')=>`<span class="lg ${c}">${t}</span>`,
  mcCon=(name,body,legends)=>`<div class="con"><div class="scr2"><div class="in">${body}</div><div class="scan"></div></div><div class="nm">${name}</div><div class="legends">${legends}</div></div>`;
// ---- watch mode (QUEUE Q43; NOTES economy § "Dispatch — the economy's answers" 5): a dispatched contract you can watch.
// Watch marks it; the clock stops at its launch (upcoming's stop) and it waits half a day there (dispatchTick, WATCH_WAIT).
// Watch now flies it on screen, Let it fly sends it off headless. On screen it's the same procedure with the same seeded
// rolls (watchPlan), so left alone it ends as the headless one would; a control key takes over (input.js: the procedure
// is off), which breaks the dispatch: the rest is a flight of yours, settled as one, with no revert.
const mcDue=x=>x.status==='queued'&&!!x.watch&&(PROG.day||0)>=x.launch-1e-9;
const mcWatchBtns=x=>x.base!=null?'':mcDue(x)?`<button data-dwgo="${x.id}">Watch now</button> <button data-dwfly="${x.id}">Let it fly</button>`
  :`<button data-dwatch="${x.id}" title="${x.watch?'Watching: the clock stops at its launch. Click to let it fly by itself':'Stop the clock at its launch and watch it fly'}">${x.watch?'Watching ✓':'Watch'}</button>`;
function watchStart(id){const D=(PROG.dispatch||[]).find(x=>x.id===id&&x.status==='queued');if(!D)return false;const c=(PROG.active||[]).find(x=>x.id===D.cid);
  const w=watchPlan(D,c);if(!w.ok){HOOK.msg(`Can't watch it: ${w.why}`);return false}
  if(w.site)PROG.site=w.site.id;
  if(S){recFlightEnd(S,recTapeNow());missionEnd(S)}FLEET.length=0;heard.clear();impSpread=null;warpTo=null;player=null;impact=null;pendingDrops.length=0;smoke.length=0;simT=0;debris.forEach(d=>d.mesh.free());debris.length=0;booms.length=0;
  S=newShip(D.stack);recTape=tapeNew(D.stack,S.site);recTape.byProc=true;recFlightStart(S,recTape);HOOK.rebuild();warpIdx=0;physAcc=0;   // as resetShip, with the dispatch's design
  Object.assign(S.rec,{watch:D.id,noRevert:true});S.watchDoom=w.doom;D.status='watching';D.watch=false;
  procStart(S,w.proc,w.target);S.proc.noRelight=w.noRelight;go('flight');cam.dist=Math.max(18,S.len*1.6);
  HOOK.msg(`Watching ${D.title}: ${w.proc.by}'s procedure flies it · any control key takes over (the dispatch is then yours, no revert)`);HOOK.save();return true}
// each frame: where a watched dispatch stands. Left alone to the end it's flown (the contract settles as any flight's,
// when you leave it); lost; or handed to you (you took over, or the procedure stopped). A watched flight no longer on
// screen (you left the pad, or reloaded) goes back on the pad if it never lifted off, else it was yours.
function watchTick(){for(const D of PROG.dispatch||[]){if(D.status!=='watching')continue;const mine=S&&S.rec&&S.rec.watch===D.id&&mode==='flight';
  if(!mine){if(D.lifted){D.status='handed';D.why='the watched flight was left in progress'}else{D.status='queued';D.watch=true}HOOK.save();continue}
  if(S.rec.launched)D.lifted=true;
  if(S.alive&&S.watchDoom&&simT>=S.watchDoom.t)lose(S,S.watchDoom.why,3);
  if(!S.alive){D.status='failed';D.flown=PROG.day;D.why=S.lossWhy||'it was lost';HOOK.news(`Dispatched flight lost: ${D.title}. ${D.why}`,'bad')}
  else if(S.proc&&S.proc.done){const el=elements(S.r,S.v,S.body.mu);D.status='done';D.flown=PROG.day;D.orb={pe:el.pe-S.body.R,ap:el.ap-S.body.R};
    HOOK.news(`Watched: ${D.title} reached ${D.orb.pe/1e3|0}×${D.orb.ap/1e3|0} km; the contract settles when you leave the flight`,'ok')}
  else if(!S.proc){D.status='handed';D.why=S.procDev?S.procDev.why:'you took control';HOOK.news(`${D.title}: ${S.procDev?'the procedure stopped':'you took control'}; the flight is yours (no revert)`,'warn')}
  else continue;HOOK.save()}}
function renderMission(){if(!$('mc'))return;const N=netData(),D=PROG.day||0,T=D*DAY_S,ev=upcoming(),nx=ev[0],sat=id=>(PROG.sats||[]).find(q=>q.id===id);
  $('mcDate').textContent=`${fmtDate(D)} · ${mcHM(D)}`;
  $('mcNext').innerHTML=nx?`<button data-adv="${nx.day}" title="${nx.text}">Wait: ${nx.text.length>38?nx.text.slice(0,36)+'…':nx.text} [N]</button>`:'';
  // the wall: clocks, the big screen, the pads
  const burns=(PROG.sats||[]).filter(q=>q.nodes&&q.nodes[0]&&!q.docked).map(q=>({q,n:q.nodes[0],d:(q.nodes[0].T-T)/DAY_S})).sort((a,b)=>a.d-b.d);
  $('mcClock').innerHTML=`<div class="k">Date</div><div class="v">Y${deskYear(D)} D${deskDay(D)}</div><div class="v">${mcHM(D)}</div>`
    +`<div class="k">Next event</div>`+(nx?`<div class="v">in ${mcIn(nx.day-D)}</div><div class="s">${nx.text}</div>`:'<div class="s">nothing dated</div>')
    +(burns.length?`<div class="k">Next burn</div><div class="v">in ${mcIn(burns[0].d)}</div><div class="s">${burns[0].q.name}</div>`:'')+'<div class="scan"></div>';
  $('mcPads').innerHTML=`<div class="k">Pads</div>`+(N.pads||[]).map(p=>{const b=p.bars.find(x=>x.kind==='dispatch')||p.bars[0],w=p.bars.find(x=>x.kind==='window');
      return`<div class="v">Pad ${p.pad+1} ${b?'<span class="warn">booked</span>':'<span class="ok">free</span>'}</div>`+(b?`<div class="s">${b.title.split(' · ')[0]}<br>${(w||b).to-D<=0?'launching now':`launch in ${mcIn((w||b).to-D)}`}${w?' (window)':''}</div>`:'')}).join('')
    +`<div class="k">Launch site</div><div class="s">${curSite().name}</div><div class="scan"></div>`;
  $('mcWallTabs').innerHTML=[['track','Ground track · Tellus'],['pads',`Pads · next ${NET_DAYS} days`]].map(([k,l])=>`<button data-mcwall="${k}" class="${mcPage===k?'on':''}">${l}</button>`).join('')+'<span class="sp"></span><span class="dim">[W]</span>';
  $('mcTrack').classList.toggle('hidden',mcPage!=='track');$('mcCal').classList.toggle('hidden',mcPage!=='pads');
  if(mcPage==='pads')$('mcCal').innerHTML=netCalHTML(N);else mcTrackDraw();
  // FLIGHT: the fleet, soonest first
  const F=(N.fleet||[]).slice().sort((a,b)=>(a.t??1e9)-(b.t??1e9)),dOf=id=>(PROG.dispatch||[]).find(x=>x.id===id);
  const fRow=f=>{const q=f.id!=null?sat(f.id):null,cr=q&&q.cruise?cruiseNext(q,T):null,x=f.dev!=null?dOf(f.dev):null,due=x&&mcDue(x);
    const next=due?'on the pad, launching: needs you to watch it':cr?cr.text+(cr.days!=null?`, in ${mcIn(cr.days)}`:''):f.next||'';
    const act=f.dev!=null&&/^needs you/.test(f.next)?`<button data-devtake="${f.dev}">Take it</button> <button data-devlose="${f.dev}">Let go</button>`:x&&x.status==='queued'?mcWatchBtns(x):q&&flyable(q)?`<button data-fly="${q.id}">Fly</button>`:'';
    return`<div class="mrow"><div class="hd"><b>${f.name}</b><span>${act}</span></div><div class="dim">${f.kind} · ${f.where}</div><div class="${/needs you/.test(next)?'bad':/adrift|re-enters in|falling|strike/.test(next)?'warn':''}">${next}</div></div>`};
  const devN=devWaiting().length+(PROG.dispatch||[]).filter(mcDue).length,drift=F.some(f=>/adrift|re-enters in/.test(f.next||''));   // (a re-entry after the propellant runs out isn't news)
  const flight=F.length?F.map(fRow).join(''):'<div class="dim">Nothing of ours is out there yet.</div>';
  // NETWORK: stations, links home, coverage
  const L=N.links||[],C=N.cover||[],pc=x=>`${Math.round(100*x)}%`,GS=stationsAll();
  const net=`<div class="dim">${GS.length} station${GS.length>1?'s':''}: ${GS.map(g=>g.name).join(', ')}</div>`
    +(L.length?L.map(l=>`<div class="mrow"><div class="hd"><b>${l.name}</b>${l.now?'<span class="ok">in contact</span>':'<span class="dim">no contact</span>'}</div><div class="dim">${pc(l.share)} of the day${l.share<1?`, gaps up to ${l.gapH.toFixed(1)} h`:''}${l.via.length?` · via ${l.via.join(', ')}`:''}</div>${l.flag?`<div class="bad">${l.flag}</div>`:''}</div>`).join(''):'<div class="dim">No craft in orbit to reach.</div>')
    +(C.length?`<div class="dim" style="margin-top:4px">${C.map(c=>c.low!=null?`Tellus: a low orbit is in view ${pc(c.low)} of the time`:`${c.body}: near side ${pc(c.near)}, far side ${pc(c.far)}`).join('<br>')}</div>`:'');
  const gap=L.reduce((m,l)=>Math.max(m,l.share<1?l.gapH:0),0),netFlag=L.some(l=>l.flag);
  // TRAJECTORY: planned burns, who flies them
  // a burn out of contact can move to the next pass that is in contact (Q196): whole orbits later, the same place in the orbit
  const traj=burns.length?burns.map(({q,n,d})=>{const why=n.mc?'':handOffWhy(q),more=q.nodes.length-1,p=why&&autoAllowed('burn').ok?nodeNextPass(q):null;
      return`<div class="mrow"><b>${q.name}</b> · ${len(n.dv).toFixed(0)} m/s in ${mcIn(d)}${more>0?` <span class="dim">(+${more} more)</span>`:''}<br>`
        +(n.mc?'<span class="ok">mission control flies it</span>':'<span class="warn">yours to fly</span>')
        +(p&&!p.why?` <button data-mcpass="${q.id}" title="The same burn ${p.k} orbit${p.k>1?'s':''} later, at the same place in its orbit${more>0?'; the later burns move with it':''}">Fly at the next contact</button>`
          +`<div class="dim">No station sees it at the burn. Next contact: ${p.k} orbit${p.k>1?'s':''} later (+${mcIn((p.T-n.T)/DAY_S)})${p.st?`, over ${p.st.name}`:''}.</div>`
          :why?`<div class="dim">mission control ${why}</div>`:` <button data-mc="${q.id}">${n.mc?'Take it back':'Hand to mission control'}</button>`)+`</div>`}).join('')
    :'<div class="dim">No burns planned. Plan one in flight, on the map: click the orbit, drag the handles.</div>';
  // DISPATCH: queued launches, ones that need you, the last results
  const DQ=PROG.dispatch||[],q0=DQ.filter(x=>x.status==='queued').sort((a,b)=>a.launch-b.launch),dv=DQ.filter(x=>x.status==='deviated'),
    past=DQ.filter(x=>!['queued','deviated'].includes(x.status)).sort((a,b)=>(b.flown??b.ordered??0)-(a.flown??a.ordered??0)).slice(0,4);
  const disp=(dv.length||q0.length||past.length)?
    dv.map(x=>`<div class="mrow bad">${x.title}: needs you<div>${x.dev&&x.dev.why||'a deviation'} <button data-devtake="${x.id}">Take it</button> <button data-devlose="${x.id}">Let go</button></div></div>`).join('')
    +q0.map(x=>`<div class="mrow${mcDue(x)?' bad':''}"><div class="hd"><span>${x.title}</span><span>${mcWatchBtns(x)}</span></div><div class="dim">${designName(x.stack)||'our design'} · pad ${x.pad+1} · ${mcDue(x)?'launching now':`launch in ${mcIn(x.launch-D)}`}${x.ready!=null&&x.ready<x.launch-0.05&&x.ready<=D?' (waiting for its window)':''}</div>${x.watch&&!mcDue(x)?'<div class="dim">Watching it: the clock stops at its launch.</div>':''}</div>`).join('')
    +(past.length?`<div class="k">Last results</div>`+past.map(x=>`<div class="mrow"><span class="${x.status==='done'?'ok':x.status==='handed'?'':'bad'}">${{done:'flown',failed:'lost',cancelled:'stood down',handed:'handed to you',watching:'on screen'}[x.status]||x.status}</span> ${x.title}${x.why?`<div class="dim">${x.why}</div>`:''}</div>`).join(''):'')
    :'<div class="dim">Nothing dispatched. A contract with a flown procedure can be dispatched from the Program\'s Contracts.</div>';
  $('mcCons').innerHTML=mcCon('Flight',flight,devN?mcLamp('Needs you','red'):drift?mcLamp('Decaying','on'):mcLamp('All nominal','grn'))
    +mcCon('Network',net,netFlag?mcLamp('Burn out of contact','red'):gap>0?mcLamp(`Gap ${gap.toFixed(1)} h`,'on'):L.length?mcLamp('Full contact','grn'):mcLamp('Standing by'))
    +mcCon('Trajectory',traj,burns.some(b=>!b.n.mc)?mcLamp('Yours to fly','on'):burns.length?mcLamp('Handed off','grn'):mcLamp('No burns'))
    +mcCon('Dispatch',disp,dv.length?mcLamp('Needs you','red'):q0.some(mcDue)?mcLamp('Launching','red'):q0.length?mcLamp(`${q0.length} queued`,'on'):mcLamp('Standing by'))}
// ---- the ground track: Tellus as a map (east to the right, the launch site in the middle), our stations' circles where a
// low satellite (300 km) is in view (gsSees, so a mountain's mask shows), and each craft in Tellus orbit with half an
// orbit behind it (dashed) and one and a half ahead
const MC_LOW=3e5;let mcLandC=null,mcRings={k:'',v:[]};
const mcA0=()=>{const u=curSite().u;return Math.atan2(u[2],u[0])},
  mcPF=(lat,a)=>[Math.cos(lat)*Math.cos(a),Math.sin(lat),Math.cos(lat)*Math.sin(a)],
  mcXY=(pf,W,H,a0)=>{const l=len(pf),a=Math.atan2(pf[2],pf[0]);let d=a-a0;d-=2*Math.PI*Math.round(d/(2*Math.PI));return[(.5-d/(2*Math.PI))*W,(.5-Math.asin(clamp(pf[1]/l,-1,1))/Math.PI)*H]};
function mcLand(a0){if(mcLandC&&mcLandC.a0===a0)return mcLandC;const W=360,H=180,c=document.createElement('canvas');c.width=W;c.height=H;c.a0=a0;
  const land=new Uint8Array(W*H),g=c.getContext('2d'),im=g.createImageData(W,H);
  for(let j=0;j<H;j++){const lat=(.5-(j+.5)/H)*Math.PI;for(let i=0;i<W;i++){const G=toGen(mcPF(lat,a0-2*Math.PI*((i+.5)/W-.5))),
    x=Math.floor((Math.atan2(G[2],G[0])/(2*Math.PI)+.5)*WTW)%WTW,y=clamp(Math.floor((Math.asin(clamp(G[1],-1,1))/Math.PI+.5)*WTH),0,WTH-1);land[j*W+i]=WORLD.E[y*WTW+x]>0?1:0}}
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const k=j*W+i;if(!land[k])continue;
    const edge=!land[j*W+(i+1)%W]||!land[j*W+(i+W-1)%W]||j>0&&!land[k-W]||j<H-1&&!land[k+W],o=4*k;
    im.data[o]=edge?47:20;im.data[o+1]=edge?174:70;im.data[o+2]=edge?92:36;im.data[o+3]=255}
  g.putImageData(im,0,0);return mcLandC=c}
// a station's circle: along 36 bearings, how far out (central angle) a satellite at MC_LOW is still in view
function mcRingsOf(){const GS=stationsAll(),k=GS.map(g=>g.name+g.u.join()).join('|');if(mcRings.k===k)return mcRings.v;
  const r=TELLUS.R+MC_LOW,v=GS.map(st=>{const u=norm(st.u),e=norm(cross(Math.abs(u[1])<.9?[0,1,0]:[1,0,0],u)),n=cross(u,e),pts=[];
    for(let b=0;b<36;b++){const t=b/36*2*Math.PI,dir=add(mul(e,Math.cos(t)),mul(n,Math.sin(t)));let lo=0,hi=1.2;
      for(let i=0;i<14;i++){const m=(lo+hi)/2;if(gsSees(st,mul(add(mul(u,Math.cos(m)),mul(dir,Math.sin(m))),r)))lo=m;else hi=m}
      pts.push(add(mul(u,Math.cos(lo)),mul(dir,Math.sin(lo))))}
    return{st,pts}});
  return(mcRings={k,v}).v}
function mcTrackDraw(){const cv=$('mcTrack');if(!cv||cv.classList.contains('hidden'))return;const dpr=Math.min(devicePixelRatio||1,2),cw=cv.clientWidth,ch=cv.clientHeight;if(!cw||!ch)return;
  cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cw,ch);
  const W=Math.min(cw-16,2*(ch-34)),H=W/2,ox=(cw-W)/2,oy=4,a0=mcA0(),T=(PROG.day||0)*DAY_S,xy=pf=>{const[x,y]=mcXY(pf,W,H,a0);return[ox+x,oy+y]};
  g.imageSmoothingEnabled=false;g.drawImage(mcLand(a0),ox,oy,W,H);
  g.strokeStyle='rgba(47,174,92,.35)';g.lineWidth=1;g.beginPath();for(let i=1;i<6;i++){g.moveTo(ox,oy+H*i/6);g.lineTo(ox+W,oy+H*i/6)}for(let i=1;i<12;i++){g.moveTo(ox+W*i/12,oy);g.lineTo(ox+W*i/12,oy+H)}g.stroke();
  const line=(P,dash)=>{g.setLineDash(dash||[]);g.beginPath();let px=null;for(const p of P){const[x,y]=xy(p);if(px===null||Math.abs(x-px)>W/4)g.moveTo(x,y);else g.lineTo(x,y);px=x}g.stroke();g.setLineDash([])};
  g.font='16px VT323, ui-monospace, monospace';g.textBaseline='bottom';
  for(const{st,pts}of mcRingsOf()){g.strokeStyle='rgba(255,181,71,.8)';g.lineWidth=1.3;line([...pts,pts[0]]);const[x,y]=xy(st.u);g.fillStyle='#ffb547';g.fillRect(x-2,y-2,4,4);g.fillText(st.name.toUpperCase(),x+5,y+15)}   // (below the mark: a craft's name goes above)
  const up=satsUp().filter(q=>!q.junk),lk=new Map((netData().links||[]).map(l=>[l.id,l]));let n=0;
  for(const q of up){let P;try{const[r,v]=satAt(q,T),el=elements(r,v,TELLUS.mu);if(!(el.e<1))continue;P=2*Math.PI*Math.sqrt(el.a**3/TELLUS.mu)}catch(e){continue}
    const at=t=>{const[r]=satAt(q,t);return rotY(r,-absTh(t))},back=[],ahead=[];
    for(let i=0;i<=60;i++)back.push(at(T-P/2+i*P/120));for(let i=0;i<=180;i++)ahead.push(at(T+i*P*1.5/180));
    const L=lk.get(q.id),bad=L&&L.flag,c=bad?'255,106,90':'125,255,156';
    g.lineWidth=1.6;g.strokeStyle=`rgba(${c},.45)`;line(back,[6,5]);g.strokeStyle=`rgba(${c},.95)`;line(ahead);
    const[x,y]=xy(ahead[0]);g.fillStyle=bad?'#ff6a5a':'#ffe9a8';g.beginPath();g.arc(x,y,4.5,0,7);g.fill();g.strokeStyle='#000';g.lineWidth=1;g.stroke();
    g.fillText(q.name.toUpperCase()+(L&&!L.now?' · NO CONTACT':''),x+7,y-3);n++}
  g.fillStyle='#7dff9c';g.textBaseline='alphabetic';
  g.fillText((n?`${n} in Tellus orbit · dashed: behind · solid: ahead · rings: stations`:'nothing of ours in Tellus orbit · rings: stations').toUpperCase(),ox+4,oy+H+22)}
document.addEventListener('click',e=>{if(screenNow()!=='mission'||!e.target.closest||!e.target.closest('#mc'))return;const w=e.target.dataset&&e.target.dataset.mcwall;
  if(w){mcPage=w;renderMission();return}
  const ds=e.target.dataset||{},dx=id=>(PROG.dispatch||[]).find(x=>x.id===+id);
  if(ds.dwatch!=null){const x=dx(ds.dwatch);if(x){x.watch=!x.watch;HOOK.save()}renderMission();return}
  if(ds.dwgo!=null){watchStart(+ds.dwgo);return}
  if(ds.dwfly!=null){const x=dx(ds.dwfly);if(x){x.watch=false;dispatchTick();HOOK.save()}renderMission();return}
  const pa=e.target.dataset&&e.target.dataset.mcpass;if(pa!=null){nodeToPass(+pa);HOOK.save();renderMission();return}
  if(e.target.tagName==='BUTTON')setTimeout(()=>{if(screenNow()==='mission')renderMission()},0)});   // the Program's handlers act first; then redraw what changed
addEventListener('resize',()=>{if(screenNow()==='mission')mcTrackDraw()});
