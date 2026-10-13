// Headless checks for Launchpad's simulation core. Run: node test.mjs
// Extracts the "SIM BEGIN … SIM END" block from index.html and drives it with no DOM or GL.
import { readFileSync } from 'node:fs';
import { pageSource, pageScripts } from './page.mjs';
import { crewLunar } from './fly_crewlunar.mjs';
import { flyLadder, handAscent, flySite, siteOf } from './fly_ladder.mjs';
// shards (platform session): `node test.mjs --list | --only 12,docking | --smoke | --times`, see shards.mjs
// Since Q68 every run goes through shards.mjs, which splices in tests/*.mjs; the module it builds arrives on stdin, where
// process.argv[1] is unset, so this line doesn't fire there.
if (process.argv[1]) process.exit(await (await import('./shards.mjs')).main(process.argv.slice(2), import.meta.url));
const html = pageSource();
const src = html.slice(html.indexOf('// ==== SIM BEGIN'), html.indexOf('// ==== SIM END'));
const api = new Function(src + `
return {payNew,payNode,paySync,payChecks,payExpand,PAY_STARTERS,trimOf,debFail,ledAdd,debHelp,LED_L,airSep,ascentEst,jointFix,finDef,FIN_SZ,tipSpeed,standSpeed,landStance,debOutcome,qmul,designLaunched,designSave,designLib,designLabel,REC,recLoad,recStart,recEv,recProg,recFlightStart,recFlightEnd,recStop,recFile,recProgAt,jdiff,jpatch,stateHash,progHash,tapeNew,tapePhys,tapeStage,tapePlay,LOG,logEv,missionDiscard,shapeOf,partOpen,partLaunchWhy,PART_GATE,dispatchQuote,nodePlan,nodePlanEnd,nodeAddNext,nodeNext,nodeLead,nodeBurnTime,soiSwitch,satLife,surfacePick,procWithSite,procLandsOn,sitePlace,autoLegs,launchWarnings,flightAims,dvToAlt,DV_ORBIT_EST,stageStats,nextStep,footPoints,legOp,legsDown,tapeLegs,toV2,powerStep,powerRails,powerBudget,eclFrac,inShadow,powCap,powLoad,avOf,avCap,hasComputer,AV,wingOp,wingsOut,tapeWings,get TEST(){return TEST},get PROG(){return PROG},compEra,khOn,advPhys,advRails,get DEBRIEF_LAST(){return DEBRIEF_LAST},debriefOf,nextStep,siteAt,PLASMA_V,plasmaOn,BLACKOUT_Q,ATLAS,atlasBake,atlasU,atlasXY,atlasAt,flightLeave:typeof flightLeave==='function'?flightLeave:null,engAcc,procFly,dispatchRun,procAdopt,orderBaseRun,baseRunQuote,baseRunLine,dispatchTick,baseOf,landedUp,orderDryRun,dryQuote,dispatchLine,PROV_UNC,FLEET,get ORB_T0(){return ORB_T0},watchPlan,recNew,ctrlAuthority,ctrlAuthRoll,activeEngines,missionTick,missionComplete,dispatchEstimate,dispatchQuote,orderDispatch,padWait,padsFree,procKey,stagePaid,upcoming,nextEvent,advanceTo,acceptOffer,COMP_ERAS,compLag,compEra,worldEra,compYear,predErr,studyQuote,orderStudy,studyWait,studyKey,studyOf,predictImpact,FAC,facLv,buildFac,fleetSalvage,devLv,devQuote,startDev,devPriceK,wearOf,buildStand,startTest,testQuote,standReady,STAND_COST,prodLine,prodLineK,prodQuote,startProdLine,prodUnits,khVessel,khYield,khUse,khBar,use0,khLearn,igniteOK,khOn,OPS_FIX,OPS_FRAC,SITES,siteById,curSite,homeSite,homeSites,siteAccessOf,siteFits,siteFrame,terrainH,terrainSlope,SITE_GAP,PAD_FLAT,tapeNew,toolOK,TOOLS,eraOf,designName,LOGF,sourceOf,tierOf,indOf,cert0,IMPORT_K,GREY_K,cancelProgram,demandMet,flav,ARCH,natOf,moneyK,failHit,flavTick,sanction,sanctioned,offerRisk,RIVALS,RACE,raceLost,LEAK_P,genOffer,contractEval,chooseStart,own,stateShare,ownKind,floorCheck,offerDecision,resolveDecision,income,valuation,pickClient,rng,acceptOffer,CT,capOf,ensureBoard,standOf,GRANT_100,wearOf,makePowers,POWERS,powerAt,relOf,opOf,advanceDays,DAY_S,prepDays,HOME,vesselCost,FUNDS0,FUNDS_FLOOR,REFURB,advPhys,advRails,PROG,MISSIONS,missionEnd,missionDrop,safetyReview,certOf,atmU,G_LIM,CERT0,CITIES,landValue,isLand,dropVerdict,debrisImpact,fall,surfVelX:null,predictImpact,tapePhys,tapeRails,tapeStage,tapePlay,tapeDuration,toPF,railsOK,segFuel,stageStats,partMass,PARTS,analyze,nodeInfo,nodeBurnTime,predictFrom,dvPlan,kepler,elements,timeToNu,predict,newShip,physStep,rails,stage,dvRemaining,localFrame,qFromBasis,qrot,cross,norm,len,sub,add,mul,dot,probe,firstSeg,geom,INP,surfVel,SND,buildStation,gsCheck,stationsAll,GS_LEASE,pairKey,satAt,absTh,cloudAt,sunUp,relBase,siteWeather,weatherHold,downrangeWarning,SEA_DECK,SCRUB_MAX,alongAz,SURF_MOON,SURF,BIOMES,surfaceAt,surfaceHit,biomeAt,groundAlt,TOPPLE,groundGap,aglAt,MAIN_AGL,fromPF,density,HAZ,disCities,cityGround,fieldBiomes,polarKm,recoveryOf,gsMask,gsSees,linkOf,devState,loseDeviation,vesselOf,dispatchRoll,makeRoute,orderRoute,routeTick,routeSats,routeOf,routeAutoWhy,setRouteAuto,routeLine,netModel,satsUp,autoAllowed,ROUTE_CLEAN,
  badness,careerMove,get home(){return HOME},resetHome(){HOME=0;RIVALS=raceSchedule()},
  TELLUS,SELENE,NYX,BODIES,soiAt,bodyRel,bodyPos,MISSIONS,SUN_DIR,advRails,satRegister,utilTick,navCover,capital,STAT_R,isTV,rotY,abort,activeEngines,procStart,procKey,TAPE_V,PRESETS,HOOK,moonPos,moonVel,get S(){return S},set S(v){S=v},get t(){return simT},set t(v){simT=v},DT};`)();
const { kepler, elements, len, sub, add, mul, dot, norm, cross, TELLUS, SELENE } = api;
// geometry from the planet, not literals: low orbit 10 km above the air, entry 5 km below its top at ~98 % of circular speed
const ATM = TELLUS.atm, LEO = TELLUS.R + ATM + 10000, VENT = 0.9838 * Math.sqrt(TELLUS.mu / (TELLUS.R + ATM + 5000)), AS = ATM / 7e4;
const log = [];
api.HOOK.msg = m => log.push(`[t=${api.t.toFixed(1)}] ${m}`);
let fails = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

// ==== SECTIONS: tests/*.mjs (QUEUE Q68). shards.mjs splices them in here, in TEST_FILES order; add yours to your lane's file.

// ==== END OF SECTIONS (shards.mjs: new sections go in tests/<lane>.mjs, not here; everything below runs in every shard)
function moonPos(t) { return api.moonPos(t); }
console.log(log.slice(0, 12).join('\n'));
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
