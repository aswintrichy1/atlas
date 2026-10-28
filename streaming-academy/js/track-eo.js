/* =====================================================================
   PULSE · Exactly-Once & Transactions
   window.TRACKS.eo — modules: guarantees / endtoend
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks, quiz) {
    if (quiz) blocks.splice(blocks.length - 1, 0, { t: "quiz", id: quiz });
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "eo-guarantees": {
      title: "Kafka transactions checkpoint",
      sub: "What exactly-once means and how Kafka implements it.",
      questions: [
        { q: "In consume-transform-produce with Kafka transactions, what is committed atomically?", options: ["Only the output records", "Only the consumer offsets", "The output records and the input offsets, in one transaction", "The schema and the records"], answer: 2, explain: "sendOffsetsToTransaction puts the consumer's progress into the same transaction as the output, so either both become visible or neither does." },
        { q: "A consumer reads a topic written transactionally but uses the default read_uncommitted isolation. What can it see?", options: ["Records from aborted transactions", "Nothing until the transaction commits", "Only committed records", "Only control markers"], answer: 0, explain: "read_uncommitted returns everything appended, including records later aborted. Consumers must use read_committed to see only committed transactional data." },
        { q: "What is the purpose of transactional.id?", options: ["It names the topic", "It enables compression", "It sets the batch size", "It identifies one logical producer across restarts so the coordinator can fence older instances (zombies) and finish or abort their open transactions"], answer: 3, explain: "A stable transactional.id lets a restarted producer take over: the coordinator bumps the epoch, and any old instance still running is fenced off." },
        { q: "What does the last stable offset (LSO) control?", options: ["Retention", "Leader election", "Compaction", "How far read_committed consumers can read: no further than the first open transaction"], answer: 3, explain: "read_committed consumers cannot pass an open transaction, because it may still abort. A long-running transaction therefore stalls every committed reader of that partition." },
        { q: "Kafka exactly-once covers which boundary by itself?", options: ["Kafka to any database", "Kafka to HTTP APIs", "Reads from and writes to Kafka inside one transaction", "Every external system"], answer: 2, explain: "Kafka transactions make Kafka-to-Kafka processing atomic. External sinks need their own transactional or idempotent integration." }
      ]
    },
    "eo-endtoend": {
      title: "End-to-end exactly-once checkpoint",
      sub: "Two-phase commit sinks, idempotent sinks and pitfalls.",
      questions: [
        { q: "In Flink's two-phase commit sink, when does output become visible downstream?", options: ["As each record is written", "When the checkpoint that covers it completes and the sink commits the pre-committed transaction", "When the job stops", "Every second"], answer: 1, explain: "The sink pre-commits on the checkpoint barrier and commits when the JobManager confirms the checkpoint completed. Readers using read_committed see data only then." },
        { q: "Why must the Kafka transaction timeout exceed the checkpoint interval plus expected recovery time?", options: ["If the broker times out a pre-committed transaction before Flink commits it, the data is aborted and lost", "To make checkpoints faster", "To reduce latency", "It does not matter"], answer: 0, explain: "A pre-committed transaction must survive until its checkpoint completes \u2014 including any restart. If the broker aborts it first, the commit fails and that output is gone." },
        { q: "When is an idempotent sink a better choice than a transactional one?", options: ["Never", "When the sink cannot upsert", "When results can be written as upserts by a deterministic key, giving exactly-once effect with lower latency and no transaction coordination", "When you need read_committed"], answer: 2, explain: "If replaying a record rewrites the same row with the same value, duplicates are harmless. Results become visible immediately instead of at checkpoint boundaries." },
        { q: "Which bug breaks exactly-once even with transactional sinks?", options: ["Using RocksDB", "Using event time", "Using a keyBy", "Calling an external payment API from inside a map function, which is re-executed on replay"], answer: 3, explain: "Side effects outside the checkpointed state and the transactional sink are repeated on every replay. External calls need idempotency keys or must move to the sink." },
        { q: "Your output depends on processing time and a random number. What happens on replay after failure?", options: ["Results are identical", "Replayed records can produce different outputs, so \u201cexactly-once\u201d output may disagree with the first attempt", "The job refuses to restart", "Kafka deduplicates them"], answer: 1, explain: "Exactly-once assumes deterministic processing. Non-deterministic logic yields different results on replay, which matters when part of the first attempt was already visible." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.eo = {
    id: "eo",
    name: "Exactly-Once & Transactions",
    short: "EO",
    tagline: "Effects once, end to end",
    color: "#34d399",
    blurb: "What exactly-once really promises and where it stops: Kafka's idempotent producer and transactions, transactional ids and zombie fencing, read_committed and the last stable offset, Flink's two-phase commit sinks, idempotent upsert sinks as the pragmatic alternative, and the pitfalls that quietly break the guarantee.",
    modules: [
      {
        id: "guarantees",
        name: "Exactly-Once in Kafka",
        icon: "shield",
        lessons: [
          L("what-eo-means", "What exactly-once actually means", "Not delivered once \u2014 processed with an effect as if once, across every hop from source to sink.", 8, ["exactly-once", "semantics"], [
            { t: "p", html: "\"Exactly-once\" is one of the most misunderstood phrases in streaming. Records are still delivered more than once \u2014 networks retry and jobs replay. What can be exactly-once is the <strong>effect</strong>: the state and output look as if every input record was processed exactly once. Achieving it requires every hop to cooperate." },
            { t: "table", headers: ["Hop", "Risk", "Mechanism"], rows: [["Producer to broker", "Retry duplicates", "Idempotent producer"], ["Read-process-write in Kafka", "Output written, offsets not committed (or the reverse)", "Kafka transactions with offsets in the transaction"], ["Stream processor state", "Replay double-counts", "Checkpoints restoring state with source offsets"], ["Processor to external sink", "Replay rewrites output", "Two-phase commit or idempotent upserts"], ["External side effects", "Replay repeats the call", "Idempotency keys at the remote system"]] },
            { t: "p", html: "There are only two fundamental techniques. <strong>Atomic commit</strong>: make the output and the progress marker one transaction, so they succeed or fail together. <strong>Idempotence</strong>: make repeated output harmless because it overwrites the same thing. Every exactly-once system is a combination of these." },
            { t: "note", variant: "trap", html: "\"Our engine supports exactly-once\" is a property of the engine's state, not of your pipeline. If the sink is a plain HTTP POST, the pipeline is at-least-once no matter what the engine does." },
            { t: "cue", html: "<strong>Be precise out loud:</strong> \"End-to-end exactly-once here means Kafka transactions inside the job and an idempotent upsert into the warehouse; the only at-least-once hop is the email, which carries an idempotency key.\"" },
            { t: "note", variant: "key", html: "<strong>Exactly-once is an end-to-end property of effects.</strong> Build it from atomic commits and idempotent writes, hop by hop, and the weakest hop decides." }
          ]),
          L("kafka-transactions", "Kafka transactions", "A transactional producer writes to many partitions and commits consumer offsets atomically, with zombies fenced by epoch.", 10, ["kafka", "transactions", "exactly-once"], [
            { t: "p", html: "Kafka transactions extend the idempotent producer to <strong>atomic writes across partitions</strong>. A producer with a <code class='tok'>transactional.id</code> begins a transaction, writes to any number of partitions, optionally adds the consumer group's offsets, and commits or aborts. A <strong>transaction coordinator</strong> broker records state in an internal transaction log and writes <strong>commit or abort markers</strong> into every involved partition." },
            { t: "code", lang: "java", code: "producer.initTransactions();                       // fences older instances with this transactional.id\nwhile (running) {\n  ConsumerRecords<String, Order> in = consumer.poll(Duration.ofMillis(200));\n  producer.beginTransaction();\n  try {\n    for (ConsumerRecord<String, Order> r : in) producer.send(enrich(r));\n    producer.sendOffsetsToTransaction(nextOffsets(in), consumer.groupMetadata());\n    producer.commitTransaction();                  // outputs + offsets together\n  } catch (ProducerFencedException e) {\n    throw e;                                       // a newer instance owns this id: stop\n  } catch (KafkaException e) {\n    producer.abortTransaction();                   // consumers on read_committed never see it\n    rewindTo(lastCommitted());\n  }\n}" },
            { t: "ul", items: ["<strong>Zombie fencing:</strong> <code class='tok'>initTransactions</code> bumps the producer epoch; an old instance still running gets fenced on its next write.", "<strong>Control markers</strong> occupy offsets, so transactional topics have small gaps in offset sequences.", "<strong>Kafka Streams</strong> wraps all of this behind <code class='tok'>processing.guarantee=exactly_once_v2</code>.", "<strong>Cost:</strong> commit latency per transaction; batch many records per transaction to amortise it."] },
            { t: "note", variant: "warn", html: "Transactions only bind Kafka writes and Kafka offsets. A database write made inside the loop is not part of the transaction and will repeat after an abort." },
            { t: "note", variant: "key", html: "<strong>Outputs and input offsets in one transaction, zombies fenced by epoch.</strong> That makes Kafka-to-Kafka processing exactly-once \u2014 and nothing outside Kafka." }
          ]),
          L("read-committed", "read_committed, the LSO and stalled consumers", "Committed readers stop at the first open transaction, so long transactions become everyone's latency.", 7, ["kafka", "transactions", "isolation"], [
            { t: "p", html: "A transactional write is useless if consumers read it before it commits. Consumers choose an <code class='tok'>isolation.level</code>. With <strong>read_committed</strong>, the broker only returns records up to the <strong>last stable offset (LSO)</strong>: the offset before the earliest still-open transaction in that partition. Records from aborted transactions are filtered out." },
            { t: "compare", bad: { title: "read_uncommitted (default)", items: ["Sees records from transactions that later abort", "Lowest latency", "Breaks exactly-once for downstream"] }, good: { title: "read_committed", items: ["Sees only committed data", "Waits for open transactions to finish", "Required end to end for transactional pipelines"] } },
            { t: "p", html: "The cost is latency coupling. A producer that holds a transaction open for 60 seconds holds back every committed reader of the partitions it touched for those 60 seconds \u2014 including records from other producers written after it began." },
            { t: "note", variant: "trap", html: "A hung producer with an open transaction can stall read_committed consumers until the transaction timeout aborts it. Keep <code class='tok'>transaction.timeout.ms</code> as short as your commit cadence and recovery allow, and alert on LSO lag." },
            { t: "note", variant: "tip", html: "In a Flink job writing transactionally, output becomes readable once per checkpoint. End-to-end latency for read_committed consumers is therefore roughly the checkpoint interval." },
            { t: "note", variant: "key", html: "<strong>Exactly-once needs read_committed readers, and they wait at the LSO.</strong> Keep transactions short, because their duration becomes every downstream reader's latency." }
          ], "eo-guarantees")
        ]
      },
      {
        id: "endtoend",
        name: "End to End",
        icon: "plug",
        lessons: [
          L("flink-2pc", "Two-phase commit sinks in Flink", "Pre-commit on the barrier, commit on checkpoint completion \u2014 output becomes visible once per checkpoint.", 9, ["flink", "two-phase-commit", "exactly-once"], [
            { t: "p", html: "Flink extends its checkpoint to external systems with a <strong>two-phase commit</strong> sink. Between checkpoints, the sink writes into an open transaction. When the checkpoint barrier reaches it, the sink <strong>pre-commits</strong>: flushes and prepares the transaction, and records its handle in the checkpoint. When the JobManager reports the checkpoint complete, the sink <strong>commits</strong>. On failure, Flink restores the checkpoint and either commits pending transactions it recorded or aborts the rest." },
            { t: "code", lang: "java", code: "KafkaSink<Alert> sink = KafkaSink.<Alert>builder()\n    .setBootstrapServers(cfg.bootstrap())\n    .setRecordSerializer(alertSerializer)\n    .setDeliveryGuarantee(DeliveryGuarantee.EXACTLY_ONCE)\n    .setTransactionalIdPrefix(\"fraud-alerts\")       // unique per job\n    .setProperty(\"transaction.timeout.ms\", \"900000\")  // > checkpoint interval + recovery\n    .build();" },
            { t: "table", headers: ["Requirement", "Why"], rows: [["Checkpointing enabled", "Commits are driven by checkpoint completion"], ["Transaction timeout > interval + recovery", "Otherwise the broker aborts pre-committed data"], ["Unique transactional id prefix per job", "Two jobs with one prefix fence each other"], ["Downstream read_committed", "Otherwise uncommitted data is visible"], ["Sink supports transactions that survive restarts", "Kafka does; many HTTP APIs do not"]] },
            { t: "note", variant: "warn", html: "Latency rises to about one checkpoint interval, because nothing is visible until commit. A 60-second interval means minute-old data for committed readers." },
            { t: "note", variant: "key", html: "<strong>Pre-commit on the barrier, commit on completion.</strong> Output is exactly-once and arrives once per checkpoint, provided transactions outlive the checkpoint plus recovery." }
          ]),
          L("idempotent-sinks", "Idempotent sinks: exactly-once effect without transactions", "Upsert by a deterministic key and duplicates collapse \u2014 often simpler and faster than distributed transactions.", 8, ["idempotency", "sinks", "exactly-once"], [
            { t: "p", html: "If writing a result twice leaves the target in the same state as writing it once, replays are harmless. That is an <strong>idempotent sink</strong>, and it gives exactly-once <em>effect</em> on top of at-least-once delivery. The trick is a deterministic key for every output and a write that overwrites rather than appends." },
            { t: "table", headers: ["Sink", "Idempotent pattern"], rows: [["Relational DB", "INSERT ... ON CONFLICT (key) DO UPDATE / MERGE"], ["Key-value store", "PUT by key"], ["Lakehouse table", "MERGE on a key, or overwrite a partition per window"], ["Search index", "Index by document id"], ["Compacted Kafka topic", "Produce with the result key; latest wins"]] },
            { t: "code", lang: "sql", code: "-- windowed revenue result: (store_id, window_start) is the natural key\nINSERT INTO revenue_per_minute (store_id, window_start, revenue, updated_at)\nVALUES (:store, :ws, :rev, now())\nON CONFLICT (store_id, window_start)\nDO UPDATE SET revenue = EXCLUDED.revenue, updated_at = EXCLUDED.updated_at;" },
            { t: "note", variant: "trap", html: "Increments are not idempotent. <code class='tok'>UPDATE totals SET n = n + 1</code> double-counts on replay. Write the absolute value computed by the stream, or record processed event ids alongside." },
            { t: "note", variant: "tip", html: "Compare with the batch idea of replay-safe loads: the Cascade atlas (data engineering) in this collection covers it in <em>Storage &amp; File Formats \u203a Ingestion \u203a Incremental loads &amp; idempotency</em>." },
            { t: "note", variant: "key", html: "<strong>Deterministic key plus overwrite equals exactly-once effect.</strong> Prefer idempotent sinks when you can; reach for transactions when output must be atomic across records." }
          ]),
          L("eo-pitfalls", "Exactly-once pitfalls", "External calls, non-determinism, timeouts and mismatched readers are where the guarantee quietly breaks.", 8, ["exactly-once", "pitfalls", "operations"], [
            { t: "p", html: "Exactly-once systems usually fail at the edges, not in the core mechanism. These are the cases that turn a correct design into duplicated or missing data in production." },
            { t: "table", headers: ["Pitfall", "Symptom", "Fix"], rows: [["External call inside an operator", "Duplicate emails, double charges after restart", "Move to the sink with an idempotency key"], ["Non-deterministic logic", "Replayed results differ from first attempt", "Derive from event time and input only"], ["Transaction timeout too short", "Commit failures after restart; missing output", "Timeout > checkpoint interval + recovery"], ["Downstream read_uncommitted", "Consumers see aborted data", "read_committed everywhere"], ["Shared transactional id prefix", "Jobs fence each other", "Unique prefix per job and environment"], ["Manual offset reset", "Reprocessing double-applies to a non-idempotent sink", "Idempotent sinks or a fresh output target"]] },
            { t: "note", variant: "warn", html: "Exactly-once does not survive a human. Replaying a topic from last week into a sink that appends will duplicate a week of data, whatever the engine guarantees. Backfills need idempotent targets." },
            { t: "note", variant: "tip", html: "Test it: inject failures (kill a TaskManager mid-checkpoint, restart a broker) in staging and reconcile output counts against input. The <a href=\"#/ops/resilience/failure-drills\">failure drills</a> lesson has a runbook." },
            { t: "note", variant: "key", html: "<strong>Guard the edges.</strong> No side effects outside the sink, deterministic logic, long enough transactions, committed readers, and idempotent targets for every replay." }
          ], "eo-endtoend")
        ]
      }
    ]
  };
})();
