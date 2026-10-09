# V2621 - 24 ADC source-level review (not navigation approved)

This report was calculated directly from the source PDF and the published index, using measured text/vector tick pairs; it does not approve a new app georeference.

| PDF page | index ICAO | printed ICAO | status | Grid points | Max residual (PDF pt) | Inset masks |
|---:|---|---|---|---:|---:|---:|
| 71 | OIBB | OIBB | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 118 | OIBL | OIBL | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 131 | OIBP | OIBP | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 211 | OICI | OICI | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 221 | OICK | OICK | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 264 | OIFM | OIFM | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 299 | OIFS | OIFS | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 342 | OIHH | OIHH | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 561 | OIMB | OIMB | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 622 | OIMN | OIMN | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 651 | OING | OINE | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 714 | OISR | OISR | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 751 | OISS | OISS | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 794 | OITL | OITL | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 808 | OITT | OITM | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 859 | OITZ | OITZ | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 961 | OIZS | OIZS | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 1001 | ORER | ORER | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 1368 | UGTB | UGTB | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 1388 | UGSB | UGSB | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 1472 | OMDW | OMDW | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 1536 | OTHH | OTHH | MEASURED_GRID_CANDIDATE | 8 | 0.072028 | 0 |
| 1580 | OPKC | OPKC | REJECTED_AUTOMATED_FIT_NEEDS_REVIEW | — | — | — |
| 1623 | OPIS | OPIS | MEASURED_GRID_CANDIDATE | 8 | 0.072012 | 0 |

## Release safeguard

No production files were changed. Every candidate requires visual inspection of control ticks, at least one independent geographic holdout, an inset-mask check, confirmation of true source ICAO, and acceptance testing before release.
Charts with NOT TO SCALE must not automatically be mapped.
Report the two incorrect index ICAOs separately, without silently treating them as missing georeferences.
