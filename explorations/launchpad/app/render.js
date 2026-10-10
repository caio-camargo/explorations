// app/render.js — render(). Part of index.html's script, split 2026-10-08 (launchpad NOTES § "The file split"):
// a classic script sharing one global scope with the others; index.html loads them in order. 'use strict';
'use strict';
// ============================================================ render
let W=1,H=1;
// ---- adaptive resolution: GPU timer queries (async, never stall) drive a render-scale multiplier
const TQ=gl.getExtension('EXT_disjoint_timer_query_webgl2'),tqPending=[];let tqCur=null,gpuMs=null,RS=1,rsT=0,slowAvg=0,RS_MAX=1;   // RS_MAX: the graphics quality's resolution cap (Settings, flow)
const GPU_NAME=(()=>{const e=gl.getExtension('WEBGL_debug_renderer_info');const r=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  const m=/ANGLE \([^,]*, ([^(,]*?)\s*(\(|,|Direct|$)/.exec(r);return (m?m[1]:r).replace(/(NVIDIA|AMD|Intel\(R\)) /,'$1 ').trim()})();
function gpuTimerBegin(){if(!TQ)return;if(tqPending.length<4){tqCur=gl.createQuery();gl.beginQuery(TQ.TIME_ELAPSED_EXT,tqCur)}else tqCur=null}
function gpuTimerEnd(){if(!TQ)return;if(tqCur){gl.endQuery(TQ.TIME_ELAPSED_EXT);tqPending.push(tqCur);tqCur=null}
  while(tqPending.length&&gl.getQueryParameter(tqPending[0],gl.QUERY_RESULT_AVAILABLE)){const q=tqPending.shift();
    if(!gl.getParameter(TQ.GPU_DISJOINT_EXT)){const ms=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gpuMs=gpuMs==null?ms:gpuMs*.85+ms*.15}gl.deleteQuery(q)}}
function adaptRes(dtR){ // keep GPU under ~7 ms (or, without timers, frames under ~22 ms)
  const load=gpuMs!=null?gpuMs/7:dtR*1000/22;slowAvg=slowAvg*.9+load*.1;rsT+=dtR;if(rsT<0.6)return;rsT=0;
  if(slowAvg>1.05&&RS>0.35)RS=Math.max(0.35,RS*0.82);else if(slowAvg<0.55&&RS<RS_MAX)RS=Math.min(RS_MAX,RS*1.12)}
function render(){
  if(self.bodyViewDraw&&self.bodyViewDraw())return;   // the tester's go-to-body view (app/bodyview.js) owns the frame while open
  gpuTimerBegin();
  const dpr=Math.min(devicePixelRatio||1,1.5)*RS,w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;ov.width=w;ov.height=h}W=w;H=h;
  // ---- camera, in float64 world coordinates
  let camW,R,U,Fw,fov;
  if(view==='map'&&mode==='flight'){
    const foc=cam.focus===0?shipWorld():bodyPos(BODIES[cam.focus-1],simT);
    const off=[Math.cos(cam.mPitch)*Math.sin(cam.mYaw),Math.sin(cam.mPitch),Math.cos(cam.mPitch)*Math.cos(cam.mYaw)];
    camW=madd(foc,off,cam.mDist);Fw=mul(off,-1);R=norm(cross(Fw,[0,1,0]));U=cross(R,Fw);fov=0.9}
  else{
    let tgt;const CB=mode==='drive'&&RV?RV.body:mode==='flight'&&RVA?RVA.body:S.body;if(mode==='drive'&&RV)tgt=rvWorld(RV);else if(mode==='flight'&&RVA)tgt=rvPoseW(RVA).p;else if(S.alive)tgt=shipWorld();else{const bm=booms[0];tgt=bm?add(bodyPos(bm.b,simT),fromPF(bm.b,bm.pf,simT)):shipWorld()}
    if(mode==='editor'&&!HOOK.edStill)cam.yaw+=0.002;
    const f=localFrame(sub(tgt,bodyPos(CB,simT)));if(mode==='editor'&&cam.edY)tgt=madd(tgt,f.up,cam.edY);
    const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),off=add(add(mul(f.n,-cp*Math.cos(cam.yaw)),mul(f.e,cp*Math.sin(cam.yaw))),mul(f.up,sp));
    camW=madd(tgt,off,cam.dist);
    const bc=bodyPos(CB,simT),rc=sub(camW,bc),ra=len(rc);{const gR=CB.R+1.5+(CB.ground&&ra<CB.R+bodyTop(CB)+10?groundAlt(CB,toPF(CB,rc,simT)):0);if(ra<gR)camW=add(bc,mul(rc,gR/ra))}
    Fw=norm(sub(tgt,camW));R=norm(cross(Fw,f.up));U=cross(R,Fw);fov=1.0}
  const tanY=Math.tan(fov/2),tanX=tanY*W/H;HOOK.view={camW,R,U,Fw,tanX,tanY,W,H};
  bloomBegin(W,H);gl.viewport(0,0,W,H);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.clearStencil(0);gl.clear(gl.DEPTH_BUFFER_BIT|gl.COLOR_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
  // ---- near clouds: the volume fades in below ~20 km over Tellus; bake its coverage first (covBake)
  const camAlt=len(camW)-TELLUS.R,VK=CLOUD_VOL&&mode!=='editor'?1-sstep(15000,22000,camAlt):0;if(VK>0)covBake(camW);
  if(view==='map'&&mode==='flight'&&atlasMode)atlasTick();
  // ---- sky / planets: one full-screen ray-cast
  for(const prog of PDEPTH?[PDEPTH,PSKY]:[PSKY]){gl.useProgram(prog.p);const u=prog.u;
  gl.uniform3fv(u.uR,R);gl.uniform3fv(u.uU,U);gl.uniform3fv(u.uF,Fw);gl.uniform3fv(u.uSun,SUN);gl.uniform2f(u.uTan,tanX,tanY);gl.uniform1f(u.uFc,FC);
  {const Cp=mul(camW,-1),d=len(Cp),th=bodyTheta(TELLUS,simT),c=Math.cos(th),s=Math.sin(th);
   gl.uniform3fv(u.uPc,Cp);gl.uniform1f(u.uPcc,(d-TELLUS.R)*(d+TELLUS.R));gl.uniform1f(u.uPR,TELLUS.R);gl.uniform1f(u.uAR,TELLUS.R+TELLUS.atm);
   gl.uniformMatrix3fv(u.uProt,false,[c,0,s,0,1,0,-s,0,c]);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,CITY_TEX);gl.uniform1i(u.uCity,0);
   const cpf=toPF(TELLUS,camW,simT);gl.uniform3fv(u.uPdet,cpf.map(x=>x-Math.round(x/1000)*1000));
   {const ns=sitesNear(norm(cpf),4),t=ns[0],f=siteFrame(t.u),a=new Float32Array(16);ns.forEach((x,i)=>a.set([x.u[0],x.u[1],x.u[2],x.h],i*4));
    gl.uniform4fv(u['uSites[0]'],a);gl.uniform1i(u.uNS,ns.length);gl.uniform3fv(u.uPadE,f.e);gl.uniform3fv(u.uPadS,f.s);
    gl.uniform3fv(u.uPadL,mul(t.u,TELLUS.R+t.h).map((x,i)=>x-Math.round(cpf[i]/1000)*1000))}   // the nearest pad, in the same re-centred frame as loc
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,WORLD_TEX.w);gl.uniform1i(u.uWorld,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,WORLD_TEX.c);gl.uniform1i(u.uClim,2);gl.activeTexture(gl.TEXTURE0);
   {const RT=TELLUS.R+TERR_TOP;gl.uniform2f(u.uGen,Math.cos(-WORLD.lon0),Math.sin(-WORLD.lon0));gl.uniform1f(u.uTcc,(d-RT)*(d+RT))}
   const mp=moonPos(simT),Cm=sub(mp,camW),dm=len(Cm);
   gl.uniform3fv(u.uMc,Cm);gl.uniform1f(u.uMcc,(dm-SELENE.R)*(dm+SELENE.R));gl.uniform1f(u.uMR,SELENE.R);
   const RC=TELLUS.R+3000;gl.uniform1f(u.uCR,RC);gl.uniform1f(u.uCcc,(d-RC)*(d+RC));gl.uniform1f(u.uCT,((tNow()+CLOUD_DT)*2e-4)%500);gl.uniform1f(u.uPix,2*tanY/H);   // clouds drift ~20 m/s
   {const th=bodyTheta(SELENE,simT);gl.uniform3fv(u.uMdet,rotY(sub(camW,mp),-th).map(x=>x-Math.round(x/1000)*1000));if(u.uMrot)gl.uniform2f(u.uMrot,Math.cos(th),Math.sin(th))}
   galaxy();gl.uniform3fv(u.uGx,GAL.gx);gl.uniform3fv(u.uGc,GAL.gc);gl.uniform3fv(u.uGt,GAL.gt);gl.uniform4fv(u.uGp,GAL.p);gl.uniform4fv(u.uGs,GAL.s);gl.uniform4fv(u.uGn,GAL.n);
   {const on=view==='map'&&mode==='flight'&&atlasMode&&ATLAS_GL.mode===atlasMode;gl.uniform1f(u.uAtl,on?1:0);
    if(on){gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,ATLAS_GL.tex);gl.uniform1i(u.uAtlas,3);gl.activeTexture(gl.TEXTURE0)}}
   gl.uniform1f(u.uVk,VK);gl.uniform1f(u.uVs,CLOUD_SHADOW_V?1:0);gl.uniform1f(u.uIv,ICE_VARY?1:0);gl.uniform1f(u.uVv,CLOUD_VARY?1:0);gl.uniform1f(u.uVD,COV.vd);if(VK>0){gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,COV.tex);gl.uniform1i(u.uCov,6);gl.activeTexture(gl.TEXTURE0);
    gl.uniform3fv(u.uCv0,COV.c0);gl.uniform3fv(u.uCvE,COV.e);gl.uniform3fv(u.uCvN,COV.n);gl.uniform1f(u.uCvX,COV.ext)}}}
  gl.bindVertexArray(quadVAO);
  if(PDEPTH){const D=depthTarget(Math.ceil(W/2),Math.ceil(H/2));gl.useProgram(PDEPTH.p);gl.bindFramebuffer(gl.FRAMEBUFFER,D.fb);gl.viewport(0,0,D.w,D.h);
    gl.disable(gl.DEPTH_TEST);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFB());gl.viewport(0,0,W,H);
    gl.useProgram(PSKY.p);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,D.tex);gl.uniform1i(PSKY.u.uDepth,5);gl.activeTexture(gl.TEXTURE0)}
  gl.useProgram(PSKY.p);gl.uniform1f(PSKY.u.uUseDepth,PDEPTH?1:0);
  gl.depthFunc(gl.ALWAYS);gl.drawArrays(gl.TRIANGLES,0,3);gl.depthFunc(gl.LESS);
  drawMoons(camW,R,U,Fw,tanX,tanY);
  const V=[R[0],U[0],-Fw[0],0,R[1],U[1],-Fw[1],0,R[2],U[2],-Fw[2],0,0,0,0,1],P=[1/tanX,0,0,0,0,1/tanY,0,0,0,0,-1,-1,0,0,-.2,0],VP=mmul(P,V);
  const project=p=>{const q=sub(p,camW),z=dot(q,Fw);if(z<=0)return null;return[W/2*(1+dot(q,R)/(z*tanX)),H/2*(1-dot(q,U)/(z*tanY))]};
  // ---- meshes
  gl.useProgram(PMESH.p);const m=PMESH.u;gl.uniformMatrix4fv(m.uVP,false,VP);gl.uniform3fv(m.uSun,SUN);gl.uniform1f(m.uFc,FC);gl.uniform1f(m.uGlow,0);gl.uniform1f(m.uShadow,0);gl.uniform1f(m.uSeam,0);
  {const E=lightEnv(camW);gl.uniform3fv(m.uSunCol,E.sun);gl.uniform3fv(m.uSky,E.sky);gl.uniform3fv(m.uGnd,E.gnd);gl.uniform3fv(m.uUp,E.up)}
  const lit=p=>{for(const b of BODIES){const q=sub(p,bodyPos(b,simT)),d=dot(q,SUN);if(d<0&&dot(q,q)-d*d<b.R*b.R)return 0}return 1};
  marksTick();padSync();padLights(m,camW);plumeLight(camW);plasmaLight(camW);boomLight(camW);gl.uniform4fv(m.uPl,PLT.p);gl.uniform3fv(m.uPlC,PLT.c);
  const drawMesh=(mesh,M,p)=>{gl.uniformMatrix4fv(m.uM,false,M);gl.uniform1f(m.uLit,lit(p));gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.n)};
  const near=view!=='map'||mode==='editor';
  {const th=bodyTheta(TELLUS,simT);for(const t of SITES){const site=fromPF(TELLUS,mul(t.u,TELLUS.R+t.h),simT);if(len(sub(site,camW))>3e5)continue;   // every pad nearby, in its own frame
   const f=siteFrame(t.u),M=mat4(rotY(f.e,th),rotY(f.up,th),rotY(f.s,th),sub(site,camW));if(t.kind==='sea')drawMesh(seaHull(),M,site);gl.uniform1f(m.uPadM,1);drawMesh(padFor(t),M,site);gl.uniform1f(m.uPadM,0)}}   // (each site in its owner's school, Q159)
  gl.uniform1f(m.uPadM,1);drawPadRig(drawMesh,camW);gl.uniform1f(m.uPadM,0);drawPadCrew(drawMesh,camW);   // the pad's moving parts, at the current site (visuals session)
  const nightCities=[];
  // cities within 60 km of the camera get their buildings (the tangent frame at the city, turned with the planet)
  if(len(camW)<TELLUS.R+80000){const th=bodyTheta(TELLUS,simT);for(const c of CITIES){const cp=fromPF(TELLUS,mul(c.u,TELLUS.R),simT);if(len(sub(cp,camW))>6e4)continue;
    const up=rotY(c.u,th),ref=Math.abs(c.u[1])<.9?[0,1,0]:[1,0,0],ex=norm(cross(ref,up)),ez=cross(ex,up),M=mat4(ex,up,ez,sub(cp,camW));drawMesh(cityMesh(c),M,cp);
    const night=1-Math.min(1,Math.max(0,(dot(up,SUN)+.12)/.17));if(night>0)nightCities.push([cityMesh(c),M,night])}}
  {const k=bayKey(S);if(k!==S._bayK){S._bayK=k;if(S._bayK0!==undefined)HOOK.rebuild();S._bayK0=k}}   // bay doors moving: rebuild the ship's mesh
  if(near&&S.alive&&shipMesh){const p=shipWorld(),bc=bodyPos(S.body,simT),up=norm(sub(p,bc)),gA=groundAlt(S.body,toPF(S.body,sub(p,bc),simT)),hb=len(sub(p,bc))-S.body.R-gA+S.yBot,Mship=modelQ(S.q,sub(p,camW),mul(S.cm,-1));
    if(hb<150&&dot(up,SUN)>0.05&&lit(p)){const gn=S.body.ground?groundNormal(S.body,toPF(S.body,sub(p,bc),simT)):up;   // the shadow lies on the ground's own plane (slopes)
      const P0=sub(madd(bc,up,S.body.R+gA+0.04),camW),L=SUN,ln=dot(L,gn),d0=dot(P0,gn)/ln;
      const Pr=[1-L[0]*gn[0]/ln,-L[1]*gn[0]/ln,-L[2]*gn[0]/ln,0, -L[0]*gn[1]/ln,1-L[1]*gn[1]/ln,-L[2]*gn[1]/ln,0, -L[0]*gn[2]/ln,-L[1]*gn[2]/ln,1-L[2]*gn[2]/ln,0, L[0]*d0,L[1]*d0,L[2]*d0,1];
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.depthFunc(gl.LEQUAL);gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.INCR);
      gl.uniform1f(m.uShadow,.55*(1-hb/150));gl.uniformMatrix4fv(m.uM,false,mmul(Pr,Mship));gl.bindVertexArray(shipMesh.vao);gl.drawArrays(gl.TRIANGLES,0,shipMesh.n);
      gl.uniform1f(m.uShadow,0);gl.disable(gl.STENCIL_TEST);gl.disable(gl.BLEND);gl.depthMask(true);gl.depthFunc(gl.LESS)}
    setMarks(m,S.parts);gl.uniform1f(m.uSeam,1);drawMesh(shipMesh,Mship,p);
    for(const a of S.att||[]){const am=satMesh(a.e);setMarks(m,am.parts);drawMesh(am.mesh,modelQ(qmul(S.q,a.q),sub(add(p,qrot(S.q,sub(a.p,S.cm))),camW),mul(a.e.cm,-1)),p)}   // docked bodies
    gl.uniform1f(m.uSeam,0);
    if(S.chute&&S.chuteA>0){const k=Math.sqrt(S.chuteA/Math.PI);drawMesh(CANOPY,modelQ(S.q,sub(p,camW),[-S.cm[0],S.yTop+1+k*1.2,-S.cm[2]],[k,k*.6,k]),p)}}
  // the other vessels in this flight (and whatever they have docked)
  if(near&&mode==='flight')for(const v of FLEET){if(!v.alive)continue;const p=add(bodyPos(v.body,simT),v.r);if(len(sub(p,camW))>1e5)continue;
    setMarks(m,v.parts);gl.uniform1f(m.uSeam,1);drawMesh(fleetMesh(v),modelQ(v.q,sub(p,camW),mul(v.cm,-1)),p);
    for(const a of v.att||[]){const am=satMesh(a.e);setMarks(m,am.parts);drawMesh(am.mesh,modelQ(qmul(v.q,a.q),sub(add(p,qrot(v.q,sub(a.p,v.cm))),camW),mul(a.e.cm,-1)),p)}
    gl.uniform1f(m.uSeam,0);setMarks(m,[])}
  if(mode==='flight'||mode==='editor')for(const v of[S,...(mode==='flight'?FLEET:[])]){if(!v||!v.alive)continue;const vp=add(bodyPos(v.body,simT),v.r);if(len(sub(vp,camW))>2e3)continue;
    for(const arm of v.parts){if(!arm.on||arm.d.kind!=='arm')continue;const B=armBase(arm),W=x=>sub(add(vp,qrot(v.q,sub(x,v.cm))),camW),a=armHeld(v,arm);
      const sh=W(B.P),L=ARM_R/2,nw=qrot(v.q,B.n),yw=qrot(v.q,[0,1,0]);let el,end,u;
      if(a){const tgt=W(armGrip(a)),d=Math.min(Math.max(len(sub(tgt,sh)),0.05),2*L-1e-3),bend0=sub(nw,mul(norm(sub(tgt,sh)),dot(nw,norm(sub(tgt,sh)))));u=norm(sub(tgt,sh));
        const bend=len(bend0)>1e-6?norm(bend0):norm(cross(u,[0,1,0]));el=add(add(sh,mul(u,d/2)),mul(bend,Math.sqrt(Math.max(0,L*L-d*d/4))));end=add(sh,mul(u,d))}
      else{el=add(add(sh,mul(yw,-L*0.97)),mul(nw,0.18));end=add(add(sh,mul(nw,0.36)),mul(yw,-0.25));u=norm(sub(end,el))}   // free: folded along the hull
      const buf=[];
      const jt=(P,a,r)=>{const ax=norm(cross(a,Math.abs(a[1])<.9?[0,1,0]:[1,0,0]));tube(buf,madd(P,ax,-.12),madd(P,ax,.12),r,C.G,12,true);tube(buf,madd(P,ax,-.135),madd(P,ax,-.12),r*.8,C.D,12,true)};   // a joint: a drum across the boom plane
      const bm=(A,B,r)=>{const d=norm(sub(B,A)),L2=len(sub(B,A));tube(buf,A,B,r,C.W,10,true);for(const f of[.12,.88])tube(buf,madd(A,d,L2*f-.06),madd(A,d,L2*f+.06),r*1.12,C.D,10,true)};
      bm(sh,el,.085);bm(el,end,.075);jt(sh,norm(sub(el,sh)),.13);jt(el,norm(sub(end,el)),.11);
      tube(buf,end,madd(end,u,.32),.12,C.G,12,true);tube(buf,madd(end,u,.32),madd(end,u,.36),.13,C.D,12,true);   // the end effector: a snare drum
      {const cp=madd(madd(end,u,.18),norm(cross(u,[0,1,0])),.13);tube(buf,cp,madd(cp,u,.1),.035,C.D,8,true)}
      const mm=makeMesh(buf);drawMesh(mm,mat4([1,0,0],[0,1,0],[0,0,1],[0,0,0]),vp);mm.free()}}
  if(mode==='editor'&&HOOK.edDraw)HOOK.edDraw(drawMesh,m,modelQ(S.q,sub(shipWorld(),camW),mul(S.cm,-1)),shipWorld());
  gl.uniform1f(m.uSeam,1);for(const d of debris){const p=add(bodyPos(d.body,simT),d.r);if(len(sub(p,camW))<1e5)setMarks(m,d.parts),drawMesh(d.mesh,modelQ(d.q,sub(p,camW),mul(d.cm,-1)),p)}gl.uniform1f(m.uSeam,0);setMarks(m,[]);
  // satellites left in orbit by earlier flights, on the map's Kepler rails (the one this flight just registered is still S)
  if(mode==='flight'||mode==='drive')for(const q of landedUp()){const b=landedBody(q);if(!b||!q.shape||S.rec&&S.rec.satId===q.id)continue;const lp=add(bodyPos(b,simT),fromPF(b,q.pf,simT));if(len(sub(lp,camW))>1e5)continue;
    const lq=qmul(qBody(b,simT),q.ql),lc=satCM(q),lm=satMesh(q);setMarks(m,lm.parts);gl.uniform1f(m.uSeam,1);drawMesh(lm.mesh,modelQ(lq,sub(lp,camW),mul(lc,-1)),lp);
    for(const a of q.attached||[]){const am=satMesh(a.e);setMarks(m,am.parts);drawMesh(am.mesh,modelQ(qmul(lq,a.q),sub(add(lp,qrot(lq,sub(a.p,lc))),camW),mul(a.e.cm,-1)),lp)}
    gl.uniform1f(m.uSeam,0);setMarks(m,[])}   // landed objects, in their body's frame
  if(mode==='flight')for(const q of[...satsUp(),...moonSats()]){if(!q.shape||S.rec&&S.rec.satId===q.id)continue;const[r0,v]=satAt(q,tNow()),r=add(bodyPos(orbBody(q),simT),r0);if(len(sub(r,camW))>1e5)continue;   // r: absolute
    const sq=satSpin(q,tNow(),r0,v).q,cc=satCM(q),sm=satMesh(q);setMarks(m,sm.parts);gl.uniform1f(m.uSeam,1);drawMesh(sm.mesh,modelQ(sq,sub(r,camW),mul(cc,-1)),r);
    for(const a of q.attached||[]){const am=satMesh(a.e);setMarks(m,am.parts);drawMesh(am.mesh,modelQ(qmul(sq,a.q),sub(add(r,qrot(sq,sub(a.p,cc))),camW),mul(a.e.cm,-1)),r)}
    gl.uniform1f(m.uSeam,0);setMarks(m,[])}
  if(near)drawSmoke(VP,camW,R,U);
  finTipTick();debrisHeat();
  if(near&&(mode==='drive'||mode==='flight'))drawRoverScene(drawMesh,camW);
  if(near&&mode==='flight')drawVapor(VP,camW);
  // ---- map: orbit lines + labels
  const labels=[];
  if(view==='map'&&mode==='flight')drawMap(VP,camW,labels);
  // ---- additive glow: plumes, fireballs
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);gl.useProgram(PMESH.p);
  gl.depthFunc(gl.LEQUAL);   // same geometry again at the same depth
  for(const[mesh,M,k]of nightCities){gl.uniformMatrix4fv(m.uM,false,M);gl.uniform1f(m.uGlow,.22*k);gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.n)}   // lit windows, roughly
  drawPadGlow(m,camW);   // the pad's floodlights
  gl.depthFunc(gl.LESS);
  if(near)drawPlumePool(VP);
  const PE=near&&S.alive&&mode==='flight'?plumeEngines():[];
  if(PE.length){const p=shipWorld(),pa=pressure(S.body,len(S.r)-S.body.R),pu=PPLUME.u;gl.useProgram(PPLUME.p);
    gl.uniformMatrix4fv(pu.uVP,false,VP);gl.uniform1f(pu.uFc,FC);gl.uniform1f(pu.uT,performance.now()/1000%1000);
    gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.CULL_FACE);gl.bindVertexArray(PLUME.vao);
    gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_3D,PNOISE);gl.uniform1i(pu.uN,7);gl.activeTexture(gl.TEXTURE0);
    const GF=groundFrame(camW),hits=[];
    for(const[e,on]of PE){const sp=spoolOf(e,on);
      const f=pfxOf(e.d),P=PROPS[f.prop]||PROPS.kerolox,ig=ignOf(e,P),thr=sp.tg>0?Math.max(sp.k,.6*ig[3]):sp.k,[n,tn,L,R]=plumeShape(e.d,thr,pa);if(thr<.01&&simT-sp.ig>.5)continue;
      const pf=plumeFrame(e),qt=pf.qt,sh=[pf.ex[0]-S.cm[0],pf.ex[1]-S.cm[1]+0.02,pf.ex[2]-S.cm[2]],Q=qt?qmul(S.q,qt):S.q,
        o=add(sub(p,camW),qrot(S.q,sh)),cl=qrot(qconj(Q),mul(o,-1)),inside=cl[1]<.01&&cl[1]>-L-.01&&Math.hypot(cl[0],cl[2])<R*1.01+.05;
      gl.uniformMatrix4fv(pu.uM,false,qt?modelQ(Q,sub(p,camW),qrot(qconj(qt),sh)):modelQ(S.q,sub(p,camW),sh));
      {const qi=qconj(Q),n=qrot(qi,GF.Y);gl.uniform4f(pu.uGp,n[0],n[1],n[2],dot(qrot(qi,sub(GF.O,o)),n));   // the ground plane, plume-local
        const dW=qrot(Q,[0,-1,0]),dn=dot(dW,GF.Y);if(dn<-.2){const sg=dot(sub(GF.O,o),GF.Y)/dn,w=thr*sstep(L*1.15,L*.35,sg);
          if(sg>0&&(w>.01||!S.body.atm))hits.push({P:add(o,mul(dW,sg)),w,re:e.d.exit,P2:P,ig,sg,thr})}}
      gl.uniform3f(pu.uB,R,L,e.d.exit);gl.uniform3fv(pu.uCam,cl);gl.uniform1f(pu.uIn,inside?1:0);gl.cullFace(inside?gl.BACK:gl.FRONT);
      gl.uniform3fv(pu.uCo,P.co);gl.uniform3fv(pu.uDi,P.di);gl.uniform3fv(pu.uMa,P.ma);gl.uniform3fv(pu.uVa,P.va);gl.uniform3fv(pu.uSo,P.so);gl.uniform4fv(pu.uK,P.K);
      gl.uniform4f(pu.uIg,ig[0],ig[1],ig[2],ig[3]);
      gl.uniform4f(pu.uS,n,tn,sstep(.02,.25,pa)*sstep(8,2,n),pa);const tt=simT*7+e.i*1.7;gl.uniform1f(pu.uI,(.45+.55*thr)*(.94+.03*Math.sin(tt*9.1)+.03*Math.sin(tt*23.7)));gl.uniform1f(pu.uOp,P.op);gl.drawArrays(gl.TRIANGLES,0,PLUME.n)}
    if(hits.length&&IMPACT_FX){if(S.body.atm)drawImpact(GF,hits,VP);else drawDust(GF,hits,VP)}
    gl.disable(gl.CULL_FACE);gl.blendFunc(gl.ONE,gl.ONE);gl.useProgram(PMESH.p)}
  // fin-tip vapor after the plumes: the trails don't write depth, so drawn before they'd vanish behind the exhaust even
  // where they're in front of it (they run beside it, a fin span out)
  if(near){drawFinTips(VP,camW,R,U);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false)}
  // re-entry plasma: the PLASMA volume (shock layer, wake streaks), its heat level from the stagnation heat flux faded in
  // by airspeed (plasmaHeat, PLAYTEST #17); on
  // the ship and on spent stages falling back (debrisHeat)
  if(PLASMA_FX&&near){const qS=S.alive?plasmaHeat(S.body,S.r,S.v,S.qHeat):0;if(qS>1.5e4)drawPlasma(VP,camW,S,shipWorld(),qS,false);
    for(const d of debris){const g=DEBH.get(d),qd=g?plasmaHeat(d.body,d.r,d.v,g.q):0;if(qd>1.5e4){const p=add(bodyPos(d.body,simT),d.r);if(len(sub(p,camW))<2e4)drawPlasma(VP,camW,g.geo,p,qd,true)}}}
  // RCS: a puff at each nozzle that fired in the last 80 ms (so a single 20 ms pulse is still seen)
  if(near&&S.alive&&S.rcsJ){const J=S.rcsJ,p=shipWorld();for(const j of S.rcsShots||[])rcsSeen[j]=simT;
    for(const j in rcsSeen){const age=simT-rcsSeen[j],z=J.N[j];if(age<0||age>0.08||!z)continue;const q=qmul(S.q,qFromTo([0,-1,0],mul(z.d,-1)));
      gl.uniformMatrix4fv(m.uM,false,modelQ(q,sub(add(p,qrot(S.q,sub(z.at,S.cm))),camW),0,[.14,.4,.14]));gl.uniform1f(m.uGlow,.6*(1-age/.08));gl.bindVertexArray(PUFF.vao);gl.drawArrays(gl.TRIANGLES,0,PUFF.n)}}
  const nowMs=performance.now();
  if(booms.length){const u=PBOOM.u,E=lightEnv(camW);gl.useProgram(PBOOM.p);gl.uniformMatrix4fv(u.uVP,false,VP);gl.uniform1f(u.uFc,FC);gl.uniform1f(u.uT,nowMs/1000%1000);
    gl.uniform3fv(u.uLight,E.sun.map(x=>x*.45));gl.uniform3fv(u.uAmb,E.sky.map((x,i)=>x+E.gnd[i]));
    gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_3D,PNOISE);gl.uniform1i(u.uN,7);gl.activeTexture(gl.TEXTURE0);
    gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.CULL_FACE);gl.bindVertexArray(VBOX.vao);
    for(let i=booms.length-1;i>=0;i--){const bm=booms[i],a=(nowMs-bm.t0)/1000,life=bm.air>.05?14:3;if(a>life){if(S.alive||a>60)booms.splice(i,1);continue}
      const ps=fromPF(bm.b,bm.pf,simT),p=add(bodyPos(bm.b,simT),ps),Y=norm(ps),X=norm(cross(Y,Math.abs(Y[1])<.9?[0,1,0]:[1,0,0])),Z=cross(X,Y),
        R=bm.sz*(2+12*Math.sqrt(Math.min(a,1.2)))*(1.4-.4*bm.air)+bm.sz*2.5*bm.air*Math.max(0,a-1.2),rise=bm.air*bm.sz*3.5*Math.pow(a,1.2),
        lo=[-1.6*R,rise-1.6*R,-1.6*R],hi=[1.6*R,rise+1.6*R,1.6*R],O=sub(p,camW),cl=[-dot(O,X),-dot(O,Y),-dot(O,Z)],
        inside=cl[0]>lo[0]&&cl[0]<hi[0]&&cl[1]>lo[1]&&cl[1]<hi[1]&&cl[2]>lo[2]&&cl[2]<hi[2];
      gl.uniformMatrix4fv(u.uM,false,mat4(X,Y,Z,O));gl.uniform3fv(u.uLo,lo);gl.uniform3fv(u.uHi,hi);gl.uniform3fv(u.uCam,cl);gl.uniform1f(u.uIn,inside?1:0);
      gl.uniform3f(u.uSunL,dot(SUN,X),dot(SUN,Y),dot(SUN,Z));gl.uniform1f(u.uA,a);gl.uniform1f(u.uR,R);gl.uniform1f(u.uRise,rise);gl.uniform1f(u.uAir,bm.air);gl.uniform1f(u.uSeed,bm.seed);
      gl.cullFace(inside?gl.FRONT:gl.BACK);gl.drawArrays(gl.TRIANGLES,0,VBOX.n)}
    gl.disable(gl.CULL_FACE);gl.blendFunc(gl.ONE,gl.ONE);gl.useProgram(PMESH.p)}
  gl.disable(gl.BLEND);gl.depthMask(true);
  bloomEnd();
  // ---- 2D overlay
  octx.clearRect(0,0,W,H);mapUI.node=null;mapUI.handles=[];mapUI.pick=[];mapUI.sats=[];mapUI.qnodes=[];
  if(mode==='flight'&&view!=='map'){const gr=gaugeRect();if(gr)drawGauges(gr.x,gr.y,gr.s)}
  if(view==='map'&&mode==='flight'){
    for(const q of mapUI.pickW||[]){const p=project(q.p);if(p)mapUI.pick.push({x:p[0],y:p[1],t:q.t})}
    octx.font=`${12*Math.min(devicePixelRatio||1,1.5)}px ui-monospace,Consolas,monospace`;octx.textAlign='center';
    const era=mapEra();if((era===1)!==document.body.classList.contains('paper'))document.body.classList.toggle('paper',era===1);   // the notebook's paper: the HUD switches to ink (flow, evergreen)
    if(era){drawEraMap(era,camW,project,tanY);octx.font=ERA_FONT[era](Math.min(devicePixelRatio||1,1.5));for(const L of labels)L.c=eraInk(era,L.c)}
    const texts=[];   // (flow, PLAYTEST #31) label texts are placed after the marks, most useful first, and one that would overlap a placed one is skipped
    for(const L of labels){const s=project(L.p);if(!s)continue;octx.fillStyle=L.c;if(L.mark==='sat')mapUI.sats.push({x:s[0],y:s[1],id:L.id});
      if(L.mark==='ship'){octx.beginPath();octx.moveTo(s[0],s[1]-7);octx.lineTo(s[0]+6,s[1]);octx.lineTo(s[0],s[1]+7);octx.lineTo(s[0]-6,s[1]);octx.closePath();octx.fill()}
      else if(L.mark==='qnode'){const k=Math.min(devicePixelRatio||1,1.5);mapUI.qnodes.push({x:s[0],y:s[1],k:L.k});octx.strokeStyle=L.c;octx.lineWidth=2*k;octx.beginPath();octx.arc(s[0],s[1],5.5*k,0,7);octx.stroke();octx.beginPath();octx.arc(s[0],s[1],2*k,0,7);octx.fill()}   // (flow, Q157) a queued node
      else if(L.mark==='node'){const k=Math.min(devicePixelRatio||1,1.5),HC=['#d8f05a','#e07cff','#5fd0ff'];mapUI.node=L.k?null:s;mapUI.handles=[];
        for(const[d,axis,sign]of L.axes){const q=project(add(L.p,mul(d,cam.mDist*0.06)));let ux=q?q[0]-s[0]:0,uy=q?q[1]-s[1]:0,ul=Math.hypot(ux,uy);
          if(ul<1e-3){ux=sign;uy=0;ul=1}ux/=ul;uy/=ul;const hx=s[0]+ux*40*k,hy=s[1]+uy*40*k;mapUI.handles.push({x:hx,y:hy,ux,uy,axis,sign});
          let dx=hx,dy=hy;if(hDrag&&hDrag.h.axis===axis&&hDrag.h.sign===sign){const off=(hDrag.cur[0]-hDrag.h.x)*ux+(hDrag.cur[1]-hDrag.h.y)*uy;dx=hDrag.h.x+ux*off;dy=hDrag.h.y+uy*off}
          octx.strokeStyle=HC[axis];octx.lineWidth=1.5*k;octx.beginPath();octx.moveTo(s[0],s[1]);octx.lineTo(dx,dy);octx.stroke();
          octx.fillStyle=HC[axis];octx.beginPath();octx.arc(dx,dy,(sign>0?6:4.5)*k,0,7);sign>0?octx.fill():(octx.lineWidth=2*k,octx.stroke())}
        octx.fillStyle=L.c;octx.strokeStyle='#fff';octx.lineWidth=1.5*k;octx.beginPath();octx.arc(s[0],s[1],7*k,0,7);octx.fill();octx.stroke()}
      else if(L.mark==='city'){octx.beginPath();octx.arc(s[0],s[1],2.2,0,7);octx.fill()}
      else if(L.mark==='gs'){octx.strokeStyle=L.c;octx.lineWidth=1.5;octx.strokeRect(s[0]-3.5,s[1]-3.5,7,7)}
      else if(L.mark==='sat'){octx.beginPath();octx.moveTo(s[0],s[1]-4);octx.lineTo(s[0]+4,s[1]);octx.lineTo(s[0],s[1]+4);octx.lineTo(s[0]-4,s[1]);octx.closePath();octx.fill()}
      else if(L.mark==='ca'){octx.strokeStyle=L.c;octx.lineWidth=2;octx.beginPath();octx.arc(s[0],s[1],5,0,7);octx.stroke()}
      else if(L.mark==='impact'){octx.strokeStyle=L.c;octx.lineWidth=2.5;octx.beginPath();octx.moveTo(s[0]-6,s[1]-6);octx.lineTo(s[0]+6,s[1]+6);octx.moveTo(s[0]+6,s[1]-6);octx.lineTo(s[0]-6,s[1]+6);octx.stroke()}
      else if(L.mark==='planet'){const k=Math.min(devicePixelRatio||1,1.5),r=L.px*k;octx.beginPath();octx.arc(s[0],s[1],r,0,7);octx.fill();
        if(L.sun){octx.strokeStyle=L.c;octx.lineWidth=1.5*k;octx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;octx.moveTo(s[0]+Math.cos(a)*r*1.5,s[1]+Math.sin(a)*r*1.5);octx.lineTo(s[0]+Math.cos(a)*r*2.2,s[1]+Math.sin(a)*r*2.2)}octx.stroke()}}
      else if(L.mark==='ghost'){const e=project(L.edge);if(e){octx.strokeStyle=L.c;octx.setLineDash([4,4]);octx.beginPath();octx.arc(s[0],s[1],Math.hypot(e[0]-s[0],e[1]-s[1]),0,7);octx.stroke();octx.setLineDash([])}}
      else{octx.beginPath();octx.arc(s[0],s[1],3,0,7);octx.fill()}
      if(L.t)texts.push({t:L.t,x:s[0],y:s[1]-(L.mark==='planet'?L.px*1.6+8:10),c:L.c,o:{node:0,qnode:0,planet:5,city:4,gs:3,sat:3,ship:2}[L.mark]??1})}
    {const k=Math.min(devicePixelRatio||1,1.5),put=[],h=13*k;texts.sort((a,b)=>a.o-b.o);
      for(const T of texts){const w=octx.measureText(T.t).width+4*k,r=[T.x-w/2,T.y-h+3*k,T.x+w/2,T.y+3*k];
        if(put.some(q=>q[0]<r[2]&&r[0]<q[2]&&q[1]<r[3]&&r[1]<q[3]))continue;put.push(r);octx.fillStyle=T.c;octx.fillText(T.t,T.x,T.y)}}
    if(atlasMode)atlasOverlay(era,camW,project,R,U,Fw,tanX,tanY)}
  const building=mode==='editor'&&!atHQ&&!atDeb&&!atRoll&&!atNet;   // (flow) the builder's markers stay off behind the Program and Debrief panels
  if(building&&S.ana){const pw=shipWorld(),mk=(y,c,t,dx)=>{const s=project(add(pw,qrot(S.q,[-S.cm[0],y-S.cm[1],-S.cm[2]])));if(!s)return;
      const k=Math.min(devicePixelRatio||1,1.5),x=s[0]+dx*k*3.2;
      octx.lineWidth=2*k;octx.strokeStyle=c;octx.beginPath();octx.moveTo(s[0],s[1]);octx.lineTo(x,s[1]);octx.stroke();
      octx.fillStyle='#000';octx.beginPath();octx.arc(s[0],s[1],8*k,0,7);octx.fill();octx.strokeStyle=c;octx.lineWidth=3*k;octx.beginPath();octx.arc(s[0],s[1],6*k,0,7);octx.stroke();
      octx.fillStyle=c;octx.beginPath();octx.arc(s[0],s[1],2.2*k,0,7);octx.fill();
      octx.font=`bold ${13*k}px ui-monospace,Consolas,monospace`;octx.textAlign=dx>0?'left':'right';octx.lineWidth=4*k;octx.strokeStyle='rgba(0,0,0,.8)';
      octx.strokeText(t,x+dx*k*.3,s[1]+4*k);octx.fillText(t,x+dx*k*.3,s[1]+4*k)};
    mk(S.ana.ful.ycm,'#ffd84a','CoM',12);if(isFinite(S.ana.ful.ycp))mk(S.ana.ful.ycp,'#5fd0ff','CoP',-12)}
  if(building&&HOOK.edOverlay)HOOK.edOverlay(octx);
  if(mode==='flight'&&view!=='map'&&S.alive&&impact&&toolOK('impact')){const ip=add(bodyPos(impact.b,simT),fromPF(impact.b,impact.pf,simT)),q=project(ip);
    if(q){const k=Math.min(devicePixelRatio||1,1.5),d=len(sub(ip,shipWorld()));octx.strokeStyle='#ff6b5a';octx.fillStyle='#ff6b5a';octx.lineWidth=2.5*k;
      octx.beginPath();octx.moveTo(q[0]-8*k,q[1]-8*k);octx.lineTo(q[0]+8*k,q[1]+8*k);octx.moveTo(q[0]+8*k,q[1]-8*k);octx.lineTo(q[0]-8*k,q[1]+8*k);octx.stroke();
      octx.font=`${12*k}px ui-monospace,Consolas,monospace`;octx.textAlign='center';octx.fillText(`impact · ${fmtD(d)}`,q[0],q[1]-12*k)}}
  if(mode==='flight'&&view!=='map'){const k=Math.min(devicePixelRatio||1,1.5),me=shipWorld();
    for(const q of[...satsUp(),...moonSats()]){if(S.rec&&S.rec.satId===q.id)continue;const p=add(bodyPos(orbBody(q),simT),satAt(q,tNow())[0]),d=len(sub(p,me)),s=project(p),tg=q.id===S.target;if(!s||d>2e5&&!tg)continue;
      octx.fillStyle=tg?'#ffb347':q.cam?'#9fe8ff':'#aab4c0';octx.beginPath();octx.moveTo(s[0],s[1]-5*k);octx.lineTo(s[0]+5*k,s[1]);octx.lineTo(s[0],s[1]+5*k);octx.lineTo(s[0]-5*k,s[1]);octx.closePath();
      if(d<300)continue;octx.fill();octx.font=`${12*k}px ui-monospace,Consolas,monospace`;octx.textAlign='center';octx.fillText(`${q.name} · ${fmtD(d)}`,s[0],s[1]-10*k)}}
  if(mode==='flight'&&view!=='map'){const T=tgtOf(S);if(T&&T.landed){const k=Math.min(devicePixelRatio||1,1.5),q=project(add(bodyPos(S.body,simT),T.r));
    if(q){octx.fillStyle='#ffb347';octx.beginPath();octx.moveTo(q[0],q[1]-6*k);octx.lineTo(q[0]+6*k,q[1]);octx.lineTo(q[0],q[1]+6*k);octx.lineTo(q[0]-6*k,q[1]);octx.closePath();octx.fill();
      octx.font=`${12*k}px ui-monospace,Consolas,monospace`;octx.textAlign='center';octx.fillText(`${T.q.name} · ${fmtD(len(T.dr))}`,q[0],q[1]-10*k)}}}
  if(mode==='drive')rvLabels(octx,project);
  if(mode==='flight'&&view!=='map'&&FLEET.length){const k=Math.min(devicePixelRatio||1,1.5),me=shipWorld();octx.font=`${12*k}px ui-monospace,Consolas,monospace`;octx.textAlign='center';
    for(const v of FLEET){if(!v.alive)continue;const p=add(bodyPos(v.body,simT),v.r),q=project(p),d=len(sub(p,me));if(!q)continue;
      octx.fillStyle='#c9e86a';octx.beginPath();octx.arc(q[0],q[1],4*k,0,7);octx.fill();if(d>30)octx.fillText(`${v.name} · ${fmtD(d)}`,q[0],q[1]-10*k)}}
  if(view!=='map'&&document.body.classList.contains('paper'))document.body.classList.remove('paper');
  if(mode==='flight'&&S.alive)drawNavball();
  gpuTimerEnd()}
