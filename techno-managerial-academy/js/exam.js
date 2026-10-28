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
  // Quiz ids in TechLead use these prefixes: hld-, lld-, data-, people-, strategy-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["hld", "lld", "data", "people", "strategy"];
  var TRACK_NAMES = {
    hld: "HLD Leadership",
    lld: "LLD Leadership",
    data: "Data Engineering Leadership",
    people: "People and Org Leadership",
    strategy: "Strategy and Execution",
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
  var EXAM_KEY = "tm_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "tm_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
     Tracks match TechLead's window.TRACKS ids: hld, lld, data.
     ===================================================================== */
  var CARDS = [
    /* ---- hld · HLD Leadership ---- */
    { front: "Architecture driver", track: "hld", back: "A business goal restated as a constraint a design can be measured against. \u201cEnterprise ready\u201d is not a driver; \u201ctenant-isolated, audit-logged, and recoverable within four hours\u201d is. Producing drivers from goals is the first thing this round tests." },
    { front: "One-way door", track: "hld", back: "A decision that cannot be reversed without material cost \u2014 data migrations, public API contracts, vendor commitments, anything customers build against. It earns more evidence and earlier escalation than a reversible choice, and confusing the two is how teams over-govern trivia and under-govern the things that bite." },
    { front: "Decision trigger", track: "hld", back: "A measurable condition agreed in advance that changes the plan: a p99 ceiling, a mismatch rate, a cost cap, a defect trend. It converts \u201cwe\u2019ll see how it goes\u201d into a commitment, and it is what lets you hold a risky plan without being reckless." },
    { front: "ADR", track: "hld", back: "Architecture Decision Record: context, the decision, the options rejected and why, the consequences, the owner, and the trigger that would reopen it. Its value is not documentation \u2014 it is that the argument stops being re-litigated by whoever is loudest this quarter." },
    { front: "Cost per journey", track: "hld", back: "Infrastructure spend attributed to a user-visible action rather than to a monthly invoice. The bill tells you the total; cost per journey tells you which feature to fix, and it is the number that makes a cost conversation actionable instead of a blanket cut." },
    { front: "Executive altitude", track: "hld", back: "Leading with outcome, impact, options, recommendation, and the explicit ask \u2014 mechanism only on request. The same design needs a different opening sentence for a VP than for a staff engineer, and choosing the wrong one reads as either evasive or condescending." },
    { front: "Degraded mode", track: "hld", back: "A designed reduced-capability state that preserves the core journey when a dependency fails \u2014 stale reads, queued writes, a cached price. Undesigned, the same failure becomes an outage; designed, it becomes a banner." },
    { front: "Blast radius", track: "hld", back: "How much of the user base, the data, or the money a change can damage before you notice. It is the variable a rollout plan exists to shrink, and it is why a canary is a design decision rather than a deployment detail." },
    { front: "Strangler migration", track: "hld", back: "Routing slices of traffic or functionality to a new implementation behind a facade until the legacy path is empty, then deleting it. It trades a longer calendar and a period of two systems for the ability to stop at any point without a rollback event." },
    { front: "Parallel run", track: "hld", back: "Running old and new paths on the same inputs and comparing outputs before cutting over. It buys correctness evidence you cannot get any other way, and it costs double compute plus a reconciliation process nobody budgets for." },
    { front: "Go/no-go criteria", track: "hld", back: "The named, measurable conditions for proceeding, agreed before the migration pressure arrives. Written after the pressure arrives, they are negotiated down to whatever the current state happens to be." },
    { front: "Mitigate before diagnose", track: "hld", back: "During an incident, reduce user harm first \u2014 roll back, flag off, fail over, degrade \u2014 and find root cause afterwards. Reversing the order is the single most common failure of technical judgment under pressure, and it is usually driven by wanting to understand rather than wanting to stop the bleeding." },
    { front: "Severity", track: "hld", back: "A classification driven by user impact and reversibility, not by how alarming the graph looks. Its job is to decide who is woken up and how often you communicate \u2014 which is why inflating it is as costly as understating it." },
    { front: "Prevention item", track: "hld", back: "A postmortem output with an owner, a date, and a form that outlives memory: a test, an alert, a guardrail, a runbook step. Findings without those four things are a retelling, not prevention." },
    { front: "Build vs buy", track: "hld", back: "Compared on time to value, total cost of ownership, compliance posture, integration risk, support model, lock-in, and exit path \u2014 not licence price. The exit path is the one most teams skip and the one that hurts three years later." },

    /* ---- lld · LLD Leadership ---- */
    { front: "Invariant", track: "lld", back: "A statement about state that must never be false \u2014 one confirmed booking per seat, a balance that never goes negative. Naming invariants before naming classes is what separates a design conversation from a vocabulary quiz." },
    { front: "Illegal states unrepresentable", track: "lld", back: "Choosing types and constructors so a nonsensical combination cannot be built at all, rather than validating it later. It moves a class of bug from runtime to compile time, and it is the cheapest correctness win in low-level design." },
    { front: "Entity vs value object", track: "lld", back: "An entity has identity that persists as its attributes change; a value object is equal to another when its contents match and is safely replaced wholesale. Getting this wrong produces either accidental aliasing or an update path that mutates shared state." },
    { front: "Additive change", track: "lld", back: "Extending a contract with optional fields or new endpoints so existing consumers keep working untouched. It is the default because coordinated releases across teams are the expensive part, not the code." },
    { front: "Semantic version bump", track: "lld", back: "Reserved for when behaviour or meaning changes, not when the payload grows. Versioning on shape churn multiplies the surfaces you support; refusing to version on a meaning change silently breaks consumers who read the old docs." },
    { front: "Idempotency key", track: "lld", back: "A caller-supplied, durably stored identifier that lets a retried request produce the original result rather than a second side effect. Retries are normal; duplicate charges are a design defect, and the key is where you decide which one you have." },
    { front: "Dedupe window", track: "lld", back: "How long an idempotency record is retained, and therefore how late a retry can arrive and still be recognised. Too short and a delayed retry double-charges; too long and you carry storage plus the question of what a same-key-different-payload request means." },
    { front: "Optimistic locking", track: "lld", back: "Reading a version alongside the data and rejecting the write if the version moved. It suits low-contention updates because it costs nothing when there is no conflict; under real contention it turns into a retry storm and a pessimistic lock is honest." },
    { front: "Transactional outbox", track: "lld", back: "Writing the state change and the intent to publish in one local transaction, then relaying the event separately. It converts an impossible atomic write across two systems into an at-least-once delivery problem \u2014 which is solvable, provided consumers are idempotent." },
    { front: "Compensating action", track: "lld", back: "A business-level reversal for a partially completed multi-step process \u2014 refund, release, cancel \u2014 used where a distributed rollback does not exist. It is a product decision as much as a technical one, because the compensation is visible to the customer." },
    { front: "Characterization test", track: "lld", back: "A test that pins current behaviour, correct or not, before a refactor begins. It gives you a definition of \u201cI changed nothing\u201d for code whose intended behaviour nobody can state any more." },
    { front: "Seam", track: "lld", back: "A place where behaviour can be substituted without editing the surrounding code, which is what makes legacy code testable at all. Finding a seam is usually the actual work in a refactor; the extraction afterwards is mechanical." },
    { front: "Review comment tiers", track: "lld", back: "Correctness, then risk, then maintainability, then preference \u2014 labelled, so the author knows what blocks a merge. Unlabelled reviews make a style opinion look like a defect and quietly train people to ignore all four." },
    { front: "Change pressure", track: "lld", back: "Evidence that a particular axis actually varies \u2014 per-tenant limits, per-product pricing, a second channel. An abstraction earns its keep when it absorbs pressure you can name; without that, it is a guess you now have to maintain." },
    { front: "Readiness gate", track: "lld", back: "A measurable pre-launch condition across correctness, operability, security, and migration. Gates make launch risk visible without becoming a subjective perfection review \u2014 which is what happens when they are opinions rather than checks." },

    /* ---- data · Data Engineering Leadership ---- */
    { front: "Grain", track: "data", back: "What exactly one row of a table or one point of a metric represents. Most \u201cthe numbers disagree\u201d escalations are two correct queries at two different grains, and until the grain is stated out loud the debugging is theatre." },
    { front: "Source of truth", track: "data", back: "The single system whose value is authoritative for a given metric, named before anyone starts fixing queries. Without it, reconciliation becomes an argument about which dashboard is prettier." },
    { front: "Freshness vs correctness", track: "data", back: "Late-arriving data means a fast answer and a right answer are different products. Deciding which one a consumer needs \u2014 per consumer, not per pipeline \u2014 is the design decision people skip before promising real time." },
    { front: "Lineage", track: "data", back: "Source, transforms, consumers, owners, and SLAs for a dataset. Its practical value is answering \u201cwho breaks if I change this column\u201d in minutes rather than by sending a message and hoping." },
    { front: "Data quality dimensions", track: "data", back: "Completeness, accuracy, freshness, uniqueness, validity. Counts matching while amounts are wrong is the classic case where only one dimension was ever checked \u2014 and the one that was checked is the cheap one." },
    { front: "Reconciliation bridge", track: "data", back: "A line-by-line explanation of a variance: timing, definition, scope, currency, late adjustments, and a residual. It converts \u201cthe numbers are wrong\u201d into a list of named differences, one of which is the actual bug." },
    { front: "Data incident update", track: "data", back: "Impact quantified, confidence stated, workaround if any, and the time of the next update. The next-update time is what stops a stream of individual pings and buys the team room to work." },
    { front: "Streaming justification", track: "data", back: "Streaming earns its operational cost when the value of a decision decays in seconds \u2014 fraud holds, dispatch, trading limits. A quarter-close report does not decay, so batch with strong reconciliation is the better engineering answer even when it sounds less impressive." },
    { front: "Replay", track: "data", back: "Reprocessing historical input to rebuild a derived output after a bug or a definition change. Systems designed without it force manual patching under time pressure, which is where silent divergence between tables begins." },
    { front: "Showback", track: "data", back: "Attributing platform spend to the team or workload that caused it, without necessarily charging for it. Visibility alone changes behaviour; a blanket cap just moves the cost onto whoever is least able to argue." },
    { front: "Row and column policy", track: "data", back: "Access control enforced inside the platform \u2014 masking sensitive columns, filtering rows by tenant or role \u2014 rather than in each consuming query. Enforcement in one place is the only version that survives a new consumer." },
    { front: "Cutover acceptance criteria", track: "data", back: "The evidence required before switching consumers to a new pipeline: counts, aggregates, sampled rows, business rules, and a rollback path. Counts alone are the trap, because they match while amounts are wrong." },
    { front: "Semantic layer", track: "data", back: "Centrally owned metric definitions that consumers must go through, versioned when meaning changes. It turns \u201cwhat is an active customer\u201d from a per-dashboard opinion into a contract with an owner and a regression test." },
    { front: "Metric contract", track: "data", back: "A definition plus its owner, its grain, its tests, and the sign-off required to change it. Finance-facing and customer-facing metrics need this the most and usually have it the least." },
    { front: "Confidence statement", track: "data", back: "Saying which parts of a number are reconciled, which are under review, and which decisions are therefore unsafe to make today. It is what stakeholders actually need during a data incident, and withholding it to look composed costs far more trust than the incident did." },

    /* ---- people · People and Org Leadership ---- */
    { front: "Role scorecard", track: "people", back: "The outcomes a hire must deliver in their first year plus the three to five competencies that predict them, written before the first interview. Without it, every interviewer grades against a private picture and the debrief becomes a contest of confidence." },
    { front: "Structured interview", track: "people", back: "Each interviewer owns named competencies, asks the same core questions, and writes evidence before seeing anyone else\u2019s score. It is less charming than a free conversation and far more predictive, because it compares candidates to the bar rather than to each other." },
    { front: "30/60/90 onboarding", track: "people", back: "A plan with a first shipped change in week one or two, a small owned area by day 60, and a reviewed contribution to a design by day 90. Time to first meaningful change is the onboarding metric; a reading list is not a plan." },
    { front: "Report-owned 1:1", track: "people", back: "The report sets the agenda; the manager protects the slot and keeps a running doc of commitments. When the 1:1 is a status update, the important signals \u2014 frustration, ambition, a looming resignation \u2014 have nowhere to surface." },
    { front: "Sponsorship", track: "people", back: "Spending your own credibility to put someone\u2019s name forward for a visible opportunity. Mentoring advises and coaching asks questions, but sponsorship is what moves careers, and it is the one most unevenly distributed across a team." },
    { front: "SBI feedback", track: "people", back: "Situation, behaviour, impact, then an agreed next step. Naming an observable behaviour instead of a trait is what keeps the conversation about a change someone can make rather than a verdict on who they are." },
    { front: "Underperformance plan", track: "people", back: "Explicit expectations, measurable success criteria, support offered, a fixed timeline and regular written check-ins. Its honest purpose is to make success possible and the outcome unsurprising \u2014 a plan nobody expects to pass is a paperwork exercise, not management." },
    { front: "Calibration", track: "people", back: "Managers comparing ratings and promotion cases against a shared ladder so the same evidence earns the same outcome across teams. Without it, outcomes track how persuasive each manager is in the room rather than what each engineer did." },
    { front: "Delegation level", track: "people", back: "How much of a decision you hand over: do as told, recommend, decide and inform, or own fully. Stating the level explicitly avoids both micromanagement and the abdication where someone discovers mid-way that the call was never really theirs." },
    { front: "Cognitive load", track: "people", back: "How much a team has to hold in its head to ship safely \u2014 owned services, dependencies, on-call surface, unplanned work. When it exceeds what the team can carry, quality, morale and delivery all fall together, and adding people rarely fixes it quickly." },
    { front: "Managing up", track: "people", back: "Giving your manager the information and options they need before they have to ask: risks early, a recommendation with every problem, and the decision you need from them. It is not flattery; it is making yourself easy to back." },
    { front: "Blameless review", track: "people", back: "Examining what in the system made the failure likely rather than who pressed the button. Blame produces hidden mistakes and slower incident reporting; blamelessness still expects owners and dated prevention items, it just aims them at the system." },

    /* ---- strategy · Strategy and Execution ---- */
    { front: "Diagnosis-led strategy", track: "strategy", back: "A clear statement of the problem, a guiding policy that rules options out, and coherent actions that follow from it. A list of goals is not a strategy; the test is whether the document tells a team what it will stop doing." },
    { front: "Now / Next / Later", track: "strategy", back: "A roadmap of committed, planned and directional work rather than dated features. It promises certainty only where certainty exists, and it gives stakeholders a stable place to ask \u201cwhat would move this up?\u201d instead of \u201cwhy did the date slip?\u201d." },
    { front: "OKR", track: "strategy", back: "An objective stated as an outcome plus two to four key results that measure it. Key results written as tasks (\u201cship X\u201d) turn the system into a to-do list; written as outcomes, they let a team change the plan and still hit the result." },
    { front: "RICE", track: "strategy", back: "Reach \u00d7 impact \u00d7 confidence \u00f7 effort. It ranks by expected value per unit of work, which favours broad, cheap, well-understood bets \u2014 and quietly undervalues deadlines and risk reduction unless you account for them separately." },
    { front: "Cost of delay", track: "strategy", back: "The value lost per unit of time an item is not delivered: user value plus time criticality plus risk reduction. It is the question that reframes a prioritisation argument from \u201chow important is this\u201d to \u201cwhat does waiting a month cost\u201d." },
    { front: "WSJF", track: "strategy", back: "Weighted shortest job first: cost of delay divided by job size. It promotes time-critical and risk-reducing work that RICE buries, which is why running both and explaining the disagreement is more useful than either rank alone." },
    { front: "Debt interest vs principal", track: "strategy", back: "Interest is the recurring cost a piece of debt charges every sprint; principal is the one-off cost to fix it. Funding the highest-interest, lowest-principal items first is how a debt budget pays for itself visibly within a quarter." },
    { front: "Reference-class forecast", track: "strategy", back: "Estimating from how long similar past projects actually took, then adjusting, instead of from a bottom-up task list. Task lists miss integration, review and the unknowns; history already contains them." },
    { front: "Risk register", track: "strategy", back: "Each risk with likelihood, impact, an owner, a mitigation and a trigger that says when it becomes an issue. A register without owners and triggers is a worry list; with them it is a set of pre-agreed decisions." },
    { front: "RFC review", track: "strategy", back: "A written proposal circulated with explicit reviewers, a decision owner and a closing date. The closing date is what stops a design review becoming an endless thread, and the named decision owner is what stops it becoming a vote." },
    { front: "Executive one-pager", track: "strategy", back: "Bottom line first, then the decision needed, options with costs and risks, a recommendation, and what happens if nobody decides. Executives skim; the first two lines must survive being the only two lines read." },
    { front: "Brownout deprecation", track: "strategy", back: "Scheduled, announced, short periods where a deprecated path is switched off before final removal. It surfaces the consumers who ignored every email while there is still time to help them, rather than on the day the path disappears." },

    /* ---- second pass: architecture, code and data leadership ---- */
    { front: "Review outcome", track: "hld", back: "Every architecture review ends in one of four outcomes \u2014 approved, approved with conditions, spike needed, or rejected \u2014 with the decider named and conditions owned and dated. \u201cGood discussion\u201d is not an outcome, and a board that produces it teaches teams to stop bringing drafts." },
    { front: "Review tier", track: "hld", back: "How much review a proposal gets, chosen by reversibility and blast radius rather than by team or seniority. Tiering is what keeps the board off trivia and focused on the one-way doors that would otherwise slip through on a chat thread." },
    { front: "Structural vs local pain", track: "hld", back: "Structural pain is a driver the platform cannot meet \u2014 isolation, a recovery target, a cost ceiling. Local pain is code that is hard to change on an adequate foundation. Only the first justifies re-platforming; the second is a refactoring budget." },
    { front: "Parity trap", track: "hld", back: "Making \u201cfeature parity\u201d the goal of a rewrite, when the legacy system holds years of undocumented behaviour someone depends on. Define parity per journey, characterise it first, and retire unused features instead of porting them." },
    { front: "RTO and RPO", track: "hld", back: "Recovery time objective: how long you may be down. Recovery point objective: how much data you may lose. Both should come from the cost of an hour down and from contracts, and they decide the topology \u2014 not the other way round." },
    { front: "Rehearsed failover", track: "hld", back: "A failover exercised on a schedule, with its duration recorded. An unrehearsed failover typically takes several times longer than the design claims, which means a warm standby that is never tested may not meet the target it was bought for." },
    { front: "Suite time budget", track: "lld", back: "An agreed ceiling on how long the pull-request test suite may take, often under ten minutes. Past it, engineers batch changes and stop running tests locally, and the suite stops shaping the design." },
    { front: "Flaky-test quarantine", track: "lld", back: "A test that fails intermittently is moved out of the blocking suite within a day, given a named owner, and fixed or deleted by a deadline. One tolerated flaky test teaches the whole team to ignore red builds." },
    { front: "Consumer-driven contract test", track: "lld", back: "The consumer writes down what it relies on from a provider, and that test runs in the provider\u2019s pipeline. The provider learns it has broken a consumer before merging, not from an incident after deploying." },
    { front: "API audience tier", track: "lld", back: "Team-internal, internal shared, partner, public \u2014 each with proportionate governance. Machines check the mechanical rules on every tier; human design review is reserved for the tiers where a mistake reaches someone outside the organisation." },
    { front: "Breaking-change detection", track: "lld", back: "Comparing a changed API specification against the published one in CI and failing on removed fields, narrowed types or new required parameters. It prevents most cross-team breakages without anyone having to queue for review." },
    { front: "Paved road", track: "data", back: "The one supported, documented, templated way to ingest, store, transform, test or serve data \u2014 deliberately faster than building it yourself. A platform strategy is mostly a choice of paved roads plus a list of what will be retired." },
    { front: "Data product", track: "data", back: "A dataset owned by the domain that produces it, with a product owner, consumers, a contract and an SLA. It only works when the platform makes publishing self-serve and enforces the shared standards automatically." },
    { front: "Data contract", track: "data", back: "Schema, meaning, freshness, quality thresholds, change policy and owner for a dataset, enforced in the producer\u2019s pipeline. Without enforcement it is documentation, and it will be broken on the first busy Friday." },
    { front: "SLA tier", track: "data", back: "How much a dataset matters: tier 1 drives money or customer-facing numbers and pages the producer; tier 2 alerts in working hours; tier 3 is labelled best effort. Promotion between tiers is an explicit decision, not an accident of someone depending on it." }
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
        el("p", { class: "fc-sub" }, "Flip through key architecture, code, data, people and strategy terms and self-grade each one. Your progress saves locally in this browser.")
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
