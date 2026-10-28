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
  // Quiz ids in Beacon use these prefixes: found-, slo-, otel-, tools-, alert-, inc-, perf-, chaos-, data-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["found", "slo", "otel", "tools", "alert", "inc", "perf", "chaos", "data"];
  var TRACK_NAMES = {
    found: "SRE Foundations",
    slo: "SLIs, SLOs & Error Budgets",
    otel: "Telemetry with OpenTelemetry",
    tools: "Observability Tooling",
    alert: "Alerting & On-call",
    inc: "Incident Management & Postmortems",
    perf: "Capacity, Performance & Load Testing",
    chaos: "Resilience & Chaos Engineering",
    data: "Data Pipeline Observability",
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
  var EXAM_KEY = "bc_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "bc_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
     Tracks match Beacon's window.TRACKS ids: found, slo, otel, tools, alert, inc, perf, chaos, data.
     ===================================================================== */
  var CARDS = [
    { front: "Site reliability engineering", track: "found", back: "Treating operations as a software problem: engineers own reliability with code, automation and measurable targets instead of manual heroics." },
    { front: "Toil", track: "found", back: "Manual, repetitive, automatable work that scales with traffic and has no lasting value. Keep it capped (a common target is under half of an SRE's time)." },
    { front: "Reliability as a feature", track: "found", back: "Reliability competes for roadmap time like any feature; the SLO says how much is enough so you stop over- or under-investing." },
    { front: "Embracing risk", track: "found", back: "100% is the wrong target: each extra nine costs far more and users cannot tell the difference past what their own network delivers." },
    { front: "Production readiness review", track: "found", back: "A checklist-driven review (SLOs, alerts, runbooks, capacity, rollback, dependencies) a service passes before SRE support or launch." },
    { front: "Embedded vs central SRE", track: "found", back: "Embedded SREs sit inside product teams for context; a central team builds shared platforms. Many orgs mix both." },
    { front: "Safe change", track: "found", back: "Most outages follow a change, so ship small, progressively (canary, percentage rollouts), with fast automated rollback." },
    { front: "SLI", track: "slo", back: "Service level indicator: a ratio of good events to valid events, such as requests served under 300 ms divided by all requests." },
    { front: "SLO", track: "slo", back: "Service level objective: a target for an SLI over a window, such as 99.9% of requests good over 30 days." },
    { front: "SLA", track: "slo", back: "A contractual promise with penalties. Set it looser than the internal SLO so you get warned before you owe money." },
    { front: "Error budget", track: "slo", back: "1 minus the SLO: the amount of unreliability you may spend. 99.9% over 30 days is about 43 minutes of full outage." },
    { front: "Burn rate", track: "slo", back: "How fast you consume budget relative to plan. A burn rate of 1 spends exactly the budget over the window; 14.4 spends 2% of a 30-day budget in an hour." },
    { front: "Multiwindow burn-rate alert", track: "slo", back: "Page only when both a long window (say 1h) and a short window (5m) exceed the burn threshold: fast detection, quick reset, few false pages." },
    { front: "Error budget policy", track: "slo", back: "An agreed rule for what happens when the budget is exhausted, such as freezing risky launches and redirecting engineers to reliability work." },
    { front: "p99 latency", track: "slo", back: "The value 99% of requests are faster than. Averages hide the tail; percentiles show what your slowest users feel." },
    { front: "OpenTelemetry", track: "otel", back: "A vendor-neutral standard of APIs, SDKs and a Collector for producing and shipping metrics, logs and traces." },
    { front: "Span", track: "otel", back: "One timed operation in a trace with a name, start, duration, attributes, status and a parent span id." },
    { front: "traceparent", track: "otel", back: "The W3C header carrying trace id, parent span id and sampled flag so context propagates across service hops." },
    { front: "OTel Collector", track: "otel", back: "A pipeline of receivers, processors and exporters that batches, filters, enriches and routes telemetry away from app code." },
    { front: "Head vs tail sampling", track: "otel", back: "Head sampling decides at the start of a trace (cheap, blind); tail sampling decides after it finishes, so it can keep every error or slow trace." },
    { front: "Cardinality", track: "otel", back: "The number of unique time series: the product of label value counts. Labels like user_id or request_id explode it." },
    { front: "Histogram metric", track: "otel", back: "Counts observations into buckets so you can compute percentiles across instances; averages of per-pod percentiles are wrong." },
    { front: "Prometheus pull model", track: "tools", back: "Prometheus scrapes /metrics endpoints on an interval, so a dead target shows up as up == 0 rather than silence." },
    { front: "rate()", track: "tools", back: "Per-second average increase of a counter over a range, handling counter resets. Always rate a counter before you sum it." },
    { front: "histogram_quantile", track: "tools", back: "Estimates a percentile from histogram buckets, e.g. histogram_quantile(0.99, sum by (le) (rate(x_bucket[5m])))." },
    { front: "Recording rule", track: "tools", back: "A precomputed PromQL expression stored as a new series, making dashboards and SLO alerts cheap and consistent." },
    { front: "RED and USE", track: "tools", back: "RED (rate, errors, duration) for request-driven services; USE (utilisation, saturation, errors) for resources like CPU, disks and pools." },
    { front: "Loki vs index-heavy log stores", track: "tools", back: "Loki indexes only labels and greps chunks, so it is cheap; full-text indexed stores search fast but cost more to ingest and keep." },
    { front: "Build vs buy observability", track: "tools", back: "Self-hosting trades licence cost for engineering time; SaaS trades money and some lock-in for speed. OTel keeps the exit open." },
    { front: "Symptom-based alert", track: "alert", back: "Pages on what users feel (errors, latency, SLO burn) rather than on causes such as high CPU that may never hurt anyone." },
    { front: "Page vs ticket", track: "alert", back: "Page only for urgent, actionable, user-impacting problems; everything else becomes a ticket for working hours." },
    { front: "Alert precision", track: "alert", back: "Share of pages that were real and needed action. Low precision trains responders to ignore the pager." },
    { front: "Alertmanager inhibition", track: "alert", back: "Suppresses dependent alerts while a broader one fires, e.g. hide per-service alerts while the whole cluster is down." },
    { front: "Runbook", track: "alert", back: "A short, linked page per alert: what it means, how to confirm impact, safe first mitigations and who to escalate to." },
    { front: "Sustainable on-call", track: "alert", back: "Enough people in rotation, few pages per shift, real handoffs and time off after bad nights; otherwise attrition follows." },
    { front: "Follow-the-sun", track: "alert", back: "Rotations across time zones so nobody is paged at night; needs clean written handoffs between regions." },
    { front: "Severity level", track: "inc", back: "A shared scale (SEV1 to SEV4) driven by user impact, scope and duration that decides who joins and how often you communicate." },
    { front: "Incident commander", track: "inc", back: "Coordinates the response and makes decisions; does not debug. Delegates ops, comms and scribing." },
    { front: "Mitigate first", track: "inc", back: "Stop user pain with reversible moves (rollback, flag off, failover, shed load) before hunting the root cause." },
    { front: "Status update cadence", track: "inc", back: "Regular updates at a promised interval with impact, what is known, what is next and when the next update comes." },
    { front: "Blameless postmortem", track: "inc", back: "A review that explains how the system made the failure possible, assuming people acted reasonably with what they knew." },
    { front: "Contributing factors", track: "inc", back: "Several conditions that combined to cause the incident; a single root cause usually oversimplifies." },
    { front: "Good action item", track: "inc", back: "Specific, owned, prioritised and tracked to done; it changes the system, not just reminds people to be careful." },
    { front: "MTTR pitfalls", track: "inc", back: "Means are skewed by a few long incidents and incident counts get gamed; look at distributions and learning, not one number." },
    { front: "Little's law", track: "perf", back: "L = λW: average concurrency equals arrival rate times time in system. 200 rps at 0.5 s means about 100 requests in flight." },
    { front: "Utilisation knee", track: "perf", back: "Queueing delay grows like 1/(1-ρ); past roughly 70–80% utilisation, small load increases cause large latency jumps." },
    { front: "Headroom and N+1", track: "perf", back: "Capacity to lose one (or two) instances or zones at peak while staying inside the SLO." },
    { front: "Tail at scale", track: "perf", back: "With fan-out N, P(at least one slow call) = 1 - 0.99^N; at 100 backends most requests hit a p99 straggler." },
    { front: "Coordinated omission", track: "perf", back: "Load tools that wait for slow responses before sending more under-report latency; fixed arrival-rate generators avoid it." },
    { front: "Soak test", track: "perf", back: "A long steady test that finds leaks, slow growth and periodic jobs that short tests miss." },
    { front: "Breakpoint test", track: "perf", back: "Ramp load until the system fails to find its real limit and how it fails." },
    { front: "Gray failure", track: "chaos", back: "Partial, intermittent degradation that health checks miss but users feel, such as one slow disk or a flaky link." },
    { front: "Retry amplification", track: "chaos", back: "Retries multiply across layers: 3 retries over 3 layers can turn 1 call into 64. Retry at one layer with a budget." },
    { front: "Exponential backoff with jitter", track: "chaos", back: "Waiting longer between retries, randomised, so clients do not retry in synchronised waves." },
    { front: "Circuit breaker", track: "chaos", back: "Stops calling a failing dependency (open), probes it after a cooldown (half-open) and resumes when it recovers (closed)." },
    { front: "Bulkhead", track: "chaos", back: "Separate pools per dependency or tenant so one slow dependency cannot exhaust every thread or connection." },
    { front: "Steady-state hypothesis", track: "chaos", back: "The measurable normal behaviour a chaos experiment expects to hold while a fault is injected." },
    { front: "Blast radius", track: "chaos", back: "How much of the system or user base an experiment or failure can affect; start small with clear abort conditions." },
    { front: "RTO and RPO", track: "chaos", back: "Recovery time objective is how long you may be down; recovery point objective is how much data you may lose." },
    { front: "Data downtime", track: "data", back: "Periods when data is missing, late, wrong or partial; often silent because jobs still exit with success." },
    { front: "Freshness SLI", track: "data", back: "Time since the newest data landed, measured against an agreed SLO such as 'orders table under 2 hours old 99% of the time'." },
    { front: "Volume anomaly", track: "data", back: "A load whose row count deviates sharply from its recent baseline, a cheap catch for partial or duplicate loads." },
    { front: "Data contract", track: "data", back: "An agreed schema and semantics between producer and consumer, with checks that fail before breaking changes ship." },
    { front: "Lineage", track: "data", back: "The graph from sources through transforms to dashboards and models, used to find impact and the upstream cause." },
    { front: "Quarantine", track: "data", back: "Holding suspect data out of downstream tables so a bad load stops propagating while you investigate." },
    { front: "Backfill", track: "data", back: "Re-running a pipeline for a past window after a fix; must be idempotent so reruns do not duplicate rows." }
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
        el("p", { class: "fc-sub" }, "Flip through key SRE, SLO, telemetry and incident terms and self-grade each one. Your progress saves locally in this browser.")
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
