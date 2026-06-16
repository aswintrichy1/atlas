/* =====================================================================
   CITADEL · Interactive widgets — expansion pack
   pentest · osint · cvss · attack · pyramid · analysis · volatility ·
   subnet · permissions · wifi
   Merged into window.Widgets (loaded before app.js). Pure client-side,
   built as DOM nodes (no innerHTML of user input), zero network requests.
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
     1. PENTEST LIFECYCLE STEPPER
  --------------------------------------------------------------- */
  Widgets.pentest = function (mount) {
    shell(mount, "offense lab", "Penetration-test lifecycle",
      "Walk a real engagement from a signed contract to a retest. Notice it starts and ends with the client \u2014 never with an exploit.");
    const STEPS = [
      { n: "Pre-engagement & scoping", text: "Agree the scope, rules of engagement, and timing \u2014 and get written authorization. Nothing begins without it.", tag: "authorize" },
      { n: "Reconnaissance", text: "Gather public information about the target's footprint (OSINT). Mostly passive and invisible to the target.", tag: "recon" },
      { n: "Scanning & enumeration", text: "Discover live hosts, open ports, and the exact services and versions running on them.", tag: "map" },
      { n: "Exploitation", text: "Safely demonstrate that a vulnerability is real \u2014 strictly within scope and the agreed rules of engagement.", tag: "prove" },
      { n: "Post-exploitation", text: "Assess true impact: what could an attacker reach from here? Privilege escalation and lateral movement (conceptually).", tag: "impact" },
      { n: "Reporting", text: "Document every finding so it is reproducible, risk-rated, and paired with a concrete fix. The report is the product.", tag: "deliver" },
      { n: "Remediation & retest", text: "The client fixes the issues; the tester re-checks to confirm each one is actually closed. Only then is it resolved.", tag: "verify" }
    ];
    let i = 0;
    const num = h("span", { class: "pt-num" });
    const name = h("h4", { class: "pt-name" });
    const tag = h("span", { class: "pt-tag" });
    const text = h("p", { class: "pt-text" });
    const track = h("div", { class: "pt-track" });
    const dots = STEPS.map((s, idx) => {
      const d = h("button", { class: "pt-dot", title: s.n });
      d.addEventListener("click", () => { i = idx; render(); });
      return d;
    });
    dots.forEach((d) => track.appendChild(d));
    const prev = h("button", { class: "w-btn ghost" }, "\u2190 Prev");
    const next = h("button", { class: "w-btn primary" }, "Next \u2192");
    prev.addEventListener("click", () => { i = (i - 1 + STEPS.length) % STEPS.length; render(); });
    next.addEventListener("click", () => { i = (i + 1) % STEPS.length; render(); });
    mount.appendChild(h("div", { class: "w-stage" },
      h("div", { class: "pt-head" }, num, tag),
      name, text, track
    ));
    mount.appendChild(h("div", { class: "widget-controls", style: "justify-content:space-between;margin-top:14px" }, prev, h("span", { class: "pt-count" }), next));
    const count = mount.querySelector(".pt-count");
    function render() {
      const s = STEPS[i];
      num.textContent = "Phase " + (i + 1);
      tag.textContent = s.tag;
      name.textContent = s.n;
      text.textContent = s.text;
      count.textContent = (i + 1) + " / " + STEPS.length;
      dots.forEach((d, idx) => d.classList.toggle("on", idx === i));
    }
    render();
  };

  /* ---------------------------------------------------------------
     2. OSINT FOOTPRINT REVEAL  (illustrative, fictional data)
  --------------------------------------------------------------- */
  Widgets.osint = function (mount) {
    shell(mount, "offense lab", "OSINT footprint reveal",
      "Investigate a fictional company from public sources alone. Everything here is invented \u2014 the point is to see your own attack surface as an attacker would.");
    const SOURCES = [
      { s: "DNS & certificate logs", find: "vpn.acme.example, dev-staging.acme.example, mail.acme.example surface in public certificate-transparency logs.", def: "Monitor CT logs for surprise subdomains; keep internal hostnames out of public DNS." },
      { s: "Job postings", find: "\u201cSeeking an engineer with Django, PostgreSQL and Okta SSO experience\u201d \u2014 the exact stack, handed over.", def: "Keep postings generic; avoid naming specific internal products and versions." },
      { s: "Public code repos", find: "A committed config file references an internal API host and an old access token.", def: "Scan repos for secrets; rotate anything ever committed; block pushes with secrets." },
      { s: "Social media", find: "The org chart, the new CFO's start date, and who runs IT \u2014 perfect phishing pretexts.", def: "Security-awareness training; assume anything employees post is recon fuel." },
      { s: "Breach databases", find: "Three employee emails appear in old breach corpora with reused passwords.", def: "Screen against breached-password lists; enforce MFA; monitor for exposed creds." },
      { s: "Document metadata", find: "A public PDF's metadata leaks usernames, software versions, and an internal file path.", def: "Strip metadata from anything published externally." }
    ];
    let revealed = 0;
    const meter = h("b", {}, "0 / " + SOURCES.length);
    const grid = h("div", { class: "osint-grid" });
    SOURCES.forEach((src) => {
      const body = h("div", { class: "osint-body" });
      const btn = h("button", { class: "w-btn ghost osint-btn" }, "Investigate");
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        btn.disabled = true; btn.classList.add("done"); btn.textContent = "Exposed";
        body.appendChild(h("p", { class: "osint-find" }, src.find));
        body.appendChild(h("p", { class: "osint-def" }, h("strong", {}, "Defense: "), document.createTextNode(src.def)));
        revealed++; meter.textContent = revealed + " / " + SOURCES.length;
        card.classList.add("on");
      });
      const card = h("div", { class: "osint-card" },
        h("div", { class: "osint-top" }, h("span", { class: "osint-src" }, src.s), btn),
        body
      );
      grid.appendChild(card);
    });
    mount.appendChild(grid);
    mount.appendChild(h("div", { class: "w-readout" }, h("span", { class: "ro" }, "attack surface exposed ", meter)));
  };

  /* ---------------------------------------------------------------
     3. CVSS v3.1 BASE-SCORE CALCULATOR
  --------------------------------------------------------------- */
  Widgets.cvss = function (mount) {
    shell(mount, "offense lab", "CVSS v3.1 base score",
      "Describe a vulnerability's character and watch its severity emerge. Defaults model a Log4Shell-class flaw (base 10.0).");
    const M = { AV: "N", AC: "L", PR: "N", UI: "N", S: "C", C: "H", I: "H", A: "H" };
    const METRICS = [
      ["AV", "Attack Vector", [["Network", "N"], ["Adjacent", "A"], ["Local", "L"], ["Physical", "P"]]],
      ["AC", "Attack Complexity", [["Low", "L"], ["High", "H"]]],
      ["PR", "Privileges Required", [["None", "N"], ["Low", "L"], ["High", "H"]]],
      ["UI", "User Interaction", [["None", "N"], ["Required", "R"]]],
      ["S", "Scope", [["Unchanged", "U"], ["Changed", "C"]]],
      ["C", "Confidentiality", [["None", "N"], ["Low", "L"], ["High", "H"]]],
      ["I", "Integrity", [["None", "N"], ["Low", "L"], ["High", "H"]]],
      ["A", "Availability", [["None", "N"], ["Low", "L"], ["High", "H"]]]
    ];
    const controls = h("div", { class: "cvss-metrics" });
    METRICS.forEach(([key, label, opts]) => {
      controls.appendChild(h("div", { class: "cvss-row" },
        h("span", { class: "cvss-label" }, label),
        seg(opts, M[key], (v) => { M[key] = v; render(); })
      ));
    });
    mount.appendChild(controls);
    const scoreEl = h("div", { class: "cvss-score" });
    const vectorEl = h("div", { class: "cvss-vector" });
    mount.appendChild(h("div", { class: "w-stage" }, scoreEl, vectorEl));

    const roundup = (x) => { const i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; };
    function score() {
      const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[M.AV];
      const AC = { L: 0.77, H: 0.44 }[M.AC];
      const UI = { N: 0.85, R: 0.62 }[M.UI];
      const cia = (x) => ({ N: 0, L: 0.22, H: 0.56 }[x]);
      const changed = M.S === "C";
      const PR = (changed ? { N: 0.85, L: 0.68, H: 0.5 } : { N: 0.85, L: 0.62, H: 0.27 })[M.PR];
      const iss = 1 - (1 - cia(M.C)) * (1 - cia(M.I)) * (1 - cia(M.A));
      const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
      const expl = 8.22 * AV * AC * PR * UI;
      if (impact <= 0) return 0;
      return changed ? roundup(Math.min(1.08 * (impact + expl), 10)) : roundup(Math.min(impact + expl, 10));
    }
    function rate(s) {
      if (s === 0) return ["None", "var(--text-faint)"];
      if (s < 4) return ["Low", "var(--lime)"];
      if (s < 7) return ["Medium", "var(--amber)"];
      if (s < 9) return ["High", "var(--rose)"];
      return ["Critical", "var(--rose)"];
    }
    function render() {
      const s = score();
      const [label, color] = rate(s);
      scoreEl.innerHTML = "";
      scoreEl.appendChild(h("span", { class: "cvss-num", style: "color:" + color }, s.toFixed(1)));
      scoreEl.appendChild(h("span", { class: "cvss-rate", style: "background:" + color }, label));
      vectorEl.textContent = "CVSS:3.1/AV:" + M.AV + "/AC:" + M.AC + "/PR:" + M.PR + "/UI:" + M.UI + "/S:" + M.S + "/C:" + M.C + "/I:" + M.I + "/A:" + M.A;
    }
    render();
  };

  /* ---------------------------------------------------------------
     4. MITRE ATT&CK TACTICS EXPLORER
  --------------------------------------------------------------- */
  Widgets.attack = function (mount) {
    shell(mount, "threats lab", "ATT&CK tactics explorer",
      "The 14 enterprise tactics are the stages of an intrusion. Pick one to see example techniques and the defense that catches them.");
    const T = [
      ["Reconnaissance", "Researching the target before any attack.", ["Active scanning", "Phishing for information", "Search public sources"], "Reduce public footprint; monitor for scanning."],
      ["Resource Development", "Building or buying the infrastructure for an attack.", ["Acquire infrastructure", "Develop capabilities", "Compromise accounts"], "Brand & domain monitoring; threat intel."],
      ["Initial Access", "Getting the first foothold inside.", ["Phishing", "Exploit public-facing app", "Valid accounts"], "Email filtering, patching, MFA."],
      ["Execution", "Running malicious code on a system.", ["Command & scripting interpreter", "Scheduled task", "User execution"], "Application control; script logging; EDR."],
      ["Persistence", "Keeping access across reboots and resets.", ["Create account", "Boot/logon autostart", "Scheduled task"], "Integrity monitoring; baseline autostarts."],
      ["Privilege Escalation", "Gaining higher permissions.", ["Exploit for privilege escalation", "Abuse elevation control", "Valid accounts"], "Patch; least privilege; minimize SUID/admin."],
      ["Defense Evasion", "Avoiding detection.", ["Obfuscation", "Impair defenses", "Masquerading"], "Tamper-evident logging; behavioral detection."],
      ["Credential Access", "Stealing usernames and passwords.", ["Brute force", "Credentials from stores", "Input capture"], "MFA; no plaintext secrets; lockouts."],
      ["Discovery", "Mapping the environment from inside.", ["Account discovery", "Network service scanning", "System info discovery"], "Detect internal scanning; segment."],
      ["Lateral Movement", "Moving from host to host.", ["Remote services", "Pass the hash", "Internal spearphishing"], "Segmentation; unique local creds."],
      ["Collection", "Gathering the target data.", ["Data from local system", "Screen capture", "Email collection"], "DLP; access control; auditing."],
      ["Command & Control", "Communicating with the foothold.", ["Application-layer protocol", "Web service", "Encrypted channel"], "Egress filtering; DNS & proxy monitoring."],
      ["Exfiltration", "Stealing data out of the network.", ["Exfil over C2 channel", "Exfil to cloud storage", "Scheduled transfer"], "Egress controls; data-loss prevention."],
      ["Impact", "Disrupting, destroying, or extorting.", ["Data encrypted for impact", "Data destruction", "Service stop"], "Offline backups; recovery plans; alerting."]
    ];
    let sel = 2;
    const grid = h("div", { class: "atk-grid" });
    const btns = T.map((t, idx) => {
      const b = h("button", { class: "atk-chip" }, t[0]);
      b.addEventListener("click", () => { sel = idx; render(); });
      grid.appendChild(b); return b;
    });
    const detail = h("div", { class: "w-stage atk-detail" });
    mount.appendChild(grid);
    mount.appendChild(detail);
    function render() {
      const t = T[sel];
      btns.forEach((b, idx) => b.classList.toggle("on", idx === sel));
      detail.innerHTML = "";
      detail.appendChild(h("div", { class: "atk-stage" }, "Tactic " + (sel + 1) + " of 14"));
      detail.appendChild(h("h4", { class: "atk-name" }, t[0]));
      detail.appendChild(h("p", { class: "atk-desc" }, t[1]));
      const ex = h("div", { class: "atk-tech" });
      ex.appendChild(h("span", { class: "atk-tech-label" }, "Example techniques"));
      t[2].forEach((x) => ex.appendChild(h("span", { class: "atk-pill" }, x)));
      detail.appendChild(ex);
      detail.appendChild(h("p", { class: "atk-def" }, h("strong", {}, "Defense: "), document.createTextNode(t[3])));
    }
    render();
  };

  /* ---------------------------------------------------------------
     5. PYRAMID OF PAIN
  --------------------------------------------------------------- */
  Widgets.pyramid = function (mount) {
    shell(mount, "threats lab", "The Pyramid of Pain",
      "Indicators ranked by how much it hurts an attacker when you deny them. Climb it \u2014 detect behavior at the top, not just hashes at the bottom.");
    const LEVELS = [
      ["TTPs", "Tools, techniques & procedures \u2014 the attacker's behavior.", "Tough! Changing how they operate means re-learning their whole craft.", "highest", 5],
      ["Tools", "The specific tools/malware they use.", "Challenging \u2014 they must find or build a new tool.", "high", 4],
      ["Network/Host Artifacts", "Traces like C2 URI patterns, registry keys, file names.", "Annoying \u2014 they must change their tooling's behavior.", "med", 3],
      ["Domain Names", "Domains used for C2 or phishing.", "Simple \u2014 but registration takes a little effort.", "low", 2],
      ["IP Addresses", "IPs the attacker connects from/to.", "Easy \u2014 IPs rotate in minutes.", "lower", 1],
      ["Hash Values", "Exact hashes of malicious files.", "Trivial \u2014 a single byte change makes a brand-new hash.", "lowest", 0]
    ];
    let sel = 0;
    const pyr = h("div", { class: "pyr" });
    const rows = LEVELS.map((lv, idx) => {
      const w = 40 + (idx) * 11; // widest at bottom
      const r = h("button", { class: "pyr-row pain-" + lv[3], style: "width:" + w + "%" }, lv[0]);
      r.addEventListener("click", () => { sel = idx; render(); });
      return r;
    });
    rows.forEach((r) => pyr.appendChild(r));
    const detail = h("div", { class: "pyr-detail" });
    mount.appendChild(h("div", { class: "w-stage" }, h("div", { class: "pyr-cap" }, "more pain to attacker \u2191"), pyr, detail));
    function render() {
      const lv = LEVELS[sel];
      rows.forEach((r, idx) => r.classList.toggle("on", idx === sel));
      detail.innerHTML = "";
      detail.appendChild(h("h4", { class: "pyr-name" }, lv[0]));
      detail.appendChild(h("p", {}, lv[1]));
      detail.appendChild(h("p", { class: "pyr-pain" }, h("strong", {}, "Attacker effort to change: "), document.createTextNode(lv[2])));
    }
    render();
  };

  /* ---------------------------------------------------------------
     6. STATIC vs DYNAMIC ANALYSIS SORTER
  --------------------------------------------------------------- */
  Widgets.analysis = function (mount) {
    shell(mount, "threats lab", "Static vs dynamic sorter",
      "Examining the file at rest, or running it to watch behavior? Classify each technique \u2014 the reasoning is the point.");
    const ITEMS = [
      ["Reading printable strings from the binary", "static", "No execution \u2014 you're inspecting the file's contents at rest."],
      ["Detonating the sample in a sandbox and watching network calls", "dynamic", "It only makes those calls when running \u2014 that's behavioral, dynamic analysis."],
      ["Computing the file's SHA-256 hash", "static", "Hashing the file at rest, no execution \u2014 static."],
      ["Monitoring registry and file changes while it runs", "dynamic", "Observing runtime effects requires executing it \u2014 dynamic."],
      ["Inspecting the PE header and imported functions", "static", "Reading structure without running it \u2014 static."],
      ["Capturing the C2 traffic it generates live", "dynamic", "Live traffic only exists at runtime \u2014 dynamic."]
    ];
    let i = 0, score = 0, answered = false;
    const meter = h("b", {}, "0");
    const stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);
    mount.appendChild(h("div", { class: "w-readout" }, h("span", { class: "ro" }, "scored ", meter, " / " + ITEMS.length)));
    function render() {
      answered = false;
      stage.innerHTML = "";
      const it = ITEMS[i];
      stage.appendChild(h("p", { class: "anl-q" }, it[0]));
      const opts = h("div", { class: "anl-opts" });
      [["Static", "static"], ["Dynamic", "dynamic"]].forEach(([label, val]) => {
        const b = h("button", { class: "w-btn" }, label);
        b.addEventListener("click", () => choose(val, b, opts));
        opts.appendChild(b);
      });
      stage.appendChild(opts);
      stage.appendChild(h("div", { class: "anl-fb", id: "anlFb" }));
    }
    function choose(val, btn, opts) {
      if (answered) return; answered = true;
      const it = ITEMS[i];
      const ok = val === it[1];
      if (ok) { score++; meter.textContent = String(score); }
      Array.from(opts.children).forEach((b) => {
        b.disabled = true;
        if (b.textContent.toLowerCase() === it[1]) b.classList.add("primary");
        else if (b === btn) b.classList.add("ghost");
      });
      const fb = stage.querySelector("#anlFb");
      fb.classList.add("show", ok ? "ok" : "bad");
      fb.appendChild(h("strong", {}, ok ? "Correct \u2014 " : "Not quite \u2014 "));
      fb.appendChild(document.createTextNode(it[2]));
      const next = h("button", { class: "w-btn primary anl-next" }, i === ITEMS.length - 1 ? "Start over" : "Next");
      next.addEventListener("click", () => { i = (i + 1) % ITEMS.length; if (i === 0) { score = 0; meter.textContent = "0"; } render(); });
      fb.appendChild(next);
    }
    render();
  };

  /* ---------------------------------------------------------------
     7. ORDER OF VOLATILITY  (click in order, most -> least)
  --------------------------------------------------------------- */
  Widgets.volatility = function (mount) {
    shell(mount, "forensics lab", "Order of volatility",
      "Capture evidence most-volatile first, or you lose it. Click the sources in the correct order, from most to least volatile.");
    const CORRECT = [
      "CPU registers & cache",
      "Memory (RAM)",
      "Network connections & state",
      "Running processes",
      "Disk (files, filesystem)",
      "Logs & archived data",
      "Physical config & backups"
    ];
    let chosen = [];
    const pool = h("div", { class: "vol-pool" });
    const slots = h("div", { class: "vol-chosen" });
    const result = h("div", { class: "vol-result" });
    const shuffled = CORRECT.slice();
    for (let k = shuffled.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); const t = shuffled[k]; shuffled[k] = shuffled[j]; shuffled[j] = t; }

    function render() {
      pool.innerHTML = ""; slots.innerHTML = ""; result.innerHTML = "";
      shuffled.forEach((item) => {
        if (chosen.includes(item)) return;
        const b = h("button", { class: "w-btn ghost vol-item" }, item);
        b.addEventListener("click", () => { chosen.push(item); render(); });
        pool.appendChild(b);
      });
      chosen.forEach((item, idx) => {
        const ok = CORRECT[idx] === item;
        slots.appendChild(h("div", { class: "vol-slot " + (chosen.length === CORRECT.length ? (ok ? "ok" : "bad") : "") },
          h("span", { class: "vol-rank" }, String(idx + 1)), h("span", {}, item)));
      });
      if (chosen.length === CORRECT.length) {
        const right = chosen.every((it, idx) => CORRECT[idx] === it);
        result.appendChild(h("div", { class: "vol-verdict " + (right ? "ok" : "bad") },
          right ? "\u2713 Perfect \u2014 that's the order of volatility (RFC 3227)." : "Close \u2014 the green rows are right. RAM and live state must come before disk and backups."));
        const reset = h("button", { class: "w-btn primary" }, "Try again");
        reset.addEventListener("click", () => { chosen = []; render(); });
        result.appendChild(reset);
      } else if (chosen.length) {
        const undo = h("button", { class: "w-btn ghost" }, "Undo last");
        undo.addEventListener("click", () => { chosen.pop(); render(); });
        result.appendChild(undo);
      }
    }
    mount.appendChild(h("div", { class: "w-stage" },
      h("div", { class: "vol-cap" }, "Pick most-volatile first \u2193"),
      pool, h("div", { class: "vol-divider" }), slots, result));
    render();
  };

  /* ---------------------------------------------------------------
     8. CIDR / SUBNET CALCULATOR
  --------------------------------------------------------------- */
  Widgets.subnet = function (mount) {
    shell(mount, "domains lab", "CIDR subnet calculator",
      "Enter a network in CIDR notation to see its range \u2014 the same math a firewall rule or a network segment uses.");
    const input = h("input", { type: "text", class: "cy-input", spellcheck: "false", value: "192.168.1.0/24" });
    const btn = h("button", { class: "w-btn primary" }, "Compute");
    mount.appendChild(h("div", { class: "widget-controls" }, h("div", { class: "w-field", style: "flex:1;min-width:220px" }, input), btn));
    const stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);
    const toDotted = (x) => ((x >>> 24) & 255) + "." + ((x >>> 16) & 255) + "." + ((x >>> 8) & 255) + "." + (x & 255);
    function row(k, v) { return h("div", { class: "sub-row" }, h("span", { class: "sub-k" }, k), h("span", { class: "sub-v" }, v)); }
    function compute() {
      stage.innerHTML = "";
      const m = input.value.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
      if (!m) { stage.appendChild(h("p", { class: "sub-err" }, "Enter an IPv4 network like 10.0.0.0/16.")); return; }
      const o = [m[1], m[2], m[3], m[4]].map(Number), p = +m[5];
      if (o.some((x) => x > 255) || p > 32) { stage.appendChild(h("p", { class: "sub-err" }, "Octets must be 0\u2013255 and the prefix 0\u201332.")); return; }
      const ip = ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
      const mask = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0;
      const net = (ip & mask) >>> 0;
      const bc = (net | (~mask >>> 0)) >>> 0;
      const total = Math.pow(2, 32 - p);
      const usable = total <= 2 ? total : total - 2;
      stage.appendChild(row("Network address", toDotted(net)));
      stage.appendChild(row("Broadcast address", toDotted(bc)));
      stage.appendChild(row("Subnet mask", toDotted(mask)));
      stage.appendChild(row("Usable host range", total <= 2 ? toDotted(net) + " \u2013 " + toDotted(bc) : toDotted((net + 1) >>> 0) + " \u2013 " + toDotted((bc - 1) >>> 0)));
      stage.appendChild(row("Total addresses", total.toLocaleString()));
      stage.appendChild(row("Usable hosts", usable.toLocaleString() + (total <= 2 ? " (point-to-point / single host)" : "")));
    }
    btn.addEventListener("click", compute);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") compute(); });
    compute();
  };

  /* ---------------------------------------------------------------
     9. LINUX PERMISSIONS (chmod) CALCULATOR
  --------------------------------------------------------------- */
  Widgets.permissions = function (mount) {
    shell(mount, "domains lab", "Linux permission calculator",
      "Toggle read / write / execute for owner, group, and other. See the symbolic and octal forms \u2014 and when you've made it dangerous.");
    const CLASSES = ["Owner", "Group", "Other"];
    const BITS = [["r", 4], ["w", 2], ["x", 1]];
    const state = [[true, true, true], [true, false, true], [true, false, true]]; // 755
    const grid = h("div", { class: "perm-grid" });
    const out = h("div", { class: "w-stage perm-out" });

    function render() {
      grid.innerHTML = "";
      grid.appendChild(h("div", { class: "perm-corner" }, ""));
      BITS.forEach(([b]) => grid.appendChild(h("div", { class: "perm-bhead" }, b.toUpperCase())));
      CLASSES.forEach((cls, ci) => {
        grid.appendChild(h("div", { class: "perm-cls" }, cls));
        BITS.forEach(([b], bi) => {
          const on = state[ci][bi];
          const cell = h("button", { class: "perm-cell" + (on ? " on" : "") }, on ? b : "\u2013");
          cell.addEventListener("click", () => { state[ci][bi] = !state[ci][bi]; render(); });
          grid.appendChild(cell);
        });
      });
      const octal = state.map((c) => c[0] * 4 + c[1] * 2 + c[2] * 1).join("");
      const sym = state.map((c) => (c[0] ? "r" : "-") + (c[1] ? "w" : "-") + (c[2] ? "x" : "-")).join("");
      out.innerHTML = "";
      out.appendChild(h("div", { class: "perm-codes" },
        h("code", { class: "perm-octal" }, "chmod " + octal),
        h("code", { class: "perm-sym" }, sym)
      ));
      const otherWrite = state[2][1];
      const allOpen = octal === "777";
      if (allOpen) out.appendChild(h("div", { class: "perm-warn danger" }, "\u26a0 777 \u2014 everyone can read, write and execute. Almost never correct; a classic privilege-escalation foothold."));
      else if (otherWrite) out.appendChild(h("div", { class: "perm-warn danger" }, "\u26a0 World-writable \u2014 any user can modify this file. Dangerous for scripts and configs."));
      else out.appendChild(h("div", { class: "perm-warn ok" }, "Reasonable. Grant the minimum needed \u2014 most files don't need execute, and only the owner should usually write."));
    }
    mount.appendChild(grid);
    mount.appendChild(out);
    render();
  };

  /* ---------------------------------------------------------------
     10. WI-FI SECURITY COMPARISON
  --------------------------------------------------------------- */
  Widgets.wifi = function (mount) {
    shell(mount, "domains lab", "Wi-Fi security standards",
      "From broken to best. Pick a standard to see what protects (or fails to protect) the air around you.");
    const STD = {
      WEP: { year: "1999", enc: "RC4 (broken)", status: "broken", verdict: "Cracked in minutes. Treat as no encryption at all.", note: "Never use. Present only on legacy gear that must be replaced." },
      WPA: { year: "2003", enc: "TKIP", status: "broken", verdict: "A stopgap for WEP; also broken now.", note: "Deprecated \u2014 TKIP has practical attacks. Move on." },
      WPA2: { year: "2004", enc: "AES-CCMP", status: "ok", verdict: "The long-time standard. Solid with a strong passphrase.", note: "Acceptable minimum. PSK handshakes can be captured and cracked offline if the passphrase is weak." },
      WPA3: { year: "2018", enc: "AES + SAE", status: "best", verdict: "Current best. Resists offline cracking and protects management frames.", note: "Use where supported. SAE (Dragonfly) blocks offline guessing; PMF stops deauth attacks." }
    };
    let sel = "WPA2";
    const controls = h("div", { class: "widget-controls" });
    controls.appendChild(seg(Object.keys(STD).map((k) => [k, k]), sel, (v) => { sel = v; render(); }));
    mount.appendChild(controls);
    const stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);
    const BADGE = { broken: ["Broken", "var(--rose)"], ok: ["Acceptable", "var(--amber)"], best: ["Best", "var(--lime)"] };
    function render() {
      const s = STD[sel];
      stage.innerHTML = "";
      const [bl, bc] = BADGE[s.status];
      stage.appendChild(h("div", { class: "wifi-head" },
        h("span", { class: "wifi-name" }, sel),
        h("span", { class: "wifi-badge", style: "background:" + bc }, bl),
        h("span", { class: "wifi-year" }, s.year)
      ));
      stage.appendChild(h("div", { class: "sub-row" }, h("span", { class: "sub-k" }, "Encryption"), h("span", { class: "sub-v" }, s.enc)));
      stage.appendChild(h("p", { class: "wifi-verdict" }, s.verdict));
      stage.appendChild(h("p", { class: "wifi-note" }, s.note));
    }
    render();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);
})();
