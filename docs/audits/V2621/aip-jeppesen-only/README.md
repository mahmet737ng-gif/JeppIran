# JEPPIRAN V2621 — All APP + airport layout re-audit, official AIP / Jeppesen only

Original Jeppesen PDF SHA256: \`d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6\`, 1654 pages.
THIRD-PARTY COORDINATES: **0 permitted**. Application/runtime GPS, FSX/X-Plane bridges and live chart-georef.json unchanged.

Indexed terminal charts: 1642; published georeference records: 776.
Eligible APP / ADC / airport layout & layout-review charts: **737**.
Records without strictly matched current-cycle chart georeference: **248**.

| Category | Eligible | Missing / identity mismatch |
|---|---:|---:|
| APP | 534 | 156 |
| ADC | 86 | 28 |
| AIRPORT_LAYOUT | 102 | 52 |
| AIRPORT_LAYOUT_REVIEW | 15 | 12 |

## Source-only candidate screening (NOT approval)

Provisional chart-grid/vector affine fits: **52**.
These do not pass official-AIP-independent 10 metre ground-point QA unless an official AIP point is checked separately.
Jeppesen general information coordinates are rounded; they are used only to disambiguate source tick labels, never as precise runway/ARP points.
All DME/radial labels are recorded as source-derived constraints only. Slant range is accepted as a 3D sphere; its 2D projected locus requires aircraft/fix and NAVAID elevation or an uncertainty bound.
Printed NOT TO SCALE may apply only to a separate inset; it requires scale-region marking before calibrating the primary plan view.

### Missing-page reason groups

- \`NOT_TO_SCALE_REQUIRES_SPECIFIC_PLAN_VIEW_REGION_QA\`: 92
- \`NO_PRINTED_GRATICULE_AIP_GCP_OR_RADIAL_DME_CONSTRAINTS_NEEDED\`: 53
- \`JEPP_VECTOR_GRATICULE_FIT_PROVISIONAL\`: 52
- \`VECTOR_GEOMETRY_REJECTED_PENDING_AIP_CONTROL\`: 46
- \`HEADER_OWNER_MISMATCH_REQUIRES_REINDEX\`: 5

### Source ICAO discrepancies flagged (check the printed header visually before changing index)

- PDF page 514: index OIKK / extracted printed header OIKM.
- PDF page 548: index OIKK / extracted printed header OIKY.
- PDF page 651: index OING / extracted printed header OINE.
- PDF page 808: index OITT / extracted printed header OITM.
- PDF page 896: index OIZH / extracted printed header OIZB.

### User's field-test outcomes

- Birjand OIMB, Hamadan OIHH, Bandar Lengeh OIBL: **successful hands-on tests**, not automatic certification for other plates.
- Saravan OIZS: **not field-tested**.

**RELEASE GATE:** 10 m maximum independently withheld AIP/Jepp ground-control 2D error; explicit PDF page identity and source vintage; navaid altitude/variation for slant range/radial; map/inset masks; confirmed marker projection. Release only after separately authorized approval.

**NOT FOR ACTUAL NAVIGATION**.
