# JEPPIRAN georeference engine – Owner-locked preservation rule

**Mandatory, for every airport and every SID, STAR, ADC and APP:** If a chart already has a georeference, no later calculation, merge, override, extraction, version change or application update may silently delete, reset, overwrite or replace it.

- **Same exact AIRAC source (PDF SHA-256, page count and chart cycle):** strict append-only models. Every previously approved page record (GCPs, map bounds, source fingerprint, masks and QA metadata) must be present *unchanged*. Repeated identical additions are safe no-ops. Conflicts stop publication.
- **Different AIRAC PDF:** retain the original complete asset byte-for-byte in `docs/georeferencing/archived-sources/georef-<hash>.json`. Revalidate chart identity and PDF source fingerprint before activating any map for the new PDF. Do not move old page coordinates to the new PDF blindly.
- **Before Web/Android publication:** compare the *entire* georeference records against the previously approved Git commit and require Web and Android data to match. Any lost/changed page fails release.
- **NOT TO SCALE:** retain any already approved geographically accurate portion, masking only unscaled insets. A wholly schematic chart is not accurately georeferenced just because a named fix has WGS-84 coordinates.
- **Audit:** Report previous and new chart count, additions, and an exact comparison of every old record.

Archive a previously approved source before deliberate cycle migration with `python3 scripts/georef_preservation.py --archive-ref HEAD`, commit the resulting archive, then perform source-specific QA. Deleting an approved archive is forbidden.

## Ilam OICI baseline investigation

The ordinary STAR page 207 (ALTET 1N/1P) and SID page 209 (ALTET 1A/1B) are explicitly NOT TO SCALE in V2621. Their georeferences were **already absent in the very first V2621 production asset** and likewise not present as those ordinary procedures in the earlier V2620 chart georeference file. The six recently added OICI charts did not delete them. Do not invent whole-page transforms for these two schematics; assess source-backed local geometry separately when possible.
