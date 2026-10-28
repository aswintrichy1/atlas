/* =====================================================================
   BLUEPRINT · Breakdowns → module "data" (Data Platforms)
   Three data-platform breakdowns on an extended house template:
     1 scoping questions · 2 requirements · 3 capacity math
     4 entities, APIs + events · 5 high-level design
     6 storage + processing · 7 the hard part: consistency and order
     8 failures · 9 observability · 10 security · 11 evolution
     12 follow-ups · 13 level expectations · key note
   Owns: window.TRACKS.breakdowns.modules[+1 module "data"]
         window.QUIZZES["breakdowns-data"]
         window.Widgets.bdCdcLagLab
   Track metadata (name/short/color/blurb) is owned by a sibling file.
   ===================================================================== */
(function () {
  "use strict";

  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function clearNode(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function fmt(n) {
    if (!isFinite(n)) return "\u221e";
    return Math.round(n).toLocaleString("en-US");
  }

  function dur(sec) {
    if (!isFinite(sec)) return "never";
    if (sec < 90) return Math.round(sec) + " s";
    if (sec < 5400) return (sec / 60).toFixed(1) + " min";
    return (sec / 3600).toFixed(1) + " h";
  }

  /* -----------------------------------------------------------------
     bdCdcLagLab — steady-state headroom, outage backlog, drain time
     and the source-log retention a CDC pipeline needs to survive it.
     ----------------------------------------------------------------- */
  Widgets.bdCdcLagLab = function (mount) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "calculator"),
      h("h3", {}, "CDC lag and recovery calculator")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "A pipeline is only as fast as its slowest stage. Set the change rate, the slowest stage's throughput and an outage, and see whether lag stays bounded, how long the backlog takes to drain, and whether the source log keeps enough history to survive it."));

    var FIELDS = [
      { id: "rate", label: "avg changes / s", value: 20000, min: 1, max: 5000000 },
      { id: "peak", label: "peak multiplier", value: 3, min: 1, max: 20 },
      { id: "cap", label: "slowest stage events / s", value: 90000, min: 1, max: 10000000 },
      { id: "outage", label: "sink outage (min)", value: 30, min: 0, max: 10080 },
      { id: "size", label: "event size (bytes)", value: 1000, min: 50, max: 1000000 },
      { id: "retain", label: "source log retention (h)", value: 24, min: 1, max: 720 }
    ];
    var inputs = {};
    var controls = h("div", { class: "widget-controls" });
    FIELDS.forEach(function (f) {
      var inp = h("input", { type: "number", min: String(f.min), max: String(f.max), step: "1", value: String(f.value), style: "width:110px", "aria-label": f.label });
      inp.addEventListener("input", paint);
      inputs[f.id] = { el: inp, f: f };
      controls.appendChild(h("label", { class: "w-field" }, f.label + " ", inp));
    });

    var presets = h("div", { class: "w-seg" });
    [
      ["healthy", "healthy", { rate: 20000, peak: 3, cap: 90000, outage: 30, size: 1000, retain: 24 }],
      ["tight", "no headroom", { rate: 20000, peak: 3, cap: 55000, outage: 30, size: 1000, retain: 24 }],
      ["long", "weekend outage", { rate: 20000, peak: 3, cap: 90000, outage: 2880, size: 1000, retain: 24 }]
    ].forEach(function (p, idx) {
      var b = h("button", { type: "button", class: idx === 0 ? "active" : "" }, p[1]);
      b.addEventListener("click", function () {
        Object.keys(p[2]).forEach(function (k) { inputs[k].el.value = String(p[2][k]); });
        Array.prototype.forEach.call(presets.children, function (c) { c.classList.toggle("active", c === b); });
        paint();
      });
      presets.appendChild(b);
    });

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function val(id) {
      var o = inputs[id], v = parseFloat(o.el.value);
      if (!isFinite(v)) v = o.f.value;
      return Math.min(o.f.max, Math.max(o.f.min, v));
    }

    function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, value)); }

    function paint() {
      var rate = val("rate"), peak = rate * val("peak"), cap = val("cap");
      var outageS = val("outage") * 60, size = val("size"), retainS = val("retain") * 3600;
      var headroom = cap / peak;
      var spare = cap - rate;
      var backlog = rate * outageS;
      var drainS = spare > 0 ? backlog / spare : Infinity;
      var recoverS = outageS + drainS;
      var growth = Math.max(0, peak - cap);
      var mbps = peak * size / 1048576;

      clearNode(stage);
      stage.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.82rem;line-height:1.9" },
        h("div", {}, "peak change rate      " + fmt(peak) + " events/s  (" + mbps.toFixed(1) + " MB/s)"),
        h("div", {}, "headroom at peak      " + headroom.toFixed(2) + "x"),
        h("div", {}, "lag growth at peak    " + (growth > 0 ? fmt(growth) + " events/s" : "none \u2014 lag stays bounded")),
        h("div", {}, "outage backlog        " + fmt(backlog) + " events"),
        h("div", {}, "drain time            " + dur(drainS) + "  (spare " + fmt(Math.max(0, spare)) + " events/s at average load)"),
        h("div", {}, "outage + drain        " + dur(recoverS) + "  vs source retention " + dur(retainS))
      ));

      clearNode(readout);
      readout.appendChild(ro("headroom", headroom.toFixed(2) + "x"));
      readout.appendChild(ro("drain", dur(drainS)));
      readout.appendChild(ro("needed retention", dur(recoverS)));
      var verdict;
      if (spare <= 0) {
        verdict = "The slowest stage cannot even keep up with average load, so lag grows forever. Add partitions and consumers to the bottleneck stage or batch its writes before anything else.";
      } else if (recoverS > retainS) {
        verdict = "The source log would discard changes before the pipeline catches up. The connector's position would point at history that no longer exists, forcing a full re-snapshot. Raise retention to cover the longest outage you intend to survive plus its drain, or buffer into a durable log sooner.";
      } else if (headroom < 1) {
        verdict = "Average load is fine but peaks exceed capacity, so lag climbs every peak and drains afterwards. That can be acceptable if consumers tolerate minutes of staleness at peak; say so explicitly, or provision for peak.";
      } else if (headroom < 1.3) {
        verdict = "Bounded, but with little margin: a modest traffic increase or one slow consumer turns peak lag into a growing backlog. Aim for roughly 1.5x headroom at peak on the slowest stage.";
      } else {
        verdict = "Healthy: peak fits with margin, the backlog from this outage drains in " + dur(drainS) + ", and the source keeps enough history to recover without a re-snapshot.";
      }
      readout.appendChild(h("span", { class: "ro" }, verdict));
    }

    mount.appendChild(h("div", { class: "widget-controls" }, presets));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =================================================================
     QUIZ
     ================================================================= */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "breakdowns-data": {
      title: "Data platform breakdowns checkpoint",
      sub: "CDC pipelines, clickstream analytics and feature stores.",
      questions: [
        {
          q: "Why do log-based CDC pipelines usually publish row changes to a topic keyed by the row's primary key?",
          options: [
            "So every consumer receives every change for a given row in commit order, because order is guaranteed within a partition",
            "Because keyed topics compress better",
            "So the database can skip writing its commit log",
            "Because consumers cannot read unkeyed topics"
          ],
          answer: 0,
          explain: "A partitioned log orders messages within a partition only. Keying by primary key puts every change for one row in the same partition, so an update can never be applied before the insert it modifies, while different rows still spread across partitions for throughput."
        },
        {
          q: "A CDC connector was down for longer than the source database retains its commit log. What is the consequence?",
          options: [
            "Nothing; the connector replays from the beginning of the log",
            "The connector's saved position points at history that no longer exists, so the target must be rebuilt from a fresh snapshot plus streaming",
            "The database automatically pauses writes until the connector returns",
            "Only deletes are lost; inserts and updates are recovered"
          ],
          answer: 1,
          explain: "Log-based CDC resumes from a log position. If that position has been purged, the gap cannot be recovered from the log, so the pipeline must re-snapshot. Retention therefore has to cover the longest outage you intend to survive plus the time to drain the backlog."
        },
        {
          q: "In a clickstream pipeline, a mobile app uploads events up to three days late. What is the standard way to keep daily metrics correct?",
          options: [
            "Drop anything that arrives after midnight",
            "Use the time the server received the event for every metric",
            "Aggregate by event time with a watermark for the streaming view, and recompute affected daily partitions in batch as late data arrives",
            "Ask clients to send events only when online"
          ],
          answer: 2,
          explain: "Event time is what the business means by 'Tuesday'. Streaming results give fast, provisional numbers up to a watermark; a batch job that reprocesses partitions touched by late events makes the daily figures final. Using arrival time silently moves late events to the wrong day."
        },
        {
          q: "Clients retry uploads, so the same click can arrive more than once. Where is deduplication most dependable?",
          options: [
            "In the dashboard, by dividing counts by an estimated duplicate rate",
            "Nowhere; duplicates average out",
            "In the client, by never retrying",
            "On a client-generated event id, deduplicated in the pipeline within a bounded window and again when writing the final table"
          ],
          answer: 3,
          explain: "A unique id generated once on the device survives every retry. Deduplicating on it in the stream bounds memory with a time window, and a merge or unique key on the final table catches stragglers that fall outside the window."
        },
        {
          q: "What is training/serving skew in a feature store, and what prevents it?",
          options: [
            "Features computed differently in training than at serving time; prevented by one feature definition that produces both the offline and online values",
            "Models trained on more data than they serve; prevented by sampling",
            "Serving traffic that is skewed towards popular users; prevented by caching",
            "A slow training job; prevented by more GPUs"
          ],
          answer: 0,
          explain: "If the training pipeline and the serving path each implement 'purchases in the last 7 days' separately, small differences make the model see different inputs in production than it learned from. A shared definition materialised to both stores removes the second implementation."
        },
        {
          q: "Why must training data be built with point-in-time correct joins against feature history?",
          options: [
            "Because it is faster than joining against current values",
            "Because using a feature value computed after the label's timestamp leaks future information, inflating offline accuracy that never appears in production",
            "Because online stores cannot be read by training jobs",
            "Because it removes the need for labels"
          ],
          answer: 1,
          explain: "For each training example you want the feature values as they were when the prediction would have been made. Joining against today's values lets the model peek at the outcome it is predicting, which looks excellent offline and fails live."
        },
        {
          q: "A ranking service fetches features for one user and 100 candidate items per request within a 10 ms budget. Which design fits?",
          options: [
            "Query the offline warehouse per request",
            "Compute every feature from raw events at request time",
            "A low-latency key-value online store holding precomputed values, read with one batched multi-get per request",
            "Read features from the training dataset files"
          ],
          answer: 2,
          explain: "The online store exists to serve precomputed values by entity key in single-digit milliseconds. Batching the 101 lookups into one multi-get avoids 101 network round trips. Warehouses and raw-event computation are orders of magnitude too slow for the request path."
        }
      ]
    }
  });

  var LEVELS = ["Level", "What the bar actually requires here"];

  /* =================================================================
     LESSONS
     ================================================================= */
  var LESSONS = [
    /* ---------------------------- CDC PIPELINE ---------------------------- */
    {
      id: "cdc-pipeline",
      title: "Design a change data capture pipeline",
      summary: "Stream every committed row change from an operational database to search, cache and warehouse consumers \u2014 in order per row, recoverable after outages, and safe through schema changes.",
      minutes: 14,
      tags: ["breakdown", "data-platform", "cdc", "streaming", "ordering"],
      blocks: [
        { t: "p", html: "The orders database is the source of truth, and five other systems want to know the moment it changes: search, a cache, the warehouse, fraud scoring and a notification service. Dual writes from the application drift out of sync the first time one of them fails. <strong>Change data capture</strong> reads the database's own commit log instead, so every consumer sees exactly what committed, in the order it committed." },
        { t: "h", text: "1 \u00b7 The prompt and what to ask" },
        { t: "ul", items: [
          "<strong>Which sources and how big?</strong> One large relational OLTP database, around 2 billion rows in the biggest table. Others later \u2014 so the design must be repeatable per source.",
          "<strong>What order do consumers need?</strong> Per row, strictly in commit order. Nobody needs a global order across tables, and asking for one would serialise everything.",
          "<strong>How fresh?</strong> Search and cache within seconds at p99; the warehouse within 15 minutes.",
          "<strong>Deletes and schema changes?</strong> Both must propagate. Schema changes happen weekly.",
          "<strong>Is any data sensitive?</strong> Yes: email, address and payment tokens in several tables."
        ] },
        { t: "h", text: "2 \u00b7 Requirements" },
        { t: "ol", items: [
          "Capture every insert, update and delete after commit, including the initial state of existing rows.",
          "Deliver changes to multiple independent consumers, each at its own pace.",
          "Preserve commit order per primary key.",
          "Resume after any component failure without losing or reordering changes.",
          "Propagate schema changes without breaking consumers."
        ] },
        { t: "ul", items: [
          "<strong>Freshness:</strong> end-to-end lag p99 under 5 s to the log; each consumer owns its own lag target.",
          "<strong>Delivery:</strong> at-least-once into the log, effectively-once at each sink through idempotent writes.",
          "<strong>Source impact:</strong> no extra load on the primary beyond reading its log; snapshots read from a replica.",
          "<strong>Recovery:</strong> survive a 24-hour sink outage without a re-snapshot."
        ] },
        { t: "h", text: "3 \u00b7 Capacity math" },
        { t: "code", lang: "text", code:
          "STATED ASSUMPTIONS\n" +
          "  commits / s (avg)          =      5,000\n" +
          "  row changes per commit     =          4\n" +
          "  peak multiplier            =         3x\n" +
          "  change event (before+after, =   1,000 B\n" +
          "    schema id, metadata)\n" +
          "  log retention              =     7 days, replication factor 3\n" +
          "\n" +
          "CHANGE STREAM\n" +
          "  5,000 x 4                  =     20,000 events/s avg\n" +
          "  x 3                        =     60,000 events/s peak   (~57 MB/s)\n" +
          "  20,000 x 86,400            = ~1.7 billion events/day   (~1.7 TB/day)\n" +
          "\n" +
          "LOG STORAGE\n" +
          "  1.7 TB x 7 days x 3        =    ~36 TB\n" +
          "\n" +
          "PARTITIONS\n" +
          "  slowest consumer ~5,000 events/s per partition\n" +
          "  60,000 / 5,000             =     12 -> provision 24 for headroom + key skew\n" +
          "\n" +
          "INITIAL SNAPSHOT\n" +
          "  2e9 rows / 50,000 rows/s   = 40,000 s -> ~11 hours, chunked and resumable\n" +
          "\n" +
          "OUTAGE RECOVERY (30-minute search outage)\n" +
          "  backlog 20,000 x 1,800     =     36 M events\n" +
          "  drain at 60,000 - 20,000   =     ~15 minutes"
        },
        { t: "note", variant: "tip", html: "The number that drives the design is not throughput \u2014 57 MB/s is modest for a partitioned log. It is the <strong>snapshot</strong>: eleven hours of reading a 2-billion-row table while the live stream keeps moving. How you stitch the snapshot to the stream without losing or duplicating a change is the hard part below." },
        { t: "widget", id: "bdCdcLagLab" },
        { t: "h", text: "4 \u00b7 Entities, APIs and events" },
        { t: "code", lang: "text", code:
          "CHANGE EVENT (one per row change, topic per table, key = primary key)\n" +
          "  key      { order_id }\n" +
          "  value    { op: c|u|d|r(snapshot read), before{...}, after{...},\n" +
          "             source: { db, table, commit_lsn, tx_id, commit_ts },\n" +
          "             schema_id }\n" +
          "  tombstone  key with null value after a delete (lets compaction drop the key)\n" +
          "\n" +
          "CONTROL PLANE\n" +
          "  POST /v1/sources                 { conn_ref, tables[], snapshot: initial|none }\n" +
          "  POST /v1/sources/{id}/resnapshot { table, chunk_size }\n" +
          "  GET  /v1/sources/{id}/status     -> { lsn, lag_s, snapshot_progress }\n" +
          "\n" +
          "SCHEMA REGISTRY\n" +
          "  schema_id -> versioned schema, compatibility mode: backward"
        },
        { t: "h", text: "5 \u00b7 High-level design" },
        { t: "diagram", id: "cdc-pipeline", caption: "The commit log is read once, published ordered per key, and every consumer keeps its own position." },
        { t: "code", lang: "text", code:
          "  primary DB --replication slot / binlog--> CDC connector (1 reader per source)\n" +
          "                                              |  checkpoints log position\n" +
          "                                              v  only after the log acks\n" +
          "  read replica --chunked snapshot---------> partitioned log, topic per table\n" +
          "                                              key = primary key, 24 partitions\n" +
          "                                              |\n" +
          "       +------------------+-------------------+------------------+\n" +
          "       v                  v                   v                  v\n" +
          "  search sink        cache invalidator   warehouse loader    fraud consumer\n" +
          "  upsert by PK,      delete key on       micro-batch merge   own offsets,\n" +
          "  skip older lsn     any change          every 5 min         own lag SLO"
        },
        { t: "p", html: "The load-bearing pieces: <strong>one ordered reader per source</strong>, because a database commit log is a single sequence and splitting the reader would break commit order; a <strong>partitioned log</strong> that turns one ordered stream into many ordered-per-key streams consumers can scale across; and <strong>consumer-owned offsets</strong>, so the warehouse being slow never delays search." },
        { t: "h", text: "6 \u00b7 Storage and processing" },
        { t: "table", headers: ["Stage", "Choice", "Why"], rows: [
          ["Capture", "Log-based (replication slot or binlog), not polling an updated_at column", "Polling misses deletes, misses rows updated twice between polls, and loads the primary with scans"],
          ["Transport", "Partitioned, replicated log with 7-day retention; compacted topics for current-state consumers", "Replay for new consumers and recovery; compaction keeps the latest value per key indefinitely"],
          ["Search and cache sinks", "Idempotent upsert by primary key, guarded by source LSN", "Redelivery after a crash rewrites the same version; an older LSN never overwrites a newer one"],
          ["Warehouse sink", "Micro-batch into staging, then MERGE on primary key keeping the highest LSN", "Columnar stores dislike single-row updates; batching every few minutes fits the 15-minute freshness target"],
          ["Snapshot", "Chunked by primary-key range from a replica, with watermarks interleaved into the stream", "Resumable, does not lock the table, and can be re-run per table"]
        ] },
        { t: "h", text: "7 \u00b7 The one hard part: stitching the snapshot to the stream without losing order" },
        { t: "p", html: "Existing rows must be read once, while live changes keep arriving for those same rows. If a snapshot read of order 42 is applied after a newer live update of order 42, the sink goes backwards." },
        { t: "table", headers: ["Tier", "Approach", "Why it lands there"], rows: [
          ["<strong>Naive</strong>", "Pause writes, dump the table, start streaming.", "Correct and unacceptable: an eleven-hour write freeze on the production database. Without the pause, rows changed during the dump are either missed or applied out of order."],
          ["<strong>Solid</strong>", "Record the log position, take a consistent snapshot as of that position from a replica, load it, then stream from the recorded position. Sinks upsert by key and keep the highest LSN.", "No lost changes and no write freeze. The cost is one long snapshot transaction, which pins old row versions on the replica for eleven hours, and a re-snapshot of one table means redoing the whole thing."],
          ["<strong>Standout</strong>", "Chunked incremental snapshot: read the table in primary-key ranges while streaming continues; bracket each chunk with low and high watermark events written into the log; drop any snapshot row whose key changed inside that window, because the live event already supersedes it. Sinks still guard on LSN.", "No long-running transaction, resumable at chunk granularity, and any table can be re-snapshotted on demand without stopping the stream. The price is connector complexity and a watermark protocol you must test against concurrent updates and deletes."]
        ] },
        { t: "note", variant: "trap", html: "Ordering is per partition, and the partition comes from the key. If someone changes the partition count, existing keys can move partitions and a consumer can briefly see a newer change for a row before an older one still sitting in the old partition. Drain, or create a new topic and migrate, rather than resizing in place." },
        { t: "h", text: "8 \u00b7 Failure modes" },
        { t: "table", headers: ["Failure", "Effect", "Design response"], rows: [
          ["Connector crash", "Stream pauses", "Resume from the last checkpointed log position; duplicates are absorbed by idempotent sinks"],
          ["Sink outage", "That consumer's lag grows; others unaffected", "Per-consumer offsets, retention sized for outage plus drain, alert on lag age"],
          ["Replication slot left unconsumed", "The primary keeps its log and can run out of disk", "Alert on retained log size, cap slot retention, and treat a stuck slot as a page"],
          ["Log retention exceeded", "Saved position no longer exists", "Re-snapshot the affected tables; size retention so this needs a multi-day outage"],
          ["Poison event (sink rejects it)", "Partition blocks behind it", "Bounded retries, then a dead-letter topic with the key paused, so later changes for that key do not overtake it"],
          ["Large transaction", "Millions of events land at once", "Throttle by partition, and tag transaction boundaries for consumers that need them"]
        ] },
        { t: "h", text: "9 \u00b7 Observability" },
        { t: "ul", items: [
          "<strong>Lag as age, not count:</strong> now minus the commit timestamp of the last applied event, per consumer. A count means nothing without the rate.",
          "<strong>Source health:</strong> retained log bytes, slot activity, snapshot progress per table.",
          "<strong>Correctness:</strong> periodic row-count and checksum reconciliation per primary-key range between source and each sink, with drift alerts.",
          "<strong>Heartbeat rows:</strong> write a timestamp to a heartbeat table every few seconds; if it stops arriving downstream, the pipeline is stalled even when traffic is quiet."
        ] },
        { t: "h", text: "10 \u00b7 Security and privacy" },
        { t: "ul", items: [
          "<strong>Least privilege at the source:</strong> a replication role that can read the log and the selected tables, nothing else.",
          "<strong>Column policy in the connector:</strong> drop, hash or tokenise sensitive columns before they reach the log, so no downstream system can leak what it never received.",
          "<strong>Per-topic access control</strong> and encryption in transit and at rest; the log now holds a copy of production data.",
          "<strong>Deletion requests:</strong> a delete must propagate as a tombstone to every sink, and log retention bounds how long the old value survives."
        ] },
        { t: "h", text: "11 \u00b7 Evolution" },
        { t: "ul", items: [
          "<strong>Schema changes:</strong> a registry with backward compatibility; adding a nullable column is safe, renames are two steps (add, migrate consumers, drop).",
          "<strong>More sources:</strong> the connector becomes a managed service with one reader per database and a self-service control plane.",
          "<strong>Derived streams:</strong> joining raw table changes into business events (\u201corder placed\u201d) belongs in a stream processor or an outbox table, not in every consumer."
        ] },
        { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Pipeline engineering, batch versus streaming processing and warehouse modelling are covered in the Cascade atlas (data engineering); landing CDC into Snowflake with streams, tasks and dynamic tables is in the Glacier atlas (Snowflake platform). The general log-as-integration idea is also in the <a class='inline' href='#/deepdives/specialized/cdc'>CDC deep dive</a>." },
        { t: "h", text: "12 \u00b7 Deep dives" },
        { t: "table", headers: ["They will push on", "Your answer"], rows: [
          ["\"Why not have the application publish events after each write?\"", "Dual writes are not atomic: the database commit can succeed and the publish fail, or the reverse, and the systems drift with no record of why. Either read the commit log, or write an outbox row in the same transaction and capture that table."],
          ["\"A consumer needs whole transactions, not single rows.\"", "Carry the transaction id and commit position on every event plus a transaction-end marker; the consumer buffers until the marker. Only that consumer pays the buffering cost."],
          ["\"How do you prove the warehouse matches the source?\"", "Reconcile per primary-key range: counts and a checksum of key plus version, computed on both sides on a schedule. Drift points at a range, and a targeted re-snapshot of that range repairs it."]
        ] },
        { t: "h", text: "13 \u00b7 How this scores at each level" },
        { t: "table", headers: LEVELS, rows: [
          ["<strong>Mid</strong>", "Chooses log-based capture over polling and explains why deletes need it. Keys the topic by primary key for per-row order and makes sinks idempotent upserts."],
          ["<strong>Senior</strong>", "Solves the snapshot-to-stream handoff without a write freeze, sizes retention from outage plus drain time, isolates consumers with their own offsets, and measures lag as age with a heartbeat."],
          ["<strong>Staff</strong>", "Designs incremental chunked snapshots with watermarks, a schema-evolution policy and column-level privacy at the connector, reconciliation as a standing correctness check, and a self-service platform model for many sources and teams."]
        ] },
        { t: "note", variant: "key", html: "<strong>Read the commit log once, publish ordered per key, and let every consumer own its position.</strong> Idempotent upserts guarded by log position make redelivery harmless; retention sized for outage plus drain keeps recovery a replay rather than a re-snapshot; and the watermark-bracketed snapshot is what lets existing data join the stream without freezing writes." }
      ]
    },

    /* ------------------------- CLICKSTREAM ANALYTICS ------------------------- */
    {
      id: "clickstream-analytics",
      title: "Design clickstream analytics",
      summary: "Collect billions of product events a day from web and mobile, give dashboards minutes-fresh numbers, and make daily metrics correct despite late, duplicated and malformed events.",
      minutes: 14,
      tags: ["breakdown", "data-platform", "streaming", "analytics", "late-data"],
      blocks: [
        { t: "p", html: "Product teams want to know what users do: page views, clicks, searches, add-to-cart. They want a live dashboard during a launch and trustworthy daily numbers for the business review. Those two wishes pull in opposite directions, because the fastest numbers are computed before all the data has arrived." },
        { t: "h", text: "1 \u00b7 The prompt and what to ask" },
        { t: "ul", items: [
          "<strong>Scale?</strong> 50 million daily active users across web and mobile apps.",
          "<strong>Freshness?</strong> Live tiles within 5 minutes; official daily metrics by 06:00 the next day.",
          "<strong>How late can events be?</strong> Mobile clients batch offline; some events arrive up to 3 days late.",
          "<strong>Who queries?</strong> Analysts with ad-hoc SQL, plus fixed dashboards. Some product features read aggregates too (\u201ctrending now\u201d).",
          "<strong>Privacy?</strong> Users can opt out and request deletion; events must not carry raw personal data."
        ] },
        { t: "h", text: "2 \u00b7 Requirements" },
        { t: "ol", items: [
          "Accept events from web and mobile SDKs with an agreed schema per event type.",
          "Provide minutes-fresh aggregates for dashboards and product features.",
          "Provide complete, deduplicated daily tables for analysis.",
          "Support ad-hoc SQL over at least 13 months of history.",
          "Honour opt-out and deletion requests."
        ] },
        { t: "ul", items: [
          "<strong>Ingestion availability:</strong> the collector accepts events even if every downstream system is down.",
          "<strong>Correctness:</strong> daily counts within 0.1% of truth after late data settles; no double counting from retries.",
          "<strong>Freshness:</strong> live view p95 under 5 minutes behind event time.",
          "<strong>Cost:</strong> storage and query cost per active user tracked as a number."
        ] },
        { t: "h", text: "3 \u00b7 Capacity math" },
        { t: "code", lang: "text", code:
          "STATED ASSUMPTIONS\n" +
          "  DAU                         = 50,000,000\n" +
          "  events / user / day         =        200\n" +
          "  raw event (JSON)            =      500 B\n" +
          "  columnar compression        =       ~10x\n" +
          "  peak multiplier             =         3x\n" +
          "\n" +
          "INGEST\n" +
          "  50e6 x 200                  = 10 billion events/day\n" +
          "  10e9 / 86,400               = ~116,000 events/s avg\n" +
          "  x 3                         = ~350,000 events/s peak  (~175 MB/s)\n" +
          "\n" +
          "STORAGE\n" +
          "  raw  10e9 x 500 B           =     5 TB/day\n" +
          "  columnar / 10               =   500 GB/day -> ~200 TB for 13 months\n" +
          "  raw landing kept 30 days    =   150 TB (for replay and reprocessing)\n" +
          "\n" +
          "LATE DATA\n" +
          "  ~2% of events arrive > 1 h late; up to 3 days\n" +
          "  -> each day's partitions are rewritten for 3 days after it ends"
        },
        { t: "note", variant: "tip", html: "Three numbers shape everything: <strong>350,000 events/s</strong> means the collector must be stateless and horizontally scaled; <strong>500 GB/day compressed</strong> means a columnar, partitioned store rather than a row database; and <strong>three days of lateness</strong> means the daily table is not final until three days later, which the business has to be told." },
        { t: "h", text: "4 \u00b7 Entities, APIs and events" },
        { t: "code", lang: "text", code:
          "EVENT ENVELOPE (every event type shares it)\n" +
          "  event_id      uuid generated once on the device\n" +
          "  event_type    e.g. product_view, add_to_cart\n" +
          "  schema_ver    per event type\n" +
          "  event_time    device clock at the moment of the action\n" +
          "  sent_time     device clock at upload   (lets you correct device skew)\n" +
          "  received_time collector clock\n" +
          "  anon_id / user_key (pseudonymous), session_id, app_version, platform\n" +
          "  properties    { typed, per-schema fields }\n" +
          "\n" +
          "COLLECTOR\n" +
          "  POST /v1/events   [ batch of up to 100 events, gzip ]  -> 202 Accepted\n" +
          "\n" +
          "TABLES\n" +
          "  events_raw          partition by received_date   (append only, 30 days)\n" +
          "  events_clean        partition by event_date, cluster by event_type\n" +
          "  agg_daily_*         rebuilt per event_date for 3 days after it ends"
        },
        { t: "h", text: "5 \u00b7 High-level design" },
        { t: "code", lang: "text", code:
          "  SDKs --batched HTTPS--> collector fleet (stateless, validates envelope)\n" +
          "                             |  append, ack 202\n" +
          "                             v\n" +
          "                    partitioned log  (key = anon_id, keeps a user's\n" +
          "                             |        session events together)\n" +
          "            +----------------+-------------------+\n" +
          "            v                                    v\n" +
          "   stream processor                       object-storage landing\n" +
          "   - dedupe by event_id (24 h window)     (raw, by received hour)\n" +
          "   - schema validate -> dead letter              |\n" +
          "   - windowed aggregates by event time           v\n" +
          "     with a watermark                     batch job per event_date\n" +
          "            |                             - dedupe, sessionize, enrich\n" +
          "            v                             - rewrite day D for D+3\n" +
          "   real-time store (minutes)                     |\n" +
          "   live tiles, trending                          v\n" +
          "                                          columnar warehouse tables\n" +
          "                                          dashboards + ad-hoc SQL"
        },
        { t: "p", html: "Two paths from one log: the <strong>streaming path</strong> answers \u201cwhat is happening now\u201d with provisional numbers, and the <strong>batch path</strong> produces the official, complete tables. Both read the same events and use the same definitions, so the live number converges to the daily number rather than disagreeing with it." },
        { t: "h", text: "6 \u00b7 Storage and processing" },
        { t: "table", headers: ["Layer", "Choice", "Why"], rows: [
          ["Collector", "Stateless HTTP fleet appending to the log, responding 202", "Ingestion stays up even when every consumer is down; the log is the buffer"],
          ["Landing", "Raw events in object storage by received hour, 30 days", "Cheap replay: a logic bug is fixed by reprocessing, not by apologising"],
          ["Warehouse", "Columnar tables partitioned by event_date, clustered by event_type", "Queries prune to the days and types they touch; compression cuts storage roughly tenfold"],
          ["Real-time", "Pre-aggregated counters per minute bucket in a fast store", "Dashboards read a few thousand rows, not billions"],
          ["Sessionization", "Batch, on events ordered by event_time per user", "Sessions need a user's complete sequence, which only exists once late events are in"]
        ] },
        { t: "h", text: "7 \u00b7 The one hard part: event time, late data and duplicates" },
        { t: "p", html: "An event's <em>event time</em> comes from a device clock that may be wrong; its <em>arrival</em> can be days later; and retries can deliver it twice. The question is which day a click belongs to, and how a dashboard can be fast without being wrong." },
        { t: "table", headers: ["Tier", "Approach", "Why it lands there"], rows: [
          ["<strong>Naive</strong>", "Count by received time in one streaming job and call it final.", "Fast and wrong. Offline-batched events land on the wrong day, retries double count, and a bad deploy that corrupts counts cannot be fixed because there is nothing to recompute from."],
          ["<strong>Solid</strong>", "Aggregate by event time with a watermark (for example 10 minutes) for live views; dedupe on event_id; nightly batch recomputes the previous day from the landing zone.", "Live numbers are good enough and the daily table is correct for most events. Events later than one night still land wrong or are dropped, and the stream and batch use separately written logic that drifts."],
          ["<strong>Standout</strong>", "One set of metric definitions compiled to both paths. Correct device clock skew using sent_time against received_time. Stream with a watermark and mark tiles provisional; batch rewrites each event_date partition for three days, then freezes it. Dedupe on event_id in a windowed state store and again with a unique merge in the warehouse.", "The live and official numbers converge by construction, late data lands on the right day, and the point at which a day becomes final is an explicit, published rule. The cost is reprocessing three days of partitions continuously and keeping two execution engines on one definition."]
        ] },
        { t: "note", variant: "trap", html: "Do not trust the device clock blindly. Phones can be hours or years off. Estimate skew as <code class='tok'>received_time - sent_time</code> for each upload batch and apply it to every event in the batch; clamp anything still impossible and count it in a data-quality metric." },
        { t: "h", text: "8 \u00b7 Failure modes" },
        { t: "table", headers: ["Failure", "Effect", "Design response"], rows: [
          ["Downstream outage", "No fresh numbers", "Collector keeps accepting; log retention plus landing zone allow catch-up"],
          ["SDK release sends a malformed field", "Events fail validation", "Dead-letter by schema version, alert on the reject rate per app version, replay after a fix"],
          ["Retry storm from clients", "Duplicate events and collector load", "Client backoff with jitter, server-side rate limiting per app key, event_id dedupe"],
          ["Bot traffic", "Inflated metrics", "Flag in enrichment with rules and models; keep the raw event, exclude by flag in metrics"],
          ["Hot key (one very active anon_id)", "One partition lags", "Detect and salt keys for aggregation; per-user ordering only matters for sessionization"]
        ] },
        { t: "h", text: "9 \u00b7 Observability" },
        { t: "ul", items: [
          "<strong>Freshness by stage:</strong> event time to collector, collector to warehouse, as percentiles.",
          "<strong>Volume anomalies:</strong> events per type per app version against a seasonal baseline; a sudden drop is usually an SDK bug, not user behaviour.",
          "<strong>Quality:</strong> reject rate, duplicate rate, late-event rate and clock-skew corrections, per platform.",
          "<strong>Reconciliation:</strong> live versus final counts per day; persistent divergence means the two paths' definitions have drifted."
        ] },
        { t: "h", text: "10 \u00b7 Security and privacy" },
        { t: "ul", items: [
          "<strong>Pseudonymous identifiers</strong> only; no names, emails or raw IP addresses in events. Coarsen location at the collector.",
          "<strong>Consent enforced at the SDK and the collector:</strong> opted-out users' events are not collected, not merely filtered later.",
          "<strong>Deletion:</strong> map user_key to its events and delete or anonymise across raw and warehouse tables within the policy window; retention limits bound the work.",
          "<strong>Access:</strong> column-level policies so most analysts see aggregates and pseudonymous keys only."
        ] },
        { t: "h", text: "11 \u00b7 Evolution" },
        { t: "ul", items: [
          "<strong>Schema governance:</strong> a tracking plan with event types owned by teams, versioned schemas and CI checks in the SDK build.",
          "<strong>Product features on aggregates</strong> (\u201ctrending\u201d) get their own serving store and SLO, rather than reading the analytics warehouse.",
          "<strong>Experimentation:</strong> exposure events plus the same pipeline become the backbone of A/B analysis."
        ] },
        { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Streaming and batch processing, windowing and warehouse modelling are covered in the Cascade atlas (data engineering); warehouse partitioning, clustering and cost control on Snowflake in the Glacier atlas (Snowflake platform). Event-time windows are also worked through in <a class='inline' href='#/breakdowns/hard/ad-click-aggregator'>the ad click aggregator</a>." },
        { t: "h", text: "12 \u00b7 Deep dives" },
        { t: "table", headers: ["They will push on", "Your answer"], rows: [
          ["\"Why keep raw events if you have clean tables?\"", "Because every definition will change and some will be wrong. Raw events let you recompute history with the corrected logic. Thirty days of raw plus compressed clean tables is the cheapest insurance in the design."],
          ["\"Can you count unique users per day in real time?\"", "Exactly, at this scale, only in batch. In the stream use a HyperLogLog per day and dimension: about 1% error in kilobytes, mergeable across partitions, and labelled approximate on the tile."],
          ["\"Finance and product disagree on yesterday's number.\"", "Publish one definition per metric with an owner, state when a day becomes final, and show the provisional flag on live tiles. Most disagreements are two definitions, not two bugs."]
        ] },
        { t: "h", text: "13 \u00b7 How this scores at each level" },
        { t: "table", headers: LEVELS, rows: [
          ["<strong>Mid</strong>", "Uses a stateless collector in front of a log, a columnar store partitioned by date, and separates live dashboards from daily tables."],
          ["<strong>Senior</strong>", "Aggregates by event time with watermarks, deduplicates on a client-generated id, handles late data by reprocessing partitions, and keeps raw events for replay."],
          ["<strong>Staff</strong>", "Makes one metric definition drive both paths, corrects device clock skew, publishes when a day becomes final, builds privacy and consent into collection, and treats the tracking plan as governed, versioned contract."]
        ] },
        { t: "note", variant: "key", html: "<strong>Fast numbers and right numbers come from the same events by two paths.</strong> Stream by event time with a watermark for minutes-fresh provisional tiles; reprocess each day's partitions from raw events until late data settles; dedupe on an id minted once on the device; and make one definition drive both paths so they converge instead of argue." }
      ]
    },

    /* ----------------------------- FEATURE STORE ----------------------------- */
    {
      id: "feature-store",
      title: "Design a feature store",
      summary: "Serve the same ML features to training and to live inference: point-in-time correct history offline, millisecond lookups online, and one definition behind both.",
      minutes: 14,
      tags: ["breakdown", "data-platform", "ml", "feature-store", "consistency"],
      blocks: [
        { t: "p", html: "Several teams run models \u2014 ranking, fraud, recommendations \u2014 and each rebuilt the same features twice: once in a training notebook, once in the serving code. The two versions disagree in small ways and models underperform in production. A <strong>feature store</strong> makes a feature a defined, owned artifact that is computed once and served to both places." },
        { t: "h", text: "1 \u00b7 The prompt and what to ask" },
        { t: "ul", items: [
          "<strong>Which entities?</strong> Users (100 million) and items (20 million), with about 200 features per entity.",
          "<strong>Serving load?</strong> Ranking calls at 20,000 requests/s, each needing one user and 100 candidate items.",
          "<strong>Latency budget?</strong> Feature fetch p99 under 10 ms inside a 100 ms ranking budget.",
          "<strong>Freshness?</strong> Most features daily; a handful must reflect activity within a minute (\u201cclicks in the last 30 minutes\u201d).",
          "<strong>Training?</strong> Datasets of hundreds of millions of labelled examples, rebuilt weekly."
        ] },
        { t: "h", text: "2 \u00b7 Requirements" },
        { t: "ol", items: [
          "Register feature definitions with an owner, type, entity and freshness target.",
          "Materialise batch and streaming features to an online store for serving.",
          "Keep feature history offline and build point-in-time correct training sets.",
          "Serve batched lookups for many entities per request.",
          "Track lineage from feature to source data and to the models that use it."
        ] },
        { t: "ul", items: [
          "<strong>Online latency:</strong> p99 under 10 ms for 101 entities per request.",
          "<strong>Availability:</strong> 99.95% for online reads, with a defined default when a feature is missing.",
          "<strong>Consistency:</strong> the same definition produces offline and online values.",
          "<strong>Freshness:</strong> per feature, monitored against its declared target."
        ] },
        { t: "h", text: "3 \u00b7 Capacity math" },
        { t: "code", lang: "text", code:
          "STATED ASSUMPTIONS\n" +
          "  users 100 M, items 20 M, 200 features each, ~8 B per value\n" +
          "  storage overhead in the KV store (keys, encoding) ~ 1.3x\n" +
          "  ranking 20,000 req/s, 1 user + 100 items per request\n" +
          "\n" +
          "ONLINE STORE\n" +
          "  per entity  200 x 8 B x 1.3   = ~2 KB\n" +
          "  120 M entities x 2 KB         = ~240 GB  x 3 replicas = ~720 GB\n" +
          "  -> fits in memory across a modest cluster\n" +
          "\n" +
          "ONLINE READS\n" +
          "  20,000 x 101 entities         = ~2 M entity reads/s\n" +
          "  x 2 KB                        = ~4 GB/s if every feature is fetched\n" +
          "  -> fetch only the features the model uses (say 40): ~0.8 GB/s\n" +
          "  -> one batched multi-get per request, not 101 round trips\n" +
          "\n" +
          "STREAMING FEATURES\n" +
          "  clickstream ~350,000 events/s peak -> windowed counters per user/item\n" +
          "\n" +
          "OFFLINE HISTORY\n" +
          "  ~1 B feature value changes/day x 50 B = ~50 GB/day, columnar\n" +
          "  training set: 500 M examples x 200 features point-in-time joined"
        },
        { t: "note", variant: "tip", html: "The surprise is bandwidth, not storage: fetching every feature for 101 entities on every request is gigabytes per second. Projecting only the model's features and batching the lookup is what keeps the online tier small." },
        { t: "h", text: "4 \u00b7 Entities, APIs and events" },
        { t: "code", lang: "text", code:
          "REGISTRY\n" +
          "  FeatureView  name, entity (user|item), features[{name,type,default}],\n" +
          "               source (table | stream), transform (SQL or code ref),\n" +
          "               freshness_target, ttl, owner, version\n" +
          "\n" +
          "ONLINE READ\n" +
          "  POST /v1/features:get\n" +
          "    { view_refs: [\"user_activity:v3\", \"item_stats:v2\"],\n" +
          "      entities: { user: [\"u1\"], item: [\"i1\", ..., \"i100\"] } }\n" +
          "    -> values + per-value event_time (so the caller can see staleness)\n" +
          "\n" +
          "OFFLINE\n" +
          "  build_training_set(labels(entity, label_time, label), view_refs)\n" +
          "    -> point-in-time join: latest value with event_time <= label_time\n" +
          "\n" +
          "EVENTS\n" +
          "  materialization_completed { view, version, window, rows }\n" +
          "  freshness_breached        { view, lag_s }"
        },
        { t: "h", text: "5 \u00b7 High-level design" },
        { t: "diagram", id: "feature-store", caption: "One registered definition, two stores: history for training, latest values for serving." },
        { t: "code", lang: "text", code:
          "  registry (definitions, owners, versions, lineage)\n" +
          "        |                                   |\n" +
          "        v                                   v\n" +
          "  batch materialization (daily)        stream materialization (seconds)\n" +
          "  warehouse tables -> transform        clickstream log -> windowed aggregates\n" +
          "        |                \\                 /            |\n" +
          "        v                 v               v             v\n" +
          "  offline store  <------ every value written with event_time ------> online store\n" +
          "  (columnar history)                                       (KV, latest per key)\n" +
          "        |                                                         |\n" +
          "  point-in-time join for training                 multi-get from ranking service"
        },
        { t: "p", html: "The load-bearing idea is that <strong>every computed value goes to both stores with its event time</strong>. The offline store keeps the history so training can ask \u201cwhat was this value at 14:05 last Tuesday?\u201d; the online store keeps only the latest value per key so serving can ask \u201cwhat is it now?\u201d in milliseconds." },
        { t: "h", text: "6 \u00b7 Storage and processing" },
        { t: "table", headers: ["Component", "Choice", "Why"], rows: [
          ["Online store", "Replicated in-memory or SSD key-value store, key = view + entity id, value = packed feature vector", "Single-digit-millisecond multi-get; one key per entity per view keeps reads to one lookup each"],
          ["Offline store", "Columnar tables partitioned by date, keyed by entity and event_time", "Cheap history and fast scans for point-in-time joins"],
          ["Batch transforms", "SQL or dataframe jobs run by the scheduler, writing both stores", "Most features are daily aggregates over warehouse data"],
          ["Streaming transforms", "Windowed aggregations over the event log, writing both stores", "Minute-fresh features such as recent clicks"],
          ["On-demand features", "Computed at request time from request data (for example time since last visit)", "Some features only exist at the moment of the request; keep them few and shared as code"]
        ] },
        { t: "h", text: "7 \u00b7 The one hard part: training/serving consistency and point-in-time correctness" },
        { t: "p", html: "Two different things go wrong. <strong>Skew</strong>: the serving value is computed differently from the training value. <strong>Leakage</strong>: training rows use feature values that were not yet known when the label's prediction would have been made. Both make offline metrics look better than production." },
        { t: "table", headers: ["Tier", "Approach", "Why it lands there"], rows: [
          ["<strong>Naive</strong>", "Training joins labels to today's feature table; serving code recomputes features from raw data.", "Leaks the future into training (today's value already reflects the outcome) and implements every feature twice. Offline accuracy is excellent and production accuracy is not."],
          ["<strong>Solid</strong>", "Shared definitions materialised to both stores; training uses an as-of join on event_time; serving reads the online store.", "Removes the second implementation and the leakage. What remains: streaming and batch versions of the same feature can still differ at window edges, and an online value can be stale without anyone noticing."],
          ["<strong>Standout</strong>", "Additionally log the exact feature vector served with each prediction and train future models on those logged vectors where possible; return event_time with every online value and enforce a per-feature TTL with a declared default; continuously compare a sample of online values with offline recomputation.", "Training data now equals what the model actually saw, staleness is visible to the caller and bounded, and skew is measured as a metric rather than discovered in an incident. The cost is storing logged features and running the comparison job."]
        ] },
        { t: "note", variant: "trap", html: "An as-of join needs the feature's <em>event time</em>, not the time the materialisation job happened to write it. If a daily job writes Monday's values at 03:00 Tuesday, stamping them 03:00 Tuesday makes training think they were unknown on Monday \u2014 and stamping them Monday 00:00 makes training think they were known all day Monday. Stamp the true availability time." },
        { t: "h", text: "8 \u00b7 Failure modes" },
        { t: "table", headers: ["Failure", "Effect", "Design response"], rows: [
          ["Batch materialisation late", "Online values stale", "TTL per feature with a declared default, freshness alert, and the model trained to tolerate the default"],
          ["Online store node loss", "Partial misses", "Replication, client fallback to replicas, and defaults rather than failing the request"],
          ["Backfill with a changed definition", "Offline and online disagree", "Version views; a new definition is a new version materialised in parallel, then models switch"],
          ["Hot entity (very popular item)", "One shard overloaded", "Replicate hot keys or cache them in the ranking service for seconds"],
          ["Upstream data bug", "Wrong features served silently", "Distribution checks on every materialisation (nulls, ranges, drift) that block the write"]
        ] },
        { t: "h", text: "9 \u00b7 Observability" },
        { t: "ul", items: [
          "<strong>Freshness per feature view</strong> against its target, and the age of values actually served.",
          "<strong>Online/offline skew:</strong> sampled comparison of served values against offline recomputation.",
          "<strong>Distribution drift</strong> per feature between training data and live traffic.",
          "<strong>Latency and miss rate</strong> of multi-gets per caller, and the fraction of requests served with defaults."
        ] },
        { t: "h", text: "10 \u00b7 Security and privacy" },
        { t: "ul", items: [
          "<strong>Classify features</strong> in the registry; sensitive ones need approval to use and are excluded from broad discovery.",
          "<strong>Per-view access control</strong> for both reads and training-set builds; lineage shows which models consumed which sensitive features.",
          "<strong>Deletion:</strong> remove an entity's rows from online and offline stores; training sets built before the request follow the retention policy.",
          "<strong>No raw personal data as features</strong> where a derived signal will do."
        ] },
        { t: "h", text: "11 \u00b7 Evolution" },
        { t: "ul", items: [
          "<strong>Embeddings as features:</strong> large vectors move to a vector index or a separate store; the registry still owns their versions.",
          "<strong>Feature reuse:</strong> discovery and ownership turn the store into a platform; popular features get stronger SLOs.",
          "<strong>Cost:</strong> retire unused features by tracking which models read them."
        ] },
        { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Choosing features and embeddings, offline evaluation, A/B testing and model serving are covered in the Synapse atlas (ML system design); the batch and streaming pipelines that feed the store are in the Cascade atlas (data engineering)." },
        { t: "h", text: "12 \u00b7 Deep dives" },
        { t: "table", headers: ["They will push on", "Your answer"], rows: [
          ["\"Why not just read features from the warehouse at request time?\"", "A warehouse query takes hundreds of milliseconds to seconds and is priced for scans, not 2 million point lookups a second. The online store exists precisely to turn precomputed values into a key lookup."],
          ["\"The streaming feature and its batch backfill disagree.\"", "Window edges and late events: the stream counted with a watermark, the batch counted everything. Define the feature once with explicit window and lateness semantics, and compare them continuously."],
          ["\"How does a new model use a feature that did not exist last year?\"", "Backfill the history by running the definition over historical source data, stamped with historical event times, then build the training set with the same as-of join. Without a backfill you can only train on data collected since launch."]
        ] },
        { t: "h", text: "13 \u00b7 How this scores at each level" },
        { t: "table", headers: LEVELS, rows: [
          ["<strong>Mid</strong>", "Separates an offline store for training from an online key-value store for serving, and batches lookups per request."],
          ["<strong>Senior</strong>", "Uses one definition for both stores, builds training data with point-in-time joins on event time, and handles staleness with TTLs and defaults."],
          ["<strong>Staff</strong>", "Logs served feature vectors for future training, measures skew and drift continuously, versions definitions for safe backfills, and runs the store as a governed platform with ownership, classification and lineage."]
        ] },
        { t: "note", variant: "key", html: "<strong>A feature store's job is to make training see what serving will see.</strong> One versioned definition writes every value, with its event time, to a history store for point-in-time training joins and a key-value store for millisecond serving; logged feature vectors, TTLs and skew checks keep the two honest over time." }
      ]
    }
  ];

  LESSONS[LESSONS.length - 1].blocks.push({ t: "quiz", id: "breakdowns-data" });

  var MY_MODULE = {
    id: "data",
    name: "Data Platforms",
    icon: "database",
    lessons: LESSONS
  };

  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.breakdowns || (window.TRACKS.breakdowns = { id: "breakdowns", modules: [] });
  T.modules = T.modules || [];
  T.modules.push(MY_MODULE);
})();
