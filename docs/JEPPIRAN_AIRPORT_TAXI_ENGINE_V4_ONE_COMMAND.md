# JEPPIRAN Airport Taxi Engine V4 — One Command, One Final Result

## Non-negotiable execution contract

When the owner sends **START AIRPORT `ICAO` (cycle `YYNN`)**, the engine owns the *entire* airport job from source collection to full bidirectional simulator QA. The owner is **not** a manual task scheduler. No intermediate "5% done" conversational updates, partial success handoffs or requests to choose the next step. Run every stage sequentially without asking. Persist checkpoints and resume after recoverable interruption. Fix a detectable error, rerun the affected phases and the complete regressions. All approved independent features in JEPPIRAN remain unchanged.

**One and only positive completion condition:** the source-grounded routing engine can accept clearances between **every enumerated stand and every named runway hold in both directions**, at the original PDF-mapped centerlines, and passes 100% automatic coverage tests on the exact source cycle. Only then display: **READY FOR SIMULATOR TAXI CHECK — send your route**. Do not call an extracted inventory, plotted grid, source strokes, synthetic fixture test, regression job or finished runway-only preview a finished airport.

An unresolved problem is an **internal blocker**, not a reason to report success. If publication is impossible because evidence is insufficient, truthfully report **NOT READY / NOT PUBLISHED**, with specific unresolved evidence, rather than fabricate connections or imply the job is complete. It is impossible to guarantee that software can infer every real hold line unambiguously from arbitrary ADC PDFs; unsafe guessed lines shall never silently become approved routes. This is a simulator QA product and never an operational ground-navigation clearance.

## Required fully sequential automatic job

1. **Receive and fingerprint source.** Check original source chart and cycle, compare published PDF SHA256, fail on source mismatch or stale chart; enumerate all airport sections without relying on fixed PDF page numbers.
2. **Inventory layouts.** Locate ADC, additional runway information, every Parking/Stand/Docking subchart and every INS stand table, including multiple geographically independent figures inside one PDF page.
3. **Detect runways.** Read paired designators, distinguish the two physical black runway bodies and their published lengths, threshold orientation, stopways, backtrack-eligible centerline and allowed turn-around points.
4. **Build region-specific georeferences.** Fit published lat/lon grid control points separately for each chart region; compare independent controls, reject mirrored/out-of-region transforms, never share the entire page transform with an inset.
5. **Extract ALL identifiers.** Read all printed stands (including L/R and subgroups), taxiway letter/name, branch names, named hold points and runway connector labels; reconcile PDF text, original vector text and AIP/Jepp. Never confuse R1–R6 access labels with a physical centerline.
6. **Extract source geometry.** Parse native Bezier/vector paths, pavement islands, stand exit curves and white/grey taxi bodies; keep drawing IDs, stroke widths, original PDF points, geometry coordinates and source page/region for each candidate.
7. **Classify and recover true centerlines.** Use original graphics and label association, curve tangents, widths, chart context, nearby parking detail, and runway geometry. Reject leader lines, graticules, building edges, stand labels and pavement borders. No guessed straight chord substitutes for a curved centerline.
8. **Build individual stand lead-in/lead-out.** Identify actual nose/stop and the full drawn access trajectory, not the printed stand label. Attach every stand to its physically adjacent apron taxiway, preserving direction and pushback restrictions.
9. **Build named taxiway graph.** Split every accepted physical centerline at verified junctions; name each segment; recognize neighboring taxiway contacts; preserve topology through curves, tangencies, one-way restrictions and dead ends.
10. **Align and portal-link charts.** Use independent source-recognized matching physical features between ADC, Passenger, Cargo and Salam and audited transformations. Near endpoints or touching printer ink are *candidates*, not portals. Exclude crossings without actual ground connection.
11. **Mark each real hold short and runway access/exit.** For EVERY runway end, trace the taxi approach, published holding location, connector and physical runway centerline. Require explicit runway clearance and prevent accidental implicit crossings.
12. **Implement backtrack semantics.** `BT11L`, `BT29R`, `BT11R`, `BT29L` follow their particular runway centerline straight until a real exit, with 180-degree turns only at eligible runway ends, never through the space between parallel runways.
13. **Build geometric WGS84 graph.** Every routable edge must have original source-linked polyline, approved classification, exact matching junctions and valid ICAO/cycle provenance. Mark unresolved links BLOCKED, never automatically promote them.
14. **Parse clearances.** Support stand tokens `STxxx`, ordered taxiway tokens, `BTxx`, `H RWY`, direct stand-to-hold, reverse routes and named holding shortcuts. Reject unknown or disconnected tokens rather than returning an approximate invented path.
15. **Exhaustively test.** Iterate **every stand × every runway designator × both directions**, not just 3 sample stands, and require a source-backed route for each. Check every route's endpoints, whole polyline, named taxiways, turn restrictions, no implicit runway crossing, no omitted stand, no duplicate stand IDs, no unapproved page portal, no phantom junction and no wrong runway.
16. **Cross-check counterexamples.** Try routes through known disconnected line crossings, non-runway shortcuts, unknown stands, conflicting Cargo INS rows and one-way edges; all must correctly FAIL CLOSED. Compare PDF atlas geometry with the rendered route overlay.
17. **Autorepair loop.** Identify the offending stage from the QA failures, re-inspect original drawings/adjacent chart areas, recompute candidates, reclassify only with source evidence, regenerate graph, rerun ALL tests. Checkpoint intermediate machine artifacts; avoid duplicate processing. Never relabel unresolved edges as "verified" simply to satisfy a test.
18. **Release only 100% PASS.** Install the accepted graph and updated overlay into web/PWA and Android while retaining locked Home/CDFA/FSX/marker behavior. Validate Chrome and device build; actual GitHub Actions deploy must be successful. Source and cycle fingerprints must match shipped chart assets.
19. **Present final user message only.** Report exact total stands, taxiways, runway ends, `stands × ends × 2` tests, passes, version and successful deployment. At **100%**, invite the pilot: "Give me any taxi route in JEPPIRAN TAXI and test it in your simulator."
20. **Pilot simulator acceptance.** User checks meaningful samples in simulator and reports actual mismatches. Reopen the same airport job automatically for geometry correction and complete regression. Never translate automatic graph success into real-world aerodrome navigation approval.

