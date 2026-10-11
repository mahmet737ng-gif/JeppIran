/* Browser smoke test: newly digitized airport is automatically selected
 * by TAXI without writing or copying an airport-specific handler.
 */
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const generic=require("../web/taxi-engine.js");
const source=JSON.parse(fs.readFileSync("tests/fixtures/taxi-engine/ZZZZ.json","utf8"));
const graph={...source,enabled:true,
  source:{...source.source,reviewStatus:"SIM_QA_REVIEWED"}};
const elements=new Map(),listeners=new Map();
function el(id){
  if(["pdfCanvas","chartTransformLayer","taxiQaStandMap"].includes(id))return null;
  if(!elements.has(id))elements.set(id,{
    value:"",innerHTML:"",textContent:"",hidden:false,dataset:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    addEventListener(){},setAttribute(){},replaceChildren(){}
  });
  return elements.get(id);
}
const mockNode=()=>({textContent:"",setAttribute(){},appendChild(){}});
const ctx={
 window:{
   JEPPIRAN_TAXI_ENGINE:generic,
   addEventListener(event,handler){listeners.set(event,handler)},
   dispatchEvent(){}
 },
 document:{getElementById:el,querySelector:()=>({textContent:""}),
   createElement:mockNode,createElementNS:mockNode},
 selectedAirport:"ZZZZ",selectedChart:{page:1,category:"Airport",chart_number:"10-9"},
 manifest:{cycle:"2621"},lastPosition:null,georefByPage:new Map(),charts:[],console,
 fetch:async url=>{
   assert(url.endsWith("/ZZZZ.json"),"No unrelated network should be requested");
   return {ok:true,json:async()=>graph};
 }
};
vm.createContext(ctx);
let script=fs.readFileSync("web/taxi-mode.js","utf8");
script=script.replace("})();","window.test={taxi,fetchGraph,go,genericGo,renderRoutePreview};})();");
vm.runInContext(script,ctx);
(async()=>{
 const qa=ctx.window.test;qa.taxi.active=true;qa.taxi.airport="ZZZZ";
 const data=await qa.fetchGraph("ZZZZ");
 assert.equal(data.airport,"ZZZZ");
 assert.equal(qa.taxi.genericEngine.airport,"ZZZZ");
 assert(el("taxiQaAutoDestination").innerHTML.includes("STAND 101"));
 assert(el("taxiQaAutoDestination").innerHTML.includes("RWY 13R"));
 el("taxiQaInput").value="ST101 ST109";
 qa.go();
 assert(qa.taxi.route?.genericRoute,"Web route was not delegated to reusable engine");
 assert.equal(qa.taxi.route.airport,"ZZZZ");
 assert(!qa.taxi.route.edges.some(e=>e.kind==="runway"));
 assert(qa.taxi.route.genericLinework?.length,"Web must render real centerline polylines");
 qa.renderRoutePreview();
 assert.equal(el("taxiQaRoutePreview").hidden,true,"No route miniature for reusable engine");
 el("taxiQaInput").value="ST101 J BT13R H 13L";
 qa.go();
 assert.equal(qa.taxi.route,null,"Unsafe projected runway links must not activate by default");
 el("taxiQaInput").value="QA ST101 J BT13R H 13L";
 qa.go();
 assert(qa.taxi.route?.genericRoute,"Explicit QA preview must be possible");
 assert(qa.taxi.route.genericLinework.some(e=>e.style==="dashed-amber"),
   "Projected legs cannot be drawn as solid taxi clearance");
 assert.equal(qa.taxi.genericMonitor,null,"Unverified backtracks must not auto-replan");
 assert.match(el("taxiQaStatus").textContent,/QA|NOT FOR ACTUAL/i);
 // New airport is selected only when cycle/source signoff match. Never
 // introduce unsafe fallback routing if this is a different chart cycle.
 qa.taxi.genericEngine=null;
 ctx.manifest.cycle="2620";
 const fail=await qa.fetchGraph("ZZZZ");
 assert(!fail);
 assert.equal(qa.taxi.genericEngine,null);
 console.log("GENERIC WEB TAXI: auto-register reviewed ICAO; route, overlay, QA-only BT and stale-cycle guard PASS");
})().catch(e=>{console.error(e);process.exitCode=1});
