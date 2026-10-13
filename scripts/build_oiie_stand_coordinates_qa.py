#!/usr/bin/env python3
"""Extract native Jeppesen OIIE 20-9D rounded/grouped INS stand coordinates.
Coordinates printed as a group are NOT individual stand nose positions.
A cross-chart printing anomaly never automatically becomes a corrected value.
"""
import argparse, hashlib, json, re
from pathlib import Path
import fitz

def scan(path):
    raw=Path(path).read_bytes()
    pdf=fitz.open(stream=raw,filetype="pdf")
    matches=[i for i in range(len(pdf)) if
             "OIIE/IKA" in pdf[i].get_text() and "20-9D" in pdf[i].get_text()]
    if len(matches)!=1:
        raise RuntimeError(f"OIIE 20-9D unique page required; matches={matches}")
    words=pdf[matches[0]].get_text("words",sort=True)
    rows=[]
    for area,anchor_x,label_range in [
        ("PASSENGER",207,(95,190)),("CARGO_SALAM",427,(325,405))
    ]:
        for anchor in words:
            if (anchor[4]!="N35" or abs(anchor[0]-anchor_x)>1
                    or not 115<anchor[1]<530):
                continue
            y=anchor[1]
            def terms(lo,hi):
                return [v[4] for v in words if abs(v[1]-y)<1.1 and lo<v[0]<hi]
            lat=terms(anchor_x+20,anchor_x+46)
            lon=terms(anchor_x+70,anchor_x+101)
            names=terms(*label_range)
            if not lat or not lon or not names:
                raise RuntimeError(f"Missing table fields {area} row y={y:.1f}")
            latitude,longitude=lat[0],lon[0]
            if not re.fullmatch(r"\d{2}\.\d",latitude) or not re.fullmatch(r"\d{2}\.\d",longitude):
                raise RuntimeError(f"Printed minutes unparseable: {lat}, {lon}")
            section=("PASSENGER" if area=="PASSENGER" else
                     "CARGO" if y<300 else "SALAM")
            label=" ".join(names)
            flags=[]
            if section=="CARGO" and float(longitude)<9:
                flags.append("PRINTED_CARGO_LONGITUDE_CONFLICTS_WITH_20_9C_GRID")
            if "thru" in names or "," in label:
                flags.append("COORDINATE_PUBLISHED_FOR_GROUP_NOT_UNIQUE_STAND_NOSE")
            rows.append({
                "section":section,"printedStandGroup":label,
                "latitudeText":"N35 "+latitude,"longitudeText":"E051 "+longitude,
                "printedWGS84":[35+float(latitude)/60,51+float(longitude)/60],
                "page":384,"sourceRowY":round(y,2),
                "latitudeResolutionMin":.1,"longitudeResolutionMin":.1,
                "unverifiedStandNose":True,"warnings":flags
            })
    rows.sort(key=lambda r:(r["section"],r["sourceRowY"]))
    issues=[{"section":r["section"],"row":r["printedStandGroup"],
             "raw":r["longitudeText"],"code":code}
            for r in rows for code in r["warnings"]]
    if len(rows)!=49:
        raise RuntimeError(f"Expected 49 OIIE coordinate rows, got {len(rows)}")
    if sum(i["code"]=="PRINTED_CARGO_LONGITUDE_CONFLICTS_WITH_20_9C_GRID"
           for i in issues)!=4:
        raise RuntimeError("Cargo source anomaly inventory unexpectedly changed")
    return {
        "schemaVersion":1,"airport":"OIIE","cycle":"2621",
        "publishedTable":"20-9D","page":384,
        "sourcePdfSha256":hashlib.sha256(raw).hexdigest(),
        "chartCoordinateSystem":"WGS84_APPROX_0.1_MIN",
        "suitableForStandNoseRouting":False,
        "autoCorrectCargoTypographicValues":False,
        "entryCount":len(rows),"entries":rows,"issues":issues,
        "note":"Rounded/grouped coordinates are not stand nose coordinates. Never silently correct printed chart source anomalies."
    }

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--pdf",required=True)
    ap.add_argument("--output",required=True)
    opts=ap.parse_args()
    data=scan(opts.pdf)
    target=Path(opts.output)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
    print("PASS OIIE 20-9D:",data["entryCount"],"coordinate rows,",
          len(data["issues"]),"review flags")
    print("Cargo longitude conflicts:",
          [i["row"] for i in data["issues"]
           if i["code"].startswith("PRINTED_CARGO")])
