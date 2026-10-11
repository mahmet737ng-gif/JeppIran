/* JEPPIRAN reusable named-taxiway adjacency index — simulator QA only.
 * One physical centerline edge knows its endpoints and name. A named taxiway
 * knows ONLY other taxiways sharing a mapped junction node. No proximity joins,
 * runway shortcuts or implied stand/pushback connections.
 * The node graph (not a label-only shortcut) remains the routing authority.
 */
(function(root) {
"use strict";
const M = 111195;
const memo = new WeakMap();
const normalize = value => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
function meters(a, b) {
  return Math.hypot((a.lat-b.lat)*M, (a.lon-b.lon)*M*
    Math.cos((a.lat+b.lat)*Math.PI/360));
}
function inspect(graph) {
  if (!graph || !graph.nodes || !Array.isArray(graph.edges)) {
    throw new TypeError("A taxi graph needs nodes and edges");
  }
  if (memo.has(graph)) return memo.get(graph);
  const ways = new Map(), namesByNode = new Map();
  const addNodeName = (node, label) => {
    if (!namesByNode.has(node)) namesByNode.set(node, new Set());
    namesByNode.get(node).add(label);
  };
  for (const edge of graph.edges) {
    const a = graph.nodes[edge.from], b = graph.nodes[edge.to];
    if (!a || !b || edge.closed || edge.military || edge.runway ||
        edge.from === edge.to) continue;
    const label = normalize(edge.taxiway);
    if (!label || label === "UNNAMED" || label === "STAND") continue;
    if (!ways.has(label)) ways.set(label, {
      label, nodes:new Set(), segments:0, lengthMeters:0,
      degree:new Map(), edges:[], adjacent:new Map()
    });
    const entry=ways.get(label);
    entry.nodes.add(edge.from); entry.nodes.add(edge.to);
    entry.segments++;
    entry.lengthMeters += meters(a, b);
    entry.edges.push(edge);
    entry.degree.set(edge.from,(entry.degree.get(edge.from)||0)+1);
    entry.degree.set(edge.to,(entry.degree.get(edge.to)||0)+1);
    addNodeName(edge.from,label); addNodeName(edge.to,label);
  }
  for (const [node, labels] of namesByNode) {
    if (labels.size<2) continue;
    for (const left of labels) for (const right of labels) {
      if (left===right) continue;
      const links=ways.get(left).adjacent;
      if (!links.has(right)) links.set(right,new Set());
      links.get(right).add(node);
    }
  }
  const index={airport:normalize(graph.airport),cycle:String(graph.cycle||""),
    source:graph.source||null,verified:graph.verified===true,ways,
    nodes:graph.nodes};
  memo.set(graph,index);
  return index;
}
function neighbors(graph,taxiway) {
  const entry=inspect(graph).ways.get(normalize(taxiway));
  if (!entry) return [];
  return [...entry.adjacent].map(([taxiway, ids])=>({
    taxiway, junctions:[...ids].sort().map(node=>({
      node,lat:graph.nodes[node].lat,lon:graph.nodes[node].lon
    }))
  })).sort((a,b)=>a.taxiway.localeCompare(b.taxiway,undefined,{numeric:true}));
}
function taxiway(graph,taxiwayName) {
  const entry=inspect(graph).ways.get(normalize(taxiwayName));
  if (!entry) return null;
  const endpoints=[...entry.degree].filter(([,degree])=>degree===1)
    .map(([node])=>({node,lat:graph.nodes[node].lat,lon:graph.nodes[node].lon}));
  // A label may contain separate disconnected pieces: don't imply a route
  // can travel through the entire label just because its name matches.
  const local=new Map();
  for (const edge of entry.edges) {
    if (!local.has(edge.from)) local.set(edge.from,[]);
    if (!local.has(edge.to)) local.set(edge.to,[]);
    local.get(edge.from).push(edge.to);local.get(edge.to).push(edge.from);
  }
  let parts=0;const seen=new Set();
  for (const node of entry.nodes) {
    if(seen.has(node)) continue;
    parts++;seen.add(node);const todo=[node];
    while(todo.length) for (const next of local.get(todo.pop())||[])
      if(!seen.has(next)){seen.add(next);todo.push(next)}
  }
  return {label:entry.label,segments:entry.segments,nodeCount:entry.nodes.size,
    lengthMeters:Math.round(entry.lengthMeters),parts,endpoints,
    neighbors:neighbors(graph,entry.label)};
}
function labelPath(graph,from,to) {
  // Fast topology *suggestion* only. It does not guarantee an aircraft can
  // traverse the given taxiways in order; node-level routing must confirm.
  const index=inspect(graph),source=normalize(from),dest=normalize(to);
  if(!index.ways.has(source)||!index.ways.has(dest))return null;
  if(source===dest)return [source];
  const queue=[source],parent=new Map([[source,null]]);
  for(let i=0;i<queue.length;i++){
    const current=queue[i];
    for(const n of index.ways.get(current).adjacent.keys()){
      if(parent.has(n))continue;
      parent.set(n,current);
      if(n===dest){
        const path=[];for(let x=dest;x!==null;x=parent.get(x))path.push(x);
        return path.reverse();
      }
      queue.push(n);
    }
  }
  return null;
}
function nodeLinks(graph,options={}) {
  // Compatible with the existing taxi-mode shortest-path engine. Cached once
  // per airport graph and explicit runway-backtrack permission.
  const index=inspect(graph);
  if(!index.linkCache)index.linkCache=new Map();
  const selected=normalize(options.runwayWay||"");
  if(index.linkCache.has(selected))return index.linkCache.get(selected);
  const result={};
  for (const edge of graph.edges){
    const a=graph.nodes[edge.from],b=graph.nodes[edge.to];
    if(!a||!b||edge.closed||edge.military)continue;
    if(edge.runway&&!(selected && normalize(edge.taxiway)===selected &&
      graph.runwayBacktracks?.[selected]?.requiresExplicitClearance))continue;
    const length=meters(a,b);
    if(!(length>(graph.airport==="OIMM"?0.00001:0.1)&&length<12000))continue;
    (result[edge.from]??=[]).push({to:edge.to,way:normalize(edge.taxiway),
      cost:length,access:edge.allowStandAccess===true});
    if(edge.bidirectional!==false)(result[edge.to]??=[]).push({
      to:edge.from,way:normalize(edge.taxiway),cost:length,
      access:edge.allowStandAccess===true});
  }
  index.linkCache.set(selected,result);
  return result;
}
function snapshot(graph,chartOnly={}) {
  const i=inspect(graph),items={};
  for(const label of [...i.ways.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
    items[label]=taxiway(graph,label);
  }
  // Imported text labels with no matching centerline must NEVER be routed
  // using a visually close but unconnected segment.
  const unmapped=Object.keys(chartOnly).filter(x=>!i.ways.has(x)).sort();
  return {schemaVersion:1,kind:"taxiway-adjacency-cache",airport:i.airport,
    cycle:i.cycle,verifiedForNavigation:i.verified,simulationOnly:graph.simulatorTestOnly===true,
    source:i.source?.provider||"unknown",
    note:"Junctions require a shared mapped node. No inferred stand links, runway crossings or missing geometry.",
    stats:{namedTaxiways:Object.keys(items).length,chartOnlyLabels:unmapped.length,
      physicalNodes:Object.keys(graph.nodes).length,physicalEdges:graph.edges.length},
    taxiways:items,chartOnlyWithoutMappedCenterline:unmapped};
}
const api={inspect,neighbors,taxiway,labelPath,nodeLinks,snapshot};
root.JEPPIRAN_TAXI_ADJACENCY=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
