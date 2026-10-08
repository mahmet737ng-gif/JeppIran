#!/usr/bin/env python3
"""
JEPPIRAN X-Plane 11.5 Web Bridge
Receives X-Plane mapping-app UDP (XGPS/XATT) on 49002 and publishes JSON over WebSocket.
Optional TLS: --cert cert.pem --key key.pem -> wss://
Requires: pip install websockets
"""
import argparse, asyncio, json, socket, ssl, struct, time
import websockets

latest = {"position": None, "updated": 0.0}
clients = set()

def cstr(data):
    return data.split(b"\0",1)[0].decode("ascii","ignore").strip()

def parse_xgps(data):
    # X-Plane mapping packet commonly starts XGPS0 and contains ASCII fields.
    # Support both tab/comma/space textual variants defensively.
    if not data.startswith(b"XGPS"):
        return None
    text=cstr(data[5:]).replace(",", " ").replace("\t"," ")
    vals=[]
    for part in text.split():
        try: vals.append(float(part))
        except ValueError: pass
    if len(vals) < 2: return None
    lon,lat=vals[0],vals[1]
    if not(-90<=lat<=90 and -180<=lon<=180): return None
    alt=vals[2] if len(vals)>2 else None
    track=vals[3] if len(vals)>3 else None
    gs=vals[4] if len(vals)>4 else None
    return {"lat":lat,"lon":lon,"alt":alt,"heading":track,"groundspeed":gs}

def parse_data(data):
    # Optional X-Plane DATA output fallback: groups are index + 8 little-endian floats.
    if not data.startswith(b"DATA\0"): return None
    out={}
    off=5
    while off+36<=len(data):
        idx=struct.unpack_from("<i",data,off)[0]
        vals=struct.unpack_from("<8f",data,off+4)
        # Common X-Plane DATA indexes: 17 pitch/roll/heading, 20 lat/lon/alt.
        if idx==20:
            out["lat"],out["lon"],out["alt"]=float(vals[0]),float(vals[1]),float(vals[2])*0.3048
        elif idx==17:
            out["pitch"],out["roll"],out["heading"]=float(vals[0]),float(vals[1]),float(vals[2])
        off+=36
    if "lat" in out and "lon" in out and -90<=out["lat"]<=90 and -180<=out["lon"]<=180:
        return out
    return None

class UdpProtocol(asyncio.DatagramProtocol):
    def datagram_received(self,data,addr):
        p=parse_xgps(data) or parse_data(data)
        if not p: return
        p["source"]="X-Plane 11.5"
        p["timestamp"]=int(time.time()*1000)
        latest["position"]=p; latest["updated"]=time.time()

async def ws_handler(ws):
    clients.add(ws)
    try:
        if latest["position"]: await ws.send(json.dumps(latest["position"]))
        while True:
            await asyncio.sleep(.2)
            p=latest["position"]
            if p and time.time()-latest["updated"]<5:
                await ws.send(json.dumps(p,separators=(",",":")))
    except Exception:
        pass
    finally:
        clients.discard(ws)

async def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--udp-port",type=int,default=49002)
    ap.add_argument("--host",default="0.0.0.0")
    ap.add_argument("--ws-port",type=int,default=8765)
    ap.add_argument("--cert")
    ap.add_argument("--key")
    a=ap.parse_args()
    loop=asyncio.get_running_loop()
    await loop.create_datagram_endpoint(lambda:UdpProtocol(),local_addr=(a.host,a.udp_port))
    ctx=None
    if a.cert and a.key:
        ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(a.cert,a.key)
    scheme="wss" if ctx else "ws"
    print(f"JEPPIRAN bridge listening: UDP {a.udp_port} -> {scheme}://0.0.0.0:{a.ws_port}")
    async with websockets.serve(ws_handler,a.host,a.ws_port,ssl=ctx,ping_interval=20,ping_timeout=20):
        await asyncio.Future()

if __name__=="__main__":
    asyncio.run(main())
