# JEPPIRAN X-Plane 11.5 Web Bridge

The iOS/iPadOS PWA cannot open a raw UDP socket. This bridge receives X-Plane UDP on the Windows PC and streams aircraft position to the JEPPIRAN web app over WebSocket.

## Windows quick start

1. Install Python 3.
2. Open Command Prompt in this folder.
3. Run:
   `python -m pip install websockets`
4. In X-Plane 11.5: Settings -> Network -> iPhone, iPad and External Apps -> enable broadcast to mapping apps.
5. Allow UDP 49002 and TCP 8765 through Windows Firewall.
6. Run:
   `python xplane_web_bridge.py`
7. In JEPPIRAN Web -> Simulator / GPS, enter:
   `ws://YOUR-PC-IP:8765`

## iPhone/iPad HTTPS note

GitHub Pages is HTTPS. Safari can block an insecure `ws://` connection from an HTTPS PWA. For iOS, use a trusted TLS certificate and run:
`python xplane_web_bridge.py --cert cert.pem --key key.pem`
Then connect with `wss://YOUR-HOSTNAME:8765`.

Device GPS does not need this bridge.