function nuToT(el,nu,t0){let dt=tPe(el,nu)-tPe(el,el.nu);if(el.e<1)dt=((dt%el.period)+el.period)%el.period;return t0+dt}
function patchRange(pt){const el=pt.el;
  if(pt.end){let n1=Math.atan2(dot(pt.end,el.Q),dot(pt.end,el.P));if(el.e<1)while(n1<=el.nu)n1+=6.2832;return[el.nu,n1]}
  if(el.e<1)return[0,6.2832];
  const rc=pt.b.parent?pt.b.soi:Math.max(...pt.b.children.map(c=>c.rMax))*2.5,c=(el.p/rc-1)/el.e,nm=c>=-1&&c<=1?Math.acos(c):Math.acos(-1/el.e)*.98;return[el.nu,Math.max(el.nu,nm)]}
// a perturbed (numeric) leg: its integrated path from now on, the closest pass to the body, and how it ends
function drawPath(pt,k,off,col,dash,tag,seg,labels,list){const P=pt.path,bR=pt.b.R,hc=`rgb(${col.slice(0,3).map(x=>x*255|0)})`;let pv=null,lo=null;
  for(let i=0;i<P.length;i++){const[r,t]=P[i];if(t<simT&&i<P.length-1&&P[i+1][1]<=simT)continue;const p=add(off,r);if(pv&&(!dash||i%4<2))seg(pv,p,col);pv=p;
    const rl=len(r);if(t>=simT&&(!lo||rl<lo.rl))lo={rl,p}}
  if(lo&&pt.endKind!=='impact')labels.push({p:lo.p,t:'Pe '+fmtD(lo.rl-bR)+tag,c:hc});
  if(pt.endKind==='impact')labels.push({p:add(off,pt.end),t:`Impact in ${fmtT(pt.endT-simT)}${pt.b.pert?' (perturbed)':''}`+tag,c:'#ff6b5a'});
  if(pt.endKind==='enc'){const nx=list[k+1];labels.push({p:add(off,pt.end),t:`${nx.b.name} encounter in ${fmtT(pt.endT-simT)}${tag}`,c:'#ffb454'});
    labels.push({p:pt.off||nx.off,mark:'ghost',edge:add(nx.off,[soiAt(nx.b,pt.endT),0,0]),c:'rgba(255,180,84,.6)'})}
  if(pt.endKind==='esc')labels.push({p:add(off,pt.end),t:`${pt.b.name} escape in ${fmtT(pt.endT-simT)}`+tag,c:'#cc8cff'})}
