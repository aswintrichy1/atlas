/* =====================================================================
   CASCADE · Orchestration & DataOps track  (curriculum + quizzes + widgets)
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var h = WK.h, svgEl = WK.svgEl, shell = WK.shell;

  function seg(opts, getCur, onPick) {
    var s = h("div", { class: "w-seg" });
    opts.forEach(function (o) {
      var b = h("button", { class: o.v === getCur() ? "active" : "" }, o.label);
      b.addEventListener("click", function () {
        onPick(o.v);
        s.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
      });
      s.appendChild(b);
    });
    return s;
  }
  function ro(label, value, accent) {
    return h("span", { class: "ro" }, label + " ", h("b", accent ? { style: "color:var(--accent)" } : {}, value));
  }
  function node(g, n, stroke, fill) {
    var r = svgEl("rect", { x: n.x - 48, y: n.y - 15, width: 96, height: 30, rx: 8, fill: fill || "var(--surface-solid)", stroke: stroke, "stroke-width": 2 });
    g.appendChild(r);
    var t = svgEl("text", { x: n.x, y: n.y, fill: "var(--text)", "font-family": "var(--font-mono)", "font-size": "9.5", "text-anchor": "middle", "dominant-baseline": "central" });
    t.textContent = n.label; g.appendChild(t);
  }

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — DAG run simulator */
  window.Widgets["de-ops-dag"] = function (mount) {
    shell(mount, "simulator", "DAG Run Simulator",
      "Tasks run only after their upstreams succeed. Inject a failure and watch downstream tasks skip.");
    var nodes = {
      extract: { x: 60, y: 110, label: "extract", deps: [] },
      ta: { x: 195, y: 55, label: "transform_a", deps: ["extract"] },
      tb: { x: 195, y: 165, label: "transform_b", deps: ["extract"] },
      load: { x: 335, y: 110, label: "load", deps: ["ta", "tb"] },
      publish: { x: 445, y: 110, label: "publish", deps: ["load"] }
    };
    var edges = [["extract", "ta"], ["extract", "tb"], ["ta", "load"], ["tb", "load"], ["load", "publish"]];
    var state = {}, failTask = "none";
    function reset() { Object.keys(nodes).forEach(function (k) { state[k] = "pending"; }); }
    reset();
    var svg = svgEl("svg", { class: "graph-svg", viewBox: "0 0 510 230", role: "img" });
    var readout = h("div", { class: "w-readout" });
    var color = { pending: "var(--line-strong)", success: "var(--accent)", failed: "var(--rose)", skipped: "var(--text-faint)" };
    function tick() {
      Object.keys(nodes).forEach(function (k) {
        if (state[k] === "pending" && nodes[k].deps.some(function (d) { return state[d] === "failed" || state[d] === "skipped"; })) state[k] = "skipped";
      });
      Object.keys(nodes).forEach(function (k) {
        if (state[k] === "pending" && nodes[k].deps.every(function (d) { return state[d] === "success"; })) {
          state[k] = (failTask === k) ? "failed" : "success";
        }
      });
      paint();
    }
    function paint() {
      svg.innerHTML = "";
      edges.forEach(function (e) {
        var a = nodes[e[0]], b = nodes[e[1]];
        var on = state[e[1]] === "success";
        svg.appendChild(svgEl("path", { class: "gt-edge" + (on ? " tree" : ""), d: "M" + (a.x + 48) + " " + a.y + " L" + (b.x - 48) + " " + b.y }));
      });
      Object.keys(nodes).forEach(function (k) {
        var g = svgEl("g", {});
        var st = state[k];
        node(g, nodes[k], color[st], st === "success" ? "color-mix(in srgb,var(--accent) 22%,var(--surface-solid))" : (st === "failed" ? "color-mix(in srgb,var(--rose) 20%,var(--surface-solid))" : "var(--surface-solid)"));
        svg.appendChild(g);
      });
      var c = { success: 0, skipped: 0, failed: 0, pending: 0 };
      Object.keys(state).forEach(function (k) { c[state[k]]++; });
      readout.innerHTML = "";
      readout.appendChild(ro("succeeded", String(c.success), true));
      readout.appendChild(ro("skipped", String(c.skipped)));
      readout.appendChild(ro("failed", String(c.failed)));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "fail:"),
      seg([{ v: "none", label: "none" }, { v: "ta", label: "transform_a" }, { v: "load", label: "load" }], function () { return failTask; }, function (v) { failTask = v; reset(); paint(); }),
      h("button", { class: "w-btn primary", onclick: tick }, "Tick"),
      h("button", { class: "w-btn ghost", onclick: function () { reset(); paint(); } }, "Reset")
    ));
    mount.appendChild(h("div", { class: "w-stage" }, svg));
    mount.appendChild(readout);
    paint();
  };

  /* 2 — Data quality checks */
  window.Widgets["de-ops-quality"] = function (mount) {
    shell(mount, "lab", "Data Quality Checks",
      "Toggle a defect into the data and watch the assertions catch it before it reaches downstream tables.");
    var flags = { email: false, dup: false, neg: false, status: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function rows() {
      return [
        { id: 1, email: "ava@x.com", amount: 10, status: flags.status ? "??" : "paid" },
        { id: 2, email: flags.email ? "" : "bo@x.com", amount: 5, status: "new" },
        { id: flags.dup ? 1 : 3, email: "cy@x.com", amount: 20, status: "paid" },
        { id: 4, email: "di@x.com", amount: flags.neg ? -3 : 8, status: "new" }
      ];
    }
    function checks(rs) {
      var ids = rs.map(function (r) { return r.id; });
      return [
        { name: "not_null(email)", ok: rs.every(function (r) { return r.email !== ""; }) },
        { name: "unique(id)", ok: new Set(ids).size === ids.length },
        { name: "amount > 0", ok: rs.every(function (r) { return r.amount > 0; }) },
        { name: "status in (new, paid)", ok: rs.every(function (r) { return r.status === "new" || r.status === "paid"; }) }
      ];
    }
    function paint() {
      var rs = rows();
      stage.innerHTML = "";
      var board = h("div", { class: "grid-board", style: "grid-template-columns:repeat(4,minmax(58px,1fr));gap:3px" });
      ["id", "email", "amount", "status"].forEach(function (c) { board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:5px;font-family:var(--font-mono);font-size:.58rem;color:var(--text-dim)" }, c)); });
      rs.forEach(function (r) {
        [r.id, r.email || "\u2205", r.amount, r.status].forEach(function (v) {
          board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:6px 4px;font-size:.66rem" }, String(v)));
        });
      });
      stage.appendChild(board);
      var log = h("div", { class: "dsa-log", style: "margin-top:12px" });
      var cs = checks(rs), passed = 0;
      cs.forEach(function (c) {
        if (c.ok) passed++;
        log.appendChild(h("div", { class: c.ok ? "ok" : "no" }, (c.ok ? "\u2713 PASS  " : "\u2717 FAIL  ") + c.name));
      });
      stage.appendChild(log);
      readout.innerHTML = "";
      readout.appendChild(ro("checks passing", passed + " / " + cs.length, true));
      readout.appendChild(ro("gate", passed === cs.length ? "\u2713 allow load" : "\u2717 block load"));
    }
    function tg(key, label) {
      var b = h("button", { class: flags[key] ? "active" : "" }, label);
      b.addEventListener("click", function () { flags[key] = !flags[key]; b.classList.toggle("active"); paint(); });
      return b;
    }
    var toggles = h("div", { class: "w-seg" }, tg("email", "null email"), tg("dup", "dup id"), tg("neg", "negative amt"), tg("status", "bad status"));
    mount.appendChild(h("div", { class: "widget-controls" }, h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "inject:"), toggles));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 3 — Lineage / impact analysis */
  window.Widgets["de-ops-lineage"] = function (mount) {
    shell(mount, "explorer", "Lineage & Impact",
      "Click any asset to highlight everything upstream that feeds it and everything downstream it would break.");
    var nodes = {
      src_app: { x: 55, y: 70, label: "src_app" },
      src_pay: { x: 55, y: 170, label: "src_pay" },
      stg_ord: { x: 185, y: 70, label: "stg_orders" },
      stg_pay: { x: 185, y: 170, label: "stg_pay" },
      mart: { x: 315, y: 120, label: "mart_finance" },
      dash_e: { x: 445, y: 70, label: "dash_exec" },
      dash_o: { x: 445, y: 170, label: "dash_ops" }
    };
    var edges = [["src_app", "stg_ord"], ["src_pay", "stg_pay"], ["stg_ord", "mart"], ["stg_pay", "mart"], ["mart", "dash_e"], ["mart", "dash_o"]];
    var sel = "mart";
    var svg = svgEl("svg", { class: "graph-svg", viewBox: "0 0 510 230", role: "img" });
    var readout = h("div", { class: "w-readout" });
    function walk(start, dir) {
      var seen = {}, stack = [start];
      while (stack.length) {
        var cur = stack.pop();
        edges.forEach(function (e) {
          var from = dir === "down" ? e[0] : e[1], to = dir === "down" ? e[1] : e[0];
          if (from === cur && !seen[to]) { seen[to] = true; stack.push(to); }
        });
      }
      return seen;
    }
    function paint() {
      var up = walk(sel, "up"), down = walk(sel, "down");
      svg.innerHTML = "";
      edges.forEach(function (e) {
        var a = nodes[e[0]], b = nodes[e[1]];
        var onDown = (e[0] === sel || down[e[0]]) && (down[e[1]] || e[1] === sel === false && down[e[1]]);
        var inDown = down[e[1]] && (e[0] === sel || down[e[0]]);
        var inUp = up[e[0]] && (e[1] === sel || up[e[1]]);
        var col = inDown ? "var(--rose)" : (inUp ? "var(--cyan)" : "var(--line-strong)");
        svg.appendChild(svgEl("path", { class: "gt-edge", style: "stroke:" + col + (inDown || inUp ? ";stroke-width:3" : ""), d: "M" + (a.x + 48) + " " + a.y + " L" + (b.x - 48) + " " + b.y }));
      });
      Object.keys(nodes).forEach(function (k) {
        var g = svgEl("g", { style: "cursor:pointer" });
        var stroke = k === sel ? "var(--accent)" : (down[k] ? "var(--rose)" : (up[k] ? "var(--cyan)" : "var(--line-strong)"));
        var fill = k === sel ? "color-mix(in srgb,var(--accent) 24%,var(--surface-solid))" : "var(--surface-solid)";
        node(g, nodes[k], stroke, fill);
        g.addEventListener("click", function () { sel = k; paint(); });
        svg.appendChild(g);
      });
      var dn = Object.keys(down).length, un = Object.keys(up).length;
      readout.innerHTML = "";
      readout.appendChild(ro("selected", nodes[sel].label, true));
      readout.appendChild(ro("downstream impacted", String(dn) + " asset" + (dn === 1 ? "" : "s")));
      readout.appendChild(ro("upstream sources", String(un)));
    }
    mount.appendChild(h("div", { class: "w-stage" }, svg));
    mount.appendChild(readout);
    mount.appendChild(h("div", { class: "dsa-legend" },
      h("span", {}, h("i", { style: "background:var(--cyan)" }), "upstream (feeds it)"),
      h("span", {}, h("i", { style: "background:var(--accent)" }), "selected"),
      h("span", {}, h("i", { style: "background:var(--rose)" }), "downstream (breaks)")
    ));
    paint();
  };

  /* 4 — Task DAG vs asset graph */
  window.Widgets["de-ops-assets"] = function (mount) {
    shell(mount, "planner", "Task DAG vs Asset Graph",
      "Switch perspectives: tasks explain execution order; assets explain what data products exist and when they are fresh.");
    var mode = "asset";
    var svg = svgEl("svg", { class: "graph-svg", viewBox: "0 0 520 235", role: "img" });
    var readout = h("div", { class: "w-readout" });
    var taskNodes = {
      sense: { x: 70, y: 70, label: "wait_file" },
      load: { x: 205, y: 70, label: "load_raw" },
      dbt: { x: 340, y: 70, label: "run_dbt" },
      test: { x: 340, y: 165, label: "test_dbt" },
      publish: { x: 465, y: 115, label: "publish" }
    };
    var assetNodes = {
      raw: { x: 80, y: 115, label: "raw.orders" },
      silver: { x: 220, y: 70, label: "silver.orders" },
      gold: { x: 360, y: 70, label: "gold.orders" },
      dash: { x: 475, y: 70, label: "ops.dashboard" },
      pii: { x: 220, y: 165, label: "customer_pii" },
      masked: { x: 360, y: 165, label: "masked_dim" }
    };
    var taskEdges = [["sense", "load"], ["load", "dbt"], ["dbt", "test"], ["test", "publish"], ["dbt", "publish"]];
    var assetEdges = [["raw", "silver"], ["silver", "gold"], ["gold", "dash"], ["pii", "masked"], ["masked", "gold"]];
    function paintGraph(nodes, edges, accentKeys) {
      svg.innerHTML = "";
      edges.forEach(function (e) {
        var a = nodes[e[0]], b = nodes[e[1]];
        svg.appendChild(svgEl("path", { class: "gt-edge tree", d: "M" + (a.x + 48) + " " + a.y + " L" + (b.x - 48) + " " + b.y }));
      });
      Object.keys(nodes).forEach(function (k) {
        var g = svgEl("g", {});
        var on = accentKeys.indexOf(k) >= 0;
        node(g, nodes[k], on ? "var(--accent)" : "var(--line-strong)", on ? "color-mix(in srgb,var(--accent) 22%,var(--surface-solid))" : "var(--surface-solid)");
        svg.appendChild(g);
      });
    }
    function paint() {
      readout.innerHTML = "";
      if (mode === "task") {
        paintGraph(taskNodes, taskEdges, ["sense", "test"]);
        readout.appendChild(ro("primary question", "what runs next?", true));
        readout.appendChild(ro("best for", "operators, retries, pools"));
        readout.appendChild(ro("risk", "freshness hidden in task names"));
      } else {
        paintGraph(assetNodes, assetEdges, ["gold", "dash"]);
        readout.appendChild(ro("primary question", "what asset is stale?", true));
        readout.appendChild(ro("best for", "lineage, ownership, partitions"));
        readout.appendChild(ro("trigger", "asset materialized / event"));
      }
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "view:"),
      seg([{ v: "task", label: "task DAG" }, { v: "asset", label: "asset graph" }], function () { return mode; }, function (v) { mode = v; paint(); })
    ));
    mount.appendChild(h("div", { class: "w-stage" }, svg));
    mount.appendChild(readout);
    paint();
  };

  /* 5 — Active metadata control plane */
  window.Widgets["de-ops-metadata-plane"] = function (mount) {
    shell(mount, "control", "Metadata Control Plane",
      "Promote metadata from documentation into an operational signal: ownership, policy, quality and lineage drive workflow.");
    var state = { lineage: true, quality: false, policy: false, owner: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function tg(key, label) {
      var b = h("button", { class: state[key] ? "active" : "" }, label);
      b.addEventListener("click", function () { state[key] = !state[key]; b.classList.toggle("active"); paint(); });
      return b;
    }
    function paint() {
      stage.innerHTML = "";
      var rows = [
        ["catalog asset", "gold.orders", state.owner ? "owned" : "orphan"],
        ["glossary term", "booked revenue", state.owner ? "approved" : "draft"],
        ["OpenLineage facet", "schema + run", state.lineage ? "ingested" : "missing"],
        ["policy tag", "customer_email", state.policy ? "masked" : "raw"],
        ["quality signal", "freshness SLO", state.quality ? "green" : "unknown"]
      ];
      var board = h("div", { class: "grid-board", style: "grid-template-columns:1fr 1fr 1fr;gap:3px" });
      ["control", "example", "state"].forEach(function (c) {
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:6px;font-family:var(--font-mono);font-size:.58rem;color:var(--text-dim)" }, c));
      });
      rows.forEach(function (r) {
        r.forEach(function (c, i) {
          var good = i === 2 && /owned|approved|ingested|masked|green/.test(c);
          board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:6px 4px;font-size:.64rem;color:" + (good ? "var(--accent)" : "var(--text)") }, c));
        });
      });
      stage.appendChild(board);
      readout.innerHTML = "";
      var score = ["lineage", "quality", "policy", "owner"].filter(function (k) { return state[k]; }).length;
      readout.appendChild(ro("controls active", score + " / 4", true));
      readout.appendChild(ro("workflow", score >= 3 ? "auto-route access + alerts" : "manual triage"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "enable:"),
      h("div", { class: "w-seg" }, tg("owner", "owner"), tg("policy", "policy tags"), tg("quality", "quality"), tg("lineage", "lineage"))
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 6 — Privacy deletion workflow */
  window.Widgets["de-ops-privacy-delete"] = function (mount) {
    shell(mount, "runbook", "Privacy Deletion Workflow",
      "A deletion request is not one DELETE statement. Track every copy, retention boundary and proof artifact.");
    var step = 0, legalHold = false;
    var steps = [
      ["Discover copies", "catalog + lineage find raw, derived, search and export copies"],
      ["Protect live paths", "mask/tokenize sensitive fields while the request is processed"],
      ["Delete tables", "MERGE/DELETE by subject key and rewrite affected table snapshots"],
      ["Handle retention", "expire snapshots after policy windows; exclude legal-hold data"],
      ["Prove completion", "store request id, assets touched, counts and reviewer approval"]
    ];
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      stage.innerHTML = "";
      var log = h("div", { class: "dsa-log" });
      steps.forEach(function (s, i) {
        var done = i < step;
        var blocked = legalHold && i === 3;
        log.appendChild(h("div", { class: blocked ? "no" : (done ? "ok" : "") }, (blocked ? "! HOLD  " : (done ? "✓ DONE  " : "• TODO  ")) + s[0] + " — " + s[1]));
      });
      stage.appendChild(log);
      readout.innerHTML = "";
      readout.appendChild(ro("workflow progress", step + " / " + steps.length, true));
      readout.appendChild(ro("legal hold", legalHold ? "retain protected copies" : "none"));
      readout.appendChild(ro("audit proof", step === steps.length ? "complete" : "pending"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn primary", onclick: function () { step = Math.min(steps.length, step + 1); paint(); } }, "Advance"),
      h("button", { class: "w-btn ghost", onclick: function () { step = 0; paint(); } }, "Reset"),
      h("button", { class: "w-btn ghost", onclick: function () { legalHold = !legalHold; paint(); } }, "Toggle legal hold")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 7 — Cost engineering lab */
  window.Widgets["de-ops-cost-lab"] = function (mount) {
    shell(mount, "finops", "Warehouse Cost Lab",
      "Change scan size, warehouse size and idle behavior. The cheap fix is usually scanning less and stopping idle compute.");
    var scan = 1000, size = "M", suspend = "slow";
    var credits = { XS: 1, S: 2, M: 4, L: 8 };
    var readout = h("div", { class: "w-readout" });
    var stage = h("div", { class: "w-stage" });
    function cost() {
      var scanFactor = scan / 1000;
      var idle = suspend === "fast" ? 0.15 : 1.2;
      return Math.round((credits[size] * (scanFactor + idle)) * 100) / 100;
    }
    function paint() {
      stage.innerHTML = "";
      var rows = [
        ["query scan", scan + " GB", scan <= 120 ? "pruned" : scan <= 300 ? "better" : "wasteful"],
        ["warehouse", size, size === "L" ? "fast but pricey" : "right-sized"],
        ["auto-suspend", suspend === "fast" ? "60 seconds" : "15 minutes", suspend === "fast" ? "controlled" : "idle burn"],
        ["incident comms", "owner + ETA + spend cap", "required"]
      ];
      var board = h("div", { class: "grid-board", style: "grid-template-columns:1fr 1fr 1fr;gap:3px" });
      rows.forEach(function (r) {
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:7px;font-size:.64rem" }, r[0]));
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:7px;font-size:.64rem" }, r[1]));
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:7px;font-size:.64rem;color:" + (r[2] === "wasteful" || r[2] === "idle burn" ? "var(--rose)" : "var(--accent)") }, r[2]));
      });
      stage.appendChild(board);
      readout.innerHTML = "";
      readout.appendChild(ro("estimated credits", String(cost()), true));
      readout.appendChild(ro("first move", scan > 300 ? "add filters / materialize" : "cap concurrency"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "scan:"),
      seg([{ v: 1000, label: "1 TB" }, { v: 250, label: "250 GB" }, { v: 80, label: "80 GB" }], function () { return scan; }, function (v) { scan = v; paint(); }),
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "size:"),
      seg([{ v: "S", label: "S" }, { v: "M", label: "M" }, { v: "L", label: "L" }], function () { return size; }, function (v) { size = v; paint(); }),
      h("button", { class: "w-btn ghost", onclick: function () { suspend = suspend === "fast" ? "slow" : "fast"; paint(); } }, "Toggle suspend")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-ops-orchestration": {
      title: "Orchestration checkpoint",
      sub: "DAGs, Airflow, idempotency and backfills.",
      questions: [
        {
          q: "Why must orchestrated tasks be idempotent?",
          options: ["To run faster", "So automatic retries and backfills don\u2019t corrupt or duplicate data", "To avoid writing logs", "To skip dependencies"],
          answer: 1,
          explain: "Schedulers retry failed tasks and re-run backfills, so a task must produce the same result when re-run \u2014 otherwise a retry double-writes or corrupts the output."
        },
        {
          q: "In Airflow, the 'execution date' (logical date) is used to\u2026",
          options: ["Record wall-clock time only", "Parameterize a run for the data interval it processes, enabling deterministic backfills", "Set the timezone", "Name the DAG"],
          answer: 1,
          explain: "Tasks key their inputs/outputs to the logical date (the interval being processed), so re-running a past date reprocesses exactly that partition \u2014 making backfills deterministic."
        },
        {
          q: "A sensor in Airflow is typically used to\u2026",
          options: ["Transform data", "Wait for an external condition (a file/partition) before downstream tasks run", "Send email", "Compress files"],
          answer: 1,
          explain: "Sensors poll/await an external dependency \u2014 a file landing, a partition appearing, another DAG finishing \u2014 so downstream tasks only start when inputs are actually ready."
        }
      ]
    },
    "de-ops-assets": {
      title: "Asset orchestration checkpoint",
      sub: "Task DAGs, asset graphs, partitions and triggers.",
      questions: [
        {
          q: "What is the biggest difference between a task DAG and an asset graph?",
          options: ["A task DAG models execution steps; an asset graph models data products and their dependencies", "A task DAG cannot retry", "An asset graph never has dependencies", "They are different names for SQL joins"],
          answer: 0,
          explain: "Task DAGs answer 'what runs next?' Asset graphs answer 'which dataset exists, depends on what, and is fresh?' Both matter, but asset-centric tools make data products first-class."
        },
        {
          q: "Dataset-aware scheduling is useful because it starts downstream work when...",
          options: ["The calendar reaches midnight", "A declared upstream dataset has been updated or materialized", "A dashboard user logs in", "A warehouse is most expensive"],
          answer: 1,
          explain: "Dataset-aware scheduling removes fragile time guesses. A downstream job can run when its declared input dataset is actually available."
        },
        {
          q: "Dynamic partitions are most helpful when...",
          options: ["The set of partitions is known forever", "Partitions appear from data, tenants, regions or files discovered at runtime", "Every job writes one table only", "The pipeline has no backfills"],
          answer: 1,
          explain: "Dynamic partitions let an orchestrator materialize new keys as they appear, such as a new tenant, country or late-arriving date partition."
        },
        {
          q: "A sensor differs from an event trigger mainly because a sensor...",
          options: ["Usually polls or waits for a condition, while a trigger reacts to an emitted event", "Cannot wait for files", "Only runs SQL", "Always costs nothing"],
          answer: 0,
          explain: "Sensors watch for conditions such as a file or partition. Event triggers react to a pushed event. Triggers are often cleaner when the source can emit reliable events."
        }
      ]
    },
    "de-ops-quality": {
      title: "Data quality checkpoint",
      sub: "Dimensions, tests and contracts.",
      questions: [
        {
          q: "A dbt test like unique(id) or not_null(email) is best run\u2026",
          options: ["Never", "As part of the pipeline, blocking promotion when it fails", "Only once a year", "Only in production by hand"],
          answer: 1,
          explain: "Running tests in the pipeline (and failing the build on violation) stops bad data from propagating downstream \u2014 quality as a gate, not an afterthought."
        },
        {
          q: "Which is a dimension of data quality?",
          options: ["Compression ratio", "Completeness (no missing required values)", "Partition count", "Query cost"],
          answer: 1,
          explain: "Classic quality dimensions include accuracy, completeness, validity, uniqueness, timeliness and consistency \u2014 properties of the data itself, not of storage or cost."
        },
        {
          q: "A data contract primarily defines\u2026",
          options: ["The warehouse price", "The agreed schema and guarantees between a data producer and its consumers", "The dashboard colors", "The backup schedule"],
          answer: 1,
          explain: "A data contract pins down the schema, semantics and SLAs a producer promises, so a breaking change is caught (and negotiated) before it silently shatters downstream consumers."
        }
      ]
    },
    "de-ops-metadata": {
      title: "Metadata control plane checkpoint",
      sub: "Catalog, glossary, ownership, lineage facets and policy workflows.",
      questions: [
        {
          q: "What makes a catalog an active metadata control plane instead of a passive wiki?",
          options: ["It stores PDFs only", "Metadata changes drive workflows such as access approval, alerts, ownership routing and policy enforcement", "It has more colors", "It replaces all pipelines"],
          answer: 1,
          explain: "Active metadata is operational: ownership, lineage, glossary terms, quality results and policy tags feed automation instead of sitting unused in documentation."
        },
        {
          q: "An OpenLineage facet is best described as...",
          options: ["A typed metadata attachment to a job, run or dataset", "A dashboard filter", "A warehouse size", "A file compression codec"],
          answer: 0,
          explain: "Facets attach structured metadata such as schema, SQL, ownership, errors or data quality results to lineage events."
        },
        {
          q: "Policy tags on sensitive columns should ideally...",
          options: ["Only appear in a spreadsheet", "Drive masking, approval routing and access reviews automatically", "Be removed before production", "Disable lineage"],
          answer: 1,
          explain: "Tags are most valuable when they control behavior: who can request access, what gets masked, and which reviews/audits are required."
        },
        {
          q: "Freshness and quality signals become product signals when they...",
          options: ["Are visible to consumers and tied to an owner/SLO", "Are hidden in worker logs", "Run only once", "Ignore lineage"],
          answer: 0,
          explain: "A data product should expose whether it is fresh and trustworthy, who owns it, and what SLO it is meeting or missing."
        }
      ]
    },
    "de-ops-privacy-delete": {
      title: "Privacy deletion checkpoint",
      sub: "Deletion, retention, masking, backups and audit proof.",
      questions: [
        {
          q: "Why does a privacy deletion request begin with discovery?",
          options: ["Deletes are optional", "Data platforms create raw, derived, exported and backup copies that must be located before action", "Discovery is cheaper than SQL", "It avoids audit logs"],
          answer: 1,
          explain: "You cannot prove erasure if you do not know every place the subject's data landed. Catalog tags and lineage are the map."
        },
        {
          q: "For immutable lakehouse tables, deletion usually requires...",
          options: ["Editing a Parquet file by hand", "A table-format delete/merge that rewrites affected files and creates a new snapshot", "Dropping the whole lake", "Disabling schema checks"],
          answer: 1,
          explain: "Open table formats implement deletes by planning affected files, rewriting them without the deleted rows, and committing a new snapshot."
        },
        {
          q: "Legal hold changes a deletion workflow by...",
          options: ["Allowing immediate permanent deletion of all copies", "Requiring protected copies to be retained while access is restricted and the exception is documented", "Removing masking requirements", "Skipping the audit trail"],
          answer: 1,
          explain: "A legal hold can override normal deletion timing. The workflow must preserve required evidence, restrict access and record why retention continues."
        },
        {
          q: "Good audit proof for deletion includes...",
          options: ["Only a success toast", "Request id, subject key, assets touched, counts, retained exceptions and reviewer approval", "A screenshot of the dashboard", "The user's raw PII in logs"],
          answer: 1,
          explain: "Audit proof should show what was requested, what was changed, what could not be changed yet, and who approved it without leaking sensitive data."
        }
      ]
    },
    "de-ops-capstone": {
      title: "Platform artifact checkpoint",
      sub: "Architecture decisions, contracts, lineage, SLOs, runbooks and cost.",
      questions: [
        {
          q: "An ADR in the capstone should primarily capture...",
          options: ["Only the final answer", "The decision, context, options considered, trade-offs and consequences", "Every meeting note", "A vendor logo list"],
          answer: 1,
          explain: "Architecture Decision Records are useful because they preserve why a choice was made, not just what the choice was."
        },
        {
          q: "A contract migration plan for a breaking schema change should include...",
          options: ["Rename the column immediately", "Versioning, dual-write/backfill, consumer migration and a removal window", "Only a Slack message", "Disabling tests"],
          answer: 1,
          explain: "Breaking changes need a staged path so old and new consumers can coexist until migration completes."
        },
        {
          q: "Which artifact best turns runtime behavior into incident evidence?",
          options: ["A color palette", "OpenLineage events with job/run/dataset facets and SLO dashboard history", "A table name alone", "A monthly invoice only"],
          answer: 1,
          explain: "Runtime lineage plus SLO history shows what ran, what data it touched, whether it met promises, and where failure started."
        },
        {
          q: "A warehouse incident update should include...",
          options: ["Impact, affected datasets, current freshness, owner, mitigation, ETA and next update time", "Only 'we are checking'", "The full stack trace for consumers", "No status until fixed"],
          answer: 0,
          explain: "Consumers need decision-grade communication: what is safe, what is stale, who owns it, and when they will hear more."
        }
      ]
    },
    "de-ops-observability": {
      title: "Observability checkpoint",
      sub: "Lineage, the five pillars and incidents.",
      questions: [
        {
          q: "Data lineage is most directly useful for\u2026",
          options: ["Compressing tables", "Impact analysis and root-cause tracing across dependencies", "Encrypting columns", "Indexing"],
          answer: 1,
          explain: "Lineage maps how datasets feed each other, so you can see what a change will break (downstream impact) and where a bad number came from (upstream root cause)."
        },
        {
          q: "Which is one of the five pillars of data observability?",
          options: ["Freshness", "Compression", "Sharding", "Indexing"],
          answer: 0,
          explain: "The five pillars are freshness, volume, schema, distribution and lineage \u2014 the signals that tell you whether data is healthy, late, missing, malformed or anomalous."
        },
        {
          q: "A sudden drop in a table\u2019s row-count volume most likely indicates\u2026",
          options: ["Better performance", "An upstream failure or partial load worth investigating", "Successful compaction", "A schema improvement"],
          answer: 1,
          explain: "Volume anomalies (far fewer rows than usual) usually mean an upstream source failed or a load ran partially \u2014 exactly the kind of signal observability monitors should alert on."
        },
        {
          q: "OpenLineage events are most useful because they connect\u2026",
          options: ["Dashboard colors to users", "Jobs, runs, datasets and runtime facets into a portable lineage graph", "Object storage buckets to invoices only", "SQL keywords to syntax highlighting"],
          answer: 1,
          explain: "OpenLineage standardizes runtime metadata: which job ran, which run instance it was, which datasets it read/wrote and which facets describe schema, SQL, errors or ownership."
        }
      ]
    },
    "de-ops-governance": {
      title: "Governance & cost checkpoint",
      sub: "Catalogs, PII and FinOps.",
      questions: [
        {
          q: "A data catalog primarily helps with\u2026",
          options: ["Running queries faster", "Discovery, documentation and ownership of datasets", "Compressing data", "Replacing the warehouse"],
          answer: 1,
          explain: "A catalog makes data discoverable and trustworthy \u2014 what exists, what it means, who owns it, how fresh it is \u2014 which is foundational to governance and self-service."
        },
        {
          q: "Masking or tokenizing PII columns is an example of\u2026",
          options: ["Cost optimization", "Access control / data protection", "Partitioning", "Compaction"],
          answer: 1,
          explain: "Masking, tokenization and column-level access control limit who can see sensitive data \u2014 core to privacy regulations like GDPR and to least-privilege governance."
        },
        {
          q: "Which most reduces warehouse cost on a bursty analytical workload?",
          options: ["Never partitioning", "Auto-suspend idle compute and prune scans via partitioning/clustering", "Always running the largest warehouse", "Disabling caching"],
          answer: 1,
          explain: "Per-second billing rewards suspending idle compute, and scanning less data (partition/cluster pruning) cuts the dominant cost \u2014 the heart of FinOps for data."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.orchestration = {
    id: "orchestration", name: "Orchestration & DataOps", short: "OPS",
    tagline: "Schedule it, trust it, watch it", color: "#5eead4",
    blurb: "Run data products reliably: DAGs, asset graphs, schedules, retries and backfills; quality gates and contracts; lineage, metadata, SLOs, incident response, privacy workflow and FinOps.",
    modules: [
      {
        id: "orchestration", name: "Orchestration", icon: "share",
        lessons: [
          {
            id: "dags", title: "DAGs & workflow orchestration",
            summary: "Model a pipeline as a dependency graph so tasks run in the right order, with retries.",
            minutes: 7, tags: ["dag", "scheduling"],
            blocks: [
              { t: "p", html: "An <strong>orchestrator</strong> models a pipeline as a <strong>DAG</strong> (directed acyclic graph) of tasks: edges are dependencies, so a task runs only after its upstreams succeed. The scheduler handles ordering, retries, alerting and backfills." },
              { t: "widget", id: "de-ops-dag" },
              { t: "p", html: "Because tasks retry and backfill, they must be <strong>idempotent</strong> (safe to re-run) and <strong>atomic</strong> (don\u2019t leave half-written output). A failed task should be re-runnable with no manual cleanup." },
              { t: "note", variant: "key", html: "The DAG is the contract: upstream success gates downstream start, and a failure stops the affected branch while independent branches keep running. That\u2019s how one bad task doesn\u2019t silently corrupt everything below it." }
            ]
          },
          {
            id: "airflow", title: "Airflow: operators, sensors & scheduling",
            summary: "The de-facto orchestrator \u2014 DAGs of operators, sensors for waiting, schedules for timing.",
            minutes: 7, tags: ["airflow"],
            blocks: [
              { t: "p", html: "<strong>Apache Airflow</strong> defines pipelines as Python <strong>DAGs</strong>. A <strong>task</strong> is an instance of an <strong>operator</strong> (a unit of work \u2014 run SQL, call an API, trigger Spark). <strong>Sensors</strong> wait for a condition; the <strong>scheduler</strong> + <strong>executor</strong> run tasks on a " + tok("schedule_interval") + "." },
              { t: "code", lang: "python", code:
                "with DAG(\"daily_sales\", schedule=\"@daily\", catchup=True) as dag:\n" +
                "    wait = FileSensor(task_id=\"wait_raw\", filepath=\"/in/{{ ds }}.csv\")\n" +
                "    load = PythonOperator(task_id=\"load\", python_callable=load_day)\n" +
                "    publish = PythonOperator(task_id=\"publish\", python_callable=publish)\n" +
                "    wait >> load >> publish" },
              { t: "note", variant: "key", html: "The " + tok(">>") + " operator wires dependencies. " + tok("{{ ds }}") + " is the run\u2019s logical date \u2014 the key to deterministic, idempotent runs and backfills." },
              { t: "note", variant: "tip", html: "Keep operators thin and idempotent; push heavy logic into the systems they call (the warehouse, Spark). Airflow should orchestrate, not compute." }
            ]
          },
          {
            id: "asset-orchestration", title: "Asset-centric orchestration",
            summary: "Move from 'tasks ran' to 'data products are fresh, owned and materialized'.",
            minutes: 8, tags: ["dagster", "assets", "partitions"],
            blocks: [
              { t: "p", html: "Classic orchestrators model <strong>tasks</strong>: run this Python function, then that SQL step. Asset-centric orchestration models the <strong>datasets</strong> those tasks produce: " + tok("raw.orders") + ", " + tok("silver.orders") + ", " + tok("gold.orders") + ". The operating question becomes asset health, not just task status." },
              { t: "widget", id: "de-ops-assets" },
              { t: "compare",
                bad: { title: "Task-first view", items: ["Great for operators, retries and executor slots", "Harder to answer which table is stale", "Lineage often inferred after the fact", "Partitions live in code conventions"] },
                good: { title: "Asset-first view", items: ["Datasets, owners and freshness are first-class", "Materialize only missing or stale partitions", "Lineage is declared in the graph", "Quality and SLOs attach to the asset"] }
              },
              { t: "p", html: "<strong>Airflow</strong> still shines for broad workflow control. <strong>Dagster-style assets</strong> shine when lineage, partitions, checks and owners should attach to datasets directly. Many teams use task DAGs for execution detail and asset graphs for the product view." },
              { t: "note", variant: "key", html: "The maturity jump is asking 'is " + tok("gold.orders") + " fresh and trustworthy?' instead of only 'did task " + tok("run_dbt") + " finish?'" }
            ]
          },
          {
            id: "dataset-aware-partitions", title: "Dataset-aware schedules & dynamic partitions",
            summary: "Wait for data, materialize the right partitions, and trigger flows from real events.",
            minutes: 8, tags: ["dataset-aware", "sensors", "events"],
            blocks: [
              { t: "p", html: "A resilient schedule follows <strong>data availability</strong>, not hope. Dataset-aware scheduling starts a downstream job when a declared input dataset updates. <strong>Dynamic partitions</strong> let the partition set come from runtime facts: a new tenant, region, file, date or customer segment." },
              { t: "table", headers: ["Pattern", "Use when", "Operational concern"], rows: [
                ["Sensor", "The source cannot push events, so the orchestrator waits or polls", "Tune poke interval and timeout so waiting does not burn workers"],
                ["Event trigger", "A source can emit a durable event when a file, message or table version lands", "Validate ordering, dedupe and replay behavior"],
                ["Dynamic partition", "Keys appear over time: tenants, countries, late dates, ad accounts", "Track partition state and retries per key"],
                ["Flow-style orchestration", "The pipeline is more programmatic than declarative", "Keep side effects idempotent and observable"]
              ] },
              { t: "p", html: "<strong>Prefect</strong> and <strong>Kestra</strong>-style flows are useful conceptually because the workflow can be ordinary code with retries, parameters and states. The trade-off is discipline: if every flow invents its own conventions, the platform loses uniform lineage and asset health." },
              { t: "note", variant: "tip", html: "Use events when the producer can emit reliable facts. Use sensors when you must observe an external condition. Use dynamic partitions when the work units are discovered, not pre-enumerated." },
              { t: "quiz", id: "de-ops-assets" }
            ]
          },
          {
            id: "retries-backfill", title: "Idempotency, retries & backfills",
            summary: "Make tasks safe to retry and re-run for past dates.",
            minutes: 6, tags: ["retries", "backfill"],
            blocks: [
              { t: "p", html: "Three intertwined ideas keep schedules reliable. <strong>Retries</strong> (with backoff) handle transient failures automatically. The <strong>logical date</strong> parameterizes each run to a data interval. <strong>Catchup/backfill</strong> runs past intervals to fill or repair history." },
              { t: "p", html: "All three demand <strong>idempotency</strong>: a task keyed to date " + tok("2024-01-02") + " must overwrite that partition, not append, so retrying or backfilling it any number of times yields the same result." },
              { t: "note", variant: "trap", html: "A task that appends or increments in place is a backfill landmine \u2014 re-running a date doubles its data. Always overwrite-by-partition or MERGE-by-key so reruns are harmless." },
              { t: "note", variant: "key", html: "Parameterize by logical date + write idempotently, and backfilling years of history becomes a button press, not a heroics project." }
            ]
          },
          {
            id: "deps-slas", title: "Dependencies, SLAs & catchup",
            summary: "Cross-pipeline dependencies, freshness SLAs, and waiting on data not clocks.",
            minutes: 6, tags: ["sla", "dependencies"],
            blocks: [
              { t: "p", html: "Real pipelines depend on each other. Rather than guessing with timers, wait on the <em>data</em>: a <strong>sensor</strong> or a <strong>dataset</strong>-triggered schedule starts a job only when its inputs actually land. An <strong>SLA</strong> defines how fresh the output must be, and alerts when it slips." },
              { t: "note", variant: "key", html: "Trigger on data availability, not on a fixed time. Time-based chaining ('run at 2am and hope the upstream finished') is the classic cause of pipelines processing yesterday\u2019s incomplete data." },
              { t: "note", variant: "tip", html: "Define SLAs in business terms ('orders mart fresh by 7am') and monitor them; an SLA miss is an early warning that an upstream is slow or broken." },
              { t: "quiz", id: "de-ops-orchestration" }
            ]
          }
        ]
      },
      {
        id: "quality", name: "Data Quality", icon: "shield",
        lessons: [
          {
            id: "quality-dimensions", title: "Dimensions of data quality",
            summary: "The properties that make data trustworthy \u2014 and measurable.",
            minutes: 6, tags: ["quality"],
            blocks: [
              { t: "p", html: "\u201cGood data\u201d isn\u2019t vague \u2014 it decomposes into measurable <strong>dimensions</strong> you can test and monitor." },
              { t: "table", headers: ["Dimension", "Question"], rows: [
                ["Accuracy", "Does it reflect reality?"],
                ["Completeness", "Are required values present?"],
                ["Validity", "Does it match the schema/format?"],
                ["Uniqueness", "Any unexpected duplicates?"],
                ["Timeliness", "Is it fresh enough?"],
                ["Consistency", "Do related sources agree?"]
              ] },
              { t: "note", variant: "key", html: "Turn each dimension into an automated check (not-null for completeness, unique for uniqueness, freshness SLA for timeliness). What you don\u2019t measure, you can\u2019t trust." }
            ]
          },
          {
            id: "testing", title: "Testing data",
            summary: "Assertions in the pipeline catch bad data before it reaches anyone.",
            minutes: 7, tags: ["tests", "great-expectations"],
            blocks: [
              { t: "p", html: "Test the <em>data</em>, not just the code. <strong>dbt tests</strong> (" + tok("not_null") + ", " + tok("unique") + ", " + tok("accepted_values") + ", " + tok("relationships") + ") and frameworks like <strong>Great Expectations</strong> assert properties on every run and fail the build when violated." },
              { t: "widget", id: "de-ops-quality" },
              { t: "code", lang: "yaml", code:
                "# schema.yml \u2014 tests run as part of the pipeline\n" +
                "models:\n" +
                "  - name: stg_orders\n" +
                "    columns:\n" +
                "      - name: order_id\n" +
                "        tests: [unique, not_null]\n" +
                "      - name: status\n" +
                "        tests:\n" +
                "          - accepted_values: { values: ['new','paid'] }" },
              { t: "note", variant: "key", html: "A failed test should <strong>block promotion</strong> of the data, just like a failed unit test blocks a deploy. That gate is what keeps a single bad load from poisoning every downstream dashboard." }
            ]
          },
          {
            id: "contracts", title: "Data contracts & schema enforcement",
            summary: "Agree the schema and guarantees between producers and consumers \u2014 and enforce them.",
            minutes: 6, tags: ["contracts", "schema-registry"],
            blocks: [
              { t: "p", html: "A <strong>data contract</strong> is an explicit agreement: the producer promises a schema, semantics and freshness; consumers build against it. A <strong>schema registry</strong> (for streams) or contract tests (for tables) enforce it and reject breaking changes." },
              { t: "compare",
                bad: { title: "No contract", items: ["Producer renames a column silently", "Every downstream job breaks at once", "Discovered in a 2am page", "Blame and firefighting"] },
                good: { title: "With a contract", items: ["Schema change is validated first", "Breaking changes are blocked or versioned", "Consumers get advance notice", "Change becomes routine"] }
              },
              { t: "note", variant: "key", html: "Contracts shift schema breakage <em>left</em> \u2014 caught at the producer\u2019s CI, not in production dashboards. They make upstream teams accountable for the data interface they expose." },
              { t: "quiz", id: "de-ops-quality" }
            ]
          },
          {
            id: "contract-migrations", title: "Contract YAML & schema migration plans",
            summary: "A breaking schema change needs a versioned contract, compatibility rules and a consumer migration window.",
            minutes: 8, tags: ["contracts", "schema", "migration"],
            blocks: [
              { t: "p", html: "A contract should be machine-readable enough to fail CI and human-readable enough to negotiate. The useful fields are not exotic: schema, nullability, semantic meaning, owner, freshness, quality checks, compatibility policy and migration notes." },
              { t: "code", lang: "yaml", code:
                "dataset: gold.orders\n" +
                "owner: commerce-analytics\n" +
                "version: 2\n" +
                "compatibility: backward-compatible-additive\n" +
                "freshness_slo: \"07:00 local business days\"\n" +
                "columns:\n" +
                "  order_id: { type: string, required: true, pii: false }\n" +
                "  booked_amount: { type: decimal(18,2), required: true, meaning: \"net booked revenue\" }\n" +
                "  customer_email: { type: string, required: false, pii: true, policy_tag: restricted_pii }\n" +
                "checks:\n" +
                "  - unique: order_id\n" +
                "  - not_null: [order_id, booked_amount]\n" +
                "migration:\n" +
                "  phase_1: add booked_amount while keeping amount\n" +
                "  phase_2: backfill and dual-write for 30 days\n" +
                "  phase_3: move consumers, then remove amount after approval" },
              { t: "ol", items: [
                "<strong>Classify the change</strong> \u2014 additive, compatible type widening, breaking rename/removal or semantic change.",
                "<strong>Version the interface</strong> \u2014 publish a v2 field/table/topic while v1 stays stable.",
                "<strong>Dual-write and backfill</strong> \u2014 produce both shapes until historical and live paths agree.",
                "<strong>Move consumers</strong> \u2014 track owners, dashboards and jobs through lineage.",
                "<strong>Retire safely</strong> \u2014 remove the old field only after the contract window closes and tests prove no usage remains."
              ] },
              { t: "note", variant: "key", html: "Schema migration is a product rollout. The contract YAML is the build gate; lineage is the consumer list; the migration plan is how you avoid a surprise outage." }
            ]
          }
        ]
      },
      {
        id: "observability", name: "Observability & Lineage", icon: "globe",
        lessons: [
          {
            id: "lineage", title: "Data lineage",
            summary: "Map how datasets feed each other to trace causes and assess impact.",
            minutes: 7, tags: ["lineage"],
            blocks: [
              { t: "p", html: "<strong>Lineage</strong> is the dependency graph of your data \u2014 which tables (and even columns) feed which. It answers the two questions you ask in every incident: <em>where did this number come from?</em> (upstream root cause) and <em>what will this change break?</em> (downstream impact)." },
              { t: "widget", id: "de-ops-lineage" },
              { t: "note", variant: "key", html: "Lineage turns 'a column changed' from a guessing game into a query: highlight downstream to scope a deploy\u2019s blast radius, or walk upstream to find the source of a bad value." },
              { t: "note", variant: "tip", html: "Column-level lineage (not just table-level) is the gold standard \u2014 it tells you a change to " + tok("orders.amount") + " affects exactly three downstream metrics, not the whole warehouse." }
            ]
          },
          {
            id: "openlineage-runtime-metadata", title: "OpenLineage & runtime metadata",
            summary: "Capture job/run/dataset events so lineage is built from what actually ran.",
            minutes: 7, tags: ["openlineage", "metadata", "rca"],
            blocks: [
              { t: "p", html: "<strong>OpenLineage</strong> is an open event model for pipeline lineage. Instead of hand-drawing a graph, orchestrators and engines emit runtime events that say: this <strong>job</strong>, in this <strong>run</strong>, read these input <strong>datasets</strong> and wrote these output datasets." },
              { t: "table", headers: ["Object", "Meaning", "Example"], rows: [
                ["Job", "The reusable definition of work", "daily_orders_mart"],
                ["Run", "One execution of that job", "run id, logical date, status"],
                ["Dataset", "A named input or output", "lake.gold.orders"],
                ["Facet", "Typed metadata attached to any object", "schema, SQL, owner, error, version"]
              ] },
              { t: "p", html: "<strong>Facets</strong> are the power move. A schema facet records columns, a SQL facet records the query, an error facet records failure details, and a data-quality facet can attach test results. Together they turn logs into a searchable dependency graph." },
              { t: "ul", items: [
                "<strong>Impact analysis</strong> \u2014 if " + tok("orders.amount") + " changes, list the jobs, tables and dashboards downstream.",
                "<strong>Root-cause trace</strong> \u2014 if a dashboard is stale, walk upstream through run status and freshness to find the first late or failed job.",
                "<strong>Auditability</strong> \u2014 prove which code version wrote a dataset and what inputs it used."
              ] },
              { t: "code", lang: "json", code:
                "{\n" +
                "  \"eventType\": \"COMPLETE\",\n" +
                "  \"job\": { \"namespace\": \"airflow\", \"name\": \"daily_orders_mart\" },\n" +
                "  \"run\": { \"runId\": \"scheduled__2024-06-01\" },\n" +
                "  \"inputs\": [{ \"namespace\": \"lake\", \"name\": \"silver.orders\" }],\n" +
                "  \"outputs\": [{ \"namespace\": \"lake\", \"name\": \"gold.orders_mart\" }],\n" +
                "  \"facets\": { \"sql\": \"...\", \"schema\": \"...\", \"quality\": \"passed\" }\n" +
                "}" },
              { t: "note", variant: "key", html: "Runtime lineage is more trustworthy than documentation because it records what actually executed. The graph becomes incident infrastructure: scope impact, find the first bad run, then backfill only what depends on it." }
            ]
          },
          {
            id: "observability", title: "Freshness, volume & the five pillars",
            summary: "Monitor data health like you monitor services \u2014 with metrics and anomaly detection.",
            minutes: 6, tags: ["observability"],
            blocks: [
              { t: "p", html: "<strong>Data observability</strong> applies monitoring to data itself. The <strong>five pillars</strong>: <strong>freshness</strong> (is it on time?), <strong>volume</strong> (right number of rows?), <strong>schema</strong> (did columns change?), <strong>distribution</strong> (values in expected ranges?), and <strong>lineage</strong> (what\u2019s connected?)." },
              { t: "stat", items: [
                { v: "Freshness", k: "is it late?" },
                { v: "Volume", k: "too few / many rows?" },
                { v: "Distribution", k: "values anomalous?" }
              ] },
              { t: "note", variant: "key", html: "Most data incidents are silent: no error is thrown, the numbers are just wrong. Observability catches them \u2014 a 40% volume drop or a null-rate spike \u2014 before a stakeholder does." },
              { t: "note", variant: "tip", html: "Start with freshness and volume monitors on your most-used tables; they catch the majority of real incidents for little effort." }
            ]
          },
          {
            id: "incidents", title: "Incident response & RCA",
            summary: "A repeatable loop for when data breaks: detect, triage, fix, prevent.",
            minutes: 6, tags: ["incidents", "rca"],
            blocks: [
              { t: "ol", items: [
                "<strong>Detect</strong> \u2014 a monitor or a consumer flags an anomaly.",
                "<strong>Triage</strong> \u2014 scope the blast radius with lineage; communicate to affected consumers.",
                "<strong>Root-cause</strong> \u2014 walk upstream to the failing source/transform.",
                "<strong>Fix & backfill</strong> \u2014 correct, then reprocess affected partitions idempotently.",
                "<strong>Prevent</strong> \u2014 add a test/monitor so this class of bug can\u2019t recur silently."
              ] },
              { t: "note", variant: "key", html: "Treat data like a product with on-call: every incident ends by adding the check that would have caught it. Over time your test/monitor suite encodes every painful lesson." },
              { t: "note", variant: "tip", html: "Idempotent, partition-keyed pipelines make the 'fix & backfill' step safe \u2014 you reprocess just the bad dates without fear of double-counting." },
              { t: "quiz", id: "de-ops-observability" }
            ]
          }
        ]
      },
      {
        id: "production", name: "Production Readiness", icon: "wrench",
        lessons: [
          {
            id: "schema-drift", title: "Schema drift: the silent breaking change",
            summary: "How a harmless producer change can break dashboards, ML features and finance reports downstream.",
            minutes: 7, tags: ["schema", "contracts", "incident"],
            blocks: [
              { t: "p", html: "<strong>Schema drift</strong> is any unexpected change in shape or meaning: a column is renamed, a type widens from integer to string, a nullable field becomes required, or a status code gets a new value. The producer deploys cleanly; the consumers discover it at 2am." },
              { t: "table", headers: ["Signal", "What it usually means"], rows: [
                ["Column missing", "Producer renamed or stopped sending a field"],
                ["Type changed", "Serialization or source-system release changed representation"],
                ["Enum grew", "Business added a state consumers were not coded to handle"],
                ["Null-rate spike", "Upstream enrichment failed or contract was weakened"]
              ] },
              { t: "note", variant: "key", html: "Treat data schemas like APIs. Breaking changes need versioning, contract tests and consumer notification; compatible changes still need monitoring." },
              { t: "code", lang: "text", code:
                "Safe rollout:\n" +
                "1. Add new column while keeping the old one\n" +
                "2. Backfill and dual-write\n" +
                "3. Move consumers\n" +
                "4. Remove old column after an agreed window" }
            ]
          },
          {
            id: "contracts-ci", title: "Data contracts in CI",
            summary: "Move breakage detection from production dashboards into the producer's pull request.",
            minutes: 7, tags: ["contracts", "ci", "schema"],
            blocks: [
              { t: "p", html: "A contract is only real when it is enforced. <strong>Data contracts in CI</strong> check schema, nullability, allowed values, freshness promises and ownership before a producer change ships." },
              { t: "table", headers: ["Contract check", "Blocks"], rows: [
                ["Schema compatibility", "Renames, removals and unsafe type changes"],
                ["Nullability", "A required field becoming optional without a migration"],
                ["Enum values", "New states that old consumers cannot handle"],
                ["Freshness / volume expectations", "A producer lowering guarantees silently"],
                ["Ownership metadata", "Orphaned data products with no escalation path"]
              ] },
              { t: "note", variant: "key", html: "Consumer-driven contract tests are the safest version: important consumers publish the assumptions they rely on, and producer CI must keep them passing." },
              { t: "note", variant: "trap", html: "Do not rely on wiki agreements. If the contract cannot fail a build, it will eventually fail production." }
            ]
          },
          {
            id: "cdc-failures", title: "CDC failure modes",
            summary: "Change data capture is powerful because it is continuous — and dangerous when offsets, ordering or deletes are wrong.",
            minutes: 7, tags: ["cdc", "streaming", "reliability"],
            blocks: [
              { t: "p", html: "<strong>CDC</strong> turns database changes into a stream, but the stream is now part of your correctness boundary. A missed offset, duplicate event, schema change or tombstone bug can make the warehouse disagree with the source while every job still appears green." },
              { t: "table", headers: ["Failure", "Defense"], rows: [
                ["Connector restarts from the wrong offset", "Durable checkpointing and reconciliation counts"],
                ["Duplicate events after retry", "Idempotent MERGE by primary key and event version"],
                ["Out-of-order updates", "Apply only the newest source timestamp or log sequence number"],
                ["Deletes not propagated", "Handle tombstones and test delete paths, not just inserts"],
                ["Snapshot overlaps with stream", "Fence the snapshot boundary and dedupe by key/version"]
              ] },
              { t: "note", variant: "trap", html: "CDC is not automatically exactly-once. Correctness comes from checkpoint discipline plus an idempotent sink." }
            ]
          },
          {
            id: "warehouse-incidents", title: "Warehouse incidents & backfills",
            summary: "When trusted numbers are wrong, responders need lineage, ownership and a safe reprocessing path.",
            minutes: 7, tags: ["warehouse", "backfill", "rca"],
            blocks: [
              { t: "p", html: "A data incident often looks like a wrong number, not a stack trace: revenue down 18%, yesterday's orders missing, or two dashboards disagreeing. The response must repair data and tell consumers what is safe to use." },
              { t: "ol", items: [
                "<strong>Freeze blast radius</strong> — mark affected tables or dashboards stale so consumers stop making decisions on bad data.",
                "<strong>Trace lineage</strong> — walk upstream to find the first bad dataset and downstream to list every affected consumer.",
                "<strong>Repair source or transform</strong> — fix the smallest root cause, not every downstream symptom.",
                "<strong>Backfill idempotently</strong> — overwrite partitions or MERGE by key; never append blindly.",
                "<strong>Communicate closure</strong> — what was wrong, which dates changed, and which checks now prevent recurrence."
              ] },
              { t: "note", variant: "key", html: "The safest backfill is boring: parameterized by date, writes to a temporary target, validates counts and distributions, then atomically swaps or publishes." }
            ]
          },
          {
            id: "lakehouse-war-room", title: "Lab: lakehouse incident war room",
            summary: "Diagnose tiny files, stale snapshots, cost spikes and delayed dashboards without making the incident worse.",
            minutes: 10, tags: ["capstone", "lakehouse", "incident"],
            blocks: [
              { t: "p", html: "Scenario: a streaming job wrote thousands of tiny files overnight. Dashboards are two hours late, query cost doubled, the Iceberg table has stale snapshots, and consumers need an ETA. Your job is to stabilize the product, repair safely and communicate clearly." },
              { t: "table", headers: ["Signal", "Likely cause", "First response"], rows: [
                ["File count spiked; average file size tiny", "Streaming micro-batches wrote too many small files", "Pause nonessential backfills; compact hot partitions"],
                ["Snapshot count and manifests keep growing", "Maintenance missed or retention is too long for this table", "Expire old snapshots after validating rollback needs"],
                ["Storage cost rising after failed writes", "Orphan candidates from failed jobs or expired metadata", "Remove orphans only after a safe retention window"],
                ["Dashboards stale or slow", "Planning and scans spend time on metadata and tiny files", "Mark dashboards stale, publish ETA, then re-enable after validation"]
              ] },
              { t: "h", text: "War-room drill" },
              { t: "ol", items: [
                "<strong>Declare impact</strong> \u2014 name affected datasets, dashboards, freshness gap, owner and next update time.",
                "<strong>Trace lineage</strong> \u2014 identify upstream runs that produced the tiny-file burst and downstream consumers waiting on the table.",
                "<strong>Stabilize writes</strong> \u2014 stop duplicate retries, cap the streaming trigger or increase batch size, and keep new output idempotent.",
                "<strong>Run maintenance</strong> \u2014 compact hot partitions, validate counts, expire snapshots, then clean orphans after retention.",
                "<strong>Backfill bounded partitions</strong> \u2014 repair only affected dates into a shadow target, compare, then publish atomically.",
                "<strong>Close the loop</strong> \u2014 send final RCA, changed partitions, consumer action needed and the monitor/runbook added."
              ] },
              { t: "h", text: "Grading rubric" },
              { t: "table", headers: ["Criterion", "Meets bar"], rows: [
                ["Impact statement", "Names affected assets, freshness gap, owner, severity, ETA and next update time"],
                ["Safe stabilization", "Stops duplicate writes/retries before running destructive maintenance"],
                ["Maintenance plan", "Compacts first, validates counts, expires snapshots deliberately, cleans orphans after retention"],
                ["Backfill proof", "Repairs bounded partitions into a shadow target and compares counts/distributions before publish"],
                ["RCA closure", "Explains cause, changed partitions, consumer action, prevention monitor and runbook update"]
              ] },
              { t: "note", variant: "trap", html: "Do not start with orphan deletion. During an active incident, a too-short cleanup window can delete files from a still-running writer or long query. Stabilize and validate before destructive cleanup." },
              { t: "note", variant: "key", html: "A good lakehouse incident response balances three tracks: <strong>maintenance</strong> to restore layout, <strong>backfill</strong> to repair correctness, and <strong>communication</strong> so consumers know what changed and when to trust it." },
              { t: "note", variant: "tip", html: "After drafting your answer, compare it with the <a class='inline' href='#/scenarios/lakehouse-tiny-file-incident'>tiny-file scenario outline</a> and grade it with the <a class='inline' href='#/rubrics'>practice rubrics</a>." }
            ]
          },
          {
            id: "pipeline-slos", title: "Data product SLOs",
            summary: "Define reliability from the consumer's view: freshness, completeness, accuracy and latency.",
            minutes: 6, tags: ["slo", "observability", "data-product"],
            blocks: [
              { t: "p", html: "Data reliability should be promised in terms consumers understand. A table is not 'up' because the job succeeded; it is reliable when the data is fresh, complete, accurate enough and available before decisions are made." },
              { t: "table", headers: ["SLI", "Example SLO"], rows: [
                ["Freshness", "Gold orders table updated by 07:00 local time on business days"],
                ["Completeness", "Row count within 2% of source reconciliation for the same interval"],
                ["Accuracy", "Revenue variance against source ledger below agreed threshold"],
                ["Latency", "CDC changes visible in the mart within five minutes"],
                ["Quality", "Critical tests pass before publication"]
              ] },
              { t: "note", variant: "tip", html: "Alert on consumer impact, not every internal retry. Page when the SLO is burning, not when an invisible transient self-heals." }
            ]
          },
          {
            id: "cost-incidents", title: "Cost incidents: the runaway query",
            summary: "Cloud data systems fail financially too: a single dashboard or backfill can burn the monthly budget.",
            minutes: 6, tags: ["cost", "finops", "incident"],
            blocks: [
              { t: "p", html: "In elastic analytics, failure can mean <em>too much success</em>: a dashboard refreshes every minute, a query loses partition pruning, or a backfill runs on the largest warehouse all weekend. The bill is the alert." },
              { t: "table", headers: ["Root cause", "Patch"], rows: [
                ["SELECT * over wide historical tables", "Column projection, partition filters and query review"],
                ["Auto-suspend disabled", "Short idle timeout and workload-specific warehouses"],
                ["Cartesian join or missing join key", "Query linting, row-count guardrails and EXPLAIN review"],
                ["Backfill scans all history repeatedly", "Process bounded partitions once and checkpoint progress"],
                ["No owner on expensive jobs", "Showback/chargeback with dataset and job ownership"]
              ] },
              { t: "note", variant: "tip", html: "Cost observability belongs next to freshness and quality. Alert on spend anomalies before finance becomes your monitoring system." }
            ]
          },
          {
            id: "privacy-by-design", title: "Privacy by design in data platforms",
            summary: "PII handling is not a masking checkbox; it shapes ingestion, storage, access, retention and deletion.",
            minutes: 7, tags: ["privacy", "pii", "governance"],
            blocks: [
              { t: "p", html: "Data platforms copy data by design. That makes privacy an architectural requirement: know where sensitive fields enter, where they are transformed, who can query them, how long they stay, and how to delete them when policy requires it." },
              { t: "ul", items: [
                "<strong>Minimize</strong> — do not ingest PII that the product does not need.",
                "<strong>Classify early</strong> — tag sensitive columns at ingestion and carry tags through lineage.",
                "<strong>Protect by default</strong> — masking, tokenization and row/column policies should be automatic from classification.",
                "<strong>Separate duties</strong> — platform admins should not automatically see raw sensitive data.",
                "<strong>Design erasure</strong> — use keys, manifests and table formats that make targeted deletion auditable."
              ] },
              { t: "note", variant: "key", html: "The hard privacy question is not 'is this encrypted?' It is 'can we find every copy, prove who accessed it, and delete it when required?'" }
            ]
          },
          {
            id: "backfill-playbook", title: "Safe backfills & incident communication",
            summary: "Reprocessing history is normal; doing it without scope, validation and communication is how one incident becomes two.",
            minutes: 7, tags: ["backfill", "incident", "runbook"],
            blocks: [
              { t: "p", html: "Backfills repair history, load a new model, or recover from a bad transform. They are high-risk because they rewrite trusted numbers. Treat them like production changes with a plan, owner and rollback." },
              { t: "ol", items: [
                "<strong>Scope</strong> the exact partitions, tables and consumers affected.",
                "<strong>Dry-run</strong> counts and distributions into a shadow table.",
                "<strong>Validate</strong> source-to-target reconciliation before publish.",
                "<strong>Swap atomically</strong> or publish partition by partition with checkpoints.",
                "<strong>Communicate</strong> what changed, which dates are affected, ETA, workaround and final RCA."
              ] },
              { t: "note", variant: "key", html: "A vague alert like 'pipeline failed' is not communication. Consumers need impact, freshness, affected datasets, owner and next update time." }
            ]
          },
          {
            id: "platform-artifact-capstone", title: "Capstone: platform artifact pack",
            summary: "Produce the artifacts a real platform review would expect: ADR, contracts, graph, lineage, SLOs and runbooks.",
            minutes: 12, tags: ["capstone", "adr", "lineage", "runbook"],
            blocks: [
              { t: "p", html: "This capstone is not a single diagram. It is the artifact pack that lets another engineer operate the platform after you leave the room. The scenario: an orders product must serve executive BI, operational dashboards, backfills, privacy deletion and near-real-time updates." },
              { t: "h", text: "1. Architecture Decision Record" },
              { t: "table", headers: ["Choice", "When it wins", "Trade-off to document"], rows: [
                ["Batch lakehouse", "Finance wants replayable history, low cost and governed tables", "Higher latency than event-first serving"],
                ["Streaming mart", "Operations needs fresh metrics within minutes", "More state, offset and late-event complexity"],
                ["Hybrid lakehouse", "CDC stream lands into bronze/silver/gold with batch backfills", "Two operating modes must share contracts and lineage"]
              ] },
              { t: "note", variant: "key", html: "The ADR should name the decision, context, rejected options, consequences and rollback trigger. Do not write 'we chose lakehouse' without explaining what latency, replay, governance and cost trade-offs made it right." },
              { t: "h", text: "2. Contract and migration plan" },
              { t: "code", lang: "yaml", code:
                "contract: orders_product.v2\n" +
                "producer: commerce-db-cdc\n" +
                "consumers: [exec_revenue, ops_fulfillment, finance_close]\n" +
                "compatibility: add_then_deprecate\n" +
                "schema:\n" +
                "  order_id: { type: string, required: true, key: true }\n" +
                "  event_time: { type: timestamp, required: true }\n" +
                "  booked_amount: { type: decimal(18,2), required: true }\n" +
                "  customer_token: { type: string, required: false, policy_tag: pii_token }\n" +
                "migration:\n" +
                "  dual_write: [amount, booked_amount]\n" +
                "  backfill_window: \"2024-01-01..present\"\n" +
                "  consumer_cutover: \"30 days after validation\"\n" +
                "  removal_gate: \"no lineage usage of amount for 14 days\"" },
              { t: "h", text: "3. DAG and dbt graph" },
              { t: "code", lang: "text", code:
                "Airflow/Dagster graph:\n" +
                "  cdc_snapshot_orders -> bronze.orders -> silver.orders -> gold.fct_orders -> dashboards\n" +
                "  cdc_orders_stream  -> bronze.orders -> silver.orders -> gold.fct_orders -> freshness SLO\n" +
                "\n" +
                "dbt graph:\n" +
                "  source('bronze','orders')\n" +
                "    -> stg_orders\n" +
                "    -> int_orders_enriched\n" +
                "    -> fct_orders\n" +
                "    -> mart_revenue_daily" },
              { t: "h", text: "4. OpenLineage event and SLO dashboard" },
              { t: "code", lang: "json", code:
                "{\n" +
                "  \"eventType\": \"COMPLETE\",\n" +
                "  \"job\": { \"namespace\": \"cascade.capstone\", \"name\": \"build_fct_orders\" },\n" +
                "  \"run\": { \"runId\": \"scheduled__2024-06-01T07:00\" },\n" +
                "  \"inputs\": [{ \"namespace\": \"lake\", \"name\": \"silver.orders\" }],\n" +
                "  \"outputs\": [{ \"namespace\": \"lake\", \"name\": \"gold.fct_orders\" }],\n" +
                "  \"facets\": {\n" +
                "    \"schema\": \"order_id,event_time,booked_amount,customer_token\",\n" +
                "    \"quality\": \"critical_tests_passed\",\n" +
                "    \"slo\": \"fresh_by_07_00_met\",\n" +
                "    \"owner\": \"commerce-analytics\"\n" +
                "  }\n" +
                "}" },
              { t: "table", headers: ["Dashboard tile", "Healthy", "Page when"], rows: [
                ["Freshness", "gold.fct_orders updated by 07:00", "SLO burn means consumers will miss decisions"],
                ["Completeness", "source/target count variance below 2%", "variance crosses threshold after retry"],
                ["Quality", "critical tests pass before publish", "failed tests block certified output"],
                ["Cost", "daily credits within forecast band", "spend anomaly persists after warehouse cap"],
                ["Consumer impact", "affected dashboards marked trusted", "stale label remains past communicated ETA"]
              ] },
              { t: "h", text: "5. Incident runbook and backfill plan" },
              { t: "ol", items: [
                "<strong>Declare impact</strong> \u2014 affected assets, dates, dashboards, current freshness and next update time.",
                "<strong>Stop expansion</strong> \u2014 pause optional backfills, freeze bad publishes and label dashboards stale.",
                "<strong>Find root cause</strong> \u2014 use lineage and run facets to locate the first failed or bad-producing job.",
                "<strong>Repair safely</strong> \u2014 patch source/transform, run bounded partitions into a shadow target, compare counts/distributions.",
                "<strong>Publish atomically</strong> \u2014 swap or promote validated partitions, then emit final lineage and quality events.",
                "<strong>Close with proof</strong> \u2014 RCA, changed partitions, consumer actions, prevention test, cost impact and owner."
              ] },
              { t: "h", text: "Grading rubric" },
              { t: "table", headers: ["Artifact", "Meets bar"], rows: [
                ["ADR", "States decision, context, rejected options, consequences and rollback trigger"],
                ["Contract pack", "Defines schema, grain, ownership, compatibility, tests and migration window"],
                ["Execution graph", "Shows orchestration and dbt dependencies with idempotent backfill boundaries"],
                ["Runtime evidence", "Includes lineage event shape, SLO dashboard tiles and consumer impact signals"],
                ["Runbook", "Covers impact comms, root-cause workflow, shadow validation, atomic publish and closure proof"]
              ] },
              { t: "note", variant: "tip", html: "A great capstone is operable. Reviewers should be able to answer: why this architecture, what contracts guard it, what graph runs it, what SLOs prove health, and exactly how to recover when it breaks." },
              { t: "note", variant: "key", html: "Use the <a class='inline' href='#/interview/orders-data-product'>orders data product prompt</a>, <a class='inline' href='#/cheatsheets/data-contract-template'>contract template</a> and <a class='inline' href='#/rubrics'>rubrics</a> as the model-answer reference set." },
              { t: "quiz", id: "de-ops-capstone" }
            ]
          },
          {
            id: "capstone-pipeline", title: "Capstone: build a production data product",
            summary: "Design the full path from operational changes to trusted analytics, with failure handling built in.",
            minutes: 12, tags: ["capstone", "data-product"],
            blocks: [
              { t: "p", html: "Capstone brief: build an orders data product for executives and operations. Source is an OLTP database, consumers need near-real-time metrics, finance needs historical correctness, and privacy requires masking customer fields." },
              { t: "h", text: "Required design" },
              { t: "ol", items: [
                "<strong>Ingest</strong>: initial snapshot plus CDC stream, with offsets and reconciliation counts.",
                "<strong>Store</strong>: raw bronze, cleaned silver and curated gold tables in an open table format.",
                "<strong>Model</strong>: star schema with order facts, customer/product dimensions and slowly changing customer attributes.",
                "<strong>Transform</strong>: idempotent incremental jobs with backfill by partition.",
                "<strong>Quality</strong>: contracts, not-null/unique tests, freshness and volume monitors.",
                "<strong>Governance</strong>: PII classification, masking policies, ownership and retention.",
                "<strong>Operate</strong>: lineage, runbooks, cost alerts and an RCA template for incidents."
              ] },
              { t: "h", text: "Grading rubric" },
              { t: "table", headers: ["Area", "Checklist"], rows: [
                ["Ingestion", "Snapshot/log boundary, CDC offsets, tombstones, dedupe and source-target reconciliation"],
                ["Lakehouse design", "Bronze/silver/gold tables, open table format, partitioning, compaction and retention policy"],
                ["Modeling", "Declared grain, facts/dimensions, SCD handling, semantic metric definitions and versioned output port"],
                ["Reliability", "Idempotent incremental jobs, late-arrival lookback, bounded backfill and quality gates"],
                ["Operations", "Owner, SLOs, lineage, privacy workflow, cost alert and incident communication template"]
              ] },
              { t: "note", variant: "tip", html: "A production data product is not done when the dashboard loads. It is done when the next schema change, late file, cost spike and deletion request have a rehearsed path." },
              { t: "note", variant: "key", html: "Before marking this complete, check your design against <a class='inline' href='#/scenarios'>scenario packs</a> for schema drift, tiny files, cost spikes and privacy deletion, then grade the answer with <a class='inline' href='#/rubrics/senior'>senior rubric signals</a>." },
              { t: "quiz", id: "de-ops-governance" }
            ]
          }
        ]
      },
      {
        id: "governance", name: "Governance & Cost", icon: "shield",
        lessons: [
          {
            id: "catalog", title: "Catalogs, metadata & discovery",
            summary: "Make data findable, understandable and owned.",
            minutes: 5, tags: ["catalog", "metadata"],
            blocks: [
              { t: "p", html: "A <strong>data catalog</strong> is the index of your data estate: what tables exist, what each column means, who owns it, how fresh it is, and how it\u2019s used. It turns a sprawling warehouse from a maze into something self-serviceable." },
              { t: "note", variant: "key", html: "Metadata is the product here: a <strong>business glossary</strong> (shared definitions), <strong>ownership</strong> (a human to ask), and <strong>popularity/usage</strong> (which table is the trusted one) are what make data discoverable and trustworthy." },
              { t: "note", variant: "tip", html: "Catalogs ingest lineage, quality results and usage automatically \u2014 the best metadata is generated by your pipelines, not hand-maintained docs that rot." }
            ]
          },
          {
            id: "active-metadata", title: "Active metadata control plane",
            summary: "Use catalog, glossary, ownership and lineage as automation inputs, not static documentation.",
            minutes: 8, tags: ["catalog", "metadata", "lineage", "policy"],
            blocks: [
              { t: "p", html: "A passive catalog answers 'where is the table?' An <strong>active metadata control plane</strong> turns metadata into workflow: owner routing, masking, freshness alerts, access review and deprecation warnings." },
              { t: "widget", id: "de-ops-metadata-plane" },
              { t: "table", headers: ["Metadata stream", "Example source", "What it controls"], rows: [
                ["Technical metadata", "warehouse schemas, dbt manifests, table stats", "discovery, schema drift, impact analysis"],
                ["Operational metadata", "orchestrator runs, OpenLineage facets, SLO status", "freshness alerts, RCA, backfill scope"],
                ["Business metadata", "glossary terms, certified metrics, owners", "trusted discovery and escalation"],
                ["Governance metadata", "PII tags, retention class, access approvals", "masking, deletion workflow, audit evidence"],
                ["Usage metadata", "query logs, dashboard references, consumers", "deprecation plans and popularity signals"]
              ] },
              { t: "p", html: "Catalog ingestion crawls systems and receives runtime events, then reconciles them into a graph. OpenLineage facets add execution truth: schema at run time, SQL used, errors, quality results and producer version." },
              { t: "note", variant: "key", html: "Metadata becomes active when a tag or signal changes behavior: route an access request, page an owner, mask a column, warn consumers, or block a breaking deploy." },
              { t: "quiz", id: "de-ops-metadata" }
            ]
          },
          {
            id: "governance", title: "Governance, PII & access control",
            summary: "Protect sensitive data and prove who can see what.",
            minutes: 6, tags: ["governance", "pii"],
            blocks: [
              { t: "p", html: "<strong>Governance</strong> controls who can access what, and protects sensitive data. Start by <strong>classifying</strong> columns (is this PII?), then apply <strong>masking/tokenization</strong>, <strong>row/column-level access</strong>, and role-based (<strong>RBAC</strong>) or attribute-based (<strong>ABAC</strong>) policies." },
              { t: "ul", items: [
                "<strong>Masking</strong> \u2014 show " + tok("***-**-1234") + " instead of a full SSN.",
                "<strong>Tokenization</strong> \u2014 replace a value with a reversible token kept in a vault.",
                "<strong>Right to be forgotten</strong> \u2014 GDPR/CCPA require deletable, locatable PII."
              ] },
              { t: "note", variant: "trap", html: "GDPR\u2019s right-to-erasure is hard in immutable lakes: you must be able to find and delete a person\u2019s data everywhere it landed. Table formats (Delta/Iceberg) make targeted deletes feasible \u2014 design for it early." },
              { t: "note", variant: "key", html: "Least privilege plus classification is the backbone: know which columns are sensitive, and grant access by role, not by default." }
            ]
          },
          {
            id: "privacy-deletion-retention", title: "Privacy deletion & retention workflow",
            summary: "Discover copies, delete or mask live data, respect retention/legal hold and produce audit proof.",
            minutes: 9, tags: ["privacy", "retention", "deletion", "audit"],
            blocks: [
              { t: "p", html: "Privacy deletion is an end-to-end workflow across the data estate. The request starts with an identity key, but the work spans raw zones, curated tables, derived aggregates, search exports, feature stores, snapshots, backups and legal holds." },
              { t: "widget", id: "de-ops-privacy-delete" },
              { t: "ol", items: [
                "<strong>Discover copies</strong> \u2014 use catalog tags and lineage to find raw, transformed, exported and cached locations.",
                "<strong>Classify action</strong> \u2014 delete direct identifiers, mask/tokenize fields where deletion would break required aggregates, and record retained exceptions.",
                "<strong>Apply table deletes</strong> \u2014 use table-format deletes or MERGE logic keyed by subject id; validate affected row counts.",
                "<strong>Manage snapshots</strong> \u2014 expire old snapshots only after the rollback window; do not erase data under legal hold.",
                "<strong>Handle backups</strong> \u2014 mark backup copies for expiry or restore-time deletion, because many backup systems are intentionally immutable.",
                "<strong>Prove it</strong> \u2014 emit an audit artifact with request id, assets touched, counts, exceptions, reviewer and timestamp."
              ] },
              { t: "note", variant: "trap", html: "Never log the raw subject identifier or sensitive values in the deletion proof. Store a request id and salted/hash-safe references so the audit trail does not become another privacy leak." },
              { t: "note", variant: "key", html: "Retention and deletion are not opposites. A mature platform can delete what policy allows, retain what law requires, restrict access to retained copies, and prove both decisions." },
              { t: "quiz", id: "de-ops-privacy-delete" }
            ]
          },
          {
            id: "cost", title: "Cost optimization (FinOps for data)",
            summary: "Analytics bills scale with bytes scanned and compute running \u2014 control both.",
            minutes: 6, tags: ["cost", "finops"],
            blocks: [
              { t: "p", html: "Cloud analytics costs track two things: <strong>compute</strong> (warehouse time / slots) and <strong>bytes scanned</strong>. <strong>FinOps for data</strong> is the discipline of keeping both in check without throttling the business." },
              { t: "widget", id: "de-ops-cost-lab" },
              { t: "ul", items: [
                "<strong>Auto-suspend</strong> idle warehouses; right-size them per workload.",
                "<strong>Prune scans</strong> with partitioning, clustering and " + tok("SELECT") + " of only needed columns.",
                "<strong>Materialize</strong> expensive repeated queries instead of re-scanning.",
                "<strong>Tier storage</strong> and expire old partitions; <strong>chargeback</strong> cost to teams."
              ] },
              { t: "note", variant: "key", html: "The biggest lever ties back to the storage track: <strong>scan less data</strong>. Partition pruning and column projection cut the dominant cost line far more than fiddling with warehouse size." },
              { t: "note", variant: "tip", html: "Attribute cost to teams (chargeback/showback). Nothing curbs a runaway " + tok("SELECT *") + " dashboard faster than the owning team seeing its bill." },
              { t: "quiz", id: "de-ops-governance" }
            ]
          }
        ]
      }
    ]
  };
})();
