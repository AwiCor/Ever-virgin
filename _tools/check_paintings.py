#!/usr/bin/env python3
"""Validate every painting URL in data/mysteries.json.

Uses real GET requests (not Range, which Wikimedia rate-limits to 429
when fired in parallel). Sleeps briefly between requests. Reports only
truly-dead URLs.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "mysteries.json")
UA   = "Mozilla/5.0 (compatible; LuxRosariiPaintingChecker/1.0)"


def check(url, timeout=25):
    """Return ("ok", ctype) for an image, or ("BAD", explanation)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            ctype = r.headers.get("Content-Type", "")
            if r.status == 200 and ctype.lower().startswith("image/"):
                # Read 1 KB to confirm the body actually returns bytes.
                _ = r.read(1024)
                return "ok", ctype
            return "BAD", f"status={r.status} ctype={ctype}"
    except urllib.error.HTTPError as e:
        return "BAD", f"HTTP {e.code} {e.reason}"
    except Exception as e:
        return "BAD", f"{type(e).__name__}: {e}"


def main():
    with open(PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    jobs = []
    for set_val in data.values():
        for m in set_val["mysteries"]:
            for p in m["paintings"]:
                jobs.append((m["id"], p["artist"], p["title"], p["url"]))

    print(f"Checking {len(jobs)} paintings serially (≈0.5s each, ~{len(jobs)/2:.0f}s total)...\n")

    broken = []
    for i, (mid, artist, title, url) in enumerate(jobs, 1):
        result, info = check(url)
        if result == "BAD":
            broken.append((mid, artist, title, info, url))
            print(f"  [{i}/{len(jobs)}] BAD  {mid:14s} {artist[:25]:25s} | {title[:40]:40s}  {info}")
        else:
            print(f"  [{i}/{len(jobs)}] ok   {mid:14s} {artist[:25]:25s} | {title[:40]:40s}")
        time.sleep(0.4)

    print(f"\n--- Summary ---")
    print(f"  OK:     {len(jobs) - len(broken)} / {len(jobs)}")
    print(f"  Broken: {len(broken)}")
    if broken:
        print(f"\n--- Broken URLs ---")
        for mid, artist, title, info, url in broken:
            print(f"  {mid:14s} {artist}")
            print(f"    {title}")
            print(f"    {info}")
            print(f"    {url}")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
