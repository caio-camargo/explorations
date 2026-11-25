// sim/views.js — what a satellite's parts see (vehicle, QUEUE Q620, bench slice 4; D47 point 2; notes/vehicle.md § "Plan:
// the bench as its own builder" § 3–5). Part of index.html's script, a classic script inside the SIM block: no DOM, no GL.
//
// A part's view is one field on its definition, view: {need, cone (half-angle, degrees), strict, back}. The needs: ground
// (a camera), power (solar cells and wings), plume and thrust (a thruster's and a motor's exhaust, which goes out the back:
// their rows are slice 5's); home, sun, dark and cold arrive with their parts (Q338's dish and sensors, Q423's radiators).
// Two questions, both in closed form so the tests answer them without a screen:
//  - what blocks a part's cone: its axis and three rings of rays (8, 14, 20) against the craft's solids, a frame as its
//    prism and every other part as its bounding cylinder on its pose. Each ring is weighted by the share of the cone it
//    stands for, so a slab over half a cone reads 50 % (the mock-up counted rays equally, which over-weights the middle);
//  - what it sees over an orbit, for the attitude the design declares (`att`: ground, sun or spin; § 5): attEnv gives the
//    ground, the sun and the way of travel in the craft's own axes at 72 points round the orbit (16 × 24 spinning).
// Before Q338 nothing in flight reads any of this: no contract checks where a camera points (imaging asks only that a
// satellite with a camera passes within 30° of overhead, sim/space.js satTick), and a registered satellite keeps the turn
// it had relative to its orbit (satSpin). The bench's rows are promises about the declared attitude; Q338's law replaces
// attEnv's inside and keeps the rows.
const VIEW_PARTS={cam:{need:'ground',cone:30},scam:{need:'ground',cone:30},bpanel:{need:'power',cone:60},wpanel:{need:'power',cone:60},
  hthr:{need:'plume',cone:20,back:true},apogee:{need:'thrust',cone:15,back:true},kick30:{need:'thrust',cone:15,back:true},kick80:{need:'thrust',cone:15,back:true},kick200:{need:'thrust',cone:15,back:true}};
for(const k in VIEW_PARTS)if(PARTS[k])PARTS[k].view=VIEW_PARTS[k];
const VIEW_ATT=['ground','sun','spin'],VIEW_WANT={ground:'the ground',power:'the sun',plume:'a clear path',thrust:'a clear path'};
const viewAtt=d=>VIEW_ATT.includes(d&&d.att)?d.att:'ground';   // a design's declared attitude: ground-facing unless it says otherwise
// ---- the rays of a cone: the axis and three rings, each ray with its weight (the solid angle its ring stands for, shared);
// the outer rings turned half a step so that no ray but the axis lies on a line across the cone
const VIEW_RINGS=[[.34,8],[.67,14],[.97,20]],VIEW_RAYS=1+8+14+20;
function coneRays(bore,half){const a=Math.abs(bore[1])<.9?[0,1,0]:[1,0,0],e1=norm(cross(bore,a)),e2=cross(bore,e1),cap=x=>1-Math.cos(x*half);
  const edges=[0,.17,.505,.82,1],out=[{d:bore.slice(),w:cap(edges[1])/cap(1),ring:0}];
  VIEW_RINGS.forEach(([f,n],i)=>{const al=half*f,w=(cap(edges[i+2])-cap(edges[i+1]))/cap(1)/n;
    for(let k=0;k<n;k++){const ph=(k+(i===1?0:.5))/n*2*Math.PI;out.push({d:add(add(mul(bore,Math.cos(al)),mul(e1,Math.sin(al)*Math.cos(ph))),mul(e2,Math.sin(al)*Math.sin(ph))),w,ring:i+1})}});
  return out}
// ---- the craft's solids (vessel coordinates): a sized frame as its prism, every other part as its bounding cylinder on its
// pose (base B, axis A, radius r, length h). `state` is 'deployed' today (point 3, stowed and deployed, reads the other).
// Not solids: a deployed wing's paddles and a boom's rod (only their stubs), a fairing, an adapter
function viewSolids(s,state='deployed'){const out=[];
  for(const p of s.parts){if(!p.on||p.profF||isAdapter(p.d))continue;const d=p.d;
    if(d.kind==='frame'&&d.fr){out.push({p,frame:frameGeo(d),o:[p.pos[0],p.y0,p.pos[2]]});continue}
    const C=viewCyl(p);if(C)out.push({p,...C})}
  return out}
