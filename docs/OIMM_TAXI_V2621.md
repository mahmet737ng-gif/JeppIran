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
