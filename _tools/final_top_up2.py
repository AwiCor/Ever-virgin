#!/usr/bin/env python3
"""Second top-up pass using filenames verified via Commons search."""
import json, os, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "mysteries.json")
UA   = "Mozilla/5.0 (compatible; LuxRosarii/1.0)"
API  = "https://commons.wikimedia.org/w/api.php"

ADDITIONS = [
    # joyful_4 → need 2
    ("joyful_4", "Vittore Carpaccio", "Presentation of Jesus in the Temple",
     "Accademia_-_Presentation_of_Jesus_in_the_Temple_by_Vittore_Carpaccio_Cat.44.jpg"),
    ("joyful_4", "Stephan Lochner", "Presentation in the Temple",
     "Stefan_Lochner_Darmstadt_Presentation.jpg"),

    # joyful_5 → need 2
    ("joyful_5", "Carl Heinrich Bloch", "Christ Among the Doctors",
     "Sankt_Matthaeus_Kirke_Copenhagen_altarpiece_detail1.jpg"),
    ("joyful_5", "James Tissot", "Jesus Among the Doctors",
     "Brooklyn_Museum_-_Jesus_with_the_Doctors_(Jésus_au_milieu_des_docteurs)_-_James_Tissot.jpg"),

    # luminous_1 → need 2
    ("luminous_1", "Aert de Gelder", "The Baptism of Christ (c. 1710)",
     "Gelder,_Aert_de_-_The_Baptism_of_Christ_-_c._1710.jpg"),
    ("luminous_1", "Joachim Patinir", "The Baptism of Christ",
     "Joachim_Patinir_-_The_Baptism_of_Christ_-_Google_Art_Project_2.jpg"),

    # luminous_3 → need 3
    ("luminous_3", "James Tissot", "The Sermon of the Beatitudes",
     "Brooklyn_Museum_-_The_Sermon_of_the_Beatitudes_(La_sermon_des_béatitudes)_-_James_Tissot.jpg"),
    ("luminous_3", "Carl Heinrich Bloch", "The Sermon on the Mount",
     "Bloch-SermonOnTheMount.jpg"),
    ("luminous_3", "Henrik Olrik", "Sermon on the Mount (Sankt Matthæus Kirke)",
     "Sankt_Matthaeus_Kirke_Copenhagen_altarpiece_detail1.jpg"),

    # luminous_4 → need 1
    ("luminous_4", "Lorenzo Lotto", "The Transfiguration",
     "Lorenzo_Lotto_-_Transfiguration_-_WGA13666.jpg"),

    # sorrowful_2 → need 1
    ("sorrowful_2", "Ludovico Carracci", "Flagellation of Christ",
     "Ludovico_carracci,_flagellazione_di_cristo,_olio_su_rame,_49,6x42,7_cm,_coll._privata.JPG"),

    # sorrowful_3 → need 2
    ("sorrowful_3", "Mihály Munkácsy", "Ecce Homo",
     "Munkácsy_Ecce_Homo.JPG"),
    ("sorrowful_3", "Antonello da Messina", "Ecce Homo",
     "Antonello_da_Messina_Ecce_Homo_collection_privée.jpg"),

    # glorious_1 → need 1
    ("glorious_1", "Eugène Burnand",
     "The Disciples Peter and John Running to the Sepulchre",
     "Burnand_Les_Disciples_Jean_et_Pierre_Courant_au_Sépulcre.jpg"),

    # glorious_2 → need 1
    ("glorious_2", "Benvenuto Tisi (Garofalo)", "Ascension of Christ",
     "Wga_Garofalo_Ascension_of_Christ.jpg"),

    # glorious_3 → need 1
    ("glorious_3", "Duccio di Buoninsegna", "Pentecost (Maestà)",
     "Duccio_di_Buoninsegna_-_Pentecost_-_WGA06739.jpg"),

    # glorious_4 → need 2
    ("glorious_4", "Francesco Botticini", "The Assumption of the Virgin",
     "Francesco_Botticini_-_The_Assumption_of_the_Virgin.jpg"),
    ("glorious_4", "Giovanni Battista Tiepolo", "The Assumption of the Virgin",
     "Giovanni_Battista_Tiepolo_(1696-1770)_-_The_Assumption_of_the_Virgin_(sketch_for_a_ceiling_in_the_Church_of_the_Fratta,_Friuli^)_-_1535125_-_National_Trust.jpg"),

    # glorious_5 → need 1
    ("glorious_5", "Filippo Lippi", "Coronation of the Virgin (Uffizi)",
     "Fra_Filippo_Lippi_-_Coronation_of_the_Virgin_-_WGA13215.jpg"),
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
    mystery_by_id = {}
    for s in data.values():
        for m in s["mysteries"]:
            mystery_by_id[m["id"]] = m

    added = 0
    for mid, artist, title, fname in ADDITIONS:
        m = mystery_by_id.get(mid)
        if not m: continue
        if any(p["artist"] == artist and p["title"] == title for p in m["paintings"]):
            continue
        time.sleep(1.3)
        url = resolve(fname)
        if not url:
            print(f"  MISSING  {mid:14s} {artist[:25]:25s} | {title[:40]:40s}  [{fname[:80]}]")
            continue
        if any(p["url"] == url for p in m["paintings"]):
            print(f"  dupe-url {mid:14s} {artist[:25]:25s} | {title[:40]}")
            continue
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
