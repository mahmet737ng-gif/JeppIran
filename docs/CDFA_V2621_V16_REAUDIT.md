# JEPPIRAN V2621 / CDFA second-pass QA

**Engineering QA only; these are NOT flight-approved procedures.**

- Previously withheld: **42**
- Newly modelled for QA: **26**
- Still withheld: **16**
- Overall v16: **148/164 modelled for QA, 16/164 withheld**. This does **not** imply that 148 navigation profiles are approved.

## Basis of re-audit

Manually inspected the original `Iran2621.pdf` page for each of the 42 records. Procedural reference in the chart header (NDB/VOR) is distinct from the source of numeric DME readings. NDB does not generate DME. Supporting DME is identified from the map, with frequency and ident. Missing runway threshold elevation can use airport elevation with QA provenance. Genuine negative elevations below mean sea level must not be parsed as missing. Angle and minima are read from the source profile.

Any 10 NM extension outside the published VDA segment is a geometric visualization only; it is not a chart-published clearance. DME offsets are interpreted from the chart or fitted to published minimum altitudes, NOT independently surveyed. Chart-published mandatory restrictions must not be smoothed by a single geometric slope.

## Newly promoted QA models (26)

| PDF page | ICAO | Approach | Procedure | DME | VDP (computed) |
|---:|---|---|---|---|---|
| 75 | OIBB | VOR DME 2 Rwy 13L | VOR BUZ | BUZ | D2.4 |
| 78 | OIBB | VOR DME 1 Rwy 31L | VOR BUZ | BUZ | D3.4 |
| 202 | OICC | NDB Rwy 29L | NDB KMS | KMS | D2.0 |
| 243 | OIFE | NDB Z Rwy 25 | NDB HSA | HSA | D1.8 |
| 280 | OIFM | NDB DME 2 & 4 Rwy 07L | NDB IFN | ISN | D0.8 |
| 281 | OIFM | NDB DME 1 & 3 Rwy 07R | NDB IFN | ISN | D0.8 |
| 330 | OIGG | VOR Z Rwy 27 | VOR RST | RST | D1.6 |
| 346 | OIHH | NDB DME Rwy 10 | NDB HAM | HAM | D1.8 |
| 481 | OIIP | NDB Rwy 12 | NDB PIM | PIM | D2.7 |
| 482 | OIIP | NDB Z Rwy 30 | NDB PIM | PIM | D0.5 |
| 527 | OIKQ | NDB Z Rwy 05 | NDB KHM | KHM | D4.0 |
| 530 | OIKQ | NDB Z Rwy 23 | NDB KHM | KHM | D1.9 |
| 540 | OIKR | NDB DME Rwy 11 | NDB RAF | RAF | D2.0 |
| 684 | OINR | NDB Z Rwy 31 | NDB RSR | RSR | D4.6 |
| 695 | OINZ | VOR Rwy 16 | VOR DNZ | DNZ | D1.7 |
| 708 | OISL | NDB Rwy 09 | NDB LAR | LAR | D4.4 |
| 803 | OITL | NDB Rwy 15 | NDB ARB | ARB | D3.0 |
| 804 | OITL | NDB Rwy 33 | NDB ARB | ARB | D1.4 |
| 943 | OIZH | VOR Z Rwy 35L | VOR ZDN | ZDN | D3.8 |
| 944 | OIZH | VOR Y Rwy 35L | VOR ZDN | ZDN | D3.8 |
| 955 | OIZI | NDB DME Rwy 17 | NDB ISR | ISR | D2.2 |
| 956 | OIZI | NDB DME Rwy 35 | NDB ISR | ISR | D2.1 |
| 1153 | LTAC | VOR Z Rwy 03R | VOR NBG | NBG | D4.5 |
| 1154 | LTAC | VOR Z Rwy 21L | VOR NBG | NBG | D1.4 |
| 1160 | LTAC | NDB Z Rwy 03L | NDB ANK | ESB | D4.4 |
| 1161 | LTAC | NDB Z Rwy 03C | NDB ANK | ESB | D4.5 |

## Still withheld (16)

