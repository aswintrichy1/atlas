/* =====================================================================
   CASCADE · Databricks & Delta Lake track  (curriculum + quizzes + widgets)
   Product behaviour changes between releases; lessons describe the stable
   concepts and flag version-dependent defaults in prose.
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
  var cell = "width:auto;height:auto;padding:6px 5px;font-size:.64rem;text-align:left";

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — Delta transaction log: commits, conflicts, checkpoints, VACUUM */
  window.Widgets["de-dbx-txlog"] = function (mount) {
    shell(mount, "simulator", "Delta Transaction Log",
      "Every write is an ordered JSON commit of add/remove actions. Readers replay the log; VACUUM deletes files old versions still point at.");
    var log, files, vacuumed;
    function reset() {
      log = [{ v: 0, op: "CREATE + WRITE", add: ["part-a"], rm: [] }];
      files = { "part-a": true };
      vacuumed = false;
    }
    reset();
    var nextFile = 98;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function liveAt(v) {
      var set = {};
      log.slice(0, v + 1).forEach(function (c) { c.add.forEach(function (f) { set[f] = true; }); c.rm.forEach(function (f) { delete set[f]; }); });
      return Object.keys(set);
    }
    function live() { return liveAt(log.length - 1); }
    function commit(op, add, rm) {
      log.push({ v: log.length, op: op, add: add, rm: rm });
      add.forEach(function (f) { files[f] = true; });
    }
    function newFile() { nextFile++; return "part-" + String.fromCharCode(nextFile); }
    function paint() {
      stage.innerHTML = "";
      var board = h("div", { class: "grid-board", style: "grid-template-columns:.5fr 1.2fr 1.4fr 1.4fr;gap:3px" });
      ["ver", "operation", "add", "remove"].forEach(function (c) {
        board.appendChild(h("div", { class: "grid-cell", style: cell + ";color:var(--text-dim);font-family:var(--font-mono)" }, c));
      });
      log.forEach(function (c) {
        var lost = liveAt(c.v).some(function (f) { return !files[f]; });
        [String(c.v).padStart(5, "0") + ".json", c.op, c.add.join(", ") || "\u2014", c.rm.join(", ") || "\u2014"].forEach(function (x, i) {
          board.appendChild(h("div", { class: "grid-cell", style: cell + (i === 0 ? ";font-family:var(--font-mono)" : "") + ";color:" + (lost && i === 0 ? "var(--rose-ink)" : "var(--text)") }, x));
        });
      });
      stage.appendChild(board);
      if (log.length >= 10) stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--cyan-ink);margin-top:6px" }, "checkpoint written: readers start from the Parquet checkpoint instead of replaying every JSON commit"));
      var onDisk = Object.keys(files).filter(function (f) { return files[f]; });
      var cur = live();
      readout.innerHTML = "";
      readout.appendChild(ro("current version", String(log.length - 1), true));
      readout.appendChild(ro("live files", cur.join(", ")));
      readout.appendChild(ro("files on storage", String(onDisk.length)));
      var readable = log.filter(function (c) { return !liveAt(c.v).some(function (f) { return !files[f]; }); }).length;
      readout.appendChild(ro("time travel", readable + " / " + log.length + " versions readable" + (vacuumed ? " (red = files vacuumed)" : "")));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn primary", onclick: function () { commit("WRITE (append)", [newFile()], []); vacuumed = false; paint(); } }, "Append"),
      h("button", { class: "w-btn ghost", onclick: function () {
        var cur = live(); var victim = cur[0]; if (!victim) return;
        commit("MERGE (rewrite)", [newFile()], [victim]); vacuumed = false; paint();
      } }, "MERGE"),
      h("button", { class: "w-btn ghost", onclick: function () {
        var cur = live(); if (cur.length < 2) return;
        commit("OPTIMIZE", [newFile()], cur); vacuumed = false; paint();
      } }, "OPTIMIZE"),
      h("button", { class: "w-btn ghost", onclick: function () {
        var cur = live(); Object.keys(files).forEach(function (f) { files[f] = cur.indexOf(f) >= 0; }); vacuumed = true; paint();
      } }, "VACUUM (past retention)"),
      h("button", { class: "w-btn ghost", onclick: function () { reset(); nextFile = 98; paint(); } }, "Reset")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 2 — Data skipping: how layout changes files read */
  window.Widgets["de-dbx-skipping"] = function (mount) {
    shell(mount, "lab", "Data Skipping by Layout",
      "Delta keeps per-file min/max statistics. Skipping only works when the filtered values are concentrated in few files.");
    var layout = "none", filter = "customer";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var TOTAL = 64;
    var READS = {
      none: { customer: 64, date: 64, both: 64 },
      partition: { customer: 64, date: 2, both: 2 },
      zorder: { customer: 9, date: 10, both: 3 },
      liquid: { customer: 8, date: 9, both: 3 }
    };
    var LABEL = { none: "unordered appends", partition: "PARTITIONED BY (date)", zorder: "OPTIMIZE \u2026 ZORDER BY (customer, date)", liquid: "CLUSTER BY (customer, date)" };
    function paint() {
      var n = READS[layout][filter];
      stage.innerHTML = "";
      var grid = h("div", { style: "display:grid;grid-template-columns:repeat(16,1fr);gap:3px" });
      for (var i = 0; i < TOTAL; i++) {
        grid.appendChild(h("div", { style: "height:14px;border-radius:3px;background:" + (i < n ? "var(--accent)" : "color-mix(in srgb,var(--text-faint) 25%,transparent)") }));
      }
      stage.appendChild(grid);
      stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.64rem;color:var(--text-dim);margin-top:8px" }, "layout: " + LABEL[layout]));
      readout.innerHTML = "";
      readout.appendChild(ro("files read", n + " / " + TOTAL, true));
      readout.appendChild(ro("skipped", Math.round((1 - n / TOTAL) * 100) + "%"));
      readout.appendChild(ro("note", layout === "partition" && filter === "customer" ? "partitioning only helps filters on the partition column" : "illustrative counts, not a benchmark"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "layout:"),
      seg([{ v: "none", label: "none" }, { v: "partition", label: "partition" }, { v: "zorder", label: "Z-order" }, { v: "liquid", label: "liquid" }], function () { return layout; }, function (v) { layout = v; paint(); }),
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "filter:"),
      seg([{ v: "customer", label: "customer_id" }, { v: "date", label: "date" }, { v: "both", label: "both" }], function () { return filter; }, function (v) { filter = v; paint(); })
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
    "de-databricks-delta": {
      title: "Delta Lake internals checkpoint",
      sub: "Transaction log, ACID, schema, time travel, MERGE and layout.",
      questions: [
        {
          q: "What makes a directory of Parquet files a Delta table?",
          options: ["A special Parquet encoding", "An ordered transaction log in _delta_log that records which files belong to each version", "A metastore entry only", "A running Databricks cluster"],
          answer: 1,
          explain: "The data files are ordinary Parquet. The _delta_log directory holds ordered commits of add/remove actions plus metadata; replaying it (from the latest checkpoint) tells a reader exactly which files make up a version."
        },
        {
          q: "Two jobs append to the same Delta table at the same moment. What normally happens?",
          options: ["Both commits succeed, because blind appends do not conflict under optimistic concurrency", "The table is corrupted", "Both fail", "The second job silently overwrites the first"],
          answer: 0,
          explain: "Writers prepare files, then try to commit the next log version. On a race the loser re-checks what was committed; pure appends do not conflict, so it retries at the next version. Overlapping updates or deletes can raise a concurrent-modification error instead."
        },
        {
          q: "A daily job writes a DataFrame with a new column to an existing Delta table without any options. What happens by default?",
          options: ["The column is silently dropped", "The table schema widens automatically", "The write is rejected by schema enforcement", "The column is stored as a string"],
          answer: 2,
          explain: "Delta enforces the table schema on write. Adding columns requires explicit evolution, e.g. the mergeSchema write option or the session/table settings for automatic schema evolution in MERGE."
        },
        {
          q: "Why can SELECT \u2026 VERSION AS OF 3 fail after a VACUUM?",
          options: ["VACUUM deletes the transaction log", "Time travel only works on managed tables", "VACUUM rewrites old versions in place", "VACUUM removed data files that version 3 referenced and that were older than the retention threshold"],
          answer: 3,
          explain: "VACUUM physically deletes files no longer referenced by the current version once they pass the retention window (7 days by default). The log entry for version 3 still exists, but its files are gone."
        },
        {
          q: "A MERGE fails with an error that multiple source rows matched the same target row. What is the fix?",
          options: ["Retry the MERGE", "Deduplicate the source to one row per merge key (e.g. latest by sequence number) before merging", "Switch to INSERT", "Disable the transaction log"],
          answer: 1,
          explain: "MERGE cannot decide which of several source rows should update one target row, so it fails rather than guess. Reduce the source to one row per key \u2014 typically the latest change by a sequence or timestamp column \u2014 then merge."
        }
      ]
    },
    "de-databricks-layout": {
      title: "Delta layout & maintenance checkpoint",
      sub: "OPTIMIZE, Z-ordering, liquid clustering, data skipping and VACUUM.",
      questions: [
        {
          q: "OPTIMIZE on a Delta table primarily\u2026",
          options: ["Compacts many small files into fewer larger ones as a new table version", "Deletes old versions", "Changes the table schema", "Creates an index server"],
          answer: 0,
          explain: "OPTIMIZE rewrites small files into larger ones and commits the change as a new version; the old small files remain until VACUUM removes them after retention."
        },
        {
          q: "Delta data skipping helps a query mainly when\u2026",
          options: ["The table has no statistics", "Every file contains the full range of the filtered column", "Values of the filtered column are concentrated in a few files, so per-file min/max stats exclude the rest", "The query uses SELECT *"],
          answer: 2,
          explain: "Skipping compares the predicate with per-file min/max statistics. If values are spread across every file, no file can be excluded; clustering the data concentrates values so most files are skipped."
        },
        {
          q: "Why can partitioning a Delta table by a high-cardinality column such as customer_id backfire?",
          options: ["Delta forbids it", "It produces huge numbers of tiny files and directories, hurting reads and maintenance", "It disables time travel", "It breaks MERGE"],
          answer: 1,
          explain: "Each distinct value becomes a directory with its own files, so high cardinality creates millions of small files. Partition only by low-cardinality columns with large partitions, and use clustering for selective high-cardinality filters."
        },
        {
          q: "How does liquid clustering differ from partitioning plus Z-ordering?",
          options: ["It requires a dedicated cluster", "It only works on views", "It forces one file per row", "Clustering keys can be changed without rewriting the whole table, and clustering is applied incrementally"],
          answer: 3,
          explain: "Liquid clustering (CLUSTER BY) replaces fixed partition directories and full ZORDER rewrites with incremental clustering whose keys can be redefined later. Availability and defaults depend on runtime version, so check the docs for your release."
        },
        {
          q: "Which statement about VACUUM retention is accurate?",
          options: ["Lowering retention below the default can break concurrent readers and long-running jobs that still reference old files", "Retention has no effect on time travel", "VACUUM runs automatically on every write", "VACUUM deletes the latest version"],
          answer: 0,
          explain: "Files are kept for the retention window (7 days by default) so readers and time travel still work. Shortening it frees storage sooner but risks deleting files an in-flight query or stream still needs, which is why Delta warns on short retention."
        }
      ]
    },
    "de-databricks-platform": {
      title: "Databricks platform checkpoint",
      sub: "Compute, Unity Catalog, medallion and jobs.",
      questions: [
        {
          q: "In Unity Catalog, a table is addressed as\u2026",
          options: ["database.table", "catalog.schema.table", "workspace.table", "bucket/path only"],
          answer: 1,
          explain: "Unity Catalog uses a three-level namespace \u2014 catalog, schema, table (or view, volume, function) \u2014 under a metastore, so governance and grants work consistently across workspaces."
        },
        {
          q: "What is the key difference between a managed and an external table in Unity Catalog?",
          options: ["External tables cannot be queried with SQL", "Managed tables cannot be governed", "For managed tables Unity Catalog controls the storage location and lifecycle; dropping it removes the data, while dropping an external table leaves the files", "There is no difference"],
          answer: 2,
          explain: "Managed tables live in storage that Unity Catalog manages, so DROP deletes the data (after a retention period). External tables register files at a path you control; dropping the table leaves them."
        },
        {
          q: "In a medallion architecture, the silver layer typically holds\u2026",
          options: ["Raw files exactly as landed", "Dashboard extracts", "Business-level aggregates only", "Cleaned, deduplicated, conformed records at a stable grain"],
          answer: 3,
          explain: "Bronze keeps raw data for replay and audit; silver cleans, deduplicates and conforms it; gold shapes business-ready aggregates and data products. The layers are conventions, not a product feature."
        },
        {
          q: "Why prefer job compute over an all-purpose (interactive) cluster for scheduled production jobs?",
          options: ["Job compute starts per run, is isolated and terminates afterwards, so runs are reproducible and cheaper", "All-purpose clusters cannot run Python", "Job compute has no logs", "Interactive clusters are free"],
          answer: 0,
          explain: "Job compute (or serverless jobs) is created for the run and released afterwards, isolating production from notebook experiments and billing only for the run. Shared interactive clusters accumulate state and idle cost."
        },
        {
          q: "Expectations in a declarative pipeline (formerly Delta Live Tables) are used to\u2026",
          options: ["Schedule notebooks", "Encrypt columns", "Declare data-quality rules that warn, drop failing rows or fail the update", "Choose cluster size"],
          answer: 2,
          explain: "Expectations attach quality constraints to a dataset definition; each can be configured to record violations, drop the offending rows, or stop the update, with metrics recorded in the pipeline event log."
        }
      ]
    },
    "de-databricks-streaming": {
      title: "Structured Streaming checkpoint",
      sub: "Micro-batches, checkpoints, triggers, Auto Loader and Delta sinks.",
      questions: [
        {
          q: "What does the checkpointLocation of a Structured Streaming query store?",
          options: ["A copy of every output row", "The cluster configuration", "Source offsets, commit log and state, so a restarted query resumes where it left off", "Only error logs"],
          answer: 2,
          explain: "The checkpoint records which offsets each micro-batch processed, which batches committed and any state store data. Restarting with the same checkpoint resumes exactly; deleting or sharing it breaks recovery."
        },
        {
          q: "Trigger.AvailableNow is most useful for\u2026",
          options: ["Processing everything available now in incremental batches, then stopping \u2014 streaming semantics on a batch schedule", "Running forever with millisecond latency", "Disabling checkpoints", "Reprocessing all history every time"],
          answer: 0,
          explain: "AvailableNow processes all data that has arrived since the last checkpoint, possibly over several batches, then terminates. It gives incremental, exactly-once processing for scheduled jobs without an always-on cluster."
        },
        {
          q: "How does a Structured Streaming query achieve end-to-end exactly-once writes into Delta?",
          options: ["By disabling retries", "By writing each row twice", "Kafka guarantees it", "Replayable source offsets in the checkpoint plus idempotent, transactional Delta commits per micro-batch"],
          answer: 3,
          explain: "A replayable source, offsets recorded in the checkpoint, and a sink that commits each batch atomically and recognizes a replayed batch id together give exactly-once results. foreachBatch writers must provide their own idempotency, e.g. MERGE on a key."
        },
        {
          q: "Auto Loader (the cloudFiles source) is designed to\u2026",
          options: ["Load Kafka topics only", "Incrementally discover and ingest new files from cloud storage with schema inference and evolution", "Replace Unity Catalog", "Compact Delta tables"],
          answer: 1,
          explain: "Auto Loader tracks which files it has ingested, picks up new arrivals incrementally and can infer and evolve schemas, capturing unexpected fields in a rescued-data column instead of failing or dropping them."
        },
        {
          q: "A streaming aggregation\u2019s state grows without bound. What is the usual fix?",
          options: ["Use complete output mode", "Increase the trigger interval", "Add a watermark on the event-time column so old windows can be finalized and their state dropped", "Delete the checkpoint daily"],
          answer: 2,
          explain: "Without a watermark the engine must keep every window open in case late data arrives. A watermark bounds lateness so finished windows are emitted and their state evicted; deleting checkpoints destroys correctness."
        }
      ]
    },
    "de-databricks-compare": {
      title: "Databricks vs Snowflake checkpoint",
      sub: "Architecture, storage, governance and choosing honestly.",
      questions: [
        {
          q: "Which statement about storage is fair for both platforms today?",
          options: ["Neither supports open table formats", "Snowflake can only read CSV", "Databricks stores data only in a proprietary format", "Databricks tables are open-format files in your cloud storage; Snowflake traditionally manages its own storage format but also supports Iceberg tables"],
          answer: 3,
          explain: "Delta tables are Parquet files plus a log in object storage you control. Snowflake native tables use Snowflake-managed storage, and Snowflake also offers Apache Iceberg tables. Both platforms keep adding interoperability."
        },
        {
          q: "In both platforms, the main lever for isolating a heavy ETL workload from BI users is\u2026",
          options: ["Separate compute (a dedicated cluster/SQL warehouse or virtual warehouse) over shared storage", "Copying the data to a second account", "Disabling caching", "Running everything on one large cluster"],
          answer: 0,
          explain: "Both separate storage from compute, so each workload can get its own compute against the same data. Copying data multiplies governance and cost."
        },
        {
          q: "A team is mostly SQL analysts with modest data science needs and wants minimal platform administration. What is the honest first step?",
          options: ["Pick whichever vendor\u2019s keynote was more impressive", "Assume one platform is always cheaper", "Run a proof of concept on their own representative workloads, measuring cost, performance and operational effort", "Choose based on a benchmark published by one vendor"],
          answer: 2,
          explain: "Both platforms serve SQL analytics and data engineering well, and pricing depends on workload shape. Measured results on your own queries and data beat marketing benchmarks and folklore."
        },
        {
          q: "Which capability pairing is accurate?",
          options: ["Unity Catalog \u2194 no lineage", "Unity Catalog governs Databricks assets; Snowflake governs objects with role-based access control and its own governance features", "Snowflake has no access control", "Neither supports column masking"],
          answer: 1,
          explain: "Unity Catalog provides grants, lineage, row filters and column masks for Databricks; Snowflake provides RBAC, masking and row access policies, and tagging. Both cover the core governance needs with different models."
        },
        {
          q: "Why should a comparison note product versions and dates?",
          options: ["Vendors never change features", "Benchmarks are always permanent", "Version numbers are required by law", "Both platforms ship features quickly, so yesterday\u2019s gap may already be closed"],
          answer: 3,
          explain: "Streaming, open-format support, serverless compute and governance features have converged rapidly. A dated comparison with sources stays honest; an undated one becomes folklore."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.databricks = {
    id: "databricks", name: "Databricks & Delta Lake", short: "DBX",
    tagline: "Open tables, one platform", color: "#f472b6",
    blurb: "Delta Lake from the transaction log up \u2014 ACID commits, schema enforcement and evolution, time travel, MERGE and change data feed, file layout and clustering \u2014 then the Databricks platform: compute, Unity Catalog, medallion design, jobs and pipelines, Structured Streaming and Auto Loader, and an honest comparison with Snowflake.",
    modules: [
      {
        id: "delta", name: "Delta Lake Internals", icon: "database",
        lessons: [
          {
            id: "transaction-log", title: "The Delta transaction log",
            summary: "Parquet files plus an ordered log of commits \u2014 the whole trick behind ACID on object storage.",
            minutes: 8, tags: ["delta", "transaction-log", "acid"],
            blocks: [
              { t: "p", html: "A <strong>Delta table</strong> is a directory of ordinary <strong>Parquet</strong> data files plus a " + tok("_delta_log/") + " directory. Each write appends one numbered commit file (" + tok("00000000000000000007.json") + ") listing <strong>actions</strong>: " + tok("add") + " a data file, " + tok("remove") + " a data file, change table <strong>metadata</strong> (schema, partitioning, properties) or <strong>protocol</strong> (the reader/writer features required)." },
              { t: "widget", id: "de-dbx-txlog" },
              { t: "p", html: "A reader reconstructs version <em>N</em> by replaying actions up to commit <em>N</em>. To avoid replaying thousands of small JSON files, Delta periodically writes a <strong>checkpoint</strong> \u2014 a Parquet snapshot of the table state \u2014 and readers start from the latest checkpoint plus the commits after it." },
              { t: "table", headers: ["Piece", "What it holds"], rows: [
                ["Data files (Parquet)", "The rows; never modified in place"],
                ["Commit JSON", "Ordered add/remove/metadata actions for one version"],
                ["Checkpoint Parquet", "Aggregated table state so readers skip old commits"],
                ["File statistics", "Per-file min/max/null counts used for data skipping"]
              ] },
              { t: "note", variant: "tip", html: "Because files are immutable, an UPDATE or DELETE rewrites the affected files (or, where enabled, records <strong>deletion vectors</strong> that mark rows as deleted without rewriting the file immediately) and commits add/remove actions. Nothing is edited in place." },
              { t: "note", variant: "trap", html: "Never delete or copy files inside a Delta table with storage tools. The log still references them, so readers fail or, worse, silently miss data. Use table operations (DELETE, VACUUM, CLONE) instead." },
              { t: "note", variant: "key", html: "<strong>The log is the table; the files are just storage.</strong> Atomicity comes from the fact that a version exists only once its commit file is written \u2014 a crashed writer leaves orphan Parquet files that no commit references, invisible to readers until VACUUM removes them. Every Delta feature in this track \u2014 time travel, MERGE, change feed, clustering \u2014 is a pattern of add and remove actions in that log." }
            ]
          },
          {
            id: "acid-concurrency", title: "ACID, isolation & concurrent writers",
            summary: "Optimistic concurrency: write files first, then race to commit the next version.",
            minutes: 7, tags: ["delta", "acid", "concurrency"],
            blocks: [
              { t: "p", html: "Delta uses <strong>optimistic concurrency control</strong>. A writer reads the current version, writes its new data files, then attempts to commit version <em>N+1</em> atomically. If another writer committed first, it checks whether the two transactions logically conflict; if not, it retries the commit at the next version, otherwise it fails with a concurrent-modification error." },
              { t: "table", headers: ["Writer A", "Writer B", "Typical outcome"], rows: [
                ["Blind append", "Blind append", "Both succeed"],
                ["Append", "DELETE/UPDATE on other partitions", "Usually both succeed when the files touched are disjoint"],
                ["UPDATE", "UPDATE of the same files", "One fails and must retry"],
                ["OPTIMIZE", "Append", "Both succeed; compaction does not conflict with new appends"]
              ] },
              { t: "p", html: "Isolation levels: <strong>WriteSerializable</strong> (the default) guarantees writes are serializable while allowing some read-side reordering; <strong>Serializable</strong> is stricter and conflicts more. Readers always see a consistent snapshot \u2014 a query pinned to version 12 never sees half of version 13." },
              { t: "note", variant: "tip", html: "Design concurrent pipelines so writers touch disjoint data \u2014 for example, MERGE conditions that include the partition or clustering column \u2014 so conflict checks can prove independence instead of failing." },
              { t: "note", variant: "trap", html: "Multi-table atomicity is not what a single Delta commit gives you: each table has its own log. A job that updates two tables must tolerate one succeeding and the other failing \u2014 make each write idempotent and re-runnable." },
              { t: "note", variant: "key", html: "<strong>Optimistic concurrency is cheap when collisions are rare and painful when they are designed in.</strong> Two streams that MERGE into the same hot partitions every minute will spend their time retrying. Partition the work, narrow the match condition, or funnel writes through one job \u2014 the log can only serialize what you let it tell apart." }
            ]
          },
          {
            id: "schema", title: "Schema enforcement, evolution & constraints",
            summary: "Reject bad writes by default, evolve deliberately, and push simple rules into the table.",
            minutes: 7, tags: ["delta", "schema", "constraints"],
            blocks: [
              { t: "p", html: "<strong>Schema enforcement</strong> rejects writes whose columns or types do not match the table, so a producer bug fails the job instead of corrupting the table. <strong>Schema evolution</strong> is opt-in: " + tok("mergeSchema") + " on a write adds new columns; MERGE can evolve the schema when automatic evolution is enabled." },
              { t: "code", lang: "python", code:
                "(df.write.format(\"delta\")\n" +
                "   .mode(\"append\")\n" +
                "   .option(\"mergeSchema\", \"true\")   # opt in: add new columns\n" +
                "   .saveAsTable(\"main.sales.orders\"))\n\n" +
                "spark.sql(\"\"\"\n" +
                "  ALTER TABLE main.sales.orders\n" +
                "  ADD CONSTRAINT positive_amount CHECK (amount >= 0)\n" +
                "\"\"\")" },
              { t: "ul", items: [
                "<strong>Additive changes</strong> (new nullable columns) are routine with evolution enabled.",
                "<strong>Renames and drops</strong> need <strong>column mapping</strong> enabled on the table, which upgrades the table protocol \u2014 older readers may no longer read it.",
                "<strong>Type changes</strong> beyond safe widening generally mean rewriting the table (overwrite with " + tok("overwriteSchema") + ").",
                "<strong>Constraints</strong>: " + tok("NOT NULL") + " and " + tok("CHECK") + " are enforced on every write; violating rows fail the transaction."
              ] },
              { t: "note", variant: "trap", html: "Turning on automatic schema evolution everywhere moves the schema decision from a reviewer to whatever the producer happened to send. Enable it where new columns are expected (bronze ingestion), keep enforcement strict on silver and gold." },
              { t: "note", variant: "key", html: "<strong>Enforcement is a gate, evolution is a key \u2014 decide who holds the key.</strong> The table can stop a malformed write; it cannot tell a meaningful new column from an accidental one. Pair schema rules with the contract checks from the orchestration track so evolution is reviewed, not merely permitted." }
            ]
          },
          {
            id: "time-travel", title: "Time travel, history, RESTORE & VACUUM",
            summary: "Query or restore older versions \u2014 for as long as their files survive retention.",
            minutes: 7, tags: ["delta", "time-travel", "vacuum"],
            blocks: [
              { t: "p", html: "Because old versions are just older sets of files in the log, Delta can query them: " + tok("SELECT * FROM t VERSION AS OF 42") + " or " + tok("TIMESTAMP AS OF '2024-06-01'") + ". " + tok("DESCRIBE HISTORY t") + " lists versions with operation, user and metrics, and " + tok("RESTORE TABLE t TO VERSION AS OF 42") + " commits a new version that matches the old one." },
              { t: "code", lang: "sql", code:
                "-- What changed in the bad deploy?\n" +
                "DESCRIBE HISTORY main.sales.orders LIMIT 5;\n\n" +
                "-- Compare row counts before and after\n" +
                "SELECT COUNT(*) FROM main.sales.orders VERSION AS OF 41;\n" +
                "SELECT COUNT(*) FROM main.sales.orders;\n\n" +
                "-- Roll back (creates a new version; history is preserved)\n" +
                "RESTORE TABLE main.sales.orders TO VERSION AS OF 41;" },
              { t: "p", html: "<strong>VACUUM</strong> deletes data files that are no longer referenced by recent versions and are older than the retention threshold \u2014 <strong>7 days by default</strong>. Log entries are retained separately (30 days by default), but a version whose files were vacuumed can no longer be read." },
              { t: "note", variant: "tip", html: "Time travel is a recovery and audit tool, not a backup strategy or an archive. For long-term point-in-time copies, use " + tok("DEEP CLONE") + " or a separate retention policy." },
              { t: "note", variant: "trap", html: "Lowering retention below the default to save storage can delete files that a long-running query, a lagging stream or a concurrent writer still needs. Delta guards against short retention for this reason." },
              { t: "note", variant: "key", html: "<strong>Your rollback window is the VACUUM retention, not the log retention.</strong> Teams discover this during an incident: history shows the good version, the restore fails because its files are gone. Set retention from your detection time \u2014 how long a bad write can go unnoticed \u2014 not from your storage bill." }
            ]
          },
          {
            id: "merge-cdc", title: "MERGE, CDC & change data feed",
            summary: "Upserts with one source row per key, SCD patterns, and reading row-level changes downstream.",
            minutes: 9, tags: ["delta", "merge", "cdc", "cdf"],
            blocks: [
              { t: "p", html: tok("MERGE INTO") + " is Delta\u2019s upsert: match source rows to target rows on a key, then update, delete or insert. It is the idempotent write behind most CDC and dimension pipelines." },
              { t: "code", lang: "sql", code:
                "MERGE INTO silver.customers t\n" +
                "USING (\n" +
                "  SELECT * FROM bronze.customer_changes\n" +
                "  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY seq DESC) = 1\n" +
                ") s\n" +
                "ON t.id = s.id\n" +
                "WHEN MATCHED AND s.op = 'D' THEN DELETE\n" +
                "WHEN MATCHED AND s.seq > t.seq THEN UPDATE SET *\n" +
                "WHEN NOT MATCHED AND s.op != 'D' THEN INSERT *;" },
              { t: "ul", items: [
                "<strong>One source row per key</strong> \u2014 MERGE fails if several source rows match one target row; deduplicate to the latest change first.",
                "<strong>Ordering guard</strong> \u2014 compare a sequence or LSN (" + tok("s.seq > t.seq") + ") so a replayed older change cannot overwrite newer data.",
                "<strong>Narrow the match</strong> \u2014 adding a partition or clustering predicate to the ON clause lets Delta read fewer files and reduces write conflicts.",
                "<strong>SCD Type 2</strong> \u2014 close the current row and insert a new version; typically done by merging a union of \u201crows to close\u201d and \u201crows to insert\u201d."
              ] },
              { t: "p", html: "<strong>Change data feed</strong> (enabled per table with " + tok("delta.enableChangeDataFeed = true") + ") records row-level inserts, updates (pre- and post-image) and deletes per version. Downstream jobs read only what changed with " + tok("table_changes('silver.customers', 120)") + " or a streaming read with " + tok("readChangeFeed") + ", instead of diffing whole tables." },
              { t: "note", variant: "tip", html: "The general idempotency rules \u2014 name the unit a rerun may replace \u2014 are in <a class='inline' href='#/storage/ingestion/incremental-idempotent'>Incremental loads &amp; idempotency</a>; CDC failure modes in production are in <a class='inline' href='#/dataops/reliability/cdc-failures'>CDC failure modes</a>." },
              { t: "note", variant: "key", html: "<strong>A correct MERGE is three decisions, not one statement:</strong> the key that identifies a row, the ordering that says which change is newest, and the predicate that bounds which files can match. Get the first wrong and it fails; get the second wrong and replays corrupt data quietly; get the third wrong and it is correct but rewrites half the table every run." },
              { t: "quiz", id: "de-databricks-delta" }
            ]
          },
          {
            id: "maintenance", title: "File layout: OPTIMIZE, Z-ordering & liquid clustering",
            summary: "Compact small files and co-locate values so data skipping can do its job.",
            minutes: 8, tags: ["delta", "optimize", "clustering", "data-skipping"],
            blocks: [
              { t: "p", html: "Delta records min/max statistics per file (by default for the first 32 columns of the schema) and skips files whose range cannot match a filter. How much it skips depends entirely on <strong>layout</strong> \u2014 whether the values you filter on are concentrated in few files." },
              { t: "widget", id: "de-dbx-skipping" },
              { t: "table", headers: ["Technique", "What it does", "Watch out for"], rows: [
                ["Partitioning", "Separate directories per value of a low-cardinality column", "Tiny files with high-cardinality or small tables; fixed once chosen"],
                [tok("OPTIMIZE"), "Compacts small files into larger ones as a new version", "Old files remain until VACUUM"],
                [tok("ZORDER BY"), "Co-locates related values across several columns during OPTIMIZE", "Rewrites the data each time it runs on the same files"],
                ["Liquid clustering (" + tok("CLUSTER BY") + ")", "Incremental clustering whose keys can be changed later", "Feature availability and defaults depend on runtime version"]
              ] },
              { t: "p", html: "For new tables, current Databricks guidance generally favours <strong>liquid clustering</strong> over partitioning plus Z-ordering, and managed features such as <strong>predictive optimization</strong> can schedule OPTIMIZE and VACUUM for Unity Catalog managed tables where enabled. Treat the exact defaults as version-specific and check the documentation for your runtime." },
              { t: "note", variant: "tip", html: "Choose clustering columns from the filters people actually write \u2014 usually a date plus one or two selective identifiers. Put frequently filtered columns early in the schema so they have statistics." },
              { t: "note", variant: "trap", html: "Partitioning a modest table (say, under a terabyte) by date and customer is the classic Delta mistake: thousands of tiny files per day, slow listing, and nothing to gain over clustering." },
              { t: "note", variant: "key", html: "<strong>Layout is a bet on the query pattern, and clustering lets you change the bet.</strong> Partition columns are frozen into directory paths; liquid clustering keys can be redefined as access patterns change. Either way, data skipping is only as good as the correlation between your filters and your file boundaries." },
              { t: "quiz", id: "de-databricks-layout" }
            ]
          }
        ]
      },
      {
        id: "platform", name: "The Databricks Platform", icon: "cube",
        lessons: [
          {
            id: "lakehouse-platform", title: "Workspaces, compute & SQL warehouses",
            summary: "Control plane, compute plane, and choosing the right kind of compute for each workload.",
            minutes: 7, tags: ["databricks", "compute", "photon"],
            blocks: [
              { t: "p", html: "Databricks splits into a <strong>control plane</strong> (the web app, job scheduler, notebooks and metadata services run by Databricks) and a <strong>compute plane</strong> where your clusters process data \u2014 either in your cloud account (classic compute) or in Databricks-managed infrastructure (serverless). Data stays in cloud object storage." },
              { t: "table", headers: ["Compute", "Use it for", "Notes"], rows: [
                ["All-purpose cluster", "Interactive notebooks and exploration", "Shared, long-lived; easy to leave running"],
                ["Job compute", "Scheduled production jobs", "Created for the run, terminated afterwards"],
                ["SQL warehouse", "SQL analytics, BI tools, dbt", "Sized in T-shirt sizes; can autoscale and auto-stop"],
                ["Serverless", "Jobs, notebooks, SQL without managing clusters", "Fast start; availability varies by cloud and region"]
              ] },
              { t: "p", html: "<strong>Photon</strong> is Databricks\u2019 vectorized native execution engine for Spark SQL and DataFrame workloads; it accelerates many scan, join and aggregation-heavy queries without code changes, while some operations still fall back to the standard engine." },
              { t: "note", variant: "tip", html: "Cost hygiene mirrors any elastic warehouse: auto-terminate interactive clusters, use job compute for schedules, tag compute for chargeback, and right-size SQL warehouses per workload. The FinOps patterns are in <a class='inline' href='#/dataops/cost/cost'>Cost optimization</a>." },
              { t: "note", variant: "key", html: "<strong>Most Databricks cost surprises are compute that outlived its purpose.</strong> An all-purpose cluster left running over a weekend, a production job pinned to a shared cluster, a SQL warehouse that never auto-stops. Match compute lifetime to workload lifetime before tuning anything else." }
            ]
          },
          {
            id: "unity-catalog", title: "Unity Catalog: governance & lineage",
            summary: "One metastore, a three-level namespace, grants, lineage and fine-grained access.",
            minutes: 8, tags: ["unity-catalog", "governance", "lineage"],
            blocks: [
              { t: "p", html: "<strong>Unity Catalog</strong> is Databricks\u2019 governance layer. A <strong>metastore</strong> (typically one per region) holds <strong>catalogs</strong>, which hold <strong>schemas</strong>, which hold tables, views, volumes (governed file storage), functions and models. Objects are addressed as " + tok("catalog.schema.table") + "." },
              { t: "code", lang: "sql", code:
                "GRANT USE CATALOG ON CATALOG main TO `analysts`;\n" +
                "GRANT USE SCHEMA, SELECT ON SCHEMA main.sales TO `analysts`;\n\n" +
                "-- Column mask: only the privacy group sees raw email\n" +
                "CREATE FUNCTION main.sec.mask_email(email STRING)\n" +
                "  RETURN CASE WHEN is_account_group_member('privacy') THEN email\n" +
                "              ELSE regexp_replace(email, '^.*@', '***@') END;\n" +
                "ALTER TABLE main.sales.customers\n" +
                "  ALTER COLUMN email SET MASK main.sec.mask_email;" },
              { t: "ul", items: [
                "<strong>Managed vs external tables</strong> \u2014 managed tables live in storage Unity Catalog controls (DROP removes data); external tables register files at a path you control via an <strong>external location</strong> backed by a <strong>storage credential</strong>.",
                "<strong>Privileges</strong> are inherited down the hierarchy; a user needs " + tok("USE CATALOG") + " and " + tok("USE SCHEMA") + " plus the object privilege.",
                "<strong>Row filters and column masks</strong> are SQL functions attached to tables, evaluated per query.",
                "<strong>Lineage</strong> is captured automatically at table and column level for queries run on Unity Catalog-enabled compute, plus audit logs of access."
              ] },
              { t: "note", variant: "tip", html: "Map catalogs to environments or domains (" + tok("dev") + ", " + tok("prod") + ", or " + tok("finance") + ", " + tok("marketing") + ") and grant to groups, never to individuals. Governance concepts that apply to any platform are in <a class='inline' href='#/dataops/governance/governance'>Governance, PII &amp; access control</a>." },
              { t: "note", variant: "key", html: "<strong>A catalog is only governance if access goes through it.</strong> Paths reachable with direct cloud credentials bypass every grant, mask and lineage record. The real work of adopting Unity Catalog is closing those side doors \u2014 external locations instead of instance-profile access, and managed tables wherever you can." }
            ]
          },
          {
            id: "medallion", title: "Medallion architecture: bronze, silver, gold",
            summary: "A layering convention for replayable, progressively trusted data \u2014 and where it goes wrong.",
            minutes: 7, tags: ["medallion", "lakehouse", "design"],
            blocks: [
              { t: "p", html: "The <strong>medallion</strong> pattern organizes lakehouse tables by trust. It is a convention, not a feature, and it maps closely to the raw/staging/marts layers you met in dbt." },
              { t: "table", headers: ["Layer", "Contents", "Typical write"], rows: [
                ["Bronze", "Raw records as landed, plus ingest metadata (file, offset, load time)", "Append-only; schema evolution allowed"],
                ["Silver", "Cleaned, deduplicated, typed, conformed entities at a stable grain", "MERGE by key; strict schema"],
                ["Gold", "Business aggregates, dimensional models, data products", "Overwrite by partition or MERGE; contracts and SLOs"]
              ] },
              { t: "note", variant: "tip", html: "Keep bronze replayable: if silver logic is wrong, you rebuild silver from bronze rather than re-extracting from source systems. That is the same right-to-change-your-mind argument as <a class='inline' href='#/batch/elt/etl-vs-elt'>ETL vs ELT</a>." },
              { t: "note", variant: "trap", html: "Three copies of every table is not a goal. Skip a layer when it adds nothing (a clean source can go straight to silver), and avoid \u201cplatinum\u201d sprawl. Each layer should have an owner and a reason." },
              { t: "note", variant: "key", html: "<strong>The layers are promises, not folders.</strong> Bronze promises completeness and replay, silver promises one trustworthy row per entity, gold promises a business meaning with an owner. Name the promise, attach the tests that prove it, and the medallion becomes a contract system rather than a naming scheme." }
            ]
          },
          {
            id: "jobs-pipelines", title: "Jobs, declarative pipelines & deployment",
            summary: "Multi-task jobs, declarative pipelines with expectations, and bundles for CI/CD.",
            minutes: 8, tags: ["jobs", "workflows", "pipelines", "ci-cd"],
            blocks: [
              { t: "p", html: "<strong>Databricks Jobs</strong> (Workflows) orchestrate multi-task DAGs \u2014 notebooks, Python wheels, SQL, dbt, pipelines \u2014 with dependencies, retries, timeouts, parameters, schedules, file-arrival or table-update triggers, and notifications. Tasks can pass small values to downstream tasks." },
              { t: "p", html: "<strong>Declarative pipelines</strong> (Lakeflow Declarative Pipelines, formerly Delta Live Tables) let you define tables and streaming tables as queries; the engine works out dependencies, runs them incrementally, and manages retries. <strong>Expectations</strong> attach quality rules that warn, drop failing rows or fail the update." },
              { t: "code", lang: "python", code:
                "import dlt\n\n" +
                "@dlt.table(comment=\"Cleaned orders\")\n" +
                "@dlt.expect_or_drop(\"valid_amount\", \"amount >= 0\")\n" +
                "@dlt.expect(\"has_customer\", \"customer_id IS NOT NULL\")\n" +
                "def silver_orders():\n" +
                "    return dlt.read_stream(\"bronze_orders\").dropDuplicates([\"order_id\"])" },
              { t: "p", html: "<strong>Databricks Asset Bundles</strong> describe jobs, pipelines and their configuration as YAML in your repository, so the same definitions deploy to dev, staging and prod through CI with environment-specific targets \u2014 no hand-edited jobs in the UI." },
              { t: "note", variant: "tip", html: "General orchestration principles \u2014 idempotent tasks, logical dates, sensors versus triggers, SLAs on outputs \u2014 are platform-independent and covered in the <a class='inline' href='#/orchestration/orchestration/dags'>orchestration track</a>." },
              { t: "note", variant: "key", html: "<strong>Put the job definition in version control or it will drift.</strong> A production job edited in the UI at 2am has no review, no diff and no way to recreate it in another workspace. Bundles (or Terraform) turn jobs into code, and parameters keep environment-specific values out of that code." },
              { t: "quiz", id: "de-databricks-platform" }
            ]
          }
        ]
      },
      {
        id: "streaming", name: "Structured Streaming & Ingestion", icon: "queue",
        lessons: [
          {
            id: "structured-streaming", title: "Structured Streaming fundamentals",
            summary: "A stream as an unbounded table, processed in micro-batches with checkpointed progress.",
            minutes: 8, tags: ["structured-streaming", "spark", "watermarks"],
            blocks: [
              { t: "p", html: "<strong>Structured Streaming</strong> treats a stream as an <strong>unbounded table</strong>: you write the same DataFrame query you would for batch, and the engine runs it incrementally, by default as a series of <strong>micro-batches</strong>. Progress \u2014 source offsets, committed batches and operator state \u2014 lives in the <strong>checkpoint location</strong>." },
              { t: "code", lang: "python", code:
                "events = (spark.readStream.format(\"kafka\")\n" +
                "  .option(\"subscribe\", \"orders\").load()\n" +
                "  .selectExpr(\"CAST(value AS STRING) AS json\", \"timestamp\"))\n\n" +
                "counts = (events\n" +
                "  .withWatermark(\"timestamp\", \"10 minutes\")\n" +
                "  .groupBy(window(\"timestamp\", \"5 minutes\")).count())\n\n" +
                "(counts.writeStream\n" +
                "  .outputMode(\"append\")\n" +
                "  .option(\"checkpointLocation\", \"/chk/order_counts\")\n" +
                "  .trigger(processingTime=\"1 minute\")\n" +
                "  .toTable(\"gold.order_counts_5m\"))" },
              { t: "table", headers: ["Setting", "Options", "Meaning"], rows: [
                ["Output mode", "append / update / complete", "Emit new rows only, changed rows, or the whole result each batch"],
                ["Trigger", "processingTime / availableNow / once (deprecated)", "How often batches run, or process the backlog and stop"],
                ["Watermark", "withWatermark(col, delay)", "How late data may arrive before state for old windows is dropped"]
              ] },
              { t: "note", variant: "tip", html: "Event time, watermarks and windows are explained engine-independently in the <a class='inline' href='#/streaming/processing/time-watermarks'>streaming track</a>; this lesson is the Spark API for them." },
              { t: "note", variant: "trap", html: "The checkpoint belongs to exactly one query. Changing the query in incompatible ways (different aggregation keys, different stateful operators) or pointing two queries at one checkpoint breaks recovery; plan state-changing deploys as a new checkpoint plus a controlled backfill." },
              { t: "note", variant: "key", html: "<strong>The checkpoint is the stream\u2019s memory \u2014 treat it like data, not like a temp directory.</strong> Delete it and the query either reprocesses everything or skips everything, depending on its starting-offset settings. Back it up with the table it feeds, and version it alongside the code that wrote it." }
            ]
          },
          {
            id: "streaming-delta", title: "Streaming with Delta, Auto Loader & exactly-once",
            summary: "Incremental file ingestion, Delta as source and sink, and idempotent foreachBatch upserts.",
            minutes: 9, tags: ["auto-loader", "delta", "exactly-once", "foreachBatch"],
            blocks: [
              { t: "p", html: "<strong>Auto Loader</strong> (the " + tok("cloudFiles") + " source) incrementally discovers new files in cloud storage, records which it has ingested in the checkpoint, and can infer and evolve the schema \u2014 unexpected fields land in a <strong>rescued data</strong> column instead of failing the stream or being dropped." },
              { t: "code", lang: "python", code:
                "bronze = (spark.readStream.format(\"cloudFiles\")\n" +
                "  .option(\"cloudFiles.format\", \"json\")\n" +
                "  .option(\"cloudFiles.schemaLocation\", \"/chk/orders_schema\")\n" +
                "  .load(\"/landing/orders/\"))\n\n" +
                "def upsert(batch_df, batch_id):\n" +
                "    latest = batch_df.dropDuplicates([\"order_id\"])  # one row per key\n" +
                "    (DeltaTable.forName(spark, \"silver.orders\").alias(\"t\")\n" +
                "       .merge(latest.alias(\"s\"), \"t.order_id = s.order_id\")\n" +
                "       .whenMatchedUpdateAll().whenNotMatchedInsertAll().execute())\n\n" +
                "(bronze.writeStream.foreachBatch(upsert)\n" +
                "  .option(\"checkpointLocation\", \"/chk/orders_silver\")\n" +
                "  .trigger(availableNow=True).start())" },
              { t: "p", html: "<strong>Exactly-once</strong> into Delta comes from three parts working together: a replayable source, offsets recorded in the checkpoint before and after each batch, and a sink that commits each batch atomically and recognizes a batch it has already committed. The built-in Delta sink does this for you." },
              { t: "note", variant: "trap", html: "A " + tok("foreachBatch") + " function may run again for the same batch after a failure. Make it idempotent \u2014 MERGE on a key, or use Delta\u2019s " + tok("txnAppId") + "/" + tok("txnVersion") + " write options with the batch id \u2014 otherwise a retry appends duplicates." },
              { t: "note", variant: "tip", html: "A Delta table can also be a streaming <em>source</em>: downstream queries read new commits incrementally. Appends stream naturally; updates and deletes upstream need the change data feed or explicit options, because a plain Delta stream source expects append-only input." },
              { t: "note", variant: "tip", html: "Kafka-level delivery semantics, transactions and exactly-once across systems are covered in depth in the <a class='inline' href='#/streaming/fundamentals/delivery-semantics'>streaming track</a>. The Pulse atlas (streaming systems) in this collection goes further into Kafka internals, Flink and production operations." },
              { t: "note", variant: "key", html: "<strong>Exactly-once is a property of the whole pipeline, and foreachBatch is where it most often breaks.</strong> The engine guarantees each batch is processed to commit; it cannot make your custom write idempotent. If you wrote the sink, you own the guarantee." },
              { t: "quiz", id: "de-databricks-streaming" }
            ]
          }
        ]
      },
      {
        id: "compare", name: "Choosing & Comparing", icon: "compass",
        lessons: [
          {
            id: "vs-snowflake", title: "Databricks vs Snowflake: an honest comparison",
            summary: "Where the architectures differ, where they have converged, and how to decide with evidence.",
            minutes: 9, tags: ["databricks", "snowflake", "architecture", "comparison"],
            blocks: [
              { t: "p", html: "Both platforms separate storage from compute, run SQL at scale, govern data centrally and increasingly do each other\u2019s jobs. The differences that remain are about defaults and centre of gravity rather than capability checkboxes \u2014 and they shift with every release, so date any comparison you write." },
              { t: "table", headers: ["Dimension", "Databricks", "Snowflake"], rows: [
                ["Storage", "Delta (Parquet + log) in your object storage; also reads/writes Iceberg", "Snowflake-managed micro-partitions; also supports Apache Iceberg tables"],
                ["Compute", "Clusters, job compute, SQL warehouses, serverless", "Virtual warehouses (single or multi-cluster), serverless features"],
                ["Languages", "SQL, Python, Scala, R on Spark; notebooks first-class", "SQL first; Python/Java/Scala via Snowpark"],
                ["Streaming", "Structured Streaming, declarative pipelines", "Snowpipe / Snowpipe Streaming, dynamic tables, streams and tasks"],
                ["Governance", "Unity Catalog: grants, lineage, row filters, column masks", "RBAC, masking and row access policies, tags, lineage features"],
                ["Operations", "More knobs (cluster types, runtimes); more control", "Fewer knobs; more managed by default"]
              ] },
              { t: "p", html: "<strong>Where each tends to fit.</strong> Teams with heavy Spark, Python and ML workloads, or a strong preference for open files they control, often lean Databricks. Teams that are SQL-centric and want minimal platform administration often lean Snowflake. Many organizations run both, sharing data through open table formats." },
              { t: "ol", items: [
                "<strong>List workloads</strong> \u2014 BI concurrency, ELT volume, streaming latency, ML, data sharing.",
                "<strong>Run a proof of concept</strong> on representative data and queries, measuring cost per workload, latency and engineering effort.",
                "<strong>Check governance fit</strong> \u2014 identity integration, masking, lineage, audit.",
                "<strong>Count the operating cost</strong> \u2014 people and process, not only credits or DBUs."
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper on Snowflake.</strong> The Glacier atlas (Snowflake) in this collection covers the other side of this table in depth \u2014 virtual warehouses in <em>Warehouses &amp; Query Performance \u203a Virtual Warehouses</em>, micro-partitions and pruning in <em>Architecture &amp; Storage</em>, and credits and resource monitors in <em>Cost &amp; FinOps</em>." },
              { t: "note", variant: "trap", html: "Vendor benchmarks measure the workload the vendor chose. Treat them as marketing, and be equally suspicious of anyone \u2014 including yourself \u2014 who says one platform is \u201calways cheaper\u201d." },
              { t: "note", variant: "key", html: "<strong>The decision is rarely about features; it is about which defaults match your team.</strong> Either platform can run your workload. Choose the one whose default way of working \u2014 notebooks and files, or SQL and managed objects \u2014 your people will actually follow, and prove the cost on your own queries." },
              { t: "quiz", id: "de-databricks-compare" }
            ]
          }
        ]
      }
    ]
  };
})();
