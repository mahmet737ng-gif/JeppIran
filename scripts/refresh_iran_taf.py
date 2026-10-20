#!/usr/bin/env python3
"""Every scheduled run: preserve only currently valid Iranian TAF reports.

Prefer the public IRIMO HTML block 588 when reachable. NOAA is the fallback.
Input/output /tmp/wx-live.json (existing weather cache); output /tmp/taf-iran.json.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
from irimo_weather import UTC, TAF_ISSUE, TAF_VALID, candidate, extract, fetch_block, is_current

ROOT=Path(__file__).resolve().parents[1]
WX=Path("/tmp/wx-live.json")
OUT=Path("/tmp/taf-iran.json")

def load_device_reports(now):
    """Read the actual IRIMO HTML reports deposited by a reachable Windows PC.
    Only time-valid data fetched in the previous 15 minutes may replace NOAA.
    Missing/stale/invalid relay must silently leave NOAA in charge.
    """
    import re
    import urllib.request
    url="https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/irimo-cache/irimo-current.json"
    try:
        req=urllib.request.Request(url+"?v="+str(int(now.timestamp()//300)),
            headers={"User-Agent":"JEPPIRAN-IRIMO-Bridge-Reader/1.0"})
        with urllib.request.urlopen(req,timeout=8) as response:
            source=json.load(response)
        if source.get("schema")!="jeppiran-irimo-device/v1":return {}
        stamp=dt.datetime.fromisoformat(source["fetched_at"].replace("Z","+00:00"))
        age=(now-stamp.astimezone(UTC)).total_seconds()
        if age < -180 or age > 900:
            print("IRIMO device cache is older than 15m or future dated",flush=True)
            return {}
        result={}
        for code,record in source.get("stations",{}).items():
            if not re.fullmatch(r"OI[A-Z0-9]{2}",code) or not isinstance(record,dict):continue
            for kind in ("metar","taf"):
                raw=str(record.get(kind) or "").strip()
                prefix=(r"(?:METAR|SPECI)" if kind=="metar" else r"TAF(?:\s+(?:AMD|COR))?")
                if re.match(r"^"+prefix+r"\s+"+code+r"\s+",raw) and is_current(kind,raw,now):
                    result.setdefault(code,{})[kind]=raw
        print("Time-validated sourced IRIMO reports:",len(result),flush=True)
        return result
    except Exception as exc:
        print("IRIMO device bridge not available:",str(exc)[:130],flush=True)
        return {}

def taf_details(raw, now):
    issue=TAF_ISSUE.match(raw)
    if not issue: return None
    issued=candidate(*(int(n) for n in issue.groups()), now)
    validity=TAF_VALID.search(raw[issue.end():])
    if not validity: return None
    d1,h1,d2,h2=(int(n) for n in validity.groups())
    start=candidate(d1,h1,0,issued)
    end=candidate(d2,h2,0,start+dt.timedelta(hours=24))
    if end<=start:return None
    return issued.isoformat(),start.isoformat(),end.isoformat()

def build_rows(stations, codes, irimo, now):
    output,used=({},0)
    for code in sorted(codes):
        fallback=str(stations.get(code,{}).get("taf") or "").strip()
        primary=str(irimo.get(code) or "").strip()
        source,raw=None,""
        if primary and is_current("taf",primary,now):
            source,raw="IRIMO",primary
            used+=1
        elif fallback and is_current("taf",fallback,now):
            source,raw="NOAA",fallback
        info=taf_details(raw,now) if raw else None
        if not info:source,raw=None,""
        output[code]={
            "status":"available" if raw else "unavailable",
            "source":source,"raw":raw,
            "issued_at":info[0] if info else None,
            "valid_from":info[1] if info else None,
            "valid_to":info[2] if info else None,
        }
    return output,used

def main(no_irimo=False,now=None):
    now=(now or dt.datetime.now(UTC)).astimezone(UTC)
    manifest=json.loads((ROOT/"app/src/main/assets/charts-manifest.json").read_text())
    weather=json.loads(WX.read_text())
    stations=weather.get("stations")
    if not isinstance(stations,dict):raise ValueError("Invalid NOAA weather cache")
    codes={code for code in manifest["airports"] if len(code)==4 and code.startswith("OI")}
    bridge={} if no_irimo else load_device_reports(now)
    codes.update(bridge)
    irimo={code:record["taf"] for code,record in bridge.items() if record.get("taf")}
    irimo_status="device_relay" if irimo else "not_checked"
    if not no_irimo and not irimo:
        try:
            content=fetch_block(588,timeout=7)
            irimo={code:raw for code,raw in extract(content,"taf").items() if code.startswith("OI")}
            if not irimo:raise ValueError("No IRIMO TAF station records")
            codes.update(irimo)
            irimo_status="available"
        except Exception as e:
            irimo_status="unavailable"
            print("IRIMO HTML unavailable, keeping validated NOAA:",repr(e)[:160],flush=True)
    for code,record in bridge.items():
        if record.get("metar"):
            row=stations.setdefault(code,{})
            row["metar"]=record["metar"]
            row["metar_source"]="IRIMO"
            row["metar_retrieved_at"]=now.isoformat()
    rows,n_irimo=build_rows(stations,codes,irimo,now)
    for code in codes:
        record=stations.setdefault(code,{})
        record["taf"]=rows[code]["raw"]
        record["taf_status"]=rows[code]["status"]
        record["taf_source"]=rows[code]["source"]
        record["taf_issued_at"]=rows[code]["issued_at"]
        record["taf_valid_to"]=rows[code]["valid_to"]
    count=sum(row["status"]=="available" for row in rows.values())
    weather["generated_at"]=now.isoformat()
    weather["iran_taf_validation"]={"generated_at":now.isoformat(),"irimo_status":irimo_status,
                                    "valid":count,"total":len(rows)}
    OUT.write_text(json.dumps({"schema":"jeppiran-iran-taf/v1","country":"IR",
                 "generated_at":now.isoformat(),"irimo_status":irimo_status,
                 "stations":rows},ensure_ascii=False,separators=(",",":"))+"\n")
    WX.write_text(json.dumps(weather,ensure_ascii=False,separators=(",",":"))+"\n")
    print("Iran TAF valid",count,"of",len(rows),"from IRIMO",n_irimo,"from NOAA",count-n_irimo,flush=True)

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--no-irimo",action="store_true")
    args=p.parse_args()
    main(no_irimo=args.no_irimo)
