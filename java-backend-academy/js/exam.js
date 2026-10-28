/* =====================================================================
   ANVIL · Exam mode + Flashcards
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
  // Quiz ids in Anvil use these prefixes: java-, jvm-, conc-, boot-, api-, data-, res-, sec-, test-, prod-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["java", "jvm", "conc", "boot", "api", "data", "res", "sec", "test", "prod"];
  var TRACK_NAMES = {
    java: "Modern Java",
    jvm: "JVM Internals",
    conc: "Concurrency",
    boot: "Spring Boot Core",
    api: "Building APIs",
    data: "Data Access",
    res: "Resilience & Microservices",
    sec: "Security",
    test: "Testing & Quality",
    prod: "Production"
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
  var EXAM_KEY = "av_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "av_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
     Tracks match Anvil's window.TRACKS ids: java, jvm, conc, boot, api, data, res, sec, test, prod.
     ===================================================================== */
  var CARDS = [
    { front: "Record", track: "java", back: "A final class whose identity is its components; the compiler generates the constructor, accessors, equals, hashCode and toString." },
    { front: "Compact constructor", track: "java", back: "A record constructor without a parameter list that runs before fields are assigned; the place to validate, normalise and defensively copy." },
    { front: "Sealed interface", track: "java", back: "An interface that names every permitted subtype, so the compiler can check that a switch over it is exhaustive." },
    { front: "Record pattern", track: "java", back: "A pattern such as Declined(var reason, var retryable) that tests a record's type and binds its components in one step." },
    { front: "Guard (when)", track: "java", back: "A boolean condition on a switch case evaluated after the pattern binds; if false, matching moves on to the next case." },
    { front: "Stream laziness", track: "java", back: "Intermediate operations only describe work; a terminal operation pulls elements through the whole pipeline one at a time, so short-circuiting stages can stop early." },
    { front: "toMap merge function", track: "java", back: "The third argument to Collectors.toMap that decides what happens on duplicate keys; without it, a duplicate throws IllegalStateException." },
    { front: "orElse vs orElseGet", track: "java", back: "orElse always evaluates its argument; orElseGet takes a Supplier and runs it only when the Optional is empty." },
    { front: "PECS", track: "java", back: "Producer extends, consumer super: use ? extends T for parameters you read from and ? super T for parameters you write into." },
    { front: "Type erasure", track: "java", back: "Generic type arguments are removed at compile time, so the runtime cannot create a T, check instanceof List<String>, or distinguish overloads that differ only by type argument." },
    { front: "HashMap load factor", track: "java", back: "The fullness ratio (default 0.75) at which the table doubles and rehashes; 16 buckets resize when size exceeds 12." },
    { front: "Treeification", track: "java", back: "When a HashMap bin passes 8 entries and the table has at least 64 buckets, the bin becomes a red-black tree, bounding lookup to O(log n)." },
    { front: "Metaspace", track: "jvm", back: "Native memory that stores class metadata. It grows by default; OutOfMemoryError: Metaspace usually means a class loader leak." },
    { front: "MaxRAMPercentage", track: "jvm", back: "Sizes the maximum heap as a share of the container's memory limit, leaving room for stacks, metaspace, code cache and buffers." },
    { front: "Exit code 137", track: "jvm", back: "The container was killed by the kernel for exceeding its memory limit; the process total, not just the heap, was too big." },
    { front: "GC roots", track: "jvm", back: "Starting points of reachability: thread stacks, static fields, JNI handles. Anything not reachable from them is garbage." },
    { front: "Weak generational hypothesis", track: "jvm", back: "Most objects die young, so frequently collecting a small young space reclaims most garbage cheaply." },
    { front: "TLAB", track: "jvm", back: "Thread-local allocation buffer: a private slice of eden where a thread allocates by bumping a pointer, with no locking." },
    { front: "Safepoint", track: "jvm", back: "A point where a thread can be paused with all references known; stop-the-world GC phases bring every thread to one." },
    { front: "G1 pause goal", track: "jvm", back: "-XX:MaxGCPauseMillis, 200 ms by default; G1 sizes young collections and mixed old-region work to aim for it." },
    { front: "ZGC", track: "jvm", back: "A concurrent collector with sub-millisecond pauses largely independent of heap size, paid for with CPU and memory headroom." },
    { front: "NoSuchMethodError", track: "jvm", back: "A linking error that usually means two versions of a library are on the classpath and the older one won." },
    { front: "Tiered compilation", track: "jvm", back: "Code is interpreted, then compiled quickly by C1 while profiling, then recompiled by the optimizing C2 compiler when hot." },
    { front: "Deoptimization", track: "jvm", back: "The JVM discards optimized code whose speculative assumption broke and falls back to slower code until it recompiles." },
    { front: "Retained size", track: "jvm", back: "The memory freed if an object were collected: the object plus everything reachable only through it." },
    { front: "JFR", track: "jvm", back: "Java Flight Recorder: a low-overhead event recorder built into the JVM, suitable for continuous recording in production." },
    { front: "Interruption", track: "conc", back: "Cooperative cancellation: interrupt() sets a flag and wakes blocking calls; code must stop or restore the flag with Thread.currentThread().interrupt()." },
    { front: "Happens-before", track: "conc", back: "The memory-model relation that guarantees one thread's writes are visible to another: locks, volatile, thread start/join, completed futures, final fields." },
    { front: "volatile", track: "conc", back: "Guarantees visibility and ordering for one field, but not atomicity: count++ on a volatile still loses updates." },
    { front: "Safe publication", track: "conc", back: "Making an object visible to other threads through a happens-before edge, such as a volatile field, a concurrent collection or a lock; immutable objects are simplest." },
    { front: "Unbounded executor queue", track: "conc", back: "The hidden risk of newFixedThreadPool: overload turns into unbounded memory and queueing delay instead of rejection." },
    { front: "CallerRunsPolicy", track: "conc", back: "A rejection policy that runs the task on the submitting thread, slowing producers down as natural backpressure." },
    { front: "Pool sizing for blocking work", track: "conc", back: "Start from cores × (1 + wait / compute) and validate with load tests." },
    { front: "thenCompose", track: "conc", back: "Chains an async step that returns another CompletableFuture without nesting futures; the flatMap of futures." },
    { front: "Common pool trap", track: "conc", back: "supplyAsync without an executor uses the JVM-wide ForkJoinPool; blocking I/O there starves parallel streams and other async work." },
    { front: "computeIfAbsent", track: "conc", back: "An atomic per-key check-and-insert on ConcurrentHashMap, replacing the racy containsKey-then-put pattern." },
    { front: "LongAdder", track: "conc", back: "A counter with per-thread cells summed on read; far less contention than AtomicLong for hot, rarely read counters." },
    { front: "Lock ordering", track: "conc", back: "Acquiring locks in one global order so no cycle, and therefore no deadlock, can form." },
    { front: "Virtual thread", track: "conc", back: "A JVM-managed thread that unmounts from its carrier when it blocks, making thread-per-request cheap for I/O-heavy services." },
    { front: "Pinning", track: "conc", back: "A virtual thread that cannot unmount, for example blocking inside synchronized on JDK 21; visible as jdk.VirtualThreadPinned in JFR." },
    { front: "spring.threads.virtual.enabled", track: "conc", back: "The Spring Boot 3.2+ property that runs request handling and several Spring executors on virtual threads (Java 21+)." },
    { front: "Inversion of control", track: "boot", back: "Classes declare what they need and a container creates and wires them; Spring builds the bean graph at startup so wiring errors fail fast." },
    { front: "Constructor injection", track: "boot", back: "Dependencies passed through the constructor into final fields: explicit, immutable and easy to unit test with plain new." },
    { front: "@Bean method", track: "boot", back: "A factory method in a @Configuration class, used for third-party types or beans that need construction logic." },
    { front: "Self-invocation trap", track: "boot", back: "Calling a @Transactional, @Async or @Cacheable method from the same bean bypasses the proxy, so the behaviour silently does not apply." },
    { front: "Singleton scope", track: "boot", back: "The default: one shared instance per container used by all threads, so the bean must be stateless or thread-safe." },
    { front: "ObjectProvider", track: "boot", back: "Lets a singleton fetch a new prototype-scoped instance (or an optional bean) on each use instead of once at injection." },
    { front: "Package by feature", track: "boot", back: "Group code by business capability so changes stay local and package-private visibility can hide each feature's internals." },
    { front: "@ConditionalOnMissingBean", track: "boot", back: "Makes an auto-configured bean back off when the application defines its own bean of that type." },
    { front: "Condition evaluation report", track: "boot", back: "Printed with --debug or served by the conditions endpoint; explains why each auto-configuration matched or not." },
    { front: "@ConfigurationProperties record", track: "boot", back: "A typed, validated holder for a prefix of settings; with @Validated a bad or missing value fails startup." },
    { front: "Relaxed binding", track: "boot", back: "Maps APP_PAYMENT_MAXRETRIES or app.payment.max-retries onto the same property, which is how env vars override YAML." },
    { front: "Secret placeholder", track: "boot", back: "A reference such as ${DB_PASSWORD} resolved at runtime from the environment, a mounted secret or a secret manager, never a committed value." },
    { front: "Management port", track: "boot", back: "A separate port for Actuator endpoints that is not routed publicly, keeping health and metrics internal." },
    { front: "Idempotent method", track: "api", back: "Repeating it has the same effect as doing it once: GET, PUT, DELETE, HEAD, OPTIONS. POST is not idempotent." },
    { front: "201 Created", track: "api", back: "Success for a create, with a Location header pointing at the new resource." },
    { front: "401 vs 403", track: "api", back: "401 means not authenticated (send credentials); 403 means authenticated but not allowed." },
    { front: "429 Too Many Requests", track: "api", back: "The client exceeded a rate limit; include Retry-After so it can back off." },
    { front: "Input vs business validation", track: "api", back: "Bean Validation checks request shape at the edge; rules needing state, such as credit limits, live in the service." },
    { front: "@Valid on nested objects", track: "api", back: "Constraints on nested records and list elements are only checked if the field or type argument is marked @Valid." },
    { front: "ProblemDetail", track: "api", back: "Spring's implementation of RFC 9457 problem details: type, title, status, detail and instance, plus safe extension fields like traceId." },
    { front: "@RestControllerAdvice", track: "api", back: "A single place mapping exceptions to error responses so controllers stay free of try/catch." },
    { front: "Idempotency key", track: "api", back: "A client-chosen key per logical operation; the server claims it atomically, stores the response and replays it on retry." },
    { front: "Request fingerprint", track: "api", back: "A hash of the request stored with an idempotency key, so reusing the key with a different body can be rejected." },
    { front: "Keyset pagination", track: "api", back: "Seek past the last seen sort key with an index instead of OFFSET; constant cost at any depth and stable under inserts." },
    { front: "Slice vs Page", track: "api", back: "Slice only reports hasNext and skips the COUNT query; Page includes totals at the cost of a count on every request." },
    { front: "Tolerant reader", track: "api", back: "Clients ignore unknown fields, which makes additive response changes backward compatible." },
    { front: "Sunset header", track: "api", back: "Announces the date a deprecated API version will stop working, alongside the Deprecation header." },
    { front: "Protobuf field numbers", track: "api", back: "Identify fields on the wire; never reuse or change them, and reserve numbers of removed fields." },
    { front: "gRPC deadline", track: "api", back: "A per-call time limit that propagates to downstream calls so work stops once the caller has given up." },
    { front: "Persistence context", track: "data", back: "The set of managed entities in a transaction: one instance per row, change tracking, and the decision of when SQL is flushed." },
    { front: "Dirty checking", track: "data", back: "At flush, Hibernate compares managed entities with their loaded snapshot and issues UPDATEs, so no save() is needed for managed entities." },
    { front: "Open-in-view", track: "data", back: "On by default in Spring Boot: keeps the session open for the whole request, hiding lazy-loading queries in the web layer. Turn it off." },
    { front: "N+1 problem", track: "data", back: "One query for N parents plus one query per parent when a lazy association is touched in a loop." },
    { front: "@EntityGraph", track: "data", back: "Declares which associations a repository query fetches, so mappings can stay lazy while specific use cases load what they need." },
    { front: "@ManyToOne default fetch", track: "data", back: "EAGER by the JPA spec; set FetchType.LAZY explicitly." },
    { front: "readOnly transaction", track: "data", back: "@Transactional(readOnly = true) skips dirty checking and flushes and can route to replicas; a good class-level default for query services." },
    { front: "Default rollback rules", track: "data", back: "Spring rolls back on RuntimeException and Error; checked exceptions commit unless rollbackFor says otherwise." },
    { front: "UnexpectedRollbackException", track: "data", back: "Thrown at commit when an inner REQUIRED method failed and marked the shared transaction rollback-only, even if the outer method caught the exception." },
    { front: "REQUIRES_NEW", track: "data", back: "Suspends the current transaction and runs an independent one on a second connection; it commits even if the caller later rolls back." },
    { front: "Optimistic locking", track: "data", back: "A @Version column checked in every UPDATE; a stale write affects zero rows and raises a conflict instead of overwriting." },
    { front: "Atomic conditional update", track: "data", back: "UPDATE ... SET qty = qty - :n WHERE sku = :sku AND qty >= :n: check and write in one statement, safe across instances." },
    { front: "Expand and contract", track: "data", back: "Zero-downtime schema change: add the new shape, write both, backfill, switch reads, and only later drop the old shape." },
    { front: "Fleet connection budget", track: "data", back: "Instances × pool size must stay below the database connection limit, including during autoscaling." },
    { front: "Cache stampede", track: "data", back: "Many concurrent misses rebuild the same expired key at once; mitigate with per-key load coalescing, refresh-ahead and TTL jitter." },
    { front: "Timeout budget", track: "res", back: "Downstream timeouts are derived from what the caller promised; a 5 s read timeout behind a 1 s endpoint SLO is meaningless." },
    { front: "Retry storm", track: "res", back: "Retries at several layers multiply attempts on a failing dependency, turning a partial failure into an outage." },
    { front: "Jitter", track: "res", back: "Random variation added to backoff delays so clients that failed together do not retry in synchronized waves." },
    { front: "Circuit breaker states", track: "res", back: "CLOSED records outcomes, OPEN rejects calls immediately, HALF-OPEN allows a few trial calls to decide whether to close." },
    { front: "Slow-call threshold", track: "res", back: "Resilience4j can count calls slower than a duration as failures, so a breaker also opens on a dependency that is slow rather than down." },
    { front: "Fallback", track: "res", back: "A cheap, safe degraded response when a call fails or the breaker is open: cached data, a default, or a clear 503." },
    { front: "Bulkhead", track: "res", back: "Separate, bounded concurrency per dependency so one slow dependency cannot exhaust the threads or connections others need." },
    { front: "Load shedding", track: "res", back: "Rejecting excess work early with a fast 503 or 429 to keep accepted requests within their latency targets." },
    { front: "Dual-write problem", track: "res", back: "Updating a database and publishing a message as two separate operations; a failure between them loses or invents events." },
    { front: "Transactional outbox", track: "res", back: "Write the event to an outbox table in the same transaction as the state change, then relay it to the broker at least once." },
    { front: "Kafka partition key", track: "res", back: "Messages with the same key go to the same partition, where order is preserved; use the aggregate id." },
    { front: "Dead-letter topic", track: "res", back: "Where messages go after bounded retries fail, so a poison message does not block its partition." },
    { front: "Idempotent consumer", track: "res", back: "Records processed message ids atomically with the effect, or applies state-setting writes, so redelivery is harmless." },
    { front: "Saga", track: "res", back: "A business process across services run as local transactions, with compensating actions to undo completed steps on failure." },
    { front: "Orchestration vs choreography", track: "res", back: "An orchestrator explicitly drives and tracks saga steps; in choreography services react to each other's events without a coordinator." },
    { front: "SecurityFilterChain", track: "sec", back: "An ordered set of servlet filters selected by FilterChainProxy that authenticates, translates security exceptions and authorizes before the controller runs." },
    { front: "ExceptionTranslationFilter", track: "sec", back: "Turns authentication failures into 401 responses and access-denied failures into 403." },
    { front: "CSRF and bearer tokens", track: "sec", back: "CSRF abuses credentials browsers attach automatically, such as cookies; bearer-only APIs can disable it, cookie-session apps must not." },
    { front: "Resource server", track: "sec", back: "An API that validates access tokens from a trusted authorization server on every request; it never handles user passwords." },
    { front: "SCOPE_ authorities", track: "sec", back: "Spring Security maps each entry of a JWT's scope claim to an authority prefixed SCOPE_, used in hasAuthority checks." },
    { front: "Audience check", track: "sec", back: "Rejecting tokens whose aud does not include this API, so tokens minted for other services cannot be replayed here." },
    { front: "JWKS", track: "sec", back: "The issuer's published set of public keys; decoders cache it and refetch on an unknown kid, which makes key rotation seamless." },
    { front: "Algorithm pinning", track: "sec", back: "The server decides which signing algorithms it accepts; never trust the alg in a token header, and reject none." },
    { front: "Signed, not encrypted", track: "sec", back: "Anyone holding a JWT can read its claims; the signature only prevents changes. Keep secrets and sensitive data out of claims." },
    { front: "Object-level authorization", track: "sec", back: "Checking that the caller may access this specific resource, not just the endpoint; missing it lets callers enumerate others' data." },
    { front: "@PreAuthorize bean expression", track: "sec", back: "@PreAuthorize(\"@orderAccess.canRead(authentication, #id)\") calls domain logic with the caller and arguments before the method runs." },
    { front: "DelegatingPasswordEncoder", track: "sec", back: "Stores an {id} prefix with each hash (bcrypt by default) so password hashing algorithms can be upgraded over time." },
    { front: "Committed secret", track: "sec", back: "Compromised the moment it lands: it stays in history and clones. Rotate first, then clean up." },
    { front: "Arrange-act-assert", track: "test", back: "Structure a test as setup, one action, and assertions about one behaviour." },
    { front: "@ParameterizedTest", track: "test", back: "Runs one test body per row of inputs, such as @CsvSource, reporting each case separately; ideal for boundary tables." },
    { front: "Injected Clock", track: "test", back: "Passing java.time.Clock into code makes time an input, so tests use a fixed instant instead of sleeping." },
    { front: "Stub vs mock", track: "test", back: "A stub supplies canned answers for inputs; a mock records calls so you can verify side effects." },
    { front: "Fake", track: "test", back: "A working lightweight implementation, such as an in-memory repository, often clearer than a mock." },
    { front: "@MockitoBean", track: "test", back: "Replaces a bean in a Spring test context with a Mockito mock; it superseded Boot's @MockBean." },
    { front: "Slice test", track: "test", back: "A test that loads only one layer's part of the context, such as @WebMvcTest or @DataJpaTest, for fast framework-level checks." },
    { front: "Test context cache", track: "test", back: "Spring reuses application contexts with identical configuration across test classes; each unique mix of mocks and properties builds a new one." },
    { front: "@ServiceConnection", track: "test", back: "Derives connection settings, including generated credentials, from a Testcontainers container so no manual properties are needed." },
    { front: "Consumer-driven contract", track: "test", back: "The consumer records what it relies on; the provider's build verifies it, catching breaking changes before deployment." },
    { front: "Mutation score", track: "test", back: "The share of small injected code changes that the tests detect; it measures assertion strength, unlike line coverage." },
    { front: "Equivalent mutant", track: "test", back: "A mutation that does not change observable behaviour, so no test can kill it; review and ignore it." },
    { front: "ArchUnit freeze", track: "test", back: "Records existing violations of a rule so only new violations fail the build, enabling gradual cleanup." },
    { front: "Metric cardinality", track: "prod", back: "The number of distinct tag combinations; unbounded tags such as user or order ids create a series per value and can overwhelm the metrics backend." },
    { front: "RED method", track: "prod", back: "Rate, errors and duration per endpoint: the metrics that describe what callers experience." },
    { front: "Percentile histogram", track: "prod", back: "Exporting latency buckets so percentiles can be computed and aggregated across instances on the server side." },
    { front: "traceparent", track: "prod", back: "The W3C trace-context header carrying trace and span ids between services so a request can be followed end to end." },
    { front: "Structured logging", track: "prod", back: "JSON log lines with fields such as traceId and orderId, built into Spring Boot since 3.4 via logging.structured.format." },
    { front: "Liveness probe", track: "prod", back: "Answers only 'is this process broken beyond repair?'; failure restarts the container, so it must never check shared dependencies." },
    { front: "Readiness probe", track: "prod", back: "Answers 'should this instance receive traffic now?'; failure removes it from load balancing without a restart." },
    { front: "Graceful shutdown", track: "prod", back: "server.shutdown=graceful plus a preStop delay: stop receiving traffic, drain in-flight requests, then exit." },
    { front: "Layered jar", track: "prod", back: "Splits dependencies, loader and application classes into separate image layers so code changes push only a small layer." },
    { front: "CDS archive", track: "prod", back: "Class data sharing archive produced by a training run; reduces JVM startup time and some memory with no code changes." },
    { front: "Closed-world assumption", track: "prod", back: "GraalVM native images include only code proven reachable at build time; dynamic reflection and resources need hints." },
    { front: "RuntimeHints", track: "prod", back: "Spring's API for declaring reflection, resource and proxy needs so they work in a native image." },
    { front: "Error budget", track: "prod", back: "The failure allowance implied by an SLO; spending it slows feature work in favour of reliability." },
    { front: "equals/hashCode contract", track: "java", back: "Equal objects must have equal hash codes; base both on the same immutable fields or hash-based collections lose entries." },
    { front: "Defensive copy", track: "java", back: "Copy mutable inputs (List.copyOf) in constructors so an immutable object cannot be changed through a caller's reference." },
    { front: "Exception translation", track: "java", back: "Catch low-level exceptions at a boundary and rethrow a domain or unchecked exception with the original as the cause." },
    { front: "MDC", track: "java", back: "SLF4J's mapped diagnostic context: per-thread key/values (trace id, tenant) added to every log line; clear it in finally." },
    { front: "Parameterized logging", track: "java", back: "log.info(\"order {} placed\", id) defers string building until the level is enabled and keeps messages groupable." },
    { front: "BOM", track: "java", back: "A bill of materials (such as spring-boot-dependencies) that pins compatible versions, so modules declare dependencies without versions." },
    { front: "Container-aware JVM", track: "jvm", back: "Modern JVMs read cgroup limits for heap sizing and availableProcessors; heap is a share of the limit, not of host RAM." },
    { front: "Native memory budget", track: "jvm", back: "Process RSS = heap + metaspace + thread stacks + code cache + GC structures + direct buffers; size heap at ~70-75% of the limit." },
    { front: "Ergonomic Serial GC", track: "jvm", back: "With under 2 CPUs or under ~1792 MB the JVM picks Serial GC by default; set the collector explicitly for small containers." },
    { front: "Thread starvation", track: "jvm", back: "All pool threads blocked (on a slow dependency or a lock), so requests queue; diagnose with a thread dump showing many identical stacks." },
    { front: "Pool exhaustion", track: "jvm", back: "Connection pool empty: requests wait connectionTimeout then fail; usually long transactions, leaks or a slow query, not a too-small pool." },
    { front: "Load test shape", track: "jvm", back: "Use open-model arrival rates, warm up the JIT, measure p99 against an SLO, and change one variable at a time." },
    { front: "volatile release/acquire", track: "conc", back: "A volatile write publishes every earlier write; a read that sees it observes them all. It does not make count++ atomic." },
    { front: "Final field semantics", track: "conc", back: "After construction, final fields are visible to any thread that sees the reference, as long as this did not escape the constructor." },
    { front: "Double-checked locking", track: "conc", back: "Lazy singleton with an unsynchronized check then a locked check; correct only if the field is volatile. A holder class is simpler." },
    { front: "ScopedValue", track: "conc", back: "Immutable per-scope context bound with ScopedValue.where(...).run(...); unbound automatically and inherited by structured subtasks." },
    { front: "ThreadLocal leak", track: "conc", back: "Values set on pooled threads survive into the next task; always remove() in finally, or prefer ScopedValue for new code." },
    { front: "Structured concurrency", track: "conc", back: "StructuredTaskScope ties forked subtasks to a block: failure cancels siblings and no subtask outlives the scope (preview API)." },
    { front: "@Scheduled on replicas", track: "boot", back: "Each instance runs its own scheduler, so N pods run the job N times unless a distributed lock or external trigger is used." },
    { front: "ShedLock lockAtMostFor", track: "boot", back: "Lock expiry that frees the job if the holder crashes; set it comfortably above the normal run time." },
    { front: "fixedRate vs fixedDelay", track: "boot", back: "fixedRate schedules from each start; fixedDelay waits after each completion, so slow runs never pile up." },
    { front: "Spring Batch chunk", track: "boot", back: "Read N items, process, write N, commit; progress is stored in the JobRepository so failed jobs restart from the last chunk." },
    { front: "Token bucket", track: "api", back: "Capacity allows bursts, refill rate sets the sustained limit; each request spends a token, an empty bucket means 429." },
    { front: "Cluster-wide rate limit", track: "api", back: "Per-pod counters multiply the limit by replica count; share buckets via Redis or enforce at the gateway." },
    { front: "springdoc-openapi", track: "api", back: "Generates /v3/api-docs from controllers and validation annotations; publish the spec from CI and disable or protect it in prod." },
    { front: "Mono vs Flux", track: "api", back: "Reactor publishers of 0..1 and 0..N items; lazy until subscribed, composed with operators like map, flatMap and zip." },
    { front: "Event loop blocking", track: "api", back: "WebFlux serves many connections on few threads; one blocking JDBC call stalls them all. Use reactive drivers or boundedElastic." },
    { front: "Backpressure", track: "api", back: "Subscribers request(n) items so a fast producer cannot overwhelm a slow consumer; demand flows upstream." },
    { front: "DTO projection", track: "data", back: "A record return type on a repository method selects only the needed columns and skips managed entities and dirty checking." },
    { front: "Specification", track: "data", back: "Composable JPA Criteria predicate; combine optional filters with where().and() and values stay bound parameters." },
    { front: "@Modifying query", track: "data", back: "Bulk update or delete JPQL that bypasses the persistence context; clear or reload entities afterwards." },
    { front: "Cache fail-open", track: "data", back: "Short Redis timeouts plus a CacheErrorHandler that logs and falls through, so a cache outage means slower, not failed, requests." },
    { front: "Versioned cache keys", track: "data", back: "A key prefix like svc:v3: lets you invalidate everything on incompatible DTO changes; serialize values as JSON, not JDK bytes." },
    { front: "Cooperative-sticky assignor", track: "res", back: "Incremental rebalancing: only partitions that move are revoked, so most consumers keep working during deploys." },
    { front: "Static membership", track: "res", back: "group.instance.id lets a restarted consumer reclaim its partitions without triggering a rebalance within session.timeout.ms." },
    { front: "Kafka exactly-once", track: "res", back: "Transactional producer commits outputs and consumed offsets atomically; readers use read_committed. Covers Kafka-to-Kafka only." },
    { front: "Consumer lag", track: "res", back: "How far a group trails the log end per partition; the key scaling signal. A hot partition cannot be fixed by adding consumers." },
    { front: "CORS vs CSRF", track: "sec", back: "CORS controls which origins' scripts may read responses; CSRF tokens stop other sites making the browser act with the user's cookies." },
    { front: "Credentialed CORS", track: "sec", back: "allowCredentials requires an explicit origin list; a wildcard or a reflected Origin header is unsafe." },
    { front: "Client credentials grant", track: "sec", back: "A service authenticates as itself to get a scoped, short-lived token for one downstream audience; the secret comes from the secret store." },
    { front: "mTLS", track: "sec", back: "Both sides present certificates, proving workload identity at the connection; usually provided by a mesh or Spring Boot SSL bundles." },
    { front: "Mass assignment", track: "sec", back: "Binding request bodies to entities lets clients set fields like role or tenantId; bind to purpose-built request records instead." },
    { front: "SSRF", track: "sec", back: "Server fetches an attacker-chosen URL; allow-list hosts, block private and metadata addresses, disable redirects, set timeouts." },
    { front: "Sort parameter injection", track: "sec", back: "Identifiers such as ORDER BY columns cannot be bound; map client sort keys through an enum or allow-list." }
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
        el("p", { class: "fc-sub" }, "Flip through key Java, JVM and Spring Boot terms and self-grade each one. Your progress saves locally in this browser.")
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
