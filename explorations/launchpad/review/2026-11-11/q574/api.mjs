// Q574 harness: the SIM with the names the contact measurements need. Run with cwd = explorations/launchpad.
import { pathToFileURL } from 'node:url';
const { pageSource } = await import(pathToFileURL(process.cwd().split(String.fromCharCode(92)).join('/') + '/page.mjs').href);
const html = pageSource();
export const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
export function mk() {
  const X = new Function(src + `return {PRESETS,TELLUS,SELENE,MISSIONS,PARTS,POWERS,CITIES,AV,COMP_ERAS,newShip,stage,advPhys,advRails,railsOK,localFrame,qFromBasis,elements,timeToNu,dvRemaining,dvPlan,engAcc,HOOK,PROG,
    len,norm,add,sub,mul,dot,cross,madd,kepler,linkOf,stationsAll,gsSees,gsSites,gsCheck,buildStation,toPF,curSite,programNew,capital,capSees,relOf,opOf,plasmaOn,antOf,avOf,avCap,compEra,nodeBurnTime,burnThrust,
    seesTellus,entryLink,STAT_R,STA_MIN,DAY_S,GS_REACH,vesselCost,qrot,
    get HOME(){return HOME},get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v}};`)();
  X.HOOK.news = () => {}; X.HOOK.msg = () => {}; X.HOOK.save = () => {}; return X;
}
