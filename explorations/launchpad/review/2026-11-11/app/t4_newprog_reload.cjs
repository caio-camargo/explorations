const {boot}=require('./harness.cjs');const mk=H=>s=>{try{return H.run(s)}catch(e){return 'THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]}};
{ // A: New program from the title after one flight
  const H=boot(),r=mk(H);r('ttlFound()');r("go('assembly')");H.getEl('launch').click();H.key('z');H.key(' ');H.frame(400);
  H.key('escape');H.click({esc:'end'});H.click({esc:'end'});r("go('program')");
  console.log('A before: day',r('PROG.day.toFixed(1)'),'flights',r('PROG.flights'),'NEWS',r('NEWS.length'),'headlines',r('headlines.length'));
  r("go('title')");H.click({ttl:'new'},{self:1});H.click({ttl:'new'},{self:1});
  console.log('A after New program: day',r('PROG.day'),'flights',r('PROG.flights'),'needCharter',r('needCharter()'),'| NEWS',r('NEWS.length'),'newsSeen',r('newsSeen'),'headlines',r('headlines.length'),'debShown',r('!!debShown'),'DEBRIEF_LAST',r('!!DEBRIEF_LAST'),'landPick',r('landPick'));
  r('ttlFound()');console.log('A new career Inbox news:',r("newsHTML().replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,330)"));
  console.log('A desk clipping source (deskNews(NEWS)) non-empty:',r("!!deskNews(NEWS)"),'| photo kept:',r("!!deskPhoto()"),'| ticker #news hidden:',H.getEl('news').classList.contains('hidden'),'text:',H.getEl('news').textContent.slice(0,90));
  console.log('A errs',H.errs);
}
{ // B: Fly a satellite of ours, then the page reloads mid-flight
  const H=boot({search:'?tester'}),r=mk(H);r('ttlFound()');r("go('assembly')");
  r("testStart({body:'Tellus',where:'orbit',alt:300e3,inc:0,lat:0,lon:180,drop:'auto',target:'dummy',behind:3000})");H.frame(10);
  r("S.rec.tester=null;REVERT0=null;go('debrief');go('program')");   // (hack, disclosed: makes the tester start an ordinary flight so satRegister keeps it)
  console.log('B registry before Fly:',r("JSON.stringify(PROG.sats.map(q=>q.name))"),'saved:',JSON.parse(H.store.get('launchpad-program-tester')).sats.length);
  H.click({fly:String(r('PROG.sats[0].id'))});H.frame(20);
  console.log('B in flight:',r('screenNow()'),r('S.name'),'| PROG.sats',r('PROG.sats.length'),'| saved sats',JSON.parse(H.store.get('launchpad-program-tester')).sats.length);
  const H2=boot({search:'?tester',storage:Object.fromEntries(H.store)}),r2=mk(H2);
  console.log('B after a reload: screen',r2('screenNow()'),'PROG.sats',r2('PROG.sats.length'),'flights',r2('PROG.flights'));
}
