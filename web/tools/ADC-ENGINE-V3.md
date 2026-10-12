# JEPPIRAN ADC ENGINE v3.0 — automated phased conversion contract

The user-defined process is split into 9 ordered, checkable phases.

1. **DISCOVER:** identify ALL chart components, including ADC pages, a parking inset inside ADC, separate Parking/Docking diagrams, and taxi/pushback briefing pages from the same PDF/cycle.
2. **CLASSIFY:** distinguish printed taxiway names from hotspot labels such as `HS1`, stand IDs, runway designators and general chart symbols. A label is NOT a taxiway unless present in the verified airport inventory.
3. **EXTRACT:** extract every actual runway strip and ends, published dimensions, taxiway widths/lengths where verifiable, stand IDs/locations and page references. Unknown widths remain null; no invented values.
4. **TRACE:** extract and review all source-PDF centerlines, curves and stand leads, preserving original drawing IDs. Raster-only charts require a reviewed image tracing stage.
5. **CONNECT:** derive junction candidates, verify true physical links and build named dynamic adjacency; no shortcut just because two drawing lines are close.
6. **REGISTER:** align inset and separate Parking/Docking pages to the ADC with checked control points and bridge actual matching nodes.
7. **RESTRICT:** encode hold-short, one-way, runway gates, direction/backtrack, crossing and chart briefing rules. A crossing is never inferred as ATC authorization.
8. **TEST:** deterministically enumerate stand→runway and stand→stand routing where network scope permits; test reverse directions and automatically fill omitted intermediate taxiway labels ONLY via verified graph. Return failing node/edge diagnostics; do not claim success when a route is missing.
9. **RELEASE:** publish web/Android chart overlays and routeable files only after all hard gates pass, source cycle unchanged and review is explicitly approved.

Main module: `web/taxi-adc-engine-v3.js`.
- `classifyLabel()` handles HS/hotspot vs taxiway.
- `pages()` discovers separate chart areas.
- `graphQA()` validates graph-level reviewed geometry.
- `expand()` resolves connected intermediate taxiway steps, with no runway entry unless explicitly authorized.
- `randomTests()` is a deterministic reachability sampler; expand into exhaustive directional/constraint-aware checks before release.
- `evaluate()` yields the ordered to-do queue and next unresolved step.

This module is currently a **versioned candidate engine and regression-tested component**; it does not automatically certify incomplete Mehrabad source geometry, and is not switched on as an operational taxi router. All approved previous features remain unchanged.

Supported scope after geometry QA: stand→runway hold, runway exit→stand, stand→stand, runway exit→runway hold, current simulator position→stand, current simulator position→runway hold. The last four require verified start/exit nodes and matching directional restrictions.

Important limits: connectivity alone does not validate taxiway naming, turn restrictions, runway clearances, or aircraft performance. Source provenance and manual/verified QA are hard prerequisites, not bypassable by auto-generated tests.
