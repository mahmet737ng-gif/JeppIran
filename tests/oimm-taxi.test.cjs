const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const graph=JSON.parse(fs.readFileSync('web/data/taxi-networks/OIMM.json','utf8'));
const elements=new Map();
function el(id){if(['pdfCanvas','chartTransformLayer','taxiQaStandMap'].includes(id))return null;
 if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},addEventListener(){},replaceChildren(){}});return elements.get(id);}
const mockNode=()=>({textContent:'',setAttribute(){},appendChild(){}});
const ctx={window:{addEventListener(){}},document:{getElementById:el,querySelector:()=>({textContent:''}),createElement:mockNode,createElementNS:mockNode},
 selectedAirport:'OIMM',selectedChart:{page:601,category:'Airport',chart_number:'10-9'},manifest:{cycle:'2621'},
 lastPosition:null,georefByPage:new Map(),charts:[],console};vm.createContext(ctx);
let code=fs.readFileSync('web/taxi-mode.js','utf8');code=code.replace('})();','window.test={taxi,parse,shortest,adjacent,graphOk,go,routeDeviationMeters};})();');vm.runInContext(code,ctx);
const t=ctx.window.test;t.taxi.airport='OIMM';t.taxi.graph=graph;t.taxi.active=true;t.taxi.standReference={stands:graph.stands};
assert.equal(t.graphOk(graph,'OIMM'),true);assert.equal(t.graphOk({...graph,cycle:'2620'},'OIMM'),false);
assert.equal(Object.keys(graph.stands).length,34);assert.equal(Object.keys(graph.taxiways).length,18);
for(const s of Object.values(graph.stands))assert(s.node&&graph.nodes[s.node]&&s.labelBounds&&s.publishedINS);
for(const form of ['ST101 A','101 A','STAND 101 A','P101 A'])assert.equal(t.parse(form).startStand,'101');
assert.equal(t.parse('STD109 J BT13R H').startStand,'109');
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
const backtrackEdges=new Set(t.taxi.route.path.slice(0,-1).map((n,i)=>n+'>'+t.taxi.route.path[i+1]));
assert(graph.edges.some(e=>e.runway&&e.taxiway==='BT31L'&&backtrackEdges.has(e.from+'>'+e.to)));
assert.equal(t.adjacent(graph)[graph.taxiways.A.exitNode]?.some(e=>e.way==='BT31L'),false);
el('taxiQaInput').value='ST113 A D';t.go();assert.equal(t.taxi.route,null,'implicit runway crossing forbidden');
el('taxiQaInput').value='ST113 BT31L D';t.go();assert.equal(t.taxi.route,null,'explicit A approach required');
el('taxiQaInput').value='ST109 BT13R H';t.go();assert.equal(t.taxi.route,null,'explicit J approach required');
// Live simulator route, as opposed to named stand preview, enables deviation tracking.
ctx.lastPosition=graph.nodes[graph.stands['101'].node];el('taxiQaInput').value='A';t.go();assert(t.taxi.route&&!t.taxi.route.previewOnly);
assert(t.routeDeviationMeters(ctx.lastPosition)<1);
assert(t.routeDeviationMeters({lat:ctx.lastPosition.lat+.01,lon:ctx.lastPosition.lon})>500);
// Preserve LTFM explicit alphanumeric stand parsing.
t.taxi.airport='LTFM';t.taxi.graph={stands:{}};t.taxi.standReference=null;
assert.equal(t.parse('STD3 T5 N2').startStand,'D3');assert.equal(t.parse('34L2A').kind,'procedure');
console.log(JSON.stringify({standToHoldRoutesPassed:checks,parserAndLivePositionChecks:'passed',runwayAndMilitaryExclusions:'passed'}));
