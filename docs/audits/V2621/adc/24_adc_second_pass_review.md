# V2621 ADC full-source visual/vector review — robust second pass

**Scope:** 24 ADC pages classified as missing a matching georeference during the read-only 9 October 2026 current-cycle census. User-authorized investigation only; no production georeference, simulator, web or Android changes.

Original source PDF: 1654 pages; SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.

## Verified facts

- All 24 pages were individually rendered to 200 DPI and visually screened using six high-resolution contact sheets; several ambiguous source pages were additionally opened at full image size. The screenshot overview is **not** a claim of complete individual native-size visual approval.
- Two **chart-owner errors** in the main index: original PDF **651 = OINE/KLM Kalaleh** (indexed OING), **808 = OITM/ACP Sahand** (indexed OITT). The original print headers, not map annotations, are authoritative. Both still lack confirmed active source-page georeferences. Fixing the owner later requires correcting chart groups and local PDF page mappings.
- Original strict source-vector pipeline produced two possible measured-grid fits: **1536 OTHH** (8 grid intersections, 0.072028 PDF-point residual) and **1623 OPIS** (8 intersections, 0.072012 PDF-point residual). Neither has a completed independent geodetic ground-control/field-validation acceptance check.
- Alternative source-PDF control-tick matching, robust rejection of edge/inset outlier ticks and geographic scale plausibility produced **17 more map-grid preliminary candidates**. **Page 622 OIMN** required manually selecting the source's actual `37-30` right-frame grid vector at PDF y=189.72 rather than its nearby y=203.88 minor tick. Together: **20 preliminary fitted candidates, zero approved for release**.
- Four pages have just one directly measured latitude axis in the main map and require additional independent ground control before deriving a second axis: **118 OIBL, 342 OIHH, 651 OINE, 961 OIZS**.
- Eight source plates show separate apron/inset frames that need explicit clipping or independent scale treatment: pages **71, 211, 221, 342, 622, 651, 794 and 1388**. No inset mask has been independently accepted.
- **OMDW page 1472**: source note states ARP is 1.5 NM from the RWY 12/30 center; projecting that printed ARP outside the displayed runway map is **not** by itself evidence of a bad scale fit. This rotated plan must be controlled via other surveyed features.
- Header ARP-to-nearest printed ARP-label distances provide only coarse visualization sanity checks (text location is **not** a survey point). A small grid fit residual likewise does **not** prove independently accurate WGS84 registration.
- No sampled chart contains a positively identified `NOT TO SCALE` instruction governing its *main* ADC map in the extracted text, but mixed-scale inset drawings and inaccurate labeling remain risks.

## Status groups

| Status | PDF source pages | Count |
|---|---|---:|
| Grid-measured **candidate only**, not released | 71, 131, 211, 221, 264, 299, 561, 622, 714, 751, 794, 808, 859, 1001, 1368, 1388, 1472, 1536, 1580, 1623 | 20 |
| Needs second independent coordinate axis/control | 118, 342, 651, 961 | 4 |
| Wrong airport ICAO in current index (overlaps statuses above) | 651, 808 | 2 |
| New app-approved georeferences | **none** | **0** |

**Next gate:** individual full-size confirmation of vector tick intersections, inset masking, independent geodetic check-point fit/holdout and Android/PWA actual marker placement. Do not publish or append any candidate to `app/src/main/assets/chart-georef.json` until those gates are passed.

Evidence and intermediate full control points are held in the local audit archive `JEPPIRAN_V2621_ADC_24_200DPI_AUDIT_EVIDENCE.zip`. Automated strict primary-method evidence is in `docs/audits/V2621/adc/24_adc_review.json`; the earlier report showing just 2 success is not a contradiction: the second-pass extractor implements a different outlier rejection and visual tick cross-check method, and all fits remain unapproved.

**NOT FOR ACTUAL NAVIGATION.**
