#!/usr/bin/env python3
"""Protect owner-approved decorative airport profile posters from accidental updates.

A completely absent asset set is allowed while binary upload is pending. Once
any poster is uploaded, the entire owner-locked poster collection must be present and
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
    assert data["expectedCount"] == len(locked) == 50
    assert locked["OITR"]["file"] == "OITR.webp", "Urmia airport OITR locked"
    assert locked["OITT"]["file"] == "OITT.webp", "Tabriz airport OITT locked"
    assert locked["OICK"]["file"] == "OICK.webp", "Khorramabad OICK locked"
    assert locked["OIFS"]["file"] == "OIFS.webp", "Shahrekord OIFS locked"
    uploaded = list(FOLDER.glob("*.webp"))
    assert uploaded, "Owner-locked profile posters have not been installed"
    assert len(uploaded) == len(locked), "Partial airport poster upload: all 50 files required"
    assert {x.name for x in uploaded} == {v["file"] for v in locked.values()}, "Poster filename mismatch"
    for icao, meta in locked.items():
        path = FOLDER / meta["file"]
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        assert actual == meta["sha256"], f"Owner-locked image changed: {icao}"
    print("Verified all 50 immutable airport profile poster images.")


if __name__ == "__main__":
    main()
