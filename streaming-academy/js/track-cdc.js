/* =====================================================================
   PULSE · CDC & Integration
   window.TRACKS.cdc — modules: capture / pipelines
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks, quiz) {
    if (quiz) blocks.splice(blocks.length - 1, 0, { t: "quiz", id: quiz });
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "cdc-capture": {
      title: "Change capture checkpoint",
      sub: "Log-based CDC, snapshots and the outbox pattern.",
      questions: [
        { q: "Why is log-based CDC preferred over polling with an updated_at column?", options: ["It is simpler to configure", "It works without a primary key", "It does not need database permissions", "It captures every change including deletes and intermediate updates, in commit order, without querying the tables"], answer: 3, explain: "Polling misses deletes, collapses multiple updates between polls, and loads the database. Reading the transaction log sees every committed change in order." },
        { q: "A PostgreSQL CDC connector has been stopped for two days. What is the operational risk?", options: ["None", "The connector forgets its schema", "The replication slot retains WAL until it is consumed, so database disk can fill", "Kafka deletes the topic"], answer: 2, explain: "A logical replication slot prevents WAL cleanup until the consumer confirms progress. An abandoned slot is a classic way to fill a primary's disk." },
        { q: "What problem does the transactional outbox pattern solve?", options: ["The dual write: updating the database and publishing an event atomically without distributed transactions", "Slow queries", "Schema evolution", "Consumer lag"], answer: 0, explain: "The service writes its business change and an outbox row in one local transaction; CDC publishes the outbox row. Either both happen or neither does." },
        { q: "How do incremental (chunked) snapshots improve on a blocking initial snapshot?", options: ["They skip historical data", "They require a database restart", "They lock the table for less time", "They read the table in key-ordered chunks interleaved with log events, so streaming continues and snapshots can resume or be re-run per table"], answer: 3, explain: "Chunked snapshots watermark each chunk against the log so changes during the snapshot are reconciled. Streaming never stops, and you can re-snapshot one table on demand." },
        { q: "How should a downstream table handle a CDC delete event?", options: ["Ignore it", "Apply it as a delete (or soft delete) by primary key; on compacted topics a tombstone follows so the key is eventually removed", "Insert a new row", "Truncate the table"], answer: 1, explain: "CDC delete events carry the key and the before image. Consumers apply them by key; the tombstone lets compaction drop the key from the topic." }
      ]
    },
    "cdc-pipelines": {
      title: "Integration pipelines checkpoint",
      sub: "Kafka Connect, schema changes and CDC into the lakehouse.",
      questions: [
        { q: "In Kafka Connect, what is the difference between a connector and a task?", options: ["They are the same", "A task is a topic", "A connector is the configured job and splits work into tasks, which are the parallel units that actually copy data", "Tasks are only for sinks"], answer: 2, explain: "The connector plans the work; tasks run it, distributed across workers. Parallelism is set by the task maximum and limited by how the source can be split." },
        { q: "Where should a bad record go when a sink connector cannot convert it?", options: ["A dead-letter topic with error context, with tolerance configured so one record does not stop the pipeline", "Nowhere; stop the connector", "Back to the source", "The schema registry"], answer: 0, explain: "A dead-letter queue keeps the pipeline moving and preserves the failure for inspection. Alert on its rate, because silently tolerating errors hides data loss." },
        { q: "A source table adds a nullable column. What should happen downstream?", options: ["The pipeline must stop", "The column is ignored for ever", "Every consumer must be redeployed first", "The registry accepts a compatible new schema version and the lakehouse target evolves to add the column"], answer: 3, explain: "Additive nullable changes are compatible. The pipeline should evolve the target schema automatically or through a reviewed migration, without stopping." },
        { q: "What is the standard way to apply CDC events to a lakehouse table?", options: ["Append every event and query the latest per key", "MERGE micro-batches by primary key, ordering events within a batch by log position so the last change per key wins", "Overwrite the table every minute", "Insert only creates"], answer: 1, explain: "MERGE by key with deduplication by log position (LSN or binlog offset) applies inserts, updates and deletes correctly and idempotently." },
        { q: "Why keep the raw CDC changelog in addition to the merged current-state table?", options: ["It is required by Kafka", "It is smaller", "It lets you rebuild the current table, audit history and build point-in-time views after a bug", "It speeds up queries"], answer: 2, explain: "The merged table only holds the latest state. The append-only changelog is the history you replay to fix a bad merge or answer as-of questions." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.cdc = {
    id: "cdc",
    name: "CDC & Integration",
    short: "CDC",
    tagline: "Databases as streams",
    color: "#60a5fa",
    blurb: "Turning databases into streams safely: log-based change data capture, change-event anatomy, initial and incremental snapshots, replication-slot and binlog hazards, the transactional outbox, Kafka Connect workers, tasks and dead-letter queues, schema changes in flight, and merging changelogs into lakehouse tables.",
    modules: [
      {
        id: "capture",
        name: "Change Capture",
        icon: "database",
        lessons: [
          L("log-based-cdc", "Log-based change data capture", "Read the database's own transaction log to stream every committed insert, update and delete in order.", 9, ["cdc", "debezium", "databases"], [
            { t: "p", html: "Every serious database keeps a transaction log for durability and replication: PostgreSQL's write-ahead log, MySQL's binlog, Oracle's redo log, SQL Server's transaction log. <strong>Log-based CDC</strong> reads that log as a replication client and turns each committed row change into an event. Connectors such as Debezium do this and publish one topic per table." },
            { t: "compare", bad: { title: "Query-based polling", items: ["Misses deletes", "Collapses updates between polls", "Needs an updated_at column everywhere", "Loads the database with scans"] }, good: { title: "Log-based CDC", items: ["Every change, including deletes", "Commit order per row", "No schema changes to tables", "Low load: reads the log"] } },
            { t: "code", lang: "text", code: "change event (simplified)\n{\n  \"op\": \"u\",                       // c=create, u=update, d=delete, r=snapshot read\n  \"before\": {\"id\": 42, \"status\": \"PENDING\"},\n  \"after\":  {\"id\": 42, \"status\": \"PAID\"},\n  \"source\": {\"table\": \"orders\", \"lsn\": 98123441, \"ts_ms\": 1767225600000},\n  \"ts_ms\": 1767225600150\n}\nkey: {\"id\": 42}   -> same row, same partition, in order" },
            { t: "table", headers: ["Database", "Log", "Prerequisite"], rows: [["PostgreSQL", "WAL via logical decoding", "wal_level=logical, a replication slot, a publication"], ["MySQL / MariaDB", "Binlog", "Row-based binlog format, full row image"], ["SQL Server", "Transaction log via CDC tables", "CDC enabled per database and table"], ["Oracle", "Redo log", "Supplemental logging; a log-mining approach"]] },
            { t: "note", variant: "warn", html: "CDC needs privileged replication access. Give the connector a dedicated, least-privilege account, and keep its credentials in a secret store referenced by the connector config \u2014 never inline in the JSON you commit." },
            { t: "note", variant: "key", html: "<strong>CDC reads the transaction log, not the tables.</strong> You get every committed change in order per key, at low cost \u2014 in exchange for replication privileges and log-retention responsibilities." }
          ]),
          L("snapshots", "Snapshots, slots and log retention", "Bootstrap with a snapshot, then stream; and never let an idle reader pin the database's log.", 8, ["cdc", "snapshots", "operations"], [
            { t: "p", html: "A new CDC pipeline needs the current contents of each table, not just future changes. It takes a <strong>snapshot</strong> \u2014 reading existing rows as <code class='tok'>op=r</code> events \u2014 then switches to streaming from the log position recorded at the start. Older connectors did this as a blocking pass; modern ones support <strong>incremental snapshots</strong> that read in key-ordered chunks interleaved with live changes." },
            { t: "table", headers: ["Approach", "Pros", "Cons"], rows: [["Initial blocking snapshot", "Simple, consistent", "Long for big tables; streaming waits"], ["Incremental (chunked) snapshot", "Streaming continues; resumable; re-run per table", "More moving parts; dedup chunks against log events"], ["No snapshot (log only)", "Fast start", "Only future changes; history must come from elsewhere"]] },
            { t: "p", html: "The database keeps log segments until every replication reader has consumed them. In PostgreSQL, a <strong>replication slot</strong> pins WAL until the connector confirms its position; in MySQL, binlog retention is time-based and a connector offline longer than retention loses its place and must re-snapshot." },
            { t: "note", variant: "trap", html: "An abandoned PostgreSQL slot is a disk-filling time bomb on the primary. Alert on slot lag (retained WAL bytes), and drop slots for connectors that are retired." },
            { t: "note", variant: "tip", html: "Low-traffic databases can starve a slot's progress if the connector only advances on captured tables. Heartbeat settings that periodically emit and confirm progress keep WAL from accumulating." },
            { t: "note", variant: "key", html: "<strong>Snapshot, then stream from the recorded position.</strong> Prefer incremental snapshots, and monitor slot or binlog lag as closely as consumer lag." }
          ]),
          L("outbox", "The transactional outbox", "Write the business change and the event in one local transaction; let CDC publish the event.", 8, ["outbox", "dual-write", "microservices"], [
            { t: "p", html: "A service that updates its database and then publishes an event to Kafka has a <strong>dual write</strong>: if it crashes between the two, the database and the stream disagree for ever. Distributed transactions across both are rarely available or worth it. The <strong>outbox pattern</strong> avoids the problem by writing the event into an <code class='tok'>outbox</code> table in the <em>same</em> local transaction as the business change, and letting CDC publish outbox rows." },
            { t: "code", lang: "sql", code: "BEGIN;\nUPDATE orders SET status = 'PAID' WHERE id = 42;\nINSERT INTO outbox (id, aggregate_type, aggregate_id, type, payload)\nVALUES (gen_random_uuid(), 'order', '42', 'OrderPaid', '{\"orderId\":42,\"amount\":129.00}');\nCOMMIT;\n-- CDC reads the outbox insert from the log and routes it to topic order.events, key 42" },
            { t: "ul", items: ["The event's id gives consumers a natural deduplication key.", "Events are designed for consumers (a public contract), not raw table rows.", "Outbox rows can be deleted right after insert; the log still carries them.", "Order per aggregate is preserved by keying on aggregate id."] },
            { t: "note", variant: "warn", html: "Publishing raw CDC from internal tables couples every consumer to your schema. Use raw CDC for analytics replication; use an outbox for events other services build behaviour on." },
            { t: "note", variant: "key", html: "<strong>One local transaction, one published event.</strong> The outbox removes the dual write and gives consumers a stable contract and a dedup key." }
          ], "cdc-capture")
        ]
      },
      {
        id: "pipelines",
        name: "Integration Pipelines",
        icon: "plug",
        lessons: [
          L("kafka-connect", "Kafka Connect: workers, tasks and dead letters", "A framework for source and sink connectors with distributed workers, offsets in Kafka, and error handling you must configure.", 8, ["kafka-connect", "integration"], [
            { t: "p", html: "<strong>Kafka Connect</strong> runs connectors \u2014 sources that write into Kafka and sinks that read from it \u2014 on a cluster of <strong>workers</strong>. A connector is configuration; it splits work into <strong>tasks</strong>, which the workers run and rebalance among themselves. Connect stores connector configs, source offsets and status in internal Kafka topics, so workers are stateless and replaceable." },
            { t: "table", headers: ["Concern", "Setting or pattern", "Default trap"], rows: [["Parallelism", "tasks.max", "Capped by how the source splits (one task per table or partition)"], ["Conversion", "Key and value converters with a schema registry", "JSON without schemas loses types"], ["Bad records", "errors.tolerance + dead-letter topic", "Default stops the task on the first bad record"], ["Light transforms", "Single message transforms (SMTs)", "Business logic hidden in config"], ["Secrets", "Config providers that read from a vault or files", "Passwords pasted into connector JSON"]] },
            { t: "note", variant: "trap", html: "Tolerating all errors without a dead-letter topic and an alert silently drops data. If you tolerate errors, route them to a dead-letter queue and page on its rate." },
            { t: "note", variant: "tip", html: "Use a config provider for credentials so connector definitions in version control contain references, not secrets. Rotation then touches the secret store, not every connector." },
            { t: "note", variant: "key", html: "<strong>Connect gives you managed, restartable data movement.</strong> Set task parallelism, schema-aware converters, a dead-letter queue and externalised secrets on day one." }
          ]),
          L("cdc-schema-changes", "Schema changes in a CDC pipeline", "DDL flows through the pipeline; additive changes should pass automatically and breaking ones need a plan.", 8, ["cdc", "schemas", "evolution"], [
            { t: "p", html: "Source teams change tables: add columns, widen types, rename, drop. In a CDC pipeline, each change produces a new event schema, which the registry checks and the sinks must absorb. The goal is that <strong>additive changes flow through untouched</strong> and breaking changes are caught before they reach production." },
            { t: "table", headers: ["Source DDL", "Event schema effect", "Downstream handling"], rows: [["Add nullable column", "New optional field", "Auto-evolve the target table"], ["Widen type (int to bigint)", "Type promotion", "Usually compatible; verify the sink"], ["Rename column", "Drop plus add", "Breaking: coordinate, or alias in a view"], ["Drop column", "Field removed", "Breaking for consumers that require it"], ["Change primary key", "Key schema changes", "New topic and a re-snapshot"]] },
            { t: "note", variant: "warn", html: "A primary-key change alters the message key, so the same row may now hash to a different partition and old and new events for it interleave. Treat it as a new pipeline." },
            { t: "note", variant: "tip", html: "Put the producing team's DDL through the same contract checks as a batch data contract: CI that compares the new schema against the registry before migration runs." },
            { t: "note", variant: "key", html: "<strong>Additive is automatic; everything else is a coordinated change.</strong> Registry compatibility catches the break, and key changes mean a new topic." }
          ]),
          L("cdc-to-lakehouse", "CDC into the lakehouse", "Land the raw changelog, then MERGE by key and log position into current-state tables.", 9, ["cdc", "lakehouse", "merge"], [
            { t: "p", html: "The most common CDC destination is an analytical table that mirrors the source. The robust shape has two layers: an <strong>append-only changelog</strong> table with every event, and a <strong>current-state</strong> table maintained by <code class='tok'>MERGE</code> from it. The changelog is history and a replay source; the merged table is what analysts query." },
            { t: "code", lang: "sql", code: "MERGE INTO orders_current t\nUSING (\n  SELECT * FROM (\n    SELECT *, ROW_NUMBER() OVER (PARTITION BY id ORDER BY lsn DESC) AS rn\n    FROM orders_changelog_batch\n  ) WHERE rn = 1                     -- last change per key in this micro-batch\n) s\nON t.id = s.id\nWHEN MATCHED AND s.op = 'd' THEN DELETE\nWHEN MATCHED AND s.lsn > t.lsn THEN UPDATE SET *\nWHEN NOT MATCHED AND s.op <> 'd' THEN INSERT *;" },
            { t: "ul", items: ["<strong>Order by log position</strong> (LSN, binlog file and position), not by timestamp: commit time ties and clock skew lie.", "<strong>Guard with the stored position</strong> (<code class='tok'>s.lsn &gt; t.lsn</code>) so replays never move a row backwards.", "<strong>Micro-batch</strong> the merge (every minute or so) \u2014 per-event merges are expensive on file-based tables.", "<strong>Compact</strong> regularly; frequent merges create many small files."] },
            { t: "note", variant: "tip", html: "The Cascade atlas (data engineering) in this collection covers Delta MERGE and change data feeds in <em>Databricks &amp; Delta Lake \u203a Delta Lake Internals \u203a MERGE, CDC &amp; change data feed</em>, and the Glacier atlas (Snowflake) covers streams and dynamic tables for the same job on Snowflake." },
            { t: "note", variant: "key", html: "<strong>Keep the changelog, merge by key and log position.</strong> The guard on position makes replays safe, and the raw history makes every bad merge recoverable." }
          ], "cdc-pipelines")
        ]
      }
    ]
  };
})();
