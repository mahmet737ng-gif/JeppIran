#!/usr/bin/env python3
"""Probe / parse IRIMO public aviation weather HTML blocks 601 (METAR) and 588 (TAF).

IRIMO may block foreign hosting networks. Never equate a failed request with
'no reports', and never publish stale reports as current observations.
No scraping of private content, browser cookies, or bypass of rate limits.
"""
from __future__ import annotations

import argparse
import calendar
import datetime as dt
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://www.irimo.ir/far/index.php"
BLOCKS = {"metar": 601, "taf": 588}
UTC = dt.timezone.utc
MAX_BYTES = 4_000_000
STATION_ID = re.compile(r"^stat_info_(\d+)_([A-Z0-9]{4})$")
METAR_ISSUE = re.compile(r"^(?:METAR|SPECI)\s+[A-Z0-9]{4}\s+(\d{2})(\d{2})(\d{2})Z\b")
TAF_ISSUE = re.compile(r"^TAF(?:\s+(?:AMD|COR))?\s+[A-Z0-9]{4}\s+(\d{2})(\d{2})(\d{2})Z\b")
TAF_VALID = re.compile(r"\b(\d{2})(\d{2})/(\d{2})(\d{2})\b")


class TooltipParser(HTMLParser):
    def __init__(self, block: int):
        super().__init__(convert_charrefs=True)
        self.block = block
        self.stack: list[tuple[str | None, bool, list[str]]] = []
        self.reports: dict[str, str] = {}

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "br":
            for code, active, lines in reversed(self.stack):
                if active:
                    lines.append("\n")
                    break
        if tag.lower() != "div":
            return
        values = dict(attrs)
        code = self.stack[-1][0] if self.stack else None
        found = STATION_ID.match(values.get("id") or "")
        if found:
            code = found.group(2) if int(found.group(1)) == self.block else None
        active = bool(code and "bodytooltip" in (values.get("class") or "").split())
        self.stack.append((code, active, []))

    def handle_data(self, data):
        for code, active, lines in reversed(self.stack):
            if active:
                lines.append(data)
                break

    def handle_endtag(self, tag):
        if tag.lower() != "div" or not self.stack:
            return
        code, active, lines = self.stack.pop()
        if active and code:
            # Preserve line breaks but normalize inconsistent whitespace.
            report = re.sub(r"\s+", " ", "".join(lines)).strip()
            if report:
                self.reports[code] = report


def extract(html: str, kind: str) -> dict[str, str]:
    parser = TooltipParser(BLOCKS[kind])
    parser.feed(html)
    expected = re.compile(r"^(?:METAR|SPECI)\s+" if kind == "metar" else r"^TAF(?:\s+(?:AMD|COR))?\s+", re.I)
    return {code: text for code, text in parser.reports.items()
            if expected.match(text) and re.search(r"\b" + code + r"\b", text[:35], re.I)}


def candidate(day: int, hour: int, minute: int, now: dt.datetime) -> dt.datetime:
    # Resolve DDHHMM against a reference time; handle adjacent month rollover.
    options = []
    for shift in (-1, 0, 1):
        year = now.year
        month = now.month + shift
        if month <= 0:
            year -= 1
            month += 12
        if month > 12:
            year += 1
            month -= 12
        if 1 <= day <= calendar.monthrange(year, month)[1]:
            try:
                options.append(dt.datetime(year, month, day, hour, minute, tzinfo=UTC))
            except ValueError:
                pass
    if not options:
        raise ValueError("Invalid day or time in aviation report")
    return min(options, key=lambda t: abs((t - now).total_seconds()))


def is_current(kind: str, report: str, now: dt.datetime) -> bool:
    now = now.astimezone(UTC)
    found = (METAR_ISSUE if kind == "metar" else TAF_ISSUE).match(report)
    if not found:
        return False
    try:
        issued = candidate(*(int(x) for x in found.groups()), now)
        lag = (now - issued).total_seconds()
        if lag < -5 * 60:
            return False
        if kind == "metar":
            return lag <= 3 * 3600
        if lag > 36 * 3600:
            return False
        valid = TAF_VALID.search(report[found.end():])
        if not valid:
            return False
        a, b, c, d = (int(x) for x in valid.groups())
        start = candidate(a, b, 0, issued)
        # End must be later than start (often in the next month).
        end = candidate(c, d, 0, start + dt.timedelta(hours=24))
        if end <= start:
            nextmonth = start.replace(day=28) + dt.timedelta(days=4)
            try:
                end = nextmonth.replace(day=c, hour=d, minute=0, second=0, microsecond=0)
            except ValueError:
                return False
        return issued <= now + dt.timedelta(minutes=5) and start <= now + dt.timedelta(hours=2) and now < end
    except ValueError:
        return False


def fetch_block(block: int, timeout=18) -> str:
    query = urllib.parse.urlencode({
        "module": "pmk", "type": "user", "func": "showBlock",
        "bid": str(block), "standalone": "1",
    })
    req = urllib.request.Request(
        BASE + "?" + query,
        headers={"User-Agent": "Mozilla/5.0 (compatible; JEPPIRAN-IRIMO-Weather/1.0)",
                 "Accept": "text/html,application/xhtml+xml"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        content_type = response.headers.get("Content-Type", "")
        if "html" not in content_type.lower():
            raise ValueError("Unexpected IRIMO content type " + content_type)
        raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Oversized IRIMO response")
        # The original IRIMO page declares UTF-8.
        html = raw.decode("utf-8", errors="replace")
        if "stat_info_" not in html:
            raise ValueError("No aviation station elements in IRIMO block")
        return html


def run(now: dt.datetime | None = None) -> dict:
    now = (now or dt.datetime.now(UTC)).astimezone(UTC)
    result = {"schema": "jeppiran-irimo-probe/v1",
              "generated_at": now.isoformat(), "source": "Iran Meteorological Organization",
              "blocks": {}, "stations": {}}
    for kind, block in BLOCKS.items():
        try:
            page = fetch_block(block)
            items = extract(page, kind)
            if not items:
                raise ValueError("No valid " + kind.upper() + " reports extracted")
            n_current = 0
            for code, report in items.items():
                current = is_current(kind, report, now)
                row = result["stations"].setdefault(code, {})
                row[kind] = {"raw": report, "current": current}
                n_current += int(current)
            result["blocks"][kind] = {"status": "available",
                                      "block": block, "reports": len(items),
                                      "current_reports": n_current}
            print("IRIMO", kind.upper(), "block", block, "stations", len(items),
                  "time-valid", n_current, flush=True)
        except Exception as exc:
            result["blocks"][kind] = {"status": "unavailable", "block": block,
                                      "error": type(exc).__name__ + ": " + str(exc)[:170]}
            print("IRIMO", kind.upper(), "block", block, "unavailable:",
                  result["blocks"][kind]["error"], flush=True)
    ahwaz = result["stations"].get("OIAW", {})
    for kind in BLOCKS:
        report = ahwaz.get(kind)
        print("OIAW", kind.upper(), "current" if report and report["current"]
              else "not verified current", flush=True)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="/tmp/jeppiran-irimo-probe.json")
    args = parser.parse_args()
    output = run()
    Path(args.out).write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Probe result saved:", args.out)
