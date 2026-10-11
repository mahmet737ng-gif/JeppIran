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
console.log("OIMM EXACT AXIS / COMPLETE D / PROJECTED ACCESS DISPLAY QA: PASS");
