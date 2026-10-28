/* =====================================================================
   CASCADE · Python for Data Engineering track  (curriculum + quizzes + widgets)
   Library APIs evolve; lessons teach stable concepts and name version-
   dependent behaviour explicitly.
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
    return h("span", { class: "ro" }, label + " ", h("b", accent ? { style: "color:var(--accent-ink)" } : {}, value));
  }

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — Eager vs lazy execution */
  window.Widgets["de-py-lazy"] = function (mount) {
    shell(mount, "explorer", "Eager vs Lazy Execution",
      "Eager runs each step as written. Lazy builds a plan first, so the optimizer can push the filter and column selection into the scan.");
    var mode = "eager";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var steps = {
      eager: [
        ["read_parquet(\"events/\")", "reads 40 columns \u00d7 120 M rows"],
        ["filter(country == \"DE\")", "keeps 6 M rows (after reading all 120 M)"],
        ["select(user_id, amount)", "drops 38 columns already in memory"],
        ["group_by(user_id).sum()", "aggregates 6 M rows"]
      ],
      lazy: [
        ["scan_parquet(\"events/\")", "nothing read yet \u2014 builds a plan"],
        ["filter(country == \"DE\")", "pushed into the scan (row-group skipping)"],
        ["select(user_id, amount)", "projection pushdown: 3 columns read"],
        ["group_by(user_id).sum().collect()", "optimized plan executes once"]
      ]
    };
    function paint() {
      stage.innerHTML = "";
      var log = h("div", { class: "dsa-log" });
      steps[mode].forEach(function (s, i) {
        log.appendChild(h("div", { class: mode === "lazy" && i < 3 ? "" : "ok" }, (i + 1) + ". " + s[0] + "  \u2192  " + s[1]));
      });
      stage.appendChild(log);
      readout.innerHTML = "";
      readout.appendChild(ro("columns read", mode === "eager" ? "40" : "3", true));
      readout.appendChild(ro("peak memory", mode === "eager" ? "whole table" : "only needed columns/rows"));
      readout.appendChild(ro("numbers", "illustrative"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "eager", label: "eager (pandas / pl.read_*)" }, { v: "lazy", label: "lazy (pl.scan_* / DuckDB)" }], function () { return mode; }, function (v) { mode = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 2 — Property-based test runner */
  window.Widgets["de-py-property"] = function (mount) {
    shell(mount, "lab", "Property-Based Testing",
      "Instead of one hand-picked example, generate many inputs and check an invariant. A failing case is shrunk to the smallest counterexample.");
    var impl = "buggy";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function dedupeBuggy(rows) {
      var seen = {}, out = [];
      rows.forEach(function (r) { if (!seen[r.id] || r.ts > seen[r.id].ts) { if (!seen[r.id]) out.push(r); seen[r.id] = r; } });
      return out;
    }
    function dedupeFixed(rows) {
      var best = {};
      rows.forEach(function (r) { if (!best[r.id] || r.ts > best[r.id].ts) best[r.id] = r; });
      return Object.keys(best).map(function (k) { return best[k]; });
    }
    function gen(seed) {
      var n = 1 + (seed * 7) % 6, rows = [];
      for (var i = 0; i < n; i++) rows.push({ id: (seed + i * 3) % 3, ts: (seed * 13 + i * 5) % 9 });
      return rows;
    }
    function holds(rows) {
      var out = (impl === "buggy" ? dedupeBuggy : dedupeFixed)(rows);
      var latest = {};
      rows.forEach(function (r) { if (latest[r.id] === undefined || r.ts > latest[r.id]) latest[r.id] = r.ts; });
      return out.every(function (r) { return r.ts === latest[r.id]; }) && out.length === Object.keys(latest).length;
    }
    function paint() {
      stage.innerHTML = "";
      var log = h("div", { class: "dsa-log" });
      var fail = null, ran = 0;
      for (var s = 1; s <= 60; s++) { ran++; var rows = gen(s); if (!holds(rows)) { fail = rows; break; } }
      if (fail) {
        var shrunk = fail;
        for (var k = fail.length - 1; k >= 0; k--) {
          var cand = shrunk.slice(0, k).concat(shrunk.slice(k + 1));
          if (cand.length && !holds(cand)) shrunk = cand;
        }
        log.appendChild(h("div", { class: "no" }, "\u2717 property failed after " + ran + " generated inputs"));
        log.appendChild(h("div", {}, "shrunk counterexample: " + JSON.stringify(shrunk)));
        log.appendChild(h("div", {}, "invariant: output keeps the row with the latest ts for every id"));
      } else {
        log.appendChild(h("div", { class: "ok" }, "\u2713 property held for 60 generated inputs"));
      }
      stage.appendChild(log);
      readout.innerHTML = "";
      readout.appendChild(ro("implementation", impl === "buggy" ? "keeps first-seen row" : "keeps latest row per id", true));
      readout.appendChild(ro("result", fail ? "counterexample found" : "passed"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "buggy", label: "buggy dedupe" }, { v: "fixed", label: "fixed dedupe" }], function () { return impl; }, function (v) { impl = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-python-frames": {
      title: "Python DataFrames checkpoint",
      sub: "pandas, Polars, Arrow/Parquet and DuckDB.",
      questions: [
        {
          q: "Why is df[\"total\"] = df[\"qty\"] * df[\"price\"] usually far faster than df.apply(lambda r: r.qty * r.price, axis=1)?",
          options: ["apply is deprecated", "The vectorized form runs one compiled loop over whole columns instead of calling a Python function per row", "apply cannot multiply", "They compile to the same code"],
          answer: 1,
          explain: "Column arithmetic dispatches to compiled NumPy/Arrow kernels over contiguous arrays. Row-wise apply calls a Python function for every row, paying interpreter overhead millions of times."
        },
        {
          q: "In Polars, what is the main benefit of pl.scan_parquet(...) \u2026 .collect() over pl.read_parquet(...)?",
          options: ["It returns a pandas DataFrame", "It disables multithreading", "The query is planned first, so filters and column selection can be pushed into the scan", "It writes the result to disk automatically"],
          answer: 2,
          explain: "scan_* returns a LazyFrame. Nothing runs until collect(), so the optimizer can apply predicate and projection pushdown and other rewrites before reading data."
        },
        {
          q: "What does Apache Arrow primarily standardize?",
          options: ["A columnar in-memory format that libraries can share without copying or re-serializing", "A file compression codec", "A SQL dialect", "A cluster scheduler"],
          answer: 0,
          explain: "Arrow defines a language-independent columnar memory layout. pandas (with Arrow-backed dtypes), Polars, DuckDB and PyArrow can hand data to each other with little or no copying; Parquet is the on-disk counterpart."
        },
        {
          q: "When is DuckDB a particularly good fit?",
          options: ["As a multi-user transactional database for a web app", "As a replacement for Kafka", "Only for data smaller than 1 MB", "Analytical SQL over local or remote Parquet/CSV files and DataFrames inside a single process"],
          answer: 3,
          explain: "DuckDB is an in-process, columnar, vectorized analytical engine. It shines at SQL over files and in-memory frames, including larger-than-memory queries that spill, but it is not a concurrent multi-writer OLTP server."
        },
        {
          q: "A CSV with a column of mostly integers and a few blanks is loaded with pandas defaults. What usually happens to that column?",
          options: ["It becomes float64, with NaN for the blanks", "It stays int64 with nulls", "It becomes a datetime", "The load fails"],
          answer: 0,
          explain: "Classic NumPy int64 has no missing value, so pandas upcasts to float64 and uses NaN. Nullable dtypes (Int64) or Arrow-backed dtypes keep integers with proper nulls \u2014 declare dtypes explicitly in pipelines."
        }
      ]
    },
    "de-python-testing": {
      title: "Testing data code checkpoint",
      sub: "pytest, schema/data tests and property-based tests.",
      questions: [
        {
          q: "Which code is easiest to unit-test with pytest?",
          options: ["A notebook cell that reads S3, transforms and writes", "A pure function that takes a DataFrame and returns a DataFrame", "A cron job", "A stored procedure"],
          answer: 1,
          explain: "Separating I/O from transformation logic lets you call the transform with a tiny in-memory frame and assert on the output, with no credentials, network or cleanup."
        },
        {
          q: "What does a schema test (e.g. with pandera or a contract) check that a unit test usually does not?",
          options: ["That the code compiles", "The speed of the function", "That real data flowing through the pipeline has the expected columns, types, ranges and nullability", "The Python version"],
          answer: 2,
          explain: "Unit tests check logic on inputs you chose. Schema and data tests run against actual data at pipeline boundaries, catching producer changes and bad records your examples never imagined."
        },
        {
          q: "Which is a good property to test for a deduplication function?",
          options: ["The output equals one hand-written expected frame", "The function finishes in under 1 second", "The output has more rows than the input", "Running it twice gives the same result as running it once, and keys are unique in the output"],
          answer: 3,
          explain: "Idempotency (f(f(x)) == f(x)) and key uniqueness hold for every valid input, so a property-based framework such as Hypothesis can generate many inputs and search for a counterexample."
        },
        {
          q: "When Hypothesis finds a failing input, what does it do next?",
          options: ["Shrinks it towards a minimal counterexample and reports that", "Retries until it passes", "Deletes the test", "Reports the largest failing input only"],
          answer: 0,
          explain: "Shrinking simplifies the failing input while it still fails, so you debug a two-row frame rather than a random 300-row one. Failing examples are also stored and replayed on the next run."
        },
        {
          q: "Why compare DataFrames with a testing helper (e.g. pandas.testing.assert_frame_equal) rather than ==?",
          options: ["== is not defined for DataFrames", "Helpers check dtypes, index/column order and NaN equality and print a readable diff", "Helpers run faster in production", "== always returns True"],
          answer: 1,
          explain: "Element-wise == returns a frame of booleans and treats NaN != NaN. Testing helpers compare shape, dtypes and values with tolerances and explain exactly what differs."
        }
      ]
    },
    "de-python-engineering": {
      title: "Packaging & performance checkpoint",
      sub: "Environments, packaging, profiling and concurrency.",
      questions: [
        {
          q: "What is the role of a lockfile in a data pipeline project?",
          options: ["It encrypts dependencies", "It speeds up Python", "It pins the exact resolved versions of every direct and transitive dependency so builds are reproducible", "It replaces pyproject.toml"],
          answer: 2,
          explain: "pyproject.toml declares compatible ranges; a lockfile records exactly what was resolved. Deploying from the lockfile means the job that passed CI is the job that runs in production."
        },
        {
          q: "A pipeline is slow. What should you do first?",
          options: ["Rewrite it in another language", "Add multiprocessing everywhere", "Increase the machine size", "Profile it to find where time is actually spent"],
          answer: 3,
          explain: "Intuition about hot spots is often wrong \u2014 frequently it is I/O, a row-wise loop or repeated parsing. A profiler (cProfile, or a sampling profiler such as py-spy) points at the real cost before you change anything."
        },
        {
          q: "For CPU-bound pure-Python work in standard CPython, which approach typically uses multiple cores?",
          options: ["Multiple processes (multiprocessing / ProcessPoolExecutor), or libraries that release the GIL in native code", "More threads", "asyncio", "Larger lists"],
          answer: 0,
          explain: "The GIL lets only one thread execute Python bytecode at a time in a standard build, so threads help I/O-bound work but not CPU-bound Python loops. Processes, or vectorized native libraries, use multiple cores. Free-threaded CPython builds are newer and still maturing."
        },
        {
          q: "Why prefer a src/ layout with an installable package over a folder of loose scripts?",
          options: ["It is required by Python", "Tests import the installed package exactly as production does, catching missing files and import-path accidents", "It makes code run faster", "It removes the need for tests"],
          answer: 1,
          explain: "With src/, nothing is importable until the package is installed, so tests exercise the real packaged artifact. Entry points then give each job a clean, versioned command."
        },
        {
          q: "Memory keeps growing while a job processes a large file in pandas. Which change most directly helps?",
          options: ["Call gc.collect() after every line", "Convert every column to object dtype", "Read only needed columns with explicit compact dtypes, process in chunks, or switch to a lazy/streaming engine", "Use a bigger CSV"],
          answer: 2,
          explain: "Loading every column as wide default dtypes is the usual culprit. Column selection, categorical or smaller numeric dtypes, chunked reads, or lazy engines (Polars, DuckDB) keep peak memory bounded."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.python = {
    id: "python", name: "Python for Data Engineering", short: "PY",
    tagline: "Single-node power, tested like software", color: "#facc15",
    blurb: "The Python data stack a data engineer actually ships: pandas done right, Polars eager and lazy, Arrow and Parquet with PyArrow, DuckDB for in-process SQL, choosing by data size \u2014 then pytest, schema and property-based tests, packaging, environments and profiling, assembled into a tested local pipeline.",
    modules: [
      {
        id: "frames", name: "DataFrames & Columnar Python", icon: "grid",
        lessons: [
          {
            id: "pandas", title: "pandas for pipelines, not notebooks",
            summary: "Vectorize, declare dtypes, mind nulls and copies, and know when pandas is the wrong tool.",
            minutes: 8, tags: ["pandas", "dtypes", "vectorization"],
            blocks: [
              { t: "p", html: "<strong>pandas</strong> is an eager, in-memory DataFrame library: every operation runs immediately and materializes its result. That makes it superb for exploration and modest data, and easy to misuse in pipelines that grow." },
              { t: "code", lang: "python", code:
                "import pandas as pd\n\n" +
                "orders = pd.read_csv(\n" +
                "    \"orders.csv\",\n" +
                "    usecols=[\"order_id\", \"customer_id\", \"qty\", \"price\", \"status\"],\n" +
                "    dtype={\"order_id\": \"string\", \"customer_id\": \"Int64\",\n" +
                "           \"qty\": \"Int32\", \"status\": \"category\"},\n" +
                ")\n" +
                "orders[\"total\"] = orders[\"qty\"] * orders[\"price\"]      # vectorized\n" +
                "daily = orders.groupby(\"status\", observed=True)[\"total\"].sum()" },
              { t: "ul", items: [
                "<strong>Vectorize</strong> \u2014 column expressions run in compiled kernels; " + tok("apply(axis=1)") + " and " + tok("iterrows") + " call Python per row.",
                "<strong>Declare dtypes</strong> \u2014 nullable " + tok("Int64") + " keeps integers with missing values (instead of float64 + NaN); " + tok("category") + " shrinks repeated strings; Arrow-backed dtypes (" + tok("dtype_backend=\"pyarrow\"") + ") are available in pandas 2.x.",
                "<strong>Read less</strong> \u2014 " + tok("usecols") + ", " + tok("chunksize") + " for streaming large CSVs, or Parquet with column selection.",
                "<strong>Copy-on-write</strong> \u2014 pandas is moving to copy-on-write semantics (opt-in in 2.x, the default from 3.0), which ends chained-assignment surprises; write code that never relies on modifying a slice in place."
              ] },
              { t: "note", variant: "trap", html: "The " + tok("SettingWithCopyWarning") + " means you may be writing to a temporary copy. Use " + tok(".loc[row_mask, \"col\"] = value") + " on the original frame rather than chained indexing." },
              { t: "note", variant: "key", html: "<strong>pandas cost is memory first, CPU second.</strong> An eager library holds every intermediate, often several times the size of the file. When a job approaches machine memory, the fix is rarely a cleverer pandas trick \u2014 it is reading less, or moving to a lazy engine that plans before it loads." }
            ]
          },
          {
            id: "polars", title: "Polars: expressions, eager and lazy",
            summary: "A multithreaded, Arrow-based DataFrame engine with a query optimizer behind the lazy API.",
            minutes: 8, tags: ["polars", "lazy", "expressions"],
            blocks: [
              { t: "p", html: "<strong>Polars</strong> is a DataFrame library written in Rust on Arrow memory. You describe work with <strong>expressions</strong> (" + tok("pl.col(\"amount\").sum()") + ") that run in parallel across columns and cores. It has two modes: <strong>eager</strong> " + tok("DataFrame") + " operations run immediately; <strong>lazy</strong> " + tok("LazyFrame") + " operations build a plan that runs on " + tok("collect()") + "." },
              { t: "widget", id: "de-py-lazy" },
              { t: "code", lang: "python", code:
                "import polars as pl\n\n" +
                "revenue = (\n" +
                "    pl.scan_parquet(\"lake/orders/*.parquet\")          # lazy\n" +
                "      .filter(pl.col(\"country\") == \"DE\")\n" +
                "      .with_columns((pl.col(\"qty\") * pl.col(\"price\")).alias(\"total\"))\n" +
                "      .group_by(\"customer_id\")\n" +
                "      .agg(pl.col(\"total\").sum(), pl.len().alias(\"orders\"))\n" +
                "      .sort(\"total\", descending=True)\n" +
                ")\n" +
                "print(revenue.explain())   # inspect the optimized plan\n" +
                "df = revenue.collect()     # execute once" },
              { t: "p", html: "The lazy optimizer applies <strong>predicate pushdown</strong> and <strong>projection pushdown</strong> into the scan, simplifies expressions and avoids unnecessary materialization. Polars also offers a streaming execution mode for some larger-than-memory queries; which operations it supports depends on the version." },
              { t: "note", variant: "tip", html: "Default to lazy for pipelines (" + tok("scan_parquet") + ", " + tok("scan_csv") + "), and use eager for small lookups and interactive work. " + tok("explain()") + " shows what will actually run." },
              { t: "note", variant: "trap", html: "Calling " + tok("collect()") + " in the middle of a chain, or converting to pandas and back, throws away the optimizer\u2019s view of the whole query. Keep the chain lazy until the end." },
              { t: "note", variant: "key", html: "<strong>Lazy evaluation is the same idea as Spark\u2019s, on one machine.</strong> Describe the whole query, let a planner remove work, then execute once. If you understood why Spark transformations are lazy in the <a class='inline' href='#/batch/compute/spark-model'>batch track</a>, you already understand Polars\u2019 LazyFrame." }
            ]
          },
          {
            id: "arrow-parquet", title: "Arrow memory & Parquet with PyArrow",
            summary: "One columnar format in memory, one on disk, and the dataset API that ties them together.",
            minutes: 8, tags: ["arrow", "parquet", "pyarrow"],
            blocks: [
              { t: "p", html: "<strong>Apache Arrow</strong> standardizes a columnar <em>in-memory</em> layout. Because pandas (Arrow dtypes), Polars, DuckDB and PyArrow all understand it, data can move between them with little or no copying. <strong>Parquet</strong> is the columnar <em>on-disk</em> format: row groups, column chunks, compression and min/max statistics." },
              { t: "code", lang: "python", code:
                "import pyarrow as pa, pyarrow.parquet as pq, pyarrow.dataset as ds\n\n" +
                "schema = pa.schema([(\"order_id\", pa.string()), (\"amount\", pa.decimal128(18, 2)),\n" +
                "                    (\"dt\", pa.date32())])\n" +
                "table = pa.Table.from_pylist(rows, schema=schema)\n\n" +
                "pq.write_to_dataset(table, \"lake/orders\", partition_cols=[\"dt\"],\n" +
                "                    row_group_size=128_000)\n\n" +
                "# Read back only what you need: columns + a filter pushed to row groups\n" +
                "dataset = ds.dataset(\"lake/orders\", format=\"parquet\", partitioning=\"hive\")\n" +
                "t = dataset.to_table(columns=[\"order_id\", \"amount\"],\n" +
                "                     filter=ds.field(\"dt\") == pa.scalar(run_date, pa.date32()))" },
              { t: "ul", items: [
                "<strong>Explicit schemas</strong> pin types (decimals for money, dates not strings) so a stray value cannot silently change a column.",
                "<strong>Row group size</strong> trades skipping granularity against overhead; very small row groups and tiny files hurt reads.",
                "<strong>Partitioning</strong> directories (" + tok("dt=2024-06-01/") + ") enable pruning \u2014 the same low-cardinality rule as lakehouse tables."
              ] },
              { t: "note", variant: "tip", html: "File-format fundamentals \u2014 encodings, compression and why columnar wins for analytics \u2014 are in the <a class='inline' href='#/storage/formats/parquet'>storage track</a>." },
              { t: "note", variant: "key", html: "<strong>Arrow is the reason the modern Python data stack composes.</strong> A pipeline can scan Parquet with PyArrow, query it in DuckDB, finish in Polars and hand an Arrow table to a writer without serializing through Python objects \u2014 as long as you stay columnar. The moment you convert to lists of dicts, you pay full price again." }
            ]
          },
          {
            id: "duckdb", title: "DuckDB: in-process analytical SQL",
            summary: "A vectorized SQL engine inside your Python process, querying files and DataFrames directly.",
            minutes: 7, tags: ["duckdb", "sql", "local-analytics"],
            blocks: [
              { t: "p", html: "<strong>DuckDB</strong> is an embedded, columnar, vectorized analytical database \u2014 think \u201cSQLite for analytics\u201d. It runs in your process, queries Parquet, CSV and JSON files (locally or from object storage via extensions) and in-memory pandas/Polars/Arrow data directly, and can spill to disk for larger-than-memory operations." },
              { t: "code", lang: "python", code:
                "import duckdb\n\n" +
                "con = duckdb.connect()                     # in-memory database\n" +
                "top = con.sql(\"\"\"\n" +
                "    SELECT customer_id, SUM(qty * price) AS total\n" +
                "    FROM read_parquet('lake/orders/*/*.parquet', hive_partitioning = true)\n" +
                "    WHERE dt >= DATE '2024-06-01'\n" +
                "    GROUP BY customer_id\n" +
                "    ORDER BY total DESC\n" +
                "    LIMIT 100\n" +
                "\"\"\").pl()                                # result as a Polars DataFrame" },
              { t: "table", headers: ["Good fit", "Poor fit"], rows: [
                ["Local ELT over Parquet/CSV", "Many concurrent writers (web app backend)"],
                ["Testing SQL transforms in CI", "A shared multi-user warehouse"],
                ["Ad-hoc analysis of exported data", "Low-latency point lookups at high QPS"],
                ["Glue between pandas, Polars and Arrow", "Data far larger than one machine\u2019s disk"]
              ] },
              { t: "note", variant: "tip", html: "DuckDB is excellent for running dbt-style SQL models and tests locally or in CI against sample data, so a pull request validates SQL without touching the warehouse." },
              { t: "note", variant: "key", html: "<strong>A laptop is a bigger computer than most \u201cbig data\u201d jobs need.</strong> Tens or hundreds of gigabytes of Parquet are often well within a single node running a vectorized engine. Reach for a cluster when data, concurrency or isolation demand it \u2014 not by default." }
            ]
          },
          {
            id: "choosing", title: "Choosing a tool by data size and shape",
            summary: "pandas, Polars, DuckDB or Spark \u2014 decide by size, workload, team and where the data lives.",
            minutes: 6, tags: ["architecture", "polars", "duckdb", "spark"],
            blocks: [
              { t: "table", headers: ["Situation", "Reasonable default", "Why"], rows: [
                ["Small data, exploration, rich ecosystem", "pandas", "Ubiquitous APIs, plotting, every tutorial"],
                ["Single-node pipeline, DataFrame style", "Polars (lazy)", "Multithreaded, optimizer, low memory"],
                ["Single-node pipeline, SQL style", "DuckDB", "Vectorized SQL over files and frames"],
                ["Data or concurrency beyond one machine", "Spark / a warehouse", "Distributed compute and governance"],
                ["Interchange between all of them", "Arrow / Parquet", "Shared columnar format"]
              ] },
              { t: "note", variant: "tip", html: "Mixing is normal: DuckDB for the SQL-shaped steps, Polars for the DataFrame-shaped ones, Arrow in between, Parquet at rest. Pick per step, not per project." },
              { t: "note", variant: "trap", html: "Benchmarks on synthetic data rarely match your workload. Time your real pipeline on real data, including I/O, before rewriting it for a faster library." },
              { t: "note", variant: "key", html: "<strong>The best engine is the smallest one that meets the requirement with room to grow.</strong> A single-node job is simpler to test, debug and run; a distributed one buys scale at the price of every failure mode in the batch track. Move up when measurements say so." },
              { t: "quiz", id: "de-python-frames" }
            ]
          }
        ]
      },
      {
        id: "testing", name: "Testing Data Code", icon: "shield",
        lessons: [
          {
            id: "pytest", title: "pytest for pipelines",
            summary: "Separate I/O from logic, test transforms with tiny frames, and use fixtures and parametrization.",
            minutes: 8, tags: ["pytest", "unit-tests", "fixtures"],
            blocks: [
              { t: "p", html: "Untestable pipelines usually mix reading, transforming and writing in one function. Split them: thin I/O at the edges, <strong>pure functions</strong> in the middle that take a frame and return a frame. Those are trivial to test." },
              { t: "code", lang: "python", code:
                "# pipeline/transforms.py\n" +
                "def latest_per_order(df: pl.DataFrame) -> pl.DataFrame:\n" +
                "    return df.sort(\"updated_at\").unique(\"order_id\", keep=\"last\")\n\n" +
                "# tests/test_transforms.py\n" +
                "import pytest, polars as pl\n" +
                "from polars.testing import assert_frame_equal\n" +
                "from pipeline.transforms import latest_per_order\n\n" +
                "@pytest.fixture\n" +
                "def changes():\n" +
                "    return pl.DataFrame({\"order_id\": [\"a\", \"a\", \"b\"],\n" +
                "                         \"updated_at\": [1, 3, 2], \"status\": [\"new\", \"paid\", \"new\"]})\n\n" +
                "def test_keeps_latest_change(changes):\n" +
                "    out = latest_per_order(changes).sort(\"order_id\")\n" +
                "    expected = pl.DataFrame({\"order_id\": [\"a\", \"b\"], \"updated_at\": [3, 2],\n" +
                "                             \"status\": [\"paid\", \"new\"]})\n" +
                "    assert_frame_equal(out, expected)\n\n" +
                "@pytest.mark.parametrize(\"n\", [0, 1, 1000])\n" +
                "def test_never_grows(n):\n" +
                "    df = pl.DataFrame({\"order_id\": [str(i % 7) for i in range(n)],\n" +
                "                       \"updated_at\": list(range(n)), \"status\": [\"x\"] * n})\n" +
                "    assert latest_per_order(df).height <= df.height" },
              { t: "ul", items: [
                "<strong>Fixtures</strong> build small, named inputs; " + tok("tmp_path") + " gives each test a scratch directory for file I/O tests.",
                "<strong>parametrize</strong> covers edge cases: empty input, one row, duplicates, nulls, late timestamps.",
                "<strong>Frame assertions</strong> (" + tok("assert_frame_equal") + " in pandas and Polars) check dtypes and values with a readable diff.",
                "<strong>Integration tests</strong> run the real pipeline on a sample with DuckDB or a local Spark session, marked so they can run separately."
              ] },
              { t: "note", variant: "trap", html: "Sort before comparing unless order is part of the contract \u2014 many engines do not guarantee row order after joins, group-bys or parallel reads." },
              { t: "note", variant: "key", html: "<strong>Testability is an architecture decision you make before writing the first test.</strong> If a transform cannot run without credentials and a cloud bucket, nobody will test it. Keep I/O at the edges, and every interesting rule becomes a three-line test." }
            ]
          },
          {
            id: "data-tests", title: "Schema & data tests at pipeline boundaries",
            summary: "Validate the data, not just the code: schemas, ranges, uniqueness and freshness on real inputs.",
            minutes: 7, tags: ["data-quality", "schema", "pandera"],
            blocks: [
              { t: "p", html: "Unit tests prove your logic on inputs you invented. <strong>Data tests</strong> check the data that actually arrives, at the boundaries where it enters and leaves your pipeline: column presence and types, nullability, allowed values, ranges, uniqueness, referential integrity and volume." },
              { t: "code", lang: "python", code:
                "import pandera.polars as pa   # pandera supports pandas and Polars\n\n" +
                "class Orders(pa.DataFrameModel):\n" +
                "    order_id: str = pa.Field(unique=True)\n" +
                "    qty: int = pa.Field(ge=1)\n" +
                "    price: float = pa.Field(ge=0)\n" +
                "    status: str = pa.Field(isin=[\"new\", \"paid\", \"refunded\"])\n\n" +
                "    class Config:\n" +
                "        strict = True        # reject unexpected columns\n\n" +
                "validated = Orders.validate(raw_orders, lazy=True)  # collect all failures" },
              { t: "table", headers: ["Check", "Where", "On failure"], rows: [
                ["Schema / types", "On ingest", "Fail fast; quarantine the file"],
                ["Uniqueness of keys", "Before MERGE", "Fail \u2014 a MERGE would error or double-count"],
                ["Ranges and enums", "Silver", "Quarantine rows, alert owner"],
                ["Volume and freshness", "Before publishing gold", "Block publish, notify consumers"]
              ] },
              { t: "note", variant: "tip", html: "The same ideas appear as dbt tests, Delta constraints and declarative pipeline expectations. Quality dimensions and contracts are covered in <a class='inline' href='#/orchestration/quality/testing'>Testing data</a> and <a class='inline' href='#/orchestration/quality/contracts-ci'>Contracts in CI</a>." },
              { t: "note", variant: "key", html: "<strong>Decide what a failed check does before it fails.</strong> Fail the run, quarantine the rows, or warn and continue \u2014 each is right for some check and disastrous for others. A data test with no defined action becomes a log line nobody reads." }
            ]
          },
          {
            id: "property-tests", title: "Property-based tests with Hypothesis",
            summary: "Generate many inputs, assert invariants, and let shrinking find the minimal failing case.",
            minutes: 8, tags: ["hypothesis", "property-based", "invariants"],
            blocks: [
              { t: "p", html: "Example-based tests check the cases you thought of. <strong>Property-based tests</strong> state an <em>invariant</em> that must hold for all valid inputs and let a framework such as <strong>Hypothesis</strong> generate hundreds of inputs looking for a violation. When it finds one, it <strong>shrinks</strong> it to a minimal counterexample." },
              { t: "widget", id: "de-py-property" },
              { t: "code", lang: "python", code:
                "from hypothesis import given, strategies as st\n\n" +
                "rows = st.lists(st.tuples(st.sampled_from(\"abc\"), st.integers(0, 100)), max_size=50)\n\n" +
                "@given(rows)\n" +
                "def test_dedupe_properties(pairs):\n" +
                "    df = pl.DataFrame(pairs, schema=[\"order_id\", \"updated_at\"], orient=\"row\")\n" +
                "    once = latest_per_order(df)\n" +
                "    assert once[\"order_id\"].is_unique().all()           # keys unique\n" +
                "    assert_frame_equal(latest_per_order(once).sort(\"order_id\"),\n" +
                "                       once.sort(\"order_id\"))            # idempotent\n" +
                "    if df.height:\n" +
                "        assert once[\"updated_at\"].max() == df[\"updated_at\"].max()  # keeps latest" },
              { t: "ul", items: [
                "<strong>Idempotency</strong> \u2014 " + tok("f(f(x)) == f(x)") + " for dedupes, normalizers, upserts.",
                "<strong>Round-trips</strong> \u2014 write then read returns the same data and types.",
                "<strong>Conservation</strong> \u2014 totals survive a reshape; joins to a unique dimension never add rows.",
                "<strong>Oracle comparison</strong> \u2014 an optimized implementation matches a slow, obviously correct one."
              ] },
              { t: "note", variant: "trap", html: "Over-broad strategies generate inputs your function legitimately rejects. Constrain strategies to the valid input space (or use " + tok("assume") + " sparingly), otherwise tests fail on cases that cannot happen." },
              { t: "note", variant: "key", html: "<strong>Properties are the pipeline guarantees you already claim, written down.</strong> \u201cReruns are safe\u201d is idempotency; \u201cthe join doesn\u2019t fan out\u201d is row conservation. Encoding them as properties lets a machine look for the counterexample before production does." },
              { t: "quiz", id: "de-python-testing" }
            ]
          }
        ]
      },
      {
        id: "engineering", name: "Packaging & Performance", icon: "wrench",
        lessons: [
          {
            id: "packaging", title: "Packaging, environments & reproducible builds",
            summary: "pyproject.toml, src layout, lockfiles, entry points and containers for jobs that run the same everywhere.",
            minutes: 7, tags: ["packaging", "pyproject", "lockfile"],
            blocks: [
              { t: "p", html: "A pipeline that runs only from one engineer\u2019s virtualenv is not deployable. Package it: declare metadata and dependencies in <strong>" + tok("pyproject.toml") + "</strong>, put code under " + tok("src/") + ", expose jobs as <strong>entry points</strong>, and build a wheel or container from a <strong>lockfile</strong>." },
              { t: "code", lang: "toml", code:
                "[project]\n" +
                "name = \"orders-pipeline\"\n" +
                "version = \"1.4.0\"\n" +
                "requires-python = \">=3.11\"\n" +
                "dependencies = [\"polars>=1.0\", \"duckdb>=1.0\", \"pyarrow>=15\"]\n\n" +
                "[project.optional-dependencies]\n" +
                "dev = [\"pytest\", \"hypothesis\", \"pandera[polars]\"]\n\n" +
                "[project.scripts]\n" +
                "orders-daily = \"orders_pipeline.cli:main\"\n\n" +
                "[build-system]\n" +
                "requires = [\"hatchling\"]\n" +
                "build-backend = \"hatchling.build\"" },
              { t: "ul", items: [
                "<strong>Ranges in pyproject, exact pins in the lock</strong> \u2014 tools such as uv, pip-tools or Poetry resolve and record every transitive version.",
                "<strong>src layout</strong> \u2014 tests import the installed package, not files that happen to be on the path.",
                "<strong>One artifact</strong> \u2014 the wheel or image that passed CI is the one that deploys; configuration comes from environment variables or parameters, not edits.",
                "<strong>Secrets never in the package</strong> \u2014 read credentials at runtime from a secret manager or the platform\u2019s identity, never from code or committed config."
              ] },
              { t: "note", variant: "tip", html: "The Pyxis atlas (Python) in this collection covers the language and tooling in depth \u2014 virtual environments, packaging, typing, concurrency and the standard library \u2014 beyond what a data pipeline needs." },
              { t: "note", variant: "key", html: "<strong>Reproducibility is a property of the build, not the code.</strong> The same source with an unpinned transitive dependency can behave differently next month. Lock, build once, promote the artifact through environments, and a \u201cworks in staging\u201d result actually means something." }
            ]
          },
          {
            id: "profiling", title: "Profiling & performance",
            summary: "Measure first, then fix the real bottleneck: I/O, row loops, memory or the GIL.",
            minutes: 8, tags: ["profiling", "performance", "gil"],
            blocks: [
              { t: "p", html: "Performance work starts with measurement. Most slow Python pipelines are slow for a handful of reasons \u2014 reading more data than needed, row-at-a-time Python loops, repeated parsing, or memory pressure \u2014 and a profiler tells you which." },
              { t: "table", headers: ["Tool", "Answers", "Notes"], rows: [
                [tok("cProfile") + " / " + tok("pstats"), "Which functions take the time?", "Built in; deterministic, adds overhead"],
                ["py-spy", "Where is a running process spending time?", "Sampling profiler; attach without code changes"],
                [tok("tracemalloc") + " / memray", "What is allocating memory?", "Find peak usage and leaks"],
                [tok("explain()") + " / " + tok("EXPLAIN ANALYZE"), "What will the engine actually do?", "Polars and DuckDB query plans"]
              ] },
              { t: "code", lang: "bash", code:
                "python -m cProfile -o run.prof -m orders_pipeline.cli --date 2024-06-01\n" +
                "python -c \"import pstats; pstats.Stats('run.prof').sort_stats('cumtime').print_stats(15)\"\n\n" +
                "py-spy record -o flame.svg -- python -m orders_pipeline.cli --date 2024-06-01" },
              { t: "ul", items: [
                "<strong>I/O-bound</strong> (network, object storage) \u2014 overlap requests with threads or asyncio; read columnar formats and fewer, larger files.",
                "<strong>CPU-bound in Python loops</strong> \u2014 vectorize with Polars/DuckDB/NumPy first; then use processes, since the GIL lets one thread run Python bytecode at a time in standard CPython builds (free-threaded builds are newer and still maturing).",
                "<strong>Memory-bound</strong> \u2014 select columns, use compact dtypes, process in chunks or lazily."
              ] },
              { t: "note", variant: "trap", html: "Micro-optimizing a function that accounts for 2% of runtime is wasted effort. Fix the top of the profile, re-measure, repeat." },
              { t: "note", variant: "key", html: "<strong>The fastest Python data code contains very little Python.</strong> Push work into vectorized engines that run compiled code over columns, keep Python for orchestration and glue, and your profile will show time in the engine \u2014 which is exactly where you want it." }
            ]
          },
          {
            id: "local-pipeline", title: "Project: a tested single-node pipeline",
            summary: "Polars and DuckDB transforms, data and property tests, packaged and run idempotently.",
            minutes: 9, tags: ["project", "polars", "duckdb", "testing"],
            blocks: [
              { t: "p", html: "Assemble the track into one small but production-shaped job: ingest a day of order changes, keep the latest change per order, join customers, write a partitioned Parquet mart, and prove it with tests." },
              { t: "ol", items: [
                "<strong>Read</strong> the day\u2019s files lazily with " + tok("pl.scan_parquet") + " and an explicit schema.",
                "<strong>Validate</strong> the input with a schema model; quarantine failing rows.",
                "<strong>Transform</strong> with pure functions: latest change per order, join to customers, derive totals.",
                "<strong>Aggregate</strong> with DuckDB SQL where the logic is naturally relational.",
                "<strong>Write</strong> to " + tok("mart/dt=YYYY-MM-DD/") + " by replacing that partition only, so reruns are idempotent.",
                "<strong>Test</strong> transforms with pytest, invariants with Hypothesis, and the whole job on a sample in CI."
              ] },
              { t: "code", lang: "python", code:
                "def run(run_date: date, src: Path, out: Path) -> None:\n" +
                "    changes = Orders.validate(pl.scan_parquet(src / f\"dt={run_date}\" / \"*.parquet\").collect())\n" +
                "    latest = latest_per_order(changes)\n" +
                "    daily = duckdb.sql(\n" +
                "        \"SELECT customer_id, SUM(qty * price) AS revenue FROM latest GROUP BY 1\"\n" +
                "    ).pl()\n" +
                "    target = out / f\"dt={run_date}\"\n" +
                "    tmp = target.with_name(target.name + \".tmp\")\n" +
                "    shutil.rmtree(tmp, ignore_errors=True)\n" +
                "    tmp.mkdir(parents=True)\n" +
                "    daily.write_parquet(tmp / \"part-0.parquet\")\n" +
                "    shutil.rmtree(target, ignore_errors=True)\n" +
                "    tmp.rename(target)                      # replace only this partition" },
              { t: "note", variant: "tip", html: "Writing to a temporary directory and renaming keeps readers from seeing a half-written partition on a local filesystem. Object stores have different rename semantics \u2014 there, table formats such as Delta or Iceberg provide the atomic commit (see the <a class='inline' href='#/databricks/delta/transaction-log'>Delta transaction log</a>)." },
              { t: "note", variant: "key", html: "<strong>Small pipelines deserve the same guarantees as big ones.</strong> Idempotent partition writes, validated inputs and tests for invariants cost a few dozen lines here, and they are exactly the properties that keep a job boring when it later moves to Spark or a warehouse." },
              { t: "quiz", id: "de-python-engineering" }
            ]
          }
        ]
      }
    ]
  };
})();
