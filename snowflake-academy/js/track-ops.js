/* =====================================================================
   GLACIER · CI/CD & Platform Engineering
   window.TRACKS.ops — modules: cicd / gotchas

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
   Tool flags and provider resource names evolve between releases; the
   lessons say so where it matters and teach the durable concepts.
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

  function pre(text) {
    return h("pre", {
      style: "margin:0;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);" +
        "color:var(--text);font-family:var(--font-mono, monospace);font-size:0.78rem;line-height:1.5;white-space:pre-wrap;overflow-x:auto"
    }, text);
  }

  function badge(text, hex) {
    return h("span", {
      style: "display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600;border:1px solid var(--line);" +
        "background:color-mix(in srgb, " + hex + " 22%, transparent);color:var(--text)"
    }, text);
  }

  var Widgets = {};

  /* ==================================================================
     1. promoteLab — ordered promotion checklist per change type + env
  ================================================================== */
  var PROMOTE_TYPES = {
    table: {
      obj: "ORDERS", base: 3,
      backup: "CREATE TABLE ORDERS_BKP_<DDMON> CLONE ORDERS;",
      deploy: "Versioned migration: ALTER TABLE ORDERS ADD COLUMN IF NOT EXISTS channel VARCHAR, COLUMN IF NOT EXISTS region VARCHAR;",
      validate: "SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'ORDERS' ORDER BY ordinal_position;",
      rollback: "ALTER TABLE ORDERS SWAP WITH ORDERS_BKP_<DDMON>;  -- only safe if nothing wrote to ORDERS since the clone",
      note: "Table changes carry data. A swap-back loses rows written after the clone, so on tables with live writes prefer a forward fix."
    },
    view: {
      obj: "VW_ORDERS_DAILY", base: 1,
      backup: "SELECT GET_DDL('VIEW', 'VW_ORDERS_DAILY');  -- save as VW_ORDERS_DAILY_BKP_<DDMON>.sql",
      deploy: "Repeatable script: CREATE OR REPLACE VIEW VW_ORDERS_DAILY COPY GRANTS AS SELECT ...;",
      validate: "SELECT COUNT(*) FROM VW_ORDERS_DAILY;  -- proves it compiles against this env and returns rows",
      rollback: "Re-run the saved DDL, or revert the repeatable script commit and redeploy.",
      note: "Views hold no data, so rollback is cheap. Forgetting COPY GRANTS silently drops consumer access."
    },
    proc: {
      obj: "SP_REFRESH_ORDERS", base: 2,
      backup: "SELECT GET_DDL('PROCEDURE', 'SP_REFRESH_ORDERS(VARCHAR)');  -- save as SP_REFRESH_ORDERS_BKP_<DDMON>.sql",
      deploy: "Repeatable script: CREATE OR REPLACE PROCEDURE SP_REFRESH_ORDERS(mode VARCHAR) ...;",
      validate: "CALL SP_REFRESH_ORDERS('DRY_RUN');  -- assert the returned status, not just that CALL succeeded",
      rollback: "Re-create from the saved GET_DDL output.",
      note: "CREATE OR REPLACE succeeding proves little: object references in the body resolve at call time. Smoke-call it."
    },
    grant: {
      obj: "REPORTING_RO", base: 2,
      backup: "SHOW GRANTS TO ROLE REPORTING_RO;  -- persist via RESULT_SCAN(LAST_QUERY_ID()) into REPORTING_RO_GRANTS_BKP_<DDMON>",
      deploy: "Terraform plan + apply of the grant resource (reviewed diff, not a console click).",
      validate: "SHOW GRANTS TO ROLE REPORTING_RO;  -- diff against the expected set from code",
      rollback: "Revert the Terraform change and apply; REVOKE anything the plan did not remove.",
      note: "Grants fail open or closed silently: too broad leaks data, too narrow breaks dashboards at 9 a.m."
    },
    yaml: {
      obj: "orders_model.yaml", base: 2,
      backup: "COPY FILES INTO @SEMANTIC_STAGE/backup_<DDMON>/ FROM @SEMANTIC_STAGE FILES = ('orders_model.yaml');",
      deploy: "PUT file://models/orders_model.yaml @SEMANTIC_STAGE AUTO_COMPRESS = FALSE OVERWRITE = TRUE;",
      validate: "Replay the benchmark question set; compare generated SQL and results with the previous model.",
      rollback: "Copy the backed-up YAML back over the live file on the stage.",
      note: "The live file is the only copy that matters to users. Back it up from the stage, not from your laptop."
    }
  };
  var PROMOTE_ENVS = { dev: 0, test: 0, stg: 1, prd: 2 };

  Widgets.promoteLab = function (mount) {
    shell(mount, "checklist", "Promotion checklist builder",
      "Pick what you are changing and where it is going. The checklist is ordered: confirm the target, back up, deploy, validate, and know your rollback before you start.");
    var type = "table", env = "stg";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var t = PROMOTE_TYPES[type] || PROMOTE_TYPES.table;
      var score = t.base + (PROMOTE_ENVS[env] || 0);
      var risk = score >= 4 ? "High" : score >= 2 ? "Medium" : "Low";
      var riskHex = risk === "High" ? "#fb7185" : risk === "Medium" ? "#fbbf24" : "#34d399";
      var steps = [];
      steps.push(["Confirm target", "SELECT CURRENT_ACCOUNT(), CURRENT_DATABASE(), CURRENT_ROLE();  -- the pipeline sets $target_db; you never type it"]);
      if (env === "prd") steps.push(["Approval", "Change ticket approved; the deploy runs as the pipeline service role. Humans hold only the PRD read-only role."]);
      if (env === "dev") steps.push(["Backup", "Optional in DEV: rebuild from code instead. (" + t.backup + ")"]);
      else steps.push(["Backup", t.backup]);
      steps.push(["Deploy", t.deploy]);
      steps.push(["Validate", t.validate]);
      steps.push(["Rollback (ready before you start)", t.rollback]);

      clear(stage);
      var list = h("ol", { style: "margin:0;padding-left:20px;display:grid;gap:8px" });
      for (var i = 0; i < steps.length; i++) {
        list.appendChild(h("li", { style: "color:var(--text)" },
          h("div", { style: "font-weight:600;font-size:0.84rem;margin-bottom:4px;color:var(--accent-ink)" }, steps[i][0]),
          pre(steps[i][1])));
      }
      stage.appendChild(list);
      stage.appendChild(h("p", { style: "font-size:0.84rem;color:var(--text-dim);margin:10px 0 0;line-height:1.5" }, t.note));

      clear(readout);
      readout.appendChild(h("span", { class: "ro" }, "risk ", badge(risk, riskHex)));
      readout.appendChild(ro("backup name", env === "dev" ? "none (rebuild from code)" : t.obj.replace(/\.yaml$/, "").toUpperCase() + "_BKP_<DDMON>"));
      readout.appendChild(ro("steps", steps.length));
      readout.appendChild(ro("target", env.toUpperCase()));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["table", "Table DDL"], ["view", "View"], ["proc", "Procedure"], ["grant", "Grant"], ["yaml", "Semantic YAML"]], 0, function (v) { type = v; paint(); }),
      segment([["dev", "DEV"], ["test", "TS (test)"], ["stg", "STG"], ["prd", "PRD"]], 2, function (v) { env = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. gotchaLab — spot the bug, pick the fix
  ================================================================== */
  var GOTCHAS = [
    {
      name: "VALUES with a function",
      code: "INSERT INTO events (id, payload)\nVALUES (1, PARSE_JSON('{\"type\":\"click\"}'));\n-- SQL compilation error: invalid expression in VALUES clause",
      fixes: ["Cast the literal instead: VALUES (1, '{...}'::VARCHAR)", "INSERT INTO events (id, payload) SELECT 1, PARSE_JSON('{...}') UNION ALL SELECT 2, PARSE_JSON('{...}')", "Wrap the VALUES list in a second pair of parentheses"],
      answer: 1,
      why: "VALUES accepts constants only. Move the rows into a SELECT so functions like PARSE_JSON are evaluated per row, and stack rows with UNION ALL."
    },
    {
      name: "String literal into VARIANT",
      code: "INSERT INTO events (id, payload)\nSELECT 2, '{\"type\":\"view\"}';\nSELECT payload:type FROM events WHERE id = 2;   -- NULL",
      fixes: ["Use payload['type'] instead of payload:type", "Change the column type to OBJECT", "Insert PARSE_JSON('{\"type\":\"view\"}') so the VARIANT holds an object"],
      answer: 2,
      why: "A quoted literal types as VARCHAR, so the VARIANT stores a JSON string, not an object. Path access on a string returns NULL. PARSE_JSON turns the text into a real object."
    },
    {
      name: "Two columns, two ADDs",
      code: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel VARCHAR,\n                   ADD COLUMN IF NOT EXISTS region  VARCHAR;\n-- syntax error",
      fixes: ["One ADD, then comma-separated COLUMN IF NOT EXISTS clauses: ADD COLUMN IF NOT EXISTS channel VARCHAR, COLUMN IF NOT EXISTS region VARCHAR", "Remove IF NOT EXISTS: it is not supported on columns", "Run two separate ALTER TABLE statements; multi-column ADD does not exist"],
      answer: 0,
      why: "Use a single ADD keyword and repeat COLUMN IF NOT EXISTS for each column. Two statements also work but lose atomicity and double the migration noise."
    },
    {
      name: "DECRYPT returns bytes",
      code: "SELECT DECRYPT(pwd, $passphrase) AS secret\nFROM app_connections;\n-- shows hex bytes; comparisons to text never match",
      fixes: ["TRY_TO_VARCHAR(DECRYPT(pwd, $passphrase))", "TO_VARCHAR(DECRYPT(pwd, $passphrase), 'UTF-8')", "DECRYPT(pwd, $passphrase)::NUMBER"],
      answer: 1,
      why: "DECRYPT returns BINARY. Convert with TO_VARCHAR(..., 'UTF-8') or CAST(... AS VARCHAR). There is no TRY_TO_VARCHAR function, and the passphrase belongs in a variable or secret, never in the script."
    },
    {
      name: "NOT IN meets NULL",
      code: "SELECT c.id FROM customers c\nWHERE c.id NOT IN (SELECT o.customer_id FROM orders o);\n-- 0 rows, although many customers never ordered",
      fixes: ["Add DISTINCT to the subquery", "Append OR c.id IS NULL to the predicate", "NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)"],
      answer: 2,
      why: "One NULL customer_id makes every NOT IN comparison UNKNOWN, so nothing qualifies. NOT EXISTS evaluates per row and ignores NULLs on the inner side."
    },
    {
      name: "Quoted identifier",
      code: "CREATE TABLE \"orderLines\" (\"lineId\" NUMBER);\nSELECT lineid FROM orderlines;\n-- Object 'ORDERLINES' does not exist",
      fixes: ["Retry: unquoted names are case-insensitive so it should work", "Quote exactly (SELECT \"lineId\" FROM \"orderLines\"), or create objects unquoted so they store upper-case", "ALTER SESSION SET CASE = LOWER"],
      answer: 1,
      why: "Unquoted identifiers fold to upper case; quoted ones keep their exact case. Mixing the two forms is the bug. Standardise on unquoted names in DDL."
    },
    {
      name: "Session-dependent timestamp",
      code: "CREATE TABLE audit (at TIMESTAMP);          -- maps to TIMESTAMP_NTZ by default\nINSERT INTO audit SELECT CURRENT_TIMESTAMP(); -- session TIMEZONE wall clock, offset dropped",
      fixes: ["Store TIMESTAMP_LTZ or TIMESTAMP_TZ, or convert to UTC explicitly before storing NTZ", "Nothing to fix: NTZ always stores UTC", "Set TIMEZONE on every dashboard instead"],
      answer: 0,
      why: "NTZ stores a wall-clock value with no zone. Writers in different session time zones store different instants with no way to tell them apart. Use LTZ/TZ, or normalise to UTC on the way in."
    }
  ];

  Widgets.gotchaLab = function (mount) {
    shell(mount, "spot the bug", "SQL gotcha clinic",
      "Pick a snippet, read the symptom, and choose the fix. Each one is a failure mode that survives code review because the SQL looks reasonable.");
    var idx = 0, picked = {}, correct = 0, attempted = 0;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var select = h("select", { class: "w-field", "aria-label": "Choose a snippet" });
    for (var i = 0; i < GOTCHAS.length; i++) select.appendChild(h("option", { value: String(i) }, (i + 1) + ". " + GOTCHAS[i].name));
    select.addEventListener("change", function () { idx = parseInt(select.value, 10) || 0; paint(); });

    function choose(fi) {
      if (picked[idx] == null) {
        attempted++;
        if (fi === GOTCHAS[idx].answer) correct++;
      }
      picked[idx] = fi;
      paint();
    }

    function paint() {
      var g = GOTCHAS[idx] || GOTCHAS[0];
      clear(stage);
      stage.appendChild(pre(g.code));
      var opts = h("div", { style: "display:grid;gap:6px;margin-top:10px" });
      for (var f = 0; f < g.fixes.length; f++) {
        (function (fi) {
          var cls = "w-btn" + (picked[idx] === fi ? " primary" : " ghost");
          var b = h("button", { type: "button", class: cls, style: "text-align:left;white-space:normal" }, String.fromCharCode(65 + fi) + ". " + g.fixes[fi]);
          b.addEventListener("click", function () { choose(fi); });
          opts.appendChild(b);
        })(f);
      }
      stage.appendChild(opts);
      var verdict = "not answered";
      if (picked[idx] != null) {
        var ok = picked[idx] === g.answer;
        verdict = ok ? "correct" : "incorrect (answer " + String.fromCharCode(65 + g.answer) + ")";
        stage.appendChild(h("p", { style: "font-size:0.84rem;color:var(--text-dim);margin:10px 0 0;line-height:1.5" }, g.why));
      }
      clear(readout);
      readout.appendChild(ro("snippet", (idx + 1) + " / " + GOTCHAS.length));
      readout.appendChild(ro("verdict", verdict));
      readout.appendChild(ro("score", correct + " / " + attempted));
    }

    mount.appendChild(h("div", { class: "widget-controls" }, select));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. splitLab — which statements does the deploy driver execute?
  ================================================================== */
  var SPLIT_STMTS = [
    { kind: "USE", text: "-- ==== release 2026.10 : orders domain ====\nUSE SCHEMA IDENTIFIER($target_schema);" },
    { kind: "TABLE", text: "CREATE TABLE IF NOT EXISTS JOB_AUDIT (\n  job_id NUMBER, status VARCHAR, logged_at TIMESTAMP_LTZ\n);" },
    { kind: "VIEW", text: "-- ---- VW_ORDERS_DAILY ----\nCREATE OR REPLACE VIEW VW_ORDERS_DAILY COPY GRANTS AS\n  SELECT order_date, COUNT(*) AS n FROM ORDERS GROUP BY 1;" },
    { kind: "PROC", text: "-- ---- SP_REFRESH_ORDERS ----\n-- owner: platform team\nCREATE OR REPLACE PROCEDURE SP_REFRESH_ORDERS(mode VARCHAR) ...;" },
    { kind: "DML", text: "-- disabled on purpose; kept for reference\n-- DELETE FROM STAGING_ORDERS WHERE load_date < DATEADD(day, -30, CURRENT_DATE());" },
    { kind: "GRANT", text: "GRANT SELECT ON VIEW VW_ORDERS_DAILY TO ROLE REPORTING_RO;" }
  ];

  function isExecutableRobust(stmt) {
    var lines = stmt.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].replace(/^\s+|\s+$/g, "");
      if (s && s.indexOf("--") !== 0) return true;
    }
    return false;
  }
  function isExecutableNaive(stmt) {
    return stmt.replace(/^\s+/, "").indexOf("--") !== 0;
  }

  Widgets.splitLab = function (mount) {
    shell(mount, "deploy driver", "Comment banners vs the statement filter",
      "A release script is split into statements, then filtered. Flip between the naive filter and the robust one and see which statements actually reach Snowflake.");
    var mode = "naive";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var run = 0, skipped = 0, lost = 0;
      clear(stage);
      var grid = h("div", { style: "display:grid;gap:8px" });
      for (var i = 0; i < SPLIT_STMTS.length; i++) {
        var s = SPLIT_STMTS[i];
        var exec = mode === "naive" ? isExecutableNaive(s.text) : isExecutableRobust(s.text);
        var meaningful = isExecutableRobust(s.text);
        if (exec) run++; else skipped++;
        if (!exec && meaningful) lost++;
        var label = exec ? "EXECUTE" : (meaningful ? "SKIPPED (real SQL lost)" : "SKIPPED (comment only)");
        var hex = exec ? "#34d399" : (meaningful ? "#fb7185" : "#94a3b8");
        grid.appendChild(h("div", { style: "border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--surface-2)" },
          h("div", { style: "display:flex;gap:8px;align-items:center;margin-bottom:6px;font-size:0.78rem;color:var(--text-dim)" },
            h("span", {}, "#" + (i + 1) + " " + s.kind), badge(label, hex)),
          pre(s.text)));
      }
      stage.appendChild(pre(mode === "naive"
        ? "if stmt.strip().startswith(\"--\"):\n    continue          # banner in front of SQL -> whole statement dropped"
        : "def is_executable(stmt):\n    return any(l.strip() and not l.strip().startswith(\"--\")\n               for l in stmt.splitlines())"));
      stage.appendChild(h("div", { style: "height:10px" }));
      stage.appendChild(grid);
      clear(readout);
      readout.appendChild(ro("filter", mode === "naive" ? "startswith('--')" : "any non-comment line"));
      readout.appendChild(ro("executed", run + " / " + SPLIT_STMTS.length));
      readout.appendChild(ro("skipped", skipped));
      readout.appendChild(ro("real statements silently lost", lost));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["naive", "Naive: startswith('--')"], ["robust", "Robust: any non-comment line"]], 0, function (v) { mode = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "ops-cicd": {
      title: "Delivery pipelines checkpoint",
      sub: "schemachange, Terraform, dbt and environment promotion.",
      questions: [
        {
          q: "A versioned schemachange script V2.4.0__add_region.sql was applied to STG last week. You fix a typo inside the same file and rerun the pipeline. What happens?",
          options: [
            "schemachange re-applies it because the file contents changed",
            "Nothing: version 2.4.0 is already recorded in the change history, so you need a new versioned script for the fix",
            "schemachange converts it into a repeatable script automatically",
            "The change history table is rebuilt from scratch and every script reruns"
          ],
          answer: 1,
          explain: "Versioned scripts run once per environment and are tracked by version in the change history table. Editing an applied script does not rerun it, and it makes the repo lie about what each environment contains. Ship the fix as the next version instead."
        },
        {
          q: "When does schemachange rerun a repeatable (R__) script?",
          options: [
            "On every deploy, unconditionally",
            "Only when a new versioned script is added",
            "When the script's checksum differs from the last applied checksum",
            "Only when run with a dry-run flag"
          ],
          answer: 2,
          explain: "Repeatable scripts are re-applied when their content changes, which schemachange detects by checksum. That is why they suit idempotent CREATE OR REPLACE objects such as views and procedures. Scripts that must run every time use the always (A__) prefix."
        },
        {
          q: "Your dbt project materializes tables on Snowflake without setting the transient config. What is the practical consequence for those tables?",
          options: [
            "They are transient by default, so they have no Fail-safe and at most one day of Time Travel",
            "They are temporary and disappear when the dbt session ends",
            "They are permanent with 90 days of Time Travel",
            "They are created as external tables over the stage"
          ],
          answer: 0,
          explain: "The dbt Snowflake adapter creates tables as transient unless you set transient: false. That lowers storage cost because there is no Fail-safe, but recovery is limited to at most one day of Time Travel. For tables that are rebuilt from source that trade is usually fine; for anything irreplaceable, make it permanent."
        },
        {
          q: "A deploy script must target CORE_DEV, CORE_STG or CORE_PRD depending on the pipeline stage. Which approach is correct?",
          options: [
            "Keep three copies of the script, one per database name",
            "Hardcode CORE_PRD and use find-and-replace in lower environments",
            "Rely on the deploy user's default database and never qualify names",
            "Have the pipeline pass the database name in, then use SET target_db and IDENTIFIER($target_db) or templating variables"
          ],
          answer: 3,
          explain: "Environment names belong in pipeline configuration, injected at run time through session variables, schemachange vars or dbt targets. One script then deploys everywhere, and a review can never miss a stray hardcoded PRD name. Relying on the default database is fragile because one user setting change redirects the deploy."
        },
        {
          q: "Which split of ownership between Terraform and migration tools is the most maintainable?",
          options: [
            "Terraform manages every table and column so all state lives in one place",
            "Migration scripts create warehouses and roles; Terraform manages views",
            "Terraform owns account-level objects (warehouses, databases, roles, grants, monitors); schemachange or dbt own objects inside schemas",
            "Everything is created by hand in the console and documented in a wiki"
          ],
          answer: 2,
          explain: "Terraform shines at declarative, slow-changing platform objects and access. Tables evolve through ordered, data-preserving changes that a plan-and-replace model handles poorly, which is what migrations and dbt are for. Clear ownership also prevents two tools fighting over the same object."
        },
        {
          q: "Before an UPDATE to the shared JOB_CONFIG table in STG, what is the most useful backup step?",
          options: [
            "CREATE TABLE JOB_CONFIG_BKP_<DDMON> CLONE JOB_CONFIG, so rollback is a SWAP or an INSERT from the clone",
            "Export the table to CSV on your laptop",
            "Rely on Fail-safe, which you can query directly",
            "Skip it because Time Travel keeps 90 days on every table"
          ],
          answer: 0,
          explain: "A zero-copy clone is instant, costs storage only for rows that later diverge, and gives a named restore point anyone on the team can find. Fail-safe is only recoverable through Snowflake support, and Time Travel retention depends on edition, table type and settings, so it is a safety net rather than a plan."
        }
      ]
    },
    "ops-gotchas": {
      title: "Field notes checkpoint",
      sub: "SQL and deployment gotchas, connectivity, and the Databricks comparison.",
      questions: [
        {
          q: "INSERT INTO t (id, payload) VALUES (1, PARSE_JSON('{\"a\":1}')) fails at compile time. What is the idiomatic fix?",
          options: [
            "Insert the JSON text as a plain string literal into the VARIANT column",
            "Change payload to VARCHAR and parse it in every query",
            "INSERT INTO t (id, payload) SELECT 1, PARSE_JSON('{\"a\":1}') UNION ALL SELECT ... for further rows",
            "Run ALTER SESSION to enable functions in VALUES"
          ],
          answer: 2,
          explain: "VALUES only accepts constants, so function calls must move into a SELECT. Stacking rows with UNION ALL keeps it one statement. Inserting the plain string instead would store a JSON string inside the VARIANT, so path lookups would return NULL."
        },
        {
          q: "WHERE id NOT IN (SELECT customer_id FROM orders) returns no rows, yet many customers have never ordered. What is the most likely cause?",
          options: [
            "orders.customer_id contains at least one NULL",
            "The subquery needs DISTINCT",
            "The result cache returned a stale answer",
            "NOT IN is not supported with subqueries"
          ],
          answer: 0,
          explain: "Comparing anything with NULL yields UNKNOWN, so a single NULL in the list makes every NOT IN test fail to be TRUE. NOT EXISTS with a correlated predicate does not have this problem. Filtering NULLs in the subquery also works, but it is easy to forget."
        },
        {
          q: "After a release, three views and a procedure are missing in STG even though the deploy log says success. Each object in the script starts with a comment banner. What should you suspect first?",
          options: [
            "Snowflake drops views that have comments",
            "The deploy role lacks CREATE VIEW, and the error was swallowed by Snowflake",
            "The objects were created in Fail-safe",
            "The driver skips any statement whose text starts with '--', which drops banner-prefixed CREATE statements"
          ],
          answer: 3,
          explain: "When a script is split into statements, the comment banner travels with the statement that follows it. A filter that skips anything starting with '--' throws away the real SQL behind the banner, silently. Treat a statement as executable if any stripped line is non-empty and not a comment."
        },
        {
          q: "CALL SP_LOAD() returns {\"status\":\"FAILED\",\"error\":\"Object does not exist\"} but the orchestrator marks the step green. Why?",
          options: [
            "Snowflake retries failed procedures automatically",
            "The procedure's EXCEPTION handler catches the error and returns an object, so the CALL itself succeeds",
            "The orchestrator ran in a lower environment",
            "Object-not-found errors are warnings in Snowflake Scripting"
          ],
          answer: 1,
          explain: "An EXCEPTION WHEN ... THEN RETURN OBJECT_CONSTRUCT(...) block turns a failure into a normal return value. The caller must inspect the returned status and fail the step itself. To debug, run the generated SQL standalone so you see the raw error and line."
        },
        {
          q: "An interactive SSO connection with authenticator externalbrowser fails with a message that the user differs from the user logged in at the identity provider. What is the usual fix?",
          options: [
            "Switch to password authentication",
            "Use the account locator instead of the org-account name",
            "Set the Snowflake user parameter to the login name the IdP asserts, usually the email form",
            "Add the client IP to the network policy"
          ],
          answer: 2,
          explain: "With browser SSO, Snowflake compares the user you asked for with the identity the IdP returns. If the IdP asserts an email address, the connection's user must be that email form. Network policy and account identifier problems produce different errors."
        },
        {
          q: "Two teams, one on Snowflake and one on Databricks, want a single copy of a large fact table that both can read without nightly exports. Which approach fits best?",
          options: [
            "Copy the table into each platform nightly and reconcile row counts",
            "Point Databricks at Snowflake's internal micro-partition files directly",
            "Use a reader account so Databricks can query Snowflake storage",
            "Store it as an Iceberg table in shared object storage with a catalog both engines can use"
          ],
          answer: 3,
          explain: "Apache Iceberg is the common open table format both platforms read and write, so one copy in your own object storage can serve both. Snowflake's native storage is not designed to be read by other engines, and reader accounts serve Snowflake consumers only. Governance still needs care, because each engine enforces its own policies."
        },
        {
          q: "SELECT DECRYPT(pwd, '<passphrase>') FROM conn_cfg returns a hex-looking value, and comparing it to a VARCHAR never matches. Why?",
          options: [
            "DECRYPT returns BINARY, so the result must be converted with TO_VARCHAR(..., 'UTF-8') or CAST to VARCHAR",
            "The passphrase is wrong, so DECRYPT returned random bytes",
            "DECRYPT only works on VARIANT columns",
            "The column needs a masking policy before DECRYPT works"
          ],
          answer: 0,
          explain: "ENCRYPT and DECRYPT operate on BINARY, so the decrypted value is bytes that the client renders as hex. Convert it to text explicitly before comparing it or handing it to anything that expects a string. A wrong passphrase raises an error rather than returning garbage."
        },
        {
          q: "A migration must add three columns to a table that some environments already partly have. Which statement is valid and idempotent?",
          options: [
            "ALTER TABLE t ADD COLUMN IF NOT EXISTS (c1 INT, c2 INT, c3 INT)",
            "ALTER TABLE t ADD IF NOT EXISTS COLUMN c1 INT, c2 INT, c3 INT",
            "ALTER TABLE t ADD COLUMN IF NOT EXISTS c1 INT, COLUMN IF NOT EXISTS c2 INT, COLUMN IF NOT EXISTS c3 INT",
            "ALTER TABLE t ADD COLUMN c1 INT IF NOT EXISTS, c2 INT IF NOT EXISTS, c3 INT IF NOT EXISTS"
          ],
          answer: 2,
          explain: "A single ADD takes a comma-separated list of COLUMN clauses, and IF NOT EXISTS belongs to each clause. Without the per-column guard, the environments that already have c1 fail the whole statement. Parenthesised column lists are not accepted for ADD."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ops = {
    id: "ops",
    name: "CI/CD & Platform Engineering",
    short: "OPS",
    tagline: "Ship Snowflake changes like software",
    color: "#2dd4bf",
    blurb: "Treat the warehouse like a codebase. Version schema changes with schemachange, own account-level objects with the Terraform provider, build models with dbt, and promote safely across environment databases with parameterised names, zero-copy clones and named backups. Then the field notes: the SQL and deployment gotchas that bite experienced engineers, and a balanced comparison with Databricks and Delta Lake.",
    modules: [
      {
        id: "cicd",
        name: "Delivery Pipelines",
        icon: "wrench",
        lessons: [
          /* ---------------------------------------------------------- */
          {
            id: "schemachange",
            title: "schemachange: versioned, repeatable and always scripts",
            summary: "A migration tool that applies numbered SQL scripts once, reapplies idempotent ones when they change, and records every run in a history table.",
            minutes: 10,
            tags: ["schemachange", "migrations", "cicd"],
            blocks: [
              { t: "p", html: "Hold this picture: your repo is an <strong>ordered log of changes</strong>, and each environment database remembers how far through that log it has got. schemachange reads a folder of SQL files, compares it with a <em>change history table</em> in the target account, and runs only what that environment has not seen yet. It is imperative, not declarative: you write the <code class='tok'>ALTER</code>, not the desired end state." },
              { t: "h", text: "How it decides what to run" },
              { t: "table", headers: ["Prefix", "Example", "Runs when", "Use it for"], rows: [
                ["<code class='tok'>V</code> versioned", "<code class='tok'>V1.3.0__add_orders_channel.sql</code>", "Once, in version order, if its version is newer than the highest applied", "Table DDL, data backfills, anything not safely re-runnable"],
                ["<code class='tok'>R</code> repeatable", "<code class='tok'>R__vw_orders_daily.sql</code>", "After versioned scripts, whenever its checksum changes", "Views, procedures, functions: <code class='tok'>CREATE OR REPLACE</code> objects"],
                ["<code class='tok'>A</code> always", "<code class='tok'>A__refresh_grants.sql</code>", "Last, on every deploy", "Idempotent housekeeping such as grant re-application"]
              ] },
              { t: "code", lang: "text", code:
                "migrations/\n" +
                "  V1.0.0__create_core_schema.sql\n" +
                "  V1.1.0__create_orders.sql\n" +
                "  V1.3.0__add_orders_channel.sql\n" +
                "  R__vw_orders_daily.sql\n" +
                "  R__sp_refresh_orders.sql\n" +
                "  A__grants_reporting.sql\n" +
                "# double underscore separates version from description"
              },
              { t: "p", html: "Every run writes a row to the change history table (by default under a <code class='tok'>METADATA.SCHEMACHANGE</code> schema; the location is configurable): version, script name, checksum, who ran it, when, and how long it took. That table is your audit trail and the first place to look when an environment seems out of step." },
              { t: "code", lang: "sql", code:
                "-- what has this environment actually received?\n" +
                "SELECT version, script, checksum, installed_by, installed_on, status\n" +
                "FROM   IDENTIFIER($change_history_table)\n" +
                "ORDER  BY installed_on DESC\n" +
                "LIMIT  20;"
              },
              { t: "h", text: "Templating instead of hardcoding" },
              { t: "p", html: "Scripts are rendered with Jinja before they run, so database names, warehouse names and retention settings come from variables the pipeline supplies. The same file then deploys to DEV, test, STG and PRD unchanged." },
              { t: "code", lang: "sql", code:
                "-- V1.3.0__add_orders_channel.sql\n" +
                "USE DATABASE {{ target_db }};\n" +
                "USE SCHEMA CORE;\n" +
                "\n" +
                "-- one ADD, COLUMN IF NOT EXISTS repeated per column\n" +
                "ALTER TABLE ORDERS ADD COLUMN IF NOT EXISTS channel VARCHAR,\n" +
                "                       COLUMN IF NOT EXISTS region  VARCHAR;\n" +
                "\n" +
                "ALTER TABLE ORDERS SET DATA_RETENTION_TIME_IN_DAYS = {{ retention_days }};"
              },
              { t: "code", lang: "bash", code:
                "# CI step: every value comes from pipeline variables or the secret store\n" +
                "# (flag names differ across schemachange versions; newer releases also read a connections.toml)\n" +
                "schemachange deploy \\\n" +
                "  --root-folder migrations \\\n" +
                "  --connection-name \"$SNOWFLAKE_CONNECTION\" \\\n" +
                "  --change-history-table \"$CHANGE_HISTORY_TABLE\" \\\n" +
                "  --vars \"{\\\"target_db\\\": \\\"$TARGET_DB\\\", \\\"retention_days\\\": $RETENTION_DAYS}\" \\\n" +
                "  --create-change-history-table\n" +
                "\n" +
                "# key-pair auth: the private key path is injected, never committed\n" +
                "#   SNOWFLAKE_PRIVATE_KEY_PATH=$RUNNER_TEMP/deploy_key.p8"
              },
              { t: "note", variant: "warn", html: "Editing a versioned script that already ran does nothing in that environment, but it will run in the <em>next</em> fresh one. Your environments then diverge while the repo looks consistent. Treat applied versioned scripts as immutable and ship fixes as the next version." },
              { t: "table", headers: ["Tier", "Practice", "Why it falls short or wins"], rows: [
                ["Naive", "Engineers run SQL by hand in each environment and paste it into a wiki", "No record of what ran where; PRD drifts from STG within weeks"],
                ["Solid", "schemachange in CI with templated database names and a per-env change history table", "Repeatable, auditable, one script for every environment"],
                ["Standout", "Solid, plus a dry run on pull requests, a disposable clone to test against, and post-deploy validation queries", "Breakage is found on a clone before merge, and success means verified, not merely executed"]
              ] },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Migration tools give you precise control over <em>how</em> data-bearing objects change, at the cost of discipline: ordering mistakes, out-of-order versions on parallel branches, and hand edits outside the tool all create drift that schemachange will not detect. Declarative tools compute the diff for you but tend to want to drop and recreate, which is unacceptable for a table holding years of history." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"how do you promote DDL safely\", \"environments drifted\", \"who changed this table\", \"we run scripts by hand\", \"same script for dev and prod\". Reach for versioned migrations plus a change history table and templated names." },
              { t: "note", variant: "key", html: "<strong>Versioned scripts run once, repeatables rerun on change, always-scripts run every time.</strong> Never edit an applied versioned script, and never hardcode the database it targets." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "terraform",
            title: "The Terraform provider for account-level objects",
            summary: "Use Terraform for warehouses, databases, roles, grants, users and monitors, and leave objects inside schemas to migrations and dbt.",
            minutes: 11,
            tags: ["terraform", "iac", "rbac"],
            blocks: [
              { t: "p", html: "Think of Terraform as the owner of the <strong>shape of the platform</strong>: which warehouses exist and how big they are, which databases and roles exist, who is granted what, and which guardrails watch spending. Those objects change slowly, and their desired state is easy to declare. The objects <em>inside</em> schemas change constantly and carry data, so they belong to a different tool." },
              { t: "table", headers: ["Object", "Owner", "Reason"], rows: [
                ["Warehouses, resource monitors", "Terraform", "Declarative sizing and guardrails; drift is visible in plan"],
                ["Databases, schemas (containers)", "Terraform", "Created once per environment; guarded against destroy"],
                ["Account roles, role hierarchy, grants", "Terraform", "Access is policy; reviewed diffs beat console clicks"],
                ["Service users, network policies", "Terraform", "Keys and allowed networks managed as code (values from a vault)"],
                ["Tables, columns, backfills", "schemachange", "Ordered, data-preserving change"],
                ["Transform models, tests", "dbt", "Dependency graph, testing and docs"]
              ] },
              { t: "h", text: "Provider configuration without secrets" },
              { t: "code", lang: "text", code:
                "# versions.tf -- pin the provider; resource names and arguments change between major versions\n" +
                "terraform {\n" +
                "  required_providers {\n" +
                "    snowflake = {\n" +
                "      source  = \"snowflakedb/snowflake\"\n" +
                "      version = \"~> 2.0\"\n" +
                "    }\n" +
                "  }\n" +
                "}\n" +
                "\n" +
                "# provider.tf -- every value is a variable fed by the pipeline\n" +
                "provider \"snowflake\" {\n" +
                "  organization_name = var.sf_org          # e.g. acme\n" +
                "  account_name      = var.sf_account      # e.g. acme-prod\n" +
                "  user              = var.sf_deploy_user\n" +
                "  role              = var.sf_deploy_role\n" +
                "  authenticator     = \"SNOWFLAKE_JWT\"\n" +
                "  private_key       = file(var.sf_private_key_path)\n" +
                "}\n" +
                "\n" +
                "variable \"sf_private_key_path\" {\n" +
                "  type      = string\n" +
                "  sensitive = true\n" +
                "}"
              },
              { t: "note", variant: "warn", html: "Terraform state can contain sensitive attributes in plain text. Use a remote backend with encryption at rest and tight access, mark secret variables <code class='tok'>sensitive = true</code>, and feed the private key path from the runner's secret store. A key committed next to the HCL is a key you must rotate today." },
              { t: "h", text: "Resources, parameterised per environment" },
              { t: "code", lang: "text", code:
                "variable \"env\" { type = string }   # dev | ts1 | stg | prd, set per workspace\n" +
                "\n" +
                "resource \"snowflake_warehouse\" \"transform\" {\n" +
                "  name                = upper(\"TRANSFORM_${var.env}_WH\")\n" +
                "  warehouse_size      = var.env == \"prd\" ? \"MEDIUM\" : \"XSMALL\"\n" +
                "  auto_suspend        = 60\n" +
                "  auto_resume         = true\n" +
                "  initially_suspended = true\n" +
                "}\n" +
                "\n" +
                "resource \"snowflake_database\" \"core\" {\n" +
                "  name = upper(\"CORE_${var.env}\")\n" +
                "  lifecycle { prevent_destroy = true }   # a destroy here is data loss\n" +
                "}\n" +
                "\n" +
                "resource \"snowflake_account_role\" \"reporting_ro\" {\n" +
                "  name = upper(\"REPORTING_${var.env}_RO\")\n" +
                "}\n" +
                "\n" +
                "resource \"snowflake_grant_privileges_to_account_role\" \"ro_usage\" {\n" +
                "  account_role_name = snowflake_account_role.reporting_ro.name\n" +
                "  privileges        = [\"USAGE\"]\n" +
                "  on_account_object {\n" +
                "    object_type = \"DATABASE\"\n" +
                "    object_name = snowflake_database.core.name\n" +
                "  }\n" +
                "}"
              },
              { t: "code", lang: "bash", code:
                "# one workspace (or state key) per environment; inputs from CI variables\n" +
                "export TF_VAR_env=\"$DEPLOY_ENV\"\n" +
                "export TF_VAR_sf_private_key_path=\"$SNOWFLAKE_PRIVATE_KEY_PATH\"\n" +
                "terraform init -backend-config=\"key=snowflake/${DEPLOY_ENV}.tfstate\"\n" +
                "terraform plan -out=tfplan        # reviewed in the pull request\n" +
                "terraform apply tfplan            # only after approval"
              },
              { t: "h", text: "Drift, imports and the sharp edges" },
              { t: "p", html: "When someone resizes a warehouse in the console, the next <code class='tok'>plan</code> shows the difference and proposes to put it back. That is the feature: the code is the source of truth. Existing objects come under management with <code class='tok'>import</code> blocks or <code class='tok'>terraform import</code>, one object at a time, checking that the plan is empty afterwards." },
              { t: "ul", items: [
                "<strong>Pin the provider.</strong> Major releases have renamed resources and split grant resources; an unpinned upgrade can propose destroying and recreating objects.",
                "<strong>Guard data-bearing containers</strong> with <code class='tok'>prevent_destroy</code>; a renamed database resource otherwise plans as destroy plus create.",
                "<strong>One owner per object.</strong> If Terraform grants SELECT on a schema and a migration script also does, they will fight on every run.",
                "<strong>Run as a dedicated role</strong> that owns what Terraform creates, so ownership never lands on a person who later leaves."
              ] },
              { t: "table", headers: ["Tier", "Practice", "Why it falls short or wins"], rows: [
                ["Naive", "Warehouses and grants created by hand in the console", "No review, no history, impossible to reproduce an environment"],
                ["Solid", "Terraform per environment with pinned provider, remote encrypted state and key-pair auth", "Reviewed, repeatable, recoverable"],
                ["Standout", "Solid, plus modules shared across environments, prevent_destroy on databases, and a scheduled drift plan that alerts", "Drift is caught within a day instead of at the next incident"]
              ] },
              { t: "compare",
                bad: { title: "Terraform owns tables", items: ["Column changes can plan as replace", "Backfills and data fixes do not fit the model", "State grows with every object"] },
                good: { title: "Terraform owns the platform", items: ["Warehouses, roles, grants, monitors as code", "Tables evolve through ordered migrations", "Each tool does what its model is good at"] }
              },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"someone resized the warehouse\", \"who granted this role\", \"recreate the account for a new region\", \"infrastructure as code for Snowflake\". Reach for Terraform on account-level objects, with secrets kept out of HCL and state protected." },
              { t: "note", variant: "key", html: "<strong>Terraform owns the platform's shape; migrations own the data's shape.</strong> Pin the provider, protect state, guard databases against destroy, and never inline a credential." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "dbt",
            title: "dbt on Snowflake",
            summary: "Target-aware models, Snowflake-specific configs, incremental merges and slim CI that builds only what changed.",
            minutes: 11,
            tags: ["dbt", "transformations", "ci"],
            blocks: [
              { t: "p", html: "dbt turns a folder of <code class='tok'>SELECT</code> statements into a dependency graph and compiles each one into the DDL and DML Snowflake needs. The mental model: <strong>you write what a table should contain; dbt decides how to build it</strong> based on the materialization and the target environment." },
              { t: "code", lang: "text", code:
                "# profiles.yml -- lives outside the repo or reads everything from env vars\n" +
                "glacier:\n" +
                "  target: \"{{ env_var('DBT_TARGET', 'dev') }}\"\n" +
                "  outputs:\n" +
                "    dev:\n" +
                "      type: snowflake\n" +
                "      account: \"{{ env_var('SNOWFLAKE_ACCOUNT') }}\"      # acme-dev\n" +
                "      user: \"{{ env_var('SNOWFLAKE_USER') }}\"\n" +
                "      private_key_path: \"{{ env_var('SNOWFLAKE_PRIVATE_KEY_PATH') }}\"\n" +
                "      role: \"{{ env_var('SNOWFLAKE_ROLE') }}\"\n" +
                "      warehouse: \"{{ env_var('SNOWFLAKE_WAREHOUSE') }}\"\n" +
                "      database: \"{{ env_var('SNOWFLAKE_DATABASE') }}\"\n" +
                "      schema: \"dbt_{{ env_var('USER', 'ci') }}\"\n" +
                "      threads: 8"
              },
              { t: "p", html: "Inside models, never write a database name. Use <code class='tok'>{{ ref('stg_orders') }}</code> and <code class='tok'>{{ source('raw', 'orders') }}</code>, and when you must branch on environment use <code class='tok'>{{ target.name }}</code> or <code class='tok'>{{ target.database }}</code>. Schema naming is controlled by the <code class='tok'>generate_schema_name</code> macro, which most teams override so production gets clean names and developers get isolated ones." },
              { t: "code", lang: "sql", code:
                "-- macros/generate_schema_name.sql\n" +
                "{% macro generate_schema_name(custom_schema_name, node) -%}\n" +
                "  {%- if target.name == 'prd' and custom_schema_name -%}\n" +
                "    {{ custom_schema_name | trim | upper }}\n" +
                "  {%- elif custom_schema_name -%}\n" +
                "    {{ target.schema }}_{{ custom_schema_name | trim }}\n" +
                "  {%- else -%}\n" +
                "    {{ target.schema }}\n" +
                "  {%- endif -%}\n" +
                "{%- endmacro %}"
              },
              { t: "table", headers: ["Materialization", "What Snowflake does", "Cost profile"], rows: [
                ["view", "CREATE OR REPLACE VIEW", "Free to build; compute paid by every reader"],
                ["table", "CREATE OR REPLACE TABLE AS SELECT", "Full rebuild each run; simple and predictable"],
                ["incremental", "MERGE (or delete+insert / append) of new rows into an existing table", "Cheap runs; correctness depends on your filter and unique key"],
                ["ephemeral", "Inlined as a CTE into downstream models", "No object created; can bloat downstream SQL"],
                ["dynamic_table", "CREATE DYNAMIC TABLE with a target lag", "Snowflake schedules refreshes; you pay for refresh compute"]
              ] },
              { t: "code", lang: "sql", code:
                "-- models/marts/fct_orders.sql\n" +
                "{{ config(\n" +
                "    materialized = 'incremental',\n" +
                "    unique_key = 'order_id',\n" +
                "    incremental_strategy = 'merge',\n" +
                "    on_schema_change = 'append_new_columns',\n" +
                "    cluster_by = ['order_date'],\n" +
                "    snowflake_warehouse = var('heavy_wh', target.warehouse),\n" +
                "    query_tag = 'dbt:fct_orders'\n" +
                ") }}\n" +
                "\n" +
                "SELECT order_id, customer_id, order_date, amount, updated_at\n" +
                "FROM {{ ref('stg_orders') }}\n" +
                "{% if is_incremental() %}\n" +
                "  -- small overlap window tolerates late-arriving rows\n" +
                "  WHERE updated_at > (SELECT DATEADD(hour, -3, MAX(updated_at)) FROM {{ this }})\n" +
                "{% endif %}\n" +
                "QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1"
              },
              { t: "note", variant: "trap", html: "If the incoming batch has two rows for the same <code class='tok'>unique_key</code>, Snowflake's MERGE fails with a duplicate-row error (or, with that check disabled, applies an arbitrary one). The <code class='tok'>QUALIFY ROW_NUMBER()</code> dedupe above is not decoration." },
              { t: "h", text: "Slim CI and clones" },
              { t: "code", lang: "bash", code:
                "# pull request job: build only modified models and their children,\n" +
                "# reading unchanged parents from production artifacts\n" +
                "export DBT_TARGET=ci SNOWFLAKE_DATABASE=\"$CI_DATABASE\"\n" +
                "dbt deps\n" +
                "dbt build --select state:modified+ --defer --state ./prod-artifacts --fail-fast"
              },
              { t: "p", html: "For heavier tests, clone production models into the CI schema first with <code class='tok'>dbt clone</code> or a database-level zero-copy clone. You get realistic volumes in seconds, and you pay only for the micro-partitions your test run rewrites." },
              { t: "ul", items: [
                "<code class='tok'>snowflake_warehouse</code> per model: send the one heavy model to a larger warehouse instead of upsizing everything.",
                "<code class='tok'>query_tag</code>: makes dbt runs attributable in query history and cost reports.",
                "<code class='tok'>copy_grants: true</code>: keeps grants when a table or view is replaced.",
                "<code class='tok'>transient</code>: on by default for tables in the Snowflake adapter."
              ] },
              { t: "note", variant: "warn", html: "Because dbt tables are <strong>transient by default</strong>, they have no Fail-safe and at most one day of Time Travel. That is a sensible trade for tables rebuilt from source. For snapshots or anything you cannot regenerate, set <code class='tok'>transient: false</code>." },
              { t: "table", headers: ["Tier", "Practice", "Why it falls short or wins"], rows: [
                ["Naive", "Everything materialized as table, full refresh nightly, one shared dev schema", "Slow, expensive, and developers overwrite each other"],
                ["Solid", "Per-developer schemas, incremental models with dedupe, tests on keys, env-var profiles", "Fast runs, isolated work, no secrets in the repo"],
                ["Standout", "Solid, plus slim CI with defer, clones for realistic tests, query tags and per-model warehouses", "PRs are validated cheaply on real shapes, and cost is attributable per model"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"transformations as code\", \"test our models in CI\", \"incremental load keeps duplicating\", \"dev overwrote prod tables\". Reach for target-aware dbt with incremental dedupe and slim CI." },
              { t: "note", variant: "key", html: "<strong>Models never name a database; targets do.</strong> Dedupe before MERGE, remember tables are transient by default, and let CI build only what changed." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "env-promotion",
            title: "Promoting changes across environment databases",
            summary: "Move changes from DEV through test and STG to PRD with parameterised names, cloned test data, named backups and a read-only production role.",
            minutes: 12,
            tags: ["environments", "promotion", "cloning", "backups"],
            blocks: [
              { t: "p", html: "Picture a conveyor: the <strong>same artifact</strong>, the same scripts at the same commit, moves through DEV, one or more test environments, STG and PRD. Only configuration changes between stops. Each stop must prove something before the next one starts, and every stop that mutates shared state takes a backup first." },
              { t: "diagram", id: "sf-env-promotion", caption: "One commit promoted through environment databases: DEV, test, STG and PRD, with clones for test data and backups before each mutation." },
              { t: "table", headers: ["Topology", "Buys you", "Costs you"], rows: [
                ["Environments as databases in one account (CORE_DEV, CORE_TS1, CORE_STG)", "Zero-copy clone between environments, one set of users and roles, simple networking", "Shared account limits and blast radius; a mis-scoped grant can cross environments"],
                ["Environments as separate accounts (acme-stg, acme-prod)", "Hard isolation of data, roles, network policies and spend", "No cross-account clone (use replication or sharing); duplicated RBAC to keep in sync"],
                ["Hybrid: non-prod databases in one account, PRD in its own", "Cheap, flexible non-prod; isolated production", "Two promotion paths to automate and keep consistent"]
              ] },
              { t: "h", text: "Parameterise every environment-specific name" },
              { t: "code", lang: "sql", code:
                "-- the pipeline sets these; nobody types an environment name into a script\n" +
                "-- (here: snow sql -f deploy.sql -D target_db=$DEPLOY_DB fills in the template)\n" +
                "SET target_db   = '<% target_db %>';\n" +
                "SET fq_orders   = $target_db || '.CORE.ORDERS';\n" +
                "\n" +
                "USE DATABASE IDENTIFIER($target_db);\n" +
                "SELECT COUNT(*) FROM IDENTIFIER($fq_orders);\n" +
                "\n" +
                "-- IDENTIFIER() takes a literal or a variable, so build the full name first\n" +
                "-- rather than concatenating inside the call"
              },
              { t: "h", text: "Test data through zero-copy clones" },
              { t: "code", lang: "sql", code:
                "-- refresh a test environment from STG in seconds; storage is shared until rows diverge\n" +
                "SET source_db = '<% source_db %>';   -- e.g. CORE_STG, injected by the pipeline\n" +
                "SET test_db   = '<% test_db %>';     -- e.g. CORE_TS1\n" +
                "CREATE OR REPLACE DATABASE IDENTIFIER($test_db) CLONE IDENTIFIER($source_db);\n" +
                "\n" +
                "-- or a point in the past, while it is still inside Time Travel\n" +
                "CREATE OR REPLACE TABLE ORDERS_REPRO CLONE ORDERS AT (OFFSET => -3600);"
              },
              { t: "note", variant: "warn", html: "A clone copies the data <em>and</em> its sensitivity. Cloning production into a lower environment moves PII to a place with looser access. Clone from a masked or synthetic source, or make sure masking and row access policies travel with the data and still apply to the roles in that environment." },
              { t: "h", text: "Back up before you mutate shared state" },
              { t: "code", lang: "sql", code:
                "-- naming convention: <NAME>_BKP_<DDMON>, derived from the date at run time\n" +
                "SET bkp = 'JOB_CONFIG_BKP_' || UPPER(TO_CHAR(CURRENT_DATE(), 'DDMON'));   -- e.g. JOB_CONFIG_BKP_14MAR\n" +
                "CREATE TABLE IDENTIFIER($bkp) CLONE JOB_CONFIG;\n" +
                "\n" +
                "SET job_group = '<% job_group %>';\n" +
                "UPDATE JOB_CONFIG SET is_active = FALSE WHERE job_group = $job_group;\n" +
                "\n" +
                "-- rollback if validation fails (only safe if nothing else wrote meanwhile)\n" +
                "ALTER TABLE JOB_CONFIG SWAP WITH IDENTIFIER($bkp);"
              },
              { t: "h", text: "Production is read-only for people" },
              { t: "code", lang: "sql", code:
                "-- humans analyse PRD through a read-only role; only the pipeline role writes\n" +
                "SET prd_db = '<% prd_db %>';\n" +
                "CREATE ROLE IF NOT EXISTS ANALYST_PRD_RO;\n" +
                "GRANT USAGE  ON DATABASE IDENTIFIER($prd_db)                 TO ROLE ANALYST_PRD_RO;\n" +
                "GRANT USAGE  ON ALL SCHEMAS IN DATABASE IDENTIFIER($prd_db)  TO ROLE ANALYST_PRD_RO;\n" +
                "GRANT SELECT ON FUTURE TABLES IN DATABASE IDENTIFIER($prd_db) TO ROLE ANALYST_PRD_RO;\n" +
                "GRANT SELECT ON FUTURE VIEWS  IN DATABASE IDENTIFIER($prd_db) TO ROLE ANALYST_PRD_RO;\n" +
                "-- (plus SELECT ON ALL TABLES/VIEWS for objects that already exist)"
              },
              { t: "widget", id: "promoteLab" },
              { t: "table", headers: ["Tier", "Practice", "Why it falls short or wins"], rows: [
                ["Naive", "Scripts edited per environment, run by hand with an admin role, no backups", "Every promotion is a new, untested change; rollback is guesswork"],
                ["Solid", "One commit promoted through all stages with injected names, named clones before mutation, validation queries", "What reaches PRD is what was tested, and every change has a restore point"],
                ["Standout", "Solid, plus cloned test data refreshed on schedule, approvals gated on validation results, and humans limited to a PRD read-only role", "Production changes happen only through the pipeline, with evidence attached"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"works in STG, broke in PRD\", \"refresh test data\", \"roll back the config change\", \"someone updated prod by hand\". Reach for one promoted artifact, parameterised names, clone-based backups and a read-only production role." },
              { t: "quiz", id: "ops-cicd" },
              { t: "note", variant: "key", html: "<strong>Promote the artifact, inject the names, clone before you mutate, and keep people read-only in PRD.</strong> A backup you cannot name and find in ten seconds is not a backup." }
            ]
          }
        ]
      },
      {
        id: "gotchas",
        name: "Field Notes",
        icon: "broom",
        lessons: [
          /* ---------------------------------------------------------- */
          {
            id: "sql-gotchas",
            title: "SQL gotchas that bite senior engineers",
            summary: "Seven ways reasonable-looking Snowflake SQL fails, silently or loudly, and the fix for each.",
            minutes: 11,
            tags: ["sql", "gotchas", "variant", "timestamps"],
            blocks: [
              { t: "p", html: "These are not beginner mistakes. They survive code review because the SQL reads correctly, and several fail <strong>silently</strong>: no error, just wrong or missing rows. Keep this list next to every migration and data fix you write." },
              { t: "table", headers: ["Gotcha", "Symptom", "Fix"], rows: [
                ["Function inside VALUES", "Compile error: invalid expression in VALUES", "<code class='tok'>INSERT ... SELECT ... UNION ALL SELECT ...</code>"],
                ["JSON string into VARIANT", "<code class='tok'>payload:field</code> returns NULL", "<code class='tok'>PARSE_JSON('...')</code>"],
                ["Two ADDs in one ALTER", "Syntax error", "One ADD, repeat <code class='tok'>COLUMN IF NOT EXISTS</code> per column"],
                ["DECRYPT output", "Bytes instead of text; comparisons never match", "<code class='tok'>TO_VARCHAR(DECRYPT(...), 'UTF-8')</code>"],
                ["Quoted identifiers", "Object does not exist", "Use unquoted (upper-case) names consistently"],
                ["NULL in NOT IN", "Zero rows returned", "<code class='tok'>NOT EXISTS</code>"],
                ["TIMESTAMP default type", "Times shift by the session time zone", "Choose LTZ/TZ deliberately, or store UTC"]
              ] },
              { t: "h", text: "VALUES and VARIANT" },
              { t: "code", lang: "sql", code:
                "-- fails: VALUES accepts constants only\n" +
                "INSERT INTO events (id, payload)\n" +
                "VALUES (1, PARSE_JSON('{\"type\":\"click\"}'));\n" +
                "\n" +
                "-- works: functions are evaluated in a SELECT, rows stacked with UNION ALL\n" +
                "INSERT INTO events (id, payload)\n" +
                "SELECT 1, PARSE_JSON('{\"type\":\"click\"}')\n" +
                "UNION ALL\n" +
                "SELECT 2, PARSE_JSON('{\"type\":\"view\", \"ms\": 420}');"
              },
              { t: "note", variant: "trap", html: "<code class='tok'>INSERT INTO events SELECT 3, '{\"type\":\"view\"}'</code> succeeds, which is the problem. A quoted literal types as VARCHAR, so the VARIANT holds a JSON <em>string</em>. <code class='tok'>TYPEOF(payload)</code> returns VARCHAR and every path lookup returns NULL. Always wrap JSON text in <code class='tok'>PARSE_JSON</code>." },
              { t: "h", text: "Adding several columns idempotently" },
              { t: "code", lang: "sql", code:
                "-- fails: a second ADD keyword\n" +
                "-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel VARCHAR, ADD COLUMN IF NOT EXISTS region VARCHAR;\n" +
                "\n" +
                "-- works: one ADD, then COLUMN IF NOT EXISTS for each column\n" +
                "ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel VARCHAR,\n" +
                "                       COLUMN IF NOT EXISTS region  VARCHAR,\n" +
                "                       COLUMN IF NOT EXISTS loaded_at TIMESTAMP_LTZ;"
              },
              { t: "h", text: "DECRYPT returns BINARY" },
              { t: "code", lang: "sql", code:
                "-- the passphrase comes from a session variable set by the runner, never a literal in the repo\n" +
                "SELECT connection_name,\n" +
                "       TO_VARCHAR(DECRYPT(pwd, $conn_passphrase), 'UTF-8') AS secret_text\n" +
                "FROM   app_connections\n" +
                "WHERE  connection_name = $conn_name;\n" +
                "\n" +
                "-- CAST(DECRYPT(...) AS VARCHAR) also works; there is no TRY_TO_VARCHAR function"
              },
              { t: "p", html: "Storing reversible passwords in a table is itself a design smell. Where you can, move to key-pair authentication or Snowflake secret objects so nothing decryptable sits in a query result." },
              { t: "h", text: "Identifiers, NULLs and time zones" },
              { t: "code", lang: "sql", code:
                "-- quoted names keep their case; unquoted names fold to upper case\n" +
                "CREATE TABLE \"orderLines\" (\"lineId\" NUMBER);   -- only reachable as \"orderLines\".\"lineId\"\n" +
                "CREATE TABLE order_lines (line_id NUMBER);       -- stored as ORDER_LINES.LINE_ID\n" +
                "\n" +
                "-- one NULL customer_id empties this result\n" +
                "SELECT c.id FROM customers c WHERE c.id NOT IN (SELECT customer_id FROM orders);\n" +
                "-- NULL-safe\n" +
                "SELECT c.id FROM customers c\n" +
                "WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);"
              },
              { t: "table", headers: ["Type", "Stores", "Watch out for"], rows: [
                ["TIMESTAMP_NTZ", "Wall-clock value, no zone", "The default target of plain <code class='tok'>TIMESTAMP</code> (via TIMESTAMP_TYPE_MAPPING); writers in different session zones store different instants"],
                ["TIMESTAMP_LTZ", "An instant in UTC, shown in the session TIMEZONE", "The same row displays differently per session; <code class='tok'>CURRENT_TIMESTAMP()</code> returns this type"],
                ["TIMESTAMP_TZ", "An instant plus the offset it was written with", "Offset is fixed at write time, not a named zone, so it does not follow daylight-saving rules"]
              ] },
              { t: "widget", id: "gotchaLab" },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the insert works but the JSON field is NULL\", \"NOT IN returns nothing\", \"the column exists but Snowflake says it does not\", \"times are off by hours\", \"decrypted value looks like hex\". Each phrase maps to one row of the table above." },
              { t: "note", variant: "key", html: "<strong>Constants in VALUES, PARSE_JSON for VARIANT, one ADD per ALTER, TO_VARCHAR after DECRYPT, NOT EXISTS over NOT IN, unquoted names, and a deliberate timestamp type.</strong>" }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "deploy-gotchas",
            title: "Deployment gotchas: multi-statement scripts, comment banners and post-deploy validation",
            summary: "Why a green deploy can still be broken, and the checks that prove a release actually landed.",
            minutes: 12,
            tags: ["deployment", "validation", "connectivity"],
            blocks: [
              { t: "p", html: "The core idea: <strong>\"the deploy ran\" and \"the release is correct\" are different claims</strong>. Between them sit a statement splitter that can drop SQL, a <code class='tok'>CREATE OR REPLACE</code> that does not prove the body works, an exception handler that turns failures into success, and a connection that may be pointed somewhere else entirely." },
              { t: "h", text: "The comment-banner bug" },
              { t: "p", html: "Python deploy drivers often split a file with the connector's <code class='tok'>split_statements</code> helper and filter out comment-only chunks. The banner above each object travels <em>with</em> the statement below it, so a filter that skips anything starting with <code class='tok'>--</code> silently drops every bannered <code class='tok'>CREATE OR REPLACE</code>." },
              { t: "code", lang: "python", code:
                "import io, os\n" +
                "import snowflake.connector\n" +
                "from snowflake.connector.util_text import split_statements\n" +
                "\n" +
                "def is_executable(stmt: str) -> bool:\n" +
                "    # executable if ANY stripped line is non-empty and not a comment\n" +
                "    return any(l.strip() and not l.strip().startswith(\"--\") for l in stmt.splitlines())\n" +
                "\n" +
                "conn = snowflake.connector.connect(\n" +
                "    connection_name=os.environ[\"SNOWFLAKE_CONNECTION\"],   # profile holds account, user, key path\n" +
                ")\n" +
                "with open(os.environ[\"RELEASE_SQL\"]) as f:\n" +
                "    for stmt, _is_put_get in split_statements(io.StringIO(f.read()), remove_comments=False):\n" +
                "        # BUG to avoid: if stmt.strip().startswith(\"--\"): continue\n" +
                "        if not is_executable(stmt):\n" +
                "            continue\n" +
                "        conn.cursor().execute(stmt)"
              },
              { t: "widget", id: "splitLab" },
              { t: "note", variant: "warn", html: "Log the first non-comment line of every executed statement and the count of executed versus skipped. A release that expected 14 objects and executed 9 statements is visible in the log, instead of discovered by a user." },
              { t: "h", text: "Created is not the same as valid" },
              { t: "code", lang: "sql", code:
                "-- succeeds even though ORDERS_STAGING does not exist in this environment:\n" +
                "-- object references in the body are resolved when the procedure runs\n" +
                "CREATE OR REPLACE PROCEDURE SP_REFRESH_ORDERS(mode VARCHAR)\n" +
                "RETURNS VARIANT LANGUAGE SQL AS\n" +
                "$$\n" +
                "BEGIN\n" +
                "  INSERT INTO ORDERS SELECT * FROM ORDERS_STAGING;\n" +
                "  RETURN OBJECT_CONSTRUCT('status', 'OK');\n" +
                "END;\n" +
                "$$;\n" +
                "\n" +
                "-- post-deploy check 1: the deployed body contains what this release changed\n" +
                "SELECT GET_DDL('PROCEDURE', 'SP_REFRESH_ORDERS(VARCHAR)') ILIKE '%ORDERS_STAGING%' AS has_new_source;\n" +
                "-- post-deploy check 2: a smoke CALL in a safe mode, asserting the returned status\n" +
                "CALL SP_REFRESH_ORDERS('DRY_RUN');"
              },
              { t: "code", lang: "sql", code:
                "-- this handler turns every failure into a normal return value\n" +
                "EXCEPTION\n" +
                "  WHEN statement_error THEN\n" +
                "    RETURN OBJECT_CONSTRUCT('status', 'FAILED', 'error', SQLERRM, 'code', SQLCODE);\n" +
                "\n" +
                "-- so the caller must check the payload, not just whether CALL succeeded\n" +
                "CALL SP_REFRESH_ORDERS('RUN');\n" +
                "SELECT $1:status::STRING AS status, $1:error::STRING AS error\n" +
                "FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()));"
              },
              { t: "note", variant: "trap", html: "When a wrapped procedure reports <code class='tok'>FAILED</code> with a vague message, do not debug through the wrapper. Take the SQL it generates (log it, or rebuild it from the inputs) and run it standalone: you get the raw error, the position, and often the real cause in one try." },
              { t: "h", text: "Connectivity checks before you blame the code" },
              { t: "table", headers: ["Symptom", "Likely cause", "Check"], rows: [
                ["Host not found or 404 on login", "Wrong account identifier format", "Use <code class='tok'>orgname-accountname</code> (e.g. <code class='tok'>acme-prod</code>) or the locator form <code class='tok'>xy12345.us-east-1</code>; underscores and typos fail"],
                ["SSO: user differs from the user logged in at the IdP", "Connection user is not the login name the IdP asserts", "Set the user to the IdP login form, often the email; use <code class='tok'>externalbrowser</code> for interactive SSO"],
                ["IP not allowed to access Snowflake", "Network policy blocks the client address (VPN off, new runner)", "Connect from an allowed network, or update the network rule through the platform team"],
                ["Objects missing, deploy \"succeeded\"", "Default role or database differs from what you assumed", "First statement of every deploy: <code class='tok'>SELECT CURRENT_ACCOUNT(), CURRENT_ROLE(), CURRENT_DATABASE()</code>"]
              ] },
              { t: "code", lang: "bash", code:
                "# connection profile per environment; secrets come from the runner, never the repo\n" +
                "export SNOWFLAKE_CONNECTION=\"$DEPLOY_ENV\"                 # names a profile in connections.toml\n" +
                "export SNOWFLAKE_PRIVATE_KEY_PATH=\"$RUNNER_TEMP/deploy.p8\"\n" +
                "snow connection test -c \"$SNOWFLAKE_CONNECTION\"           # auth + role + warehouse in one check\n" +
                "\n" +
                "# raw reachability (a redirect status means the host answers; a timeout means network or VPN)\n" +
                "curl -sS -m 5 -o /dev/null -w '%{response_code}\\n' \"$SNOWFLAKE_LOGIN_URL\""
              },
              { t: "ol", items: [
                "Confirm the session: account, role, database, warehouse.",
                "Compare executed statement count with the objects the release declares.",
                "For each changed view, run a <code class='tok'>SELECT ... LIMIT 1</code>; for each procedure, check <code class='tok'>GET_DDL</code> for a token from the change and make a smoke <code class='tok'>CALL</code> that asserts the returned status.",
                "Re-check grants on replaced objects (<code class='tok'>SHOW GRANTS ON VIEW ...</code>).",
                "Only then mark the release done."
              ] },
              { t: "table", headers: ["Tier", "Practice", "Why it falls short or wins"], rows: [
                ["Naive", "A green exit code means done", "Skipped statements, broken bodies and masked failures all look green"],
                ["Solid", "Robust statement filter, session confirmation, smoke calls that check returned status", "Most silent failures surface during the deploy"],
                ["Standout", "Solid, plus declared-versus-executed object counts, GET_DDL token checks per changed object, and grant verification", "The release proves its own correctness and leaves evidence in the log"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"deploy succeeded but the view is old\", \"procedure returns FAILED but the job is green\", \"works on my laptop, not in CI\", \"IP not allowed\", \"user differs from IdP\". Reach for the statement filter, post-deploy validation and the connectivity table." },
              { t: "note", variant: "key", html: "<strong>Execute every statement that has real SQL, verify what you deployed, and read what procedures return.</strong> A deploy is finished when validation passes, not when the script exits." }
            ]
          },
          /* ---------------------------------------------------------- */
          {
            id: "vs-databricks",
            title: "Snowflake vs Databricks and Delta Lake",
            summary: "A balanced comparison of storage, compute, governance, streaming, ML, Iceberg interop and cost, and when each is the better fit.",
            minutes: 9,
            tags: ["databricks", "delta-lake", "iceberg", "architecture"],
            blocks: [
              { t: "p", html: "The short version: Snowflake started as a <strong>managed SQL warehouse</strong> and grew outward into data engineering, apps and AI. Databricks started as a <strong>managed Spark and lakehouse platform</strong> and grew inward into SQL warehousing and governance. Both now cover most of the same ground; the differences are in defaults, operating model and where each is strongest." },
              { t: "table", headers: ["Dimension", "Snowflake", "Databricks"], rows: [
                ["Storage format", "Managed micro-partitions by default; Iceberg tables in your own storage when you need openness", "Delta Lake (Parquet plus a transaction log) in your object storage by default"],
                ["Compute model", "Virtual warehouses billed per second, plus serverless features; little to tune", "Clusters, job compute and SQL warehouses (classic or serverless); more knobs, more control"],
                ["Governance", "Horizon: RBAC, masking and row access policies, tags, lineage, access history", "Unity Catalog: catalog.schema.table namespace, grants, lineage, attribute-based policies"],
                ["Streaming", "Snowpipe Streaming, streams and tasks, dynamic tables", "Structured Streaming and declarative pipelines; mature low-latency stream processing"],
                ["ML and AI", "Snowpark, Snowflake ML, Cortex functions, container services", "Notebooks, MLflow, GPU clusters, model serving; deeper ML engineering tooling"],
                ["Iceberg interop", "Native Iceberg tables, catalog integrations, an open catalog service", "UniForm writes Iceberg metadata for Delta tables; Unity Catalog exposes them"],
                ["Cost model", "Credits for compute plus storage; one bill", "DBUs plus, on classic compute, your own cloud VM bill; serverless folds them together"]
              ] },
              { t: "h", text: "Storage and open formats" },
              { t: "p", html: "On Databricks your data is open files in your bucket from day one; any engine that reads Delta (or Iceberg through UniForm) can read it. Snowflake's native tables are faster to operate because Snowflake owns layout, clustering and metadata, but other engines cannot read them directly. Iceberg tables close most of that gap from the Snowflake side." },
              { t: "code", lang: "sql", code:
                "-- Snowflake: an Iceberg table managed by Snowflake, files in your external volume\n" +
                "CREATE ICEBERG TABLE orders_ice (\n" +
                "  order_id NUMBER, customer_id NUMBER, order_date DATE, amount NUMBER(12,2)\n" +
                ")\n" +
                "  CATALOG         = 'SNOWFLAKE'\n" +
                "  EXTERNAL_VOLUME = 'lake_vol'\n" +
                "  BASE_LOCATION   = 'orders_ice/';\n" +
                "\n" +
                "-- Databricks: a Delta table that also publishes Iceberg metadata (UniForm)\n" +
                "-- CREATE TABLE orders (...) USING DELTA\n" +
                "-- TBLPROPERTIES ('delta.enableIcebergCompatV2' = 'true',\n" +
                "--                'delta.universalFormat.enabledFormats' = 'iceberg');"
              },
              { t: "h", text: "Compute, operations and cost" },
              { t: "ul", items: [
                "<strong>Operational load:</strong> Snowflake needs fewer decisions (size, auto-suspend, scaling policy). Databricks exposes cluster types, runtimes and autoscaling, which rewards expertise and punishes neglect.",
                "<strong>Workload fit:</strong> concurrent BI and SQL-heavy ELT tend to be simplest on Snowflake; heavy Python and Spark transformations, streaming and ML training tend to feel native on Databricks.",
                "<strong>Billing:</strong> Snowflake credits map cleanly to warehouse time. Databricks costs combine DBUs with cloud infrastructure on classic compute, so attribution needs both bills."
              ] },
              { t: "note", variant: "warn", html: "Vendor benchmarks are tuned for the vendor. Price-performance depends on your data layout, concurrency and query mix. Run a representative slice of your own workload on both, with realistic sizing and auto-suspend, before believing anyone's chart." },
              { t: "h", text: "When you would pick which" },
              { t: "table", headers: ["Situation", "Lean towards", "Why"], rows: [
                ["Many analysts, BI dashboards, SQL-first team, small platform team", "Snowflake", "Low operational overhead, strong concurrency, governance policies in SQL"],
                ["Large Spark codebase, streaming-heavy pipelines, in-house ML training", "Databricks", "Native Spark, mature streaming, deep ML tooling"],
                ["Data shared with partners and external consumers", "Snowflake", "Secure sharing and listings without copying data"],
                ["Mandate that data stays in open formats in your own storage", "Either, via Iceberg", "Databricks by default; Snowflake through Iceberg tables"],
                ["Both already in use across the company", "Both, with one Iceberg copy", "A shared open table format avoids nightly copies between platforms"]
              ] },
              { t: "note", variant: "tip", html: "Coexistence is common. The pattern that works is one copy of shared tables in Iceberg, one catalog both engines can resolve, and a clear owner per table for writes. Remember that each engine enforces its own access policies, so align them deliberately." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"should we move to Databricks\", \"lakehouse vs warehouse\", \"open formats\", \"one copy for both teams\". Answer with workload fit, operating model and Iceberg interop, not brand loyalty." },
              { t: "quiz", id: "ops-gotchas" },
              { t: "note", variant: "key", html: "<strong>Snowflake optimises for managed simplicity and SQL concurrency; Databricks for open files, Spark, streaming and ML depth.</strong> Iceberg lets them share data, and your own workload benchmark decides the rest." }
            ]
          }
        ]
      }
    ]
  };
})();
