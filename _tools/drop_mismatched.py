#!/usr/bin/env python3
"""Remove the additions whose search returned the wrong painting."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "mysteries.json")

# (mystery_id, artist, title) — exact triples to remove.
WRONG = [
    ("luminous_1", "Aert de Gelder", "The Baptism of Christ"),       # got Cima da Conegliano
    ("luminous_3", "Fra Angelico",   "Sermon on the Mount"),         # got unknown artist
    ("sorrowful_5","Salvador Dalí",  "Christ of Saint John of the Cross"),  # got Kramskoy
]

with open(PATH, "r", encoding="utf-8") as f:
    d = json.load(f)

removed = 0
for s in d.values():
    for m in s["mysteries"]:
        before = len(m["paintings"])
        m["paintings"] = [p for p in m["paintings"]
                          if (m["id"], p["artist"], p["title"]) not in WRONG]
        removed += before - len(m["paintings"])

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"Removed {removed} mismatched paintings.")
