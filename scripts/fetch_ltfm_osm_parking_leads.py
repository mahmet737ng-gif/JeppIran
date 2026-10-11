#!/usr/bin/env python3
"""Collect existing OSM parking-position ways AND nodes omitted by earlier LTFM
query. A referenced way may contain real parking-lead-in centerline geometry.
Exact shared taxi-graph OSM node IDs are evidence of physical OSM continuity.
All output remains simulator QA and must NOT be called Jeppesen/AIP-verified.
"""
import json,re,sys,time,math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen,Request
from datetime import datetime,timezone

BBOX="41.215,28.615,41.365,28.872"
SERVERS=[
 "https://overpass.private.coffee/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter",
 "https://overpass.nchc.org.tw/api/interpreter",
 "https://overpass-api.de/api/interpreter",
 "https://overpass.osm.ch/api/interpreter"
]
QUERY=f"""[out:json][timeout:110];
(
  node["aeroway"="parking_position"]({BBOX});
  way["aeroway"="parking_position"]({BBOX});
);
out body;
>;
out skel qt;"""
def read_net(path):return json.loads(Path(path).read_text(encoding="utf8"))
def fetch():
    fail=[]
    for server in SERVERS:
        try:
            payload=urlencode({"data":QUERY}).encode()
            request=Request(server,data=payload,headers={
                "User-Agent":"JEPPIRAN-SIM-TAXI-OSM-Parking-QA/1.0",
                "Content-Type":"application/x-www-form-urlencoded"})
            with urlopen(request,timeout=145) as response:
                raw=response.read(15_000_000)
                if response.read(1):raise ValueError("Overpass reply too large")
            data=json.loads(raw)
            if "elements" not in data:raise ValueError("Invalid response")
            return data,server
        except Exception as e:
            fail.append(server+": "+str(e))
            print("FETCH ERROR",fail[-1],flush=True)
    raise RuntimeError("No reliable OSM response; do not produce invented parking ways: "+"; ".join(fail))
def ref(s):
    value=str(s or "").strip().upper().replace("PARKING POSITION","").replace("STAND","").strip()
    return re.sub(r"\s+","",value)
def meters(a,b):
    lat=(a["lat"]+b["lat"])/2
    return math.hypot((a["lat"]-b["lat"])*111132,
          (a["lon"]-b["lon"])*111320*math.cos(math.radians(lat)))
def build(source,network,registry,endpoint):
    allnodes={x["id"]:{"lat":x["lat"],"lon":x["lon"]}
              for x in source["elements"] if x["type"]=="node" and "lat" in x}
    rawways=[x for x in source["elements"] if x["type"]=="way" and
             x.get("tags",{}).get("aeroway")=="parking_position"]
    rawpoints=[x for x in source["elements"] if x["type"]=="node" and
             x.get("tags",{}).get("aeroway")=="parking_position"]
    known=set(registry["stands"])
    graphNodeIds=set(network["nodes"])
    matches={};missing=[];unrecognized=[]
    for way in rawways:
        tags=way.get("tags",{});name=ref(tags.get("ref") or tags.get("name"))
        seq=["O"+str(n) for n in way.get("nodes",[])]
        coords=[allnodes.get(n) for n in way.get("nodes",[])]
        if len(seq)<2 or any(v is None for v in coords):continue
        if any(meters(a,b)>300 for a,b in zip(coords,coords[1:])):continue
        shared=[n for n in seq if n in graphNodeIds]
        # Only a shared exact OSM vertex proves the parking way touches the
        # taxi graph. Mere proximity never creates a physical connector.
        entry={"stand":name,"osmParkingWay":way["id"],"osmNodes":seq,
          "geometry":[[float(p["lon"]),float(p["lat"])] for p in coords],
          "sharedTaxiGraphNodes":shared,"exactGraphNodeJoin":bool(shared),
          "exactStandNameMatch":name in known,"directionVerified":False,
          "pushbackGeometryJeppesenVerified":False,"routingApproved":False}
        if name in known:matches.setdefault(name,[]).append(entry)
        else:unrecognized.append(entry)
    pointmatch={}
    for node in rawpoints:
        tags=node.get("tags",{})
        name=ref(tags.get("ref") or tags.get("name"))
        item={"position":{"lat":float(node["lat"]),"lon":float(node["lon"])},
          "osmNode":"O"+str(node["id"]),
          "onTaxiGraph":"O"+str(node["id"]) in graphNodeIds,
          "routingApproved":False}
        if name in known:pointmatch.setdefault(name,[]).append(item)
        else:missing.append({"osmNode":"O"+str(node["id"]),"ref":name})
    return {"airport":"LTFM","cycle":"2621",
      "kind":"original-osm-parking-position-way-centerlines",
      "retrievedAt":datetime.now(timezone.utc).isoformat(),
      "coordinateSystem":"WGS84",
      "source":{"provider":"OpenStreetMap contributors","license":"ODbL 1.0",
                "endpoint":endpoint},
      "simulationOnly":True,"routingApproved":False,"verifiedForNavigation":False,
      "warning":"Exact OSM node join is geometrical, not a Jeppesen-validated pushback, aircraft type restriction, ATC clearance or taxi authorization.",
      "matchedStandWayGeometries":matches,"matchedStandPointGeometries":pointmatch,
      "unmatchedOsmParkingWays":unrecognized,
      "unmatchedOsmParkingNodes":missing,
      "stats":{"allOsmParkingWays":len(rawways),"allOsmParkingNodes":len(rawpoints),
        "namedStandWaysMatchingChart":len(matches),
        "namedStandPointsMatchingChart":len(pointmatch),
        "exactGraphJoinedStandWays":sum(bool(entry["sharedTaxiGraphNodes"])
                 for rows in matches.values() for entry in rows),
        "unmatchedOsmParkingWays":len(unrecognized),
        "unmatchedOsmParkingNodes":len(missing)}}
if __name__=="__main__":
    if len(sys.argv)!=4:raise SystemExit(
      "Usage: fetch_ltfm_osm_parking_leads.py network.json stand-registry.json output.json")
    net=read_net(sys.argv[1]);registry=read_net(sys.argv[2])
    assert net["airport"]==registry["airport"]=="LTFM"
    data,url=fetch()
    result=build(data,net,registry,url)
    dst=Path(sys.argv[3]);dst.parent.mkdir(parents=True,exist_ok=True)
    dst.write_text(json.dumps(result,separators=(",",":"))+"\n",encoding="utf8")
    print("OSM_PARKING_QA",result["stats"],flush=True)
