#!/usr/bin/env python3
"""Reconcile V2621's last 94 source pages without changing geometry or georeferencing.

This script runs in CI from the unchanged source PDF. It is NOT a navigation-data
validation or independent georeferencing approval.
"""
import copy
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import fitz

SOURCE = Path("Iran2621.pdf")
ASSETS = Path("app/src/main/assets")
OUT = Path("cycle-v2621-final")
TAG = "charts-V2621-printclean-3"
EXPECTED_SHA = "d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"

K_STAR = [
    "CHORE 1B",
    "DOSTI 1D, DOSTI 1E, LAKIV 1B, LAKIV 1C",
    "DOSTI 2C, LAKIV 2A",
    "CHOR 1A, DOSTI 2A, DOSTI 2B",
    "LOTAT 2A, LOTAT 2B, MINAR 2",
    "NAWABSHAH 2A, NAWABSHAH 2B",
]
K_SID = [
    "BADUL 1D",
    "DANGI 1C, DANGI 1D, DANGI 1E",
    "NIROL 1C, NIROL 1D, NIROL 1E",
    "MELOM 1F, MELOM 1G",
    "MELOM 1H, MELOM 1J, MELOM 1L, MELOM 1M",
    "BADUL 3A, BADUL 3B, BADUL 3C",
    "DANGI 3A, DANGI 3B",
    "MELOM 4A, MELOM 4B, MELOM 4D, MELOM 4E",
    "NIROL 3A, NIROL 3B, PUNAM 3A, PUNAM 3B",
]
K_APP = [
    "ILS OR LOC Z RWY 25L", "ILS OR LOC Y RWY 25L",
    "ILS OR LOC Z RWY 25R", "ILS OR LOC Y RWY 25R",
    "RNP RWY 07L", "RNP RWY 07R", "RNP RWY 25L", "RNP RWY 25R",
    "VOR Z RWY 25L", "VOR Y RWY 25L",
    "VOR Z RWY 25R", "VOR Y RWY 25R",
    "NDB A RWY 25L/R", "SRA RWY 07L/25R",
]
I_STAR = [
    "BOBAM 1J",
    "BELKO 1C, DAMTO 1D, INDEK 1A, KALMI 1A",
    "BOBAM 1K",
    "BELKO 1D, DAMTO 1E, INDEK 1B, KALMI 1B",
]
I_SID = [
    "BOBAM 2L", "BOBAM 2M", "BOBAM 1Q", "BOBAM 1R",
    "BELKO 2E, DAMTO 2F, INDEK 2C, KALMI 2C",
    "BELKO 2F, DAMTO 2G, INDEK 2D, KALMI 2D",
    "BELKO 1J, DAMTO 1K, INDEK 1G, KALMI 1E",
    "BELKO 1K, DAMTO 1L, INDEK 1H, KALMI 1J",
    "BOBAM 2N", "BOBAM 2P", "BELKO 2G, INDEK 2E",
    "BELKO 2H, INDEK 2F",
    "DAMTO 2H, KALMI 2F",
    "DAMTO 2J, KALMI 2G, KALMI 2H",
]
I_APP = [
    "ILS OR LOC Z RWY 10R", "ILS OR LOC Y RWY 10R",
    "ILS OR LOC Z RWY 28L", "CAT II/III ILS OR LOC Z RWY 28L",
    "ILS OR LOC Y RWY 28L", "CAT II/III ILS OR LOC Y RWY 28L",
    "ILS OR LOC Z RWY 28R", "ILS OR LOC Y RWY 28R",
    "RNP RWY 10L", "RNP RWY 10R", "RNP RWY 28L", "RNP RWY 28R",
    "VOR RWY 10L", "VOR RWY 10R", "VOR RWY 28L", "VOR RWY 28R",
]


def digest(path: Path) -> str:
    return hashlib.file_digest(path.open("rb"), "sha256").hexdigest()


