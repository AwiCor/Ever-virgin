#!/usr/bin/env python3
"""Top up under-10 mysteries with verified paintings (MediaWiki API).

Each candidate is validated by requiring the artist's surname to appear
in the resolved filename, which guards against the wrong-painting-match
problem.
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
UA   = "Mozilla/5.0 (compatible; LuxRosariiTopUp/1.0)"
API  = "https://commons.wikimedia.org/w/api.php"

# (artist, display_title, search_query)
CANDIDATES = {
    "joyful_3": [
        ("Sandro Botticelli", "Adoration of the Magi", "Botticelli Adoration of the Magi Uffizi"),
        ("Albrecht Dürer", "Nativity (Paumgartner Altarpiece)", "Dürer Paumgartner Altarpiece Nativity"),
        ("Gerard van Honthorst", "Adoration of the Shepherds", "Honthorst Adoration of the Shepherds"),
    ],
    "joyful_4": [
        ("Hans Memling", "Presentation in the Temple", "Memling Presentation Temple Washington"),
        ("Giovanni Battista Tiepolo", "Presentation in the Temple", "Tiepolo Presentation Temple"),
        ("Vittore Carpaccio", "Presentation in the Temple", "Carpaccio Presentation Temple"),
        ("Stephan Lochner", "Presentation in the Temple", "Stephan Lochner Presentation Temple"),
    ],
    "joyful_5": [
        ("William Holman Hunt", "The Finding of the Saviour in the Temple", "Hunt Finding Saviour Temple"),
        ("Albrecht Dürer", "Christ Among the Doctors", "Dürer Christ among the Doctors 1506"),
    ],
    "luminous_1": [
        ("Joachim Patinir", "The Baptism of Christ", "Patinir Baptism Christ"),
        ("Aert de Gelder", "The Baptism of Christ", "Gelder Baptism Christ"),
    ],
    "luminous_3": [
        ("Cosimo Rosselli", "Sermon on the Mount", "Cosimo Rosselli Sermon Mount Sistine"),
        ("Jan Brueghel the Elder", "Christ Preaching by the Sea of Galilee", "Jan Brueghel Christ Preaching Sea Galilee"),
        ("Henrik Olrik", "Sermon on the Mount", "Olrik Sermon Mount"),
    ],
    "luminous_4": [
        ("Lorenzo Lotto", "The Transfiguration", "Lotto Transfiguration Recanati"),
    ],
    "sorrowful_1": [
        ("Andrea Mantegna", "The Agony in the Garden", "Mantegna Agony Garden London"),
        ("Heinrich Hofmann", "Christ in Gethsemane", "Hofmann Christ Gethsemane"),
        ("Giovanni Bellini", "The Agony in the Garden", "Bellini Agony Garden"),
    ],
    "sorrowful_2": [
        ("William-Adolphe Bouguereau", "The Flagellation of Our Lord Jesus Christ", "Bouguereau Flagellation"),
        ("Ludovico Carracci", "Flagellation of Christ", "Ludovico Carracci Flagellation"),
    ],
    "sorrowful_3": [
        ("Albrecht Dürer", "Christ Crowned with Thorns", "Dürer Christ Crowned with Thorns"),
        ("Mihály Munkácsy", "Ecce Homo", "Munkácsy Ecce Homo"),
    ],
    "glorious_1": [
        ("Eugène Burnand", "The Disciples Peter and John Running to the Sepulchre", "Burnand disciples Peter John sepulchre"),
        ("Carl Heinrich Bloch", "The Resurrection", "Carl Bloch Resurrection"),
        ("Andrea Mantegna", "Resurrection of Christ", "Mantegna Resurrection Christ"),
    ],
    "glorious_2": [
        ("Andrea Mantegna", "Ascension of Christ", "Mantegna Ascension Christ Uffizi"),
        ("Garofalo", "Ascension of Christ", "Garofalo Ascension Christ"),
    ],
    "glorious_3": [
        ("Fra Angelico", "Pentecost", "Fra Angelico Pentecost"),
        ("Duccio di Buoninsegna", "Pentecost", "Duccio Pentecost Maesta"),
        ("Giotto di Bondone", "Pentecost", "Giotto Pentecost Padua"),
        ("Jean II Restout", "Pentecost", "Restout Pentecost Louvre"),
        ("Tiziano Vecellio", "Pentecost", "Titian Pentecost Salute"),
    ],
    "glorious_4": [
        ("Tiziano Vecellio", "Assumption of the Virgin (Frari)", "Titian Assumption Frari"),
        ("Giovanni Battista Tiepolo", "The Assumption of the Virgin", "Tiepolo Assumption Virgin"),
        ("Carlo Maratta", "Assumption of the Virgin", "Maratta Assumption Virgin"),
    ],
    "glorious_5": [
        ("Diego Velázquez", "Coronation of the Virgin", "Velázquez Coronation Virgin Prado"),
        ("Paolo Veronese", "Coronation of the Virgin", "Veronese Coronation Virgin Accademia"),
        ("Pinturicchio", "Coronation of the Virgin", "Pinturicchio Coronation Virgin Vatican"),
        ("Giotto di Bondone", "Coronation of the Virgin (Baroncelli)", "Giotto Baroncelli Coronation Virgin"),
        ("Filippo Lippi", "Coronation of the Virgin", "Filippo Lippi Coronation Virgin Uffizi"),
        ("Enguerrand Quarton", "The Coronation of the Virgin (1454)", "Quarton Coronation Virgin"),
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


def find_for(artist, query):
    """Search Commons for query, require artist surname in filename."""
    # Last token of artist name as surname guess.
    parts = re.sub(r"[()'·,]", "", artist).split()
    if not parts: return None
    # Try first the full surname, then fall back to second-to-last if "the
    # Elder/Younger" suffixes throw off the simple "last word" heuristic.
    surname_candidates = [parts[-1].lower()]
    if len(parts) >= 2 and parts[-2].lower() not in {"the", "de", "del", "van", "von"}:
        surname_candidates.append(parts[-2].lower())
    data = http_json({
        "action":     "query",
        "list":       "search",
        "srsearch":   query,
        "srnamespace":"6",
        "srlimit":    "25",
    })
    if not data: return None
    for hit in data.get("query", {}).get("search", []):
        title = hit.get("title", "")
        if not title.startswith("File:"): continue
        if not re.search(r"\.(jpg|jpeg|png|tif|tiff|webp)$", title, re.I): continue
        fname = title.replace("File:", "", 1)
        fl = fname.lower()
        if not any(sn in fl for sn in surname_candidates): continue
        url = resolve(fname)
        if url: return url, fname
    return None, None


def head_ok(url):
    """Quick HEAD-ish check (GET with no body read)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            ctype = r.headers.get("Content-Type", "")
            return r.status == 200 and ctype.lower().startswith("image/")
    except Exception:
        return False


