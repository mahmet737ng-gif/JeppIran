# V2621 visual audit — original source pages 101–200

**Source:** `Iran2621.pdf`, SHA-256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`

Review 100 original source PDF page images in **200 DPI**, via 25 four-page contact sheets, with additional individual 200-DPI examination for ambiguous printed titles. A separate CSV enumerates every page and the proposed changes.

| ICAO | Original PDF pages | AIRPORT | STAR | SID | APP |
| --- | --- | ---: | ---: | ---: | ---: |
| OIBK | 101–107 | 0 | 0 | 0 | 7 |
| OIBL | 108–125 | 3 | 5 | 4 | 6 |
| OIBP | 126–140 | 2 | 2 | 2 | 9 |
| OIBQ | 141–163 | 2 | 4 | 4 | 13 |
| OIBS | 164–172 | 2 | 2 | 2 | 3 |
| OIBV | 173–178 | 2 | 1 | 1 | 2 |
| OICC | 179–200 | 5 | 6 | 8 | 3 |
| **TOTAL** | **100 pages** | **16** | **20** | **21** | **43** |

## Critical problems found

1. **PDF source pages 198, 199, 200 — Kermanshah OICC.** The actual plates are **ILS Z or LOC Z RWY 29L (11-1)**, **ILS Y or LOC Y RWY 29L (11-2)**, and **VOR RWY 29L (13-1)**, all in **APP**. Android APK **5.5** instead lists them as `AIRPORT / ADC 10-9`. Its 776-reference georeferencing JSON contains the same false chart identities for all three. They need title/category/plate correction AND separate validation of source fingerprint, ground-control calibration, and runtime treatment. **Do not auto-copy or publish these georeferences as validated solely because the page numbers match.**
2. **PDF pages 136–138, OIBP:** printed titles **VOR A**, **VOR B**, **VOR C**, not generic `CHART PAGE 107/108/109`.
3. **PDF page 125, OIBL:** **CAT A & B CIRCLING NDB**, not a normal unnamed `APPROACH 16-3`.
4. **PDF pages 153–159, OIBQ:** the VOR DME 1/2, CAT A/B/C variants and CIRCLING procedures require distinct chart names; separate plate numbers **13-3 through 13-9** must not be collapsed.
5. Other CAT qualifiers on several NDB/VOR approaches were read from minima/printed qualifiers; proposed labels are intentionally more descriptive than some printed headings, and should not be confused with literal heading transcription.
6. **PDF page 119 OIBL, 197 OICC** are minimums pages in AIRPORT. Airport Information pages are retained without fabricated Jeppesen chart numbers.

## Georeference validation, no fabricated coordinates

The actually built Android **5.5.apk** contains **776** existing references, **60 of them in pages 101–200** (although three have the wrong chart identity).

Two uncalibrated Airport Diagrams were tested using the printed PDF source against the existing conservative grid/vector method:
- **OIBL page 118**: rejected; conformal scale extrapolated outside the measured plan.
- **OIBP page 131**: rejected; affine residual **4.681 PDF points**.

No new georeference is ready to add. Do not override this with an estimated airport location or a `NOT TO SCALE` drawing.

## Publication status

**Review-only branch. No edit to main, Android/IPA/PWA, PDF bytes, existing chart metadata, or FSX/other simulator connection.** The original JeppView print header is still present.

Full-resolution 200-DPI page evidence was generated for all pages 101–200; an earlier GitHub Actions evidence artifact also contains pages 1–400. Local companion exports include the original 100 JPEGs, 25 contact sheets, Excel, JSON and the page-by-page CSV.

This is not validated for real-world navigation.
