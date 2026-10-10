# JEPPIRAN V2621 — uncovered approach georeference queue (official AIP + original Jeppesen only)

Repo baseline: `835030896b59e664251a84e2b1afd8a8c0d52794` · PDF 1654 pages, SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.

* Approach charts in app index: **504**.
* Production georeference records: **397** approach charts.
* Additional source-only experimental models, no independent official AIP acceptance yet: **9** approach charts.
* Remaining **98** charts with no model in either set, listed in CSV/JSON.
* Newly created independently validated georeferences in this batch: **0**. No official AIP independent <10m checks possible this run.

## Batch 01 (10 charts, printed Jeppesen reference labels only)

| Global PDF page | ICAO | Printed labels | QA |
| --- | --- | --- | --- |
| 212 | OICI | ILM VOR 112.6, R-320, D16.0/D10.7 (chart labels) | HOLD official AD2/AIRAC/mask/slant |
| 213 | OICI | IILM ILS/DME 109.1; D10.7/D6.0/D0.8 (chart labels) | HOLD official AD2/AIRAC/mask/slant |
| 214 | OICI | ILM VOR 112.6; R130, R-320; D16.0/D18.0 (chart labels) | HOLD official AD2/AIRAC/mask/slant |
| 223 | OICK | KRD NDB 350; IKRD LOC 110.5; D0.6/D3.7/D11.0 (chart labels) | HOLD official AD2/AIRAC/mask/slant |
| 268 | OIFM | IIFN ILS/DME 109.9; R-348, D7.0/D15.0 (chart labels) | HOLD official AD2/AIRAC/mask/slant |
| 271 | OIFM | ISN VOR 113.2; D9.0/D3.0/D15.0 (chart labels) | HOLD official AD2/AIRAC/mask/slant |
| 275 | OIFM | ISN VOR 113.2; D9.0/D4.0/D1.0/D15.0 (chart labels) | HOLD official AD2/AIRAC/mask/slant |
| 276 | OIFM | ISN VOR 113.2; D15.0/D20.0 (chart labels) | HOLD official AD2/AIRAC/mask/slant |
| 280 | OIFM | IFN NDB/DME; D0.5/D3.0/D8.0/D15.0 (chart labels) | HOLD official AD2/AIRAC/mask/slant |
| 281 | OIFM | IFN NDB/DME; D0.5/D3.0/D8.0/D15.0 (chart labels) | HOLD official AD2/AIRAC/mask/slant |

No coordinate values are inferred from charts' radials and DME until the official AIS/AIM publisher's navaid and runway/fix coordinates can be obtained. **NOT TO SCALE** regions must be excluded from plan-view geometries; magnetic radial must be corrected using publication-defined variation and equipment-specific convention, and DME slant range uses altitude difference, `ground_nm=sqrt(max(0,dme_nm^2-(delta_height_ft/6076.12)^2))`. Independent holdout control points (not used to fit) are required to pass maximum 10 metres error. Neither grid residual nor a single anchor demonstrates independent accuracy. 

Official Iran AIS source attempted: `https://ais.airport.ir/documents/452631/186839505/OICI.pdf`, `https://ais.airport.ir/documents/452631/186839523/OIFM.pdf`. Both inaccessible to available tools at this time. Third-party AIS derivatives, OSM, commercial mapping, and runway databases were NOT used as coordinate evidence.

The user can test the earlier chart models in a simulator. Such a test does not establish certification or independent official geodetic accuracy.
