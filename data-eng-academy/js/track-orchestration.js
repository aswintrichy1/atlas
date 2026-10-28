/* =====================================================================
   CASCADE · Orchestration & Quality track  (curriculum + quizzes + widgets)
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
    return h("span", { class: "ro" }, label + " ", h("b", accent ? { style: "color:var(--accent-ink)" } : {}, value));
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
        var col = inDown ? "var(--rose-ink)" : (inUp ? "var(--cyan-ink)" : "var(--line-strong)");
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

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-ops-orchestration": {
      title: "Orchestration checkpoint",
      sub: "DAGs, Airflow, retries, catchup and SLAs.",
      questions: [
        {
          q: "Why must orchestrated tasks be idempotent?",
          options: ["To run faster", "To avoid writing logs", "So automatic retries and backfills don\u2019t corrupt or duplicate data", "To skip dependencies"],
          answer: 2,
          explain: "Schedulers retry failed tasks and re-run backfills, so a task must produce the same result when re-run \u2014 otherwise a retry double-writes or corrupts the output."
        },
        {
          q: "In Airflow, the 'execution date' (logical date) is used to\u2026",
          options: ["Record wall-clock time only", "Name the DAG", "Set the timezone", "Parameterize a run for the data interval it processes, enabling deterministic backfills"],
          answer: 3,
          explain: "Tasks key their inputs/outputs to the logical date (the interval being processed), so re-running a past date reprocesses exactly that partition \u2014 making backfills deterministic."
        },
        {
          q: "A sensor in Airflow is typically used to\u2026",
          options: ["Wait for an external condition (a file/partition) before downstream tasks run", "Transform data", "Send email", "Compress files"],
          answer: 0,
          explain: "Sensors poll/await an external dependency \u2014 a file landing, a partition appearing, another DAG finishing \u2014 so downstream tasks only start when inputs are actually ready."
        },
        {
          q: "A task calls a flaky partner API. Which retry policy fits best?",
          options: ["Unlimited immediate retries until it succeeds", "A bounded number of retries with exponential backoff, then fail and alert", "No retries \u2014 page a human on the first error", "Retry only when the next scheduled run starts"],
          answer: 1,
          explain: "Bounded retries with backoff ride out transient errors without hammering a struggling dependency. Once they are exhausted the task fails loudly, so a real outage is not hidden behind hours of silent retrying."
        },
        {
          q: "Why does a green DAG not prove the morning dashboard is right?",
          options: ["Orchestrators cannot record task duration", "SLAs only apply to streaming pipelines", "Task success says the code ran, not that the output was complete, fresh and correct", "Dashboards always cache yesterday\u2019s data"],
          answer: 2,
          explain: "Task status describes execution. Whether the data it produced was complete and on time has to be measured on the output itself \u2014 freshness and volume checks on the published table, tied to the SLA."
        }
      ]
    },
    "de-ops-assets": {
      title: "Asset orchestration checkpoint",
      sub: "Task DAGs, asset graphs, partitions and triggers.",
      questions: [
        {
          q: "What is the biggest difference between a task DAG and an asset graph?",
          options: ["A task DAG cannot retry", "A task DAG models execution steps; an asset graph models data products and their dependencies", "An asset graph never has dependencies", "They are different names for SQL joins"],
          answer: 1,
          explain: "Task DAGs answer 'what runs next?' Asset graphs answer 'which dataset exists, depends on what, and is fresh?' Both matter, but asset-centric tools make data products first-class."
        },
        {
          q: "Dataset-aware scheduling is useful because it starts downstream work when...",
          options: ["The calendar reaches midnight", "A dashboard user logs in", "A declared upstream dataset has been updated or materialized", "A warehouse is most expensive"],
          answer: 2,
          explain: "Dataset-aware scheduling removes fragile time guesses. A downstream job can run when its declared input dataset is actually available."
        },
        {
          q: "Dynamic partitions are most helpful when...",
          options: ["The set of partitions is known forever", "The pipeline has no backfills", "Every job writes one table only", "Partitions appear from data, tenants, regions or files discovered at runtime"],
          answer: 3,
          explain: "Dynamic partitions let an orchestrator materialize new keys as they appear, such as a new tenant, country or late-arriving date partition."
        },
        {
          q: "A sensor differs from an event trigger mainly because a sensor...",
          options: ["Usually polls or waits for a condition, while a trigger reacts to an emitted event", "Cannot wait for files", "Only runs SQL", "Always costs nothing"],
          answer: 0,
          explain: "Sensors watch for conditions such as a file or partition. Event triggers react to a pushed event. Triggers are often cleaner when the source can emit reliable events."
        },
        {
          q: "One tenant partition keeps failing while the others succeed. What does per-key partition state give you?",
          options: ["The whole batch is held back until that tenant passes", "All partitions are merged into one larger run", "That tenant retries and fails on its own while the other partitions publish", "Retries are no longer needed for any partition"],
          answer: 2,
          explain: "Tracking state per dynamic partition isolates failures: the bad key retries and alerts on its own, and healthy tenants are not blocked by it."
        }
      ]
    },
    "de-ops-quality": {
      title: "Data quality checkpoint",
      sub: "Dimensions, tests, contracts and CI enforcement.",
      questions: [
        {
          q: "A dbt test like unique(id) or not_null(email) is best run\u2026",
          options: ["Never", "As part of the pipeline, blocking promotion when it fails", "Only once a year", "Only in production by hand"],
          answer: 1,
          explain: "Running tests in the pipeline (and failing the build on violation) stops bad data from propagating downstream \u2014 quality as a gate, not an afterthought."
        },
        {
          q: "Which is a dimension of data quality?",
          options: ["Compression ratio", "Partition count", "Completeness (no missing required values)", "Query cost"],
          answer: 2,
          explain: "Classic quality dimensions include accuracy, completeness, validity, uniqueness, timeliness and consistency \u2014 properties of the data itself, not of storage or cost."
        },
        {
          q: "A data contract primarily defines\u2026",
          options: ["The warehouse price", "The backup schedule", "The dashboard colors", "The agreed schema and guarantees between a data producer and its consumers"],
          answer: 3,
          explain: "A data contract pins down the schema, semantics and SLAs a producer promises, so a breaking change is caught (and negotiated) before it silently shatters downstream consumers."
        },
        {
          q: "Which check best measures the timeliness dimension?",
          options: ["A freshness assertion on max(loaded_at) against an agreed threshold", "unique(order_id)", "accepted_values on status", "not_null on customer_email"],
          answer: 0,
          explain: "Timeliness asks whether data is fresh enough to use, so a freshness check against an SLA measures it. Uniqueness, validity and completeness are what the other three tests cover."
        },
        {
          q: "Where is a breaking column rename caught most cheaply?",
          options: ["In a consumer\u2019s dashboard after the deploy", "In the producer\u2019s pull request, by a contract compatibility check", "In the monthly data-quality review", "On the next warehouse invoice"],
          answer: 1,
          explain: "Contracts enforced in CI shift breakage left: the compatibility check fails the producer\u2019s build, forcing either a fix or a versioned migration before any consumer sees the change."
        }
      ]
    },
    "de-ops-observability": {
      title: "Observability checkpoint",
      sub: "Lineage, the five pillars and incidents.",
      questions: [
        {
          q: "Data lineage is most directly useful for\u2026",
          options: ["Impact analysis and root-cause tracing across dependencies", "Compressing tables", "Encrypting columns", "Indexing"],
          answer: 0,
          explain: "Lineage maps how datasets feed each other, so you can see what a change will break (downstream impact) and where a bad number came from (upstream root cause)."
        },
        {
          q: "Which is one of the five pillars of data observability?",
          options: ["Compression", "Freshness", "Sharding", "Indexing"],
          answer: 1,
          explain: "The five pillars are freshness, volume, schema, distribution and lineage \u2014 the signals that tell you whether data is healthy, late, missing, malformed or anomalous."
        },
        {
          q: "A sudden drop in a table\u2019s row-count volume most likely indicates\u2026",
          options: ["Better performance", "Successful compaction", "An upstream failure or partial load worth investigating", "A schema improvement"],
          answer: 2,
          explain: "Volume anomalies (far fewer rows than usual) usually mean an upstream source failed or a load ran partially \u2014 exactly the kind of signal observability monitors should alert on."
        },
        {
          q: "OpenLineage events are most useful because they connect\u2026",
          options: ["Dashboard colors to users", "SQL keywords to syntax highlighting", "Object storage buckets to invoices only", "Jobs, runs, datasets and runtime facets into a portable lineage graph"],
          answer: 3,
          explain: "OpenLineage standardizes runtime metadata: which job ran, which run instance it was, which datasets it read/wrote and which facets describe schema, SQL, errors or ownership."
        },
        {
          q: "Before the root cause is known, which incident step most reduces harm to consumers?",
          options: ["Writing the post-mortem", "Resizing the warehouse", "Rewriting the suspect transform", "Marking affected tables untrusted and publishing the next update time"],
          answer: 3,
          explain: "Bad data keeps serving confident answers. Flagging affected assets and setting expectations stops new decisions being made on wrong numbers while responders debug."
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
    id: "orchestration", name: "Orchestration & Quality", short: "OPS",
    tagline: "Schedule it, trust it, watch it", color: "#5eead4",
    blurb: "Run pipelines reliably and prove the data is right: DAGs, asset graphs, schedules, retries and catchup; quality dimensions, tests and contracts enforced in CI; lineage, OpenLineage, the five observability pillars and incident response.",
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
              { t: "note", variant: "tip", html: "The " + tok(">>") + " operator wires dependencies. " + tok("{{ ds }}") + " is the run\u2019s logical date \u2014 the key to deterministic, idempotent runs and backfills." },
              { t: "p", html: "<strong>Retries</strong> with backoff absorb transient failures automatically: set " + tok("retries") + " and " + tok("retry_delay") + " (optionally " + tok("retry_exponential_backoff") + ") per task, and keep them bounded so a genuinely broken dependency fails loudly instead of retrying for hours. <strong>Catchup</strong> (" + tok("catchup=True") + ") runs every missed interval since " + tok("start_date") + " — the same mechanism you use to backfill history." },
              { t: "note", variant: "trap", html: "Retries and catchup re-run tasks that may already have written output. A task that appends or increments in place doubles its data on every rerun — write by overwriting the run’s partition or MERGE by key. The full treatment is in <a class=\"inline\" href=\"#/storage/ingestion/incremental-idempotent\">Incremental loads &amp; idempotency</a>; the history-repair side is in <a class=\"inline\" href=\"#/batch/elt/incremental-backfill\">Incremental models &amp; backfills</a>." },
              { t: "note", variant: "tip", html: "Keep operators thin and idempotent; push heavy logic into the systems they call (the warehouse, Spark). Airflow should orchestrate, not compute." },
              { t: "note", variant: "key", html: "<strong>An orchestrator exists to make a run reproducible, not to do the work.</strong> Everything a task needs has to arrive through its logical date and its declared inputs, because the scheduler will run it again \u2014 on a retry, on catchup, on a backfill of a year of history. A task that reads <em>now</em> instead of its own interval returns a different answer every time it is replayed, and you will not find out until the day you have to reprocess." }
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
              { t: "note", variant: "key", html: "<strong>Waiting is cheap to write and expensive to run.</strong> A sensor occupies a worker for as long as the upstream is late, so a handful of polite pollers can crowd out the scheduler at exactly the moment a slow morning needs its capacity back \u2014 while an event trigger costs you a producer that must emit durable, deduplicated facts. Choose by which cost you can absorb at peak, and give every dynamic partition its own retry state so one bad tenant fails alone instead of failing the batch." },
              { t: "quiz", id: "de-ops-assets" }
            ]
          },
          {
            id: "deps-slas", title: "Dependencies, SLAs & catchup",
            summary: "Cross-pipeline dependencies, freshness SLAs, and waiting on data not clocks.",
            minutes: 6, tags: ["sla", "dependencies"],
            blocks: [
              { t: "p", html: "Real pipelines depend on each other. Rather than guessing with timers, wait on the <em>data</em>: a <strong>sensor</strong> or a <strong>dataset</strong>-triggered schedule starts a job only when its inputs actually land. An <strong>SLA</strong> defines how fresh the output must be, and alerts when it slips." },
              { t: "note", variant: "tip", html: "Trigger on data availability, not on a fixed time. Time-based chaining ('run at 2am and hope the upstream finished') is the classic cause of pipelines processing yesterday\u2019s incomplete data." },
              { t: "note", variant: "tip", html: "Define SLAs in business terms ('orders mart fresh by 7am') and monitor them; an SLA miss is an early warning that an upstream is slow or broken." },
              { t: "note", variant: "key", html: "<strong>An SLA is a promise about the output, so it has to be measured on the output.</strong> A green DAG only tells you the tasks you scheduled finished; it says nothing about whether the data those tasks produced was complete or arrived in time to be used. The distance between those two statements is where every \u201cthe dashboard was wrong and nothing failed\u201d incident lives." },
              { t: "quiz", id: "de-ops-orchestration" }
            ]
          }
        ]
      },
      {
        id: "quality", name: "Data Quality & Contracts", icon: "shield",
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
            id: "contracts-ci", title: "Contracts in CI & schema migration plans",
            summary: "Make the contract machine-checkable, fail the producer's pull request on breaking changes, and roll intentional breaks out as versioned migrations.",
            minutes: 9, tags: ["contracts", "ci", "schema", "migration"],
            blocks: [
              { t: "p", html: "The <a class=\"inline\" href=\"#/orchestration/quality/contracts\">contracts lesson</a> covers what a contract promises. This one is about enforcement: a contract is only real when it can fail a build. <strong>Contracts in CI</strong> check schema, nullability, allowed values, freshness promises and ownership before a producer change ships." },
              { t: "p", html: "To do that the contract must be machine-readable enough to fail CI and human-readable enough to negotiate. The useful fields are not exotic: schema, nullability, semantic meaning, owner, freshness, quality checks, compatibility policy and migration notes." },
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
              { t: "table", headers: ["Contract check", "Blocks"], rows: [
                ["Schema compatibility", "Renames, removals and unsafe type changes"],
                ["Nullability", "A required field becoming optional without a migration"],
                ["Enum values", "New states that old consumers cannot handle"],
                ["Freshness / volume expectations", "A producer lowering guarantees silently"],
                ["Ownership metadata", "Orphaned data products with no escalation path"]
              ] },
              { t: "note", variant: "tip", html: "Consumer-driven contract tests are the safest version: important consumers publish the assumptions they rely on, and producer CI must keep them passing." },
              { t: "note", variant: "trap", html: "Do not rely on wiki agreements. If the contract cannot fail a build, it will eventually fail production." },
              { t: "h", text: "When the break is intentional" },
              { t: "p", html: "CI blocks accidental breaks. Deliberate ones \u2014 a rename, a removed column, a changed meaning \u2014 need a migration plan, because a schema migration is a product rollout: the contract YAML is the build gate, lineage is the consumer list, and the plan is how you avoid a surprise outage." },
              { t: "ol", items: [
                "<strong>Classify the change</strong> \u2014 additive, compatible type widening, breaking rename/removal or semantic change.",
                "<strong>Version the interface</strong> \u2014 publish a v2 field/table/topic while v1 stays stable.",
                "<strong>Dual-write and backfill</strong> \u2014 produce both shapes until historical and live paths agree.",
                "<strong>Move consumers</strong> \u2014 track owners, dashboards and jobs through lineage.",
                "<strong>Retire safely</strong> \u2014 remove the old field only after the contract window closes and tests prove no usage remains."
              ] },
              { t: "note", variant: "key", html: "<strong>A contract\u2019s real cost is the deprecation window, and that is the part teams forget to budget.</strong> Blocking a breaking change in CI takes an afternoon; carrying two shapes of a field while consumers migrate takes months of dual-write, reconciliation and chasing owners who have moved teams. Price the migration when you publish the interface \u2014 otherwise the check that was meant to make change routine becomes a permanent veto nobody has the time to clear." }
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
              { t: "note", variant: "tip", html: "Lineage turns 'a column changed' from a guessing game into a query: highlight downstream to scope a deploy\u2019s blast radius, or walk upstream to find the source of a bad value." },
              { t: "note", variant: "tip", html: "Column-level lineage (not just table-level) is the gold standard \u2014 it tells you a change to " + tok("orders.amount") + " affects exactly three downstream metrics, not the whole warehouse." },
              { t: "note", variant: "key", html: "<strong>Lineage is only as true as the coverage it was captured from.</strong> A graph that stops at the edge of your orchestrator misses the ad-hoc extract, the spreadsheet export and the notebook that someone scheduled elsewhere \u2014 and those are precisely the copies that surface during an incident or a deletion request. Judge a lineage system by what fraction of real data movement it observes, not by how good the diagram looks." }
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
              { t: "note", variant: "tip", html: "Most data incidents are silent: no error is thrown, the numbers are just wrong. Observability catches them \u2014 a 40% volume drop or a null-rate spike \u2014 before a stakeholder does." },
              { t: "note", variant: "tip", html: "Start with freshness and volume monitors on your most-used tables; they catch the majority of real incidents for little effort." },
              { t: "note", variant: "key", html: "<strong>Every monitor you add is a promise to answer it.</strong> These pillars are cheap to instrument and just as cheap to over-instrument: distribution checks on a seasonal metric will page all weekend, and a team that has learned to scroll past the alert channel is worse off than one with two signals it believes. Instrument the tables people make decisions from, and keep tightening the threshold until a page reliably means somebody has to act." }
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
              { t: "note", variant: "tip", html: "Treat data like a product with on-call: every incident ends by adding the check that would have caught it. Over time your test/monitor suite encodes every painful lesson." },
              { t: "note", variant: "tip", html: "Idempotent, partition-keyed pipelines make the 'fix & backfill' step safe \u2014 you reprocess just the bad dates without fear of double-counting." },
              { t: "note", variant: "key", html: "<strong>Consumers are part of the incident, not an audience for it.</strong> Unlike a down service, broken data keeps serving confident answers the whole time you are debugging \u2014 so the first move is marking the affected tables untrusted and publishing a next-update time, before the root cause is even known. You can backfill the partitions; you cannot backfill the decision someone made at nine o\u2019clock off a stale dashboard." },
              { t: "quiz", id: "de-ops-observability" }
            ]
          }
        ]
      }
    ]
  };
})();
