/* =====================================================================
   GLACIER · Cortex AI
   window.TRACKS.ai — modules: llm / analyst / search

   Self-contained: this file registers its own widgets (tokenLab,
   semanticLab), its own quizzes (ai-llm, ai-analyst, ai-search) and its
   own track data. Every price-like number in here is illustrative.
   ===================================================================== */
(function () {
  "use strict";

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
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
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
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function slider(label, min, max, step, value, fmt, onInput) {
    var out = h("b", {}, fmt(value));
    var input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value), "aria-label": label });
    input.addEventListener("input", function () {
      var v = Number(input.value);
      if (!isFinite(v)) v = min;
      out.textContent = fmt(v);
      onInput(v);
    });
    return h("label", { class: "w-field" }, h("span", {}, label + " "), out, input);
  }
  function compact(n) {
    if (!isFinite(n)) return "0";
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(Math.round(n));
  }

  var Widgets = {};

  /* tokenLab — tokens and ILLUSTRATIVE credits for a batch LLM enrichment */
  Widgets.tokenLab = function (mount) {
    shell(mount, "estimator", "LLM batch cost estimator",
      "Size a batch enrichment job: how many rows, how long the prompt and answer are, and which model tier. Rates are illustrative placeholders, not a price list; plug in the current rates for your region and contract.");
    var ROWS = [1000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
    var RATE = { small: 0.2, medium: 1.0, large: 5.0 }; /* illustrative credits per 1M tokens */
    var TOK_PER_WORD = 1.33;
    var rowIdx = 3, inWords = 300, outWords = 80, tier = "medium", mode = "gen";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function bar(label, value, max, hex) {
      var pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
      return h("div", { style: "margin:6px 0" },
        h("div", { style: "display:flex;justify-content:space-between;font-size:0.82rem;color:var(--text-dim)" },
          h("span", {}, label), h("span", { style: "color:var(--text)" }, compact(value) + " tokens")),
        h("div", { style: "height:12px;border:1px solid var(--line);border-radius:6px;background:var(--surface-2);overflow:hidden" },
          h("div", { style: "height:100%;width:" + pct + "%;background:color-mix(in srgb, " + hex + " 22%, transparent)" })));
    }

    function paint() {
      var rows = ROWS[rowIdx] || 100000;
      var inTok = rows * inWords * TOK_PER_WORD;
      var outTok = mode === "gen" ? rows * outWords * TOK_PER_WORD : 0;
      var total = inTok + outTok;
      var credits = (total / 1e6) * (RATE[tier] || 1);
      var tips = [];
      if (tier === "large" && rows >= 100000) tips.push("Pilot the prompt on a 1% sample with the small and medium tiers; promote to large only if quality measurably needs it.");
      if (inWords >= 800) tips.push("The prompt dominates: send only the columns the model needs and move fixed instructions into a short system message.");
      if (mode === "gen" && outWords >= 200) tips.push("Cap max_tokens and ask for a compact JSON answer; output tokens are usually the pricier half.");
      if (rows >= 1000000) tips.push("Run incrementally (stream or watermark) and persist results so nothing is scored twice; dedupe identical inputs first.");
      if (mode === "task") tips.push("A task-specific function (CLASSIFY_TEXT, SENTIMENT, EMBED) is billed on input only and needs no output budget.");
      if (!tips.length) tips.push("Reasonable as is. Persist the output to a table and keep the warehouse at Medium or smaller; a larger warehouse does not make the model faster.");

      clear(stage);
      var max = Math.max(inTok, outTok, 1);
      stage.appendChild(bar("Input tokens (prompt + row text)", inTok, max, "#fb7185"));
      stage.appendChild(bar(mode === "gen" ? "Output tokens (generated)" : "Output tokens (not billed for this function type)", outTok, max, "#818cf8"));
      stage.appendChild(h("p", { style: "font-size:0.85rem;line-height:1.55;margin:10px 0 0;color:var(--text)" },
        h("strong", {}, "Batching advice: "), tips.slice(0, 2).join(" ")));
      stage.appendChild(h("p", { style: "font-size:0.78rem;margin:6px 0 0;color:var(--text-dim)" },
        "Illustrative rates: small 0.2, medium 1.0, large 5.0 credits per million tokens. Tokens estimated at about 1.33 per English word."));

      clear(readout);
      readout.appendChild(ro("rows", compact(rows)));
      readout.appendChild(ro("total tokens", compact(total)));
      readout.appendChild(ro("illustrative credits", credits < 10 ? credits.toFixed(2) : Math.round(credits).toLocaleString("en-US")));
      readout.appendChild(ro("per 1K rows", ((credits / rows) * 1000).toFixed(3)));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      slider("Rows", 0, ROWS.length - 1, 1, rowIdx, function (i) { return compact(ROWS[i] || 0); }, function (v) { rowIdx = v; paint(); }),
      slider("Avg input words", 20, 2000, 10, inWords, function (v) { return String(v); }, function (v) { inWords = v; paint(); }),
      slider("Avg output words", 0, 600, 10, outWords, function (v) { return String(v); }, function (v) { outWords = v; paint(); }),
      segment([["small", "Small model"], ["medium", "Medium model"], ["large", "Large model"]], 1, function (v) { tier = v; paint(); }),
      segment([["gen", "Generative: input + output billed"], ["task", "Task / embed: input only"]], 0, function (v) { mode = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* semanticLab — a tiny Cortex Analyst semantic-model linter with injectable defects */
  Widgets.semanticLab = function (mount) {
    shell(mount, "linter", "Semantic model YAML linter",
      "Toggle a defect into a small sales model and watch the YAML and the lint findings change. These are the mistakes that most often block an upload or quietly produce wrong SQL.");
    var DEFECTS = [
      ["dateString", "verified_at as a date string"],
      ["noName", "Relationship without a name"],
      ["dupName", "Duplicate relationship name"],
      ["fkNonUnique", "FK to a non-unique column"],
      ["envFilter", "Env filter hardcoded in a verified query"]
    ];
    var on = { dateString: false, noName: false, dupName: false, fkNonUnique: false, envFilter: false };
    var btns = {};
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function model() {
      var rels = [
        { name: "orders_to_customers", left: "orders", right: "customers", lc: "customer_id", rc: "customer_id" },
        { name: "orders_to_products", left: "orders", right: "products", lc: "product_id", rc: "product_id" }
      ];
      if (on.noName) rels[0].name = null;
      if (on.dupName) rels[1].name = "orders_to_customers";
      if (on.fkNonUnique) { rels[0].lc = "ship_region"; rels[0].rc = "region_code"; }
      var sql = "SELECT DATE_TRUNC('month', order_date) AS month, SUM(net_amount) AS revenue\n      FROM __orders\n";
      if (on.envFilter) sql += "      WHERE program_id = 4471\n";
      sql += "      GROUP BY 1 ORDER BY 1";
      return {
        pk: { orders: "order_id", customers: "customer_id", products: "product_id" },
        rels: rels,
        vq: { name: "monthly_revenue", sql: sql, verifiedAt: on.dateString ? "'2026-10-28'" : 1793145600 },
        instructions: !on.envFilter
      };
    }

    function lint(m) {
      var out = [];
      var seen = {};
      m.rels.forEach(function (r, i) {
        if (!r.name) out.push({ sev: "error", where: "relationships[" + i + "]", msg: "name is required on every relationship.", fix: "Give it a descriptive, unique name such as orders_to_customers." });
        else if (seen[r.name]) out.push({ sev: "error", where: "relationships[" + i + "]", msg: "name '" + r.name + "' is already used; relationship names must be unique across the model.", fix: "Rename it, e.g. orders_to_products." });
        if (r.name) seen[r.name] = true;
        if (m.pk[r.right] !== r.rc) out.push({ sev: "error", where: "relationships[" + i + "]", msg: "right_column '" + r.rc + "' is not the primary or unique key of " + r.right + ", so the join can fan out.", fix: "Join on " + r.right + "." + m.pk[r.right] + ", or declare a real unique key first." });
      });
      if (typeof m.vq.verifiedAt !== "number") out.push({ sev: "error", where: "verified_queries[0]", msg: "verified_at must be an integer epoch in seconds, not a date string.", fix: "Use 1793145600 (2026-10-28 00:00 UTC)." });
      if (/=\s*\d{3,}/.test(m.vq.sql)) out.push({ sev: "warn", where: "verified_queries[0]", msg: "a literal program_id is baked into verified SQL; it is only right in one environment.", fix: "Remove it and express the rule in module_custom_instructions, templated per environment at deploy time." });
      return out;
    }

    function yaml(m) {
      var L = [];
      L.push("name: sales_model");
      L.push("tables:");
      L.push("  - name: orders        # primary_key: order_id");
      L.push("  - name: customers     # primary_key: customer_id");
      L.push("  - name: products      # primary_key: product_id");
      L.push("relationships:");
      m.rels.forEach(function (r, i) {
        var dup = i > 0 && r.name && m.rels[0].name === r.name;
        L.push("  - " + (r.name ? "name: " + r.name + (dup ? "        # <-- duplicate" : "") : "# name missing   # <-- required"));
        L.push("    left_table: " + r.left);
        L.push("    right_table: " + r.right);
        L.push("    relationship_columns:");
        L.push("      - left_column: " + r.lc);
        L.push("        right_column: " + r.rc + (m.pk[r.right] !== r.rc ? "   # <-- not a key" : ""));
        L.push("    join_type: left_outer");
        L.push("    relationship_type: many_to_one");
      });
      L.push("verified_queries:");
      L.push("  - name: " + m.vq.name);
      L.push("    question: What is revenue by month?");
      L.push("    sql: |");
      L.push("      " + m.vq.sql + (/=\s*\d{3,}/.test(m.vq.sql) ? "   # <-- env-specific" : ""));
      L.push("    verified_at: " + m.vq.verifiedAt + (typeof m.vq.verifiedAt !== "number" ? "   # <-- must be epoch int" : ""));
      L.push("    verified_by: data-platform");
      if (m.instructions) {
        L.push("module_custom_instructions:");
        L.push("  sql_generation: >-");
        L.push("    Restrict __orders to program_id IN (${ACTIVE_PROGRAM_IDS})");
        L.push("    unless the user names a specific program.");
      }
      return L.join("\n");
    }

    function paint() {
      var m = model();
      var findings = lint(m);
      var errors = findings.filter(function (f) { return f.sev === "error"; }).length;
      var warns = findings.length - errors;
      clear(stage);
      stage.appendChild(h("pre", { style: "margin:0 0 10px;padding:10px 12px;font-size:0.76rem;line-height:1.45;overflow:auto;max-height:340px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:8px" }, yaml(m)));
      if (!findings.length) {
        stage.appendChild(h("p", { style: "margin:0;font-size:0.86rem;color:var(--text)" }, "No findings. This model would upload cleanly and the verified query works in every environment."));
      } else {
        var list = h("ul", { style: "margin:0;padding-left:1.1rem;font-size:0.84rem;line-height:1.5;color:var(--text)" });
        findings.forEach(function (f) {
          var hex = f.sev === "error" ? "#fb7185" : "#fbbf24";
          list.appendChild(h("li", { style: "margin-bottom:6px" },
            h("span", { style: "display:inline-block;padding:0 6px;margin-right:6px;border-radius:4px;border:1px solid var(--line);color:var(--text);background:color-mix(in srgb, " + hex + " 22%, transparent)" }, f.sev.toUpperCase()),
            h("code", {}, f.where), " " + f.msg + " ",
            h("span", { style: "color:var(--text-dim)" }, "Fix: " + f.fix)));
        });
        stage.appendChild(list);
      }
      clear(readout);
      readout.appendChild(ro("errors", errors));
      readout.appendChild(ro("warnings", warns));
      readout.appendChild(ro("verdict", errors ? "upload blocked" : (warns ? "uploads, wrong outside one env" : "ready to upload")));
    }

    var controls = h("div", { class: "widget-controls" });
    DEFECTS.forEach(function (d) {
      var b = h("button", { type: "button", class: "w-btn ghost", "aria-pressed": "false" }, d[1]);
      b.addEventListener("click", function () {
        on[d[0]] = !on[d[0]];
        b.className = "w-btn " + (on[d[0]] ? "primary" : "ghost");
        b.setAttribute("aria-pressed", on[d[0]] ? "true" : "false");
        paint();
      });
      btns[d[0]] = b;
      controls.appendChild(b);
    });
    var reset = h("button", { type: "button", class: "w-btn" }, "Fix all");
    reset.addEventListener("click", function () {
      for (var k in on) {
        if (!Object.prototype.hasOwnProperty.call(on, k)) continue;
        on[k] = false;
        if (btns[k]) { btns[k].className = "w-btn ghost"; btns[k].setAttribute("aria-pressed", "false"); }
      }
      paint();
    });
    controls.appendChild(reset);
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "ai-llm": {
      title: "Cortex LLM functions checkpoint",
      sub: "Function choice, token billing, warehouse sizing and access governance.",
      questions: [
        { q: "What does SNOWFLAKE.CORTEX.SENTIMENT return for a review?", options: ["A label: positive, negative or neutral", "A floating-point score between -1 and 1", "An integer star rating from 1 to 5", "A JSON object of per-class probabilities"], answer: 1,
          explain: "SENTIMENT returns a single float where negative values mean negative tone and values near zero are neutral. Because it is a number you can average it, threshold it or trend it in plain SQL. If you need named categories, CLASSIFY_TEXT or the AI_ equivalents are the better fit." },
        { q: "A COMPLETE call enriches 500,000 rows. What drives its cost?", options: ["Only the generated output tokens", "Only the prompt tokens", "Prompt and generated tokens, plus the warehouse time of the query that calls it", "A flat fee per function call regardless of length"], answer: 2,
          explain: "Generative functions bill both input and output tokens as AI services credits. The SELECT that calls them still runs on your warehouse, so its runtime is billed too. That is why trimming prompts, capping max_tokens and right-sizing the warehouse all matter." },
        { q: "Your team bumps the warehouse from Medium to 2XL to speed up a COMPLETE batch. What is the likely outcome?", options: ["Little speed-up and a much bigger warehouse bill, because the model runs on Snowflake-managed inference capacity", "A 4x speed-up, because tokens per second scale with warehouse size", "Lower token cost, because larger warehouses get a token discount", "The query fails, because Cortex functions only run on X-Small"], answer: 0,
          explain: "Inference does not run on your warehouse nodes, so more warehouse capacity mostly buys idle credits. The usual guidance is to stay at Medium or smaller for Cortex function queries. Throughput comes from batching rows sensibly and smaller models, not from warehouse size." },
        { q: "Security asks that only the analytics engineering role may call LLM functions, and only approved models. What is the right control?", options: ["Wrap every call in a secure view", "Set a resource monitor with SUSPEND_IMMEDIATE at zero credits", "Rename the functions in a custom schema", "Revoke SNOWFLAKE.CORTEX_USER from PUBLIC, grant it to the approved role, and set CORTEX_MODELS_ALLOWLIST"], answer: 3,
          explain: "Access to Cortex functions flows through the CORTEX_USER database role, which is granted to PUBLIC by default. Revoking it from PUBLIC and granting it to specific roles is the access gate, and the account-level model allowlist limits which models can be called. Resource monitors only govern warehouses, so they cannot cap AI services spend." },
        { q: "You must tag two million support tickets with one of five fixed categories. Which approach is the strongest default?", options: ["CLASSIFY_TEXT or AI_CLASSIFY with the five labels, persisted to a table", "COMPLETE with the largest model and a free-text prompt asking for a category", "EXTRACT_ANSWER asking 'what category is this?'", "SUMMARIZE first, then a LIKE pattern on the summary"], answer: 0,
          explain: "A task-specific classifier constrains output to your labels, needs no output-parsing and is billed on input tokens. A free-text COMPLETE prompt costs more, can return labels outside your set and needs validation. Persisting results means you pay once per ticket." },
        { q: "A nightly job re-runs SUMMARIZE over every row of a 30-million-row notes table. What is the main fix?", options: ["Switch to a larger warehouse so it finishes sooner", "Raise temperature so summaries are more varied", "Summarize only new or changed rows (stream or watermark) and store results keyed by row id", "Run it hourly instead of nightly"], answer: 2,
          explain: "LLM output for an unchanged input does not need recomputing, so full re-runs pay for the same tokens every night. An incremental pattern with a stream or a last-processed watermark scores each row once. Storing results in a table also makes downstream queries cheap and repeatable." }
      ]
    },
    "ai-analyst": {
      title: "Cortex Analyst checkpoint",
      sub: "How Analyst generates SQL, semantic model YAML rules and environment-agnostic design.",
      questions: [
        { q: "What type must verified_at have in a verified query?", options: ["An ISO date string like '2026-10-28'", "A TIMESTAMP_NTZ literal", "An integer Unix epoch in seconds", "Any string; it is informational only"], answer: 2,
          explain: "The parser expects an integer epoch, so a quoted date string fails validation and blocks the upload. Convert once with DATE_PART(epoch_second, '2026-10-28'::TIMESTAMP_NTZ) and paste the integer. It is an easy fix but a common one to miss when people hand-edit YAML." },
        { q: "Who executes the SQL that Cortex Analyst generates?", options: ["Your client application, using the caller's role, so RBAC, masking and row access policies still apply", "Cortex Analyst itself, with ACCOUNTADMIN privileges", "A Snowflake-owned service account that bypasses policies", "Nobody; Analyst returns cached results only"], answer: 0,
          explain: "Analyst returns text plus a SQL statement; your app or the Snowflake UI then runs that SQL under the user's session. Governance therefore stays in the normal access-control path. That is a key reason Analyst is safe to put in front of business users." },
        { q: "Upload fails with a relationship error saying the referenced column must be a key. What is the root cause?", options: ["The relationship uses join_type inner", "The left_table is listed after the right_table", "The relationship name has uppercase letters", "The right_column is not the right table's declared primary key or a unique key"], answer: 3,
          explain: "A many-to-one relationship must land on a unique column of the right table; otherwise the join could multiply rows and corrupt metrics. Declare primary_key on the right table, or point the relationship at the real key. Joining on a descriptive attribute like a region code is the usual mistake." },
        { q: "STG and PRD need different program filters. Where should that rule live?", options: ["As a WHERE clause inside each verified query", "In module_custom_instructions (sql_generation), templated per environment at deploy", "As a filter on the base table of the semantic model", "In a comment at the top of the YAML file"], answer: 1,
          explain: "Verified queries and table filters are copied verbatim, so a literal that is right in STG is silently wrong in PRD. The sql_generation instructions are guidance the model applies to every question, and templating their value at deploy keeps one source YAML across environments. Comments are ignored entirely." },
        { q: "Analyst answers 'revenue last quarter' with the wrong column. What is the best first fix?", options: ["Add a verified query for that exact question", "Raise the model temperature", "Fix the semantic model: clear metric definition, description and synonyms for the revenue measure", "Drop the other numeric columns from the base table"], answer: 2,
          explain: "A verified query only helps phrasings close to the one you verified, while the underlying ambiguity keeps breaking every other revenue question. Defining the metric once with a precise expr, description and synonyms fixes the whole family. Verified queries are for confirming good behaviour, not papering over a weak model." },
        { q: "You are about to PUT a new semantic model YAML onto the stage used by production. What should happen first?", options: ["Copy the live file to a dated backup path on the stage, then PUT with AUTO_COMPRESS=FALSE and OVERWRITE=TRUE", "Delete the old file so there is no confusion", "Upload with default PUT options; Snowflake versions files automatically", "Rename the stage so clients pick up the new file"], answer: 0,
          explain: "Stages do not keep old versions, so the backup is your rollback. PUT gzips by default, which would leave a .gz file that Analyst cannot read under the expected name. Copying the live file aside first and uploading uncompressed with overwrite is the safe sequence." },
        { q: "Two relationships in one semantic model both join orders to customers on different columns, and you named both orders_to_customers. What happens?", options: ["The second one silently overrides the first", "Validation fails: every relationship needs a name, and names must be unique across the model", "Analyst picks one at random per question", "It works, because names are only labels"], answer: 1,
          explain: "Relationship names are required identifiers, not comments, and duplicates are rejected when the model is validated. Give each a descriptive unique name such as orders_to_billing_customer and orders_to_shipping_customer. The distinct names also help reviewers see that two join paths exist on purpose." }
      ]
    },
    "ai-search": {
      title: "Cortex Search and RAG checkpoint",
      sub: "Search service DDL, freshness, filtering, cost and grounded generation.",
      questions: [
        { q: "What retrieval approach does a Cortex Search service use?", options: ["Exact keyword match only", "Hybrid retrieval: vector similarity plus keyword matching, with semantic reranking", "Vector similarity only, with no keyword signal", "A LIKE scan over the source table at query time"], answer: 1,
          explain: "Cortex Search blends embedding similarity with lexical matching and reranks the candidates. The keyword side rescues exact identifiers like error codes that embeddings blur. You get that without building or tuning the index yourself." },
        { q: "What does TARGET_LAG on a Cortex Search service control?", options: ["The maximum query latency", "How long results are cached for clients", "The retention period of the search logs", "How stale the index may be relative to its source query before a refresh runs"], answer: 3,
          explain: "The service refreshes like a dynamic table: it keeps the index within the target lag of the source. A shorter lag means more frequent refreshes on the named warehouse and more embedding work. Choose the loosest lag your users can tolerate." },
        { q: "What is the purpose of the ATTRIBUTES clause?", options: ["It names the columns you can filter on at query time", "It lists columns to embed in addition to the search column", "It sets the embedding model", "It defines which roles can query the service"], answer: 0,
          explain: "Attributes are filterable columns such as product, region or tenant, used with operators like @eq and @and. Filtering before ranking keeps results relevant and lets you scope documents to a user's entitlement. The search column alone is what gets embedded and keyword-indexed." },
        { q: "A pilot search service has had no queries for a month, yet it still shows cost. Why?", options: ["Search costs are billed per query only, so this must be a metering error", "The base table is too large for Time Travel", "Serving is billed on indexed data while the service is up, plus refreshes if the source changes", "The embedding model charges a monthly licence"], answer: 2,
          explain: "A serving service keeps its index ready, which is billed by the size of indexed data over time, independent of query volume. Refreshes also run whenever the source changes. Suspend serving and indexing on idle services, or drop them." },
        { q: "Your RAG answers are vague and often miss the key sentence. Chunks are whole 40-page documents. What should change?", options: ["Use a larger LLM", "Split documents into chunks of a few hundred tokens with some overlap, keeping titles as context", "Increase TARGET_LAG", "Disable keyword matching"], answer: 1,
          explain: "One embedding per huge document averages away the specific passage, and the retrieved text may not fit the prompt budget. Smaller overlapping chunks give the retriever precise targets. Prepending the document title or section heading to each chunk keeps context." },
        { q: "Which prompt design best reduces fabricated answers in a RAG app?", options: ["Ask the model to be creative and thorough", "Set temperature to 1.0 to explore more answers", "Send the whole knowledge base in every prompt", "Instruct it to answer only from the supplied passages, cite chunk ids, and say it cannot find the answer otherwise"], answer: 3,
          explain: "Grounding instructions plus required citations give the model a narrow job and give you a way to audit it. An explicit 'not found' path stops it filling gaps with plausible prose. Low temperature helps too, but instructions and retrieval quality matter most." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ai = {
    id: "ai",
    name: "Cortex AI",
    short: "AI",
    tagline: "LLMs, semantic models and search, governed in-platform",
    color: "#fb7185",
    blurb: "Run LLMs, natural-language analytics and retrieval where the data already lives. Learn the Cortex LLM SQL functions and how tokens turn into credits, how Cortex Analyst turns questions into SQL through a semantic model you author in YAML (and every YAML gotcha that blocks an upload), and how to build Cortex Search services and grounded RAG without moving data out of Snowflake.",
    modules: [
      {
        id: "llm",
        name: "LLM Functions",
        icon: "bolt",
        lessons: [
          {
            id: "cortex-functions",
            title: "Cortex LLM functions: COMPLETE, SUMMARIZE, SENTIMENT, TRANSLATE, EXTRACT_ANSWER and AI_ functions",
            summary: "Call hosted language models from plain SQL, and pick the narrowest function that does the job.",
            minutes: 12,
            tags: ["cortex", "llm", "sql-functions"],
            blocks: [
              { t: "p", html: "Hold this picture: a Cortex function is <strong>a scalar SQL function whose body is a model call</strong>. You pass a column in, Snowflake sends each value to a model hosted inside its own boundary, and a value comes back per row. Data never leaves the platform, the call obeys your RBAC, and the result lands in a column you can join, filter and store like any other." },
              { t: "h", text: "The function families" },
              { t: "table", headers: ["Function", "Returns", "Typical use", "Tokens billed"], rows: [
                ["<code class='tok'>COMPLETE(model, prompt)</code>", "Generated text (or a JSON object with options)", "Free-form generation, extraction to JSON, rewriting", "Input + output"],
                ["<code class='tok'>SUMMARIZE(text)</code>", "A short summary string", "Condense notes, tickets, call transcripts", "Input + output"],
                ["<code class='tok'>SENTIMENT(text)</code>", "Float from -1 (negative) to 1 (positive)", "Trend customer tone, flag angry tickets", "Input"],
                ["<code class='tok'>TRANSLATE(text, from, to)</code>", "Translated string; empty <code class='tok'>from</code> auto-detects", "Normalize multilingual feedback to one language", "Input + output"],
                ["<code class='tok'>EXTRACT_ANSWER(text, question)</code>", "Array of <code class='tok'>{answer, score}</code>", "Pull one fact out of a document", "Input"],
                ["<code class='tok'>CLASSIFY_TEXT(text, labels)</code>", "Object with the chosen label", "Route tickets into fixed categories", "Input"],
                ["<code class='tok'>EMBED_TEXT_768 / _1024(model, text)</code>", "A <code class='tok'>VECTOR</code>", "Similarity search, clustering, dedupe", "Input"]
              ] },
              { t: "code", lang: "sql", code:
                "-- task-specific functions: one value in, one value out, per row\n" +
                "SELECT ticket_id,\n" +
                "       SNOWFLAKE.CORTEX.SENTIMENT(body)                          AS tone,\n" +
                "       SNOWFLAKE.CORTEX.SUMMARIZE(body)                          AS gist,\n" +
                "       SNOWFLAKE.CORTEX.TRANSLATE(body, '', 'en')                AS body_en,\n" +
                "       SNOWFLAKE.CORTEX.EXTRACT_ANSWER(body,\n" +
                "         'Which order number is the customer asking about?')[0]:answer::STRING AS order_ref,\n" +
                "       SNOWFLAKE.CORTEX.CLASSIFY_TEXT(body,\n" +
                "         ['billing', 'shipping', 'returns', 'account', 'other']):label::STRING AS category\n" +
                "FROM support.tickets\n" +
                "WHERE created_at >= DATEADD(day, -1, CURRENT_DATE());"
              },
              { t: "h", text: "COMPLETE: the general-purpose call" },
              { t: "p", html: "<code class='tok'>COMPLETE</code> takes a model name and either a prompt string or an array of chat messages. Pass an options object and the result changes from the bare answer to a JSON document carrying <code class='tok'>choices</code> and a <code class='tok'>usage</code> block with token counts, which is what you want for audit and cost tracking." },
              { t: "code", lang: "sql", code:
                "-- with an options object the result is a JSON document as text: parse it once\n" +
                "SELECT review_id,\n" +
                "       TRY_PARSE_JSON(SNOWFLAKE.CORTEX.COMPLETE(\n" +
                "         'llama3.1-8b',\n" +
                "         [\n" +
                "           {'role': 'system', 'content': 'Return only JSON: {\"product\": string, \"defect\": string|null}'},\n" +
                "           {'role': 'user',   'content': review_text}\n" +
                "         ],\n" +
                "         {'temperature': 0, 'max_tokens': 120, 'guardrails': TRUE}\n" +
                "       )) AS resp,\n" +
                "       TRY_PARSE_JSON(resp:choices[0]:messages::STRING) AS extracted,\n" +
                "       resp:usage:total_tokens::NUMBER                   AS tokens\n" +
                "FROM reviews.raw_reviews\n" +
                "LIMIT 100;  -- pilot on a sample before the full run"
              },
              { t: "note", variant: "tip", html: "Use <code class='tok'>TRY_PARSE_JSON</code>, never <code class='tok'>PARSE_JSON</code>, on model output. One malformed answer in a million rows should give you a <code class='tok'>NULL</code> to retry, not abort the whole statement." },
              { t: "h", text: "The AI_ functions" },
              { t: "p", html: "Newer <code class='tok'>AI_</code>-prefixed functions sit alongside the originals: <code class='tok'>AI_COMPLETE</code>, <code class='tok'>AI_CLASSIFY</code>, <code class='tok'>AI_SENTIMENT</code>, <code class='tok'>AI_EMBED</code> and <code class='tok'>AI_SIMILARITY</code>, plus genuinely new shapes: <code class='tok'>AI_FILTER</code> returns a boolean so a model can sit in a <code class='tok'>WHERE</code> clause, and <code class='tok'>AI_AGG</code> / <code class='tok'>AI_SUMMARIZE_AGG</code> reduce many rows into one answer per group. Names, arguments and regional availability still move between releases, so pin what you use in a smoke test." },
              { t: "code", lang: "sql", code:
                "-- a model inside WHERE, and a model as an aggregate\n" +
                "SELECT product_line,\n" +
                "       AI_AGG(review_text, 'List the three most common complaints, one line each') AS top_complaints\n" +
                "FROM reviews.raw_reviews\n" +
                "WHERE review_date >= '2026-10-01'\n" +
                "  AND AI_FILTER(PROMPT('Does this review mention a safety issue? {0}', review_text))\n" +
                "GROUP BY product_line;"
              },
              { t: "h", text: "Choosing the right function" },
              { t: "table", headers: ["Tier", "Approach", "Why"], rows: [
                ["Naive", "COMPLETE with the largest model for every task, free-text output", "Highest token bill, labels drift outside your set, output needs cleanup"],
                ["Solid", "Task-specific function (CLASSIFY_TEXT, SENTIMENT, EXTRACT_ANSWER) where one fits; COMPLETE only for open-ended work", "Input-only billing, constrained output, no parsing"],
                ["Standout", "Solid, plus a small model piloted on a labelled sample, JSON output via TRY_PARSE_JSON, results persisted and processed incrementally", "Quality is measured, cost is paid once per row, failures are retryable"]
              ] },
              { t: "note", variant: "trap", html: "Model output is not deterministic, even at <code class='tok'>temperature 0</code>, and models are upgraded over time. Never compute an LLM column inside a view that reports depend on. Materialize it with the model name and run date so a number in last quarter's deck can be reproduced." },
              { t: "compare",
                bad: { title: "LLM in a view", items: ["Re-bills tokens on every query", "Answers change between runs", "No record of which model produced what"] },
                good: { title: "LLM in a pipeline step", items: ["Tokens paid once per row", "Stable stored values", "Columns for model, prompt version and run timestamp"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"tag or route free-text\", \"sentiment trend\", \"translate feedback\", \"pull the order number out of emails\", \"without sending data to an external API\". Reach for the narrowest Cortex function first, COMPLETE second." },
              { t: "note", variant: "key", html: "<strong>A Cortex function is a per-row model call in SQL.</strong> Prefer the task-specific function, parse JSON defensively, and persist results instead of recomputing them in views." }
            ]
          },
          {
            id: "llm-cost-governance",
            title: "Tokens, cost and governance of LLM functions",
            summary: "Estimate tokens before you run, keep warehouses small, and gate who can call which model.",
            minutes: 11,
            tags: ["tokens", "cost", "governance", "cortex"],
            blocks: [
              { t: "p", html: "The mental model: an LLM batch is <strong>rows × tokens per row × rate</strong>, paid as AI services credits, plus the ordinary warehouse time of the query that drives it. Every lever you have shrinks one of those three factors or stops you paying for the same row twice." },
              { t: "h", text: "Estimating tokens" },
              { t: "code", lang: "text", code:
                "rule of thumb:   1 token ~ 0.75 English words  (~1.33 tokens per word)\n" +
                "rows            = 2,000,000 tickets\n" +
                "input per row   = 60-word instruction + 240-word ticket = 300 words ~ 400 tokens\n" +
                "output per row  = 40 words ~ 53 tokens\n" +
                "total tokens    = 2e6 * (400 + 53) ~ 906M tokens\n" +
                "credits         = 906 * <rate per 1M tokens for the chosen model>   (illustrative)\n" +
                "  small  @ 0.2  ->  ~181 credits\n" +
                "  large  @ 5.0  -> ~4,530 credits   <- same job, 25x the bill"
              },
              { t: "stat", items: [
                { v: "~1.33", k: "tokens per English word (rule of thumb)" },
                { v: "2", k: "token directions billed by generative calls" },
                { v: "≤ M", k: "warehouse size usually advised for Cortex queries" }
              ] },
              { t: "widget", id: "tokenLab" },
              { t: "h", text: "Cost levers, in order of impact" },
              { t: "table", headers: ["Lever", "How", "Typical effect"], rows: [
                ["Model tier", "Pilot small vs large on 200 labelled rows; keep the smallest that passes", "Often an order of magnitude"],
                ["Do not re-score", "Stream or watermark; store results keyed by row id and prompt version", "Turns a daily full run into a daily delta"],
                ["Trim the prompt", "Send only needed columns; strip HTML and signatures; short system message", "Input tokens down, often by half"],
                ["Cap output", "<code class='tok'>max_tokens</code> and a compact JSON schema", "Output tokens bounded"],
                ["Dedupe inputs", "Score <code class='tok'>DISTINCT</code> text, join back", "Large on templated or repeated text"],
                ["Small warehouse", "Run Cortex queries on Medium or smaller", "Stops paying for idle warehouse nodes"]
              ] },
              { t: "code", lang: "sql", code:
                "-- 1) measure before you spend\n" +
                "SELECT SUM(SNOWFLAKE.CORTEX.COUNT_TOKENS('llama3.1-8b', body)) AS input_tokens\n" +
                "FROM support.tickets SAMPLE (1);\n\n" +
                "-- 2) score only what is new, once\n" +
                "INSERT INTO support.ticket_labels (ticket_id, category, model, prompt_version, scored_at)\n" +
                "SELECT s.ticket_id,\n" +
                "       SNOWFLAKE.CORTEX.CLASSIFY_TEXT(s.body, ['billing','shipping','returns','account','other']):label::STRING,\n" +
                "       'classify_text', 'v3', CURRENT_TIMESTAMP()\n" +
                "FROM support.tickets_stream s          -- stream on support.tickets\n" +
                "WHERE s.METADATA$ACTION = 'INSERT';"
              },
              { t: "h", text: "Governance controls" },
              { t: "code", lang: "sql", code:
                "USE ROLE ACCOUNTADMIN;\n" +
                "-- CORTEX_USER is granted to PUBLIC by default: narrow it\n" +
                "REVOKE DATABASE ROLE SNOWFLAKE.CORTEX_USER FROM ROLE PUBLIC;\n" +
                "GRANT  DATABASE ROLE SNOWFLAKE.CORTEX_USER TO   ROLE analytics_eng;\n\n" +
                "-- only approved models may be called\n" +
                "ALTER ACCOUNT SET CORTEX_MODELS_ALLOWLIST = 'llama3.1-8b,mistral-large2';\n\n" +
                "-- keep inference in-region unless the data policy allows otherwise\n" +
                "ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'DISABLED';"
              },
              { t: "table", headers: ["Concern", "Control", "Note"], rows: [
                ["Who may call models", "<code class='tok'>SNOWFLAKE.CORTEX_USER</code> database role", "Revoke from PUBLIC first"],
                ["Which models", "<code class='tok'>CORTEX_MODELS_ALLOWLIST</code> account parameter", "Changes need ACCOUNTADMIN"],
                ["Where inference runs", "<code class='tok'>CORTEX_ENABLED_CROSS_REGION</code>", "Some models exist only in some regions"],
                ["What rows reach a model", "Masking and row access policies apply before the call", "The model sees what the role sees"],
                ["Harmful output", "<code class='tok'>'guardrails': TRUE</code> option on COMPLETE", "Filters unsafe responses; adds tokens"]
              ] },
              { t: "note", variant: "warn", html: "Resource monitors govern warehouses only. They will not stop a runaway Cortex batch, because AI services credits are serverless. Your guardrails are the role grant, the model allowlist, budgets, and an alert on the usage views below." },
              { t: "h", text: "Observability" },
              { t: "code", lang: "sql", code:
                "-- daily AI services credits by function and model (ACCOUNT_USAGE has latency)\n" +
                "SELECT DATE_TRUNC('day', start_time) AS day, function_name, model_name,\n" +
                "       SUM(tokens) AS tokens, SUM(token_credits) AS credits\n" +
                "FROM SNOWFLAKE.ACCOUNT_USAGE.CORTEX_FUNCTIONS_USAGE_HISTORY\n" +
                "WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())\n" +
                "GROUP BY 1, 2, 3\n" +
                "ORDER BY credits DESC;\n" +
                "-- per-query attribution: CORTEX_FUNCTIONS_QUERY_USAGE_HISTORY joined to QUERY_HISTORY on query_id"
              },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"how much will it cost to run this over the whole table\", \"finance saw an AI services line item\", \"lock down which models we use\", \"can a resource monitor cap this?\" Answer with the token math, the role and allowlist controls, and the usage views." },
              { t: "quiz", id: "ai-llm" },
              { t: "note", variant: "key", html: "<strong>Rows × tokens × rate, paid once.</strong> Pick the smallest model that passes a labelled pilot, score incrementally, keep the warehouse small, and govern access with CORTEX_USER plus the model allowlist; resource monitors will not save you." }
            ]
          }
        ]
      },
      {
        id: "analyst",
        name: "Cortex Analyst",
        icon: "map",
        lessons: [
          {
            id: "analyst-overview",
            title: "How Cortex Analyst turns questions into SQL",
            summary: "A semantic model gives the LLM your business vocabulary; Analyst returns SQL your client runs under the user's role.",
            minutes: 10,
            tags: ["cortex-analyst", "text-to-sql", "semantic-model"],
            blocks: [
              { t: "p", html: "Mental model: Cortex Analyst is <strong>a translator with a dictionary you wrote</strong>. The dictionary is the semantic model: which tables exist, what a business user means by \"revenue\" or \"active customer\", how tables join. Analyst reads the question plus that dictionary and produces one SQL statement. It does not guess from raw column names, and it does not run the query for you." },
              { t: "ol", items: [
                "The client sends the conversation (user turns and prior analyst turns) and a pointer to the semantic model: a YAML file on a stage, or a semantic view.",
                "Analyst classifies the question: answerable, ambiguous (it returns suggested rephrasings), or out of scope.",
                "For answerable questions it generates SQL over the physical tables the model maps to, consulting verified queries as worked examples.",
                "It returns an explanation and the SQL. <strong>The client executes that SQL</strong> in the user's own session.",
                "RBAC, masking and row access policies apply at execution, exactly as for hand-written SQL."
              ] },
              { t: "code", lang: "text", code:
                "POST /api/v2/cortex/analyst/message        (on your account host, e.g. acme-prod.snowflakecomputing.example)\n" +
                "Authorization: Bearer <OAUTH_OR_KEYPAIR_JWT>\n\n" +
                "{\n" +
                "  \"messages\": [\n" +
                "    { \"role\": \"user\",\n" +
                "      \"content\": [ { \"type\": \"text\", \"text\": \"Net revenue by region last quarter?\" } ] }\n" +
                "  ],\n" +
                "  \"semantic_model_file\": \"@ANALYTICS.SEMANTIC.MODELS/sales_model.yaml\"\n" +
                "}\n\n" +
                "response.message.content  ->  [ {type: text, text: \"This is our interpretation...\"},\n" +
                "                                {type: sql,  statement: \"SELECT ...\"},\n" +
                "                                {type: suggestions, suggestions: [...]} ]   # only when ambiguous"
              },
              { t: "table", headers: ["Piece", "What it is", "Where it lives"], rows: [
                ["Semantic model YAML", "Logical tables, dimensions, facts, metrics, filters, relationships, verified queries, custom instructions", "A file on an internal stage, versioned in Git"],
                ["Semantic view", "The same concepts as a schema-level object created with DDL", "<code class='tok'>CREATE SEMANTIC VIEW</code>; governed with grants"],
                ["Verified queries", "Question and SQL pairs you have checked", "Inside the model; few-shot examples, not a lookup table"],
                ["Client", "Streamlit app, chat UI, or your service", "Runs the SQL, renders results, keeps the conversation"]
              ] },
              { t: "code", lang: "sql", code:
                "-- the same concepts as a governed schema object (sketch; check current syntax in your release)\n" +
                "CREATE OR REPLACE SEMANTIC VIEW sales.sales_sv\n" +
                "  TABLES (\n" +
                "    orders    AS sales.fct_order_lines PRIMARY KEY (order_line_id),\n" +
                "    customers AS sales.dim_customer    PRIMARY KEY (customer_id)\n" +
                "  )\n" +
                "  RELATIONSHIPS ( orders_to_customers AS orders (customer_id) REFERENCES customers )\n" +
                "  FACTS      ( orders.net_amount AS gross_amount - discount_amount )\n" +
                "  DIMENSIONS ( customers.region AS region_name )\n" +
                "  METRICS    ( orders.net_revenue AS SUM(orders.net_amount) );\n" +
                "GRANT SELECT ON SEMANTIC VIEW sales.sales_sv TO ROLE sales_analyst;"
              },
              { t: "note", variant: "tip", html: "Because Analyst never executes anything, you can log every generated statement before running it, add a <code class='tok'>LIMIT</code>, route it to a dedicated warehouse, or tag it with <code class='tok'>QUERY_TAG = 'cortex-analyst'</code> for cost attribution." },
              { t: "h", text: "Where it goes wrong" },
              { t: "ul", items: [
                "<strong>Ambiguous vocabulary.</strong> Two columns could be \"revenue\" and the model does not say which one finance means.",
                "<strong>Missing joins.</strong> A question spans two tables with no declared relationship, so Analyst refuses or picks a wrong path.",
                "<strong>Raw codes.</strong> Status values like <code class='tok'>'C'</code> or <code class='tok'>'X'</code> with no <code class='tok'>sample_values</code> or description.",
                "<strong>Time grain.</strong> \"Last quarter\" without a declared fiscal calendar defaults to calendar quarters.",
                "<strong>Too much surface.</strong> Hundreds of columns dilute the context; curate the columns people actually ask about."
              ] },
              { t: "compare",
                bad: { title: "Text-to-SQL on the raw schema", items: ["Model guesses meaning from column names", "Joins inferred, often fanned out", "No place to encode business definitions"] },
                good: { title: "Analyst over a semantic model", items: ["Definitions written once, by the data team", "Joins declared with cardinality", "Ambiguity returns suggestions, not a wrong number"] } },
              { t: "table", headers: ["Tier", "Rollout", "Trade-off"], rows: [
                ["Naive", "Point Analyst at every table in a schema and open it to the company", "Fast demo, confidently wrong numbers, trust lost in a week"],
                ["Solid", "One curated model per domain, 10–30 columns, metrics defined, a handful of verified queries", "Upfront modelling effort; answers match the dashboard"],
                ["Standout", "Solid, plus an evaluation set of real questions with expected SQL results, run on every model change, and query logging for review", "Needs ownership, but regressions are caught before users see them"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"let business users ask questions in English\", \"self-serve analytics without writing SQL\", \"chat with our sales data\". Lead with the semantic model, and say explicitly that the generated SQL runs under the caller's role." },
              { t: "note", variant: "key", html: "<strong>Analyst writes SQL; your client runs it as the user.</strong> Answer quality is bounded by the semantic model you author, so treat that model as a governed product, not a config file." }
            ]
          },
          {
            id: "semantic-models",
            title: "Authoring semantic model YAML",
            summary: "Tables, dimensions, facts, metrics, relationships, verified queries and custom instructions, with the rules the parser enforces.",
            minutes: 12,
            tags: ["semantic-model", "yaml", "cortex-analyst"],
            blocks: [
              { t: "p", html: "Think of the YAML as <strong>a contract in business terms that points at physical tables</strong>. Each logical table maps to one base table or view; inside it you declare what can be grouped by (dimensions), what can be summed (facts), and what the business already agrees on (metrics). Relationships tell Analyst how logical tables join and with what cardinality." },
              { t: "h", text: "Top-level structure" },
              { t: "table", headers: ["Key", "Purpose", "Rule worth remembering"], rows: [
                ["<code class='tok'>name</code>, <code class='tok'>description</code>", "Identify the model and its domain", "The description is read by the model: write it for a new analyst"],
                ["<code class='tok'>tables</code>", "Logical tables over <code class='tok'>base_table</code> (database, schema, table)", "Declare <code class='tok'>primary_key</code> wherever a relationship lands"],
                ["<code class='tok'>relationships</code>", "Joins between logical tables", "<code class='tok'>name</code> required and unique; right side must be a key"],
                ["<code class='tok'>verified_queries</code>", "Checked question and SQL pairs", "<code class='tok'>verified_at</code> is an integer epoch"],
                ["<code class='tok'>module_custom_instructions</code>", "Guidance for <code class='tok'>sql_generation</code> and <code class='tok'>question_categorization</code>", "Home for rules that vary by environment"]
              ] },
              { t: "code", lang: "text", code:
                "name: sales_model\n" +
                "description: Orders, customers and products for the commercial team. Revenue is net of discounts and returns.\n" +
                "tables:\n" +
                "  - name: orders\n" +
                "    description: One row per order line.\n" +
                "    base_table: { database: ANALYTICS, schema: SALES, table: FCT_ORDER_LINES }\n" +
                "    primary_key: { columns: [order_line_id] }\n" +
                "    dimensions:\n" +
                "      - name: order_status\n" +
                "        expr: status_code\n" +
                "        data_type: VARCHAR\n" +
                "        description: Lifecycle status of the order line.\n" +
                "        sample_values: ['OPEN', 'SHIPPED', 'RETURNED']\n" +
                "        is_enum: true\n" +
                "      - name: customer_id\n" +
                "        expr: customer_id\n" +
                "        data_type: NUMBER\n" +
                "    time_dimensions:\n" +
                "      - name: order_date\n" +
                "        expr: order_ts::DATE\n" +
                "        data_type: DATE\n" +
                "        synonyms: ['purchase date', 'booked date']\n" +
                "    facts:\n" +
                "      - name: net_amount\n" +
                "        expr: gross_amount - discount_amount\n" +
                "        data_type: NUMBER\n" +
                "    metrics:\n" +
                "      - name: net_revenue\n" +
                "        expr: SUM(CASE WHEN status_code <> 'RETURNED' THEN gross_amount - discount_amount END)\n" +
                "        synonyms: ['revenue', 'sales', 'turnover']\n" +
                "        description: Finance definition of revenue. Excludes returned lines.\n" +
                "    filters:\n" +
                "      - name: shipped_only\n" +
                "        expr: status_code = 'SHIPPED'\n" +
                "  - name: customers\n" +
                "    base_table: { database: ANALYTICS, schema: SALES, table: DIM_CUSTOMER }\n" +
                "    primary_key: { columns: [customer_id] }\n" +
                "    dimensions:\n" +
                "      - { name: customer_id, expr: customer_id, data_type: NUMBER }\n" +
                "      - { name: region, expr: region_name, data_type: VARCHAR, synonyms: ['territory', 'geo'] }"
              },
              { t: "h", text: "Dimensions, facts and metrics" },
              { t: "table", headers: ["Element", "Holds", "Analyst uses it to"], rows: [
                ["Dimension", "Categorical attributes; <code class='tok'>sample_values</code> and <code class='tok'>is_enum</code> for code lists", "GROUP BY and WHERE on values users name"],
                ["Time dimension", "Dates and timestamps", "Resolve \"last quarter\", \"month over month\""],
                ["Fact", "Row-level numeric expressions", "Aggregate in whatever way the question asks"],
                ["Metric", "A fixed aggregate expression", "Return the agreed definition instead of inventing one"],
                ["Filter", "A named reusable predicate", "Map phrases like \"shipped orders\" to an exact condition"]
              ] },
              { t: "h", text: "Relationships" },
              { t: "code", lang: "text", code:
                "relationships:\n" +
                "  - name: orders_to_customers          # required, unique across the model\n" +
                "    left_table: orders\n" +
                "    right_table: customers\n" +
                "    relationship_columns:\n" +
                "      - left_column: customer_id\n" +
                "        right_column: customer_id      # must be customers' primary_key (or a unique key)\n" +
                "    join_type: left_outer\n" +
                "    relationship_type: many_to_one"
              },
              { t: "note", variant: "warn", html: "The right side of a many-to-one relationship must be a declared <strong>primary or unique key</strong>. If <code class='tok'>customers</code> has no <code class='tok'>primary_key</code>, or you join on <code class='tok'>region_code</code>, validation rejects it: a non-unique right side would multiply order rows and inflate every metric." },
              { t: "h", text: "Verified queries" },
              { t: "code", lang: "text", code:
                "verified_queries:\n" +
                "  - name: revenue_by_region_last_quarter\n" +
                "    question: What was net revenue by region last quarter?\n" +
                "    sql: |\n" +
                "      SELECT c.region, SUM(o.net_amount) AS net_revenue\n" +
                "      FROM __orders AS o                 -- logical names, prefixed with __\n" +
                "      JOIN __customers AS c ON o.customer_id = c.customer_id\n" +
                "      WHERE o.order_status <> 'RETURNED'\n" +
                "        AND o.order_date >= DATE_TRUNC('quarter', DATEADD(quarter, -1, CURRENT_DATE()))\n" +
                "        AND o.order_date <  DATE_TRUNC('quarter', CURRENT_DATE())\n" +
                "      GROUP BY c.region\n" +
                "    verified_at: 1793145600              # integer epoch seconds, not '2026-10-28'\n" +
                "    verified_by: data-platform\n" +
                "    use_as_onboarding_question: true"
              },
              { t: "note", variant: "trap", html: "<code class='tok'>verified_at: '2026-10-28'</code> looks reasonable and fails validation. Generate the integer once with <code class='tok'>SELECT DATE_PART(epoch_second, '2026-10-28'::TIMESTAMP_NTZ);</code> and paste it." },
              { t: "widget", id: "semanticLab" },
              { t: "h", text: "Custom instructions" },
              { t: "code", lang: "text", code:
                "module_custom_instructions:\n" +
                "  question_categorization: >-\n" +
                "    Treat questions about individual customer contact details as out of scope.\n" +
                "  sql_generation: >-\n" +
                "    Fiscal quarters start on the first day of February, May, August and November.\n" +
                "    Restrict __orders to program_id IN (${ACTIVE_PROGRAM_IDS}) unless the user names a program.\n" +
                "    Round currency to 2 decimals."
              },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the YAML won't upload\", \"Analyst picks the wrong revenue column\", \"how do I model the join to customers\", \"where do fiscal calendar rules go\". Walk the structure: base_table and primary_key, metric with synonyms, named key-to-key relationship, epoch verified_at, instructions for cross-cutting rules." },
              { t: "note", variant: "key", html: "<strong>Define meaning once, in business terms.</strong> Metrics with synonyms, keys on every joined table, unique relationship names, epoch timestamps on verified queries, and cross-cutting rules in module_custom_instructions." }
            ]
          },
          {
            id: "analyst-pitfalls",
            title: "Semantic model pitfalls and environment-agnostic design",
            summary: "The YAML gotchas that block uploads or give wrong answers, and how to ship one model across DEV, STG and PRD.",
            minutes: 11,
            tags: ["cortex-analyst", "yaml", "environments", "deployment"],
            blocks: [
              { t: "p", html: "Mental model: a semantic model is <strong>code that happens to be YAML</strong>. It has a parser that rejects malformed input, behaviour that regresses silently, and environment-specific values that must never be hardcoded. Treat it with the same discipline as a stored procedure: source control, templated deploys, backups, and tests." },
              { t: "h", text: "The gotcha list" },
              { t: "table", headers: ["Gotcha", "Symptom", "Fix"], rows: [
                ["<code class='tok'>verified_at</code> as a date string", "Upload or validation error on the verified query", "Integer epoch seconds, e.g. <code class='tok'>1793145600</code>"],
                ["Relationship without <code class='tok'>name</code>", "Validation error", "Every relationship gets a name"],
                ["Two relationships with the same name", "Validation error, or one silently shadows the other in tooling", "Names unique across the whole model"],
                ["FK lands on a non-key column", "Rejected: referenced column must be a primary or unique key", "Declare <code class='tok'>primary_key</code> on the right table and join key-to-key"],
                ["Env-specific literal in a verified query or table filter", "Correct in STG, silently wrong in PRD", "Move the rule into <code class='tok'>module_custom_instructions</code>, templated per environment"],
                ["Verified query added to patch a wrong answer", "That phrasing works; near-variants still fail", "Fix the metric, description or synonyms instead"],
                ["<code class='tok'>base_table.database</code> hardcoded to one env", "PRD model reads STG tables", "Template the database at deploy time"],
                ["PUT with default options", "File stored as <code class='tok'>sales_model.yaml.gz</code>; clients cannot find the YAML", "<code class='tok'>AUTO_COMPRESS=FALSE OVERWRITE=TRUE</code>"],
                ["Overwriting the live file with no copy", "No rollback when the new model regresses", "Copy to a dated backup path first"]
              ] },
              { t: "h", text: "One source, many environments" },
              { t: "p", html: "Keep a single template in Git with placeholders for everything that differs by environment: the database in each <code class='tok'>base_table</code>, and any environment-scoped rule inside <code class='tok'>module_custom_instructions</code>. The deploy job renders it from environment variables, validates it, backs up the live file, and uploads." },
              { t: "code", lang: "bash", code:
                "# deploy_semantic_model.sh  — values come from the CI environment, never from the repo\n" +
                "set -euo pipefail\n" +
                ": \"${TARGET_DB:?}\" \"${ACTIVE_PROGRAM_IDS:?}\" \"${MODEL_STAGE:?}\"\n" +
                "STAMP=$(date -u +%d%b | tr '[:lower:]' '[:upper:]')      # e.g. 28OCT\n" +
                "envsubst '${TARGET_DB} ${ACTIVE_PROGRAM_IDS}' < models/sales_model.tmpl.yaml > build/sales_model.yaml\n" +
                "grep -nE 'verified_at: *[\"'\\'']' build/sales_model.yaml && { echo 'verified_at must be epoch'; exit 1; }\n" +
                "snow sql -q \"COPY FILES INTO @${MODEL_STAGE}/backup/${STAMP}/ FROM @${MODEL_STAGE}/ FILES = ('sales_model.yaml')\"\n" +
                "snow sql -q \"PUT file://build/sales_model.yaml @${MODEL_STAGE}/ AUTO_COMPRESS=FALSE OVERWRITE=TRUE\"\n" +
                "snow sql -q \"LIST @${MODEL_STAGE}/ PATTERN='.*sales_model.*'\""
              },
              { t: "code", lang: "text", code:
                "# models/sales_model.tmpl.yaml (excerpt)\n" +
                "tables:\n" +
                "  - name: orders\n" +
                "    base_table: { database: ${TARGET_DB}, schema: SALES, table: FCT_ORDER_LINES }\n" +
                "module_custom_instructions:\n" +
                "  sql_generation: >-\n" +
                "    Restrict __orders to program_id IN (${ACTIVE_PROGRAM_IDS}) unless the user names a program.\n" +
                "verified_queries:\n" +
                "  - name: monthly_revenue\n" +
                "    question: What is net revenue by month?\n" +
                "    sql: |\n" +
                "      SELECT DATE_TRUNC('month', order_date) AS month, SUM(net_amount) AS net_revenue\n" +
                "      FROM __orders GROUP BY 1 ORDER BY 1      -- no env literal here\n" +
                "    verified_at: 1793145600"
              },
              { t: "note", variant: "warn", html: "Stages do not version files. <code class='tok'>PUT ... OVERWRITE=TRUE</code> destroys the previous model, so the backup copy (a dated folder, or a <code class='tok'>&lt;name&gt;_BKP_&lt;DDMON&gt;</code> naming convention your team already uses) is your only rollback. Restoring is one <code class='tok'>COPY FILES</code> back." },
              { t: "h", text: "Fix the model, not the symptom" },
              { t: "compare",
                bad: { title: "Patch with verified queries", items: ["One phrasing answered correctly", "The ambiguity remains for every other question", "Literals freeze one environment's values into the model"] },
                good: { title: "Fix the semantic layer", items: ["Metric defined once with expr, description, synonyms", "Relationships and keys correct", "Verified queries confirm behaviour and stay env-neutral"] } },
              { t: "table", headers: ["Tier", "Change process", "What it catches"], rows: [
                ["Naive", "Edit the YAML in the UI or on the stage directly", "Nothing; no history and no rollback"],
                ["Solid", "Template in Git, rendered per environment, backed up and uploaded by CI", "Parser errors, wrong-env tables, lost versions"],
                ["Standout", "Solid, plus an evaluation set of 30–100 real questions whose generated SQL is executed and compared to expected results before promotion", "Silent answer regressions after a synonym or metric change"]
              ] },
              { t: "h", text: "The validation loop" },
              { t: "ol", items: [
                "Render the template for the target environment and lint it (epoch timestamps, unique relationship names, no literals in verified SQL).",
                "Back up the live file on the stage.",
                "Upload uncompressed with overwrite and confirm it with <code class='tok'>LIST</code>.",
                "Run the evaluation questions through Analyst, execute the returned SQL, and diff results against expected answers.",
                "If anything regresses, restore the backup and fix the model, not the test."
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"it works in STG but PRD numbers are off\", \"the model won't validate after my edit\", \"should I just add a verified query for that question?\", \"how do we promote the YAML\". Name the specific gotcha, then the template-backup-upload-evaluate loop." },
              { t: "quiz", id: "ai-analyst" },
              { t: "note", variant: "key", html: "<strong>One templated model, rendered per environment, backed up before every upload.</strong> Epoch verified_at, named and unique key-to-key relationships, env rules in module_custom_instructions, and fix the semantic layer before reaching for a verified query." }
            ]
          }
        ]
      },
      {
        id: "search",
        name: "Cortex Search",
        icon: "globe",
        lessons: [
          {
            id: "cortex-search",
            title: "Cortex Search services",
            summary: "A managed hybrid search index over a SQL query, refreshed to a target lag and queried with filters.",
            minutes: 11,
            tags: ["cortex-search", "retrieval", "ddl"],
            blocks: [
              { t: "p", html: "Mental model: a Cortex Search service is <strong>a dynamic table whose output is a search index</strong>. You give it a SQL query that yields one row per searchable chunk, name the text column, list the columns you want to filter on, and set a target lag. Snowflake embeds the text, builds a hybrid vector-plus-keyword index, keeps it fresh, and serves low-latency queries against it." },
              { t: "h", text: "Creating a service" },
              { t: "code", lang: "sql", code:
                "USE DATABASE IDENTIFIER($env_db);          -- set per environment, never hardcoded\n" +
                "USE SCHEMA knowledge;\n\n" +
                "ALTER TABLE support_chunks SET CHANGE_TRACKING = TRUE;   -- required for incremental refresh\n\n" +
                "CREATE OR REPLACE CORTEX SEARCH SERVICE support_search\n" +
                "  ON chunk_text                                -- the column that is embedded and keyword-indexed\n" +
                "  ATTRIBUTES product, region, doc_type         -- filterable at query time\n" +
                "  WAREHOUSE = cortex_search_wh                 -- runs refreshes\n" +
                "  TARGET_LAG = '1 hour'\n" +
                "  EMBEDDING_MODEL = 'snowflake-arctic-embed-m-v1.5'\n" +
                "  AS (\n" +
                "    SELECT chunk_id, chunk_text, doc_id, doc_title, product, region, doc_type, updated_at\n" +
                "    FROM support_chunks\n" +
                "    WHERE is_published\n" +
                "  );\n\n" +
                "GRANT USAGE ON CORTEX SEARCH SERVICE support_search TO ROLE support_app;"
              },
              { t: "table", headers: ["Clause", "Meaning", "Trade-off"], rows: [
                ["<code class='tok'>ON col</code>", "Single text column to search", "Put title and section in the text if they help matching"],
                ["<code class='tok'>ATTRIBUTES</code>", "Columns usable in query filters", "Only these can be filtered; plan them up front"],
                ["<code class='tok'>WAREHOUSE</code>", "Compute for refreshes", "Larger speeds big rebuilds; billed while refreshing"],
                ["<code class='tok'>TARGET_LAG</code>", "Maximum staleness versus the source", "Shorter lag means more refreshes and more embedding"],
                ["<code class='tok'>EMBEDDING_MODEL</code>", "Model used for vectors", "Changing it means a full re-embed"],
                ["<code class='tok'>AS (query)</code>", "Defines the corpus; extra columns can be returned", "Keep it to published, chunked rows"]
              ] },
              { t: "note", variant: "warn", html: "Change tracking must be enabled on the source tables, and the owning role needs the privileges to create the service in the schema. A service built on a view over many joins refreshes more expensively than one over a prepared chunk table." },
              { t: "h", text: "Querying it" },
              { t: "code", lang: "sql", code:
                "-- quick test from SQL; production apps use the Python or REST API\n" +
                "SELECT r.value:chunk_id::STRING AS chunk_id,\n" +
                "       r.value:doc_title::STRING AS title,\n" +
                "       r.value:chunk_text::STRING AS passage\n" +
                "FROM TABLE(FLATTEN(PARSE_JSON(\n" +
                "  SNOWFLAKE.CORTEX.SEARCH_PREVIEW('knowledge.support_search', '{\n" +
                "    \"query\":   \"router reboots after firmware 7.2 upgrade\",\n" +
                "    \"columns\": [\"chunk_id\", \"doc_title\", \"chunk_text\"],\n" +
                "    \"filter\":  {\"@and\": [{\"@eq\": {\"product\": \"edge-router\"}}, {\"@eq\": {\"region\": \"EMEA\"}}]},\n" +
                "    \"limit\":   5\n" +
                "  }')\n" +
                "):results)) r;"
              },
              { t: "code", lang: "python", code:
                "from snowflake.core import Root\n\n" +
                "def search_support(session, question, product, k=5):\n" +
                "    svc = (Root(session).databases[session.get_current_database()]\n" +
                "           .schemas[\"KNOWLEDGE\"].cortex_search_services[\"SUPPORT_SEARCH\"])\n" +
                "    resp = svc.search(\n" +
                "        query=question,\n" +
                "        columns=[\"chunk_id\", \"doc_title\", \"chunk_text\"],\n" +
                "        filter={\"@eq\": {\"product\": product}},\n" +
                "        limit=k,\n" +
                "    )\n" +
                "    return resp.results"
              },
              { t: "table", headers: ["Filter operator", "Use"], rows: [
                ["<code class='tok'>@eq</code>", "Exact match on an attribute"],
                ["<code class='tok'>@contains</code>", "Attribute is an array containing a value"],
                ["<code class='tok'>@gte</code> / <code class='tok'>@lte</code>", "Ranges on numeric or date attributes"],
                ["<code class='tok'>@and</code> / <code class='tok'>@or</code> / <code class='tok'>@not</code>", "Combine conditions, for example tenant scoping plus product"]
              ] },
              { t: "h", text: "What it costs" },
              { t: "table", headers: ["Component", "Driven by", "Control"], rows: [
                ["Serving", "Size of indexed data while the service is serving", "Index only published chunks; suspend serving on idle services"],
                ["Embedding", "Tokens embedded on initial build and on changed rows", "Chunk once; avoid touching unchanged rows"],
                ["Refresh warehouse", "Refresh frequency and source query complexity", "Looser target lag, simple source table"]
              ] },
              { t: "code", lang: "sql", code:
                "SHOW CORTEX SEARCH SERVICES IN SCHEMA knowledge;\n" +
                "DESCRIBE CORTEX SEARCH SERVICE support_search;        -- lag, row count, state\n" +
                "ALTER CORTEX SEARCH SERVICE support_search SUSPEND SERVING;   -- pilot paused\n" +
                "ALTER CORTEX SEARCH SERVICE support_search RESUME SERVING;\n" +
                "ALTER CORTEX SEARCH SERVICE support_search SET TARGET_LAG = '1 day';"
              },
              { t: "table", headers: ["Tier", "Retrieval choice", "Trade-off"], rows: [
                ["Naive", "<code class='tok'>ILIKE '%term%'</code> over raw documents", "Misses synonyms and paraphrase; full scans"],
                ["Solid", "Hand-built embeddings in a <code class='tok'>VECTOR</code> column with <code class='tok'>VECTOR_COSINE_SIMILARITY</code>", "Full control, but you own chunking refresh, keyword fallback and ranking"],
                ["Standout", "Cortex Search over a curated chunk table, attributes for entitlement filtering, lag matched to how fast content changes", "Serving cost while up; less control over ranking internals"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"search our docs or tickets by meaning\", \"semantic search inside Snowflake\", \"the retrieval half of a chatbot\", \"filter results to the user's region or tenant\". Answer with the service DDL, attributes for filters, target lag, and the serving cost." },
              { t: "note", variant: "key", html: "<strong>A search service is a refreshed hybrid index over a SQL query.</strong> Choose the text column and filterable attributes deliberately, set the loosest target lag users accept, and suspend services nobody queries." }
            ]
          },
          {
            id: "rag",
            title: "Building RAG inside Snowflake",
            summary: "Parse, chunk, index, retrieve and generate with every step in-platform, and measure grounding instead of hoping for it.",
            minutes: 12,
            tags: ["rag", "cortex-search", "complete", "chunking"],
            blocks: [
              { t: "p", html: "Mental model: retrieval-augmented generation is <strong>an open-book exam for the model</strong>. You find the few passages that answer the question and hand them over with strict instructions to answer only from them. Answer quality is decided mostly by what you retrieve, not by which LLM you call." },
              { t: "ol", items: [
                "<strong>Land</strong> documents on an internal stage with a directory table.",
                "<strong>Parse</strong> PDFs and office files to text or layout-aware markdown.",
                "<strong>Chunk</strong> into overlapping passages and store them with metadata.",
                "<strong>Index</strong> the chunk table with a Cortex Search service.",
                "<strong>Retrieve</strong> the top passages for a question, filtered to what the user may see.",
                "<strong>Generate</strong> a grounded answer with COMPLETE, citing chunk ids."
              ] },
              { t: "h", text: "Parse and chunk" },
              { t: "code", lang: "sql", code:
                "CREATE STAGE IF NOT EXISTS docs_stage\n" +
                "  DIRECTORY = (ENABLE = TRUE)\n" +
                "  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');      -- server-side encryption needed for document parsing\n\n" +
                "CREATE OR REPLACE TABLE parsed_docs AS\n" +
                "SELECT relative_path AS doc_id,\n" +
                "       SNOWFLAKE.CORTEX.PARSE_DOCUMENT(@docs_stage, relative_path, {'mode': 'LAYOUT'}):content::STRING AS doc_text\n" +
                "FROM DIRECTORY(@docs_stage)\n" +
                "WHERE relative_path ILIKE '%.pdf';\n\n" +
                "CREATE OR REPLACE TABLE support_chunks AS\n" +
                "SELECT doc_id || '#' || c.index AS chunk_id,\n" +
                "       doc_id,\n" +
                "       SPLIT_PART(doc_id, '/', -1) || ' :: ' || c.value::STRING AS chunk_text,   -- title travels with the chunk\n" +
                "       'edge-router' AS product, 'EMEA' AS region, 'manual' AS doc_type,\n" +
                "       TRUE AS is_published, CURRENT_TIMESTAMP() AS updated_at, SPLIT_PART(doc_id, '/', -1) AS doc_title\n" +
                "FROM parsed_docs,\n" +
                "     LATERAL FLATTEN(SNOWFLAKE.CORTEX.SPLIT_TEXT_RECURSIVE_CHARACTER(doc_text, 'markdown', 1800, 250)) c;"
              },
              { t: "note", variant: "tip", html: "Chunk size is in characters here: about 1,800 characters is roughly a few hundred tokens. Start there with 10–15% overlap, then tune against your evaluation set. Real metadata (product, region, tenant) should come from a document registry table, not literals as in this sketch." },
              { t: "h", text: "Retrieve and generate" },
              { t: "code", lang: "python", code:
                "import json, os\n" +
                "from snowflake.snowpark import Session\n" +
                "from snowflake.core import Root\n" +
                "from snowflake.cortex import Complete\n\n" +
                "session = Session.builder.configs({\n" +
                "    \"account\": os.environ[\"SNOWFLAKE_ACCOUNT\"],           # e.g. acme-prod\n" +
                "    \"user\": os.environ[\"SNOWFLAKE_USER\"],\n" +
                "    \"authenticator\": \"SNOWFLAKE_JWT\",\n" +
                "    \"private_key_file\": os.environ[\"SNOWFLAKE_PRIVATE_KEY_PATH\"],\n" +
                "    \"role\": os.environ[\"SNOWFLAKE_ROLE\"],\n" +
                "    \"warehouse\": os.environ[\"SNOWFLAKE_WAREHOUSE\"],\n" +
                "    \"database\": os.environ[\"TARGET_DB\"],\n" +
                "}).create()\n\n" +
                "PROMPT_TEMPLATE = open(\"prompts/support_rag_v2.txt\").read()   # shown below; versioned with the code\n\n" +
                "def answer(question, product):\n" +
                "    svc = Root(session).databases[os.environ[\"TARGET_DB\"]].schemas[\"KNOWLEDGE\"].cortex_search_services[\"SUPPORT_SEARCH\"]\n" +
                "    hits = svc.search(query=question, columns=[\"chunk_id\", \"chunk_text\"],\n" +
                "                      filter={\"@eq\": {\"product\": product}}, limit=5).results\n" +
                "    context = \"\\n\\n\".join(f\"[{h['chunk_id']}] {h['chunk_text']}\" for h in hits)\n" +
                "    prompt = PROMPT_TEMPLATE.format(context=context, question=question)\n" +
                "    raw = Complete(\"mistral-large2\", prompt, session=session,\n" +
                "                   options={\"temperature\": 0, \"max_tokens\": 400})\n" +
                "    return raw, [h[\"chunk_id\"] for h in hits]"
              },
              { t: "code", lang: "text", code:
                "PROMPT_TEMPLATE\n" +
                "  You answer questions for support engineers using ONLY the passages below.\n" +
                "  Each passage starts with its id in square brackets.\n" +
                "  - Cite the ids you used, like [manual-7.2.pdf#14].\n" +
                "  - If the passages do not contain the answer, reply exactly: NOT FOUND IN DOCS.\n" +
                "  - Do not use outside knowledge. Keep the answer under 150 words.\n\n" +
                "  Passages:\n" +
                "  {context}\n\n" +
                "  Question: {question}"
              },
              { t: "table", headers: ["Failure", "Root cause", "Fix"], rows: [
                ["Vague answers", "Chunks too large or missing headings", "Smaller chunks with title prefix and overlap"],
                ["Right doc, wrong passage", "Too few results or no reranking signal", "Raise the limit to 8–10, keep the top few by score"],
                ["Fabricated detail", "Prompt allows outside knowledge", "Grounding rules, citations, explicit not-found path"],
                ["User sees another tenant's docs", "No entitlement filter", "Tenant attribute plus <code class='tok'>@eq</code> filter derived server-side from the session"],
                ["Stale answers", "Target lag too loose, or source not refreshed", "Match lag to content change rate; monitor refresh state"]
              ] },
              { t: "h", text: "Evaluate before you ship" },
              { t: "ul", items: [
                "Build 50–100 real questions with the chunk ids that should be retrieved and a reference answer.",
                "Measure <strong>retrieval hit rate</strong> (is a correct chunk in the top k?) separately from <strong>answer quality</strong>.",
                "Score faithfulness: does every claim trace to a cited chunk? A second COMPLETE call as a judge works, spot-checked by a human.",
                "Re-run the set on every change to chunking, embedding model, prompt or LLM, and store results in a table for trend lines."
              ] },
              { t: "table", headers: ["Tier", "Design", "Trade-off"], rows: [
                ["Naive", "Paste whole documents into a COMPLETE prompt", "Context overflow, high tokens, answers from the wrong section"],
                ["Solid", "Chunked corpus, Cortex Search with filters, grounded prompt with citations", "More moving parts to own and refresh"],
                ["Standout", "Solid, plus entitlement filters from the session, an evaluation set gating changes, and logged question, chunk and answer triples", "Evaluation upkeep, but quality is measured, not assumed"]
              ] },
              { t: "compare",
                bad: { title: "Export to an external vector store", items: ["Copies of governed data outside the platform", "Second access-control model to keep in sync", "Separate pipeline to keep fresh"] },
                good: { title: "RAG inside Snowflake", items: ["Documents, chunks, index and model calls under one RBAC", "Freshness via target lag", "Usage visible in ACCOUNT_USAGE alongside other spend"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"chatbot over our manuals\", \"answer questions from PDFs\", \"keep documents inside the governance boundary\", \"why is the bot making things up?\" Walk parse, chunk, index, retrieve with filters, generate with grounding, then show how you would evaluate it." },
              { t: "quiz", id: "ai-search" },
              { t: "note", variant: "key", html: "<strong>Retrieval quality decides answer quality.</strong> Chunk with overlap and titles, filter to the user's entitlements, force citations and a not-found path, and gate every change on an evaluation set." }
            ]
          }
        ]
      }
    ]
  };
})();
