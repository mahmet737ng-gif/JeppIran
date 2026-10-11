const assert=require("node:assert/strict");
const overlay=require("../web/taxi-runway-render.js");
const nodes={
  ST:{lat:36,lon:59},Q0:{lat:36,lon:59.0001},
  HOLD:{lat:36,lon:59.0002},RW0:{lat:36.0001,lon:59.0002},
  RW1:{lat:36.0006,lon:59.0002},RW2:{lat:36.0011,lon:59.0002},
  D0:{lat:36.0012,lon:59.0002},D1:{lat:36.00125,lon:59.0003}
};
const edges=[
  {from:"ST",to:"Q0",taxiway:"Q"},
  {from:"Q0",to:"HOLD",taxiway:"Q"},
  {from:"HOLD",to:"RW0",taxiway:"BT31L",runway:true,
    runwayAccessCandidate:true,geometry:"projected-hold-to-runway-AXIS-QA-not-surveyed"},
  {from:"RW0",to:"RW1",taxiway:"BT31L",runway:true,
    geometry:"reviewed-ADC-runway-axis",bidirectional:false},
  {from:"RW1",to:"RW2",taxiway:"BT31L",runway:true,
    geometry:"axis-between-reviewed-runway-vectors-QA-NOT-SURVEYED",bidirectional:false},
  {from:"RW2",to:"D0",taxiway:"BT31L",runway:true,
    runwayAccessCandidate:true,geometry:"projected-hold-to-runway-AXIS-QA-not-surveyed"},
  {from:"D0",to:"D1",taxiway:"D"}
];
const graph={airport:"OIMM",nodes,edges};
const sequence=["ST","Q0","HOLD","RW0","RW1","RW2","D0","D1"];
const segments=overlay.parts(graph,{path:sequence,taxiways:["Q","BT31L","D"]});
assert(segments);
assert.equal(segments.runway.length,2,"backtrack is exactly the two runway centreline edges");
assert.equal(segments.projections.length,2,"two unsurveyed feet must be visibly separated");
assert.equal(segments.invalid.length,0);
assert.equal(segments.runs.length,5);
assert.equal(segments.runs[2].type,"runway-axis");
assert.deepEqual(segments.runs[2].nodes,["RW0","RW1","RW2"]);
assert.equal(segments.runs.at(-1).type,"taxiway");
assert.deepEqual(segments.runs.at(-1).nodes,["D0","D1"],"D must extend to last chart-mapped endpoint");
const noEdge=overlay.parts({...graph,edges:edges.filter(e=>e.from!=="RW1")},
  {path:sequence,taxiways:["Q","BT31L","D"]});
assert.equal(noEdge.invalid.length,1,"no straight-line replacement for a missing runway edge");
// The old V2621 graphic centerline contains a shoulder leg on either end.
// Those MUST NOT be drawn as uninterrupted solid runway axes.
const shoulderGraph={airport:"OIMM",nodes,edges:[
  {from:"HOLD",to:"RW0",taxiway:"BT13R",runway:true,bidirectional:false,
   geometry:"reviewed-ADC-runway-axis"},
  {from:"RW0",to:"RW1",taxiway:"BT13R",runway:true,bidirectional:false,
   geometry:"reviewed-ADC-runway-axis"},
  {from:"RW1",to:"D0",taxiway:"BT13R",runway:true,bidirectional:false,
   geometry:"reviewed-ADC-runway-axis"},
  {from:"D0",to:"D1",taxiway:"H",bidirectional:true}
],taxiways:{J:{exitNode:"HOLD"},H:{nodes:["D0","D1"]}},
runwayBacktracks:{BT13R:{fromTaxiway:"J",toTaxiway:"H"}}};
const typed=overlay.parts(shoulderGraph,{path:["HOLD","RW0","RW1","D0","D1"],
  taxiways:["J","BT13R","H"]});
assert.equal(typed.runway.length,1,"only the middle runway axis is solid");
assert.equal(typed.projections.length,2,"BT entry/exit shoulder legs must be amber dashed");
assert.equal(typed.runs.at(-1).way,"H");
// Regression on the ORIGINAL 1.3MB OIMM chart graph, not only fixtures.
// The old 10-9B-to-ADC interpolation bent the magenta line onto the runway
// border. Both runway names must now share a straight H/M/D midpoint axis.
const fs=require("node:fs");
const oimm=JSON.parse(fs.readFileSync("web/data/taxi-networks/OIMM.json","utf8"));
const axis=overlay.adcMidline(oimm);
assert(axis,"ADC boundary midpoint was not derived");
assert(axis.spanMetres>3600&&axis.spanMetres<4200);
for(const way of ["BT13R","BT31L"]){
  const es=oimm.edges.filter(e=>e.runway&&e.taxiway===way);
  assert(es.length>100,way+" must have source runway vertices");
  const path=[es[0].from,...es.map(e=>e.to)];
  const route={path,taxiways:[way]};
  const full=overlay.parts(oimm,route);
  const rendered=overlay.displayRuns(oimm,{...route,runwayRender:full});
  assert(rendered?.axis&&rendered.runway.length,way+" midpoint renderer failed");
  assert.equal(rendered.invalid.length,0,way+" must not produce a warped axis");
  for(const section of rendered.runway){
    for(const p of section.coordinates){
      const snapped=axis.project(p);
      assert(Math.abs(p.lat-snapped.lat)<1e-9&&Math.abs(p.lon-snapped.lon)<1e-9,
        way+" must lie exactly on a common straight ADC midline");
    }
  }
  assert(rendered.runs.some(r=>r.type==="projected-access"),
    way+" must visually disclose the chart-only shoulder connection");
}
console.log("OIMM EXACT AXIS / COMPLETE D / PROJECTED ACCESS DISPLAY QA: PASS");
