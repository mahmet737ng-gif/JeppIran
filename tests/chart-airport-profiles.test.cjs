"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,"..");
const source=JSON.parse(fs.readFileSync(path.join(root,"app/src/main/assets/airport-profile-chart-overrides.json"),"utf8"));
function build(cycle,sha){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"jeppiran-chart-profiles-"));
 try{
  fs.writeFileSync(path.join(temp,"manifest.json"),JSON.stringify({version:cycle,source_sha256:sha,airports:{OPIS:{},OPKC:{},OIAD:{}}}));
  fs.writeFileSync(path.join(temp,"airports.csv"),"ident,iso_country,name,municipality,iata_code,latitude_deg,longitude_deg,elevation_ft\nOIAD,IR,Existing Airport,Existing City,DEF,32,48,400\n");
  execFileSync("python3",[path.join(root,"scripts/build_airport_profiles.py"),"--manifest",path.join(temp,"manifest.json"),"--airports-file",path.join(temp,"airports.csv"),"--output",path.join(temp,"out.json")],{cwd:root});
  return JSON.parse(fs.readFileSync(path.join(temp,"out.json"),"utf8"));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
}
test("OPIS and OPKC profiles are populated from the current charts even when absent from CSV",()=>{
 const data=build("V2621",source.sourceSha256);
 assert.equal(data.covered_airports,3);assert.deepEqual(data.missing_icaos,[]);
 const isb=data.airports.OPIS,khi=data.airports.OPKC;
 assert.deepEqual([isb.name,isb.city,isb.country,isb.iata,isb.elevation,isb.lat,isb.lon],["Islamabad Intl","Islamabad","Pakistan","ISB",1761,33.548333,72.825]);
 assert.deepEqual([khi.name,khi.city,khi.country,khi.iata,khi.elevation,khi.lat,khi.lon],["Jinnah Intl","Karachi","Pakistan","KHI",102,24.908333,67.163333]);
 assert.equal(isb.chartSource.adcGlobalPage,1623);assert.equal(khi.chartSource.adcGlobalPage,1580);
 assert.match(isb.source,/Jeppesen/);assert.match(khi.source,/Jeppesen/);
 assert.equal(data.airports.OIAD.name,"Existing Airport");
});
test("chart overrides from a different cycle or source PDF cannot replace current profile data",()=>{
 for(const [cycle,sha] of [["V2622",source.sourceSha256],["V2621","different-source"]]){
  const data=build(cycle,sha);assert.deepEqual(data.missing_icaos,["OPIS","OPKC"]);assert.equal(data.airports.OIAD.name,"Existing Airport");
 }
});
