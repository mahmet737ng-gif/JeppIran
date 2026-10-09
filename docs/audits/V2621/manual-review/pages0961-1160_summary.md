# JEPPIRAN V2621 audit — source PDF pages 961–1160

Source: `2621(2).pdf` / `Iran2621.pdf`, 1654 pages, exact source SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.

## Scope / evidence standard
Each of pages 961–1160 was separately rendered to a **200-DPI 1700x2200 full-size JPEG** (200 source images) and a review sheet generated. The index metadata was compared with the original PDF source headers in selected pages including 961–968 and 1091. **This batch is currently rendered and metadata-screened; it is NOT a claim that all 200 full-resolution source pages have received individual visual sign-off.** The two CSV files `pages961-1060_screening.csv` and `pages1061-1160_screening.csv` explicitly preserve that status.

| Range | AIRPORT | STAR | SID | APP | Pages |
|---|---:|---:|---:|---:|---:|
| 961–1060 | 36 | 12 | 12 | 40 | 100 |
| 1061–1160 | 18 | 21 | 24 | 37 | 100 |
| **Total** | **54** | **33** | **36** | **77** | **200** |

Count source: 200 source-page identities in the existing V2621 app index. One airport-ownership error is documented below, but category counts do not change.

## Independently confirmed error
- **Source PDF page 1091:** printed ICAO `LTAC/ESB` (Esenboga Intl, Ankara) and printed plate **`10-2L`**, a STAR entitled **BAKIR 1N, HALIL 1M, HALIL 1N, HAY 1M, HAY 1N, TELVO 1N** (RWYS 21C/R). The existing app wrongly assigns the page to airport `LTAE`, with one-page `LTAE.pdf`. This is not merely a title issue: **reassign global page 1091 to LTAC**, remove the spurious LTAE airport bundle (unless another valid LTAE source plate is separately identified), rebuild LTAC airport PDF, recompute all affected *airport-local* `pdf_page` indices, manifest global_pages arrays and SHA256 checksums. Global page number and georeference source geometry remain fixed.
- **Pages 962–964 OIZS:** the current index shows generic `APPROACH 16-1`, `APPROACH 16-2`, `APPROACH 16-3`. Printed titles are, respectively `CIRCLING NDB DME (CAT A, B & C)`, `CIRCLING NDB 2 (CAT C)`, and `CIRCLING NDB 1 (CAT A & B)`. Preserve distinct procedures; source-checked metadata overrides prepared.

## Generated print-header removal
The complete original 1654-page user PDF has been transformed with true text redaction of the generated `Printed from JeppView ...` / `Printed on ...` line only. **The MediaBox, CropBox, Rect, and rotation match the original for all 1654 pages**, and the printed date overlay is no longer extractable on any page. No page cropping or rescaling was used. Local verified derivative: `JEPPIRAN_V2621_NO_PRINT_DATE.pdf` SHA256 `46b7f5107b2fbd44f23496c433ab1873f77abf49a56bb9d798064455834c58b6`. Sample image diffs on pages 1,30,961,980,1000,1060,1160,1654 show changes only in the print-text strip (top 30 PDF points). The original remains unchanged for provenance and georef fingerprint verification.

## Georeferencing
No independently validated new chart georeference was produced or approved in pages 961–1160. Existing georeferences must be verified against the source and never silently recalibrated from a NOT TO SCALE figure. Print-header-only derivative retains identical image geometry; this statement is **not itself a georeference accuracy certification**.

## Integration status
**Do not conflate an audit GitHub commit with a live web / Android publication.** A separate controlled repackaging of per-airport PDFs, corrections, manifest SHA and release URLs, followed by verified GitHub Pages deployment and Android APK build is required. No simulator bridge, `main`, or production georeference data was changed by these audit commits.

Next complete outstanding item: full individual 200-DPI visual QA for the not-yet-independently-inspected pages. Subsequent new PDF batch: 1161–1360. NOT FOR ACTUAL NAVIGATION.
