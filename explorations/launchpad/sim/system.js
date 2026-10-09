// sim/system.js — the star system on paper: Helios and its planets from SYSTEM.md, as positions, no physics yet (space
// session, QUEUE Q87 slice 1; NOTES § "Plan: the system on rails"). A classic script sharing one global scope with the
// others; index.html loads it after sim/space.js. Names live here only, so a rename (SYSTEM.md: placeholders) is one edit.
'use strict';
// ---- the planets (SYSTEM.md § Overview): a in TU, e, i to the ecliptic (degrees), radius, surface gravity, a map colour.
// Node longitudes, perihelia and phases aren't set by the catalog yet: fixed defaults here (Erebus's 2:1 phasing with
// Hyperion at its aphelion is a later refinement).
const HELIOS_MU=1.17e18,TELLUS_TILT=23*Math.PI/180;   // SYSTEM.md decisions 2 and 3
const SYSTEM_BODIES=[
  {name:'Hesper',a:0.72,e:0.007,i:3.4,lan:76,argp:55,M0:50,R:1210e3,g:8.87,color:'#e8dcb0'},
  {name:'Tellus',a:1,e:0.0167,i:0,lan:0,argp:103,M0:null,R:1274e3,g:9.81,color:'#6f9fd8'},
  {name:'Enyo',a:1.52,e:0.09,i:1.9,lan:49,argp:286,M0:19,R:678e3,g:3.72,color:'#c8643c'},
  {name:'Astraea',a:2.77,e:0.08,i:10.6,lan:80,argp:73,M0:290,R:94e3,g:0.28,color:'#8f8a84'},
  {name:'Hyperion',a:5.2,e:0.05,i:1.3,lan:100,argp:274,M0:20,R:13982e3,g:24.8,color:'#d9bc8c'},
  {name:'Erebus',a:8.25,e:0.2,i:17,lan:110,argp:114,M0:15,R:238e3,g:0.62,color:'#cbbcab'},
];
// the astronomical unit: what makes Tellus's year exactly 400 program days at Helios's mass (SYSTEM.md: ~15.8 Gm)
const TU=()=>Math.cbrt(HELIOS_MU*(YEAR_D*DAY_S/(2*Math.PI))**2);
// the ecliptic in Tellus's frame (its spin axis +Y): tilted 23° to the equator and turned so that on day 0 the real
// direction to Helios is the renderer's fixed SUN_DIR; so the sky and the map agree at the start (the sun moving with the
// year is slice 3). {X, Y, N}: the ecliptic's axes (N its north), and Tellus's longitude on day 0.
let ECL=null;
function eclFrame(){if(ECL)return ECL;const S=SUN_DIR,ce=Math.cos(TELLUS_TILT),se=Math.sin(TELLUS_TILT),h=Math.hypot(S[0],S[2]),u=[S[0]/h,0,S[2]/h],p=[-u[2],0,u[0]];
  // N = cos ε·Y + sin ε·w with w in the equator chosen so N ⟂ S: w·S = -S_y cot ε
  const c=-S[1]*ce/se/h,w=add(mul(u,c),mul(p,Math.sqrt(Math.max(0,1-c*c)))),N=norm(add(mul([0,1,0],ce),mul(w,se))),X=norm(cross([0,1,0],N)),Y=cross(N,X);
  const lamSun=Math.atan2(dot(S,Y),dot(S,X));return ECL={X,Y,N,lamT:lamSun+Math.PI}}
// heliocentric position (m) of a planet at program time T, in Tellus's frame's axes
function helioPos(name,T){const b=SYSTEM_BODIES.find(x=>x.name===name),F=eclFrame(),d=Math.PI/180,a=b.a*TU(),n=Math.sqrt(HELIOS_MU/a**3);
  let M0=b.M0*d;if(b.M0==null){const nu=F.lamT-(b.lan+b.argp)*d,E0=2*Math.atan(Math.sqrt((1-b.e)/(1+b.e))*Math.tan(nu/2));M0=E0-b.e*Math.sin(E0)}   // Tellus: its true longitude on day 0 puts the sun at SUN_DIR
  let M=M0+n*T,E=M;for(let k=0;k<30;k++){const dE=(E-b.e*Math.sin(E)-M)/(1-b.e*Math.cos(E));E-=dE;if(Math.abs(dE)<1e-14)break}
  const x=a*(Math.cos(E)-b.e),y=a*Math.sqrt(1-b.e*b.e)*Math.sin(E),O=b.lan*d,w=b.argp*d,i=b.i*d;
  const cO=Math.cos(O),sO=Math.sin(O),cw=Math.cos(w),sw=Math.sin(w),ci=Math.cos(i),si=Math.sin(i);
  const ex=(cO*cw-sO*sw*ci)*x+(-cO*sw-sO*cw*ci)*y,ey=(sO*cw+cO*sw*ci)*x+(-sO*sw+cO*cw*ci)*y,ez=(sw*si)*x+(cw*si)*y;
  return add(add(mul(F.X,ex),mul(F.Y,ey)),mul(F.N,ez))}
// where a planet (or 'Helios') is seen from Tellus at program time T, in Tellus's frame: what the map draws
const fromTellus=(name,T)=>name==='Helios'?mul(helioPos('Tellus',T),-1):sub(helioPos(name,T),helioPos('Tellus',T));
const planetPeriod=name=>{const b=SYSTEM_BODIES.find(x=>x.name===name);return 2*Math.PI*Math.sqrt((b.a*TU())**3/HELIOS_MU)};   // s
