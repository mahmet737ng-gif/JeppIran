# JEPPIRAN V2621 — Visual-screening audit for original PDF pages 461–560

Source: `2621(2).pdf` (1654 pages); SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`. 

All 100 pages rendered separately at 200 DPI and visually inspected in 25 four-up sheets with source PDF metadata cross-check. Pages **461, 483, 503, 553** additionally inspected individually at native 200-DPI image size. **The other 96 pages remain pending individual native-size proofreading**; no false full-resolution approval is asserted.

## Visual-screening category counts

| Category | Pages |
| --- | ---: |
| AIRPORT | 23 |
| STAR | 20 |
| SID | 21 |
| APP | 36 |
| **Total** | **100** |

Airport ownership (PDF pages): OIKB 461–469 (9), OIIP 470–484 (15), OIKJ 485–491 (7), OIKK 492–508 (17), OIKM 509–519 (11), OIKQ 520–532 (13), OIKR 533–542 (10), OIKY 543–552 (10), OIMB 553–560 (8).

## Visually supported findings

- **Page 461 OIKB**: exact printed plate **10-9S1**, not 10-9S; AIRPORT MINIMUMS continuation from page 460 (distinct, must retain).
- **Pages 462 / 463**: regular ILS RWY 21L vs NDB ILS RWY 21L, different procedures.
- **Pages 482–484 OIIP**: NDB Z RWY30, NDB Y RWY30 (CAT A/B), NDB X RWY30 (CAT C/D) are not duplicates.
- **Pages 490/491 OIKJ**: NDB RWY31 CAT C vs NDB A CAT A/B.
- **Pages 518/519 OIKM**: NDB Z and Y RWY30 with CAT A/B vs CAT C/D; **pages 528/529 and 531/532 OIKQ** similarly contain distinct Z/Y/X and aircraft categories.
- Airport-information pages OIKK 492–493 and OIMB 553–554 are continuation pages, not duplicates.
- MINIMUMS pages 479, 504, 515, 539, 549, and continuation page 461 belong to AIRPORT, not APP.
- Printed source header 'Printed from JeppView ...' is not part of displayed chart title.
- ADC pages 478, 488, 503, 514, 526, 538, 548 contain printed geographic graduations; **page 503 has a separate apron inset** which cannot share a map transform without independent control.

## Georeferencing decision
- 36 APP plates and 7 ADC plates are potential eligibility / quality-control cases; this is NOT a claim all lack earlier georeferences.
- Prior georeferencing coverage in `docs/georeferencing/COVERAGE.md` explicitly relates to 2620 with a **different source SHA**. Do not import any control points based only on plate name without content identity and independent geometric verification.
- No independent map fit, held-out control validation, axis/scale/orientation accuracy check, or bounded-overlay validation was completed in this screening. **New approved georeferences: 0. Rejected after quantified independent test: 0. Legacy status: unresolved pending provenance check.**
- No production assets, `main`, APK/PWA, FSX, X-Plane or other simulator integrations changed.

See `pages0461-0560_screening.csv` for 100 separate tracking rows. The local user-facing evidence archive includes all 100 images at 200 DPI and 25 contact sheets.

**Next:** complete native-size checks on remaining 96 pages of this batch, then audit pages 561–660. This report is an audit of chart metadata, not navigation approval.
