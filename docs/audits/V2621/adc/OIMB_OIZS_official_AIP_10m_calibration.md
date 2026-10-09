# ADC Birjand and Saravan (V2621) — Official AIP-based 10m georeferencing review

**NON-NAVIGATION, AUDIT ONLY.** JEPPIRAN V2621 source PDF page 561 OIMB/Birjand and page 961 OIZS/Saravan. Source SHA256: `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.

External AIP controls are **Iran AIM official**:
- OIMB AD 2.2, 2.12, 2.19: https://ais.airport.ir/documents/452631/186839606/OIMB.pdf
- OIZS AD 2.2, 2.12, 2.19: https://ais.airport.ir/documents/452631/186846259/OIZS.pdf

The geographic target coordinates in WGS84 were transformed to a local AEQD EN frame; chart symbols and physical runway edge centre points were identified from the original Jepp PDF vector drawing, not text labels. Least-squares PDF-xy → EN affine fits used the original AIP controls plus crossing positions inferred from verified printed latitude/longitude border ticks. The numeric threshold is a **maximum 2D leave-one-out AIP prediction residual ≤10m**. Grid crossings are from the chart itself, not independently surveyed GCPs.

| Metric | OIMB, p561 | OIZS, p961 |
|---|---:|---:|
| AIP reference points used | 7: ARP, THR08, THR26, THR10, THR28, NDB BRN, VOR/DME BRN | 4: ARP AD2.2, THR13, THR31, NDB/DME SRN |
| Printed grid tick pseudo-intersections | 4 | 2 |
| Hybrid 2D in-fit RMSE (m) | 2.410 | 0.650 |
| **Maximum hybrid AIP leave-one-out residual (m)** | **6.386** | **2.989** |
| Worst AIP-only leave-one-out residual without chart ticks (m) | 6.395 | **14.961 (FAIL 10m)** |
| Additional withheld physical chart point | DTHR08 approx 0.8m | none |
| WGS84 threshold-to-threshold length (m) | RWY08/26 **2177.05**; RWY10/28 **3797.32** | RWY13/31 **3299.17** |
| Numerical status | Provisional pass | Conditional pass when printed ticks are included |
| Approved/deployed georefs | 0 | 0 |

**OIMB:** The older ~1063m discrepancy arose from third-party coordinates and a 2902m runway length inconsistent with official AIP AD2.12 and Jepp. Proper length is 2177m for 08/26 and 3797m for 10/28. Displaced landing threshold of RWY08 is 174m from the physical runway end and must not be conflated with that end. Official AIP NDB is **BRN 405kHz**, VOR/DME **BRN 117.450MHz**; aviation directory records with other frequencies must not replace the AIP values.

**OIZS:** Official AIP AD2.19 specifies **NDB/DME SRN** (300kHz and DME CH88X / 114.100MHz). There is **no independent VOR at Saravan shown in its AIP AD2.19 or original Jepp ADC**, so **no VOR GCP was invented**. AIP **AD2.2** ARP `272507N 0621858E` and **AD2.17** ATZ centre `272430N 0621914E` differ by approximately **1220.7m**; the fit uses AD2.2 ARP and treats the conflict as unresolved for safety review. NDB/DME held-out error without graticule augmentation is **14.961m**, making its hybrid <10m assessment chart-tick-dependent.

**Additional source owner correction:** OICZ is **SAQEZ / سقز**, established by original V2621 PDF p235–237 and Jepp NAV charts; it is not OIZC (Chabahar). Display-name repair is a distinct metadata correction and never changes airport codes or georeference geometry.

**Status:** experimental georeferencing candidates only, **NOT FOR ACTUAL NAVIGATION**. No adjustments to `chart-georef.json`, main map calibration, APK simulator bridges, or live web moving map. Validation of geographic control uncertainty, exact full-frame/inset mask geometry, repeated GPS marker behaviour and release sign-off is still required.

Additional detailed original full-resolution vector proof, PDF XY, geographic WGS84 points, each cross-validation residual, overlays, report and source computation are packaged in the user's local ZIP `JEPPIRAN_OIMB_OIZS_AIP_10M_AUDIT_ONLY.zip`.
