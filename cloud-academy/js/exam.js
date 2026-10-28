/* =====================================================================
   NIMBUS · Exam mode + Flashcards
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
  // Quiz ids in Nimbus use these prefixes: found-, iam-, net-, compute-, data-, iac-, waf-, obs-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["found", "iam", "net", "compute", "data", "iac", "waf", "obs"];
  var TRACK_NAMES = {
    found: "Cloud Fundamentals & Landing Zones",
    iam: "IAM & Workload Identity",
    net: "Cloud Networking",
    compute: "Compute: VMs, Containers & Serverless",
    data: "Storage & Managed Data",
    iac: "Infrastructure as Code",
    waf: "Well-Architected",
    obs: "Observability on Cloud",
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
  var EXAM_KEY = "nb_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "nb_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
     Tracks match Nimbus's window.TRACKS ids: found, iam, net, compute, data, iac, waf, obs.
     ===================================================================== */
  var CARDS = [
    {"front":"Region","back":"A geographic area containing several data centres grouped into zones. Most services, data and prices are scoped to a region, so it is the unit for residency and disaster decisions.","track":"found"},
    {"front":"Availability zone","back":"One or more data centres inside a region with independent power, cooling and networking. Spreading across two or more zones lets a workload survive a facility failure.","track":"found"},
    {"front":"Zone name vs zone ID (AWS)","back":"Zone names like us-east-1a are mapped to physical zones per account; zone IDs like use1-az1 are stable across accounts. Align on IDs when accounts must share a zone.","track":"found"},
    {"front":"Edge location","back":"A small metro site that caches content and terminates connections near users for CDN, DNS and WAF. It does not run general workloads.","track":"found"},
    {"front":"Shared responsibility model","back":"The split of security duties between provider and customer, which shifts with the service model. Data and identity always stay with the customer.","track":"found"},
    {"front":"IaaS vs PaaS vs FaaS","back":"IaaS hands you the OS and up; PaaS hands you code, config and data; functions hand you only code, dependencies, triggers and the role. Each step trades control for less operational work.","track":"found"},
    {"front":"Google Cloud VPC scope","back":"A Google Cloud VPC is a global resource with regional subnets, unlike regional AWS VPCs and Azure VNets. One network can span many regions.","track":"found"},
    {"front":"AWS Organizations OU","back":"An organizational unit groups accounts so policies such as SCPs inherit to every account below it. OUs nest up to five levels under the root.","track":"found"},
    {"front":"Azure management group","back":"A container above subscriptions where Azure Policy and RBAC assignments inherit downward. It plays the role of an AWS OU; up to six levels below the root.","track":"found"},
    {"front":"Google Cloud project","back":"The unit that holds resources, enabled APIs, quotas and a billing link, grouped under folders and the organisation. It sits in the same slot as an AWS account or Azure subscription.","track":"found"},
    {"front":"Account as blast radius","back":"An AWS account is a hard boundary for IAM, quotas and billing, so incidents stop at its edge unless access was deliberately granted. Hence one account per workload per environment.","track":"found"},
    {"front":"Landing zone","back":"A pre-built, governed multi-account environment defined as code: hierarchy, shared accounts, identity, networking, logging and guardrails. New accounts are vended into it already compliant.","track":"found"},
    {"front":"AWS Control Tower","back":"A managed service that builds an AWS landing zone with Log Archive and Audit accounts, curated controls and Account Factory. Its controls were formerly called guardrails.","track":"found"},
    {"front":"Service control policy (SCP)","back":"An organisation policy that caps the maximum permissions in member accounts, including their root users. It never grants and does not apply to the management account.","track":"found"},
    {"front":"Log archive account","back":"A dedicated account receiving the organisation trail, Config history and other logs, administered separately from workloads. It keeps evidence out of reach of whoever caused an incident.","track":"found"},
    {"front":"Multi-cloud vs cloud-agnostic","back":"Multi-cloud places different workloads on different providers; cloud-agnostic makes one workload portable between them. The second gives up most managed services and is rarely tested.","track":"found"},
    {"front":"Implicit deny","back":"The default outcome when no policy allows a request. Any allowed action must be explicitly granted and survive every applicable ceiling.","track":"iam"},
    {"front":"Explicit deny","back":"A matching Deny statement in any applicable AWS policy. It overrides every Allow, so it is the first thing evaluation checks.","track":"iam"},
    {"front":"Identity-based policy","back":"A policy attached to a user, group or role saying what that principal may do. It has no Principal element because the holder is implied.","track":"iam"},
    {"front":"Resource-based policy","back":"A policy attached to a resource such as a bucket, queue or key, naming which principals may act on it. Cross-account access needs it plus the caller's identity policy.","track":"iam"},
    {"front":"Trust policy","back":"The resource-based policy on an IAM role that says who may assume it. The role's permission policies separately say what the session can do.","track":"iam"},
    {"front":"sts:AssumeRole","back":"The STS call that exchanges a principal's identity for temporary role credentials, by default for one hour and up to twelve. Role chaining caps sessions at one hour.","track":"iam"},
    {"front":"Confused deputy","back":"A trusted intermediary is tricked into using its authority for the wrong party. For third parties assuming your role, a per-tenant ExternalId condition prevents it.","track":"iam"},
    {"front":"Permission boundary","back":"A managed policy that sets the maximum permissions for one user or role. It enables safe delegation of role creation without privilege escalation.","track":"iam"},
    {"front":"Session policy","back":"A policy passed when assuming a role or federating that further restricts that one session. Effective permissions are the intersection with the role's policies.","track":"iam"},
    {"front":"Resource control policy (RCP)","back":"An AWS Organizations policy that caps access to resources in member accounts for supported services. It is used to keep data inside an organisation's perimeter.","track":"iam"},
    {"front":"ABAC","back":"Attribute-based access control: grant by comparing tags on the caller with tags on the resource. One policy scales across many teams if tag changes are tightly governed.","track":"iam"},
    {"front":"GitHub OIDC sub claim","back":"A string such as repo:acme/payments:ref:refs/heads/main identifying the workflow context. Pin it exactly in the trust policy; wildcards or no sub check let other repos in.","track":"iam"},
    {"front":"Azure role assignment","back":"The binding of a principal, a role definition and a scope (management group, subscription, resource group or resource). It inherits to everything below its scope.","track":"iam"},
    {"front":"Managed identity (system vs user-assigned)","back":"Azure-managed credentials for a resource. System-assigned lives and dies with one resource; user-assigned is standalone and can be shared by many.","track":"iam"},
    {"front":"Service account key (Google Cloud)","back":"A downloadable JSON private key for a service account that stays valid until deleted. It is an anti-pattern; use attached service accounts or Workload Identity Federation instead.","track":"iam"},
    {"front":"Workload Identity Federation","back":"Exchanging an external OIDC or SAML token for short-lived cloud credentials, with claim mapping and conditions. Available on Google Cloud, Azure and (as OIDC providers) AWS.","track":"iam"},
    {"front":"CIDR prefix length","back":"The number of fixed leading bits in an address block. A /n block holds 2^(32-n) IPv4 addresses, so each extra bit halves the block.","track":"net"},
    {"front":"Reserved addresses per subnet","back":"AWS and Azure keep 5 addresses in every subnet and GCP keeps 4, so an AWS /24 has 251 usable addresses and a /28 has 11.","track":"net"},
    {"front":"Network scope: AWS vs Azure vs GCP","back":"AWS VPCs are regional with subnets in one AZ, Azure VNets are regional with zone-spanning subnets, and GCP VPC networks are global with regional subnets.","track":"net"},
    {"front":"Longest-prefix match","back":"When several routes contain a destination, the router uses the one with the longest prefix. Row order in the table does not matter.","track":"net"},
    {"front":"Public subnet (AWS)","back":"A subnet whose route table sends 0.0.0.0/0 to an internet gateway. Instances still need a public IP and a permitting security group to be reachable.","track":"net"},
    {"front":"NAT gateway per AZ","back":"AWS NAT gateways are zonal, so resilient designs place one in each AZ and route each AZ to its local gateway, avoiding AZ dependency and cross-AZ data charges.","track":"net"},
    {"front":"Egress-only internet gateway","back":"An AWS gateway for IPv6 that lets instances start outbound connections while blocking unsolicited inbound ones, since IPv6 has no NAT.","track":"net"},
    {"front":"Security group","back":"An AWS stateful, allow-only filter on a network interface. Replies to allowed connections pass automatically, and rules can reference other security groups.","track":"net"},
    {"front":"Network ACL","back":"An AWS stateless subnet filter with numbered allow and deny rules evaluated lowest first. Return traffic needs its own rule, usually the ephemeral port range.","track":"net"},
    {"front":"Ephemeral ports","back":"Short-lived client source ports that replies return to. Ranges vary by OS, so stateless return rules commonly open 1024-65535.","track":"net"},
    {"front":"VPC peering transitivity","back":"Peering connects exactly two networks and is non-transitive on all three clouds. A peered to B and B peered to C does not let A reach C.","track":"net"},
    {"front":"Transit Gateway","back":"An AWS regional hub that VPCs, VPNs and Direct Connect attach to, with multiple route tables for segmentation. Azure Virtual WAN and GCP Network Connectivity Center fill similar roles.","track":"net"},
    {"front":"Gateway vs interface endpoint","back":"Gateway endpoints add a free prefix-list route for S3 and DynamoDB only. Interface endpoints place billed ENIs with private IPs in your subnets for most other services.","track":"net"},
    {"front":"Private Service Connect","back":"GCP's way to reach Google APIs or published producer services through an internal IP in your VPC, comparable to AWS PrivateLink and Azure Private Endpoint.","track":"net"},
    {"front":"Route 53 alias record","back":"A record that looks like an A or AAAA answer but follows an AWS target's changing addresses, allowed at the zone apex where CNAMEs are not.","track":"net"},
    {"front":"VPC flow logs","back":"Connection metadata (addresses, ports, protocol, bytes, accept or reject) aggregated per interval. They record no packet payloads and should be on for every network.","track":"net"},
    {"front":"EC2 instance type name (e.g. c7gn.2xlarge)","back":"Family letter, generation digit, processor and attribute letters, then size. c = compute optimized, 7 = generation, g = Graviton, n = extra networking, 2xlarge = 8 vCPU.","track":"compute"},
    {"front":"Graviton","back":"AWS's Arm-based server CPU. Portable runtimes usually move with a rebuild and often gain price-performance; Azure Cobalt and GCP Axion are the loose equivalents.","track":"compute"},
    {"front":"Golden image","back":"A pre-built, hardened, versioned VM image (AMI, Azure Compute Gallery image, GCP image family) produced by a pipeline so every instance boots identically and fast.","track":"compute"},
    {"front":"IMDSv2","back":"The session-token version of the EC2 metadata service: a PUT with a TTL header returns a token required on every read, with a hop limit, which defeats most SSRF credential theft. Require it; never allow IMDSv1.","track":"compute"},
    {"front":"Compute Savings Plan","back":"A one- or three-year $/hour spend commitment that discounts EC2, Fargate and Lambda across families and regions. Azure savings plan for compute and GCP flexible CUDs are the analogues.","track":"compute"},
    {"front":"Spot interruption notice","back":"EC2 gives about two minutes' warning via metadata and EventBridge before reclaiming a Spot Instance; Azure and GCP Spot VMs typically give around 30 seconds.","track":"compute"},
    {"front":"Target tracking scaling","back":"A thermostat-style policy that adds or removes capacity to hold a metric, such as CPU or requests per target, near a chosen value.","track":"compute"},
    {"front":"Warm pool","back":"A set of pre-initialised instances kept stopped or running beside an Auto Scaling group so scale-out skips slow boot and bootstrap steps.","track":"compute"},
    {"front":"Instance refresh","back":"An Auto Scaling group operation that replaces instances in batches with a new launch template version, honouring a minimum healthy percentage, checkpoints and optional alarm-based rollback.","track":"compute"},
    {"front":"ECS task role vs execution role","back":"The task role is assumed by your application code; the execution role is used by the ECS agent to pull the image, write logs and fetch secrets before the code starts.","track":"compute"},
    {"front":"Karpenter","back":"A Kubernetes node provisioner that launches right-sized instances directly for unschedulable pods and consolidates under-used nodes, used mainly with EKS.","track":"compute"},
    {"front":"EKS Pod Identity","back":"Maps a Kubernetes service account to an IAM role through an EKS association and agent, without a per-cluster OIDC provider; the successor-style alternative to IRSA.","track":"compute"},
    {"front":"GKE Autopilot","back":"A GKE mode where Google manages nodes and you pay for pod resource requests, in exchange for guardrails on privileged and node-level workloads.","track":"compute"},
    {"front":"Lambda concurrency","back":"The number of execution environments busy at once, roughly requests per second multiplied by average duration in seconds; capped by a regional quota.","track":"compute"},
    {"front":"Provisioned concurrency","back":"Lambda environments initialised ahead of traffic and billed while idle, removing cold starts for latency-sensitive paths. Cloud Run min instances and Azure always-ready instances are similar.","track":"compute"},
    {"front":"Step Functions Standard vs Express","back":"Standard runs up to a year with exactly-once state transitions and full history; Express runs up to five minutes, at-least-once, for high-volume short events.","track":"compute"},
    {"front":"S3 consistency","back":"Strong read-after-write consistency for all PUTs, overwrites, deletes and LISTs, with no extra cost or configuration.","track":"data"},
    {"front":"Block Public Access","back":"Account- and bucket-level S3 switches that override any policy or ACL granting public access; on by default for new buckets and should stay on.","track":"data"},
    {"front":"SSE-KMS","back":"S3 server-side encryption with a KMS key you control, adding key-policy access control and an audit trail of every decrypt; use S3 Bucket Keys to cut KMS request cost.","track":"data"},
    {"front":"Object Lock compliance mode","back":"WORM retention on S3 objects that nobody, including the account root user, can shorten or remove until it expires.","track":"data"},
    {"front":"Minimum storage duration","back":"The shortest period a colder storage class bills for, even if you delete early: 30 days for Standard-IA, 90 for Glacier Instant and Flexible, 180 for Deep Archive.","track":"data"},
    {"front":"Intelligent-Tiering","back":"An S3 class that moves objects between access tiers based on observed access, with no retrieval fees but a small per-object monitoring fee; GCS Autoclass is the loose analogue.","track":"data"},
    {"front":"Lifecycle rule","back":"A bucket policy that transitions objects to colder classes, expires them, removes old versions and aborts incomplete multipart uploads on a schedule.","track":"data"},
    {"front":"gp3","back":"The general-purpose EBS SSD volume with a 3,000 IOPS and 125 MB/s baseline at any size, with extra IOPS and throughput bought independently.","track":"data"},
    {"front":"EFS","back":"AWS's regional, elastic NFS file system that many Linux instances across AZs mount at once; Azure Files (NFS) and GCP Filestore are the analogues.","track":"data"},
    {"front":"RDS Multi-AZ vs read replica","back":"Multi-AZ adds a synchronous standby for automatic failover; a read replica is an asynchronous copy for read scaling or DR that you promote manually.","track":"data"},
    {"front":"Aurora storage","back":"A distributed volume keeping six copies across three AZs, shared by the writer and up to 15 readers, which keeps replica lag low and failover fast.","track":"data"},
    {"front":"RCU and WCU","back":"DynamoDB capacity units: one RCU is a strongly consistent read per second of up to 4 KB (half for eventual, double for transactional); one WCU is a write per second of up to 1 KB.","track":"data"},
    {"front":"Hot partition","back":"A partition receiving a disproportionate share of traffic because one key value is popular; it throttles at roughly 3,000 RCU or 1,000 WCU however large the table is.","track":"data"},
    {"front":"Kinesis shard","back":"The unit of a Kinesis data stream: 1 MB/s or 1,000 records/s in, 2 MB/s out, with ordering per partition key.","track":"data"},
    {"front":"Partition pruning","back":"Skipping whole partitions of a lake or warehouse table because the query filters on the partition column, which cuts bytes scanned and cost.","track":"data"},
    {"front":"Storage-compute separation","back":"A warehouse design where data lives in cheap durable storage and query compute is bought separately, as in BigQuery, Redshift RA3 or Serverless, and Fabric.","track":"data"},
    {"front":"Terraform state","back":"The file mapping every resource address in your configuration to a real object ID in the cloud. Terraform diffs config against state and reality to build a plan.","track":"iac"},
    {"front":"terraform plan","back":"Computes the changes needed to make real infrastructure match the configuration and shows them as create, update, replace or destroy actions without changing anything.","track":"iac"},
    {"front":"Remote backend with locking","back":"Shared state in object storage (S3 with locking, Azure Blob with leases, GCS) so that a team can collaborate and two applies cannot run at once.","track":"iac"},
    {"front":"Provider","back":"A plugin that maps Terraform resources to one platform's API, such as aws, azurerm or google. Pin its version in required_providers and commit the lock file.","track":"iac"},
    {"front":"count vs for_each","back":"count addresses instances by index, so removing a middle item shifts and replaces the rest; for_each addresses them by stable key, so only the removed key is destroyed.","track":"iac"},
    {"front":"moved block","back":"Declares that a resource address changed (rename or move into a module) so Terraform updates state instead of destroying and recreating the object.","track":"iac"},
    {"front":"Drift","back":"A difference between real infrastructure and what IaC last applied, usually from console edits. Detected by a scheduled plan; fixed by reverting or codifying the change.","track":"iac"},
    {"front":"Module","back":"A reusable directory of Terraform with input variables and outputs. Version it, keep its interface small, and compose environments from modules rather than copying code.","track":"iac"},
    {"front":"Plan-then-apply pipeline","back":"CI runs fmt, validate, policy checks and plan on a pull request; after review, apply runs the saved plan using a short-lived OIDC role, never a stored access key.","track":"iac"},
    {"front":"Policy as code for IaC","back":"Automated checks on a plan or template, such as OPA/Conftest, Checkov or Sentinel, that fail the pipeline on violations like public buckets or wildcard IAM.","track":"iac"},
    {"front":"CloudFormation change set","back":"CloudFormation's preview of what an update to a stack will create, modify or replace, reviewed before execution. The provider tracks stack state for you.","track":"iac"},
    {"front":"AWS CDK","back":"A framework that defines infrastructure in a general-purpose language and synthesizes CloudFormation templates; constructs package sensible defaults.","track":"iac"},
    {"front":"Bicep","back":"Azure's declarative IaC language that compiles to ARM templates. State lives in Azure itself; what-if previews changes before a deployment.","track":"iac"},
    {"front":"Sensitive values in state","back":"State can contain secrets in plain text even when outputs are marked sensitive, so the backend must be encrypted and access to it tightly restricted.","track":"iac"},
    {"front":"Well-Architected pillars (AWS)","back":"Operational excellence, security, reliability, performance efficiency, cost optimization and sustainability. Azure has five of these and treats sustainability as separate guidance.","track":"waf"},
    {"front":"RTO","back":"Recovery time objective: the maximum acceptable time a service may be unavailable after a disaster.","track":"waf"},
    {"front":"RPO","back":"Recovery point objective: the maximum acceptable amount of data loss, measured as time before the failure. Replication lag at the moment of failure is what you actually lose.","track":"waf"},
    {"front":"Pilot light","back":"A DR strategy in which data replicates continuously to the recovery region while compute is defined in IaC but scaled to zero until a failover.","track":"waf"},
    {"front":"Warm standby","back":"A DR strategy that keeps a smaller but complete copy of the stack running in a second region, ready to scale up and take traffic within minutes.","track":"waf"},
    {"front":"Static stability","back":"A design that survives losing a failure domain, such as a zone, without provisioning new capacity, because the survivors already have enough headroom.","track":"waf"},
    {"front":"Exponential backoff with jitter","back":"Retrying after growing, randomized delays so clients that failed together do not retry in synchronized waves. Pair it with a retry budget.","track":"waf"},
    {"front":"Bulkhead","back":"Isolating resources such as thread pools or connection pools per dependency or tenant, so one slow component cannot exhaust capacity for everything else.","track":"waf"},
    {"front":"Envelope encryption","back":"A data key encrypts the data locally, and the KMS key encrypts that data key. Access to the KMS key is the control point and is fully audited.","track":"waf"},
    {"front":"Game day","back":"A scheduled exercise that injects a real failure, for example with AWS Fault Injection Service or Azure Chaos Studio, to test detection, response and recovery time.","track":"waf"},
    {"front":"FinOps loop","back":"Inform (allocate and show spend), optimize (remove waste, rightsize, better rates), operate (budgets, reviews and automation as routine).","track":"waf"},
    {"front":"Unit economics","back":"Cost per unit of business value, such as per order or per active customer. It shows efficiency even while the total bill grows.","track":"waf"},
    {"front":"NAT processing charge","back":"A per-GB fee on traffic through a managed NAT gateway, on top of the hourly fee. Gateway endpoints for object storage and NoSQL avoid it for that traffic.","track":"waf"},
    {"front":"Commit after rightsizing","back":"Buy Savings Plans, reservations or committed use discounts only for the steady baseline left after removing waste and rightsizing, or you lock in waste.","track":"waf"},
    {"front":"Metrics, logs, traces","back":"Metrics show that something is wrong cheaply, logs explain what happened in detail, and traces show where a request spent its time across services.","track":"obs"},
    {"front":"CloudWatch Logs Insights","back":"The interactive, pipe-style query engine for CloudWatch Logs, billed by data scanned. Azure uses KQL in Log Analytics and GCP offers Logs Explorer and SQL-based Log Analytics.","track":"obs"},
    {"front":"KQL","back":"Kusto Query Language, the pipe-based language used to query Azure Log Analytics workspaces, Application Insights and many Azure Monitor alerts.","track":"obs"},
    {"front":"ADOT","back":"The AWS Distro for OpenTelemetry: a supported OpenTelemetry collector and SDK bundle that exports traces and metrics to X-Ray, CloudWatch or other backends.","track":"obs"},
    {"front":"Application Insights","back":"Azure Monitor's application performance feature for requests, dependencies, exceptions and distributed traces, stored in a Log Analytics workspace.","track":"obs"},
    {"front":"Evaluation periods vs datapoints to alarm","back":"N is how many recent periods an alarm looks at and M is how many of those must breach. M of N filters one-off spikes at the cost of detection delay.","track":"obs"},
    {"front":"Treat missing data","back":"How a CloudWatch alarm scores absent datapoints: missing, notBreaching, breaching or ignore. Breaching suits heartbeats; notBreaching suits sparse error counts.","track":"obs"},
    {"front":"Composite alarm","back":"A CloudWatch alarm whose state is a boolean expression over other alarms, used to page once per user-facing symptom instead of once per cause.","track":"obs"},
    {"front":"Error budget burn rate","back":"The observed error ratio divided by the ratio the SLO allows. A high burn over a short window pages; a slow burn over days opens a ticket.","track":"obs"},
    {"front":"Anomaly detection band","back":"A learned expected range for a metric, so an alarm fires on deviation from normal rather than a fixed number. Azure calls the idea dynamic thresholds.","track":"obs"},
    {"front":"CloudTrail management vs data events","back":"Management events record control-plane calls and appear in event history by default. Data events record calls against data such as S3 object reads, are opt-in and are billed.","track":"obs"},
    {"front":"Organization trail","back":"A CloudTrail trail created at the organization level that automatically logs every member account, usually delivered to a locked log archive account.","track":"obs"},
    {"front":"GCP Cloud Audit Logs","back":"Admin Activity logs are always on and free; Data Access logs are mostly off by default and billable; System Event and Policy Denied logs cover platform actions and denials.","track":"obs"},
    {"front":"Tail sampling","back":"Deciding whether to keep a trace after it finishes, so every error and slow request is retained while routine successful traces are sampled down.","track":"obs"},
    {"front":"The 7 Rs of migration","back":"Retire, retain, rehost, relocate, repurchase, replatform and refactor: the per-application choices in a cloud migration, from switching it off to re-architecting it.","track":"found"},
    {"front":"Replatform","back":"Lift, tinker and shift: swap components for managed equivalents, such as self-managed MySQL to RDS, without re-architecting the application.","track":"found"},
    {"front":"Migration wave","back":"A group of dependent applications moved together, built from discovery and dependency mapping so that nothing loses a database or service it still calls.","track":"found"},
    {"front":"Role chaining","back":"Assuming a role with credentials from another assumed role. The chained session is capped at one hour, and each hop needs its own trust and permission.","track":"iam"},
    {"front":"sts:SourceIdentity","back":"An attribute set when the first role is assumed that persists through every chained hop, cannot be changed later, and is logged on every CloudTrail event.","track":"iam"},
    {"front":"Transitive session tag","back":"A session tag that survives role chaining, so ABAC attributes like team cannot be dropped or overridden by a later hop.","track":"iam"},
    {"front":"KMS key policy","back":"The resource policy every KMS key has. It is the root of access: IAM policies work only if the key policy delegates to the account, and cross-account use needs both.","track":"iam"},
    {"front":"KMS grant","back":"A programmatic, revocable delegation of specific operations on one key to a principal, used by services such as EBS to act on your behalf.","track":"iam"},
    {"front":"Encryption context","back":"Non-secret key-value pairs bound to a ciphertext as additional authenticated data. Decrypt fails if they differ, and CloudTrail records them.","track":"iam"},
    {"front":"KMS key rotation","back":"New key material behind the same key ID and ARN; old material is kept for decryption, so existing ciphertext needs no re-encryption.","track":"iam"},
    {"front":"Secrets Manager vs Parameter Store","back":"Secrets Manager rotates and replicates credentials at a per-secret cost; Parameter Store holds hierarchical configuration and SecureString values cheaply, without native rotation.","track":"iam"},
    {"front":"VPC Lattice","back":"An application-layer service network that lets services call each other across VPCs and accounts by name with IAM auth policies, without peering or routing, even with overlapping CIDRs.","track":"net"},
    {"front":"SQS visibility timeout","back":"How long a received message stays hidden from other consumers. Set it well above processing time (at least six times a Lambda consumer's timeout) or messages are processed twice.","track":"compute"},
    {"front":"SNS or EventBridge to SQS fan-out","back":"Publish once and subscribe one queue per consumer, so each service has its own backlog, retries and dead-letter queue.","track":"compute"},
    {"front":"EventBridge archive and replay","back":"Keep events from a bus and resend them later, for example after fixing a consumer bug.","track":"compute"},
    {"front":"Claim-check pattern","back":"Store a large payload in object storage and send only its key in the message, keeping events under service size limits.","track":"compute"},
    {"front":"Transactional outbox","back":"Write the state change and an outbox record in one transaction, then publish from the outbox, so a commit and its event never diverge.","track":"compute"},
    {"front":"terraform test","back":"Native Terraform testing with .tftest.hcl files of run blocks and assertions; command = plan with mock providers creates nothing, command = apply runs real integration tests.","track":"iac"},
    {"front":"Precondition vs check block","back":"A precondition or postcondition fails the run when false; a check block reports a warning each run without blocking.","track":"iac"},
    {"front":"Sentinel enforcement levels","back":"Advisory (warn), soft mandatory (can be overridden by an authorized user) and hard mandatory (cannot be overridden), in HCP Terraform and Terraform Enterprise.","track":"iac"},
    {"front":"Compute Savings Plan","back":"A one- or three-year commitment to a dollar-per-hour compute spend that applies across instance families, regions, Fargate and Lambda.","track":"waf"},
    {"front":"Tag policy","back":"An AWS Organizations policy that standardizes tag keys and allowed values across accounts; pair it with default tags in IaC and activated cost allocation tags.","track":"waf"},
    {"front":"Data perimeter","back":"Organization-wide guardrails ensuring only trusted identities access trusted resources from expected networks, using conditions like aws:PrincipalOrgID and aws:ResourceOrgID.","track":"waf"},
    {"front":"AWS Elastic Disaster Recovery","back":"Block-level replication of servers to a staging area in another region, with recovery instances launched on demand: a managed pilot-light pattern.","track":"waf"},
    {"front":"CloudWatch Embedded Metric Format","back":"Structured JSON log lines that CloudWatch extracts into metrics asynchronously, so custom metrics need no API call in the request path.","track":"obs"},
    {"front":"CloudWatch cross-account observability","back":"Links source accounts or a whole organization to a monitoring account that queries their metrics, logs and traces in place.","track":"obs"},
    {"front":"Container Insights","back":"Curated container and Kubernetes metrics and logs for ECS and EKS in CloudWatch; Azure Monitor and GKE offer equivalents.","track":"obs"},
    {"front":"Synthetic canary","back":"A scripted user journey run on a schedule from outside the service, catching broken logins, DNS or certificates even with no real traffic.","track":"obs"},
    {"front":"GuardDuty delegated administrator","back":"A security tooling account that administers GuardDuty for the whole organization, auto-enables new accounts and aggregates findings.","track":"obs"},
    {"front":"CNAPP","back":"A cloud-native application protection platform, such as Wiz, that joins posture, vulnerabilities, identities and data into one cross-cloud risk graph with attack paths.","track":"obs"}
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
        el("p", { class: "fc-sub" }, "Flip through key cloud terms \u2014 AWS first, with the Azure and Google Cloud names alongside \u2014 and self-grade each one. Your progress saves locally in this browser.")
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
