# JEPPIRAN simulator bridges

## X-Plane 11 / 12 — no desktop bridge required

JEPPIRAN connects natively to X-Plane. The recommended path is X-Plane's built-in **Other Mapping Apps** broadcast:

1. X-Plane → Settings → Network → iPhone, iPad and External Apps.
2. Under **Other Mapping Apps**, enable **Broadcast to all mapping apps on the network**.
3. Open JEPPIRAN → Settings → Connect to Simulator → X-Plane.
4. JEPPIRAN listens on UDP 49002 and auto-connects from native `XGPS` / `XATT` mapping packets.

If broadcast is blocked, JEPPIRAN also has a Direct RREF mode. Enter the X-Plane PC IPv4 address and the exact **Port we receive on** value shown in X-Plane → Network → UDP Ports.

No X-Plane Windows connector is needed.

## MSFS 2020 / 2024

MSFS uses its managed SimConnect SDK on Windows. Set `SIMCONNECT_MANAGED_DLL` to the SDK copy of `Microsoft.FlightSimulator.SimConnect.dll`, then build:

```bat
set SIMCONNECT_MANAGED_DLL=C:\path\to\Microsoft.FlightSimulator.SimConnect.dll
msbuild msfs\JeppIran.MSFSBridge.csproj /p:Configuration=Release
msfs\bin\Release\net48\JeppIran.MSFSBridge.exe ANDROID_IP 49010
```

## Prepar3D v4 / v5 / v6

Set `P3D_SIMCONNECT_MANAGED_DLL` to `LockheedMartin.Prepar3D.SimConnect.dll` from the Prepar3D SDK:

```bat
set P3D_SIMCONNECT_MANAGED_DLL=C:\path\to\LockheedMartin.Prepar3D.SimConnect.dll
msbuild p3d\JeppIran.P3DBridge.csproj /p:Configuration=Release
p3d\bin\Release\net48\JeppIran.P3DBridge.exe ANDROID_IP 49011
```

For MSFS/P3D the Android device and simulator PC must be reachable on the same LAN. Allow the selected UDP port through Windows Firewall. JEPPIRAN shows the Android device IPv4 address on the Connect to Simulator screen.

Bridge wire format:

```json
{"lat":35.6895,"lon":51.3130,"alt":1280.0,"heading":270.0}
```
