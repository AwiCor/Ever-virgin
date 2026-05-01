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
- Shows a small rosary in the corner; the active bead glows white so the
  group can see exactly where they are.
- For each decade, displays the mystery name, fruit, a Scripture passage,
  a saint or pope quote, and a sacred painting in a gold frame.
- Spacebar advances. Arrow keys go forward and back. Esc exits.

## File layout

```
lux-rosarii/
├── index.html            # Home page — explains the Rosary, picks today's mystery
├── prayer.html           # Prayer interface — full-screen, screen-share friendly
├── styles.css            # All styling
├── app.js                # Date/season logic, prayer flow, rendering
├── data/
│   ├── prayers.json      # The Sign of the Cross, Hail Mary, etc.
│   └── mysteries.json    # 4 sets × 5 mysteries × 8 paintings + 8 quotes each
├── assets/
│   └── mary-background.jpg   # Sassoferrato's "The Virgin in Prayer"
└── README.md             # This file
```

## How to update content

Everything that's text — prayers, scripture, quotes, paintings — lives in
the two files inside `data/`. Open them in any text editor.

- **`data/prayers.json`** — the standard prayers (Hail Mary, Our Father,
  Apostles' Creed, etc.). Edit the wording here if you'd like to use a
  different translation.
- **`data/mysteries.json`** — for each of the 20 mysteries:
  - `name`, `fruit`
  - `scripture` (with `reference` and `text`)
  - `quotes` — an array. Add or remove entries; one is picked at random
    per Rosary session.
  - `paintings` — an array of `{ artist, title, url }` entries. One is
    picked at random per session. If a URL ever stops working, the app
    silently shows the artist + title text instead.

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
