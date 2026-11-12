const {boot}=require('./harness.cjs');let H=boot();const mk=H=>s=>{try{return H.run(s)}catch(e){return 'THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]}};let r=mk(H);
r('ttlFound()');r("go('assembly')");H.getEl('launch').click();H.key('z');H.key(' ');H.frame(600);   // flight 1: straight up, 10 s
console.log('flight 1: alt',r('(len(S.r)-TELLUS.R).toFixed(0)'),'launched',r('S.rec.launched'));
r("S.throttle=0");H.key('x');
// end it via the Esc menu (two clicks while flying)
H.key('escape');H.click({esc:'end'});H.click({esc:'end'});console.log('after End: screen',r('screenNow()'),'flights',r('PROG.flights'),'log ids',r("JSON.stringify(Object.keys(PROG.log||{}))"),'withStack',r("JSON.stringify(Object.keys(PROG.log||{}).filter(k=>PROG.log[k].stack))"));
console.log('NEWS n',r('NEWS.length'),r('JSON.stringify(NEWS.slice(0,3).map(n=>n.t.slice(0,50)))'));
// ---- H2: flight 2, then Logbook > load design while flying
r("go('assembly')");H.getEl('launch').click();H.key('z');H.key(' ');H.frame(300);
console.log('flight 2: screen',r('screenNow()'),'flying',r('flying()'),'alt',r('(len(S.r)-TELLUS.R).toFixed(0)'),'ended',r('!!S.rec.ended'),'funds',r('PROG.funds.toFixed(1)'));
H.key('f');const lid=r("Object.keys(PROG.log).find(k=>PROG.log[k].stack)");console.log('logbook open',!H.getEl('logbook').classList.contains('hidden'),'entry',lid);
H.click({lbload:lid});
console.log('after one click on "load design": screen',r('screenNow()'),'flight ended',r('!!S.rec.ended'),'flights',r('PROG.flights'),'msg',r("document.getElementById('msg').textContent").slice(0,80));
// ---- H4: New program keeps the news
r("go('title')");console.log('title',r('screenNow()'));H.click({ttl:'new'});H.click({ttl:'new'});
console.log('after New program: day',r('PROG.day'),'flights',r('PROG.flights'),'needCharter',r('needCharter()'),'NEWS n',r('NEWS.length'),'first',r('NEWS[0]&&NEWS[0].t.slice(0,60)'),'newsHTML has old',r("newsHTML().length>0"),'headlines',r('headlines.length'),'debShown',r('!!debShown'),'DEBRIEF_LAST',r('!!DEBRIEF_LAST'));
console.log('errs',H.errs);
