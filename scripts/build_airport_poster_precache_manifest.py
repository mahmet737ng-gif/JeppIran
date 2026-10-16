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
    out = {"schema": 1, "cache_policy": "immutable-per-sha256", "posters": posters, "gallery": gallery}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if OUTPUT.read_text(encoding="utf-8") != data if OUTPUT.exists() else True:
        OUTPUT.write_text(data, encoding="utf-8")
    print("Poster precache:", len(posters), "profile photos and", len(gallery), "gallery photos")
if __name__ == "__main__":
    main()
