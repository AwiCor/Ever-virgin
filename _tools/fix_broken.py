#!/usr/bin/env python3
"""Replace the 7 known-broken painting URLs with working alternates.

Strategy: query the MediaWiki API for a real 1280-px thumbnail URL for
each broken painting's file. Replace in place. If the API yields no
hit, drop the painting from its mystery array.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "mysteries.json")
UA   = "Mozilla/5.0 (compatible; LuxRosariiFixer/1.0)"
API  = "https://commons.wikimedia.org/w/api.php"

# (mystery_id, artist, title, [search_filenames_or_queries])
# We give one or more candidate filenames + a fallback search query.
FIXES = {
    ("joyful_2", "Jacopo Pontormo", "The Visitation"): [
        "Pontormo - Visitation - WGA18095.jpg",
        "Pontormo, visitazione 02.jpg",
        "Jacopo Pontormo Visitation Carmignano",
    ],
    ("luminous_2", "Hieronymus Bosch", "The Marriage Feast at Cana"): [
        "Bosch the marriagefeast at Cana Boijmans Van Beuningen.jpg",
        "Hieronymus Bosch Marriage at Cana",
    ],
    ("glorious_1", "Piero della Francesca", "The Resurrection"): [
        "Piero della Francesca - Resurrection - WGA17612.jpg",
        "Piero della Francesca - Resurrection Sansepolcro",
    ],
    ("glorious_3", "Anthony van Dyck", "Pentecost"): [
        "Anthony van Dyck - Pentecost - WGA07442.jpg",
        "Anthony van Dyck Pentecost",
    ],
    ("glorious_4", "El Greco", "The Assumption of the Virgin"): [
        "El Greco - The Assumption of the Virgin - Google Art Project.jpg",
        "El Greco Assumption of the Virgin Art Institute Chicago",
    ],
    ("glorious_5", "Fra Angelico", "Coronation of the Virgin"): [
        "Fra Angelico - Coronation of the Virgin - WGA00541.jpg",
        "Fra Angelico Coronation Virgin Louvre",
    ],
    ("glorious_5", "Gerard David (attr.)", "Coronation of the Virgin"): [
        "Gerard David Coronation of the Virgin",
        "Coronation of the Virgin Gerard David",
    ],
}


def http_json(params, retries=3, base_delay=0.6):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    delay = base_delay
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(delay); delay *= 2; continue
            return None
    return None


def resolve_filename(fname):
    """imageinfo->thumburl for an exact filename."""
    data = http_json({
        "action": "query",
        "titles": "File:" + fname,
        "prop":   "imageinfo",
        "iiprop": "url|mime",
        "iiurlwidth": "1280",
    })
    if not data: return None
    pages = data.get("query", {}).get("pages", [])
    if not pages: return None
    page = pages[0]
    if page.get("missing"): return None
    info = page.get("imageinfo")
    if not info: return None
    info = info[0]
    if not info.get("mime", "").startswith("image/"): return None
    return info.get("thumburl") or info.get("url")


def search_resolve(query, artist_hint=None):
    """Search Commons; return first image whose filename mentions artist
       (when artist_hint given) — guards against wrong-painting matches."""
    data = http_json({
        "action":     "query",
        "list":       "search",
        "srsearch":   query,
        "srnamespace":"6",
        "srlimit":    "20",
    })
    if not data: return None
    surname = None
    if artist_hint:
        # Last token of artist name, lowercased, no parentheses.
        parts = re.sub(r"[()]", "", artist_hint).split()
        if parts:
            surname = parts[-1].lower()
    for hit in data.get("query", {}).get("search", []):
        title = hit.get("title", "")
        if not title.startswith("File:"): continue
        if not re.search(r"\.(jpg|jpeg|png|tif|tiff|webp)$", title, re.I): continue
        fname = title.replace("File:", "", 1)
        if surname and surname not in fname.lower():
            # Reject hits that don't even mention the artist — guards
            # against pulling unrelated paintings.
            continue
        url = resolve_filename(fname)
        if url:
            return url
    return None


def main():
    with open(PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    mystery_by_id = {}
    for s in data.values():
        for m in s["mysteries"]:
            mystery_by_id[m["id"]] = m

    fixed = 0
    dropped = 0
    for (mid, artist, title), candidates in FIXES.items():
        m = mystery_by_id.get(mid)
        if not m: continue
        # Find the painting entry to fix in place.
        target = next((p for p in m["paintings"]
                       if p["artist"] == artist and p["title"] == title), None)
        if not target:
            print(f"  NOT FOUND: {mid}  {artist}  {title}")
            continue
        new_url = None
        for cand in candidates:
            time.sleep(0.4)
            if "/" in cand or "." in cand[-5:]:  # looks like a filename
                new_url = resolve_filename(cand)
            else:  # treat as a search query
                new_url = search_resolve(cand, artist_hint=artist)
            if new_url: break
        if new_url:
            old = target["url"]
            target["url"] = new_url
            fixed += 1
            print(f"  FIXED  {mid}  {artist} | {title}")
            print(f"           -> {new_url[:110]}")
        else:
            m["paintings"] = [p for p in m["paintings"]
                              if not (p["artist"] == artist and p["title"] == title)]
            dropped += 1
            print(f"  DROPPED {mid}  {artist} | {title}  (no working URL)")

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\n--- Summary ---")
    print(f"  Fixed:   {fixed}")
    print(f"  Dropped: {dropped}")


if __name__ == "__main__":
    main()
