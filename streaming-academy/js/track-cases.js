/* =====================================================================
   PULSE · Production Case Studies
   window.TRACKS.cases — modules: design / production
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks, quiz) {
    if (quiz) blocks.splice(blocks.length - 1, 0, { t: "quiz", id: quiz });
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "cases-design": {
      title: "Design cases checkpoint",
      sub: "Clickstream sessions, fraud scoring and IoT telemetry.",
      questions: [
        { q: "For clickstream sessionisation, what should the Kafka key be?", options: ["The URL", "A random id for even spread", "The user or anonymous visitor id, so each visitor's events stay ordered in one partition and one session state", "The event type"], answer: 2, explain: "Sessions are per visitor. Keying by visitor keeps their events ordered and in one keyed state, which session windows require." },
        { q: "A fraud check must decide before authorisation completes (about 100 ms). What is the most important design choice?", options: ["Keep per-card features in local keyed state so scoring needs no remote calls on the hot path", "Use hourly batch features", "Commit offsets before scoring", "Use processing-time windows only"], answer: 0, explain: "A tight latency budget cannot absorb remote lookups per event. Features maintained in keyed state (velocity, amounts, devices) make scoring a local read." },
        { q: "IoT devices upload hours of buffered readings after reconnecting. What protects event-time windows?", options: ["Raising the global watermark delay to hours", "Dropping all late data", "Using processing time", "Per-device or per-partition watermarks with idleness handling, plus a late-data path that updates or reconciles affected windows"], answer: 3, explain: "One reconnecting device should not hold back everyone. Per-source watermarks, idleness and an explicit late-data policy keep most results fast while still incorporating buffered data." },
        { q: "Why do sessionised clickstream pipelines usually write to an upsert sink?", options: ["Upserts are always faster", "Append sinks cannot store strings", "Kafka requires it", "Late events can merge or extend sessions after they were first emitted, so results must be revisable by session key"], answer: 3, explain: "Session windows merge when a late event bridges two sessions, retracting earlier results. An upsert keyed by session absorbs those corrections." },
        { q: "In a fraud pipeline, what is the safest way to handle the decision output?", options: ["Call the card network directly from a map function", "Write decisions to a topic with the authorisation id as key, consumed by an idempotent decision service", "Print decisions to logs", "Store them only in Flink state"], answer: 1, explain: "Keeping the external effect out of the operator, keyed by authorisation id, makes replays harmless and the decision auditable." }
      ]
    },
    "cases-production": {
      title: "Production cases checkpoint",
      sub: "CDC to lakehouse, real-time features and an incident review.",
      questions: [
        { q: "In the rebalance-storm incident, what was the root cause?", options: ["A broker failure", "A slow downstream call made batches exceed max.poll.interval.ms, so consumers were evicted and rejoined repeatedly", "Too many partitions", "Schema incompatibility"], answer: 1, explain: "Consumers that stop polling for too long are considered stuck and removed, triggering a rebalance; with eager assignment every rebalance paused the whole group, so lag snowballed." },
        { q: "Which fix most directly prevents a repeat of the rebalance storm?", options: ["Add brokers", "Increase retention", "Bound per-poll work (max.poll.records), make the slow call async or time-limited, and use cooperative assignment with static membership", "Disable auto-commit only"], answer: 2, explain: "Bounding work per poll keeps consumers inside the poll interval, async calls remove the stall, and cooperative plus static membership shrink any remaining rebalance." },
        { q: "Why must real-time ML features be computed the same way for training and serving?", options: ["To save storage", "It is a regulation", "To use fewer partitions", "Otherwise training-serving skew makes the model see differently computed features in production than it learned from"], answer: 3, explain: "If the online pipeline computes a 'transactions in the last hour' feature differently from the offline backfill, model quality silently drops. Point-in-time-correct, shared definitions prevent it." },
        { q: "The CDC-to-lakehouse merge occasionally moves a row back to an older value. What is the fix?", options: ["Merge more often", "Order and guard merges by log position, updating only when the incoming position is newer than the stored one", "Use processing time", "Disable deletes"], answer: 1, explain: "Replays or out-of-order micro-batches can carry older changes. A guard on LSN or binlog position makes the merge monotonic and idempotent." },
        { q: "What makes a streaming postmortem useful?", options: ["Naming who made the mistake", "A timeline, the contributing factors including why detection was slow, and owned actions with dates", "Only the final fix", "Screenshots of dashboards"], answer: 1, explain: "Blameless reviews focus on system conditions: what happened, why it was possible, why it was not caught sooner, and specific, owned follow-ups." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.cases = {
    id: "cases",
    name: "Production Case Studies",
    short: "CASE",
    tagline: "Whole systems, end to end",
    color: "#f87171",
    blurb: "Six end-to-end designs and incidents that combine every earlier track: clickstream sessionisation, sub-second fraud scoring, IoT telemetry with late uploads, CDC into a lakehouse, real-time ML features without training-serving skew, and a rebalance-storm postmortem.",
    modules: [
      {
        id: "design",
        name: "Design Walkthroughs",
        icon: "map",
        lessons: [
          L("clickstream-sessions", "Clickstream sessionisation and live metrics", "Collect, key by visitor, sessionise on event time, and serve revisable session results.", 10, ["case-study", "clickstream", "sessions"], [
            { t: "p", html: "<strong>Problem.</strong> A retail site emits about 50k click events per second at peak. Product wants live conversion funnels per campaign and per-visit metrics (pages, duration, purchase) within a minute, plus a daily authoritative report." },
            { t: "table", headers: ["Stage", "Choice", "Reason"], rows: [["Collection", "Edge collector writes to a clicks topic, key = visitor id", "Per-visitor order; durable buffer for bursts"], ["Validation", "Stateless parse, schema check, bot filter; bad records to a DLQ", "Drop junk before any shuffle"], ["Event time", "Client timestamp clamped to [server time \u2212 1 h, server time + 1 min]", "Device clocks lie"], ["Sessions", "Session windows, 30-min gap, 5-s watermark delay, 10-min allowed lateness", "Matches the business definition of a visit"], ["Funnels", "1-minute tumbling windows per campaign and step", "Append-only, cheap"], ["Sinks", "Sessions upserted by session id; funnels appended", "Late events revise sessions"], ["Authoritative", "Nightly batch recompute from the raw topic in the lake", "Final numbers after all lateness"]] },
            { t: "p", html: "Capacity: 50k events/s at roughly 1 KB is 50 MB/s; with RF 3 and two consumer groups that is several hundred MB/s of cluster traffic. Partitions: 48 (consumers measured at 2k events/s each need 25 at peak, doubled for catch-up). State: open sessions \u2248 concurrent visitors (say 400k) \u00d7 a few hundred bytes \u2014 comfortably in RocksDB." },
            { t: "note", variant: "warn", html: "Bots and crawlers create endless sessions and hot keys. Filter them before the session operator, and cap session length so a stuck visitor cannot hold state for ever." },
            { t: "cue", html: "<strong>Narrate the shape:</strong> collect, validate early, key by visitor, sessionise on event time, upsert revisable results, and recompute the authoritative answer in batch." },
            { t: "note", variant: "key", html: "<strong>Key by visitor, sessionise on event time, upsert results.</strong> The stream gives fresh, revisable metrics; the batch path gives final numbers." }
          ]),
          L("fraud-scoring", "Sub-second fraud scoring", "Features in keyed state, scoring without remote calls, decisions as keyed events consumed idempotently.", 10, ["case-study", "fraud", "low-latency"], [
            { t: "p", html: "<strong>Problem.</strong> Score every card authorisation before it completes, within about 100 ms end to end, using velocity features (count and amount in the last minute and hour), device and merchant history, and a model. Decisions must be auditable and never double-applied." },
            { t: "ol", items: ["Authorisations enter a topic keyed by card id (per-card order, one owner for its state).", "A Flink job keeps per-card keyed state: rolling counts and sums, last devices and merchants, with TTL matching the longest feature window.", "Scoring runs inside the operator against a model loaded as broadcast state \u2014 no remote call per event.", "Decisions are written to a decisions topic keyed by authorisation id with exactly-once or idempotent semantics.", "A decision service consumes them and applies each authorisation id once; late decisions default to the rule-based fallback."] },
            { t: "table", headers: ["Risk", "Mitigation"], rows: [["Latency spikes on checkpoint", "Incremental RocksDB checkpoints; unaligned checkpoints under backpressure"], ["Model update", "Broadcast new model version; record version in each decision"], ["Hot cards (testing attacks)", "Rate-limit per card upstream; alert on key skew"], ["Replay after failure", "Idempotent decision consumer keyed by authorisation id"], ["Feature skew vs training", "Same feature definitions offline and online (see real-time features)"]] },
            { t: "note", variant: "trap", html: "Two-phase commit sinks add about a checkpoint interval of latency, which breaks a 100 ms budget. Use an idempotent decision consumer with at-least-once output instead, and keep the transactional path for the audit topic." },
            { t: "note", variant: "key", html: "<strong>Local state, local scoring, keyed idempotent decisions.</strong> Sub-second budgets leave no room for remote lookups or commit-on-checkpoint latency." }
          ]),
          L("iot-telemetry", "IoT telemetry with late uploads", "Per-device watermarks, idleness and a late-data policy keep a fleet's windows fast despite offline devices.", 9, ["case-study", "iot", "late-data"], [
            { t: "p", html: "<strong>Problem.</strong> Two million sensors report every 10 seconds. Gateways buffer readings during connectivity loss and upload hours of data on reconnect. Operations wants per-site 1-minute aggregates within two minutes and alerts on threshold breaches; analytics wants complete hourly history." },
            { t: "table", headers: ["Decision", "Choice"], rows: [["Key", "Device id for raw readings; site id after a first aggregation"], ["Watermarks", "Per partition with a 30-s bound and 2-min idleness"], ["Late uploads", "Separate late topic for readings older than 10 minutes; batch reconciles hourly history"], ["Alerts", "Per-device keyed process function with event-time timers"], ["Storage", "Raw to the lake hourly; aggregates to a time-series store via upsert"]] },
            { t: "p", html: "Routing very late data to its own path is the key move. Without it, a gateway uploading three hours of backlog would either hold the fleet's watermark back by three hours or have all its data dropped. With it, live windows stay fast and history stays complete." },
            { t: "note", variant: "warn", html: "Alert logic on replayed backlog can fire hundreds of stale alerts at once. Suppress alerts whose event time is older than an operational threshold, and send them to a review queue instead." },
            { t: "note", variant: "key", html: "<strong>Separate live from very late.</strong> Bounded watermarks plus idleness keep live windows fast; a late path and batch reconciliation keep history complete." }
          ], "cases-design")
        ]
      },
      {
        id: "production",
        name: "Production Systems & Incidents",
        icon: "wrench",
        lessons: [
          L("cdc-lakehouse-case", "Operational database to lakehouse with CDC", "Snapshot, stream, land the changelog, MERGE by log position, and monitor slots as closely as lag.", 9, ["case-study", "cdc", "lakehouse"], [
            { t: "p", html: "<strong>Problem.</strong> Mirror 300 tables from a PostgreSQL primary into lakehouse tables with five-minute freshness, preserve history for audits, and survive schema changes without manual intervention for additive ones." },
            { t: "ol", items: ["CDC connector with an incremental snapshot per table and a dedicated replication slot and least-privilege user.", "One topic per table, keyed by primary key, Avro with a registry in BACKWARD_TRANSITIVE mode.", "Streaming job lands every event into a bronze changelog table (append-only, partitioned by date).", "Every five minutes, a MERGE per table applies the latest change per key, guarded by LSN, into a silver current-state table.", "Weekly compaction and clustering on silver tables."] },
            { t: "table", headers: ["Monitor", "Threshold", "Why"], rows: [["Replication slot retained WAL", "Alert at 20% of primary disk headroom", "Prevents a database outage"], ["Connector lag (source to topic)", "< 1 min", "Freshness budget"], ["Merge freshness per table", "< 5 min", "The SLO consumers see"], ["DLQ rate", "Any sustained rate", "Conversion or schema problems"], ["Row-count reconciliation", "Daily, source vs silver", "Catches silent drift"]] },
            { t: "note", variant: "trap", html: "Tables without primary keys cannot be merged reliably. Find them before go-live and either add keys at the source or replicate them as full periodic snapshots instead." },
            { t: "note", variant: "key", html: "<strong>Snapshot, stream, keep the changelog, merge by LSN, watch the slot.</strong> Daily reconciliation is what proves the mirror is still a mirror." }
          ]),
          L("ml-features", "Real-time ML features without skew", "Compute features once with point-in-time semantics, serve them online, and backfill them offline the same way.", 9, ["case-study", "ml", "features"], [
            { t: "p", html: "<strong>Problem.</strong> A recommendation model needs features like \"items viewed in the last 30 minutes\" and \"purchases in the last 7 days\" fresh at serving time, and the same features as of each historical moment for training." },
            { t: "table", headers: ["Requirement", "Approach"], rows: [["Freshness", "Streaming job updates features per user in keyed state and writes to an online store (upsert)"], ["Training data", "The same definitions computed over historical events with point-in-time joins"], ["No leakage", "Training rows only see feature values as of the label's event time"], ["Consistency", "One feature definition used by both paths, versioned"], ["Monitoring", "Compare online feature distributions with offline ones daily"]] },
            { t: "p", html: "Training-serving skew is the silent failure: the online pipeline counts views by processing time while the offline backfill counts by event time, or one deduplicates and the other does not. The model scores fine in evaluation and worse in production, with no error anywhere." },
            { t: "note", variant: "tip", html: "Log the exact feature values used at serving time with each prediction. Training on logged features removes a whole class of skew and gives you a ground truth to compare backfills against." },
            { t: "note", variant: "key", html: "<strong>One definition, two executions, point-in-time correct.</strong> Shared feature logic and logged serving features are what keep online and offline in agreement." }
          ]),
          L("rebalance-storm", "Postmortem: the rebalance storm", "A slow dependency pushed consumers past their poll interval; eager rebalances turned it into a group-wide outage.", 10, ["case-study", "incident", "rebalance", "postmortem"], [
            { t: "p", html: "<strong>Summary.</strong> For 47 minutes, an order-enrichment consumer group processed almost nothing while every pod reported healthy. Lag rose to 38 minutes. No data was lost; downstream order emails were delayed." },
            { t: "table", headers: ["Time", "Event"], rows: [["10:02", "A downstream pricing API's p99 rises from 40 ms to 4 s after its own deploy"], ["10:05", "Batches of 500 records now take over 5 minutes; consumers exceed max.poll.interval.ms (5 min) and are evicted"], ["10:06", "Eager rebalance: all 12 consumers revoke all partitions; the group pauses"], ["10:07\u201310:45", "Consumers rejoin, fetch 500 records, stall on the API, are evicted again: a loop of rebalances"], ["10:31", "Lag alert pages (threshold 15 min, too late)"], ["10:45", "Pricing deploy rolled back; latency recovers"], ["10:49", "Group stable; lag drains by 11:20"]] },
            { t: "ul", items: ["<strong>Contributing factor:</strong> synchronous per-record call to a dependency with no timeout or circuit breaker.", "<strong>Contributing factor:</strong> 500 records per poll with no bound on per-poll time.", "<strong>Contributing factor:</strong> eager assignment paused the whole group on every eviction.", "<strong>Detection gap:</strong> lag alert in messages with a high threshold; no alert on rebalance rate."] },
            { t: "table", headers: ["Action", "Owner", "Effect"], rows: [["Timeouts and a circuit breaker on the pricing call, with cached fallback", "Order team", "Stall becomes degraded mode"], ["max.poll.records 500 \u2192 100; async calls with bounded concurrency", "Order team", "Per-poll time bounded"], ["Cooperative sticky assignor and static membership", "Platform", "Evictions move few partitions"], ["Alert on rebalances per hour and lag in seconds", "Platform", "Detection in minutes"]] },
            { t: "note", variant: "trap", html: "Raising <code class='tok'>max.poll.interval.ms</code> to an hour would have hidden this and delayed detection of genuinely stuck consumers. Fix the work per poll, not just the limit." },
            { t: "note", variant: "key", html: "<strong>Healthy pods, zero progress: suspect rebalances.</strong> Bound work per poll, protect dependencies with timeouts, use cooperative assignment, and alert on rebalance rate and lag in seconds." }
          ], "cases-production")
        ]
      }
    ]
  };
})();
