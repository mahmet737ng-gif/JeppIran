#!/usr/bin/env python3
"""Publish one-hop binary deltas to the newest signed Android APK.

Older installed versions download ONLY the patch matching their exact APK
SHA-256. Devices outside the retained direct-patch window download the latest
full APK once. The release metadata is published last, after every asset.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

REPOSITORY = "mahmet737ng-gif/JeppIran"
RELEASE = "jeppiran-test"
# The stable release is at GitHub's 1000-asset limit; do not add new APKs.
# Keep its app-update.json pointer and historical APKs intact.
# Store each target's full APK and verified deltas under a distinct release.
def target_release(version_code):
    return f"jeppiran-android-{version_code}"

def asset_base(release_tag):
    return f"https://github.com/{REPOSITORY}/releases/download/{release_tag}/"
NUMERIC_APK = re.compile(r"\d+\.\d+\.apk\Z")
VERSION_CODE = re.compile(r"\bversionCode='(\d+)'")

def execute(*cmd):
    result = subprocess.run(list(map(str, cmd)), check=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True)
    return result.stdout

def checksum(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()

def apk_version_code(path, aapt):
    output = execute(aapt, "dump", "badging", path)
    match = VERSION_CODE.search(output)
    if not match:
        raise ValueError(f"Missing versionCode in {path}")
    return int(match.group(1))

def release_assets():
    info = json.loads(execute("gh", "api",
        f"repos/{REPOSITORY}/releases/tags/{RELEASE}"))
    return info.get("assets", [])

def publish(apk, target_code, version_name, limit, aapt):
    if not apk.is_file() or not apk.stat().st_size:
        raise ValueError("Signed APK does not exist")
    if target_code != apk_version_code(apk, aapt):
        raise ValueError("APK versionCode does not match release metadata")
    sha = checksum(apk)
    total = apk.stat().st_size
    current_name = f"{version_name}.apk"
    bundle_tag = target_release(target_code)
    bundle_base = asset_base(bundle_tag)
    if not NUMERIC_APK.fullmatch(current_name):
        raise ValueError("Only numeric versionName APK releases are supported")

    # Note: the metadata from the last successful release remains live until
    # the new APK and *all* referenced deltas have been uploaded.
    try:
        assets = release_assets()
    except subprocess.CalledProcessError:
        execute("gh", "release", "create", RELEASE, "--title",
                "JeppIran Android APK", "--notes",
                "Latest verified Android installation package.")
        assets = []

    previous_apks = sorted(
        [a for a in assets if NUMERIC_APK.fullmatch(a["name"])],
        key=lambda a: a.get("updated_at", ""),
        reverse=True
    )
    patches = []
    visited_versions = set()
    with tempfile.TemporaryDirectory(prefix="jeppiran-delta-") as temp:
        workspace = Path(temp)
        candidates = previous_apks[:limit]
        for asset in candidates:
            name = asset["name"]
            source = workspace / name
            try:
                execute("gh", "release", "download", RELEASE,
                        "--pattern", name, "--dir", workspace, "--clobber")
                source_code = apk_version_code(source, aapt)
                if source_code >= target_code or source_code in visited_versions:
                    continue
                visited_versions.add(source_code)
                source_sha = checksum(source)
                patch_name = f"JeppIran-{source_code}-to-{target_code}.bsdiff"
                delta = workspace / patch_name
                execute("bsdiff", source, apk, delta)
                if delta.stat().st_size >= total:
                    print(f"Full APK cheaper for {name}; leaving full fallback")
                    continue

                # Never advertise a patch without checking it produces the
                # exact signed target APK, byte-for-byte (signature preserved).
                reconstructed = workspace / "verified.apk"
                execute("bspatch", source, reconstructed, delta)
                if checksum(reconstructed) != sha:
                    raise ValueError(f"Failed delta integrity test for {name}")
                reconstructed.unlink()

                patches.append({
                    "fromVersionCode": source_code,
                    "toVersionCode": target_code,
                    "fromSha256": source_sha,
                    "toSha256": sha,
                    "patchUrl": bundle_base + patch_name,
                    "patchSha256": checksum(delta),
                    "patchSizeBytes": delta.stat().st_size
                })
                print(f"Direct {name} -> {version_name}: {delta.stat().st_size} bytes", flush=True)
            except (subprocess.CalledProcessError, OSError, ValueError) as error:
                # One unavailable historic APK does not prevent a full update.
                # All listed patches, however, have been verified.
                print(f"Skipped historical APK {name}: {error}", flush=True)
                continue

        # Only patches aimed at the current latest version may appear in the
        # active manifest; no chained version hops are possible.
        patches.sort(key=lambda entry: entry["fromVersionCode"])
        metadata = {
            "versionCode": target_code,
            "versionName": version_name,
            "apkUrl": bundle_base + current_name,
            "apkSizeBytes": total,
            "sha256": sha,
            "publishedAt": datetime.datetime.now(
                datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
            "updateMode": "direct-delta-or-full",
            "patches": patches,
        }

        # Publish under a fresh version-specific tag: the stable release
        # already has 1000 assets and cannot accept new APKs or patch names.
        try:
            execute("gh", "release", "view", bundle_tag)
        except subprocess.CalledProcessError:
            execute("gh", "release", "create", bundle_tag,
                    "--title", f"JEPPIRAN Android {version_name} ({target_code})",
                    "--notes", "Signed APK and independently verified one-hop updates.")
        execute("gh", "release", "upload", bundle_tag, apk, "--clobber")
        for patch in patches:
            patch_path = workspace / Path(patch["patchUrl"]).name
            execute("gh", "release", "upload", bundle_tag, patch_path,
                    "--clobber")
        # Atomically point installed apps to the new release LAST.
        # This replaces the existing stable pointer asset, not a new asset.
        destination = workspace / "app-update.json"
        destination.write_text(json.dumps(metadata, indent=2) + "\n",
                               encoding="utf-8")
        execute("gh", "release", "upload", RELEASE, destination,
                "--clobber")
        print(f"Published {version_name} with {len(patches)} direct deltas; "
              f"others download the full latest APK", flush=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--version-code", type=int, required=True)
    parser.add_argument("--version-name", required=True)
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    if not 1 <= args.limit <= 50:
        parser.error("--limit must be between 1 and 50")
    aapt = Path(os.environ.get("ANDROID_HOME", "")) / "build-tools" / "36.0.0" / "aapt"
    if not aapt.is_file():
        raise SystemExit(f"Android aapt tool not found at {aapt}")
    publish(args.apk.resolve(), args.version_code, args.version_name,
            args.limit, aapt)

if __name__ == "__main__":
    main()
