#!/usr/bin/env python3
"""Final final pass — get the last 5 mysteries up to 10."""
import json, os, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "mysteries.json")
UA   = "Mozilla/5.0 (compatible; LuxRosarii/1.0)"
API  = "https://commons.wikimedia.org/w/api.php"

ADDITIONS = [
    # joyful_5 (9) → +1: another Christ-in-temple master
    ("joyful_5", "Albrecht Dürer", "Twelve-Year-Old Jesus in the Temple",
     "Albrecht_Dürer_-_Jesus_among_the_Doctors_-_WGA07054.jpg"),

    # glorious_2 (9) → +1: another Ascension
    ("glorious_2", "Andrea Mantegna", "Ascension of Christ (Uffizi Triptych)",
     "Andrea_Mantegna,_Uffizi_Tryptich,_c1463-64.jpg"),

    # glorious_3 (9) → +1: another Pentecost master
    ("glorious_3", "Giotto di Bondone", "Pentecost (London)",
     "Giotto._Pentecost._1320-25_National_Gallery,_London..jpg"),

    # glorious_4 (9) → +1: another Assumption
    ("glorious_4", "Tiziano Vecellio (Titian)", "Assumption of the Virgin (detail)",
     "Tizian_041.jpg"),

    # glorious_5 (9) → +1: another Coronation
    ("glorious_5", "Diego Velázquez", "Coronation of the Virgin (Prado, 1645)",
     "Diego_Velázquez_-_Coronation_of_the_Virgin_-_Prado.jpg"),
]


def http_json(params, retries=4):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    delay = 1.0
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except Exception:
            if attempt < retries - 1:
                time.sleep(delay); delay *= 2; continue
            return None
    return None


def resolve(fname, width=1280):
    data = http_json({
        "action": "query",
        "titles": "File:" + fname,
        "prop":   "imageinfo",
        "iiprop": "url|mime",
        "iiurlwidth": str(width),
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


def main():
    with open(PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    mid_to_m = {}
    for s in data.values():
        for m in s["mysteries"]:
            mid_to_m[m["id"]] = m

    added = 0
    for mid, artist, title, fname in ADDITIONS:
        m = mid_to_m.get(mid)
        if not m: continue
        if any(p["url"].endswith(fname.replace(" ", "_")) for p in m["paintings"]): continue
        if any(p["artist"] == artist and p["title"] == title for p in m["paintings"]): continue
        time.sleep(1.0)
        url = resolve(fname)
        if not url:
            print(f"  MISSING  {mid} | {fname[:80]}")
            continue
        if any(p["url"] == url for p in m["paintings"]): continue
        m["paintings"].append({"artist": artist, "title": title, "url": url})
        added += 1
        print(f"  ADDED    {mid:14s} {artist[:25]:25s} | {title[:40]}")

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nAdded: {added}\n")
    for s in data.values():
        for m in s["mysteries"]:
            n = len(m["paintings"])
            tag = "OK " if n >= 10 else "LOW"
            print(f"  {tag}  {m['id']:14s} {n:>2d}  {m['name']}")


if __name__ == "__main__":
    main()