## Completion coverage definition

For `S` distinct published stands and `R` runway designators, the minimal stand-to-runway test count is `S × R × 2`. Tests must pass in **both** stand → published hold-short and published hold-short → stand directions. The engine must also validate runway-only geometry, all named taxiways, apron region portals, explicit backtrack and disallowed crossings. A stand inventory lookup, source stroke count, or 2 successfully drawn runway centerlines count as **zero stand-to-runway routes**.

### OIIE source cycle V2621

- Original terminal PDF 1654 pages. OIIE: ADC 20-9 / global page 380, Parking 20-9B / 382, Cargo+Salam independent 20-9C / 383, INS coordinates 20-9D / 384.
- Inventory **103** printed stands and **4** runway designators `11L/29R`, `11R/29L`. Therefore **824 mandatory ordered stand↔runway checks**. Also verify taxiway and runway gate inventory.
- Four independent geo regions: ADC, Passenger, Cargo, Salam. p383 Cargo and Salam are distinct figures and must never share one transform.
- The 49 INS table rows often describe group positions, *not* exact parking-nose positions. Four printed Cargo rows `301/302/303/321` have a longitude inconsistency relative to the map grid; don't "correct" them without separate source support.
- The two published full runway axes passing dimensional QA are not hold short/access portals. Current 33 near-endpoint candidate page contacts are **not** confirmed cross-page taxi portals.
- OIIE shall remain **NOT_READY** until all 824 source-grounded directional routes, source-gated holds, page portals and physical stand leads pass. No early release or success message.

## Interfaces, state and failure policy

- Command: `START AIRPORT <ICAO> <CYCLE>`.
- Internal state machine: `SOURCE → INVENTORY → GEO → DRAWINGS → CLASSIFY → STANDS → GRAPH → GATES → PORTALS → TEST → REPAIR → PUBLISH → READY_FOR_SIMULATOR_TEST`.
- Durable machine checkpoint: source hash, cycle, source drawings and classifications, exact unresolved evidence, graph SHA256 and QA matrix. Recover interrupted work automatically from its last coherent step.
- Only terminal outputs: `READY_FOR_SIMULATOR_TEST` (100% pass, real deploy confirmed), `NOT_READY_SOURCE_BLOCKED` (source cannot be justified), `NOT_READY_BUILD_FAILED` or `NOT_READY_DEPLOY_FAILED`. Never equate pipeline execution success with airport routing completion.
- A local run does not continue after a ChatGPT conversation ends. The worker must be run in an external persistent runner (for example GitHub Actions or another server). GitHub Actions jobs have execution limits and cannot guarantee indefinite uninterrupted runtime; checkpoint/resume is mandatory. Inactivity or stalled evidence requires explicit non-success status rather than indefinite fake progress.
- Scope: **simulator taxi QA only**; not operational aircraft taxi guidance. Published Jepp/AIP diagrams, temporary restrictions, NOTAMs and ATC clearances supersede any simulator preview.

## Source code invariants

- `scripts/taxi-engine/gate100.cjs`: last-stage 100%-coverage test.
- `web/taxi-adc-workflow.js`: reviewed original-chart traces and contacts; never invent a portal.
- `web/taxi-engine.js`: airport-independent named-taxiway routing, explicit holds and BT segments.
- `scripts/taxi-engine/`: airport-independent onboarding and audit. No `if ICAO == ...` special routing geometry in core engine; place local source data in airport-specific registries.
