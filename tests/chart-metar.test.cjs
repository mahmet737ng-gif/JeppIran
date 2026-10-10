const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {test}=require("node:test");

const source=fs.readFileSync(path.join(__dirname,"../web/app.js"),"utf8");
const first="OICI 100300Z 32005KT CAVOK 18/06 Q1015";
const next="OICI 100330Z 32005KT CAVOK 18/06 Q1015";
const section=(start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,"METAR source boundaries exist");
  return source.slice(a,b);
};

function harness(cache=first){
  let now=1000,reply=first,calls=0,timerId=0;
  const timers=new Map(),intervals=[],nodes=new Map();
  function node(id){
    if(!nodes.has(id)){
      const classes=new Set(id==="#chartsView"?["active"]:[]),events=new Map();
      nodes.set(id,{value:"",textContent:"",classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
        addEventListener:(name,fn)=>events.set(name,fn),click:()=>events.get("click")?.({stopPropagation(){},target:{id:id.slice(1)}})});
    }
    return nodes.get(id);
  }
  const context=vm.createContext({
    $,fetchWx:async()=>{calls++;return typeof reply==="function"?reply():reply},
    Date:{now:()=>now},localStorage:{setItem(){}},
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id},
    clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>intervals.push({fn,ms}),
    renderAirports(){},refreshPositionStatus(){},renderSelectedPdf:()=>Promise.resolve(),escapeHtml:x=>x,
  });
  function $(id){return node(id)}
  vm.runInContext(`let selectedAirport="OICI",selectedChart={page:1},expanded=new Set(),wxCache=${JSON.stringify(cache?{"OICI:metar":cache}:{})};\n`+
    section('let chartMetarTimer=', 'let chartPointers=')+
    section('function selectChart(', '$("#positionStatusBtn").addEventListener')+
    section('$("#chartMetarBtn").addEventListener', '// Keep the raster artwork intact')+
    `\nthis.ui={selectChart,showChartMetar,hideChartMetar,switchAirport:icao=>{hideChartMetar();selectedAirport=icao},routeActive:active=>$("#chartsView").classList[active?"add":"remove"]("active")};`,context);
  return {ui:context.ui,node,timers,intervals,visible:()=>node("#chartMetarBanner").classList.contains("visible"),
    calls:()=>calls,timerCount:()=>timerId,reply:value=>reply=value,advance:ms=>now+=ms,
    flush:async()=>{for(let i=0;i<12;i++)await Promise.resolve()},
    poll:async()=>{now+=300000;await intervals[0].fn()}};
}

test("only the first chart opens METAR; changing charts keeps it dismissed",async()=>{
  const h=harness();h.ui.selectChart({page:1});await h.flush();
  assert.equal(h.visible(),true);assert.equal(h.calls(),1);
  h.node("#chartMetarClose").click();const count=h.timerCount();
  h.ui.selectChart({page:2});await h.flush();h.ui.selectChart({page:3});await h.flush();
  assert.equal(h.visible(),false);assert.equal(h.calls(),1);assert.equal(h.timerCount(),count);
});

test("METAR button reopens the same report, but a late identical response does not",async()=>{
  const h=harness();await h.ui.showChartMetar(true,true);h.ui.hideChartMetar();
  let resolve;h.reply(()=>new Promise(r=>resolve=r));h.node("#chartMetarBtn").click();await h.flush();
  assert.equal(h.visible(),true);h.node("#chartMetarClose").click();resolve(first);await h.flush();
  assert.equal(h.visible(),false);
});

test("five-minute checks stay silent for identical reports and open new observations",async()=>{
  const h=harness();await h.ui.showChartMetar(true,true);h.ui.hideChartMetar();
  assert.equal(h.intervals[0].ms,300000);const count=h.timerCount();
  await h.poll();assert.equal(h.visible(),false);assert.equal(h.timerCount(),count);
  h.reply(next);await h.poll();assert.equal(h.visible(),true);assert.equal(h.node("#chartMetarText").textContent,next);
  h.ui.hideChartMetar();await h.poll();assert.equal(h.visible(),false);
});

test("unchanged checks do not extend the visible banner's dismissal timer",async()=>{
  const h=harness();await h.ui.showChartMetar(true,true);const count=h.timerCount();
  await h.poll();assert.equal(h.visible(),true);assert.equal(h.timerCount(),count);
});

test("formatting does not count as a new report; a correction does",async()=>{
  const h=harness();await h.ui.showChartMetar(true,true);h.ui.hideChartMetar();
  h.reply("  METAR  "+first.toLowerCase().replaceAll(" ","\n  ")+"=  ");await h.poll();assert.equal(h.visible(),false);
  h.reply(first.replace("100300Z","100300Z COR"));await h.poll();assert.equal(h.visible(),true);
});

test("airport histories remain independent when revisiting charts",async()=>{
  const h=harness();await h.ui.showChartMetar(true,true);h.ui.switchAirport("OIII");
  h.reply(first.replace("OICI","OIII"));await h.ui.showChartMetar(true,true);assert.equal(h.visible(),true);
  h.ui.switchAirport("OICI");h.reply(first);await h.ui.showChartMetar(true,true);assert.equal(h.visible(),false);
});

test("failed automatic checks do not consume the first display or show errors",async()=>{
  const h=harness("");h.reply(()=>Promise.reject(new Error("offline")));
  await h.ui.showChartMetar(true,true);assert.equal(h.visible(),false);
  h.reply(first);await h.poll();assert.equal(h.visible(),true);
});

test("concurrent chart requests share one fetch and a late airport response stays hidden",async()=>{
  const h=harness("");let resolve;h.reply(()=>new Promise(r=>resolve=r));
  const a=h.ui.showChartMetar(true,true),b=h.ui.showChartMetar(true,true);await h.flush();assert.equal(h.calls(),1);
  h.ui.switchAirport("OIII");resolve(first);await Promise.all([a,b]);assert.equal(h.visible(),false);
  h.ui.switchAirport("OICI");await h.ui.showChartMetar(true,true);assert.equal(h.visible(),true);assert.equal(h.calls(),1);
});

test("a hidden chart view does not consume a report's first automatic display",async()=>{
  const h=harness();h.ui.routeActive(false);await h.ui.showChartMetar(true,true);assert.equal(h.calls(),0);
  h.ui.routeActive(true);await h.ui.showChartMetar(true,true);assert.equal(h.visible(),true);
});