function drawPatches(list,camW,out,labels,cols,dash,tag){
  const seg=(a,b,c)=>out.push(a[0]-camW[0],a[1]-camW[1],a[2]-camW[2],...c,b[0]-camW[0],b[1]-camW[1],b[2]-camW[2],...c);
  list.forEach((pt,k)=>{
    const el=pt.el,off=pt.b.parent?(pt.off||bodyPos(pt.b,simT)):[0,0,0],col=cols[k];if(el.hl<1e-3)return;
    if(pt.path){drawPath(pt,k,off,col,dash,tag,seg,labels,list);return}
    const[n0,n1]=patchRange(pt),N=Math.max(64,Math.min(720,Math.round(Math.abs(n1-n0)*90)));let pv=null;
    for(let i=0;i<=N;i++){const nu=n0+(n1-n0)*i/N,den=1+el.e*Math.cos(nu);if(den<=1e-6){pv=null;continue}const rr=el.p/den;
      const p=add(off,add(mul(el.P,rr*Math.cos(nu)),mul(el.Q,rr*Math.sin(nu))));if(pv&&(!dash||i%4<2))seg(pv,p,col);pv=p}
    const inArc=nu=>{if(!pt.end&&el.e<1)return true;let a=nu;while(a<n0)a+=6.2832;return a<=n1};
    const bR=pt.b.R,hc=`rgb(${col.slice(0,3).map(x=>x*255|0)})`;
    if(inArc(0)&&el.e>1e-4)labels.push({p:add(off,mul(el.P,el.pe)),t:(el.pe<bR?'Impact':'Pe '+fmtD(el.pe-bR))+tag,c:hc});
    if(el.e<1&&el.e>1e-4&&inArc(Math.PI))labels.push({p:add(off,mul(el.P,-el.ap)),t:'Ap '+fmtD(el.ap-bR)+tag,c:hc});
    if(pt.endKind==='enc'){const nx=list[k+1];labels.push({p:add(off,pt.end),t:`${nx.b.name} encounter in ${fmtT(pt.endT-simT)} · Pe ${nx.el.pe<nx.b.R?'impact':fmtD(nx.el.pe-nx.b.R)}${tag}`,c:'#ffb454'});
      labels.push({p:pt.off||nx.off,mark:'ghost',edge:add(nx.off,[soiAt(nx.b,pt.endT),0,0]),c:'rgba(255,180,84,.6)'})}
    if(pt.endKind==='esc')labels.push({p:add(off,pt.end),t:`${pt.b.name} escape`+tag,c:'#cc8cff'})})}
