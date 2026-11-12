// node B_sound.cjs : the real app/sound.js against a fake WebAudio. A burn, then pause + "Back to the design table",
// then the Rollout on a Steppe pad: which layer gains are still up when the master opens for the rollout?
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..', '..', '..').split(String.fromCharCode(92)).join('/') + '/';
const src = fs.readFileSync(ROOT + 'app/sound.js', 'utf8');
const param = (v = 0) => ({ value: v, target: v, setTargetAtTime(x) { this.target = x; }, setValueAtTime(x) { this.target = x; }, linearRampToValueAtTime() { }, exponentialRampToValueAtTime() { } });
const node = () => ({ gain: param(1), frequency: param(0), Q: param(0), pan: param(0), threshold: param(0), ratio: param(0), connect() { }, start() { }, stop() { }, getChannelData() { return new Float32Array(8); } });
class AC { constructor() { this.sampleRate = 2; this.currentTime = 0; this.state = 'running'; this.destination = node(); } createBuffer() { return node(); } createBufferSource() { return node(); } createBiquadFilter() { return node(); } createGain() { return node(); } createOscillator() { return node(); } createDynamicsCompressor() { return node(); } createStereoPanner() { return node(); } }
const env = { screen: 'flight', paused: false, roll: null };
const burn = { T: 4e6, engs: [{ key: 'alb', T: 4e6, exit: 1.2 }], others: [], vents: [], qh: 0, va: 300, pv: 7000, solid: 0, pr: 0.8, M: 0.8, q: 2.5e4, v: 270, hot: 0, agl: 5000, rcs: false, eng: new Set([1]) };
const run = new Function('window', 'document', 'localStorage', 'addEventListener', 'HOOK', 'booms', 'FXSND', 'VENTS', 'S', 'screenNow', 'gamePaused', 'rollPhase', 'ROLL_DOOR', 'ROLL_S', 'RIG', 'env', 'burn',
  src + `;sndState=()=>burn;sndEvents=()=>{};sndBooms=()=>{};sndFx=()=>{};sndInit();
  const lv=()=>({master:AUD.master.gain.target,air:AUD.L.air.g.gain.target,str:AUD.L.str.g.gain.target,sub:AUD.L.sub.gain.target,wind:AUD.L.wind.g.gain.target,voice0:AUD.V[0].g.gain.target,rollRumble:AUD.RR.g.gain.target});
  const r=x=>JSON.stringify(Object.fromEntries(Object.entries(x).map(([k,v])=>[k,+(+v).toFixed(3)])));
  env.screen='flight';sndTick(.016);console.log('1 burning in flight      ',r(lv()));
  env.paused=true;sndTick(.016);console.log('2 Esc menu open (paused) ',r(lv()));
  env.paused=false;env.screen='assembly';sndTick(.016);console.log('3 back at the design table',r(lv()));
  env.screen='rollout';env.roll={t:3};sndTick(.016);console.log('4 Rollout, Steppe pad    ',r(lv()));
  env.roll={t:60};sndTick(.016);console.log('5 Rollout, 60 s later    ',r(lv()));`);
run({ AudioContext: AC }, { hidden: false }, { getItem: () => null, setItem() { } }, () => { }, { msg() { } }, [], [], [], {}, () => env.screen, () => env.paused, () => env.roll, 100, [7, 5, 1.5], undefined, env, burn);
