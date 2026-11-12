# V2621 • Detailed 200-DPI visual check • PDF pages 33–100

Source: `Iran2621.pdf`, SHA-256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.

**Review status:** All 68 original source pages (33 through 100, inclusive) opened as high-resolution images, checked visually for airport, Jeppesen plate number, STAR/SID/AIRPORT/APP category, procedure title, and possible misleading duplicate labels. Nothing was deployed to the app.

| ICAO | Pages | AIRPORT | STAR | SID | APP |
| --- | --- | ---: | ---: | ---: | ---: |
| OIAW | 33–51 | 3 | 0 | 5 | 11 |
| OIBA | 52–62 | 2 | 1 | 1 | 7 |
| OIBB | 63–84 | 5 | 2 | 4 | 11 |
| OIBK | 85–100 | 9 | 1 | 3 | 3 |
| **Total** | **68** | **19** | **4** | **13** | **32** |

## Recommended title fixes (16; source headings read visually)

- OIBA 16-2, source page 57: `NDB Y RWY 08 (CAT C)`.
- OIBA 16-3, page 58: `NDB X RWY 08 (CAT A & B)`.
- OIBA 16-5, page 60: `NDB Y RWY 26 (CAT C)`.
- OIBA 16-6, page 61: `NDB X RWY 26 (CAT C)`.
- OIBA 16-7, page 62: `NDB A (CAT A & B)`.
- OIBB 13-1, page 75: `VOR DME 2 RWY 13L/R`.
- OIBB 13-2, page 76: `VOR RWY 13L/R (CAT C & D)`.
- OIBB 13-3, page 77: `VOR RWY 13L/R (CAT A & B)`.
- OIBB 13-4, page 78: `VOR DME 1 RWY 31L/R`.
- OIBB 13-5, page 79: `VOR RWY 31L/R (CAT C & D)`.
- OIBB 13-6, page 80: `VOR RWY 31L/R (CAT A & B)`.
- OIBB 16-1, page 81: `NDB RWY 13L/R (CAT C & D)`.
- OIBB 16-2, page 82: `NDB RWY 13L/R (CAT A & B)`.
- OIBB 16-3, page 83: `NDB RWY 31L/R (CAT C & D)`.
- OIBB 16-4, page 84: `NDB RWY 31L/R (CAT A & B)`.
- OIBK 10-4, page 94: `NOISE ABATEMENT` (old title incorrectly included the printed date, airport label, and plate number).

**Categories:** No incorrect category detected in these 68 pages; labels and existing foldering can be retained.

**Do not drop distinct pages:** OIBA 52; OIBB 63–64; OIBK 85–86 are airport information pages with no Jeppesen plate number. Pages 39–40, 72–73, 97 are separate MINIMUMS plates. Pages 87–89 are Airport Briefing continuation plates. Procedure pairs with different aircraft categories must NOT be collapsed.

## Georeferencing

- Existing moving-map references in the source chart bundle remain untouched.
- OIBB page **71** is an uncalibrated Airport Diagram with printed main-frame latitude/longitude graticules and a separate lower-left detailed inset.
- A **nine-control-point experimental** source-vector calibration was measured: longitude 50°49′–50°51′E, latitude 28°56′–28°58′N. Frame clipping excludes the inset. Printed BUZ VOR coordinate from nearby STAR/SID is N28°57.1′ E050°49.6′; the candidate predicts source PDF position x=224.712, y=212.868.
- The generic automated extractor failed on this page because inset labels contaminate the fit (38.648 PDF-point residual); that output must **not** be published. The isolated main-graticule candidate likewise remains **NOT APPROVED FOR RELEASE** until independent symbol checks and on-device tracking pass.
- No new georeference is published; no changes to source PDFs, chart index, or FSX.

The print-origin header (`Printed from JeppView ...`) remains visible on the PDF source and is a separate outstanding task.

Files: `pages0033-0100.csv` in this folder; full-resolution page images were uploaded to GitHub Actions artifacts in workflow run 37882496891.

Next page: **101**.
