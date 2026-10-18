#!/usr/bin/env python3
"""Non-operational FAA NOTAM Search relay. Never use stale content as active."""
import concurrent.futures
import datetime as dt
import json
import pathlib
import re
import urllib.parse
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
API="https://notams.aim.faa.gov/notamSearch/search"
OUT=pathlib.Path("/tmp/jeppiran-notams-current.json")
def choose(obj,*names):
    for n in names:
        v=obj.get(n)
        if v is not None and str(v).strip() and str(v).lower()!="null":return str(v).strip()
    return ""
def parse(payload):
    if isinstance(payload,list):rows=payload
    elif isinstance(payload,dict):
        if any(payload.get(k) for k in ("error","errors","exception")):raise ValueError("FAA server error")
        rows=next((payload[k] for k in ("notamList","data","results","notams") if isinstance(payload.get(k),list)),None)
    else: rows=None
    if rows is None:raise ValueError("Unrecognized JSON; not a validated empty NOTAM list")
    out=[];seen=set()
    for n in rows:
        if not isinstance(n,dict):continue
        text=choose(n,"icaoMessage","traditionalMessage","notamText","text","message","all","raw")[:5000]
        if not text:continue
        ident=choose(n,"notamNumber","id","notamId","number","Number")[:80]
        if not ident:
            found=re.search(r"\b[A-Z]\d{4}/\d{2}\b",text.upper());ident=found.group() if found else ""
        status=choose(n,"status","notamStatus").upper()
        if status in ("CANCELED","CANCELLED","EXPIRED","INACTIVE") or (ident,text) in seen:continue
        seen.add((ident,text))
        out.append(dict(id=ident,text=text,begin=choose(n,"effectiveStartDate","startDate","startdate","begin","validFrom"),end=choose(n,"effectiveEndDate","endDate","enddate","end","validTo"),status=status))
    return out
def get_batch(group):
    # The public FAA search accepts comma-separated location designators.
    # Grouping reduces rate-limiting; never attribute a NOTAM to the wrong airport.
    body=urllib.parse.urlencode(dict(searchType="0",designatorsForLocation=",".join(group),offset="0",notamsOnly="false")).encode()
    req=urllib.request.Request(API,data=body,method="POST",headers={"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8","Accept":"application/json","User-Agent":"JEPPIRAN-NOTAM-Relay/1.0"})
    try:
        with urllib.request.urlopen(req,timeout=18) as response:
            raw=response.read(4000000)
            if len(raw)==4000000:raise ValueError("Oversized response")
        result=parse(json.loads(raw))
        fetched=dt.datetime.now(dt.timezone.utc).isoformat()
        separated={k:[] for k in group}
        for n in result:
            # ICAO NOTAM section A) is the authoritative target location.
            m=re.search(r"(?:^|\s)A\)\s*([A-Z0-9]{4})\b",n["text"].upper())
            if m and m.group(1) in separated:
                separated[m.group(1)].append(n)
        return {icao:dict(status="available",fetched_at=fetched,notams=separated[icao]) for icao in group}
    except Exception as exc:
        print("FAA group retrieval unavailable:",",".join(group),str(exc)[:120],flush=True)
        return {icao:dict(status="unavailable",fetched_at=None,notams=[]) for icao in group}

def main():
    manifest=json.loads((ROOT/"app/src/main/assets/charts-manifest.json").read_text())
    names=sorted(k for k in manifest["airports"] if re.fullmatch(r"[A-Z0-9]{4}",k))
    groups=[names[i:i+4] for i in range(0,len(names),4)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results={}
        for response in pool.map(get_batch,groups):results.update(response)
    output=dict(schema="jeppiran-faa-notam-relay/v1",source="FAA NOTAM Search",generated_at=dt.datetime.now(dt.timezone.utc).isoformat(),stations=results)
    OUT.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":")))
    print("Fetched",sum(x["status"]=="available" for x in results.values()),"of",len(names))
if __name__=="__main__":main()
