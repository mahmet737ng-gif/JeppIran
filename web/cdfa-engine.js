/* JEPPIRAN CDFA Geometry Engine v1.0 - offline, framework independent.
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
    c.thresholdElevationFt = number(c.thresholdElevationFt, 'thresholdElevationFt');
    c.tchFt = nonNegative(c.tchFt, 'tchFt');
    c.angleDeg = number(c.angleDeg, 'angleDeg');
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
    if (!c.validAngleDmeRange) reasons.push('ANGLE_SCOPE_NOT_VERIFIED');
    else if (!inAngleRange) reasons.push('OUTSIDE_PUBLISHED_ANGLE_SCOPE');
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
    const checks = c.publishedConstraints.map(f => checkConstraint(f, c));
    const issues = checks.filter(f => !f.ok).map(f => ({
      code: f.code, dmeNm: f.dmeNm, publishedAltitudeFt: f.altitudeFt,
      calculatedRawAltitudeFt: f.rawAltitudeFt,
      publishedType: f.type,
      message: 'Review chart DME, threshold geometry and angle; do not auto-correct altitude.',
    }));
    // The highest DME permitted on this simple modeled segment is the first
    // exact mandatory crossing met while moving outward from threshold.
    const stopDme = c.publishedConstraints.filter(f => f.type === 'mandatory')
      .reduce((min, f) => Math.min(min, f.dmeNm), Infinity);
    const rows = c.dmeReadingsNm.map(dme => {
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
      if (anchors.length && checks.some(f => !f.ok && Math.abs(f.dmeNm - dme) < EPS)) {
        r.status = 'CONFLICT';
        r.reasons.push('PUBLISHED_ALTITUDE_CONFLICT');
      }
      return r;
    });
    const unresolvedRows = rows.filter(r => r.rawAltitudeFt === null).length;
    if (unresolvedRows) issues.push({ code: 'UNRESOLVED_DME_GEOMETRY', count: unresolvedRows });
    const blocked = issues.length > 0;
    return {
      version: '1.0.0', chartId: c.chartId || null, referenceDmeId: c.chartDmeId,
      parameters: {
        thresholdElevationFt: c.thresholdElevationFt, tchFt: c.tchFt,
        crossingAltitudeFt: c.thresholdElevationFt + c.tchFt, mdaFt: c.mdaFt ?? null,
        angleDeg: c.angleDeg, gradientFtPerNm: c.gradientFtPerNm,
        dmePlacement: c.station.placement, dmeOffsetNm: c.station.offsetNm,
        lateralOffsetNm: c.station.lateralNm,
        usedSlantRangeCorrection: c.station.elevationFt != null,
        publishedAngleDmeRange: c.validAngleDmeRange || null,
      },
      checks, issues, rows,
      status: blocked ? 'BLOCKED_BY_QA' : 'PRELIMINARY_GEOMETRY',
      // Rows with an unresolved station, angle scope or published altitude
      // mismatch are withheld. Full operational validation is separate.
      candidateRows: blocked ? [] : rows.filter(r => r.status === 'CANDIDATE_QA'),
      disclaimer: 'SIMULATOR/ENGINEERING QA ONLY. Not for actual navigation; not obstacle-clearance approved.'
    };
  }

  return { buildTable, round20, gradientForAngle, horizontalDistanceFromDme };
});