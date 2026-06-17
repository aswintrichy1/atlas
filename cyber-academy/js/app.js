/* =====================================================================
   CITADEL · App shell
   Router · renderer · syntax highlighting · quiz engine · search ·
   progress tracking · theme.  Vanilla JS, no dependencies.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- tiny DOM helpers ---------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) {
      if (kid == null || kid === false) continue;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return node;
  };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- data model ---------------- */
  const TRACKS = [window.TRACKS.core, window.TRACKS.crypto, window.TRACKS.appsec, window.TRACKS.defense, window.TRACKS.offensive, window.TRACKS.threats, window.TRACKS.domains, window.TRACKS.reversing].filter(Boolean);
  const QUIZZES = window.QUIZZES || {};
  const Widgets = window.Widgets || {};
  const PracticeContent = window.CitadelPractice || { routes: [], scenarios: [], interviewPrompts: [], rubricBands: [], rubricDimensions: [], cheatsheets: [], glossary: [] };

  // attach a stable id to every quiz question (for weak-spot tracking)
  Object.keys(QUIZZES).forEach((qzid) => {
    (QUIZZES[qzid].questions || []).forEach((qq, idx) => { qq._qid = qzid + "#" + idx; qq._quiz = qzid; });
  });

  // flat ordered list of all lessons for routing / prev-next / search
  const FLAT = [];
  TRACKS.forEach((track) => {
    track.modules.forEach((mod) => {
      mod.lessons.forEach((lesson) => {
        FLAT.push({
          track, mod, lesson,
          key: track.id + "/" + mod.id + "/" + lesson.id,
          route: "#/" + track.id + "/" + mod.id + "/" + lesson.id
        });
      });
    });
  });
  const byKey = Object.fromEntries(FLAT.map((f) => [f.key, f]));
  const ROUTE_ALIASES = {
    "appsec/building/ai-app-security": "appsec/ai-security/ai-app-security",
    "appsec/building/ai-offense-defense": "appsec/ai-security/ai-offense-defense",
    "appsec/building/ai-red-blue-lab": "appsec/ai-security/ai-red-blue-lab",
    "appsec/building/ai-soc-copilot": "appsec/ai-security/ai-soc-copilot",
    "appsec/building/ai-secure-sdlc": "appsec/ai-security/ai-secure-sdlc",
    "appsec/building/ai-governance": "appsec/ai-security/ai-governance",
    "appsec/building/secure-headers": "appsec/hardening/secure-headers",
    "appsec/building/secrets-supply-chain": "appsec/hardening/secrets-supply-chain"
  };
  const GUIDED_PATHS = [
    {
      id: "beginner",
      title: "Beginner Defender",
      badge: "Start here",
      color: "#2dd4bf",
      summary: "Build the core mental models first, then connect them to identity, basic AppSec and incident response.",
      lessons: [
        "core/foundations/cia-triad",
        "core/foundations/threats-vulns-risk",
        "core/foundations/defense-in-depth",
        "core/threat-modeling/stride",
        "core/access/authn-authz",
        "appsec/web-attacks/owasp-top-10",
        "defense/respond/incident-response",
        "domains/path/homelab"
      ]
    },
    {
      id: "appsec",
      title: "AppSec Builder",
      badge: "Ship safer",
      color: "#f5a623",
      summary: "Follow the web risk chain from trust boundaries to authorization, APIs, secure coding and headers.",
      lessons: [
        "core/threat-modeling/trust-boundaries",
        "appsec/web-attacks/owasp-top-10",
        "appsec/web-attacks/injection",
        "appsec/web-attacks/xss",
        "appsec/sessions/access-control",
        "appsec/building/api-security-deep-dive",
        "appsec/building/secure-coding-by-stack",
        "appsec/hardening/secure-headers",
        "threats/case-studies/detection-engineering"
      ]
    },
    {
      id: "blue-team",
      title: "Blue Team Operations",
      badge: "Detect and recover",
      color: "#fb7185",
      summary: "Move from network containment to telemetry, detection engineering, DFIR and resilience planning.",
      lessons: [
        "defense/network/network-security",
        "defense/network/zero-trust",
        "defense/detect/logging-siem",
        "defense/detect/ids-ips",
        "defense/respond/incident-response",
        "defense/respond/cyber-resilience-recovery",
        "threats/intel/threat-hunting",
        "threats/case-studies/detection-engineering",
        "threats/forensics/dfir",
        "threats/case-studies/breach-capstone"
      ]
    },
    {
      id: "ai-security",
      title: "AI Security",
      badge: "LLM guardrails",
      color: "#818cf8",
      summary: "Treat prompts, retrieval, tools and approvals as new trust boundaries with old security invariants.",
      lessons: [
        "core/threat-modeling/trust-boundaries",
        "appsec/building/api-security-deep-dive",
        "appsec/ai-security/ai-app-security",
        "appsec/ai-security/ai-offense-defense",
        "appsec/ai-security/ai-red-blue-lab",
        "appsec/ai-security/ai-soc-copilot",
        "appsec/ai-security/ai-secure-sdlc",
        "appsec/ai-security/ai-governance",
        "threats/case-studies/security-architecture-capstone"
      ]
    }
  ];
  const TOTAL = FLAT.length;

  /* ---------------- progress (localStorage) ---------------- */
  const PKEY = "cy_progress_v1";
  let done = new Set();
  let activeQuiz = null;
  try { done = new Set(JSON.parse(localStorage.getItem(PKEY) || "[]")); } catch (e) { done = new Set(); }
  const saveProgress = () => { try { localStorage.setItem(PKEY, JSON.stringify([...done])); } catch (e) {} };

  /* ---------------- review list (localStorage) ---------------- */
  const RKEY = "cy_review_v1";
  let review = new Set();
  try { review = new Set(JSON.parse(localStorage.getItem(RKEY) || "[]")); } catch (e) { review = new Set(); }
  const saveReview = () => { try { localStorage.setItem(RKEY, JSON.stringify([...review])); } catch (e) {} };

  /* ---------------- weak spots (localStorage) ---------------- */
  // weak[qid] = { seen, wrong } — wrong>0 means the question is "due" for review.
  const WKEY = "cy_weak_v1";
  let weak = {};
  try { weak = JSON.parse(localStorage.getItem(WKEY) || "{}") || {}; } catch (e) { weak = {}; }
  const saveWeak = () => { try { localStorage.setItem(WKEY, JSON.stringify(weak)); } catch (e) {} };
  function recordAnswer(qid, correct) {
    if (!qid) return;
    const w = weak[qid] || { seen: 0, wrong: 0 };
    w.seen++;
    if (!correct) w.wrong++;
    else if (w.wrong > 0) w.wrong--; // spaced repetition: a correct answer decays the miss count
    weak[qid] = w;
    saveWeak();
  }
  // Expose a tiny hook so optional add-on modules (e.g. exam.js) can feed weak-spots.
  window.Citadel = window.Citadel || {};
  window.Citadel.recordAnswer = recordAnswer;
  function weakQuestions() {
    const out = [];
    Object.keys(QUIZZES).forEach((qzid) => {
      (QUIZZES[qzid].questions || []).forEach((qq) => {
        const w = weak[qq._qid];
        if (w && w.wrong > 0) out.push({ q: qq, wrong: w.wrong, quiz: QUIZZES[qzid] });
      });
    });
    out.sort((a, b) => b.wrong - a.wrong);
    return out;
  }

  /* ---------------- last-visited lesson (localStorage) ---------------- */
  const LKEY = "cy_last_v1";
  let lastKey = null;
  try { lastKey = localStorage.getItem(LKEY) || null; } catch (e) { lastKey = null; }
  const saveLast = (k) => { lastKey = k; try { localStorage.setItem(LKEY, k); } catch (e) {} };

  function updateProgressRing() {
    const pct = TOTAL ? Math.round((done.size / TOTAL) * 100) : 0;
    const circ = 2 * Math.PI * 15.5;
    const ring = $("#prValue");
    if (ring) ring.style.strokeDashoffset = String(circ * (1 - pct / 100));
    const txt = $("#progressText");
    if (txt) txt.textContent = pct + "%";
  }

  /* ---------------- theme ---------------- */
  const TKEY = "cy_theme";
  const setTheme = (t) => { document.documentElement.setAttribute("data-theme", t); try { localStorage.setItem(TKEY, t); } catch (e) {} };
  (function initTheme() {
    let t = null;
    try { t = localStorage.getItem(TKEY); } catch (e) {}
    if (!t) t = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(t);
  })();

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.innerHTML = "";
    t.appendChild(el("svg", { class: "t-ico", viewBox: "0 0 24 24", html: '<path d="M20 6 9 17l-5-5"/>' }));
    t.appendChild(document.createTextNode(msg));
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------------- syntax highlighting ---------------- */
  const KEYWORDS = new Set(("class def return if elif else for while do in is new function const let var import from export public private protected interface implements extends void int string boolean double float long char self this raise throw try except catch finally with as yield lambda async await super static abstract final enum struct package switch case break continue default null undefined None True False true false and or not then end module require typeof instanceof of").split(" "));

  function highlight(raw, lang) {
    if (!lang || lang === "text" || lang === "bash") return escapeHtml(raw);
    let commentPart;
    if (lang === "python") commentPart = "#[^\\n]*";
    else if (lang === "sql") commentPart = "--[^\\n]*";
    else commentPart = "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/";
    const re = new RegExp(
      "(" + commentPart + ")" +                       // 1 comment
      "|(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')" + // 2 string
      "|(\\b\\d[\\d_]*(?:\\.\\d+)?\\b)" +              // 3 number
      "|([A-Za-z_$][A-Za-z0-9_$]*)",                  // 4 word
      "g"
    );
    let out = "", last = 0, m;
    while ((m = re.exec(raw))) {
      out += escapeHtml(raw.slice(last, m.index));
      last = re.lastIndex;
      if (m[1]) out += '<span class="tk-com">' + escapeHtml(m[1]) + "</span>";
      else if (m[2]) out += '<span class="tk-str">' + escapeHtml(m[2]) + "</span>";
      else if (m[3]) out += '<span class="tk-num">' + escapeHtml(m[3]) + "</span>";
      else if (m[4]) {
        const w = m[4];
        let cls = null;
        if (KEYWORDS.has(w)) cls = "tk-kw";
        else if (raw[re.lastIndex] === "(") cls = "tk-fn";
        else if (/^[A-Z]/.test(w)) cls = "tk-cls";
        out += cls ? '<span class="' + cls + '">' + escapeHtml(w) + "</span>" : escapeHtml(w);
      }
    }
    out += escapeHtml(raw.slice(last));
    return out;
  }

  /* ---------------- block renderer ---------------- */
  // returns an HTML string; widget/quiz become placeholders mounted later
  const DIAGRAMS = {
    "defense-layers":
      '<svg class="diagram-svg" viewBox="0 0 520 252" role="img" aria-label="Defense in depth shown as concentric layers: people and policy on the outside, then perimeter and network, then host and application, with the data at the core">' +
        '<rect class="dg-box dim" x="30" y="18" width="460" height="212" rx="16"/><text class="dg-cap" x="260" y="38">People &amp; Policy</text>' +
        '<rect class="dg-box dim" x="82" y="50" width="356" height="148" rx="14"/><text class="dg-cap" x="260" y="68">Perimeter &amp; Network</text>' +
        '<rect class="dg-box" x="142" y="82" width="236" height="84" rx="12"/><text class="dg-cap" x="260" y="100">Host &amp; Application</text>' +
        '<rect class="dg-box origin" x="212" y="112" width="96" height="40" rx="10"/><text class="dg-t" x="260" y="137">Data</text>' +
        '<text class="dg-cap" x="260" y="246">Each layer an attacker must defeat buys time to detect and respond</text>' +
      "</svg>",
    "tls-handshake":
      '<svg class="diagram-svg" viewBox="0 0 540 248" role="img" aria-label="TLS handshake: client and server exchange hello messages, the server presents its certificate, both sides derive session keys, and then application data flows encrypted">' +
        '<rect class="dg-box" x="40" y="14" width="120" height="34" rx="8"/><text class="dg-t" x="100" y="35">Client</text>' +
        '<rect class="dg-box accent2" x="380" y="14" width="120" height="34" rx="8"/><text class="dg-t" x="440" y="35">Server</text>' +
        '<path class="dg-edge dim" d="M100 48 L100 228"/><path class="dg-edge dim" d="M440 48 L440 228"/>' +
        '<path class="dg-edge arr" d="M104 80 L436 80"/><text class="dg-cap" x="270" y="74">ClientHello \u00b7 supported ciphers</text>' +
        '<path class="dg-edge arr" d="M436 116 L104 116"/><text class="dg-cap" x="270" y="110">ServerHello \u00b7 Certificate</text>' +
        '<path class="dg-edge arr" d="M104 152 L436 152"/><text class="dg-cap" x="270" y="146">Key exchange \u2192 shared secret</text>' +
        '<path class="dg-edge arr" d="M436 188 L104 188"/><text class="dg-cap" x="270" y="182">Finished \u00b7 encrypted</text>' +
        '<path class="dg-edge arr" d="M104 220 L436 220"/><text class="dg-cap" x="270" y="214">Application data \u00b7 encrypted both ways</text>' +
      "</svg>",
    "kill-chain":
      '<svg class="diagram-svg" viewBox="0 0 640 150" role="img" aria-label="The cyber kill chain in seven stages: reconnaissance, weaponization, delivery, exploitation, installation, command and control, and actions on objectives">' +
        '<rect class="dg-box" x="8" y="40" width="78" height="48" rx="9"/><text class="dg-t" x="47" y="69">Recon</text>' +
        '<rect class="dg-box" x="98" y="40" width="78" height="48" rx="9"/><text class="dg-t" x="137" y="69">Weaponize</text>' +
        '<rect class="dg-box" x="188" y="40" width="78" height="48" rx="9"/><text class="dg-t" x="227" y="69">Deliver</text>' +
        '<rect class="dg-box accent2" x="278" y="40" width="78" height="48" rx="9"/><text class="dg-t" x="317" y="69">Exploit</text>' +
        '<rect class="dg-box" x="368" y="40" width="78" height="48" rx="9"/><text class="dg-t" x="407" y="69">Install</text>' +
        '<rect class="dg-box" x="458" y="40" width="78" height="48" rx="9"/><text class="dg-t" x="497" y="69">C2</text>' +
        '<rect class="dg-box" x="548" y="40" width="84" height="48" rx="9"/><text class="dg-t" x="590" y="69">Actions</text>' +
        '<path class="dg-edge dim" d="M86 64 L98 64"/><path class="dg-edge dim" d="M176 64 L188 64"/><path class="dg-edge dim" d="M266 64 L278 64"/><path class="dg-edge dim" d="M356 64 L368 64"/><path class="dg-edge dim" d="M446 64 L458 64"/><path class="dg-edge dim" d="M536 64 L548 64"/>' +
        '<text class="dg-cap" x="320" y="118">Break any single link and you disrupt the whole intrusion</text>' +
      "</svg>"
  };
  const NOTE_ICON = {
    tip: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
    key: '<path d="M12 2v6m0 0 3-2m-3 2-3-2M5 13a7 7 0 1 0 14 0 7 7 0 0 0-14 0z"/>',
    warn: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    trap: '<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>'
  };
  const NOTE_LABEL = { tip: "Tip", key: "Key idea", warn: "Watch out", trap: "Gotcha" };

  function renderBlock(b) {
    switch (b.t) {
      case "p": return '<div class="block"><p>' + b.html + "</p></div>";
      case "h": return '<h2 class="block-h" id="' + slug(b.text) + '">' + escapeHtml(b.text) + "</h2>";
      case "h2": return '<h3 class="block-h2">' + escapeHtml(b.text) + "</h3>";
      case "ul": return '<div class="block"><ul>' + b.items.map((i) => "<li>" + i + "</li>").join("") + "</ul></div>";
      case "ol": return '<div class="block"><ol>' + b.items.map((i) => "<li>" + i + "</li>").join("") + "</ol></div>";
      case "note":
        return '<div class="note ' + b.variant + '"><svg class="note-ico" viewBox="0 0 24 24">' + (NOTE_ICON[b.variant] || NOTE_ICON.key) +
          '</svg><div class="note-body"><strong>' + (NOTE_LABEL[b.variant] || "Note") + ".</strong> " + stripLeadStrong(b.html) + "</div></div>";
      case "code":
        return '<div class="code-card"><div class="code-head"><span class="code-dots"><i></i><i></i><i></i></span>' +
          '<span class="code-lang">' + escapeHtml(b.lang || "code") + '</span>' +
          '<button class="code-copy" type="button">Copy</button></div>' +
          "<pre><code>" + highlight(b.code, b.lang) + "</code></pre></div>";
      case "table":
        return '<div class="table-wrap"><table class="data"><thead><tr>' +
          b.headers.map((hd) => "<th>" + escapeHtml(hd) + "</th>").join("") + "</tr></thead><tbody>" +
          b.rows.map((r) => "<tr>" + r.map((c) => "<td>" + c + "</td>").join("") + "</tr>").join("") +
          "</tbody></table></div>";
      case "compare":
        return '<div class="compare"><div class="col bad"><h5>' + escapeHtml(b.bad.title) + "</h5><ul>" +
          b.bad.items.map((i) => "<li>" + i + "</li>").join("") + "</ul></div>" +
          '<div class="col good"><h5>' + escapeHtml(b.good.title) + "</h5><ul>" +
          b.good.items.map((i) => "<li>" + i + "</li>").join("") + "</ul></div></div>";
      case "stat":
        return '<div class="statrow">' + b.items.map((s) => '<div class="s"><div class="v">' + escapeHtml(s.v) + '</div><div class="k">' + escapeHtml(s.k) + "</div></div>").join("") + "</div>";
      case "cue":
        return '<div class="cue"><svg class="cue-ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg><div>' + b.html + "</div></div>";
      case "diagram":
        return '<figure class="diagram">' + (DIAGRAMS[b.id] || "") + (b.caption ? '<figcaption>' + escapeHtml(b.caption) + "</figcaption>" : "") + "</figure>";
      case "widget": return '<div class="widget-mount" data-widget="' + escapeHtml(b.id) + '"></div>';
      case "quiz": return '<div class="quiz-mount" data-quiz="' + escapeHtml(b.id) + '"></div>';
      default: return "";
    }
  }
  // notes already begin with a bolded lead in some cases; keep author's <strong> too
  function stripLeadStrong(html) { return html; }
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  /* ---------------- views ---------------- */
  const main = $("#main");

  function trackColorVars(track) { return "--tc:" + track.color + ";--accent:" + track.color + ";"; }

  function homeProgressHtml() {
    const weakN = weakQuestions().length;
    if (!done.size && !review.size && !weakN) return "";
    const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
    const WARN = '<svg viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
    const bars = TRACKS.map((tr) => {
      const total = tr.modules.reduce((a, m) => a + m.lessons.length, 0);
      const comp = tr.modules.reduce((a, m) => a + m.lessons.filter((l) => done.has(tr.id + "/" + m.id + "/" + l.id)).length, 0);
      const pct = total ? Math.round((comp / total) * 100) : 0;
      const href = "#/" + tr.id + "/" + tr.modules[0].id + "/" + tr.modules[0].lessons[0].id;
      return '<a class="hp-track" href="' + href + '" style="--tc:' + tr.color + '">' +
        '<div class="hp-top"><span class="hp-name">' + escapeHtml(tr.short) + "</span><span class=\"hp-num\">" + comp + "/" + total + "</span></div>" +
        '<div class="hp-bar"><i style="width:' + pct + '%"></i></div></a>';
    }).join("");
    return '<section class="home-progress reveal in">' +
      '<div class="hp-head"><h2>Your progress</h2><div class="hp-chips">' +
        '<a class="hp-chip" href="#/review">' + STAR + review.size + " starred</a>" +
        (weakN ? '<a class="hp-chip warn" href="#/practice/weak">' + WARN + weakN + " weak spot" + (weakN === 1 ? "" : "s") + "</a>" : "") +
      "</div></div>" +
      '<div class="hp-tracks">' + bars + "</div>" +
    "</section>";
  }

  function renderHome() {
    document.title = "Citadel · The Cybersecurity Atlas";
    const qTotal = Object.keys(QUIZZES).reduce((a, k) => a + QUIZZES[k].questions.length, 0);
    const feat = [
      ["bolt", "Interactive labs", "Run a cipher, watch a single bit avalanche through a hash, score password entropy, defang a phishing URL, step through a TLS handshake, and probe an access-control matrix."],
      ["check", "Checkpoint quizzes", "Short, explained quizzes after each module lock the ideas in \u2014 with the reasoning, not just the answer."],
      ["save", "Progress, saved locally", "Completed lessons, your study list, and missed-question weak spots all persist in your browser \u2014 no account, no server."],
      ["wifi", "Works fully offline", "Self-contained with zero external requests. Install it as an app and the whole atlas \u2014 lessons, labs and quizzes \u2014 runs with no network."]
    ];
    const icons = {
      bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
      check: '<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
      save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8"/>',
      wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0M12 19.5h.01"/>'
    };
    const resumeF = (lastKey && byKey[lastKey]) ? byKey[lastKey] : null;
    const ARR = ' <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    main.innerHTML =
      '<section class="hero">' +
        '<span class="hero-tag reveal reveal-1"><span class="pulse"></span>Interactive cybersecurity atlas</span>' +
        '<h1 class="reveal reveal-2">Learn to <span class="grad">attack</span><br>so you can<br>truly <span class="grad">defend</span>.</h1>' +
        '<p class="lede reveal reveal-3">Master security end to end \u2014 the <strong>foundations</strong> of risk and threat modeling, the <strong>cryptography</strong> that protects data, the <strong>application security</strong> behind the OWASP Top 10, and the <strong>network defense &amp; operations</strong> that detect and contain attacks. Learn by reading, then by <em>doing</em>.</p>' +
        '<div class="hero-cta reveal reveal-4">' +
          (resumeF
            ? '<a class="btn btn-primary" href="' + resumeF.route + '">Resume \u00b7 ' + escapeHtml(resumeF.lesson.title) + ARR + "</a>" +
              '<a class="btn btn-ghost" href="#/core/foundations/cia-triad">Start with the basics' + ARR + "</a>"
            : '<a class="btn btn-primary" href="#/core/foundations/cia-triad">Start with the basics' + ARR + "</a>" +
              '<a class="btn btn-ghost" href="#/crypto/primitives/encoding-vs-encryption">Jump into crypto' + ARR + "</a>") +
          '<a class="btn btn-ghost" href="#/appsec/web-attacks/owasp-top-10">The OWASP Top 10' + ARR + "</a>" +
          '<a class="btn btn-ghost" href="#/paths">Guided paths' + ARR + "</a>" +
        "</div>" +
        '<div class="hero-stats reveal reveal-5">' +
          '<div class="hero-stat"><div class="num">' + TOTAL + '</div><div class="lbl">lessons</div></div>' +
          '<div class="hero-stat"><div class="num">' + Object.keys(Widgets).length + '</div><div class="lbl">interactive labs</div></div>' +
          '<div class="hero-stat"><div class="num">' + Object.keys(QUIZZES).length + '</div><div class="lbl">quizzes</div></div>' +
          '<div class="hero-stat"><div class="num">' + TRACKS.length + '</div><div class="lbl">full tracks</div></div>' +
        "</div>" +
      "</section>" +
      homeProgressHtml() +
      '<a class="practice-banner path-banner" href="#/paths">' +
        '<div class="pb-ico"><svg viewBox="0 0 24 24"><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15"/></svg></div>' +
        '<div class="pb-text"><h3>Follow a guided learning path</h3><p>Pick Beginner, AppSec, Blue Team or AI Security and copy the ordered plan as Markdown study notes.</p></div>' +
        '<span class="pb-go">Open <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
      "</a>" +
      '<div class="track-cards">' + TRACKS.map(trackCard).join("") + "</div>" +
      '<a class="practice-banner" href="#/practice">' +
        '<div class="pb-ico"><svg viewBox="0 0 24 24"><path d="M9.1 9a3 3 0 1 1 4 2.8c-.8.4-1.1 1-1.1 1.7v.5M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div>' +
        '<div class="pb-text"><h3>Test yourself in Practice mode</h3><p>A shuffled mix of every checkpoint quiz across all ' + TRACKS.length + ' tracks \u2014 ' + qTotal + ' questions for spaced-repetition review.</p></div>' +
        '<span class="pb-go">Start <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
      "</a>" +
      '<h2 class="home-section-title">Practice library</h2>' +
      '<p class="home-section-sub">Offline scenario drills, interview prompts, rubrics, cheat sheets and glossary cards for capstone-quality answers.</p>' +
      practiceRouteCards("home-practice-grid") +
      '<h2 class="home-section-title">Why this works</h2>' +
      '<p class="home-section-sub">Concepts stick when you can poke them. Every abstract idea here has something you can click.</p>' +
      '<div class="feature-grid">' + feat.map(([ic, t, d]) =>
        '<div class="feature"><div class="f-ico"><svg viewBox="0 0 24 24">' + icons[ic] + '</svg></div><h4>' + t + "</h4><p>" + d + "</p></div>"
      ).join("") + "</div>";

    requestAnimationFrame(() => $$(".reveal", main).forEach((n) => n.classList.add("in")));
  }

  function trackCard(track) {
    const lessons = track.modules.reduce((a, m) => a + m.lessons.length, 0);
    const first = track.modules[0].lessons[0];
    return '<a class="track-card" style="' + trackColorVars(track) + '" href="#/' + track.id + "/" + track.modules[0].id + "/" + first.id + '">' +
      '<div class="tc-badge">' + track.short + " · " + lessons + " lessons</div>" +
      "<h3>" + escapeHtml(track.name) + "</h3>" +
      "<p>" + escapeHtml(track.blurb) + "</p>" +
      '<ul class="tc-modlist">' + track.modules.map((m) => "<li>" + escapeHtml(m.name) + "</li>").join("") + "</ul>" +
      '<span class="tc-go">Enter the ' + track.short + " track <svg viewBox=\"0 0 24 24\"><path d=\"M5 12h14M13 6l6 6-6 6\"/></svg></span>" +
      "</a>";
  }

  /* ---------------- static practice library ---------------- */
  const PRACTICE_ACCENT = "var(--violet)";
  const safeRoute = (route) => /^#\/[A-Za-z0-9/_-]+$/.test(route || "") ? route : "#/";
  const practiceMeta = (id) => (PracticeContent.routes || []).find((r) => r.id === id) || { id, title: "Practice", summary: "", count: "" };

  function practiceRouteCards(extraClass) {
    const routes = PracticeContent.routes || [];
    return '<div class="practice-route-grid ' + escapeHtml(extraClass || "") + '">' + routes.map((r) =>
      '<a class="practice-route-card" href="' + safeRoute(r.route) + '">' +
        '<span class="pr-count">' + escapeHtml(r.count || "") + "</span>" +
        "<h3>" + escapeHtml(r.title) + "</h3>" +
        "<p>" + escapeHtml(r.summary) + "</p>" +
      "</a>"
    ).join("") + "</div>";
  }

  function practiceLinksHtml(links) {
    if (!links || !links.length) return "";
    return '<div class="practice-links">' + links.map((link) =>
      '<a class="icon-pill" href="' + safeRoute(link.route) + '">' + escapeHtml(link.label) + "</a>"
    ).join("") + "</div>";
  }

  function renderPracticeShell(id, body, targetId) {
    const meta = practiceMeta(id);
    document.title = meta.title + " · Citadel";
    main.innerHTML =
      '<article class="lesson practice-library-page" style="--accent:' + PRACTICE_ACCENT + '">' +
        '<nav class="crumbs"><a href="#/">Home</a><span class="sep">/</span><span>Practice library</span><span class="sep">/</span><span>' + escapeHtml(meta.title) + "</span></nav>" +
        '<header class="lesson-head reveal in">' +
          "<h1>" + escapeHtml(meta.title) + "</h1>" +
          '<p class="summary">' + escapeHtml(meta.summary) + "</p>" +
          '<div class="tags"><span class="read">' + escapeHtml(meta.count || "offline") + '</span><span class="tag">static</span><span class="tag">offline</span></div>' +
        "</header>" +
        practiceRouteCards("practice-subnav") +
        body +
      "</article>";
    const target = targetId && document.getElementById(targetId);
    if (target) target.scrollIntoView();
    else { main.scrollTop = 0; window.scrollTo(0, 0); }
  }

  function renderScenarioPacks(targetId) {
    const body = '<div class="scenario-stack">' + (PracticeContent.scenarios || []).map((scenario) =>
      '<section class="scenario-card" id="' + escapeHtml(scenario.id) + '">' +
        '<div class="scenario-kicker"><span>' + escapeHtml(scenario.role) + '</span><span>' + escapeHtml(scenario.timebox) + "</span></div>" +
        "<h2>" + escapeHtml(scenario.title) + "</h2>" +
        '<p class="scenario-prompt">' + escapeHtml(scenario.prompt) + "</p>" +
        '<div class="answer-outline">' + (scenario.modelAnswer || []).map((part) =>
          '<div class="answer-part"><h3>' + escapeHtml(part.heading) + "</h3>" +
            "<ul>" + (part.points || []).map((point) => "<li>" + escapeHtml(point) + "</li>").join("") + "</ul>" +
          "</div>"
        ).join("") + "</div>" +
        practiceLinksHtml(scenario.links) +
      "</section>"
    ).join("") + "</div>";
    renderPracticeShell("scenarios", body, targetId);
  }

  function renderInterviewPrompts(targetId) {
    const body = '<div class="prompt-grid">' + (PracticeContent.interviewPrompts || []).map((prompt) =>
      '<section class="prompt-card" id="' + escapeHtml(prompt.id) + '">' +
        "<h2>" + escapeHtml(prompt.title) + "</h2>" +
        '<p class="prompt-ask">' + escapeHtml(prompt.ask) + "</p>" +
        '<div class="prompt-columns">' +
          '<div><h3>Strong signals</h3><ul>' + (prompt.strongSignals || []).map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul></div>" +
          '<div><h3>Pitfalls</h3><ul>' + (prompt.pitfalls || []).map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul></div>" +
        "</div>" +
        practiceLinksHtml(prompt.links) +
      "</section>"
    ).join("") + "</div>";
    renderPracticeShell("interview", body, targetId);
  }

  function renderRubrics() {
    const bands = '<div class="rubric-grid">' + (PracticeContent.rubricBands || []).map((band) =>
      '<section class="rubric-card">' +
        "<h2>" + escapeHtml(band.band) + "</h2>" +
        '<p class="rubric-signal">' + escapeHtml(band.signal) + "</p>" +
        "<ul>" + (band.evidence || []).map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>" +
        '<div class="rubric-coach"><strong>Coach:</strong> ' + escapeHtml(band.coaching) + "</div>" +
      "</section>"
    ).join("") + "</div>";
    const dimensions = '<h2 class="block-h">Evaluation dimensions</h2><div class="table-wrap"><table class="data"><thead><tr><th>Dimension</th><th>Look for</th></tr></thead><tbody>' +
      (PracticeContent.rubricDimensions || []).map((row) => "<tr><td>" + escapeHtml(row[0]) + "</td><td>" + escapeHtml(row[1]) + "</td></tr>").join("") +
      "</tbody></table></div>";
    renderPracticeShell("rubrics", bands + dimensions, null);
  }

  function renderCheatsheets(targetId) {
    const body = '<div class="cheat-grid">' + (PracticeContent.cheatsheets || []).map((sheet) =>
      '<section class="cheat-card" id="' + escapeHtml(sheet.id) + '">' +
        "<h2>" + escapeHtml(sheet.title) + "</h2>" +
        '<p class="cheat-purpose">' + escapeHtml(sheet.purpose) + "</p>" +
        (sheet.sections || []).map((section) =>
          '<div class="cheat-section"><h3>' + escapeHtml(section.heading) + "</h3>" +
            "<ul>" + (section.items || []).map((item) => "<li>" + escapeHtml(item) + "</li>").join("") + "</ul>" +
          "</div>"
        ).join("") +
      "</section>"
    ).join("") + "</div>";
    renderPracticeShell("cheatsheets", body, targetId);
  }

  function renderGlossary(targetId) {
    const terms = PracticeContent.glossary || [];
    const bySlugGloss = Object.fromEntries(terms.map((term) => [term.slug, term]));
    const relatedHtml = (related) => (related || []).filter((slug) => bySlugGloss[slug]).map((slug) =>
      '<a href="#/glossary/' + escapeHtml(slug) + '">' + escapeHtml(bySlugGloss[slug].term) + "</a>"
    ).join("");
    const body = '<div class="glossary-grid">' + terms.map((term) =>
      '<section class="glossary-card" id="' + escapeHtml(term.slug) + '">' +
        "<h2>" + escapeHtml(term.term) + "</h2>" +
        "<p>" + escapeHtml(term.definition) + "</p>" +
        '<div class="glossary-related"><span>Related</span>' + relatedHtml(term.related) + "</div>" +
      "</section>"
    ).join("") + "</div>";
    renderPracticeShell("glossary", body, targetId);
  }

  /* ---------------- guided paths ---------------- */
  function resolvePathLessons(path) {
    return path.lessons.map((key) => byKey[key]).filter(Boolean);
  }

  function renderPaths() {
    document.title = "Learning paths · Citadel";
    const totalSteps = GUIDED_PATHS.reduce((sum, path) => sum + resolvePathLessons(path).length, 0);
    main.innerHTML =
      '<article class="lesson path-page" style="--accent:var(--indigo)">' +
        '<nav class="crumbs"><a href="#/">Home</a><span class="sep">/</span><span>Learning paths</span></nav>' +
        '<header class="lesson-head reveal in">' +
          "<h1>Guided learning paths</h1>" +
          '<p class="summary">Curated routes through existing Citadel lessons. Choose the path that matches your goal, follow the lessons in order, and copy the plan as Markdown for your notes.</p>' +
          '<div class="tags"><span class="read">' + GUIDED_PATHS.length + ' paths</span><span class="tag">' + totalSteps + " linked lessons</span></div>" +
        "</header>" +
        '<div class="path-grid">' + GUIDED_PATHS.map(pathCardHtml).join("") + "</div>" +
      "</article>";

    $$(".copy-path", main).forEach((btn) => {
      btn.addEventListener("click", () => {
        const path = GUIDED_PATHS.find((p) => p.id === btn.getAttribute("data-path"));
        if (!path) return;
        copyText(pathToMd(path), () => {
          const old = btn.textContent;
          btn.textContent = "Copied!";
          btn.classList.add("is-on");
          setTimeout(() => { btn.textContent = old; btn.classList.remove("is-on"); }, 1400);
        });
      });
    });
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function pathCardHtml(path) {
    const steps = resolvePathLessons(path);
    const first = steps[0];
    return '<section class="path-card" style="--path:' + path.color + '">' +
      '<div class="path-top"><span class="path-badge">' + escapeHtml(path.badge) + '</span><span class="path-count">' + steps.length + " lessons</span></div>" +
      "<h2>" + escapeHtml(path.title) + "</h2>" +
      "<p>" + escapeHtml(path.summary) + "</p>" +
      '<ol class="path-steps">' + steps.map((f) =>
        '<li><a href="' + f.route + '"><span class="ps-track">' + escapeHtml(f.track.short) + "</span><span>" + escapeHtml(f.lesson.title) + "</span></a></li>"
      ).join("") + "</ol>" +
      '<div class="path-actions">' +
        (first ? '<a class="btn btn-primary" href="' + first.route + '">Start path</a>' : "") +
        '<button class="icon-pill copy-path" type="button" data-path="' + escapeHtml(path.id) + '">Copy path as Markdown</button>' +
      "</div>" +
    "</section>";
  }

  /* ---------------- practice mode ---------------- */
  function renderPractice(opts) {
    opts = opts || {};
    const size = opts.size || 15;
    const mode = opts.mode === "weak" ? "weak" : "all";
    document.title = "Practice mode · Citadel";

    const weakList = weakQuestions();
    let pool;
    if (mode === "weak") {
      pool = weakList.map((w) => w.q);
    } else {
      pool = [];
      Object.keys(QUIZZES).forEach((qid) => { (QUIZZES[qid].questions || []).forEach((qq) => pool.push(qq)); });
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    }
    const total = pool.length;
    const count = (size === "all" || mode === "weak") ? total : Math.min(size, total);
    const picked = pool.slice(0, count);

    main.innerHTML =
      '<article class="lesson practice-page" style="--accent:var(--violet)">' +
        '<nav class="crumbs"><a href="#/">Home</a><span class="sep">/</span><a href="#/review">Study list</a><span class="sep">/</span><span>Practice mode</span></nav>' +
        '<header class="lesson-head reveal in">' +
          "<h1>Practice mode</h1>" +
          '<p class="summary">' + (mode === "weak"
            ? "Just the questions you\u2019ve missed before \u2014 a quick spaced-repetition drill. Get one right and it leaves the weak-spots list."
            : "A shuffled mix drawn from every checkpoint quiz across all " + TRACKS.length + " tracks. Perfect for spaced repetition before an interview.") + "</p>" +
          '<div class="practice-modes widget-controls"></div>' +
          (mode === "all" ? '<div class="practice-sizes widget-controls"></div>' : "") +
        "</header>" +
        '<div id="practiceSlot"></div>' +
      "</article>";

    // mode toggle
    const modes = $(".practice-modes", main);
    const mkMode = (label, val) => { const b = el("button", { class: "w-seg-btn" + (val === mode ? " active" : "") }, label); b.addEventListener("click", () => { if (val !== mode) renderPractice({ mode: val, size: size }); }); return b; };
    const seg = el("div", { class: "w-seg" }, mkMode("Shuffled \u00b7 all", "all"), mkMode("Weak spots (" + weakList.length + ")", "weak"));
    modes.appendChild(seg);

    if (mode === "all") {
      const sizes = $(".practice-sizes", main);
      [["10", 10], ["15", 15], ["25", 25], ["All " + total, "all"]].forEach(([label, val]) => {
        const b = el("button", { class: "w-btn " + (String(val) === String(size) ? "primary" : "ghost") }, label);
        b.addEventListener("click", () => renderPractice({ mode: "all", size: val }));
        sizes.appendChild(b);
      });
    }

    if (mode === "weak" && !picked.length) {
      $("#practiceSlot").innerHTML =
        '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
        "<h3>No weak spots \u2014 nice.</h3><p>Questions you miss in any quiz land here automatically. Take a few quizzes (or Shuffled practice) and anything you get wrong will show up for targeted review.</p></div>";
    } else {
      mountQuiz($("#practiceSlot"), {
        title: mode === "weak" ? "Weak-spot drill" : "Question set",
        sub: count + (mode === "weak" ? " missed question" + (count === 1 ? "" : "s") + " to re-master" : " questions, shuffled across all " + TRACKS.length + " security tracks"),
        questions: picked
      });
    }
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ---------------- study list (review) ---------------- */
  function renderReview() {
    document.title = "Study list · Citadel";
    const starred = [...review].map((k) => byKey[k]).filter(Boolean);
    const weakList = weakQuestions();

    main.innerHTML =
      '<article class="lesson review-page" style="--accent:var(--amber)">' +
        '<nav class="crumbs"><a href="#/">Home</a><span class="sep">/</span><span>Study list</span></nav>' +
        '<header class="lesson-head reveal in">' +
          "<h1>Your study list</h1>" +
          '<p class="summary">Everything you\u2019ve flagged for another look \u2014 starred lessons and the quiz questions you\u2019ve missed. Built automatically as you learn.</p>' +
        "</header>" +
        '<section class="review-sec" id="reviewStars"></section>' +
        '<section class="review-sec" id="reviewWeak"></section>' +
      "</article>";

    // ---- starred lessons ----
    const starWrap = $("#reviewStars", main);
    starWrap.appendChild(el("div", { class: "review-head" },
      el("svg", { class: "rh-ico", viewBox: "0 0 24 24", html: '<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/>' }),
      el("h2", {}, "Starred lessons"),
      el("span", { class: "rh-count" }, String(starred.length))
    ));
    if (!starred.length) {
      starWrap.appendChild(el("div", { class: "empty-state small" },
        el("p", {}, "No starred lessons yet. Open any lesson and hit the \u2605 Review button to save it here.")
      ));
    } else {
      const list = el("div", { class: "review-list" });
      starred.forEach((f) => {
        const row = el("a", { class: "review-row", href: f.route, style: "--tc:" + f.track.color },
          el("span", { class: "rr-dot" }),
          el("span", { class: "rr-main" },
            el("span", { class: "rr-title" }, f.lesson.title),
            el("span", { class: "rr-crumb" }, f.track.short + " \u00b7 " + f.mod.name)
          ),
          (function () {
            const rm = el("button", { class: "rr-remove", title: "Remove from study list", "aria-label": "Remove " + f.lesson.title + " from study list" },
              el("svg", { viewBox: "0 0 24 24", html: '<path d="M6 6l12 12M18 6L6 18"/>' }));
            rm.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); review.delete(f.key); saveReview(); renderReview(); toast("Removed from study list"); });
            return rm;
          })()
        );
        list.appendChild(row);
      });
      starWrap.appendChild(list);
    }

    // ---- weak spots ----
    const weakWrap = $("#reviewWeak", main);
    const head = el("div", { class: "review-head" },
      el("svg", { class: "rh-ico", viewBox: "0 0 24 24", html: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>' }),
      el("h2", {}, "Weak spots"),
      el("span", { class: "rh-count" }, String(weakList.length))
    );
    weakWrap.appendChild(head);
    if (!weakList.length) {
      weakWrap.appendChild(el("div", { class: "empty-state small" },
        el("p", {}, "No weak spots. Questions you miss in any quiz are tracked here, so you can drill exactly what you got wrong.")
      ));
    } else {
      const drill = el("button", { class: "btn btn-primary review-drill" }, "Drill " + weakList.length + " weak spot" + (weakList.length === 1 ? "" : "s"));
      drill.addEventListener("click", () => { location.hash = "#/practice/weak"; });
      weakWrap.appendChild(drill);
      const list = el("div", { class: "review-list" });
      weakList.slice(0, 20).forEach((w) => {
        list.appendChild(el("div", { class: "review-row static" },
          el("span", { class: "rr-miss" }, "\u00d7" + w.wrong),
          el("span", { class: "rr-main" },
            el("span", { class: "rr-title" }, w.q.q),
            el("span", { class: "rr-crumb" }, w.quiz.title)
          )
        ));
      });
      weakWrap.appendChild(list);
    }
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function renderLesson(ctx) {
    const { track, mod, lesson } = ctx;
    document.title = lesson.title + " · Citadel";
    saveLast(ctx.key);
    const idx = FLAT.findIndex((f) => f.key === ctx.key);
    const prev = FLAT[idx - 1], next = FLAT[idx + 1];
    const isDone = done.has(ctx.key);
    const trackHref = "#/" + track.id + "/" + track.modules[0].id + "/" + track.modules[0].lessons[0].id;

    const blocksHtml = lesson.blocks.map(renderBlock).join("");

    main.innerHTML =
      '<article class="lesson" style="' + trackColorVars(track) + '">' +
        '<nav class="crumbs"><a href="#/">Home</a><span class="sep">/</span>' +
          '<a class="tk-chip" href="' + trackHref + '">' + escapeHtml(track.short) + "</a>" +
          '<span class="sep">/</span><span>' + escapeHtml(mod.name) + "</span></nav>" +
        '<header class="lesson-head reveal in">' +
          "<h1>" + escapeHtml(lesson.title) + "</h1>" +
          '<p class="summary">' + escapeHtml(lesson.summary) + "</p>" +
          '<div class="tags">' +
            '<span class="read">' + (lesson.minutes || 5) + " min read</span>" +
            (lesson.tags || []).map((t) => '<span class="tag">#' + escapeHtml(t) + "</span>").join("") +
          "</div>" +
        "</header>" +
        '<div class="lesson-body">' + blocksHtml + "</div>" +
        '<div class="complete-bar">' +
          '<span class="cb-txt">' + (isDone ? "You\u2019ve completed this lesson." : "Finished reading? Mark it done to track your progress.") + "</span>" +
          '<div class="cb-actions">' +
            '<button class="icon-pill ' + (review.has(ctx.key) ? "is-on" : "") + '" id="reviewBtn" title="Mark for review (star)">' +
              '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>' +
              '<span>' + (review.has(ctx.key) ? "Saved" : "Review") + "</span>" +
            "</button>" +
            '<button class="icon-pill" id="copyMdBtn" title="Copy this lesson as Markdown">' +
              '<svg viewBox="0 0 24 24"><path d="M9 9h6v6H9zM4 15V5a1 1 0 0 1 1-1h10M8 9H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3"/></svg>' +
              "<span>Copy MD</span>" +
            "</button>" +
            '<button class="mark-btn ' + (isDone ? "is-done" : "") + '" id="markBtn">' +
              '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' + (isDone ? "Completed" : "Mark complete") +
            "</button>" +
          "</div>" +
        "</div>" +
        '<nav class="lesson-foot">' +
          (prev ? '<a class="lf-btn prev" href="' + prev.route + '"><span class="dir">\u2190 Previous</span><span class="ttl">' + escapeHtml(prev.lesson.title) + "</span></a>"
                : '<span class="lf-btn prev disabled"><span class="dir">\u2190 Previous</span><span class="ttl">Start of track</span></span>') +
          (next ? '<a class="lf-btn next" href="' + next.route + '"><span class="dir">Next \u2192</span><span class="ttl">' + escapeHtml(next.lesson.title) + "</span></a>"
                : '<span class="lf-btn next disabled"><span class="dir">Next \u2192</span><span class="ttl">End of track</span></span>') +
        "</nav>" +
      "</article>";

    // mount widgets
    $$(".widget-mount", main).forEach((slot) => {
      const id = slot.getAttribute("data-widget");
      if (Widgets[id]) { try { Widgets[id](slot); } catch (e) { slot.innerHTML = '<div class="note warn"><div class="note-body">Widget failed to load.</div></div>'; console.error(e); } }
    });
    // mount quizzes
    $$(".quiz-mount", main).forEach((slot) => {
      const id = slot.getAttribute("data-quiz");
      if (QUIZZES[id]) mountQuiz(slot, QUIZZES[id]);
    });
    // code copy buttons
    $$(".code-copy", main).forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.closest(".code-card").querySelector("code");
        const text = code.textContent;
        const ok = () => { btn.textContent = "Copied"; btn.classList.add("copied"); setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1400); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok).catch(fallbackCopy);
        else fallbackCopy();
        function fallbackCopy() { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) {} document.body.removeChild(ta); }
      });
    });
    // mark complete
    const markBtn = $("#markBtn");
    markBtn.addEventListener("click", () => {
      if (done.has(ctx.key)) { done.delete(ctx.key); markBtn.classList.remove("is-done"); markBtn.lastChild.textContent = "Mark complete"; $(".cb-txt").textContent = "Finished reading? Mark it done to track your progress."; }
      else { done.add(ctx.key); markBtn.classList.add("is-done"); markBtn.lastChild.textContent = "Completed"; $(".cb-txt").textContent = "You\u2019ve completed this lesson."; toast("Lesson marked complete \u2713"); maybeCelebrate(); }
      saveProgress(); updateProgressRing(); buildNav();
    });

    // mark for review (star)
    const reviewBtn = $("#reviewBtn");
    if (reviewBtn) reviewBtn.addEventListener("click", () => {
      if (review.has(ctx.key)) { review.delete(ctx.key); reviewBtn.classList.remove("is-on"); reviewBtn.lastChild.textContent = "Review"; toast("Removed from review"); }
      else { review.add(ctx.key); reviewBtn.classList.add("is-on"); reviewBtn.lastChild.textContent = "Saved"; toast("Saved for review \u2605"); }
      saveReview();
    });

    // copy lesson as markdown
    const copyMdBtn = $("#copyMdBtn");
    if (copyMdBtn) copyMdBtn.addEventListener("click", () => {
      copyText(lessonToMd(ctx), () => { const s = copyMdBtn.querySelector("span"); const old = s.textContent; s.textContent = "Copied!"; copyMdBtn.classList.add("is-on"); setTimeout(() => { s.textContent = old; copyMdBtn.classList.remove("is-on"); }, 1400); });
    });

    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function maybeCelebrate() {
    if (done.size === TOTAL) toast("\uD83C\uDF89 Every lesson complete \u2014 you\u2019ve finished the atlas!");
    else if (done.size % 10 === 0) toast(done.size + " lessons done \u2014 keep going!");
  }

  /* ---------------- clipboard helper ---------------- */
  function copyText(text, onOk) {
    const ok = () => { if (onOk) onOk(); };
    function fallback() { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) {} document.body.removeChild(ta); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok).catch(fallback);
    else fallback();
  }

  /* ---------------- markdown export ---------------- */
  const stripTags = (html) => String(html)
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "_$1_")
    .replace(/<i>(.*?)<\/i>/gi, "_$1_")
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<a [^>]*>(.*?)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
  const NOTE_MD = { tip: "Tip", key: "Key idea", warn: "Watch out", trap: "Gotcha" };

  function blockToMd(b) {
    switch (b.t) {
      case "p": return stripTags(b.html) + "\n";
      case "h": return "## " + b.text + "\n";
      case "h2": return "### " + b.text + "\n";
      case "ul": return b.items.map((i) => "- " + stripTags(i)).join("\n") + "\n";
      case "ol": return b.items.map((i, n) => (n + 1) + ". " + stripTags(i)).join("\n") + "\n";
      case "cue": return "> **Recognize it:** " + stripTags(b.html) + "\n";
      case "note": return "> **" + (NOTE_MD[b.variant] || "Note") + ".** " + stripTags(b.html) + "\n";
      case "code": return "```" + (b.lang || "") + "\n" + b.code + "\n```\n";
      case "table": {
        const head = "| " + b.headers.map(stripTags).join(" | ") + " |";
        const sep = "| " + b.headers.map(() => "---").join(" | ") + " |";
        const rows = b.rows.map((r) => "| " + r.map(stripTags).join(" | ") + " |").join("\n");
        return head + "\n" + sep + "\n" + rows + "\n";
      }
      case "compare":
        return "**" + stripTags(b.bad.title) + "**\n" + b.bad.items.map((i) => "- " + stripTags(i)).join("\n") +
          "\n\n**" + stripTags(b.good.title) + "**\n" + b.good.items.map((i) => "- " + stripTags(i)).join("\n") + "\n";
      case "stat": return b.items.map((s) => "- **" + stripTags(s.v) + "** " + stripTags(s.k)).join("\n") + "\n";
      case "widget": return "_[Interactive lab: " + b.id + "]_\n";
      case "quiz": return "_[Checkpoint quiz]_\n";
      default: return "";
    }
  }
  function lessonToMd(ctx) {
    const { track, mod, lesson } = ctx;
    let out = "# " + lesson.title + "\n\n";
    out += "_" + track.name + " \u203a " + mod.name + " \u00b7 " + (lesson.minutes || 5) + " min_\n\n";
    out += "> " + lesson.summary + "\n\n";
    out += lesson.blocks.map(blockToMd).join("\n");
    return out.trim() + "\n";
  }
  function trackToMd(track) {
    let out = "# " + track.name + " \u2014 Cheat sheet\n\n" + "> " + track.blurb + "\n";
    track.modules.forEach((m, mi) => {
      out += "\n\n---\n\n## " + String(mi + 1).padStart(2, "0") + " \u00b7 " + m.name + "\n";
      m.lessons.forEach((l) => {
        out += "\n### " + l.title + "\n" + l.summary + "\n";
      });
    });
    return out.trim() + "\n";
  }
  function pathToMd(path) {
    const steps = resolvePathLessons(path);
    let out = "# Citadel Learning Path: " + path.title + "\n\n";
    out += "> " + path.summary + "\n\n";
    out += "## Ordered lessons\n\n";
    steps.forEach((f, i) => {
      out += (i + 1) + ". [" + f.lesson.title + "](" + f.route + ") - " + f.track.name + " / " + f.mod.name + "\n";
      out += "   - " + f.lesson.summary + "\n";
    });
    out += "\n## Study checklist\n\n";
    out += "- Read each lesson in order and mark it complete in Citadel.\n";
    out += "- Copy any lesson notes you want to keep using the lesson Copy MD button.\n";
    out += "- Finish with the path's capstone or practice drill where included.\n";
    return out.trim() + "\n";
  }

  function mountQuiz(slot, quiz) {
    let i = 0, score = 0, answered = false;
    const LETTERS = ["A", "B", "C", "D", "E"];
    function render() {
      slot.innerHTML = "";
      const card = el("div", { class: "quiz" });
      card.appendChild(el("div", { class: "quiz-head" },
        el("svg", { class: "q-ico", viewBox: "0 0 24 24", html: '<path d="M9.1 9a3 3 0 1 1 4 2.8c-.8.4-1.1 1-1.1 1.7v.5M12 17h.01"/><circle cx="12" cy="12" r="10"/>' }),
        el("h3", {}, quiz.title),
        el("span", { class: "quiz-progress" }, "Q" + (i + 1) + " / " + quiz.questions.length)
      ));
      card.appendChild(el("p", { class: "quiz-sub" }, quiz.sub));

      if (i >= quiz.questions.length) { renderResult(card); slot.appendChild(card); return; }

      const q = quiz.questions[i];
      answered = false;
      card.appendChild(el("p", { class: "q-question" }, q.q));
      const opts = el("div", { class: "q-options", role: "group", "aria-label": "Answer choices" });
      q.options.forEach((opt, oi) => {
        const btn = el("button", { class: "q-opt", type: "button" },
          el("span", { class: "q-key" }, LETTERS[oi]),
          el("span", {}, opt)
        );
        btn.addEventListener("click", () => choose(oi, opts, q, explain, nextBtn));
        opts.appendChild(btn);
      });
      card.appendChild(opts);
      const explain = el("div", { class: "q-explain", role: "status", "aria-live": "polite" }, el("strong", {}, "Why: "), document.createTextNode(q.explain));
      card.appendChild(explain);
      const nextBtn = el("button", { class: "quiz-next", disabled: "true" }, i === quiz.questions.length - 1 ? "See result" : "Next question");
      nextBtn.addEventListener("click", () => { i++; render(); });
      card.appendChild(el("div", { class: "quiz-foot" },
        el("span", { class: "quiz-hint" }, "Tip: press " + LETTERS.slice(0, q.options.length).join(" / ") + " to answer"),
        nextBtn
      ));
      slot.appendChild(card);
      activeQuiz = { el: opts, count: q.options.length, pick: (oi) => choose(oi, opts, q, explain, nextBtn) };
    }

    function choose(oi, opts, q, explain, nextBtn) {
      if (answered) return;
      answered = true;
      const btns = $$(".q-opt", opts);
      btns.forEach((b, bi) => {
        b.disabled = true;
        if (bi === q.answer) b.classList.add("correct");
        else if (bi === oi) b.classList.add("wrong");
      });
      if (oi === q.answer) score++;
      recordAnswer(q._qid, oi === q.answer);
      explain.classList.add("show");
      nextBtn.disabled = false;
    }

    function renderResult(card) {
      const pct = Math.round((score / quiz.questions.length) * 100);
      const pass = pct >= 70;
      const wrap = el("div", { class: "quiz-result" });
      wrap.appendChild(el("div", { class: "score " + (pass ? "pass" : "fail") }, score + " / " + quiz.questions.length));
      wrap.appendChild(el("p", {}, pass ? "Solid \u2014 you\u2019ve got this. " + pct + "% correct." : "Worth a review \u2014 " + pct + "% correct. Re-read and try again."));
      const retry = el("button", { class: "quiz-retry" }, "Try again");
      retry.addEventListener("click", () => { i = 0; score = 0; render(); });
      wrap.appendChild(retry);
      card.appendChild(wrap);
    }

    render();
  }

  /* ---------------- sidebar nav ---------------- */
  const TRACK_ICON = {
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16 8 14 14 8 16 10 10 16 8"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8M21 7v6h-6"/>',
    bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/>',
    queue: '<rect x="3" y="5" width="4" height="14"/><rect x="10" y="5" width="4" height="14"/><rect x="17" y="5" width="4" height="14"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v5"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3z"/>',
    blocks: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
    map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15"/>',
    cube: '<path d="M12 2 3 7v10l9 5 9-5V7l-9-5zM3 7l9 5 9-5M12 12v10"/>',
    diamond: '<path d="M12 2 2 12l10 10 10-10L12 2z"/>',
    broom: '<path d="M19 5l-7 7M5 19l4-1 7-7-3-3-7 7-1 4zM14 8l2 2"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    wrench: '<path d="M14 7a4 4 0 0 0-5.4 4.6L3 17.2 6.8 21l5.6-5.6A4 4 0 0 0 17 10l-3 3-3-3 3-3z"/>'
  };

  function buildNav() {
    const nav = $("#nav");
    const active = currentKey();
    nav.innerHTML = "";
    TRACKS.forEach((track) => {
      const total = track.modules.reduce((a, m) => a + m.lessons.length, 0);
      const completed = track.modules.reduce((a, m) => a + m.lessons.filter((l) => done.has(track.id + "/" + m.id + "/" + l.id)).length, 0);
      const head = el("div", { class: "nav-track-head" },
        el("span", { class: "tk-dot", style: "background:" + track.color }),
        el("span", { class: "tk-name", style: "color:" + track.color }, track.short),
        el("span", { class: "tk-meta" }, completed + "/" + total)
      );
      const trackWrap = el("div", { class: "nav-track", style: "--accent:" + track.color }, head);

      track.modules.forEach((mod, mi) => {
        const hasActive = mod.lessons.some((l) => track.id + "/" + mod.id + "/" + l.id === active);
        const details = el("details", { class: "nav-module" });
        if (hasActive || (active === null && mi === 0 && track === TRACKS[0])) details.setAttribute("open", "");
        const sumBtn = el("summary", { class: "nav-module-btn" },
          el("svg", { class: "chev", viewBox: "0 0 24 24", html: '<path d="M9 6l6 6-6 6"/>' }),
          el("span", { class: "mod-num" }, String(mi + 1).padStart(2, "0")),
          el("span", {}, mod.name)
        );
        details.appendChild(sumBtn);
        const ul = el("ul", { class: "nav-lessons" });
        mod.lessons.forEach((lesson) => {
          const key = track.id + "/" + mod.id + "/" + lesson.id;
          const a = el("a", { href: "#/" + key, class: (key === active ? "active " : "") + (done.has(key) ? "done" : "") },
            el("span", { class: "ls-check" }),
            el("span", { class: "ls-name" }, lesson.title)
          );
          ul.appendChild(el("li", {}, a));
        });
        details.appendChild(ul);
        trackWrap.appendChild(details);
      });
      nav.appendChild(trackWrap);
    });
    // set module icon accent via summary? handled in CSS by chevron. (icons map kept for future use)
    void TRACK_ICON;
  }

  /* ---------------- search ---------------- */
  const searchInput = $("#search");
  const searchResults = $("#searchResults");
  let searchIdx = -1;

  function doSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { searchResults.hidden = true; searchResults.innerHTML = ""; return; }
    const terms = q.split(/\s+/);
    const scored = FLAT.map((f) => {
      const hay = (f.lesson.title + " " + f.lesson.summary + " " + (f.lesson.tags || []).join(" ") + " " + f.mod.name + " " + f.track.name).toLowerCase();
      let score = 0;
      terms.forEach((t) => {
        if (f.lesson.title.toLowerCase().includes(t)) score += 5;
        if (hay.includes(t)) score += 1;
      });
      return { f, score };
    }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);

    searchResults.innerHTML = "";
    if (!scored.length) { searchResults.innerHTML = '<div class="sr-empty">No matches for \u201c' + escapeHtml(q) + '\u201d</div>'; searchResults.hidden = false; return; }
    scored.forEach((s, n) => {
      const f = s.f;
      const a = el("a", { class: "sr-item" + (n === 0 ? " active" : ""), href: f.route, role: "option" },
        el("div", { class: "sr-title", html: hl(f.lesson.title, terms) }),
        el("div", { class: "sr-crumb" }, f.track.short + " · " + f.mod.name)
      );
      a.addEventListener("click", () => closeSearch());
      searchResults.appendChild(a);
    });
    searchIdx = 0;
    searchResults.hidden = false;
  }
  function hl(text, terms) {
    let out = escapeHtml(text);
    terms.forEach((t) => { if (!t) return; const re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"); out = out.replace(re, "<mark>$1</mark>"); });
    return out;
  }
  function closeSearch() { searchResults.hidden = true; searchInput.value = ""; }
  function moveSearch(dir) {
    const items = $$(".sr-item", searchResults);
    if (!items.length) return;
    items[searchIdx] && items[searchIdx].classList.remove("active");
    searchIdx = (searchIdx + dir + items.length) % items.length;
    items[searchIdx].classList.add("active");
    items[searchIdx].scrollIntoView({ block: "nearest" });
  }

  searchInput.addEventListener("input", () => doSearch(searchInput.value));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveSearch(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSearch(-1); }
    else if (e.key === "Enter") { const items = $$(".sr-item", searchResults); if (items[searchIdx]) { location.hash = items[searchIdx].getAttribute("href"); closeSearch(); searchInput.blur(); } }
    else if (e.key === "Escape") { closeSearch(); searchInput.blur(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search-wrap")) searchResults.hidden = true; });

  /* ---------------- router ---------------- */
  function currentKey() {
    const h = location.hash.replace(/^#\//, "");
    const parts = h.split("/").filter(Boolean);
    if (parts.length >= 3) { const k = parts[0] + "/" + parts[1] + "/" + parts[2]; return byKey[k] ? k : null; }
    return null;
  }

  function renderExam() {
    document.title = "Exam mode \u00b7 Citadel";
    if (window.CitadelExam && window.CitadelExam.mountExam) window.CitadelExam.mountExam(main);
    else main.innerHTML = '<article class="lesson"><div class="empty-state"><h3>Exam module unavailable</h3><p>The exam module failed to load.</p></div></article>';
    main.scrollTop = 0; window.scrollTo(0, 0);
  }
  function renderFlashcards() {
    document.title = "Flashcards \u00b7 Citadel";
    if (window.CitadelExam && window.CitadelExam.mountFlashcards) window.CitadelExam.mountFlashcards(main);
    else main.innerHTML = '<article class="lesson"><div class="empty-state"><h3>Flashcards unavailable</h3><p>The flashcards module failed to load.</p></div></article>';
    main.scrollTop = 0; window.scrollTo(0, 0);
  }

  // Printable cheat sheet: a whole track rendered as one clean page for print / Save-as-PDF.
  function renderPrint(trackId) {
    const track = TRACKS.find((t) => t.id === trackId);
    if (!track) { renderHome(); return; }
    document.title = track.name + " cheat sheet \u00b7 Citadel";
    const printable = (b) => b.t !== "widget" && b.t !== "quiz"; // skip interactive blocks on paper
    const mods = track.modules.map((mod, mi) => {
      const lessons = mod.lessons.map((lesson) => {
        const body = lesson.blocks.filter(printable).map(renderBlock).join("");
        return '<section class="cheat-lesson"><h2 class="block-h">' + escapeHtml(lesson.title) + "</h2>" +
          '<p class="summary">' + escapeHtml(lesson.summary) + "</p>" + body + "</section>";
      }).join("");
      return '<section class="cheat-module"><h2 class="cheat-mod-h">' + String(mi + 1).padStart(2, "0") + " \u00b7 " + escapeHtml(mod.name) + "</h2>" + lessons + "</section>";
    }).join("");

    main.innerHTML =
      '<article class="lesson printable" style="' + trackColorVars(track) + '">' +
        '<div class="print-toolbar">' +
          '<nav class="crumbs"><a href="#/">Home</a><span class="sep">/</span><span>' + escapeHtml(track.short) + " cheat sheet</span></nav>" +
          '<div class="pt-btns">' +
            '<button class="btn btn-ghost" id="printBack">\u2190 Back</button>' +
            '<button class="btn btn-primary" id="printNow">Print / Save as PDF</button>' +
          "</div>" +
        "</div>" +
        '<header class="lesson-head"><h1>' + escapeHtml(track.name) + " \u2014 cheat sheet</h1>" +
          '<p class="summary">' + escapeHtml(track.blurb) + "</p></header>" +
        '<div class="lesson-body">' + mods + "</div>" +
      "</article>";

    const printNow = $("#printNow"); if (printNow) printNow.addEventListener("click", () => window.print());
    const printBack = $("#printBack"); if (printBack) printBack.addEventListener("click", () => { const f = track.modules[0].lessons[0]; location.hash = "#/" + track.id + "/" + track.modules[0].id + "/" + f.id; });
    // disable the decorative copy buttons on the printable view
    $$(".code-copy", main).forEach((b) => b.remove());
    main.scrollTop = 0; window.scrollTo(0, 0);
  }

  function route() {
    const h = location.hash.replace(/^#\//, "");
    const parts = h.split("/").filter(Boolean);
    closeMobileNav();
    const rawKey = parts.length >= 3 ? parts[0] + "/" + parts[1] + "/" + parts[2] : "";
    const lessonKey = ROUTE_ALIASES[rawKey] || rawKey;
    if (rawKey && ROUTE_ALIASES[rawKey]) {
      location.replace("#/" + lessonKey + (parts[3] ? "/" + parts[3] : ""));
      return;
    }
    if (lessonKey && byKey[lessonKey]) {
      renderLesson(byKey[lessonKey]);
    } else if (parts[0] === "scenarios") {
      renderScenarioPacks(parts[1]);
    } else if (parts[0] === "interview") {
      renderInterviewPrompts(parts[1]);
    } else if (parts[0] === "rubrics") {
      renderRubrics();
    } else if (parts[0] === "cheatsheets") {
      renderCheatsheets(parts[1]);
    } else if (parts[0] === "glossary") {
      renderGlossary(parts[1]);
    } else if (parts[0] === "paths") {
      renderPaths();
    } else if (parts[0] === "practice") {
      renderPractice({ mode: parts[1] === "weak" ? "weak" : "all" });
    } else if (parts[0] === "review") {
      renderReview();
    } else if (parts[0] === "exam") {
      renderExam();
    } else if (parts[0] === "flashcards") {
      renderFlashcards();
    } else if (parts[0] === "print" && parts[1]) {
      renderPrint(parts[1]);
    } else if (parts.length === 1 && TRACKS.find((t) => t.id === parts[0])) {
      // track root -> first lesson of track
      const track = TRACKS.find((t) => t.id === parts[0]);
      const first = track.modules[0].lessons[0];
      location.replace("#/" + track.id + "/" + track.modules[0].id + "/" + first.id);
      return;
    } else {
      renderHome();
    }
    buildNav();
    updateProgressRing();
    // scroll to in-page anchor if present (4th segment)
    if (parts.length >= 4) {
      const target = document.getElementById(parts[3]);
      if (target) target.scrollIntoView();
    }
  }

  /* ---------------- mobile nav ---------------- */
  const sidebar = $("#sidebar");
  const scrim = $("#scrim");
  const navToggle = $("#navToggle");
  function openMobileNav() { sidebar.classList.add("open"); scrim.hidden = false; navToggle.setAttribute("aria-expanded", "true"); }
  function closeMobileNav() { sidebar.classList.remove("open"); scrim.hidden = true; navToggle.setAttribute("aria-expanded", "false"); }
  navToggle.addEventListener("click", () => { sidebar.classList.contains("open") ? closeMobileNav() : openMobileNav(); });
  scrim.addEventListener("click", closeMobileNav);
  $("#nav").addEventListener("click", (e) => { if (e.target.closest("a")) closeMobileNav(); });

  /* ---------------- top-bar controls ---------------- */
  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setTheme(next);
    toast(next === "dark" ? "Dark mode" : "Light mode");
  });
  (function () { const b = $("#cmdkBtn"); if (b) b.addEventListener("click", () => { palette.hidden ? openPalette() : closePalette(); }); })();
  $("#resetProgress").addEventListener("click", () => {
    if (!done.size) { toast("No progress to reset"); return; }
    if (confirm("Reset all lesson progress? This can\u2019t be undone.")) {
      done.clear(); saveProgress(); updateProgressRing(); buildNav();
      // refresh current lesson state
      const k = currentKey(); if (k) renderLesson(byKey[k]);
      toast("Progress reset");
    }
  });

  /* ---------------- command palette (Cmd-K) ---------------- */
  const palette = el("div", { class: "palette", hidden: "true", role: "dialog", "aria-modal": "true", "aria-label": "Command palette" },
    el("div", { class: "palette-box" },
      el("input", { id: "paletteInput", type: "text", placeholder: "Jump to a lesson or run a command\u2026", autocomplete: "off", "aria-label": "Search lessons and commands", role: "combobox", "aria-expanded": "true", "aria-controls": "paletteList" }),
      el("div", { id: "paletteList", class: "palette-list", role: "listbox", "aria-label": "Results" })
    )
  );
  document.body.appendChild(palette);
  const paletteInput = $("#paletteInput", palette);
  const paletteList = $("#paletteList", palette);
  let paletteIdx = 0, paletteRows = [], paletteLastFocus = null;

  function paletteCommands() {
    const cmds = [
      { label: "Practice mode", sub: "Shuffled quiz \u00b7 all tracks", icon: "quiz", run: () => { location.hash = "#/practice"; } },
      { label: "Learning paths", sub: "Beginner, AppSec, Blue Team, AI Security", icon: "path", run: () => { location.hash = "#/paths"; } },
      { label: "Exam mode", sub: "Timed, scored, per-track breakdown", icon: "quiz", run: () => { location.hash = "#/exam"; } },
      { label: "Flashcards", sub: "Flip through key terms", icon: "lesson", run: () => { location.hash = "#/flashcards"; } },
      { label: "Drill weak spots", sub: weakQuestions().length + " missed question(s)", icon: "warn", run: () => { location.hash = "#/practice/weak"; } },
      { label: "Study list", sub: review.size + " starred \u00b7 " + weakQuestions().length + " weak", icon: "star", run: () => { location.hash = "#/review"; } },
      { label: "Print this lesson", sub: "Open the print dialog", icon: "print", run: () => window.print() },
      { label: "Toggle theme", sub: "Dark / light", icon: "theme", run: () => $("#themeToggle").click() },
      { label: "Keyboard shortcuts", sub: "Press ? anytime", icon: "keyboard", run: () => openHelp() },
      { label: "Export progress", sub: "Download a backup file", icon: "download", run: () => exportData() },
      { label: "Import progress", sub: "Restore from a backup file", icon: "upload", run: () => { const i = $("#importFile"); if (i) i.click(); } },
      { label: "Reset progress", sub: "Clear completed lessons", icon: "reset", run: () => $("#resetProgress").click() },
      { label: "Go home", sub: "The atlas overview", icon: "home", run: () => { location.hash = "#/"; } }
    ];
    (PracticeContent.routes || []).forEach((r) => cmds.push({
      label: r.title,
      sub: r.summary,
      icon: r.id === "scenarios" ? "path" : r.id === "rubrics" ? "md" : "lesson",
      run: () => { location.hash = safeRoute(r.route); }
    }));
    TRACKS.forEach((tr) => cmds.push({
      label: "Copy " + tr.short + " cheat sheet", sub: "Markdown \u00b7 " + tr.name, icon: "md",
      run: () => copyText(trackToMd(tr), () => toast(tr.short + " cheat sheet copied"))
    }));
    TRACKS.forEach((tr) => cmds.push({
      label: "Print " + tr.short + " cheat sheet", sub: "Printable page \u00b7 " + tr.name, icon: "print",
      run: () => { location.hash = "#/print/" + tr.id; }
    }));
    GUIDED_PATHS.forEach((path) => cmds.push({
      label: "Copy " + path.title + " path", sub: "Markdown \u00b7 learning path", icon: "path",
      run: () => copyText(pathToMd(path), () => toast(path.title + " path copied"))
    }));
    return cmds;
  }
  const PAL_ICON = {
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4 2.8c-.8.4-1.1 1-1.1 1.7M12 17h.01"/>',
    theme: '<circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4 12H1M23 12h-3"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
    md: '<path d="M9 9h6v6H9zM4 15V5a1 1 0 0 1 1-1h10M8 9H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3"/>',
    warn: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
    lesson: '<path d="M4 5h16M4 12h16M4 19h10"/>',
    star: '<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/>',
    download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    upload: '<path d="M12 21V9m0 0l-4 4m4-4l4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/>',
    path: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15"/>'
  };

  function paletteData(q) {
    q = q.trim().toLowerCase();
    const cmds = paletteCommands().map((c) => ({ kind: "cmd", score: q ? (c.label.toLowerCase().includes(q) ? 5 : -1) : 1, item: c }));
    const lessons = FLAT.map((f) => {
      const hay = (f.lesson.title + " " + f.mod.name + " " + f.track.name + " " + (f.lesson.tags || []).join(" ")).toLowerCase();
      let score = 0;
      if (!q) score = 0.5;
      else { if (f.lesson.title.toLowerCase().includes(q)) score += 5; if (hay.includes(q)) score += 1; }
      return { kind: "lesson", score, item: f, starred: review.has(f.key) };
    });
    return cmds.concat(lessons).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 30);
  }

  function renderPaletteList() {
    const rows = paletteData(paletteInput.value);
    paletteRows = rows; paletteIdx = 0;
    paletteList.innerHTML = "";
    if (!rows.length) { paletteList.appendChild(el("div", { class: "pal-empty" }, "No matches")); return; }
    rows.forEach((r, i) => {
      let label, sub, icon;
      if (r.kind === "cmd") { label = r.item.label; sub = r.item.sub; icon = r.item.icon; }
      else { label = r.item.lesson.title; sub = r.item.track.short + " \u00b7 " + r.item.mod.name; icon = r.starred ? "star" : "lesson"; }
      const row = el("div", { class: "pal-row" + (i === 0 ? " active" : "") + (r.kind === "cmd" ? " is-cmd" : ""), role: "option", "aria-selected": i === 0 ? "true" : "false", id: "pal-row-" + i },
        el("svg", { class: "pal-ico", viewBox: "0 0 24 24", "aria-hidden": "true", html: PAL_ICON[icon] || PAL_ICON.lesson }),
        el("div", { class: "pal-main" }, el("div", { class: "pal-label" }, label), el("div", { class: "pal-sub" }, sub))
      );
      row.addEventListener("click", () => runPaletteRow(r));
      row.addEventListener("mousemove", () => { if (paletteIdx !== i) { setPaletteActive(i); } });
      paletteList.appendChild(row);
    });
    paletteInput.setAttribute("aria-activedescendant", rows.length ? "pal-row-0" : "");
  }
  function setPaletteActive(i) {
    const prev = paletteList.children[paletteIdx];
    if (prev) { prev.classList.remove("active"); prev.setAttribute && prev.setAttribute("aria-selected", "false"); }
    paletteIdx = i;
    const row = paletteList.children[i];
    if (row) { row.classList.add("active"); row.setAttribute && row.setAttribute("aria-selected", "true"); paletteInput.setAttribute("aria-activedescendant", row.id || ""); }
  }
  function runPaletteRow(r) { closePalette(); if (r.kind === "cmd") r.item.run(); else location.hash = r.item.route; }
  function movePalette(d) {
    if (!paletteRows.length) return;
    let i = (paletteIdx + d + paletteRows.length) % paletteRows.length;
    setPaletteActive(i);
    const row = paletteList.children[i];
    if (row) row.scrollIntoView({ block: "nearest" });
  }
  function openPalette() { paletteLastFocus = document.activeElement; palette.hidden = false; paletteInput.value = ""; renderPaletteList(); setTimeout(() => paletteInput.focus(), 10); }
  function closePalette() { palette.hidden = true; if (paletteLastFocus && paletteLastFocus.focus) { try { paletteLastFocus.focus(); } catch (e) {} } }
  paletteInput.addEventListener("input", renderPaletteList);
  paletteInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); movePalette(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); movePalette(-1); }
    else if (e.key === "Enter") { e.preventDefault(); if (paletteRows[paletteIdx]) runPaletteRow(paletteRows[paletteIdx]); }
    else if (e.key === "Escape") { e.preventDefault(); closePalette(); }
    else if (e.key === "Tab") { e.preventDefault(); } // focus trap: only the input is focusable
  });
  palette.addEventListener("click", (e) => { if (e.target === palette) closePalette(); });

  /* ---------------- keyboard shortcuts help (?) ---------------- */
  const SHORTCUTS = [
    { keys: ["/"], desc: "Focus the search box" },
    { keys: ["\u2318 K", "Ctrl K"], desc: "Open the command palette", join: "/" },
    { keys: ["\u2190", "\u2192"], desc: "Previous / next lesson" },
    { keys: ["A\u2013E", "1\u20139"], desc: "Answer the current quiz", join: "or" },
    { keys: ["?"], desc: "Show this shortcuts help" },
    { keys: ["Esc"], desc: "Close dialogs & menus" }
  ];
  const helpModal = el("div", { class: "help-modal", hidden: "true", role: "dialog", "aria-modal": "true", "aria-labelledby": "helpTitle" });
  const helpClose = el("button", { class: "help-close", "aria-label": "Close shortcuts help", html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' });
  const helpRows = SHORTCUTS.map((s) => {
    const keyEls = [];
    s.keys.forEach((k, i) => {
      if (i > 0) keyEls.push(el("span", { class: "help-join" }, s.join || "/"));
      keyEls.push(el("kbd", {}, k));
    });
    return el("div", { class: "help-row" },
      el("div", { class: "help-keys" }, ...keyEls),
      el("div", { class: "help-desc" }, s.desc)
    );
  });
  helpModal.appendChild(
    el("div", { class: "help-box" },
      el("div", { class: "help-head" },
        el("h2", { id: "helpTitle" }, "Keyboard shortcuts"),
        helpClose
      ),
      el("div", { class: "help-list" }, ...helpRows)
    )
  );
  document.body.appendChild(helpModal);
  let helpLastFocus = null;
  function openHelp() { if (!palette.hidden) closePalette(); helpLastFocus = document.activeElement; helpModal.hidden = false; setTimeout(() => helpClose.focus(), 10); }
  function closeHelp() { if (helpModal.hidden) return; helpModal.hidden = true; if (helpLastFocus && helpLastFocus.focus) { try { helpLastFocus.focus(); } catch (e) {} } }
  helpClose.addEventListener("click", closeHelp);
  helpModal.addEventListener("click", (e) => { if (e.target === helpModal) closeHelp(); });
  helpModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeHelp(); }
    else if (e.key === "Tab") { e.preventDefault(); } // focus trap: keep focus on the close button
  });

  /* ---------------- backup: export / import progress ---------------- */
  const BACKUP_KEYS = [PKEY, RKEY, WKEY, LKEY, TKEY];
  function exportData() {
    const data = {};
    BACKUP_KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v != null) data[k] = v; });
    const payload = { app: "citadel", version: 1, exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: "citadel-progress-" + new Date().toISOString().slice(0, 10) + ".json" });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Progress exported");
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(reader.result); } catch (e) { toast("Import failed \u2014 invalid file"); return; }
      if (!parsed || parsed.app !== "citadel" || !parsed.data) { toast("Import failed \u2014 not a Citadel backup"); return; }
      if (!confirm("Import this backup? It replaces your current progress, study list and weak spots.")) return;
      BACKUP_KEYS.forEach((k) => { if (parsed.data[k] != null) { try { localStorage.setItem(k, parsed.data[k]); } catch (e) {} } });
      toast("Progress imported \u2014 reloading\u2026");
      setTimeout(() => location.reload(), 650);
    };
    reader.onerror = () => toast("Import failed \u2014 couldn\u2019t read file");
    reader.readAsText(file);
  }
  const exportBtn = $("#exportData"), importBtn = $("#importData"), importFile = $("#importFile");
  if (exportBtn) exportBtn.addEventListener("click", exportData);
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", () => { if (importFile.files && importFile.files[0]) importData(importFile.files[0]); importFile.value = ""; });
  }

  /* ---------------- global keyboard ---------------- */
  document.addEventListener("keydown", (e) => {
    // command palette: Cmd/Ctrl-K
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      palette.hidden ? openPalette() : closePalette();
      return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    // ? toggles the shortcuts help
    if (e.key === "?" && !typing) { e.preventDefault(); helpModal.hidden ? openHelp() : closeHelp(); return; }
    if (e.key === "/" && document.activeElement !== searchInput && !typing) {
      e.preventDefault(); searchInput.focus(); return;
    }
    if (e.key === "Escape") { closeMobileNav(); closePalette(); closeHelp(); return; }
    // when a modal owns the screen, don't run lesson/quiz shortcuts
    if (!palette.hidden || !helpModal.hidden) return;
    // quick-answer a visible quiz with number/letter keys (when not typing)
    if (activeQuiz && activeQuiz.el.isConnected && !typing) {
      let oi = -1;
      if (/^[1-9]$/.test(e.key)) oi = +e.key - 1;
      else if (/^[a-eA-E]$/.test(e.key)) oi = e.key.toLowerCase().charCodeAt(0) - 97;
      if (oi >= 0 && oi < activeQuiz.count) { e.preventDefault(); activeQuiz.pick(oi); return; }
    }
    // left/right arrow lesson nav (when not typing)
    if (!typing) {
      const k = currentKey();
      if (k) {
        const idx = FLAT.findIndex((f) => f.key === k);
        if (e.key === "ArrowRight" && FLAT[idx + 1]) location.hash = FLAT[idx + 1].route;
        if (e.key === "ArrowLeft" && FLAT[idx - 1]) location.hash = FLAT[idx - 1].route;
      }
    }
  });

  /* ---------------- boot ---------------- */
  window.addEventListener("hashchange", route);
  buildNav();
  updateProgressRing();
  route();
})();
