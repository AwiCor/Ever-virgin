/* =========================================================
   Lux Rosarii — application logic
   Vanilla JS, no dependencies. Exposes window.LuxRosarii.
   ========================================================= */

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // 1. Liturgical calendar — Easter, Lent, Advent, Christmas
  // ---------------------------------------------------------------------

  /**
   * Anonymous Gregorian Algorithm (Meeus/Jones/Butcher) for Easter date.
   * Returns a Date set at local midnight for Easter Sunday of that year.
   */
  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const L = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * L) / 451);
    const month = Math.floor((h + L - 7 * m + 114) / 31); // 3 = March, 4 = April
    const day = ((h + L - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  /** Ash Wednesday = 46 days before Easter Sunday */
  function ashWednesday(year) {
    return addDays(easterSunday(year), -46);
  }

  /** Holy Saturday = 1 day before Easter */
  function holySaturday(year) {
    return addDays(easterSunday(year), -1);
  }

  /** First Sunday of Advent: the 4th Sunday before Dec 25.
   *  Practically: from Dec 25, walk back to the previous Sunday — that's the 4th
   *  Sunday of Advent. Then subtract 21 days for the 1st Sunday of Advent. */
  function firstSundayOfAdvent(year) {
    const dec25 = new Date(year, 11, 25);
    // Walk back to the most recent Sunday on/before Dec 24
    const dow = dec25.getDay(); // 0 = Sunday
    const fourthSunday = addDays(dec25, dow === 0 ? -7 : -dow);
    return addDays(fourthSunday, -21);
  }

  /** Christmas season: Dec 25 through Jan 13 (Baptism of the Lord, approximate) */
  function isChristmasSeason(date) {
    const m = date.getMonth();
    const d = date.getDate();
    if (m === 11 && d >= 25) return true;        // Dec 25–31
    if (m === 0 && d <= 13) return true;          // Jan 1–13
    return false;
  }

  function isAdvent(date) {
    const today = startOfDay(date);
    const advStart = firstSundayOfAdvent(today.getFullYear());
    const dec24 = new Date(today.getFullYear(), 11, 24);
    return today >= advStart && today <= dec24;
  }

  function isLent(date) {
    const today = startOfDay(date);
    const ash = ashWednesday(today.getFullYear());
    const sat = holySaturday(today.getFullYear());
    return today >= ash && today <= sat;
  }

  // ---------------------------------------------------------------------
  // 2. Choose today's mystery
  // ---------------------------------------------------------------------

  /**
   * Returns one of "joyful" | "sorrowful" | "glorious" | "luminous".
   * Default day-of-week mapping with liturgical-season overrides for Sundays
   * and Lenten Fridays.
   */
  function getMysteryForDate(date) {
    const day = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

    // Lent overrides
    if (isLent(date)) {
      if (day === 0) return "sorrowful";  // Sundays in Lent
      if (day === 5) return "sorrowful";  // Fridays in Lent
    }

    // Advent / Christmas Sunday override
    if (day === 0 && (isAdvent(date) || isChristmasSeason(date))) {
      return "joyful";
    }

    // Default day-of-week assignment
    switch (day) {
      case 1: return "joyful";       // Monday
      case 2: return "sorrowful";    // Tuesday
      case 3: return "glorious";     // Wednesday
      case 4: return "luminous";     // Thursday
      case 5: return "sorrowful";    // Friday
      case 6: return "joyful";       // Saturday
      case 0: return "glorious";     // Sunday (default)
      default: return "glorious";
    }
  }

  // ---------------------------------------------------------------------
  // 3. Prayer flow construction
  // ---------------------------------------------------------------------

  /**
   * Builds the linear sequence of "steps" for one full Rosary.
   * Each step is an object with { type, beadId, ...payload }.
   * type values: "sign", "creed", "our_father", "hail_mary", "glory_be",
   *              "glory_fatima", "announce", "hail_holy_queen",
   *              "versicle", "closing_prayer", "closing_sign", "amen"
   */
  function buildSteps(prayers, mysterySet, sessionPicks) {
    const steps = [];

    // 1. Sign of the Cross (no bead)
    steps.push({ type: "sign", text: prayers.sign_of_the_cross, beadId: null, label: "Sign of the Cross" });

    // 2. Apostles' Creed — crucifix lit
    steps.push({ type: "creed", text: prayers.apostles_creed, beadId: "bead-cross", label: "The Apostles' Creed" });

    // 3. Our Father (introductory) — first large bead
    steps.push({ type: "our_father", text: prayers.our_father, beadId: "bead-creed-1", label: "Our Father" });

    // 4–6. Three Hail Marys for faith, hope, charity
    const intentions = ["for an increase in faith", "for an increase in hope", "for an increase in charity"];
    for (let i = 0; i < 3; i++) {
      steps.push({
        type: "hail_mary",
        text: prayers.hail_mary,
        beadId: "bead-creed-" + (i + 2),
        note: intentions[i],
        label: "Hail Mary"
      });
    }

    // 7. Glory Be (introductory) — medallion
    steps.push({ type: "glory_be", text: prayers.glory_be, beadId: "bead-medallion", label: "Glory Be" });

    // For each of 5 decades:
    //   - Mystery announcement (light the decade's OF bead)
    //   - Our Father (same OF bead)
    //   - 10 Hail Marys (each on its HM bead)
    //   - Glory Be + Fatima Prayer (last HM bead stays lit)
    //
    // Every in-decade step carries `decade` context so the renderer can keep
    // the mystery name + chosen painting visible alongside the prayer text.
    for (let d = 1; d <= 5; d++) {
      const mystery = mysterySet.mysteries[d - 1];
      const pick = sessionPicks[d - 1];
      const ofBead = "bead-d" + d + "-of";

      const decadeCtx = {
        number: d,
        mysteryName: mystery.name,
        fruit: mystery.fruit,
        painting: pick.painting,
        allPaintings: mystery.paintings   // for graceful fallback to alternatives
      };

      steps.push({
        type: "announce",
        beadId: ofBead,
        decadeNumber: d,
        mysteryName: mystery.name,
        fruit: mystery.fruit,
        scripture: mystery.scripture,
        quote: pick.quote,
        painting: pick.painting,
        allPaintings: mystery.paintings,
        label: mystery.name
      });

      steps.push({
        type: "our_father",
        text: prayers.our_father,
        beadId: ofBead,
        decade: decadeCtx,
        label: "Our Father"
      });

      for (let h = 1; h <= 10; h++) {
        steps.push({
          type: "hail_mary",
          text: prayers.hail_mary,
          beadId: "bead-d" + d + "-hm-" + h,
          decade: decadeCtx,
          hailMaryNumber: h,
          label: "Hail Mary " + h + " of 10"
        });
      }

      steps.push({
        type: "glory_fatima",
        gloryText: prayers.glory_be,
        fatimaText: prayers.fatima_prayer,
        beadId: "bead-d" + d + "-hm-10",
        decade: decadeCtx,
        label: "Glory Be & Fatima Prayer"
      });
    }

    // Closing: Hail Holy Queen — medallion
    steps.push({
      type: "hail_holy_queen",
      text: prayers.hail_holy_queen,
      beadId: "bead-medallion",
      label: "Hail Holy Queen"
    });

    // Closing versicle
    steps.push({
      type: "versicle",
      leader: prayers.closing_versicle.leader,
      response: prayers.closing_versicle.response,
      beadId: null,
      label: "Versicle"
    });

    // Closing prayer
    steps.push({
      type: "closing_prayer",
      text: prayers.closing_prayer,
      beadId: null,
      label: "Closing Prayer"
    });

    // Prayer to St. Michael the Archangel
    if (prayers.st_michael) {
      steps.push({
        type: "st_michael",
        text: prayers.st_michael,
        beadId: null,
        label: "Prayer to St. Michael the Archangel"
      });
    }

    // Closing Sign of the Cross
    steps.push({
      type: "closing_sign",
      text: prayers.sign_of_the_cross,
      beadId: null,
      label: "Sign of the Cross"
    });

    // Final Amen / return home
    steps.push({ type: "amen", beadId: null, label: "Amen" });

    return steps;
  }

  // ---------------------------------------------------------------------
  // 4. Random session selection
  // ---------------------------------------------------------------------

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** For each of the 5 mysteries, pick one painting and one quote. */
  function pickSessionAssets(mysterySet) {
    return mysterySet.mysteries.map(m => ({
      painting: pickRandom(m.paintings),
      quote: pickRandom(m.quotes)
    }));
  }

  // ---------------------------------------------------------------------
  // 5. Renderer — turns a step into HTML inside a container
  // ---------------------------------------------------------------------

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Render long, multi-sentence prayer text with natural line breaks at
   * sentence and clause boundaries. This prevents long centered prose from
   * wrapping into ragged shapes that look "split".
   *
   * Splits on `.` or `;` followed by whitespace. Keeps the punctuation,
   * trims, and emits each chunk on its own line.
   */
  function renderProseLines(text) {
    const parts = String(text)
      .split(/(?<=[.;])\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (parts.length <= 1) return escapeHTML(text);
    return parts.map(p => `<span class="prose-line">${escapeHTML(p)}</span>`).join("");
  }

  /**
   * Maps frame IDs to a list of remaining painting alternatives. When an img
   * fires onerror, we look up its frame's alternatives, swap src to the next
   * one, and only show the text fallback after all alternatives are exhausted.
   */
  const _frameAlternatives = new Map();
  let _frameSeq = 0;

  /**
   * Renders a painting frame with built-in fallback chain. If the chosen
   * painting URL fails, the renderer transparently swaps to the next painting
   * from the mystery's full list. Only after all candidates fail does the
   * artist + title fallback text appear.
   */
  function paintingFrameHTML(picked, allPaintings, frameClass) {
    if (!picked) return "";
    const frameId = "pf-" + (++_frameSeq);
    // Alternatives = all OTHER paintings in the mystery's array, shuffled
    const others = (allPaintings || [])
      .filter(p => p && p.url && p.url !== picked.url);
    // Lightly shuffle so we don't always hit the same fallback
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    _frameAlternatives.set(frameId, others);
    const safeUrl = picked.url ? encodeURI(picked.url) : "";
    const cls = ["painting-frame", frameClass || ""].filter(Boolean).join(" ");
    return `
      <div class="${cls}" id="${frameId}">
        <img src="${safeUrl}"
             alt="${escapeHTML(picked.title || "")} by ${escapeHTML(picked.artist || "")}"
             onerror="LuxRosarii._onPaintingError(this, '${frameId}')" />
        <div class="painting-fallback">
          <span class="pf-title">${escapeHTML(picked.title || "")}</span>
          <span class="pf-artist">${escapeHTML(picked.artist || "")}</span>
        </div>
      </div>`;
  }

  /**
   * Returns the HTML for the persistent decade context (mystery name +
   * painting) shown alongside in-decade prayers (Our Father, the 10 Hail
   * Marys, Glory Be + Fatima).
   */
  function decadeContextHTML(decade) {
    if (!decade || !decade.painting) return "";
    return `
      <div class="decade-banner">
        <span class="db-num">Decade ${decade.number}</span>
        <span class="db-name">${escapeHTML(decade.mysteryName)}</span>
      </div>
      ${paintingFrameHTML(decade.painting, decade.allPaintings, "painting-frame-side")}`;
  }

  /**
   * The right-hand side of an in-decade screen — the only part that changes
   * when advancing from one Hail Mary to the next within a decade. Used both
   * by the full renderer and the partial-update path.
   */
  function renderPrayerSide(step) {
    switch (step.type) {
      case "our_father":
        return `
          <p class="prayer-label">Our Father</p>
          <p class="prayer-text">${escapeHTML(step.text)}</p>`;
      case "hail_mary":
        // Inside a decade we don't repeat "Hail Mary" — the decade banner
        // already says The Annunciation / Visitation / etc., and the prayer
        // text below is obviously a Hail Mary. Just show the count.
        return `
          <p class="prayer-label hm-count-label">${step.hailMaryNumber} <span class="hm-divider">of</span> 10</p>
          <p class="prayer-text">${escapeHTML(step.text)}</p>`;
      case "glory_fatima":
        return `
          <p class="prayer-label">Glory Be &middot; Fatima Prayer</p>
          <div class="prayer-pair">
            <p class="prayer-text">${escapeHTML(step.gloryText)}</p>
            <p class="prayer-text">${escapeHTML(step.fatimaText)}</p>
          </div>`;
      default:
        return "";
    }
  }

  function renderStep(step, container) {
    let html = "";
    switch (step.type) {
      case "sign":
      case "closing_sign":
        html = `
          <div class="stage-inner">
            <p class="prayer-label">Sign of the Cross</p>
            <p class="prayer-text">${escapeHTML(step.text)}</p>
          </div>`;
        break;

      case "creed":
        html = `
          <div class="stage-inner">
            <p class="prayer-label">The Apostles' Creed</p>
            <p class="prayer-text long">${renderProseLines(step.text)}</p>
          </div>`;
        break;

      case "our_father":
      case "hail_mary":
      case "glory_fatima":
        if (step.decade) {
          html = `
            <div class="stage-inner with-decade">
              <div class="decade-layout">
                <div class="painting-side">
                  ${decadeContextHTML(step.decade)}
                </div>
                <div class="prayer-side">
                  ${renderPrayerSide(step)}
                </div>
              </div>
            </div>`;
        } else if (step.type === "our_father") {
          html = `
            <div class="stage-inner">
              <p class="prayer-label">Our Father</p>
              <p class="prayer-text">${escapeHTML(step.text)}</p>
            </div>`;
        } else if (step.type === "hail_mary") {
          html = `
            <div class="stage-inner">
              <p class="prayer-label">Hail Mary</p>
              <p class="prayer-text">${escapeHTML(step.text)}</p>
              ${step.note ? `<p class="prayer-note">${escapeHTML(step.note)}</p>` : ""}
            </div>`;
        } else {
          // glory_fatima outside a decade
          html = `
            <div class="stage-inner">
              <p class="prayer-label">Glory Be &middot; Fatima Prayer</p>
              <div class="prayer-pair">
                <p class="prayer-text">${escapeHTML(step.gloryText)}</p>
                <p class="prayer-text">${escapeHTML(step.fatimaText)}</p>
              </div>
            </div>`;
        }
        break;

      case "glory_be":
        html = `
          <div class="stage-inner">
            <p class="prayer-label">Glory Be</p>
            <p class="prayer-text">${escapeHTML(step.text)}</p>
          </div>`;
        break;

      case "announce": {
        const sc = step.scripture || {};
        const q  = step.quote || {};
        html = `
          <div class="stage-inner">
            <div class="announce">
              <p class="announce-decade">Decade ${step.decadeNumber} of 5</p>
              <h2 class="announce-name">${escapeHTML(step.mysteryName)}</h2>
              <p class="announce-fruit">${escapeHTML(step.fruit)}</p>

              ${paintingFrameHTML(step.painting, step.allPaintings, "")}

              <p class="announce-scripture">
                <span class="ref">${escapeHTML(sc.reference || "")}</span>${escapeHTML(sc.text || "")}
              </p>
              <p class="announce-quote">
                <span class="author">${escapeHTML(q.author || "")}</span>${escapeHTML(q.text || "")}
              </p>
            </div>
          </div>`;
        break;
      }

      case "hail_holy_queen":
        html = `
          <div class="stage-inner">
            <p class="prayer-label">Hail, Holy Queen</p>
            <p class="prayer-text long">${renderProseLines(step.text)}</p>
          </div>`;
        break;

      case "versicle":
        html = `
          <div class="stage-inner">
            <p class="prayer-label">Versicle &amp; Response</p>
            <div class="versicle">
              <p class="versicle-line"><span class="speaker">℣.</span>${escapeHTML(step.leader)}</p>
              <p class="versicle-line"><span class="speaker">℟.</span>${escapeHTML(step.response)}</p>
            </div>
          </div>`;
        break;

      case "closing_prayer":
        html = `
          <div class="stage-inner">
            <p class="prayer-label">Closing Prayer</p>
            <p class="prayer-text long">${renderProseLines(step.text)}</p>
          </div>`;
        break;

      case "st_michael":
        html = `
          <div class="stage-inner">
            <p class="prayer-label">Prayer to St. Michael the Archangel</p>
            <p class="prayer-text long">${renderProseLines(step.text)}</p>
          </div>`;
        break;

      case "amen":
        html = `
          <div class="stage-inner">
            <p class="end-amen">Amen.</p>
            <a href="index.html" class="end-link">Return home</a>
          </div>`;
        break;

      default:
        html = `<div class="stage-inner"><p class="prayer-text">…</p></div>`;
    }
    container.innerHTML = html;
  }

  // ---------------------------------------------------------------------
  // 6. Bead lighting
  // ---------------------------------------------------------------------

  /** Clear "active" class from all bead-like elements, then add it to one. */
  function lightBead(activeId) {
    const all = document.querySelectorAll(".bead, .cross-shape, .medallion");
    all.forEach(el => el.classList.remove("active"));
    if (!activeId) return;
    const el = document.getElementById(activeId);
    if (el) el.classList.add("active");
  }

  // ---------------------------------------------------------------------
  // 7. Painting fallback chain — exposed for inline onerror
  //
  // When an <img> fails to load, swap to the next painting from the same
  // mystery's array (registered in _frameAlternatives). Only after every
  // alternative has been tried and failed do we show the artist + title text.
  // ---------------------------------------------------------------------

  function _onPaintingError(imgEl, frameId) {
    const frame = imgEl.closest(".painting-frame");
    if (!frame) return;

    const alts = _frameAlternatives.get(frameId);
    if (!alts || alts.length === 0) {
      frame.classList.add("has-fallback");
      return;
    }

    const next = alts.shift();
    _frameAlternatives.set(frameId, alts);

    // Show fallback text while the new image loads (covers any flash)
    frame.classList.add("has-fallback");

    // Update fallback text in case THIS one also fails
    const titleEl  = frame.querySelector(".pf-title");
    const artistEl = frame.querySelector(".pf-artist");
    if (titleEl)  titleEl.textContent  = next.title  || "";
    if (artistEl) artistEl.textContent = next.artist || "";

    // When the new image successfully loads, hide the fallback
    imgEl.onload = () => {
      frame.classList.remove("has-fallback");
      imgEl.onload = null;
    };
    imgEl.alt = (next.title || "") + " by " + (next.artist || "");
    imgEl.src = next.url ? encodeURI(next.url) : "";
  }

  // ---------------------------------------------------------------------
  // 7b. Image preloading — warm the browser cache for the next decade so
  // its painting appears instantly on the announcement.
  // ---------------------------------------------------------------------

  const _preloadedUrls = new Set();
  function preloadImage(url) {
    if (!url || _preloadedUrls.has(url)) return;
    _preloadedUrls.add(url);
    const img = new Image();
    img.src = encodeURI(url);
  }

  function preloadUpcoming(steps, currentIdx, lookahead) {
    const seen = new Set();
    for (let i = currentIdx + 1; i < steps.length && seen.size < (lookahead || 2); i++) {
      const s = steps[i];
      const url = (s.painting && s.painting.url) ||
                  (s.decade && s.decade.painting && s.decade.painting.url);
      if (url && !seen.has(url)) {
        seen.add(url);
        preloadImage(url);
      }
    }
  }

  // ---------------------------------------------------------------------
  // 7c. Partial render — when transitioning between two in-decade prayers
  // of the SAME decade, only swap the prayer-side. The painting frame and
  // mystery banner stay mounted so there is no flicker / image reload.
  // ---------------------------------------------------------------------

  const IN_DECADE_TYPES = new Set(["our_father", "hail_mary", "glory_fatima"]);

  function canPartialUpdate(prevStep, nextStep, container) {
    if (!prevStep || !nextStep) return false;
    if (!prevStep.decade || !nextStep.decade) return false;
    if (prevStep.decade.number !== nextStep.decade.number) return false;
    if (!IN_DECADE_TYPES.has(prevStep.type) || !IN_DECADE_TYPES.has(nextStep.type)) return false;
    // Make sure the DOM still has the in-decade structure
    return !!container.querySelector(".prayer-side");
  }

  function partialUpdate(step, container) {
    const prayerSide = container.querySelector(".prayer-side");
    if (!prayerSide) return false;
    prayerSide.innerHTML = renderPrayerSide(step);
    // Re-trigger fade-in animation on the new children
    prayerSide.classList.remove("just-updated");
    void prayerSide.offsetWidth;
    prayerSide.classList.add("just-updated");
    return true;
  }

  // ---------------------------------------------------------------------
  // 7d. Tab title and Wake Lock
  // ---------------------------------------------------------------------

  const BASE_TITLE = "Lux Rosarii";

  function updateTabTitle(step) {
    if (!step) return;
    let title = BASE_TITLE;
    if (step.type === "announce") {
      title = step.mysteryName + " · " + BASE_TITLE;
    } else if (step.type === "hail_mary" && step.decade) {
      title = step.decade.mysteryName + " · Hail Mary " + step.hailMaryNumber + "/10 · " + BASE_TITLE;
    } else if (step.decade) {
      title = step.decade.mysteryName + " · " + (step.label || "") + " · " + BASE_TITLE;
    } else if (step.label) {
      title = step.label + " · " + BASE_TITLE;
    }
    if (document.title !== title) document.title = title;
  }

  /** Request a screen wake lock so the device doesn't sleep mid-prayer.
   *  Re-acquires the lock after tab visibility changes back to visible. */
  let _wakeLock = null;
  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      _wakeLock = await navigator.wakeLock.request("screen");
      _wakeLock.addEventListener("release", () => { _wakeLock = null; });
    } catch (e) {
      // user gesture / permission errors are fine to ignore
    }
  }
  function setupWakeLock() {
    acquireWakeLock();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !_wakeLock) acquireWakeLock();
    });
  }

  // ---------------------------------------------------------------------
  // 7e. Fullscreen, font scaling, progress bar — operator conveniences
  // ---------------------------------------------------------------------

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      const el = document.documentElement;
      (el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen)?.call(el);
    }
  }

  /** Track recent fullscreen exits so a single Esc keypress that exits
   *  fullscreen doesn't ALSO navigate the user back to the home page. */
  let _recentlyExitedFullscreen = false;
  function setupFullscreenTracking() {
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        _recentlyExitedFullscreen = true;
        setTimeout(() => { _recentlyExitedFullscreen = false; }, 350);
      }
    });
  }

  // Font scaling — bumped via + / − / 0 keys, persisted to localStorage.
  const FONT_SCALE_KEY = "lr.fontScale";
  const FONT_SCALE_MIN = 0.7;
  const FONT_SCALE_MAX = 1.8;
  const FONT_SCALE_STEP = 0.1;

  function readFontScale() {
    const stored = parseFloat(localStorage.getItem(FONT_SCALE_KEY) || "1");
    if (Number.isNaN(stored)) return 1;
    return Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, stored));
  }

  function applyFontScale(scale) {
    const clamped = Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, scale));
    document.documentElement.style.setProperty("--font-scale", String(clamped));
    try { localStorage.setItem(FONT_SCALE_KEY, String(clamped)); } catch (e) {}
    return clamped;
  }

  let _fontScale = readFontScale();
  function bumpFontScale(delta) {
    _fontScale = applyFontScale(_fontScale + delta);
  }
  function resetFontScale() {
    _fontScale = applyFontScale(1);
  }

  // Progress bar — fills as user advances through the rosary.
  function updateProgress(cursor, total) {
    const fill = document.getElementById("progress-bar-fill");
    if (!fill || total < 2) return;
    const pct = (cursor / (total - 1)) * 100;
    fill.style.width = pct.toFixed(2) + "%";
  }

  // ---------------------------------------------------------------------
  // 7f. Painting lightbox — click any painting to expand it full-screen
  // ---------------------------------------------------------------------

  function isLightboxOpen() {
    return !!document.querySelector(".painting-lightbox");
  }

  function openPaintingLightbox(frame) {
    if (!frame || isLightboxOpen()) return;
    const img = frame.querySelector("img");
    if (!img || !img.src) return;
    const title  = frame.querySelector(".pf-title")?.textContent || "";
    const artist = frame.querySelector(".pf-artist")?.textContent || "";

    const overlay = document.createElement("div");
    overlay.className = "painting-lightbox";
    overlay.innerHTML = `
      <button class="painting-lightbox-close" aria-label="Close">✕</button>
      <img src="${img.src}" alt="${escapeHTML(title + (artist ? " by " + artist : ""))}" />
      ${ (title || artist) ? `
        <div class="painting-lightbox-caption">
          ${title  ? `<strong>${escapeHTML(title)}</strong>`   : ""}
          ${artist ? `<span>${escapeHTML(artist)}</span>` : ""}
        </div>` : "" }
      <p class="painting-lightbox-hint">Click anywhere or press ESC to close</p>
    `;
    document.body.appendChild(overlay);

    function close() {
      if (!overlay.parentNode) return;
      overlay.classList.add("closing");
      window.removeEventListener("keydown", onKey, true);
      setTimeout(() => overlay.remove(), 220);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        // Capture phase: stop the prayer page Esc handler from also firing
        e.stopImmediatePropagation();
        e.preventDefault();
        close();
      }
    }
    overlay.addEventListener("click", close);
    window.addEventListener("keydown", onKey, true);
  }

  // ---------------------------------------------------------------------
  // 8. Data loading
  // ---------------------------------------------------------------------

  async function loadData() {
    const [prayersRes, mysteriesRes] = await Promise.all([
      fetch("data/prayers.json"),
      fetch("data/mysteries.json")
    ]);
    if (!prayersRes.ok || !mysteriesRes.ok) {
      throw new Error("Failed to load prayer data.");
    }
    const prayers = await prayersRes.json();
    const mysteries = await mysteriesRes.json();
    return { prayers, mysteries };
  }

  // ---------------------------------------------------------------------
  // 9. Prayer page controller
  // ---------------------------------------------------------------------

  async function startPrayerPage() {
    const stageEl = document.getElementById("stage");
    if (!stageEl) return; // not on prayer page

    let mysteryKey = new URLSearchParams(window.location.search).get("mystery");
    if (!["joyful", "sorrowful", "glorious", "luminous"].includes(mysteryKey)) {
      mysteryKey = getMysteryForDate(new Date());
    }

    let data;
    try {
      data = await loadData();
    } catch (err) {
      stageEl.innerHTML = `
        <div class="stage-inner">
          <p class="prayer-label">Could not load prayer data</p>
          <p class="prayer-text">Please run the site through a local web server (see README).</p>
        </div>`;
      console.error(err);
      return;
    }

    const mysterySet = data.mysteries[mysteryKey];
    if (!mysterySet) {
      stageEl.innerHTML = `<div class="stage-inner"><p class="prayer-text">Unknown mystery.</p></div>`;
      return;
    }

    const sessionPicks = pickSessionAssets(mysterySet);
    const steps = buildSteps(data.prayers, mysterySet, sessionPicks);

    // Warm the cache for the very first painting before the user reaches it
    if (steps[0]?.painting?.url) preloadImage(steps[0].painting.url);
    preloadUpcoming(steps, -1, 2);

    // Build a quick lookup: decade number → step index of its announcement
    // (used by the "click a bead in the rosary to jump to that decade" feature).
    const decadeAnnounceIdx = {};
    steps.forEach((s, i) => {
      if (s.type === "announce" && s.decadeNumber) {
        decadeAnnounceIdx[s.decadeNumber] = i;
      }
    });

    let cursor = 0;
    let lastStep = null;

    function show(idx) {
      cursor = Math.max(0, Math.min(idx, steps.length - 1));
      const step = steps[cursor];

      // Partial update if we can — keeps painting + banner mounted
      if (canPartialUpdate(lastStep, step, stageEl)) {
        partialUpdate(step, stageEl);
      } else {
        renderStep(step, stageEl);
      }

      lightBead(step.beadId);
      updateTabTitle(step);
      updateProgress(cursor, steps.length);
      preloadUpcoming(steps, cursor, 2);

      lastStep = step;
    }

    function next() { if (cursor < steps.length - 1) show(cursor + 1); }
    function prev() { if (cursor > 0) show(cursor - 1); }

    // Apply user's saved font scale + initialize subsystems
    applyFontScale(_fontScale);
    setupFullscreenTracking();
    setupWakeLock();

    // Wire up the click targets on the decade Our-Father beads — clicking
    // a target in the rosary diagram jumps to that decade's announcement.
    const targets = document.querySelectorAll(".bead-target");
    targets.forEach(t => {
      const decadeNum = parseInt(t.dataset.jumpDecade, 10);
      const beadId = "bead-d" + decadeNum + "-of";
      const visibleBead = document.getElementById(beadId);
      t.addEventListener("mouseenter", () => visibleBead?.classList.add("is-hover"));
      t.addEventListener("mouseleave", () => visibleBead?.classList.remove("is-hover"));
      t.addEventListener("click", (e) => {
        e.stopPropagation();   // don't also trigger the click-to-advance handler
        const idx = decadeAnnounceIdx[decadeNum];
        if (idx != null) show(idx);
      });
    });

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      // Don't intercept keys when the user is holding a modifier (Cmd+R, Ctrl+L, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case " ":
        case "Spacebar":
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          prev();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "+":
        case "=":   // same physical key as + on most layouts
          e.preventDefault();
          bumpFontScale(FONT_SCALE_STEP);
          break;
        case "-":
        case "_":
          e.preventDefault();
          bumpFontScale(-FONT_SCALE_STEP);
          break;
        case "0":
          e.preventDefault();
          resetFontScale();
          break;
        case "Escape":
          // If the browser just exited fullscreen via Esc (or is still in
          // fullscreen), don't ALSO navigate the user back home — that would
          // be a surprising double-action.
          if (document.fullscreenElement) {
            e.preventDefault();
            document.exitFullscreen?.();
          } else if (_recentlyExitedFullscreen) {
            // browser already handled fullscreen exit; swallow this Esc
            e.preventDefault();
          } else {
            window.location.href = "index.html";
          }
          break;
      }
    });

    // Click on a painting → expand it in a lightbox.
    // Registered FIRST so it runs before "click-anywhere-advances", and
    // calls stopImmediatePropagation when it handles a painting click.
    document.addEventListener("click", (e) => {
      if (isLightboxOpen()) return;
      const img = e.target.closest(".painting-frame img");
      if (!img) return;
      e.stopImmediatePropagation();
      openPaintingLightbox(img.closest(".painting-frame"));
    });

    // Click anywhere else advances (good for tablets / when leading by tap)
    document.addEventListener("click", (e) => {
      if (isLightboxOpen()) return;            // lightbox handles its own clicks
      if (e.target.closest("a")) return;       // don't advance on Exit / Return-home
      if (e.target.closest(".bead-target")) return; // bead clicks are handled separately
      next();
    });

    show(0);
  }

  // ---------------------------------------------------------------------
  // 10. Public API
  // ---------------------------------------------------------------------

  window.LuxRosarii = {
    getMysteryForDate,
    easterSunday,
    ashWednesday,
    isLent,
    isAdvent,
    isChristmasSeason,
    startPrayerPage,
    _onPaintingError,
    _preloadImage: preloadImage,
    _toggleFullscreen: toggleFullscreen,
    _applyFontScale: applyFontScale
  };

  // Restore the default tab title when navigating away from the prayer page.
  window.addEventListener("beforeunload", () => {
    document.title = BASE_TITLE;
  });

  // Auto-start on prayer page
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPrayerPage);
  } else {
    startPrayerPage();
  }
})();
