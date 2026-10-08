# JEPPIRAN FSX Bridge — Web + Android architecture

The FSX bridge reads the aircraft position from FSX through SimConnect and provides it to JEPPIRAN in two ways.

## iPad / Web
Safari cannot receive raw FSX UDP/SimConnect data directly.

Run JEPPIRAN FSX Bridge on the simulator PC and open the bridge's **Local Web** address on the iPad:

- Local JEPPIRAN: `http://PC-IP:8080`
- Local position WebSocket: `ws://PC-IP:8775`

The Local Web address serves the **same JEPPIRAN web application** through the simulator PC. It is not a separate reduced web app. Charts, WX, navigation and the simulator page remain part of the same JEPPIRAN interface; local mode only adds the FSX live-position transport.

No certificate, iPad profile, Python, or FSUIPC is required.

## Android / APK
The Android app does not need the Local Web page.

- JEPPIRAN listens directly on UDP **49012**.
- Open **Simulator / GPS → Microsoft Flight Simulator X (FSX)**.
- The page shows the Android device IPv4 address.
- Run JEPPIRAN FSX Bridge on Windows and enter that Android IP as the target.
- Aircraft position is then received directly by the APK.

## Ports
- TCP 8080 — same JEPPIRAN web app served locally for iPad/Safari
- TCP 8775 — FSX live-position WebSocket used by Local Web mode
- UDP 49012 — direct Android/APK FSX position

The simulator PC and iPad/Android device must be reachable from each other on the same LAN/hotspot. Windows Firewall should allow the bridge on Private networks.
