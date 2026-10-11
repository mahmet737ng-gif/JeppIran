# JEPPIRAN CDFA_SIDE_TABLE_V1 — OWNER-LOCKED DESIGN
Cycle: 2621. Applies to web/iPad and native Android chart viewers.

Owner-approved visual contract (change only on explicit new approval):
- A fixed, physically separate right-hand column, **outside the PDF chart viewport**. Shrink the chart viewport while showing CDFA. NEVER draw CDFA/VDP markers, text, or tables over the chart pixels/PDF/Canvas.
- Exactly two columns: DME | ALT (ft). Large, legible, bold, tabular numbers. NO NOTE column.
- Light theme: black text/lines on WHITE. Dark theme: white text/lines on BLACK.
- For a computed, currently available VDP: create a correctly DME-sorted table row, e.g. "2.6 | VDP", with **no altitude in the VDP cell**. Do not copy example numbers into real data.
- Keep chart pan/zoom/scroll, gestures, simulator, GPS and existing approved home/airport designs functioning.
- CDFA model data is for *engineering/simulator QA*, **not approved for operational navigation**. Continue withholding blocked or unreconciled plates (2621 PDF pages 155, 705, 328, 541, 1155). Display of VDP is mathematical only, NOT a published or flight-approved point.

Implementations: web/cdfa-chart-panel.js; web/cdfa-locked.css; app/src/main/java/com/tareghmsr/jeppiran/CdfaQaDialog.kt and PdfViewerActivity.kt.
Regression enforcement: tests/cdfa-ui-locked-v2621.test.cjs runs before web Pages deploy. Android build must pass before its output is considered published.
