/* =====================================================================
   CITADEL · Detection coverage matrix   (widget id: attackmatrix)
   Map your detections onto the 14 enterprise ATT&CK tactics; the tactics
   with zero coverage are your blind spots. Pure client-side, built as DOM
   nodes (never innerHTML from data), zero network requests, theme-aware.
   Merged into window.Widgets (loaded before app.js).
   ===================================================================== */
(function () {
  "use strict";

  // --- DOM helpers (verbatim from widgets-ext.js) --------------------
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
  const STORE_KEY = "cy_attack_v1";

  /* ---------------------------------------------------------------
     DETECTION COVERAGE MATRIX
     Toggle the techniques you can detect across all 14 tactics; the
     readout surfaces overall coverage and the tactics left wide open.
  --------------------------------------------------------------- */
  Widgets.attackmatrix = function (mount) {
    // Safe to mount repeatedly: clear any prior render on this node.
    while (mount.firstChild) mount.removeChild(mount.firstChild);

    shell(mount, "threats lab", "Detection coverage matrix",
      "Map your detections onto the 14 enterprise ATT&CK tactics. The tactics with nothing covered are your blind spots \u2014 the stages an intruder can move through unseen.");

    // 14 enterprise tactics, each with ~3 example techniques + the defense.
    // (reused from the ATT&CK tactics explorer widget)
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

    const TOTAL = T.reduce((n, t) => n + t[2].length, 0);

    // --- persistence: a set of covered technique ids ("tactic:tech") ---
    const covered = new Set();
    (function load() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) arr.forEach((id) => { if (typeof id === "string") covered.add(id); });
      } catch (e) { /* storage blocked or corrupt — start empty */ }
    })();
    function save() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(covered))); }
      catch (e) { /* storage unavailable — keep in-memory only */ }
    }

    // --- intro line: the point of the exercise -------------------------
    mount.appendChild(h("p", { class: "am-intro" },
      "Click a technique your tooling can ", h("b", {}, "reliably detect"),
      ". Coverage climbs as you go \u2014 and any tactic that stays empty is a ",
      h("b", {}, "blind spot"), ", a stage where an intruder operates without tripping a single alert. Mapping that gap is the whole point."));

    // --- controls ------------------------------------------------------
    const markBtn = h("button", { class: "w-btn ghost", type: "button" }, "Mark all");
    const clearBtn = h("button", { class: "w-btn ghost", type: "button" }, "Clear all");
    const resetBtn = h("button", { class: "w-btn ghost am-reset", type: "button" }, "Reset coverage");
    const EXPORT_LABEL = "Export coverage report";
    const copyBtn = h("button", { class: "w-btn am-export", type: "button" }, EXPORT_LABEL);
    const downloadBtn = h("button", { class: "w-btn ghost am-download", type: "button" }, "Download .md");
    mount.appendChild(h("div", { class: "widget-controls" }, markBtn, clearBtn, resetBtn, copyBtn, downloadBtn));

    // --- live readout --------------------------------------------------
    const covEl = h("b", {}, "");
    const blindEl = h("b", {}, "");
    mount.appendChild(h("div", { class: "w-readout am-readout" },
      h("span", { class: "ro" }, "Coverage ", covEl),
      h("span", { class: "ro am-blindspots" }, "Blind spots ", blindEl)));

    // --- the matrix: one card per tactic, technique cells inside -------
    const grid = h("div", { class: "am-grid" });
    mount.appendChild(grid);

    const cols = T.map((t, ti) => {
      const countEl = h("span", { class: "am-tac-count" }, "0 / " + t[2].length);
      const head = h("div", { class: "am-col-head" },
        h("span", { class: "am-tac-name" }, t[0]), countEl);
      const cellsWrap = h("div", { class: "am-cells" });
      const cells = t[2].map((tech, xi) => {
        const id = ti + ":" + xi;
        const btn = h("button", { class: "am-cell", type: "button", "aria-pressed": "false", title: "Defense: " + t[3] },
          h("span", { class: "am-tick", "aria-hidden": "true" }, "\u2713"),
          h("span", { class: "am-cell-label" }, tech));
        if (covered.has(id)) { btn.classList.add("on"); btn.setAttribute("aria-pressed", "true"); }
        btn.addEventListener("click", () => {
          if (covered.has(id)) { covered.delete(id); btn.classList.remove("on"); btn.setAttribute("aria-pressed", "false"); }
          else { covered.add(id); btn.classList.add("on"); btn.setAttribute("aria-pressed", "true"); }
          save(); update();
        });
        cellsWrap.appendChild(btn);
        return { id: id, btn: btn };
      });
      grid.appendChild(h("div", { class: "am-col" }, head, cellsWrap));
      return { cells: cells, countEl: countEl, head: head };
    });

    // --- recompute every readout from the covered set ------------------
    function update() {
      let done = 0;
      const blind = [];
      cols.forEach((col, ti) => {
        let c = 0;
        col.cells.forEach((cell) => { if (covered.has(cell.id)) c++; });
        col.countEl.textContent = c + " / " + col.cells.length;
        col.head.classList.toggle("am-full", c > 0 && c === col.cells.length);
        col.head.classList.toggle("am-blind", c === 0);
        done += c;
        if (c === 0) blind.push(T[ti][0]);
      });
      const pct = TOTAL ? Math.round((done / TOTAL) * 100) : 0;
      covEl.textContent = done + " / " + TOTAL + " techniques (" + pct + "%)";
      if (blind.length === 0) {
        blindEl.textContent = "none \u2014 every tactic has coverage";
        blindEl.classList.add("am-ok");
      } else {
        blindEl.textContent = blind.join(", ");
        blindEl.classList.remove("am-ok");
      }
    }

    // --- bulk helpers --------------------------------------------------
    function setAllCells(on) {
      cols.forEach((col) => col.cells.forEach((cell) => {
        if (on) { covered.add(cell.id); cell.btn.classList.add("on"); cell.btn.setAttribute("aria-pressed", "true"); }
        else { covered.delete(cell.id); cell.btn.classList.remove("on"); cell.btn.setAttribute("aria-pressed", "false"); }
      }));
    }
    markBtn.addEventListener("click", () => { setAllCells(true); save(); update(); });
    clearBtn.addEventListener("click", () => { setAllCells(false); save(); update(); });
    resetBtn.addEventListener("click", () => {
      setAllCells(false);
      covered.clear();
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      update();
    });

    // --- export a shareable Markdown coverage report -------------------
    // Builds the report STRING from the live `covered` set at call time.
    function buildReport() {
      let done = 0;
      const rows = T.map((t, ti) => {
        const techs = t[2].map((name, xi) => {
          const on = covered.has(ti + ":" + xi);
          if (on) done++;
          return { name: name, on: on };
        });
        const c = techs.reduce((n, x) => n + (x.on ? 1 : 0), 0);
        return { name: t[0], c: c, total: techs.length, techs: techs };
      });
      const pct = TOTAL ? Math.round((done / TOTAL) * 100) : 0;
      const blind = rows.filter((r) => r.c === 0).map((r) => r.name);
      const out = [];
      out.push("# ATT&CK detection coverage");
      out.push("_Generated " + new Date().toISOString() + "_");
      out.push("");
      out.push("Covered " + done + " / " + TOTAL + " techniques (" + pct + "%)");
      out.push("");
      rows.forEach((r) => {
        out.push("## " + r.name + " \u2014 " + r.c + "/" + r.total);
        r.techs.forEach((x) => out.push("- [" + (x.on ? "x" : " ") + "] " + x.name));
        out.push("");
      });
      out.push("## Blind spots (0% coverage)");
      if (blind.length === 0) out.push("None \u2014 every tactic has at least one detection.");
      else blind.forEach((name) => out.push("- " + name));
      out.push("");
      return out.join("\n");
    }
    function copyReport(text, ok) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fallback);
      } else { fallback(); }
      function fallback() {
        try {
          const ta = document.createElement("textarea");
          ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta); if (ok) ok();
        } catch (e) { /* clipboard unavailable */ }
      }
    }
    let copyTimer = null;
    copyBtn.addEventListener("click", () => {
      copyReport(buildReport(), () => {
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("am-copied");
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
          copyBtn.textContent = EXPORT_LABEL;
          copyBtn.classList.remove("am-copied");
        }, 1400);
      });
    });
    downloadBtn.addEventListener("click", () => {
      try {
        const blob = new Blob([buildReport()], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = h("a", { href: url, download: "attack-coverage.md" });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) { /* download unavailable */ }
    });

    update();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);
})();