function viewCyl(p){const d=p.d,r=Math.max(0.01,d.r||0.05),h=d.h||0.05;
  if(p.pose){const sf=p.pose.sf,o=sf?(d.off||0):0;return{B:add(p.pose.f,qrot(p.pose.q,[o,sf?-h/2:0,0])),A:qrot(p.pose.q,[0,1,0]),r,h}}
  const so=d.off&&p.phi!=null?d.off:0;return{B:[p.pos[0]+so*Math.cos(p.phi||0),p.y0,p.pos[2]+so*Math.sin(p.phi||0)],A:[0,1,0],r,h}}
// a ray against a finite cylinder (side and both ends): the distance along it, or Infinity
function rayCyl(o,d,C){const w=sub(o,C.B),da=dot(d,C.A),wa=dot(w,C.A),dp=sub(d,mul(C.A,da)),wp=sub(w,mul(C.A,wa)),a=dot(dp,dp),b=2*dot(dp,wp),c=dot(wp,wp)-C.r*C.r;let t=Infinity;
  if(a>1e-12){const D=b*b-4*a*c;if(D>=0){const q=Math.sqrt(D);for(const x of[(-b-q)/(2*a),(-b+q)/(2*a)])if(x>1e-6&&x<t){const y=wa+x*da;if(y>=0&&y<=C.h)t=x}}}
  if(Math.abs(da)>1e-12)for(const y of[0,C.h]){const x=(y-wa)/da;if(x>1e-6&&x<t){const q=add(wp,mul(dp,x));if(dot(q,q)<=C.r*C.r)t=x}}
  return t}
function raySolid(o,d,S){if(S.frame){const h=frameRay(S.frame,sub(o,S.o),d);return h?h.t:Infinity}return rayCyl(o,d,S)}
// the first solid along a ray, other than the part it starts from: {S, t} or null
function viewHit(o,d,solids,self,far=Infinity){let best=null,bt=far;for(const S of solids){if(S.p===self)continue;const t=raySolid(o,d,S);if(t<bt){bt=t;best=S}}return best?{S:best,t:bt}:null}
// where a part looks from and which way: the boresight (partAxis; the exhaust's way, back, for an engine) from the middle of
// the face it looks out of (a stack part's top or bottom end, a surface part's outer side, a wing's panels), a centimetre out
function viewEye(p){const v=p.d.view,ax=partAxis(p),bore=v&&v.back?mul(ax,-1):ax,C=viewCyl(p);let e;
  if(p.d.wing)e=add(add(C.B,mul(C.A,C.h/2)),mul(bore,0.6+(p.d.span||0)/2));   // a wing's panels, out on their boom (gl.js draws them 0.6 m out)
  else if(p.pose&&p.pose.sf||!p.pose&&p.d.surf&&p.phi!=null)e=add(add(C.B,mul(C.A,C.h/2)),mul(bore,C.r));
  else e=add(C.B,mul(C.A,v&&v.back?0:C.h));
  return{e:add(e,mul(bore,0.01)),bore}}
// ---- the ground, the sun and the way of travel in the craft's own axes, for a declared attitude (plan § 5): ground-facing,
// the bottom toward the ground and +X leading; sun-facing, the top toward the sun; spinning about its long axis held across
// the orbit. The sun stands beta off the orbit's plane (20° unless asked); the ground fills asin(R/r) about straight down
// and hides the sun behind it. where: {body, alt, beta}, a 300 km orbit of Tellus by default. th: turns round the orbit
// from noon; ps: turns of the spin
const VIEW_BETA=20*Math.PI/180,VIEW_ALT=300e3;
function attEnv(att,th,ps=0,where={}){const b=where.body||TELLUS,B=where.beta!=null?where.beta:VIEW_BETA,gr=Math.asin(b.R/(b.R+(where.alt||VIEW_ALT))),c=Math.cos,s=Math.sin;
  th*=2*Math.PI;ps*=2*Math.PI;let g,sn,v;
  if(att==='sun'){sn=[0,1,0];const e2=[0,c(B),-s(B)];g=add([-s(th),0,0],mul(e2,-c(th)));v=add([-c(th),0,0],mul(e2,s(th)))}
  else if(att==='spin'){g=[-c(th),0,-s(th)];v=[s(th),0,-c(th)];sn=[c(B),s(B),0];const R=x=>rotY(x,ps);g=R(g);v=R(v);sn=R(sn)}
  else{g=[0,-1,0];v=[1,0,0];sn=[c(B)*s(th),c(B)*c(th),s(B)]}
  return{g,s:sn,v,lit:dot(sn,g)<c(gr),gr}}
