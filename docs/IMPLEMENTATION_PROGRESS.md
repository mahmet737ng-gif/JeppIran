# JeppIran implementation progress

This is a request checklist, not a claim that every feature is complete.
Baseline inspected: main at 40fd874fb2bd084502b75317538b7fc780be928d.
Work branch: fix/aircraft-position-lifecycle.

## Step 1: Aircraft Position

Code committed in 51b111b58b5d3d9a585efdd657e8c0d9d6c71cf1:
- Resynchronize the viewer toggle from the persistent preference on resume.
- Stop GPS and viewer simulator polling on pause.
- Clear cached GPS coordinates whenever GPS stops.
- Reject callbacks from stopped/replaced listeners with a generation counter.
- Block late permission callbacks while disabled or paused.
- Avoid repeated automatic permission prompts after denial.
- Remove a previous listener before registering another.
- Wait for a fresh GPS update instead of restoring an old last-known location.
- Do not fall back to phone coordinates while a simulator connection is active.

Validation: reviewed the diff and passed git diff --check.
No Android SDK or Gradle installation was found in this workspace.
Compilation and device behavior remain unverified. No APK was built for this change.
The simulator transport itself is unchanged; pausing the viewer does not disconnect it.

Final device checks:
1. OFF before opening a chart: no location prompt or marker.
2. ON with permission: receive a fresh location.
3. OFF while updates arrive, then ON: no old callback or cached fix reappears.
4. Background and resume, including rotation: listener is stopped and restarted without duplicates.
5. Deny permission: no automatic prompt loop; retry by toggling ON.
6. Change the preference in Settings and return: viewer reflects it.
7. Simulator connected without a fix: phone coordinates are not displayed.
8. Chart without valid georeferencing: no aircraft marker.

## Remaining sequence (inspect existing implementation before changing)

2. Real chart georeferencing: audit PDF control points and coordinate spaces,
   validate transforms/residuals, map onto cropped/rendered charts. Never invent coordinates.
3. Simulator connection: X-Plane, MSFS 2020/2024 and P3D guidance, actual transports/bridge,
   source selection, disconnect handling and position freshness.
4. Complete METAR display and error/loading behavior.
5. Annotation tools: Pen, Highlight, Text, Eraser; colors; text movement/resizing.
6. Navigation: swipe, previous/next, fullscreen, chart tree/categories and search.
7. Chart title corrections; airports sorted by ICAO with airport name and city.
8. Diagnose and improve download speed.
9. Logo, app icon and splash.
10. Dark mode/invert and portrait/landscape layout.
11. Build, fix actual compilation errors, deliver APK for final user testing.
12. Resolve final test findings and prepare release.

Other than Step 1's inspected paths, these items have not been audited in this work session.
User device testing is deferred until the final APK.
