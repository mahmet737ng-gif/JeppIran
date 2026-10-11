# Mashhad ground chart extraction, V2621

Source: user-supplied Jeppesen `2621(2).pdf`, SHA-256
`d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.
This equals the active chart manifest's source hash. Reviewed layouts: PDF 601
(10-9, ADC) and 603 (10-9B, parking guidelines and INS positions). Supporting
pages 574, 575, 602 and 604 were reviewed for taxi/pushback rules, hot spots and
whether they contained additional ground layout geometry.

## Extracted inventory

- 18 named taxiways: A, B, C, C1, C2, C3, D, E, F, G, H, J, K, L, M, N, P, Q.
- 34 printed stand numbers: 101 through 131, plus 133, 135 and 137.
- No 132, 134 or 136 was synthesized. Other depicted aprons do not publish
  numbered stands on these pages.
- Each stand stores its PDF label bounds, distinct guideline endpoint, WGS84
  projection, source page/path, and the separately transcribed INS coordinate.
- The INS table is rounded to 0.1 minute; shared table coordinates are not used
  to collapse separate graphical parking positions.

## Geometry and routing

`web/data/taxi-networks/OIMM.json` is the persistent airport reference consumed
by TAXI. Rebuild with:

```sh
python3 scripts/build_oimm_taxi.py /path/to/2621.pdf
node tests/oimm-taxi.test.cjs
```

The parking graph follows the original PDF line and cubic Bezier paths. Small
touching-path joins are recorded; maximum join is 0.4653 PDF point (approximately
1.5 m at the parking-chart scale). This is a join tolerance, not a claim of
ground survey accuracy. The ADC's other taxiways are manually traced pavement
axes. Existing georeferencing and simulator connection code are unchanged.

All 34 parking positions connect to the apron and exits J, Q, A and B; all 136
stand-to-exit combinations pass the route-planner test. Published holding bars
terminate these exits before RWY 13R/31L. C1/C2 and F/G hold locations and the
military-only L/M/N/P classification are retained. An explicitly requested
`J BT13R H` segment follows the reviewed ADC runway pavement axis from J to H,
then the H connector toward 13L. It is one-way for this test. `BT13R` is a
runway-use token, not a nineteenth taxiway. The generic router cannot enter a
runway without that token; no other runway crossing, construction shortcut, or
absent stand connector is invented. Some pavement groups remain disconnected.

The stand guidelines are bidirectional geometric simulator previews. South
stand pushback requirements are stored and displayed; this does not model tug
kinematics, aircraft clearance, a dispatch instruction or a surveyed stop point.
Flight test remains pending.

## Test flow

Open Charts > OIMM > TAXI. `ST101 A`, `ST137 J`, `ST114 Q`, or `ST118 B` draws
the stand guideline to the named holding point. A number such as `114`
highlights that parking position without an aircraft position. With a simulator
position or SET START, a stand number requests a graph route to that stand.
`ST109 J BT13R H` previews stand 109 through J, an explicit backtrack on
13R/31L and the H connector toward the 13L end. The runway portion is only
shown for this exact explicit sequence; ATC runway clearance is still required.
The route stops at H; entering RWY 13L or proceeding to its threshold is not
included. On the chart, this runway segment was visually checked against the
printed pavement and remains a graphic-derived simulator test, not a surveyed
centreline or a flight-tested route.
`ST113 A BT31L D` previews stand 113 to A, the explicit south-east backtrack
on RWY 13R/31L toward its 31L end, then D. The runway edge is one-way and
requires the exact A → BT31L → D token sequence. It does not imply a crossing
to RWY 13L/31R or an ATC clearance.
STANDS shows all 34 positions; NETWORK shows the full extracted ground graph;
PARKING opens 10-9B, preserving the route. ADC returns to 10-9.

Validation: vector overlays visually compared on both layouts; 136 connected
routes, stand aliases, live-position deviation, military exclusion, runway gap
rejection, explicit-only `BT13R` backtrack, stale route clearing and LTFM
parsing regression checks passed.
The local browser binary could not be downloaded; automated browser rendering
was not completed. The map overlay itself was rendered and visually reviewed.

## R11 · graph download / first-GO reliability (2026-10-11)

- Reuses a single pending OIMM graph download when the TAXI panel opens and GO
  is pressed before the download completes. A ready network is reused, rather
  than fetched again for every route.
- Automatically retries the originally typed GO command after successful
  network load, provided the airport and input have not changed.
- If offline loading fails, the previous route is cleared; no old magenta
  runway segment remains on an unrelated new clearance.
- Adds automated tests for duplicate request prevention, queued route generation,
  cache reuse, and failure without a misleading route. The graph, simulator bridge,
  live position source and original runway authorization gating are unchanged.

## R13 · destination-only shortest connected route and off-route recalculation

This is a simulator-only graph route over the existing OIMM Jeppesen V2621
geometry; not a flight-validated clearance, NOT FOR ACTUAL NAVIGATION.

- With a live simulator/device ground fix or the TEST START point, type **ST109**
  to route over existing connected civilian centreline edges to stand 109.
  No live ground position: only the stand can be marked (no invented origin).
- **13R** / **RWY 13R** resolves to the graph's existing J holding point,
  **31L** resolves to the existing A holding point, as indicated by the
  corresponding existing explicit BT13R/BT31L starts. These are **HOLD SHORT**
  routes, **NOT runway threshold or takeoff-position routes**. RWY 13L and 31R
  have no individually reviewed entry/hold goal in this network and are
  intentionally refused.
- **ST113 13R** previews a route from a known stand to the J holding point.
  Drop-down destinations include all 34 stands and only mapped runway holds.
- AUTO traverses only existing source-attributed graph edges; it excludes
  military segments, closed segments, all runway edges, unmapped transitions,
  and intermediate stand stops. No taxiway-to-runway crossing is inferred
  from proximity or a published stand's rounded INS coordinate.
- While a live AUTO route is active, consecutive accurate ground positions
  more than 45 m off the existing path trigger shortest-path recalculation
  (cooldown 3 seconds). Snap-to-graph must be <=65 m, accuracy <=35 m and
  ground speed <=23 m/s. If mapping is ambiguous/out of range, the app reports
  the gap rather than drawing a speculative replacement. Explicit manual
  sequences remain fixed, never silently rewritten.
- Simulator bridge and flight-position transport are unchanged.

A landing aircraft still on an unmapped runway cannot safely be assigned a
runway-exit connector: taxi suggestions begin only when its real position
is sufficiently near an already drawn ground-centreline node. For full
runway-to-stand coverage, published RWY 13L/31R exit and threshold geometry,
explicit holds, intersections and access constraints must be reviewed and
digitized before being promoted to routeable graph edges.

## Native Android graph parity (OIMM / V2621) · 2026-10-11

- `app/src/main/java/com/tareghmsr/jeppiran/OimmTaxiRouter.kt`
  uses exactly the same chart-sourced `web/data/taxi-networks/OIMM.json` that the
  Web/PWA uses; the Android Gradle asset source set bundles it offline.
  The source SHA and chart cycle must match. No second Android geometry source
  is fabricated.
- Android TAXI entry now offers all 34 individually printed stands and the
  existing 13R and 31L hold-short goals. Text such as `ST109`, `13R` and
  `ST113 13R` is recognized. A live simulator or sufficiently accurate
  device-GPS fix is required for destination-only routing. Named stand start
  is a preview, not a published pushback clearance.
- The mapped route is painted as a restrained translucent magenta line inside
  the native PDF canvas on OIMM layouts **601 (ADC)** and **603 (parking detail)**,
  respecting native zoom, pan and source-matched georeferencing. No taxi
  overlay is shown on approach plates or charts with invalid georeferences.
- Native live AUTO path monitoring samples the current position every 1.2 s,
  requiring two consecutive >45 m deviations, sane ground speed / accuracy
  and a 3 s replanning cooldown. The simulator bridge, selected position
  source, and its reconnect state are untouched. Explicit manual route
  expressions remain text-only in native until separately mapped.
- A stale airport chart cycle, missing position, disconnected graph, or
  unavailable 13L/31R runway hold is shown as a clear unrouteable state.
  **Never invent entry/exit taxi links across airport runways or military areas**.

### Remaining source-data gaps

This is graph-connected **simulator QA**, not an AIP-approved aircraft taxi
clearance. From the supplied chart's current mapped edges, 34 stands connect
to holding nodes for runway names **13R** and **31L**. Those two goal points
are NOT runway departure thresholds, and no validated civilian automatic
`RWY 13L / 31R` stop-point connectors are stored. Landing from an uncharted
runway exit is therefore not automatically routed to a stand until the
aircraft has reached an accurately mapped civil taxiway. Do not silently
treat a nearest-looking apron segment as an approved stand connector.

## R17 · generalized taxiway-to-runway and apron connections (2026-10-11)

The original published ground network (`OIMM.json`) remains unmodified and is
still tied to Jeppesen V2621. The separate `taxi-runway-access.js` **simulator
QA** layer anchors a potential runway entrance ONLY at a printed civilian
hold node (`holdNodes`) and projects it onto existing chart-derived RWY
13R/31L axis segments. J and A are no longer special-cased as sole entrances.
A 1,062 m chart-axis bridge joins the geometrically aligned J→H and A→D
runway-axis portions, strictly for simulator preview.

Regression-tested runway access candidate taxonomy:
- BT13R axis: **J, Q, A, F, G** from their own printed hold locations
- BT31L axis: **J, Q, A, B, C1, C2, F**
- Hold-to-axis projections of <=115 m are *chart-hold QA*, never surveyed.
  Longer projections of 116–180 m (including B/F/C1/C2) are marked
  **LONG-REACH QA UNVERIFIED**, and may traverse unmapped pavement; they
  require chart/flight visual review before any geometry promotion.
- These links exist **only after the explicit BT runway-use token**
  (`ST109 Q BT31L D`, `ST109 B BT31L D`,
  `ST109 Q BT13R H`). ATC runway permission is separate and mandatory.
  Unrequested runway edges remain excluded from normal routing; no transition
  between nearby pavement names is invented.
- For civilian/main ramp arrival, `RAMP`, `APRON`, `MAIN APRON` and
  `ST113 RAMP` select the shortest reachable mapped APRON segment.
  Every published stand has a tested path to a main-apron vertex. Other
  aprons without mapped entrances/numbers are not silently connected.
- The DEMO START label and the residual QA START marker have been removed
  from the full-size ADC overlay. Internal preview positions still work.

**Limitations:** These additions are QA candidate geometries, *not surveyed
runway entry centerlines or validated taxi clearances*. RWY 13L/31R geometry
and some non-main ramp connectors are still absent. Android's native auto
stand/hold route uses the original shared graph and is unchanged by this
web-specific runway-access QA overlay. No real-world aircraft navigation.

## R19 visual centreline correction · 2026-10-11

The explicit Q/BT31L/D, A/BT31L/D and J/BT13R/H chart overlays now
separate physical runway-axis edges from graphic QA-only projections.

- A *solid magenta* line is rendered only on consecutive source-graph taxiway
  or runway-axis edges. All original sampled nodes are preserved. OIMM route
  painting disables spline/corner rounding, so the renderer does not cut
  corners across runway pavement.
- Any projected connector between a printed holding line and the inferred
  runway axis (Q is ~107 m in this release's QA source) is drawn **dashed
  amber**, NOT as a verified magenta runway/taxiway centreline. If graph edges
  are absent or unclassified, the renderer leaves a gap instead of drawing a
  straight-line shortcut. The same distinction appears in the mini-preview.
- When the final requested taxiway has explicitly mapped terminal endpoint(s)
  the path search now targets the **terminal end**, not the first traversed
  edge; an explicit runway route is rejected if it fails to reach the mapped
  last-taxiway endpoint.
- Runway crossing still requires an explicit BT token and ATC clearance;
  no runway axis, transition or stand connector has been fabricated.

**Data limitation:** The supplied graph includes chart-derived, *not surveyed*
runway-axis offsets and holding-point projections. A dashed projection must
still be verified using the detailed Jeppesen/AIP runway exit diagram before
it can become a solid, accurate connector. R19 fixes misleading drawing and
terminal-route truncation; it does **not** certify centimetre- or metre-accurate
ground-centreline geometry and does not approve real aircraft navigation.

## R24 · runway suffix, straight chart axis and H → 13L (2026-10-11)

- `ST115 J BT13R H 13L` and `ST115 J BT13R H RWY 13L` are parsed as
  stand + ordered taxiways + **final runway destination**, rather than wrongly
  treating `13L` as a taxiway name. The route is forced to use the complete
  digitized H chart axis, ending at the far H endpoint.
- All four OIMM runway designators 13R, 31L, 13L and 31R are now recognized.
  Runway goal assignment is explicitly differentiated:
  - 13R: existing chart-labelled J hold-short.
  - 31L: existing chart-labelled A hold-short.
  - 13L: **far H paved connector endpoint** on ADC 10-9, marked
    `H ACCESS QA`. This is NOT a measured runway 13L threshold or hold-short.
  - 31R: recognized but no independently grounded destination vertex; refuse
    to invent threshold or connector geometry.
- The sampled BT13R (J→H) and BT31L (A→D) runway **middle-axis** edges
  are drawn as solid aligned magenta. Their original shoulder-to-axis legs
  are graphical estimates, now separately classified **dashed amber**, so
  the misleading diagonal "early turn" is not passed off as runway centreline.
  Each selected taxiway's final mapped vertex remains the path destination.
- The ordinary AUTO solver never traverses runways. Entering a BT requires an
  explicit token, and this entire module remains FOR SIMULATOR QA ONLY.
  Real-world taxi and takeoff clearance still comes from ATC and current charts.
- Core chart PDF, original OIMM graph, FSX/X-Plane simulator bridge, all
  previous user-approved home backgrounds and LTFM task code are untouched.

### Geometry still requiring source verification
The V2621 runway axis and H endpoint are digitized from an ADC schematic,
not measured with survey-grade control. **R24 does not assert that the
RWY 13L threshold is located at the far H endpoint.** Completing an actual
threshold route requires independent AIP/Jeppesen holding/threshold coordinates
and validated mapped connectors. `31R` currently refuses a route without them.

## R25 · OIMM runway graphical MIDLINE, screenshot regression (2026-10-11)

**Root cause:** The V2621 runway graph was constructed from a 10-9B
parking-detail holding point projected onto the 10-9 ADC runway with a
fixed small offset. Those two diagrams' cross-chart geometry is not
equivalent. The old pink "runway" path gradually drifted onto a black
runway border even though its BT graph edges were logically connected.

**Fix in both main chart and TAXI miniature:**

- Derive one straight, common 13R/31L graphic midline from the opposite
  marked ADC runway edges **H + M** at the north-west end, and the
  physical **D** end of the long runway corridor. The midpoint of H/M
  determines the origin. The same border-to-middle displacement at D
  determines the other end. The derived line covers the full ~3.87 km
  chart longitudinal span in simulator geometry, but is **not surveyed**.
- Every part classified `runway-axis` in an explicit `BT13R` or
  `BT31L` route is projected onto this same straight midline, with
  progression and bounds validated. Non-monotone/reversing segments are
  not painted as solid runway paths.
- The projected apron-to-runway and runway-to-taxiway transition is
  **dashed amber**, and its runway endpoint is now co-located with the
  recomputed straight midline. This prevents magenta from prematurely
  cutting across pavement toward H, J, A, D or Q. Turns are made at
  the labelled available chart-derived connector, never a shortcut.
- The short taxiway H axis is still drawn to its last mapped endpoint
  for requests such as `ST117 A BT13R H 13L`. Its destination remains
  **H ACCESS QA**, NOT the certified RWY 13L threshold/holding point.
- **Underlying OIMM ground graph, source PDF, locked home backgrounds,
  other airports, simulator bridge and georeferences are unchanged.**
  The replacement is a *display geometry* derived from ADC edges,
  isolated from route permission and aircraft-position calculations.
- GitHub Actions tests specifically verify all continuous BT runway
  coordinates are collinear on the derived schematic runway midpoint
  and that QA connectors join the corrected axis without a direct
  magenta shortcut.

This remains **SIMULATOR QA ONLY**. The ADC exaggerates runway graphic
width; the true geographic centreline cannot be certified by its PDF
border midpoints. A future replacement requires surveyed AIP/Jeppesen
runway-centreline and taxiway intersection anchors.

## R26 · Explicit runway junction stations + remove OIMM mini-preview

- The separate embedded *small route map/card* in the OIMM TAXI panel is
  suppressed, while route output remains directly over the large ADC.
  GO, the destination selector, the status banner, warnings, and the live
  off-route monitor remain available. LTFM/other airports retain their
  previously approved separate route preview behavior.
- For a single explicit `BT13R` or `BT31L` stage, the runway leg shown in
  the ADC is now **one straight line between the perpendicular stations of
  the specifically requested entry and exit taxiways**, not an arbitrary
  middle sample selected by the shortest-path solver. Thus `ST109 J BT13R
  H 13L` anchors the drawn backtrack to J and H; `ST117 A BT13R H 13L`
  to A and H; `ST109 Q BT31L D` to Q and D. The taxiways continue to
  their chart-mapped terminal endpoints.
- Entry and exit connectors remain **dashed amber, not a magenta verified
  runway route**: the 10-9B J hold and the 10-9 ADC display midline
  differ substantially in the source chart georeferences. They are
  diagram-derived visual QA estimates and may *not* be presented as
  published runway/taxiway intersections or physical taxi clearance.
- No OIMM graph edges, source PDF, chart georeferences, X-Plane/FSX bridge,
  PWA home backgrounds, other airports or stand connectivity have changed.
  An explicit `BT` still gates every runway movement.

**Status:** Automatic checks now assert the OIMM preview is hidden, and that
the visual runway section has exactly two aligned endpoints for each of the
three explicit J/A/Q backtracks. This does not amount to visual flight
verification of a real runway centreline. The app is SIM QA ONLY.
