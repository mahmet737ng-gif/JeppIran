# JEPPIRAN — iPad Chart UI / Appearance Lock V1
Owner-approved specification (2026-10-12). Do not modify these behaviors or the Home ILS background image assets without express owner approval.

- iPad web/PWA: a single tap on actual chart content enters/exits chart fullscreen (iPad CSS fullscreen fallback works even without native fullscreen API). Double tap still toggles 100%/200% chart zoom. Dragging, swiping, pinch-zoom, interactive buttons and map overlays must never toggle fullscreen.
- Chart panning follows the finger exactly. After lift, only a **90ms maximum, 2.5px maximum** eased stop is allowed: this must not behave as kinetic fling/inertia. Normal zoom vertical scrolling remains usable.
- Chart toolbar remains above the PDF and scrolls horizontally if necessary on narrow iPad screens. The chart INVERT toggle uses the same matte button style as TAXI/CDFA and changes only the displayed PDF colors, never source PDFs or geo positions. Restore by tapping again. Persist the preference.
- Home > Settings presents explicit Light Mode / Dark Mode selections, synchronizes with header toggle, persists across visits. Light/dark Home ILS backgrounds are the four previously approved portrait/landscape PNGs. Never regenerate, edit or replace those assets absent approval.
- Existing CDFA locked side table, taxi model and simulator transport must not change as collateral to this iPad UI task.

Release guard: `node --test tests/ipad-chart-ui-locked-v2621.test.cjs` runs in the iPad Pages workflow.

## V1.1 — Small exit X and interruption-free sessions (2026-10-12)
- In chart fullscreen show a compact **32×32 px** top-right X, not the long “Exit Fullscreen” label. Keep the accessible label and the single-tap-to-exit chart behavior.
- Do not forcibly reload on service worker controller changes, and do not force-activate a waiting service worker while a chart session is active. Pending updates activate after normal app close/reopen. Preserve map position, gestures, zoom and fullscreen.
- Preserve Home background originals and all prior owner-locked UI/CDFA/TAXI/simulator behavior.

## V1.2 Fullscreen CDFA and Find Me
Hide Find Me in fullscreen. Show the matching CDFA toggle next to Exit X only for an eligible chart. Reuse the owner-locked CDFA side panel without altering its calculations, layout or PDF.

## V1.3 Owner-approved CDFA chart whitespace, no shrink
The WEB/iPAD CDFA table uses only the existing blank margin between the
printed black frame and the original PDF's right edge, using an overlay *inside*
the chart transform. No additional column, resize, refit, change to PDF scale,
or toolbar CDFA button modification. Border clearance and right edge clearance
are required, and the margin must be visually blank. Under Settings Light the
table is white/black; under Dark it is black/white, independently of INVERT.
No change to CDFA altitude/VDP logic.

## V1.4 Owner-approved CDFA gestures
CDFA sits over the existing verified white right-hand PDF margin, but is now
an absolutely positioned child of `viewer-pane` rather than a child of the
pan/zoom-transformed chart layer. Horizontal viewer X stays pinned while the
chart pans left/right. The table follows vertical chart scroll/pan and supports
independent one-finger up/down drag. Two-finger pinch on CDFA zooms table type;
ctrl+wheel zooms table; plain wheel moves it up/down. Leave main CDFA toolbar
button and CDFA data/minima/VDP logic unchanged. Still no extra column,
shrink or PDF scale changes. Light and Dark use the previously selected colors.

## V1.5 — Plan View alignment and INVERT-only colors (2026-10-12)
The WEB/iPad CDFA table starts adjacent to the PLAN VIEW (beneath the bottom
full-width horizontal line of the Jeppesen briefing strip). Its X remains in
the existing paper-white margin outside the printed black chart frame and
inside the PDF page edge, with clearance. Do not shift PDF scale/layout or
change CDFA/VDP computations, toolbar or fullscreen controls, and retain
independent vertical drag and pinch zoom. The CDFA table follows INVERT:
INVERT OFF => black background/white text; ON => white background/black text.
The app's separate Light/Dark theme NEVER determines CDFA table colors.

## V1.6 — PDF-anchored CDFA and corrected inversion (owner override)
Supersedes earlier separate-table drag/zoom rules in V1.4 and color polarity
in V1.5. CDFA is an annotation placed at fixed local PDF coordinates inside
`chartTransformLayer`, aligned with the plan-view beginning in the existing
right paper margin. It MUST scale and pan with the PDF, like printed page text,
with no independent screen-fixed size, positioning, gesture handling or refit.
Touching/pinching CDFA must use chart gestures. INVERT OFF means white
background and black CDFA type; INVERT ON means black background and white
CDFA type. App Light/Dark theme never determines the colors. Keep the original
toolbar CDFA button, fullscreen CDFA/X buttons, data/VDP and chart unchanged.

## V1.7 — Crisp vector CDFA, centered in Plan View (2026-10-12)
The original calculated DOM table remains the source of every displayed
DME, altitude and VDP entry; the viewer now draws those labels and rules as
DOM-backed SVG vector text, not raster pixels, so pinch/double-tap zoom keeps
its legibility at all chart zoom levels. The CDFA table is enlarged to use as
much of the EXISTING paper gutter as possible, respecting the black printed
frame and outer paper edge. Its vertical center is aligned with the midpoint
between detected Plan View top and bottom rules (fallback bottom at 76% of
paper height). It remains a child of chartTransformLayer and zooms/pans in
precise synchrony with the printed PDF. INVERT OFF = white/black, ON =
black/white. No changes to toolbar, VDP ordering, data or PDF scaling.
