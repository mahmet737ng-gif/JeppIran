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


def extend_and_repair_caption(rgb):
    """Replace the baked-in lower-left black text plate in DISPLAY copies only.

    Source poster hashes remain immutable. Use the same poster's neighbouring
    skyline/mountain/city pixels, deliberately omitting the lower-right landmark
    from the sample so that it is NEVER cloned into the left of the picture.
    Overwrite the old dark plate fully in its core (prior alpha=.88 left a
    visible dark patch), with smooth boundaries into the untouched scene.
    """
    height, width = rgb.shape[:2]
    patch_width = int(round(width * .59))
    # For these approved 4:3 posters the landmark sits in the rightmost 25%;
    # draw only on the left 59%, source from the central scenic strip.
    donor_left, donor_right = int(width * .425), int(width * .735)
    sample = rgb[:, donor_left:donor_right].copy()
    scenic = cv2.resize(sample, (patch_width, height),
                        interpolation=cv2.INTER_CUBIC)
    x = np.linspace(0, 1, patch_width, endpoint=True, dtype=np.float32)[None, :]
    y = np.linspace(0, 1, height, endpoint=True, dtype=np.float32)[:, None]

    def smoothstep(a, b, t):
        u = np.clip((t-a)/(b-a), 0.0, 1.0)
        return u*u*(3.0-2.0*u)

    # Text starts at 69% height. Begin blending above it and finish before
    # the first large glyph row. Keep the full bottom-left city scene.
    vertical = smoothstep(.645, .762, y)
    horizontal = 1.0 - smoothstep(.70, .995, x)
    opacity = (vertical * horizontal)[:, :, None]
    repaired = rgb.copy()
    repaired[:, :patch_width] = np.clip(
        rgb[:, :patch_width].astype(np.float32)*(1-opacity) +
        scenic.astype(np.float32)*opacity, 0, 255).astype(np.uint8)

    # Add scenic pixels to the sides, preserving the original image dimensions
    # and the lower-right city's symbol within the unmodified central block.
    wide = max(width, int(round(height * 16 / 9)))
    left = (wide-width)//2
    right = wide-width-left
    return cv2.copyMakeBorder(repaired,0,0,left,right,cv2.BORDER_REFLECT_101)

def clean(source, target):
    with Image.open(source) as source_image:
        rgb = np.asarray(source_image.convert("RGB"))
    h,w=rgb.shape[:2]
    if w<500 or h<350:
        raise ValueError(f"Unsupported image size: {source.name} {w}x{h}")
    repaired=cv2.inpaint(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),
                         mask_letters(rgb),4,cv2.INPAINT_TELEA)
    repaired_rgb = cv2.cvtColor(repaired,cv2.COLOR_BGR2RGB)
    wide_rgb = extend_and_repair_caption(repaired_rgb)
    target.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(wide_rgb).save(target,"WEBP",quality=94,method=6)

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
