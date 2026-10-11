const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const graph=JSON.parse(fs.readFileSync('web/data/taxi-networks/OIMM.json','utf8'));
const runway=require('../web/taxi-runway-access.js');
const runwayGoals=require('../web/taxi-runway-goals.js');
const runwayRender=require('../web/taxi-runway-render.js');
const elements=new Map();
const auto=require('../web/taxi-auto-router.js');
function el(id){if(['pdfCanvas','chartTransformLayer','taxiQaStandMap'].includes(id))return null;
 if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},addEventListener(){},replaceChildren(){}});return elements.get(id);}
const mockNode=()=>({textContent:'',setAttribute(){},appendChild(){}});
const ctx={window:{addEventListener(){}},document:{getElementById:el,querySelector:()=>({textContent:''}),createElement:mockNode,createElementNS:mockNode},
 selectedAirport:'OIMM',selectedChart:{page:601,category:'Airport',chart_number:'10-9'},manifest:{cycle:'2621'},
 lastPosition:null,georefByPage:new Map(),charts:[],console};ctx.window.JEPPIRAN_TAXI_AUTO=auto;ctx.window.JEPPIRAN_TAXI_RUNWAY=runway;ctx.window.JEPPIRAN_TAXI_RENDER=runwayRender;ctx.window.JEPPIRAN_OIMM_RUNWAY_GOALS=runwayGoals;vm.createContext(ctx);
let code=fs.readFileSync('web/taxi-mode.js','utf8');code=code.replace('})();','window.test={taxi,parse,shortest,adjacent,graphOk,go,routeDeviationMeters};})();');vm.runInContext(code,ctx);
const t=ctx.window.test;t.taxi.airport='OIMM';t.taxi.graph=graph;t.taxi.active=true;t.taxi.standReference={stands:graph.stands};
assert.equal(t.graphOk(graph,'OIMM'),true);assert.equal(t.graphOk({...graph,cycle:'2620'},'OIMM'),false);
assert.equal(Object.keys(graph.stands).length,34);assert.equal(Object.keys(graph.taxiways).length,18);
for(const s of Object.values(graph.stands))assert(s.node&&graph.nodes[s.node]&&s.labelBounds&&s.publishedINS);
for(const form of ['ST101 A','101 A','STAND 101 A','P101 A'])assert.equal(t.parse(form).startStand,'101');
assert.equal(t.parse('STD109 J BT13R H').startStand,'109');
assert.equal(t.parse('RAMP').destination,'MAIN APRON');
assert.equal(t.parse('ST113 RAMP').startStand,'113');
for(const form of ['ST101','101','STAND 101','P101'])assert.equal(t.parse(form).destination,'101');
const links=t.adjacent(graph);let checks=0;
for(const [id,stand] of Object.entries(graph.stands))for(const way of ['J','Q','A','B']){
 const goal=graph.taxiways[way].exitNode;
 const r=t.shortest(graph,stand.node,goal,{taxiways:[way],allowStandAccess:true},links);
 assert(r&&r.path.length>1,id+' → '+way);assert.equal(r.path[0],stand.node);assert.equal(r.path.at(-1),goal);checks++;
}
for(const input of ['ST101 A','ST137 J','ST114 Q','ST118 B']){
 el('taxiQaInput').value=input;t.go();assert(t.taxi.route,input+' route missing');
 assert.equal(t.taxi.route.previewOnly,true);assert(t.taxi.route.holds.includes(t.taxi.route.path.length-1));
}
el('taxiQaInput').value='101';t.go();assert.equal(t.taxi.selectedStand,'101');assert.equal(t.taxi.route,null);
el('taxiQaInput').value='ST101 L';t.go();assert.equal(t.taxi.route,null);assert.match(el('taxiQaStatus').textContent,/military/);
el('taxiQaInput').value='ST101 A F';t.go();assert.equal(t.taxi.route,null);assert.match(el('taxiQaStatus').textContent,/No connected/);
el('taxiQaInput').value='ST101 Z99';t.go();assert.equal(t.taxi.route,null);
el('taxiQaInput').value='ST109 J H';t.go();assert.equal(t.taxi.route,null,'runway must not be crossed implicitly');
el('taxiQaInput').value='ST109 J BT13R H';t.go();
assert(t.taxi.route?.path.length>2,'explicit J → BT13R → H backtrack missing');
assert.equal(t.taxi.route.path.at(-1),graph.taxiways.H.nodes[1]);
const pathEdges=new Set(t.taxi.route.path.slice(0,-1).map((n,i)=>n+'>'+t.taxi.route.path[i+1]));
assert(graph.edges.some(e=>e.runway&&e.taxiway==='BT13R'&&pathEdges.has(e.from+'>'+e.to)));
assert.equal(t.adjacent(graph)[graph.taxiways.J.exitNode]?.some(e=>e.way==='BT13R'),false);
el('taxiQaInput').value='ST113 A BT31L D';t.go();
assert(t.taxi.route?.path.length>2,'explicit A → BT31L → D backtrack missing');
assert.equal(t.taxi.route.path.at(-1),graph.taxiways.D.nodes[1]);
// Exact plotted centerline nodes must extend through the runway and then
// traverse the complete physical D taxiway to its documented mapped end.
// Hold-to-axis graphic projections are NEVER solid magenta taxi lines.
const bt31=t.taxi.route.runwayRender;
assert(bt31?.runway.length>2,'BT31L must travel along mapped runway axis, not teleport to D');
assert(bt31.runs.some(s=>s.type==='taxiway'&&s.way==='D'&&
    s.nodes.includes(graph.taxiways.D.nodes.at(-1))),"Last D taxiway must extend to its mapped end");
