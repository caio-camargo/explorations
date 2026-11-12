const {boot}=require('./harness.cjs');const mk=H=>s=>{try{return H.run(s)}catch(e){return 'THROW '+e.message+' @ '+(e.stack||'').split('\n').slice(1,4).join(' | ')}};
{ // (a) Esc > Title screen during a live flight: one click
  const H=boot(),r=mk(H);r('ttlFound()');r("go('assembly')");H.getEl('launch').click();H.key('z');H.key(' ');H.frame(300);
  console.log('a flying',r('flying()'),'flights',r('PROG.flights'));
  H.key('escape');H.click({esc:'assembly'});console.log('a one click on "Back to the design table": screen',r('screenNow()'),'armed',r('escArm'),'flights',r('PROG.flights'));
  H.click({esc:'close'});H.key('escape');H.click({esc:'title'});console.log('a one click on "Title screen": screen',r('screenNow()'),'flights',r('PROG.flights'),'S ended',r('!!S.rec.ended'));
}
{ // (c) Fly a satellite, Revert, with an empty design table
  const H=boot({search:'?tester'}),r=mk(H);r('ttlFound()');r("go('assembly')");
  r("testStart({body:'Tellus',where:'orbit',alt:300e3,inc:0,lat:0,lon:180,drop:'auto',target:'dummy',behind:3000})");H.frame(10);
  r("S.rec.tester=null;REVERT0=null;TEST.on=false;go('debrief');go('assembly')");
  console.log('c load empty',r("BLD.load({v:2,root:null});BLD.isEmpty(stackDef)"));
  r("go('program')");H.click({fly:String(r('PROG.sats[0].id'))});H.frame(20);
  console.log('c flying sat',r('S.name'),r('screenNow()'));
  const out=r("revertFlight();'ok'");console.log('c revertFlight ->',out);H.frame(20);
  console.log('c after: screen',r('screenNow()'),'S.parts',r('S&&S.parts&&S.parts.length'),'errs',H.errs.slice(0,2));
}
