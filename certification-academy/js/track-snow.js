/* track-snow.js — SnowPro Core concepts (unofficial, original prep) */
(function () {
  "use strict";
  var TID = "snow";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    for (var k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    mount.appendChild(h("p", { class: "widget-desc" }, desc));
    var stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);
    return stage;
  }
  function seg(label, opts, active, onPick) {
    var wrap = h("div", { class: "su-ctl" }, h("span", { class: "su-ctl-label" }, label));
    var box = h("div", { class: "w-seg", role: "group", "aria-label": label });
    var btns = opts.map(function (o, i) {
      var b = h("button", { type: "button", class: "w-seg-btn" + (i === active ? " active" : ""), "aria-pressed": i === active ? "true" : "false" }, o);
      b.addEventListener("click", function () {
        btns.forEach(function (x, j) { x.className = "w-seg-btn" + (j === i ? " active" : ""); x.setAttribute("aria-pressed", j === i ? "true" : "false"); });
        onPick(i);
      });
      box.appendChild(b);
      return b;
    });
    wrap.appendChild(box);
    return wrap;
  }
  function ro(label) {
    var b = h("b", {}, "-");
    var el = h("div", { class: "ro" }, label + ": ", b);
    return { el: el, set: function (v) { b.textContent = String(v); } };
  }
  function hashStr(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  var bag = [];
  function slot(seedText) {
    if (!bag.length) {
      bag = [0, 1, 2, 3];
      var r = hashStr(TID + seedText);
      for (var i = 3; i > 0; i--) { r = (Math.imul(r, 1103515245) + 12345) >>> 0; var j = (r >>> 8) % (i + 1); var t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    }
    return bag.pop();
  }
  function Q(q, right, wrong, explain) {
    var pos = slot(q);
    var options = wrong.slice(0, 3);
    options.splice(pos, 0, right);
    return { q: q, options: options, answer: pos, explain: explain };
  }
  var QZ = {};
  function L(id, title, summary, minutes, tags, blocks, questions) {
    var qid = TID + "-" + id;
    QZ[qid] = { title: "Checkpoint: " + title, sub: questions.length + " original exam-style questions with explanations", questions: questions };
    var b = blocks.slice(0, -1).concat([{ t: "quiz", id: qid }], blocks.slice(-1));
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: b };
  }
  var VERIFY = { t: "note", variant: "warn", html: "Unofficial study material. Edition-specific features, retention limits and exam domain weights change; <strong>verify current official objectives</strong> and documentation before relying on a specific number." };

  /* ---------- widgets ---------- */
  var Widgets = {};

  Widgets.suWarehouseSizer = function (mount) {
    var stage = shell(mount, "simulator", "Warehouse size and cluster lab", "Credits per hour roughly double with each size step. Compare scaling up (bigger warehouse) with scaling out (more clusters) for a workload. Illustrative model, not a price list.");
    var sizes = ["XS", "S", "M", "L", "XL"];
    var st = { size: 1, clusters: 1, users: 1, heavy: 0 };
    var a = ro("Credits/hour (running)"), b = ro("Single big query"), c = ro("Queueing"), d = ro("Advice");
    function paint() {
      var credits = Math.pow(2, st.size) * st.clusters;
      var conc = [4, 16, 40][st.users];
      var capacity = st.clusters * 8;
      a.set(credits);
      b.set(st.heavy ? (st.size >= 3 ? "fast, little spilling" : "slow, likely spilling to disk") : "fine at any size");
      c.set(conc > capacity ? "queries queue (" + conc + " concurrent vs ~" + capacity + " slots)" : "minimal");
      d.set(st.heavy && st.size < 3 ? "scale UP for complex queries" : conc > capacity ? "scale OUT with more clusters for concurrency" : "current setup fits; keep auto-suspend on");
    }
    stage.appendChild(seg("Size", sizes, 1, function (i) { st.size = i; paint(); }));
    stage.appendChild(seg("Clusters", ["1", "2", "3", "4"], 0, function (i) { st.clusters = i + 1; paint(); }));
    stage.appendChild(seg("Concurrent users", ["few", "many", "a crowd"], 1, function (i) { st.users = i; paint(); }));
    stage.appendChild(seg("Query shape", ["simple lookups", "large joins / sorts"], 0, function (i) { st.heavy = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el, d.el));
    paint();
  };

  Widgets.suCacheLayers = function (mount) {
    var stage = shell(mount, "trace", "Which cache answers this query?", "Set the situation and see whether the result cache, the warehouse's local disk cache, or remote storage serves the query.");
    var st = { same: 1, changed: 0, wh: 1, meta: 0 };
    var a = ro("Served by"), b = ro("Warehouse credits"), c = ro("Why");
    function paint() {
      if (st.meta) { a.set("metadata (cloud services)"); b.set("none for the query itself"); c.set("simple COUNT(*) or MIN/MAX on a table can be answered from micro-partition metadata"); return; }
      if (st.same && !st.changed) { a.set("result cache"); b.set("none"); c.set("identical query text, underlying data unchanged, persisted result reused"); return; }
      if (st.wh) { a.set("local disk cache on the warehouse"); b.set("yes, warehouse must run"); c.set("data files read recently by this running warehouse are cached on its local storage"); return; }
      a.set("remote storage"); b.set("yes, and slower"); c.set("warehouse was suspended, so its local cache was dropped; data read from the storage layer");
    }
    stage.appendChild(seg("Same query text as before?", ["no", "yes"], 1, function (i) { st.same = i; paint(); }));
    stage.appendChild(seg("Underlying data changed since?", ["no", "yes"], 0, function (i) { st.changed = i; paint(); }));
    stage.appendChild(seg("Warehouse stayed running?", ["suspended", "running"], 1, function (i) { st.wh = i; paint(); }));
    stage.appendChild(seg("Query is a metadata-only aggregate?", ["no", "yes"], 0, function (i) { st.meta = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el));
    paint();
  };

  Widgets.suTimeTravel = function (mount) {
    var stage = shell(mount, "timeline", "Time Travel and Fail-safe timeline", "Pick a table type and retention. The bar shows when you can recover data yourself and when only the vendor can help. Defaults shown are typical; verify limits for your edition.");
    var st = { type: 0, days: 1 };
    var bar = h("div", { class: "su-timeline", role: "img", "aria-label": "Recovery timeline" });
    var a = ro("Self-service recovery"), b = ro("Fail-safe"), c = ro("Storage note");
    function paint() {
      var permanent = st.type === 0;
      var tt = permanent ? [1, 7, 30, 90][st.days] : Math.min([1, 7, 30, 90][st.days], 1);
      var fs = permanent ? 7 : 0;
      a.set("Time Travel for " + tt + " day" + (tt === 1 ? "" : "s") + (permanent ? "" : " (max for this type)"));
      b.set(fs ? fs + " days, recoverable only through vendor support" : "none");
      c.set(permanent ? "you pay storage for changed data across both windows" : "transient/temporary avoid Fail-safe storage cost");
      bar.textContent = "";
      var total = tt + fs;
      bar.appendChild(h("span", { class: "su-tl-seg tt", style: "flex:" + tt }, "Time Travel " + tt + "d"));
      if (fs) bar.appendChild(h("span", { class: "su-tl-seg fs", style: "flex:" + fs }, "Fail-safe " + fs + "d"));
      bar.setAttribute("aria-label", "Recovery timeline: " + tt + " days Time Travel, " + fs + " days Fail-safe, total " + total + " days");
    }
    stage.appendChild(seg("Table type", ["permanent", "transient", "temporary"], 0, function (i) { st.type = i; paint(); }));
    stage.appendChild(seg("DATA_RETENTION_TIME_IN_DAYS", ["1", "7", "30", "90"], 0, function (i) { st.days = i; paint(); }));
    stage.appendChild(bar);
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el));
    paint();
  };

  Widgets.suRoleTree = function (mount) {
    var stage = shell(mount, "rbac", "Role hierarchy access check", "Privileges flow up a role hierarchy: a role inherits everything granted to roles granted to it. Choose a user's role and an action.");
    var roles = ["ANALYST", "DATA_ENGINEER", "SYSADMIN", "SECURITYADMIN", "ACCOUNTADMIN"];
    var inherits = { ANALYST: ["ANALYST"], DATA_ENGINEER: ["DATA_ENGINEER", "ANALYST"], SYSADMIN: ["SYSADMIN", "DATA_ENGINEER", "ANALYST"], SECURITYADMIN: ["SECURITYADMIN", "USERADMIN"], ACCOUNTADMIN: ["ACCOUNTADMIN", "SYSADMIN", "DATA_ENGINEER", "ANALYST", "SECURITYADMIN", "USERADMIN"] };
    var actions = [
      { n: "SELECT on SALES.MART", need: "ANALYST" },
      { n: "CREATE TABLE in SALES.RAW", need: "DATA_ENGINEER" },
      { n: "CREATE WAREHOUSE", need: "SYSADMIN" },
      { n: "CREATE USER", need: "USERADMIN" },
      { n: "View account billing", need: "ACCOUNTADMIN" }
    ];
    var st = { role: 0, act: 0 };
    var a = ro("Result"), b = ro("Inherited roles"), c = ro("Note");
    function paint() {
      var r = roles[st.role], act = actions[st.act];
      var ok = inherits[r].indexOf(act.need) !== -1;
      a.set(ok ? "allowed" : "denied");
      b.set(inherits[r].join(" > "));
      c.set(ok ? "granted via " + act.need : "needs a role that holds or inherits " + act.need + "; custom roles should roll up to SYSADMIN");
    }
    stage.appendChild(seg("Active role", roles, 0, function (i) { st.role = i; paint(); }));
    stage.appendChild(seg("Action", actions.map(function (x) { return x.n; }), 0, function (i) { st.act = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el));
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- lessons ---------- */
  var arch = [
    L("three-layers", "The three-layer architecture", "Storage, compute and cloud services scale independently.", 9, ["architecture"], [
      VERIFY,
      { t: "p", html: "Hold one picture: <strong>storage</strong> is a single shared copy of your data in cloud object storage; <strong>compute</strong> is any number of independent virtual warehouses reading that copy; <strong>cloud services</strong> is the brain that parses, optimizes, secures and tracks metadata. Because the layers are separate, many teams can query the same data without competing for the same CPUs." },
      { t: "table", headers: ["Layer", "Does", "You pay via"], rows: [
        ["Storage", "Holds compressed, columnar micro-partitions", "Storage per TB per month"],
        ["Compute (virtual warehouses)", "Executes queries and DML", "Credits while warehouses run"],
        ["Cloud services", "Auth, optimizer, metadata, transactions, access control", "Credits, with an allowance relative to compute usage"]
      ] },
      { t: "ul", items: ["A suspended warehouse costs no compute credits; storage is billed regardless.", "Two warehouses on the same table do not slow each other down; they only share the data.", "Metadata (min/max per column per micro-partition) lives in cloud services and powers pruning.", "Editions add features (for example, multi-cluster warehouses or longer Time Travel); check which edition a feature needs."] },
      { t: "note", variant: "tip", html: "The phrase <em>shared-data, multi-cluster</em> is a useful summary: centralized storage like shared-disk, independent compute like shared-nothing." },
      { t: "note", variant: "key", html: "Storage, compute and services are separate. Warehouses are independent compute over one shared copy of data, and only running warehouses burn compute credits." }
    ], [
      Q("Two departments run heavy queries on the same tables at the same time and complain about contention. What is the most direct fix?", "Give each department its own virtual warehouse", ["Copy the tables into two databases", "Increase the storage retention period", "Run the queries in a single larger warehouse together"], "Warehouses are independent compute clusters reading shared storage, so separate warehouses remove compute contention without duplicating data."),
      Q("Which layer parses and optimizes SQL, enforces access control and stores metadata?", "Cloud services", ["Storage", "Virtual warehouse", "Client driver"], "The cloud services layer coordinates the system: authentication, optimization, metadata and transaction management. Warehouses execute the work."),
      Q("A warehouse is suspended overnight. What is billed during that time?", "Storage for the data, but no compute credits for that warehouse", ["Compute credits at half rate", "Nothing at all", "Compute credits for the cluster count"], "Suspended warehouses consume no compute credits. Data at rest is still billed as storage."),
      Q("How is table data physically stored?", "As compressed, columnar micro-partitions in cloud storage", ["As row-based pages on each warehouse's disk", "As JSON files per row", "As one file per table on the client"], "Data is reorganized into immutable, compressed, columnar micro-partitions held in the storage layer and shared by all warehouses."),
      Q("Which statement best describes the architecture?", "A hybrid of central shared storage with independent massively parallel compute clusters", ["A pure shared-nothing system with data pinned to nodes", "A single-node database with replicas", "A shared-disk system where all users share one compute cluster"], "Data lives in one central store while compute runs in independent MPP clusters, combining shared-disk simplicity with shared-nothing performance."),
      Q("A feature you plan to use is listed as available only in higher editions. What should you do before relying on it in a design?", "Confirm the account's edition supports it", ["Assume all editions include it", "Enable it with a session parameter", "Ask users to run it in a trial account"], "Several capabilities depend on edition. Verifying the edition avoids designing around a feature the account cannot use.")
    ]),

    L("micro-partitions", "Micro-partitions, pruning and clustering", "Why well-organized data scans less, and when clustering keys help.", 10, ["micro-partitions", "clustering"], [
      { t: "p", html: "Every table is split automatically into micro-partitions, each holding a slice of rows stored by column, with metadata recording each column's min and max values. A filter like <code class='tok'>WHERE order_date = '2026-03-01'</code> lets the optimizer skip every partition whose range cannot match. That skipping is <strong>pruning</strong>, and it is the main reason good layout makes queries cheaper." },
      { t: "ul", items: ["Micro-partitions are created automatically on load in insertion order; you do not define them.", "Data loaded in date order tends to prune well on date filters for free.", "Overlapping value ranges across many partitions reduce pruning; clustering depth measures that overlap.", "A <strong>clustering key</strong> asks the service to co-locate rows by chosen columns; automatic reclustering runs in the background and consumes credits."] },
      { t: "table", headers: ["Good clustering key candidate", "Poor candidate"], rows: [
        ["Very large table, frequent range or equality filters on the column", "Small table that already scans quickly"],
        ["Moderate cardinality (dates, regions)", "Unique IDs with extreme cardinality"],
        ["Query performance matters more than reclustering cost", "Table changes constantly with little querying"]
      ] },
      { t: "code", lang: "sql", code: "ALTER TABLE sales CLUSTER BY (sale_date, region);\nSELECT SYSTEM$CLUSTERING_INFORMATION('sales', '(sale_date, region)');" },
      { t: "note", variant: "trap", html: "Clustering keys are not indexes and are not free. They are for very large tables with selective filters, not a default for every table." },
      { t: "note", variant: "key", html: "Pruning skips micro-partitions using min/max metadata. Clustering keys improve pruning on huge tables, at a background credit cost." }
    ], [
      Q("What allows a query with a selective WHERE clause to scan only a fraction of a large table?", "Pruning based on micro-partition metadata", ["Secondary B-tree indexes", "The result cache", "Fail-safe"], "Each micro-partition records value ranges per column. The optimizer skips partitions that cannot satisfy the filter, which is pruning."),
      Q("Which table is the best candidate for a clustering key?", "A multi-terabyte fact table frequently filtered by date", ["A 10 MB lookup table", "A table that is rewritten every minute and rarely queried", "A temporary table used once per session"], "Clustering pays off on very large tables with selective, repeated filters. Small or rarely queried tables gain little and still incur reclustering cost."),
      Q("What does a high clustering depth indicate?", "Many micro-partitions overlap for the clustering columns, so pruning is weaker", ["The table is perfectly clustered", "The table has too few columns", "The warehouse is too small"], "Clustering depth reflects how many partitions overlap for a given value. Higher depth means more partitions must be scanned."),
      Q("Who defines micro-partition boundaries when data is loaded?", "The service, automatically", ["The user, with a PARTITION BY clause on CREATE TABLE", "The warehouse administrator, per warehouse", "The cloud provider's object store"], "Micro-partitions are created automatically during loading and DML. Users can influence organization with clustering keys but do not define partitions."),
      Q("What is a cost consideration of defining a clustering key?", "Automatic reclustering consumes credits in the background", ["Clustering doubles the storage price permanently", "Queries can no longer use the result cache", "The table becomes read-only"], "Reclustering is a managed background service that uses compute credits, so the performance gain must justify it."),
      Q("Events are loaded continuously in timestamp order, and most queries filter on a recent time range. What is the likely situation?", "Natural ordering already gives good pruning on the timestamp, so a clustering key may be unnecessary", ["Pruning cannot work without a clustering key", "The table must be converted to transient", "A materialized view is required for any filter"], "Loading in time order tends to create partitions with tight time ranges, so time filters prune well without explicit clustering.")
    ]),

    L("objects-hierarchy", "Objects, table types and views", "Account, database, schema and the objects inside; permanent versus transient versus temporary.", 9, ["objects", "tables", "views"], [
      { t: "p", html: "Objects nest: <strong>account &gt; database &gt; schema &gt; tables, views, stages, file formats, sequences, functions, procedures, pipes, streams, tasks</strong>. Warehouses, users and roles live at account level, outside any database." },
      { t: "table", headers: ["Table type", "Lives until", "Time Travel", "Fail-safe"], rows: [
        ["Permanent", "Dropped", "Configurable (edition-dependent maximum)", "Yes"],
        ["Transient", "Dropped", "Up to 1 day", "No"],
        ["Temporary", "End of session", "Up to 1 day", "No"],
        ["External", "Dropped; data stays in external storage", "No", "No"]
      ] },
      { t: "table", headers: ["View type", "Key property"], rows: [
        ["Standard view", "Stored query; definition visible to authorized roles"],
        ["Secure view", "Hides definition and blocks optimizations that could leak data; needed for sharing views"],
        ["Materialized view", "Precomputed results kept current by a background service; costs storage and maintenance credits"]
      ] },
      { t: "note", variant: "tip", html: "Transient tables suit staging data you can reload: you skip Fail-safe storage costs and accept weaker recovery." },
      { t: "note", variant: "key", html: "Pick table type by recoverability needs; pick view type by security (secure) or performance (materialized) needs." }
    ], [
      Q("A staging table is rebuilt from source files every night. Which table type reduces storage cost while accepting weaker recovery?", "Transient table", ["Permanent table with 90-day Time Travel", "External table with Fail-safe", "Temporary table shared across sessions"], "Transient tables have no Fail-safe and at most a short Time Travel window, which lowers storage cost for data that can be reloaded."),
      Q("Which object exists only for the duration of the session that created it?", "Temporary table", ["Transient table", "Secure view", "Named stage"], "Temporary tables are dropped automatically when the session ends and are visible only to that session."),
      Q("A provider wants to share a view without exposing its SQL definition or allowing optimizations that might reveal hidden rows. What should they use?", "A secure view", ["A standard view", "A materialized view without security", "A temporary table"], "Secure views hide their definition from unauthorized users and avoid optimizations that could expose filtered data, which is why shared views must be secure."),
      Q("A dashboard repeatedly aggregates one large table in the same way and needs faster results. Which object can help, at the cost of background maintenance?", "A materialized view", ["A secure view", "A sequence", "A file format"], "Materialized views precompute and store results, kept current by a background service that consumes credits."),
      Q("Where do virtual warehouses live in the object hierarchy?", "At the account level, outside databases", ["Inside a schema", "Inside a database but outside schemas", "Inside a stage"], "Warehouses, users, roles and resource monitors are account-level objects. Tables, views and stages live in schemas."),
      Q("Which table type keeps the data in external cloud storage while letting you query it?", "External table", ["Transient table", "Temporary table", "Permanent table"], "External tables reference files in external storage, so dropping the table does not delete the files.")
    ])
  ];

  var perf = [
    L("warehouse-sizing", "Virtual warehouses: size, scale and suspend", "Scale up for complex queries, scale out for concurrency, suspend to save.", 10, ["warehouses", "credits"], [
      { t: "p", html: "A warehouse size sets how much compute each cluster has; each step up roughly doubles both resources and credits per hour. Billing is per second while the warehouse runs, with a minimum charge each time it resumes. So the levers are: <strong>right size</strong>, <strong>right number of clusters</strong>, and <strong>suspend quickly</strong>." },
      { t: "widget", id: "suWarehouseSizer" },
      { t: "compare", bad: { title: "Scale up (bigger size)", items: ["Helps complex joins, sorts, large scans", "Reduces spilling to disk", "Does not add concurrency slots by itself"] }, good: { title: "Scale out (multi-cluster)", items: ["Adds clusters when queries queue", "Helps many concurrent users", "Does not speed up one slow query"] } },
      { t: "ul", items: ["Auto-suspend stops credit use after a period of inactivity; auto-resume starts on the next query.", "Multi-cluster scaling policy: <em>standard</em> favours starting clusters to avoid queuing; <em>economy</em> favours keeping clusters busy to save credits.", "Separate warehouses per workload (loading, BI, data science) isolate performance and cost.", "Resizing affects queued and new queries, not ones already running."] },
      { t: "note", variant: "trap", html: "If one query is slow and spills to remote storage, more clusters will not help; a larger size might. If many queries queue, a larger size alone may not help; more clusters will." },
      { t: "note", variant: "key", html: "Complex queries: scale up. Many concurrent queries: scale out. Always set auto-suspend." }
    ], [
      Q("Hundreds of BI users at 9 a.m. see their queries queue, but each query is simple. What should you change?", "Use a multi-cluster warehouse so more clusters start under load", ["Increase the warehouse size from M to 4XL only", "Disable auto-suspend", "Move the users to a transient database"], "Queuing from concurrency is solved by adding clusters. A larger size helps complex queries more than many simple ones."),
      Q("A single large transformation query spills heavily to remote storage. What is the most likely helpful change?", "Run it on a larger warehouse size", ["Add more clusters at the same size", "Lower the auto-suspend time", "Convert the table to temporary"], "Spilling indicates the warehouse lacks memory and local storage for the query. A larger size provides more of both; extra clusters do not help a single query."),
      Q("How do credits per hour change from one warehouse size to the next larger size?", "They roughly double", ["They stay the same", "They increase by a fixed 10 percent", "They halve"], "Each size step roughly doubles compute resources and credit consumption per hour."),
      Q("Which setting most directly prevents an idle warehouse from consuming credits?", "Auto-suspend", ["Auto-resume", "Maximum cluster count", "Query acceleration"], "Auto-suspend stops the warehouse after a period of inactivity. Auto-resume only restarts it when a query arrives."),
      Q("Loading jobs slow down dashboards when both use the same warehouse. What is the recommended design?", "Use separate warehouses for loading and for BI", ["Run loading only during business hours", "Use one larger warehouse for everything", "Disable the result cache"], "Separate warehouses isolate workloads so a heavy load job does not steal compute from dashboard queries, and cost can be tracked per workload."),
      Q("A multi-cluster warehouse should minimize credits even if some queries wait briefly. Which scaling policy fits?", "Economy", ["Standard", "Maximized with all clusters always on", "Single-cluster with no auto-suspend"], "The economy policy starts additional clusters only when there is enough sustained load to keep them busy, saving credits at the cost of some queuing.")
    ]),

    L("caching", "The three caches", "Result cache, warehouse local cache and metadata, and how to read which one helped.", 8, ["cache", "performance"], [
      { t: "p", html: "Three things can make a repeat query fast. The <strong>result cache</strong> in cloud services returns a stored result for an identical query when the underlying data has not changed. The <strong>local disk cache</strong> on a running warehouse keeps recently read data files. <strong>Metadata</strong> can answer some aggregates without scanning data at all." },
      { t: "widget", id: "suCacheLayers" },
      { t: "table", headers: ["Cache", "Lives in", "Lost when", "Needs a running warehouse?"], rows: [
        ["Result cache", "Cloud services", "Data changes or the result ages out", "No"],
        ["Local disk cache", "Warehouse nodes", "Warehouse suspends or is resized", "Yes"],
        ["Metadata", "Cloud services", "Never, it is maintained continuously", "No"]
      ] },
      { t: "note", variant: "trap", html: "Aggressive auto-suspend saves credits but drops the local disk cache. For a BI warehouse with steady repeated access, a slightly longer suspend window can improve performance." },
      { t: "note", variant: "tip", html: "Result reuse requires a matching query and unchanged data; functions that return different values each run (like the current timestamp) prevent reuse." },
      { t: "note", variant: "key", html: "Result cache: identical query, unchanged data, no warehouse needed. Local cache: warm running warehouse. Metadata: simple aggregates for free." }
    ], [
      Q("A user reruns the exact same query 10 minutes later, and the table has not changed. The warehouse is suspended. What happens?", "The result cache returns the result without resuming the warehouse", ["The warehouse resumes and reads from remote storage", "The query fails because the warehouse is suspended", "Fail-safe supplies the result"], "Persisted results are reused when the query and data are unchanged, and this does not require a running warehouse."),
      Q("Why might a query be slower right after a warehouse resumes than it was before suspension?", "The local disk cache was cleared when the warehouse suspended", ["The result cache is deleted on resume", "Micro-partitions are rebuilt on resume", "Credits are throttled after resume"], "The warehouse's local cache holds recently read files only while it runs. After suspension, data must be read from remote storage again."),
      Q("SELECT COUNT(*) FROM big_table returns instantly without a running warehouse. Why?", "Row counts are available from metadata maintained by cloud services", ["The result cache always stores counts", "Fail-safe keeps a copy of counts", "The table is clustered"], "Some simple aggregates can be answered from micro-partition metadata without scanning data."),
      Q("Which change prevents result cache reuse?", "Data in an underlying table changed since the result was produced", ["Running the query from a different warehouse of the same size", "Running the query 5 minutes later", "Using a larger font in the client"], "Result reuse depends on unchanged data and a matching query. Warehouse choice does not matter for the result cache."),
      Q("A BI warehouse with steady repeated queries auto-suspends after 60 seconds and users see uneven performance. What is a reasonable tuning step?", "Lengthen the auto-suspend window to keep the local cache warm during busy periods", ["Disable auto-resume", "Switch the tables to transient", "Reduce the warehouse to the smallest size"], "Longer suspend windows trade some idle credit cost for warm local caches during periods of steady use."),
      Q("Which cache is tied to a specific warehouse?", "The local disk cache", ["The result cache", "Metadata", "Fail-safe"], "Local cache lives on the warehouse's compute nodes. The result cache and metadata live in cloud services and are shared.")
    ]),

    L("query-profile", "Reading the query profile", "Spilling, pruning, exploding joins and the features that fix them.", 9, ["performance", "query-profile"], [
      { t: "p", html: "The query profile is an operator tree with statistics. Read it top-down for the most expensive node, then check three signals: <strong>partitions scanned versus total</strong>, <strong>bytes spilled</strong>, and <strong>rows exploding in joins</strong>." },
      { t: "table", headers: ["Signal", "Likely cause", "Typical fix"], rows: [
        ["Partitions scanned close to total", "Filter not selective or poorly clustered column", "Better filters, clustering key on huge tables"],
        ["Bytes spilled to local storage", "Warehouse memory too small for the operation", "Larger size or reduce data processed"],
        ["Bytes spilled to remote storage", "Severe memory pressure", "Larger size; this is very expensive"],
        ["Join output far larger than inputs", "Missing or wrong join condition", "Fix join keys; deduplicate"],
        ["Many point lookups on huge table", "Full scans for selective equality filters", "Search optimization service"]
      ] },
      { t: "ul", items: ["Queued time means waiting for warehouse capacity; consider multi-cluster.", "Compilation time is cloud services work; very complex SQL can take a while to compile.", "Query acceleration can offload parts of large scans for eligible queries.", "Materialized views help repeated aggregations of one table."] },
      { t: "note", variant: "trap", html: "Search optimization targets selective lookups (equality, some substring and geospatial predicates). It is not a fix for broad analytical scans." },
      { t: "note", variant: "key", html: "Check pruning, spilling and join explosion first. Spilling says size up; poor pruning says filter or cluster; point lookups say search optimization." }
    ], [
      Q("The query profile shows significant bytes spilled to remote storage. What does this most likely mean?", "The warehouse lacks enough memory and local storage for the query", ["The result cache is full", "The table has too many columns", "Time Travel retention is too long"], "Spilling happens when intermediate data does not fit in memory. Remote spilling is especially slow and suggests a larger warehouse or less data processed."),
      Q("A query scans nearly all partitions of a huge table even though it filters on customer_region. What should you investigate first?", "Whether the filter column is well clustered or selective enough to prune", ["Whether Fail-safe is enabled", "Whether the user has MFA", "Whether the warehouse is multi-cluster"], "Poor pruning means value ranges for the filter column overlap across many partitions. Clustering or more selective predicates improve pruning."),
      Q("An application performs frequent equality lookups by order_id on a multi-terabyte table. Which feature targets this pattern?", "Search optimization service", ["Multi-cluster warehouse", "Transient tables", "Result cache only"], "Search optimization builds a persistent access structure to speed selective point lookups on large tables."),
      Q("A join produces billions of rows from two tables of a few million rows each. What is the most likely problem?", "A missing or incorrect join condition causing row explosion", ["The warehouse is too large", "The tables are clustered", "Auto-suspend is too short"], "Row explosion usually comes from many-to-many matches due to wrong or missing join keys."),
      Q("The profile shows most time spent queued before execution. What does that indicate?", "The warehouse was busy and lacked capacity for the query", ["The table needs clustering", "The SQL had a syntax error", "Data was read from Fail-safe"], "Queued time is waiting for warehouse resources. More clusters or a separate warehouse reduce it."),
      Q("Which situation suits a materialized view best?", "The same aggregation over one large table is queried repeatedly", ["A one-off ad hoc join across many tables", "A table that changes every second and is rarely read", "Loading files from a stage"], "Materialized views precompute results for repeated query patterns, balancing faster reads against maintenance cost.")
    ])
  ];

  var load = [
    L("stages-formats", "Stages and file formats", "Where files sit before loading and how they are described.", 8, ["stages", "file-formats"], [
      { t: "p", html: "A <strong>stage</strong> is a location for files to be loaded or unloaded. Internal stages are inside the service's storage; external stages point at your cloud bucket. A <strong>file format</strong> describes how to parse the files." },
      { t: "table", headers: ["Stage", "Reference", "Notes"], rows: [
        ["User stage", "@~", "One per user; not shareable"],
        ["Table stage", "@%table_name", "One per table; loads into that table"],
        ["Named internal stage", "@stage_name", "Shareable via grants; most flexible internal option"],
        ["Named external stage", "@stage_name", "Points to external cloud storage, usually via a storage integration"]
      ] },
      { t: "code", lang: "sql", code: "CREATE FILE FORMAT csv_ff TYPE = CSV FIELD_DELIMITER = ',' SKIP_HEADER = 1;\nCREATE STAGE raw_stage FILE_FORMAT = csv_ff;\n-- from a client such as SnowSQL:\nPUT file:///tmp/orders.csv @raw_stage;\nLIST @raw_stage;" },
      { t: "ul", items: ["PUT uploads local files to an internal stage; GET downloads from an internal stage.", "External stages use a storage integration so credentials are not embedded in SQL.", "Supported formats include delimited text, JSON, Avro, ORC, Parquet and XML.", "Compressing files before upload reduces transfer time."] },
      { t: "note", variant: "trap", html: "PUT does not upload to external stages; you place files in your own bucket with your cloud tools, then reference them through the external stage." },
      { t: "note", variant: "key", html: "User @~, table @%t, named @s; internal stages take PUT, external stages point at your bucket through an integration." }
    ], [
      Q("Which reference points to the stage that belongs to a specific table?", "@%orders", ["@~", "@orders_stage only", "@@orders"], "Table stages use the @% prefix followed by the table name. @~ is the current user's stage."),
      Q("How should files be uploaded from a laptop into an internal named stage?", "With PUT from a client such as SnowSQL", ["With COPY INTO from the laptop path directly", "With GET", "By attaching the file to a SELECT"], "PUT uploads local files to an internal stage. COPY then loads staged files into a table."),
      Q("What is the recommended way for an external stage to access a private cloud bucket?", "A storage integration referenced by the stage", ["Hardcoded access keys in the stage definition shared in scripts", "Making the bucket public", "A user stage"], "Storage integrations delegate access through cloud identity without embedding secrets in stage definitions."),
      Q("Which object describes delimiter, header rows and compression for loading?", "A file format", ["A sequence", "A pipe", "A resource monitor"], "File formats encode parsing options and can be attached to stages or specified in COPY."),
      Q("A stage needs to be shared by several users and roles for loading many tables. Which stage type fits?", "A named internal stage with appropriate grants", ["Each user's @~ stage", "A table stage for one table", "A temporary table"], "Named stages are securable objects that can be granted to roles, unlike user stages."),
      Q("How do files get into an external stage?", "They are written to the underlying cloud bucket with that cloud's tools or services", ["With PUT to the external stage", "With COPY INTO @external from a local file", "They are created automatically by queries"], "External stages reference storage you own. Files are placed there outside of PUT, which works only for internal stages.")
    ]),

    L("copy-into", "Bulk loading with COPY INTO", "Load options, error handling, validation and file sizing.", 10, ["copy", "loading"], [
      { t: "p", html: "COPY INTO reads staged files in parallel using a warehouse. It records which files it loaded, so rerunning the same command skips files already loaded unless you force a reload. That load history is why reruns are safe." },
      { t: "code", lang: "sql", code: "COPY INTO orders\n  FROM @raw_stage/orders/\n  FILE_FORMAT = (FORMAT_NAME = csv_ff)\n  PATTERN = '.*[.]csv[.]gz'\n  ON_ERROR = 'SKIP_FILE';" },
      { t: "table", headers: ["Option", "Effect"], rows: [
        ["ON_ERROR = ABORT_STATEMENT", "Stop on first error (default for bulk COPY)"],
        ["ON_ERROR = CONTINUE", "Load good rows, skip bad rows"],
        ["ON_ERROR = SKIP_FILE", "Skip any file containing errors"],
        ["VALIDATION_MODE", "Check files and return errors without loading"],
        ["FORCE = TRUE", "Reload files even if already loaded (risk of duplicates)"],
        ["PURGE = TRUE", "Remove files from the stage after a successful load"]
      ] },
      { t: "ul", items: ["Many moderately sized compressed files load faster than one huge file, because COPY parallelizes across files.", "Very many tiny files add overhead; batch them where you can.", "Transformations during load (column reordering, casting, simple expressions) are supported in COPY's SELECT form.", "Unloading uses COPY INTO @stage FROM table or query."] },
      { t: "note", variant: "trap", html: "FORCE = TRUE bypasses load history and is a common source of duplicate rows." },
      { t: "note", variant: "key", html: "COPY loads in parallel and remembers loaded files. Choose ON_ERROR deliberately, validate before big loads, and size files for parallelism." }
    ], [
      Q("A nightly COPY is accidentally run twice against the same unchanged files. What is the default outcome?", "Files already loaded are skipped based on load metadata", ["All rows are duplicated", "The second run fails with a syntax error", "The table is truncated first"], "COPY tracks loaded files and skips them on rerun unless FORCE is used, which prevents accidental duplicates."),
      Q("You want to see which rows in staged files would fail, without loading anything. Which option fits?", "VALIDATION_MODE", ["FORCE = TRUE", "PURGE = TRUE", "ON_ERROR = CONTINUE"], "VALIDATION_MODE checks files and returns errors or sample rows without modifying the target table."),
      Q("Some files contain a few malformed rows. The business wants good rows loaded and bad rows skipped. Which ON_ERROR setting fits?", "CONTINUE", ["ABORT_STATEMENT", "SKIP_FILE", "FORCE"], "CONTINUE loads valid rows and skips invalid ones. SKIP_FILE would discard entire files containing any error."),
      Q("Why can loading one single very large file be slower than loading many moderately sized files?", "COPY parallelizes across files, so one file limits parallelism", ["Large files cannot be compressed", "COPY only supports files under 1 MB", "Large files bypass the warehouse"], "Load work is distributed by file. Splitting large data into many reasonably sized files lets the warehouse use more parallel threads."),
      Q("What does FORCE = TRUE do in COPY INTO?", "Reloads files regardless of load history, which can create duplicates", ["Ignores all parsing errors", "Converts the table to transient", "Encrypts the staged files"], "FORCE bypasses the load metadata check. Use it deliberately, for example after truncating the target."),
      Q("Which command exports query results to files in a stage?", "COPY INTO @stage FROM (SELECT ...)", ["PUT @stage FROM table", "GET table INTO @stage", "INSERT INTO @stage VALUES"], "Unloading uses COPY INTO a stage location from a table or query. PUT and GET move files between a client and an internal stage.")
    ]),

    L("continuous-loading", "Snowpipe, streams and tasks", "Continuous ingestion and change processing pipelines.", 10, ["snowpipe", "streams", "tasks"], [
      { t: "p", html: "Bulk COPY runs when you call it. <strong>Snowpipe</strong> runs COPY for you as files arrive, on serverless compute. <strong>Streams</strong> record row changes on a table since the last time you consumed them. <strong>Tasks</strong> run SQL on a schedule or after another task. Together they form simple ELT pipelines without an external scheduler." },
      { t: "table", headers: ["Feature", "Trigger", "Compute"], rows: [
        ["Snowpipe", "Cloud event notification or REST call when files land", "Serverless, billed for usage"],
        ["Stream", "Not a trigger; tracks inserts, updates, deletes since its offset", "None by itself"],
        ["Task", "Schedule, or predecessor task in a graph", "A warehouse or serverless compute"],
        ["Dynamic table", "Declarative target freshness (lag)", "Managed refresh"]
      ] },
      { t: "code", lang: "sql", code: "CREATE STREAM orders_stream ON TABLE raw_orders;\nCREATE TASK merge_orders WAREHOUSE = etl_wh SCHEDULE = '5 MINUTE'\n  WHEN SYSTEM$STREAM_HAS_DATA('orders_stream')\nAS MERGE INTO orders o USING orders_stream s ON o.id = s.id\n   WHEN MATCHED THEN UPDATE SET o.status = s.status\n   WHEN NOT MATCHED THEN INSERT (id, status) VALUES (s.id, s.status);" },
      { t: "ul", items: ["Consuming a stream in a DML statement advances its offset when the transaction commits.", "Tasks are created suspended; resume them to start the schedule.", "A WHEN condition on stream data avoids running a warehouse when there is nothing to do.", "Snowpipe suits a steady trickle of files; bulk COPY suits large scheduled batches."] },
      { t: "note", variant: "trap", html: "A SELECT on a stream does not advance its offset; only DML that consumes it inside a committed transaction does." },
      { t: "note", variant: "key", html: "Snowpipe ingests files continuously, streams capture changes, tasks schedule the processing. Resume tasks and guard them with stream-has-data checks." }
    ], [
      Q("Files arrive in a bucket every few minutes and should load automatically with no warehouse to manage. What fits best?", "Snowpipe with auto-ingest from cloud event notifications", ["A manual COPY run by an analyst", "A materialized view on the bucket", "A temporary table"], "Snowpipe loads files as they arrive using serverless compute, triggered by event notifications."),
      Q("What does a stream on a table provide?", "A record of row-level changes since the stream's current offset", ["A copy of the table at a fixed time", "A schedule for running SQL", "A file format for loading"], "Streams track inserts, updates and deletes so downstream processing can handle only what changed."),
      Q("A task was created with a schedule but never runs. What is a likely reason?", "Tasks are created in a suspended state and must be resumed", ["Tasks run only on the first day of each month", "Tasks require Fail-safe to be disabled", "Tasks cannot reference warehouses"], "New tasks start suspended. ALTER TASK ... RESUME activates the schedule."),
      Q("How do you avoid spending warehouse credits when a scheduled task has no new changes to process?", "Add a WHEN condition that checks whether the stream has data", ["Set the schedule to every second", "Use a larger warehouse", "Disable the stream"], "A WHEN SYSTEM$STREAM_HAS_DATA check lets the task skip runs when there is nothing to process."),
      Q("When does a stream's offset advance?", "When a DML statement that consumes the stream commits", ["Every time anyone selects from it", "Every hour automatically", "Only when the table is dropped"], "Offsets move forward only on committed DML consumption, which lets pipelines process each change once."),
      Q("Which choice fits a large nightly batch of files better than Snowpipe?", "Scheduled bulk COPY on a warehouse", ["A stream on the stage", "A secure view", "A reader account"], "Large scheduled batches suit bulk COPY on a sized warehouse; Snowpipe shines for continuous trickles.")
    ]),

    L("semi-structured", "Semi-structured data", "VARIANT, path notation, FLATTEN and when to extract columns.", 9, ["variant", "json"], [
      { t: "p", html: "Semi-structured data such as JSON loads into a <strong>VARIANT</strong> column and stays queryable. The service stores frequently occurring paths in a columnar way internally, so queries on common fields can still prune and perform reasonably." },
      { t: "code", lang: "sql", code: "SELECT v:customer.name::string AS customer,\n       f.value:sku::string     AS sku\nFROM raw_events,\n     LATERAL FLATTEN(input => v:items) f\nWHERE v:type::string = 'order';" },
      { t: "table", headers: ["Tool", "Use"], rows: [
        ["v:path.to.field", "Navigate objects (colon then dots)"],
        ["v:items[0]", "Index into arrays"],
        ["::type", "Cast to a SQL type"],
        ["FLATTEN", "Explode an array or object into rows"],
        ["PARSE_JSON", "Turn a string into VARIANT"],
        ["OBJECT_CONSTRUCT / ARRAY_AGG", "Build semi-structured values"]
      ] },
      { t: "ul", items: ["Field names in path notation are case-sensitive.", "Extract fields you filter and join on frequently into typed columns for clarity and performance.", "NULL in JSON and SQL NULL are different values; handle both deliberately.", "Parquet, Avro and ORC can be loaded into VARIANT or mapped to columns."] },
      { t: "note", variant: "trap", html: "Forgetting to cast (for example <code class='tok'>::string</code>) leaves values as VARIANT, which can produce quoted strings and surprising comparisons." },
      { t: "note", variant: "key", html: "Load into VARIANT, navigate with colon-dot paths, cast explicitly, FLATTEN arrays, and promote hot fields to typed columns." }
    ], [
      Q("Which data type stores JSON documents so they remain queryable with path notation?", "VARIANT", ["VARCHAR(16)", "BINARY", "GEOGRAPHY"], "VARIANT holds semi-structured values and supports path navigation and casting."),
      Q("Each order document has an array of items. How do you return one row per item?", "LATERAL FLATTEN on the items array", ["PARSE_JSON on the whole table", "A clustering key on the array", "COPY INTO with FORCE"], "FLATTEN explodes array elements into rows, which pairs naturally with LATERAL joins."),
      Q("A query compares v:status to the string 'shipped' but returns unexpected results. What is a common fix?", "Cast the path explicitly, for example v:status::string", ["Disable Time Travel", "Use a larger warehouse", "Store the JSON in BINARY"], "Without a cast, values remain VARIANT. Explicit casts make comparisons behave as SQL types."),
      Q("Which statement about path notation is correct?", "Field names are case-sensitive", ["Field names are always uppercased", "Paths cannot index arrays", "Paths only work on Parquet"], "JSON keys are matched exactly, so v:Customer and v:customer are different paths."),
      Q("Analysts filter and join on customer_id inside the JSON in almost every query. What is a reasonable improvement?", "Extract customer_id into a typed column", ["Convert the table to temporary", "Turn off pruning", "Store the JSON in an external stage only"], "Promoting frequently used fields to typed columns makes queries simpler and helps pruning and joins."),
      Q("Which function converts a JSON string into a VARIANT value?", "PARSE_JSON", ["FLATTEN", "TO_DATE", "ARRAY_SIZE"], "PARSE_JSON parses text into VARIANT. FLATTEN explodes arrays and objects into rows.")
    ])
  ];

  var protect = [
    L("time-travel-failsafe", "Time Travel and Fail-safe", "Query and restore the past; know where self-service ends.", 9, ["time-travel", "fail-safe"], [
      { t: "p", html: "Changes create new micro-partitions while old ones are retained for a period. <strong>Time Travel</strong> lets you query, clone or restore data as of an earlier point within the retention window. After that, permanent objects enter <strong>Fail-safe</strong>, a further recovery period available only through vendor support, intended for disasters rather than routine restores." },
      { t: "widget", id: "suTimeTravel" },
      { t: "code", lang: "sql", code: "SELECT * FROM orders AT(OFFSET => -60*30);           -- 30 minutes ago\nSELECT * FROM orders BEFORE(STATEMENT => '<query_id>');\nCREATE TABLE orders_fix CLONE orders AT(TIMESTAMP => '2026-10-01 09:00'::timestamp_ltz);\nUNDROP TABLE orders;" },
      { t: "ul", items: ["Retention is set with DATA_RETENTION_TIME_IN_DAYS at account, database, schema or table level.", "The default is typically one day; longer retention on permanent objects depends on edition.", "Transient and temporary tables have no Fail-safe and at most a short Time Travel window.", "Longer retention means more storage for changed data."] },
      { t: "note", variant: "trap", html: "Fail-safe is not something you query. If a question says <em>the user recovers the data themselves</em>, the answer is Time Travel, not Fail-safe." },
      { t: "note", variant: "key", html: "Time Travel: self-service AT/BEFORE, CLONE and UNDROP within retention. Fail-safe: vendor-assisted, permanent objects only, after Time Travel ends." }
    ], [
      Q("A table was dropped by mistake an hour ago and its retention is one day. What is the quickest recovery?", "UNDROP TABLE", ["Open a support case for Fail-safe", "Reload all historical files", "Create a new reader account"], "Within the Time Travel window, UNDROP restores the dropped table directly."),
      Q("Who can recover data from Fail-safe?", "Only the vendor's support, as a best-effort disaster recovery", ["Any user with SELECT on the table", "The table owner with UNDROP", "Any role using AT(OFFSET)"], "Fail-safe is not self-service. It exists for disaster scenarios after Time Travel has expired."),
      Q("A bad UPDATE ran 20 minutes ago. How can you see the table as it was just before that statement?", "Query with BEFORE(STATEMENT => the update's query ID)", ["Query Fail-safe", "Use FLATTEN", "Resume the warehouse"], "Time Travel can reference a statement's query ID to read data as it existed just before that statement ran."),
      Q("Which table type has no Fail-safe period?", "Transient", ["Permanent", "Permanent with 90-day retention", "Any table in a production database"], "Transient and temporary tables skip Fail-safe, which lowers storage cost but reduces recoverability."),
      Q("What is a cost effect of increasing Time Travel retention on a frequently updated table?", "More storage for retained historical micro-partitions", ["Higher warehouse credits per query", "Loss of the result cache", "Slower authentication"], "Retained versions of changed data are stored for the full window, increasing storage."),
      Q("Which parameter controls the Time Travel window for an object?", "DATA_RETENTION_TIME_IN_DAYS", ["AUTO_SUSPEND", "MAX_CLUSTER_COUNT", "STATEMENT_TIMEOUT_IN_SECONDS"], "DATA_RETENTION_TIME_IN_DAYS sets retention and can be defined at several levels of the hierarchy.")
    ]),

    L("cloning", "Zero-copy cloning", "Instant copies that share storage until they diverge.", 8, ["cloning"], [
      { t: "p", html: "A clone is a new object whose metadata points at the source's existing micro-partitions. Nothing is copied at creation, so clones are fast and initially add no storage. When either side changes, only the changed micro-partitions become new storage." },
      { t: "ul", items: ["Clone databases, schemas and tables; cloning a container clones its child objects.", "Combine with Time Travel to clone an object as of a past point.", "Clones are independent: changes to the clone do not affect the source and vice versa.", "Use clones for dev/test copies of production, safe experiments, and point-in-time snapshots before risky changes."] },
      { t: "code", lang: "sql", code: "CREATE DATABASE dev_db CLONE prod_db;\nCREATE TABLE orders_before_fix CLONE orders;" },
      { t: "compare", bad: { title: "CREATE TABLE AS SELECT copy", items: ["Physically copies data", "Takes time and warehouse credits", "Doubles storage immediately"] }, good: { title: "Clone", items: ["Metadata operation, near-instant", "No storage until changes diverge", "Supports point-in-time with Time Travel"] } },
      { t: "note", variant: "trap", html: "Grants on the source object itself are not automatically carried to the new clone; check privileges after cloning, especially for the top-level object." },
      { t: "note", variant: "key", html: "Clones share micro-partitions until changed: instant, storage-efficient, independent, and combinable with Time Travel." }
    ], [
      Q("A team needs a full copy of a 50 TB production database for testing, quickly and without doubling storage. What should they do?", "Create a zero-copy clone of the database", ["Run CREATE TABLE AS SELECT for every table", "Unload to files and reload", "Create a reader account"], "Cloning is a metadata operation that shares existing storage, so it is fast and adds storage only as data changes."),
      Q("After cloning a table, a developer deletes half the rows in the clone. What happens to the source?", "Nothing; the clone and source are independent", ["The same rows are deleted from the source", "The source becomes read-only", "The source loses its Time Travel history"], "Clones are independent objects. Changes create new micro-partitions for the clone only."),
      Q("When does a clone start consuming additional storage?", "When data in the clone or the source changes and new micro-partitions are written", ["Immediately, at full size", "Only after 24 hours", "Never"], "Shared micro-partitions are not duplicated. Storage grows only for changed data."),
      Q("How can you create a copy of a table as it existed yesterday at 09:00, within retention?", "CLONE with an AT(TIMESTAMP => ...) clause", ["UNDROP with a timestamp", "COPY INTO with FORCE", "A materialized view with a timestamp"], "Cloning combines with Time Travel to produce a point-in-time copy."),
      Q("What should you check after cloning a schema for a new team?", "That the right roles have privileges on the new objects", ["That Fail-safe is disabled", "That the warehouse was resized", "That the clone is a secure view"], "Privilege handling differs between the cloned container and its children, so verify access rather than assuming it matches the source."),
      Q("Why is cloning a good step before a risky bulk update?", "It gives an instant fallback copy without duplicating storage up front", ["It speeds up the update", "It disables Time Travel", "It locks the source table"], "A pre-change clone is a cheap, immediate safety net in addition to Time Travel.")
    ]),

    L("sharing", "Secure data sharing and replication", "Share live data without copies; replicate for other regions.", 9, ["sharing", "replication"], [
      { t: "p", html: "With secure data sharing, a provider grants access to selected objects through a <strong>share</strong>. The consumer creates a read-only database from it. <strong>No data is copied</strong>; the consumer queries the provider's storage using the consumer's own warehouse." },
      { t: "table", headers: ["Scenario", "Mechanism"], rows: [
        ["Consumer has its own account in the same region", "Direct share"],
        ["Consumer has no account", "Reader account created and paid for by the provider"],
        ["Publish data to many consumers, discoverable", "Listings (private or public marketplace)"],
        ["Consumer in a different region or cloud", "Replicate to an account there, then share"]
      ] },
      { t: "ul", items: ["Shared data is read-only to consumers.", "Views in shares must be secure views (or equivalent secured objects).", "Consumers pay for their own compute; providers pay for storage.", "Database replication and failover groups support business continuity across regions."] },
      { t: "note", variant: "trap", html: "A reader account's compute is billed to the provider, because the consumer has no account of its own." },
      { t: "note", variant: "key", html: "Shares give live, read-only, copy-free access; consumers bring compute; reader accounts make the provider pay; cross-region means replicate first." }
    ], [
      Q("A provider shares a table with a consumer account. Who pays for the compute when the consumer queries it?", "The consumer, using its own warehouse", ["The provider, always", "Nobody; shared queries are free", "The cloud provider"], "Consumers query shared data with their own warehouses, so they pay for that compute. Providers pay for storage."),
      Q("A partner has no account and needs read access to some tables. What fits?", "A reader account created by the provider", ["A direct share to a nonexistent account", "Emailing CSV exports daily", "Granting the partner ACCOUNTADMIN"], "Reader accounts let the provider give access to consumers without their own accounts; the provider pays the compute."),
      Q("What can a consumer do with a database created from a share?", "Query it read-only", ["Insert and update rows", "Drop the provider's tables", "Change the provider's clustering keys"], "Shared objects are read-only for consumers."),
      Q("Why must views included in a share be secure views?", "To hide definitions and prevent optimizations that could expose underlying data", ["Because standard views cannot be queried", "Because secure views are faster", "Because shares support only temporary tables"], "Secure views protect the logic and filtered data of the provider when exposed to other accounts."),
      Q("A consumer is in a different cloud region from the provider. What is typically required?", "Replicate the data to an account in that region, then share from there", ["Nothing; shares work across any region directly", "Use a temporary table", "Enable Fail-safe"], "Direct sharing works within a region; cross-region access uses replication first."),
      Q("Which statement about sharing storage is correct?", "Data is not copied to the consumer when it is shared", ["Shares duplicate all data into the consumer account", "Shares copy data nightly", "Shares require unloading to a stage"], "Sharing grants access to the provider's existing storage, so consumers see live data without copies.")
    ])
  ];

  var govern = [
    L("rbac", "Access control: roles, ownership and grants", "System roles, custom role hierarchies and future grants.", 10, ["rbac", "security"], [
      { t: "p", html: "Access is role-based: privileges go to roles, roles go to users (and to other roles). Every object has an <strong>owner role</strong> with full control. A role inherits all privileges of roles granted to it, so hierarchies roll power upward." },
      { t: "widget", id: "suRoleTree" },
      { t: "table", headers: ["System role", "Typical purpose"], rows: [
        ["ACCOUNTADMIN", "Top-level; billing and account settings; use sparingly with MFA"],
        ["SECURITYADMIN", "Manage grants globally; owns USERADMIN capabilities"],
        ["USERADMIN", "Create and manage users and roles"],
        ["SYSADMIN", "Create warehouses and databases; parent for custom roles"],
        ["PUBLIC", "Granted to every user automatically"]
      ] },
      { t: "ul", items: ["Grant custom roles to SYSADMIN so administrators can manage the objects they create.", "Future grants apply privileges automatically to objects created later in a schema or database.", "Use a dedicated role per function (loader, transformer, analyst) rather than granting to users directly.", "Secondary roles can let a session use privileges from more than one role."] },
      { t: "code", lang: "sql", code: "CREATE ROLE analyst;\nGRANT USAGE ON WAREHOUSE bi_wh TO ROLE analyst;\nGRANT USAGE ON DATABASE sales TO ROLE analyst;\nGRANT USAGE ON SCHEMA sales.mart TO ROLE analyst;\nGRANT SELECT ON FUTURE TABLES IN SCHEMA sales.mart TO ROLE analyst;\nGRANT ROLE analyst TO ROLE sysadmin;" },
      { t: "note", variant: "trap", html: "SELECT on a table is useless without USAGE on its database and schema (and a warehouse to run on). Missing USAGE is a classic cause of mysterious permission errors." },
      { t: "note", variant: "key", html: "Privileges go to roles, roles roll up; custom roles report to SYSADMIN; remember USAGE on the containers and future grants for new objects." }
    ], [
      Q("An analyst role has SELECT on a table but gets an error that the schema does not exist or is not authorized. What is missing?", "USAGE on the database and schema", ["OWNERSHIP of the warehouse", "ACCOUNTADMIN", "A clustering key"], "Accessing an object requires USAGE on its containing database and schema in addition to the object privilege."),
      Q("New tables created every day in a schema must be readable by the analyst role without manual grants. What should you use?", "Future grants on the schema", ["A daily manual GRANT script run by a person", "Granting ACCOUNTADMIN to analysts", "Transient tables"], "Future grants automatically apply privileges to objects created later in the specified container."),
      Q("Which system role is intended to create users and roles?", "USERADMIN", ["SYSADMIN", "PUBLIC", "ORGADMIN only"], "USERADMIN is dedicated to user and role management. SECURITYADMIN inherits it and can also manage grants globally."),
      Q("Why should custom roles be granted to SYSADMIN?", "So system administrators inherit and can manage objects owned by those roles", ["So custom roles can see billing", "So custom roles bypass MFA", "Because it is required for login"], "Rolling custom roles up to SYSADMIN keeps the hierarchy manageable and avoids orphaned objects that only one role can control."),
      Q("Which role is granted to every user automatically?", "PUBLIC", ["SYSADMIN", "SECURITYADMIN", "ACCOUNTADMIN"], "Every user and role has PUBLIC, so anything granted to PUBLIC is available to everyone."),
      Q("What is a recommended practice for the ACCOUNTADMIN role?", "Assign it to few users, protect them with MFA, and avoid using it for daily work", ["Make it the default role for all developers", "Grant it to PUBLIC", "Use it for scheduled ETL jobs"], "ACCOUNTADMIN is the most powerful role. Limiting and protecting it reduces risk.")
    ]),

    L("governance-features", "Data governance and account security", "Masking, row access, network rules, authentication and encryption.", 9, ["governance", "security"], [
      { t: "p", html: "Governance features let one table serve many audiences safely. A <strong>masking policy</strong> rewrites a column's value at query time based on context such as the current role. A <strong>row access policy</strong> filters which rows a context can see. Both live as schema-level objects and attach to tables or views." },
      { t: "code", lang: "sql", code: "CREATE MASKING POLICY email_mask AS (val STRING) RETURNS STRING ->\n  CASE WHEN CURRENT_ROLE() IN ('PII_READER') THEN val ELSE '***MASKED***' END;\nALTER TABLE customers MODIFY COLUMN email SET MASKING POLICY email_mask;" },
      { t: "table", headers: ["Control", "Protects against"], rows: [
        ["Masking policy (column level)", "Sensitive values seen by roles that do not need them"],
        ["Row access policy", "Rows outside a user's region, tenant or team"],
        ["Network policy or rules", "Logins from unapproved IP ranges"],
        ["MFA, key-pair auth, SSO", "Credential theft and weak passwords"],
        ["Object tagging and classification", "Losing track of where sensitive data lives"],
        ["Access history", "Not knowing who read or changed which data"]
      ] },
      { t: "ul", items: ["Data is encrypted at rest and in transit by default with a hierarchical key model and periodic key rotation.", "Customer-managed key options exist on higher tiers for additional control.", "Several governance features require higher editions; verify before designing around them.", "Service users for pipelines should use key-pair or similar non-password authentication."] },
      { t: "note", variant: "tip", html: "Policies apply wherever the column or table is used, including through views, so you write the rule once instead of in every view." },
      { t: "note", variant: "key", html: "Masking hides values, row access hides rows, network policies limit where logins come from, and strong authentication protects identities." }
    ], [
      Q("Support staff should see customer emails masked while a privacy team sees full values, using the same table. What fits?", "A masking policy on the email column based on role", ["Two copies of the table", "A transient table for support", "A larger warehouse for the privacy team"], "Masking policies evaluate context at query time, so one table can return masked or clear values per role."),
      Q("Regional managers must see only rows for their own region in a shared sales table. What fits?", "A row access policy", ["A masking policy on every column", "A secure view per manager hardcoded by name", "Fail-safe"], "Row access policies filter rows based on context and a mapping, centralizing the rule instead of creating many views."),
      Q("Logins must be allowed only from the corporate IP ranges. What should you configure?", "A network policy (or network rules) for the account or users", ["A clustering key on the users table", "A resource monitor", "A stream"], "Network policies restrict the IP addresses allowed to connect."),
      Q("Which statement about encryption is correct?", "Data is encrypted at rest and in transit by default", ["Encryption must be enabled per table manually", "Only Fail-safe data is encrypted", "Encryption is available only for external tables"], "End-to-end encryption is on by default, with a hierarchical key model."),
      Q("A service account for an ETL tool should not rely on a password. What is a stronger option?", "Key-pair authentication", ["Sharing an administrator's password", "Disabling authentication for the IP range", "Using the PUBLIC role"], "Key-pair authentication avoids static passwords for programmatic access."),
      Q("Auditors ask who read a sensitive column last month. Which capability helps answer that?", "Access history", ["Result cache", "Clustering information", "Query acceleration"], "Access history records which objects and columns queries read or wrote, supporting audits.")
    ]),

    L("cost-monitoring", "Cost control and usage monitoring", "Resource monitors, usage views and the habits that keep credits in check.", 8, ["cost", "monitoring"], [
      { t: "p", html: "Credits are spent by running warehouses and serverless features. <strong>Resource monitors</strong> watch warehouse credit usage against a quota and can notify or suspend. Usage views let you see where credits went." },
      { t: "table", headers: ["Source", "Latency", "Retention", "Best for"], rows: [
        ["INFORMATION_SCHEMA views and table functions", "Near real time", "Short window", "Recent activity in one database"],
        ["ACCOUNT_USAGE views (shared database)", "Some delay", "Long window (about a year)", "Account-wide history and trend analysis"]
      ] },
      { t: "ul", items: ["Resource monitor actions: notify, suspend after running queries finish, or suspend immediately.", "Monitors can be assigned to the account or to individual warehouses.", "Serverless features (for example Snowpipe or automatic clustering) are tracked separately from warehouse monitors.", "Habits: auto-suspend, right-size, separate warehouses per workload, statement timeouts."] },
      { t: "code", lang: "sql", code: "CREATE RESOURCE MONITOR bi_monthly WITH CREDIT_QUOTA = 500\n  TRIGGERS ON 80 PERCENT DO NOTIFY\n           ON 100 PERCENT DO SUSPEND;\nALTER WAREHOUSE bi_wh SET RESOURCE_MONITOR = bi_monthly;" },
      { t: "note", variant: "trap", html: "Resource monitors cap warehouse credits; they do not cap storage costs or every serverless feature." },
      { t: "note", variant: "key", html: "Use resource monitors to notify and suspend, ACCOUNT_USAGE for history, INFORMATION_SCHEMA for recent detail, and good warehouse habits for prevention." }
    ], [
      Q("Finance wants an alert at 80 percent of a warehouse's monthly credit budget and automatic suspension at 100 percent. What should you use?", "A resource monitor with notify and suspend triggers", ["A masking policy", "A stream on the warehouse", "A larger auto-suspend value"], "Resource monitors track credit usage against a quota and can notify or suspend at thresholds."),
      Q("You need to analyze warehouse credit usage trends over the past several months across the account. Where should you look?", "ACCOUNT_USAGE views", ["INFORMATION_SCHEMA in one database", "The result cache", "A temporary table"], "ACCOUNT_USAGE provides account-wide history with long retention, though with some latency."),
      Q("Which data source is better for seeing queries from the last few minutes with minimal delay?", "INFORMATION_SCHEMA table functions", ["ACCOUNT_USAGE views", "Fail-safe", "The marketplace"], "INFORMATION_SCHEMA reflects recent activity with little latency but has shorter retention."),
      Q("What does a resource monitor not control?", "Storage costs", ["Warehouse credit consumption", "Suspension of assigned warehouses", "Notifications at thresholds"], "Monitors watch compute credits for warehouses. Storage is billed separately."),
      Q("A runaway query keeps a warehouse busy for hours. Which setting limits how long a statement can run?", "STATEMENT_TIMEOUT_IN_SECONDS", ["DATA_RETENTION_TIME_IN_DAYS", "MIN_CLUSTER_COUNT", "SKIP_HEADER"], "A statement timeout cancels queries that exceed a set duration, protecting budgets."),
      Q("Which suspend action lets currently running queries finish before stopping the warehouse?", "Suspend", ["Suspend immediately", "Notify only", "Drop warehouse"], "The standard suspend action waits for running statements to complete; suspend immediately cancels them.")
    ])
  ];

  window.QUIZZES = Object.assign(window.QUIZZES || {}, QZ);

  window.SUMMIT_CARDS = (window.SUMMIT_CARDS || []).concat([
    { front: "Three layers", back: "Storage (shared micro-partitions), compute (virtual warehouses), cloud services (optimizer, metadata, security).", track: TID },
    { front: "Pruning", back: "Skipping micro-partitions whose min/max metadata cannot match the filter.", track: TID },
    { front: "Clustering key: when?", back: "Very large tables with selective, repeated filters; reclustering costs credits.", track: TID },
    { front: "Scale up vs scale out", back: "Up (bigger size) for complex queries and spilling; out (more clusters) for concurrency and queuing.", track: TID },
    { front: "Result cache", back: "Identical query, unchanged data: reused result with no running warehouse needed.", track: TID },
    { front: "Local disk cache", back: "Recently read files on a running warehouse; lost on suspend.", track: TID },
    { front: "Stage references", back: "@~ user stage, @%table table stage, @name named stage.", track: TID },
    { front: "COPY load history", back: "Already-loaded files are skipped on rerun unless FORCE = TRUE.", track: TID },
    { front: "Stream", back: "Tracks row changes since its offset; offset advances when consuming DML commits.", track: TID },
    { front: "Task basics", back: "Runs SQL on a schedule or after a predecessor; created suspended, must be resumed.", track: TID },
    { front: "Time Travel vs Fail-safe", back: "Time Travel: self-service within retention. Fail-safe: vendor-assisted, permanent objects only.", track: TID },
    { front: "Zero-copy clone", back: "Metadata copy sharing micro-partitions until either side changes.", track: TID },
    { front: "Who pays in sharing?", back: "Consumer pays compute; provider pays storage; provider pays for reader accounts.", track: TID },
    { front: "USAGE privilege", back: "Needed on the database and schema before object privileges work.", track: TID },
    { front: "Resource monitor", back: "Credit quota on warehouses with notify / suspend / suspend immediately actions.", track: TID }
  ]);

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.snow = {
    id: "snow",
    name: "SnowPro Core",
    short: "SNOW",
    tagline: "Architecture, performance, loading, protection, governance",
    color: "#38bdf8",
    blurb: "Concept-level prep for the core platform certification: the three-layer architecture, micro-partitions, warehouses and caching, loading pipelines, semi-structured data, Time Travel, cloning, sharing, access control and cost monitoring. Unofficial; verify current objectives.",
    modules: [
      { id: "arch", name: "Architecture and objects", icon: "blocks", lessons: arch },
      { id: "perf", name: "Warehouses and performance", icon: "bolt", lessons: perf },
      { id: "load", name: "Loading and transforming", icon: "queue", lessons: load },
      { id: "protect", name: "Data protection and sharing", icon: "shield", lessons: protect },
      { id: "govern", name: "Access, governance and cost", icon: "diamond", lessons: govern }
    ]
  };
})();
