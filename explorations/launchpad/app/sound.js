// app/sound.js — sound (the SOUND MIX block inside is pure). Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ sound (sound session; open thread 7)
// WebAudio, synthesised (no samples). The listener rides the ship, like the crew: what reaches them through the air
// thins with the air and is left behind past Mach 1; what reaches them through the structure doesn't care. Render-side
// only: it reads SIM state and diffs it frame to frame for events. F4 mutes. test.mjs extracts the mix block below.
// ==== SOUND MIX BEGIN — pure: flight state → layer levels, and an explosion → what reaches the listener
const sndS=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
// st: T thrust (N), pr air density / sea level, M Mach, q dynamic pressure (Pa), v airspeed (m/s), solid share of
// thrust that is solid motors, hot hottest part's T/Tmax, agl height above the ground (m), rcs jets firing
function sndMix(st){const T=Math.max(0,st.T||0),pr=Math.max(0,st.pr||0),M=st.M||0,q=Math.max(0,st.q||0);
  const loud=Math.min(1.2,Math.pow(T/4e6,0.3)),   // Stevens: loudness ~ intensity^0.3; acoustic power ~ thrust (fixed exhaust speed); a 4 MN stage = 1
    airC=Math.sqrt(pr),   // the same source power in thinner air: pressure amplitude ~ sqrt(rho c)
    sup=1-0.8*sndS(0.9,1.3,M),   // past Mach 1 the exhaust's noise can't run forward to the crew
    refl=1+0.4*(1-sndS(0,150,st.agl==null?1e9:st.agl)),   // the pad and the ground throw the roar back up
    air=loud*airC*sup*refl,qn=q/4e4;   // wind full at 40 kPa, past any sane max-q
  return{air,airLp:150+3500*airC*(0.4+0.6*sup),str:T>0?0.18+0.3*loud:0,strLp:110,sub:loud*(0.4+0.6*airC*refl)*0.7,
    crk:air*(0.2+0.8*(st.solid||0)),   // solids crackle (burning aluminium); liquids much less
    wind:Math.min(1,Math.pow(qn,0.6)),windF:Math.min(2400,180+0.5*(st.v||0)),buf:Math.exp(-(((M-1)/0.12)**2))*Math.min(1,qn*2),   // transonic buffet
    hiss:sndS(0.35,0.9,st.hot||0)*Math.min(1,Math.pow(qn,0.3)),rcs:st.rcs?0.3:0}}
// an explosion d metres from the listener; air: the air at the blast (0..1, from HOOK.boom); sz: its size; own: our ship
function sndBoom(d,air,sz,own){const k=Math.min(1,0.45+0.25*Math.sqrt(sz));
  if(own)return{gain:k,delay:0,lp:air>0?900:160};   // our own ship: through the structure too, so heard even in vacuum
  if(!(air>0))return{gain:0,delay:0,lp:0};   // in vacuum nothing carries it
  return{gain:k*Math.sqrt(air)*250/(250+d),delay:d/340,lp:80+900/(1+d/3000)}}   // the air eats the highs with distance; sound is slow
// per-engine voices (QUEUE Q66): each kind of engine burning sings in its own band of noise, centred on its jet's peak
// frequency f ≈ St·U/D (Strouhal 0.2, exhaust ~2.5 km/s, D the nozzle exit's diameter), so a lander's Wren hisses near
// 1 kHz and a 2.5 m Albatross rumbles near 230 Hz. eng: [{key, T, exit}]; air: the airborne level (sndMix's air).
// Up to four voices, the biggest thrust shares first; each one's gain ~ sqrt(its share), so two equal kinds sum to 1.
function sndVoices(eng,air){const by=new Map();let tot=0;
  for(const e of eng||[]){if(!(e.T>0))continue;tot+=e.T;const v=by.get(e.key)||{T:0,exit:e.exit};v.T+=e.T;by.set(e.key,v)}
  if(!(tot>0))return[];
  return[...by.values()].sort((a,b)=>b.T-a.T).slice(0,4).map(v=>({f:Math.min(1600,Math.max(90,0.2*2500/(2*Math.max(v.exit||0.5,0.05)))),g:air*Math.sqrt(v.T/tot)}))}
// ==== SOUND MIX END
const AUD={VOICES:true,ctx:null,on:true,vol:0.7,L:null,ev:{sep:0,ign:0,boom:0,chute:0,touch:0},last:null,ship:null,nOn:0,eng:new Set(),landed:false,chA:0,nBoom:0};
try{AUD.on=localStorage.getItem('launchpad-sound')!=='0'}catch(e){}
function sndNoise(c,kind){const n=c.sampleRate*3,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);let y=0,env=0;
  for(let i=0;i<n;i++){const w=Math.random()*2-1;
    if(kind==='brown'){y=(y+0.02*w)/1.02;d[i]=y*3.5}
    else if(kind==='pop'){if(Math.random()<0.0012)env=0.3+0.7*Math.random();env*=0.992;d[i]=w*env}   // sparse pops, ~3 ms each
    else d[i]=w}
  return b}
