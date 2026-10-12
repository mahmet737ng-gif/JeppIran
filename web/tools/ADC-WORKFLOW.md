# JEPPIRAN ADC → Routable (source-first workflow v2.3)

This replaces ad-hoc airport-specific taxi network guessing. **A PDF scan is not
a routeable graph.** The engine maintains an executable queue of missing tasks
and does not authorize phantom stand/taxiway/runway links.

## One command: native PDF to review queue

With Python and PyMuPDF installed, plus Node.js for the graph compiler:

```bash
python -m pip install pymupdf shapely
python web/tools/adc_autopilot.py --pdf 2621.pdf --icao OIII \
  --survey web/data/taxi-surveys/OIII.json --out build/adc/OIII
```

For an airport without an inventory:

```bash
python web/tools/adc_autopilot.py --pdf airport_adc.pdf --icao XXXX \
  --out build/adc/XXXX
```

For a multisheet airport PDF, use `--pages 2,6`. The scanner does NOT guess
which unrelated pages are the correct ADC/parking pages.

Artifacts: `page_XXX_raw_vectors.json`, `XXXX_page_XXX_line_candidates.json`,
`workflow_report.json` and `NEXT_ACTIONS.md` (when a survey is supplied).
All generated line/endpoint candidates are initially **reviewed=false**.

## The nine phases

1. **Source** — PDF/Jepp cycle SHA-256, page dimensions, provenance.
2. **Inventory** — each physical black runway strip (both ends), named taxiways,
   stands, parking charts. White gaps between runway stripes are NOT runways.
3. **Geometry** — extract original PDF Bézier curves. Reject title glyphs, building
   outlines, parking boundaries and symbols. Each line's source drawing ID is kept.
4. **Junctions** — endpoints and geometric intersections are only **candidates**.
   Verify an actual physical contact, split the source polyline at the approved node.
5. **Semantics** — name every segment, stand branch, one-way constraint and
   applicable routing restriction using published chart labels and briefings.
6. **Runway** — match both ends of each physical runway, holding position, gate,
   connector and runway axis. Crossing/backtrack may not be fabricated.
7. **Page alignment** — different PDFs have *different coordinate frames*.
   Register parking page to ADC with ≥3 independent verified points and reviewed
   inter-page junctions. Never compare raw (x,y) across pages as if they matched.
8. **Quality** — graph connectivity to stands/runway gates, geometric gaps,
   disconnected components, conflicting labels and incomplete terminal points.
9. **Release** — only a signed-off source-backed chart graph can enable simulator
   QA routing; WGS84 georeferencing and real flight use require separate validation.

The deterministic gatekeeper is `web/taxi-adc-workflow.js`.
It accepts the workflow input, splits reviewed traces into graph edges at reviewed
junctions, checks missing stands/taxiways, runway connectors, hold points and
cross-page review, then emits an explicit state + next pending action.
It **never upgrades raw candidate data**.

## Review inputs

`web/tools/adc_workflow_cli.cjs` accepts `--review REVIEW.json` with
`airport,cycle,sourceSha256,traces,junctions,runwayGates,pageLinks,releaseReviewed`.
The source fingerprint must match the very PDF being reviewed. Each trace must
have `id,page,kind,label,points:[[x,y],...],sourceDrawingIds,source:"SOURCE_PDF",reviewed:true`.
Kinds: `taxiway`, `stand-lead`, `runway-axis`, `runway-connector`.

Every approved junction has `id,page,point,touches:[traceId,traceId],reviewed:true`.
A runway gate requires a reviewed taxi→connector→axis contact **plus** explicit
hold and runway contact points; a drawn physical crossing is not clearance.
Every inter-page portal has to specify exact page identities and corresponding
reviewed junctions; an estimated alignment never authorizes a taxi link.

Run a review again after each source correction:

```bash
node web/tools/adc_workflow_cli.cjs --survey web/data/taxi-surveys/OIII.json \
  --review reviewed-OIII.json --out build/adc/OIII
```

`NEXT_ACTIONS.md` provides the next unresolved phase; `workflow_report.json`
is machine-readable. `approved-chart-graph.json` appears **only** when every
safety/geometry gate passes and `releaseReviewed:true` is supplied.

## Additional native-vector topology QA

The one-command scanner now also runs `adc_graph_proposals.py` to examine
**both** endpoint and interior contacts between source-PDF candidate strokes.
Each result records exact page-local PDF coordinates, original source drawing
IDs, and a gap. All 326 OIII candidate contacts remain `reviewed:false`.

The report includes top nearby source strokes for **all 53 stand numbers**
and **40/43 taxiway labels**. For C3, K and V the ink centerline filter is
insufficient. `adc_pavement_fallback.py` provides source drawing IDs of the
gray pavement polygons instead; an apron or grey filled runway boundary
cannot be used as a taxi centerline without separate tracing.

The reviewed gate schema requires a specific `runwayEnd`, such as `11L`.
A holding gate for `11L` may never be reused for reciprocal `29R`.
Intermediate runway-use tokens likewise need reviewed runway-direction
metadata rather than drawing along an arbitrary runway axis.

**Current release gates**: zero verified taxi links; zero published hold
gates; missing ADC-to-Parking affine registration. The extra candidate
output is not a navigable graph or a published route.

## Mehrabad cycle 2621: actual state

- **Source inventory:** 2 physical runway strips, 43 *distinct* taxiway identifiers,
  53 printed stand numbers across five aprons.
- **Native-vector proposals:** ADC p430: 62 candidate strokes/19 preliminary endpoint contacts; 20 full proximity/crossing proposals;
  Parking p432: 247 strokes/113 preliminary endpoint contacts; 306 full proximity/crossing proposals.
- **Approved source-graph edges:** zero at the time this queue was generated.
- **Missing:** reviewed stand lead-outs (53), named centerlines (43), true
  intersections, runway gate/hold-short geometry and common coordinate registration
  between ADC and parking. Some 10-9B drawing objects depict buildings or lettering.
- **Status:** `BLOCKED_INCOMPLETE_SOURCE_GRAPH`. A testable workflow, NOT a
  finished routeable Mehrabad chart.

**Non-interference rule:** no change is permitted to accepted CDFA, simulator
bridge, aircraft positioning or previously approved home visuals.
