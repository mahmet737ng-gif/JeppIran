'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildTable, round20, gradientForAngle, horizontalDistanceFromDme } = require('../cdfa-engine.js');
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
  const p=horizontalDistanceFromDme(0.2,{station:c.station,thresholdElevationFt:100,tchFt:50,gradientFtPerNm:318});
  assert.equal(p.distanceNm, 0.3);
  const r=buildTable(c);
  assert.ok(r.rows.every(x=>Number.isInteger(x.dmeNm)));
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
  assert.ok(r.issues.some(x=>x.code==='REQUESTED_DME_GEOMETRY_UNRESOLVED'));
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

test('published 3.30 degree angle takes priority over the missing-angle fallback', () => {
  const c = base();
  delete c.angleDeg;
  c.publishedAngleDeg = 3.3;
  const r = buildTable(c);
  const expectedGradient = gradientForAngle(3.3);
  assert.equal(r.parameters.angleSource, 'PUBLISHED_CHART_INPUT');
  assert.equal(r.parameters.angleDeg, 3.3);
  assert.equal(r.parameters.gradientFtPerNm, expectedGradient);
  assert.ok(expectedGradient > 349 && expectedGradient < 352);
  assert.equal(r.rows[0].roundedAltitudeFt, round20(150 + .5 * expectedGradient));
  assert.ok(!r.rows[0].reasons.includes('DEFAULT_3_DEG_ASSUMED_NOT_PUBLISHED'));
});
test('an absent published angle defaults to 3 degrees and exact 318 ft/NM', () => {
  const c = base(); delete c.angleDeg;
  const r = buildTable(c);
  assert.equal(r.parameters.angleDeg, 3);
  assert.equal(r.parameters.gradientFtPerNm, 318);
  assert.equal(r.parameters.angleSource, 'DEFAULT_ASSUMED_3_DEG');
  assert.equal(r.rows[1].rawAltitudeFt, 627);
  assert.equal(r.rows[1].status, 'MODEL_ONLY');
  assert.ok(r.rows[1].reasons.includes('DEFAULT_3_DEG_ASSUMED_NOT_PUBLISHED'));
  assert.deepEqual(r.candidateRows, []);
});
test('explicit published 3 degrees is distinct from fallback 3 degrees', () => {
  const c = base(); delete c.angleDeg; c.publishedAngleDeg = 3;
  const r = buildTable(c);
  assert.equal(r.parameters.angleSource, 'PUBLISHED_CHART_INPUT');
  assert.equal(r.parameters.gradientFtPerNm, 318);
  assert.equal(r.rows[1].status, 'CANDIDATE_QA');
});
test('empty string and null angles use the fallback; zero is rejected', () => {
  for(const angle of ['',null]){
    const c = base(); c.angleDeg = angle;
    assert.equal(buildTable(c).parameters.angleSource, 'DEFAULT_ASSUMED_3_DEG');
  }
  const c=base(); c.angleDeg=0;
  assert.throws(()=>buildTable(c), /angleDeg must be between/);
});
test('invalid published angle is not silently replaced by default', () => {
  const c=base(); delete c.angleDeg; c.publishedAngleDeg='garbled';
  assert.throws(()=>buildTable(c), /publishedAngleDeg must be a finite number/);
});
test('disagreeing chart angle properties require correction', () => {
  const c=base(); c.angleDeg=3; c.publishedAngleDeg=3.3;
  assert.throws(()=>buildTable(c), /ANGLE_SOURCE_CONFLICT/);
});

