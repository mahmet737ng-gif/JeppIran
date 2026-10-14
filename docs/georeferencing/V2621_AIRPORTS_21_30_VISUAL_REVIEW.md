# JEPPIRAN V2621 — high-resolution visual examination of 53 pages

**Source:** original `Iran2621.pdf` (SHA-256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`).  
**Scope:** 53 chart/map pages from the third 10-airport batch; the 43 informational `no_graticule` pages were excluded at the owner's request.  
**Method:** source PDF rendered at **2.5×, 1530×1980 px per page**; all 53 pages were viewed individually at large resolution. Cross-checked north arrow placement, printed geographic graticules, dashed boxed `NOT TO SCALE` labels, plan/profiles, and independent inset layouts.

## Results: 53 of 53 examined

| Visual finding | Count | Page numbers | Decision |
| --- | ---: | --- | --- |
| Measured main graticule / scale-plan, further geo extraction needed | **15** | 307, 308, 309, 310, 313, 323, 366, 371, 376, 428, 497, 498, 499, 500, 502 | Recalibrate source grid and independently check navaids or thresholds |
| Main map is drawn to scale, but has one or more boxed NOT TO SCALE sub-views | **15** | 365, 369, 379, 386, 387, 388, 389, 444, 446, 448, 454, 455, 456, 457, 501 | Mask unscaled inset only; do not discard scaled main map |
| Two differently scaled regions or apron/ADC detail; parking location must be controlled separately | **3** | 342, 432, 459 | Independent map-region treatment; check source graticule and stands |
| **Whole sheet NOT TO SCALE immediately under North indicator** | **20** | 337, 338, 339, 340, 341, 350, 351, 352, 353, 471, 472, 473, 474, 475, 476, 477, 510, 511, 512, 513 | Exclude whole sheet from geo-position rendering |

### Airport-by-airport observations

- **OIGG Rasht:** pages **307, 308, 309, 310, 313, 323** are real-scale approach/departure-style maps with visible geographic border marks. Multiple layouts are rotated. Earlier automatic rejections require rotation/grid reconciliation, not blanket exclusion.
- **OIHH Hamedan:** **337–341** each have sheet-wide NOT TO SCALE below north indication and should remain excluded. **342** ADC needs calibration of the main airport plan without overlay into its separate inset.
- **OIHR Arak:** **350–353** all have sheet-wide NOT TO SCALE below north indication and should remain excluded.
- **OIIE Imam Khomeini:** **366, 371, 376** have scaled geographic plans. **365, 369, 379, 386–389** have scaled main plans with dashed NOT TO SCALE insets. ILS pages **386–389** additionally contain profile views which are never a horizontal map. **387, 389** have independent missed-approach diagrams; those also must be excluded from the plan overlay.
- **OIII Mehrabad:** **428** has a real scale geographic map, though rotated. **432** is the airport hot-spots/parking layout with main apron and independent upper-left **Apron 5** view: do not fit one global transform across both.
- **OIKB Bandar Abbas:** **444, 446, 448, 454–457** have usable main scale-map geometry plus separate dashed NOT TO SCALE inset(s). **446** also has an independent upper boxed holding diagram. **459** has a real printed grid **27-12.3…27-12.7 / 56-22…56-22.3** and a published parking stand INS-coordinate table. Previous residual **1.828 PDF points** merits independent stand-to-grid checks; it does not prove impossibility of georeferencing.
- **OIIP Payam:** **471–477**, all sheet-wide NOT TO SCALE under north indication. Coordinates of printed fixes do not certify drawing scale.
- **OIKK Kerman:** **497–500, 502** have scaled main-chart graticules; **501** has a separate dashed NOT TO SCALE **ALMOB** inset but otherwise scaled main.
- **OIKM Bam:** **510–513** all show sheet-wide NOT TO SCALE beneath north indication, so keep excluded.

## Resulting actionable queue

**33 pages** (15 with full graticules + 15 with boxed subregions + 3 ground/inset layouts) should proceed to source-tick and independent point calculations; **20** are full-sheet schematic and should *not* receive whole-chart georeferences. **43** informational pages remain outside this visual audit.

No missing georeference has been marked flight-verified on visual inspection alone. Existing approved chart references must not be replaced by extrapolated guesses. For pages with separate insets, mask boxes in original untrimmed PDF point coordinates before enabling the aircraft marker. Enroute/flight GPS QA remains required for navigation-quality accuracy.

## Files

- **Per-page visual evidence and decisions:** [JSON report](V2621_AIRPORTS_21_30_VISUAL_REVIEW.json) (every page, PDF page number, chart name, pixel size, status, and printed NTS label rectangles).
- **Large source-image artifact:** [GitHub Actions run 38497826692](https://github.com/mahmet737ng-gif/JeppIran/actions/runs/38497826692), artifact `jeppiran-v2621-batch3-53-large-format-page-review`, containing 53 JPEGs + index.
