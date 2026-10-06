# JEPPIRAN Final UI Redesign

This branch implements the approved visual references for the next JEPPIRAN version.

## Visual target
The airport list and chart viewer must match the two approved generated reference screens as closely as possible. Do not replace the look with generic Material UI or flat vector-only controls.

## Airport list
- Premium dark aviation background with photographic/illustrated depth.
- JEPPIRAN header and search.
- Airport card contains ICAO, airport name, city, country, flag, weather icon, METAR, flight category and chart counts.
- Flight category colors: VFR green, MVFR yellow, IFR blue, LIFR red.
- Counts for STAR / SID / AIRPORT / APP.
- Tapping each count opens that airport directly in that category.
- Sort options: ICAO, airport name, city, country; A-Z / Z-A.
- Region filtering including Middle East, East Europe, West Europe.
- Light theme keeps identical geometry/layout and assets, only palette changes.

## Chart viewer
- Approved premium blue/glass aviation styling.
- Correct airport/chart title layout.
- Back, bookmarks, search, previous/next, WX, aircraft position, theme/fullscreen controls use the approved graphical icon language.
- Pencil + pixel eraser only.
- Fullscreen by button and single tap; single tap again restores chrome.
- First entry into an airport chart automatically shows current cached/fetched METAR, then smoothly animates/collapses into the WX cloud/sun button.
- Chart itself remains the real PDF content.
- Existing aircraft marker/georef behavior remains intact.

## Notice
On first launch of every app version, block interaction with a mandatory disclaimer until AGREE.
Text:
This App is for personal use only.
DO NOT use for Actual Navigation.
Commercial and/or public use by individuals or legal entities, including flight schools, airlines, organizations, or any other commercial users, requires the developer's prior consent.

Checkbox:
I understand and don't show again

The acknowledgement is stored per versionCode, so every update shows it again.

## Implementation rule
Keep all buttons functional. Do not use the full-screen mockup as one static clickable image. Split graphical assets into reusable raster assets and layer real native controls/text over them where interaction or live data is required.
