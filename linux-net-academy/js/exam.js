/* =====================================================================
   KERNEL · Exam mode + Flashcards
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
  // Quiz ids in Kernel use these prefixes: shell-, text-, proc-, fs-, perf-, net-, tools-, cont-, ssh-.
  var PREFIX_ALIAS = {};
  var ACTIVE_QUIZ_PREFIXES = ["shell", "text", "proc", "fs", "perf", "net", "tools", "cont", "ssh"];
  var TRACK_NAMES = {
    shell: "Shell & Command Line",
    text: "Text Processing",
    proc: "Processes & Services",
    fs: "Filesystems & Permissions",
    perf: "Performance & Troubleshooting",
    net: "Networking Fundamentals",
    tools: "Network Tools & Troubleshooting",
    cont: "Containers Under the Hood",
    ssh: "SSH & Remote Work"
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
  var EXAM_KEY = "kn_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "kn_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
      var host = window.Academy || window.Kernel;
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
     Tracks match Kernel's window.TRACKS ids: shell, text, proc, fs, perf, net, tools, cont, ssh.
     ===================================================================== */
  var CARDS = [
    // shell
    { front: "Builtin vs external command", track: "shell", back: "A builtin (cd, export, read) runs inside the shell process itself; an external command is a separate program found on PATH and run with fork + exec. `type name` tells you which one you have." },
    { front: "Exit status", track: "shell", back: "Every command returns 0 for success and 1-255 for failure. `$?` holds the last one; `&&` runs the next command only on success, `||` only on failure. 128+N means the process died from signal N." },
    { front: "cmd > f 2>&1 vs cmd 2>&1 > f", track: "shell", back: "Redirections apply left to right. The first sends stdout to f, then points stderr at wherever stdout now goes (f). The second copies stderr to the terminal first, then moves only stdout to f." },
    { front: "Expansion order", track: "shell", back: "Brace, tilde, parameter and variable, command substitution, arithmetic, word splitting, pathname (glob) expansion, then quote removal. Quoting a variable stops word splitting and globbing on its value." },
    { front: "\"$@\" vs \"$*\"", track: "shell", back: "\"$@\" expands to each positional argument as its own word, preserving spaces inside arguments. \"$*\" joins them into one string separated by the first character of IFS. Pass arguments through with \"$@\"." },
    { front: "set -euo pipefail", track: "shell", back: "-e exits on an unhandled failing command, -u errors on unset variables, pipefail makes a pipeline fail if any stage fails. Useful defaults, but -e is skipped inside conditions and can be masked by `local x=$(cmd)`." },
    { front: "trap ... EXIT", track: "shell", back: "Registers a command to run whenever the script exits, for any reason short of SIGKILL. The standard place to delete temp directories made with mktemp -d and release locks." },
    { front: "zsh vs bash on macOS", track: "shell", back: "macOS defaults to zsh and ships an old bash 3.2. zsh does not word-split unquoted variables by default and errors on globs that match nothing. Install a current bash with Homebrew for scripts that need bash 4+ features." },
    // text
    { front: "grep -E vs -F vs -P", track: "text", back: "-E uses extended regex (|, +, ? without backslashes), -F treats the pattern as a fixed string (fast, no regex), -P enables Perl-compatible regex in GNU grep. The BSD grep on macOS has no -P." },
    { front: "ripgrep defaults", track: "text", back: "rg searches recursively, respects .gitignore, skips hidden and binary files, and uses a fast regex engine. Add --hidden or -uu to search what it skips by default." },
    { front: "find -exec {} \\; vs +", track: "text", back: "With \\; find runs the command once per file. With + it batches many paths into each invocation, like xargs, which is far faster for large trees." },
    { front: "find -print0 | xargs -0", track: "text", back: "NUL-separated output is the only safe way to pass arbitrary filenames, because NUL is the one byte a filename cannot contain. Spaces and newlines in names stop being a problem." },
    { front: "sed -i on macOS", track: "text", back: "GNU sed takes -i alone; BSD sed on macOS requires a backup suffix argument, so use `sed -i '' 's/a/b/' f`. `sed -i.bak` works on both. Homebrew gnu-sed installs gsed." },
    { front: "awk fields", track: "text", back: "awk splits each line into $1..$NF using whitespace or -F. NR is the record number, NF the field count. `awk '{s[$1]+=$2} END{for(k in s) print k, s[k]}'` is a group-by sum." },
    { front: "sort | uniq -c | sort -rn", track: "text", back: "uniq only collapses adjacent duplicates, so input must be sorted first. uniq -c prefixes counts, and the final numeric reverse sort ranks the most frequent values first." },
    { front: "jq -r", track: "text", back: "Outputs raw strings without JSON quotes, ready for shell use. `jq -r '.items[] | select(.status==\"failed\") | .name'` filters an array and prints one name per line." },
    // proc
    { front: "Process states R S D Z T", track: "proc", back: "R running or runnable, S interruptible sleep (waiting on an event), D uninterruptible sleep (usually disk or NFS I/O), Z zombie (exited, not reaped), T stopped by a signal or debugger." },
    { front: "fork + exec", track: "proc", back: "fork() clones the calling process (copy-on-write); exec() replaces the clone's program image while keeping its PID and open file descriptors. The shell runs every external command this way, then waits." },
    { front: "Zombie process", track: "proc", back: "A child that has exited but whose parent has not called wait() yet. It holds only a process-table slot. You cannot kill it; fix or restart the parent, or let it die so init reaps the orphan." },
    { front: "SIGTERM vs SIGKILL", track: "proc", back: "SIGTERM (15) asks a process to exit and can be caught for cleanup. SIGKILL (9) cannot be caught or ignored and gives no chance to flush state. Send TERM, wait, then KILL." },
    { front: "nohup, disown, tmux", track: "proc", back: "Closing a terminal sends SIGHUP to its jobs. nohup starts a command immune to HUP, disown removes a running job from the shell's list, and tmux keeps a whole session alive on the server to reattach later." },
    { front: "systemctl enable vs start", track: "proc", back: "start runs the unit now; enable creates the links that start it at boot (or when its target is reached). `enable --now` does both. After editing unit files, run `systemctl daemon-reload`." },
    { front: "journalctl -u svc -b -p err", track: "proc", back: "Shows logs for one unit, from the current boot only, at priority err and worse. Add -f to follow, --since '1 hour ago' to window. On macOS the rough equivalent is `log show --last 1h --predicate ...`." },
    { front: "Cron vs systemd timers", track: "proc", back: "Cron is simple but runs with a minimal environment and mails output. systemd timers log to the journal, can catch up missed runs with Persistent=true and reuse unit sandboxing. macOS uses launchd StartCalendarInterval." },
    // fs
    { front: "Inode", track: "fs", back: "The on-disk record for a file: type, permissions, owner, size, timestamps, link count and pointers to data blocks. It does not store the name; directories map names to inode numbers." },
    { front: "Hard link vs symlink", track: "fs", back: "A hard link is another name for the same inode, on the same filesystem, and not for directories. A symlink is a small file holding a path; it can cross filesystems and can dangle when the target moves." },
    { front: "df vs du disagree", track: "fs", back: "df asks the filesystem how many blocks are used; du adds up files it can reach by name. A deleted file still held open by a process uses space df sees and du cannot. Find it with `lsof +L1`." },
    { front: "x on a directory", track: "fs", back: "Execute on a directory means you may traverse it and access entries by name. r lets you list names; w lets you create, rename and delete entries (with x as well)." },
    { front: "umask 022", track: "fs", back: "Bits removed from the default modes: files start from 666 and directories from 777, so new files become 644 and directories 755. umask masks bits; it does not subtract digits." },
    { front: "SUID, SGID, sticky", track: "fs", back: "SUID (4000) runs a program as its file owner, SGID (2000) as its group or makes a directory's new files inherit its group, sticky (1000) on a directory lets only owners delete their files, as in /tmp." },
    { front: "POSIX ACLs", track: "fs", back: "Extra per-user and per-group permission entries managed with setfacl and getfacl; a + after the mode in ls -l signals one. macOS has its own ACL model managed with `chmod +a` and shown by `ls -le`." },
    { front: "sudo -l", track: "fs", back: "Lists exactly which commands the current user may run with sudo on this host. Edit sudoers only with visudo, which syntax-checks before saving so a typo cannot lock everyone out." },
    // perf
    { front: "Load average (Linux)", track: "perf", back: "Exponentially damped 1, 5 and 15 minute averages of tasks that are runnable plus those in uninterruptible sleep. Compare with the core count; high load with idle CPUs usually points at I/O." },
    { front: "free vs available", track: "perf", back: "Linux uses spare RAM as page cache, so 'free' is usually small and that is fine. 'available' estimates what can be handed to applications without swapping and is the number to watch." },
    { front: "%iowait", track: "perf", back: "CPU time spent idle while at least one I/O request was outstanding. It hints at storage waits but is not a measure of disk saturation; check iostat await and queue size." },
    { front: "%steal", track: "perf", back: "Time a virtual CPU wanted to run but the hypervisor gave the physical CPU to another guest. Sustained steal means a noisy neighbour or an undersized instance, not a bug in your code." },
    { front: "USE method", track: "perf", back: "For every resource check Utilization (how busy), Saturation (how much work is queued) and Errors. A fast checklist that finds the bottleneck before you start guessing." },
    { front: "strace overhead", track: "perf", back: "strace uses ptrace and stops the target on every syscall, which can slow it many times over. Fine for a dev box or a stuck process; in production prefer perf trace or eBPF tools." },
    { front: "Flame graph", track: "perf", back: "A visualisation of sampled stack traces: width is the share of samples, the y-axis is stack depth, and the x-axis is sorted alphabetically, not by time. Look for wide plateaus." },
    { front: "Exit code 137", track: "perf", back: "128 + 9: the process was killed by SIGKILL, very often by the kernel OOM killer or a cgroup memory limit. Confirm with `dmesg -T | grep -i oom` or the container's OOMKilled status." },
    // net
    { front: "OSI vs TCP/IP", track: "net", back: "OSI has seven layers as a teaching model; TCP/IP has four practical ones: link, internet, transport and application. Debug bottom-up: link, IP, transport, then the application protocol." },
    { front: "CIDR /26", track: "net", back: "26 network bits leave 6 host bits: 64 addresses per block, 62 usable hosts after the network and broadcast addresses. Mask 255.255.255.192; a /24 splits into four /26s." },
    { front: "RFC 1918 ranges", track: "net", back: "Private IPv4 space: 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16. Not routed on the public internet, so traffic leaves through NAT." },
    { front: "ARP", track: "net", back: "Maps an IPv4 address to a MAC on the local segment: 'who has 192.168.1.1?' broadcast, unicast reply, cached for a while. For off-subnet destinations the host ARPs for its default gateway." },
    { front: "TCP three-way handshake", track: "net", back: "SYN, SYN-ACK, ACK: both sides agree on initial sequence numbers. It costs one round trip before data, which is why connection reuse and keep-alive matter." },
    { front: "TIME_WAIT vs CLOSE_WAIT", track: "net", back: "TIME_WAIT sits on the side that closed first, for about two maximum segment lifetimes, and is normal. Piles of CLOSE_WAIT mean the local application received a FIN but never closed its socket: a bug." },
    { front: "Refused vs timed out", track: "net", back: "Connection refused means a RST came back: the host is reachable but nothing listens on the port. A timeout means nothing came back: a firewall dropped it, the route is wrong or the host is down." },
    { front: "DNS TTL", track: "net", back: "How long resolvers may cache a record. Lower it well before a migration so old answers expire quickly; negative answers (NXDOMAIN) are cached too, governed by the zone's SOA." },
    { front: "HTTP/2 vs HTTP/3", track: "net", back: "HTTP/2 multiplexes streams over one TCP connection, but one lost packet stalls them all. HTTP/3 runs over QUIC on UDP, recovering loss per stream and folding the transport and TLS handshakes together." },
    { front: "SNI and ALPN", track: "net", back: "TLS ClientHello extensions: SNI names the host so one IP can serve many certificates; ALPN negotiates the application protocol such as h2 or http/1.1 inside the handshake." },
    // tools
    { front: "ss -tlnp", track: "tools", back: "Lists listening TCP sockets with numeric ports and the owning process. On macOS use `lsof -nP -iTCP -sTCP:LISTEN` or `netstat -an -p tcp`." },
    { front: "ip route get <addr>", track: "tools", back: "Asks the kernel which route, interface and source address it would use for a destination. macOS equivalent: `route -n get <addr>`." },
    { front: "traceroute * * *", track: "tools", back: "A hop that does not answer the probe, often because the router rate-limits or drops ICMP. Only loss that persists all the way to the final hop indicates a real problem." },
    { front: "dig +trace", track: "tools", back: "Performs the resolution itself from the root down, printing each referral, so you can see which delegation is broken. Note that dig bypasses the macOS system resolver." },
    { front: "curl -w timings", track: "tools", back: "time_namelookup, time_connect, time_appconnect, time_starttransfer and time_total are cumulative. The gaps between them isolate DNS, TCP, TLS and server think time." },
    { front: "openssl s_client -servername", track: "tools", back: "Opens a TLS connection and prints the chain and verify result. Always pass -servername so SNI is sent; without it many servers return a default certificate that does not match." },
    { front: "tcpdump flags [S] [S.] [.] [R]", track: "tools", back: "SYN, SYN-ACK, a bare ACK, and reset. A SYN with no reply means filtered; SYN answered by [R] means refused. Use -nn to avoid DNS lookups while capturing." },
    { front: "Firewall rule order", track: "tools", back: "iptables and nftables evaluate rules top to bottom and the first match decides. Put the ESTABLISHED,RELATED accept early and keep a timed rollback when changing remote rules." },
    // cont
    { front: "Namespace", track: "cont", back: "A kernel feature that gives a process its own view of one resource: PIDs, network stack, mounts, hostname, IPC, user IDs, cgroup root or clocks. A container combines several." },
    { front: "cgroup v2", track: "cont", back: "A single hierarchy under /sys/fs/cgroup where controllers limit and account for CPU (cpu.max), memory (memory.max), I/O (io.max) and process count (pids.max) for a group of processes." },
    { front: "CPU throttling", track: "cont", back: "When a cgroup uses its cpu.max quota within a period, its tasks wait until the next period. Watch nr_throttled in cpu.stat: latency spikes with low average CPU are a classic sign." },
    { front: "overlayfs copy-up", track: "cont", back: "Image layers are read-only lowerdirs; the first write to a file copies it whole into the container's upperdir. Deleting a lower file creates a whiteout entry that hides it in the merged view." },
    { front: "Container vs VM", track: "cont", back: "Containers share the host kernel and isolate with namespaces and cgroups; a VM boots its own kernel on virtual hardware. On macOS, container tools run a small Linux VM for that reason." },
    { front: "PID 1 in a container", track: "cont", back: "The first process gets init duties: no default signal handlers (so SIGTERM may be ignored) and reaping orphaned children. Use a tiny init or a runtime's init option if your app does not handle it." },
    // ssh
    { front: "Host key vs user key", track: "ssh", back: "The host key proves the server's identity and is remembered in known_hosts; your user key proves your identity and its public half sits in the server's authorized_keys." },
    { front: "~/.ssh permissions", track: "ssh", back: "Directory 700, private keys 600, public keys and authorized_keys 644 or tighter. OpenSSH refuses keys that other users can read, with an UNPROTECTED PRIVATE KEY FILE warning." },
    { front: "ProxyJump vs agent forwarding", track: "ssh", back: "ProxyJump (-J) tunnels your connection through a bastion while keys stay on your laptop. Agent forwarding (-A) exposes your agent to anyone with root on the remote host; avoid it when a jump will do." },
    { front: "ssh -L 8080:db.internal.example:5432 bastion", track: "ssh", back: "Listens on your laptop's port 8080 and forwards each connection through bastion, which connects onward to db.internal.example on 5432." },
    { front: "ssh -G host", track: "ssh", back: "Prints the fully resolved client configuration for a host after all Host and Match blocks apply. The first value obtained for an option wins, so specific hosts go above `Host *`." },
    { front: "rsync trailing slash", track: "ssh", back: "`rsync -a src/ dst/` copies the contents of src into dst; `rsync -a src dst/` creates dst/src. Rehearse destructive syncs with --dry-run before adding --delete." }
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
        el("p", { class: "fc-sub" }, "Flip through key Linux, shell and networking terms and self-grade each one. Your progress saves locally in this browser.")
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
