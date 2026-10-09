# V2621 OIBL (118) and OIHH (342): official AIP GCP calibration at 10 m QA threshold

**Audit only. No application georeference, main branch, simulator bridge, or PDF was changed. Not approved for actual navigation.**

Source JEPPIRAN V2621 PDF original pages 118 and 342 (612x792 PDF points); source SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.

Source geographic coordinates were taken from official Iran AIM AIP AD 2.2 (ARP), 2.12 (physical runway thresholds), 2.19 (radio-navigation transmitters):
- [OIBL AD2](https://ais.airport.ir/documents/452631/186839484/OIBL.pdf)
- [OIHH AD2](https://ais.airport.ir/documents/452631/186839535/OIHH.pdf)

Source PDF symbols were measured from vector path centers or runway polygon end faces (not the center of nearby text). PDF points were transformed using a least-squares affine fit to WGS84 local Azimuthal Equidistant East/North coordinates. Two supplementary pseudo-intersections were constructed from actual printed latitude and longitude edge ticks; these are map-local controls, NOT independently surveyed ground points. 10m screen compares 2D residual norm; each official AIP control was separately withheld and predicted using all other AIP controls and map ticks (LOOCV).

| Metric | OIBL, page 118 | OIHH, page 342 |
|---|---:|---:|
| Official AIP controls | 4 (THR08, THR26, NDB LEN, ARP) | 5 (physical RWY10, THR28, NDB HAM, VOR/DME HAM, ARP) |
| Printed chart grid pseudo-crossings | 2 | 2 |
| In-fit RMS 2D residual | **1.601 m** | **1.074 m** |
| Worst AIP leave-one-out 2D prediction residual | **5.745 m** (THR08) | **3.062 m** (NDB HAM) |
| Worst AIP-only LOOCV (without printed ticks) | 8.462 m | 3.419 m |
| Extra independent displaced RWY10 threshold (AIP) | n/a | **1.795 m**, excluded from fitting |
| Largest printed tick difference versus AIP-only model | 5.904 m | 2.380 m |
| WGS84 distance physical threshold-to-threshold | 2500.29 m (plate 2500 m) | 3799.23 m (plate 3799 m) |
| Provisional result against numeric threshold | PASS | PASS |
| Approved for public aircraft tracking/nav use | **NO** | **NO** |

Individual AIP-point LOOCV errors in metres:
- OIBL: THR08 5.745; THR26 5.245; NDB LEN 1.865; ARP 1.391.
- OIHH: RWY10 physical 0.702; THR28 2.446; NDB HAM 3.062; VOR/DME HAM 1.037; ARP 1.688.
- OIHH displaced landing threshold RWY10 from AIP `345213.36N 0483232.75E`, source white threshold bar center PDF `(147.72,228.72)`: independent 1.795 m check. Do not confuse with the physical RWY10 end.

**Important limitations:** The official AIP ARP values are given to whole arcseconds (quantisation alone can exceed 10 metres); finite-width chart symbols, exact AIP chart revision, map inset masks and live GPS marker alignment were not independently tested. These observed 10m passes therefore do not establish a guaranteed <10m physical geolocation error everywhere on an aerodrome. Older non-AIP Hamadan runway data reporting 3234.2m conflict with AIP and source plate 3799m; exclude the former. The OIBL VOR/DME LEN coordinate is available officially but falls outside the original Jepp ADC frame, so no fake PDF pixel was assigned.

The complete audit-only machine-readable affine transforms, all official point lat/lon, source PDF point positions and residuals, annotated QA PNGs and Persian report are available in the user's working-container artifact bundle `JEPPIRAN_OIBL_OIHH_AIP_10M_AUDIT_ONLY.zip`. No production chart-georef.json additions were published. 
