/* =====================================================================
   BLUEPRINT · Exam mode + Flashcards
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
  // Quiz ids in Pulse use these prefixes: fund-, kafka-, kops-, sem-, flink-, eo-, cdc-, engines-, ops-, cases-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["fund", "kafka", "kops", "sem", "flink", "eo", "cdc", "engines", "ops", "cases"];
  var TRACK_NAMES = {
    fund: "Streaming Fundamentals",
    kafka: "Kafka Internals",
    kops: "Kafka Operations",
    sem: "Time, Windows & State",
    flink: "Apache Flink",
    eo: "Exactly-Once & Transactions",
    cdc: "CDC & Integration",
    engines: "Engine Comparison",
    ops: "Observability, Capacity & Security",
    cases: "Production Case Studies",
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
  var EXAM_KEY = "pl_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "pl_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
     Tracks match Pulse's window.TRACKS ids: fund, kafka, kops, sem, flink, eo, cdc, engines, ops, cases.
     ===================================================================== */
  var CARDS = [
    { front: "Event", track: "fund", back: "An immutable fact that something happened, in the past tense. Corrections are new events, never edits, which is what makes replay and reprocessing safe." },
    { front: "Log", track: "fund", back: "An append-only, ordered, retained sequence of records identified by offset. Many independent readers can consume and replay it at their own pace." },
    { front: "Event time vs processing time", track: "fund", back: "Event time is when the fact happened at the source; processing time is the operator's wall clock. Business answers computed on processing time change on replay and misplace late data." },
    { front: "Skew (time)", track: "fund", back: "The gap between event time and processing time. It varies with network, offline devices and consumer lag; its high percentiles size your watermark delay." },
    { front: "Stream-table duality", track: "fund", back: "Replaying a changelog yields a table of latest values per key; capturing a table's changes yields a stream. Compacted topics, CDC and state stores rely on it." },
    { front: "Stateful operator", track: "fund", back: "An operator that must remember earlier records: windows, joins, dedup, counts. Its state must be partitioned by key, persisted for recovery and bounded in size." },
    { front: "At-least-once", track: "fund", back: "Perform the side effect, then commit progress. A crash in between repeats the record, so nothing is lost but duplicates are possible." },
    { front: "At-most-once", track: "fund", back: "Commit progress, then perform the side effect. A crash in between skips the record, so nothing is duplicated but data may be lost." },
    { front: "Effectively-once", track: "fund", back: "At-least-once delivery combined with idempotent or transactional effects, so the observable output is as if each record were processed once." },
    { front: "Backpressure", track: "fund", back: "Propagating a slow stage's pace upstream so buffers stay bounded. With a durable log as the source, overload becomes visible, recoverable lag instead of memory growth." },
    { front: "Partition", track: "kafka", back: "One ordered, replicated log inside a topic. The unit of ordering, parallelism, leadership and consumer assignment." },
    { front: "Offset", track: "kafka", back: "A record's position in a partition. Consumers track progress per partition as a single number, committed to __consumer_offsets." },
    { front: "Segment", track: "kafka", back: "A file holding a contiguous range of a partition's records, with sparse offset and time indexes. Retention and compaction work per closed segment." },
    { front: "Retention", track: "kafka", back: "How long or how much data a topic keeps before deleting whole closed segments. It is your replay budget; it multiplies by partitions and replicas on disk." },
    { front: "Tiered storage", track: "kafka", back: "Keeping recent segments on broker disk and older closed segments in object storage, so long retention is cheap and brokers carry less data to move." },
    { front: "Log compaction", track: "kafka", back: "Keeping at least the latest record per key and removing superseded values in the background. Turns a topic into a rebuildable table; it is not deduplication." },
    { front: "Tombstone", track: "kafka", back: "A record with a key and a null value on a compacted topic. It marks the key deleted and is itself removed after delete.retention.ms." },
    { front: "ISR", track: "kafka", back: "In-sync replicas: the leader plus followers that have caught up recently. Leaders are elected from it, and acks=all waits for all of its members." },
    { front: "High watermark", track: "kafka", back: "The highest offset replicated to every ISR member. Records below it are committed and visible to consumers; records above it may be truncated on failover." },
    { front: "min.insync.replicas", track: "kafka", back: "With acks=all, the minimum ISR size for a write to succeed. RF 3 with min ISR 2 survives one broker loss without losing acked data or refusing writes." },
    { front: "Unclean leader election", track: "kafka", back: "Promoting an out-of-sync replica to restore availability, at the cost of discarding acknowledged writes. Disabled by default for good reason." },
    { front: "KRaft", track: "kafka", back: "Kafka's Raft-based metadata quorum that replaced ZooKeeper. Controllers replicate a metadata log, giving faster failover and support for more partitions." },
    { front: "linger.ms", track: "kafka", back: "How long a producer waits to fill a batch before sending. A few milliseconds usually buys large throughput and compression gains for little latency." },
    { front: "acks", track: "kafka", back: "How many replicas must have a write before the producer gets success: 0 (none), 1 (leader), or all (every in-sync replica)." },
    { front: "Idempotent producer", track: "kafka", back: "Producer id plus per-partition sequence numbers let brokers drop retried duplicates and keep order with up to five in-flight requests. On by default in modern clients." },
    { front: "Consumer group", track: "kafka", back: "Consumers sharing a group.id that divide a topic's partitions so each is read by exactly one member. Parallelism is capped by the partition count." },
    { front: "Cooperative rebalancing", track: "kafka", back: "Incremental rebalance where only partitions that change owner are revoked, so most consumers keep processing instead of the whole group pausing." },
    { front: "Static membership", track: "kafka", back: "A fixed group.instance.id lets a restarting consumer reclaim its partitions within the session timeout without triggering a rebalance." },
    { front: "max.poll.interval.ms", track: "kafka", back: "Maximum time between poll calls before a consumer is considered stuck and removed from the group. Exceeding it with slow batches causes rebalance storms." },
    { front: "auto.offset.reset", track: "kafka", back: "What a group does when it has no valid committed offset: earliest, latest, or fail. With latest, expired commits silently skip data." },
    { front: "Partition sizing", track: "kops", back: "Partitions = max(throughput / per-partition produce rate, throughput / per-consumer rate), plus headroom for growth and catch-up. Measure both rates." },
    { front: "Replication multiplier", track: "kops", back: "Cluster egress is about ingress \u00d7 (RF \u2212 1 + consumer groups). Network, not disk, is often the first broker limit." },
    { front: "Reassignment throttle", track: "kops", back: "A cap on replication traffic while partitions move between brokers, so the bulk copy does not starve live traffic. Remove it when the move finishes." },
    { front: "Preferred leader election", track: "kops", back: "Returning leadership to each partition's first-listed replica after failovers, so leader load is spread evenly again." },
    { front: "Rolling upgrade gate", track: "kops", back: "Restart one broker at a time and wait for under-replicated partitions to return to zero before the next. Bump feature versions only after all brokers run the new binary." },
    { front: "Schema registry", track: "kops", back: "A service storing versioned schemas per subject and rejecting changes that violate the subject's compatibility mode. Producers embed a schema id in each record." },
    { front: "BACKWARD compatibility", track: "kops", back: "New readers can read data written with the previous schema. Allows adding fields with defaults and removing optional ones; upgrade consumers first." },
    { front: "FULL_TRANSITIVE", track: "kops", back: "Every schema version is both backward and forward compatible with all earlier versions, not just the latest. Safest for topics replayed from long history." },
    { front: "Topic as code", track: "kops", back: "Declaring each topic's partitions, RF, retention, cleanup policy, owner and schema subject in version control, with auto-create disabled in production." },
    { front: "Mirror lag (RPO)", track: "kops", back: "How far an asynchronously replicated DR cluster trails the primary. It is the data you may lose on failover; offsets must be translated when consumers switch." },
    { front: "Watermark", track: "sem", back: "A claim flowing with the stream that no more events earlier than time t are expected. Windows ending before it may fire; later arrivals are late." },
    { front: "Bounded out-of-orderness", track: "sem", back: "Watermark = max event time seen \u2212 a fixed delay. Larger delays give more complete results at higher latency and more open state." },
    { front: "Idle source", track: "sem", back: "An input with no data that would pin the minimum watermark for ever. Idleness timeouts exclude it so other inputs can advance time." },
    { front: "Tumbling window", track: "sem", back: "Fixed-size, non-overlapping windows. Cheapest state; each event belongs to exactly one window." },
    { front: "Sliding window", track: "sem", back: "Fixed-size windows advancing by a smaller step, so events belong to several windows. State and output multiply by size / step." },
    { front: "Session window", track: "sem", back: "Per-key windows closed after a gap of inactivity. Late events can merge sessions, so results must be revisable." },
    { front: "Allowed lateness", track: "sem", back: "Keeping window state after it fires so late events re-emit corrected results until a horizon passes. Requires an upsert-capable sink." },
    { front: "Side output (late data)", track: "sem", back: "A secondary stream receiving events too late for their window, for reconciliation or batch correction instead of silent dropping." },
    { front: "Interval join", track: "sem", back: "A stream-stream join constrained by a time range on both sides, so the engine only buffers records within that range." },
    { front: "Temporal join", track: "sem", back: "Joining each event to the version of a table valid at the event's time, such as the exchange rate when an order was placed. Reproducible on replay." },
    { front: "State TTL", track: "sem", back: "Expiring keyed state not accessed or updated for a period. Bounds dedup sets, regular joins and unwindowed aggregates at the cost of forgetting idle keys." },
    { front: "Task slot", track: "flink", back: "A slice of a TaskManager's resources running one parallel instance of a chained pipeline. With slot sharing, slots needed equal the maximum operator parallelism." },
    { front: "Operator chaining", track: "flink", back: "Fusing one-to-one operators with equal parallelism into one task, passing records by method call. keyBy or a parallelism change breaks the chain." },
    { front: "KeyedProcessFunction", track: "flink", back: "Flink's low-level per-key operator with keyed state and event- or processing-time timers. The escape hatch for logic windows cannot express." },
    { front: "RocksDB state backend", track: "flink", back: "Keeps keyed state serialized on local disk with memory caching. Supports state far beyond heap size and incremental checkpoints, at higher per-access cost." },
    { front: "Checkpoint barrier", track: "flink", back: "A marker injected at sources that flows with records. Operators snapshot state when barriers from all inputs arrive, producing one consistent cut of the job." },
    { front: "Unaligned checkpoint", track: "flink", back: "Lets barriers overtake buffered records and stores the in-flight data in the snapshot, so checkpoints complete under backpressure at the cost of size." },
    { front: "Savepoint", track: "flink", back: "A user-triggered, portable snapshot used for upgrades, rescaling and migrations. State is mapped to operators by uid, so set uids explicitly." },
    { front: "Key groups", track: "flink", back: "The fixed number of hash buckets (max parallelism) that keyed state is divided into. Rescaling moves whole groups; parallelism cannot exceed their count." },
    { front: "Credit-based flow control", track: "flink", back: "Receivers grant credits for free buffers and senders only send what they have credit for, so slowness propagates upstream and buffers stay bounded." },
    { front: "Dynamic table", track: "flink", back: "Flink SQL's view of a stream as a continuously changing table. Continuous queries over it emit changelogs of inserts, updates and deletes." },
    { front: "Retraction (-U/+U)", track: "flink", back: "A changelog pair withdrawing a previous result row and emitting its replacement. Produced by unwindowed aggregates and regular joins; sinks must apply it." },
    { front: "Transactional producer", track: "eo", back: "A producer with a transactional.id that writes to many partitions and commits consumer offsets atomically. initTransactions fences older instances by epoch." },
    { front: "sendOffsetsToTransaction", track: "eo", back: "Adds the consumer group's input offsets to the producer's transaction, making output and progress commit together in consume-transform-produce loops." },
    { front: "Zombie fencing", track: "eo", back: "Bumping the producer epoch for a transactional.id so an old instance that is still running is rejected on its next write." },
    { front: "read_committed", track: "eo", back: "Consumer isolation that returns only committed transactional records, up to the last stable offset. Required end to end for exactly-once pipelines." },
    { front: "Last stable offset (LSO)", track: "eo", back: "The offset before the earliest open transaction in a partition. read_committed consumers cannot pass it, so long transactions stall them." },
    { front: "Two-phase commit sink", track: "eo", back: "Pre-commit an external transaction on the checkpoint barrier, commit when the checkpoint completes. Output becomes visible once per checkpoint." },
    { front: "Transaction timeout rule", track: "eo", back: "The sink's transaction timeout must exceed checkpoint interval plus recovery time, or the broker aborts pre-committed data before Flink can commit it." },
    { front: "Idempotent sink", track: "eo", back: "A target where writing a result twice equals writing it once \u2014 an upsert by deterministic key. Gives exactly-once effect with immediate visibility." },
    { front: "Side effect in an operator", track: "eo", back: "An external call made from inside processing logic is repeated on every replay, breaking exactly-once. Move it to the sink or give it an idempotency key." },
    { front: "Log-based CDC", track: "cdc", back: "Reading a database's transaction log (WAL, binlog, redo) to stream every committed insert, update and delete in order, with low load and no table changes." },
    { front: "Change event", track: "cdc", back: "A CDC record with an operation (create, update, delete, snapshot read), before and after images, source position (LSN or binlog offset) and a key of the row's primary key." },
    { front: "Incremental snapshot", track: "cdc", back: "Reading existing rows in key-ordered chunks interleaved with live log events, so streaming continues and snapshots can resume or re-run per table." },
    { front: "Replication slot", track: "cdc", back: "PostgreSQL's record of a logical reader's position. It retains WAL until consumed, so an abandoned slot can fill the primary's disk." },
    { front: "Transactional outbox", track: "cdc", back: "Writing the business change and an outbox event row in one local transaction and publishing the row via CDC, removing the dual-write problem." },
    { front: "Kafka Connect task", track: "cdc", back: "The parallel unit that a connector splits its work into, run and rebalanced by Connect workers. Parallelism is capped by how the source can be split." },
    { front: "Dead-letter topic", track: "cdc", back: "Where records that fail conversion or processing are routed with error context, so the pipeline continues. Alert on its rate." },
    { front: "LSN-guarded MERGE", track: "cdc", back: "Applying CDC to a table by key only when the incoming log position is newer than the stored one, so replays and out-of-order batches never move rows backwards." },
    { front: "Micro-batch", track: "engines", back: "Running a small batch job per trigger interval over newly arrived records. Amortises overhead and simplifies recovery; latency floor is about the interval." },
    { front: "Record-at-a-time", track: "engines", back: "Long-running operators processing each record on arrival with periodic snapshots. Lowest latency and natural per-record timers." },
    { front: "Kafka Streams", track: "engines", back: "A Java library for Kafka-to-Kafka processing embedded in your service. Scales by running instances; state in local stores backed by changelog topics." },
    { front: "Standby replica (Kafka Streams)", track: "engines", back: "A warm copy of a state store kept on another instance so failover does not have to replay the whole changelog." },
    { front: "Engine choice order", track: "engines", back: "Latency budget, state and timers, sources and sinks, correctness needs, team and platform \u2014 then the lightest option that satisfies all of them." },
    { front: "Lag in seconds", track: "ops", back: "The age of the oldest unprocessed record, taken at the slowest partition. Maps directly to data freshness, unlike message counts." },
    { front: "Freshness probe", track: "ops", back: "A synthetic marker record injected at the source and detected at the final sink, measuring true end-to-end delay through every stage." },
    { front: "Offline partitions", track: "ops", back: "Partitions with no leader: producers and consumers for them are down. Page on any value above zero." },
    { front: "Checkpoint age", track: "ops", back: "Time since the last completed checkpoint. Many intervals means failing checkpoints and a long, risky replay on the next restart." },
    { front: "Catch-up capacity", track: "ops", back: "Headroom to drain a backlog while new input continues; drain time = backlog / (capacity \u2212 input rate). Capped by partition count." },
    { front: "Little's law", track: "ops", back: "Items in flight = arrival rate \u00d7 time in system (L = \u03bbW). Use it to sanity-check buffers, in-flight records and consumer counts." },
    { front: "Failure drill", track: "ops", back: "Inject one fault with a hypothesis and abort criteria, observe recovery, then reconcile output against input. Without reconciliation it only proves a restart." },
    { front: "Client quotas", track: "ops", back: "Per-user or per-client caps on bytes per second and broker request time, so one tenant's workload cannot starve others on a shared cluster." },
    { front: "Runtime-injected secrets", track: "ops", back: "Credentials read from a secret manager or mounted file at deploy time and referenced by config providers \u2014 never hardcoded in code, connector JSON or DDL." },
    { front: "Rebalance storm", track: "cases", back: "Consumers repeatedly evicted for exceeding the poll interval and rejoining, each eviction pausing the group. Healthy pods, zero progress, growing lag." },
    { front: "Training-serving skew", track: "cases", back: "Features computed differently online and offline, so a model sees different inputs in production than it learned from. Fix with shared, point-in-time definitions." },
    { front: "Late-upload path", track: "cases", back: "Routing very late data (hours old) to a separate topic and batch reconciliation, so it neither holds back live watermarks nor gets dropped." }
  ];
  function requireDeck() {
    if (!CARDS.length) {
      throw new Error("Pulse: the flashcard deck in js/exam.js is still the scaffold stub " +
        "— inline the authored cards into CARDS before shipping #/flashcards");
    }
  }

  function mountFlashcards(mountEl) {
    if (!mountEl) return;
    requireDeck();
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
        el("p", { class: "fc-sub" }, "Flip through key streaming terms and self-grade each one. Your progress saves locally in this browser.")
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
