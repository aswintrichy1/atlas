/* =====================================================================
   PULSE · Observability, Capacity & Security
   window.TRACKS.ops — modules: observe / resilience / security
   Widget used: pl-lag (js/widgets.js)
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks, quiz) {
    if (quiz) blocks.splice(blocks.length - 1, 0, { t: "quiz", id: quiz });
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "ops-observe": {
      title: "Streaming observability checkpoint",
      sub: "Golden signals, lag SLOs and engine metrics.",
      questions: [
        { q: "Why is consumer lag in time more useful than lag in messages for an SLO?", options: ["It is easier to compute", "Message lag cannot be measured", "Kafka only reports time", "Message counts mean different things at different traffic levels; seconds of delay map directly to freshness users feel"], answer: 3, explain: "Ten thousand messages is trivial at peak and an hour of backlog at night. Expressing lag as the age of the oldest unprocessed record ties the alert to freshness." },
        { q: "Which cluster metric should page immediately?", options: ["Offline partitions greater than zero", "CPU at 40%", "A new topic created", "One consumer group rebalanced once"], answer: 0, explain: "An offline partition has no leader: producers and consumers for it are down. Under-replicated partitions are a warning; offline partitions are an outage." },
        { q: "A Flink job's last successful checkpoint is 40 minutes old while the interval is one minute. What does that mean?", options: ["Everything is fine", "The job is idle", "Checkpoints are failing or timing out; a restart now would replay 40 minutes and recovery is at risk", "The sink is faster"], answer: 2, explain: "Checkpoint age is a recovery-point metric. A stale checkpoint means much longer replay on failure, and often a backpressure or state problem underneath." },
        { q: "What does rising lag with flat input traffic and steady consumer count most likely indicate?", options: ["More producers", "Topic compaction", "A new partition", "Per-record processing got slower \u2014 a slow dependency, hot key, GC or state growth"], answer: 3, explain: "If input is constant and capacity dropped, look at processing cost: downstream latency, skew, state access or resource pressure." },
        { q: "What does an end-to-end freshness probe measure that broker metrics do not?", options: ["Disk usage", "The real time from a marker event entering at the source until it is visible in the final sink", "Partition count", "Producer batch size"], answer: 1, explain: "Synthetic marker records traced to the sink catch every stage, including ones without good metrics, and measure what consumers experience." }
      ]
    },
    "ops-resilience": {
      title: "Failure & capacity checkpoint",
      sub: "Failure drills, recovery and capacity planning.",
      questions: [
        { q: "Which failure drill best validates exactly-once claims?", options: ["Restarting the laptop", "Killing a task manager during a checkpoint and reconciling sink output counts against input", "Increasing partitions", "Rotating logs"], answer: 1, explain: "Failing mid-checkpoint forces restore and replay at the hardest moment. Reconciliation then proves no loss and no duplicates." },
        { q: "After an outage, a consumer group has a two-hour backlog. Consumers process 3\u00d7 the normal input rate. Roughly how long to catch up?", options: ["One hour", "Two hours", "Six hours", "It never catches up"], answer: 0, explain: "Net drain rate is 3\u00d7 \u2212 1\u00d7 = 2\u00d7 the input rate, so two hours of backlog drains in about one hour while new data keeps arriving." },
        { q: "Why plan capacity for catch-up, not just for steady state?", options: ["Steady state is never reached", "It is cheaper", "Kafka requires it", "After any outage or deploy, the system must process new input plus backlog; without headroom, lag never recovers"], answer: 3, explain: "A system sized exactly for steady state can never drain a backlog. Catch-up headroom is what makes incidents end." },
        { q: "What does Little's law tell you about a streaming stage?", options: ["Records in flight = arrival rate \u00d7 time each spends in the stage", "Throughput equals latency", "Partitions equal consumers", "Lag is always zero"], answer: 0, explain: "L = \u03bbW. If 50k records/s each spend 2 s in a stage, about 100k are in flight; growth in W shows up directly as more buffered data." },
        { q: "What should a failure-injection runbook always include?", options: ["Only the command to run", "A press release", "The hypothesis, steady-state metrics, the injection, abort criteria and the reconciliation check", "A list of all topics"], answer: 2, explain: "Drills are experiments: define normal, state the expected behaviour, inject, stop if impact exceeds the limit, and verify data correctness afterwards." }
      ]
    },
    "ops-security": {
      title: "Security & multi-tenancy checkpoint",
      sub: "Encryption, authentication, ACLs, quotas and secrets.",
      questions: [
        { q: "What is the right baseline for a production Kafka cluster?", options: ["Plaintext inside the VPC", "TLS for every connection, authenticated clients (mTLS, SCRAM or OAuth), ACLs with least privilege, and no anonymous access", "Only a firewall", "A shared admin user for all apps"], answer: 1, explain: "Network location is not identity. Encrypt in transit, authenticate every client, and authorise each to only the topics and groups it needs." },
        { q: "Where should a streaming job's Kafka credentials come from?", options: ["A secret manager or mounted secret, injected at runtime, with rotation", "Hardcoded in the job JAR", "A comment in the repository", "The topic name"], answer: 0, explain: "Credentials in source code are compromised the moment the repository is shared. Inject them at runtime from a secret store so they can be rotated without a rebuild." },
        { q: "What do client quotas protect against?", options: ["Schema errors", "Data loss", "One tenant's producer or consumer consuming so much bandwidth or request capacity that others suffer", "Compaction"], answer: 2, explain: "Quotas cap bytes per second and request time per client or user, so a misbehaving batch job cannot starve everyone else on a shared cluster." },
        { q: "A topic carries personal data. Which control is specific to streaming?", options: ["Nothing differs from a database", "Making the topic public", "Disabling replication", "Retention and compaction choices decide how long the data persists, and every derived topic and state store inherits the obligation"], answer: 3, explain: "Personal data copies itself into derived topics, changelogs, checkpoints and DLQs. Retention, field-level protection and deletion handling must cover all of them." },
        { q: "Why use prefixed ACLs and naming conventions for multi-tenant clusters?", options: ["They make topics faster", "One rule per team prefix grants exactly that team's topics and groups, keeping permissions manageable and least-privilege", "They are required for compaction", "They remove the need for authentication"], answer: 1, explain: "Prefix-based grants such as team-payments.* scale with team count rather than topic count and reduce accidental cross-team access." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ops = {
    id: "ops",
    name: "Observability, Capacity & Security",
    short: "OPS",
    tagline: "Keep it running, prove it is right",
    color: "#4ade80",
    blurb: "Running streaming systems: the golden signals for brokers, consumers and jobs, lag as a freshness SLO, Flink checkpoint and backpressure metrics, failure-injection drills with reconciliation, capacity for steady state and catch-up, and security from TLS and authentication to ACLs, quotas, secrets and personal data.",
    modules: [
      {
        id: "observe",
        name: "Observability",
        icon: "trend",
        lessons: [
          L("golden-signals", "Golden signals for streaming systems", "Brokers, consumers and jobs each have a handful of metrics that matter; alert on symptoms, dashboard the rest.", 9, ["observability", "metrics", "alerting"], [
            { t: "p", html: "Streaming systems emit thousands of metrics. A small set tells you almost everything, grouped by layer. Page on the ones that mean users are affected now; put the rest on dashboards for diagnosis." },
            { t: "table", headers: ["Layer", "Metric", "Page or dashboard"], rows: [["Cluster", "Offline partitions", "Page (any > 0)"], ["Cluster", "Under-replicated partitions / under-min-ISR", "Page if sustained"], ["Cluster", "Produce and fetch request latency p99", "Dashboard; page on SLO breach"], ["Consumers", "Lag in seconds (age of oldest unprocessed record)", "Page against freshness SLO"], ["Jobs", "Age of last completed checkpoint", "Page beyond a few intervals"], ["Jobs", "Restarts per hour", "Page on crash loops"], ["Jobs", "Backpressure and busy time per operator", "Dashboard"], ["Pipeline", "End-to-end freshness probe", "Page against SLO"]] },
            { t: "p", html: "The most valuable single signal is an <strong>end-to-end freshness probe</strong>: a synthetic marker record injected at the source every minute and detected at the final sink. It measures exactly what consumers feel and catches failures in stages that have no metrics of their own." },
            { t: "note", variant: "trap", html: "\"Job is RUNNING\" is not health. A job can be running with every checkpoint failing, every record going to a dead-letter queue, or a watermark stuck for hours. Alert on progress, not status." },
            { t: "note", variant: "key", html: "<strong>Page on offline partitions, lag in seconds, checkpoint age and freshness.</strong> Everything else is for diagnosis, and \"running\" never means healthy." }
          ]),
          L("lag-slos", "Lag as a freshness SLO", "Express lag as time, set an SLO on it, and size consumers so spikes drain within the budget.", 9, ["lag", "slo", "consumers"], [
            { t: "p", html: "Consumer lag is the difference between the latest offset in a partition and the group's committed or current position. In <strong>messages</strong> it is easy to read and hard to interpret; in <strong>seconds</strong> \u2014 the age of the oldest record not yet processed \u2014 it maps directly to how stale downstream data is. Write the SLO in seconds." },
            { t: "widget", id: "pl-lag" },
            { t: "code", lang: "text", code: "SLO: 99% of minutes in a 30-day window, consumer lag < 60 s for group fraud-scorer\n\nlag_seconds(p) = now - timestamp(first unprocessed record in p)\ngroup lag      = max over partitions (the slowest partition sets freshness)\n\nalert: lag > 60 s for 5 min AND growing   -> page\n       lag > 30 s for 15 min             -> ticket" },
            { t: "ul", items: ["Use the <strong>maximum</strong> across partitions: one stuck partition is stale data for its keys.", "Alert on <strong>growth</strong> as well as level, so a draining backlog after a deploy does not page.", "Scale on sustained lag with a cooldown, never on a single spike, or autoscaling causes rebalances that cause more lag.", "Remember the ceiling: consumers beyond the partition count add nothing."] },
            { t: "note", variant: "warn", html: "Lag measured from committed offsets jumps in steps because commits are periodic. For tight SLOs, prefer the consumer's own fetch position or the engine's reported watermark or record-age metric." },
            { t: "note", variant: "key", html: "<strong>Lag is freshness; measure it in seconds at the slowest partition.</strong> The SLO plus catch-up headroom decides how many consumers and partitions you need." }
          ]),
          L("flink-metrics", "Reading a Flink job's health", "Checkpoints, watermarks, backpressure and restarts tell you whether a job is progressing and recoverable.", 8, ["flink", "observability", "checkpoints"], [
            { t: "p", html: "A Flink job can be healthy, slow, stuck or silently broken. Four families of metrics distinguish them, and all of them are about <strong>progress</strong>." },
            { t: "table", headers: ["Signal", "Healthy", "Trouble looks like"], rows: [["Checkpoint duration and size", "Stable, well under the interval", "Climbing duration = backpressure or state growth"], ["Last checkpoint age", "\u2248 interval", "Many intervals = failing checkpoints"], ["Watermark lag (now \u2212 watermark)", "Stable, near expected skew", "Growing = stuck source, idle partition, or lag"], ["Backpressure / busy per operator", "Low or localised", "Saturated sink or skewed subtask"], ["Restarts", "Near zero", "Crash loop masking an error"], ["Records out of the late side output", "Small and stable", "Spike = upstream clock or delay problem"]] },
            { t: "note", variant: "tip", html: "Graph checkpoint size next to state TTL settings and key cardinality. State that grows while traffic is flat is a missing TTL, and it shows up first as checkpoint duration." },
            { t: "note", variant: "trap", html: "A watermark that stops moving makes event-time windows stop firing while every throughput metric looks normal. Always chart watermark lag per source." },
            { t: "note", variant: "key", html: "<strong>Healthy Flink jobs checkpoint on time, advance their watermark and stay out of restart loops.</strong> Throughput alone says nothing about correctness or recoverability." }
          ], "ops-observe")
        ]
      },
      {
        id: "resilience",
        name: "Failure & Capacity",
        icon: "wrench",
        lessons: [
          L("failure-drills", "Failure injection and recovery drills", "Kill brokers, task managers and sinks on purpose, then reconcile \u2014 recovery you have not tested is a hope.", 9, ["chaos", "recovery", "testing"], [
            { t: "p", html: "Streaming systems are built to survive failure, but the guarantees only hold if configuration, timeouts and sinks are all right. <strong>Failure drills</strong> turn assumptions into evidence: inject a specific fault, watch the system recover, and verify that the data is still correct." },
            { t: "table", headers: ["Fault", "Expected behaviour", "Verify"], rows: [["Kill one broker", "Leaders move; producers retry; no data loss with RF 3 / min ISR 2", "No acked writes missing; latency spike bounded"], ["Kill a TaskManager mid-checkpoint", "Restore last completed checkpoint; replay", "Sink counts match input; no duplicates with 2PC or upserts"], ["Make the sink slow", "Backpressure to the source; lag grows; nothing lost", "Lag drains after recovery within SLO"], ["Network partition between zones", "ISR shrinks; writes continue if min ISR met", "No unclean election; consumers resume"], ["Poison record", "Routed to dead-letter topic; pipeline continues", "DLQ alert fires; record recoverable"]] },
            { t: "ol", items: ["State the hypothesis and the steady-state metrics.", "Set abort criteria (for example, lag above SLO for ten minutes).", "Inject one fault in staging, then in production during business hours with owners present.", "Observe recovery time and data correctness.", "Reconcile: compare counts or checksums of input and output by window.", "Record findings and fix what surprised you."] },
            { t: "note", variant: "warn", html: "A drill without reconciliation only proves the job restarted. Data correctness is the point: count input and output per key range or window and compare." },
            { t: "note", variant: "tip", html: "The Beacon atlas (observability and SRE) in this collection covers chaos engineering practice in general; this lesson is the streaming-specific checklist." },
            { t: "note", variant: "key", html: "<strong>Inject, observe, reconcile.</strong> Recovery claims are only true once a drill has killed the component and the output still adds up." }
          ]),
          L("capacity-planning", "Capacity planning: steady state, peaks and catch-up", "Size for peak plus headroom to drain backlog, using measured per-unit throughput and Little's law.", 9, ["capacity", "planning", "throughput"], [
            { t: "p", html: "Capacity for streaming has three levels: <strong>steady state</strong> (keep up with average input), <strong>peak</strong> (keep up with the busiest hour), and <strong>catch-up</strong> (drain a backlog while input continues). The third is the one teams forget, and it is the one that decides how long every incident lasts." },
            { t: "code", lang: "text", code: "peak input            = 60k events/s\nper-consumer measured = 8k events/s at target latency\nsteady/peak consumers = ceil(60 / 8) = 8\n\ncatch-up target: drain 30 min of backlog within 30 min at peak\nrequired rate = 60k + (60k * 1800 s) / 1800 s = 120k events/s\nconsumers     = ceil(120 / 8) = 15  -> partitions >= 15 (choose 24)\n\nLittle's law check: 120k/s * 0.5 s in-stage = 60k records in flight" },
            { t: "table", headers: ["Headroom for", "Rule of thumb", "Why"], rows: [["Peaks", "Size to measured p99 hour, not average", "Averages hide the busiest minutes"], ["Catch-up", "1.5\u20132\u00d7 peak for consumers", "Outages and deploys always leave backlog"], ["Broker failure", "Survivors absorb a failed broker's load", "Leadership and replication move"], ["Growth", "Six to twelve months ahead", "Partition changes are disruptive on keyed topics"]] },
            { t: "note", variant: "trap", html: "Catch-up is capped by partitions. Planning \"we'll scale consumers during incidents\" fails if the topic has fewer partitions than the consumers you would need." },
            { t: "note", variant: "key", html: "<strong>Plan for catch-up, not just steady state.</strong> Measured per-unit throughput, peak input and a drain target give consumers and partitions; Little's law sanity-checks buffers." }
          ], "ops-resilience")
        ]
      },
      {
        id: "security",
        name: "Security & Multi-Tenancy",
        icon: "shield",
        lessons: [
          L("security-kafka", "Securing Kafka and stream jobs", "Encrypt every connection, authenticate every client, authorise least privilege, and keep secrets out of code.", 9, ["security", "tls", "acls", "secrets"], [
            { t: "p", html: "A streaming platform carries some of the most sensitive data in a company, often in more copies than any database. The baseline is the same as for any service, applied to every connection: brokers, controllers, Connect workers, schema registry, and every job." },
            { t: "table", headers: ["Control", "Kafka mechanism", "Notes"], rows: [["Encryption in transit", "TLS listeners for clients and inter-broker traffic", "Disables zero-copy sends; budget CPU"], ["Authentication", "mTLS, SASL/SCRAM, SASL/OAUTHBEARER, Kerberos", "One identity per application, not per team"], ["Authorisation", "ACLs (or role-based in some distributions) on topics, groups, transactional ids", "Prefixed grants per team or domain"], ["Encryption at rest", "Disk or volume encryption; object storage encryption for tiered data", "Covers checkpoints and DLQs too"], ["Audit", "Authorisation logs", "Who read or wrote which topic"]] },
            { t: "code", lang: "text", code: "# client.properties  (values injected at deploy time, never committed)\nsecurity.protocol=SASL_SSL\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=${file:/var/run/secrets/kafka/jaas.conf:client}\nssl.truststore.location=/var/run/secrets/kafka/truststore.p12\nssl.endpoint.identification.algorithm=https" },
            { t: "note", variant: "warn", html: "Never hardcode credentials in job code, connector JSON or DDL. Reference a secret manager or mounted secret (as above with a config provider), scope each identity to one application, and rotate on a schedule. A leaked shared admin credential is a cluster-wide breach." },
            { t: "note", variant: "tip", html: "Use TLS 1.3 where clients support it, and verify broker hostnames. Treat certificates as expiring inventory: monitor expiry dates and automate renewal." },
            { t: "note", variant: "key", html: "<strong>TLS everywhere, one identity per app, least-privilege ACLs, secrets injected at runtime.</strong> The same rules cover jobs, connectors, registries and their checkpoints." }
          ]),
          L("multi-tenancy-quotas", "Multi-tenancy, quotas and personal data", "Shared clusters need quotas, naming and prefixed ACLs; personal data needs retention and deletion across every copy.", 8, ["multi-tenancy", "quotas", "privacy"], [
            { t: "p", html: "Most organisations run a few shared clusters rather than one per team. That works only with guardrails: <strong>naming conventions</strong> that encode ownership, <strong>prefixed ACLs</strong> per team, and <strong>quotas</strong> that cap each client's bandwidth and request time so one runaway job cannot starve the rest." },
            { t: "table", headers: ["Guardrail", "Mechanism", "Prevents"], rows: [["Produce / fetch byte quotas", "Per user or client id", "A backfill saturating broker network"], ["Request-time quotas", "Share of broker threads", "Chatty clients starving others"], ["Partition and topic limits", "Policy in the provisioning pipeline", "Metadata explosions"], ["Prefixed ACLs", "team-x.* for topics and groups", "Cross-team reads and writes"]] },
            { t: "p", html: "Personal data in streams spreads into derived topics, Kafka Streams changelogs, Flink checkpoints, dead-letter queues and lake tables. Classify topics, keep personal fields out of keys where possible, prefer short retention for raw personal data, and make sure deletion requests reach the derived stores \u2014 tombstones on compacted topics, and deletes in downstream tables." },
            { t: "note", variant: "trap", html: "Encrypting or tokenising a field after it has been written to a long-retention topic does not remove the plaintext copies already there. Protect sensitive fields at the producer." },
            { t: "note", variant: "key", html: "<strong>Shared clusters run on quotas, prefixes and owners.</strong> Personal data obligations follow every copy a stream creates, so design retention and deletion for all of them." }
          ], "ops-security")
        ]
      }
    ]
  };
})();
