#!/usr/bin/env python3
"""Validate every painting URL in data/mysteries.json. For any URL that
fails, try to resolve a working replacement using the MediaWiki API.

Strategy:
  1) Direct HEAD-check the URL with a real browser-like user agent. If it
     resolves to an image, keep it.
  2) If the URL is a Wikimedia Special:FilePath URL, treat the path
     segment as the filename and query the MediaWiki API to get the real
     image URL (or confirm the file is missing).
  3) If a file is missing, search Wikimedia Commons for an alternate file
     matching the artist + title; pick the first viable image hit.
  4) If nothing works, drop the painting from the array.

Run serially with delays to avoid Wikimedia rate-limiting (429).
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "mysteries.json")
UA   = "Mozilla/5.0 (LuxRosariiPaintingResolver/1.0)"

API  = "https://commons.wikimedia.org/w/api.php"


def http(url, expect_json=False, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read()
        ctype = r.headers.get("Content-Type", "")
        return r.status, ctype, body, r.geturl()


def head_ok(url):
    """True iff the URL eventually returns an image."""
    try:
        # Use a range to avoid downloading the body.
        req = urllib.request.Request(url, headers={
            "User-Agent": UA,
            "Range": "bytes=0-512",
        })
        with urllib.request.urlopen(req, timeout=20) as r:
            ctype = r.headers.get("Content-Type", "")
            return (200 <= r.status < 300 or r.status == 206) and ctype.startswith("image/")
    except Exception:
        return False


def api_query(params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    try:
        status, _, body, _ = http(url)
        if status != 200: return None
        return json.loads(body)
    except Exception:
        return None


def extract_filename_from_special_filepath(url):
    """https://commons.wikimedia.org/wiki/Special:FilePath/Foo.jpg?width=...
       -> Foo.jpg"""
    m = re.match(r"https?://commons\.wikimedia\.org/wiki/Special:FilePath/([^?]+)", url)
    if not m: return None
    return urllib.parse.unquote(m.group(1))


def resolve_filename(filename, want_width=1280):
    """Use the API to fetch the real image URL for File:<filename>.
       Returns (url, real_filename) or (None, None) if missing."""
    data = api_query({
        "action":  "query",
        "titles":  "File:" + filename,
        "prop":    "imageinfo",
        "iiprop":  "url|mime|size",
        "iiurlwidth": str(want_width),
    })
    if not data: return None, None
    pages = data.get("query", {}).get("pages", [])
    if not pages: return None, None
    page = pages[0]
    if page.get("missing"): return None, None
    info = page.get("imageinfo")
    if not info: return None, None
    info = info[0]
    if not (info.get("mime", "").startswith("image/")): return None, None
    real_title = page.get("title", "")
    real_filename = real_title.replace("File:", "", 1)
    # Prefer the resized thumbnail; fall back to original.
    url = info.get("thumburl") or info.get("url")
    return url, real_filename


def search_for(artist, title, prefer_keywords=None):
    """Search Commons for files matching the artist + title. Returns the
       first viable image's URL, or None."""
    q = artist + " " + title
    data = api_query({
        "action":     "query",
        "list":       "search",
        "srsearch":   q,
        "srnamespace":"6",      # File namespace
        "srlimit":    "10",
    })
    if not data: return None, None
    hits = data.get("query", {}).get("search", [])
    for h in hits:
        title_ = h.get("title", "")
        if not title_.startswith("File:"): continue
        # Skip svg, audio, video
        if not re.search(r"\.(jpg|jpeg|png|tif|tiff|webp)$", title_, re.I): continue
        fname = title_.replace("File:", "", 1)
        url, real = resolve_filename(fname)
        if url:
            return url, real
    return None, None


def main():
    with open(PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    changes = []
    dropped = []
    kept = 0
    for set_val in data.values():
        for m in set_val["mysteries"]:
            new_paintings = []
            for p in m["paintings"]:
                orig_url = p["url"]
                if head_ok(orig_url):
                    new_paintings.append(p)
                    kept += 1
                    continue
                # Direct URL is dead. If it's a Special:FilePath URL, try
                # to resolve via API; otherwise search.
                fname = extract_filename_from_special_filepath(orig_url)
                resolved_url = None
                resolved_filename = None
                if fname:
                    resolved_url, resolved_filename = resolve_filename(fname)
                    time.sleep(0.25)
                if not resolved_url:
                    resolved_url, resolved_filename = search_for(p["artist"], p["title"])
                    time.sleep(0.4)
                if resolved_url and head_ok(resolved_url):
                    p["url"] = resolved_url
                    new_paintings.append(p)
                    changes.append((m["id"], p["artist"], p["title"], orig_url, resolved_url, resolved_filename))
                    print(f"  RESOLVED  {m['id']:14s} {p['artist'][:24]:24s} | {p['title'][:40]}")
                    print(f"                                                  -> {resolved_url[:90]}")
                else:
                    dropped.append((m["id"], p["artist"], p["title"], orig_url))
                    print(f"  DROPPED   {m['id']:14s} {p['artist'][:24]:24s} | {p['title'][:40]}")
                time.sleep(0.15)
            m["paintings"] = new_paintings

    # Write only if there were changes
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("\n--- Summary ---")
    print(f"  Kept:     {kept}")
    print(f"  Resolved: {len(changes)}")
    print(f"  Dropped:  {len(dropped)}")

    # Report final counts per mystery
    print("\n--- Final painting counts ---")
    for set_val in data.values():
        for m in set_val["mysteries"]:
            n = len(m["paintings"])
            tag = "OK " if n >= 10 else "LOW"
            print(f"  {tag}  {m['id']:14s} {n:>2d}  {m['name']}")


if __name__ == "__main__":
    main()