def main():
    with open(PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    mystery_by_id = {}
    for s in data.values():
        for m in s["mysteries"]:
            mystery_by_id[m["id"]] = m

    added = 0
    for mid, cands in CANDIDATES.items():
        m = mystery_by_id.get(mid)
        if not m: continue
        existing_at = {(p["artist"], p["title"]) for p in m["paintings"]}
        existing_urls = {p["url"] for p in m["paintings"]}
        for artist, title, query in cands:
            if (artist, title) in existing_at:
                continue
            if len(m["paintings"]) >= 12:
                break  # don't overstuff a mystery
            time.sleep(0.45)
            res = find_for(artist, query)
            if not res or not res[0]:
                print(f"  no result  {mid:14s} {artist[:25]:25s} | {title[:40]}")
                continue
            url, fname = res
            if url in existing_urls:
                continue
            if not head_ok(url):
                print(f"  dead url   {mid:14s} {artist[:25]:25s} | {title[:40]}")
                continue
            m["paintings"].append({"artist": artist, "title": title, "url": url})
            existing_at.add((artist, title))
            existing_urls.add(url)
            added += 1
            print(f"  ADDED      {mid:14s} {artist[:25]:25s} | {title[:40]:40s} [{fname}]")

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nAdded: {added}")
    print("\n--- Counts ---")
    for s in data.values():
        for m in s["mysteries"]:
            n = len(m["paintings"])
            tag = "OK " if n >= 10 else "LOW"
            print(f"  {tag}  {m['id']:14s} {n:>2d}  {m['name']}")


if __name__ == "__main__":
    main()
