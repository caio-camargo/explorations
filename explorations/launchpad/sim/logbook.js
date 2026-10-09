// sim/logbook.js — the logbook and tools gated by it. Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ---- the logbook: what the program has *measured*. Nothing here is given: each fact is filled in by a real flight, with
// who flew it and when, and improved by better flights (the old values kept, struck through in the notebook). Records
// that a design achieved keep the design (and, through the app, the flight's autopilot tape), so a record can be loaded,
// studied and flown again. The builder's hints read from here: until someone reaches orbit, nobody knows what it costs.
const fmtDv=v=>`${Math.round(v).toLocaleString('en-US')} m/s`,fmtAny=(F,v)=>F.fmt(v),fmtKm=v=>`${(v/1e3).toFixed(v<1e5?1:0)} km`;
const LOGF=[
  // getting up
  {id:'space',sec:'Getting up',label:'Δv to leave the atmosphere',fmt:fmtDv,best:'min',design:true,hint:'nobody has been to space yet'},
  {id:'orbit',sec:'Getting up',label:'Δv to low orbit',fmt:fmtDv,best:'min',design:true,hint:'nobody has reached orbit yet'},
  {id:'maxq',sec:'Getting up',label:'Highest dynamic pressure flown through',fmt:v=>`${(v/1000).toFixed(1)} kPa`,best:'max',design:true,hint:'nothing has flown hard yet'},
  // in orbit
  {id:'period',sec:'In orbit',label:'Orbital period',fmt:v=>`${(v.p/60).toFixed(1)} min at ${fmtKm(v.alt)}`,best:'first',hint:'measured on the first orbit'},
  {id:'contact',sec:'In orbit',label:'Best ground contact for a satellite',fmt:v=>`${v.toFixed(0)}% of the time`,best:'max',hint:'no satellite has reported in'},
  // coming back
  {id:'entry',sec:'Coming back',label:'Fastest re-entry survived',fmt:fmtDv,best:'max',design:true,hint:'nothing has come back from space yet'},
  {id:'heat',sec:'Coming back',label:'Hottest skin survived',fmt:v=>`${v.T.toFixed(0)} K (${v.part})`,key:v=>v.T,best:'max',design:true,hint:'nothing has come home hot yet'},
  {id:'paxg',sec:'Coming back',label:'Hardest ride a passenger came home from',fmt:v=>`${v.toFixed(1)} g`,best:'max',design:true,hint:'no passenger has flown yet'},
  {id:'pad',sec:'Coming back',label:'Closest landing to the pad, from space',fmt:fmtKm,best:'min',design:true,hint:'nothing has come back from space yet'},
  // out there
  {id:'apex',sec:'Out there',label:'Farthest from Tellus',fmt:fmtKm,best:'max',design:true,hint:'nothing has flown yet'},
  {id:'selene',sec:'Out there',label:'Δv to reach Selene',fmt:fmtDv,best:'min',design:true,hint:'nobody has been there'},
  {id:'sorbit',sec:'Out there',label:'Orbital period around Selene',fmt:v=>`${(v.p/60).toFixed(1)} min at ${fmtKm(v.alt)}`,best:'first',hint:'measured on the first orbit there'},
  {id:'land',sec:'Out there',label:'Δv to land on Selene',fmt:fmtDv,best:'min',design:true,hint:'nobody has landed there'},
  {id:'sg',sec:'Out there',label:'Surface gravity on Selene',fmt:v=>`${v.toFixed(2)} m/s²`,best:'first',hint:'measured by the first lander'},
  {id:'nyx',sec:'Out there',label:'The second moon, Nyx',fmt:v=>`${(v.m*1e4).toFixed(1)}×10⁻⁴ Tellus masses, ${fmtKm(v.pe)}–${fmtKm(v.ap)} out`,best:'first',hint:'something unexplained in the tracking data'},
  {id:'nyxreach',sec:'Out there',label:'Δv to reach Nyx',fmt:fmtDv,best:'min',design:true,hint:'nobody has been there'},
  {id:'nyxland',sec:'Out there',label:'Δv to land on Nyx',fmt:fmtDv,best:'min',design:true,hint:'nobody has landed there'},
  // on Selene: rover science (R4); n counts readings, so each one updates the line
  {id:'semare',sec:'On Selene',label:'Mare basalt (spectrometer)',fmt:v=>`FeO ${v.FeO.toFixed(1)} ± ${v.se.toFixed(1)} %, TiO₂ ${v.TiO2.toFixed(1)} %, Al₂O₃ ${v.Al2O3.toFixed(0)} % · ${v.n} reading${v.n>1?'s':''}`,key:v=>v.n,best:'max',hint:'no rover has read a dark-plains rock'},
  {id:'sehigh',sec:'On Selene',label:'Highland rock (spectrometer)',fmt:v=>`FeO ${v.FeO.toFixed(1)} ± ${v.se.toFixed(1)} %, TiO₂ ${v.TiO2.toFixed(1)} %, Al₂O₃ ${v.Al2O3.toFixed(0)} % · ${v.n} reading${v.n>1?'s':''}`,key:v=>v.n,best:'max',hint:'no rover has read a bright-uplands rock'},
  {id:'sepano',sec:'On Selene',label:'Best panorama of the surface',fmt:v=>`${(v.q*100).toFixed(0)} % (sun ${v.el.toFixed(0)}° up, on ${v.unit==='mare'?'mare':'highland'})`,key:v=>v.q,best:'max',hint:'no rover camera has sent a panorama home'},
  {id:'secore',sec:'On Selene',label:"Selene's core (seismic network)",fmt:v=>v.hi<Infinity?`radius ${fmtKm(v.lo)}–${fmtKm(v.hi)} · ${v.n} quake${v.n>1?'s':''} located`:`no S-wave shadow yet${v.lo?`: larger than ${fmtKm(v.lo)}`:''} · ${v.n} quake${v.n>1?'s':''} located`,key:v=>v.n,best:'max',hint:'no seismometers on Selene'},
];
function designName(stack){const j=JSON.stringify(stack);for(const k in PRESETS)if(JSON.stringify(PRESETS[k])===j)return k;
  let h=0;for(let i=0;i<j.length;i++)h=(h*31+j.charCodeAt(i))|0;return'Design '+(h>>>0).toString(36).slice(-4).toUpperCase()}