test('v1.2: automatic table extends to both 10 NM from runway threshold and DME 10', () => {
  const c=base(); c.dmeReadingsNm=[1,2,3,10]; c.validAngleDmeRange={from:1,to:10};
  const r=buildTable(c);
  assert.equal(r.version,'1.3.0');
  assert.equal(r.coverage.requiredThresholdDistanceNm,10);
  assert.equal(r.coverage.requiredDmeReadoutNm,10);
  assert.equal(r.coverage.dmeAtRequiredThresholdNm,10.5);
  assert.ok(r.coverage.autoAddedDmeReadingsNm.includes(11));
  assert.equal(r.coverage.meetsThresholdModelCoverage,true);
  assert.equal(r.coverage.meetsDmeModelCoverage,true);
  assert.equal(r.rows.find(x=>x.dmeNm===11).thresholdDistanceNm,10.5);
  assert.equal(r.rows.find(x=>x.dmeNm===11).status,'MODEL_ONLY');
});

test('v1.2: published 3.77 degrees and offset 2.2 NM: threshold 10 NM occurs at DME 12.2', () => {
  const c={...base(),chartDmeId:'UMH',station:{id:'UMH',placement:'after_threshold',offsetNm:2.2,lateralNm:0,geometryVerified:false},
    thresholdElevationFt:4342,tchFt:50,publishedAngleDeg:3.77};
  delete c.angleDeg;
  c.dmeReadingsNm=[3,4,7,9];c.validAngleDmeRange={from:3,to:9};c.mdaFt=4800;
  c.publishedConstraints=[
    {dmeNm:4,altitudeFt:5100,type:'minimum'},
    {dmeNm:7,altitudeFt:6300,type:'minimum'},
    {dmeNm:9,altitudeFt:7100,type:'minimum'},
    {dmeNm:11,altitudeFt:7700,type:'minimum'},
    {dmeNm:12,altitudeFt:8000,type:'minimum'}
  ];
  const r=buildTable(c);
  assert.equal(r.status,'PRELIMINARY_GEOMETRY');
  assert.equal(r.coverage.dmeAtRequiredThresholdNm,12.2);
  assert.ok(r.coverage.meetsThresholdModelCoverage);
  assert.equal(r.coverage.publishedAngleCovers10Nm,false);
  assert.ok(r.coverage.autoAddedDmeReadingsNm.includes(13));
  const edge=r.rows.find(x=>x.dmeNm===13);
  assert.equal(edge.thresholdDistanceNm,10.8);
  assert.equal(edge.roundedAltitudeFt,8720);
  assert.ok(edge.reasons.includes('OUTSIDE_PUBLISHED_ANGLE_SCOPE'));
  assert.ok(edge.reasons.includes('STATION_GEOMETRY_NOT_SURVEY_VERIFIED'));
  assert.equal(r.checks.every(x=>x.ok),true);
  assert.equal(r.rows.find(x=>x.dmeNm===3).status,'MODEL_ONLY');
});

test('v1.2: minimum coverage cannot be disabled by requesting 5 NM', () => {
  const c=base();c.minimumThresholdCoverageNm=5;
  assert.throws(()=>buildTable(c),/MINIMUM_COVERAGE_MUST_BE_AT_LEAST_10_NM/);
  const c2=base();c2.minimumDmeCoverageNm=5;
  assert.throws(()=>buildTable(c2),/MINIMUM_DME_COVERAGE_MUST_BE_AT_LEAST_D10/);
});

test('v1.2: disabled extension exposes a blocking shortfall instead of pretending coverage',()=>{
  const c=base();c.dmeReadingsNm=[1,2];c.autoExtendCoverage=false;
  const r=buildTable(c);
  assert.equal(r.status,'BLOCKED_BY_QA');
  assert.equal(r.coverage.meetsThresholdModelCoverage,false);
  assert.ok(r.issues.some(x=>x.code==='MINIMUM_10NM_COVERAGE_NOT_MET'));
  assert.deepEqual(r.candidateRows,[]);
});

