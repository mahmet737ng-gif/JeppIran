# JEPPIRAN OICK V2621 V2 georeferencing — published simulator overlay

OICK source-locked simulator overlay has been published additively in identical Web and native Android data files: `web/data/oick-georef-v2621.json` and `app/src/main/assets/oick-georef-v2621.json`. The existing `chart-georef.json` is preserved byte-for-byte, including OICK 220/224/225/226 and all OIII references.

Four new chart pages (218, 219, 221, 223), five independent geographic regions:
- 218 and 219: rotated STAR plans, conformal axis independently checked against KRD DVOR/DME.
- 221: ADC main scale plan with separately calibrated and prioritized parking inset; main map excludes inset rectangle.
- 223: ILS plan with the NOT TO SCALE box masked.

Original PDF SHA256: `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`. Independent KRD PDF residual: 0.47095, 0.49784, 0.28945 and 0.11311 points respectively. Parking inset uses four native printed grid controls; no independent navaid check. Original source PDF vector QA: https://github.com/mahmet737ng-gif/JeppIran/actions/runs/38648712632.

The browser source-verified overlay activates only for matching AIRAC/PDF/ICAO/chart-key/fingerprint, and never overwrites existing records. The local Android renderer loads the same file, uses strictly bounded regions and refuses extrapolation into other scales. Neither path is approved for actual navigation; this is an on-device simulator flight QA release, not a certified geographic map. Visual flight testing is still required.

Regression test: `node --test web/tests/oick-v2-georef.test.cjs`. Existing locked app UI and aircraft marker drawings remain unchanged.
