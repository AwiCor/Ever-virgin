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
        painting: pick.painting
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
   * Returns the HTML for the persistent decade context (mystery name +
   * painting) shown alongside in-decade prayers (Our Father, the 10 Hail
   * Marys, Glory Be + Fatima).
   */
  function decadeContextHTML(decade) {
    if (!decade || !decade.painting) return "";
    const p = decade.painting;
    const safeUrl = p.url ? encodeURI(p.url) : "";
    return `
      <div class="decade-banner">
        <span class="db-num">Decade ${decade.number}</span>
        <span class="db-name">${escapeHTML(decade.mysteryName)}</span>
      </div>
      <div class="painting-frame painting-frame-side">
        <img src="${safeUrl}"
             alt="${escapeHTML(p.title || "")} by ${escapeHTML(p.artist || "")}"
             onerror="LuxRosarii._onPaintingError(this)" />
        <div class="painting-fallback">
          <span class="pf-title">${escapeHTML(p.title || "")}</span>
          <span class="pf-artist">${escapeHTML(p.artist || "")}</span>
        </div>
      </div>`;
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
        if (step.decade) {
          html = `
            <div class="stage-inner with-decade">
              <div class="decade-layout">
                <div class="painting-side">
                  ${decadeContextHTML(step.decade)}
                </div>
                <div class="prayer-side">
                  <p class="prayer-label">Our Father</p>
                  <p class="prayer-text">${escapeHTML(step.text)}</p>
                </div>
              </div>
            </div>`;
        } else {
          html = `
            <div class="stage-inner">
              <p class="prayer-label">Our Father</p>
              <p class="prayer-text">${escapeHTML(step.text)}</p>
            </div>`;
        }
        break;

      case "hail_mary":
        if (step.decade) {
          html = `
            <div class="stage-inner with-decade">
              <div class="decade-layout">
                <div class="painting-side">
                  ${decadeContextHTML(step.decade)}
                </div>
                <div class="prayer-side">
                  <p class="prayer-label">Hail Mary <span class="hm-count">${step.hailMaryNumber} of 10</span></p>
                  <p class="prayer-text">${escapeHTML(step.text)}</p>
                </div>
              </div>
            </div>`;
        } else {
          html = `
            <div class="stage-inner">
              <p class="prayer-label">Hail Mary</p>
              <p class="prayer-text">${escapeHTML(step.text)}</p>
              ${step.note ? `<p class="prayer-note">${escapeHTML(step.note)}</p>` : ""}
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

      case "glory_fatima":
        if (step.decade) {
          html = `
            <div class="stage-inner with-decade">
              <div class="decade-layout">
                <div class="painting-side">
                  ${decadeContextHTML(step.decade)}
                </div>
                <div class="prayer-side">
                  <p class="prayer-label">Glory Be &middot; Fatima Prayer</p>
                  <div class="prayer-pair">
                    <p class="prayer-text">${escapeHTML(step.gloryText)}</p>
                    <p class="prayer-text">${escapeHTML(step.fatimaText)}</p>
                  </div>
                </div>
              </div>
            </div>`;
        } else {
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

      case "announce": {
        const sc = step.scripture || {};
        const q  = step.quote || {};
        const p  = step.painting || {};
        const safeUrl = p.url ? encodeURI(p.url) : "";
        html = `
          <div class="stage-inner">
            <div class="announce">
              <p class="announce-decade">Decade ${step.decadeNumber} of 5</p>
              <h2 class="announce-name">${escapeHTML(step.mysteryName)}</h2>
              <p class="announce-fruit">${escapeHTML(step.fruit)}</p>

              <div class="painting-frame" id="painting-frame">
                <img src="${safeUrl}"
                     alt="${escapeHTML(p.title || "")} by ${escapeHTML(p.artist || "")}"
                     onerror="LuxRosarii._onPaintingError(this)" />
                <div class="painting-fallback">
                  <span class="pf-title">${escapeHTML(p.title || "")}</span>
                  <span class="pf-artist">${escapeHTML(p.artist || "")}</span>
                </div>
              </div>

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
  // 7. Painting fallback handler — exposed for inline onerror
  // ---------------------------------------------------------------------

  function _onPaintingError(imgEl) {
    const frame = imgEl.closest(".painting-frame");
    if (frame) frame.classList.add("has-fallback");
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

    let cursor = 0;

    function show(idx) {
      cursor = Math.max(0, Math.min(idx, steps.length - 1));
      const step = steps[cursor];
      renderStep(step, stageEl);
      lightBead(step.beadId);
    }

    function next() { if (cursor < steps.length - 1) show(cursor + 1); }
    function prev() { if (cursor > 0) show(cursor - 1); }

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
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
        case "Escape":
          window.location.href = "index.html";
          break;
      }
    });

    // Click anywhere advances (good for tablets / when leading by tap)
    document.addEventListener("click", (e) => {
      // Don't advance when clicking the exit link or the return-home link
      if (e.target.closest("a")) return;
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
    _onPaintingError
  };

  // Auto-start on prayer page
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPrayerPage);
  } else {
    startPrayerPage();
  }
})();
