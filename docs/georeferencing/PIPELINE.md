# Cycle-independent chart georeferencing

This pipeline changes only georeferencing scripts, audit files and
`chart-georef.json`. It does not modify application, UI or Gradle sources.

## Evidence hierarchy

1. Pair printed latitude/longitude labels with their actual vector ticks.
2. Prefer a closed plan-view frame, but do not require one. Broken/open frames
   use label orientation, nearest collinear tick, duplicate agreement,
   monotonicity and scale consistency.
3. If one geographic axis has a single measured value and the orthogonal axis
   has two or more, derive only the missing scale from the local conformal
   relationship. Derived points are explicitly marked; they are never recorded
   as measured ticks.
4. Fit the complete transform and reject residual, angle, geographic-scale,
   bounds, source-evidence or mirrored-orientation failures. Because PDF y
   increases downward, the east/north-to-page transform must have a negative
   determinant.
5. A page containing `NOT TO SCALE` is withheld even when a candidate fit is
   found. It becomes active only through a review decision bound to the exact
   canonical page fingerprint, or by unchanged reuse of a previously accepted
   fingerprint.

No airport, chart title or page number is embedded in the detection logic.

## What survives an AIRAC update

Each chart stores two independent identifiers:

- `chartKey`: airport/category/chart number/name, without a PDF page number.
- `sourceFingerprint`: SHA-256 of canonical visible text, page dimensions and
  vector segments, without PDF object IDs.

With `--previous-georef`, a chart is reused only when both identifiers and page
dimensions match. It may move to another PDF page. If any visible geometry or
text changes, reuse is refused and the chart goes through extraction again.
This prevents a changed plate from inheriting stale coordinates.

The manifest supplies data version, cycle and page count by default. Output and
audit JSON files are written atomically, so a failed new cycle leaves the last
complete files in place.

## New-cycle command

```sh
python -m pip install -r scripts/requirements-georef.txt
python scripts/extract_chart_georef.py \
  --pdf Iran2620.pdf \
  --index app/src/main/assets/charts-app-v18.json \
  --manifest app/src/main/assets/charts-manifest.json \
  --previous-georef previous/chart-georef.json \
  --review-decisions docs/georeferencing/review-decisions.json
python scripts/validate_chart_georef.py
```

For a new cycle, replace the PDF, index and manifest paths. Do not copy old page
numbers or manually edit generated coordinates.

## Review-decision schema

Exceptional approval is content-addressed, not page-addressed:

```json
{
  "version": 1,
  "decisions": [
    {
      "sourceFingerprint": "64 lowercase hex characters",
      "action": "allow_measured_plan",
      "reason": "Reviewed: NOT TO SCALE applies outside the measured plan view"
    }
  ]
}
```

When a chart changes in a later cycle, its fingerprint changes and the approval
does not carry forward silently.
