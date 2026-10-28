/* =====================================================================
   PULSE · Time, Windows & State
   window.TRACKS.sem — modules: time / state
   Widget used: pl-watermark (js/widgets.js)
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks, quiz) {
    if (quiz) blocks.splice(blocks.length - 1, 0, { t: "quiz", id: quiz });
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "sem-time": {
      title: "Event time & windows checkpoint",
      sub: "Watermarks, window types, triggers and late data.",
      questions: [
        { q: "What does a watermark of 10:05 assert?", options: ["The job has processed exactly the events up to 10:05", "The wall clock is 10:05", "The system expects no more events with event time earlier than 10:05, so windows ending by then may fire", "All partitions are at offset 1005"], answer: 2, explain: "A watermark is a claim about event-time completeness. Windows that end at or before it can be finalised; anything older that arrives afterwards is late." },
        { q: "Increasing the bounded out-of-orderness delay from 5 s to 60 s mainly\u2026", options: ["Makes results arrive later but drops fewer late events", "Makes results faster", "Has no effect on state size", "Guarantees no late data"], answer: 0, explain: "A larger delay waits longer before closing windows: more complete results, higher latency and more open windows in state. No finite delay guarantees zero late data." },
        { q: "Which window fits \u201cgroup a user\u2019s clicks into visits separated by 30 minutes of inactivity\u201d?", options: ["Tumbling 30-minute windows", "Sliding windows of 30 minutes every minute", "A global window", "Session windows with a 30-minute gap"], answer: 3, explain: "Session windows are defined per key by gaps in activity, so each visit becomes its own window of whatever length it really had." },
        { q: "In a job reading eight Kafka partitions, one partition receives no data for an hour. What happens to event-time windows without idleness handling?", options: ["They fire normally", "The operator\u2019s watermark is the minimum across inputs, so the idle partition holds it back and windows stop firing", "The idle partition is dropped from the job", "Kafka sends heartbeats that advance it"], answer: 1, explain: "Watermarks combine by minimum. A silent input never advances, so it pins the whole operator. Marking inputs idle after a timeout lets the others drive progress." },
        { q: "What is allowed lateness for?", options: ["Delaying every result", "Changing the watermark", "Keeping window state a little longer after it fires, so late events can update the result instead of being dropped", "Making windows overlap"], answer: 2, explain: "With allowed lateness, a window emits on the watermark and then emits corrections for late events until the lateness horizon passes. Downstream must accept updates." }
      ]
    },
    "sem-state": {
      title: "State, joins & dedup checkpoint",
      sub: "Keyed state, stream joins, deduplication and TTL.",
      questions: [
        { q: "Why does an unbounded regular join in streaming SQL eventually fail?", options: ["SQL cannot join streams", "It keeps every row from both sides forever in case a future row matches, so state grows without limit", "It only works on compacted topics", "It requires exactly-once"], answer: 1, explain: "A regular join has no time bound, so both sides must be remembered indefinitely. Use interval or temporal joins, or set a state TTL that matches the business rule." },
        { q: "What is a temporal (versioned) join good for?", options: ["Joining each order to the exchange rate that was valid at the order\u2019s event time", "Joining two streams inside a time window", "Deduplicating events", "Joining a stream to itself"], answer: 0, explain: "A temporal join looks up the version of a slowly changing table as of each event's time, which keeps results correct on replay." },
        { q: "You dedupe on event id with a 24-hour horizon. What happens to a duplicate that arrives 30 hours later?", options: ["It is dropped", "The job fails", "It passes through as new, because its id has expired from state", "Kafka rejects it"], answer: 2, explain: "Deduplication is only as long as the state you keep. Pair a finite horizon with an idempotent sink if very late duplicates are possible." },
        { q: "What does keyed state guarantee in Flink or Kafka Streams?", options: ["State is shared across all instances", "State is stored in Kafka only", "State never needs to be checkpointed", "Each key's state lives with exactly one parallel instance, so updates for a key are processed serially without locks"], answer: 3, explain: "Partitioning state by key means one instance owns each key, which is what lets stateful operators run in parallel without coordination." },
        { q: "What does state TTL trade away?", options: ["Correctness for keys that stay idle longer than the TTL, in exchange for bounded state", "Throughput for latency", "Durability for speed", "Nothing; it is free"], answer: 0, explain: "TTL expires state that has not been touched. If a key returns after expiry, the operator treats it as new, so the TTL must match how long the business logic actually needs memory." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sem = {
    id: "sem",
    name: "Time, Windows & State",
    short: "SEM",
    tagline: "Correct answers on unbounded data",
    color: "#facc15",
    blurb: "The semantics that make stream processing correct: event time and watermarks, tumbling, sliding and session windows, triggers and allowed lateness, idle inputs, keyed state, stream-stream and temporal joins, deduplication and state lifetimes.",
    modules: [
      {
        id: "time",
        name: "Event Time & Windows",
        icon: "trend",
        lessons: [
          L("event-time", "Event time in practice", "Extract timestamps at the source, assign them early, and treat skew as a measured quantity.", 7, ["event-time", "timestamps"], [
            { t: "p", html: "Event-time processing starts with a decision about <strong>which field is the event time</strong>. It should be set where the fact was observed, travel with the record, and be assigned to the stream as early as possible so every downstream operator agrees. In Kafka, records also carry a timestamp that is either the producer's create time or the broker's append time, per topic." },
            { t: "table", headers: ["Source", "Event time field", "Typical skew"], rows: [["Web clickstream", "Client timestamp, validated against server receipt", "Seconds; minutes on flaky networks"], ["Mobile apps", "Device timestamp", "Hours when offline"], ["CDC", "Commit timestamp from the database log", "Small, but bursts after replication lag"], ["IoT gateways", "Sensor reading time", "Minutes to hours on batch uploads"]] },
            { t: "p", html: "Measure skew rather than guessing it: emit the difference between ingestion time and event time as a histogram per source. Its high percentiles are what your watermark delay and allowed lateness must cover." },
            { t: "note", variant: "trap", html: "Kafka's record timestamp defaults to the producer's create time, which is when the <em>producer</em> sent it, not necessarily when the event happened. If the business time is in the payload, extract it explicitly." },
            { t: "note", variant: "key", html: "<strong>Pick the event-time field deliberately and measure its skew.</strong> The p99 of that skew is the input to every watermark and lateness decision that follows." }
          ]),
          L("watermarks", "Watermarks", "A watermark is the stream's claim that earlier event times are complete; it trades latency for completeness.", 10, ["watermarks", "event-time", "late-data"], [
            { t: "p", html: "Event-time windows need to know when they can close. Event times arrive out of order, so the system cannot know for sure that no earlier event is still coming. A <strong>watermark</strong> is a heuristic claim flowing through the stream: \"no more events with event time before <em>t</em> are expected.\" When the watermark passes a window's end, the window fires." },
            { t: "widget", id: "pl-watermark" },
            { t: "code", lang: "java", code: "WatermarkStrategy<Click> wm = WatermarkStrategy\n    .<Click>forBoundedOutOfOrderness(Duration.ofSeconds(5))\n    .withTimestampAssigner((c, ts) -> c.eventTimeMillis())\n    .withIdleness(Duration.ofMinutes(1));   // idle partitions stop holding time back\n\nenv.fromSource(kafkaSource, wm, \"clicks\");" },
            { t: "ul", items: ["<strong>Bounded out-of-orderness:</strong> watermark = max event time seen \u2212 delay. Simple and common.", "<strong>Per-partition watermarks:</strong> sources track each partition and emit the minimum, so one partition's order does not hide another's lag.", "<strong>Minimum across inputs:</strong> an operator with several inputs uses the smallest watermark.", "<strong>Idleness:</strong> an input with no data is excluded after a timeout, otherwise it pins time for ever."] },
            { t: "note", variant: "warn", html: "One badly skewed source drags the watermark for the whole job. If one producer's clock is hours behind, its partition holds every window open; quarantine or correct that source rather than raising the delay for everyone." },
            { t: "cue", html: "<strong>Say the trade-off:</strong> \"A five-second watermark delay closes windows quickly; events later than that either update results through allowed lateness or go to a side output we reconcile.\"" },
            { t: "note", variant: "key", html: "<strong>Watermarks buy completeness with latency.</strong> Size the delay from measured skew, handle idle inputs, and give data later than the watermark an explicit path." }
          ]),
          L("windows", "Tumbling, sliding and session windows", "Window shape follows the question: fixed buckets, rolling views, or activity-defined sessions.", 8, ["windows", "aggregation"], [
            { t: "p", html: "A window turns an unbounded stream into finite groups you can aggregate. The shape should come from the business question, not from what is easiest to configure." },
            { t: "table", headers: ["Window", "Definition", "Question it answers", "State cost"], rows: [["Tumbling", "Fixed size, no overlap", "Orders per minute", "One window per key at a time"], ["Sliding (hopping)", "Fixed size, advancing by a smaller step", "Last 10 minutes, updated every minute", "Size / step windows per key"], ["Session", "Per key, closed after a gap of inactivity", "A user's visit", "One open session per active key; merges on late events"], ["Global with trigger", "One window per key, fired by custom logic", "Every 100 events", "Grows unless purged"]] },
            { t: "p", html: "Windows fire on a <strong>trigger</strong>. The default event-time trigger fires once when the watermark passes the window end. Early triggers can emit speculative results (\"so far\") every few seconds before the watermark arrives; downstream must then treat results as updates, not appends." },
            { t: "note", variant: "trap", html: "Sliding windows with a small step multiply state and output: a one-hour window sliding every second keeps 3,600 overlapping windows per key. Often a tumbling pre-aggregate per minute plus a rolling sum is far cheaper." },
            { t: "note", variant: "tip", html: "Session windows merge when a late event bridges two sessions. That is correct, but it means a result you already emitted can be retracted and replaced. Make the sink an upsert keyed by session." },
            { t: "note", variant: "key", html: "<strong>Choose the window from the question, then price its state.</strong> Tumbling is cheapest, sliding multiplies, sessions merge; early triggers turn results into updates." }
          ]),
          L("late-data", "Late data, allowed lateness and side outputs", "Decide explicitly what happens to events behind the watermark: update, divert, or drop with a count.", 8, ["late-data", "correctness"], [
            { t: "p", html: "No watermark is perfect, so some events will arrive after their window fired. There are three honest choices, and the wrong one is not choosing \u2014 most engines silently drop late events by default." },
            { t: "table", headers: ["Policy", "Mechanism", "Downstream impact"], rows: [["Update", "Allowed lateness keeps window state; late events re-emit a corrected result", "Sink must upsert"], ["Divert", "Late events go to a side output for reconciliation or batch correction", "A second path to own"], ["Drop and count", "Discard, but emit a metric of how many and how late", "Results are knowingly incomplete"]] },
            { t: "code", lang: "java", code: "OutputTag<Order> late = new OutputTag<>(\"late-orders\") {};\n\nSingleOutputStreamOperator<Revenue> revenue = orders\n    .keyBy(Order::storeId)\n    .window(TumblingEventTimeWindows.of(Duration.ofMinutes(1)))\n    .allowedLateness(Duration.ofMinutes(10))\n    .sideOutputLateData(late)\n    .aggregate(new SumRevenue());\n\nrevenue.getSideOutput(late).sinkTo(lateOrdersTopic);   // reconciled by a batch job" },
            { t: "note", variant: "warn", html: "Allowed lateness keeps every window's state alive for the whole lateness horizon. Ten minutes of lateness on per-second windows is six hundred extra windows per key in state." },
            { t: "note", variant: "tip", html: "Pair the streaming answer with a batch recompute for anything financial. The stream gives the fast, nearly right number; the batch job, run after the lateness horizon, gives the final one." },
            { t: "note", variant: "key", html: "<strong>Late data needs a policy, not a default.</strong> Update with allowed lateness, divert to a side output, or drop with a metric \u2014 and make the sink match the choice." }
          ], "sem-time")
        ]
      },
      {
        id: "state",
        name: "State, Joins & Dedup",
        icon: "blocks",
        lessons: [
          L("keyed-state", "Keyed state and state stores", "State is partitioned by key, owned by one instance, persisted for recovery and bounded by design.", 8, ["state", "flink", "kafka-streams"], [
            { t: "p", html: "After a <code class='tok'>keyBy</code> (Flink) or <code class='tok'>groupByKey</code> (Kafka Streams), every key is owned by exactly one parallel instance. That instance holds the key's <strong>state</strong> \u2014 a value, a list, a map \u2014 and processes the key's records one at a time. No locks are needed because no other instance touches that key." },
            { t: "table", headers: ["Engine", "Where state lives", "How it survives failure"], rows: [["Flink (heap backend)", "JVM objects", "Snapshotted into checkpoints"], ["Flink (RocksDB backend)", "Local embedded key-value store on disk", "Incremental checkpoints of changed files"], ["Kafka Streams", "Local RocksDB or in-memory store", "Changelog topic replayed on restore; optional standby replicas"], ["Spark Structured Streaming", "State store per partition (memory or RocksDB)", "Versioned snapshots in the checkpoint location"]] },
            { t: "p", html: "Recovery time is a function of state size. Restoring a 500 GB store from a changelog or remote checkpoint takes real minutes. Standby replicas (Kafka Streams) or local recovery (Flink) keep a warm copy so a restart does not start from zero." },
            { t: "note", variant: "trap", html: "Storing large values per key in heap state makes garbage collection the bottleneck. Past a few gigabytes per instance, an on-disk backend is usually the safer default." },
            { t: "note", variant: "key", html: "<strong>Keyed state is local, owned and checkpointed.</strong> Know where it lives, how long a restore takes, and what keeps it from growing for ever." }
          ]),
          L("stream-joins", "Stream-stream, stream-table and temporal joins", "Every streaming join needs a bound \u2014 a time interval, a table version, or a TTL.", 9, ["joins", "state", "sql"], [
            { t: "p", html: "In batch, a join sees both inputs completely. In streaming, both inputs are infinite, so the engine must buffer one side until a match might arrive from the other. The question for every join is: <strong>how long must the engine remember each side?</strong>" },
            { t: "table", headers: ["Join", "Matches", "State bound"], rows: [["Interval (window) join", "Order with payment within 15 minutes of it", "The interval on both sides"], ["Stream-table (lookup) join", "Each click to the current user profile", "The table, kept current from a changelog"], ["Temporal (versioned) join", "Each order to the exchange rate valid at its event time", "Table versions back to the watermark"], ["Regular (unbounded) join", "Anything, any time", "None \u2014 grows for ever unless TTL"]] },
            { t: "code", lang: "sql", code: "-- interval join: bounded by time on both sides\nSELECT o.order_id, p.payment_id\nFROM orders o\nJOIN payments p\n  ON o.order_id = p.order_id\n AND p.pay_time BETWEEN o.order_time AND o.order_time + INTERVAL '15' MINUTE;\n\n-- temporal join: rate as of the order's time\nSELECT o.order_id, o.amount * r.rate AS amount_usd\nFROM orders o\nJOIN rates FOR SYSTEM_TIME AS OF o.order_time AS r\n  ON o.currency = r.currency;" },
            { t: "note", variant: "warn", html: "A stream-table lookup against the <em>current</em> table gives different results on replay, because the table has moved on. If reproducibility matters, use a temporal join on event time." },
            { t: "note", variant: "tip", html: "Both inputs of a join must be co-partitioned by the join key. In Kafka Streams that means equal partition counts and the same partitioner; otherwise the library inserts a repartition topic." },
            { t: "note", variant: "key", html: "<strong>Bound every join.</strong> Interval joins bound by time, temporal joins by version, lookups by a maintained table \u2014 and an unbounded join needs a TTL you chose on purpose." }
          ]),
          L("dedup", "Deduplication", "Remember recent ids for a horizon that covers your duplicate sources \u2014 and let an idempotent sink handle the rest.", 7, ["deduplication", "idempotency", "state"], [
            { t: "p", html: "Duplicates enter streams from producer retries without idempotence, at-least-once consumers replaying after a crash, upstream systems re-sending, and CDC snapshots overlapping with the log. Deduplication needs a <strong>stable event id</strong> and keyed state remembering which ids have been seen." },
            { t: "code", lang: "sql", code: "-- keep the first row per event_id (Flink SQL dedup pattern)\nSELECT *\nFROM (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY proc_time) AS rn\n  FROM events\n)\nWHERE rn = 1;\n-- pair with a state TTL so ids are forgotten after the horizon" },
            { t: "table", headers: ["Duplicate source", "Typical delay", "Horizon to cover"], rows: [["Producer retry", "Seconds", "Minutes"], ["Consumer replay after crash", "Up to the checkpoint interval plus restart", "Tens of minutes"], ["Upstream re-send", "Hours", "A day"], ["Manual backfill", "Days", "Use an idempotent sink instead"]] },
            { t: "note", variant: "trap", html: "A hash of the payload is not an event id. Two genuinely separate identical purchases would collapse into one. Generate ids at the source." },
            { t: "note", variant: "key", html: "<strong>Dedup is state with an expiry.</strong> Cover the realistic duplicate window in the stream, and rely on idempotent writes for anything older." }
          ]),
          L("state-ttl", "State lifetimes and TTL", "Every stateful operator needs a reason its state is finite; TTL is the explicit one.", 7, ["state", "ttl", "operations"], [
            { t: "p", html: "State size is the single best predictor of streaming pain: checkpoint duration, restore time, memory pressure and cost all follow it. Windows bound state naturally. Joins without intervals, dedup sets, per-user profiles and SQL aggregations without windows do not \u2014 they need a <strong>time-to-live</strong>." },
            { t: "table", headers: ["Operator", "Natural bound", "TTL needed?"], rows: [["Tumbling window aggregate", "Window end + lateness", "No"], ["Session window", "Gap + lateness", "No"], ["Dedup", "None", "Yes \u2014 the dedup horizon"], ["Regular join", "None", "Yes \u2014 how long a match can still arrive"], ["Running total per key (no window)", "None", "Only if idle keys may be forgotten"]] },
            { t: "p", html: "TTL is usually based on last access or last update. Expired state is cleaned lazily on access or during compaction of the on-disk store, so disk usage lags behind the logical TTL." },
            { t: "note", variant: "warn", html: "Changing a TTL on a running job may not be compatible with restoring from an existing savepoint, depending on engine and version. Treat state configuration as part of the job's schema." },
            { t: "note", variant: "tip", html: "Graph state size per operator alongside checkpoint duration. A steady upward slope with flat traffic is a missing TTL." },
            { t: "note", variant: "key", html: "<strong>If it is not windowed, give it a TTL.</strong> State that grows with time instead of with traffic is an outage on a timer." }
          ], "sem-state")
        ]
      }
    ]
  };
})();
