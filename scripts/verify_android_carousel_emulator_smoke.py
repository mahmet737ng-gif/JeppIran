#!/usr/bin/env python3
"""Smoke-check the INSTALLED Android QA APK, not just browser rendering."""
import re
import subprocess
import time
from pathlib import Path
from xml.etree import ElementTree as ET

PACKAGE = "com.tareghmsr.jeppiran.phoneqa"
OUT = Path("app/build/qa-emulator-screenshots")
OUT.mkdir(parents=True, exist_ok=True)

def adb(*args, check=True):
    return subprocess.run(["adb", *args], check=check, text=True, capture_output=True)

def dump_nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/qa-window.xml")
    xml = adb("exec-out", "cat", "/sdcard/qa-window.xml").stdout
    return list(ET.fromstring(xml).iter("node"))

def tap_node(node):
    bounds = node.attrib.get("bounds", "")
    points = [int(a) for a in re.findall(r"\d+", bounds)]
    if len(points) != 4:
        raise AssertionError("Invalid UI bounds: " + bounds)
    x = (points[0] + points[2]) // 2
    y = (points[1] + points[3]) // 2
    adb("shell", "input", "tap", str(x), str(y))

def screenshot(name):
    destination = OUT / name
    with destination.open("wb") as f:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, stdout=f)
    if destination.stat().st_size < 4000:
        raise AssertionError("Screenshot unexpectedly empty: " + str(destination))
    print("Captured:", destination)

adb("wait-for-device")
adb("shell", "am", "start", "-n", PACKAGE + "/com.tareghmsr.jeppiran.SplashActivity")
time.sleep(8)
nodes = dump_nodes()
agree = next((n for n in nodes if n.attrib.get("text", "").strip().upper() == "AGREE"), None)
if agree is not None:
    tap_node(agree)
    time.sleep(8)
else:
    print("No first-run notice visible; checking launched UI")
screenshot("01-carousel-landing.png")
logs = adb("logcat", "-d", "-s", "JeppIranCarouselQA:I", "*:S").stdout
if "previewLanding=true renderedCarousel=true" not in logs:
    print(logs[-6500:])
    raise AssertionError("Installed APK did not show its Carousel home. Refusing to publish QA APK.")
print("PASS: installed Android QA app actually opened Carousel, not original Classic home")

# Interact with real screen navigation, not a JavaScript-only browser harness.
nodes = dump_nodes()
update = next((n for n in nodes if n.attrib.get("text", "").strip().upper() == "UPDATES"), None)
if update is not None:
    tap_node(update)
    time.sleep(3)
    screenshot("02-native-updates.png")
    nodes = dump_nodes()
    if not any("TERMINAL CHARTS" in n.attrib.get("text", "").upper() for n in nodes):
        raise AssertionError("UPDATES button did not open unified native updater")
    adb("shell", "input", "keyevent", "4")
    time.sleep(2)
    screenshot("03-back-to-carousel.png")
else:
    print("WARNING: Android Accessibility did not expose the WebView UPDATES link; screen saved")
print("PASS: Android emulator startup smoke test")
