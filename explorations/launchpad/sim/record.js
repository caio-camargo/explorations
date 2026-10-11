// sim/record.js — the session recorder's core (QUEUE Q275 = Q225 R1; NOTES § "Plan: record and replay"). Part of index.html's
// script, a classic script sharing one global scope with the others (NOTES § "The file split"). Pure: no DOM, no clock of its
// own (the page sets REC.clock), so test.mjs can record in one SIM instance and replay in another.
// A recording is keyframes, not keystrokes: the save as it changes (a diff at each save), the screens and designs, and each
// flight's tape with its starting conditions and a hash of the vessel at both ends. Only flights re-simulate on replay, and
// tapes already replay bit for bit; the hashes say when one didn't. app/record.js adds the page's events (keys, clicks,
// camera, pacing, the path) and the download.
'use strict';
const REC_V=1,REC={on:false,clock:()=>0,t0:0,game:null,start:null,events:[],last:null,flight:null};
const jclone=o=>JSON.parse(JSON.stringify(o));

// a JSON diff: ops are [path, value] (set) and [path] (delete), paths arrays of keys. Arrays of the same length are diffed
// by index; anything else that changed shape is set whole. jpatch(a, jdiff(a, b)) is b, for JSON values.
function jdiff(a,b,path=[],out=[]){
  if(a===b)return out;
  const obj=x=>x!==null&&typeof x==='object';
  if(!obj(a)||!obj(b)||Array.isArray(a)!==Array.isArray(b)||(Array.isArray(a)&&a.length!==b.length)){out.push([path,jclone(b)]);return out}
  for(const k of Object.keys(a))if(!(k in b))out.push([[...path,k]]);
  for(const k of Object.keys(b))if(!(k in a))out.push([[...path,k],jclone(b[k])]);else jdiff(a[k],b[k],[...path,k],out);
  return out}
function jpatch(o,ops){
  for(const op of ops){const p=op[0];if(!p.length){o=jclone(op[1]);continue}
    let x=o;for(let i=0;i<p.length-1;i++)x=x[p[i]];
    if(op.length===1)delete x[p[p.length-1]];else x[p[p.length-1]]=jclone(op[1])}
  return o}

// a vessel's state, exactly: where it is, how it moves and turns, which parts are on and what they hold
function stateHash(s){return hashStr(JSON.stringify([simT,s.r,s.v,s.q,s.w,!!s.alive,!!s.landed,s.evIdx,s.parts.map(p=>[p.on?1:0,p.res])]))}
const progHash=()=>hashStr(JSON.stringify(PROG));

const recNow=()=>Math.round(REC.clock()-REC.t0);
// start recording: the save as it is now, the page's other stored settings (`store`), and what made it (`game`)
function recStart(store,game){Object.assign(REC,{on:true,t0:REC.clock(),game:{TAPE_V,...game},start:{prog:jclone(PROG),home:HOME,store:store||{}},
  events:[],last:jclone(PROG),flight:null})}
function recEv(k,d){if(REC.on)REC.events.push({t:recNow(),k,...d})}
// the save since the last keyframe, as a diff (called at each save; nothing when nothing changed)
function recProg(){if(!REC.on)return;const now=jclone(PROG),ops=jdiff(REC.last,now);if(ops.length){recEv('prog',{ops});REC.last=now}}
// a flight begins on this tape: where and when, and the vessel as it stands
function recFlightStart(s,tape){if(!REC.on)return;if(REC.flight)recFlightEnd();REC.flight={s,tape};
  recEv('flightStart',{stack:jclone(tape.stack),site:tape.site,fromOrbit:!!tape.fromOrbit,day:PROG.day,simT,orbT0:ORB_T0,hash:stateHash(s)})}
// …and ends: the whole tape (it's small: ~1 KB for an orbit) and the vessel's hash, which a replay must reproduce
function recFlightEv(s,tape){s=s||REC.flight.s;tape=tape||REC.flight.tape;
  return{t:recNow(),k:'flightEnd',tape:{v:tape.v,stack:jclone(tape.stack),site:tape.site,orbT0:tape.orbT0??null,fromOrbit:!!tape.fromOrbit,ops:jclone(tape.ops)},
    simT,hash:stateHash(s),alive:!!s.alive}}
function recFlightEnd(s,tape){if(!REC.on||!REC.flight)return;REC.events.push(recFlightEv(s,tape));REC.flight=null}
function recStop(){if(REC.flight)recFlightEnd();recProg();REC.on=false}
// load a recording's starting save into this SIM the way the page loads a save (app/state.js, after migrateSave): the
// program, then what the SIM derives from it (HOME, the rivals' schedule, the offer board, missing tables). A replay must
// start here, not from a bare Object.assign: a program is more than PROG (platform-5 found HOME and RIVALS).
function recLoad(start){for(const k of Object.keys(PROG))delete PROG[k];Object.assign(PROG,jclone(start.prog));
  HOME=start.home??PROG.home??0;if(PROG.home!=null||PROG.homeArch)RIVALS=raceSchedule();ensureBoard();
  if(!isFinite(PROG.funds))PROG.funds=FUNDS0;if(!isFinite(PROG.day))PROG.day=0;PROG.rel=PROG.rel||{};PROG.op=PROG.op||{}}
// the recording so far; a flight still in the air is closed in the copy (marked open), not in the recording
const recFile=()=>({v:REC_V,game:REC.game,start:REC.start,events:REC.flight?[...REC.events,{...recFlightEv(),open:true}]:REC.events});
// the save at time t of a recording (R3's scrub between flights): the start, then every diff up to t
function recProgAt(file,t){let p=jclone(file.start.prog);for(const e of file.events){if(e.t>t)break;if(e.k==='prog')p=jpatch(p,e.ops)}return p}
