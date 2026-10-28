/* =====================================================================
   GLACIER · Snowpark & Programmability
   window.TRACKS.dev — modules: procs / udfs / snowpark

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
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
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
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

  function labelled(label, control) {
    return h("div", { class: "w-field", style: "display:flex;flex-direction:column;gap:4px" },
      h("span", { style: "font-size:0.78rem;color:var(--text-dim)" }, label), control);
  }

  function chip(text, tone) {
    var fill = tone === "ok" ? "#34d399" : tone === "bad" ? "#f87171" : tone === "warn" ? "#fbbf24" : "#a78bfa";
    return h("span", {
      style: "display:inline-block;padding:5px 10px;border-radius:8px;font-size:0.8rem;font-family:var(--font-mono);" +
        "border:1px solid var(--line);color:var(--text);background:color-mix(in srgb, " + fill + " 22%, transparent)"
    }, text);
  }

  function pre(text) {
    return h("pre", {
      style: "margin:8px 0 0;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);" +
        "color:var(--text);font-family:var(--font-mono);font-size:0.78rem;line-height:1.5;white-space:pre-wrap;overflow-x:auto"
    }, text);
  }

  function lines(arr) { return arr.join("\n"); }

  var Widgets = {};

  /* ==================================================================
     1. rightsLab — what a procedure may do under caller's vs owner's rights
  ================================================================== */
  var RIGHTS_ACTIONS = {
    read: "SELECT from FINANCE.CORE.LEDGER",
    setvar: "SET run_date = CURRENT_DATE()",
    show: "SHOW TABLES IN SCHEMA FINANCE.CORE",
    describe: "DESCRIBE TABLE FINANCE.CORE.LEDGER"
  };

  function decideRights(mode, role, action) {
    var callerHasSelect = role === "ENGINEER";
    if (mode === "owner") {
      if (action === "read") return { verdict: "ALLOWED", tone: "ok", eff: "LEDGER_ADMIN (owner)",
        why: "The statement runs with the owner role's privileges. LEDGER_ADMIN holds SELECT, so the read succeeds even when the caller has nothing but USAGE on the procedure." };
      if (action === "setvar") return { verdict: "BLOCKED", tone: "bad", eff: "LEDGER_ADMIN (owner)",
        why: "Owner's-rights procedures cannot view, set or unset the caller's session variables. The SET fails inside the procedure." };
      return { verdict: "RESTRICTED", tone: "warn", eff: "LEDGER_ADMIN (owner)",
        why: "Caller-specific metadata is limited in an owner's-rights context, and whatever does come back reflects the owner role rather than the caller. Smoke-test the exact SHOW or DESCRIBE you depend on before shipping." };
    }
    if (action === "read") return callerHasSelect
      ? { verdict: "ALLOWED", tone: "ok", eff: role + " (caller)", why: "Caller's rights means the caller's active role (plus any secondary roles) must hold the privilege. ENGINEER has SELECT, so the read works." }
      : { verdict: "BLOCKED", tone: "bad", eff: role + " (caller)", why: "ANALYST has USAGE on the procedure but no SELECT on the table. Under caller's rights the procedure is no more powerful than the person calling it." };
    if (action === "setvar") return { verdict: "ALLOWED", tone: "ok", eff: role + " (caller)",
      why: "Caller's-rights procedures share the caller's session: they can read and set session variables, and the variable is still visible after CALL returns." };
    if (action === "show") return { verdict: callerHasSelect ? "ALLOWED" : "ALLOWED (empty)", tone: callerHasSelect ? "ok" : "warn", eff: role + " (caller)",
      why: callerHasSelect ? "SHOW returns the objects the caller's roles can see; ENGINEER sees LEDGER." : "SHOW succeeds but lists only objects the caller can see. ANALYST holds no privilege on the schema's tables, so the result is empty, not an error." };
    return callerHasSelect
      ? { verdict: "ALLOWED", tone: "ok", eff: role + " (caller)", why: "Any privilege on the table makes it visible to DESCRIBE, and ENGINEER holds SELECT." }
      : { verdict: "BLOCKED", tone: "bad", eff: role + " (caller)", why: "To ANALYST the table effectively does not exist: the error reads 'does not exist or not authorized'." };
  }

  Widgets.rightsLab = function (mount) {
    shell(mount, "simulator", "Caller's vs owner's rights",
      "A procedure owned by LEDGER_ADMIN is granted to two roles. Pick the rights mode, who calls it, and what the body tries to do. The lab says whether the statement runs and whose privileges decide.");
    var mode = "owner", role = "ANALYST", action = "read";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var d = decideRights(mode, role, action);
      clear(stage);
      var path = h("div", { style: "display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:10px" });
      path.appendChild(chip("CALL as " + role, "info"));
      path.appendChild(h("span", { style: "color:var(--text-dim)" }, "\u2192"));
      path.appendChild(chip("EXECUTE AS " + (mode === "owner" ? "OWNER" : "CALLER"), "info"));
      path.appendChild(h("span", { style: "color:var(--text-dim)" }, "\u2192"));
      path.appendChild(chip("privileges of " + d.eff, "info"));
      path.appendChild(h("span", { style: "color:var(--text-dim)" }, "\u2192"));
      path.appendChild(chip(d.verdict, d.tone));
      stage.appendChild(path);
      stage.appendChild(pre(RIGHTS_ACTIONS[action] + ";"));
      stage.appendChild(h("p", { style: "margin:10px 0 0;font-size:0.88rem;line-height:1.55;color:var(--text)" }, d.why));
      clear(readout);
      readout.appendChild(ro("verdict", d.verdict));
      readout.appendChild(ro("privileges from", d.eff));
      readout.appendChild(ro("unqualified names resolve in", mode === "owner" ? "the procedure's database.schema" : "the caller's current database.schema"));
      readout.appendChild(ro("session vars", mode === "owner" ? "invisible to the body" : "shared with caller"));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:12px" },
      labelled("Rights mode", segment([["owner", "Owner's rights"], ["caller", "Caller's rights"]], 0, function (v) { mode = v; paint(); })),
      labelled("Caller role", segment([["ANALYST", "ANALYST (USAGE only)"], ["ENGINEER", "ENGINEER (has SELECT)"]], 0, function (v) { role = v; paint(); })),
      labelled("Statement in the body", segment([["read", "Read table"], ["setvar", "SET session var"], ["show", "SHOW"], ["describe", "DESCRIBE"]], 0, function (v) { action = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. lazyLab — Snowpark transformations are lazy; actions run SQL
  ================================================================== */
  var LAZY_STEPS = [
    { id: "filter", label: "filter()" },
    { id: "select", label: "select()" },
    { id: "join", label: "join()" },
    { id: "group", label: "group_by().agg()" }
  ];
  var LAZY_ACTIONS = [
    ["none", "No action"],
    ["collect", "collect()"],
    ["show", "show()"],
    ["count", "count()"],
    ["twice", "count() then collect()"],
    ["cache", "cache_result() then 2 actions"]
  ];

  function lazyPython(on, act) {
    var out = ['orders = session.table("RAW.ORDERS")'];
    var expr = "orders";
    if (on.join) out.push('customers = session.table("RAW.CUSTOMERS")');
    var chain = [];
    if (on.filter) chain.push('    .filter(col("STATUS") == lit("SHIPPED"))');
    if (on.join) chain.push('    .join(customers, orders["CUSTOMER_ID"] == customers["CUSTOMER_ID"])');
    if (on.group) chain.push('    .group_by(col("REGION"))\n    .agg(sum_(col("AMOUNT")).alias("TOTAL"))');
    else if (on.select) chain.push(on.join ? '    .select(col("ORDER_ID"), col("REGION"), col("AMOUNT"))' : '    .select(col("ORDER_ID"), col("CUSTOMER_ID"), col("AMOUNT"))');
    out.push("df = (" + expr + (chain.length ? "\n" + chain.join("\n") + "\n" : "") + ")");
    if (act === "collect") out.push("rows = df.collect()");
    else if (act === "show") out.push("df.show()");
    else if (act === "count") out.push("n = df.count()");
    else if (act === "twice") out.push("n = df.count()\nrows = df.collect()");
    else if (act === "cache") out.push("snap = df.cache_result()\nn = snap.count()\nrows = snap.collect()");
    else out.push("# no action yet: nothing has been sent to Snowflake");
    return out.join("\n");
  }

  function lazySql(on) {
    var cols = on.group ? "c.REGION, SUM(o.AMOUNT) AS TOTAL"
      : on.select ? (on.join ? "o.ORDER_ID, c.REGION, o.AMOUNT" : "o.ORDER_ID, o.CUSTOMER_ID, o.AMOUNT")
      : "*";
    if (on.group && !on.join) cols = "o.CUSTOMER_ID AS REGION, SUM(o.AMOUNT) AS TOTAL";
    var s = "SELECT " + cols + "\nFROM RAW.ORDERS o";
    if (on.join) s += "\nINNER JOIN RAW.CUSTOMERS c ON o.CUSTOMER_ID = c.CUSTOMER_ID";
    if (on.filter) s += "\nWHERE o.STATUS = 'SHIPPED'";
    if (on.group) s += "\nGROUP BY 1";
    return s;
  }

  Widgets.lazyLab = function (mount) {
    shell(mount, "simulator", "Lazy DataFrame lab",
      "Toggle transformations to build a pipeline, then pick an action. Transformations only grow a query plan on the client; the query count moves only when an action runs.");
    var on = { filter: true, select: true, join: false, group: false };
    var act = "none";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var toggles = h("div", { class: "w-seg" });
    var toggleBtns = {};

    function paint() {
      var steps = 0, i;
      for (i = 0; i < LAZY_STEPS.length; i++) {
        var id = LAZY_STEPS[i].id;
        if (on[id]) steps++;
        if (toggleBtns[id]) toggleBtns[id].className = "w-seg-btn" + (on[id] ? " active" : "");
      }
      var queries = 0, scans = 0, log = [];
      var sql = lazySql(on);
      if (act === "collect") { queries = 1; scans = 1; log.push("Q1  " + "full result set fetched to the client"); }
      else if (act === "show") { queries = 1; scans = 1; log.push("Q1  same SQL wrapped with LIMIT 10"); }
      else if (act === "count") { queries = 1; scans = 1; log.push("Q1  SELECT COUNT(*) FROM ( <plan> )"); }
      else if (act === "twice") { queries = 2; scans = 2; log.push("Q1  SELECT COUNT(*) FROM ( <plan> )"); log.push("Q2  <plan> again: the source is scanned a second time"); }
      else if (act === "cache") { queries = 3; scans = 1; log.push("Q1  CREATE TEMPORARY TABLE ... AS <plan>"); log.push("Q2  COUNT(*) on the temp table"); log.push("Q3  SELECT * from the temp table"); }
      clear(stage);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, "Python (client side)"));
      stage.appendChild(pre(lazyPython(on, act)));
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-top:10px" }, "Approximate shape of the compiled SQL (the real text nests one subquery per step)"));
      stage.appendChild(pre(sql));
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-top:10px" }, "Queries sent to the warehouse"));
      stage.appendChild(pre(log.length ? log.join("\n") : "(none \u2014 the DataFrame is only a plan)"));
      clear(readout);
      readout.appendChild(ro("plan steps", steps));
      readout.appendChild(ro("queries executed", queries));
      readout.appendChild(ro("heavy scans of source", scans));
      readout.appendChild(ro("state", act === "none" ? "lazy (nothing ran)" : "executed"));
    }

    for (var i = 0; i < LAZY_STEPS.length; i++) {
      (function (step) {
        var b = h("button", { type: "button", class: "w-seg-btn" }, step.label);
        b.addEventListener("click", function () { on[step.id] = !on[step.id]; paint(); });
        toggleBtns[step.id] = b;
        toggles.appendChild(b);
      })(LAZY_STEPS[i]);
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:12px" },
      labelled("Transformations (toggle)", toggles),
      labelled("Action", segment(LAZY_ACTIONS, 0, function (v) { act = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     3. Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "dev-procs": {
      title: "Stored procedures checkpoint",
      sub: "Snowflake Scripting, JavaScript and Python procedures, rights models and the pitfalls that hide failures.",
      questions: [
        { q: "Inside a Snowflake Scripting procedure, variable v_tbl holds a table name. Which FROM clause queries that table safely?",
          options: ["FROM v_tbl", "FROM :v_tbl", "FROM IDENTIFIER(:v_tbl)", "FROM $v_tbl"], answer: 2,
          explain: "Inside a SQL statement a scripting variable is referenced with a colon, but a bare :v_tbl is treated as a value, not an object name. IDENTIFIER(:v_tbl) tells the compiler to resolve the string as an identifier. $v_tbl would be a session variable, which is a different namespace entirely." },
        { q: "You create a procedure without an EXECUTE AS clause. Whose privileges does its body run with?",
          options: ["The caller's active role", "The role that owns the procedure", "A restricted caller context", "Whatever the account-level default parameter says"], answer: 1,
          explain: "Owner's rights is the default. That is what makes procedures useful for delegation, and also why an owner's-rights procedure that builds SQL from caller input can become a privilege-escalation path. Choose EXECUTE AS CALLER explicitly when the procedure should be no more powerful than its caller." },
        { q: "CREATE OR REPLACE PROCEDURE for a Snowflake Scripting proc succeeds, but the body references a table that was renamed last week. What happens?",
          options: ["The CREATE would have failed with 'object does not exist'", "Snowflake transparently rewrites the reference to the new name", "The procedure returns NULL without an error", "The procedure fails when that statement actually executes during a CALL"], answer: 3,
          explain: "Creation does not compile the body's statements against the catalog; object names, columns and privileges are resolved when each statement runs. A green deploy therefore proves very little. Follow every deploy with a smoke CALL, or at minimum GET_DDL plus a token check." },
        { q: "A proc's handler is WHEN STATEMENT_ERROR THEN RETURN OBJECT_CONSTRUCT('status','FAILED','msg',SQLERRM). The scheduler shows every run as successful. What is the best fix?",
          options: ["Log SQLCODE, SQLERRM and SQLSTATE to an error table, then RAISE so the CALL itself fails", "Change the return type to VARCHAR so the error text is visible", "Wrap the CALL in another procedure with the same handler", "Remove the handler and add retries in the scheduler"], answer: 0,
          explain: "Returning a value from the handler converts a failure into a successful CALL, so anything that checks the query status sees success. Recording the details and re-raising keeps both the evidence and the failure signal. Removing the handler entirely loses the context you wanted to capture." },
        { q: "An analyst must run a nightly reload into a table they must never write to directly. What is the cleanest design?",
          options: ["Grant INSERT and TRUNCATE on the table to the analyst role", "Make the analyst role inherit the loader role", "An owner's-rights procedure owned by the loader role, with USAGE on the procedure granted to the analyst role", "A caller's-rights procedure that the analyst calls"], answer: 2,
          explain: "Owner's rights lets the procedure act with the loader role's privileges while the analyst only holds USAGE on the procedure, so the only write path is the code you reviewed. Granting the privilege or inheriting the role gives the analyst unrestricted writes. A caller's-rights proc would fail because the analyst lacks the privilege." },
        { q: "A JavaScript procedure is declared with an argument table_name VARCHAR. How is it referenced inside the JavaScript body?",
          options: ["table_name", "TABLE_NAME", ":table_name", "arguments.table_name"], answer: 1,
          explain: "Snowflake exposes JavaScript procedure and UDF arguments as uppercase identifiers, because unquoted SQL identifiers are stored uppercase. Referencing table_name raises a ReferenceError at call time, not at create time. The colon form belongs to Snowflake Scripting, not JavaScript." }
      ]
    },
    "dev-udfs": {
      title: "Functions checkpoint",
      sub: "SQL, JavaScript and Python UDFs, UDTFs, vectorized handlers and external access.",
      questions: [
        { q: "Which kind of scalar UDF can the optimizer typically inline into the calling query, so it costs about as much as writing the expression by hand?",
          options: ["Python UDF", "JavaScript UDF", "SQL UDF", "Java UDF"], answer: 2,
          explain: "A SQL UDF body is a SQL expression, so the optimizer can substitute it into the plan and still prune, push down and parallelise normally. Python, JavaScript and Java UDFs run in a sandboxed runtime and pay serialization overhead per row or batch. Reach for a SQL UDF first when the logic is expressible in SQL." },
        { q: "In a Python UDTF handler class, what are process and end_partition for?",
          options: ["process yields output rows for each input row; end_partition runs once after the last row of each partition", "process runs once per query; end_partition runs once per row", "end_partition yields per row; process initialises state", "process runs on the client; end_partition runs on the warehouse"], answer: 0,
          explain: "process is called for every input row and may yield zero or more output tuples. end_partition fires after the final row of a partition, which is where you emit aggregates you accumulated in instance state. The partitioning comes from OVER (PARTITION BY ...) in the calling query." },
        { q: "What does a vectorized Python UDF change compared with a regular Python UDF?",
          options: ["It runs on GPU-backed warehouses only", "It bypasses the secure sandbox for speed", "It caches results across queries automatically", "The handler receives batches of rows as pandas objects, amortising per-row call and serialization overhead"], answer: 3,
          explain: "With the vectorized decorator the handler receives a pandas DataFrame of many rows and returns a Series or array of the same length. Fewer calls across the runtime boundary and the ability to use numpy-style operations typically make numeric work much faster. The sandbox and the query semantics are unchanged." },
        { q: "A Python UDF must call a partner API at api.acme.example using a token. Which objects make that possible?",
          options: ["An API integration, a stage and a pipe", "A storage integration and a file format", "A network rule for egress, a secret holding the token, and an external access integration referencing both", "A network policy and a service user"], answer: 2,
          explain: "Egress from UDFs and procedures is closed by default. A network rule declares the allowed host and port, a secret stores the credential, and an external access integration bundles them; the function then lists the integration and maps the secret by name. Network policies govern inbound connections, which is the opposite direction." },
        { q: "What is the defining difference between a UDF and a stored procedure?",
          options: ["UDFs can only be written in SQL", "A UDF is used inside SQL expressions and returns a value per row (or rows, for a UDTF); a procedure is invoked with CALL and can run DDL and DML", "Procedures cannot return values", "UDFs always run with caller's rights while procedures always run with owner's rights"], answer: 1,
          explain: "Functions compose into queries: SELECT my_udf(col) FROM t, or FROM TABLE(my_udtf(...)). Procedures are statements in their own right, invoked with CALL, and are where you put control flow, DDL, DML and transactions. Both support several languages." },
        { q: "A JavaScript UDF receives NUMBER(38,0) order ids around 9e17 and they come back slightly wrong. Why?",
          options: ["JavaScript numbers are IEEE doubles, which are exact only up to about 2^53", "JavaScript UDFs truncate all numbers to 32 bits", "NUMBER columns are always cast to FLOAT before any UDF", "The UDF cache returned a stale value"], answer: 0,
          explain: "SQL NUMBER maps to a JavaScript double, which represents integers exactly only up to 9,007,199,254,740,991. Pass large integers as VARCHAR, or write the function in SQL or Python where arbitrary precision is preserved. The same trap applies to JavaScript procedures." }
      ]
    },
    "dev-snowpark": {
      title: "Snowpark checkpoint",
      sub: "Lazy DataFrames, pushdown, sessions, packages and deployment.",
      questions: [
        { q: "df = session.table('RAW.ORDERS').filter(col('STATUS') == 'SHIPPED').select('ORDER_ID'). How many queries has this sent to the warehouse?",
          options: ["One per chained method", "None until an action such as collect() or count() runs", "One, when session.table() is called", "One, when filter() validates its column"], answer: 1,
          explain: "Transformations only extend a client-side query plan. Nothing is executed until an action needs results. Snowpark may issue lightweight metadata lookups to resolve schemas, but the heavy SQL runs only on an action, which is why you can chain freely." },
        { q: "You call df.count() and then df.collect() on the same expensive DataFrame. What happens?",
          options: ["One query; the second call reuses the first result", "Zero queries; count is computed locally", "One query; count() is free because Snowflake keeps row counts in metadata", "Two queries; each action compiles and runs the full plan again"], answer: 3,
          explain: "Each action is independent, so the whole plan is executed twice and the source scanned twice. The result cache may help when the text and data are identical, but you should not rely on it. Use cache_result() to materialise once when you need several actions over the same expensive result." },
        { q: "A CI job needs a non-interactive Snowpark session. What is the right way to supply credentials?",
          options: ["Key-pair auth: the private key file path and passphrase come from environment variables populated by the CI secret store", "Hardcode a password in a config module that is excluded from linting", "Commit a connections.toml containing the password to the repo", "Use externalbrowser SSO from the CI runner"], answer: 0,
          explain: "Key-pair authentication suits service users, and passing the path and passphrase through environment variables keeps secrets out of the code and the repo. externalbrowser needs a human with a browser, so it cannot work headless. Any password in source or committed config should be treated as already leaked." },
        { q: "What does @sproc(is_permanent=True, stage_location='@deploy_stage', name='load_orders', replace=True) do?",
          options: ["Runs load_orders immediately on the client", "Creates a temporary procedure that disappears with the session", "Serialises the function and its dependencies to the stage and creates a permanent stored procedure named load_orders", "Schedules load_orders as a serverless task"], answer: 2,
          explain: "Registration pickles the handler, uploads it with its imports to the stage, and issues CREATE PROCEDURE pointing at those files. Without is_permanent the procedure is temporary and scoped to the session. Scheduling is a separate concern handled by tasks." },
        { q: "A notebook does df.to_pandas() on a 500-million-row table and then filters to one region in pandas. What is the main problem?",
          options: ["to_pandas() is not supported for tables that large", "pandas cannot filter strings", "Snowpark forbids mixing pandas and DataFrames", "Every row is transferred to the client before filtering; the filter should run in Snowflake before materialising"], answer: 3,
          explain: "to_pandas() is an action that pulls the full result into client memory over the network. Applying filter() and select() first lets Snowflake do the reduction on the warehouse and ship only what you need. The rule of thumb: push work down, pull results up." },
        { q: "Your procedure needs a small pure-Python library that is not available in Snowflake's package channel. What is the usual approach?",
          options: ["pip install it inside the handler at runtime", "Ask Snowflake support to add it", "Package it as a zip or wheel, upload it to a stage, and reference it through IMPORTS or session.add_import", "Copy its source into a SQL UDF"], answer: 2,
          explain: "Pure-Python code can be shipped on a stage and added to the handler's import path. pip at runtime needs network egress and makes runs non-reproducible. Libraries with native extensions are harder and are usually better sourced from the supported channel." }
      ]
    }
  });

  /* ==================================================================
     4. Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.dev = {
    id: "dev",
    name: "Snowpark & Programmability",
    short: "DEV",
    tagline: "Code that runs next to the data",
    color: "#a78bfa",
    blurb: "Stored procedures in Snowflake Scripting, JavaScript and Python; caller's versus owner's rights; the pitfalls that let a broken procedure deploy green and fail silently; scalar UDFs, UDTFs, vectorized handlers and external access; and Snowpark DataFrames, lazy evaluation, sessions and deployment without a single inline secret.",
    modules: [
      /* -------------------------------------------------- procs */
      {
        id: "procs",
        name: "Stored Procedures",
        icon: "cube",
        lessons: [
          {
            id: "sql-scripting",
            title: "Snowflake Scripting procedures",
            summary: "Blocks, variables, result sets, dynamic SQL and exception handling in Snowflake's native procedural SQL.",
            minutes: 11,
            tags: ["snowflake-scripting", "procedures", "dynamic-sql"],
            blocks: [
              { t: "p", html: "Picture a Snowflake Scripting procedure as <strong>a SQL script with a spine</strong>: ordinary statements you could run one by one, plus variables, branches, loops and an error handler around them. Each statement is still compiled and executed separately by the warehouse, so the procedure adds control flow, not a new execution engine." },
              { t: "h", text: "Anatomy of a block" },
              { t: "code", lang: "sql", code: lines([
                "CREATE OR REPLACE PROCEDURE ops.purge_old_partitions(p_table VARCHAR, p_keep_days NUMBER)",
                "RETURNS VARCHAR",
                "LANGUAGE SQL",
                "EXECUTE AS CALLER",
                "AS",
                "$$",
                "DECLARE",
                "  v_cutoff DATE DEFAULT DATEADD(day, -p_keep_days, CURRENT_DATE());",
                "  v_deleted NUMBER DEFAULT 0;",
                "BEGIN",
                "  IF (p_keep_days < 7) THEN",
                "    RETURN 'refusing: keep at least 7 days';",
                "  END IF;",
                "",
                "  DELETE FROM IDENTIFIER(:p_table) WHERE event_date < :v_cutoff;",
                "  v_deleted := SQLROWCOUNT;",
                "",
                "  LET v_msg VARCHAR := 'deleted ' || v_deleted || ' rows older than ' || v_cutoff;",
                "  RETURN v_msg;",
                "END;",
                "$$;",
                "",
                "CALL ops.purge_old_partitions('ANALYTICS.EVENTS.CLICKS', 30);"
              ]) },
              { t: "table", headers: ["Where the variable appears", "Syntax", "Example"], rows: [
                ["Scripting expression (IF, LET, :=, RETURN)", "Bare name", "<code class='tok'>v_deleted := SQLROWCOUNT;</code>"],
                ["Value inside a SQL statement", "Colon prefix", "<code class='tok'>WHERE event_date &lt; :v_cutoff</code>"],
                ["Object name inside a SQL statement", "IDENTIFIER(:var)", "<code class='tok'>FROM IDENTIFIER(:p_table)</code>"],
                ["Session variable (not a scripting variable)", "Dollar prefix", "<code class='tok'>SET run_date = ...; SELECT $run_date;</code>"]
              ] },
              { t: "note", variant: "tip", html: "<code class='tok'>SQLROWCOUNT</code>, <code class='tok'>SQLFOUND</code> and <code class='tok'>SQLNOTFOUND</code> describe the <em>most recent</em> DML statement. Capture them into a variable immediately; the next statement overwrites them." },
              { t: "h", text: "Result sets and dynamic SQL" },
              { t: "code", lang: "sql", code: lines([
                "CREATE OR REPLACE PROCEDURE ops.top_tables(p_db VARCHAR, p_limit NUMBER)",
                "RETURNS TABLE (table_name VARCHAR, row_count NUMBER)",
                "LANGUAGE SQL",
                "AS",
                "$$",
                "DECLARE",
                "  v_sql VARCHAR;",
                "  v_view VARCHAR;",
                "  rs RESULTSET;",
                "BEGIN",
                "  -- values are bound with ?; the object name goes through IDENTIFIER()",
                "  v_view := p_db || '.INFORMATION_SCHEMA.TABLES';",
                "  v_sql := 'SELECT table_schema || ''.'' || table_name, row_count ' ||",
                "           'FROM IDENTIFIER(?) WHERE table_type = ''BASE TABLE'' ' ||",
                "           'ORDER BY row_count DESC NULLS LAST LIMIT ?';",
                "  rs := (EXECUTE IMMEDIATE :v_sql USING (v_view, p_limit));",
                "  RETURN TABLE(rs);",
                "END;",
                "$$;",
                "",
                "CALL ops.top_tables('ANALYTICS', 10);"
              ]) },
              { t: "note", variant: "warn", html: "<strong>String-concatenated SQL is an injection surface.</strong> Bind values with <code class='tok'>USING (...)</code> and <code class='tok'>?</code> placeholders, and route object names through <code class='tok'>IDENTIFIER()</code>. This matters most in owner's-rights procedures, where injected SQL runs with the owner's privileges." },
              { t: "h", text: "Exceptions" },
              { t: "code", lang: "sql", code: lines([
                "DECLARE",
                "  bad_input EXCEPTION (-20001, 'batch id must be positive');",
                "BEGIN",
                "  IF (:p_batch_id <= 0) THEN",
                "    RAISE bad_input;",
                "  END IF;",
                "  INSERT INTO stage.orders_clean SELECT * FROM stage.orders_raw WHERE batch_id = :p_batch_id;",
                "  RETURN 'ok';",
                "EXCEPTION",
                "  WHEN bad_input THEN",
                "    RAISE;                       -- re-raise: the CALL fails with -20001",
                "  WHEN STATEMENT_ERROR THEN",
                "    INSERT INTO ops.proc_errors (proc, code, state, msg, at)",
                "      SELECT 'load_orders', :SQLCODE, :SQLSTATE, :SQLERRM, CURRENT_TIMESTAMP();",
                "    RAISE;",
                "END;"
              ]) },
              { t: "table", headers: ["Built-in handler", "Catches"], rows: [
                ["STATEMENT_ERROR", "A SQL statement failed: compile errors, missing objects, privilege errors, constraint failures"],
                ["EXPRESSION_ERROR", "A scripting expression failed, for example assigning text to a NUMBER variable"],
                ["OTHER", "Anything not matched above, including your declared exceptions if no specific handler exists"]
              ] },
              { t: "p", html: "Statements autocommit unless you open an explicit <code class='tok'>BEGIN TRANSACTION</code>. If a five-step load fails on step four, steps one to three are already committed. Wrap multi-statement writes in a transaction and issue <code class='tok'>ROLLBACK</code> in the handler before re-raising. Note that the block keyword <code class='tok'>BEGIN</code> does not start a transaction on its own." },
              { t: "table", headers: ["Tier", "Procedure design", "Why"], rows: [
                ["Naive", "Concatenate arguments into SQL, no handler, no transaction", "Injection risk, partial writes and raw errors with no context"],
                ["Solid", "Bind values, IDENTIFIER() for names, explicit transaction, handler that logs and re-raises", "Failures stay failures and leave evidence"],
                ["Standout", "Solid plus input guards, an idempotent design keyed on batch id, and a dry-run argument that returns the generated SQL", "Safe to retry, easy to debug, cheap to smoke-test after deploy"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"loop over a list of tables\", \"run this cleanup with a guard\", \"return a result set from a procedure\", \"log failures to an audit table\", or \"build the SQL from a config row\". Each is Snowflake Scripting with binds, IDENTIFIER() and a handler that re-raises." },
              { t: "note", variant: "key", html: "<strong>Scripting is control flow around normal SQL.</strong> Colon-bind values, IDENTIFIER() object names, capture SQLROWCOUNT immediately, wrap multi-step writes in a transaction, and make every handler re-raise." }
            ]
          },
          {
            id: "js-python-procs",
            title: "JavaScript and Python procedures",
            summary: "When to leave SQL for a general-purpose language, and the runtime quirks of each.",
            minutes: 10,
            tags: ["javascript", "python", "procedures"],
            blocks: [
              { t: "p", html: "Think of language choice as <strong>where the logic lives</strong>. Snowflake Scripting keeps everything in SQL. JavaScript gives you an embedded engine with a small statement API. Python gives you Snowpark, the package ecosystem and real data structures, at the cost of a heavier runtime." },
              { t: "h", text: "JavaScript procedures" },
              { t: "code", lang: "javascript", code: lines([
                "CREATE OR REPLACE PROCEDURE ops.row_counts(SCHEMA_NAME VARCHAR)",
                "RETURNS VARIANT",
                "LANGUAGE JAVASCRIPT",
                "EXECUTE AS CALLER",
                "AS",
                "$$",
                "  // arguments are visible in UPPERCASE: SCHEMA_NAME, not schema_name",
                "  var out = {};",
                "  var list = snowflake.createStatement({",
                "    sqlText: \"SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'\",",
                "    binds: [SCHEMA_NAME]",
                "  }).execute();",
                "  while (list.next()) {",
                "    var t = list.getColumnValue(1);",
                "    try {",
                "      var rs = snowflake.execute({",
                "        sqlText: 'SELECT COUNT(*) FROM IDENTIFIER(?)',",
                "        binds: [SCHEMA_NAME + '.' + t]",
                "      });",
                "      rs.next();",
                "      out[t] = rs.getColumnValue(1);",
                "    } catch (err) {",
                "      // record and rethrow so the CALL fails visibly",
                "      throw new Error('count failed for ' + t + ': ' + err.message);",
                "    }",
                "  }",
                "  return out;",
                "$$;"
              ]) },
              { t: "ul", items: [
                "Arguments surface as <strong>uppercase</strong> identifiers; the wrong case is a ReferenceError at call time, not at create time.",
                "Always use <code class='tok'>binds</code>; never splice values into <code class='tok'>sqlText</code>.",
                "SQL <code class='tok'>NUMBER</code> becomes a JavaScript double: integers beyond about 2<sup>53</sup> lose precision. Pass big ids as VARCHAR.",
                "There is no package manager. What the engine offers is what you get."
              ] },
              { t: "h", text: "Python procedures" },
              { t: "code", lang: "python", code: lines([
                "CREATE OR REPLACE PROCEDURE ops.dedupe_table(fq_table STRING, key_cols ARRAY)",
                "RETURNS STRING",
                "LANGUAGE PYTHON",
                "RUNTIME_VERSION = '3.11'",
                "PACKAGES = ('snowflake-snowpark-python')",
                "HANDLER = 'run'",
                "EXECUTE AS OWNER",
                "AS",
                "$$",
                "from snowflake.snowpark import Session, Window",
                "from snowflake.snowpark.functions import col, row_number",
                "",
                "def run(session: Session, fq_table: str, key_cols: list) -> str:",
                "    df = session.table(fq_table)",
                "    w = Window.partition_by(*[col(c) for c in key_cols]).order_by(col('_LOADED_AT').desc())",
                "    deduped = df.with_column('_RN', row_number().over(w)).filter(col('_RN') == 1).drop('_RN')",
                "    deduped.write.mode('overwrite').save_as_table(fq_table + '_DEDUPED')",
                "    return f'kept {deduped.count()} rows'",
                "$$;"
              ]) },
              { t: "note", variant: "tip", html: "The Python handler's first parameter is always the <code class='tok'>Session</code>; SQL arguments follow in order. Inside, Snowpark DataFrame operations still compile to SQL and run on the warehouse, so the Python process mostly orchestrates." },
              { t: "h", text: "Choosing a language" },
              { t: "table", headers: ["", "Snowflake Scripting", "JavaScript", "Python"], rows: [
                ["Best at", "Set-based DDL/DML orchestration", "Light string and JSON wrangling", "Rich logic, libraries, DataFrames, ML"],
                ["Dependencies", "None", "None available", "Supported package channel, staged imports"],
                ["Error model", "EXCEPTION blocks, SQLCODE/SQLERRM", "try/catch around statements", "Python exceptions; SnowparkSQLException"],
                ["Startup cost", "Lowest", "Low", "Higher: sandbox plus package resolution"],
                ["Testability", "Integration tests only", "Integration tests only", "Unit-test the handler locally with a session fixture"]
              ] },
              { t: "compare",
                bad: { title: "Python for a three-statement MERGE", items: ["Package resolution on every cold start", "A second language to review", "No gain over plain SQL"] },
                good: { title: "Python for a config-driven loader", items: ["Parses a config table into a plan", "Unit-testable handler", "Snowpark keeps heavy work on the warehouse"] } },
              { t: "code", lang: "sql", code: lines([
                "CALL ops.row_counts('SALES');",
                "",
                "-- procedures are not table functions: post-process the CALL output with RESULT_SCAN",
                "SELECT f.key AS table_name, f.value::NUMBER AS row_count",
                "FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())) r,",
                "     LATERAL FLATTEN(input => r.$1) f",
                "ORDER BY row_count DESC;"
              ]) },
              { t: "note", variant: "warn", html: "A procedure cannot be used in a FROM clause the way a UDTF can. If downstream SQL must join to its output, either return a TABLE and use <code class='tok'>RESULT_SCAN</code>, or write the logic as a UDTF instead." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"needs a library\", \"parse this config and generate statements\", \"unit test the logic\" point to Python. \"Just loop and run DDL\" points to Snowflake Scripting. JavaScript fits small legacy procedures and quick JSON shaping." },
              { t: "note", variant: "key", html: "<strong>Pick the lightest language that expresses the logic.</strong> SQL for orchestration, Python when you need libraries or tests, JavaScript only for small jobs, and remember uppercase arguments and double-precision numbers in JS." }
            ]
          },
          {
            id: "rights",
            title: "Caller's rights vs owner's rights",
            summary: "Whose privileges a procedure uses, what it can see of the caller's session, and how to delegate safely.",
            minutes: 9,
            tags: ["rights", "rbac", "delegation"],
            blocks: [
              { t: "p", html: "The mental model: an <strong>owner's-rights</strong> procedure is a sealed service window. The caller hands over arguments and the procedure acts with the owner role's privileges, seeing little of the caller's session. A <strong>caller's-rights</strong> procedure is a macro: it runs as if the caller had typed every statement in their own session." },
              { t: "table", headers: ["Behaviour", "EXECUTE AS OWNER (default)", "EXECUTE AS CALLER"], rows: [
                ["Privileges used", "The owning role's", "The caller's active role (and secondary roles)"],
                ["Unqualified names resolve in", "The procedure's own database and schema", "The caller's current database and schema"],
                ["Caller's session variables", "Cannot read, set or unset them", "Full access; changes persist after CALL"],
                ["Session parameters", "Reads a limited set; cannot change the caller's", "Can read and ALTER SESSION"],
                ["Caller-specific metadata (SHOW, DESCRIBE, user-scoped functions)", "Restricted", "Works as for the caller"],
                ["Warehouse", "The caller's current warehouse", "The caller's current warehouse"]
              ] },
              { t: "code", lang: "sql", code: lines([
                "-- the loader role owns the procedure and holds the write privileges",
                "USE ROLE loader_role;",
                "CREATE OR REPLACE PROCEDURE finance.core.reload_ledger(p_batch NUMBER)",
                "RETURNS VARCHAR",
                "LANGUAGE SQL",
                "EXECUTE AS OWNER",
                "AS",
                "$$",
                "BEGIN",
                "  BEGIN TRANSACTION;",
                "  DELETE FROM ledger WHERE batch_id = :p_batch;      -- resolves to finance.core.ledger",
                "  INSERT INTO ledger SELECT * FROM finance.stage.ledger_in WHERE batch_id = :p_batch;",
                "  COMMIT;",
                "  RETURN 'reloaded batch ' || p_batch;",
                "EXCEPTION",
                "  WHEN OTHER THEN",
                "    ROLLBACK;",
                "    RAISE;",
                "END;",
                "$$;",
                "",
                "-- the analyst can run the reviewed path, and nothing else",
                "GRANT USAGE ON PROCEDURE finance.core.reload_ledger(NUMBER) TO ROLE analyst_role;"
              ]) },
              { t: "ul", items: [
                "To call any procedure the caller needs <code class='tok'>USAGE</code> on its database and schema plus <code class='tok'>USAGE</code> on the procedure, granted with its full argument signature.",
                "Under owner's rights, revoking a privilege from the <em>owner</em> role breaks every caller at once. Treat the owner role as production infrastructure.",
                "Transferring ownership changes whose privileges an owner's-rights body uses, so re-test after any <code class='tok'>GRANT OWNERSHIP</code>.",
                "Query history records the caller as the user, so audit trails still show who triggered the delegated action."
              ] },
              { t: "h", text: "Try it" },
              { t: "widget", id: "rightsLab" },
              { t: "note", variant: "trap", html: "<strong>Owner's rights plus caller-supplied SQL is privilege escalation.</strong> If an owner's-rights procedure accepts a WHERE clause or table name as free text and concatenates it, any caller with USAGE can run arbitrary SQL as the owner. Allow-list identifiers, bind values, and keep the owner role narrow." },
              { t: "h", text: "Choosing a mode" },
              { t: "p", html: "Use owner's rights when the whole point is delegation: a controlled write, a maintenance action, or reading a table the caller must not query directly. Use caller's rights for utilities that should behave exactly as the caller would, such as an admin helper that inspects whatever the current user can see or needs to set session variables. Newer releases also offer a restricted caller's-rights variant that limits which of the caller's privileges flow in; check your account's documentation before relying on it." },
              { t: "table", headers: ["Tier", "Delegation approach", "Consequence"], rows: [
                ["Naive", "Grant the analyst INSERT and DELETE on the table", "Any ad-hoc statement can corrupt the ledger"],
                ["Solid", "Owner's-rights procedure owned by a narrow loader role; analyst gets USAGE only", "One reviewed write path"],
                ["Standout", "Solid plus bound arguments, an allow-listed batch range, an audit insert inside the transaction, and ownership by a dedicated role rather than SYSADMIN", "Delegation that is auditable and cannot be bent into arbitrary SQL"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"let a team run X without giving them access to Y\", \"the procedure works for me but fails for them\", \"session variable is empty inside the proc\", \"SHOW returns nothing in the procedure\". All of these are a rights-mode question." },
              { t: "note", variant: "key", html: "<strong>Owner's rights delegates, caller's rights impersonates.</strong> Default is owner. Owner mode sees the procedure's schema and none of the caller's session variables; caller mode is limited by the caller's grants." }
            ]
          },
          {
            id: "proc-pitfalls",
            title: "Procedure pitfalls: compile-on-call and exceptions that hide errors",
            summary: "Why a green CREATE proves little, how handlers turn failures into successes, and how to debug generated SQL.",
            minutes: 11,
            tags: ["debugging", "deployment", "exceptions"],
            blocks: [
              { t: "p", html: "The mental model: a procedure has <strong>two moments of truth</strong>. CREATE checks that the definition is well formed; CALL is the first time each statement inside meets the real catalog, real privileges and real data. Most procedure incidents come from treating the first moment as if it were the second." },
              { t: "h", text: "CREATE OR REPLACE succeeding does not mean the body works" },
              { t: "code", lang: "sql", code: lines([
                "CREATE OR REPLACE PROCEDURE etl.refresh_summary()",
                "RETURNS VARCHAR",
                "LANGUAGE SQL",
                "AS",
                "$$",
                "BEGIN",
                "  INSERT OVERWRITE INTO rpt.daily_summary",
                "  SELECT order_date, SUM(amount) FROM etl.orders_v2 GROUP BY 1;  -- orders_v2 was never created",
                "  RETURN 'ok';",
                "END;",
                "$$;",
                "-- Statement executed successfully.   <- deploy pipeline goes green",
                "",
                "CALL etl.refresh_summary();",
                "-- SQL compilation error: Object 'ETL.ORDERS_V2' does not exist or not authorized."
              ]) },
              { t: "note", variant: "warn", html: "Object names, column names and privileges inside the body are resolved when each statement runs, not at create time. JavaScript and Python bodies are even more opaque: a typo in a function name surfaces only on the code path that reaches it." },
              { t: "code", lang: "sql", code: lines([
                "-- post-deploy check 1: the body you meant to ship is the body that is live",
                "SELECT GET_DDL('PROCEDURE', 'ETL.REFRESH_SUMMARY()') ILIKE '%rpt.daily_summary%'   AS has_target,",
                "       GET_DDL('PROCEDURE', 'ETL.REFRESH_SUMMARY()') ILIKE '%orders_v2%'           AS has_new_source;",
                "",
                "-- post-deploy check 2: a smoke CALL in a cloned or test database",
                "USE DATABASE IDENTIFIER($test_db);",
                "CALL etl.refresh_summary();"
              ]) },
              { t: "h", text: "The handler that swallows errors" },
              { t: "code", lang: "sql", code: lines([
                "EXCEPTION",
                "  WHEN STATEMENT_ERROR THEN",
                "    RETURN OBJECT_CONSTRUCT('status', 'FAILED',",
                "                            'sqlcode', SQLCODE,",
                "                            'msg', SQLERRM);",
                "-- The CALL completes successfully and returns a JSON object.",
                "-- Task history, the scheduler and any query-status alert all see SUCCESS."
              ]) },
              { t: "compare",
                bad: { title: "Return the error as data", items: ["CALL status is success", "Alerts on failed queries never fire", "Only a caller that parses the JSON notices", "The original statement text is lost"] },
                good: { title: "Record, then re-raise", items: ["Insert SQLCODE, SQLSTATE, SQLERRM and context into an error table", "RAISE so the CALL fails", "Tasks and schedulers see the failure", "The error table explains it"] } },
              { t: "code", lang: "sql", code: lines([
                "EXCEPTION",
                "  WHEN STATEMENT_ERROR THEN",
                "    ROLLBACK;",
                "    INSERT INTO ops.proc_errors (proc, sqlcode, sqlstate, msg, generated_sql, at)",
                "      SELECT 'etl.refresh_summary', :SQLCODE, :SQLSTATE, :SQLERRM, :v_sql, CURRENT_TIMESTAMP();",
                "    RAISE;"
              ]) },
              { t: "h", text: "Debugging generated SQL: run it standalone" },
              { t: "p", html: "When a procedure builds SQL from config rows, the message you get back through a wrapper is often a paraphrase, with the line and column pointing into the wrong text. Get the <em>exact</em> generated string, then run it on its own: you get the raw parser error with an accurate position, and you can iterate in seconds." },
              { t: "code", lang: "sql", code: lines([
                "-- give the procedure a dry-run switch that returns the SQL instead of executing it",
                "IF (p_dry_run) THEN",
                "  RETURN v_sql;",
                "END IF;",
                "EXECUTE IMMEDIATE :v_sql;",
                "",
                "-- then:",
                "CALL etl.build_merge('ORDERS', TRUE);     -- copy the returned text",
                "-- paste and run it directly: the error now names the real token and position"
              ]) },
              { t: "ol", items: [
                "Read the error table or the JSON the wrapper returned, and note which statement failed.",
                "Re-run with the dry-run flag, or select the logged <code class='tok'>generated_sql</code>.",
                "Execute that SQL standalone in the same role and database.",
                "Fix the generator or the config row, not the symptom, then smoke-CALL again."
              ] },
              { t: "table", headers: ["Pitfall", "Symptom", "Fix"], rows: [
                ["Overloaded signatures", "GET_DDL or DROP says the procedure does not exist", "Always include argument types: <code class='tok'>PROC(VARCHAR, NUMBER)</code>"],
                ["Autocommit partial writes", "Half a load committed after a failure", "Explicit BEGIN TRANSACTION, ROLLBACK in the handler"],
                ["Owner's-rights name resolution", "Works in a worksheet, fails in the proc", "Fully qualify names; unqualified ones resolve in the proc's schema"],
                ["Lowercase JS arguments", "ReferenceError only at call time", "Use the uppercase argument names"],
                ["Handler returns instead of raising", "Green runs, stale data", "Log, then RAISE"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the deploy succeeded but the job fails\", \"the job says success but the table is stale\", \"the error message points at the wrong place\", \"the proc returns a JSON with status FAILED\". Reach for smoke CALLs, GET_DDL token checks, re-raising handlers and standalone execution of the generated SQL." },
              { t: "quiz", id: "dev-procs" },
              { t: "note", variant: "key", html: "<strong>CREATE proves shape, CALL proves behaviour.</strong> Validate every deploy with GET_DDL token checks and a smoke CALL, make handlers log and re-raise, and debug dynamic SQL by running the exact generated text on its own." }
            ]
          }
        ]
      },
      /* -------------------------------------------------- udfs */
      {
        id: "udfs",
        name: "Functions",
        icon: "plug",
        lessons: [
          {
            id: "udfs",
            title: "Scalar UDFs in SQL, JavaScript and Python",
            summary: "One value in, one value out: when each language pays off and what it costs the optimizer.",
            minutes: 9,
            tags: ["udf", "python", "javascript"],
            blocks: [
              { t: "p", html: "A scalar UDF is <strong>a column expression with a name</strong>. It is called once per row (or per batch, for vectorized Python) inside a query. That position in the plan is what decides its cost: SQL UDFs dissolve into the plan, while other languages cross a runtime boundary on every call." },
              { t: "table", headers: ["", "UDF", "Stored procedure"], rows: [
                ["Invoked by", "Any SQL expression: SELECT, WHERE, JOIN ON", "CALL"],
                ["Returns", "One value per row (scalar) or rows (UDTF)", "One value or a table"],
                ["Can run DDL/DML", "No", "Yes"],
                ["Typical use", "Reusable business logic in queries", "Orchestration and side effects"]
              ] },
              { t: "h", text: "SQL UDFs" },
              { t: "code", lang: "sql", code: lines([
                "CREATE OR REPLACE FUNCTION util.fiscal_quarter(d DATE)",
                "RETURNS VARCHAR",
                "AS",
                "$$",
                "  'Q' || CEIL(MONTH(DATEADD(month, 5, d)) / 3)::VARCHAR || ' FY' || YEAR(DATEADD(month, 5, d))::VARCHAR",
                "$$;",
                "",
                "-- a lookup UDF that reads a small table can be marked MEMOIZABLE so its result is cached",
                "CREATE OR REPLACE FUNCTION util.fx_rate_map()",
                "RETURNS OBJECT",
                "MEMOIZABLE",
                "AS",
                "$$ SELECT OBJECT_AGG(currency, rate::VARIANT) FROM ref.fx_rates $$;",
                "",
                "SELECT order_id, amount * GET(util.fx_rate_map(), currency)::FLOAT AS amount_usd,",
                "       util.fiscal_quarter(order_date) AS fq",
                "FROM sales.orders;"
              ]) },
              { t: "note", variant: "tip", html: "A SQL UDF body is an expression or a single query, not a script. If you need IF/ELSE, use <code class='tok'>IFF</code> or <code class='tok'>CASE</code>. Because the optimizer can inline it, pruning and pushdown keep working." },
              { t: "h", text: "JavaScript and Python UDFs" },
              { t: "code", lang: "javascript", code: lines([
                "CREATE OR REPLACE FUNCTION util.mask_email(EMAIL VARCHAR)",
                "RETURNS VARCHAR",
                "LANGUAGE JAVASCRIPT",
                "IMMUTABLE",
                "AS",
                "$$",
                "  if (EMAIL === null || EMAIL === undefined) return null;",
                "  var at = EMAIL.indexOf('@');",
                "  if (at < 1) return '***';",
                "  return EMAIL.charAt(0) + '***' + EMAIL.substring(at);",
                "$$;"
              ]) },
              { t: "code", lang: "python", code: lines([
                "CREATE OR REPLACE FUNCTION util.normalize_phone(raw STRING, region STRING)",
                "RETURNS STRING",
                "LANGUAGE PYTHON",
                "RUNTIME_VERSION = '3.11'",
                "PACKAGES = ('phonenumbers')",
                "HANDLER = 'normalize'",
                "AS",
                "$$",
                "import phonenumbers",
                "",
                "def normalize(raw, region):",
                "    if raw is None:",
                "        return None",
                "    try:",
                "        n = phonenumbers.parse(raw, region or 'US')",
                "        return phonenumbers.format_number(n, phonenumbers.PhoneNumberFormat.E164)",
                "    except phonenumbers.NumberParseException:",
                "        return None",
                "$$;"
              ]) },
              { t: "ul", items: [
                "Declare <code class='tok'>IMMUTABLE</code> only when the same inputs always give the same output; it permits more aggressive optimisation.",
                "UDFs overload by argument types, so <code class='tok'>f(VARCHAR)</code> and <code class='tok'>f(NUMBER)</code> are different objects with separate grants.",
                "Python and JavaScript UDFs typically cost noticeably more per row than the equivalent SQL; benchmark on a realistic row count before standardising on one.",
                "<code class='tok'>SECURE</code> UDFs hide their definition and block some optimisations so the body cannot leak through plan details."
              ] },
              { t: "table", headers: ["Tier", "Normalising phone numbers across 2 billion rows", "Trade-off"], rows: [
                ["Naive", "Pull rows into a client script, normalise, write back", "Network transfer both ways, a second pipeline to run"],
                ["Solid", "Python UDF using a parsing library, applied in the transform SQL", "Runs next to the data; per-row runtime overhead"],
                ["Standout", "Vectorized Python UDF applied once at ingestion, results stored in a column", "Batch overhead amortised and paid once, not on every read"]
              ] },
              { t: "note", variant: "trap", html: "A UDF in a WHERE clause on a large table can block partition pruning, because the optimizer cannot reason about min/max values through an opaque function. Filter on raw columns first, then apply the UDF." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the same CASE expression is copy-pasted in 40 views\" (SQL UDF), \"we need a library to parse X\" (Python UDF), \"mask or format a value consistently\" (a small UDF, possibly SECURE)." },
              { t: "note", variant: "key", html: "<strong>SQL UDFs first.</strong> They inline and keep pruning intact; reach for Python when you need a library, keep JavaScript for small string logic, and keep UDFs out of WHERE clauses on large tables when you can." }
            ]
          },
          {
            id: "udtfs",
            title: "UDTFs, vectorized UDFs and external access",
            summary: "Functions that return rows, handlers that process batches, and controlled egress to outside services.",
            minutes: 11,
            tags: ["udtf", "vectorized", "external-access"],
            blocks: [
              { t: "p", html: "A UDTF is <strong>a function you join to</strong>. It sits in a FROM clause and emits zero or more rows per input row, optionally with state across a partition. That makes it the right tool for explode, sessionise and parse-to-rows jobs that would be awkward in a scalar UDF." },
              { t: "h", text: "SQL UDTFs: parameterised views" },
              { t: "code", lang: "sql", code: lines([
                "CREATE OR REPLACE FUNCTION rpt.orders_for(p_region VARCHAR, p_from DATE)",
                "RETURNS TABLE (order_id NUMBER, order_date DATE, amount NUMBER(12,2))",
                "AS",
                "$$",
                "  SELECT order_id, order_date, amount",
                "  FROM sales.orders",
                "  WHERE region = p_region AND order_date >= p_from",
                "$$;",
                "",
                "SELECT * FROM TABLE(rpt.orders_for('EMEA', '2026-07-01'::DATE));"
              ]) },
              { t: "h", text: "Python UDTFs with partition state" },
              { t: "code", lang: "python", code: lines([
                "CREATE OR REPLACE FUNCTION util.sessionize(ts TIMESTAMP_NTZ, gap_minutes NUMBER)",
                "RETURNS TABLE (session_no NUMBER, session_start TIMESTAMP_NTZ, events NUMBER)",
                "LANGUAGE PYTHON",
                "RUNTIME_VERSION = '3.11'",
                "HANDLER = 'Sessionizer'",
                "AS",
                "$$",
                "from datetime import timedelta",
                "",
                "class Sessionizer:",
                "    def __init__(self):",
                "        self.n, self.start, self.last, self.count = 0, None, None, 0",
                "",
                "    def process(self, ts, gap_minutes):",
                "        if self.last is not None and ts - self.last > timedelta(minutes=gap_minutes):",
                "            yield (self.n, self.start, self.count)",
                "            self.n, self.start, self.count = self.n + 1, ts, 0",
                "        if self.start is None:",
                "            self.start = ts",
                "        self.last, self.count = ts, self.count + 1",
                "",
                "    def end_partition(self):",
                "        if self.start is not None:",
                "            yield (self.n, self.start, self.count)",
                "$$;"
              ]) },
              { t: "code", lang: "sql", code: lines([
                "SELECT e.user_id, s.session_no, s.session_start, s.events",
                "FROM analytics.events e,",
                "     TABLE(util.sessionize(e.event_ts, 30)",
                "           OVER (PARTITION BY e.user_id ORDER BY e.event_ts)) s;"
              ]) },
              { t: "note", variant: "tip", html: "<code class='tok'>process</code> runs per input row; <code class='tok'>end_partition</code> runs once after each partition's last row. The <code class='tok'>OVER (PARTITION BY ... ORDER BY ...)</code> in the calling query defines both the partitions and the row order your state machine relies on." },
              { t: "h", text: "Vectorized Python UDFs" },
              { t: "code", lang: "python", code: lines([
                "CREATE OR REPLACE FUNCTION ml.score_churn(tenure NUMBER, spend FLOAT, tickets NUMBER)",
                "RETURNS FLOAT",
                "LANGUAGE PYTHON",
                "RUNTIME_VERSION = '3.11'",
                "PACKAGES = ('pandas', 'numpy')",
                "HANDLER = 'score'",
                "AS",
                "$$",
                "import numpy as np",
                "import pandas as pd",
                "from _snowflake import vectorized",
                "",
                "@vectorized(input=pd.DataFrame)",
                "def score(df: pd.DataFrame) -> pd.Series:",
                "    z = 0.8 - 0.03 * df[0] + 0.002 * df[1] + 0.4 * df[2]",
                "    return pd.Series(1.0 / (1.0 + np.exp(-z)))",
                "$$;"
              ]) },
              { t: "p", html: "The handler now receives a pandas DataFrame of many rows (columns are positional) and returns one value per row. Per-row call overhead is paid once per batch, and numpy operations run over whole columns. You can tune the batch size with a <code class='tok'>max_batch_size</code> argument if memory per batch matters." },
              { t: "h", text: "External access" },
              { t: "code", lang: "sql", code: lines([
                "CREATE OR REPLACE NETWORK RULE integ.partner_api_rule",
                "  MODE = EGRESS TYPE = HOST_PORT VALUE_LIST = ('api.acme.example:443');",
                "",
                "CREATE OR REPLACE SECRET integ.partner_api_token",
                "  TYPE = GENERIC_STRING SECRET_STRING = '<PARTNER_API_TOKEN>';   -- set from your vault at deploy time",
                "",
                "CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION partner_api_eai",
                "  ALLOWED_NETWORK_RULES = (integ.partner_api_rule)",
                "  ALLOWED_AUTHENTICATION_SECRETS = (integ.partner_api_token)",
                "  ENABLED = TRUE;",
                "",
                "CREATE OR REPLACE FUNCTION integ.fx_rate(ccy STRING)",
                "RETURNS FLOAT",
                "LANGUAGE PYTHON RUNTIME_VERSION = '3.11'",
                "PACKAGES = ('requests')",
                "EXTERNAL_ACCESS_INTEGRATIONS = (partner_api_eai)",
                "SECRETS = ('token' = integ.partner_api_token)",
                "HANDLER = 'get_rate'",
                "AS",
                "$$",
                "import _snowflake, requests",
                "API_BASE = '<PARTNER_API_BASE>'   # scheme + api.acme.example, injected at deploy",
                "",
                "def get_rate(ccy):",
                "    tok = _snowflake.get_generic_secret_string('token')",
                "    r = requests.get(API_BASE + '/rates/' + ccy, headers={'Authorization': 'Bearer ' + tok}, timeout=10)",
                "    r.raise_for_status()",
                "    return float(r.json()['rate'])",
                "$$;"
              ]) },
              { t: "note", variant: "warn", html: "The secret value never belongs in a script you commit. Create or rotate it from your deployment tool with the value pulled from a vault, and grant USAGE on the integration only to the roles that own the function. An external call per row is also slow: call once per distinct key and cache into a table." },
              { t: "table", headers: ["Need", "Reach for", "Why"], rows: [
                ["Reusable filtered query with arguments", "SQL UDTF", "Inlined; pruning still works"],
                ["One row in, many rows out, or stateful per group", "Python UDTF with end_partition", "process plus partition state"],
                ["Numeric per-row scoring at scale", "Vectorized Python UDF", "Batch overhead amortised"],
                ["Call a partner service", "External access integration", "Explicit egress allow-list and managed secrets"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"explode\", \"sessionise\", \"one row becomes many\", \"parameterised view\" (UDTF); \"score millions of rows with pandas\" (vectorized); \"enrich from a partner service\" or \"call an endpoint from SQL\" (external access)." },
              { t: "quiz", id: "dev-udfs" },
              { t: "note", variant: "key", html: "<strong>UDTFs return rows, vectorized UDFs process batches, external access opens one named door.</strong> Use PARTITION BY to scope UDTF state, vectorize numeric Python, and keep secrets in SECRET objects sourced from a vault." }
            ]
          }
        ]
      },
      /* -------------------------------------------------- snowpark */
      {
        id: "snowpark",
        name: "Snowpark",
        icon: "compass",
        lessons: [
          {
            id: "dataframes",
            title: "Snowpark DataFrames and lazy evaluation",
            summary: "DataFrames are query plans; actions turn them into SQL on the warehouse.",
            minutes: 10,
            tags: ["snowpark", "dataframes", "lazy-evaluation"],
            blocks: [
              { t: "p", html: "A Snowpark DataFrame is <strong>a recipe, not a container</strong>. Every filter, join or select returns a new DataFrame describing a bigger query. Nothing moves until an action asks for results, and then the whole recipe compiles to SQL and runs on the warehouse." },
              { t: "code", lang: "python", code: lines([
                "from snowflake.snowpark.functions import col, lit, sum as sum_",
                "",
                "orders = session.table('RAW.ORDERS')",
                "customers = session.table('RAW.CUSTOMERS')",
                "",
                "by_region = (orders",
                "    .filter(col('STATUS') == lit('SHIPPED'))",
                "    .join(customers, orders['CUSTOMER_ID'] == customers['CUSTOMER_ID'])",
                "    .group_by(col('REGION'))",
                "    .agg(sum_(col('AMOUNT')).alias('TOTAL')))      # still nothing executed",
                "",
                "by_region.write.mode('overwrite').save_as_table('MART.REVENUE_BY_REGION')   # action: one query"
              ]) },
              { t: "table", headers: ["Transformations (lazy)", "Actions (execute SQL)"], rows: [
                ["filter / where, select, with_column", "collect(), to_local_iterator()"],
                ["join, union_all, distinct", "show() (adds a LIMIT)"],
                ["group_by().agg(), window functions", "count(), first()"],
                ["sort, limit, drop, rename", "to_pandas(), write.save_as_table(), cache_result()"]
              ] },
              { t: "widget", id: "lazyLab" },
              { t: "h", text: "Reading what will run" },
              { t: "code", lang: "python", code: lines([
                "for q in by_region.queries['queries']:",
                "    print(q)              # the SQL Snowpark will send",
                "",
                "by_region.explain()      # SQL plus the Snowflake logical plan"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Every action reruns the plan.</strong> <code class='tok'>df.count()</code> followed by <code class='tok'>df.collect()</code> executes the full pipeline twice. A <code class='tok'>for</code> loop that calls <code class='tok'>collect()</code> per item is N queries. Look at Query History filtered by your session when a job feels slow." },
              { t: "h", text: "Push work down, pull results up" },
              { t: "compare",
                bad: { title: "Pull, then compute", items: ["to_pandas() on the raw table", "Filter and aggregate in client memory", "Network transfer of every row", "Client runs out of memory at scale"] },
                good: { title: "Compute, then pull", items: ["filter, join and agg as DataFrame operations", "Warehouse does the heavy lifting", "Only the small result crosses the wire", "Same code scales by resizing the warehouse"] } },
              { t: "code", lang: "python", code: lines([
                "# materialise an expensive intermediate once, then reuse it",
                "base = orders.filter(col('ORDER_DATE') >= lit('2026-01-01')).cache_result()   # temp table",
                "",
                "n_rows = base.count()                          # reads the temp table",
                "top = base.sort(col('AMOUNT').desc()).limit(20).collect()",
                "print(n_rows, len(top))"
              ]) },
              { t: "table", headers: ["Tier", "Monthly revenue job in Snowpark", "Trade-off"], rows: [
                ["Naive", "to_pandas() each source, merge and aggregate in pandas", "Every row shipped to the client; memory-bound"],
                ["Solid", "DataFrame filter/join/agg, single save_as_table action", "One query, warehouse-scaled"],
                ["Standout", "Solid plus cache_result() for intermediates reused across outputs, query tags for cost attribution, and a check of df.queries in code review", "Minimum scans, attributable cost, no surprise query fan-out"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the job issues hundreds of queries\", \"it was fast in the notebook but slow in production\", \"the client ran out of memory\", \"why did count() take as long as the full job\". Each points to lazy evaluation and action placement." },
              { t: "note", variant: "key", html: "<strong>DataFrames are plans; actions are queries.</strong> Chain transformations freely, minimise and place actions deliberately, use cache_result() for reused intermediates, and never pull rows to the client to do work the warehouse could do." }
            ]
          },
          {
            id: "snowpark-deploy",
            title: "Packages, sessions and deploying Snowpark code",
            summary: "Build sessions from the environment, manage dependencies, and register procedures repeatably.",
            minutes: 11,
            tags: ["snowpark", "deployment", "authentication"],
            blocks: [
              { t: "p", html: "The mental model: your Snowpark code has <strong>two homes</strong>. On a laptop or CI runner it needs a session built from that environment's identity. Inside Snowflake, as a procedure or UDF, the platform hands it a session and supplies its packages. Good deployment keeps both homes driven by configuration, never by values baked into code." },
              { t: "h", text: "Sessions from the environment" },
              { t: "code", lang: "python", code: lines([
                "import os",
                "from snowflake.snowpark import Session",
                "",
                "def session_from_env() -> Session:",
                "    cfg = {",
                "        'account': os.environ['SNOWFLAKE_ACCOUNT'],          # e.g. acme-prod or xy12345.us-east-1",
                "        'user': os.environ['SNOWFLAKE_USER'],",
                "        'authenticator': 'SNOWFLAKE_JWT',                     # key-pair auth for service users",
                "        'private_key_file': os.environ['SNOWFLAKE_PRIVATE_KEY_PATH'],",
                "        'private_key_file_pwd': os.environ.get('SNOWFLAKE_PRIVATE_KEY_PASSPHRASE'),",
                "        'role': os.environ['SNOWFLAKE_ROLE'],",
                "        'warehouse': os.environ['SNOWFLAKE_WAREHOUSE'],",
                "        'database': os.environ['SNOWFLAKE_DATABASE'],        # differs per environment",
                "        'schema': os.environ.get('SNOWFLAKE_SCHEMA', 'PUBLIC'),",
                "    }",
                "    return Session.builder.configs({k: v for k, v in cfg.items() if v}).create()",
                "",
                "# interactive SSO for a human: the user must match the IdP login, often the email form",
                "# Session.builder.configs({'account': ..., 'user': 'first.last@acme.example',",
                "#                          'authenticator': 'externalbrowser'}).create()"
              ]) },
              { t: "code", lang: "text", code: lines([
                "# ~/.snowflake/connections.toml  (outside the repo, file mode 0600)",
                "[dev]",
                "account = \"acme-dev\"",
                "user = \"svc_pipeline\"",
                "authenticator = \"SNOWFLAKE_JWT\"",
                "private_key_file = \"/secure/keys/svc_pipeline.p8\"",
                "role = \"PIPELINE_DEV_ROLE\"",
                "warehouse = \"PIPELINE_DEV_WH\"",
                "database = \"ANALYTICS_DEV\"",
                "",
                "# in code: Session.builder.config('connection_name', os.environ['SNOWFLAKE_CONNECTION']).create()"
              ]) },
              { t: "note", variant: "warn", html: "No passwords, tokens or key material in code, notebooks or committed config. Pass a <em>path</em> to a key file and pull the passphrase from the CI secret store. If a credential ever lands in Git history, rotate it; deleting the commit is not enough." },
              { t: "h", text: "Packages" },
              { t: "code", lang: "sql", code: lines([
                "-- what versions are available to Python handlers in this account?",
                "SELECT package_name, version",
                "FROM INFORMATION_SCHEMA.PACKAGES",
                "WHERE language = 'python' AND package_name IN ('xgboost', 'pandas', 'phonenumbers')",
                "ORDER BY package_name, version DESC;"
              ]) },
              { t: "code", lang: "python", code: lines([
                "from snowflake.snowpark import Session",
                "from snowflake.snowpark.functions import col, sproc",
                "",
                "session = session_from_env()",
                "session.add_packages('snowflake-snowpark-python', 'pandas==2.2.*')",
                "session.add_import('src/acme_rules.zip')          # pure-Python internal library",
                "",
                "@sproc(name='etl.load_orders', is_permanent=True, replace=True,",
                "       stage_location='@etl.deploy_stage', packages=['snowflake-snowpark-python'])",
                "def load_orders(session: Session, batch_id: int) -> str:",
                "    from acme_rules import clean_orders",
                "    df = clean_orders(session.table('RAW.ORDERS').filter(col('BATCH_ID') == batch_id))",
                "    df.write.mode('append').save_as_table('CORE.ORDERS')",
                "    return f'batch {batch_id} loaded'"
              ]) },
              { t: "note", variant: "tip", html: "Pin versions you depend on. An unpinned package resolves to whatever the channel offers when the procedure is created, which can differ between your DEV and PRD deploys months apart." },
              { t: "h", text: "Project-style deployment" },
              { t: "code", lang: "bash", code: lines([
                "# CI job: identity and target come from the environment, never from the repo",
                "export SNOWFLAKE_CONNECTION=\"${TARGET_ENV}\"     # dev | test | prod, mapped to connections.toml",
                "",
                "snow snowpark build                               # package code and dependencies",
                "snow snowpark deploy --replace \\",
                "  --connection \"$SNOWFLAKE_CONNECTION\" \\",
                "  --database \"$SNOWFLAKE_DATABASE\"",
                "",
                "# smoke test the deployed procedure before declaring success",
                "snow sql --connection \"$SNOWFLAKE_CONNECTION\" -q \"CALL etl.load_orders(0)\""
              ]) },
              { t: "table", headers: ["Tier", "Deploying a Snowpark procedure", "Trade-off"], rows: [
                ["Naive", "Paste code into a worksheet in each environment; password in a notebook cell", "Drift between envs, leaked credential"],
                ["Solid", "Code in Git, @sproc or CLI deploy from CI, key-pair auth via env vars, pinned packages", "Repeatable and auditable"],
                ["Standout", "Solid plus database names injected per target, unit tests on handlers with a local session fixture, a smoke CALL and GET_DDL check after deploy, and a rollback to the previous staged artifact", "Promotion is boring, which is the goal"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"works in my notebook but not in the scheduled job\", \"how do we deploy this to PRD\", \"where do the credentials go\", \"the package version is different in prod\". Answer with env-driven sessions, key-pair auth, pinned packages and CI deploys with smoke tests." },
              { t: "quiz", id: "dev-snowpark" },
              { t: "note", variant: "key", html: "<strong>Configuration in, code unchanged.</strong> Build sessions from environment variables and key-file paths, pin packages, register permanent procedures from CI with the target database injected, and smoke-test every deploy." }
            ]
          }
        ]
      }
    ]
  };
})();
