#!/usr/bin/env python3
"""Create an LTFM OSM-sourced ground centerline graph for SIMULATOR QA ONLY.

OpenStreetMap taxiways may differ from current AIP / Jeppesen; they are
NOT ATC clearances. Published output records verified:false explicitly.
"""
import json
import math
import os
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

AIRPORT = "LTFM"
CYCLE = "2621"
# Airport-specific bbox; 2026 cycle graph is OSM-sourced, not AIP QA-approved.
SOUTH, WEST, NORTH, EAST = 41.215, 28.615, 41.365, 28.872
ENDPOINTS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
]
QUERY = f"""[out:json][timeout:110];
(
  way["aeroway"~"^(taxiway|taxilane)$"]({SOUTH},{WEST},{NORTH},{EAST});
  node["aeroway"="parking_position"]({SOUTH},{WEST},{NORTH},{EAST});
  node["aeroway"="holding_position"]({SOUTH},{WEST},{NORTH},{EAST});
);
out body;
>;
out skel qt;"""


def fetch_osm():
    for server in ENDPOINTS:
        try:
            print("FETCH", server, flush=True)
            req = Request(server, data=urlencode({"data": QUERY}).encode("utf-8"),
                          headers={"User-Agent": "JeppIran-Simulator-Taxi-QA/1.0 (OSM attribution maintained)",
                                   "Content-Type": "application/x-www-form-urlencoded"})
            with urlopen(req, timeout=135) as r:
                raw = r.read(25 * 1024 * 1024)
                if r.read(1):
                    raise ValueError("Overpass response exceeded 25 MB")
                data = json.loads(raw)
            if not data.get("elements"):
                raise ValueError("Empty Overpass elements")
            print("FETCH_OK", server, "bytes", len(raw), "elements", len(data["elements"]), flush=True)
            return data, server
        except Exception as error:
            print("FETCH_FAILED", server, repr(error), flush=True)
    raise RuntimeError("No public OSM query endpoint returned data; do not publish a guessed graph.")


def meters(a, b):
    return math.hypot((a["lat"] - b["lat"]) * 111195,
                      (a["lon"] - b["lon"]) * 111195 *
                      math.cos(math.radians((a["lat"] + b["lat"]) / 2)))


def tidy_ref(s):
    s = str(s or "").strip().upper()
    s = s.replace("TAXIWAY", "").replace("TWY", "").strip()
    return re.sub(r"\s+", "", s)


