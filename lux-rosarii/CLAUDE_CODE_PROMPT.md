# Build Specification: Lux Rosarii

You are helping me build a complete static website called **Lux Rosarii** ("Light of the Rosary") — a distraction-free web app for leading the rosary in prayer meetings, video calls, and group settings. Build this as a complete project in this directory, then walk me through deploying it. I am a non-coder, so be explicit about every command I need to run, and never assume I know how to do something.

---

## 1. Project Overview

**Purpose.** A web app that helps a prayer leader walk a group through the rosary by sharing their screen. The app:

- Auto-selects today's mystery based on the day of the week and liturgical season.
- Displays each prayer one at a time, in large reverent typography on a black background.
- Shows a small rosary diagram in the corner where the active bead glows white, so participants can see exactly where in the rosary they are.
- For each decade, announces the mystery with a relevant Scripture verse, a saint or pope quote (random from 8 per mystery), and a sacred painting (random from 8 per mystery, in a gold frame).
- Advances on Spacebar (and arrow keys as backup).

**Audience.** Prayer leaders, parishes, families, anyone leading a rosary on a video call.

**Vibe.** Black background. Warm cream text. Gold accents only for sacred elements (frames around paintings, Mary on the home page). Reverent, contemplative, not flashy. Think of a candle-lit chapel, not a tech demo.

---

## 2. Tech Stack

**Vanilla HTML, CSS, and JavaScript. No frameworks. No build step.**

I am a non-coder. The simpler the project, the easier for me to maintain and host. Do not introduce React, Vue, Tailwind, Webpack, Vite, npm, or any tooling that requires a build process. Just static files that can be uploaded to Cloudflare Pages directly.

Use:
- One `index.html` for the home page
- One `prayer.html` for the prayer interface
- One `styles.css` for all styling
- One `app.js` for prayer flow logic
- Two JSON files in `/data/` for content
- One image in `/assets/` for the Marian background

---

## 3. Project Structure

Create exactly this structure:

```
lux-rosarii/
├── index.html
├── prayer.html
├── styles.css
├── app.js
├── data/
│   ├── prayers.json
│   └── mysteries.json
├── assets/
│   └── mary-background.jpg
└── README.md
```

The `prayers.json`, `mysteries.json`, and `mary-background.jpg` files are provided to you separately — copy them in as-is. Do not modify the JSON content. Do not invent prayer text or quotes.

For `mary-background.jpg`: download from https://upload.wikimedia.org/wikipedia/commons/4/48/Sassoferrato_-_Jungfrun_i_bön.jpg and save locally to `assets/mary-background.jpg`.

---

## 4. Visual Design

### Colors
- Background: `#000000` (pure black) everywhere
- Primary text: `#f0e6d2` (warm cream)
- Secondary text: `#b8a888` (muted warm gray)
- Gold accent: `#c9a961` (used sparingly — frames, the active bead glow, button border)
- Inactive rosary beads: `#3a3a3a` (dark gray)
- Active rosary bead: `#ffffff` (pure white)

### Typography
Load from Google Fonts (only place we use external resources):
- Serif body: **EB Garamond** for all prayer text and most content
- Display: **Cormorant Garamond** for headings, mystery names, the site title (used in italic for emphasis)

Use generous line height (1.6 minimum). Prayer text should be large — at least 32px on desktop. Body should breathe.

### Animations
All color transitions: `0.5s ease-in-out`. Specifically the rosary bead going from gray to white must be smooth, not a sudden flip — this is critical to the meditative feel.

Painting fade-in when a new decade starts: `0.8s ease-out` opacity transition.

No bouncy animations. No spinning. Everything calm.

---

## 5. Home Page (`index.html`)

### Layout
- Pure black background.
- The Sassoferrato Mary image as a centered background, positioned as a faint silhouette: opacity around 0.18, scaled large but not stretched, vertically centered. CSS something like:

```css
body {
  background-color: #000;
  background-image: url('assets/mary-background.jpg');
  background-position: center center;
  background-repeat: no-repeat;
  background-size: contain;
  background-attachment: fixed;
}
```

Wrap the image in a layer with `opacity: 0.18` (use a `::before` pseudo-element or a separate div, not actual CSS `opacity` on body — that would dim the text).

### Content (centered, max-width ~700px)

