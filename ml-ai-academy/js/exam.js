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
  // Quiz ids in Synapse use these prefixes: found-, mlsd-, data-, train-, ops-, rank-, resp-, mlcase-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["found", "mlsd", "data", "train", "ops", "rank", "resp", "mlcase"];
  var TRACK_NAMES = {
    found: "ML Foundations",
    mlsd: "ML System Design",
    data: "Data & Features",
    train: "Training at Scale",
    ops: "MLOps",
    rank: "Search, Ranking & Recs",
    resp: "Responsible ML",
    mlcase: "ML Problem Breakdowns",
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
  var EXAM_KEY = "sy_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "sy_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
     Tracks match Synapse's window.TRACKS ids: found, mlsd, data, train, ops, rank, resp, mlcase.
     ===================================================================== */
  var CARDS = [
    /* ---- mlsd · ML System Design ---- */
    { front: "ML objective", track: "mlsd", back: "The measurable quantity a model is trained and tuned against, derived from a business goal. The translation is the hard part: 'grow engagement' is a business goal, 'predict probability of a completed view, subject to a diversity floor' is an ML objective." },
    { front: "Proxy label", track: "mlsd", back: "An observable signal used to stand in for the outcome you actually care about, because the real outcome is unmeasurable or too slow to collect. Every proxy leaks: optimising it hard eventually optimises the gap between proxy and goal." },
    { front: "Two-tower model", track: "mlsd", back: "A retrieval architecture with separate query and item encoders that meet only at a final dot product. Because the item tower is independent of the query, item vectors can be precomputed and indexed — which is exactly why it works for retrieval and not for final ranking." },
    { front: "Approximate nearest neighbour (ANN)", track: "mlsd", back: "An index that trades exact recall for sublinear search over millions of vectors. You accept missing a small fraction of true neighbours in exchange for staying inside a serving latency budget." },
    { front: "Feature store", track: "mlsd", back: "A system that serves the same feature definition to both training and serving. Its real job is preventing training/serving skew — the same named feature computed two different ways in two different code paths." },
    { front: "Training/serving skew", track: "mlsd", back: "A mismatch between how a feature is computed offline and online. It produces a model that scores well offline and underperforms in production, and it is invisible unless you explicitly compare the two computations." },
    { front: "Label leakage", track: "mlsd", back: "A feature that encodes information unavailable at prediction time, usually because it was computed after the outcome. It inflates offline metrics dramatically and collapses on launch." },
    { front: "Point-in-time correctness", track: "mlsd", back: "Building each training row from only the feature values that existed at that row's timestamp. Without it, aggregate features quietly leak the future into the training set." },
    { front: "Retrieval and ranking", track: "mlsd", back: "The two-stage pattern: a cheap model narrows millions of candidates to hundreds, then an expensive model orders those precisely. It exists because you cannot afford the expensive model over the whole corpus." },
    { front: "Cascade re-ranking", track: "mlsd", back: "Adding a third, still more expensive stage over the top few dozen candidates — often applying business policy, diversity, or freshness rules that a pure relevance model will not capture." },
    { front: "Offline vs online metrics", track: "mlsd", back: "Offline metrics score a model against logged data; online metrics measure what happens to users. They disagree often enough that an offline win is a hypothesis, not a result." },
    { front: "PR-AUC vs ROC-AUC", track: "mlsd", back: "With heavy class imbalance, the false-positive rate has an enormous denominator, so thousands of extra false positives barely move ROC-AUC. Precision reacts to them directly, which makes PR-AUC the more honest summary for rare-event problems." },
    { front: "Calibration", track: "mlsd", back: "Whether a predicted probability of 0.3 actually corresponds to a 30% occurrence rate. Ranking quality does not require calibration, but any decision involving a threshold, a bid, or an expected value does." },
    { front: "Guardrail metric", track: "mlsd", back: "A metric an experiment must not harm, even if the primary metric improves. It encodes the constraint that keeps a local win from becoming a product loss." },
    { front: "Position bias", track: "mlsd", back: "Users click higher-ranked items partly because they are higher-ranked. Training naively on click logs therefore teaches the model to reproduce its own past ranking rather than true relevance." },
    { front: "Feedback loop", track: "mlsd", back: "A model's outputs shaping the data used to train its successor. Left unaddressed it narrows the distribution over time, and the system grows confident and wrong in the same direction." },
    { front: "Data drift vs concept drift", track: "mlsd", back: "Data drift is the input distribution moving; concept drift is the relationship between inputs and the label moving. Data drift may be harmless, concept drift always degrades the model." },
    { front: "Shadow deployment", track: "mlsd", back: "Running a new model on live traffic without serving its predictions, to compare against the incumbent under real conditions. It catches latency and skew problems before any user is exposed." },
    { front: "Interference in experiments", track: "mlsd", back: "When treatment and control affect each other, usually by competing for shared supply. The measured lift is then partly cannibalisation and will not survive full rollout." },
    { front: "Embedding", track: "mlsd", back: "A learned dense vector placing similar entities near each other in a geometry your system can search. Its usefulness depends entirely on what similarity the training objective actually taught it." },
    { front: "Cold start", track: "mlsd", back: "Having no interaction history for a new user or item. Content features and exploration are the standard answers; a pure collaborative model has nothing to say." },
    { front: "Inference budget", track: "mlsd", back: "The latency and cost envelope a model must fit at serving time. It constrains model size, feature freshness and candidate count more often than accuracy targets do." },

    /* ---- mlcase · ML Problem Breakdowns ---- */
    { front: "Objective ladder (Naive → Standout)", track: "mlcase", back: "A way to grade framings rather than memorise one answer. For harmful content: 'maximise removals' (naive) → 'maximise accuracy' (naive) → 'maximise removal subject to a precision floor' (solid) → 'minimise views of harmful content subject to guardrails' (standout)." },
    { front: "Watch time as an objective", track: "mlcase", back: "Better than raw clicks, but it systematically favours long videos and under-rewards short content that fully satisfied the viewer. Most production systems combine it with completion rate and explicit signals." },
    { front: "Multi-task ranking head", track: "mlcase", back: "Predicting several actions (click, complete, share, hide) and combining them into one score. The combining weights are product policy, not a learned parameter — you set them deliberately and validate them online." },
    { front: "Precision floor", track: "mlcase", back: "A minimum precision an automated action must clear before it is taken without human review. It converts an abstract accuracy target into an enforceable operating point." },
    { front: "Human-in-the-loop review queue", track: "mlcase", back: "Routing uncertain cases to human reviewers instead of acting automatically. Queue capacity is a hard constraint that should shape the model's operating threshold, not an afterthought." },
    { front: "Adversarial drift", track: "mlcase", back: "Distribution shift caused by an adversary responding to your defence. Unlike ordinary drift it is deliberate and fast, so retraining cadence becomes a security property." },
    { front: "Bot detection label problem", track: "mlcase", back: "Ground truth is scarce, delayed and biased toward the bots you already catch. Evaluation must account for the fact that undetected bots are absent from your positive labels." },
    { front: "Two-sided marketplace effects", track: "mlcase", back: "Ranking changes move supply as well as demand. An experiment that improves one side by taking supply from the other reports a lift that disappears at full rollout." },
    { front: "Retrieval-augmented generation (RAG)", track: "mlcase", back: "Grounding a generative model in retrieved documents so answers cite real sources. Most production failures are retrieval failures, not generation failures — the model faithfully summarises the wrong passage." },
    { front: "Chunking strategy", track: "mlcase", back: "How documents are split before embedding. Chunks too large dilute the embedding and retrieve loosely; too small and they lose the context needed to answer. It is one of the highest-leverage knobs in a RAG system." },
    { front: "Hallucination guardrail", track: "mlcase", back: "A check that a generated claim is supported by retrieved context — via citation coverage, an entailment check, or abstention when support is weak. Abstaining is a valid product behaviour." },
    { front: "How this scores at each level", track: "mlcase", back: "Mid executes a sensible design. Senior anticipates the operational failures. Staff decides which system deserves to be built at all, and says out loud what it will not build." },

    /* ---- found · ML Foundations ---- */
    { front: "Precision vs recall", track: "found", back: "Precision is the share of flagged items that are truly positive, TP / (TP + FP). Recall is the share of real positives you caught, TP / (TP + FN). Raising the threshold usually trades recall for precision." },
    { front: "Cost-based threshold", track: "found", back: "With calibrated probabilities, flag when p > C_FP / (C_FP + C_FN). If a miss costs 100x a false alarm, the threshold drops to about 0.01." },
    { front: "ROC-AUC meaning", track: "found", back: "The probability that a randomly chosen positive scores above a randomly chosen negative. It is threshold-free and does not change with the base rate." },
    { front: "Why PR for rare events", track: "found", back: "Precision mixes both classes, so it collapses as positives get rarer even when the ROC curve is unchanged. PR-AUC and precision at a target recall show the real false-alarm burden." },
    { front: "NDCG", track: "found", back: "Discounted cumulative gain of a ranked list, with gain 2^rel - 1 and discount 1 / log2(rank + 1), divided by the gain of the ideal ordering. 1.0 means the list is perfectly ordered." },
    { front: "Calibration vs discrimination", track: "found", back: "Discrimination is whether positives are ranked above negatives (AUC). Calibration is whether a score of p means probability p (reliability diagram, ECE). Monotone recalibration fixes the second without touching the first." },
    { front: "A/B sample size rule of thumb", track: "found", back: "Users per arm is about 16 x variance / delta^2 for 80% power at alpha 0.05 two-sided. For a conversion rate p, variance is p(1 - p); halving the detectable effect quadruples the sample." },
    { front: "Sample ratio mismatch", track: "found", back: "Observed arm sizes that differ from the designed split by more than chance allows. It signals an assignment or logging bug that likely biases every metric, so debug it before reading results." },
    { front: "CUPED", track: "found", back: "Variance reduction that subtracts the part of the outcome predicted by each user's pre-experiment value of the metric. Variance shrinks by a factor of 1 - rho^2 with no bias." },
    { front: "Team-draft interleaving", track: "found", back: "Two rankers take turns, in coin-flip order, adding their best unpicked result to one merged list; clicks are credited to the contributing ranker. Within-user comparison makes it far more sensitive than an A/B test for ranking changes." },

    /* ---- data · Data & Features ---- */
    { front: "Cohen's kappa", track: "data", back: "Agreement between two annotators after subtracting the agreement expected by chance: (p_observed - p_chance) / (1 - p_chance). On imbalanced tasks it is far lower than raw percent agreement." },
    { front: "Proxy label", track: "data", back: "An early-arriving signal that correlates with the real outcome, such as a 14-day dispute standing in for a 90-day chargeback. It buys freshness; you must keep checking that it still tracks the outcome." },
    { front: "Labelling function", track: "data", back: "A small rule that votes on an example or abstains. A label model combines many noisy, overlapping functions into a probabilistic label, weighting each by its estimated accuracy." },
    { front: "Negative downsampling correction", track: "data", back: "After keeping a fraction w of negatives, the model's outputs are inflated. Recover the true probability with p = p' / (p' + (1 - p') / w)." },
    { front: "Focal loss", track: "data", back: "Cross-entropy multiplied by (1 - p_t)^gamma, so examples the model already gets right contribute almost nothing and the gradient concentrates on hard cases." },
    { front: "Availability timestamp", track: "data", back: "The moment a feature value became readable by the serving path. As-of joins should compare this, not the feature's logical date, against the decision time." },
    { front: "As-of join", track: "data", back: "For each training event, attach the most recent feature value whose availability time is at or before the decision time, so history only sees what was knowable then." },
    { front: "Quarantine (data validation)", track: "data", back: "Setting a failing batch aside while consumers keep using the last good snapshot. Preferred over a hard fail for distribution shifts that might be real changes in the world." },
    { front: "Feature TTL", track: "data", back: "How long a stored feature value is served before it is treated as missing. It must be applied identically in the online store and in training-time retrieval." },
    { front: "Re-index problem", track: "data", back: "Embeddings from different model versions live in incompatible spaces, so upgrading the embedding model means re-embedding every item, rebuilding the index, and cutting queries and items over together." },

    /* ---- train · Training at Scale ---- */
    { front: "Ring all-reduce cost", track: "train", back: "Each of N GPUs sends about 2(N-1)/N times the gradient size per step — a reduce-scatter then an all-gather. The traffic per GPU is nearly constant as N grows, which is why data parallelism scales well on bandwidth." },
    { front: "Effective batch size", track: "train", back: "Micro-batch per GPU times number of GPUs times gradient-accumulation steps. Growing it usually calls for a larger learning rate with a warmup ramp, confirmed on validation." },
    { front: "Sharded optimizer states", track: "train", back: "Each data-parallel worker stores and updates only a slice of the optimizer state (and optionally gradients and parameters) instead of a full copy. Memory per GPU falls by roughly N for about the same communication." },
    { front: "Pipeline bubble", track: "train", back: "The idle fraction when a model is split into p sequential stages and fed m micro-batches, about (p-1)/(m+p-1). More micro-batches shrink it, but each keeps activations alive, so memory caps m." },
    { front: "Embedding-table sharding", track: "train", back: "Splitting huge recommender embedding tables across GPUs by table, row or column, exchanging looked-up vectors with an all-to-all, while the small dense network stays data-parallel." },
    { front: "16 bytes per parameter", track: "train", back: "Rough training-state memory for Adam in mixed precision: 2 for half-precision weights, 2 for gradients, 4 for full-precision master weights and 8 for the two moments. Activations come on top." },
    { front: "6 × params × tokens", track: "train", back: "Approximate training FLOPs for a dense network: about 2 per parameter per token forward and 4 backward. Divide by peak throughput times utilisation to get GPU-seconds." },
    { front: "Successive halving", track: "train", back: "Start many configurations with a small budget, keep the best fraction at each rung and give survivors more budget. Cheap when early rank predicts final rank; risky for slow starters." },
    { front: "Gradient checkpointing", track: "train", back: "Keep activations only at a few layer boundaries and recompute the rest during backward. Trades roughly one extra forward pass for a large cut in activation memory." },
    { front: "Seed noise band", track: "train", back: "The spread of a metric across reruns of the same config with different seeds. A change has to clear this band before it counts as a real improvement." },

    /* ---- ops · MLOps ---- */
    { front: "Model registry", track: "ops", back: "The system of record for trained models: immutable numbered versions with their data snapshot, code commit, environment, evaluation results and owner. Stages and aliases are pointers into that history." },
    { front: "Rollback by pointer", track: "ops", back: "Serving loads whatever version a production alias points at, so rolling back means moving the alias to the previous immutable version. Seconds instead of a rebuild and redeploy." },
    { front: "Quality gate with tolerance", track: "ops", back: "A CI check that a candidate model is no worse than the production baseline by more than a measured noise margin on a frozen eval set, plus per-slice checks so an aggregate win cannot hide a slice regression." },
    { front: "Behavioural tests", track: "ops", back: "Crafted-input checks on a model: invariance (irrelevant changes should not move the score), directional expectations (relevant changes move it the right way) and minimum-functionality cases." },
    { front: "Shadow deployment", track: "ops", back: "A challenger scores a copy of live traffic and its outputs are discarded. It reveals latency, errors and disagreement with the champion, but nothing about how users would respond." },
    { front: "Dynamic batching", track: "ops", back: "A model server holds requests for up to a maximum wait and runs them together, raising accelerator throughput at the cost of up to that wait in added per-request latency." },
    { front: "Population Stability Index", track: "ops", back: "A drift score over fixed bins: sum of (a - e) * ln(a / e) for current share a and reference share e. Common bands: below 0.1 none, 0.1 to 0.25 moderate, above 0.25 major." },
    { front: "Concept drift", track: "ops", back: "A change in the relationship between inputs and the label, P(y|x). Input monitors can stay green while it happens; only labels or label proxies reveal it." },
    { front: "Decay curve", track: "ops", back: "The quality of one frozen model evaluated on successive future windows. Its slope tells you how fast the model goes stale and therefore how often retraining is worth its cost." },
    { front: "Champion / challenger", track: "ops", back: "The production model is the champion; each retrain is a challenger that must beat it on the same frozen yardstick and survive a rollout before the production alias moves." },

    /* ---- rank · Search, Ranking & Recs ---- */
    { front: "Ranking funnel", track: "rank", back: "A sequence of stages — retrieval, light ranker, heavy ranker, re-rank — each more expensive per item and each scoring far fewer items, so the most accurate model only pays for plausible candidates." },
    { front: "End-to-end recall", track: "rank", back: "The product of every stage's recall, because an item reaches the page only if each stage keeps it. Four stages at 0.95 give about 0.81, not 0.95." },
    { front: "In-batch negatives", track: "rank", back: "Training a two-tower model by treating each other pair's positive item in the batch as a negative, turning every batch into a cheap B-way softmax." },
    { front: "logQ correction", track: "rank", back: "Subtracting the log of an item's sampling probability from its logit during in-batch training, so popular items are not punished just for appearing as negatives more often." },
    { front: "nprobe and efSearch", track: "rank", back: "Query-time dials on IVF and graph indexes. Raising either scans more of the index, which raises recall and latency without changing memory or forcing a rebuild." },
    { front: "Product quantization", track: "rank", back: "Compressing each vector into one-byte codes for its sub-vectors, cutting memory by around 30× at the cost of approximate distances that usually need a re-scoring pass." },
    { front: "Value model", track: "rank", back: "An explicit weighted sum of calibrated outcome predictions — click, like, hide, watch time — used to rank. The weights are exchange rates between outcomes and are tuned online." },
    { front: "Maximal marginal relevance", track: "rank", back: "A greedy list builder that scores λ·relevance minus (1−λ)·similarity to items already chosen, trading a little relevance for a less redundant page." },
    { front: "Thompson sampling", track: "rank", back: "A bandit policy that draws a plausible reward rate for each arm from its posterior and serves the highest draw, so exploration fades as evidence accumulates." },
    { front: "Gini of exposure", track: "rank", back: "The inequality of impressions across items or creators: 0 means equal exposure, values near 1 mean a few get almost everything. A guardrail against popularity feedback loops." },

    /* ---- resp · Responsible ML ---- */
    { front: "Demographic parity", track: "resp", back: "Each group receives the positive decision at the same rate, regardless of labels. It ignores qualification entirely, which is either its flaw or its point depending on whether you trust the labels." },
    { front: "Equal opportunity", track: "resp", back: "Equal true positive rates across groups: qualified people in every group are approved at the same rate. The natural choice when missing out on a benefit is the harm." },
    { front: "Equalized odds", track: "resp", back: "Equal true positive rates and equal false positive rates across groups. Stricter than equal opportunity because it also protects the unqualified from unequal false alarms." },
    { front: "Predictive parity", track: "resp", back: "Equal precision across groups, so a positive decision means the same thing for everyone. Closely tied to calibration within groups at a fixed threshold." },
    { front: "The fairness impossibility result", track: "resp", back: "When base rates differ and the classifier is imperfect, equal TPR, equal FPR and equal precision cannot all hold at once. You choose which gap to close from the harm and report the others." },
    { front: "Reweighing", track: "resp", back: "A pre-processing mitigation that weights each (group, label) cell by P(group) x P(label) / P(group, label), so group and label look independent in the weighted training data." },
    { front: "Shapley additivity", track: "resp", back: "The base value (average prediction over a background set) plus the sum of every feature's Shapley contribution equals the model's prediction for that row exactly." },
    { front: "Permutation importance", track: "resp", back: "The drop in a held-out metric when one feature's column is shuffled. Model-agnostic and far less flattering to high-cardinality noise than impurity importance, but it under-credits correlated twins." },
    { front: "Epsilon in differential privacy", track: "resp", back: "The privacy-loss parameter: smaller epsilon means any one person's presence changes the output distribution less. For a count, noise scale is sensitivity divided by epsilon, so a tenfold smaller epsilon means tenfold more noise." },
    { front: "Automation bias", track: "resp", back: "The tendency of human reviewers to accept a model's recommendation, especially under time pressure. Measured with seeded known-answer cases, not with agreement rates." },

    /* ---- mlcase · ML Problem Breakdowns ---- */
    { front: "Reciprocity (people-you-may-know)", track: "mlcase", back: "A connection suggestion only succeeds if both people want it, so the score multiplies the sender's p(send) by the recipient's p(accept) and weights by the chance the new connection is actually used." },
    { front: "Adamic-Adar weighting", track: "mlcase", back: "A friends-of-friends score that adds 1 / log(degree) for each mutual connection, so a mutual who knows everyone counts for less than one with a small, tight network." },
    { front: "Uplift (incremental) modelling", track: "mlcase", back: "Predicting the difference in outcome between treating and not treating someone, for example engagement if a notification is sent minus engagement if it is not. It needs randomised treatment data to learn." },
    { front: "Sure things versus persuadables", track: "mlcase", back: "Sure things engage whether or not you notify them; persuadables engage only if you do. A response model ranks sure things highest, while only persuadables create incremental value." },
    { front: "Selection-biased fraud labels", track: "mlcase", back: "Chargebacks only arrive for transactions that were approved, so whatever the old model declined has no label. A small, amount-capped random-approve slice is the clean way to see that blind spot." },
    { front: "Expected-cost decisioning", track: "mlcase", back: "Choosing approve, step-up, review, or decline by comparing expected currency cost: fraud loss is p times amount plus fees, while a false decline costs margin and customer value. Break-even probability falls as amount rises." },
    { front: "Keystrokes saved (autocomplete)", track: "mlcase", back: "The characters a user would not have needed to type if they had picked the suggestion matching the query they finally submitted. It measures autocomplete against the user's actual intent." },
    { front: "Pinball (quantile) loss", track: "mlcase", back: "An asymmetric loss whose minimiser is the tau quantile. If being late costs c_late per unit and early costs c_early, the cost-optimal promise is the quantile tau = c_late / (c_late + c_early)." },
    { front: "WAPE", track: "mlcase", back: "Weighted absolute percentage error: total absolute error divided by total actual volume. Unlike MAPE it stays defined on zero-sales days and weights series by how much they sell." },
    { front: "Censored demand", track: "mlcase", back: "When stock runs out, recorded sales understate true demand. Training on those days drags forecasts down, which shrinks orders and causes more stockouts, so they must be masked or imputed." }
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
        el("p", { class: "fc-sub" }, "Flip through key ML system-design terms and self-grade each one. Your progress saves locally in this browser.")
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
