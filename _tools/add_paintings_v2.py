#!/usr/bin/env python3
"""Add classical paintings to data/mysteries.json using verified URLs.

For each desired addition, this:
  1) Queries the Wikimedia Commons MediaWiki API for the exact filename
     (or searches Commons if no exact filename is given).
  2) Uses imageinfo to get a real 1280-px thumbnail URL Wikimedia serves
     without rate-limiting.
  3) Only writes the painting if a real thumbnail URL came back.

This avoids the broken-URL problem: every URL is verified to exist on
Commons before we add it, with the actual thumbnail URL Wikimedia hands
out — not a hand-built Special:FilePath URL.
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
UA   = "Mozilla/5.0 (compatible; LuxRosariiPaintingAdder/1.0)"
API  = "https://commons.wikimedia.org/w/api.php"

# Desired additions, keyed by mystery id. Each item is:
#   (artist, display_title, search_query, optional_exact_filename)
# We give the artist + display_title for what shows in the UI, the
# search_query for finding the file on Commons, and an optional filename
# if we already know it.
ADDITIONS = {
    "joyful_1": [
        ("Leonardo da Vinci", "The Annunciation (c. 1472)",
         "Leonardo da Vinci Annunciation Uffizi"),
        ("Jan van Eyck", "The Annunciation",
         "Jan van Eyck The Annunciation Washington"),
        ("Bartolomé Esteban Murillo", "The Annunciation",
         "Murillo Annunciation"),
        ("Henry Ossawa Tanner", "The Annunciation (1898)",
         "Henry Ossawa Tanner The Annunciation 1898"),
    ],
    "joyful_2": [
        ("Domenico Ghirlandaio", "The Visitation",
         "Ghirlandaio Visitation Louvre"),
        ("Mariotto Albertinelli", "The Visitation",
         "Mariotto Albertinelli Visitation 1503"),
        ("Federico Barocci", "The Visitation",
         "Federico Barocci Visitation Chiesa Nuova"),
    ],
    "joyful_3": [
        ("Hugo van der Goes", "Portinari Altarpiece — Adoration of the Shepherds",
         "Hugo van der Goes Portinari Altarpiece"),
        ("Gerard van Honthorst", "Adoration of the Shepherds",
         "Gerard van Honthorst Adoration Shepherds"),
        ("Edward Burne-Jones", "The Star of Bethlehem (1890)",
         "Edward Burne-Jones Star of Bethlehem"),
    ],
    "joyful_4": [
        ("Hans Memling", "Presentation in the Temple",
         "Hans Memling Presentation Temple"),
        ("Vittore Carpaccio", "Presentation of Jesus at the Temple",
         "Vittore Carpaccio Presentation Temple"),
        ("Giovanni Battista Tiepolo", "Presentation in the Temple",
         "Tiepolo Presentation Temple"),
    ],
    "joyful_5": [
        ("Albrecht Dürer", "Christ Among the Doctors",
         "Albrecht Dürer Christ among the Doctors 1506"),
        ("William Holman Hunt", "The Finding of the Saviour in the Temple",
         "William Holman Hunt Finding Saviour Temple"),
        ("Heinrich Hofmann", "Christ in the Temple (1881)",
         "Heinrich Hofmann Christ in the Temple"),
        ("Max Liebermann", "The Twelve-Year-Old Jesus in the Temple",
         "Max Liebermann Twelve Year Old Jesus Temple"),
    ],
    "luminous_1": [
        ("Joachim Patinir", "The Baptism of Christ",
         "Joachim Patinir Baptism of Christ"),
        ("Domenico Ghirlandaio", "Baptism of Christ",
         "Ghirlandaio Baptism of Christ Sistine"),
        ("Aert de Gelder", "The Baptism of Christ",
         "Aert de Gelder Baptism of Christ"),
    ],
    "luminous_2": [
        ("Duccio di Buoninsegna", "Marriage at Cana",
         "Duccio Marriage at Cana Maestà"),
        ("Mattia Preti", "Marriage at Cana",
         "Mattia Preti Marriage at Cana"),
        ("Gerard David", "The Marriage at Cana",
         "Gerard David Marriage at Cana Louvre"),
    ],
    "luminous_3": [
        ("Fra Angelico", "Sermon on the Mount",
         "Fra Angelico Sermon on the Mount San Marco"),
        ("James Tissot", "The Sermon of the Beatitudes",
         "James Tissot Sermon of the Beatitudes"),
        ("Carl Heinrich Bloch", "The Sermon on the Mount",
         "Carl Bloch Sermon on the Mount"),
    ],
    "luminous_4": [
        ("Lorenzo Lotto", "The Transfiguration of Christ",
         "Lorenzo Lotto Transfiguration Recanati"),
        ("Alexander Ivanov", "The Transfiguration",
         "Alexander Ivanov Transfiguration"),
    ],
    "luminous_5": [
        ("Salvador Dalí", "The Sacrament of the Last Supper (1955)",
         "Salvador Dalí Sacrament Last Supper"),
        ("Dieric Bouts", "The Last Supper",
         "Dieric Bouts Last Supper Leuven"),
        ("Jacopo Bassano", "The Last Supper",
         "Jacopo Bassano Last Supper"),
    ],
    "sorrowful_1": [
        ("Andrea Mantegna", "The Agony in the Garden",
         "Andrea Mantegna Agony in the Garden"),
        ("Giovanni Bellini", "The Agony in the Garden",
         "Giovanni Bellini Agony in the Garden National Gallery"),
        ("Heinrich Hofmann", "Christ in Gethsemane",
         "Heinrich Hofmann Christ Gethsemane"),
        ("Paul Gauguin", "Christ in the Garden of Olives (1889)",
         "Paul Gauguin Christ Garden Olives"),
    ],
    "sorrowful_2": [
        ("William-Adolphe Bouguereau", "The Flagellation of Our Lord Jesus Christ",
         "Bouguereau Flagellation Christ"),
        ("Lodovico Carracci", "The Flagellation of Christ",
         "Ludovico Carracci Flagellation"),
        ("Caravaggio", "Christ at the Column",
         "Caravaggio Christ at the Column Rouen"),
    ],
    "sorrowful_3": [
        ("Antonello da Messina", "Ecce Homo",
         "Antonello da Messina Ecce Homo"),
        ("Quentin Matsys", "Ecce Homo",
         "Quentin Matsys Ecce Homo Doge's Palace"),
        ("Andrea Mantegna", "Ecce Homo",
         "Andrea Mantegna Ecce Homo Jacquemart"),
    ],
    "sorrowful_4": [
        ("Pieter Bruegel the Elder", "The Procession to Calvary (1564)",
         "Bruegel Procession to Calvary 1564"),
        ("Sebastiano del Piombo", "Christ Carrying the Cross",
         "Sebastiano del Piombo Christ Carrying Cross Prado"),
        ("Martin Schongauer", "Christ Carrying the Cross",
         "Martin Schongauer Christ Carrying Cross"),
    ],
    "sorrowful_5": [
        ("Salvador Dalí", "Christ of Saint John of the Cross",
         "Dalí Christ of Saint John of the Cross"),
        ("Raphael", "The Mond Crucifixion",
         "Raphael Mond Crucifixion National Gallery"),
        ("Marc Chagall", "White Crucifixion (1938)",
         "Marc Chagall White Crucifixion 1938"),
    ],
    "glorious_1": [
        ("Andrea Mantegna", "The Resurrection of Christ",
         "Andrea Mantegna Resurrection Tours"),
        ("Hans Memling", "The Resurrection",
         "Hans Memling Resurrection Louvre"),
        ("Eugène Burnand", "The Disciples Peter and John Running to the Sepulchre",
         "Eugène Burnand Disciples Peter John Sepulchre"),
    ],
    "glorious_2": [
        ("Andrea Mantegna", "Ascension of Christ",
         "Andrea Mantegna Ascension Uffizi"),
        ("Salvador Dalí", "The Ascension of Christ (1958)",
         "Salvador Dalí Ascension Christ 1958"),
    ],
    "glorious_3": [
        ("Fra Angelico", "Pentecost",
         "Fra Angelico Pentecost Santa Trinita"),
        ("Duccio di Buoninsegna", "Pentecost",
         "Duccio Pentecost Maestà"),
        ("Giotto di Bondone", "Pentecost",
         "Giotto Pentecost Scrovegni"),
        ("Jean II Restout", "Pentecost (1732)",
         "Jean Restout Pentecost Louvre"),
    ],
    "glorious_4": [
        ("Francesco Botticini", "The Assumption of the Virgin",
         "Francesco Botticini Assumption Virgin National Gallery"),
        ("Giovanni Battista Tiepolo", "Assumption of the Virgin",
         "Tiepolo Assumption Virgin Prado"),
        ("Carlo Maratta", "The Assumption of the Virgin",
         "Carlo Maratta Assumption Virgin"),
    ],
    "glorious_5": [
        ("Paolo Veronese", "Coronation of the Virgin",
         "Paolo Veronese Coronation Virgin Accademia"),
        ("Pinturicchio", "Coronation of the Virgin",
         "Pinturicchio Coronation Virgin Vatican"),
        ("Albrecht Dürer", "Heller Altarpiece — Coronation of the Virgin",
         "Albrecht Dürer Heller Altarpiece Coronation Virgin"),
    ],
}


def http_json(params, retries=3, base_delay=0.6):
    """GET MediaWiki API; respect 429 with backoff."""
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    delay = base_delay
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < retries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            return None
        except Exception:
            return None
    return None


def find_image(search_query, exact_filename=None):
    """Try to find a real Commons image. Return (thumb_url, filename) or
       (None, None)."""
    # 1) If we already know the filename, resolve it directly.
    candidates = []
    if exact_filename:
        candidates.append(exact_filename)

    # 2) Search Commons in the File namespace, image extensions only.
    data = http_json({
        "action":     "query",
        "list":       "search",
        "srsearch":   search_query + " filetype:bitmap",
        "srnamespace":"6",
        "srlimit":    "10",
    })
    if data:
        for hit in data.get("query", {}).get("search", []):
            title = hit.get("title", "")
            if not title.startswith("File:"): continue
            if not re.search(r"\.(jpg|jpeg|png|tif|tiff|webp)$", title, re.I): continue
            candidates.append(title.replace("File:", "", 1))

    # 3) Resolve each candidate via imageinfo until one returns a thumb.
    for fname in candidates:
        data = http_json({
            "action": "query",
            "titles": "File:" + fname,
            "prop":   "imageinfo",
            "iiprop": "url|mime|size",
            "iiurlwidth": "1280",
        })
        if not data: continue
        pages = data.get("query", {}).get("pages", [])
        if not pages: continue
        page = pages[0]
        if page.get("missing"): continue
        info = page.get("imageinfo")
        if not info: continue
        info = info[0]
        if not info.get("mime", "").startswith("image/"): continue
        thumb = info.get("thumburl") or info.get("url")
        if thumb:
            return thumb, fname
    return None, None


def main():
    with open(PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Build a quick index from mystery_id -> mystery dict.
    mystery_by_id = {}
    for set_val in data.values():
        for m in set_val["mysteries"]:
            mystery_by_id[m["id"]] = m

    added = 0
    skipped = 0
    for mid, items in ADDITIONS.items():
        m = mystery_by_id.get(mid)
        if not m: continue
        existing_urls = {p["url"] for p in m["paintings"]}
        existing_at = {(p["artist"], p["title"]) for p in m["paintings"]}
        for artist, title, query, *rest in items:
            exact = rest[0] if rest else None
            if (artist, title) in existing_at:
                print(f"  SKIP (dupe artist+title) {mid} {artist[:20]} | {title[:40]}")
                skipped += 1
                continue
            time.sleep(0.5)
            url, fname = find_image(query, exact_filename=exact)
            if not url or url in existing_urls:
                print(f"  SKIP (no result)         {mid} {artist[:20]} | {title[:40]}")
                skipped += 1
                continue
            m["paintings"].append({
                "artist": artist,
                "title":  title,
                "url":    url,
            })
            existing_urls.add(url)
            existing_at.add((artist, title))
            added += 1
            print(f"  ADDED                    {mid} {artist[:20]:20s} | {title[:42]:42s} [file: {fname}]")

    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("\n--- Summary ---")
    print(f"  Added:   {added}")
    print(f"  Skipped: {skipped}")
    print("\n--- Final counts ---")
    for set_val in data.values():
        for m in set_val["mysteries"]:
            n = len(m["paintings"])
            tag = "OK " if n >= 10 else "LOW"
            print(f"  {tag}  {m['id']:14s} {n:>2d}  {m['name']}")


if __name__ == "__main__":
    main()
