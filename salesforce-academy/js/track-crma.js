/* =====================================================================
   ORBIT · CRM Analytics
   window.TRACKS.crma — modules: data / viz
   Self-contained: registers its own widgets, quizzes and track data.
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

  var Widgets = {};

  /* obSaqlBuilder — build a SAQL query and compute its result over a fixed sample dataset */
  Widgets.obSaqlBuilder = function (mount) {
    shell(mount, "builder", "SAQL builder",
      "Choose a grouping, a measure, a filter and a limit. The builder writes the SAQL statement by statement and runs it against a fixed 12-row opportunities sample.");
    var ROWS = [
      { Region: "AMER", StageName: "Closed Won", Owner: "Asha", Amount: 120000 },
      { Region: "AMER", StageName: "Proposal", Owner: "Ben", Amount: 80000 },
      { Region: "EMEA", StageName: "Closed Won", Owner: "Chen", Amount: 95000 },
      { Region: "EMEA", StageName: "Closed Lost", Owner: "Asha", Amount: 40000 },
      { Region: "APAC", StageName: "Closed Won", Owner: "Dara", Amount: 150000 },
      { Region: "APAC", StageName: "Prospecting", Owner: "Eli", Amount: 30000 },
      { Region: "LATAM", StageName: "Closed Won", Owner: "Farah", Amount: 60000 },
      { Region: "AMER", StageName: "Closed Won", Owner: "Chen", Amount: 70000 },
      { Region: "EMEA", StageName: "Proposal", Owner: "Dara", Amount: 55000 },
      { Region: "APAC", StageName: "Closed Lost", Owner: "Ben", Amount: 25000 },
      { Region: "LATAM", StageName: "Prospecting", Owner: "Eli", Amount: 20000 },
      { Region: "AMER", StageName: "Closed Won", Owner: "Farah", Amount: 45000 }
    ];
    var groupBy = "Region", measure = "sum", filter = "won", limit = 5;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function alias() { return measure === "count" ? "count" : (measure + "_Amount"); }
    function fmt(n) {
      var s = String(Math.round(n));
      var out = "";
      while (s.length > 3) { out = "," + s.slice(s.length - 3) + out; s = s.slice(0, s.length - 3); }
      return s + out;
    }
    function saql() {
      var a = alias();
      var expr = measure === "count" ? "count()" : (measure + "('Amount')");
      var lines = ["q = load \"opportunities\";"];
      if (filter === "won") lines.push("q = filter q by 'StageName' == \"Closed Won\";");
      lines.push("q = group q by '" + groupBy + "';");
      lines.push("q = foreach q generate '" + groupBy + "' as '" + groupBy + "', " + expr + " as '" + a + "';");
      lines.push("q = order q by '" + a + "' desc;");
      lines.push("q = limit q " + limit + ";");
      return lines.join("\n");
    }
    function run() {
      var groups = {}, keys = [], scanned = 0;
      for (var i = 0; i < ROWS.length; i++) {
        var r = ROWS[i];
        if (filter === "won" && r.StageName !== "Closed Won") continue;
        scanned++;
        var key = r[groupBy];
        if (!Object.prototype.hasOwnProperty.call(groups, key)) { groups[key] = { n: 0, sum: 0 }; keys.push(key); }
        groups[key].n += 1;
        groups[key].sum += r.Amount;
      }
      var out = [];
      for (var j = 0; j < keys.length; j++) {
        var g = groups[keys[j]];
        var v = measure === "count" ? g.n : (measure === "sum" ? g.sum : g.sum / g.n);
        out.push({ key: keys[j], value: v });
      }
      out.sort(function (x, y) { return y.value !== x.value ? y.value - x.value : (x.key < y.key ? -1 : 1); });
      return { rows: out.slice(0, limit), groupsTotal: out.length, scanned: scanned };
    }
    function paint() {
      var res = run();
      clear(stage);
      stage.appendChild(h("div", { class: "ob-mono" }, saql()));
      var table = h("table", { style: "width:100%;margin-top:14px;border-collapse:collapse;font-size:0.86rem" });
      table.appendChild(h("thead", {}, h("tr", {},
        h("th", { style: "text-align:left;padding:4px 8px" }, groupBy),
        h("th", { style: "text-align:right;padding:4px 8px" }, alias()))));
      var body = h("tbody", {});
      for (var i = 0; i < res.rows.length; i++) {
        var r = res.rows[i];
        body.appendChild(h("tr", {},
          h("td", { style: "padding:4px 8px" }, r.key),
          h("td", { style: "text-align:right;padding:4px 8px" }, measure === "count" ? String(r.value) : fmt(r.value))));
      }
      table.appendChild(body);
      stage.appendChild(table);
      clear(readout);
      readout.appendChild(ro("rows after filter", res.scanned + " of " + ROWS.length));
      readout.appendChild(ro("groups", res.groupsTotal));
      readout.appendChild(ro("returned", res.rows.length + (res.groupsTotal > limit ? " (limit cut " + (res.groupsTotal - limit) + ")" : "")));
      readout.appendChild(ro("top", res.rows.length ? res.rows[0].key : "none"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      h("div", { class: "w-field" }, h("label", {}, "Group by"),
        segment([["Region", "Region"], ["StageName", "Stage"], ["Owner", "Owner"]], 0, function (v) { groupBy = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Measure"),
        segment([["count", "count"], ["sum", "sum Amount"], ["avg", "avg Amount"]], 1, function (v) { measure = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Filter"),
        segment([["all", "All stages"], ["won", "Closed Won only"]], 1, function (v) { filter = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Limit"),
        segment([[5, "5"], [10, "10"]], 0, function (v) { limit = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "crma-data": {
      title: "CRM Analytics data layer checkpoint",
      sub: "Datasets, data sync, dataflows and recipes.",
      questions: [
        { q: "A sales manager edits an Opportunity amount and immediately refreshes a CRM Analytics dashboard. The old amount still shows. Why?",
          options: ["Dashboards cache results for 24 hours by design", "Dashboards query datasets, which only change when sync and the dataflow or recipe that builds them run again", "The manager lacks field-level security on Amount", "SAQL cannot read currency fields"], answer: 1,
          explain: "CRM Analytics queries prebuilt datasets, not live records. A change in Salesforce appears only after data sync extracts it and the dataflow or recipe rebuilds the dataset. Schedule refreshes to match how fresh the business needs the numbers to be." },
        { q: "Why are CRM Analytics datasets usually denormalised, with related fields flattened onto each row?",
          options: ["Because SAQL has no filter statement", "Because the Metadata API cannot deploy joins", "Because datasets must match the source object one to one", "Because the store is optimised for fast grouping and filtering over wide rows, so joins are done once at build time instead of on every query"], answer: 3,
          explain: "Datasets are compressed, indexed stores tuned for aggregation. Paying the join cost once in a recipe or dataflow keeps every dashboard query fast. The trade-off is larger datasets and the need to rebuild them when source data changes." },
        { q: "For new data preparation work, which tool is generally the recommended direction?",
          options: ["Dataflows edited as raw JSON", "Apex batch jobs writing to datasets", "Recipes in Data Prep", "Report snapshots"], answer: 2,
          explain: "Recipes offer a visual editor with joins, aggregation, formulas and multiple outputs, and they are where new data prep capability lands. Dataflows still run and are fine to maintain, but new builds usually start as recipes. Apex is not the tool for populating datasets." },
        { q: "What does data sync do in the CRM Analytics pipeline?",
          options: ["Extracts data from Salesforce objects and external connectors into a staging layer that dataflows and recipes read from", "Publishes dashboards to Lightning pages", "Applies security predicates to datasets", "Converts SAQL into SOQL at query time"], answer: 0,
          explain: "Sync separates extraction from transformation: objects are pulled, incrementally where supported, on their own schedule. Recipes and dataflows then read the synced data rather than querying source objects directly, which keeps build runs shorter and source load predictable." },
        { q: "A dataset build succeeds, but the dashboard that uses it is blank for every user. What is a likely cause worth checking first?",
          options: ["The dashboard needs a RunSpecifiedTests deploy", "SAQL queries require an Apex controller", "A security predicate on the dataset filters out every row, or the dashboard loads a dataset name that does not match", "Datasets can only be viewed by system administrators"], answer: 2,
          explain: "A predicate that never matches, or a load statement pointing at the wrong dataset API name, produces an empty result without an obvious error. Check the predicate against a real user and confirm the name the recipe or dataflow registered. Wave assets are metadata-only and deploy without Apex tests." }
      ]
    },
    "crma-viz": {
      title: "SAQL and dashboards checkpoint",
      sub: "Query statements, faceting, bindings and row-level security.",
      questions: [
        { q: "In SAQL, which statement turns grouped rows into output columns such as the group key and an aggregate?",
          options: ["load", "order", "limit", "foreach ... generate"], answer: 3,
          explain: "After group, each group is a bag of rows; foreach generate projects the key and computes aggregates like sum or count with aliases. Those aliases are what order, limit and dashboard widgets refer to. Without generate, nothing useful is projected." },
        { q: "Using the builder's sample data, grouped by Region with sum of Amount and the Closed Won filter, which region comes first?",
          options: ["AMER, at 235,000", "APAC, at 150,000", "EMEA, at 95,000", "LATAM, at 60,000"], answer: 0,
          explain: "AMER has three Closed Won rows: 120,000, 70,000 and 45,000, totalling 235,000. APAC has a single 150,000 deal. Ordering by the sum alias descending puts AMER first, which is why filtering before grouping matters." },
        { q: "Two widgets on a dashboard query the same dataset. A user clicks a bar for EMEA and the other widget filters to EMEA. What provides this?",
          options: ["A results binding", "Faceting, which shares selections between steps on the same dataset", "A security predicate", "Sharing inheritance"], answer: 1,
          explain: "Faceting propagates selections automatically between steps that query the same dataset. Across different datasets you need explicit links between fields. Bindings are for custom interactions faceting cannot express, such as feeding one step's result into another's query." },
        { q: "Which predicate limits each user to rows they own in a dataset that includes an OwnerId field?",
          options: ["WHERE OwnerId = :UserInfo.getUserId()", "'OwnerId' != null", "'OwnerId' == \"$User.Id\"", "with sharing"], answer: 2,
          explain: "Security predicates are SAQL-style filter expressions evaluated for every query on the dataset, and $User fields resolve to the running user. The other options are SOQL, a no-op, or an Apex keyword. Predicates apply regardless of which dashboard or lens issues the query." },
        { q: "What is a key limitation of sharing inheritance for datasets?",
          options: ["It replaces the need for app-level sharing", "It applies only to a limited set of supported objects, and users with very broad access fall back to a backup predicate", "It works only for external connector data", "It enforces field-level security from Salesforce"], answer: 1,
          explain: "Sharing inheritance mirrors Salesforce record access for supported core objects such as Account and Opportunity. Users whose access exceeds a platform threshold are governed by the backup predicate you define instead. It controls rows, not fields, and app sharing still controls who sees the assets." }
      ]
    }
  });

  /* obPredicateTester — which dataset rows each persona sees under a predicate */
  var CrmaMore = {};
  CrmaMore.obPredicateTester = function (mount) {
    shell(mount, "security", "Security predicate tester",
      "Pick a predicate and a persona. The tester evaluates the predicate row by row over a fixed eight-row dataset, the way CRM Analytics does on every query.");
    var ROWS = [
      { Name: "Acme renewal", OwnerId: "U1", Owner: "Asha", Region: "AMER", Roles: ["R_REP_AMER", "R_MGR_AMER", "R_VP"] },
      { Name: "Globex expansion", OwnerId: "U1", Owner: "Asha", Region: "AMER", Roles: ["R_REP_AMER", "R_MGR_AMER", "R_VP"] },
      { Name: "Initech new logo", OwnerId: "U2", Owner: "Ben", Region: "AMER", Roles: ["R_REP_AMER", "R_MGR_AMER", "R_VP"] },
      { Name: "Umbrella upsell", OwnerId: "U3", Owner: "Chen", Region: "EMEA", Roles: ["R_REP_EMEA", "R_MGR_EMEA", "R_VP"] },
      { Name: "Stark platform", OwnerId: "U3", Owner: "Chen", Region: "EMEA", Roles: ["R_REP_EMEA", "R_MGR_EMEA", "R_VP"] },
      { Name: "Wayne services", OwnerId: "U4", Owner: "Dara", Region: "APAC", Roles: ["R_REP_APAC", "R_MGR_APAC", "R_VP"] },
      { Name: "Hooli pilot", OwnerId: "U4", Owner: "Dara", Region: "APAC", Roles: ["R_REP_APAC", "R_MGR_APAC", "R_VP"] },
      { Name: "Soylent renewal", OwnerId: "U5", Owner: "Eli", Region: "EMEA", Roles: ["R_REP_EMEA", "R_MGR_EMEA", "R_VP"] }
    ];
    var PERSONAS = {
      rep: { label: "Asha, AMER rep", Id: "U1", Region: "AMER", UserRoleId: "R_REP_AMER" },
      mgr: { label: "EMEA manager", Id: "U9", Region: "EMEA", UserRoleId: "R_MGR_EMEA" },
      vp: { label: "Sales VP", Id: "U8", Region: "ALL", UserRoleId: "R_VP" }
    };
    var PREDICATES = {
      none: { text: "(no predicate)", test: function () { return true; } },
      owner: { text: "'OwnerId' == \"$User.Id\"", test: function (r, u) { return r.OwnerId === u.Id; } },
      region: { text: "'OwnerId' == \"$User.Id\" || 'Region' == \"$User.Region__c\"", test: function (r, u) { return r.OwnerId === u.Id || r.Region === u.Region; } },
      roles: { text: "'OwnerId' == \"$User.Id\" || 'Roles' == \"$User.UserRoleId\"", test: function (r, u) { return r.OwnerId === u.Id || r.Roles.indexOf(u.UserRoleId) >= 0; } }
    };
    var st = { pred: "owner", who: "rep" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var u = PERSONAS[st.who], p = PREDICATES[st.pred];
      clear(stage);
      stage.appendChild(h("div", { class: "ob-mono" }, p.text));
      var grid = h("div", { class: "ob-grid" });
      var seen = 0;
      for (var i = 0; i < ROWS.length; i++) {
        var r = ROWS[i], ok = p.test(r, u);
        if (ok) seen++;
        grid.appendChild(h("div", { class: "ob-card " + (ok ? "is-ok" : "is-dim") },
          h("h4", {}, r.Name), r.Owner + " · " + r.Region + " · " + (ok ? "visible" : "filtered out")));
      }
      stage.appendChild(grid);
      clear(readout);
      readout.appendChild(ro("persona", u.label));
      readout.appendChild(ro("rows visible", seen + " of " + ROWS.length));
      var note = st.pred === "none" ? "every user with app access sees every row"
        : st.pred === "owner" ? "managers see nothing they do not own"
        : st.pred === "region" ? "depends on a user field being populated and correct"
        : "Roles is a multi-value field built by flattening the role hierarchy, so managers see subordinates' rows";
      readout.appendChild(ro("note", note));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("div", { class: "w-field" }, h("label", {}, "Predicate"),
        segment([["none", "None"], ["owner", "Owner only"], ["region", "Owner or region"], ["roles", "Owner or role hierarchy"]], 1, function (v) { st.pred = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Running user"),
        segment([["rep", "AMER rep"], ["mgr", "EMEA manager"], ["vp", "Sales VP"]], 0, function (v) { st.who = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };
  window.Widgets = Object.assign(window.Widgets || {}, CrmaMore);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "crma-govern": {
      title: "XMD, security and bindings checkpoint",
      sub: "Extended metadata, row-level security patterns and advanced dashboard interactions.",
      questions: [
        { q: "Users see the raw value \"CW\" in a dashboard instead of \"Closed Won\", and amounts lack thousands separators. What do you change?",
          options: ["The recipe, renaming every value", "The dataset's XMD: member labels for the dimension and number format for the measure", "The SAQL limit statement", "The app's sharing"], answer: 1,
          explain: "Extended metadata controls display: field labels, member labels, number and date formats, colours and ordering. It changes presentation without rebuilding the dataset. Ship it as WaveXmd whose dataset matches the dataset API name." },
        { q: "Using the predicate tester, with \"Owner or role hierarchy\", how many rows does the EMEA manager see?",
          options: ["0", "2", "3", "8"], answer: 2,
          explain: "The manager owns no rows, but three rows carry R_MGR_EMEA in their flattened Roles field: the two Umbrella and Stark rows owned by Chen and the Soylent row owned by Eli. The flatten step is what lets one predicate express the hierarchy." },
        { q: "How do you make a predicate respect the role hierarchy without listing every subordinate?",
          options: ["Flatten the role hierarchy in the recipe or dataflow into a multi-value field on each row, then match it to $User.UserRoleId", "Use with sharing in the dashboard", "Add the hierarchy to the XMD", "Share the app with the manager's role"], answer: 0,
          explain: "A flatten transformation produces, for each owner, the chain of roles above them. Storing that on every row lets a single predicate test whether the running user's role is anywhere in the chain. App sharing controls asset access, not rows." },
        { q: "A toggle should switch a chart between grouping by Region and by Owner. What is the usual technique?",
          options: ["Two dashboards", "A security predicate", "A static step with the grouping values, bound into the chart step's query with a selection binding", "Faceting between unrelated datasets"], answer: 2,
          explain: "Static steps hold fixed values that users pick from. A selection binding injects the chosen value into another step's query, for example as the grouping, so one chart can change shape. Faceting only filters." },
        { q: "What should you do when a selection binding may be empty, for example before the user picks anything?",
          options: ["Nothing; empty bindings always return every row", "Remove the binding and use faceting on every field", "Hardcode a user's choice in the dashboard JSON", "Provide a default, for example with coalesce, and test the empty case"], answer: 3,
          explain: "An empty selection can produce an invalid or unexpectedly narrow query depending on the serializer. Wrapping the binding in coalesce with a sensible default keeps the step valid, and testing the first-load state catches the problem before users do." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.crma = {
    id: "crma",
    name: "CRM Analytics",
    short: "CRMA",
    tagline: "Prebuilt datasets, fast questions",
    color: "#f87171",
    blurb: "Understand how CRM Analytics differs from standard reports: data sync pulls records, dataflows and recipes shape them into datasets, SAQL queries them, and dashboards facet and bind steps together. Secure it all with app sharing, security predicates and sharing inheritance, and ship it as metadata.",
    modules: [
      {
        id: "data",
        name: "Data Layer",
        icon: "database",
        lessons: [
          {
            id: "crma-overview",
            title: "CRM Analytics architecture",
            summary: "Sync, prepare, store, query, present: the five layers and how they differ from standard reports.",
            minutes: 9,
            tags: ["crm-analytics", "architecture", "datasets"],
            blocks: [
              { t: "p", html: "Standard reports ask live records a question each time. CRM Analytics works like a <strong>newspaper print run</strong>: data is gathered on a schedule, laid out into datasets built for reading, and every dashboard reads the printed edition. Queries are fast and can blend sources, but the news is only as fresh as the last run." },
              { t: "h", text: "The layers" },
              { t: "ol", items: [
                "<strong>Data sync</strong> extracts Salesforce objects, incrementally where supported, and data from external connectors such as cloud warehouses and databases.",
                "<strong>Data prep</strong> with recipes or dataflows joins, filters, aggregates and computes fields.",
                "<strong>Datasets</strong> store the result in a compressed, indexed form tuned for grouping and filtering.",
                "<strong>Queries</strong> in SAQL or the compact form run against datasets.",
                "<strong>Lenses, dashboards and apps</strong> present results, embedded in Analytics Studio or in Lightning pages."
              ] },
              { t: "table", headers: ["Question", "Standard reports", "CRM Analytics"], rows: [
                ["Data freshness", "Live", "As of the last sync and build"],
                ["Data sources", "Salesforce objects via report types", "Salesforce plus external connectors, blended in one dataset"],
                ["Scale", "Row limits on display and export", "Built for large, aggregated datasets"],
                ["Query language", "Report builder (SOQL underneath)", "SAQL and compact queries"],
                ["Security", "Record sharing and FLS of the viewer", "App sharing plus dataset predicates or sharing inheritance"],
                ["Cost to build", "Low, admin-friendly", "Higher: pipelines, schedules and licences to plan"]
              ] },
              { t: "note", variant: "tip", html: "Use standard reports when users need live operational lists. Reach for CRM Analytics when the question spans large history, blends external data, or needs interactive exploration across many dimensions." },
              { t: "h", text: "The metadata you ship" },
              { t: "table", headers: ["Type", "Files", "Role"], rows: [
                ["WaveApplication", "<code class='tok'>.wapp-meta.xml</code>", "The app folder and its sharing; prefer reusing an existing app"],
                ["WaveDataflow / WaveRecipe", "<code class='tok'>.wdf</code> / <code class='tok'>.wdpr</code> plus meta", "Build datasets"],
                ["WaveDataset", "<code class='tok'>.wds-meta.xml</code>", "Dataset registration"],
                ["WaveXmd", "<code class='tok'>.xmd-meta.xml</code>", "Field labels, formats and ordering"],
                ["WaveLens", "<code class='tok'>.wlens</code> plus meta", "A saved single-query exploration"],
                ["WaveDashboard", "<code class='tok'>.wdash</code> plus meta", "Layout, steps and widgets; deploy last"]
              ] },
              { t: "note", variant: "warn", html: "Deploying a new recipe or dataflow does not populate its dataset. Run it after the deploy, or the dashboard that depends on it shows nothing." },
              { t: "cue", html: "Think CRM Analytics when you hear <em>\"five years of history across regions\"</em>, <em>\"combine Salesforce with warehouse data\"</em>, or <em>\"our reports time out\"</em>; think standard reports when you hear <em>\"I need today's open cases right now\"</em>." },
              { t: "note", variant: "key", html: "<strong>Sync, prep, store, query, present.</strong> Dashboards read prebuilt datasets, which makes them fast and blendable but only as fresh as the last build." }
            ]
          },
          {
            id: "dataflows-recipes",
            title: "Dataflows, recipes and data sync",
            summary: "How datasets get built: sync schedules, dataflow nodes, recipe steps, and how to keep builds fast.",
            minutes: 10,
            tags: ["crm-analytics", "recipes", "dataflows"],
            blocks: [
              { t: "p", html: "Picture a <strong>kitchen with a pantry and two cooks</strong>. Data sync stocks the pantry from Salesforce and external sources. Dataflows are the older cook working from a written JSON recipe card; recipes in Data Prep are the newer cook with a visual workstation. Both turn pantry stock into datasets that dashboards serve." },
              { t: "h", text: "Dataflows" },
              { t: "code", lang: "text", code: [
                "{",
                "  \"Extract_Opps\": {",
                "    \"action\": \"sfdcDigest\",",
                "    \"parameters\": { \"object\": \"Opportunity\",",
                "      \"fields\": [ { \"name\": \"Id\" }, { \"name\": \"AccountId\" }, { \"name\": \"StageName\" }, { \"name\": \"Amount\" }, { \"name\": \"OwnerId\" } ] }",
                "  },",
                "  \"Extract_Accts\": {",
                "    \"action\": \"sfdcDigest\",",
                "    \"parameters\": { \"object\": \"Account\", \"fields\": [ { \"name\": \"Id\" }, { \"name\": \"Region__c\" } ] }",
                "  },",
                "  \"Join_Account\": {",
                "    \"action\": \"augment\",",
                "    \"parameters\": { \"left\": \"Extract_Opps\", \"left_key\": [\"AccountId\"],",
                "      \"right\": \"Extract_Accts\", \"right_key\": [\"Id\"], \"right_select\": [\"Region__c\"], \"relationship\": \"Account\" }",
                "  },",
                "  \"Register_Opps\": {",
                "    \"action\": \"sfdcRegister\",",
                "    \"parameters\": { \"source\": \"Join_Account\", \"alias\": \"opportunities\", \"name\": \"Opportunities\" }",
                "  }",
                "}"
              ].join("\n") },
              { t: "p", html: "Nodes extract (<code class='tok'>sfdcDigest</code>, or <code class='tok'>digest</code> for synced external data), join (<code class='tok'>augment</code>), compute (<code class='tok'>computeExpression</code>, <code class='tok'>computeRelative</code>), filter, flatten hierarchies, and register the output as a dataset. Every dataflow ends with at least one register node." },
              { t: "h", text: "Recipes" },
              { t: "ul", items: [
                "<strong>Load</strong> synced objects, connected data or existing datasets.",
                "<strong>Join</strong> with lookup, left, right, inner or full outer semantics; right-side fields get the join alias as a prefix.",
                "<strong>Transform</strong> with formulas, buckets, splits, date handling and more.",
                "<strong>Aggregate</strong> to change grain, for example opportunity to account per quarter.",
                "<strong>Output</strong> one or more datasets in an app folder."
              ] },
              { t: "table", headers: ["Aspect", "Dataflow", "Recipe"], rows: [
                ["Authoring", "JSON definition, visual editor available", "Visual Data Prep canvas"],
                ["Joins", "<code class='tok'>augment</code> (lookup-style)", "Several join types plus append"],
                ["Direction", "Maintained", "Where new capability generally lands"],
                ["Metadata", "WaveDataflow <code class='tok'>.wdf</code>", "WaveRecipe <code class='tok'>.wdpr</code>"]
              ] },
              { t: "h", text: "Keeping builds healthy" },
              { t: "table", headers: ["Tier", "Approach", "Trade-off"], rows: [
                ["Naive", "One huge dataflow that digests every object directly and rebuilds every dataset nightly", "Long runs, source load spikes, one failure breaks everything"],
                ["Solid", "Sync on its own schedule with incremental extraction; recipes per subject area read synced data", "Faster, isolated builds; more schedules to coordinate"],
                ["Standout", "Sync plus subject recipes, only the fields dashboards use, aggregated where detail is not needed, with run monitoring and alerts", "Lean datasets and predictable refreshes, at the cost of upfront modelling"]
              ] },
              { t: "note", variant: "warn", html: "Orgs have a cap on dataflow and recipe runs per rolling 24 hours (commonly 60, shared by both) and on concurrent runs, plus licence-based limits on total dataset rows. Check the Analytics limits for your licence and design schedules with headroom rather than near the ceiling." },
              { t: "note", variant: "tip", html: "The integration user that sync runs as decides which records and fields can be extracted. Leave out fields the business does not need: data that never enters a dataset can never leak from one." },
              { t: "cue", html: "Redesign the build when you hear <em>\"the nightly dataflow takes four hours\"</em>, <em>\"we hit the run limit\"</em>, or <em>\"the dashboard is slow because the dataset has 400 columns\"</em>." },
              { t: "quiz", id: "crma-data" },
              { t: "note", variant: "key", html: "<strong>Sync stocks the pantry, recipes or dataflows cook, datasets are served.</strong> Separate extraction from preparation, prefer recipes for new work, and keep datasets lean." }
            ]
          }
        ]
      },
      {
        id: "viz",
        name: "Querying & Dashboards",
        icon: "trend",
        lessons: [
          {
            id: "saql",
            title: "SAQL essentials",
            summary: "The statement-by-statement query language behind dashboards: load, filter, group, generate, order, limit.",
            minutes: 10,
            tags: ["saql", "crm-analytics", "queries"],
            blocks: [
              { t: "p", html: "SAQL reads like a <strong>pipeline of reassignments</strong>. Each line takes the stream <code class='tok'>q</code>, does one thing to it, and hands it on: load, filter, group, project, order, limit. Unlike SOQL, you can see and reorder every stage, which makes it easy to reason about cost: filter early and the later stages see fewer rows." },
              { t: "code", lang: "sql", code: [
                "q = load \"opportunities\";",
                "q = filter q by 'StageName' == \"Closed Won\";",
                "q = group q by 'Region';",
                "q = foreach q generate 'Region' as 'Region', sum('Amount') as 'sum_Amount';",
                "q = order q by 'sum_Amount' desc;",
                "q = limit q 5;"
              ].join("\n") },
              { t: "table", headers: ["Statement", "Does", "Note"], rows: [
                ["<code class='tok'>load</code>", "Opens a dataset by name", "The name must match what the recipe or dataflow registered"],
                ["<code class='tok'>filter ... by</code>", "Keeps matching rows", "Field names in single quotes, string literals in double quotes"],
                ["<code class='tok'>group ... by</code>", "Buckets rows by one or more fields, or <code class='tok'>all</code>", "Use a tuple for several fields"],
                ["<code class='tok'>foreach ... generate</code>", "Projects keys and aggregates with aliases", "<code class='tok'>count()</code>, <code class='tok'>sum</code>, <code class='tok'>avg</code>, <code class='tok'>min</code>, <code class='tok'>max</code>, <code class='tok'>unique</code>"],
                ["<code class='tok'>order ... by</code>", "Sorts by an alias", "<code class='tok'>asc</code> or <code class='tok'>desc</code>"],
                ["<code class='tok'>limit</code>", "Caps returned rows", "Always include one"]
              ] },
              { t: "widget", id: "obSaqlBuilder" },
              { t: "p", html: "With the defaults the builder returns AMER at 235,000, APAC at 150,000, EMEA at 95,000 and LATAM at 60,000. Switch the filter to all stages and AMER jumps to 315,000 because the 80,000 proposal now counts. Group by Owner over all stages and six owners compete for five rows, so the limit drops Eli." },
              { t: "h", text: "Beyond the basics" },
              { t: "code", lang: "sql", code: [
                "-- dates: relative ranges over the date parts a dataset stores",
                "q = filter q by date('CloseDate_Year', 'CloseDate_Month', 'CloseDate_Day') in [\"current year\"..\"current year\"];",
                "",
                "-- conditional measures",
                "q = foreach q generate 'Region' as 'Region',",
                "    sum(case when 'StageName' == \"Closed Won\" then 'Amount' else 0 end) as 'won_Amount';",
                "",
                "-- combine two datasets on a shared key",
                "o = load \"opportunities\";",
                "t = load \"targets\";",
                "c = cogroup o by 'Region', t by 'Region';",
                "c = foreach c generate o.'Region' as 'Region', sum(o.'Amount') as 'actual', sum(t.'Target') as 'target';"
              ].join("\n") },
              { t: "note", variant: "trap", html: "Order and limit reference the <em>alias</em> you generated, not the source field. Ordering by <code class='tok'>'Amount'</code> after grouping fails because only <code class='tok'>'sum_Amount'</code> exists at that point." },
              { t: "table", headers: ["Tier", "Query habit", "Effect"], rows: [
                ["Naive", "Load everything, group, then filter on the aggregate", "Scans every row and often answers the wrong question"],
                ["Solid", "Filter before grouping, alias every measure, always limit", "Fast, readable, matches widget column maps"],
                ["Standout", "Push heavy logic into the recipe so dashboards run short queries over lean datasets", "Snappy dashboards that stay fast as data grows"]
              ] },
              { t: "note", variant: "tip", html: "Simple filter steps can use the compact query form, which the dashboard designer generates for you. Drop to SAQL when you need functions, cogroup, case expressions or windowing." },
              { t: "cue", html: "Write SAQL by hand when you hear <em>\"compare actuals to targets from another dataset\"</em>, <em>\"won amount next to total amount\"</em>, or <em>\"the chart sorts the wrong way\"</em>." },
              { t: "note", variant: "key", html: "<strong>Load, filter early, group, generate with aliases, order by alias, always limit.</strong> Each line reassigns the stream, so every stage is visible and testable." }
            ]
          },
          {
            id: "dashboards",
            title: "Dashboards, bindings and security",
            summary: "Steps and widgets, faceting and bindings, and the app sharing, predicates and sharing inheritance that decide who sees which rows.",
            minutes: 11,
            tags: ["dashboards", "bindings", "security"],
            blocks: [
              { t: "p", html: "A CRM Analytics dashboard is a <strong>switchboard of steps and widgets</strong>. Steps are queries; widgets are the charts, numbers, tables and filters that display them. Wiring between steps (faceting, links and bindings) decides how a click in one place changes the others. Security sits underneath, deciding which rows any of those queries can ever return." },
              { t: "h", text: "Interaction wiring" },
              { t: "table", headers: ["Mechanism", "Scope", "Use it for"], rows: [
                ["Faceting", "Steps on the same dataset", "Click a bar, every related widget filters; on by default"],
                ["Dataset links", "Steps on different datasets", "Faceting across datasets through mapped fields"],
                ["Selection binding", "One step's selection feeds another's query", "Custom filters faceting cannot express, such as a selection driving a different field"],
                ["Results binding", "One step's result feeds another's query or a property", "Dynamic thresholds, titles or top-N driven by data"]
              ] },
              { t: "code", lang: "text", code: [
                "-- selection binding: filter by whatever regions the user picked in step_region",
                "q = filter q by {{column(step_region.selection, [\"Region\"]).asEquality('Region')}};",
                "",
                "-- results binding: use the first row's target value from another step",
                "q = filter q by 'Amount' >= {{cell(step_target.result, 0, \"target\").asObject()}};",
                "",
                "-- exact binding functions and serializers vary by use; check them in the dashboard JSON editor"
              ].join("\n") },
              { t: "note", variant: "trap", html: "Do not combine faceting and an explicit binding on the same field for the same step. The filter applies twice and cascading selectors show only one value." },
              { t: "h", text: "Who sees what" },
              { t: "table", headers: ["Layer", "Controls", "Notes"], rows: [
                ["App sharing", "Who can view, edit or manage the app's dashboards, lenses and datasets", "Viewer, Editor and Manager roles; share with users, groups or roles"],
                ["Security predicate", "Which dataset rows each user can query", "A filter expression evaluated on every query, for example matching OwnerId to the running user"],
                ["Sharing inheritance", "Mirrors Salesforce record access for supported objects", "Limited to supported core objects; very broad users fall back to a backup predicate"],
                ["Extraction scope", "Which records and fields reach datasets at all", "Set by the integration user's access and the fields you sync"]
              ] },
              { t: "code", lang: "text", code: [
                "-- dataset security predicate: owners see their rows, a regional role sees its region",
                "'OwnerId' == \"$User.Id\" || 'Region' == \"$User.Region__c\""
              ].join("\n") },
              { t: "note", variant: "warn", html: "Field-level security in Salesforce does not automatically follow data into a dataset. If a field is sensitive, leave it out of the dataset or split it into a separately secured dataset." },
              { t: "table", headers: ["Tier", "Security design", "Risk"], rows: [
                ["Naive", "Share the app widely and rely on users not looking", "Everyone can query every row"],
                ["Solid", "App sharing by audience plus a predicate on every dataset", "Correct rows, but predicates drift as roles change"],
                ["Standout", "Sharing inheritance where supported, tested backup predicates, minimal extracted fields, and a check with real test users per persona", "Row access matches Salesforce and is verified, not assumed"]
              ] },
              { t: "h", text: "Shipping dashboards" },
              { t: "ul", items: [
                "Wave assets are <strong>metadata only</strong>, so they take the direct path: <code class='tok'>sf project deploy start --source-dir force-app/main/default/wave --test-level NoTestRun --target-org uat</code> in non-production orgs.",
                "Deploy in dependency order: app (only if new), recipe or dataflow, dataset, XMD, lens, dashboard last.",
                "Run the recipe or dataflow after deploying a new dataset, then check that filters populate and faceting propagates.",
                "Every query in a dashboard should carry a <code class='tok'>limit</code>; every widget should reference an existing step."
              ] },
              { t: "cue", html: "Reach for bindings and predicates when you hear <em>\"the filter should change a different field\"</em>, <em>\"reps must only see their own pipeline\"</em>, or <em>\"the dashboard is blank for one manager\"</em>." },
              { t: "quiz", id: "crma-viz" },
              { t: "note", variant: "key", html: "<strong>Steps query, widgets display, faceting and bindings connect, predicates decide rows.</strong> Share apps by audience, put a predicate or sharing inheritance on every dataset, and deploy Wave assets in dependency order." }
            ]
          }
        ]
      },
      {
        id: "govern",
        name: "Metadata, Security & Interactions",
        icon: "shield",
        lessons: [
          {
            id: "xmd",
            title: "Extended metadata (XMD)",
            summary: "How XMD controls labels, member labels, formats, colours and ordering for a dataset, and how to ship it as metadata.",
            minutes: 9,
            tags: ["xmd", "crm-analytics", "metadata"],
            blocks: [
              { t: "p", html: "A dataset is a <strong>spreadsheet with terse column codes</strong>; XMD is the <strong>style sheet and glossary</strong> clipped to it. It says that <code class='tok'>STAGE</code> should read \"Stage\", that the value <code class='tok'>CW</code> means \"Closed Won\" and is green, that <code class='tok'>AMOUNT</code> needs a currency format, and in what order fields appear. The data stays the same; how every dashboard shows it changes." },
              { t: "table", headers: ["XMD section", "Controls", "Example"], rows: [
                ["dimensions", "Field labels, member labels, member colours, sort order", "STAGE shown as \"Stage\"; CW shown as \"Closed Won\""],
                ["measures", "Labels and number formats", "AMOUNT with thousands separator and two decimals"],
                ["dates", "Labels, fiscal month offset, first day of week", "Fiscal year starting in February"],
                ["derived fields", "Fields computed in the dashboard layer", "Flagged as derived so tools treat them correctly"]
              ] },
              { t: "p", html: "There are layers: a <strong>system</strong> XMD generated from the dataset, the <strong>user</strong> XMD holding your overrides, and the <strong>main</strong> XMD, the merged view tools read. You edit the user layer, in Analytics Studio or as metadata." },
              { t: "code", lang: "text", code: [
                "<!-- Opportunities.xmd-meta.xml (namespace attributes omitted) -->",
                "<WaveXmd>",
                "    <dataset>Opportunities</dataset>",
                "    <dimensions>",
                "        <field>STAGE</field>",
                "        <label>Stage</label>",
                "        <isDerived>false</isDerived>",
                "        <members><label>Closed Won</label><member>CW</member><sortIndex>0</sortIndex></members>",
                "        <sortIndex>0</sortIndex>",
                "    </dimensions>",
                "    <measures>",
                "        <field>AMOUNT</field>",
                "        <formatCustomFormat>[\"#,###.##\",1]</formatCustomFormat>",
                "        <formatDecimalSeparator>.</formatDecimalSeparator>",
                "        <formatThousandsSeparator>,</formatThousandsSeparator>",
                "        <isDerived>false</isDerived>",
                "        <sortIndex>0</sortIndex>",
                "    </measures>",
                "</WaveXmd>"
              ].join("\n") },
              { t: "ul", items: [
                "<code class='tok'>dataset</code> must match the dataset API name exactly.",
                "Each field appears once; <code class='tok'>sortIndex</code> values run from 0 without gaps within a section.",
                "Deploy XMD after the dataset exists and before the dashboards that rely on its labels.",
                "Renaming a field in the recipe orphans its XMD entry; update both together."
              ] },
              { t: "note", variant: "tip", html: "Put presentation in XMD rather than in every dashboard. One label or colour change then applies to every lens and widget on that dataset, and code review sees it in one file." },
              { t: "cue", html: "Reach for XMD when you hear <em>\"why does it say CW?\"</em>, <em>\"make Closed Won always green\"</em>, or <em>\"our fiscal year starts in February\"</em>." },
              { t: "note", variant: "key", html: "<strong>XMD is presentation metadata for a dataset.</strong> Labels, members, formats, colours and fiscal dates live there once, ship as WaveXmd, and apply to every dashboard on the dataset." }
            ]
          },
          {
            id: "security-predicates",
            title: "Security predicates and sharing inheritance",
            summary: "Row-level security patterns: owner, attribute and flattened-hierarchy predicates, sharing inheritance with a backup predicate, and how to test them.",
            minutes: 11,
            tags: ["security", "predicates", "crm-analytics"],
            blocks: [
              { t: "p", html: "A security predicate is <strong>a turnstile on the dataset</strong>. Every query from every dashboard, lens or API call passes through it, and only rows for which the expression is true come out. App sharing decides who may enter the building; the predicate decides which rows they see once inside." },
              { t: "widget", id: "obPredicateTester" },
              { t: "h", text: "Common predicate patterns" },
              { t: "table", headers: ["Pattern", "Predicate", "Needs"], rows: [
                ["Owner only", "<code class='tok'>'OwnerId' == \"$User.Id\"</code>", "OwnerId in the dataset"],
                ["Owner or attribute", "<code class='tok'>'OwnerId' == \"$User.Id\" || 'Region' == \"$User.Region__c\"</code>", "A reliable user field"],
                ["Role hierarchy", "<code class='tok'>'OwnerId' == \"$User.Id\" || 'Roles' == \"$User.UserRoleId\"</code>", "A flatten step that writes each owner's chain of roles into a multi-value field"],
                ["Team membership", "<code class='tok'>'TeamMemberIds' == \"$User.Id\"</code>", "A multi-value field built from team or share records"]
              ] },
              { t: "p", html: "A multi-value field matches when <em>any</em> of its values equals the right-hand side, which is what makes the flattened-hierarchy pattern work: each row lists every role above its owner, so a manager's role id appears on all subordinates' rows." },
              { t: "h", text: "Sharing inheritance" },
              { t: "ul", items: [
                "Mirrors Salesforce record access for supported core objects, such as Account, Opportunity, Case, Contact and Lead.",
                "Users whose access spans too many records for the platform to resolve fall back to a <strong>backup predicate</strong> you define; make it deliberate, for example <code class='tok'>false</code> or a broad but intended rule.",
                "It covers rows, not fields: sensitive fields still need to be excluded or split into separately secured datasets."
              ] },
              { t: "note", variant: "trap", html: "A predicate that references a field the dataset does not contain, or a user field that is blank for some users, can quietly return nothing. Test every persona, including users with no role or region, before go-live." },
              { t: "table", headers: ["Tier", "Row security", "Risk"], rows: [
                ["Naive", "No predicate, app shared with everyone", "Every user can query every row"],
                ["Solid", "Owner-or-attribute predicates on every dataset", "Correct for reps, but managers see too little or rely on manual lists"],
                ["Standout", "Sharing inheritance where supported, flattened-hierarchy predicates elsewhere, a deliberate backup predicate, and persona tests", "Analytics access that matches Salesforce access, verified"]
              ] },
              { t: "cue", html: "Design predicates when you hear <em>\"managers should see their team's pipeline\"</em>, <em>\"partners must not see each other's deals\"</em>, or <em>\"the dashboard is empty for the new hire\"</em>." },
              { t: "note", variant: "key", html: "<strong>Predicates filter every query on a dataset.</strong> Flatten hierarchies into multi-value fields, use sharing inheritance with a deliberate backup predicate where supported, and test as real personas." }
            ]
          },
          {
            id: "bindings",
            title: "Advanced bindings and static steps",
            summary: "Selection and results bindings, binding functions and serializers, static steps for toggles, and safe defaults for empty selections.",
            minutes: 10,
            tags: ["bindings", "dashboards", "saql"],
            blocks: [
              { t: "p", html: "Faceting is <strong>automatic cruise control</strong>: click a bar and related steps on the same dataset follow. Bindings are <strong>manual steering</strong>: you take a value from one step's selection or result and place it exactly where you want in another step's query or a widget property. Use cruise control by default and steer only when you need to." },
              { t: "table", headers: ["Piece", "Role", "Examples"], rows: [
                ["Data source", "Where the value comes from", "<code class='tok'>step.selection</code>, <code class='tok'>step.result</code>"],
                ["Data selection function", "Which part of it", "<code class='tok'>cell(source, row, column)</code>, <code class='tok'>column(source, [columns])</code>, <code class='tok'>row(source, [rows], [columns])</code>"],
                ["Manipulation function", "Optional reshaping", "<code class='tok'>coalesce(...)</code>, <code class='tok'>concat(...)</code>, <code class='tok'>toArray(...)</code>"],
                ["Serializer", "How it is written into the target", "<code class='tok'>.asString()</code>, <code class='tok'>.asObject()</code>, <code class='tok'>.asEquality('field')</code>, <code class='tok'>.asGrouping()</code>"]
              ] },
              { t: "h", text: "A static step toggle" },
              { t: "code", lang: "text", code: [
                "-- static step 'group_toggle' offers two values: Region and Owner",
                "-- the chart step groups by whatever the user selected, with Region as the default",
                "q = load \"opportunities\";",
                "q = group q by {{coalesce(cell(group_toggle.selection, 0, \"value\"), \"Region\").asString()}};",
                "q = foreach q generate {{coalesce(cell(group_toggle.selection, 0, \"value\"), \"Region\").asString()}} as 'Group', sum('Amount') as 'sum_Amount';",
                "q = order q by 'sum_Amount' desc;",
                "q = limit q 10;",
                "",
                "-- exact function and serializer combinations vary by use; check them in the dashboard JSON editor"
              ].join("\n") },
              { t: "ul", items: [
                "Selection bindings react to what the user picks; results bindings react to what another step returned, such as a target value or the top region.",
                "Bindings can also drive widget properties such as titles, colours or reference lines, not only queries.",
                "Write binding strings with plain quotes in the source; over-escaped quotes are a common cause of parse errors.",
                "Use the dashboard's interaction editor to build bindings, then review the generated JSON."
              ] },
              { t: "note", variant: "trap", html: "Do not add an explicit selection binding for a field the step already receives through faceting. The filter applies twice, and cascading selectors collapse to one value." },
              { t: "table", headers: ["Tier", "Interaction design", "Effect"], rows: [
                ["Naive", "Several near-identical dashboards, one per grouping", "Maintenance drift and confused users"],
                ["Solid", "Faceting for filters, a static step plus binding for toggles", "One dashboard that adapts"],
                ["Standout", "Solid plus coalesce defaults, tested empty and multi-select states, and results bindings for dynamic targets", "Interactive dashboards that never break on first load"]
              ] },
              { t: "cue", html: "Reach for bindings when you hear <em>\"let users switch the chart between region and owner\"</em>, <em>\"colour the bar red when below target\"</em>, or <em>\"the title should say which quarter is selected\"</em>." },
              { t: "quiz", id: "crma-govern" },
              { t: "note", variant: "key", html: "<strong>Faceting filters automatically; bindings place a selected or computed value exactly where you need it.</strong> Combine static steps with bindings for toggles, default empty selections with coalesce, and never double-filter." }
            ]
          }
        ]
      }
    ]
  };
})();
