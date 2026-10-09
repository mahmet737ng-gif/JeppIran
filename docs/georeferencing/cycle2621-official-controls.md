# JEPPIRAN 2621 — exact published-feature georeferencing

Status: **WORK IN PROGRESS — do not merge or publish as 100% georeferenced**.

## Non-negotiable rules

1. Treat officially published WGS84 airport/runway/ARP/VOR/NDB/stand coordinates as source data; retain the exact source DMS strings, official URL, document, date/edition and feature identity.
2. Do **not** infer an unprinted geographic axis, a station coordinate, a stand location or a chart position from a visually plausible location.
3. A published coordinate is one side of a ground control point. The other side is the **verified symbol position on the exact source PDF page**, identified using an independent graphical inspection. Never map the centre of a label in place of the target feature.
4. `NOT TO SCALE` is not an automatic reject, but its presence never licenses assuming that the whole procedure graphic is cartographically uniform. Require independent ground controls and reject the local transform if held-out checks fail.
5. No aircraft marker is shown outside the convex hull of independently matched controls for the new surveyed method; charts outside validated coverage stay unavailable for this feature.
6. A coordinate rounded to 0.1 arcminute has approximately 185 m north/south published resolution and **must not** be treated as an exact parking stand location. Mashhad Jeppesen page 603 contains such coarse stand coordinates; official Iran 2026 OIMM APDC has `INFO not AVBL` in its stand-coordinate table.
7. Inability to georeference a page must remain an explicit failure in the coverage report, not a fabricated 100%.

## Authoritative seed sources verified

- OIMM: Iran AIP ADC 01 OCT 2026, four runway thresholds, and coarse ARP.
- OMDB: UAE GCAA AIP OMDB AD 2.12, four runway thresholds, and coarse ARP.
- UDYZ: ARMATS eAIP AD 2.12 09 JUL 2026, two threshold coordinates.
- OOMS: Oman CAA eAIP OOMS AD 2.19, MCT DVOR/DME transmission antenna.
- LTFM: DHMI Turkish AIP, two taxiway centreline segment endpoints for A and E (four coordinates).

Full URLs and transcribed WGS84 DMS strings are in:
`data/georeferencing/official-control-points.json`.

This is a seed registry, **not a completed census of all 36 airports** in the published 2620 index, and does not account for possible new airports in cycle 2621.

## Process after complete 2621 package becomes available

1. Rebuild exact chart index for the 2621 source; preserve ICAO/procedure ID and page fingerprints.
2. Collect official current AIP for *every* indexed airport (Iran AIM for OI--, DHMI for LTFM, GCAA for OMDB, Oman CAA for OOMS, ARMATS for UDYZ, Georgia AIS for UGTB/UGSB, current Iraqi AIS for ORBI/ORNI). Record dates; do not substitute an old AIP silently.
3. Extract **published** runway thresholds, VOR/NDB, applicable parking stands and other recorded ground controls. Validate original coordinate precision.
4. Produce a page measurement JSON bound to the SHA-256 of the 2621 PDF, with per-page chart key and fingerprint. Each control entry must include `featureType`, `featureId`, measured `x` and `y` (PDF points), `pixelMethod: "verified_actual_feature_symbol"`, and `pixelVerifiedBy`.
5. Run `scripts/validate_official_controls.py`, then `scripts/build_georef_from_official_controls.py`. Each page requires >=4 distinct non-collinear published ground control features, <=0.75 PDF-point fit residual, <=2 PDF-point leave-one-out error and <=10m independent geodetic feature checks.
6. Run `scripts/audit_approach_airport_georef_coverage.py --strict` with a reviewed Airport-layout selection. A failure is a source/measurement gap to investigate, not grounds to insert artificial coordinates.
7. Complete simulator/GPS moving-map checks and compare with older cycle; only then merge, publish and enable 2621 updates.

## Example commands (once real 2621 PDF, measured-symbol JSON and index exist)

```bash
python scripts/validate_official_controls.py \
  --source data/georeferencing/official-control-points.json \
  --index cycle-build/charts-current.json \
  --output cycle-build/official-control-audit.json

python scripts/build_georef_from_official_controls.py \
  --pdf Iran2621.pdf \
  --index cycle-build/charts-current.json \
  --published-controls data/georeferencing/official-control-points.json \
  --measured-features cycle-build/verified-pixel-controls.json \
  --output cycle-build/published-ground-georef.json \
  --report cycle-build/published-ground-review.json
```

Until the verified pixel-controls JSON is available, these commands are intentionally incomplete. **Do not fabricate it.**
