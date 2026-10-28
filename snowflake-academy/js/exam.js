/* =====================================================================
   GLACIER · Exam mode + Flashcards
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
  // Quiz ids in Glacier use these prefixes: arch-, perf-, ingest-, sec-, cost-, dev-, ai-, ops-, plat-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["arch", "perf", "ingest", "sec", "cost", "dev", "ai", "ops", "plat"];
  var TRACK_NAMES = {
    arch: "Architecture & Storage",
    perf: "Warehouses & Query Performance",
    ingest: "Ingestion & Pipelines",
    sec: "Security & Governance",
    cost: "Cost & FinOps",
    dev: "Snowpark & Programmability",
    ai: "Cortex AI",
    ops: "CI/CD & Platform Engineering",
    plat: "Platform, Continuity & Ecosystem"
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
  var EXAM_KEY = "gl_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "gl_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
      var host = window.Academy || window.Glacier;
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
     Tracks match Glacier's window.TRACKS ids: arch, perf, ingest, sec, cost, dev, ai, ops, plat.
     ===================================================================== */
  var CARDS = [
    // arch
    { front: "What are Snowflake's three architectural layers?", track: "arch", back: "Database storage (shared, compressed columnar micro-partitions), compute (virtual warehouses you size and suspend), and cloud services (auth, metadata, optimizer, transactions, result cache)." },
    { front: "Cloud services billing rule", track: "arch", back: "Cloud services credits are billed only for the portion above 10% of that day's warehouse compute credits." },
    { front: "Preferred account identifier format", track: "arch", back: "orgname-accountname (for example acme-prod). Locator form like xy12345.us-east-1 still works but is tied to a region." },
    { front: "Micro-partition", track: "arch", back: "An immutable, compressed, columnar chunk of roughly 50–500 MB uncompressed data, with per-column min/max, counts and nulls kept as metadata." },
    { front: "Why does a one-row UPDATE rewrite a lot of data?", track: "arch", back: "Micro-partitions are immutable, so DML rewrites every partition it touches; the old versions become Time Travel and then Fail-safe storage." },
    { front: "Partition pruning", track: "arch", back: "Cloud services compares predicates with each partition's min/max and skips partitions that cannot match. Functions or casts on the filtered column often defeat it." },
    { front: "Clustering depth", track: "arch", back: "How many micro-partitions overlap at a given key value. Close to 1 means good clustering; rising average_depth means filters on that key prune poorly." },
    { front: "How is Automatic Clustering billed?", track: "arch", back: "As serverless credits visible in AUTOMATIC_CLUSTERING_HISTORY. Resource monitors do not govern it; pause with ALTER TABLE ... SUSPEND RECLUSTER." },
    { front: "Time Travel retention limits", track: "arch", back: "Default 1 day; up to 90 days for permanent objects on Enterprise or higher; transient and temporary objects max 1 day; 0 disables it." },
    { front: "BEFORE(STATEMENT => '<query_id>')", track: "arch", back: "Reads a table as it was just before the given statement committed — the most precise way to recover from a bad DELETE or UPDATE." },
    { front: "Fail-safe", track: "arch", back: "A fixed 7-day period after Time Travel for permanent objects only; recoverable only by Snowflake support and billed as storage. Transient and temporary tables have none." },
    { front: "Zero-copy clone storage", track: "arch", back: "A clone shares the source's micro-partitions and adds no storage until either side changes data; shared partitions the source drops stay billed as retained-for-clone bytes." },
    // perf
    { front: "Credits per hour for each warehouse size", track: "perf", back: "XS=1, S=2, M=4, L=8, XL=16, doubling each step up to 6XL=512. Billing is per second while running, with a 60-second minimum each time the warehouse resumes." },
    { front: "Why can doubling a warehouse size cost nothing extra?", track: "perf", back: "If the work parallelises well, the doubled rate runs for half the time, so credits stay roughly flat while latency halves. It stops being free when the query cannot use the extra nodes or idle tails dominate." },
    { front: "What is the auto-suspend idle tail?", track: "perf", back: "After the last query a warehouse keeps running, and billing, until AUTO_SUSPEND seconds of inactivity pass. Many short bursts on a large warehouse can spend most of their credits in these tails and 60-second minimums." },
    { front: "Scale up vs scale out", track: "perf", back: "A bigger size (scale up) makes individual queries faster and gives them more memory. More clusters (scale out, multi-cluster, Enterprise+) cut queueing under concurrency; a single query never spans clusters." },
    { front: "Standard vs Economy scaling policy", track: "perf", back: "Standard starts another cluster as soon as queries queue, favouring latency. Economy only starts one when it expects enough sustained load to keep it busy for several minutes, favouring credits." },
    { front: "Conditions for result cache reuse", track: "perf", back: "Same query text, unchanged underlying data, no non-deterministic functions like CURRENT_TIMESTAMP, a role with the needed privileges, and USE_CACHED_RESULT = TRUE. Results last 24 hours, extended by reuse up to 31 days, and are shared across warehouses." },
    { front: "What happens to the local disk cache on suspend?", track: "perf", back: "It is lost with the compute nodes, so the first queries after resume read cold from remote storage. Longer auto-suspend keeps it warm at the cost of idle credits." },
    { front: "Local vs remote spilling", track: "perf", back: "When an operator's working set exceeds memory it spills to local SSD, then to remote storage once SSD is full. Remote spill can slow a query by an order of magnitude; check for row explosion before sizing up." },
    { front: "Signature of an exploding join in the Query Profile", track: "perf", back: "A Join node whose output rows far exceed both inputs, caused by duplicate keys on both sides. Deduplicate one side (for example QUALIFY ROW_NUMBER() = 1) or add the missing join column; DISTINCT afterwards only hides it." },
    { front: "Why does TO_VARCHAR(ts, 'YYYY-MM') = '2026-01' hurt performance?", track: "perf", back: "Wrapping the filtered column hides it from micro-partition min/max metadata, so pruning is lost and every partition is scanned. Use a range on the raw column instead." },
    { front: "When to use Search Optimization vs Query Acceleration", track: "perf", back: "Search optimization serves selective needle lookups (equality, substring, VARIANT keys) on columns the table is not clustered by. QAS lends serverless compute to outlier queries with large scans; both need Enterprise+ and bill serverless credits." },
    { front: "Materialized view vs dynamic table", track: "perf", back: "A materialized view (Enterprise+) is restricted to one base table, has serverless maintenance, and the optimizer can use it automatically. A dynamic table allows joins, refreshes on your warehouse to meet a TARGET_LAG, and is queried by name." },
    // ingest
    { front: "Storage integration", track: "ingest", back: "An account object that lets external stages reach a bucket through a cloud IAM role trust instead of embedded keys, with STORAGE_ALLOWED_LOCATIONS limiting which prefixes are reachable." },
    { front: "How long does COPY INTO remember which files a table has loaded?", track: "ingest", back: "64 days of per-table load metadata. Already-loaded files are skipped unless FORCE = TRUE; older files without metadata are skipped as uncertain unless LOAD_UNCERTAIN_FILES = TRUE." },
    { front: "Default ON_ERROR: bulk COPY vs Snowpipe", track: "ingest", back: "Bulk COPY defaults to ABORT_STATEMENT (one error rolls back the load); Snowpipe defaults to SKIP_FILE so one bad file cannot block the stream." },
    { front: "VALIDATION_MODE", track: "ingest", back: "A COPY option (RETURN_ERRORS, RETURN_n_ROWS, RETURN_ALL_ERRORS) that parses staged files and reports problems without loading anything. It cannot be combined with a transforming COPY." },
    { front: "What drives Snowpipe cost?", track: "ingest", back: "Serverless load compute plus per-file overhead, so file count and size are the lever: batch toward 100-250 MB compressed files or move row-level sources to Snowpipe Streaming." },
    { front: "Offset token (Snowpipe Streaming)", track: "ingest", back: "A source position (such as a Kafka offset) the client sends with each batch; Snowflake commits the latest one per channel, and the client resumes after it on restart for exactly-once delivery." },
    { front: "How does an UPDATE appear in a standard stream?", track: "ingest", back: "As two rows: a DELETE of the old image and an INSERT of the new image, both with METADATA$ISUPDATE = TRUE." },
    { front: "When does a stream's offset advance?", track: "ingest", back: "Only when a DML statement that reads the stream commits. Plain SELECTs never move it, and a rolled-back transaction leaves it unchanged." },
    { front: "Why guard a task with WHEN SYSTEM$STREAM_HAS_DATA?", track: "ingest", back: "The condition is evaluated in cloud services, so an empty stream skips the run without resuming a warehouse, avoiding the 60-second minimum on every idle tick." },
    { front: "TARGET_LAG = DOWNSTREAM", track: "ingest", back: "A dynamic table refreshes only as often as its dynamic-table consumers need. With no dynamic-table consumers, it is not refreshed on a schedule at all." },
    { front: "Why does INSERT ... VALUES (PARSE_JSON('...')) fail?", track: "ingest", back: "VALUES accepts constants only. Use INSERT ... SELECT PARSE_JSON('...') with UNION ALL for multiple rows; a bare string literal would be stored as a VARIANT string, not an object." },
    { front: "Snowflake-managed vs externally managed Iceberg table", track: "ingest", back: "Snowflake-managed: Snowflake is the catalog and writes Parquet plus Iceberg metadata to your external volume with full DML. Externally managed: another catalog (such as Glue) owns commits and Snowflake reads after a metadata refresh." },
    // sec
    { front: "Which way does privilege inheritance flow in the Snowflake role graph?", track: "sec", back: "Upward: when role A is granted to role B, B inherits all of A's privileges. Every custom role should be granted to SYSADMIN so admins inherit what it owns." },
    { front: "Access role vs functional role", track: "sec", back: "Access roles hold object privileges for one domain and level (SALES_RO); functional roles represent a job (ANALYST) and hold only other roles. Users get functional roles." },
    { front: "GRANT ... ON ALL TABLES vs ON FUTURE TABLES", track: "sec", back: "ON ALL is a one-time snapshot of existing tables; ON FUTURE fires for each table created later. Pair them, and remember schema-level future grants override database-level ones for that schema." },
    { front: "What does a managed access schema change?", track: "sec", back: "Object owners can no longer grant privileges on their objects; only the schema owner or a MANAGE GRANTS holder can. Grant decisions become centralised." },
    { front: "Who owns an object created with secondary roles active?", track: "sec", back: "The primary role. Secondary roles add privileges for queries and DML, but CREATE is authorised by and owned by the primary role only." },
    { front: "CURRENT_ROLE() vs IS_ROLE_IN_SESSION() in a policy", track: "sec", back: "CURRENT_ROLE() matches only the exact primary role name; IS_ROLE_IN_SESSION() is true for active or inherited roles, so it respects the hierarchy and secondary roles." },
    { front: "Order of evaluation: row access policy vs masking policy", track: "sec", back: "Row access runs first to decide which rows exist for the caller, then masking is applied to the surviving rows' columns. There is no built-in ACCOUNTADMIN bypass for either." },
    { front: "Tag-based masking precedence", track: "sec", back: "A masking policy attached to a tag protects every column carrying that tag, but a policy set directly on a column overrides the tag-based one." },
    { front: "Why are secure views sometimes slower?", track: "sec", back: "The optimizer gives up rewrites that could evaluate user predicates or functions before the view's own filters, which would risk leaking hidden rows. Shares require secure objects." },
    { front: "Network policy precedence", track: "sec", back: "The most specific attachment wins: a user-level policy replaces the account-level policy for that user rather than combining with it. Security integrations can carry their own policy." },
    { front: "Zero-downtime key-pair rotation", track: "sec", back: "Set the new public key in RSA_PUBLIC_KEY_2, move clients to the new private key (loaded from a vault), confirm via DESC USER fingerprints, then UNSET RSA_PUBLIC_KEY." },
    { front: "Direct share vs reader account: who pays compute?", track: "sec", back: "With a direct share or listing, the consumer pays for its own queries. A reader account belongs to the provider, so the provider pays its warehouse credits." },
    // cost
    { front: "Warehouse credit rates by size", track: "cost", back: "Each size step doubles the rate: XS=1, S=2, M=4, L=8, XL=16 credits/hour, up to 6XL=512. Multi-cluster warehouses multiply by the number of running clusters." },
    { front: "The 60-second minimum", track: "cost", back: "Warehouses bill per second, but each resume is charged at least 60 seconds. Frequent wake-ups for tiny probes pay that minimum every time." },
    { front: "Cloud services 10% adjustment", track: "cost", back: "Each day, cloud services credits are billed only for the part above 10% of that day's virtual warehouse compute. Chatty metadata-heavy workloads with little warehouse use are the ones that pay." },
    { front: "What do resource monitors NOT see?", track: "cost", back: "Serverless compute: Snowpipe, automatic clustering, search optimization, MV refresh, serverless tasks, QAS and Cortex. Use budgets and the serverless history views for those." },
    { front: "SUSPEND vs SUSPEND_IMMEDIATE", track: "cost", back: "SUSPEND stops new queries but lets running statements finish, so spend can overshoot. SUSPEND_IMMEDIATE also cancels running statements and is usually set at a higher threshold as a backstop." },
    { front: "Budgets vs resource monitors", track: "cost", back: "Budgets track monthly spend for groups of objects, including serverless features, and notify when projected spend exceeds the limit. Resource monitors hard-stop warehouses only." },
    { front: "When is a bigger warehouse cheaper?", track: "cost", back: "When doubling the size more than halves runtime, typically for queries spilling to remote storage. Measure cost per job, not credits per hour." },
    { front: "Queuing with fast queries — which lever?", track: "cost", back: "A multi-cluster warehouse with a modest MAX_CLUSTER_COUNT, because the problem is concurrency. A bigger single cluster mostly speeds individual queries." },
    { front: "ACCOUNT_USAGE vs INFORMATION_SCHEMA", track: "cost", back: "ACCOUNT_USAGE is account-wide, includes dropped objects and keeps 365 days but lags by up to a few hours. INFORMATION_SCHEMA is near real-time but per-database with short retention." },
    { front: "Why attributed credits < metered credits", track: "cost", back: "QUERY_ATTRIBUTION_HISTORY only spreads compute used while queries execute; idle time before auto-suspend and very short queries are not attributed. The gap measures idle waste." },
    { front: "QUERY_TAG", track: "cost", back: "A session parameter recorded on every query, used to group cost by pipeline, team or environment. Keep it JSON-shaped and set the environment from a variable, not a literal." },
    { front: "RETAINED_FOR_CLONE_BYTES", track: "cost", back: "Bytes kept alive and billed to a table only because a clone still references its micro-partitions. Forgotten clones and backups are a common hidden storage cost." },
    // dev
    { front: "Snowflake Scripting: how do you reference a variable as a value vs as a table name inside a SQL statement?", track: "dev", back: "Use :var for a value and IDENTIFIER(:var) for an object name. Bare names work only in scripting expressions such as LET, IF and RETURN." },
    { front: "Default rights mode for a stored procedure", track: "dev", back: "Owner's rights. The body runs with the owning role's privileges and resolves unqualified names in the procedure's own database and schema." },
    { front: "What can't an owner's-rights procedure do with the caller's session?", track: "dev", back: "It cannot read, set or unset the caller's session variables or change the caller's session parameters, and caller-specific metadata such as SHOW and DESCRIBE is restricted." },
    { front: "Does a successful CREATE OR REPLACE PROCEDURE prove the body works?", track: "dev", back: "No. Object names, columns and privileges are resolved when each statement runs during CALL. Validate with a smoke CALL plus a GET_DDL ILIKE token check." },
    { front: "Why is EXCEPTION WHEN statement_error THEN RETURN OBJECT_CONSTRUCT(...) dangerous?", track: "dev", back: "It turns a failure into a successful CALL that returns JSON, so tasks and schedulers report success. Log the error details, then RAISE." },
    { front: "Fastest way to debug a dynamic-SQL procedure error", track: "dev", back: "Get the exact generated SQL, for example from a dry-run flag or an error log column, and run it standalone. You get the raw parser error with an accurate position." },
    { front: "JavaScript procedure/UDF argument quirks", track: "dev", back: "Arguments appear as UPPERCASE identifiers, and NUMBER maps to a double that is exact only up to about 2^53. Pass large ids as VARCHAR." },
    { front: "Python UDTF: process vs end_partition", track: "dev", back: "process runs for every input row and may yield rows. end_partition runs once after the last row of each partition defined by OVER (PARTITION BY ...)." },
    { front: "Vectorized Python UDF", track: "dev", back: "Declared with @vectorized(input=pandas.DataFrame). The handler receives batches of rows and returns one value per row, which amortises per-row runtime overhead." },
    { front: "Objects needed for a UDF to call an outside API", track: "dev", back: "An egress NETWORK RULE, a SECRET holding the credential, and an EXTERNAL ACCESS INTEGRATION that allows both. The function references the integration and maps the secret by name." },
    { front: "When does a Snowpark DataFrame actually execute SQL?", track: "dev", back: "Only on actions such as collect(), show(), count(), to_pandas() or save_as_table(). Every action reruns the full plan unless you materialise it with cache_result()." },
    { front: "How should a CI job authenticate a Snowpark session?", track: "dev", back: "Key-pair auth (SNOWFLAKE_JWT), with the private key file path and passphrase read from environment variables that the CI secret store fills in. Never put an inline password in code or committed config." },
    // ai
    { front: "What is a Cortex LLM function, mechanically?", track: "ai", back: "A SQL function whose body is a call to a model hosted inside Snowflake: one value in, one value out per row, under your normal RBAC and governance." },
    { front: "Which tokens does COMPLETE bill?", track: "ai", back: "Both input (prompt) and output (generated) tokens, as AI services credits, plus the warehouse time of the query that calls it." },
    { front: "Why keep Cortex function queries on a Medium or smaller warehouse?", track: "ai", back: "Inference runs on Snowflake-managed capacity, not your warehouse nodes, so a bigger warehouse mostly adds idle credits without speeding the model up." },
    { front: "How do you restrict who can call Cortex LLM functions and which models?", track: "ai", back: "Revoke the SNOWFLAKE.CORTEX_USER database role from PUBLIC, grant it to approved roles, and set the CORTEX_MODELS_ALLOWLIST account parameter." },
    { front: "Can a resource monitor cap Cortex AI spend?", track: "ai", back: "No. Resource monitors govern warehouses only; AI services credits are serverless, so use role grants, the model allowlist, budgets and alerts on the usage views." },
    { front: "Does Cortex Analyst execute the SQL it generates?", track: "ai", back: "No. It returns text and a SQL statement; the client runs it in the user's session, so RBAC, masking and row access policies still apply." },
    { front: "What type must verified_at be in a semantic model verified query?", track: "ai", back: "An integer Unix epoch in seconds (for example 1793145600), not a date string like '2026-10-28'." },
    { front: "Two rules for relationships in a semantic model YAML", track: "ai", back: "Every relationship needs a name that is unique across the model, and the right_column must be the right table's primary key or a unique key." },
    { front: "Where do environment-specific filters belong in a semantic model?", track: "ai", back: "In module_custom_instructions (sql_generation), templated per environment at deploy time, never as literals in verified queries or table filters." },
    { front: "Safe sequence for uploading a new semantic model YAML to a stage", track: "ai", back: "Copy the live file to a dated backup path, then PUT with AUTO_COMPRESS=FALSE and OVERWRITE=TRUE, LIST to confirm, and run the evaluation questions." },
    { front: "What does TARGET_LAG mean on a Cortex Search service?", track: "ai", back: "The maximum staleness of the index relative to its source query; the service refreshes like a dynamic table, so shorter lag means more refresh and embedding cost." },
    { front: "Biggest lever on RAG answer quality", track: "ai", back: "Retrieval: well-sized overlapping chunks with titles, entitlement filters, and a grounded prompt that forces citations and a not-found path." },
    // ops
    { front: "schemachange: V, R and A script prefixes", track: "ops", back: "Versioned (V) scripts run once in version order; repeatable (R) scripts rerun when their checksum changes; always (A) scripts run last on every deploy." },
    { front: "What happens if you edit an already-applied versioned schemachange script?", track: "ops", back: "Nothing in that environment, because the version is already recorded, but fresh environments get the new text. Ship fixes as a new version instead." },
    { front: "Which Snowflake objects belong in Terraform?", track: "ops", back: "Account-level, slow-changing objects: warehouses, databases, roles, grants, users, resource monitors and network policies. Tables and models belong to migrations and dbt." },
    { front: "dbt-snowflake default table type", track: "ops", back: "Tables are transient by default, so they have no Fail-safe and at most one day of Time Travel. Set transient: false for data you cannot rebuild." },
    { front: "How do you avoid hardcoding environment database names?", track: "ops", back: "Inject them at run time with session variables and IDENTIFIER($target_db), schemachange vars or dbt targets such as {{ target.database }}." },
    { front: "Backup-before-mutate naming convention", track: "ops", back: "Clone the object as <NAME>_BKP_<DDMON> right before the change, e.g. CREATE TABLE JOB_CONFIG_BKP_14MAR CLONE JOB_CONFIG, so rollback is a SWAP or a reinsert." },
    { front: "Why does INSERT ... VALUES (1, PARSE_JSON('...')) fail?", track: "ops", back: "VALUES accepts constants only. Use INSERT ... SELECT 1, PARSE_JSON('...') UNION ALL SELECT ... instead." },
    { front: "Adding several columns idempotently in one ALTER", track: "ops", back: "Use one ADD, then repeat COLUMN IF NOT EXISTS for each column: ADD COLUMN IF NOT EXISTS a INT, COLUMN IF NOT EXISTS b VARCHAR." },
    { front: "What type does DECRYPT() return?", track: "ops", back: "BINARY. Convert it with TO_VARCHAR(DECRYPT(...), 'UTF-8') or CAST(... AS VARCHAR) before comparing or displaying it." },
    { front: "The comment-banner deploy bug", track: "ops", back: "A driver that skips statements starting with '--' drops every CREATE that has a banner comment in front of it. Treat a statement as executable if any stripped line is non-empty and not a comment." },
    { front: "Why can a CI step be green when a procedure failed?", track: "ops", back: "An EXCEPTION handler that returns OBJECT_CONSTRUCT('status','FAILED',...) makes the CALL succeed. Check the returned status, and run the generated SQL standalone to see the raw error." },
    { front: "Snowflake vs Databricks in one line", track: "ops", back: "Snowflake optimises for managed simplicity and SQL concurrency; Databricks for open Delta files, Spark, streaming and ML depth. Iceberg lets both share one copy of the data." },
    { front: "ADD COLUMN IF NOT EXISTS for several columns", track: "ops", back: "One ADD with comma-separated COLUMN clauses, repeating the guard on each: ADD COLUMN IF NOT EXISTS c1 INT, COLUMN IF NOT EXISTS c2 INT." },
    // plat
    { front: "Replication group vs failover group", track: "plat", back: "Both replicate a consistent bundle of objects on a schedule to read-only secondaries. Only a failover group's secondary can be promoted to primary (Business Critical or higher)." },
    { front: "What sets your RPO with failover groups?", track: "plat", back: "The REPLICATION_SCHEDULE plus refresh duration. Replication is asynchronous, so writes after the last completed refresh are lost if the primary region fails." },
    { front: "What does a connection object do?", track: "plat", back: "Gives clients one connection URL that follows the primary. ALTER CONNECTION ... PRIMARY in the DR account repoints every client without changing app config." },
    { front: "ORGADMIN in one line", track: "plat", back: "The organisation-level role: creates accounts, enables replication between them and reads ORGANIZATION_USAGE across all accounts." },
    { front: "Share vs listing", track: "plat", back: "A share is the grant plumbing that another account mounts read-only. A listing wraps it as a product with terms, optional pricing and cross-region auto-fulfilment." },
    { front: "Aggregation policy vs projection policy", track: "plat", back: "Aggregation forces grouped results with a minimum group size. Projection lets a column be used for joins and filters but never returned. Together they are clean-room building blocks." },
    { front: "Where does a Native App run?", track: "plat", back: "In the consumer's account, on the consumer's compute, next to their data. The provider's code stays hidden; access is granted through application roles." },
    { front: "What do you pay for in Snowpark Container Services?", track: "plat", back: "Compute pool nodes while they are active, regardless of traffic. Set AUTO_SUSPEND_SECS and size MIN_NODES from real load." },
    { front: "When is a hybrid table the right choice?", track: "plat", back: "High-concurrency point reads and small writes by primary key, with enforced PK, UNIQUE and FK constraints and row-level locks. Keep big scans on standard tables." },
    { front: "What happens to an open transaction when you run DDL?", track: "plat", back: "The DDL commits it first, then runs in its own transaction. A later ROLLBACK only undoes statements after the DDL." },
    { front: "Two MERGEs on one standard table at once", track: "plat", back: "The second waits for the first to commit, up to LOCK_TIMEOUT, then fails. Serialise them or combine them; hybrid tables lock per row instead." },
    { front: "INFORMATION_SCHEMA vs ACCOUNT_USAGE query history", track: "plat", back: "INFORMATION_SCHEMA table functions: near real-time, a few days, your role's scope. ACCOUNT_USAGE: about a year, account-wide, lags by tens of minutes." },
    { front: "Why tag sessions with QUERY_TAG?", track: "plat", back: "Every query carries the tag, so cost and runtime group by DAG, task, run or dbt model with no SQL changes. Use JSON so several keys can be parsed." },
    { front: "Storage integration handshake", track: "plat", back: "Create the integration with the cloud role and allowed locations, run DESC INTEGRATION, and add the Snowflake principal and external id to the role's trust policy. No keys in stages." },
    { front: "External function vs external access integration", track: "plat", back: "An external function is SQL backed by a remote HTTPS service through an API gateway. External access lets Python or Java UDFs call allow-listed hosts directly, with secrets." },
    { front: "Why window alerts by scheduled time?", track: "plat", back: "Runs start late or early. Checking from LAST_SUCCESSFUL_SCHEDULED_TIME() to SCHEDULED_TIME() covers every moment exactly once. And remember alerts are created suspended." },
    { front: "Airflow plus Snowflake golden rules", track: "plat", back: "Pass the logical date in, make steps idempotent, tag sessions with DAG and run ids, keep credentials and env names out of DAG code, and push work down to Snowflake." }
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
        el("p", { class: "fc-sub" }, "Flip through key Snowflake platform terms and self-grade each one. Your progress saves locally in this browser.")
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
