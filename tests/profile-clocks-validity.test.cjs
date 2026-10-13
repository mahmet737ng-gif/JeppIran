/* Locked airport-profile clock + chart-cycle status regression QA. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"web/app.js"),"utf8");
const css=fs.readFileSync(path.join(root,"web/styles.css"),"utf8");
const begin=app.indexOf("function airportLocalZone(");
const end=app.indexOf("let lastValidityCheckMinute=",begin);
assert.ok(begin>=0&&end>begin,"isolated profile helpers are present");
const source=app.slice(begin,end);
function build(date,manifest={version:"V2621",cycle:"2621"},enroute={
  schema:1,cycle:"2610",effective_from:"2026-10-01",effective_to:"2026-10-29",published:false,files:[]
}){
  const state={now:Date.parse(date)};
  class Clock extends Date{static now(){return state.now}}
  const context={Date:Clock,Intl,manifest,enrouteValidityManifest:enroute,
    profileEsc:v=>String(v)};
  vm.createContext(context);
  vm.runInContext(source,context,{filename:"profile-clock-slice.js"});
  return context;
}
test("airport local time uses correct ICAO-specific IANA zone, never device offset",()=>{
  const x=build("2026-10-13T12:00:00Z");
  const utc=new Date("2026-10-13T12:00:00Z");
  const examples=[
    ["OIII","15:30:00","UTC+3:30"],
    ["LTAC","15:00:00","UTC+3"],
    ["OOMS","16:00:00","UTC+4"],
    ["OMDB","16:00:00","UTC+4"],
    ["OPIS","17:00:00","UTC+5"],
    ["OTHH","15:00:00","UTC+3"],
    ["UGTB","16:00:00","UTC+4"],
  ];
  for(const [icao,clock,offset]of examples){
    const actual=x.airportClockTime(utc,icao);
    assert.ok(actual.includes(clock),icao+" local "+actual);
    assert.ok(actual.includes(offset),icao+" offset "+actual);
  }
  assert.equal(x.airportClockTime(utc,"XXXX"),"Time zone unavailable");
});
test("terminal cycle 2621 issue 9 Oct and next issue 23 Oct, status expires exactly at 00:00 UTC",()=>{
  const before=build("2026-10-22T23:59:59Z");
  const term=before.terminalRevisionWindow(before.manifest);
  assert.equal(term.from.toISOString().slice(0,10),"2026-10-09");
  assert.equal(term.until.toISOString().slice(0,10),"2026-10-23");
  assert.match(before.profileValidityMarkup(),/data-validity="terminal" data-state="current"/);
  const expired=build("2026-10-23T00:00:00Z");
  assert.match(expired.profileValidityMarkup(),/data-validity="terminal" data-state="expired"/);
  assert.match(expired.profileValidityMarkup(),/New terminal chart cycle due/);
});
test("after importing next chart cycle, active cycle resets to current automatically",()=>{
  const updated=build("2026-10-23T13:00:00Z",{cycle:"2622",version:"V2622"});
  assert.equal(updated.terminalRevisionWindow(updated.manifest).from.toISOString().slice(0,10),"2026-10-23");
  assert.match(updated.profileValidityMarkup(),/data-validity="terminal" data-state="current"/);
  const unknown=build("2027-02-10T12:00:00Z",{cycle:"2704",version:"V2704"});
  assert.match(unknown.profileValidityMarkup(),/data-validity="terminal" data-state="unknown"/);
});
test("Enroute without installed files is never shown as current; overdue turns red",()=>{
  const notInstalled=build("2026-10-13T12:00:00Z");
  const html=notInstalled.profileValidityMarkup();
  assert.match(html,/data-validity="enroute" data-state="unknown"/);
  assert.match(html,/NOT VERIFIED/);
  assert.match(html,/Enroute charts not published\/installed/);
  const expired=build("2026-10-29T00:00:00Z");
  assert.match(expired.profileValidityMarkup(),/data-validity="enroute" data-state="expired"/);
  assert.match(expired.profileValidityMarkup(),/No published Enroute chart package is installed/);
});
test("live UTC and local clocks and visibility alerts are confined to profile",()=>{
  assert.match(app,/id="profileUtcClock"/);
  assert.match(app,/id="profileLocalTime"/);
  const html=fs.readFileSync(path.join(root,"web/index.html"),"utf8");
  const clockIndex=html.indexOf('id="homeUtc"');
  const validityIndex=html.indexOf('id="homeTerminalValidity"');
  const cycleIndex=html.indexOf('id="homeCycle"');
  assert.ok(clockIndex>=0&&validityIndex>clockIndex&&cycleIndex>validityIndex,
    "Home inline terminal validity must sit between UTC and Data Cycle");
  assert.match(app,/id="profileTerminalValidity"/);
  assert.doesNotMatch(app,/id="profileValidity"/);
  assert.doesNotMatch(app,/id="profileValidityRows"/);
  assert.match(app,/function updateTerminalValidityDisplay\(\)/);
  assert.match(css,/#homeView \.home-terminal-validity/);
  assert.match(css,/#chartsView \.profile-terminal-validity/);
  assert.match(css,/:root\.light #homeView \.home-terminal-validity/);
  assert.match(css,/:root\.light #chartsView \.profile-terminal-validity/);
  assert.match(app,/setInterval\(utcDisplay,1000\)/);
  assert.match(app,/document\.querySelectorAll\("\.profile-utc"\)\.forEach/);
  assert.match(css,/#chartsView \.profile-utc-clock/);
  assert.match(css,/\.profile-validity-entry\[data-state="expired"\]/);
  assert.match(css,/:root\.light #chartsView \.profile-validity-entry/);
});
test("compact validity indicator changes to red overdue state and recovers on cycle update",()=>{
  const current=build("2026-10-13T12:00:00Z");
  assert.equal(current.terminalValidityIndicator().state,"current");
  assert.match(current.terminalValidityIndicator().markup,/TERMINAL CHARTS/);
  assert.match(current.terminalValidityIndicator().markup,/Next issue 23 Oct 2026/);
  const overdue=build("2026-10-23T00:00:00Z");
  assert.equal(overdue.terminalValidityIndicator().state,"expired");
  assert.match(overdue.terminalValidityIndicator().markup,/UPDATE OVERDUE/);
  assert.match(overdue.terminalValidityIndicator().markup,/New cycle due 23 Oct 2026/);
  const updated=build("2026-10-23T00:00:00Z",{version:"V2622",cycle:"2622"});
  assert.equal(updated.terminalValidityIndicator().state,"current");
  assert.match(css,/#homeView \.home-terminal-validity\[data-state="expired"\]/);
  assert.match(css,/#chartsView \.profile-terminal-validity\[data-state="expired"\]/);
});
test("airport profile renders inclusive terminal cycle validity dates, Home remains unchanged",()=>{
  const current=build("2026-10-13T12:00:00Z");
  const display=current.terminalValidityIndicator();
  assert.match(display.profileMarkup,/VALID FROM <b>09 Oct 2026<\/b>/);
  assert.match(display.profileMarkup,/VALID TO <b>22 Oct 2026<\/b>/);
  assert.doesNotMatch(display.markup,/VALID FROM|VALID TO/,"Home must not gain a date range");
  const expired=build("2026-10-23T00:00:00Z");
  assert.equal(expired.terminalValidityIndicator().state,"expired");
  assert.match(expired.terminalValidityIndicator().profileMarkup,/VALID FROM <b>09 Oct 2026<\/b>[\s\S]*VALID TO <b>22 Oct 2026<\/b>/);
  const updated=build("2026-10-23T00:00:00Z",{version:"V2622",cycle:"2622"});
  assert.match(updated.terminalValidityIndicator().profileMarkup,/VALID FROM <b>23 Oct 2026<\/b>[\s\S]*VALID TO <b>05 Nov 2026<\/b>/);
  const unknown=build("2027-02-01T00:00:00Z",{version:"V2704",cycle:"2704"});
  assert.match(unknown.terminalValidityIndicator().profileMarkup,/VALID FROM <b>UNAVAILABLE<\/b>[\s\S]*VALID TO <b>UNAVAILABLE<\/b>/);
  assert.match(app,/id==="profileTerminalValidity"\?status\.profileMarkup:status\.markup/);
  assert.match(css,/#chartsView \.profile-terminal-validity \.terminal-validity-dates/);
  assert.match(css,/:root\.light #chartsView \.profile-terminal-validity \.terminal-validity-dates/);
});
test("updated profile JS/CSS have matching cache-busting URLs in HTML and service worker",()=>{
  const html=fs.readFileSync(path.join(root,"web/index.html"),"utf8");
  const sw=fs.readFileSync(path.join(root,"web/service-worker.js"),"utf8");
  for(const suffix of ["app.js","styles.css"]){
    const escaped=suffix.replace(".", "\\.");
    const match=html.match(new RegExp(escaped+"[?]v=[a-z0-9-]+","i"));
    assert.ok(match,"HTML must request a versioned "+suffix);
    assert.ok(sw.includes(match[0]),"SW shell must cache the same current "+suffix+" URL");
  }
  assert.match(app,/role="status" aria-live="polite">'\+terminalValidityIndicator\(\)\.profileMarkup/);
  assert.match(sw,/const CACHE="jeppiran-pwa-[a-z0-9-]+"/); // cache revision is independent of profile revision
});
test("manifest synchronization remains mandatory before Pages deployment",()=>{
  const action=fs.readFileSync(path.join(root,".github/workflows/deploy-ipad-web.yml"),"utf8");
  assert.match(action,/cp app\/src\/main\/assets\/enroute-manifest\.json web\/data\/enroute-manifest\.json/);
  assert.match(action,/node --test tests\/profile-clocks-validity\.test\.cjs/);
});
