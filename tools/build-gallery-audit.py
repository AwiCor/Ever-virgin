#!/usr/bin/env python3
"""Regenerate gallery-audit.html from data/mysteries.json.

Run from the repo root after editing painting URLs:

    python3 tools/build-gallery-audit.py

The audit page renders every painting in a grid so broken or wrong images
can be spotted at a glance. Each card links to a Wikimedia Commons search
for finding a replacement.
"""
import html
import json
import pathlib
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "mysteries.json"
OUT = ROOT / "gallery-audit.html"

SET_TITLES = {
    "joyful": "Joyful Mysteries",
    "luminous": "Luminous Mysteries",
    "sorrowful": "Sorrowful Mysteries",
    "glorious": "Glorious Mysteries",
}

HEAD = """<!doctype html><html><head><meta charset="utf-8">
<title>Lux Rosarii — Painting Audit Gallery</title>
<style>
body{font-family:Georgia,serif;background:#1a1612;color:#e8d9c0;margin:0;padding:24px;}
h1{color:#d4a574;border-bottom:1px solid #4a3a2a;padding-bottom:8px;}
h2{color:#c89860;margin-top:48px;border-bottom:1px solid #4a3a2a;padding-bottom:6px;}
h3{color:#a87850;margin-top:32px;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;}
.card{background:#231d16;border:1px solid #3a2e22;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;}
.card img{width:100%;height:200px;object-fit:contain;background:#0d0a07;}
.meta{padding:10px 12px;font-size:13px;}
.artist{color:#d4a574;font-weight:bold;margin-bottom:4px;}
.title{color:#b8a890;font-style:italic;font-size:12px;}
a.fix{display:block;padding:6px 12px;background:#2d2418;color:#c89860;font-size:11px;text-align:center;text-decoration:none;border-top:1px solid #3a2e22;}
a.fix:hover{background:#3a2e22;color:#d4a574;}
.count{color:#888;font-size:14px;font-weight:normal;}
</style></head><body>
"""


def card(p):
    artist = html.escape(p["artist"])
    title = html.escape(p["title"])
    url = html.escape(p["url"], quote=True)
    q = urllib.parse.quote_plus(f"{p['artist']} {p['title']}")
    search = f"https://commons.wikimedia.org/w/index.php?search={q}&go=Go"
    return f"""<div class="card">
  <img src="{url}" loading="lazy" referrerpolicy="no-referrer" alt="{artist}: {title}">
  <div class="meta">
    <div class="artist">{artist}</div>
    <div class="title">{title}</div>
  </div>
  <a class="fix" href="{search}" target="_blank" rel="noopener">Search Commons →</a>
</div>"""


def main():
    data = json.loads(DATA.read_text())
    total = sum(len(m["paintings"]) for s in data.values() for m in s["mysteries"])
    parts = [HEAD]
    parts.append("<h1>Lux Rosarii — Painting Audit Gallery</h1>")
    parts.append(
        f"<p>Total: {total} paintings, generated from <code>data/mysteries.json</code> "
        f"by <code>tools/build-gallery-audit.py</code>. "
        f'Click "Search Commons" if any image is wrong or missing.</p>'
    )
    for key, s in data.items():
        parts.append(f"<h2>{html.escape(SET_TITLES.get(key, key))}</h2>")
        for m in s["mysteries"]:
            n = len(m["paintings"])
            parts.append(
                f'<h3>{html.escape(m["name"])} <span class="count">({n} paintings)</span></h3>'
            )
            parts.append('<div class="grid">')
            parts.extend(card(p) for p in m["paintings"])
            parts.append("</div>")
    parts.append("</body></html>\n")
    OUT.write_text("\n".join(parts))
    print(f"wrote {OUT} ({total} paintings)")


if __name__ == "__main__":
    main()
