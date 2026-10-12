#!/usr/bin/env python3
"""JEPPIRAN ADC autopilot: PDF -> source vectors -> unapproved graph
candidates -> staged QA report. NEVER auto-authorize navigation.

Example:
  python web/tools/adc_autopilot.py --pdf 2621.pdf --icao OIII \
    --survey web/data/taxi-surveys/OIII.json --out work/o3

If --survey is supplied, the chart/parking pages are read from the survey.
Without a survey, use --pages 430,432 or supply a single-page ADC PDF.
Auto-extraction ≠ approved routeability: the review file is mandatory.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
try:
    import fitz
except ImportError:
    sys.exit("Install PyMuPDF first: python -m pip install pymupdf")

def hashfile(path):
    h=hashlib.sha256()
    with open(path,"rb") as file:
        for block in iter(lambda:file.read(1048576),b""):h.update(block)
    return h.hexdigest()
def xy(p):return [round(float(p.x),4),round(float(p.y),4)]
def drawings(page):
    output=[]
    for i,d in enumerate(page.get_drawings()):
        paths=[]
        for op in d.get("items",[]):
            if op[0]=="l" and len(op)>=3:
                paths.append(["l",xy(op[1]),xy(op[2])])
            elif op[0]=="c" and len(op)>=5:
                paths.append(["c",*[xy(p) for p in op[1:5]]])
        if paths:
            bbox=d["rect"]
            output.append({"id":i,"bbox":[round(v,4) for v in (bbox.x0,bbox.y0,bbox.x1,bbox.y1)],
                           "stroke":d.get("color"),"fill":d.get("fill"),
                           "width":d.get("width"),"paths":paths})
    return output
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pdf",required=True)
    ap.add_argument("--icao",required=True)
    ap.add_argument("--pages",help="1-indexed PDF page numbers: 430,432")
    ap.add_argument("--survey",help="Source-verified airport inventory (e.g. OIII.json)")
    ap.add_argument("--review",help="Reviewed line, junction, gate and page-link edits")
    ap.add_argument("--out",required=True)
    ap.add_argument("--no-preview",action="store_true")
    a=ap.parse_args()
    icao=a.icao.upper().strip()
    if len(icao)!=4 or not icao.isalpha():ap.error("Provide four-letter ICAO")
    pdf=Path(a.pdf);output=Path(a.out);output.mkdir(parents=True,exist_ok=True)
    fingerprint=hashfile(pdf)
    survey=json.loads(Path(a.survey).read_text()) if a.survey else None
    if survey and (survey.get("airport")!=icao or survey.get("source",{}).get("sha256")!=fingerprint):
        ap.error("Survey is for another airport or DIFFERENT PDF revision; aborted")
    document=fitz.open(pdf)
    if a.pages: pages=[int(p.strip()) for p in a.pages.split(",")]
    elif survey:
        q=survey.get("qaCharts",{})
        pages=[x["page"] for x in q.values() if isinstance(x,dict) and x.get("page")
               and x.get("page")!=q.get("standCoordinates",{}).get("page")]
        if not pages:pages=survey["source"]["pages"]
    elif len(document)==1:pages=[1]
    else:ap.error("Multiple pages: pass --pages or a source-verified --survey")
    pages=sorted(set(pages))
    if any(page<1 or page>len(document) for page in pages):
        ap.error("Page number outside the PDF")
    raw=[]
    for n in pages:
        pg=document[n-1]
        item={"schemaVersion":1,"airport":icao,
              "cycle":str(survey.get("cycle","unknown") if survey else "unknown"),
              "globalPage":n,"sourceSha256":fingerprint,"coordinateSpace":"PDF_POINTS_TOP_LEFT",
              "width":pg.rect.width,"height":pg.rect.height,
              "classification":"SOURCE_DRAWING_CANDIDATES_UNAPPROVED",
              "drawings":drawings(pg)}
        name=output/f"page_{n}_raw_vectors.json"
        name.write_text(json.dumps(item,separators=(",",":"))+"\n")
        raw.append(str(name))
        if not a.no_preview:
            pg.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(str(output/f"page_{n}.png"))
        print("Extracted",n,len(item["drawings"]),"native PDF draw objects")
    script=Path(__file__).with_name("adc_trace_candidates.py")
    cmd=[sys.executable,str(script),"--raw",*raw,"--out",str(output)]
    subprocess.run(cmd,check=True)
    cli=Path(__file__).with_name("adc_workflow_cli.cjs")
    if survey:
        # Stage 4 candidates: taxiway label -> nearest native vector proposals.
        # These are NOT stand connections or reviewed centerlines.
        label_script=Path(__file__).with_name("adc_label_hypotheses.py")
        subprocess.run([sys.executable,str(label_script),"--survey",a.survey,
            "--candidates",str(output),
            "--out",str(output/f"{icao}_taxiway_label_hypotheses.json")],check=True)
        # Build native-line contact proposals and name/stand candidates.
        # All associations remain UNREVIEWED until compared with the actual
        # ADC and Parking PDF curves.
        contact_script=Path(__file__).with_name("adc_graph_proposals.py")
        subprocess.run([sys.executable,str(contact_script),"--survey",a.survey,
            "--candidates",str(output),"--out",str(output)],check=True)
        # The pavement fallback only yields source-drawing contour candidates
        # for labels with no extracted ink centerline; none is an approved route.
        pavement_script=Path(__file__).with_name("adc_pavement_fallback.py")
        subprocess.run([sys.executable,str(pavement_script),"--pdf",a.pdf,
            "--survey",a.survey,"--out",
            str(output/f"{icao}_pavement_fallback_UNREVIEWED.json")],check=True)
        node=shutil.which("node")
        if not node:
            print("Node.js unavailable; finish workflow report with:")
            print("node",cli,"--survey",a.survey,"--out",output)
        else:
            cmd=[node,str(cli),"--survey",a.survey,
                 "--candidates",",".join(str(output/f"{icao}_page_{n}_line_candidates.json") for n in pages),
                 "--out",str(output)]
            if a.review:cmd.extend(["--review",a.review])
            subprocess.run(cmd,check=True)
    else:
        (output/"NEXT_ACTIONS.md").write_text(
            "# ADC extraction pending review\n"
            "Inventory physical runway ends, taxiway names, individual stands, and printed chart sources.\n"
            "Then generate a named survey JSON and run adc_workflow_cli.cjs for topology QA.\n"
            "No lines have been approved, no runway gate assumed, no routes generated.\n")
    print("ADC autopilot output:",output,"SOURCE",fingerprint,
          "— only reviewed, fully connected charts can become routeable.")
if __name__=="__main__":main()
