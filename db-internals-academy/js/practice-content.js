/* Ledger practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS (store, idx, qp, txn, dist, pg, col, sql). */
window.LedgerPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Diagnose and design",
      color: "#e879f9",
      icon: "map",
      summary: "Production-style database problems with an outline you can talk through from symptom to fix."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#38bdf8",
      icon: "quiz",
      summary: "Timed internals questions with what an interviewer listens for and the follow-ups they push on."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#34d399",
      icon: "star",
      summary: "The dimensions a database-internals round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "Numbers, defaults and decision rules worth having in memory before the round."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#2dd4bf",
      icon: "lesson",
      summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "slow-query",
      title: "A dashboard query went from 80 ms to 40 s overnight",
      subtitle: "The classic plan-regression investigation.",
      timebox: "30 min",
      prompt: "Nothing was deployed, but one reporting query on a Postgres orders table is suddenly 500 times slower. Walk through how you find the cause and fix it without guessing.",
      related: [
        { label: "Reading EXPLAIN", route: "#/qp/joins/reading-explain" },
        { label: "Statistics and cardinality", route: "#/qp/optimizer/statistics-cardinality" },
        { label: "Plan pathologies", route: "#/qp/joins/plan-pathologies" }
      ],
      outline: [
        { title: "Confirm and capture", items: [
          "Get the exact query text and parameters from pg_stat_statements, not a paraphrase.",
          "Run EXPLAIN (ANALYZE, BUFFERS) on a replica or with a statement timeout.",
          "Compare against an old plan if one was logged (auto_explain) to see what changed."
        ] },
        { title: "Read the plan", items: [
          "Walk from the most expensive node outward; look for estimated rows far from actual rows.",
          "A nested loop whose inner side runs thousands of loops is the usual explosion.",
          "Check shared read versus hit buffers to separate I/O pain from CPU pain."
        ] },
        { title: "Likely causes", items: [
          "Stale statistics after a bulk load or a data-distribution shift; autoanalyze has not caught up.",
          "Correlated predicates the planner multiplies as if independent, collapsing the estimate.",
          "A generic plan chosen for a prepared statement that suits most parameters but not this one."
        ] },
        { title: "Fix and prevent", items: [
          "ANALYZE the table; add extended statistics for correlated columns; raise the statistics target on skewed columns.",
          "Add or reshape an index only if the plan proves it would be used.",
          "Keep auto_explain on slow queries so the next regression ships its own evidence."
        ] }
      ]
    },
    {
      id: "bloat",
      title: "A hot table is 40 GB but holds 2 GB of live data",
      subtitle: "MVCC housekeeping gone wrong.",
      timebox: "25 min",
      prompt: "A frequently updated sessions table keeps growing, queries slow down, and disk alerts fire. Explain what is happening inside Postgres and how you recover and prevent it.",
      related: [
        { label: "Vacuum basics", route: "#/pg/vacuum/vacuum-basics" },
        { label: "Bloat", route: "#/pg/vacuum/bloat" },
        { label: "Autovacuum tuning", route: "#/pg/vacuum/autovacuum-tuning" }
      ],
      outline: [
        { title: "Mechanism", items: [
          "Every UPDATE writes a new tuple version and leaves the old one dead until vacuum reclaims it.",
          "Vacuum can only remove versions no running snapshot can still see.",
          "Reclaimed space is reused inside the file; plain VACUUM rarely shrinks the file itself."
        ] },
        { title: "Find the blocker", items: [
          "pg_stat_user_tables: n_dead_tup, last_autovacuum, autovacuum_count.",
          "pg_stat_activity: an idle-in-transaction session or a long report holding back the xmin horizon.",
          "Inactive replication slots and hot_standby_feedback can pin the horizon too."
        ] },
        { title: "Recover", items: [
          "Remove the horizon blocker first, or vacuum cannot help.",
          "Rewrite online with a repack-style tool, or VACUUM FULL in a maintenance window (it takes an exclusive lock).",
          "REINDEX CONCURRENTLY bloated indexes."
        ] },
        { title: "Prevent", items: [
          "Per-table lower autovacuum_vacuum_scale_factor for large hot tables.",
          "idle_in_transaction_session_timeout and alerts on transaction age.",
          "Lower fillfactor so updates can stay on the same page as heap-only tuples."
        ] }
      ]
    },
    {
      id: "double-booking",
      title: "Two users booked the last seat",
      subtitle: "A concurrency bug that passes every unit test.",
      timebox: "25 min",
      prompt: "A booking service checks that a seat is free, then inserts a booking, inside a transaction at the database's default isolation level. Occasionally two bookings land for the same seat. Explain why and give at least two correct fixes with their trade-offs.",
      related: [
        { label: "Anomalies", route: "#/txn/acid/anomalies" },
        { label: "Write skew patterns", route: "#/txn/practice/write-skew-patterns" },
        { label: "SSI", route: "#/txn/control/ssi" }
      ],
      outline: [
        { title: "Name the anomaly", items: [
          "Check-then-act across two transactions: both read 'free', both insert.",
          "At READ COMMITTED or snapshot isolation neither transaction overwrote the other's row, so nothing aborts.",
          "This is write skew (or a phantom when the conflict is on a row that does not exist yet)."
        ] },
        { title: "Fixes", items: [
          "A unique constraint on (event, seat): the database rejects the second insert. Cheapest and strongest.",
          "SELECT ... FOR UPDATE on the seat row to serialize the check.",
          "SERIALIZABLE isolation with a retry loop on serialization failures."
        ] },
        { title: "Trade-offs", items: [
          "Constraints need the conflict to be expressible as a key.",
          "Row locks reduce concurrency on hot rows and can deadlock if lock order varies.",
          "SERIALIZABLE needs every caller to retry; abort rates rise under contention."
        ] }
      ]
    },
    {
      id: "shard-plan",
      title: "Shard a 6 TB multi-tenant database",
      subtitle: "Partitioning with real constraints.",
      timebox: "40 min",
      prompt: "A single Postgres primary for a B2B SaaS product is near its write ceiling. Tenants range from tiny to one that is 15% of all traffic. Propose a sharding plan and the migration.",
      related: [
        { label: "Partitioning and sharding", route: "#/dist/partition/partitioning-sharding" },
        { label: "Leader and follower", route: "#/dist/replication/leader-follower" },
        { label: "Two-phase commit", route: "#/dist/consensus/two-phase-commit" }
      ],
      outline: [
        { title: "Choose the key", items: [
          "tenant_id keeps nearly every query and transaction on one shard.",
          "Hash for spread, plus a directory so a whale tenant can live on dedicated hardware.",
          "Avoid range on time: every write would hit the newest shard."
        ] },
        { title: "Handle what crosses shards", items: [
          "Global reporting moves to a warehouse fed by change data capture.",
          "Rare cross-tenant writes use a saga or outbox instead of distributed 2PC.",
          "Globally unique ids from a scheme that does not need a central sequence."
        ] },
        { title: "Migrate safely", items: [
          "Dual-read verification, then move tenants one at a time with logical replication.",
          "Cut over per tenant with a short write freeze and a fast rollback path.",
          "Rebalance by moving whole tenants, never by re-hashing everything."
        ] }
      ]
    },
    {
      id: "warehouse-cost",
      title: "Warehouse queries scan the whole table",
      subtitle: "Pruning, clustering and file layout.",
      timebox: "25 min",
      prompt: "A columnar warehouse table of events grows 2 TB a month. Queries filter on the last 7 days and a customer id, yet each one scans most of the table and costs keep rising. Explain why and what you change.",
      related: [
        { label: "Zone maps and pruning", route: "#/col/mpp/zone-maps-pruning" },
        { label: "Row vs column", route: "#/col/columnar/row-vs-column" },
        { label: "Warehouses compared", route: "#/col/mpp/warehouses-compared" }
      ],
      outline: [
        { title: "Why it scans", items: [
          "Min/max metadata only prunes when each file or micro-partition covers a narrow value range.",
          "Late-arriving and backfilled data scatters dates across every partition.",
          "A function on the filter column can hide the predicate from pruning."
        ] },
        { title: "Changes", items: [
          "Cluster or sort on event date (then customer) so ranges become narrow again.",
          "Rewrite filters to compare raw columns to constants.",
          "Select only the needed columns; columnar engines bill by bytes read."
        ] },
        { title: "Verify", items: [
          "Compare partitions scanned to partitions total in the query profile before and after.",
          "Watch the cost of reclustering itself; it is a background write workload."
        ] }
      ]
    }
  ],

  interview: [
    {
      id: "btree-vs-lsm",
      title: "B+tree or LSM tree for this workload?",
      timebox: "10 min",
      prompt: "You are choosing a storage engine for a service that ingests 200,000 small writes per second and serves point reads by key. Compare B+trees and LSM trees and pick one.",
      links: [
        { label: "B-tree vs B+tree", route: "#/store/btree/btree-vs-bplus" },
        { label: "LSM trees", route: "#/store/lsm/lsm-trees" },
        { label: "Compaction", route: "#/store/lsm/compaction" }
      ],
      expected: [
        "Frames the choice as write, read and space amplification, not as 'LSM is faster'.",
        "Explains that B+trees update pages in place (random I/O) while LSMs turn writes into sequential flushes.",
        "Notes that point reads in an LSM may check several levels and that bloom filters cut most of that cost.",
        "Picks LSM for this write-heavy ingest and names the compaction strategy and its cost."
      ],
      followups: [
        "What happens to read latency when compaction falls behind?",
        "How would range scans change your answer?",
        "Where does the write-ahead log fit in each design?"
      ]
    },
    {
      id: "isolation-levels",
      title: "Explain isolation levels with anomalies",
      timebox: "10 min",
      prompt: "Walk me through the standard isolation levels and which anomalies each permits. Then tell me what Postgres actually gives you at each level.",
      links: [
        { label: "Isolation levels", route: "#/txn/acid/isolation-levels" },
        { label: "Anomalies", route: "#/txn/acid/anomalies" },
        { label: "Isolation in real databases", route: "#/txn/practice/isolation-in-real-dbs" }
      ],
      expected: [
        "Defines dirty read, non-repeatable read, phantom, lost update and write skew with a concrete example each.",
        "Separates the SQL standard's definitions from what engines implement.",
        "States that Postgres treats READ UNCOMMITTED as READ COMMITTED, implements REPEATABLE READ as snapshot isolation, and SERIALIZABLE as SSI.",
        "Mentions that applications at SERIALIZABLE must retry on serialization failures."
      ],
      followups: [
        "Why does snapshot isolation still allow write skew?",
        "What does MySQL InnoDB's REPEATABLE READ do differently?",
        "How would you fix write skew without raising the isolation level?"
      ]
    },
    {
      id: "index-design",
      title: "Design indexes for this query set",
      timebox: "12 min",
      prompt: "An orders table has 400 million rows. The hot queries filter by customer_id and status and sort by created_at descending, returning 20 rows. Design the indexes and justify the column order.",
      links: [
        { label: "Composite order", route: "#/idx/basics/composite-order" },
        { label: "Covering indexes", route: "#/idx/basics/covering-indexes" },
        { label: "Index trade-offs", route: "#/idx/design/index-tradeoffs" }
      ],
      expected: [
        "Equality columns first, then the sort column: (customer_id, status, created_at DESC).",
        "Explains that the index delivers rows already ordered, so LIMIT 20 stops early and no sort is needed.",
        "Considers INCLUDE columns for an index-only scan and the visibility-map caveat.",
        "Weighs write amplification and memory for every extra index."
      ],
      followups: [
        "What if status has only three values?",
        "When would a partial index beat this?",
        "How do you prove the index is used in production?"
      ]
    },
    {
      id: "join-choice",
      title: "Why did the optimizer pick a hash join?",
      timebox: "10 min",
      prompt: "Explain how nested-loop, hash and sort-merge joins work, what each costs, and when an optimizer prefers each.",
      links: [
        { label: "Join algorithms", route: "#/qp/joins/join-algorithms" },
        { label: "Cost-based optimizer", route: "#/qp/optimizer/cost-based-optimizer" },
        { label: "Join ordering", route: "#/qp/optimizer/join-ordering" }
      ],
      expected: [
        "Nested loop wins with a small outer side and an index on the inner side.",
        "Hash join builds on the smaller input and wins for large unsorted equi-joins that fit in memory.",
        "Sort-merge wins when inputs are already sorted or for range-style join conditions.",
        "Ties the choice back to cardinality estimates and memory settings."
      ],
      followups: [
        "What happens when the hash table does not fit in memory?",
        "How can a bad estimate turn a nested loop into a disaster?",
        "Why can only nested loop handle arbitrary non-equality conditions?"
      ]
    },
    {
      id: "replication-failover",
      title: "Design failover for a primary database",
      timebox: "12 min",
      prompt: "Your single-primary database must survive the loss of a data center with at most a few seconds of downtime. Design replication and failover, and state what data you may lose.",
      links: [
        { label: "Sync vs async", route: "#/dist/replication/sync-vs-async" },
        { label: "Failover", route: "#/dist/replication/failover" },
        { label: "Raft basics", route: "#/dist/consensus/raft-basics" }
      ],
      expected: [
        "Chooses synchronous replication to at least one remote replica if zero data loss is required, and quantifies the latency cost.",
        "Uses a consensus-backed coordinator to decide who is primary, avoiding split brain.",
        "Fences the old primary before promoting the new one.",
        "Explains how clients find the new primary."
      ],
      followups: [
        "What does asynchronous replication lose on failover?",
        "How do you handle a network partition rather than a crash?",
        "How do replicas serve reads without returning stale data to the writer?"
      ]
    },
    {
      id: "warehouse-internals",
      title: "Why is a columnar warehouse fast for analytics?",
      timebox: "10 min",
      prompt: "Explain why a columnar MPP warehouse answers an aggregate over billions of rows in seconds, and why it is a poor fit for an order-entry workload.",
      links: [
        { label: "Row vs column", route: "#/col/columnar/row-vs-column" },
        { label: "Compression and encoding", route: "#/col/columnar/compression-encoding" },
        { label: "Vectorized execution", route: "#/col/columnar/vectorized-execution" }
      ],
      expected: [
        "Reads only the needed columns, compressed with encodings that suit each column.",
        "Prunes files or micro-partitions using min/max metadata.",
        "Processes batches of values with vectorized operators and spreads work across many nodes.",
        "Explains that single-row inserts and updates rewrite immutable column files, which is expensive."
      ],
      followups: [
        "How does dictionary encoding speed up a GROUP BY?",
        "What is a broadcast join versus a shuffle join?",
        "How do open table formats add snapshots on top of immutable files?"
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Mechanism: can you describe what the engine physically does — pages, logs, versions, locks — not just the API?",
      "Numbers: page sizes, fanout, amplification factors and latency orders of magnitude used correctly.",
      "Trade-offs: every choice stated with what it costs, under which workload.",
      "Diagnosis: a method that moves from symptom to evidence to cause, using the engine's own views and plans.",
      "Precision: anomalies, isolation levels and consistency models named correctly and not conflated."
    ],
    bands: [
      { id: "naive", title: "Naive", summary: "Knows the vocabulary but not the machinery.", signals: [
        "Says 'add an index' without saying which columns, in what order, or what it costs on writes.",
        "Treats isolation levels as a speed dial with no named anomalies.",
        "Describes replication without saying what is lost on failover."
      ] },
      { id: "solid", title: "Solid", summary: "Explains mechanisms correctly and picks sensible defaults.", signals: [
        "Explains B+tree versus LSM in amplification terms.",
        "Reads an EXPLAIN plan and spots an estimate that is off by orders of magnitude.",
        "Names write skew and gives a concrete fix."
      ] },
      { id: "standout", title: "Standout", summary: "Reasons from first principles under new constraints and quantifies.", signals: [
        "Does back-of-envelope I/O math for a join or a scan before choosing.",
        "Anticipates second-order effects: vacuum horizons, compaction debt, hot partitions.",
        "Knows where real engines deviate from the textbook and why."
      ] }
    ]
  },

  cheatsheets: [
    {
      id: "numbers",
      title: "Numbers worth knowing",
      summary: "Orders of magnitude that make back-of-envelope answers credible.",
      items: [
        "Page size: Postgres 8 KB, InnoDB 16 KB, SQLite 4 KB by default.",
        "B+tree fanout of a few hundred keys per inner page means 3–4 levels cover billions of rows.",
        "Main memory reference is on the order of 100 ns; a random NVMe read is on the order of 100 µs; a spinning-disk seek is milliseconds.",
        "Sequential reads beat random reads by one to two orders of magnitude on most storage.",
        "Leveled LSM compaction with a size ratio of 10 commonly sees write amplification in the tens."
      ]
    },
    {
      id: "isolation",
      title: "Isolation levels at a glance",
      summary: "What each level stops, and what real engines do.",
      items: [
        "READ COMMITTED: no dirty reads; non-repeatable reads, phantoms, lost updates and write skew possible. Postgres default.",
        "REPEATABLE READ: in Postgres, snapshot isolation; blocks lost updates by aborting, still allows write skew. InnoDB default, with different locking behaviour.",
        "SERIALIZABLE: as if transactions ran one at a time. Postgres uses SSI and aborts on dangerous patterns; retry is mandatory.",
        "Fix write skew with constraints, SELECT ... FOR UPDATE on the rows that matter, or SERIALIZABLE."
      ]
    },
    {
      id: "explain",
      title: "Reading an EXPLAIN plan",
      summary: "The five checks that find most problems.",
      items: [
        "Read inside out: the deepest, most indented nodes run first.",
        "Compare estimated rows to actual rows; a 100x gap is the usual root cause.",
        "Multiply per-loop numbers by loops before judging a nested-loop inner side.",
        "Seq Scan on a big table with a selective filter suggests a missing or unusable index.",
        "Sort or hash spilling to disk means work_mem is too small for that node."
      ]
    },
    {
      id: "index-rules",
      title: "Index design rules",
      summary: "Decisions that hold up in production.",
      items: [
        "Equality columns first, then range or sort columns.",
        "An index only helps a predicate that compares the raw column; wrap the constant, not the column.",
        "Covering indexes avoid heap lookups; index-only scans in Postgres also need an up-to-date visibility map.",
        "Every index costs write amplification, memory and vacuum time — drop unused ones.",
        "Partial indexes shine when queries always target a small, well-defined subset."
      ]
    },
    {
      id: "postgres-ops",
      title: "Postgres operations",
      summary: "Defaults and views you will be asked about.",
      items: [
        "Autovacuum triggers at 50 dead rows plus 20% of the table by default; lower the scale factor for big hot tables.",
        "pg_stat_activity for what is running, pg_stat_statements for what is expensive, pg_locks for who blocks whom.",
        "Each connection is a backend process; pool connections rather than raising max_connections.",
        "work_mem is per sort or hash node, per query — not per server.",
        "Set lock_timeout before DDL so a blocked ALTER TABLE does not queue every other query behind it."
      ]
    },
    {
      id: "distribution",
      title: "Replication and distribution",
      summary: "The trade-offs in one place.",
      items: [
        "Async replication: fast commits, data loss window on failover. Sync: no loss, commit waits for a replica.",
        "Quorums: R + W > N gives overlap between read and write sets.",
        "Raft commits an entry once a majority stores it; a 5-node cluster tolerates 2 failures.",
        "2PC is atomic but blocks if the coordinator fails after prepare.",
        "Hash partitioning spreads load; range partitioning keeps scans local but risks hot spots."
      ]
    }
  ],

  glossary: [
    { id: "page", term: "Page", definition: "The fixed-size unit a database reads, writes and caches, typically 4–16 KB.", useIt: "Reason about I/O in pages touched, not rows returned.", links: [{ label: "Disk and pages", route: "#/store/pages/disk-and-pages" }] },
    { id: "slotted-page", term: "Slotted page", definition: "A page layout with a header, a slot array of offsets growing from one end and tuples growing from the other.", useIt: "Explain how a row can move within a page without changing its external identifier.", links: [{ label: "Slotted pages", route: "#/store/pages/slotted-pages" }] },
    { id: "bplus-tree", term: "B+tree", definition: "A balanced tree whose inner pages hold only separator keys and whose leaves hold all keys, linked for range scans.", useIt: "Quote fanout to show why lookups take only three or four page reads.", links: [{ label: "B-tree vs B+tree", route: "#/store/btree/btree-vs-bplus" }] },
    { id: "lsm-tree", term: "LSM tree", definition: "A write-optimized structure that buffers writes in memory, flushes immutable sorted files and merges them in the background.", useIt: "Contrast its sequential writes with a B+tree's in-place updates.", links: [{ label: "LSM trees", route: "#/store/lsm/lsm-trees" }] },
    { id: "write-amplification", term: "Write amplification", definition: "Bytes physically written to storage per byte of logical data written by the application.", useIt: "Compare storage engines and compaction policies with it.", links: [{ label: "Compaction", route: "#/store/lsm/compaction" }] },
    { id: "wal", term: "Write-ahead log", definition: "An append-only log where every change is recorded and flushed before the modified data pages are written.", useIt: "Explain why commit can be one sequential flush rather than many random writes.", links: [{ label: "Write-ahead log", route: "#/store/durability/write-ahead-log" }] },
    { id: "buffer-pool", term: "Buffer pool", definition: "The database's in-memory cache of pages, with its own replacement policy and dirty-page tracking.", useIt: "Mention it when explaining why the second run of a query is faster.", links: [{ label: "Buffer pool", route: "#/store/durability/buffer-pool" }] },
    { id: "covering-index", term: "Covering index", definition: "An index containing every column a query needs, so the base table never has to be read.", useIt: "Propose it for hot read paths and name its write cost.", links: [{ label: "Covering indexes", route: "#/idx/basics/covering-indexes" }] },
    { id: "cardinality", term: "Cardinality estimate", definition: "The optimizer's prediction of how many rows an operator will produce.", useIt: "Blame bad plans on bad estimates, then show the evidence in EXPLAIN ANALYZE.", links: [{ label: "Statistics and cardinality", route: "#/qp/optimizer/statistics-cardinality" }] },
    { id: "sargable", term: "Sargable predicate", definition: "A predicate written so an index can be used to find matching rows, typically a raw column compared to a constant.", useIt: "Rewrite a function-wrapped filter into a range on the raw column.", links: [{ label: "Sargable rewrites", route: "#/sql/perf/sargable-rewrites" }] },
    { id: "mvcc", term: "MVCC", definition: "Multi-version concurrency control: writers create new row versions so readers see a consistent snapshot without blocking.", useIt: "Explain why readers do not block writers and why vacuum exists.", links: [{ label: "MVCC", route: "#/txn/control/mvcc" }] },
    { id: "write-skew", term: "Write skew", definition: "An anomaly where two transactions read overlapping data, make disjoint writes based on it, and together break an invariant.", useIt: "Use the on-call doctors or double-booking example and give a fix.", links: [{ label: "Anomalies", route: "#/txn/acid/anomalies" }] },
    { id: "ssi", term: "Serializable snapshot isolation", definition: "Snapshot isolation plus tracking of read-write dependencies, aborting a transaction when a dangerous pattern appears.", useIt: "Say that it gives true serializability without read locks, at the cost of retries.", links: [{ label: "SSI", route: "#/txn/control/ssi" }] },
    { id: "two-pl", term: "Two-phase locking", definition: "A protocol where a transaction acquires locks in a growing phase and releases them only in a shrinking phase, guaranteeing serializability.", useIt: "Contrast it with MVCC: readers and writers block each other.", links: [{ label: "Two-phase locking", route: "#/txn/control/two-phase-locking" }] },
    { id: "quorum", term: "Quorum", definition: "A minimum number of replicas that must acknowledge a read or write; with R + W > N the sets overlap.", useIt: "Tune R and W per workload and state the availability cost.", links: [{ label: "Quorums", route: "#/dist/partition/quorums" }] },
    { id: "raft", term: "Raft", definition: "A consensus algorithm that elects a leader per term and commits log entries once a majority stores them.", useIt: "Explain why a five-node cluster survives two failures.", links: [{ label: "Raft basics", route: "#/dist/consensus/raft-basics" }] },
    { id: "vacuum", term: "VACUUM", definition: "Postgres maintenance that removes dead tuple versions no snapshot can see and updates the visibility map and freeze state.", useIt: "Tie table bloat to long transactions that hold back what vacuum may remove.", links: [{ label: "Vacuum basics", route: "#/pg/vacuum/vacuum-basics" }] },
    { id: "zone-map", term: "Zone map", definition: "Per-block min/max metadata that lets a scan skip blocks whose range cannot match the predicate.", useIt: "Explain why clustering data on the filter column makes warehouse queries cheaper.", links: [{ label: "Zone maps and pruning", route: "#/col/mpp/zone-maps-pruning" }] },
    { id: "vectorized", term: "Vectorized execution", definition: "Operators that process batches of column values per call instead of one row at a time, improving CPU cache use and enabling SIMD.", useIt: "Contrast it with the iterator model's per-row function-call overhead.", links: [{ label: "Vectorized execution", route: "#/col/columnar/vectorized-execution" }] },
    { id: "lock-escalation", term: "Lock escalation", definition: "Trading many row or page locks held by one statement on one object for a single table lock, to save lock-manager memory.", useIt: "Explain why a large SQL Server DELETE suddenly blocked the whole table, and batch it.", links: [{ label: "Lock modes and granularity", route: "#/txn/control/lock-granularity-occ" }] },
    { id: "runtime-filter", term: "Runtime filter", definition: "A bloom filter or key range built from the surviving join keys on a hash join's build side and pushed into the probe-side scan.", useIt: "Explain why a selective dimension filter can skip most of a fact table.", links: [{ label: "Adaptive execution and runtime filters", route: "#/qp/joins/adaptive-execution" }] },
    { id: "hnsw", term: "HNSW", definition: "A layered neighbour-graph index for approximate nearest-neighbour search over vectors, tuned with M, ef_construction and ef_search.", useIt: "Trade recall@k against latency and memory when designing semantic search.", links: [{ label: "Vector indexes", route: "#/idx/beyond/vector-indexes" }] },
    { id: "cdc", term: "Change data capture", definition: "Reading committed row changes from the database's own log and publishing them as ordered events.", useIt: "Keep caches, search indexes and warehouses in sync without polling, and pair it with an outbox.", links: [{ label: "Change data capture", route: "#/dist/replication/cdc-logical-decoding" }] },
    { id: "hlc", term: "Hybrid logical clock", definition: "A timestamp combining the largest physical time seen with a logical counter, monotonic and causality-respecting while staying near wall time.", useIt: "Explain how CockroachDB orders transactions without atomic clocks.", links: [{ label: "Physical time and HLC", route: "#/dist/time/hybrid-clocks" }] },
    { id: "crdt", term: "CRDT", definition: "A replicated data type whose merge is commutative, associative and idempotent, so replicas converge without coordination.", useIt: "Propose it for active-active counters, sets or collaborative documents, and name the invariants it cannot enforce.", links: [{ label: "CRDTs", route: "#/dist/time/crdts" }] },
    { id: "window-function", term: "Window function", definition: "A function computed over a set of rows related to the current row, without collapsing them into one group.", useIt: "Solve top-N per group or running totals without a self-join.", links: [{ label: "Window basics", route: "#/sql/windows/window-basics" }] }
  ]
};
