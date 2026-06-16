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
    blurb: "Run pipelines reliably: DAGs and schedulers, Airflow operators and sensors, idempotent retries and backfills, data quality testing and contracts, lineage and observability, incident response, plus governance, PII and FinOps for data.",
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
            id: "cost", title: "Cost optimization (FinOps for data)",
            summary: "Analytics bills scale with bytes scanned and compute running \u2014 control both.",
            minutes: 6, tags: ["cost", "finops"],
            blocks: [
              { t: "p", html: "Cloud analytics costs track two things: <strong>compute</strong> (warehouse time / slots) and <strong>bytes scanned</strong>. <strong>FinOps for data</strong> is the discipline of keeping both in check without throttling the business." },
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
