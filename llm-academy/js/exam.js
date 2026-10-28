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
  // Quiz ids in Lumen use these prefixes: found-, core-, hist-, train-, api-, prompt-, rag-, agent-, local-, ops-, next-, cap-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["found", "core", "hist", "train", "api", "prompt", "rag", "agent", "local", "ops", "next", "cap"];
  var TRACK_NAMES = {
    found: "Foundations",
    core: "How LLMs Work",
    hist: "Evolution of Language Models",
    train: "Training & Alignment",
    api: "Using LLMs",
    prompt: "Prompt Engineering",
    rag: "RAG & Context Engineering",
    agent: "Skills, Tools & Agents",
    local: "Local LLMs",
    ops: "Evaluation, Safety & LLMOps",
    next: "Multimodal & What's Next",
    cap: "Capstone: Build an Assistant"
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
  var EXAM_KEY = "lm_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "lm_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
      var host = window.Academy || window.Lumen;
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
     Tracks match Lumen's window.TRACKS ids: found, core, hist, train, api, prompt, rag, agent, local, ops, next, cap.
     ===================================================================== */
  var CARDS = [
    { front: "Machine learning", track: "found", back: "The part of AI where behaviour is fitted to example data instead of being written as hand-coded rules." },
    { front: "Generative AI", track: "found", back: "Deep learning models that produce new content such as text, images, audio or code, rather than a single label or score." },
    { front: "Activation function", track: "found", back: "A nonlinear function applied after a neuron's weighted sum. Without it, stacked layers collapse into one linear map." },
    { front: "Cross-entropy loss", track: "found", back: "The negative log of the probability a model gave to the correct answer. Confident correct predictions cost little; confident wrong ones cost a lot." },
    { front: "Learning rate", track: "found", back: "The step size used when moving weights against the gradient. Too small wastes compute; too large overshoots and can make training diverge." },
    { front: "Byte-pair encoding (BPE)", track: "found", back: "A tokenizer training method that starts from single symbols and repeatedly merges the most frequent adjacent pair into a new vocabulary entry." },
    { front: "Embedding", track: "found", back: "A learned vector that represents a token or a passage, arranged so that items used in similar ways end up close together." },
    { front: "Cosine similarity", track: "found", back: "The cosine of the angle between two vectors, from -1 to 1. It ignores length, and equals the dot product when both vectors are normalised." },
    { front: "Self-attention", track: "core", back: "Each token scores its query against every key, softmaxes the scaled scores into weights, and outputs the weighted mix of value vectors." },
    { front: "Causal mask", track: "core", back: "Blocks each position from attending to later positions, so a decoder cannot see the token it must predict and can train on every position in parallel." },
    { front: "Multi-head attention", track: "core", back: "Several smaller attention operations run in parallel on slices of the model width, each free to learn a different relationship, then concatenated and mixed." },
    { front: "RoPE (rotary position embedding)", track: "core", back: "Rotates query and key dimensions by angles proportional to position, so their dot product depends on how far apart two tokens are." },
    { front: "Temperature", track: "core", back: "A divisor applied to logits before softmax. Below 1 sharpens the distribution toward the top token; above 1 flattens it." },
    { front: "Top-p (nucleus) sampling", track: "core", back: "Keeps the smallest set of most-likely tokens whose probabilities add up to at least p, renormalises them, and samples from that set." },
    { front: "KV cache", track: "core", back: "Stored keys and values for past tokens at every layer, so each decode step only computes the new token. Size is 2 x layers x KV heads x head dim x bytes x tokens." },
    { front: "Hallucination", track: "core", back: "Fluent, confident output that is false or unsupported, arising because the model optimises for plausible text and has no built-in check against facts." },
    { front: "n-gram language model", track: "hist", back: "A model that estimates the probability of the next word from the previous n minus 1 words by counting sequences in a corpus. Simple and fast, but sparse and limited to very short context." },
    { front: "Smoothing", track: "hist", back: "Moving a little probability mass onto word sequences never seen in training so they are not treated as impossible. Add-one and Kneser-Ney are classic methods." },
    { front: "word2vec (2013)", track: "hist", back: "A shallow network that learns one dense vector per word by predicting nearby words (skip-gram) or a word from its neighbours (CBOW). Words used in similar contexts end up close together." },
    { front: "seq2seq with attention", track: "hist", back: "An encoder-decoder pair of recurrent networks for tasks like translation, where attention lets the decoder weigh every encoder state at each step instead of relying on one fixed summary vector." },
    { front: "Transformer (2017)", track: "hist", back: "An architecture built from self-attention and feed-forward layers with no recurrence, so every position is processed in parallel during training. The basis of modern LLMs." },
    { front: "Masked vs causal language modelling", track: "hist", back: "Masked LM (BERT) hides tokens and predicts them from both sides, which suits understanding tasks. Causal LM (GPT) predicts each token from the ones before it, which is exactly what generation needs." },
    { front: "Compute-optimal scaling (Chinchilla, 2022)", track: "hist", back: "For a fixed training compute budget, grow parameters and training tokens roughly together; about 20 tokens per parameter is the common rule of thumb. Models built for cheap inference are often trained well beyond it." },
    { front: "Open weights", track: "hist", back: "A release where trained weights can be downloaded and run, usually without the training data or full recipe and often under a licence with conditions. Not the same as open source." },
    { front: "Pretraining", track: "train", back: "The first and most expensive training stage, where a model learns to predict the next token over trillions of tokens of mostly web, code and book text. It produces a base model that completes documents rather than following instructions." },
    { front: "Data contamination", track: "train", back: "When evaluation questions or answers leak into the training corpus, so benchmark scores measure memory instead of skill. Teams check n-gram overlap and keep private, never-published eval sets." },
    { front: "6·N·D rule", track: "train", back: "A rule of thumb that training compute is about 6 FLOPs per parameter per token: 6 times parameters times training tokens. A 7B model on 2T tokens needs roughly 8.4 × 10^22 FLOPs." },
    { front: "Mixture of experts (MoE)", track: "train", back: "An architecture where a router sends each token to a few of many expert feed-forward networks. Per-token compute follows the active parameters, but memory must hold the total." },
    { front: "LoRA", track: "train", back: "A fine-tuning method that freezes the base weights and learns a low-rank update B·A for chosen matrices. Each adapted matrix adds r·(d_in + d_out) trainable parameters, usually well under 1% of the model." },
    { front: "QLoRA", track: "train", back: "LoRA trained on top of a frozen base model stored in 4-bit precision. It cuts base-model memory to roughly a quarter, letting large models be fine-tuned on a single GPU." },
    { front: "RLHF", track: "train", back: "Reinforcement learning from human feedback: train a reward model on pairwise human preferences, then optimize the policy with RL such as PPO. A KL penalty keeps the policy close to its SFT reference." },
    { front: "DPO", track: "train", back: "Direct preference optimisation trains on chosen-versus-rejected pairs with a simple loss relative to a frozen reference model. It needs no separate reward model and no RL loop." },
    { front: "Chat completions API", track: "api", back: "An endpoint that takes a list of role-tagged messages, applies the model's chat template, and returns the next assistant message. It is stateless, so your code resends the history on every call." },
    { front: "System message", track: "api", back: "The developer-written message that sets persona, scope, rules and output format for a conversation. It guides the model but is not a security boundary and must never hold secrets." },
    { front: "Server-sent events (SSE)", track: "api", back: "The streaming format most LLM APIs use: one long HTTP response made of data: lines, each carrying a small chunk of the answer, ending with a done marker." },
    { front: "Time to first token (TTFT)", track: "api", back: "The delay between sending a request and receiving the first generated token. It depends on queueing, prompt length and network, and it is the latency users feel when responses stream." },
    { front: "Schema-constrained decoding", track: "api", back: "A server-side technique that masks out any next token that would break a supplied JSON schema, so the output's shape is valid by construction. Your code still validates meaning and business rules." },
    { front: "Tool calling", track: "api", back: "The model returns a structured request naming a function and its JSON arguments; your code validates, executes it with the user's permissions, and sends the result back. The model never runs anything itself." },
    { front: "Prompt caching", track: "api", back: "Reusing the processed form of a prompt prefix that repeats exactly across requests. It cuts input cost and time to first token, so stable content such as instructions should go first." },
    { front: "Model routing", track: "api", back: "Sending each request to the cheapest model that can handle it, for example a small model for extraction and a frontier model for hard reasoning, based on evals of your own task." },
    { front: "Prompt as a work order", track: "prompt", back: "Treating a prompt like instructions for a capable contractor with no context: state the role, one task verb, constraints in numbers, the output format and what to do with bad input." },
    { front: "Few-shot prompting", track: "prompt", back: "Including a handful of input-output examples in the prompt so the model imitates their format and labels. Examples are followed more faithfully than written instructions." },
    { front: "Recency and majority-label bias", track: "prompt", back: "In few-shot prompts the model drifts towards the most frequent label and towards labels near the end. Balance classes and interleave them to counter both." },
    { front: "Delimiters", track: "prompt", back: "Markers such as XML-style tags or triple quotes that separate instructions from data. They reduce confusion but are not a security boundary against prompt injection." },
    { front: "Chain-of-thought", track: "prompt", back: "Asking the model to write intermediate reasoning before the answer, buying extra computation per question. It helps multi-step problems and wastes tokens on lookups or with reasoning models." },
    { front: "Prompt chaining", track: "prompt", back: "Splitting one large task into a sequence of smaller prompts with validated handoffs. Each step is testable, but per-step success rates multiply end to end." },
    { front: "Self-critique loop", track: "prompt", back: "A draft, critique and revise cycle. It works when the critique uses a signal the drafter lacked, such as tests, a schema validator or a rubric, and it should be capped at one or two rounds." },
    { front: "Prompt versioning", track: "prompt", back: "Keeping prompts as files in source control and logging the prompt version with each model call, so quality changes can be traced, reviewed with eval results and rolled back." },
    { front: "Retrieval-augmented generation (RAG)", track: "rag", back: "Fetching relevant passages from your own store at query time and placing them in the prompt, so the model can answer from fresh or private data and cite sources." },
    { front: "Chunk overlap", track: "rag", back: "Repeating the end of one chunk at the start of the next so sentences near a boundary appear whole somewhere. Around ten to twenty percent is a common starting point." },
    { front: "HNSW index", track: "rag", back: "An approximate nearest-neighbour index built as a layered proximity graph. Search hops from coarse to fine layers, trading a little recall and extra memory for much faster queries." },
    { front: "Hybrid search", track: "rag", back: "Running keyword retrieval such as BM25 and vector retrieval together, so exact identifiers and paraphrased questions are both matched, then fusing the two rankings." },
    { front: "Reciprocal rank fusion", track: "rag", back: "A way to merge ranked lists using ranks only: each list adds 1 / (k + rank) to a document's score, with k often around 60. Documents both retrievers rank well rise to the top." },
    { front: "Cross-encoder reranker", track: "rag", back: "A model that reads the query and a candidate chunk together and scores relevance. Too slow for a whole corpus, so it reorders a shortlist such as the top 50 down to the best 5." },
    { front: "Grounding", track: "rag", back: "Constraining the model to answer only from the provided context, cite chunk ids for each claim and say it does not know when the context lacks the answer." },
    { front: "Lost in the middle", track: "rag", back: "The tendency of long-context models to use information at the start and end of a prompt more reliably than information buried in the middle. Send fewer chunks and put the best at the edges." },
    { front: "Tool schema", track: "agent", back: "A name, description and JSON parameter schema that tells the model what a tool does and when to call it. The model proposes calls against it; your code validates and executes them." },
    { front: "ReAct loop", track: "agent", back: "An agent pattern that alternates a short thought, a tool action and the resulting observation until it can give a final answer. Stop conditions such as max steps are enforced in code." },
    { front: "Idempotency key", track: "agent", back: "A unique key sent with a write so a retried or repeated call returns the original result instead of repeating the side effect." },
    { front: "Agent skill", track: "agent", back: "A reusable instruction pack, typically a folder with a SKILL.md whose name and description let the agent decide when to load the full steps, scripts and references." },
    { front: "Progressive disclosure", track: "agent", back: "Keeping only short descriptions in context and loading full instructions or references when a task needs them, so many capabilities stay cheap." },
    { front: "Model Context Protocol (MCP)", track: "agent", back: "An open JSON-RPC based protocol through which AI hosts connect to servers exposing tools, resources and prompts, over stdio locally or streamable HTTP remotely." },
    { front: "Rules file", track: "agent", back: "A repo file such as AGENTS.md or .cursor/rules that coding agents load automatically, holding build and test commands, conventions and areas not to touch." },
    { front: "Approval fatigue", track: "agent", back: "When reviewers are asked to approve so many low-risk actions that they stop reading. Gate only irreversible or high-impact actions to avoid it." },
    { front: "Weights memory formula", track: "local", back: "Parameters times bytes per parameter: FP16 is 2 bytes, Q8 about 1, Q4_K_M about 0.6. Add the KV cache and roughly 10–20% runtime overhead for the total." },
    { front: "Why decode speed tracks bandwidth", track: "local", back: "Each generated token streams roughly every weight through the processor once, so tokens per second is capped near memory bandwidth divided by model size." },
    { front: "Unified memory", track: "local", back: "On Apple Silicon the CPU and GPU share one memory pool, so large-RAM Macs can load models bigger than a consumer GPU's VRAM, usually at lower bandwidth." },
    { front: "GGUF", track: "local", back: "A single-file model format for llama.cpp-family runtimes such as Ollama and LM Studio that bundles quantized weights, tokenizer and metadata." },
    { front: "K-quants (e.g. Q4_K_M)", track: "local", back: "GGUF quantization types that use a two-level block structure and spend more bits on sensitive layers, keeping more quality than naive schemes at similar size." },
    { front: "AWQ and GPTQ", track: "local", back: "Quantization methods aimed at GPU inference servers. AWQ protects the weights that matter most for typical activations; GPTQ compensates for error layer by layer." },
    { front: "vLLM", track: "local", back: "A GPU serving runtime built for many concurrent users, using continuous batching and paged attention to keep KV-cache memory efficient." },
    { front: "Ollama Modelfile", track: "local", back: "A small recipe that derives a named model: FROM picks the base, PARAMETER sets defaults like temperature or context, SYSTEM bakes in a system prompt." },
    { front: "Golden set", track: "ops", back: "A curated, versioned collection of representative inputs with expected answers or rubrics, rerun on every prompt, model or retrieval change." },
    { front: "LLM-as-judge", track: "ops", back: "Using a model to grade outputs against a rubric, pointwise or pairwise. Useful at scale, but only after its verdicts are checked against human labels." },
    { front: "Position bias", track: "ops", back: "A judge's tendency to favour whichever answer it sees first or second. Mitigate by judging both orders and keeping only verdicts that agree." },
    { front: "Trace and span", track: "ops", back: "A trace records one request end to end; each span inside it is one step such as retrieval, an LLM call or a tool call, with tokens, latency and cost." },
    { front: "Semantic cache", track: "ops", back: "Reuses an earlier answer when a new question's embedding is very similar. Saves calls but can return wrong answers for near-miss questions or leak across users." },
    { front: "Indirect prompt injection", track: "ops", back: "Instructions planted in content the app retrieves, such as documents, web pages or tool output, that the model may follow as if they came from you." },
    { front: "Excessive agency", track: "ops", back: "Giving tools more permissions or autonomy than the task needs, so a manipulated or mistaken model can cause real side effects." },
    { front: "Open weights vs open source", track: "ops", back: "Downloadable weights often lack training data and code and may carry use restrictions, so check each model's licence and version before shipping." },
    { front: "Patch embedding", track: "next", back: "Cutting an image into fixed-size squares, flattening each and projecting it to a vector so it can be processed like a token. A 224 by 224 image with 16 by 16 patches gives 196 patch tokens." },
    { front: "Contrastive image-text model", track: "next", back: "Two encoders trained so that an image and its own caption land close together in one embedding space while mismatched pairs are pushed apart. Enables cross-modal search and zero-shot labelling." },
    { front: "Log-mel spectrogram", track: "next", back: "A picture of audio showing energy in perceptually spaced frequency bands over short time frames. Speech-to-text models commonly use it as their input." },
    { front: "Diffusion model", track: "next", back: "A generator trained to predict the noise added to an image at a given step. Sampling starts from pure noise and removes it step by step until an image remains." },
    { front: "Classifier-free guidance", track: "next", back: "Combining a prompt-conditioned and an unconditioned prediction and pushing further toward the prompt. Higher scales follow the prompt more literally but reduce diversity." },
    { front: "Latent diffusion", track: "next", back: "Running the denoising process in the compressed latent space of an autoencoder instead of on pixels, then decoding the result. Far cheaper to train and sample." },
    { front: "Knowledge distillation", track: "next", back: "Training a smaller student model to imitate a larger teacher's outputs or probability distributions, transferring much of its skill at a fraction of the size." },
    { front: "NPU", track: "next", back: "A neural processing unit: an on-chip accelerator for low-precision matrix maths that runs model inference with far less power than a CPU or GPU." },
    { front: "Non-goals", track: "cap", back: "An explicit list of what the assistant will not do, such as acting on production. It keeps scope, risk and approval gates small." },
    { front: "Grounded system prompt", track: "cap", back: "Instructions that restrict answers to provided excerpts, require citations and define what to say when the sources are silent." },
    { front: "Golden set", track: "cap", back: "A curated list of questions with reference answers, expected sources and refusal flags, used to score the assistant on every change." },
    { front: "Faithfulness", track: "cap", back: "Whether every claim in an answer is supported by the retrieved context. An answer can be relevant yet unfaithful if it invents a step." },
    { front: "Refusal correctness", track: "cap", back: "Whether the assistant declines exactly when its sources do not cover the question, and answers when they do." },
    { front: "Regression gate", track: "cap", back: "A CI step that fails the build when eval metrics fall below set floors or drop by more than an allowed margin." },
    { front: "OpenAI-compatible endpoint", track: "cap", back: "A server, such as a local Ollama instance, that accepts the same chat API shape, so switching models is mostly a base URL and model name change." },
    { front: "Blocking launch item", track: "cap", back: "A checklist gate, like a security review or secrets hygiene, that must pass before launch regardless of the overall readiness score." },
    { front: "What does FlashAttention change about attention?", track: "core", back: "Only the implementation: it tiles Q, K and V through fast on-chip memory with an online softmax, so the n×n matrix is never written to GPU main memory. Output is exact; memory becomes linear in length." },
    { front: "What is continuous batching?", track: "core", back: "Adding new requests and removing finished ones at every decode step, so batch slots never sit idle waiting for the longest request. It is the main throughput lever in serving engines." },
    { front: "What is test-time compute?", track: "train", back: "Spending extra inference work per question — longer thinking, sampling several answers and voting, or generating candidates and verifying them — to raise accuracy without retraining." },
    { front: "What is self-consistency?", track: "train", back: "Sample several independent answers at non-zero temperature and return the majority. The agreement rate is also a useful confidence signal." },
    { front: "What is MRR in retrieval evaluation?", track: "rag", back: "Mean reciprocal rank: the average of 1 / (rank of the first relevant result) across questions. It rewards putting the evidence at the top." },
    { front: "What does faithfulness measure in RAG?", track: "rag", back: "Whether every claim in the answer is supported by the retrieved passages — independent of whether the answer happens to be correct." },
    { front: "What is HyDE?", track: "rag", back: "Hypothetical document embeddings: generate a plausible answer to the query, embed it, and use it to search for real passages. The invented text is only a search key, never shown as fact." },
    { front: "What is parent-child (small-to-big) retrieval?", track: "rag", back: "Search over small chunks for precise matching, then hand the model the larger parent section each match belongs to, so it gets the surrounding detail." },
    { front: "MCP tools vs resources vs prompts — who controls each?", track: "agent", back: "Tools: the model decides to call them. Resources: the host or user attaches them as context. Prompts: the user picks a template." },
    { front: "How should an MCP server config handle secrets?", track: "agent", back: "Reference environment variables or the host's secret store — never paste real tokens into the JSON config or commit them." },
    { front: "What belongs in a repo's AGENTS.md or rules file?", track: "agent", back: "Durable facts an agent needs every time: build and test commands, conventions, directories it must not touch, and how to verify its work. Keep it short and specific." },
    { front: "Safest default workflow with a coding agent?", track: "agent", back: "Plan first, small increments, tests as the oracle, review every diff, run the full suite yourself, and checkpoint commits so a bad run is easy to revert." },
    { front: "Name the four places production guardrails sit.", track: "ops", back: "Input (validation, PII, policy), retrieval (access control, source filtering), output (schema, PII and secret scan, groundedness, escaping) and action (allow-lists, approval, limits)." },
    { front: "How do you evaluate a guardrail?", track: "ops", back: "On a labelled set of benign and violating examples, reporting both false negatives (missed harm) and false positives (wrongly blocked users), then tuning thresholds per risk." },
    { front: "Cascaded vs speech-to-speech voice agents?", track: "next", back: "Cascaded (STT → LLM → TTS) is inspectable and swappable but adds latency; speech-to-speech is faster and more natural but harder to log, evaluate and guard." },
    { front: "When should a document pipeline send page images instead of extracted text?", track: "next", back: "For scans, handwriting, forms, charts and complex layouts where text extraction loses structure; clean digital text is cheaper to send as text." },
    { front: "LLM gateway", track: "ops", back: "One service in front of every model call that owns routing, per-tenant token budgets, retries, fallbacks, redaction and tracing, so a provider or model swap is a configuration change." },
    { front: "Little's law for LLM serving", track: "ops", back: "Concurrent streams = arrival rate × average generation time. 20 req/s × 8 s = 160 streams in flight, and that count, times KV-cache memory per stream, sizes a self-hosted pool." },
    { front: "TTFT vs time per output token", track: "ops", back: "Total latency ≈ TTFT + output tokens × time per token. Streaming hides the second term from the user but not from the capacity plan." },
    { front: "What should autoscale a GPU inference pool?", track: "ops", back: "Queue depth, waiting sequences and KV-cache utilisation, not CPU. Scale early and keep warm headroom, because loading weights onto a new replica takes minutes." },
    { front: "Batch size trade-off in serving", track: "ops", back: "Larger batches raise tokens per second per GPU and cut cost per token, but slow each user's stream. Split interactive and batch traffic into separate pools or priorities." },
    { front: "LLM fallback chain", track: "ops", back: "Secondary provider or region, then a smaller model, then a cached answer for safe questions, then an honest error, with timeouts on first token and a retry budget." },
    { front: "RAG ingestion path vs online path", track: "rag", back: "Ingestion parses, chunks, embeds and indexes ahead of time and owns freshness; the online path retrieves, filters, reranks, builds the prompt and calls the model per request." },
    { front: "Pre-filter vs post-filter in vector search", track: "rag", back: "Apply tenant and ACL filters inside the retrieval query. Dropping forbidden chunks after top-k can leave no permitted results and leaks data if the later step has a bug." },
    { front: "Index lag", track: "rag", back: "How old the newest searchable version of a source is. Track it against a freshness target so a missing new document is a dashboard lookup, not a mystery." },
    { front: "Changing the embedding model safely", track: "rag", back: "Never mix models in one index. Build a second index, shadow-compare recall on the golden set, then cut over and retire the old one." }
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
        el("p", { class: "fc-sub" }, "Flip through key LLM, RAG, agent and local-model terms and self-grade each one. Your progress saves locally in this browser.")
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
