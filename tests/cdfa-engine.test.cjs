'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildTable, round20, gradientForAngle } = require('../cdfa-engine.js');
const base = () => ({
  chartId: 'TRAINING-ONLY', chartDmeId: 'DEMO',
  thresholdElevationFt: 100, tchFt: 50, angleDeg: 3,
  station: { id: 'DEMO', placement: 'after_threshold', offsetNm: 0.5, lateralNm: 0 },
  dmeReadingsNm: [1, 2, 3, 10], validAngleDmeRange: { from: 1, to: 10 },
});
test('3 degree user block is exactly 318 ft per nautical mile', () => {
  assert.equal(gradientForAngle(3), 318);
});
test('threshold 100 + TCH 50, DME transmitter 0.5 NM after threshold', () => {
  const r = buildTable(base());
  assert.equal(r.parameters.crossingAltitudeFt, 150);
  assert.equal(r.rows[0].thresholdDistanceNm, 0.5);
  assert.equal(r.rows[0].rawAltitudeFt, 309);
  assert.equal(r.rows[0].roundedAltitudeFt, 300);
  assert.equal(r.rows[1].thresholdDistanceNm, 1.5);
  assert.equal(r.rows[1].rawAltitudeFt, 627);
  assert.equal(r.rows[1].roundedAltitudeFt, 620);
  assert.equal(r.rows[2].rawAltitudeFt, 945);
  assert.equal(r.rows[2].roundedAltitudeFt, 940);
});
test('round computed altitude to nearest 20, never modify published value', () => {
  assert.equal(round20(4763), 4760);
  assert.equal(round20(3294), 3300);
  const c = base(); c.publishedConstraints = [{ dmeNm: 2, altitudeFt: 627, type: 'minimum' }];
  const r = buildTable(c);
  assert.equal(r.rows[1].published[0].altitudeFt, 627);
  assert.equal(r.rows[1].roundedAltitudeFt, 620);
  assert.equal(r.checks[0].ok, true); // comparison uses raw 627, not rounded 620
});
test('a DME identifier mismatch blocks calculation', () => {
  const c = base(); c.station.id = 'IKIS';
  assert.throws(() => buildTable(c), /DME_REFERENCE_MISMATCH/);
});
test('DME transmitter before threshold, aircraft on inbound side of transmitter', () => {
  const c = base(); c.station = {id: 'DEMO', placement: 'before_threshold', offsetNm: 0.5, lateralNm:0, branch: 'before_station'};
  const r = buildTable(c);
  assert.equal(r.rows[0].thresholdDistanceNm, 1.5);
  assert.equal(r.rows[0].rawAltitudeFt, 627);
});
test('before-threshold DME station needs explicit aircraft-side branch', () => {
  const c = base(); c.station = {id:'DEMO',placement:'before_threshold',offsetNm:0.5,lateralNm:0};
  assert.throws(() => buildTable(c), /station.branch is required/);
});
test('behind DME station, aircraft between station and threshold', () => {
  const c = base(); c.station = {id:'DEMO',placement:'before_threshold',offsetNm:0.5,lateralNm:0,branch:'between_station_and_threshold'};
  c.dmeReadingsNm = [0.2]; c.validAngleDmeRange = { from:0, to:1};
  const r = buildTable(c);
  assert.equal(r.rows[0].thresholdDistanceNm, 0.3);
  assert.equal(r.rows[0].rawAltitudeFt, 245.4);
});
test('off-axis DME must use geometric projection, not blindly subtract offset', () => {
  const c = base(); c.station.lateralNm = 0.6;
  const r = buildTable(c);
  assert.equal(r.rows[0].thresholdDistanceNm, 0.3); // sqrt(1^2 - .6^2) - .5
  assert.equal(r.rows[0].rawAltitudeFt, 245.4);
});
test('unknown geometric DME distance is blocked', () => {
  const c = base(); delete c.station.offsetNm;
  assert.throws(() => buildTable(c), /station.offsetNm/);
});
test('minimum published altitude below model => withhold all candidate rows', () => {
  const c = base(); c.publishedConstraints = [{ dmeNm: 2, altitudeFt: 650, type: 'minimum' }];
  const r = buildTable(c);
  assert.equal(r.status, 'BLOCKED_BY_QA');
  assert.equal(r.checks[0].code, 'BELOW_PUBLISHED_MINIMUM');
  assert.deepEqual(r.candidateRows, []);
});
test('mandatory crossing is an exact altitude, not a minimum', () => {
  const c = base(); c.publishedConstraints = [{ dmeNm: 2, altitudeFt: 700, type: 'mandatory' }];
  const r = buildTable(c);
  assert.equal(r.status, 'BLOCKED_BY_QA');
  assert.equal(r.checks[0].code, 'MANDATORY_ALTITUDE_CONFLICT');
});
test('mandatory value may match exactly, without changing published number', () => {
  const c = base(); c.publishedConstraints = [{ dmeNm: 2, altitudeFt: 627, type: 'mandatory' }];
  const r = buildTable(c);
  assert.equal(r.checks[0].ok, true);
  assert.equal(r.rows[1].published[0].altitudeFt, 627);
});
test('outside published angle segment never enters candidate rows', () => {
  const c = base(); c.validAngleDmeRange = {from:1, to:2};
  const r = buildTable(c);
  assert.equal(r.rows[3].status, 'MODEL_ONLY');
  assert.deepEqual(r.candidateRows.map(x => x.dmeNm), [1,2]);
});
test('no angle scope supplied => all rows are model-only', () => {
  const c=base(); delete c.validAngleDmeRange;
  const r=buildTable(c);
  assert.equal(r.candidateRows.length,0);
  assert.equal(r.rows[0].status,'MODEL_ONLY');
});
test('optional DME slant correction uses station elevation', () => {
  const c=base(); c.station.elevationFt=100;
  const r=buildTable(c);
  assert.ok(r.rows[0].thresholdDistanceNm < 0.5);
  assert.equal(r.parameters.usedSlantRangeCorrection,true);
});
test('unresolvable slant distance blocks the QA table', () => {
  const c=base(); c.station.lateralNm=2;
  const r=buildTable(c);
  assert.equal(r.status,'BLOCKED_BY_QA');
  assert.equal(r.rows[0].rawAltitudeFt,null);
});

test('explicit lateral offset is required, no silent centerline assumption', () => {
  const c=base(); delete c.station.lateralNm;
  assert.throws(() => buildTable(c), /lateralNm must be explicitly supplied/);
});
test('mandatory crossing ends the candidate profile, no extension beyond', () => {
  const c=base(); c.publishedConstraints=[{dmeNm:2,altitudeFt:627,type:'mandatory'}];
  const r=buildTable(c);
  assert.deepEqual(r.candidateRows.map(x=>x.dmeNm),[1,2]);
  assert.equal(r.rows[2].status,'MODEL_ONLY');
  assert.ok(r.rows[2].reasons.includes('BEYOND_MANDATORY_STOP'));
});

test('no model altitude below published MDA enters candidate rows',()=>{
  const c=base(); c.mdaFt=500;
  const r=buildTable(c);
  assert.equal(r.rows[0].status,'MODEL_ONLY');
  assert.ok(r.rows[0].reasons.includes('BELOW_MDA_DO_NOT_USE'));
  assert.ok(!r.candidateRows.some(x=>x.dmeNm===1));
  assert.ok(r.candidateRows.some(x=>x.dmeNm===2));
});