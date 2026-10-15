#!/usr/bin/env python3
"""Repair ONLY old caption lettering in 50 display copies of owner-locked WebPs.

Do not alter the original images or their SHA256 manifest. Inpaint the bright
pixel strokes of old captions using neighboring real image pixels: no opaque
flat midnight rectangles, artificial glow panels or hard fade boundaries.
"""
import argparse
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "web" / "airport-profile-posters"
DST = ROOT / "web" / "airport-profile-posters-textfree"
MANIFEST = SRC / "manifest.json"
# Bright title, city, country, decorative aircraft rule, coordinates.
TEXT_BANDS = ((.690,.795,.025,.535),(.796,.849,.025,.550),
              (.851,.891,.025,.620),(.892,.939,.025,.400),
              (.940,.984,.025,.480))


def mask_letters(rgb):
    h,w = rgb.shape[:2]
    mask = np.zeros((h,w), dtype=np.uint8)
    img = rgb.astype(np.int16)
    for low, high, left, right in TEXT_BANDS:
        y0,y1 = int(h*low),int(h*high)
        x0,x1 = int(w*left),int(w*right)
        r,g,b = (img[y0:y1,x0:x1,i] for i in range(3))
        bright = ((r>90)&(g>86)&(b>73)&
                  ((r+g+b)>305)&
                  (np.abs(r-g)<105)&(np.abs(g-b)<110))
        mask[y0:y1,x0:x1] = np.where(bright,255,0).astype(np.uint8)
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
    # The original thin divider is too dark for brightness-only detection.
    cv2.rectangle(mask,(int(w*.05),int(h*.897)),
                  (int(w*.37),int(h*.915)),255,-1)
    if np.count_nonzero(mask) / mask.size > .12:
        raise ValueError("Refusing to alter an unexpectedly large image area")
    return mask


def clean(source, target):
    with Image.open(source) as source_image:
        rgb = np.asarray(source_image.convert("RGB"))
    h,w=rgb.shape[:2]
    if w<500 or h<350:
        raise ValueError(f"Unsupported image size: {source.name} {w}x{h}")
    repaired=cv2.inpaint(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),
                         mask_letters(rgb),4,cv2.INPAINT_TELEA)
    target.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(cv2.cvtColor(repaired,cv2.COLOR_BGR2RGB)).save(
        target,"WEBP",quality=95,method=6)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--check",action="store_true")
    args=p.parse_args()
    manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
    files=manifest["files"]
    if manifest["expectedCount"] != 50 or len(files) != 50 or not manifest["ownerLocked"]:
        raise RuntimeError("Owner-locked manifest count/state mismatch")
    seen=set()
    for icao,item in sorted(files.items()):
        source=SRC/item["file"]
        target=DST/item["file"]
        if source.name!=f"{icao}.webp":
            raise RuntimeError(f"Wrong image mapping: {icao}")
        blob=source.read_bytes()
        if hashlib.sha256(blob).hexdigest()!=item["sha256"]:
            raise RuntimeError(f"OWNER-LOCKED ORIGINAL CHANGED: {icao}")
        if args.check:
            if not target.is_file():
                raise RuntimeError(f"Display version missing: {icao}")
            with Image.open(target) as output:
                output.verify()
        else:
            clean(source,target)
        seen.add(target.name)
    extra={x.name for x in DST.glob("*.webp")}-seen
    if extra:
        raise RuntimeError(f"Unexpected display images: {sorted(extra)}")
    print(f"PASS {len(seen)} letter-repaired display images; original SHA256 unchanged")


if __name__=="__main__":
    main()
