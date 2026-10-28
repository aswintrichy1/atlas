/* =====================================================================
   CHISEL · Exam mode + Flashcards
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
  // Quiz ids in Chisel use these prefixes: clean-, refac-, test-, review-, git-, design-, docs-, ai-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["clean", "refac", "test", "review", "git", "design", "docs", "ai"];
  var TRACK_NAMES = {
    clean: "Clean Code",
    refac: "Refactoring & Legacy Code",
    test: "Testing Strategy",
    review: "Code Review",
    git: "Advanced Git",
    design: "Design in the Small",
    docs: "Documentation & Communication",
    ai: "Working with AI Coding Agents"
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
  var EXAM_KEY = "ch_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "ch_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
      var host = window.Academy || window.Chisel;
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
     Tracks match Chisel's window.TRACKS ids.
     ===================================================================== */
  var CARDS = [
    // clean
    { front: "Intention-revealing name", track: "clean", back: "A name that tells the reader why something exists and how it is used, so no comment is needed: elapsedDays instead of d." },
    { front: "Command-query separation", track: "clean", back: "A function either changes state (command) or returns information (query), not both. Mixed functions surprise callers." },
    { front: "A comment that earns its place", track: "clean", back: "Explains why: a constraint, a trade-off, a workaround with a ticket. Comments that restate the code rot and mislead." },
    { front: "Fail fast", track: "clean", back: "Detect invalid input or state at the boundary and stop with a clear error, instead of carrying bad data deeper where failures are confusing." },
    { front: "Result type vs exception", track: "clean", back: "Return a result for expected, recoverable outcomes the caller must handle; throw for truly exceptional failures the caller cannot reasonably handle locally." },
    { front: "Immutability benefit", track: "clean", back: "Values that cannot change can be shared safely, reasoned about locally and used as keys; mutation is confined to a few explicit places." },
    { front: "Cohesion vs coupling", track: "clean", back: "Cohesion: how strongly a module's parts belong together (want high). Coupling: how much modules depend on each other's details (want low)." },
    { front: "Deep module", track: "clean", back: "A module with a small, simple interface that hides a lot of complexity. Shallow modules expose nearly as much as they implement." },
    // refac
    { front: "Refactoring", track: "refac", back: "Changing code structure without changing observable behaviour, in small steps that keep tests green." },
    { front: "Make the change easy, then make the easy change", track: "refac", back: "First refactor so the new feature fits naturally (separate commit), then add the feature as a small change." },
    { front: "Parallel change", track: "refac", back: "Expand (add new form), migrate (move callers), contract (remove old form) \u2014 in separate deploys so nothing breaks." },
    { front: "Legacy code (working definition)", track: "refac", back: "Code you need to change that has no tests to tell you whether you broke it \u2014 regardless of its age." },
    { front: "Seam", track: "refac", back: "A place where you can change behaviour without editing code there, e.g. a constructor parameter or interface, so tests can substitute collaborators." },
    { front: "Sprout vs wrap", track: "refac", back: "Sprout: write new logic as a new tested unit and call it from the old code. Wrap: rename the old method and add behaviour around it in a new one." },
    { front: "Characterization test", track: "refac", back: "A test that pins what code currently does, even if it looks wrong, as a safety net for refactoring." },
    { front: "Strangler fig", track: "refac", back: "Put a facade in front of a legacy system and move capabilities to the new system one at a time until the old one can be deleted." },
    { front: "Branch by abstraction", track: "refac", back: "Introduce an abstraction over a component, build the replacement behind it on main, switch over, then remove the old one." },
    // test
    { front: "Test pyramid", track: "test", back: "Many fast unit tests, fewer integration tests, a thin layer of end-to-end tests." },
    { front: "Testing trophy", track: "test", back: "Static analysis at the base, with the largest share in integration tests, fewer unit tests and a thin E2E top." },
    { front: "Ice-cream cone", track: "test", back: "Anti-pattern: mostly slow, flaky UI/E2E tests with few fast tests underneath." },
    { front: "Contract test", track: "test", back: "Checks a provider still honours the requests and responses its consumers rely on, without deploying both together." },
    { front: "Red, green, refactor", track: "test", back: "TDD loop: write a failing test, make it pass simply, then improve design while staying green." },
    { front: "Stub vs mock", track: "test", back: "A stub returns canned answers to queries; a mock carries expectations about calls and verifies them itself." },
    { front: "Fake", track: "test", back: "A working lightweight implementation, such as an in-memory repository, used in place of real infrastructure." },
    { front: "Main causes of flaky tests", track: "test", back: "Fixed sleeps, real clocks and time zones, shared state and ordering, unseeded randomness, real network calls." },
    { front: "Property-based test", track: "test", back: "Asserts an invariant for many generated inputs and shrinks failures to a minimal counterexample." },
    { front: "Mutation testing", track: "test", back: "Inject small bugs (mutants) and check the tests fail; surviving mutants reveal weak or missing assertions." },
    { front: "Testing a SQL transformation", track: "test", back: "Seed a tiny fixture with nasty cases (NULLs, duplicates, orphans), run the query, assert the exact output rows." },
    // review
    { front: "Main value of code review", track: "review", back: "Shared understanding plus catching design, correctness and risk problems that tests and tools miss." },
    { front: "PR reading order", track: "review", back: "Intent (description), shape (files), tests, design and correctness, risk, then readability." },
    { front: "Comment labels", track: "review", back: "blocking, question, suggestion, nit, praise \u2014 so authors can triage instantly." },
    { front: "Why small PRs", track: "review", back: "Reviewers can hold the whole change in their head, so thoroughness stays high, waits are short and rollbacks are easy." },
    { front: "Stacked PRs", track: "review", back: "A chain of small dependent PRs, each reviewed on its own, building toward a larger change." },
    { front: "What to automate in review", track: "review", back: "Formatting, lint, types, secret scanning, dependency checks and reviewer routing (CODEOWNERS)." },
    { front: "Cycle-time killer in review", track: "review", back: "Waiting for a first response. Fix with a response-time norm and reviewing before starting new work." },
    // git
    { front: "What is a branch?", track: "git", back: "A movable pointer (ref) to a commit. Creating one writes a tiny file." },
    { front: "Merge vs rebase", track: "git", back: "Merge joins histories with a two-parent commit and rewrites nothing. Rebase replays commits on a new base as new commits with new hashes." },
    { front: "Golden rule of rebasing", track: "git", back: "Do not rewrite history others have pulled. Rebase only private or coordinated branches." },
    { front: "--force-with-lease", track: "git", back: "Force push that refuses if the remote moved since your last fetch, so you cannot silently overwrite a teammate's commits." },
    { front: "fixup + autosquash", track: "git", back: "git commit --fixup=<hash> then git rebase -i --autosquash folds the fix into the target commit automatically." },
    { front: "git bisect", track: "git", back: "Binary search between a good and a bad commit; about log2(n) steps; git bisect run automates it with a script's exit code." },
    { front: "git reflog", track: "git", back: "Local journal of where HEAD and branches pointed; recovers commits lost to reset, rebase or branch deletion." },
    { front: "Worktree", track: "git", back: "An extra working directory attached to the same repository, so several branches can be checked out at once." },
    { front: "Cherry-pick", track: "git", back: "Apply one commit's change as a new commit on the current branch; use -x for provenance, mainly for backports." },
    { front: "Conventional Commits", track: "git", back: "type(scope): subject \u2014 feat, fix, refactor\u2026; '!' or BREAKING CHANGE footer marks a major change; tools derive versions and changelogs." },
    { front: "Submodule", track: "git", back: "A pointer from a parent repo to an exact commit of another repo; updating it requires a deliberate commit in the parent." },
    // design
    { front: "Single responsibility (nuanced)", track: "design", back: "A module should have one reason to change \u2014 one stakeholder or concern driving its edits." },
    { front: "Open-closed (when it pays)", track: "design", back: "Add extension points along an axis that actually keeps varying, such as payment methods; not speculatively." },
    { front: "Liskov violation", track: "design", back: "A subtype that weakens the base contract, e.g. throwing 'not supported' for a method callers rely on." },
    { front: "Dependency inversion", track: "design", back: "High-level policy defines the abstractions it needs; low-level details implement them." },
    { front: "Composition over inheritance", track: "design", back: "Build behaviour by combining small objects behind interfaces instead of deep subclass chains coupled to parent internals." },
    { front: "Composition root", track: "design", back: "The single place near the entry point where concrete dependencies are created and wired together." },
    { front: "Functional core, imperative shell", track: "design", back: "Pure decision logic in the core (values in, values out); I/O, time and side effects in a thin shell." },
    { front: "Make illegal states unrepresentable", track: "design", back: "Shape data so invalid combinations cannot be built: one variant per state, self-validating value objects, parse at the boundary." },
    { front: "Rule of three", track: "design", back: "Tolerate duplication the second time; extract an abstraction the third time, when you can see what really varies." },
    // docs
    { front: "Four kinds of docs", track: "docs", back: "Tutorials (learning), how-to guides (tasks), reference (lookup), explanation (understanding)." },
    { front: "README essentials", track: "docs", back: "What it is and for whom, quick start with exact commands, how it fits, how to operate it, who owns it." },
    { front: "ADR sections", track: "docs", back: "Title, status, context, decision, alternatives, consequences (including costs and when to revisit)." },
    { front: "Superseding an ADR", track: "docs", back: "Write a new ADR and mark the old one 'Superseded by ADR-n' instead of editing it." },
    { front: "Design doc purpose", track: "docs", back: "Surface disagreement before building, while changing course costs an edit, not a rewrite; end with a decision." },
    { front: "Diagrams as code", track: "docs", back: "Text-defined diagrams in the repo, reviewed in the same PR as the code, so they stay current." },
    { front: "Bottom line up front", track: "docs", back: "Put the conclusion, decision or ask in the first sentence; detail follows for those who need it." },
    // ai
    { front: "Mental model of a coding agent", track: "ai", back: "A fast collaborator that produces plausible drafts; you own specification and verification." },
    { front: "What goes in AGENTS.md", track: "ai", back: "Build and test commands, architecture boundaries, conventions with examples, hard 'never' rules \u2014 never secrets." },
    { front: "Parts of a task prompt", track: "ai", back: "Goal and why, where to look, constraints, out of scope, definition of done, and a request for evidence." },
    { front: "Sizing agent tasks", track: "ai", back: "Size to your review capacity: a diff you can review carefully in one sitting; plan first." },
    { front: "Common AI code failure modes", track: "ai", back: "Invented APIs, swallowed errors, weakened or skipped tests, scope creep, confident wrong summaries, security shortcuts." },
    { front: "Evidence over assurance", track: "ai", back: "Run the tests and the changed path yourself, read the whole diff tests-first, never merge a line you cannot explain." },
    { front: "Accountability for AI code", track: "ai", back: "The engineer who merges owns it, exactly as for hand-written code." },
    // pass 2 additions
    { front: "Defend at the edges, assert in the middle", track: "clean", back: "Validate and parse untrusted input once at trust boundaries; inside, assert invariants and crash loudly if they break." },
    { front: "Timeouts rule", track: "clean", back: "Every network call gets a timeout; retries get a limit, backoff and an idempotency key." },
    { front: "Structured logging", track: "clean", back: "Stable event name plus key-value fields (ids, counts, error type) \u2014 searchable, aggregatable, and free of secrets and personal data." },
    { front: "Correlation id", track: "clean", back: "An id propagated through every service and log line for one request, so it can be traced end to end." },
    { front: "Config at startup", track: "clean", back: "Parse configuration into a typed object at boot and refuse to start if a required value is missing or invalid." },
    { front: "Four kinds of feature flag", track: "clean", back: "Release (short-lived), experiment, ops / kill switch, permission. Release flags need an owner and a removal date." },
    { front: "Measure before optimising", track: "clean", back: "Reproduce with a number, profile to find where time goes, fix the biggest cost, measure again." },
    { front: "Read-modify-write race", track: "clean", back: "Two actors read the same value and both write back, losing an update. Fix with atomic or conditional updates, locks or compare-and-set." },
    { front: "Check-then-act", track: "clean", back: "'If not exists, create' run concurrently creates duplicates. Use a unique constraint or an upsert." },
    { front: "Backward-compatible API change", track: "design", back: "Adding optional fields, parameters or endpoints. Removing, renaming, retyping or tightening requirements breaks callers." },
    { front: "Deprecation process", track: "design", back: "Ship the replacement, announce with runtime signals (warnings, Deprecation/Sunset headers), measure usage, remove after the date." },
    { front: "Semver MAJOR.MINOR.PATCH", track: "design", back: "Major: breaking change. Minor: compatible feature. Patch: compatible fix. 0.y.z promises nothing." },
    { front: "Lockfile", track: "design", back: "Records the exact resolved dependency tree so every install is reproducible; commit it for applications." },
    { front: "dbt-style schema tests", track: "test", back: "Declarative tests next to a model: not_null, unique, accepted_values, relationships \u2014 run on every build." },
    { front: "Snapshot test risk", track: "test", back: "Large snapshots get updated without reading. Keep them small, deterministic and reviewed like code." },
    { front: "Consumer-driven contract", track: "test", back: "The consumer records the interactions it relies on; the provider verifies them in its CI; a broker gates deploys ('can I deploy?')." },
    { front: "Trunk-based development", track: "git", back: "Everyone integrates small changes into main at least daily; unfinished work hides behind flags; main stays releasable." },
    { front: "pre-commit vs CI", track: "git", back: "Hooks give fast local feedback but can be skipped; CI and branch protection are the real enforcement." },
    { front: "Affected-only builds", track: "git", back: "In a monorepo, build and test only changed projects and their dependants, with remote caching." },
    { front: "CODEOWNERS", track: "review", back: "Maps repo paths to owning teams; requests their review automatically and, with branch protection, requires it." },
    { front: "Bus factor", track: "review", back: "How many people could leave before nobody understands a component. Raise it with pairing, rotation and review." },
    { front: "Pairing styles", track: "review", back: "Driver-navigator, ping-pong (TDD), strong-style (ideas through the other's hands); mob/ensemble for the whole team." },
    { front: "Three-point estimate", track: "docs", back: "Optimistic, most likely, pessimistic; expected \u2248 (O + 4M + P) / 6. Communicate the range and the main risk." },
    { front: "Technical debt interest", track: "docs", back: "The extra cost paid on every change until the debt is fixed. Argue for paydown in interest, not aesthetics." },
    { front: "Rules vs skills", track: "ai", back: "Rules: always-on project context. Skills: packaged procedures loaded when a matching task appears." },
    { front: "Agent verification loop", track: "ai", back: "Give the agent fast objective checks (tests, types, lint, scripts) to run and iterate against \u2014 not 'are you sure?'." },
    { front: "Over-reliance warning sign", track: "ai", back: "Merging code you cannot explain, or being unable to debug the area without the agent. Delegate typing, not understanding." }
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
