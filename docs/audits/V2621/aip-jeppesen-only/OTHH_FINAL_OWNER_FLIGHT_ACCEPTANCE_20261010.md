# JEPPIRAN V2621 — OTHH final acceptance of ten additional chart georeferences

Date: 2026-10-10. Owner instruction: successful simulator flight tests constitute final application approval for aircraft position/heading display, not a reason to keep these ten charts in QA/pending state.

**Final-for-JEPPIRAN simulator display:** pages **1538, 1539, 1540, 1552, 1553, 1556, 1557, 1559, 1560, 1561**.

Already finalized and deployed: **1536, 1549**. This makes **12 OTHH chart overlay records active and final for simulator display**.

Finalized ten chart records are published under both:
- `web/data/othh-flight-qa-extra-v2621.json`
- `app/src/main/assets/othh-flight-qa-extra-v2621.json`

Their owner flight-test status now explicitly reads `userTestStatus=PASS`, `approvedForApp=true`, `qaTestOnly=false`, `finalForAppSimulatorDisplay=true`, `publicationMode=FINAL_PRODUCTION_SIMULATOR_DISPLAY`. No map geometry, input control points, plan bounds, excluded masks, source fingerprints, chart identities, or georeference processing logic were altered in this decision commit. It does not touch existing `chart-georef.json` baseline records, simulator bridges, PDFs, or other airports.

**Scope of final:** acceptance of marker positioning in JEPPIRAN for simulator use. The original data provenance flags, including unperformed official AIP independent accuracy checks or AIRAC equivalence, remain factual; do not fabricate those tests. **NOT FOR ACTUAL NAVIGATION.**
