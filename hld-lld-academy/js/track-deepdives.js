/* =====================================================================
   BLUEPRINT · Technology Deep Dives
   window.TRACKS.deepdives  ·  window.QUIZZES["deepdives-*"]
   window.Widgets.deepBloomLab

   Self-contained: this file registers its own track, quizzes and widget.
   Merges (never reassigns) the shared QUIZZES / Widgets namespaces.
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     WIDGETS OWNED BY THIS FILE
     ================================================================= */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      var v = attrs[k];
      if (v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  }

  /* ---------------------------------------------------------------
     deepBloomLab — Bloom filter sizing calculator
     m = -n * ln(p) / (ln 2)^2      bits
     k = (m / n) * ln 2             optimal hash count
     p_achieved = (1 - e^(-k*n/m))^k
  --------------------------------------------------------------- */
  Widgets.deepBloomLab = function (mount) {
    shell(mount, "calculator", "Size a Bloom filter",
      "Set how many keys you expect and the false-positive rate you can live with. " +
      "The filter's size falls straight out of those two numbers — the size of the keys themselves never enters the formula.");

    var LN2 = 0.6931471805599453;
    var LN2SQ = LN2 * LN2;
    var inputs = {};
    var kMode = "optimal";
    var notes = [];

    /* ---- safe numeric read: never returns NaN, Infinity, or out-of-range ---- */
    function readNum(name, fallback, lo, hi) {
      var raw = inputs[name] ? String(inputs[name].value) : "";
      var v = Number(raw);
      /* v !== v catches NaN; the comparisons reject Infinity and blank input */
      if (raw.replace(/\s+/g, "") === "" || v !== v || v === Infinity || v === -Infinity) {
        notes.push("using default for " + name);
        return fallback;
      }
      if (v < lo) { notes.push(name + " clamped up to " + lo); return lo; }
      if (v > hi) { notes.push(name + " clamped down to " + hi); return hi; }
      return v;
    }

    function group(x) {
      var s = String(Math.round(x));
      var out = "", c = 0;
      for (var i = s.length - 1; i >= 0; i--) {
        out = s.charAt(i) + out;
        c++;
        if (c % 3 === 0 && i > 0) out = "," + out;
      }
      return out;
    }
    function bytesLabel(b) {
      if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
      if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB";
      if (b >= 1024) return (b / 1024).toFixed(2) + " KB";
      return group(b) + " B";
    }
    function pctLabel(x) {
      if (x >= 0.01) return (x * 100).toFixed(2) + "%";
      if (x >= 0.00001) return (x * 100).toFixed(4) + "%";
      return (x * 100).toExponential(2) + "%";
    }
    function oneIn(x) {
      if (!(x > 0)) return "never";
      return "1 in " + group(1 / x);
    }

    function field(name, label, def, step, min) {
      var input = h("input", {
        type: "number",
        min: String(min),
        step: step,
        value: String(def),
        style: "width:104px"
      });
      input.value = String(def);
      input.addEventListener("input", paint);
      input.addEventListener("change", paint);
      inputs[name] = input;
      return h("label", { class: "w-field" }, label + " ", input);
    }

    function card(title, value, detail, accent) {
      return h("div", {
        class: "lru-cell",
        style: "width:min(100%, 210px);height:auto;min-height:112px;padding:14px;text-align:left;display:block;border-color:" + accent
      },
        h("div", { class: "srv-name", style: "margin-bottom:8px" }, title),
        h("div", { class: "srv-count", style: "color:oklch(from " + accent + " var(--ink-l) c h);font-size:1.4rem" }, value),
        h("div", { class: "srv-weight", style: "margin-top:8px;line-height:1.35" }, detail)
      );
    }

    var controls = h("div", { class: "widget-controls" },
      field("items", "expected keys", 1000000, "1000", 1),
      field("fpp", "target false-positive %", 1, "0.1", 0),
      field("keyBytes", "avg key size (bytes)", 32, "1", 1)
    );

    var seg = h("div", { class: "w-seg" });
    var segButtons = [];
    [["optimal", "k = optimal"], ["1", "k = 1"], ["3", "k = 3"], ["7", "k = 7"], ["14", "k = 14"]]
      .forEach(function (pair, idx) {
        var b = h("button", { class: "w-seg-btn" + (idx === 0 ? " active" : "") }, pair[1]);
        b.addEventListener("click", function () {
          kMode = pair[0];
          for (var j = 0; j < segButtons.length; j++) segButtons[j].classList.remove("active");
          b.classList.add("active");
          paint();
        });
        segButtons.push(b);
        seg.appendChild(b);
      });

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      notes = [];

      var n = readNum("items", 1000000, 1, 1e12);
      var fppPct = readNum("fpp", 1, 0.0000001, 50);
      var keyBytes = readNum("keyBytes", 32, 1, 4096);
      var p = fppPct / 100;

      var m = Math.ceil((-n * Math.log(p)) / LN2SQ);
      if (!(m > 0)) m = 1;
      var bitsPerItem = m / n;
      var kOptimal = Math.max(1, Math.round(bitsPerItem * LN2));
      var k = kMode === "optimal" ? kOptimal : Math.max(1, parseInt(kMode, 10) || 1);

      /* achieved rate for the k actually chosen, not the ideal k */
      var achieved = Math.pow(1 - Math.exp((-k * n) / m), k);
      if (!(achieved >= 0)) achieved = 0;
      if (achieved > 1) achieved = 1;

      var filterBytes = Math.ceil(m / 8);
      var exactBytes = n * keyBytes;
      var ratio = exactBytes / Math.max(1, filterBytes);

      stage.innerHTML = "";
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px" },
        card("Bit array (m)", group(m) + " bits",
          "m = \u2212n \u00d7 ln(p) \u00f7 (ln 2)\u00b2", "var(--accent)"),
        card("Memory", bytesLabel(filterBytes),
          "one flat array, no keys stored", "var(--cyan)"),
        card("Bits per key", bitsPerItem.toFixed(2),
          "independent of how long the keys are", "var(--violet)"),
        card("Hashes (k)", String(k),
          kMode === "optimal"
            ? "optimal for this m/n ratio"
            : "you forced k; optimal here is " + kOptimal,
          "var(--amber)"),
        card("Achieved FP rate", pctLabel(achieved),
          oneIn(achieved) + " lookups returns a false hit", "var(--rose)"),
        card("Versus exact set", ratio >= 1 ? ratio.toFixed(1) + "\u00d7 smaller" : (1 / ratio).toFixed(1) + "\u00d7 larger",
          "exact keys would need " + bytesLabel(exactBytes), "var(--cyan-deep)")
      ));

      readout.innerHTML = "";
      readout.appendChild(h("span", { class: "ro" }, "keys ", h("b", {}, group(n))));
      readout.appendChild(h("span", { class: "ro" }, "target ", h("b", {}, pctLabel(p))));
      readout.appendChild(h("span", { class: "ro" }, "achieved ", h("b", {}, pctLabel(achieved))));
      readout.appendChild(h("span", { class: "ro" }, "m ", h("b", {}, group(m) + " bits")));
      readout.appendChild(h("span", { class: "ro" }, "size ", h("b", {}, bytesLabel(filterBytes))));
      readout.appendChild(h("span", { class: "ro" }, "bits/key ", h("b", {}, bitsPerItem.toFixed(2))));
      readout.appendChild(h("span", { class: "ro" }, "k ", h("b", {}, String(k))));
      readout.appendChild(h("span", { class: "ro" }, "vs exact ",
        h("b", {}, ratio >= 1 ? ratio.toFixed(1) + "\u00d7 smaller" : (1 / ratio).toFixed(1) + "\u00d7 larger")));
      if (k !== kOptimal) {
        readout.appendChild(h("span", { class: "ro" }, "note ",
          h("b", {}, k < kOptimal ? "too few hashes \u2014 bits wasted" : "too many hashes \u2014 array saturates")));
      }
      if (notes.length) {
        readout.appendChild(h("span", { class: "ro" }, "input ", h("b", {}, notes[0])));
      }
    }

    mount.appendChild(controls);
    mount.appendChild(h("div", { class: "widget-controls" }, seg));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =================================================================
     QUIZZES OWNED BY THIS FILE
     ================================================================= */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {

    "deepdives-stores": {
      title: "Datastores checkpoint",
      sub: "Postgres, Cassandra, DynamoDB, Redis and Elasticsearch — mechanisms and ceilings.",
      questions: [
        {
          q: "Under Postgres MVCC, what does an UPDATE physically do to a row?",
          options: [
            "Overwrites the row in place and blocks readers until the transaction commits",
            "Appends only to the write-ahead log; the table is reconstructed at read time",
            "Writes a new row version and leaves the old one visible to older snapshots",
            "Marks the row dirty and defers the change until the next VACUUM"
          ],
          answer: 2,
          explain: "Postgres never overwrites a live row. An update inserts a new version and marks the old one dead for transactions whose snapshot started later, which is exactly why readers never block writers and writers never block readers. The cost is that dead versions accumulate until VACUUM reclaims them, so update-heavy tables bloat and their indexes grow."
        },
        {
          q: "A Cassandra keyspace has replication factor 3 (N = 3) and you write at QUORUM. What is the weakest read consistency level that still guarantees you see that acknowledged write?",
          options: [
            "ONE — R + W = 3",
            "ANY — replication makes the read level irrelevant",
            "ALL — R + W = 5",
            "QUORUM — R + W = 4"
          ],
          answer: 3,
          explain: "The overlap rule is R + W > N. With N = 3 and W = QUORUM = 2, you need R > 1, so R = 2 = QUORUM is the weakest level that forces the read set and the write set to share at least one replica. ONE gives R + W = 3, which is not greater than 3, so a read can legally hit the one replica that missed the write."
        },
        {
          q: "Cassandra buffers writes in a memtable and flushes immutable SSTables to disk. What is the direct consequence for reads?",
          options: [
            "A read may have to consult several SSTables, so read amplification rises until compaction merges them",
            "Reads are faster than a B-tree because every SSTable is sorted",
            "Reads always touch exactly one SSTable, because the partition key selects it",
            "Reads never touch disk, because the memtable holds the whole partition"
          ],
          answer: 0,
          explain: "An LSM engine makes writes cheap by only ever appending — but a given partition's rows can then be spread across the memtable and many SSTables at once. A read has to merge all of those, which is why each SSTable carries its own Bloom filter and why compaction exists. Compaction is not housekeeping you can skip; it is what keeps read amplification bounded, and it costs disk and I/O to run."
        },
        {
          q: "You model a sensor feed as PRIMARY KEY ((sensor_id), reading_time), with readings arriving every second and retained for years. What is the defect?",
          options: [
            "Clustering by time prevents range queries over a single sensor",
            "The partition for a busy sensor grows without bound, concentrating load and eventually failing",
            "Cassandra cannot use a timestamp as a clustering key",
            "Every read would require ALLOW FILTERING"
          ],
          answer: 1,
          explain: "A partition lives entirely on its replica set, so an unbounded partition means one set of nodes absorbs unbounded data and unbounded traffic for that sensor. Compaction, repair and reads all degrade as the partition grows. The fix is a compound partition key that adds a time bucket, such as ((sensor_id, day), reading_time), which caps each partition's size by construction."
        },
        {
          q: "Why does single-table design exist in DynamoDB?",
          options: [
            "It is cheaper, because DynamoDB bills a fixed fee per table",
            "DynamoDB enforces a hard limit of one table per account",
            "There are no joins, so co-locating related entities under one partition key lets a single Query return the whole object graph",
            "It is the only way to get strongly consistent reads"
          ],
          answer: 2,
          explain: "DynamoDB gives you fast access to one item collection at a time and nothing that resembles a join. Single-table design overloads generic key attributes so that an order and its line items and its shipment share a partition key and differ only by sort key, which turns what would be three round trips into one Query. The price is that the keys stop being self-describing and you must know every access pattern before you design the keys."
        },
        {
          q: "Redis executes commands on a single thread. What does that buy you, and what does it cost?",
          options: [
            "Buys multi-key transactions across a cluster; costs you latency",
            "Buys linear scaling with CPU cores; costs you weaker consistency",
            "Buys durability without fsync; costs you memory",
            "Buys atomic individual commands with no locking; costs you a full stall whenever one command is O(N) over a huge collection"
          ],
          answer: 3,
          explain: "Because one command runs at a time, every command is effectively atomic and you never need a lock to do read-modify-write on a single key. The same property means the server has no way to work around a slow command: one scan over a million-member set makes every other client wait behind it. That is why the operational rule is to keep individual commands small and bounded."
        },
        {
          q: "A teammate proposes Redis as the system of record for payment records, with append-only-file persistence enabled. What is the accurate objection?",
          options: [
            "The common fsync policy and asynchronous replication mean an acknowledged write can still be lost in a crash or a failover",
            "The append-only file records reads, not writes, so it cannot rebuild state",
            "Redis has no mechanism to persist anything to disk",
            "Redis cannot hold more than 512 MB of data in total"
          ],
          answer: 0,
          explain: "Redis can persist, but the default posture trades durability for speed: the append-only file is typically synced about once a second, and replicas acknowledge nothing before the primary replies to the client. A crash or an automatic failover can therefore drop writes the client was already told succeeded. That is acceptable for a cache or a leaderboard and unacceptable for money."
        },
        {
          q: "Why is Elasticsearch described as near-real-time, and what does that imply architecturally?",
          options: [
            "Indexing is synchronous but query results are cached for a second",
            "A document becomes searchable only once the buffer is refreshed into a new segment — about a second by default — so treat it as a secondary index fed from a system of record",
            "It batches queries rather than writes, so reads lag behind",
            "Replication is synchronous and adds a fixed one-second delay to every write"
          ],
          answer: 1,
          explain: "Lucene segments are immutable, so a newly indexed document is invisible to search until a refresh rolls the in-memory buffer into a new segment. That refresh is cheap but not free, which is why it is periodic rather than per-document. Since you also give up cross-document transactions and joins, the safe pattern is to own the truth elsewhere and rebuild the index from it whenever the mapping changes."
        }
      ]
    },

    "deepdives-streams": {
      title: "Streaming & coordination checkpoint",
      sub: "Kafka, Flink, ZooKeeper and the API gateway — guarantees stated precisely.",
      questions: [
        {
          q: "What ordering guarantee does Kafka actually give you?",
          options: [
            "Total order across the topic, as long as producers use acks=all",
            "Total order across the topic, as long as there is exactly one consumer group",
            "Order within a partition only — records sharing a key land in the same partition and stay ordered relative to each other",
            "Order by producer timestamp across every partition"
          ],
          answer: 2,
          explain: "A Kafka partition is an append-only log with monotonically increasing offsets, and that is the only scope in which order exists. Records in different partitions have no defined relative order at all, no matter what the acks setting is. This is why key selection is a design decision: keying by account id preserves per-account order, while keying by request id destroys it."
        },
        {
          q: "A topic has 6 partitions. You add a tenth consumer to the consumer group. What happens?",
          options: [
            "Throughput rises by roughly 60% as partitions are subdivided",
            "The group splits into two independent groups",
            "Kafka automatically creates four more partitions",
            "Four consumers sit idle — a partition is assigned to at most one consumer in the group"
          ],
          answer: 3,
          explain: "Within a consumer group, each partition has exactly one owner, so partition count is a hard ceiling on consumer parallelism. Adding consumers beyond that only adds idle processes and one more rebalance. If you need more parallelism you must raise the partition count, which is a decision to make early because increasing it later changes which partition an existing key hashes to."
        },
        {
          q: "Your consumer commits offsets after it finishes processing each batch. Which delivery semantics do you have?",
          options: [
            "At-least-once — a crash after processing but before committing replays the batch, so consumers must be idempotent",
            "At-most-once, because a crash discards the batch",
            "Exactly-once, because the commit strictly follows the work",
            "No guarantee of any kind"
          ],
          answer: 0,
          explain: "Committing after processing means the only failure window is 'work done, offset not recorded', which on restart replays records you already handled. That is at-least-once, and it is the right default. Committing before processing would flip the window and give you at-most-once, losing records instead of duplicating them; neither ordering of the two steps is atomic, which is why idempotent handlers are the real fix."
        },
        {
          q: "A mobile client buffers events while offline and uploads them an hour later. You need per-minute counts that place each event in the minute it actually happened. What do you need?",
          options: [
            "Processing-time windows with a larger buffer",
            "Event-time windows with watermarks, plus allowed lateness or a side output for stragglers",
            "A single-partition topic so that ordering becomes total",
            "Exactly-once checkpointing, which reorders events by timestamp"
          ],
          answer: 1,
          explain: "Processing-time windows bucket by when the operator saw the record, so an hour-late upload would land in the wrong minute entirely. Event-time windows bucket by the timestamp carried in the record, and watermarks are the mechanism that decides when a window has waited long enough to emit. The trade-off is direct: more watermark slack catches more stragglers but delays every result by that much."
        },
        {
          q: "Which workload belongs in ZooKeeper?",
          options: [
            "Session objects for ten million logged-in users",
            "An event stream running at a hundred thousand messages per second",
            "The current leader and the shard-assignment map for a cluster of twenty services",
            "Product catalogue documents queried by arbitrary attributes"
          ],
          answer: 2,
          explain: "ZooKeeper routes every write through a leader and replicates it by consensus, which makes writes correct and totally ordered but caps throughput and keeps the practical data size small. That is exactly the right shape for a small amount of metadata that many processes must agree on. Anything high-volume, large, or query-shaped belongs in a real datastore, with ZooKeeper holding only the pointer to it."
        },
        {
          q: "Flink checkpoints restore operator state and rewind sources after a failure. What does that give you at an external sink?",
          options: [
            "Exactly-once effects on any sink, automatically",
            "Nothing beyond faster recovery",
            "At-most-once effects, because checkpoints discard in-flight records",
            "Exactly-once state inside the job; exactly-once effects require a transactional two-phase-commit sink or an idempotent one"
          ],
          answer: 3,
          explain: "A checkpoint is a consistent snapshot of the job's own state plus the source positions that produced it, so recovery reprocesses records deterministically inside the job. The outside world is not part of that snapshot: rows already written to a database during the replayed window will be written again. Exactly-once effects therefore need the sink to participate, either by committing transactionally with the checkpoint or by making repeated writes harmless."
        },
        {
          q: "Your API gateway configuration has grown to include discount eligibility rules and order-state validation. What is the problem?",
          options: [
            "Business logic at the edge makes the gateway a shared deployment bottleneck and splits one domain across two codebases",
            "Gateways cannot express conditional logic",
            "It measurably increases TLS handshake cost",
            "Rate limiting stops functioning once routes carry logic"
          ],
          answer: 0,
          explain: "The gateway is shared by every team and sits on the critical path of every request, so any change to it is a change with global blast radius and a queue of reviewers. Once domain rules live there, the team that owns orders can no longer reason about order behaviour by reading the order service. Keep the gateway to cross-cutting concerns — routing, authentication, quotas, observability — and push anything a product manager would recognise back into a service."
        }
      ]
    },

    "deepdives-specialized": {
      title: "Specialized stores checkpoint",
      sub: "Geospatial, time series, vectors, sketches and change data capture.",
      questions: [
        {
          q: "You find nearby drivers by computing the rider's geohash prefix and fetching that cell. Riders report that obviously close drivers are missing. Why?",
          options: [
            "Geohash prefixes cannot be indexed",
            "A driver metres away can fall in an adjacent cell, so you must also query the surrounding neighbour cells and then filter by true distance",
            "A geohash encodes longitude only",
            "The prefix length must match the earth's radius in kilometres"
          ],
          answer: 1,
          explain: "A geohash prefix names a rectangle, and two points either side of a rectangle's edge get different prefixes no matter how close they are. The standard fix is to query the containing cell plus its eight neighbours, which guarantees full coverage out to the cell size, then compute real distances on the candidate set and sort. Skipping the neighbour step produces a search that works in testing and silently drops results at every boundary in production."
        },
        {
          q: "What most often kills a metrics system?",
          options: [
            "Too many dashboards querying at the same time",
            "Storing values as floats instead of integers",
            "Cardinality — putting an unbounded value such as a user id or request id into a label creates a separate series per value",
            "Retention windows that are configured too short"
          ],
          answer: 2,
          explain: "A series is identified by its metric name plus the full set of label values, so every distinct combination is a separate indexed stream with its own in-memory head chunk. One well-meant label like user_id turns a handful of series into millions and the ingest node runs out of memory. Unbounded identifiers belong in logs and traces, which are built for high cardinality; metric labels must be a small, enumerable set."
        },
        {
          q: "Why do time-series stores partition by time rather than by, say, metric name?",
          options: [
            "Metric names are not guaranteed unique",
            "It is what guarantees exactly-once ingestion",
            "Time partitioning is the only way to build an index on a timestamp",
            "Writes always land in the newest chunk, and older chunks become read-only so they can be compressed, rolled up, or dropped whole"
          ],
          answer: 3,
          explain: "The workload is append-at-the-head, so time partitioning keeps the write-hot region small enough to stay in memory while everything behind it stops changing. Immutable older chunks can then be aggressively compressed with delta and XOR encodings, replaced by rollups, and expired with a metadata operation instead of a mass delete. Dropping a partition is close to free; deleting a billion rows by predicate is not."
        },
        {
          q: "You increase the number of clusters probed, or the search-beam width, in an approximate nearest-neighbour index. What happens?",
          options: [
            "Recall improves and query latency rises — that is the knob",
            "Recall improves and latency falls",
            "Recall is unchanged and only memory grows",
            "The embeddings themselves are recomputed"
          ],
          answer: 0,
          explain: "Approximate indexes work by examining a small, cleverly chosen subset of the vectors, and the search parameter controls how large that subset is. Examining more of the space finds more of the true nearest neighbours and costs proportionally more time. There is no universally correct setting, so you pick a recall target, measure recall against an exact brute-force baseline on a sample, and tune until latency and recall are both acceptable."
        },
        {
          q: "You want the 10 nearest vectors that also have status = 'active', where only 0.5% of documents are active. What is the honest difficulty?",
          options: [
            "Metadata filters cannot be applied to vector indexes at all",
            "Post-filtering an approximate search can return far fewer than 10 results, while pre-filtering leaves a candidate set the approximate index cannot traverse efficiently",
            "Filters force the index to be rebuilt on every query",
            "Cosine similarity cannot be combined with an equality predicate"
          ],
          answer: 1,
          explain: "The approximate index is built over the whole collection, so its graph or cluster structure does not know about your predicate. Searching first and filtering after can leave you with almost nothing when the predicate is selective, while filtering first produces a small set that the index has no efficient path through, pushing you toward a brute-force scan. Engines mitigate this with filtered traversal, but recall degrades as selectivity rises, so measure it rather than assuming it works."
        },
        {
          q: "A Bloom filter reports that a key is present. What do you actually know?",
          options: [
            "The key is definitely present",
            "The key is definitely absent, because the filter is inverted",
            "The key may be present — only a 'not present' answer is certain",
            "Nothing; both answers are equally probabilistic"
          ],
          answer: 2,
          explain: "Adding a key sets k specific bits, so if any of a query's k bits is zero the key was certainly never added — that answer is exact and there are no false negatives. If all k bits are set, they may have been set by a combination of other keys, which is a false positive. The whole design is that asymmetry: a 'no' is proof, a 'yes' is a hint that justifies the expensive lookup."
        },
        {
          q: "A service writes an order row to Postgres and then publishes an OrderCreated event to Kafka. Sometimes the row exists with no matching event. What fixes it?",
          options: [
            "Publish to Kafka first, then write the row",
            "Wrap both operations in a distributed transaction spanning Postgres and Kafka",
            "Retry the publish inside a finally block",
            "Insert the event into an outbox table in the same local transaction as the order, and have a relay publish from that table"
          ],
          answer: 3,
          explain: "The bug is the dual write: two independent systems cannot be updated atomically, so any crash between them leaves them disagreeing, and reversing the order just changes which way they disagree. The outbox pattern removes the second system from the critical path by making the event a row in the same transaction as the business data, so both commit or neither does. A separate relay then publishes at-least-once from that table, which is why consumers must still be idempotent."
        }
      ]
    }
  });

  /* =================================================================
     TRACK REGISTRATION
     ================================================================= */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.deepdives = {
    id: "deepdives",
    name: "Technology Deep Dives",
    short: "DEEP",
    tagline: "Name the technology, defend the choice",
    color: "#38bdf8",
    blurb: "Concepts get you to 'we need a cache'. This track gets you to 'Redis, because the leaderboard is a sorted set and I can live with losing a second of writes'. Fourteen technologies, each reduced to the one internal design decision that explains its behaviour, the workloads it genuinely wins, the scale at which it stops working, and the sentence that answers the interviewer's real question: why this and not the obvious alternative?",
    modules: [

      /* ==================== MODULE 1 · DATASTORES ==================== */
      {
        id: "stores",
        name: "Datastores",
        icon: "database",
        lessons: [

          /* ---------------- 1. POSTGRES ---------------- */
          {
            id: "postgres",
            title: "PostgreSQL: the default you have to argue your way out of",
            summary: "B-trees, MVCC, isolation levels and replicas — plus the honest ceiling that makes people leave.",
            minutes: 11,
            tags: ["sql", "postgres", "transactions"],
            blocks: [
              { t: "p", html: "Start here, because Postgres is the answer until you can say precisely why it isn't. It is a single-writer relational database that gives you real transactions, a query planner that will join whatever you ask it to join, constraints the database itself enforces, and an index type that answers both point lookups and range scans. In an interview, reaching for something exotic on slide one without ruling this out reads as pattern-matching rather than reasoning." },
              { t: "p", html: "The mental model: <strong>one machine owns the truth</strong>. Every write goes through a single primary, is recorded in a write-ahead log, and is then shipped to replicas that can serve reads. Everything good about Postgres and everything limiting about it follows from that single sentence." },

              { t: "h", text: "The core mechanism: MVCC over a write-ahead log" },
              { t: "p", html: "Postgres never overwrites a live row. An <code class='tok'>UPDATE</code> writes a <em>new version</em> of the row and marks the old version dead as of the current transaction id. Every transaction sees a snapshot: the set of row versions that were committed when it started. This is <strong>multi-version concurrency control</strong>, and it is why readers never block writers and writers never block readers." },
              { t: "p", html: "Durability is separate and simpler: before any change reaches a data file it is appended to the <strong>write-ahead log</strong> and flushed. Crash recovery replays the log. Replication is the same log streamed to another machine. One mechanism gives you durability, recovery and replicas." },
              {
                t: "code", lang: "text", code:
                  "T1 begins  (snapshot: xid < 100 is visible)\n" +
                  "T2 UPDATE accounts SET balance = 50 WHERE id = 7   -- writes row v2, xid 101\n" +
                  "T2 commits\n" +
                  "T1 SELECT balance FROM accounts WHERE id = 7       -- still reads v1\n" +
                  "\n" +
                  "row id=7 on disk:\n" +
                  "  v1  balance=100  xmin=42   xmax=101   <- dead once no snapshot needs it\n" +
                  "  v2  balance=50   xmin=101  xmax=null  <- live\n" +
                  "\n" +
                  "VACUUM later reclaims v1's space and its index entries."
              },
              { t: "note", variant: "trap", html: "<strong>MVCC is why update-heavy tables bloat.</strong> Every update writes a new row version <em>and</em> new entries in every index on that table. A queue table hammered with status updates can occupy many times its logical size until autovacuum catches up. If your workload is 'update the same row constantly', Postgres will do it correctly and will make you pay for it in vacuum pressure." },

              { t: "h", text: "The index: why B-trees answer two questions at once" },
              { t: "p", html: "A B-tree keeps keys <em>sorted</em> in a shallow, wide tree — typically three or four levels even for very large tables, so a lookup is a handful of page reads. Because the leaves are ordered and linked, the same index that answers <code class='tok'>WHERE id = 7</code> also answers <code class='tok'>WHERE created_at BETWEEN ... AND ...</code>, supplies rows already sorted for an <code class='tok'>ORDER BY</code>, and supports prefix matching on a composite index." },
              {
                t: "table",
                headers: ["Query shape", "Index used?", "Why"],
                rows: [
                  ["<code class='tok'>WHERE (a, b) = (1, 2)</code>", "Yes", "Exact match on the full composite key"],
                  ["<code class='tok'>WHERE a = 1</code>", "Yes", "Leading column of <code class='tok'>(a, b)</code> is a valid prefix"],
                  ["<code class='tok'>WHERE b = 2</code>", "No", "Skips the leading column — the sort order is useless"],
                  ["<code class='tok'>WHERE a = 1 ORDER BY b</code>", "Yes", "Index already returns rows in <code class='tok'>b</code> order"],
                  ["<code class='tok'>WHERE lower(email) = ?</code>", "Only with an expression index", "The stored key is the raw column, not the function of it"]
                ]
              },

              { t: "h", text: "Isolation levels, stated precisely" },
              { t: "p", html: "Isolation is the dial between correctness and concurrency, and interviewers love it because most candidates know the names and not the semantics." },
              {
                t: "table",
                headers: ["Level", "What it prevents", "What still bites you"],
                rows: [
                  ["Read Committed <em>(default)</em>", "Dirty reads", "Two statements in one transaction can see different data"],
                  ["Repeatable Read", "Non-repeatable reads and phantoms — one snapshot for the whole transaction", "Write skew: two transactions each read, each decide, each write disjoint rows, and jointly break an invariant"],
                  ["Serializable", "Everything — the outcome equals some serial order", "Transactions get aborted with a serialization failure, so you must retry"]
                ]
              },
              { t: "note", variant: "tip", html: "The sentence that earns credit: <em>\"I'd hold the invariant in the database. If it's a single-row invariant, a check constraint or <code class='tok'>SELECT ... FOR UPDATE</code> is enough; if it spans rows — like 'at most one active booking per seat' — I'd use a unique index if I can express it that way, and Serializable with a retry loop if I can't.\"</em>" },

              { t: "h", text: "What it is genuinely good at" },
              {
                t: "ul", items: [
                  "<strong>Anything with an invariant.</strong> Foreign keys, unique indexes, check constraints and transactions mean correctness is enforced once, in one place, rather than in every service that writes.",
                  "<strong>Queries you have not thought of yet.</strong> The planner will join, aggregate and filter on any column. In a key-value store, an unanticipated access pattern means a migration.",
                  "<strong>Read scaling.</strong> Streaming replicas are cheap to add and take read load off the primary.",
                  "<strong>Moderate write volume with strong guarantees.</strong> A well-tuned primary on good hardware handles thousands of transactions per second comfortably — far more than most systems ever need.",
                  "<strong>Extensions rather than new systems.</strong> JSONB for semi-structured columns, full-text search, geometric and geographic types. Each is weaker than the specialist tool and removes an entire component from your architecture."
                ]
              },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>One writer.</strong> Vertical scaling is your only lever on the write path. When one machine can no longer take the write volume, there is no configuration flag that fixes it.",
                  "<strong>Failover is not free.</strong> Promoting a replica takes seconds to tens of seconds, and if replication was asynchronous, the writes that had not shipped yet are gone.",
                  "<strong>Replica lag breaks read-your-writes.</strong> A user posts, is routed to a replica, and their post is missing. Route reads that must reflect a just-completed write back to the primary.",
                  "<strong>Connections are expensive.</strong> Each backend is a process; a few hundred idle connections is real memory. Put a pooler in front before you tune anything else.",
                  "<strong>Sharding it yourself is a project, not a setting.</strong> You inherit routing, cross-shard queries, cross-shard transactions, rebalancing and per-shard schema migrations — permanently.",
                  "<strong>Long transactions block cleanup.</strong> An idle-in-transaction session pins the oldest snapshot, so vacuum cannot reclaim anything newer and bloat grows for as long as it sits there."
                ]
              },
              {
                t: "stat", items: [
                  { v: "1 primary", k: "accepts every write" },
                  { v: "N replicas", k: "scale reads, lag by ms to seconds" },
                  { v: "3–4 levels", k: "typical B-tree depth" },
                  { v: "10s of TB", k: "practical single-node comfort zone" }
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Orders, payments, bookings, inventory", "Yes, first choice", "\"Money and inventory need transactions and constraints, so the system of record is Postgres and everything else is derived from it.\""],
                  ["Unknown or evolving query patterns", "Yes", "\"I don't know all the access patterns yet, so I want a planner, not a fixed key schema.\""],
                  ["Read-heavy product with a modest write rate", "Yes, plus replicas and a cache", "\"Primary for writes, replicas for reads, cache the hot objects — I only shard when a single primary can't take the writes.\""],
                  ["Sustained six-figure writes per second", "No", "\"This exceeds a single writer, so I want a partitioned store where the write path scales horizontally.\""],
                  ["Full-text relevance ranking across millions of documents", "Only initially", "\"Built-in text search covers launch; when relevance tuning becomes the product I add a dedicated search index fed from here.\""],
                  ["Time-ordered metrics at high ingest", "No, or with a time-series extension", "\"Append-only, time-ordered data wants time partitioning and columnar compression, not a general row store.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "PostgreSQL", items: ["Rich planner, extensible types, strict standards behaviour", "Serializable isolation via true serializable snapshot isolation", "MVCC keeps old versions in the table — vacuum matters", "Best when correctness and query flexibility dominate"] },
                good: { title: "MySQL / InnoDB", items: ["Clustered index on the primary key — primary-key lookups are one structure", "Old versions live in an undo log, not the table", "Simpler replication story, huge operational familiarity", "Best when the access pattern is primary-key-centric and stable"] }
              },
              { t: "p", html: "Either of these is a defensible default and the difference rarely decides an interview. The decision that <em>does</em> matter is relational-with-a-single-writer versus partitioned-and-leaderless, which is exactly what <a href='#/deepdives/stores/cassandra'>Cassandra</a> and <a href='#/deepdives/stores/dynamodb'>DynamoDB</a> are for." },

              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> the requirements say \"must not double-charge\", \"must be consistent\", \"reporting queries\", \"admin can search by any field\", or the data model has more than two entities that reference each other. All of those are Postgres tells." },
              { t: "note", variant: "key", html: "<strong>Postgres is the baseline, and MVCC is the mechanism to name.</strong> New row versions instead of in-place updates buy you non-blocking reads and snapshot isolation, and cost you vacuum pressure. The ceiling to state out loud is the single writer: you scale reads with replicas and cache forever, but the moment write throughput exceeds one machine you are choosing between sharding it yourself and moving to a store that partitions by design." }
            ]
          },

          /* ---------------- 2. CASSANDRA ---------------- */
          {
            id: "cassandra",
            title: "Cassandra: partition key first, everything else second",
            summary: "Leaderless replication, tunable quorums, LSM writes — and the two mistakes that sink real clusters.",
            minutes: 12,
            tags: ["nosql", "cassandra", "quorum", "lsm"],
            blocks: [
              { t: "p", html: "Cassandra is a wide-column store built for one thing: absorbing enormous write volume across many machines with no single point of failure. There is no primary. Every node is identical, any node can coordinate any request, and losing one changes nothing about whether the cluster accepts writes. That property is why it shows up in messaging, event history, activity feeds and sensor data." },
              { t: "p", html: "The mental model that keeps you out of trouble: <strong>Cassandra is a distributed hash map whose values are sorted lists of rows</strong>. The partition key picks the bucket. The clustering key sorts within the bucket. That is nearly the whole data model, and it is why you design tables backwards from queries." },

              { t: "h", text: "The core mechanism, part one: the token ring" },
              { t: "p", html: "The partition key is hashed to a token, and the token determines which nodes own the data. There is no lookup table and no coordinator that decides — every node can compute placement from the key alone. Replication factor <code class='tok'>N</code> means the next <code class='tok'>N</code> nodes around the ring each hold a full copy, and every one of those copies can serve a read or accept a write." },
              {
                t: "code", lang: "text", code:
                  "CREATE TABLE messages_by_room (\n" +
                  "  room_id   uuid,\n" +
                  "  bucket    date,        -- part of the partition key: caps partition size\n" +
                  "  sent_at   timeuuid,\n" +
                  "  sender_id uuid,\n" +
                  "  body      text,\n" +
                  "  PRIMARY KEY ((room_id, bucket), sent_at)\n" +
                  ") WITH CLUSTERING ORDER BY (sent_at DESC);\n" +
                  "\n" +
                  "  (room_id, bucket)  -> hashed -> token -> which N nodes store it\n" +
                  "  sent_at            -> sort order INSIDE that partition\n" +
                  "\n" +
                  "Cheap  : WHERE room_id = ? AND bucket = ? AND sent_at < ? LIMIT 50\n" +
                  "Illegal: WHERE sender_id = ?          -- no partition key, no route"
              },
              { t: "note", variant: "warn", html: "<strong>A query without the partition key has nowhere to go.</strong> Cassandra would have to ask every node. It refuses unless you write <code class='tok'>ALLOW FILTERING</code>, which is not a feature so much as a signed waiver. The real fix is a second table keyed the way that query needs — you denormalize per access pattern and write to both tables." },

              { t: "h", text: "The core mechanism, part two: quorum arithmetic" },
              { t: "p", html: "Consistency is per-request, not per-cluster. You pick how many replicas must acknowledge a write (<code class='tok'>W</code>) and how many must respond to a read (<code class='tok'>R</code>), against a replication factor <code class='tok'>N</code>. The rule is one line and you should be able to derive it on a whiteboard:" },
              {
                t: "code", lang: "text", code:
                  "R + W > N   =>  the read set and the write set must share a replica\n" +
                  "                =>  the read sees the latest acknowledged write\n" +
                  "\n" +
                  "N = 3:\n" +
                  "  W=ONE(1)     R=ONE(1)     -> 2 > 3 ?  NO   fast, may read stale\n" +
                  "  W=QUORUM(2)  R=ONE(1)     -> 3 > 3 ?  NO   (strictly greater!)\n" +
                  "  W=QUORUM(2)  R=QUORUM(2)  -> 4 > 3 ?  YES  the usual choice\n" +
                  "  W=ALL(3)     R=ONE(1)     -> 4 > 3 ?  YES  fast reads, fragile writes\n" +
                  "  W=ONE(1)     R=ALL(3)     -> 4 > 3 ?  YES  fast writes, fragile reads\n" +
                  "\n" +
                  "N = 5:  QUORUM = 3.  W=3, R=3 -> 6 > 5, survives 2 node failures."
              },
              { t: "note", variant: "trap", html: "<strong>The classic slip is <code class='tok'>W=QUORUM, R=ONE</code> with N=3.</strong> That is 2 + 1 = 3, which is <em>not</em> greater than 3, so a read can legally land on the single replica that missed the write. The inequality is strict. Also note that <code class='tok'>ALL</code> on either side means any one node being down or slow fails the request — you traded availability for the overlap, which is the whole point of the dial." },
              { t: "p", html: "One more precision point: overlap gives you the latest value <em>for a single key</em>. It is not a transaction. Two clients updating the same cell concurrently resolve by last-write-wins on the cell timestamp, so one update simply disappears. Read-modify-write on Cassandra is unsafe unless you use lightweight transactions, which run a consensus round per operation and cost roughly an order of magnitude more latency." },

              { t: "h", text: "The core mechanism, part three: LSM writes" },
              { t: "p", html: "A write appends to a commit log and updates an in-memory <strong>memtable</strong> — no read of existing data, no seek, no in-place mutation. When the memtable fills it is flushed as an immutable, sorted <strong>SSTable</strong>. That is why writes are cheap and predictable, and why write latency barely moves as the dataset grows." },
              { t: "p", html: "The bill arrives on reads. A partition's rows may be spread across the memtable and several SSTables, so a read merges them. Each SSTable carries a Bloom filter so the engine can skip files that certainly do not contain the key — the same structure you will size yourself in <a href='#/deepdives/specialized/probabilistic'>the sketches lesson</a>. <strong>Compaction</strong> merges SSTables back down to keep read amplification bounded, and it costs disk headroom and I/O the whole time it runs." },
              {
                t: "compare",
                bad: { title: "B-tree (Postgres, InnoDB)", items: ["Update writes the page in place", "Read is one traversal — low read amplification", "Random writes, write amplification at page granularity", "Space is stable and predictable"] },
                good: { title: "LSM tree (Cassandra, RocksDB)", items: ["Write is an append — sequential, no read first", "Read may merge several sorted files", "Compaction rewrites data in the background", "Needs free disk headroom for compaction to run"] }
              },

              { t: "h", text: "What it is genuinely good at" },
              {
                t: "ul", items: [
                  "<strong>Write-heavy, append-shaped workloads</strong> — because the write path never reads first.",
                  "<strong>Staying up.</strong> No leader means no failover, no promotion window, no split-brain to arbitrate. Losing a node degrades nothing if your consistency level tolerates it.",
                  "<strong>Multi-region by design.</strong> <code class='tok'>LOCAL_QUORUM</code> keeps the request inside one data centre while replication carries the data across, so a cross-region link problem does not stop local traffic.",
                  "<strong>Time-ordered reads within an entity</strong> — the clustering key stores rows pre-sorted, so 'last 50 messages in this room' is a sequential read of one partition.",
                  "<strong>Linear scale-out.</strong> Adding nodes redistributes tokens and adds capacity without re-architecting."
                ]
              },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>The unbounded partition — the number one killer.</strong> A partition lives on exactly its replica set. Key a sensor feed by <code class='tok'>sensor_id</code> alone and one node set accumulates data forever, until compaction, repair and reads all degrade together. Keep partitions to the order of tens of megabytes; add a time or hash bucket to the partition key to enforce it.",
                  "<strong>The query the partition key does not support.</strong> Nothing in the model helps you. You write a second table, populate it on every write, and accept that the two can diverge.",
                  "<strong>Secondary indexes on high-cardinality columns.</strong> They are local to each node, so a lookup fans out to the whole cluster. Treat them as a debugging convenience, not a query plan.",
                  "<strong>Deletes are writes.</strong> A delete inserts a tombstone that survives until the grace period passes and compaction removes it. Queue-shaped tables where you delete everything you read end up scanning thousands of tombstones per query.",
                  "<strong>No joins, no aggregates worth using, no cross-partition atomicity.</strong> If a reviewer will ask 'what about reporting?', the answer must be an export to somewhere else.",
                  "<strong>Operational weight.</strong> Repair, compaction strategy tuning and capacity planning are ongoing work. This is not a database you forget about."
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Chat or activity history, read by entity and time", "Yes", "\"Partition by (room, day) and cluster by timestamp — recent messages are one sequential partition read.\""],
                  ["Very high sustained write rate, few query shapes", "Yes", "\"Writes are appends to a memtable, so throughput scales with nodes and I don't have a single writer to protect.\""],
                  ["Must serve writes during a regional outage", "Yes", "\"Leaderless with LOCAL_QUORUM: each region stays writable independently and replication reconciles across.\""],
                  ["Access patterns still being discovered", "No", "\"The partition key is the query plan. I'd be committing to access patterns I can't name yet.\""],
                  ["Read-modify-write on a shared counter or balance", "No", "\"Last-write-wins loses concurrent updates. That belongs in a store with real transactions.\""],
                  ["Ad-hoc analytics and reporting", "No", "\"I'd stream it out to a warehouse and query there — cross-partition aggregation is not what this is for.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "Cassandra (self-managed)", items: ["You own repair, compaction, capacity, upgrades", "Tunable consistency per request, including ALL", "Multi-region topology is yours to design", "No per-request throttling — you hit hardware limits instead"] },
                good: { title: "DynamoDB (managed)", items: ["No cluster to operate; throughput is a setting", "Eventual or strongly consistent reads, no free dial", "Global tables handle multi-region for you", "Throttles you at your provisioned limit, on purpose"] }
              },
              { t: "p", html: "They solve the same problem with the same partition-key discipline; the choice is who runs it and how the failure feels. <a href='#/deepdives/stores/dynamodb'>DynamoDB</a> is next, and the modelling skills transfer directly." },

              { t: "note", variant: "key", html: "<strong>Two numbers and one rule.</strong> The rule is <code class='tok'>R + W &gt; N</code>, strictly greater — with N=3, quorum reads and quorum writes give you 4 &gt; 3 and one replica of guaranteed overlap. The numbers are your partition sizes: an unbounded partition is the failure that takes clusters down, and the fix is always a bucket in the partition key. Say both out loud and you have demonstrated you have actually run this." }
            ]
          },

          /* ---------------- 3. DYNAMODB ---------------- */
          {
            id: "dynamodb",
            title: "DynamoDB: predictable latency, in exchange for your freedom",
            summary: "Partition keys, hot partitions, single-table design, index types, and the constraints the managed model imposes.",
            minutes: 11,
            tags: ["nosql", "dynamodb", "managed"],
            blocks: [
              { t: "p", html: "DynamoDB is a managed key-value and document store that offers a deal: give up ad-hoc queries and joins, and get single-digit-millisecond reads that stay single-digit-millisecond whether the table holds a thousand items or a hundred billion. There is no instance to size, no version to upgrade, no compaction to tune. There is also nothing to tune when a query is slow, because there are no query plans — only key lookups." },
              { t: "p", html: "The mental model: <strong>a giant distributed hash map of sorted lists, with a meter attached</strong>. The hash map part is the same discipline as <a href='#/deepdives/stores/cassandra'>Cassandra</a>. The meter is the part that changes your design — every access consumes measured capacity, and exceeding your limit produces throttling rather than slowness." },

              { t: "h", text: "The core mechanism: keys route, capacity is per partition" },
              { t: "p", html: "The <strong>partition key</strong> is hashed to select a physical partition. The optional <strong>sort key</strong> orders items within that partition, giving you range queries over an item collection. A <code class='tok'>Query</code> requires an exact partition key plus an optional sort-key condition. A <code class='tok'>Scan</code> reads the whole table and is a design smell in almost every context." },
              { t: "p", html: "The crucial consequence: <strong>throughput is provisioned for the table but consumed per partition</strong>. A table rated for a hundred thousand writes per second cannot push more than a fraction of that at one partition key. Adaptive capacity shifts headroom toward busy partitions, but nothing rescues a single key that is genuinely hotter than a partition can serve." },
              {
                t: "code", lang: "text", code:
                  "Hot partition, and the fix:\n" +
                  "\n" +
                  "  PK = \"LEADERBOARD#GLOBAL\"          -- every write in the system, one partition\n" +
                  "  PK = \"LEADERBOARD#GLOBAL#\" + (0..9) -- write shard, read fans out to 10, merge\n" +
                  "\n" +
                  "  PK = \"2026-08-29\"                  -- today's partition takes 100% of writes\n" +
                  "  PK = \"USER#\" + user_id             -- spreads by construction\n" +
                  "\n" +
                  "Rule: the partition key must have high cardinality AND even traffic.\n" +
                  "High cardinality alone is not enough if 1% of the keys get 90% of the reads."
              },
              { t: "note", variant: "trap", html: "<strong>A monotonically increasing partition key is the classic hot-partition bug.</strong> Keys like today's date, an auto-incrementing id, or a timestamp prefix concentrate all current traffic on one partition while every historical partition sits idle. High cardinality does not save you — what matters is that <em>live</em> traffic spreads across keys." },

              { t: "h", text: "Single-table design, and why it exists" },
              { t: "p", html: "There are no joins. If an order, its line items and its shipment live in three tables, rendering an order page costs three round trips. Single-table design puts them in <em>one</em> table with deliberately generic key attributes, so that related items share a partition key and differ only by sort key. One <code class='tok'>Query</code> then returns the entire object graph in one call, already sorted." },
              {
                t: "table",
                headers: ["PK", "SK", "Item", "Retrieved by"],
                rows: [
                  ["<code class='tok'>ORDER#8821</code>", "<code class='tok'>META</code>", "Order header: total, status, placed_at", "PK = ORDER#8821"],
                  ["<code class='tok'>ORDER#8821</code>", "<code class='tok'>ITEM#01</code>", "Line item: sku, qty, price", "same Query, SK begins_with ITEM#"],
                  ["<code class='tok'>ORDER#8821</code>", "<code class='tok'>ITEM#02</code>", "Line item", "same Query"],
                  ["<code class='tok'>ORDER#8821</code>", "<code class='tok'>SHIP#01</code>", "Shipment: carrier, tracking", "same Query, SK begins_with SHIP#"],
                  ["<code class='tok'>USER#42</code>", "<code class='tok'>ORDER#2026-08-29#8821</code>", "Pointer item for the user's order list", "PK = USER#42, SK begins_with ORDER#"]
                ]
              },
              { t: "p", html: "This is not clever for its own sake — it is the direct consequence of a data model with no joins and a cost model that charges per request. The price is real: keys stop being self-describing, adding a genuinely new access pattern often means backfilling a new index or new pointer items, and every engineer who joins needs the key schema explained to them." },

              { t: "h", text: "Index types, stated correctly" },
              {
                t: "table",
                headers: ["", "Global secondary index", "Local secondary index"],
                rows: [
                  ["Partition key", "Any attribute — different from the base table", "Must be the same as the base table"],
                  ["Sort key", "Any attribute", "An alternative attribute"],
                  ["Created", "Any time, on a live table", "Only at table creation — you cannot add one later"],
                  ["Storage", "A separate replicated copy of the projected attributes", "Shares the base table's partition"],
                  ["Consistency", "Eventually consistent only", "Strongly consistent reads available"],
                  ["Capacity", "Its own — and it can throttle independently", "Shares the table's capacity"],
                  ["Watch out for", "Write amplification: every base write updates every matching index", "Item collections are bounded, so a single partition key cannot grow indefinitely"]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>Global secondary indexes are eventually consistent, always.</strong> Write an item and immediately query the index for it and you may not find it. Any workflow that writes then reads back through an index — a uniqueness check, a state-machine guard — is broken by construction. Do those against the base table with a conditional write instead." },

              { t: "h", text: "Capacity modes and cost shape" },
              {
                t: "ul", items: [
                  "<strong>Provisioned</strong> — you declare read and write units and pay for them whether used or not. Cheapest for steady, predictable load, and autoscaling adjusts on a timescale of minutes, so it does not absorb a sudden spike.",
                  "<strong>On-demand</strong> — you pay per request with no capacity planning. More expensive per request, and the right answer for spiky, unknown, or brand-new workloads.",
                  "<strong>Units are size-based.</strong> A write unit covers roughly a kilobyte; a strongly consistent read unit covers about four kilobytes, and an eventually consistent read covers twice that for the same unit. Item size is therefore a cost decision, not just a storage decision.",
                  "<strong>Every index multiplies write cost.</strong> Four global secondary indexes means one logical write bills as five."
                ]
              },
              {
                t: "stat", items: [
                  { v: "400 KB", k: "hard maximum item size" },
                  { v: "1 KB", k: "roughly one write unit" },
                  { v: "~4 KB", k: "one strongly consistent read unit" },
                  { v: "0", k: "joins available" }
                ]
              },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>Hot keys.</strong> A celebrity user, a flash-sale product, a global counter. Sharding the key is the only real answer and it complicates every read.",
                  "<strong>Large items.</strong> The 400 KB ceiling is hard. Big payloads go to object storage with a pointer in the item.",
                  "<strong>Unanticipated queries.</strong> A new filter that no key supports means a new index and a backfill, not a new <code class='tok'>WHERE</code> clause.",
                  "<strong>Aggregation.</strong> There is no <code class='tok'>COUNT</code> or <code class='tok'>SUM</code> over a table. You maintain counters yourself with atomic updates, or you stream changes out.",
                  "<strong>Throttling is a first-class failure mode.</strong> Under provisioned mode, exceeding capacity returns errors your client must retry with backoff. Design for it rather than discovering it.",
                  "<strong>Transactions are narrow.</strong> Multi-item transactions exist but are bounded in size and roughly double the capacity cost. They are a safety net, not a foundation."
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Session store, user profiles, device state", "Yes", "\"Pure key lookup with a predictable shape, and I get flat latency without operating anything.\""],
                  ["Massive scale, small team, known access patterns", "Yes", "\"I'd rather spend the design time on the key schema than on running a cluster.\""],
                  ["Spiky traffic with no baseline", "Yes, on-demand", "\"On-demand capacity so a launch spike costs money instead of causing errors.\""],
                  ["Shopping cart or order graph", "Yes, single-table", "\"Cart and its items share a partition key, so rendering the cart is one Query.\""],
                  ["Reporting, dashboards, ad-hoc filters", "No", "\"I'd stream changes out and query them elsewhere; this store answers key lookups only.\""],
                  ["A single global counter at high write rate", "No, not directly", "\"That's a hot key. I'd shard the counter or keep it in an in-memory store and persist periodically.\""],
                  ["Complex multi-entity invariants", "No", "\"Transactions here are narrow. Anything with real invariants belongs in a relational store.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "DynamoDB", items: ["Zero operations, throughput is configuration", "Hard limits: 400 KB items, no joins, no aggregates", "Cost is a direct function of request volume and item size", "Throttling is the failure mode you design around"] },
                good: { title: "Cassandra", items: ["You run it, so no request-level throttling exists", "Per-request consistency dial including ALL and LOCAL_QUORUM", "Cost is hardware plus the people who operate it", "Compaction, repair and partition sizing are your job"] }
              },
              { t: "p", html: "Same modelling discipline, opposite operational trade. Note also that DynamoDB emits a change stream, which makes it a clean source for <a href='#/deepdives/specialized/cdc'>change data capture</a> — that is how you get the aggregations and search this store refuses to do." },

              { t: "note", variant: "key", html: "<strong>The partition key is the entire design, and the meter is the entire cost model.</strong> Say two things: how you keep live traffic spread across keys (so no partition goes hot), and which access patterns each key or index serves (because nothing else is queryable). Everything memorable about DynamoDB — single-table design, index choices, throttling — follows from those two facts." }
            ]
          },

          /* ---------------- 4. REDIS ---------------- */
          {
            id: "redis",
            title: "Redis: a data-structure server that happens to cache well",
            summary: "Single-threaded execution, eviction, honest durability, and the patterns worth naming — locks included.",
            minutes: 12,
            tags: ["cache", "redis", "in-memory"],
            blocks: [
              { t: "p", html: "Saying \"add Redis as a cache\" is true and boring. The framing that earns credit is that Redis is a <strong>data-structure server</strong>: it exposes sorted sets, hashes, lists, sets, bitmaps, streams and cardinality sketches over a network, with every operation executed atomically. Caching is one application of that, not the definition of it." },
              { t: "p", html: "The mental model: <strong>the shared memory your processes cannot otherwise have</strong>. Anything you would keep in a local variable if your service ran on one machine — a counter, a queue, a ranked list, a lock — Redis lets a hundred machines share, at latencies that stay in the sub-millisecond range because there is no disk in the read path." },

              { t: "h", text: "The core mechanism: one command at a time" },
              { t: "p", html: "Redis executes commands on a single thread. Networking has been parallelised in recent versions, but the command path is serial: your command runs to completion before the next one starts. Two consequences follow, and both matter." },
              {
                t: "ul", items: [
                  "<strong>Every command is atomic for free.</strong> <code class='tok'>INCR</code>, <code class='tok'>ZADD</code>, <code class='tok'>LPUSH</code>, <code class='tok'>SETNX</code> — no locks, no compare-and-swap loop, no lost updates. A Lua script is atomic too, which is how you build a multi-step operation that no one can interleave with.",
                  "<strong>One slow command stalls everyone.</strong> There is no other thread to make progress. A <code class='tok'>KEYS *</code> on a large keyspace, a union over million-member sets, or a script with a loop in it blocks every client for its full duration."
                ]
              },
              { t: "note", variant: "trap", html: "<strong>Latency spikes in Redis are almost always someone else's O(N) command</strong> — or a fork for a snapshot on a very large dataset. Prefer <code class='tok'>SCAN</code> over <code class='tok'>KEYS</code>, bound every range operation with <code class='tok'>LIMIT</code>, and keep individual collections small enough that a full traversal is never accidentally cheap to write." },

              { t: "h", text: "Memory is the whole budget" },
              { t: "p", html: "Everything lives in RAM, so your dataset must fit — and the useful discipline is to decide up front what happens when it does not. Set <code class='tok'>maxmemory</code> and pick a policy deliberately." },
              {
                t: "table",
                headers: ["Policy", "Behaviour when full", "Use when"],
                rows: [
                  ["<code class='tok'>noeviction</code>", "Writes fail with an error; reads keep working", "Redis holds state you cannot lose — queues, locks, sessions"],
                  ["<code class='tok'>allkeys-lru</code>", "Evicts approximately the least recently used key", "Pure cache with a clear recency-based hot set"],
                  ["<code class='tok'>allkeys-lfu</code>", "Evicts approximately the least frequently used key", "Cache where a stable popular set beats a recent one"],
                  ["<code class='tok'>volatile-lru</code> / <code class='tok'>volatile-ttl</code>", "Evicts only among keys that have a TTL", "One instance mixes cache entries with durable-ish state"],
                  ["<code class='tok'>allkeys-random</code>", "Evicts an arbitrary key", "Access is genuinely uniform, or you need the cheapest possible eviction"]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>Mixing a cache and a work queue in one instance under an <code class='tok'>allkeys-*</code> policy will eventually evict the queue.</strong> If two workloads have different loss tolerances, they want different instances. This is a real outage, not a hypothetical one." },

              { t: "h", text: "What \"durable\" honestly means here" },
              {
                t: "ul", items: [
                  "<strong>Snapshots</strong> write a point-in-time copy of the dataset by forking the process. Compact, fast to load, and a crash loses everything since the last snapshot — potentially minutes.",
                  "<strong>Append-only file</strong> logs every write command. The common configuration syncs to disk about once a second, so a crash typically loses up to a second of acknowledged writes. Syncing on every write is possible and costs you most of the performance you came for.",
                  "<strong>Replication is asynchronous.</strong> The primary replies to the client and ships the write to replicas afterwards. If the primary dies before it ships and a replica is promoted, those acknowledged writes are gone.",
                  "<strong>Therefore:</strong> Redis is durable enough for a cache, a rate limiter, a leaderboard, or a session store where re-login is acceptable. It is not a system of record for anything you would be embarrassed to lose."
                ]
              },
              { t: "p", html: "State this yourself before an interviewer asks. \"Redis is my hot path, Postgres is my truth\" is the sentence — and it is exactly the relationship described in <a href='#/deepdives/stores/postgres'>the Postgres lesson</a>." },

              { t: "h", text: "The patterns worth naming" },
              {
                t: "code", lang: "text", code:
                  "CACHE-ASIDE\n" +
                  "  v = GET user:42            -> hit? return it\n" +
                  "  miss -> read Postgres -> SET user:42 <json> EX 300 -> return\n" +
                  "  on update: write Postgres, then DEL user:42   (delete, don't update)\n" +
                  "\n" +
                  "FIXED-WINDOW RATE LIMIT\n" +
                  "  n = INCR ratelimit:{user}:{minute}\n" +
                  "  if n == 1: EXPIRE ratelimit:{user}:{minute} 60\n" +
                  "  if n > limit: reject\n" +
                  "\n" +
                  "LEADERBOARD  (sorted set = score-ordered, O(log N) updates)\n" +
                  "  ZADD  scores 9820 player:17\n" +
                  "  ZREVRANGE scores 0 9 WITHSCORES     -- top ten\n" +
                  "  ZREVRANK  scores player:17          -- this player's rank\n" +
                  "\n" +
                  "LOCK\n" +
                  "  SET lock:job42 <random-token> NX PX 30000     -- acquire, with a TTL\n" +
                  "  release via a script: delete ONLY if the value still equals my token"
              },
              { t: "p", html: "Two details in there are the ones interviewers probe. First, cache-aside <em>deletes</em> on update rather than writing the new value: two concurrent updates that each write the cache can land in the opposite order from the database and leave the cache permanently wrong, whereas a delete just causes a miss. Second, the lock releases by comparing a token, because a blind <code class='tok'>DEL</code> would let you delete a lock that had already expired and been acquired by someone else." },

              { t: "h", text: "Locks: what they actually guarantee" },
              { t: "p", html: "A Redis lock needs a TTL, or a crashed holder deadlocks everyone forever. But a TTL means the lock can expire <em>while the holder is still working</em> — a long garbage-collection pause, a slow disk, a descheduled container. Two processes then believe they hold it. No amount of algorithm sophistication removes that, because the lock service cannot observe what the holder is doing." },
              {
                t: "compare",
                bad: { title: "Treating it as mutual exclusion", items: ["\"Only one worker can be in this section\"", "Breaks on GC pause, TTL expiry, or a failover that loses the key", "Failure is silent — you get duplicate work or corrupt state", "Asynchronous replication means a promoted replica may not have the lock at all"] },
                good: { title: "Treating it as an efficiency lock", items: ["\"Usually only one worker does this, saving duplicate effort\"", "Correctness comes from the protected resource, not the lock", "Fencing token: the lock hands out an increasing number; the resource rejects anything older", "Or make the operation idempotent so a double-run is harmless"] }
              },
              { t: "note", variant: "tip", html: "The interview sentence: <em>\"I'd use a Redis lock to avoid duplicated work, not to guarantee correctness. If correctness depends on exclusivity, I want a fencing token that the downstream resource checks, or a unique constraint in the database that makes the second write fail.\"</em>" },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Read-heavy hot objects in front of a database", "Yes", "\"Cache-aside with a TTL, and delete the key on write rather than updating it.\""],
                  ["Rate limiting across many app servers", "Yes", "\"Counters must be shared, and INCR plus EXPIRE is atomic on a single thread.\""],
                  ["Real-time leaderboard or top-N", "Yes", "\"A sorted set gives ranked reads and O(log N) score updates directly.\""],
                  ["Session store for stateless services", "Yes, with a caveat", "\"Sessions in Redis so any app server can serve any request; worst case a failover forces re-login.\""],
                  ["Deduplication over a huge id space", "Yes", "\"A Bloom filter or HyperLogLog in Redis, sized deliberately — exact sets don't fit in memory.\""],
                  ["Primary store for orders or payments", "No", "\"Asynchronous replication can drop acknowledged writes. Truth lives in a transactional store.\""],
                  ["Working set far larger than affordable RAM", "No", "\"Memory is the budget. If the hot set doesn't fit, caching stops paying for itself.\""],
                  ["Durable, replayable event log", "No", "\"Streams exist, but retention and replay at scale is what a log-structured broker is built for.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "Memcached", items: ["Strings only — get, set, delete", "Multi-threaded, so it uses all cores for pure caching", "No persistence, no replication, no structures", "Simplest possible cache, and genuinely excellent at exactly that"] },
                good: { title: "Redis", items: ["Sorted sets, hashes, streams, bitmaps, sketches", "Single-threaded commands, therefore atomic without locks", "Optional persistence and replication", "Pick it when you need operations, not just storage"] }
              },
              { t: "p", html: "If all you do is <code class='tok'>get</code> and <code class='tok'>set</code> opaque blobs, Memcached is a perfectly good answer and its multi-threading is a real advantage. The moment you need an atomic increment, a ranked read, or a set operation, that argument ends." },

              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> the problem says \"top 10\", \"requests per minute per user\", \"only one worker should\", \"count unique visitors\", \"the same query runs constantly\", or \"needs to be fast\" with a read:write ratio far above one. Those are all one atomic data structure away from solved." },
              { t: "note", variant: "key", html: "<strong>Single-threaded execution is the mechanism; memory is the budget; durability is the honest caveat.</strong> Name the data structure rather than the product — \"a sorted set for the leaderboard\", \"INCR with a TTL for the limiter\" — and pair it with the sentence that Redis holds derived, regenerable state while the system of record lives elsewhere." }
            ]
          },

          /* ---------------- 5. ELASTICSEARCH ---------------- */
          {
            id: "elasticsearch",
            title: "Elasticsearch: an inverted index you feed, not a database you trust",
            summary: "Analysis, near-real-time segments, relevance scoring, and why it should always be a secondary index.",
            minutes: 11,
            tags: ["search", "elasticsearch", "inverted-index"],
            blocks: [
              { t: "p", html: "Elasticsearch is a distributed search engine built on Lucene. Its entire reason to exist is one data structure: the <strong>inverted index</strong>, which maps each term to the list of documents containing it. A relational <code class='tok'>LIKE '%term%'</code> scans rows and asks 'does this document contain the term?'. An inverted index asks the opposite question — 'which documents contain this term?' — and answers it by reading one pre-built list." },
              { t: "p", html: "The mental model: <strong>a very good index with a weak database attached</strong>. Treat the search capability as excellent and the storage as something you should be able to throw away and rebuild at any time." },

              { t: "h", text: "The core mechanism: analysis, then posting lists" },
              { t: "p", html: "Before anything is indexed, text passes through an <strong>analysis chain</strong>: character filters, a tokenizer that splits text into terms, then token filters that lowercase, strip stop words, apply stemming, and expand synonyms. The resulting terms — not the original text — are what go into the index." },
              {
                t: "code", lang: "text", code:
                  "\"The Running Shoes were UNBEATABLE!\"\n" +
                  "   tokenize   -> [The] [Running] [Shoes] [were] [UNBEATABLE]\n" +
                  "   lowercase  -> [the] [running] [shoes] [were] [unbeatable]\n" +
                  "   stop words -> [running] [shoes] [unbeatable]\n" +
                  "   stemming   -> [run] [shoe] [unbeat]\n" +
                  "\n" +
                  "inverted index:\n" +
                  "   run     -> [doc3, doc7, doc9]\n" +
                  "   shoe    -> [doc1, doc3, doc7]\n" +
                  "   unbeat  -> [doc3]\n" +
                  "\n" +
                  "query \"running shoe\" is analysed THE SAME WAY -> [run] [shoe]\n" +
                  "   intersect the two lists -> doc3, doc7"
              },
              { t: "note", variant: "trap", html: "<strong>The single most common bug is an analyzer mismatch.</strong> If the index stems and the query does not — or a field was mapped as an exact-match keyword and you send it a full-text query — you get zero results and no error. When a search silently returns nothing, check what the analyzer produced for both sides before you check anything else." },
              { t: "p", html: "This is also why there are two fundamentally different field types. A <strong>text</strong> field is analysed and searchable by term; a <strong>keyword</strong> field is stored verbatim and is what you use for exact matches, filters, sorting and aggregation. Getting this wrong at mapping time means a reindex, because mappings for an existing field cannot be changed in place." },

              { t: "h", text: "Why it is near-real-time, not real-time" },
              { t: "p", html: "Lucene segments are immutable. An indexed document sits in an in-memory buffer and becomes searchable only when a <strong>refresh</strong> rolls that buffer into a new segment — by default about once a second. Segments accumulate and are merged in the background; deletes are marks that only disappear during a merge." },
              {
                t: "ul", items: [
                  "<strong>Consequence one:</strong> index a document, search for it immediately, and you may not find it. Any \"save and redirect to the search results\" flow needs to account for that gap.",
                  "<strong>Consequence two:</strong> refreshing more often costs segment churn and merge pressure. Bulk-loading pipelines usually <em>increase</em> the refresh interval, precisely because near-real-time is not free.",
                  "<strong>Consequence three:</strong> immutability is why full-text search is fast at read time. You pay at write time and on merges to get lists you can intersect without locking."
                ]
              },

              { t: "h", text: "Relevance, conceptually" },
              { t: "p", html: "Matching is a set operation; <em>ranking</em> is what makes search feel good. The default scoring function combines three intuitions, and you should be able to state them without formulas:" },
              {
                t: "ul", items: [
                  "<strong>Term frequency</strong> — a document mentioning the term more is more relevant, but with diminishing returns. The tenth mention adds far less than the second.",
                  "<strong>Inverse document frequency</strong> — a term that appears in almost every document tells you almost nothing. Rare terms carry the signal.",
                  "<strong>Field length normalisation</strong> — a match in a five-word title means more than the same match buried in a three-thousand-word body."
                ]
              },
              { t: "p", html: "On top of that you layer business logic: boost the title field, boost recent documents, boost in-stock products, demote low-rated sellers. That layering is the actual work of search quality, and it is a strong reason to have a dedicated engine rather than a text index bolted onto your primary database." },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>It is not a system of record.</strong> No cross-document transactions, no foreign keys, no joins in any meaningful sense. Concurrent updates are handled with optimistic versioning, not locks.",
                  "<strong>Mapping changes mean reindexing.</strong> Adding a field is easy; changing how an existing field is analysed is a rebuild. If you own the source data this is routine; if the index <em>is</em> the source, it is an outage.",
                  "<strong>Primary shard count is fixed at index creation.</strong> Getting it wrong means reindexing into a new index and swapping an alias. Too few shards caps parallelism; too many wastes memory on per-shard overhead.",
                  "<strong>Deep pagination is expensive.</strong> Asking for results ten thousand deep makes every shard produce and merge that many hits. Use cursor-style pagination for anything beyond the first few pages.",
                  "<strong>Aggregations and sorting eat heap.</strong> High-cardinality aggregations on large indexes are the usual cause of memory pressure and node instability.",
                  "<strong>Cluster state is a shared fate.</strong> One badly behaved index — a runaway aggregation, an exploding shard count — degrades unrelated indexes on the same nodes."
                ]
              },
              { t: "note", variant: "warn", html: "<strong>Say the secondary-index sentence unprompted.</strong> \"The system of record is the transactional database; the search index is derived from it and I can rebuild it from scratch.\" That single line pre-empts every question about consistency, reindexing and data loss, and it is the architecture that <a href='#/deepdives/specialized/cdc'>change data capture</a> exists to make reliable." },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Product search with typo tolerance and facets", "Yes", "\"An inverted index with analysers for stemming and synonyms, plus keyword fields for facet aggregation.\""],
                  ["Log and event search across many services", "Yes", "\"Time-based indexes with an alias, hot data on fast nodes, older indexes rolled off.\""],
                  ["Relevance is the product", "Yes", "\"Ranking with field boosts and recency decay is the feature. A general database gives me matching but not ranking.\""],
                  ["Autocomplete and as-you-type suggestions", "Yes", "\"Edge n-gram analysis at index time so a prefix is a term lookup rather than a scan.\""],
                  ["A few thousand rows, occasional keyword search", "No", "\"Built-in text search in the primary database covers this without adding a cluster to operate.\""],
                  ["The only copy of the data", "No", "\"I keep the truth in a transactional store so a mapping change is a reindex, not an incident.\""],
                  ["Point lookups by primary key", "No", "\"That's a key-value access pattern and belongs in the primary store or a cache.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "Built-in database text search", items: ["No extra system to run, deploy or monitor", "Transactionally consistent with the rows it indexes", "Ranking is basic; boosting and tuning are limited", "Fine to millions of documents, strained beyond"] },
                good: { title: "Elasticsearch", items: ["Distributed, horizontally scalable, purpose-built", "Rich analysis, relevance tuning, facets, suggesters", "A second copy of the data that can drift or need rebuilding", "Worth it when search quality is a product feature"] }
              },
              { t: "p", html: "The honest default is to start with the database's own text search and move only when relevance tuning or scale forces it. \"I'd start with what I already run and add a search cluster when the requirement is ranking rather than matching\" is a stronger answer than reaching for the cluster immediately." },

              { t: "note", variant: "key", html: "<strong>Inverted index in, analysis chain first, refresh interval in between.</strong> The mechanism to name is that terms — not text — are indexed, and that the same analysis must run on both sides of a query. The architectural rule that follows is non-negotiable: Elasticsearch is a derived index you can rebuild, never the place your data lives." },

              { t: "quiz", id: "deepdives-stores" }
            ]
          }
        ]
      },

      /* ============ MODULE 2 · STREAMING & COORDINATION ============ */
      {
        id: "streams",
        name: "Streaming & Coordination",
        icon: "queue",
        lessons: [

          /* ---------------- 6. KAFKA ---------------- */
          {
            id: "kafka",
            title: "Kafka: a partitioned log, not a queue",
            summary: "Per-partition ordering, consumer groups, retention as replay, and delivery semantics stated carefully.",
            minutes: 12,
            tags: ["streaming", "kafka", "log"],
            blocks: [
              { t: "p", html: "Kafka gets misfiled as a message queue, and every mistake people make with it follows from that misfiling. A queue holds work until a consumer takes it, and taking it removes it. Kafka is a <strong>durable, append-only log</strong>: records are written to the end of a file, consumers read forward through it at their own pace, and reading changes nothing. Records leave because retention expired, never because someone consumed them." },
              { t: "p", html: "The mental model: <strong>a shared, replayable history of what happened</strong>. That framing explains why five independent teams can consume the same topic, why you can add a sixth next year and have it read the last week from the beginning, and why a consumer bug is recoverable by rewinding rather than by re-emitting events nobody kept." },

              { t: "h", text: "The core mechanism: topic → partitions → offsets" },
              { t: "p", html: "A topic is split into <strong>partitions</strong>. Each partition is an ordered, immutable sequence of records, and each record has an <strong>offset</strong>: its position in that sequence. Partitions live on different brokers, which is where parallelism comes from. A producer picks a partition — by hashing the record key, or round-robin when there is no key." },
              {
                t: "code", lang: "text", code:
                  "topic: orders   (3 partitions)\n" +
                  "\n" +
                  "  P0 |  0  1  2  3  4  5 |->  append here\n" +
                  "  P1 |  0  1  2 |->\n" +
                  "  P2 |  0  1  2  3  4  5  6  7 |->\n" +
                  "\n" +
                  "  partition = hash(key) % partition_count\n" +
                  "\n" +
                  "  key = order_id  -> every event for order 8821 is in ONE partition, in order\n" +
                  "  key = null      -> spread evenly, NO ordering guarantee between events\n" +
                  "\n" +
                  "  P0[3] happened before P0[4].\n" +
                  "  P0[3] versus P1[0] -- undefined. There is no cross-partition order."
              },
              { t: "note", variant: "tip", html: "<strong>Ordering exists within a partition and nowhere else.</strong> This is the single most important sentence about Kafka. \"created, paid, shipped, refunded\" only arrives in that order if all four events share a key that hashes to the same partition. Total ordering across a topic requires exactly one partition, which caps throughput at whatever one broker can absorb — and that is sometimes the right trade, made deliberately." },
              { t: "p", html: "Key choice is therefore a design decision with consequences. Key by <code class='tok'>order_id</code> and per-order order is guaranteed but a hot order concentrates load. Key by <code class='tok'>customer_id</code> and you get per-customer ordering with better spread. Key by nothing and you get maximum throughput with no guarantees at all. Say which one you picked and why." },

              { t: "h", text: "Consumer groups and rebalancing" },
              { t: "p", html: "A <strong>consumer group</strong> is a set of processes cooperating to consume a topic. Each partition is assigned to exactly one consumer in the group, so partition count is a hard ceiling on parallelism: six partitions means at most six useful consumers, and the seventh idles. Different groups are completely independent — each keeps its own offsets and reads the same records without interfering." },
              {
                t: "table",
                headers: ["Setup", "Effect", "Watch out for"],
                rows: [
                  ["6 partitions, 3 consumers", "Two partitions each", "Healthy — room to scale to 6"],
                  ["6 partitions, 10 consumers", "Four consumers idle", "Wasted capacity; raise partitions to raise parallelism"],
                  ["6 partitions, 1 consumer", "One process does everything", "Lag grows if throughput exceeds one process"],
                  ["Two groups on one topic", "Both see every record independently", "This is the fan-out mechanism — not a bug"],
                  ["A consumer joins or dies", "Rebalance reassigns partitions", "Classic rebalancing pauses the whole group briefly"]
                ]
              },
              { t: "note", variant: "trap", html: "<strong>Rebalance storms are a real production failure.</strong> If processing a batch takes longer than the poll interval, the broker concludes the consumer is dead and triggers a rebalance; the group pauses, the consumer rejoins, and the cycle repeats while lag climbs. The fixes are to bound batch processing time, tune the poll interval honestly, and prefer incremental rebalancing so only the moving partitions stop." },

              { t: "h", text: "Retention: the feature that makes it a log" },
              {
                t: "ul", items: [
                  "<strong>Time or size retention</strong> — keep seven days, or a hundred gigabytes per partition. This window is your replay budget: a consumer that has been broken longer than the retention has permanently lost those records.",
                  "<strong>Log compaction</strong> — instead of deleting by age, keep the most recent record per key forever. The topic becomes a durable snapshot of current state per entity, which is exactly what a service needs to rebuild a local cache from scratch.",
                  "<strong>Replay is an operation, not a rescue.</strong> Deployed a consumer with a bug on Tuesday, fixed it on Thursday? Reset the group's offsets to Tuesday and reprocess — provided your consumer is idempotent, which is the recurring theme of this whole track."
                ]
              },

              { t: "h", text: "Delivery semantics, stated carefully" },
              {
                t: "table",
                headers: ["You get", "How", "The catch"],
                rows: [
                  ["At-most-once", "Commit the offset before processing", "A crash after commit loses the record entirely. Rarely what you want."],
                  ["At-least-once", "Commit the offset after processing", "A crash between the two replays the record. The correct default — pair it with idempotent handlers."],
                  ["Exactly-once within Kafka", "Idempotent producer plus transactions across read-process-write", "Only atomic when the output is also Kafka, including the offset commit."],
                  ["Exactly-once effects outside Kafka", "Idempotent writes downstream, or a transactional sink", "Kafka cannot give you this. The consumer's write target has to cooperate."]
                ]
              },
              { t: "p", html: "The durability side has its own dial. <code class='tok'>acks=all</code> combined with a minimum in-sync replica count means a write is acknowledged only after it is on multiple brokers; <code class='tok'>acks=1</code> acknowledges as soon as the partition leader has it, and loses that record if the leader fails before replication. This is the same availability-versus-durability trade as quorum tuning in <a href='#/deepdives/stores/cassandra'>Cassandra</a>, wearing different clothes." },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>Skewed keys.</strong> One partition becomes hot, its consumer falls behind, and adding consumers does nothing because the partition already has an owner.",
                  "<strong>Partition count is sticky.</strong> Increasing it changes which partition existing keys hash to, so records for one key can appear in two partitions across the change — breaking the very ordering you keyed for.",
                  "<strong>Too many partitions is also a cost.</strong> Each one is files, memory and metadata on the brokers, plus more work in every rebalance.",
                  "<strong>Head-of-line blocking.</strong> One poison record that always fails stalls its partition. You need a dead-letter path and a bounded retry policy, decided up front.",
                  "<strong>Not a task queue.</strong> No per-message acknowledgement, no arbitrary redelivery, no priority, no scheduled delivery. If you need those, use a broker built for them.",
                  "<strong>Not a database.</strong> There is no way to look up a record by id. If consumers need lookups, project the log into a store that can serve them."
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Many teams need the same events", "Yes", "\"One topic, independent consumer groups — each team reads the whole stream at its own pace.\""],
                  ["Decoupling a write path from slow side effects", "Yes", "\"Publish the event, return immediately, let consumers do search indexing and notifications asynchronously.\""],
                  ["Absorbing bursts a downstream store can't take", "Yes", "\"The log buffers the spike and consumers drain at a safe rate; lag is the metric I watch.\""],
                  ["Per-entity ordering matters", "Yes, with a keyed topic", "\"Key by entity id so all its events share a partition and stay ordered.\""],
                  ["Rebuilding a service's state from scratch", "Yes, compacted", "\"A compacted topic keeps the latest record per key, so a new instance replays it into a local view.\""],
                  ["Job queue with retries and priorities", "No", "\"That's per-message acknowledgement and scheduling, which is a task broker's job, not a log's.\""],
                  ["Request/response between two services", "No", "\"Synchronous call. Putting a request-reply pattern over a log adds latency and correlation bookkeeping for nothing.\""],
                  ["A handful of events per day", "No", "\"A table plus a poller. A broker cluster is not free to run.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "Traditional message broker", items: ["Per-message acknowledgement, redelivery, dead-letter queues", "Priorities, delayed delivery, flexible routing topologies", "Consumed messages are gone — no replay", "Right for task distribution and work queues"] },
                good: { title: "Kafka", items: ["Consumers track their own offset; nothing is removed by reading", "Retention gives you replay and late-joining consumers", "Ordering per partition, throughput scales with partitions", "Right for event streams many parties consume"] }
              },
              { t: "p", html: "Different tools for problems that sound identical. \"Do consumers need to replay history?\" separates them almost every time, and it is a much better question than \"which one is faster?\"" },

              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"multiple downstream systems need this data\", \"we need to reprocess when the algorithm changes\", \"the write path shouldn't wait for indexing\", \"traffic spikes overwhelm the database\", or \"audit trail of every change\". All of those describe a log, not a queue." },
              { t: "note", variant: "key", html: "<strong>Partitioned append-only log: ordering per partition, parallelism per partition, replay from retention.</strong> Choose the key deliberately, because it decides both what stays ordered and where load concentrates. Default to at-least-once with idempotent consumers, and only claim exactly-once when the sink participates in a transaction." }
            ]
          },

          /* ---------------- 7. FLINK ---------------- */
          {
            id: "flink",
            title: "Flink: time is the hard part, not throughput",
            summary: "Event time versus processing time, watermarks, windows, and what checkpointed state really guarantees.",
            minutes: 11,
            tags: ["streaming", "flink", "event-time"],
            blocks: [
              { t: "p", html: "A log broker moves records. A <strong>stream processor</strong> computes over them continuously: joins, aggregations, sessionisation, pattern detection — all incremental, all maintaining state that outlives any individual record. Flink is the canonical example, and it is worth studying not for its API but because it forces you to be precise about two things most designs handwave: what time an event happened, and what happens when the job crashes." },
              { t: "p", html: "The mental model: <strong>a long-running query over an unbounded table, with durable memory</strong>. A batch job reads a finite input and finishes. A streaming job never finishes, so every intermediate result it holds — running counts, open windows, join buffers — has to survive failures, redeployments and rescaling." },

              { t: "h", text: "The core mechanism, part one: event time" },
              { t: "p", html: "There are two clocks, and confusing them produces results that are wrong in a way no test catches." },
              {
                t: "table",
                headers: ["", "Processing time", "Event time"],
                rows: [
                  ["Definition", "Wall clock on the machine doing the work", "Timestamp carried inside the record"],
                  ["Deterministic on replay?", "No — reprocessing gives different buckets", "Yes — the same input always produces the same output"],
                  ["Handles late or out-of-order data?", "No, they land in whatever bucket is current", "Yes, that is the entire point"],
                  ["Latency", "Lowest possible", "Waits for the watermark to advance"],
                  ["Use when", "Rate limiting, coarse monitoring, throughput counters", "Billing, analytics, anything a human will reconcile"]
                ]
              },
              { t: "p", html: "The concrete failure: a phone buffers events offline and uploads an hour of activity at once. Under processing time, an hour of history collapses into the current minute's bucket and every per-minute chart is wrong. Under event time, each record lands in the minute it actually occurred." },

              { t: "h", text: "The core mechanism, part two: watermarks" },
              { t: "p", html: "Event time creates a question with no clean answer: a window covering 10:00–10:01 can only be emitted once you believe no more records for that minute will arrive — and in a distributed system you can never be sure. A <strong>watermark</strong> is the system's declared answer: a marker flowing with the stream that asserts \"event time has reached T\". When a watermark passes a window's end, the window fires." },
              {
                t: "code", lang: "text", code:
                  "records arrive (event timestamps), watermark trails by 5s:\n" +
                  "\n" +
                  "  10:00:03   -> window [10:00,10:01) accumulates      watermark 09:59:58\n" +
                  "  10:00:47   -> same window                           watermark 10:00:42\n" +
                  "  10:01:04   -> next window                           watermark 10:00:59\n" +
                  "  10:01:06   -> next window                           watermark 10:01:01  ** fires [10:00,10:01)\n" +
                  "  10:00:55   -> LATE. window already closed.\n" +
                  "                 allowed lateness > 0 -> re-fire the window with an updated result\n" +
                  "                 otherwise            -> side output, or silently dropped\n" +
                  "\n" +
                  "the whole design is one dial:\n" +
                  "  small trailing gap -> results sooner, more records arrive late\n" +
                  "  large trailing gap -> results later, fewer records missed"
              },
              { t: "note", variant: "warn", html: "<strong>Late data is not an edge case; it is the normal condition.</strong> Mobile clients go through tunnels, a partition's consumer falls behind, a region's link degrades. Decide explicitly which of the three you want — drop it, route it to a side output for reconciliation, or allow lateness and re-emit a corrected result — and make sure whatever reads your output can handle a value that changes after it was first published." },

              { t: "h", text: "Windows" },
              {
                t: "ul", items: [
                  "<strong>Tumbling</strong> — fixed, non-overlapping buckets. Every record belongs to exactly one. \"Orders per minute.\"",
                  "<strong>Sliding</strong> — fixed length, advancing by a smaller step, so windows overlap and each record lands in several. \"Five-minute average, updated every thirty seconds.\" Cost scales with the overlap factor.",
                  "<strong>Session</strong> — dynamic: a window closes after a gap of inactivity, so its length is data-dependent. \"A user's browsing session ends after thirty idle minutes.\" State per key is unbounded until the gap elapses.",
                  "<strong>Global with a custom trigger</strong> — no time boundary at all; you decide when to emit. Powerful and easy to leak state with."
                ]
              },

              { t: "h", text: "The core mechanism, part three: checkpoints" },
              { t: "p", html: "Flink periodically injects <strong>barriers</strong> into the stream. As a barrier flows through the job graph, each operator snapshots its state and passes the barrier on. When every operator has snapshotted for the same barrier, that checkpoint is complete: a globally consistent picture of all operator state <em>plus</em> the source offsets that produced it." },
              { t: "p", html: "On failure, the job restores that state and rewinds the sources to the recorded offsets. Everything after the checkpoint is reprocessed against exactly the state that existed at that point, so internal results are as if the failure never happened." },
              { t: "note", variant: "trap", html: "<strong>Say this precisely or you will get corrected.</strong> Checkpointing gives exactly-once <em>state</em>. It does not give exactly-once <em>effects</em>. Rows written to a database, emails sent, payments charged during the replayed window will happen again — nothing snapshotted the outside world. Exactly-once effects require a sink that commits transactionally with the checkpoint, or a downstream write that is idempotent by key." },
              { t: "p", html: "This is the identical problem the <a href='#/deepdives/specialized/cdc'>change-data-capture lesson</a> solves with the outbox pattern, and the identical reason at-least-once plus idempotency is the recurring recommendation across every streaming system." },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>State size becomes the constraint.</strong> Large keyed state makes checkpoints slow, recovery slower, and a rescale operation a genuine planned event rather than a config change.",
                  "<strong>Watermarks stall on idle partitions.</strong> If one input partition stops producing, the watermark is held back by it and windows stop firing across the whole job. Idleness detection has to be configured, not assumed.",
                  "<strong>Stream-to-stream joins buffer.</strong> Joining two streams within a time bound holds both sides in state for that bound. A wide join window is a memory decision.",
                  "<strong>Operational weight is real.</strong> Savepoints, upgrades, state schema evolution and backpressure tuning are ongoing work that a small team feels immediately.",
                  "<strong>Backpressure propagates.</strong> A slow sink slows the whole pipeline back to the source. That is correct behaviour, but it means one slow dependency is visible everywhere."
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Continuous aggregations over event streams", "Yes", "\"Event-time windows with watermarks, so results are correct under late and out-of-order data.\""],
                  ["Real-time fraud or anomaly detection", "Yes", "\"Keyed state per account, pattern detection over a sliding window, alerts within seconds.\""],
                  ["Sessionising user activity", "Yes", "\"Session windows with an inactivity gap — the window length comes from the data, not a constant.\""],
                  ["Enriching a stream from a slowly changing table", "Yes", "\"Broadcast the reference data into operator state so the join is local rather than a per-record lookup.\""],
                  ["Stateless per-record transformation", "No", "\"A plain consumer does that. Adding a stateful processor buys me nothing but operations.\""],
                  ["Nightly reports over historical data", "No", "\"Batch. Unbounded machinery is only worth it when results must be continuous.\""],
                  ["Small team, one aggregation", "Probably not", "\"I'd start with windowed counters in a consumer and adopt a stream processor when correctness under late data actually matters.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "Micro-batch processing", items: ["Discretises the stream into small batches", "Latency floor is the batch interval — typically sub-second at best", "Often simpler to operate and reason about", "Great when seconds of latency are acceptable"] },
                good: { title: "True record-at-a-time streaming", items: ["Processes each record as it arrives", "Latency in the milliseconds, not batch-bounded", "Sophisticated event-time and state machinery", "Worth it when latency or late-data correctness is a requirement"] }
              },
              { t: "p", html: "There is a third option worth naming: an embedded stream-processing library that runs inside your own service and stores state locally, with no separate cluster. It gives up cluster-wide scheduling and rescaling in exchange for being just another deployment of your application — often the right call for a single team." },

              { t: "note", variant: "key", html: "<strong>Event time versus processing time is the question; the watermark is the answer; the trade-off is a dial.</strong> More watermark slack means fewer late records and later results. And be exact about guarantees: checkpoints give exactly-once state, while exactly-once effects always require the sink to cooperate — transactionally or idempotently." }
            ]
          },

          /* ---------------- 8. ZOOKEEPER ---------------- */
          {
            id: "zookeeper",
            title: "ZooKeeper: small, critical, agreed-upon facts",
            summary: "Consensus-backed metadata, ephemeral nodes, leader election — and why it is not a datastore.",
            minutes: 9,
            tags: ["coordination", "zookeeper", "consensus"],
            blocks: [
              { t: "p", html: "Distributed systems keep needing the same handful of facts that <em>everyone must agree on</em>: who is the leader, which nodes are alive, who owns which shard, what the current configuration version is. Getting a group of machines to agree on a single value in the presence of failures is the consensus problem, and it is hard enough that you should never solve it inline. ZooKeeper is a service that solves it once and rents you the answer." },
              { t: "p", html: "The mental model: <strong>a tiny, highly available filesystem where writes are agreed by majority vote and files can disappear when their owner dies</strong>. That last clause is what makes it a coordination service rather than a small database." },

              { t: "h", text: "The core mechanism: totally ordered writes through a leader" },
              { t: "p", html: "An ensemble is an odd number of servers — three or five in practice. One is elected leader. <em>Every</em> write is proposed by the leader, acknowledged by a majority, and only then committed, which gives every write a globally unique, monotonically increasing transaction id. Reads are served locally by any server and can therefore be slightly stale unless the client explicitly synchronises first." },
              {
                t: "table",
                headers: ["Ensemble size", "Majority needed", "Failures tolerated", "Note"],
                rows: [
                  ["3", "2", "1", "The usual starting point"],
                  ["5", "3", "2", "Standard for anything important"],
                  ["4", "3", "1", "Strictly worse than 3 — more cost, same tolerance"],
                  ["7", "4", "3", "More servers means slower writes; rarely worth it"]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>Lose the majority and writes stop.</strong> This is correct behaviour — a minority cannot safely decide anything — but it means an ensemble outage freezes leader election and configuration changes across every system that depends on it. Spread the ensemble across failure domains and treat its availability as the floor for everything above it." },

              { t: "h", text: "The primitives you build everything from" },
              {
                t: "ul", items: [
                  "<strong>Znodes</strong> — nodes in a hierarchical namespace that hold a small value and a version number. The version enables compare-and-set writes, which is how you get atomic updates without locks.",
                  "<strong>Ephemeral znodes</strong> — tied to the client's session. Stop heartbeating and the node vanishes automatically. This turns \"is that process alive?\" from a monitoring question into a data-model fact.",
                  "<strong>Sequential znodes</strong> — the server appends a monotonically increasing suffix on creation, giving every creator a unique, ordered position without any coordination between them.",
                  "<strong>Watches</strong> — one-shot notifications when a znode changes. One-shot matters: after firing you must re-register, and you must re-read state rather than trusting the notification to carry it."
                ]
              },
              {
                t: "code", lang: "text", code:
                  "LEADER ELECTION  (ephemeral + sequential, no polling)\n" +
                  "\n" +
                  "  each candidate creates /service/election/n- as EPHEMERAL SEQUENTIAL\n" +
                  "    -> /service/election/n-0000000007\n" +
                  "       /service/election/n-0000000008\n" +
                  "       /service/election/n-0000000009\n" +
                  "\n" +
                  "  lowest sequence number is the leader (0000000007)\n" +
                  "  each other candidate WATCHES only the node immediately below its own\n" +
                  "    -> no herd effect: one death wakes exactly one waiter\n" +
                  "\n" +
                  "  leader crashes  -> its session expires -> its ephemeral node disappears\n" +
                  "                  -> 0000000008's watch fires -> it is now the leader\n" +
                  "\n" +
                  "MEMBERSHIP\n" +
                  "  every worker creates an ephemeral /service/workers/<id>\n" +
                  "  the live set is simply: list the children"
              },

              { t: "h", text: "What it is genuinely good at" },
              {
                t: "ul", items: [
                  "<strong>Leader election</strong> that is actually safe, including the awkward cases where the old leader has not noticed it lost.",
                  "<strong>Liveness and membership</strong> without a heartbeat table, a reaper job, or a timeout you have to tune yourself.",
                  "<strong>Small configuration that must be consistent</strong> — feature flags with correctness implications, shard ownership maps, schema versions.",
                  "<strong>Distributed locks and barriers</strong> with real ordering semantics, since sequential znodes give you a queue rather than a scramble.",
                  "<strong>Change notification</strong> — watches let a hundred processes learn about a configuration change without any of them polling."
                ]
              },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>It is not a datastore.</strong> Znode values are meant to be small — kilobytes, with a hard ceiling around a megabyte — and the whole dataset is expected to fit comfortably in memory on every server.",
                  "<strong>Writes do not scale.</strong> Every write is a consensus round through one leader. Adding servers improves fault tolerance and read capacity, and makes writes slower.",
                  "<strong>Not a queue.</strong> People build them anyway; they work at low rates and collapse when a single znode accumulates thousands of children.",
                  "<strong>Session expiry is subtle.</strong> A long garbage-collection pause can expire your session while your process is perfectly healthy — and by the time you notice, someone else may hold your lock. \"I am the leader\" is always a statement about the recent past.",
                  "<strong>Watches are one-shot and carry no payload.</strong> Treat every notification as \"something changed, go re-read\", never as the new value.",
                  "<strong>It is a hard dependency.</strong> Everything above it inherits its availability, which is an argument for keeping the number of systems that need it small."
                ]
              },
              { t: "note", variant: "trap", html: "<strong>Fencing tokens, again.</strong> Because the elected leader may not know it has been replaced, any resource that only one leader should write must reject stale writers. Carry the transaction id from the election as a monotonic token and have the resource refuse anything lower. This is the same conclusion the <a href='#/deepdives/stores/redis'>Redis lock discussion</a> reaches by a different route — it is a property of distributed locking, not of any product." },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["One instance must be active, others standby", "Yes", "\"Ephemeral sequential znodes for election, and a fencing token so a stale leader can't write.\""],
                  ["Cluster membership and shard ownership", "Yes", "\"Ephemeral nodes per member, so the live set is data rather than a heartbeat table I maintain.\""],
                  ["Configuration many services must agree on", "Yes", "\"Small versioned znodes with watches, so a change propagates without polling.\""],
                  ["Distributed lock across services", "Yes, with the caveat", "\"Sequential znodes give an ordered lock queue — and I still fence, because sessions can expire under load.\""],
                  ["Application data or user records", "No", "\"Wrong tool. Small critical metadata only; the data belongs in a datastore.\""],
                  ["High-throughput work distribution", "No", "\"Every write is a consensus round. That's a broker's job.\""],
                  ["A single service that just needs a lock", "Probably not", "\"A unique constraint or an advisory lock in the database I already run avoids a new dependency.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "A coordination service", items: ["Consensus-backed: safe leader election and membership", "Ephemeral nodes make liveness part of the data model", "Another cluster to run, and a hard dependency for everything above it", "Right when several systems must agree on the same fact"] },
                good: { title: "Your existing database", items: ["A row with a lease timestamp, renewed by the holder", "No new operational surface at all", "Correctness depends on your renewal and clock assumptions", "Right when exactly one service needs coordination"] }
              },
              { t: "p", html: "Modern equivalents of a coordination service expose a flat key space with leases and revision-numbered watches instead of a tree, and the same consensus underneath. The primitives and the trade-offs transfer directly; do not let a naming difference persuade you that the reasoning changed." },

              { t: "note", variant: "key", html: "<strong>Small, critical, agreed-upon facts — nothing else.</strong> The mechanism to name is consensus: every write is majority-agreed and totally ordered, which is why writes are slow and correct. The primitive to name is the ephemeral node, which turns liveness into data and makes leader election fall out of session expiry. And always add the fencing token, because winning an election is a statement about the past." }
            ]
          },

          /* ---------------- 9. API GATEWAY ---------------- */
          {
            id: "api-gateway",
            title: "The API gateway: one door, and the temptation behind it",
            summary: "Routing, auth offload, rate limiting, aggregation — and how gateways quietly become the monolith you left.",
            minutes: 10,
            tags: ["edge", "gateway", "api"],
            blocks: [
              { t: "p", html: "Once you have more than a couple of services, every one of them needs the same things: terminate TLS, authenticate the caller, enforce a quota, emit consistent metrics, handle CORS, version the public contract. Implementing that in each service means implementing it slightly differently in each service, and one of them will get authentication wrong. An <strong>API gateway</strong> is the single front door where those concerns are implemented once." },
              { t: "p", html: "The mental model: <strong>a reverse proxy with a policy chain</strong>. A request arrives, runs through an ordered list of filters, gets forwarded to an internal service, and the response runs back through the tail of the chain. Everything a gateway does is a filter in that chain — which is also why it is so easy to put things there that do not belong." },

              { t: "h", text: "The core mechanism: the request pipeline" },
              {
                t: "code", lang: "text", code:
                  "client\n" +
                  "  |\n" +
                  "  v\n" +
                  "[ TLS termination        ]  one certificate, one place to rotate it\n" +
                  "[ route match            ]  /api/v2/orders/*  -> orders-service\n" +
                  "[ authenticate           ]  verify the token signature, reject if invalid\n" +
                  "[ authorize (coarse)     ]  does this token have the orders scope at all?\n" +
                  "[ rate limit             ]  per key, per tenant, per route\n" +
                  "[ transform request      ]  strip client headers, inject a verified identity header\n" +
                  "  |\n" +
                  "  v  internal call, plaintext or mutual TLS, on the internal network\n" +
                  "orders-service   (fine-grained authorization happens HERE)\n" +
                  "  |\n" +
                  "  v\n" +
                  "[ transform response     ]  shape errors into one consistent envelope\n" +
                  "[ metrics, tracing, logs ]  one place that sees every request\n" +
                  "  |\n" +
                  "  v\n" +
                  "client"
              },
              { t: "note", variant: "warn", html: "<strong>The gateway does coarse authorization; the service does fine authorization.</strong> The gateway can verify that a token is valid and carries the right scope. It cannot know whether <em>this</em> user may cancel <em>that</em> order — that requires the order. Services that trust the gateway to have done the real check are one internal-network mistake away from a broken access-control model. Always authorise the resource where the resource lives." },

              { t: "h", text: "What it is genuinely good at" },
              {
                t: "ul", items: [
                  "<strong>Cross-cutting concerns, once.</strong> Token verification, quotas, CORS, request-id propagation, standard error envelopes — implemented in one place, enforced for every service including the one written last week.",
                  "<strong>Decoupling the public contract from internal structure.</strong> Split a service in two and the gateway absorbs the change; clients keep calling the same path.",
                  "<strong>Traffic control.</strong> Canary a percentage of traffic, shift between versions, apply circuit breaking and retry budgets, shed load under pressure — all at the point where every request is already visible.",
                  "<strong>Protocol adaptation.</strong> Public REST or GraphQL on the outside, whatever your services actually speak on the inside.",
                  "<strong>One observability point.</strong> Every request passes through here, so latency and error rate by route come free and consistently."
                ]
              },

              { t: "h", text: "Request aggregation, and its cost" },
              { t: "p", html: "A mobile home screen may need profile, recent orders and recommendations. Three round trips over a slow network is a visibly worse product than one, so the gateway fans out internally and returns a composed response. That is the backend-for-frontend pattern, and it is a legitimate use of the edge." },
              {
                t: "compare",
                bad: { title: "Aggregating in a shared gateway", items: ["One shared config every team must edit", "Response shape becomes a contract nobody owns", "Failure of one upstream muddies the whole response", "Business rules creep in one small exception at a time"] },
                good: { title: "A backend-for-frontend service", items: ["A real service owned by the client team, deployed on their schedule", "Free to shape responses per client without shared review", "Partial-failure handling is explicit code, not gateway configuration", "The generic gateway stays generic in front of it"] }
              },
              { t: "p", html: "Note the latency arithmetic too: a fan-out response is only as fast as its slowest branch, and it fails as often as the <em>union</em> of its dependencies. Aggregation trades round trips for a wider failure surface, so decide per branch what a partial failure renders." },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>Business logic accumulates.</strong> One eligibility rule, one field rename for an old client, one special case — and now the gateway config is a program no team owns and every team must change together. This is the failure mode, and it is gradual by nature.",
                  "<strong>It is a shared deployment bottleneck.</strong> Every change has global blast radius, so changes get slow, batched and risky at exactly the moment you want them to be small.",
                  "<strong>It is on the critical path of everything.</strong> If it is down, you are down. That demands multiple instances, health checking, and a configuration rollout process with a fast rollback.",
                  "<strong>Distributed rate limiting needs shared state.</strong> Accurate per-tenant limits across instances mean a shared counter store — usually <a href='#/deepdives/stores/redis'>Redis</a> — which is now a dependency of your front door.",
                  "<strong>Extra hop, extra latency.</strong> Usually small, but real, and it applies to every single request.",
                  "<strong>It does nothing for service-to-service calls.</strong> Internal traffic never passes through it, so internal retries, mutual TLS and circuit breaking are a separate problem."
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Several services behind one public API", "Yes", "\"One gateway for TLS, authentication and quotas, so services handle domain logic only.\""],
                  ["Public API with per-customer quotas", "Yes", "\"Rate limiting at the edge with a shared counter store, keyed by API key and route.\""],
                  ["Chatty mobile client on a slow network", "Yes, as a BFF", "\"A backend-for-frontend the client team owns, composing calls so the home screen is one request.\""],
                  ["Migrating a monolith to services", "Yes", "\"The gateway routes by path, so I move endpoints one at a time without clients noticing.\""],
                  ["Service-to-service reliability and encryption", "No", "\"That's east-west traffic. A service mesh or shared client library handles it; the gateway only sees north-south.\""],
                  ["A single service with one client", "No", "\"A load balancer with TLS termination. A gateway would add a hop and a component for no benefit yet.\""],
                  ["Complex per-request business rules", "No", "\"That belongs in the owning service. Logic at the edge turns the gateway into a shared monolith.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "API gateway (north-south)", items: ["Sits between external clients and your system", "Owns authentication, quotas, public routing and versioning", "One shared component on every external request", "Does not see internal service-to-service traffic"] },
                good: { title: "Service mesh (east-west)", items: ["Sidecar proxies alongside every service instance", "Owns mutual TLS, retries, timeouts, circuit breaking internally", "No central component on the request path", "Says nothing about your public API contract"] }
              },
              { t: "p", html: "These are complements, not competitors, and saying so is the point. Large systems typically run both: a gateway at the boundary and a mesh inside. Small systems need neither on day one, and knowing when to add each is more valuable than knowing what they are." },

              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"third-party developers\", \"API keys and quotas\", \"we need to version the public API\", \"the mobile app makes eight calls to render one screen\", or \"every service reimplements auth\". The first four want a gateway; the last one wants it urgently." },
              { t: "note", variant: "key", html: "<strong>Cross-cutting concerns yes, domain logic never.</strong> The gateway earns its place by implementing authentication, quotas, routing and observability once for everyone. It stops earning it the moment a rule that a product manager would recognise lives in its configuration — at that point you have rebuilt the monolith at the edge, where it is hardest to change and most expensive to break." },

              { t: "quiz", id: "deepdives-streams" }
            ]
          }
        ]
      },

      /* ============== MODULE 3 · SPECIALIZED STORES ============== */
      {
        id: "specialized",
        name: "Specialized Stores",
        icon: "cube",
        lessons: [

          /* ---------------- 10. GEOSPATIAL ---------------- */
          {
            id: "geospatial",
            title: "Geospatial indexes: making two dimensions fit a one-dimensional world",
            summary: "Geohash, quadtrees and grid cells; the radius-query pattern; and the boundary bug everyone ships.",
            minutes: 10,
            tags: ["geospatial", "indexing", "geohash"],
            blocks: [
              { t: "p", html: "\"Find everything within two kilometres of me\" looks like a filter and is actually an indexing problem. A B-tree sorts on one dimension, so an index on latitude finds a horizontal band across the entire planet and an index on longitude finds a vertical stripe. Intersecting them still leaves you scanning an enormous candidate set, because two independent one-dimensional ranges cannot express a circle." },
              { t: "p", html: "The mental model: <strong>chop the world into cells, give each cell a name you can index, and turn a spatial query into a lookup of a handful of cell names</strong>. Every technique below is a different way of choosing those cells, and all of them share the same two-phase query shape." },

              { t: "h", text: "The core mechanism: space-filling curves and subdivision" },
              { t: "p", html: "A <strong>geohash</strong> repeatedly halves the world — first by longitude, then by latitude, alternating — and records each choice as a bit. Interleaving those bits produces a single number that preserves locality: points close together usually share a long prefix. Encode it in base-32 and you get a short string that a plain string index can handle." },
              {
                t: "code", lang: "text", code:
                  "geohash prefix length -> approximate cell size\n" +
                  "\n" +
                  "  4 chars   ~  40 km      city region\n" +
                  "  5 chars   ~   5 km      district\n" +
                  "  6 chars   ~   1 km      neighbourhood\n" +
                  "  7 chars   ~ 150 m       street block\n" +
                  "  8 chars   ~  40 m       building\n" +
                  "\n" +
                  "  (cells are rectangles in lat/lon, so real width shrinks toward the poles)\n" +
                  "\n" +
                  "the prefix IS the containment hierarchy:\n" +
                  "  \"gcpvj\" contains \"gcpvj0\" ... \"gcpvjz\"\n" +
                  "  so \"everything in this district\" is a prefix range scan"
              },
              { t: "p", html: "A <strong>quadtree</strong> takes the other approach: recursively split a square into four quadrants, but only where the data is dense. A quiet rural area stays one large node while a city centre subdivides deeply. That adaptivity is its advantage — cells hold a roughly bounded number of points regardless of how skewed the data is — and its cost is a mutable tree structure that needs maintenance and usually lives in memory." },
              {
                t: "table",
                headers: ["Approach", "Mechanism", "Strength", "Weakness"],
                rows: [
                  ["Geohash", "Interleaved bits, base-32 string", "Works in any store with a string index; prefix = containment", "Fixed grid ignores density; cells distort toward the poles"],
                  ["Quadtree", "Recursive four-way split, density-driven", "Adapts to skew; bounded points per cell", "Mutable tree, rebalancing, usually in-memory"],
                  ["Hierarchical spherical cells", "Space-filling curve over a sphere", "Cell sizes stay consistent worldwide; clean containment", "Needs a library; cell ids are opaque to humans"],
                  ["Hexagonal grid", "Fixed hexagon hierarchy", "All six neighbours are equidistant — no corner anomaly", "Hexagons do not subdivide perfectly, so hierarchy is approximate"],
                  ["R-tree / bounding boxes", "Nested rectangles around geometries", "Handles polygons and lines, not just points", "Heavier index; overlapping boxes degrade with updates"]
                ]
              },

              { t: "h", text: "The radius query, in two phases" },
              {
                t: "ol", items: [
                  "<strong>Choose a precision</strong> whose cell size is comparable to your search radius. Too coarse and you fetch a city to answer a two-kilometre question; too fine and you must enumerate hundreds of cells.",
                  "<strong>Collect the candidate cells</strong> — the containing cell <em>plus its neighbours</em>. For a square grid that is nine cells, which guarantees coverage out to the cell size in every direction.",
                  "<strong>Fetch everything in those cells</strong> with an index lookup or prefix scan. This is the coarse filter and it is the part the index makes fast.",
                  "<strong>Compute true distance</strong> for each candidate and discard anything outside the radius. Cells are rectangles; your query is a circle; only this step reconciles them.",
                  "<strong>Sort and truncate</strong> to the nearest N."
                ]
              },
              { t: "note", variant: "trap", html: "<strong>The boundary bug is the one everyone ships.</strong> Query only the containing cell and a driver five metres away, on the other side of a cell edge, is invisible. It never shows up in testing because your test fixtures sit comfortably in the middle of cells, and in production it silently drops results near every border — which, across a whole city, is a large fraction of all queries. The neighbour step is not an optimisation; it is required for correctness." },
              { t: "p", html: "There is a second, subtler version of the same mistake: choosing precision per query without accounting for the radius. If the radius exceeds the cell size, nine cells no longer cover the circle and you need a wider ring. Derive the precision from the radius rather than hard-coding it." },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>Density skew.</strong> A fixed grid puts a hundred thousand drivers in one downtown cell and three in the cell next to it. The downtown cell becomes a hot key in exactly the sense described in the <a href='#/deepdives/stores/dynamodb'>DynamoDB lesson</a> — the fix is either an adaptive structure or finer precision in dense regions.",
                  "<strong>High-churn positions.</strong> Moving objects change cells constantly, so the index is write-heavy. Many systems keep live positions in memory and persist only periodically.",
                  "<strong>Distance is not travel time.</strong> Two kilometres across a river is not two kilometres. Spatial indexes give you candidates; routing gives you answers.",
                  "<strong>Antimeridian and poles.</strong> Longitude wraps and rectangles degenerate near the poles. Most services never notice; anything genuinely global has to handle it.",
                  "<strong>Polygons are a different problem.</strong> \"Which delivery zone contains this point?\" wants bounding-box indexing plus an exact point-in-polygon test, not a cell scheme."
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Nearby drivers or couriers, updating constantly", "Yes, cell-based in memory", "\"Cell id as the key, positions in memory, query the containing cell plus its neighbours, then filter by true distance.\""],
                  ["Store locator over a fixed dataset", "Yes, in the primary database", "\"A spatial index in Postgres. The data barely changes and it saves running another system.\""],
                  ["Geofencing and delivery zones", "Yes, but polygon-shaped", "\"Bounding-box index to shortlist zones, then exact point-in-polygon on the candidates.\""],
                  ["Global map tiles or heatmaps", "Yes, hierarchical cells", "\"A hierarchy where a zoom level maps to a precision, so aggregation happens per cell.\""],
                  ["Ranking by driving time", "Not alone", "\"The spatial index gets me candidates; a routing engine turns them into a ranked list.\""],
                  ["A few thousand static points", "No", "\"Compute distance to all of them. An index is overhead at that size.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "Geohash strings", items: ["Any store with a string index can do it — no special support", "Prefix scan gives you containment for free", "Fixed grid: dense cells stay dense", "Neighbour computation is fiddly and easy to get wrong"] },
                good: { title: "Quadtree / adaptive structures", items: ["Subdivides only where data is dense", "Bounded points per leaf regardless of skew", "Mutable structure needing maintenance and memory", "Neighbour traversal is a tree walk, not string arithmetic"] }
              },
              { t: "p", html: "For most interview problems the geohash answer is stronger, because it works inside a store you already have and you can explain the mechanism in thirty seconds. Reach for adaptive structures when you have said the words \"the density is extremely uneven\" and want to show you know what that costs." },

              { t: "note", variant: "key", html: "<strong>Cells turn a two-dimensional query into a small set of key lookups, and the query is always two phases.</strong> Coarse filter by cell, exact filter by real distance. Say the neighbour step explicitly — \"the containing cell plus the eight around it\" — because it is the detail that separates someone who has implemented this from someone who has read about it." }
            ]
          },

          /* ---------------- 11. TIME SERIES ---------------- */
          {
            id: "timeseries",
            title: "Time-series stores: append at the head, forget at the tail",
            summary: "Time partitioning, compression, rollups, retention tiers — and cardinality, the thing that actually kills you.",
            minutes: 10,
            tags: ["timeseries", "metrics", "cardinality"],
            blocks: [
              { t: "p", html: "Time-series data has a shape unlike anything else you store: writes almost always append at the current moment, records are essentially never updated, queries are ranges over recent time, and results are aggregates rather than individual rows. Almost every design decision in a time-series database falls out of exploiting that shape, and almost every failure comes from a workload that does not actually have it." },
              { t: "p", html: "The mental model: <strong>a stack of time buckets where only the top one is being written</strong>. Everything behind the head is immutable, which means it can be compressed hard, summarised, tiered onto cheaper storage, and eventually deleted as a whole unit." },

              { t: "h", text: "The core mechanism: partition by time, then compress the past" },
              {
                t: "code", lang: "text", code:
                  "chunk 2026-08-29  [ HOT   ]  in memory, receiving every write\n" +
                  "chunk 2026-08-28  [ WARM  ]  sealed, compressed, on fast disk\n" +
                  "chunk 2026-08-27  [ WARM  ]\n" +
                  "  ...\n" +
                  "chunk 2026-06-*   [ COLD  ]  downsampled to 1-minute rollups\n" +
                  "chunk 2025-*      [ FROZEN]  1-hour rollups on object storage\n" +
                  "chunk 2023-*      [ GONE  ]  dropped -- a metadata operation, not a mass delete\n" +
                  "\n" +
                  "why this shape wins:\n" +
                  "  * the write-hot region is small enough to stay in memory\n" +
                  "  * sealed chunks never change, so they compress aggressively\n" +
                  "  * expiry drops a whole chunk instead of deleting a billion rows\n" +
                  "  * a range query touches only the chunks that overlap it"
              },
              { t: "p", html: "Compression is dramatic here for two structural reasons. Timestamps arrive at near-regular intervals, so storing the <em>difference between successive differences</em> usually costs a bit or two per point. Values from the same sensor change slowly, so storing the bitwise difference between consecutive floats leaves mostly zeros. Columnar layout lets both apply to long runs at once, and order-of-magnitude space savings over row storage are routine." },

              { t: "h", text: "Rollups and retention tiers" },
              { t: "p", html: "Nobody needs per-second resolution for last year, but everyone wants to see last year. <strong>Downsampling</strong> precomputes coarser aggregates and keeps them after the raw data expires, so a query picks whichever resolution matches its range." },
              {
                t: "table",
                headers: ["Tier", "Resolution", "Kept for", "Answers"],
                rows: [
                  ["Raw", "1 second", "Days", "\"What happened during the incident at 14:32?\""],
                  ["Rollup", "1 minute", "Weeks to a month", "\"How did last week's deploys affect latency?\""],
                  ["Rollup", "1 hour", "A year or more", "\"Is traffic growing quarter over quarter?\""],
                  ["Rollup", "1 day", "Years", "\"Capacity planning and long-term trend.\""]
                ]
              },
              { t: "note", variant: "tip", html: "<strong>Decide which aggregates to precompute, not just the interval.</strong> Minimum, maximum, sum and count all roll up cleanly — you can combine hourly sums into a daily sum. Averages need the sum and the count kept separately, and <em>percentiles do not roll up at all</em>: an average of hourly p99s is not the daily p99. If percentiles matter, store a mergeable sketch of the distribution rather than the computed number." },

              { t: "h", text: "Cardinality: the thing that actually kills you" },
              { t: "p", html: "A <strong>series</strong> is identified by the metric name plus the complete set of label values. Every distinct combination is a separate stream with its own index entry, its own compression buffer and its own in-memory head chunk. Series count — not data volume — is what determines whether your metrics system survives." },
              {
                t: "code", lang: "text", code:
                  "http_requests_total{service, endpoint, method, status}\n" +
                  "\n" +
                  "  20 services x 50 endpoints x 5 methods x 8 statuses\n" +
                  "    = 40,000 series                     fine\n" +
                  "\n" +
                  "someone adds one label: user_id\n" +
                  "\n" +
                  "  40,000 x 2,000,000 users\n" +
                  "    = 80,000,000,000 series            the ingest node dies\n" +
                  "\n" +
                  "the multiplication is the point. every label multiplies, never adds."
              },
              { t: "note", variant: "warn", html: "<strong>Never put an unbounded identifier in a label.</strong> User id, request id, session id, order id, a raw URL with query parameters, an error message, a container id that changes every deploy. The label set must be small and enumerable — you should be able to say roughly how many distinct values it can ever have. High-cardinality identifiers belong in logs and traces, which are built for exactly that and indexed completely differently." },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>Backfill and out-of-order writes.</strong> The write path assumes the head chunk. Loading a month of historical data means reopening sealed chunks, which is slow at best and rejected at worst.",
                  "<strong>Updates and deletes of individual points.</strong> Compressed columnar chunks are not designed to be edited. If corrections are routine, this is the wrong store.",
                  "<strong>Queries that are not time-ranged.</strong> \"Find every point where value exceeded 500, ever\" ignores the partitioning entirely and scans everything.",
                  "<strong>Point lookups by a non-time key.</strong> If you want one row by id, this is a table, not a time series.",
                  "<strong>Long-range high-resolution queries.</strong> Plotting a year of per-second data is millions of points nobody can see. Force the query to the right rollup tier rather than letting it run.",
                  "<strong>Label churn from deploys.</strong> A label containing a version or a pod identity creates a fresh series on every release. It looks harmless and compounds every day."
                ]
              },
              {
                t: "stat", items: [
                  { v: "~1–2 bytes", k: "typical compressed size per point" },
                  { v: "×", k: "labels multiply, never add" },
                  { v: "1 chunk", k: "what a retention drop costs" },
                  { v: "0", k: "percentiles that roll up correctly" }
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Infrastructure and application metrics", "Yes", "\"Time-partitioned chunks, rollups for long ranges, and a hard rule that labels stay low-cardinality.\""],
                  ["IoT sensor readings at high volume", "Yes", "\"Append-only and time-ordered — exactly the shape these stores are built to compress.\""],
                  ["Financial tick data", "Yes", "\"Columnar time partitions with rollups per interval; queries are almost always time ranges.\""],
                  ["Product analytics with per-user drill-down", "No", "\"Per-user means unbounded cardinality. That's an event store or a warehouse, not a metrics store.\""],
                  ["Audit log I must query by actor", "No", "\"Time-ordered but queried by identity — that's a log store with an index on the actor.\""],
                  ["A dozen counters on one service", "No", "\"A table with a timestamp column. Specialised storage earns its place at volume.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "A regular table in your database", items: ["No new system; joins to your other data work normally", "Fine to millions of rows with a good index on time", "Row storage compresses poorly; the index grows forever", "Deleting old data by predicate is expensive and locks things up"] },
                good: { title: "A purpose-built time-series store", items: ["Automatic time partitioning and chunk lifecycle", "Delta and XOR compression tuned for this data shape", "Downsampling, retention tiers and expiry built in", "Another system to run, and a cardinality budget to police"] }
              },
              { t: "p", html: "There is a middle path worth naming: a time-series extension over a relational database, which keeps joins to your existing tables while adding partitioning, compression and retention. It is often the strongest answer for a team that already runs <a href='#/deepdives/stores/postgres'>Postgres</a> and does not want a second operational surface." },

              { t: "note", variant: "key", html: "<strong>Time partitioning is the mechanism; cardinality is the ceiling.</strong> Partitioning by time keeps writes in one small hot chunk and makes the rest immutable, compressible and droppable. Then say the sentence that shows you have operated one: labels multiply, so an unbounded label like user id creates a series per user and takes the system down — and it is the most common way metrics systems die." }
            ]
          },

          /* ---------------- 12. VECTOR DB ---------------- */
          {
            id: "vector-db",
            title: "Vector databases: approximate answers, on purpose",
            summary: "Embeddings, the index families, the recall-versus-latency knob, and why filtered search is genuinely hard.",
            minutes: 11,
            tags: ["vectors", "ann", "search"],
            blocks: [
              { t: "p", html: "A model turns content — text, an image, audio — into a fixed-length list of numbers such that similar content lands nearby in that space. Search then stops being \"which documents contain this word\" and becomes \"which vectors are closest to this vector\". That is how you retrieve a passage that answers a question without sharing any words with it." },
              { t: "p", html: "The mental model: <strong>a nearest-neighbour index that trades exactness for speed, deliberately</strong>. Unlike every other index in this track, a vector index is <em>allowed to be wrong</em>. It may miss a true nearest neighbour, and how often it does is a number you choose. Internalising that is the whole lesson." },

              { t: "h", text: "The core mechanism: why exact search does not scale" },
              { t: "p", html: "Exact nearest-neighbour search compares the query against every stored vector: cost proportional to the number of vectors times the number of dimensions. That is genuinely fine at small scale — tens or hundreds of thousands of vectors on modern hardware — and it is exact, which makes it the baseline you measure everything else against. At tens of millions it stops being viable per query, and the alternative is to examine only a small, cleverly chosen fraction of the space." },
              {
                t: "code", lang: "text", code:
                  "storage arithmetic, worth doing out loud:\n" +
                  "\n" +
                  "  768 dimensions x 4 bytes (float32) = ~3 KB per vector\n" +
                  "  10,000,000 vectors                 = ~30 GB of raw vectors\n" +
                  "  graph index overhead               = often another 30-100%\n" +
                  "\n" +
                  "  -> this is a memory-resident problem, and memory is the bill\n" +
                  "\n" +
                  "reduce it by:\n" +
                  "  smaller embedding dimension    (retrain or truncate; costs recall)\n" +
                  "  quantize to 8-bit or lower     (big savings; costs recall)\n" +
                  "  keep compressed codes in RAM, exact vectors on disk, rerank the top few"
              },

              { t: "h", text: "The index families, conceptually" },
              {
                t: "table",
                headers: ["Family", "Idea", "Strength", "Cost"],
                rows: [
                  ["Graph-based", "Build a navigable graph of neighbours across layers; greedily walk toward the query", "Excellent recall at low latency — the common default", "High memory; expensive to build; deletions leave tombstones"],
                  ["Cluster / inverted file", "Cluster vectors, store a list per centroid, search only the nearest few clusters", "Modest memory; one clear tuning parameter", "Misses neighbours sitting just across a cluster boundary"],
                  ["Quantization", "Compress each vector into a short code; compare codes instead of floats", "Order-of-magnitude memory savings", "Lossy — normally paired with a rerank on exact vectors"],
                  ["Hashing", "Hash functions designed so similar vectors collide", "Simple, easy to reason about, cheap to build", "Generally needs more space for comparable recall in practice"]
                ]
              },
              { t: "p", html: "In production these compose rather than compete: cluster to narrow the search, quantize to fit in memory, then rerank the top few hundred candidates against exact vectors to recover the precision the compression cost you." },

              { t: "h", text: "The knob: recall versus latency" },
              { t: "p", html: "Every approximate index exposes one parameter that controls how much of the space it examines — how many clusters to probe, how wide to keep the search frontier. Turning it up finds more true neighbours and costs proportionally more time. There is no default that is correct for your data." },
              {
                t: "table",
                headers: ["Setting", "Recall", "Latency", "When it is right"],
                rows: [
                  ["Low", "Perhaps 0.80–0.90", "Fastest", "Recommendations, feed candidates — a missed item is invisible to the user"],
                  ["Medium", "Around 0.95", "Moderate", "Most retrieval: the answer is usually in the top few anyway"],
                  ["High", "0.99+", "Slowest", "Legal, medical, compliance — a missed document is a real failure"],
                  ["Exact", "1.00", "Linear in collection size", "Small collections, or the ground truth you measure recall against"]
                ]
              },
              { t: "note", variant: "tip", html: "<strong>Measure recall; do not assume it.</strong> Take a sample of real queries, compute exact nearest neighbours by brute force, and check what fraction your index returns. \"We target 95% recall at 20 ms and verify it against a brute-force baseline weekly\" is a sentence that ends the conversation. \"We use an approximate index\" is not." },

              { t: "h", text: "Filtered search: harder than it looks" },
              { t: "p", html: "\"Nearest ten documents where <code class='tok'>language = 'de'</code> and <code class='tok'>status = 'active'</code>\" is the query everyone actually needs, and it fights the index directly. The index was built over the whole collection; its graph edges and cluster assignments know nothing about your predicate." },
              {
                t: "compare",
                bad: { title: "Post-filter: search, then filter", items: ["Fetch the top K by similarity, drop non-matching", "Fast, and needs no index changes at all", "A selective filter can leave you with almost nothing", "Compensating by fetching top 10,000 is just a slow scan wearing a disguise"] },
                good: { title: "Pre-filter: filter, then search", items: ["Apply the predicate first, search only survivors", "Always returns a full result set if enough documents match", "The index cannot be traversed over an arbitrary subset efficiently", "A small survivor set degrades to brute force — which is fine, if it is small"] }
              },
              { t: "p", html: "Real engines implement filtered traversal — walking the graph while skipping non-matching nodes — which works well for mild filters and degrades as selectivity rises, because the graph's connectivity assumes all nodes are reachable. The honest interview answer is: \"filtered vector search is the hard part; for highly selective filters I'd partition the index by that attribute so the filter becomes index selection rather than a predicate.\" Partitioning by tenant, language or region is the practical move." },

              { t: "h", text: "Where it breaks" },
              {
                t: "ul", items: [
                  "<strong>Changing the embedding model invalidates everything.</strong> Vectors from two models are not comparable, so a model upgrade is a full reindex, plus a dual-write or shadow period if you cannot take downtime.",
                  "<strong>Updates and deletes are awkward.</strong> Graph indexes handle removal with tombstones and need periodic rebuilds; a high-churn collection spends real resources on maintenance.",
                  "<strong>Similarity is not relevance.</strong> The nearest vector can be topically close and factually useless. Serious systems combine vector retrieval with keyword matching and rerank the merged list — the keyword side being exactly what <a href='#/deepdives/stores/elasticsearch'>an inverted index</a> is for.",
                  "<strong>Memory is the dominant cost.</strong> See the arithmetic above. Scaling here means paying for RAM or accepting recall loss from quantization.",
                  "<strong>No transactions, no joins, weak durability stories.</strong> Same conclusion as the search index: this is a derived index over a system of record, not the system of record.",
                  "<strong>Cold-start and drift.</strong> Embedding quality depends entirely on the model matching your domain. A general model on specialised jargon retrieves confidently wrong results."
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Retrieval for a question-answering assistant", "Yes", "\"Chunk, embed, index; retrieve top-k with a recall target, then rerank before it reaches the model.\""],
                  ["Semantic search over a large document corpus", "Yes, hybrid", "\"Vector plus keyword retrieval, merged and reranked — pure vector search misses exact identifiers.\""],
                  ["Visually similar product recommendations", "Yes", "\"Image embeddings with an approximate index; low recall is acceptable because near-misses still look right.\""],
                  ["Near-duplicate detection at scale", "Yes", "\"Embed and search a tight radius; a false negative is cheap and a false positive is human-reviewed.\""],
                  ["Under a hundred thousand vectors", "Not a dedicated system", "\"Exact search is fast enough at that size, or a vector index inside the database I already run.\""],
                  ["Exact filters on structured attributes", "No", "\"That's a normal predicate. Filter in a real database and only use vectors for the similarity part.\""],
                  ["Results must be complete and auditable", "No", "\"Approximate search can miss documents by design. If completeness is a requirement, I need exact retrieval.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "A dedicated vector database", items: ["Purpose-built indexes with fine-grained tuning", "Scales to hundreds of millions of vectors", "Another system, another copy of the data, another sync path", "Worth it when vector search is a core product capability"] },
                good: { title: "A vector index in a store you already run", items: ["Vectors sit beside the rows they belong to — filters and joins just work", "One system, one backup, one consistency story", "Lower ceiling on scale and less index tuning available", "Usually the right first move, and often the last one you need"] }
              },
              { t: "p", html: "The strong answer starts with the existing store and names the specific threshold that would force a move: collection size, tail latency at the required recall, or filtered-search performance under real selectivity." },

              { t: "note", variant: "key", html: "<strong>Approximate on purpose, with one knob and one hard problem.</strong> The knob is how much of the space you examine, which trades recall against latency and must be measured against a brute-force baseline. The hard problem is filtered search: the index was built over everything, so a selective predicate either starves your results or forces a scan — partition the index by the filter attribute when that predicate matters." }
            ]
          },

          /* ---------------- 13. PROBABILISTIC ---------------- */
          {
            id: "probabilistic",
            title: "Probabilistic structures: buying space with uncertainty",
            summary: "Bloom filters, count-min sketch and HyperLogLog — what each guarantees, and precisely what it does not.",
            minutes: 11,
            tags: ["sketches", "bloom", "hyperloglog"],
            blocks: [
              { t: "p", html: "Exact answers to set questions cost memory proportional to the data. Tracking whether you have seen each of a billion urls means storing a billion urls. Sketches make a different bargain: <strong>constant, tiny memory in exchange for a bounded, quantified error</strong>. The reason to know them is that the error is usually one-sided in exactly the direction that makes it safe to use." },
              { t: "p", html: "The mental model: <strong>lossy compression for questions rather than data</strong>. You throw away the ability to enumerate what you stored and keep only the ability to answer one narrow question approximately. Each structure answers a different question, and using the wrong one is the mistake to avoid." },

              { t: "h", text: "Bloom filter: does this key definitely not exist?" },
              { t: "p", html: "A bit array of length <code class='tok'>m</code> and <code class='tok'>k</code> independent hash functions. To add a key, hash it <code class='tok'>k</code> times and set those bits. To query, hash it <code class='tok'>k</code> times and look." },
              {
                t: "code", lang: "text", code:
                  "add(\"alice\")   -> bits 3, 11, 27 := 1\n" +
                  "add(\"bob\")     -> bits 7, 11, 40 := 1\n" +
                  "\n" +
                  "query(\"carol\") -> bits 3, 19, 27  -> bit 19 is 0\n" +
                  "                  => carol was DEFINITELY never added.  Exact. No exceptions.\n" +
                  "\n" +
                  "query(\"dave\")  -> bits 3, 11, 40  -> all three are 1\n" +
                  "                  => dave MIGHT have been added.\n" +
                  "                     those bits were set by alice and bob. false positive.\n" +
                  "\n" +
                  "the asymmetry, stated exactly:\n" +
                  "  \"not present\" -> certain     (no false negatives, ever)\n" +
                  "  \"present\"     -> probable    (false positives at a rate you choose)"
              },
              { t: "note", variant: "tip", html: "<strong>Say the asymmetry precisely or not at all.</strong> A Bloom filter never produces a false negative — if it says no, the key was never added, because adding it would have set every one of those bits. It does produce false positives, because other keys can collectively set all of your key's bits. That direction is what makes it safe as a gate in front of an expensive lookup: a \"no\" saves the lookup, and a \"yes\" merely means you do the lookup you would have done anyway." },
              { t: "widget", id: "bloom" },
              { t: "p", html: "Where Bloom filters earn their keep in a design:" },
              { t: "ul", items: [
                "<strong>Cache-penetration guard</strong> \u2014 skip the database for keys that definitely do not exist, so a flood of lookups for missing ids never reaches storage.",
                "<strong>LSM storage engines</strong> (Cassandra, HBase, Bigtable, RocksDB) \u2014 one filter per SSTable lets a read skip files that cannot hold the key.",
                "<strong>Seen-before checks</strong> \u2014 \u201chas this crawler visited this url?\u201d or \u201chas this user already been shown this item?\u201d over a huge key space.",
                "<strong>Large deny lists</strong> \u2014 malicious-url or breached-password lists checked locally before a slower authoritative lookup."
              ] },
              { t: "p", html: "The sizing formulas are worth memorising, because the size depends only on the item count and the target error rate — <em>never on how large the items are</em>. A filter over a billion 200-byte urls is the same size as one over a billion 8-byte integers." },
              {
                t: "code", lang: "text", code:
                  "  m = -n * ln(p) / (ln 2)^2      bits required\n" +
                  "  k = (m / n) * ln 2             optimal number of hashes\n" +
                  "\n" +
                  "  p = 1%    -> ~9.6 bits per key     (~1.2 MB per million keys)\n" +
                  "  p = 0.1%  -> ~14.4 bits per key    (~1.8 MB per million keys)\n" +
                  "  p = 0.01% -> ~19.2 bits per key    (~2.4 MB per million keys)\n" +
                  "\n" +
                  "note the shape: every 10x improvement in error costs a fixed ~4.8 bits per key.\n" +
                  "accuracy is cheap. this is why the structure is everywhere."
              },
              { t: "widget", id: "deepBloomLab" },
              { t: "p", html: "Two limits to state out loud. First, you cannot delete: clearing a bit could clear it for another key and create a false negative, destroying the one guarantee you had. A counting variant replaces bits with small counters at several times the space. Second, you cannot resize: the filter is sized for <code class='tok'>n</code> at build time, and exceeding <code class='tok'>n</code> degrades the false-positive rate steadily until the array saturates and every answer is \"maybe\". Size for growth, or use a scalable variant that chains filters." },

              { t: "h", text: "Count-min sketch: roughly how many times?" },
              { t: "p", html: "A two-dimensional array of counters — <code class='tok'>d</code> rows, each with its own hash function and <code class='tok'>w</code> counters. To record an event, increment one counter in each row. To estimate a count, take the <strong>minimum</strong> across the rows, because every counter may have been inflated by collisions and the smallest one is the least contaminated." },
              {
                t: "table",
                headers: ["Property", "Count-min sketch"],
                rows: [
                  ["Error direction", "Overestimates only — never reports fewer than the true count (for non-negative counts)"],
                  ["Width (counters per row)", "Controls how large the overestimate can be"],
                  ["Depth (number of rows)", "Controls how confident you are of staying within that bound"],
                  ["Memory", "Fixed, chosen up front — independent of how many distinct keys arrive"],
                  ["Good at", "Heavy hitters: which keys are hot right now"],
                  ["Bad at", "Rare keys — their true count is small, so collision noise dominates it"]
                ]
              },
              { t: "p", html: "The natural application is finding the top talkers in a stream: per-key rate limiting on an unbounded key space, detecting hot partitions, spotting trending items. You are asking \"which keys are large?\", and the overestimate bias is harmless because a heavy hitter is heavy either way." },

              { t: "h", text: "HyperLogLog: how many distinct things?" },
              { t: "p", html: "Counting distinct items exactly requires remembering every item. HyperLogLog remembers none of them. Hash each item and observe the position of the first set bit in the hash; long runs of leading zeros are rare, so seeing one implies you have hashed many distinct values. Maintain many independent registers holding the maximum run seen, combine them with a harmonic mean, and you get a cardinality estimate." },
              {
                t: "stat", items: [
                  { v: "~12 KB", k: "typical fixed memory" },
                  { v: "under 1%", k: "typical standard error" },
                  { v: "billions", k: "cardinalities it handles" },
                  { v: "mergeable", k: "union by taking register maxima" }
                ]
              },
              { t: "p", html: "Mergeability is the property that matters operationally and the one candidates forget. Each server keeps its own sketch; combining them is a register-wise maximum, which means daily unique visitors is the merge of twenty-four hourly sketches, and global uniques is the merge of every region's sketch. No re-scanning, no coordination, no shuffling raw ids across the network. Intersections, by contrast, are not directly supported and estimating them via inclusion-exclusion amplifies the error badly." },

              { t: "h", text: "Where they break" },
              {
                t: "ul", items: [
                  "<strong>They cannot enumerate.</strong> None of these can tell you <em>which</em> items they saw. If someone will ask \"show me the list\", a sketch is the wrong answer.",
                  "<strong>Sizing is a commitment.</strong> A Bloom filter sized for ten million keys and fed a hundred million becomes a device that says \"maybe\" to everything, silently, with no error raised.",
                  "<strong>Deletion is broadly unsupported.</strong> Counting variants exist and cost more space; plain structures assume the set only grows.",
                  "<strong>The error is statistical, not worst-case per key.</strong> A 1% false-positive rate does not mean one specific key you care about is 99% safe — it may be a permanent false positive.",
                  "<strong>Small cardinalities need care.</strong> Estimators are biased at low counts; production implementations switch to exact counting below a threshold, and a hand-rolled one usually does not.",
                  "<strong>Hash quality matters.</strong> Every guarantee assumes well-distributed independent hashes. A weak hash quietly wrecks the error bounds."
                ]
              },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Avoid disk reads for keys that do not exist", "Yes, Bloom", "\"A Bloom filter in front of the store: a negative is certain, so most misses never touch disk.\""],
                  ["\"Have we already processed this event id?\"", "Yes, Bloom, with a caveat", "\"Bloom to skip the obvious duplicates, then an exact check on a hit — false positives cost a lookup, not correctness.\""],
                  ["Unique visitors per day across many servers", "Yes, HyperLogLog", "\"Twelve kilobytes per sketch, under one percent error, and merging shards is a register-wise maximum.\""],
                  ["Which api keys are hammering us right now", "Yes, count-min", "\"Fixed memory over an unbounded key space, and it overestimates — so heavy hitters can't hide.\""],
                  ["Detecting a hot partition in a stream", "Yes, count-min", "\"Sketch the key distribution per window and alert on the top talkers.\""],
                  ["Billing customers per unique user", "No", "\"An approximate count is not a number I'd put on an invoice. Exact counting, in a warehouse.\""],
                  ["\"List the users who did X\"", "No", "\"Sketches don't retain members. That needs a real set or a query.\""],
                  ["Under a million keys", "Probably not", "\"An exact hash set fits in memory. The sketch adds error to save memory I already have.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "An exact set or counter", items: ["Perfect answers, and it can enumerate members", "Memory grows linearly with the data", "Merging across servers means shipping the members", "Right below the scale where memory hurts"] },
                good: { title: "A sketch", items: ["Fixed memory decided in advance", "One-sided, quantified error you choose up front", "Merges cheaply and commutatively across shards", "Right when the exact answer costs more than it is worth"] }
              },
              { t: "p", html: "The tell is always the same: the question is a summary rather than a lookup, the key space is unbounded, and being slightly wrong in a known direction is cheaper than being exactly right. That is also exactly why <a href='#/deepdives/stores/cassandra'>LSM storage engines</a> put a Bloom filter on every file on disk." },

              { t: "note", variant: "key", html: "<strong>Three structures, three questions, one shared bargain.</strong> Bloom answers membership with no false negatives — a \"no\" is proof and a \"yes\" is a hint. Count-min answers frequency with overestimates only, which makes heavy hitters reliable and rare keys noisy. HyperLogLog answers cardinality in kilobytes and merges by taking maxima. In every case you gave up enumeration and bought fixed memory; say what you gave up and the trade sounds deliberate." }
            ]
          },

          /* ---------------- 14. CDC ---------------- */
          {
            id: "cdc",
            title: "Change data capture: how all of this fits together",
            summary: "Log-based versus query-based capture, the outbox pattern, and the ordering and idempotency rules downstream.",
            minutes: 12,
            tags: ["cdc", "outbox", "integration"],
            blocks: [
              { t: "p", html: "Everything in this track has pointed here. Postgres holds the truth but cannot rank search results. Elasticsearch ranks beautifully but must never be the truth. A vector index needs embeddings of rows that keep changing. A cache has to be invalidated. A time-series store wants aggregates of events that happened in a transactional database. Every one of those is the same problem: <strong>how does a change in one system reliably become a change in another?</strong>" },
              { t: "p", html: "The mental model: <strong>your database already keeps a perfect, ordered record of everything that changed — read that instead of asking the application to tell you twice</strong>. Change data capture turns the storage engine's internal log into an event stream that other systems can subscribe to." },

              { t: "h", text: "The problem it solves: the dual write" },
              {
                t: "code", lang: "text", code:
                  "the broken pattern, in every codebase:\n" +
                  "\n" +
                  "  db.insert(order)            -- succeeds\n" +
                  "  kafka.publish(orderEvent)   -- process dies here\n" +
                  "\n" +
                  "  -> the order exists. no downstream system ever hears about it.\n" +
                  "     search index missing it, email never sent, analytics undercounts.\n" +
                  "\n" +
                  "reverse the order and it is still broken:\n" +
                  "\n" +
                  "  kafka.publish(orderEvent)   -- succeeds\n" +
                  "  db.insert(order)            -- fails on a constraint\n" +
                  "\n" +
                  "  -> downstream systems process an order that does not exist.\n" +
                  "\n" +
                  "there is no ordering of two independent systems that is atomic.\n" +
                  "retries and finally blocks narrow the window. they do not close it."
              },
              { t: "note", variant: "trap", html: "<strong>\"We retry the publish\" is not a fix, and neither is a distributed transaction.</strong> Retries help when the process survives; they do nothing when it does not. Two-phase commit across a database and a broker is technically expressible and operationally miserable — it makes both systems' availability a shared fate and stalls on coordinator failure. The workable answer removes the second system from the critical path instead." },

              { t: "h", text: "The outbox pattern" },
              { t: "p", html: "Write the event <em>into the same database, in the same transaction</em> as the business change. Now there is only one system, so atomicity is something the database already guarantees. A separate relay publishes rows from that table afterwards." },
              {
                t: "code", lang: "text", code:
                  "BEGIN;\n" +
                  "  INSERT INTO orders (id, customer_id, total, status)\n" +
                  "       VALUES (8821, 42, 149.90, 'placed');\n" +
                  "\n" +
                  "  INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, payload)\n" +
                  "       VALUES (gen_random_uuid(), 'order', '8821', 'OrderPlaced', '{...}');\n" +
                  "COMMIT;          -- both rows, or neither. no window.\n" +
                  "\n" +
                  "relay (a CDC connector on the outbox table, or a poller):\n" +
                  "  read new outbox rows in commit order\n" +
                  "  publish to Kafka, keyed by aggregate_id\n" +
                  "  mark published / let retention clean up\n" +
                  "\n" +
                  "the relay can crash and republish -> AT-LEAST-ONCE.\n" +
                  "consumers must be idempotent. this is not optional."
              },
              { t: "p", html: "The outbox also buys you something CDC on business tables cannot: <strong>you choose the event schema</strong>. A raw row change exposes your internal column names to every consumer, which turns a routine refactor into a breaking change for four teams. An outbox event is a deliberate contract you can version." },

              { t: "h", text: "Log-based versus query-based capture" },
              {
                t: "table",
                headers: ["", "Log-based (read the write-ahead log)", "Query-based (poll a timestamp column)"],
                rows: [
                  ["Captures deletes", "Yes", "No — the row is simply gone"],
                  ["Captures intermediate states", "Yes, every change in order", "No — only the value at poll time"],
                  ["Load on the source", "Minimal; it reads a log the database writes anyway", "Real query load, growing with poll frequency"],
                  ["Latency", "Sub-second is normal", "Bounded below by the polling interval"],
                  ["Ordering", "Commit order, exactly as the database applied it", "Timestamp order, which is not commit order"],
                  ["Setup", "Replication privileges, a connector, log retention tuning", "A trigger-free query and an indexed column"],
                  ["Correctness risk", "Schema evolution and log retention must be managed", "A row committed with an older timestamp after your watermark is skipped silently"]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>The query-based silent-skip is worth understanding, because it looks fine for months.</strong> A long transaction stamps <code class='tok'>updated_at</code> when it starts but becomes visible when it commits. If your poller has already advanced past that timestamp, the row is never seen — no error, no gap you can detect, just a permanently missing record. Polling is acceptable for low-stakes replication; anything that must be complete wants the log." },

              { t: "h", text: "What downstream consumers owe you" },
              {
                t: "ol", items: [
                  "<strong>Key by the entity id.</strong> Publish every change for a given row to the same partition — see <a href='#/deepdives/streams/kafka'>the partitioned log</a> — so per-row order is preserved. Global order across rows is neither available nor usually needed.",
                  "<strong>Be idempotent.</strong> At-least-once means duplicates are normal, not exceptional. Upsert by primary key rather than insert; if the effect is not naturally idempotent, deduplicate on an event id.",
                  "<strong>Carry a monotonic version.</strong> Include the source log position or a row version in every event and refuse to apply anything older than what you have already applied. This is what makes a replay safe rather than destructive.",
                  "<strong>Handle deletes explicitly.</strong> A deletion event has no useful payload. Decide whether downstream removes the record or marks it inactive, and make sure a replay of an old update cannot resurrect it — the version check above is what enforces that.",
                  "<strong>Plan the initial load.</strong> A new consumer needs history it was not around for: snapshot the table, then stream from the log position recorded at snapshot time. The handoff must overlap, and idempotency is what makes the overlap safe."
                ]
              },
              { t: "note", variant: "trap", html: "<strong>Schema changes propagate too, and they will surprise someone.</strong> A dropped column, a renamed field, a type widening — all become events that consumers must tolerate. Version your event schema, add fields rather than repurposing them, and give consumers a rule for unknown fields. This is precisely the argument for the outbox: an explicit contract instead of your table structure leaking outward." },

              { t: "h", text: "Putting the whole track together" },
              { t: "p", html: "Here is the architecture these fourteen technologies form. Every arrow is change data capture, and every box is doing the one thing it is genuinely good at." },
              {
                t: "code", lang: "text", code:
                  "                       clients\n" +
                  "                          |\n" +
                  "                   [ API GATEWAY ]  auth, quotas, routing\n" +
                  "                          |\n" +
                  "                      services\n" +
                  "                     /        \\\n" +
                  "          [ POSTGRES ]        [ REDIS ]  cache, limits, leaderboards\n" +
                  "          truth + outbox\n" +
                  "                |\n" +
                  "             (CDC on the outbox table)\n" +
                  "                |\n" +
                  "          [ KAFKA ]  partitioned log, keyed by entity id, retained\n" +
                  "            |   |   |   |   |\n" +
                  "            |   |   |   |   +--> [ VECTOR INDEX ]   embeddings for retrieval\n" +
                  "            |   |   |   +------> [ TIME SERIES  ]   rolled-up business metrics\n" +
                  "            |   |   +----------> [ FLINK        ]   event-time aggregation\n" +
                  "            |   +--------------> [ CASSANDRA    ]   denormalized read models\n" +
                  "            +------------------> [ ELASTICSEARCH]   search index, rebuildable\n" +
                  "\n" +
                  "  [ ZOOKEEPER-class store ]  leader election, shard maps, config\n" +
                  "  [ BLOOM / HLL sketches  ]  dedupe on replay, unique counts per window"
              },
              {
                t: "table",
                headers: ["Concern", "Where it lives", "Why there and not elsewhere"],
                rows: [
                  ["Invariants and money", "<a href='#/deepdives/stores/postgres'>Postgres</a>", "Transactions and constraints; one writer is fine at this volume"],
                  ["Hot reads, counters, limits", "<a href='#/deepdives/stores/redis'>Redis</a>", "In-memory structures; losing it costs latency, not data"],
                  ["Reliable propagation of change", "Outbox + <a href='#/deepdives/streams/kafka'>Kafka</a>", "One transaction, then a replayable log every consumer reads independently"],
                  ["Search and ranking", "<a href='#/deepdives/stores/elasticsearch'>Elasticsearch</a>", "Inverted index and relevance; fully rebuildable from the log"],
                  ["Huge write-rate read models", "<a href='#/deepdives/stores/cassandra'>Cassandra</a> or <a href='#/deepdives/stores/dynamodb'>DynamoDB</a>", "Partitioned writes with no single writer to protect"],
                  ["Continuous aggregation", "<a href='#/deepdives/streams/flink'>Flink</a>", "Event-time correctness under late and out-of-order data"],
                  ["Operational and business metrics", "<a href='#/deepdives/specialized/timeseries'>Time-series store</a>", "Time-partitioned, compressed, rolled up, expired by chunk"],
                  ["Semantic retrieval", "<a href='#/deepdives/specialized/vector-db'>Vector index</a>", "Approximate nearest neighbour with a measured recall target"],
                  ["Proximity queries", "<a href='#/deepdives/specialized/geospatial'>Cell-based index</a>", "Cells plus neighbours, then exact distance"],
                  ["Dedupe and unique counts", "<a href='#/deepdives/specialized/probabilistic'>Sketches</a>", "Fixed memory with one-sided error over an unbounded key space"],
                  ["Cluster coordination", "<a href='#/deepdives/streams/zookeeper'>Coordination service</a>", "Consensus for small facts everyone must agree on"]
                ]
              },
              { t: "p", html: "Notice that no box duplicates another's job, every derived store can be rebuilt from the log, and the only place with strong transactional guarantees is the one place that needs them. That is the shape of a defensible design, and it is what the interviewer is listening for underneath every individual technology question." },

              { t: "h", text: "Interview usage" },
              {
                t: "table",
                headers: ["Situation", "Reach for it?", "The sentence to say"],
                rows: [
                  ["Keeping a search index in sync", "Yes", "\"CDC into a stream, and the indexer consumes it — the index becomes rebuildable rather than hand-maintained.\""],
                  ["Publishing domain events reliably", "Yes, outbox", "\"Event row in the same transaction as the business change, then a relay publishes it at-least-once.\""],
                  ["Cache invalidation that keeps drifting", "Yes", "\"Invalidate from the change stream rather than from application code, so no write path can forget.\""],
                  ["Migrating off a legacy database", "Yes", "\"Snapshot, then stream changes into the new store, run both, and cut over when they agree.\""],
                  ["Feeding a warehouse without nightly batch", "Yes", "\"Continuous CDC instead of a nightly dump — fresher, and it captures intermediate states.\""],
                  ["Synchronous confirmation to the caller", "No", "\"CDC is asynchronous by nature. If the caller must see the downstream effect, it has to be in the request path.\""],
                  ["Two services that need shared state right now", "No", "\"That's a consistency requirement, not an integration one. Either one service owns it or they need a synchronous contract.\""]
                ]
              },

              { t: "h", text: "Alternatives" },
              {
                t: "compare",
                bad: { title: "Dual write from the application", items: ["Trivial to write; looks correct in the happy path", "No new infrastructure at all", "Not atomic — any crash between the two leaves systems disagreeing", "Every new write path is a new chance to forget the publish"] },
                good: { title: "Outbox plus change data capture", items: ["Atomic by construction: one transaction, one system", "The event contract is explicit and versionable", "At-least-once delivery, so consumers must be idempotent", "A connector and a stream to operate"] }
              },
              { t: "p", html: "The middle option — log-based CDC directly on business tables — skips the outbox table and is excellent for replication and analytics, where consumers genuinely want the raw rows. Use the outbox when consumers should see domain events rather than your schema, and accept the extra table as the price of a contract you control." },

              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the search index is out of date\", \"we forgot to invalidate the cache\", \"analytics doesn't match production\", \"the event wasn't published\", or \"we need to migrate without downtime\". Every one of those is a dual write that failed, and every one is fixed by making the change and the event the same transaction." },
              { t: "note", variant: "key", html: "<strong>You cannot atomically write to two systems, so stop trying.</strong> Put the event in the same transaction as the data, publish from there at-least-once, key by entity id so per-row order survives, and make every consumer idempotent with a monotonic version guard. Do that and every derived store in your architecture — search, read models, aggregates, embeddings, caches — becomes something you can rebuild from the log instead of something you hope stays correct." },

              { t: "quiz", id: "deepdives-specialized" }
            ]
          }
        ]
      }
    ]
  };
})();
