// (loop slices, Q370) scratch check, kept beside its harness: a founded career reloads on the desk; a new one on the title
const {boot}=require('./harness.cjs');const mk=H=>s=>{try{return H.run(s)}catch(e){return 'THROW '+e.message}};
const H=boot(),r=mk(H);
console.log('fresh load:',r('screenNow()'),'needCharter',r('needCharter()'));
r('ttlFound()');r("PROG.cardQ=['loads']");r('HOOK.save()');
console.log('founded:',r('screenNow()'),'unlock on',r('UNL.on'),'cards',r('UNL.q.length'));
const t0=Date.now(),H2=boot({storage:Object.fromEntries(H.store)}),r2=mk(H2);r2("if(!needCharter()&&!TEST.on&&screenNow()==='title')go('program')");H2.frame(5);
console.log('reload:',r2('screenNow()'),'needCharter',r2('needCharter()'),'unlock on',r2('UNL.on'),'cardQ',r2('JSON.stringify(PROG.cardQ)'),'ms',Date.now()-t0);
r2("go('title')");console.log('Esc › Title:',r2('screenNow()'));
console.log('errs',H.errs,H2.errs);
