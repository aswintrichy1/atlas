/* =====================================================================
   CASCADE · Exam mode + Flashcards
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

  /* ---------------- track helpers ----------------
     Cascade quiz ids follow two shapes:
       • "de-<track>-<topic>"  for storage, modeling, batch, streaming, sql,
         and orchestration (the orchestration quizzes use the "ops" segment).
       • "sparksql-<topic>"    for the Spark SQL track (no "de-" namespace).
     trackOf() strips the shared "de-" namespace and resolves aliases, so it
     returns a canonical window.TRACKS id directly. */
  var PREFIX_ALIAS = { ops: "orchestration" };
  var TRACK_NAMES = {
    storage: "Storage & File Formats",
    modeling: "Data Modeling & Warehousing",
    batch: "Batch Processing & Spark",
    streaming: "Streaming & Real-time",
    orchestration: "Orchestration & DataOps",
    sql: "SQL & Query Engines",
    sparksql: "Spark SQL"
  };
  function trackOf(quizId) {
    var parts = String(quizId).split("-");
    var cand = (parts[0] === "de" && parts.length > 1) ? parts[1] : parts[0];
    return PREFIX_ALIAS[cand] || cand;
  }
  function trackLabel(trackId) {
    var T = window.TRACKS || {};
    var id = PREFIX_ALIAS[trackId] || trackId;
    if (T[id] && T[id].name) return T[id].name;
    if (TRACK_NAMES[id]) return TRACK_NAMES[id];
    return id ? id.charAt(0).toUpperCase() + id.slice(1) : "Other";
  }

  /* ---------------- quiz pool (read at call time) ---------------- */
  function allQuestions(trackFilter) {
    var Q = window.QUIZZES || {};
    var out = [];
    Object.keys(Q).forEach(function (qid) {
      var track = trackOf(qid);
      if (trackFilter && trackFilter !== "all" && track !== trackFilter) return;
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
          track: track
        });
      });
    });
    return out;
  }
  function availableTracks() {
    var Q = window.QUIZZES || {};
    var seen = {}, list = [];
    Object.keys(Q).forEach(function (qid) { var t = trackOf(qid); if (!seen[t]) { seen[t] = true; list.push(t); } });
    var order = Object.keys(window.TRACKS || {});
    list.sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
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
  var EXAM_KEY = "cs_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "cs_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
  // Cascade exposes window.Academy.recordAnswer (see app.js); the others keep
  // this module drop-in compatible with the sibling apps.
  function feedWeakSpot(qid, ok) {
    try {
      var host = window.Cascade || window.Academy || window.Blueprint || window.Citadel;
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
     Tracks match Cascade's window.TRACKS ids: storage, modeling, batch,
     streaming, orchestration, sql, sparksql.
     ===================================================================== */
  var CARDS = [
    /* ---- storage · Storage & File Formats ---- */
    { front: "Data lake", track: "storage", back: "A central repository that stores raw data of any structure cheaply on object storage, letting you decide on schema and structure at read time rather than load time." },
    { front: "Object vs file storage", track: "storage", back: "Object storage keeps data as immutable blobs addressed by key in a flat namespace with rich metadata and near-infinite scale; file storage exposes a mutable directory hierarchy. Analytics lakes favor object storage." },
    { front: "Columnar format (Parquet)", track: "storage", back: "A layout that stores all values of a column together, so analytical queries read only the columns they need and compress each column tightly, dramatically cutting I/O on wide-table scans." },
    { front: "Row vs columnar layout", track: "storage", back: "Row formats keep a record's fields together and suit transactional point reads and writes; columnar formats group values by column and suit large analytical scans over few columns." },
    { front: "Partitioning", track: "storage", back: "Physically splitting a dataset into folders by a column (often date) so a query can skip entire partitions it doesn't need, turning a full scan into a much smaller one." },
    { front: "Predicate pushdown", track: "storage", back: "Pushing filter conditions into the file reader so row groups or pages whose min/max statistics can't satisfy the predicate are skipped without ever being decompressed." },
    { front: "Small files problem", track: "storage", back: "A large number of tiny files forces excessive metadata lookups, planning work and task overhead; compaction rewrites them into fewer, right-sized files." },
    { front: "Open table format (Iceberg / Delta)", track: "storage", back: "A metadata layer over data-lake files that adds ACID transactions, schema evolution, and time travel, turning a bare directory of Parquet into a reliable, versioned table." },
    { front: "Snapshot", track: "storage", back: "An immutable table version that records the metadata and data files visible after a commit. Time travel reads an older snapshot; maintenance expires old snapshots after a retention window." },
    { front: "Manifest", track: "storage", back: "Iceberg metadata that lists groups of data files and their statistics, letting engines plan scans without listing every object-storage file directly." },
    { front: "Orphan file", track: "storage", back: "A data or metadata file present in storage but no longer referenced by any retained table snapshot, usually from failed writes or expired metadata; delete only after a safe retention window." },
    { front: "Data lakehouse", track: "storage", back: "An architecture that puts warehouse-style management \u2014 transactions, schemas, governance \u2014 directly on cheap data-lake storage, serving both BI and data science from one copy of the data." },
    { front: "Catalog vs table format", track: "storage", back: "The catalog maps a table name to metadata, ownership and the current pointer; the table format defines snapshots, schemas, manifests, data files and delete files that make the table correct." },
    { front: "Schema evolution", track: "storage", back: "Changing a table schema over time using stable column identity so readers can safely handle added, renamed, dropped or reordered columns across old and new files." },
    { front: "Equality vs position delete", track: "storage", back: "An equality delete removes rows matching key values; a position delete removes exact row positions in specific data files. Both let table formats model row-level deletes without in-place mutation." },
    { front: "Snapshot branch or tag", track: "storage", back: "A named reference to a table snapshot used for experiments, audits, reproducibility or controlled promotion while the main table continues to evolve." },
    { front: "CDC snapshot boundary", track: "storage", back: "The source log position captured with an initial table snapshot, used to switch from bulk copy to streaming changes without missing or double-applying rows." },
    { front: "CDC tombstone", track: "storage", back: "A delete marker keyed by the source primary key that tells downstream tables or indexes to remove a row rather than treating the missing after-image as an ordinary null payload." },
    { front: "Vector index", track: "storage", back: "A serving structure over embeddings that supports approximate nearest-neighbor search; it must track source ids, model version, refresh policy and tombstone handling like any other derived product." },
    { front: "Feature table", track: "storage", back: "A curated table of ML features keyed by entity and time, built with point-in-time correctness so training and serving do not accidentally look into the future." },

    /* ---- modeling · Data Modeling & Warehousing ---- */
    { front: "Star schema", track: "modeling", back: "A dimensional model with one central fact table referencing denormalized dimension tables, giving simple joins and fast aggregations for analytics at the cost of some redundancy." },
    { front: "Snowflake schema", track: "modeling", back: "A star schema whose dimensions are normalized into sub-dimension tables, reducing redundancy but adding more joins and complexity to every query." },
    { front: "Fact table", track: "modeling", back: "A table storing the measurements of a business process (such as sales amount) at a defined grain, with foreign keys to the dimensions that give those numbers context." },
    { front: "Dimension table", track: "modeling", back: "A table of descriptive attributes \u2014 customer, product, date \u2014 used to filter, group, and label facts, providing the who, what, where, and when of an event." },
    { front: "Grain", track: "modeling", back: "The precise level of detail one fact row represents, such as one row per line item per order. Declaring the grain first is the foundation of a sound dimensional model." },
    { front: "Slowly changing dimension (SCD)", track: "modeling", back: "A technique for dimension attributes that change over time: Type 1 overwrites the old value, while Type 2 adds a new versioned row so historical facts still join to the value that was current then." },
    { front: "Surrogate key", track: "modeling", back: "A system-generated, meaningless integer used as a dimension's primary key instead of a business key, insulating the model from changes and duplicates in source identifiers." },
    { front: "Conformed dimension", track: "modeling", back: "A dimension shared consistently across multiple fact tables or marts, so metrics from different processes can be sliced and compared on exactly the same attributes." },
    { front: "Normalization", track: "modeling", back: "Organizing relational tables to remove redundancy and update anomalies by storing each fact once. It is ideal for transactional systems but multiplies joins for analytics." },
    { front: "Data product", track: "modeling", back: "An owned, documented, reusable data asset with a clear purpose, quality checks, access rules and SLOs, treated like a product rather than an anonymous table." },
    { front: "Output port", track: "modeling", back: "A stable consumer-facing interface of a data product, such as a curated table, event stream, API, feature view or metric endpoint, backed by a contract." },
    { front: "Metric contract", track: "modeling", back: "The governed agreement for a metric: formula, grain, approved dimensions, filters, owner, freshness target and tests that keep every consumer calculating the same number." },
    { front: "Data mesh", track: "modeling", back: "An operating model where domains own data products, a self-service platform provides reusable publishing paths, and federated governance keeps standards consistent across domains." },
    { front: "Federated governance", track: "modeling", back: "A shared decision model where domain experts and central governance define interoperable policies for naming, privacy, contracts, metrics and quality without centralizing every dataset." },
    { front: "Output port lifecycle", track: "modeling", back: "The managed path from design to publish, operate, evolve and retire, with versioning and deprecation rules so consumers are not broken by surprise changes." },
    { front: "Source-target reconciliation", track: "modeling", back: "Comparing source and modeled target using counts, key coverage, aggregate tie-outs and checksums to prove the pipeline did not lose, duplicate or mutate data unexpectedly." },
    { front: "Point-in-time join", track: "modeling", back: "Joining a fact to the dimension version valid at the fact's event time, usually with event_ts between valid_from and valid_to, so history is not restated with current attributes." },
    { front: "Non-additive metric", track: "modeling", back: "A measure such as a ratio or percentage that cannot be summed across dimensions. Aggregate the numerator and denominator first, then divide at the requested grain." },

    /* ---- batch · Batch Processing & Spark ---- */
    { front: "Batch processing", track: "batch", back: "Running a computation over a bounded, finite dataset on a schedule, processing all the accumulated data at once rather than record by record as it arrives." },
    { front: "ETL vs ELT", track: "batch", back: "ETL transforms data before loading it into the warehouse; ELT loads raw data first and transforms it inside the warehouse, leaning on cheap scalable compute and keeping the raw source available." },
    { front: "Idempotency", track: "batch", back: "Designing a job so re-running it for the same input produces the same result without duplicating or corrupting data, usually via overwrite-by-partition or merge rather than blind append." },
    { front: "Backfill", track: "batch", back: "Re-running a pipeline over historical periods, typically partition by partition, to populate or correct past data after adding a new field or fixing a bug." },
    { front: "Incremental processing", track: "batch", back: "Processing only the new or changed records since the last run, tracked by a watermark, instead of reprocessing the entire dataset every time." },
    { front: "Full vs incremental load", track: "batch", back: "A full load reprocesses and replaces the whole dataset for simplicity and correctness; an incremental load handles only deltas for speed and cost, at the price of more bookkeeping." },
    { front: "Tumbling window", track: "batch", back: "Dividing time into fixed-size, non-overlapping intervals so each record falls in exactly one window, used to compute periodic aggregates like hourly or daily totals." },
    { front: "Watermark (high-water mark)", track: "batch", back: "A stored marker of the latest data already processed \u2014 a timestamp or id \u2014 that lets the next run pick up exactly where the previous one stopped." },
    { front: "Upsert / merge", track: "batch", back: "A write that inserts new rows and updates matching existing ones in one operation keyed by a unique id, so repeated runs converge to the correct state instead of creating duplicates." },
    { front: "dbt slim CI", track: "batch", back: "A pull-request validation pattern that compares the branch to the last production manifest, then builds only modified models and their downstream dependents while deferring unchanged parents to production." },
    { front: "dbt exposure", track: "batch", back: "A documented downstream consumer such as a dashboard, notebook, report or ML job, included in lineage so model owners can see what a change might break." },
    { front: "dbt materialization", track: "batch", back: "The strategy dbt uses to persist a model: view for cheap freshness, table for fast reads, incremental for large changing facts, or ephemeral for inlining reusable SQL." },
    { front: "Semantic model", track: "batch", back: "A semantic-layer object that maps a warehouse model to entities, dimensions, time dimensions and measures, giving metrics a governed foundation." },
    { front: "Simple metric", track: "batch", back: "A metric that directly aggregates one measure, such as gross revenue as the sum of gross_amount." },
    { front: "Ratio metric", track: "batch", back: "A metric that divides a numerator by a denominator after both are aggregated at the requested grain, such as refunds divided by orders." },
    { front: "Cumulative metric", track: "batch", back: "A metric that accumulates over time, such as lifetime revenue to date or running active accounts." },
    { front: "Derived metric", track: "batch", back: "A metric expressed from other metrics, such as net revenue equals gross revenue minus refunds and discounts." },
    { front: "Conversion metric", track: "batch", back: "A metric that measures how often a starting event leads to a conversion event within a defined window, such as trial to paid within 14 days." },

    /* ---- streaming · Streaming & Real-time ---- */
    { front: "Stream processing", track: "streaming", back: "Continuously processing unbounded data record by record (or in micro-batches) as it arrives, producing low-latency results instead of waiting for a complete dataset." },
    { front: "Event time vs processing time", track: "streaming", back: "Event time is when an event actually occurred at the source; processing time is when the system handles it. Correct windowed analytics use event time to stay accurate despite delays." },
    { front: "Watermark", track: "streaming", back: "A moving threshold in event time declaring that no earlier events are still expected, letting the engine close windows and emit results while tolerating bounded lateness." },
    { front: "Exactly-once semantics", track: "streaming", back: "A guarantee that each record affects the result a single time despite retries and failures, usually achieved with idempotent writes or transactions tying output to consumed input offsets." },
    { front: "At-least-once vs at-most-once", track: "streaming", back: "At-least-once may reprocess records, risking duplicates but no loss; at-most-once may drop records, risking loss but no duplicates. Exactly-once combines no loss with no duplicates." },
    { front: "Kafka topic", track: "streaming", back: "A named, append-only log of messages that producers write to and consumers read from, serving as the durable channel that decouples event producers from consumers." },
    { front: "Kafka partition", track: "streaming", back: "A topic is split into partitions, each an ordered log that is the unit of parallelism and ordering; order is guaranteed within a partition but never across partitions." },
    { front: "Consumer group", track: "streaming", back: "A set of consumers that share a topic's partitions so each partition is read by exactly one member, letting throughput scale horizontally while progress is tracked by committed offsets." },
    { front: "Change data capture (CDC)", track: "streaming", back: "Streaming a database's row-level inserts, updates, and deletes \u2014 often by reading its transaction log \u2014 so downstream systems stay in sync in near real time without bulk reloads." },
    { front: "Flink keyed state", track: "streaming", back: "Managed state partitioned by stream key and owned by parallel subtasks, used for counts, dedupe, joins and other per-key memory that must recover with the job." },
    { front: "State backend", track: "streaming", back: "The storage engine Flink uses for managed state, such as heap for smaller fast state or an embedded RocksDB-style backend for larger durable state." },
    { front: "Checkpoint vs savepoint", track: "streaming", back: "A checkpoint is automatic failure recovery state; a savepoint is a manually triggered durable recovery point used for upgrades, migrations, rollback and rescaling." },
    { front: "State TTL", track: "streaming", back: "A time-to-live policy for keyed state that expires stale entries after the business correctness window, preventing dedupe sets, joins and sessions from growing forever." },
    { front: "Backpressure", track: "streaming", back: "A downstream operator or sink cannot keep up, so pressure propagates upstream, increasing lag and checkpoint duration until capacity, skew or sink behavior is fixed." },
    { front: "Transactional sink", track: "streaming", back: "A sink that commits output only when the matching checkpoint succeeds, giving effectively-once results together with consistent source offsets and restored state." },

    /* ---- orchestration · Orchestration & DataOps ---- */
    { front: "Orchestration", track: "orchestration", back: "Coordinating the tasks of a data pipeline so they run in the right order, at the right time, with dependencies, retries, and monitoring handled centrally rather than by hand." },
    { front: "DAG (directed acyclic graph)", track: "orchestration", back: "A pipeline modeled as tasks connected by dependency edges with no cycles, which guarantees a valid execution order and rules out circular waits between steps." },
    { front: "Idempotent task", track: "orchestration", back: "A pipeline step that can be safely retried or re-run for the same parameters without side effects or duplicate data \u2014 the property that makes automatic retries and backfills safe." },
    { front: "Retry with backoff", track: "orchestration", back: "Automatically re-attempting a failed task while waiting progressively longer between tries, to ride out transient errors without overwhelming a struggling dependency." },
    { front: "Scheduling vs triggering", track: "orchestration", back: "Scheduling runs a pipeline on a time cadence such as hourly; triggering starts it in response to an event like a file landing or an upstream task finishing." },
    { front: "Data lineage", track: "orchestration", back: "A traceable map of where data came from and how it was transformed across tables and jobs, used for impact analysis, debugging, and compliance." },
    { front: "OpenLineage", track: "orchestration", back: "An open event model that records jobs, runs, input/output datasets and facets such as schema, SQL, errors and quality results, creating runtime lineage from actual executions." },
    { front: "Logical (execution) date", track: "orchestration", back: "Parameterizing each run by the data interval it targets rather than wall-clock time, so a run always processes the same slice of data no matter when it actually executes." },
    { front: "Data quality test", track: "orchestration", back: "An automated check \u2014 not-null, uniqueness, accepted ranges, referential integrity \u2014 that runs in the pipeline and fails the load when assumptions about the data are violated." },
    { front: "SLA / freshness", track: "orchestration", back: "A commitment about how current or timely a dataset must be; the orchestrator alerts when a task misses its expected completion time so stale data is caught early." },
    { front: "Asset-centric orchestration", track: "orchestration", back: "An orchestration model that treats datasets and data products as first-class objects with dependencies, owners, partitions, checks and freshness, rather than only tracking task execution." },
    { front: "Dataset-aware scheduling", track: "orchestration", back: "Starting downstream work when a declared upstream dataset is updated or materialized, avoiding brittle time-based guesses about when inputs should be ready." },
    { front: "Dynamic partition", track: "orchestration", back: "A partition key discovered at runtime, such as a tenant, country, account or late-arriving date, that the orchestrator can materialize and retry independently." },
    { front: "Sensor vs event trigger", track: "orchestration", back: "A sensor waits or polls for a condition such as a file or partition; an event trigger reacts to a durable event emitted by the producer. Events are cleaner when the source can emit them reliably." },
    { front: "Active metadata", track: "orchestration", back: "Metadata that drives behavior: ownership routes incidents, policy tags enforce masking, quality signals warn consumers, and lineage scopes backfills or schema migrations." },
    { front: "Policy tag", track: "orchestration", back: "A governance label on a column or asset, such as restricted PII, that can drive masking, access approval, audit review and deletion workflows." },
    { front: "Privacy deletion workflow", track: "orchestration", back: "The end-to-end process of finding every copy of a subject's data, deleting or masking live tables, respecting retention and legal holds, and producing audit proof." },
    { front: "Legal hold", track: "orchestration", back: "A requirement to retain specific data despite normal deletion or retention policies, while restricting access and documenting the exception in the audit trail." },
    { front: "Architecture Decision Record (ADR)", track: "orchestration", back: "A short record of a significant design decision: context, options considered, chosen approach, trade-offs, consequences and rollback triggers." },
    { front: "SLO dashboard", track: "orchestration", back: "A consumer-facing reliability dashboard showing whether a data product meets freshness, completeness, quality, latency and cost promises, not just whether jobs succeeded." },
    { front: "Warehouse incident comms", track: "orchestration", back: "A clear update for consumers: impact, affected datasets and dates, current freshness, owner, mitigation, ETA, workaround and next update time." },
    { front: "Cost engineering", track: "orchestration", back: "Managing data-platform spend through scan pruning, right-sized compute, auto-suspend, materialization, bounded backfills, ownership and spend anomaly alerts." },

    /* ---- sql · SQL & Query Engines ---- */
    { front: "Inner vs outer join", track: "sql", back: "An inner join returns only rows matching in both tables; outer joins also keep unmatched rows from the left, right, or both sides, filling the missing columns with nulls." },
    { front: "Window function", track: "sql", back: "A function that computes across a set of rows related to the current row \u2014 a window \u2014 without collapsing them, enabling running totals, rankings, and moving averages beside detail rows." },
    { front: "GROUP BY vs window", track: "sql", back: "GROUP BY collapses rows into one per group and returns aggregates; a window function keeps every row and attaches the aggregate, so you can compare a row against its group." },
    { front: "Query optimizer", track: "sql", back: "The engine component that turns SQL into an efficient physical plan, choosing join orders, join algorithms, and access paths based on statistics about the data." },
    { front: "Predicate pushdown (SQL)", track: "sql", back: "Applying filters as early as possible \u2014 ideally at the storage scan \u2014 so fewer rows flow through the rest of the plan, cutting both I/O and downstream work." },
    { front: "Partition pruning", track: "sql", back: "The optimizer skipping partitions that a query's filter cannot match, so a well-partitioned, well-filtered query scans only a small fraction of the table." },
    { front: "Massively parallel processing (MPP)", track: "sql", back: "A query architecture that splits work across many nodes, each processing a shard of the data in parallel and then combining results, scaling analytics to very large datasets." },
    { front: "Broadcast vs shuffle join", track: "sql", back: "A broadcast join copies a small table to every node to join locally; a shuffle join repartitions both tables by the join key across the cluster. Broadcasting wins when one side is small." },
    { front: "Cardinality estimation", track: "sql", back: "The optimizer's prediction of how many rows each operation produces; bad estimates, often from stale statistics, lead to poor join orders and slow plans." },

    /* ---- sparksql · Spark SQL ---- */
    { front: "RDD vs DataFrame", track: "sparksql", back: "An RDD is Spark's low-level distributed collection with no schema and manual optimization; a DataFrame adds a schema and runs through the Catalyst optimizer, so it is faster and simpler for most work." },
    { front: "Lazy evaluation", track: "sparksql", back: "Spark records transformations as a plan and computes nothing until an action is called, letting it optimize and fuse the entire chain before any data moves." },
    { front: "Transformation vs action", track: "sparksql", back: "Transformations like map, filter, and join are lazy and build the lineage; actions like collect, count, and save trigger execution and return a result or write output." },
    { front: "Shuffle", track: "sparksql", back: "The expensive redistribution of data across the cluster by key \u2014 for joins, groupBy, or repartition \u2014 involving network and disk I/O, and the usual source of Spark performance problems." },
    { front: "Partition (Spark)", track: "sparksql", back: "The unit of parallelism: each partition is processed by one task on one core, so the number of partitions controls parallelism and how evenly work is balanced across the cluster." },
    { front: "Catalyst optimizer", track: "sparksql", back: "Spark SQL's query optimizer that rewrites the logical plan \u2014 pushing down filters, pruning columns \u2014 and selects physical operators before generating efficient execution code." },
    { front: "Broadcast join", track: "sparksql", back: "A join where a small table is sent to every executor so each partition of the big table joins it locally, avoiding a shuffle and greatly speeding up large-to-small joins." },
    { front: "Wide vs narrow transformation", track: "sparksql", back: "A narrow transformation such as map or filter needs only one parent partition per child and no shuffle; a wide one such as groupByKey or join depends on many partitions and forces a shuffle." },
    { front: "Data skew", track: "sparksql", back: "When some keys hold far more data than others, a few tasks run much longer than the rest after a shuffle and bottleneck the job; mitigations include salting keys or broadcasting the small side." }
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
        el("p", { class: "fc-sub" }, "Flip through key terms across storage, modeling, processing, streaming, and the rest of the data-engineering stack, and self-grade each one. Your progress saves locally in this browser.")
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
