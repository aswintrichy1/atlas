/* =====================================================================
   PULSE · Streaming Fundamentals
   window.TRACKS.fund — modules: model / flow
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks) {
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "fund-model": {
      title: "Streaming model checkpoint",
      sub: "Events, logs, time and the stream-table duality.",
      questions: [
        { q: "What makes a log a better integration backbone than a queue that deletes on delivery?", options: ["It is faster for every workload", "Many independent readers can replay the same ordered history at their own pace", "It guarantees exactly-once delivery by itself", "It needs no storage"], answer: 1, explain: "A retained, ordered log decouples readers in time: a new consumer can start from the beginning, a buggy one can rewind, and none of them affects the others. Speed and exactly-once are properties of how you use it, not of the log alone." },
        { q: "A mobile app buffers events offline and uploads them two hours later. Which time should a 'purchases per hour' metric use?", options: ["Event time, when the purchase happened", "Processing time, when the server saw it", "Ingestion time at the broker", "Whichever is smaller"], answer: 0, explain: "The business question is about when purchases happened, so event time is correct. Processing or ingestion time would pile two hours of purchases into the upload hour." },
        { q: "What is the stream-table duality?", options: ["Streams and tables must be stored in different systems", "A table is a stream with a schema", "A table is the latest state per key produced by replaying a changelog stream, and a table's changes form a stream", "Tables are only for batch"], answer: 2, explain: "Replaying a changelog yields a table; capturing every change to a table yields a stream. Compacted topics, CDC and materialised views all rest on this equivalence." },
        { q: "Which operation is stateless?", options: ["Counting clicks per user per minute", "Joining orders to payments", "Deduplicating by event id", "Filtering out events with a null user id"], answer: 3, explain: "A filter decides each record on its own. Counts, joins and deduplication must remember earlier records, which is exactly what makes them stateful and what checkpoints must protect." },
        { q: "Why is processing time attractive despite its correctness problems?", options: ["It needs no watermarks and produces results with predictable latency", "It handles late data correctly", "It is required for exactly-once", "It makes replays reproducible"], answer: 0, explain: "Processing time is simple and low-latency because the clock only moves forward. The price is that results depend on when data arrived, so replays and late data change the answer." }
      ]
    },
    "fund-flow": {
      title: "Flow & guarantees checkpoint",
      sub: "Delivery semantics, ordering, backpressure and when to stream.",
      questions: [
        { q: "A consumer commits its offset, then crashes before writing the result. What guarantee is that?", options: ["Exactly-once", "At-least-once", "At-most-once", "Effectively-once"], answer: 2, explain: "Committing before the side effect means the record is never retried after the crash, so it may be lost but never duplicated: at-most-once. Writing first and committing after gives at-least-once." },
        { q: "You need all events for one account processed in order. What is the usual design?", options: ["A single-partition topic for everything", "Key by account id so each account maps to one partition", "Sort events in the consumer every minute", "Use more consumers than partitions"], answer: 1, explain: "Kafka orders records within a partition, and the default partitioner sends one key to one partition. Keying by account preserves per-account order while letting different accounts spread across partitions." },
        { q: "What does backpressure do in a well-behaved streaming system?", options: ["Drops records when a consumer is slow", "Speeds up the slowest operator", "Restarts the job", "Slows upstream producers or readers to the pace of the slowest stage instead of letting buffers grow without bound"], answer: 3, explain: "Backpressure propagates slowness upstream so memory stays bounded. With a durable log as the source, the reader simply falls behind and lag grows, which is visible and recoverable." },
        { q: "Which requirement most clearly argues against building a streaming pipeline?", options: ["The report is read once each morning and an hourly batch job already meets it", "Fraud must be blocked before a payment settles", "Inventory must update while customers shop", "Alerts must fire within a minute"], answer: 0, explain: "Streaming adds always-on operations, state and harder correctness. When the consumer of the data only looks daily, batch gives the same value at much lower cost." },
        { q: "Retries plus an idempotent sink give you what end-to-end behaviour?", options: ["At-most-once", "Effectively-once results: duplicates may be delivered but overwrite the same row", "Lost records", "Strict global ordering"], answer: 1, explain: "Retries ensure nothing is lost; idempotence ensures a repeated write produces the same result. The pipeline may deliver twice, but the observable output is as if once." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.fund = {
    id: "fund",
    name: "Streaming Fundamentals",
    short: "FUND",
    tagline: "Events, logs, time and guarantees",
    color: "#22d3ee",
    blurb: "The mental model every later track builds on: an event as an immutable fact, the log as a shared ordered history, three clocks and why event time wins, the stream-table duality, stateless versus stateful work, delivery semantics, ordering by key, backpressure, and an honest test for when not to stream at all.",
    modules: [
      {
        id: "model",
        name: "The Streaming Model",
        icon: "share",
        lessons: [
          L("events-logs", "Events and the log", "An event is an immutable fact; a log is the ordered, retained history that lets many systems agree on what happened.", 8, ["events", "log", "kafka"], [
            { t: "p", html: "An <strong>event</strong> records that something happened: an order was placed, a sensor read 21.4 \u00b0C, a row changed. It is a fact in the past tense, so it never changes \u2014 a correction is a new event, not an edit. That immutability is what makes streaming tractable: facts can be copied, replayed and reprocessed without anyone disagreeing about what they say." },
            { t: "p", html: "A <strong>log</strong> is an append-only, ordered sequence of those events, each identified by its position (in Kafka, an <em>offset</em>). Producers append to the end. Consumers read from any position and remember where they are. Because reading does not delete anything, many independent consumers can read the same history at different speeds." },
            { t: "compare", bad: { title: "Queue that deletes on delivery", items: ["One logical consumer per message", "No replay after a bug", "Adding a new reader means re-sending everything"] }, good: { title: "Retained log", items: ["Any number of independent readers", "Rewind to reprocess after a fix", "A new system can bootstrap from history"] } },
            { t: "table", headers: ["Concept", "In a log", "Why it matters"], rows: [["Offset", "Position of a record in a partition", "Consumers track progress with a single number"], ["Retention", "How long records are kept", "Bounds replay and storage cost"], ["Partition", "One shard of the log, ordered internally", "The unit of parallelism and ordering"], ["Key", "Optional field used to pick a partition", "Same key, same partition, same order"]] },
            { t: "note", variant: "tip", html: "When a design has several systems that must agree \u2014 search index, cache, warehouse \u2014 feed them all from one log rather than having the application write to each. The log becomes the source of truth for <em>what changed</em>, and each system is a derived view." },
            { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"several downstream systems\", \"we need to reprocess after a bug\", \"new consumers keep appearing\" \u2014 reach for a retained log before point-to-point integrations." },
            { t: "note", variant: "key", html: "<strong>Events are immutable facts; the log is their shared, replayable order.</strong> Everything else in streaming \u2014 consumers, state, exactly-once \u2014 is about reading that order correctly." }
          ]),
          L("time", "Three clocks: event, ingestion and processing time", "Results are only reproducible when computed on the time the event happened, not the time you saw it.", 9, ["time", "event-time"], [
            { t: "p", html: "Every event carries at least three timestamps, and confusing them is the root of most wrong streaming dashboards. <strong>Event time</strong> is when the thing happened, stamped at the source. <strong>Ingestion time</strong> is when the broker received it. <strong>Processing time</strong> is the wall clock of the machine computing on it." },
            { t: "table", headers: ["Clock", "Set by", "Strength", "Weakness"], rows: [["Event time", "The device or service that observed the fact", "Correct and reproducible results", "Arrives out of order; needs watermarks"], ["Ingestion time", "The broker on append", "Monotonic per partition; no source clock skew", "Still wrong for buffered or delayed sources"], ["Processing time", "The operator's clock", "Simplest, lowest latency", "Answer changes on replay or lag"]] },
            { t: "p", html: "The gap between event time and processing time is called <strong>skew</strong>. It is rarely constant: a phone offline for two hours, a batch upload, a consumer that fell behind during an incident. A pipeline keyed on processing time silently reassigns all that data to the wrong window." },
            { t: "code", lang: "text", code: "event      event_time   arrives (processing time)\nclick-1    10:00:05     10:00:06\nclick-2    10:00:58     10:01:03   <- belongs to the 10:00 minute\nclick-3    10:00:40     12:07:10   <- phone was offline\n\nper-minute count on processing time: 10:00 -> 1, 10:01 -> 1, 12:07 -> 1   (wrong)\nper-minute count on event time:      10:00 -> 3                            (right, once click-3 arrives)" },
            { t: "note", variant: "trap", html: "Device clocks lie. Event time from a phone can be minutes off or deliberately wrong. Validate it against ingestion time and clamp or quarantine absurd values instead of letting one bad clock hold a window open for ever." },
            { t: "note", variant: "tip", html: "Event time costs you a decision you cannot avoid: how long to wait for stragglers. That decision is the watermark, covered in <a href=\"#/sem/time/watermarks\">Watermarks</a>." },
            { t: "note", variant: "key", html: "<strong>Compute on event time; budget for its lateness.</strong> Processing time is fine for operational metrics about the pipeline itself, but business answers must not depend on when you happened to read the data." }
          ]),
          L("stream-table", "The stream-table duality", "A table is the latest state per key from a changelog; a table's changes are a stream. Most streaming designs are one or the other view.", 8, ["changelog", "tables", "compaction"], [
            { t: "p", html: "Take a stream of account updates and keep only the latest value for each account: you have a <strong>table</strong>. Take a table and emit every insert, update and delete: you have a <strong>changelog stream</strong>. The two are views of the same information, and moving between them is the bread and butter of stream processing." },
            { t: "code", lang: "text", code: "changelog stream                    table (latest per key)\n(acct-7, balance=100)    ->          acct-7: 100\n(acct-9, balance=40)     ->          acct-7: 100, acct-9: 40\n(acct-7, balance=80)     ->          acct-7: 80,  acct-9: 40\n(acct-9, null)  tombstone ->         acct-7: 80" },
            { t: "ul", items: ["<strong>Compacted topics</strong> store a table as a log: Kafka keeps at least the latest record per key.", "<strong>CDC</strong> turns a database table into a changelog stream (see <a href=\"#/cdc/capture/log-based-cdc\">log-based CDC</a>).", "<strong>Aggregations</strong> turn a stream into a continuously updated table of results.", "<strong>State stores</strong> in Kafka Streams and Flink are local tables backed by a changelog or a checkpoint."] },
            { t: "note", variant: "warn", html: "A table built from a stream is only as complete as the history you replay. If the topic has time-based retention, the oldest keys silently disappear; tables meant to be rebuilt from scratch belong on compacted topics." },
            { t: "cue", html: "<strong>Say it out loud:</strong> \"This topic is a changelog, so consumers materialise it as a table keyed by account id; tombstones carry deletes.\" It shows you know which view each component needs." },
            { t: "note", variant: "key", html: "<strong>Streams record change; tables record state; each can be derived from the other.</strong> Decide which one every topic is, and the retention policy, keying and consumer logic follow." }
          ]),
          L("stateless-stateful", "Stateless and stateful processing", "Filters and maps forget; counts, joins and deduplication remember \u2014 and memory is where streaming gets hard.", 8, ["state", "operators"], [
            { t: "p", html: "A <strong>stateless</strong> operator decides each record on its own: filter, map, route, enrich from a static lookup. It can be restarted anywhere and scaled freely. A <strong>stateful</strong> operator needs information from earlier records: counts, windows, joins, deduplication, pattern detection. Its memory must survive failures, scale with keys, and be moved when parallelism changes." },
            { t: "table", headers: ["Operator", "State it keeps", "Grows with"], rows: [["Filter / map", "None", "\u2014"], ["Windowed count", "One counter per key per open window", "Keys \u00d7 open windows"], ["Deduplication", "Ids seen recently", "Unique ids \u00d7 dedup horizon"], ["Stream-stream join", "Buffered records from both sides", "Join window \u00d7 throughput"], ["Session window", "Open session per key", "Active users"]] },
            { t: "p", html: "State has to be <strong>partitioned by key</strong> so each instance owns a disjoint slice, <strong>persisted</strong> so a restart does not lose it, and <strong>bounded</strong> so it does not grow for ever. Each engine solves this differently: Kafka Streams uses local stores backed by changelog topics; Flink uses keyed state snapshotted in checkpoints." },
            { t: "note", variant: "trap", html: "Unbounded state is the most common slow-motion outage. A dedup set or a regular join with no expiry grows until checkpoints take minutes and the job falls over. Every stateful operator needs a TTL, a window, or a reason it is finite." },
            { t: "note", variant: "tip", html: "Push stateless work \u2014 parsing, filtering, projection \u2014 as early as possible. Every byte you drop before the first <code class='tok'>keyBy</code> is a byte you do not shuffle or store." },
            { t: "quiz", id: "fund-model" },
            { t: "note", variant: "key", html: "<strong>State is the cost centre of streaming.</strong> For every stateful step, name the key it is partitioned on, how it is recovered, and what bounds its size." }
          ])
        ]
      },
      {
        id: "flow",
        name: "Delivery, Ordering & Flow",
        icon: "queue",
        lessons: [
          L("delivery-semantics", "At-most-once, at-least-once, exactly-once", "Where you commit progress relative to the side effect decides whether failures lose or duplicate data.", 9, ["semantics", "exactly-once"], [
            { t: "p", html: "A consumer does two things for every record: it produces a <strong>side effect</strong> (writes a row, sends a message) and it records <strong>progress</strong> (commits an offset). A crash can happen between them. The order of those two steps decides what a crash does to your data." },
            { t: "table", headers: ["Guarantee", "Order of steps", "After a crash", "Typical use"], rows: [["At-most-once", "Commit, then act", "Record may be lost, never repeated", "Metrics where loss is tolerable"], ["At-least-once", "Act, then commit", "Record may be repeated, never lost", "The default for most pipelines"], ["Exactly-once (effect)", "Act and commit atomically, or act idempotently", "Every record affects output once", "Money, counts, anything audited"]] },
            { t: "p", html: "\"Exactly-once\" never means a record is <em>delivered</em> once \u2014 networks retry. It means the <strong>observable effect</strong> is as if each record were processed once. You get there in one of two ways: make the side effect and the progress commit one atomic transaction, or make the side effect idempotent so repeats are harmless." },
            { t: "note", variant: "warn", html: "A guarantee is end to end or it is nothing. Exactly-once inside the processor does not help if the sink is a plain HTTP call that the processor may retry. The track on <a href=\"#/eo/guarantees/what-eo-means\">exactly-once</a> walks the whole chain." },
            { t: "cue", html: "<strong>The sentence that earns credit:</strong> \"We're at-least-once into the sink, and the sink upserts on event id, so duplicates collapse \u2014 effectively-once without distributed transactions.\"" },
            { t: "note", variant: "key", html: "<strong>Delivery is at-least-once; effects can be exactly-once.</strong> Pick atomic commit or idempotent writes, and check every hop, because the weakest hop sets the guarantee." }
          ]),
          L("ordering-keys", "Ordering, keys and partitions", "Order exists only within a partition, so the key you choose is a decision about which events must stay in order.", 8, ["ordering", "partitioning", "keys"], [
            { t: "p", html: "Kafka and similar logs promise order <strong>within a partition</strong> and nothing across partitions. The producer's partitioner usually hashes the record key, so every event with the same key lands in the same partition, in the order the producer sent it. Choosing the key is therefore choosing what has to be ordered." },
            { t: "table", headers: ["Key choice", "Ordered per", "Risk"], rows: [["No key", "Nothing", "Fine for independent events; breaks any per-entity logic"], ["User id", "User", "A celebrity user becomes a hot partition"], ["Order id", "Order", "Events about one user can be processed out of order across orders"], ["Tenant id", "Tenant", "Large tenants dominate a partition"]] },
            { t: "p", html: "Increasing the partition count changes which partition a key hashes to, so for a while old events for a key sit in one partition and new ones in another. Consumers can then see that key out of order. Plan partition counts up front for keyed topics, or migrate deliberately." },
            { t: "note", variant: "trap", html: "Retries can reorder even within a partition if the producer allows several in-flight batches and is not idempotent. Kafka's idempotent producer (on by default in modern clients) keeps order with up to five in-flight requests; see <a href=\"#/kafka/replication/idempotent-producer\">the idempotent producer</a>." },
            { t: "note", variant: "tip", html: "If you need global order, you need one partition \u2014 and one partition's throughput. Usually the real requirement is per-entity order, which scales." },
            { t: "note", variant: "key", html: "<strong>The key is your ordering contract.</strong> Key by the entity whose events must stay in sequence, watch for hot keys, and treat changing the partition count of a keyed topic as a migration." }
          ]),
          L("backpressure", "Backpressure and buffering", "When a stage is slower than its input, something must give: memory, data, or the upstream rate.", 7, ["backpressure", "flow-control"], [
            { t: "p", html: "Every pipeline has a slowest stage. When input arrives faster than that stage can process, the difference has to go somewhere. There are only three options: <strong>buffer</strong> it, <strong>drop</strong> it, or <strong>slow the sender</strong>. Backpressure is the third option done deliberately." },
            { t: "compare", bad: { title: "Unbounded buffering", items: ["Memory grows until the process dies", "Latency grows invisibly", "A crash loses everything buffered"] }, good: { title: "Backpressure to a durable log", items: ["Bounded memory in every operator", "Slowness shows up as consumer lag", "Nothing is lost; the reader catches up later"] } },
            { t: "p", html: "In Flink, network buffers between operators are granted by credits: a downstream task only receives data it has buffer space for, so a slow sink gradually slows every upstream task back to the source. The Kafka source then simply reads less, and the cost appears as growing lag in the topic \u2014 which is exactly where you want it, because the log is durable." },
            { t: "note", variant: "warn", html: "Backpressure hides the culprit. The operator that shows as busy is usually upstream of the real bottleneck. Look for the first operator that is <em>not</em> backpressured but whose downstream is." },
            { t: "note", variant: "tip", html: "Sources that cannot be paused \u2014 HTTP webhooks, UDP telemetry \u2014 should land in a log first. The log turns a push you cannot slow into a pull you can." },
            { t: "note", variant: "key", html: "<strong>Let slowness become lag, not memory.</strong> A durable log upstream plus backpressure inside the job keeps every buffer bounded and turns overload into a number you can alert on." }
          ]),
          L("when-to-stream", "When to stream, and when not to", "Streaming pays off when someone acts on fresh data; otherwise it is batch with more on-call.", 7, ["architecture", "batch-vs-stream"], [
            { t: "p", html: "Streaming is not a better batch. It is a different trade: lower latency and continuous results in exchange for always-on infrastructure, state you must protect, and correctness problems batch never sees. The question is not \"can we stream this?\" but \"who acts on this data, and how quickly do they need it?\"" },
            { t: "table", headers: ["Signal", "Lean streaming", "Lean batch"], rows: [["Decision latency", "Seconds to minutes (fraud, inventory, alerts)", "Hours or a day (reports, finance close)"], ["Data arrives", "Continuously, from many sources", "In periodic drops"], ["Consumers", "Machines that react", "People who read once"], ["Correctness", "Approximate early, refine later is acceptable", "One final, audited answer"], ["Team", "Can run an always-on service", "Runs scheduled jobs"]] },
            { t: "p", html: "Many good architectures do both: a streaming path for the operational decision and a batch path that recomputes the authoritative answer. The modern variant runs the <em>same</em> code in both modes \u2014 Spark and Flink can run a query as a bounded job or a continuous one." },
            { t: "note", variant: "trap", html: "\"Real-time dashboard\" is often a request for freshness, not streaming. Refreshing a warehouse table every five minutes with incremental loads may meet it at a fraction of the cost." },
            { t: "cue", html: "<strong>Spotting it in a prompt:</strong> a human reads the output once a day \u2192 batch. A machine must react before something irreversible happens \u2192 stream." },
            { t: "quiz", id: "fund-flow" },
            { t: "note", variant: "key", html: "<strong>Stream when a decision depends on freshness.</strong> Otherwise prefer batch or micro-batch, and keep the option to move a path to streaming when a real latency requirement appears." }
          ])
        ]
      }
    ]
  };
})();
