/* =====================================================================
   GLACIER · Platform, Continuity & Ecosystem
   window.TRACKS.plat — modules: continuity / ecosystem / operate

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Feature availability varies by edition, cloud
   and region and changes between releases; the lessons say so where it
   matters and teach the durable concepts.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }

  function segment(pairs, initialIdx, onPick) {
    var seg = h("div", { class: "w-seg" });
    var btns = [];
    for (var i = 0; i < pairs.length; i++) {
      (function (pair, idx) {
        var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
        b.addEventListener("click", function () {
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
          b.classList.add("active");
          onPick(pair[0]);
        });
        btns.push(b);
        seg.appendChild(b);
      })(pairs[i], i);
    }
    return seg;
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function num(v, fallback) { var n = Number(v); return isFinite(n) ? n : fallback; }

  function slider(label, min, max, step, initial, suffix, onChange) {
    var out = h("b", {}, String(initial) + (suffix || ""));
    var input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(initial), "aria-label": label });
    input.addEventListener("input", function () {
      var v = num(input.value, initial);
      out.textContent = String(v) + (suffix || "");
      onChange(v);
    });
    return h("label", { class: "w-field" }, h("span", {}, label + " "), input, out);
  }

  function picker(label, pairs, initialIdx, onChange) {
    var sel = h("select", { "aria-label": label });
    for (var i = 0; i < pairs.length; i++) {
      var o = h("option", { value: String(pairs[i][0]) }, pairs[i][1]);
      if (i === initialIdx) o.setAttribute("selected", "selected");
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () { onChange(sel.value); });
    return h("label", { class: "w-field" }, h("span", {}, label + " "), sel);
  }

  function badge(text, hex) {
    return h("span", {
      style: "display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600;border:1px solid var(--line);" +
        "background:color-mix(in srgb, " + hex + " 22%, transparent);color:var(--text)"
    }, text);
  }

  function card(title, body) {
    return h("div", { style: "border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface-2);color:var(--text)" },
      h("div", { style: "font-weight:600;margin-bottom:4px" }, title),
      h("div", { style: "font-size:0.84rem;color:var(--text-dim);line-height:1.5" }, body));
  }

  var Widgets = {};

  /* ==================================================================
     1. failoverLab — RPO / RTO for a failover group drill
  ================================================================== */
  Widgets.failoverLab = function (mount) {
    shell(mount, "business continuity", "Failover drill: what do you lose, and for how long?",
      "Set the replication schedule and how clients find Snowflake, then trigger a regional outage. The readout shows the worst-case data loss window (RPO) and a rough time to recovery (RTO).");
    var schedule = 10, redirect = "connection", runbook = "rehearsed";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var rpo = schedule;
      var refreshTail = Math.max(1, Math.round(schedule * 0.2));
      var rtoClients = redirect === "connection" ? 5 : 90;
      var rtoPeople = runbook === "rehearsed" ? 10 : 120;
      var rto = rtoClients + rtoPeople;
      var credits = schedule <= 5 ? "high" : (schedule <= 30 ? "moderate" : "low");
      clear(stage);
      stage.appendChild(h("div", { style: "display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))" },
        card("Primary account (region A)", "Writes land here. A failover group bundles databases, roles, users, warehouses and integrations, and refreshes the secondary every " + schedule + " minutes."),
        card("Secondary account (region B)", "Read-only replica, up to " + rpo + " minutes behind at the moment of the outage, plus roughly " + refreshTail + " minutes if a refresh was mid-flight."),
        card("Clients", redirect === "connection"
          ? "Apps use a connection URL. One ALTER CONNECTION ... PRIMARY in region B repoints them, with no config change in the apps."
          : "Apps hardcode the primary account hostname. Every tool, driver and secret must be edited and redeployed to point at region B.")));
      clear(readout);
      readout.appendChild(ro("RPO (worst case)", "~" + rpo + " min"));
      readout.appendChild(ro("RTO (rough)", "~" + rto + " min"));
      readout.appendChild(ro("refresh cost", credits));
      readout.appendChild(ro("client cutover", redirect === "connection" ? "client redirect" : "manual reconfig"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      slider("Replication schedule", 1, 120, 1, schedule, " min", function (v) { schedule = v; paint(); }),
      picker("Clients connect via", [["connection", "Connection URL (client redirect)"], ["account", "Primary account hostname"]], 0, function (v) { redirect = v; paint(); }),
      segment([["rehearsed", "Runbook rehearsed"], ["never", "Never tested"]], 0, function (v) { runbook = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. lockLab — two concurrent sessions on one table
  ================================================================== */
  var LOCK_STMTS = [
    ["insert", "INSERT new rows"],
    ["copy", "COPY INTO (new files)"],
    ["update", "UPDATE some rows"],
    ["merge", "MERGE batch"],
    ["delete", "DELETE some rows"],
    ["select", "SELECT"]
  ];

  function lockOutcome(a, b, kind) {
    if (a === "select" || b === "select") return ["Runs concurrently", "#34d399", "Reads never wait for writers; a SELECT sees the last committed version of each partition."];
    var appendA = a === "insert" || a === "copy";
    var appendB = b === "insert" || b === "copy";
    if (appendA && appendB) return ["Runs concurrently", "#34d399", "Pure appends write new micro-partitions and do not block each other."];
    if (kind === "hybrid") return ["Concurrent unless the same rows", "#34d399", "Hybrid tables lock individual rows, so writers touching different primary keys proceed in parallel. Writers on the same key queue."];
    if (appendA || appendB) return ["Usually concurrent", "#fbbf24", "Inserts generally proceed alongside an UPDATE, DELETE or MERGE, but the modifying statement still holds its lock until commit."];
    return ["B waits for A to commit", "#fb7185", "On a standard table, UPDATE, DELETE and MERGE take a lock that blocks other modifying statements on the same table until the first transaction commits or rolls back. B waits up to LOCK_TIMEOUT, then fails."];
  }

  Widgets.lockLab = function (mount) {
    shell(mount, "concurrency", "Two sessions, one table: who waits?",
      "Pick what session A and session B run at the same moment, and whether the table is a standard or a hybrid table.");
    var a = "merge", b = "update", kind = "standard";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var r = lockOutcome(a, b, kind);
      clear(stage);
      stage.appendChild(h("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px" },
        badge("A: " + a.toUpperCase(), "#67e8f9"), badge("B: " + b.toUpperCase(), "#a78bfa"), badge(r[0], r[1])));
      stage.appendChild(h("p", { style: "margin:0;color:var(--text)" }, r[2]));
      clear(readout);
      readout.appendChild(ro("table", kind === "hybrid" ? "hybrid (row locks)" : "standard (table-level DML locks)"));
      readout.appendChild(ro("session A", a));
      readout.appendChild(ro("session B", b));
      readout.appendChild(ro("outcome", r[0]));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      picker("Session A", LOCK_STMTS, 3, function (v) { a = v; paint(); }),
      picker("Session B", LOCK_STMTS, 2, function (v) { b = v; paint(); }),
      segment([["standard", "Standard table"], ["hybrid", "Hybrid table"]], 0, function (v) { kind = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "plat-continuity": {
      title: "Business continuity checkpoint",
      sub: "Editions, organisations, replication, failover groups and client redirect.",
      questions: [
        { q: "Your DR design needs automatic client cutover and promotable secondaries for databases, roles and warehouses. What edition baseline does that usually imply?",
          options: ["Standard is enough for everything", "Business Critical or higher, for failover groups and client redirect", "Enterprise, because multi-cluster warehouses are required", "No edition supports it; DR is a support ticket"], answer: 1,
          explain: "Read-only database replication is broadly available, but promoting a secondary with failover groups and redirecting clients through a connection object are Business Critical features. Check the current edition matrix before you design around them. Pricing per credit also rises with the edition, so scope which accounts truly need it." },
        { q: "What is the main difference between a replication group and a failover group?",
          options: ["Replication groups copy data; failover groups copy only roles", "Failover groups are refreshed manually; replication groups are scheduled", "Both replicate a set of objects, but only a failover group's secondary can be promoted to primary", "Replication groups work across clouds; failover groups do not"], answer: 2,
          explain: "Both bundle objects and refresh them to target accounts as one consistent unit. A replication group's secondaries stay read-only, which suits read scale-out or migrations. A failover group adds the ability to make a secondary the new primary during an outage." },
        { q: "A failover group refreshes every 30 minutes. Region A fails 25 minutes after the last refresh completed. What is the data-loss exposure after failover?",
          options: ["About the last 25 minutes of committed writes in region A", "Nothing; replication is synchronous", "Exactly 30 minutes, regardless of timing", "All data since the group was created"], answer: 0,
          explain: "Replication is asynchronous and point-in-time: the secondary holds the state as of the last completed refresh. Everything committed after that is not in region B. Your RPO is roughly the schedule interval plus any refresh duration, so set the schedule from the business RPO." },
        { q: "Why do teams point applications at a connection URL rather than an account URL?",
          options: ["Connection URLs are faster", "Connection URLs bypass network policies", "Connection URLs are free while account URLs are billed", "Promoting the connection in the secondary account repoints every client without changing app config"], answer: 3,
          explain: "A connection object has primary and secondary copies in different accounts, and its URL follows whichever is primary. One ALTER CONNECTION ... PRIMARY in the DR account moves all clients. Without it, every driver, BI tool and secret has to be edited during the outage." },
        { q: "Which role creates accounts and views organisation-wide usage?",
          options: ["ACCOUNTADMIN in any account", "ORGADMIN (or the organisation-level administrator role)", "SECURITYADMIN", "SYSADMIN"], answer: 1,
          explain: "Organisation administration, such as creating accounts, enabling replication between them and reading ORGANIZATION_USAGE, belongs to the organisation-level role. Account-level ACCOUNTADMIN sees only its own account. Keep that role in very few hands." },
        { q: "During a DR test you promote the secondary, then run your nightly loads there. What is easy to forget?",
          options: ["Secondary databases need to be cloned first", "Warehouses never replicate", "Tasks and pipes in the old secondary start suspended or need resuming, and failback needs its own planned refresh", "Time Travel is disabled after failover"], answer: 2,
          explain: "Scheduled objects do not run in a read-only secondary, so after promotion you have to confirm which tasks and pipes are resumed. Failing back is a second planned failover in the other direction, with its own refresh. Rehearsing both directions is what turns a design into a runbook." }
      ]
    },
    "plat-ecosystem": {
      title: "Sharing and app ecosystem checkpoint",
      sub: "Marketplace listings, clean rooms, Native Apps, Snowpark Container Services and hybrid tables.",
      questions: [
        { q: "A consumer in another region wants your listing. What makes this work without you building pipelines?",
          options: ["The consumer copies the data with COPY INTO", "Listings can be auto-fulfilled to other regions, which replicates the shared data for you", "Shares only work in one region, so it cannot be done", "You must create a reader account in their region"], answer: 1,
          explain: "Direct shares are same-region, but listings support cross-cloud auto-fulfilment, which replicates the product to the consumer's region behind the scenes. You pay for the replication and storage in the remote region. It removes the need for hand-built replication of shared data." },
        { q: "What does an aggregation policy enforce in a clean-room style collaboration?",
          options: ["That queries return only aggregated groups of at least a minimum size", "That data is encrypted with a customer key", "That only one role can read the table", "That results are cached for 24 hours"], answer: 0,
          explain: "An aggregation policy forces queries to aggregate and suppresses groups below a minimum size, so a partner cannot single out individual records. Projection policies complement it by stopping a column from appearing in output while still allowing joins on it. Together they let two parties overlap audiences without exposing rows." },
        { q: "What runs where with a Snowflake Native App?",
          options: ["The app runs in the provider's account and queries the consumer's data remotely", "The consumer downloads source code and runs it locally", "The app installs in the consumer's account, runs on the consumer's compute next to their data, and the provider's logic stays hidden", "It runs in a separate cloud outside Snowflake"], answer: 2,
          explain: "The consumer installs an application from the provider's application package, so their data never leaves their account. The setup script creates objects and application roles that the consumer grants as they choose. The provider ships versions and patches without seeing consumer data unless the consumer shares it." },
        { q: "A Snowpark Container Services pilot shows a steady bill although nobody calls the service. Why?",
          options: ["Container images are billed per pull", "Services bill per HTTP request only, so this must be a metering error", "The image repository charges a licence fee", "The compute pool's nodes are billed while they are running, whether or not the service is busy"], answer: 3,
          explain: "Compute pools are billed per node for the time they are active. A service with MIN_NODES of 1 keeps a node up all day. Suspend the pool or set auto-suspend for idle pilots, and size MIN_NODES from real traffic." },
        { q: "Which workload fits a hybrid table best?",
          options: ["Scanning two years of clickstream for a dashboard", "A high-concurrency app doing single-row lookups and updates by primary key, with enforced uniqueness", "Bulk-loading parquet files once a day", "Storing large semi-structured log archives"], answer: 1,
          explain: "Hybrid tables keep a row store with an enforced primary key, secondary indexes and row-level locking, so small point reads and writes are fast and concurrent. Big analytical scans still belong on standard columnar tables. Many designs pair them: hybrid for app state, standard for analytics." },
        { q: "A hybrid table is created without a PRIMARY KEY. What happens?",
          options: ["It fails: hybrid tables require a primary key, and it is enforced", "Snowflake adds a hidden surrogate key", "It is created as a standard table instead", "It works, but row locking is disabled"], answer: 0,
          explain: "Unlike standard tables, where PRIMARY KEY is informational, a hybrid table requires one and enforces it, along with UNIQUE and FOREIGN KEY constraints. Duplicate keys raise errors at write time. That enforcement is a big reason to choose hybrid tables for operational data." }
      ]
    },
    "plat-operate": {
      title: "Operating the platform checkpoint",
      sub: "Transactions and locks, query history and tags, integrations, alerts and orchestration.",
      questions: [
        { q: "Inside an explicit BEGIN ... COMMIT block you run INSERT, then CREATE TABLE, then another INSERT, and finally ROLLBACK. What survives?",
          options: ["Nothing; ROLLBACK undoes everything since BEGIN", "Only the CREATE TABLE", "The first INSERT and the CREATE TABLE, because DDL commits the open transaction; only the second INSERT is rolled back", "Everything; ROLLBACK is ignored after DDL"], answer: 2,
          explain: "A DDL statement commits any open transaction before it runs and executes in its own transaction. So the first INSERT is committed by the CREATE, and only the work after it is still open when ROLLBACK runs. Keep DDL out of transactional blocks, or run it first." },
        { q: "Two scheduled MERGE jobs target the same standard table at the same time. What do you expect?",
          options: ["Both run in parallel at row level", "The second waits for the first to commit, up to LOCK_TIMEOUT, and fails if the lock is not released in time", "The second silently overwrites the first", "Snowflake merges both into one statement"], answer: 1,
          explain: "Modifying statements like UPDATE, DELETE and MERGE lock the standard table against other modifiers until commit. The second job queues and can time out. Stagger schedules, merge in one job, or use hybrid tables when you truly need row-level concurrency." },
        { q: "You want cost and runtime per dbt model and per Airflow DAG run. What is the lightest way to get it?",
          options: ["Give every job its own warehouse", "Parse SQL text in QUERY_HISTORY for model names", "Ask each team to log their own timings", "Set QUERY_TAG per session (for example JSON with dag_id, task_id, run_id, model) and group ACCOUNT_USAGE query and attribution history by it"], answer: 3,
          explain: "QUERY_TAG travels with every query, so history views can be grouped by it without changing the SQL. JSON tags let you parse several keys. Separate warehouses work too, but they cost idle time and complicate sizing." },
        { q: "You need queries from the last hour, including ones that finished seconds ago. Which source should you query?",
          options: ["INFORMATION_SCHEMA.QUERY_HISTORY table functions, which have little latency but a short window", "SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY, which is real-time", "ORGANIZATION_USAGE, which has the lowest latency", "Neither; you must enable query logging first"], answer: 0,
          explain: "The INFORMATION_SCHEMA table functions return recent history almost immediately but only for a few days and only for objects your role can see. ACCOUNT_USAGE keeps a year of history but can lag by tens of minutes. Use the first for live triage and the second for trends and chargeback." },
        { q: "Your storage integration was created, but COPY from the bucket fails with an access error. What is the usual missing step?",
          options: ["Granting OWNERSHIP on the bucket to Snowflake", "Running DESC INTEGRATION and adding the Snowflake-side principal and external id to the cloud role's trust policy", "Putting the cloud access key into the stage definition", "Re-creating the integration with a different name"], answer: 1,
          explain: "The integration names a cloud role, but the cloud side must also trust the identity Snowflake uses. DESC INTEGRATION shows that principal and the external id to paste into the trust policy. Keys in stage definitions are exactly what integrations exist to avoid." },
        { q: "An alert checks every 15 minutes for failed loads using WHERE end_time > DATEADD(minute, -15, CURRENT_TIMESTAMP()). Sometimes a failure is missed. What is the fix?",
          options: ["Run the alert every minute", "Use a bigger warehouse for the alert", "Use the scheduled-time functions so each run checks from the last successful run's scheduled time to this run's", "Switch the alert to a task"], answer: 2,
          explain: "Alert runs do not start at exact instants, so fixed look-back windows leave gaps or overlaps. Bounding the window between the last successful scheduled time and the current scheduled time covers every moment exactly once. It also stops duplicate notifications after a delayed run." }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.plat = {
    id: "plat",
    name: "Platform, Continuity & Ecosystem",
    short: "PLAT",
    tagline: "Run Snowflake like a platform, not a database",
    color: "#93c5fd",
    blurb: "The account-level view. Choose editions and regions, structure an organisation, and design replication and failover with client redirect so an outage is a runbook, not a crisis. Tour the ecosystem: Marketplace listings, clean rooms, Native Apps, Snowpark Container Services and hybrid tables. Then operate it day to day: transactions and locks, query history and tags, integrations and external functions, alerts, and orchestration with Airflow and dbt.",
    modules: [
      {
        id: "continuity",
        name: "Business Continuity",
        icon: "globe",
        lessons: [
          /* ---------------------------------------------------------- */
          {
            id: "editions-regions",
            title: "Editions, regions and the organisation",
            summary: "What each edition unlocks, how cloud and region choices constrain you, and how an organisation of accounts is structured and administered.",
            minutes: 10,
            tags: ["editions", "regions", "organisation", "orgadmin"],
            blocks: [
              { t: "p", html: "Hold this picture: an <strong>organisation</strong> is a folder of <strong>accounts</strong>, and each account lives in exactly one cloud and one region. Everything you build (databases, warehouses, roles) lives inside one account. The edition you choose per account decides which features exist there and what a credit costs." },
              { t: "h", text: "Editions in one table" },
              { t: "table", headers: ["Edition", "Adds (beyond the one above)", "Typical reason to pick it"], rows: [
                ["Standard", "Core warehouse, sharing, 1-day Time Travel, read-only replication", "Small teams, non-regulated analytics"],
                ["Enterprise", "Multi-cluster warehouses, up to 90-day Time Travel, materialized views, search optimization, masking and row access policies, tags", "Most production analytics platforms"],
                ["Business Critical", "Customer-managed key options (Tri-Secret Secure), private connectivity, compliance support for regulated data, failover groups and client redirect", "Regulated data, hard DR requirements"],
                ["Virtual Private Snowflake", "A dedicated, isolated deployment", "Highest isolation requirements"]
              ] },
              { t: "note", variant: "warn", html: "The exact feature-per-edition split moves between releases. Treat this table as the shape, and confirm the current matrix before you promise a feature to a stakeholder." },
              { t: "h", text: "Cloud and region are real constraints" },
              { t: "ul", items: [
                "<strong>Latency and egress:</strong> put the account next to the bulk of its data and its heaviest consumers. Cross-region and cross-cloud transfer is billed.",
                "<strong>Feature availability:</strong> some features arrive in certain clouds and regions first (for example, hybrid tables and some Cortex models). Check before choosing a region for a new workload.",
                "<strong>Data residency:</strong> regulated data may have to stay in a jurisdiction, which pins the region.",
                "<strong>Direct shares are same-region:</strong> sharing to another region needs replication or listing auto-fulfilment."
              ] },
              { t: "h", text: "Organisation administration" },
              { t: "code", lang: "sql", code:
                "USE ROLE ORGADMIN;\n" +
                "SHOW ORGANIZATION ACCOUNTS;\n\n" +
                "-- create a DR account in a second region (names are illustrative)\n" +
                "CREATE ACCOUNT analytics_dr\n" +
                "  ADMIN_NAME = dr_admin\n" +
                "  ADMIN_RSA_PUBLIC_KEY = '<PUBLIC_KEY_PEM_BODY>'\n" +
                "  EMAIL = 'platform-team@company.example'\n" +
                "  EDITION = BUSINESS_CRITICAL\n" +
                "  REGION = <TARGET_REGION_ID>;\n\n" +
                "-- organisation-wide spend\n" +
                "SELECT account_name, usage_date, SUM(usage_in_currency) AS spend\n" +
                "FROM SNOWFLAKE.ORGANIZATION_USAGE.USAGE_IN_CURRENCY_DAILY\n" +
                "GROUP BY 1, 2 ORDER BY 2 DESC, 3 DESC;" },
              { t: "p", html: "Accounts are addressed by an <strong>organisation-qualified identifier</strong> (<code class='tok'>&lt;org_name&gt;-&lt;account_name&gt;</code>), which is stable when you move or rename things, unlike legacy locator-based identifiers. Use it in connection configs, injected from environment variables rather than written into code." },
              { t: "h", text: "Account per environment, or database per environment?" },
              { t: "compare",
                bad: { title: "Database per environment in one account", items: ["Cheap and simple to start", "One set of roles must separate DEV from PRD carefully", "One account-level mistake (network policy, parameter) hits every environment"] },
                good: { title: "Account per environment (or per tier)", items: ["Hard blast-radius boundary between PRD and everything else", "Account parameters and policies can differ per tier", "Costs more administration; replication or clones move data between them"] } },
              { t: "p", html: "Many platforms land in the middle: one production account, one non-production account holding DEV, test and STG databases. Whatever you choose, keep database and account names as deploy-time parameters so the same scripts run everywhere." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"which edition do we need\", \"can we put this in another region\", \"separate prod from dev\", \"see spend across all accounts\". Answer with the edition matrix, region constraints, and the organisation layer." },
              { t: "note", variant: "key", html: "<strong>Organisation holds accounts; each account is one cloud, one region and one edition.</strong> Choose the edition by required features, the region by data and consumers, and the account split by the blast radius you can tolerate." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "replication-failover",
            title: "Replication, failover groups and client redirect",
            summary: "Design cross-region disaster recovery: what replicates, how often, how a secondary is promoted, and how clients follow it.",
            minutes: 13,
            tags: ["replication", "failover", "dr", "rpo", "rto"],
            blocks: [
              { t: "p", html: "Hold this picture: a <strong>group</strong> is a bundle of account objects that is copied, as one consistent snapshot, from a primary account to one or more secondary accounts on a schedule. Secondaries are read-only. For a <strong>failover group</strong> you can flip which side is primary, and a <strong>connection</strong> object moves your clients with it." },
              { t: "diagram", id: "sf-failover", caption: "A failover group refreshes the secondary on a schedule; during an outage the secondary is promoted and the connection URL follows it." },
              { t: "h", text: "Replication group vs failover group" },
              { t: "table", headers: ["", "Replication group", "Failover group"], rows: [
                ["Contents", "Databases, shares and other account objects you list", "The same, typically plus users, roles, warehouses, integrations, network policies and parameters"],
                ["Secondary", "Read-only, forever", "Read-only until promoted with <code class='tok'>ALTER FAILOVER GROUP ... PRIMARY</code>"],
                ["Use for", "Read scale-out in another region, migrations, sharing to distant consumers", "Disaster recovery and planned region moves"],
                ["Edition", "Broadly available", "Business Critical or higher"]
              ] },
              { t: "h", text: "Setting it up" },
              { t: "code", lang: "sql", code:
                "-- in the primary account\n" +
                "CREATE FAILOVER GROUP prod_fg\n" +
                "  OBJECT_TYPES = USERS, ROLES, WAREHOUSES, RESOURCE MONITORS,\n" +
                "                DATABASES, INTEGRATIONS, NETWORK POLICIES\n" +
                "  ALLOWED_DATABASES = sales_db, finance_db\n" +
                "  ALLOWED_INTEGRATION_TYPES = STORAGE INTEGRATIONS, NOTIFICATION INTEGRATIONS\n" +
                "  ALLOWED_ACCOUNTS = <org_name>.<dr_account>\n" +
                "  REPLICATION_SCHEDULE = '10 MINUTE';\n\n" +
                "-- in the DR account\n" +
                "CREATE FAILOVER GROUP prod_fg AS REPLICA OF <org_name>.<primary_account>.prod_fg;\n" +
                "ALTER FAILOVER GROUP prod_fg REFRESH;   -- first full copy\n\n" +
                "-- monitor\n" +
                "SELECT * FROM TABLE(INFORMATION_SCHEMA.REPLICATION_GROUP_REFRESH_HISTORY('prod_fg'));" },
              { t: "h", text: "Client redirect" },
              { t: "code", lang: "sql", code:
                "-- primary account\n" +
                "CREATE CONNECTION prod_conn;\n" +
                "ALTER CONNECTION prod_conn ENABLE FAILOVER TO ACCOUNTS <org_name>.<dr_account>;\n\n" +
                "-- DR account\n" +
                "CREATE CONNECTION prod_conn AS REPLICA OF <org_name>.<primary_account>.prod_conn;\n\n" +
                "-- during an outage, in the DR account\n" +
                "ALTER FAILOVER GROUP prod_fg PRIMARY;\n" +
                "ALTER CONNECTION prod_conn PRIMARY;" },
              { t: "p", html: "Apps, BI tools and pipelines connect to the <strong>connection URL</strong> (built from the organisation and connection names), never to an individual account. Promotion repoints that URL. Store it in configuration, injected per environment, with credentials from a secrets manager." },
              { t: "widget", id: "failoverLab" },
              { t: "h", text: "RPO and RTO in practice" },
              { t: "ul", items: [
                "<strong>RPO</strong> (data you can lose) is roughly the refresh schedule plus refresh duration. Replication is asynchronous, so writes after the last completed refresh are not in the secondary.",
                "<strong>RTO</strong> (time to recover) is mostly people and clients: noticing, deciding, promoting, resuming tasks and pipes, and repointing anything not on a connection URL.",
                "<strong>Cost:</strong> refreshes use serverless compute and cross-region data transfer, and the secondary stores a full copy. Shorter schedules cost more."
              ] },
              { t: "note", variant: "trap", html: "Not everything behaves identically after failover. Tasks and pipes need resuming in the new primary, external stages must point at storage that is reachable from the DR region, and some object types have replication limitations. Write these into the runbook and rehearse it, including failback." },
              { t: "note", variant: "tip", html: "Tie the schedule to a written RPO, and alert on refresh history: a group that silently stopped refreshing is worse than none, because you believe you are covered." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"what if the region goes down\", \"DR plan\", \"RPO/RTO\", \"move to another region\", \"apps should not change config\". Reach for failover groups plus a connection object, sized by RPO." },
              { t: "quiz", id: "plat-continuity" },
              { t: "note", variant: "key", html: "<strong>Groups replicate a consistent bundle on a schedule; failover groups can be promoted; connections move clients.</strong> Set the schedule from the RPO, put clients on the connection URL, and rehearse the runbook both ways." }
            ]
          }
        ]
      },
      {
        id: "ecosystem",
        name: "Sharing & App Ecosystem",
        icon: "share",
        lessons: [
          /* ---------------------------------------------------------- */
          {
            id: "marketplace-cleanrooms",
            title: "Marketplace, listings and data clean rooms",
            summary: "Package shared data as listings, reach other regions with auto-fulfilment, and collaborate on overlapping data without exposing rows.",
            minutes: 11,
            tags: ["marketplace", "listings", "clean rooms", "aggregation policy"],
            blocks: [
              { t: "p", html: "Hold this picture: a <strong>share</strong> is the plumbing (grants on objects that another account can mount read-only), and a <strong>listing</strong> is the product wrapped around it: a description, sample queries, terms, optional pricing, and the ability to reach consumers in other regions. A <strong>clean room</strong> goes one step further: both parties keep their data, and only agreed, aggregated questions can be asked across it." },
              { t: "h", text: "Listing types" },
              { t: "table", headers: ["Type", "Audience", "Typical use"], rows: [
                ["Private listing", "Named consumer accounts", "Partner and inter-company data products, internal data mesh"],
                ["Public Marketplace listing (free)", "Anyone browsing the Marketplace", "Reference data, open datasets, product samples"],
                ["Public listing (paid or personalised)", "Consumers who request or buy access", "Commercial data products"]
              ] },
              { t: "ul", items: [
                "<strong>Auto-fulfilment</strong> replicates the listing's data to other regions or clouds on a refresh schedule, so you do not hand-build replication per consumer. You pay for that compute, transfer and remote storage.",
                "<strong>Consumers query with their own warehouses.</strong> Providers pay for storage; consumers pay for compute.",
                "<strong>Secure views and secure UDFs</strong> keep implementation logic and unshared columns hidden. Shares never expose more than you grant."
              ] },
              { t: "h", text: "Clean rooms: collaborate without revealing rows" },
              { t: "p", html: "A classic case: an advertiser and a publisher want to know how many customers they have in common by segment, without either seeing the other's customer list. The clean room enforces what can be asked. Snowflake offers a managed clean room product built on Native Apps, but the building blocks are policies you can use directly." },
              { t: "code", lang: "sql", code:
                "-- results must aggregate at least 50 rows per group\n" +
                "CREATE AGGREGATION POLICY min_group_50\n" +
                "  AS () RETURNS AGGREGATION_CONSTRAINT ->\n" +
                "  AGGREGATION_CONSTRAINT(MIN_GROUP_SIZE => 50);\n" +
                "ALTER TABLE customers_shared SET AGGREGATION POLICY min_group_50;\n\n" +
                "-- the join key may be used to match, but never returned\n" +
                "CREATE PROJECTION POLICY no_project\n" +
                "  AS () RETURNS PROJECTION_CONSTRAINT ->\n" +
                "  PROJECTION_CONSTRAINT(ALLOW => false);\n" +
                "ALTER TABLE customers_shared MODIFY COLUMN hashed_email\n" +
                "  SET PROJECTION POLICY no_project;" },
              { t: "compare",
                bad: { title: "Exchange extracts", items: ["Raw customer lists leave your control", "Copies go stale and multiply", "No enforcement after the file is sent"] },
                good: { title: "Clean room on shared data", items: ["Data stays in each party's account", "Only approved, aggregated queries return", "Join keys usable but never displayed"] } },
              { t: "note", variant: "warn", html: "Aggregation thresholds reduce re-identification risk but do not eliminate it: many overlapping queries can still leak information. Combine policies with approved query templates, query limits and a legal agreement." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"sell or publish our data\", \"partner in another region\", \"audience overlap without sharing PII\", \"measure campaign reach with a publisher\". Listings for distribution; clean-room policies for joint analysis." },
              { t: "note", variant: "key", html: "<strong>Share is plumbing, listing is product, clean room is controlled collaboration.</strong> Auto-fulfilment reaches other regions, and aggregation plus projection policies let partners join data without seeing rows." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "native-apps-spcs",
            title: "Native Apps and Snowpark Container Services",
            summary: "Ship code into a consumer's account as an app, and run containers next to your data on compute pools. A brief tour of both.",
            minutes: 10,
            tags: ["native apps", "spcs", "containers", "compute pools"],
            blocks: [
              { t: "p", html: "Hold this picture: instead of the consumer sending data to your software, <strong>your software goes to their data</strong>. A Native App is installed inside the consumer's account; Snowpark Container Services (SPCS) lets any account run its own container images inside Snowflake. Both keep data in place and under the account's governance." },
              { t: "h", text: "Native App building blocks" },
              { t: "table", headers: ["Piece", "What it is"], rows: [
                ["Application package", "Provider-side container for versions, the manifest, the setup script and any shared data"],
                ["<code class='tok'>manifest.yml</code>", "Declares the setup script, version label, privileges the app requests and configuration references"],
                ["Setup script", "SQL run at install and upgrade that creates the app's schemas, procedures, UDFs, Streamlit UI and application roles"],
                ["Application roles", "Roles defined by the app that the consumer grants to their own roles to control who can use it"],
                ["Versions and patches", "Released from the package; consumers upgrade on the provider's release directives"]
              ] },
              { t: "code", lang: "sql", code:
                "-- provider\n" +
                "CREATE APPLICATION PACKAGE churn_app_pkg;\n" +
                "ALTER APPLICATION PACKAGE churn_app_pkg\n" +
                "  ADD VERSION v1 USING '@churn_app_pkg.code.stage/v1';\n\n" +
                "-- test install in the provider account\n" +
                "CREATE APPLICATION churn_app FROM APPLICATION PACKAGE churn_app_pkg USING VERSION v1;\n\n" +
                "-- consumer, after installing from a listing\n" +
                "GRANT APPLICATION ROLE churn_app.app_user TO ROLE analyst;" },
              { t: "h", text: "Snowpark Container Services in brief" },
              { t: "ul", items: [
                "<strong>Image repository:</strong> an OCI registry inside a schema; push images with the standard container tooling.",
                "<strong>Compute pool:</strong> a set of nodes of one instance family (CPU or GPU) with MIN_NODES and MAX_NODES. This is what you pay for while it runs.",
                "<strong>Service:</strong> long-running containers defined by a YAML specification, optionally exposing endpoints. <strong>Job services</strong> run to completion.",
                "<strong>Service functions:</strong> SQL functions that call a service endpoint, so a model server can be used from a query.",
                "<strong>Egress</strong> to the internet is off by default; allow specific hosts with an external access integration and network rules."
              ] },
              { t: "code", lang: "sql", code:
                "CREATE COMPUTE POOL inference_pool\n" +
                "  MIN_NODES = 1 MAX_NODES = 3\n" +
                "  INSTANCE_FAMILY = CPU_X64_S\n" +
                "  AUTO_SUSPEND_SECS = 600;\n\n" +
                "CREATE SERVICE scorer\n" +
                "  IN COMPUTE POOL inference_pool\n" +
                "  FROM @specs/scorer.yaml;\n\n" +
                "ALTER COMPUTE POOL inference_pool SUSPEND;   -- stop paying for idle nodes" },
              { t: "table", headers: ["Need", "Reach for"], rows: [
                ["Python or SQL logic over tables", "Snowpark, UDFs, procedures (no containers needed)"],
                ["Custom runtime, GPU model serving, a third-party server binary", "Snowpark Container Services"],
                ["Distribute your product into customers' accounts", "Native App (optionally bundling containers)"]
              ] },
              { t: "note", variant: "trap", html: "A compute pool with MIN_NODES = 1 bills all day even when the service is idle. Set auto-suspend on pilots and size MIN_NODES from measured traffic." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"deploy our product into customer accounts\", \"run this container next to the data\", \"GPU model serving without moving data out\". Native App for distribution, SPCS for custom runtimes." },
              { t: "note", variant: "key", html: "<strong>Native Apps carry provider code into the consumer's account; SPCS runs containers on compute pools inside Snowflake.</strong> Both keep data in place; for SPCS, the pool's running nodes are the bill." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "hybrid-tables",
            title: "Hybrid tables and Unistore",
            summary: "Row-oriented tables with enforced keys and row locks for operational workloads, and where they stop being the right choice.",
            minutes: 9,
            tags: ["hybrid tables", "unistore", "oltp", "constraints"],
            blocks: [
              { t: "p", html: "Hold this picture: standard tables are columnar and built for scanning millions of rows; <strong>hybrid tables</strong> add a row store tuned for fetching or changing <em>one</em> row by key, quickly and concurrently. Unistore is the name for running that operational workload next to analytics in one platform." },
              { t: "code", lang: "sql", code:
                "CREATE HYBRID TABLE app_sessions (\n" +
                "  session_id   VARCHAR PRIMARY KEY,\n" +
                "  user_id      NUMBER NOT NULL,\n" +
                "  status       VARCHAR,\n" +
                "  updated_at   TIMESTAMP_NTZ,\n" +
                "  INDEX idx_user (user_id)\n" +
                ");\n\n" +
                "-- point lookup served by the primary key\n" +
                "SELECT status FROM app_sessions WHERE session_id = :sid;" },
              { t: "table", headers: ["", "Standard table", "Hybrid table"], rows: [
                ["Storage", "Columnar micro-partitions", "Row store, with a columnar copy for analytics"],
                ["PRIMARY KEY / UNIQUE / FK", "Informational, not enforced", "Required primary key; constraints enforced"],
                ["Indexes", "None (pruning plus optional search optimization)", "Secondary indexes"],
                ["Locking", "Table-level for UPDATE/DELETE/MERGE", "Row-level"],
                ["Best at", "Large scans and aggregations", "Point reads and small writes at high concurrency"]
              ] },
              { t: "p", html: "The locking difference is the one that changes application design: on a standard table, two sessions updating different rows still queue behind each other; on a hybrid table they run in parallel unless they touch the same key. The lock lab in the transactions lesson lets you try the combinations." },
              { t: "h", text: "When not to use them" },
              { t: "ul", items: [
                "Large analytical scans and wide aggregations: standard tables remain faster and cheaper.",
                "Bulk loads of large files: load into standard tables.",
                "Workloads needing features with hybrid-table limitations: check the current list for cloning, replication, Time Travel and region availability before committing."
              ] },
              { t: "note", variant: "warn", html: "Hybrid storage is priced differently from standard storage, and operational requests consume warehouse compute. Prove the access pattern with a small pilot first." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"app state in Snowflake\", \"enforce uniqueness\", \"single-row updates are slow and block each other\", \"avoid a separate OLTP database for a small app\". Hybrid tables for the operational slice; standard tables for analytics." },
              { t: "quiz", id: "plat-ecosystem" },
              { t: "note", variant: "key", html: "<strong>Hybrid tables trade scan speed for key lookups, enforced constraints and row locks.</strong> Use them for small, concurrent operational reads and writes, and keep analytics on standard tables." }
            ]
          }
        ]
      },
      {
        id: "operate",
        name: "Operating the Platform",
        icon: "queue",
        lessons: [
          /* ---------------------------------------------------------- */
          {
            id: "transactions-locking",
            title: "Transactions, locking and idempotent loads",
            summary: "Autocommit vs explicit transactions, how DDL ends a transaction, who blocks whom, and load patterns that are safe to rerun.",
            minutes: 12,
            tags: ["transactions", "locking", "merge", "idempotent"],
            blocks: [
              { t: "p", html: "Hold this picture: every statement is its own transaction unless you open one with <code class='tok'>BEGIN</code>. Readers never block writers and always see the last committed state (read committed). Writers that <em>change existing rows</em> on a standard table take a lock that other modifiers must wait for." },
              { t: "h", text: "Rules worth memorising" },
              { t: "ul", items: [
                "<strong>Autocommit is on by default:</strong> each DML commits on success.",
                "<strong>DDL commits implicitly:</strong> a <code class='tok'>CREATE</code>, <code class='tok'>ALTER</code> or <code class='tok'>DROP</code> commits any open transaction first, then runs in its own.",
                "<strong>Errors do not roll back by default:</strong> with <code class='tok'>TRANSACTION_ABORT_ON_ERROR = FALSE</code>, a failed statement leaves earlier statements in the open transaction intact. Handle errors and <code class='tok'>ROLLBACK</code> explicitly.",
                "<strong>Lock waits time out:</strong> a blocked statement waits up to <code class='tok'>LOCK_TIMEOUT</code> seconds (a long default) before failing. Set it lower for jobs that should fail fast.",
                "<strong>Deadlocks are detected:</strong> one participant is aborted; retry it."
              ] },
              { t: "code", lang: "sql", code:
                "ALTER SESSION SET LOCK_TIMEOUT = 300;   -- fail after 5 minutes of waiting\n\n" +
                "BEGIN;\n" +
                "  DELETE FROM fact_sales WHERE load_date = :run_date;\n" +
                "  INSERT INTO fact_sales SELECT * FROM stg_sales WHERE load_date = :run_date;\n" +
                "COMMIT;\n\n" +
                "-- who is holding what\n" +
                "SHOW TRANSACTIONS;\n" +
                "SHOW LOCKS IN ACCOUNT;\n" +
                "-- SELECT SYSTEM$ABORT_TRANSACTION(<transaction_id>);   -- last resort" },
              { t: "widget", id: "lockLab" },
              { t: "h", text: "Idempotent load patterns" },
              { t: "p", html: "Orchestrators retry. A load is <strong>idempotent</strong> when running it twice leaves the same result as running it once. Pick one of these per target:" },
              { t: "table", headers: ["Pattern", "How", "Watch out for"], rows: [
                ["Partition replace", "Delete the run's partition and insert it again, in one transaction", "Keep DDL out of the block; make the partition key come from the run, not CURRENT_DATE"],
                ["Deduplicated MERGE", "Rank source rows per key, keep the latest, then MERGE on the key", "Duplicate keys in the source raise a nondeterministic-merge error"],
                ["COPY load metadata", "COPY skips files already loaded into that table (load history is kept for a limited window)", "FORCE = TRUE or renamed files reload data"],
                ["Batch id column", "Stamp each row with the run id and delete that id before reloading", "Needs every writer to stamp rows"]
              ] },
              { t: "code", lang: "sql", code:
                "MERGE INTO dim_customer t\n" +
                "USING (\n" +
                "  SELECT * FROM stg_customer\n" +
                "  QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY updated_at DESC) = 1\n" +
                ") s\n" +
                "ON t.customer_id = s.customer_id\n" +
                "WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET\n" +
                "  t.name = s.name, t.segment = s.segment, t.updated_at = s.updated_at\n" +
                "WHEN NOT MATCHED THEN INSERT (customer_id, name, segment, updated_at)\n" +
                "  VALUES (s.customer_id, s.name, s.segment, s.updated_at);" },
              { t: "note", variant: "trap", html: "Two jobs merging into the same table on overlapping schedules will queue behind each other, and the slow one can time out. Serialise them with a task graph, or combine them into one MERGE." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"job hangs then fails\", \"rerun created duplicates\", \"rollback did not undo everything\", \"two loads at the same time\". Think transaction boundaries, DDL commits, lock waits, and idempotent patterns." },
              { t: "note", variant: "key", html: "<strong>Each statement autocommits, DDL commits whatever is open, and modifiers lock standard tables until commit.</strong> Make every load idempotent so retries are safe." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "query-history-tags",
            title: "Query history, QUERY_TAG and observability",
            summary: "Where query history lives, how fresh each source is, and how tags turn raw history into per-job cost and performance reporting.",
            minutes: 10,
            tags: ["query history", "query_tag", "observability", "access history"],
            blocks: [
              { t: "p", html: "Hold this picture: every query leaves a row of telemetry (who, what, which warehouse, how long, how much scanned). There are two copies of that telemetry with different trade-offs, and <code class='tok'>QUERY_TAG</code> is the label you attach so you can find your own rows later." },
              { t: "table", headers: ["Source", "Freshness", "Retention", "Use for"], rows: [
                ["<code class='tok'>INFORMATION_SCHEMA.QUERY_HISTORY*()</code> table functions", "Near real-time", "Days", "Live triage of a running or just-failed job"],
                ["<code class='tok'>SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY</code>", "Lags by up to tens of minutes", "About a year", "Trends, tuning, chargeback"],
                ["<code class='tok'>ACCOUNT_USAGE.QUERY_ATTRIBUTION_HISTORY</code>", "Lags", "About a year", "Compute credits attributed per query"],
                ["<code class='tok'>ACCOUNT_USAGE.ACCESS_HISTORY</code>", "Lags", "About a year", "Which columns were read or written: audit and lineage"]
              ] },
              { t: "h", text: "Tag everything automated" },
              { t: "code", lang: "sql", code:
                "-- set by the orchestrator per task run (keep it JSON so it parses)\n" +
                "ALTER SESSION SET QUERY_TAG = '{\"app\":\"airflow\",\"dag\":\"sales_daily\",\"task\":\"merge_orders\",\"run\":\"<run_id>\"}';\n\n" +
                "-- default for a service user\n" +
                "ALTER USER svc_dbt SET QUERY_TAG = '{\"app\":\"dbt\"}';\n\n" +
                "-- cost per DAG over 30 days\n" +
                "SELECT TRY_PARSE_JSON(query_tag):dag::STRING AS dag,\n" +
                "       COUNT(*) AS queries,\n" +
                "       SUM(credits_attributed_compute) AS credits\n" +
                "FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_ATTRIBUTION_HISTORY\n" +
                "WHERE start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "GROUP BY 1 ORDER BY credits DESC NULLS LAST;" },
              { t: "h", text: "Triage recipes" },
              { t: "code", lang: "sql", code:
                "-- the last hour on one warehouse, slowest first\n" +
                "SELECT query_id, user_name, execution_status, total_elapsed_time/1000 AS secs,\n" +
                "       bytes_scanned, query_tag, LEFT(query_text, 120) AS sql_head\n" +
                "FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY_BY_WAREHOUSE(\n" +
                "       WAREHOUSE_NAME => 'ETL_WH',\n" +
                "       END_TIME_RANGE_START => DATEADD(hour, -1, CURRENT_TIMESTAMP())))\n" +
                "ORDER BY total_elapsed_time DESC LIMIT 20;\n\n" +
                "-- reuse the previous statement's output\n" +
                "SELECT * FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));" },
              { t: "ul", items: [
                "<strong>queued_overload_time</strong> high: the warehouse is saturated; consider multi-cluster or separating workloads.",
                "<strong>bytes_spilled_to_remote_storage</strong> non-zero: memory pressure; size up or reduce the data per step.",
                "<strong>partitions_scanned close to partitions_total</strong>: pruning is not working for that filter.",
                "<strong>execution_status = FAILED</strong> with <code class='tok'>error_message</code>: start here for job failures, then open the query profile."
              ] },
              { t: "note", variant: "tip", html: "Session tags override user and account defaults, so set the most specific tag closest to the work. dbt can set a tag per model through its configuration, which makes model-level cost reports a simple GROUP BY." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"which job is expensive\", \"what ran at 3 a.m.\", \"why did the pipeline slow down\", \"who read this column\". Query history plus tags for cost and speed; access history for audit." },
              { t: "note", variant: "key", html: "<strong>INFORMATION_SCHEMA for now, ACCOUNT_USAGE for history, QUERY_TAG to tell your jobs apart.</strong> Tag every automated session with structured JSON, and reports become a GROUP BY." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "integrations",
            title: "Integrations and external functions",
            summary: "Storage, notification, API, external access and security integrations: the account objects that let Snowflake trust and reach other systems without keys in SQL.",
            minutes: 12,
            tags: ["storage integration", "api integration", "external functions", "external access"],
            blocks: [
              { t: "p", html: "Hold this picture: an <strong>integration</strong> is an account-level trust relationship. An administrator creates it once, the cloud side is told to trust Snowflake's identity, and everyone else just references the integration by name. No access keys ever appear in a stage, a pipe or a function definition." },
              { t: "table", headers: ["Integration", "Lets Snowflake...", "Used by"], rows: [
                ["Storage", "Read and write your buckets or containers through a cloud role", "External stages, COPY, unload, external and Iceberg tables"],
                ["Notification (inbound)", "Receive cloud event notifications", "Snowpipe auto-ingest on some clouds, directory table refresh"],
                ["Notification (outbound)", "Send messages to a queue or topic, or email", "Task and pipe error notifications, alerts"],
                ["API", "Call an HTTPS endpoint behind a cloud API gateway", "External functions"],
                ["External access", "Let UDFs and procedures reach specific hosts, with secrets", "Python or Java code calling external APIs"],
                ["Security", "Trust an identity provider", "SSO (SAML), OAuth, SCIM provisioning"]
              ] },
              { t: "h", text: "Storage integration handshake" },
              { t: "code", lang: "sql", code:
                "CREATE STORAGE INTEGRATION lake_int\n" +
                "  TYPE = EXTERNAL_STAGE\n" +
                "  STORAGE_PROVIDER = 'S3'\n" +
                "  ENABLED = TRUE\n" +
                "  STORAGE_AWS_ROLE_ARN = '<CLOUD_ROLE_ARN>'\n" +
                "  STORAGE_ALLOWED_LOCATIONS = ('s3://<bucket>/landing/');\n\n" +
                "DESC INTEGRATION lake_int;   -- copy the Snowflake principal and external id\n" +
                "-- ...add them to the cloud role's trust policy, then:\n" +
                "GRANT USAGE ON INTEGRATION lake_int TO ROLE loader;\n" +
                "CREATE STAGE landing URL = 's3://<bucket>/landing/' STORAGE_INTEGRATION = lake_int;" },
              { t: "h", text: "External functions vs external access" },
              { t: "p", html: "An <strong>external function</strong> is a SQL function whose body is a remote HTTPS service. Snowflake sends rows in batches as JSON through an API gateway, and the service returns one result per row. The newer <strong>external access integration</strong> lets ordinary Python or Java UDFs and procedures call allow-listed hosts directly, with credentials from a Snowflake secret." },
              { t: "code", lang: "sql", code:
                "-- external function through an API gateway\n" +
                "CREATE API INTEGRATION geo_api\n" +
                "  API_PROVIDER = aws_api_gateway\n" +
                "  API_AWS_ROLE_ARN = '<GATEWAY_ROLE_ARN>'\n" +
                "  API_ALLOWED_PREFIXES = ('<GATEWAY_BASE_URL>')\n" +
                "  ENABLED = TRUE;\n\n" +
                "CREATE EXTERNAL FUNCTION geocode(addr VARCHAR)\n" +
                "  RETURNS VARIANT\n" +
                "  API_INTEGRATION = geo_api\n" +
                "  AS '<GATEWAY_BASE_URL>/geocode';\n\n" +
                "-- external access for a Python UDF\n" +
                "CREATE NETWORK RULE geo_egress MODE = EGRESS TYPE = HOST_PORT\n" +
                "  VALUE_LIST = ('geo.api.example:443');\n" +
                "CREATE SECRET geo_key TYPE = GENERIC_STRING SECRET_STRING = '<GEO_API_KEY>';\n" +
                "CREATE EXTERNAL ACCESS INTEGRATION geo_access\n" +
                "  ALLOWED_NETWORK_RULES = (geo_egress)\n" +
                "  ALLOWED_AUTHENTICATION_SECRETS = (geo_key)\n" +
                "  ENABLED = TRUE;" },
              { t: "note", variant: "warn", html: "The secret value is a placeholder here and should come from your secrets pipeline at deploy time, never from a committed script. Remote calls also add latency and per-call cost on the far side; cache results in a table instead of calling per query." },
              { t: "compare",
                bad: { title: "Keys in SQL", items: ["CREDENTIALS = (AWS_KEY_ID = ...) on a stage", "Keys copied into scripts and history", "Rotation means editing many objects"] },
                good: { title: "Integrations", items: ["One trust relationship, owned by admins", "Objects reference it by name", "Scoped by allowed locations, prefixes or hosts"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"load from our bucket securely\", \"call an API from SQL\", \"enrich rows with an external service\", \"get notified when a pipe fails\". Pick the matching integration type, and never put keys in SQL." },
              { t: "note", variant: "key", html: "<strong>Integrations are named trust relationships created once by admins.</strong> Storage for buckets, notification for events and messages, API for external functions, external access for UDF egress, security for identity." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "alerts",
            title: "Alerts and notifications",
            summary: "Scheduled condition checks that act when data says something is wrong, plus error notifications from tasks and pipes.",
            minutes: 9,
            tags: ["alerts", "notifications", "monitoring", "email"],
            blocks: [
              { t: "p", html: "Hold this picture: an <strong>alert</strong> is a scheduled <em>IF this query returns rows THEN do this</em>. The condition is SQL, the action is SQL, and the schedule decides how fast you hear about problems." },
              { t: "code", lang: "sql", code:
                "CREATE NOTIFICATION INTEGRATION ops_email\n" +
                "  TYPE = EMAIL ENABLED = TRUE\n" +
                "  ALLOWED_RECIPIENTS = ('data-oncall@company.example');\n\n" +
                "CREATE ALERT failed_loads_alert\n" +
                "  WAREHOUSE = ops_wh                -- omit for serverless alerts\n" +
                "  SCHEDULE = '15 MINUTE'\n" +
                "  IF (EXISTS (\n" +
                "    SELECT 1\n" +
                "    FROM ops.job_log\n" +
                "    WHERE status = 'ERROR'\n" +
                "      AND end_time >  SNOWFLAKE.ALERT.LAST_SUCCESSFUL_SCHEDULED_TIME()\n" +
                "      AND end_time <= SNOWFLAKE.ALERT.SCHEDULED_TIME()))\n" +
                "  THEN CALL SYSTEM$SEND_EMAIL(\n" +
                "    'ops_email', 'data-oncall@company.example',\n" +
                "    'Load failures detected', 'Check ops.job_log for status = ERROR.');\n\n" +
                "ALTER ALERT failed_loads_alert RESUME;   -- alerts are created suspended\n\n" +
                "SELECT * FROM TABLE(INFORMATION_SCHEMA.ALERT_HISTORY(\n" +
                "  SCHEDULED_TIME_RANGE_START => DATEADD(day, -1, CURRENT_TIMESTAMP())));" },
              { t: "ul", items: [
                "<strong>Window by scheduled times</strong>, as above, so every moment is checked exactly once even when a run starts late.",
                "<strong>Created suspended:</strong> forgetting <code class='tok'>RESUME</code> is the most common reason an alert never fires.",
                "<strong>Recipients must be allowed</strong> by the integration (and typically be verified users of the account).",
                "<strong>Cost:</strong> each check runs a query. A tiny query on a 1-minute schedule on a dedicated warehouse keeps it awake; prefer serverless alerts or a shared small warehouse."
              ] },
              { t: "h", text: "Error notifications from tasks and pipes" },
              { t: "code", lang: "sql", code:
                "CREATE NOTIFICATION INTEGRATION ops_topic\n" +
                "  TYPE = QUEUE DIRECTION = OUTBOUND\n" +
                "  NOTIFICATION_PROVIDER = AWS_SNS\n" +
                "  AWS_SNS_TOPIC_ARN = '<TOPIC_ARN>'\n" +
                "  AWS_SNS_ROLE_ARN = '<CLOUD_ROLE_ARN>'\n" +
                "  ENABLED = TRUE;\n\n" +
                "ALTER TASK merge_orders SET ERROR_INTEGRATION = ops_topic;\n" +
                "ALTER PIPE  orders_pipe SET ERROR_INTEGRATION = ops_topic;" },
              { t: "table", headers: ["Need", "Use"], rows: [
                ["A task or pipe failed", "ERROR_INTEGRATION on the task or pipe"],
                ["A data condition (late data, zero rows, threshold breach)", "Alert with a SQL condition"],
                ["Spend crosses a limit", "Resource monitor notifications, budgets"],
                ["Replication stopped refreshing", "Alert over replication refresh history"]
              ] },
              { t: "note", variant: "tip", html: "Write alert conditions against data outcomes, not only job status: \"yesterday's partition has zero rows\" catches the silent failures that a green job log hides." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"tell us when...\", \"email on failure\", \"page on-call if the table is stale\", \"we found out from the business\". Alert for data conditions, error integrations for task and pipe failures." },
              { t: "note", variant: "key", html: "<strong>An alert is a scheduled IF query THEN action.</strong> Window it by scheduled times, remember RESUME, and pair it with error integrations on tasks and pipes." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "orchestration",
            title: "Orchestrating with Airflow and dbt",
            summary: "When to keep scheduling inside Snowflake and when to use an external orchestrator, and how to run dbt and SQL from Airflow safely.",
            minutes: 12,
            tags: ["airflow", "dbt", "orchestration", "tasks"],
            blocks: [
              { t: "p", html: "Hold this picture: the orchestrator decides <strong>when</strong> and <strong>in what order</strong>; Snowflake does the <strong>work</strong>. Airflow should hand Snowflake a statement or a dbt selection and wait. It should not pull data through its own workers." },
              { t: "table", headers: ["Choose", "When"], rows: [
                ["Snowflake tasks and dynamic tables", "Every step is inside Snowflake; you want serverless scheduling and no extra platform"],
                ["Airflow (or another external orchestrator)", "Steps cross systems: wait for a file, call an API, run dbt, then notify; or the company already runs DAGs centrally"],
                ["Both", "Airflow triggers a Snowflake task graph with EXECUTE TASK and monitors it, keeping the in-database graph simple"]
              ] },
              { t: "h", text: "A small, safe Airflow DAG" },
              { t: "code", lang: "python", code:
                "from airflow import DAG\n" +
                "from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator\n" +
                "from airflow.operators.bash import BashOperator\n" +
                "import pendulum\n\n" +
                "with DAG(\n" +
                "    dag_id=\"sales_daily\",\n" +
                "    start_date=pendulum.datetime(2026, 1, 1, tz=\"UTC\"),\n" +
                "    schedule=\"0 3 * * *\",\n" +
                "    catchup=False,\n" +
                "    default_args={\"retries\": 2},\n" +
                ") as dag:\n" +
                "    load = SQLExecuteQueryOperator(\n" +
                "        task_id=\"load_partition\",\n" +
                "        conn_id=\"snowflake_default\",          # key-pair auth from the secrets backend\n" +
                "        sql=\"CALL ops.load_sales(%(run_date)s)\",\n" +
                "        parameters={\"run_date\": \"{{ ds }}\"},\n" +
                "        hook_params={\"session_parameters\": {\n" +
                "            \"QUERY_TAG\": '{\"dag\":\"sales_daily\",\"run\":\"{{ run_id }}\"}'}},\n" +
                "    )\n" +
                "    models = BashOperator(\n" +
                "        task_id=\"dbt_build\",\n" +
                "        bash_command=\"dbt build --select tag:sales --target \\\"$DBT_TARGET\\\" --vars '{run_date: {{ ds }}}'\",\n" +
                "    )\n" +
                "    load >> models" },
              { t: "note", variant: "warn", html: "Provider package names, operator classes and parameters change between Airflow releases. The durable parts are the pattern: connection from a secrets backend, run date as a parameter, tags per run, and retries that are safe because every step is idempotent." },
              { t: "h", text: "Rules that keep it sane" },
              { t: "ol", items: [
                "<strong>Pass the logical date in;</strong> never use CURRENT_DATE inside the SQL. A backfill for last Tuesday must load last Tuesday.",
                "<strong>Make every step idempotent</strong> (partition replace or deduplicated MERGE), because retries will happen.",
                "<strong>Tag sessions</strong> with DAG, task and run ids so cost and failures trace back to a DAG run.",
                "<strong>No credentials or environment names in DAG code.</strong> Connections come from the secrets backend; database and target names from Airflow variables or environment variables.",
                "<strong>Push work down.</strong> Use stored procedures, dbt or task graphs for heavy SQL; avoid fetching result sets into Airflow workers.",
                "<strong>One owner per schedule.</strong> Do not let an Airflow DAG and a Snowflake task both refresh the same table."
              ] },
              { t: "h", text: "dbt in the picture" },
              { t: "ul", items: [
                "Run dbt from Airflow with a CLI step, a container, or an integration library that renders each model as an Airflow task. Model-level tasks give finer retries; a single <code class='tok'>dbt build</code> step is simpler.",
                "Use dbt's own query tag configuration so every model's queries are attributable.",
                "Profiles read credentials and the target database from environment variables, so the same project runs in DEV, STG and PRD.",
                "dbt can also run inside Snowflake in some setups; the orchestration rules above still apply."
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"Airflow or tasks\", \"backfill a week\", \"rerun created duplicates\", \"which DAG burned the credits\", \"run dbt after the load\". Orchestrator for order and cross-system steps, Snowflake for the work, idempotent steps, tagged sessions." },
              { t: "quiz", id: "plat-operate" },
              { t: "note", variant: "key", html: "<strong>The orchestrator schedules; Snowflake computes.</strong> Pass run dates in, make steps idempotent, tag every session, and keep credentials and environment names out of DAG code." }
            ]
          }
        ]
      }
    ]
  };
})();
