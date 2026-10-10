# JEPPIRAN V2621 — Flight-test visual acceptance addendum (2026-10-10)

Scope: marker-position QA on charts, NOT FOR ACTUAL NAVIGATION. Geographic coordinates remain derived ONLY from official State AIS/AIM AIP and the SHA256-matched original Jeppesen PDF, never from third-party services or simulator estimates.

## Owner-directed decision policy

1. A reported successful chart-specific flight test can be accepted as the **final USER VISUAL ACCEPTANCE** of aircraft marker positioning and behavior on that tested chart. It does not constitute a newly measured AIP control point and does not silently certify an unperformed independent AIP coordinate test.
2. Prefer recorded reproducible tests: page, ICAO, chartKey, source fingerprint, simulator/position source, UTC sample times, aircraft position and rendered marker location, tested approach/ground path and chart transitions, screenshots/log. Missing evidence is stated as missing, never invented.
3. The user changed the APP geometric screen to max 100 m, while ADC and airport layout remain max 10 m. Log flight-test visual acceptance separately from independent geodetic residuals.
4. A known invalid plan-view mask, NOT TO SCALE inset, wrong PDF page or ownership, implausible bounds (such as an unchecked entire 612x792-page bound), source fingerprint mismatch, or non-invertible transform is not fixed merely by user acceptance. Such parts remain blocked until corrected and retested.
5. User expressly authorized publication for OTHH after successful flight test, subject to the actual production asset being valid and chart-level release checks passing. Do not overwrite the original 776 existing georefs or functional FSX/X-Plane bridges inadvertently.

## OTHH approval record

The owner reports OTHH flight tests succeeded and QA was accepted. Record owner-reported visual acceptance, but no per-page flight track/log or measured marker residual was provided in the conversation. The statement is not evidence that every prospective map inset was tested.

Relevant original candidate pages: 1536, 1538, 1539, 1540, 1549, 1552, 1553, 1556, 1557, 1559, 1560, 1561.

- Page 1536: prior independent official AIP 4-control test max error 1.685 m; QA JSON still requires AIRAC/mask finalization.
- Page 1549: prior independent official AIP 4-control test max error 4.559 m; full source/mask QA remains.
- Other pages: provisional source-only models. Initial data includes full-page bounds and missing excluded inset masks on some APP plates. Such defects require repairs, not a label flip.

This documentation does NOT itself publish new georeferences or modify any app, PDF, simulator bridges, or production assets.
