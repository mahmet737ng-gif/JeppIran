# JEPPIRAN V2621 — full-size visual audit of PDF pages 101–200

Source: `Iran2621.pdf` (SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`).

**100 source PDF pages reviewed visually** using 200-DPI individually numbered source-image files and twenty-five 4-up visual sheets; ambiguous headings received full-resolution header enlargement and text-level cross-checks. This is not an operational aeronautical quality endorsement.

| Airport ICAO | PDF pages | AIRPORT | STAR | SID | APP | Total |
|---|---|---:|---:|---:|---:|---:|
| OIBK (Kish continuation) | 101–107 | 0 | 0 | 0 | 7 | 7 |
| OIBL (Bandar Lengeh) | 108–125 | 3 | 5 | 4 | 6 | 18 |
| OIBP (Persian Gulf) | 126–140 | 2 | 2 | 2 | 9 | 15 |
| OIBQ (Khark) | 141–163 | 2 | 4 | 4 | 13 | 23 |
| OIBS (Sirri) | 164–172 | 2 | 2 | 2 | 3 | 9 |
| OIBV (Lavan) | 173–178 | 2 | 1 | 1 | 2 | 6 |
| OICC (Kermanshah) | 179–200 | 5 | 6 | 8 | 3 | 22 |
| **Total** | **101–200** | **16** | **20** | **21** | **43** | **100** |

## 20 corrected or normalized procedure titles

- OIBL: #110 KHM 1N / KHM 1P (printed order); #112 NABEX 2N/2P/2Q (printed order); **#125 CIRCLING NDB (CAT A & B)**, not generic APPROACH 16-3.
- OIBP: #132 ILS Z RWY 31; #133 ILS Y RWY 31; #136 VOR A; #137 VOR B; #138 VOR C. Source titles of #132/#133 do *not* print 'OR LOC'.
- OIBQ: #151 VOR RWY 13 (CAT C); #153 VOR DME 1 RWY 31 (CAT A, B & C); #154 VOR DME 2 RWY 31 (CAT C); #155 VOR DME 2 RWY 31 (CAT A & B); #156 VOR RWY 31 (CAT C); #158 CIRCLING VOR DME 1 (CAT A, B & C); #159 CIRCLING VOR DME 2 (CAT A, B & C); #160 NDB RWY 13 (CAT C); #162 NDB RWY 31 (CAT C).
- **OICC critical #198/#199/#200: these are APP, not AIRPORT charts.** Source plates **11-1, 11-2, 13-1**, respectively; titles ILS Z OR LOC Z RWY 29L, ILS Y OR LOC Y RWY 29L, VOR RWY 29L. Current production data instead assigns all three to 10-9 Airport Diagram Chart. This requires a matching rebinding of source-page georeference `chartKey` and a regression test before release, not just a cosmetic rename.

Leave OICC #195 (10-9 ADC), #196 (10-9A INS COORDINATES), and #197 (10-9S MINIMUMS) under AIRPORT. Retain both OICC airport-information pages 179/180.

## Georeferencing safety

The original V2621 georeference asset has **60 existing georeference records in pages 101–200**. After the separately published V5.5 corrections, their presence in this interval is unchanged. This audit adds **zero unverified georeferences**.

Limited fail-closed source-georef extraction trial: 11 selected pages, 4 auto-candidates (150/176/181/193) **already present** in the source asset, and no novel acceptable calibration. The extractor rejected page 131 (OIBP ADC) with **4.681 PDF-point affine residual**. Pages 118, 127, 187, 189, and 191 also need independent control points or cannot pass scale checks. Never force overlays on these pages.

A category/plate correction in current data on #198/#199/#200 requires validating the existing moving-map record and `chartKey` before publishing.

## Deployment status

- Audit only; **NOT merged into `main`**.
- No APK or live web app changed.
- No simulator connection, including the known working FSX bridge, changed.
- Source PDF retains its original 'Printed from JeppView' header (removal is a separate task).
- Next visual review page is **201**.

Page-level decisions are recorded in `pages0101-0200.csv`.
