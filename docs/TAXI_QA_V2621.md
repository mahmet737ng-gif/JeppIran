# JEPPIRAN TAXI QA · V2621 web pilot
Date: 2026-10-11

## Implemented
- TAXI button opens a compact panel on the existing ADC; airport selection and PDF engine stay unchanged.
- Input parser: `ST104D`, `P204`, `C11 Z K /Y T ST204`, `34L 1A`.
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
    { "key": "34L 1A", "operation": "DEPARTURE", "nodes": ["N1","N2"], "holdIndices": [] }
  ]
}
```

Never change `verified` to true without airport-specific mapping QA. The supplied example is synthetic and MUST NOT be uploaded as an airport network.

## Test steps
1. Open the deployed Web/PWA Charts page, choose LTFM, open ADC, press TAXI.
2. Type `ST204`, `C11 Z K /Y T ST204`, or `34L 1A`. The parser should recognize each but state that no verified graph is available.
3. Press `TRACE QA`; tap sequential points on the printed centerline and press `HOLD HERE` at a stopping point. Confirm magenta and red line placement and zoom/pan scaling. Clear when finished.
4. Use `ADC` to return from any detailed chart. A position-aware chart switch only appears for eligible georeferenced detailed charts.

**Operating disclaimer:** The test app is not for actual navigation. Follow ATC clearance, markings, current NOTAMs and authorized aerodrome charts.
