/* =====================================================================
   CASCADE · Practice/content-quality layer
   Static, original, offline-only prompts and reference material.
   ===================================================================== */
(function () {
  "use strict";

  window.CascadePractice = {
    routes: [
      { route: "#/scenarios", title: "Scenario packs", blurb: "War-room drills with compact model-answer outlines." },
      { route: "#/interview", title: "Interview prompts", blurb: "Open-ended prompts for system design and debugging practice." },
      { route: "#/rubrics", title: "Rubrics", blurb: "Beginner, competent and senior answer bands." },
      { route: "#/cheatsheets", title: "Cheat sheets", blurb: "Compact checklists for the most common production moves." },
      { route: "#/glossary", title: "Glossary", blurb: "Short definitions with internal cross-links." }
    ],

    scenarios: [
      {
        id: "cdc-schema-drift",
        title: "CDC schema drift",
        brief: "A producer adds a nullable field, changes one enum value, and stops sending a field that downstream marts still read. The CDC stream is green, but revenue and fulfillment dashboards disagree.",
        prompts: ["What do you freeze first?", "How do you prove the blast radius?", "What is the safe migration path?"],
        model: [
          "Label affected outputs stale and pause optional downstream publishes.",
          "Use contracts, schema history and lineage to identify consumers that read changed fields.",
          "Classify changes as additive, semantic or breaking; restore the old field or publish a versioned interface.",
          "Backfill bounded partitions into a shadow target, reconcile counts and key metrics, then publish atomically.",
          "Add producer CI checks for compatibility, enum expansion handling and delete/update semantics."
        ],
        refs: { cheatsheets: ["cdc-failure-modes", "data-contract-template"], glossary: ["cdc", "contract", "lineage"] }
      },
      {
        id: "lakehouse-tiny-file-incident",
        title: "Lakehouse tiny-file incident",
        brief: "A streaming writer created many small files overnight. Planning latency rose, compaction did not run, dashboards are late, and storage cost is climbing.",
        prompts: ["How do you stabilize without losing data?", "Which maintenance actions are safe now?", "What do you tell consumers?"],
        model: [
          "Declare impact: affected tables, freshness gap, owner, mitigation and next update.",
          "Stop duplicate retries and tune the writer so new files are larger and idempotent.",
          "Compact hot partitions first, then validate counts and distributions before publish.",
          "Expire snapshots only after rollback needs are clear; clean orphan files after a retention-safe window.",
          "Close with an RCA, prevention monitor and maintenance cadence."
        ],
        refs: { cheatsheets: ["lakehouse-maintenance", "backfill-checklist"], glossary: ["compaction", "partition-pruning", "sli-slo"] }
      },
      {
        id: "cost-spike-war-room",
        title: "Cost spike war room",
        brief: "A dashboard refresh and a historical backfill started together. Compute is scaling up, scan bytes jumped, and the owning team needs a mitigation plan.",
        prompts: ["What do you cap immediately?", "How do you distinguish waste from necessary spend?", "What guardrail prevents recurrence?"],
        model: [
          "Set a temporary spend cap and pause nonessential backfills or refreshes.",
          "Group cost by job, dataset and owner; inspect scan bytes, concurrency, warehouse size and idle time.",
          "Patch the worst query with projection, partition filters, materialization or bounded backfill checkpoints.",
          "Right-size compute and auto-suspend idle workloads.",
          "Add spend anomaly alerts, query review for high-scan changes and owner showback."
        ],
        refs: { cheatsheets: ["warehouse-cost-controls", "backfill-checklist"], glossary: ["partition-pruning", "sli-slo", "lineage"] }
      },
      {
        id: "privacy-deletion-request",
        title: "Privacy deletion request",
        brief: "A user deletion request arrives for a subject whose data appears in raw logs, curated dimensions, aggregates, exports and backups.",
        prompts: ["How do you find every copy?", "When is masking acceptable?", "What belongs in the proof artifact?"],
        model: [
          "Start from a request id and subject key; discover copies through catalog tags, lineage and export manifests.",
          "Delete direct identifiers where policy allows; mask or tokenize fields when aggregates must remain valid.",
          "Use table-format deletes or merge logic, validate affected counts and record retained exceptions.",
          "Respect retention and legal-hold boundaries while restricting access to retained copies.",
          "Produce audit proof with assets touched, counts, exceptions and reviewer approval without raw PII."
        ],
        refs: { cheatsheets: ["backfill-checklist", "data-contract-template"], glossary: ["pii-tag", "lineage", "idempotency"] }
      }
    ],

    interview: [
      {
        id: "orders-data-product",
        title: "Design an orders data product",
        prompt: "Design a reliable orders data product for analytics, operations and finance. Cover ingestion, modeling, quality, governance, SLOs and incident handling.",
        outline: [
          "State the grain and consumers before choosing architecture.",
          "Use snapshot plus CDC with reconciliation, idempotent sinks and delete handling.",
          "Model facts and dimensions with versioned contracts and semantic metrics.",
          "Add freshness, completeness and quality gates before certified publish.",
          "Expose owner, lineage, PII tags, cost signals and a backfill runbook."
        ]
      },
      {
        id: "exactly-once-effectively-once",
        title: "Exactly-once vs effectively-once",
        prompt: "Explain exactly-once and effectively-once delivery for a data pipeline. What guarantees matter at the source, processor and sink?",
        outline: [
          "Separate transport delivery from end-to-end correctness.",
          "Call out retries, duplicate events, out-of-order updates and checkpoint commits.",
          "Prefer idempotent writes keyed by business key plus event version.",
          "Use reconciliation to detect gaps; do not trust a green connector alone.",
          "Summarize the guarantee as recoverable, replayable and duplicate-safe."
        ]
      },
      {
        id: "late-dashboard-debug",
        title: "Debug a late dashboard",
        prompt: "An executive dashboard is two hours late but no task has failed. Walk through your debug plan.",
        outline: [
          "Check freshness SLO, last successful publish and stale labels first.",
          "Walk lineage upstream to the first missing, late or partial dataset.",
          "Compare volume, schema and distribution monitors for silent data issues.",
          "Decide whether to republish, backfill or hold the dashboard stale.",
          "Communicate impact, ETA, owner and next update before deep tuning."
        ]
      },
      {
        id: "data-contract-rollout",
        title: "Roll out a data contract",
        prompt: "A producer wants to rename a field used by several consumers. Design the contract rollout.",
        outline: [
          "Classify the rename as breaking and inventory consumers through lineage.",
          "Publish a versioned or additive field while keeping the old one stable.",
          "Dual-write, backfill and run consumer-driven contract tests.",
          "Track migration status and define a removal gate based on usage.",
          "Document ownership, compatibility rules, SLOs and rollback."
        ]
      },
      {
        id: "batch-streaming-hybrid-lakehouse",
        title: "Batch vs streaming vs hybrid lakehouse",
        prompt: "Choose between batch, streaming and a hybrid lakehouse for a product with low-latency operations and replayable finance reporting.",
        outline: [
          "Tie the choice to latency, replay, cost, governance and operational burden.",
          "Batch wins for simplicity, bulk correctness and lower operating cost.",
          "Streaming wins for low-latency decisions but raises state and offset complexity.",
          "Hybrid can land CDC to a lakehouse and share contracts, lineage and backfills.",
          "Name failure modes: late data, duplicates, schema drift, tiny files and cost spikes."
        ]
      }
    ],

    rubrics: [
      {
        id: "beginner",
        band: "Beginner",
        signal: "Recognizes the concept and lists common components.",
        evidence: [
          "Names source, transform, storage and consumer layers.",
          "Mentions tests or monitoring but may not connect them to release gates.",
          "Handles happy-path design more confidently than failure paths."
        ]
      },
      {
        id: "competent",
        band: "Competent",
        signal: "Designs a workable pipeline with reliability and operations in mind.",
        evidence: [
          "States grain, ownership, contracts, SLOs and backfill boundaries.",
          "Uses idempotent writes, partitioned repair and source-target reconciliation.",
          "Communicates impact and validation steps during incidents."
        ]
      },
      {
        id: "senior",
        band: "Senior",
        signal: "Makes trade-offs explicit and designs for change, recovery and governance.",
        evidence: [
          "Compares batch, streaming and hybrid options against latency, replay, cost and risk.",
          "Uses lineage, contracts and metadata as control-plane inputs.",
          "Defines rollback, migration gates, privacy proof and prevention monitors."
        ]
      }
    ],

    rubricDimensions: [
      ["Problem framing", "Clarifies consumers, grain, freshness, correctness and privacy constraints."],
      ["Architecture trade-offs", "Explains why the chosen pattern fits and what it sacrifices."],
      ["Reliability", "Covers idempotency, retries, late data, reconciliation and backfills."],
      ["Operations", "Includes SLOs, lineage, ownership, incident communication and cost guardrails."],
      ["Governance", "Handles contracts, PII tags, access, retention and audit proof."]
    ],

    cheatSheets: [
      {
        id: "cdc-failure-modes",
        title: "CDC failure modes",
        items: [
          "Wrong offset after restart: persist checkpoints and reconcile source-to-target counts.",
          "Duplicate event: merge by primary key plus source version, not append.",
          "Out-of-order update: apply only the newest event version per key.",
          "Missing delete: test tombstones and hard-delete paths.",
          "Snapshot-stream overlap: fence the boundary and dedupe by key/version.",
          "Schema drift: enforce compatibility before the producer ships."
        ]
      },
      {
        id: "data-contract-template",
        title: "Data contract template",
        items: [
          "Dataset name, owner, consumers and escalation path.",
          "Declared grain, primary key and semantic meaning.",
          "Column type, nullability, allowed values and PII tag.",
          "Freshness, completeness and quality expectations.",
          "Compatibility policy: additive, versioned or breaking.",
          "Migration plan: dual-write, backfill, consumer cutover and removal gate."
        ]
      },
      {
        id: "data-quality-dimensions",
        title: "Data quality dimensions",
        items: [
          "Completeness: required values are present.",
          "Validity: values match type, range and allowed states.",
          "Uniqueness: keys are not duplicated unexpectedly.",
          "Consistency: related sources agree within a defined tolerance.",
          "Timeliness: data arrives before the consumer decision point.",
          "Accuracy: values reflect the source of truth or accepted reconciliation."
        ]
      },
      {
        id: "backfill-checklist",
        title: "Backfill checklist",
        items: [
          "Declare scope: partitions, datasets, consumers and owner.",
          "Make writes idempotent: overwrite partition or merge by key.",
          "Run into a shadow target when risk is high.",
          "Validate counts, null rates, distributions and sampled records.",
          "Publish atomically or checkpoint partition by partition.",
          "Communicate changed dates, impact, rollback and final proof."
        ]
      },
      {
        id: "lakehouse-maintenance",
        title: "Lakehouse maintenance",
        items: [
          "Compact small files on hot partitions first.",
          "Expire old snapshots after rollback and audit needs are clear.",
          "Clean orphan files only after a retention-safe window.",
          "Watch file count, average file size, manifest growth and planning latency.",
          "Tune streaming trigger size so new output is not tiny by default.",
          "Validate table counts after maintenance, before certified publish."
        ]
      },
      {
        id: "warehouse-cost-controls",
        title: "Warehouse cost controls",
        items: [
          "Project only needed columns and require partition filters for large tables.",
          "Right-size compute per workload and auto-suspend idle clusters.",
          "Materialize repeated expensive logic instead of rescanning history.",
          "Checkpoint backfills so history is processed once.",
          "Attach owner and purpose to expensive jobs.",
          "Alert on spend anomalies by dataset, job and team."
        ]
      }
    ],

    glossary: [
      { id: "grain", term: "Grain", definition: "The exact level represented by one row, such as one order line or one customer per day.", related: ["fact", "dimension", "contract"] },
      { id: "fact", term: "Fact", definition: "A measurable event or transaction table, usually additive and keyed to dimensions.", related: ["grain", "dimension"] },
      { id: "dimension", term: "Dimension", definition: "Descriptive context for facts, such as customer, product, location or calendar.", related: ["fact", "grain"] },
      { id: "cdc", term: "CDC", definition: "Change data capture: turning inserts, updates and deletes from a source into a replayable change stream.", related: ["watermark", "idempotency", "contract"] },
      { id: "watermark", term: "Watermark", definition: "A progress marker that says data up to a point has been observed or processed.", related: ["cdc", "idempotency"] },
      { id: "idempotency", term: "Idempotency", definition: "A property where rerunning the same operation produces the same final state.", related: ["watermark", "cdc"] },
      { id: "contract", term: "Contract", definition: "An explicit producer-consumer agreement for schema, semantics, ownership and service expectations.", related: ["grain", "cdc", "sli-slo"] },
      { id: "lineage", term: "Lineage", definition: "The graph of datasets, jobs and fields showing how data flows and what depends on what.", related: ["contract", "pii-tag", "sli-slo"] },
      { id: "sli-slo", term: "SLI/SLO", definition: "A service level indicator measures health; a service level objective defines the promised target.", related: ["lineage", "contract"] },
      { id: "compaction", term: "Compaction", definition: "Combining many small files into fewer larger files to reduce planning overhead and improve scans.", related: ["partition-pruning"] },
      { id: "partition-pruning", term: "Partition pruning", definition: "Skipping files or partitions that cannot match a query filter.", related: ["compaction"] },
      { id: "pii-tag", term: "PII tag", definition: "Metadata marking a field as sensitive so masking, access review and deletion workflows can act on it.", related: ["lineage", "contract"] }
    ]
  };
})();
