# Lux Rosarii — Light of the Rosary

A reverent, distraction-free web app for leading the Holy Rosary in prayer
meetings, video calls, and group settings. Built as a plain static site —
just open the files in a browser; no build tools, no dependencies, nothing
to install.

Live site: **https://ever-virgin.com**

---

## What it does

- Auto-selects today's mystery based on the day of the week and the
  liturgical season (Lent, Advent, Christmas).
- Walks the leader through every prayer, one screen at a time, in large
  reverent typography on a black background.
- Marks the traditional led-Rosary call-and-response purely by colour:
  the leader's words in the normal cream, the group's response in warm
  gold. No labels, no rules — it reads as one continuous prayer, so on a
  shared screen everyone can still see exactly when to join in.
- **English or Latin.** Choose in Settings (the gear, top-left) or press
  `L`. The choice persists and switches in place without losing the
  leader's spot.
- **Immersive stillness.** After a few seconds without input, the cursor
  and every control quietly dissolve — only the prayer and the painting
  remain. The faintest motion brings them back. With auto-advance on,
  this becomes a pure, hands-free contemplation.
- Shows a small rosary in the corner; the active bead glows white and
  breathes softly so the group can see exactly where they are.
- For each decade, displays the mystery name, fruit, a Scripture passage,
  a saint or pope quote, and a sacred painting in a gold frame.
- **Guided Rosary.** For first-timers and returners: a quiet golden line
  beneath each prayer explains where the fingers are on the beads and
  what comes next. Toggle it in Settings, press `G`, or enter through
  the "gentle guidance" link on the home page / the guide page's CTA
  (`prayer.html?guided=1`). An explicit toggle persists; the URL
  parameter only applies to that visit.
- **Learn the Rosary** (`guide.html`): an interactive map of the whole
  prayer — 16 stations walked bead by bead, a golden thread tracing the
  route travelled, today's paintings framed inside the stations, every
  bead clickable, plus the twenty mysteries and a beginner's FAQ.
- Spacebar advances. Arrow keys go forward and back. `L` switches
  language, `G` toggles guidance. Esc exits.

## File layout

```
lux-rosarii/
├── index.html            # Home page — explains the Rosary, picks today's mystery
├── guide.html            # "Learn the Rosary" — interactive beginner's guide
├── prayer.html           # Prayer interface — full-screen, screen-share friendly
├── gallery-audit.html    # Dev tool — renders every painting for visual review
├── styles.css            # All styling
├── app.js                # Date/season logic, prayer flow, rendering
├── data/
│   ├── prayers.json          # The standard prayers, English + Latin
│   ├── mysteries.json        # 4 sets × 5 mysteries × paintings + quotes
│   ├── saints.json           # Saint-of-the-day intercession, keyed MM-DD
│   ├── saint-bios.json       # Optional saint bios shown with the intercession
│   └── pope-intentions.json  # The Pope's monthly intention, keyed YYYY-MM
├── assets/
│   └── mary-background.jpg   # Sassoferrato's "The Virgin in Prayer"
└── README.md             # This file
```

## How to update content

Everything that's text — prayers, scripture, quotes, paintings — lives in
the two files inside `data/`. Open them in any text editor.

- **`data/prayers.json`** — the standard prayers, in both languages:
  a top-level `"en"` block and a `"la"` (Latin) block, each with the
  same set of prayers. A prayer is either:
  - a plain string — said by everyone together (Sign of the Cross,
    Creed, Hail Holy Queen, etc.), or
  - an object `{ "lead": "…", "resp": "…" }` — the leader prays `lead`
    (cream), the group answers with `resp` (gold). Used for the Our
    Father, Hail Mary, Glory Be, and the Fatima Prayer (whose leader
    part is just "O my Jesus,").

  Edit the wording for a different translation; keep the `en` / `la`
  structure intact. To turn any single prayer into call-and-response,
  just replace its string with a `{ "lead", "resp" }` object.
- **`data/mysteries.json`** — for each of the 20 mysteries:
  - `name`, `fruit`
  - `scripture` (with `reference` and `text`)
  - `quotes` — an array. Add or remove entries; one is picked at random
    per Rosary session.
  - `paintings` — an array of `{ artist, title, url }` entries. One is
    picked at random per session. If a URL ever stops working, the app
    silently falls back to the next painting in the list, and only shows
    the artist + title text once every alternative has failed.

    **Painting URL rules.** Prefer Wikimedia Commons *thumbnail* URLs at a
    standard width (`…/thumb/<hash>/<File>/1280px-<File>`): Wikimedia
    rejects hotlinked thumbnails at non-standard widths (HTTP 400) and
    rate-limits full-size originals, so always use one of its published
    widths — 500, 960, 1280 or 1920 are the useful ones here. Store URLs
    already percent-encoded exactly as the browser needs them; the app
    does not re-encode them. Avoid extremely tall images (width÷height
    below ~0.52) — the app rejects them as too narrow for the gold frame
    and skips to the next painting.

After editing JSON, reload the page in your browser. The change is live —
no rebuild, no deploy step (besides committing to GitHub if you want it on
the live site).

## Testing locally

The simplest way:

```sh
cd lux-rosarii
python3 -m http.server 8000
```

Then visit http://localhost:8000 in your browser.

> Why a server? When you double-click `index.html` directly, browsers
> sometimes block the JavaScript from loading the JSON files in `data/`
> (it's a security rule called CORS). Running a tiny server avoids this.
> If you don't have Python, any other static server works — for example
> the `serve` package via `npx serve`.

## Visual design notes

- Background: pure black.
- Text: warm cream (`#f0e6d2`).
- Gold accents (`#c9a961`) only on sacred elements: the painting frame,
  the active bead's glow, the Begin Prayer button border, the mystery
  name on the announcement screen.
- Fonts: EB Garamond for body, Cormorant Garamond italic for display
  (the site title and mystery names). Loaded from Google Fonts; that's
  the only external resource.

## Hosting

This site is hosted on **Cloudflare Pages**, deployed automatically when
the GitHub repository updates. See [DEPLOYMENT.md](#) (or the steps you
walked through during initial setup) for the full procedure. SSL is
free and automatic.

## License & attribution

- Prayers are public domain (traditional Catholic forms).
- Saint and pope quotes are short excerpts attributed inline.
- Paintings are linked from museum APIs and Wikimedia Commons. The
  Sassoferrato Madonna in `assets/` is from Wikimedia Commons (public
  domain).
- All app code is yours to modify freely.
