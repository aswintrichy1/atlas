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
  // Quiz ids in Blueprint use these prefixes: hld-, lld-, dsa-, pat-.
  // The "pat" prefix maps to the window.TRACKS id "patterns".
  var PREFIX_ALIAS = { pat: "patterns" };
  var TRACK_NAMES = {
    hld: "High-Level Design",
    lld: "Low-Level Design",
    dsa: "Data Structures & Algorithms",
    pat: "DSA Interview Patterns",
    patterns: "DSA Interview Patterns"
  };
  function trackOf(quizId) { return String(quizId).split("-")[0]; }
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
  var EXAM_KEY = "bp_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "bp_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
      var host = window.Academy || window.Blueprint || window.Citadel;
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
     Tracks match Blueprint's window.TRACKS ids: hld, lld, dsa, patterns.
     ===================================================================== */
  var CARDS = [
    /* ---- HLD · High-Level Design ---- */
    { front: "Horizontal vs vertical scaling", track: "hld", back: "Vertical scaling adds more power (CPU, RAM) to one machine; horizontal scaling adds more machines behind a balancer. Horizontal scales further and survives node loss, but forces you to handle distributed state." },
    { front: "Load balancer", track: "hld", back: "A component that spreads incoming requests across many servers using a policy such as round-robin or least-connections, improving throughput and removing any single server as a point of failure." },
    { front: "CAP theorem", track: "hld", back: "In the presence of a network partition, a distributed store can guarantee either consistency or availability, not both. Outside a partition you can still have both; the trade-off only bites when nodes can't talk." },
    { front: "Consistent hashing", track: "hld", back: "A hashing scheme that maps keys and nodes onto a ring so that adding or removing a node only remaps a small slice of keys, instead of reshuffling almost everything as plain modulo hashing would." },
    { front: "Sharding", track: "hld", back: "Splitting one dataset across multiple databases by a shard key so each holds a subset. It scales writes and storage horizontally but complicates cross-shard queries and rebalancing." },
    { front: "Replication", track: "hld", back: "Keeping copies of data on multiple nodes for durability and read scaling. Synchronous replication favors consistency; asynchronous favors latency and availability at the risk of stale reads." },
    { front: "Cache-aside", track: "hld", back: "A caching pattern where the app checks the cache first, and on a miss reads the database then populates the cache. The cache holds only requested data, but stale entries need a TTL or explicit invalidation." },
    { front: "CDN", track: "hld", back: "A Content Delivery Network caches static assets on edge servers near users, cutting latency and offloading the origin. It shines for cacheable content but adds invalidation complexity." },
    { front: "Eventual consistency", track: "hld", back: "A model where replicas may temporarily disagree but converge to the same value once updates stop. It trades immediate consistency for higher availability and lower latency." },
    { front: "Idempotency", track: "hld", back: "A property where performing the same operation many times has the same effect as doing it once. It lets clients safely retry requests after timeouts without causing duplicate side effects." },
    { front: "Rate limiting", track: "hld", back: "Capping how many requests a client may make in a window (often via token-bucket or leaky-bucket) to protect a service from overload and abuse while keeping it fair." },
    { front: "Message queue", track: "hld", back: "A buffer that decouples producers from consumers: work is enqueued and processed asynchronously. It smooths traffic spikes, enables retries, and lets components scale independently." },
    { front: "Publish / subscribe", track: "hld", back: "A messaging model where publishers emit events to topics and any number of subscribers receive them, decoupling senders from receivers and enabling fan-out to many consumers." },
    { front: "Database index", track: "hld", back: "An auxiliary structure (often a B-tree) that lets the database find rows by a column without scanning the whole table. It speeds reads but adds write overhead and storage cost." },
    { front: "SQL vs NoSQL", track: "hld", back: "SQL stores favor structured schemas, joins, and strong transactions; NoSQL stores trade some of that for flexible schemas and horizontal scale. The right pick depends on access patterns, not hype." },
    { front: "Read replica", track: "hld", back: "A read-only copy of a primary database that serves queries to scale reads and isolate analytics. Because replication lags, replicas can return slightly stale data." },
    { front: "Write-ahead log", track: "hld", back: "A durability technique where changes are appended to an append-only log before being applied. After a crash the log is replayed to recover committed state without data loss." },
    { front: "Latency vs throughput", track: "hld", back: "Latency is how long one request takes; throughput is how many requests complete per unit time. Batching and parallelism can raise throughput while sometimes increasing individual latency." },
    { front: "Availability (the nines)", track: "hld", back: "The fraction of time a system is operational, quoted as nines: 99.9% allows about 8.7 hours of downtime per year, 99.99% only about 52 minutes. Each extra nine is sharply harder to reach." },
    { front: "Bloom filter", track: "hld", back: "A compact probabilistic structure that answers set membership with possible false positives but never false negatives, often used to skip expensive lookups for keys that are definitely absent." },
    { front: "Cell", track: "hld", back: "An isolated serving slice containing app tier, queues, caches and datastores for a bounded tenant or resource cohort, used to limit blast radius from deploys, overload and dependency failures." },
    { front: "Bulkhead", track: "hld", back: "A resource isolation pattern: separate thread pools, queues, connection pools or capacity budgets so one overloaded feature or tenant cannot consume resources needed by the rest of the system." },
    { front: "Shuffle sharding", track: "hld", back: "Assigning each tenant to a small deterministic subset of resources so noisy neighbors overlap only partially, reducing the percentage of tenants affected by one bad tenant or worker group." },
    { front: "Graceful degradation", track: "hld", back: "Serving a simpler but useful experience during overload or dependency failure, such as cached data, disabled recommendations or reduced model quality, instead of failing the whole request." },
    { front: "RAG reranking", track: "hld", back: "A second ranking pass over retrieved chunks, often with a stronger relevance model, to put the best evidence into the prompt after broad vector or keyword retrieval." },
    { front: "Golden eval set", track: "hld", back: "A curated set of representative inputs, expected evidence and quality rubrics used to catch regressions when prompts, retrieval, models or guardrails change." },
    { front: "Capacity chain", track: "hld", back: "The planning flow from users to daily actions, average QPS, peak QPS, app instances, database capacity, queue drain rate and cache working set. Each layer needs its own bottleneck estimate." },
    { front: "N+1 capacity", track: "hld", back: "Enough headroom for the system to handle expected peak even after one capacity unit is unavailable. N+2 adds another failure or deploy buffer when the blast radius justifies it." },
    { front: "Cost per answer", track: "hld", back: "The unit cost of an LLM-backed response, including prompt tokens, completion tokens, embeddings, reranking, retries and provider overhead. Track it like latency because prompt changes can double spend." },
    { front: "Launch readiness", track: "hld", back: "A release gate covering load tests, canary metrics, rollback, dashboards, alerts, runbooks and error-budget status before real traffic arrives." },
    { front: "ADR", track: "hld", back: "An Architecture Decision Record captures context, decision, alternatives and consequences so future engineers understand why a trade-off was accepted." },
    { front: "RAG ingestion path", track: "hld", back: "The offline or async pipeline that parses documents, chunks them, embeds chunks, indexes vectors and checks freshness before queries rely on them." },
    { front: "RAG online path", track: "hld", back: "The request-time path: rewrite the query, retrieve candidates, apply metadata and ACL filters, rerank, build the prompt, call the model, run safety checks and return an answer with trace evidence." },
    { front: "Hybrid retrieval", track: "hld", back: "Combining vector similarity with lexical search so semantic matches and exact identifiers both have a chance to appear before reranking." },
    { front: "Prompt injection in RAG", track: "hld", back: "Retrieved documents can contain malicious instructions. Treat them as untrusted data: do not let them override system policy, access controls or tool permissions." },
    { front: "Semantic cache", track: "hld", back: "A cache for repeated or near-duplicate model requests. Safe keys include tenant, permissions, freshness, prompt version and model version so one user's context never leaks to another." },
    { front: "Expand-contract migration", track: "hld", back: "A zero-downtime schema pattern: add the new shape first, run old and new code paths together, backfill and verify, cut over, then remove the old shape only after rollback is no longer needed." },
    { front: "Checkpointed backfill", track: "hld", back: "A background migration that processes small idempotent batches and persists progress after each batch, so it can pause, crash, throttle and resume without corrupting data." },
    { front: "Shadow read", track: "hld", back: "Read the new path in parallel and compare it with the old path, while still returning the old result to users. It validates real traffic before cutover." },
    { front: "CDC validation", track: "hld", back: "Tailing the source change stream and confirming every committed mutation reaches the target, usually per key and in order, to catch live drift during migration." },
    { front: "Tenant / cell migration", track: "hld", back: "Moving one tenant cohort between isolated serving cells by copy, replay, verify and atomic routing cutover, while keeping the source readable for rollback." },
    { front: "Offline-first source of truth", track: "hld", back: "A mobile pattern where the UI reads and writes a local database first; the server is updated later through sync, so the app remains useful without network access." },
    { front: "Operation log / sync queue", track: "hld", back: "A durable append-only list of local mutations with stable operation ids. It lets the client retry safely and lets the server dedupe duplicate sends." },
    { front: "Tombstone", track: "hld", back: "A retained delete marker that tells other devices a record was removed, preventing stale offline copies from resurrecting it during later sync." },
    { front: "Hybrid logical clock", track: "hld", back: "A versioning technique that blends physical time with a logical counter to provide a useful ordering across devices without trusting wall clocks alone." },
    { front: "CRDT-style merge", track: "hld", back: "A data-type-specific merge rule that can converge automatically for suitable shapes such as counters, sets or collaborative text. It is powerful, but it does not replace product conflict policy." },
    { front: "Transactional outbox", track: "hld", back: "Commit the business row and an outbox event in the same database transaction; a relay publishes the event later so commit and publish cannot drift apart." },
    { front: "Inbox / consumer dedupe", track: "hld", back: "A durable record of processed event ids or business keys that lets a consumer skip duplicate deliveries before applying side effects." },
    { front: "CDC", track: "hld", back: "Change Data Capture reads database commit logs and emits changes as a stream, useful for search indexing, analytics, replication and event pipelines without fragile dual writes." },
    { front: "OLTP vs OLAP", track: "hld", back: "OLTP serves short transactional reads and writes for live applications; OLAP scans and aggregates large datasets for analytics. They have different storage layouts and latency goals." },
    { front: "LSM tree", track: "hld", back: "An append-optimized storage engine that buffers writes and flushes sorted files, then compacts them later. It offers high write throughput with compaction cost." },
    { front: "Hot partition", track: "hld", back: "A shard, key range, tenant or partition receiving disproportionate traffic. Fix with better keys, salting, splitting, quotas or isolated capacity." },
    { front: "Pooled / bridge / silo tenancy", track: "hld", back: "Three SaaS isolation models: pooled shares most resources, bridge separates selected data or dependencies, and silo gives a tenant dedicated capacity." },
    { front: "Tenant-aware deploy waves", track: "hld", back: "Rolling changes through tenant cohorts while watching tenant-level metrics, so a bad release stops before it reaches every customer." },
    { front: "Cursor pagination", track: "hld", back: "A pagination style where the next page is anchored to a stable sort position instead of an offset, avoiding skips and duplicates as lists change." },
    { front: "Webhook delivery", track: "hld", back: "An async callback contract that should include signed payloads, event ids, retry policy, delivery logs and idempotent receivers." },
    { front: "Security threat model", track: "hld", back: "A structured pass over assets, actors, trust boundaries, abuse cases and controls. In HLD it should cover authn, authz, tenant isolation, API abuse, secrets, TLS and data flows." },
    { front: "Resource-scoped authorization", track: "hld", back: "An authorization decision that binds user, tenant, action and specific resource, rather than trusting identity alone." },
    { front: "RAG prompt injection", track: "hld", back: "Malicious retrieved content can try to steer the model or tools. Mitigate with ACL filters, prompt boundaries, tool limits, citations, evals and monitoring." },
    { front: "Incident commander", track: "hld", back: "The person coordinating an incident: sets severity, assigns roles, keeps responders focused on mitigation, and ensures clear updates." },
    { front: "Runbook", track: "hld", back: "A tested guide for diagnosing and mitigating a known failure mode, including dashboards, commands, rollback steps, owners and escalation paths." },
    { front: "Candidate retrieval", track: "hld", back: "The first stage in search or recommendations that cheaply finds plausible items before a richer ranker orders them." },
    { front: "Ranking signals", track: "hld", back: "Features used to order candidates, such as lexical match, semantic score, freshness, popularity, user affinity, quality and availability." },

    /* ---- LLD · Low-Level Design (OOP + design patterns) ---- */
    { front: "SOLID", track: "lld", back: "Five object-oriented design principles \u2014 Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion \u2014 that together keep code modular, testable, and easy to change." },
    { front: "Single Responsibility Principle", track: "lld", back: "A class should have one reason to change, owning a single well-defined responsibility. Mixing concerns makes a class fragile because unrelated changes start to collide." },
    { front: "Open/Closed Principle", track: "lld", back: "Software entities should be open for extension but closed for modification: add new behavior by adding code (new subclasses or strategies) rather than editing tested existing code." },
    { front: "Liskov Substitution Principle", track: "lld", back: "Objects of a subtype must be usable anywhere the base type is expected without breaking correctness. A subclass that violates the base's contract signals a flawed hierarchy." },
    { front: "Interface Segregation Principle", track: "lld", back: "Prefer many small, focused interfaces over one fat interface, so clients depend only on the methods they actually use and aren't forced to implement irrelevant ones." },
    { front: "Dependency Inversion Principle", track: "lld", back: "High-level modules should depend on abstractions, not concrete low-level details. Injecting interfaces decouples policy from implementation and makes components swappable and testable." },
    { front: "Encapsulation", track: "lld", back: "Bundling data with the methods that operate on it and hiding internal state behind a public interface, so objects protect their invariants and expose only what callers need." },
    { front: "Composition over inheritance", track: "lld", back: "Building behavior by assembling objects (has-a) rather than deep class hierarchies (is-a). Composition is more flexible and avoids the rigidity and fragility of tall inheritance trees." },
    { front: "Coupling vs cohesion", track: "lld", back: "Coupling is how dependent modules are on each other; cohesion is how focused a module's responsibilities are. Good design aims for low coupling and high cohesion." },
    { front: "Polymorphism", track: "lld", back: "The ability to treat different types through a common interface, so the same call dispatches to type-specific behavior. It lets code work with new types without being rewritten." },
    { front: "Strategy pattern", track: "lld", back: "Defines a family of interchangeable algorithms behind a common interface and lets the caller pick one at runtime, replacing sprawling conditionals with pluggable behavior." },
    { front: "Observer pattern", track: "lld", back: "Lets a subject notify a list of dependent observers automatically when its state changes, decoupling the source of an event from the components that react to it." },
    { front: "Factory pattern", track: "lld", back: "Encapsulates object creation behind a method or class so callers request a product by intent without naming concrete classes, centralizing and isolating construction logic." },
    { front: "Singleton pattern", track: "lld", back: "Ensures a class has exactly one instance with a global access point. Useful for shared resources but easily overused, since it introduces hidden global state that complicates testing." },
    { front: "Decorator pattern", track: "lld", back: "Wraps an object to add responsibilities dynamically while preserving its interface, offering a flexible alternative to subclassing for extending behavior at runtime." },
    { front: "Adapter pattern", track: "lld", back: "Translates one interface into another that a client expects, letting otherwise incompatible classes work together without changing their source." },
    { front: "Idempotency key store", track: "lld", back: "A durable dedupe table keyed by tenant and request key that atomically stores request hash, workflow status, final response and expiry so retries return the original result without repeating side effects." },
    { front: "SyncOperation", track: "lld", back: "An immutable local command containing operation id, entity id, patch, base version and device id. The sync engine sends it until the server acknowledges or reports a conflict." },
    { front: "ConflictResolver strategy", track: "lld", back: "An interface that lets the sync engine swap conflict policies such as LWW, field merge, domain-specific merge or user resolution without changing queue-draining code." },
    { front: "MigrationStep", track: "lld", back: "A small migration object with run, verify, checkpoint and rollback behavior, making expand, backfill and cutover phases restartable and testable." },

    /* ---- DSA · Data Structures & Algorithms ---- */
    { front: "Big-O notation", track: "dsa", back: "An upper bound describing how an algorithm's running time or space grows with input size, ignoring constants and lower-order terms so different approaches can be compared at scale." },
    { front: "Time vs space complexity", track: "dsa", back: "Time complexity measures operations as input grows; space complexity measures extra memory used. Many problems trade one for the other, such as caching results to save recomputation." },
    { front: "Array", track: "dsa", back: "A contiguous block of elements offering O(1) access by index, but O(n) insertion or deletion in the middle because elements must shift. Cache-friendly and the basis of many structures." },
    { front: "Hash map", track: "dsa", back: "A structure mapping keys to values via a hash function, giving average O(1) insert, lookup, and delete. Collisions are handled by chaining or open addressing; worst case degrades to O(n)." },
    { front: "Linked list", track: "dsa", back: "A chain of nodes each pointing to the next, giving O(1) insertion or removal at a known position but O(n) access by index and poor cache locality compared with arrays." },
    { front: "Stack", track: "dsa", back: "A last-in, first-out collection supporting push and pop in O(1). It underpins function call frames, expression evaluation, undo features, and depth-first traversal." },
    { front: "Queue", track: "dsa", back: "A first-in, first-out collection where items are added at the back and removed from the front in O(1). It models fair processing and drives breadth-first traversal." },
    { front: "Binary search tree", track: "dsa", back: "An ordered tree where each node's left subtree holds smaller keys and the right holds larger, giving O(log n) search when balanced but O(n) if it degenerates into a list." },
    { front: "Heap / priority queue", track: "dsa", back: "A tree-shaped structure that keeps the minimum or maximum at the root, supporting O(log n) insertion and extraction. Ideal for scheduling, top-K problems, and Dijkstra's algorithm." },
    { front: "Graph", track: "dsa", back: "A set of vertices connected by edges, modeling networks, dependencies, and maps. It can be directed or undirected, weighted or not, and stored as an adjacency list or matrix." },
    { front: "Hash collision", track: "dsa", back: "When two distinct keys hash to the same bucket. Resolution strategies such as separate chaining or open addressing keep lookups correct, though heavy collisions hurt performance." },
    { front: "Recursion", track: "dsa", back: "A technique where a function solves a problem by calling itself on smaller inputs until a base case. It expresses divide-and-conquer cleanly but uses stack space proportional to its depth." },
    { front: "Amortized analysis", track: "dsa", back: "Averaging the cost of an operation over a sequence so occasional expensive steps are spread out, as with a dynamic array whose resize cost averages to O(1) per append." },
    { front: "Quicksort", track: "dsa", back: "A divide-and-conquer sort that partitions around a pivot and recurses on each side, averaging O(n log n) in place but degrading to O(n\u00b2) on bad pivots without good pivot choice." },
    { front: "Merge sort", track: "dsa", back: "A stable divide-and-conquer sort that splits the input, sorts halves, and merges them, guaranteeing O(n log n) time at the cost of O(n) extra space." },
    { front: "Stable sort", track: "dsa", back: "A sort that preserves the relative order of equal elements. Stability matters when sorting by multiple keys in succession, so earlier orderings survive later passes." },

    /* ---- patterns · DSA Interview Patterns ---- */
    { front: "Two pointers", track: "patterns", back: "Walking two indices through a sequence \u2014 often from both ends or at different speeds \u2014 to solve pair, partition, or in-place problems in O(n) time without extra space." },
    { front: "Sliding window", track: "patterns", back: "Maintaining a moving range over an array or string and updating an aggregate as the window grows and shrinks, turning many O(n\u00b2) substring or subarray problems into O(n)." },
    { front: "Fast & slow pointers", track: "patterns", back: "Advancing two pointers at different speeds through a linked list or sequence to detect cycles, find a midpoint, or locate a cycle's start, using O(1) extra space." },
    { front: "Binary search on the answer", track: "patterns", back: "When a feasibility check is monotonic, binary-search the answer space itself \u2014 not just a sorted array \u2014 to find the smallest or largest value that satisfies a condition in O(log n) checks." },
    { front: "Breadth-first search", track: "patterns", back: "Exploring a graph or tree level by level with a queue, which finds the shortest path in an unweighted graph and visits nodes in order of distance from the start." },
    { front: "Depth-first search", track: "patterns", back: "Exploring as far as possible along each branch before backtracking, using recursion or a stack. It suits connectivity, cycle detection, and exhaustive traversal." },
    { front: "Backtracking", track: "patterns", back: "Building candidates incrementally and abandoning a partial solution as soon as it can't lead to a valid one, systematically exploring combinations, permutations, and constraint puzzles." },
    { front: "Dynamic programming", track: "patterns", back: "Solving a problem by combining solutions to overlapping subproblems and storing each result once. It turns exponential brute force into polynomial time when optimal substructure holds." },
    { front: "Memoization vs tabulation", track: "patterns", back: "Two ways to do dynamic programming: memoization caches results top-down during recursion, while tabulation fills a table bottom-up. Both avoid recomputation; they differ in direction and overhead." },
    { front: "Greedy algorithm", track: "patterns", back: "Making the locally optimal choice at each step in hopes of a global optimum. It's fast and simple but only correct when the problem has the greedy-choice property, which must be proven." },
    { front: "Divide and conquer", track: "patterns", back: "Splitting a problem into independent subproblems, solving each recursively, and combining their results \u2014 the engine behind merge sort, quicksort, and many O(n log n) algorithms." },
    { front: "Merge intervals", track: "patterns", back: "Sorting intervals by start, then sweeping through and combining any that overlap. It underlies scheduling, calendar, and range-consolidation problems in O(n log n)." },
    { front: "Topological sort", track: "patterns", back: "Ordering the vertices of a directed acyclic graph so every edge points forward, used to schedule tasks with dependencies. A cycle makes a valid ordering impossible." },
    { front: "Top-K with a heap", track: "patterns", back: "Maintaining a heap of size K while scanning a stream to keep the K largest or smallest elements in O(n log K), far cheaper than fully sorting when K is small." },
    { front: "Union-Find", track: "patterns", back: "A disjoint-set structure that tracks connected groups with near-constant union and find operations via path compression and union by rank, key to connectivity and cycle detection." },
    { front: "Prefix sum", track: "patterns", back: "Precomputing cumulative totals so any range sum can be answered in O(1) by subtracting two prefixes, trading O(n) preprocessing for fast repeated range queries." }
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
        el("p", { class: "fc-sub" }, "Flip through key HLD, LLD, and DSA terms and self-grade each one. Your progress saves locally in this browser.")
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
