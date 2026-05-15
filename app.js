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
  /** Look up today's saint-of-the-day prayer text. Returns the full
   *  intercession line ("St. X, pray for us."). Falls back to a generic
   *  Marian invocation if the date is missing from saints.json. */
  function todaysSaintPrayer(saints, date) {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const key = mm + "-" + dd;
    return (saints && saints[key]) || "Holy Mary, our Mother, pray for us.";
  }

  function buildSteps(prayers, mysterySet, sessionPicks, saintPrayer, saintBio, mysteryKey) {
    const steps = [];

    // 1. Sign of the Cross (no bead)
    steps.push({ type: "sign", text: prayers.sign_of_the_cross, beadId: null, label: "Sign of the Cross" });

    // 2. Apostles' Creed — crucifix lit
    steps.push({ type: "creed", text: prayers.apostles_creed, beadId: "bead-cross", label: "The Apostles' Creed" });

    // 3. Our Father (introductory) — first large bead. Traditionally said
    // for the Pope's intentions, so we surface that as a footnote.
    steps.push({
      type: "our_father",
      text: prayers.our_father,
      beadId: "bead-creed-1",
      note: "For our Pope",
      label: "Our Father"
    });

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

    // 7. Glory Be (introductory) — bead-d1-of (the large OF bead just below
    // the medallion). On a standard rosary this same bead is then used for
    // announcing the 1st mystery and saying the 1st mystery's Our Father.
    steps.push({ type: "glory_be", text: prayers.glory_be, beadId: "bead-d1-of", label: "Glory Be" });

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
        mysterySet: mysteryKey,   // "joyful" | "luminous" | "sorrowful" | "glorious"
        fruit: mystery.fruit,
        painting: pick.painting,
        allPaintings: mystery.paintings   // for graceful fallback to alternatives
      };

      steps.push({
        type: "announce",
        beadId: ofBead,
        decadeNumber: d,
        mysteryName: mystery.name,
        mysterySet: mysteryKey,
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

      // After this decade's 10 Hail Marys, light the NEXT decade's OF bead
      // for the Glory Be + Fatima prayer — matching the layout of a standard
      // rosary, where the bead between two decades carries those prayers and
      // then the announcement of the next mystery. For decade 5 there is no
      // next OF, so the Glory + Fatima stay on the last HM bead.
      const gloryFatimaBead = d < 5 ? "bead-d" + (d + 1) + "-of"
                                    : "bead-d5-hm-10";
      steps.push({
        type: "glory_fatima",
        gloryText: prayers.glory_be,
        fatimaText: prayers.fatima_prayer,
        beadId: gloryFatimaBead,
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

    // Saint of the day intercession — comes after the St. Michael prayer,
    // just before the closing Sign of the Cross.
    if (saintPrayer) {
      steps.push({
        type: "saint_of_day",
        text: saintPrayer,
        beadId: null,
        label: "Saint of the Day",
        // Optional structured bio: rendered as an expandable panel below the
        // prayer if we have data for today, otherwise the step shows just
        // the intercession line.
        bio: saintBio || null
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

  /** "1st", "2nd", "3rd", "4th", "5th", etc. — handles English ordinal
   *  suffixes including the 11th/12th/13th exception. */
  function ordinal(n) {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return n + "th";
    const last = n % 10;
    if (last === 1) return n + "st";
    if (last === 2) return n + "nd";
    if (last === 3) return n + "rd";
    return n + "th";
  }

  const MYSTERY_SET_NAMES = {
    joyful:    "Joyful",
    luminous:  "Luminous",
    sorrowful: "Sorrowful",
    glorious:  "Glorious"
  };

  /** "The 1st Joyful Mystery", "The 3rd Glorious Mystery", etc. */
  function decadeTitle(decadeNum, mysteryKey) {
    const setName = MYSTERY_SET_NAMES[mysteryKey] || "";
    return "The " + ordinal(decadeNum) + " " + setName + " Mystery";
  }

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
    // Alternatives = all OTHER paintings in the mystery's array, in their
    // original order. CRUCIAL: do NOT shuffle here. The same picked painting
    // can render multiple times in one session (announcement, Our Father,
    // each Hail Mary, Glory Be + Fatima). If the painting needs to fall back
    // — either because the image failed to load or because its aspect ratio
    // is too narrow — every render must follow the same fallback path so
    // the user always sees the SAME final painting for that decade.
    const others = (allPaintings || [])
      .filter(p => p && p.url && p.url !== picked.url);
    _frameAlternatives.set(frameId, others);
    const safeUrl = picked.url ? encodeURI(picked.url) : "";
    // If this URL has already finished preloading, render the frame with
    // .is-loaded so the fade-in CSS is bypassed (image is instantly visible
    // at full opacity). Crucial for the View Transitions handoff: the
    // browser captures the new state right after innerHTML, and we need
    // the painting visible at that moment, not at opacity 0.
    const preloaded = _loadedUrls.has(picked.url);
    const cls = [
      "painting-frame",
      frameClass || "",
      preloaded ? "is-loaded" : ""
    ].filter(Boolean).join(" ");
    return `
      <div class="${cls}" id="${frameId}">
        <img src="${safeUrl}"
             alt="${escapeHTML(picked.title || "")} by ${escapeHTML(picked.artist || "")}"
             onload="LuxRosarii._onPaintingLoad(this, '${frameId}')"
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
        <span class="db-num">${escapeHTML(decadeTitle(decade.number, decade.mysterySet))}</span>
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
          <p class="prayer-text">${escapeHTML(step.text)}</p>
          ${step.note ? `<p class="prayer-note">${escapeHTML(step.note)}</p>` : ""}`;
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
              ${step.note ? `<p class="prayer-note">${escapeHTML(step.note)}</p>` : ""}
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
              <p class="announce-decade">${escapeHTML(decadeTitle(step.decadeNumber, step.mysterySet))}</p>
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

      case "saint_of_day": {
        const bio = step.bio;
        const bioHtml = bio ? `
          <div class="saint-bio">
            <div class="saint-bio-head">
              <span class="saint-bio-name">${escapeHTML(bio.name || "")}</span>
              ${bio.lived ? `<span class="saint-bio-lived">${escapeHTML(bio.lived)}</span>` : ""}
            </div>
            ${bio.intro ? `<p class="saint-bio-intro">${escapeHTML(bio.intro)}</p>` : ""}
            <details class="saint-bio-more">
              <summary>Read more</summary>
              <div class="saint-bio-body">
                ${(bio.bio || []).map(p => `<p>${escapeHTML(p)}</p>`).join("")}
                ${bio.wiki ? `<p class="saint-bio-link"><a href="${encodeURI(bio.wiki)}" target="_blank" rel="noopener noreferrer">Read on Wikipedia ↗</a></p>` : ""}
              </div>
            </details>
          </div>` : "";
        html = `
          <div class="stage-inner">
            <p class="prayer-label">Saint of the Day</p>
            <p class="prayer-text">${escapeHTML(step.text)}</p>
            ${bioHtml}
          </div>`;
        break;
      }

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

  /** Swap the painting in `frame` to the next alternative. Returns true if
   *  a swap happened, false if no alternatives remained. */
  function swapToNextAlternative(imgEl, frameId) {
    const frame = imgEl.closest(".painting-frame");
    if (!frame) return false;
    const alts = _frameAlternatives.get(frameId);
    if (!alts || alts.length === 0) {
      frame.classList.add("has-fallback");
      return false;
    }
    const next = alts.shift();
    _frameAlternatives.set(frameId, alts);
    // Fade the current image out and prep the fallback text as a backstop
    // in case THIS swap also fails.
    frame.classList.remove("is-loaded");
    frame.classList.add("has-fallback");
    const titleEl  = frame.querySelector(".pf-title");
    const artistEl = frame.querySelector(".pf-artist");
    if (titleEl)  titleEl.textContent  = next.title  || "";
    if (artistEl) artistEl.textContent = next.artist || "";
    imgEl.alt = (next.title || "") + " by " + (next.artist || "");
    imgEl.src = next.url ? encodeURI(next.url) : "";
    return true;
  }

  function _onPaintingError(imgEl, frameId) {
    swapToNextAlternative(imgEl, frameId);
    // The inline onload attribute on the new <img> src will fire
    // _onPaintingLoad once the new image loads, which clears the fallback.
  }

  /** Fires whenever an <img> finishes loading (initial or after a swap).
   *  Clears the fallback overlay, fades the image in, and rejects extremely
   *  tall/narrow paintings that would otherwise render as a thin strip. */
  function _onPaintingLoad(imgEl, frameId) {
    const frame = imgEl.closest(".painting-frame");
    if (!frame) return;
    frame.classList.remove("has-fallback");

    // Reject extremely portrait paintings (width:height < 0.55) — they look
    // like a thin vertical strip in the gold frame. Skip the fade-in for
    // this one; the next alternative will fade in on its own load.
    const w = imgEl.naturalWidth;
    const h = imgEl.naturalHeight;
    if (w > 0 && h > 0 && (w / h) < 0.55) {
      swapToNextAlternative(imgEl, frameId);
      return;
    }

    // Smooth fade-in for the now-visible painting.
    frame.classList.add("is-loaded");
  }

  // ---------------------------------------------------------------------
  // 7b. Image preloading — warm the browser cache for the next decade so
  // its painting appears instantly on the announcement.
  // ---------------------------------------------------------------------

  const _preloadedUrls = new Set();
  const _loadedUrls = new Set();   // populated when a preload actually finishes
  function preloadImage(url) {
    if (!url || _preloadedUrls.has(url)) return;
    _preloadedUrls.add(url);
    const img = new Image();
    img.onload = () => _loadedUrls.add(url);
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

  // Image scaling — bumped via [ / ] / \ keys, persisted to localStorage.
  const IMG_SCALE_KEY = "lr.imageScale";
  const IMG_SCALE_MIN = 0.6;
  const IMG_SCALE_MAX = 1.6;
  const IMG_SCALE_STEP = 0.1;

  function readImageScale() {
    const stored = parseFloat(localStorage.getItem(IMG_SCALE_KEY) || "1");
    if (Number.isNaN(stored)) return 1;
    return Math.max(IMG_SCALE_MIN, Math.min(IMG_SCALE_MAX, stored));
  }

  function applyImageScale(scale) {
    const clamped = Math.max(IMG_SCALE_MIN, Math.min(IMG_SCALE_MAX, scale));
    document.documentElement.style.setProperty("--image-scale", String(clamped));
    try { localStorage.setItem(IMG_SCALE_KEY, String(clamped)); } catch (e) {}
    return clamped;
  }

  let _imageScale = readImageScale();
  function bumpImageScale(delta) {
    _imageScale = applyImageScale(_imageScale + delta);
  }
  function resetImageScale() {
    _imageScale = applyImageScale(1);
  }

  // Progress bar — fills as user advances through the rosary.
  function updateProgress(cursor, total) {
    const fill = document.getElementById("progress-bar-fill");
    if (!fill || total < 2) return;
    const pct = (cursor / (total - 1)) * 100;
    fill.style.width = pct.toFixed(2) + "%";
  }

  // ---------------------------------------------------------------------
  // 7g. Auto-advance — hands-free leader mode
  //
  // Each step type has an estimated "read aloud calmly" duration. When
  // auto-advance is on, the cursor moves to the next step after that many
  // seconds (scaled by the user's chosen speed). Manual advance always
  // restarts the timer for the new step.
  // ---------------------------------------------------------------------

  const STEP_DURATIONS = {
    sign: 8, creed: 32, our_father: 14, hail_mary: 11,
    glory_be: 10, glory_fatima: 16, announce: 18,
    hail_holy_queen: 26, versicle: 10, closing_prayer: 22,
    st_michael: 28, saint_of_day: 10, closing_sign: 6, amen: 4
  };
  const SPEED_MULTIPLIERS = { slow: 1.5, normal: 1.0, fast: 0.7 };

  const AUTO_KEY = "lr.autoAdvance";
  const SPEED_KEY = "lr.autoSpeed";

  function readAutoAdvance() {
    return localStorage.getItem(AUTO_KEY) === "1";
  }
  function readAutoSpeed() {
    const v = localStorage.getItem(SPEED_KEY);
    return (v === "slow" || v === "fast") ? v : "normal";
  }
  function persist(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function stepDurationMs(step, speedKey) {
    const base = STEP_DURATIONS[step?.type] ?? 10;
    const mult = SPEED_MULTIPLIERS[speedKey] ?? 1.0;
    return Math.round(base * mult * 1000);
  }

  // ---------------------------------------------------------------------
  // 7h. Adaptive painting fitter — measures the actual rendered text on
  // the announcement screen and resizes the painting to fill whatever
  // vertical space is left. The CSS formula gives a sensible default;
  // this just tightens it to the user's viewport + the specific scripture
  // / quote lengths of the current decade.
  // ---------------------------------------------------------------------

  function fitAnnouncementPainting() {
    const stage = document.getElementById("stage");
    if (!stage) return;
    const announce = stage.querySelector(".announce");
    const frame = announce?.querySelector(".painting-frame");
    const img = frame?.querySelector("img");
    if (!img) return;

    const stageStyles = getComputedStyle(stage);
    const padTop = parseFloat(stageStyles.paddingTop) || 0;
    const padBot = parseFloat(stageStyles.paddingBottom) || 0;
    const availableVertical = window.innerHeight - padTop - padBot;

    // Sum heights of every sibling of the painting frame inside .announce.
    let usedByText = 0;
    Array.from(announce.children).forEach(child => {
      if (child === frame) return;
      const rect = child.getBoundingClientRect();
      const s = getComputedStyle(child);
      usedByText += rect.height +
                    parseFloat(s.marginTop) +
                    parseFloat(s.marginBottom);
    });
    // Plus the announce's flex gap between siblings.
    const gap = parseFloat(getComputedStyle(announce).gap) || 0;
    usedByText += Math.max(0, announce.children.length - 1) * gap;

    // Border + padding around the painting frame steals a bit more.
    const frameStyles = getComputedStyle(frame);
    const frameOverhead = parseFloat(frameStyles.borderTopWidth) +
                          parseFloat(frameStyles.borderBottomWidth) +
                          parseFloat(frameStyles.paddingTop) +
                          parseFloat(frameStyles.paddingBottom);

    // Image-scale multiplier (user-controlled via [ / ] keys).
    const imageScale = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--image-scale")
    ) || 1;

    // Generous safety buffer so the painting never sits flush against the
    // surrounding text on any viewport — it's read off a CSS variable so
    // small-laptop sizes (where every pixel counts) can dial it down via
    // a media query without affecting users on bigger screens.
    const cssBuffer = parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--painting-fit-buffer")
    );
    const buffer = Number.isFinite(cssBuffer) ? cssBuffer : 60;
    const target = Math.max(180,
      availableVertical - usedByText - frameOverhead - buffer);
    const newMax = (target * imageScale) + "px";

    // Skip the max-height transition for the fit pass — otherwise the user
    // sees the painting "grow" from the CSS-default size up to the fitted
    // size over 0.4s, which reads as a glitch. The fade-in handles the
    // smooth appearance.
    if (img.style.maxHeight !== newMax) {
      const prevTransition = img.style.transition;
      img.style.transition = "opacity 0.5s ease-out";
      img.style.maxHeight = newMax;
      // Force a reflow so the no-transition state applies, then restore.
      // eslint-disable-next-line no-unused-expressions
      img.offsetHeight;
      requestAnimationFrame(() => { img.style.transition = prevTransition; });
    }
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
    const [prayersRes, mysteriesRes, saintsRes, biosRes] = await Promise.all([
      fetch("data/prayers.json"),
      fetch("data/mysteries.json"),
      // saints.json + saint-bios.json are optional — if they fail, we fall
      // back to a generic Marian intercession in the saint-of-the-day step.
      fetch("data/saints.json").catch(() => null),
      fetch("data/saint-bios.json").catch(() => null)
    ]);
    if (!prayersRes.ok || !mysteriesRes.ok) {
      throw new Error("Failed to load prayer data.");
    }
    const prayers = await prayersRes.json();
    const mysteries = await mysteriesRes.json();
    const saints = saintsRes && saintsRes.ok ? await saintsRes.json() : null;
    const saintBios = biosRes && biosRes.ok ? await biosRes.json() : null;
    return { prayers, mysteries, saints, saintBios };
  }

  /** Look up the structured bio entry for today's saint, if we have one. */
  function todaysSaintBio(saintBios, date) {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return (saintBios && saintBios[mm + "-" + dd]) || null;
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
    const today = new Date();
    const saintPrayer = todaysSaintPrayer(data.saints, today);
    const saintBio = todaysSaintBio(data.saintBios, today);
    const steps = buildSteps(data.prayers, mysterySet, sessionPicks, saintPrayer, saintBio, mysteryKey);

    // Preload every painting we'll show this session — all five mystery
    // pictures. They're modest in size and starting them as soon as the
    // prayer page opens means the cache is warm long before the user
    // reaches any of them, so transitions between decades are instant
    // rather than waiting on a fresh network round-trip.
    sessionPicks.forEach(pick => {
      if (pick?.painting?.url) preloadImage(pick.painting.url);
    });

    // Build a quick lookup: decade number → step index of its announcement
    // (used by the "click a bead in the rosary to jump to that decade" feature).
    const decadeAnnounceIdx = {};
    steps.forEach((s, i) => {
      if (s.type === "announce" && s.decadeNumber) {
        decadeAnnounceIdx[s.decadeNumber] = i;
      }
    });

    // Index of the introductory Our Father — once the user advances past
    // it, the keyboard legend auto-hides (they've had enough time to see
    // the controls). The chevron toggle in the bottom-right brings it back.
    const introOurFatherIdx = steps.findIndex(s =>
      s.type === "our_father" && !s.decade
    );

    // ---- Keyboard legend toggle ----
    const kbHintEl = document.getElementById("kb-hint");
    const kbToggleEl = document.getElementById("kb-hint-toggle");
    let kbHintHidden = false;
    let kbHintAutoHidden = false;

    function setKbHintHidden(hidden) {
      kbHintHidden = hidden;
      kbHintEl?.classList.toggle("is-hidden", hidden);
      if (kbToggleEl) {
        kbToggleEl.textContent = hidden ? "‹" : "›";
        kbToggleEl.setAttribute("aria-label",
          hidden ? "Show keyboard legend" : "Hide keyboard legend");
      }
    }

    if (kbToggleEl) {
      kbToggleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        setKbHintHidden(!kbHintHidden);
      });
    }

    // ---- Auto-advance state (declared early so the settings panel can
    // read + write it). Timer is wired below, after `show` and `next`. ----
    let autoAdvanceOn = readAutoAdvance();
    let autoSpeed = readAutoSpeed();
    let autoTimer = null;

    // ---- Settings panel ----
    // Lives on the page from the start (declared in prayer.html). We wire up
    // each control here and reflect the current settings (font scale, image
    // scale, auto-advance toggle, speed) so the panel opens with values that
    // match what the user has already chosen via keyboard shortcuts.
    const settingsBtn     = document.getElementById("settings-btn");
    const settingsPanel   = document.getElementById("settings-panel");
    const settingsOverlay = document.getElementById("settings-overlay");
    const settingsCloseEl = document.getElementById("settings-close");
    const fontValueEl     = document.getElementById("settings-font-value");
    const imageValueEl    = document.getElementById("settings-image-value");
    const autoToggleEl    = document.getElementById("settings-auto-toggle");
    const speedRadios     = settingsPanel?.querySelectorAll('[data-speed]') || [];

    function refreshSettingsUI() {
      if (fontValueEl)  fontValueEl.textContent  = Math.round(_fontScale * 100) + "%";
      if (imageValueEl) imageValueEl.textContent = Math.round(_imageScale * 100) + "%";
      if (autoToggleEl) {
        autoToggleEl.setAttribute("aria-pressed", autoAdvanceOn ? "true" : "false");
        const label = autoToggleEl.querySelector(".settings-toggle-label");
        if (label) label.textContent = autoAdvanceOn ? "On" : "Off";
      }
      speedRadios.forEach(btn => {
        btn.setAttribute("aria-checked", btn.dataset.speed === autoSpeed ? "true" : "false");
      });
      document.body.classList.toggle("auto-advancing", autoAdvanceOn);
    }

    function openSettings() {
      if (!settingsPanel) return;
      refreshSettingsUI();
      settingsPanel.hidden = false;
      settingsOverlay.hidden = false;
      settingsBtn?.setAttribute("aria-expanded", "true");
    }
    function closeSettings() {
      if (!settingsPanel) return;
      settingsPanel.hidden = true;
      settingsOverlay.hidden = true;
      settingsBtn?.setAttribute("aria-expanded", "false");
    }

    settingsBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (settingsPanel?.hidden) openSettings(); else closeSettings();
    });
    settingsCloseEl?.addEventListener("click", (e) => { e.stopPropagation(); closeSettings(); });
    settingsOverlay?.addEventListener("click", (e) => { e.stopPropagation(); closeSettings(); });
    settingsPanel?.addEventListener("click", (e) => { e.stopPropagation(); });

    // Wire each control inside the panel.
    settingsPanel?.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        switch (btn.dataset.action) {
          case "font-up":      bumpFontScale(FONT_SCALE_STEP);  break;
          case "font-down":    bumpFontScale(-FONT_SCALE_STEP); break;
          case "image-up":     bumpImageScale(IMG_SCALE_STEP);  break;
          case "image-down":   bumpImageScale(-IMG_SCALE_STEP); break;
          case "reset-display":
            resetFontScale();
            resetImageScale();
            break;
        }
        refreshSettingsUI();
      });
    });

    autoToggleEl?.addEventListener("click", (e) => {
      e.stopPropagation();
      autoAdvanceOn = !autoAdvanceOn;
      persist(AUTO_KEY, autoAdvanceOn ? "1" : "0");
      refreshSettingsUI();
      if (autoAdvanceOn) scheduleAutoAdvance();
      else clearAutoTimer();
    });

    speedRadios.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        autoSpeed = btn.dataset.speed;
        persist(SPEED_KEY, autoSpeed);
        refreshSettingsUI();
        if (autoAdvanceOn) scheduleAutoAdvance();   // restart with new pace
      });
    });

    // Update the panel's reflected values when the user uses keyboard
    // shortcuts ([], +/-) outside the panel.
    const _origBumpFont  = bumpFontScale;
    const _origBumpImage = bumpImageScale;
    const _origResetFont = resetFontScale;
    const _origResetImage = resetImageScale;
    bumpFontScale   = function (d) { _origBumpFont(d);   refreshSettingsUI(); };
    bumpImageScale  = function (d) { _origBumpImage(d);  refreshSettingsUI(); };
    resetFontScale  = function ()  { _origResetFont();   refreshSettingsUI(); };
    resetImageScale = function ()  { _origResetImage();  refreshSettingsUI(); };

    refreshSettingsUI();

    let cursor = 0;
    let lastStep = null;

    function clearAutoTimer() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    }
    function scheduleAutoAdvance() {
      clearAutoTimer();
      if (!autoAdvanceOn) return;
      if (cursor >= steps.length - 1) return;   // don't auto-advance past Amen
      const step = steps[cursor];
      const delay = stepDurationMs(step, autoSpeed);
      autoTimer = setTimeout(() => {
        autoTimer = null;
        next();   // re-enters show() which reschedules
      }, delay);
    }

    function show(idx) {
      const newCursor = Math.max(0, Math.min(idx, steps.length - 1));
      const step = steps[newCursor];
      const usePartial = canPartialUpdate(lastStep, step, stageEl);

      // All the DOM mutations + downstream side-effects for advancing to
      // `step`. Wrapped here so we can run it directly OR inside the View
      // Transitions API callback (which snapshots before/after and animates).
      const applyStep = () => {
        cursor = newCursor;

        if (usePartial) {
          partialUpdate(step, stageEl);
        } else {
          renderStep(step, stageEl);
        }

        lightBead(step.beadId);
        updateTabTitle(step);
        updateProgress(cursor, steps.length);
        preloadUpcoming(steps, cursor, 2);

        // Fit the announcement painting NOW (synchronously) so View
        // Transitions captures the new state at its final size — otherwise
        // the painting would morph to the CSS-default size and then
        // "jump" to the JS-fitted size after the transition ends.
        if (step.type === "announce") {
          stageEl.getBoundingClientRect();   // force layout
          fitAnnouncementPainting();
          // Run again once the image dimensions arrive (in case the
          // initial pass measured stale text heights).
          const announceImg = stageEl.querySelector(".painting-frame img");
          if (announceImg && !announceImg.complete) {
            announceImg.addEventListener("load", fitAnnouncementPainting, { once: true });
          }
        }

        if (!kbHintAutoHidden && introOurFatherIdx >= 0 && cursor > introOurFatherIdx) {
          kbHintAutoHidden = true;
          setKbHintHidden(true);
        }

        scheduleAutoAdvance();
        lastStep = step;
      };

      // Use the View Transitions API for full re-renders so the painting
      // smoothly morphs from one layout to the next (e.g. announcement →
      // first Hail Mary: painting shrinks + slides left as prayer text
      // fades in on the right). Partial updates stay in the same DOM and
      // don't benefit from VT. Falls back gracefully on browsers without
      // the API (Firefox today) — they just see the existing fade.
      if (!usePartial && document.startViewTransition) {
        document.startViewTransition(applyStep);
      } else {
        applyStep();
      }
    }

    // Re-fit the announcement painting on window resize (orientation
    // change, dragging the window between screens, etc.).
    let _resizeRaf = null;
    window.addEventListener("resize", () => {
      if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
      _resizeRaf = requestAnimationFrame(() => {
        _resizeRaf = null;
        if (lastStep && lastStep.type === "announce") fitAnnouncementPainting();
      });
    });

    function next() { if (cursor < steps.length - 1) show(cursor + 1); }
    function prev() { if (cursor > 0) show(cursor - 1); }

    /** Jump forward to the next decade's mystery announcement, skipping
     *  any remaining Hail Marys / Glory Be in the current decade. If we're
     *  already past the last decade, advances to the next step normally. */
    function nextDecade() {
      for (let i = cursor + 1; i < steps.length; i++) {
        if (steps[i].type === "announce") { show(i); return; }
      }
      next();
    }

    /** Jump backward. If we're inside a decade, jumps to the start of THIS
     *  decade's announcement (like a "back" button on a music player). If
     *  we're already on an announcement, jumps to the previous decade's
     *  announcement. */
    function prevDecade() {
      for (let i = cursor - 1; i >= 0; i--) {
        if (steps[i].type === "announce") { show(i); return; }
      }
      show(0);
    }

    // Apply user's saved scales + initialize subsystems
    applyFontScale(_fontScale);
    applyImageScale(_imageScale);
    setupFullscreenTracking();
    setupWakeLock();

    // Wire up the click targets on the decade Our-Father beads — clicking
    // a target in the rosary diagram jumps to that decade's announcement.
    const targets = document.querySelectorAll(".bead-target[data-jump-decade]");
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

    // Wire up the medallion + crucifix click targets. Medallion → last
    // decade's mystery announcement. Crucifix → Apostles' Creed.
    document.querySelectorAll(".bead-target[data-jump-special]").forEach(t => {
      const kind = t.dataset.jumpSpecial;
      const visibleId = kind === "cross" ? "bead-cross" : "bead-medallion";
      const visible = document.getElementById(visibleId);
      t.addEventListener("mouseenter", () => visible?.classList.add("is-hover"));
      t.addEventListener("mouseleave", () => visible?.classList.remove("is-hover"));
      t.addEventListener("click", (e) => {
        e.stopPropagation();
        if (kind === "cross") {
          const idx = steps.findIndex(s => s.type === "creed");
          if (idx >= 0) show(idx);
        } else if (kind === "medallion") {
          // The medallion is the bead used during the Hail Holy Queen,
          // so clicking it jumps to that closing prayer.
          const idx = steps.findIndex(s => s.type === "hail_holy_queen");
          if (idx >= 0) show(idx);
        }
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
        case "ArrowDown":
          e.preventDefault();
          next();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) nextDecade(); else next();
          break;
        case "ArrowUp":
          e.preventDefault();
          prev();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) prevDecade(); else prev();
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
        case "[":
        case "{":   // shifted [
          e.preventDefault();
          bumpImageScale(-IMG_SCALE_STEP);
          break;
        case "]":
        case "}":   // shifted ]
          e.preventDefault();
          bumpImageScale(IMG_SCALE_STEP);
          break;
        case "0":
          // Reset BOTH text and image size to their defaults.
          e.preventDefault();
          resetFontScale();
          resetImageScale();
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

    // Click anywhere else advances (good for tablets / when leading by tap).
    // Skip clicks on any interactive widget — links, beads, the legend
    // toggle, the settings panel + button, and the saint-of-the-day bio
    // expander (which uses <details>/<summary>: clicking the summary
    // would otherwise toggle the panel AND jump the prayer forward).
    document.addEventListener("click", (e) => {
      if (isLightboxOpen()) return;
      if (e.target.closest("a")) return;
      if (e.target.closest(".bead-target")) return;
      if (e.target.closest(".kb-hint-toggle")) return;
      if (e.target.closest(".settings-btn")) return;
      if (e.target.closest(".settings-panel")) return;
      if (e.target.closest(".settings-overlay")) return;
      if (e.target.closest("details")) return;       // saint bio + any future <details>
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
    _onPaintingLoad,
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