1. Site title at the top in Cormorant Garamond italic, large (~80px): **"Lux Rosarii"**
2. Tagline below in cream serif: *Light of the Rosary*
3. A short, well-written explanation of the rosary (3–4 short paragraphs). Something like: what the rosary is, why it's prayed, how this app helps lead it. Write this in a reverent tone — research how the USCCB or Vatican websites describe the rosary if helpful, but write your own paraphrase. Do not quote sources verbatim.
4. Below the explanation, display today's auto-selected mystery in a centered, lightly styled card: "Today's mystery: **[Mystery Name]**" with a small option below that says "Pray a different mystery →" which expands to show the four mystery options as buttons (Joyful / Sorrowful / Glorious / Luminous).
5. A large prominent **"Begin Prayer"** button at the bottom — gold border, transparent background, large serif text, smooth hover. On click, navigate to `prayer.html?mystery=[selected]`.

### Mystery selection logic (used here AND on prayer.html)
Today's date determines today's mystery:
- **Monday, Saturday** → Joyful
- **Tuesday, Friday** → Sorrowful
- **Wednesday** → Glorious
- **Thursday** → Luminous
- **Sunday** (default) → Glorious
- **Sunday during Advent or Christmas season** → Joyful
- **Sunday during Lent** → Sorrowful
- **Friday during Lent** → Sorrowful (already true)

Liturgical seasons (approximate but acceptable):
- Advent: from the 4th Sunday before Dec 25 through Dec 24
- Christmas season: Dec 25 through ~Jan 13 (Baptism of the Lord)
- Lent: from Ash Wednesday (variable, calculate from Easter) through Holy Saturday
- Easter is the first Sunday after the first full moon on or after March 21 — use the Anonymous Gregorian algorithm to calculate. There are short JS implementations widely available; pick one and inline it. Do not depend on an external library.

Implement this in a `getMysteryForDate(date)` function in `app.js`. Returns one of `"joyful" | "sorrowful" | "glorious" | "luminous"`.

---

## 6. Prayer Page (`prayer.html`)

### Layout
- Pure black background, full screen.
- No header, no navigation. This is meant to be screen-shared and undistracting.
- Top-right corner: a tiny "✕ Exit" link in muted gray (returns to home).
- **Bottom-left corner**: the small visual rosary (see below). About 180px wide.
- **Center of screen**: the current prayer / mystery announcement.
- **Bottom of screen**, very faint: small text "Press SPACE to continue • ← → to navigate".

### The visual rosary (bottom-left corner)

Build this as an inline SVG inside `prayer.html`. The structure of a traditional rosary:

- Cross/crucifix at the bottom of a "tail"
- 1 large bead above the cross (Our Father)
- 3 small beads (Hail Marys)
- Centerpiece medallion (Mary)
- A loop above the medallion containing 5 decades
- Each decade: 1 large bead (Our Father), 10 small beads (Hail Marys)

Visual specifications:
- Total size: about 180px wide × 220px tall
- All beads start as filled circles with `fill: #3a3a3a`
- Each bead has `transition: fill 0.5s ease-in-out`
- The currently-active bead is filled `#ffffff` with a subtle gold glow: `filter: drop-shadow(0 0 6px #c9a961)`
- Cross is drawn with strokes, same gray color, becomes white when active
- Lay out the loop as a rounded oval/circle. The 5 decades arranged around it. The 10 small beads of each decade should be visibly grouped (maybe with a bit more space between large beads).
- Give each bead a unique `id` like `bead-cross`, `bead-creed-1` (large), `bead-creed-2` through `bead-creed-4` (3 small Hail Marys), `bead-creed-glory` (or use the medallion), then for each of 5 decades: `bead-d1-of` (Our Father), `bead-d1-hm-1` through `bead-d1-hm-10` (Hail Marys), and so on. Use a clear, consistent naming scheme.

### Prayer sequence (the order spacebar advances through)

Each step shows a single piece of content centered on screen, and lights up the corresponding bead.

