# V2621 source ICAO ownership correction: Tabas, Birjand, Maku, Tabriz

Source PDF `Iran2621.pdf`, 1654 pages, source SHA256 `d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6`.

## Source page proof
- **Page 642:** physical ADC print header `OIMT/TCX`, `TABAS, IRAN`, Jepp `10-9`; **NOT OIMB Birjand**. An internal operational note mentions EOBT from OIMB APT, and this incidental line must never override actual plate ownership.
- **Page 851:** `OITU/IMQ`, `MAKU, IRAN`, `STAR 10-2`, **TBZ 1N ARRIVAL** (strip bracketed database code).
- **Page 852:** `OITU/IMQ`, `MAKU, IRAN`, `STAR 10-2A`, **TBZ 1P ARRIVAL**.
- **Page 853:** `OITU/IMQ`, `MAKU, IRAN`, `SID 10-3`, **TBZ 1A DEPARTURE**.

## Corrected airport bundle membership

| Airport | Old chart pages | New chart pages | Local PDF page |
|---|---:|---:|---|
| OIMB Birjand | 15 | 14 | Page 642 removed; real Birjand ADC page 561 remains |
| OIMT Tabas | 11 | 12 | Page 642 → 5 |
| OITT Tabriz | 23 | 20 | Pages 851-853 removed |
| OITU Maku | 3 | 6 | Pages 851 → 2 (STAR), 852 → 3 (STAR), 853 → 4 (SID) |

All **1642 indexed charts** retained; after regrouping every record's `pdf_page` must equal its position in `charts-manifest.json airpots[ICAO].global_pages` (actual key `airports`). Total airport bundles 78.

## Release details

Production GitHub commit `4565df3f3943` (check full commit SHA on GitHub) was created by a source-verified, fail-closed workflow (run [37998102194](https://github.com/mahmet737ng-gif/JeppIran/actions/runs/37998102194)). Four affected airport PDFs only published to [charts-V2621-tabas-maku-fix-1](https://github.com/mahmet737ng-gif/JeppIran/releases/tag/charts-V2621-tabas-maku-fix-1), with verified SHA256/size/print metadata scrub and the exact source PDF page frame preserved. Other airport files remain linked to charts-V2621-printclean-3; original `release_tag` unchanged for compatibility with the existing georeference asset.

The user also asked if Birjand `OIMB` and Saravan `OIZS` *new* ADC calibrations had been published. **They had NOT** been added to stable `chart-georef.json`/Web or APK: they are still provisional AIP-derived models and require independent marker/inset/survey verification. Their audit is `docs/audits/V2621/adc/OIMB_OIZS_official_AIP_10m_calibration.md` in this branch.

Do not confuse OIMT Tabas source ADC page 642 with OIMB Birjand source ADC page 561. Do not classify Maku source pages 851–853 by TBZ waypoint name as Tabriz (ownership source: OITU/IMQ header). Do not introduce accidental georeference or simulator changes.

NOT FOR ACTUAL NAVIGATION.
