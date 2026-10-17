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
    # Thirteen newly approved DISPLAY backgrounds override earlier displayed
    # variants only. The 50 immutable source posters and 20 historical gallery
    # assets are not touched. Two international airports extend coverage.
    v3_dir = WEB / "airport-profile-posters-v3"
    v3 = json.loads((v3_dir / "manifest.json").read_text(encoding="utf-8"))
    records = v3.get("files", {})
    if v3.get("schema") != 1 or v3.get("expectedCount") != 13 or len(records) != 13:
        raise SystemExit("Invalid approved V3 profile manifest")
    present = {p.stem for p in v3_dir.glob("*.webp")}
    if present != set(records):
        raise SystemExit("V3 airport profile artwork set incomplete or unexpected")
    for icao, meta in sorted(records.items()):
        if len(icao) != 4 or not icao.isupper() or not isinstance(meta, dict):
            raise SystemExit("Invalid V3 ICAO mapping: " + icao)
        file = v3_dir / (icao + ".webp")
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        if digest != meta.get("sha256"):
            raise SystemExit("V3 profile hash mismatch: " + icao)
        posters[icao] = "./airport-profile-posters-v3/" + file.name + "?v=" + digest[:20]
    out = {"schema": 1, "cache_policy": "immutable-per-sha256", "posters": posters,
           "gallery": gallery, "new20_profile_icaos": sorted(mapped)}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if OUTPUT.read_text(encoding="utf-8") != data if OUTPUT.exists() else True:
        OUTPUT.write_text(data, encoding="utf-8")
    print("Poster precache:", len(posters), "profile photos and", len(gallery), "gallery photos")
if __name__ == "__main__":
    main()
