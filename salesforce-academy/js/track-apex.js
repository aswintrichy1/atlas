/* =====================================================================
   ORBIT · Apex
   window.TRACKS.apex — modules: lang / bulk / async
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
  function meter(label, used, limit) {
    var pct = limit > 0 ? (used / limit) * 100 : 0;
    var cls = "ob-meter" + (used > limit ? " over" : (pct >= 70 ? " near" : ""));
    var width = Math.max(0, Math.min(100, Math.round(pct)));
    return h("div", { class: "ob-stack", style: "gap:4px" },
      h("div", { class: "ob-row" }, h("span", { class: "ob-dim" }, label), h("span", { class: "ob-mono" }, used + " / " + limit)),
      h("div", { class: cls }, h("i", { style: "width:" + width + "%" })));
  }

  var Widgets = {};

  /* obGovernorBudget — naive vs bulkified trigger code against one transaction's limits */
  Widgets.obGovernorBudget = function (mount) {
    shell(mount, "simulator", "Governor budget",
      "One DML updates N Accounts, and the Account trigger runs in chunks of 200, all inside the same transaction. Compare per-record code with bulkified code against the 100 SOQL and 150 DML limits.");

    var SOQL_LIMIT = 100, DML_LIMIT = 150, CPU_LIMIT = 10000, ROWS_LIMIT = 10000;
    var mode = "naive", op = "contacts", n = 200;

    var countOut = h("b", {}, String(n));
    var range = h("input", { type: "range", min: "1", max: "1000", step: "1", value: String(n), class: "ob-range", "aria-label": "Records in the transaction" });
    function onRange() {
      var v = parseInt(range.value, 10);
      n = isNaN(v) ? 1 : Math.max(1, Math.min(1000, v));
      paint();
    }
    range.addEventListener("input", onRange);
    range.addEventListener("change", onRange);

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function compute() {
      var chunks = Math.ceil(n / 200);
      var r = { chunks: chunks, soql: 0, dml: 0, rows: 0, cpu: 0, failAt: 0, failMsg: "", processed: n };
      if (mode === "naive") {
        if (op === "contacts") {
          if (n > SOQL_LIMIT) {
            r.failAt = SOQL_LIMIT + 1; r.failMsg = "Too many SOQL queries: 101";
            r.soql = SOQL_LIMIT + 1; r.dml = SOQL_LIMIT; r.processed = SOQL_LIMIT;
          } else { r.soql = n; r.dml = n; }
          r.rows = r.processed * 5;
          r.cpu = Math.round(15 + r.processed * 2.5);
        } else {
          r.soql = 1;
          if (n > DML_LIMIT) {
            r.failAt = DML_LIMIT + 1; r.failMsg = "Too many DML statements: 151";
            r.dml = DML_LIMIT + 1; r.processed = DML_LIMIT;
          } else { r.dml = n; }
          r.rows = r.processed;
          r.cpu = Math.round(15 + r.processed * 2);
        }
      } else {
        if (op === "contacts") { r.soql = chunks; r.dml = chunks; r.rows = n * 5; }
        else { r.soql = chunks * 2; r.dml = chunks; r.rows = n; }
        r.cpu = Math.round(10 * chunks + n * 0.6);
      }
      return r;
    }

    function paint() {
      countOut.textContent = String(n);
      var r = compute();
      clear(stage);
      var pattern;
      if (mode === "naive") {
        pattern = op === "contacts"
          ? "Per record: query that Account's Contacts, then update them. That is 1 SOQL and 1 DML for every Account."
          : "One query loads owners up front, but the Task insert sits inside the loop: 1 DML for every Account.";
      } else {
        pattern = op === "contacts"
          ? "Per chunk: one query for all Contacts of the chunk's Accounts, one update. Cost grows with chunks, not records."
          : "Per chunk: one query for owners and one for existing Tasks, then one insert for every new Task.";
      }
      stage.appendChild(h("p", { class: "ob-dim", style: "margin:0 0 10px" }, pattern));
      var grid = h("div", { class: "ob-stack" });
      grid.appendChild(meter("SOQL queries", r.soql, SOQL_LIMIT));
      grid.appendChild(meter("DML statements", r.dml, DML_LIMIT));
      grid.appendChild(meter("DML rows", r.rows, ROWS_LIMIT));
      grid.appendChild(meter("CPU ms (estimate)", r.cpu, CPU_LIMIT));
      stage.appendChild(grid);
      var verdict = r.failAt
        ? "Throws System.LimitException (" + r.failMsg + ") at record " + r.failAt + ", in chunk " + Math.ceil(r.failAt / 200) + " of " + r.chunks + ". The whole transaction rolls back."
        : "Fits: " + r.soql + " of 100 SOQL and " + r.dml + " of 150 DML across " + r.chunks + (r.chunks === 1 ? " chunk." : " chunks.");
      stage.appendChild(h("div", { class: "ob-card " + (r.failAt ? "is-bad" : "is-ok"), style: "margin-top:10px" }, verdict));

      clear(readout);
      readout.appendChild(ro("records", n));
      readout.appendChild(ro("trigger chunks", r.chunks));
      readout.appendChild(ro("code", mode === "naive" ? "naive (work inside the loop)" : "bulkified"));
      readout.appendChild(ro("operation", op === "contacts" ? "update related Contacts" : "create follow-up Tasks"));
      readout.appendChild(ro("SOQL", r.soql + " / 100"));
      readout.appendChild(ro("DML", r.dml + " / 150"));
      readout.appendChild(ro("LimitException", r.failAt ? "yes, at record " + r.failAt : "no"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["naive", "Naive (SOQL + DML in loop)"], ["bulk", "Bulkified"]], 0, function (v) { mode = v; paint(); }),
      segment([["contacts", "Update related Contacts"], ["tasks", "Create Tasks"]], 0, function (v) { op = v; paint(); }),
      h("label", { class: "w-field" }, "Records in transaction", range, countOut)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* obAsyncPicker — pick the asynchronous tool from the shape of the work */
  Widgets.obAsyncPicker = function (mount) {
    shell(mount, "decision", "Async tool picker",
      "Describe the work. The picker names the asynchronous tool, the limits that matter for it, and why the alternatives lose.");

    var st = { callouts: "no", chain: "no", volume: "small", schedule: "no", decouple: "no" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function decide() {
      var rec, why = [], limits = [];
      if (st.decouple === "yes") {
        rec = "Platform event + subscriber";
        why.push("The publisher fires the event and carries on; it never waits for, or even knows about, the subscribers.");
        why.push("Each subscriber (an Apex trigger on the __e object, a flow, or an external client) runs in its own transaction with its own limits.");
        if (st.callouts === "yes") why.push("Keep callouts out of the event trigger itself: it enqueues a Queueable marked Database.AllowsCallouts.");
        if (st.volume === "large") why.push("High event volumes are fine: an Apex subscriber receives events in batches of up to 2,000.");
        if (st.schedule === "yes") why.push("If the real need is timing rather than decoupling, schedule the job directly instead.");
        if (st.chain === "yes") why.push("Fan-out replaces chaining here: several subscribers can react to the same event independently.");
        limits = ["each EventBus.publish call counts as a DML statement", "Apex subscriber batch: up to 2,000 events", "retries: throw EventBus.RetryableException, bounded by the platform"];
      } else if (st.schedule === "yes") {
        rec = "Schedulable that starts a " + (st.volume === "large" ? "Batch" : "Queueable");
        why.push("A Schedulable only decides when. Keep execute() light and hand the real work to " + (st.volume === "large" ? "Database.executeBatch." : "System.enqueueJob."));
        if (st.callouts === "yes") why.push("Scheduled Apex cannot call out synchronously, so the callouts belong in the job it starts.");
        if (st.chain === "yes") why.push(st.volume === "large" ? "Chain the next batch from finish(), never from execute()." : "The Queueable can enqueue one child, or use a Finalizer to continue.");
        limits = ["100 scheduled Apex jobs per org", "cron expression, for example 0 0 2 * * ?", st.volume === "large" ? "batch scope default 200, max 2,000" : "1 child job from an executing Queueable"];
      } else if (st.volume === "large") {
        rec = "Batch Apex";
        why.push("Tens of thousands to millions of rows need start() to stream them through a QueryLocator, with each execute() scope in its own transaction.");
        why.push("Filter start() on the field the job consumes, never WHERE Id != null, so empty chunks are never created.");
        if (st.callouts === "yes") why.push("Add Database.AllowsCallouts and size the scope so one execute() stays under 100 callouts.");
        if (st.chain === "yes") why.push("Start the next batch from finish(), or have finish() publish an event for the next step.");
        limits = ["scope default 200, max 2,000", "5 batch jobs queued or active, up to 100 more holding in the flex queue", "QueryLocator: up to 50 million rows"];
      } else {
        rec = "Queueable";
        why.push("One unit of async work at moderate volume: a Queueable takes typed constructor arguments, returns a job Id, and supports a Finalizer.");
        if (st.callouts === "yes") why.push("Implement Database.AllowsCallouts; the job gets its own 100-callout budget.");
        if (st.chain === "yes") why.push("Chain by enqueuing the next step from execute() or the Finalizer. Pass Ids, not SObjects, and cap the depth.");
        limits = ["50 enqueues from a synchronous transaction", "1 child job from an executing Queueable", "async limits: 200 SOQL, 60 s CPU, 12 MB heap"];
      }
      var legacy = (rec === "Queueable" && st.callouts === "yes" && st.chain === "no")
        ? "@future(callout=true) is the old answer to exactly this case. It is legacy: primitive arguments only, no job Id, no chaining, no Finalizer. Use a Queueable."
        : "@future is legacy and banned by many enterprise rulebooks. Anything it can do, a Queueable does with better control.";
      return { rec: rec, why: why, limits: limits, legacy: legacy };
    }

    function paint() {
      var out = decide();
      clear(stage);
      stage.appendChild(h("div", { class: "ob-card is-on" }, h("h4", {}, out.rec), h("span", { class: "ob-dim" }, out.why[0])));
      var list = h("ol", { class: "ob-steps", style: "margin-top:10px" });
      for (var i = 1; i < out.why.length; i++) {
        list.appendChild(h("li", { class: "ob-step is-done" }, h("span", { class: "ob-num" }, String(i)), h("span", {}, out.why[i])));
      }
      if (out.why.length > 1) stage.appendChild(list);
      var chips = h("div", { class: "ob-row", style: "margin-top:10px" });
      for (var j = 0; j < out.limits.length; j++) chips.appendChild(h("span", { class: "ob-chip" }, out.limits[j]));
      stage.appendChild(chips);
      stage.appendChild(h("div", { class: "ob-card is-dim", style: "margin-top:10px" }, h("span", { class: "ob-chip warn" }, "legacy"), " " + out.legacy));
      clear(readout);
      readout.appendChild(ro("use", out.rec));
      readout.appendChild(ro("callouts", st.callouts));
      readout.appendChild(ro("chaining", st.chain));
      readout.appendChild(ro("volume", st.volume === "small" ? "under 10k" : "10k to 50M"));
      readout.appendChild(ro("on a schedule", st.schedule));
      readout.appendChild(ro("decoupled", st.decouple));
    }

    function pick(key) { return function (v) { st[key] = v; paint(); }; }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["no", "No callouts"], ["yes", "Needs callouts"]], 0, pick("callouts")),
      segment([["no", "Single job"], ["yes", "Chain jobs"]], 0, pick("chain")),
      segment([["small", "Under 10k records"], ["large", "10k to 50M records"]], 0, pick("volume")),
      segment([["no", "Run once, now"], ["yes", "Run on a schedule"]], 0, pick("schedule")),
      segment([["no", "Caller owns the work"], ["yes", "Decouple publisher and subscriber"]], 0, pick("decouple"))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "apex-lang": {
      title: "Apex language core checkpoint",
      sub: "Types, collections, SOQL and SOSL, DML and Database methods.",
      questions: [
        { q: "What does new Map<Id, Account>([SELECT Id, Name FROM Account WHERE Id IN :ids]) give you?",
          options: ["A map keyed by record Id, built in one statement with no loop", "A list of the Accounts sorted by Id", "A map keyed by Account Name", "A set of the returned Ids only"],
          answer: 0,
          explain: "The Map constructor that takes a list of SObjects keys every row by its Id. That gives you constant-time lookups for the accumulate, query, map, process pattern without writing a loop to fill the map." },
        { q: "Which SOQL clause enforces object permissions, field-level security and sharing for the running user in a single keyword?",
          options: ["WITH SECURITY_ENFORCED", "FOR UPDATE", "WITH USER_MODE", "ALL ROWS"],
          answer: 2,
          explain: "WITH USER_MODE runs the query as the user, enforcing CRUD, FLS and record sharing together. WITH SECURITY_ENFORCED checks CRUD and FLS only and throws on the first inaccessible field. FOR UPDATE locks rows, and ALL ROWS includes deleted and archived records." },
        { q: "How does Database.update(records, false) differ from a plain update records statement?",
          options: ["It runs the update in user mode", "It allows partial success: failed rows come back as errors in the SaveResults instead of rolling back the whole statement", "It skips triggers on the object", "It does not count against the DML statement limit"],
          answer: 1,
          explain: "With allOrNone set to false, good rows are saved and bad rows report errors you must inspect and log. It still fires triggers, counts as one DML statement, and runs in system mode unless you also pass AccessLevel.USER_MODE." },
        { q: "You need to find 'Acme' across Account, Contact and Lead names in one call. Which is the right tool?",
          options: ["Three SOQL queries with LIKE '%Acme%'", "One SOQL query with three subqueries", "Dynamic SOQL inside a loop over object names", "One SOSL FIND with a RETURNING clause for each object"],
          answer: 3,
          explain: "SOSL searches the text index across several objects at once, and returns one list per object. Leading-wildcard LIKE in SOQL cannot use indexes, and a query per object spends more of your limits. Remember that SOSL has its own budget of 20 searches per transaction." },
        { q: "Which Apex collection discards duplicate values automatically?",
          options: ["List", "Set", "The values() of a Map", "An SObject array"],
          answer: 1,
          explain: "A Set holds each value once, which makes Set<Id> the natural way to gather parent Ids inside a loop before querying with IN. Lists and arrays keep duplicates, and Map values can repeat across keys." }
      ]
    },
    "apex-bulk": {
      title: "Bulk and triggers checkpoint",
      sub: "Bulkification, trigger layering and governor-limit fixes.",
      questions: [
        { q: "A trigger queries Contacts inside a for loop over Trigger.new. A data load updates 300 Accounts in one DML. What happens?",
          options: ["It throws System.LimitException on the 101st query, inside the first chunk of 200", "It succeeds, because each 200-record chunk gets fresh limits", "It succeeds, because triggers have a 200-query limit", "It fails only at record 201"],
          answer: 0,
          explain: "The trigger runs in chunks of 200, but every chunk belongs to the same transaction and shares its 100-query limit. One query per record therefore fails at record 101 and rolls back the whole load. Async contexts get 200 queries, but a trigger on a data load is synchronous." },
        { q: "In the house layering, where does SOQL belong?",
          options: ["In the trigger body", "In the handler", "In the service", "Only in selector classes"],
          answer: 3,
          explain: "Selectors own every query, including custom metadata queries, so that access mode, field lists and filters are decided in one place and can be mocked in tests. Services call selectors, handlers call services, and the trigger only dispatches." },
        { q: "What should an Apex trigger body contain?",
          options: ["All business logic for small objects", "A dispatch to the handler and nothing else: no logic, SOQL or DML", "SOQL to preload related data", "The text of validation error messages"],
          answer: 1,
          explain: "A logic-free trigger means one trigger per object, a single place to bypass it, and business rules that live in a testable service. Even a little logic in the trigger body tends to grow until nobody can reason about ordering." },
        { q: "Which fix removes an O(n²) nested loop that matches Contacts to Accounts?",
          options: ["Move the inner loop into a @future method", "Add LIMIT 200 to the Contact query", "Build a Map<Id, List<Contact>> once, then look up each Account's list", "Implement Database.Stateful"],
          answer: 2,
          explain: "Grouping the children by parent Id once turns n times m comparisons into roughly n plus m operations. With 200 Accounts and 5,000 Contacts, that is a million comparisons down to about 5,200, which is often the difference between passing and failing the CPU limit." },
        { q: "Your trigger throws 'Too many DML statements: 151'. Which fix is correct?",
          options: ["Ask Salesforce to raise the limit in Setup", "Wrap each update in its own try/catch", "Use Database.update(record, false) inside the loop instead", "Collect changed records in a list and issue one update after the loop"],
          answer: 3,
          explain: "A DML statement costs one unit whether it writes one row or 10,000, so the fix is fewer statements, not different ones. Governor limits cannot be raised, and try/catch or partial-success DML inside the loop still spends a statement per record." }
      ]
    },
    "apex-async": {
      title: "Asynchronous Apex checkpoint",
      sub: "Queueable, Batch, Schedulable and platform events.",
      questions: [
        { q: "Why do enterprise standards prefer Queueable to @future?",
          options: ["A Queueable accepts typed arguments including SObjects, returns a job Id, can chain and supports a Finalizer", "@future runs synchronously", "Queueable jobs have no governor limits", "@future methods cannot make callouts"],
          answer: 0,
          explain: "@future takes only primitives, gives you no handle to monitor, and cannot chain, so failures are hard to see. A Queueable can be monitored through its job Id, retried from a Finalizer and chained deliberately. Both are asynchronous and both get async limits." },
        { q: "How many Queueable jobs can an executing Queueable enqueue?",
          options: ["50", "One child job", "Unlimited", "None"],
          answer: 1,
          explain: "A synchronous transaction can enqueue up to 50 jobs, but an executing Queueable can enqueue only one child. That keeps chains linear. Use AsyncOptions to cap the stack depth, and switch to Batch or events beyond a handful of hops." },
        { q: "With a QueryLocator, what are Batch Apex's default and maximum scope sizes?",
          options: ["100 and 1,000", "50 and 500", "200 and 2,000", "2,000 and 10,000"],
          answer: 2,
          explain: "Database.executeBatch uses 200 records per execute() unless you pass a scope, up to 2,000. Use smaller scopes when each record makes callouts or the per-record work is heavy, because every execute() gets a fresh but finite budget." },
        { q: "Which start() query is correct for a batch that normalises Account phone numbers?",
          options: ["SELECT Id, Phone FROM Account WHERE Id != null", "SELECT Id FROM Account", "SELECT Id, Phone FROM Account LIMIT 50000", "SELECT Id, Phone FROM Account WHERE Phone != null AND Phone_Normalised__c = false"],
          answer: 3,
          explain: "Filter on the field the job consumes, so chunks with no work are never created and a rerun picks up only what is left. WHERE Id != null filters nothing, and LIMIT 50000 silently drops the rest of a large table." },
        { q: "A subscriber trigger on Order_Shipped__e hits a transient lock error. What makes the platform deliver the batch again?",
          options: ["Throwing EventBus.RetryableException", "Calling System.enqueueJob twice", "Returning early from the handler", "Implementing Database.Stateful"],
          answer: 0,
          explain: "Throwing RetryableException tells the platform to resend the same batch of events later. Retries are capped, so check EventBus.TriggerContext.currentContext().retries, roll back to a savepoint first, and log once you give up." }
      ]
    }
  });

  /* obConfigPicker — choose where a configurable value should live */
  var ApexMore = {};
  ApexMore.obConfigPicker = function (mount) {
    shell(mount, "picker", "Where should this setting live?",
      "Pick what kind of value you are externalising and how it varies. The picker recommends a home and shows how Apex reads it.");
    var st = { kind: "rule", varies: "none", deploy: "yes" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function decide() {
      if (st.kind === "secret") return { home: "Named Credential + External Credential", read: "callout:Payments_API/v1/charges", why: "Secrets never live in metadata, settings or code. The credential stores them per environment and Apex only names the endpoint.", deploys: "definition deploys; secret entered per org" };
      if (st.kind === "gate") return { home: "Custom Permission in a permission set", read: "FeatureManagement.checkPermission('Bypass_Opportunity_Rules')", why: "Gating behaviour by who the user is belongs in the access model, so admins grant it with permission sets and it works in validation rules and flows too.", deploys: "yes, with permission sets" };
      if (st.kind === "text") return { home: "Custom Label", read: "System.Label.Order_Confirmation_Heading", why: "User-facing text needs translation and should be editable without code. Labels are available in Apex, LWC and formulas.", deploys: "yes, translations included" };
      if (st.kind === "cache") return { home: "Platform Cache (org or session partition)", read: "Cache.Org.get(TierTableCache.class, 'tiers')", why: "Expensive-to-build data that many transactions reuse belongs in cache with a loader for misses. Cache is a performance layer, never the source of truth.", deploys: "partition definition only" };
      if (st.varies === "user") return { home: "Hierarchy Custom Setting", read: "Pricing_Defaults__c.getInstance().Max_Discount__c", why: "A hierarchy setting resolves the most specific value for the running user, then profile, then org default. Its values are data, so seed them per environment.", deploys: "definition only; values are data" };
      if (st.deploy === "no") return { home: "Custom Setting (values maintained per org)", read: "Integration_Toggles__c.getOrgDefaults().Sync_Enabled__c", why: "Values that admins change in each org without a deployment can be custom setting data. Keep secrets out of it.", deploys: "definition only; values are data" };
      return { home: "Custom Metadata Type", read: "Discount_Rule__mdt.getInstance('Gold').Max_Percent__c", why: "Business rules that should ship with the release, be reviewed in pull requests and stay identical across orgs belong in custom metadata records. Read them with getAll() or getInstance(); never with SOQL.", deploys: "yes, records deploy as metadata" };
    }
    function paint() {
      var d = decide();
      clear(stage);
      stage.appendChild(h("div", { class: "ob-card is-on" }, h("h4", {}, d.home), d.why));
      stage.appendChild(h("div", { class: "ob-mono" }, d.read));
      clear(readout);
      readout.appendChild(ro("recommended", d.home));
      readout.appendChild(ro("deploys with code", d.deploys));
      readout.appendChild(ro("hardcoded literal", "never"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("div", { class: "w-field" }, h("label", {}, "Kind of value"),
        segment([["rule", "Business rule or mapping"], ["gate", "Who may do something"], ["text", "User-facing text"], ["secret", "Endpoint secret"], ["cache", "Expensive lookup reused often"]], 0, function (v) { st.kind = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Varies by"),
        segment([["none", "Same for everyone"], ["user", "User or profile"]], 0, function (v) { st.varies = v; paint(); })),
      h("div", { class: "w-field" }, h("label", {}, "Ship with the release?"),
        segment([["yes", "Yes, reviewed in Git"], ["no", "No, admins edit per org"]], 0, function (v) { st.deploy = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };
  window.Widgets = Object.assign(window.Widgets || {}, ApexMore);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "apex-design": {
      title: "Configuration, cache and error handling checkpoint",
      sub: "Custom metadata, custom settings, Platform Cache and logging discipline.",
      questions: [
        { q: "Discount tiers must be identical in every org, reviewed in pull requests and deployed with the code that reads them. Where do they belong?",
          options: ["A list custom setting", "Custom metadata type records", "Hardcoded constants in a utility class", "A custom object loaded by Data Loader"], answer: 1,
          explain: "Custom metadata records are metadata: they deploy, version and diff like code, and Apex reads them with getAll() or getInstance() without a SOQL query. Custom setting and custom object values are data and drift between orgs. Constants need a deploy for every change and hide business rules in code." },
        { q: "What does Pricing_Defaults__c.getInstance() return for a hierarchy custom setting?",
          options: ["Always the org default", "The value for the running user if set, otherwise their profile's, otherwise the org default", "A list of every record", "Null unless SOQL is used first"], answer: 1,
          explain: "Hierarchy settings resolve from most specific to least: user, then profile, then org. That makes them useful for per-user overrides. Use custom permissions rather than settings when the question is whether a user may do something." },
        { q: "What is the correct mental model for Platform Cache?",
          options: ["A durable store you can rely on to keep values until you delete them", "A faster replacement for custom objects", "A best-effort performance layer: every read must handle a miss by rebuilding the value, ideally through a CacheBuilder", "A way to bypass sharing for faster queries"], answer: 2,
          explain: "Cached values can be evicted at any time and expire by time to live. Code that assumes a hit breaks under load. The CacheBuilder interface makes the loader part of the read, so a miss transparently rebuilds the value." },
        { q: "Which catch block meets the house error-handling standard in a Queueable?",
          options: ["catch (Exception e) {}", "catch (Exception e) { System.debug(e); }", "catch (Exception e) { Logger.publish(LogEntry.newExceptionLog(e).withClassName(CLS).withMethodName('execute')); }", "No try-catch; the platform emails the admin"], answer: 2,
          explain: "Async failures are otherwise silent, so every async execute wraps its body in try-catch and publishes a structured log. Empty catches and debug statements are banned, and platform failure emails are neither structured nor reliable." },
        { q: "Why do many logging frameworks publish log entries as platform events set to publish immediately?",
          options: ["Platform events are cheaper than DML", "An immediately published event survives a rollback, so the log is kept even when the transaction that failed is undone", "Events bypass governor limits", "Events are encrypted by default"], answer: 1,
          explain: "If you insert a log record and the transaction then rolls back, the log disappears with it. Publish-immediately events are delivered regardless, and a subscriber writes them to the log object in its own transaction." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.apex = {
    id: "apex",
    name: "Apex",
    short: "APEX",
    tagline: "Code that thinks in lists, not records",
    color: "#60a5fa",
    blurb: "Apex is the platform's server-side language, and every line of it runs inside a transaction with hard limits. Learn the language core, SOQL, SOSL and DML in user mode, bulkification and the trigger, handler, service and selector layering, the remedy for each governor-limit exception, and when to reach for Queueable, Batch, Schedulable or platform events.",
    modules: [
      {
        id: "lang",
        name: "Language Core",
        icon: "blocks",
        lessons: [
          {
            id: "syntax",
            title: "Apex syntax, types and classes",
            summary: "A strongly typed, Java-like language where the database is a first-class type and every class declares its sharing.",
            minutes: 10,
            tags: ["apex", "types", "classes"],
            blocks: [
              { t: "p", html: "Apex reads like Java, but the runtime is different. It is compiled and run on shared servers, always inside a <strong>transaction</strong> with limits, and the database is built in: an <code class='tok'>Account</code> is a type, and a query is an expression." },
              { t: "table", headers: ["Family", "Examples", "Worth knowing"], rows: [
                ["Primitives", "<code class='tok'>Integer</code>, <code class='tok'>Long</code>, <code class='tok'>Decimal</code>, <code class='tok'>String</code>, <code class='tok'>Boolean</code>, <code class='tok'>Date</code>, <code class='tok'>Datetime</code>, <code class='tok'>Id</code>", "Use Decimal for money. Id checks that the value really is a 15- or 18-character Id."],
                ["SObjects", "<code class='tok'>Account</code>, <code class='tok'>Invoice__c</code>, generic <code class='tok'>SObject</code>", "Field tokens such as <code class='tok'>Account.Name</code> are checked at compile time"],
                ["Collections", "<code class='tok'>List</code>, <code class='tok'>Set</code>, <code class='tok'>Map</code>", "The unit of bulk work; covered in the next lesson"],
                ["Enums and classes", "<code class='tok'>enum Tier</code>, interfaces, inner classes", "Classes are final unless marked <code class='tok'>virtual</code> or <code class='tok'>abstract</code>"]
              ] },
              { t: "code", lang: "java", code: [
                "/**",
                " * @description Pricing rules for invoices.",
                " */",
                "public with sharing class InvoicePricingService {",
                "    private static InvoicePricingService instance;",
                "",
                "    public enum Tier { BRONZE, SILVER, GOLD }",
                "",
                "    public static InvoicePricingService getInstance() {",
                "        if (instance == null) {",
                "            instance = new InvoicePricingService();",
                "        }",
                "        return instance;",
                "    }",
                "",
                "    private InvoicePricingService() {}",
                "",
                "    public Decimal discountFor(Tier tier, Decimal amount) {",
                "        if (amount == null) {",
                "            return 0;",
                "        }",
                "        Decimal rate;",
                "        switch on tier {",
                "            when GOLD   { rate = 0.10; }",
                "            when SILVER { rate = 0.05; }",
                "            when else   { rate = 0; }",
                "        }",
                "        return (amount * rate).setScale(2, RoundingMode.HALF_UP);",
                "    }",
                "}"
              ].join("\n") },
              { t: "h", text: "Every class declares its sharing" },
              { t: "table", headers: ["Keyword", "Meaning", "House use"], rows: [
                ["<code class='tok'>with sharing</code>", "Enforces the running user's record access", "Default for services, handlers and controllers"],
                ["<code class='tok'>inherited sharing</code>", "Takes the caller's mode", "Selectors and utilities"],
                ["<code class='tok'>without sharing</code>", "Ignores record sharing", "Only with a written justification, for example inserting share records"]
              ] },
              { t: "p", html: "Every variable that is not initialised is <code class='tok'>null</code>, including <code class='tok'>Integer</code> and <code class='tok'>Boolean</code>. Use the safe navigation operator for chains, as in <code class='tok'>c.Account?.Owner?.Email</code>, and <code class='tok'>String.isBlank</code> for text." },
              { t: "compare",
                bad: { title: "Fragile checks", items: ["<code class='tok'>if (s != null &amp;&amp; s != '')</code>", "<code class='tok'>s.toLowerCase().equals('closed')</code>", "Nested <code class='tok'>if</code> blocks to reach a parent field"] },
                good: { title: "Idiomatic checks", items: ["<code class='tok'>String.isNotBlank(s)</code>", "<code class='tok'>'Closed'.equalsIgnoreCase(s)</code>", "<code class='tok'>rec?.Account__r?.Name</code>"] } },
              { t: "note", variant: "trap", html: "In Apex, <code class='tok'>==</code> between two Strings is <em>case-insensitive</em>, so <code class='tok'>'ACME' == 'acme'</code> is true. Use <code class='tok'>equals()</code> when case matters, for example when comparing external keys." },
              { t: "h", text: "Exceptions" },
              { t: "code", lang: "java", code: [
                "public virtual with sharing class ApplicationException extends Exception {}",
                "public with sharing class ValidationException extends ApplicationException {}",
                "",
                "try {",
                "    InvoiceService.getInstance().post(invoiceIds);",
                "} catch (ValidationException ex) {",
                "    Logger.publish(",
                "        LogEntry.newExceptionLog(ex, LogEntry.SeverityLevel.MEDIUM)",
                "            .withClassName(CLS)",
                "            .withMethodName('postInvoices')",
                "            .withLogType(LogEntry.LogCategory.APEX)",
                "    );",
                "    throw ex;",
                "}"
              ].join("\n") },
              { t: "table", headers: ["Tier", "Writing a new class"], rows: [
                ["Naive", "No sharing keyword, static utility methods, <code class='tok'>System.debug</code> in every catch block."],
                ["Solid", "<code class='tok'>with sharing</code>, a singleton service, typed exceptions, and errors logged through the logging framework."],
                ["Standout", "The Solid version, plus ApexDoc on public members, <code class='tok'>switch on</code> for branching, null-safe access, and no class growing past its complexity ceiling."]
              ] },
              { t: "note", variant: "key", html: "<strong>Typed, transactional, sharing-aware.</strong> Declare sharing on every class, make services singletons, treat null as the default, and remember that String <code class='tok'>==</code> ignores case." }
            ]
          },
          {
            id: "collections",
            title: "Lists, sets and maps",
            summary: "The data structures that let Apex work on 200 records at once: gather Ids in a Set, query once, look up through a Map.",
            minutes: 9,
            tags: ["collections", "maps", "bulkification"],
            blocks: [
              { t: "p", html: "Collections are how Apex works in bulk. A trigger hands you a <strong>List</strong> of up to 200 records. You gather what you need into a <strong>Set</strong>, query once, and index the results in a <strong>Map</strong> so each record finds its data in constant time." },
              { t: "table", headers: ["Collection", "Ordered", "Duplicates", "Typical job"], rows: [
                ["<code class='tok'>List&lt;T&gt;</code>", "Yes", "Allowed", "Records to insert or update; query results"],
                ["<code class='tok'>Set&lt;T&gt;</code>", "No", "Discarded", "Parent Ids to put in a <code class='tok'>WHERE Id IN :ids</code> filter"],
                ["<code class='tok'>Map&lt;K, V&gt;</code>", "No", "Keys unique", "Id-to-record lookups, grouping children by parent"]
              ] },
              { t: "code", lang: "java", code: [
                "Set<Id> accountIds = new Set<Id>();",
                "for (Case c : cases) {",
                "    if (c.AccountId != null) {",
                "        accountIds.add(c.AccountId);",
                "    }",
                "}",
                "",
                "IAccountSelector accounts = AccountSelector.newInstance();",
                "Map<Id, Account> accountsById = new Map<Id, Account>(accounts.selectByIds(accountIds));",
                "",
                "Map<Id, List<Contact>> contactsByAccount = new Map<Id, List<Contact>>();",
                "for (Contact con : ContactSelector.newInstance().selectByAccountIds(accountIds)) {",
                "    if (!contactsByAccount.containsKey(con.AccountId)) {",
                "        contactsByAccount.put(con.AccountId, new List<Contact>());",
                "    }",
                "    contactsByAccount.get(con.AccountId).add(con);",
                "}",
                "",
                "for (Case c : cases) {",
                "    c.Account_Owner__c = accountsById.get(c.AccountId)?.OwnerId;",
                "}"
              ].join("\n") },
              { t: "h", text: "Accumulate, query, map, process" },
              { t: "ol", items: [
                "<strong>Accumulate</strong> keys in a <code class='tok'>Set&lt;Id&gt;</code> inside the loop. No queries yet.",
                "<strong>Query</strong> once, outside the loop, through a selector, with <code class='tok'>IN :ids</code>.",
                "<strong>Map</strong> the results by the key you will look up with.",
                "<strong>Process</strong> each record with a <code class='tok'>get()</code>, which costs constant time and no limits."
              ] },
              { t: "note", variant: "tip", html: "In triggers, <code class='tok'>Trigger.newMap</code> and <code class='tok'>Trigger.oldMap</code> are already <code class='tok'>Map&lt;Id, SObject&gt;</code>, and <code class='tok'>keySet()</code> gives you the Id set for free, except in before insert, where records have no Id yet." },
              { t: "note", variant: "trap", html: "Never key a Set or Map on an SObject you will keep changing. Its hash depends on its field values, so after you change a field, <code class='tok'>contains()</code> and <code class='tok'>get()</code> stop finding it. Key on the Id." },
              { t: "table", headers: ["Approach", "200 Cases against 5,000 Contacts", "Cost"], rows: [
                ["Nested loops", "200 x 5,000 comparisons", "About 1,000,000 steps; CPU-limit territory"],
                ["Group into a Map first", "5,000 inserts plus 200 lookups", "About 5,200 steps"]
              ] },
              { t: "table", headers: ["Tier", "Stamping each Case with its Account owner"], rows: [
                ["Naive", "Query the Account inside the loop over Cases."],
                ["Solid", "Gather the Account Ids, query once, and look each one up in a <code class='tok'>Map&lt;Id, Account&gt;</code>."],
                ["Standout", "The Solid version through a selector in user mode, skipping null AccountIds, with safe navigation on the lookup and a 200-record test."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>for each record, find its parent or children</em>, <em>match these two lists</em>, or <em>deduplicate the Ids</em>. Reach for <code class='tok'>Set&lt;Id&gt;</code> plus <code class='tok'>Map&lt;Id, ...&gt;</code> before writing any inner loop." },
              { t: "note", variant: "key", html: "<strong>Set to gather, Map to find.</strong> Collect keys in the loop, query once outside it, index the results by Id, and the code costs the same whether it receives 1 record or 200." }
            ]
          },
          {
            id: "soql-sosl",
            title: "SOQL and SOSL",
            summary: "Relationship and aggregate queries, user mode by default, safe dynamic queries, and when a text search beats a query.",
            minutes: 11,
            tags: ["soql", "sosl", "security"],
            blocks: [
              { t: "p", html: "<strong>SOQL</strong> asks one object a precise question and can follow relationships up to parents and down to children. <strong>SOSL</strong> searches the text index across many objects at once. Choose SOQL when you know where the data lives, and SOSL when you are searching for it." },
              { t: "code", lang: "sql", code: [
                "-- parent fields through lookups",
                "SELECT Id, Subject, Account.Name, Account.Owner.Email",
                "FROM Case",
                "WHERE Status = 'Escalated' AND CreatedDate = LAST_N_DAYS:7",
                "WITH USER_MODE",
                "",
                "-- child rows through a subquery",
                "SELECT Id, Name, (SELECT Id, Email FROM Contacts WHERE Email != null)",
                "FROM Account",
                "WHERE Id IN :accountIds",
                "WITH USER_MODE",
                "",
                "-- aggregate, filtered before and after grouping",
                "SELECT AccountId, COUNT(Id) openCases",
                "FROM Case",
                "WHERE IsClosed = false",
                "GROUP BY AccountId",
                "HAVING COUNT(Id) > 5",
                "",
                "-- SOSL across objects",
                "FIND :term IN NAME FIELDS",
                "RETURNING Account(Id, Name LIMIT 20), Contact(Id, Name, Email LIMIT 20), Lead(Id, Name LIMIT 20)"
              ].join("\n") },
              { t: "table", headers: ["Question", "SOQL", "SOSL"], rows: [
                ["Shape", "One object, plus parent fields and child subqueries", "Several objects, one result list each"],
                ["Matching", "Exact values, ranges, IN lists, date literals", "Tokenised full-text search"],
                ["Budget (sync)", "100 queries, 50,000 rows", "20 searches, 2,000 rows each"],
                ["Aggregates", "<code class='tok'>COUNT</code>, <code class='tok'>SUM</code>, <code class='tok'>GROUP BY</code>", "No"]
              ] },
              { t: "h", text: "Access mode" },
              { t: "table", headers: ["Mode", "Enforces", "When"], rows: [
                ["<code class='tok'>WITH USER_MODE</code>", "CRUD, FLS and sharing for the running user", "Default for user-facing reads"],
                ["<code class='tok'>WITH SYSTEM_MODE</code>", "Nothing", "System jobs and setup objects, with the reason in ApexDoc"],
                ["<code class='tok'>WITH SECURITY_ENFORCED</code>", "CRUD and FLS only; throws on the first inaccessible field", "Older code; prefer user mode for new work"],
                ["<code class='tok'>Security.stripInaccessible</code>", "Removes fields the user cannot see", "When partial access is acceptable"]
              ] },
              { t: "note", variant: "warn", html: "Setup objects such as <code class='tok'>PermissionSetAssignment</code> can quietly return no rows in user mode for non-admins. To gate a feature, check a Custom Permission with <code class='tok'>FeatureManagement.checkPermission('Approve_Credit')</code> rather than querying who holds a permission set." },
              { t: "h", text: "Dynamic SOQL, safely" },
              { t: "code", lang: "java", code: [
                "private static final Set<String> SORTABLE = new Set<String>{ 'Name', 'CreatedDate', 'AnnualRevenue' };",
                "",
                "public List<Account> searchByName(String fragment, String sortField) {",
                "    String orderBy = SORTABLE.contains(sortField) ? sortField : 'Name';",
                "    Map<String, Object> binds = new Map<String, Object>{ 'pattern' => '%' + fragment + '%' };",
                "    String soql = 'SELECT Id, Name FROM Account WHERE Name LIKE :pattern ORDER BY ' + orderBy + ' LIMIT 50';",
                "    return Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE);",
                "}"
              ].join("\n") },
              { t: "note", variant: "trap", html: "Never concatenate user input into a query string. Values go in bind variables, and identifiers such as field names come from an allow-list. <code class='tok'>String.escapeSingleQuotes</code> is the last resort, not the plan." },
              { t: "h", text: "Selectivity" },
              { t: "ul", items: [
                "Indexed out of the box: <code class='tok'>Id</code>, <code class='tok'>Name</code>, <code class='tok'>OwnerId</code>, <code class='tok'>CreatedDate</code>, <code class='tok'>SystemModstamp</code>, <code class='tok'>RecordTypeId</code>, lookup and master-detail fields, and external Id or unique fields.",
                "Formula fields are never indexed, so filtering on them scans the whole table.",
                "Negative filters (<code class='tok'>!=</code>, <code class='tok'>NOT IN</code>) and leading-wildcard <code class='tok'>LIKE</code> are usually non-selective on large objects.",
                "Standard indexes skip nulls, so <code class='tok'>WHERE Field__c = null</code> will not use them."
              ] },
              { t: "stat", items: [
                { v: "100 / 200", k: "SOQL queries, sync / async" },
                { v: "50,000", k: "query rows per transaction" },
                { v: "20", k: "SOSL searches" },
                { v: "2,000", k: "rows per SOSL search" }
              ] },
              { t: "table", headers: ["Tier", "A search box for Accounts"], rows: [
                ["Naive", "String-concatenated dynamic SOQL with the user's text and sort field, run in system mode."],
                ["Solid", "<code class='tok'>queryWithBinds</code> in user mode, with an allow-listed sort field and a <code class='tok'>LIMIT</code>."],
                ["Standout", "The Solid version in a selector, SOSL when the search spans objects, and a test run as a restricted user proving that hidden records stay hidden."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>search across</em> means SOSL; <em>count per parent</em> means an aggregate; <em>user-supplied filter or sort</em> means binds plus an allow-list; and <em>only what this user may see</em> means <code class='tok'>WITH USER_MODE</code>." },
              { t: "note", variant: "key", html: "<strong>SOQL to ask, SOSL to search, user mode by default.</strong> Bind every value, allow-list every identifier, filter on indexed fields, and keep setup-object checks behind Custom Permissions." }
            ]
          },
          {
            id: "dml",
            title: "DML and Database methods",
            summary: "Statements versus rows, all-or-none versus partial success, user-mode writes, savepoints and upserts.",
            minutes: 10,
            tags: ["dml", "database-methods", "transactions"],
            blocks: [
              { t: "p", html: "Every DML call costs <strong>one statement</strong>, whether it writes 1 row or 10,000. That single fact explains bulk DML: build the list first, then write it once. The 150-statement limit is reached by calling DML many times, not by writing many rows." },
              { t: "table", headers: ["Operation", "Statement form", "Method form", "Note"], rows: [
                ["Insert", "<code class='tok'>insert as user recs;</code>", "<code class='tok'>Database.insert(recs, false, AccessLevel.USER_MODE)</code>", "Ids are filled in on the list after it succeeds"],
                ["Update", "<code class='tok'>update as user recs;</code>", "<code class='tok'>Database.update(...)</code>", "Fires update triggers and flows"],
                ["Upsert", "<code class='tok'>upsert recs ERP_Id__c;</code>", "<code class='tok'>Database.upsert(recs, Account.ERP_Id__c, false, ...)</code>", "Matches on Id or an external Id"],
                ["Delete / undelete", "<code class='tok'>delete recs;</code>", "<code class='tok'>Database.delete(...)</code>", "Deleted rows stay in the recycle bin for a while"]
              ] },
              { t: "code", lang: "java", code: [
                "Database.SaveResult[] results = Database.update(accounts, false, AccessLevel.USER_MODE);",
                "Boolean hasError = false;",
                "for (Database.SaveResult sr : results) {",
                "    if (!sr.isSuccess()) {",
                "        hasError = true;",
                "        break;",
                "    }",
                "}",
                "if (hasError) {",
                "    Logger.publish(",
                "        LogEntry.newDmlLog(results, accounts, LogEntry.SeverityLevel.MEDIUM)",
                "            .withClassName(CLS)",
                "            .withMethodName('syncRegions')",
                "            .withLogType(LogEntry.LogCategory.DML_EXCEPTION)",
                "    );",
                "}"
              ].join("\n") },
              { t: "note", variant: "warn", html: "Do not mix modes. If a class reads with <code class='tok'>WITH USER_MODE</code>, its writes need <code class='tok'>AccessLevel.USER_MODE</code> (or <code class='tok'>as user</code>). A bare <code class='tok'>update</code> runs in system mode and quietly skips the CRUD, FLS and sharing checks the read just applied." },
              { t: "h", text: "All-or-none vs partial success" },
              { t: "table", headers: ["Style", "On one bad row", "Use when"], rows: [
                ["<code class='tok'>update recs;</code> (all-or-none)", "Throws <code class='tok'>DmlException</code>; nothing in the statement is saved", "The rows only make sense together, as in a user's save"],
                ["<code class='tok'>Database.update(recs, false, ...)</code>", "Good rows save; bad rows return errors", "Bulk jobs and integrations, where you inspect and log every failure"]
              ] },
              { t: "code", lang: "java", code: [
                "Savepoint sp = Database.setSavepoint();",
                "try {",
                "    insert as user orders;",
                "    insert as user orderLines;",
                "} catch (DmlException ex) {",
                "    Database.rollback(sp);",
                "    throw new ValidationException('Order could not be saved: ' + ex.getDmlMessage(0));",
                "}"
              ].join("\n") },
              { t: "ul", items: [
                "A rollback undoes DML after the savepoint. It does <strong>not</strong> refund the limits already spent.",
                "Callouts already made and events published immediately are not undone.",
                "Static variables keep their values, so reset any guard state yourself."
              ] },
              { t: "h", text: "Upsert with external Ids" },
              { t: "code", lang: "java", code: [
                "Database.UpsertResult[] results = Database.upsert(",
                "    accountsFromErp, Account.ERP_Id__c, false, AccessLevel.USER_MODE",
                ");"
              ].join("\n") },
              { t: "note", variant: "trap", html: "Writing a setup object such as <code class='tok'>User</code> and a business object such as <code class='tok'>Account</code> in one transaction throws <code class='tok'>MIXED_DML_OPERATION</code>. Move one side into a Queueable. In tests, separate them with <code class='tok'>System.runAs</code>." },
              { t: "stat", items: [
                { v: "150", k: "DML statements per transaction" },
                { v: "10,000", k: "DML rows per transaction" }
              ] },
              { t: "table", headers: ["Tier", "Saving an order and its lines"], rows: [
                ["Naive", "Insert each line inside a loop, in system mode, with no error handling."],
                ["Solid", "One insert for the orders and one for the lines, in user mode, inside a savepoint with a rollback."],
                ["Standout", "The Solid version, plus partial success with logged SaveResults for bulk imports and an external-Id upsert so retries do not create duplicates."]
              ] },
              { t: "quiz", id: "apex-lang" },
              { t: "note", variant: "key", html: "<strong>Statements are the scarce resource, not rows.</strong> Build lists and write once, keep writes in the same mode as reads, inspect every partial-success result, and remember that a rollback does not refund limits." }
            ]
          }
        ]
      },
      {
        id: "bulk",
        name: "Bulk & Triggers",
        icon: "grid",
        lessons: [
          {
            id: "bulkification",
            title: "Bulkification patterns",
            summary: "Write every method as if it receives 200 records, because in a trigger it does, and all the chunks share one budget.",
            minutes: 11,
            tags: ["bulkification", "governor-limits", "triggers"],
            blocks: [
              { t: "p", html: "Bulkified code works on a <strong>list</strong>, never on one record. A trigger receives up to 200 records per chunk, and a 1,000-row load runs five chunks <em>in the same transaction</em>. Code that queries once per record works in a demo and fails on the first import." },
              { t: "compare",
                bad: { title: "Per-record work", items: ["SOQL inside the loop", "DML inside the loop", "A helper method that queries, called from the loop", "Cost grows with every record"] },
                good: { title: "Bulkified", items: ["Gather Ids in a Set", "One query through a selector", "Map lookups while processing", "One DML after the loop; cost grows only with chunks"] } },
              { t: "code", lang: "java", code: [
                "// Anti-pattern: one query and one DML per Account",
                "for (Account acc : (List<Account>) Trigger.new) {",
                "    List<Contact> contacts = [SELECT Id FROM Contact WHERE AccountId = :acc.Id];",
                "    for (Contact con : contacts) {",
                "        con.Region__c = acc.Region__c;",
                "    }",
                "    update contacts;",
                "}",
                "",
                "// Bulkified service method",
                "public void syncContactRegions(List<Account> accounts, Map<Id, Account> oldMap) {",
                "    Map<Id, Account> changed = new Map<Id, Account>();",
                "    for (Account acc : accounts) {",
                "        if (acc.Region__c != oldMap.get(acc.Id).Region__c) {",
                "            changed.put(acc.Id, acc);",
                "        }",
                "    }",
                "    if (changed.isEmpty()) {",
                "        return;",
                "    }",
                "    List<Contact> contacts = ContactSelector.newInstance().selectByAccountIds(changed.keySet());",
                "    for (Contact con : contacts) {",
                "        con.Region__c = changed.get(con.AccountId).Region__c;",
                "    }",
                "    update as user contacts;",
                "}"
              ].join("\n") },
              { t: "widget", id: "obGovernorBudget" },
              { t: "p", html: "Read the widget's numbers. With naive code that updates Contacts, record 101 issues query 101 and the whole transaction rolls back. With naive code that creates Tasks, the query is outside the loop but the insert is not, so it fails at record 151 on DML instead. Bulkified, 1,000 records cost 5 queries and 5 DML statements: one of each per chunk." },
              { t: "note", variant: "trap", html: "Chunks do not reset limits. The second 200 records of a load start with whatever the first 200 left, plus whatever flows and other triggers on the object have spent." },
              { t: "h", text: "Loops you cannot see" },
              { t: "code", lang: "java", code: [
                "for (Case c : cases) {",
                "    c.Entitlement_Name__c = lookupEntitlement(c.AccountId);",
                "}",
                "",
                "private String lookupEntitlement(Id accountId) {",
                "    return [SELECT Name FROM Entitlement WHERE AccountId = :accountId LIMIT 1].Name;",
                "}"
              ].join("\n") },
              { t: "p", html: "The loop above looks clean, but the helper runs a query on every iteration. The same goes for a service method that makes a callout or publishes a log on each call. Trace every method called inside a loop before calling the code bulk-safe." },
              { t: "table", headers: ["Tier", "Syncing Contact regions when an Account changes"], rows: [
                ["Naive", "Query and update Contacts for each Account inside the loop."],
                ["Solid", "Filter to changed Accounts, query Contacts once through a selector, and update once."],
                ["Standout", "The Solid version in user mode with a recursion guard, plus a 200-record test that asserts the outcome and that <code class='tok'>Limits.getQueries()</code> stays flat as the record count grows."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>works in the UI but fails on Data Loader</em>, <em>Too many SOQL queries: 101</em>, <em>Too many DML statements: 151</em>, or <em>only breaks for large imports</em>." },
              { t: "note", variant: "key", html: "<strong>One query and one write per chunk, not per record.</strong> Every chunk of a load shares one transaction's 100 SOQL and 150 DML, so work inside a loop always fails at scale." }
            ]
          },
          {
            id: "triggers",
            title: "Trigger design and handler frameworks",
            summary: "A logic-free trigger, a handler that routes events, a service that owns the rules and a selector that owns the queries.",
            minutes: 12,
            tags: ["triggers", "handler", "architecture"],
            blocks: [
              { t: "p", html: "Triggers are entry points, not homes for logic. The house layering gives every concern exactly one place: the <strong>trigger</strong> dispatches, the <strong>handler</strong> routes events, the <strong>service</strong> owns business rules, and the <strong>selector</strong> owns every query. Flow and LWC entry points call the same service." },
              { t: "diagram", id: "trigger-layers", caption: "Layered Apex: the trigger only dispatches, the handler routes by event, the service holds the rules and the selector holds every query. UI and Flow entry points reach the same service through thin controllers and invocables." },
              { t: "table", headers: ["Layer", "Does", "Never does"], rows: [
                ["Trigger", "Checks the bypass registry, dispatches", "Logic, conditions, SOQL, DML"],
                ["Handler", "Casts context lists and maps, routes each event to the service", "Business rules"],
                ["Service (singleton)", "Business rules, DML, enqueuing async work", "Inline SOQL"],
                ["Selector (with interface)", "Every query, access mode, field lists", "DML or rules"]
              ] },
              { t: "code", lang: "java", code: [
                "trigger AccountTrigger on Account (",
                "    before insert, after insert, before update, after update,",
                "    before delete, after delete, after undelete",
                ") {",
                "    TriggerBypassRegistry.ensureComputed(Account.SObjectType);",
                "    new TriggerDispatcher(",
                "        AccountHandler.getInstance(),",
                "        TriggerContextData.fromTrigger(),",
                "        Account.SObjectType",
                "    ).dispatch();",
                "}"
              ].join("\n") },
              { t: "code", lang: "java", code: [
                "public with sharing class AccountHandler implements ITriggerHandler {",
                "    private static ITriggerHandler instance;",
                "    private AccountService service;",
                "",
                "    public static ITriggerHandler getInstance() {",
                "        if (instance == null) {",
                "            instance = new AccountHandler(AccountService.getInstance());",
                "        }",
                "        return instance;",
                "    }",
                "",
                "    private AccountHandler(AccountService service) {",
                "        this.service = service;",
                "    }",
                "",
                "    public void onAfterUpdate(List<SObject> newObjects, Map<Id, SObject> oldMap) {",
                "        service.syncContactRegions((List<Account>) newObjects, (Map<Id, Account>) oldMap);",
                "    }",
                "    // other ITriggerHandler events follow the same shape",
                "}"
              ].join("\n") },
              { t: "code", lang: "java", code: [
                "public interface IContactSelector {",
                "    List<Contact> selectByAccountIds(Set<Id> accountIds);",
                "}",
                "",
                "public inherited sharing class ContactSelector implements IContactSelector {",
                "    @TestVisible private static IContactSelector instance;",
                "",
                "    public static IContactSelector newInstance() {",
                "        if (instance == null) {",
                "            instance = new ContactSelector();",
                "        }",
                "        return instance;",
                "    }",
                "",
                "    public List<Contact> selectByAccountIds(Set<Id> accountIds) {",
                "        if (accountIds == null || accountIds.isEmpty()) {",
                "            return new List<Contact>();",
                "        }",
                "        return [SELECT Id, AccountId, Region__c FROM Contact WHERE AccountId IN :accountIds WITH USER_MODE];",
                "    }",
                "}"
              ].join("\n") },
              { t: "table", headers: ["Event", "Trigger.new", "Trigger.old / oldMap", "Can edit Trigger.new?"], rows: [
                ["before insert", "Yes, with no Ids", "No", "Yes, with no DML"],
                ["after insert", "Yes, with Ids", "No", "No, read-only"],
                ["before update", "Yes", "Yes", "Yes, with no DML"],
                ["after update", "Yes", "Yes", "No, read-only"],
                ["before / after delete", "No", "Yes", "Not applicable"],
                ["after undelete", "Yes", "No", "No, read-only"]
              ] },
              { t: "note", variant: "tip", html: "Data migrations and some batch jobs need to skip a trigger. Use the bypass registry around exactly the DML that needs it, clear it straight after, document why, and clear everything in the batch's <code class='tok'>finish()</code>." },
              { t: "note", variant: "warn", html: "Keep exactly one trigger per object. If two triggers handle the same event, the platform does not guarantee which runs first, and every ordering bug becomes intermittent." },
              { t: "table", headers: ["Tier", "Adding a rule to an object"], rows: [
                ["Naive", "A second trigger with the logic inline and its own SOQL."],
                ["Solid", "A new service method, called from the existing handler, with its query added to the selector and its interface."],
                ["Standout", "The Solid version, plus a recursion guard, a selector mock in unit tests, a 200-record trigger test, and a note in the object's automation inventory."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>where should this logic go</em>, <em>we have two triggers on Opportunity</em>, <em>how do I unit test without data</em>, or <em>Flow and the UI need the same rule</em>. The answer is a service behind the existing handler." },
              { t: "note", variant: "key", html: "<strong>Trigger dispatches, handler routes, service decides, selector queries.</strong> One trigger per object, no logic in it, and every entry point, whether trigger, LWC or Flow, reaches the same service." }
            ]
          },
          {
            id: "limits-patterns",
            title: "Governor-limit patterns",
            summary: "Each limit exception has a known cause and a known fix; learn the table, then the budgets for sync and async code.",
            minutes: 11,
            tags: ["governor-limits", "cpu", "heap"],
            blocks: [
              { t: "p", html: "Governor limits are a budget per transaction, enforced because every org shares the same servers. Each exception points to a small set of causes, and each cause has a standard fix. Diagnose from the message, not from guesswork." },
              { t: "table", headers: ["Exception", "Usual cause", "Fix"], rows: [
                ["Too many SOQL queries: 101", "Query in a loop, or recursion re-running queries", "Accumulate, query once, map; add a recursion guard"],
                ["Too many DML statements: 151", "DML in a loop", "Collect, then one DML per object"],
                ["Apex CPU time limit exceeded", "Nested loops, heavy string building, recursion, complex formulas", "Maps instead of inner loops, <code class='tok'>String.join</code>, move to async"],
                ["Apex heap size too large", "Loading too many rows or fields, JSON copies", "Select fewer fields, SOQL for-loops, Batch"],
                ["Too many query rows: 50001", "Unfiltered queries on large objects", "Selective filters, keyset pagination, Batch"],
                ["Too many callouts: 101", "A callout per record", "Bulk endpoints, Queueable or Batch with AllowsCallouts"],
                ["MIXED_DML_OPERATION", "Setup and business DML together", "Split into a Queueable; <code class='tok'>runAs</code> in tests"],
                ["UNABLE_TO_LOCK_ROW", "Concurrent updates to the same parent", "Shorter transactions, ordered updates, retry from async"]
              ] },
              { t: "code", lang: "java", code: [
                "Map<Id, List<Contact>> contactsByAccount = new Map<Id, List<Contact>>();",
                "for (Contact con : allContacts) {",
                "    if (!contactsByAccount.containsKey(con.AccountId)) {",
                "        contactsByAccount.put(con.AccountId, new List<Contact>());",
                "    }",
                "    contactsByAccount.get(con.AccountId).add(con);",
                "}",
                "for (Case c : cases) {",
                "    List<Contact> related = contactsByAccount.get(c.AccountId);",
                "    if (related != null) {",
                "        c.Contact_Count__c = related.size();",
                "    }",
                "}"
              ].join("\n") },
              { t: "h", text: "Sync and async budgets" },
              { t: "table", headers: ["Limit", "Synchronous", "Asynchronous"], rows: [
                ["SOQL queries", "100", "200"],
                ["Query rows", "50,000", "50,000"],
                ["DML statements / rows", "150 / 10,000", "150 / 10,000"],
                ["CPU time", "10 s", "60 s"],
                ["Heap", "6 MB", "12 MB"],
                ["Callouts / total callout time", "100 / 120 s", "100 / 120 s"],
                ["Future calls / Queueable enqueues", "50 / 50", "none from Batch or future contexts / 1"]
              ] },
              { t: "note", variant: "tip", html: "Moving work to async doubles the query budget and gives six times the CPU and twice the heap, but DML statements and rows stay the same. Async rescues CPU-heavy work; it does not rescue DML in a loop." },
              { t: "h", text: "Heap and rows" },
              { t: "code", lang: "java", code: [
                "Map<Id, Integer> openByAccount = new Map<Id, Integer>();",
                "for (List<Case> page : [",
                "    SELECT AccountId FROM Case",
                "    WHERE IsClosed = false AND AccountId IN :accountIds",
                "    WITH USER_MODE",
                "]) {",
                "    for (Case c : page) {",
                "        Integer current = openByAccount.get(c.AccountId);",
                "        openByAccount.put(c.AccountId, current == null ? 1 : current + 1);",
                "    }",
                "}"
              ].join("\n") },
              { t: "p", html: "A SOQL for-loop over a list variable fetches rows in pages of 200, so the heap never holds the full result. Here, an aggregate query with <code class='tok'>GROUP BY AccountId</code> would be better still, because it returns one row per Account instead of one per Case." },
              { t: "note", variant: "trap", html: "Formula fields are calculated whenever they are read and are never indexed. A complex cross-object formula can push an existing transaction over the CPU limit without any Apex changing, and filtering on one forces a full table scan." },
              { t: "table", headers: ["Tier", "Responding to 'Apex CPU time limit exceeded'"], rows: [
                ["Naive", "Move the whole thing to @future and hope."],
                ["Solid", "Find the nested loop or repeated work from the debug log and replace it with a Map."],
                ["Standout", "The Solid fix, plus checking for recursion and expensive formulas, measuring with a 200-record test, and moving genuinely heavy work to a Queueable with its 60-second budget."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: any message that starts <em>System.LimitException</em>, <em>it times out only for big accounts</em>, or <em>the job dies on heap</em>. Name the limit, name the cause, name the fix." },
              { t: "quiz", id: "apex-bulk" },
              { t: "note", variant: "key", html: "<strong>Every limit exception has a standard remedy.</strong> Queries and DML come out of loops, CPU goes to Maps, heap goes to paging and Batch, and async buys CPU and queries but never more DML." }
            ]
          }
        ]
      },
      {
        id: "async",
        name: "Asynchronous Apex",
        icon: "trend",
        lessons: [
          {
            id: "async-overview",
            title: "Future, queueable, batch and schedulable",
            summary: "Four ways to run Apex later in a fresh transaction, and why Queueable is the default answer.",
            minutes: 12,
            tags: ["async", "queueable", "batch"],
            blocks: [
              { t: "p", html: "Async Apex means <strong>a new transaction, later</strong>, with no user waiting and a larger budget for queries, CPU and heap. The trade-off is that you lose the user's transaction: no immediate result, no shared rollback, and failures you must surface yourself." },
              { t: "table", headers: ["Tool", "Best for", "Key limits", "House stance"], rows: [
                ["@future", "Small fire-and-forget work with primitive arguments", "50 per transaction; no chaining; no job Id", "Legacy; banned in many rulebooks"],
                ["Queueable", "One unit of async work, callouts, controlled chains", "50 enqueues from sync code, 1 child from async; Finalizer support", "The default choice"],
                ["Batch Apex", "Tens of thousands to millions of rows", "Scope 200 by default, 2,000 max; 5 active jobs plus 100 in the flex queue", "Filter <code class='tok'>start()</code> on the consumed field"],
                ["Schedulable", "Running something on a timetable", "100 scheduled jobs per org", "Keep it light; start a Batch or Queueable"],
                ["Platform event", "Decoupling a publisher from its subscribers", "Publishing counts as DML; subscriber batches up to 2,000", "Fan-out and integration"]
              ] },
              { t: "widget", id: "obAsyncPicker" },
              { t: "code", lang: "java", code: [
                "public with sharing class InvoiceSyncQueueable implements Queueable, Database.AllowsCallouts {",
                "    private static final String CLS = 'InvoiceSyncQueueable';",
                "    private final List<Id> invoiceIds;",
                "",
                "    public InvoiceSyncQueueable(List<Id> invoiceIds) {",
                "        this.invoiceIds = invoiceIds;",
                "    }",
                "",
                "    public void execute(QueueableContext ctx) {",
                "        System.attachFinalizer(new InvoiceSyncFinalizer(invoiceIds));",
                "        try {",
                "            InvoiceSyncService.getInstance().pushToErp(invoiceIds);",
                "        } catch (Exception ex) {",
                "            Logger.publish(",
                "                LogEntry.newExceptionLog(ex, LogEntry.SeverityLevel.HIGH)",
                "                    .withClassName(CLS)",
                "                    .withMethodName('execute')",
                "                    .withLogType(LogEntry.LogCategory.APEX)",
                "            );",
                "        }",
                "    }",
                "}",
                "",
                "public with sharing class InvoiceSyncFinalizer implements Finalizer {",
                "    private final List<Id> invoiceIds;",
                "",
                "    public InvoiceSyncFinalizer(List<Id> invoiceIds) {",
                "        this.invoiceIds = invoiceIds;",
                "    }",
                "",
                "    public void execute(FinalizerContext ctx) {",
                "        if (ctx.getResult() == ParentJobResult.UNHANDLED_EXCEPTION) {",
                "            EventBus.publish(new Log_Event__e(",
                "                Class_Name__c = 'InvoiceSyncQueueable',",
                "                Message__c = 'Sync failed for ' + invoiceIds.size() + ' invoices: ' + ctx.getException()?.getMessage()",
                "            ));",
                "        }",
                "    }",
                "}"
              ].join("\n") },
              { t: "code", lang: "java", code: [
                "AsyncOptions options = new AsyncOptions();",
                "options.MaximumQueueableStackDepth = 5;",
                "Id jobId = System.enqueueJob(new InvoiceSyncQueueable(invoiceIds), options);"
              ].join("\n") },
              { t: "p", html: "<code class='tok'>pushToErp</code> calls out through a Named Credential, as in <code class='tok'>callout:ERP_API/invoices</code>, so no endpoint or secret appears in code. The Finalizer runs even when the job dies on an uncatchable limit, and it publishes an event so the failure is logged in a transaction of its own." },
              { t: "note", variant: "warn", html: "Treat <code class='tok'>@future</code> as legacy. It accepts only primitives, returns nothing you can monitor, cannot chain, and cannot be called from another future method. Anything new uses a Queueable." },
              { t: "table", headers: ["Chaining rule", "Why"], rows: [
                ["Pass Ids, not SObjects, to the next job", "Records go stale between transactions; query again"],
                ["Cap chains at about five hops", "Longer chains are hard to monitor; use Batch or events"],
                ["Chain from a Finalizer or from <code class='tok'>finish()</code>", "Chaining from Batch <code class='tok'>execute()</code> starts one job per chunk"],
                ["Log every hand-off", "Step number, class and record count make a broken chain debuggable"]
              ] },
              { t: "table", headers: ["Tier", "Syncing invoices to an ERP after save"], rows: [
                ["Naive", "A synchronous callout in the trigger, which the platform rejects before commit, or an @future per record."],
                ["Solid", "The service collects Ids and enqueues one Queueable with AllowsCallouts and a Named Credential."],
                ["Standout", "The Solid version with a Finalizer for failure logging and bounded retry, a depth cap, an idempotent ERP key, and tests using <code class='tok'>Test.setMock</code>."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>call an external system when a record changes</em>, <em>this takes too long for the user to wait</em>, <em>process a million records</em>, or <em>every night at 2</em>. Each one names a different async tool." },
              { t: "note", variant: "key", html: "<strong>Queueable by default, Batch for volume, Schedulable for timing, events for decoupling.</strong> Async buys a fresh, larger budget at the cost of surfacing failures yourself, so attach a Finalizer." }
            ]
          },
          {
            id: "batch",
            title: "Batch Apex in depth",
            summary: "start, execute and finish; scope sizing, Stateful counters, scheduling, monitoring and the start() filter that matters most.",
            minutes: 11,
            tags: ["batch-apex", "scheduling", "large-data"],
            blocks: [
              { t: "p", html: "Batch Apex splits one large job into many small transactions. <code class='tok'>start()</code> defines the records once, the platform cuts them into scopes, each <code class='tok'>execute()</code> runs in its <strong>own transaction</strong> with fresh limits, and <code class='tok'>finish()</code> runs once at the end." },
              { t: "code", lang: "java", code: [
                "public with sharing class PhoneNormaliseBatch implements",
                "        Database.Batchable<SObject>, Database.Stateful, Database.RaisesPlatformEvents {",
                "    private static final String CLS = 'PhoneNormaliseBatch';",
                "    private Integer succeeded = 0;",
                "    private Integer failed = 0;",
                "",
                "    public Database.QueryLocator start(Database.BatchableContext bc) {",
                "        return Database.getQueryLocator([",
                "            SELECT Id, Phone FROM Account",
                "            WHERE Phone != null AND Phone_Normalised__c = false",
                "            WITH USER_MODE",
                "        ]);",
                "    }",
                "",
                "    public void execute(Database.BatchableContext bc, List<Account> scope) {",
                "        try {",
                "            for (Account acc : scope) {",
                "                acc.Phone = PhoneFormatter.toE164(acc.Phone);",
                "                acc.Phone_Normalised__c = true;",
                "            }",
                "            Database.SaveResult[] results = Database.update(scope, false, AccessLevel.USER_MODE);",
                "            for (Database.SaveResult sr : results) {",
                "                if (sr.isSuccess()) { succeeded++; } else { failed++; }",
                "            }",
                "        } catch (Exception ex) {",
                "            Logger.publish(LogEntry.newBatchLog(ex, bc.getJobId(), LogEntry.SeverityLevel.HIGH));",
                "        }",
                "    }",
                "",
                "    public void finish(Database.BatchableContext bc) {",
                "        try {",
                "            Logger.publish(LogEntry.newBatchLog(",
                "                'Phones normalised: ' + succeeded + ', failed: ' + failed,",
                "                bc.getJobId(), LogEntry.SeverityLevel.LOW",
                "            ));",
                "        } catch (Exception ex) {",
                "            Logger.publish(LogEntry.newBatchLog(ex, bc.getJobId(), LogEntry.SeverityLevel.HIGH));",
                "        }",
                "    }",
                "}"
              ].join("\n") },
              { t: "table", headers: ["Phase", "Runs", "Budget"], rows: [
                ["<code class='tok'>start()</code>", "Once", "A QueryLocator can address up to 50 million rows"],
                ["<code class='tok'>execute()</code>", "Once per scope (200 by default, up to 2,000)", "Fresh async limits every time"],
                ["<code class='tok'>finish()</code>", "Once", "Its own transaction: summary, notification, next step"]
              ] },
              { t: "code", lang: "java", code: [
                "public with sharing class PhoneNormaliseScheduler implements Schedulable {",
                "    private static final String CLS = 'PhoneNormaliseScheduler';",
                "",
                "    public void execute(SchedulableContext ctx) {",
                "        try {",
                "            Database.executeBatch(new PhoneNormaliseBatch(), 200);",
                "        } catch (Exception ex) {",
                "            Logger.publish(",
                "                LogEntry.newExceptionLog(ex, LogEntry.SeverityLevel.HIGH)",
                "                    .withClassName(CLS)",
                "                    .withMethodName('execute')",
                "                    .withLogType(LogEntry.LogCategory.APEX)",
                "            );",
                "        }",
                "    }",
                "}",
                "",
                "// once per environment, from anonymous Apex or a deploy script",
                "System.schedule('Phone normalise nightly', '0 0 2 * * ?', new PhoneNormaliseScheduler());"
              ].join("\n") },
              { t: "ul", items: [
                "Up to <strong>5</strong> batch jobs can be queued or active at once, with up to <strong>100</strong> more holding in the flex queue.",
                "<code class='tok'>Database.Stateful</code> keeps instance variables across <code class='tok'>execute()</code> calls. Static variables reset with every transaction.",
                "Use a smaller scope when each record makes a callout or the per-record work is heavy, and add <code class='tok'>Database.AllowsCallouts</code> for callouts.",
                "Chain the next job from <code class='tok'>finish()</code>. Never enqueue from <code class='tok'>execute()</code>."
              ] },
              { t: "note", variant: "trap", html: "Never write <code class='tok'>WHERE Id != null</code> in <code class='tok'>start()</code>. It filters nothing, so the job walks the whole table. Filter on the field the job consumes, so a rerun picks up only the rows still waiting." },
              { t: "note", variant: "warn", html: "<code class='tok'>Database.Stateful</code> serialises its state between chunks. Keep it to counters and small Id sets; a growing list of records eventually hits the heap limit." },
              { t: "h", text: "Monitoring" },
              { t: "p", html: "<code class='tok'>Database.executeBatch</code> returns a job Id, and <code class='tok'>AsyncApexJob</code> reports progress. Implementing <code class='tok'>Database.RaisesPlatformEvents</code> makes unhandled exceptions publish <code class='tok'>BatchApexErrorEvent</code>, which a subscriber can log or alert on." },
              { t: "code", lang: "sql", code: [
                "SELECT Status, JobItemsProcessed, TotalJobItems, NumberOfErrors, ExtendedStatus",
                "FROM AsyncApexJob",
                "WHERE Id = :jobId"
              ].join("\n") },
              { t: "table", headers: ["Tier", "Normalising phone numbers on 3 million Accounts"], rows: [
                ["Naive", "One Queueable that queries every Account and runs out of rows and heap."],
                ["Solid", "A Batch whose <code class='tok'>start()</code> filters on the not-yet-normalised flag, with partial-success updates."],
                ["Standout", "The Solid version, plus Stateful counters logged in <code class='tok'>finish()</code>, <code class='tok'>RaisesPlatformEvents</code> for alerting, a nightly Schedulable, and a test that runs one 200-record scope."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>backfill</em>, <em>migrate every record</em>, <em>nightly clean-up of millions of rows</em>, or <em>process more than the 50,000-row query limit</em>." },
              { t: "note", variant: "key", html: "<strong>start filters, execute works, finish reports.</strong> Every scope is a fresh transaction, so filter <code class='tok'>start()</code> on the field you consume, keep Stateful small, and chain only from <code class='tok'>finish()</code>." }
            ]
          },
          {
            id: "platform-events",
            title: "Platform events",
            summary: "Publish and subscribe inside the platform: publish behaviour, subscriber transactions, retries and testing.",
            minutes: 11,
            tags: ["platform-events", "event-driven", "eventbus"],
            blocks: [
              { t: "p", html: "A platform event is a message on the platform's bus. The <strong>publisher</strong> states that something happened and carries on; each <strong>subscriber</strong> reacts in its own transaction, with its own limits. Neither side knows the other's code, which is the point." },
              { t: "table", headers: ["Concept", "What to know"], rows: [
                ["Event object", "Defined like a custom object with the suffix <code class='tok'>__e</code>; its fields are the payload"],
                ["Publish behaviour", "<em>Publish after commit</em> sends only if the transaction commits; <em>publish immediately</em> sends even if it rolls back"],
                ["Subscribers", "Apex triggers (after insert only), platform event-triggered flows, and external clients through the Pub/Sub API"],
                ["Replay", "Each event carries a ReplayId; events are kept for about 72 hours so subscribers can catch up"],
                ["Budget", "Each <code class='tok'>EventBus.publish</code> call counts as a DML statement in the publishing transaction"]
              ] },
              { t: "code", lang: "java", code: [
                "public with sharing class OrderEventPublisher {",
                "    private static final String CLS = 'OrderEventPublisher';",
                "",
                "    public static void publishShipped(List<Order> orders) {",
                "        List<Order_Shipped__e> events = new List<Order_Shipped__e>();",
                "        for (Order o : orders) {",
                "            events.add(new Order_Shipped__e(Order_Number__c = o.OrderNumber, Account_Id__c = o.AccountId));",
                "        }",
                "        Integer failures = 0;",
                "        for (Database.SaveResult sr : EventBus.publish(events)) {",
                "            if (!sr.isSuccess()) {",
                "                failures++;",
                "            }",
                "        }",
                "        if (failures > 0) {",
                "            Logger.publish(",
                "                LogEntry.newLog(CLS, 'publishShipped', failures + ' shipped events failed to publish')",
                "                    .withLogType(LogEntry.LogCategory.INTEGRATION)",
                "            );",
                "        }",
                "    }",
                "}"
              ].join("\n") },
              { t: "code", lang: "java", code: [
                "trigger OrderShippedTrigger on Order_Shipped__e (after insert) {",
                "    OrderShippedHandler.getInstance().handle(Trigger.new);",
                "}",
                "",
                "public with sharing class OrderShippedHandler {",
                "    private static final String CLS = 'OrderShippedHandler';",
                "    private static final Integer MAX_RETRIES = 4;",
                "    private static OrderShippedHandler instance;",
                "",
                "    public static OrderShippedHandler getInstance() {",
                "        if (instance == null) {",
                "            instance = new OrderShippedHandler();",
                "        }",
                "        return instance;",
                "    }",
                "",
                "    private OrderShippedHandler() {}",
                "",
                "    public void handle(List<Order_Shipped__e> events) {",
                "        Savepoint sp = Database.setSavepoint();",
                "        try {",
                "            Set<String> orderNumbers = new Set<String>();",
                "            for (Order_Shipped__e evt : events) {",
                "                orderNumbers.add(evt.Order_Number__c);",
                "            }",
                "            FulfilmentService.getInstance().markShipped(orderNumbers);",
                "        } catch (DmlException ex) {",
                "            Database.rollback(sp);",
                "            if (EventBus.TriggerContext.currentContext().retries < MAX_RETRIES) {",
                "                throw new EventBus.RetryableException('Transient failure, retrying: ' + ex.getMessage());",
                "            }",
                "            Logger.publish(",
                "                LogEntry.newExceptionLog(ex, LogEntry.SeverityLevel.HIGH)",
                "                    .withClassName(CLS)",
                "                    .withMethodName('handle')",
                "                    .withLogType(LogEntry.LogCategory.INTEGRATION)",
                "            );",
                "        }",
                "    }",
                "}"
              ].join("\n") },
              { t: "note", variant: "trap", html: "An event that says <em>this happened</em> must use <strong>publish after commit</strong>; otherwise subscribers react to an order that rolled back. <strong>Publish immediately</strong> is right for logging events, which you want to keep precisely when the transaction fails." },
              { t: "ul", items: [
                "An Apex subscriber receives events in batches of up to 2,000. Handle them as a list, exactly like a bulk trigger.",
                "Subscribers run as the Automated Process user by default. Configure a subscriber running user when sharing or ownership matters.",
                "Keep callouts out of the event trigger itself; enqueue a Queueable with <code class='tok'>Database.AllowsCallouts</code>.",
                "Make handlers idempotent with a business key in the payload, because retries and replays can deliver an event more than once."
              ] },
              { t: "h", text: "Testing" },
              { t: "code", lang: "java", code: [
                "@IsTest",
                "static void publishShippedMarksEveryFulfilmentShipped() {",
                "    User ops = TestDataFactory.createUserWithPermSet('Fulfilment_Ops');",
                "    System.runAs(ops) {",
                "        List<Order> orders = TestDataFactory.createOrdersWithFulfilment(200);",
                "        Test.startTest();",
                "        OrderEventPublisher.publishShipped(orders);",
                "        Test.stopTest();",
                "    }",
                "    Integer shipped = [SELECT COUNT() FROM Fulfilment__c WHERE Status__c = 'Shipped'];",
                "    Assert.areEqual(200, shipped, 'Every shipped order should mark its fulfilment record shipped');",
                "}"
              ].join("\n") },
              { t: "table", headers: ["Need", "Reach for"], rows: [
                ["React to a business fact, several consumers, possibly external", "Platform event"],
                ["Mirror record changes to an external system", "Change Data Capture"],
                ["Run one piece of follow-up work for this transaction", "Queueable"],
                ["Log even when the transaction rolls back", "Publish-immediately log event"]
              ] },
              { t: "table", headers: ["Tier", "Telling three systems that an order shipped"], rows: [
                ["Naive", "Three synchronous callouts from the Order trigger."],
                ["Solid", "Publish an <code class='tok'>Order_Shipped__e</code> after commit, with one subscriber per consumer."],
                ["Standout", "The Solid version, plus bulk, idempotent subscribers, bounded retries with savepoints, a configured running user, and a 200-event test."]
              ] },
              { t: "cue", html: "Spotting it in a prompt: <em>notify several systems</em>, <em>do not slow down the save</em>, <em>keep the log even if it fails</em>, or <em>the publisher should not know who listens</em>." },
              { t: "quiz", id: "apex-async" },
              { t: "note", variant: "key", html: "<strong>Publish a fact, let subscribers react in their own transactions.</strong> Choose publish-after-commit for business events, handle batches of up to 2,000 idempotently, and retry with a cap." }
            ]
          }
        ]
      },
      {
        id: "design",
        name: "Configuration & Resilience",
        icon: "wrench",
        lessons: [
          {
            id: "config-metadata",
            title: "Custom metadata, custom settings and labels",
            summary: "Choosing where configurable values live so nothing environment-specific is hardcoded, and reading them without wasting limits.",
            minutes: 11,
            tags: ["custom-metadata", "custom-settings", "configuration"],
            blocks: [
              { t: "p", html: "Hardcoding a value is <strong>writing a phone number on the wall in pen</strong>. It works until the number changes, and then someone has to repaint. Salesforce gives you several notice boards instead, each suited to a different kind of value. Picking the right one keeps code identical across orgs and lets admins change behaviour without a deployment." },
              { t: "table", headers: ["Home", "Is it metadata?", "Best for"], rows: [
                ["Custom metadata type (<code class='tok'>__mdt</code>)", "Yes: records deploy and version", "Business rules, mappings, routing tables, feature configuration shipped with code"],
                ["Hierarchy custom setting", "Definition yes, values no", "Per-user or per-profile overrides that admins maintain in each org"],
                ["List custom setting", "Definition yes, values no", "Legacy lookups; prefer custom metadata for new work"],
                ["Custom label", "Yes, with translations", "User-facing text in Apex, LWC and formulas"],
                ["Custom permission", "Yes, granted by permission sets", "Feature gates and bypasses"],
                ["Named Credential", "Definition yes, secrets per org", "Endpoints and authentication; never put secrets anywhere else"]
              ] },
              { t: "widget", id: "obConfigPicker" },
              { t: "h", text: "Reading configuration" },
              { t: "code", lang: "java", code: [
                "// Custom metadata: cached reads, no SOQL query consumed",
                "Discount_Rule__mdt gold = Discount_Rule__mdt.getInstance('Gold');",
                "Map<String, Discount_Rule__mdt> allRules = Discount_Rule__mdt.getAll();",
                "",
                "// Hierarchy custom setting: user, then profile, then org default",
                "Pricing_Defaults__c defaults = Pricing_Defaults__c.getInstance();",
                "Decimal maxDiscount = defaults.Max_Discount__c;",
                "",
                "// Feature gate",
                "Boolean canBypass = FeatureManagement.checkPermission('Bypass_Opportunity_Rules');",
                "",
                "// Translatable text",
                "String heading = System.Label.Order_Confirmation_Heading;"
              ].join("\n") },
              { t: "note", variant: "trap", html: "Do not query custom metadata with SOQL (<code class='tok'>[SELECT ... FROM Discount_Rule__mdt]</code>). The house scanner treats it as a violation: <code class='tok'>getAll()</code> and <code class='tok'>getInstance()</code> are simpler and cached. Long text area fields are the documented exception where you may need a query." },
              { t: "ul", items: [
                "In tests, custom metadata records from the org are visible; do not depend on them for assertions. Wrap reads in a small selector you can stub, or inject records through a test-visible setter.",
                "Custom setting values are data: tests must create them, and each sandbox needs them seeded after refresh.",
                "Custom metadata relationship fields can point at objects and fields (entity and field definitions), which makes mappings refactor-safe."
              ] },
              { t: "compare",
                bad: { title: "Hardcoded", items: ["if (u.Profile.Name == 'Sales Ops')", "String endpoint = 'https://erp.example/api';", "Decimal cap = 0.15; // gold tier"] },
                good: { title: "Externalised", items: ["FeatureManagement.checkPermission('Discount_Override')", "callout:ERP_API/api through a Named Credential", "Discount_Rule__mdt.getInstance('Gold').Max_Percent__c"] } },
              { t: "cue", html: "Externalise the value when you hear <em>\"it is different in UAT\"</em>, <em>\"the business wants to change the threshold\"</em>, or <em>\"only these users should be able to...\"</em>." },
              { t: "note", variant: "key", html: "<strong>Rules that ship go in custom metadata; per-org data goes in custom settings; who-may goes in custom permissions; text goes in labels; secrets go in Named Credentials.</strong> No literals." }
            ]
          },
          {
            id: "platform-cache",
            title: "Platform Cache",
            summary: "Org and session cache, partitions, the CacheBuilder pattern, and why cache is always a best-effort layer.",
            minutes: 9,
            tags: ["platform-cache", "performance", "apex"],
            blocks: [
              { t: "p", html: "Platform Cache is <strong>the counter-top next to the fridge</strong>. Things you use constantly sit within reach, but the counter is small, gets cleared without warning, and the fridge (the database or an external API) is still the source of truth. Code that cannot cope with an empty counter is broken." },
              { t: "table", headers: ["Cache", "Visible to", "Typical use"], rows: [
                ["Org cache", "Every user and transaction in the org", "Shared reference data: tier tables, exchange rates, config derived from several queries"],
                ["Session cache", "One user's session", "Per-user state such as a wizard's choices or an expensive per-user calculation"]
              ] },
              { t: "p", html: "Capacity is split into <strong>partitions</strong> that you create in Setup and allocate between org and session cache. Keys are alphanumeric, and values carry a time to live; the platform evicts least-recently-used entries when a partition is full. Some editions include a small amount of capacity, and more can be purchased." },
              { t: "code", lang: "java", code: [
                "// Cache-aside with CacheBuilder: a miss calls doLoad and caches the result",
                "public with sharing class TierTableCache implements Cache.CacheBuilder {",
                "    public Object doLoad(String key) {",
                "        Map<String, Decimal> tiers = new Map<String, Decimal>();",
                "        for (Discount_Rule__mdt r : Discount_Rule__mdt.getAll().values()) {",
                "            tiers.put(r.DeveloperName, r.Max_Percent__c);",
                "        }",
                "        return tiers;",
                "    }",
                "}",
                "",
                "// Caller: reads from the local.Pricing partition; never assumes a hit",
                "Map<String, Decimal> tiers =",
                "    (Map<String, Decimal>) Cache.Org.getPartition('local.Pricing').get(TierTableCache.class, 'tiers');"
              ].join("\n") },
              { t: "note", variant: "warn", html: "Org cache is shared by every user. Never cache records or values that sharing or FLS would hide from some users, or one user's query result becomes everyone's. Cache reference data, not personal data." },
              { t: "ul", items: [
                "Cache expensive results that many transactions reuse, not cheap queries that run once.",
                "Keep values small and serializable; large objects crowd out other entries.",
                "Invalidate deliberately: remove the key when the source changes, or accept a short time to live.",
                "In tests, do not rely on cache contents; exercise the loader path."
              ] },
              { t: "table", headers: ["Tier", "Caching approach", "Risk"], rows: [
                ["Naive", "Put records in org cache and read them with a cast, assuming they are there", "Null pointer errors under eviction; data leaks across users"],
                ["Solid", "CacheBuilder loaders, reference data only, sensible time to live", "Predictable hits and safe misses"],
                ["Standout", "Solid plus explicit invalidation on change and monitoring of partition hit rates", "Cache that measurably helps and never serves stale critical values"]
              ] },
              { t: "cue", html: "Consider Platform Cache when you hear <em>\"every page load recomputes the same table\"</em> or <em>\"we call the rates API thousands of times an hour\"</em>; avoid it when you hear <em>\"each user sees different rows\"</em>." },
              { t: "note", variant: "key", html: "<strong>Cache is a best-effort speed layer.</strong> Load through CacheBuilder so misses rebuild transparently, cache only shareable reference data in org cache, and keep the database the source of truth." }
            ]
          },
          {
            id: "error-logging",
            title: "Error handling and logging",
            summary: "Custom exceptions, partial-success DML, savepoints and a logging framework that survives rollbacks, following the house standards.",
            minutes: 11,
            tags: ["exceptions", "logging", "resilience"],
            blocks: [
              { t: "p", html: "Error handling is <strong>a flight recorder plus a checklist for emergencies</strong>. The checklist decides what happens next: retry, roll back, or tell the user something useful. The flight recorder keeps a structured account of what went wrong, even if the flight itself is aborted. Debug statements are neither: they vanish unless someone happens to be watching." },
              { t: "h", text: "House rules" },
              { t: "ul", items: [
                "Every catch block publishes a structured log; no empty catches and no <code class='tok'>System.debug()</code>.",
                "Every <code class='tok'>@AuraEnabled</code> method wraps its body, logs, then throws <code class='tok'>AuraHandledException</code> with a safe message.",
                "Every Queueable and Batch <code class='tok'>execute()</code>, and Batch <code class='tok'>finish()</code>, wraps its whole body, because async failures are otherwise silent.",
                "Every partial-success DML call (<code class='tok'>allOrNone = false</code>) inspects its results and logs failures.",
                "Every callout logs non-200 responses and exceptions."
              ] },
              { t: "code", lang: "java", code: [
                "public with sharing class InvoiceService {",
                "    private static final String CLS = 'InvoiceService';",
                "",
                "    public void markPaid(List<Invoice__c> invoices) {",
                "        for (Invoice__c inv : invoices) { inv.Status__c = 'Paid'; }",
                "        List<Database.SaveResult> results = Database.update(invoices, false, AccessLevel.USER_MODE);",
                "        Logger.publish(LogEntry.newDmlLog(results, invoices, CLS, 'markPaid'));",
                "    }",
                "",
                "    public void applyCredit(Id accountId, Decimal amount) {",
                "        Savepoint sp = Database.setSavepoint();",
                "        try {",
                "            CreditSelector.getInstance().lockBalance(accountId);",
                "            insert as user new Credit__c(Account__c = accountId, Amount__c = amount);",
                "        } catch (DmlException ex) {",
                "            Database.rollback(sp);",
                "            Logger.publish(LogEntry.newExceptionLog(ex).withClassName(CLS).withMethodName('applyCredit'));",
                "            throw new CreditException('The credit could not be applied. Try again or contact support.');",
                "        }",
                "    }",
                "}"
              ].join("\n") },
              { t: "p", html: "<code class='tok'>Logger</code> and <code class='tok'>LogEntry</code> are the house logging framework. Its key design choice is publishing entries as <strong>platform events that publish immediately</strong>: if the transaction rolls back, a plain inserted log record would vanish with it, but an immediately published event is still delivered, and a subscriber writes it to the log object in its own transaction." },
              { t: "table", headers: ["Tool", "Use it for", "Watch out for"], rows: [
                ["Custom exception class", "Signalling a domain failure callers can catch specifically", "Name ends in Exception; extend a shared base class"],
                ["Savepoint and rollback", "Undoing part of a transaction when a later step fails", "Each setSavepoint and rollback counts as DML; Ids of rolled-back inserts are not cleared"],
                ["Partial-success DML", "Saving the good rows of a batch", "Results must be inspected, or failures disappear"],
                ["AuraHandledException", "A safe message to an LWC", "Never return stack traces or query text to the UI"]
              ] },
              { t: "note", variant: "trap", html: "Catching <code class='tok'>System.LimitException</code> does not work: limit exceptions cannot be caught. Prevent them with bulk patterns and the <code class='tok'>Limits</code> class instead of hoping to recover." },
              { t: "compare",
                bad: { title: "Silent failure", items: ["catch (Exception e) {}", "Database.update(rows, false) with results ignored", "Stack trace returned to the LWC"] },
                good: { title: "Observable failure", items: ["Logger.publish with class and method names", "SaveResult failures logged with record context", "AuraHandledException with a user-safe message"] } },
              { t: "cue", html: "Tighten error handling when you hear <em>\"the job says Completed but nothing changed\"</em>, <em>\"we only find out when users complain\"</em>, or <em>\"the logs disappeared after the rollback\"</em>." },
              { t: "quiz", id: "apex-design" },
              { t: "note", variant: "key", html: "<strong>Every failure is either handled or recorded, never swallowed.</strong> Log through a framework that survives rollbacks, inspect partial-success results, roll back with savepoints, and give users safe messages." }
            ]
          }
        ]
      }
    ]
  };
})();
