# JEPPIRAN Georeferencing Engine V2 — OICK V2621 QA

The existing source-tick graticule extractor is reused and a new independent-landmark regional solver is added. No chart georeference is changed automatically, no synthetic GCP is installed, and the result is not suitable for actual navigation.

Input: original Git LFS Iran2621.pdf, web/data/charts-current.json, web/data/chart-georef.json and optional source-locked controls-v2-oick.json. Verify SHA-256 before any calculation.

OICK: 217 information, 218/219 STAR missing, 220 SID existing, 221 ADC missing, 222 minima, 223 approach missing, 224/225/226 approach existing.

For maps missing full border graticules, enter published WGS84 lat/lon positions and independently measured PDF marker coordinates. V2 similarity calibration requires at least THREE fitting controls and ONE independent held-out control, spread at least 1 km, multiple published sources, original-PDF marker evidence and <=1.5 PDF-point error. Multi-scale sections require separate region boundaries and transforms. NOT TO SCALE insets must be masked. An unscaled entire chart is rejected rather than falsely georeferenced.

Run Python dependency installation with scripts/requirements-georef.txt, then:
  python -m unittest discover -s tests -p test_georef_engine_v2.py -v
  python scripts/georef_engine_v2.py --airport OICK --output review-assets/georef-v2-oick-qa.json

The new workflow JEPPIRAN V2 OICK Georeferencing QA runs with Git LFS, verifies the original source, checks immutable Web/Android production references, runs source tests, and uploads per-page QA report. There is no automatic Web/Android publication. Automatic authoritative navdata lookup and automatically determining arbitrary vector marker centres are NOT implemented yet.

## Verified OICK source-QA result (2026-10-15)

The original V2621 source was checked by GitHub Actions. 7 mathematical unit tests passed. Four new chart-page candidates were computed: 218 and 219 (rotated STAR), 221 (ADC main and distinct apron inset), 223 (ILS main plan with an excluded NOT TO SCALE inset). Five total map regions were recovered. Original georeferences 220, 224, 225 and 226 were preserved byte-for-byte; their source fingerprints matched. Independent KRD station source-symbol errors in PDF points were 0.47095, 0.49784, 0.28945 (ADC main) and 0.11311 (ILS main). The apron inset is grid-measured but not independently verified against an external station.

Exact audit and per-region evidence are in V2621_OICK_V2_QA_REPORT.json. Reproduce via the Georeferencing V2 OICK workflow and inspect the generated artifact (not a navigation approval). **No production JSON was replaced or published**; multi-region viewer support and owner flight test remain separate steps.
