#!/usr/bin/env python3
"""Final top-up using filenames verified via Wikimedia Commons search."""
import json, os, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "mysteries.json")
UA   = "Mozilla/5.0 (compatible; LuxRosariiFinalTopUp/1.0)"
API  = "https://commons.wikimedia.org/w/api.php"

# (mystery_id, artist, title, filename)  --  filenames verified via search
ADDITIONS = [
    # joyful_4 (was 8) -> need 2
    ("joyful_4", "Vittore Carpaccio", "Presentation of Jesus at the Temple",
     "Vittore_Carpaccio_-_Presentation_of_Jesus_at_the_Temple_-_WGA04576.jpg"),
    ("joyful_4", "Stephan Lochner", "Presentation of Jesus in the Temple",
     "Stefan_Lochner_-_Presentation_of_Christ_in_the_Temple_-_WGA13355.jpg"),

    # joyful_5 (was 8) -> need 2
    ("joyful_5", "William Holman Hunt", "The Finding of the Saviour in the Temple",
     "William_Holman_Hunt_-_The_Finding_of_the_Saviour_in_the_Temple.jpg"),
    ("joyful_5", "Heinrich Hofmann", "Christ in the Temple",
     "Heinrich_Hofmann_Christ_in_the_Temple_1881.png"),

    # luminous_1 (was 8) -> need 2
    ("luminous_1", "Joachim Patinir", "The Baptism of Christ",
     "Patinir,_Joachim_-_Baptism_of_Christ_-_c._1515.jpg"),
    ("luminous_1", "Bartolomé Esteban Murillo", "The Baptism of Christ",
     "Bartolomé_Esteban_Perez_Murillo_-_The_Baptism_of_Christ.jpg"),

    # luminous_3 (was 7) -> need 3
    ("luminous_3", "Henrik Olrik", "Sermon on the Mount",
     "Henrik_Olrik_-_Sermon_on_the_Mount.png"),
    ("luminous_3", "Heinrich Hofmann", "Christ and the Rich Young Ruler",
     "Heinrich_Hofmann_-_Christ_and_the_Rich_Young_Ruler.jpg"),
    ("luminous_3", "James Tissot", "The Sermon of the Beatitudes",
     "Brooklyn_Museum_-_The_Sermon_of_the_Beatitudes_(La_predication_des_beatitudes)_-_James_Tissot_-_overall.jpg"),

    # luminous_4 (was 9) -> need 1
    ("luminous_4", "Lorenzo Lotto", "The Transfiguration",
     "Trasfigurazione_di_Cristo_-_Lorenzo_Lotto_-_Pinacoteca_Comunale_Recanati_-_2008-09.jpg"),

    # sorrowful_1 (was 8) -> need 2
    ("sorrowful_1", "Andrea Mantegna", "The Agony in the Garden",
     "Mantegna,_Andrea_-_Agony_in_the_Garden_-_National_Gallery,_London.jpg"),
    ("sorrowful_1", "Heinrich Hofmann", "Christ in Gethsemane",
     "Christ_in_Gethsemane.jpg"),

    # sorrowful_2 (was 9) -> need 1
    ("sorrowful_2", "Ludovico Carracci", "The Flagellation of Christ",
     "Lodovico_Carracci_-_The_Flagellation_of_Christ_-_WGA04504.jpg"),

    # sorrowful_3 (was 8) -> need 2
    ("sorrowful_3", "Mihály Munkácsy", "Ecce Homo (1896)",
     "Munkácsy_Mihály_Ecce_homo.jpg"),
    ("sorrowful_3", "Antonello da Messina", "Ecce Homo",
     "Antonello_da_Messina_-_Ecce_Homo_-_WGA0750.jpg"),

    # glorious_1 (was 7) -> need 3
    ("glorious_1", "Andrea Mantegna", "The Resurrection of Christ",
     "Resurrection_(Andrea_Mantegna).jpg"),
    ("glorious_1", "Carl Heinrich Bloch", "The Resurrection",
     "The_Resurrection_by_Carl_Heinrich_Bloch,_1881.jpg"),
    ("glorious_1", "Eugène Burnand", "The Disciples Peter and John Running to the Sepulchre",
     "Burnand_Disciples.jpg"),

    # glorious_2 (was 8) -> need 2
    ("glorious_2", "Andrea Mantegna", "The Ascension of Christ",
     "Andrea_Mantegna_-_The_Ascension_of_Christ_-_WGA13956.jpg"),
    ("glorious_2", "Benvenuto Tisi (Garofalo)", "Ascension of Christ",
     "Benvenuto_Tisi_da_Garofalo_-_Ascension_of_Christ_-_WGA08474.jpg"),

    # glorious_3 (was 6) -> need 4
    ("glorious_3", "Giotto di Bondone", "Pentecost (Scrovegni)",
     "Giotto_-_Scrovegni_-_-39-_-_Pentecost.jpg"),
    ("glorious_3", "Giotto di Bondone", "Pentecost (National Gallery, London)",
     "Giotto._Pentecost._1320-25_National_Gallery,_London..jpg"),
    ("glorious_3", "Duccio di Buoninsegna", "Pentecost (Maestà)",
     "Duccio_di_Buoninsegna_-_Pentecost_-_WGA06739.jpg"),
    ("glorious_3", "Fra Angelico", "Pentecost (Corsini Triptych)",
     "Fra_Angelico,_The_Ascension_of_Christ,_The_Last_Judgment,_Pentecost_(Corsini_Triptych),_1447-48_5_10_18_-gardnermuseum_-earlyrenaissance_-italy_-painting_(41305696504).jpg"),

    # glorious_4 (was 8) -> need 2
    ("glorious_4", "Francesco Botticini", "The Assumption of the Virgin",
     "Francesco_Botticini_-_The_Assumption_of_the_Virgin.jpg"),
    ("glorious_4", "Giovanni Battista Tiepolo", "The Assumption of the Virgin",
     "Giovanni_Battista_Tiepolo_-_The_Assumption_of_the_Virgin_-_WGA22250.jpg"),

    # glorious_5 (was 8) -> need 2
    ("glorious_5", "Filippo Lippi", "Coronation of the Virgin",
     "Fra_Filippo_Lippi_-_Coronation_of_the_Virgin_-_WGA13215.jpg"),
    ("glorious_5", "Diego Velázquez", "The Coronation of the Virgin (WGA)",
     "Diego_Velázquez_-_The_Coronation_of_the_Virgin_-_WGA24439.jpg"),
]


def http_json(params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read())
    except Exception:
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
        time.sleep(1.2)
        url = resolve(fname)
        if not url:
            print(f"  MISSING  {mid:14s} {artist[:25]:25s} | {title[:40]:40s}  [{fname}]")
            continue
        if any(p["url"] == url for p in m["paintings"]):
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
