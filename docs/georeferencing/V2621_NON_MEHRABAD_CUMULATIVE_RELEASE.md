# V2621 — Non-Mehrabad Georeference Release (Cumulative)

## Locked scope
- **No modifications to Mehrabad OIII**: 29 existing active georeference records were checked for exact equality, with **zero created, changed, or removed**. Neither region files nor existing OIII status records are modified by this release.
- Source locked to `Iran2621.pdf` SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.
- All chart geo sources remain marked **simulator QA only / NOT for actual navigation**. Independent flight checks are separate from source-fitting residual tests.

## Published additive chart records — **16 new non-OIII pages**
- OIGG Rasht: `309, 310, 313` (3)
- OIHH Hamedan: `342` (1, main airport diagram with independently excluded inset)
- OIIE Imam Khomeini: `365, 366, 369, 371, 379, 387, 389` (7, some with inset mask; two temporary ILS main map pages)
- OIKB Bandar Abbas: `444, 448, 454, 455, 459` (5, map-only with unscaled inset masks or parking graticule)
- **OIII Mehrabad: 0 changes.**

First 13 introduced by commit `279301e58c70`; 3 additional by commit `31b355b434bc`.
- New accepted georeference references were added to both `web/data/chart-georef.json` and `app/src/main/assets/chart-georef.json`.
- Third 10-airport batch: **136** previously/existing + newly calibrated of 216 total, compared with 120 prior to this non-Mehrabad release.
- Original 43 information-only/no-grid charts and 20 whole-sheet NOT TO SCALE charts were not given guessed transforms.

## 15 needing more independent control evidence (NOT published)
`307, 308, 323, 376, 386, 388, 446, 456, 457, 497, 498, 499, 500, 501, 502`

Two additional remaining source pages `428, 432` belong to **OIII Mehrabad** and were expressly excluded from this work. No status flips were performed on either.

## Verification and deployment
- [Georeference QA and additive release](https://github.com/mahmet737ng-gif/JeppIran/actions/runs/38503240859)
- [Web deployment](https://github.com/mahmet737ng-gif/JeppIran/actions/runs/38503382419)
- [Offline Android APK build](https://github.com/mahmet737ng-gif/JeppIran/actions/runs/38503365559)
- [Per-run source decisions](V2621_OTHER_AIRPORTS_EXCLUDING_OIII_RELEASE.json)

Android workflow may continue past APK packaging through direct-to-latest binary-delta publishing. The build job status, not the presence of artifacts alone, determines full workflow completion.
