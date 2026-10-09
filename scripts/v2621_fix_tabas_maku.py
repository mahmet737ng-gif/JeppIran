#!/usr/bin/env python3
"""Fix four V2621 source-verified airport ownership mistakes.

Builds only the four affected airport PDFs from the ORIGINAL full-frame source.
Never edits original PDF, live chart-georef.json or simulator bridges.
"""
import copy
import datetime
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

import fitz

SOURCE=Path("Iran2621.pdf")
ROOT=Path("app/src/main/assets")
OUT=Path("v2621-tabas-maku-fix")
TAG="charts-V2621-tabas-maku-fix-1"
SHA="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
FIXED={
    642:{"old":"OIMB","new":"OIMT","category":"Airport","plate":"10-9","name":"Airport Diagram Chart (ADC)"},
    851:{"old":"OITT","new":"OITU","category":"STAR","plate":"10-2","name":"TBZ 1N"},
    852:{"old":"OITT","new":"OITU","category":"STAR","plate":"10-2A","name":"TBZ 1P"},
    853:{"old":"OITT","new":"OITU","category":"SID","plate":"10-3","name":"TBZ 1A"},
}
AFFECTED={"OIMB","OIMT","OITT","OITU"}

def sha256(path):
    with path.open("rb") as fh:
        digest=hashlib.sha256()
        for part in iter(lambda:fh.read(1024*1024),b""):
            digest.update(part)
        return digest.hexdigest()

def scrub(page,num,original):
    original_boxes=(page.mediabox,page.cropbox,page.rect,page.rotation)
    lines=[]
    for block in page.get_text("dict")["blocks"]:
        if block["type"]!=0:continue
        for line in block["lines"]:
            txt="".join(span["text"] for span in line["spans"])
            if txt.startswith("Printed from JeppView"):
                lines.append(fitz.Rect(line["bbox"]))
    if not lines:lines=page.search_for("Printed on 09 Oct 2026")
    assert len(lines)==1,f"Wrong print-header count source PDF page {num}: {len(lines)}"
    r=lines[0]
    assert r.y1<51, f"Print-header not in top strip page {num}"
    page.add_redact_annot(fitz.Rect(r.x0+.01,r.y0+.01,r.x1-.01,r.y1-.01),
                         fill=(1,1,1),cross_out=False)
    page.apply_redactions(images=0,graphics=0,text=0)
    assert (page.mediabox,page.cropbox,page.rect,page.rotation)==original_boxes
    assert page.rect==original.rect
    assert not re.search(r"Printed from JeppView|Printed on\s+\d{1,2}\s+\w+\s+\d{4}",page.get_text()),num

