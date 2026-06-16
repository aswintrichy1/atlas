/* =====================================================================
   CASCADE · Storage & File Formats track  (curriculum + quizzes + widgets)
   Self-contained: registers window.TRACKS.storage, merges its quizzes
   into window.QUIZZES and its widgets into window.Widgets.
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var h = WK.h, shell = WK.shell;

  /* ---------- small local helpers (widgets) ---------- */
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

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — Row vs columnar scan */
  window.Widgets["de-store-columnar"] = function (mount) {
    shell(mount, "visualizer", "Row vs Columnar Scan",
      "Pick a query and a physical layout, then watch how many bytes each must read off disk.");
    var cols = [
      { key: "id", label: "id", size: 4 },
      { key: "name", label: "name", size: 12 },
      { key: "country", label: "country", size: 8 },
      { key: "amount", label: "amount", size: 8 }
    ];
    var rows = [
      { id: 1, name: "Ava", country: "US", amount: 120 },
      { id: 2, name: "Bo", country: "EU", amount: 80 },
      { id: 3, name: "Cy", country: "EU", amount: 200 },
      { id: 4, name: "Di", country: "IN", amount: 45 },
      { id: 5, name: "Ed", country: "US", amount: 95 },
      { id: 6, name: "Fy", country: "JP", amount: 60 }
    ];
    var rowSize = cols.reduce(function (a, c) { return a + c.size; }, 0);
    var total = rowSize * rows.length;
    var query = "all", layout = "columnar";
    function need() {
      if (query === "country") return ["country"];
      if (query === "amount") return ["amount"];
      return ["id", "name", "country", "amount"];
    }
    var board = h("div", { class: "grid-board", style: "grid-template-columns:repeat(4,minmax(46px,1fr));gap:4px" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      board.innerHTML = "";
      var nd = need();
      cols.forEach(function (c) {
        var on = nd.indexOf(c.key) !== -1;
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;font-family:var(--font-mono);font-size:.66rem;color:" + (on ? "var(--accent)" : "var(--text-faint)") }, c.label));
      });
      rows.forEach(function (r) {
        cols.forEach(function (c) {
          var read = layout === "row" ? true : nd.indexOf(c.key) !== -1;
          board.appendChild(h("div", { class: "grid-cell" + (read ? " dp-fill" : ""), style: "width:auto;font-size:.78rem" + (read ? "" : ";opacity:.3") }, String(r[c.key])));
        });
      });
      var bytes = layout === "row" ? total : nd.reduce(function (a, k) {
        var c = cols.filter(function (x) { return x.key === k; })[0];
        return a + c.size * rows.length;
      }, 0);
      readout.innerHTML = "";
      readout.appendChild(ro("layout", layout));
      readout.appendChild(ro("bytes scanned", bytes + " / " + total, true));
      readout.appendChild(ro("file read", Math.round((bytes / total) * 100) + "%"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "all", label: "SELECT *" }, { v: "country", label: "SELECT country" }, { v: "amount", label: "SELECT SUM(amount)" }],
        function () { return query; }, function (v) { query = v; paint(); }),
      seg([{ v: "columnar", label: "Columnar" }, { v: "row", label: "Row store" }],
        function () { return layout; }, function (v) { layout = v; paint(); })
    ));
    mount.appendChild(h("div", { class: "w-stage" }, board));
    mount.appendChild(readout);
    paint();
  };

  /* 2 — Parquet pruning */
  window.Widgets["de-store-parquet"] = function (mount) {
    shell(mount, "lab", "Parquet Pruning Lab",
      "Project columns and push a filter down. Row groups whose min/max can\u2019t match are skipped entirely.");
    var columns = ["id", "name", "amount", "ts"];
    var groups = [
      { rg: "RG0", min: 10, max: 50 },
      { rg: "RG1", min: 60, max: 120 },
      { rg: "RG2", min: 5, max: 30 },
      { rg: "RG3", min: 100, max: 200 }
    ];
    var projected = { id: true, name: false, amount: true, ts: false };
    var thresh = 80; // amount > thresh
    var board = h("div", { class: "grid-board", style: "grid-template-columns:repeat(5,minmax(52px,1fr));gap:4px" });
    var readout = h("div", { class: "w-readout" });
    function readCols() {
      var r = columns.filter(function (c) { return projected[c]; });
      if (r.indexOf("amount") === -1) r.push("amount"); // filter needs it
      return r;
    }
    function paint() {
      board.innerHTML = "";
      board.appendChild(h("div", { class: "grid-cell", style: "width:auto;font-size:.62rem;color:var(--text-faint)" }, "row group"));
      columns.forEach(function (c) {
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;font-family:var(--font-mono);font-size:.64rem;color:" + (readCols().indexOf(c) !== -1 ? "var(--accent)" : "var(--text-faint)") }, c));
      });
      var scanned = 0, chunks = 0, rc = readCols();
      groups.forEach(function (g) {
        var pruned = g.max <= thresh; // no row can satisfy amount > thresh
        if (!pruned) scanned++;
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;font-family:var(--font-mono);font-size:.64rem" + (pruned ? ";opacity:.3" : ";color:var(--accent)") }, g.rg + " [" + g.min + "," + g.max + "]"));
        columns.forEach(function (c) {
          var read = !pruned && rc.indexOf(c) !== -1;
          if (read) chunks++;
          board.appendChild(h("div", { class: "grid-cell" + (read ? " dp-fill" : ""), style: "width:auto;font-size:.7rem" + (read ? "" : ";opacity:.28") }, read ? "read" : (pruned ? "skip" : "\u2014")));
        });
      });
      readout.innerHTML = "";
      readout.appendChild(ro("filter", "amount > " + thresh));
      readout.appendChild(ro("row groups scanned", scanned + " / 4", true));
      readout.appendChild(ro("column chunks read", String(chunks)));
    }
    var colCtl = h("div", { class: "w-seg" });
    columns.forEach(function (c) {
      var b = h("button", { class: projected[c] ? "active" : "" }, c);
      b.addEventListener("click", function () { projected[c] = !projected[c]; b.classList.toggle("active"); paint(); });
      colCtl.appendChild(b);
    });
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.66rem;color:var(--text-faint)" }, "project:"), colCtl,
      h("button", { class: "w-btn ghost", onclick: function () { thresh = Math.max(0, thresh - 30); paint(); } }, "filter \u2212"),
      h("button", { class: "w-btn ghost", onclick: function () { thresh = Math.min(220, thresh + 30); paint(); } }, "filter +")
    ));
    mount.appendChild(h("div", { class: "w-stage" }, board));
    mount.appendChild(readout);
    paint();
  };

  /* 3 — Time travel over snapshots */
  window.Widgets["de-store-timetravel"] = function (mount) {
    shell(mount, "explorer", "Table Time-Travel",
      "Each write creates an immutable snapshot pointing at data files. Step back through history.");
    var snaps = [
      { v: "v0", op: "INSERT A,B,C", rows: ["A", "B", "C"], files: ["f1"] },
      { v: "v1", op: "UPDATE B \u2192 B\u2032", rows: ["A", "B\u2032", "C"], files: ["f1", "f2"] },
      { v: "v2", op: "DELETE C", rows: ["A", "B\u2032"], files: ["f1", "f2"] },
      { v: "v3", op: "INSERT D,E", rows: ["A", "B\u2032", "D", "E"], files: ["f1", "f2", "f3"] }
    ];
    var cur = 3;
    var list = h("div", { class: "mstack-wrap" });
    var stage = h("div", { class: "w-stage" });
    function paint() {
      list.innerHTML = "";
      var col = h("div", { class: "mstack", style: "min-height:auto" });
      col.appendChild(h("div", { class: "mstack-lbl" }, "snapshots"));
      snaps.forEach(function (s, i) {
        var c = h("div", { class: "mstack-cell", style: i === cur ? "border-color:var(--accent);background:color-mix(in srgb,var(--accent) 22%,var(--surface-solid));color:var(--accent)" : "" }, s.v);
        c.addEventListener("click", function () { cur = i; paint(); });
        col.appendChild(c);
      });
      list.appendChild(col);
      var s = snaps[cur];
      var rowsBoard = h("div", { class: "grid-board", style: "grid-template-columns:repeat(" + Math.max(1, s.rows.length) + ",46px);gap:4px" });
      s.rows.forEach(function (r) { rowsBoard.appendChild(h("div", { class: "grid-cell dp-fill", style: "width:auto" }, r)); });
      stage.innerHTML = "";
      stage.appendChild(h("div", { class: "w-readout" }, ro("at " + s.v, s.op, true)));
      stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.66rem;color:var(--text-faint);margin:10px 0 4px" }, "table state"));
      stage.appendChild(rowsBoard);
      stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.66rem;color:var(--text-faint);margin:12px 0 4px" }, "data files referenced"));
      var fb = h("div", { class: "w-seg" });
      s.files.forEach(function (f) { fb.appendChild(h("button", { class: "active" }, f)); });
      ["f1", "f2", "f3"].filter(function (f) { return s.files.indexOf(f) === -1; }).forEach(function (f) {
        fb.appendChild(h("button", { style: "opacity:.3" }, f));
      });
      stage.appendChild(fb);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn", onclick: function () { cur = Math.max(0, cur - 1); paint(); } }, "\u2190 older"),
      h("button", { class: "w-btn", onclick: function () { cur = Math.min(snaps.length - 1, cur + 1); paint(); } }, "newer \u2192")
    ));
    mount.appendChild(list);
    mount.appendChild(stage);
    paint();
  };

  /* 4 — Partition pruning */
  window.Widgets["de-store-partition"] = function (mount) {
    shell(mount, "lab", "Partition Pruning Lab",
      "A table partitioned by (dt, region). A matching WHERE clause lets the engine skip whole partitions.");
    var dts = ["01-01", "01-02", "01-03", "01-04"];
    var regions = ["US", "EU", "APAC"];
    var pred = "all";
    var board = h("div", { class: "grid-board", style: "grid-template-columns:repeat(4,minmax(54px,1fr));gap:5px" });
    var readout = h("div", { class: "w-readout" });
    function scanned(dt, rg) {
      if (pred === "all") return true;
      if (pred === "eu") return rg === "EU";
      if (pred === "d2") return dt === "01-02";
      if (pred === "both") return rg === "EU" && dt === "01-02";
      return true;
    }
    function paint() {
      board.innerHTML = "";
      dts.forEach(function (dt) {
        regions.forEach(function (rg) {
          var on = scanned(dt, rg);
          board.appendChild(h("div", { class: "grid-cell" + (on ? " dp-cur" : ""), style: "width:auto;height:auto;padding:8px 4px;font-family:var(--font-mono);font-size:.6rem" + (on ? "" : ";opacity:.28") },
            h("div", {}, dt), h("div", { style: "color:var(--text-dim)" }, rg)));
        });
      });
      var n = 0;
      dts.forEach(function (dt) { regions.forEach(function (rg) { if (scanned(dt, rg)) n++; }); });
      readout.innerHTML = "";
      readout.appendChild(ro("partitions scanned", n + " / 12", true));
      readout.appendChild(ro("data skipped", Math.round((1 - n / 12) * 100) + "%"));
      readout.appendChild(ro("approx read", (n * 80) + " MB"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([
        { v: "all", label: "(no filter)" },
        { v: "eu", label: "region = 'EU'" },
        { v: "d2", label: "dt = '01-02'" },
        { v: "both", label: "EU AND 01-02" }
      ], function () { return pred; }, function (v) { pred = v; paint(); })
    ));
    mount.appendChild(h("div", { class: "w-stage" }, board));
    mount.appendChild(readout);
    paint();
  };

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-storage-foundations": {
      title: "Foundations checkpoint",
      sub: "Workloads, columnar storage and data gravity.",
      questions: [
        {
          q: "Which workload profile is a columnar format like Parquet optimized for?",
          options: ["Many tiny point lookups and updates by primary key", "Large scans that read a few columns over many rows", "Low-latency single-row inserts", "Enforcing foreign-key constraints"],
          answer: 1,
          explain: "Columnar layouts store each column together, so analytical scans read only the needed columns and compress them well \u2014 ideal for OLAP, not for OLTP point access."
        },
        {
          q: "\u201cData gravity\u201d argues that you should usually\u2026",
          options: ["Copy all data to your laptop first", "Move compute to where the data already lives", "Always replicate data across every region", "Avoid object storage"],
          answer: 1,
          explain: "Large datasets are expensive and slow to move (and egress costs money), so it is cheaper to run compute next to the data than to ship the data to the compute."
        },
        {
          q: "For an analytical query, the dominant cost is most often\u2026",
          options: ["The number of columns in the table", "The volume of data scanned off storage", "The length of the SQL text", "The number of joins written"],
          answer: 1,
          explain: "Scan size drives I/O and therefore time and cost; pruning columns and partitions to scan less data is the highest-leverage optimization in analytics."
        }
      ]
    },
    "de-storage-formats": {
      title: "File formats checkpoint",
      sub: "Parquet, Avro, ORC and compression.",
      questions: [
        {
          q: "What lets Parquet skip an entire row group without reading it?",
          options: ["Its filename", "Per-row-group min/max statistics in the metadata", "The number of columns", "A gzip header"],
          answer: 1,
          explain: "Parquet stores min/max (and null counts) per row group; if a predicate cannot be satisfied by that range, the whole row group is pruned \u2014 predicate pushdown."
        },
        {
          q: "Which format is row-oriented and a natural fit for streaming/serialization with schema evolution?",
          options: ["Parquet", "ORC", "Avro", "CSV"],
          answer: 2,
          explain: "Avro is a compact row-based format with a self-describing schema and strong schema-evolution rules, which is why it is common for Kafka messages and record serialization."
        },
        {
          q: "A gzip-compressed CSV is awkward for distributed processing mainly because it is\u2026",
          options: ["Too small", "Not splittable, so one worker must read the whole file", "Encrypted", "Columnar"],
          answer: 1,
          explain: "Gzip is not splittable, so an engine cannot assign different byte ranges to different workers \u2014 you lose parallelism. Splittable codecs (or Parquet row groups) avoid this."
        },
        {
          q: "Snappy is usually preferred over Gzip inside Parquet because it offers\u2026",
          options: ["A higher compression ratio at any cost", "Much faster compress/decompress at a modest ratio", "Encryption", "Row-level indexes"],
          answer: 1,
          explain: "Snappy trades a little ratio for speed, which keeps CPU from bottlenecking scans; Zstd is a popular middle ground when you want a better ratio without Gzip\u2019s slowness."
        }
      ]
    },
    "de-storage-lakehouse": {
      title: "Lakehouse checkpoint",
      sub: "Warehouses, lakes, table formats and partitioning.",
      questions: [
        {
          q: "What do open table formats (Iceberg, Delta, Hudi) add on top of files in a data lake?",
          options: ["Nothing \u2014 they are just folders", "ACID transactions, snapshots/time-travel and schema evolution", "A new file format that replaces Parquet", "Mandatory row-level locking"],
          answer: 1,
          explain: "They add a metadata layer over Parquet/ORC files that tracks snapshots, giving ACID commits, time-travel, safe schema evolution and hidden partitioning \u2014 the \u201clakehouse.\u201d"
        },
        {
          q: "Which shard/partition key choice most invites a 'hot partition'?",
          options: ["High-cardinality hash of user_id", "Today\u2019s date for an append-only event table", "A composite (region, day) key", "A random UUID"],
          answer: 1,
          explain: "Partitioning by current date sends all of today\u2019s writes (and 'recent' reads) to one partition, creating a hotspot; spread load with a higher-cardinality or composite key."
        },
        {
          q: "The 'small files problem' hurts because\u2026",
          options: ["Small files cannot be compressed", "Per-file overhead and metadata dominate, killing scan throughput", "Engines refuse to read files under 1 KB", "It violates ACID"],
          answer: 1,
          explain: "Thousands of tiny files mean huge listing/open overhead and poor I/O batching; compaction rewrites them into right-sized files (~128 MB\u20131 GB) to restore throughput."
        }
      ]
    },
    "de-storage-ingestion": {
      title: "Ingestion checkpoint",
      sub: "Batch vs streaming, CDC and idempotency.",
      questions: [
        {
          q: "Log-based CDC captures changes by\u2026",
          options: ["Polling the table with SELECT * every minute", "Reading the database\u2019s transaction log (e.g. WAL/binlog)", "Asking users to export CSVs", "Truncating and reloading nightly"],
          answer: 1,
          explain: "Log-based CDC tails the write-ahead log/binlog, so it captures every insert/update/delete with low overhead and no missed changes \u2014 unlike query-based polling."
        },
        {
          q: "An idempotent load guarantees that\u2026",
          options: ["Each row is loaded exactly once even if the job reruns", "The job never fails", "Data is encrypted at rest", "Loads are always faster"],
          answer: 0,
          explain: "Idempotency means re-running the load (after a retry or replay) produces the same result \u2014 typically via MERGE/upsert on a key or partition-overwrite \u2014 so duplicates can\u2019t accumulate."
        },
        {
          q: "A 'high-watermark' is used in incremental loads to\u2026",
          options: ["Cap the warehouse size", "Remember the latest processed point so you only pull new rows", "Encrypt the source", "Force a full reload"],
          answer: 1,
          explain: "The high-watermark (e.g. a max updated_at or LSN) records how far you\u2019ve consumed, so the next run reads only records newer than it \u2014 the heart of incremental ingestion."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.storage = {
    id: "storage", name: "Storage & File Formats", short: "STORE",
    tagline: "Where bytes live and why it matters", color: "#38bdf8",
    blurb: "How data is physically stored and read: OLTP vs OLAP, row vs columnar, Parquet/ORC/Avro, compression, the lake\u2013warehouse\u2013lakehouse trio, open table formats, partitioning, and ingestion patterns including CDC and idempotent loads.",
    modules: [
      {
        id: "foundations", name: "Foundations", icon: "compass",
        lessons: [
          {
            id: "what-is-de", title: "What data engineering is",
            summary: "The job: build reliable pipelines that move data from where it\u2019s created to where it creates value.",
            minutes: 6, tags: ["intro", "mental-model"],
            blocks: [
              { t: "p", html: "<strong>Data engineering</strong> is the practice of building and operating the systems that <em>move, store, shape and serve</em> data so other people can trust and use it. If a data scientist asks \u201cwhat will churn next month?\u201d, the data engineer makes sure the clean, fresh, well-modeled data needed to answer that exists \u2014 reliably, at scale, every day." },
              { t: "h", text: "The value chain" },
              { t: "ul", items: [
                "<strong>Ingest</strong> \u2014 pull data from apps, databases, APIs, files and event streams.",
                "<strong>Store</strong> \u2014 land it durably and cheaply in a lake/warehouse in the right format.",
                "<strong>Process</strong> \u2014 clean, join, aggregate and model it (batch or streaming).",
                "<strong>Serve</strong> \u2014 expose tables, metrics and APIs to BI, ML and applications.",
                "<strong>Govern</strong> \u2014 test, monitor, document, secure and control the cost of it all."
              ] },
              { t: "note", variant: "key", html: "The engineer is judged on <strong>reliability, scale and cost</strong>, not cleverness. A pipeline that is correct, on time, and cheap to run beats a clever one that breaks at 3am." },
              { t: "table", headers: ["Role", "Owns", "Optimizes for"], rows: [
                ["Data engineer", "Pipelines, storage, models", "Reliability, freshness, cost"],
                ["Analytics engineer", "Transformations, metrics (dbt)", "Trust & clarity of models"],
                ["Data scientist / analyst", "Models, dashboards, insight", "Answering the question"]
              ] },
              { t: "note", variant: "tip", html: "Across this atlas you\u2019ll meet every layer: storage and formats here, then modeling, batch (Spark), streaming, orchestration & DataOps, and the SQL engines underneath. Start here \u2014 everything sits on storage." }
            ]
          },
          {
            id: "oltp-vs-olap", title: "OLTP vs OLAP",
            summary: "Two opposite shapes of database \u2014 fast small transactions versus huge analytical scans.",
            minutes: 6, tags: ["oltp", "olap"],
            blocks: [
              { t: "p", html: "Almost every storage decision starts by asking which of two worlds you\u2019re in. <strong>OLTP</strong> (Online Transaction Processing) powers applications: lots of tiny reads and writes by key. <strong>OLAP</strong> (Online Analytical Processing) powers analytics: a few big queries that scan and aggregate millions of rows." },
              { t: "table", headers: ["", "OLTP", "OLAP"], rows: [
                ["Access pattern", "Point reads/writes by key", "Large scans & aggregations"],
                ["Layout", "Row-oriented", "Column-oriented"],
                ["Schema", "Highly normalized", "Denormalized / star"],
                ["Rows per query", "One / a few", "Millions"],
                ["Examples", "Postgres, MySQL", "Snowflake, BigQuery, Spark"]
              ] },
              { t: "p", html: "Why the split? A row store keeps a record\u2019s fields next to each other, so writing or reading one order is one quick seek. A column store keeps each column together, so summing one column over a billion rows reads only that column \u2014 and compresses it brutally well." },
              { t: "note", variant: "trap", html: "Running heavy analytics directly on the production OLTP database is a classic mistake: big scans lock and starve the transactional workload. The standard fix is to <em>replicate</em> into an analytical store (often via CDC, later in this track)." },
              { t: "note", variant: "key", html: "Keep the mental rule: <strong>row store for transactions, column store for analytics.</strong> The next lesson shows exactly why columnar wins for scans." }
            ]
          },
          {
            id: "row-vs-columnar", title: "Row vs columnar storage",
            summary: "Why storing data column-by-column makes analytics read less and compress more.",
            minutes: 7, tags: ["columnar", "parquet"],
            blocks: [
              { t: "p", html: "Disk and network are slow; CPU is fast. The whole game in analytics is <strong>reading fewer bytes</strong>. Columnar storage wins three ways: <em>projection</em> (read only the columns you ask for), <em>compression</em> (a column of similar values compresses far better than mixed rows), and <em>vectorization</em> (process a column in tight CPU loops)." },
              { t: "p", html: "In a row store, the six fields of one record sit together, so " + tok("SELECT SUM(amount)") + " still drags every other column off disk. In a column store, " + tok("amount") + " lives in its own contiguous run \u2014 read it, skip the rest." },
              { t: "widget", id: "de-store-columnar" },
              { t: "note", variant: "key", html: "Columnar storage turns a wide table into many narrow, independently-readable, highly-compressible columns. That is the foundation of Parquet, ORC, and every analytical warehouse." },
              { t: "note", variant: "tip", html: "Watch the readout above: " + tok("SELECT country") + " on a columnar layout reads a fraction of the file, while the row layout always reads everything. That ratio, multiplied by terabytes, is the difference between a 3-second and a 3-minute query." }
            ]
          },
          {
            id: "data-gravity", title: "Throughput, latency & data gravity",
            summary: "Big data is heavy: move compute to it, and scan as little as possible.",
            minutes: 6, tags: ["performance", "cost"],
            blocks: [
              { t: "p", html: "<strong>Latency</strong> is how long one operation takes; <strong>throughput</strong> is how much you move per second. Analytics lives and dies by throughput \u2014 a query that scans 1 TB at 1 GB/s takes ~17 minutes no matter how clever the SQL is." },
              { t: "p", html: "<strong>Data gravity</strong> is the idea that large datasets attract services and are painful to move. Shipping a terabyte across regions is slow and costly (cloud <em>egress</em> is billed), so the cheap move is to run compute <em>next to</em> the data." },
              { t: "stat", items: [
                { v: "~17 min", k: "to scan 1 TB at 1 GB/s" },
                { v: "$0.02\u2013$0.12/GB", k: "typical cloud egress" },
                { v: "10\u2013100\u00d7", k: "savings from pruning scans" }
              ] },
              { t: "note", variant: "key", html: "Three levers shrink a scan: read fewer <strong>columns</strong> (projection), fewer <strong>rows</strong> (partition/predicate pruning), and fewer <strong>bytes per value</strong> (compression). Master these and most performance problems solve themselves." },
              { t: "quiz", id: "de-storage-foundations" }
            ]
          }
        ]
      },
      {
        id: "formats", name: "File Formats", icon: "blocks",
        lessons: [
          {
            id: "text-formats", title: "CSV, JSON & the cost of text",
            summary: "Human-friendly text formats are convenient and slow \u2014 know exactly why.",
            minutes: 6, tags: ["csv", "json"],
            blocks: [
              { t: "p", html: "<strong>CSV</strong> and <strong>JSON</strong> are everywhere because humans can read them and everything can emit them. But they are <em>schema-on-read</em> with no real types: the number " + tok("00123") + " and the date " + tok("2024-13-40") + " are just text until something parses (and validates) them." },
              { t: "compare",
                bad: { title: "Costs of text", items: ["No types \u2014 parsing & casting on every read", "No column statistics, no pushdown", "Bloated on disk (numbers stored as strings)", "Gzip\u2019d CSV isn\u2019t splittable"] },
                good: { title: "When text is fine", items: ["Small config / lookup files", "Interchange with external partners", "Quick human inspection / debugging", "Landing raw data before conversion"] }
              },
              { t: "note", variant: "tip", html: "A common pattern: land raw CSV/JSON in a <em>bronze</em> zone for fidelity, then convert to Parquet for everything downstream. You keep the original and get fast analytics." },
              { t: "note", variant: "warn", html: "JSON\u2019s flexibility is a trap at scale: nested, irregular records are slow to scan and hard to evolve. Flatten and type them into columnar tables as early as you can." }
            ]
          },
          {
            id: "parquet", title: "Parquet: columnar on disk",
            summary: "The dominant analytical file format \u2014 row groups, column chunks, stats and pushdown.",
            minutes: 8, tags: ["parquet", "pushdown"],
            blocks: [
              { t: "p", html: "<strong>Apache Parquet</strong> is the default columnar file format for analytics. A file is split into <strong>row groups</strong> (horizontal slices of rows); within each, every column is a <strong>column chunk</strong> made of <strong>pages</strong>. A footer holds the schema and, crucially, <strong>min/max statistics</strong> per column per row group." },
              { t: "ul", items: [
                "<strong>Projection</strong> \u2014 read only the column chunks you select.",
                "<strong>Predicate pushdown</strong> \u2014 use min/max stats to skip whole row groups a filter can\u2019t match.",
                "<strong>Encoding</strong> \u2014 dictionary, run-length (RLE) and bit-packing shrink each column.",
                "<strong>Splittable</strong> \u2014 row groups let many workers read one file in parallel."
              ] },
              { t: "widget", id: "de-store-parquet" },
              { t: "note", variant: "key", html: "Pushdown + projection mean a well-laid-out Parquet table can answer a selective query by reading a tiny slice of the file. That is why \u201cjust write Parquet\u201d is the single highest-leverage storage decision in most pipelines." },
              { t: "code", lang: "python", code:
                "import pyarrow.parquet as pq\n\n" +
                "# Only the 'amount' column chunks are read, and row groups whose\n" +
                "# min/max can't satisfy amount > 100 are skipped entirely.\n" +
                "table = pq.read_table(\n" +
                "    \"events.parquet\",\n" +
                "    columns=[\"amount\"],\n" +
                "    filters=[(\"amount\", \">\", 100)],\n" +
                ")" }
            ]
          },
          {
            id: "avro-orc", title: "Avro & ORC",
            summary: "The other two formats you must recognize \u2014 row-based Avro and columnar ORC.",
            minutes: 6, tags: ["avro", "orc"],
            blocks: [
              { t: "p", html: "<strong>Avro</strong> is <em>row-oriented</em> and self-describing: each file carries its schema, and Avro has well-defined <strong>schema-evolution</strong> rules (add/remove fields with defaults). That makes it ideal for serialization and message streams (it\u2019s the usual on-the-wire format for Kafka with a schema registry)." },
              { t: "p", html: "<strong>ORC</strong> (Optimized Row Columnar) is, like Parquet, a columnar analytical format. It organizes data into <strong>stripes</strong> with lightweight indexes and is especially common in the Hive/Hadoop ecosystem." },
              { t: "table", headers: ["Format", "Layout", "Sweet spot"], rows: [
                ["Avro", "Row", "Streaming/serialization, schema evolution"],
                ["Parquet", "Columnar", "General analytics, broad engine support"],
                ["ORC", "Columnar", "Hive-centric analytics, strong compression"]
              ] },
              { t: "note", variant: "key", html: "Rule of thumb: <strong>Avro for moving rows</strong> (events, messages), <strong>Parquet/ORC for scanning columns</strong> (analytics). A streaming pipeline often lands Avro and converts to Parquet for the lake." }
            ]
          },
          {
            id: "compression-encoding", title: "Compression & encoding",
            summary: "Codecs and encodings shrink data \u2014 trade ratio against CPU and splittability.",
            minutes: 6, tags: ["compression", "encoding"],
            blocks: [
              { t: "p", html: "Two different things shrink data. <strong>Encoding</strong> exploits structure within a column (dictionary for repeated strings, run-length for repeats, delta for sorted numbers, bit-packing for small integers). <strong>Compression</strong> (Snappy, Zstd, Gzip) then squeezes the encoded bytes." },
              { t: "table", headers: ["Codec", "Ratio", "Speed", "Splittable"], rows: [
                ["Snappy", "Low", "Very fast", "Yes (in Parquet)"],
                ["Zstd", "High", "Fast", "Yes (in Parquet)"],
                ["Gzip", "High", "Slow", "No (raw text)"]
              ] },
              { t: "note", variant: "tip", html: "Inside Parquet, <strong>Snappy</strong> is the safe default and <strong>Zstd</strong> is the go-to when you want a better ratio without paying Gzip\u2019s CPU. The big win, though, is usually <em>encoding</em>: a dictionary-encoded low-cardinality column can shrink 10\u00d7 before compression even runs." },
              { t: "note", variant: "warn", html: "Beware compressing raw CSV with Gzip for big-data jobs: it isn\u2019t splittable, so one worker reads the whole file. Prefer columnar files (already block-compressed and splittable) or a splittable codec." },
              { t: "quiz", id: "de-storage-formats" }
            ]
          }
        ]
      },
      {
        id: "lakehouse", name: "Lakes, Warehouses & the Lakehouse", icon: "database",
        lessons: [
          {
            id: "warehouse", title: "The data warehouse",
            summary: "Managed, columnar, SQL-first analytics \u2014 and the storage/compute split that changed everything.",
            minutes: 6, tags: ["warehouse", "mpp"],
            blocks: [
              { t: "p", html: "A <strong>data warehouse</strong> is a system built for analytics: columnar storage, a cost-based SQL engine, and <strong>MPP</strong> (massively parallel processing) that splits a query across many workers. Snowflake, BigQuery and Redshift are the headline cloud warehouses." },
              { t: "p", html: "The cloud-era breakthrough was <strong>separating storage from compute</strong>. Data lives once in cheap object storage; you spin compute up and down independently. Ten analysts can each get their own warehouse against the same data, and you pay only for compute you use." },
              { t: "note", variant: "key", html: "Separation of storage and compute is why modern warehouses scale elastically and bill per-second. It also blurred the line with data lakes \u2014 setting up the lakehouse two lessons from now." },
              { t: "stat", items: [
                { v: "Columnar", k: "physical storage" },
                { v: "MPP", k: "parallel execution" },
                { v: "Elastic", k: "compute, billed per-use" }
              ] }
            ]
          },
          {
            id: "data-lake", title: "Data lakes & object storage",
            summary: "Cheap, schema-on-read storage for everything \u2014 and how it turns into a swamp.",
            minutes: 6, tags: ["lake", "s3"],
            blocks: [
              { t: "p", html: "A <strong>data lake</strong> is just files in <strong>object storage</strong> (S3, GCS, ADLS): cheap, effectively infinite, and able to hold any format \u2014 raw logs, Parquet, images. It is <em>schema-on-read</em>: you impose structure when you query, not when you write." },
              { t: "compare",
                bad: { title: "Data swamp", items: ["No catalog \u2014 nobody knows what\u2019s there", "No schema or quality enforcement", "Duplicate, half-baked datasets", "No ACID \u2014 readers see half-written data"] },
                good: { title: "Healthy lake", items: ["Bronze/silver/gold zones", "Catalog + ownership for every dataset", "Parquet + an open table format", "Tests and contracts at the edges"] }
              },
              { t: "note", variant: "warn", html: "Without governance, a lake degrades into a <strong>data swamp</strong>: a dumping ground nobody trusts. The table formats in the next lesson exist largely to add the structure and guarantees a raw lake lacks." },
              { t: "note", variant: "tip", html: "Object storage gives durability and scale but only eventual list consistency and no transactions on its own \u2014 which is exactly the gap Iceberg/Delta/Hudi fill." }
            ]
          },
          {
            id: "table-formats", title: "The lakehouse: Iceberg, Delta & Hudi",
            summary: "Open table formats add ACID, time-travel and schema evolution on top of files.",
            minutes: 7, tags: ["iceberg", "delta", "lakehouse"],
            blocks: [
              { t: "p", html: "A <strong>lakehouse</strong> puts warehouse-grade guarantees on lake-grade storage. <strong>Apache Iceberg</strong>, <strong>Delta Lake</strong> and <strong>Apache Hudi</strong> are <em>open table formats</em>: a metadata layer over Parquet files that tracks which files make up the table at each <strong>snapshot</strong>." },
              { t: "ul", items: [
                "<strong>ACID</strong> \u2014 atomic commits; readers never see a half-written table.",
                "<strong>Time-travel</strong> \u2014 query the table as of an old snapshot or version.",
                "<strong>Schema evolution</strong> \u2014 add/rename/drop columns safely.",
                "<strong>Hidden partitioning</strong> \u2014 (Iceberg) partition without leaking it into queries."
              ] },
              { t: "widget", id: "de-store-timetravel" },
              { t: "note", variant: "key", html: "The trick is indirection: data files are <em>immutable</em>, and each commit writes new metadata pointing at the current set of files. Time-travel is just reading an older pointer; ACID is just swapping the pointer atomically." },
              { t: "code", lang: "sql", code:
                "-- Read the table as it looked at an earlier snapshot\n" +
                "SELECT * FROM sales VERSION AS OF 42;\n\n" +
                "-- ...or as of a timestamp\n" +
                "SELECT * FROM sales TIMESTAMP AS OF '2024-01-02 00:00:00';" }
            ]
          },
          {
            id: "partitioning", title: "Partitioning & file layout",
            summary: "Lay files out so engines skip what they don\u2019t need \u2014 and avoid the small-file trap.",
            minutes: 7, tags: ["partitioning", "compaction"],
            blocks: [
              { t: "p", html: "<strong>Partitioning</strong> physically splits a table by a column\u2019s value \u2014 e.g. one folder per " + tok("dt") + " and " + tok("region") + ". A query with a matching " + tok("WHERE") + " then reads only the relevant folders: <strong>partition pruning</strong>." },
              { t: "widget", id: "de-store-partition" },
              { t: "p", html: "But partition too finely and you get the <strong>small-file problem</strong>: thousands of tiny files whose per-file open/list overhead destroys throughput. The cure is <strong>compaction</strong> \u2014 rewrite many small files into right-sized ones (~128 MB\u20131 GB). <strong>Clustering / Z-ordering</strong> sorts data so min/max stats prune even within partitions." },
              { t: "note", variant: "trap", html: "Choosing a partition key that\u2019s too granular (e.g. by " + tok("user_id") + ") explodes the file count; too coarse and you can\u2019t prune. Partition by columns you actually filter on, with sane cardinality \u2014 date is the classic good choice." },
              { t: "note", variant: "key", html: "Good layout = the right partition columns + right-sized files + sorted/clustered data. Together they let the engine read megabytes instead of terabytes." },
              { t: "quiz", id: "de-storage-lakehouse" }
            ]
          }
        ]
      },
      {
        id: "ingestion", name: "Ingestion", icon: "plug",
        lessons: [
          {
            id: "batch-vs-stream-ingest", title: "Batch vs streaming ingestion",
            summary: "Bounded loads on a schedule versus unbounded, always-on data capture.",
            minutes: 6, tags: ["batch", "streaming"],
            blocks: [
              { t: "p", html: "<strong>Batch ingestion</strong> moves a bounded chunk on a schedule (hourly, nightly): simple, cheap, easy to reason about. <strong>Streaming ingestion</strong> handles an unbounded flow continuously, for low end-to-end latency. <strong>Micro-batch</strong> sits between them \u2014 tiny batches every few seconds." },
              { t: "table", headers: ["", "Batch", "Streaming"], rows: [
                ["Latency", "Minutes\u2013hours", "Sub-second\u2013seconds"],
                ["Complexity", "Low", "High (state, ordering, failures)"],
                ["Cost model", "Bursty compute", "Always-on"],
                ["Use it for", "Reports, backfills", "Fraud, alerts, live metrics"]
              ] },
              { t: "note", variant: "tip", html: "Don\u2019t reach for streaming by default \u2014 it\u2019s strictly harder to build and operate. Choose it when the <em>business</em> needs fresh data in seconds; otherwise a batch (or micro-batch) load is cheaper and more robust." },
              { t: "note", variant: "key", html: "The full streaming story \u2014 logs, Kafka, windows, watermarks, exactly-once \u2014 has its own track. Here we care about getting data <em>into</em> the platform correctly." }
            ]
          },
          {
            id: "cdc", title: "Change Data Capture",
            summary: "Stream every insert, update and delete out of a source database \u2014 from its log.",
            minutes: 7, tags: ["cdc", "debezium"],
            blocks: [
              { t: "p", html: "<strong>Change Data Capture (CDC)</strong> replicates a source database by capturing its row-level changes. <strong>Log-based CDC</strong> tails the database\u2019s transaction log (Postgres <strong>WAL</strong>, MySQL <strong>binlog</strong>) \u2014 tools like <strong>Debezium</strong> turn each commit into an event. <strong>Query-based CDC</strong> instead polls " + tok("WHERE updated_at > :last") + "." },
              { t: "compare",
                bad: { title: "Query-based polling", items: ["Misses hard deletes", "Misses intermediate updates between polls", "Adds query load to the source", "Needs a reliable updated_at"] },
                good: { title: "Log-based CDC", items: ["Captures every insert/update/delete", "Low overhead on the source", "Preserves order from the log", "Exact, replayable change stream"] }
              },
              { t: "p", html: "A CDC pipeline usually does an initial <strong>snapshot</strong> of the table, then switches to streaming ongoing changes from the log offset where the snapshot ended \u2014 so you get a complete, continuous mirror." },
              { t: "note", variant: "key", html: "CDC is the standard way to feed OLTP data into the lake/warehouse without hammering production: read the log once, fan it out to everyone. It pairs naturally with the streaming track and with idempotent merges (next)." }
            ]
          },
          {
            id: "incremental-idempotent", title: "Incremental & idempotent loads",
            summary: "Load only what\u2019s new, and make reruns safe so retries never double-count.",
            minutes: 7, tags: ["incremental", "idempotency", "merge"],
            blocks: [
              { t: "p", html: "<strong>Incremental loads</strong> process only new/changed data since last time, tracked by a <strong>high-watermark</strong> (a max " + tok("updated_at") + ", an LSN, or a Kafka offset). That\u2019s what keeps a daily pipeline from reprocessing all of history every run." },
              { t: "p", html: "Pipelines fail and get retried, and at-least-once delivery means duplicates happen. So loads must be <strong>idempotent</strong>: re-running produces the same result. The two workhorses are <strong>MERGE/upsert</strong> on a key and <strong>partition-overwrite</strong> (replace a whole day atomically)." },
              { t: "code", lang: "sql", code:
                "-- Idempotent upsert: rerunning with the same rows changes nothing\n" +
                "MERGE INTO customers t\n" +
                "USING staging s ON t.id = s.id\n" +
                "WHEN MATCHED THEN UPDATE SET name = s.name, updated_at = s.updated_at\n" +
                "WHEN NOT MATCHED THEN INSERT (id, name, updated_at)\n" +
                "  VALUES (s.id, s.name, s.updated_at);" },
              { t: "note", variant: "trap", html: "A plain " + tok("INSERT") + " is <em>not</em> idempotent \u2014 a retried batch inserts everything twice. Always reload via MERGE on a key, or overwrite the target partition, so a replay is harmless." },
              { t: "note", variant: "key", html: "Incremental + idempotent is the reliability backbone of batch pipelines: pull only new data, and make every load safe to run again. The batch track builds on exactly this." },
              { t: "quiz", id: "de-storage-ingestion" }
            ]
          }
        ]
      }
    ]
  };
})();
