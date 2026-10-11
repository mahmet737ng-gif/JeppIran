# JEPPIRAN TAXI QA · V2621 web pilot
Date: 2026-10-11

## Implemented
- TAXI button opens a compact panel on the existing ADC; airport selection and PDF engine stay unchanged.
- Input parser: `ST104D`, `P204`, `C11 Z K /Y T ST204`, `34L2A`.
- Optional verified airport ground graph supports nearest-node lookup, shortest route to a stand, constrained taxiway sequence routing, a red perpendicular hold-short marker, and nearest **procedure START** selection when ARR/DEP share a name.
- Magenta path is drawn on the PDF transform layer and scales with zoom/pan.
- Manual `TRACE QA` can test appearance on the ADC even while graph digitization is incomplete. Tap sequential centerline points, then `HOLD HERE`. This is manually plotted and is NOT automatic routing.
- A chart-switch hint appears if a more detailed Airport category chart has georeferencing that contains the live position. The `ADC` button always returns to the overview.
- No changes to the simulator bridge, its protocols, aircraft-position transport, or live positioning.

## Critical limitation
There is currently **no airport taxiway centerline/stand graph published in this repository**. Thus typing a stand or route cannot yet produce an *automatically calculated real airport taxi path*. The UI explicitly refuses to invent one.

ADC georeferencing alone is not a connected ground network. Digitization for each airport requires surveyed taxiway centerlines, junctions, stand nodes, runway crossing restrictions, one-way segments, accurate parking positions, published taxi procedure start points and official chart-specific status/NOTAM cross-checks.

## Ground network file contract
A vetted file is loaded from `web/data/taxi-networks/ICAO.json` only if `verified: true`, airport ICAO matches and `cycle` equals the manifest version.

**Example structure (illustrative ONLY; not a valid airport dataset):**

```json
{
  "airport": "EXXX",
  "cycle": "2621",
  "verified": false,
  "nodes": {
    "N1": { "lat": 40.0, "lon": 29.0 },
    "N2": { "lat": 40.0001, "lon": 29.0001 }
  },
  "edges": [
    { "from": "N1", "to": "N2", "taxiway": "C11", "bidirectional": true, "runway": false, "closed": false }
  ],
  "stands": { "ST204": "N2" },
  "procedures": [
    { "key": "34L2A", "operation": "DEPARTURE", "nodes": ["N1","N2"], "holdIndices": [] }
  ]
}
```

Never change `verified` to true without airport-specific mapping QA. The supplied example is synthetic and MUST NOT be uploaded as an airport network.

## Test steps
1. Open the deployed Web/PWA Charts page, choose LTFM, open ADC, press TAXI.
2. Type `ST204`, `C11 Z K /Y T ST204`, or `34L2A`. The parser should recognize each but state that no verified graph is available.
3. Press `TRACE QA`; tap sequential points on the printed centerline and press `HOLD HERE` at a stopping point. Confirm magenta and red line placement and zoom/pan scaling. Clear when finished.
4. Use `ADC` to return from any detailed chart. A position-aware chart switch only appears for eligible georeferenced detailed charts.

**Operating disclaimer:** The test app is not for actual navigation. Follow ATC clearance, markings, current NOTAMs and authorized aerodrome charts.

## OMDB Apron C stand-position QA · 2026-10-11
- Extracted 55 individually named stand reference positions from UAE GCAA official **OMDB AD 2-22C** (AIRAC 03/2026, effective 19 MAR 2026), preserved as WGS84 in `web/data/taxi-stands/OMDB.json`. These include separate MARS positions C51L/C51/C51R, C53L/C53/C53R, C54L/C54/C54R, and C55L/C55/C55R. Official source: https://www.gcaa.gov.ae/en/ais/AIPHtmlFiles/AIP/Current/AIRACs/2026-P02/graphics/OMDB-AD-2-22C_2026-03.pdf
- Dataset is **position-only QA**, explicitly `verifiedForTaxiRouting: false`. An INS stand coordinate, surveyed parking position, centreline intersection, lead-in line, pushback path and bidirectional taxi segment are NOT interchangeable. Do not auto-connect nearest stands.
- TAXI `STANDS` button displays stand points georeferenced over an eligible chart; entering `C51L` selects and labels the exact published position even without a taxi graph. No route is generated.
- Input `34L2A` is the correct **no-space syntax**, `34L 2A` is rejected. **34L is merely a syntax example**; OMDB has runways 12L/12R/30L/30R, and no numeric taxi procedure for OMDB is claimed to be digitized.
- Missing to claim complete airport topology: current-cycle revalidation against UAE AIP charts OMDB AD 2-21, 22A/22B/22C, 24/25/26 and effective NOTAM; remaining aprons; all taxiway centreline nodes/edges, service boundaries, restrictions, holds, jet blast, runway crossings, operational direction and pushback connections. The app correctly refuses to calculate taxi routes until each published segment and stand connector is verified.
- This QA change does **not** modify simulator bridge, aircraft position, charts, or existing PDF/gps rendering logic.
