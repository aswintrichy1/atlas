/* Pulse practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS (fund, kafka, kops, sem, flink,
   eo, cdc, engines, ops, cases). */
window.PulsePractice = {
  nav: [
    { id: "scenarios", route: "#/scenarios", title: "Scenario packs", label: "Design walkthroughs", color: "#22d3ee", icon: "map", summary: "Outlines you can talk through end to end for the streaming design problems that come up most." },
    { id: "interview", route: "#/interview", title: "Interview prompts", label: "Timed practice", color: "#a78bfa", icon: "quiz", summary: "Timed prompts with what an interviewer listens for and the follow-ups they push on." },
    { id: "rubrics", route: "#/rubrics", title: "Rubrics", label: "Score yourself", color: "#34d399", icon: "star", summary: "The dimensions a streaming design round is scored on, and what each band sounds like." },
    { id: "cheatsheets", route: "#/cheatsheets", title: "Cheat sheets", label: "Fast recall", color: "#fb923c", icon: "md", summary: "Durability settings, sizing maths, watermark rules and recovery checklists worth having in memory." },
    { id: "glossary", route: "#/glossary", title: "Glossary", label: "Say it precisely", color: "#f472b6", icon: "lesson", summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it." }
  ],

  scenarios: [
    {
      id: "clickstream",
      title: "Real-time clickstream analytics",
      subtitle: "Sessions, funnels and a daily authoritative report from 50k events per second.",
      timebox: "40 min",
      prompt: "Design a pipeline that turns website click events into live campaign funnels and per-visit metrics within a minute, plus a daily report finance can trust.",
      related: [
        { label: "Clickstream case", route: "#/cases/design/clickstream-sessions" },
        { label: "Session windows", route: "#/sem/time/windows" },
        { label: "Watermarks", route: "#/sem/time/watermarks" },
        { label: "Late data", route: "#/sem/time/late-data" }
      ],
      outline: [
        { title: "Collect and key", items: ["Edge collector into a clicks topic keyed by visitor id for per-visitor order.", "Validate, filter bots and route bad records to a dead-letter topic before any shuffle."] },
        { title: "Compute on event time", items: ["Clamp client timestamps against server receipt time.", "Session windows with a 30-minute gap; tumbling 1-minute funnels; watermark delay from measured skew."] },
        { title: "Serve and correct", items: ["Upsert sessions by session id so late events revise them; append funnels.", "Nightly batch recompute from the raw topic for the authoritative report."] },
        { title: "Size and run", items: ["Partitions from max(produce, consume) throughput with catch-up headroom.", "Alert on lag in seconds, checkpoint age and an end-to-end freshness probe."] }
      ]
    },
    {
      id: "fraud",
      title: "Sub-second fraud scoring",
      subtitle: "Per-card features in state, local scoring and idempotent decisions.",
      timebox: "40 min",
      prompt: "Score every card authorisation for fraud within about 100 ms, using velocity features and a model, with decisions that are auditable and never applied twice.",
      related: [
        { label: "Fraud case", route: "#/cases/design/fraud-scoring" },
        { label: "Keyed state", route: "#/sem/state/keyed-state" },
        { label: "DataStream API", route: "#/flink/runtime/datastream" },
        { label: "Idempotent sinks", route: "#/eo/endtoend/idempotent-sinks" }
      ],
      outline: [
        { title: "Key and state", items: ["Key by card id; keep rolling counts, sums, devices and merchants in RocksDB state with TTL.", "Load the model as broadcast state so scoring needs no remote call."] },
        { title: "Latency budget", items: ["No two-phase commit on the hot path (it adds a checkpoint interval of latency).", "Incremental and unaligned checkpoints to keep pauses small."] },
        { title: "Decisions", items: ["Write decisions keyed by authorisation id; the decision service applies each id once.", "Fallback rules when the score is late."] }
      ]
    },
    {
      id: "cdc-lakehouse",
      title: "Database to lakehouse with CDC",
      subtitle: "Mirror hundreds of tables with five-minute freshness and full history.",
      timebox: "35 min",
      prompt: "Replicate an operational PostgreSQL database into lakehouse tables with five-minute freshness, history for audits and safe handling of schema changes.",
      related: [
        { label: "Log-based CDC", route: "#/cdc/capture/log-based-cdc" },
        { label: "Snapshots and slots", route: "#/cdc/capture/snapshots" },
        { label: "CDC into the lakehouse", route: "#/cdc/pipelines/cdc-to-lakehouse" },
        { label: "Case study", route: "#/cases/production/cdc-lakehouse-case" }
      ],
      outline: [
        { title: "Capture", items: ["Log-based CDC with incremental snapshots and a dedicated slot and least-privilege user.", "Topic per table keyed by primary key; registry with transitive compatibility."] },
        { title: "Land and merge", items: ["Append-only changelog table, then MERGE by key guarded by LSN every few minutes.", "Compaction and clustering on a schedule."] },
        { title: "Operate", items: ["Alert on replication slot retained WAL, merge freshness and DLQ rate.", "Daily row-count reconciliation source versus target."] }
      ]
    },
    {
      id: "exactly-once-pipeline",
      title: "An exactly-once Kafka-to-Kafka pipeline",
      subtitle: "Enrich orders with no loss and no duplicates through failures.",
      timebox: "30 min",
      prompt: "Design an order-enrichment service reading from one topic and writing to another, guaranteeing that every order appears exactly once downstream even when instances crash.",
      related: [
        { label: "What exactly-once means", route: "#/eo/guarantees/what-eo-means" },
        { label: "Kafka transactions", route: "#/eo/guarantees/kafka-transactions" },
        { label: "read_committed", route: "#/eo/guarantees/read-committed" },
        { label: "Pitfalls", route: "#/eo/endtoend/eo-pitfalls" }
      ],
      outline: [
        { title: "Mechanism", items: ["Idempotent, transactional producer; output and input offsets in one transaction.", "Stable transactional id per instance for zombie fencing."] },
        { title: "Readers", items: ["Downstream consumers on read_committed.", "Short transactions so the last stable offset does not stall readers."] },
        { title: "Edges", items: ["No external calls inside the loop; enrichment data loaded as a table.", "Failure drill: kill an instance mid-transaction and reconcile counts."] }
      ]
    }
  ],

  interview: [
    {
      id: "kafka-durability-25",
      title: "Kafka durability in 25 minutes",
      timebox: "25 min",
      prompt: "Explain how Kafka keeps acknowledged writes safe when brokers fail, and which settings you would choose for payment events.",
      expected: ["Explains leader, followers, ISR and the high watermark.", "Chooses RF 3, min ISR 2, acks=all, unclean election off, and says what each buys.", "Mentions the idempotent producer for retries.", "States the trade-off: writes stop rather than lose data when the ISR is too small."],
      followups: ["What happens with acks=1 when the leader dies?", "Why not min ISR 3 with RF 3?", "How does a consumer avoid reading data that may be truncated?"],
      links: [{ label: "Replication and ISR", route: "#/kafka/replication/replication-isr" }, { label: "Idempotent producer", route: "#/kafka/replication/idempotent-producer" }]
    },
    {
      id: "watermarks-20",
      title: "Watermarks and late data in 20 minutes",
      timebox: "20 min",
      prompt: "A dashboard shows hourly revenue by store from a stream. Explain how you make it correct when events arrive out of order and late.",
      expected: ["Uses event time and explains why processing time is wrong.", "Sizes the watermark from measured skew and handles idle partitions.", "Chooses a late-data policy: allowed lateness with upserts, a side output, or a batch recompute."],
      followups: ["What if one store's clock is an hour behind?", "How does the sink handle corrected results?", "What does allowed lateness cost in state?"],
      links: [{ label: "Watermarks", route: "#/sem/time/watermarks" }, { label: "Late data", route: "#/sem/time/late-data" }]
    },
    {
      id: "flink-recovery-25",
      title: "Flink recovery in 25 minutes",
      timebox: "25 min",
      prompt: "Walk through what happens when a TaskManager in a stateful Flink job dies, and how you make sure output is neither lost nor duplicated.",
      expected: ["Describes barrier checkpoints and restore plus replay from source offsets.", "Distinguishes internal state guarantees from sink guarantees.", "Chooses two-phase commit or idempotent upserts and states the latency trade-off.", "Mentions the transaction timeout rule and read_committed readers."],
      followups: ["What if checkpoints have been failing for an hour?", "How do you upgrade the job without losing state?", "Why might recovery take ten minutes?"],
      links: [{ label: "Checkpoints", route: "#/flink/resilience/checkpoints" }, { label: "Two-phase commit sinks", route: "#/eo/endtoend/flink-2pc" }]
    },
    {
      id: "engine-choice-15",
      title: "Choose an engine in 15 minutes",
      timebox: "15 min",
      prompt: "Your company runs a Spark lakehouse. A new team wants to build per-user alerts with sub-second latency and timers. Which engine, and why?",
      expected: ["Starts from latency, state and timers rather than brand.", "Explains micro-batch latency floors versus record-at-a-time.", "Weighs operating a new runtime against requirements, and states the trade-off."],
      followups: ["What if the latency budget were one minute?", "Could Kafka Streams work here?", "Who operates it at 3 a.m.?"],
      links: [{ label: "Processing models", route: "#/engines/compare/processing-models" }, { label: "Choosing an engine", route: "#/engines/compare/choosing-engine" }]
    }
  ],

  rubrics: {
    dimensions: [
      "Correctness model \u2014 event time, watermarks, late data and delivery guarantees",
      "Log and partition design \u2014 keys, ordering, partition counts and retention",
      "State and recovery \u2014 state size, TTLs, checkpoints and restore time",
      "End-to-end guarantees \u2014 transactions, idempotent sinks and edge cases",
      "Operations \u2014 lag SLOs, capacity for catch-up, failure drills and security",
      "Communication and trade-off reasoning"
    ],
    bands: [
      { id: "beginner", title: "Beginner", summary: "Names Kafka and Flink but cannot reason about time, order or failure.", signals: ["Uses processing time for business metrics.", "Claims exactly-once because the engine supports it.", "Picks partition counts without throughput numbers.", "Ignores state growth."] },
      { id: "competent", title: "Competent", summary: "Designs a correct pipeline with sensible settings, but edges and operations are thin.", signals: ["Keys by entity and explains per-partition order.", "Uses event time with a watermark and handles late data somehow.", "Chooses RF 3, min ISR 2, acks=all.", "Mentions lag monitoring but in messages, not seconds."] },
      { id: "strong", title: "Strong", summary: "Connects semantics, state, guarantees and operations into one system and quantifies it.", signals: ["Sizes partitions and consumers for catch-up, not just steady state.", "Bounds every stateful operator and explains restore time.", "Chooses transactions or idempotent sinks per hop and names the latency cost.", "Plans failure drills with reconciliation and secrets injected at runtime."] }
    ]
  },

  cheatsheets: [
    { id: "durability", title: "Kafka durability defaults", summary: "The settings to say out loud for important data.", items: ["replication.factor = 3", "min.insync.replicas = 2", "acks = all, enable.idempotence = true", "unclean.leader.election.enable = false", "Tolerates one broker loss with no acked-data loss and continued writes."] },
    { id: "sizing", title: "Sizing maths", summary: "Back-of-envelope formulas.", items: ["partitions = max(T / produce-per-partition, T / consume-per-instance) + headroom", "storage = rate \u00d7 retention \u00d7 RF", "egress \u2248 ingress \u00d7 (RF \u2212 1 + consumer groups)", "drain time = backlog / (capacity \u2212 input rate)", "Little's law: in flight = rate \u00d7 time in stage"] },
    { id: "watermarks", title: "Watermark rules", summary: "Event-time correctness in five lines.", items: ["Watermark = max event time \u2212 bounded delay (from measured skew p99).", "Operators take the minimum watermark across inputs.", "Idle inputs need an idleness timeout.", "Late data needs a policy: update, divert or drop with a metric.", "Allowed lateness keeps window state alive for the whole horizon."] },
    { id: "recovery", title: "Recovery checklist", summary: "What to check when a stateful job restarts.", items: ["Age and size of the last completed checkpoint.", "Source offsets restored from the checkpoint, not the consumer group.", "Sink mode: transactional (commit on checkpoint) or idempotent upsert.", "Transaction timeout > checkpoint interval + recovery.", "Catch-up time with current headroom."] }
  ],

  glossary: [
    { id: "isr", term: "ISR", definition: "The in-sync replica set: the leader and followers that have caught up recently.", useIt: "\"With min ISR 2 and acks=all, a write is acknowledged only once two in-sync replicas have it.\"", links: [{ label: "Replication and ISR", route: "#/kafka/replication/replication-isr" }] },
    { id: "watermark", term: "Watermark", definition: "A claim that no more events earlier than a given event time are expected.", useIt: "\"Our watermark trails max event time by five seconds, from the p99 of measured skew.\"", links: [{ label: "Watermarks", route: "#/sem/time/watermarks" }] },
    { id: "checkpoint", term: "Checkpoint", definition: "A consistent snapshot of all operator state and source positions taken with barriers.", useIt: "\"Recovery restores the last completed checkpoint and replays from its offsets.\"", links: [{ label: "Checkpoints", route: "#/flink/resilience/checkpoints" }] },
    { id: "lso", term: "Last stable offset", definition: "The offset before the earliest open transaction; read_committed consumers stop there.", useIt: "\"Long transactions stall committed readers at the LSO, so we keep them short.\"", links: [{ label: "read_committed", route: "#/eo/guarantees/read-committed" }] },
    { id: "outbox", term: "Transactional outbox", definition: "An event row written in the same local transaction as the business change and published via CDC.", useIt: "\"The outbox removes the dual write between the database and Kafka.\"", links: [{ label: "Outbox", route: "#/cdc/capture/outbox" }] },
    { id: "lag", term: "Consumer lag (seconds)", definition: "The age of the oldest unprocessed record, at the slowest partition.", useIt: "\"Our SLO is lag under 60 seconds for 99% of minutes.\"", links: [{ label: "Lag SLOs", route: "#/ops/observe/lag-slos" }] }
  ]
};
