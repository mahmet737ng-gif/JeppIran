# JEPPIRAN airport-card design lock — Template 2
Approved in the 2026-10-09 discussion; implemented 2026-10-11.

Scope: ONLY the airport name cards in the Charts left sidebar.
Appearance: deep navy/light-ice airport-diagram blueprint, delicate chart grid,
runway vectors and route motifs, per-ICAO variation. Existing text, size, list
structure, search, tree, chart viewer and airport profiles remain unchanged.

Data: each airport's runway directions in `data/airport-runways.json`
(ADC-derived metadata); if none exists, show a neutral decorative grid/compass.
These banners do not constitute georeferenced ADCs or taxi instructions.

Future airports: load their ICAO automatically and use the same generator.
Whenever validated ADC runway metadata for that ICAO is added to the data
file, the decorative background automatically reflects it next launch.
Adding charts must not require hand-coded per-airport UI changes.

FROZEN DESIGN CONTRACT: do not change `airport-adc-banners.css` or the visual
output of `airport-adc-banners.js` in future cycle updates without explicit
user approval. Keep the approved Home ILS artwork in `web/home-art/` and the
Home layout/buttons completely untouched. Data may evolve each cycle.
