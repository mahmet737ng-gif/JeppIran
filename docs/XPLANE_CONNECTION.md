# JEPPIRAN ↔ X-Plane connection

JEPPIRAN now supports two native X-Plane connection paths. No separate Windows connector is required for X-Plane 11 or X-Plane 12.

## Recommended: mapping-app broadcast

This is the zero-configuration path and mirrors the **Other Mapping Apps** section in X-Plane's Network settings.

1. Put the Android device and the X-Plane PC on the same Wi-Fi/LAN.
2. In X-Plane open **Settings → Network → iPhone, iPad and External Apps**.
3. Under **Other Mapping Apps**, enable **Broadcast to all mapping apps on the network**.
4. Open **JEPPIRAN → Settings → Connect to Simulator → X-Plane**.
5. JEPPIRAN listens on UDP **49002** and auto-connects when valid X-Plane/ForeFlight-compatible mapping packets arrive.

JEPPIRAN parses the native `XGPS` position packet and `XATT` attitude packet. The received simulator position is used by georeferenced charts instead of Android GPS while the simulator link is live. If the broadcast disappears, JEPPIRAN remains in listening mode and reconnects automatically when packets return.

## Advanced fallback: direct RREF

Use this only when broadcast packets are blocked by the router, guest Wi-Fi isolation, VPN, or firewall.

1. In X-Plane open **Settings → Network → UDP Ports**.
2. Note the exact value of **Port we receive on**. Do not assume it is 49000 if it has been changed.
3. In JEPPIRAN enter the X-Plane PC IPv4 address and that receive port.
4. Tap **Connect Direct**.

JEPPIRAN requests these X-Plane datarefs at 5 Hz:

- `sim/flightmodel/position/latitude`
- `sim/flightmodel/position/longitude`
- `sim/flightmodel/position/elevation`
- `sim/flightmodel/position/true_psi`
- `sim/flightmodel/position/groundspeed`
- `sim/flightmodel/position/theta`
- `sim/flightmodel/position/phi`

## Network behavior

- Recommended mapping port: UDP 49002.
- Direct RREF port: whatever X-Plane shows as **Port we receive on**.
- The app acquires the Android Wi-Fi multicast lock while listening, which improves reliability on devices that aggressively filter LAN broadcast/multicast traffic.
- Android GPS remains the fallback source when simulator position is not live.
- X-Plane does **not** require `simulator-bridge`; that folder remains only for MSFS and Prepar3D.
