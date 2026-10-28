/* =====================================================================
   LEDGER · Exam mode + Flashcards
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
  // Quiz ids in Ledger use these prefixes: store-, idx-, qp-, txn-, dist-, pg-, col-, sql-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["store", "idx", "qp", "txn", "dist", "pg", "col", "sql"];
  var TRACK_NAMES = {
    store: "Storage Engines",
    idx: "Indexing",
    qp: "Query Processing",
    txn: "Transactions & Concurrency",
    dist: "Replication & Distribution",
    pg: "Postgres in Practice",
    col: "Columnar & MPP Engines",
    sql: "SQL Mastery for Interviews",
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
  var EXAM_KEY = "lg_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "lg_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
     Tracks match Ledger's window.TRACKS ids: store, idx, qp, txn, dist, pg, col, sql.
     ===================================================================== */
  var CARDS = [
    // store
    { front: "Page", track: "store", back: "The fixed-size unit a database reads, writes and caches (8 KB in PostgreSQL, 16 KB in InnoDB, 4 KB by default in SQLite). Query cost is counted in pages touched, not rows returned." },
    { front: "Slotted page", track: "store", back: "A page layout with a header, a slot array growing from the front and tuples growing from the back. Rows are addressed as (page, slot), so tuples can move inside the page without breaking index pointers." },
    { front: "Torn page", track: "store", back: "A page only partly written when power fails, because the page is bigger than the device's atomic write unit. PostgreSQL full-page writes and the InnoDB doublewrite buffer exist to repair it." },
    { front: "Heap file vs clustered index", track: "store", back: "A heap stores rows in unordered pages, and indexes point at row addresses. A clustered (index-organized) table stores the rows inside the primary-key B+tree, so secondary indexes hold the primary key instead." },
    { front: "B+tree fanout", track: "store", back: "The number of children an internal page can point to, roughly page size divided by key-plus-pointer size. Fanout in the hundreds to thousands keeps 100 million rows within three or four levels." },
    { front: "Leaf split vs internal split", track: "store", back: "A leaf split copies the first key of the new right leaf into the parent and keeps it in the leaf. An internal split pushes the middle key up and keeps it in neither half. Only a root split adds a level." },
    { front: "Latch vs lock", track: "store", back: "A latch is a short-lived mutex protecting an in-memory page during one operation. A lock protects logical data for a transaction until commit or abort." },
    { front: "LSM-tree", track: "store", back: "A storage structure that buffers writes in a sorted in-memory memtable, flushes them as immutable sorted files, and merges those files in the background. Writes become sequential, and reads must check several runs." },
    { front: "Tombstone", track: "store", back: "A marker written to delete a key in an immutable, log-structured store. It shadows older versions until compaction merges it past every older copy and both can be dropped." },
    { front: "Write / read / space amplification", track: "store", back: "Bytes written to storage per byte written by the user, runs or I/Os consulted per lookup, and bytes on disk per byte of live data. Compaction strategies trade these three against each other." },
    { front: "Write-ahead logging rule", track: "store", back: "Log records for a change must be durable before the changed page is written, and the commit record must be durable before the commit is acknowledged. This allows steal / no-force buffering." },
    { front: "Checkpoint", track: "store", back: "A point after which every change before a recorded redo LSN is guaranteed to be in the data files. It bounds crash-recovery time and lets older log be recycled." },
    // idx
    { front: "Clustered index", track: "idx", back: "An index whose leaf pages hold the table rows themselves, in key order. InnoDB stores every table this way, keyed by the primary key." },
    { front: "Secondary index (InnoDB)", track: "idx", back: "A B+tree whose leaves store the indexed columns plus the primary key, so a lookup descends it to find the PK and then descends the clustered index to find the row." },
    { front: "TID / ctid", track: "idx", back: "PostgreSQL's physical tuple address, a block number plus a line-pointer slot. Every Postgres index entry points at one, so a row version that moves needs new index entries." },
    { front: "HOT update", track: "idx", back: "A PostgreSQL heap-only tuple update: when no indexed column changes and the new version fits on the same page, it is chained from the old tuple and no index is touched." },
    { front: "Index-only scan", track: "idx", back: "A plan that answers a query entirely from index entries because they contain every needed column. In Postgres it still visits the heap for pages not marked all-visible in the visibility map." },
    { front: "INCLUDE columns", track: "idx", back: "Non-key payload columns stored in index leaves to make an index covering. They cannot be searched or sorted on and do not count toward uniqueness." },
    { front: "Leftmost prefix rule", track: "idx", back: "A composite B-tree on (a, b, c) can seek on a, on a and b, or on all three, but not on b or c alone, because entries are sorted by a first." },
    { front: "Equality before range", track: "idx", back: "In a composite index, put equality-filtered columns before the range or sort column; once a range is applied, later columns can only be filtered entry by entry, not sought." },
    { front: "GIN index", track: "idx", back: "An inverted index mapping each element inside a value (word, array item, jsonb key or pair) to the rows containing it. Fast containment search, expensive updates." },
    { front: "BRIN index", track: "idx", back: "A block range index that stores a min/max summary per range of heap pages. Tiny and cheap to maintain, but useful only when the column correlates with physical row order." },
    { front: "Bitmap heap scan", track: "idx", back: "A Postgres plan that collects matching row locations from one or more indexes into an in-memory bitmap, then reads each heap page once in physical order. It becomes lossy when work_mem runs out." },
    { front: "Bloom filter false-positive rate", track: "idx", back: "With m bits, k hashes and n keys, p is about (1 - e^(-kn/m))^k, minimised at k = (m/n) ln 2. Roughly 9.6 bits per key gives 1%, and there are never false negatives." },
    { front: "IVF vector index", track: "idx", back: "Clusters vectors with k-means into nlist lists; a query ranks the centroids and scans only the nprobe nearest lists. Raising nprobe raises recall and cost roughly in proportion." },
    { front: "HNSW", track: "idx", back: "Hierarchical navigable small world: a layered neighbour graph searched greedily from sparse top layers down to the full bottom layer. High recall at low latency, at the price of memory for edges and slow builds." },
    { front: "Product quantization", track: "idx", back: "Splits a vector into sub-vectors and stores each as a one-byte codebook id, shrinking a 3 KB embedding to around 100 bytes. Distances become table lookups; the best candidates are re-ranked with full vectors." },
    { front: "Recall@k", track: "idx", back: "The fraction of the true k nearest neighbours that an approximate index returns. It is the quality metric to tune ANN knobs such as nprobe or ef_search against a latency budget." },
    // qp
    { front: "Binding (semantic analysis)", track: "qp", back: "The stage after parsing that resolves table, column and function names against the catalog and assigns types. Unknown-column and ambiguity errors come from here, not from the grammar." },
    { front: "Logical vs physical operator", track: "qp", back: "A logical operator states the result wanted (join, filter, aggregate); a physical operator is the algorithm that computes it (hash join, index scan, sort). The optimizer maps one to the other by cost." },
    { front: "Volcano iterator model", track: "qp", back: "Each operator exposes open/next/close and the root pulls one row at a time through the tree. Simple and streaming, but pays call and interpretation overhead per row per operator." },
    { front: "Vectorized execution", track: "qp", back: "Operators pass batches of roughly a thousand column values per call, so per-call overhead is amortised and tight loops can use SIMD and stay in cache." },
    { front: "Pipeline breaker", track: "qp", back: "An operator that must consume all of its input before emitting output, such as a sort, a hash aggregate or a hash-join build. Breakers split plans into pipelines and are where memory spills happen." },
    { front: "Most common values (MCV) list", track: "qp", back: "Per-column statistic holding the most frequent values and their frequencies, so equality on a heavy hitter gets an exact selectivity instead of a uniform 1/NDV guess." },
    { front: "Equi-depth histogram", track: "qp", back: "A histogram whose buckets each hold about the same number of rows, giving accurate range estimates even on skewed data. Postgres builds it over values not already in the MCV list." },
    { front: "Independence assumption", track: "qp", back: "The planner multiplies per-column selectivities for AND predicates. Correlated columns make the true selectivity far higher, producing underestimates that favour nested loops and index scans." },
    { front: "Interesting order", track: "qp", back: "A sort order a subplan produces that a later operator (merge join, ORDER BY, GROUP BY) can use. System R style DP keeps the cheapest plan per interesting order, not just the cheapest overall." },
    { front: "Grace hash join cost", track: "qp", back: "About 3(M+N) page I/Os when memory exceeds the square root of the smaller input: partition both sides once (read + write), then read each partition pair to build and probe." },
    { front: "loops in EXPLAIN ANALYZE", track: "qp", back: "How many times a node ran. Actual time and rows are reported per loop, so multiply by loops to get the node's real total, especially under a nested loop." },
    { front: "Generic plan (parameter sniffing)", track: "qp", back: "A cached plan built without, or for one particular, parameter value and reused for all values. It goes badly wrong when values have very different selectivities, such as one huge tenant." },
    { front: "Runtime filter", track: "qp", back: "A summary of the join keys that survive on the hash-join build side (bloom filter, min/max range or IN-list), pushed into the probe-side scan so rows that cannot match are dropped before shuffle and probe." },
    { front: "Dynamic partition pruning", track: "qp", back: "Using join-key ranges discovered at runtime to skip whole partitions or files of the fact table. It only helps when the fact table is partitioned or clustered on the join key." },
    { front: "Adaptive query execution (Spark)", track: "qp", back: "Re-optimisation at shuffle-stage boundaries using exact sizes: switch sort-merge to broadcast joins, coalesce tiny partitions and split skewed ones." },
    { front: "Adaptive join (SQL Server)", track: "qp", back: "A plan operator holding both hash-join and nested-loop strategies; after reading the build input, a row-count threshold decides which one runs." },
    // txn
    { front: "Snapshot isolation", track: "txn", back: "Each transaction reads from one consistent snapshot of committed data and aborts if it updates a row a concurrent transaction already changed. It blocks dirty reads, non-repeatable reads and phantoms but still allows write skew." },
    { front: "Write skew", track: "txn", back: "Two concurrent transactions read an overlapping set of rows, then each writes a different row based on what it read, jointly breaking an invariant. Snapshot isolation misses it because no row is written twice." },
    { front: "Lost update", track: "txn", back: "Two transactions read the same value, compute new values in the application, and write back, so one write silently overwrites the other. Fix with an atomic UPDATE, SELECT ... FOR UPDATE, a version check, or snapshot isolation's first-updater-wins abort." },
    { front: "Read skew", track: "txn", back: "A transaction reads two related items at different moments and sees a combination that never existed, such as a transfer counted on one side only. A single transaction-wide snapshot prevents it." },
    { front: "Strict two-phase locking", track: "txn", back: "Transactions acquire locks without releasing any until they finish, and hold exclusive locks until commit or abort. It guarantees serializability and avoids cascading aborts at the cost of blocking and deadlocks." },
    { front: "Next-key lock", track: "txn", back: "InnoDB's lock on an index record plus the gap before it. It stops other transactions inserting into a scanned range, which is how InnoDB prevents phantoms for locking reads." },
    { front: "xmin / xmax", track: "txn", back: "Postgres tuple header fields holding the xid that created the version and the xid that deleted or superseded it. A snapshot sees a version when xmin is visible to it and xmax is unset or not visible." },
    { front: "Undo log (InnoDB)", track: "txn", back: "Before-images of rows that InnoDB updates in place, chained from each row's roll pointer. Consistent reads walk the chain to an older version and purge discards undo once no read view needs it." },
    { front: "rw-antidependency", track: "txn", back: "An edge T1 to T2 where T1 read a version that T2 later superseded without T1 seeing the change. SSI aborts a transaction when two consecutive such edges appear among concurrent transactions." },
    { front: "Waits-for graph", track: "txn", back: "A graph with one node per transaction and an arrow from each waiter to the lock holder it waits on. A cycle is a deadlock, resolved by aborting a victim." },
    { front: "SQLSTATE 40001", track: "txn", back: "The serialization_failure error raised when a transaction cannot be committed safely under its isolation level. The application should retry the entire transaction, including its reads." },
    { front: "Exclusion constraint", track: "txn", back: "A Postgres constraint that forbids any two rows whose chosen columns all satisfy given operators, such as same room and overlapping time range. It enforces no-double-booking even when the conflicting row does not exist yet." },
    { front: "Intention locks (IS, IX, SIX)", track: "txn", back: "Locks on a table or page announcing that finer-grained S or X locks are held below. They let a table-level lock request detect conflicts without scanning every row lock." },
    { front: "Lock escalation", track: "txn", back: "Replacing many row or page locks held by one statement on one object with a single table lock. SQL Server does it (roughly 5,000 locks); Postgres, Oracle and InnoDB do not escalate row locks." },
    { front: "Optimistic concurrency control", track: "txn", back: "Work without locks, then validate at write time, typically UPDATE ... WHERE version = :seen; zero rows updated means someone else won. Best when conflicts are rare or think time is long." },
    { front: "Snowflake isolation", track: "txn", back: "Standard tables support only READ COMMITTED with a snapshot per statement; UPDATE, DELETE and MERGE on the same table largely serialise. Use Time Travel for a fixed point in time." },
    // dist
    { front: "Physical vs logical replication", track: "dist", back: "Physical replication ships byte-level WAL page changes and yields an exact copy of the whole cluster; logical replication ships row-level changes keyed by primary key, so it can filter tables, cross major versions and feed CDC." },
    { front: "Semi-synchronous replication", track: "dist", back: "The leader waits until at least one replica confirms it has received a transaction before acknowledging the commit. In MySQL it falls back to asynchronous if no replica answers within a timeout." },
    { front: "Read-your-writes", track: "dist", back: "A session guarantee that a client always sees its own earlier writes. Typically implemented by reading from the leader briefly after a write, or waiting until a replica has replayed past the write's LSN." },
    { front: "Fencing token", track: "dist", back: "A number that increases with every leader promotion and is checked by storage or downstream services, which reject requests carrying an older token. It stops a deposed leader from causing split brain." },
    { front: "Consistent hashing with virtual nodes", track: "dist", back: "Servers and keys share one hash ring and each key belongs to the next server token clockwise. Giving each server many tokens evens out load and means a membership change moves only about 1/N of the keys." },
    { front: "Local vs global secondary index", track: "dist", back: "A local index lives with each partition's rows, so writes are cheap but lookups scatter to every partition. A global index is partitioned by the indexed value, so lookups are targeted but writes span nodes and are often applied asynchronously." },
    { front: "Quorum condition R + W > N", track: "dist", back: "If reads ask R replicas and writes wait for W out of N, any read set overlaps any write set, so a read can find the latest acknowledged write. It does not by itself make the system linearizable." },
    { front: "Hinted handoff", track: "dist", back: "When a key's home replica is down, another node stores the write together with a hint naming the intended owner, and forwards it once the owner returns." },
    { front: "Linearizability", track: "dist", back: "Every operation appears to take effect at a single instant between its invocation and its response, so the system behaves like one copy and respects real-time order. It is about single-object recency, not multi-object transactions." },
    { front: "Raft election restriction", track: "dist", back: "A voter grants its vote only if the candidate's log is at least as up to date as its own, comparing last log term first and then length. This guarantees a new leader already holds every committed entry." },
    { front: "Two-phase commit blocking", track: "dist", back: "A participant that has voted yes is in doubt: it can neither commit nor abort alone, so it holds its locks until the coordinator recovers or its decision is learned." },
    { front: "TrueTime commit wait", track: "dist", back: "Spanner assigns a commit timestamp at the top of TrueTime's uncertainty interval and waits until that timestamp is definitely past before acknowledging, so timestamp order matches real-time order." },
    { front: "Change data capture (log-based)", track: "dist", back: "Decoding committed changes from the WAL or row binlog into ordered per-row events. Captures deletes, adds no work to user transactions, and delivers at least once, so consumers must be idempotent." },
    { front: "Transactional outbox", track: "dist", back: "Writing the event to an outbox table in the same transaction as the business change, then publishing committed outbox rows with CDC. It replaces unsafe dual writes to a database and a broker." },
    { front: "Lamport timestamp", track: "dist", back: "A per-process counter incremented on each event and set to max(local, received) + 1 on receive. If a happens before b then L(a) < L(b), but not the converse, so it cannot detect concurrency." },
    { front: "Vector clock", track: "dist", back: "One counter per process, merged element-wise on receive. Comparing two vectors tells whether one event happened before the other or whether they are concurrent." },
    { front: "Hybrid logical clock", track: "dist", back: "A (physical time, counter) pair that never goes backwards, respects causality and stays close to wall time. Systems still assume a maximum clock offset to reason about real-time order." },
    { front: "CRDT", track: "dist", back: "A replicated data type whose merge is commutative, associative and idempotent, so replicas converge in any delivery order without coordination. Cannot enforce invariants such as uniqueness." },
    // pg
    { front: "Dead tuple", track: "pg", back: "A row version whose xmax transaction has committed and that no running snapshot can still see. It occupies heap space until VACUUM or page pruning removes it." },
    { front: "Visibility map", track: "pg", back: "Two bits per heap page, all-visible and all-frozen. They let VACUUM skip clean pages and let index-only scans avoid fetching the heap." },
    { front: "Transaction ID wraparound", track: "pg", back: "Postgres XIDs are 32-bit and compared in a circle, so unfrozen tuples older than about 2 billion transactions would appear to be in the future. Freezing prevents this, and Postgres stops assigning XIDs rather than let it happen." },
    { front: "HOT update", track: "pg", back: "A heap-only tuple update: no indexed column changes and the new version fits on the same page, so no new index entries are written and the old version can be pruned in place." },
    { front: "fillfactor", track: "pg", back: "The percentage of each page filled on insert (table default 100, B-tree default 90). Lowering it on update-heavy tables leaves room for HOT updates." },
    { front: "Autovacuum trigger formula", track: "pg", back: "A table is vacuumed when dead tuples exceed autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor × reltuples (defaults 50 + 0.2). Analyze uses 50 + 0.1 on rows changed since the last analyze." },
    { front: "xmin horizon", track: "pg", back: "The oldest transaction ID any snapshot, slot or standby still needs. VACUUM cannot remove versions newer than it, so one long or idle-in-transaction session can pin cleanup cluster-wide." },
    { front: "pg_repack (online rebuild)", track: "pg", back: "An extension that rebuilds a bloated table or index online by copying it while a trigger captures changes, then swapping with only a brief exclusive lock. It needs spare disk about the size of the table." },
    { front: "PgBouncer transaction mode", track: "pg", back: "A pooling mode where a server connection is assigned only for one transaction and returned at COMMIT or ROLLBACK. Session state such as SET, session advisory locks, LISTEN and temp tables does not carry across transactions." },
    { front: "Partition pruning", track: "pg", back: "The planner or executor skipping partitions whose bounds cannot match the query's predicate on the partition key. Wrapping the key in a function usually defeats it." },
    { front: "Lock queue pile-up", track: "pg", back: "A DDL statement waiting for ACCESS EXCLUSIVE behind a long query makes every later conflicting request, even a plain SELECT, wait behind it. Setting lock_timeout on migrations and retrying avoids the outage." },
    { front: "Replication slot", track: "pg", back: "A primary-side record that retains WAL, and for logical slots catalog rows, until its consumer confirms receipt. An abandoned slot fills the disk unless max_slot_wal_keep_size caps it." },
    // col
    { front: "Column store", track: "col", back: "A storage layout that writes all values of one column contiguously, so analytic scans read only the columns a query names and similar values compress well." },
    { front: "Dictionary encoding", track: "col", back: "Stores each distinct value once and replaces the column with small integer codes; ideal for low-cardinality columns and lets filters compare codes instead of strings." },
    { front: "Run-length encoding (RLE)", track: "col", back: "Stores (value, run length) pairs instead of repeated values; very effective on sorted or low-cardinality columns, counterproductive when values change every row." },
    { front: "Delta + bit-packing", track: "col", back: "Stores differences between neighbouring values, then packs them into the minimum number of bits; turns sorted ids and timestamps from 64 bits into a few bits each." },
    { front: "Vectorized execution", track: "col", back: "Operators process batches of roughly 1-2K values per call, amortizing interpretation overhead and enabling tight, cache-resident, SIMD-friendly loops." },
    { front: "Late materialization", track: "col", back: "Evaluating predicates column by column on positions and fetching the remaining columns only for surviving rows, so wide columns of filtered-out rows are never decoded." },
    { front: "Zone map", track: "col", back: "Per-chunk metadata such as min and max of each column, checked by the planner to skip chunks that cannot satisfy a predicate; only useful when data is clustered on that column." },
    { front: "Snowflake micro-partition", track: "col", back: "An immutable, compressed columnar unit holding on the order of 50-500 MB of uncompressed rows, with per-column range metadata used for pruning and time travel." },
    { front: "Broadcast vs shuffle join", track: "col", back: "Broadcast copies the small side to every node and leaves the big side in place; shuffle hash-partitions both sides on the join key, moving far more data across the network." },
    { front: "Separated storage and compute", track: "col", back: "Data lives in shared object storage while independent compute clusters read it, so compute can scale, suspend or be isolated per workload without redistributing data." },
    { front: "Parquet footer", track: "col", back: "Metadata at the end of a Parquet file holding the schema, row group and column chunk offsets, encodings and min/max/null statistics that readers fetch first to prune." },
    { front: "Copy-on-write vs merge-on-read", track: "col", back: "Copy-on-write rewrites affected files at write time for clean reads; merge-on-read writes small delete or delta files quickly and reconciles them at read time until compaction." },
    { front: "Optimistic table-format commit", track: "col", back: "A writer swaps the table's metadata pointer only if it still points at the snapshot it read; if not, it validates against the winner's changes and retries. Appends never conflict; overlapping rewrites do." },
    { front: "Hidden partitioning (Iceberg)", track: "col", back: "Partitions declared as transforms of real columns, such as days(event_ts), so queries filtering the source column prune automatically and the spec can evolve without rewriting old files." },
    { front: "Snapshot expiry and VACUUM", track: "col", back: "Deleting old snapshots and the files only they reference. Reclaims storage and ends time travel past the cut-off; retention must exceed the longest-running reader." },
    { front: "Delta-of-delta encoding", track: "col", back: "Storing the change in the difference between consecutive timestamps; regular intervals become runs of zeros that need a bit or two each. Paired with XOR float encoding in time-series stores." },
    { front: "Series cardinality", track: "col", back: "The number of distinct metric-plus-tag combinations in a time-series store. Unbounded tag values such as user ids explode it and exhaust memory and index space." },
    // sql
    { front: "Window function", track: "sql", back: "A function evaluated over a set of rows related to the current row, declared with OVER (...). Unlike GROUP BY it keeps every input row and adds the computed value to each." },
    { front: "RANK vs DENSE_RANK", track: "sql", back: "Both give tied rows the same number. RANK then skips positions (1, 2, 2, 4) while DENSE_RANK does not (1, 2, 2, 3), so DENSE_RANK counts distinct values." },
    { front: "Default window frame", track: "sql", back: "With ORDER BY and no frame clause, the frame is RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW, which includes every peer tied with the current row. Without ORDER BY it is the whole partition." },
    { front: "ROWS vs RANGE frame", track: "sql", back: "ROWS counts physical rows, so each tied row adds only itself to a running total. RANGE works on ORDER BY values, so all peers enter the frame together." },
    { front: "LAST_VALUE gotcha", track: "sql", back: "With the default frame ending at the current row, LAST_VALUE returns the current row's value. Extend the frame to UNBOUNDED FOLLOWING or reverse the sort and use FIRST_VALUE." },
    { front: "Gaps and islands", track: "sql", back: "Finding maximal runs of consecutive values. Classic trick: value minus ROW_NUMBER() is constant within a run, so it becomes the GROUP BY key (deduplicate first)." },
    { front: "Recursive CTE", track: "sql", back: "An anchor query UNION ALL a step that references the CTE itself; the engine repeats the step on the previous step's rows until it returns nothing. Guard cycles with a visited path and a depth cap." },
    { front: "UNION vs UNION ALL", track: "sql", back: "UNION removes duplicate rows, which costs a sort or hash and can merge legitimately identical rows. UNION ALL simply concatenates and should be the default." },
    { front: "NOT IN with NULL", track: "sql", back: "If the subquery or list contains a NULL, x NOT IN (...) can never be TRUE, so the query returns zero rows. NOT EXISTS has no such trap." },
    { front: "COUNT(*) vs COUNT(col)", track: "sql", back: "COUNT(*) counts rows; COUNT(col) counts non-NULL values of col. Likewise AVG and SUM ignore NULLs, and SUM of only NULLs returns NULL." },
    { front: "Sargable predicate", track: "sql", back: "A filter the engine can answer with an index seek because the indexed column stays bare, such as a half-open range. Functions, arithmetic or casts on the column usually force a scan." },
    { front: "Semi-join and anti-join", track: "sql", back: "A semi-join returns left rows with at least one match, each once (EXISTS or IN). An anti-join returns left rows with no match (NOT EXISTS or LEFT JOIN ... IS NULL)." }
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
        el("p", { class: "fc-sub" }, "Flip through key DevSecOps, pipeline and Wiz terms and self-grade each one. Your progress saves locally in this browser.")
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
