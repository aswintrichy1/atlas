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
  // Quiz ids in Forge use these prefixes: found-, pipe-, chain-, ctr-, scan-, vuln-, wiz-, prog-, ops-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["found", "pipe", "chain", "ctr", "scan", "vuln", "wiz", "prog", "ops"];
  var TRACK_NAMES = {
    found: "Foundations & Secure SDLC",
    pipe: "Pipeline Engineering",
    chain: "Pipeline Security & Supply Chain",
    ctr: "Containers & Kubernetes",
    scan: "Security Testing Gates",
    vuln: "AppSec & Vulnerability Management",
    wiz: "Wiz Cloud Security",
    prog: "Program, Governance & Resilience",
    ops: "Capstone",
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
  var EXAM_KEY = "fg_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "fg_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
     Tracks match Forge's window.TRACKS ids: found, pipe, scan, wiz, ops.
     ===================================================================== */
  var CARDS = [
    // found
    { front: "DevSecOps", track: "found", back: "Making security a shared, automated part of every DevOps stage — design, code, build, deploy, run — instead of a final gate owned by a separate team." },
    { front: "Shift left vs shift everywhere", track: "found", back: "Shift left moves checks earlier, where fixes are cheap. Shift everywhere keeps controls at deploy and runtime too, because early checks never catch everything." },
    { front: "V-Model", track: "found", back: "A sequential SDLC where each development phase is paired with a matching test phase, such as requirements with acceptance testing and design with integration testing." },
    { front: "STRIDE", track: "found", back: "Threat categories: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege — each violates one security property." },
    { front: "PASTA", track: "found", back: "Process for Attack Simulation and Threat Analysis: a seven-stage, risk-centric threat modeling method that starts from business objectives." },
    { front: "NIST SSDF (SP 800-218)", track: "found", back: "A set of secure development practices grouped as Prepare the organization, Protect the software, Produce well-secured software, and Respond to vulnerabilities." },
    { front: "OWASP SAMM vs BSIMM", track: "found", back: "SAMM is a prescriptive maturity model you assess against and plan with; BSIMM is descriptive, measuring what real organizations actually do." },
    { front: "SLSA", track: "chain", back: "Supply-chain Levels for Software Artifacts: levels of build integrity and provenance, from documented builds to hardened, tamper-resistant build platforms." },
    { front: "CycloneDX vs SPDX", track: "chain", back: "Two SBOM standards. CycloneDX is security-oriented and covers services and vulnerabilities; SPDX grew from licence compliance and is an ISO standard." },
    { front: "cosign keyless signing", track: "chain", back: "Sigstore signing with a short-lived certificate bound to an OIDC identity, recorded in a transparency log, so there is no long-lived signing key to protect." },
    // pipe
    { front: "Trunk-based development", track: "pipe", back: "Everyone integrates into main at least daily via very short-lived branches, with feature flags hiding unfinished work." },
    { front: "Branch protection", track: "pipe", back: "Rules on a branch such as required reviews, required status checks, signed commits and no force pushes, so no single identity can land code alone." },
    { front: "CODEOWNERS", track: "pipe", back: "A file mapping paths to required reviewers. Use it to make the platform team review Jenkinsfile and pipeline changes." },
    { front: "gitleaks / TruffleHog", track: "pipe", back: "Secret scanners for staged changes, repos and history. TruffleHog can verify whether a found credential is still live." },
    { front: "withCredentials", track: "pipe", back: "Jenkins step that binds a stored credential to environment variables for a block, masking the values in console output." },
    { front: "Why single-quoted sh strings", track: "pipe", back: "The shell expands the secret variable at run time, so Groovy never interpolates the secret into the command string Jenkins may expose." },
    { front: "Jenkins shared library", track: "pipe", back: "A versioned repo of reusable steps and pipeline templates imported with @Library, so hardened stages are written once and reused." },
    { front: "Build once, promote many", track: "pipe", back: "Build one immutable artifact and move the same digest through environments; rebuilding per environment discards the test and scan evidence." },
    { front: "Artifactory remote vs virtual repo", track: "pipe", back: "A remote repo proxies and caches an upstream registry; a virtual repo is one endpoint aggregating local and remote repos." },
    { front: "GitOps", track: "pipe", back: "Desired state in Git, pulled and reconciled by an in-cluster agent such as Argo CD or Flux. CI never needs cluster credentials." },
    { front: "Canary vs blue/green", track: "pipe", back: "Canary sends a small share of traffic to the new version and grows it; blue/green switches all traffic between two full environments for instant rollback." },
    { front: "Terraform remote state", track: "pipe", back: "Shared, encrypted state with locking so concurrent applies cannot corrupt it and access to sensitive values is restricted." },
    { front: "GitHub Actions OIDC", track: "pipe", back: "A workflow exchanges a signed identity token for a short-lived cloud role bound to repository, workflow, ref and environment, removing standing cloud keys." },
    { front: "Full-SHA action pin", track: "pipe", back: "Referencing a third-party action by immutable commit SHA so a moved tag cannot silently change the code your workflow executes." },
    { front: "Feature flag lifecycle", track: "pipe", back: "Create with owner, safe default and expiry; approve and observe changes; remove release and experiment flags after the decision; rehearse long-lived kill switches." },
    // scan
    { front: "SAST vs DAST", track: "scan", back: "SAST reads source without running it; DAST attacks the running application over HTTP. They find different classes of problems." },
    { front: "Quality profile vs quality gate", track: "scan", back: "In SonarQube the profile is the set of active rules; the gate is the pass or fail conditions on resulting measures." },
    { front: "waitForQualityGate", track: "scan", back: "Jenkins step that waits for SonarQube's webhook with the gate result and aborts the pipeline on failure. Wrap it in a timeout." },
    { front: "snyk test vs snyk monitor", track: "scan", back: "test scans now and gates with an exit code; monitor uploads a snapshot so you are alerted when new CVEs affect what shipped." },
    { front: "EPSS", track: "scan", back: "Exploit Prediction Scoring System: the estimated probability a vulnerability will be exploited soon. Complements CVSS severity." },
    { front: "Reachability", track: "scan", back: "Whether your code actually calls the vulnerable function in a dependency. Unreachable findings can be deprioritized with a time-boxed exception." },
    { front: "Checkov / tfsec / KICS", track: "scan", back: "IaC scanners that catch misconfigurations such as public buckets or privileged pods in Terraform, Kubernetes and other formats before apply." },
    { front: "Kyverno vs Gatekeeper", track: "ctr", back: "Both enforce Kubernetes admission policy. Kyverno uses Kubernetes-style YAML; Gatekeeper uses OPA's Rego language." },
    { front: "Dynamic secrets", track: "chain", back: "Credentials generated per consumer with a short lease and automatic revocation, such as Vault database credentials." },
    // wiz
    { front: "CNAPP", track: "wiz", back: "Cloud-native application protection platform: posture, workloads, identities, data, Kubernetes, code and runtime on one inventory and risk graph." },
    { front: "Agentless scanning", track: "wiz", back: "Read-only cloud API access plus disk snapshots analysed out-of-band, giving complete workload coverage with no agent to deploy." },
    { front: "Wiz Security Graph", track: "wiz", back: "A graph of cloud resources, identities, network paths, vulnerabilities and data, with relationships used to find attack paths." },
    { front: "Toxic combination", track: "wiz", back: "Connected risks — exposure, exploitable vulnerability, high privilege, sensitive data — that together form a real attack path." },
    { front: "Finding vs issue (Wiz)", track: "wiz", back: "A finding is one raw result; an issue is a prioritized, correlated risk raised when graph conditions combine. Issues are the work queue." },
    { front: "CSPM / CIEM / DSPM / KSPM", track: "wiz", back: "Posture lenses: cloud configuration, effective identity entitlements, sensitive data location and access, and Kubernetes configuration." },
    { front: "Wiz CI/CD policy", track: "wiz", back: "A centrally defined rule set (vulnerability, IaC, secrets) that wizcli scans evaluate; blocking policies return a failing exit code." },
    { front: "wizcli docker tag", track: "wiz", back: "Records the pushed image digest against its CI scan so admission control and runtime views know the image was scanned." },
    { front: "Code-to-cloud", track: "wiz", back: "Tracing a cloud resource or running image back to the repo, file and owner that defined it, so the fix lands permanently in code." },
    { front: "Wiz admission controller", track: "wiz", back: "A Kubernetes admission webhook that blocks or audits deployments violating image-trust, vulnerability or misconfiguration policies." },
    { front: "Wiz Defend and runtime sensor", track: "wiz", back: "Cloud detection and response: an eBPF sensor and cloud audit logs produce detections correlated on the graph into threats with blast radius." },
    { front: "Wiz project", track: "wiz", back: "A scope of accounts, clusters, tags or repos mapped to an owning team, used for issue ownership, RBAC and dashboards." },
    // ops
    { front: "DORA four keys", track: "prog", back: "Deployment frequency, lead time for changes, change failure rate, time to restore service." },
    { front: "Critical-vuln MTTR", track: "prog", back: "Mean time to remediate critical vulnerabilities or issues — the security metric to report alongside DORA." },
    { front: "SIEM", track: "prog", back: "Security information and event management: collects and normalizes security events, correlates them with detections, and supports investigation." },
    { front: "Incident response phases", track: "prog", back: "Prepare, detect and analyse, contain, eradicate, recover, and post-incident review that feeds new controls back into the pipeline." },
    { front: "Progressive enforcement", track: "prog", back: "Introduce a gate in audit mode, then warn, then block on new code, with expiring exceptions in code." },
    // chain
    { front: "Poisoned pipeline execution", track: "chain", back: "Getting a pipeline to run attacker-controlled commands, for example by editing the Jenkinsfile or build scripts in an untrusted pull request." },
    { front: "Dependency confusion", track: "chain", back: "Publishing a public package with the same name as an internal one so the build resolves the attacker's higher version. Fixed by scoped registries and a single proxy." },
    { front: "OIDC federation in CI", track: "chain", back: "The pipeline exchanges a short-lived signed identity token for cloud credentials, removing long-lived access keys from CI." },
    { front: "SLSA provenance", track: "chain", back: "A signed statement of how, where and from what source an artifact was built, verifiable before deploy." },
    // ctr
    { front: "Distroless image", track: "ctr", back: "A minimal runtime image with no shell or package manager, shrinking the attack surface and CVE count." },
    { front: "Pod Security Admission", track: "ctr", back: "Built-in Kubernetes admission that enforces the privileged, baseline or restricted Pod Security Standard per namespace." },
    { front: "Default-deny NetworkPolicy", track: "ctr", back: "A policy selecting all pods with no allow rules, so only explicitly permitted traffic flows." },
    { front: "Pin by digest", track: "ctr", back: "Reference images as name@sha256:… so what was scanned and signed is exactly what runs, unlike a mutable :latest tag." },
    // vuln
    { front: "EPSS", track: "vuln", back: "Exploit Prediction Scoring System: estimated probability that a CVE will be exploited soon. Combine with CVSS, KEV and reachability." },
    { front: "CISA KEV", track: "vuln", back: "Known Exploited Vulnerabilities catalog: CVEs with confirmed exploitation. Usually the shortest remediation SLA." },
    { front: "Risk acceptance with expiry", track: "vuln", back: "A documented, approved exception with an owner and end date, after which the finding blocks again." },
    { front: "ASPM", track: "vuln", back: "Application security posture management: correlates findings from all scanners, deduplicates, maps to owners and prioritizes across the portfolio." },
    // prog
    { front: "Separation of duties", track: "prog", back: "No one person can both author and release a production change; enforced by branch protection and independent approvers." },
    { front: "Break-glass access", track: "prog", back: "Time-limited emergency elevation with MFA, full logging and mandatory after-the-fact review." },
    { front: "Preventive vs detective guardrails", track: "prog", back: "SCPs, Azure Policy and GCP Org Policy prevent misconfigurations; CNAPP tools such as Wiz detect and prioritize what remains." },
    { front: "Golden path", track: "prog", back: "A supported, secure-by-default template and pipeline for building a service, so the secure way is the easiest way." }
    ,{ front: "dbt state selection", track: "prog", back: "Using a trusted prior manifest to build modified resources and downstream dependants, while retaining manifest and run results as release evidence." }
    ,{ front: "Snowflake zero-copy clone", track: "prog", back: "A fast point-in-time clone used to rehearse or recover data-platform changes, with the same access controls and a defined retention window." }
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
