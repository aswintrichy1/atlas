/* =====================================================================
   PULSE · Engine Comparison
   window.TRACKS.engines — module: compare
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks, quiz) {
    if (quiz) blocks.splice(blocks.length - 1, 0, { t: "quiz", id: quiz });
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "engines-compare": {
      title: "Engine comparison checkpoint",
      sub: "Flink, Spark Structured Streaming, Kafka Streams and streaming databases.",
      questions: [
        { q: "A team already runs Spark batch jobs on a lakehouse and needs minute-level freshness for CDC merges. What is the most pragmatic engine?", options: ["Spark Structured Streaming, reusing the same code, tables and operations", "Rewrite everything in Kafka Streams", "A custom consumer in every service", "Flink is mandatory for CDC"], answer: 0, explain: "Minute-level latency fits micro-batches, and reusing the team's engine, tables and skills beats adopting a new runtime for a requirement it already meets." },
        { q: "What is distinctive about Kafka Streams compared with Flink or Spark?", options: ["It needs its own cluster", "It is a library inside your application; scaling means running more instances, and state is backed by Kafka changelog topics", "It only supports batch", "It cannot do stateful processing"], answer: 1, explain: "Kafka Streams has no separate cluster: it is embedded in a JVM application, coordinates through consumer groups, and restores state from changelog topics." },
        { q: "Which requirement most strongly favours Flink?", options: ["Hourly batch reports", "Simple stateless routing between two topics", "Large keyed state, event-time timers, low per-event latency and complex event-time semantics at high throughput", "SQL dashboards over a warehouse"], answer: 2, explain: "Flink's strengths are large, checkpointed keyed state, rich event-time handling and record-at-a-time latency. Simpler needs rarely justify operating it." },
        { q: "What is the core latency trade-off of micro-batching?", options: ["It cannot handle state", "It loses data", "It requires exactly-once", "Each batch adds scheduling overhead, so latency has a floor of roughly the trigger interval, in exchange for throughput and simpler fault tolerance"], answer: 3, explain: "Micro-batches amortise overhead over many records and recover by re-running a batch. The cost is a latency floor set by the batch cadence." },
        { q: "When does a streaming database or incrementally maintained view fit best?", options: ["When consumers want to query continuously fresh SQL results without operating a separate processing job", "When you need custom per-record timers", "When there is no SQL", "When data arrives daily"], answer: 0, explain: "Streaming databases maintain query results incrementally and serve them directly, trading the flexibility of a general processing framework for operational simplicity." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.engines = {
    id: "engines",
    name: "Engine Comparison",
    short: "ENG",
    tagline: "Pick the runtime, not the hype",
    color: "#c084fc",
    blurb: "How the major stream processors differ and when each wins: Flink's record-at-a-time model, Spark Structured Streaming's micro-batches, Kafka Streams as a library, streaming databases and managed services, and a decision method grounded in latency, state, team and existing platform.",
    modules: [
      {
        id: "compare",
        name: "Engines Side by Side",
        icon: "compass",
        lessons: [
          L("processing-models", "Record-at-a-time vs micro-batch", "Continuous operators minimise latency; micro-batches amortise overhead and simplify recovery.", 8, ["engines", "micro-batch", "latency"], [
            { t: "p", html: "Stream processors execute in one of two broad models. <strong>Record-at-a-time</strong> engines (Flink, Kafka Streams) keep long-running operators that process each record as it arrives, with periodic snapshots for recovery. <strong>Micro-batch</strong> engines (Spark Structured Streaming in its default mode) run a small batch job every trigger interval over the records that arrived since the last one." },
            { t: "table", headers: ["Aspect", "Record-at-a-time", "Micro-batch"], rows: [["Latency floor", "Milliseconds", "Roughly the trigger interval (sub-second to minutes)"], ["Throughput per core", "High", "High; overhead amortised over each batch"], ["Fault tolerance", "Distributed snapshots plus replay", "Re-run the failed batch from logged offsets"], ["Timers and per-record logic", "Natural", "Expressed per batch; coarser"], ["Batch and stream with one API", "Supported", "Native: same engine, same tables"]] },
            { t: "note", variant: "tip", html: "Most business requirements are seconds to minutes, not milliseconds. If a micro-batch engine is already in your platform, it often meets the need without a new runtime." },
            { t: "note", variant: "trap", html: "\"Real-time\" in a requirement rarely means a millisecond budget. Ask for the latency at which the decision stops being valuable before choosing a model around it." },
            { t: "note", variant: "key", html: "<strong>Record-at-a-time buys latency; micro-batch buys simplicity and reuse.</strong> Pick by the decision's latency budget, not by the word \"real-time\"." }
          ]),
          L("flink-vs-spark", "Flink vs Spark Structured Streaming", "Two cluster engines with checkpoints and SQL; they differ in latency model, state depth and ecosystem fit.", 9, ["flink", "spark", "comparison"], [
            { t: "p", html: "Both are distributed engines with SQL and DataFrame-style APIs, event-time windows and watermarks, checkpointed state and exactly-once with suitable sinks. The differences are in <strong>execution model</strong>, <strong>state and timer depth</strong>, and <strong>where they fit</strong> in your platform." },
            { t: "table", headers: ["Dimension", "Flink", "Spark Structured Streaming"], rows: [["Execution", "Continuous operators", "Micro-batches (plus lower-latency modes in some distributions)"], ["Low-level control", "Keyed process functions, event-time timers, side outputs", "Arbitrary stateful functions per group; less fine-grained timers"], ["State", "Heap, RocksDB or remote; incremental checkpoints; savepoints", "State store per partition (RocksDB option) in the checkpoint location"], ["Upgrades", "Savepoints with operator uids", "Restart from checkpoint; many query changes are incompatible"], ["Lakehouse fit", "Good connectors; separate runtime", "Native on Spark-based lakehouses; shared code with batch"], ["Typical sweet spot", "Low-latency, stateful, event-driven applications", "Streaming ETL into tables, minute-level freshness"]] },
            { t: "code", lang: "python", code: "# Spark Structured Streaming: Kafka to a Delta table with a watermark\n(spark.readStream.format(\"kafka\")\n   .option(\"subscribe\", \"orders\")\n   .load()\n   .selectExpr(\"CAST(value AS STRING) AS json\")\n   .select(from_json(\"json\", schema).alias(\"o\")).select(\"o.*\")\n   .withWatermark(\"event_time\", \"10 minutes\")\n   .groupBy(window(\"event_time\", \"1 minute\"), \"store_id\")\n   .agg(sum(\"amount\").alias(\"revenue\"))\n   .writeStream\n   .outputMode(\"append\")\n   .option(\"checkpointLocation\", \"/chk/revenue\")\n   .trigger(processingTime=\"30 seconds\")\n   .toTable(\"gold.revenue_per_minute\"))" },
            { t: "note", variant: "tip", html: "The Cascade atlas (data engineering) in this collection covers Structured Streaming on Delta in <em>Databricks &amp; Delta Lake \u203a Structured Streaming &amp; Ingestion</em>." },
            { t: "note", variant: "key", html: "<strong>Flink for deep, low-latency stateful logic; Spark for streaming ETL next to batch.</strong> The platform you already run is usually the tie-breaker." }
          ]),
          L("kafka-streams", "Kafka Streams and library-style processing", "Stream processing as a library in your service: no cluster, Kafka for coordination and state durability.", 8, ["kafka-streams", "comparison"], [
            { t: "p", html: "<strong>Kafka Streams</strong> is a Java library. Your application embeds it, and running more instances scales it, coordinated through a consumer group. State lives in local stores backed by compacted <strong>changelog topics</strong>; repartitioning happens through internal topics. There is no separate cluster to run \u2014 which is its main appeal and its main constraint." },
            { t: "compare", bad: { title: "Where it strains", items: ["Kafka in and Kafka out only", "Restores from changelogs can be slow for huge state", "Parallelism capped by input partitions", "JVM only"] }, good: { title: "Where it shines", items: ["Event-driven microservices owned by app teams", "Deploys like any service", "Exactly-once with one setting", "Interactive queries over local state"] } },
            { t: "code", lang: "java", code: "StreamsBuilder b = new StreamsBuilder();\nKTable<String, Long> perUser = b.stream(\"clicks\", Consumed.with(Serdes.String(), clickSerde))\n    .groupByKey()\n    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(1)))\n    .count(Materialized.as(\"clicks-per-minute\"))\n    .toStream((wk, v) -> wk.key())\n    .toTable();\n\nprops.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2);\nprops.put(StreamsConfig.NUM_STANDBY_REPLICAS_CONFIG, 1);   // warm copies for fast failover" },
            { t: "note", variant: "warn", html: "Every stateful step creates internal changelog and repartition topics. Size and secure them like any other topic, and include them in capacity planning." },
            { t: "note", variant: "key", html: "<strong>Kafka Streams is a library, not a cluster.</strong> Choose it for Kafka-to-Kafka service logic owned by application teams; choose a cluster engine for heavy state or many external systems." }
          ]),
          L("streaming-dbs-managed", "Streaming databases and managed services", "Incrementally maintained SQL views and managed engines trade flexibility for less to operate.", 7, ["streaming-sql", "managed", "comparison"], [
            { t: "p", html: "A growing class of systems lets you declare a SQL view over streams and keeps it up to date incrementally, then serves it to queries directly: <strong>streaming databases</strong> and <strong>incremental view maintenance</strong> features in warehouses and lakehouses. Alongside them, cloud providers run Flink, Spark and Kafka as <strong>managed services</strong>." },
            { t: "table", headers: ["Option", "You operate", "Good for", "Watch for"], rows: [["Self-managed engine", "Everything", "Full control, custom logic", "On-call, upgrades, state ops"], ["Managed Flink or Spark", "Jobs and configuration", "Same engines, less infrastructure", "Version lag, limited tuning"], ["Streaming database", "Views and sources", "Fresh SQL results served directly", "Less control of state and timers"], ["Warehouse incremental views", "Definitions only", "Minute-level freshness inside the warehouse", "Refresh lag and cost model"]] },
            { t: "note", variant: "tip", html: "For a dashboard that needs data a minute fresh, an incremental view in the warehouse you already run may beat any streaming job. The Glacier atlas (Snowflake) in this collection covers dynamic tables and streams for that pattern." },
            { t: "note", variant: "key", html: "<strong>Operate as little as the requirement allows.</strong> Declarative and managed options win when they meet the latency and logic needs; a self-run engine is for when they do not." }
          ]),
          L("choosing-engine", "Choosing an engine: a decision method", "Start from latency, state, sources and sinks, team and platform \u2014 then pick the least operational weight that fits.", 8, ["engines", "decision", "architecture"], [
            { t: "p", html: "Engine choice is an architecture decision with a multi-year tail: on-call, upgrades, skills and integration. Make it from requirements, in a fixed order, and say the trade-off you are accepting." },
            { t: "ol", items: ["<strong>Latency budget:</strong> milliseconds, seconds, or minutes?", "<strong>State:</strong> size, lifetime, and whether you need timers or complex event patterns.", "<strong>Sources and sinks:</strong> Kafka only, or databases, lakes and APIs too?", "<strong>Correctness:</strong> exactly-once effect required, and on which hops?", "<strong>Team and platform:</strong> what you already operate and who will be on call.", "<strong>Pick the lightest option that meets all of the above.</strong>"] },
            { t: "table", headers: ["Scenario", "Reasonable choice", "Why"], rows: [["Enrich and route events between topics in a service", "Kafka Streams", "Library, Kafka-only, team-owned"], ["Fraud scoring with per-card velocity and timers, sub-second", "Flink", "Keyed state, event-time timers, low latency"], ["CDC into lakehouse tables every minute", "Spark Structured Streaming", "Native tables, shared batch code"], ["Fresh SQL aggregates for a dashboard", "Warehouse incremental views or a streaming database", "Least to operate"]] },
            { t: "cue", html: "<strong>Answer shape that scores:</strong> \"The requirement is two-second latency with per-card state and timers, so I'd use Flink; if it were minute-level CDC into tables, Structured Streaming on the existing lakehouse would be cheaper to run.\"" },
            { t: "note", variant: "key", html: "<strong>Requirements first, lightest fit second, trade-off said out loud.</strong> The best engine is the one that meets the latency and state needs with the least new operational weight." }
          ], "engines-compare")
        ]
      }
    ]
  };
})();
