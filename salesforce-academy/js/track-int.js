/* =====================================================================
   ORBIT · Integration
   window.TRACKS.int — modules: apis / outbound / events
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

  /* obApiPicker — which Salesforce integration mechanism fits this profile? */
  Widgets.obApiPicker = function (mount) {
    shell(mount, "decision", "Integration API picker",
      "Describe the flow: direction, volume, latency and coupling. The picker names the mechanism to start from, an alternative worth weighing, and the limit or caveat that will bite first.");
    var dir = "in", vol = "single", lat = "rt", cpl = "rr";
    var LABEL = {
      "in": "inbound", out: "outbound", single: "single records", thousands: "thousands/hour", millions: "millions per load",
      rt: "real-time", nrt: "near-real-time", nightly: "nightly batch", rr: "request-reply", ff: "fire-and-forget"
    };
    var API_LIMIT = "Each call counts against the org's rolling 24-hour API request allocation, shared by every integration.";
    var BULK = "Bulk jobs are asynchronous: the platform splits data into internal batches, triggers and flows still run per 200-record chunk, and ingest volume counts against a rolling 24-hour allocation.";
    var CALLOUT = "Per transaction: up to 100 callouts and 120 seconds of total callout time (10 s default per request); no callout after uncommitted DML; from triggers, call out from a Queueable.";
    var EVENTS = "High-volume events are retained for about 72 hours; subscribers store the last replay id, must be idempotent, and publishing and delivery count against event allocations.";
    function decide() {
      if (dir === "in") {
        if (vol === "millions" || lat === "nightly") {
          return { api: "Bulk API 2.0 ingest job (upsert on an external id)", tone: "ok",
            why: "Large or scheduled loads belong in an asynchronous job that the platform chunks and retries, not in millions of synchronous calls.",
            alt: vol === "millions" && lat !== "nightly" ? "stream events over the Pub/Sub API if the source emits changes continuously" : "middleware that schedules the job and reprocesses the failed-row file",
            caveat: (vol === "millions" && lat === "rt" ? "Millions of rows and real time do not go together: stage the load or stream changes instead. " : "") + BULK };
        }
        if (cpl === "ff") {
          return { api: "Platform events published through the Pub/Sub API or REST", tone: "ok",
            why: "The caller hands over a fact and moves on; subscribers in Apex or Flow process it in their own transaction with their own limits.",
            alt: vol === "thousands" ? "Composite API if the caller needs per-record results" : "REST API if the caller needs the record id back",
            caveat: EVENTS };
        }
        if (vol === "thousands") {
          return { api: "Composite API (sObject Collections, up to 200 records per call)", tone: "ok",
            why: "Batching related operations into one round trip cuts API consumption and latency, with all-or-none available when records depend on each other.",
            alt: lat === "nrt" ? "Bulk API 2.0 if a few minutes of delay is acceptable" : "a custom Apex REST endpoint if one call must run business logic",
            caveat: "A composite request carries up to 25 subrequests (collections up to 200 records) and counts as one API call. " + API_LIMIT };
        }
        return { api: "REST API (SOAP API for WSDL-bound clients)", tone: "ok",
          why: "One record, an answer needed now: the standard REST resources or an upsert by external id are the simplest contract and need no code in the org.",
          alt: "a custom Apex REST resource only if the operation needs server-side logic in one transaction",
          caveat: API_LIMIT };
      }
      if (vol === "millions" || lat === "nightly") {
        return { api: "Middleware or ETL extracting with a Bulk API 2.0 query job", tone: "warn",
          why: "Salesforce should not push millions of rows out through callouts; let the downstream side pull with an asynchronous query job on a schedule.",
          alt: lat === "nightly" ? "Change Data Capture to stream deltas between full extracts" : "Change Data Capture via the Pub/Sub API for the ongoing deltas",
          caveat: "Query jobs chunk large extracts automatically; still filter by a selective field such as SystemModstamp and keep an extract watermark. " + BULK };
      }
      if (cpl === "ff") {
        if (lat === "nrt") {
          return { api: "Change Data Capture consumed through the Pub/Sub API", tone: "ok",
            why: "Record changes are published by the platform after commit, with changed fields and change type in the header, so you write no publishing code.",
            alt: "a custom platform event when the message is a business fact rather than a record change",
            caveat: EVENTS };
        }
        return { api: "Platform events (publish after commit) via the Pub/Sub API", tone: "ok",
          why: "A business event published after commit reaches external subscribers within seconds and never announces work that rolled back.",
          alt: "Change Data Capture if subscribers only need record changes",
          caveat: EVENTS };
      }
      if (vol === "thousands") {
        return { api: "Apex callout via Named Credential from a Queueable, batched payloads", tone: "warn",
          why: "Request-reply at volume needs async execution and batched requests so you stay under per-transaction callout limits, with retries in a Finalizer.",
          alt: "middleware that accepts one event per change and handles fan-out, retries and throttling",
          caveat: CALLOUT };
      }
      return { api: "Apex callout via Named Credential", tone: "ok",
        why: "A single synchronous request with an answer needed now: the Named Credential supplies the endpoint and auth, and Apex handles the response.",
        alt: lat === "nrt" ? "a Queueable callout if the user need not wait" : "Continuation from an LWC if the remote side is slow",
        caveat: CALLOUT };
    }
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var r = decide();
      clear(stage);
      stage.appendChild(h("div", { class: "ob-grid" },
        h("div", { class: "ob-card is-on" }, h("h4", {}, r.api), h("div", {}, r.why)),
        h("div", { class: "ob-card" }, h("h4", {}, "Watch for"), h("div", {}, r.caveat))));
      stage.appendChild(h("div", { class: "ob-row", style: "margin-top:10px" },
        h("span", { class: "ob-chip " + r.tone }, r.tone === "ok" ? "standard fit" : "needs design care"),
        h("span", { class: "ob-chip" }, LABEL[dir]),
        h("span", { class: "ob-chip" }, LABEL[cpl])));
      clear(readout);
      readout.appendChild(ro("profile", LABEL[dir] + " · " + LABEL[vol] + " · " + LABEL[lat] + " · " + LABEL[cpl]));
      readout.appendChild(ro("start with", r.api));
      readout.appendChild(ro("also weigh", r.alt));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["in", "Inbound to Salesforce"], ["out", "Outbound from Salesforce"]], 0, function (v) { dir = v; paint(); }),
      segment([["single", "Single records"], ["thousands", "Thousands per hour"], ["millions", "Millions in a load"]], 0, function (v) { vol = v; paint(); }),
      segment([["rt", "Real-time"], ["nrt", "Near-real-time"], ["nightly", "Nightly batch"]], 0, function (v) { lat = v; paint(); }),
      segment([["rr", "Request-reply"], ["ff", "Fire-and-forget"]], 0, function (v) { cpl = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "int-apis": {
      title: "Platform APIs checkpoint",
      sub: "REST, SOAP, Composite, Bulk API 2.0 and custom Apex services.",
      questions: [
        { q: "A partner must create an Account and five Contacts in one round trip, and nothing should be saved if any record fails. Which API fits?",
          options: ["Bulk API 2.0", "SOAP API describeSObjects", "Composite API with allOrNone and reference ids linking the subrequests", "Streaming API"],
          answer: 2,
          explain: "Composite runs several dependent subrequests in one call, lets later steps reference the id created by an earlier one, and with allOrNone rolls everything back on failure. Bulk is asynchronous and has no cross-record transaction, and describe calls only return metadata." },
        { q: "A nightly feed upserts about four million rows from a warehouse. What is the right starting point?",
          options: ["A Bulk API 2.0 ingest job with upsert on an external id field", "The REST API, one call per row", "Composite requests of 25 subrequests each", "A custom Apex REST endpoint that loops over the rows"],
          answer: 0,
          explain: "Millions of rows on a schedule is exactly what asynchronous bulk jobs are for: the platform chunks the file, processes it in parallel and returns failed rows. Per-record calls would burn the daily API allocation, and an Apex endpoint would hit per-transaction limits." },
        { q: "Why do well-built inbound integrations upsert on an external id rather than insert?",
          options: ["External ids bypass validation rules", "Upsert is always faster than insert", "Every API call requires an external id", "Retries and replays become idempotent: the same source row matches the same record instead of creating a duplicate"],
          answer: 3,
          explain: "Integrations fail halfway and get retried. An external id gives each source row a stable key, so sending it twice updates the record instead of inserting a duplicate. Validation rules and automation still run on upsert." },
        { q: "How is a custom Apex REST resource declared under the house standard?",
          options: ["A public without sharing class annotated with RestResource", "A global with sharing class annotated @RestResource(urlMapping='/orders/v1/*')", "A public class whose methods are @AuraEnabled", "A class whose methods are @InvocableMethod"],
          answer: 1,
          explain: "Apex REST classes must be global so the platform can expose them, and the house standard keeps them with sharing so the integration user's record access applies. Putting a version in the URL mapping lets you evolve the contract without breaking callers." },
        { q: "Which statement about the org's API request allocation is accurate?",
          options: ["It is a rolling 24-hour allocation shared by all integrations, so one chatty client can starve the others", "It resets at midnight for each user separately", "Bulk API traffic never touches any allocation", "Integration users have no limit"],
          answer: 0,
          explain: "The allocation is org-wide and measured over a rolling 24 hours, sized by edition and licences. Every REST, SOAP and composite call draws from it, so give each integration its own user and monitor consumption per client." }
      ]
    },
    "int-outbound": {
      title: "Calling out checkpoint",
      sub: "Named and External Credentials, callout limits, retries and External Services.",
      questions: [
        { q: "Where should the client secret for the payments API live?",
          options: ["In a Custom Label read by the callout class", "In an External Credential principal, with access granted through a permission set, while Apex calls callout:Payments_API", "In a hierarchy custom setting", "In a static final String in a class excluded from source control"],
          answer: 1,
          explain: "The External Credential stores the authentication protocol and the principal's secret, entered per environment in Setup and never deployed in metadata. A permission set grants principal access, and code only references the Named Credential, so nothing secret appears in source." },
        { q: "An after-update trigger must notify an external system about changed records. Which pattern follows the house standard?",
          options: ["Call out directly inside the trigger", "Use @future(callout=true) as the default async mechanism", "Make a synchronous callout in a before trigger", "From the handler, enqueue a Queueable that implements Database.AllowsCallouts and carries the record ids"],
          answer: 3,
          explain: "Triggers cannot make synchronous callouts, and the house standard treats @future as legacy. A Queueable runs after commit with its own limits, can be chained and monitored, and pairs with a Finalizer for retries." },
        { q: "What is the cumulative callout time limit per Apex transaction?",
          options: ["10 seconds", "60 seconds", "120 seconds", "Unlimited in asynchronous Apex"],
          answer: 2,
          explain: "All callouts in one transaction share 120 seconds in total, while each request defaults to a 10 second timeout you can raise with setTimeout. Slow APIs therefore need async processing or a Continuation rather than longer waits." },
        { q: "A callout fails with You have uncommitted work pending. What caused it?",
          options: ["DML ran earlier in the same transaction before the callout", "The Named Credential is missing", "Too many SOQL queries were issued", "The endpoint returned a 500"],
          answer: 0,
          explain: "The platform will not hold database changes open while waiting on a remote system. Do the callout first and the DML after, or move the callout into a Queueable that runs after the commit." },
        { q: "What does registering an OpenAPI specification with External Services produce?",
          options: ["Lightning web components for each endpoint", "A custom object per schema", "Invocable actions and Apex types that call the API through a Named Credential, usable in Flow", "A middleware application"],
          answer: 2,
          explain: "External Services reads the specification, generates typed actions for the operations you select, and routes calls through a Named Credential. Admins can then call the API from Flow without hand-written Apex, within the spec features the service supports." }
      ]
    },
    "int-events": {
      title: "Event-driven integration checkpoint",
      sub: "Change Data Capture, platform events, replay and middleware patterns.",
      questions: [
        { q: "A warehouse needs every Opportunity change in near real time, including which fields changed. What is the best fit?",
          options: ["Poll the REST API every minute on LastModifiedDate", "An outbound message from a workflow rule", "A custom platform event published from a trigger", "Change Data Capture on Opportunity, consumed through the Pub/Sub API"],
          answer: 3,
          explain: "CDC publishes create, update, delete and undelete events after commit with a header listing the changed fields, and you write no publishing code. Polling burns API calls and misses deletes; a custom event duplicates what the platform already does." },
        { q: "A subscriber to high-volume events was offline for two days. How does it recover?",
          options: ["It cannot; events expire after one hour", "It resubscribes from its last stored replay id and receives the events still inside the roughly 72-hour retention window", "Salesforce emails the missed events", "It must re-read the whole object with Bulk API every time"],
          answer: 1,
          explain: "Each event carries a replay id. A subscriber that persists the last id it processed can resume from it and receive everything still retained, about three days for high-volume events. Beyond that window, fall back to a reconciliation extract." },
        { q: "An event announces that an order was committed. Which publish behaviour should the platform event use?",
          options: ["Publish After Commit, so subscribers never hear about an order that rolled back", "Publish Immediately, so subscribers hear about it sooner", "Either; behaviour makes no difference to subscribers", "Neither; lock the order row with FOR UPDATE instead"],
          answer: 0,
          explain: "Publish After Commit only releases the event if the transaction commits, which is what a fact about committed data needs. Publish Immediately suits logging or monitoring events that must go out even when the transaction fails." },
        { q: "In API-led connectivity, what are the three layers?",
          options: ["Bronze, silver and gold", "Controller, service and selector", "System, process and experience APIs", "Inbound, outbound and batch"],
          answer: 2,
          explain: "System APIs unlock individual back ends, process APIs compose them into business capabilities, and experience APIs shape data for a specific channel such as a portal or mobile app. Each layer can change without rewriting the others." },
        { q: "When does middleware earn its place in a Salesforce landscape?",
          options: ["Always, even for one callout to one API", "Never; point-to-point links scale fine", "Only for bulk data loads", "When many systems need transformation, orchestration, retries and monitoring that would otherwise be rebuilt in every point-to-point link"],
          answer: 3,
          explain: "Middleware adds a hop, a platform and a team to run it, so one simple integration rarely justifies it. Once several systems exchange data, central transforms, retries, dead-letter handling and monitoring cost less than duplicating them in each link." }
      ]
    }
  });

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "int-data": {
      title: "Data loading checkpoint",
      sub: "Tools, upserts with external IDs, load order and lock contention.",
      questions: [
        { q: "A migration loads Contacts that belong to Accounts loaded earlier from the same legacy system. How should each Contact row reference its Account?",
          options: ["By the Salesforce Account Id copied from a spreadsheet lookup", "By Account name", "By the parent's external ID, in a relationship column such as Account.Legacy_Id__c", "By leaving AccountId blank and fixing it later"], answer: 2,
          explain: "Upsert can resolve parents through an external ID in a relationship column, so you never need to map Salesforce Ids by hand. Names are not unique, and VLOOKUP-style Id mapping is slow and error-prone. Reloading becomes idempotent too." },
        { q: "Why is upsert on an external ID safer than insert for repeatable loads?",
          options: ["Upsert is faster than insert", "Rerunning the same file updates existing rows instead of creating duplicates", "Upsert bypasses validation rules", "Upsert does not count against API limits"], answer: 1,
          explain: "Matching on a unique external ID makes the load idempotent: a retry after a partial failure updates what already exists. Insert would duplicate every row that succeeded the first time. Validation and limits still apply." },
        { q: "A load of child records fails with UNABLE_TO_LOCK_ROW on their parents. What usually helps first?",
          options: ["Sort the file by parent Id so each batch touches fewer parents, or run in serial mode", "Increase the batch size to 10,000", "Disable all sharing rules permanently", "Split the file randomly into more files and run them all at once"], answer: 0,
          explain: "Parallel batches that touch the same parent contend for its lock, especially with roll-ups or skew. Grouping children by parent keeps each parent in one batch; serial processing removes contention at the cost of speed. Random parallel splits make it worse." },
        { q: "An admin needs to import 8,000 Leads once with duplicate matching and no tooling to install. Which tool fits?",
          options: ["Bulk API 2.0 from a custom script", "An Apex batch job", "A Change Data Capture subscriber", "The Data Import Wizard"], answer: 3,
          explain: "The Data Import Wizard runs in the browser, handles up to 50,000 records for supported objects and can match duplicates. Data Loader and the Bulk API suit larger or repeated loads and objects the wizard does not support." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.int = {
    id: "int",
    name: "Integration",
    short: "INT",
    tagline: "Move data in, out and across without breaking limits",
    color: "#a78bfa",
    blurb: "Choose and build Salesforce integrations deliberately: REST, SOAP, Composite and Bulk API 2.0 for inbound traffic, custom Apex services when logic must run server-side, Named and External Credentials for secret-free callouts, resilient async callouts with retries, External Services for declarative clients, and Change Data Capture, platform events and middleware for event-driven designs.",
    modules: [
      {
        id: "apis",
        name: "Platform APIs",
        icon: "plug",
        lessons: [
          {
            id: "rest-soap",
            title: "REST and SOAP APIs",
            summary: "The standard front doors into an org, how callers authenticate, and how to pick between REST, SOAP and Composite.",
            minutes: 10,
            tags: ["rest", "soap", "composite"],
            blocks: [
              { t: "p", html: "Every Salesforce object is reachable through several <strong>front doors over the same data model</strong>, and none of them needs code in the org. Choose the door by the caller's shape (JSON client or WSDL-bound enterprise tool), the number of records per interaction, and whether it needs an answer now." },
              { t: "table", headers: ["API", "Best for", "Shape"], rows: [
                ["REST API", "Single-record CRUD, queries, mobile and web clients", "JSON resources under <code class='tok'>/services/data/vNN.N/</code>"],
                ["SOAP API", "Contract-first enterprise tools that generate clients from a WSDL", "Enterprise WSDL (typed to your org) or Partner WSDL (generic)"],
                ["Composite family", "Several related operations in one round trip", "Up to 25 subrequests; sObject Collections up to 200 records"],
                ["Bulk API 2.0", "Large asynchronous loads and extracts", "CSV jobs; see <code class='tok'>#/int/apis/bulk-api</code>"],
                ["Pub/Sub API", "Publishing and subscribing to event streams", "gRPC with replay ids"]
              ] },
              { t: "code", lang: "text", code:
                "# read one record by external id\n" +
                "GET   /services/data/v62.0/sobjects/Account/External_Id__c/ACME-001\n\n" +
                "# idempotent upsert by external id (creates or updates)\n" +
                "PATCH /services/data/v62.0/sobjects/Account/External_Id__c/ACME-001\n" +
                "      body: { \"Name\": \"Acme Ltd\", \"Industry\": \"Manufacturing\" }\n\n" +
                "# SOQL over REST, URL-encoded\n" +
                "GET   /services/data/v62.0/query?q=SELECT+Id,Name+FROM+Account+WHERE+Industry='Manufacturing'"
              },
              { t: "code", lang: "text", code:
                'POST /services/data/v62.0/composite\n' +
                '{\n' +
                '  "allOrNone": true,\n' +
                '  "compositeRequest": [\n' +
                '    { "method": "PATCH", "referenceId": "acct",\n' +
                '      "url": "/services/data/v62.0/sobjects/Account/External_Id__c/ACME-001",\n' +
                '      "body": { "Name": "Acme Ltd" } },\n' +
                '    { "method": "POST", "referenceId": "contact1",\n' +
                '      "url": "/services/data/v62.0/sobjects/Contact",\n' +
                '      "body": { "LastName": "Rivera", "AccountId": "@{acct.id}" } }\n' +
                '  ]\n' +
                '}'
              },
              { t: "note", variant: "warn", html: "Pin the API version in every caller and upgrade deliberately. A version is a contract: field behaviour and defaults can change between versions, and an unpinned client silently changes behaviour when someone edits a base URL." },
              { t: "h", text: "Authenticating inbound callers" },
              { t: "ul", items: [
                "Register the caller as a connected app (or the newer external client app) and use an OAuth 2.0 server-to-server flow such as JWT bearer or client credentials.",
                "Run each integration as its own <strong>integration user</strong> with the API Only permission and a minimal permission set, so access and API consumption are attributable.",
                "Keep keys and secrets in the caller's vault; the org stores only the certificate or consumer configuration, referenced as <code class='tok'>&lt;consumer-key&gt;</code> in runbooks.",
                "Avoid the username-password OAuth flow and shared human logins; they cannot be rotated or audited per integration."
              ] },
              { t: "note", variant: "trap", html: "An integration user with the System Administrator profile is the most common finding in integration reviews. One leaked token then reads and deletes everything. Grant object and field access for exactly the records the integration moves." },
              { t: "stat", items: [
                { v: "25", k: "subrequests per composite call" },
                { v: "200", k: "records per sObject Collections call" },
                { v: "24 h", k: "rolling window for the org's API allocation" }
              ] },
              { t: "table", headers: ["Tier", "Inbound design", "What it costs"], rows: [
                ["Naive", "Admin user, insert per record, no external ids", "Duplicates on retry, API allocation drained, huge blast radius"],
                ["Solid", "Dedicated integration user, upsert by external id, pinned version", "Idempotent and attributable; one call per record still"],
                ["Standout", "Least-privilege integration user per system, Composite or Collections for related records, Bulk for volume, monitored API usage", "Fewer calls, clean retries, and a clear owner for every request"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> an external app that creates or reads a few records at a time, a legacy enterprise tool that wants a WSDL, a parent and its children saved together, or duplicates appearing after integration retries." },
              { t: "note", variant: "key", html: "<strong>Pick the door by caller shape and records per call.</strong> REST for single JSON operations, SOAP for WSDL clients, Composite for related records in one round trip, always with an upsert key, a pinned version and a least-privilege integration user." }
            ]
          },
          {
            id: "bulk-api",
            title: "Bulk API 2.0 and large data volumes",
            summary: "How asynchronous ingest and query jobs work, and how to load millions of rows without lock storms or automation surprises.",
            minutes: 10,
            tags: ["bulk-api", "data-loading", "ldv"],
            blocks: [
              { t: "p", html: "Bulk API 2.0 turns a load into a <strong>job you hand over and poll</strong>. You upload a CSV, mark the upload complete, and the platform splits the data into internal batches, processes them in parallel and keeps per-row results. You trade immediacy for throughput." },
              { t: "ol", items: [
                "Create an ingest job naming the object, the operation (insert, update, upsert, delete) and, for upsert, the external id field.",
                "Upload the CSV data to the job.",
                "Patch the job state to <code class='tok'>UploadComplete</code>; processing starts.",
                "Poll the job until it is <code class='tok'>JobComplete</code> or <code class='tok'>Failed</code>.",
                "Download the successful, failed and unprocessed result sets and reprocess failures."
              ] },
              { t: "code", lang: "text", code:
                'POST  /services/data/v62.0/jobs/ingest\n' +
                '      { "object": "Account", "operation": "upsert",\n' +
                '        "externalIdFieldName": "External_Id__c", "contentType": "CSV", "lineEnding": "LF" }\n' +
                'PUT   /services/data/v62.0/jobs/ingest/<job-id>/batches      (CSV body)\n' +
                'PATCH /services/data/v62.0/jobs/ingest/<job-id>              { "state": "UploadComplete" }\n' +
                'GET   /services/data/v62.0/jobs/ingest/<job-id>              (poll numberRecordsProcessed / Failed)\n' +
                'GET   /services/data/v62.0/jobs/ingest/<job-id>/failedResults'
              },
              { t: "code", lang: "bash", code:
                "# the same load from the sf CLI against a sandbox alias\n" +
                "sf data upsert bulk --sobject Account --file accounts.csv \\\n" +
                "  --external-id External_Id__c --wait 15 --target-org uat\n\n" +
                "# extract with an asynchronous query job\n" +
                "sf data export bulk --query \"SELECT Id, External_Id__c, Name FROM Account\" \\\n" +
                "  --output-file accounts-extract.csv --wait 15 --target-org uat"
              },
              { t: "table", headers: ["Knob", "Why it matters"], rows: [
                ["Upsert on an external id", "Reruns update instead of duplicating; failed rows can be resent as-is"],
                ["Sort rows by parent id", "Children of one parent land in the same chunk, which avoids record-lock contention on the parent"],
                ["Automation cost per chunk", "Triggers and flows run per 200-record chunk, so a heavy trigger multiplies across the job"],
                ["Bypass switch for non-essential automation", "A custom permission assigned to the integration user, checked in handlers and flow entry criteria"],
                ["Sharing recalculation", "Owner and role changes at volume can queue long recalculations; load owners first or defer"]
              ] },
              { t: "note", variant: "warn", html: "<code class='tok'>UNABLE_TO_LOCK_ROW</code> during a load usually means many parallel chunks are updating children of the same parent, which locks the parent row. Sort the file by parent id, reduce parent-touching automation, and retry only the failed rows." },
              { t: "note", variant: "tip", html: "Bulk API 2.0 ingest allows up to 150 million records per rolling 24 hours, and one job's upload can be at most 150 MB after base64 encoding, so keep raw CSV files to roughly 100 MB. Bulk API 1.0 counts batches instead (15,000 per rolling 24 hours). Split very large files and confirm current figures on the limits page before promising a load window." },
              { t: "table", headers: ["Tier", "Loading five million rows", "Outcome"], rows: [
                ["Naive", "REST call per row from a script, all automation on", "Days of runtime, allocation exhausted, duplicates on rerun"],
                ["Solid", "Bulk API 2.0 upsert on an external id, failed rows reprocessed", "Hours, idempotent, recoverable"],
                ["Standout", "Bulk upsert sorted by parent, automation bypass by custom permission, owners loaded first, rehearsed in a full sandbox with timings", "Predictable cutover window and a tested rollback"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> a migration or nightly feed in the hundreds of thousands of rows or more, a warehouse extract, lock errors during loads, or a load that triggers so much automation it times out." },
              { t: "note", variant: "key", html: "<strong>Volume means jobs, not calls.</strong> Upsert on an external id, sort by parent, budget automation per 200-record chunk, and rehearse the load in a full sandbox before production." }
            ]
          },
          {
            id: "custom-apis",
            title: "Custom Apex REST and SOAP services",
            summary: "When a custom endpoint is justified, how to build one that is secure and bulk-safe, and how to keep its contract stable.",
            minutes: 11,
            tags: ["apex-rest", "soap", "api-design"],
            blocks: [
              { t: "p", html: "A custom endpoint is <strong>a controller for machines</strong>. Build one only when a caller needs several steps to happen in one transaction, a payload shape that does not match your objects, or logic the standard APIs cannot run. Otherwise the standard APIs are free, documented and already secure." },
              { t: "table", headers: ["Situation", "Use"], rows: [
                ["Create or update records that map one-to-one to objects", "Standard REST, Composite or Bulk"],
                ["Validate, transform and write several objects atomically", "Custom Apex REST"],
                ["An enterprise client that only consumes WSDL contracts", "Custom Apex SOAP <code class='tok'>webservice</code>"],
                ["Expose a calculation, not data", "Custom Apex REST"]
              ] },
              { t: "code", lang: "java", code:
                "/**\n" +
                " * @description Inbound order API for the commerce platform. LAYER: Controller. SHARING: with sharing.\n" +
                " */\n" +
                "@RestResource(urlMapping='/orders/v1/*')\n" +
                "global with sharing class OrderResource {\n" +
                "    private static final String CLS = 'OrderResource';\n\n" +
                "    @HttpPost\n" +
                "    global static void upsertOrders() {\n" +
                "        RestResponse res = RestContext.response;\n" +
                "        res.addHeader('Content-Type', 'application/json');\n" +
                "        try {\n" +
                "            List<OrderDto> body = (List<OrderDto>) JSON.deserializeStrict(\n" +
                "                RestContext.request.requestBody.toString(), List<OrderDto>.class);\n" +
                "            if (body == null || body.isEmpty() || body.size() > 200) {\n" +
                "                res.statusCode = 400;\n" +
                "                res.responseBody = Blob.valueOf(JSON.serialize(new ApiError('BAD_REQUEST', 'Send 1 to 200 orders')));\n" +
                "                return;\n" +
                "            }\n" +
                "            // service validates, maps and upserts on External_Id__c with AccessLevel.USER_MODE\n" +
                "            List<OrderResult> results = OrderService.getInstance().upsertFromApi(body);\n" +
                "            res.statusCode = 200;\n" +
                "            res.responseBody = Blob.valueOf(JSON.serialize(results));\n" +
                "        } catch (JSONException ex) {\n" +
                "            res.statusCode = 400;\n" +
                "            res.responseBody = Blob.valueOf(JSON.serialize(new ApiError('BAD_JSON', 'Payload does not match the contract')));\n" +
                "        } catch (Exception ex) {\n" +
                "            res.statusCode = 500;   // log details internally; never echo the exception\n" +
                "            res.responseBody = Blob.valueOf(JSON.serialize(new ApiError('SERVER_ERROR', 'Internal error')));\n" +
                "        }\n" +
                "    }\n\n" +
                "    global class OrderDto { public String externalId; public String accountExternalId; public Decimal amount; }\n" +
                "    global class OrderResult { public String externalId; public Boolean success; public String message; }\n" +
                "    global class ApiError {\n" +
                "        public String code; public String message;\n" +
                "        public ApiError(String code, String message) { this.code = code; this.message = message; }\n" +
                "    }\n" +
                "}"
              },
              { t: "code", lang: "java", code:
                "/** @description SOAP credit check for the legacy ERP. Exposed through a generated WSDL. */\n" +
                "global with sharing class CreditCheckService {\n" +
                "    global class CreditRequest {\n" +
                "        webservice String accountNumber;\n" +
                "        webservice Decimal amount;\n" +
                "    }\n" +
                "    global class CreditResult {\n" +
                "        webservice Boolean approved;\n" +
                "        webservice String reason;\n" +
                "    }\n\n" +
                "    webservice static CreditResult check(CreditRequest request) {\n" +
                "        return CreditService.getInstance().evaluate(request);\n" +
                "    }\n" +
                "}"
              },
              { t: "note", variant: "warn", html: "The endpoint runs as the integration user, so <code class='tok'>with sharing</code> plus user-mode queries and DML make that user's permissions the real boundary. A <code class='tok'>without sharing</code> endpoint turns every caller into an administrator for the data it touches." },
              { t: "h", text: "Contract rules" },
              { t: "ul", items: [
                "Version in the URL mapping (<code class='tok'>/orders/v1/*</code>) and add <code class='tok'>v2</code> beside it rather than changing v1's behaviour.",
                "Accept lists, cap the size, and do one query and one DML for the whole payload; never query or write per item.",
                "Make writes idempotent with external ids so a retried request does not duplicate.",
                "Return a consistent error envelope with a code and safe message; log stack traces internally only.",
                "Bind every caller-supplied value (static binds or <code class='tok'>Database.queryWithBinds</code>); escaping strings is the last resort."
              ] },
              { t: "code", lang: "text", code:
                'POST /services/apexrest/orders/v1/\n' +
                '[ { "externalId": "ORD-1001", "accountExternalId": "ACME-001", "amount": 1250.00 } ]\n\n' +
                '200 OK\n' +
                '[ { "externalId": "ORD-1001", "success": true, "message": "upserted" } ]'
              },
              { t: "table", headers: ["Tier", "Custom endpoint", "Why"], rows: [
                ["Naive", "without sharing, one record per call, raw exception text returned", "Over-privileged, chatty and leaks internals"],
                ["Solid", "with sharing, list payload, user-mode service, error envelope", "Secure, bulk-safe and predictable"],
                ["Standout", "Versioned contract, strict deserialisation, idempotent upserts, per-item results, contract tests in CI", "Callers can retry safely and evolve independently"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> a partner that sends a payload unlike your data model, several objects that must save atomically from one call, an ERP that insists on WSDL, or a request to expose a calculation to another system." },
              { t: "quiz", id: "int-apis" },
              { t: "note", variant: "key", html: "<strong>A custom endpoint is a thin, versioned controller over a bulk-safe service.</strong> global with sharing, list payloads, user-mode access, idempotent upserts and a stable error envelope." }
            ]
          }
        ]
      },
      {
        id: "outbound",
        name: "Calling Out",
        icon: "globe",
        lessons: [
          {
            id: "named-credentials",
            title: "Named and external credentials",
            summary: "The two-layer credential model that keeps endpoints and secrets out of code and lets permission sets control who can call out.",
            minutes: 10,
            tags: ["named-credentials", "external-credentials", "oauth"],
            blocks: [
              { t: "p", html: "Split every outbound connection into <strong>where</strong> and <strong>how</strong>. The Named Credential says where: base URL and callout options. The External Credential says how: the authentication protocol and one or more principals holding the secret. A permission set says <strong>who</strong> may use a principal. Code only ever names the Named Credential." },
              { t: "table", headers: ["Piece", "Holds", "Lives in"], rows: [
                ["Named Credential", "Base URL, header and merge-field options, link to an External Credential", "Metadata, deployable"],
                ["External Credential", "Protocol (OAuth, JWT, custom headers, AWS signature) and named principals", "Metadata, deployable without secrets"],
                ["Principal secret", "Client secret, key or password", "Entered in Setup per environment; never in source"],
                ["Permission set", "External credential principal access", "Assigned to the users or integration user that call out"]
              ] },
              { t: "code", lang: "text", code:
                '<!-- namedCredentials/Payments_API.namedCredential-meta.xml (abridged) -->\n' +
                '<NamedCredential>\n' +
                '    <label>Payments API</label>\n' +
                '    <namedCredentialType>SecuredEndpoint</namedCredentialType>\n' +
                '    <generateAuthorizationHeader>true</generateAuthorizationHeader>\n' +
                '    <allowMergeFieldsInHeader>false</allowMergeFieldsInHeader>\n' +
                '    <allowMergeFieldsInBody>false</allowMergeFieldsInBody>\n' +
                '    <namedCredentialParameters>\n' +
                '        <parameterName>Url</parameterName>\n' +
                '        <parameterType>Url</parameterType>\n' +
                '        <parameterValue>https://api.payments.example/v1</parameterValue>\n' +
                '    </namedCredentialParameters>\n' +
                '    <namedCredentialParameters>\n' +
                '        <externalCredential>Payments_OAuth</externalCredential>\n' +
                '        <parameterName>ExternalCredential</parameterName>\n' +
                '        <parameterType>Authentication</parameterType>\n' +
                '    </namedCredentialParameters>\n' +
                '</NamedCredential>'
              },
              { t: "code", lang: "text", code:
                '<!-- externalCredentials/Payments_OAuth.externalCredential-meta.xml (abridged; no secret inside) -->\n' +
                '<ExternalCredential>\n' +
                '    <label>Payments OAuth</label>\n' +
                '    <authenticationProtocol>Oauth</authenticationProtocol>\n' +
                '    <externalCredentialParameters>\n' +
                '        <parameterName>PaymentsService</parameterName>\n' +
                '        <parameterType>NamedPrincipal</parameterType>\n' +
                '        <sequenceNumber>1</sequenceNumber>\n' +
                '    </externalCredentialParameters>\n' +
                '</ExternalCredential>\n\n' +
                '<!-- permissionsets/Payments_Integration.permissionset-meta.xml (excerpt) -->\n' +
                '<externalCredentialPrincipalAccesses>\n' +
                '    <enabled>true</enabled>\n' +
                '    <externalCredentialPrincipal>Payments_OAuth-PaymentsService</externalCredentialPrincipal>\n' +
                '</externalCredentialPrincipalAccesses>'
              },
              { t: "code", lang: "java", code:
                "HttpRequest req = new HttpRequest();\n" +
                "req.setEndpoint('callout:Payments_API/charges');   // URL and auth come from the credentials\n" +
                "req.setMethod('POST');\n" +
                "req.setHeader('Content-Type', 'application/json');\n" +
                "req.setBody(JSON.serialize(chargeRequest));\n" +
                "HttpResponse res = new Http().send(req);"
              },
              { t: "note", variant: "warn", html: "Metadata carries the shape of the credential, never the secret. Each sandbox and production gets its own principal value entered by an administrator, ideally a different client registered with the provider per environment, so a sandbox refresh cannot leak production access." },
              { t: "note", variant: "trap", html: "Legacy single-layer Named Credentials still work but are in maintenance mode, and they cannot express per-permission-set principals. Build new integrations on the External Credential model and migrate old ones when you next touch them." },
              { t: "table", headers: ["Tier", "Outbound auth", "Risk"], rows: [
                ["Naive", "Endpoint and API key in a custom setting or label, read by Apex", "Readable by admins, copied into every sandbox, unrotatable"],
                ["Solid", "Named Credential plus External Credential, secret entered in Setup", "No secrets in code; endpoint changes without deploys"],
                ["Standout", "Separate principals per environment, access by permission set only to the integration user, rotation runbook, merge fields disabled", "Least privilege, auditable, and a refresh cannot cross environments"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> an endpoint URL or token in Apex or configuration, a callout that works for admins but fails for users (missing principal access), a sandbox that calls the production API, or a secret rotation that needs a deployment." },
              { t: "note", variant: "key", html: "<strong>Where, how and who: Named Credential, External Credential, permission set.</strong> Code says <code class='tok'>callout:Payments_API/...</code>; secrets are entered per environment and never deployed." }
            ]
          },
          {
            id: "callouts",
            title: "Apex callouts, timeouts and retries",
            summary: "The limits a callout lives inside, how to call out from triggers, and how to retry safely with idempotency and Finalizers.",
            minutes: 11,
            tags: ["callouts", "queueable", "resilience"],
            blocks: [
              { t: "p", html: "A callout <strong>borrows time from a transaction that cannot wait forever</strong>. The remote system is slower and less reliable than the database, so design every callout assuming it will time out, fail halfway or succeed twice." },
              { t: "stat", items: [
                { v: "100", k: "callouts per transaction" },
                { v: "120 s", k: "total callout time per transaction" },
                { v: "10 s", k: "default timeout per request" }
              ] },
              { t: "code", lang: "java", code:
                "/** @description Client for the payments API. SHARING: with sharing. */\n" +
                "public with sharing class PaymentsClient {\n" +
                "    public class PaymentsException extends Exception {}\n" +
                "    private static final Integer TIMEOUT_MS = 20000;\n\n" +
                "    /** @description Creates charges in one batched request; the key makes retries safe. */\n" +
                "    public static List<ChargeResult> createCharges(List<ChargeRequest> charges, String idempotencyKey) {\n" +
                "        HttpRequest req = new HttpRequest();\n" +
                "        req.setEndpoint('callout:Payments_API/charges/batch');\n" +
                "        req.setMethod('POST');\n" +
                "        req.setTimeout(TIMEOUT_MS);\n" +
                "        req.setHeader('Content-Type', 'application/json');\n" +
                "        req.setHeader('Idempotency-Key', idempotencyKey);\n" +
                "        req.setBody(JSON.serialize(charges));\n" +
                "        HttpResponse res = new Http().send(req);\n" +
                "        Integer code = res.getStatusCode();\n" +
                "        if (code >= 200 && code < 300) {\n" +
                "            return (List<ChargeResult>) JSON.deserialize(res.getBody(), List<ChargeResult>.class);\n" +
                "        }\n" +
                "        throw new PaymentsException('Payments API returned ' + code);  // body logged, not surfaced\n" +
                "    }\n" +
                "}"
              },
              { t: "code", lang: "java", code:
                "public with sharing class ChargeSyncJob implements Queueable, Database.AllowsCallouts {\n" +
                "    private final List<Id> paymentIds;\n" +
                "    private final Integer attempt;\n\n" +
                "    public ChargeSyncJob(List<Id> paymentIds, Integer attempt) {\n" +
                "        this.paymentIds = paymentIds;\n" +
                "        this.attempt = attempt;\n" +
                "    }\n\n" +
                "    public void execute(QueueableContext ctx) {\n" +
                "        System.attachFinalizer(new ChargeSyncFinalizer(paymentIds, attempt));\n" +
                "        List<Payment__c> payments = PaymentSelector.newInstance().selectByIds(new Set<Id>(paymentIds));\n" +
                "        List<ChargeResult> results = PaymentsClient.createCharges(\n" +
                "            ChargeMapper.toRequests(payments), ChargeMapper.batchKey(paymentIds));  // one callout, not one per record\n" +
                "        PaymentService.getInstance().applyResults(results);                       // DML after the callout\n" +
                "    }\n" +
                "}\n\n" +
                "public with sharing class ChargeSyncFinalizer implements Finalizer {\n" +
                "    private static final Integer MAX_ATTEMPTS = 3;\n" +
                "    private final List<Id> paymentIds;\n" +
                "    private final Integer attempt;\n" +
                "    public ChargeSyncFinalizer(List<Id> paymentIds, Integer attempt) { this.paymentIds = paymentIds; this.attempt = attempt; }\n\n" +
                "    public void execute(FinalizerContext ctx) {\n" +
                "        if (ctx.getResult() == ParentJobResult.UNHANDLED_EXCEPTION && attempt < MAX_ATTEMPTS) {\n" +
                "            System.enqueueJob(new ChargeSyncJob(paymentIds, attempt + 1), attempt * 2);  // delay in minutes\n" +
                "        }\n" +
                "    }\n" +
                "}"
              },
              { t: "table", headers: ["Failure", "Handling"], rows: [
                ["Timeout or connection reset", "Retry with backoff using the same idempotency key; the remote side de-duplicates"],
                ["5xx", "Retry a bounded number of times, then park the work and alert"],
                ["429 rate limited", "Back off; honour any retry-after hint; shrink batch sizes"],
                ["4xx validation error", "Do not retry; record the error on the source record for a human"],
                ["<code class='tok'>You have uncommitted work pending</code>", "Callout after DML in one transaction; call out first or move it to a Queueable"]
              ] },
              { t: "note", variant: "trap", html: "Triggers cannot make synchronous callouts, and the house standard treats <code class='tok'>@future(callout=true)</code> as legacy. Collect record ids in the handler and enqueue one Queueable for the batch; a Queueable can be monitored, chained, and given a Finalizer." },
              { t: "code", lang: "java", code:
                "@IsTest\n" +
                "private class PaymentsClientTest {\n" +
                "    private class ChargeOkMock implements HttpCalloutMock {\n" +
                "        public HttpResponse respond(HttpRequest req) {\n" +
                "            Assert.isTrue(req.getEndpoint().startsWith('callout:Payments_API/'), 'callouts must use the named credential');\n" +
                "            Assert.isNotNull(req.getHeader('Idempotency-Key'), 'every charge request needs an idempotency key');\n" +
                "            HttpResponse res = new HttpResponse();\n" +
                "            res.setStatusCode(200);\n" +
                "            res.setBody('[{\"externalId\":\"PAY-1\",\"status\":\"succeeded\"}]');\n" +
                "            return res;\n" +
                "        }\n" +
                "    }\n\n" +
                "    @IsTest\n" +
                "    static void createCharges_success_returnsResults() {\n" +
                "        Test.setMock(HttpCalloutMock.class, new ChargeOkMock());\n" +
                "        Test.startTest();\n" +
                "        List<ChargeResult> results = PaymentsClient.createCharges(new List<ChargeRequest>{ new ChargeRequest() }, 'batch-1');\n" +
                "        Test.stopTest();\n" +
                "        Assert.areEqual(1, results.size(), 'one result per submitted charge');\n" +
                "    }\n" +
                "}"
              },
              { t: "table", headers: ["Tier", "Callout design", "Behaviour under failure"], rows: [
                ["Naive", "Synchronous callout per record, default timeout, no retry", "Hits limits at 100 records; failures silently lost"],
                ["Solid", "Queueable with batched requests, explicit timeout, status handling", "Within limits; failures logged"],
                ["Standout", "Idempotency keys, Finalizer retries with backoff, parked-work queue, circuit breaker in custom metadata, mocked tests per status", "Safe to retry, observable, and degrades instead of cascading"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> a trigger that must notify another system, a slow partner API, duplicate charges after a timeout, or the uncommitted work pending error." },
              { t: "note", variant: "key", html: "<strong>Assume the remote side is slow, flaky and sometimes succeeds twice.</strong> Batch requests, set timeouts, call out before DML or from a Queueable, retry with the same idempotency key, and test every status with a mock." }
            ]
          },
          {
            id: "external-services",
            title: "External Services and declarative callouts",
            summary: "Generate typed actions from an OpenAPI spec so Flow can call APIs, and know when hand-written Apex is still the better tool.",
            minutes: 9,
            tags: ["external-services", "openapi", "flow"],
            blocks: [
              { t: "p", html: "External Services is a <strong>client generator</strong>. You give it an OpenAPI specification and a Named Credential; it generates typed invocable actions for the operations you pick, and admins call the API from Flow like any other action. The credential model from <code class='tok'>#/int/outbound/named-credentials</code> still does the authentication." },
              { t: "ol", items: [
                "Create the Named Credential and External Credential for the API.",
                "Register the OpenAPI specification (pasted or uploaded) as an External Service against that Named Credential.",
                "Select the operations to expose; the platform generates actions and Apex types for their request and response schemas.",
                "Use the actions in Flow, with a fault path for errors, or call them from Apex through the generated types."
              ] },
              { t: "code", lang: "text", code:
                "openapi: 3.0.0\n" +
                "info: { title: Payments, version: '1.0' }\n" +
                "paths:\n" +
                "  /charges:\n" +
                "    post:\n" +
                "      operationId: createCharge\n" +
                "      requestBody:\n" +
                "        content:\n" +
                "          application/json:\n" +
                "            schema:\n" +
                "              type: object\n" +
                "              properties:\n" +
                "                externalId: { type: string }\n" +
                "                amount: { type: number }\n" +
                "      responses:\n" +
                "        '201':\n" +
                "          description: created\n" +
                "          content:\n" +
                "            application/json:\n" +
                "              schema: { type: object, properties: { status: { type: string } } }"
              },
              { t: "table", headers: ["Option", "Best when", "Watch for"], rows: [
                ["External Services", "A documented API with a clean OpenAPI spec, called from Flow", "Schema features it cannot map; spec updates need re-registration"],
                ["Flow HTTP Callout action", "A simple API with no spec, configured from a sample response", "Simplicity limits: little control over retries and complex payloads"],
                ["Apex callout", "Batching, idempotency keys, custom retry, complex transforms", "Code and tests to maintain"]
              ] },
              { t: "note", variant: "warn", html: "Not every OpenAPI construct maps cleanly: deeply polymorphic schemas, unusual content types and very large specs may be rejected or simplified. Register only the operations you need, and trim the spec rather than fighting the importer." },
              { t: "note", variant: "tip", html: "Every Flow element that calls an external action needs a fault path that records the error on the triggering record or a log object. A record-triggered flow that calls out must do it on an asynchronous path, because callouts cannot run inside the save transaction." },
              { t: "table", headers: ["Tier", "Declarative integration", "Outcome"], rows: [
                ["Naive", "Flow callout with no fault path, credentials pasted into a text field", "Silent failures and a leaked key"],
                ["Solid", "External Service on a Named Credential, fault paths logging errors", "Admin-owned, secret-free and visible when it fails"],
                ["Standout", "Trimmed spec with only needed operations, async path for record-triggered calls, Apex for batching or idempotency needs", "Each tool used where it is strongest"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> an admin team that wants to call a documented API without Apex, a vendor that ships an OpenAPI file, or a request to add a simple lookup call to an existing flow." },
              { t: "quiz", id: "int-outbound" },
              { t: "note", variant: "key", html: "<strong>External Services turns a spec plus a Named Credential into Flow actions.</strong> Use it for clean, documented APIs with fault paths; switch to Apex when you need batching, idempotency or custom retry." }
            ]
          }
        ]
      },
      {
        id: "events",
        name: "Event-Driven",
        icon: "queue",
        lessons: [
          {
            id: "cdc-events",
            title: "Change Data Capture and events for integration",
            summary: "Publish record changes and business events to external subscribers, and choose the right mechanism for each integration profile.",
            minutes: 12,
            tags: ["cdc", "platform-events", "pub-sub-api"],
            blocks: [
              { t: "p", html: "Events invert the integration: instead of Salesforce calling every system, it <strong>announces what happened</strong> and each subscriber pulls the stream at its own pace. Change Data Capture announces record changes automatically; platform events announce business facts you publish yourself. Both are retained for a while, so a subscriber that was down can catch up." },
              { t: "diagram", id: "integration-patterns", caption: "One system of record: inbound REST or SOAP, Bulk API 2.0 loads, outbound callouts through a Named Credential, change and platform events to subscribers, and middleware orchestrating across them." },
              { t: "widget", id: "obApiPicker" },
              { t: "table", headers: ["Mechanism", "What is published", "Best for"], rows: [
                ["Change Data Capture", "Create, update, delete, undelete of enabled objects, with changed fields in the header", "Keeping external copies in sync without publishing code"],
                ["Platform events", "Custom event fields you define and publish", "Business facts: order shipped, credit approved"],
                ["Polling the REST API", "Whatever the query returns", "Rarely: burns API calls and misses deletes"]
              ] },
              { t: "code", lang: "java", code:
                "trigger OpportunityChangeEventTrigger on OpportunityChangeEvent (after insert) {\n" +
                "    OpportunityChangeHandler.handle(Trigger.new);\n" +
                "}\n\n" +
                "public with sharing class OpportunityChangeHandler {\n" +
                "    public static void handle(List<OpportunityChangeEvent> events) {\n" +
                "        Set<Id> stageChanged = new Set<Id>();\n" +
                "        for (OpportunityChangeEvent evt : events) {\n" +
                "            EventBus.ChangeEventHeader header = evt.ChangeEventHeader;\n" +
                "            if (header.getChangeType() == 'UPDATE' && header.getChangedFields().contains('StageName')) {\n" +
                "                for (String recordId : header.getRecordIds()) { stageChanged.add(Id.valueOf(recordId)); }\n" +
                "            }\n" +
                "        }\n" +
                "        if (!stageChanged.isEmpty()) {\n" +
                "            System.enqueueJob(new StageSyncJob(new List<Id>(stageChanged)));  // one job for the batch\n" +
                "        }\n" +
                "    }\n" +
                "}"
              },
              { t: "code", lang: "java", code:
                "List<Order_Shipped__e> events = new List<Order_Shipped__e>();\n" +
                "for (Order__c o : shippedOrders) {\n" +
                "    events.add(new Order_Shipped__e(Order_External_Id__c = o.External_Id__c, Carrier__c = o.Carrier__c));\n" +
                "}\n" +
                "List<Database.SaveResult> results = EventBus.publish(events);   // publish behaviour: after commit\n" +
                "for (Database.SaveResult sr : results) {\n" +
                "    if (!sr.isSuccess()) { /* log through the house logger */ }\n" +
                "}"
              },
              { t: "code", lang: "text", code:
                "External subscriber over the Pub/Sub API (conceptual)\n" +
                "  topic        /data/OpportunityChangeEvent      (or /event/Order_Shipped__e)\n" +
                "  start        replay from stored replay id, else LATEST\n" +
                "  loop         request N events (flow control) -> process idempotently -> persist last replay id\n" +
                "  on gap or overflow event -> reconcile those records with a REST or Bulk query"
              },
              { t: "note", variant: "warn", html: "Retention is finite: high-volume platform events and change events are kept for about 72 hours. A subscriber must persist its last replay id, tolerate duplicates, and handle gap and overflow events by re-reading the affected records. Beyond the window, only a reconciliation extract can repair it." },
              { t: "note", variant: "tip", html: "Inside the org, Apex subscribers to platform events run as their own transaction with their own limits; the house patterns for publishing, retrying with <code class='tok'>EventBus.RetryableException</code> and testing with <code class='tok'>Test.getEventBus().deliver()</code> are in <code class='tok'>#/apex/async/platform-events</code>." },
              { t: "table", headers: ["Tier", "Keeping a warehouse in sync", "Trade-off"], rows: [
                ["Naive", "Poll every few minutes on LastModifiedDate", "API allocation drained, deletes missed, lag tied to the polling interval"],
                ["Solid", "CDC on the needed objects, subscriber persists replay ids", "Near real time with no publishing code; must handle gaps"],
                ["Standout", "CDC for record sync, platform events for business facts, idempotent subscriber, periodic Bulk reconciliation, enrichment limited to needed fields", "Streams for freshness, extracts for correctness"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> several systems that need to know when records change, a requirement to avoid polling, a downstream system that was offline, or an event that must only fire if the transaction commits." },
              { t: "note", variant: "key", html: "<strong>Announce, do not call.</strong> CDC for record changes, platform events for business facts, the Pub/Sub API for external subscribers, and replay ids plus reconciliation because retention is only about three days." }
            ]
          },
          {
            id: "middleware",
            title: "Middleware and integration patterns",
            summary: "The recurring integration patterns, API-led layering at category level, and when a middleware platform is worth its cost.",
            minutes: 10,
            tags: ["middleware", "api-led", "patterns"],
            blocks: [
              { t: "p", html: "Most integrations are one of a handful of <strong>recurring shapes</strong>. Name the shape first and the mechanism usually follows; the open question is whether a middleware layer between systems pays for itself." },
              { t: "table", headers: ["Pattern", "Shape", "Typical Salesforce mechanism"], rows: [
                ["Call and wait", "Salesforce asks a remote system and needs the answer", "Apex callout via Named Credential; Continuation from LWC"],
                ["Call and move on", "Salesforce tells a remote system and does not wait", "Platform event after commit; Queueable callout"],
                ["Scheduled sync", "Bulk movement on a timetable", "Bulk API 2.0 jobs driven by an ETL or middleware scheduler"],
                ["Remote call-in", "Another system creates or reads Salesforce data", "REST, SOAP, Composite or a custom Apex service"],
                ["React to changes", "UI or systems update when data changes", "CDC, platform events, empApi in the browser"],
                ["Read in place", "Show external data without copying it", "Salesforce Connect external objects"]
              ] },
              { t: "h", text: "API-led connectivity" },
              { t: "table", headers: ["Layer", "Responsibility", "Changes when"], rows: [
                ["System APIs", "Expose one back end (ERP, billing, Salesforce) in a stable, reusable way", "That back end changes"],
                ["Process APIs", "Compose system APIs into a business capability such as order to cash", "The business process changes"],
                ["Experience APIs", "Shape data for one channel: portal, mobile app, partner", "A channel's needs change"]
              ] },
              { t: "p", html: "Integration platforms such as MuleSoft sit in this middle tier as an iPaaS or ESB: they host the layered APIs, transform payloads, orchestrate multi-step flows, retry, and give one place to monitor traffic. Treat it as a category decision, not a product reflex." },
              { t: "compare",
                bad: { title: "Point-to-point at scale", items: ["Each pair of systems has its own bespoke link", "Transforms and retries duplicated per link", "A change in one back end breaks several consumers", "No single view of failures"] },
                good: { title: "Layered through middleware", items: ["Each back end exposed once as a system API", "Shared transforms, retries and dead-letter handling", "Back-end change contained behind its system API", "Central monitoring and correlation ids"] } },
              { t: "ul", items: [
                "<strong>Idempotency</strong>: every message carries a key so redelivery is harmless.",
                "<strong>Correlation ids</strong>: one id travels from the origin through every hop and into the logs.",
                "<strong>Dead-letter handling</strong>: messages that keep failing are parked with their error, not dropped or retried forever.",
                "<strong>Back-pressure</strong>: the slow side controls the rate; Salesforce limits are a hard floor, not a suggestion.",
                "<strong>Ownership</strong>: each integration has a named owner, an SLA and a runbook."
              ] },
              { t: "note", variant: "warn", html: "Middleware is not free. It adds a network hop, another platform to license, secure and upgrade, and a team boundary in every incident. For one or two simple links, a Named Credential callout or a platform event is cheaper and easier to reason about." },
              { t: "table", headers: ["Tier", "Integration architecture", "Why"], rows: [
                ["Naive", "Every team builds direct links, each with its own retry logic", "Fast to start; brittle and unobservable at ten links"],
                ["Solid", "Patterns named per link, Salesforce-native mechanisms, shared conventions for keys and logging", "Consistent without new infrastructure"],
                ["Standout", "Native mechanisms for simple links, a layered middleware tier once many systems share data, with idempotency, correlation and dead-letter queues everywhere", "Cost grows with real complexity, not ahead of it"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> five or more systems exchanging the same entities, the same transform written in several places, a back-end replacement that would break many consumers, or a question about where retries and monitoring should live." },
              { t: "quiz", id: "int-events" },
              { t: "note", variant: "key", html: "<strong>Name the pattern, then pick the mechanism, then decide on middleware.</strong> Layered system, process and experience APIs pay off when many systems share data; for a couple of links, native callouts and events are cheaper." }
            ]
          }
        ]
      },
      {
        id: "data",
        name: "Data Loading",
        icon: "database",
        lessons: [
          {
            id: "data-loading",
            title: "Data loading and migration",
            summary: "Picking a load tool, upserting with external IDs, load order, automation during loads, and avoiding lock contention.",
            minutes: 12,
            tags: ["data-loader", "upsert", "migration"],
            blocks: [
              { t: "p", html: "A data load is <strong>moving house with a removal crew</strong>. You label every box (external IDs), move furniture before what goes in it (parents before children), keep the crew from tripping over each other in one doorway (lock contention), and do a trial run in a similar house first (a full sandbox)." },
              { t: "table", headers: ["Tool", "Best for", "Notes"], rows: [
                ["Data Import Wizard", "One-off admin loads up to 50,000 records of supported objects", "Browser-based, duplicate matching, no install"],
                ["Data Loader", "Larger or repeated loads of any object, exports and deletes", "Desktop app or command line; can use the SOAP API or the Bulk API"],
                ["<code class='tok'>sf data</code> commands", "Scripted loads in pipelines and seed data for scratch orgs", "Bulk upsert, import of record trees and export"],
                ["Bulk API 2.0 directly", "Integrations and migration tooling at scale", "Asynchronous jobs; see the Bulk API lesson for limits"],
                ["ETL or middleware", "Ongoing transformation from many sources", "Owns mapping, retries and monitoring"]
              ] },
              { t: "h", text: "Upsert with external IDs" },
              { t: "code", lang: "text", code: [
                "contacts.csv",
                "Legacy_Contact_Id__c,FirstName,LastName,Email,Account.Legacy_Id__c",
                "C-1001,Ana,Ruiz,ana.ruiz@customer.example,A-501",
                "C-1002,Raj,Iyer,raj.iyer@customer.example,A-502"
              ].join("\n") },
              { t: "code", lang: "bash", code: [
                "# Parents first, then children that reference them by external ID",
                "sf data upsert bulk --sobject Account --file accounts.csv --external-id Legacy_Id__c --target-org uat --wait 30",
                "sf data upsert bulk --sobject Contact --file contacts.csv --external-id Legacy_Contact_Id__c --target-org uat --wait 30"
              ].join("\n") },
              { t: "p", html: "Mark the field as <strong>External ID</strong> and preferably <strong>Unique</strong>. The relationship column <code class='tok'>Account.Legacy_Id__c</code> lets the platform find the parent itself, so the file never contains Salesforce Ids and a rerun updates rows instead of duplicating them. In Apex the same idea is <code class='tok'>Database.upsert(rows, Contact.Legacy_Contact_Id__c, false)</code>." },
              { t: "h", text: "Running a big load safely" },
              { t: "ol", items: [
                "Rehearse in a full sandbox with production-like volume and automation.",
                "Load in dependency order: users, accounts, contacts, opportunities, then activities and junctions.",
                "Decide automation per object: bypass triggers, flows and validation with a custom permission granted to the load user, rather than deactivating them in production.",
                "Sort child rows by parent to avoid lock contention; use serial mode in Bulk API 1.0 or smaller files if locks persist.",
                "For historical records, the <em>Set Audit Fields upon Record Creation</em> permission lets you keep original created dates.",
                "Reconcile counts and spot-check records afterwards, then rebuild anything you deferred, such as sharing recalculation."
              ] },
              { t: "note", variant: "trap", html: "Loading two million Contacts under one Account creates data skew: sharing recalculations and lock waits slow every later change to that Account. Spread records across realistic parents, and assign owners who are active users in an appropriate role." },
              { t: "table", headers: ["Tier", "Migration habit", "Outcome"], rows: [
                ["Naive", "Insert from spreadsheets with Ids mapped by VLOOKUP, automation switched off in production", "Duplicates on retry, broken lookups, data that skipped every rule"],
                ["Solid", "External IDs everywhere, upserts in dependency order, bypass by custom permission", "Repeatable, idempotent loads that keep rules consistent"],
                ["Standout", "Solid plus rehearsed timings, parent-sorted files, reconciliation reports and a rollback plan", "Predictable cut-over with evidence that every record arrived"]
              ] },
              { t: "cue", html: "Plan a migration properly when you hear <em>\"we will just export from the old CRM and import\"</em>, <em>\"the load keeps failing with lock errors\"</em>, or <em>\"we reran it and now everything is duplicated\"</em>." },
              { t: "quiz", id: "int-data" },
              { t: "note", variant: "key", html: "<strong>Label everything with external IDs and upsert in dependency order.</strong> Rehearse at volume, bypass automation by custom permission, sort children by parent, and reconcile after every load." }
            ]
          }
        ]
      }
    ]
  };
})();
