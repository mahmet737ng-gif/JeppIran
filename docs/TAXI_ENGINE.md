# JEPPIRAN Universal Taxi Engine · v1

## Scope and release boundary

The airport-neutral implementation is `web/taxi-engine.js` (browser + Node,
zero dependencies). Its data contract is `engineVersion:1`. It replaces
airport-specific **algorithm duplication**, not the need to digitize and
source-review each airport's actual taxiway geometry, stand lead-in/out, runway
entrances, holds, and restrictions. Never use the simulator QA output as a
real-world ATC taxi clearance or aircraft navigation display.

**Protected existing behavior:** The existing OIMM R27 and LTFM taxi routing,
FSX/X-Plane bridge, user-approved home images, PDF chart data, and previously
published taxi graph JSONs must remain unchanged unless separately tested and
approved. The new engine is additive, and a new-airport data file is never
marked usable merely because a source PDF exists.

## One-time engine vs. per-airport data

The engine already contains:
- ICAO / chart-cycle and provenance validation
- WGS84 node/edge topology and directed (including one-way) edges
- Individual stands and their **actually connected** lead-in/lead-out
- Taxiway centerlines with every intermediate polyline vertex preserved
- Four-digit chart-cycle matching and explicit runway-physical-ID separation
- Source-declared named taxiway terminal endpoints
- Destination-only ST109 / RWY 13R and ordered ST101 J BT13R H 13L parsing
- A shortest-path Dijkstra state machine that must consume every named segment
  **in order** and cannot shortcut across unnamed intersections
- No implicit runway crossing or backtrack; runway segments require named BT
- Source-quality gates: blocked edges never used; projected QA connectors
  require an **explicit opt-in** and are always drawn dashed amber
- Small magenta continuous linework strictly along existing source polylines,
  with no smoothing / direct chords / imaginary runway in the inter-runway gap
- Two accurate off-route fixes and 3 s cooldown, plus fail-closed manual
  re-clearance for any active route which traversed a runway
- A browser API and a source graph converter for existing OIMM/LTFM data

**Each new airport supplies only a reviewed graph configuration**:

`web/data/taxi-networks/ICAO.json`

```json
{
  "engineVersion": 1,
  "airport": "ZZZZ",
  "cycle": "2621",
  "coordinateSystem": "WGS84",
  "simulatorTestOnly": true,
  "verified": false,
  "enabled": true,
  "source": {"provider": "SOURCE", "document": "CHART REF"},
  "nodes": {
    "ST1": {"lat": 36.0, "lon": 59.0},
    "N1": {"lat": 36.001, "lon": 59.001}
  },
  "edges": [
    {"from": "ST1", "to": "N1", "label": "APRON", "kind": "apron",
     "quality": "mapped", "bidirectional": true,
     "source": {"provider": "SOURCE", "document": "PDC", "page": "10-9B"}}
  ],
  "stands": {"101": {"node": "ST1"}},
  "taxiways": {"A": {"terminalNode": "N1"}},
  "runways": {
    "13R": {"physicalId": "13R/31L", "goalNode": null,
            "goalKind": null, "axis": null},
    "31L": {"physicalId": "13R/31L"},
    "13L": {"physicalId": "13L/31R"},
    "31R": {"physicalId": "13L/31R"}
  }
}
```

This is a schema example only, NOT an actual airport, survey, georeferenced
position or complete routeable graph. Real source nodes/edges must be
supplied; the two listed runway pairs are OIMM examples, NOT hardcoded
generic airport designators. Do not copy fake coordinates into production.

`kind`: `stand`, `apron`, `taxiway`, `connector`, `runway`.
`quality`: `mapped`, `qa`, `projected`, `blocked`.
`geometry`: optional array of >=2 WGS84 points, from the **same source
centerline** and anchored to the graph endpoints; for a digitized source
polyline use every verified vertex. A two-point segment is valid only for
a genuine source-mapped straight edge. The validator never joins spatially
nearby unconnected vertices.

Each runway end gets its own `runways[designator]` record with one physical
pair ID and a reviewed optional `goalNode`, `goalKind` (`hold`,
`threshold`, `access-qa`) and separately sourced `axis` for rendering.
A parallel runway is **never** a border of its neighbor. Missing runway
goals remain unrouteable. `runway` edges also require a matching physical ID.

## Adding an airport (Windows or GitHub)

1. Create its data file once:

   ```powershell
   node scripts/taxi-engine/new-airport.cjs OISS 2621
   ```

   The file is created with `enabled:false`, **zero nodes**, zero
   connections and `SOURCE REQUIRED` — **it cannot route**.
   The script refuses to overwrite a previously imported airport.

2. Read the airport's current AIP / Jeppesen ADC, parking, stand docking,
   runway-exit and hot-spot charts at full scale. Record source page/cycle,
   node/stand label, every actual centerline and shared intersection.
   For each edge enter source, direction, quality and the source polyline.
   Do not create edges based only on visual proximity, PDF label matching,
   slant DME distances or guessed line extension.

