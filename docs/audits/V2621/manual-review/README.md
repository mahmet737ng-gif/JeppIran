# First 26 pages: individual full-resolution visual audit

Date: 2026-10-09. PDF: `Iran2621.pdf` (1654 pages), sha256 d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6.

This is an isolated audit branch, **not a change to main or released chart metadata**.

Pages 1–26 were individually rendered and inspected at 162 DPI, including the printed ICAO, Jeppesen number, full page heading, procedure types and map graticule when present.

- AIRPORT 4, STAR 4, SID 5, APP 13.
- 13 charts already have source-bound georeferences in the released JSON.
- Pages 12 and 18 have two new proposed **measured-grid** georeferences. The NOT TO SCALE note is beside a separate upper-right schematic holding segment. Main plot has latitude and longitude vector ticks; its top-right schematic is conservatively masked. New references **must receive a second independent QA and on-device overlay test before any release**.
- Pages 13 and 16 currently have an overly broad full-page map extent. Proposed clipping to the plan frame awaits QA.
- The visible approach header on pages 10 and 11 says ILS Z / ILS Y. Current index adds LOC; that remains relevant in the briefing but should not be mistaken for the visible title.
- Pages 25 and 26: CAT C&D vs CAT A&B are distinct and must not be deduplicated.
- The previous 1654-page automated index is NOT a substitute for this individual large-image inspection. The next unreviewed page is **27**.
- Not for actual navigation.
