# JEPPIRAN airport profile posters — design contract (October 2026)

The user-approved appearance is the twilight/night aerial-style poster for each airport, with its own city landmark, readable IATA / ICAO labels, and the original profile layout unchanged.

- **FROZEN VISUAL CONTRACT:** never regenerate, overwrite, rename, recolor, or remap approved posters in future chart/data-cycle updates without the owner's explicit approval.
- OITR = Urmia / OMH. OITT = Tabriz / TBZ. Keep ICAO and IATA mappings correct.
- Images are AI-generated **decorative illustrations**. They are **not actual Google Maps imagery, certified ADCs, accurate georeferencing, or taxi navigational data**.
- Image assets are named by uppercase ICAO, e.g. `OIII.webp`, under this directory. The immutable bundle includes SHA-256 digests in its manifest.
- If a poster is absent, the web profile keeps its previous theme background. No missing or unverified image should be substituted with another airport.
- Keep the four approved Home ILS images and airport sidebar Template 2 entirely untouched.

**Deployment note:** This commit prepares the web runtime integration only. Binary poster files have NOT been inserted into GitHub through this connector; to activate, install the 40 `.webp` files from the verified poster ZIP in this folder. Do not mark visuals published until asset presence and Pages deployment are verified.
