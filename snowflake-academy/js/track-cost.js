/* =====================================================================
   track-cost.js — Glacier track "Cost & FinOps"
   Modules: model / control / observe

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data.
   ===================================================================== */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function svg(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }
  function segment(pairs, initialIdx, onPick) {
    var seg = h("div", { class: "w-seg" });
    var btns = [];
    for (var i = 0; i < pairs.length; i++) {
      (function (pair, idx) {
        var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
        b.addEventListener("click", function () {
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
          b.classList.add("active");
          onPick(pair[0]);
        });
        btns.push(b);
        seg.appendChild(b);
      })(pairs[i], i);
    }
    return seg;
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function num(v, fallback) { var n = Number(v); return isFinite(n) ? n : fallback; }
  function fmt(n, d) { if (!isFinite(n)) return "0"; return n.toFixed(d == null ? 1 : d); }

  /* range slider inside a .w-field; onChange receives a number */
  function slider(label, min, max, step, initial, suffix, onChange) {
    var out = h("b", {}, String(initial) + (suffix || ""));
    var input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(initial) });
    input.addEventListener("input", function () {
      var v = num(input.value, initial);
      out.textContent = String(v) + (suffix || "");
      onChange(v);
    });
    return h("label", { class: "w-field" }, h("span", {}, label + " "), input, out);
  }
  function picker(label, pairs, initialIdx, onChange) {
    var sel = h("select", {});
    for (var i = 0; i < pairs.length; i++) {
      var o = h("option", { value: String(pairs[i][0]) }, pairs[i][1]);
      if (i === initialIdx) o.setAttribute("selected", "selected");
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () { onChange(sel.value); });
    return h("label", { class: "w-field" }, h("span", {}, label + " "), sel);
  }

  var SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"];
  var RATES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

  var Widgets = {};

  /* ---------- cloudServicesLab: the daily 10% adjustment ---------- */
  Widgets.cloudServicesLab = function (mount) {
    shell(mount, "calculator", "Cloud services: what you actually pay",
      "Cloud services credits are only billed for the part that exceeds 10% of the same day's virtual warehouse compute. Pick a preset or drag the sliders.");
    var wh = 120, cs = 8, price = 3;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var whField, csField;

    function bar(label, value, max, tint) {
      var pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
      return h("div", { style: "margin:6px 0" },
        h("div", { style: "font-size:0.8rem;color:var(--text-dim)" }, label + " — " + fmt(value, 1) + " cr"),
        h("div", { style: "height:12px;border:1px solid var(--line);border-radius:6px;background:var(--surface-2);overflow:hidden" },
          h("div", { style: "height:100%;width:" + fmt(pct, 1) + "%;background:color-mix(in srgb, " + tint + " 55%, transparent)" })));
    }
    function paint() {
      var allowance = wh * 0.10;
      var billableCs = Math.max(0, cs - allowance);
      var adjustment = Math.min(cs, allowance);
      var billed = wh + billableCs;
      var ratio = wh > 0 ? (cs / wh) * 100 : (cs > 0 ? Infinity : 0);
      var max = Math.max(wh, cs, 1);
      clear(stage);
      stage.appendChild(bar("Warehouse compute", wh, max, "#fbbf24"));
      stage.appendChild(bar("Cloud services used", cs, max, "#818cf8"));
      stage.appendChild(bar("Free allowance (10% of warehouse)", allowance, max, "#34d399"));
      stage.appendChild(bar("Cloud services billed", billableCs, max, "#f472b6"));
      stage.appendChild(h("p", { style: "font-size:0.85rem;color:var(--text);margin:8px 0 0" },
        billableCs > 0
          ? "Cloud services exceed the allowance: hunt for chatty metadata traffic (SHOW / DESCRIBE polling, tiny queries, heavy compilation, COPY listing huge prefixes)."
          : "Cloud services sit inside the allowance, so the adjustment cancels them out completely."));
      clear(readout);
      readout.appendChild(ro("allowance", fmt(allowance, 1) + " cr"));
      readout.appendChild(ro("adjustment", "-" + fmt(adjustment, 1) + " cr"));
      readout.appendChild(ro("CS billed", fmt(billableCs, 1) + " cr/day"));
      readout.appendChild(ro("CS / warehouse", isFinite(ratio) ? fmt(ratio, 1) + "%" : "no warehouse use"));
      readout.appendChild(ro("total billed", fmt(billed, 1) + " cr/day"));
      readout.appendChild(ro("~monthly", "$" + fmt(billed * 30 * price, 0)));
    }
    var presets = { etl: [120, 8], bi: [40, 22], serverless: [0, 6] };
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["etl", "Typical ETL day"], ["bi", "Metadata-heavy BI"], ["serverless", "No warehouses ran"]], 0, function (v) {
        wh = presets[v][0]; cs = presets[v][1];
        var a = whField.querySelector("input"), b = whField.querySelector("b");
        if (a) a.value = String(wh); if (b) b.textContent = String(wh) + " cr";
        var c = csField.querySelector("input"), d = csField.querySelector("b");
        if (c) c.value = String(cs); if (d) d.textContent = String(cs) + " cr";
        paint();
      }),
      (whField = slider("Warehouse credits / day", 0, 400, 5, wh, " cr", function (v) { wh = v; paint(); })),
      (csField = slider("Cloud services credits / day", 0, 120, 1, cs, " cr", function (v) { cs = v; paint(); })),
      slider("$ per credit", 1, 6, 0.5, price, "", function (v) { price = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- monitorLab: when do triggers fire, and how far past quota? ---------- */
  Widgets.monitorLab = function (mount) {
    shell(mount, "simulator", "Resource monitor trigger timeline",
      "Set a monthly credit quota, the thresholds and a steady daily burn. The timeline shows the day each trigger fires and the overshoot each suspend mode lets through.");
    var quota = 600, burn = 30, notifyAt = 75, suspendAt = 100, immAt = 110, sizeIdx = 3, tailMin = 20;
    var LAG_MIN = 5;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function fireDay(pct) { return burn > 0 ? (quota * pct / 100) / burn : Infinity; }
    function paint() {
      var rate = RATES[sizeIdx] || 8;
      var dN = fireDay(notifyAt), dS = fireDay(suspendAt), dI = fireDay(immAt);
      var lagCr = rate * LAG_MIN / 60;
      var overSuspend = rate * tailMin / 60 + lagCr;
      var overImm = lagCr;
      var first = Math.min(dS, dI);
      var firstKind = dS <= dI ? "SUSPEND" : "SUSPEND_IMMEDIATE";
      var stopCr = first <= 30 ? quota * (dS <= dI ? suspendAt : immAt) / 100 + (dS <= dI ? overSuspend : overImm) : burn * 30;

      clear(stage);
      var W = 520, H = 92, x0 = 20, x1 = 500;
      var s = svg("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "Thirty-day timeline with trigger markers" });
      s.appendChild(svg("rect", { x: x0, y: 34, width: x1 - x0, height: 16, rx: 4, style: "fill:var(--surface-2);stroke:var(--line)" }));
      var spentDays = Math.min(30, first);
      s.appendChild(svg("rect", { x: x0, y: 34, width: (x1 - x0) * (spentDays / 30), height: 16, rx: 4, style: "fill:color-mix(in srgb, #fbbf24 45%, transparent)" }));
      function marker(day, label, row) {
        if (!(day <= 30)) return;
        var x = x0 + (x1 - x0) * (day / 30);
        s.appendChild(svg("line", { x1: x, x2: x, y1: 28, y2: 56, style: "stroke:var(--accent-ink);stroke-width:2" }));
        var t = svg("text", { x: x, y: row ? 72 : 22, "text-anchor": "middle", style: "fill:var(--text);font-size:11px" });
        t.textContent = label + " d" + fmt(day, 1);
        s.appendChild(t);
      }
      marker(dN, "NOTIFY " + notifyAt + "%", 0);
      marker(dS, "SUSPEND " + suspendAt + "%", 1);
      marker(dI, "IMMEDIATE " + immAt + "%", 0);
      var end = svg("text", { x: x1, y: 88, "text-anchor": "end", style: "fill:var(--text-dim);font-size:10px" });
      end.textContent = "day 30";
      s.appendChild(end);
      stage.appendChild(s);
      var msg;
      if (first > 30) msg = "At this burn rate no suspend trigger fires this month: the quota is never reached, so the monitor only costs you a notification (if any).";
      else if (dI <= dS) msg = "SUSPEND_IMMEDIATE is at or below the SUSPEND threshold, so the plain SUSPEND trigger never gets a chance to act. Order them notify < suspend < suspend_immediate.";
      else msg = "SUSPEND fires first and lets in-flight statements finish (here a " + tailMin + "-minute tail). SUSPEND_IMMEDIATE is the backstop that cancels whatever is still running.";
      stage.appendChild(h("p", { style: "font-size:0.85rem;color:var(--text);margin:6px 0 0" }, msg));

      clear(readout);
      readout.appendChild(ro("notify", dN <= 30 ? "day " + fmt(dN, 1) : "not this month"));
      readout.appendChild(ro("suspend", dS <= 30 ? "day " + fmt(dS, 1) : "not this month"));
      readout.appendChild(ro("suspend_immediate", dI <= 30 ? "day " + fmt(dI, 1) : "not this month"));
      readout.appendChild(ro("overshoot SUSPEND", "~" + fmt(overSuspend, 1) + " cr"));
      readout.appendChild(ro("overshoot IMMEDIATE", "~" + fmt(overImm, 1) + " cr"));
      readout.appendChild(ro("first stop", first <= 30 ? firstKind : "none"));
      readout.appendChild(ro("credits this month", "~" + fmt(stopCr, 0)));
    }
    var pctOpts = function (list) { return list.map(function (p) { return [p, p + "%"]; }); };
    mount.appendChild(h("div", { class: "widget-controls" },
      slider("Monthly quota", 100, 2000, 50, quota, " cr", function (v) { quota = v; paint(); }),
      slider("Daily burn", 5, 150, 5, burn, " cr/day", function (v) { burn = v; paint(); }),
      picker("Warehouse size", SIZES.slice(0, 8).map(function (s, i) { return [i, s + " (" + RATES[i] + " cr/h)"]; }), sizeIdx, function (v) { sizeIdx = num(v, 3); paint(); }),
      slider("Longest in-flight statement", 0, 120, 5, tailMin, " min", function (v) { tailMin = v; paint(); }),
      picker("NOTIFY at", pctOpts([50, 75, 90]), 1, function (v) { notifyAt = num(v, 75); paint(); }),
      picker("SUSPEND at", pctOpts([90, 100, 110]), 1, function (v) { suspendAt = num(v, 100); paint(); }),
      picker("SUSPEND_IMMEDIATE at", pctOpts([100, 110, 120]), 1, function (v) { immAt = num(v, 110); paint(); })));
    mount.appendChild(stage);
    mount.appendChild(h("p", { style: "font-size:0.75rem;color:var(--text-dim);margin:4px 0" },
      "Overshoot includes an illustrative " + LAG_MIN + "-minute evaluation lag: monitors are checked periodically, not per second."));
    mount.appendChild(readout);
    paint();
  };

  /* ---------- rightSizeLab: symptom -> lever -> credit delta ---------- */
  Widgets.rightSizeLab = function (mount) {
    shell(mount, "advisor", "Right-sizing advisor",
      "Pick the symptom you see in QUERY_HISTORY and WAREHOUSE_LOAD_HISTORY. The advisor names the lever and estimates the daily credit delta with simple, illustrative multipliers.");
    var profile = "spill", sizeIdx = 3, hours = 6, resumes = 40, suspendSec = 600;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var rate = RATES[sizeIdx] || 8;
      var idleBefore = resumes * suspendSec / 3600 * rate;
      var before = rate * hours + idleBefore;
      var after = before, action = "", why = "";
      if (profile === "spill") {
        var up = Math.min(sizeIdx + 1, RATES.length - 1), r2 = RATES[up];
        after = r2 * hours * 0.4 + resumes * suspendSec / 3600 * r2;
        action = "Size up one step to " + SIZES[up];
        why = "Remote spilling means the working set no longer fits memory plus local SSD. Double the node count and the spill typically disappears; runtime often falls by more than half, so the bigger warehouse can be cheaper per job (assumed 0.4x runtime here).";
      } else if (profile === "queue") {
        after = before + rate * hours * 0.3 * 2;
        action = "Multi-cluster: MIN 1 / MAX 3, STANDARD policy (Enterprise+)";
        why = "Each query is fast but they wait in line. More clusters fix concurrency; a bigger single cluster mostly makes each query faster, not the queue shorter. Cost goes up, so confirm the queue time actually hurts someone (assumed 2 extra clusters for 30% of active time).";
      } else if (profile === "tiny") {
        var down = Math.max(sizeIdx - 2, 0), r3 = RATES[down];
        after = r3 * hours * 1.25 + resumes * suspendSec / 3600 * r3;
        action = "Size down two steps to " + SIZES[down];
        why = "Point lookups and small dashboards cannot use all the nodes of a large warehouse. Quartering the rate costs a little latency (assumed 1.25x runtime) and saves most of the bill.";
      } else if (profile === "outlier") {
        after = before - rate * 0.75 + rate * 0.5;
        action = "Enable QAS (scale factor <= 8) or route the outlier to its own warehouse";
        why = "One big scan should not set the size for everything else. QAS bursts serverless compute for eligible scan-heavy queries; check SYSTEM$ESTIMATE_QUERY_ACCELERATION first (assumed the 1 h outlier shrinks to 15 min plus 0.5 h of QAS credits).";
      } else if (profile === "idle") {
        var idleAfter = resumes * 60 / 3600 * rate;
        after = rate * hours + idleAfter;
        action = suspendSec <= 60 ? "Auto-suspend is already tight — look at the schedule instead" : "Lower AUTO_SUSPEND to 60 s";
        why = "Bursty work with long auto-suspend pays for the idle tail after every burst. Shorter suspend trades away the local disk cache between bursts, so keep it longer on BI warehouses that reread the same data.";
      } else {
        action = "Leave it";
        why = "No spilling, no queuing, high utilisation: resizing now would trade cost for nothing. Re-check monthly.";
      }
      var delta = after - before;
      clear(stage);
      stage.appendChild(h("p", { style: "margin:0 0 6px;font-weight:600;color:var(--accent-ink)" }, action));
      stage.appendChild(h("p", { style: "margin:0;font-size:0.86rem;line-height:1.55;color:var(--text)" }, why));
      clear(readout);
      readout.appendChild(ro("current", SIZES[sizeIdx] + " · " + fmt(before, 1) + " cr/day"));
      readout.appendChild(ro("idle tail now", fmt(idleBefore, 1) + " cr/day"));
      readout.appendChild(ro("projected", fmt(after, 1) + " cr/day"));
      readout.appendChild(ro("delta", (delta >= 0 ? "+" : "") + fmt(delta, 1) + " cr/day"));
      readout.appendChild(ro("delta / 30 days", (delta >= 0 ? "+" : "") + fmt(delta * 30, 0) + " cr"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["spill", "Remote spilling"], ["queue", "Queued at peak"], ["tiny", "Tiny queries, big WH"], ["outlier", "One huge outlier"], ["idle", "Idle tails"], ["healthy", "Looks healthy"]], 0, function (v) { profile = v; paint(); }),
      picker("Current size", SIZES.slice(0, 8).map(function (s, i) { return [i, s + " (" + RATES[i] + " cr/h)"]; }), sizeIdx, function (v) { sizeIdx = num(v, 3); paint(); }),
      slider("Busy hours / day", 1, 24, 1, hours, " h", function (v) { hours = v; paint(); }),
      slider("Resumes / day", 1, 200, 1, resumes, "", function (v) { resumes = v; paint(); }),
      picker("Current AUTO_SUSPEND", [[600, "600 s"], [300, "300 s"], [60, "60 s"]], 0, function (v) { suspendSec = num(v, 600); paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- quizzes ---------- */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "cost-model": {
      title: "Cost model checkpoint",
      sub: "Credits, per-second billing, storage, serverless and the cloud services adjustment.",
      questions: [
        { q: "An XL warehouse (16 credits/hour) resumes, runs one 30-second query and is suspended immediately. Roughly how many credits are billed?",
          options: ["0.133 credits, for exactly 30 seconds", "0.267 credits, because of the 60-second minimum", "16 credits, for a full hour", "Nothing, because sub-minute runs are free"], answer: 1,
          explain: "Billing is per second, but every resume carries a 60-second minimum. Sixty seconds at 16 credits/hour is 16 × 60 / 3600 ≈ 0.267 credits. Frequent resume/suspend cycles of very short work pay that minimum each time." },
        { q: "On one day an account uses 200 warehouse credits and 35 cloud services credits. How many cloud services credits are billed?",
          options: ["35", "20", "15", "0"], answer: 2,
          explain: "The daily allowance is 10% of that day's warehouse compute, here 20 credits. Only the excess is billed: 35 − 20 = 15. If cloud services had been 18, nothing would be billed for them." },
        { q: "Which usage forms the base for the 10% cloud services allowance?",
          options: ["All compute, including serverless features", "Virtual warehouse compute credits for that day", "Average storage in TB for the month", "The account's total contract capacity"], answer: 1,
          explain: "The adjustment is computed daily against virtual warehouse compute only. An account that mostly runs serverless features or Cortex calls has a small base, so its cloud services usage is more likely to be billed." },
        { q: "You drop a 10 TB permanent table whose DATA_RETENTION_TIME_IN_DAYS is 1. How long does its storage keep appearing on the bill?",
          options: ["It stops immediately", "1 day of Time Travel", "About 8 days: 1 day Time Travel then 7 days Fail-safe", "90 days"], answer: 2,
          explain: "Dropped permanent data stays in Time Travel for the retention period, then moves to Fail-safe for 7 more days, and both are billed as storage. Transient and temporary tables skip Fail-safe, which is why staging data belongs in them." },
        { q: "Which workload most typically drives cloud services usage above the allowance?",
          options: ["A BI tool polling thousands of tiny metadata and SHOW queries per hour", "A single nightly 2-hour MERGE on an L warehouse", "Loading 50 large Parquet files once a day", "Running a long query on a 4XL warehouse"], answer: 0,
          explain: "Cloud services does compilation, metadata, authentication and SHOW/DESCRIBE work. High-frequency, tiny statements generate lots of that work with almost no warehouse compute to offset it, so the ratio climbs past 10%." },
        { q: "A team's automatic clustering spend doubles, yet the resource monitor on their warehouse never fires. Why?",
          options: ["The monitor quota is per user", "Clustering credits are billed as storage", "Monitors only fire at month end", "Automatic clustering is serverless compute, and resource monitors only govern warehouses"], answer: 3,
          explain: "Resource monitors attach to warehouses (or the account's warehouse total) and cannot see serverless services such as automatic clustering, Snowpipe or search optimization. Budgets and the serverless history views are how you watch those." }
      ]
    },
    "cost-control": {
      title: "Guardrails checkpoint",
      sub: "Resource monitors, budgets, statement timeouts and right-sizing levers.",
      questions: [
        { q: "What is the practical difference between SUSPEND and SUSPEND_IMMEDIATE actions on a resource monitor?",
          options: ["SUSPEND deletes the warehouse; SUSPEND_IMMEDIATE only pauses it", "There is none; they are aliases", "SUSPEND lets running statements finish; SUSPEND_IMMEDIATE cancels them", "SUSPEND_IMMEDIATE only sends a notification"], answer: 2,
          explain: "SUSPEND stops new work but waits for in-flight statements, so a long query can push spend past the threshold. SUSPEND_IMMEDIATE cancels running statements, which is why it is usually set at a higher percentage as a hard backstop." },
        { q: "Which role can create a resource monitor by default?",
          options: ["ACCOUNTADMIN", "SYSADMIN", "SECURITYADMIN", "Any role with USAGE on the warehouse"], answer: 0,
          explain: "Creating resource monitors is reserved for ACCOUNTADMIN. It can then grant MONITOR or MODIFY on a specific monitor so other roles can view or adjust it without full admin rights." },
        { q: "You need to alert on spend from serverless tasks, Snowpipe and automatic clustering per project. Which feature fits?",
          options: ["A resource monitor on each warehouse", "STATEMENT_TIMEOUT_IN_SECONDS", "A custom budget containing those objects", "A larger warehouse"], answer: 2,
          explain: "Budgets track credit spend for a group of objects, including serverless features, against a monthly limit and send notifications. Resource monitors cannot see serverless compute, so they cannot cover this." },
        { q: "A transform shows large BYTES_SPILLED_TO_REMOTE_STORAGE and runs for 40 minutes on an M warehouse. What is the most likely cost-efficient fix?",
          options: ["Add more clusters", "Lower AUTO_SUSPEND", "Turn on search optimization", "Size the warehouse up, then confirm spilling disappears and runtime drops"], answer: 3,
          explain: "Remote spilling means memory and local disk are exhausted, which slows the query dramatically. Doubling the size doubles memory; if runtime falls by more than half, the bigger warehouse is cheaper per run. Clusters do not add memory to one query." },
        { q: "Dashboards fire many short queries at 9 a.m.; QUEUED_OVERLOAD_TIME spikes but each query runs in under a second. What lever fits?",
          options: ["Size the warehouse up to 4XL", "Multi-cluster warehouse with a modest MAX_CLUSTER_COUNT", "Query Acceleration Service", "Increase DATA_RETENTION_TIME_IN_DAYS"], answer: 1,
          explain: "Queuing with fast queries is a concurrency problem, which extra clusters solve. A bigger single cluster mainly speeds individual queries, and QAS targets large scans rather than many tiny ones." },
        { q: "You lower AUTO_SUSPEND from 600 to 60 seconds on a BI warehouse. What do you risk?",
          options: ["Higher storage cost", "Losing the local disk cache between bursts, so repeat queries read remote storage again", "Losing the result cache", "Breaking resource monitor quotas"], answer: 1,
          explain: "A suspended warehouse drops its local SSD cache, so the next burst rereads from remote storage. The result cache lives in cloud services and survives suspension. Measure query latency before and after the change." }
      ]
    },
    "cost-observe": {
      title: "Cost observability checkpoint",
      sub: "ACCOUNT_USAGE, INFORMATION_SCHEMA, attribution and storage metrics.",
      questions: [
        { q: "A runaway job started ten minutes ago and you need its credit burn right now. Which source is best?",
          options: ["SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY", "ORGANIZATION_USAGE.USAGE_IN_CURRENCY_DAILY", "INFORMATION_SCHEMA.WAREHOUSE_METERING_HISTORY() and QUERY_HISTORY()", "The monthly invoice"], answer: 2,
          explain: "ACCOUNT_USAGE views lag by up to a few hours, and organization views lag more. INFORMATION_SCHEMA table functions are near real-time, at the cost of short retention and per-database scope." },
        { q: "Sum of CREDITS_ATTRIBUTED_COMPUTE for a warehouse is 30% below its WAREHOUSE_METERING_HISTORY credits. What is the most likely explanation?",
          options: ["Attribution includes cloud services twice", "The query tags were wrong", "Metering is estimated", "Idle time, while the warehouse was running with no queries, is not attributed to any query"], answer: 3,
          explain: "QUERY_ATTRIBUTION_HISTORY spreads only the compute used while queries execute. Idle time before auto-suspend stays unattributed, and the gap between metered and attributed credits is a direct measure of idle waste." },
        { q: "How do you label every query a dbt job or a Python service runs so cost can be grouped by pipeline?",
          options: ["Set QUERY_TAG for the session (dbt's query_tag config, or ALTER SESSION SET QUERY_TAG)", "Add a SQL comment to each statement", "Create one user per query", "Use a different warehouse size"], answer: 0,
          explain: "QUERY_TAG is recorded on every query in QUERY_HISTORY and QUERY_ATTRIBUTION_HISTORY, so it can be grouped directly. A JSON-shaped tag such as team, pipeline and environment keeps it machine-parsable." },
        { q: "How far back can you query SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY?",
          options: ["7 days", "365 days", "14 days", "Forever"], answer: 1,
          explain: "ACCOUNT_USAGE keeps a year of history. INFORMATION_SCHEMA QUERY_HISTORY only reaches back about 7 days, so trend analysis and monthly reviews belong on ACCOUNT_USAGE, or on your own snapshot tables for longer horizons." },
        { q: "You need to find storage still billed for tables that were dropped last month. Where do you look?",
          options: ["INFORMATION_SCHEMA.TABLES", "SHOW TABLES", "ACCOUNT_USAGE.TABLE_STORAGE_METRICS, which includes dropped tables", "QUERY_HISTORY"], answer: 2,
          explain: "INFORMATION_SCHEMA and SHOW only reflect live objects. ACCOUNT_USAGE includes dropped objects with their deletion timestamps, and TABLE_STORAGE_METRICS breaks bytes into active, Time Travel, Fail-safe and clone-retained." },
        { q: "Which TABLE_STORAGE_METRICS column shows bytes kept only because a clone still references them?",
          options: ["ACTIVE_BYTES", "TIME_TRAVEL_BYTES", "FAILSAFE_BYTES", "RETAINED_FOR_CLONE_BYTES"], answer: 3,
          explain: "When a table is modified or dropped but a clone shares its micro-partitions, those partitions stay alive and are billed to the original. Forgotten clones of large tables are a common hidden storage cost." }
      ]
    }
  });

  /* ---------- track ---------- */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.cost = {
    id: "cost",
    name: "Cost & FinOps",
    short: "COST",
    tagline: "Every credit accounted for",
    color: "#fbbf24",
    blurb: "How Snowflake turns compute, storage, serverless features and data transfer into a bill; the guardrails that stop surprises; and the ACCOUNT_USAGE queries that attribute every credit to a team, pipeline or query.",
    modules: [
      {
        id: "model",
        name: "The Cost Model",
        icon: "trend",
        lessons: [
          {
            id: "credits",
            title: "Credits and the billing components",
            summary: "A Snowflake bill is compute credits plus storage plus data transfer, and each component has its own meter and its own levers.",
            minutes: 10,
            tags: ["credits", "billing", "storage", "warehouses"],
            blocks: [
              { t: "p", html: "Hold this picture: a <strong>credit</strong> is a unit of compute, priced per contract and edition, and almost everything that <em>does work</em> spends credits. Storage and data transfer are billed separately in currency. When someone asks “why did the bill go up?”, the first move is always to split it into those meters." },
              { t: "table", headers: ["Component", "Meter", "Typical driver"], rows: [
                ["Virtual warehouses", "Credits/hour by size, per second, 60 s minimum per resume", "Running time, size, clusters, idle tails"],
                ["Serverless features", "Credits per compute used, managed by Snowflake", "Snowpipe, auto-clustering, MV refresh, search optimization, serverless tasks, QAS, replication"],
                ["Cloud services", "Credits, billed only above 10% of daily warehouse compute", "Compilation, metadata, SHOW/DESCRIBE polling, auth"],
                ["AI services", "Credits per tokens or per page/request", "Cortex LLM functions, Cortex Search, Analyst"],
                ["Storage", "Average compressed TB per month", "Active data, Time Travel, Fail-safe, clone-retained, stages"],
                ["Data transfer", "Per TB egressed", "Cross-region or cross-cloud replication, unloads, external functions"]
              ] },
              { t: "h", text: "Warehouse credits: doubling is the rule" },
              { t: "stat", items: [
                { v: "1", k: "XS credits/hour" },
                { v: "8", k: "L credits/hour" },
                { v: "128", k: "4XL credits/hour" },
                { v: "60 s", k: "minimum per resume" }
              ] },
              { t: "p", html: "Every size step doubles both the compute and the rate: XS=1, S=2, M=4, L=8, XL=16, 2XL=32, 3XL=64, 4XL=128, 5XL=256, 6XL=512 credits per hour. A query that scales perfectly costs the same on any size and just finishes faster; one that scales poorly costs more on a bigger warehouse. Multi-cluster warehouses multiply the rate by the number of clusters running." },
              { t: "code", lang: "text", code:
                "credits = rate(size) * clusters * seconds_running / 3600\n" +
                "  M warehouse, 1 cluster, 25 min/day  = 4 * 1 * 1500 / 3600  ~= 1.67 cr/day\n" +
                "  same job, 40 resumes/day, 600 s auto-suspend tail each\n" +
                "    idle = 4 * 40 * 600 / 3600       ~= 26.7 cr/day   <- the real bill\n" +
                "  30 s job, resumed cold each time   -> billed as 60 s"
              },
              { t: "note", variant: "trap", html: "The 60-second minimum applies <em>each time the warehouse resumes</em>. A scheduler that wakes an XL every minute for a 5-second probe pays roughly a minute of XL per probe — about 16 × 60 / 3600 ≈ 0.27 credits, every time." },
              { t: "h", text: "Storage is cheaper, but sticky" },
              { t: "p", html: "Storage is billed on the daily average of compressed bytes, and it includes more than the live table: Time Travel versions of changed or deleted micro-partitions, Fail-safe (7 days, permanent tables only), bytes retained because a clone still references them, and files sitting in internal stages. High-churn tables (frequent full rewrites) can carry several times their active size in Time Travel and Fail-safe." },
              { t: "code", lang: "sql", code:
                "-- Daily credits by service type for the last 30 days\n" +
                "SELECT usage_date,\n" +
                "       service_type,\n" +
                "       SUM(credits_used_compute)            AS compute_cr,\n" +
                "       SUM(credits_used_cloud_services)     AS cloud_services_cr,\n" +
                "       SUM(credits_adjustment_cloud_services) AS cs_adjustment_cr,\n" +
                "       SUM(credits_billed)                  AS billed_cr\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.METERING_DAILY_HISTORY\n" +
                "WHERE  usage_date >= DATEADD(day, -30, CURRENT_DATE())\n" +
                "GROUP  BY 1, 2\n" +
                "ORDER  BY 1 DESC, billed_cr DESC;"
              },
              { t: "h", text: "Price per credit and contracts" },
              { t: "p", html: "The currency value of a credit depends on edition (Standard, Enterprise, Business Critical), cloud region and whether you bought capacity up front or pay on demand. Use <code class='tok'>SNOWFLAKE.ORGANIZATION_USAGE.USAGE_IN_CURRENCY_DAILY</code> when you need dollars rather than credits; never hardcode a price per credit into reports, read it or parameterise it." },
              { t: "compare",
                bad: { title: "Credit-only thinking", items: ["Optimises the warehouse line and ignores storage churn", "Treats bigger warehouses as always more expensive", "Misses idle tails and the per-resume minimum"] },
                good: { title: "Meter-by-meter thinking", items: ["Splits the bill into warehouse, serverless, cloud services, storage, transfer", "Measures cost per job, not per hour", "Finds idle and churn before touching SQL"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> “the bill jumped”, “which size is cheaper”, “why are we paying for storage we deleted”, “credits vs dollars”. Reach for the meter split and the per-second-with-60-second-minimum rule." },
              { t: "note", variant: "key", html: "<strong>Cost per job = rate × clusters × seconds, plus the tails.</strong> Split the bill by meter first; most surprises are idle time, serverless features or storage churn, not query SQL." }
            ]
          },
          {
            id: "serverless-costs",
            title: "Serverless features and cloud-services billing",
            summary: "Serverless features bill compute you never sized, and cloud services bill only the part above 10% of each day's warehouse credits.",
            minutes: 11,
            tags: ["serverless", "cloud-services", "billing"],
            blocks: [
              { t: "p", html: "Mental model: <strong>serverless features are warehouses Snowflake sizes for you</strong>. You trade control over size and suspend for convenience, and the spend shows up in its own history views, not on any warehouse. Cloud services is different again: it is the control plane, and it is mostly free up to a daily allowance." },
              { t: "table", headers: ["Feature", "What drives the spend", "Where to see it"], rows: [
                ["Snowpipe", "Compute to load files, plus a per-file or per-volume overhead depending on your pricing terms", "<code class='tok'>PIPE_USAGE_HISTORY</code>"],
                ["Automatic clustering", "Reclustering after DML on clustered tables; high churn = high cost", "<code class='tok'>AUTOMATIC_CLUSTERING_HISTORY</code>"],
                ["Materialized views", "Background refresh after base-table changes", "<code class='tok'>MATERIALIZED_VIEW_REFRESH_HISTORY</code>"],
                ["Search optimization", "Build plus maintenance of the search access path, and its storage", "<code class='tok'>SEARCH_OPTIMIZATION_HISTORY</code>"],
                ["Serverless tasks", "Compute Snowflake picks to meet the schedule", "<code class='tok'>SERVERLESS_TASK_HISTORY</code>"],
                ["Query Acceleration", "Burst compute for eligible scans, capped by scale factor", "<code class='tok'>QUERY_ACCELERATION_HISTORY</code>"],
                ["Replication", "Compute to refresh secondaries, plus data transfer", "<code class='tok'>REPLICATION_GROUP_USAGE_HISTORY</code>"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Every non-warehouse service, last 30 days, biggest first\n" +
                "SELECT service_type,\n" +
                "       name,\n" +
                "       ROUND(SUM(credits_used), 2) AS credits\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.METERING_HISTORY\n" +
                "WHERE  start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "  AND  service_type <> 'WAREHOUSE_METERING'\n" +
                "GROUP  BY 1, 2\n" +
                "ORDER  BY credits DESC\n" +
                "LIMIT  25;"
              },
              { t: "note", variant: "warn", html: "Resource monitors only see warehouses. A clustering key on a table that is fully rewritten every hour can quietly cost more than the warehouse that writes it, and no monitor will ever fire. Use budgets and the views above." },
              { t: "h", text: "The cloud services adjustment" },
              { t: "p", html: "Cloud services credits are consumed by parsing, compilation, optimisation, metadata operations, access control checks and SHOW/DESCRIBE commands. Each day, Snowflake subtracts an adjustment equal to the smaller of the cloud services used and 10% of that day's <em>virtual warehouse</em> compute. Only the remainder is billed." },
              { t: "code", lang: "text", code:
                "allowance  = 0.10 * warehouse_credits(day)\n" +
                "billed_cs  = MAX(0, cloud_services_credits(day) - allowance)\n" +
                "  wh 200, cs 12 -> allowance 20 -> billed 0\n" +
                "  wh 200, cs 35 -> allowance 20 -> billed 15\n" +
                "  wh   0, cs  6 -> allowance  0 -> billed 6   (serverless-only day)"
              },
              { t: "widget", id: "cloudServicesLab" },
              { t: "code", lang: "sql", code:
                "-- Days where cloud services broke through the allowance\n" +
                "SELECT usage_date,\n" +
                "       SUM(credits_used_compute)              AS wh_and_serverless_cr,\n" +
                "       SUM(credits_used_cloud_services)       AS cs_cr,\n" +
                "       SUM(credits_adjustment_cloud_services) AS cs_adjustment_cr,\n" +
                "       SUM(credits_used_cloud_services) + SUM(credits_adjustment_cloud_services) AS cs_billed_cr\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.METERING_DAILY_HISTORY\n" +
                "WHERE  usage_date >= DATEADD(day, -60, CURRENT_DATE())\n" +
                "GROUP  BY 1\n" +
                "HAVING cs_billed_cr > 0\n" +
                "ORDER  BY cs_billed_cr DESC;"
              },
              { t: "h2", text: "Finding the chatty queries" },
              { t: "code", lang: "sql", code:
                "SELECT query_type,\n" +
                "       user_name,\n" +
                "       COUNT(*)                                   AS queries,\n" +
                "       ROUND(SUM(credits_used_cloud_services), 2) AS cs_credits\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY\n" +
                "WHERE  start_time >= DATEADD(day, -7, CURRENT_TIMESTAMP())\n" +
                "GROUP  BY 1, 2\n" +
                "ORDER  BY cs_credits DESC\n" +
                "LIMIT  20;"
              },
              { t: "table", headers: ["Tier", "Approach to serverless spend", "Weakness"], rows: [
                ["Naive", "Turn features on because they are “managed”", "Clustering and MV refresh on high-churn tables burn credits invisibly"],
                ["Solid", "Weekly review of METERING_HISTORY by service type", "Catches spend after the fact, no owner per object"],
                ["Standout", "Budgets per project including serverless objects, tagged owners, and a justification for every clustering key and MV", "Needs tagging discipline up front"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> “the warehouse bill is flat but credits went up”, “cloud services line on the invoice”, “Snowpipe costs”, “should we cluster this table”. Look outside warehouses and do the 10% arithmetic." },
              { t: "quiz", id: "cost-model" },
              { t: "note", variant: "key", html: "<strong>Serverless spend lives outside warehouses and outside resource monitors.</strong> Cloud services are billed only above 10% of the day's warehouse compute, so tiny, chatty workloads are the ones that pay for it." }
            ]
          }
        ]
      },
      {
        id: "control",
        name: "Guardrails",
        icon: "shield",
        lessons: [
          {
            id: "resource-monitors",
            title: "Resource monitors and budgets",
            summary: "Resource monitors hard-stop warehouses at credit thresholds; budgets watch any object, including serverless, and alert.",
            minutes: 11,
            tags: ["resource-monitors", "budgets", "guardrails"],
            blocks: [
              { t: "p", html: "Mental model: a <strong>resource monitor is a circuit breaker for warehouses</strong>, a <strong>budget is a smoke alarm for anything that spends credits</strong>. You want both: breakers for runaway compute, alarms for the serverless and AI spend breakers cannot see." },
              { t: "code", lang: "sql", code:
                "USE ROLE ACCOUNTADMIN;\n" +
                "\n" +
                "CREATE OR REPLACE RESOURCE MONITOR rm_etl_monthly\n" +
                "  WITH CREDIT_QUOTA    = 600\n" +
                "       FREQUENCY       = MONTHLY\n" +
                "       START_TIMESTAMP = IMMEDIATELY\n" +
                "       NOTIFY_USERS    = (FINOPS_BOT, DATA_PLATFORM_LEAD)\n" +
                "  TRIGGERS ON  75 PERCENT DO NOTIFY\n" +
                "           ON 100 PERCENT DO SUSPEND\n" +
                "           ON 110 PERCENT DO SUSPEND_IMMEDIATE;\n" +
                "\n" +
                "ALTER WAREHOUSE etl_wh SET RESOURCE_MONITOR = rm_etl_monthly;\n" +
                "\n" +
                "-- let the platform team view and tune it without ACCOUNTADMIN\n" +
                "GRANT MONITOR, MODIFY ON RESOURCE MONITOR rm_etl_monthly TO ROLE platform_ops;"
              },
              { t: "table", headers: ["Action", "Behaviour", "Use it for"], rows: [
                ["NOTIFY", "Email/notification only", "Early warning at 50–90%"],
                ["SUSPEND", "Stops new queries, lets running statements finish", "The normal stop at 100%"],
                ["SUSPEND_IMMEDIATE", "Suspends and cancels running statements", "Hard backstop, typically above 100%"]
              ] },
              { t: "p", html: "One monitor can govern many warehouses, but a warehouse has at most one monitor. An account-level monitor (<code class='tok'>ALTER ACCOUNT SET RESOURCE_MONITOR = ...</code>) caps the sum of all warehouses. Thresholds above 100% are legal and useful, because SUSPEND lets in-flight work run on. Monitors are evaluated periodically, so some overshoot is normal even with SUSPEND_IMMEDIATE." },
              { t: "widget", id: "monitorLab" },
              { t: "note", variant: "trap", html: "Monitors govern <strong>warehouses only</strong>. Snowpipe, automatic clustering, search optimization, serverless tasks, QAS and Cortex are invisible to them. A monitor that never fires proves nothing about total spend." },
              { t: "h", text: "Budgets: alerts across serverless too" },
              { t: "code", lang: "sql", code:
                "-- A custom budget for one project, covering warehouses AND serverless objects\n" +
                "CREATE SNOWFLAKE.CORE.BUDGET IF NOT EXISTS finops_db.budgets.orders_pipeline();\n" +
                "\n" +
                "CALL finops_db.budgets.orders_pipeline!SET_SPENDING_LIMIT(800);\n" +
                "CALL finops_db.budgets.orders_pipeline!ADD_RESOURCE(\n" +
                "  SYSTEM$REFERENCE('WAREHOUSE', 'ORDERS_WH', 'SESSION', 'APPLYBUDGET'));\n" +
                "CALL finops_db.budgets.orders_pipeline!ADD_RESOURCE(\n" +
                "  SYSTEM$REFERENCE('DATABASE', 'ORDERS_DB', 'SESSION', 'APPLYBUDGET'));\n" +
                "CALL finops_db.budgets.orders_pipeline!SET_EMAIL_NOTIFICATIONS(\n" +
                "  'finops_email_int', 'finops@acme.example');"
              },
              { t: "p", html: "Budgets track a monthly spending limit for a group of objects (or the whole account) and notify when projected spend is on course to exceed it. They do not suspend warehouses on their own, so pair them with monitors for anything that must hard-stop. Objects can also be added to budgets by tag, which scales better than listing them one by one." },
              { t: "h2", text: "Per-statement guardrails" },
              { t: "code", lang: "sql", code:
                "-- Kill statements that run or queue too long on this warehouse\n" +
                "ALTER WAREHOUSE adhoc_wh SET\n" +
                "  STATEMENT_TIMEOUT_IN_SECONDS        = 1800,\n" +
                "  STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 600,\n" +
                "  AUTO_SUSPEND                        = 60,\n" +
                "  MAX_CLUSTER_COUNT                   = 2;"
              },
              { t: "table", headers: ["Tier", "Guardrail design", "Gap"], rows: [
                ["Naive", "One account-level monitor at 100% SUSPEND", "Stops production ETL along with the runaway ad hoc query"],
                ["Solid", "Per-workload monitors with NOTIFY / SUSPEND / SUSPEND_IMMEDIATE, plus statement timeouts", "Serverless and AI spend uncovered"],
                ["Standout", "Monitors for warehouses, tag-driven budgets for projects including serverless, timeouts on ad hoc warehouses, and a documented owner to page", "Needs a tagging standard and on-call routing"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> “stop a runaway query from burning the month”, “cap a team's spend”, “alert before we hit the commitment”, “Snowpipe costs not caught”. Monitors for hard stops on warehouses; budgets for everything else." },
              { t: "note", variant: "key", html: "<strong>Monitors stop warehouses; budgets watch everything.</strong> Order triggers notify &lt; suspend &lt; suspend_immediate, and isolate workloads so one breaker does not take production down with ad hoc." }
            ]
          },
          {
            id: "right-sizing",
            title: "Right-sizing warehouses",
            summary: "Read the symptom (spilling, queuing, idle, tiny queries) and pull the matching lever instead of guessing a size.",
            minutes: 12,
            tags: ["warehouses", "sizing", "multi-cluster", "auto-suspend"],
            blocks: [
              { t: "p", html: "Mental model: <strong>size buys memory and parallelism for one query; clusters buy concurrency; auto-suspend buys idle savings at the price of a cold cache</strong>. Right-sizing is matching each symptom to the lever that fixes it, then measuring cost per job before and after." },
              { t: "table", headers: ["Symptom", "Evidence", "Lever", "Cost direction"], rows: [
                ["Remote spilling", "<code class='tok'>BYTES_SPILLED_TO_REMOTE_STORAGE</code> &gt; 0", "Size up one step (or fix the exploding join)", "Often cheaper per job"],
                ["Queuing, fast queries", "<code class='tok'>QUEUED_OVERLOAD_TIME</code>, <code class='tok'>AVG_QUEUED_LOAD</code> &gt; 0", "Multi-cluster, modest max", "Higher, bounded"],
                ["Tiny queries, big warehouse", "Short execution, low bytes scanned", "Size down", "Lower"],
                ["One huge scan outlier", "QAS-eligible time in <code class='tok'>QUERY_ACCELERATION_ELIGIBLE</code>", "QAS or a dedicated warehouse", "Usually lower overall"],
                ["Idle tails", "Metered credits ≫ attributed credits", "Shorter AUTO_SUSPEND, consolidate schedules", "Lower"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Spilling and queuing per warehouse, last 14 days\n" +
                "SELECT warehouse_name,\n" +
                "       warehouse_size,\n" +
                "       COUNT(*)                                                AS queries,\n" +
                "       COUNT_IF(bytes_spilled_to_remote_storage > 0)          AS remote_spill_q,\n" +
                "       ROUND(SUM(bytes_spilled_to_local_storage)  / POWER(1024, 3), 1) AS local_spill_gb,\n" +
                "       ROUND(SUM(bytes_spilled_to_remote_storage) / POWER(1024, 3), 1) AS remote_spill_gb,\n" +
                "       ROUND(AVG(queued_overload_time) / 1000, 1)             AS avg_queue_s,\n" +
                "       ROUND(MEDIAN(execution_time) / 1000, 1)                AS p50_exec_s\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY\n" +
                "WHERE  start_time >= DATEADD(day, -14, CURRENT_TIMESTAMP())\n" +
                "  AND  warehouse_name IS NOT NULL\n" +
                "GROUP  BY 1, 2\n" +
                "ORDER  BY remote_spill_gb DESC, avg_queue_s DESC;"
              },
              { t: "widget", id: "rightSizeLab" },
              { t: "h", text: "Bigger can be cheaper" },
              { t: "p", html: "Because each step doubles the rate, the break-even is simple: a size-up pays for itself when runtime falls by at least half. Spilling queries often fall by much more, because remote spill is dramatically slower than memory. Queries that are already fast, or dominated by a single-threaded step, rarely halve, so upsizing them is pure cost." },
              { t: "code", lang: "text", code:
                "M  (4 cr/h) 40 min, remote spill   -> 4  * 40/60 = 2.67 cr\n" +
                "L  (8 cr/h) 12 min, no spill       -> 8  * 12/60 = 1.60 cr   (cheaper AND faster)\n" +
                "XL (16 cr/h) 9 min                 -> 16 *  9/60 = 2.40 cr   (diminishing returns)"
              },
              { t: "h2", text: "Idle waste and auto-suspend" },
              { t: "code", lang: "sql", code:
                "-- Metered vs attributed compute = idle waste per warehouse (last 30 days)\n" +
                "WITH metered AS (\n" +
                "  SELECT warehouse_name, SUM(credits_used_compute) AS metered_cr\n" +
                "  FROM   SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY\n" +
                "  WHERE  start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "  GROUP  BY 1),\n" +
                "attributed AS (\n" +
                "  SELECT warehouse_name, SUM(credits_attributed_compute) AS attributed_cr\n" +
                "  FROM   SNOWFLAKE.ACCOUNT_USAGE.QUERY_ATTRIBUTION_HISTORY\n" +
                "  WHERE  start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "  GROUP  BY 1)\n" +
                "SELECT m.warehouse_name,\n" +
                "       ROUND(m.metered_cr, 1)                                   AS metered_cr,\n" +
                "       ROUND(COALESCE(a.attributed_cr, 0), 1)                   AS attributed_cr,\n" +
                "       ROUND(100 * (1 - COALESCE(a.attributed_cr, 0) / NULLIF(m.metered_cr, 0)), 1) AS idle_pct\n" +
                "FROM   metered m LEFT JOIN attributed a USING (warehouse_name)\n" +
                "ORDER  BY m.metered_cr - COALESCE(a.attributed_cr, 0) DESC;"
              },
              { t: "note", variant: "warn", html: "Shorter auto-suspend is not free: a suspended warehouse loses its local disk cache, so BI warehouses that reread the same tables can get slower and even costlier. ETL warehouses with no reuse between runs can go to 60 seconds; interactive BI often sits better at a few minutes." },
              { t: "h2", text: "Check QAS before resizing for an outlier" },
              { t: "code", lang: "sql", code:
                "SELECT SYSTEM$ESTIMATE_QUERY_ACCELERATION('<query_id>');\n" +
                "\n" +
                "SELECT warehouse_name,\n" +
                "       COUNT(*) AS eligible_queries,\n" +
                "       ROUND(SUM(eligible_query_acceleration_time) / 3600, 2) AS eligible_hours\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.QUERY_ACCELERATION_ELIGIBLE\n" +
                "WHERE  start_time >= DATEADD(day, -7, CURRENT_TIMESTAMP())\n" +
                "GROUP  BY 1\n" +
                "ORDER  BY eligible_hours DESC;"
              },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> “queries are slow, should we go bigger”, “dashboards queue at 9 a.m.”, “warehouse is always on”, “one report is killing us”. Name the symptom, then the lever: spill → size, queue → clusters, idle → suspend, outlier → QAS or isolate." },
              { t: "quiz", id: "cost-control" },
              { t: "note", variant: "key", html: "<strong>Size for memory, cluster for concurrency, suspend for idle.</strong> A size-up that more than halves runtime is a saving; measure cost per job, not credits per hour." }
            ]
          }
        ]
      },
      {
        id: "observe",
        name: "Cost Observability",
        icon: "map",
        lessons: [
          {
            id: "account-usage",
            title: "ACCOUNT_USAGE vs INFORMATION_SCHEMA",
            summary: "ACCOUNT_USAGE is the year-long, account-wide, slightly delayed ledger; INFORMATION_SCHEMA is the real-time, short-memory, per-database view.",
            minutes: 9,
            tags: ["account-usage", "information-schema", "observability"],
            blocks: [
              { t: "p", html: "Mental model: <strong>ACCOUNT_USAGE is the accounting ledger, INFORMATION_SCHEMA is the dashboard gauge</strong>. Investigations and trends run on the ledger; “what is burning right now” runs on the gauge." },
              { t: "table", headers: ["Property", "SNOWFLAKE.ACCOUNT_USAGE", "&lt;db&gt;.INFORMATION_SCHEMA"], rows: [
                ["Latency", "Delayed, roughly 45 minutes to 3 hours depending on the view", "Near real-time"],
                ["Retention", "365 days", "Short: typically 7–14 days for history functions, longer for some metering"],
                ["Scope", "Whole account", "One database (plus account-level table functions)"],
                ["Dropped objects", "Included, with deleted timestamps", "Live objects only"],
                ["Access", "IMPORTED PRIVILEGES on SNOWFLAKE or its database roles", "Any role, filtered by its privileges"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Give a FinOps role read access to usage views without ACCOUNTADMIN\n" +
                "USE ROLE ACCOUNTADMIN;\n" +
                "GRANT DATABASE ROLE SNOWFLAKE.USAGE_VIEWER TO ROLE finops_analyst;\n" +
                "-- or the broader legacy grant:\n" +
                "-- GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE finops_analyst;"
              },
              { t: "h", text: "Real-time: INFORMATION_SCHEMA table functions" },
              { t: "code", lang: "sql", code:
                "-- What ran on this warehouse in the last hour, right now\n" +
                "SELECT query_id, user_name, execution_status,\n" +
                "       total_elapsed_time / 1000 AS elapsed_s,\n" +
                "       LEFT(query_text, 80)      AS sql_head\n" +
                "FROM   TABLE(INFORMATION_SCHEMA.QUERY_HISTORY_BY_WAREHOUSE(\n" +
                "         WAREHOUSE_NAME   => $target_wh,\n" +
                "         END_TIME_RANGE_START => DATEADD(hour, -1, CURRENT_TIMESTAMP()),\n" +
                "         RESULT_LIMIT     => 1000))\n" +
                "ORDER  BY total_elapsed_time DESC;\n" +
                "\n" +
                "-- Hourly credits for the last day\n" +
                "SELECT start_time, warehouse_name, credits_used\n" +
                "FROM   TABLE(INFORMATION_SCHEMA.WAREHOUSE_METERING_HISTORY(\n" +
                "         DATEADD(day, -1, CURRENT_TIMESTAMP())))\n" +
                "ORDER  BY start_time DESC;"
              },
              { t: "note", variant: "tip", html: "Set the warehouse name once with <code class='tok'>SET target_wh = 'ETL_WH';</code> (or pass it from your tooling) instead of pasting literals across a runbook. The same script then works in every environment." },
              { t: "h", text: "Trends: ACCOUNT_USAGE views you will use weekly" },
              { t: "ul", items: [
                "<code class='tok'>WAREHOUSE_METERING_HISTORY</code> — hourly credits per warehouse, compute and cloud services.",
                "<code class='tok'>METERING_DAILY_HISTORY</code> — daily credits by service type, with the cloud services adjustment.",
                "<code class='tok'>QUERY_HISTORY</code> / <code class='tok'>QUERY_ATTRIBUTION_HISTORY</code> — per-query performance and attributed compute credits.",
                "<code class='tok'>TABLE_STORAGE_METRICS</code>, <code class='tok'>DATABASE_STORAGE_USAGE_HISTORY</code>, <code class='tok'>STAGE_STORAGE_USAGE_HISTORY</code> — storage by object and over time.",
                "<code class='tok'>WAREHOUSE_LOAD_HISTORY</code>, <code class='tok'>WAREHOUSE_EVENTS_HISTORY</code> — running vs queued load, resumes and resizes.",
                "<code class='tok'>SNOWFLAKE.ORGANIZATION_USAGE.*</code> — the same across every account in the org, with currency."
              ] },
              { t: "code", lang: "sql", code:
                "-- Week-over-week warehouse credits\n" +
                "SELECT warehouse_name,\n" +
                "       SUM(IFF(start_time >= DATEADD(day, -7,  CURRENT_TIMESTAMP()), credits_used, 0)) AS this_week,\n" +
                "       SUM(IFF(start_time <  DATEADD(day, -7,  CURRENT_TIMESTAMP()), credits_used, 0)) AS last_week\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY\n" +
                "WHERE  start_time >= DATEADD(day, -14, CURRENT_TIMESTAMP())\n" +
                "GROUP  BY 1\n" +
                "ORDER  BY this_week - last_week DESC;"
              },
              { t: "note", variant: "trap", html: "Do not alert on the last hour from ACCOUNT_USAGE: the rows may not have landed yet, so a quiet hour can be a latency artefact. Alerting windows should end a few hours ago, or use INFORMATION_SCHEMA for the live edge." },
              { t: "compare",
                bad: { title: "Querying usage views ad hoc", items: ["Different filters every time", "365-day horizon lost forever", "Each analyst scans the same large views"] },
                good: { title: "Snapshot into a FinOps schema", items: ["Daily task copies the views into owned tables", "History beyond a year for budgeting", "One governed source for dashboards"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> “right now”, “in the last few minutes” → INFORMATION_SCHEMA. “Last quarter”, “trend”, “dropped tables”, “across all databases” → ACCOUNT_USAGE. “Across accounts”, “in dollars” → ORGANIZATION_USAGE." },
              { t: "note", variant: "key", html: "<strong>Gauge for now, ledger for history.</strong> INFORMATION_SCHEMA is real-time but short and per-database; ACCOUNT_USAGE is delayed but account-wide, includes dropped objects and keeps 365 days." }
            ]
          },
          {
            id: "attribution",
            title: "Attributing cost to teams and queries",
            summary: "Combine QUERY_ATTRIBUTION_HISTORY, query tags, object tags and WAREHOUSE_METERING_HISTORY to give every credit an owner, including idle time.",
            minutes: 12,
            tags: ["attribution", "query-tags", "object-tags", "showback"],
            blocks: [
              { t: "p", html: "Mental model: <strong>a credit has three possible owners — the warehouse it ran on, the query that used it, and the label you attached</strong>. Good attribution uses all three: object tags for shared warehouses' owners, query tags for pipelines, and attributed query credits for the hot spots." },
              { t: "table", headers: ["Lens", "Source", "Answers", "Blind spot"], rows: [
                ["Warehouse", "<code class='tok'>WAREHOUSE_METERING_HISTORY</code> + object tags", "Which team's warehouses cost what", "Shared warehouses blur owners"],
                ["Query", "<code class='tok'>QUERY_ATTRIBUTION_HISTORY</code>", "Which queries and users consumed compute", "Excludes idle time and very short queries"],
                ["Label", "<code class='tok'>QUERY_TAG</code> in session", "Which pipeline, model or service", "Only as good as the tagging discipline"]
              ] },
              { t: "h", text: "Tag the warehouses" },
              { t: "code", lang: "sql", code:
                "CREATE TAG IF NOT EXISTS governance.tags.cost_center\n" +
                "  ALLOWED_VALUES 'finance', 'marketing', 'platform', 'data-science';\n" +
                "\n" +
                "ALTER WAREHOUSE finance_bi_wh SET TAG governance.tags.cost_center = 'finance';\n" +
                "\n" +
                "-- Monthly warehouse credits by cost center\n" +
                "SELECT COALESCE(t.tag_value, 'untagged')     AS cost_center,\n" +
                "       DATE_TRUNC(month, m.start_time)       AS month,\n" +
                "       ROUND(SUM(m.credits_used), 1)         AS credits\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY m\n" +
                "LEFT   JOIN SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES t\n" +
                "       ON  t.domain      = 'WAREHOUSE'\n" +
                "       AND t.object_name = m.warehouse_name\n" +
                "       AND t.tag_name    = 'COST_CENTER'\n" +
                "WHERE  m.start_time >= DATEADD(month, -3, CURRENT_TIMESTAMP())\n" +
                "GROUP  BY 1, 2\n" +
                "ORDER  BY 2 DESC, 3 DESC;"
              },
              { t: "h", text: "Tag the queries" },
              { t: "code", lang: "sql", code:
                "-- In a service or orchestrator session; keep it JSON so it parses later\n" +
                "ALTER SESSION SET QUERY_TAG = '{\"team\":\"finance\",\"pipeline\":\"orders_daily\",\"env\":\"stg\"}';"
              },
              { t: "code", lang: "text", code:
                "# dbt_project.yml — tag every model's queries\n" +
                "models:\n" +
                "  analytics:\n" +
                "    +query_tag: \"dbt-analytics-{{ target.name }}\""
              },
              { t: "note", variant: "tip", html: "Put the environment in the tag from a variable (<code class='tok'>{{ target.name }}</code>, an env var in your service), never a literal. Shared warehouses across environments then still split cleanly." },
              { t: "h", text: "Attribute credits to queries" },
              { t: "code", lang: "sql", code:
                "-- Credits by pipeline (query tag), last 30 days, with acceleration\n" +
                "SELECT COALESCE(TRY_PARSE_JSON(query_tag):pipeline::STRING, NULLIF(query_tag, ''), 'untagged') AS pipeline,\n" +
                "       COUNT(*)                                        AS queries,\n" +
                "       ROUND(SUM(credits_attributed_compute), 2)       AS compute_cr,\n" +
                "       ROUND(SUM(COALESCE(credits_used_query_acceleration, 0)), 2) AS qas_cr\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.QUERY_ATTRIBUTION_HISTORY\n" +
                "WHERE  start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "GROUP  BY 1\n" +
                "ORDER  BY compute_cr DESC;\n" +
                "\n" +
                "-- Most expensive recurring query shapes\n" +
                "SELECT query_parameterized_hash,\n" +
                "       COUNT(*)                                  AS runs,\n" +
                "       ROUND(SUM(credits_attributed_compute), 2) AS credits,\n" +
                "       ANY_VALUE(warehouse_name)                 AS sample_wh\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.QUERY_ATTRIBUTION_HISTORY\n" +
                "WHERE  start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "GROUP  BY 1\n" +
                "ORDER  BY credits DESC\n" +
                "LIMIT  20;"
              },
              { t: "note", variant: "warn", html: "Attributed credits will not sum to metered credits. Idle time is unattributed, very short queries may be excluded, and cloud services are not in the attributed compute figure. Report the gap explicitly as “idle / unallocated” rather than spreading it silently." },
              { t: "p", html: "For stored procedures and task graphs, group by <code class='tok'>root_query_id</code> to charge all child statements to the calling job. Serverless features are attributed by object (pipe, table, task) in their own history views, so join those to object tags to finish the picture." },
              { t: "table", headers: ["Tier", "Attribution model", "Weakness"], rows: [
                ["Naive", "Split the bill evenly across teams", "No incentive to optimise; arguments every month"],
                ["Solid", "Dedicated warehouses per team, tagged; showback by warehouse", "Shared warehouses and serverless spend unallocated"],
                ["Standout", "Warehouse tags + JSON query tags + attributed query credits + serverless by object tag, idle shown as its own line", "Requires enforced tagging in every client and pipeline"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> “chargeback”, “showback”, “which team spends the most”, “cost per dashboard / model / pipeline”, “shared warehouse”. Reach for tags plus QUERY_ATTRIBUTION_HISTORY, and call out idle as unallocated." },
              { t: "note", variant: "key", html: "<strong>Tag warehouses for owners, tag sessions for pipelines, attribute queries for hot spots.</strong> The metered-minus-attributed gap is idle time: show it, don't hide it." }
            ]
          },
          {
            id: "finops-playbook",
            title: "A FinOps playbook for Snowflake",
            summary: "A repeatable loop of visibility, guardrails, optimisation and governance that keeps credits tied to value.",
            minutes: 12,
            tags: ["finops", "playbook", "storage", "governance"],
            blocks: [
              { t: "p", html: "Mental model: <strong>FinOps is a loop, not a project</strong>. See the spend, cap the blast radius, fix the biggest line, make the fix stick, repeat monthly. The order matters: optimising without visibility fixes the wrong thing; visibility without guardrails lets the next runaway through." },
              { t: "ol", items: [
                "<strong>See it:</strong> daily snapshot of metering, attribution and storage views into a FinOps schema; tag every warehouse and project database.",
                "<strong>Cap it:</strong> per-workload resource monitors, budgets covering serverless, statement timeouts on ad hoc warehouses.",
                "<strong>Fix the top line:</strong> the five most expensive warehouses, recurring query shapes and serverless objects each month.",
                "<strong>Make it stick:</strong> warehouse creation via code with mandatory tags, auto-suspend defaults and a monitor; review in CI.",
                "<strong>Report value:</strong> cost per pipeline, per dashboard, per thousand queries — trends, not just totals."
              ] },
              { t: "h", text: "Storage: the quiet line" },
              { t: "code", lang: "sql", code:
                "-- Where storage really goes, including churn and clones\n" +
                "SELECT table_catalog, table_schema, table_name,\n" +
                "       is_transient,\n" +
                "       ROUND(active_bytes             / POWER(1024, 4), 3) AS active_tb,\n" +
                "       ROUND(time_travel_bytes        / POWER(1024, 4), 3) AS time_travel_tb,\n" +
                "       ROUND(failsafe_bytes           / POWER(1024, 4), 3) AS failsafe_tb,\n" +
                "       ROUND(retained_for_clone_bytes / POWER(1024, 4), 3) AS clone_tb,\n" +
                "       deleted\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS\n" +
                "ORDER  BY time_travel_bytes + failsafe_bytes + retained_for_clone_bytes DESC\n" +
                "LIMIT  25;"
              },
              { t: "ul", items: [
                "High <code class='tok'>failsafe_tb</code> on staging tables that are truncated and reloaded daily → make them <strong>transient</strong> (no Fail-safe, max 1 day Time Travel).",
                "High <code class='tok'>time_travel_tb</code> with 30–90 day retention on churny tables → lower <code class='tok'>DATA_RETENTION_TIME_IN_DAYS</code> where recovery needs allow.",
                "High <code class='tok'>clone_tb</code> → find and drop forgotten clones and backup copies once their purpose has passed.",
                "Large internal stages → purge loaded files (<code class='tok'>PURGE = TRUE</code> or <code class='tok'>REMOVE</code>)."
              ] },
              { t: "h", text: "Unused objects" },
              { t: "code", lang: "sql", code:
                "-- Tables nobody has read in 90 days (ACCESS_HISTORY needs Enterprise+)\n" +
                "WITH reads AS (\n" +
                "  SELECT f.value:objectName::STRING AS fq_name,\n" +
                "         MAX(ah.query_start_time)    AS last_read\n" +
                "  FROM   SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY ah,\n" +
                "         LATERAL FLATTEN(input => ah.base_objects_accessed) f\n" +
                "  WHERE  ah.query_start_time >= DATEADD(day, -90, CURRENT_TIMESTAMP())\n" +
                "  GROUP  BY 1)\n" +
                "SELECT t.table_catalog || '.' || t.table_schema || '.' || t.table_name AS fq_name,\n" +
                "       ROUND(t.active_bytes / POWER(1024, 3), 1) AS active_gb\n" +
                "FROM   SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS t\n" +
                "LEFT   JOIN reads r\n" +
                "       ON r.fq_name = t.table_catalog || '.' || t.table_schema || '.' || t.table_name\n" +
                "WHERE  t.deleted = FALSE AND r.fq_name IS NULL\n" +
                "ORDER  BY t.active_bytes DESC\n" +
                "LIMIT  50;"
              },
              { t: "note", variant: "warn", html: "Before dropping or retyping anything shared, take a backup clone named with a dated convention (for example <code class='tok'>&lt;TABLE&gt;_BKP_&lt;DDMON&gt;</code>) and give it an expiry. Then put the backup itself on the clean-up list, or it becomes next quarter's clone-retained storage." },
              { t: "h", text: "Make good defaults the only path" },
              { t: "code", lang: "sql", code:
                "-- Template rendered by the deploy tool (schemachange-style {{ vars }})\n" +
                "CREATE WAREHOUSE IF NOT EXISTS {{ wh_name }}\n" +
                "  WAREHOUSE_SIZE      = 'XSMALL'\n" +
                "  AUTO_SUSPEND        = 60\n" +
                "  AUTO_RESUME         = TRUE\n" +
                "  INITIALLY_SUSPENDED = TRUE\n" +
                "  STATEMENT_TIMEOUT_IN_SECONDS = 3600;\n" +
                "ALTER WAREHOUSE {{ wh_name }} SET RESOURCE_MONITOR = {{ rm_name }};\n" +
                "ALTER WAREHOUSE {{ wh_name }} SET TAG governance.tags.cost_center = '{{ cost_center }}';"
              },
              { t: "table", headers: ["Level", "How this scores at each level"], rows: [
                ["Mid", "Knows sizes and credits, sets auto-suspend, can read WAREHOUSE_METERING_HISTORY"],
                ["Senior", "Splits the bill by meter, diagnoses spill vs queue vs idle, sets monitors and budgets, uses query tags"],
                ["Staff", "Runs the loop as a programme: tagging standard enforced in code, unit cost per product, idle shown explicitly, storage churn and serverless reviewed, savings tracked against value"]
              ] },
              { t: "compare",
                bad: { title: "Cost-cutting sprint", items: ["One-off downsizing after a scary invoice", "Savings decay within a quarter", "Teams see FinOps as a tax"] },
                good: { title: "Continuous loop", items: ["Monthly top-5 review with owners", "Guardrails and defaults in code", "Unit costs trended next to usage"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> “reduce our Snowflake spend by 30%”, “set up FinOps”, “cost governance”, “storage keeps growing”. Answer with the loop — see, cap, fix the top line, make it stick, report unit cost — and start from the meter split." },
              { t: "quiz", id: "cost-observe" },
              { t: "note", variant: "key", html: "<strong>See it, cap it, fix the top line, make it stick.</strong> Snapshot the usage views, guard warehouses and serverless separately, chase storage churn and idle, and enforce defaults through code so savings do not decay." }
            ]
          }
        ]
      }
    ]
  };
})();