def page_identity(page_num: int):
    """Return ICAO, category, printed plate, and user-facing title."""
    if 1562 <= page_num <= 1598:
        icao = "OPKC"
        if page_num <= 1563:
            return icao, "Airport", "", f"AIRPORT INFORMATION PAGE {page_num-1561}"
        if page_num == 1564:
            return icao, "Airport", "10-1R", "RADAR MINIMUM ALTITUDES"
        if page_num <= 1570:
            i = page_num - 1565
            return icao, "STAR", ["10-2","10-2A","10-2B","10-2C","10-2D","10-2E"][i], K_STAR[i]
        if page_num <= 1579:
            i = page_num - 1571
            return icao, "SID", ["10-3","10-3A","10-3B","10-3C","10-3D","10-3E","10-3F","10-3G","10-3H"][i], K_SID[i]
        if page_num <= 1584:
            i = page_num - 1580
            return icao, "Airport", ["10-9","10-9A","10-9B","10-9S","10-9S1"][i], [
                "AIRPORT DIAGRAM", "PARKING STANDS & INS COORDINATES",
                "TAXI AND START-UP/PUSH-BACK PROCEDURES", "MINIMUMS PART 1",
                "MINIMUMS PART 2"][i]
        i = page_num - 1585
        return icao, "Approach", ["11-1","11-2","11-3","11-4","12-1","12-2",
            "12-3","12-4","13-1","13-2","13-3","13-4","16-1","18-1"][i], K_APP[i]
    if 1599 <= page_num <= 1642:
        icao = "OPIS"
        if page_num <= 1600:
            return icao, "Airport", "", f"AIRPORT INFORMATION PAGE {page_num-1598}"
        if page_num <= 1603:
            i = page_num - 1601
            return icao, "Airport", ["20-1P","20-1P1","20-1P2"][i], f"AIRPORT BRIEFING PART {i+1}"
        if page_num == 1604:
            return icao, "Airport", "20-1R", "RADAR MINIMUM ALTITUDES"
        if page_num <= 1608:
            i = page_num - 1605
            return icao, "STAR", ["20-2","20-2A","20-2B","20-2C"][i], I_STAR[i]
        if page_num <= 1622:
            i = page_num - 1609
            return icao, "SID", ["20-3","20-3A","20-3B","20-3C","20-3D",
                "20-3E","20-3F","20-3G","20-3H","20-3J","20-3K","20-3L",
                "20-3M","20-3N"][i], I_SID[i]
        if page_num <= 1626:
            i = page_num - 1623
            return icao, "Airport", ["20-9","20-9A","20-9S","20-9S1"][i], [
                "AIRPORT DIAGRAM", "PARKING STANDS & INS COORDINATES",
                "MINIMUMS PART 1", "MINIMUMS PART 2"][i]
        i = page_num - 1627
        return icao, "Approach", ["21-1","21-2","21-3","21-3A","21-4",
            "21-4A","21-5","21-6","22-1","22-2","22-3","22-4",
            "23-1","23-2","23-3","23-4"][i], I_APP[i]
    raise ValueError("Source page is not a new chart: "+str(page_num))


def assert_printed(page, num, icao, plate):
    text = page.get_text()
    header = ("OPKC/KHI" if icao == "OPKC" else "OPIS/ISB")
    assert header in text or (plate == "" and icao in text), f"Incorrect airport header on page {num}"
    if plate:
        assert re.search(r"(?<![A-Za-z0-9])"+re.escape(plate)+r"(?![A-Za-z0-9])",text), \
            f"Printed plate absent page {num}: {plate}"


def redact_only_generated_print_line(page, num, source_page):
    before = (page.mediabox, page.cropbox, page.rect, page.rotation)
    candidates = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            string = "".join(span["text"] for span in line["spans"])
            if string.startswith("Printed from JeppView"):
                candidates.append(fitz.Rect(line["bbox"]))
    if not candidates:
        candidates = page.search_for("Printed on 09 Oct 2026")
    assert len(candidates) == 1, f"Unexpected print header number on page {num}"
    rect = candidates[0]
    assert rect.y1 < 51, f"Source {num} print header is outside top margin"
    page.add_redact_annot(
        fitz.Rect(rect.x0+.01, rect.y0+.01, rect.x1-.01, rect.y1-.01),
        fill=(1,1,1), cross_out=False,
    )
    page.apply_redactions(images=0, graphics=0, text=0)
    assert (page.mediabox, page.cropbox, page.rect, page.rotation) == before
    assert page.rect == source_page.rect
    assert not re.search(r"Printed from JeppView|Printed on\s+\d{1,2}\s+\w+\s+\d{4}", page.get_text()), \
        f"Header remains on page {num}"