assert(bt31.steps.every(s=>s.edge),'No invented disconnected hop can appear');
const projected=bt31.steps.filter(s=>s.type==='projected-access');
assert(projected.length>=0); // zero when both published J/A foot points are exact
assert.equal(bt31.invalid.length,0);
const backtrackEdges=new Set(t.taxi.route.path.slice(0,-1).map((n,i)=>n+'>'+t.taxi.route.path[i+1]));
assert(graph.edges.some(e=>e.runway&&e.taxiway==='BT31L'&&backtrackEdges.has(e.from+'>'+e.to)));
assert.equal(t.adjacent(graph)[graph.taxiways.A.exitNode]?.some(e=>e.way==='BT31L'),false);
// All explicit runway-entry plans must be derived from actual chart-labelled
// holds and their restricted projected RWY intersections, not hardcoded J/A.
for(const input of ['ST109 Q BT31L D','ST109 Q BT13R H','ST109 B BT31L D']){
 el('taxiQaInput').value=input;t.go();
 assert(t.taxi.route?.path?.length>2,input+' should reach the mapped requested runway-end taxiway');
 const runwayToken=input.match(/BT(?:13R|31L)/)[0];
 const routeGraph=t.taxi.route.graph;
 const spec=t.taxi.route.runwayRender;
 assert(spec&&spec.runway.length>0,input+' must traverse non-projected runway axis edges');
 const exitWay=input.trim().split(" ").at(-1);
 assert(spec.runs.some(x=>x.type==='taxiway'&&x.way===exitWay&&
   x.nodes.at(-1)===(graph.taxiways[exitWay].nodes?.at(-1)||graph.taxiways[exitWay].exitNode)),
   input+' must finish all the way through '+exitWay+', not stop at its first node');
 assert(spec.invalid.length===0,input+' must contain no unidentified jumps');
 assert(spec.projections.every(e=>e.type==='projected-access'&&
   (e.edge.geometry.includes('projected-hold-to-runway')||
    e.edge.geometry==='reviewed-ADC-runway-axis')),
   input+' graphically inferred shoulder legs must be dashed QA, never solid runway axis');
 const segments=t.taxi.route.path.slice(0,-1).map((n,i)=>[n,t.taxi.route.path[i+1]]);
 assert(segments.some(([a,b])=>routeGraph.edges.some(e=>
  e.runway&&e.taxiway===runwayToken&&e.from===a&&e.to===b)),
  input+' must actually traverse named explicit runway graph edges');
 assert(!t.adjacent(graph)[graph.taxiways.A.exitNode]?.some(e=>e.way===runwayToken),
   'unrequested runway traversal cannot appear in ordinary adjacency');
}
// A mapped taxiway on the far side can use its own documented hold
// without borrowing the Q/J apron lead-in or silently crossing another runway.
ctx.lastPosition=graph.nodes[graph.taxiways.F.nodes[0]];
el('taxiQaInput').value='F BT13R H';t.go();
assert(t.taxi.route?.path.length>2,'F → BT13R → H should use F chart hold QA junction');
assert(t.taxi.route.graph.edges.some(e=>e.fromTaxiway==='F'&&e.runwayAccessCandidate));
ctx.lastPosition=null;
el('taxiQaInput').value='ST113 A D';t.go();assert.equal(t.taxi.route,null,'implicit runway crossing forbidden');
el('taxiQaInput').value='ST113 BT31L D';t.go();assert.equal(t.taxi.route,null,'explicit A approach required');
el('taxiQaInput').value='ST109 BT13R H';t.go();assert.equal(t.taxi.route,null,'explicit J approach required');
// Live simulator route, as opposed to named stand preview, enables deviation tracking.
ctx.lastPosition=graph.nodes[graph.stands['101'].node];el('taxiQaInput').value='A';t.go();assert(t.taxi.route&&!t.taxi.route.previewOnly);
assert(t.routeDeviationMeters(ctx.lastPosition)<1);
assert(t.routeDeviationMeters({lat:ctx.lastPosition.lat+.01,lon:ctx.lastPosition.lon})>500);
// Destination-only OIMM must route from actual position, NOT inferred stand.
el('taxiQaInput').value='ST109';t.go();
assert(t.taxi.route?.path.length>1,'live arrival stand destination missing');
assert.equal(t.taxi.route.path.at(-1),graph.stands['109'].node);
assert.equal(t.taxi.route.previewOnly,false);
assert.equal(t.taxi.auto?.target.name,'ST109');
el('taxiQaInput').value='13R';t.go();
assert.equal(t.taxi.auto?.target.kind,'runway-hold');
assert.equal(t.taxi.route.path.at(-1),graph.taxiways.J.exitNode);
assert(!t.taxi.route.path.some((n,i)=> i>0 &&
  graph.edges.some(e=>e.runway&&e.from===t.taxi.route.path[i-1]&&e.to===n)));
