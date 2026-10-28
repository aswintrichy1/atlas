/* =====================================================================
   PYXIS · Exam mode + Flashcards
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
  // Quiz ids in Pyxis use these prefixes: lang-, idiom-, types-, pkg-, test-, conc-, perf-, web-, data-, prod-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["lang", "idiom", "types", "pkg", "test", "conc", "perf", "web", "data", "prod"];
  var TRACK_NAMES = {
    lang: "Language & Data Model",
    idiom: "Idioms & Stdlib",
    types: "Typing & Generics",
    pkg: "Packaging & Tooling",
    test: "Testing",
    conc: "Concurrency & asyncio",
    perf: "Profiling & Performance",
    web: "Web Services",
    data: "Data Engineering",
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
  var EXAM_KEY = "py_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "py_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
     Tracks match Pyxis's window.TRACKS ids: lang, idiom, types, pkg, test, conc, perf, web, data, prod.
     ===================================================================== */
  var CARDS = [
    { front: "Names vs objects", track: "lang", back: "A name is a reference bound in a namespace; assignment binds a name to an object and never copies it." },
    { front: "Aliasing", track: "lang", back: "Two names bound to the same mutable object: a mutation through either name is visible through both." },
    { front: "Mutable default argument", track: "lang", back: "Defaults are evaluated once at def time, so def f(x=[]) shares one list across calls; use None and create the list inside." },
    { front: "is vs ==", track: "lang", back: "is compares identity (same object); == calls __eq__ to compare values. Use is only for singletons such as None." },
    { front: "__hash__ and __eq__", track: "lang", back: "Objects that compare equal must have equal hashes; defining __eq__ without __hash__ makes instances unhashable." },
    { front: "LEGB", track: "lang", back: "Name lookup order: Local, Enclosing function, Global (module), Built-ins. Assignment makes a name local unless declared nonlocal or global." },
    { front: "Late-binding closure", track: "lang", back: "A closure looks up captured variables when called, not when created, so lambdas made in a loop all see the final loop value." },
    { front: "Descriptor", track: "lang", back: "An object with __get__ (and optionally __set__/__delete__) stored on a class; property, methods and slots are all built on descriptors." },
    { front: "MRO", track: "lang", back: "Method resolution order: the C3-linearised list of classes Python searches for attributes; super() follows it, not just the direct parent." },
    { front: "Iterable vs iterator", track: "idiom", back: "An iterable returns a fresh iterator from __iter__; an iterator returns itself and yields items from __next__ until StopIteration." },
    { front: "Generator", track: "idiom", back: "A function containing yield; calling it returns a lazy iterator whose body runs only as values are requested." },
    { front: "yield from", track: "idiom", back: "Delegates to a sub-iterator, forwarding values, send() and exceptions, and returns the sub-generator's return value." },
    { front: "Context manager", track: "idiom", back: "An object with __enter__ and __exit__ used by with; __exit__ runs on success and on exceptions, guaranteeing cleanup." },
    { front: "contextlib.contextmanager", track: "idiom", back: "Turns a generator with one yield into a context manager: code before yield is setup, code after (in finally) is cleanup." },
    { front: "defaultdict vs Counter", track: "idiom", back: "defaultdict creates missing values with a factory; Counter counts hashable items and supports most_common and arithmetic." },
    { front: "Aware datetime", track: "idiom", back: "A datetime with tzinfo. Store and compute in UTC with aware values; convert to local zones (zoneinfo) only for display." },
    { front: "Exception chaining", track: "idiom", back: "raise NewError(...) from err records the cause; from None suppresses the context when the original is noise." },
    { front: "ExceptionGroup and except*", track: "idiom", back: "A container for several unrelated exceptions (for example from a TaskGroup); except* handles matching members by type." },
    { front: "Gradual typing", track: "types", back: "Type hints are optional and checked by external tools; unannotated code is treated as Any, so you can adopt typing module by module." },
    { front: "Narrowing", track: "types", back: "A checker refines a union's type after isinstance, is None, equality to a Literal or a TypeIs function, so later code sees the precise type." },
    { front: "TypeIs vs TypeGuard", track: "types", back: "TypeIs narrows in both branches and requires the narrowed type to be consistent with the input; TypeGuard narrows only the true branch." },
    { front: "TypedDict", track: "types", back: "Describes the keys and value types of a plain dict, such as a JSON payload, with Required and NotRequired per key." },
    { front: "@overload", track: "types", back: "Declares several signatures for one function so the return type can depend on argument types or Literal values." },
    { front: "TypeVar with bound", track: "types", back: "A type variable restricted to subtypes of a bound, so a generic function can call the bound's methods and still return the precise subtype." },
    { front: "Variance", track: "types", back: "Whether Box[Cat] is a subtype of Box[Animal]: covariant for read-only containers, contravariant for consumers, invariant for mutable ones like list." },
    { front: "Protocol", track: "types", back: "Structural typing: any class with matching methods satisfies the Protocol without inheriting from it." },
    { front: "PEP 695 syntax", track: "types", back: "def first[T](xs: list[T]) -> T and class Box[T]: declare type parameters inline, replacing explicit TypeVar boilerplate (Python 3.12+)." },
    { front: "Virtual environment", track: "pkg", back: "An isolated directory with its own interpreter link and site-packages, so each project has its own dependency set." },
    { front: "uv", track: "pkg", back: "A fast Rust-based tool that manages Python versions, virtual environments, dependency resolution, lockfiles and running project commands." },
    { front: "Lockfile", track: "pkg", back: "A file recording the exact resolved version, and usually hashes, of every direct and transitive dependency for reproducible installs." },
    { front: "Compatible release ~=", track: "pkg", back: "~=2.3 means >=2.3, ==2.*; libraries should declare ranges, applications pin exact versions through a lock." },
    { front: "pyproject.toml", track: "pkg", back: "The standard project file: [project] metadata and dependencies, [build-system] backend, and [tool.*] settings for Ruff, pytest and others." },
    { front: "Wheel", track: "pkg", back: "A built distribution archive installed by unpacking, with no build step; platform tags say which Pythons and OSes it supports." },
    { front: "sdist", track: "pkg", back: "A source distribution that must be built into a wheel on the installing machine, which may need compilers for extensions." },
    { front: "Ruff", track: "pkg", back: "A fast Rust-based linter and formatter that replaces many separate tools (Flake8 plugins, isort, a Black-compatible formatter)." },
    { front: "Editable install", track: "pkg", back: "Installs a project so its source directory is imported directly, so edits take effect without reinstalling." },
    { front: "Fixture", track: "test", back: "A pytest function providing setup (and teardown after yield) that tests request by naming it as a parameter." },
    { front: "Fixture scope", track: "test", back: "How long a fixture lives: function, class, module, package or session. A wider-scoped fixture cannot depend on a narrower one." },
    { front: "parametrize", track: "test", back: "@pytest.mark.parametrize runs one test function over many input rows, each reported as its own test ID." },
    { front: "Patch where it is looked up", track: "test", back: "mock.patch must target the name in the module that uses it (app.billing.send_email), not where it was defined." },
    { front: "autospec", track: "test", back: "create_autospec or patch(autospec=True) makes a mock enforce the real signature, catching calls the real object would reject." },
    { front: "Property-based testing", track: "test", back: "Hypothesis generates many inputs from strategies and shrinks failures to a minimal example, checking properties instead of single cases." },
    { front: "Contract test", track: "test", back: "Verifies that a provider still satisfies the requests and responses its consumers depend on, without running both together." },
    { front: "Mutation testing", track: "test", back: "Introduces small code changes (mutants) and checks the test suite fails; surviving mutants reveal weak assertions." },
    { front: "Testcontainers", track: "test", back: "Starts real dependencies such as PostgreSQL in disposable containers for integration tests." },
    { front: "GIL", track: "conc", back: "The global interpreter lock in standard CPython: only one thread executes Python bytecode at a time per interpreter; blocking I/O releases it." },
    { front: "Free-threaded build", track: "conc", back: "A CPython build (3.13t/3.14t) without the GIL, so threads can run Python code in parallel; extensions must declare support." },
    { front: "Threads vs processes", track: "conc", back: "Threads suit I/O-bound work and share memory; processes suit CPU-bound pure-Python work but pay for pickling and separate memory." },
    { front: "Executor.map vs submit", track: "conc", back: "map returns results in input order; submit returns futures you can consume with as_completed in finish order." },
    { front: "Event loop", track: "conc", back: "A single-threaded scheduler that runs coroutines until they await, then resumes them when their I/O or timer is ready." },
    { front: "TaskGroup", track: "conc", back: "asyncio.TaskGroup (3.11+) runs child tasks in a structured scope: if one fails, the rest are cancelled and errors are raised as an ExceptionGroup." },
    { front: "Cancellation", track: "conc", back: "Cancelling a task raises CancelledError at its current await; code should clean up in finally and re-raise rather than swallow it." },
    { front: "asyncio.timeout", track: "conc", back: "An async context manager (3.11+) that cancels the enclosed work after a deadline and raises TimeoutError." },
    { front: "Backpressure", track: "conc", back: "Slowing producers when consumers fall behind, for example with a bounded asyncio.Queue(maxsize=...) or a Semaphore." },
    { front: "Amdahl's law", track: "perf", back: "Overall speed-up is limited by the share of time you do not improve; optimise where the time actually goes." },
    { front: "cProfile vs sampling", track: "perf", back: "cProfile records every call with overhead; sampling profilers like py-spy read stacks periodically and can attach to production processes." },
    { front: "Flame graph", track: "perf", back: "Stacks drawn as boxes whose width is share of samples; wide frames without wide children are self time, the first targets." },
    { front: "timeit minimum", track: "perf", back: "For microbenchmarks the fastest repeat best estimates the code's own cost, since interference only adds time." },
    { front: "tracemalloc", track: "perf", back: "Standard-library tracer of Python allocations; diff two snapshots to find which lines grew memory." },
    { front: "__slots__", track: "perf", back: "Declares fixed attributes so instances have no per-instance __dict__, saving memory for many small objects." },
    { front: "Vectorisation", track: "perf", back: "Replacing Python loops with whole-array operations (NumPy, pandas, Polars) so the loop runs in compiled code." },
    { front: "lru_cache on methods", track: "perf", back: "Caching an instance method keeps self alive in the cache keys; cache at module level or use cached_property instead." },
    { front: "When to go native", track: "perf", back: "After profiling shows a CPU-bound hot spot that better algorithms and vectorisation cannot fix: Numba, Cython, mypyc or Rust via PyO3." },
    { front: "WSGI vs ASGI", track: "web", back: "WSGI calls the app once per request synchronously; ASGI is an async event interface that also supports WebSockets and lifespan events." },
    { front: "def vs async def in FastAPI", track: "web", back: "Plain def handlers run in a thread pool; async def handlers run on the event loop and must not block." },
    { front: "Depends with yield", track: "web", back: "A FastAPI dependency whose code before yield sets up a resource and code after yield cleans it up after the response." },
    { front: "dependency_overrides", track: "web", back: "app.dependency_overrides[real] = fake swaps a dependency for tests without changing handler code." },
    { front: "response_model", track: "web", back: "The schema FastAPI uses to validate and filter output, so internal fields never reach clients." },
    { front: "N+1 queries", track: "web", back: "One query for a list plus one per row for a relationship; fix with selectinload or joinedload in SQLAlchemy." },
    { front: "Expand and contract", track: "web", back: "Zero-downtime schema change: add the new shape, migrate data and code, then remove the old shape in a later release." },
    { front: "Pool arithmetic", track: "web", back: "Max connections = pods × workers × (pool_size + max_overflow); it must fit under the database limit with room for deploys." },
    { front: "Liveness vs readiness", track: "web", back: "Liveness says the process should be restarted if failing; readiness says whether to send traffic. Dependencies belong in readiness." },
    { front: "Copy-on-Write (pandas)", track: "data", back: "Derived frames behave like copies and data is copied only when written, ending ambiguous chained assignment." },
    { front: "merge validate=", track: "data", back: "pandas merge option such as many_to_one that raises if key cardinality is not what you expect, catching row explosions." },
    { front: "Polars lazy", track: "data", back: "scan_* plus expressions build a query plan; collect() runs an optimised version with predicate and projection pushdown." },
    { front: "Apache Arrow", track: "data", back: "A columnar in-memory format shared across engines so data can move between pandas, Polars and DuckDB with little copying." },
    { front: "DuckDB", track: "data", back: "An embedded analytical SQL engine that queries Parquet, CSV and DataFrames in-process and spills to disk for larger-than-memory work." },
    { front: "Idempotent pipeline", track: "data", back: "Re-running a step for the same window yields the same final state, typically via partition overwrite or MERGE on a key." },
    { front: "Watermark with overlap", track: "data", back: "Incremental extraction from the last processed timestamp minus a safety window, so late-arriving rows are not missed." },
    { front: "Snowpark DataFrame", track: "data", back: "A lazy DataFrame that compiles to SQL and runs inside Snowflake when an action such as collect() or save_as_table() executes." },
    { front: "Data contract", track: "data", back: "An agreed, code-enforced schema and quality rules at a pipeline boundary, with a decided response: fail, quarantine or warn." },
    { front: "Twelve-factor config", track: "prod", back: "One artefact for every environment; configuration comes from the environment and is validated once at startup." },
    { front: "pydantic-settings", track: "prod", back: "BaseSettings reads typed configuration from environment variables, .env files and secret directories, failing fast on invalid values." },
    { front: "SecretStr", track: "prod", back: "A Pydantic type whose repr and str are masked, so secrets do not leak through logs or error messages; read with get_secret_value()." },
    { front: "Structured logging", track: "prod", back: "Events emitted as key-value data (usually JSON) with consistent fields, so logs can be filtered and aggregated." },
    { front: "contextvars for request IDs", track: "prod", back: "A ContextVar set by middleware follows the request across awaits, letting every log line include the request ID." },
    { front: "Backoff with jitter", track: "prod", back: "Retry transient errors with exponentially growing, randomised delays and a bounded attempt count to avoid synchronised retry storms." },
    { front: "Graceful shutdown", track: "prod", back: "On SIGTERM stop taking new work, finish in-flight work within the grace period, close pools and flush telemetry, then exit." },
    { front: "Multi-stage image", track: "prod", back: "Build dependencies in a builder stage and copy only the virtual environment and app into a slim, non-root runtime image." },
    { front: "Trusted publishing", track: "prod", back: "Publishing to a package index with short-lived OIDC credentials from CI instead of a stored long-lived API token." }
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
        el("p", { class: "fc-sub" }, "Flip through key Python engineering terms and self-grade each one. Your progress saves locally in this browser.")
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
