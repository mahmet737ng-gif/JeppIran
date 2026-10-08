# JEPPIRAN FSX Bridge v1.4 — persistent web + Android connection

## Main Web App / iPad
Use the permanent JEPPIRAN URL:

`https://mahmet737ng-gif.github.io/JeppIran/`

Run **JEPPIRAN FSX Bridge v1.4** on the FSX PC. In JEPPIRAN open **Simulator / GPS → FSX**, enter any IPv4 address printed by the bridge, and tap **CONNECT FSX**.

The main HTTPS JEPPIRAN page stays open. The browser no longer needs to move to `http://PC-IP:8080`. FSX position is carried through the secure relay over standard WSS/HTTPS port 443 and remains active while navigating between Home, Charts and WX.

No iPad certificate or configuration profile is required.

## Android
The Android app can continue to use the PC IPv4 address and the bridge's local WebSocket path. Bridge v1.4 keeps the existing local connection compatible while also adding the secure relay used by the public Web App.

## Fallback local mode
The existing Local Web mode remains available for troubleshooting:

- Local JEPPIRAN: `http://PC-IP:8080`
- Local FSX WebSocket: `ws://PC-IP:8775`

## Notes
- FSX and Bridge v1.4 must remain running on the simulator PC.
- Secure Web Relay mode requires Internet access on the simulator PC and the Web App device.
- The relay transports simulator position data only.
