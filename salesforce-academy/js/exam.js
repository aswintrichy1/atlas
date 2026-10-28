/* =====================================================================
   ORBIT · Exam mode + Flashcards
   Self-contained module. Exposes window.AcademyExam = { mountExam, mountFlashcards }.
   Vanilla JS, zero dependencies, fully offline (no network, no external URLs).
   Reads window.QUIZZES / window.TRACKS at call time (load order independent).
   Every node is built with createElement / createElementNS — innerHTML is never
   set from any quiz- or user-derived string.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- tiny DOM helpers (mirrors app.js's el) ---------------- */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null) continue;
        if (k === "class") node.className = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null || kid === false) continue;
      if (Array.isArray(kid)) { kid.forEach(function (c) { if (c != null && c !== false) node.appendChild(typeof c === "object" ? c : document.createTextNode(String(c))); }); continue; }
      node.appendChild(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }

  var SVGNS = "http://www.w3.org/2000/svg";
  // Builds a namespaced SVG icon. `parts` is an array of [tagName, attrsObject].
  // All values are hardcoded literals in this file — never derived input.
  function ico(viewBox, parts, cls) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", viewBox);
    s.setAttribute("aria-hidden", "true");
    if (cls) s.setAttribute("class", cls);
    parts.forEach(function (p) {
      var c = document.createElementNS(SVGNS, p[0]);
      var a = p[1] || {};
      for (var k in a) c.setAttribute(k, a[k]);
      s.appendChild(c);
    });
    return s;
  }
  function clearNode(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function scrollTop() { try { window.scrollTo(0, 0); var m = document.getElementById("main"); if (m) m.scrollTop = 0; } catch (e) {} }

  var LETTERS = ["A", "B", "C", "D", "E", "F"];

  /* ---------------- icons ---------------- */
  function examIco(cls) { return ico("0 0 24 24", [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M9.1 9a3 3 0 1 1 4 2.8c-.8.4-1.1 1-1.1 1.7v.5M12 17h.01" }]], cls); }
  function flashIco(cls) { return ico("0 0 24 24", [["rect", { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ["path", { d: "M3 10h18" }]], cls); }
  function arrowIco() { return ico("0 0 24 24", [["path", { d: "M5 12h14M13 6l6 6-6 6" }]]); }
  function checkIco() { return ico("0 0 24 24", [["path", { d: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" }]]); }

  /* ---------------- track helpers ---------------- */
  // Quiz ids in Orbit use these prefixes: plat-, sec-, flow-, apex-, lwc-, int-, qa-, ops-, crma-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["plat", "sec", "flow", "apex", "lwc", "int", "qa", "ops", "crma"];
  var TRACK_NAMES = {
    plat: "Platform Fundamentals",
    sec: "Security & Sharing",
    flow: "Declarative Automation",
    apex: "Apex",
    lwc: "Lightning Web Components",
    int: "Integration",
    qa: "Testing & Quality",
    ops: "DevOps & Release",
    crma: "CRM Analytics"
  };
  function trackOf(quizId) { return String(quizId).split("-")[0]; }
  function isActiveQuiz(quizId) { return ACTIVE_QUIZ_PREFIXES.indexOf(trackOf(quizId)) !== -1; }
  function trackLabel(prefix) {
    var T = window.TRACKS || {};
    var id = PREFIX_ALIAS[prefix] || prefix;
    if (T[id] && T[id].name) return T[id].name;
    if (TRACK_NAMES[prefix]) return TRACK_NAMES[prefix];
    if (TRACK_NAMES[id]) return TRACK_NAMES[id];
    return prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : "Other";
  }

  /* ---------------- quiz pool (read at call time) ---------------- */
  function allQuestions(trackFilter) {
    var Q = window.QUIZZES || {};
    var out = [];
    Object.keys(Q).forEach(function (qid) {
      if (!isActiveQuiz(qid)) return;
      var prefix = trackOf(qid);
      if (trackFilter && trackFilter !== "all" && prefix !== trackFilter) return;
      var qz = Q[qid] || {};
      (qz.questions || []).forEach(function (qq, idx) {
        if (!qq || !Array.isArray(qq.options)) return;
        out.push({
          q: qq.q,
          options: qq.options,
          answer: qq.answer,
          explain: qq.explain || "",
          qid: qq._qid || (qid + "#" + idx),
          quiz: qid,
          quizTitle: qz.title || qid,
          track: prefix
        });
      });
    });
    return out;
  }
  function availableTracks() {
    var Q = window.QUIZZES || {};
    var seen = {}, list = [];
    Object.keys(Q).forEach(function (qid) { var p = trackOf(qid); if (!seen[p]) { seen[p] = true; list.push(p); } });
    var order = Object.keys(window.TRACKS || {});
    list.sort(function (a, b) {
      var ia = order.indexOf(PREFIX_ALIAS[a] || a), ib = order.indexOf(PREFIX_ALIAS[b] || b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return list;
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  // Shuffle option order while keeping the correct answer tracked.
  function buildExamItem(src) {
    var order = shuffle(src.options.map(function (_, i) { return i; }));
    var displayOptions = order.map(function (oi) { return src.options[oi]; });
    var correctIdx = order.indexOf(src.answer);
    return {
      q: src.q, displayOptions: displayOptions, correctIdx: correctIdx,
      explain: src.explain, qid: src.qid, track: src.track, picked: -1
    };
  }

  /* ---------------- localStorage (all wrapped) ---------------- */
  var EXAM_KEY = "ob_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "ob_flash_v1"; // { "<cardIndex>": "known" | "review" }
  function readBest() { try { return JSON.parse(localStorage.getItem(EXAM_KEY) || "null"); } catch (e) { return null; } }
  function saveBest(score, pct) {
    try {
      var prev = readBest();
      if (prev && typeof prev.bestPct === "number" && prev.bestPct >= pct) return;
      localStorage.setItem(EXAM_KEY, JSON.stringify({ best: score, bestPct: pct, takenAt: new Date().toISOString() }));
    } catch (e) {}
  }
  function readFlash() { try { var m = JSON.parse(localStorage.getItem(FLASH_KEY) || "{}"); return (m && typeof m === "object") ? m : {}; } catch (e) { return {}; } }
  function saveFlash(map) { try { localStorage.setItem(FLASH_KEY, JSON.stringify(map)); } catch (e) {} }

  // Optional weak-spot hook — works with whichever global the host app exposes.
  function feedWeakSpot(qid, ok) {
    try {
      var host = window.Academy;
      if (host && typeof host.recordAnswer === "function") host.recordAnswer(qid, ok);
    } catch (e) {}
  }

  /* ---------------- shared little builders ---------------- */
  function optionEl(value, label, selected) {
    var o = el("option", { value: value }, label);
    if (selected) o.setAttribute("selected", "selected");
    return o;
  }
  function emptyState(title, body) {
    return el("div", { class: "empty-state" }, checkIco(), el("h3", {}, title), el("p", {}, body));
  }
  function fmtTime(s) {
    s = Math.max(0, s | 0);
    var m = Math.floor(s / 60), ss = s % 60;
    return m + ":" + String(ss).padStart(2, "0");
  }

  /* =====================================================================
     EXAM MODE
     ===================================================================== */
  function mountExam(mountEl) {
    if (!mountEl) return;
    var timerId = null;
    function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
    function reset() { stopTimer(); clearNode(mountEl); }

    /* ---- config screen ---- */
    function renderConfig(state) {
      reset();
      state = state || { length: 10, track: "all", timer: 60 };

      var page = el("div", { class: "exam-page", style: "--accent: var(--violet)" });
      page.appendChild(el("header", { class: "exam-head" },
        examIco("exam-ico"),
        el("div", {},
          el("h1", { class: "exam-title" }, "Exam mode"),
          el("p", { class: "exam-sub" }, "A timed, mixed checkpoint. Questions are drawn at random and nothing is revealed until you submit.")
        )
      ));

      var fullPool = allQuestions("all");
      if (!fullPool.length) {
        page.appendChild(emptyState("No questions loaded", "The quiz bank isn\u2019t available yet. Open a lesson with a checkpoint quiz first, then come back."));
        mountEl.appendChild(page);
        return;
      }

      var tracks = availableTracks();
      var poolForTrack = allQuestions(state.track);
      var best = readBest();

      var cfg = el("div", { class: "exam-config" });

      if (best && typeof best.bestPct === "number") {
        cfg.appendChild(el("div", { class: "exam-best" }, "Best score: " + best.bestPct + "%"));
      }

      // length
      var lenBtns = [];
      [10, 25, 50].forEach(function (v) {
        if (v >= poolForTrack.length) return;
        lenBtns.push(mkLenBtn(String(v), v, state));
      });
      lenBtns.push(mkLenBtn("All (" + poolForTrack.length + ")", "all", state));
      cfg.appendChild(configRow("Questions", lenBtns));

      // track
      var trackSel = el("select", { class: "exam-select", "aria-label": "Track filter" });
      trackSel.appendChild(optionEl("all", "All tracks", state.track === "all"));
      tracks.forEach(function (t) { trackSel.appendChild(optionEl(t, trackLabel(t), state.track === t)); });
      trackSel.addEventListener("change", function () { state.track = trackSel.value; renderConfig(state); });
      cfg.appendChild(configRow("Track", [trackSel]));

      // timer
      var timerSel = el("select", { class: "exam-select", "aria-label": "Timer" });
      [["Untimed", "0"], ["30 sec / question", "30"], ["1 min / question", "60"], ["90 sec / question", "90"]].forEach(function (pair) {
        timerSel.appendChild(optionEl(pair[1], pair[0], String(state.timer) === pair[1]));
      });
      timerSel.addEventListener("change", function () { state.timer = parseInt(timerSel.value, 10) || 0; });
      cfg.appendChild(configRow("Timer", [timerSel]));

      var start = el("button", { class: "btn btn-primary exam-start", type: "button" }, "Start exam", arrowIco());
      start.addEventListener("click", function () {
        var pool = shuffle(allQuestions(state.track).slice());
        var n = state.length === "all" ? pool.length : Math.min(parseInt(state.length, 10) || pool.length, pool.length);
        var items = pool.slice(0, n).map(buildExamItem);
        if (!items.length) return;
        renderExam(items, state);
      });
      cfg.appendChild(start);

      page.appendChild(cfg);
      mountEl.appendChild(page);
      scrollTop();
    }

    function mkLenBtn(label, val, state) {
      var active = String(val) === String(state.length);
      var b = el("button", { class: "w-btn " + (active ? "primary" : "ghost"), type: "button" }, label);
      b.addEventListener("click", function () { state.length = val; renderConfig(state); });
      return b;
    }
    function configRow(label, nodes) {
      var ctrl = el("div", { class: "exam-config-control" });
      (Array.isArray(nodes) ? nodes : [nodes]).forEach(function (n) { ctrl.appendChild(n); });
      return el("div", { class: "exam-config-row" }, el("span", { class: "exam-config-label" }, label), ctrl);
    }

    /* ---- running exam ---- */
    function renderExam(items, cfg) {
      reset();
      var total = items.length;
      var cur = 0;
      var startedAt = Date.now();
      var timed = cfg.timer > 0;
      var secondsLeft = timed ? cfg.timer * total : 0;

      var page = el("div", { class: "exam-page exam-running", style: "--accent: var(--violet)" });
      var card = el("div", { class: "exam-card" });

      var progressEl = el("span", { class: "exam-progress" }, "");
      var timerEl = timed
        ? el("span", { class: "exam-timer", role: "timer", "aria-live": "off" }, "")
        : el("span", { class: "exam-timer untimed" }, "Untimed");
      card.appendChild(el("div", { class: "exam-bar" },
        el("span", { class: "exam-badge" }, examIco(), "Exam"),
        progressEl,
        timerEl
      ));

      var qSlot = el("div", { class: "exam-qslot" });
      card.appendChild(qSlot);

      var palette = el("div", { class: "exam-palette", role: "group", "aria-label": "Jump to question" });
      var dots = items.map(function (_, idx) {
        var d = el("button", { class: "exam-dot", type: "button", "aria-label": "Question " + (idx + 1) }, String(idx + 1));
        d.addEventListener("click", function () { cur = idx; renderQ(); });
        palette.appendChild(d);
        return d;
      });
      card.appendChild(palette);

      var prevBtn = el("button", { class: "w-btn ghost", type: "button" }, "Prev");
      var nextBtn = el("button", { class: "w-btn ghost", type: "button" }, "Next");
      prevBtn.addEventListener("click", function () { if (cur > 0) { cur--; renderQ(); } });
      nextBtn.addEventListener("click", function () { if (cur < total - 1) { cur++; renderQ(); } });
      var submitBtn = el("button", { class: "btn btn-primary exam-submit", type: "button" }, "Submit exam");
      submitBtn.addEventListener("click", function () { doSubmit(false); });
      card.appendChild(el("div", { class: "exam-foot" }, prevBtn, nextBtn, submitBtn));

      page.appendChild(card);
      mountEl.appendChild(page);

      function updateBar() {
        progressEl.textContent = "Q " + (cur + 1) + " / " + total;
        if (timed) {
          timerEl.textContent = fmtTime(secondsLeft);
          timerEl.classList.toggle("low", secondsLeft <= 30);
        }
      }
      function updateDots() {
        dots.forEach(function (d, idx) {
          d.classList.toggle("answered", items[idx].picked >= 0);
          d.classList.toggle("current", idx === cur);
        });
      }
      function renderQ() {
        var it = items[cur];
        clearNode(qSlot);
        qSlot.appendChild(el("p", { class: "exam-q" }, it.q));
        var opts = el("div", { class: "exam-options", role: "group", "aria-label": "Answer choices" });
        it.displayOptions.forEach(function (text, oi) {
          var selected = it.picked === oi;
          var b = el("button", { class: "exam-opt" + (selected ? " selected" : ""), type: "button", "aria-pressed": selected ? "true" : "false" },
            el("span", { class: "exam-key" }, LETTERS[oi]),
            el("span", { class: "exam-opt-text" }, text)
          );
          b.addEventListener("click", function () { it.picked = oi; renderQ(); });
          opts.appendChild(b);
        });
        qSlot.appendChild(opts);
        prevBtn.disabled = cur === 0;
        nextBtn.disabled = cur === total - 1;
        updateBar();
        updateDots();
      }

      function doSubmit(auto) {
        stopTimer();
        var elapsed = Math.round((Date.now() - startedAt) / 1000);
        var correct = 0;
        items.forEach(function (it) {
          var answered = it.picked >= 0;
          var ok = answered && it.picked === it.correctIdx;
          if (ok) correct++;
          if (answered) feedWeakSpot(it.qid, ok);
        });
        var pct = total ? Math.round((correct / total) * 100) : 0;
        saveBest(correct, pct);
        renderResults({ items: items, total: total, correct: correct, pct: pct, elapsed: elapsed, auto: !!auto, cfg: cfg });
      }

      renderQ();
      if (timed) {
        timerId = setInterval(function () {
          if (!document.body.contains(timerEl)) { stopTimer(); return; } // self-clean if navigated away
          secondsLeft--;
          if (secondsLeft <= 0) { secondsLeft = 0; updateBar(); doSubmit(true); return; }
          updateBar();
        }, 1000);
      }
      scrollTop();
    }

    /* ---- results ---- */
    function renderResults(r) {
      reset();
      var pass = r.pct >= 70;
      var page = el("div", { class: "exam-page exam-results", style: "--accent: var(--violet)" });
      var card = el("div", { class: "exam-card" });

      card.appendChild(el("div", { class: "exam-result-head" },
        el("div", { class: "exam-score " + (pass ? "pass" : "fail") }, r.correct + " / " + r.total),
        el("div", { class: "exam-verdict " + (pass ? "pass" : "fail") }, pass ? "PASS" : "FAIL")
      ));
      card.appendChild(el("p", { class: "exam-result-sub" },
        (pass ? "Above the 70% pass line \u2014 strong work." : "Below the 70% pass line \u2014 review the misses and retake.") +
        (r.auto ? " Time expired, so the exam was auto-submitted." : "")
      ));

      card.appendChild(el("div", { class: "exam-meta" },
        metaItem(r.pct + "%", "Score"),
        metaItem(fmtTime(r.elapsed), "Time taken"),
        metaItem(String(r.total), "Questions")
      ));

      // per-track breakdown
      var groups = {};
      r.items.forEach(function (it) {
        var t = it.track || "other";
        if (!groups[t]) groups[t] = { c: 0, n: 0 };
        groups[t].n++;
        if (it.picked === it.correctIdx) groups[t].c++;
      });
      var bd = el("div", { class: "exam-breakdown" }, el("h3", { class: "exam-sec-title" }, "By track"));
      Object.keys(groups).forEach(function (t) {
        var g = groups[t];
        var p = g.n ? Math.round((g.c / g.n) * 100) : 0;
        bd.appendChild(el("div", { class: "exam-bd-row" },
          el("span", { class: "exam-bd-name" }, trackLabel(t)),
          el("span", { class: "exam-bd-bar" }, el("i", { style: "width:" + p + "%" })),
          el("span", { class: "exam-bd-num" }, g.c + "/" + g.n)
        ));
      });
      card.appendChild(bd);

      // missed-question review
      var missed = r.items.filter(function (it) { return it.picked !== it.correctIdx; });
      var rev = el("div", { class: "exam-review" },
        el("h3", { class: "exam-sec-title" }, missed.length ? ("Review \u00b7 " + missed.length + " missed") : "Review"));
      if (!missed.length) {
        rev.appendChild(el("div", { class: "empty-state small" }, el("p", {}, "Perfect run \u2014 every question correct. Nothing to review.")));
      } else {
        missed.forEach(function (it) {
          var yourText = it.picked >= 0 ? it.displayOptions[it.picked] : "No answer";
          rev.appendChild(el("div", { class: "exam-review-item" },
            el("p", { class: "exam-ri-q" }, it.q),
            el("div", { class: "exam-ri-row your" }, el("span", { class: "exam-ri-tag" }, "Your answer"), el("span", { class: "exam-ri-val" }, yourText)),
            el("div", { class: "exam-ri-row correct" }, el("span", { class: "exam-ri-tag" }, "Correct"), el("span", { class: "exam-ri-val" }, it.displayOptions[it.correctIdx])),
            it.explain ? el("div", { class: "exam-ri-explain" }, el("strong", {}, "Why: "), it.explain) : null
          ));
        });
      }
      card.appendChild(rev);

      var retake = el("button", { class: "btn btn-primary exam-retake", type: "button" }, "Retake");
      retake.addEventListener("click", function () { renderConfig(r.cfg); });
      card.appendChild(el("div", { class: "exam-foot center" }, retake));

      page.appendChild(card);
      mountEl.appendChild(page);
      scrollTop();
    }
    function metaItem(v, k) {
      return el("div", { class: "exam-meta-item" }, el("div", { class: "exam-meta-v" }, v), el("div", { class: "exam-meta-k" }, k));
    }

    renderConfig();
  }

  /* =====================================================================
     FLASHCARDS
     A curated, original deck. front = term, back = concise definition.
     Tracks match Orbit's window.TRACKS ids: plat, sec, flow, apex, lwc, int, qa, ops, crma.
     ===================================================================== */
  var CARDS = [
    // plat
{ front: "Multi-tenancy", track: "plat", back: "Many orgs share one runtime and one database; every row carries its org id, and your org is mostly metadata on top of shared storage." },
    { front: "Governor limits", track: "plat", back: "Per-transaction ceilings on queries, rows, DML, CPU, heap and callouts that keep a shared runtime fair. Exceeding one ends and rolls back the transaction." },
    { front: "Metadata-driven platform", track: "plat", back: "Objects, fields, flows, layouts and Apex are all metadata the runtime interprets live, which is why changes need no restart and the repo must be the source of truth." },
    { front: "Org drift", track: "plat", back: "When production is edited directly in Setup and no longer matches source control, so the next deploy silently reverts or collides with the change." },
    { front: "Release cycle", track: "plat", back: "Three automatic major releases a year (Spring, Summer, Winter); preview sandboxes upgrade weeks early and give you a regression window." },
    { front: "API version pinning", track: "plat", back: "Each class, trigger and flow records the API version it was built against, so platform upgrades do not change its behaviour until you bump it." },
    { front: "Sandbox refresh intervals", track: "plat", back: "Developer and Developer Pro can refresh daily, Partial Copy every 5 days, Full every 29 days." },
    { front: "Partial Copy sandbox", track: "plat", back: "Metadata plus a sample of records chosen by a sandbox template, up to about 10,000 per selected object, with 5 GB of data storage." },
    { front: "SandboxPostCopy", track: "plat", back: "An Apex interface whose runApexClass method runs after a sandbox is created or refreshed; use it to mask data and re-point environment config." },
    { front: "Validate then quick deploy", track: "plat", back: "Run a check-only deploy with tests ahead of the release window, then promote the exact validated job with sf project deploy quick without rerunning tests." },
    { front: "Master-detail", track: "plat", back: "A required parent relationship with cascade delete, inherited sharing (the detail has no owner) and roll-up summary fields on the master." },
    { front: "Junction object", track: "plat", back: "A third object with two master-detail relationships that models many-to-many and allows roll-ups on both parents." },
    { front: "Hierarchical relationship", track: "plat", back: "A special lookup available only on the User object, pointing one user at another, such as a manager." },
    { front: "Accumulate, query, map, process", track: "plat", back: "The bulk pattern: collect ids in a loop, run one query outside it, put results in a map, then process each record by lookup." },
    // sec
{ front: "Access layers", track: "sec", back: "Org, object, field and record access are checked in turn; the first layer that denies wins, and sharing cannot fix an object or field gap." },
    { front: "Field-level security", track: "sec", back: "Per-field hidden, read-only or editable access enforced across the UI and APIs. Page layout read-only is presentation, not security." },
    { front: "Permission set group", track: "sec", back: "A bundle of permission sets assigned as one persona, with an optional muting permission set to remove specific permissions inside the group." },
    { front: "Custom permission", track: "sec", back: "A named capability carried by permission sets and checked with FeatureManagement.checkPermission, instead of querying permission set assignments." },
    { front: "Org-wide default", track: "sec", back: "The baseline record access for non-owners. It is the floor: every other sharing mechanism can only widen access above it." },
    { front: "Grant Access Using Hierarchies", track: "sec", back: "Lets users above the owner in the role hierarchy reach their subordinates' records. It can be turned off only for custom objects." },
    { front: "Role hierarchy", track: "sec", back: "A tree of data-access levels where access flows only upward; keep it shallow and use sharing rules for sideways access." },
    { front: "Criteria-based sharing rule", track: "sec", back: "Grants Read Only or Read/Write to a group for records whose field values match a condition, re-evaluated as records change." },
    { front: "Manual share", track: "sec", back: "A share added by the owner or someone above them, available when the default is Private or Public Read Only, and removed when the owner changes." },
    { front: "Apex sharing reason", track: "sec", back: "A custom RowCause on a custom object that marks share rows your code owns, so they survive owner changes and can be recalculated by a registered batch." },
    { front: "inherited sharing", track: "sec", back: "A class keyword that runs in the caller's sharing mode and defaults to with sharing as an entry point; the recommended choice for selectors." },
    { front: "WITH USER_MODE", track: "sec", back: "Runs a SOQL query with the user's object, field and sharing access across the whole statement; pair it with AccessLevel.USER_MODE on DML." },
    { front: "Security.stripInaccessible", track: "sec", back: "Removes fields the user cannot access from records you already hold and reports what was removed, for graceful partial access." },
    { front: "Database.queryWithBinds", track: "sec", back: "Runs dynamic SOQL with values supplied in a bind map, keeping user input out of query syntax; allow-list any dynamic field names." },
    // flow
{ front: "Before-save flow", track: "flow", back: "A record-triggered flow that edits the record being saved by assigning $Record fields. It needs no DML and no second save, so it is the cheapest automation for same-record field updates." },
    { front: "After-save flow", track: "flow", back: "A record-triggered flow that runs once the record has been written but not committed. Use it to create or update related records, send notifications or take async paths; updating its own record starts another save." },
    { front: "$Record__Prior", track: "flow", back: "The triggering record as it was before an update, available in record-triggered flows that run on update. Compare it with $Record so the flow acts only when a field really changed." },
    { front: "Entry conditions", track: "flow", back: "Filters evaluated before a flow interview starts, so non-matching records cost almost nothing. Prefer them, with an is-changed check, to a Decision element at the start of the flow." },
    { front: "Fault connector", track: "flow", back: "The error path from a flow element. Without one, a failure ends the interview with a generic error; with one, you can publish a log event, show a helpful screen or return an error to a parent flow." },
    { front: "Scheduled path", track: "flow", back: "A branch of an after-save flow that runs later, relative to the trigger time or a date field, in its own transaction. It suits reminders and follow-ups that admins should be able to see and adjust." },
    { front: "Autolaunched flow (no trigger)", track: "flow", back: "A flow with no start condition of its own, launched by Apex, another flow or an API call. It runs in the caller's transaction and spends the caller's limits." },
    { front: "Subflow", track: "flow", back: "A reusable flow called from other flows, named with a Sub_ prefix. It takes typed inputs, returns typed outputs such as outputIsSuccess, and reports failures through those outputs instead of swallowing them." },
    { front: "@InvocableMethod", track: "flow", back: "A static Apex method exposed to Flow as an action. It receives a list of requests, one per interview, and returns results in the same order, so it must be bulk-safe and should return errors rather than throw." },
    { front: "Save order of execution", track: "flow", back: "System validation, before-save flows, before triggers, validation and duplicate rules, the uncommitted write, after triggers, assignment and escalation rules, after-save flows, roll-ups, commit, then post-commit work." },
    { front: "Same-field conflict", track: "flow", back: "When a before-save flow and a before trigger set the same field, the trigger runs later, so its value is saved. Avoid designing two tools to own one field." },
    { front: "Set-based recursion guard", track: "flow", back: "A static Set of processed record Ids that lets each record through once per transaction. Unlike a Boolean flag, it does not skip records in later 200-record chunks of the same DML." },
    { front: "One owner per object per event", track: "flow", back: "The rule that either a trigger handler or a record-triggered flow owns a given object and event, never both. If a trigger exists, new logic goes into its handler and service." },
    { front: "Trigger Order", track: "flow", back: "A number set on record-triggered flows that share an object and timing, so their sequence is explicit. Record it in the object's automation inventory instead of relying on implicit ordering." },
    // apex
{ front: "Bulkification", track: "apex", back: "Writing every method to work on a list of records, with one query and one DML per chunk instead of per record. Code that is not bulkified fails as soon as a data load arrives." },
    { front: "Trigger chunk", track: "apex", back: "Triggers receive records in chunks of up to 200. A 1,000-row DML runs five chunks inside one transaction, and all of them share the same governor limits." },
    { front: "Trigger handler", track: "apex", back: "The class a logic-free trigger dispatches to. It casts the context lists and maps and routes each event to a singleton service, and it contains no business rules of its own." },
    { front: "Selector", track: "apex", back: "The only layer allowed to run SOQL. It is declared inherited sharing, sits behind an interface for mocking, and decides access mode and field lists in one place." },
    { front: "WITH USER_MODE", track: "apex", back: "A SOQL clause that enforces the running user's object permissions, field-level security and record sharing together. Pair it with AccessLevel.USER_MODE on the writes in the same class." },
    { front: "Partial-success DML", track: "apex", back: "Database.update(records, false) saves the good rows and returns errors for the bad ones in SaveResults. You must inspect and log every failure, or they disappear silently." },
    { front: "Savepoint", track: "apex", back: "A marker you can roll back to with Database.rollback. It undoes later DML but does not refund limits, undo callouts or reset static variables." },
    { front: "Accumulate, query, map, process", track: "apex", back: "The core bulk pattern: gather Ids in a Set inside the loop, query once outside it, index the results in a Map, then process each record with constant-time lookups." },
    { front: "Queueable", track: "apex", back: "The default async tool. It takes typed constructor arguments, returns a job Id, can call out with Database.AllowsCallouts, can enqueue one child from async context and supports a Finalizer." },
    { front: "Finalizer", track: "apex", back: "A class attached at the start of a Queueable's execute method that runs after the job succeeds or fails, even on an uncatchable limit. It is used to log failures and retry within a capped count." },
    { front: "Batch Apex scope", track: "apex", back: "The number of records per execute call: 200 by default and up to 2,000 with a QueryLocator. Each execute runs in its own transaction with fresh limits." },
    { front: "Flex queue", track: "apex", back: "Holding area for up to 100 batch jobs waiting to run, on top of the 5 that can be queued or active at once. Jobs move to active as slots free up." },
    { front: "Publish after commit", track: "apex", back: "Platform event behaviour that delivers the event only if the publishing transaction commits. Use it for business facts; use publish immediately for logging that must survive a rollback." },
    { front: "EventBus.RetryableException", track: "apex", back: "Thrown from a platform event subscriber to ask the platform to redeliver the same batch later. Retries are capped, so check the retry count, roll back first and log when you give up." },
    // lwc
{ front: "LWC bundle", track: "lwc", back: "A folder holding the component's JavaScript class, HTML template, optional CSS and a js-meta.xml file that sets the API version, exposure and placement targets." },
    { front: "Lifecycle order (parent with one child)", track: "lwc", back: "Parent constructor and connectedCallback, then child constructor, connectedCallback and renderedCallback, then parent renderedCallback. Connection goes top-down, rendering completes bottom-up." },
    { front: "renderedCallback guard", track: "lwc", back: "renderedCallback runs after every render, so one-time DOM work needs a flag. Setting reactive state there without a guard triggers an endless render loop." },
    { front: "Reassign, do not mutate", track: "lwc", back: "The engine re-renders when a field is reassigned. Pushing into an array or changing an object property in place keeps the same reference, so spread into a new array or object instead." },
    { front: "Boolean @api default", track: "lwc", back: "A public boolean must default to false because attribute presence means true in markup. The compiler rejects a public boolean initialised to true." },
    { front: "Lightning Data Service", track: "lwc", back: "A client-side record cache in front of the UI API that every component on the page shares. It needs no Apex and enforces CRUD, field-level security and sharing." },
    { front: "notifyRecordUpdateAvailable", track: "lwc", back: "Tells LDS that records changed on the server outside LDS, for example after an Apex write, so it re-fetches them and every component showing them repaints." },
    { front: "cacheable=true", track: "lwc", back: "Marks an AuraEnabled method as a pure read that can be wired and served from the client cache. DML is not allowed in such a method." },
    { front: "refreshApex", track: "lwc", back: "Re-queries a wired Apex result after a write. It must receive the exact object the wire service provisioned, so wire to a function and store the whole result." },
    { front: "CustomEvent defaults", track: "lwc", back: "With bubbles and composed both false the event fires only on the child's host element, so the parent listens on that element in its own template. This is the recommended default." },
    { front: "composed:true", track: "lwc", back: "Lets an event cross shadow boundaries, retargeted to each host. Without bubbles it only invokes hosts; with bubbles it reaches every ancestor up to the document and becomes public API." },
    { front: "Lightning Message Service", track: "lwc", back: "A page-level publish and subscribe bus on named message channels that works across LWC, Aura and Visualforce. It suits unrelated components with no DOM relationship." },
    { front: "Styling hooks", track: "lwc", back: "CSS custom properties that base components deliberately read, so they can be themed across the shadow boundary without selecting internal markup. Hook names vary by SLDS version." },
    { front: "Polite status announcement", track: "lwc", back: "Render short status text in a native output element, which acts as a polite live region. Use role alert for urgent errors, and never rely on colour alone." },
    // int
{ front: "Composite API", track: "int", back: "Runs up to 25 related subrequests in one round trip, letting later steps reference ids created earlier, with optional all-or-none rollback." },
    { front: "sObject Collections", track: "int", back: "A composite resource that creates, updates, upserts or deletes up to 200 records of a type in one API call, which saves allocation and latency." },
    { front: "Upsert on an external id", track: "int", back: "Matches each incoming row to a record by a stable source key, so retries and replays update instead of creating duplicates." },
    { front: "API request allocation", track: "int", back: "An org-wide allowance of API calls measured over a rolling 24 hours and shared by every integration, so each integration should have its own user and monitoring." },
    { front: "Bulk API 2.0 ingest job", track: "int", back: "An asynchronous job: upload CSV data, mark it UploadComplete, poll until done, then download successful, failed and unprocessed rows. Triggers still run per 200-record chunk." },
    { front: "UNABLE_TO_LOCK_ROW in loads", track: "int", back: "Usually parallel chunks updating children of the same parent. Sort the file by parent id, trim parent-touching automation and retry only failed rows." },
    { front: "Custom Apex REST resource", track: "int", back: "A global with sharing class annotated with RestResource and a versioned URL mapping, accepting list payloads and delegating to a bulk-safe, user-mode service." },
    { front: "Named Credential", track: "int", back: "Holds where a callout goes: the base URL and callout options. Apex references it as callout:Payments_API/path so no endpoint or secret appears in code." },
    { front: "External Credential", track: "int", back: "Holds how a callout authenticates: the protocol and named principals. Secrets are entered per environment in Setup, and a permission set grants principal access." },
    { front: "Callout limits", track: "int", back: "Up to 100 callouts and 120 seconds of total callout time per transaction, with a 10 second default per request. A callout cannot follow uncommitted DML in the same transaction." },
    { front: "Queueable with Finalizer", track: "int", back: "The house pattern for callouts triggered by data changes: a Queueable implementing Database.AllowsCallouts, plus a Finalizer that re-enqueues a bounded retry on failure." },
    { front: "External Services", track: "int", back: "Registers an OpenAPI specification against a Named Credential and generates typed invocable actions that Flow and Apex can call without hand-written HTTP code." },
    { front: "Change Data Capture", track: "int", back: "Publishes create, update, delete and undelete events for enabled objects after commit, with the changed fields in the header, for external sync without publishing code." },
    { front: "Replay id and retention", track: "int", back: "Every event carries a replay id. High-volume events are retained for about 72 hours, so subscribers persist the last id they processed and reconcile anything older." },
    // qa
{ front: "@IsTest", track: "qa", back: "Marks a class or method as test code. Test code is excluded from coverage and from the org's Apex size limit, and replaces the obsolete testMethod keyword." },
    { front: "Test.startTest / Test.stopTest", track: "qa", back: "Gives the act phase a fresh set of governor limits, and forces async work queued inside the window to finish at stopTest so you can assert its results." },
    { front: "@TestSetup", track: "qa", back: "Creates baseline records once per test class; each test method starts from that baseline and its changes are rolled back afterwards." },
    { front: "System.runAs", track: "qa", back: "Runs a block as a specific user so sharing and, in user mode, field-level security are enforced. The house standard uses a fresh user holding the feature's shipped permission set." },
    { front: "seeAllData=true", track: "qa", back: "Lets a test read org data, which makes results depend on the target org. Banned in the house standard; create every record the test needs." },
    { front: "MIXED_DML_OPERATION", track: "qa", back: "Error raised when setup objects such as User and business objects such as Account are written in the same transaction. Create users in @TestSetup and business data inside System.runAs." },
    { front: "HttpCalloutMock", track: "qa", back: "Interface whose respond method returns a scripted HttpResponse. Registered with Test.setMock because tests cannot make real callouts; write one per response shape you handle." },
    { front: "StubProvider", track: "qa", back: "Apex interface used with Test.createStub to replace a class at test time, typically to force a selector or service to throw so catch blocks are exercised." },
    { front: "Coverage gates", track: "qa", back: "The platform needs 75% org-wide Apex coverage and some coverage on every trigger to deploy to production. The house bar is at least 90% per new class and 85% per modified class." },
    { front: "What coverage does not prove", track: "qa", back: "Coverage only counts executed lines. A test with no assertions scores the same as one that checks every outcome, so assertions on business results are the real goal." },
    { front: "createApexTestWireAdapter", track: "qa", back: "Utility used with jest.mock to turn a wired Apex import into an adapter with emit and error methods. The bare Apex auto-mock is a plain jest.fn without them." },
    { front: "@salesforce/sfdx-lwc-jest", track: "qa", back: "The package that runs LWC unit tests in Node, supplying the compiler, base component stubs and Salesforce module mocks. House bar: 80% statements per touched bundle." },
    { front: "sf code-analyzer run", track: "qa", back: "Runs PMD rules and other engines against source. In the house workflow it scans every touched file before validate or deploy, and the gate is zero violations with no suppressions." },
    { front: "SonarQube quality gate", track: "qa", back: "A pass or fail condition evaluated on new code, such as no new critical issues and coverage on new lines above target, so quality cannot slide without rewriting legacy code." },
    // ops
{ front: "Source-driven development", track: "ops", back: "Git is the system of record and every org is built from it. Changes clicked into an org must be retrieved and committed or the next deploy reverts them." },
    { front: "sfdx-project.json", track: "ops", back: "Project definition listing package directories, the default directory, the source API version and any package definitions and aliases." },
    { front: "Source format", track: "ops", back: "The DX layout that splits large metadata such as custom objects into one file per field or rule, keeping diffs small and merges sane." },
    { front: "sf org login jwt", track: "ops", back: "Headless authentication for CI using a connected app's consumer key and a private key file, both supplied as CI secret variables rather than committed values." },
    { front: "Scratch org", track: "ops", back: "A disposable org built from a definition file for one feature or test run. Defaults to 7 days and can last up to 30." },
    { front: "Source tracking", track: "ops", back: "CLI bookkeeping of what changed locally and in a scratch org or tracking-enabled sandbox, so deploy start and retrieve start move only differences and flag conflicts." },
    { front: "package.xml", track: "ops", back: "A Metadata API manifest naming component types and members, used to scope deploys and retrieves to exactly what a change contains." },
    { front: "Destructive changes", track: "ops", back: "An explicit manifest of components to delete, passed as pre or post destructive changes. Escalated for review in the house workflow because deletions are hard to undo." },
    { front: "Unlocked package", track: "ops", back: "A versioned, installable bundle of metadata with declared dependencies. Versions must be built with code coverage of at least 75% before they can be promoted." },
    { front: "NoTestRun", track: "ops", back: "Test level that runs no tests. Allowed only in non-production orgs, and the house choice for metadata-only changes there." },
    { front: "RunSpecifiedTests", track: "ops", back: "Test level that runs only named test classes. In production each class and trigger in the deploy must reach 75% coverage from those tests alone." },
    { front: "sf project deploy validate", track: "ops", back: "A dry-run deploy that compiles components and runs tests without committing, producing a job id and per-class coverage." },
    { front: "Quick deploy", track: "ops", back: "Promotes a successful validation whose tests passed, within 10 days, without rerunning tests, so the release window takes minutes." },
    // crma
{ front: "Dataset", track: "crma", back: "A compressed, indexed, usually denormalised store that CRM Analytics queries. It changes only when the recipe or dataflow that builds it runs again." },
    { front: "Data sync", track: "crma", back: "The extraction layer that pulls Salesforce objects, incrementally where supported, and external connector data for recipes and dataflows to read." },
    { front: "Dataflow", track: "crma", back: "A JSON-defined build with nodes such as sfdcDigest, augment, computeExpression and sfdcRegister that produces datasets." },
    { front: "Recipe", track: "crma", back: "A visual Data Prep build with load, join, transform, aggregate and output steps, and the usual starting point for new data preparation." },
    { front: "SAQL", track: "crma", back: "The statement-by-statement query language for datasets: load, filter, group, foreach generate, order and limit, each reassigning the stream." },
    { front: "Faceting", track: "crma", back: "Automatic sharing of selections between dashboard steps on the same dataset; dataset links extend it across datasets." },
    { front: "Binding", track: "crma", back: "A double-brace expression that injects one step's selection or result into another step's query or a widget property, for interactions faceting cannot express." },
    { front: "Security predicate", track: "crma", back: "A row-level filter expression on a dataset, evaluated for every query, for example matching OwnerId to the running user." },
    { front: "Sharing inheritance", track: "crma", back: "Mirrors Salesforce record access for supported core objects in a dataset; users with very broad access fall back to a backup predicate." },
    { front: "Wave deploy order", track: "crma", back: "App if new, then recipe or dataflow, dataset, XMD, lens and dashboard last; the build must run after deploy before the dashboard shows data." },
    { front: "XMD", track: "crma", back: "Extended metadata for a dataset: field and member labels, number and date formats, colours, fiscal offsets and ordering. Shipped as WaveXmd matching the dataset API name." },
    { front: "XMD layers", track: "crma", back: "System XMD is generated from the dataset, user XMD holds your overrides, and main XMD is the merged view tools read." },
    { front: "Flattened-hierarchy predicate", track: "crma", back: "A flatten step writes each owner's chain of roles into a multi-value field; the predicate 'Roles' == \"$User.UserRoleId\" then lets managers see subordinates' rows." },
    { front: "Backup predicate", track: "crma", back: "The predicate applied to users whose access is too broad for sharing inheritance to resolve. Make it deliberate and test it." },
    { front: "Static step", track: "crma", back: "A dashboard step with fixed values, such as grouping choices, that users pick from and bindings inject into other steps." },
    { front: "coalesce in bindings", track: "crma", back: "Supplies a default when a selection is empty, keeping the bound query valid on first load." },
    // plat additions
    { front: "Junction object", track: "plat", back: "An object with two master-detail fields that models many-to-many. The first master-detail is primary; access needs both parents; roll-ups work on either." },
    { front: "Polymorphic lookup", track: "plat", back: "A standard field that can point at several object types, such as Task.WhatId, Task.WhoId or OwnerId (User or Queue). Filter with What.Type; you cannot create custom ones." },
    { front: "Big object (__b)", track: "plat", back: "Storage for billions of append-mostly rows. The index (up to 5 fields) is fixed at creation, queries filter on index fields in order, and there are no triggers, flows or record sharing." },
    { front: "External object (__x)", track: "plat", back: "A Salesforce Connect view over data that stays in another system, via OData, cross-org or a custom Apex adapter. Every view is a live callout." },
    { front: "Indirect lookup", track: "plat", back: "A relationship from an external object to a Salesforce parent, matched on a unique External ID field on the parent." },
    { front: "Validation rule", track: "plat", back: "A formula describing the bad state; TRUE blocks the save on every channel. Scope with ISCHANGED or ISNEW and bypass with a custom permission." },
    { front: "Formula field filtering", track: "plat", back: "Formulas are calculated at read time, so filtering on them cannot use a normal index. Store hot filter values in real fields." },
    { front: "Record type", track: "plat", back: "Controls allowed picklist values, the business process and the default layout. Resolve Ids by developer name, never hardcode them." },
    { front: "Layout-required", track: "plat", back: "Required on a page layout or in Dynamic Forms applies only in the UI; APIs and loaders ignore it. Use field-level required or a validation rule." },
    { front: "Dynamic Forms", track: "plat", back: "Fields and sections placed on the Lightning record page with visibility rules by field value, user, permission or device." },
    { front: "FlexiPage", track: "plat", back: "Lightning App Builder page metadata: template, components, visibility filters and activation by app, record type and profile." },
    { front: "lightning__RecordPage target", track: "plat", back: "Declared in an LWC's js-meta.xml with isExposed true so admins can place it on record pages; targetConfigs add design properties." },
    { front: "External OWD", track: "plat", back: "The org-wide default for external users in Experience Cloud. It can be stricter than the internal default and should be Private for partner data." },
    { front: "Sharing set", track: "plat", back: "Grants high-volume community users access to records that match their Account or Contact." },
    { front: "setWhatId", track: "plat", back: "On SingleEmailMessage, the related record whose merge fields render alongside the recipient set by setTargetObjectId." },
    // sec additions
    { front: "Deterministic encryption", track: "sec", back: "Shield Platform Encryption scheme where the same value yields the same ciphertext, allowing exact-match filters. Probabilistic is stronger but not filterable." },
    { front: "Field Audit Trail", track: "sec", back: "Shield feature that tracks up to 60 fields per object and retains field history by policy for up to about ten years." },
    { front: "Transaction Security policy", track: "sec", back: "Acts on Event Monitoring events in real time: block, require MFA or notify, for example on large report exports." },
    { front: "Encryption vs access", track: "sec", back: "Encryption protects data at rest; authorised users still see plaintext. Who may see a field is decided by FLS and sharing." },
    // flow additions
    { front: "Agent topic", track: "flow", back: "A job an agent can do: classification description, instructions, scope and the actions allowed for it." },
    { front: "Agent action", track: "flow", back: "A flow, invocable Apex method, prompt template or standard action the agent may call. Labels and descriptions guide the model's choice." },
    { front: "Einstein Trust Layer", track: "flow", back: "Governs prompts and responses: masking, zero data retention with model providers, toxicity checks and audit. It does not replace sharing or FLS." },
    // apex additions
    { front: "Custom metadata type", track: "apex", back: "Configuration records that deploy as metadata. Read with getAll() or getInstance(), never SOQL." },
    { front: "Hierarchy custom setting", track: "apex", back: "getInstance() resolves the running user's value, then the profile's, then the org default. Values are data and must be seeded per org." },
    { front: "Platform Cache", track: "apex", back: "Best-effort org or session cache in partitions. Load through Cache.CacheBuilder so misses rebuild; never cache user-restricted data in org cache." },
    { front: "Publish-immediately log events", track: "apex", back: "Log entries published as platform events survive a rollback, so failures are recorded even when the transaction is undone." },
    { front: "Savepoint", track: "apex", back: "Database.setSavepoint() and rollback() undo part of a transaction. Both count as DML, and Ids of rolled-back inserts are not cleared." },
    // int additions
    { front: "Upsert with external ID", track: "int", back: "Matches rows on a unique External ID so reruns update instead of duplicating; relationship columns such as Account.Legacy_Id__c resolve parents." },
    { front: "Data Import Wizard", track: "int", back: "Browser-based admin import for up to 50,000 records of supported objects, with duplicate matching." },
    { front: "UNABLE_TO_LOCK_ROW in loads", track: "int", back: "Parallel batches contending for the same parent. Sort children by parent, shrink batches or process serially." }
  ];

  function mountFlashcards(mountEl) {
    if (!mountEl) return;
    clearNode(mountEl);

    var deck = CARDS.map(function (c, i) { return { _idx: i, front: c.front, back: c.back, track: c.track }; });
    var tracksInDeck = [];
    var seen = {};
    deck.forEach(function (c) { if (!seen[c.track]) { seen[c.track] = true; tracksInDeck.push(c.track); } });

    var status = readFlash();
    var filter = "all";
    var order = deck.slice();
    var pos = 0;
    var flipped = false;

    var page = el("div", { class: "fc-page", style: "--accent: var(--indigo)" });
    page.appendChild(el("header", { class: "fc-head" },
      flashIco("fc-ico"),
      el("div", {},
        el("h1", { class: "fc-title" }, "Flashcards"),
        el("p", { class: "fc-sub" }, "Flip through key platform, security, automation, Apex, LWC and release terms and self-grade each one. Your progress saves locally in this browser.")
      )
    ));

    if (!deck.length) {
      page.appendChild(emptyState("Deck is empty", "No flashcards are available."));
      mountEl.appendChild(page);
      return;
    }

    // controls
    var filterSel = el("select", { class: "fc-select", "aria-label": "Track filter" });
    filterSel.appendChild(optionEl("all", "All tracks", true));
    tracksInDeck.forEach(function (t) { filterSel.appendChild(optionEl(t, trackLabel(t), false)); });
    filterSel.addEventListener("change", function () { filter = filterSel.value; applyFilter(); });

    var shuffleBtn = el("button", { class: "w-btn ghost", type: "button" }, "Shuffle");
    shuffleBtn.addEventListener("click", function () { order = shuffle(order.slice()); pos = 0; flipped = false; renderCard(); });
    var resetBtn = el("button", { class: "w-btn ghost", type: "button" }, "Reset deck");
    resetBtn.addEventListener("click", function () { Object.keys(status).forEach(function (k) { delete status[k]; }); saveFlash(status); renderCard(); updateProgress(); });

    var progressEl = el("span", { class: "fc-progress" }, "");
    page.appendChild(el("div", { class: "fc-controls" },
      el("label", { class: "w-field" }, el("span", {}, "Track"), filterSel),
      shuffleBtn, resetBtn, progressEl
    ));

    // flip card
    var frontTag = el("span", { class: "fc-track-tag" }, "");
    var backTag = el("span", { class: "fc-track-tag" }, "");
    var term = el("div", { class: "fc-term" }, "");
    var def = el("div", { class: "fc-def" }, "");
    var front = el("div", { class: "fc-face fc-front" }, frontTag, term, el("span", { class: "fc-hint" }, "Click the card or press Flip to reveal"));
    var back = el("div", { class: "fc-face fc-back" }, backTag, def);
    var inner = el("div", { class: "fc-inner" }, front, back);
    inner.addEventListener("click", function () { doFlip(); });
    page.appendChild(el("div", { class: "fc-stage" }, el("div", { class: "fc-card" }, inner)));

    var counter = el("span", { class: "fc-counter" }, "");
    var statusChip = el("span", { class: "fc-status" }, "");
    page.appendChild(el("div", { class: "fc-statusrow" }, counter, statusChip));

    var flipBtn = el("button", { class: "btn btn-ghost fc-flip", type: "button", "aria-pressed": "false" }, "Flip");
    flipBtn.addEventListener("click", function () { doFlip(); });
    var prevBtn = el("button", { class: "w-btn ghost", type: "button" }, "Prev");
    prevBtn.addEventListener("click", function () { if (pos > 0) { pos--; flipped = false; renderCard(); } });
    var nextBtn = el("button", { class: "w-btn ghost", type: "button" }, "Next");
    nextBtn.addEventListener("click", function () { if (pos < order.length - 1) { pos++; flipped = false; renderCard(); } });
    page.appendChild(el("div", { class: "fc-controls fc-actions" }, prevBtn, flipBtn, nextBtn));

    var goodBtn = el("button", { class: "w-btn fc-grade good", type: "button" }, "Got it");
    goodBtn.addEventListener("click", function () { grade("known"); });
    var badBtn = el("button", { class: "w-btn fc-grade bad", type: "button" }, "Review again");
    badBtn.addEventListener("click", function () { grade("review"); });
    page.appendChild(el("div", { class: "fc-controls fc-grades" }, goodBtn, badBtn));

    mountEl.appendChild(page);

    function currentCard() { return order[pos]; }
    function doFlip() {
      flipped = !flipped;
      inner.classList.toggle("is-flipped", flipped);
      flipBtn.setAttribute("aria-pressed", flipped ? "true" : "false");
    }
    function applyFilter() {
      order = (filter === "all" ? deck : deck.filter(function (c) { return c.track === filter; })).slice();
      pos = 0; flipped = false;
      renderCard(); updateProgress();
    }
    function grade(st) {
      var c = currentCard();
      if (!c) return;
      status[c._idx] = st;
      saveFlash(status);
      if (st === "known" && pos < order.length - 1) { pos++; flipped = false; }
      renderCard(); updateProgress();
    }
    function renderCard() {
      var c = currentCard();
      inner.classList.toggle("is-flipped", flipped);
      flipBtn.setAttribute("aria-pressed", flipped ? "true" : "false");
      var none = !c;
      goodBtn.disabled = badBtn.disabled = flipBtn.disabled = none;
      prevBtn.disabled = none || pos === 0;
      nextBtn.disabled = none || pos >= order.length - 1;
      if (none) {
        term.textContent = "No cards"; def.textContent = "";
        frontTag.textContent = ""; backTag.textContent = "";
        counter.textContent = "0 / 0";
        statusChip.className = "fc-status"; statusChip.textContent = "";
        return;
      }
      var lbl = trackLabel(c.track);
      term.textContent = c.front;
      def.textContent = c.back;
      frontTag.textContent = lbl;
      backTag.textContent = lbl;
      counter.textContent = (pos + 1) + " / " + order.length;
      var st = status[c._idx];
      statusChip.className = "fc-status" + (st ? " " + st : "");
      statusChip.textContent = st === "known" ? "Known" : st === "review" ? "Review again" : "Not graded";
    }
    function updateProgress() {
      var known = order.filter(function (c) { return status[c._idx] === "known"; }).length;
      progressEl.textContent = known + " / " + order.length + " known";
    }

    renderCard();
    updateProgress();
    scrollTop();
  }

  /* ---------------- public API ---------------- */
  window.AcademyExam = { mountExam: mountExam, mountFlashcards: mountFlashcards };
})();