// A numeric (perturbed) prediction costs milliseconds, so it isn't redone every frame: it stands while the craft is where it
// said the craft would be (within a km or 0.1 % of the radius); while thrusting, it's redone at most four times a second.
function predStill(){const c=predCache,p0=c&&c.p[0];if(!p0||!p0.path||c.body!==S.body||S.landed)return false;
  const P=p0.path,thr=S.throttle>0&&activeEngines(S).length>0;if(thr)return performance.now()-c.wall<250;
  if(simT>(p0.endT||p0.tEnd||-Infinity))return false;let i=1;while(i<P.length-1&&P[i][1]<simT)i++;
  const[a,ta]=P[i-1],[b,tb]=P[i],f=tb>ta?clamp((simT-ta)/(tb-ta),0,1):0,q=add(a,mul(sub(b,a),f));
  return len(sub(q,S.r))<Math.max(1000,1e-3*len(S.r))*(1+len(sub(b,a))/2e4)}
// the map's link lines (space session, QUEUE Q173): from each satellite with a link home right now, green to the station
// that hears it (or toward Tellus, from a moon), cyan to the relay it goes through; none when out of contact. Kept for
// 5 s of program time, so a frame doesn't redo every link.
let mapLinkMemo={t:NaN,n:-1,v:[]};
function mapLinks(seg){const T=tNow(),n=(PROG.sats||[]).length;if(!(Math.abs(T-mapLinkMemo.t)<5)||n!==mapLinkMemo.n){const v=[];
    for(const q of[...satsUp(),...moonSats()]){if(q.junk)continue;const L=entryLink(q,T);if(!L.ok)continue;const P=add(bodyPos(orbBody(q),simT),satAt(q,T)[0]);
      if(L.viaId!=null){const p=(PROG.sats||[]).find(x=>x.id===L.viaId);if(p)v.push([P,add(bodyPos(orbBody(p),simT),satAt(p,T)[0]),[.4,.85,1,.55]]);continue}
      v.push([P,L.st?add(bodyPos(TELLUS,simT),rotY(mul(L.st.u,TELLUS.R),absTh(T))):bodyPos(TELLUS,simT),[.45,1,.55,.45]])}
    mapLinkMemo={t:T,n,v}}
  for(const[a,b,c]of mapLinkMemo.v)seg(a,b,c)}