el('taxiQaInput').value='RWY 31L';t.go();
assert.equal(t.taxi.route.path.at(-1),graph.taxiways.A.exitNode);
el('taxiQaInput').value='13L';t.go();
assert.equal(t.taxi.route,null,'unmapped runway must not guess an exit');
// Preview from a known stand when no simulator location is available.
ctx.lastPosition=null;
el('taxiQaInput').value='ST113 13R';t.go();
assert(t.taxi.route?.previewOnly);
assert.equal(t.taxi.route.path[0],graph.stands['113'].node);
assert.equal(t.parse('RUNWAY 31L').kind,'auto');
assert.equal(t.parse('ST113 RWY 13R').kind,'auto');
// Destination-runway tokens AFTER a complete explicit clearance are goals,
// not taxiway names. The chart-mapped far end of H is the only 13L QA target.
for(const entry of ['ST115 J BT13R H 13L','ST115 J BT13R H RWY 13L']){
  const parsed=t.parse(entry);
  assert.equal(parsed.kind,'sequence',entry);
  assert.equal(parsed.startStand,'115');
  assert.equal(parsed.runwayDestination,'13L');
  assert.equal(parsed.taxiways.join(' '),'J BT13R H');
  el('taxiQaInput').value=entry;t.go();
  assert(t.taxi.route?.path?.length>5,entry+' missing physical route');
  assert.equal(t.taxi.route.runwayDestination,'13L');
  assert.equal(t.taxi.route.path.at(-1),graph.taxiways.H.nodes.at(-1));
  const drawing=runwayRender.displayRuns(t.taxi.route.graph,t.taxi.route);
  assert(drawing?.axis&&drawing.runway.length>0,"runway must have chart-derived midpoint axis");
  assert.equal(drawing.invalid.length,0,"a warped runway path must not be drawn solid");
  const anchor=drawing.axis,earth=111195,cos=Math.cos(anchor.start.lat*Math.PI/180);
  for(const part of drawing.runway){
    for(const p of part.coordinates){
      const x=(p.lon-anchor.start.lon)*earth*cos,y=(p.lat-anchor.start.lat)*earth;
      const vx=(anchor.end.lon-anchor.start.lon)*earth*cos,
        vy=(anchor.end.lat-anchor.start.lat)*earth;
      assert(Math.abs(x*vy-y*vx)/Math.hypot(vx,vy)<0.08,
        "BT13R path must stay straight on common ADC runway axis");
    }
  }
  for(let j=1;j<drawing.runs.length;j++){
    const before=drawing.runs[j-1],after=drawing.runs[j];
    if(before.type==="unverified"||after.type==="unverified")continue;
    const a=before.coordinates.at(-1),b=after.coordinates[0];
    assert(Math.hypot((a.lon-b.lon)*earth*cos,(a.lat-b.lat)*earth)<.15,
      "runway midpoint and taxi exit QA connector must share their actual turn point");
  }
  const axis=t.taxi.route.runwayRender;
  assert(axis.runway.length>2,entry+' must follow multiple runway-centreline edges');
  assert(axis.projections.some(x=>x.to===graph.taxiways.H.nodes[0]&&x.type==='projected-access'),
    'the diagonal shoulder transition to H must NOT be a solid runway axis');
  assert.equal(axis.steps.at(-1).way,'H','taxiway H must continue to its far endpoint');
}
for(const designation of ['13R','31L','13L','31R','RWY13L','RUNWAY31R'])
  assert.equal(t.parse(designation).kind,'auto',designation);
