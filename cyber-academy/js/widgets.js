/* =====================================================================
   CITADEL · Interactive widgets (foundations · appsec · defense)
   Each widget is a function (mountEl) registered on window.Widgets[id];
   app.js calls it when it renders a {t:'widget', id} block.
   Everything is built as DOM nodes (never innerHTML of user input), so
   the labs are safe by construction and make zero network requests.
   ===================================================================== */
(function () {
  "use strict";

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) {
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  };
  const shell = (mount, pill, title, desc) => {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  };
  const seg = (options, current, onPick) => {
    const wrap = h("div", { class: "w-seg" });
    const btns = [];
    options.forEach(([label, val]) => {
      const b = h("button", { class: val === current ? "active" : "" }, label);
      b.addEventListener("click", () => { btns.forEach((x) => x.classList.remove("active")); b.classList.add("active"); onPick(val); });
      wrap.appendChild(b); btns.push(b);
    });
    return wrap;
  };

  const Widgets = {};

  /* ---------------------------------------------------------------
     1. CIA TRIAD CLASSIFIER
  --------------------------------------------------------------- */
  Widgets.ciaclassifier = function (mount) {
    shell(mount, "classify", "CIA triad classifier",
      "Which property does each incident threaten first? Pick one \u2014 the reasoning is the point.");

    const SCN = [
      { t: "A volumetric DDoS floods your checkout and shoppers can't pay.", a: "A", why: "Service is up-or-down: legitimate users are denied access. That's an Availability impact." },
      { t: "A leaked database dumps millions of customer email addresses online.", a: "C", why: "Data meant to be private is exposed to unauthorized parties \u2014 a Confidentiality breach." },
      { t: "An on-path attacker changes a wire-transfer amount while it's in flight.", a: "I", why: "The data was altered without authorization \u2014 an Integrity violation (signatures/MACs would detect it)." },
      { t: "Ransomware encrypts your file servers and staff can't open anything.", a: "A", why: "Primarily Availability \u2014 the data exists but is unreachable. (Modern ransomware often also steals data, adding a C impact.)" },
      { t: "A bug lets a user edit another customer's saved order total.", a: "I", why: "Unauthorized modification of data is an Integrity problem (and a sign of broken access control)." },
      { t: "A misconfigured cloud bucket makes internal documents world-readable.", a: "C", why: "Sensitive data is readable by anyone \u2014 a Confidentiality failure from misconfiguration." }
    ];
    const LABEL = { C: "Confidentiality", I: "Integrity", A: "Availability" };
    let i = 0, score = 0, answered = false;

    const stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);
    const readout = h("div", { class: "w-readout" },
      h("span", { class: "ro" }, "scored ", h("b", { id: "ciaScore" }, "0")),
      h("span", { class: "ro" }, "of ", h("b", {}, String(SCN.length)))
    );
    mount.appendChild(readout);

    function render() {
      answered = false;
      stage.innerHTML = "";
      const s = SCN[i];
      stage.appendChild(h("p", { class: "cia-scn" }, "\u201c" + s.t + "\u201d"));
      const opts = h("div", { class: "cia-opts" });
      ["C", "I", "A"].forEach((k) => {
        const b = h("button", { class: "w-btn" }, LABEL[k]);
        b.addEventListener("click", () => choose(k, b, opts));
        opts.appendChild(b);
      });
      stage.appendChild(opts);
      stage.appendChild(h("div", { class: "cia-fb", id: "ciaFb" }));
    }
    function choose(k, btn, opts) {
      if (answered) return;
      answered = true;
      const s = SCN[i];
      const correct = k === s.a;
      if (correct) score++;
      Array.from(opts.children).forEach((b) => {
        b.disabled = true;
        if (b.textContent === LABEL[s.a]) b.classList.add("primary");
        else if (b === btn) b.classList.add("ghost");
      });
      document.getElementById("ciaScore").textContent = String(score);
      const fb = document.getElementById("ciaFb");
      fb.classList.add("show", correct ? "ok" : "bad");
      fb.appendChild(h("strong", {}, correct ? "Correct \u2014 " : "Not quite \u2014 "));
      fb.appendChild(document.createTextNode(s.why));
      const next = h("button", { class: "w-btn primary cia-next" }, i === SCN.length - 1 ? "Start over" : "Next scenario");
      next.addEventListener("click", () => { i = (i + 1) % SCN.length; if (i === 0) score = 0, document.getElementById("ciaScore").textContent = "0"; render(); });
      fb.appendChild(next);
    }
    render();
  };

  /* ---------------------------------------------------------------
     2. RBAC ACCESS-CONTROL MATRIX
  --------------------------------------------------------------- */
  Widgets.rbac = function (mount) {
    shell(mount, "access control", "RBAC matrix",
      "Assign roles to Alice and watch the permissions she inherits. Toggle Admin off to feel least privilege.");

    const PERMS = ["Read", "Comment", "Edit", "Delete", "Manage users"];
    const ROLES = {
      Viewer: ["Read"],
      Editor: ["Read", "Comment", "Edit"],
      Admin: ["Read", "Comment", "Edit", "Delete", "Manage users"]
    };
    const active = { Viewer: false, Editor: true, Admin: false };

    const controls = h("div", { class: "widget-controls" });
    Object.keys(ROLES).forEach((r) => {
      const b = h("button", { class: "w-btn" + (active[r] ? " primary" : " ghost") }, r);
      b.addEventListener("click", () => { active[r] = !active[r]; b.className = "w-btn" + (active[r] ? " primary" : " ghost"); render(); });
      controls.appendChild(b);
    });
    mount.appendChild(h("p", { class: "w-field" }, "Roles granted to Alice:"));
    mount.appendChild(controls);

    const stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);

    function granters(p) { return Object.keys(ROLES).filter((r) => active[r] && ROLES[r].includes(p)); }

    function render() {
      stage.innerHTML = "";
      const grid = h("div", { class: "rbac-grid" });
      PERMS.forEach((p) => {
        const by = granters(p);
        const on = by.length > 0;
        grid.appendChild(h("div", { class: "rbac-cell" + (on ? " on" : "") },
          h("span", { class: "rbac-perm" }, p),
          h("span", { class: "rbac-state" }, on ? "\u2713 allowed" : "\u2014 denied"),
          h("span", { class: "rbac-by" }, on ? "via " + by.join(", ") : "no active role grants this")
        ));
      });
      stage.appendChild(grid);
      const total = PERMS.filter((p) => granters(p).length).length;
      stage.appendChild(h("div", { class: "w-readout" },
        h("span", { class: "ro" }, "effective permissions ", h("b", {}, total + " / " + PERMS.length))
      ));
    }
    render();
  };

  /* ---------------------------------------------------------------
     3. XSS OUTPUT-ENCODING SANDBOX  (safe simulation; never executes)
  --------------------------------------------------------------- */
  Widgets.xss = function (mount) {
    shell(mount, "appsec lab", "Output-encoding sandbox",
      "Type a payload and toggle encoding. This lab is a safe simulation \u2014 it shows what the browser would do, and never executes anything.");

    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const dangerous = (s) => /<[a-z!\/]/i.test(s) || /on\w+\s*=/i.test(s) || /javascript:/i.test(s) || /<script/i.test(s);

    let mode = "raw"; // raw = vulnerable, esc = encoded
    const input = h("textarea", { class: "cy-textarea", rows: "2", spellcheck: "false" });
    input.value = "<img src=x onerror=alert(document.cookie)>";

    const controls = h("div", { class: "widget-controls" });
    controls.appendChild(seg([["Echoed raw (vulnerable)", "raw"], ["Output-encoded (safe)", "esc"]], mode, (v) => { mode = v; render(); }));

    mount.appendChild(h("div", { class: "w-field" }, "Untrusted input (e.g. a comment):"));
    mount.appendChild(input);
    mount.appendChild(controls);

    const stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);

    function render() {
      const val = input.value;
      stage.innerHTML = "";
      const danger = dangerous(val);

      if (mode === "raw") {
        const card = h("div", { class: "xss-card" });
        card.appendChild(h("div", { class: "xss-label" }, "Inserted into the page WITHOUT encoding"));
        card.appendChild(h("div", { class: "xss-verdict " + (danger ? "danger" : "ok") },
          danger
            ? "\u26a0 The browser would parse this as HTML \u2014 the markup/script runs in the victim's session. This is XSS."
            : "No active markup here, but echoing raw input is still the bug waiting to happen. Encode anyway."));
        card.appendChild(h("div", { class: "xss-sub" }, "The server sent these exact bytes as part of the HTML document:"));
        card.appendChild(h("pre", { class: "xss-code" }, val || "\u00a0"));
        stage.appendChild(card);
      } else {
        const card = h("div", { class: "xss-card" });
        card.appendChild(h("div", { class: "xss-label" }, "Passed through contextual output encoding"));
        card.appendChild(h("div", { class: "xss-verdict ok" }, "\u2713 Special characters are escaped, so the browser renders this as inert text \u2014 no execution."));
        card.appendChild(h("div", { class: "xss-sub" }, "What the server emits into the HTML (encoded):"));
        card.appendChild(h("pre", { class: "xss-code" }, esc(val) || "\u00a0"));
        card.appendChild(h("div", { class: "xss-sub" }, "What the user actually sees on the page:"));
        // textContent = the literal characters; always safe, never parsed as markup
        const rendered = h("div", { class: "xss-rendered" });
        rendered.textContent = val;
        card.appendChild(rendered);
        stage.appendChild(card);
      }
    }
    input.addEventListener("input", render);
    render();
  };

  /* ---------------------------------------------------------------
     4. FIREWALL RULE EVALUATOR
  --------------------------------------------------------------- */
  Widgets.firewall = function (mount) {
    shell(mount, "network lab", "Firewall rule evaluator",
      "Rules are checked top-to-bottom; first match wins, default-deny at the end. Send a packet and watch which rule decides.");

    const RULES = [
      { label: "ALLOW  internet \u2192 web tier :443", action: "allow", m: (p) => p.dst === "web" && p.port === 443 },
      { label: "ALLOW  app tier \u2192 database :5432", action: "allow", m: (p) => p.src === "app" && p.dst === "db" && p.port === 5432 },
      { label: "DENY   any \u2192 database :5432", action: "deny", m: (p) => p.dst === "db" && p.port === 5432 },
      { label: "DENY   internet \u2192 internal", action: "deny", m: (p) => p.src === "internet" && p.dst === "internal" },
      { label: "DENY   (default)", action: "deny", m: () => true }
    ];
    const PACKETS = [
      { label: "Shopper from the internet \u2192 web :443", src: "internet", dst: "web", port: 443 },
      { label: "App server \u2192 database :5432", src: "app", dst: "db", port: 5432 },
      { label: "Internet host \u2192 database :5432", src: "internet", dst: "db", port: 5432 },
      { label: "Employee laptop \u2192 database :5432", src: "laptop", dst: "db", port: 5432 },
      { label: "Internet host \u2192 internal SSH :22", src: "internet", dst: "internal", port: 22 }
    ];

    const controls = h("div", { class: "widget-controls" });
    PACKETS.forEach((p, idx) => {
      const b = h("button", { class: "w-btn ghost" }, "Packet " + (idx + 1));
      b.title = p.label;
      b.addEventListener("click", () => evaluate(idx));
      controls.appendChild(b);
    });
    mount.appendChild(controls);

    const stage = h("div", { class: "w-stage" });
    const list = h("div", { class: "fw-rules" });
    RULES.forEach((r) => list.appendChild(h("div", { class: "fw-rule" }, r.label)));
    const verdict = h("div", { class: "fw-verdict" }, "Pick a packet above to evaluate it against the rule set.");
    stage.appendChild(verdict);
    stage.appendChild(list);
    mount.appendChild(stage);

    function evaluate(idx) {
      const p = PACKETS[idx];
      let hit = -1;
      for (let i = 0; i < RULES.length; i++) { if (RULES[i].m(p)) { hit = i; break; } }
      const r = RULES[hit];
      Array.from(list.children).forEach((row, i) => {
        row.className = "fw-rule" + (i === hit ? " match " + r.action : (i < hit ? " skipped" : ""));
      });
      verdict.className = "fw-verdict " + r.action;
      verdict.textContent = "";
      verdict.appendChild(h("strong", {}, p.label));
      verdict.appendChild(document.createTextNode("  \u2192  " + (r.action === "allow" ? "ALLOWED" : "DENIED") + " by rule " + (hit + 1) + ((hit === RULES.length - 1) ? " (default-deny)" : "")));
    }
    evaluate(0);
  };

  /* ---------------------------------------------------------------
     5. PHISHING URL INSPECTOR
  --------------------------------------------------------------- */
  Widgets.phish = function (mount) {
    shell(mount, "defense lab", "Phishing URL inspector",
      "Read URLs the way a defender does \u2014 right to left. Paste a link to surface the real domain and common deception tricks.");

    const BRANDS = ["paypal", "google", "apple", "microsoft", "amazon", "facebook", "netflix", "instagram", "bank", "outlook", "office365"];
    const input = h("input", { type: "text", class: "cy-input", spellcheck: "false", value: "https://paypal.com.account-verify.example/login?secure=1" });
    const btn = h("button", { class: "w-btn primary" }, "Inspect");
    const controls = h("div", { class: "widget-controls" }, h("div", { class: "w-field", style: "flex:1;min-width:240px" }, input), btn);
    mount.appendChild(controls);
    const stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);

    function flag(kind, text) { return h("div", { class: "phish-flag " + kind }, h("span", { class: "pf-ico" }, kind === "bad" ? "\u26a0" : kind === "warn" ? "!" : "\u2713"), h("span", {}, text)); }

    function inspect() {
      stage.innerHTML = "";
      let raw = input.value.trim();
      if (!raw) { stage.appendChild(h("p", { class: "phish-empty" }, "Enter a URL to inspect.")); return; }
      let url;
      try {
        const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : "//" + raw;
        url = new URL(candidate, "https://citadel-input.example");
      }
      catch (e) { stage.appendChild(h("p", { class: "phish-empty" }, "That doesn't parse as a URL.")); return; }

      const host = url.hostname.toLowerCase();
      const labels = host.split(".");
      const registrable = labels.slice(-2).join(".");
      const mainLabel = labels.length >= 2 ? labels[labels.length - 2] : host;
      const flags = [];

      // real domain highlight
      const hostEl = h("div", { class: "phish-host" });
      labels.forEach((lab, idx) => {
        const isReg = idx >= labels.length - 2;
        if (idx) hostEl.appendChild(h("span", { class: "dom-dot" }, "."));
        hostEl.appendChild(h("span", { class: isReg ? "dom-main" : "dom-sub" }, lab));
      });
      stage.appendChild(h("div", { class: "phish-realwrap" }, h("span", { class: "phish-cap" }, "Real destination domain:"), hostEl));

      if (url.username || url.password) {
        flags.push(flag("bad", "The \u201c@\u201d trick: anything before @ is a decoy \u2014 the browser connects to the host AFTER the @ (" + host + ")."));
      }
      if (url.protocol !== "https:") flags.push(flag("warn", "Not HTTPS \u2014 traffic isn't encrypted and the site isn't authenticated."));
      if (/^xn--/.test(mainLabel) || labels.some((l) => l.startsWith("xn--"))) flags.push(flag("bad", "Punycode (xn--) host \u2014 may be a homograph that looks like a real brand but isn't."));
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) flags.push(flag("warn", "The host is a raw IP address \u2014 legitimate brands rarely link to bare IPs."));
      const brandHit = BRANDS.find((b) => host.includes(b) && mainLabel !== b && registrable.indexOf(b) === -1);
      if (brandHit) flags.push(flag("bad", "\u201c" + brandHit + "\u201d appears in a subdomain, but the real domain is " + registrable + " \u2014 a classic lookalike."));
      if (labels.length >= 4) flags.push(flag("warn", labels.length + " labels deep \u2014 deep subdomains are used to bury the real domain."));
      if (!flags.length) flags.push(flag("ok", "No obvious red flags \u2014 but always confirm " + registrable + " is who you expect."));

      const flagWrap = h("div", { class: "phish-flags" });
      flags.forEach((f) => flagWrap.appendChild(f));
      stage.appendChild(flagWrap);
    }
    btn.addEventListener("click", inspect);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") inspect(); });
    inspect();
  };

  /* ---------------------------------------------------------------
     6. PASSWORD ENTROPY METER
  --------------------------------------------------------------- */
  Widgets.entropy = function (mount) {
    shell(mount, "crypto lab", "Password entropy meter",
      "Strength is unpredictability (entropy bits), not punctuation. Try a few samples \u2014 please don't type a real password.");

    const input = h("input", { type: "text", class: "cy-input", spellcheck: "false", autocomplete: "off", placeholder: "type a sample passphrase\u2026" });
    mount.appendChild(h("div", { class: "w-field", style: "min-width:260px" }, input));

    const bar = h("i");
    const meter = h("div", { class: "ent-meter" }, bar);
    mount.appendChild(meter);
    const stats = h("div", { class: "w-readout ent-stats" },
      h("span", { class: "ro" }, "entropy ", h("b", { id: "entBits" }, "0"), " bits"),
      h("span", { class: "ro" }, "charset ", h("b", { id: "entSet" }, "0")),
      h("span", { class: "ro" }, "rating ", h("b", { id: "entRate" }, "\u2014"))
    );
    mount.appendChild(stats);
    const crack = h("p", { class: "ent-crack", id: "entCrack" }, "");
    mount.appendChild(crack);

    function humanizeSeconds(s) {
      if (s < 1) return "less than a second";
      const units = [["year", 31557600], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
      for (const [name, secs] of units) {
        if (s >= secs) { const n = s / secs; return (n >= 1e9 ? n.toExponential(1) : Math.round(n).toLocaleString()) + " " + name + (Math.round(n) === 1 ? "" : "s"); }
      }
      return "less than a second";
    }
    function rate(bits) {
      if (bits < 28) return ["very weak", "var(--rose)", 12];
      if (bits < 36) return ["weak", "var(--amber)", 30];
      if (bits < 60) return ["reasonable", "var(--cyan)", 55];
      if (bits < 128) return ["strong", "var(--lime)", 80];
      return ["excellent", "var(--lime)", 100];
    }
    function calc() {
      const v = input.value;
      let set = 0;
      if (/[a-z]/.test(v)) set += 26;
      if (/[A-Z]/.test(v)) set += 26;
      if (/[0-9]/.test(v)) set += 10;
      if (/[^a-zA-Z0-9]/.test(v)) set += 33;
      const bits = v.length ? +(v.length * Math.log2(set || 1)).toFixed(1) : 0;
      const [label, color, pct] = rate(bits);
      bar.style.width = (v.length ? Math.max(4, pct) : 0) + "%";
      bar.style.background = color;
      document.getElementById("entBits").textContent = String(bits);
      document.getElementById("entSet").textContent = String(set);
      document.getElementById("entRate").textContent = v.length ? label : "\u2014";
      const guesses = Math.pow(2, bits) / 2;
      const offline = humanizeSeconds(guesses / 1e10);  // 10B guesses/sec, fast offline cracking
      crack.textContent = v.length
        ? "At 10 billion guesses/sec (offline, fast hash): ~" + offline + " to crack. A slow salted hash like Argon2id multiplies that enormously."
        : "Tip: a long passphrase of random words usually beats a short, gnarly string like P@ss1!.";
    }
    input.addEventListener("input", calc);
    calc();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);
})();
