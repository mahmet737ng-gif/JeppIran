# JEPPIRAN V2621 — source PDF pages 1161–1360 (200-page audit)

Original source: `2621(2).pdf` / `Iran2621.pdf`, 1654 pages, SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.

## What was actually checked
- All 200 pages (1161 through 1360 inclusive) **independently rendered as full-page 200-DPI JPEGs** at 1700 x 2200 pixels, one image per source PDF page. Per-page render hashes saved in a local JSON inventory and the raw images in a ZIP.
- Machine comparison against the *current production V2621 chart index* found exactly 200 indexed records, no missing or duplicated global page numbers.
- Source PDF text checked across the complete batch; source header and chart title evidence checked on issue pages.
- **Only selected full-size page images were directly visually inspected, including pages 1200, 1201, 1347, 1348, 1350, 1351, plus representative 4-up source page sheets.** Other pages have render/text screening, **not** independent full-native-size visual sign-off. See row-specific `visual_review_status` in CSV. Do not call the whole batch visually approved.

## Airports / source page ranges
- `LTAC` Ankara Esenboğa — 1161 only (continuation from previous 200-page batch);
- `LTFM` İstanbul — 1162–1336 (175 pages);
- `UDYZ` Yerevan Zvartnots — 1337–1356 (20 pages);
- `UGTB` Tbilisi — 1357–1360 (4 pages, continuing after this batch).

## Categories and found errors

| Category | Before (production index) | After source-supported repairs |
| --- | ---: | ---: |
| AIRPORT | 71 | 71 |
| STAR | 40 | **22** |
| SID | 33 | **51** |
| APP | 56 | 56 |
| **TOTAL** | **200** | **200** |

**Major systematic error: 18 independent LTFM departure charts were filed as STAR instead of SID**:

`1200, 1201, 1203, 1205, 1207, 1209, 1211, 1213, 1214, 1215, 1216, 1217, 1218, 1219, 1220, 1226, 1228, 1229`.

Every one of these 18 original source pages contains **`SID` and `DEPARTURE(S)`** in the PDF chart content, while its production index category was STAR. For example 1200 `30-3E1` = EKAWE 1M / MAKOL 1M and 1201 `30-3E2` = EKAWE 1L / MAKOL 1L, both RNAV (GNSS) departure procedures. The occasional word `STAR` in a caution or cross-reference on a SID page is **not** evidence that its chart is a STAR.

**Four UDYZ approach metadata fixes**, confirmed from full-size source page images:

| Original PDF page | Source plate | Source printed title |
|---|---|---|
| 1347 | `11-1` | **ILS DME RWY 08** (original index title `APPROACH 11-1`) |
| 1348 | `11-1A` | **CAT II ILS DME RWY 08** (original `APPROACH 11-1A`) |
| 1350 | `12-2` | **RNP Z RWY 26** (original index plate empty and generic title `RNP RWY 26`) |
| 1351 | `12-3` | **RNP Y RWY 26** (original index plate empty and generic title `RNP RWY 26`) |

Important continuation/dedup findings:
- LTFM source pages 1162–1173 include true sequential airport-information/briefing text pages, not simple duplicates.
- LTFM 1243–1288 contain numerous distinct airport diagram, hot-spot, taxi-routing and apron/stand/coordinate pages; visually similar base maps may have different routing/highlight layers. Do not automatically collapse such pages.
- UDYZ 1344 `10-9` ADC, 1345 `10-9A` parking/stand diagram, 1346 `10-9S` MINIMUMS are distinct AIRPORT pages, not APP and not duplicates.
- UDYZ 1350 and 1351 use the same RWY 26 but differ by **RNP Z/Y**, profile/minima and chart number; retain both.
- UGTB 1357–1358 General Airport Information; 1359 `10-1P` and 1360 `10-1P1` are two parts of AIRPORT BRIEFING, not duplicates.

## Georeference / production safety
This audit **does not approve any additional georeferencing**. Candidate georeferencing for ADC / stand charts and approaches requires independent geometric controls, scale/orientation, valid map-region masks and error evaluation; `NOT TO SCALE` insets must not be forced into a common transform. This report makes no finding about which legacy V2621 calibrations are valid or absent.

The separate print-clean derivative of the **whole 1654-page PDF** and previously published print-clean **airport PDFs** keep the entire source page media/crop rectangles unchanged, removing only the generated `Printed from JeppView...` / `Printed on...` text, **without cropping the border**. These new 22 corrections are index metadata changes only: original PDF geometry and simulator integrations must not change.

## Audit record / release notes
Per-page CSV: `docs/audits/V2621/manual-review/pages1161-1360_page-by-page.csv`; includes 200 rows, before/after category, titles, and evidence levels. This audit document is **not an assertion that every page has been independently inspected at full-size**. Any production release of these source-supported metadata corrections should be verified by examining the updated `main` JSON and the successful PWA/APK build status.

Remaining: next 200 new source PDF pages **1361–1560**, then 1561–1654. Full-size visual proofreading pending on unverified pages and earlier screened batches. NOT FOR ACTUAL NAVIGATION.