| PDF page | ICAO | Approach | Specific remaining problem |
|---:|---|---|---|
| 328 | OIGG | VOR Z Rwy 09 | RST VOR/DME 112.6; RWY09 elevation -51 ft, airport -37 ft (below sea level), TCH50; D10 1300 mandatory CAT C/D; need category-specific piecewise model. |
| 438 | OIII | VOR Rwy 11R | TRN VOR/DME 115.3; chart explicitly says TCH displaced threshold 50 ft, RWY 3934 ft. D8 6700 from header requires final-segment/control-fix reconciliation. |
| 541 | OIKR | NDB DME Rwy 29 | RAF NDB 260 kHz is procedure reference; RAF DME 112.3 MHz gives D readings. Chart D10 7800 mandatory for applicable category and final 3.04 deg cannot be extended blindly. |
| 663 | OING | VOR Z Rwy 13 | GGN VOR/DME117.6, RWY13 -59 ft, airport -28 ft. D7 2300 and D15 5000 exceed single final-angle projection with map-indicated source geometry. |
| 664 | OING | VOR Y Rwy 13 | GGN VOR/DME117.6, RWY13 -59 ft, airport -28 ft; CAT C/D arrival distinct. Need verify chart DME-offset and published stepdown geometry, not a single 3.03deg extension. |
| 665 | OING | VOR X Rwy 13 | GGN VOR/DME117.6, RWY13 -59 ft, airport -28 ft; D5 1600, D15 5000 cannot be authorized by a one-slope extension without verifying station placement and constraints. |
| 682 | OINR | NDB Z Rwy 30 | RSR NDB332 and RSR VOR/DME115.5 separate. Airport elevation -66 ft recovered. Do not invent TCH 50 where chart does not specify a defensible value. |
| 683 | OINR | NDB Y Rwy 30 | RSR NDB332 and RSR VOR/DME115.5 separate. Airport elevation -66 ft recovered; TCH still unresolved. |
| 716 | OISR | NDB DME 1 Rwy 29 | LAM NDB346 is procedure reference and LAM VOR/DME117.0 gives numeric DME; TCH of this chart still not established. A missing angle could use user default 3deg only AFTER TCH is known. |
| 991 | ORBI | VOR DME Rwy 15L | BGD VOR/DME112.9; KISPE D5.4 at 2100 ft and FIDIX 3600 / intervening altitude constraints. Need segment geometry before computing threshold-based CDFA. |
| 992 | ORBI | VOR DME Rwy 33R | BGD VOR/DME112.9; VINNU D8.7 at 2100 ft, HIBUT D3.5 and SEBIE D15 intermediate constraints; station offset not verified. |
| 1019 | ORMM | VOR DME Rwy 14 | BSR VOR/DME112.3; CEPKI D8.7 at 1900 ft, ZEGIP D3.3; two separate final-altitude portions need reconciliation. |
| 1020 | ORMM | VOR DME Rwy 32 | BSR VOR/DME112.3; CEPOK D5 at 1800 ft, other constraints and 2.83deg published descent; no independent station-to-threshold offset. |
| 1034 | ORSJ | VOR Rwy 13 | SUL VOR/DME117.0; final start FS13 6500 ft is published with distance-to-threshold information, not a verified numeric SUL DME anchor; geometry needs conversion. |
| 1035 | ORSJ | VOR Rwy 31 | SUL VOR/DME117.0; final start FS31 6500 ft and MAP D3.5; require distance-to-threshold versus DME separation. |
| 1155 | LTAC | VOR Z or NDB Z Rwy 21C | Dual VOR Z / NDB Z RWY21C: BUK VOR114.3 + BUK NDB425. DME reverses around station near runway; simple one-branch signed offset is not adequate. |

## Rebuild / validation

```shell
node scripts/recheck_cdfa_42_v16.cjs
python3 scripts/annotate_cdfa_16_v16.py
node --test tests/cdfa-v16-remaining42.test.cjs
```

Source QA records: `web/data/cdfa-v2621-v16-qa.json`; review metadata: `web/data/cdfa-v2621-v16-remaining42-audit.json`.
Existing geometry engine `web/cdfa-engine.js` v1.5 is unchanged; this release corrects the chart inputs and batch QA record. Existing app UI, bridge connections, georeferencing and locked backgrounds remain unchanged.