| Step | Bead lit | Content shown |
|---|---|---|
| 1 | (none) | "In the name of the Father, and of the Son, and of the Holy Spirit. Amen." (Sign of the Cross) |
| 2 | crucifix | Apostles' Creed (full text) |
| 3 | first large bead | Our Father |
| 4 | small bead 1 | Hail Mary (note: "for an increase in faith") |
| 5 | small bead 2 | Hail Mary (note: "for an increase in hope") |
| 6 | small bead 3 | Hail Mary (note: "for an increase in charity") |
| 7 | medallion | Glory Be |
| 8 | (decade 1 OF bead) | **Mystery Announcement screen 1** (see below) |
| 9 | decade 1 OF bead | Our Father |
| 10–19 | decade 1 HM beads | Hail Mary × 10 (one per step) |
| 20 | (between decades) | Glory Be + Fatima Prayer (shown together on one screen) |
| 21 | (decade 2 OF bead) | **Mystery Announcement screen 2** |
| 22 | decade 2 OF bead | Our Father |
| 23–32 | decade 2 HM beads | Hail Mary × 10 |
| 33 | (between decades) | Glory Be + Fatima Prayer |
| 34 | (decade 3 OF bead) | **Mystery Announcement screen 3** |
| ... | continue for decades 4 and 5 ... | |
| Final | medallion | Hail Holy Queen |
| Final+1 | (none) | Closing versicle and response |
| Final+2 | (none) | Closing prayer ("Let us pray. O God, whose Only Begotten Son...") |
| Final+3 | (none) | "In the name of the Father..." (closing Sign of the Cross) |
| Final+4 | (none) | "Amen." Centered. Maybe a small "Return home" link below. |

The Hail Mary, Our Father, Glory Be, and other prayer texts come from `prayers.json`. Do not hardcode them.

### Mystery Announcement Screen

When the user reaches a new decade, instead of showing a prayer, show this layout for one full screen step:

- Top: small "Decade [N] of 5" indicator in muted gray
- Below that: the mystery name in large Cormorant Garamond italic, in gold (e.g. "The Annunciation")
- Below the name: the fruit of the mystery in smaller text (e.g. "Fruit: Humility")
- Center: the painting, in a **gold ceremonial frame** (see frame styling below). Painting takes up most of the visible area.
- Below painting: the Scripture verse with reference (e.g. "*Luke 1:26-27* — In the sixth month, the angel Gabriel...")
- Below scripture: a saint or pope quote with attribution (e.g. "—St. Bernard of Clairvaux: 'The angel awaits your reply...'")

### Painting frame styling

Build the gold frame in pure CSS — a border with a layered effect to feel ornate without being fussy:

```css
.painting-frame {
  border: 8px solid #c9a961;
  box-shadow:
    0 0 0 2px #2a2010,
    0 0 0 14px #8b7637,
    0 0 0 16px #2a2010,
    0 12px 40px rgba(0,0,0,0.6);
  background: #000;
  padding: 4px;
  display: inline-block;
  max-width: 50vw;
  max-height: 50vh;
}
.painting-frame img {
  display: block;
  max-width: 100%;
  max-height: 50vh;
  object-fit: contain;
}
```

Tweak as needed — the goal is a frame that feels like it belongs in a sacristy, not a stock photo.

### Random selection per session