const VIEW_SMP=new Map();
function attSamples(att,where={}){const key=att+'|'+(where.body?where.body.name:'')+'|'+(where.alt||'')+'|'+(where.beta??'');let S=VIEW_SMP.get(key);if(S)return S;
  const nt=att==='spin'?16:72,np=att==='spin'?24:1;S=[];for(let i=0;i<nt;i++)for(let j=0;j<np;j++)S.push(attEnv(att,(i+.5)/nt,j/np,where));VIEW_SMP.set(key,S);return S}
// Power: a patch of body cells gives the cosine of the sun on its face (flight's powSun gives every patch the same average
// share, SOL_BODY, whatever the attitude); a wing turns about its arm to face the sun as well as that allows, as in flight
// ---- one part's view: the share of its cone blocked (by what, and which rays), and what it sees over the orbit.
// {need, blocked, by: [[name, share]...] most first, rays: [{d, hit (a point or null), S}], g (share of the orbit the
// ground is in its cone), lit (share of the orbit in sunlight), pw (power as a share of full sun round the orbit),
// shade (the share of its sunlit time that something shades it), st: ok | warn | bad, line, fix}
const viewName=p=>p.d.kind==='frame'?'the frame':p.d.name.replace(/ \(.*\)$/,'');
function viewOf(p,solids,att,where={}){const v=p.d.view;if(!v)return null;const{e,bore}=viewEye(p),half=v.cone*Math.PI/180,plume=v.need==='plume'||v.need==='thrust',far=plume?viewPlume(p):Infinity;
  const ev={p,need:v.need,eye:e,bore,half,far,rays:[],blocked:0,by:[]},by=new Map();
  for(const R of coneRays(bore,half)){const h=viewHit(e,R.d,solids,p,far);ev.rays.push({d:R.d,ring:R.ring,hit:h?add(e,mul(R.d,h.t)):null,S:h?h.S:null});
    if(h){ev.blocked+=R.w;by.set(h.S.p,(by.get(h.S.p)||0)+R.w)}}
  ev.blocked=Math.min(1,ev.blocked);ev.by=[...by].sort((a,b)=>b[1]-a[1]).map(([q,w])=>[viewName(q),w,q]);
  const S=attSamples(att,where),cc=Math.cos(half),sb=new Map();let nG=0,nL=0,pw=0,sh=0;
  for(const x of S){if(dot(bore,x.g)>=cc)nG++;if(!x.lit)continue;nL++;
    if(v.need==='power'){const c=dot(bore,x.s),f=p.d.wing?SOL_WING*Math.sqrt(Math.max(0,1-c*c)):Math.max(0,c);if(f<=0)continue;const h=viewHit(e,x.s,solids,p);if(h){sh++;sb.set(h.S.p,(sb.get(h.S.p)||0)+1);continue}pw+=f}}
  ev.g=nG/S.length;ev.lit=nL/S.length;ev.pw=pw/S.length;ev.shade=nL?sh/nL:0;ev.shBy=sb.size?viewName([...sb].sort((a,b)=>b[1]-a[1])[0][0]):'';viewJudge(ev,v);return ev}
