/* =====================================================================
   SUMMIT · Exam simulator, study plans, readiness dashboard, flashcards
   Exposes window.AcademyExam = { mountExam, mountFlashcards, mountPlans, mountReadiness }.
   Vanilla JS, zero dependencies, fully offline. Reads window.QUIZZES,
   window.TRACKS and window.SUMMIT_CARDS at call time. Nodes are built with
   createElement; quiz- and user-derived strings only ever become text nodes.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- DOM helpers ---------------- */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") node.className = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
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
  function examIco(cls) { return ico("0 0 24 24", [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 6v6l4 2" }]], cls); }
  function flashIco(cls) { return ico("0 0 24 24", [["rect", { x: 3, y: 5, width: 18, height: 14, rx: 2 }], ["path", { d: "M3 10h18" }]], cls); }
  function planIco(cls) { return ico("0 0 24 24", [["rect", { x: 3, y: 4, width: 18, height: 17, rx: 2 }], ["path", { d: "M3 9h18M8 2v4M16 2v4M8 14l2 2 4-4" }]], cls); }
  function gaugeIco(cls) { return ico("0 0 24 24", [["path", { d: "M4 18a8 8 0 1 1 16 0" }], ["path", { d: "M12 18l4-6" }]], cls); }
  function checkIco() { return ico("0 0 24 24", [["path", { d: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" }]]); }
  function emptyState(title, body) { return el("div", { class: "empty-state" }, checkIco(), el("h3", {}, title), el("p", {}, body)); }
  function optionEl(value, label, selected) { var o = el("option", { value: value }, label); if (selected) o.setAttribute("selected", "selected"); return o; }
  function pct(c, t) { return t ? Math.round((c / t) * 100) : 0; }
  function fmtTime(s) { s = Math.max(0, s | 0); var m = Math.floor(s / 60), ss = s % 60; return m + ":" + String(ss).padStart(2, "0"); }
  function fmtDate(iso) { try { var d = new Date(iso); return d.toISOString().slice(0, 10); } catch (e) { return "-"; } }

  var LETTERS = ["A", "B", "C", "D", "E", "F"];
  var CONF = [{ id: "guess", label: "Guess" }, { id: "unsure", label: "Unsure" }, { id: "sure", label: "Sure" }];
  var TARGET = 75;

  /* ---------------- storage ---------------- */
  var SESSION_KEY = "su_exam_session_v1";
  var HIST_KEY = "su_exam_hist_v1";
  var FLASH_KEY = "su_flash_v1";
  var PLAN_KEY = "su_plan_v1";
  var PROGRESS_KEY = "su_progress_v1";
  var WEAK_KEY = "su_weak_v1";
  function readJSON(key, dflt) { try { var v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? dflt : v; } catch (e) { return dflt; } }
  function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function removeKey(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function readFlash() { var m = readJSON(FLASH_KEY, {}); return m && typeof m === "object" ? m : {}; }
  function saveFlash(map) { writeJSON(FLASH_KEY, map); }
  function readHist() { var h = readJSON(HIST_KEY, []); return Array.isArray(h) ? h : []; }
  function doneSet() { var a = readJSON(PROGRESS_KEY, []); return new Set(Array.isArray(a) ? a : []); }
  function feedWeakSpot(qid, ok) {
    try { var host = window.Academy; if (host && typeof host.recordAnswer === "function") host.recordAnswer(qid, ok); } catch (e) {}
  }

  /* ---------------- content index ---------------- */
  function trackIds() { return Object.keys(window.TRACKS || {}); }
  function trackOf(id) { return (window.TRACKS || {})[id] || null; }
  function trackLabel(id) { var t = trackOf(id); return t ? t.name : id; }
  function trackShort(id) { var t = trackOf(id); return t ? (t.short || t.name) : id; }

  // quiz id -> { track, module, moduleName, route, lessonTitle }
  function quizIndex() {
    var map = {};
    trackIds().forEach(function (tid) {
      var t = trackOf(tid);
      (t.modules || []).forEach(function (m) {
        (m.lessons || []).forEach(function (l) {
          (l.blocks || []).forEach(function (b) {
            if (b && b.t === "quiz" && b.id) {
              map[b.id] = { track: tid, module: m.id, moduleName: m.name, route: "#/" + tid + "/" + m.id + "/" + l.id, lessonTitle: l.title };
            }
          });
        });
      });
    });
    return map;
  }
  function domainKey(track, module) { return track + "/" + module; }
  function domainName(key) {
    var p = key.split("/"), t = trackOf(p[0]);
    if (!t) return key;
    if (p.length < 2) return t.name;
    for (var i = 0; i < t.modules.length; i++) if (t.modules[i].id === p[1]) return trackShort(p[0]) + " · " + t.modules[i].name;
    return key;
  }
  // Every question as a flat record. qid matches app.js (`quizId#index`).
  function questionPool() {
    var Q = window.QUIZZES || {}, idx = quizIndex(), out = [];
    Object.keys(Q).forEach(function (qzid) {
      var meta = idx[qzid];
      if (!meta) return;
      (Q[qzid].questions || []).forEach(function (qq, i) {
        if (!qq || !Array.isArray(qq.options) || typeof qq.answer !== "number") return;
        out.push({ qid: qzid + "#" + i, quiz: qzid, track: meta.track, domain: domainKey(meta.track, meta.module), route: meta.route, lessonTitle: meta.lessonTitle, q: qq.q, options: qq.options, answer: qq.answer, explain: qq.explain || "" });
      });
    });
    return out;
  }
  function poolMap() { var m = {}; questionPool().forEach(function (r) { m[r.qid] = r; }); return m; }

  /* ---------------- seeded randomness ---------------- */
  function seedNum(text) {
    var s = String(text == null ? "" : text), x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleWith(arr, rnd) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function freshSeed() { return String(100000 + Math.floor(Math.random() * 900000)); }

  /* Stratified, seeded selection: each chosen domain gets a share of the
     question count proportional to its pool size (at least one where possible). */
  function selectItems(cfg) {
    var rnd = mulberry32(seedNum(cfg.seed));
    var pool = questionPool().filter(function (r) {
      if (cfg.track !== "all" && r.track !== cfg.track) return false;
      var key = cfg.track === "all" ? r.track : r.domain;
      if (cfg.domains && cfg.domains.length && cfg.domains.indexOf(key) === -1) return false;
      if (cfg.only && cfg.only.length && cfg.only.indexOf(r.qid) === -1) return false;
      return true;
    });
    pool.sort(function (a, b) { return a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0; });
    var groups = {}, keys = [];
    pool.forEach(function (r) { var k = cfg.track === "all" ? r.track : r.domain; if (!groups[k]) { groups[k] = []; keys.push(k); } groups[k].push(r); });
    keys.forEach(function (k) { shuffleWith(groups[k], rnd); });
    var count = Math.min(cfg.count, pool.length);
    var quota = {}, given = 0;
    keys.forEach(function (k) { quota[k] = Math.min(groups[k].length, Math.floor((count * groups[k].length) / pool.length)); given += quota[k]; });
    var guard = 0;
    while (given < count && guard++ < 10000) {
      var best = null;
      keys.forEach(function (k) { if (quota[k] < groups[k].length && (best === null || quota[k] / groups[k].length < quota[best] / groups[best].length)) best = k; });
      if (best === null) break;
      quota[best]++; given++;
    }
    var picked = [];
    keys.forEach(function (k) { picked = picked.concat(groups[k].slice(0, quota[k])); });
    shuffleWith(picked, rnd);
    return picked.map(function (r) {
      return { qid: r.qid, order: shuffleWith(r.options.map(function (_, i) { return i; }), rnd), picked: -1, flag: false, conf: null };
    });
  }

  /* ---------------- session persistence ---------------- */
  function loadSession() {
    var s = readJSON(SESSION_KEY, null);
    if (!s || s.v !== 1 || !Array.isArray(s.items) || !s.items.length) return null;
    return s;
  }
  function saveSession(s) { writeJSON(SESSION_KEY, s); }
  function clearSession() { removeKey(SESSION_KEY); }

  /* =====================================================================
     EXAM SIMULATOR
     ===================================================================== */
  function mountExam(mountEl) {
    if (!mountEl) return;
    var timerId = null;
    var keyHandler = null;
    var root = null;
    var preset = null;

    function stopTimer() { if (timerId) { clearTimeout(timerId); timerId = null; } }
    function detachKeys() { if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; } }
    function reset() {
      stopTimer(); detachKeys(); clearNode(mountEl);
      root = el("div", { class: "exam-page su-exam" });
      mountEl.appendChild(root);
      return root;
    }
    function head(title, sub) {
      return el("header", { class: "exam-head" }, examIco("exam-ico"), el("div", {}, el("h1", { class: "exam-title" }, title), el("p", { class: "exam-sub" }, sub)));
    }

    /* ---------- setup ---------- */
    function renderSetup() {
      var page = reset();
      page.appendChild(head("Exam simulator", "Original, unofficial practice questions. Timed or untimed, seeded and repeatable. Everything stays in this browser."));
      page.appendChild(el("p", { class: "note-inline" }, "Scores here are practice signals, not predictions of an official result. Verify current official objectives, formats and passing rules with each certification program."));

      var saved = loadSession();
      if (saved) {
        var answered = saved.items.filter(function (it) { return it.picked >= 0; }).length;
        var resumeBtn = el("button", { type: "button", class: "btn btn-primary" }, "Resume exam");
        var discardBtn = el("button", { type: "button", class: "btn btn-ghost" }, "Discard");
        resumeBtn.addEventListener("click", function () { runSession(saved); });
        discardBtn.addEventListener("click", function () { clearSession(); renderSetup(); });
        page.appendChild(el("div", { class: "exam-resume", role: "status" },
          el("div", {}, el("strong", {}, "Paused exam found. "),
            (saved.cfg.track === "all" ? "Mixed" : trackShort(saved.cfg.track)) + " · " + answered + " of " + saved.items.length + " answered · seed " + saved.cfg.seed +
            (saved.cfg.timed ? " · " + fmtTime(saved.remaining) + " left" : " · untimed")),
          el("div", { class: "su-row" }, resumeBtn, discardBtn)));
      }

      var p = preset || {};
      preset = null;
      var cfg = { track: p.track || trackIds()[0] || "all", domains: p.domains || null, count: p.count || 25, timed: p.timed != null ? p.timed : true, minutes: p.minutes || 0, seed: p.seed || freshSeed(), only: p.only || null };

      var form = el("div", { class: "exam-config" });
      page.appendChild(form);

      function row(label, control, forId) {
        return el("div", { class: "exam-config-row" }, el(forId ? "label" : "span", { class: "exam-config-label", for: forId || null }, label), el("div", { class: "exam-config-control" }, control));
      }
      function segGroup(label, opts, activeVal, onPick) {
        var box = el("div", { class: "w-seg", role: "group", "aria-label": label });
        var btns = opts.map(function (o) {
          var on = o.v === activeVal;
          var b = el("button", { type: "button", class: "w-seg-btn" + (on ? " active" : ""), "aria-pressed": on ? "true" : "false" }, o.l);
          b.addEventListener("click", function () {
            btns.forEach(function (x) { x.classList.remove("active"); x.setAttribute("aria-pressed", "false"); });
            b.classList.add("active"); b.setAttribute("aria-pressed", "true");
            onPick(o.v);
          });
          box.appendChild(b);
          return b;
        });
        return box;
      }

      var certSel = el("select", { class: "exam-select", id: "suCert" });
      trackIds().forEach(function (t) { certSel.appendChild(optionEl(t, trackLabel(t), cfg.track === t)); });
      certSel.appendChild(optionEl("all", "Mixed: all certifications", cfg.track === "all"));
      form.appendChild(row("Certification", certSel, "suCert"));

      var domBox = el("fieldset", { class: "su-domains" });
      form.appendChild(row("Domains", domBox));

      var countWrap = el("div", { class: "su-row" });
      form.appendChild(row("Questions", countWrap));

      var modeWrap = el("div", { class: "su-row" });
      var minSel = el("select", { class: "exam-select", id: "suMinutes", "aria-label": "Time limit" });
      [[0, "Auto (about 90 s per question)"], [15, "15 minutes"], [30, "30 minutes"], [60, "60 minutes"], [90, "90 minutes"], [120, "120 minutes"]].forEach(function (o) { minSel.appendChild(optionEl(String(o[0]), o[1], cfg.minutes === o[0])); });
      minSel.addEventListener("change", function () { cfg.minutes = parseInt(minSel.value, 10) || 0; });
      modeWrap.appendChild(segGroup("Mode", [{ v: true, l: "Timed" }, { v: false, l: "Untimed" }], cfg.timed, function (v) { cfg.timed = v; minSel.disabled = !v; }));
      modeWrap.appendChild(minSel);
      minSel.disabled = !cfg.timed;
      form.appendChild(row("Mode", modeWrap));

      var seedIn = el("input", { class: "exam-select su-seed", id: "suSeed", type: "text", inputmode: "numeric", autocomplete: "off", spellcheck: "false", value: cfg.seed, "aria-describedby": "suSeedHelp" });
      seedIn.addEventListener("input", function () { cfg.seed = seedIn.value.trim() || "1"; });
      var reseed = el("button", { type: "button", class: "w-btn ghost" }, "New seed");
      reseed.addEventListener("click", function () { cfg.seed = freshSeed(); seedIn.value = cfg.seed; });
      form.appendChild(row("Seed", el("div", { class: "su-row" }, seedIn, reseed, el("span", { class: "su-dim", id: "suSeedHelp" }, "Same seed and settings give the same questions in the same order.")), "suSeed"));

      var srcWrap = el("div", { class: "su-row" });
      form.appendChild(row("Source", srcWrap));

      var info = el("p", { class: "su-dim", "aria-live": "polite" }, "");
      var startBtn = el("button", { type: "button", class: "btn btn-primary exam-start" }, "Start exam");
      form.appendChild(el("div", { class: "exam-config-row" }, startBtn, info));

      var useWeak = !!(cfg.only && cfg.only.length);
      function weakQids() {
        var w = readJSON(WEAK_KEY, {}) || {};
        return Object.keys(w).filter(function (k) { return w[k] && w[k].wrong > 0; });
      }
      function domainOptions() {
        if (cfg.track === "all") return trackIds().map(function (t) { return { key: t, label: trackLabel(t) }; });
        var t = trackOf(cfg.track);
        return t ? t.modules.map(function (m) { return { key: domainKey(t.id, m.id), label: m.name }; }) : [];
      }
      function availableCount() {
        var probe = { track: cfg.track, domains: cfg.domains, count: 100000, seed: "probe", only: useWeak ? (cfg.only || weakQids()) : null };
        return selectItems(probe).length;
      }
      function paintDomains() {
        clearNode(domBox);
        domBox.appendChild(el("legend", { class: "sr-only" }, "Domains to include"));
        var opts = domainOptions();
        if (!cfg.domains) cfg.domains = opts.map(function (o) { return o.key; });
        opts.forEach(function (o, i) {
          var id = "suDom" + i;
          var cb = el("input", { type: "checkbox", id: id, checked: cfg.domains.indexOf(o.key) !== -1 });
          cb.addEventListener("change", function () {
            if (cb.checked) { if (cfg.domains.indexOf(o.key) === -1) cfg.domains.push(o.key); }
            else cfg.domains = cfg.domains.filter(function (k) { return k !== o.key; });
            paintInfo();
          });
          domBox.appendChild(el("label", { class: "su-check", for: id }, cb, el("span", {}, o.label)));
        });
        var allBtn = el("button", { type: "button", class: "w-btn ghost" }, "All");
        var noneBtn = el("button", { type: "button", class: "w-btn ghost" }, "None");
        allBtn.addEventListener("click", function () { cfg.domains = opts.map(function (o) { return o.key; }); paintDomains(); });
        noneBtn.addEventListener("click", function () { cfg.domains = []; paintDomains(); });
        domBox.appendChild(el("span", { class: "su-row" }, allBtn, noneBtn));
        paintInfo();
      }
      function paintCount() {
        clearNode(countWrap);
        countWrap.appendChild(segGroup("Questions", [10, 25, 50, 65].map(function (n) { return { v: n, l: String(n) }; }), cfg.count, function (v) { cfg.count = v; paintInfo(); }));
      }
      function paintSource() {
        clearNode(srcWrap);
        srcWrap.appendChild(segGroup("Question source", [{ v: false, l: "All questions" }, { v: true, l: "Previously missed" }], useWeak, function (v) { useWeak = v; if (!v) cfg.only = null; paintInfo(); }));
      }
      function paintInfo() {
        var n = availableCount();
        var use = Math.min(cfg.count, n);
        startBtn.disabled = use === 0;
        if (!n) info.textContent = useWeak ? "No previously missed questions in this selection yet. Answer some practice questions first, or switch the source to all questions." : "Select at least one domain.";
        else info.textContent = use + " question" + (use === 1 ? "" : "s") + " will be drawn from " + n + " available" + (cfg.timed ? ", time limit " + Math.round(limitSeconds(use) / 60) + " min." : ", untimed.");
      }
      function limitSeconds(n) { return cfg.minutes ? cfg.minutes * 60 : Math.max(60, n * 90); }

      certSel.addEventListener("change", function () { cfg.track = certSel.value; cfg.domains = null; paintDomains(); });
      startBtn.addEventListener("click", function () {
        var conf = { track: cfg.track, domains: cfg.domains.slice(), count: cfg.count, timed: cfg.timed, minutes: cfg.minutes, seed: cfg.seed, only: useWeak ? (cfg.only || weakQids()) : null };
        var items = selectItems(conf);
        if (!items.length) { paintInfo(); return; }
        var limit = conf.timed ? limitSeconds(items.length) : 0;
        var s = { v: 1, cfg: conf, items: items, idx: 0, remaining: limit, limit: limit, elapsed: 0, paused: false, startedAt: new Date().toISOString() };
        saveSession(s);
        runSession(s);
      });

      paintCount(); paintSource(); paintDomains();

      var hist = readHist();
      if (hist.length) {
        var tbl = el("table", { class: "su-table" },
          el("caption", { class: "sr-only" }, "Recent simulator attempts"),
          el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Date"), el("th", { scope: "col" }, "Certification"), el("th", { scope: "col" }, "Questions"), el("th", { scope: "col" }, "Score"), el("th", { scope: "col" }, "Mode"), el("th", { scope: "col" }, "Seed"))));
        var tb = el("tbody", {});
        hist.slice(-6).reverse().forEach(function (h) {
          tb.appendChild(el("tr", {}, el("td", {}, fmtDate(h.at)), el("td", {}, h.track === "all" ? "Mixed" : trackShort(h.track)), el("td", {}, String(h.total)), el("td", {}, h.pct + "%"), el("td", {}, h.timed ? "Timed" : "Untimed"), el("td", { class: "su-mono" }, String(h.seed))));
        });
        tbl.appendChild(tb);
        page.appendChild(el("section", { class: "exam-hist" }, el("h2", { class: "exam-sec-title" }, "Recent attempts"), tbl));
      }
      scrollTop();
    }

    /* ---------- runner ---------- */
    function runSession(s) {
      var src = poolMap();
      s.items = s.items.filter(function (it) { return !!src[it.qid]; });
      if (!s.items.length) { clearSession(); renderSetup(); return; }
      if (s.idx >= s.items.length) s.idx = 0;

      var page = reset();
      var live = el("div", { class: "sr-only", "aria-live": "polite", role: "status" }, "");
      var card = el("section", { class: "exam-card", "aria-label": "Exam question" });
      var badge = el("span", { class: "exam-badge" }, examIco(), s.cfg.track === "all" ? "Mixed" : trackShort(s.cfg.track));
      var progress = el("span", { class: "exam-progress" }, "");
      var timer = el("span", { class: "exam-timer" + (s.cfg.timed ? "" : " untimed"), role: "timer", "aria-live": "off" }, "");
      var pauseBtn = el("button", { type: "button", class: "w-btn ghost su-pause" }, "Pause");
      var bar = el("div", { class: "exam-bar" }, badge, progress, el("span", { class: "su-spacer" }), timer, pauseBtn);
      var body = el("div", { class: "su-qbody" });
      var palette = el("nav", { class: "exam-palette", "aria-label": "Question palette" });
      var help = el("p", { class: "su-dim su-keys" }, "Keys: 1-4 or A-D answer · N / → next · P / ← previous · F flag · G / U / S confidence");
      card.appendChild(bar); card.appendChild(body);
      page.appendChild(live); page.appendChild(card); page.appendChild(palette); page.appendChild(help);

      function save() { saveSession(s); }
      function announce(t) { live.textContent = ""; setTimeout(function () { live.textContent = t; }, 30); }
      function item() { return s.items[s.idx]; }

      function paintTimer() {
        if (s.cfg.timed) {
          timer.textContent = fmtTime(s.remaining) + " left";
          timer.classList.toggle("low", s.remaining <= 60);
        } else {
          timer.textContent = fmtTime(s.elapsed) + " elapsed";
        }
      }
      function tick() {
        timerId = null;
        if (!page.isConnected) { detachKeys(); return; }
        if (!s.paused) {
          s.elapsed++;
          if (s.cfg.timed) {
            s.remaining = Math.max(0, s.remaining - 1);
            if (s.remaining === 0) { save(); finish(s, true); return; }
            if (s.remaining === 300 || s.remaining === 60) announce(fmtTime(s.remaining) + " remaining");
          }
          paintTimer();
          if (s.elapsed % 5 === 0) save();
        }
        timerId = setTimeout(tick, 1000);
      }

      function paintPalette() {
        clearNode(palette);
        s.items.forEach(function (it, i) {
          var state = [];
          if (it.picked >= 0) state.push("answered"); else state.push("unanswered");
          if (it.flag) state.push("flagged");
          var d = el("button", { type: "button", class: "exam-dot" + (it.picked >= 0 ? " answered" : "") + (it.flag ? " flagged" : "") + (i === s.idx ? " current" : ""), "aria-label": "Question " + (i + 1) + ", " + state.join(", "), "aria-current": i === s.idx ? "step" : null }, String(i + 1));
          d.addEventListener("click", function () { go(i); });
          palette.appendChild(d);
        });
      }

      function paintQuestion() {
        clearNode(body);
        var it = item(), r = src[it.qid];
        progress.textContent = "Question " + (s.idx + 1) + " of " + s.items.length + " · " + domainName(r.domain);
        pauseBtn.textContent = "Pause";
        if (s.paused) {
          var resumeBtn = el("button", { type: "button", class: "btn btn-primary" }, "Resume");
          resumeBtn.addEventListener("click", togglePause);
          body.appendChild(el("div", { class: "su-paused" }, el("h2", { class: "exam-sec-title" }, "Paused"), el("p", { class: "su-dim" }, "The question is hidden and the clock is stopped. Your progress is saved; you can close this tab and resume later from the simulator page."), resumeBtn));
          pauseBtn.textContent = "Resume";
          paintPalette();
          return;
        }
        var qId = "suQ" + s.idx;
        body.appendChild(el("h2", { class: "exam-q", id: qId }, r.q));
        var opts = el("div", { class: "exam-options", role: "radiogroup", "aria-labelledby": qId });
        it.order.forEach(function (oi, di) {
          var on = it.picked === di;
          var b = el("button", { type: "button", class: "exam-opt" + (on ? " selected" : ""), role: "radio", "aria-checked": on ? "true" : "false" },
            el("span", { class: "exam-key", "aria-hidden": "true" }, LETTERS[di]), el("span", { class: "exam-opt-text" }, r.options[oi]));
          b.addEventListener("click", function () { pick(di); });
          opts.appendChild(b);
        });
        body.appendChild(opts);

        var confBox = el("div", { class: "w-seg su-conf", role: "group", "aria-label": "Confidence" });
        CONF.forEach(function (c) {
          var on = it.conf === c.id;
          var b = el("button", { type: "button", class: "w-seg-btn" + (on ? " active" : ""), "aria-pressed": on ? "true" : "false" }, c.label);
          b.addEventListener("click", function () { setConf(c.id); });
          confBox.appendChild(b);
        });
        var flagBtn = el("button", { type: "button", class: "w-btn ghost su-flag" + (it.flag ? " is-on" : ""), "aria-pressed": it.flag ? "true" : "false" }, it.flag ? "Flagged" : "Flag for review");
        flagBtn.addEventListener("click", toggleFlag);
        body.appendChild(el("div", { class: "su-row su-qtools" }, el("span", { class: "su-ctl-label" }, "Confidence"), confBox, flagBtn));

        var prev = el("button", { type: "button", class: "w-btn ghost", disabled: s.idx === 0 }, "Previous");
        var next = el("button", { type: "button", class: "w-btn", disabled: s.idx >= s.items.length - 1 }, "Next");
        var rev = el("button", { type: "button", class: "btn btn-primary exam-submit" }, "Review and submit");
        prev.addEventListener("click", function () { go(s.idx - 1); });
        next.addEventListener("click", function () { go(s.idx + 1); });
        rev.addEventListener("click", function () { renderReview(); });
        body.appendChild(el("div", { class: "exam-foot" }, prev, next, rev));
        paintPalette();
      }

      function pick(di) {
        if (s.paused) return;
        var it = item();
        it.picked = di;
        save(); paintQuestion();
        announce("Selected option " + LETTERS[di]);
      }
      function setConf(id) { if (s.paused) return; item().conf = id; save(); paintQuestion(); announce("Confidence: " + id); }
      function toggleFlag() { if (s.paused) return; var it = item(); it.flag = !it.flag; save(); paintQuestion(); announce(it.flag ? "Flagged" : "Flag removed"); }
      function go(i) {
        if (s.paused || i < 0 || i >= s.items.length) return;
        s.idx = i; save(); paintQuestion();
        var q = body.querySelector(".exam-q"); if (q) { q.setAttribute("tabindex", "-1"); q.focus({ preventScroll: true }); }
      }
      function togglePause() {
        s.paused = !s.paused; save(); paintQuestion();
        announce(s.paused ? "Exam paused" : "Exam resumed");
      }
      pauseBtn.addEventListener("click", togglePause);

      /* review screen (inside the same session) */
      function renderReview() {
        clearNode(body);
        progress.textContent = "Review before submitting";
        var filter = "all";
        var listWrap = el("div", { class: "su-review-list" });
        var filterBox = el("div", { class: "w-seg", role: "group", "aria-label": "Filter questions" });
        var FILTERS = [["all", "All"], ["unanswered", "Unanswered"], ["flagged", "Flagged"], ["unsure", "Guess or unsure"]];
        FILTERS.forEach(function (f) {
          var b = el("button", { type: "button", class: "w-seg-btn" + (f[0] === filter ? " active" : ""), "aria-pressed": f[0] === filter ? "true" : "false" }, f[1]);
          b.addEventListener("click", function () {
            filter = f[0];
            [].forEach.call(filterBox.children, function (x) { x.classList.remove("active"); x.setAttribute("aria-pressed", "false"); });
            b.classList.add("active"); b.setAttribute("aria-pressed", "true");
            paintList();
          });
          filterBox.appendChild(b);
        });
        function paintList() {
          clearNode(listWrap);
          var shown = 0;
          s.items.forEach(function (it, i) {
            if (filter === "unanswered" && it.picked >= 0) return;
            if (filter === "flagged" && !it.flag) return;
            if (filter === "unsure" && !(it.conf === "guess" || it.conf === "unsure")) return;
            shown++;
            var r = src[it.qid];
            var tags = [];
            tags.push(it.picked >= 0 ? "Answered " + LETTERS[it.picked] : "Unanswered");
            if (it.flag) tags.push("Flagged");
            if (it.conf) tags.push(it.conf);
            var b = el("button", { type: "button", class: "su-review-row" }, el("span", { class: "su-mono" }, String(i + 1)), el("span", { class: "su-review-q" }, r.q), el("span", { class: "su-dim" }, tags.join(" · ")));
            b.addEventListener("click", function () { go(i); });
            listWrap.appendChild(b);
          });
          if (!shown) listWrap.appendChild(el("p", { class: "su-dim" }, "No questions match this filter."));
        }
        var unanswered = s.items.filter(function (it) { return it.picked < 0; }).length;
        var flagged = s.items.filter(function (it) { return it.flag; }).length;
        var back = el("button", { type: "button", class: "w-btn ghost" }, "Back to questions");
        back.addEventListener("click", function () { paintQuestion(); });
        var submit = el("button", { type: "button", class: "btn btn-primary" }, "Submit exam");
        var confirmBox = el("div", { class: "su-confirm", hidden: true, role: "alertdialog", "aria-label": "Confirm submission" });
        submit.addEventListener("click", function () {
          confirmBox.hidden = false;
          var yes = confirmBox.querySelector(".su-yes"); if (yes) yes.focus();
        });
        var yesBtn = el("button", { type: "button", class: "btn btn-primary su-yes" }, "Yes, submit");
        var noBtn = el("button", { type: "button", class: "w-btn ghost" }, "Keep working");
        yesBtn.addEventListener("click", function () { finish(s, false); });
        noBtn.addEventListener("click", function () { confirmBox.hidden = true; submit.focus(); });
        confirmBox.appendChild(el("p", {}, unanswered ? unanswered + " question" + (unanswered === 1 ? " is" : "s are") + " unanswered and will be scored as incorrect." : "All questions are answered.", flagged ? " " + flagged + " flagged." : ""));
        confirmBox.appendChild(el("div", { class: "su-row" }, yesBtn, noBtn));

        body.appendChild(el("h2", { class: "exam-sec-title" }, "Review: " + (s.items.length - unanswered) + " answered, " + unanswered + " unanswered, " + flagged + " flagged"));
        body.appendChild(filterBox);
        body.appendChild(listWrap);
        body.appendChild(el("div", { class: "exam-foot" }, back, submit));
        body.appendChild(confirmBox);
        paintList();
        paintPalette();
        announce("Review screen. " + unanswered + " unanswered, " + flagged + " flagged.");
      }

      keyHandler = function (e) {
        if (!page.isConnected) { detachKeys(); return; }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var t = e.target, tag = t && t.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
        if (document.querySelector(".palette:not([hidden]), .help-modal:not([hidden])")) return;
        var k = e.key;
        var onQuestion = !!body.querySelector(".exam-options");
        var low = k.length === 1 ? k.toLowerCase() : k;
        var n = "1234".indexOf(k);
        if (n < 0 && "abcd".indexOf(low) >= 0 && low.length === 1) n = "abcd".indexOf(low);
        if (onQuestion && n >= 0 && n < item().order.length) { e.preventDefault(); pick(n); return; }
        if (low === "n" || k === "ArrowRight") { if (onQuestion) { e.preventDefault(); go(s.idx + 1); } return; }
        if (low === "p" || k === "ArrowLeft") { if (onQuestion) { e.preventDefault(); go(s.idx - 1); } return; }
        if (onQuestion && low === "f") { e.preventDefault(); toggleFlag(); return; }
        if (onQuestion && low === "g") { e.preventDefault(); setConf("guess"); return; }
        if (onQuestion && low === "u") { e.preventDefault(); setConf("unsure"); return; }
        if (onQuestion && low === "s") { e.preventDefault(); setConf("sure"); return; }
      };
      document.addEventListener("keydown", keyHandler);

      paintTimer();
      paintQuestion();
      timerId = setTimeout(tick, 1000);
      scrollTop();
    }

    /* ---------- results ---------- */
    function finish(s, timedOut) {
      var src = poolMap();
      stopTimer(); detachKeys();
      var items = s.items.filter(function (it) { return !!src[it.qid]; });
      var correct = 0, byDom = {}, byConf = { guess: { c: 0, t: 0 }, unsure: { c: 0, t: 0 }, sure: { c: 0, t: 0 }, none: { c: 0, t: 0 } };
      var missed = [];
      items.forEach(function (it) {
        var r = src[it.qid];
        var ok = it.picked >= 0 && it.order[it.picked] === r.answer;
        it.ok = ok;
        if (ok) correct++; else missed.push(it.qid);
        var dk = s.cfg.track === "all" ? r.track : r.domain;
        var d = byDom[dk] || (byDom[dk] = { c: 0, t: 0, missedRoutes: {} });
        d.t++; if (ok) d.c++; else d.missedRoutes[r.route] = r.lessonTitle;
        var ck = it.conf || "none";
        byConf[ck].t++; if (ok) byConf[ck].c++;
        if (it.picked >= 0) feedWeakSpot(it.qid, ok);
      });
      var total = items.length, score = pct(correct, total);
      var hist = readHist();
      var domSummary = {};
      Object.keys(byDom).forEach(function (k) { domSummary[k] = { c: byDom[k].c, t: byDom[k].t }; });
      hist.push({ at: new Date().toISOString(), track: s.cfg.track, total: total, correct: correct, pct: score, seed: s.cfg.seed, timed: !!s.cfg.timed, seconds: s.elapsed, domains: domSummary });
      writeJSON(HIST_KEY, hist.slice(-40));
      clearSession();

      var page = reset();
      page.appendChild(head("Results", "Practice result only. Not an official score and not a prediction of an official outcome."));
      var pass = score >= TARGET;
      var res = el("section", { class: "exam-card exam-result" });
      res.appendChild(el("div", { class: "exam-result-head" },
        el("div", { class: "exam-score " + (pass ? "pass" : "fail") }, score + "%"),
        el("div", { class: "exam-verdict " + (pass ? "pass" : "fail") }, pass ? "At or above practice target" : "Below practice target")));
      res.appendChild(el("p", { class: "exam-result-sub" }, correct + " of " + total + " correct. Practice target " + TARGET + "% is a study benchmark chosen by Summit, not an official passing score." + (timedOut ? " Time ran out, so the exam was submitted automatically." : "")));
      var answered = items.filter(function (it) { return it.picked >= 0; }).length;
      var flagged = items.filter(function (it) { return it.flag; }).length;
      function meta(v, k) { return el("div", { class: "exam-meta-item" }, el("div", { class: "exam-meta-v" }, v), el("div", { class: "exam-meta-k" }, k)); }
      res.appendChild(el("div", { class: "exam-meta" }, meta(fmtTime(s.elapsed), s.cfg.timed ? "Time used" : "Time taken"), meta(answered + "/" + total, "Answered"), meta(String(flagged), "Flagged"), meta(String(s.cfg.seed), "Seed")));

      // per-domain
      var dk = Object.keys(byDom).sort(function (a, b) { return pct(byDom[a].c, byDom[a].t) - pct(byDom[b].c, byDom[b].t); });
      var bd = el("section", { class: "exam-breakdown" }, el("h2", { class: "exam-sec-title" }, "Score by domain"));
      dk.forEach(function (k) {
        var d = byDom[k], p = pct(d.c, d.t);
        var fill = el("i", {}); fill.style.width = p + "%";
        bd.appendChild(el("div", { class: "exam-bd-row" },
          el("span", { class: "exam-bd-name" }, s.cfg.track === "all" ? trackLabel(k) : domainName(k)),
          el("span", { class: "exam-bd-bar", role: "img", "aria-label": p + " percent" }, fill),
          el("span", { class: "exam-bd-num" }, d.c + "/" + d.t + " · " + p + "%")));
      });
      res.appendChild(bd);

      // calibration
      var cal = el("section", { class: "exam-breakdown" }, el("h2", { class: "exam-sec-title" }, "Confidence calibration"));
      var calT = el("table", { class: "su-table" }, el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Confidence"), el("th", { scope: "col" }, "Answers"), el("th", { scope: "col" }, "Accuracy"), el("th", { scope: "col" }, "Reading"))));
      var calB = el("tbody", {});
      [["sure", "Sure"], ["unsure", "Unsure"], ["guess", "Guess"], ["none", "Not rated"]].forEach(function (c) {
        var v = byConf[c[0]];
        if (!v.t) return;
        var a = pct(v.c, v.t), reading = "-";
        if (c[0] === "sure") reading = a >= 80 ? "well calibrated" : "overconfident: slow down and reread constraints";
        else if (c[0] === "guess") reading = a >= 50 ? "underconfident: trust your reasoning more" : "as expected";
        else if (c[0] === "unsure") reading = a >= 70 ? "better than you think" : "review these topics";
        else reading = "rate confidence to see calibration";
        calB.appendChild(el("tr", {}, el("td", {}, c[1]), el("td", {}, String(v.t)), el("td", {}, a + "%"), el("td", {}, reading)));
      });
      calT.appendChild(calB);
      cal.appendChild(calT);
      res.appendChild(cal);

      // recommendations
      var rec = el("section", { class: "exam-breakdown su-recs" }, el("h2", { class: "exam-sec-title" }, "Weak-area recommendations"));
      var weakDoms = dk.filter(function (k) { return pct(byDom[k].c, byDom[k].t) < 70; });
      if (!weakDoms.length) rec.appendChild(el("p", { class: "su-dim" }, "No domain fell below 70% in this attempt. Try a larger or timed set, or a new seed, to confirm."));
      else {
        var ul = el("ul", { class: "su-list" });
        weakDoms.slice(0, 5).forEach(function (k) {
          var d = byDom[k];
          var li = el("li", { class: "is-bad" }, el("strong", {}, (s.cfg.track === "all" ? trackLabel(k) : domainName(k)) + " (" + pct(d.c, d.t) + "%)"), " Revisit: ");
          Object.keys(d.missedRoutes).slice(0, 3).forEach(function (route, i) {
            if (i) li.appendChild(document.createTextNode(", "));
            li.appendChild(el("a", { href: route }, d.missedRoutes[route]));
          });
          ul.appendChild(li);
        });
        rec.appendChild(ul);
      }
      res.appendChild(rec);

      // actions
      var again = el("button", { type: "button", class: "btn btn-ghost" }, "Retake same seed");
      again.addEventListener("click", function () { preset = { track: s.cfg.track, domains: s.cfg.domains, count: s.cfg.count, timed: s.cfg.timed, minutes: s.cfg.minutes, seed: s.cfg.seed, only: s.cfg.only }; renderSetup(); });
      var retry = el("button", { type: "button", class: "btn btn-primary", disabled: !missed.length }, "Retake missed (" + missed.length + ")");
      retry.addEventListener("click", function () {
        var conf = { track: s.cfg.track, domains: s.cfg.domains, count: missed.length, timed: false, minutes: 0, seed: s.cfg.seed + "-r", only: missed };
        var its = selectItems(conf);
        if (!its.length) return;
        var ns = { v: 1, cfg: conf, items: its, idx: 0, remaining: 0, limit: 0, elapsed: 0, paused: false, startedAt: new Date().toISOString() };
        saveSession(ns); runSession(ns);
      });
      var fresh = el("button", { type: "button", class: "btn btn-ghost" }, "New exam");
      fresh.addEventListener("click", function () { renderSetup(); });
      res.appendChild(el("div", { class: "exam-foot" }, retry, again, fresh, el("a", { class: "btn btn-ghost", href: "#/readiness" }, "Readiness dashboard")));
      page.appendChild(res);

      // answer review
      var rv = el("section", { class: "exam-review" }, el("h2", { class: "exam-sec-title" }, "Answer review"));
      var rvFilter = "wrong";
      var rvList = el("div", {});
      var fbox = el("div", { class: "w-seg", role: "group", "aria-label": "Review filter" });
      [["wrong", "Incorrect"], ["flagged", "Flagged"], ["all", "All"]].forEach(function (f) {
        var b = el("button", { type: "button", class: "w-seg-btn" + (f[0] === rvFilter ? " active" : ""), "aria-pressed": f[0] === rvFilter ? "true" : "false" }, f[1]);
        b.addEventListener("click", function () {
          rvFilter = f[0];
          [].forEach.call(fbox.children, function (x) { x.classList.remove("active"); x.setAttribute("aria-pressed", "false"); });
          b.classList.add("active"); b.setAttribute("aria-pressed", "true");
          paintRv();
        });
        fbox.appendChild(b);
      });
      function paintRv() {
        clearNode(rvList);
        var shown = 0;
        items.forEach(function (it, i) {
          if (rvFilter === "wrong" && it.ok) return;
          if (rvFilter === "flagged" && !it.flag) return;
          shown++;
          var r = src[it.qid];
          var your = it.picked >= 0 ? LETTERS[it.picked] + ". " + r.options[it.order[it.picked]] : "No answer";
          var rightDi = it.order.indexOf(r.answer);
          rvList.appendChild(el("article", { class: "exam-review-item" + (it.ok ? " is-ok" : " is-bad") },
            el("div", { class: "exam-ri-q" }, (i + 1) + ". " + r.q),
            el("div", { class: "exam-ri-row your" }, el("span", { class: "exam-ri-tag" }, it.ok ? "Correct" : "Yours"), el("span", { class: "exam-ri-val" }, your)),
            it.ok ? null : el("div", { class: "exam-ri-row correct" }, el("span", { class: "exam-ri-tag" }, "Answer"), el("span", { class: "exam-ri-val" }, LETTERS[rightDi] + ". " + r.options[r.answer])),
            el("div", { class: "exam-ri-explain" }, el("strong", {}, "Why: "), r.explain),
            el("div", { class: "su-dim" }, domainName(r.domain) + (it.conf ? " · confidence: " + it.conf : "") + (it.flag ? " · flagged" : "") + " · ", el("a", { href: r.route }, "Open lesson"))));
        });
        if (!shown) rvList.appendChild(el("p", { class: "su-dim" }, rvFilter === "wrong" ? "No incorrect answers. Nicely done." : "Nothing to show for this filter."));
      }
      rv.appendChild(fbox); rv.appendChild(rvList);
      page.appendChild(rv);
      paintRv();
      scrollTop();
    }

    renderSetup();
  }

  /* =====================================================================
     STUDY PLANS
     ===================================================================== */
  function mountPlans(mountEl) {
    if (!mountEl) return;
    clearNode(mountEl);
    var page = el("div", { class: "exam-page su-plans" });
    mountEl.appendChild(page);
    page.appendChild(el("header", { class: "exam-head" }, planIco("exam-ico"), el("div", {}, el("h1", { class: "exam-title" }, "Study plans"), el("p", { class: "exam-sub" }, "A week-by-week plan per certification from your target date. Tick items off; everything saves in this browser."))));
    page.appendChild(el("p", { class: "note-inline" }, "Plans are a suggested rhythm, not official guidance. Check current official objectives and adjust the plan to your experience."));

    var store = readJSON(PLAN_KEY, {}) || {};
    var ids = trackIds();
    var cert = store._last && trackOf(store._last) ? store._last : ids[0];
    var form = el("div", { class: "exam-config" });
    var out = el("div", { class: "su-plan-out" });
    page.appendChild(form); page.appendChild(out);

    var sel = el("select", { class: "exam-select", id: "suPlanCert" });
    ids.forEach(function (t) { sel.appendChild(optionEl(t, trackLabel(t), t === cert)); });
    var dateIn = el("input", { type: "date", class: "exam-select", id: "suPlanDate" });
    var hoursBox = el("div", { class: "w-seg", role: "group", "aria-label": "Hours per week" });
    var copyBtn = el("button", { type: "button", class: "w-btn ghost" }, "Copy as Markdown");
    var clearBtn = el("button", { type: "button", class: "w-btn ghost" }, "Reset ticks");
    var status = el("span", { class: "su-dim", role: "status", "aria-live": "polite" }, "");
    form.appendChild(el("div", { class: "exam-config-row" }, el("label", { class: "exam-config-label", for: "suPlanCert" }, "Certification"), el("div", { class: "exam-config-control" }, sel)));
    form.appendChild(el("div", { class: "exam-config-row" }, el("label", { class: "exam-config-label", for: "suPlanDate" }, "Target exam date"), el("div", { class: "exam-config-control" }, dateIn)));
    form.appendChild(el("div", { class: "exam-config-row" }, el("span", { class: "exam-config-label" }, "Hours per week"), el("div", { class: "exam-config-control" }, hoursBox)));
    form.appendChild(el("div", { class: "exam-config-row" }, copyBtn, clearBtn, status));

    function entry() {
      var e = store[cert];
      if (!e || typeof e !== "object") {
        var d = new Date(Date.now() + 42 * 86400000);
        e = store[cert] = { date: d.toISOString().slice(0, 10), hours: 5, done: {} };
      }
      if (!e.done) e.done = {};
      return e;
    }
    function persist() { store._last = cert; writeJSON(PLAN_KEY, store); }
    function weeksLeft(e) {
      var t = Date.parse(e.date + "T00:00:00");
      if (isNaN(t)) return 6;
      var days = Math.ceil((t - Date.now()) / 86400000);
      return Math.max(1, Math.min(26, Math.ceil(days / 7)));
    }
    function buildPlan(e) {
      var t = trackOf(cert), weeks = weeksLeft(e);
      var lessons = [];
      t.modules.forEach(function (m) { m.lessons.forEach(function (l) { lessons.push({ id: "l:" + m.id + "/" + l.id, route: "#/" + t.id + "/" + m.id + "/" + l.id, title: l.title, minutes: l.minutes || 8, module: m.name }); }); });
      // fewer weekly hours stretch the learning phase; more hours leave longer for practice
      var share = e.hours >= 8 ? 0.5 : e.hours >= 5 ? 0.6 : 0.75;
      var learnWeeks = weeks <= 2 ? weeks : Math.max(1, Math.min(weeks - 1, Math.round(weeks * share)));
      var plan = [];
      for (var w = 0; w < weeks; w++) plan.push({ n: w + 1, items: [], mods: {} });
      var per = Math.max(1, Math.ceil(lessons.length / learnWeeks));
      lessons.forEach(function (L, i) {
        var wk = Math.min(weeks - 1, Math.floor(i / per));
        plan[wk].mods[L.module] = true;
        plan[wk].items.push({ id: L.id, label: "Study: " + L.title, sub: L.module + " · about " + L.minutes + " min + checkpoint", route: L.route, lesson: t.id + "/" + L.id.slice(2) });
      });
      plan.forEach(function (p, i) {
        var modNames = Object.keys(p.mods);
        if (modNames.length) p.items.push({ id: "r:" + i, label: "Review flashcards and missed questions for " + modNames.join(", "), sub: "Retrieval practice, 20 to 30 min", route: "#/practice/weak" });
        if (i >= learnWeeks - 1 && i < weeks - 1) p.items.push({ id: "s:" + i, label: "Domain practice: untimed simulator, 25 questions", sub: "Filter to your weakest domains", route: "#/exam" });
        if (i === weeks - 1) {
          p.items.push({ id: "f:" + i, label: "Full timed simulation, 50 to 65 questions", sub: "Rehearse pacing checkpoints", route: "#/exam" });
          p.items.push({ id: "c:" + i, label: "Check readiness and confirm exam-day logistics", sub: "Verify official candidate rules", route: "#/readiness" });
        }
      });
      return plan;
    }
    function render() {
      var e = entry();
      dateIn.value = e.date;
      clearNode(hoursBox);
      [3, 5, 8, 12].forEach(function (h) {
        var on = e.hours === h;
        var b = el("button", { type: "button", class: "w-seg-btn" + (on ? " active" : ""), "aria-pressed": on ? "true" : "false" }, h + " h");
        b.addEventListener("click", function () { e.hours = h; persist(); render(); });
        hoursBox.appendChild(b);
      });
      clearNode(out);
      var plan = buildPlan(e), done = doneSet(), total = 0, ticked = 0;
      plan.forEach(function (p) { p.items.forEach(function (x) { total++; if (e.done[x.id] || (x.lesson && done.has(x.lesson))) ticked++; }); });
      var pr = pct(ticked, total);
      var fill = el("i", {}); fill.style.width = pr + "%";
      out.appendChild(el("div", { class: "exam-bd-row su-plan-progress" }, el("span", { class: "exam-bd-name" }, plan.length + " week" + (plan.length === 1 ? "" : "s") + " to " + e.date), el("span", { class: "exam-bd-bar", role: "img", "aria-label": pr + " percent complete" }, fill), el("span", { class: "exam-bd-num" }, ticked + "/" + total)));
      plan.forEach(function (p) {
        var sec = el("section", { class: "su-week" }, el("h2", { class: "exam-sec-title" }, "Week " + p.n));
        var ul = el("ul", { class: "su-checklist" });
        p.items.forEach(function (x, i) {
          var cid = "suPl" + p.n + "_" + i;
          var isDone = !!e.done[x.id] || (x.lesson && done.has(x.lesson));
          var cb = el("input", { type: "checkbox", id: cid, checked: isDone });
          cb.addEventListener("change", function () { if (cb.checked) e.done[x.id] = true; else delete e.done[x.id]; persist(); render(); });
          ul.appendChild(el("li", { class: isDone ? "is-ok" : "" }, cb, el("label", { for: cid }, x.label), el("span", { class: "su-dim" }, " " + x.sub + " · "), el("a", { href: x.route }, "Open")));
        });
        sec.appendChild(ul);
        out.appendChild(sec);
      });
      out._plan = plan;
    }
    function markdown() {
      var e = entry(), plan = out._plan || buildPlan(e), done = doneSet();
      var lines = ["# " + trackLabel(cert) + " study plan (target " + e.date + ", " + e.hours + " h/week)", "", "Unofficial plan from Summit. Verify current official objectives.", ""];
      plan.forEach(function (p) {
        lines.push("## Week " + p.n);
        p.items.forEach(function (x) { var d = !!e.done[x.id] || (x.lesson && done.has(x.lesson)); lines.push("- [" + (d ? "x" : " ") + "] " + x.label + " (" + x.sub + ")"); });
        lines.push("");
      });
      return lines.join("\n");
    }
    sel.addEventListener("change", function () { cert = sel.value; persist(); render(); });
    dateIn.addEventListener("change", function () { if (dateIn.value) { entry().date = dateIn.value; persist(); render(); } });
    clearBtn.addEventListener("click", function () { entry().done = {}; persist(); render(); status.textContent = "Ticks cleared for this plan."; });
    copyBtn.addEventListener("click", function () {
      var text = markdown();
      function fallback() {
        var ta = el("textarea", { class: "su-copybox", "aria-label": "Plan as Markdown", readonly: true });
        ta.value = text;
        var old = page.querySelector(".su-copybox"); if (old) old.remove();
        page.appendChild(ta); ta.focus(); ta.select();
        status.textContent = "Clipboard unavailable here; the Markdown is selected below for manual copy.";
      }
      try {
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { status.textContent = "Plan copied as Markdown."; }, fallback);
        else fallback();
      } catch (e) { fallback(); }
    });
    render();
    scrollTop();
  }

  /* =====================================================================
     READINESS DASHBOARD
     ===================================================================== */
  function mountReadiness(mountEl) {
    if (!mountEl) return;
    clearNode(mountEl);
    var page = el("div", { class: "exam-page su-ready" });
    mountEl.appendChild(page);
    page.appendChild(el("header", { class: "exam-head" }, gaugeIco("exam-ico"), el("div", {}, el("h1", { class: "exam-title" }, "Readiness dashboard"), el("p", { class: "exam-sub" }, "Lesson coverage, practice signals and simulator scores per certification and domain."))));
    page.appendChild(el("p", { class: "note-inline" }, "This is an estimate from your activity in this browser. It is not a prediction of an official result. A dash means there is no data yet."));

    var done = doneSet(), hist = readHist(), weak = readJSON(WEAK_KEY, {}) || {}, flash = readFlash();
    var cards = window.SUMMIT_CARDS || [];
    var grid = el("div", { class: "su-ready-grid" });
    page.appendChild(grid);

    trackIds().forEach(function (tid) {
      var t = trackOf(tid);
      var totalL = 0, doneL = 0, dom = {};
      t.modules.forEach(function (m) {
        var k = domainKey(tid, m.id);
        dom[k] = { name: m.name, lessons: 0, done: 0, c: 0, t: 0, route: "#/" + tid + "/" + m.id + "/" + m.lessons[0].id };
        m.lessons.forEach(function (l) { totalL++; dom[k].lessons++; if (done.has(tid + "/" + m.id + "/" + l.id)) { doneL++; dom[k].done++; } });
      });
      var attempts = hist.filter(function (h) { return h.track === tid; });
      var recent = attempts.slice(-3);
      var simAvg = recent.length ? Math.round(recent.reduce(function (a, h) { return a + h.pct; }, 0) / recent.length) : null;
      hist.forEach(function (h) {
        if (!h.domains) return;
        Object.keys(h.domains).forEach(function (k) { if (dom[k]) { dom[k].c += h.domains[k].c; dom[k].t += h.domains[k].t; } });
      });
      var seen = 0, wrongNow = 0;
      Object.keys(weak).forEach(function (q) { if (q.indexOf(tid + "-") === 0 && weak[q]) { seen += weak[q].seen || 0; if (weak[q].wrong > 0) wrongNow++; } });
      var tCards = 0, known = 0;
      cards.forEach(function (c, i) { if (c.track === tid) { tCards++; if (flash[i] === "known") known++; } });
      var cov = pct(doneL, totalL);
      var est = simAvg == null ? null : Math.round(0.3 * cov + 0.7 * simAvg);

      var card = el("section", { class: "su-ready-card", style: "--tc:" + t.color });
      card.appendChild(el("h2", { class: "exam-sec-title" }, t.name));
      function meta(v, k) { return el("div", { class: "exam-meta-item" }, el("div", { class: "exam-meta-v" }, v), el("div", { class: "exam-meta-k" }, k)); }
      card.appendChild(el("div", { class: "exam-meta" },
        meta(est == null ? "—" : est + "%", "Readiness estimate"),
        meta(cov + "%", "Lessons covered"),
        meta(simAvg == null ? "—" : simAvg + "%", "Simulator (last 3)"),
        meta(seen ? String(wrongNow) : "—", "Questions to revisit"),
        meta(tCards ? known + "/" + tCards : "—", "Cards known")));
      var bars = el("div", { class: "exam-breakdown" });
      var worst = [];
      Object.keys(dom).forEach(function (k) {
        var d = dom[k], cp = pct(d.done, d.lessons), sp = d.t ? pct(d.c, d.t) : null;
        var fill = el("i", {}); fill.style.width = (sp == null ? cp : sp) + "%";
        bars.appendChild(el("div", { class: "exam-bd-row" },
          el("a", { class: "exam-bd-name", href: d.route }, d.name),
          el("span", { class: "exam-bd-bar", role: "img", "aria-label": sp == null ? cp + " percent of lessons covered" : sp + " percent simulator accuracy" }, fill),
          el("span", { class: "exam-bd-num" }, (sp == null ? "—" : sp + "%") + " · " + d.done + "/" + d.lessons)));
        worst.push({ k: k, d: d, score: sp == null ? -1 : sp, cp: cp });
      });
      card.appendChild(el("p", { class: "su-dim" }, "Bars show simulator accuracy per domain where you have attempts, otherwise lesson coverage. Numbers: accuracy · lessons done."));
      card.appendChild(bars);

      var recs = [];
      if (cov < 100) {
        var uncovered = worst.filter(function (w) { return w.cp < 100; }).sort(function (a, b) { return a.cp - b.cp; })[0];
        if (uncovered) recs.push(["Finish lessons in " + uncovered.d.name, uncovered.d.route]);
      }
      var lowSim = worst.filter(function (w) { return w.score >= 0 && w.score < 70; }).sort(function (a, b) { return a.score - b.score; });
      lowSim.slice(0, 2).forEach(function (w) { recs.push(["Practise " + w.d.name + " (" + w.score + "% so far)", w.d.route]); });
      if (simAvg == null) recs.push(["Take a first simulator attempt to get a baseline", "#/exam"]);
      else if (simAvg < TARGET) recs.push(["Run a timed simulation filtered to weak domains", "#/exam"]);
      if (wrongNow) recs.push(["Clear " + wrongNow + " missed question" + (wrongNow === 1 ? "" : "s") + " in weak-spot practice", "#/practice/weak"]);
      if (!recs.length) recs.push(["Keep sharp: a new-seed timed simulation each week", "#/exam"]);
      var ul = el("ul", { class: "su-list" });
      recs.slice(0, 4).forEach(function (r) { ul.appendChild(el("li", {}, el("a", { href: r[1] }, r[0]))); });
      card.appendChild(el("h3", { class: "su-h3" }, "Next steps"));
      card.appendChild(ul);
      grid.appendChild(card);
    });
    scrollTop();
  }

  /* =====================================================================
     FLASHCARDS
     ===================================================================== */
  function requireDeck(cards) {
    if (!cards.length) throw new Error("Summit: window.SUMMIT_CARDS is empty; a track file failed to register its flashcards");
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }

  function mountFlashcards(mountEl) {
    if (!mountEl) return;
    var CARDS = window.SUMMIT_CARDS || [];
    requireDeck(CARDS);
    clearNode(mountEl);

    var deck = CARDS.map(function (c, i) { return { _idx: i, front: c.front, back: c.back, track: c.track }; });
    var tracksInDeck = [], seen = {};
    deck.forEach(function (c) { if (!seen[c.track]) { seen[c.track] = true; tracksInDeck.push(c.track); } });

    var status = readFlash();
    var filter = "all", show = "all";
    var order = deck.slice();
    var pos = 0, flipped = false;

    var page = el("div", { class: "fc-page" });
    page.appendChild(el("header", { class: "fc-head" }, flashIco("fc-ico"), el("div", {},
      el("h1", { class: "fc-title" }, "Flashcards"),
      el("p", { class: "fc-sub" }, "Original recall cards for every certification track. Flip, self-grade, and filter to the cards you still need. Progress saves in this browser."))));

    var filterSel = el("select", { class: "fc-select", "aria-label": "Certification filter" });
    filterSel.appendChild(optionEl("all", "All certifications", true));
    tracksInDeck.forEach(function (t) { filterSel.appendChild(optionEl(t, trackLabel(t), false)); });
    filterSel.addEventListener("change", function () { filter = filterSel.value; applyFilter(); });
    var showSel = el("select", { class: "fc-select", "aria-label": "Card status filter" });
    [["all", "All cards"], ["review", "Review again"], ["new", "Not graded"]].forEach(function (o, i) { showSel.appendChild(optionEl(o[0], o[1], i === 0)); });
    showSel.addEventListener("change", function () { show = showSel.value; applyFilter(); });

    var shuffleBtn = el("button", { class: "w-btn ghost", type: "button" }, "Shuffle");
    shuffleBtn.addEventListener("click", function () { order = shuffle(order.slice()); pos = 0; flipped = false; renderCard(); });
    var resetBtn = el("button", { class: "w-btn ghost", type: "button" }, "Reset deck");
    resetBtn.addEventListener("click", function () { Object.keys(status).forEach(function (k) { delete status[k]; }); saveFlash(status); applyFilter(); });
    var progressEl = el("span", { class: "fc-progress" }, "");
    page.appendChild(el("div", { class: "fc-controls" },
      el("label", { class: "w-field" }, el("span", {}, "Track"), filterSel),
      el("label", { class: "w-field" }, el("span", {}, "Show"), showSel),
      shuffleBtn, resetBtn, progressEl));

    var frontTag = el("span", { class: "fc-track-tag" }, "");
    var backTag = el("span", { class: "fc-track-tag" }, "");
    var term = el("div", { class: "fc-term" }, "");
    var def = el("div", { class: "fc-def" }, "");
    var front = el("div", { class: "fc-face fc-front" }, frontTag, term, el("span", { class: "fc-hint" }, "Click the card or press Flip to reveal"));
    var back = el("div", { class: "fc-face fc-back" }, backTag, def);
    var inner = el("div", { class: "fc-inner" }, front, back);
    inner.addEventListener("click", function () { doFlip(); });
    page.appendChild(el("div", { class: "fc-stage" }, el("div", { class: "fc-card" }, inner)));
    var live = el("div", { class: "sr-only", "aria-live": "polite" }, "");
    page.appendChild(live);

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
      var c = currentCard();
      if (c) live.textContent = flipped ? c.back : c.front;
    }
    function applyFilter() {
      order = deck.filter(function (c) {
        if (filter !== "all" && c.track !== filter) return false;
        if (show === "review" && status[c._idx] !== "review") return false;
        if (show === "new" && status[c._idx]) return false;
        return true;
      });
      pos = 0; flipped = false;
      renderCard(); updateProgress();
    }
    function grade(st) {
      var c = currentCard();
      if (!c) return;
      status[c._idx] = st;
      saveFlash(status);
      if (pos < order.length - 1) { pos++; flipped = false; }
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
        term.textContent = "No cards match"; def.textContent = "";
        frontTag.textContent = ""; backTag.textContent = "";
        counter.textContent = "0 / 0";
        statusChip.className = "fc-status"; statusChip.textContent = "";
        return;
      }
      var lbl = trackShort(c.track);
      term.textContent = c.front; def.textContent = c.back;
      frontTag.textContent = lbl; backTag.textContent = lbl;
      counter.textContent = (pos + 1) + " / " + order.length;
      var st = status[c._idx];
      statusChip.className = "fc-status" + (st ? " " + st : "");
      statusChip.textContent = st === "known" ? "Known" : st === "review" ? "Review again" : "Not graded";
    }
    function updateProgress() {
      var inTrack = deck.filter(function (c) { return filter === "all" || c.track === filter; });
      var known = inTrack.filter(function (c) { return status[c._idx] === "known"; }).length;
      progressEl.textContent = known + " / " + inTrack.length + " known";
    }
    renderCard(); updateProgress();
    scrollTop();
  }

  window.AcademyExam = { mountExam: mountExam, mountFlashcards: mountFlashcards, mountPlans: mountPlans, mountReadiness: mountReadiness };
})();
