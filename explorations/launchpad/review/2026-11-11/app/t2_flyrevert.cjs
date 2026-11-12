// flyEntry (Program > Fleet > Fly) then Revert: where does the player end up?
const {boot}=require('./harness.cjs');const H=boot({search:'?tester'});const r=s=>{try{return H.run(s)}catch(e){return 'THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]}};
r('ttlFound()');r("go('assembly')");
// a satellite of ours: a tester start in orbit, then (hack, disclosed) the flight is made an ordinary one so missionEnd registers it
console.log('start',r("testStart({body:'Tellus',where:'orbit',alt:300e3,inc:0,lat:0,lon:180,drop:'auto',target:'dummy',behind:3000})"));
H.frame(20);
console.log(r("S.rec.tester=null;REVERT0=null;TEST.on=false;go('debrief');screenNow()"), 'sats',r("JSON.stringify((PROG.sats||[]).map(q=>[q.id,q.name,flyable(q)]))"));
r("go('program')");console.log('screen',r('screenNow()'),'funds',r('PROG.funds.toFixed(2)'),'flights',r('PROG.flights'));
// the player now makes the table's design unaffordable/unlaunchable: here simply note its cost vs funds, then spend the funds
r("PROG.funds=5");console.log('table design cost',r("vesselCost(newShip(stackDef).parts).cost.toFixed(1)"),'funds',r('PROG.funds'));
const id=r("PROG.sats.find(q=>flyable(q)).id");H.click({fly:String(id)});H.frame(30);
console.log('after Fly: screen',r('screenNow()'),'S.name',r('S.name'),'alt km',r('((len(S.r)-S.body.R)/1e3).toFixed(0)'),'launched',r('S.rec.launched'),'revertOK',r('revertOK()'),'sats',r('PROG.sats.length'));
H.key('escape');H.click({esc:'revert'});H.click({esc:'revert'});H.frame(30);
console.log('after Revert: screen',r('screenNow()'),'S.name',r('S.name'),'alt km',r('((len(S.r)-S.body.R)/1e3).toFixed(2)'),'landed',r('S.landed'),'launched',r('S.rec.launched'),'parts',r('S.parts.length'),'sats',r('PROG.sats.length'),'funds',r('PROG.funds'));
console.log('msg',r("document.getElementById('msg').textContent"));
console.log('paused',r('gamePaused()'));H.key('z');H.key(' ');H.frame(240);
console.log('after Space: launched',r('S.rec.launched'),'alt m',r('(len(S.r)-S.body.R-curSite().h).toFixed(0)'),'funds',r('PROG.funds.toFixed(2)'),'errs',H.errs);
console.log('cost',r('S.rec.cost'),'ops',r('S.rec.ops'),'bailouts',r('PROG.bailouts'),'TEST',r('JSON.stringify(TEST)'),'day',r('PROG.day'),'FLOOR',r('FUNDS_FLOOR'),'debt',r('own().debt'));
console.log(H.log.slice(-5));
