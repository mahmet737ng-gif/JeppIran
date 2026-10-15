#!/usr/bin/env python3
"""Protect owner-approved decorative airport profile posters from accidental updates.

A completely absent asset set is allowed while binary upload is pending. Once
any poster is uploaded, the entire forty-file collection must be present and
must match all SHA-256 hashes pinned in web/airport-profile-posters/manifest.json.
"""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "web" / "airport-profile-posters"
MANIFEST = FOLDER / "manifest.json"


def main() -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert data["schema"] == 1 and data["ownerLocked"] and data["illustrativeOnly"]
    locked = data["files"]
    assert data["expectedCount"] == len(locked) == 40
    assert locked["OITR"]["file"] == "OITR.webp", "Urmia airport OITR locked"
    assert locked["OITT"]["file"] == "OITT.webp", "Tabriz airport OITT locked"
    uploaded = list(FOLDER.glob("*.webp"))
    if not uploaded:
        print("Airport profile image integration staged; binary assets not uploaded yet.")
        return
    assert len(uploaded) == len(locked), "Partial airport poster upload: all 40 files required"
    assert {x.name for x in uploaded} == {v["file"] for v in locked.values()}, "Poster filename mismatch"
    for icao, meta in locked.items():
        path = FOLDER / meta["file"]
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        assert actual == meta["sha256"], f"Owner-locked image changed: {icao}"
    print("Verified all 40 immutable airport profile poster images.")


if __name__ == "__main__":
    main()