// s may be null for facts that come from the registry (then by names the reporter); F.key picks the number from an object
function logNote(s,id,v,by){const F=LOGF.find(f=>f.id===id),L=(PROG.log=PROG.log||{}),cur=L[id],K=x=>F.key?F.key(x):x;
  if(s&&s.rec&&!(s.rec.dv>=1))return;   // a vessel that spent no Δv was placed, not flown: it measures nothing
  if(cur){if(F.best==='first')return;if(F.best==='min'&&!(K(v)<K(cur.v)-0.5))return;if(F.best==='max'&&!(K(v)>K(cur.v)*1.001+(K(v)>100?1:0.01)))return}
  const e={v,day:PROG.day,flight:PROG.flights+1,by:by||designName(s.stack),hist:cur?[...(cur.hist||[]),cur.v].slice(-3):[]};
  if(F.design&&s)e.stack=JSON.parse(JSON.stringify(s.stack));L[id]=e;if(s&&s.rec)s.rec.newLog.push(id);
  if(F.best!=='max'||!cur)HOOK.news(cur?`Logbook: new best ${F.label.toLowerCase()}, ${F.fmt(v)} (was ${F.fmt(cur.v)})`:`Logbook: first measured ${F.label.toLowerCase()}, ${F.fmt(v)}`,'ok');HOOK.save()}
// Tools unlock with knowledge: the program can only compute what it has measured. Impact prediction needs one flight's
// trajectory data; maneuver planning needs a measured orbit; encounter forecasts need someone to have felt another
// body's pull. (Range safety keeps working underneath: it's the display that's gated, not the safety officer.)
const TOOLS={impact:{fact:'apex',name:'impact prediction'},nodes:{fact:'orbit',name:'maneuver planning'},encounters:{fact:'selene',name:'encounter forecasts'}};
const toolOK=k=>TEST.tools||!!(PROG.log&&PROG.log[TOOLS[k].fact]);   // (tester: every tool)
// the interface ages with the program: a handwritten notebook, then (with something in orbit) a monochrome terminal
const eraOf=()=>PROG.done&&PROG.done.beeper?2:1;
