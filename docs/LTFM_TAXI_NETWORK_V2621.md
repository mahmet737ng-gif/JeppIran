# LTFM / IST Taxi Ground Network — V2621

## Source-specific QA status
Last reviewed: 2026-10-11. All data intended for simulator visualization and QA, **NOT actual taxi navigation**.

This work has three separate representations. Do not silently merge their trust levels:

1. **Physical node/edge graph** `web/data/taxi-networks/LTFM.json`: OSM-based simulator test, 4,008 nodes, 4,603 edges, 131 named taxiways. `verified:false`, 2,705 unnamed segments in the original graph. Physical junctions require shared actual node IDs; no geometric proximity join.
2. **Chart-only name index** `web/data/taxi-chart-labels/LTFM.json`: all 41 ADC labels missing a correspondingly named OSM centerline are located in printed PDF points and approximate WGS84 using the ADC graticule. These are **label positions, not taxiway axes**. They must NOT be promoted to route segments, endpoints or junctions.
3. **Jeppesen published procedure vector traces** `web/data/taxi-procedure-traces/LTFM.json`: 35 cycle-2621 standard arrival/departure procedures (30-9F* and 30-9G*), extracted from original blue/red *colored vector strokes* of the user-supplied Jeppesen taxi charts; not recreated with OCR-based line guessing. Source PDF `web/data/charts/LTFM.pdf` via Git LFS. Each record has `printedSegments`, `sourceChart`, `taxiways`, `holdShortOf`, and explicitly `nodeGeometryVerified:false`.

The manually transcribed route-label catalog `web/data/taxi-procedures/LTFM.json` is a metadata fallback and must not be drawn as a path in the absence of vector strokes.

## Runtime behavior
In the LTFM TAXI panel, user may type:
- `17R2F` or `DEP 17R2F`: render the exact stored published magenta vector stroke geometry over ADC 30-9. Published sequence: `G N2 D B B9A`, hold short RWY 17R, source 30-9G3.
- `STD3 17R2F`: render the same **published procedure only**; the D3 parking stand-to-first-procedure-taxiway link remains unverified and **is intentionally NOT drawn**.
- `ARR 183F` or `DEP 183F`: resolve two otherwise ambiguous identically numbered procedures.
- Input of an arbitrary custom taxiway sequence still uses the existing node/edge graph. No source-colored procedure trace makes a physically disconnected stand connector valid.

The selected unmapped taxi label can also be highlighted as a **cyan dashed LABEL ONLY marker** on the ADC to assist QA. It is not a centerline, route or runway crossing.

## Reusable generic airport topology
`web/taxi-adjacency.js` caches shared-node adjacency and exact node-level links; `scripts/build_taxi_adjacency.cjs ICAO` regenerates the inventory for an airport network file. Named-taxiway breadth-first chains are only *suggestions*: an individual travel path MUST be tested on physical edges, direction and restrictions.

## Remaining non-verified work
The OSM source has **41 printed names without individually named physical centerlines**, even though their label coordinates are now cataloged. Likewise the INS stand-group coordinates represent printed rounded groups, **not surveyed individual stand nodes**. Only a subset of stands have written pushback descriptions (e.g. D3 on 30-9J4). For valid stand → runway connected routing, individually mapped stands, actual lead-in/lead-out paths, pushback directions, authorized taxi intersections, hold-short positions, runway backtracks and closures still require physical validation.

Never mark `verified:true`, `connectorVerified:true`, or imply a continuous route from a stand solely because the printed standard procedure trace has been digitized.

## CI and files
`.github/workflows/generate-ltfm-taxi-vectors.yml` checks out the actual airport Git-LFS PDF, extracts 35 published traces and all 41 label anchors, validates their cycle/content, and publishes only generated QA JSON. Web service-worker caches the charts' metadata files and route renderer for offline use.