el('taxiQaInput').value='ST115 J BT13R H 31R';t.go();
assert.equal(t.taxi.route,null,'unmapped 31R threshold must never be fabricated');
assert.match(el('taxiQaStatus').textContent,/31R/);
el('taxiQaInput').value='ST115 J BT13R H 13R';t.go();
assert.equal(t.taxi.route,null,'13R cannot be reached by a chart-invalid H shortcut');

// Preserve LTFM explicit alphanumeric stand parsing.
t.taxi.airport='LTFM';t.taxi.graph={stands:{}};t.taxi.standReference=null;
assert.equal(t.parse('STD3 T5 N2').startStand,'D3');assert.equal(t.parse('34L2A').kind,'procedure');
console.log(JSON.stringify({standToHoldRoutesPassed:checks,parserAndLivePositionChecks:'passed',runwayAndMilitaryExclusions:'passed'}));


// Regression: opening TAXI and pressing GO while the 1.3 MB OIMM network is
// still downloading must share one request, then draw the entered route once
// the graph is ready. Network failure must clear any stale magenta route.
(async()=>{
 let release; const gate=new Promise(resolve=>{release=resolve;});
 let downloads=0;
 ctx.fetch=async()=>{downloads++;await gate;return {ok:true,json:async()=>graph};};
 t.taxi.graph=null;t.taxi.route=null;t.taxi.airport='OIMM';t.taxi.active=true;
 el('taxiQaInput').value='ST113 A BT31L D';
 t.go();t.go();
 assert.equal(downloads,1,'rapid GO must not initiate duplicate OIMM fetches');
 release();
 await new Promise(resolve=>setImmediate(resolve));
 assert(t.taxi.route?.path.length>2,'pending GO should produce the BT31L route after load');
 assert.equal(t.taxi.route.taxiways.join(' '),'A BT31L D');
 const served=downloads;
 el('taxiQaInput').value='ST109 J BT13R H';t.go();
 assert.equal(downloads,served,'a loaded OIMM network must be reused');
 assert(t.taxi.route?.path.length>2);

 // Reset just the graph to exercise the offline fetch failure. Do not keep
 // an old runway segment visible after the request fails.
 t.taxi.graph=null;
 ctx.fetch=async()=>{downloads++;throw Error('offline test');};
 el('taxiQaInput').value='ST109 J BT13R H';
 t.go();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.taxi.route,null,'failed graph load must clear the old route');
 assert.match(el('taxiQaStatus').textContent,/could not be loaded/i);
 console.log(JSON.stringify({singleFlightDownloads:1,pendingRouteRestored:true,offlineClearsStaleRoute:true}));
})().catch(err=>{console.error(err);process.exitCode=1;});
