/* =====================================================================
   CASCADE · DataOps in Production & Governance track
   (curriculum + quizzes + widgets)
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var h = WK.h, shell = WK.shell;

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
    return h("span", { class: "ro" }, label + " ", h("b", accent ? { style: "color:var(--accent-ink)" } : {}, value));
  }

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — Active metadata control plane */
  window.Widgets["de-ops-metadata-plane"] = function (mount) {
    shell(mount, "control", "Metadata Control Plane",
      "Promote metadata from documentation into an operational signal: ownership, policy, quality and lineage drive workflow.");
    var state = { lineage: true, quality: false, policy: false, owner: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function tg(key, label) {
      var b = h("button", { class: state[key] ? "active" : "" }, label);
      b.addEventListener("click", function () { state[key] = !state[key]; b.classList.toggle("active"); paint(); });
      return b;
    }
    function paint() {
      stage.innerHTML = "";
      var rows = [
        ["catalog asset", "gold.orders", state.owner ? "owned" : "orphan"],
        ["glossary term", "booked revenue", state.owner ? "approved" : "draft"],
        ["OpenLineage facet", "schema + run", state.lineage ? "ingested" : "missing"],
        ["policy tag", "customer_email", state.policy ? "masked" : "raw"],
        ["quality signal", "freshness SLO", state.quality ? "green" : "unknown"]
      ];
      var board = h("div", { class: "grid-board", style: "grid-template-columns:1fr 1fr 1fr;gap:3px" });
      ["control", "example", "state"].forEach(function (c) {
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:6px;font-family:var(--font-mono);font-size:.58rem;color:var(--text-dim)" }, c));
      });
      rows.forEach(function (r) {
        r.forEach(function (c, i) {
          var good = i === 2 && /owned|approved|ingested|masked|green/.test(c);
          board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:6px 4px;font-size:.64rem;color:" + (good ? "var(--accent-ink)" : "var(--text)") }, c));
        });
      });
      stage.appendChild(board);
      readout.innerHTML = "";
      var score = ["lineage", "quality", "policy", "owner"].filter(function (k) { return state[k]; }).length;
      readout.appendChild(ro("controls active", score + " / 4", true));
      readout.appendChild(ro("workflow", score >= 3 ? "auto-route access + alerts" : "manual triage"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "enable:"),
      h("div", { class: "w-seg" }, tg("owner", "owner"), tg("policy", "policy tags"), tg("quality", "quality"), tg("lineage", "lineage"))
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 2 — Privacy deletion workflow */
  window.Widgets["de-ops-privacy-delete"] = function (mount) {
    shell(mount, "runbook", "Privacy Deletion Workflow",
      "A deletion request is not one DELETE statement. Track every copy, retention boundary and proof artifact.");
    var step = 0, legalHold = false;
    var steps = [
      ["Discover copies", "catalog + lineage find raw, derived, search and export copies"],
      ["Protect live paths", "mask/tokenize sensitive fields while the request is processed"],
      ["Delete tables", "MERGE/DELETE by subject key and rewrite affected table snapshots"],
      ["Handle retention", "expire snapshots after policy windows; exclude legal-hold data"],
      ["Prove completion", "store request id, assets touched, counts and reviewer approval"]
    ];
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      stage.innerHTML = "";
      var log = h("div", { class: "dsa-log" });
      steps.forEach(function (s, i) {
        var done = i < step;
        var blocked = legalHold && i === 3;
        log.appendChild(h("div", { class: blocked ? "no" : (done ? "ok" : "") }, (blocked ? "! HOLD  " : (done ? "✓ DONE  " : "• QUEUED")) + s[0] + " — " + s[1]));
      });
      stage.appendChild(log);
      readout.innerHTML = "";
      readout.appendChild(ro("workflow progress", step + " / " + steps.length, true));
      readout.appendChild(ro("legal hold", legalHold ? "retain protected copies" : "none"));
      readout.appendChild(ro("audit proof", step === steps.length ? "complete" : "pending"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn primary", onclick: function () { step = Math.min(steps.length, step + 1); paint(); } }, "Advance"),
      h("button", { class: "w-btn ghost", onclick: function () { step = 0; paint(); } }, "Reset"),
      h("button", { class: "w-btn ghost", onclick: function () { legalHold = !legalHold; paint(); } }, "Toggle legal hold")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 3 — Cost engineering lab */
  window.Widgets["de-ops-cost-lab"] = function (mount) {
    shell(mount, "finops", "Warehouse Cost Lab",
      "Change scan size, warehouse size and idle behavior. The cheap fix is usually scanning less and stopping idle compute.");
    var scan = 1000, size = "M", suspend = "slow";
    var credits = { XS: 1, S: 2, M: 4, L: 8 };
    var readout = h("div", { class: "w-readout" });
    var stage = h("div", { class: "w-stage" });
    function cost() {
      var scanFactor = scan / 1000;
      var idle = suspend === "fast" ? 0.15 : 1.2;
      return Math.round((credits[size] * (scanFactor + idle)) * 100) / 100;
    }
    function paint() {
      stage.innerHTML = "";
      var rows = [
        ["query scan", scan + " GB", scan <= 120 ? "pruned" : scan <= 300 ? "better" : "wasteful"],
        ["warehouse", size, size === "L" ? "fast but pricey" : "right-sized"],
        ["auto-suspend", suspend === "fast" ? "60 seconds" : "15 minutes", suspend === "fast" ? "controlled" : "idle burn"],
        ["incident comms", "owner + ETA + spend cap", "required"]
      ];
      var board = h("div", { class: "grid-board", style: "grid-template-columns:1fr 1fr 1fr;gap:3px" });
      rows.forEach(function (r) {
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:7px;font-size:.64rem" }, r[0]));
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:7px;font-size:.64rem" }, r[1]));
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:7px;font-size:.64rem;color:" + (r[2] === "wasteful" || r[2] === "idle burn" ? "var(--rose-ink)" : "var(--accent-ink)") }, r[2]));
      });
      stage.appendChild(board);
      readout.innerHTML = "";
      readout.appendChild(ro("estimated credits", String(cost()), true));
      readout.appendChild(ro("first move", scan > 300 ? "add filters / materialize" : "cap concurrency"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "scan:"),
      seg([{ v: 1000, label: "1 TB" }, { v: 250, label: "250 GB" }, { v: 80, label: "80 GB" }], function () { return scan; }, function (v) { scan = v; paint(); }),
      h("span", { style: "font-family:var(--font-mono);font-size:.62rem;color:var(--text-faint)" }, "size:"),
      seg([{ v: "S", label: "S" }, { v: "M", label: "M" }, { v: "L", label: "L" }], function () { return size; }, function (v) { size = v; paint(); }),
      h("button", { class: "w-btn ghost", onclick: function () { suspend = suspend === "fast" ? "slow" : "fast"; paint(); } }, "Toggle suspend")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-dataops-metadata": {
      title: "Metadata control plane checkpoint",
      sub: "Catalog, glossary, ownership, lineage facets and policy workflows.",
      questions: [
        {
          q: "What makes a catalog an active metadata control plane instead of a passive wiki?",
          options: ["Metadata changes drive workflows such as access approval, alerts, ownership routing and policy enforcement", "It stores PDFs only", "It has more colors", "It replaces all pipelines"],
          answer: 0,
          explain: "Active metadata is operational: ownership, lineage, glossary terms, quality results and policy tags feed automation instead of sitting unused in documentation."
        },
        {
          q: "An OpenLineage facet is best described as...",
          options: ["A dashboard filter", "A typed metadata attachment to a job, run or dataset", "A warehouse size", "A file compression codec"],
          answer: 1,
          explain: "Facets attach structured metadata such as schema, SQL, ownership, errors or data quality results to lineage events."
        },
        {
          q: "Policy tags on sensitive columns should ideally...",
          options: ["Only appear in a spreadsheet", "Be removed before production", "Drive masking, approval routing and access reviews automatically", "Disable lineage"],
          answer: 2,
          explain: "Tags are most valuable when they control behavior: who can request access, what gets masked, and which reviews/audits are required."
        },
        {
          q: "Freshness and quality signals become product signals when they...",
          options: ["Ignore lineage", "Are hidden in worker logs", "Run only once", "Are visible to consumers and tied to an owner/SLO"],
          answer: 3,
          explain: "A data product should expose whether it is fresh and trustworthy, who owns it, and what SLO it is meeting or missing."
        },
        {
          q: "Which metadata stream best scopes a backfill after a bad run?",
          options: ["Business glossary terms", "Operational metadata: run history and lineage facets showing what the bad run wrote and who reads it", "Dashboard colour themes", "Warehouse storage invoices"],
          answer: 1,
          explain: "Operational metadata records which runs produced which dataset versions and which consumers depend on them, so you can backfill exactly the affected partitions and notify exactly the affected owners."
        }
      ]
    },
    "de-dataops-privacy": {
      title: "Privacy deletion checkpoint",
      sub: "Deletion, retention, masking, backups and audit proof.",
      questions: [
        {
          q: "Why does a privacy deletion request begin with discovery?",
          options: ["Data platforms create raw, derived, exported and backup copies that must be located before action", "Deletes are optional", "Discovery is cheaper than SQL", "It avoids audit logs"],
          answer: 0,
          explain: "You cannot prove erasure if you do not know every place the subject's data landed. Catalog tags and lineage are the map."
        },
        {
          q: "For immutable lakehouse tables, deletion usually requires...",
          options: ["Editing a Parquet file by hand", "A table-format delete/merge that rewrites affected files and creates a new snapshot", "Dropping the whole lake", "Disabling schema checks"],
          answer: 1,
          explain: "Open table formats implement deletes by planning affected files, rewriting them without the deleted rows, and committing a new snapshot."
        },
        {
          q: "Legal hold changes a deletion workflow by...",
          options: ["Allowing immediate permanent deletion of all copies", "Removing masking requirements", "Requiring protected copies to be retained while access is restricted and the exception is documented", "Skipping the audit trail"],
          answer: 2,
          explain: "A legal hold can override normal deletion timing. The workflow must preserve required evidence, restrict access and record why retention continues."
        },
        {
          q: "Good audit proof for deletion includes...",
          options: ["Only a success toast", "The user's raw PII in logs", "A screenshot of the dashboard", "Request id, subject key, assets touched, counts, retained exceptions and reviewer approval"],
          answer: 3,
          explain: "Audit proof should show what was requested, what was changed, what could not be changed yet, and who approved it without leaking sensitive data."
        },
        {
          q: "Why should a deletion workflow mask or tokenize the subject's fields while the request is still being processed?",
          options: ["To protect live query paths before every copy has been found and rewritten", "Because masking replaces the need for deletion", "To make the audit trail shorter", "Because backups are always deleted first"],
          answer: 0,
          explain: "Discovery and rewrites take time. Masking live paths immediately limits exposure during that window; deletion still has to happen everywhere policy requires."
        }
      ]
    },
    "de-dataops-governance": {
      title: "Governance checkpoint",
      sub: "Catalogs, classification, access control and erasure.",
      questions: [
        {
          q: "A data catalog primarily helps with\u2026",
          options: ["Discovery, documentation and ownership of datasets", "Running queries faster", "Compressing data", "Replacing the warehouse"],
          answer: 0,
          explain: "A catalog makes data discoverable and trustworthy \u2014 what exists, what it means, who owns it, how fresh it is \u2014 which is foundational to governance and self-service."
        },
        {
          q: "Masking or tokenizing PII columns is an example of\u2026",
          options: ["Cost optimization", "Access control / data protection", "Partitioning", "Compaction"],
          answer: 1,
          explain: "Masking, tokenization and column-level access control limit who can see sensitive data \u2014 core to privacy regulations like GDPR and to least-privilege governance."
        },
        {
          q: "What keeps a data catalog trustworthy over time?",
          options: ["A quarterly documentation sprint", "Requiring every analyst to edit descriptions", "Restricting the catalog to the platform team", "Harvesting owners, lineage, freshness and usage automatically from pipelines"],
          answer: 3,
          explain: "Hand-maintained metadata decays until readers stop believing it. Metadata produced as a by-product of pipelines \u2014 lineage, run status, usage, test results \u2014 stays current without anyone remembering to update it."
        },
        {
          q: "Least-privilege access to sensitive columns is best achieved by\u2026",
          options: ["Classifying columns, then granting by role or attribute with masking as the default", "Giving analysts admin roles so they are never blocked", "Copying a redacted table for each team", "Encrypting the whole warehouse with one shared key"],
          answer: 0,
          explain: "Classification tells policy which columns are sensitive; role- or attribute-based grants decide who sees them; masking makes the safe view the default. Per-team copies multiply the places PII lives."
        },
        {
          q: "Why is GDPR-style erasure hard in an immutable data lake?",
          options: ["Parquet files cannot store personal data", "Erasure requests only apply to OLTP databases", "A subject's rows may sit in many files, derived tables and snapshots that must be found and rewritten", "Object storage cannot delete files"],
          answer: 2,
          explain: "Immutable files make deletion a rewrite, and the data has usually been copied into derived tables and retained snapshots. Row-level deletes in table formats plus lineage make targeted erasure feasible."
        }
      ]
    },
    "de-dataops-capstone": {
      title: "Platform artifact checkpoint",
      sub: "Architecture decisions, contracts, lineage, SLOs, runbooks and cost.",
      questions: [
        {
          q: "An ADR in the capstone should primarily capture...",
          options: ["The decision, context, options considered, trade-offs and consequences", "Only the final answer", "Every meeting note", "A vendor logo list"],
          answer: 0,
          explain: "Architecture Decision Records are useful because they preserve why a choice was made, not just what the choice was."
        },
        {
          q: "A contract migration plan for a breaking schema change should include...",
          options: ["Rename the column immediately", "Versioning, dual-write/backfill, consumer migration and a removal window", "Only a Slack message", "Disabling tests"],
          answer: 1,
          explain: "Breaking changes need a staged path so old and new consumers can coexist until migration completes."
        },
        {
          q: "Which artifact best turns runtime behavior into incident evidence?",
          options: ["A color palette", "A table name alone", "OpenLineage events with job/run/dataset facets and SLO dashboard history", "A monthly invoice only"],
          answer: 2,
          explain: "Runtime lineage plus SLO history shows what ran, what data it touched, whether it met promises, and where failure started."
        },
        {
          q: "A warehouse incident update should include...",
          options: ["No status until fixed", "Only 'we are checking'", "The full stack trace for consumers", "Impact, affected datasets, current freshness, owner, mitigation, ETA and next update time"],
          answer: 3,
          explain: "Consumers need decision-grade communication: what is safe, what is stale, who owns it, and when they will hear more."
        },
        {
          q: "Which capstone artifact answers \u2018what breaks downstream if this table is late?\u2019",
          options: ["The ADR's rejected-options list", "The contract's compatibility policy", "Lineage plus exposures and SLO tiles for each consumer", "The cost forecast band"],
          answer: 2,
          explain: "Lineage and exposures enumerate the downstream jobs and dashboards; SLO tiles show which of them miss promises when the table is late. The ADR and contract explain why and what is guaranteed, not who is affected right now."
        }
      ]
    },
    "de-dataops-reliability": {
      title: "Reliability & incidents checkpoint",
      sub: "SLOs, schema drift, CDC failure modes and incident backfills.",
      questions: [
        {
          q: "Which is a consumer-facing data product SLI rather than an internal job metric?",
          options: ["Number of task retries last night", "Scheduler CPU utilisation", "Share of business days the gold orders table was fresh by 07:00", "Count of DAG files in the repository"],
          answer: 2,
          explain: "Consumers experience freshness, completeness and accuracy \u2014 not retries or scheduler load. An SLO built on a consumer-facing SLI pages when decisions are actually at risk."
        },
        {
          q: "A producer adds a new value to a status enum. Every job stays green, yet a revenue figure shifts. Why is this the dangerous kind of drift?",
          options: ["It still parses, so it lands in an else-branch and silently changes results instead of failing", "Enums cannot change in columnar formats", "It always breaks the schema registry", "It only affects streaming jobs"],
          answer: 0,
          explain: "A vanished column fails loudly. A new enum value or widened type that still parses keeps pipelines green while results move, which is why drift detection must watch enum membership and distributions, not only the column list."
        },
        {
          q: "After a CDC connector restart, warehouse and source disagree but no job failed. What is the most reliable way to notice?",
          options: ["Restart the connector again", "Scheduled reconciliation of counts, keys or checksums against the source", "Increase the topic retention", "Switch the sink to append-only inserts"],
          answer: 1,
          explain: "A skipped, reordered or replayed change leaves the target out of step without any task failing. Only a comparison against the source can detect it; append-only inserts would make duplicates worse."
        },
        {
          q: "In a lakehouse incident caused by a tiny-file burst, which action should come last?",
          options: ["Declaring impact and the next update time", "Stopping duplicate retries from the bad writer", "Compacting hot partitions and validating counts", "Deleting orphan files"],
          answer: 3,
          explain: "Orphan cleanup is destructive and can remove files a still-running writer or long query needs. Declare impact, stabilise writes, compact and validate first; remove orphans only after a safe retention window."
        },
        {
          q: "Which backfill plan is safest for correcting three weeks of a trusted mart?",
          options: ["Re-run the full history in place on the largest warehouse", "Append corrected rows now and dedupe later", "Rebuild the affected partitions into a shadow table, reconcile, swap atomically and notify consumers", "Disable tests so the backfill finishes faster"],
          answer: 2,
          explain: "Bounding scope, validating in a shadow target and publishing atomically means consumers never see a half-corrected table, and the announcement tells them which dates changed."
        }
      ]
    },
    "de-dataops-cost": {
      title: "Cost & FinOps checkpoint",
      sub: "Scan pruning, right-sized compute and runaway-spend incidents.",
      questions: [
        {
          q: "Which most reduces warehouse cost on a bursty analytical workload?",
          options: ["Never partitioning", "Always running the largest warehouse", "Auto-suspend idle compute and prune scans via partitioning/clustering", "Disabling caching"],
          answer: 2,
          explain: "Per-second billing rewards suspending idle compute, and scanning less data (partition/cluster pruning) cuts the dominant cost \u2014 the heart of FinOps for data."
        },
        {
          q: "A dashboard query lost partition pruning after a refactor. Where does the cost increase show up first?",
          options: ["Bytes scanned per query", "Number of dashboard users", "Storage footprint of the table", "Count of columns in the schema"],
          answer: 0,
          explain: "Losing pruning makes every refresh read far more data, so bytes scanned \u2014 and the compute billed to scan them \u2014 jumps immediately. Storage and schema are unchanged."
        },
        {
          q: "Why is a runaway query on elastic, metered compute harder to notice than on a fixed cluster?",
          options: ["Elastic engines cannot run large queries", "It finishes on schedule, so the only feedback is the bill arriving later", "Elastic engines keep no query history", "Fixed clusters charge per byte scanned"],
          answer: 1,
          explain: "On a fixed cluster a bad query runs slowly and someone complains. Metered compute simply scales and finishes, so spend is the only signal \u2014 which is why caps, quotas and spend-anomaly alerts must be added deliberately."
        },
        {
          q: "Showback or chargeback curbs waste mainly because it\u2026",
          options: ["Makes queries faster", "Removes the need for auto-suspend", "Attributes spend to the teams and jobs that cause it, giving owners a reason to fix it", "Compresses data automatically"],
          answer: 2,
          explain: "Attribution turns an anonymous platform bill into a line item with an owner. Teams that see their own spend fix the SELECT * dashboard far faster than a central team asking politely."
        },
        {
          q: "A job reprocesses all history every night on the largest warehouse. Which change cuts cost without losing correctness?",
          options: ["Drop the job entirely", "Run it on a smaller warehouse with no other change", "Disable auto-suspend so the cache stays warm", "Process only the bounded partitions that changed and checkpoint progress"],
          answer: 3,
          explain: "Bounded, incremental processing touches only affected partitions and resumes from a checkpoint, so the job does the minimum work once. Shrinking the warehouse alone just makes the same wasted scan slower."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.dataops = {
    id: "dataops", name: "DataOps in Production & Governance", short: "DOPS",
    tagline: "Keep promises once it ships", color: "#818cf8",
    blurb: "Operate data products after launch: consumer-facing SLOs, schema drift, CDC and warehouse incidents with safe backfills, lakehouse war rooms; catalogs, active metadata, access control and privacy deletion; FinOps and cost incidents; and two production capstones.",
    modules: [
      {
        id: "reliability", name: "Reliability & Incidents", icon: "wrench",
        lessons: [
          {
            id: "pipeline-slos", title: "Data product SLOs",
            summary: "Define reliability from the consumer's view: freshness, completeness, accuracy and latency.",
            minutes: 6, tags: ["slo", "observability", "data-product"],
            blocks: [
              { t: "p", html: "Data reliability should be promised in terms consumers understand. A table is not 'up' because the job succeeded; it is reliable when the data is fresh, complete, accurate enough and available before decisions are made." },
              { t: "table", headers: ["SLI", "Example SLO"], rows: [
                ["Freshness", "Gold orders table updated by 07:00 local time on business days"],
                ["Completeness", "Row count within 2% of source reconciliation for the same interval"],
                ["Accuracy", "Revenue variance against source ledger below agreed threshold"],
                ["Latency", "CDC changes visible in the mart within five minutes"],
                ["Quality", "Critical tests pass before publication"]
              ] },
              { t: "note", variant: "tip", html: "Alert on consumer impact, not every internal retry. Page when the SLO is burning, not when an invisible transient self-heals." },
              { t: "note", variant: "key", html: "<strong>An objective you would not wake someone for is a dashboard, not an SLO.</strong> A freshness or completeness target only starts doing work once it has an owner, a budget the business has actually agreed to spend, and a defined action for when that budget burns. Without those three, the number quietly drifts to match whatever the pipeline happens to deliver, and you have documented the current behavior instead of committing to any." }
            ]
          },
          {
            id: "schema-drift", title: "Schema drift: the silent breaking change",
            summary: "How a harmless producer change can break dashboards, ML features and finance reports downstream.",
            minutes: 7, tags: ["schema", "contracts", "incident"],
            blocks: [
              { t: "p", html: "<strong>Schema drift</strong> is any unexpected change in shape or meaning: a column is renamed, a type widens from integer to string, a nullable field becomes required, or a status code gets a new value. The producer deploys cleanly; the consumers discover it at 2am." },
              { t: "table", headers: ["Signal", "What it usually means"], rows: [
                ["Column missing", "Producer renamed or stopped sending a field"],
                ["Type changed", "Serialization or source-system release changed representation"],
                ["Enum grew", "Business added a state consumers were not coded to handle"],
                ["Null-rate spike", "Upstream enrichment failed or contract was weakened"]
              ] },
              { t: "note", variant: "tip", html: "Treat data schemas like APIs. Breaking changes need versioning, contract tests and consumer notification; compatible changes still need monitoring." },
              { t: "note", variant: "tip", html: "When a breaking change is intentional, roll it out as a versioned migration \u2014 add, dual-write, move consumers, retire \u2014 as laid out in <a class=\"inline\" href=\"#/orchestration/quality/contracts-ci\">Contracts in CI &amp; schema migration plans</a>." },
              { t: "note", variant: "key", html: "<strong>The drift that hurts is the drift that still parses.</strong> A vanished column fails loudly and gets fixed the same morning; a new status value that quietly lands in an <em>else</em> branch, or a type that widens so amounts start arriving as strings, keeps every job green while the numbers move underneath. That is why drift detection has to watch value distributions and enum membership, not just the column list \u2014 the column list is the part that already alerts you." }
            ]
          },
          {
            id: "cdc-failures", title: "CDC failure modes",
            summary: "Change data capture is powerful because it is continuous — and dangerous when offsets, ordering or deletes are wrong.",
            minutes: 7, tags: ["cdc", "streaming", "reliability"],
            blocks: [
              { t: "p", html: "<strong>CDC</strong> turns database changes into a stream, but the stream is now part of your correctness boundary. A missed offset, duplicate event, schema change or tombstone bug can make the warehouse disagree with the source while every job still appears green." },
              { t: "table", headers: ["Failure", "Defense"], rows: [
                ["Connector restarts from the wrong offset", "Durable checkpointing and reconciliation counts"],
                ["Duplicate events after retry", "Idempotent MERGE by primary key and event version"],
                ["Out-of-order updates", "Apply only the newest source timestamp or log sequence number"],
                ["Deletes not propagated", "Handle tombstones and test delete paths, not just inserts"],
                ["Snapshot overlaps with stream", "Fence the snapshot boundary and dedupe by key/version"]
              ] },
              { t: "note", variant: "trap", html: "CDC is not automatically exactly-once. Correctness comes from checkpoint discipline plus an idempotent sink." },
              { t: "note", variant: "key", html: "<strong>CDC moves the correctness boundary out of your query and into the connector\u2019s offset bookkeeping.</strong> A nightly reload is wrong for one run and right on the next; a change stream that skips, reorders or replays a single event leaves the target permanently out of step with the source, and no job reports a failure because none of them failed. Reconcile counts and keys against the source on a schedule \u2014 that comparison is the only thing in the pipeline capable of noticing." }
            ]
          },
          {
            id: "warehouse-incidents", title: "Warehouse incidents, safe backfills & comms",
            summary: "When trusted numbers are wrong, repair them with a scoped, validated backfill and tell consumers exactly what is safe to use.",
            minutes: 9, tags: ["warehouse", "backfill", "incident", "runbook"],
            blocks: [
              { t: "p", html: "A data incident often looks like a wrong number, not a stack trace: revenue down 18%, yesterday's orders missing, or two dashboards disagreeing. The response must repair data and tell consumers what is safe to use." },
              { t: "ol", items: [
                "<strong>Freeze blast radius</strong> \u2014 mark affected tables or dashboards stale so consumers stop making decisions on bad data.",
                "<strong>Trace lineage</strong> \u2014 walk upstream to find the first bad dataset and downstream to list every affected consumer.",
                "<strong>Repair source or transform</strong> \u2014 fix the smallest root cause, not every downstream symptom.",
                "<strong>Backfill idempotently</strong> \u2014 overwrite partitions or MERGE by key; never append blindly.",
                "<strong>Communicate closure</strong> \u2014 what was wrong, which dates changed, and which checks now prevent recurrence."
              ] },
              { t: "h", text: "The backfill is a production change" },
              { t: "p", html: "Backfills repair history, load a new model, or recover from a bad transform. They are high-risk because they rewrite numbers people already trust, so treat them like production changes with a plan, an owner and a rollback. The mechanics \u2014 parameterizing by logical date, overwriting by partition, lookback windows \u2014 are in <a class=\"inline\" href=\"#/batch/elt/incremental-backfill\">Incremental models &amp; backfills</a>; this lesson is the operating discipline around them." },
              { t: "ol", items: [
                "<strong>Scope</strong> the exact partitions, tables and consumers affected.",
                "<strong>Dry-run</strong> counts and distributions into a shadow table.",
                "<strong>Validate</strong> source-to-target reconciliation before publish.",
                "<strong>Swap atomically</strong> or publish partition by partition with checkpoints.",
                "<strong>Communicate</strong> what changed, which dates are affected, ETA, workaround and final RCA."
              ] },
              { t: "note", variant: "tip", html: "The safest backfill is boring: parameterized by date, writes to a temporary target, validates counts and distributions, then atomically swaps or publishes." },
              { t: "note", variant: "key", html: "<strong>A vague alert like \u2018pipeline failed\u2019 is not communication.</strong> Consumers need impact, freshness, affected datasets, owner and next update time \u2014 and a backfill that silently rewrites three weeks of revenue without that message creates a second incident: finance reconciling numbers that moved under them." }
            ]
          },
          {
            id: "lakehouse-war-room", title: "Lab: lakehouse incident war room",
            summary: "Diagnose tiny files, stale snapshots, cost spikes and delayed dashboards without making the incident worse.",
            minutes: 10, tags: ["capstone", "lakehouse", "incident"],
            blocks: [
              { t: "p", html: "Scenario: a streaming job wrote thousands of tiny files overnight. Dashboards are two hours late, query cost doubled, the Iceberg table has stale snapshots, and consumers need an ETA. Your job is to stabilize the product, repair safely and communicate clearly." },
              { t: "table", headers: ["Signal", "Likely cause", "First response"], rows: [
                ["File count spiked; average file size tiny", "Streaming micro-batches wrote too many small files", "Pause nonessential backfills; compact hot partitions"],
                ["Snapshot count and manifests keep growing", "Maintenance missed or retention is too long for this table", "Expire old snapshots after validating rollback needs"],
                ["Storage cost rising after failed writes", "Orphan candidates from failed jobs or expired metadata", "Remove orphans only after a safe retention window"],
                ["Dashboards stale or slow", "Planning and scans spend time on metadata and tiny files", "Mark dashboards stale, publish ETA, then re-enable after validation"]
              ] },
              { t: "h", text: "War-room drill" },
              { t: "ol", items: [
                "<strong>Declare impact</strong> \u2014 name affected datasets, dashboards, freshness gap, owner and next update time.",
                "<strong>Trace lineage</strong> \u2014 identify upstream runs that produced the tiny-file burst and downstream consumers waiting on the table.",
                "<strong>Stabilize writes</strong> \u2014 stop duplicate retries, cap the streaming trigger or increase batch size, and keep new output idempotent.",
                "<strong>Run maintenance</strong> \u2014 compact hot partitions, validate counts, expire snapshots, then clean orphans after retention.",
                "<strong>Backfill bounded partitions</strong> \u2014 repair only affected dates into a shadow target, compare, then publish atomically.",
                "<strong>Close the loop</strong> \u2014 send final RCA, changed partitions, consumer action needed and the monitor/runbook added."
              ] },
              { t: "h", text: "Grading rubric" },
              { t: "table", headers: ["Criterion", "Meets bar"], rows: [
                ["Impact statement", "Names affected assets, freshness gap, owner, severity, ETA and next update time"],
                ["Safe stabilization", "Stops duplicate writes/retries before running destructive maintenance"],
                ["Maintenance plan", "Compacts first, validates counts, expires snapshots deliberately, cleans orphans after retention"],
                ["Backfill proof", "Repairs bounded partitions into a shadow target and compares counts/distributions before publish"],
                ["RCA closure", "Explains cause, changed partitions, consumer action, prevention monitor and runbook update"]
              ] },
              { t: "note", variant: "trap", html: "Do not start with orphan deletion. During an active incident, a too-short cleanup window can delete files from a still-running writer or long query. Stabilize and validate before destructive cleanup." },
              { t: "note", variant: "tip", html: "A good lakehouse incident response balances three tracks: <strong>maintenance</strong> to restore layout, <strong>backfill</strong> to repair correctness, and <strong>communication</strong> so consumers know what changed and when to trust it." },
              { t: "note", variant: "tip", html: "After drafting your answer, compare it with the <a class='inline' href='#/scenarios/lakehouse-tiny-file-incident'>tiny-file scenario outline</a> and grade it with the <a class='inline' href='#/rubrics'>practice rubrics</a>." },
              { t: "note", variant: "key", html: "<strong>In a live incident every repair is itself a write, and writes are what broke you.</strong> Compaction, snapshot expiry and orphan cleanup all mutate the same table a misbehaving job may still be touching, which is why the order is not negotiable: stop the bad writer, confirm what is actually on disk, repair bounded partitions into a shadow target, and only then run anything destructive. Invert that order and a slow dashboard becomes missing data \u2014 the one outcome a backfill cannot undo." },
              { t: "quiz", id: "de-dataops-reliability" }
            ]
          }
        ]
      },
      {
        id: "governance", name: "Governance & Privacy", icon: "shield",
        lessons: [
          {
            id: "catalog", title: "Catalogs, metadata & discovery",
            summary: "Make data findable, understandable and owned.",
            minutes: 5, tags: ["catalog", "metadata"],
            blocks: [
              { t: "p", html: "A <strong>data catalog</strong> is the index of your data estate: what tables exist, what each column means, who owns it, how fresh it is, and how it\u2019s used. It turns a sprawling warehouse from a maze into something self-serviceable." },
              { t: "note", variant: "tip", html: "Metadata is the product here: a <strong>business glossary</strong> (shared definitions), <strong>ownership</strong> (a human to ask), and <strong>popularity/usage</strong> (which table is the trusted one) are what make data discoverable and trustworthy." },
              { t: "note", variant: "tip", html: "Catalogs ingest lineage, quality results and usage automatically \u2014 the best metadata is generated by your pipelines, not hand-maintained docs that rot." },
              { t: "note", variant: "key", html: "<strong>A catalog stays trusted only while its metadata is a by-product of the pipeline.</strong> Anything a person has to remember to update \u2014 an owner, a description, a freshness claim \u2014 decays until readers stop believing any of it. And a catalog nobody believes is worse than no catalog, because it makes an abandoned table look certified." }
            ]
          },
          {
            id: "active-metadata", title: "Active metadata control plane",
            summary: "Use catalog, glossary, ownership and lineage as automation inputs, not static documentation.",
            minutes: 8, tags: ["catalog", "metadata", "lineage", "policy"],
            blocks: [
              { t: "p", html: "A passive catalog answers 'where is the table?' An <strong>active metadata control plane</strong> turns metadata into workflow: owner routing, masking, freshness alerts, access review and deprecation warnings." },
              { t: "widget", id: "de-ops-metadata-plane" },
              { t: "table", headers: ["Metadata stream", "Example source", "What it controls"], rows: [
                ["Technical metadata", "warehouse schemas, dbt manifests, table stats", "discovery, schema drift, impact analysis"],
                ["Operational metadata", "orchestrator runs, OpenLineage facets, SLO status", "freshness alerts, RCA, backfill scope"],
                ["Business metadata", "glossary terms, certified metrics, owners", "trusted discovery and escalation"],
                ["Governance metadata", "PII tags, retention class, access approvals", "masking, deletion workflow, audit evidence"],
                ["Usage metadata", "query logs, dashboard references, consumers", "deprecation plans and popularity signals"]
              ] },
              { t: "p", html: "Catalog ingestion crawls systems and receives runtime events, then reconciles them into a graph. OpenLineage facets add execution truth: schema at run time, SQL used, errors, quality results and producer version." },
              { t: "note", variant: "key", html: "Metadata becomes active when a tag or signal changes behavior: route an access request, page an owner, mask a column, warn consumers, or block a breaking deploy." },
              { t: "quiz", id: "de-dataops-metadata" }
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
              { t: "note", variant: "key", html: "Least privilege plus classification is the backbone: know which columns are sensitive, and grant access by role, not by default." },
              { t: "quiz", id: "de-dataops-governance" }
            ]
          },
          {
            id: "privacy-by-design", title: "Privacy by design in data platforms",
            summary: "PII handling is not a masking checkbox; it shapes ingestion, storage, access, retention and deletion.",
            minutes: 7, tags: ["privacy", "pii", "governance"],
            blocks: [
              { t: "p", html: "Data platforms copy data by design. That makes privacy an architectural requirement: know where sensitive fields enter, where they are transformed, who can query them, how long they stay, and how to delete them when policy requires it." },
              { t: "ul", items: [
                "<strong>Minimize</strong> — do not ingest PII that the product does not need.",
                "<strong>Classify early</strong> — tag sensitive columns at ingestion and carry tags through lineage.",
                "<strong>Protect by default</strong> — masking, tokenization and row/column policies should be automatic from classification.",
                "<strong>Separate duties</strong> — platform admins should not automatically see raw sensitive data.",
                "<strong>Design erasure</strong> — use keys, manifests and table formats that make targeted deletion auditable."
              ] },
              { t: "note", variant: "key", html: "The hard privacy question is not 'is this encrypted?' It is 'can we find every copy, prove who accessed it, and delete it when required?'" }
            ]
          },
          {
            id: "privacy-deletion-retention", title: "Privacy deletion & retention workflow",
            summary: "Discover copies, delete or mask live data, respect retention/legal hold and produce audit proof.",
            minutes: 9, tags: ["privacy", "retention", "deletion", "audit"],
            blocks: [
              { t: "p", html: "Privacy deletion is an end-to-end workflow across the data estate. The request starts with an identity key, but the work spans raw zones, curated tables, derived aggregates, search exports, feature stores, snapshots, backups and legal holds." },
              { t: "widget", id: "de-ops-privacy-delete" },
              { t: "ol", items: [
                "<strong>Discover copies</strong> \u2014 use catalog tags and lineage to find raw, transformed, exported and cached locations.",
                "<strong>Classify action</strong> \u2014 delete direct identifiers, mask/tokenize fields where deletion would break required aggregates, and record retained exceptions.",
                "<strong>Apply table deletes</strong> \u2014 use table-format deletes or MERGE logic keyed by subject id; validate affected row counts.",
                "<strong>Manage snapshots</strong> \u2014 expire old snapshots only after the rollback window; do not erase data under legal hold.",
                "<strong>Handle backups</strong> \u2014 mark backup copies for expiry or restore-time deletion, because many backup systems are intentionally immutable.",
                "<strong>Prove it</strong> \u2014 emit an audit artifact with request id, assets touched, counts, exceptions, reviewer and timestamp."
              ] },
              { t: "note", variant: "trap", html: "Never log the raw subject identifier or sensitive values in the deletion proof. Store a request id and salted/hash-safe references so the audit trail does not become another privacy leak." },
              { t: "note", variant: "key", html: "Retention and deletion are not opposites. A mature platform can delete what policy allows, retain what law requires, restrict access to retained copies, and prove both decisions." },
              { t: "quiz", id: "de-dataops-privacy" }
            ]
          }
        ]
      },
      {
        id: "cost", name: "Cost & FinOps", icon: "trend",
        lessons: [
          {
            id: "cost", title: "Cost optimization (FinOps for data)",
            summary: "Analytics bills scale with bytes scanned and compute running \u2014 control both.",
            minutes: 6, tags: ["cost", "finops"],
            blocks: [
              { t: "p", html: "Cloud analytics costs track two things: <strong>compute</strong> (warehouse time / slots) and <strong>bytes scanned</strong>. <strong>FinOps for data</strong> is the discipline of keeping both in check without throttling the business." },
              { t: "widget", id: "de-ops-cost-lab" },
              { t: "ul", items: [
                "<strong>Auto-suspend</strong> idle warehouses; right-size them per workload.",
                "<strong>Prune scans</strong> with partitioning, clustering and " + tok("SELECT") + " of only needed columns.",
                "<strong>Materialize</strong> expensive repeated queries instead of re-scanning.",
                "<strong>Tier storage</strong> and expire old partitions; <strong>chargeback</strong> cost to teams."
              ] },
              { t: "note", variant: "tip", html: "The biggest lever ties back to the storage track: <strong>scan less data</strong>. Partition pruning and column projection cut the dominant cost line far more than fiddling with warehouse size." },
              { t: "note", variant: "tip", html: "Attribute cost to teams (chargeback/showback). Nothing curbs a runaway " + tok("SELECT *") + " dashboard faster than the owning team seeing its bill." },
              { t: "note", variant: "tip", html: "<strong>Snowflake specifics.</strong> The Glacier atlas (Snowflake) in this collection goes deeper on per-second warehouse billing, auto-suspend, resource monitors and credit attribution in <em>Cost &amp; FinOps</em>, and on sizing and workload isolation in <em>Warehouses &amp; Query Performance \u203a Virtual Warehouses</em>." },
              { t: "note", variant: "key", html: "<strong>Analytics spend is a layout problem wearing a finance costume.</strong> Idle warehouses and oversized clusters are the visible waste and the easiest to fix, but the line that grows with the business is bytes read per query \u2014 and that was set by the partitioning, clustering and column choices made when the table was written. No amount of query-time tuning rescues a table laid out for the wrong access pattern; you rewrite the table or you keep paying." }
            ]
          },
          {
            id: "cost-incidents", title: "Cost incidents: the runaway query",
            summary: "Cloud data systems fail financially too: a single dashboard or backfill can burn the monthly budget.",
            minutes: 6, tags: ["cost", "finops", "incident"],
            blocks: [
              { t: "p", html: "In elastic analytics, failure can mean <em>too much success</em>: a dashboard refreshes every minute, a query loses partition pruning, or a backfill runs on the largest warehouse all weekend. The bill is the alert." },
              { t: "table", headers: ["Root cause", "Patch"], rows: [
                ["SELECT * over wide historical tables", "Column projection, partition filters and query review"],
                ["Auto-suspend disabled", "Short idle timeout and workload-specific warehouses"],
                ["Cartesian join or missing join key", "Query linting, row-count guardrails and EXPLAIN review"],
                ["Backfill scans all history repeatedly", "Process bounded partitions once and checkpoint progress"],
                ["No owner on expensive jobs", "Showback/chargeback with dataset and job ownership"]
              ] },
              { t: "note", variant: "tip", html: "Cost observability belongs next to freshness and quality. Alert on spend anomalies before finance becomes your monitoring system." },
              { t: "note", variant: "key", html: "<strong>Elastic compute removed the ceiling that used to stop a bad query.</strong> On fixed hardware a runaway job simply ran slowly and somebody noticed; on metered compute it succeeds, on schedule, every few minutes, and the only feedback arrives on an invoice weeks later. Put the ceiling back on purpose \u2014 warehouse size caps, scan quotas, refresh intervals and a named owner on every scheduled job \u2014 because spend is the one failure mode with no natural backpressure." },
              { t: "quiz", id: "de-dataops-cost" }
            ]
          }
        ]
      },
      {
        id: "capstone", name: "Production Capstones", icon: "map",
        lessons: [
          {
            id: "platform-artifact-capstone", title: "Capstone: platform artifact pack",
            summary: "Produce the artifacts a real platform review would expect: ADR, contracts, graph, lineage, SLOs and runbooks.",
            minutes: 12, tags: ["capstone", "adr", "lineage", "runbook"],
            blocks: [
              { t: "p", html: "This capstone is not a single diagram. It is the artifact pack that lets another engineer operate the platform after you leave the room. The scenario: an orders product must serve executive BI, operational dashboards, backfills, privacy deletion and near-real-time updates." },
              { t: "h", text: "1. Architecture Decision Record" },
              { t: "table", headers: ["Choice", "When it wins", "Trade-off to document"], rows: [
                ["Batch lakehouse", "Finance wants replayable history, low cost and governed tables", "Higher latency than event-first serving"],
                ["Streaming mart", "Operations needs fresh metrics within minutes", "More state, offset and late-event complexity"],
                ["Hybrid lakehouse", "CDC stream lands into bronze/silver/gold with batch backfills", "Two operating modes must share contracts and lineage"]
              ] },
              { t: "note", variant: "tip", html: "The ADR should name the decision, context, rejected options, consequences and rollback trigger. Do not write 'we chose lakehouse' without explaining what latency, replay, governance and cost trade-offs made it right." },
              { t: "h", text: "2. Contract and migration plan" },
              { t: "code", lang: "yaml", code:
                "contract: orders_product.v2\n" +
                "producer: commerce-db-cdc\n" +
                "consumers: [exec_revenue, ops_fulfillment, finance_close]\n" +
                "compatibility: add_then_deprecate\n" +
                "schema:\n" +
                "  order_id: { type: string, required: true, key: true }\n" +
                "  event_time: { type: timestamp, required: true }\n" +
                "  booked_amount: { type: decimal(18,2), required: true }\n" +
                "  customer_token: { type: string, required: false, policy_tag: pii_token }\n" +
                "migration:\n" +
                "  dual_write: [amount, booked_amount]\n" +
                "  backfill_window: \"2024-01-01..present\"\n" +
                "  consumer_cutover: \"30 days after validation\"\n" +
                "  removal_gate: \"no lineage usage of amount for 14 days\"" },
              { t: "h", text: "3. DAG and dbt graph" },
              { t: "code", lang: "text", code:
                "Airflow/Dagster graph:\n" +
                "  cdc_snapshot_orders -> bronze.orders -> silver.orders -> gold.fct_orders -> dashboards\n" +
                "  cdc_orders_stream  -> bronze.orders -> silver.orders -> gold.fct_orders -> freshness SLO\n" +
                "\n" +
                "dbt graph:\n" +
                "  source('bronze','orders')\n" +
                "    -> stg_orders\n" +
                "    -> int_orders_enriched\n" +
                "    -> fct_orders\n" +
                "    -> mart_revenue_daily" },
              { t: "h", text: "4. OpenLineage event and SLO dashboard" },
              { t: "code", lang: "json", code:
                "{\n" +
                "  \"eventType\": \"COMPLETE\",\n" +
                "  \"job\": { \"namespace\": \"cascade.capstone\", \"name\": \"build_fct_orders\" },\n" +
                "  \"run\": { \"runId\": \"scheduled__2024-06-01T07:00\" },\n" +
                "  \"inputs\": [{ \"namespace\": \"lake\", \"name\": \"silver.orders\" }],\n" +
                "  \"outputs\": [{ \"namespace\": \"lake\", \"name\": \"gold.fct_orders\" }],\n" +
                "  \"facets\": {\n" +
                "    \"schema\": \"order_id,event_time,booked_amount,customer_token\",\n" +
                "    \"quality\": \"critical_tests_passed\",\n" +
                "    \"slo\": \"fresh_by_07_00_met\",\n" +
                "    \"owner\": \"commerce-analytics\"\n" +
                "  }\n" +
                "}" },
              { t: "table", headers: ["Dashboard tile", "Healthy", "Page when"], rows: [
                ["Freshness", "gold.fct_orders updated by 07:00", "SLO burn means consumers will miss decisions"],
                ["Completeness", "source/target count variance below 2%", "variance crosses threshold after retry"],
                ["Quality", "critical tests pass before publish", "failed tests block certified output"],
                ["Cost", "daily credits within forecast band", "spend anomaly persists after warehouse cap"],
                ["Consumer impact", "affected dashboards marked trusted", "stale label remains past communicated ETA"]
              ] },
              { t: "h", text: "5. Incident runbook and backfill plan" },
              { t: "ol", items: [
                "<strong>Declare impact</strong> \u2014 affected assets, dates, dashboards, current freshness and next update time.",
                "<strong>Stop expansion</strong> \u2014 pause optional backfills, freeze bad publishes and label dashboards stale.",
                "<strong>Find root cause</strong> \u2014 use lineage and run facets to locate the first failed or bad-producing job.",
                "<strong>Repair safely</strong> \u2014 patch source/transform, run bounded partitions into a shadow target, compare counts/distributions.",
                "<strong>Publish atomically</strong> \u2014 swap or promote validated partitions, then emit final lineage and quality events.",
                "<strong>Close with proof</strong> \u2014 RCA, changed partitions, consumer actions, prevention test, cost impact and owner."
              ] },
              { t: "h", text: "Grading rubric" },
              { t: "table", headers: ["Artifact", "Meets bar"], rows: [
                ["ADR", "States decision, context, rejected options, consequences and rollback trigger"],
                ["Contract pack", "Defines schema, grain, ownership, compatibility, tests and migration window"],
                ["Execution graph", "Shows orchestration and dbt dependencies with idempotent backfill boundaries"],
                ["Runtime evidence", "Includes lineage event shape, SLO dashboard tiles and consumer impact signals"],
                ["Runbook", "Covers impact comms, root-cause workflow, shadow validation, atomic publish and closure proof"]
              ] },
              { t: "note", variant: "tip", html: "A great capstone is operable. Reviewers should be able to answer: why this architecture, what contracts guard it, what graph runs it, what SLOs prove health, and exactly how to recover when it breaks." },
              { t: "note", variant: "key", html: "<strong>The artifact pack is the design — the diagram is only its cover page.</strong> A contract states what consumers are allowed to rely on, an ADR records the option you rejected and why, lineage answers what breaks when this table does, and a runbook answers what to do at three in the morning. Remove any one of them and the platform still runs, but it stops being operable by anyone except you — which is exactly the difference a reviewer is listening for between a design you can hand over and a design that needs you in the room. Use the <a class='inline' href='#/interview/orders-data-product'>orders data product prompt</a>, <a class='inline' href='#/cheatsheets/data-contract-template'>contract template</a> and <a class='inline' href='#/rubrics'>rubrics</a> as the model-answer reference set." },
              { t: "quiz", id: "de-dataops-capstone" }
            ]
          },
          {
            id: "capstone-pipeline", title: "Capstone: build a production data product",
            summary: "Design the full path from operational changes to trusted analytics, with failure handling built in.",
            minutes: 12, tags: ["capstone", "data-product"],
            blocks: [
              { t: "p", html: "Capstone brief: build an orders data product for executives and operations. Source is an OLTP database, consumers need near-real-time metrics, finance needs historical correctness, and privacy requires masking customer fields." },
              { t: "h", text: "Required design" },
              { t: "ol", items: [
                "<strong>Ingest</strong>: initial snapshot plus CDC stream, with offsets and reconciliation counts.",
                "<strong>Store</strong>: raw bronze, cleaned silver and curated gold tables in an open table format.",
                "<strong>Model</strong>: star schema with order facts, customer/product dimensions and slowly changing customer attributes.",
                "<strong>Transform</strong>: idempotent incremental jobs with backfill by partition.",
                "<strong>Quality</strong>: contracts, not-null/unique tests, freshness and volume monitors.",
                "<strong>Governance</strong>: PII classification, masking policies, ownership and retention.",
                "<strong>Operate</strong>: lineage, runbooks, cost alerts and an RCA template for incidents."
              ] },
              { t: "h", text: "Grading rubric" },
              { t: "table", headers: ["Area", "Checklist"], rows: [
                ["Ingestion", "Snapshot/log boundary, CDC offsets, tombstones, dedupe and source-target reconciliation"],
                ["Lakehouse design", "Bronze/silver/gold tables, open table format, partitioning, compaction and retention policy"],
                ["Modeling", "Declared grain, facts/dimensions, SCD handling, semantic metric definitions and versioned output port"],
                ["Reliability", "Idempotent incremental jobs, late-arrival lookback, bounded backfill and quality gates"],
                ["Operations", "Owner, SLOs, lineage, privacy workflow, cost alert and incident communication template"]
              ] },
              { t: "note", variant: "tip", html: "A production data product is not done when the dashboard loads. It is done when the next schema change, late file, cost spike and deletion request have a rehearsed path." },
              { t: "note", variant: "key", html: "<strong>A data product is finished when somebody else can trust it without asking you.</strong> Published freshness and quality SLOs, a contract that pins the schema, and a named owner are what turn a working pipeline into something a consumer can safely build on — and every one of them is cheap to add now and close to impossible to retrofit once dashboards already depend on the table. That asymmetry is the whole argument: the work that makes data trustworthy has to happen before anyone trusts it. Before marking this complete, check your design against <a class='inline' href='#/scenarios'>scenario packs</a> for schema drift, tiny files, cost spikes and privacy deletion, then grade the answer with <a class='inline' href='#/rubrics/senior'>senior rubric signals</a>." }
            ]
          }
        ]
      }
    ]
  };
})();