def main():
    assert sha256(SOURCE)==SHA,"Source PDF is not approved V2621 input"
    doc=fitz.open(SOURCE)
    assert len(doc)==1654
    rows=json.loads((ROOT/"charts-current.json").read_text(encoding="utf-8"))
    manifest=json.loads((ROOT/"charts-manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"]=="V2621" and manifest["source_sha256"]==SHA
    assert manifest["release_tag"]=="charts-V2621-printclean-3"
    assert len(rows)==1642
    pages={int(row["page"]):row for row in rows}
    assert len(pages)==len(rows)
    assert manifest["airports"]["OIMB"]["global_pages"][-1]==642
    assert manifest["airports"]["OITU"]["global_pages"]==[850,854,855]
    changes=[]
    for n,chg in FIXED.items():
        row=pages[n]
        assert row["airport"]==chg["old"], f"Ownership already modified for source page {n}"
        original=doc[n-1].get_text()
        assert (chg["new"]+"/") in original, f"Missing printed ICAO on source page {n}"
        assert re.search(r"(?<![A-Z0-9])"+re.escape(chg["plate"])+r"(?![A-Z0-9])",original),f"Wrong source plate {n}"
        assert row["category"]==chg["category"], f"Unexpected category for page {n}"
        changes.append({"pdf_page":n,"before":dict(row),"after":{"airport":chg["new"],"category":chg["category"],"chart_number":chg["plate"],"name":chg["name"]}})
        row.update(airport=chg["new"],category=chg["category"],chart_number=chg["plate"],name=chg["name"])

    grouped=defaultdict(list)
    for row in rows:grouped[row["airport"]].append(row)
    assert len(grouped)==78,"Unexpected airport count"
    assert {x:len(grouped[x]) for x in sorted(AFFECTED)}=={"OIMB":14,"OIMT":12,"OITT":20,"OITU":6}
    for icao,items in grouped.items():
        items.sort(key=lambda x:int(x["page"]))
        if icao not in AFFECTED:
            original_numbers=manifest["airports"][icao]["global_pages"]
            assert [x["page"] for x in items]==original_numbers, f"Unexpected unrelated airport pages {icao}"
            assert all(x["pdf_page"]==i+1 for i,x in enumerate(items)),f"Unrelated local index mismatch {icao}"

    new_manifest=copy.deepcopy(manifest)
    outpdf=OUT/"airports"
    outpdf.mkdir(parents=True,exist_ok=True)
    for icao in sorted(AFFECTED):
        items=grouped[icao]
        result=fitz.open()
        for i,row in enumerate(items,1):
            num=int(row["page"])
            result.insert_pdf(doc,from_page=num-1,to_page=num-1)
            scrub(result[-1],num,doc[num-1])
            row["pdf_page"]=i
        target=outpdf/(icao+".pdf")
        result.set_metadata({})
        result.save(target,garbage=4,deflate=True)
        result.close()
        check=fitz.open(target)
        assert len(check)==len(items)
        check.close()
        base="https://github.com/mahmet737ng-gif/JeppIran/releases/download/"+TAG+"/"
        new_manifest["airports"][icao]={
            "file":target.name,"url":base+target.name,"sha256":sha256(target),
            "size":target.stat().st_size,"pages":len(items),
            "global_pages":[x["page"] for x in items]
        }
        print("VERIFIED: ",icao,len(items),"pages",target.stat().st_size,"bytes",flush=True)

    assert sum(info["pages"] for info in new_manifest["airports"].values())==1642
    for row in rows:
        assert new_manifest["airports"][row["airport"]]["global_pages"][row["pdf_page"]-1]==row["page"],"Mismatch local PDF page "+str(row["page"])
    for icao in grouped:
        if icao not in AFFECTED:
            assert new_manifest["airports"][icao]==manifest["airports"][icao],"Unrelated airport manifest modified"
    assert new_manifest["release_tag"]==manifest["release_tag"],"Existing georef bundle release must remain valid"
    assert new_manifest["source_sha256"]==manifest["source_sha256"]
    new_manifest["chart_index_revision"]="V2621-tabas-maku-ownership-fix-1"
    new_manifest["airport_pdf_patch_release"]=TAG
    new_manifest["generated_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    (OUT/"charts-current.json").write_text(json.dumps(sorted(rows,key=lambda x:x["page"]),ensure_ascii=False,indent=2)+"\n")
    (OUT/"charts-manifest.json").write_text(json.dumps(new_manifest,ensure_ascii=False,indent=2)+"\n")
    (OUT/"audit.json").write_text(json.dumps({"source_sha256":SHA,"changes":changes,
       "published_pdf_patch_tag":TAG,
       "unmodified_source_charts":1642-len(changes),
       "changed_airport_pdfs":sorted(AFFECTED),
       "georef_changed":False,"runway_geometry_changed":False,
       "simulator_bridge_changed":False,
       "page_frame_cropped":False,"not_for_actual_navigation":True},
       ensure_ascii=False,indent=2)+"\n")
    doc.close()
    print("CORRECTION_READY four source-confirmed pages; all 1642 airport-local indices valid",flush=True)

if __name__=="__main__":
    main()
