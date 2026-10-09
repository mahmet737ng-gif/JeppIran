# V2621 ADC: independent-coordinate screening re-scored at 10 metres

**Source:** original 1654-page `2621(2).pdf`, SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`. All 24 existing ADC reviews were re-scored. **No changes to app/main, georef or bridges.**

**Meaning of threshold:** for a chart with both geographic axes checked at runway points, compute the Euclidean 2D offset `sqrt(E_error_m²+N_error_m²)`. Require the **maximum** observed offset to be <= 10.0 m, not the RMS. For single-axis checks, passing that axis does *not* qualify the chart's 2D mapping.

| Category | Count |
|---|---:|
| Provisional 2D screen within 10m using third-party runway thresholds | **2** |
| Partial 1D screen within 10m, cannot validate 2D | **2** |
| Exceeds 10m in available external checks | **3** |
| Lacks external geographic runway control observations | **17** |
| Newly approved or deployed source-verified georeferences | **0** |

## Observations by original PDF page

| PDF page | ICAO | Maximum measured offset | Test coverage | 10m verdict |
|---:|---|---:|---|---|
| 264 | OIFM | **5.41 m** | 4 runway thresholds, 2D | provisional pass, NOT release approved |
| 1001 | ORER | **3.73 m** | 2 runway thresholds, 2D | provisional pass, NOT release approved |
| 118 | OIBL | 0.8 m | one geographic axis only | partial, 2D status unknown |
| 651 | OINE | 1.3 m | one geographic axis only | partial, 2D status unknown; indexed under wrong OING |
| 342 | OIHH | 541.9 m | one geographic axis only | fail under 10m |
| 561 | OIMB | 1063.23 m | four thresholds, 2D | fail under 10m; external runway data disagree |
| 961 | OIZS | 468.1 m | one geographic axis only | fail under 10m |
 
The other **17 ADCs** do not have an available comparable geodetic runway-point screen. They may have source tick/vector fits, but that **does not establish a <=10m real positional error**.

### Source quality and safety gates

These observations are from **third-party coordinate services**, not independently checked against official **AIP** for V2621. In two single-axis cases the outside runway thresholds are part of constructing the missing axis, so a tick-based self-check (OIBL ~0.8m; OINE ~5.3m) is not an independent held-out WGS84 check. Differences in runway lengths and ARP positions from the printed charts are substantial for OIHH, OIMB and OIZS. Page 651 is printed OINE but indexed as OING; page 808 is printed OITM but indexed as OITT. Inset calibration/masking and actual app-marker acceptance tests remain.

The application georeference file must **not** be changed based on these provisional outcomes. A final 10m pass requires valid same-cycle official source coordinates, measured points **not** used to fit the transform, correct geometry and masks, plus a verified Android/PWA marker test. Never use NOT TO SCALE insets for deriving positions.

**No new georeference is approved for actual navigation.**
