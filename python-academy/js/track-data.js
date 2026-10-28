/* =====================================================================
   PYXIS · Data Engineering in Python
   window.TRACKS.data — modules: frames / pipelines
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     dfPlanner — pandas vs Polars (and beyond) planner
  ================================================================== */
  var OPS = {
    agg: { label: "filter + group_by", pd: 2.0, pl: 0.6 },
    join: { label: "large join", pd: 3.0, pl: 1.5 },
    window: { label: "window / rolling", pd: 2.5, pl: 1.2 },
    udf: { label: "row-wise Python UDF", pd: 2.0, pl: 1.0 }
  };
  function gb(x) { return x < 1 ? K.fmt(x * 1024, 0) + " MB" : K.fmt(x, x < 10 ? 1 : 0) + " GB"; }

  Widgets.dfPlanner = function (mount) {
    K.shell(mount, "planner", "pandas vs Polars planner",
      "Describe the job. The planner estimates peak memory for eager pandas and lazy Polars, recommends an engine and prints the plan it would use. Rough rules of thumb, chosen to show the trade-offs.");
    var s = { size: 2, fmt: "parquet", op: "agg", ram: 16 };
    var plan = h("ol", { class: "w-stage", style: "margin:0;padding-left:22px;font-family:var(--font-mono);font-size:0.8rem;color:var(--text);display:grid;gap:4px" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var op = OPS[s.op];
      var inMem = s.size * (s.fmt === "parquet" ? 3 : 1.2);
      var pushdown = s.fmt === "parquet" ? 0.35 : 0.8;
      var pdPeak = inMem * op.pd;
      var plPeak = inMem * pushdown * op.pl;
      var engine, why, steps;
      if (s.size >= 200 && s.ram < 64) {
        engine = "Warehouse pushdown (Snowpark / SQL)";
        why = "The data is far larger than one machine's memory. Keep it where it lives and push the computation down; pull back only the aggregated result.";
        steps = ["session.table(\"EVENTS\")", ".filter(col(\"EVENT_DATE\") >= start)", ".group_by(\"REGION\").agg(sum_(\"AMOUNT\"))", ".write.save_as_table(\"DAILY_REGION\")  # runs in the warehouse"];
      } else if (pdPeak <= s.ram * 0.5 && s.size <= 2) {
        engine = "pandas is fine";
        why = "Peak memory fits comfortably. Use vectorised operations, Arrow-backed dtypes and categoricals; the ecosystem and team familiarity win.";
        steps = ["pd.read_" + s.fmt + "(path, columns=needed" + (s.fmt === "parquet" ? ", dtype_backend=\"pyarrow\")" : ")"), "df = df[df[\"status\"] == \"paid\"]", "df.groupby(\"region\", observed=True)[\"amount\"].sum()"];
      } else if (plPeak <= s.ram * 0.7) {
        engine = "Polars lazy";
        why = "Eager pandas would materialise everything; Polars' lazy plan pushes filters and column selection into the scan and runs multi-threaded.";
        steps = ["pl.scan_" + s.fmt + "(path)", ".filter(pl.col(\"status\") == \"paid\")          # predicate pushdown", ".select(\"region\", \"amount\")                     # projection pushdown", ".group_by(\"region\").agg(pl.col(\"amount\").sum())", ".collect(engine=\"streaming\")"];
      } else {
        engine = "DuckDB or Polars streaming (out of core)";
        why = "Even a lazy in-memory plan is tight. DuckDB spills large joins and aggregations to disk; Polars' streaming engine processes batches.";
        steps = ["duckdb.sql(\"\"\"", "  SELECT region, sum(amount) FROM read_" + s.fmt + "('" + "data/*." + s.fmt + "')", "  WHERE status = 'paid' GROUP BY region", "\"\"\").pl()     # hand the small result to Polars"];
      }
      K.clear(plan);
      steps.forEach(function (t) { plan.appendChild(h("li", {}, t)); });
      K.clear(readout);
      readout.appendChild(K.ro("input", gb(s.size) + " " + s.fmt.toUpperCase()));
      readout.appendChild(K.ro("pandas eager peak", "\u2248 " + gb(pdPeak)));
      readout.appendChild(K.ro("Polars lazy peak", "\u2248 " + gb(plPeak)));
      readout.appendChild(K.ro("machine RAM", s.ram + " GB"));
      readout.appendChild(K.ro("recommend", engine));
      readout.appendChild(K.wide(why + (s.op === "udf" ? " Whatever the engine, a row-wise Python function runs at interpreter speed: rewrite it as expressions first." : "")));
    }
    var ctl = h("div", { class: "w-stage", style: "display:flex;flex-wrap:wrap;gap:12px;align-items:center" });
    ctl.appendChild(K.labeled("input size", K.segment([["2", "2 GB"], ["0.1", "100 MB"], ["20", "20 GB"], ["200", "200 GB"]], 0, function (v) { s.size = +v; paint(); })));
    ctl.appendChild(K.labeled("format", K.segment([["parquet", "Parquet"], ["csv", "CSV"]], 0, function (v) { s.fmt = v; paint(); })));
    ctl.appendChild(K.labeled("operation", K.segment(Object.keys(OPS).map(function (k) { return [k, OPS[k].label]; }), 0, function (v) { s.op = v; paint(); })));
    ctl.appendChild(K.labeled("RAM GB", K.range(8, 128, 8, s.ram, function (v) { s.ram = v; paint(); })));
    mount.appendChild(ctl);
    mount.appendChild(readout);
    mount.appendChild(plan);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "data-frames": {
      title: "DataFrame engines checkpoint",
      sub: "pandas, Polars, Arrow and DuckDB.",
      questions: [
        {
          q: "Why is df.apply(func, axis=1) usually slow in pandas?",
          options: ["It calls a Python function once per row, paying interpreter overhead for every row instead of using vectorised column operations","It runs on the GPU","It sorts the frame first","It copies the file from disk"],
          answer: 0,
          explain: "Row-wise apply is a Python loop in disguise. Column arithmetic, np.where, map with a dict or merge with a lookup table run in compiled code."
        },
        {
          q: "What does Polars' lazy API give you that eager evaluation does not?",
          options: ["Automatic plotting","SQL syntax only","Row-level locking","A query plan the optimiser can rewrite: predicate and projection pushdown into the scan, common subexpression elimination and streaming execution"],
          answer: 3,
          explain: "scan_parquet plus filter and select builds a plan; collect() runs an optimised version that reads only needed columns and row groups. explain() shows the plan."
        },
        {
          q: "What problem does Copy-on-Write in pandas solve?",
          options: ["Slow CSV parsing","Missing GPU support","Ambiguous chained assignment, where it was unclear whether modifying a selection changed the original frame","Time zone handling"],
          answer: 2,
          explain: "Under Copy-on-Write, any derived frame behaves like a copy; data is only copied when one side is modified. df[df.x > 0]['y'] = 1 can no longer silently modify or fail to modify the parent."
        },
        {
          q: "Why is Apache Arrow important to the Python data ecosystem?",
          options: ["It is a database","It is a shared columnar in-memory format, so pandas, Polars, DuckDB and others can exchange data with little or no copying","It replaces Parquet","It is a plotting library"],
          answer: 1,
          explain: "Arrow standardises how columns sit in memory. Engines that speak it can hand buffers to each other directly, which makes mixing tools cheap."
        },
        {
          q: "When is DuckDB an especially good fit?",
          options: ["Serving thousands of concurrent OLTP writes","Analytical SQL over local Parquet, CSV or in-memory frames, including data larger than RAM thanks to spilling, inside one process with no server","Storing user sessions","Message queuing"],
          answer: 1,
          explain: "DuckDB is an embedded analytical engine: fast columnar execution, out-of-core operators and direct queries over files and DataFrames. It is not a multi-writer transactional server."
        },
        {
          q: "A 400 MB CSV is processed by a team that knows pandas well, on laptops with 32 GB. What is the sensible engine choice?",
          options: ["Stay with pandas, using vectorised ops and better dtypes, because the data fits comfortably and switching has a cost","Rewrite everything in Spark","Polars is mandatory","Load it into a warehouse first"],
          answer: 0,
          explain: "Engine choice should follow constraints. At this size pandas is fine; move to Polars or DuckDB when memory, speed or parallelism actually become problems."
        }
      ]
    },
    "data-pipelines": {
      title: "Data pipelines checkpoint",
      sub: "Design, validation, Snowpark and testing.",
      questions: [
        {
          q: "What makes a batch pipeline step idempotent?",
          options: ["It runs fast","It uses no database","It logs every row","Re-running it for the same input window produces the same final state, for example by overwriting a partition or MERGE-ing on a key instead of appending"],
          answer: 3,
          explain: "Retries and backfills are inevitable. Partition overwrites and key-based upserts make re-runs safe; blind appends create duplicates."
        },
        {
          q: "Where should a schema check such as \"amount is non-negative and order_id is unique\" run?",
          options: ["Only in the dashboard","Nowhere; trust the source","At the pipeline boundary, when data is ingested and before it is published, failing or quarantining bad batches","Only in unit tests"],
          answer: 2,
          explain: "Validating at boundaries turns silent data corruption into a loud, attributable failure. Tools such as pandera express these contracts in code."
        },
        {
          q: "In Snowpark, what happens when you build session.table(\"ORDERS\").filter(...).group_by(...).agg(...)?",
          options: ["The table is downloaded and processed locally","A Python UDF is created for each row","A lazy plan is built and executed as SQL inside Snowflake when an action such as collect() or save_as_table() runs","Nothing can be executed"],
          answer: 2,
          explain: "Snowpark DataFrames translate to SQL and push computation to the warehouse. Only the action's result crosses the network, which is why to_pandas() on a huge table is the anti-pattern."
        },
        {
          q: "Where should Snowpark connection parameters such as the account, user and key come from?",
          options: ["Constants in the module","Environment variables or a secrets manager, injected per environment, never committed","A comment in the notebook","The README"],
          answer: 1,
          explain: "Account identifiers and credentials differ by environment and must not live in source. Read them at runtime from configuration and a secret store."
        },
        {
          q: "What is the best unit test for a transformation function clean_orders(df)?",
          options: ["Build a tiny input frame with the edge cases, call the function, and compare with an expected frame using assert_frame_equal","Run the full nightly pipeline","Check that it does not raise","Count rows in production"],
          answer: 0,
          explain: "Pure transform functions on small hand-built frames give fast, precise tests that cover nulls, duplicates and boundaries. Integration tests cover the I/O separately."
        },
        {
          q: "Why keep transformations as pure functions from frame to frame?",
          options: ["It is required by pandas","They run faster","They avoid type hints","Pure functions separate logic from I/O, so they can be unit tested in milliseconds and reused across batch, streaming and backfill jobs"],
          answer: 3,
          explain: "Reading and writing at the edges, with pure logic in the middle, makes the core testable and portable. It is the same functional-core idea used in services."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.data = {
    id: "data",
    name: "Data Engineering in Python",
    short: "DATA",
    tagline: "Frames, engines and pipelines",
    color: "#fb923c",
    blurb: "The pandas model and Copy-on-Write, Polars lazy plans, Arrow and DuckDB, choosing an engine by data size and shape, then idempotent pipeline design, data validation contracts, Snowpark pushdown and a testing strategy for data pipelines.",
    modules: [
      {
        id: "frames",
        name: "DataFrame engines",
        icon: "grid",
        lessons: [
          L("pandas-model", "The pandas model", "Index, dtypes, vectorised operations and Copy-on-Write, plus the habits that keep pandas code fast and correct.", 9, ["pandas", "dtypes", "copy-on-write"], [
            B.p("A pandas DataFrame is a set of typed columns sharing an <strong>index</strong>. Speed comes from operating on whole columns; correctness comes from knowing your dtypes and whether you are working with a view or a copy."),
            B.code("python", [
              "import pandas as pd",
              "",
              "orders = pd.read_parquet(\"orders.parquet\",",
              "                         columns=[\"order_id\", \"region\", \"status\", \"amount\"],",
              "                         dtype_backend=\"pyarrow\")",
              "orders[\"region\"] = orders[\"region\"].astype(\"category\")     # repeated strings stored once",
              "",
              "paid = orders[orders[\"status\"] == \"paid\"]                  # boolean mask, vectorised",
              "paid = paid.assign(net=paid[\"amount\"] * 0.8)                # new column, no mutation of orders",
              "summary = paid.groupby(\"region\", observed=True)[\"net\"].agg([\"sum\", \"count\"])",
              "",
              "# avoid: a Python call per row",
              "# paid[\"net\"] = paid.apply(lambda r: r.amount * 0.8, axis=1)"
            ]),
            B.table(["Habit", "Why"], [
              ["Read only needed columns", "Memory and I/O scale with columns read"],
              ["Explicit dtypes, categoricals, Arrow-backed strings", "Smaller memory, faster comparisons, fewer object columns"],
              ["Vectorised ops, np.where, merge for lookups", "Compiled loops instead of per-row Python"],
              ["assign / method chaining over in-place edits", "Clear data flow, no surprises from shared data"],
              ["Validate after joins (row counts, uniqueness)", "Many-to-many joins silently multiply rows"]
            ]),
            B.p("<strong>Copy-on-Write</strong>, the default in pandas 3.0, makes every derived frame behave like a copy: modifying a selection never changes its parent, and data is physically copied only when one side is written. Chained assignment such as <code class='tok'>df[df.x &gt; 0][\"y\"] = 1</code> no longer works; use <code class='tok'>df.loc[mask, \"y\"] = 1</code>."),
            B.trap("<code class='tok'>merge</code> on a key that is not unique on either side multiplies rows. Pass <code class='tok'>validate=\"many_to_one\"</code> (or one_to_one) so pandas raises instead of silently inflating totals."),
            B.cue("<strong>Spotting it in a prompt:</strong> revenue doubled after a refactor. Check the joins for duplicated keys before anything else."),
            B.key("<strong>Columns, dtypes and masks.</strong> Read less, type explicitly, vectorise, use loc for assignment, and validate join cardinality.")
          ]),
          L("polars-lazy", "Polars and lazy query plans", "Expressions, lazy scans with pushdown, multi-threaded execution and streaming, and how to read a plan.", 9, ["polars", "lazy", "expressions"], [
            B.p("Polars is a DataFrame engine written in Rust on Arrow memory. Its core idea is the <strong>expression</strong>: a description of a column computation that the engine can optimise and run in parallel. In <strong>lazy</strong> mode, expressions build a plan that is optimised before any data is read."),
            B.widget("dfPlanner"),
            B.code("python", [
              "import polars as pl",
              "",
              "plan = (",
              "    pl.scan_parquet(\"events/*.parquet\")",
              "      .filter(pl.col(\"event_date\") >= pl.date(2026, 1, 1))     # pushed into the scan",
              "      .with_columns(net=pl.col(\"amount\") * (1 - pl.col(\"discount\")))",
              "      .group_by(\"region\")",
              "      .agg(pl.col(\"net\").sum().alias(\"revenue\"),",
              "           pl.col(\"user_id\").n_unique().alias(\"buyers\"))",
              "      .sort(\"revenue\", descending=True)",
              ")",
              "print(plan.explain())                       # inspect the optimised plan",
              "result = plan.collect(engine=\"streaming\")   # batches; for larger-than-RAM inputs"
            ]),
            B.table(["", "pandas", "Polars"], [
              ["Execution", "Eager, mostly single-threaded", "Eager or lazy, multi-threaded"],
              ["Index", "Row index is central", "No index; explicit columns"],
              ["API style", "Methods plus indexing", "Expressions in select / with_columns / agg"],
              ["Memory", "Materialises each step", "Lazy plans prune columns and rows early"],
              ["Ecosystem", "Largest, most libraries accept it", "Growing; converts to and from Arrow and pandas"]
            ]),
            B.tip("Write Polars code as expressions, not <code class='tok'>map_elements</code> with Python lambdas. A Python callback disables most optimisations and runs at interpreter speed."),
            B.cue("<strong>Interview cue:</strong> \"lazy lets the engine see the whole query, so it reads only the columns and row groups it needs\" is the crisp reason Polars wins on large Parquet."),
            B.key("<strong>Expressions plus lazy plans.</strong> Scan instead of read, let filters and selects push down, inspect with explain(), and stream when inputs outgrow memory.")
          ]),
          L("arrow-duckdb", "Arrow, Parquet and DuckDB", "The columnar memory and file formats that connect the ecosystem, and an in-process SQL engine that queries them directly.", 8, ["arrow", "parquet", "duckdb"], [
            B.p("<strong>Arrow</strong> is a columnar in-memory format; <strong>Parquet</strong> is a columnar file format with compression, statistics and row groups. Together they let tools exchange data without serialising row by row, and let readers skip data they do not need."),
            B.code("python", [
              "import duckdb, polars as pl, pyarrow.parquet as pq",
              "",
              "meta = pq.read_metadata(\"orders.parquet\")",
              "print(meta.num_rows, meta.num_row_groups)    # statistics let engines skip row groups",
              "",
              "# DuckDB: SQL over files, frames and Arrow tables in-process",
              "top = duckdb.sql(\"\"\"",
              "    SELECT region, sum(amount) AS revenue",
              "    FROM read_parquet('orders/*.parquet')",
              "    WHERE status = 'paid'",
              "    GROUP BY region ORDER BY revenue DESC",
              "\"\"\").pl()                                    # result as a Polars frame",
              "",
              "users = pl.read_parquet(\"users.parquet\")",
              "joined = duckdb.sql(\"SELECT * FROM top JOIN users USING (region)\").arrow()  # query frames by name"
            ]),
            B.table(["Tool", "Role", "Strength"], [
              ["Arrow (pyarrow)", "Memory format and IO", "Zero-copy interchange, compute kernels"],
              ["Parquet", "Storage format", "Columnar, compressed, predicate skipping via statistics"],
              ["DuckDB", "Embedded analytical SQL", "Fast joins and aggregations, spills to disk, no server"],
              ["Polars / pandas", "DataFrame APIs", "Programmatic transforms in Python"]
            ]),
            B.tip("Partition Parquet datasets by a commonly filtered column (date, region) and keep files in the hundreds of megabytes. Thousands of tiny files cost more in metadata than they save."),
            B.warn("DuckDB is single-process and file-based: superb for analytics, batch jobs and tests, but not a replacement for a multi-writer transactional database behind a web service."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"we spin up a cluster to aggregate 30 GB of Parquet\". A single DuckDB or Polars process on one machine is often faster and far cheaper."),
            B.key("<strong>Arrow connects, Parquet stores, DuckDB queries.</strong> Use columnar formats end to end and reach for in-process SQL before a cluster.")
          ]),
          L("choosing-engine", "Choosing a data engine", "A decision guide from data size, shape, team and deployment, from pandas on a laptop to warehouse pushdown.", 7, ["decision", "engines", "scale"], [
            B.p("There is no best engine, only a best fit for the data's size, the operations, where the data lives and who maintains the code. Start with the simplest tool that meets the constraints and switch when a measured limit is hit."),
            B.table(["Situation", "Good default", "Reason"], [
              ["Under ~1 GB, exploratory or ML features", "pandas", "Ecosystem, familiarity, plotting and ML integration"],
              ["1\u2013100 GB on one machine, transform-heavy", "Polars lazy", "Pushdown, parallelism, streaming"],
              ["SQL-shaped analytics on files", "DuckDB", "Out-of-core joins, SQL the analysts read"],
              ["Data already in Snowflake", "Snowpark or SQL", "Compute next to data; no export"],
              ["Hundreds of GB+ in a lake, many jobs", "Spark or warehouse engines", "Distributed execution and governance"]
            ]),
            B.cmp("Engine-first thinking", ["\"We use Spark for everything\"", "Exporting warehouse tables to laptops", "Rewriting working pandas code for fashion"],
              "Constraint-first thinking", ["Where does the data live and how big is it?", "Which operations dominate: joins, windows, UDFs?", "What will the team operate and debug confidently?"]),
            B.p("Mixing engines is cheap thanks to Arrow: DuckDB for a heavy join, Polars for feature engineering, pandas for the final hand-off to a library that expects it. Keep conversion points few and deliberate."),
            B.quiz("data-frames"),
            B.cue("<strong>Interview cue:</strong> answer engine questions with size, location and operation first, then name the tool. It shows judgement rather than preference."),
            B.key("<strong>Fit the engine to the constraints.</strong> pandas small, Polars or DuckDB for one big machine, pushdown when data lives in a warehouse, and Arrow to glue them.")
          ])
        ]
      },
      {
        id: "pipelines",
        name: "Pipelines",
        icon: "share",
        lessons: [
          L("pipeline-design", "Designing batch pipelines", "Extract, transform and load with idempotent steps, incremental watermarks, partitioned writes and safe backfills.", 9, ["etl", "idempotency", "backfill"], [
            B.p("A pipeline is reliable when it can be <strong>re-run safely</strong>. Every step will be retried, backfilled or run twice by accident at some point; design for that from the start."),
            B.diagram("data-pipeline", "A batch pipeline: extract incrementally, validate at the boundary, transform with pure functions, and publish idempotently with a MERGE or partition overwrite."),
            B.table(["Principle", "In practice"], [
              ["Idempotent writes", "Overwrite the partition for the run date, or MERGE on a business key"],
              ["Incremental extraction", "Watermark on updated_at or a change stream, with an overlap window for late rows"],
              ["Pure transforms", "Functions frame \u2192 frame; I/O only at the edges"],
              ["Validate at boundaries", "Schema and quality checks after extract and before publish"],
              ["Parameterised runs", "Run date and environment are inputs, never constants"],
              ["Observable", "Row counts in and out, durations, data freshness per table"]
            ]),
            B.code("python", [
              "def run(run_date: date, cfg: PipelineConfig) -> RunStats:",
              "    raw = extract_orders(cfg.source, since=run_date - cfg.overlap, until=run_date)",
              "    validate_raw(raw)                               # fail loudly on schema drift",
              "    clean = clean_orders(raw)                       # pure",
              "    daily = aggregate_daily(clean)                  # pure",
              "    validate_output(daily)",
              "    publish_partition(cfg.target, run_date, daily)  # overwrite: re-runs are safe",
              "    return RunStats(rows_in=len(raw), rows_out=len(daily))"
            ]),
            B.trap("Appending each run's output makes every retry a duplicate. If you must append, include a run identifier and deduplicate downstream, but partition overwrite or MERGE is simpler."),
            B.tip("Backfills are just runs for old dates. If the pipeline is parameterised by run date and idempotent, a backfill is a loop over dates, ideally throttled and run oldest first."),
            B.cue("<strong>Interview cue:</strong> \"what happens if this step runs twice?\" is the question to ask of every pipeline design, including your own."),
            B.key("<strong>Design for re-runs.</strong> Incremental extraction with overlap, pure transforms, validation at the edges, and idempotent publishing parameterised by run date.")
          ]),
          L("data-validation", "Data validation and contracts", "Express schemas and quality rules in code, decide whether bad data fails or quarantines, and agree contracts with producers.", 8, ["pandera", "contracts", "quality"], [
            B.p("Data quality bugs are silent: totals drift, joins drop rows, a column fills with nulls after an upstream change. A <strong>contract</strong> written as code turns those into explicit failures at a known boundary."),
            B.code("python", [
              "import pandera.polars as pa",
              "import polars as pl",
              "",
              "class Orders(pa.DataFrameModel):",
              "    order_id: str = pa.Field(unique=True)",
              "    region: str = pa.Field(isin=[\"AMER\", \"EMEA\", \"APJC\"])",
              "    amount: float = pa.Field(ge=0)",
              "    ordered_at: pl.Datetime = pa.Field(nullable=False)",
              "",
              "    class Config:",
              "        strict = True                  # unexpected columns are an error",
              "",
              "validated = Orders.validate(raw_orders, lazy=True)   # collect all failures, not just the first"
            ]),
            B.table(["Check type", "Example", "On failure"], [
              ["Schema", "Columns, types, nullability", "Fail the run"],
              ["Uniqueness / keys", "order_id unique; foreign keys present", "Fail or quarantine"],
              ["Ranges and enums", "amount \u2265 0; region in allowed set", "Quarantine bad rows"],
              ["Volume", "Row count within 30% of the 7-day average", "Alert, maybe fail"],
              ["Freshness", "Latest ordered_at within 2 hours", "Alert"],
              ["Reconciliation", "Sum of amount equals source total", "Fail"]
            ]),
            B.p("Decide per rule whether to <strong>fail</strong> (stop and alert), <strong>quarantine</strong> (write bad rows aside and continue) or <strong>warn</strong>. Publishing partial data silently is the one choice that is never acceptable."),
            B.tip("Version contracts with producers like an API: additive changes are fine, removals and type changes need notice. A contract test in the producer's CI catches breaking changes before they ship."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"the dashboard was wrong for a week before anyone noticed\". Missing volume, freshness and reconciliation checks."),
            B.key("<strong>Write the contract as code and enforce it at boundaries.</strong> Choose fail, quarantine or warn per rule, and never publish silently degraded data.")
          ]),
          L("snowpark", "Snowpark for Python", "Build lazy DataFrames that run as SQL in Snowflake, use UDFs deliberately, and keep environments and credentials out of code.", 9, ["snowpark", "snowflake", "pushdown"], [
            B.p("Snowpark gives Python a DataFrame API whose operations compile to SQL and execute <strong>inside Snowflake</strong>. Data stays in the warehouse; only results you explicitly collect come back. It is the Spark-like way to write warehouse transformations in Python."),
            B.code("python", [
              "import os",
              "from snowflake.snowpark import Session",
              "from snowflake.snowpark.functions import col, sum as sum_",
              "",
              "params = {",
              "    \"account\": os.environ[\"SNOWFLAKE_ACCOUNT\"],      # per environment, injected",
              "    \"user\": os.environ[\"SNOWFLAKE_USER\"],",
              "    \"private_key_file\": os.environ[\"SNOWFLAKE_KEY_PATH\"],   # key file mounted from a secret store",
              "    \"role\": os.environ[\"SNOWFLAKE_ROLE\"],",
              "    \"warehouse\": os.environ[\"SNOWFLAKE_WAREHOUSE\"],",
              "    \"database\": os.environ[\"SNOWFLAKE_DATABASE\"],",
              "    \"schema\": os.environ[\"SNOWFLAKE_SCHEMA\"],",
              "}",
              "session = Session.builder.configs(params).create()",
              "",
              "daily = (session.table(\"ORDERS\")",
              "         .filter(col(\"STATUS\") == \"PAID\")",
              "         .group_by(\"REGION\", \"ORDER_DATE\")",
              "         .agg(sum_(\"AMOUNT\").alias(\"REVENUE\")))",
              "daily.write.mode(\"overwrite\").save_as_table(\"DAILY_REVENUE\")   # executes in the warehouse"
            ]),
            B.table(["Construct", "Runs where", "Use for"], [
              ["DataFrame operations", "Warehouse, as SQL", "Filters, joins, aggregations: the default"],
              ["Vectorised UDF", "Warehouse Python sandbox, batches", "Logic SQL cannot express, row batches as pandas"],
              ["Scalar UDF", "Warehouse Python sandbox, per row", "Small logic; slower than vectorised"],
              ["Stored procedure", "Warehouse", "Orchestrating several steps server-side"],
              ["<code class='tok'>to_pandas()</code>", "Client", "Small results only"]
            ]),
            B.warn("<code class='tok'>session.table(\"EVENTS\").to_pandas()</code> on a large table pulls everything over the network into one process. Aggregate in Snowpark first, then collect the small result."),
            B.trap("Never hardcode account names, roles, databases or environment-specific IDs. They change between dev, test and production; pass them as configuration so the same code deploys everywhere."),
            B.cue("<strong>Interview cue:</strong> \"Snowpark is lazy and pushes down; the expensive mistake is collecting too early\" shows you understand where the work happens."),
            B.key("<strong>Push computation to the data.</strong> Build lazy Snowpark plans, prefer DataFrame ops over UDFs, collect only small results, and inject every environment value.")
          ]),
          L("pipeline-testing", "Testing data pipelines", "Unit test pure transforms with tiny frames, run SQL in-process with DuckDB or Snowpark local testing, and add data tests in production.", 9, ["testing", "assert_frame_equal", "duckdb"], [
            B.p("Pipelines need the same test pyramid as services, adapted to data. Most tests should exercise <strong>pure transforms on tiny frames</strong>; fewer should run real queries; production data checks catch what tests cannot predict."),
            B.code("python", [
              "import polars as pl",
              "from polars.testing import assert_frame_equal",
              "",
              "def test_clean_orders_drops_refunds_and_dedupes():",
              "    raw = pl.DataFrame({",
              "        \"order_id\": [\"a\", \"a\", \"b\", \"c\"],",
              "        \"status\":   [\"paid\", \"paid\", \"refunded\", \"paid\"],",
              "        \"amount\":   [10.0, 10.0, 5.0, None],",
              "    })",
              "    expected = pl.DataFrame({\"order_id\": [\"a\", \"c\"], \"status\": [\"paid\", \"paid\"],",
              "                             \"amount\": [10.0, 0.0]})",
              "    assert_frame_equal(clean_orders(raw), expected)"
            ]),
            B.table(["Layer", "What it covers", "Tooling"], [
              ["Unit: pure transforms", "Edge cases: nulls, duplicates, time zones, empty input", "pytest + assert_frame_equal, Hypothesis"],
              ["SQL logic", "Queries and views on small fixtures", "DuckDB in-process; Snowpark local testing mode"],
              ["Integration", "Real connectors, permissions, file layouts", "Test schema in a non-production environment"],
              ["Contract", "Producer and consumer schemas agree", "Schema tests in both CIs"],
              ["Production data tests", "Volume, freshness, reconciliation", "Checks after each run, alerts"]
            ]),
            B.code("python", [
              "from snowflake.snowpark import Session",
              "",
              "def test_daily_revenue_local():",
              "    session = Session.builder.config(\"local_testing\", True).create()   # no warehouse needed",
              "    orders = session.create_dataframe(",
              "        [[\"AMER\", \"PAID\", 10.0], [\"AMER\", \"REFUNDED\", 4.0]],",
              "        schema=[\"REGION\", \"STATUS\", \"AMOUNT\"])",
              "    out = daily_revenue(orders).collect()",
              "    assert out[0][\"REVENUE\"] == 10.0"
            ]),
            B.tip("Keep a small, version-controlled set of golden input and output files for tricky business rules. When logic changes on purpose, the diff of the golden output is the review artefact."),
            B.quiz("data-pipelines"),
            B.cue("<strong>Interview cue:</strong> \"unit tests prove the logic; data tests in production prove the data\". You need both because upstream data changes without a code change."),
            B.key("<strong>Test logic small and data continuously.</strong> Tiny frames for transforms, in-process SQL for queries, integration in a test environment, and checks after every production run.")
          ])
        ]
      }
    ]
  };
})();
