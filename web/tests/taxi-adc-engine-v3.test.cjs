"use strict";
const assert=require("node:assert/strict");
const v3=require("../taxi-adc-engine-v3.js");
const context={taxiwayNames:["E1","E2","E3"],runwayDesignators:["11L"]};
assert.equal(v3.classifyLabel("HS1",context).kind,"HOTSPOT");
assert.equal(v3.classifyLabel("E2",context).kind,"TAXIWAY");
assert.equal(v3.classifyLabel("11L",context).kind,"RUNWAY");
assert.equal(v3.classifyLabel("ST115",context).kind,"STAND");
assert.equal(v3.classifyLabel("SUSPICIOUS",context).kind,"UNRESOLVED");
const pages=v3.pages("OIII",[{airport:"OIII",page:430,title:"AIRPORT DIAGRAM",insetTypes:["PARKING"]},
 {airport:"OIII",page:432,title:"PARKING STANDS"}]);
assert.equal(pages.groups.ADC.length,1);
assert.equal(pages.groups.PARKING.length,2);
const g={reviewed:true,nodes:{s:{},a:{},b:{},c:{},h:{}},edges:[
 {id:"1",from:"s",to:"a",label:"ST1",kind:"stand-lead",reviewed:true,sourceDrawingIds:[1],bidirectional:true},
 {id:"2",from:"a",to:"b",label:"E1",kind:"taxiway",reviewed:true,sourceDrawingIds:[2],bidirectional:true},
 {id:"3",from:"b",to:"c",label:"E2",kind:"taxiway",reviewed:true,sourceDrawingIds:[3],bidirectional:true},
 {id:"4",from:"c",to:"h",label:"E3",kind:"taxiway",reviewed:true,sourceDrawingIds:[4],bidirectional:true}],
 stands:{"1":{node:"s",verified:true}},
 gates:{"RWY11":{holdNode:"h",runwayEnd:"11",verified:true}},
 taxiways:["E1","E2","E3"]};
assert.equal(v3.graphQA(g).passed,true);
const route=v3.expand(g,"s","h",["E2"]);
assert.equal(route.ok,true,route.error);
assert.deepEqual(route.autoCompleted,["ST1","E1","E2","E3"]);
assert.equal(v3.randomTests(g).passed,true);
const broken=structuredClone(g);broken.edges[2].reviewed=false;
assert.equal(v3.graphQA(broken).passed,false);
assert.equal(v3.expand(broken,"s","h").ok,false);
const unready=v3.evaluate({airport:"OIII",chartPages:[{page:430,title:"ADC"}],
 scannedLabels:["HS1","E2"],taxiwayNames:["E2"],graph:g});
assert.equal(unready.routeable,false);
assert.equal(unready.next.id,"CLASSIFY");
console.log("PASS ADC Engine v3: multi-chart discovery, hotspot classification, implicit route gaps, QA fail closed");