// how far a plume reaches for the blocking test: longer with more thrust (88 N of thrusters 1.1 m, 440 N 1.5 m, a 6 kN motor 2.2 m)
const viewPlume=p=>clamp(0.5+0.6*Math.log10(1+(p.d.thrust||0)*100),0.5,3);
const vPct=x=>Math.round(x*100)+' %';
function viewJudge(ev,v){const B=ev.blocked,who=ev.by.length?ev.by[0][0]:'',set=(st,line,fix='')=>{ev.st=st;ev.line=line;ev.fix=fix};
  const blk=()=>`${vPct(Math.max(B,.01))} blocked by ${who}`;
  if(ev.need==='ground'){if(ev.g===0)set('bad','never sees the ground','tilt it toward the ground, or declare another attitude');
    else if(B>0)set(v.strict||B>.5?'bad':'warn',blk(),'move one of them, or tilt it clear');
    else if(ev.g<1)set('warn',`sees the ground ${vPct(ev.g)} of the orbit`,'another attitude would keep it there');
    else set('ok','sees the ground all the way round')}
  else if(ev.need==='power'){const t=`${vPct(ev.pw)} of full sun round the orbit`+(ev.shade>0?`, ${vPct(Math.max(ev.shade,.01))} of its daylight shaded by ${ev.shBy}`:'');
    set(ev.pw<.05?'bad':ev.pw<.15||ev.shade>0?'warn':'ok',t,ev.pw<.15?'face it to the sun':ev.shade>0?'move it clear of the shade':'')}
  else set(B>0?'bad':'ok',B>0?`its plume hits ${who}`:'its plume is clear',B>0?'move one of them, or tilt it clear':'')}
// ---- every part's view on a craft (a newShip of a payload design): {att, solids, list}. The bench keeps it and, while a
// part is dragged, redoes only that part's row and the column of rays that might meet it (viewsAgain)
function viewsOf(s,att='ground',where={}){const solids=viewSolids(s),list=[];for(const p of s.parts)if(p.on&&p.d.view){const ev=viewOf(p,solids,att,where);if(ev)list.push(ev)}
  return{att,where,solids,list}}
// the craft changed in one part (moved, tilted, added): its own view anew, and any other part's whose rays met it before or
// might meet it now (a ray whose hit, or open end, is past where it now crosses that part's solid)
function viewsAgain(V,s,changed){const solids=viewSolids(s),C=solids.find(x=>x.p===changed),list=[];
  for(const ev of V.list){const p=s.parts.find(q=>q===ev.p);if(!p||!p.on)continue;
    if(p===changed||ev.by.some(x=>x[2]===changed)||C&&ev.rays.some(R=>{const t=raySolid(ev.eye,R.d,C);return t<(R.hit?len(sub(R.hit,ev.eye)):ev.far)})){list.push(viewOf(p,solids,V.att,V.where));continue}
    list.push(ev)}
  if(changed.on&&changed.d.view&&!list.some(e=>e.p===changed))list.push(viewOf(changed,solids,V.att,V.where));
  return{att:V.att,where:V.where,solids,list}}
// the rows the bench's Checks get from the views (plan § 4): the cameras', and the panels' figure for the power row
function viewRows(V){const out=[],cams=V.list.filter(e=>e.need==='ground');
  if(cams.length){const rank={bad:2,warn:1,ok:0},w=cams.reduce((a,e)=>rank[e.st]>rank[a.st]||rank[e.st]===rank[a.st]&&e.g<a.g?e:a),n=cams.length;
    out.push({k:'cams',cl:w.st,t:`${n>1?'Cameras':'The camera'}${w.st==='ok'?(n>1?' see':' sees')+' the ground all the way round':`: ${n>1?'one ':''}${w.line}`}`,fix:w.fix})}
  return out}
// the panels' power for the declared attitude (W of full sun, averaged round the orbit, shade counted), for powerBudget's
// figure on the bench: null with no panels. Each panel: its Wp, worn as its damage says, times its share
function viewPower(V){const P=V.list.filter(e=>e.need==='power');if(!P.length)return null;let W=0,sh=0,pk=0;
  for(const e of P){const wp=e.p.d.Wp*(1-(e.p.dmg||0));W+=wp*e.pw;pk+=wp;sh=Math.max(sh,e.shade)}
  const top=P.filter(e=>e.shade>0).sort((a,b)=>b.shade-a.shade)[0];return{W,peak:pk,shade:sh,by:top?top.shBy:''}}
