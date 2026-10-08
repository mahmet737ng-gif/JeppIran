# JEPPIRAN FSX Bridge v1.1 — certificate-free local mode

This bridge supports two outputs from one FSX/SimConnect source.

## Android / APK
- JEPPIRAN listens directly on UDP **49012**.
- The Android simulator page shows the device IPv4 address.
- Run the Windows bridge and enter that Android IP as the target.
- No Python, FSUIPC, certificate, profile, or extra Android file is required.

## iPad / Web
Safari cannot listen for raw UDP from FSX. To avoid installing a certificate, the bridge exposes JEPPIRAN through the simulator PC on local HTTP:
- Local Web: `http://PC-IP:8080`
- Local position WebSocket: `ws://PC-IP:8775`

Open the Local Web address in Safari. Because the page and WebSocket are both local HTTP/WS, no WSS certificate or iPad profile is required. JEPPIRAN detects port 8080 and automatically selects and connects the FSX source.

The normal GitHub Pages PWA remains available for non-simulator use.

## Ports
- TCP 8080 — local JEPPIRAN web proxy
- TCP 8775 — FSX live-position WebSocket
- UDP 49012 — direct Android/APK target

The PC and device must be on the same LAN/Wi-Fi, and Windows Firewall should allow the bridge on Private networks.
