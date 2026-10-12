# JEPPIRAN — Aircraft marker lock V1

Owner-approved on 2026-10-12. This is the thin-black-outline magenta arrow and
soft double-pulse design approved in `jeppiran-arrow-pulse-v2.gif`. Do not alter
its shape, palette, outlines, animation or fixed screen size without explicit
owner approval. Future unrelated releases must retain this contract.

- The arrow uses `M0-21 L11 15 L0 8 L-11 15 Z` in a `-24 -24 48 48` viewBox.
- Normal fill: `#ef1ca8`; black outline: `#101116`, 1.68 SVG units;
  white outside outline: 4.10 SVG units. Both are present on light/dark charts.
- Marker/SVG box: **32 × 32 CSS pixels on screen**, independent of chart zoom.
  The arrow occupies the inner part of this box; the pulse can extend outside it.
- Soft translucent magenta halo and two expanding/fading rings: 1.9-second
  cycle, second ring delayed 0.24 seconds. The arrow itself never pulses in size
  or opacity. The maximum ring diameter is about 47 CSS pixels at every zoom.
- Marker position remains anchored to the existing projected chart coordinate;
  rotation continues to use the existing georeferenced heading calculation.
  No position, heading source, bridge, georeferencing or chart data is changed.
- Exactly `1 / chartZoom` cancels the parent chart transform on **every** paint,
  including pinch, wheel/buttons, double tap and animated Find Me. The marker
  inherits that value; never shadow it with a local `1` or zoom-dependent clamp.
- App light/dark, chart inversion, fullscreen and orientation do not change the
  marker's shape, screen size, outlines or normal magenta color.
- Preserve existing route-deviation status: an active taxi deviation may turn
  the same marker red. It never changes geometry, size or positioning.
- Reduced-motion preference stops the rings and leaves the arrow visible.

Implementation: `web/aircraft-marker-locked.css`, `aircraftMarkerMarkup()` and
`aircraftMarkerScaleForZoom()` in `web/app.js`.

Release gate: `node --test tests/aircraft-marker-locked.test.cjs` in the Pages
workflow. It protects approved artwork and checks constant size through the
production paint function, not only at integer zoom stops. Updating the artwork
fingerprint requires a corresponding explicit owner-approved design revision.

The Pages workflow also runs `scripts/verify_aircraft_marker_browser.cjs` in
Chrome before publishing: 150 theme/heading/zoom combinations verify actual
rendered dimensions and chart anchoring, plus taxi alert and reduced motion.
