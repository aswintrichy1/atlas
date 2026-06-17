/* =====================================================================
   CASCADE · Batch Processing & Spark track  (curriculum + quizzes + widgets)
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
  var KEYCOLOR = { A: "var(--accent)", B: "var(--cyan)", C: "var(--violet)", the: "var(--accent)", cat: "var(--cyan)", ran: "var(--violet)", dog: "var(--rose)", sat: "var(--lime)" };

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — MapReduce word count */
  window.Widgets["de-batch-mapreduce"] = function (mount) {
    shell(mount, "simulator", "MapReduce Word Count",
      "Step through map \u2192 shuffle \u2192 reduce and watch the shuffle group identical keys together.");
    var lines = ["the cat sat", "the dog ran", "the cat ran"];
    var stage = 0; // 0 input,1 map,2 shuffle,3 reduce
    var names = ["input", "map", "shuffle", "reduce"];
    var view = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function tokens() { var t = []; lines.forEach(function (l) { l.split(" ").forEach(function (w) { t.push(w); }); }); return t; }
    function groups() { var g = {}; tokens().forEach(function (w) { (g[w] = g[w] || []).push(1); }); return g; }
    function chip(label, color) { return h("span", { class: "mstack-cell", style: "padding:5px 9px;border-color:" + (color || "var(--line-strong)") + ";color:" + (color || "var(--text)") }, label); }
    function row(label, kids) {
      var r = h("div", { style: "display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:5px 0" });
      r.appendChild(h("span", { style: "font-family:var(--font-mono);font-size:.6rem;color:var(--text-faint);min-width:74px" }, label));
      kids.forEach(function (k) { r.appendChild(k); });
      return r;
    }
    function paint() {
      view.innerHTML = "";
      if (stage === 0) {
        lines.forEach(function (l, i) { view.appendChild(row("line " + i, l.split(" ").map(function (w) { return chip(w); }))); });
      } else if (stage === 1) {
        lines.forEach(function (l, i) { view.appendChild(row("map " + i, l.split(" ").map(function (w) { return chip(w + ":1", KEYCOLOR[w]); }))); });
      } else if (stage === 2) {
        var g = groups();
        Object.keys(g).forEach(function (k) { view.appendChild(row(k, g[k].map(function () { return chip("1", KEYCOLOR[k]); }))); });
      } else {
        var g2 = groups();
        Object.keys(g2).forEach(function (k) { view.appendChild(row(k, [chip(k + " = " + g2[k].length, KEYCOLOR[k])])); });
      }
      readout.innerHTML = "";
      readout.appendChild(ro("stage", names[stage], true));
      readout.appendChild(ro("note", stage === 2 ? "keys grouped across mappers (network shuffle)" : stage === 1 ? "each word \u2192 (word, 1)" : stage === 3 ? "sum each group" : "raw lines"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn primary", onclick: function () { stage = Math.min(3, stage + 1); paint(); } }, "Step \u2192"),
      h("button", { class: "w-btn ghost", onclick: function () { stage = 0; paint(); } }, "Reset")
    ));
    mount.appendChild(view);
    mount.appendChild(readout);
    paint();
  };

  /* 2 — Shuffle / exchange */
  window.Widgets["de-batch-exchange"] = function (mount) {
    shell(mount, "visualizer", "Shuffle Lab",
      "Narrow transformations keep data in place; a wide transformation reshuffles records by key across the network.");
    var input = [["A", "B"], ["A", "C"], ["B", "B"], ["C", "A"]];
    var mode = "narrow";
    var shuffled = false;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function cell(k) { return h("div", { class: "dsa-cell", style: "min-width:30px;border-color:" + KEYCOLOR[k] + ";color:" + KEYCOLOR[k] }, k); }
    function partRow(label, parts) {
      var wrap = h("div", { style: "margin:6px 0" });
      wrap.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.6rem;color:var(--text-faint);margin-bottom:4px" }, label));
      var r = h("div", { style: "display:flex;gap:14px;flex-wrap:wrap" });
      parts.forEach(function (p, i) {
        var box = h("div", { style: "border:1px dashed var(--line-strong);border-radius:10px;padding:8px;min-width:64px" });
        box.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:.56rem;color:var(--text-faint);margin-bottom:4px" }, "P" + i));
        var cells = h("div", { class: "dsa-cells", style: "padding:0;gap:4px" });
        p.forEach(function (k) { cells.appendChild(cell(k)); });
        box.appendChild(cells);
        r.appendChild(box);
      });
      wrap.appendChild(r);
      return wrap;
    }
    function paint() {
      stage.innerHTML = "";
      stage.appendChild(partRow("input partitions", input));
      var moved = 0;
      if (mode === "narrow") {
        stage.appendChild(partRow("after map() \u2014 same partitions (narrow)", input.map(function (p) { return p.map(function (k) { return k.toLowerCase(); }); })));
      } else if (shuffled) {
        var out = [[], [], []], idx = { A: 0, B: 1, C: 2 };
        input.forEach(function (p, pi) { p.forEach(function (k) { out[idx[k]].push(k); if (idx[k] !== pi % 3) moved++; }); });
        stage.appendChild(partRow("after groupByKey() \u2014 reshuffled by key (wide)", out));
      } else {
        stage.appendChild(h("p", { style: "color:var(--text-dim);font-size:.85rem;margin-top:8px" }, "Press Shuffle to repartition records by key hash \u2192"));
      }
      readout.innerHTML = "";
      readout.appendChild(ro("dependency", mode === "narrow" ? "narrow (no exchange)" : "wide (shuffle)", true));
      if (mode === "wide" && shuffled) readout.appendChild(ro("records moved across network", String(moved)));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "narrow", label: "Narrow (map)" }, { v: "wide", label: "Wide (shuffle)" }], function () { return mode; }, function (v) { mode = v; shuffled = false; paint(); }),
      h("button", { class: "w-btn primary", onclick: function () { if (mode === "wide") { shuffled = true; paint(); } } }, "Shuffle"),
      h("button", { class: "w-btn ghost", onclick: function () { shuffled = false; paint(); } }, "Reset")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 3 — dbt DAG runner */
  window.Widgets["de-batch-dbt-dag"] = function (mount) {
    shell(mount, "simulator", "dbt DAG Runner",
      "Models build only after their parents. Run the DAG and watch dbt resolve the dependency order.");
    var nodes = {
      src_a: { x: 70, y: 50, label: "src_orders", src: true },
      src_b: { x: 70, y: 170, label: "src_customers", src: true },
      stg_a: { x: 230, y: 50, label: "stg_orders", deps: ["src_a"] },
      stg_b: { x: 230, y: 170, label: "stg_customers", deps: ["src_b"] },
      mart: { x: 390, y: 110, label: "mart_revenue", deps: ["stg_a", "stg_b"] }
    };
    var built = {}; var order = [];
    Object.keys(nodes).forEach(function (k) { if (nodes[k].src) built[k] = true; });
    var svg = svgEl("svg", { class: "graph-svg", viewBox: "0 0 460 230", role: "img" });
    var readout = h("div", { class: "w-readout" });
    function ready(k) { var n = nodes[k]; if (n.src || built[k]) return false; return (n.deps || []).every(function (d) { return built[d]; }); }
    function edges() {
      return [["src_a", "stg_a"], ["src_b", "stg_b"], ["stg_a", "mart"], ["stg_b", "mart"]];
    }
    function paint() {
      svg.innerHTML = "";
      edges().forEach(function (e) {
        var a = nodes[e[0]], b = nodes[e[1]];
        svg.appendChild(svgEl("path", { class: "gt-edge" + (built[e[1]] ? " tree" : ""), d: "M" + (a.x + 46) + " " + a.y + " L" + (b.x - 46) + " " + b.y }));
      });
      Object.keys(nodes).forEach(function (k) {
        var n = nodes[k];
        var cls = "gt-node";
        if (n.src) cls += " visited";
        else if (built[k]) cls += " visited";
        else if (ready(k)) cls += " frontier";
        var g = svgEl("g", { class: cls });
        var r = svgEl("rect", { x: n.x - 46, y: n.y - 16, width: 92, height: 32, rx: 8, fill: "var(--surface-solid)", stroke: n.src ? "var(--text-faint)" : (built[k] ? "var(--accent)" : (ready(k) ? "var(--cyan)" : "var(--line-strong)")), "stroke-width": 2 });
        g.appendChild(r);
        var t = svgEl("text", { x: n.x, y: n.y, fill: "var(--text)", "font-family": "var(--font-mono)", "font-size": "10", "text-anchor": "middle", "dominant-baseline": "central" });
        t.textContent = n.label; g.appendChild(t);
        svg.appendChild(g);
      });
      readout.innerHTML = "";
      readout.appendChild(ro("build order", order.length ? order.join(" \u2192 ") : "(none yet)", true));
    }
    function buildNext() {
      var k = ["stg_a", "stg_b", "mart"].filter(function (x) { return ready(x); })[0];
      if (k) { built[k] = true; order.push(nodes[k].label); paint(); }
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn primary", onclick: buildNext }, "Build next"),
      h("button", { class: "w-btn", onclick: function () { var guard = 0; while (["stg_a", "stg_b", "mart"].some(function (x) { return ready(x); }) && guard < 10) { buildNext(); guard++; } } }, "Run all"),
      h("button", { class: "w-btn ghost", onclick: function () { built = {}; order = []; Object.keys(nodes).forEach(function (k) { if (nodes[k].src) built[k] = true; }); paint(); } }, "Reset")
    ));
    mount.appendChild(h("div", { class: "w-stage" }, svg));
    mount.appendChild(readout);
    paint();
  };

  /* 4 — Semantic metric YAML validation drill */
  window.Widgets["de-batch-semantic-yaml"] = function (mount) {
    shell(mount, "drill", "Metric Contract Validator",
      "Pick a contract check and see the exact semantic-layer issue it is meant to catch before a metric reaches BI.");
    var checks = [
      {
        id: "grain",
        label: "Entity + grain",
        snippet:
          "semantic_models:\n" +
          "  - name: orders\n" +
          "    model: ref('fct_orders')\n" +
          "    defaults:\n" +
          "      agg_time_dimension: ordered_at\n" +
          "    entities:\n" +
          "      - name: order_id\n" +
          "        type: primary\n" +
          "    measures:\n" +
          "      - name: order_total\n" +
          "        agg: sum",
        result: "valid",
        fix: "The metric has a primary entity and a declared time grain, so downstream tools know the row identity and safe aggregation path."
      },
      {
        id: "ratio",
        label: "Ratio inputs",
        snippet:
          "metrics:\n" +
          "  - name: refund_rate\n" +
          "    type: ratio\n" +
          "    type_params:\n" +
          "      numerator: refunds\n" +
          "      denominator: orders",
        result: "review filters",
        fix: "Ratio metrics should define compatible numerator and denominator measures with the same grain and filters, or the percentage will drift by dimension."
      },
      {
        id: "conversion",
        label: "Conversion window",
        snippet:
          "metrics:\n" +
          "  - name: trial_to_paid\n" +
          "    type: conversion\n" +
          "    type_params:\n" +
          "      base_measure: trials\n" +
          "      conversion_measure: paid_signups\n" +
          "      window: 14 days",
        result: "valid",
        fix: "A conversion metric must name the starting event, conversion event and time window, so late conversions are counted consistently."
      }
    ];
    var cur = checks[0];
    var code = h("code", { style: "font-size:.72rem;white-space:pre-wrap" }, "");
    var readout = h("div", { class: "w-readout" });
    var fix = h("p", { style: "font-size:.84rem;color:var(--text-dim);margin-top:8px" }, "");
    function paint() {
      code.textContent = cur.snippet;
      readout.innerHTML = "";
      readout.appendChild(ro("check", cur.label, true));
      readout.appendChild(ro("result", cur.result));
      fix.textContent = cur.fix;
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg(checks.map(function (c) { return { v: c.id, label: c.label }; }),
        function () { return cur.id; },
        function (v) { cur = checks.filter(function (c) { return c.id === v; })[0]; paint(); })
    ));
    mount.appendChild(h("div", { class: "code-card" }, h("pre", {}, code)));
    mount.appendChild(readout);
    mount.appendChild(fix);
    paint();
  };

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-batch-compute": {
      title: "Distributed compute checkpoint",
      sub: "MapReduce, Spark and lazy evaluation.",
      questions: [
        {
          q: "In Spark, a transformation like map() or filter() is\u2026",
          options: ["Executed immediately", "Lazy \u2014 it just adds to the DAG until an action runs", "A network shuffle", "A write to disk"],
          answer: 1,
          explain: "Transformations are lazy: they build up the logical DAG. Nothing runs until an action (collect, count, write) forces execution, letting Catalyst optimize the whole plan."
        },
        {
          q: "Why is Spark generally faster than classic MapReduce?",
          options: ["It avoids the network entirely", "It keeps intermediate data in memory instead of writing to disk between every stage", "It doesn\u2019t shuffle", "It uses fewer machines"],
          answer: 1,
          explain: "MapReduce materializes to disk between map and reduce stages; Spark pipelines stages and caches in memory, cutting the heavy disk I/O \u2014 especially for iterative jobs."
        },
        {
          q: "Which is an ACTION (not a transformation)?",
          options: ["select()", "filter()", "count()", "withColumn()"],
          answer: 2,
          explain: "count() forces the DAG to execute and returns a value to the driver; select/filter/withColumn are lazy transformations that only extend the plan."
        }
      ]
    },
    "de-batch-shuffle": {
      title: "Partitions & shuffle checkpoint",
      sub: "Exchanges, skew and joins.",
      questions: [
        {
          q: "A 'wide' transformation is one that\u2026",
          options: ["Adds a column", "Requires a shuffle because output partitions depend on data across input partitions", "Reads a file", "Runs on one machine"],
          answer: 1,
          explain: "Wide transformations (groupByKey, join, repartition) need records with the same key together, forcing a shuffle/exchange across the network \u2014 the expensive operations."
        },
        {
          q: "Data skew slows a job because\u2026",
          options: ["All tasks are equally loaded", "One or a few tasks get most of the rows (a hot key) and lag everyone else", "There aren\u2019t enough columns", "The schema is wrong"],
          answer: 1,
          explain: "When one key holds a huge share of rows, its task runs far longer than the rest; the stage finishes only when that straggler does. Fixes include salting and AQE skew-join handling."
        },
        {
          q: "A broadcast hash join is the right choice when\u2026",
          options: ["Both tables are huge", "One side is small enough to copy to every executor, avoiding a shuffle of the big side", "There is no join key", "You want to sort the data"],
          answer: 1,
          explain: "Broadcasting the small table to all executors lets each join its big-table partition locally \u2014 no shuffle of the large table. Sort-merge or shuffle-hash joins handle two large tables."
        }
      ]
    },
    "de-batch-elt": {
      title: "ETL, ELT & dbt checkpoint",
      sub: "Where transforms run and how dbt builds.",
      questions: [
        {
          q: "The key difference in ELT (vs ETL) is that transformations run\u2026",
          options: ["Before loading, on a separate cluster", "Inside the warehouse after loading raw data", "On the source database", "In the BI tool"],
          answer: 1,
          explain: "ELT loads raw data into the warehouse first, then transforms it there with SQL \u2014 leveraging the warehouse\u2019s elastic compute. It\u2019s why dbt and cloud warehouses rose together."
        },
        {
          q: "In dbt, ref('stg_orders') is used to\u2026",
          options: ["Hardcode a table name", "Declare a dependency so dbt builds models in the right order", "Run a Python script", "Create an index"],
          answer: 1,
          explain: "ref() both inserts the correct (environment-aware) table name and registers an edge in dbt\u2019s DAG, so dbt knows to build stg_orders before anything that refs it."
        },
        {
          q: "An incremental dbt model exists to\u2026",
          options: ["Always rebuild the whole table", "Process only new/changed rows since the last run", "Delete the table nightly", "Avoid SQL"],
          answer: 1,
          explain: "Incremental models append/merge just the new rows (guarded by is_incremental() and a predicate), avoiding a full rebuild of large tables on every run."
        }
      ]
    },
    "de-batch-dbt-prod": {
      title: "dbt production & semantic layer checkpoint",
      sub: "Project layers, slim CI, contracts and metric types.",
      questions: [
        {
          q: "A common production dbt layer stack is\u2026",
          options: ["raw snapshots only", "sources \u2192 staging \u2192 intermediate \u2192 marts \u2192 semantic metrics", "dashboards \u2192 raw tables \u2192 staging", "one model per dashboard with no shared refs"],
          answer: 1,
          explain: "Sources define external inputs; staging cleans one source at a time; intermediate models compose reusable logic; marts expose business-ready facts/dimensions; semantic metrics sit on top of stable marts."
        },
        {
          q: "In dbt CI, state selection is useful because it lets you\u2026",
          options: ["ignore changed models", "build only modified nodes and their impacted children from the prior production manifest", "skip tests on pull requests", "hardcode production table names"],
          answer: 1,
          explain: "Slim CI compares the branch manifest with the production manifest and runs selectors like state:modified+ so the pull request validates only changed resources and downstream dependents."
        },
        {
          q: "Which materialization is usually best for a large fact that receives daily changes?",
          options: ["ephemeral", "incremental with a reliable unique key and lookback window", "view over raw JSON forever", "seed"],
          answer: 1,
          explain: "Incremental models merge or append only new/changed rows. Large mutable facts need a unique key, late-arrival lookback and periodic full-refresh/backfill path to stay correct."
        },
        {
          q: "A ratio metric such as refund rate should be modeled as\u2026",
          options: ["SUM(refund_rate)", "a numerator metric divided by a denominator metric at a compatible grain", "a string dimension", "a cumulative count only"],
          answer: 1,
          explain: "Ratios are non-additive. Define the numerator and denominator separately, then divide after aggregation so slicing by date, region or product remains mathematically valid."
        },
        {
          q: "An exposure in dbt documents\u2026",
          options: ["a downstream consumer such as a dashboard, notebook, ML job or report", "a private temp table only", "warehouse CPU usage", "a source password"],
          answer: 0,
          explain: "Exposures make downstream dependencies visible in lineage. If a mart changes, owners can see which dashboards, notebooks or jobs depend on it before they break consumers."
        }
      ]
    },
    "de-batch-perf": {
      title: "Performance & tuning checkpoint",
      sub: "Files, caching and AQE.",
      questions: [
        {
          q: "The small-file problem is best fixed by\u2026",
          options: ["Adding more files", "Compaction \u2014 rewriting many tiny files into right-sized ones", "Disabling compression", "Increasing partitions"],
          answer: 1,
          explain: "Thousands of tiny files create huge per-file overhead; compaction (or repartition/coalesce on write) produces ~128 MB\u20131 GB files that scan efficiently."
        },
        {
          q: "Spark's Adaptive Query Execution (AQE) helps by\u2026",
          options: ["Compiling to C", "Re-optimizing the plan at runtime using actual partition sizes (e.g. coalescing or handling skew)", "Removing the shuffle", "Caching everything"],
          answer: 1,
          explain: "AQE uses real runtime statistics to coalesce shuffle partitions, switch join strategies, and split skewed partitions \u2014 fixing plans the optimizer couldn\u2019t cost accurately upfront."
        },
        {
          q: "Caching a DataFrame with persist() is most worthwhile when\u2026",
          options: ["You use it exactly once", "You reuse the same computed DataFrame multiple times", "It is tiny", "You never reuse it"],
          answer: 1,
          explain: "Caching pays off when an expensive intermediate is reused across multiple actions; caching something used once just wastes memory and can trigger spill."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.batch = {
    id: "batch", name: "Batch Processing & Spark", short: "BATCH",
    tagline: "Crunch big data, partition by partition", color: "#f5a623",
    blurb: "Distributed batch compute from MapReduce to Spark: lazy DAGs, partitions, shuffles, skew and joins, ELT with production dbt, semantic metrics, incremental backfills, idempotency and practical tuning.",
    modules: [
      {
        id: "compute", name: "Distributed Compute", icon: "blocks",
        lessons: [
          {
            id: "mapreduce", title: "MapReduce: the mental model",
            summary: "Map, shuffle, reduce \u2014 the pattern under every distributed batch engine.",
            minutes: 7, tags: ["mapreduce"],
            blocks: [
              { t: "p", html: "<strong>MapReduce</strong> is the idea that made big data tractable: express a computation as a <strong>map</strong> (transform each record independently, in parallel) and a <strong>reduce</strong> (aggregate records sharing a key). Between them sits the <strong>shuffle</strong>, which moves all records with the same key to the same place." },
              { t: "widget", id: "de-batch-mapreduce" },
              { t: "p", html: "Word count is the canonical example: map each line to " + tok("(word, 1)") + " pairs, shuffle so every " + tok("word") + " lands together, reduce by summing. The same shape powers joins, aggregations and sessionization." },
              { t: "note", variant: "key", html: "The shuffle is where the cost lives: map and reduce are embarrassingly parallel, but the shuffle moves data across the network and (in classic MapReduce) to disk between every stage \u2014 which is exactly what Spark set out to fix." }
            ]
          },
          {
            id: "spark-model", title: "Spark: RDDs, DataFrames & the DAG",
            summary: "A driver coordinates executors to run a lazy DAG of stages, in memory.",
            minutes: 7, tags: ["spark", "dag"],
            blocks: [
              { t: "p", html: "<strong>Apache Spark</strong> generalized MapReduce into a <strong>DAG</strong> of stages kept in memory. A <strong>driver</strong> builds the plan and schedules <strong>tasks</strong> onto <strong>executors</strong> (worker JVMs), each processing one partition. The <strong>DataFrame</strong> API lets the <strong>Catalyst</strong> optimizer and <strong>Tungsten</strong> engine rewrite and compile your query." },
              { t: "code", lang: "python", code:
                "df = (spark.read.parquet(\"events\")\n" +
                "      .filter(\"country = 'EU'\")        # transformation (lazy)\n" +
                "      .groupBy(\"product\").sum(\"amount\")) # transformation (lazy)\n" +
                "df.write.parquet(\"out\")                # ACTION -> runs the DAG" },
              { t: "note", variant: "key", html: "Spark separates <em>describing</em> the computation (transformations on DataFrames) from <em>running</em> it (an action). That gap is what lets Catalyst optimize the whole pipeline before a single byte moves." },
              { t: "note", variant: "tip", html: "Prefer DataFrame/SQL over raw RDDs: Catalyst can push down filters, prune columns, and choose join strategies for you. Dropping to RDDs or Python UDFs hides the data from the optimizer." }
            ]
          },
          {
            id: "transforms-actions", title: "Transformations vs actions",
            summary: "Lazy transformations build the plan; actions trigger it. Narrow vs wide decides the shuffle.",
            minutes: 6, tags: ["lazy", "narrow-wide"],
            blocks: [
              { t: "p", html: "<strong>Transformations</strong> (" + tok("select") + ", " + tok("filter") + ", " + tok("join") + ") are <em>lazy</em> \u2014 they extend the DAG and return immediately. <strong>Actions</strong> (" + tok("count") + ", " + tok("collect") + ", " + tok("write") + ") force the DAG to execute and return a result or write output." },
              { t: "compare",
                bad: { title: "Narrow transformation", items: ["Each output partition needs one input partition", "No data movement", "e.g. map, filter, select", "Pipelined within a stage"] },
                good: { title: "Wide transformation", items: ["Output partitions need many input partitions", "Triggers a shuffle (stage boundary)", "e.g. groupBy, join, distinct", "The expensive operations"] }
              },
              { t: "note", variant: "trap", html: "Because transformations are lazy, errors and cost can hide until an action runs. A pipeline that 'looks instant' may be deferring a huge shuffle to the first " + tok("count()") + "." },
              { t: "note", variant: "key", html: "Every stage boundary in Spark is a shuffle caused by a wide transformation. Minimizing wide transformations is the core of Spark performance \u2014 the next module is all about it." },
              { t: "quiz", id: "de-batch-compute" }
            ]
          }
        ]
      },
      {
        id: "shuffle", name: "Partitions & Shuffle", icon: "share",
        lessons: [
          {
            id: "partitions", title: "Partitions & parallelism",
            summary: "A partition is the unit of parallelism \u2014 too few starves cores, too many adds overhead.",
            minutes: 6, tags: ["partitions"],
            blocks: [
              { t: "p", html: "Spark splits data into <strong>partitions</strong>; each partition is processed by one <strong>task</strong> on one core. So partitions are the unit of parallelism: if you have 200 cores but 4 partitions, 196 cores sit idle." },
              { t: "stat", items: [
                { v: "1 task", k: "per partition per core" },
                { v: "~128 MB", k: "common target partition size" },
                { v: "200", k: "default spark.sql.shuffle.partitions" }
              ] },
              { t: "note", variant: "trap", html: "Both extremes hurt: too few partitions underutilize the cluster and risk out-of-memory; too many create scheduling overhead and tiny tasks. Aim for partitions that take a few seconds each, sized in the low hundreds of MB." },
              { t: "note", variant: "key", html: "The default of 200 shuffle partitions is rarely right \u2014 too many for small data, too few for huge data. Tune it (or let AQE coalesce) to match your data size and cluster." }
            ]
          },
          {
            id: "shuffle", title: "The shuffle",
            summary: "The exchange that moves records by key across the network \u2014 the thing to minimize.",
            minutes: 7, tags: ["shuffle", "exchange"],
            blocks: [
              { t: "p", html: "A <strong>shuffle</strong> (or exchange) repartitions data so records sharing a key land together. It writes intermediate files, transfers them over the network, and reads them back \u2014 the single most expensive thing Spark does, and a stage boundary in the DAG." },
              { t: "widget", id: "de-batch-exchange" },
              { t: "note", variant: "key", html: "Narrow transformations are free movement-wise; wide ones pay the shuffle tax. Cut shuffles by filtering early, broadcasting small tables, and pre-partitioning data by the join/group key. See the <a class='inline' href='#/sparksql/operations/joins'>Spark SQL join-strategy lab</a> for how a broadcast join skips the big-side shuffle entirely." },
              { t: "note", variant: "tip", html: "Read a Spark plan for " + tok("Exchange") + " nodes \u2014 each is a shuffle. Fewer exchanges almost always means a faster job." }
            ]
          },
          {
            id: "skew", title: "Data skew",
            summary: "When one hot key overloads a single task and stalls the whole stage.",
            minutes: 6, tags: ["skew"],
            blocks: [
              { t: "p", html: "<strong>Skew</strong> is uneven key distribution: one value (a 'null' customer, a mega-merchant) holds a huge share of rows. After the shuffle, that key\u2019s task processes far more data than the rest, and the stage finishes only when this <em>straggler</em> does." },
              { t: "ul", items: [
                "<strong>Salting</strong> \u2014 add a random suffix to the hot key to spread it across tasks, then re-aggregate.",
                "<strong>AQE skew join</strong> \u2014 Spark splits oversized partitions automatically.",
                "<strong>Broadcast</strong> \u2014 if the other side is small, avoid the shuffle entirely.",
                "<strong>Isolate</strong> \u2014 handle the hot key separately from the long tail."
              ] },
              { t: "note", variant: "trap", html: "Skew often hides behind 'the last task takes forever' in the Spark UI. If 199 tasks finish in seconds and one runs for minutes, you\u2019ve found a hot key." },
              { t: "note", variant: "key", html: "Skew is a data problem, not a config problem: the fix is to redistribute the hot key (salting) or avoid moving it (broadcast), not just to add more partitions." }
            ]
          },
          {
            id: "joins", title: "Join strategies",
            summary: "Broadcast, shuffle-hash and sort-merge \u2014 pick by table sizes and keys.",
            minutes: 7, tags: ["joins"],
            blocks: [
              { t: "table", headers: ["Strategy", "When", "Shuffle?"], rows: [
                ["Broadcast hash", "One side small (fits in memory)", "No shuffle of big side"],
                ["Shuffle hash", "Both medium, no sort needed", "Yes"],
                ["Sort-merge", "Both large", "Yes (shuffle + sort)"]
              ] },
              { t: "p", html: "Spark picks automatically based on size estimates, broadcasting any side under " + tok("spark.sql.autoBroadcastJoinThreshold") + " (10 MB by default). If estimates are wrong (stale stats), it may shuffle a table that should have been broadcast." },
              { t: "code", lang: "python", code:
                "from pyspark.sql.functions import broadcast\n" +
                "# Force-broadcast a known-small dimension to skip the big shuffle\n" +
                "orders.join(broadcast(dim_product), \"product_id\")" },
              { t: "note", variant: "key", html: "The cheapest join is the one that avoids shuffling the big table. If one side is small, broadcast it; otherwise sort-merge is the robust default for two large tables." },
              { t: "quiz", id: "de-batch-shuffle" }
            ]
          }
        ]
      },
      {
        id: "elt", name: "ETL, ELT & dbt", icon: "wrench",
        lessons: [
          {
            id: "etl-vs-elt", title: "ETL vs ELT",
            summary: "Transform before loading, or load raw and transform inside the warehouse.",
            minutes: 6, tags: ["etl", "elt"],
            blocks: [
              { t: "p", html: "<strong>ETL</strong> (Extract\u2013Transform\u2013Load) transforms data on a separate engine <em>before</em> loading it. <strong>ELT</strong> (Extract\u2013Load\u2013Transform) loads raw data into the warehouse first, then transforms it there with SQL. Cheap, elastic cloud warehouses made ELT the modern default." },
              { t: "compare",
                bad: { title: "Classic ETL", items: ["Transform on a separate cluster", "Only modeled data lands", "Reprocessing means re-extracting", "Heavier engineering"] },
                good: { title: "Modern ELT", items: ["Raw data preserved in the warehouse", "Transform with SQL at warehouse scale", "Re-transform anytime from raw", "Analysts can own transforms (dbt)"] }
              },
              { t: "note", variant: "key", html: "ELT keeps the raw data, so you can always re-derive models when requirements change \u2014 you don\u2019t have to re-extract from the source. That flexibility is why the modern stack is ELT-first." },
              { t: "note", variant: "tip", html: "ETL still wins when you must transform before landing for compliance (e.g. strip PII) or when the source can\u2019t dump raw volume economically." }
            ]
          },
          {
            id: "dbt", title: "Transformations with dbt",
            summary: "Models as SELECTs, refs that build a DAG, and tests that guard it.",
            minutes: 7, tags: ["dbt"],
            blocks: [
              { t: "p", html: "<strong>dbt</strong> turns transformation into software engineering. Each <strong>model</strong> is a " + tok("SELECT") + " in a file; " + tok("ref()") + " and " + tok("source()") + " declare dependencies, from which dbt compiles a <strong>DAG</strong> and builds models in order. It adds tests, docs, and <strong>materializations</strong> (view, table, incremental)." },
              { t: "widget", id: "de-batch-dbt-dag" },
              { t: "code", lang: "sql", code:
                "-- models/marts/mart_revenue.sql\n" +
                "SELECT o.order_date, c.segment, SUM(o.amount) AS revenue\n" +
                "FROM {{ ref('stg_orders') }} o\n" +
                "JOIN {{ ref('stg_customers') }} c USING (customer_id)\n" +
                "GROUP BY 1, 2" },
              { t: "table", headers: ["Layer", "Purpose", "Typical materialization"], rows: [
                ["sources", "External tables and freshness checks", "source definitions"],
                ["staging", "One clean, renamed model per source object", "view"],
                ["intermediate", "Reusable joins and business logic", "view / ephemeral"],
                ["marts", "Consumer-ready facts, dimensions and wide tables", "table / incremental"],
                ["semantic", "Metrics, dimensions and entities exposed to tools", "YAML objects"]
              ] },
              { t: "note", variant: "key", html: "Because " + tok("ref()") + " builds the DAG, dbt always runs models in dependency order and can rebuild just what changed. The DAG is the project, and the layer names make ownership and review possible." }
            ]
          },
          {
            id: "dbt-production", title: "dbt in production",
            summary: "Ship transformations with tests, docs, exposures, slim CI and state-aware deploys.",
            minutes: 8, tags: ["dbt", "ci", "data-quality"],
            blocks: [
              { t: "p", html: "A production dbt project is SQL plus operating rules: model layers, materialization choices, tests, docs, exposures and state-aware deploys. A pull request should prove the changed graph still builds, satisfies assumptions and protects downstream consumers." },
              { t: "compare",
                bad: { title: "Notebook-style dbt", items: ["Models named after dashboards", "No source freshness or uniqueness tests", "Full project rebuild on every PR", "Dashboards depend on private staging tables"] },
                good: { title: "Production dbt", items: ["Layered model folders with owners", "Generic and singular tests block bad data", "Slim CI builds modified nodes and children", "Exposures document dashboards, notebooks and ML jobs"] }
              },
              { t: "code", lang: "yaml", code:
                "# models/marts/schema.yml\n" +
                "models:\n" +
                "  - name: fct_orders\n" +
                "    description: One row per settled order.\n" +
                "    config:\n" +
                "      materialized: incremental\n" +
                "      unique_key: order_id\n" +
                "    columns:\n" +
                "      - name: order_id\n" +
                "        tests: [not_null, unique]\n" +
                "      - name: customer_id\n" +
                "        tests:\n" +
                "          - relationships:\n" +
                "              to: ref('dim_customer')\n" +
                "              field: customer_id\n" +
                "exposures:\n" +
                "  - name: executive_revenue_dashboard\n" +
                "    type: dashboard\n" +
                "    depends_on: [ref('fct_orders')]\n" +
                "    owner:\n" +
                "      name: Revenue Analytics" },
              { t: "code", lang: "bash", code:
                "# PR validation using the previous production manifest as state\n" +
                "dbt deps\n" +
                "dbt build --select state:modified+ --defer --state artifacts/prod_manifest\n" +
                "\n" +
                "# Nightly confidence run for high-value marts\n" +
                "dbt source freshness\n" +
                "dbt build --select tag:gold+" },
              { t: "note", variant: "key", html: "<strong>Slim CI</strong> compares the branch to the last production manifest, builds modified nodes and their children, and defers unchanged parents to production objects. Fast feedback, realistic dependencies." },
              { t: "note", variant: "trap", html: "Materialization is a contract. Views are cheap and fresh but can push cost to every reader; tables are fast but need rebuilds; incremental models are economical but require a unique key, late-arrival lookback and full-refresh plan." }
            ]
          },
          {
            id: "dbt-semantic-layer", title: "Semantic models & metric types",
            summary: "Define entities, dimensions, measures and metrics once so every consumer gets the same number.",
            minutes: 8, tags: ["dbt", "semantic-layer", "metrics"],
            blocks: [
              { t: "p", html: "The semantic layer turns marts into reusable business vocabulary. A <strong>semantic model</strong> names the model, entities, dimensions and measures; <strong>metrics</strong> compose those measures into governed definitions." },
              { t: "widget", id: "de-batch-semantic-yaml" },
              { t: "table", headers: ["Metric type", "Use it for", "Example"], rows: [
                ["simple", "One aggregated measure", "gross revenue = sum(order_amount)"],
                ["ratio", "Numerator divided by denominator", "refund rate = refunds / orders"],
                ["cumulative", "Running total over time", "lifetime revenue to date"],
                ["derived", "Formula combining metrics", "net revenue = gross revenue - refunds"],
                ["conversion", "Start event to end event within a window", "trial to paid within 14 days"]
              ] },
              { t: "code", lang: "yaml", code:
                "semantic_models:\n" +
                "  - name: orders\n" +
                "    model: ref('fct_orders')\n" +
                "    defaults:\n" +
                "      agg_time_dimension: ordered_at\n" +
                "    entities:\n" +
                "      - name: order_id\n" +
                "        type: primary\n" +
                "      - name: customer_id\n" +
                "        type: foreign\n" +
                "    dimensions:\n" +
                "      - name: ordered_at\n" +
                "        type: time\n" +
                "        type_params:\n" +
                "          time_granularity: day\n" +
                "      - name: channel\n" +
                "        type: categorical\n" +
                "    measures:\n" +
                "      - name: gross_revenue\n" +
                "        agg: sum\n" +
                "        expr: gross_amount\n" +
                "\n" +
                "metrics:\n" +
                "  - name: gross_revenue\n" +
                "    type: simple\n" +
                "    type_params:\n" +
                "      measure: gross_revenue\n" +
                "  - name: refund_rate\n" +
                "    type: ratio\n" +
                "    type_params:\n" +
                "      numerator: refunds\n" +
                "      denominator: orders" },
              { t: "note", variant: "trap", html: "Never sum a precomputed percentage. Ratio and conversion metrics must aggregate their components first, then divide at the requested grain. Otherwise a store with 10 orders and a store with 10,000 orders get equal weight." },
              { t: "note", variant: "key", html: "Semantic YAML is the executable part of a metric contract: meaning, valid dimensions, time grain, tests and owner are visible to every consumer." },
              { t: "quiz", id: "de-batch-dbt-prod" }
            ]
          },
          {
            id: "incremental-backfill", title: "Incremental models & backfills",
            summary: "Process only new rows on schedule, and reprocess history deliberately.",
            minutes: 6, tags: ["incremental", "backfill"],
            blocks: [
              { t: "p", html: "An <strong>incremental</strong> model processes only new/changed rows since the last run, guarded by " + tok("is_incremental()") + " and a predicate on a watermark column. It\u2019s how you keep a billion-row table fresh without rebuilding it nightly." },
              { t: "code", lang: "sql", code:
                "SELECT * FROM {{ source('app', 'events') }}\n" +
                "{% if is_incremental() %}\n" +
                "  WHERE event_ts > (SELECT MAX(event_ts) FROM {{ this }})\n" +
                "{% endif %}" },
              { t: "p", html: "A <strong>backfill</strong> deliberately reprocesses a historical range \u2014 after a bug fix or a new column. The safest backfills are <em>idempotent</em> and run partition by partition, so a failure resumes cleanly." },
              { t: "note", variant: "trap", html: "Incremental logic is subtle: a late-arriving row older than your watermark gets missed. Use a lookback window (reprocess the last N days) or a full-refresh on a schedule to self-heal." },
              { t: "note", variant: "key", html: "Incremental for speed, full-refresh/backfill for correctness. Design both from day one \u2014 you will need to reprocess history." }
            ]
          },
          {
            id: "idempotency", title: "Idempotency & reprocessing",
            summary: "Make every run safe to repeat so retries and backfills never double-count.",
            minutes: 6, tags: ["idempotency"],
            blocks: [
              { t: "p", html: "Batch jobs fail and rerun. An <strong>idempotent</strong> job produces the same result whether it runs once or five times. The two reliable techniques are <strong>partition-overwrite</strong> (atomically replace a day\u2019s partition) and <strong>MERGE/upsert</strong> on a key." },
              { t: "compare",
                bad: { title: "Not idempotent", items: ["INSERT appends \u2014 retries duplicate rows", "Counters incremented in place", "Order-dependent side effects"] },
                good: { title: "Idempotent", items: ["Overwrite the target partition", "MERGE on a business key", "Deterministic, input-only output"] }
              },
              { t: "note", variant: "key", html: "Design for replay: assume any run may happen twice. If the output depends only on the input (not on how many times it ran), you can retry and backfill fearlessly." },
              { t: "note", variant: "tip", html: "Idempotency pairs with the ingestion track\u2019s exactly-once goal: at-least-once delivery + idempotent processing = effectively-once results, the practical standard." },
              { t: "quiz", id: "de-batch-elt" }
            ]
          }
        ]
      },
      {
        id: "performance", name: "Performance & Tuning", icon: "trend",
        lessons: [
          {
            id: "file-sizing", title: "Small files & compaction",
            summary: "Right-size output files so scans aren\u2019t drowned in per-file overhead.",
            minutes: 5, tags: ["files", "compaction"],
            blocks: [
              { t: "p", html: "Streaming and over-partitioned writes produce swarms of tiny files. Each file costs a list/open and breaks I/O batching, so a table of a million 4 KB files scans far slower than the same data in a few hundred 256 MB files." },
              { t: "ul", items: [
                "<strong>repartition / coalesce</strong> before writing to control file count.",
                "<strong>Compaction</strong> jobs rewrite small files into right-sized ones.",
                "<strong>OPTIMIZE</strong> (Delta) / rewrite (Iceberg) do this for table formats."
              ] },
              { t: "note", variant: "key", html: "Target ~128 MB\u20131 GB files. It\u2019s the cheapest performance win in most lakes \u2014 and table formats can compact in the background for you." }
            ]
          },
          {
            id: "caching-spill", title: "Caching, persistence & spill",
            summary: "Cache reused data, understand storage levels, and watch for spill to disk.",
            minutes: 6, tags: ["caching", "spill"],
            blocks: [
              { t: "p", html: "" + tok("cache()") + " / " + tok("persist()") + " keep a computed DataFrame in memory (or memory-and-disk) so reuse skips recomputation. <strong>Spill</strong> happens when a shuffle or aggregation exceeds memory and Spark writes to disk \u2014 correct but slow." },
              { t: "note", variant: "trap", html: "Caching is not free: it consumes executor memory that the shuffle needs, and caching something used once just causes spill. Cache only intermediates you genuinely reuse across multiple actions." },
              { t: "note", variant: "key", html: "Reuse \u2192 cache; single-use \u2192 don\u2019t. And if you see heavy spill, you need more memory, more partitions, or less data per task \u2014 not more caching." }
            ]
          },
          {
            id: "tuning", title: "Tuning: memory, partitions & AQE",
            summary: "The handful of knobs that fix most Spark jobs.",
            minutes: 7, tags: ["tuning", "aqe"],
            blocks: [
              { t: "ul", items: [
                "<strong>Adaptive Query Execution (AQE)</strong> \u2014 re-optimizes at runtime: coalesces shuffle partitions, switches join types, splits skew. Turn it on.",
                "<strong>Shuffle partitions</strong> \u2014 size to your data, not the default 200.",
                "<strong>Broadcast threshold</strong> \u2014 raise it to broadcast slightly larger dimensions.",
                "<strong>Pushdown</strong> \u2014 read Parquet with column projection and predicate pushdown.",
                "<strong>Avoid Python UDFs</strong> \u2014 they break vectorization; prefer built-in/SQL functions."
              ] },
              { t: "note", variant: "key", html: "The diagnostic loop is always the same: read the Spark UI, find the slow stage, ask <em>shuffle, skew, or spill?</em> \u2014 then apply the matching fix. Most jobs need only two or three of these knobs." },
              { t: "note", variant: "tip", html: "Let the optimizer help you: keep logic in DataFrame/SQL, keep stats fresh, and enable AQE. Hand-tuning matters most after you\u2019ve removed unnecessary shuffles." },
              { t: "quiz", id: "de-batch-perf" }
            ]
          }
        ]
      }
    ]
  };
})();