def main():
    assert digest(SOURCE) == EXPECTED_SHA, "Original source file checksum mismatch"
    source = fitz.open(SOURCE)
    assert len(source) == 1654
    manifest = json.loads((ASSETS/"charts-manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"] == "V2621"
    assert manifest["source_sha256"] == EXPECTED_SHA
    assert manifest["release_tag"] == "charts-V2621-printclean-2"
    rows = json.loads((ASSETS/"charts-current.json").read_text(encoding="utf-8"))
    assert len(rows) == 1564
    old = {int(item["page"]):item for item in rows}
    assert len(old) == len(rows)
    assert all(old[n]["airport"] == "OITR" and old[n]["category"] == "Airport" for n in (1643,1644,1645))
    assert all(n not in old for n in range(1562,1643))
    assert old[1561]["airport"] == "OTHH" and old[1561]["chart_number"] == "22-4"
    for n in (1643,1644,1645):
        assert "Chart changes since cycle 20-2026" in source[n-1].get_text(), f"Incorrect notice page {n}"
        del old[n]
    changes = []
    for n in range(1562,1643):
        icao, category, plate, title = page_identity(n)
        assert_printed(source[n-1],n,icao,plate)
        old[n] = dict(page=n,airport=icao,country="Pakistan",category=category,
                      chart_number=plate,name=title,pdf_page=0)
        changes.append(dict(page=n,icao=icao,category=category,plate=plate,title=title))
    rows = [old[n] for n in sorted(old)]
    assert len(rows) == 1642
    assert [x["page"] for x in rows] == list(range(1,1643)), "Terminal pages not contiguous"
    counts = Counter(x["category"] for x in rows if 1561 <= x["page"] <= 1642)
    assert counts == Counter({"Approach":31,"Airport":18,"SID":23,"STAR":10}),counts
    grouped = defaultdict(list)
    for row in rows:
        grouped[row["airport"]].append(row)
    assert "OPKC" in grouped and "OPIS" in grouped
    assert len(grouped["OPKC"]) == 37 and len(grouped["OPIS"]) == 44
    assert len(grouped) == 78
    OUT.mkdir(parents=True,exist_ok=True)
    airport_dir=OUT/"airports"
    airport_dir.mkdir(parents=True,exist_ok=True)
    new_manifest=copy.deepcopy(manifest)
    base=f"https://github.com/mahmet737ng-gif/JeppIran/releases/download/{TAG}/"
    new_manifest.update(release_tag=TAG,base_url=base,indexed_terminal_pages=1642,
                        source_pages_including_notices=1654,chart_index_revision="V2621-final-94-reviewed")
    new_manifest["airports"]={}
    for icao,items in sorted(grouped.items()):
        items.sort(key=lambda x:x["page"])
        target = fitz.open()
        for local,row in enumerate(items,1):
            n=int(row["page"])
            target.insert_pdf(source,from_page=n-1,to_page=n-1)
            redact_only_generated_print_line(target[-1],n,source[n-1])
            row["pdf_page"]=local
        out_file=airport_dir/(icao+".pdf")
        target.set_metadata({})
        target.save(out_file,garbage=4,deflate=True)
        target.close()
        numbers=[int(x["page"]) for x in items]
        new_manifest["airports"][icao] = dict(file=out_file.name,url=base+out_file.name,
            sha256=digest(out_file),size=out_file.stat().st_size,
            pages=len(numbers),global_pages=numbers)
        print("Verified airport",icao,len(items),flush=True)

    # Revision letter and chart-change notices are important documents, not terminal plates.
    notice=fitz.open()
    for n in range(1643,1655):
        s=source[n-1].get_text()
        assert "Chart changes since cycle 20-2026" in s or "TERMINAL CHART CHANGE NOTICES" in s or n==1645
        notice.insert_pdf(source,from_page=n-1,to_page=n-1)
        redact_only_generated_print_line(notice[-1],n,source[n-1])
    notice_path=OUT/"V2621_REVISION_AND_CHANGE_NOTICES.pdf"
    notice.set_metadata({})
    notice.save(notice_path,garbage=4,deflate=True)
    notice.close()
    assert fitz.open(notice_path).page_count==12
    records=[dict(page=n,content_type="REVISION_LETTER" if n<=1645 else "TERMINAL_CHART_CHANGE_NOTICES",
        separate_from_terminal_chart_index=True) for n in range(1643,1655)]
    (OUT/"notice-index.json").write_text(json.dumps(records,indent=2)+"\n")
    new_manifest["additional_documents"] = [{
        "file":notice_path.name,"url":base+notice_path.name,
        "sha256":digest(notice_path),"pages":12,"source_global_pages":list(range(1643,1655)),
        "type":"REVISION_LETTER_AND_CHANGE_NOTICES"
    }]
    assert len(new_manifest["airports"])==78
    assert sum(x["pages"] for x in new_manifest["airports"].values())==1642
    check={icao:{n:i+1 for i,n in enumerate(x["global_pages"])} for icao,x in new_manifest["airports"].items()}
    assert all(r["pdf_page"]==check[r["airport"]][r["page"]] for r in rows)
    assert len({r["page"] for r in rows})==len(rows)
    (OUT/"charts-current.json").write_text(json.dumps(rows,indent=2,ensure_ascii=False)+"\n")
    (OUT/"charts-manifest.json").write_text(json.dumps(new_manifest,indent=2,ensure_ascii=False)+"\n")
    (OUT/"last-94-source-audit.json").write_text(json.dumps({
        "source_sha256":EXPECTED_SHA,"source_pages":1654,
        "included_terminal_plates":1642,"source_pages_added":81,
        "former_false_chart_records_removed":[1643,1644,1645],
        "non_chart_document_pages":list(range(1643,1655)),
        "classification_last_94":dict(counts)|{"NON_CHART":12},
        "new_georeferences_approved":0,
        "all_last_94_full_native_size_visually_approved":False,
        "original_page_media_and_crop_boxes_preserved":True,
        "note":"Not for actual navigation"
    },indent=2)+"\n")
    assert (OUT/"airports"/"OPKC.pdf").exists() and (OUT/"airports"/"OPIS.pdf").exists()
    assert len(list(airport_dir.glob("*.pdf")))==78
    source.close()
    print("READY FOR RELEASE",len(rows),"terminal charts, 12 non-chart notices; original geometry retained.")


if __name__=="__main__":
    main()
