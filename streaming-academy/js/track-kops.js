/* =====================================================================
   PULSE · Kafka Operations
   window.TRACKS.kops — modules: sizing / lifecycle
   Widget used: pl-capacity (js/widgets.js)
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks, quiz) {
    if (quiz) blocks.splice(blocks.length - 1, 0, { t: "quiz", id: quiz });
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "kops-sizing": {
      title: "Sizing & balancing checkpoint",
      sub: "Partition counts, broker capacity and reassignment.",
      questions: [
        { q: "A topic must sustain 200 MB/s and one consumer instance handles 8 MB/s. Measured producer throughput per partition is 20 MB/s. What is the minimum partition count?", options: ["10", "20", "25", "8"], answer: 2, explain: "Producers need 200/20 = 10 partitions, but consumers need 200/8 = 25 instances, and each needs its own partition. The larger number wins, before headroom." },
        { q: "Why is broker network often the binding constraint rather than disk?", options: ["Every produced byte is also sent to each follower and to every consumer group, so egress multiplies ingress", "Disks are always faster than networks", "Kafka compresses disk writes but not network traffic", "Followers write to object storage"], answer: 0, explain: "With RF 3 and two consumer groups, each byte produced crosses the network roughly five times. Network capacity per broker usually runs out before disk throughput does." },
        { q: "What is the main risk of a large partition reassignment without throttling?", options: ["Data loss", "Topics become compacted", "Replication traffic saturates brokers and starves production traffic, raising latency and lag", "Consumers lose their offsets"], answer: 2, explain: "Moving replicas copies whole partitions between brokers. Unthrottled, that copy competes with live traffic. Set a replication throttle and move in batches." },
        { q: "A cluster's leaders are concentrated on two of six brokers after a restart. What should you do?", options: ["Add partitions", "Disable replication", "Increase retention", "Trigger preferred leader election so leadership returns to each partition's preferred replica"], answer: 3, explain: "After failover, leadership can stay on the survivors. Preferred leader election (often automatic) moves leadership back so load spreads again." },
        { q: "Why is \u201cjust add more partitions later\u201d risky for keyed topics?", options: ["Kafka cannot add partitions", "Adding partitions deletes data", "It disables compaction", "The key-to-partition mapping changes, so a key's new events land in a different partition from its old ones and per-key order breaks during the transition"], answer: 3, explain: "Partition is hash(key) mod count. Changing the count moves keys, so consumers can process a key's new events before old ones in another partition." }
      ]
    },
    "kops-lifecycle": {
      title: "Lifecycle & schema checkpoint",
      sub: "Upgrades, schemas, topic hygiene and disaster recovery.",
      questions: [
        { q: "Which schema change is backward compatible in Avro with a registry set to BACKWARD?", options: ["Removing a field with no default", "Changing a field from string to int", "Renaming a required field", "Adding a new field with a default value"], answer: 3, explain: "BACKWARD means new readers can read old data. A new field with a default can be filled in when reading old records; the other changes break old data for new readers." },
        { q: "What is the safe order for a rolling broker upgrade?", options: ["Upgrade one broker at a time, wait for under-replicated partitions to return to zero, then move to the next", "Upgrade all brokers at once to minimise the window", "Upgrade clients first, then brokers in parallel", "Stop producers, upgrade, restart"], answer: 0, explain: "Restarting one broker at a time keeps every partition with enough in-sync replicas. Waiting for under-replicated partitions to clear before the next restart is the safety check." },
        { q: "Active-passive replication to a DR cluster is asynchronous. What must your failover plan accept?", options: ["Zero data loss", "Some recent records may be missing and consumer offsets must be translated, so consumers may reprocess or skip a little", "Producers cannot fail over", "Schemas are lost"], answer: 1, explain: "Asynchronous mirroring always has lag (your RPO), and offsets differ between clusters. Plans use offset translation and idempotent consumers to make the switch safe." },
        { q: "Why enforce topic creation through a pipeline instead of auto-create?", options: ["Auto-create is slower", "Auto-create disables replication", "Auto-created topics get default partitions, replication and retention, with no owner or schema, and typos create junk topics", "Kafka requires it"], answer: 2, explain: "Auto-creation hides configuration and ownership. A reviewed definition (as code) sets partitions, RF, retention, compaction and an owner up front." },
        { q: "With FULL compatibility, what is guaranteed?", options: ["Schemas cannot change", "Old and new readers can each read data written with the other schema", "Only adding fields is allowed, without defaults", "Every consumer upgrades automatically"], answer: 1, explain: "FULL combines backward and forward: new readers read old data and old readers read new data, so producers and consumers can upgrade in any order." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.kops = {
    id: "kops",
    name: "Kafka Operations",
    short: "KOPS",
    tagline: "Run the cluster, not just the code",
    color: "#f472b6",
    blurb: "Operating Kafka in production: sizing partitions and brokers from throughput, the network multiplier, reassignment and leader balance, rolling upgrades and configuration drift, schemas and compatibility rules, topic hygiene as code, and multi-cluster replication for disaster recovery.",
    modules: [
      {
        id: "sizing",
        name: "Sizing & Balancing",
        icon: "trend",
        lessons: [
          L("partition-count", "Choosing a partition count", "Size from the larger of produce and consume throughput per partition, add headroom, and respect the key-hash contract.", 8, ["kafka", "sizing", "partitions"], [
            { t: "p", html: "Partition count sets the ceiling on consumer parallelism and spreads load across brokers. Too few and you cannot scale consumers; too many and you pay in metadata, open files, replication overhead and slower recovery. Size it from numbers you have <strong>measured</strong> on your hardware and workload, not from a rule of thumb." },
            { t: "code", lang: "text", code: "target throughput T        = 200 MB/s (peak, with headroom)\nmeasured produce/partition = 20 MB/s   -> T / 20 = 10 partitions\nmeasured consume/instance  = 8 MB/s    -> T / 8  = 25 partitions\n\npartitions = max(10, 25) = 25  -> round to 30 for growth" },
            { t: "table", headers: ["Too few", "Too many"], rows: [["Consumers capped below demand", "More leader elections on broker failure"], ["Hot partitions under skewed keys", "More end-to-end latency from small batches"], ["Hard to add later for keyed topics", "Controller metadata and file handles grow"]] },
            { t: "note", variant: "trap", html: "Adding partitions to a keyed topic remaps keys. If per-key order matters, choose a count with room to grow, or migrate to a new topic with a controlled cutover." },
            { t: "note", variant: "tip", html: "Use the same partition count for topics that are joined or co-partitioned by key (as Kafka Streams requires), so related keys land in matching partitions." },
            { t: "note", variant: "key", html: "<strong>Partitions = max(produce-bound, consume-bound) plus headroom.</strong> Measure both, plan for growth up front on keyed topics, and avoid \"thousands just in case\"." }
          ]),
          L("broker-capacity", "Broker capacity: disk, network and the replication multiplier", "Every byte in becomes several bytes out; size brokers from retention, replication and fan-out.", 9, ["kafka", "capacity", "brokers"], [
            { t: "p", html: "A broker's load is not its ingress. Each produced byte is written locally, sent to every follower, and read by every consumer group. With replication factor <em>R</em> and <em>G</em> consumer groups, cluster egress is roughly ingress \u00d7 (<em>R</em> \u2212 1 + <em>G</em>). Disk is ingress \u00d7 retention \u00d7 <em>R</em>. Whichever hits its limit first decides your broker count." },
            { t: "widget", id: "pl-capacity" },
            { t: "table", headers: ["Resource", "Driven by", "Relief"], rows: [["Disk capacity", "Rate \u00d7 retention \u00d7 RF", "Tiered storage, shorter local retention"], ["Disk throughput", "Writes plus cold reads", "Keep consumers near the head; throttle replays"], ["Network", "Replication plus consumer fan-out", "Fewer groups re-reading, rack-aware fetching, compression"], ["CPU", "TLS, compression conversion, request rate", "Larger batches, consistent compression"]] },
            { t: "note", variant: "warn", html: "Leave headroom for failure. When a broker dies, its leadership and replication load move to the survivors, and re-replication adds traffic on top. A cluster that runs at 80% network is one failure from saturation." },
            { t: "note", variant: "tip", html: "Rack- or zone-aware replica placement plus follower fetching (consumers reading from a replica in their own zone) can cut cross-zone traffic, which is often a large share of the cloud bill." },
            { t: "note", variant: "key", html: "<strong>Size for egress and failure, not ingress.</strong> Replication and consumer fan-out multiply every byte, and a lost broker's load lands on the rest." }
          ]),
          L("reassignment", "Reassignment, leader balance and cluster growth", "Moving replicas copies data, so throttle it; restore preferred leaders after failures.", 8, ["kafka", "reassignment", "operations"], [
            { t: "p", html: "Adding a broker does nothing until partitions move onto it. A <strong>reassignment</strong> adds the new replica, waits for it to catch up, then removes the old one. That catch-up is a full copy of the partition, competing with live traffic. Large rebalances should be throttled, batched, and preferably driven by a tool that plans moves to minimise data transfer." },
            { t: "ol", items: ["Generate a plan that moves the fewest bytes to reach balance.", "Set a replication throttle on the involved brokers.", "Execute in batches; watch under-replicated partitions, request latency and consumer lag.", "Remove the throttle when done \u2014 a forgotten throttle slows normal recovery later.", "Run preferred leader election so leadership is spread again."] },
            { t: "p", html: "Leadership matters as much as replica placement: all reads and writes for a partition go to its leader. After a broker restarts, the survivors may keep its leaderships. <strong>Preferred leader election</strong> hands each partition back to the first replica in its list, which is usually automatic but worth checking after incidents." },
            { t: "note", variant: "trap", html: "Tiered storage changes the economics: with most data in object storage, moving a partition copies only the local tail. Without it, reassigning a partition with weeks of retention can take hours." },
            { t: "note", variant: "key", html: "<strong>Reassignment is a bulk copy; treat it like a migration.</strong> Plan, throttle, batch, watch lag, remove the throttle, and rebalance leaders at the end." }
          ], "kops-sizing")
        ]
      },
      {
        id: "lifecycle",
        name: "Lifecycle, Schemas & DR",
        icon: "wrench",
        lessons: [
          L("rolling-upgrades", "Rolling upgrades and configuration drift", "Upgrade one broker at a time behind a health gate, and keep configuration in version control.", 7, ["kafka", "upgrades", "operations"], [
            { t: "p", html: "Kafka is designed for <strong>rolling</strong> operations: restart one broker, let its partitions fail over, bring it back, wait for it to rejoin every ISR, then move on. The gate between brokers is simple and non-negotiable: <strong>under-replicated partitions back to zero</strong>. Skip it and the next restart can take a partition below min ISR." },
            { t: "ol", items: ["Read the upgrade notes for protocol and metadata version steps.", "Upgrade brokers one at a time, with controlled shutdown so leadership moves cleanly.", "After each broker: wait for zero under-replicated partitions and stable request latency.", "Bump the metadata or feature version only after every broker runs the new binary.", "Upgrade clients separately; modern brokers support older clients and vice versa within documented ranges."] },
            { t: "note", variant: "warn", html: "Configuration drift \u2014 one broker with a different retention default or thread count \u2014 makes incidents unreproducible. Keep broker and topic configuration in version control and apply it through automation." },
            { t: "note", variant: "tip", html: "Rehearse the upgrade on a staging cluster that mirrors production partition counts. Controller and recovery behaviour change with scale more than with traffic." },
            { t: "note", variant: "key", html: "<strong>One broker at a time, gated on zero under-replicated partitions.</strong> Feature versions move last, and configuration lives in code." }
          ]),
          L("schema-evolution", "Schemas, registries and compatibility", "A registry and a compatibility rule let producers and consumers evolve independently without breaking each other.", 9, ["schemas", "avro", "protobuf", "compatibility"], [
            { t: "p", html: "A topic is a contract between teams who deploy on different schedules. A <strong>schema registry</strong> stores versioned schemas per subject (usually per topic value); producers register a schema and embed its id in each record, and consumers fetch the schema to decode. The registry rejects new versions that violate the subject's <strong>compatibility mode</strong>." },
            { t: "table", headers: ["Mode", "Guarantee", "Upgrade order"], rows: [["BACKWARD", "New readers read old data", "Consumers first"], ["FORWARD", "Old readers read new data", "Producers first"], ["FULL", "Both directions", "Any order"], ["*_TRANSITIVE", "Against every earlier version, not just the last", "Use when consumers replay long history"], ["NONE", "No checks", "Only for throwaway topics"]] },
            { t: "ul", items: ["<strong>Safe almost everywhere:</strong> add an optional field with a default.", "<strong>Breaking:</strong> remove a required field, change a type, rename without aliases.", "<strong>Protobuf:</strong> never reuse a field number; reserve removed ones.", "<strong>JSON without a schema:</strong> compatibility is whatever the consumers' code happens to tolerate."] },
            { t: "note", variant: "trap", html: "Compatibility is checked against the previous version only, unless you choose a transitive mode. Consumers that replay months of history can still meet a schema two breaking steps back." },
            { t: "note", variant: "tip", html: "Run the compatibility check in CI against the registry before merge, the same way data contracts are checked for batch tables. A rejected schema at deploy time is an incident; at review time it is a comment." },
            { t: "note", variant: "key", html: "<strong>The registry turns topic shape into an enforced contract.</strong> Pick a compatibility mode per subject, prefer transitive modes for replayed topics, and check it in CI." }
          ]),
          L("topic-hygiene", "Topic hygiene, naming and ownership", "Every topic needs an owner, a schema, an explicit configuration and a deletion plan.", 6, ["governance", "topics", "operations"], [
            { t: "p", html: "Clusters rot the same way data warehouses do: hundreds of topics with no owner, default settings nobody chose, and names that encode a team that no longer exists. Treat topics as products. Each one should be declared in code with an owner, a purpose, a schema subject, and explicit partitions, replication, retention and cleanup policy." },
            { t: "table", headers: ["Field", "Example", "Why"], rows: [["Name", "payments.order-events.v1", "Domain, entity, version \u2014 readable and stable"], ["Owner", "team-payments", "Who gets paged and who approves changes"], ["Retention / policy", "7 days, delete", "An explicit replay budget"], ["Schema subject", "payments.order-events.v1-value", "Contract enforcement"], ["Data class", "contains PII: no", "Drives ACLs and retention rules"]] },
            { t: "note", variant: "warn", html: "Turn off automatic topic creation in production. A typo in a producer config should fail, not silently create a one-partition topic with default retention." },
            { t: "note", variant: "tip", html: "Track producers and consumers per topic from client metrics or ACLs. A topic with no reader for ninety days is a deletion candidate; one with no writer is either finished or broken." },
            { t: "note", variant: "key", html: "<strong>Topics are products with owners and contracts.</strong> Declare them in code, version their names, and give every one a retention policy someone actually chose." }
          ]),
          L("multi-cluster-dr", "Multi-cluster replication and disaster recovery", "Asynchronous mirroring gives you a second cluster with some lag; failover needs offset translation and idempotent consumers.", 9, ["kafka", "disaster-recovery", "replication"], [
            { t: "p", html: "Replication inside a cluster protects against broker loss. Surviving the loss of a whole region or cluster needs a second cluster fed by <strong>cross-cluster replication</strong> (a mirroring tool or a managed equivalent). It is asynchronous: the standby is always slightly behind, and that lag is your <strong>recovery point objective</strong>." },
            { t: "table", headers: ["Pattern", "How it works", "Trade-off"], rows: [["Active-passive", "Mirror primary to standby; fail over consumers and producers", "Simple; standby idle; RPO = mirror lag"], ["Active-active (aggregate)", "Each region produces locally, mirrors to an aggregate topic", "Low local latency; consumers must handle two sources"], ["Stretched cluster", "One cluster across three close zones or regions", "Synchronous, zero RPO; latency-sensitive and expensive"]] },
            { t: "p", html: "Offsets differ between clusters, so a consumer cannot simply reuse its offset after failover. Mirroring tools can <strong>translate committed offsets</strong> periodically; consumers resume from the translated point, which may replay a little. That is safe only if consumers are idempotent." },
            { t: "note", variant: "trap", html: "Avoid mirroring loops in active-active setups: replicate topics with a source prefix (or equivalent filtering) so a record mirrored from A to B is never mirrored back to A." },
            { t: "note", variant: "tip", html: "Run a failover drill on a schedule. The first real failover is the wrong time to discover that ACLs, schemas or quotas were never replicated." },
            { t: "note", variant: "key", html: "<strong>Cross-cluster DR is asynchronous by default.</strong> Measure mirror lag as your RPO, translate offsets, make consumers idempotent, and drill the failover." }
          ], "kops-lifecycle")
        ]
      }
    ]
  };
})();
