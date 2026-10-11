#!/usr/bin/env node
/* Rebuild a cached taxiway-neighbor inventory from an existing airport graph.
 * NO network requests. For every new airport/cycle the SAME script works.
 * Usage: node scripts/build_taxi_adjacency.cjs LTFM [OIMM ...]
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const engine=require("../web/taxi-adjacency.js");
const repo=path.resolve(__dirname,"..");
const airports=process.argv.slice(2).map(x=>x.trim().toUpperCase());
if(!airports.length){console.error("Usage: node scripts/build_taxi_adjacency.cjs ICAO [ICAO ...]");process.exit(2)}
for(const airport of airports){
  if(!/^[A-Z]{4}$/.test(airport))throw Error("Invalid ICAO: "+airport);
  const source=path.join(repo,"web/data/taxi-networks",airport+".json");
  const graph=JSON.parse(fs.readFileSync(source,"utf8"));
  if(graph.airport!==airport)throw Error("Airport mismatch: "+airport);
  let missing={};
  const audit=path.join(repo,"web/data/taxi-audits",airport+".json");
  if(fs.existsSync(audit))missing=JSON.parse(fs.readFileSync(audit,"utf8")).chartOnlyTaxiwayLabels||{};
  const generated=engine.snapshot(graph,missing);
  const folder=path.join(repo,"web/data/taxi-adjacency");
  fs.mkdirSync(folder,{recursive:true});
  const output=path.join(folder,airport+".json");
  fs.writeFileSync(output,JSON.stringify(generated,null,2)+"\n");
  console.log(airport+": "+generated.stats.namedTaxiways+" mapped taxiways; "+
    generated.stats.chartOnlyLabels+" without geometry; "+output);
}
