/* =====================================================================
   CITADEL · Exam mode + Flashcards
   Self-contained module. Exposes window.CitadelExam = { mountExam, mountFlashcards }.
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
  function flashIco(cls) { return ico("0 0 24 24", [["path", { d: "M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4" }]], cls); }
  function arrowIco() { return ico("0 0 24 24", [["path", { d: "M5 12h14M13 6l6 6-6 6" }]]); }
  function checkIco() { return ico("0 0 24 24", [["path", { d: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" }]]); }

  /* ---------------- track helpers ---------------- */
  var TRACK_NAMES = {
    core: "Security Foundations",
    crypto: "Cryptography",
    appsec: "Application Security",
    defense: "Network Defense",
    offensive: "Offensive Security",
    threats: "Threats & Forensics",
    domains: "Security Domains",
    reversing: "Reverse Engineering"
  };
  function trackOf(quizId) { return String(quizId).split("-")[0]; }
  function trackLabel(prefix) {
    var T = window.TRACKS || {};
    if (T[prefix] && T[prefix].name) return T[prefix].name;
    if (TRACK_NAMES[prefix]) return TRACK_NAMES[prefix];
    return prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : "Other";
  }

  /* ---------------- quiz pool (read at call time) ---------------- */
  function allQuestions(trackFilter) {
    var Q = window.QUIZZES || {};
    var out = [];
    Object.keys(Q).forEach(function (qid) {
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
      var ia = order.indexOf(a), ib = order.indexOf(b);
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
  var EXAM_KEY = "cy_exam_v1";   // { best, bestPct, takenAt }
  var FLASH_KEY = "cy_flash_v1"; // { "<cardIndex>": "known" | "review" }
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
      var trackSel = el("select", { class: "cy-num exam-select", "aria-label": "Track filter" });
      trackSel.appendChild(optionEl("all", "All tracks", state.track === "all"));
      tracks.forEach(function (t) { trackSel.appendChild(optionEl(t, trackLabel(t), state.track === t)); });
      trackSel.addEventListener("change", function () { state.track = trackSel.value; renderConfig(state); });
      cfg.appendChild(configRow("Track", [trackSel]));

      // timer
      var timerSel = el("select", { class: "cy-num exam-select", "aria-label": "Timer" });
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
          if (answered) {
            try {
              if (window.Citadel && typeof window.Citadel.recordAnswer === "function") {
                window.Citadel.recordAnswer(it.qid, ok);
              }
            } catch (e) {}
          }
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
     ===================================================================== */
  var CARDS = [
    /* ---- core (foundations) ---- */
    { front: "CIA triad", track: "core", back: "Confidentiality, Integrity, and Availability \u2014 the three goals nearly every security control ultimately serves: limiting who can read data, keeping it from being altered undetectably, and keeping it reachable when needed." },
    { front: "Defense in depth", track: "core", back: "Layering independent controls so that if one fails the others still hold. An attacker must defeat every layer, which buys defenders time to detect and respond." },
    { front: "Principle of least privilege", track: "core", back: "Giving each user, process, or service only the minimum access needed to do its job, which shrinks the blast radius when an account or component is compromised." },
    { front: "Risk", track: "core", back: "The expected loss from a threat, usually framed as likelihood multiplied by impact. An easily exploited flaw on a critical asset can outrank a scary-looking but unreachable one." },
    { front: "Threat vs vulnerability", track: "core", back: "A vulnerability is a weakness in a system; a threat is an actor or event that could exploit it. Meaningful risk exists only where a threat, a vulnerability, and a valuable asset meet." },
    { front: "Zero trust", track: "core", back: "A model that never grants trust based on network location and verifies every request explicitly, checking identity, device health, and context continuously rather than once at a perimeter." },
    { front: "Non-repudiation", track: "core", back: "Assurance that a party cannot credibly deny an action they took, typically provided by digital signatures and tamper-evident logging." },
    { front: "AAA", track: "core", back: "Authentication, Authorization, and Accounting: proving who you are, deciding what you are allowed to do, and recording what you actually did." },
    { front: "Kerckhoffs's principle", track: "core", back: "A cryptosystem should stay secure even if everything about it is public except the key. Security must live in the secret key, not in the secrecy of the design." },
    { front: "Attack surface", track: "core", back: "The full set of points where an attacker could try to enter or extract data from a system. Reducing it \u2014 fewer services, ports, and inputs \u2014 is one of the cheapest security wins." },
    { front: "Passkeys / WebAuthn", track: "core", back: "Phishing-resistant authentication where a device-held private key signs an origin-bound challenge. There is no shared password for a fake login page to steal." },
    { front: "Token theft", track: "core", back: "Stealing a session, access, or refresh token so the attacker can act as the user after login. Protect tokens with HttpOnly cookies, short lifetimes, rotation, revocation, and anomaly detection." },
    { front: "Federated identity", track: "core", back: "A trust model where an identity provider authenticates the user and sends a signed token or assertion to another app, which must validate issuer, audience, signature and time bounds." },
    { front: "OAuth 2.0 vs OIDC", track: "core", back: "OAuth delegates authorization to APIs; OpenID Connect adds authentication and ID tokens so a client can learn who signed in. Access tokens and ID tokens must not be used interchangeably." },
    { front: "SAML assertion", track: "core", back: "A signed XML statement from an identity provider to a service provider, commonly used for enterprise SSO. It must be checked for signature, issuer, audience, recipient, time bounds and replay." },
    { front: "Refresh token risk", track: "core", back: "A refresh token can mint new access tokens over time, so theft can persist beyond a short access-token lifetime. Rotate, bind, protect and revoke refresh tokens on logout or suspicious activity." },
    { front: "MFA reset abuse", track: "core", back: "An attacker bypasses strong MFA by convincing support or recovery workflows to reset it. Defend with verified channels, step-up checks, cooldowns, user alerts and approval logs." },

    /* ---- crypto ---- */
    { front: "Symmetric encryption", track: "crypto", back: "Encryption where the same secret key both encrypts and decrypts. It is fast and ideal for bulk data, but the key must be shared securely in advance." },
    { front: "Asymmetric encryption", track: "crypto", back: "A scheme using a linked public/private key pair: anyone can encrypt with the public key, but only the private key can decrypt. It solves key distribution at the cost of speed." },
    { front: "AES-GCM", track: "crypto", back: "The AES cipher run in Galois/Counter Mode, giving confidentiality plus a built-in authentication tag in one pass. Reusing a nonce under the same key breaks its security." },
    { front: "Hashing", track: "crypto", back: "A one-way function mapping arbitrary input to a fixed-size digest, used for integrity checks and fingerprints. Unlike encryption it cannot be reversed to recover the input." },
    { front: "Salting", track: "crypto", back: "Adding a unique random value to each password before hashing, so identical passwords yield different hashes and precomputed rainbow tables become useless." },
    { front: "HMAC", track: "crypto", back: "A keyed hash that proves both the integrity and the authenticity of a message, since only holders of the shared secret key can produce or verify the tag." },
    { front: "Digital signature", track: "crypto", back: "A value created with a private key that anyone can verify with the matching public key, proving the message's origin and that it was not altered." },
    { front: "TLS", track: "crypto", back: "Transport Layer Security: the protocol that encrypts and authenticates data in transit and underpins HTTPS. It negotiates keys in a handshake, then protects traffic with symmetric encryption." },
    { front: "Diffie\u2013Hellman", track: "crypto", back: "A key-exchange method that lets two parties derive a shared secret over an open channel without ever transmitting the secret itself." },
    { front: "Perfect forward secrecy", track: "crypto", back: "A property where session keys are ephemeral, so compromising a long-term private key later cannot decrypt previously recorded sessions." },
    { front: "Nonce / IV", track: "crypto", back: "A number used once (or initialization vector) that randomizes encryption so identical plaintexts don't produce identical ciphertexts. Reuse under one key can be catastrophic." },
    { front: "Key derivation function", track: "crypto", back: "A deliberately slow function such as bcrypt, scrypt, or Argon2 that turns a password into a key, making large-scale brute-force guessing expensive." },

    /* ---- appsec ---- */
    { front: "OWASP Top 10", track: "appsec", back: "A widely referenced, periodically updated list of the most critical web application security risks, used to prioritize defenses and training." },
    { front: "SQL injection", track: "appsec", back: "A flaw where untrusted input is concatenated into a database query, letting an attacker change its logic to read, modify, or destroy data. Parameterized queries are the primary defense." },
    { front: "Cross-site scripting (XSS)", track: "appsec", back: "Injecting attacker-controlled script into a page so it runs in other users' browsers. Contextual output encoding and a strong Content Security Policy mitigate it." },
    { front: "CSRF", track: "appsec", back: "Cross-Site Request Forgery tricks a logged-in user's browser into sending an unwanted authenticated request. Anti-forgery tokens and SameSite cookies defend against it." },
    { front: "SSRF", track: "appsec", back: "Server-Side Request Forgery coerces a server into making requests on the attacker's behalf, often to reach internal systems the attacker cannot touch directly." },
    { front: "IDOR", track: "appsec", back: "Insecure Direct Object Reference: exposing an internal identifier without verifying the requester is authorized for it, letting users reach data that isn't theirs." },
    { front: "Broken access control", track: "appsec", back: "Failures to enforce what authenticated users may do, letting them act outside their intended permissions. It consistently ranks among the most common web risks." },
    { front: "API trust boundary", track: "appsec", back: "The point where an API receives data or control from a less-trusted caller, partner, service or client. Validate shape, authenticate identity, authorize the action and log the decision there." },
    { front: "BOLA", track: "appsec", back: "Broken Object Level Authorization: an API accepts an object identifier without proving the caller may access that exact object. User- and tenant-scoped queries are the core defense." },
    { front: "BFLA", track: "appsec", back: "Broken Function Level Authorization: a caller can invoke an API operation they should not, such as an admin method. Enforce function permission server-side on every route or method." },
    { front: "BOPLA", track: "appsec", back: "Broken Object Property Level Authorization: a caller can read or write fields they should not. Use role-specific DTOs and explicit field allow-lists for input and output." },
    { front: "Mass assignment", track: "appsec", back: "A framework binds a request body directly to a model, letting unexpected fields such as roles or flags be written. Reject unknown fields and allow-list writable properties per operation." },
    { front: "API business-flow abuse", track: "appsec", back: "Using valid API calls in harmful sequences or volumes, such as coupon guessing, scraping or reset flooding. Defend with action-aware quotas, idempotency, complexity limits and anomaly alerts." },
    { front: "API inventory", track: "appsec", back: "A living list of APIs with owner, exposure, auth method, data classification, version, consumers and retirement plan. Unknown or stale endpoints are where old authorization bugs survive." },
    { front: "Input validation", track: "appsec", back: "Checking that incoming data matches strict expectations \u2014 type, length, format, range \u2014 on the trusted server side before it is used." },
    { front: "Output encoding", track: "appsec", back: "Transforming data so it is treated as inert content rather than executable code in its destination context (HTML, attribute, JS, URL), the core defense against XSS." },
    { front: "Parameterized query", track: "appsec", back: "A database call where input is bound as data separate from the query text, so it can never be interpreted as SQL commands." },
    { front: "Content Security Policy", track: "appsec", back: "A browser-enforced allowlist controlling which sources of scripts and other resources a page may load, reducing the impact of injection attacks." },
    { front: "Secure cookie flags", track: "appsec", back: "Attributes like HttpOnly, Secure, and SameSite that respectively hide cookies from scripts, restrict them to HTTPS, and limit cross-site sending." },
    { front: "Safe query API", track: "appsec", back: "A database or ORM interface that separates command structure from user data through prepared statements, bind parameters, or safe query builders. Dynamic identifiers still need allow-lists." },
    { front: "XML hardening", track: "appsec", back: "Configuring XML parsers to reject DTDs, disable external entities, block network fetches, and enforce limits so XXE and entity-expansion attacks cannot run." },
    { front: "Secret-safe logging", track: "appsec", back: "Structured telemetry that preserves useful evidence such as request IDs and authorization decisions while redacting passwords, tokens, raw session IDs, and customer secrets." },
    { front: "Prompt injection", track: "appsec", back: "Untrusted text tries to override an AI system's instructions or policy. Treat prompts and retrieved content as data, and enforce security in code rather than relying on the model to refuse." },
    { front: "Excessive agency", track: "appsec", back: "An AI agent is allowed to take high-impact actions without deterministic policy checks or approval. Scope tools narrowly and gate sensitive actions with dry-run previews and human or policy approval." },
    { front: "Grounding / RAG", track: "appsec", back: "Retrieval-Augmented Generation supplies source material to the model. The retriever must authorize documents before context reaches the model, then log sources for audit." },
    { front: "Retriever poisoning", track: "appsec", back: "Malicious or low-quality documents enter the retrieval set and steer model answers. Defend with trusted ingestion, source ranking, review, and per-user retrieval authorization." },
    { front: "AI-assisted phishing risk", track: "appsec", back: "AI can make social engineering more personalized and scalable. Defenses include phishing-resistant MFA, strong helpdesk verification, user reporting, and behavior-based detection." },
    { front: "AI-assisted defense", track: "appsec", back: "Using AI to summarize alerts, draft detections, review code, build timelines, or threat-model designs. Treat outputs as drafts that require telemetry, tests, peer review, and audit logs." },
    { front: "AI detection draft", track: "appsec", back: "A proposed detection rule or query generated with AI. It must be validated against real benign and suspicious telemetry before it pages analysts or blocks production behavior." },
    { front: "AI red teaming", track: "appsec", back: "Authorized testing of an AI feature for harmful failure modes such as prompt injection, data leakage, unsafe tools, and poisoned retrieval, with findings mapped to concrete controls." },
    { front: "SOC copilot", track: "appsec", back: "An AI assistant that summarizes evidence, clusters alerts, drafts timelines, and suggests next checks while analysts and policy gates retain control over decisions and containment." },
    { front: "AI governance", track: "appsec", back: "The policies around AI use: approved models and tools, allowed data, audit logs, retention, evaluations, and approval boundaries for high-impact actions." },

    /* ---- defense ---- */
    { front: "IDS vs IPS", track: "defense", back: "An Intrusion Detection System alerts on suspicious activity, while an Intrusion Prevention System sits inline in the traffic path and can actively block it." },
    { front: "SIEM", track: "defense", back: "Security Information and Event Management: a platform that centralizes logs from across an environment to correlate events, detect threats, and support investigation." },
    { front: "Firewall", track: "defense", back: "A control that filters network traffic against a rule set, allowing or denying connections based on attributes such as address, port, and protocol." },
    { front: "Network segmentation", track: "defense", back: "Dividing a network into isolated zones so a breach in one segment cannot freely spread to others, limiting an attacker's lateral movement." },
    { front: "EDR", track: "defense", back: "Endpoint Detection and Response: software on hosts that records activity, detects malicious behavior, and enables remote investigation and containment." },
    { front: "MFA", track: "defense", back: "Multi-Factor Authentication requires two or more independent proofs of identity \u2014 something you know, have, or are \u2014 so a stolen password alone is not enough." },
    { front: "Honeypot", track: "defense", back: "A decoy system built to attract and observe attackers, generating high-confidence alerts and intelligence with little legitimate traffic to create noise." },
    { front: "Patch management", track: "defense", back: "The disciplined process of tracking, testing, and applying software updates to close known vulnerabilities before they are exploited." },
    { front: "Principle of least functionality", track: "defense", back: "Configuring systems to run only the services, ports, and software they actually need and removing everything else, which shrinks the attack surface." },
    { front: "Log monitoring", track: "defense", back: "Continuously collecting and reviewing system and security logs so anomalies and incidents are noticed quickly rather than discovered months later." },
    { front: "CISA KEV", track: "defense", back: "The Known Exploited Vulnerabilities catalog identifies flaws observed in real-world exploitation. For defenders, KEV is a strong patch-first signal, especially on internet-facing assets." },
    { front: "Business Impact Analysis", track: "defense", back: "A process that identifies critical business functions, dependencies and downtime impact so recovery priorities are based on business harm rather than guesswork." },
    { front: "RTO vs RPO", track: "defense", back: "Recovery Time Objective is how fast a service must return; Recovery Point Objective is how much recent data loss the business can tolerate." },
    { front: "Immutable backup", track: "defense", back: "A backup copy protected from modification or deletion for a defined period, giving ransomware response a recovery path even if production credentials are compromised." },
    { front: "Restore test", track: "defense", back: "A planned exercise that restores systems or data from backup and measures whether the process meets the required RTO, RPO and validation checks." },
    { front: "Crisis communications", track: "defense", back: "Pre-planned messages, owners and trusted channels for informing employees, customers, regulators, partners and executives during an incident when normal tools may be unavailable." },

    /* ---- offensive ---- */
    { front: "Reconnaissance", track: "offensive", back: "The information-gathering phase of an attack. Passive recon uses public sources without touching the target; active recon probes it directly and risks detection." },
    { front: "Privilege escalation", track: "offensive", back: "Techniques that turn limited access into higher rights, either vertically (user to admin) or horizontally (to another user's resources)." },
    { front: "Lateral movement", track: "offensive", back: "Pivoting from an initial foothold to other systems inside a network, often reusing harvested credentials to expand access toward a goal." },
    { front: "Command and control (C2)", track: "offensive", back: "The channel a compromised host uses to receive instructions from and send data back to an attacker, usually disguised to blend in with normal traffic." },
    { front: "Payload", track: "offensive", back: "The part of an exploit that performs the attacker's intended action once a vulnerability is triggered, such as opening a shell or installing an implant." },
    { front: "Penetration test", track: "offensive", back: "An authorized, scoped simulated attack that finds and demonstrates exploitable weaknesses so they can be fixed. Written authorization is what separates it from a crime." },
    { front: "Red team vs blue team", track: "offensive", back: "The red team emulates adversaries to test defenses while the blue team defends, detects, and responds. Purple teaming blends both to improve faster." },
    { front: "Exploit", track: "offensive", back: "Code or a technique that takes advantage of a specific vulnerability to make a system behave in an unintended, attacker-favorable way." },

    /* ---- threats & forensics ---- */
    { front: "IOC vs IOA", track: "threats", back: "Indicators of Compromise are forensic artifacts showing an attack happened (file hashes, bad IPs); Indicators of Attack describe the behavior and intent of an attack in progress." },
    { front: "MITRE ATT&CK", track: "threats", back: "A curated knowledge base of real-world adversary tactics and techniques, used to map detections, assess coverage, and describe attacker behavior consistently." },
    { front: "Cyber kill chain", track: "threats", back: "A model breaking an intrusion into sequential stages from reconnaissance to actions on objectives; disrupting any single stage can derail the whole attack." },
    { front: "CVSS", track: "threats", back: "The Common Vulnerability Scoring System, a 0\u201310 framework expressing a vulnerability's severity from traits like exploitability and impact, used to prioritize fixes." },
    { front: "APT", track: "threats", back: "An Advanced Persistent Threat: a well-resourced, stealthy adversary that maintains long-term access to a target, typically for espionage or strategic goals." },
    { front: "Ransomware", track: "threats", back: "Malware that encrypts or steals a victim's data and demands payment for its return, often paired with threats to leak the stolen data publicly." },
    { front: "Chain of custody", track: "threats", back: "The documented, unbroken record of who handled a piece of evidence and when, preserving its integrity so it stays admissible and trustworthy." },
    { front: "TTPs", track: "threats", back: "Tactics, Techniques, and Procedures: the patterns of behavior that characterize a threat actor, far more durable for detection than easily changed indicators." },
    { front: "Detection hypothesis", track: "threats", back: "A testable statement of attacker behavior: if this technique occurred, these events should appear in this telemetry source within this time window." },
    { front: "Detection runbook", track: "threats", back: "The analyst's first-response guide for an alert: what evidence to check, what false positives to consider, when to escalate, and which containment actions are allowed." },
    { front: "Residual risk", track: "threats", back: "Risk that remains after controls are applied. It should have an owner, rationale, review date, and a next step for reducing or accepting it deliberately." },

    /* ---- domains ---- */
    { front: "ASLR", track: "domains", back: "Address Space Layout Randomization shuffles where code and data load in memory, making it harder for exploits to predict the addresses they need." },
    { front: "NX / DEP", track: "domains", back: "The No-Execute bit (Data Execution Prevention) marks memory regions such as the stack as non-executable, blocking many classic code-injection attacks." },
    { front: "Incident response lifecycle", track: "domains", back: "A repeatable process \u2014 commonly preparation, detection and analysis, containment, eradication, recovery, and lessons learned \u2014 for handling security incidents." },
    { front: "RTO vs RPO", track: "domains", back: "Recovery Time Objective is how quickly a system must be restored after an outage; Recovery Point Objective is how much recent data loss is tolerable." },
    { front: "Data classification", track: "domains", back: "Labeling data by sensitivity (for example public, internal, confidential, restricted) so the right handling and protection are applied consistently." },
    { front: "Sandboxing", track: "domains", back: "Running untrusted code in an isolated, restricted environment so it cannot harm the host or reach resources beyond what is explicitly permitted." },
    { front: "Workload identity", track: "domains", back: "A platform-issued identity assigned to a service, pod, instance or function so it can receive scoped, short-lived credentials without embedding long-lived secrets." },
    { front: "Metadata service risk", track: "domains", back: "Cloud metadata endpoints can provide workload credentials. SSRF, container escape paths or over-broad roles can turn local metadata access into cloud account access." },
    { front: "Kubernetes RBAC", track: "domains", back: "Role-Based Access Control in Kubernetes defines which users and service accounts can perform which actions on which resources and namespaces." },
    { front: "Admission policy", track: "domains", back: "A Kubernetes control that evaluates objects before they are accepted, blocking risky workloads such as privileged pods, host mounts or unsigned images." },
    { front: "Network policy", track: "domains", back: "A Kubernetes segmentation control that limits which pods may communicate, replacing the dangerous default of broad pod-to-pod reachability." },
    { front: "Serverless invocation permission", track: "domains", back: "The rule that decides which event sources can trigger a function. It must be paired with a narrow runtime role and input validation." },
    { front: "Cloud guardrail", track: "domains", back: "A preventive or detective policy that continuously blocks or flags forbidden cloud configurations such as public storage, privileged pods or unencrypted data." },
    { front: "Data retention", track: "domains", back: "Rules for how long data is kept based on business, legal, safety and privacy needs, followed by provable disposal when the data is no longer required." },
    { front: "DLP", track: "domains", back: "Data Loss Prevention controls that detect or restrict sensitive data leaving expected boundaries through email, file sharing, endpoints, SaaS exports or cloud storage." },
    { front: "Key ownership", track: "domains", back: "Clear accountability for who can use, rotate and administer encryption keys. Key administrators often have practical power over the protected data." },
    { front: "Risk register", track: "domains", back: "A living record of risks, owners, ratings, treatment decisions and review dates that turns governance into accountable action." },
    { front: "Control mapping", track: "domains", back: "Connecting implemented controls to the policies, laws, standards or frameworks they satisfy, reducing duplicate work and making audit evidence clearer." },
    { front: "Policy vs standard vs procedure", track: "domains", back: "A policy states intent, a standard sets the measurable baseline, and a procedure gives the step-by-step way to perform the work." },
    { front: "Third-party risk", track: "domains", back: "The security and privacy exposure created by vendors or partners that handle data, access systems or provide critical services." },
    { front: "Risk acceptance", track: "domains", back: "A documented decision by an accountable owner to tolerate a risk for a defined period, usually with review dates and compensating controls." },
    { front: "PLC", track: "domains", back: "A Programmable Logic Controller reads sensors and drives actuators in industrial processes, making safety and availability central to its security model." },
    { front: "SCADA", track: "domains", back: "Supervisory Control and Data Acquisition systems monitor and command distributed operational equipment such as utilities, manufacturing or building systems." },
    { front: "Zones and conduits", track: "domains", back: "An OT segmentation model: zones group assets with similar trust or safety needs, and conduits define controlled communication paths between them." },
    { front: "Firmware trust", track: "domains", back: "Controls such as signed firmware, secure boot and authenticated updates that help products run only approved code throughout their lifecycle." },
    { front: "Secure mobile storage", track: "domains", back: "Using platform-protected storage, such as a keychain or keystore, for sensitive mobile secrets instead of plain files, clipboards or source constants." },
    { front: "Mobile certificate validation", track: "domains", back: "The app verifies the backend certificate chain and hostname before trusting a TLS connection. Disabling this check lets impostor servers intercept traffic." },
    { front: "Mobile session revocation", track: "domains", back: "The ability to remotely invalidate a device's refresh tokens or sessions after loss, theft, password change or suspicious behavior." },

    /* ---- reversing ---- */
    { front: "Static vs dynamic analysis", track: "reversing", back: "Static analysis examines a program without running it (inspecting code or a binary); dynamic analysis observes its behavior while it executes." },
    { front: "Disassembly vs decompilation", track: "reversing", back: "Disassembly turns machine code into assembly instructions; decompilation attempts to reconstruct higher-level, source-like code from a binary." },
    { front: "Packing / obfuscation", track: "reversing", back: "Techniques that compress or scramble a binary to hide its real code from analysts and signature-based detection until it unpacks itself at runtime." },
    { front: "Debugger", track: "reversing", back: "A tool that runs a program under control, letting an analyst pause execution, set breakpoints, and inspect memory and registers to understand its behavior." }
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
        el("p", { class: "fc-sub" }, "Flip through key security terms and self-grade each one. Your progress saves locally in this browser.")
      )
    ));

    if (!deck.length) {
      page.appendChild(emptyState("Deck is empty", "No flashcards are available."));
      mountEl.appendChild(page);
      return;
    }

    // controls
    var filterSel = el("select", { class: "cy-num fc-select", "aria-label": "Track filter" });
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
  window.CitadelExam = { mountExam: mountExam, mountFlashcards: mountFlashcards };
})();
