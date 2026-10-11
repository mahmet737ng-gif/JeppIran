/* JEPPIRAN CDFA Geometry Engine v1.4 - offline, framework independent.
   Engineering/simulator QA only; not authorized for actual flight navigation.
   No use of AC 120-108 as a computation input or authority.
   Source of truth for published fixes, limits, and station location is the
   visually reviewed procedure chart; this code does not extract those data.
*/
(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.JeppIranCdfaEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FEET_PER_NM = 6076.11548556;
  const EPS = 1e-8;
  const validKinds = new Set(['minimum', 'mandatory', 'maximum']);

  function number(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(label + ' must be a finite number');
    }
    return value;
  }
  function nonNegative(value, label) {
    if (number(value, label) < 0) throw new RangeError(label + ' must be >= 0');
    return value;
  }
  function round20(feet) {
    return Math.floor((number(feet, 'altitude') + EPS) / 20 + 0.5) * 20;
  }
  function gradientForAngle(deg) {
    if (!(number(deg, 'angleDeg') > 0 && deg < 10)) {
      throw new RangeError('angleDeg must be between 0 and 10 degrees');
    }
    // User-authorized block: exactly 318 ft/NM at 3.00 degrees.
    return Math.abs(deg - 3) < EPS ? 318 : FEET_PER_NM * Math.tan(deg * Math.PI / 180);
  }
  function normalizeConfig(input) {
    if (!input || typeof input !== 'object') throw new TypeError('config is required');
    const c = { ...input };
    // Chart evidence priority: runway threshold first; only if ABSENT use airport elevation.
    // Airport elevation is not interchangeable with threshold elevation and is QA-only.
    // Zero is a valid published elevation (do not use truthiness checks).
    const hasElevation = v => v !== undefined && v !== null && v !== '';
    const hasThreshold = hasElevation(c.thresholdElevationFt);
    const hasAirport = hasElevation(c.airportElevationFt);
    if (hasAirport) c.airportElevationFt = number(c.airportElevationFt, 'airportElevationFt');
    if (hasThreshold) {
      c.thresholdElevationFt = number(c.thresholdElevationFt, 'thresholdElevationFt');
      c.elevationSource = 'RUNWAY_THRESHOLD';
      c.usedAirportElevationFallback = false;
    } else if (hasAirport) {
      c.thresholdElevationFt = c.airportElevationFt;
      c.elevationSource = 'AIRPORT_ELEVATION_FALLBACK_QA';
      c.usedAirportElevationFallback = true;
    } else {
      throw new Error('THRESHOLD_OR_AIRPORT_ELEVATION_REQUIRED');
    }
    c.tchFt = nonNegative(c.tchFt, 'tchFt');
    // Prefer the descent angle explicitly transcribed from the APPROACH chart.
    // `angleDeg` remains a backwards-compatible alias for `publishedAngleDeg`.
    // A missing/blank angle is never interpreted as zero: the user's fallback is 3°.
    const hasValue = value => value !== undefined && value !== null && value !== '';
    const hasPublished = hasValue(c.publishedAngleDeg);
    const hasLegacy = hasValue(c.angleDeg);
    if (hasPublished && hasLegacy && Math.abs(number(c.publishedAngleDeg, 'publishedAngleDeg') - number(c.angleDeg, 'angleDeg')) > EPS) {
      throw new Error('ANGLE_SOURCE_CONFLICT: publishedAngleDeg and angleDeg disagree');
    }
    c.angleSource = hasPublished || hasLegacy ? 'PUBLISHED_CHART_INPUT' : 'DEFAULT_ASSUMED_3_DEG';
    c.angleDeg = hasPublished ? number(c.publishedAngleDeg, 'publishedAngleDeg')
      : hasLegacy ? number(c.angleDeg, 'angleDeg') : 3;
    c.gradientFtPerNm = gradientForAngle(c.angleDeg);
    if (!c.chartDmeId || typeof c.chartDmeId !== 'string') throw new Error('chartDmeId from chart header is required');
    if (!c.station || typeof c.station !== 'object' || !c.station.id) throw new Error('station with id is required');
    if (String(c.chartDmeId).trim().toUpperCase() !== String(c.station.id).trim().toUpperCase()) {
      throw new Error('DME_REFERENCE_MISMATCH: chart=' + c.chartDmeId + ' station=' + c.station.id);
    }
    const p = c.station.placement;
    if (!['after_threshold', 'before_threshold', 'at_threshold'].includes(p)) {
      throw new Error('station.placement must be after_threshold, before_threshold, or at_threshold');
    }
    c.station = { ...c.station };
    c.station.offsetNm = nonNegative(c.station.offsetNm, 'station.offsetNm');
    // Never silently assume a navaid is exactly on the extended runway centerline.
    if (c.station.lateralNm === undefined) throw new Error('station.lateralNm must be explicitly supplied (0 only if verified)');
    c.station.lateralNm = nonNegative(c.station.lateralNm, 'station.lateralNm');
    if (p === 'at_threshold' && c.station.offsetNm !== 0) throw new Error('at_threshold requires offsetNm=0');
    if (p !== 'at_threshold' && c.station.offsetNm === 0) throw new Error('nonzero offsetNm required for before/after placement');
    if (c.station.elevationFt !== undefined && c.station.elevationFt !== null) number(c.station.elevationFt, 'station.elevationFt');
    if (p === 'before_threshold' && !['before_station', 'between_station_and_threshold'].includes(c.station.branch)) {
      throw new Error('station.branch is required when DME station is before threshold: before_station or between_station_and_threshold');
    }
    if (!Array.isArray(c.dmeReadingsNm) || !c.dmeReadingsNm.length) throw new Error('dmeReadingsNm cannot be empty');
    c.dmeReadingsNm.forEach((d, i) => nonNegative(d, 'dmeReadingsNm[' + i + ']'));
    if (new Set(c.dmeReadingsNm).size !== c.dmeReadingsNm.length) throw new Error('duplicate DME readings');
    // COVERAGE POLICY: every chart must have modeled rows out to at least
    // 10 NM from the threshold AND a DME reading >= D10. This is a display
    // coverage requirement, not permission to extend a published procedure.
    c.minimumThresholdCoverageNm = nonNegative(
      c.minimumThresholdCoverageNm === undefined ? 10 : c.minimumThresholdCoverageNm,
      'minimumThresholdCoverageNm');
    if (c.minimumThresholdCoverageNm < 10 - EPS) throw new Error('MINIMUM_COVERAGE_MUST_BE_AT_LEAST_10_NM');
    c.minimumDmeCoverageNm = nonNegative(
      c.minimumDmeCoverageNm === undefined ? 10 : c.minimumDmeCoverageNm,
      'minimumDmeCoverageNm');
    if (c.minimumDmeCoverageNm < 10 - EPS) throw new Error('MINIMUM_DME_COVERAGE_MUST_BE_AT_LEAST_D10');
    c.coverageStepDmeNm = nonNegative(
      c.coverageStepDmeNm === undefined ? 1 : c.coverageStepDmeNm,
      'coverageStepDmeNm');
    if (Math.abs(c.coverageStepDmeNm - 1) > EPS)
      throw new Error('INTEGER_DME_GRID_REQUIRED: coverageStepDmeNm must be exactly 1');
    c.autoExtendCoverage = c.autoExtendCoverage !== false;
    c.publishedConstraints = c.publishedConstraints || [];
    if (!Array.isArray(c.publishedConstraints)) throw new Error('publishedConstraints must be an array');
    c.publishedConstraints = c.publishedConstraints.map((f, i) => {
      if (!f || typeof f !== 'object') throw new Error('bad published constraint ' + i);
      nonNegative(f.dmeNm, 'constraint.dmeNm');
      number(f.altitudeFt, 'constraint.altitudeFt');
      if (!validKinds.has(f.type)) throw new Error('constraint.type must be minimum, mandatory, or maximum');
      return { ...f };
    });
    if (c.validAngleDmeRange != null) {
      const r = c.validAngleDmeRange;
      nonNegative(r.from, 'validAngleDmeRange.from');
      nonNegative(r.to, 'validAngleDmeRange.to');
      if (r.from > r.to) throw new Error('angle DME range from cannot exceed to');
    }
    if (c.mdaFt !== undefined && c.mdaFt !== null) number(c.mdaFt, 'mdaFt');
    c.mandatoryToleranceFt = nonNegative(c.mandatoryToleranceFt === undefined ? 0 : c.mandatoryToleranceFt, 'mandatoryToleranceFt');
    return c;
  }

  function horizontalDistanceFromDme(dmeNm, c) {
    const station = c.station;
    const offsetSigned = station.placement === 'after_threshold' ? station.offsetNm
      : station.placement === 'before_threshold' ? -station.offsetNm : 0;
    const h0 = c.thresholdElevationFt + c.tchFt;
    const g = c.gradientFtPerNm;
    const lat = station.lateralNm;
    const roots = [];
    if (station.elevationFt == null) {
      const squared = dmeNm * dmeNm - lat * lat;
      if (squared < -EPS) return { error: 'DME_LT_LATERAL_OFFSET' };
      const projected = Math.sqrt(Math.max(0, squared));
      roots.push(projected - offsetSigned, -projected - offsetSigned);
    } else {
      // True slant-DME geometry for a linear vertical model:
      // D^2 = (x + s)^2 + lateral^2 + ((h0 + g*x - stationElev)/6076.115...)^2
      const z = (h0 - station.elevationFt) / FEET_PER_NM;
      const k = g / FEET_PER_NM;
      const a = 1 + k * k;
      const b = 2 * (offsetSigned + z * k);
      const cc = offsetSigned * offsetSigned + lat * lat + z * z - dmeNm * dmeNm;
      const discriminant = b * b - 4 * a * cc;
      if (discriminant < -EPS) return { error: 'DME_INCOMPATIBLE_WITH_SLANT_RANGE' };
      const root = Math.sqrt(Math.max(0, discriminant));
      roots.push((-b + root) / (2 * a), (-b - root) / (2 * a));
    }
    const candidates = roots.filter(x => x >= -EPS).map(x => Math.max(0, x));
    if (station.placement === 'before_threshold') {
      const selected = candidates.filter(x => station.branch === 'before_station'
        ? x + EPS >= station.offsetNm : x <= station.offsetNm + EPS);
      if (!selected.length) return { error: 'DME_BRANCH_NOT_ON_INBOUND_FINAL' };
      if (selected.length > 1 && Math.abs(selected[0] - selected[1]) > EPS) return { error: 'AMBIGUOUS_DME_POSITION' };
      return { distanceNm: selected[0] };
    }
    if (!candidates.length) return { error: 'DME_POSITION_BEYOND_THRESHOLD' };
    // The inbound path before threshold is the candidate with the greatest x.
    return { distanceNm: Math.max(...candidates) };
  }

  // Forward geometry to identify the DME that corresponds to a point 10 NM
  // before the THRESHOLD, not simply DME 10. Same lateral/slant model as
  // horizontalDistanceFromDme; never substitute airport distance for DME.
  function dmeAtThresholdDistance(thresholdDistanceNm, c) {
    const x = nonNegative(thresholdDistanceNm, 'thresholdDistanceNm');
    const offsetSigned = c.station.placement === 'after_threshold' ? c.station.offsetNm
      : c.station.placement === 'before_threshold' ? -c.station.offsetNm : 0;
    const vertical = c.station.elevationFt == null ? 0
      : (c.thresholdElevationFt + c.tchFt + c.gradientFtPerNm * x - c.station.elevationFt) / FEET_PER_NM;
    return Math.sqrt((x + offsetSigned) ** 2 + c.station.lateralNm ** 2 + vertical ** 2);
  }

  function extendCoverage(readings, c) {
    // One-nautical-mile table rows ONLY. Decimal DME values are retained for
    // published fixes and the separate computed VDP annotation, not table rows.
    const requiredDmeAtThreshold = dmeAtThresholdDistance(c.minimumThresholdCoverageNm, c);
    const requiredMaxDme = Math.max(c.minimumDmeCoverageNm, requiredDmeAtThreshold);
    const startPointDme = dmeAtThresholdDistance(0, c);
    // Inbound final before threshold: suppress impossible DME grid points on
    // the far side of an after-threshold transmitter.
    const lower = c.station.placement === 'before_threshold' ? 1
      : Math.max(1, Math.ceil(startPointDme - EPS));
    const upper = c.autoExtendCoverage
      ? Math.ceil(requiredMaxDme - EPS)
      : Math.floor(Math.max(...readings) + EPS);
    if (upper - lower > 500) throw new Error('COVERAGE_EXTENSION_EXCEEDS_500_ROWS');
    const allReadings = [];
    for(let i=lower;i<=upper;i++) allReadings.push(i);
    const originallyPresent = new Set(readings.filter(n=>Math.abs(n-Math.round(n))<EPS).map(n=>Math.round(n)));
    const requestedMaxThreshold = Math.max(-Infinity,...readings.map(d => {
      const r = horizontalDistanceFromDme(d,c);
      return r.error ? -Infinity : r.distanceNm;
    }));
    return {
      allReadings,
      autoAddedReadings: allReadings.filter(d=>!originallyPresent.has(d)),
      requiredDmeAtThresholdNm: Math.round(requiredDmeAtThreshold*1e6)/1e6,
      requestedMaxThresholdNm: requestedMaxThreshold,
      requestedMaxDmeNm: Math.max(...readings),
      gridStartDmeNm: lower,
      gridEndDmeNm: upper,
      gridStepDmeNm: 1,
    };
  }

  function calculatedVdp(c) {
    if (c.mdaFt === undefined || c.mdaFt === null) return {
      status: 'UNAVAILABLE', reason: 'MDA_NOT_SUPPLIED',
      published: false, dmeDisplay: null
    };
    const crossing = c.thresholdElevationFt + c.tchFt;
    const thresholdNm = (c.mdaFt - crossing) / c.gradientFtPerNm;
    if (thresholdNm < -EPS) return {
      status: 'UNAVAILABLE', reason: 'MDA_BELOW_THRESHOLD_CROSSING_ALTITUDE',
      published: false, dmeDisplay: null
    };
    const dme = dmeAtThresholdDistance(Math.max(0,thresholdNm),c);
    if(!Number.isFinite(dme) || dme < 0) return {
      status: 'UNAVAILABLE', reason: 'DME_GEOMETRY_INVALID',
      published: false, dmeDisplay: null
    };
    const within = !!c.validAngleDmeRange &&
      dme >= c.validAngleDmeRange.from - EPS && dme <= c.validAngleDmeRange.to + EPS;
    return {
      status: 'CALCULATED_MDA_INTERCEPT_QA_ONLY',
      dmeNm: Math.round(dme*1e6)/1e6,
      dmeDisplay: 'D'+dme.toFixed(1),
      thresholdDistanceNm: Math.round(thresholdNm*1e6)/1e6,
      withinPublishedAngleScope: within,
      stationGeometryVerified: c.station.geometryVerified === true,
      published: false,
      note: 'Computed MDA intercept is NOT a published VDP and is NOT a descent clearance.'
    };
  }

  function computeRow(dmeNm, c) {
    const pos = horizontalDistanceFromDme(dmeNm, c);
    if (pos.error) return {
      dmeNm, thresholdDistanceNm: null, rawAltitudeFt: null,
      roundedAltitudeFt: null, status: 'UNRESOLVED', reasons: [pos.error],
    };
    const raw = c.thresholdElevationFt + c.tchFt + c.gradientFtPerNm * pos.distanceNm;
    const inAngleRange = c.validAngleDmeRange &&
      dmeNm >= c.validAngleDmeRange.from - EPS && dmeNm <= c.validAngleDmeRange.to + EPS;
    const reasons = [];
    if (c.usedAirportElevationFallback) reasons.push('AIRPORT_ELEVATION_USED_INSTEAD_OF_RUNWAY_THRESHOLD_QA');
    if (c.angleSource === 'DEFAULT_ASSUMED_3_DEG') reasons.push('DEFAULT_3_DEG_ASSUMED_NOT_PUBLISHED');
    if (!c.validAngleDmeRange) reasons.push('ANGLE_SCOPE_NOT_VERIFIED');
    else if (!inAngleRange) reasons.push('OUTSIDE_PUBLISHED_ANGLE_SCOPE');
    if (c.station.geometryVerified === false) reasons.push('STATION_GEOMETRY_NOT_SURVEY_VERIFIED');
    return {
      dmeNm, thresholdDistanceNm: Math.round(pos.distanceNm * 1000000) / 1000000,
      rawAltitudeFt: Math.round(raw * 1000000) / 1000000,
      roundedAltitudeFt: round20(raw),
      status: reasons.length ? 'MODEL_ONLY' : 'CANDIDATE_QA',
      reasons,
    };
  }

  function checkConstraint(f, c) {
    const r = computeRow(f.dmeNm, c);
    if (r.rawAltitudeFt === null) return { ...f, rawAltitudeFt: null, ok: false, code: 'CANNOT_LOCATE_PUBLISHED_FIX' };
    const h = r.rawAltitudeFt;
    // Published altitudes are NEVER rounded. Compare unrounded model outputs.
    const ok = f.type === 'minimum' ? h + EPS >= f.altitudeFt
      : f.type === 'maximum' ? h <= f.altitudeFt + EPS
        : Math.abs(h - f.altitudeFt) <= c.mandatoryToleranceFt + EPS;
    return { ...f, rawAltitudeFt: h, roundedAltitudeFt: r.roundedAltitudeFt,
      ok, code: ok ? 'PASS' : f.type === 'mandatory' ? 'MANDATORY_ALTITUDE_CONFLICT'
        : f.type === 'minimum' ? 'BELOW_PUBLISHED_MINIMUM' : 'ABOVE_PUBLISHED_MAXIMUM' };
  }

  function buildTable(input) {
    const c = normalizeConfig(input);
    const coverageGrid = extendCoverage(c.dmeReadingsNm, c);
    const checks = c.publishedConstraints.map(f => checkConstraint(f, c));
    const vdp = calculatedVdp(c);
    const issues = checks.filter(f => !f.ok).map(f => ({
      code: f.code, dmeNm: f.dmeNm, publishedAltitudeFt: f.altitudeFt,
      calculatedRawAltitudeFt: f.rawAltitudeFt,
      publishedType: f.type,
      message: 'Review chart DME, threshold geometry and angle; do not auto-correct altitude.',
    }));
    const nonLocatableInput = c.dmeReadingsNm.filter(d => !!horizontalDistanceFromDme(d,c).error);
    if (nonLocatableInput.length) issues.push({
      code:'REQUESTED_DME_GEOMETRY_UNRESOLVED',
      readingsNm:nonLocatableInput,
      message:'Source DME positions inconsistent with station geometry; hold QA result.'
    });
    // The highest DME permitted on this simple modeled segment is the first
    // exact mandatory crossing met while moving outward from threshold.
    const stopDme = c.publishedConstraints.filter(f => f.type === 'mandatory')
      .reduce((min, f) => Math.min(min, f.dmeNm), Infinity);
    const rows = coverageGrid.allReadings.map(dme => {
      const r = computeRow(dme, c);
      if (c.mdaFt !== undefined && c.mdaFt !== null && r.rawAltitudeFt !== null && r.rawAltitudeFt < c.mdaFt - EPS) {
        r.status = 'MODEL_ONLY';
        r.reasons.push('BELOW_MDA_DO_NOT_USE');
      }
      if (dme > stopDme + EPS && r.rawAltitudeFt !== null) {
        r.status = 'MODEL_ONLY';
        r.reasons.push('BEYOND_MANDATORY_STOP');
      }
      const anchors = c.publishedConstraints.filter(f => Math.abs(f.dmeNm - dme) < EPS);
      r.published = anchors.map(f => ({ type: f.type, altitudeFt: f.altitudeFt, label: f.label || '' }));
      r.coverageAutoExtended = coverageGrid.autoAddedReadings.some(x => Math.abs(x-dme) < 0.00001);
      if (anchors.length && checks.some(f => !f.ok && Math.abs(f.dmeNm - dme) < EPS)) {
        r.status = 'CONFLICT';
        r.reasons.push('PUBLISHED_ALTITUDE_CONFLICT');
      }
      return r;
    });
    if (vdp.dmeNm != null && rows.length) {
      // Attach a marker to the closest integer-DME row, without adding an
      // out-of-grid fractional table row.
      const markerRow = rows.reduce((best,r) =>
        !best || Math.abs(r.dmeNm-vdp.dmeNm) < Math.abs(best.dmeNm-vdp.dmeNm) ? r : best, null);
      markerRow.vdpMarker = vdp.dmeDisplay;
    }
    const unresolvedRows = rows.filter(r => r.rawAltitudeFt === null).length;
    if (unresolvedRows) issues.push({ code: 'UNRESOLVED_DME_GEOMETRY', count: unresolvedRows });
    const maxThresholdNm = Math.max(-Infinity, ...rows.filter(r => r.thresholdDistanceNm != null).map(r => r.thresholdDistanceNm));
    const maxDmeNm = Math.max(...rows.map(r=>r.dmeNm));
    const reachesThreshold = maxThresholdNm >= c.minimumThresholdCoverageNm - 0.0001;
    const reachesDme = maxDmeNm >= c.minimumDmeCoverageNm - 0.0001;
    if (!reachesThreshold || !reachesDme) issues.push({
      code: 'MINIMUM_10NM_COVERAGE_NOT_MET',
      requestedThresholdNm:c.minimumThresholdCoverageNm, actualThresholdNm:maxThresholdNm,
      requestedDmeNm:c.minimumDmeCoverageNm, actualDmeNm:maxDmeNm,
      message:'DME branch or station geometry must be reviewed; never fabricate a 10-NM verified path.'
    });
    // Chart angle's geometric coverage is reported separately from QA eligibility.
    // A chart-verified angle segment can end at D9 even when transmitter location
    // still requires a precise geodetic/survey check.
    const scopedRows = c.validAngleDmeRange ? rows.filter(r =>
      r.thresholdDistanceNm != null &&
      r.dmeNm >= c.validAngleDmeRange.from - EPS &&
      r.dmeNm <= c.validAngleDmeRange.to + EPS) : [];
    const maxPublishedModeledThresholdNm = scopedRows.length
      ? Math.max(...scopedRows.map(r=>r.thresholdDistanceNm)) : null;
    const coverage = {
      requiredThresholdDistanceNm: c.minimumThresholdCoverageNm,
      requiredDmeReadoutNm: c.minimumDmeCoverageNm,
      dmeAtRequiredThresholdNm: coverageGrid.requiredDmeAtThresholdNm,
      maxModeledThresholdDistanceNm: maxThresholdNm,
      maxModeledDmeNm: maxDmeNm,
      meetsThresholdModelCoverage: reachesThreshold,
      meetsDmeModelCoverage: reachesDme,
      autoAddedDmeReadingsNm: coverageGrid.autoAddedReadings,
      gridStepDmeNm: 1,
      gridStartDmeNm: coverageGrid.gridStartDmeNm,
      gridEndDmeNm: coverageGrid.gridEndDmeNm,
      maxPublishedAngleScopedThresholdNm: maxPublishedModeledThresholdNm,
      publishedAngleCovers10Nm: maxPublishedModeledThresholdNm !== null && maxPublishedModeledThresholdNm >= c.minimumThresholdCoverageNm - 0.0001,
      modelExtensionIsPublishedProcedure: false,
      note: 'Model coverage is NOT published CDFA authorization. Rows beyond chart angle/fix scope remain MODEL_ONLY.'
    };
    const blocked = issues.length > 0;
    return {
      version: '1.4.0', chartId: c.chartId || null, referenceDmeId: c.chartDmeId,
      parameters: {
        thresholdElevationFt: c.thresholdElevationFt,
        airportElevationFt: c.airportElevationFt ?? null,
        elevationSource: c.elevationSource,
        usedAirportElevationFallback: c.usedAirportElevationFallback,
        tchFt: c.tchFt,
        crossingAltitudeFt: c.thresholdElevationFt + c.tchFt, mdaFt: c.mdaFt ?? null,
        angleDeg: c.angleDeg, angleSource: c.angleSource, gradientFtPerNm: c.gradientFtPerNm,
        dmePlacement: c.station.placement, dmeOffsetNm: c.station.offsetNm,
        lateralOffsetNm: c.station.lateralNm,
        usedSlantRangeCorrection: c.station.elevationFt != null,
        publishedAngleDmeRange: c.validAngleDmeRange || null,
      },
      checks, issues, rows, coverage, vdp,
      status: blocked ? 'BLOCKED_BY_QA' : c.usedAirportElevationFallback ? 'PRELIMINARY_AIRPORT_ELEV_FALLBACK' : 'PRELIMINARY_GEOMETRY',
      warnings: c.usedAirportElevationFallback
        ? ['AIRPORT_ELEVATION_FALLBACK_QA: runway threshold elevation absent; computed geometry is not threshold-verified.'] : [],
      // Rows with an unresolved station, angle scope or published altitude
      // mismatch are withheld. Full operational validation is separate.
      candidateRows: blocked ? [] : rows.filter(r => r.status === 'CANDIDATE_QA'),
      disclaimer: 'SIMULATOR/ENGINEERING QA ONLY. Not for actual navigation; not obstacle-clearance approved.'
    };
  }

  return { buildTable, round20, gradientForAngle, horizontalDistanceFromDme, dmeAtThresholdDistance, calculatedVdp };
});