def build(data, source):
    pts = {}
    way_list = []
    stands = []
    hold_positions = []
    for x in data["elements"]:
        if x["type"] == "node":
            if "lat" not in x or "lon" not in x:
                continue
            lat, lon = float(x["lat"]), float(x["lon"])
            if not (SOUTH <= lat <= NORTH and WEST <= lon <= EAST):
                continue
            key = "O" + str(x["id"])
            pts[key] = {"lat": round(lat, 8), "lon": round(lon, 8)}
            t = x.get("tags", {})
            if t.get("aeroway") == "parking_position":
                code = tidy_ref(t.get("ref") or t.get("name"))
                if code:
                    stands.append((code, key))
            elif t.get("aeroway") == "holding_position":
                hold_positions.append({"node": key, "ref": t.get("ref") or ""})
        elif x["type"] == "way" and x.get("tags", {}).get("aeroway") in ("taxiway", "taxilane"):
            way_list.append(x)

    taxi_edges = []
    route_nodes = set()
    refs = Counter()
    for w in way_list:
        tags = w.get("tags", {})
        raw_name = tags.get("ref", "") or tags.get("name", "")
        ref = tidy_ref(raw_name)
        if ";" in ref:
            # Keep only a primary label, never guess which split part applies.
            ref = ref.split(";")[0]
        if not re.match(r"^[A-Z0-9-]{1,16}$", ref):
            ref = "UNNAMED"
        seq = ["O" + str(n) for n in w["nodes"]]
        for a, b in zip(seq, seq[1:]):
            if a not in pts or b not in pts or a == b:
                continue
            d = meters(pts[a], pts[b])
            if d < 0.15 or d > 1100:
                continue
            taxi_edges.append({"from": a, "to": b, "taxiway": ref,
                               "bidirectional": tags.get("oneway") not in ("yes", "1", "true"),
                               "osmWay": w["id"]})
            route_nodes.add(a)
            route_nodes.add(b)
            if ref != "UNNAMED":
                refs[ref] += 1

    if len(route_nodes) < 100 or len(taxi_edges) < 100:
        raise RuntimeError("OSM does not contain sufficient centerline network.")

    # Dijkstra graph intersections use shared mapped OSM nodes, no speculative junctions.
    components = []
    connections = defaultdict(list)
    for e in taxi_edges:
        connections[e["from"]].append(e["to"])
        connections[e["to"]].append(e["from"])
    remains = set(route_nodes)
    while remains:
        root = remains.pop()
        part = {root}
        stack = [root]
        while stack:
            for nxt in connections[stack.pop()]:
                if nxt in remains:
                    remains.remove(nxt)
                    part.add(nxt)
                    stack.append(nxt)
        components.append(part)
    components.sort(key=len, reverse=True)
    main = components[0]
    # Keep only large connected component to avoid snapping position onto isolated data.
    edges = [e for e in taxi_edges if e["from"] in main and e["to"] in main]
    nodes = {p: pts[p] for p in sorted(main)}

    # IMPORTANT: Stand nodes are external to taxi centerline graph.
    # Only very close OSM parking nodes are linked for unverified SIM TEST routing.
    # Do not route any guessed longer turn into apron positions.
    links = {}
    disconnected = {}
    for code, sid in stands:
        if code in links or code in disconnected:
            continue
        p = pts[sid]
        near = min(main, key=lambda n: meters(p, pts[n]))
        d = round(meters(p, pts[near]), 1)
        if d <= 25:
            # Stand coordinate is not on the taxi centerline: path ends at nearest
            # mapped taxiway node, never draw unsafe "direct to stand" connector.
            links[code] = {"node": near, "distanceToPositionMeters": d,
                           "position": p, "connectorVerified": False}
        else:
            disconnected[code] = d

    required = ("A4", "B", "B8A", "B8B")
    print("TAXI_GRAPH_SUMMARY", json.dumps({
        "all_centerline_nodes": len(route_nodes), "all_edges": len(taxi_edges),
        "main_nodes": len(main), "main_edges": len(edges),
        "components": len(components), "largest_components": [len(c) for c in components[:8]],
        "named_ref_count": len(refs), "stand_total": len(stands), "stand_near_25m": len(links),
        "disconnected_stands": len(disconnected),
        "test_ref_coverage": {k: refs[k] for k in required},
        "example_refs": refs.most_common(60)
    }, separators=(",", ":")), flush=True)
    if len(refs) < 12:
        raise RuntimeError("Too few named taxiways; refuse to publish route graph.")

    return {
        "airport": AIRPORT, "cycle": CYCLE,
        "verified": False, "simulatorTestOnly": True,
        "coordinateSystem": "WGS84",
        "source": {"provider": "OpenStreetMap contributors", "license": "ODbL 1.0",
                   "attribution": "© OpenStreetMap contributors", "endpoint": source,
                   "retrievedAt": datetime.now(timezone.utc).isoformat(),
                   "surveyStatus": "Unverified against current official airport ADC; simulator QA only"},
        "nodes": nodes, "edges": edges,
        "stands": links,
        "unlinkedStandsCount": len(disconnected),
        "procedures": [],
        "coverage": {"nodes": len(nodes), "edges": len(edges),
                     "namedTaxiways": len(refs), "nearbyStands": len(links)}
    }


def main():
    data, source = fetch_osm()
    graph = build(data, source)
    dst = Path("web/data/taxi-networks/LTFM.json")
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(graph, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print("GRAPH_SAVED", dst, dst.stat().st_size, "bytes", flush=True)


if __name__ == "__main__":
    main()