function drawMap(VP,camW,labels){
  if(!predCache||predCache.t!==simT&&!predStill())predCache={t:simT,p:predict(S),wall:performance.now(),body:S.body};
  const out=[],seg=(a,b,c)=>out.push(a[0]-camW[0],a[1]-camW[1],a[2]-camW[2],...c,b[0]-camW[0],b[1]-camW[1],b[2]-camW[2],...c);
  // the moons' orbits + SOI rings
  for(const b of BODIES){if(!b.parent||!knownBody(b))continue;const pp=bodyPos(b.parent,simT),T=2*Math.PI/b.n;let prev=null;
    for(let i=0;i<=256;i++){const p=add(pp,bodyRel(b,simT+T*i/256)[0]);if(prev)seg(prev,p,[.5,.5,.55,.6]);prev=p}
    const bp=bodyPos(b,simT),so=soiAt(b,simT);prev=null;for(let i=0;i<=96;i++){const f=i/96*6.2832,p=add(bp,[so*Math.cos(f),0,so*Math.sin(f)]);if(prev)seg(prev,p,[.5,.5,.55,.25]);prev=p}}
  for(const fv of FLEET){if(!fv.alive||fv.body!==TELLUS||fv.landed)continue;const el=elements(fv.r,fv.v,TELLUS.mu);if(!(el.e<1))continue;let pv=null;   // the other vessels' orbits
    for(let i=0;i<=96;i++){const nu=i/96*6.2832,rr=el.p/(1+el.e*Math.cos(nu)),p=add(mul(el.P,rr*Math.cos(nu)),mul(el.Q,rr*Math.sin(nu)));if(pv)seg(pv,p,[.79,.91,.42,.5]);pv=p}}
  for(const q of[...satsUp(),...moonSats()]){const B=orbBody(q),o=bodyPos(B,simT),[r,v]=satAt(q,tNow()),el=elements(r,v,B.mu);let pv=null;for(let i=0;i<=96;i++){const nu=i/96*6.2832,rr=el.p/(1+el.e*Math.cos(nu)),p=add(o,add(mul(el.P,rr*Math.cos(nu)),mul(el.Q,rr*Math.sin(nu))));if(pv)seg(pv,p,q.id===S.target?[1,.7,.3,.9]:q.cam?[.55,.9,1,.35]:[.6,.65,.7,.25]);pv=p}}
  mapLinks(seg);   // space Q173: each satellite's link home right now
  drawPatches(gateLegs(predCache.p,labels),camW,out,labels,{0:[.45,.85,1,1],1:[1,.6,.25,1],2:[.8,.55,1,1]},false,'');
  // where a click lands on the current leg: world points with their times (projected in the overlay pass)
  mapUI.pickW=[];const p0=predCache.p[0];
  if(p0&&p0.path&&!S.landed){const off=bodyPos(p0.b,simT);for(const[r,t]of p0.path)if(t>=simT)mapUI.pickW.push({p:add(off,r),t})}
  else if(p0&&p0.el.hl>1e-3&&!S.landed){const el=p0.el,off=bodyPos(p0.b,simT),[n0,n1]=patchRange(p0);
    for(let i=0;i<=360;i++){const nu=n0+(n1-n0)*i/360,den=1+el.e*Math.cos(nu);if(den<=1e-6)continue;const rr=el.p/den,t=nuToT(el,nu,simT);
      if(p0.endT&&t>p0.endT)continue;mapUI.pickW.push({p:add(off,add(mul(el.P,rr*Math.cos(nu)),mul(el.Q,rr*Math.sin(nu)))),t})}}
  // the planned trajectory after the node (after the last node of a chain: nodePlanEnd, vehicle Q33), dashed
  if(S.node){const I=nodeInfo(S),off=bodyPos(S.body,simT),key=JSON.stringify([S.body.name,I.t,I.rN.map(x=>Math.round(x/100)),add(I.vN,I.rem).map(x=>Math.round(x*100)),(S.nodeQ||[]).map(n=>[n.t,n.dv])]);
    if(!planCache||planCache.key!==key&&!(planCache.num&&performance.now()-planCache.wall<250)){const p=predictFrom(nodePlanEnd(S)||{b:S.body,r:I.rN,v:add(I.vN,I.rem),t:I.t});planCache={key,p,num:p.some(x=>x.path),wall:performance.now()}}
    const plan=planCache.p;
    drawPatches(gateLegs(plan,labels),camW,out,labels,{0:[1,1,1,.9],1:[1,.75,.4,.9],2:[.85,.7,1,.9]},true,' ▸plan');
    // (flow, Q157) every node of a chain: the one the node panel has selected (◀ node k of n ▶) gets the drag handles, the
    // others a marker with its Δv and time (a click on one selects it). Places from nodePlan; a node on another body's leg is
    // drawn by that body where it will be then, as the plan's legs are.
    const NP=nodePlan(S),sel=clamp(typeof ndSel==='number'?ndSel:0,0,Math.max(0,NP.length-1)),axes=f=>[[f.pro,0,1],[mul(f.pro,-1),0,-1],[f.nrm,1,1],[mul(f.nrm,-1),1,-1],[f.rad,2,1],[mul(f.rad,-1),2,-1]];
    if(!NP.length){labels.push({p:add(off,I.rN),mark:'node',k:0,axes:axes(nodeFrame(I.rN,I.vN)),c:'#5f9dff'})}
    NP.forEach((P,k)=>{const p=add(k===0||P.b===S.body?off:bodyPos(P.b,P.t),P.rN),t=NP.length>1?`node ${k+1} · ${(k===0?len(I.rem):len(P.n.dv)).toFixed(0)} m/s · in ${fmtT(P.t-simT)}`:'';
      labels.push(k===sel?{p,mark:'node',k,t,axes:axes(nodeFrame(P.rN,P.vN)),c:'#5f9dff'}:{p,mark:'qnode',k,t,c:'#8fb6ff'})})}
  // closest approach to the target: where we'll be and where it will be, on this orbit and on the planned one
  {const ca=tgtCA();if(ca)for(const[x,tag,c,cl]of[[ca.now,'','#7dffa8',[.5,1,.65,.8]],[ca.plan,' ▸plan','#ffffff',[1,1,1,.8]]])if(x){seg(x.p,x.pt,cl);
    labels.push({p:x.p,mark:'ca',t:`closest ${fmtD(x.d)} · in ${fmtT(x.t-progT(S))}${tag}`,c},{p:x.pt,mark:'ca',t:'',c:'#ffb347'})}}
  // (flow, Q175) Helios and the planets, from epoch 1: on a ring in the ecliptic around the map's centre, at their ecliptic
  // longitude today (at their real places they'd be at infinity, mostly behind this camera); hidden behind Tellus
  {const E=eclFrame(),o=[Math.cos(cam.mPitch)*Math.sin(cam.mYaw),Math.sin(cam.mPitch),Math.cos(cam.mPitch)*Math.cos(cam.mYaw)],c0=madd(camW,o,-cam.mDist),rr=cam.mDist*.3;let pv=null;
    for(let i=0;i<=144;i++){const a=i/144*6.2832,p=add(c0,add(mul(E.X,rr*Math.cos(a)),mul(E.Y,rr*Math.sin(a))));if(pv&&i%2)seg(pv,p,[.62,.6,.5,.3]);pv=p}
    for(const m of planetMarks(tNow())){const p=madd(c0,m.u,rr),q=sub(p,camW),dq=len(q),tc=-dot(camW,q)/dq;
      if(tc>0&&tc<dq&&dot(camW,camW)-tc*tc<TELLUS.R*TELLUS.R)continue;
      labels.push({p,mark:'planet',px:m.px,sun:m.name==='Helios',t:m.name==='Helios'?'Helios':`${m.name} · ${m.d.toFixed(2)} TU`,c:m.color})}}
  MAPSEGS=mapEra()?out:null;   // an era map draws these on the overlay, in its own hand
  if(out.length&&!MAPSEGS){gl.useProgram(PLINE.p);gl.uniformMatrix4fv(PLINE.u.uVP,false,VP);gl.uniform1f(PLINE.u.uFc,FC);
    gl.bindVertexArray(lineVAO);gl.bindBuffer(gl.ARRAY_BUFFER,lineBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.LINES,0,out.length/7);gl.disable(gl.BLEND)}
  if(impact&&toolOK('impact')){const b=impact.b,bp=bodyPos(b,simT);let pv=null;for(const pf of impact.path){const q=add(bp,fromPF(b,pf,simT));if(pv)seg(pv,q,[1,.35,.25,.9]);pv=q}
    const ip=add(bp,fromPF(b,impact.pf,simT));if(pv)seg(pv,ip,[1,.35,.25,.9]);labels.push({p:ip,mark:'impact',t:`impact ${fmtT(impact.t-simT)}`,c:'#ff6b5a'})}
  for(const c of CITIES){const cp=fromPF(TELLUS,mul(c.u,TELLUS.R),simT);if(dot(sub(camW,cp),rotY(c.u,bodyTheta(TELLUS,simT)))<0)continue;   // far side of the planet
    labels.push({p:cp,mark:'city',t:len(camW)<TELLUS.R*4.3?c.name:'',c:c.power?`hsl(${c.power.hue},75%,66%)`:'#ffd27a'})}   // cities in their power's colour
  for(const c of PROG.active||[])if(c.type==='ballistic'){const tp=fromPF(TELLUS,mul(c.p.u,TELLUS.R),simT);if(dot(sub(camW,tp),rotY(c.p.u,bodyTheta(TELLUS,simT)))>0)labels.push({p:tp,mark:'impact',t:'target',c:'#ff4fd8'})}
  for(const g of stationsAll()){const gp=fromPF(TELLUS,mul(g.u,TELLUS.R),simT);if(dot(sub(camW,gp),rotY(g.u,bodyTheta(TELLUS,simT)))>=0)labels.push({p:gp,mark:'gs',t:'',c:'#9fe8ff'})}
  for(const q of[...satsUp(),...moonSats()]){const tg=q.id===S.target;labels.push({p:add(bodyPos(orbBody(q),simT),satAt(q,tNow())[0]),mark:'sat',id:q.id,t:tg||len(sub(camW,bodyPos(orbBody(q),simT)))<TELLUS.R*10?q.name:'',c:tg?'#ffb347':q.cam?'#9fe8ff':'#aab4c0'})}
  if(impSpread&&impact&&toolOK('impact'))for(const x of[impSpread.lo,impSpread.hi])labels.push({p:add(bodyPos(x.b,simT),fromPF(x.b,x.pf,simT)),mark:'impact',t:'',c:'rgba(255,107,90,.45)'});
  for(const d of pendingDrops){const ip=fromPF(d.impact.b,d.impact.pf,simT);labels.push({p:add(bodyPos(d.impact.b,simT),ip),mark:'impact',t:d.verdict.kind==='city'?`${d.name} → ${d.verdict.city.name}!`:'',c:d.verdict.kind==='city'||d.verdict.kind==='near'?'#ff5a5a':'#ff9f5a'})}
  for(const q of landedUp()){const b=landedBody(q);if(!b)continue;labels.push({p:add(bodyPos(b,simT),fromPF(b,q.pf,simT)),mark:'gs',t:q.beacon||q.id===S.target?q.name:'',c:q.id===S.target?'#ffb347':'#e0c070'})}
  if(landPick){const b=BODIES.find(x=>x.name===landPick.body),u=b&&fromPF(b,landPick.pf,simT);if(u&&dot(sub(camW,add(bodyPos(b,simT),u)),u)>0)labels.push({p:add(bodyPos(b,simT),u),mark:'impact',t:'landing site',c:'#ffb347'})}   // (Q62)
  for(const v of FLEET)if(v.alive)labels.push({p:add(bodyPos(v.body,simT),v.r),mark:'ship',t:v.name,c:'#c9e86a'});
  labels.push({p:shipWorld(),mark:'ship',t:'',c:'#7dffa8'},...BODIES.map(b=>({p:add(bodyPos(b,simT),[0,b.R*(b.parent?1.3:1.15),0]),t:knownBody(b)?b.name:'?',c:'#9ab'})))}

