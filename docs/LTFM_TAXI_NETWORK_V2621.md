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

## ORIGINAL parking-stand centerline geometry: breakthrough (11 October 2026)

The initial airport OSM importer mistakenly queried `parking_position` NODES,
missing almost all `parking_position` WAYS. The dedicated OSM way audit
(`scripts/fetch_ltfm_osm_parking_leads.py`) recovered actual **original
vector way vertices** for Istanbul stands. The source geometry is kept
distinct from merely projected nearest taxiway names.

**Completed and committed data:**

- `web/data/taxi-parking-ways/LTFM.json`: 742 OSM parking-position ways
  and 18 parking-position nodes, 360 of the 379 chart-mentioned stand
  identifiers matched by exact published ID.
- `web/data/taxi-stand-leads/LTFM.json`: 355 stand IDs with full original
  parking-way source vertex polylines touching the existing taxiway/taxilane
  network via an IDENTICAL source OSM node ID (not distance snapping).
  237 stand IDs have exactly one connected source-way variant; others
  may have legitimate size/alternative variants and require selection.
  24 stand IDs remain without an exactly joined OSM way.
- `web/data/taxi-stand-egress-routes/LTFM.json`: 311 stand IDs with
  480 exact graph-continuous source path variants to the taxiway NAME
  recorded in the Jeppesen 30-9J pushback chart. Every point comes
  either from the original OSM parking-position way or from its
  shared-node connected taxiway graph, with no artificial segments.
  No runway edges are traversed.

**D3 independently measured test case**:

- Original OSM parking-position way `918835328`: four original vertices,
  ST D3 coordinate at `41.2636483,28.7413378`, shared graph node
  `O7920605848` after 122.60 m of source-mapped parking centerline.
  This point is approx 5.5 m from the text anchor in printed Jeppesen
  parking chart 30-9B.
- From that exact node the graph reaches published pushback **T5** using
  195.84 m of existing taxiway source edges (11 edges); resulting
  stand-to-T5 SIM QA candidate total **318.44 m** across 15 original
  vertices. An alternate T3 SIM graph candidate measures **368.07 m**
  across 21 original vertices.
- Jeppesen 30-9J4 explicitly mentions T5 and T3 for ST D3, but neither
  the chart nor this source graph confirms the detailed **direction of
  pushback/tow, preferred option, aircraft type restriction, or ATC
  clearance**. These graph routes are not approved operating procedures.

The Web Taxi panel supports `STD3` to inspect stand and ORIGINAL
parking-way geometry and `STD3 T5` / `STD3 T3` to overlay a SOURCE-ONLY
physical graph path in magenta; `ST100 N6` is another matched example.
When multiple original OSM variants exist, the user must select one
explicitly in the source-route dropdown. Long-route designators (e.g.
`STD3 17R2F`) still need a separately validated transition to
the published procedure's first taxiway: a valid parking-position
centerline alone does not confer an ATC route through the rest of
the airport.

The entire work is **simulator QA only** and no navigation or ATC
clearance is implied. `operationallyVerifiedPushbacks=0` means
zero routes are authorized, even though the underlying OSM source
geometry is real and continuous.

## Geometry extraction update (11 October 2026)

**The exact source line segments now exist in a standalone indexed file:**
`web/data/taxi-egress-geometry/LTFM.json`, generated by
`scripts/build_ltfm_mapped_egress_geometry.cjs`.

- 379 named stand references, including 263 individual Jeppesen parking-chart
  **text positions** and 116 rounded shared INS groups.
- 349 stand names have source-written Jeppesen pushback references.
- 203 stand labels have **2,321 stored, source-original OSM edge pieces**
  on chart-mentioned taxiway names, expanded only through identical-name
  contiguous edges sharing exact existing OSM vertices. Coordinates are
  unchanged WGS84 endpoints, with provenance for each source edge.
- 60 individually chart-labeled stands lack a matching named, near-source
  OSM centerline. Seven official pushback taxiway names are absent from OSM
  despite source AIP/Jepp documentation (F1, F2, F3, F6, E8, TC, TD).
- **ZERO geometry-verified parking stand -> named taxiway exit/pushback
  polylines**. Do not infer these missing edges by drawing a straight line
  between parking *text* and the closest OSM way. Matching a printed name
  to mapped geometry proves only the mapped named section, not its exact
  stand lead-out, stand nose position, aircraft type permissions, or pushback
  clearance.

Official topological corroboration is stored separately as
`web/data/taxi-stand-constraints/LTFM.json`: DHMİ AIP Türkiye
AD 2 LTFM-6 (19 FEB 2026). It states T3/T5 intersection is C2 lead line,
T7/T9 intersection is E3 lead line, and named corridors from N2 to
B2/D5/D4/F4 and from G12 to parking position 319. These are **published
relationships**, not measured 2D turn arcs. Do not silently override cycle
2621 with older AIP restrictions; check later NOTAM changes.

The Web TAXI stand QA inspector displays the mapped source taxiway
segments in **solid magenta**, without inventing stand-to-edge taxi lines.
Previously used straight-line stand-proximity dashed links have been
removed to avoid a route illusion. A stand without individual reference
coordinates gets no artificial dot based on its shared INS group.

One more source extraction is being evaluated independently:
`scripts/fetch_ltfm_osm_parking_leads.py` obtains OSM parking_position
**ways** omitted from the prior node-only airport network import, then
checks exact shared graph-node IDs. This can recover real physical
parking-lead geometries where publicly mapped; it does not certify
Jeppesen-specific pushback trajectories or official operating clearances.

## Reusable generic airport topology
`web/taxi-adjacency.js` caches shared-node adjacency and exact node-level links; `scripts/build_taxi_adjacency.cjs ICAO` regenerates the inventory for an airport network file. Named-taxiway breadth-first chains are only *suggestions*: an individual travel path MUST be tested on physical edges, direction and restrictions.

## Remaining non-verified work
The OSM source has **41 printed names without individually named physical centerlines**, even though their label coordinates are now cataloged. Likewise the INS stand-group coordinates represent printed rounded groups, **not surveyed individual stand nodes**. Only a subset of stands have written pushback descriptions (e.g. D3 on 30-9J4). For valid stand → runway connected routing, individually mapped stands, actual lead-in/lead-out paths, pushback directions, authorized taxi intersections, hold-short positions, runway backtracks and closures still require physical validation.

Never mark `verified:true`, `connectorVerified:true`, or imply a continuous route from a stand solely because the printed standard procedure trace has been digitized.

## CI and files
`.github/workflows/generate-ltfm-taxi-vectors.yml` checks out the actual airport Git-LFS PDF, extracts 35 published traces and all 41 label anchors, validates their cycle/content, and publishes only generated QA JSON. Web service-worker caches the charts' metadata files and route renderer for offline use.