test('v1.2: mandatory stop does not truncate diagnostic 10 NM coverage, but suppresses candidates',()=>{
  const c=base(); c.dmeReadingsNm=[1,2];
  c.publishedConstraints=[{dmeNm:2,altitudeFt:627,type:'mandatory'}];
  const r=buildTable(c);
  assert.equal(r.coverage.meetsThresholdModelCoverage,true);
  assert.ok(r.rows.find(x=>x.dmeNm>=11).reasons.includes('BEYOND_MANDATORY_STOP'));
  assert.equal(r.candidateRows.length,2);
});

test('v1.2: slant and lateral transmitter offsets are included in 10 NM coverage projection',()=>{
  const c=base();c.dmeReadingsNm=[1,2,3];
  c.station={...c.station,lateralNm:0.5,elevationFt:90};
  const r=buildTable(c);
  assert.equal(r.coverage.meetsThresholdModelCoverage,true);
  const edge=r.rows.find(x=>x.dmeNm===Math.ceil(r.coverage.dmeAtRequiredThresholdNm));
  assert.ok(edge && edge.thresholdDistanceNm >= 10);
  assert.ok(r.coverage.dmeAtRequiredThresholdNm>10.5);
});

test('v1.2: station before threshold covers both minimums (DME 10 and 10 NM from threshold)',()=>{
  const c=base();c.station={id:'DEMO',placement:'before_threshold',offsetNm:0.5,lateralNm:0,branch:'before_station'};
  c.dmeReadingsNm=[1,2,3];
  const r=buildTable(c);
  assert.equal(r.coverage.meetsDmeModelCoverage,true);
  assert.equal(r.coverage.meetsThresholdModelCoverage,true);
  assert.ok(r.coverage.maxModeledThresholdDistanceNm>=10.5);
});


test('v1.3 displays ONLY integer DME steps even if fractional inputs supplied', () => {
  const c=base(); c.dmeReadingsNm=[1,1.5,2,2.2,3,3.5,10.5];
  const r=buildTable(c);
  assert.ok(r.rows.every(x=>Number.isInteger(x.dmeNm)));
  assert.deepEqual(r.rows.map(x=>x.dmeNm),Array.from({length:11},(_,i)=>i+1));
  assert.equal(r.coverage.gridStepDmeNm,1);
});
test('v1.3 VDP is calculated with one decimal but is NOT inserted as a fractional DME row',()=>{
 const c=base();c.mdaFt=563;
 const r=buildTable(c);
 assert.equal(r.vdp.dmeDisplay,'D1.8');
 assert.ok(r.rows.every(x=>Number.isInteger(x.dmeNm)));
 assert.equal(r.vdp.status,'CALCULATED_MDA_INTERCEPT_QA_ONLY');
 assert.equal(r.vdp.published,false);
 assert.equal(r.rows.filter(x=>x.vdpMarker).length,1);
});
test('v1.3 VDP missing MDA is visibly unavailable',()=>{
 const r=buildTable(base());
 assert.equal(r.vdp.dmeDisplay,null);
 assert.equal(r.vdp.reason,'MDA_NOT_SUPPLIED');
});
test('v1.3 engine rejects half-mile table spacing',()=>{
 const c=base(); c.coverageStepDmeNm=.5;
 assert.throws(()=>buildTable(c),/INTEGER_DME_GRID_REQUIRED/);
});
test('v1.3 sample Urmia reaches threshold+10 by integer D13 and VDP has .1 digit',()=>{
 const c={...base(),thresholdElevationFt:4342,tchFt:50,chartDmeId:'UMH',publishedAngleDeg:3.77,mdaFt:4800,
  station:{id:'UMH',placement:'after_threshold',offsetNm:2.2,lateralNm:0,geometryVerified:false},
  dmeReadingsNm:[3,4,5,6,7,8,9,10,11,12,13],validAngleDmeRange:{from:3,to:9}};
 delete c.angleDeg;
 const r=buildTable(c);
 assert.equal(r.coverage.gridEndDmeNm,13);
 assert.equal(r.coverage.meetsThresholdModelCoverage,true);
 assert.equal(r.vdp.dmeDisplay,'D3.2');
});