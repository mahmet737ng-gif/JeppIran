# JeppIran implementation progress

This is a request checklist, not a claim that every feature is complete.
Baseline inspected: main at 40fd874fb2bd084502b75317538b7fc780be928d.
Work branch: fix/aircraft-position-lifecycle.

## Step 1: Aircraft Position

Code committed in 51b111b58b5d3d9a585efdd657e8c0d9d6c71cf1:
- Resynchronize the viewer toggle from the persistent preference on resume.
- Stop GPS and viewer simulator polling on pause.
- Clear cached GPS coordinates whenever GPS stops.
- Reject callbacks from stopped/replaced listeners with a generation counter.
- Block late permission callbacks while disabled or paused.
- Avoid repeated automatic permission prompts after denial.
- Remove a previous listener before registering another.
- Wait for a fresh GPS update instead of restoring an old last-known location.
- Do not fall back to phone coordinates while a simulator connection is active.

Validation: reviewed the diff and passed git diff --check.
Compilation and JVM tests are being checked in the new GitHub georeferencing workflow.
Device behavior remains unverified; user device testing is deferred until the final APK.
The simulator transport itself is unchanged; pausing the viewer does not disconnect it.

Final device checks:
1. OFF before opening a chart: no location prompt or marker.
2. ON with permission: receive a fresh location.
3. OFF while updates arrive, then ON: no old callback or cached fix reappears.
4. Background and resume, including rotation: listener is stopped and restarted without duplicates.
5. Deny permission: no automatic prompt loop; retry by toggling ON.
6. Change the preference in Settings and return: viewer reflects it.
7. Simulator connected without a fix: phone coordinates are not displayed.
8. Chart without valid georeferencing: no aircraft marker.

## Step 2: Real chart georeferencing across every airport

Processed all 991 source pages for all 36 indexed airports. Delivered references for
314 charts measured from the actual printed grid labels and vector ticks. All 36
airports have at least one calibrated chart; this is not full coverage of every chart.

- 200 pages explicitly say NOT TO SCALE and are excluded.
- 184 pages have no printed graticule.
- 293 pages require additional control points or separate region review.
- EGVAX 1B at Ahwaz is a SID on source page 32 (10-3), explicitly NOT TO SCALE.
  Its AWZ coordinate alone cannot georeference that whole schematic drawing.
- Replaced the old minimal georeference format with versioned WGS84/PDF-point metadata,
  measured control points, source provenance, plan-view bounds and inset masks.
- Fit and validate every measured point; reject ambiguous, non-collinear or inconsistent
  references. Cache the fitted transform.
- Correctly convert source coordinates using actual rendered dimensions and integer crop.
- Transform aircraft heading for rotated charts.
- Hide overlays on uncalibrated pages, excluded insets and mismatched PDF dimensions/data version.

Validation completed locally: all 314 references checked against the source PDF,
all 991 pages classified exactly once, all 36 airports represented; maximum measured
grid residual 0.686838 PDF points. Visually inspected 45 source renderings across every
airport, including rotated charts and insets. Independent AWZ VOR check: 1.310667 PDF
points (tolerance 1.6). These are checks against the printed chart, not certified navigation accuracy.

Added JVM tests for the independent AWZ location, exact crop/render dimensions, invalid
references, inset masking and rotated heading. GitHub CI/build result will be recorded
after the workflow finishes. Android device checks are still pending.

Full per-airport/page coverage and exclusion reasons: [georeferencing/COVERAGE.md](georeferencing/COVERAGE.md)
and [georeferencing/georef-audit.json](georeferencing/georef-audit.json).

## Remaining sequence (inspect existing implementation before changing)

3. Simulator connection: X-Plane, MSFS 2020/2024 and P3D guidance, actual transports/bridge,
   source selection, disconnect handling and position freshness.
4. Complete METAR display and error/loading behavior.
5. Annotation tools: Pen, Highlight, Text, Eraser; colors; text movement/resizing.
6. Navigation: swipe, previous/next, fullscreen, chart tree/categories and search.
7. Chart title corrections; airports sorted by ICAO with airport name and city.
8. Diagnose and improve download speed.
9. Logo, app icon and splash.
10. Dark mode/invert and portrait/landscape layout.
11. Build, fix actual compilation errors, deliver APK for final user testing.
12. Resolve final test findings and prepare release.

Steps 1 and 2 have code/data changes in this work session. The remaining feature areas
have not yet been audited end to end or changed in this step; existing code may already
implement parts of them. Do not report them as newly completed.
User device testing is deferred until the final APK.
