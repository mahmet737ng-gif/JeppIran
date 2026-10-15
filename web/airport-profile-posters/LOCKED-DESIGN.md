# JEPPIRAN airport profile posters — design contract (October 2026)

The user-approved appearance is the twilight/night aerial-style poster for each airport, with its own city landmark, readable IATA / ICAO labels, and the original profile layout unchanged.

- **FROZEN VISUAL CONTRACT:** never regenerate, overwrite, rename, recolor, or remap approved posters in future chart/data-cycle updates without the owner's explicit approval.
- OITR = Urmia / OMH. OITT = Tabriz / TBZ. OICK = Khorramabad / KHD. OIFS = Shahrekord / CQD. Keep ICAO and IATA mappings correct.
- Images are AI-generated **decorative illustrations**. They are **not actual Google Maps imagery, certified ADCs, accurate georeferencing, or taxi navigational data**.
- Image assets are named by uppercase ICAO, e.g. `OIII.webp`, under this directory. The owner-locked in-repository manifest includes SHA-256 digests for all 50 posters.
- If a poster is absent, the web profile keeps its previous theme background. No missing or unverified image should be substituted with another airport.
- Keep the four approved Home ILS images and airport sidebar Template 2 entirely untouched.

**Deployment note:** All 50 final WebP poster assets are committed to this repository. The CI hash check verifies every file on every deployment.
