# OTHH Hamad Intl — Jeppesen V2621 ADC 20-9 source PDF p1536

**SOURCE-EXCLUSIVE INDEPENDENT QA (NOT RELEASE APPROVED).**

- Jeppesen source original V2621 `Iran2621.pdf` SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.
- Official **Qatar Civil Aviation Authority AIM** eAIP [OTHH AD 2.12](https://aim.gov.qa/AIP/11-JUN-2026/AIP-29/2026-08-06-000000/html/eAIP/QA-AD-2-OTHH-mobile-en-GB.html), edition effective **06 Aug 2026**. Subsequent AIRAC amendment compatibility with Jepp V2621 (Oct 2026) requires final confirmation.
- **No third-party coordinate providers or imagery.**
- Printed Jeppesen main-chart graticule ticks (from PDF vector geometry): N25-15 and N25-16 at PDF y734.16 and y512.40; E51-36 and E51-37 at x183.96 and x385.68. Four grid intersections were fit in WGS84-geodesic local east/north coordinates.
- Two actual Jeppesen runway outlines are **filled black four-segment PDF vector polygons**. The mean of the *short-end pair* of physical vertices was measured as the printed threshold center, not the runway label position.
- **All four official AIP runway thresholds were held out** of the chart-grid fit and compared against the measured Jeppesen centerline end points.

| Official runway threshold | AIP WGS84 (DMS) | Jeppesen symbol PDF x,y | Independent 2D residual |
|---|---|---|---:|
| **RWY 16L** | 251745.97N 0513631.96E | (291.36,120.54) | **1.685 m** |
| **RWY 34R** | 251519.65N 0513736.41E | (508.14,661.68) | **1.371 m** |
| **RWY 16R** | 251727.52N 0513523.07E | (59.76,188.82) | **1.145 m** |
| **RWY 34L** | 251519.32N 0513619.56E | (249.78,662.88) | **1.147 m** |

**Maximum independent source-only error: 1.685 m**, below the requested maximum 10m threshold. Grid self-fit residual: 0.006884 PDF points (distinct from the official threshold holdout errors).

### Release holds

Provisional numerical success alone is not approval to update production `chart-georef.json`: the original chart's large-scale extent and any differently scaled inset/map region need clipping QA, the 2026 October AIP effective version must be reconciled, and Android/Web aircraft indicator placement should pass a real test. Do not infer a DME range from the measured runway endpoints; this check did not use DME.

Structured source point table and audit-only JSON are available as locally generated output `/mnt/data/aip_jepp_audit/OTHH_1536_AIP_JEPP_OFFICIAL_RUNWAY_CHECK.csv` and `OTHH_1536_AIP_JEPP_GEOREF_PROVISIONAL.json`.

**NOT FOR ACTUAL NAVIGATION.**