When the prayer page loads:
1. Determine which mystery group to use (from URL query string `?mystery=joyful`, falling back to today's mystery if not provided).
2. For each of the 5 mysteries in that group, **randomly pick ONE painting** and **ONE quote** from the 8 in `mysteries.json`. Lock in those choices for the entire session — do not re-randomize on page changes within a single rosary.
3. Display the chosen painting through the entire decade (do not change paintings between Hail Marys).

### Keyboard controls

- **Spacebar** or **→** (right arrow): advance to next step
- **←** (left arrow): go back to previous step
- **Esc**: exit to home page (with confirmation if mid-prayer? actually no — keep it simple, just exit)

Disable browser scrolling on Spacebar (use `event.preventDefault()`).

Do not advance if a key is held — only on `keydown` events.

---

## 7. Data File Contracts

### `prayers.json`
A flat object with keys for each prayer. Use these keys exactly (the file is provided):
- `sign_of_the_cross`, `apostles_creed`, `our_father`, `hail_mary`, `glory_be`, `fatima_prayer`, `hail_holy_queen`, `closing_versicle` (object with `leader` and `response`), `closing_prayer`

### `mysteries.json`
Top-level: `joyful`, `sorrowful`, `glorious`, `luminous` — each an object with `traditional_days` (string, informational) and `mysteries` (array of 5).

Each mystery has:
- `id`, `name`, `fruit`
- `scripture`: `{ reference, text }`
- `quotes`: array of `{ author, text }` (8 entries — pick one at random per session)
- `paintings`: array of `{ artist, title, url }` (8 entries — pick one at random per session)

Some painting URLs may be broken (Google thumbnail caches, hotlink-protected sites). On image load failure, the app should silently fall back: show the painting frame with the artist/title text inside instead of the image. Do not show a broken image icon.

```javascript
img.onerror = () => {
  img.style.display = 'none';
  // show artist + title text in the frame area instead
};
```

---

## 8. README.md

Create a brief README.md explaining:
- What the project is
- File structure
- How to update content (edit `data/*.json`)
- How to test locally (just open `index.html` — but warn that some browsers block local JSON loading; recommend `python3 -m http.server` for testing)
- That deployment is via Cloudflare Pages

Keep it short and friendly — written for me, the non-coder owner.

---

## 9. Deployment

After the project is built, walk me through deployment step by step. Do not assume I know any of this. The plan:

### Step A: GitHub
1. Initialize git in the project folder.
2. Help me create a free GitHub account if I don't have one.
3. Help me create a new public repository named `lux-rosarii`.
4. Walk me through pushing the code: exact commands, and tell me what each line does in plain English.

### Step B: Cloudflare Pages
1. Have me sign up for a free Cloudflare account.
2. Walk me through "Create a project" → "Connect to Git" → select my `lux-rosarii` repo.
3. Build settings: framework preset = None, build command = (leave empty), build output directory = `/`. Explain each in plain English.
4. After it deploys, I'll get a URL like `lux-rosarii.pages.dev`. Confirm it works there first.

### Step C: Custom domain (ever-virgin.com)
1. In Cloudflare Pages → my project → "Custom domains" → add `ever-virgin.com` and `www.ever-virgin.com`.
2. Cloudflare will tell me the DNS records to add (usually a CNAME pointing to my pages.dev URL).
3. Walk me through logging into GoDaddy → finding DNS settings for `ever-virgin.com` → adding the CNAME records Cloudflare requested.
4. Tell me to wait up to an hour for DNS to propagate, and how to check it's working.
5. Confirm SSL is automatic on Cloudflare Pages (it is — make sure I know the site will be `https://ever-virgin.com`).

For any step where I need to do something on an external service, give me explicit click-by-click instructions, including what the buttons literally say.

---

## 10. Acceptance Criteria

Before declaring the project done, verify:

1. **Home page loads.** Black background, faint Mary silhouette, "Lux Rosarii" title visible. Today's mystery shows correctly. "Begin Prayer" button works.
2. **Prayer page works.** Spacebar advances through every step in the correct order, from Sign of the Cross through the closing.
3. **Rosary visual updates** smoothly. Each step lights up the correct bead. The transition is a smooth fade, not a flash.
4. **Mystery announcement displays** painting + scripture + quote correctly for each of 5 decades.
5. **Random selection works.** Reload the page → different paintings and quotes show up. But within a single session, the painting for a given decade stays the same throughout that decade.
6. **Liturgical logic works.** Manually test by changing the system date or hard-coding a date: a Sunday during Lent gives Sorrowful; a Thursday gives Luminous; etc.
7. **Mobile/small screens are usable.** This is mainly a desktop tool for screen-sharing, but the home page should at least be readable on a phone.
8. **No console errors.**
9. **Broken painting URLs fall back gracefully** to artist + title text.

---

## 11. What NOT to do

- Do not invent prayer text or saint quotes. Use the JSON files exactly.
- Do not add tracking, analytics, cookies, or any external scripts beyond Google Fonts.
- Do not add a "share to social media" button.
- Do not add background music, sound effects, or auto-advance timers.
- Do not add user accounts, login, or saved progress.
- Do not use bright colors. The aesthetic is reverent and quiet.
- Do not center text in narrow columns that look like a chat app — prayer text should sit comfortably in a generous serif column.
- Do not introduce npm, build steps, or frameworks.

---

## 12. Order of operations

Build in this order:

1. Create the directory structure.
2. Copy in the provided JSON files and the Mary image.
3. Build `styles.css` with the design system (colors, fonts, frame, base layout).
4. Build `index.html` with the home page layout and a static "Today's mystery: Joyful" placeholder.
5. Build `app.js` with the date logic. Wire it into the home page so the mystery is dynamic.
6. Build the SVG rosary and put it in `prayer.html`. Verify it renders.
7. Build the prayer flow logic in `app.js` — array of step objects, each with `{type, content, beadId}`.
8. Wire up keyboard controls.
9. Test the full flow end-to-end.
10. Polish styling and animations.
11. Write the README.
12. Walk me through deployment.

After each step, briefly tell me what you just did and what to expect. I want to feel involved in the build, not lost.

---

Now begin. Start by confirming you have the three files I'm providing (`prayers.json`, `mysteries.json`, and you'll download `mary-background.jpg`), then proceed.
