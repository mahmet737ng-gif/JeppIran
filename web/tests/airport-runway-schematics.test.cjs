const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"../..");
const script=fs.readFileSync(path.join(root,"web/airport-runway-schematics.js"),"utf8");
const css=fs.readFileSync(path.join(root,"web/airport-runway-schematics.css"),"utf8");
const index=fs.readFileSync(path.join(root,"web/index.html"),"utf8");
const runways=JSON.parse(fs.readFileSync(path.join(root,"app/src/main/assets/airport-runways.json"),"utf8")).airports;

const samples={
  OTHH:[["16L","34R",156,4850],["16R","34L",156,4250]],
  OIII:[["11L","29R",105,3876],["11R","29L",105,4035]],
  OIIE:[["11L","29R",104,4198],["11R","29L",104,4092]],
  OITL:[["15","33",145,3298],["07","25",70,2500]],
  UDYZ:[["08","26",83,3850]]
};

test("five runway schematic samples match canonical V2621 runway data",()=>{
  assert.deepEqual(Object.keys(samples),["OTHH","OIII","OIIE","OITL","UDYZ"]);
  for(const[icao,pairs]of Object.entries(samples)){
    const records=runways[icao];
    assert.ok(records,icao+" missing from runway registry");
    for(const[a,b,heading,length]of pairs){
      const first=records.find(record=>record.name===a);
      const second=records.find(record=>record.name===b);
      assert.ok(first&&second,icao+" "+a+"/"+b+" missing");
      assert.equal(first.headingAdc,heading,icao+" "+a+" heading");
      assert.equal(first.length,length,icao+" "+a+" length");
      assert.equal(second.length,length,icao+" "+b+" length");
      assert.ok(script.includes('["'+a+'","'+b+'",'+heading+','+length),icao+" layout missing");
    }
  }
});

test("prototype is loaded, responsive, interactive and explicitly display-only",()=>{
  assert.match(index,/airport-runway-schematics\.css\?v=2621-runway-schematic-samples-r1/);
  assert.match(index,/airport-runway-schematics\.js\?v=2621-runway-schematic-samples-r1/);
  assert.match(script,/role="button"/);
  assert.match(script,/DISPLAY ONLY/);
  assert.match(script,/\.rwy-row/);
  assert.match(css,/@media\(max-width:780px\)/);
  assert.match(css,/prefers-reduced-motion/);
});
