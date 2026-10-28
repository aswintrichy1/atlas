/* =====================================================================
   GLACIER · Warehouses & Query Performance
   window.TRACKS.perf — modules: warehouses / tuning / accel

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
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

  function num(n, d) {
    if (!isFinite(n)) return "0";
    var s = Number(n).toFixed(d == null ? 0 : d);
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function rangeField(label, min, max, step, val, fmt, onChange) {
    var out = h("b", {}, fmt(val));
    var inp = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(val) });
    inp.addEventListener("input", function () {
      var v = parseFloat(inp.value);
      if (!isFinite(v)) v = val;
      out.textContent = fmt(v);
      onChange(v);
    });
    return h("label", { class: "w-field" }, h("span", {}, label + " "), out, inp);
  }
  function selectField(label, pairs, val, onChange) {
    var sel = h("select", {});
    for (var i = 0; i < pairs.length; i++) {
      var o = h("option", { value: pairs[i][0] }, pairs[i][1]);
      if (pairs[i][0] === val) o.setAttribute("selected", "selected");
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () { onChange(sel.value); });
    return h("label", { class: "w-field" }, h("span", {}, label + " "), sel);
  }
  function bar(label, frac, hex, right) {
    var pct = clamp(isFinite(frac) ? frac : 0, 0, 1) * 100;
    return h("div", { style: "margin:6px 0" },
      h("div", { style: "display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-dim)" },
        h("span", {}, label), h("span", { style: "color:var(--text)" }, right || "")),
      h("div", { style: "height:12px;border-radius:6px;background:var(--surface-2);border:1px solid var(--line);overflow:hidden" },
        h("div", { style: "height:100%;width:" + pct.toFixed(1) + "%;background:color-mix(in srgb, " + hex + " 55%, transparent)" })));
  }

  var SIZES = [["XS", 1], ["S", 2], ["M", 4], ["L", 8], ["XL", 16], ["2XL", 32], ["3XL", 64], ["4XL", 128], ["5XL", 256], ["6XL", 512]];
  function sizeIdx(code) {
    for (var i = 0; i < SIZES.length; i++) if (SIZES[i][0] === code) return i;
    return 2;
  }
  function sizePairs() {
    var out = [];
    for (var i = 0; i < SIZES.length; i++) out.push([SIZES[i][0], SIZES[i][0] + " (" + SIZES[i][1] + " cr/h)"]);
    return out;
  }

  var Widgets = {};

  /* ==================================================================
     1. warehouseCalc — credits, $/month and the auto-suspend idle tail
  ================================================================== */
  Widgets.warehouseCalc = function (mount) {
    shell(mount, "calculator", "Warehouse cost calculator",
      "Pick a size, how many minutes of real work the warehouse does per day, how many separate bursts that work arrives in, and the auto-suspend setting. Each burst resumes the warehouse, pays at least 60 seconds, and then idles for the auto-suspend window before it stops.");
    var st = { size: "M", minutes: 60, runs: 12, suspend: 300, price: 3 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function billedSeconds(activePerRun) {
      var perRun = Math.max(60, activePerRun + st.suspend);
      return Math.min(86400, st.runs * perRun);
    }
    function paint() {
      var i = sizeIdx(st.size), rate = SIZES[i][1];
      var runs = Math.max(1, st.runs);
      var activeTotal = st.minutes * 60;
      var activePerRun = activeTotal / runs;
      var billed = billedSeconds(activePerRun);
      var credits = billed / 3600 * rate;
      var idleCredits = Math.max(0, billed - activeTotal) / 3600 * rate;
      var idlePct = credits > 0 ? idleCredits / credits * 100 : 0;
      var monthly = credits * 30 * (isFinite(st.price) ? st.price : 0);

      var canDouble = i < SIZES.length - 1;
      var rate2 = canDouble ? SIZES[i + 1][1] : rate;
      var billed2 = canDouble ? billedSeconds(activePerRun / 2) : billed;
      var credits2 = billed2 / 3600 * rate2;
      var delta = credits > 0 ? (credits2 - credits) / credits * 100 : 0;

      clear(stage);
      var maxC = Math.max(credits, credits2, 0.0001);
      stage.appendChild(bar(st.size + ": useful work", (activeTotal / 3600 * rate) / maxC, "#818cf8", num(activeTotal / 3600 * rate, 2) + " cr"));
      stage.appendChild(bar(st.size + ": idle tail + 60 s minimums", idleCredits / maxC, "#f59e0b", num(idleCredits, 2) + " cr"));
      if (canDouble) {
        stage.appendChild(bar(SIZES[i + 1][0] + " (double size, half time): total", credits2 / maxC, "#22c55e", num(credits2, 2) + " cr"));
      }
      stage.appendChild(h("p", { style: "font-size:0.82rem;color:var(--text-dim);margin:8px 0 0" },
        "Assumes bursts are spaced further apart than the auto-suspend window and that the work scales linearly with size. Real queries scale less than perfectly, which makes the doubled warehouse a little dearer than shown."));

      clear(readout);
      readout.appendChild(ro("credits/day", num(credits, 2)));
      readout.appendChild(ro("$/month", "$" + num(monthly, 0)));
      readout.appendChild(ro("idle waste", num(idleCredits, 2) + " cr/day (" + num(idlePct, 0) + "%)"));
      readout.appendChild(ro("double size", canDouble ? num(credits2, 2) + " cr/day (" + (delta >= 0 ? "+" : "") + num(delta, 0) + "%)" : "already the largest size"));
    }

    var priceInp = h("input", { type: "number", min: "0.5", max: "10", step: "0.1", value: "3" });
    priceInp.addEventListener("input", function () {
      var v = parseFloat(priceInp.value);
      st.price = isFinite(v) && v >= 0 ? v : 0;
      paint();
    });
    mount.appendChild(h("div", { class: "widget-controls" },
      selectField("Size", sizePairs(), st.size, function (v) { st.size = v; paint(); }),
      rangeField("Work minutes/day", 1, 600, 1, st.minutes, function (v) { return v + " min"; }, function (v) { st.minutes = v; paint(); }),
      rangeField("Bursts (resumes)/day", 1, 96, 1, st.runs, function (v) { return String(v); }, function (v) { st.runs = v; paint(); }),
      rangeField("AUTO_SUSPEND", 60, 1800, 60, st.suspend, function (v) { return v + " s"; }, function (v) { st.suspend = v; paint(); }),
      h("label", { class: "w-field" }, h("span", {}, "$ per credit "), priceInp)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. scalingLab — multi-cluster scaling under Standard vs Economy
  ================================================================== */
  Widgets.scalingLab = function (mount) {
    shell(mount, "simulator", "Multi-cluster scaling lab",
      "Set how many queries arrive at once, the cluster bounds and the scaling policy. Each cluster is modelled as running 8 queries at a time (the default MAX_CONCURRENCY_LEVEL); anything beyond what the running clusters can hold queues.");
    var st = { q: 20, min: 1, max: 4, policy: "STANDARD", size: "M" };
    var PER = 8;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var lo = Math.max(1, Math.round(st.min));
      var hi = Math.max(lo, Math.round(st.max));
      var want = st.policy === "STANDARD" ? Math.ceil(st.q / PER) : Math.floor(st.q / PER);
      var running = clamp(Math.max(1, want), lo, hi);
      var capacity = running * PER;
      var queued = Math.max(0, st.q - capacity);
      var rate = SIZES[sizeIdx(st.size)][1];
      var mode = lo === hi ? "Maximized" : "Auto-scale";

      clear(stage);
      var row = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px" });
      for (var c = 1; c <= hi; c++) {
        var on = c <= running;
        var load = on ? Math.min(PER, Math.max(0, st.q - (c - 1) * PER)) : 0;
        row.appendChild(h("div", {
          style: "min-width:84px;padding:8px;border-radius:8px;font-size:0.8rem;border:1px solid " + (on ? "var(--accent-ink)" : "var(--line)") +
            ";background:" + (on ? "color-mix(in srgb, #818cf8 22%, transparent)" : "var(--surface-2)") + ";color:" + (on ? "var(--text)" : "var(--text-dim)")
        }, "Cluster " + c + (c <= lo ? " (min)" : ""), h("br", {}), on ? load + "/" + PER + " busy" : "stopped"));
      }
      stage.appendChild(row);
      stage.appendChild(bar("Queued queries", queued / Math.max(1, st.q), "#f59e0b", String(queued)));
      stage.appendChild(h("p", { style: "font-size:0.82rem;color:var(--text-dim);margin:8px 0 0" },
        st.policy === "STANDARD"
          ? "Standard favours latency: it starts another cluster as soon as queries begin to queue."
          : "Economy favours credits: it only adds a cluster when there is enough sustained load to keep it busy, so partial overflow waits in the queue."));

      clear(readout);
      readout.appendChild(ro("mode", mode));
      readout.appendChild(ro("clusters running", running + " of max " + hi));
      readout.appendChild(ro("queued", queued));
      readout.appendChild(ro("credits/hour", num(running * rate, 0)));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      rangeField("Concurrent queries", 1, 96, 1, st.q, function (v) { return String(v); }, function (v) { st.q = v; paint(); }),
      rangeField("MIN_CLUSTER_COUNT", 1, 10, 1, st.min, function (v) { return String(v); }, function (v) { st.min = v; paint(); }),
      rangeField("MAX_CLUSTER_COUNT", 1, 10, 1, st.max, function (v) { return String(v); }, function (v) { st.max = v; paint(); }),
      selectField("Size", [["S", "S (2 cr/h)"], ["M", "M (4 cr/h)"], ["L", "L (8 cr/h)"], ["XL", "XL (16 cr/h)"]], st.size, function (v) { st.size = v; paint(); }),
      segment([["STANDARD", "Standard"], ["ECONOMY", "Economy"]], 0, function (v) { st.policy = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. cacheLab — which caching layer answers this query?
  ================================================================== */
  var CACHE_SCENARIOS = [
    { id: "rerun", label: "Same query rerun, data unchanged, same role",
      lit: ["result"], answer: "Result cache", wh: "No (can stay suspended)",
      why: "The text matches a persisted result from the last 24 hours, the underlying micro-partitions have not changed and the role still holds the privileges. Cloud services returns the stored result without touching a warehouse." },
    { id: "changed", label: "Same query rerun after new rows were loaded",
      lit: ["local", "remote"], answer: "Local disk cache + remote storage",
      why: "Any DML on a referenced table invalidates the persisted result. The warehouse re-executes: unchanged micro-partitions it read recently come from its local SSD cache, the newly written ones come from remote storage." },
    { id: "otherwh", label: "Same query, unchanged data, run on a different warehouse",
      lit: ["result"], answer: "Result cache", wh: "No",
      why: "Persisted results live in the cloud services layer and are shared across warehouses and users, so a different warehouse still reuses the result as long as the role has access to every object." },
    { id: "resumed", label: "New query on a warehouse that just resumed from suspend",
      lit: ["remote"], answer: "Remote storage (cold)",
      why: "Suspending releases the compute nodes, and the local disk cache goes with them. The first queries after resume read from remote storage and repopulate the SSD cache; that is the cost of an aggressive auto-suspend." },
    { id: "nondet", label: "Query uses CURRENT_TIMESTAMP()",
      lit: ["local", "remote"], answer: "Warehouse execution (local cache if warm)",
      why: "Non-deterministic functions such as CURRENT_TIMESTAMP, RANDOM or UUID_STRING disqualify result reuse because the answer could differ on each run. The warehouse executes it, reading warm partitions from local SSD where it can." },
    { id: "priv", label: "Same text, but the current role lacks SELECT on a table",
      lit: [], answer: "Nothing: the query fails authorization",
      why: "Result reuse checks privileges first. A cached result is never a back door around access control, so the query errors exactly as it would with an empty cache." },
    { id: "count", label: "SELECT COUNT(*) FROM big_table (no filter)",
      lit: ["result"], answer: "Metadata in cloud services", wh: "No",
      why: "Row counts and many MIN/MAX values are kept as micro-partition metadata, so the optimizer answers from metadata without scanning data or using a warehouse." },
    { id: "nocache", label: "Rerun with USE_CACHED_RESULT = FALSE on a warm warehouse",
      lit: ["local"], answer: "Local disk cache",
      why: "Disabling result reuse forces execution, which is what you do when benchmarking. On a warm warehouse the micro-partitions are still on local SSD, so PERCENTAGE_SCANNED_FROM_CACHE is high and the run is still faster than a cold one." }
  ];

  Widgets.cacheLab = function (mount) {
    shell(mount, "scenario", "Which cache answers?",
      "Pick a scenario. The layer that serves the data lights up, and the readout explains why the other layers could not help.");
    var cur = CACHE_SCENARIOS[0];
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var LAYERS = [
      ["result", "Cloud services: result cache + metadata", "24 h reuse window, shared by every warehouse"],
      ["local", "Warehouse local disk cache (SSD)", "lives only while the warehouse is running"],
      ["remote", "Remote storage: micro-partitions", "the durable copy; slowest to read"]
    ];
    function paint() {
      clear(stage);
      for (var i = 0; i < LAYERS.length; i++) {
        var on = cur.lit.indexOf(LAYERS[i][0]) >= 0;
        stage.appendChild(h("div", {
          style: "margin:6px 0;padding:10px 12px;border-radius:8px;border:" + (on ? "2px solid var(--accent-ink)" : "1px solid var(--line)") +
            ";background:" + (on ? "color-mix(in srgb, #818cf8 22%, transparent)" : "var(--surface-2)")
        },
          h("div", { style: "font-weight:600;color:var(--text)" }, (on ? "\u25B6 " : "") + LAYERS[i][1]),
          h("div", { style: "font-size:0.8rem;color:var(--text-dim)" }, LAYERS[i][2])));
      }
      stage.appendChild(h("p", { style: "font-size:0.86rem;line-height:1.55;color:var(--text);margin:8px 0 0" }, cur.why));
      clear(readout);
      readout.appendChild(ro("answered by", cur.answer));
      readout.appendChild(ro("warehouse needed", cur.wh || (cur.lit.length ? "Yes" : "n/a")));
      readout.appendChild(ro("layers touched", cur.lit.length ? String(cur.lit.length) : "0"));
    }
    var pairs = [];
    for (var i = 0; i < CACHE_SCENARIOS.length; i++) pairs.push([CACHE_SCENARIOS[i].id, CACHE_SCENARIOS[i].label]);
    mount.appendChild(h("div", { class: "widget-controls" },
      selectField("Scenario", pairs, cur.id, function (v) {
        for (var j = 0; j < CACHE_SCENARIOS.length; j++) if (CACHE_SCENARIOS[j].id === v) cur = CACHE_SCENARIOS[j];
        paint();
      })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     4. spillLab — working set per node vs warehouse size
  ================================================================== */
  Widgets.spillLab = function (mount) {
    shell(mount, "model", "Spill predictor",
      "Set the working set of a memory-hungry operator (a big hash join, sort or window) and the warehouse size. The model spreads the work across nodes and checks it against ILLUSTRATIVE per-node memory and local SSD. Snowflake does not publish exact node specs; the shape of the curve is the lesson, not the gigabytes.");
    var MEM = 16, SSD = 200;
    var st = { gb: 120, size: "S" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function outcome(gb, nodes) {
      var per = gb / nodes;
      if (per <= MEM) return { per: per, kind: "No spill", slow: 1 };
      if (per <= MEM + SSD) return { per: per, kind: "Local spill (SSD)", slow: 1.3 + (per - MEM) / SSD * 1.7 };
      return { per: per, kind: "Remote spill (object storage)", slow: Math.min(20, 4 + (per - MEM - SSD) / SSD * 4) };
    }
    function paint() {
      var i = sizeIdx(st.size), nodes = SIZES[i][1];
      var o = outcome(st.gb, nodes);
      var fix = null;
      for (var j = i; j < SIZES.length; j++) {
        if (outcome(st.gb, SIZES[j][1]).kind === "No spill") { fix = j; break; }
      }
      clear(stage);
      var scale = Math.max(o.per, MEM + SSD) * 1.05;
      stage.appendChild(bar("Working set per node", o.per / scale, o.kind === "No spill" ? "#22c55e" : o.kind.indexOf("Local") === 0 ? "#f59e0b" : "#ef4444", num(o.per, 1) + " GB"));
      stage.appendChild(bar("Memory per node (illustrative)", MEM / scale, "#818cf8", MEM + " GB"));
      stage.appendChild(bar("Memory + local SSD per node (illustrative)", (MEM + SSD) / scale, "#64748b", (MEM + SSD) + " GB"));
      var cost = "";
      if (fix != null && fix > i) {
        var ratio = SIZES[fix][1] / nodes;
        var speedup = ratio * o.slow;
        cost = SIZES[fix][0] + " costs " + ratio + "x per hour but removes a " + num(o.slow, 1) + "x spill penalty on top of " + ratio + "x more nodes, for up to ~" + num(speedup, 0) + "x faster runs. When the speed-up beats the rate increase, the bigger size is also cheaper per query.";
      }
      stage.appendChild(h("p", { style: "font-size:0.82rem;color:var(--text-dim);margin:8px 0 0" },
        o.kind === "No spill" ? "Fits in memory. Sizing up would only buy parallelism, not relief from spilling." : (cost || "Even the largest size spills: shrink the working set (filter earlier, prune, fix row explosion) instead of buying compute.")));

      clear(readout);
      readout.appendChild(ro("per node", num(o.per, 1) + " GB"));
      readout.appendChild(ro("outcome", o.kind));
      readout.appendChild(ro("est. slowdown", num(o.slow, 1) + "x"));
      readout.appendChild(ro("smallest size with no spill", fix == null ? "none: reduce the data" : SIZES[fix][0]));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      rangeField("Operator working set", 2, 4000, 2, st.gb, function (v) { return v + " GB"; }, function (v) { st.gb = v; paint(); }),
      selectField("Size", sizePairs(), st.size, function (v) { st.size = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "perf-warehouses": {
      title: "Virtual warehouses checkpoint",
      sub: "Sizing, billing, multi-cluster scaling and workload isolation.",
      questions: [
        { q: "A Medium warehouse resumes, runs one 20-second query, and you have AUTO_SUSPEND = 60. Roughly how many credits does that resume cost?",
          options: ["About 0.02 credits (20 seconds at 4 credits/hour)", "Exactly 4 credits (a full hour minimum)", "Nothing, because the query finished in under a minute", "About 0.09 credits (80 seconds at 4 credits/hour)"],
          answer: 3,
          explain: "Billing is per second with a 60-second minimum per resume, and the warehouse keeps running through the idle window before suspending. Twenty seconds of work plus about 60 seconds of idle is roughly 80 seconds, and 80/3600 x 4 is about 0.09 credits. The 20-second answer forgets the idle tail; there is no hourly minimum." },
        { q: "A batch job takes 40 minutes on a Medium warehouse and parallelises well. What does moving it to a Large warehouse most likely do?",
          options: ["Doubles the cost and halves the runtime", "Halves the cost and keeps the runtime", "Keeps roughly the same credits while finishing in about 20 minutes", "Has no effect because only multi-cluster changes speed"],
          answer: 2,
          explain: "Large burns 8 credits/hour versus 4, but if the work scales linearly it runs for half as long, so credits are about the same and the job finishes sooner. That is why sizing up is often free for well-parallelised scans. It stops being free when the query cannot use the extra nodes or when idle tails dominate." },
        { q: "Your BI warehouse shows heavy queueing at 9 a.m. but each individual dashboard query is fast once it starts. What is the right lever?",
          options: ["Increase the warehouse size from M to 2XL", "Raise MAX_CLUSTER_COUNT so a multi-cluster warehouse can add clusters", "Lower AUTO_SUSPEND to 60 seconds", "Turn on search optimization for every dashboard table"],
          answer: 1,
          explain: "Queueing with fast individual queries is a concurrency problem, which multi-cluster warehouses solve by adding identical clusters. Sizing up makes each query faster but a single cluster still has finite concurrency slots. Auto-suspend and search optimization do not address queueing." },
        { q: "Which scaling policy only starts an extra cluster when the system estimates there is enough load to keep it busy for several minutes?",
          options: ["Economy", "Standard", "Maximized", "Auto-resume"],
          answer: 0,
          explain: "Economy trades some queueing for fewer, busier clusters, so it waits until a new cluster would be worth starting. Standard starts a cluster as soon as queries queue. Maximized is not a policy but the mode you get when MIN_CLUSTER_COUNT equals MAX_CLUSTER_COUNT." },
        { q: "You ALTER a running warehouse from Medium to XL while a long query is executing. What happens to that query?",
          options: ["It is cancelled and restarted on the new size", "It keeps running on the old resources; new and queued queries use the new size", "It immediately speeds up by four times", "The ALTER fails until the query finishes"],
          answer: 1,
          explain: "Resizing affects queries that start after the new resources are provisioned. In-flight queries finish on what they started with, so resizing mid-query is not a rescue for a query that is already spilling. Cancel and rerun if you need the bigger size for it." },
        { q: "Why do teams give ELT, BI and data-science workloads separate warehouses even when one big warehouse could hold them?",
          options: ["Snowflake forbids mixing workloads on one warehouse", "Separate warehouses share a local disk cache, so they are faster", "Warehouses cannot exceed 8 concurrent queries", "Isolation stops one workload's spikes from queueing another's and makes cost attributable per team"],
          answer: 3,
          explain: "Warehouses are independent compute that all read the same storage, so splitting them removes contention without copying data. Each warehouse also shows up separately in metering history, which makes chargeback trivial. Caches are per warehouse, not shared, and the concurrency level is configurable." }
      ]
    },
    "perf-tuning": {
      title: "Reading and tuning queries checkpoint",
      sub: "Query Profile, caching layers, spilling and optimizer-hostile SQL.",
      questions: [
        { q: "The Query Profile shows a TableScan with 'Partitions scanned 9,812 of 9,840'. The query filters on event_date. What is the most likely problem?",
          options: ["Pruning is not working because the table is not well clustered on event_date or the predicate defeats pruning", "The warehouse is too small", "The result cache is disabled", "There are too many columns in the SELECT"],
          answer: 0,
          explain: "Scanning nearly every partition despite a date filter means min/max metadata could not exclude partitions. Either rows for each date are spread across all partitions, or the predicate wraps the column in a way the optimizer cannot use. A bigger warehouse just scans the same waste faster." },
        { q: "Which statement about the result cache is correct?",
          options: ["It is stored on each warehouse's SSD and lost on suspend", "It needs the same warehouse to be reused", "It is held in cloud services for 24 hours, reusable across warehouses, and invalidated when underlying data changes", "It ignores role privileges so it is faster"],
          answer: 2,
          explain: "Persisted results live in the cloud services layer, so any warehouse, or none, can serve them. Reuse requires the same query text, unchanged data, no non-deterministic functions and a role with the needed privileges. The local disk cache is the per-warehouse one that disappears on suspend." },
        { q: "QUERY_HISTORY shows BYTES_SPILLED_TO_REMOTE_STORAGE of 300 GB for a nightly join. What is the strongest first response?",
          options: ["Ignore it; remote spill is normal", "Check for row explosion in the join and reduce the working set, then size up if it is genuinely that big", "Enable the result cache", "Add more clusters to the warehouse"],
          answer: 1,
          explain: "Remote spill means the operator overflowed memory and local SSD, which is often an order of magnitude slower. Start by confirming the join is not multiplying rows on a non-unique key and that filters run early. If the data is legitimately that large, a bigger size gives more memory per query; extra clusters do not help a single query." },
        { q: "The profile shows a Join with 2 million and 3 million input rows producing 1.8 billion output rows. What is this?",
          options: ["A healthy hash join", "Result cache poisoning", "A pruning failure", "An exploding join caused by duplicate keys on both sides"],
          answer: 3,
          explain: "Output far larger than either input is the signature of a many-to-many match on a key you believed was unique. Deduplicate one side first, for example with QUALIFY ROW_NUMBER(), or add the missing join column. Then the spill and runtime usually vanish together." },
        { q: "Which predicate is most likely to defeat partition pruning on a TIMESTAMP column created_at?",
          options: ["created_at >= '2026-01-01' AND created_at < '2026-02-01'", "created_at BETWEEN '2026-01-01' AND '2026-01-31 23:59:59'", "TO_VARCHAR(created_at, 'YYYY-MM') = '2026-01'", "created_at >= DATEADD(day, -7, CURRENT_TIMESTAMP())"],
          answer: 2,
          explain: "Turning the column into a formatted string hides it from min/max metadata, so the optimizer must evaluate every row. Range predicates on the raw column, including ones built from constant expressions, prune well. Rewrite transformations onto the literal side, not the column side." },
        { q: "Why might UNION be slower than UNION ALL on two large inputs that you know are disjoint?",
          options: ["UNION adds a deduplication step that has to hash or sort every row", "UNION skips pruning", "UNION ALL uses the result cache", "UNION ALL runs on a separate cluster"],
          answer: 0,
          explain: "UNION means distinct, so the engine must compare all rows from both branches, which costs memory and can spill. When the branches cannot overlap, that work is pure waste. UNION ALL simply concatenates." }
      ]
    },
    "perf-accel": {
      title: "Acceleration services checkpoint",
      sub: "Search optimization, query acceleration, materialized views and dynamic tables.",
      questions: [
        { q: "Support agents look up single orders by a high-cardinality order_uuid in a 20 TB table that is clustered by date. Which feature fits best?",
          options: ["A bigger warehouse", "A materialized view grouped by date", "Query Acceleration Service", "Search optimization ON EQUALITY(order_uuid)"],
          answer: 3,
          explain: "Point lookups on a column the table is not clustered by scan almost every partition. Search optimization maintains a search access path that lets the engine skip partitions that cannot contain the value. A bigger warehouse just scans faster, and QAS targets large scans rather than needle lookups." },
        { q: "What kind of query does the Query Acceleration Service help most?",
          options: ["Outlier queries with large scans and selective filters or aggregation that would otherwise hog the warehouse", "Tiny lookups returning one row", "Queries that hit the result cache", "DDL statements"],
          answer: 0,
          explain: "QAS offloads parts of eligible scan-heavy work to serverless compute, so a single big ad-hoc query does not need a permanently larger warehouse. SYSTEM$ESTIMATE_QUERY_ACCELERATION and the QUERY_ACCELERATION_ELIGIBLE view tell you which queries qualify. Tiny lookups and cached results gain nothing." },
        { q: "You need a pre-aggregated table that joins orders to customers and stays within 15 minutes of the sources. Which object fits?",
          options: ["A materialized view", "A dynamic table with TARGET_LAG = '15 minutes'", "A secure view", "The result cache"],
          answer: 1,
          explain: "Materialized views in Snowflake are limited to a single base table, so a join rules them out. A dynamic table accepts joins and refreshes on its warehouse to meet the declared lag. Views compute at query time and the result cache is invalidated by every source change." },
        { q: "Which cost surprise is specific to materialized views and search optimization?",
          options: ["They require a dedicated warehouse that never suspends", "Background maintenance runs as serverless compute and grows with the base table's change rate", "They double warehouse credits per hour", "They disable Time Travel"],
          answer: 1,
          explain: "Both features keep their structures up to date with serverless compute, billed separately from your warehouses and outside resource monitors. A heavily updated base table can cost more in maintenance than it saves in queries. Estimate first and watch the serverless history views." },
        { q: "A dashboard query runs every minute on a table that is reloaded once a day. What is the cheapest acceleration?",
          options: ["Search optimization", "Query Acceleration Service", "Nothing special: after the first run the result cache answers until the next load", "A 4XL warehouse"],
          answer: 2,
          explain: "With unchanged data and identical query text, the persisted result is reused for free and the reuse window keeps extending. Only the first run after each daily load touches a warehouse. Avoid non-deterministic functions in the query so reuse stays possible." }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.perf = {
    id: "perf",
    name: "Warehouses & Query Performance",
    short: "PERF",
    tagline: "Size it, profile it, make it fast",
    color: "#818cf8",
    blurb: "Virtual warehouses are where your credits go and where your latency comes from. Learn how sizes and per-second billing really add up, when multi-cluster beats a bigger size, how to read the Query Profile, which of the three caches is answering, why queries spill and explode, the SQL that blinds the optimizer, and when search optimization, query acceleration, materialized views or dynamic tables are worth their serverless bill.",
    modules: [
      /* ---------------------------------------------------------- */
      {
        id: "warehouses",
        name: "Virtual Warehouses",
        icon: "bolt",
        lessons: [
          {
            id: "sizing",
            title: "Warehouse sizes, credits and per-second billing",
            summary: "How T-shirt sizes map to credits, why per-second billing still punishes idle tails, and when a bigger size is free.",
            minutes: 10,
            tags: ["warehouses", "credits", "billing", "sizing"],
            blocks: [
              { t: "p", html: "Hold this picture: a virtual warehouse is a <strong>rented cluster of compute nodes</strong> that reads the same shared storage as every other warehouse. Each size up doubles the nodes and doubles the credits per hour. You are billed for the seconds the cluster is <em>running</em>, not for the seconds your queries are working." },
              { t: "table", headers: ["Size", "Credits / hour", "Relative compute"], rows: [
                ["XS", "1", "1x"], ["S", "2", "2x"], ["M", "4", "4x"], ["L", "8", "8x"], ["XL", "16", "16x"],
                ["2XL", "32", "32x"], ["3XL", "64", "64x"], ["4XL", "128", "128x"], ["5XL", "256", "256x"], ["6XL", "512", "512x"]
              ] },
              { t: "h", text: "How the meter actually runs" },
              { t: "ul", items: [
                "<strong>Per-second billing</strong> while the warehouse is in the STARTED state.",
                "<strong>A 60-second minimum</strong> each time it resumes. A 3-second query on a cold warehouse pays for 60 seconds.",
                "<strong>The idle tail</strong>: after the last query, the warehouse keeps running until <code class='tok'>AUTO_SUSPEND</code> seconds of inactivity pass. That idle time is billed at the full rate.",
                "<strong>Resizing up</strong> provisions additional nodes; only queries that start afterwards use them. Running queries finish on the old resources."
              ] },
              { t: "code", lang: "sql", code:
                "CREATE WAREHOUSE IF NOT EXISTS transform_wh\n" +
                "  WAREHOUSE_SIZE      = 'MEDIUM'\n" +
                "  AUTO_SUSPEND        = 60        -- seconds of idle before suspend\n" +
                "  AUTO_RESUME         = TRUE\n" +
                "  INITIALLY_SUSPENDED = TRUE\n" +
                "  STATEMENT_TIMEOUT_IN_SECONDS = 3600   -- default is 2 days; cap runaway queries\n" +
                "  COMMENT = 'dbt / ELT transformations';\n\n" +
                "-- Resize for a heavy backfill, then put it back\n" +
                "ALTER WAREHOUSE transform_wh SET WAREHOUSE_SIZE = 'XLARGE';\n" +
                "-- ... run backfill ...\n" +
                "ALTER WAREHOUSE transform_wh SET WAREHOUSE_SIZE = 'MEDIUM';" },
              { t: "h", text: "Double the size, half the time" },
              { t: "p", html: "If a query parallelises well, moving from M to L doubles the rate but halves the runtime, so <strong>credits stay roughly flat while latency halves</strong>. Large scans, big aggregations and wide joins scale like this. Tiny lookups, single-threaded steps and queries dominated by compilation or by one skewed partition do not; for them, the bigger size is pure extra spend." },
              { t: "code", lang: "text", code:
                "Job on M : 40 min x 4 cr/h  = 2.67 credits\n" +
                "Job on L : 20 min x 8 cr/h  = 2.67 credits   (perfect scaling)\n" +
                "Job on L : 26 min x 8 cr/h  = 3.47 credits   (realistic, ~77% efficiency)\n" +
                "Job on XS: 160 min x 1 cr/h = 2.67 credits   (and it blocks everything behind it)" },
              { t: "widget", id: "warehouseCalc" },
              { t: "note", variant: "trap", html: "Lots of tiny bursts on a large warehouse is the expensive pattern. Ten 5-second queries spread across the day on an XL each pay a 60-second minimum plus the idle tail, so you can pay for well over ten times the work actually done." },
              { t: "h", text: "Naive / Solid / Standout: choosing a size" },
              { t: "table", headers: ["Tier", "Approach", "Why"], rows: [
                ["Naive", "One XL for everything, auto-suspend 10 minutes", "Fast, but idle tails and small queries burn most of the credits"],
                ["Solid", "Start small, size up until runtime stops halving, auto-suspend 60 s for bursty workloads", "Finds the knee of the cost curve per workload"],
                ["Standout", "Size per workload from QUERY_HISTORY evidence (spill, queueing, partitions scanned), resize around known heavy jobs, review monthly", "Sizing becomes a measured decision with a feedback loop"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Credits by warehouse for the last 30 days (ACCOUNT_USAGE lags by a few hours)\n" +
                "SELECT warehouse_name,\n" +
                "       ROUND(SUM(credits_used_compute), 1)        AS compute_credits,\n" +
                "       ROUND(SUM(credits_used_cloud_services), 1) AS cloud_services_credits\n" +
                "FROM snowflake.account_usage.warehouse_metering_history\n" +
                "WHERE start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "GROUP BY warehouse_name\n" +
                "ORDER BY compute_credits DESC;" },
              { t: "note", variant: "tip", html: "Snowpark-optimized warehouses provide much more memory per node than standard ones and cost more per hour. Reach for them for memory-bound Python, ML training or huge in-memory operators, not for ordinary SQL." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"our bill doubled but query volume did not\", \"lots of small queries\", \"should we just use a bigger warehouse?\", \"backfill takes all night\". Each one is a sizing and idle-tail conversation: rate x running seconds, with the 60-second minimum and auto-suspend in the picture." },
              { t: "note", variant: "key", html: "<strong>Credits = rate x running seconds, not query seconds.</strong> Bigger sizes are close to free for work that parallelises; idle tails and 60-second minimums are where money quietly leaks." }
            ]
          },
          {
            id: "multi-cluster",
            title: "Multi-cluster warehouses and scaling policies",
            summary: "Scale out for concurrency with extra clusters, choose Standard or Economy, and know when Maximized mode is the right call.",
            minutes: 9,
            tags: ["multi-cluster", "concurrency", "scaling"],
            blocks: [
              { t: "p", html: "Size is <strong>scale up</strong>: more nodes per cluster, so each query gets more horsepower. Multi-cluster is <strong>scale out</strong>: more identical clusters behind one warehouse name, so more queries can run at once. One solves slow queries; the other solves queueing. Multi-cluster warehouses require Enterprise edition or higher." },
              { t: "compare",
                bad: { title: "Scale up (bigger size)", items: ["Helps a single heavy query", "Gives more memory per query, less spilling", "Does not add concurrency proportionally", "Billed at the bigger rate even when one user is active"] },
                good: { title: "Scale out (more clusters)", items: ["Helps many concurrent small queries", "Clusters start and stop with demand", "Each query still gets one cluster's resources", "Billed per running cluster"] } },
              { t: "code", lang: "sql", code:
                "CREATE OR REPLACE WAREHOUSE bi_wh\n" +
                "  WAREHOUSE_SIZE    = 'MEDIUM'\n" +
                "  MIN_CLUSTER_COUNT = 1\n" +
                "  MAX_CLUSTER_COUNT = 4\n" +
                "  SCALING_POLICY    = 'STANDARD'   -- or 'ECONOMY'\n" +
                "  AUTO_SUSPEND      = 300\n" +
                "  AUTO_RESUME       = TRUE;\n\n" +
                "-- Concurrency per cluster is a soft limit (default 8)\n" +
                "ALTER WAREHOUSE bi_wh SET MAX_CONCURRENCY_LEVEL = 8;\n" +
                "-- Fail fast instead of queueing forever\n" +
                "ALTER WAREHOUSE bi_wh SET STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 120;" },
              { t: "h", text: "Modes and policies" },
              { t: "table", headers: ["Setting", "Behaviour", "Use when"], rows: [
                ["Maximized (MIN = MAX)", "All clusters start whenever the warehouse runs", "Known, steady high concurrency; you want zero scale-up delay"],
                ["Auto-scale, Standard", "Adds a cluster as soon as queries queue; removes one after a few quiet checks", "User-facing BI where queueing is visible"],
                ["Auto-scale, Economy", "Adds a cluster only if the system expects enough load to keep it busy for several minutes; removes faster", "Batch or internal workloads that tolerate some queueing"]
              ] },
              { t: "widget", id: "scalingLab" },
              { t: "p", html: "<code class='tok'>MAX_CONCURRENCY_LEVEL</code> is not a hard slot count: Snowflake admits queries based on their estimated resource needs, so heavy queries can queue earlier and light ones may pack more densely. Lowering it gives each query more resources; raising it packs more small queries per cluster at the risk of slower individual queries." },
              { t: "code", lang: "sql", code:
                "-- Is queueing actually the problem? Look at overload vs provisioning time\n" +
                "SELECT DATE_TRUNC('hour', start_time)                AS hr,\n" +
                "       COUNT(*)                                     AS queries,\n" +
                "       ROUND(AVG(queued_overload_time) / 1000, 1)   AS avg_queue_s,\n" +
                "       ROUND(AVG(queued_provisioning_time) / 1000, 1) AS avg_provision_s,\n" +
                "       ROUND(AVG(execution_time) / 1000, 1)         AS avg_exec_s\n" +
                "FROM snowflake.account_usage.query_history\n" +
                "WHERE warehouse_name = 'BI_WH'\n" +
                "  AND start_time >= DATEADD(day, -7, CURRENT_TIMESTAMP())\n" +
                "GROUP BY 1\n" +
                "ORDER BY avg_queue_s DESC\n" +
                "LIMIT 24;" },
              { t: "note", variant: "warn", html: "Multi-cluster does nothing for one slow query: a single query never spans clusters. If <code class='tok'>avg_exec_s</code> is the big number and <code class='tok'>avg_queue_s</code> is near zero, you need a bigger size or a better query, not more clusters." },
              { t: "h", text: "The cost trade-off" },
              { t: "p", html: "A max of 4 Medium clusters can burn 16 credits per hour at peak, the same as an XL. The difference is that the clusters only run while demand exists, and each query still runs on a Medium. Cap <code class='tok'>MAX_CLUSTER_COUNT</code> at what you are willing to pay at the worst minute of the day, and set a resource monitor on the warehouse." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"dashboards are slow at 9 a.m. but fine at noon\", \"queries wait before they start\", \"Monday morning stampede\", \"hundreds of analysts\". High queue time with normal execution time is the multi-cluster signal." },
              { t: "note", variant: "key", html: "<strong>Queueing is a width problem, slowness is a size problem.</strong> Multi-cluster adds width; choose Standard for latency, Economy for credits, and cap the max at a peak cost you can defend." }
            ]
          },
          {
            id: "isolation",
            title: "Workload isolation, auto-suspend and concurrency",
            summary: "Split warehouses by workload, tune auto-suspend against the cache, and keep runaway queries from starving everyone else.",
            minutes: 9,
            tags: ["isolation", "auto-suspend", "governance"],
            blocks: [
              { t: "p", html: "Because storage is shared and compute is independent, <strong>a warehouse is a cost and contention boundary you get almost for free</strong>. Separate warehouses never fight over CPU or memory, and each one shows up as its own line in metering history." },
              { t: "table", headers: ["Workload", "Typical shape", "Warehouse pattern"], rows: [
                ["ELT / dbt", "Few heavy statements, scheduled", "M to XL, single cluster, AUTO_SUSPEND 60"],
                ["BI dashboards", "Many small concurrent queries, peaky", "S or M, multi-cluster Standard, AUTO_SUSPEND 300 to 600 to keep cache warm"],
                ["Ad-hoc / analysts", "Unpredictable, occasional monsters", "M with STATEMENT_TIMEOUT and QAS, resource monitor"],
                ["Data science / Snowpark", "Memory-heavy", "Snowpark-optimized, separate monitor"],
                ["Ingestion (COPY)", "File-parallel loads", "XS to S; scale with file count, not file size"]
              ] },
              { t: "h", text: "Auto-suspend versus the cache" },
              { t: "p", html: "Short auto-suspend saves idle credits but drops the <strong>local disk cache</strong> every time the warehouse stops, so the next query reads cold from remote storage. Long auto-suspend keeps the cache warm and pays for idle time. The right number depends on the gap between queries." },
              { t: "compare",
                bad: { title: "AUTO_SUSPEND = 60", items: ["Minimal idle spend", "Cold cache after every quiet minute", "Best for scheduled ELT with long gaps"] },
                good: { title: "AUTO_SUSPEND = 600", items: ["Warm cache across a working session", "Up to 10 idle minutes billed per burst", "Best for interactive BI with steady traffic"] } },
              { t: "code", lang: "sql", code:
                "-- Guard rails on a shared ad-hoc warehouse\n" +
                "ALTER WAREHOUSE adhoc_wh SET\n" +
                "  STATEMENT_TIMEOUT_IN_SECONDS        = 1800\n" +
                "  STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 300\n" +
                "  AUTO_SUSPEND                        = 120;\n\n" +
                "-- Per-user override for a service account that legitimately runs long\n" +
                "ALTER USER svc_backfill SET STATEMENT_TIMEOUT_IN_SECONDS = 14400;\n\n" +
                "-- Credit ceiling (warehouses only; serverless features are not covered)\n" +
                "CREATE OR REPLACE RESOURCE MONITOR adhoc_rm\n" +
                "  WITH CREDIT_QUOTA = 300 FREQUENCY = MONTHLY START_TIMESTAMP = IMMEDIATELY\n" +
                "  TRIGGERS ON 80 PERCENT DO NOTIFY\n" +
                "           ON 100 PERCENT DO SUSPEND;\n" +
                "ALTER WAREHOUSE adhoc_wh SET RESOURCE_MONITOR = adhoc_rm;" },
              { t: "note", variant: "trap", html: "Setting <code class='tok'>AUTO_SUSPEND = 0</code> (or NULL) means <em>never</em> suspend. It occasionally shows up in copy-pasted DDL and turns an XS into a 720-credit-per-month line item doing nothing." },
              { t: "h", text: "Naive / Solid / Standout: isolation" },
              { t: "table", headers: ["Tier", "Design", "Outcome"], rows: [
                ["Naive", "One shared warehouse for every team", "Nightly ELT queues the CFO dashboard; nobody can say who spent what"],
                ["Solid", "One warehouse per workload type with timeouts and monitors", "Predictable latency, cost by warehouse"],
                ["Standout", "Per-workload warehouses created by IaC with naming like <code class='tok'>&lt;team&gt;_&lt;workload&gt;_wh</code>, query tags on every session, environment database injected as a variable", "Chargeback, safe promotion across environments, and evidence for every resize"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Tag sessions so QUERY_HISTORY can attribute cost within a shared warehouse\n" +
                "-- ({{ env }} is rendered by the orchestrator, never hardcoded per environment)\n" +
                "ALTER SESSION SET QUERY_TAG = 'team=finance;job=daily_close;env={{ env }}';\n\n" +
                "-- Use a parameterised database instead of a hardcoded environment name\n" +
                "SET target_db = 'ANALYTICS_STG';\n" +
                "USE DATABASE IDENTIFIER($target_db);" },
              { t: "note", variant: "tip", html: "Consolidation is not always wrong: three tiny warehouses each paying their own idle tails can cost more than one shared warehouse. Isolate where contention or attribution actually matters." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the nightly load slows down the dashboards\", \"who is spending all the credits?\", \"one analyst query ran for 40 hours\", \"first query of the morning is slow\". These are isolation, timeout and auto-suspend questions." },
              { t: "quiz", id: "perf-warehouses" },
              { t: "note", variant: "key", html: "<strong>Separate warehouses by workload, cap them with timeouts and monitors, and pick auto-suspend from the gap between queries.</strong> Shorter saves idle credits; longer keeps the local cache warm." }
            ]
          }
        ]
      },
      /* ---------------------------------------------------------- */
      {
        id: "tuning",
        name: "Reading & Tuning Queries",
        icon: "wrench",
        lessons: [
          {
            id: "query-profile",
            title: "Reading the Query Profile",
            summary: "Find the expensive operator, read pruning and spill statistics, and pull the same numbers with SQL for regression tracking.",
            minutes: 11,
            tags: ["query-profile", "diagnostics", "operators"],
            blocks: [
              { t: "p", html: "The Query Profile is an <strong>operator tree read bottom-up</strong>: scans at the leaves, joins and aggregates in the middle, the result at the root. Every node reports its share of execution time. Your first job is always the same: find the one or two nodes that own most of the time, then ask why." },
              { t: "h", text: "Where to look first" },
              { t: "table", headers: ["Signal", "Where", "What it usually means"], rows: [
                ["Partitions scanned close to partitions total", "TableScan node", "Pruning failed: poor clustering or a predicate that hides the column"],
                ["Bytes spilled to local / remote storage", "Statistics panel, per operator", "Working set exceeded memory; size up or shrink the data"],
                ["Join output rows far above inputs", "Join node row counts", "Exploding join on duplicate keys"],
                ["High Remote Disk IO share", "Execution time breakdown", "Cold cache or scanning far too much"],
                ["Large Synchronization / Initialization share", "Execution time breakdown", "Overhead-bound small query; a bigger size will not help"],
                ["Percentage scanned from cache", "Statistics", "Whether the local disk cache was warm"]
              ] },
              { t: "code", lang: "sql", code:
                "-- The same profile, as rows you can query and diff\n" +
                "SELECT operator_id,\n" +
                "       operator_type,\n" +
                "       execution_time_breakdown:overall_percentage::FLOAT AS pct_time,\n" +
                "       operator_statistics:input_rows::NUMBER             AS input_rows,\n" +
                "       operator_statistics:output_rows::NUMBER            AS output_rows,\n" +
                "       operator_statistics:pruning:partitions_scanned::NUMBER AS parts_scanned,\n" +
                "       operator_statistics:pruning:partitions_total::NUMBER   AS parts_total,\n" +
                "       operator_statistics:spilling:bytes_spilled_remote_storage::NUMBER AS remote_spill\n" +
                "FROM TABLE(GET_QUERY_OPERATOR_STATS(LAST_QUERY_ID()))\n" +
                "ORDER BY pct_time DESC;" },
              { t: "h", text: "Fleet-wide triage from QUERY_HISTORY" },
              { t: "code", lang: "sql", code:
                "SELECT query_id,\n" +
                "       warehouse_name,\n" +
                "       warehouse_size,\n" +
                "       ROUND(total_elapsed_time / 1000)              AS elapsed_s,\n" +
                "       ROUND(compilation_time / 1000, 1)             AS compile_s,\n" +
                "       partitions_scanned, partitions_total,\n" +
                "       ROUND(bytes_spilled_to_local_storage  / POWER(1024, 3), 1) AS local_spill_gb,\n" +
                "       ROUND(bytes_spilled_to_remote_storage / POWER(1024, 3), 1) AS remote_spill_gb,\n" +
                "       percentage_scanned_from_cache,\n" +
                "       query_parameterized_hash\n" +
                "FROM snowflake.account_usage.query_history\n" +
                "WHERE start_time >= DATEADD(day, -1, CURRENT_TIMESTAMP())\n" +
                "  AND execution_status = 'SUCCESS'\n" +
                "ORDER BY total_elapsed_time DESC\n" +
                "LIMIT 50;" },
              { t: "note", variant: "tip", html: "<code class='tok'>query_parameterized_hash</code> groups runs of the same query shape with different literals. Sum elapsed time by that hash to find the shape that costs the most in aggregate, which is rarely the single slowest query." },
              { t: "h", text: "Compile time is a clue too" },
              { t: "p", html: "If <code class='tok'>compilation_time</code> is a large share of a query, the problem is in cloud services, not the warehouse: enormous generated SQL, very deep view stacks, thousands of literals in an IN list, or a table with an extreme number of micro-partitions to consider. Sizing the warehouse will not touch it." },
              { t: "ol", items: [
                "Open the profile and sort operators by percentage of time.",
                "On the top operator, compare input and output rows, then check pruning and spill.",
                "Decide which family the problem belongs to: <strong>too much data read</strong>, <strong>too much data produced</strong>, <strong>not enough memory</strong>, or <strong>overhead</strong>.",
                "Fix the family, rerun with <code class='tok'>USE_CACHED_RESULT = FALSE</code>, and compare the same statistics."
              ] },
              { t: "note", variant: "warn", html: "ACCOUNT_USAGE.QUERY_HISTORY lags by up to roughly 45 minutes. For a query you just ran, use the profile in the UI, <code class='tok'>GET_QUERY_OPERATOR_STATS</code>, or the INFORMATION_SCHEMA <code class='tok'>QUERY_HISTORY()</code> table function, which is real time but keeps only a short window." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"this query got slow and nobody changed it\", \"how would you debug a slow query?\", \"is the warehouse too small?\". Lead with the profile: most expensive node, partitions scanned versus total, spill, and row counts in and out of joins." },
              { t: "note", variant: "key", html: "<strong>Find the operator that owns the time, then classify the problem</strong>: too much read, too much produced, not enough memory, or overhead. Each family has a different fix, and only one of them is a bigger warehouse." }
            ]
          },
          {
            id: "caching",
            title: "The three caching layers",
            summary: "Result cache, local disk cache and metadata: where each lives, what invalidates it, and how to benchmark honestly.",
            minutes: 10,
            tags: ["caching", "result-cache", "local-disk-cache"],
            blocks: [
              { t: "p", html: "Three layers can answer a query faster than a cold scan, and they live in different places. <strong>Cloud services</strong> holds persisted query results and partition metadata; each <strong>warehouse</strong> keeps recently read micro-partitions on local SSD; <strong>remote storage</strong> is the durable, slowest source of truth." },
              { t: "diagram", id: "sf-cache-layers", caption: "Result cache and metadata in cloud services, local disk cache per warehouse, and micro-partitions in remote storage." },
              { t: "table", headers: ["Layer", "Lives in", "Lifetime", "Invalidated by"], rows: [
                ["Result cache", "Cloud services, shared by all warehouses", "24 h, extended by each reuse up to 31 days", "Any change to the underlying data; changed query text"],
                ["Metadata", "Cloud services", "Always current", "Never stale; updated with every DML"],
                ["Local disk cache", "SSD of one running warehouse", "Until the warehouse suspends or is resized", "Suspend, resize, eviction under pressure"]
              ] },
              { t: "h", text: "Result reuse: every condition must hold" },
              { t: "ul", items: [
                "The new query matches the previous one <strong>textually</strong>, including case and literals.",
                "No <strong>non-deterministic functions</strong>: <code class='tok'>CURRENT_TIMESTAMP()</code>, <code class='tok'>RANDOM()</code>, <code class='tok'>UUID_STRING()</code> and similar block reuse.",
                "The <strong>underlying data has not changed</strong> since the result was produced.",
                "The <strong>role has the privileges</strong> on every referenced object.",
                "<code class='tok'>USE_CACHED_RESULT</code> is TRUE (the default) for the session."
              ] },
              { t: "widget", id: "cacheLab" },
              { t: "code", lang: "sql", code:
                "-- Benchmark honestly: disable result reuse for the session\n" +
                "ALTER SESSION SET USE_CACHED_RESULT = FALSE;\n\n" +
                "-- Reuse a previous result as a table without re-running it\n" +
                "SELECT region, SUM(amount) AS revenue FROM sales.fact_orders GROUP BY region;\n" +
                "SELECT *\n" +
                "FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))\n" +
                "WHERE revenue > 1000000;\n\n" +
                "-- Answered from metadata, no warehouse scan\n" +
                "SELECT COUNT(*) FROM sales.fact_orders;" },
              { t: "note", variant: "trap", html: "A dashboard filter like <code class='tok'>WHERE order_date &gt;= DATEADD(day, -7, CURRENT_DATE())</code> prevents result reuse on every refresh. If freshness to the day is enough, have the BI tool send the computed literal date instead, and the same text becomes reusable all day." },
              { t: "h", text: "Warm versus cold, measured" },
              { t: "code", lang: "sql", code:
                "SELECT query_id,\n" +
                "       percentage_scanned_from_cache,\n" +
                "       ROUND(execution_time / 1000, 1) AS exec_s\n" +
                "FROM snowflake.account_usage.query_history\n" +
                "WHERE warehouse_name = 'BI_WH'\n" +
                "  AND start_time >= DATEADD(day, -1, CURRENT_TIMESTAMP())\n" +
                "  AND query_text ILIKE '%fact_orders%'\n" +
                "ORDER BY start_time DESC;" },
              { t: "note", variant: "tip", html: "When you compare two versions of a query, run each once to warm the cache and then measure the second run of each, with result reuse off. Otherwise the first contender pays the cold read and the second looks like a breakthrough." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"it was fast the second time\", \"the dashboard is instant sometimes and slow other times\", \"we lowered auto-suspend and queries got slower\", \"is caching why my benchmark looks great?\". Name the layer, then the invalidation rule." },
              { t: "note", variant: "key", html: "<strong>Result cache is shared and free but fragile; local disk cache is per warehouse and dies on suspend; metadata answers counts and min/max outright.</strong> Know which one you hit before you claim a speed-up." }
            ]
          },
          {
            id: "spilling",
            title: "Spilling, memory and exploding joins",
            summary: "Why operators spill to local and remote storage, how to tell a genuinely big workload from a row explosion, and the fixes in order.",
            minutes: 10,
            tags: ["spilling", "memory", "joins"],
            blocks: [
              { t: "p", html: "Hash joins, sorts, window functions and big aggregations build in-memory structures. When the working set outgrows memory on a node, the operator <strong>spills to local SSD</strong>; when SSD is also exhausted, it <strong>spills to remote storage</strong>. Each step down is dramatically slower, and remote spill can stretch a query by an order of magnitude." },
              { t: "stat", items: [
                { v: "0", k: "the spill you want" },
                { v: "local", k: "tolerable; watch the trend" },
                { v: "remote", k: "act on it" }
              ] },
              { t: "widget", id: "spillLab" },
              { t: "h", text: "First, rule out a row explosion" },
              { t: "p", html: "Most dramatic spills are not big data; they are <strong>multiplied</strong> data. A join on a key that is duplicated on both sides produces the product of the duplicates. The profile shows a Join whose output rows dwarf both inputs." },
              { t: "code", lang: "sql", code:
                "-- Is the join key actually unique on the side you assumed?\n" +
                "SELECT customer_id, COUNT(*) AS n\n" +
                "FROM crm.dim_customer\n" +
                "GROUP BY customer_id\n" +
                "HAVING COUNT(*) > 1\n" +
                "ORDER BY n DESC\n" +
                "LIMIT 20;\n\n" +
                "-- Keep only the current version of each customer before joining\n" +
                "WITH cust AS (\n" +
                "  SELECT *\n" +
                "  FROM crm.dim_customer\n" +
                "  QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC) = 1\n" +
                ")\n" +
                "SELECT o.order_id, o.amount, c.segment\n" +
                "FROM sales.fact_orders o\n" +
                "JOIN cust c ON c.customer_id = o.customer_id\n" +
                "WHERE o.order_date >= '2026-01-01';" },
              { t: "note", variant: "trap", html: "Adding <code class='tok'>SELECT DISTINCT</code> on top of an exploding join hides the wrong answer and makes the spill worse: the engine first materialises the explosion, then deduplicates it. Fix the join, do not launder its output." },
              { t: "h", text: "Fixes, in the order to try them" },
              { t: "ol", items: [
                "<strong>Fix multiplication</strong>: dedupe a side, add the missing join column, or aggregate before joining.",
                "<strong>Reduce what enters the operator</strong>: filter and prune early, project only needed columns, pre-aggregate.",
                "<strong>Split the work</strong>: process by date range or key bucket in a loop or a task graph.",
                "<strong>Size up</strong>: more nodes means more memory for this query. Doubling often removes spill and finishes more than twice as fast, so it can be cheaper.",
                "<strong>Snowpark-optimized warehouse</strong> for memory-bound Python or very large in-memory operators."
              ] },
              { t: "code", lang: "sql", code:
                "-- Which recurring queries spill the most, by shape\n" +
                "SELECT query_parameterized_hash,\n" +
                "       ANY_VALUE(LEFT(query_text, 120))                                AS sample,\n" +
                "       COUNT(*)                                                       AS runs,\n" +
                "       ROUND(SUM(bytes_spilled_to_local_storage)  / POWER(1024, 3)) AS local_gb,\n" +
                "       ROUND(SUM(bytes_spilled_to_remote_storage) / POWER(1024, 3)) AS remote_gb\n" +
                "FROM snowflake.account_usage.query_history\n" +
                "WHERE start_time >= DATEADD(day, -14, CURRENT_TIMESTAMP())\n" +
                "  AND bytes_spilled_to_local_storage > 0\n" +
                "GROUP BY query_parameterized_hash\n" +
                "ORDER BY remote_gb DESC, local_gb DESC\n" +
                "LIMIT 25;" },
              { t: "note", variant: "warn", html: "Multi-cluster does not cure spill. A query runs on one cluster, so extra clusters add concurrency, not memory per query." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"bytes spilled to remote\", \"the join never finishes\", \"row count is way bigger than expected\", \"query time went from minutes to hours after a dimension change\". Check join cardinality before you touch the warehouse size." },
              { t: "note", variant: "key", html: "<strong>Spill means the working set outgrew memory; first prove the working set is real, not multiplied.</strong> Fix joins and filters before buying memory, then size up if the data is genuinely big." }
            ]
          },
          {
            id: "anti-patterns",
            title: "SQL anti-patterns that defeat the optimizer",
            summary: "Predicates that hide columns from pruning, joins that cannot hash, and habits that turn a set engine into a row-by-row one.",
            minutes: 11,
            tags: ["anti-patterns", "pruning", "sql"],
            blocks: [
              { t: "p", html: "The optimizer is good, but it can only use what your SQL lets it see. Most slow queries in a mature account fall into a short list of patterns where the SQL <strong>hides a column from metadata</strong>, <strong>forces extra work</strong>, or <strong>fights the set-based engine</strong>." },
              { t: "table", headers: ["Anti-pattern", "Why it hurts", "Rewrite"], rows: [
                ["Function on the filtered column: <code class='tok'>TO_VARCHAR(ts,'YYYY-MM') = '2026-01'</code>", "Min/max metadata cannot be used, so pruning is lost", "Range on the raw column: <code class='tok'>ts &gt;= '2026-01-01' AND ts &lt; '2026-02-01'</code>"],
                ["Join keys of different types (VARCHAR = NUMBER)", "Implicit casts on every row; can block pruning and efficient hashing", "Fix the model, or cast the smaller side once in a CTE"],
                ["<code class='tok'>SELECT *</code> on wide tables", "Columnar storage reads every column you name", "Project only needed columns, especially in views"],
                ["<code class='tok'>OR</code> across different columns in a join condition", "Can degrade to a nested-loop or cartesian-style join", "Split into two joins combined with UNION ALL"],
                ["<code class='tok'>UNION</code> where branches are disjoint", "Adds a full deduplication step", "<code class='tok'>UNION ALL</code>"],
                ["<code class='tok'>ORDER BY</code> inside subqueries and views", "Sorting work that the outer query discards", "Sort once, at the outermost level, if at all"],
                ["Row-by-row loops in procedures", "One statement per row means overhead per row", "One set-based <code class='tok'>MERGE</code> or <code class='tok'>INSERT ... SELECT</code>"],
                ["Leading-wildcard <code class='tok'>LIKE '%abc%'</code> on huge tables", "Cannot prune from min/max", "Search optimization ON SUBSTRING, or restructure the data"]
              ] },
              { t: "h", text: "Before and after" },
              { t: "code", lang: "sql", code:
                "-- Before: hides event_ts from pruning, reads every column\n" +
                "SELECT *\n" +
                "FROM web.events\n" +
                "WHERE DATE_TRUNC('month', event_ts) = '2026-01-01'\n" +
                "  AND (user_id = 42 OR session_user_id = 42);\n\n" +
                "-- After: prunable range, projected columns, OR split into UNION ALL\n" +
                "SELECT event_id, event_ts, event_type\n" +
                "FROM web.events\n" +
                "WHERE event_ts >= '2026-01-01' AND event_ts < '2026-02-01'\n" +
                "  AND user_id = 42\n" +
                "UNION ALL\n" +
                "SELECT event_id, event_ts, event_type\n" +
                "FROM web.events\n" +
                "WHERE event_ts >= '2026-01-01' AND event_ts < '2026-02-01'\n" +
                "  AND session_user_id = 42\n" +
                "  AND user_id IS DISTINCT FROM 42;" },
              { t: "note", variant: "tip", html: "Snowflake can push some simple functions through to pruning, but you should not depend on it. Keeping transformations on the literal side of the predicate is a habit that always works." },
              { t: "h", text: "The NOT IN trap" },
              { t: "code", lang: "sql", code:
                "-- Returns ZERO rows if any blocked.customer_id is NULL\n" +
                "SELECT c.customer_id FROM crm.customers c\n" +
                "WHERE c.customer_id NOT IN (SELECT customer_id FROM crm.blocked);\n\n" +
                "-- Null-safe and typically planned as an anti-join\n" +
                "SELECT c.customer_id FROM crm.customers c\n" +
                "WHERE NOT EXISTS (\n" +
                "  SELECT 1 FROM crm.blocked b WHERE b.customer_id = c.customer_id\n" +
                ");" },
              { t: "compare",
                bad: { title: "Procedural thinking", items: ["Cursor over rows, UPDATE each", "Thousands of tiny statements, each with overhead", "Hard to read in the profile"] },
                good: { title: "Set-based thinking", items: ["One MERGE with a staged source", "One compile, one parallel execution", "One query to profile and tune"] } },
              { t: "note", variant: "warn", html: "Very large literal IN lists (tens of thousands of values) blow up compile time. Load the values into a temporary table and join, which compiles quickly and prunes just as well." },
              { t: "h", text: "Naive / Solid / Standout: fixing a slow report" },
              { t: "table", headers: ["Tier", "Move", "Result"], rows: [
                ["Naive", "Bump the warehouse to 2XL", "Same full scan, eight times the rate"],
                ["Solid", "Rewrite predicates for pruning and project columns", "Fewer partitions and bytes; cheaper on the same size"],
                ["Standout", "Rewrite, then align clustering with the dominant filter and add a regression check on partitions scanned", "Fast now, and you find out when it regresses"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we filter by month but it scans everything\", \"the NOT IN returns nothing\", \"the procedure loops over rows\", \"joining on IDs stored as strings\". Name the specific pattern and its rewrite rather than suggesting more compute." },
              { t: "quiz", id: "perf-tuning" },
              { t: "note", variant: "key", html: "<strong>Keep filtered columns bare, keys typed consistently, and work set-based.</strong> The cheapest performance fix is SQL the optimizer can prune and hash, which no warehouse size can substitute for." }
            ]
          }
        ]
      },
      /* ---------------------------------------------------------- */
      {
        id: "accel",
        name: "Acceleration Services",
        icon: "trend",
        lessons: [
          {
            id: "search-optimization",
            title: "Search Optimization Service",
            summary: "A maintained search access path for selective lookups on columns your clustering cannot serve, and what it costs to keep it fresh.",
            minutes: 9,
            tags: ["search-optimization", "point-lookups", "serverless"],
            blocks: [
              { t: "p", html: "Clustering helps one dominant filter, usually a date. Search optimization serves the <strong>other</strong> selective filters: a user id, an order UUID, an email, a substring in a log line, a key inside VARIANT. It builds and maintains a <strong>search access path</strong> that tells the engine which micro-partitions could contain a value, so it skips the rest. It requires Enterprise edition or higher." },
              { t: "code", lang: "sql", code:
                "-- Estimate before you pay\n" +
                "SELECT SYSTEM$ESTIMATE_SEARCH_OPTIMIZATION_COSTS(\n" +
                "  'sales.fact_orders', 'EQUALITY(order_uuid), SUBSTRING(customer_email)');\n\n" +
                "-- Enable for specific columns and methods, not the whole table\n" +
                "ALTER TABLE sales.fact_orders ADD SEARCH OPTIMIZATION\n" +
                "  ON EQUALITY(order_uuid), SUBSTRING(customer_email);\n\n" +
                "-- Semi-structured path\n" +
                "ALTER TABLE web.events ADD SEARCH OPTIMIZATION ON EQUALITY(payload:device:id);\n\n" +
                "-- Inspect what is configured and how far the build has got\n" +
                "DESCRIBE SEARCH OPTIMIZATION ON sales.fact_orders;\n" +
                "SHOW TABLES LIKE 'FACT_ORDERS' IN SCHEMA sales;  -- search_optimization_progress" },
              { t: "table", headers: ["Method", "Serves", "Example predicate"], rows: [
                ["EQUALITY", "Equality and IN on high-cardinality columns", "<code class='tok'>WHERE order_uuid = 'a1b2-...'</code>"],
                ["SUBSTRING", "LIKE / ILIKE / CONTAINS / regex-style substring search", "<code class='tok'>WHERE msg ILIKE '%timeout%'</code>"],
                ["GEO", "Geospatial predicates on GEOGRAPHY", "<code class='tok'>WHERE ST_INTERSECTS(area, pt)</code>"],
                ["FULL_TEXT", "Token search with SEARCH()", "<code class='tok'>WHERE SEARCH(body, 'refund')</code>"]
              ] },
              { t: "h", text: "What it costs" },
              { t: "ul", items: [
                "<strong>Storage</strong> for the search access path, which can be a noticeable fraction of the table for many indexed columns.",
                "<strong>Serverless maintenance compute</strong> for the initial build and for every change to the table. High-churn tables cost the most.",
                "Neither shows up on a warehouse, and resource monitors do not cap them. Watch the serverless history view."
              ] },
              { t: "code", lang: "sql", code:
                "SELECT table_name,\n" +
                "       ROUND(SUM(credits_used), 2) AS so_credits\n" +
                "FROM snowflake.account_usage.search_optimization_history\n" +
                "WHERE start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "GROUP BY table_name\n" +
                "ORDER BY so_credits DESC;" },
              { t: "note", variant: "warn", html: "It helps <strong>selective</strong> queries that return a small slice. A predicate matching a large share of rows touches most partitions anyway, and the feature cannot help. Low-cardinality flags are a poor fit." },
              { t: "compare",
                bad: { title: "Poor fit", items: ["Filters returning a large share of rows", "Columns the table is already clustered on", "Tables rewritten in full every day", "Rarely queried tables"] },
                good: { title: "Good fit", items: ["Needle lookups by id or UUID", "Log or text substring search", "Lookups inside VARIANT keys", "Large, mostly-append tables queried often"] } },
              { t: "p", html: "<strong>Clustering versus search optimization:</strong> clustering physically co-locates rows by one key and helps range filters on it; search optimization leaves the layout alone and adds a lookup structure for many selective columns. A typical large fact table uses both: clustered by date, search-optimized on its ids." },
              { t: "note", variant: "tip", html: "Before and after enabling, run the lookup with result reuse off and compare partitions scanned in the profile. That single number is the proof the feature is earning its maintenance bill." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"look up one customer in billions of rows\", \"search logs for an error string\", \"filter on a JSON key\", \"we cannot cluster on every column\". Selective lookup on a non-clustering column is the trigger." },
              { t: "note", variant: "key", html: "<strong>Search optimization is for needles, not haystacks.</strong> Enable it per column and method, estimate first, and track its serverless maintenance against the partitions it saves." }
            ]
          },
          {
            id: "qas",
            title: "Query Acceleration Service",
            summary: "Lend serverless compute to outlier scan-heavy queries instead of permanently oversizing the warehouse for them.",
            minutes: 8,
            tags: ["qas", "serverless", "outliers"],
            blocks: [
              { t: "p", html: "Most warehouses are sized for their typical query, then a few outliers arrive: an analyst scanning a year of events, a backfill with a wide filter. The Query Acceleration Service lets the warehouse <strong>offload eligible scan and filter work to shared serverless compute</strong>, so those outliers finish quickly without a permanent size increase. It requires Enterprise edition or higher." },
              { t: "code", lang: "sql", code:
                "-- Would this specific query have benefited?\n" +
                "SELECT PARSE_JSON(SYSTEM$ESTIMATE_QUERY_ACCELERATION('01b2c3d4-0000-1111-0000-00000000abcd'));\n\n" +
                "-- Which warehouses have the most eligible time?\n" +
                "SELECT warehouse_name,\n" +
                "       COUNT(*)                               AS eligible_queries,\n" +
                "       ROUND(SUM(eligible_query_acceleration_time) / 3600, 1) AS eligible_hours\n" +
                "FROM snowflake.account_usage.query_acceleration_eligible\n" +
                "WHERE start_time >= DATEADD(day, -7, CURRENT_TIMESTAMP())\n" +
                "GROUP BY warehouse_name\n" +
                "ORDER BY eligible_hours DESC;\n\n" +
                "-- Enable with a ceiling (scale factor multiplies the warehouse size)\n" +
                "ALTER WAREHOUSE adhoc_wh SET\n" +
                "  ENABLE_QUERY_ACCELERATION = TRUE\n" +
                "  QUERY_ACCELERATION_MAX_SCALE_FACTOR = 4;" },
              { t: "h", text: "Eligibility in practice" },
              { t: "table", headers: ["Likely eligible", "Likely not eligible"], rows: [
                ["Large scans with selective filters", "Queries that scan few partitions"],
                ["Large scans feeding aggregations", "Queries dominated by a huge join or sort after the scan"],
                ["Ad-hoc outliers on a mostly-small warehouse", "Queries already served by the result cache"],
                ["INSERT / CTAS that scan a lot of source data", "Work limited by non-deterministic or unsupported steps"]
              ] },
              { t: "p", html: "The scale factor caps how much serverless compute a query can borrow, expressed as a multiple of the warehouse size. The default is 8; 0 means no upper bound. A lower factor bounds the worst-case bill; a higher one lets a rare monster query finish sooner." },
              { t: "stat", items: [
                { v: "8", k: "default max scale factor" },
                { v: "0", k: "means no upper bound" },
                { v: "serverless", k: "billed separately from the warehouse" }
              ] },
              { t: "code", lang: "sql", code:
                "SELECT warehouse_name,\n" +
                "       ROUND(SUM(credits_used), 2) AS qas_credits\n" +
                "FROM snowflake.account_usage.query_acceleration_history\n" +
                "WHERE start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "GROUP BY warehouse_name;" },
              { t: "compare",
                bad: { title: "Permanently size up for outliers", items: ["Every query pays the bigger rate", "Idle tails cost double too", "Simple to reason about"] },
                good: { title: "Keep size, enable QAS", items: ["Typical queries stay on the cheap size", "Outliers borrow compute only while scanning", "Needs monitoring of a separate serverless line item"] } },
              { t: "h", text: "What QAS will not do" },
              { t: "note", variant: "trap", html: "QAS will not fix a spilling join or an exploding join; it accelerates scanning and filtering, not memory-bound operators. If the profile's top node is a Join or Sort, look at the spilling lesson instead." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"most queries are fast but a few ad-hoc ones take forever\", \"we sized up for one report\", \"unpredictable analyst workload\". Mixed workloads with outlier scans are the QAS case." },
              { t: "note", variant: "key", html: "<strong>QAS rents compute for the outliers so the warehouse can be sized for the typical query.</strong> Check eligibility first, cap the scale factor, and watch its serverless credits." }
            ]
          },
          {
            id: "materialized-views",
            title: "Materialized views, dynamic tables or result reuse?",
            summary: "Three ways to avoid recomputing the same answer, with very different limits, freshness and cost models.",
            minutes: 10,
            tags: ["materialized-views", "dynamic-tables", "result-cache"],
            blocks: [
              { t: "p", html: "When the same expensive computation runs again and again, you have three ways to precompute it. <strong>Result reuse</strong> is free but only for identical queries on unchanged data. <strong>Materialized views</strong> are maintained automatically and transparently, but are restricted to a single table. <strong>Dynamic tables</strong> handle full transformation SQL with a declared freshness target." },
              { t: "table", headers: ["", "Result reuse", "Materialized view", "Dynamic table"], rows: [
                ["Joins", "Any query", "No; single base table", "Yes"],
                ["Freshness", "Exact; invalidated on change", "Always current (stale parts computed from base at query time)", "Within TARGET_LAG"],
                ["Compute", "None", "Serverless background maintenance", "Your warehouse, on refresh"],
                ["Edition", "All", "Enterprise+", "All"],
                ["Optimizer can use it automatically", "Only for the same text", "Yes, can rewrite base-table queries", "No; you query it by name"],
                ["Best for", "Dashboards on slowly changing data", "Hot aggregates or filtered projections of one big table", "Multi-step pipelines and joined marts"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Materialized view: single table, deterministic aggregates\n" +
                "CREATE OR REPLACE MATERIALIZED VIEW sales.mv_daily_revenue\n" +
                "  CLUSTER BY (order_date)\n" +
                "AS\n" +
                "SELECT order_date, region, SUM(amount) AS revenue, COUNT(*) AS orders\n" +
                "FROM sales.fact_orders\n" +
                "GROUP BY order_date, region;\n\n" +
                "-- Dynamic table: joins allowed, freshness declared\n" +
                "CREATE OR REPLACE DYNAMIC TABLE sales.dt_customer_revenue\n" +
                "  TARGET_LAG = '15 minutes'\n" +
                "  WAREHOUSE  = transform_wh\n" +
                "AS\n" +
                "SELECT c.segment, o.order_date, SUM(o.amount) AS revenue\n" +
                "FROM sales.fact_orders o\n" +
                "JOIN crm.dim_customer c ON c.customer_id = o.customer_id\n" +
                "GROUP BY c.segment, o.order_date;" },
              { t: "h", text: "Materialized view limits worth memorising" },
              { t: "ul", items: [
                "One base table only: no joins, including self-joins.",
                "No window functions, no non-deterministic functions, and only a subset of aggregates.",
                "Maintenance is serverless and grows with the base table's churn; a constantly rewritten table can make an MV a net loss.",
                "A good MV can be clustered differently from its base table, which gives a second access path for a different filter."
              ] },
              { t: "code", lang: "sql", code:
                "SELECT table_name,\n" +
                "       ROUND(SUM(credits_used), 2) AS mv_refresh_credits\n" +
                "FROM snowflake.account_usage.materialized_view_refresh_history\n" +
                "WHERE start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "GROUP BY table_name\n" +
                "ORDER BY mv_refresh_credits DESC;" },
              { t: "note", variant: "tip", html: "Dynamic tables refresh incrementally when the query shape allows it and fall back to full refresh otherwise. Check <code class='tok'>refresh_mode</code> after creation; a pipeline you believed was incremental may be recomputing everything." },
              { t: "h", text: "Naive / Solid / Standout: a slow executive dashboard" },
              { t: "table", headers: ["Tier", "Choice", "Trade-off"], rows: [
                ["Naive", "Bigger BI warehouse", "Every refresh recomputes; cost scales with viewers"],
                ["Solid", "Deterministic SQL so result reuse works, plus a dynamic table for the joined mart", "Cheap refreshes; freshness is explicit"],
                ["Standout", "Dynamic table mart with TARGET_LAG matched to the business need, MV only for a hot single-table aggregate, and monitoring of refresh credits", "Each layer chosen for its constraint, with cost visible"]
              ] },
              { t: "note", variant: "warn", html: "Freshness is a product decision. A one-minute target lag on a dashboard viewed twice a day buys hundreds of pointless refreshes. Ask how stale the number can be before anyone would act differently." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the same aggregate is computed by every dashboard\", \"precompute this join\", \"near-real-time mart\", \"should we use a materialized view?\". Ask: joins or single table, how fresh, and who pays the refresh compute." },
              { t: "quiz", id: "perf-accel" },
              { t: "note", variant: "key", html: "<strong>Result reuse for identical queries on stable data, materialized views for hot single-table aggregates, dynamic tables for joined pipelines with a declared lag.</strong> Each one moves compute somewhere else; know where it lands on the bill." }
            ]
          }
        ]
      }
    ]
  };
})();
