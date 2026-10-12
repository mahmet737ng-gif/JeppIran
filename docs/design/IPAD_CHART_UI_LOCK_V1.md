# JEPPIRAN — iPad Chart UI / Appearance Lock V1
Owner-approved specification (2026-10-12). Do not modify these behaviors or the Home ILS background image assets without express owner approval.

- iPad web/PWA: a single tap on actual chart content enters/exits chart fullscreen (iPad CSS fullscreen fallback works even without native fullscreen API). Double tap still toggles 100%/200% chart zoom. Dragging, swiping, pinch-zoom, interactive buttons and map overlays must never toggle fullscreen.
- Chart panning follows the finger exactly. After lift, only a **90ms maximum, 2.5px maximum** eased stop is allowed: this must not behave as kinetic fling/inertia. Normal zoom vertical scrolling remains usable.
- Chart toolbar remains above the PDF and scrolls horizontally if necessary on narrow iPad screens. The chart INVERT toggle uses the same matte button style as TAXI/CDFA and changes only the displayed PDF colors, never source PDFs or geo positions. Restore by tapping again. Persist the preference.
- Home > Settings presents explicit Light Mode / Dark Mode selections, synchronizes with header toggle, persists across visits. Light/dark Home ILS backgrounds are the four previously approved portrait/landscape PNGs. Never regenerate, edit or replace those assets absent approval.
- Existing CDFA locked side table, taxi model and simulator transport must not change as collateral to this iPad UI task.

Release guard: `node --test tests/ipad-chart-ui-locked-v2621.test.cjs` runs in the iPad Pages workflow.
