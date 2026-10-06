# JEPPIRAN simulator bridges

X-Plane 11/12 connects directly from the Android app over RREF/UDP and needs no desktop bridge.

MSFS 2020/2024 and Prepar3D use their managed SimConnect SDKs on Windows. These bridges read the user aircraft latitude, longitude, altitude in meters, and true heading, then send JSON by UDP to JEPPIRAN.

## MSFS 2020 / 2024

Set `SIMCONNECT_MANAGED_DLL` to the SDK copy of `Microsoft.FlightSimulator.SimConnect.dll`, then build:

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

The Android device and simulator PC must be reachable on the same LAN. Allow the selected UDP port through Windows Firewall. JEPPIRAN shows the Android device IPv4 address on the Connect to Simulator screen.

Wire format:

```json
{"lat":35.6895,"lon":51.3130,"alt":1280.0,"heading":270.0}
```