// ---- navball: per-pixel into a small ImageData (32k pixels, trivial on the CPU)
const NBc=$('nav'),nctx=NBc.getContext('2d'),NS=180,nimg=nctx.createImageData(NS,NS),D32=new Uint32Array(nimg.data.buffer);
function drawNavball(){
  const f=localFrame(S.r),X=qrot(S.q,[1,0,0]),Y=qrot(S.q,[0,1,0]),Z=qrot(S.q,[0,0,1]);
  const au=[dot(X,f.up),dot(Y,f.up),dot(Z,f.up)],an=[dot(X,f.n),dot(Y,f.n),dot(Z,f.n)],ae=[dot(X,f.e),dot(Y,f.e),dot(Z,f.e)];
  // no trig per pixel: elevation lines are |sin el| = const, heading lines are 4 great circles through the poles
  const D=nimg.data,Rr=NS/2-1,w=0.014;
  for(let py=0;py<NS;py++)for(let px=0;px<NS;px++){const i=(py*NS+px)*4,u=(px-NS/2+.5)/Rr,v=-(py-NS/2+.5)/Rr,rr=u*u+v*v;
    if(rr>1){D32[i>>2]=0;continue}const y=Math.sqrt(1-rr);
    const el=au[2]*u+au[1]*y-au[0]*v,dn=an[2]*u+an[1]*y-an[0]*v,de=ae[2]*u+ae[1]*y-ae[0]*v,ab=el<0?-el:el;
    let r,g,b,k=1;if(el>0){r=46;g=110;b=190}else{r=140;g=88;b=48}
    if(ab<0.012){r=g=b=235}
    else if(Math.abs(ab-.5)<.009||Math.abs(ab-.866)<.008)k=1.35;
    else if(ab<.985){const hl=w*Math.sqrt(dn*dn+de*de);if(Math.abs(de)<hl||Math.abs(dn)<hl||Math.abs(de-dn)<hl*1.414||Math.abs(de+dn)<hl*1.414)k=1.3}
    const sh=k*(.45+.55*Math.sqrt(y));D32[i>>2]=(255<<24)|(Math.min(255,b*sh)<<16)|(Math.min(255,g*sh)<<8)|Math.min(255,r*sh)}
  nctx.putImageData(nimg,0,0);
  const mark=(dir,c,kind)=>{const sy=dot(dir,Y);if(sy<0)return;const sx=NS/2+dot(dir,Z)*Rr,syy=NS/2+dot(dir,X)*Rr;
    nctx.strokeStyle=c;nctx.lineWidth=2;nctx.beginPath();nctx.arc(sx,syy,7,0,7);nctx.stroke();
    if(kind==='pro'){nctx.beginPath();nctx.moveTo(sx-12,syy);nctx.lineTo(sx-7,syy);nctx.moveTo(sx+7,syy);nctx.lineTo(sx+12,syy);nctx.moveTo(sx,syy-7);nctx.lineTo(sx,syy-12);nctx.stroke()}
    else{nctx.beginPath();nctx.moveTo(sx-5,syy-5);nctx.lineTo(sx+5,syy+5);nctx.moveTo(sx+5,syy-5);nctx.lineTo(sx-5,syy+5);nctx.stroke()}};
  const sr=speedRef(S);if(len(sr.v)>0.5){const p=norm(sr.v);mark(p,'#d8f05a','pro');mark(mul(p,-1),'#d8f05a','retro')}
  {const T=tgtOf(S);if(T){const u=norm(T.dr);mark(u,'#ffb347','pro');mark(mul(u,-1),'#ffb347','retro');   // the target, and our velocity relative to it
    if(len(T.dv)>0.05){const w=norm(T.dv);mark(w,'#ff7ad9','pro');mark(mul(w,-1),'#ff7ad9','retro')}}}
  if(S.node){const I=nodeInfo(S);if(len(I.rem)>1e-3){const d=norm(I.rem);if(dot(d,Y)>0){const sx=NS/2+dot(d,Z)*Rr,sy=NS/2+dot(d,X)*Rr;
    nctx.strokeStyle='#5f9dff';nctx.lineWidth=3;nctx.beginPath();nctx.arc(sx,sy,8,0,7);nctx.stroke();nctx.beginPath();nctx.moveTo(sx-13,sy);nctx.lineTo(sx+13,sy);nctx.moveTo(sx,sy-13);nctx.lineTo(sx,sy+13);nctx.stroke()}}}
  nctx.strokeStyle='#ffb000';nctx.lineWidth=3;nctx.beginPath();nctx.moveTo(NS/2-26,NS/2);nctx.lineTo(NS/2-9,NS/2);nctx.lineTo(NS/2,NS/2+8);nctx.lineTo(NS/2+9,NS/2);nctx.lineTo(NS/2+26,NS/2);nctx.stroke();
  const hdg=(Math.atan2(dot(Y,f.e),dot(Y,f.n))*57.2958+360)%360,pit=Math.asin(clamp(dot(Y,f.up),-1,1))*57.2958;
  $('navtxt').textContent=`HDG ${pit>89.5?'—':hdg.toFixed(0).padStart(3,'0')+'°'}  PITCH ${pit.toFixed(0)}°  ${sr.srf?'SURFACE':'ORBIT'}`;
  $('thrf').style.height=(S.throttle*100)+'%'}

// ---- HUD text
function fmtD(m){const a=Math.abs(m);return a<1e4?m.toFixed(0)+' m':a<1e7?(m/1e3).toFixed(1)+' km':(m/1e6).toFixed(2)+' Mm'}
function fmtT(s){if(!isFinite(s))return'—';s=Math.max(0,s);const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=Math.floor(s%60);
  return(d?d+'d ':'')+(d||h?h+'h ':'')+(d||h||m?m+'m ':'')+x+'s'}
