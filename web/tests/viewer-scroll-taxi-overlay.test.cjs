/* Viewer scroll + TAXI overlay regression: no 100%-zoom scroll lock.
 * Run: node web/tests/viewer-scroll-taxi-overlay.test.cjs
 */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const css=fs.readFileSync(path.join(__dirname,"..","styles.css"),"utf8");
const taxi=fs.readFileSync(path.join(__dirname,"..","taxi-mode.js"),"utf8");
const start=app.indexOf("function setupChartGestures(){");
const end=app.indexOf("\nsetupChartGestures();",start);
assert.ok(start>=0&&end>start,"Chart gesture code missing");
assert.ok(css.includes("overflow-y:auto;"),"PDF must be scrollable");
assert.ok(css.includes(".taxi-qa-overlay *{pointer-events:none!important}"),"Taxi overlay must not capture input");
assert.ok(!taxi.includes('requestAnimationFrame(()=>focusPdfVectorOnADC(traced.points,traced.chartHeight))'),
 "GO must never trigger forced scroll lock or focus");
const body=app.slice(start,end)+"\nsetupChartGestures();";
const fixture=new Function(`
let chartZoom=1,chartPanX=0,chartPanY=0,panStart=null,swipeStart=null,
 pinchStartDistance=0,pinchStartZoom=1,lastTapAt=0;
const chartPointers=new Map(),listeners={};
const stage={dataset:{},scrollTop:0,clientHeight:480,clientWidth:850,
  addEventListener(name,fn){listeners[name]=fn;},
  setPointerCapture(){},
  getBoundingClientRect(){return {top:0,left:0,width:850,height:480}}};
const layer={offsetHeight:940,offsetWidth:720};
const $=q=>q==="#pdfStage"?stage:q==="#pdfCanvas"?{}:q==="#chartTransformLayer"?layer:null;
let applied=0;
const cancelAircraftFollow=()=>{};
const applyChartTransform=()=>{applied++};
const zoomAround=()=>{},navigateChart=()=>{};
${body}
return {stage,listeners,setZoom:x=>chartZoom=x,get:()=>({chartZoom,chartPanY,applied})};
`)();
let wheelStopped=false;
fixture.listeners.wheel({deltaY:100,deltaX:0,ctrlKey:false,metaKey:false,
 preventDefault(){wheelStopped=true}});
assert.equal(wheelStopped,false,"Wheel at 100% must use real document scrolling");
fixture.listeners.pointerdown({pointerId:1,clientX:100,clientY:150});
fixture.listeners.pointermove({pointerId:1,clientX:101,clientY:60});
assert.equal(fixture.stage.scrollTop,90,"Drag at 100% must move scrollTop");
assert.equal(fixture.get().chartPanY,0,"100% scroll and transformed panY cannot compete");
fixture.setZoom(2);
let zoomWheelStopped=false;
fixture.listeners.wheel({deltaY:40,deltaX:0,ctrlKey:false,metaKey:false,
 preventDefault(){zoomWheelStopped=true}});
assert.equal(zoomWheelStopped,true,"Zoomed charts keep drag-wheel transform control");
assert.equal(fixture.get().chartPanY,-40);
console.log("PASS viewer scroll + taxi overlay: wheel/drag 100%, pan zoom, no forced focus");
