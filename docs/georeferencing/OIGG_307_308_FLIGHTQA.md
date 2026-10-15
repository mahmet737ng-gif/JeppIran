# OIGG Rasht STAR 307/308 — simulator flight QA ONLY

## Why these two STARs were missing

The normal stable georeference extraction rejected source pages 307 (KOBUB 1N / 1P) and 308 (KOBUB 1Q). Original JEPPIRAN V2621 PDF SHA-256: `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`. The printed longitude grid and the original vector drawing symbol centres for RST VOR and KOBUB have independent differences of ~700–940 metres. The earlier source-QA report correctly rejected them for general-purpose calibrated navigation. This is not proof of real-world metre accuracy.

## Owner-requested test-only publication

Additive experimental overlay `web/data/oigg-star-flightqa-v2621.json` and the identical Android asset file. Two chart pages, source fingerprint locked:
- p307 `a40a3de145df915dd71dcec063477726c6eb31adb0284b12e426f1c6794a81b9`
- p308 `ceb66c6a644da4d000d9d23a4121c73be70542a54f0e3e0037537b716a921b81`

The provisional local WGS84 similarity registration pins original PDF vector symbols of the RST VOR and named KOBUB fix to their recorded locations; other PDF positions are interpolation/extrapolation subject to unresolved scale inconsistencies. Four calculated GCPs per page are from **only two real-world anchors** — **not four independent measured positions**. The reported independent graticule conflict remains explicitly present in metadata.

**Unsafe for real navigation. Only simulation / flight-testing, and positions may be displaced by approximately 1 km or more.** A 700–940m source-grid mismatch is a rejection of accuracy certification, not a margin of safety.

On the Web/PWA, the existing experimental georeference toggle controls this layer and the viewer draws a conspicuous source-grid-mismatch warning for either STAR. On native Android, the old approved baseline stays unchanged, the optional source-locked overlay loads only if chart source and fingerprint match, and both chart title/footer mark simulation-only QA.

Protection: `chart-georef.json` remains byte-for-byte unchanged in Web & Android. Approved OIGG charts 309 onward, and all original OIII records remain intact. No other airport touched.

Reproduce source validation: [GitHub original-PDF geometry QA](https://github.com/mahmet737ng-gif/JeppIran/actions/runs/38670180390) and `node --test web/tests/oigg-star-flightqa.test.cjs`.

Owner validation needed: compare RST, KOBUB and several additional independently surveyed fixes/thresholds on simulator route; do not promote to approved full-plan calibration until published grid inconsistency is resolved.
