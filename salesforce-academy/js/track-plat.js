/* =====================================================================
   ORBIT · Platform Fundamentals
   window.TRACKS.plat — modules: arch / envs / data
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
  function labelled(text, control) {
    return h("div", { class: "ob-stack" }, h("span", { class: "ob-dim", style: "font-size:0.78rem" }, text), control);
  }
  function para(text) { return h("p", { style: "font-size:0.88rem;line-height:1.55;margin:0.4rem 0 0" }, text); }

  var Widgets = {};

  /* obSandboxPicker — which sandbox type fits a purpose and a data need? */
  var SANDBOX = {
    dev: {
      name: "Developer",
      storage: "200 MB data, 200 MB files",
      refresh: "1 day",
      copies: "Metadata only: configuration and code, no records.",
      trade: "Cheapest and fastest to refresh, but 200 MB fills quickly and there is nothing to test against until you load it."
    },
    devpro: {
      name: "Developer Pro",
      storage: "1 GB data, 1 GB files",
      refresh: "1 day",
      copies: "Metadata only: configuration and code, no records.",
      trade: "More room for seeded test data and package installs, still no production records; data seeding is your job."
    },
    partial: {
      name: "Partial Copy",
      storage: "5 GB data, files match production",
      refresh: "5 days",
      copies: "Metadata plus a sample chosen by a sandbox template: up to about 10,000 records per selected object.",
      trade: "Realistic records without full storage, but the template caps the sample and related records can arrive incomplete."
    },
    full: {
      name: "Full",
      storage: "Matches production data and file storage",
      refresh: "29 days",
      copies: "Metadata plus all data; a template can trim objects, and field history and Chatter are optional.",
      trade: "The only true replica of production, paid for with a 29-day refresh floor, long copy times and full exposure of personal data."
    }
  };
  var SANDBOX_ORDER = ["dev", "devpro", "partial", "full"];
  var PURPOSE_LABEL = { build: "Build", int: "Integration test", uat: "UAT", perf: "Performance", train: "Training" };
  var DATA_LABEL = { meta: "Metadata only", sample: "Sample data", full: "Full copy" };
  var SANDBOX_FIT = {
    "build|meta": "One developer building a feature needs fast, disposable metadata. A Developer sandbox refreshes daily and carries no records, which keeps it clean.",
    "build|sample": "Sample data for feature work fits in Developer Pro's 1 GB. Load it with a seed script so every refresh is reproducible instead of copying production.",
    "build|full": "A full copy for feature work is waste: a 29-day refresh floor, long copy times and real customer data in a developer's hands. Prefer seed scripts in a smaller sandbox.",
    "int|meta": "Integration tests on metadata alone work when each test creates its own records. Developer Pro leaves headroom for that data and for package installs.",
    "int|sample": "Integration tests need realistic shapes: record types, related records, odd picklist values. A Partial Copy template pulls a curated slice of each object.",
    "int|full": "Full data for integration only pays off when interfaces depend on production volume or history; otherwise the 29-day floor slows every feedback loop.",
    "uat|meta": "UAT on an empty org frustrates business testers, who spend the session creating data. Developer Pro only works if a seed load runs before each cycle.",
    "uat|sample": "A Partial Copy gives testers records they recognise with a 5-day refresh, so each UAT cycle can start from fresh data.",
    "uat|full": "A Full copy mirrors production exactly, which suits final sign-off. Mask personal data first and plan cycles around the 29-day refresh floor.",
    "perf|meta": "Performance tests on an empty org measure nothing. Query selectivity, sharing recalculation and batch durations only show at production volume, so this overrides your data choice.",
    "perf|sample": "A 10,000-record sample hides exactly what load testing should find: non-selective queries, data skew and lock contention. Performance needs Full.",
    "perf|full": "Production-scale data and storage are what performance and load tests need. Book test windows early; Full sandboxes are scarce and slow to refresh.",
    "train|meta": "Trainees can practise on configuration alone when the exercises create their own records; Developer Pro holds enough for a class.",
    "train|sample": "Training on recognisable sample records with a 5-day refresh lets you reset the org between cohorts.",
    "train|full": "A Full copy gives trainees real volumes but exposes customer data and ties up a scarce sandbox. Mask personal data before the class and book the refresh 29 days ahead."
  };
  function pickSandbox(purpose, data) {
    if (purpose === "perf" || data === "full") return "full";
    if (data === "sample") return purpose === "build" ? "devpro" : "partial";
    return purpose === "build" ? "dev" : "devpro";
  }

  Widgets.obSandboxPicker = function (mount) {
    shell(mount, "picker", "Sandbox picker",
      "Choose what the environment is for and how much production data it needs. The picker names the sandbox type, its storage and refresh floor, what copies over, and what the choice costs.");
    var purpose = "build", data = "meta";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var type = pickSandbox(purpose, data);
      var spec = SANDBOX[type];
      clear(stage);
      var grid = h("div", { class: "ob-grid" });
      for (var i = 0; i < SANDBOX_ORDER.length; i++) {
        var key = SANDBOX_ORDER[i];
        var s = SANDBOX[key];
        grid.appendChild(h("div", { class: "ob-card" + (key === type ? " is-on" : " is-dim") },
          h("strong", {}, s.name),
          h("div", { class: "ob-dim", style: "font-size:0.78rem" }, "refresh every " + s.refresh + " or more")));
      }
      stage.appendChild(grid);
      stage.appendChild(para("What copies over: " + spec.copies));
      stage.appendChild(para("Fit for " + PURPOSE_LABEL[purpose] + " with " + DATA_LABEL[data].toLowerCase() + ": " + SANDBOX_FIT[purpose + "|" + data]));
      stage.appendChild(para("Trade-off: " + spec.trade));
      clear(readout);
      readout.appendChild(ro("recommend", spec.name));
      readout.appendChild(ro("storage", spec.storage));
      readout.appendChild(ro("min refresh", spec.refresh));
      readout.appendChild(ro("purpose", PURPOSE_LABEL[purpose]));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      labelled("Purpose", segment([["build", "Build"], ["int", "Integration test"], ["uat", "UAT"], ["perf", "Performance"], ["train", "Training"]], 0, function (v) { purpose = v; paint(); })),
      labelled("Data needs", segment([["meta", "Metadata only"], ["sample", "Sample data"], ["full", "Full copy"]], 0, function (v) { data = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* obRelationshipPicker — lookup, master-detail, junction or hierarchical? */
  function relDecide(s) {
    var n = [];
    if (s.scope === "user") {
      n.push("Hierarchical is a special lookup that exists only on User, pointing one user at another, such as a manager or an approver.");
      n.push(s.orphan ? "Blank values are allowed, which suits optional managers." : "To force a value, add a validation rule; the relationship itself does not demand one.");
      n.push(s.control ? "A user-to-user link never passes record access along; user visibility has its own settings." : "Each user keeps independent access, which is the only behaviour on offer here.");
      n.push(s.rollup ? "Roll-up summaries are not available; compute team totals in a report or a Flow." : "No roll-ups needed, so nothing is lost.");
      n.push(s.m2m ? "Many-to-many between users needs a junction object with two User lookups, because User cannot be the master side." : "One related user per record fits a single hierarchical field.");
      return { type: "Hierarchical (User only)", cascade: "No", sharing: "No", rollup: "No", required: "No", notes: n };
    }
    if (s.m2m) {
      n.push("Many-to-many is modelled with a junction object: each junction record links one record from each parent.");
      if (s.orphan && !s.control && !s.rollup) {
        n.push("Links may outlive their parents, so two lookups keep junction rows when a parent goes (the lookup value clears).");
        n.push("Junction rows keep their own owner and sharing, because nothing asked the parents to control them.");
        n.push("No roll-ups required, so two lookups lose nothing.");
        return { type: "Junction object (two lookups)", cascade: "No, fields clear", sharing: "No, own OWD", rollup: "No (Flow or Apex)", required: "No", notes: n };
      }
      n.push(s.orphan ? "You said rows may stand alone, but master-detail junction rows are deleted with either parent. That is the price of roll-ups and inherited access." : "Junction rows cannot exist without both parents, which master-detail enforces.");
      n.push(s.control ? "Access is inherited: a user needs access to both parent records to see a junction row." : "Junction rows still inherit access from both parents; there is no separate owner.");
      n.push(s.rollup ? "Roll-up summaries (COUNT, SUM, MIN, MAX) are available on both parents." : "Roll-ups stay available on both parents if you need them later.");
      return { type: "Junction object (two master-details)", cascade: "Yes, from either parent", sharing: "Yes, from both parents", rollup: "Yes, on both parents", required: "Yes, both fields", notes: n };
    }
    n.push("One parent, many children: a single relationship field on the child.");
    if (s.orphan) {
      n.push("Children can stand alone, so a lookup is the only fit: master-detail would force a parent and delete children with it.");
      n.push(s.control ? "Parent-controlled access is not available on a lookup; share children with sharing rules or Apex managed sharing instead." : "Children keep their own owner and sharing, which is what a lookup gives you.");
      n.push(s.rollup ? "Native roll-up summaries need master-detail; on a lookup, compute totals with a record-triggered Flow or Apex." : "No roll-ups needed.");
      return { type: "Lookup", cascade: "No (clears the field, or restrict delete)", sharing: "No", rollup: "No (Flow or Apex)", required: "Optional", notes: n };
    }
    if (s.control || s.rollup) {
      n.push("Children always need a parent, which master-detail enforces as a required field.");
      n.push(s.control ? "The parent controls access and deletion: detail records have no owner and inherit sharing from the master." : "You did not ask for parent control, but master-detail brings it anyway: details lose their own owner and sharing.");
      n.push(s.rollup ? "Roll-up summaries on the parent (COUNT, SUM, MIN, MAX) come built in." : "Roll-ups are available on the parent if you need them later.");
      return { type: "Master-detail", cascade: "Yes", sharing: "Yes, from the master", rollup: "Yes", required: "Yes", notes: n };
    }
    n.push("Children need a parent but keep their own owner and sharing: a required lookup gives you exactly that.");
    n.push("A required lookup must use the restrict-delete option, so a parent that still has children cannot be deleted.");
    n.push("No roll-ups and no inherited access needed, so master-detail would add constraints you would not use.");
    return { type: "Lookup (required)", cascade: "No, parent delete is blocked", sharing: "No", rollup: "No (Flow or Apex)", required: "Yes", notes: n };
  }

  Widgets.obRelationshipPicker = function (mount) {
    shell(mount, "picker", "Relationship picker",
      "Answer five questions about two objects. The picker names the relationship type and what it does to deletion, sharing, roll-ups and required fields.");
    var s = { scope: "objects", orphan: false, control: true, rollup: true, m2m: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var d = relDecide(s);
      clear(stage);
      stage.appendChild(h("div", { class: "ob-row" },
        h("span", { class: "ob-chip ok" }, d.type),
        h("span", { class: "ob-chip" + (d.cascade.indexOf("Yes") === 0 ? " warn" : "") }, "cascade delete: " + d.cascade)));
      var list = h("ul", { style: "margin:0.5rem 0 0;padding-left:1.1rem;font-size:0.86rem;line-height:1.5" });
      for (var i = 0; i < d.notes.length; i++) list.appendChild(h("li", {}, d.notes[i]));
      stage.appendChild(list);
      clear(readout);
      readout.appendChild(ro("type", d.type));
      readout.appendChild(ro("cascade delete", d.cascade));
      readout.appendChild(ro("sharing inherited", d.sharing));
      readout.appendChild(ro("roll-up", d.rollup));
      readout.appendChild(ro("required on child", d.required));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      labelled("Relating", segment([["objects", "Two different objects"], ["user", "User to User"]], 0, function (v) { s.scope = v; paint(); })),
      labelled("Child without a parent?", segment([["no", "Needs a parent"], ["yes", "Can stand alone"]], 0, function (v) { s.orphan = v === "yes"; paint(); })),
      labelled("Parent controls access and deletion?", segment([["yes", "Yes"], ["no", "No"]], 0, function (v) { s.control = v === "yes"; paint(); })),
      labelled("Roll-up summaries?", segment([["yes", "Needed"], ["no", "Not needed"]], 0, function (v) { s.rollup = v === "yes"; paint(); })),
      labelled("Cardinality", segment([["one", "One-to-many"], ["many", "Many-to-many"]], 0, function (v) { s.m2m = v === "many"; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "plat-arch": {
      title: "How the platform works checkpoint",
      sub: "Multi-tenancy, metadata, orgs, editions and releases.",
      questions: [
        { q: "Why does the platform enforce governor limits on every transaction?",
          options: ["To encourage customers to buy more licences", "Because Apex is interpreted and therefore slow", "Because many orgs share one runtime and database, so each transaction must be bounded to protect the others", "To force all business logic into Flow"],
          answer: 2,
          explain: "Every org runs on shared application servers and a shared database. Without per-transaction ceilings on queries, CPU and memory, one tenant's runaway loop would degrade every neighbour on the same instance. Limits are the price of never patching a server yourself." },
        { q: "You create a custom field on Invoice__c. What actually changes underneath?",
          options: ["A metadata row describes the new field, and its values live in shared storage keyed by your org", "A new physical column is added to a database dedicated to your org", "An admin uploads a schema file overnight", "Nothing until the next major release"],
          answer: 0,
          explain: "Your org is mostly metadata. Creating a field writes a definition the runtime reads at request time; values sit in shared, org-partitioned storage. That is why the change is live immediately with no database migration." },
        { q: "How many major platform releases ship each year?",
          options: ["One", "Two", "Four", "Three: Spring, Summer and Winter"],
          answer: 3,
          explain: "Three major releases a year arrive automatically. Sandboxes on preview instances get each release several weeks early, which is your regression window. Plan the calendar around them rather than discovering them." },
        { q: "An admin adds a validation rule directly in production. What is the main engineering risk?",
          options: ["Apex can no longer query the object", "Drift: the org no longer matches source control, so the next deploy may overwrite the rule or fail against it", "The rule is deleted at the next release", "Storage usage doubles"],
          answer: 1,
          explain: "Metadata changed outside the pipeline creates drift between what is in the repo and what is in the org. The next deploy either silently reverts the change or collides with it. Route even small changes through source control." },
        { q: "What does the apiVersion in an Apex class's meta XML give you?",
          options: ["The class keeps that API version's behaviour even after the org is upgraded", "Faster execution", "An exemption from governor limits", "It prevents deployment to sandboxes"],
          answer: 0,
          explain: "Each component pins the API version it was written against, and the platform keeps that behaviour stable across releases. Upgrading the version is a deliberate change you test, not something a release does to you." }
      ]
    },
    "plat-envs": {
      title: "Orgs and environments checkpoint",
      sub: "Sandbox types, refresh strategy and the path to production.",
      questions: [
        { q: "What is the minimum interval between refreshes of a Full sandbox?",
          options: ["1 day", "5 days", "14 days", "29 days"],
          answer: 3,
          explain: "Full sandboxes can be refreshed at most every 29 days; Partial Copy every 5 days; Developer and Developer Pro daily. The long Full floor is why you book its refreshes against the release calendar." },
        { q: "Your integration team needs a realistic slice of production records and wants to refresh weekly. Which sandbox fits?",
          options: ["Developer", "Partial Copy with a sandbox template", "Full", "A Developer Edition org"],
          answer: 1,
          explain: "A Partial Copy copies metadata plus a template-defined sample of up to roughly 10,000 records per object, and it can refresh every 5 days. Developer sandboxes carry no records, and a Full copy's 29-day floor rules out weekly refreshes." },
        { q: "What should run automatically after every sandbox refresh?",
          options: ["A SandboxPostCopy Apex class that masks personal data and re-points environment configuration", "A full data export to spreadsheets", "A production deploy", "Nothing; a sandbox is ready as copied"],
          answer: 0,
          explain: "A refreshed sandbox is a fresh copy of production, including its data and its integration settings. Implementing SandboxPostCopy lets you scrub data and fix environment-specific config every time, without relying on someone remembering a checklist." },
        { q: "Why validate a production deployment first and then quick deploy it?",
          options: ["Quick deploy skips tests permanently", "Validation is optional ceremony", "Tests run during validation in a window you choose; the quick deploy then promotes the validated components later without rerunning them", "It deploys to two orgs at once"],
          answer: 2,
          explain: "Validation runs the full check-only deploy with tests, ahead of the release window. A quick deploy of that validated job then takes minutes, as long as it happens within the allowed period and nothing changed in between. You move risk out of the release window." },
        { q: "Where should environment-specific endpoints and settings live?",
          options: ["Hardcoded constants in Apex per branch", "A custom label edited during each deploy", "Named credentials and custom metadata configured per environment, so the same artifact deploys everywhere", "A comment at the top of each class"],
          answer: 2,
          explain: "Promoting one artifact through every stage only works if nothing inside it is environment-specific. Named credentials hold endpoints and auth per org, and custom metadata holds tunable config, so code never changes between sandbox and production." }
      ]
    },
    "plat-data": {
      title: "Data model checkpoint",
      sub: "Objects, fields, relationships and governor limits.",
      questions: [
        { q: "Children must be deleted with their parent, and the parent needs a SUM of a child amount. Which relationship?",
          options: ["Lookup plus a Flow", "Master-detail", "Hierarchical", "External lookup"],
          answer: 1,
          explain: "Master-detail gives cascade delete and native roll-up summary fields on the master. A lookup can approximate the roll-up with Flow or Apex, but you would be building what master-detail provides for free." },
        { q: "Students take many courses and courses have many students; you need counts on both sides. What is the model?",
          options: ["A multi-select picklist on Student", "Two lookups on Course", "A text field listing course names", "A junction object with two master-detail relationships"],
          answer: 3,
          explain: "A junction object holds one row per student-course pairing. Making both relationships master-detail enables roll-up summaries on Student and Course and lets the junction inherit access from both parents." },
        { q: "How many SOQL queries can a synchronous Apex transaction issue?",
          options: ["50", "150", "100", "200"],
          answer: 2,
          explain: "The synchronous limit is 100 SOQL queries; asynchronous Apex gets 200. The 150 figure is the DML statement limit, a common mix-up." },
        { q: "A trigger receives 200 records and runs one SOQL query per record inside a loop. What happens?",
          options: ["The 101st query throws a LimitException and the whole transaction rolls back", "It slows down but completes", "The platform batches the queries automatically", "It succeeds because triggers get asynchronous limits"],
          answer: 0,
          explain: "Triggers run synchronously and receive up to 200 records per chunk. One query per record means 200 queries against a ceiling of 100, so the 101st fails and every change in the transaction is undone." },
        { q: "Why can you not catch System.LimitException and carry on?",
          options: ["You can, with catch (Exception e)", "It is only thrown in tests", "Limits reset when the exception is caught", "It cannot be caught: the transaction is terminated and rolled back, so the only fix is designing within limits"],
          answer: 3,
          explain: "Limit exceptions bypass catch blocks entirely and end the transaction. Measuring with the Limits class and bulkifying up front is the only defence; there is no recovery path at runtime." }
      ]
    }
  });

  /* obValidationTester — evaluate one validation rule against a record change */
  var PlatMore = {};
  PlatMore.obValidationTester = function (mount) {
    shell(mount, "rule", "Validation rule tester",
      "The rule blocks closing an Opportunity as won without a signed contract date, unless the user holds a bypass custom permission. Change the record and the context to see how the formula evaluates.");
    var st = { prior: "Negotiation", stage: "Closed Won", date: "blank", bypass: "no", channel: "ui" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var changed = st.prior !== st.stage;
      var won = st.stage === "Closed Won";
      var blank = st.date === "blank";
      var bypass = st.bypass === "yes";
      var parts = [
        ["ISCHANGED(StageName)", changed],
        ["ISPICKVAL(StageName, \"Closed Won\")", won],
        ["ISBLANK(Contract_Signed_Date__c)", blank],
        ["NOT($Permission.Bypass_Opportunity_Rules)", !bypass]
      ];
      var fires = changed && won && blank && !bypass;
      clear(stage);
      var list = h("ol", { class: "ob-steps" });
      for (var i = 0; i < parts.length; i++) {
        list.appendChild(h("li", { class: "ob-step " + (parts[i][1] ? "is-done" : "is-skip") },
          h("span", { class: "ob-num" }, String(i + 1)),
          h("span", {}, h("span", { class: "ob-mono" }, parts[i][0]), " evaluates to ", h("b", {}, parts[i][1] ? "TRUE" : "FALSE"))));
      }
      stage.appendChild(list);
      var verdict = fires
        ? "AND(...) is TRUE, so the save is blocked with: \"Add the contract signed date before closing as won.\""
        : "AND(...) is FALSE, so the rule passes and the save continues.";
      stage.appendChild(h("div", { class: "ob-card " + (fires ? "is-bad" : "is-ok") }, h("h4", {}, fires ? "Save blocked" : "Save allowed"), verdict));
      clear(readout);
      readout.appendChild(ro("rule result", fires ? "error shown" : "passes"));
      readout.appendChild(ro("channel", st.channel === "ui" ? "record page" : (st.channel === "api" ? "Data Loader / API" : "Apex DML")));
      readout.appendChild(ro("applies here", "yes, validation rules run for every channel"));
      readout.appendChild(ro("bypass", bypass ? "custom permission held" : "none"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("div", { class: "w-field" }, h("label", {}, "Prior stage"),
        segment([["Negotiation", "Negotiation"], ["Closed Won", "Closed Won"]], 0, function (v) { st.prior = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "New stage"),
        segment([["Closed Won", "Closed Won"], ["Closed Lost", "Closed Lost"], ["Negotiation", "Negotiation"]], 0, function (v) { st.stage = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Contract signed date"),
        segment([["blank", "Blank"], ["set", "Filled in"]], 0, function (v) { st.date = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Bypass permission"),
        segment([["no", "Not held"], ["yes", "Held"]], 0, function (v) { st.bypass = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Save channel"),
        segment([["ui", "Record page"], ["api", "Data Loader"], ["apex", "Apex DML"]], 0, function (v) { st.channel = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };
  window.Widgets = Object.assign(window.Widgets || {}, PlatMore);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "plat-model": {
      title: "Data model design checkpoint",
      sub: "Junctions, polymorphic lookups, big and external objects, validation rules and formulas.",
      questions: [
        { q: "Students can enrol in many Courses and each Course has many Students. Enrolment records should disappear when either parent is deleted. What do you build?",
          options: ["A lookup from Student to Course", "A multi-select picklist of course names on Student", "An Enrolment junction object with two master-detail relationships", "A hierarchical relationship"], answer: 2,
          explain: "Many-to-many needs a junction object. Two master-detail fields give cascade delete from either parent, roll-up summaries on both, and access that depends on the parents. A lookup only models one-to-many, and a multi-select picklist cannot be reported or related properly." },
        { q: "You need to keep ten years of device telemetry, billions of rows, queried only by device and timestamp. Which storage fits best?",
          options: ["A custom big object with an index on device and timestamp", "A standard custom object with a formula field", "An external object that copies rows into Salesforce nightly", "Custom settings"], answer: 0,
          explain: "Big objects are built for billions of rows that are written once and read by their index. Queries must filter on the index fields in order, and there are no triggers, flows or record sharing. A custom object at that volume would exhaust storage and suffer skew. External objects never copy rows in." },
        { q: "What is true of an external object backed by Salesforce Connect?",
          options: ["Its rows are copied into Salesforce storage on a schedule", "It supports Apex triggers like any custom object", "It can only connect to other Salesforce orgs", "Its rows stay in the external system and are fetched when a user or query asks for them"], answer: 3,
          explain: "External objects (suffix __x) are views over remote data reached through OData, a cross-org adapter or a custom Apex adapter. Nothing is stored locally, so every view is a callout with its latency, and automation support is limited. Choose it when data must stay at the source." },
        { q: "A validation rule must stop reps but not the nightly integration user. What is the house-standard way to exempt the integration?",
          options: ["Check $Profile.Name = \"Integration\" in the formula", "Add NOT($Permission.Bypass_Opportunity_Rules) and grant that custom permission through a permission set", "Deactivate the rule before each load", "Hardcode the integration user's Id in the formula"], answer: 1,
          explain: "Custom permissions gate behaviour without hardcoding names or Ids, and they travel with permission sets across environments. Profile names change and break silently, Ids differ per org, and toggling rules during loads leaves gaps in data quality." },
        { q: "Why might a formula field that references fields on several parent objects be a poor filter for a large report or SOQL query?",
          options: ["Formula fields are calculated when read, so filtering on them cannot use a normal index unless the formula is deterministic and indexed", "Formula fields cannot reference parent objects", "Formula fields are stored as text only", "SOQL cannot select formula fields"], answer: 0,
          explain: "Formula values are computed at read time. Filtering forces evaluation across many rows, and cross-object formulas are not deterministic, so they cannot be indexed. If you filter on the value often, store it in a real field maintained by a before-save flow or trigger." }
      ]
    },
    "plat-ux": {
      title: "Record pages and Experience Cloud checkpoint",
      sub: "Record types, layouts, Dynamic Forms, App Builder, email templates and Experience Cloud.",
      questions: [
        { q: "Two teams need different Stage values on Opportunity and different sales processes. Which feature is the right tool?",
          options: ["Dynamic Forms visibility rules", "Two page layouts on one record type", "Record types, each tied to its own sales process and picklist values", "Two separate custom objects"], answer: 2,
          explain: "Record types control which picklist values and business process (stages, statuses) a record uses, and drive layout assignment by profile. Dynamic Forms and layouts change what is displayed, not which values are valid. Splitting the object would duplicate automation and reporting." },
        { q: "A field is marked required on the page layout. An integration then inserts records without it. What happens?",
          options: ["The insert fails with a required field error", "The insert succeeds, because layout-level required applies only in the UI", "The field is filled with a default value automatically", "The record is created but hidden"], answer: 1,
          explain: "Layout and Dynamic Forms required settings are UI rules. To require a value from every channel, make the field universally required or add a validation rule. This is a common source of incomplete data from APIs and loaders." },
        { q: "How does a custom LWC become available to drag onto a record page in Lightning App Builder?",
          options: ["Declare lightning__RecordPage in the targets of its js-meta.xml and set isExposed to true", "Add it to a Visualforce page", "Install it as a managed package only", "Reference it in a page layout"], answer: 0,
          explain: "The component's metadata file controls exposure and targets. targetConfigs can add design-time properties and restrict the component to certain objects. Page layouts do not host LWCs, and no packaging is required." },
        { q: "A partner portal must show each partner only their own Accounts and Opportunities, while internal users keep Public Read Only. What controls this?",
          options: ["The internal OWD alone", "Guest user sharing rules", "Hardcoding account Ids in the site", "A Private external OWD plus partner roles or sharing sets"], answer: 3,
          explain: "External org-wide defaults can be stricter than internal ones, so partners start with no access. Partner users get access through their account's partner roles, sharing rules or sharing sets. Guest sharing is for unauthenticated visitors and grants read only." },
        { q: "Apex sends an email from a stored template to a Contact about a Case. Which calls render merge fields for both records?",
          options: ["setHtmlBody with a hardcoded string", "setTemplateId with setTargetObjectId for the Contact and setWhatId for the Case", "setToAddresses with the Contact's email only", "System.debug of the template body"], answer: 1,
          explain: "The target object is the recipient record and the what Id is the related record, so merge fields from both resolve. Hardcoding bodies or addresses breaks the house rule against hardcoded emails and loses translations and branding." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.plat = {
    id: "plat",
    name: "Platform Fundamentals",
    short: "PLAT",
    tagline: "Know the building before you move in",
    color: "#2dd4bf",
    blurb: "How the shared, metadata-driven platform actually runs your org, and what that means for every design decision. Covers multi-tenancy and governor limits, metadata, editions and the release cycle, sandbox types and environment strategy, and the data model: objects, field types and the four relationship kinds.",
    modules: [
      {
        id: "arch",
        name: "How the Platform Works",
        icon: "cube",
        lessons: [
          {
            id: "multitenancy",
            title: "Multi-tenant architecture and why limits exist",
            summary: "Many orgs share one runtime and one database; governor limits are how they stay good neighbours.",
            minutes: 9,
            tags: ["multitenancy", "governor-limits", "architecture"],
            blocks: [
              { t: "p", html: "Picture a single, very large application that thousands of companies log into at once. Each company sees only its own data and its own customisations, but underneath they share the same application servers, the same database and the same upgrade schedule. That shared building is the platform; your <strong>org</strong> is one tenant inside it." },
              { t: "diagram", id: "multitenant-stack", caption: "Three orgs, one runtime, one database. Each org contributes metadata and rows tagged with its org id; the runtime meters every transaction." },
              { t: "h", text: "What is shared and what is yours" },
              { t: "table", headers: ["Layer", "Shared across orgs", "Yours alone"], rows: [
                ["Application servers", "The Apex, Flow, Lightning and API runtimes", "Nothing: you never see a server"],
                ["Database", "Tables, indexes and the query optimiser", "Rows tagged with your org id"],
                ["Schema", "Generic storage structures", "Metadata describing your objects and fields"],
                ["Code", "The compiler and execution engine", "Your Apex, stored and versioned as metadata"],
                ["Upgrades", "Three releases a year, applied to everyone", "Your timing for regression testing"]
              ] },
              { t: "p", html: "Mechanically, every row carries the id of the org that owns it, and every query the runtime builds is scoped to that id. Custom objects and fields are not new physical tables and columns; they are <strong>definitions</strong> the runtime reads to map your schema onto shared storage. Your Apex is compiled and cached by the platform, and the optimiser keeps statistics per org so a selective filter in your org stays selective." },
              { t: "h", text: "Why governor limits exist" },
              { t: "stat", items: [
                { v: "100", k: "SOQL queries per sync transaction" },
                { v: "150", k: "DML statements per transaction" },
                { v: "10 s", k: "CPU per sync transaction" },
                { v: "6 MB", k: "heap per sync transaction" }
              ] },
              { t: "p", html: "If one tenant's trigger could run unbounded queries, every other org on the instance would feel it. Governor limits put a ceiling on each <em>transaction</em>: queries, rows, DML, CPU, heap and callouts. Hit one and the platform stops the transaction and rolls it back rather than let it degrade its neighbours." },
              { t: "compare",
                bad: { title: "Dedicated-server thinking", items: ["Scale by adding hardware", "Tune the database when a query is slow", "Long-running jobs are fine if the box can take it", "Upgrade when convenient"] },
                good: { title: "Multi-tenant thinking", items: ["Scale by doing less per transaction: bulkify, filter selectively", "Design selective queries; ask for custom indexes rarely", "Split heavy work into asynchronous chunks", "Test against every release preview"] } },
              { t: "note", variant: "warn", html: "The trade-off is control for operations. You never patch, back up or scale a server, but you also cannot tune one. When something is slow, the fix is almost always in your design: fewer queries, more selective filters, less work per transaction." },
              { t: "table", headers: ["Tier", "How you explain limits", "Why it lands"], rows: [
                ["Naive", "Limits are an annoying restriction to work around", "Signals you will fight the platform"],
                ["Solid", "Limits protect a shared runtime, so code must be bulk-safe", "Correct and practical"],
                ["Standout", "Limits are the contract of shared tenancy: they make capacity predictable for every org, and they push you toward set-based design that is faster anyway", "Shows you design with the constraint, not around it"]
              ] },
              { t: "p", html: "In an interview, connect the two halves: shared infrastructure is why you never run servers, and the same sharing is why every transaction is metered. Saying both in one sentence shows you understand the model rather than the rule." },
              { t: "cue", html: "<strong>Reach for this model when you hear:</strong> why does Salesforce have governor limits, why can't we just add an index, why is my trigger failing at scale, how is our data kept separate from other customers." },
              { t: "note", variant: "key", html: "<strong>One runtime, one database, many orgs.</strong> Your org is metadata plus org-tagged rows, and governor limits are what keep a shared runtime fair. Design for the meter, not around it." }
            ]
          },
          {
            id: "metadata-driven",
            title: "The metadata-driven platform",
            summary: "Everything you build is metadata the runtime interprets, which is why changes go live instantly and drift is the real enemy.",
            minutes: 8,
            tags: ["metadata", "source-control", "drift"],
            blocks: [
              { t: "p", html: "An org is two things: <strong>metadata</strong>, which describes what exists and how it behaves, and <strong>data</strong>, the records themselves. Objects, fields, layouts, flows, permission sets and Apex classes are all metadata. The runtime reads it on every request and behaves accordingly, which is why nothing you build needs a server restart." },
              { t: "table", headers: ["What you build", "Stored as", "Interpreted by"], rows: [
                ["Custom object and fields", "Object and field definitions", "Data layer, UI, APIs, reports"],
                ["Page layout or Lightning page", "Layout and FlexiPage metadata", "Lightning runtime"],
                ["Record-triggered flow", "Flow definition (versioned)", "Flow engine during save"],
                ["Apex class or trigger", "Source plus compiled form", "Apex runtime"],
                ["Permission set", "Object, field and system permissions", "Every access check"]
              ] },
              { t: "h", text: "Metadata is text you can version" },
              { t: "code", lang: "text", code:
                "<!-- force-app/main/default/objects/Invoice__c/fields/Revenue_Band__c.field-meta.xml (xmlns omitted) -->\n" +
                "<CustomField>\n" +
                "    <fullName>Revenue_Band__c</fullName>\n" +
                "    <label>Revenue Band</label>\n" +
                "    <type>Picklist</type>\n" +
                "    <required>false</required>\n" +
                "    <valueSet>\n" +
                "        <restricted>true</restricted>\n" +
                "        <valueSetName>Revenue_Bands</valueSetName>\n" +
                "    </valueSet>\n" +
                "</CustomField>"
              },
              { t: "p", html: "The same definitions are reachable through the Metadata API and the Tooling API, and Salesforce DX stores them as small source-format files like the one above. That turns a click-built org into something you can diff, review and deploy." },
              { t: "code", lang: "bash", code:
                "# pull what an admin built in a sandbox into source\n" +
                "sf project retrieve start --metadata \"CustomObject:Invoice__c\" --target-org dev-sandbox\n" +
                "\n" +
                "# push source to another org\n" +
                "sf project deploy start --source-dir force-app --target-org integration"
              },
              { t: "h", text: "What follows from metadata" },
              { t: "ul", items: [
                "<strong>Changes are live immediately.</strong> Save a field in production and every user sees it on the next page load.",
                "<strong>Dependencies are enforced.</strong> You cannot delete a field a formula, flow or class references; the platform tracks the graph.",
                "<strong>Behaviour is versioned per component.</strong> Each class and flow pins an API version, so releases do not change what you already shipped.",
                "<strong>Clicks and code are the same thing underneath.</strong> A field added in Setup is as much a deployable artifact as an Apex class."
              ] },
              { t: "note", variant: "trap", html: "Because Setup edits are instant, production drifts from source control one small change at a time. The next pipeline deploy then either reverts the change silently or fails on it. Treat production Setup as read-only for anything that also lives in the repo." },
              { t: "table", headers: ["Tier", "Source of truth", "Cost"], rows: [
                ["Naive", "Production org; changes made where they are needed", "No history, no review, constant drift"],
                ["Solid", "Repo in source format; changes deployed through sandboxes", "Admins need a path to commit click-built work"],
                ["Standout", "Repo plus a scheduled drift check that retrieves production and diffs it against main", "Small pipeline effort; drift is caught in days, not at release"]
              ] },
              { t: "p", html: "In an interview, say that the platform is an interpreter for metadata, so the engineering discipline is the same as for any configuration-as-code system: one source of truth, reviewed changes, and promotion of the same artifact through every environment." },
              { t: "note", variant: "key", html: "<strong>Your org is metadata plus data.</strong> Metadata is versionable text that the runtime interprets live, so the repo, not production, must be the source of truth." }
            ]
          },
          {
            id: "orgs-editions",
            title: "Orgs, editions and the release cycle",
            summary: "Which kinds of org exist, what editions change, and how to live with three automatic upgrades a year.",
            minutes: 8,
            tags: ["orgs", "editions", "releases"],
            blocks: [
              { t: "p", html: "Every environment you touch is an <strong>org</strong>: a tenant with its own metadata, data, users and limits. The kinds of org differ in lifespan and purpose; the <strong>edition</strong> sets which features and allocations an org has; and the <strong>release cycle</strong> upgrades all of them on the platform's schedule, not yours." },
              { t: "table", headers: ["Org kind", "What it is", "Typical use"], rows: [
                ["Production", "The licensed org your business runs in", "Real users and data; changes arrive by deployment"],
                ["Sandbox", "A copy of production's metadata, optionally with data", "Build, test, UAT, training"],
                ["Scratch org", "Short-lived org created from a definition file", "Source-driven feature work and CI; expires after days"],
                ["Developer Edition", "Free standalone org with small limits", "Learning, prototypes, package development"],
                ["Trial", "Time-limited evaluation org", "Proofs of concept before purchase"]
              ] },
              { t: "h", text: "Editions" },
              { t: "table", headers: ["Edition", "What stands out", "Watch for"], rows: [
                ["Professional", "Core CRM for smaller teams", "API and Apex access are limited and may depend on add-ons"],
                ["Enterprise", "Full customisation, Apex, APIs, sandboxes", "The common baseline for enterprise builds"],
                ["Unlimited", "Higher allocations and more included sandboxes and support", "Allocation differences matter for large data volumes"],
                ["Developer", "Most features with tiny storage", "Never a proxy for production performance"]
              ] },
              { t: "h", text: "The release cycle" },
              { t: "ol", items: [
                "Release notes publish ahead of each <strong>Spring, Summer and Winter</strong> release.",
                "Sandboxes on <em>preview</em> instances upgrade several weeks before production; this is your regression window.",
                "Run your full test suite and key user journeys on a preview sandbox; log anything that changed.",
                "Production upgrades on its instance's scheduled maintenance window.",
                "<strong>Release updates</strong> (behaviour changes with an enforcement date) can be tested and activated early from Setup."
              ] },
              { t: "stat", items: [
                { v: "3", k: "major releases per year" },
                { v: "weeks", k: "of preview before production" },
                { v: "per class", k: "API version pinning" }
              ] },
              { t: "code", lang: "text", code:
                "<!-- InvoiceService.cls-meta.xml (xmlns omitted) -->\n" +
                "<ApexClass>\n" +
                "    <apiVersion>62.0</apiVersion>\n" +
                "    <status>Active</status>\n" +
                "</ApexClass>"
              },
              { t: "note", variant: "tip", html: "During each preview window, decide which sandboxes should be on the preview release and refresh accordingly. A sandbox refreshed at the wrong moment can land on the non-preview version and miss the regression window." },
              { t: "compare",
                bad: { title: "Reactive release handling", items: ["Read about changes after production upgrades", "Enforced release updates surprise you", "API versions drift across hundreds of classes"] },
                good: { title: "Release calendar as a habit", items: ["Preview sandbox regression run every release", "Release updates tested and activated on your schedule", "API versions bumped deliberately in batches with tests"] } },
              { t: "p", html: "In an interview, the strong answer to <em>how do you handle releases</em> names the preview sandbox, the automated regression suite run against it, and the release-update backlog you work through before enforcement dates." },
              { t: "quiz", id: "plat-arch" },
              { t: "note", variant: "key", html: "<strong>Orgs differ by purpose, editions by allocation, and every org upgrades three times a year.</strong> Own the preview window and pin API versions so releases are scheduled events, not surprises." }
            ]
          }
        ]
      },
      {
        id: "envs",
        name: "Orgs & Environments",
        icon: "map",
        lessons: [
          {
            id: "sandboxes",
            title: "Sandbox types and refresh strategy",
            summary: "Four sandbox types trade data fidelity against refresh speed; a refresh plan keeps them useful and safe.",
            minutes: 10,
            tags: ["sandboxes", "refresh", "environments"],
            blocks: [
              { t: "p", html: "A sandbox is a copy of production's metadata, and optionally some or all of its data, in a separate org. The four types are a ladder: each step up copies more data and storage, and each step up refreshes less often. Pick the lowest rung that answers the question the environment exists to answer." },
              { t: "table", headers: ["Type", "Copies", "Storage", "Min refresh"], rows: [
                ["Developer", "Metadata only", "200 MB data, 200 MB files", "1 day"],
                ["Developer Pro", "Metadata only", "1 GB data, 1 GB files", "1 day"],
                ["Partial Copy", "Metadata plus a template sample, up to about 10,000 records per object", "5 GB data, files match production", "5 days"],
                ["Full", "Metadata plus all data (template can trim)", "Matches production", "29 days"]
              ] },
              { t: "widget", id: "obSandboxPicker" },
              { t: "h", text: "Refresh strategy" },
              { t: "ul", items: [
                "A refresh <strong>replaces</strong> the sandbox: anything built only there is gone, so commit work to source before refreshing.",
                "New and refreshed sandboxes default email deliverability to system email only, and user email addresses get an <code class='tok'>.invalid</code> suffix so customers are not emailed by accident.",
                "Integration endpoints copy from production; named credentials must be re-pointed or the sandbox calls production systems.",
                "Partial and Full copies contain real personal data; mask it before anyone outside the production access list logs in.",
                "Book Full refreshes against the release calendar, because the 29-day floor means a mistimed refresh blocks you for a month."
              ] },
              { t: "code", lang: "java", code:
                "/**\n" +
                " * @description Runs once after each sandbox refresh as the automated process user.\n" +
                " *              without sharing: masking must reach every record regardless of owner.\n" +
                " */\n" +
                "public without sharing class SandboxRefreshSetup implements SandboxPostCopy {\n" +
                "    /**\n" +
                "     * @description Queues masking and environment re-pointing jobs.\n" +
                "     * @param context sandbox name and ids supplied by the platform\n" +
                "     */\n" +
                "    public void runApexClass(SandboxContext context) {\n" +
                "        System.enqueueJob(new MaskContactDataJob(context.sandboxName()));\n" +
                "    }\n" +
                "}"
              },
              { t: "p", html: "The post-copy class is selected when you create or refresh the sandbox. Keep it short and hand heavy work to a queueable, because masking a large Full copy will not fit in one synchronous transaction." },
              { t: "table", headers: ["Tier", "Refresh approach", "Consequence"], rows: [
                ["Naive", "Refresh when someone asks; fix settings by hand afterwards", "Unmasked data, sandboxes calling production endpoints, lost work"],
                ["Solid", "Refresh calendar per sandbox, post-copy class for masking and config", "Predictable environments; seed data still drifts"],
                ["Standout", "Calendar tied to releases, post-copy automation, scripted seed data and a smoke test that proves the sandbox is ready", "A refreshed sandbox is usable within the hour and safe by default"]
              ] },
              { t: "note", variant: "warn", html: "A Full copy is production data in a less controlled place. Treat masking as part of the refresh, not a follow-up task, and restrict who can log in until it has run." },
              { t: "cue", html: "<strong>Reach for sandbox strategy when you hear:</strong> testers have no data, UAT keeps breaking after refresh, a sandbox emailed customers, performance looked fine in test but not in production, we only have one Full sandbox." },
              { t: "note", variant: "key", html: "<strong>More data means slower refresh.</strong> Developer and Developer Pro refresh daily with no records, Partial Copy every 5 days with a sample, Full every 29 days with everything. Automate masking and config on every refresh." }
            ]
          },
          {
            id: "env-strategy",
            title: "Environment strategy from dev to production",
            summary: "Each environment answers one question; changes move upward as one artifact, never sideways by hand.",
            minutes: 9,
            tags: ["environments", "release", "pipeline"],
            blocks: [
              { t: "p", html: "Think of environments as a series of gates, each answering one question. Does it compile and pass its tests? Does it work with everyone else's changes? Do users accept it? Does it survive production volume? An environment that does not answer a distinct question is cost without value." },
              { t: "table", headers: ["Stage", "Org type", "Question it answers", "Who changes it"], rows: [
                ["Develop", "Scratch org or Developer sandbox", "Does my change work in isolation?", "One developer"],
                ["Integrate", "Developer Pro sandbox", "Does it work with everyone else's changes?", "Pipeline only"],
                ["UAT", "Partial Copy", "Do business users accept it?", "Pipeline only; testers change data"],
                ["Staging", "Full", "Does it hold at production volume and config?", "Pipeline only"],
                ["Production", "Production", "Live", "Pipeline only"]
              ] },
              { t: "code", lang: "text", code:
                "feature branch --> scratch org / dev sandbox   (developer)\n" +
                "      | pull request: Code Analyzer + Apex tests\n" +
                "      v\n" +
                "main ----------> integration (Dev Pro)          (auto deploy)\n" +
                "      v\n" +
                "release branch -> UAT (Partial Copy) -> staging (Full) -> production\n" +
                "                                           validate here, quick deploy in window\n" +
                "hotfix branch --> staging -> production, then merge back to main"
              },
              { t: "ul", items: [
                "<strong>Source control is the source of truth.</strong> Every environment above Develop receives changes only from the pipeline.",
                "<strong>Promote one artifact.</strong> The same commit moves upward; nothing is rebuilt or re-edited per environment.",
                "<strong>Config is per environment, code is not.</strong> Endpoints in named credentials, tunables in custom metadata, nothing hardcoded.",
                "<strong>Seed data is scripted.</strong> Integration and UAT get reproducible data loads, not whatever happened to be copied."
              ] },
              { t: "code", lang: "bash", code:
                "# days before the window: check-only deploy with the tests that cover the change\n" +
                "sf project deploy validate --source-dir force-app \\\n" +
                "  --test-level RunSpecifiedTests --tests InvoiceServiceTest --tests InvoiceSelectorTest \\\n" +
                "  --target-org production\n" +
                "\n" +
                "# in the release window: promote exactly what was validated\n" +
                "sf project deploy quick --job-id <validated-job-id> --target-org production"
              },
              { t: "note", variant: "tip", html: "Hotfixes are where strategies break. Give them a lane that still goes through staging and source control, and merge them back to main the same day so the next release does not quietly undo the fix." },
              { t: "table", headers: ["Tier", "Strategy", "Trade-off"], rows: [
                ["Naive", "Developers build in one shared sandbox and use change sets to production", "Overwrites between developers, no history, no repeatable deploy"],
                ["Solid", "Per-developer orgs, a source-driven pipeline through integration and UAT", "Needs CLI skills and a CI runner"],
                ["Standout", "Solid plus a Full staging gate with validate then quick deploy, scripted seed data and a drift check on production", "More orgs to look after; releases become uneventful"]
              ] },
              { t: "compare",
                bad: { title: "Too few environments", items: ["UAT and integration share an org, so testers see half-finished work", "No volume test before production"] },
                good: { title: "Right-sized environments", items: ["One question per environment", "Retire any sandbox that answers no distinct question, because each one needs refreshes and masking"] } },
              { t: "cue", html: "<strong>Reach for environment strategy when you hear:</strong> our deploys are scary, the fix worked in UAT but not production, someone overwrote my change, we keep rebuilding packages per org, the hotfix was lost in the next release." },
              { t: "quiz", id: "plat-envs" },
              { t: "note", variant: "key", html: "<strong>One question per environment, one artifact through all of them.</strong> Code is identical everywhere; config lives in named credentials and custom metadata; production receives only validated, quick-deployed changes." }
            ]
          }
        ]
      },
      {
        id: "data",
        name: "Data Model",
        icon: "database",
        lessons: [
          {
            id: "objects-fields",
            title: "Standard and custom objects, fields and types",
            summary: "Objects are tables with behaviour attached; the field type you pick decides what you can query, report and change later.",
            minutes: 9,
            tags: ["objects", "fields", "data-model"],
            blocks: [
              { t: "p", html: "An object is a table, a field is a column and a record is a row, but each carries behaviour the platform attaches for you: a UI, an API, reports, sharing, history and automation hooks. <strong>Standard objects</strong> ship with the platform; <strong>custom objects</strong> are yours and carry the <code class='tok'>__c</code> suffix." },
              { t: "table", headers: ["Aspect", "Standard object", "Custom object"], rows: [
                ["Examples", "Account, Contact, Opportunity, Case", "Invoice__c, Project__c"],
                ["Built-in behaviour", "Special features such as lead conversion or case escalation", "Generic behaviour only, plus whatever you build"],
                ["Can delete", "No", "Yes (with a recovery period)"],
                ["Sharing options", "Some fixed by the platform", "Full control of the org-wide default and hierarchy access"],
                ["API name", "Fixed, such as <code class='tok'>Account</code>", "Your choice plus <code class='tok'>__c</code>"]
              ] },
              { t: "h", text: "Field types that change your options" },
              { t: "table", headers: ["Type", "Use for", "Watch out"], rows: [
                ["Text / Long Text Area", "Names, codes / free-form notes", "Long text cannot be used in a SOQL WHERE filter"],
                ["Picklist", "Controlled values, ideally from a global value set", "Restrict it, or bad values creep in through the API"],
                ["Multi-select picklist", "Rare tag-like values", "Awkward to filter and report; usually a child object is better"],
                ["Number / Currency / Percent", "Quantities and money", "Precision and scale are hard to change once data exists"],
                ["Formula", "Derived values computed at read time", "Not stored, so heavy formulas slow queries and are rarely indexable"],
                ["Roll-up summary", "COUNT, SUM, MIN, MAX of children", "Master-detail only"],
                ["External ID", "Keys from other systems", "Indexed and usable for upsert; mark it unique"]
              ] },
              { t: "code", lang: "java", code:
                "// Idempotent load from an external system: match on the external key, never on a stored record Id\n" +
                "List<Database.UpsertResult> results = Database.upsert(\n" +
                "    invoices,\n" +
                "    Invoice__c.External_Ref__c,\n" +
                "    false,\n" +
                "    AccessLevel.USER_MODE\n" +
                ");"
              },
              { t: "note", variant: "trap", html: "Changing the type of a field that already holds data can truncate or discard values, and some conversions are blocked outright. Settle types before go-live, and model anything that might become a list as a child object, not a multi-select picklist." },
              { t: "table", headers: ["Tier", "Modelling an invoice status", "Why"], rows: [
                ["Naive", "Free text field", "Every spelling becomes a status; reports break"],
                ["Solid", "Restricted picklist", "Clean values, works in filters, Flow and validation rules"],
                ["Standout", "Restricted picklist from a global value set, plus a status-history child or field history tracking", "Values reused across objects, and you can answer when and who changed it"]
              ] },
              { t: "p", html: "Objects have ceilings too. Custom fields per object run to the hundreds (for example 500 on Enterprise Edition), and every field adds weight to layouts, queries and integrations. Fewer, well-typed fields beat many vague ones." },
              { t: "note", variant: "tip", html: "Fill in the description and help text on every field. Metadata is the documentation that ships with the org, and the next admin will read it long after the design doc has gone stale." },
              { t: "cue", html: "<strong>Reach for field-type reasoning when you hear:</strong> we need to filter on this note field, reports on the multi-select are wrong, the integration creates duplicates, we want to change this text field to a number." },
              { t: "note", variant: "key", html: "<strong>The field type is a long-term decision.</strong> It sets what you can filter, report, index and upsert on. Restrict picklists, use external ids for integrations, and model lists as child objects." }
            ]
          },
          {
            id: "relationships",
            title: "Lookup, master-detail, junction and hierarchy",
            summary: "Four relationship kinds decide cascade delete, inherited sharing, roll-ups and whether the child needs a parent.",
            minutes: 11,
            tags: ["relationships", "master-detail", "junction"],
            blocks: [
              { t: "p", html: "A relationship field does more than link two records. Its kind decides four things at once: whether the child can exist alone, whether deleting the parent deletes the child, whether the child inherits the parent's sharing, and whether the parent can roll up values from its children. Choose the kind by those four answers, not by habit." },
              { t: "table", headers: ["Kind", "Required on child", "Cascade delete", "Sharing inherited", "Roll-ups"], rows: [
                ["Lookup", "Optional (can be made required)", "No by default: clears the field or blocks the delete", "No", "No (Flow or Apex)"],
                ["Master-detail", "Always", "Yes", "Yes; the detail has no owner", "Yes: COUNT, SUM, MIN, MAX"],
                ["Junction (two master-details)", "Both", "Yes, from either parent", "Needs access to both parents", "Yes, on both parents"],
                ["Hierarchical", "No", "No", "No", "No; User object only"]
              ] },
              { t: "widget", id: "obRelationshipPicker" },
              { t: "h", text: "Master-detail mechanics" },
              { t: "ul", items: [
                "An object can have at most <strong>two</strong> master-detail relationships, and master-detail chains can go a few levels deep.",
                "The detail has no owner field; its org-wide default is <em>Controlled by Parent</em>.",
                "Reparenting is off by default; enable it per relationship if children move between parents.",
                "Converting a lookup to master-detail needs every existing child to have a parent value first.",
                "Undeleting the master restores its cascaded details."
              ] },
              { t: "h", text: "Junction objects" },
              { t: "p", html: "A many-to-many link is a third object whose records each point at one record on each side. The first master-detail you create becomes the primary relationship and decides the junction's look and some ownership behaviour. Query it from either side with a child subquery." },
              { t: "code", lang: "sql", code:
                "SELECT Id, Name,\n" +
                "       (SELECT Course__r.Name, Status__c FROM Enrollments__r)\n" +
                "FROM Student__c\n" +
                "WHERE Id IN :studentIds\n" +
                "WITH USER_MODE"
              },
              { t: "note", variant: "warn", html: "Watch for <strong>data skew</strong>: when one parent has a very large number of children (roughly 10,000 or more), saving children locks the shared parent and sharing recalculation slows. Spread children across parents, or keep the relationship a lookup on high-volume objects." },
              { t: "table", headers: ["Tier", "Choosing a relationship", "Why"], rows: [
                ["Naive", "Lookup everywhere because it is flexible", "Rebuilds roll-ups and cascade delete in automation, with bugs"],
                ["Solid", "Choose by the four questions: required, cascade, sharing, roll-ups", "Gets the platform to do the work"],
                ["Standout", "Solid plus volume and sharing impact: avoid master-detail where one parent collects huge child counts, and consider who must see the children independently of the parent", "Prevents lock contention and sharing surprises at scale"]
              ] },
              { t: "cue", html: "<strong>Reach for relationship choice when you hear:</strong> delete the children with the parent, total the line items on the header, many-to-many, the child should have its own owner, users can see the parent but not the child." },
              { t: "note", variant: "key", html: "<strong>The relationship kind is four decisions in one field.</strong> Master-detail gives cascade delete, inherited sharing and roll-ups; a lookup keeps the child independent; a junction is two master-details; hierarchical is only for User." }
            ]
          },
          {
            id: "limits-intro",
            title: "Governor limits: the rules of shared tenancy",
            summary: "The per-transaction ceilings, why they cannot be caught, and the accumulate-query-map pattern that keeps you under them.",
            minutes: 10,
            tags: ["governor-limits", "bulkification", "apex"],
            blocks: [
              { t: "p", html: "Every Apex transaction carries a budget. Each query, row, DML statement, millisecond of CPU and byte of heap is metered against it, and the budget does not care whether your code is a trigger, a controller or a batch chunk. Code that fits the budget for one record and blows it for two hundred is the most common production failure on the platform." },
              { t: "table", headers: ["Limit", "Synchronous", "Asynchronous"], rows: [
                ["SOQL queries", "100", "200"],
                ["SOQL rows returned", "50,000", "50,000"],
                ["DML statements", "150", "150"],
                ["DML rows", "10,000", "10,000"],
                ["CPU time", "10 s", "60 s"],
                ["Heap", "6 MB", "12 MB"],
                ["Callouts", "100", "100"],
                ["Queueable jobs enqueued", "50", "1 from an async job"]
              ] },
              { t: "p", html: "Triggers receive records in chunks of up to <strong>200</strong>, and a data load or integration will send full chunks. Any per-record query or DML therefore multiplies by 200. When a limit is exceeded the platform throws <code class='tok'>System.LimitException</code>, which no catch block can intercept, and the whole transaction rolls back." },
              { t: "code", lang: "java", code:
                "// Naive: one query per record. 200 records means 200 queries and a failure at the 101st.\n" +
                "for (Opportunity o : opps) {\n" +
                "    Account a = [SELECT Region__c FROM Account WHERE Id = :o.AccountId];\n" +
                "    o.Region__c = a.Region__c;\n" +
                "}\n" +
                "\n" +
                "// Bulk-safe: accumulate, query once through the selector, map, process.\n" +
                "Set<Id> accountIds = new Set<Id>();\n" +
                "for (Opportunity o : opps) {\n" +
                "    if (o.AccountId != null) { accountIds.add(o.AccountId); }\n" +
                "}\n" +
                "IAccountSelector selector = AccountSelector.newInstance();\n" +
                "Map<Id, Account> accounts = selector.selectByIds(accountIds);\n" +
                "for (Opportunity o : opps) {\n" +
                "    Account a = accounts.get(o.AccountId);\n" +
                "    if (a != null) { o.Region__c = a.Region__c; }\n" +
                "}"
              },
              { t: "h", text: "Prove it with a bulk test" },
              { t: "code", lang: "java", code:
                "@IsTest\n" +
                "static void stampRegionWith200RecordsUsesOneQuery() {\n" +
                "    User u = TestDataFactory.createUserWithPermSet('Sales_Operations');\n" +
                "    System.runAs(u) {\n" +
                "        List<Opportunity> opps = TestDataFactory.buildOpportunities(200);\n" +
                "        Test.startTest();\n" +
                "        OpportunityRegionService.getInstance().stampRegion(opps);\n" +
                "        Integer used = Limits.getQueries();\n" +
                "        Test.stopTest();\n" +
                "        Assert.areEqual(1, used, 'Stamping 200 opportunities should cost one query, not one per record');\n" +
                "    }\n" +
                "}"
              },
              { t: "table", headers: ["Tier", "Handling limits", "Why"], rows: [
                ["Naive", "Wrap code in try/catch and retry", "LimitException cannot be caught; the retry never runs"],
                ["Solid", "Bulkify: no SOQL, DML or callouts in loops, including inside methods called from loops", "Cost stays flat as record count grows"],
                ["Standout", "Bulkify, assert query counts in 200-record tests, and move work that cannot fit into queueable or batch Apex", "Limits are verified in CI, not discovered in production"]
              ] },
              { t: "note", variant: "trap", html: "The loop you can see is not the only loop. A service method called inside a loop that runs a query, a DML or a callout breaks the budget just as surely. Trace every call inside a loop body." },
              { t: "note", variant: "tip", html: "Per-transaction limits are not the only meters. Orgs also have rolling allocations, such as API requests per 24 hours and asynchronous Apex executions per day, plus data and file storage. Integrations usually hit those first." },
              { t: "cue", html: "<strong>Reach for limit reasoning when you hear:</strong> works in the UI but fails on data load, Too many SOQL queries: 101, Apex CPU time limit exceeded, the integration fails on large batches, it broke when we imported 10,000 records." },
              { t: "quiz", id: "plat-data" },
              { t: "note", variant: "key", html: "<strong>Budget per transaction, multiply by 200.</strong> Accumulate ids, query once, map, process; prove it with a 200-record test; and push work that cannot fit into asynchronous Apex. Limit exceptions cannot be caught." }
            ]
          }
        ]
      },
      {
        id: "model",
        name: "Data Model Design",
        icon: "cube",
        lessons: [
          {
            id: "data-modeling",
            title: "Data model design patterns",
            summary: "Junction objects, polymorphic lookups, big objects and external objects, and how to pick the right storage for each shape of data.",
            minutes: 12,
            tags: ["data-model", "junction", "big-objects"],
            blocks: [
              { t: "p", html: "Designing a Salesforce data model is like <strong>planning a city's addresses</strong>. Most things get a normal street address (a custom object). Some places are shared by two streets (a junction object). A few addresses can belong to several kinds of building (polymorphic lookups). Archives go to a warehouse outside town (big objects), and some buildings are in another city entirely (external objects). Choosing the wrong kind costs you storage, sharing headaches or performance later." },
              { t: "h", text: "Junction objects for many-to-many" },
              { t: "p", html: "A junction object sits between two parents with <strong>two master-detail fields</strong>. Each Enrolment record links one Student to one Course. The first master-detail you create is the <em>primary</em>: it supplies the junction's look and feel and its owner. Access to a junction record depends on access to <em>both</em> parents, and you can roll up counts or sums onto either parent." },
              { t: "code", lang: "java", code: [
                "// Courses a student is enrolled in, through the junction, in one query",
                "List<Enrolment__c> rows = [",
                "    SELECT Course__r.Name, Course__r.Start_Date__c, Status__c",
                "    FROM Enrolment__c",
                "    WHERE Student__c = :studentId",
                "    WITH USER_MODE",
                "    ORDER BY Course__r.Start_Date__c",
                "];"
              ].join("\n") },
              { t: "h", text: "Polymorphic lookups" },
              { t: "p", html: "Some standard fields point at more than one object type. <code class='tok'>Task.WhoId</code> points at a Lead or a Contact, <code class='tok'>Task.WhatId</code> at an Account, Opportunity, Case or custom object, and <code class='tok'>OwnerId</code> on many objects at a User or a Queue. You cannot create your own polymorphic custom lookup, so design a separate lookup per parent when you need one." },
              { t: "code", lang: "java", code: [
                "// Filter by the type behind a polymorphic field",
                "List<Task> accountTasks = [",
                "    SELECT Id, Subject, What.Name",
                "    FROM Task",
                "    WHERE What.Type = 'Account' AND IsClosed = false",
                "    WITH USER_MODE",
                "];",
                "",
                "// In Apex, check the Id's type before casting",
                "if (t.WhatId != null && t.WhatId.getSObjectType() == Account.SObjectType) {",
                "    accountIds.add(t.WhatId);",
                "}"
              ].join("\n") },
              { t: "h", text: "Choosing storage" },
              { t: "table", headers: ["Option", "Best for", "Watch out for"], rows: [
                ["Custom object (<code class='tok'>__c</code>)", "Operational records with automation, sharing and reports", "Data storage, ownership skew and lookup skew at high volume"],
                ["Junction object", "Many-to-many relationships", "Access needs both parents; plan which master is primary"],
                ["Big object (<code class='tok'>__b</code>)", "Billions of append-mostly rows such as audit or telemetry history", "Index fixed at creation (up to 5 fields); queries must filter on index fields in order; no triggers, flows or record sharing"],
                ["External object (<code class='tok'>__x</code>)", "Data that must stay in another system, viewed live through Salesforce Connect", "Every view is a callout; limited automation and reporting; depends on the remote system's uptime"],
                ["Custom metadata type (<code class='tok'>__mdt</code>)", "Configuration that deploys with code", "Not for transactional data; covered in the Apex configuration lesson"]
              ] },
              { t: "note", variant: "tip", html: "Big object inserts are idempotent on the index: writing a row with the same index values overwrites the existing row. Use <code class='tok'>Database.insertImmediate()</code> from Apex or the Bulk API for loads, and design the index around the one question you will always ask." },
              { t: "h", text: "External and indirect lookups" },
              { t: "ul", items: [
                "<strong>External lookup:</strong> a child points to an external object's parent, matched on the external object's External ID.",
                "<strong>Indirect lookup:</strong> an external object points to a Salesforce parent, matched on a unique External ID field on the parent, for example an ERP customer number on Account.",
                "Adapters: OData 2.0 or 4.0, cross-org, or a custom adapter written with the Apex Connector Framework."
              ] },
              { t: "compare",
                bad: { title: "Naive model", items: ["A multi-select picklist of course names on Student", "Every order line ever kept in a custom object forever", "Nightly copy of ERP invoices nobody edits"] },
                good: { title: "Designed model", items: ["Enrolment junction with two master-details and roll-ups", "Closed history archived to a big object indexed by account and date", "ERP invoices shown live as an external object with an indirect lookup to Account"] } },
              { t: "cue", html: "Revisit the model when you hear <em>\"many students, many courses\"</em>, <em>\"we must keep ten years of history\"</em>, <em>\"the data has to stay in SAP\"</em>, or <em>\"one account owns two million contacts\"</em>." },
              { t: "note", variant: "key", html: "<strong>Match the storage to the data's shape and lifecycle.</strong> Junctions for many-to-many, separate lookups instead of custom polymorphism, big objects for huge append-only history, external objects for data that must stay at its source." }
            ]
          },
          {
            id: "validation-formulas",
            title: "Validation rules, formulas and roll-ups",
            summary: "Declarative data quality: writing validation rules that hold for every channel, and using formula and roll-up summary fields without hurting performance.",
            minutes: 11,
            tags: ["validation-rules", "formulas", "data-quality"],
            blocks: [
              { t: "p", html: "A validation rule is a <strong>bouncer with a checklist</strong>. The formula describes the bad situation; when it evaluates to TRUE, the save is refused with your message. Because the bouncer stands at the database door, not the page, it checks every arrival: record pages, Data Loader, the API, Flow and Apex DML." },
              { t: "code", lang: "text", code: [
                "Rule: Opportunity.Require_Contract_Date_When_Won",
                "Error location: Contract_Signed_Date__c",
                "Message: Add the contract signed date before closing as won.",
                "",
                "AND(",
                "  ISCHANGED(StageName),",
                "  ISPICKVAL(StageName, \"Closed Won\"),",
                "  ISBLANK(Contract_Signed_Date__c),",
                "  NOT($Permission.Bypass_Opportunity_Rules)",
                ")"
              ].join("\n") },
              { t: "widget", id: "obValidationTester" },
              { t: "h", text: "Writing rules that age well" },
              { t: "ul", items: [
                "Describe the <em>error</em> condition; the rule fires when the formula is TRUE.",
                "Use <code class='tok'>ISCHANGED</code>, <code class='tok'>ISNEW()</code> and <code class='tok'>PRIORVALUE</code> so old records are not blocked by rules they predate.",
                "Use <code class='tok'>ISPICKVAL</code> or <code class='tok'>TEXT()</code> for picklists and <code class='tok'>ISBLANK</code> rather than <code class='tok'>ISNULL</code>.",
                "Exempt integrations and data fixes with a <strong>custom permission</strong>, never a profile name or user Id.",
                "Put the error next to the field that fixes it, and write the message as an instruction."
              ] },
              { t: "note", variant: "trap", html: "Custom validation rules run after before-save flows and before triggers. A before trigger that sets a field can make a record pass or fail a rule, so test the combination, not each piece alone. See the order of execution lesson." },
              { t: "h", text: "Formula and roll-up summary fields" },
              { t: "table", headers: ["Field type", "How it works", "Limits and cautions"], rows: [
                ["Formula", "Calculated when the record is read; never stored", "Text limit of 3,900 characters and a compiled-size limit; cross-object references span up to 10 relationships"],
                ["Roll-up summary", "COUNT, SUM, MIN or MAX of children, stored on the master", "Master-detail only; about 25 per object by default; recalculation can lock parents during big loads"],
                ["Stored field set by automation", "A real field maintained by a before-save flow or trigger", "Can be indexed and filtered fast; you own keeping it correct"]
              ] },
              { t: "note", variant: "warn", html: "Formula values are computed at read time, so filtering a big report or query on them cannot use a normal index. Cross-object formulas are never deterministic. If a value is filtered often, store it in a real field instead." },
              { t: "table", headers: ["Tier", "Data-quality approach", "Outcome"], rows: [
                ["Naive", "Required on the layout only, rules that block every old record, profile-name bypasses", "API loads create bad data; admins disable rules to get work done"],
                ["Solid", "Field-level required where truly mandatory, ISCHANGED-scoped rules, custom-permission bypass", "Rules hold on every channel without blocking legacy records"],
                ["Standout", "Solid plus stored fields for hot filters, rule messages written for users, and tests that cover rule plus trigger interaction", "Clean data, fast queries and fewer surprises during releases"]
              ] },
              { t: "cue", html: "Reach for a validation rule when you hear <em>\"it must never be saved without X\"</em>; reach for a stored field when you hear <em>\"the report on that formula times out\"</em>." },
              { t: "quiz", id: "plat-model" },
              { t: "note", variant: "key", html: "<strong>Validation rules describe the bad state and run on every channel.</strong> Scope them with ISCHANGED, bypass them with custom permissions, and store values you filter on instead of computing them in formulas." }
            ]
          }
        ]
      },
      {
        id: "ux",
        name: "Experience & UI",
        icon: "grid",
        lessons: [
          {
            id: "record-types-layouts",
            title: "Record types, page layouts and Dynamic Forms",
            summary: "What record types are really for, how layouts are assigned, and when Dynamic Forms and Dynamic Actions replace layout sprawl.",
            minutes: 11,
            tags: ["record-types", "page-layouts", "dynamic-forms"],
            blocks: [
              { t: "p", html: "Think of one object as <strong>a form used by several departments</strong>. Record types decide which version of the form a record is: which picklist values are allowed and which business process it follows. Page layouts and Dynamic Forms decide how that form is laid out on screen. Mixing the two jobs up is the classic cause of twenty near-identical layouts." },
              { t: "table", headers: ["Feature", "Controls", "Assigned by"], rows: [
                ["Record type", "Allowed picklist values, business process (Opportunity stages, Case status, Lead status), default layout", "Profile or permission set grants which record types a user can create"],
                ["Page layout", "Fields, sections, related lists, buttons; read-only and required in the UI", "Profile and record type combination"],
                ["Compact layout", "Fields in the highlights panel and mobile cards", "Record type"],
                ["Dynamic Forms", "Fields and sections placed on the Lightning record page with visibility rules", "Lightning page activation; rules on field values, user, permission or device"],
                ["Dynamic Actions", "Which buttons appear, with visibility rules", "Lightning page activation"]
              ] },
              { t: "note", variant: "trap", html: "Required or read-only on a page layout or in Dynamic Forms applies <em>only in the UI</em>. Data Loader, the API, Flow and Apex ignore it. Make the field universally required or add a validation rule when every channel must comply." },
              { t: "h", text: "Record type Ids in code" },
              { t: "code", lang: "java", code: [
                "// Resolve by developer name: Ids differ between orgs and sandboxes",
                "Id partnerRt = Schema.SObjectType.Account",
                "    .getRecordTypeInfosByDeveloperName()",
                "    .get('Partner')",
                "    .getRecordTypeId();",
                "",
                "List<Account> partners = [",
                "    SELECT Id, Name FROM Account",
                "    WHERE RecordTypeId = :partnerRt",
                "    WITH USER_MODE",
                "];"
              ].join("\n") },
              { t: "note", variant: "warn", html: "Never hardcode a record type Id. It changes between orgs, so a hardcoded Id passes in one sandbox and fails after deployment. The developer name is stable and deploys with metadata." },
              { t: "h", text: "When to add a record type" },
              { t: "compare",
                bad: { title: "Record type sprawl", items: ["A record type per team only to show different fields", "Twelve layouts that differ by two fields", "Automation full of RecordType.Name checks"] },
                good: { title: "Purposeful design", items: ["Record types only where values or processes really differ", "One Lightning page with Dynamic Forms visibility rules", "Logic keyed on developer names or custom permissions"] } },
              { t: "ul", items: [
                "Dynamic Forms work on custom objects and a growing list of standard objects; check support for the object you need.",
                "Migrate a layout's fields into Dynamic Forms from the App Builder; the layout still governs related lists and some mobile surfaces.",
                "Visibility rules hide fields from view, not from the API or reports. Use field-level security for real protection."
              ] },
              { t: "cue", html: "Question the design when you hear <em>\"we need another record type so sales sees different fields\"</em> or <em>\"why does the integration skip the required field?\"</em>" },
              { t: "note", variant: "key", html: "<strong>Record types change what is valid; layouts and Dynamic Forms change what is shown.</strong> UI required is not data required, and record type Ids come from developer names, never literals." }
            ]
          },
          {
            id: "app-builder",
            title: "Lightning App Builder and FlexiPages",
            summary: "Record, app and home pages, activation rules, exposing your own LWCs with design properties, and keeping pages fast.",
            minutes: 10,
            tags: ["app-builder", "flexipage", "lwc"],
            blocks: [
              { t: "p", html: "Lightning App Builder is a <strong>shop-fitting kit</strong>: a template sets the walls, standard and custom components are the shelves, and activation decides which shop front each customer sees. The result is saved as FlexiPage metadata, so a page deploys like any other component." },
              { t: "table", headers: ["Page type", "Used for", "Activation"], rows: [
                ["Record page", "Viewing and editing one record", "Org default, app default, or app plus record type plus profile"],
                ["App page", "A one-page tool or dashboard inside an app", "Added to an app's navigation as a tab"],
                ["Home page", "The landing page of an app", "Org default, app default, or app plus profile"]
              ] },
              { t: "h", text: "Exposing a custom component" },
              { t: "code", lang: "text", code: [
                "<!-- renewalRisk.js-meta.xml (namespace attribute omitted) -->",
                "<LightningComponentBundle>",
                "    <apiVersion>62.0</apiVersion>",
                "    <isExposed>true</isExposed>",
                "    <masterLabel>Renewal risk</masterLabel>",
                "    <targets>",
                "        <target>lightning__RecordPage</target>",
                "        <target>lightning__AppPage</target>",
                "    </targets>",
                "    <targetConfigs>",
                "        <targetConfig targets=\"lightning__RecordPage\">",
                "            <property name=\"monthsAhead\" type=\"Integer\" default=\"3\" label=\"Months ahead\"/>",
                "            <objects><object>Account</object></objects>",
                "        </targetConfig>",
                "    </targetConfigs>",
                "</LightningComponentBundle>"
              ].join("\n") },
              { t: "p", html: "On a record page the framework passes <code class='tok'>recordId</code> and <code class='tok'>objectApiName</code> to <code class='tok'>@api</code> properties of the same name. Design properties such as <code class='tok'>monthsAhead</code> arrive as <code class='tok'>@api</code> values the admin sets in the builder, so one component serves several pages without code changes." },
              { t: "h", text: "Keeping pages fast" },
              { t: "ul", items: [
                "Put secondary components in tabs or accordions; components in a tab that is not open are not rendered until it is opened.",
                "Prefer one component that loads related data through Lightning Data Service over several components that each call Apex.",
                "Use component visibility filters to hide components users never need, rather than shipping separate pages.",
                "Run the builder's page performance analysis before and after adding components."
              ] },
              { t: "table", headers: ["Tier", "Page design", "Effect"], rows: [
                ["Naive", "Fifteen components on the first tab, each calling its own Apex method", "Slow first paint and a chatty server"],
                ["Solid", "Key fields first, related data in tabs, LDS where possible", "Fast load, cached data shared between components"],
                ["Standout", "Solid plus visibility filters by permission, design properties for reuse, and measured page performance", "One maintainable page per object that stays fast as it grows"]
              ] },
              { t: "note", variant: "tip", html: "Retrieve FlexiPages with <code class='tok'>sf project retrieve start --metadata FlexiPage:Account_Record_Page --target-org dev</code> and review them in pull requests like code. Activation assignments travel with the page and with app metadata." },
              { t: "cue", html: "Open App Builder when you hear <em>\"sales and service need different Account pages\"</em>, <em>\"the admin wants to configure it without a developer\"</em>, or <em>\"the record page takes six seconds to load\"</em>." },
              { t: "note", variant: "key", html: "<strong>FlexiPages are metadata: template, components, visibility and activation.</strong> Expose LWCs through targets and design properties, and keep first-tab content lean." }
            ]
          },
          {
            id: "email-experience",
            title: "Email templates and Experience Cloud basics",
            summary: "Lightning and Classic email templates sent from Flow and Apex without hardcoded addresses, and how Experience Cloud sites share data with customers and partners.",
            minutes: 12,
            tags: ["email", "experience-cloud", "external-sharing"],
            blocks: [
              { t: "p", html: "Email templates and Experience Cloud sites are both <strong>windows to people outside the org</strong>. Templates decide what an outsider reads in their inbox; sites decide what an outsider can see and do when they log in. Both need the same discipline: no hardcoded addresses, and access that starts closed." },
              { t: "h", text: "Email templates" },
              { t: "table", headers: ["Kind", "Built with", "Notes"], rows: [
                ["Lightning email template", "Email template builder or HTML in Lightning Experience", "Merge fields such as <code class='tok'>{{{Recipient.FirstName}}}</code>; enhanced folders; usable from Flow and Apex"],
                ["Classic email template", "Text, custom HTML, letterhead or Visualforce", "Merge fields such as <code class='tok'>{!Contact.FirstName}</code>; still common in older orgs"],
                ["Custom notification or Chatter post", "Flow or Apex", "Better than email for internal alerts"]
              ] },
              { t: "code", lang: "java", code: [
                "// Template, sender and recipient come from configuration, never literals",
                "Case_Email_Config__mdt cfg = Case_Email_Config__mdt.getInstance('Resolution');",
                "Id templateId = EmailTemplateSelector.getInstance().idByDeveloperName(cfg.Template_Developer_Name__c);",
                "Id fromId = OrgWideEmailSelector.getInstance().idByAddressName(cfg.Org_Wide_Address_Name__c);",
                "",
                "List<Messaging.SingleEmailMessage> mails = new List<Messaging.SingleEmailMessage>();",
                "for (Case c : resolvedCases) {",
                "    Messaging.SingleEmailMessage m = new Messaging.SingleEmailMessage();",
                "    m.setTemplateId(templateId);",
                "    m.setTargetObjectId(c.ContactId);   // recipient merge fields",
                "    m.setWhatId(c.Id);                  // related record merge fields",
                "    m.setOrgWideEmailAddressId(fromId);",
                "    mails.add(m);",
                "}",
                "Messaging.reserveSingleEmailCapacity(mails.size());",
                "Messaging.sendEmail(mails, false);   // inspect SendEmailResult[] and log failures"
              ].join("\n") },
              { t: "note", variant: "warn", html: "Single emails to external addresses count against a daily org limit (commonly 5,000 per 24 hours; far lower in Developer Edition). Build the list and send once per transaction, as above, and reserve capacity so a limit failure is caught before work is done." },
              { t: "h", text: "Experience Cloud basics" },
              { t: "p", html: "An Experience Cloud site is a branded front door, for example <code class='tok'>partners.acme.example</code>, where customers or partners log in with external licences. LWR templates suit fast, custom-built sites; Aura templates such as the service template bring more ready-made components. Your LWCs appear in the site builder when their metadata targets <code class='tok'>lightningCommunity__Page</code>." },
              { t: "table", headers: ["Audience", "Typical licence", "How records are shared"], rows: [
                ["Customers, high volume", "Customer Community", "Sharing sets that match records to the user's Account or Contact"],
                ["Customers needing roles or reports", "Customer Community Plus", "Roles, sharing rules and sharing sets"],
                ["Resellers and partners", "Partner Community", "Partner roles under the partner Account, sharing rules, manual and Apex sharing"],
                ["Unauthenticated visitors", "Guest user", "Guest sharing rules grant read only; keep the guest profile minimal"]
              ] },
              { t: "note", variant: "trap", html: "External org-wide defaults can be <em>stricter</em> than internal ones, and should be Private for anything partners must not browse. A site that inherits Public Read Only internally exposes every record to every external user." },
              { t: "ul", items: [
                "Apex called from a site runs for the external user: keep <code class='tok'>with sharing</code> and <code class='tok'>WITH USER_MODE</code> so their access, not the system's, decides what they get.",
                "Guest users cannot own records and should never get edit access; route anonymous submissions through a controlled screen flow or Apex service.",
                "Test as each persona with a real external test user before go-live."
              ] },
              { t: "cue", html: "Check templates and external sharing when you hear <em>\"send the customer a branded confirmation\"</em>, <em>\"partners should see only their deals\"</em>, or <em>\"anyone with the link can see the case\"</em>." },
              { t: "quiz", id: "plat-ux" },
              { t: "note", variant: "key", html: "<strong>Outsiders get templates and sites, and both start closed.</strong> Configure senders and templates, never hardcode addresses, set external OWDs to Private, and share to partners and customers deliberately." }
            ]
          }
        ]
      }
    ]
  };
})();