3. Independently draw/register each runway (13R/31L versus 13L/31R, etc.).
   Enter threshold/hold/access goal nodes only when verified from actual
   source; a similar-looking parallel runway cannot supply a missing exit.

4. Validate and examine the generated graph, and perform a simulator QA
   dry run of the expected stand-to-runway, stand-to-stand, and runway
   exit-to-stand cases. Set `source.reviewStatus` to
   `SIM_QA_REVIEWED` and only then change `enabled` to `true`:

   ```powershell
   node scripts/taxi-engine/validate.cjs web/data/taxi-networks/OISS.json
   node tests/taxi-engine.test.cjs
   ```

5. Commit only the per-airport JSON. Core algorithms are reusable and
   **must not be copied** into `oiss-taxi.js`, `oyxx-taxi.js` and so on.

## Developer API

```js
const Engine = require("./web/taxi-engine.js");
const fs = require("node:fs");
const graph = JSON.parse(fs.readFileSync(
  "./web/data/taxi-networks/OISS.json", "utf8"));
const taxi = Engine.create(graph);

const auto = taxi.plan("ST101 ST109"); // no runway edges ever
const explicit = taxi.plan("ST101 J BT13R H 13L",
  {allowProjectedQA: true}); // explicit simulator QA preview only

if (explicit.route) {
  const lines = taxi.linework(explicit.route);
  // Feed each line.coordinates into the chart's existing
  // georeferenced PDF projection; draw amber dashed QA separately.
}

// Chart + source are required before selecting any goal:
const routeToStand = taxi.plan("ST109", {
  position: {lat: 36.0001, lon: 59.0001, accuracy: 7, groundspeed: 2}
});
```

The browser exposes the same `window.JEPPIRAN_TAXI_ENGINE` API. A new
network is activated by presence of a matching `ICAO.json` with
`engineVersion:1`, `source.reviewStatus:"SIM_QA_REVIEWED"`, and
`enabled:true`. To deliberately preview source-projected connectors
use `QA ST101 J BT13R H 13L` in TAXI; these legs are dashed amber,
and such routes are not auto-monitored or cleared for runway crossing. Older OIMM/LTFM
networks deliberately remain on their existing routing implementation.

The adapter `Engine.fromLegacy(old, options)` loads previous source
network formats into a new engine-compatible data object. It requires
explicit mapping of physical runway IDs, and DOES NOT auto-fill unknown
runway gates, stand endpoints or unpublished taxi junctions.

## QA and product guarantees

- `tests/fixtures/taxi-engine/ZZZZ.json` is **synthetic** (never publish it
  as a real airport).
- `tests/taxi-engine.test.cjs` checks parser, line geometry, stand
  destinations, physical runway separation, crossing protection, source
  validation, partial gap refusal, and off-route monitoring.
- `.github/workflows/taxi-engine.yml` runs the engine tests plus the
  existing Mashhad suite on affected PRs.
- Native Android currently uses its own OIMM Kotlin implementation.
  The JSON contract can be reused to build a Kotlin adapter later; this
  release does NOT silently claim Android parity or change its bridge.

## Airport onboarding and audit (reusable across every ICAO)

The generic engine is shared; no new JavaScript router should be authored for
each airport. After creating the inactive network with
`node scripts/taxi-engine/new-airport.cjs ICAO CYCLE`, digitize real
source-provenance WGS84 nodes, geometry for every stand lead-in and taxiway
segment, all actual intersections, independent runway axes and held access
nodes in `web/data/taxi-networks/ICAO.json`.

Run a **draft audit at any stage**:

```powershell
node scripts/taxi-engine/audit-airport.cjs OISS
```

Its machine-readable report includes graph validation issues, runway source
gaps, individual stand and runway coverage counts, and sampled automatic
stand-to-stand / stand-to-runway connectivity. A route marked `connected:false`
means its existing source graph has a gap: **do not connect endpoints based on
physical closeness alone**.

When the real chart-source graph is complete, run the publication gate:

```powershell
node scripts/taxi-engine/audit-airport.cjs OISS --strict
node scripts/taxi-engine/validate.cjs web/data/taxi-networks/OISS.json
node tests/taxi-engine.test.cjs
node tests/taxi-engine-onboarding.test.cjs
```

Strict mode refuses to pass until the graph is structurally valid,
`enabled:true`, and source status is `SIM_QA_REVIEWED`. A successful
sample audit is **not** a declaration that every stand and runway is mapped;
review all stand/exit pairs and the original ADC overlays before enabling.
The reusable PWA loader then discovers the new ICAO data without new
airport-specific UI handlers. Android remains a separate implementation
and must not be claimed updated by this web/Node-only feature.