function sndInit(){if(AUD.ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const c=AUD.ctx=new AC();
  const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.connect(c.destination);
  AUD.master=c.createGain();AUD.master.gain.value=0;AUD.master.connect(comp);
  AUD.B={white:sndNoise(c,'white'),brown:sndNoise(c,'brown'),pop:sndNoise(c,'pop')};
  const layer=(buf,type,f,Q,to=AUD.master)=>{const s=c.createBufferSource();s.buffer=AUD.B[buf];s.loop=true;const fl=c.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=Q;
    const g=c.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(to);s.start(0,Math.random()*2);return{f:fl,g}};
  const bufG=c.createGain();bufG.connect(AUD.master);const lfo=c.createOscillator(),lfoA=c.createGain();lfo.frequency.value=6.5;lfoA.gain.value=0;lfo.connect(lfoA);lfoA.connect(bufG.gain);lfo.start();
  const sub=c.createGain();sub.gain.value=0;sub.connect(AUD.master);for(const f of[37,52]){const o=c.createOscillator();o.frequency.value=f;const og=c.createGain();og.gain.value=f<40?1:0.5;o.connect(og);og.connect(sub);o.start()}
  AUD.V=[0,1,2,3].map(()=>layer('white','bandpass',400,1.4));   // the engine voices (Q66)
  AUD.L={air:layer('brown','lowpass',2000,0.5),str:layer('brown','lowpass',110,0.7),crk:layer('pop','bandpass',2200,0.6),wind:layer('white','bandpass',400,1.2,bufG),
    hiss:layer('white','highpass',3000,0.5),rcs:layer('white','bandpass',3500,1.5),sub,lfoA}}
function sndWake(){if(!AUD.on)return;sndInit();if(AUD.ctx&&AUD.ctx.state==='suspended')AUD.ctx.resume()}   // browsers start audio only after a gesture
addEventListener('pointerdown',sndWake,true);addEventListener('keydown',e=>{
  if(e.key==='F4'&&!e.repeat){e.preventDefault();AUD.on=!AUD.on;try{localStorage.setItem('launchpad-sound',AUD.on?'1':'0')}catch(_){}HOOK.msg(AUD.on?'Sound on':'Sound off')}sndWake()},true);
// one-shot: a filtered noise burst (cutoff sweeping f0 → f1) plus an optional falling thump, after `delay` s
function sndShot(o){const c=AUD.ctx,t=c.currentTime+(o.delay||0),s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();
  s.buffer=AUD.B[o.noise||'white'];fl.type=o.type||'lowpass';fl.frequency.setValueAtTime(o.f0,t);fl.frequency.exponentialRampToValueAtTime(o.f1||o.f0,t+o.dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(o.gain,t+(o.att||0.005));g.gain.exponentialRampToValueAtTime(1e-4,t+o.dur);
  s.connect(fl);fl.connect(g);g.connect(AUD.master);s.start(t,Math.random()*2,o.dur+0.1);
  if(o.thump){const os=c.createOscillator(),og=c.createGain();os.frequency.setValueAtTime(o.thump,t);os.frequency.exponentialRampToValueAtTime(o.thump*0.4,t+o.dur*0.6);
    og.gain.setValueAtTime(o.gain*0.9,t);og.gain.exponentialRampToValueAtTime(1e-4,t+o.dur*0.6);os.connect(og);og.connect(AUD.master);os.start(t);os.stop(t+o.dur)}}
const SHOT={sep:k=>({f0:500,f1:120,dur:0.35,gain:0.5*k,thump:70}),   // pyros and a decoupler letting go
  ign:solid=>solid?{f0:3000,f1:400,dur:0.5,gain:0.6,thump:55,noise:'white'}:{f0:900,f1:300,dur:0.8,gain:0.4,att:0.08,noise:'brown'},
  chute:k=>({type:'bandpass',f0:600,f1:250,dur:0.6,gain:0.35*k,att:0.03}),touch:k=>({f0:300,f1:90,dur:0.4,gain:Math.min(0.8,0.15+0.08*k),thump:60}),
  boom:b=>({f0:b.lp*1.4,f1:Math.max(40,b.lp*0.25),dur:2.4,gain:b.gain,thump:45,delay:b.delay,noise:'brown',att:0.01})};
function sndState(){const b=S.body,h=len(S.r)-b.R,inAir=b.atm&&h<b.atm,E=S.alive?activeEngines(S):[];let T=0,Ts=0;
  for(const e of E){const t=e.d.thrust*1000*S.throttle;T+=t;if(pfxOf(e.d).prop==='solid')Ts+=t}
  if(S.lesT>0){const les=S.parts.find(p=>p.on&&p.d.kind==='les');if(les){T+=les.d.thrust*1000;Ts+=les.d.thrust*1000}}
  let hot=0;for(const p of S.parts)if(p.on&&p.d.Tmax&&p.T)hot=Math.max(hot,p.T/p.d.Tmax);
  const eng=E.map(e=>({key:e.d.key,T:e.d.thrust*1000*S.throttle,exit:e.d.exit}));
  return{T,engs:eng,solid:T>0?Ts/T:0,pr:inAir?density(b,h)/b.rho0:0,M:S.alive?S.mach||0:0,q:S.alive?S.qdyn||0:0,v:inAir?(S.mach||0)*SND(h):0,hot,
    agl:S.landed?0:groundGap(S),rcs:!!(S.alive&&S.rcsShots&&S.rcsShots.length),eng:new Set(E.map(e=>e.i))}}
// events, by comparing this frame's ship with the last one's (a new ship, a revert or a vessel switch resets quietly)
function sndEvents(st){const on=S.parts.reduce((n,p)=>n+(p.on?1:0),0),fire=(k,o)=>{AUD.ev[k]++;if(AUD.on&&AUD.ctx)sndShot(o)};
  if(AUD.ship!==S){AUD.ship=S;AUD.nOn=on;AUD.eng=st.eng;AUD.landed=S.landed;AUD.chA=S.chuteA||0;return}
  if(S.alive&&on<AUD.nOn)fire('sep',SHOT.sep(Math.min(2,(AUD.nOn-on)/3+0.5)));
  if([...st.eng].some(i=>!AUD.eng.has(i)))fire('ign',SHOT.ign(st.solid>0.5));   // an engine that wasn't burning last frame
  const ch=S.chuteA||0;if(S.alive&&(AUD.chA<1&&ch>=1||AUD.chA<7&&ch>=7))fire('chute',SHOT.chute(ch>=7?1.4:1));
  if(S.alive&&S.landed&&!AUD.landed)fire('touch',SHOT.touch(S.touchV||1));
  AUD.nOn=on;AUD.eng=st.eng;AUD.landed=S.landed;AUD.chA=ch}
function sndBooms(){const me=shipWorld();for(;AUD.nBoom<booms.length;AUD.nBoom++){const bm=booms[AUD.nBoom],w=add(bodyPos(bm.b,simT),fromPF(bm.b,bm.pf,simT)),d=len(sub(w,me));
    const r=sndBoom(d,bm.air,bm.sz,d<60);AUD.ev.boom++;if(r.gain>0.01&&AUD.on&&AUD.ctx)sndShot(SHOT.boom(r))}}
function sndTick(dtR){if(booms.length<AUD.nBoom)AUD.nBoom=booms.length;
  const sc=screenNow(),live=(sc==='flight'||sc==='map')&&S&&!gamePaused(),st=live?sndState():null;
  if(live){sndEvents(st);sndBooms()}else AUD.nBoom=booms.length;
  const m=AUD.last=live?sndMix(st):null;
  if(!AUD.ctx||!AUD.L)return;const c=AUD.ctx,t=c.currentTime,L=AUD.L,set=(p,v,tc=0.08)=>p.setTargetAtTime(v,t,tc);
  set(AUD.master.gain,AUD.on&&!document.hidden&&live?AUD.vol*(sc==='map'?0.35:1):0,0.15);if(!m)return;
  const vo=AUD.VOICES?sndVoices(st.engs,m.air):[];AUD.lastV=vo;
  AUD.V.forEach((v,i)=>{const x=vo[i];set(v.g.gain,x?0.22*x.g:0,0.12);if(x)set(v.f.frequency,x.f,0.2)});
  set(L.air.g.gain,0.55*m.air*(vo.length?0.8:1));set(L.air.f.frequency,m.airLp);set(L.str.g.gain,0.35*m.str);set(L.sub.gain,0.25*m.sub);set(L.crk.g.gain,0.5*m.crk);
  set(L.wind.g.gain,0.4*m.wind,0.2);set(L.wind.f.frequency,m.windF,0.3);set(L.lfoA.gain,0.8*m.buf,0.2);set(L.hiss.g.gain,0.25*m.hiss,0.3);set(L.rcs.g.gain,m.rcs,0.02)}

