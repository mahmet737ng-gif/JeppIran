#!/usr/bin/env python3
"""Generate a deterministic content-revision index of actual WEBP airport posters.

Runs after the 50 display-only derivatives are built; includes an additional
review/gallery folder ONLY when its files exist (never references missing art).
Stable SHA-based URLs allow both persistent caching and selective upgrades.
"""
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
ORIGINAL = WEB / "airport-profile-posters" / "manifest.json"
OUTPUT = WEB / "data" / "airport-poster-cache.json"

def main():
    master = json.loads(ORIGINAL.read_text(encoding="utf-8"))
    if not master.get("ownerLocked") or len(master["files"]) != 50:
        raise SystemExit("Refusing to build an incomplete owner-locked poster cache")
    posters = {}
    for icao in sorted(master["files"]):
        file = WEB / "airport-profile-posters-textfree" / (icao + ".webp")
        if not file.exists():
            raise SystemExit("Missing approved display derivative: " + icao)
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        posters[icao] = "./airport-profile-posters-textfree/" + icao + ".webp?v=" + digest[:20]
    gallery = []
    folder = WEB / "airport-profile-posters-new20"
    for file in sorted(folder.glob("new20_*.webp")):
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        gallery.append("./airport-profile-posters-new20/" + file.name + "?v=" + digest[:20])
    # Assign the new twenty illustrations to previously uncovered airports, but
    # never replace or change any of the fifty approved original backgrounds.
    assignments = json.loads((folder / "assignments.json").read_text(encoding="utf-8"))
    mapped = assignments.get("airport_to_design", {})
    expected = {f"new20_{n:02d}" for n in range(1, 21)}
    if assignments.get("count") != 20 or len(mapped) != 20 or set(mapped.values()) != expected:
        raise SystemExit("Exactly 20 unique approved new profile designs are required")
    gallery_urls = {Path(url.split("?")[0]).stem: url for url in gallery}
    for icao, design in sorted(mapped.items()):
        if not (len(icao) == 4 and icao.isupper()) or icao in posters:
            raise SystemExit("Owner-locked airport collision or invalid ICAO: " + icao)
        if design not in gallery_urls:
            raise SystemExit("Missing source image for: " + design)
        posters[icao] = gallery_urls[design]
    # Owner-approved 13 profile replacements: 11 existing profile codes and
    # 2 newly added international airports. Original 50 and gallery 20 remain
    # untouched; SHA revision URLs replace only these named display choices.
    approved = json.loads((WEB / "airport-profile-posters-v3" / "manifest.json").read_text(encoding="utf-8"))
    entries = approved.get("files", {})
    if approved.get("count") != 13 or len(entries) != 13 or not approved.get("ownerApproved"):
        raise SystemExit("Expected exactly 13 owner-approved poster replacements")
    for icao, details in sorted(entries.items()):
        if len(icao) != 4 or not icao.isupper() or details.get("file") != icao + ".webp":
            raise SystemExit("Invalid new poster ICAO/path: " + icao)
        image = WEB / "airport-profile-posters-v3" / details["file"]
        if not image.is_file():
            raise SystemExit("Missing owner-approved airport poster: " + icao)
        blob = image.read_bytes()
        digest = hashlib.sha256(blob).hexdigest()
        if len(blob) != details["size"] or digest != details["sha256"]:
            raise SystemExit("Owner-approved poster integrity mismatch: " + icao)
        posters[icao] = "./airport-profile-posters-v3/" + icao + ".webp?v=" + digest[:20]
    print("13 owner-approved replacement posters verified; 50 originals + 20 gallery retained")
    out = {"schema": 1, "cache_policy": "immutable-per-sha256", "posters": posters,
           "gallery": gallery, "new20_profile_icaos": sorted(mapped)}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if OUTPUT.read_text(encoding="utf-8") != data if OUTPUT.exists() else True:
        OUTPUT.write_text(data, encoding="utf-8")
    print("Poster precache:", len(posters), "profile photos and", len(gallery), "gallery photos")
if __name__ == "__main__":
    main()
