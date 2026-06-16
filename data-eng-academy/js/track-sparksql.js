/* =====================================================================
   CASCADE · Spark SQL track  (curriculum + quizzes + widgets)
   Sectional flow: Apache Spark & Spark SQL -> DataFrames & SQL ops ->
   joins/aggregations/windows -> structured & semi-structured data ->
   performance optimization -> partitioning/caching/tuning -> ETL
   pipelines -> real-world project & interview-focused scenarios.
   Self-contained: registers window.TRACKS.sparksql + its quizzes/widgets.
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var h = WK.h, shell = WK.shell;

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
  function codeCard(lang, code) {
    return h("div", { class: "code-card", style: "margin:0" },
      h("div", { class: "code-head" },
        h("span", { class: "code-dots", html: "<i></i><i></i><i></i>" }),
        h("span", { class: "code-lang" }, lang)),
      h("pre", {}, h("code", { style: "white-space:pre;font-size:.74rem" }, code)));
  }

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — DataFrame API <-> Spark SQL equivalence */
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
      left.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--accent);margin-bottom:6px" }, "DataFrame API (PySpark)"));
      left.appendChild(codeCard("python", ops[cur].df));
      var right = h("div", { style: "flex:1;min-width:230px" });
      right.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--cyan);margin-bottom:6px" }, "Spark SQL"));
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

  /* 2 — Join strategy picker */
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
      row.appendChild(h("div", { style: "font-family:var(--font-mono);color:var(--accent);font-size:.8rem" }, "\u2A1D join"));
      row.appendChild(tbl("right", r));
      stage.appendChild(row);
      stage.appendChild(h("div", { style: "text-align:center;margin-top:12px;font-family:var(--font-mono);font-weight:700;color:var(--accent)" },
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

  /* 3 — Partition / cache tuning sandbox */
  window.Widgets["de-spark-tuning"] = function (mount) {
    shell(mount, "lab", "Partition & Cache Tuning",
      "Size your shuffle partitions to the data. Too few risks spill; too many drowns in overhead.");
    var dataGB = 50, parts = 200, cached = false;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var avgMB = Math.round(dataGB * 1024 / parts);
      var verdict, vcolor;
      if (avgMB > 256) { verdict = "too few partitions \u2014 risk of spill / OOM"; vcolor = "var(--rose)"; }
      else if (avgMB < 8) { verdict = "too many tiny partitions \u2014 scheduler overhead"; vcolor = "var(--amber)"; }
      else { verdict = "healthy (near the ~128 MB target)"; vcolor = "var(--lime)"; }
      stage.innerHTML = "";
      stage.appendChild(h("div", { style: "text-align:center;padding:10px 0" },
        h("div", { style: "font-family:var(--font-display);font-weight:800;font-size:2rem;color:" + vcolor }, avgMB + " MB"),
        h("div", { style: "font-family:var(--font-mono);font-size:.66rem;color:var(--text-faint)" }, "average partition size")));
      stage.appendChild(h("div", { style: "text-align:center;font-family:var(--font-mono);font-size:.78rem;color:" + vcolor }, verdict));
      if (cached) stage.appendChild(h("div", { style: "text-align:center;margin-top:8px;font-family:var(--font-mono);font-size:.66rem;color:var(--cyan)" }, "cached \u2014 reuse skips recompute (costs executor memory)"));
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
    "sparksql-foundations": {
      title: "Spark SQL foundations checkpoint",
      sub: "Apache Spark, the DataFrame/SQL API and Catalyst.",
      questions: [
        {
          q: "What is Spark SQL\u2019s relationship to the DataFrame API?",
          options: ["They are unrelated engines", "Both are front-ends that compile to the same Catalyst logical plan", "SQL is faster because it skips Catalyst", "DataFrames can\u2019t express joins"],
          answer: 1,
          explain: "A SQL string and the equivalent DataFrame calls are parsed into the same logical plan and optimized by Catalyst, so they have identical performance \u2014 use whichever reads better."
        },
        {
          q: "In Spark, a transformation such as filter() or select() is\u2026",
          options: ["Executed immediately", "Lazy \u2014 it builds the plan until an action triggers execution", "Always a shuffle", "A write to disk"],
          answer: 1,
          explain: "Transformations are lazy; nothing runs until an action (show, count, write) forces the DAG to execute, which lets Catalyst optimize the whole query first."
        },
        {
          q: "Catalyst is Spark SQL\u2019s\u2026",
          options: ["Storage format", "Cluster manager", "Query optimizer that turns a logical plan into an optimized physical plan", "Streaming engine"],
          answer: 2,
          explain: "Catalyst parses, analyzes and optimizes the logical plan (predicate pushdown, projection pruning, join reordering) and selects physical operators; Tungsten then executes them efficiently."
        }
      ]
    },
    "sparksql-operations": {
      title: "DataFrame & SQL operations checkpoint",
      sub: "Joins, aggregations and window functions.",
      questions: [
        {
          q: "A broadcast hash join is chosen when\u2026",
          options: ["Both tables are huge", "One side is small enough to copy to every executor, avoiding a shuffle of the big side", "There is no join key", "The data is already sorted"],
          answer: 1,
          explain: "If a side is under the broadcast threshold (~10 MB by default), Spark ships it to all executors so each joins its big-table partition locally \u2014 no shuffle of the large table."
        },
        {
          q: "Unlike GROUP BY, a window function\u2026",
          options: ["Collapses each group to one row", "Returns a value per row while computing over a partition/frame", "Cannot use ORDER BY", "Only works on strings"],
          answer: 1,
          explain: "Window functions compute across a frame defined by OVER (PARTITION BY \u2026 ORDER BY \u2026) but keep every input row \u2014 so you can show a salary and its rank side by side."
        },
        {
          q: "Which correctly filters before aggregating in Spark SQL?",
          options: ["HAVING amount > 0 then GROUP BY", "WHERE amount > 0 then GROUP BY product", "GROUP BY then WHERE", "ORDER BY then GROUP BY"],
          answer: 1,
          explain: "WHERE filters rows before grouping (cheaper, aggregates less); HAVING filters the grouped results after aggregation. Filtering early is both correct and faster."
        }
      ]
    },
    "sparksql-data": {
      title: "Structured & semi-structured data checkpoint",
      sub: "File formats, schema and complex types.",
      questions: [
        {
          q: "Why is Parquet preferred over JSON for large Spark tables?",
          options: ["It is human-readable", "It is columnar with min/max stats, enabling column pruning and predicate pushdown", "It cannot be compressed", "It stores one row per file"],
          answer: 1,
          explain: "Parquet\u2019s columnar layout lets Spark read only needed columns and skip row groups via min/max stats \u2014 far less I/O than parsing whole JSON records."
        },
        {
          q: "To turn an array column into one row per element in Spark, you use\u2026",
          options: ["pivot()", "explode()", "collect_list()", "broadcast()"],
          answer: 1,
          explain: "explode() (and posexplode()) flattens an array or map column into multiple rows \u2014 the standard way to normalize nested/semi-structured data."
        },
        {
          q: "Letting Spark infer JSON schema on read is convenient but\u2026",
          options: ["Always free", "Costs an extra pass over the data and can guess types wrong", "Impossible", "Faster than a fixed schema"],
          answer: 1,
          explain: "Schema inference scans the data to deduce types, adding a pass and risking wrong/loose types; supplying an explicit schema is faster and safer in production."
        }
      ]
    },
    "sparksql-performance": {
      title: "Performance & tuning checkpoint",
      sub: "Optimization, partitions and caching.",
      questions: [
        {
          q: "The default spark.sql.shuffle.partitions of 200 is\u2026",
          options: ["Always optimal", "Often wrong \u2014 too many for small data, too few for huge data", "Ignored by Spark", "The number of executors"],
          answer: 1,
          explain: "200 shuffle partitions rarely matches your data: it creates tiny tasks on small data and oversized, spill-prone tasks on large data. Tune it or let AQE coalesce."
        },
        {
          q: "Adaptive Query Execution (AQE) improves a query by\u2026",
          options: ["Compiling to C", "Re-optimizing at runtime using actual partition sizes (coalescing, skew handling, join switching)", "Removing all shuffles", "Caching every DataFrame"],
          answer: 1,
          explain: "AQE uses real runtime statistics to coalesce shuffle partitions, split skewed ones and switch join strategies \u2014 fixing plans the optimizer couldn\u2019t cost accurately upfront."
        },
        {
          q: "Calling cache() is most worthwhile when a DataFrame is\u2026",
          options: ["Used exactly once", "Reused across multiple actions", "Tiny and trivial", "Never referenced again"],
          answer: 1,
          explain: "Caching pays off only when an expensive intermediate is reused by several actions; caching a single-use DataFrame just consumes memory and can trigger spill."
        }
      ]
    },
    "sparksql-etl": {
      title: "ETL pipelines checkpoint",
      sub: "Building pipelines with Spark SQL.",
      questions: [
        {
          q: "An idempotent Spark write is one that\u2026",
          options: ["Always appends", "Produces the same result even if the job reruns (e.g. partition overwrite or MERGE)", "Never fails", "Skips the shuffle"],
          answer: 1,
          explain: "Reruns are normal, so a write must be replay-safe: overwrite the target partition or MERGE on a key so a retry doesn\u2019t duplicate rows."
        },
        {
          q: "An incremental Spark pipeline avoids reprocessing all history by\u2026",
          options: ["Always doing a full reload", "Reading only data newer than a stored high-watermark", "Disabling Catalyst", "Caching the source"],
          answer: 1,
          explain: "Tracking a high-watermark (max timestamp / offset) lets each run read only new records, the key to keeping a large table fresh without a full rebuild."
        },
        {
          q: "Writing output as partitioned Parquet (e.g. by dt) primarily helps downstream readers by enabling\u2026",
          options: ["Smaller schemas", "Partition pruning so queries scan only relevant folders", "Row-level locking", "Schema inference"],
          answer: 1,
          explain: "Partitioning the output by a filter column lets later queries skip non-matching partitions entirely \u2014 the biggest scan-reduction lever for the consumers of your pipeline."
        }
      ]
    },
    "sparksql-interview": {
      title: "Interview prep checkpoint",
      sub: "Scenarios and how to reason about them.",
      questions: [
        {
          q: "An interviewer says a Spark job \u201chas one task running far longer than the rest.\u201d The likely cause is\u2026",
          options: ["Too much memory", "Data skew \u2014 a hot key concentrates rows in one task", "The SQL is too short", "Caching"],
          answer: 1,
          explain: "A single straggler task is the classic signature of skew: one key holds most of the rows. Fixes include salting, AQE skew-join handling, or broadcasting the other side."
        },
        {
          q: "Best first answer to \u201chow would you speed up a slow Spark SQL query?\u201d",
          options: ["Buy a bigger cluster immediately", "Read the plan: scan less (prune columns/partitions, push down filters) and move less (cut shuffles, broadcast small joins)", "Rewrite it in pure Python", "Disable AQE"],
          answer: 1,
          explain: "Senior answers start from the plan and the two levers that dominate cost \u2014 scanning less data and moving less data across the shuffle \u2014 before reaching for more hardware."
        },
        {
          q: "Why prefer built-in functions over a Python UDF in Spark SQL?",
          options: ["UDFs are illegal", "Built-ins stay in the optimized engine and vectorize; Python UDFs serialize rows and block Catalyst", "UDFs can\u2019t take arguments", "There is no difference"],
          answer: 1,
          explain: "A Python UDF ships rows to a Python process and is a black box to Catalyst (no pushdown, no codegen). Built-in/SQL functions run in the JVM engine and vectorize \u2014 much faster."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM  (follows the course's sectional flow)
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sparksql = {
    id: "sparksql", name: "Spark SQL", short: "SPARK",
    tagline: "Query big data at scale, ace the interview", color: "#818cf8",
    blurb: "A focused path through Apache Spark SQL, from fundamentals to advanced data-engineering use cases: the DataFrame and SQL APIs, joins, aggregations and window functions, structured and semi-structured data, performance optimization, partitioning, caching and query tuning, ETL pipelines, and interview-focused scenarios.",
    modules: [
      {
        id: "foundations", name: "Spark SQL Foundations", icon: "compass",
        lessons: [
          {
            id: "intro-spark", title: "Introduction to Apache Spark & Spark SQL",
            summary: "What Spark is, why Spark SQL exists, and the engine both the SQL and DataFrame APIs share.",
            minutes: 7, tags: ["spark", "intro"],
            blocks: [
              { t: "p", html: "<strong>Apache Spark</strong> is a distributed engine for processing data far too big for one machine. A <strong>driver</strong> builds a plan and schedules <strong>tasks</strong> onto <strong>executors</strong> across a cluster, each working on a slice of the data in parallel and (where possible) in memory." },
              { t: "p", html: "<strong>Spark SQL</strong> is the module that lets you express that processing as <em>relational</em> queries \u2014 in SQL or through the <strong>DataFrame</strong> API \u2014 over structured and semi-structured data. Both front-ends are compiled and optimized by the same engine, so you get database-style declarative querying at cluster scale." },
              { t: "widget", id: "de-spark-api" },
              { t: "table", headers: ["You write", "Spark gives you"], rows: [
                ["SQL or DataFrame code", "One optimized physical plan"],
                ["A logical 'what'", "Catalyst decides the 'how'"],
                ["A query over a cluster", "Parallel, in-memory execution"]
              ] },
              { t: "note", variant: "key", html: "The headline idea: <strong>Spark SQL and the DataFrame API are two doors into the same optimizer.</strong> Choose whichever reads more clearly \u2014 the performance is identical because both become the same Catalyst plan." },
              { t: "note", variant: "tip", html: "Spark SQL also unifies sources: the same query can read Parquet on a lake, a Hive table, a JDBC database, or JSON \u2014 all as DataFrames with a schema." }
            ]
          },
          {
            id: "dataframes-sql", title: "DataFrames, Datasets & the SQL API",
            summary: "The core abstraction \u2014 a distributed, schema-bearing table \u2014 and the three ways to query it.",
            minutes: 6, tags: ["dataframe", "api"],
            blocks: [
              { t: "p", html: "A <strong>DataFrame</strong> is a distributed table: rows partitioned across the cluster, with a named, typed <strong>schema</strong>. It\u2019s the central abstraction of Spark SQL. A <strong>Dataset</strong> is its typed cousin in Scala/Java; in Python you work with DataFrames." },
              { t: "p", html: "There are three interchangeable ways to query a DataFrame, all lazy and all compiled to the same plan:" },
              { t: "ul", items: [
                "<strong>DataFrame API</strong> \u2014 method chains: " + tok("df.filter(\u2026).groupBy(\u2026).agg(\u2026)") + ".",
                "<strong>Spark SQL</strong> \u2014 register a temp view and write SQL: " + tok("spark.sql(\"SELECT \u2026\")") + ".",
                "<strong>Mixed</strong> \u2014 freely combine both in one pipeline."
              ] },
              { t: "code", lang: "python", code:
                "# Same result, two styles\n" +
                "df.createOrReplaceTempView(\"sales\")\n" +
                "a = spark.sql(\"SELECT product, SUM(amount) r FROM sales GROUP BY product\")\n" +
                "b = df.groupBy(\"product\").agg(sum(\"amount\").alias(\"r\"))\n" +
                "# a and b have identical logical plans" },
              { t: "note", variant: "key", html: "Because everything is lazy, Spark sees the <em>whole</em> pipeline before running it \u2014 that\u2019s what lets Catalyst push filters down, prune columns, and pick join strategies across the entire query." },
              { t: "note", variant: "trap", html: "Calling an <strong>action</strong> (" + tok("show()") + ", " + tok("count()") + ", " + tok("write") + ") triggers execution. A pipeline that 'looks instant' is just deferring work \u2014 the cost lands on the first action." }
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
              { t: "note", variant: "key", html: "The big optimizations are the same three levers as any analytical engine: <strong>predicate pushdown</strong> (filter early/low), <strong>projection pruning</strong> (read only needed columns), and <strong>partition pruning</strong> (skip irrelevant files). Catalyst applies them for you \u2014 if your data layout allows it." },
              { t: "note", variant: "tip", html: "Catalyst can only push a filter down to the scan if the predicate is on a real column \u2014 wrapping it in a Python UDF hides it, forcing a full scan. Prefer built-in functions." },
              { t: "quiz", id: "sparksql-foundations" }
            ]
          }
        ]
      },
      {
        id: "operations", name: "DataFrame & SQL Operations", icon: "blocks",
        lessons: [
          {
            id: "core-operations", title: "Core operations: select, filter, withColumn",
            summary: "The everyday verbs of Spark SQL \u2014 project, filter, derive columns and rename.",
            minutes: 6, tags: ["operations", "dataframe"],
            blocks: [
              { t: "p", html: "Most transformations are a handful of verbs. <strong>select / project</strong> chooses columns; <strong>filter / where</strong> keeps rows; <strong>withColumn</strong> derives a new column; <strong>withColumnRenamed</strong> and <strong>drop</strong> tidy the schema." },
              { t: "code", lang: "python", code:
                "(df\n" +
                "  .select(\"order_id\", \"amount\", \"country\")   # projection\n" +
                "  .filter(col(\"country\") == \"EU\")             # row filter\n" +
                "  .withColumn(\"amount_eur\", col(\"amount\") * 0.92)  # derived col\n" +
                "  .withColumnRenamed(\"order_id\", \"id\"))" },
              { t: "p", html: "The SQL equivalents are exactly what you\u2019d expect \u2014 " + tok("SELECT") + ", " + tok("WHERE") + ", and expressions in the select list \u2014 because both compile to the same plan." },
              { t: "note", variant: "key", html: "Project columns early. Selecting only what you need lets Catalyst prune the rest at the scan, so less data is read and shuffled through the whole query." },
              { t: "note", variant: "trap", html: "Spark functions are null-aware in specific ways: " + tok("col == None") + " never matches \u2014 use " + tok("isNull()") + " / " + tok("isNotNull()") + ". And " + tok("filter") + " keeps only rows where the predicate is strictly true." }
            ]
          },
          {
            id: "joins", title: "Joins in Spark SQL",
            summary: "Join types, and the physical strategies Spark picks from table sizes.",
            minutes: 8, tags: ["joins", "performance"],
            blocks: [
              { t: "p", html: "Joins combine two DataFrames on a key. The <strong>type</strong> (inner, left, right, full, plus semi and anti) decides what happens to non-matching rows \u2014 identical to standard SQL. The interesting part in Spark is the <em>physical strategy</em>." },
              { t: "widget", id: "de-spark-join" },
              { t: "table", headers: ["Strategy", "When", "Cost"], rows: [
                ["Broadcast hash join", "One side \u2264 broadcast threshold", "No shuffle of the big side"],
                ["Sort-merge join", "Both sides large", "Shuffle + sort both sides"],
                ["Shuffle hash join", "Medium, no sort needed", "Shuffle both"]
              ] },
              { t: "code", lang: "python", code:
                "from pyspark.sql.functions import broadcast\n" +
                "# Force-broadcast a known-small dimension to skip the big shuffle\n" +
                "orders.join(broadcast(dim_product), \"product_id\")" },
              { t: "note", variant: "key", html: "The cheapest join avoids shuffling the big table. If one side fits in memory, Spark (or you, with " + tok("broadcast()") + ") broadcasts it; otherwise sort-merge is the robust default for two large tables. For the mechanics of the exchange itself, see the <a class='inline' href='#/batch/shuffle/shuffle'>batch shuffle lesson</a>." },
              { t: "note", variant: "trap", html: "Watch <strong>join fan-out</strong>: joining to a key with multiple matches multiplies rows, so a later " + tok("SUM") + " double-counts. If a join changes your row count unexpectedly, the grain broke \u2014 aggregate the child first or use a semi join." }
            ]
          },
          {
            id: "aggregations", title: "Aggregations & GROUP BY",
            summary: "Collapse rows into groups, filter before and after, and roll up subtotals.",
            minutes: 6, tags: ["aggregation", "group-by"],
            blocks: [
              { t: "p", html: "<strong>groupBy + agg</strong> (SQL " + tok("GROUP BY") + ") collapses rows into one per group with aggregates like " + tok("sum") + ", " + tok("count") + ", " + tok("avg") + ", " + tok("countDistinct") + ". <strong>where/filter</strong> runs before grouping; <strong>having</strong> filters the groups after." },
              { t: "code", lang: "python", code:
                "(df.where(col(\"order_date\") >= \"2024-01-01\")   # before grouping\n" +
                "   .groupBy(\"product\")\n" +
                "   .agg(sum(\"amount\").alias(\"revenue\"),\n" +
                "        countDistinct(\"customer_id\").alias(\"buyers\"))\n" +
                "   .where(col(\"revenue\") > 10000))            # after (HAVING)" },
              { t: "note", variant: "key", html: "An aggregation is a <strong>wide</strong> transformation \u2014 it shuffles rows so each group lands together. Filtering early (in " + tok("where") + ", not after) means fewer rows to shuffle and aggregate." },
              { t: "note", variant: "tip", html: "" + tok("GROUPING SETS") + ", " + tok("ROLLUP") + " and " + tok("CUBE") + " compute several aggregation levels (subtotals, grand totals) in one pass \u2014 handy for reporting without unioning many queries." }
            ]
          },
          {
            id: "window-functions", title: "Window functions in Spark",
            summary: "Compute across related rows \u2014 ranking, running totals, lag/lead \u2014 without collapsing them.",
            minutes: 7, tags: ["window-functions"],
            blocks: [
              { t: "p", html: "A <strong>window function</strong> computes over a set of rows (the window) defined by " + tok("Window.partitionBy(\u2026).orderBy(\u2026)") + " but returns a value for <em>every</em> row \u2014 so you can show a value <em>and</em> its rank, running total, or previous value together." },
              { t: "code", lang: "python", code:
                "from pyspark.sql.window import Window\n" +
                "from pyspark.sql.functions import rank, sum as _sum, lag\n\n" +
                "w = Window.partitionBy(\"dept\").orderBy(col(\"salary\").desc())\n" +
                "df.withColumn(\"rk\", rank().over(w)) \\\n" +
                "  .withColumn(\"run_total\", _sum(\"salary\").over(w)) \\\n" +
                "  .withColumn(\"prev\", lag(\"salary\").over(w))" },
              { t: "p", html: "Three families: <strong>ranking</strong> (" + tok("row_number") + ", " + tok("rank") + ", " + tok("dense_rank") + "), <strong>aggregate</strong> windows (" + tok("sum") + "/" + tok("avg") + " over a frame for running totals), and <strong>offset</strong> (" + tok("lag") + ", " + tok("lead") + ")." },
              { t: "note", variant: "key", html: "The <strong>frame</strong> (" + tok("rowsBetween") + ") controls which rows the function sees \u2014 e.g. a 7-row moving average. PARTITION resets the window per group; ORDER sets the sequence. The <a class='inline' href='#/sql/analytics/window-functions'>SQL window-functions lesson</a> covers the same ideas in pure SQL." },
              { t: "note", variant: "trap", html: "A window with an " + tok("orderBy") + " but no explicit frame defaults to a <em>running</em> frame (unbounded preceding to current row). For a whole-partition aggregate, use " + tok("rowsBetween(Window.unboundedPreceding, Window.unboundedFollowing)") + "." },
              { t: "quiz", id: "sparksql-operations" }
            ]
          }
        ]
      },
      {
        id: "data", name: "Structured & Semi-structured Data", icon: "database",
        lessons: [
          {
            id: "structured-data", title: "Structured data & file formats",
            summary: "Schemas, Parquet/ORC, and reading tables the way an analytical engine wants them.",
            minutes: 6, tags: ["parquet", "schema"],
            blocks: [
              { t: "p", html: "<strong>Structured data</strong> has a fixed schema \u2014 named, typed columns. Spark SQL reads it best from <strong>columnar formats</strong> like <strong>Parquet</strong> and <strong>ORC</strong>, which carry the schema and per-column statistics in the file footer." },
              { t: "ul", items: [
                "<strong>Projection pushdown</strong> \u2014 read only the columns you select.",
                "<strong>Predicate pushdown</strong> \u2014 skip row groups whose min/max can\u2019t match a filter.",
                "<strong>Splittable</strong> \u2014 many tasks read one file in parallel."
              ] },
              { t: "code", lang: "python", code:
                "# Only the 'amount' column chunks are read; non-matching\n" +
                "# row groups are skipped via min/max statistics.\n" +
                "df = (spark.read.parquet(\"s3://lake/sales\")\n" +
                "      .select(\"amount\")\n" +
                "      .where(col(\"amount\") > 100))" },
              { t: "note", variant: "key", html: "\u201cJust write Parquet\u201d is the highest-leverage storage choice for Spark SQL: columnar pushdown and pruning mean a selective query reads a tiny slice of the data instead of all of it." },
              { t: "note", variant: "tip", html: "Always prefer an <strong>explicit schema</strong> for production reads. It avoids an inference pass and pins types so a stray value can\u2019t silently widen a column to string." }
            ]
          },
          {
            id: "semi-structured", title: "Semi-structured & complex types",
            summary: "JSON, nested structs/arrays/maps, and flattening them into tidy rows.",
            minutes: 7, tags: ["json", "complex-types"],
            blocks: [
              { t: "p", html: "<strong>Semi-structured</strong> data (JSON, nested events) has structure but not a flat table shape. Spark SQL models it with <strong>complex types</strong>: " + tok("struct") + " (nested record), " + tok("array") + ", and " + tok("map") + " \u2014 queried with dot/index access and dedicated functions." },
              { t: "code", lang: "python", code:
                "from pyspark.sql.functions import explode, col\n\n" +
                "events = spark.read.json(\"events/\")          # nested records\n" +
                "flat = (events\n" +
                "  .select(\"user.id\",                          # struct field\n" +
                "          explode(\"items\").alias(\"item\"))     # array -> rows\n" +
                "  .select(\"id\", \"item.sku\", \"item.qty\"))" },
              { t: "p", html: "The key verb is <strong>explode</strong>: it turns an array column into one row per element, normalizing nested data into the flat rows analytics wants. " + tok("from_json") + " parses a JSON string column against a schema." },
              { t: "note", variant: "key", html: "The usual pattern is <strong>land semi-structured, flatten to structured</strong>: read JSON, explode and project the nested fields into typed columns, then write Parquet for everything downstream." },
              { t: "note", variant: "trap", html: "Schema inference on JSON costs an extra scan and can guess wrong (e.g. an all-null field becomes string). Supply a schema with " + tok("from_json") + " or " + tok("spark.read.schema(\u2026)") + " when the shape is known." },
              { t: "quiz", id: "sparksql-data" }
            ]
          }
        ]
      },
      {
        id: "performance", name: "Performance & Tuning", icon: "trend",
        lessons: [
          {
            id: "performance", title: "Performance optimization techniques",
            summary: "The handful of techniques that fix most slow Spark SQL queries.",
            minutes: 8, tags: ["performance", "aqe"],
            blocks: [
              { t: "p", html: "Spark performance comes down to two principles that echo across this atlas: <strong>scan less</strong> data and <strong>move less</strong> data across the shuffle. Everything below serves one of those two." },
              { t: "ul", items: [
                "<strong>Pushdown & pruning</strong> \u2014 project columns, push filters to the scan, partition-prune.",
                "<strong>Broadcast small joins</strong> \u2014 avoid shuffling a large table against a small one.",
                "<strong>Adaptive Query Execution (AQE)</strong> \u2014 re-optimizes at runtime: coalesces partitions, handles skew, switches joins.",
                "<strong>Avoid Python UDFs</strong> \u2014 they serialize rows and block Catalyst; prefer built-in/SQL functions.",
                "<strong>Tame skew</strong> \u2014 salt hot keys or rely on AQE skew-join handling."
              ] },
              { t: "note", variant: "key", html: "The diagnostic loop never changes: read the plan / Spark UI, find the slow stage, and ask <em>shuffle, skew, or spill?</em> \u2014 then apply the matching fix. Most jobs need only two or three of these levers. The <a class='inline' href='#/batch/performance/tuning'>batch tuning lesson</a> drills each lever deeper." },
              { t: "note", variant: "trap", html: "Reaching for a bigger cluster first is the junior move. A skewed key or a needless shuffle wastes hardware no matter how big the cluster \u2014 fix the plan, then scale if you still must." },
              { t: "note", variant: "tip", html: "Keep logic in DataFrame/SQL so Catalyst can see it, keep table statistics fresh, and leave AQE on. Hand-tuning matters most <em>after</em> you\u2019ve removed unnecessary shuffles." }
            ]
          },
          {
            id: "partition-cache", title: "Partitioning, caching & query tuning",
            summary: "Size partitions to the data, cache what you reuse, and watch for spill.",
            minutes: 7, tags: ["partitioning", "caching"],
            blocks: [
              { t: "p", html: "A <strong>partition</strong> is Spark\u2019s unit of parallelism \u2014 one task per partition per core. Too few partitions underutilize the cluster and risk <strong>spill</strong> (writing to disk when a task exceeds memory); too many drown you in scheduler overhead. The sweet spot is partitions of roughly <strong>128 MB</strong>." },
              { t: "widget", id: "de-spark-tuning" },
              { t: "p", html: "Two more knobs: <strong>cache() / persist()</strong> keeps a reused DataFrame in memory so it isn\u2019t recomputed; and " + tok("spark.sql.shuffle.partitions") + " (default 200) sets the post-shuffle partition count \u2014 almost always worth tuning, or let AQE coalesce it." },
              { t: "note", variant: "trap", html: "Caching is not free: it consumes executor memory the shuffle also needs, and caching a single-use DataFrame just causes spill. Cache only intermediates genuinely reused across multiple actions." },
              { t: "note", variant: "key", html: "Reuse \u2192 cache; single-use \u2192 don\u2019t. Size partitions to ~128 MB. If you see heavy spill, you need more memory, more partitions, or less data per task \u2014 not more caching." },
              { t: "quiz", id: "sparksql-performance" }
            ]
          }
        ]
      },
      {
        id: "etl", name: "ETL & Real-world Projects", icon: "plug",
        lessons: [
          {
            id: "etl-pipelines", title: "ETL pipeline concepts using Spark",
            summary: "Read \u2192 transform \u2192 write, done so the pipeline is incremental and replay-safe.",
            minutes: 7, tags: ["etl", "pipeline"],
            blocks: [
              { t: "p", html: "A Spark SQL <strong>ETL pipeline</strong> is the familiar shape: <strong>read</strong> sources into DataFrames, <strong>transform</strong> with the operations from this track (filter, join, aggregate, window), and <strong>write</strong> the result to a lake or warehouse \u2014 typically as partitioned Parquet or an open table format." },
              { t: "code", lang: "python", code:
                "raw = spark.read.parquet(\"s3://lake/raw/orders\")\n" +
                "clean = (raw\n" +
                "  .where(col(\"event_ts\") > last_watermark)   # incremental\n" +
                "  .dropDuplicates([\"order_id\"])               # dedupe\n" +
                "  .join(broadcast(dim_customer), \"customer_id\"))\n" +
                "(clean.write\n" +
                "  .mode(\"overwrite\")                          # idempotent\n" +
                "  .partitionBy(\"dt\")\n" +
                "  .parquet(\"s3://lake/curated/orders\"))" },
              { t: "ul", items: [
                "<strong>Incremental</strong> \u2014 read only data past a stored high-watermark, not all history.",
                "<strong>Idempotent</strong> \u2014 overwrite the target partition or MERGE on a key so reruns don\u2019t duplicate.",
                "<strong>Partitioned output</strong> \u2014 write by a filter column so downstream queries prune."
              ] },
              { t: "note", variant: "key", html: "Design every pipeline to be <strong>incremental and replay-safe</strong> from day one. Jobs fail and get retried; a load that\u2019s safe to run twice turns a 3am page into a non-event." }
            ]
          },
          {
            id: "project-example", title: "Real-world project: a Spark SQL pipeline",
            summary: "A worked daily revenue mart \u2014 the patterns from this track assembled end to end.",
            minutes: 8, tags: ["project", "case-study"],
            blocks: [
              { t: "p", html: "Let\u2019s assemble one pipeline that uses the whole track: build a <strong>daily revenue-by-segment mart</strong> from raw orders and a customer dimension, incrementally and idempotently." },
              { t: "ol", items: [
                "<strong>Read</strong> raw orders (Parquet) and the customer dimension.",
                "<strong>Filter</strong> to the new day\u2019s partition (incremental).",
                "<strong>Join</strong> orders to customers \u2014 broadcast the small dimension.",
                "<strong>Aggregate</strong> revenue grouped by date and segment.",
                "<strong>Window</strong> a 7-day moving average per segment.",
                "<strong>Write</strong> partitioned by date in overwrite mode (idempotent)."
              ] },
              { t: "code", lang: "python", code:
                "orders = spark.read.parquet(\"lake/raw/orders\").where(col(\"dt\") == run_dt)\n" +
                "cust   = spark.read.parquet(\"lake/dim/customer\")\n\n" +
                "daily = (orders.join(broadcast(cust), \"customer_id\")\n" +
                "  .groupBy(\"dt\", \"segment\")\n" +
                "  .agg(sum(\"amount\").alias(\"revenue\")))\n\n" +
                "w = Window.partitionBy(\"segment\").orderBy(\"dt\").rowsBetween(-6, 0)\n" +
                "mart = daily.withColumn(\"rev_7d_avg\", avg(\"revenue\").over(w))\n\n" +
                "mart.write.mode(\"overwrite\").partitionBy(\"dt\").parquet(\"lake/marts/revenue\")" },
              { t: "note", variant: "key", html: "Notice every section of this track appears: DataFrame ops, a broadcast join, an aggregation, a window function, columnar I/O, and an idempotent partitioned write. That\u2019s a production Spark SQL pipeline in a dozen lines." },
              { t: "note", variant: "tip", html: "In an interview, narrate these steps aloud and name the trade-off at each \u2014 \u201cbroadcast the dimension to skip the shuffle,\u201d \u201coverwrite the partition so reruns are safe.\u201d That reasoning is what they\u2019re listening for." },
              { t: "quiz", id: "sparksql-etl" }
            ]
          }
        ]
      },
      {
        id: "interview", name: "Interview Prep", icon: "map",
        lessons: [
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
              { t: "note", variant: "key", html: "Anchor every answer to two levers: <strong>scan less</strong> and <strong>move less</strong>. Almost every Spark performance question is one of those two in disguise \u2014 say so, then give the specific technique." },
              { t: "note", variant: "trap", html: "Avoid answering \u201cadd more executors\u201d first. Interviewers want to hear that you\u2019d read the physical plan and fix skew or a needless shuffle <em>before</em> scaling hardware." },
              { t: "note", variant: "tip", html: "Keep a crisp definition ready for the classics: lazy evaluation, narrow vs wide transformations, broadcast vs sort-merge join, " + tok("cache") + " vs " + tok("persist") + ", and why a UDF is slower than a built-in." }
            ]
          },
          {
            id: "prep-guide", title: "Resume & interview preparation",
            summary: "How to package this skill set and who the Spark SQL path is for.",
            minutes: 5, tags: ["interview", "career"],
            blocks: [
              { t: "p", html: "This track maps to a real, in-demand skill set. Whether you\u2019re an aspiring data engineer, an analyst moving into big data, or a developer exploring the Spark ecosystem, the goal is the same: <strong>confidently work with Spark SQL for large-scale processing and apply best practices in real projects.</strong>" },
              { t: "h", text: "Show it on a resume" },
              { t: "ul", items: [
                "Frame projects by <strong>scale and outcome</strong> \u2014 \u201cprocessed N GB/day,\u201d \u201ccut runtime 60% by broadcasting a dimension and tuning shuffle partitions.\u201d",
                "Name the <strong>techniques</strong>: partition pruning, predicate pushdown, broadcast joins, AQE, idempotent incremental loads.",
                "Pair Spark SQL with the surrounding stack \u2014 storage formats, orchestration, data quality \u2014 to show end-to-end ownership."
              ] },
              { t: "h", text: "Prepare for the conversation" },
              { t: "ul", items: [
                "Be ready to <strong>read a physical plan</strong> and explain each operator.",
                "Have one <strong>end-to-end project</strong> you can walk through (like the revenue mart) with trade-offs at each step.",
                "Practice the scenario answers from the previous lesson until the reasoning is automatic."
              ] },
              { t: "note", variant: "key", html: "Across the whole track the throughline is one sentence worth memorizing: <strong>scan less, move less, and make every write replay-safe.</strong> Say that with a concrete example and you sound like someone who has shipped Spark in production." },
              { t: "quiz", id: "sparksql-interview" }
            ]
          }
        ]
      }
    ]
  };
})();
