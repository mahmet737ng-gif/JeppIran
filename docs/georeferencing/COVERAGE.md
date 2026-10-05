# Georeferencing coverage

Source: `Iran2620.pdf`, chart cycle 2026-20, 991 indexed pages, data version v18.
SHA-256: `ee439abb9c582a42020eec738a370db9742c84f4aa198d7181ef0c5fe34933b4`.

All 36 airports were processed. 314 charts have measured graticule references.
Coverage is not complete for every chart: 200 source pages explicitly say NOT TO SCALE,
184 have no printed graticule, and 293 need additional control points or region review.
Excluded pages have no active aircraft overlay.

## Method and checks

- Read latitude/longitude labels and their actual vector ticks from the PDF. Text label centres are not map control points.
- Resolve grid orientation, including sideways charts; construct intersections from at least two distinct values on each geographic axis.
- Fit a mean-centred affine transform using every measured intersection, require non-collinear points and a maximum residual of 0.75 PDF points, and check geographic scale and axis angle.
- Keep the marker inside the calibrated plan view. Mask identified inset maps with a different scale.
- Match references to chart data version and PDF dimensions. Convert untrimmed PDF points using the actual rendered bitmap dimensions and exact integer top crop.
- Rotate the aircraft heading using the geographic transform so north remains correct on rotated charts.
- Independently validate every delivered control point against the source labels/tick vectors, metadata and index; classify all 991 pages exactly once.
- Supplementary visual review: 45 rendered examples across all 36 airports, recorded in `reviewed-pages.json`. Other accepted pages have automated source checks, not a claim of manual inspection.

The AWZ VOR check uses printed N31 20.3 E048 45.9 on source page 32 and its independently measured symbol centre on page 42. Its residual is 1.311 PDF points (tolerance 1.6); the printed coordinate is rounded to 0.1 arcminute. EGVAX 1B is a SID on page 32 (10-3), explicitly NOT TO SCALE, so one station coordinate cannot calibrate that entire drawing.

A fitting residual measures agreement with the printed grid, not certified navigation accuracy.
Mixed-scale and insufficient-control-point pages remain excluded until separately calibrated.
Replacing the PDF or index requires re-extraction and renewed review.

## Coverage by ICAO

| ICAO | Indexed pages | Calibrated | NOT TO SCALE | Other excluded |
| --- | ---: | ---: | ---: | ---: |
| LTFM | 175 | 94 | 9 | 72 |
| OIAA | 22 | 5 | 9 | 8 |
| OIAM | 8 | 5 | 2 | 1 |
| OIAW | 25 | 8 | 9 | 8 |
| OIBB | 22 | 11 | 6 | 5 |
| OIBK | 23 | 3 | 0 | 20 |
| OIBP | 15 | 9 | 3 | 3 |
| OICC | 27 | 5 | 0 | 22 |
| OICI | 11 | 2 | 4 | 5 |
| OIFM | 39 | 13 | 9 | 17 |
| OIGG | 31 | 3 | 0 | 28 |
| OIHH | 13 | 5 | 5 | 3 |
| OIIE | 35 | 7 | 7 | 21 |
| OIII | 47 | 11 | 6 | 30 |
| OIIP | 15 | 5 | 7 | 3 |
| OIKK | 17 | 3 | 1 | 13 |
| OIMB | 14 | 4 | 6 | 4 |
| OIMM | 43 | 11 | 19 | 13 |
| OIMN | 13 | 5 | 5 | 3 |
| OIMS | 10 | 5 | 3 | 2 |
| OING | 13 | 6 | 0 | 7 |
| OINZ | 10 | 1 | 0 | 9 |
| OISS | 44 | 6 | 19 | 19 |
| OITL | 28 | 9 | 15 | 4 |
| OITR | 21 | 8 | 9 | 4 |
| OITT | 22 | 6 | 7 | 9 |
| OIYY | 26 | 6 | 1 | 19 |
| OIZC | 15 | 6 | 0 | 9 |
| OIZH | 31 | 10 | 3 | 18 |
| OMDB | 56 | 13 | 6 | 37 |
| OOMS | 34 | 9 | 8 | 17 |
| ORBI | 13 | 3 | 5 | 5 |
| ORNI | 15 | 4 | 6 | 5 |
| UDYZ | 20 | 7 | 0 | 13 |
| UGSB | 12 | 2 | 1 | 9 |
| UGTB | 26 | 4 | 10 | 12 |
| **Total** | **991** | **314** | **200** | **477** |

Exact page numbers and exclusion reasons are in `georef-audit.json`; the active references are in `app/src/main/assets/chart-georef.json`.

## Reproduce

From the repository root with the actual Git LFS PDF downloaded:

```sh
python -m pip install -r scripts/requirements-georef.txt
python scripts/extract_chart_georef.py --reviewed-pages 9,22,38,42,44,46,47,48,50,51,63,84,99,128,148,154,208,228,254,281,323,341,357,365,412,421,433,446,456,512,532,552,576,594,622,636,648,665,708,752,775,799,804,825,891
python scripts/validate_chart_georef.py
```

The extractor defaults to no manual-review claims. To preserve the recorded supplementary review for this exact source, supply `--reviewed-pages` followed by the comma-separated page list in `reviewed-pages.json` before validation. For a replaced PDF, inspect new samples and update the review record first.

GitHub workflow `Verify JeppIran Georeferencing and APK` checks the source data, runs Android JVM tests for projection/cropping/rotation/invalid references, and builds a debug APK on `fix/aircraft-position-lifecycle`.
