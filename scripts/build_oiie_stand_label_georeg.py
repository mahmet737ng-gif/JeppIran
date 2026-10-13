#!/usr/bin/env python3
"""Cross-register all 103 printed OIIE stand LABELS with regional Jeppesen grids.

Only labels are projected; actual nosewheel stop marks, lead-out curves and
physical taxi contacts must be independently approved. Explicit stand-table
rows are independently compared with chart geometry; grouped/rounded INS
coordinates are never treated as precise stand positions.
"""
import argparse, json, math
from pathlib import Path

MAP={
 "PASSENGER":{"page":382,"x":(-736.8335169786757,18499.99829702515),
              "y":(-598.7819714312784,5835.01130469973)},
 "CARGO":{"page":383,"x":(-600.1285689217696,14884.185996736778),
          "y":(-490.3714310782303,5618.528107743044)},
 "SALAM":{"page":383,"x":(-798.000030517593,21094.41970316607),
          "y":(-762.1199645996053,6317.870123290982)}
}
def to_geo(area,p):
    model=MAP[area]
    return [35+(p[0]-model["x"][1])/model["x"][0]/60,
            51+(p[1]-model["y"][1])/model["y"][0]/60]
def meters(a,b):
    rad=math.pi/180
    dlat=(a[0]-b[0])*111195
    dlon=(a[1]-b[1])*111195*math.cos((a[0]+b[0])/2*rad)
    return math.hypot(dlat,dlon)
def run(survey_path,review_path,table_path):
    survey=json.loads(Path(survey_path).read_text(encoding="utf-8"))
    review=json.loads(Path(review_path).read_text(encoding="utf-8"))
    table=json.loads(Path(table_path).read_text(encoding="utf-8"))
    if not(survey["airport"]==review["airport"]==table["airport"]=="OIIE"
           and str(survey["cycle"])==str(review["cycle"])==str(table["cycle"])=="2621"):
        raise RuntimeError("Airport/cycle identity mismatch")
    if survey["source"]["sha256"]!=review["sourceSha256"]:
        raise RuntimeError("Original PDF parent source mismatch")
    by_id={"ST"+s["id"]:s for s in survey["stands"]}
    labels={s["id"]:s for s in review["stands"]}
    if len(by_id)!=103 or len(labels)!=103 or set(by_id)!=set(labels):
        raise RuntimeError("Expected exact 103 original stand labels")
    table_by_single={}
    for r in table["entries"]:
        if r["printedStandGroup"].replace("R","").replace("L","").isdigit():
            table_by_single["ST"+r["printedStandGroup"]]=r
    positions=[]
    for sid,st in by_id.items():
        label=labels[sid];original_area=st["apron"]
        area="PASSENGER" if original_area=="PASSENGER_SOUTH" else original_area
        if area not in MAP or label["page"]!=MAP[area]["page"]:
            raise RuntimeError("Mixed stand region/page "+sid)
        p=label["labelPointPdf"]
        if len(p)!=2 or any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in p):
            raise RuntimeError("Invalid native PDF label position "+sid)
        geo=to_geo(area,p)
        if not (35.38<geo[0]<35.46 and 51.11<geo[1]<51.20):
            raise RuntimeError(f"Projected stand label lies outside OIIE: {sid} {geo}")
        ref=table_by_single.get(sid)
        difference=meters(geo,ref["printedWGS84"]) if ref else None
        status=("PRINTED_INS_CONFLICT" if difference is not None and difference>300
                else "LABEL_REGISTERED_INS_ROUNDED_CHECK" if ref else "LABEL_REGISTERED_GROUP_INS_NOT_UNIQUE")
        positions.append({"id":sid,"area":area,"surveyArea":original_area,"sourcePage":label["page"],
            "sourceOriginalDrawingId":label["nearestNativeDrawingId"],
            "sourceTextPdfPoint":p,"labelGeographicWGS84":geo,
            "sourcePointIsParkingNose":False,"standLeadReviewed":False,
            "taxiConnectionApproved":False,"routeable":False,
            "printedINSGroup":ref["printedStandGroup"] if ref else None,
            "printedINSDistanceToLabelMeters":round(difference,1) if difference is not None else None,
            "qaStatus":status})
    conflict_ids=[v["id"] for v in positions if v["qaStatus"]=="PRINTED_INS_CONFLICT"]
    if not set(["ST301","ST302","ST303","ST321"]).issubset(conflict_ids):
        raise RuntimeError("Four known Cargo printed longitude conflicts were not caught")
    return {"schemaVersion":1,"airport":"OIIE","cycle":"2621",
        "sourceSha256":survey["source"]["sha256"],
        "coordinateSystem":"WGS84_GRID_REGISTERED_PDF_LABELS_NOT_STAND_NOSE",
        "positions":positions,"count":len(positions),
        "publishedStandCoordinateRows":table["entryCount"],
        "suspectPublishedINSStandIds":conflict_ids,
        "reviewedStandLeadCount":0,"reviewedTaxiContacts":0,
        "approvedStandRoutes":0,"safeForNavigation":False,
        "note":"Printed labels georeferenced to the correct independent chart region. These positions are not parking nose coordinates."}
if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--survey",default="web/data/taxi-surveys/OIIE.json")
    ap.add_argument("--review",default="web/data/taxi-surveys/OIIE-3step-source-review-2621.json")
    ap.add_argument("--table",required=True)
    ap.add_argument("--output",required=True)
    a=ap.parse_args()
    data=run(a.survey,a.review,a.table)
    target=Path(a.output)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("OIIE registered",data["count"],"source label points; published INS conflicts:",
          data["suspectPublishedINSStandIds"])
    print("NO registered label converted to stand nose or taxi route.")
