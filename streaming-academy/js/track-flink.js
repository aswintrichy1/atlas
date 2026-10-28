/* =====================================================================
   PULSE · Apache Flink
   window.TRACKS.flink — modules: runtime / resilience / sql
   Widget used: pl-checkpoint (js/widgets.js)
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks, quiz) {
    if (quiz) blocks.splice(blocks.length - 1, 0, { t: "quiz", id: quiz });
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "flink-runtime": {
      title: "Flink runtime checkpoint",
      sub: "Architecture, DataStream, state backends and backpressure.",
      questions: [
        { q: "What does a task slot represent in Flink?", options: ["A Kafka partition", "A slice of a TaskManager's resources that runs one parallel pipeline of chained operators", "A checkpoint file", "A JobManager thread"], answer: 1, explain: "TaskManagers offer slots; each slot runs one parallel instance of a (possibly chained) pipeline. Parallelism and slot count decide how many TaskManagers a job needs." },
        { q: "Why does operator chaining matter for performance?", options: ["Chained operators run in one thread and pass records by method call, avoiding serialisation and network hops", "It enables exactly-once", "It reduces state size", "It is required for SQL"], answer: 0, explain: "Operators connected one-to-one with equal parallelism are fused into one task. A keyBy or a parallelism change breaks the chain and adds a network shuffle." },
        { q: "When is the RocksDB state backend the better choice?", options: ["When state is tiny and latency must be minimal", "Only for batch jobs", "When state is large (beyond comfortable heap size) and you want incremental checkpoints", "When you do not need checkpoints"], answer: 2, explain: "RocksDB keeps state on local disk, avoiding huge heaps and GC pauses, and supports incremental checkpoints. Heap state is faster per access but limited by memory." },
        { q: "The Web UI shows a map operator as backpressured and the sink as busy at 100%. Where is the bottleneck?", options: ["The map", "The source", "The JobManager", "The sink, which is slowing everything upstream"], answer: 3, explain: "Backpressure marks operators that are being slowed by downstream. The first operator that is busy but not backpressured \u2014 here the sink \u2014 is the bottleneck." },
        { q: "What is the role of the JobManager?", options: ["It schedules tasks, coordinates checkpoints and handles recovery for the job", "It stores all keyed state", "It runs user functions", "It replaces Kafka brokers"], answer: 0, explain: "The JobManager is the job's coordinator: scheduling, checkpoint triggering, failure handling. TaskManagers run the actual operators and hold state." }
      ]
    },
    "flink-resilience": {
      title: "Checkpoints & upgrades checkpoint",
      sub: "Barriers, recovery, savepoints and rescaling.",
      questions: [
        { q: "How do checkpoint barriers produce a consistent snapshot without stopping the job?", options: ["They pause all sources until the snapshot is done", "Barriers flow with the data; each operator snapshots its state when barriers from all inputs have arrived, so the snapshot matches a single cut of the stream", "Every record is written to disk", "The JobManager copies all state over the network"], answer: 1, explain: "Barriers split the stream into before and after. Aligning on them gives every operator a snapshot of the same logical point, while records keep flowing in between." },
        { q: "What problem do unaligned checkpoints solve?", options: ["Slow sources", "Large state", "Under heavy backpressure, barriers wait behind full buffers and checkpoints time out; unaligned checkpoints let barriers overtake and store in-flight data", "Schema evolution"], answer: 2, explain: "Aligned checkpoints are delayed by buffered data. Unaligned checkpoints include that in-flight data in the snapshot, so checkpoint time no longer depends on backpressure, at the cost of larger checkpoints." },
        { q: "Why set an explicit uid on every stateful operator?", options: ["It makes the job faster", "It is needed for logging", "It enables chaining", "State in a savepoint is matched to operators by id; auto-generated ids change when the graph changes, orphaning state on upgrade"], answer: 3, explain: "Savepoint restore maps state by operator id. Stable uids let you change the job graph and still restore the right state into the right operator." },
        { q: "What limits how far a Flink job's keyed state can be rescaled?", options: ["Maximum parallelism, which fixes the number of key groups", "The number of Kafka brokers", "The checkpoint interval", "The JVM version"], answer: 0, explain: "Keys hash into a fixed number of key groups set by max parallelism. You can rescale up to that number; changing max parallelism itself is not state-compatible." },
        { q: "Checkpoint vs savepoint: which statement is right?", options: ["They are identical", "Checkpoints are automatic and owned by Flink for failure recovery; savepoints are triggered by you, portable, and used for upgrades and migrations", "Savepoints are faster", "Checkpoints cannot be used to restore"], answer: 1, explain: "Checkpoints are frequent, lightweight and may be in a native, version-specific format. Savepoints are deliberate, user-owned snapshots meant to outlive job versions." }
      ]
    },
    "flink-sql": {
      title: "Flink SQL checkpoint",
      sub: "Dynamic tables, changelogs and SQL joins.",
      questions: [
        { q: "What is a dynamic table?", options: ["A table that changes over time, with a continuous query producing a changelog of its results", "A temporary batch table", "A table stored in Kafka only", "A table without a schema"], answer: 0, explain: "Flink SQL treats streams as tables that change over time. A continuous query on them yields another dynamic table, emitted as a changelog of inserts, updates and deletes." },
        { q: "A query computes COUNT(*) GROUP BY user with no window. What does the sink receive?", options: ["Only inserts", "One row at the end", "Updates: each new event retracts or upserts the user's previous count", "Nothing until the job stops"], answer: 2, explain: "An unwindowed aggregate keeps changing, so it produces an updating changelog. The sink must support upserts (or retractions) keyed by user." },
        { q: "Why does a GROUP BY with no window need a state TTL in production?", options: ["SQL requires it", "Otherwise it emits duplicates", "TTL makes queries faster", "One state entry per key is kept forever, so state grows with the number of distinct keys ever seen"], answer: 3, explain: "Without a window, the aggregate never knows a key is finished. A TTL bounds state, at the cost of restarting a key's aggregate if it reappears after expiry." },
        { q: "Which sink can accept an updating changelog directly?", options: ["An append-only file sink", "An upsert sink keyed by the result's primary key, such as an upsert-Kafka topic or a database table", "Any sink", "A print sink in append mode only"], answer: 1, explain: "Updates need somewhere to overwrite. Upsert sinks apply each change by key; append-only sinks reject updating queries." },
        { q: "What does a window table-valued function (for example TUMBLE) give you over an unwindowed GROUP BY?", options: ["Append-only results with state freed after each window closes", "Faster parsing", "Exactly-once sinks", "Unlimited lateness"], answer: 0, explain: "Windowed aggregation with event time emits each window once when the watermark passes and then drops its state, so output is append-only and state stays bounded." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.flink = {
    id: "flink",
    name: "Apache Flink",
    short: "FLINK",
    tagline: "Stateful streams with snapshots",
    color: "#fb923c",
    blurb: "Flink from the inside: JobManager and TaskManagers, slots and chaining, the DataStream API, heap and RocksDB state, credit-based backpressure, barrier checkpoints aligned and unaligned, savepoints and safe upgrades, key groups and rescaling, and Flink SQL with dynamic tables, changelogs and bounded joins.",
    modules: [
      {
        id: "runtime",
        name: "Runtime & State",
        icon: "cube",
        lessons: [
          L("architecture", "JobManager, TaskManagers, slots and chaining", "A job graph becomes parallel tasks in slots; chaining fuses operators, and keyBy splits them with a shuffle.", 9, ["flink", "architecture"], [
            { t: "p", html: "You write a program of operators; Flink turns it into a <strong>job graph</strong>, then an execution graph of parallel <strong>tasks</strong>. The <strong>JobManager</strong> schedules those tasks, triggers checkpoints and handles failures. <strong>TaskManagers</strong> are the worker JVMs; each offers a number of <strong>slots</strong>, and each slot runs one parallel slice of the pipeline." },
            { t: "code", lang: "text", code: "source(kafka) -> map(parse) -> filter -> keyBy(user) -> window(count) -> sink\n\\________________ chained __________/   shuffle   \\____ chained ____/\n\nparallelism 4 -> 4 parallel instances of each chain, spread over slots" },
            { t: "table", headers: ["Concept", "What it is", "Why you care"], rows: [["Parallelism", "Instances of an operator", "Throughput; capped by source partitions for the source"], ["Chaining", "Fusing one-to-one operators into one task", "No serialisation between them"], ["Shuffle (keyBy, rebalance)", "Network redistribution", "Costs CPU and network; breaks chains"], ["Slot sharing", "One slot can host one instance of every operator", "Slots needed = max parallelism, not the sum"]] },
            { t: "note", variant: "tip", html: "Source parallelism above the number of Kafka partitions leaves source instances idle. Set source parallelism to the partition count, and raise parallelism after the first shuffle if the heavy work is downstream." },
            { t: "note", variant: "trap", html: "A <code class='tok'>rebalance()</code> or parallelism change inserted \"for performance\" adds a network hop and can make things slower. Only break chains when an operator really needs different parallelism." },
            { t: "note", variant: "key", html: "<strong>JobManager coordinates, TaskManagers execute, slots hold parallel slices.</strong> Chains are free; every keyBy is a shuffle you pay for." }
          ]),
          L("datastream", "The DataStream API", "Sources with watermarks, keyed process functions, timers and sinks \u2014 the low-level toolkit behind everything else.", 9, ["flink", "datastream", "api"], [
            { t: "p", html: "The DataStream API is Flink's general-purpose layer. Most jobs look the same: a <strong>source</strong> with a watermark strategy, stateless transformations, a <code class='tok'>keyBy</code>, a stateful step (window or process function), and a <strong>sink</strong> with a delivery guarantee." },
            { t: "code", lang: "java", code: "KafkaSource<Payment> source = KafkaSource.<Payment>builder()\n    .setBootstrapServers(cfg.bootstrap())        // from configuration, not source code\n    .setTopics(\"payments\")\n    .setGroupId(\"fraud-scorer\")\n    .setStartingOffsets(OffsetsInitializer.committedOffsets(OffsetResetStrategy.EARLIEST))\n    .setValueOnlyDeserializer(new PaymentSchema())\n    .build();\n\nenv.fromSource(source, paymentWatermarks, \"payments\")\n   .keyBy(Payment::cardId)\n   .process(new VelocityCheck())               // keyed state + timers\n   .uid(\"velocity-check\")\n   .sinkTo(alertsSink);" },
            { t: "p", html: "A <strong>KeyedProcessFunction</strong> is the escape hatch: per-key state, plus <strong>timers</strong> in event or processing time. With them you can build anything windows cannot express \u2014 \"alert if no payment confirmation within 10 minutes\", custom sessionisation, rate limits per key." },
            { t: "note", variant: "tip", html: "Event-time timers fire when the watermark passes them, so they are reproducible on replay. Processing-time timers fire on the wall clock and are not. Prefer event-time timers for business logic." },
            { t: "note", variant: "warn", html: "Never call blocking external services inside a process function per record. Use async I/O with a bounded capacity, or pre-load the reference data as state or a broadcast stream." },
            { t: "note", variant: "key", html: "<strong>Source with watermarks, keyBy, keyed process function with timers, sink with a guarantee.</strong> That skeleton covers most production Flink jobs." }
          ]),
          L("state-backends", "State backends and checkpoint storage", "Heap state is fast and small; RocksDB is large and incremental; checkpoints go to durable shared storage.", 8, ["flink", "state", "rocksdb"], [
            { t: "p", html: "Flink separates where working state lives (the <strong>state backend</strong>) from where snapshots go (<strong>checkpoint storage</strong>, usually an object store or distributed file system). Choosing the backend is mostly a question of state size and access cost." },
            { t: "table", headers: ["Backend", "Working state", "Snapshot", "Good for"], rows: [["HashMap (heap)", "Java objects on the heap", "Full copy each checkpoint", "Small state, lowest latency"], ["Embedded RocksDB", "Serialized on local disk, cached in memory", "Incremental: only new files", "Large state, many keys"], ["Disaggregated (newer releases)", "Primarily in remote storage with local cache", "Native to the remote store", "Very large state, fast rescaling"]] },
            { t: "p", html: "With RocksDB, every state access serialises and deserialises, so per-record cost is higher than heap state. In exchange, state can be far larger than memory, garbage collection stays calm, and incremental checkpoints upload only changed files \u2014 which turns a 200 GB state into a checkpoint of a few gigabytes." },
            { t: "note", variant: "trap", html: "RocksDB memory is managed outside the heap. Give TaskManagers managed memory for it; starving it causes heavy disk reads that look like a slow job, not like a memory problem." },
            { t: "note", variant: "tip", html: "Enable local recovery when restart speed matters: TaskManagers keep a local copy of their last snapshot and restore from it instead of downloading everything." },
            { t: "note", variant: "key", html: "<strong>Heap for small and fast, RocksDB for large and incremental.</strong> Checkpoints always go to durable shared storage, and restore time scales with what you keep." }
          ]),
          L("backpressure-flink", "Backpressure, buffers and diagnosing slow jobs", "Credit-based flow control makes slowness propagate; busy, backpressured and idle times tell you where it starts.", 8, ["flink", "backpressure", "performance"], [
            { t: "p", html: "Flink tasks exchange data through network buffers. A receiver grants <strong>credits</strong> for the buffers it has free, and a sender only sends what it has credit for. When a downstream task is slow, credits run out, the sender's output buffers fill, and it slows in turn \u2014 all the way back to the source, which simply reads Kafka more slowly." },
            { t: "table", headers: ["Metric (per task)", "Meaning", "Reading it"], rows: [["busyTimeMsPerSecond", "Time spent processing", "Near 1000 = this task is saturated"], ["backPressuredTimeMsPerSecond", "Time blocked on downstream", "High = the bottleneck is further down"], ["idleTimeMsPerSecond", "Time waiting for input", "High = upstream is the limit, or there is no data"]] },
            { t: "ol", items: ["Find the first task, walking from source to sink, that is busy but not backpressured: that is the bottleneck.", "Check for skew: one subtask busy, others idle, means a hot key.", "Check state access: RocksDB reads per record, large values, missing caching.", "Check the sink: external writes without batching or async I/O are the most common cause.", "Only then add parallelism."] },
            { t: "note", variant: "warn", html: "Backpressure also delays checkpoint barriers, which queue behind full buffers. Rising checkpoint duration is often the first visible symptom of a backpressure problem. Buffer debloating and unaligned checkpoints help." },
            { t: "note", variant: "key", html: "<strong>The bottleneck is the first busy task that is not backpressured.</strong> Check skew, state access and the sink before throwing parallelism at it." }
          ], "flink-runtime")
        ]
      },
      {
        id: "resilience",
        name: "Checkpoints, Savepoints & Scaling",
        icon: "shield",
        lessons: [
          L("checkpoints", "Checkpoints and barrier snapshots", "Barriers flowing with the data give a consistent snapshot of every operator and source position without stopping the job.", 11, ["flink", "checkpoints", "recovery"], [
            { t: "p", html: "A Flink checkpoint is a consistent snapshot of the whole job: every operator's state plus every source's read position, all taken at the same logical point in the stream. The JobManager injects <strong>checkpoint barriers</strong> at the sources. Barriers flow downstream with the records. When an operator has received the barrier on all its inputs, it snapshots its state asynchronously and forwards the barrier." },
            { t: "widget", id: "pl-checkpoint" },
            { t: "p", html: "On failure, Flink restarts the affected tasks, restores every operator from the latest completed checkpoint and rewinds sources to the recorded offsets. Records after the checkpoint are processed again. Internal state is therefore exactly-once; whether the <em>output</em> is depends on the sink (see <a href=\"#/eo/endtoend/flink-2pc\">two-phase commit sinks</a>)." },
            { t: "table", headers: ["Setting", "Effect", "Trade-off"], rows: [["Checkpoint interval", "How much is replayed after failure", "Shorter = more overhead and storage IO"], ["Min pause between checkpoints", "Guarantees processing time between them", "Prevents back-to-back checkpoints under load"], ["Timeout", "When an in-progress checkpoint is abandoned", "Too short fails under backpressure"], ["Aligned vs unaligned", "Wait for barriers vs let them overtake", "Unaligned = faster under backpressure, bigger snapshots"], ["Tolerable failures", "Failed checkpoints before the job fails", "Hides problems if set too high"]] },
            { t: "note", variant: "trap", html: "A job that keeps running while checkpoints fail is a job that will replay hours of data at the next restart \u2014 or cannot restore at all. Alert on checkpoint failures and age of the last completed checkpoint, not just on job uptime." },
            { t: "cue", html: "<strong>Explain recovery in one breath:</strong> \"Restore all operators from the last completed checkpoint, rewind Kafka to the offsets in it, replay; state is exactly-once, and the transactional sink keeps output exactly-once too.\"" },
            { t: "note", variant: "key", html: "<strong>Checkpoints snapshot state and source offsets at one consistent cut.</strong> Recovery is restore plus replay; the interval sets how much you replay and the sink decides whether replay is visible." }
          ]),
          L("savepoints-upgrades", "Savepoints and safe upgrades", "Stop with a savepoint, deploy the new version, restore \u2014 with stable operator ids and compatible state schemas.", 8, ["flink", "savepoints", "deployment"], [
            { t: "p", html: "A <strong>savepoint</strong> is a checkpoint you trigger and own. It is the unit of every planned change: code upgrades, Flink version upgrades, parallelism changes, moving clusters. The workflow is stop-with-savepoint, deploy, start from savepoint." },
            { t: "ol", items: ["Give every stateful operator a stable <code class='tok'>uid</code>; state is mapped by it.", "Stop the job with a savepoint (optionally draining, which advances the watermark to end-of-time and flushes windows).", "Deploy the new version and start it from the savepoint path.", "If you removed an operator, allow non-restored state explicitly.", "Keep the previous savepoint until the new version is proven."] },
            { t: "table", headers: ["Change", "State-compatible?"], rows: [["Add a stateless operator", "Yes"], ["Change parallelism (\u2264 max parallelism)", "Yes"], ["Add a field to a POJO or Avro state type", "Usually, with schema evolution support"], ["Change a state's key type", "No \u2014 needs a migration (state processor or reprocess)"], ["Change max parallelism", "No"]] },
            { t: "note", variant: "trap", html: "Without explicit uids, Flink derives operator ids from the graph structure. Inserting a single map upstream changes them, and the new job silently starts with empty state." },
            { t: "note", variant: "tip", html: "For incompatible changes, run the new version side by side from an earlier offset, compare outputs, then switch consumers \u2014 the streaming equivalent of a blue-green deploy." },
            { t: "note", variant: "key", html: "<strong>Savepoints are how state survives change.</strong> Stable uids, compatible state types, and the old savepoint kept until the new job is trusted." }
          ]),
          L("rescaling", "Key groups, rescaling and autoscaling", "Keyed state is split into a fixed number of key groups; parallelism can move up to that number and no further.", 8, ["flink", "scaling", "state"], [
            { t: "p", html: "Flink hashes each key into one of a fixed number of <strong>key groups</strong>, set by the job's <strong>maximum parallelism</strong>. Each parallel instance owns a contiguous range of key groups. Rescaling redistributes ranges, so state moves in whole key groups rather than key by key. That is fast, but it means parallelism can never exceed max parallelism." },
            { t: "code", lang: "text", code: "max parallelism = 128 key groups\nparallelism 4  -> instance 0: groups 0-31,  1: 32-63,  2: 64-95,  3: 96-127\nparallelism 8  -> 16 groups each (restore re-splits the same ranges)\nparallelism 200 -> impossible: only 128 groups exist" },
            { t: "ul", items: ["Set max parallelism deliberately at first deploy (a power of two well above expected peak, such as 256 or 512).", "Changing it later is not state-compatible.", "Very high max parallelism adds a little per-key-group overhead; it is cheap but not free.", "Autoscalers (in operators or the adaptive scheduler) rescale by restarting from a checkpoint or savepoint with new parallelism."] },
            { t: "note", variant: "warn", html: "Rescaling does not fix a hot key. One key always maps to one key group and one instance. Skew needs a different fix: salting the key with a two-stage aggregation, or isolating the hot entity." },
            { t: "note", variant: "key", html: "<strong>Max parallelism fixes the key-group count for the life of the state.</strong> Choose it generously up front; rescaling moves whole groups and cannot split a hot key." }
          ], "flink-resilience")
        ]
      },
      {
        id: "sql",
        name: "Flink SQL & Changelogs",
        icon: "grid",
        lessons: [
          L("flink-sql", "Flink SQL and dynamic tables", "SQL over streams treats inputs as changing tables and outputs as changelogs \u2014 windows keep results append-only.", 9, ["flink", "sql", "dynamic-tables"], [
            { t: "p", html: "Flink SQL lets you write continuous queries in standard SQL. Its model is the <strong>dynamic table</strong>: a stream is a table that keeps changing, and a continuous query over it produces another changing table. That result is emitted as a <strong>changelog</strong> of row changes the sink must apply." },
            { t: "code", lang: "sql", code: "CREATE TABLE clicks (\n  user_id STRING,\n  url     STRING,\n  ts      TIMESTAMP(3),\n  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND\n) WITH ('connector' = 'kafka', 'topic' = 'clicks', 'format' = 'avro-confluent' /* ... */);\n\n-- append-only: each window is emitted once and its state dropped\nSELECT window_start, user_id, COUNT(*) AS clicks\nFROM TABLE(TUMBLE(TABLE clicks, DESCRIPTOR(ts), INTERVAL '1' MINUTE))\nGROUP BY window_start, window_end, user_id;" },
            { t: "table", headers: ["Query shape", "Output", "Sink needs"], rows: [["Filter, project", "Append", "Any sink"], ["Windowed aggregate (event time)", "Append", "Any sink"], ["Unwindowed GROUP BY", "Updates", "Upsert by key"], ["Regular join", "Updates and retractions", "Upsert or retract-aware sink"], ["Deduplication (ROW_NUMBER = 1)", "Append (keep first) or updates (keep last)", "Depends on ordering"]] },
            { t: "note", variant: "tip", html: "Connector credentials belong in the deployment's secret mechanism, referenced from configuration \u2014 never in the DDL checked into the repository." },
            { t: "note", variant: "key", html: "<strong>Streams are changing tables; results are changelogs.</strong> Windowed queries stay append-only and bounded; everything else needs an upsert sink and a state TTL." }
          ]),
          L("changelog-joins", "Changelogs, retractions and SQL joins in production", "Know which operators emit updates, bound every join, and set table.exec.state.ttl before you go live.", 8, ["flink", "sql", "joins", "state"], [
            { t: "p", html: "In production, most Flink SQL trouble comes from two things: queries that unexpectedly produce <strong>updating</strong> results, and operators whose <strong>state never expires</strong>. Both are visible in the query plan before you deploy." },
            { t: "table", headers: ["Change kind", "Meaning"], rows: [["+I", "Insert a new row"], ["-U", "Retract the previous version of a row (update before)"], ["+U", "The new version of a row (update after)"], ["-D", "Delete a row"]] },
            { t: "ul", items: ["Prefer <strong>interval joins</strong> or <strong>temporal joins</strong> to regular joins.", "Set a global <code class='tok'>table.exec.state.ttl</code> (or per-operator hints) matching the business horizon.", "Use upsert sinks with a declared primary key so the planner can avoid retractions.", "Read the plan (EXPLAIN) for changelog modes and state-heavy operators before go-live."] },
            { t: "note", variant: "trap", html: "Chaining an updating query into another aggregation multiplies retractions: each upstream update produces a retract and an insert downstream. Pre-aggregate in windows where you can." },
            { t: "note", variant: "warn", html: "Changing a SQL query usually changes its operator graph, and restoring the old state is often not possible. Plan SQL job changes as reprocess-from-offset or side-by-side deploys." },
            { t: "note", variant: "key", html: "<strong>Read the changelog mode and the state bound of every query.</strong> Bounded joins, a state TTL and upsert sinks keep SQL pipelines finite and predictable." }
          ], "flink-sql")
        ]
      }
    ]
  };
})();
