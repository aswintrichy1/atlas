/* =====================================================================
   CASCADE · Batch Processing & Spark (incl. Spark SQL) track  (curriculum + quizzes + widgets)
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
  function codeCard(lang, code) {
    return h("div", { class: "code-card", style: "margin:0" },
      h("div", { class: "code-head" },
        h("span", { class: "code-dots", html: "<i></i><i></i><i></i>" }),
        h("span", { class: "code-lang" }, lang)),
      h("pre", {}, h("code", { style: "white-space:pre;font-size:.74rem" }, code)));
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
    function chip(label, color) { return h("span", { class: "mstack-cell", style: "padding:5px 9px;border-color:" + (color || "var(--line-strong)") + ";color:" + (color ? "oklch(from " + color + " var(--ink-l) c h)" : "var(--text)") }, label); }
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
    function cell(k) { return h("div", { class: "dsa-cell", style: "min-width:30px;border-color:" + KEYCOLOR[k] + ";color:oklch(from " + KEYCOLOR[k] + " var(--ink-l) c h)" }, k); }
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

  /* 5 — DataFrame API <-> Spark SQL equivalence */
  window.Widgets["de-spark-api"] = function (mount) {
    shell(mount, "explorer", "DataFrame API \u2194 Spark SQL",
      "The DataFrame API and SQL are two front doors to the same engine. Pick an operation and compare.");
    var ops = {
      filter: {
        df: "df.filter(df[\"amount\"] > 100)",
        sql: "SELECT *\nFROM sales\nWHERE amount > 100"
      },
      groupBy: {
        df: "df.groupBy(\"product\") \\\n  .agg(sum(\"amount\").alias(\"revenue\"))",
        sql: "SELECT product, SUM(amount) AS revenue\nFROM sales\nGROUP BY product"
      },
      join: {
        df: "orders.join(customers,\n  on=\"customer_id\", how=\"inner\")",
        sql: "SELECT *\nFROM orders o\nJOIN customers c USING (customer_id)"
      },
      window: {
        df: "w = Window.partitionBy(\"dept\") \\\n  .orderBy(desc(\"salary\"))\ndf.withColumn(\"rk\", rank().over(w))",
        sql: "SELECT *,\n  RANK() OVER (PARTITION BY dept\n    ORDER BY salary DESC) AS rk\nFROM emp"
      }
    };
    var cur = "filter";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      stage.innerHTML = "";
      var two = h("div", { style: "display:flex;gap:14px;flex-wrap:wrap" });
      var left = h("div", { style: "flex:1;min-width:230px" });
      left.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--accent-ink);margin-bottom:6px" }, "DataFrame API (PySpark)"));
      left.appendChild(codeCard("python", ops[cur].df));
      var right = h("div", { style: "flex:1;min-width:230px" });
      right.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--cyan-ink);margin-bottom:6px" }, "Spark SQL"));
      right.appendChild(codeCard("sql", ops[cur].sql));
      two.appendChild(left); two.appendChild(right);
      stage.appendChild(two);
      readout.innerHTML = "";
      readout.appendChild(ro("operation", cur, true));
      readout.appendChild(ro("note", "both compile to the same Catalyst logical plan"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "filter", label: "filter / WHERE" }, { v: "groupBy", label: "groupBy / GROUP BY" }, { v: "join", label: "join / JOIN" }, { v: "window", label: "window / OVER" }],
        function () { return cur; }, function (v) { cur = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 6 — Join strategy picker */
  window.Widgets["de-spark-join"] = function (mount) {
    shell(mount, "simulator", "Join Strategy Picker",
      "Spark chooses a join physical plan from the table sizes. Resize each side and see what it picks.");
    var SIZES = { small: 8, large: 51200 }; // MB; large = 50 GB
    var THRESH = 10; // autoBroadcastJoinThreshold ~10MB
    var left = "large", right = "small";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function fmt(mb) { return mb >= 1024 ? (mb / 1024) + " GB" : mb + " MB"; }
    function paint() {
      var l = SIZES[left], r = SIZES[right];
      var minSide = Math.min(l, r);
      var broadcast = minSide <= THRESH;
      stage.innerHTML = "";
      var row = h("div", { style: "display:flex;align-items:center;gap:16px;justify-content:center;flex-wrap:wrap;padding:8px 0" });
      function tbl(name, mb) {
        var big = mb > THRESH;
        return h("div", { style: "text-align:center" },
          h("div", { style: "min-width:84px;padding:14px 10px;border-radius:10px;border:1px solid " + (big ? "var(--rose)" : "var(--accent)") + ";background:color-mix(in srgb," + (big ? "var(--rose)" : "var(--accent)") + " 14%,var(--surface-solid));font-family:var(--font-mono);font-weight:700" }, name),
          h("div", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint);margin-top:5px" }, fmt(mb)));
      }
      row.appendChild(tbl("left", l));
      row.appendChild(h("div", { style: "font-family:var(--font-mono);color:var(--accent-ink);font-size:.8rem" }, "\u2A1D join"));
      row.appendChild(tbl("right", r));
      stage.appendChild(row);
      stage.appendChild(h("div", { style: "text-align:center;margin-top:12px;font-family:var(--font-mono);font-weight:700;color:var(--accent-ink)" },
        broadcast ? "Broadcast Hash Join" : "Sort-Merge Join"));
      readout.innerHTML = "";
      readout.appendChild(ro("strategy", broadcast ? "broadcast" : "sort-merge", true));
      readout.appendChild(ro("shuffle", broadcast ? "broadcast small side \u2014 large side not shuffled" : "both sides shuffled + sorted"));
      readout.appendChild(ro("threshold", "broadcast if a side \u2264 " + THRESH + " MB"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "left:"),
      seg([{ v: "small", label: "8 MB" }, { v: "large", label: "50 GB" }], function () { return left; }, function (v) { left = v; paint(); }),
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "right:"),
      seg([{ v: "small", label: "8 MB" }, { v: "large", label: "50 GB" }], function () { return right; }, function (v) { right = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 7 — Partition / cache tuning sandbox */
  window.Widgets["de-spark-tuning"] = function (mount) {
    shell(mount, "lab", "Partition & Cache Tuning",
      "Size your shuffle partitions to the data. Too few risks spill; too many drowns in overhead.");
    var dataGB = 50, parts = 200, cached = false;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var avgMB = Math.round(dataGB * 1024 / parts);
      var verdict, vcolor;
      if (avgMB > 256) { verdict = "too few partitions \u2014 risk of spill / OOM"; vcolor = "var(--rose-ink)"; }
      else if (avgMB < 8) { verdict = "too many tiny partitions \u2014 scheduler overhead"; vcolor = "var(--amber-ink)"; }
      else { verdict = "healthy (near the ~128 MB target)"; vcolor = "var(--lime-ink)"; }
      stage.innerHTML = "";
      stage.appendChild(h("div", { style: "text-align:center;padding:10px 0" },
        h("div", { style: "font-family:var(--font-display);font-weight:800;font-size:2rem;color:" + vcolor }, avgMB + " MB"),
        h("div", { style: "font-family:var(--font-mono);font-size:.66rem;color:var(--text-faint)" }, "average partition size")));
      stage.appendChild(h("div", { style: "text-align:center;font-family:var(--font-mono);font-size:.78rem;color:" + vcolor }, verdict));
      if (cached) stage.appendChild(h("div", { style: "text-align:center;margin-top:8px;font-family:var(--font-mono);font-size:.66rem;color:var(--cyan-ink)" }, "cached \u2014 reuse skips recompute (costs executor memory)"));
      readout.innerHTML = "";
      readout.appendChild(ro("data", dataGB + " GB"));
      readout.appendChild(ro("tasks", String(parts), true));
      readout.appendChild(ro("avg partition", avgMB + " MB"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "data:"),
      seg([{ v: 1, label: "1 GB" }, { v: 50, label: "50 GB" }, { v: 500, label: "500 GB" }], function () { return dataGB; }, function (v) { dataGB = v; paint(); }),
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "shuffle partitions:"),
      seg([{ v: 8, label: "8" }, { v: 200, label: "200" }, { v: 2000, label: "2000" }], function () { return parts; }, function (v) { parts = v; paint(); }),
      h("button", { class: "w-btn ghost", onclick: function (e) { cached = !cached; e.target.classList.toggle("primary"); paint(); } }, "cache()")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-batch-compute": {
      title: "Distributed compute & Spark SQL checkpoint",
      sub: "MapReduce, Spark, the DataFrame/SQL API and Catalyst.",
      questions: [
        {
          q: "In Spark, a transformation like map() or filter() is\u2026",
          options: ["Executed immediately", "Lazy \u2014 it just adds to the DAG until an action runs", "A network shuffle", "A write to disk"],
          answer: 1,
          explain: "Transformations are lazy: they build up the logical DAG. Nothing runs until an action (collect, count, write) forces execution, letting Catalyst optimize the whole plan."
        },
        {
          q: "Why is Spark generally faster than classic MapReduce?",
          options: ["It avoids the network entirely", "It doesn\u2019t shuffle", "It keeps intermediate data in memory instead of writing to disk between every stage", "It uses fewer machines"],
          answer: 2,
          explain: "MapReduce materializes to disk between map and reduce stages; Spark pipelines stages and caches in memory, cutting the heavy disk I/O \u2014 especially for iterative jobs."
        },
        {
          q: "Which is an ACTION (not a transformation)?",
          options: ["select()", "filter()", "withColumn()", "count()"],
          answer: 3,
          explain: "count() forces the DAG to execute and returns a value to the driver; select/filter/withColumn are lazy transformations that only extend the plan."
        },
        {
          q: "What is Spark SQL\u2019s relationship to the DataFrame API?",
          options: ["Both are front-ends that compile to the same Catalyst logical plan", "They are unrelated engines", "DataFrames can\u2019t express joins", "SQL is faster because it skips Catalyst"],
          answer: 0,
          explain: "A SQL string and the equivalent DataFrame calls are parsed into the same logical plan and optimized by Catalyst, so they perform identically \u2014 use whichever reads better."
        },
        {
          q: "Catalyst is Spark SQL\u2019s\u2026",
          options: ["Storage format", "Query optimizer that turns a logical plan into an optimized physical plan", "Cluster manager", "Streaming engine"],
          answer: 1,
          explain: "Catalyst parses, analyzes and optimizes the logical plan (predicate pushdown, projection pruning, join reordering) and selects physical operators; Tungsten then generates efficient code."
        }
      ]
    },
    "de-batch-shuffle": {
      title: "Partitions & shuffle checkpoint",
      sub: "Exchanges, skew, joins and fan-out.",
      questions: [
        {
          q: "A 'wide' transformation is one that\u2026",
          options: ["Requires a shuffle because output partitions depend on data across input partitions", "Adds a column", "Reads a file", "Runs on one machine"],
          answer: 0,
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
          options: ["Both tables are huge", "There is no join key", "One side is small enough to copy to every executor, avoiding a shuffle of the big side", "You want to sort the data"],
          answer: 2,
          explain: "Broadcasting the small table to all executors lets each join its big-table partition locally \u2014 no shuffle of the large table. Sort-merge or shuffle-hash joins handle two large tables."
        },
        {
          q: "A join to a dimension unexpectedly increases the fact\u2019s row count. What happened?",
          options: ["The broadcast threshold was exceeded", "AQE coalesced partitions", "Spark cached the dimension", "The key is not unique on the dimension side, so fact rows fanned out"],
          answer: 3,
          explain: "Fan-out: if the dimension holds several rows per key, each fact row matches several times and later SUMs double-count. Deduplicate or aggregate the child to the join grain first, or use a semi join."
        },
        {
          q: "A 200-core cluster processes a dataset split into 4 partitions. What is the main problem?",
          options: ["Too many tasks overwhelm the scheduler", "Only 4 tasks can run at once, so most cores sit idle", "The data must be broadcast", "Shuffles are avoided entirely"],
          answer: 1,
          explain: "One task processes one partition on one core, so 4 partitions means 4 concurrent tasks. Repartition to a count that matches the data size and the cluster."
        }
      ]
    },
    "de-batch-elt": {
      title: "ETL, ELT, incremental & backfill checkpoint",
      sub: "Where transforms run, how dbt builds, and how history is reprocessed.",
      questions: [
        {
          q: "The key difference in ELT (vs ETL) is that transformations run\u2026",
          options: ["Before loading, on a separate cluster", "In the BI tool", "On the source database", "Inside the warehouse after loading raw data"],
          answer: 3,
          explain: "ELT loads raw data into the warehouse first, then transforms it there with SQL \u2014 leveraging the warehouse\u2019s elastic compute. It\u2019s why dbt and cloud warehouses rose together."
        },
        {
          q: "In dbt, ref('stg_orders') is used to\u2026",
          options: ["Declare a dependency so dbt builds models in the right order", "Hardcode a table name", "Run a Python script", "Create an index"],
          answer: 0,
          explain: "ref() both inserts the correct (environment-aware) table name and registers an edge in dbt\u2019s DAG, so dbt knows to build stg_orders before anything that refs it."
        },
        {
          q: "An incremental dbt model exists to\u2026",
          options: ["Always rebuild the whole table", "Process only new/changed rows since the last run", "Delete the table nightly", "Avoid SQL"],
          answer: 1,
          explain: "Incremental models append/merge just the new rows (guarded by is_incremental() and a predicate), avoiding a full rebuild of large tables on every run."
        },
        {
          q: "An incremental model filters on event_ts > MAX(event_ts) in the target. Which rows does it silently miss?",
          options: ["Rows with NULL amounts", "Rows from the newest partition", "Late-arriving rows whose event time is older than the current maximum", "Rows that fail a unique test"],
          answer: 2,
          explain: "A strict high-watermark skips anything that lands late with an older timestamp. A lookback window or a scheduled full refresh reprocesses recent history so late rows are picked up."
        },
        {
          q: "Why should a backfill run partition by partition, keyed to each run\u2019s logical date?",
          options: ["It avoids writing any data", "Each partition is overwritten idempotently, so a failure resumes cleanly and reruns don\u2019t duplicate", "It disables tests", "It makes the warehouse larger"],
          answer: 1,
          explain: "Keying each run to its interval and replacing only that partition makes every run repeatable. A failed backfill resumes from the last good partition instead of restarting or double-writing history."
        }
      ]
    },
    "de-batch-dbt-prod": {
      title: "dbt production & semantic layer checkpoint",
      sub: "Project layers, slim CI, contracts and metric types.",
      questions: [
        {
          q: "A common production dbt layer stack is\u2026",
          options: ["raw snapshots only", "dashboards \u2192 raw tables \u2192 staging", "sources \u2192 staging \u2192 intermediate \u2192 marts \u2192 semantic metrics", "one model per dashboard with no shared refs"],
          answer: 2,
          explain: "Sources define external inputs; staging cleans one source at a time; intermediate models compose reusable logic; marts expose business-ready facts/dimensions; semantic metrics sit on top of stable marts."
        },
        {
          q: "In dbt CI, state selection is useful because it lets you\u2026",
          options: ["ignore changed models", "hardcode production table names", "skip tests on pull requests", "build only modified nodes and their impacted children from the prior production manifest"],
          answer: 3,
          explain: "Slim CI compares the branch manifest with the production manifest and runs selectors like state:modified+ so the pull request validates only changed resources and downstream dependents."
        },
        {
          q: "Which materialization is usually best for a large fact that receives daily changes?",
          options: ["incremental with a reliable unique key and lookback window", "ephemeral", "view over raw JSON forever", "seed"],
          answer: 0,
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
          options: ["warehouse CPU usage", "a private temp table only", "a downstream consumer such as a dashboard, notebook, ML job or report", "a source password"],
          answer: 2,
          explain: "Exposures make downstream dependencies visible in lineage. If a mart changes, owners can see which dashboards, notebooks or jobs depend on it before they break consumers."
        }
      ]
    },
    "de-batch-perf": {
      title: "Performance & tuning checkpoint",
      sub: "Files, partitions, caching, UDFs and AQE.",
      questions: [
        {
          q: "The small-file problem is best fixed by\u2026",
          options: ["Adding more files", "Increasing partitions", "Disabling compression", "Compaction \u2014 rewriting many tiny files into right-sized ones"],
          answer: 3,
          explain: "Thousands of tiny files create huge per-file overhead; compaction (or repartition/coalesce on write) produces ~128 MB\u20131 GB files that scan efficiently."
        },
        {
          q: "Spark's Adaptive Query Execution (AQE) helps by\u2026",
          options: ["Re-optimizing the plan at runtime using actual partition sizes (e.g. coalescing or handling skew)", "Compiling to C", "Removing the shuffle", "Caching everything"],
          answer: 0,
          explain: "AQE uses real runtime statistics to coalesce shuffle partitions, switch join strategies, and split skewed partitions \u2014 fixing plans the optimizer couldn\u2019t cost accurately upfront."
        },
        {
          q: "Caching a DataFrame with persist() is most worthwhile when\u2026",
          options: ["You use it exactly once", "You reuse the same computed DataFrame multiple times", "It is tiny", "You never reuse it"],
          answer: 1,
          explain: "Caching pays off when an expensive intermediate is reused across multiple actions; caching something used once just wastes memory and can trigger spill."
        },
        {
          q: "The default spark.sql.shuffle.partitions of 200 is\u2026",
          options: ["Always optimal", "Ignored by Spark", "Often wrong \u2014 too many for small data, too few for huge data", "The number of executors"],
          answer: 2,
          explain: "200 shuffle partitions rarely matches your data: it creates tiny tasks on small data and oversized, spill-prone tasks on large data. Tune it or let AQE coalesce."
        },
        {
          q: "Why prefer built-in functions over a row-at-a-time Python UDF?",
          options: ["UDFs are not allowed in Spark SQL", "UDFs cannot take arguments", "Built-ins stay in the optimized JVM engine; Python UDFs serialize rows to a Python worker and are opaque to Catalyst", "There is no difference"],
          answer: 2,
          explain: "A Python UDF ships rows to a Python process and is a black box to Catalyst (no pushdown through it, no codegen). Built-in/SQL functions run inside the engine and are far faster."
        }
      ]
    },
    "de-batch-data": {
      title: "Structured & semi-structured data checkpoint",
      sub: "File formats, schemas and complex types.",
      questions: [
        {
          q: "Why is Parquet preferred over JSON for large Spark tables?",
          options: ["It is human-readable", "It is columnar with min/max stats, enabling column pruning and predicate pushdown", "It cannot be compressed", "It stores one row per file"],
          answer: 1,
          explain: "Parquet\u2019s columnar layout lets Spark read only needed columns and skip row groups via min/max stats \u2014 far less I/O than parsing whole JSON records."
        },
        {
          q: "To turn an array column into one row per element in Spark, you use\u2026",
          options: ["pivot()", "collect_list()", "explode()", "broadcast()"],
          answer: 2,
          explain: "explode() (and posexplode()) flattens an array or map column into multiple rows \u2014 the standard way to normalize nested/semi-structured data."
        },
        {
          q: "Letting Spark infer JSON schema on read is convenient but\u2026",
          options: ["Always free", "Faster than a fixed schema", "Impossible", "Costs an extra pass over the data and can guess types wrong"],
          answer: 3,
          explain: "Schema inference scans the data to deduce types, adding a pass and risking wrong/loose types; supplying an explicit schema is faster and safer in production."
        },
        {
          q: "After exploding an order\u2019s items array, the SUM of the order-level shipping fee doubles. Why?",
          options: ["explode() repeats order-level columns on every child row, so order-level measures are counted once per item", "Parquet rounding errors", "Schema inference widened the type", "explode() drops null items"],
          answer: 0,
          explain: "Exploding changes the grain from one row per order to one row per item. Aggregate order-level measures before exploding, or deduplicate back to the order grain before summing them."
        },
        {
          q: "What does from_json() with an explicit schema give you over spark.read.json() with inference?",
          options: ["Human-readable output", "Automatic deduplication", "Pinned types and no extra inference pass over the data", "Broadcast joins"],
          answer: 2,
          explain: "With a declared schema Spark parses directly into known types, so there is no sampling pass and a stray value cannot silently change a column\u2019s type."
        }
      ]
    },
    "de-batch-project": {
      title: "Spark pipeline project checkpoint",
      sub: "Incremental, idempotent, partitioned pipelines.",
      questions: [
        {
          q: "An idempotent Spark write is one that\u2026",
          options: ["Always appends", "Skips the shuffle", "Never fails", "Produces the same result even if the job reruns (e.g. partition overwrite or MERGE)"],
          answer: 3,
          explain: "Reruns are normal, so a write must be replay-safe: overwrite the target partition or MERGE on a key so a retry doesn\u2019t duplicate rows."
        },
        {
          q: "An incremental Spark pipeline avoids reprocessing all history by\u2026",
          options: ["Reading only data newer than a stored high-watermark", "Always doing a full reload", "Disabling Catalyst", "Caching the source"],
          answer: 0,
          explain: "Tracking a high-watermark (max timestamp / offset) lets each run read only new records, the key to keeping a large table fresh without a full rebuild."
        },
        {
          q: "Writing output as partitioned Parquet (e.g. by dt) primarily helps downstream readers by enabling\u2026",
          options: ["Smaller schemas", "Partition pruning so queries scan only relevant folders", "Row-level locking", "Schema inference"],
          answer: 1,
          explain: "Partitioning the output by a filter column lets later queries skip non-matching partitions entirely \u2014 the biggest scan-reduction lever for the consumers of your pipeline."
        },
        {
          q: "With partitionOverwriteMode left at \u2018static\u2019, what can write.mode(\"overwrite\").partitionBy(\"dt\") do on a rerun for one day?",
          options: ["Nothing different from dynamic mode", "Replace the entire output table, not just that day\u2019s partition", "Append the day twice", "Fail because partitions exist"],
          answer: 1,
          explain: "Static mode truncates every partition matching the (absent) partition spec before writing, which for a plain path means the whole table. Dynamic mode replaces only the partitions present in the DataFrame."
        },
        {
          q: "A 7-day moving average uses rowsBetween(-6, 0) ordered by date. What breaks it silently?",
          options: ["Using avg instead of sum", "Partitioning by segment", "Writing as Parquet", "Missing days in the data, because the frame counts rows rather than calendar days"],
          answer: 3,
          explain: "rowsBetween counts rows; if a day has no row the frame spans more than seven days. Fill a date spine first or use a range-based frame over a numeric day column."
        }
      ]
    },
    "de-batch-interview": {
      title: "Spark interview checkpoint",
      sub: "Scenarios and how to reason about them out loud.",
      questions: [
        {
          q: "An interviewer says a Spark job \u201chas one task running far longer than the rest.\u201d The likely cause is\u2026",
          options: ["Too much memory", "The SQL is too short", "Data skew \u2014 a hot key concentrates rows in one task", "Caching"],
          answer: 2,
          explain: "A single straggler task is the classic signature of skew: one key holds most of the rows. Fixes include salting, AQE skew-join handling, or broadcasting the other side."
        },
        {
          q: "Best first answer to \u201chow would you speed up a slow Spark SQL query?\u201d",
          options: ["Buy a bigger cluster immediately", "Disable AQE", "Rewrite it in pure Python", "Read the plan: scan less (prune columns/partitions, push down filters) and move less (cut shuffles, broadcast small joins)"],
          answer: 3,
          explain: "Senior answers start from the plan and the two levers that dominate cost \u2014 scanning less data and moving less data across the shuffle \u2014 before reaching for more hardware."
        },
        {
          q: "Asked \u201cDataFrame API or Spark SQL \u2014 which is faster?\u201d, the strongest answer is\u2026",
          options: ["Both compile to the same Catalyst plan, so choose for readability and team convention", "SQL, because it skips the optimizer", "DataFrames, because they avoid parsing", "Neither \u2014 RDDs are always fastest"],
          answer: 0,
          explain: "The two APIs produce the same optimized plan. Saying so, and then pointing at what actually changes cost (scans and shuffles), shows you understand the engine rather than the syntax."
        },
        {
          q: "A stage shows heavy spill to disk. Which answer addresses the cause rather than the symptom?",
          options: ["Cache more DataFrames", "Reduce data per task \u2014 more shuffle partitions or earlier filters \u2014 or add executor memory", "Disable AQE", "Collect the data to the driver"],
          answer: 1,
          explain: "Spill means a task\u2019s working set exceeds its memory. Shrink the per-task data (more partitions, filter or project earlier) or give it more memory; caching competes for the same memory and makes it worse."
        },
        {
          q: "Which explanation of a broadcast join would an interviewer find most complete?",
          options: ["It is always faster than sort-merge", "It sorts both inputs on the key", "It requires bucketed tables", "It ships the small side to every executor so the large side joins in place with no shuffle \u2014 valid only while the small side stays small"],
          answer: 3,
          explain: "The mechanism (copy the small side, no big-side shuffle) plus the condition (the small side must stay under the threshold at runtime) is the complete answer; the condition is what catches people in production."
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
    blurb: "Distributed batch compute from MapReduce to Spark and Spark SQL: the DataFrame/SQL API and Catalyst, partitions, shuffles, skew and join strategies, ELT with production dbt and semantic metrics, incremental models and backfills, tuning, semi-structured data, an end-to-end pipeline and interview scenarios.",
    modules: [
      {
        id: "compute", name: "Distributed Compute & Spark SQL", icon: "blocks",
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
            id: "spark-model", title: "Spark: RDDs, DataFrames, Spark SQL & the DAG",
            summary: "A driver coordinates executors to run a lazy DAG of stages in memory \u2014 written in SQL or the DataFrame API, compiled to one plan.",
            minutes: 9, tags: ["spark", "dag", "spark-sql", "dataframe"],
            blocks: [
              { t: "p", html: "<strong>Apache Spark</strong> generalized MapReduce into a <strong>DAG</strong> of stages kept in memory. A <strong>driver</strong> builds the plan and schedules <strong>tasks</strong> onto <strong>executors</strong> (worker JVMs), each processing one partition of the data in parallel." },
              { t: "p", html: "A <strong>DataFrame</strong> is the central abstraction: a distributed table with a named, typed <strong>schema</strong>, rows partitioned across the cluster. A <strong>Dataset</strong> is its typed cousin in Scala/Java; in Python you work with DataFrames. The older <strong>RDD</strong> API is still underneath, but it hides your data from the optimizer." },
              { t: "p", html: "<strong>Spark SQL</strong> is the module that lets you express that processing relationally \u2014 as SQL strings or DataFrame method chains \u2014 over structured and semi-structured sources (Parquet on a lake, Hive tables, JDBC, JSON). Both front-ends compile to the same plan, so choose whichever reads more clearly." },
              { t: "widget", id: "de-spark-api" },
              { t: "code", lang: "python", code:
                "df = (spark.read.parquet(\"events\")\n" +
                "      .filter(\"country = 'EU'\")        # transformation (lazy)\n" +
                "      .groupBy(\"product\").sum(\"amount\")) # transformation (lazy)\n" +
                "df.write.parquet(\"out\")                # ACTION -> runs the DAG\n\n" +
                "# Same result, SQL style\n" +
                "spark.read.parquet(\"events\").createOrReplaceTempView(\"events\")\n" +
                "spark.sql(\"SELECT product, SUM(amount) FROM events \"\n" +
                "          \"WHERE country = 'EU' GROUP BY product\")" },
              { t: "table", headers: ["You write", "Spark gives you"], rows: [
                ["SQL or DataFrame code", "One optimized physical plan"],
                ["A logical 'what'", "Catalyst decides the 'how'"],
                ["A query over a cluster", "Parallel, in-memory execution"]
              ] },
              { t: "note", variant: "tip", html: "Spark separates <em>describing</em> the computation (transformations) from <em>running</em> it (an action). That gap is what lets Catalyst see the whole pipeline \u2014 push filters down, prune columns, pick join strategies \u2014 before a single byte moves." },
              { t: "note", variant: "tip", html: "Prefer DataFrame/SQL over raw RDDs and Python UDFs: Catalyst can only optimize what it can see." },
              { t: "note", variant: "key", html: "<strong>You are not running code \u2014 you are describing a plan for the driver to schedule.</strong> Nothing is measured until an action, so cost and failure both surface at the action rather than at the line that caused them, and any step that pulls results back into the driver quietly leaves the distributed model altogether. That is why a job that sails through a sample can die on the real dataset without a single line changing." }
            ]
          },
          {
            id: "transforms-actions", title: "Transformations, actions & the everyday verbs",
            summary: "Lazy transformations build the plan; actions trigger it. Narrow verbs are cheap; wide ones decide the shuffle.",
            minutes: 7, tags: ["lazy", "narrow-wide", "dataframe"],
            blocks: [
              { t: "p", html: "<strong>Transformations</strong> (" + tok("select") + ", " + tok("filter") + ", " + tok("join") + ") are <em>lazy</em> \u2014 they extend the DAG and return immediately. <strong>Actions</strong> (" + tok("count") + ", " + tok("collect") + ", " + tok("show") + ", " + tok("write") + ") force the DAG to execute and return a result or write output." },
              { t: "p", html: "Most pipelines are a handful of verbs: <strong>select</strong> chooses columns, <strong>filter / where</strong> keeps rows, <strong>withColumn</strong> derives a column, <strong>withColumnRenamed</strong> and <strong>drop</strong> tidy the schema. The SQL equivalents are " + tok("SELECT") + ", " + tok("WHERE") + " and expressions in the select list." },
              { t: "code", lang: "python", code:
                "(df\n" +
                "  .select(\"order_id\", \"amount\", \"country\")   # projection\n" +
                "  .filter(col(\"country\") == \"EU\")             # row filter\n" +
                "  .withColumn(\"amount_eur\", col(\"amount\") * 0.92)  # derived col\n" +
                "  .withColumnRenamed(\"order_id\", \"id\"))" },
              { t: "compare",
                bad: { title: "Narrow transformation", items: ["Each output partition needs one input partition", "No data movement", "e.g. map, filter, select", "Pipelined within a stage"] },
                good: { title: "Wide transformation", items: ["Output partitions need many input partitions", "Triggers a shuffle (stage boundary)", "e.g. groupBy, join, distinct", "The expensive operations"] }
              },
              { t: "note", variant: "trap", html: "Because transformations are lazy, errors and cost hide until an action runs \u2014 and handing the same DataFrame to three actions runs its lineage three times unless you persist it. When a job is mysteriously slow, count the actions before you blame the transformations." },
              { t: "note", variant: "trap", html: "Null handling is specific: " + tok("col == None") + " never matches \u2014 use " + tok("isNull()") + " / " + tok("isNotNull()") + ". And " + tok("filter") + " keeps only rows where the predicate is strictly true, so a NULL comparison silently drops the row." },
              { t: "note", variant: "key", html: "<strong>Narrow verbs are cheap because they run inside the partition a task already holds:</strong> one pass over local rows, no network. Every stage boundary is a shuffle caused by a wide transformation, so the discipline is to do every narrowing step you can before that point \u2014 each row and column dropped early is one the shuffle never carries." }
            ]
          },
          {
            id: "catalyst", title: "Catalyst: how Spark SQL plans a query",
            summary: "Parse, analyze, optimize, plan, execute \u2014 the journey from your query to running tasks.",
            minutes: 7, tags: ["catalyst", "optimizer"],
            blocks: [
              { t: "p", html: "Every Spark SQL query flows through <strong>Catalyst</strong>, the query optimizer, in stages: <strong>parse</strong> the SQL/DataFrame into a tree, <strong>analyze</strong> it (resolve table and column names against the schema), <strong>optimize</strong> the logical plan, choose a <strong>physical plan</strong>, and generate executable code (<strong>Tungsten</strong>)." },
              { t: "ol", items: [
                "<strong>Logical plan</strong> \u2014 what to compute, unoptimized.",
                "<strong>Optimized logical plan</strong> \u2014 predicate pushdown, projection pruning, constant folding, join reordering.",
                "<strong>Physical plan</strong> \u2014 concrete operators (which join algorithm, which scan).",
                "<strong>Code generation</strong> \u2014 Tungsten compiles tight JVM bytecode."
              ] },
              { t: "p", html: "You can see all of this with " + tok("df.explain(True)") + " or " + tok("EXPLAIN") + " in SQL \u2014 reading the physical plan is the single most useful debugging skill in Spark SQL." },
              { t: "note", variant: "tip", html: "The big optimizations are the same three levers as any analytical engine: <strong>predicate pushdown</strong> (filter early/low), <strong>projection pruning</strong> (read only needed columns), and <strong>partition pruning</strong> (skip irrelevant files). Catalyst applies them for you \u2014 if your data layout allows it." },
              { t: "note", variant: "tip", html: "Catalyst can only push a filter down to the scan if the predicate is on a real column \u2014 wrapping it in a Python UDF hides it, forcing a full scan. Prefer built-in functions." },
              { t: "note", variant: "key", html: "<strong>Catalyst can only skip the data your layout lets it skip.</strong> Pushdown and pruning are resolved against directory structure and file statistics, so a filter on a column the table was never organized by still reads every file \u2014 the optimizer removes work the plan makes removable, and the rest was decided when somebody chose the partition columns and write order. Read the physical plan first: if the scan node shows no pushed filters, the fix is upstream of the query." },
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
              { t: "note", variant: "tip", html: "Narrow transformations are free movement-wise; wide ones pay the shuffle tax. Cut shuffles by filtering early, broadcasting small tables, and pre-partitioning data by the join/group key. The <a class='inline' href='#/batch/shuffle/joins'>join strategies lesson</a> has a lab showing how a broadcast join skips the big-side shuffle entirely." },
              { t: "note", variant: "tip", html: "Read a Spark plan for " + tok("Exchange") + " nodes \u2014 each is a shuffle. Fewer exchanges almost always means a faster job." },
              { t: "note", variant: "key", html: "<strong>Map work scales with the cluster; the shuffle scales with the data.</strong> Doubling executors halves the scanning and leaves the bytes crossing the network exactly where they were, so as volume climbs the exchange takes over the runtime and then starts failing outright \u2014 spill, fetch timeouts, one straggler holding the stage open. The only shuffle that never fails is the one you removed by filtering, broadcasting or pre-partitioning first." }
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
              { t: "note", variant: "tip", html: "Aggregations skew too. A " + tok("groupBy") + " over millions of evenly spread keys can finish sooner than the same query over a handful of lopsided ones, because the shuffle routes every row for a group to one task. Two-stage aggregation (partial aggregate on a salted key, then a final aggregate) is the group-by version of salting." },
              { t: "note", variant: "key", html: "Skew is a data problem, not a config problem: the fix is to redistribute the hot key (salting) or avoid moving it (broadcast), not just to add more partitions." }
            ]
          },
          {
            id: "joins", title: "Join strategies",
            summary: "Broadcast, shuffle-hash and sort-merge \u2014 Spark picks by table size; you check the grain.",
            minutes: 8, tags: ["joins", "performance"],
            blocks: [
              { t: "p", html: "The join <strong>type</strong> (inner, left, right, full, semi, anti) decides what happens to non-matching rows \u2014 identical to standard SQL. The interesting part in Spark is the <em>physical strategy</em>." },
              { t: "widget", id: "de-spark-join" },
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
              { t: "note", variant: "trap", html: "Watch <strong>join fan-out</strong>: joining to a key with multiple matches multiplies rows, so a later " + tok("SUM") + " double-counts. If a join changes your row count unexpectedly, the grain broke \u2014 aggregate the child first or use a semi join." },
              { t: "note", variant: "key", html: "<strong>A join costs whatever has to move.</strong> Broadcast wins because only the small side crosses the network and the big table is read in place; sort-merge shuffles <em>and</em> sorts both inputs on the key. So ask whether the small side is still small at runtime \u2014 a dimension that quietly grew past the threshold turns every one of these joins back into a full shuffle, with no code change and no warning." },
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
              { t: "note", variant: "tip", html: "ELT keeps the raw data, so you can always re-derive models when requirements change \u2014 you don\u2019t have to re-extract from the source. That flexibility is why the modern stack is ELT-first." },
              { t: "note", variant: "tip", html: "ETL still wins when you must transform before landing for compliance (e.g. strip PII) or when the source can\u2019t dump raw volume economically." },
              { t: "note", variant: "key", html: "<strong>ELT buys you the right to change your mind, and bills you for it every month.</strong> Keeping the raw layer means any model can be rebuilt without touching the source system again \u2014 but you are now storing, securing and re-scanning data nobody has modelled yet, and the transform cost has moved onto a metered engine. Choose ELT when requirements move faster than volume, and ETL when the reverse is true." }
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
              { t: "note", variant: "tip", html: "<strong>Slim CI</strong> compares the branch to the last production manifest, builds modified nodes and their children, and defers unchanged parents to production objects. Fast feedback, realistic dependencies." },
              { t: "note", variant: "trap", html: "Materialization is a contract. Views are cheap and fresh but can push cost to every reader; tables are fast but need rebuilds; incremental models are economical but require a unique key, late-arrival lookback and full-refresh plan." },
              { t: "note", variant: "key", html: "<strong>In a mature project the SQL is the easy part; the graph is the product.</strong> Tests, exposures and state-aware builds all exist to answer one question before you merge \u2014 who breaks if this column changes? A project that cannot answer it still builds green, still passes review, and still takes a dashboard down on a Monday morning." }
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
            summary: "Process only new rows on schedule, and reprocess history deliberately \u2014 keyed to the logical date.",
            minutes: 8, tags: ["incremental", "backfill", "logical-date"],
            blocks: [
              { t: "p", html: "An <strong>incremental</strong> model processes only new/changed rows since the last run, guarded by " + tok("is_incremental()") + " and a predicate on a watermark column. It\u2019s how you keep a billion-row table fresh without rebuilding it nightly." },
              { t: "code", lang: "sql", code:
                "SELECT * FROM {{ source('app', 'events') }}\n" +
                "{% if is_incremental() %}\n" +
                "  WHERE event_ts > (SELECT MAX(event_ts) FROM {{ this }})\n" +
                "{% endif %}" },
              { t: "note", variant: "trap", html: "Incremental logic is subtle: a late-arriving row older than your watermark gets missed. Use a lookback window (reprocess the last N days) or a full-refresh on a schedule to self-heal." },
              { t: "h", text: "Backfills" },
              { t: "p", html: "A <strong>backfill</strong> deliberately reprocesses a historical range \u2014 after a bug fix, a new column or a recovered source. In an orchestrator it is simply the same pipeline run for past <strong>logical dates</strong> (catchup): each run is parameterized to its data interval, so a task keyed to " + tok("2024-01-02") + " reads and rewrites exactly that day." },
              { t: "ol", items: [
                "<strong>Parameterize by logical date</strong> \u2014 never by \u201cnow\u201d; replaying a past date must read that date\u2019s inputs.",
                "<strong>Write idempotently</strong> \u2014 overwrite the run\u2019s partition or MERGE by key (see <a class='inline' href='#/storage/ingestion/incremental-idempotent'>Incremental loads &amp; idempotency</a>).",
                "<strong>Run partition by partition</strong> \u2014 a failure resumes from the last good day instead of restarting years of history.",
                "<strong>Bound concurrency</strong> \u2014 a year of daily runs launched at once will starve the warehouse and the scheduler."
              ] },
              { t: "note", variant: "tip", html: "Rebuilding a trusted mart is also a production change: scope, shadow-table validation, atomic swap and consumer communication are covered in <a class='inline' href='#/dataops/reliability/warehouse-incidents'>Warehouse incidents, safe backfills &amp; comms</a>." },
              { t: "note", variant: "key", html: "<strong>Parameterize by logical date and write idempotently, and backfilling years of history becomes a button press rather than a heroics project.</strong> Incremental is for speed, full-refresh and backfill are for correctness \u2014 design both from day one, because you will need to reprocess history." },
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
                "<strong>OPTIMIZE</strong> (Delta) / rewrite (Iceberg) do this for table formats \u2014 see <a class='inline' href='#/databricks/delta/maintenance'>Delta maintenance</a>."
              ] },
              { t: "note", variant: "key", html: "Target ~128 MB\u20131 GB files. It\u2019s the cheapest performance win in most lakes \u2014 and table formats can compact in the background for you." }
            ]
          },
          {
            id: "caching-spill", title: "Partition sizing, caching & spill",
            summary: "Size partitions to the data, cache only what you reuse, and read spill as a signal.",
            minutes: 7, tags: ["partitioning", "caching", "spill"],
            blocks: [
              { t: "p", html: "One task processes one partition per core. Too few partitions underutilize the cluster and risk <strong>spill</strong> (writing to disk when a task exceeds memory); too many drown you in scheduler overhead. The sweet spot is partitions of roughly <strong>128 MB</strong>, and " + tok("spark.sql.shuffle.partitions") + " (default 200) sets the post-shuffle count \u2014 tune it or let AQE coalesce it." },
              { t: "widget", id: "de-spark-tuning" },
              { t: "p", html: "" + tok("cache()") + " / " + tok("persist()") + " keep a computed DataFrame in memory (or memory-and-disk via a storage level) so reuse skips recomputation. <strong>Spill</strong> happens when a shuffle or aggregation exceeds memory and Spark writes to disk \u2014 correct but slow." },
              { t: "note", variant: "trap", html: "Caching is not free: it consumes executor memory that the shuffle needs, and caching something used once just causes spill. Cache only intermediates you genuinely reuse across multiple actions, and " + tok("unpersist()") + " them when done." },
              { t: "note", variant: "key", html: "Reuse \u2192 cache; single-use \u2192 don\u2019t. Size partitions to ~128 MB. If you see heavy spill, you need more memory, more partitions, or less data per task \u2014 not more caching." }
            ]
          },
          {
            id: "tuning", title: "Tuning: scan less, move less, AQE",
            summary: "The handful of levers that fix most slow Spark jobs \u2014 and the order to pull them in.",
            minutes: 8, tags: ["tuning", "aqe", "performance"],
            blocks: [
              { t: "p", html: "Spark performance comes down to two principles: <strong>scan less</strong> data and <strong>move less</strong> data across the shuffle. Every lever below serves one of those two." },
              { t: "ul", items: [
                "<strong>Pushdown &amp; pruning</strong> \u2014 project columns, push filters to the scan, partition-prune Parquet.",
                "<strong>Broadcast small joins</strong> \u2014 raise the threshold for slightly larger dimensions.",
                "<strong>Adaptive Query Execution (AQE)</strong> \u2014 re-optimizes at runtime: coalesces shuffle partitions, switches join types, splits skew. Leave it on.",
                "<strong>Shuffle partitions</strong> \u2014 size to your data, not the default 200.",
                "<strong>Avoid Python UDFs</strong> \u2014 they serialize rows to a Python worker and are opaque to Catalyst; prefer built-in/SQL functions (or vectorized pandas UDFs when you must).",
                "<strong>Tame skew</strong> \u2014 salt hot keys or rely on AQE skew-join handling."
              ] },
              { t: "note", variant: "tip", html: "The diagnostic loop is always the same: read the Spark UI, find the slow stage, ask <em>shuffle, skew, or spill?</em> \u2014 then apply the matching fix. Most jobs need only two or three of these levers." },
              { t: "note", variant: "trap", html: "Reaching for a bigger cluster first is the junior move. A skewed key or a needless shuffle wastes hardware no matter how big the cluster \u2014 fix the plan, then scale if you still must." },
              { t: "note", variant: "tip", html: "Skew is the one failure mode that does not respond to more hardware: a stage gated on one oversized key finishes when that task finishes. Read the spread of task durations in the slow stage \u2014 an even spread is a volume problem, a long tail is a key problem." },
              { t: "note", variant: "key", html: "<strong>Tune in order: remove work, then redistribute it, then resize it.</strong> A filter that runs earlier and a shuffle that never happens beat any configuration value, because every knob on this page only divides up the work you failed to eliminate." },
              { t: "quiz", id: "de-batch-perf" }
            ]
          }
        ]
      },
      {
        id: "practice", name: "Spark SQL in Practice", icon: "plug",
        lessons: [
          {
            id: "semi-structured", title: "Structured & semi-structured data",
            summary: "Columnar formats with explicit schemas, and flattening nested JSON into tidy, typed rows.",
            minutes: 9, tags: ["parquet", "schema", "json", "complex-types"],
            blocks: [
              { t: "p", html: "<strong>Structured data</strong> has a fixed schema \u2014 named, typed columns. Spark reads it best from <strong>columnar formats</strong> like <strong>Parquet</strong> and <strong>ORC</strong>, which carry the schema and per-column min/max statistics in the file footer: <strong>projection pushdown</strong> reads only selected columns, <strong>predicate pushdown</strong> skips row groups that cannot match, and files are <strong>splittable</strong> across tasks." },
              { t: "code", lang: "python", code:
                "# Only the 'amount' column chunks are read; non-matching\n" +
                "# row groups are skipped via min/max statistics.\n" +
                "df = (spark.read.parquet(\"s3://lake/sales\")\n" +
                "      .select(\"amount\")\n" +
                "      .where(col(\"amount\") > 100))" },
              { t: "note", variant: "tip", html: "Always prefer an <strong>explicit schema</strong> for production reads. It avoids an inference pass and pins types so a stray value can\u2019t silently widen a column to string." },
              { t: "h", text: "Nested and semi-structured data" },
              { t: "p", html: "<strong>Semi-structured</strong> data (JSON, nested events) has structure but not a flat table shape. Spark models it with <strong>complex types</strong>: " + tok("struct") + " (nested record), " + tok("array") + " and " + tok("map") + " \u2014 queried with dot/index access and dedicated functions. The key verb is <strong>explode</strong>, which turns an array into one row per element; " + tok("from_json") + " parses a JSON string column against a schema." },
              { t: "code", lang: "python", code:
                "from pyspark.sql.functions import explode, col\n\n" +
                "events = spark.read.schema(event_schema).json(\"events/\")\n" +
                "flat = (events\n" +
                "  .select(col(\"user.id\").alias(\"user_id\"),     # struct field\n" +
                "          explode(\"items\").alias(\"item\"))       # array -> rows\n" +
                "  .select(\"user_id\", \"item.sku\", \"item.qty\"))" },
              { t: "note", variant: "tip", html: "The usual pattern is <strong>land semi-structured, flatten to structured</strong>: read JSON, explode and project nested fields into typed columns, then write Parquet or a table format for everything downstream." },
              { t: "note", variant: "trap", html: "Schema inference on JSON costs an extra scan and can guess wrong (an all-null field becomes string). Supply a schema with " + tok("from_json") + " or " + tok("spark.read.schema(\u2026)") + " when the shape is known." },
              { t: "note", variant: "key", html: "<strong>Flattening is the moment nested events acquire a grain, so state it out loud.</strong> Every " + tok("explode") + " multiplies rows by the array length, so any later " + tok("SUM") + " over an event-level measure double-counts once per child \u2014 the same fan-out bug as a join, arriving through a different door. And columnar skipping is statistical: it only helps when the filtered column is clustered by write order, and thousands of tiny files defeat it from the other direction." },
              { t: "quiz", id: "de-batch-data" }
            ]
          },
          {
            id: "spark-pipeline", title: "Project: an incremental Spark SQL pipeline",
            summary: "Read \u2192 transform \u2192 write, assembled into a replay-safe daily revenue mart.",
            minutes: 9, tags: ["etl", "pipeline", "project"],
            blocks: [
              { t: "p", html: "A Spark <strong>ETL pipeline</strong> is the familiar shape: <strong>read</strong> sources into DataFrames, <strong>transform</strong> with filters, joins, aggregations and windows, and <strong>write</strong> to a lake or warehouse \u2014 typically partitioned Parquet or an open table format. Three properties make it production-grade:" },
              { t: "ul", items: [
                "<strong>Incremental</strong> \u2014 read only data past a stored high-watermark or the run\u2019s own partition, not all history.",
                "<strong>Idempotent</strong> \u2014 overwrite the target partition or MERGE on a key so reruns don\u2019t duplicate.",
                "<strong>Partitioned output</strong> \u2014 write by a filter column so downstream queries prune."
              ] },
              { t: "h", text: "Worked example: daily revenue by segment" },
              { t: "ol", items: [
                "<strong>Read</strong> raw orders (Parquet) and the customer dimension.",
                "<strong>Filter</strong> to the run\u2019s day partition (incremental).",
                "<strong>Join</strong> orders to customers \u2014 broadcast the small dimension.",
                "<strong>Aggregate</strong> revenue grouped by date and segment.",
                "<strong>Window</strong> a 7-day moving average per segment.",
                "<strong>Write</strong> partitioned by date, replacing only the run\u2019s partition."
              ] },
              { t: "code", lang: "python", code:
                "spark.conf.set(\"spark.sql.sources.partitionOverwriteMode\", \"dynamic\")\n\n" +
                "orders = spark.read.parquet(\"lake/raw/orders\").where(col(\"dt\") == run_dt)\n" +
                "cust   = spark.read.parquet(\"lake/dim/customer\")\n\n" +
                "daily = (orders.dropDuplicates([\"order_id\"])\n" +
                "  .join(broadcast(cust), \"customer_id\")\n" +
                "  .groupBy(\"dt\", \"segment\")\n" +
                "  .agg(sum(\"amount\").alias(\"revenue\")))\n\n" +
                "daily.write.mode(\"overwrite\").partitionBy(\"dt\").parquet(\"lake/marts/revenue_daily\")\n\n" +
                "# moving average over the history table, not the single-day slice\n" +
                "hist = spark.read.parquet(\"lake/marts/revenue_daily\")\n" +
                "w = Window.partitionBy(\"segment\").orderBy(\"dt\").rowsBetween(-6, 0)\n" +
                "mart = hist.withColumn(\"rev_7d_avg\", avg(\"revenue\").over(w))" },
              { t: "note", variant: "trap", html: "A 7-day window over a single day\u2019s rows averages one value. Compute moving averages over the history, and remember " + tok("rowsBetween") + " counts rows, not days: fill missing dates (a date spine) or use a range frame over a numeric day column." },
              { t: "note", variant: "tip", html: "In an interview, narrate these steps and name the trade-off at each \u2014 \u201cbroadcast the dimension to skip the shuffle,\u201d \u201creplace only this partition so reruns are safe.\u201d That reasoning is what they\u2019re listening for." },
              { t: "note", variant: "key", html: "<strong>Every line is performance except the write mode, and that one is correctness.</strong> Replacing the run\u2019s own partition makes a retry produce the same table a first attempt would have; appending makes the second attempt add to the first. With static overwrite mode, \u201coverwrite\u201d can wipe the whole table \u2014 be explicit about which partitions a rerun may replace." },
              { t: "quiz", id: "de-batch-project" }
            ]
          },
          {
            id: "interview-scenarios", title: "Interview-focused scenarios",
            summary: "The recurring Spark SQL questions and a senior way to reason through each.",
            minutes: 8, tags: ["interview", "scenarios"],
            blocks: [
              { t: "p", html: "Spark SQL interviews reward <em>reasoning</em>, not memorized trivia. Most questions are variations on a few scenarios \u2014 here\u2019s how to think about them out loud." },
              { t: "table", headers: ["They ask", "Reason from"], rows: [
                ["\u201cWhy is this job slow?\u201d", "Read the plan: shuffle, skew, or spill?"],
                ["\u201cOne task runs forever\u201d", "Data skew \u2014 a hot key; salt or AQE skew-join"],
                ["\u201cSpeed up this join\u201d", "Broadcast the small side; check sizes & stats"],
                ["\u201cReduce the scan\u201d", "Column projection + partition pruning + Parquet"],
                ["\u201cDataFrame vs SQL?\u201d", "Same Catalyst plan \u2014 pick for readability"],
                ["\u201cAvoid double-counting\u201d", "Join fan-out broke the grain; aggregate first"]
              ] },
              { t: "note", variant: "tip", html: "Anchor every answer to two levers: <strong>scan less</strong> and <strong>move less</strong>. Almost every Spark performance question is one of those two in disguise \u2014 say so, then give the specific technique." },
              { t: "note", variant: "trap", html: "Avoid answering \u201cadd more executors\u201d first. Interviewers want to hear that you\u2019d read the physical plan and fix skew or a needless shuffle <em>before</em> scaling hardware." },
              { t: "note", variant: "tip", html: "Keep a crisp definition ready for the classics: lazy evaluation, narrow vs wide transformations, broadcast vs sort-merge join, " + tok("cache") + " vs " + tok("persist") + ", and why a UDF is slower than a built-in." },
              { t: "note", variant: "tip", html: "Packaging this for a r\u00e9sum\u00e9 and the project deep-dive \u2014 framing by scale and outcome, the baseline-and-measurement questions that follow \u2014 is covered in the Compass atlas (behavioral interviews) in this collection, in <em>Story Bank &amp; Playbooks \u203a Engineering A Story Bank \u203a R\u00e9sum\u00e9 lines that survive the deep-dive</em>. The throughline worth carrying in: <strong>scan less, move less, and make every write replay-safe.</strong>" },
              { t: "note", variant: "key", html: "<strong>Name the observation before you name the technique.</strong> Every row in that table collapses to one of three things you can see in the plan and the stage view: the query read data it did not need, it moved data it did not need to move, or one task held far more of a key than its peers. Say which one you are looking at, then give the fix \u2014 a technique offered without the observation behind it sounds memorized, and the follow-up question will find out." },
              { t: "quiz", id: "de-batch-interview" }
            ]
          }
        ]
      }
    ]
  };
})();
