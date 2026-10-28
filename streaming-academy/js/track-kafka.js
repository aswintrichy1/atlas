/* =====================================================================
   PULSE · Kafka Internals
   window.TRACKS.kafka — modules: log / replication / consumers
   Widgets used: pl-isr, pl-partitions (registered in js/widgets.js)
   ===================================================================== */
(function () {
  "use strict";

  function L(id, title, summary, minutes, tags, blocks, quiz) {
    if (quiz) blocks.splice(blocks.length - 1, 0, { t: "quiz", id: quiz });
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "kafka-log": {
      title: "The partitioned log checkpoint",
      sub: "Partitions, segments, retention and compaction.",
      questions: [
        { q: "Retention is set to seven days, but a partition still holds ten-day-old records. Why is that normal?", options: ["Retention only applies to compacted topics", "Consumers are still reading them", "Brokers ignore retention under load", "Deletion happens per closed segment, and the oldest segment is only removed once its newest record is past retention"], answer: 3, explain: "Kafka deletes whole segments. A segment is eligible once its largest timestamp is older than retention, and the active segment is never deleted, so a low-traffic partition can keep data well past the nominal limit." },
        { q: "What does a compacted topic guarantee?", options: ["Only the latest record per key is ever stored", "Records are deleted after retention.ms", "At least the latest value for every key is retained, so the topic can rebuild a table", "Records are compressed on disk"], answer: 2, explain: "Compaction removes superseded values in the background, so older values may linger for a while, but the latest value per key is always kept. Tombstones (null values) remove a key after a grace period." },
        { q: "How does a broker find the record at a given offset quickly?", options: ["It scans the whole partition", "It asks the controller", "It keeps every record in memory", "It picks the segment by its base offset, then uses that segment's sparse offset index to jump near the position"], answer: 3, explain: "Segment files are named by base offset, so the right file is a binary search away, and each segment's sparse index maps offsets to byte positions so the broker scans only a small range." },
        { q: "Why does Kafka read and write throughput depend so heavily on the OS page cache?", options: ["Kafka writes sequentially to files and serves recent reads from cached pages, often sending them to the socket without copying through the JVM", "Kafka stores all data in the JVM heap", "The page cache encrypts data", "It does not; Kafka bypasses the file system"], answer: 0, explain: "Sequential appends and page-cache reads are what make a log fast. Consumers reading near the head are served from memory, and zero-copy transfer avoids moving bytes through user space when TLS is off." },
        { q: "What does tiered storage change about retention?", options: ["It removes the need for replication", "Closed segments move to cheaper object storage, so long retention no longer needs local broker disk", "It makes compaction unnecessary", "It speeds up producers"], answer: 1, explain: "With tiered storage, brokers keep recent segments locally and older ones in object storage. Retention can be long and cheap, and adding brokers no longer means copying the full history." }
      ]
    },
    "kafka-replication": {
      title: "Replication & producer path checkpoint",
      sub: "ISR, high watermark, controller, acks and idempotence.",
      questions: [
        { q: "RF=3, min.insync.replicas=2, acks=all. Two brokers hosting a partition go down. What happens to writes?", options: ["They succeed with one copy", "They are refused with a not-enough-replicas error until a replica returns", "They are written to the controller", "They are silently dropped"], answer: 1, explain: "acks=all with min ISR 2 needs two in-sync replicas to acknowledge. With only the leader left, the broker refuses writes rather than accept data that a single failure could lose." },
        { q: "What is the high watermark?", options: ["The largest offset the leader has received", "The configured retention size", "The offset up to which all in-sync replicas have the data; consumers only read below it", "The producer's batch size limit"], answer: 2, explain: "Records above the high watermark exist only on some replicas and could be truncated after a leader change, so consumers are not shown them. That is what keeps reads consistent across failover." },
        { q: "Why is unclean leader election disabled by default?", options: ["It makes elections slower", "It requires ZooKeeper", "It breaks compaction", "Electing an out-of-sync replica restores availability by discarding acknowledged writes the old leader had"], answer: 3, explain: "An out-of-sync replica lacks some committed records. Promoting it trades durability for availability, which is rarely acceptable for business data, so Kafka prefers staying offline until an in-sync replica returns." },
        { q: "How does the idempotent producer prevent duplicates from retries?", options: ["Each producer has an id and numbers its batches per partition, so the broker discards a batch it has already written", "It waits for every batch to be consumed", "It uses a distributed lock", "It disables retries"], answer: 0, explain: "The broker tracks the last sequence numbers for each producer id and partition. A retried batch with a sequence it has already appended is acknowledged without being written again, which also preserves order." },
        { q: "What replaced ZooKeeper for cluster metadata in modern Kafka?", options: ["An external etcd cluster", "KRaft: a Raft-based quorum of controllers storing metadata in an internal log", "The schema registry", "Each broker's local config file"], answer: 1, explain: "KRaft runs a quorum of controller nodes that replicate a metadata log with Raft. Brokers follow that log, which makes metadata changes and failover faster and removes a separate system to operate." }
      ]
    },
    "kafka-consumers": {
      title: "Consumer groups checkpoint",
      sub: "Assignment, rebalances, offsets and commits.",
      questions: [
        { q: "A topic has 6 partitions and the group has 8 consumers. What happens?", options: ["Each partition is split across consumers", "Kafka adds two partitions automatically", "Six consumers each own a partition and two sit idle", "The group refuses to start"], answer: 2, explain: "A partition is owned by at most one consumer in a group. Extra consumers are idle standbys; to scale further you need more partitions." },
        { q: "What is the main benefit of the cooperative (incremental) rebalance protocol?", options: ["It removes the group coordinator", "Only the partitions that actually move are revoked, so the rest of the group keeps processing", "It guarantees exactly-once", "It makes rebalances unnecessary"], answer: 1, explain: "Eager rebalancing revokes every partition from every member, stopping the whole group. Cooperative rebalancing revokes only the partitions being reassigned, so most consumers never pause." },
        { q: "A consumer spends 10 minutes processing one large batch and is kicked out of the group. Which setting is involved?", options: ["max.poll.interval.ms \u2014 the maximum time between poll calls before the consumer is considered stuck", "session.timeout.ms only", "retention.ms", "fetch.min.bytes"], answer: 0, explain: "Heartbeats run on a background thread, so session timeouts catch dead processes; a live consumer that stops calling poll is caught by max.poll.interval.ms. Smaller batches or more time fix it." },
        { q: "Why commit offsets after processing rather than with auto-commit on a timer?", options: ["Auto-commit is slower", "Manual commits are required for compaction", "Auto-commit disables rebalancing", "A timer can commit offsets for records you have not finished processing, so a crash loses them"], answer: 3, explain: "Auto-commit records the position returned by poll, independent of your side effects. Committing after the work is done gives at-least-once; auto-commit can drift into at-most-once on crashes." },
        { q: "What does static group membership (a fixed group.instance.id) buy you?", options: ["Exactly-once delivery", "A restarting consumer reclaims its partitions within the session timeout without triggering a rebalance", "More partitions per consumer", "Automatic offset reset"], answer: 1, explain: "With static membership, a rolling restart that finishes within the session timeout looks like the same member returning, so the group avoids a rebalance for every pod restart." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.kafka = {
    id: "kafka",
    name: "Kafka Internals",
    short: "KAFKA",
    tagline: "The partitioned, replicated log",
    color: "#a78bfa",
    blurb: "How Kafka actually stores, replicates and serves data: partitions and segment files, retention and compaction, tiered storage, replication with the in-sync replica set and high watermark, the KRaft controller, the producer path and idempotence, and consumer groups with their assignment, rebalance protocols and offset commits.",
    modules: [
      {
        id: "log",
        name: "The Partitioned Log",
        icon: "database",
        lessons: [
          L("partitions", "Topics, partitions and offsets", "A topic is a name; a partition is the real log \u2014 the unit of order, parallelism and placement.", 8, ["kafka", "partitions", "offsets"], [
            { t: "p", html: "A Kafka <strong>topic</strong> is a named category of records, split into <strong>partitions</strong>. Each partition is an independent, ordered, append-only log stored on a set of brokers. Every record in a partition gets a monotonically increasing <strong>offset</strong>. Order, replication, leadership and consumer assignment all happen per partition, so the partition \u2014 not the topic \u2014 is the unit you reason about." },
            { t: "table", headers: ["Property", "Per partition", "Consequence"], rows: [["Order", "Total order by offset", "No order across partitions"], ["Throughput", "Bounded by one leader and one consumer", "Scale by adding partitions"], ["Leadership", "One leader broker, others follow", "Leaders should be spread across brokers"], ["Consumption", "One consumer per group", "Max parallelism = partition count"]] },
            { t: "p", html: "The producer picks a partition for each record. With a key, the default partitioner hashes it so the same key always lands in the same partition. Without a key, modern clients fill a batch for one partition before switching (a \"sticky\" strategy), which makes batches larger and latency lower than strict round-robin." },
            { t: "code", lang: "text", code: "topic: orders (3 partitions)\n  p0: [0:o-17][1:o-20][2:o-17][3:o-41] ...\n  p1: [0:o-18][1:o-33][2:o-18] ...\n  p2: [0:o-19][1:o-19][2:o-52] ...\n\nkey o-17 -> hash % 3 -> p0, always (while the partition count stays 3)" },
            { t: "note", variant: "trap", html: "Too many partitions is a real cost: each one is open files, replication traffic, controller metadata and recovery work. Size from throughput (see <a href=\"#/kops/sizing/partition-count\">partition count</a>) rather than \"lots, to be safe\"." },
            { t: "note", variant: "key", html: "<strong>Reason in partitions.</strong> A topic's order, throughput ceiling and consumer parallelism are all properties of its partitions and how records are keyed onto them." }
          ]),
          L("segments", "Segments, indexes and the page cache", "Each partition is a directory of segment files with sparse indexes; sequential IO and the OS cache do the heavy lifting.", 9, ["kafka", "storage", "segments"], [
            { t: "p", html: "On disk, a partition is a directory of <strong>segments</strong>. Each segment is a log file of record batches plus two small indexes: an <strong>offset index</strong> mapping offsets to byte positions and a <strong>time index</strong> mapping timestamps to offsets. Only the newest, <em>active</em> segment is written; when it reaches a size or age limit, it is closed and a new one starts." },
            { t: "code", lang: "text", code: "orders-0/\n  00000000000000000000.log        closed segment, base offset 0\n  00000000000000000000.index\n  00000000000000000000.timeindex\n  00000000000005242880.log        active segment, base offset 5,242,880\n  00000000000005242880.index\n  00000000000005242880.timeindex" },
            { t: "p", html: "To serve a fetch at offset <em>N</em>, the broker binary-searches segment names for the right file, looks up the nearest index entry at or below <em>N</em> (the index is sparse), and scans forward a few kilobytes. Time-based lookups (\"start from 09:00\") go through the time index the same way." },
            { t: "ul", items: ["<strong>Sequential appends</strong> make writes cheap even on spinning disks.", "<strong>The page cache</strong> holds recent segments, so consumers near the head read from memory.", "<strong>Zero-copy transfer</strong> can send file bytes straight to the socket (not possible when the broker must encrypt with TLS).", "<strong>Batches</strong> are stored as the producer compressed them, so the broker rarely decompresses."] },
            { t: "note", variant: "warn", html: "A consumer reading old data evicts hot pages from the cache and pushes reads to disk for everyone. Large replays and backfills deserve their own throttle, or a separate cluster or tier." },
            { t: "note", variant: "key", html: "<strong>Kafka is fast because it is boring IO.</strong> Append sequentially, read from the page cache, keep batches intact \u2014 and remember that cold reads are what break that model." }
          ]),
          L("retention-tiered", "Retention and tiered storage", "Time and size retention delete whole segments; tiered storage moves old segments to object storage.", 8, ["kafka", "retention", "tiered-storage"], [
            { t: "p", html: "With <code class='tok'>cleanup.policy=delete</code>, a topic keeps data until it exceeds <code class='tok'>retention.ms</code> (default seven days) or <code class='tok'>retention.bytes</code> per partition. Deletion is per closed segment: once every record in a segment is past retention, the whole file goes. That is why retention is approximate and why the active segment is never deleted." },
            { t: "table", headers: ["Setting", "Controls", "Watch out for"], rows: [["retention.ms", "Age limit", "Effective age can exceed it by one segment's worth"], ["retention.bytes", "Size limit per partition, not per topic", "Multiply by partitions and replicas for disk"], ["segment.bytes / segment.ms", "When a segment closes", "Low-traffic partitions may keep old data longer"], ["local retention (tiered)", "How much stays on broker disk", "Cold reads now come from object storage"]] },
            { t: "p", html: "<strong>Tiered storage</strong> splits the log in two: recent segments on broker disk, older closed segments in object storage. Brokers become lighter (less data to move when you add or replace one), and long retention costs object-storage prices. Consumers reading old offsets fetch from the remote tier transparently, at higher latency." },
            { t: "note", variant: "tip", html: "Retention is a product decision: it is your replay window. Set it to cover the longest outage you want to recover from without a backfill from elsewhere, plus a margin." },
            { t: "note", variant: "trap", html: "Tiered storage does not apply to compacted topics in the common implementations, and remote reads are slower. Test a full replay from the remote tier before relying on it for disaster recovery." },
            { t: "note", variant: "key", html: "<strong>Retention is your replay budget.</strong> It deletes in segments, multiplies by partitions and replicas, and with tiered storage can be long without being expensive." }
          ]),
          L("compaction", "Log compaction and tombstones", "Keep at least the latest value per key so a topic can rebuild a table \u2014 and delete keys with tombstones.", 8, ["kafka", "compaction", "changelog"], [
            { t: "p", html: "With <code class='tok'>cleanup.policy=compact</code>, Kafka keeps <strong>at least the latest record for every key</strong>. A background cleaner rewrites old segments, dropping records whose key has a newer value later in the log. Offsets never change; compacted logs simply have gaps. A consumer that reads from the beginning ends up with the current value of every key: a table." },
            { t: "code", lang: "text", code: "before cleaning (offset:key=value)\n0:a=1  1:b=7  2:a=2  3:c=4  4:b=null  5:a=3\n\nafter cleaning (offsets unchanged, gaps allowed)\n3:c=4  4:b=null  5:a=3      <- b=null is a tombstone, kept for delete.retention.ms\n\nresult after tombstone expiry:  a=3, c=4" },
            { t: "ul", items: ["<strong>Tombstones</strong> (null value) mark a key as deleted; they are kept for <code class='tok'>delete.retention.ms</code> so slow consumers see the delete.", "<strong>The head of the log is not compacted</strong>: recent duplicates remain until the cleaner reaches them.", "<strong>min.cleanable.dirty.ratio</strong> trades cleaner IO against how many stale values linger.", "<strong>compact,delete</strong> combines both: latest-per-key, but nothing older than retention."] },
            { t: "note", variant: "trap", html: "Compaction is not deduplication. Consumers can still see several values for one key, including older ones, because the uncleaned head is served as is. Logic built on a compacted topic must be idempotent per key." },
            { t: "note", variant: "tip", html: "Compacted topics are ideal for reference data, configuration, CDC of current-state tables, and the changelogs behind Kafka Streams state stores. See <a href=\"#/fund/model/stream-table\">the stream-table duality</a>." },
            { t: "note", variant: "key", html: "<strong>Compaction turns a log into a rebuildable table.</strong> It keeps the latest value per key, deletes via tombstones, and never promises you will only see one value." }
          ], "kafka-log")
        ]
      },
      {
        id: "replication",
        name: "Replication & the Producer Path",
        icon: "shield",
        lessons: [
          L("replication-isr", "Replication, ISR and the high watermark", "Followers copy the leader; the in-sync set decides what is committed and what consumers may read.", 10, ["kafka", "replication", "isr", "durability"], [
            { t: "p", html: "Each partition has a <strong>leader</strong> and zero or more <strong>followers</strong> (replication factor minus one). Producers write to the leader; followers fetch from it like consumers. The <strong>in-sync replica set (ISR)</strong> is the leader plus every follower that has caught up recently (within <code class='tok'>replica.lag.time.max.ms</code>). A follower that falls behind is removed from the ISR and re-added once it catches up." },
            { t: "p", html: "The <strong>high watermark</strong> is the highest offset that every ISR member has. Records below it are <em>committed</em> and visible to consumers; records above it exist only on some replicas. If the leader fails, a new leader is chosen from the ISR, and any replica holding uncommitted records truncates them to match \u2014 using leader epochs so it knows exactly where to cut." },
            { t: "widget", id: "pl-isr" },
            { t: "table", headers: ["Setting", "Typical", "Effect"], rows: [["replication.factor", "3", "Copies of each partition"], ["min.insync.replicas", "2", "With acks=all, writes need this many ISR members"], ["acks (producer)", "all", "Wait for the full ISR before acknowledging"], ["unclean.leader.election.enable", "false", "Never promote an out-of-sync replica"]] },
            { t: "note", variant: "warn", html: "<code class='tok'>acks=all</code> means all <em>in-sync</em> replicas, not all replicas. Without <code class='tok'>min.insync.replicas</code> \u2265 2, the ISR can shrink to the leader alone and \"all\" quietly becomes one copy." },
            { t: "cue", html: "<strong>The durable default to state:</strong> \"RF 3, min ISR 2, acks=all, unclean election off \u2014 we survive one broker loss with no data loss and keep accepting writes.\"" },
            { t: "note", variant: "key", html: "<strong>The ISR and high watermark define committed data.</strong> RF 3 with min ISR 2 and acks=all tolerates one failure without losing acknowledged writes or availability." }
          ]),
          L("kraft-controller", "The controller, KRaft and leader election", "One active controller owns cluster metadata; in KRaft it is a Raft quorum instead of ZooKeeper.", 8, ["kafka", "kraft", "controller"], [
            { t: "p", html: "Some broker-level decisions need a single authority: which broker leads each partition, which replicas are in the ISR, which topics exist. That authority is the <strong>controller</strong>. Historically it was elected through ZooKeeper, which also stored the metadata. In <strong>KRaft</strong> mode, a small quorum of controller nodes replicates a metadata log using Raft; one is the active controller, and brokers follow the log to learn about changes." },
            { t: "compare", bad: { title: "ZooKeeper-based", items: ["Separate system to deploy, secure and upgrade", "Controller failover reloads metadata from ZooKeeper", "Partition counts limited by metadata propagation"] }, good: { title: "KRaft", items: ["Metadata is a replicated log inside Kafka", "Standby controllers are already up to date", "Faster failover and more partitions per cluster"] } },
            { t: "p", html: "When a broker dies, the controller notices (missed heartbeats), picks a new leader for each affected partition from its ISR, and publishes the change. Clients refresh metadata and reconnect. With many partitions on one broker, the speed of that loop is what decides how long the outage looks to producers." },
            { t: "note", variant: "tip", html: "Run three or five dedicated controllers for production clusters. Co-locating controllers with brokers is fine for small or development clusters but couples metadata availability to broker load." },
            { t: "note", variant: "trap", html: "Recent Kafka major versions run in KRaft mode only. Upgrading a ZooKeeper-based cluster means a migration, not just a version bump; plan it as a project." },
            { t: "note", variant: "key", html: "<strong>The controller decides leadership; KRaft makes it a Raft log.</strong> Fast, local metadata is what turns a broker failure into seconds of leader movement instead of minutes." }
          ]),
          L("producer-path", "The producer path: batching, acks and compression", "Producers trade latency for throughput with batching, choose durability with acks, and fail loudly with delivery timeouts.", 9, ["kafka", "producer", "throughput"], [
            { t: "p", html: "A producer does not send records one at a time. It serialises each record, picks a partition, and appends it to an in-memory <strong>batch</strong> for that partition. A batch is sent when it fills (<code class='tok'>batch.size</code>) or when <code class='tok'>linger.ms</code> expires. Bigger batches compress better and cost fewer requests; lingering a few milliseconds is usually the best throughput trade you can make." },
            { t: "table", headers: ["Setting", "Raises", "Costs"], rows: [["linger.ms", "Batch size, throughput", "A few ms of latency"], ["batch.size", "Max batch per partition", "Memory per partition"], ["compression.type", "Throughput, disk and network efficiency", "CPU on producer and consumer"], ["acks", "Durability", "Latency of waiting for replicas"], ["delivery.timeout.ms", "How long retries may continue", "How long before an error surfaces"]] },
            { t: "code", lang: "java", code: "Properties p = new Properties();\np.put(\"bootstrap.servers\", System.getenv(\"KAFKA_BOOTSTRAP\"));\np.put(\"acks\", \"all\");\np.put(\"enable.idempotence\", \"true\");\np.put(\"linger.ms\", \"10\");\np.put(\"compression.type\", \"zstd\");\np.put(\"delivery.timeout.ms\", \"120000\");\n// credentials come from the environment or a secret manager, never source\nKafkaProducer<String, byte[]> producer = new KafkaProducer<>(p);" },
            { t: "note", variant: "trap", html: "<code class='tok'>send()</code> is asynchronous. If you never check the returned future or callback, a record that exhausts its delivery timeout fails silently. Always handle the callback and alert on errors." },
            { t: "note", variant: "tip", html: "Keep connection settings and secrets out of code: read the bootstrap address from configuration and credentials from a secret manager or mounted file. The same producer code then runs in every environment." },
            { t: "note", variant: "key", html: "<strong>Batch for throughput, ack for durability, handle every callback.</strong> A few milliseconds of linger and compression usually beat any other producer tuning." }
          ]),
          L("idempotent-producer", "The idempotent producer", "Producer ids and per-partition sequence numbers let brokers discard retried batches and keep order.", 7, ["kafka", "idempotence", "exactly-once"], [
            { t: "p", html: "Retries are necessary \u2014 a network blip should not lose data \u2014 but a retry after a lost acknowledgement writes the batch twice. The <strong>idempotent producer</strong> fixes this. The broker gives each producer a <strong>producer id</strong>; the producer numbers every batch per partition with a <strong>sequence number</strong>. The broker remembers the last few sequences per producer and partition and acknowledges duplicates without appending them." },
            { t: "code", lang: "text", code: "producer pid=42 -> partition 3\n  batch seq=7  -> appended, ack lost on the network\n  batch seq=7  -> retry: broker sees seq 7 already written, acks without appending\n  batch seq=8  -> appended\n  batch seq=10 -> out-of-order sequence error (9 missing): producer resends in order" },
            { t: "ul", items: ["On by default in modern Java clients (with <code class='tok'>acks=all</code>).", "Keeps ordering with up to five in-flight requests per connection.", "Scope is one producer session and one partition: it does not dedupe across restarts or across partitions.", "Cross-partition, cross-restart atomicity needs <a href=\"#/eo/guarantees/kafka-transactions\">transactions</a>."] },
            { t: "note", variant: "warn", html: "Idempotence protects against producer retries, not against your application sending the same business event twice. If upstream code can resend, give events a stable id and dedupe or upsert downstream." },
            { t: "note", variant: "key", html: "<strong>Producer id plus sequence numbers make retries safe.</strong> Keep idempotence on; it is the cheapest correctness win in Kafka and the foundation for transactions." }
          ], "kafka-replication")
        ]
      },
      {
        id: "consumers",
        name: "Consumer Groups",
        icon: "plug",
        lessons: [
          L("consumer-groups", "Consumer groups and assignment", "A group shares partitions so each is read by exactly one member; assignors decide who gets what.", 8, ["kafka", "consumer-groups", "assignment"], [
            { t: "p", html: "Consumers that share a <code class='tok'>group.id</code> form a <strong>consumer group</strong>. The group divides the topic's partitions so each partition is owned by exactly one member at a time; different groups read independently and keep their own offsets. A <strong>group coordinator</strong> broker tracks membership and stores committed offsets in the internal <code class='tok'>__consumer_offsets</code> topic." },
            { t: "table", headers: ["Assignor", "How it splits", "Behaviour on change"], rows: [["Range", "Contiguous ranges per topic", "Can skew when subscribing to many topics"], ["Round-robin", "Deals partitions in turn", "Even, but reshuffles widely on change"], ["Sticky", "Even, and keeps previous owners", "Moves as few partitions as possible"], ["Cooperative sticky", "Sticky with incremental revocation", "Only movers pause"]] },
            { t: "p", html: "Parallelism is capped by partitions: a group with more members than partitions leaves the extras idle. Uneven assignment matters too \u2014 the consumer with the most partitions (or the hottest one) sets the group's lag." },
            { t: "note", variant: "tip", html: "Newer Kafka versions add a broker-driven group protocol in which the coordinator computes assignments and members reconcile incrementally. It removes much of the client-side rebalance choreography; check which protocol your clients and brokers use." },
            { t: "note", variant: "key", html: "<strong>One partition, one owner per group.</strong> Groups scale up to the partition count, and the assignor decides how evenly \u2014 and how disruptively \u2014 partitions are shared." }
          ]),
          L("rebalance-protocols", "Rebalances: eager, cooperative and static", "Every membership change reassigns partitions; how much stops while it happens is a protocol choice.", 9, ["kafka", "rebalance", "operations"], [
            { t: "p", html: "A <strong>rebalance</strong> happens whenever group membership or subscriptions change: a consumer joins, leaves, crashes, or is considered stuck. With the original <strong>eager</strong> protocol, every member revokes all its partitions, the group agrees on a new assignment, and everyone resumes \u2014 a stop-the-world pause for the whole group. The <strong>cooperative</strong> protocol revokes only partitions that change owner, so most consumers keep working." },
            { t: "widget", id: "pl-partitions" },
            { t: "table", headers: ["Trigger", "Setting", "Fix"], rows: [["Process dies", "session.timeout.ms (heartbeats)", "Expected; keep the timeout modest"], ["Processing too slow between polls", "max.poll.interval.ms", "Smaller batches, more time, or async work"], ["Rolling restart", "Every pod leaves and rejoins", "Static membership: group.instance.id"], ["Autoscaler flapping", "Consumers added and removed repeatedly", "Scale on sustained lag, with cooldown"]] },
            { t: "note", variant: "trap", html: "A <strong>rebalance storm</strong> \u2014 consumers repeatedly kicked out for slow polls, rejoining, and triggering another rebalance \u2014 can stop a group completely while every process looks healthy. The case study in <a href=\"#/cases/production/rebalance-storm\">production incidents</a> walks one through." },
            { t: "note", variant: "tip", html: "Commit offsets for revoked partitions in the revocation callback. Otherwise the new owner restarts from the last commit and reprocesses everything since." },
            { t: "note", variant: "key", html: "<strong>Make rebalances rare and small.</strong> Cooperative assignment, static membership and sensible poll limits turn a group-wide pause into a few partitions moving." }
          ]),
          L("offsets-commits", "Offsets, commits and resets", "Committed offsets are the group's progress; when and how you commit decides your delivery guarantee.", 8, ["kafka", "offsets", "semantics"], [
            { t: "p", html: "A consumer tracks two positions per partition: its <strong>position</strong> (the next offset it will fetch) and the <strong>committed offset</strong> (where the group restarts after a failure or rebalance). Commits are just records in <code class='tok'>__consumer_offsets</code>. Committing after your side effects gives at-least-once; committing before gives at-most-once." },
            { t: "code", lang: "java", code: "consumer.subscribe(List.of(\"orders\"));\nwhile (running) {\n  ConsumerRecords<String, Order> batch = consumer.poll(Duration.ofMillis(500));\n  for (ConsumerRecord<String, Order> r : batch) {\n    sink.upsert(r.value().id(), r.value());   // idempotent side effect\n  }\n  consumer.commitSync();                         // progress after effects\n}" },
            { t: "table", headers: ["auto.offset.reset", "When no committed offset exists", "Use"], rows: [["earliest", "Start from the oldest retained record", "New pipelines that must see history"], ["latest", "Start from new records only", "Live monitoring where history is irrelevant"], ["none", "Fail", "When silently starting anywhere would be wrong"]] },
            { t: "note", variant: "trap", html: "If a group is idle longer than the offsets retention period, its commits expire and <code class='tok'>auto.offset.reset</code> kicks in. With <em>latest</em>, that silently skips everything produced in between." },
            { t: "note", variant: "tip", html: "To reprocess, stop the group and reset offsets to a timestamp or offset with the admin tooling. Because the sink is idempotent, a replay overwrites instead of doubling." },
            { t: "note", variant: "key", html: "<strong>Commit after the effect, and make the effect idempotent.</strong> Offsets are cheap progress markers; the reset policy decides what happens when they are missing." }
          ], "kafka-consumers")
        ]
      }
    ]
  };
})();
