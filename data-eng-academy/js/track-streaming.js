/* =====================================================================
   CASCADE · Streaming & Real-time track  (curriculum + quizzes + widgets)
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var h = WK.h, shell = WK.shell;

  function seg(opts, getCur, onPick) {
    var s = h("div", { class: "w-seg" });
    opts.forEach(function (o) {
      var b = h("button", { class: o.v === getCur() ? "active" : "" }, o.label);
      b.addEventListener("click", function () {
        onPick(o.v);
        s.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
      });
      s.appendChild(b);
    });
    return s;
  }
  function ro(label, value, accent) {
    return h("span", { class: "ro" }, label + " ", h("b", accent ? { style: "color:var(--accent-ink)" } : {}, value));
  }
  var CCOLOR = ["var(--accent)", "var(--cyan)", "var(--violet)", "var(--lime)", "var(--amber)", "var(--pink)"];

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — Append-only log */
  window.Widgets["de-stream-log"] = function (mount) {
    shell(mount, "simulator", "The Log",
      "Producers append at increasing offsets; each consumer tracks its own position and can replay.");
    var log = ["e0", "e1", "e2"];
    var offs = { A: 1, B: 3 };
    var track = h("div", { class: "dsa-cells", style: "padding:18px 4px 26px" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      track.innerHTML = "";
      log.forEach(function (rec, i) {
        var tags = [];
        if (offs.A === i) tags.push("A");
        if (offs.B === i) tags.push("B");
        var cell = h("div", { class: "dsa-cell" + (tags.length ? " cur" : "") },
          h("span", { class: "idx" }, String(i)), rec,
          tags.length ? h("span", { class: "ptr", style: "color:var(--accent-ink)" }, tags.join("/")) : null);
        track.appendChild(cell);
      });
      // end marker
      readout.innerHTML = "";
      readout.appendChild(ro("log end offset", String(log.length), true));
      readout.appendChild(ro("consumer A", "offset " + offs.A + " \u00b7 lag " + (log.length - offs.A)));
      readout.appendChild(ro("consumer B", "offset " + offs.B + " \u00b7 lag " + (log.length - offs.B)));
    }
    function adv(c) { offs[c] = Math.min(log.length, offs[c] + 1); paint(); }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn primary", onclick: function () { log.push("e" + log.length); paint(); } }, "Produce"),
      h("button", { class: "w-btn", onclick: function () { adv("A"); } }, "Consumer A \u2192"),
      h("button", { class: "w-btn", onclick: function () { adv("B"); } }, "Consumer B \u2192"),
      h("button", { class: "w-btn ghost", onclick: function () { offs.A = 0; offs.B = 0; paint(); } }, "Replay both (offset 0)")
    ));
    mount.appendChild(h("div", { class: "w-stage" }, track));
    mount.appendChild(readout);
    paint();
  };

  /* 2 — Consumer-group rebalance */
  window.Widgets["de-stream-consumers"] = function (mount) {
    shell(mount, "visualizer", "Consumer Group Rebalance",
      "A topic has 6 partitions. Add or remove consumers and watch partitions rebalance \u2014 one owner each.");
    var P = 6, c = 2;
    var board = h("div", { class: "grid-board", style: "grid-template-columns:repeat(6,minmax(44px,1fr));gap:5px" });
    var readout = h("div", { class: "w-readout" });
    function owner(i) { return i % c; }
    function paint() {
      board.innerHTML = "";
      for (var i = 0; i < P; i++) {
        var o = owner(i);
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:8px 4px;font-family:var(--font-mono);font-size:.58rem;border-color:" + CCOLOR[o] + ";color:oklch(from " + CCOLOR[o] + " var(--ink-l) c h)" },
          h("div", {}, "P" + i), h("div", { style: "color:var(--text-dim)" }, "c" + o)));
      }
      var counts = [];
      for (var k = 0; k < c; k++) { var n = 0; for (var j = 0; j < P; j++) if (owner(j) === k) n++; counts.push(n); }
      readout.innerHTML = "";
      readout.appendChild(ro("consumers", String(c), true));
      readout.appendChild(ro("partitions each", counts.join(" / ")));
      if (c > P) readout.appendChild(ro("idle consumers", String(c - P)));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn primary", onclick: function () { c = Math.min(8, c + 1); paint(); } }, "Add consumer"),
      h("button", { class: "w-btn", onclick: function () { c = Math.max(1, c - 1); paint(); } }, "Remove consumer")
    ));
    mount.appendChild(h("div", { class: "w-stage" }, board));
    mount.appendChild(readout);
    paint();
  };

  /* 3 — Windowing */
  window.Widgets["de-stream-window"] = function (mount) {
    shell(mount, "visualizer", "Windowing Lab",
      "Aggregating an unbounded stream needs windows. Compare tumbling, sliding and session windows.");
    var events = [1, 2, 3, 5, 8, 9, 12, 13, 14, 18];
    var TMAX = 20;
    var kind = "tumbling";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function windows() {
      var w = [];
      if (kind === "tumbling") { for (var s = 0; s < TMAX; s += 4) w.push([s, s + 4]); }
      else if (kind === "sliding") { for (var s2 = 0; s2 < TMAX; s2 += 2) w.push([s2, s2 + 4]); }
      else { // session, gap 2
        var sorted = events.slice().sort(function (a, b) { return a - b; });
        var start = sorted[0], prev = sorted[0];
        sorted.forEach(function (e) { if (e - prev > 2) { w.push([start, prev + 1]); start = e; } prev = e; });
        w.push([start, prev + 1]);
      }
      return w;
    }
    function paint() {
      stage.innerHTML = "";
      var ws = windows();
      // timeline of events
      var tl = h("div", { class: "iv-stage" });
      var etrack = h("div", { class: "iv-track", style: "height:30px" });
      events.forEach(function (e) {
        etrack.appendChild(h("div", { class: "iv-bar active", style: "left:" + (e / TMAX * 100) + "%;width:12px;background:var(--accent)" }, ""));
      });
      tl.appendChild(etrack);
      // window bands
      var wtrack = h("div", { class: "iv-track", style: "height:24px" });
      ws.forEach(function (win, i) {
        var l = win[0] / TMAX * 100, wd = (win[1] - win[0]) / TMAX * 100;
        wtrack.appendChild(h("div", { class: "iv-bar merged" + (i % 2 ? " alt" : ""), style: "left:" + l + "%;width:" + (wd - 1) + "%" }, "w" + i));
      });
      tl.appendChild(wtrack);
      var axis = h("div", { class: "iv-axis" });
      [0, 5, 10, 15, 20].forEach(function (t) { axis.appendChild(h("span", { style: "left:" + (t / TMAX * 100) + "%" }, "t" + t)); });
      tl.appendChild(axis);
      stage.appendChild(tl);
      // counts
      var counts = ws.map(function (win) { return events.filter(function (e) { return e >= win[0] && e < win[1]; }).length; });
      readout.innerHTML = "";
      readout.appendChild(ro("window type", kind, true));
      readout.appendChild(ro("windows", String(ws.length)));
      readout.appendChild(ro("counts per window", counts.join(", ")));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "tumbling", label: "Tumbling (4)" }, { v: "sliding", label: "Sliding (4/2)" }, { v: "session", label: "Session (gap 2)" }],
        function () { return kind; }, function (v) { kind = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 4 — Flink state drill */
  window.Widgets["de-stream-flink-state"] = function (mount) {
    shell(mount, "drill", "Flink Stateful Ops Drill",
      "Pick the right production move for each stateful streaming scenario.");
    var cases = [
      {
        prompt: "A keyed fraud job must remember the last card swipe per account, and accounts are spread across parallel subtasks.",
        options: ["Use keyed state partitioned by account_id", "Keep one global in-memory map", "Round-robin the events", "Write every event to CSV"],
        answer: 0,
        reason: "Keyed state is co-located with the keyed stream partition, so each account's history moves with the subtask that owns that key."
      },
      {
        prompt: "The job needs a planned code upgrade and may change parallelism. You want a portable recovery point.",
        options: ["Rely on the next automatic checkpoint", "Take a savepoint before deploying", "Disable checkpoints", "Drop the state backend"],
        answer: 1,
        reason: "Checkpoints are automatic failure recovery; savepoints are operator-triggered, durable upgrade and migration points."
      },
      {
        prompt: "A dedupe set grows forever because old order ids are never useful after 24 hours.",
        options: ["Turn off keyBy", "Increase heap forever", "Add state TTL and cleanup", "Use processing time only"],
        answer: 2,
        reason: "State TTL bounds remembered keys and lets the backend clean expired entries instead of turning correctness state into a memory leak."
      },
      {
        prompt: "The sink supports transactions. A crash can happen after records are written but before the source offset is committed.",
        options: ["Ignore duplicate writes", "Commit offsets before writing", "Use at-most-once mode", "Use a transactional exactly-once sink with checkpoints"],
        answer: 3,
        reason: "Flink coordinates checkpoint completion with transactional sinks so output becomes visible only when the matching checkpoint succeeds."
      },
      {
        prompt: "Checkpoint duration and input lag are rising after a downstream service slows down.",
        options: ["Treat it as backpressure and tune/restart with bounded retries", "Delete old savepoints", "Increase watermark delay only", "Add more quiz questions"],
        answer: 0,
        reason: "Backpressure propagates upstream, stretching checkpoint alignment and lag. Restart strategies help with transient faults, but sustained pressure needs capacity or sink fixes."
      }
    ];
    var cur = 0, picked = -1, correct = 0, seen = {};
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var c = cases[cur];
      stage.innerHTML = "";
      stage.appendChild(h("p", { style: "margin:0 0 12px;color:var(--text);font-weight:700" }, c.prompt));
      var opts = h("div", { class: "grid-board", style: "grid-template-columns:repeat(2,minmax(120px,1fr));gap:6px" });
      c.options.forEach(function (o, i) {
        var cls = "grid-cell";
        if (picked === i) cls += i === c.answer ? " dp-cur" : " dp-fill";
        var b = h("button", { class: cls, style: "width:auto;height:auto;padding:10px;text-align:left" }, o);
        b.addEventListener("click", function () {
          picked = i;
          if (!seen[cur] && i === c.answer) correct++;
          seen[cur] = true;
          paint();
        });
        opts.appendChild(b);
      });
      stage.appendChild(opts);
      if (picked >= 0) {
        stage.appendChild(h("div", { class: "note " + (picked === c.answer ? "key" : "trap"), style: "margin-top:12px" },
          h("div", { class: "note-body" }, h("strong", {}, picked === c.answer ? "Correct. " : "Review. "), c.reason)));
      }
      readout.innerHTML = "";
      readout.appendChild(ro("scenario", (cur + 1) + " / " + cases.length, true));
      readout.appendChild(ro("first-try correct", correct + " / " + Object.keys(seen).length));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn", onclick: function () { cur = Math.max(0, cur - 1); picked = -1; paint(); } }, "Prev"),
      h("button", { class: "w-btn primary", onclick: function () { cur = Math.min(cases.length - 1, cur + 1); picked = -1; paint(); } }, "Next"),
      h("button", { class: "w-btn ghost", onclick: function () { cur = 0; picked = -1; correct = 0; seen = {}; paint(); } }, "Reset")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-streaming-fundamentals": {
      title: "Streaming fundamentals checkpoint",
      sub: "The log and delivery semantics.",
      questions: [
        {
          q: "What makes the append-only log such a powerful streaming abstraction?",
          options: ["It deletes data immediately", "It is ordered, durable and replayable, and each consumer tracks its own offset", "It only allows one consumer", "It stores data in columns"],
          answer: 1,
          explain: "An ordered, durable log lets many independent consumers read at their own pace and replay from any offset \u2014 the basis of Kafka and of decoupled, reprocessable pipelines."
        },
        {
          q: "'Exactly-once' processing in practice is usually achieved by\u2026",
          options: ["A magic delivery guarantee with no extra work", "At-most-once delivery", "At-least-once delivery plus idempotent or transactional writes", "Disabling retries"],
          answer: 2,
          explain: "True exactly-once delivery is nearly impossible end-to-end; systems combine at-least-once delivery with idempotent/transactional sinks to get effectively-once results."
        },
        {
          q: "At-least-once delivery means a consumer must be prepared to\u2026",
          options: ["Lose messages", "Never commit offsets", "Receive messages out of the log", "Handle duplicate messages"],
          answer: 3,
          explain: "At-least-once can redeliver a message after a failure before the offset was committed, so handlers must be idempotent (e.g. dedupe by a key) to avoid double effects."
        },
        {
          q: "At-most-once delivery is acceptable when\u2026",
          options: ["Losing an occasional event is tolerable, e.g. sampled telemetry", "Payments must never be lost", "Every event must be counted exactly", "An audit trail is required"],
          answer: 0,
          explain: "At-most-once never redelivers, so a failure can drop events. That trade is fine for lossy signals like sampled metrics, never for money or audit data."
        },
        {
          q: "Compared with batch, stream processing mainly trades\u2026",
          options: ["Correctness for nothing", "SQL for Python", "Storage for memory only", "Simpler operations and easy reprocessing for low latency on unbounded data"],
          answer: 3,
          explain: "Streams deliver results continuously, but bring state, late data, ordering and always-on operations. Batch is simpler and easier to rerun; choose streaming when latency is worth that cost."
        }
      ]
    },
    "de-streaming-kafka": {
      title: "Kafka checkpoint",
      sub: "Topics, partitions and consumer groups.",
      questions: [
        {
          q: "Within a Kafka consumer group, a single partition is consumed by\u2026",
          options: ["Exactly one consumer in the group", "Every consumer in the group", "No consumer", "The broker"],
          answer: 0,
          explain: "Each partition is owned by exactly one consumer in a group, which is how Kafka spreads load and preserves per-partition order; extra consumers beyond the partition count sit idle."
        },
        {
          q: "Kafka guarantees message ordering\u2026",
          options: ["Across the whole topic", "Only within a single partition", "Only across partitions", "Never"],
          answer: 1,
          explain: "Order is guaranteed per partition only. To keep related events ordered, give them the same key so they hash to the same partition."
        },
        {
          q: "A message key in Kafka primarily determines\u2026",
          options: ["The retention period", "The compression codec", "Which partition the message lands in (key hash)", "The replication factor"],
          answer: 2,
          explain: "The producer hashes the key to choose a partition, so all messages with the same key share a partition \u2014 giving them ordering and co-location for stateful processing."
        },
        {
          q: "A consumer group has 6 members reading a topic with 4 partitions. What happens?",
          options: ["All 6 share each partition", "Kafka creates 2 new partitions", "Messages are copied to all 6", "Only 4 consumers receive partitions; 2 sit idle"],
          answer: 3,
          explain: "Each partition is assigned to at most one consumer in a group, so parallelism is capped by the partition count. Extra members wait as standbys."
        },
        {
          q: "During a consumer-group rebalance, what most commonly causes duplicate processing?",
          options: ["Producers changing keys", "Topic compaction", "Broker disks filling up", "Partitions moving to a new owner before the previous owner committed its latest offsets"],
          answer: 3,
          explain: "The new owner resumes from the last committed offset, so records processed but not yet committed are processed again. Commit promptly on revocation and keep processing idempotent."
        }
      ]
    },
    "de-streaming-processing": {
      title: "Stream processing checkpoint",
      sub: "Windows, time and exactly-once.",
      questions: [
        {
          q: "A tumbling window is\u2026",
          options: ["Overlapping fixed windows", "Infinite", "Activity-based windows separated by gaps", "Fixed-size, non-overlapping windows"],
          answer: 3,
          explain: "Tumbling windows are fixed-size and non-overlapping (e.g. each 5-minute bucket); sliding windows overlap, and session windows group bursts of activity separated by an inactivity gap."
        },
        {
          q: "A watermark in stream processing is\u2026",
          options: ["A heuristic asserting that no more events older than time T should arrive", "A security feature", "A type of partition", "A compression scheme"],
          answer: 0,
          explain: "Watermarks track event-time progress so the engine knows when a window is 'complete enough' to emit, balancing latency against waiting for late events."
        },
        {
          q: "Why is event time usually preferred over processing time for windowed aggregates?",
          options: ["It is easier to implement", "Results are correct and reproducible regardless of delays or replays", "It ignores late data", "It avoids state"],
          answer: 1,
          explain: "Event time bases windows on when things actually happened, so a replay or a delay yields the same answer; processing-time windows depend on arrival timing and aren\u2019t reproducible."
        },
        {
          q: "A session window for a key closes when\u2026",
          options: ["A fixed clock interval ends", "The topic is compacted", "A gap of inactivity longer than the session gap passes for that key", "The watermark resets to zero"],
          answer: 2,
          explain: "Session windows are data-driven: they extend with each event and close after the configured inactivity gap, so their lengths vary per key."
        },
        {
          q: "Checkpointing gives a stream processor exactly-once state by\u2026",
          options: ["Snapshotting operator state together with the source offsets it corresponds to", "Logging every event twice", "Disabling retries", "Acknowledging producers early"],
          answer: 0,
          explain: "On failure the job restores state and rewinds sources to the offsets in the same consistent snapshot, so every event is reflected in state exactly once."
        }
      ]
    },
    "de-streaming-flink-state": {
      title: "Flink stateful ops checkpoint",
      sub: "State backends, checkpoints, savepoints and sinks.",
      questions: [
        {
          q: "In Flink, keyed state is stored and recovered according to\u2026",
          options: ["A single global coordinator map", "The order records appear in the source file", "The event's key and the subtask that owns that key range", "The sink partition only"],
          answer: 2,
          explain: "Keyed state is partitioned by key group and assigned to subtasks. On rescale or recovery, key groups move with their state so each key remains consistent."
        },
        {
          q: "What is the practical difference between a checkpoint and a savepoint?",
          options: ["They are identical names for the same file", "Checkpoints store only source offsets", "Savepoints are faster but unsafe", "Checkpoints are automatic failure recovery points; savepoints are manually triggered durable points for upgrades and migrations"],
          answer: 3,
          explain: "Checkpoints are frequent, system-managed recovery snapshots. Savepoints are user-controlled and kept for planned job changes, rollback, and stateful upgrades."
        },
        {
          q: "State TTL is mainly used to\u2026",
          options: ["Bound old keyed state and allow cleanup after it is no longer useful", "Guarantee network delivery", "Disable exactly-once sinks", "Force every key into one partition"],
          answer: 0,
          explain: "TTL prevents unbounded state growth by expiring entries such as old dedupe keys, stale sessions, or reference values after the correctness window has passed."
        },
        {
          q: "A Flink exactly-once sink usually depends on\u2026",
          options: ["Blind appends and no retries", "Checkpoint coordination plus idempotent or transactional commits", "At-most-once sources", "Disabling backpressure"],
          answer: 1,
          explain: "Flink can restore state and offsets consistently, but the sink must commit in the same failure boundary, often with transactions or an idempotent upsert protocol."
        },
        {
          q: "Rising checkpoint duration, input lag and busy downstream tasks are a signal of\u2026",
          options: ["Schema evolution", "A savepoint completing successfully", "Backpressure", "A partition overwrite"],
          answer: 2,
          explain: "Backpressure from a slow sink or hot operator propagates upstream, increasing lag and making checkpoint alignment and completion slower."
        }
      ]
    },
    "de-streaming-architecture": {
      title: "Streaming architectures checkpoint",
      sub: "Lambda, Kappa and streaming ETL.",
      questions: [
        {
          q: "The Kappa architecture differs from Lambda by\u2026",
          options: ["Adding a third layer", "Only supporting batch", "Removing the log", "Using a single streaming pipeline and reprocessing from the log instead of a separate batch layer"],
          answer: 3,
          explain: "Kappa drops Lambda\u2019s separate batch layer: it treats the log as the source of truth and reprocesses history by replaying the stream, avoiding maintaining two codebases."
        },
        {
          q: "Lambda architecture\u2019s main drawback is\u2026",
          options: ["Maintaining two code paths (batch and speed) that must stay in sync", "It can\u2019t handle real-time data", "It has no batch layer", "It cannot store data"],
          answer: 0,
          explain: "Lambda runs a batch layer and a speed layer in parallel, so the same logic is implemented twice and must agree \u2014 the duplication Kappa tries to eliminate."
        },
        {
          q: "A streaming materialized view (e.g. in Materialize/ksqlDB) provides\u2026",
          options: ["A static nightly snapshot", "An always-fresh, incrementally maintained query result", "A raw file dump", "A backup"],
          answer: 1,
          explain: "Streaming materialized views maintain a query\u2019s result incrementally as new events arrive, so reads are instant and always up to date without re-running the full query."
        },
        {
          q: "When streaming CDC into a lakehouse, why must the sink apply changes by primary key and version?",
          options: ["To keep files small", "Because Kafka requires it", "Retries and reordering can deliver duplicates or stale updates; a keyed, versioned merge converges to the source state", "To enable compression"],
          answer: 2,
          explain: "At-least-once delivery and partition-level ordering mean the sink may see a change twice or out of order. MERGE by key with a version guard makes it converge regardless."
        },
        {
          q: "When is a separate batch layer (Lambda) still justified?",
          options: ["Never", "When there is no log", "When latency does not matter at all", "When historical recomputation needs logic or engines the streaming path cannot run economically"],
          answer: 3,
          explain: "Kappa replays history through the streaming job. If backfills need heavy joins, large models or different engines that are impractical in the stream, a batch path can be worth its duplication."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.streaming = {
    id: "streaming", name: "Streaming & Real-time", short: "STREAM",
    tagline: "Process data the moment it arrives", color: "#fb7185",
    blurb: "Unbounded data done right: the log abstraction, delivery semantics, Kafka topics/partitions/consumer groups, windowing, event time vs processing time and watermarks, Flink stateful operations, state backends, checkpoint/savepoint recovery, exactly-once sinks, and Lambda vs Kappa architectures.",
    modules: [
      {
        id: "fundamentals", name: "Streaming Fundamentals", icon: "compass",
        lessons: [
          {
            id: "batch-vs-stream", title: "Batch vs stream processing",
            summary: "Bounded datasets on a schedule versus an unbounded flow processed continuously.",
            minutes: 6, tags: ["intro", "latency"],
            blocks: [
              { t: "p", html: "<strong>Batch</strong> processes a <em>bounded</em> dataset that has a beginning and end \u2014 yesterday\u2019s orders \u2014 on a schedule. <strong>Streaming</strong> processes an <em>unbounded</em> sequence of events continuously, as they arrive, for low end-to-end latency." },
              { t: "table", headers: ["", "Batch", "Streaming"], rows: [
                ["Data", "Bounded (a file/table)", "Unbounded (never ends)"],
                ["Latency", "Minutes\u2013hours", "Milliseconds\u2013seconds"],
                ["State", "Recomputed each run", "Continuously maintained"],
                ["Hard parts", "Scale", "Time, order, failures, state"]
              ] },
              { t: "note", variant: "tip", html: "Streaming isn\u2019t 'better batch' \u2014 it\u2019s a different model where <strong>time, ordering and state</strong> become first-class problems. Choose it when the business genuinely needs seconds-fresh data." },
              { t: "note", variant: "tip", html: "Many 'streaming' needs are met by <strong>micro-batch</strong> (Spark Structured Streaming) \u2014 tiny batches every few seconds \u2014 which keeps much of batch\u2019s simplicity with near-real-time latency." },
              { t: "note", variant: "key", html: "<strong>You pay for freshness in state, not in CPU.</strong> A batch run recomputes from a bounded input and then forgets everything; a streaming job has to keep partial results alive between events, so its real operating costs are how large that state grows, how long recovery takes when it is lost, and what an event that arrives out of order does to an answer you already published." }
            ]
          },
          {
            id: "the-log", title: "The log: streaming\u2019s core abstraction",
            summary: "An ordered, durable, replayable append-only log \u2014 the primitive everything builds on.",
            minutes: 7, tags: ["log", "offset"],
            blocks: [
              { t: "p", html: "The <strong>log</strong> is the heart of modern streaming: an <em>append-only</em>, totally <em>ordered</em> sequence of records, each at a monotonically increasing <strong>offset</strong>. Producers append to the end; consumers read forward and remember their own offset." },
              { t: "widget", id: "de-stream-log" },
              { t: "p", html: "This one structure delivers a lot: durability (records persist), <strong>replayability</strong> (rewind to any offset and reprocess), and decoupling (many independent consumers read the same log at their own pace)." },
              { t: "note", variant: "key", html: "Because the log is durable and replayable, it doubles as the system\u2019s source of truth: lose a downstream table and you rebuild it by replaying the log from offset 0. That idea drives the Kappa architecture later." }
            ]
          },
          {
            id: "delivery-semantics", title: "Delivery semantics",
            summary: "At-most-once, at-least-once, exactly-once \u2014 and why idempotency is the real answer.",
            minutes: 6, tags: ["delivery", "exactly-once"],
            blocks: [
              { t: "table", headers: ["Guarantee", "Meaning", "Risk"], rows: [
                ["At-most-once", "Deliver \u22641 time", "May lose messages"],
                ["At-least-once", "Deliver \u22651 time", "May duplicate"],
                ["Exactly-once", "Deliver effectively once", "Hard / costly"]
              ] },
              { t: "p", html: "Most systems default to <strong>at-least-once</strong> (commit the offset only after processing), so duplicates are possible after a crash. The practical path to 'exactly-once' is at-least-once delivery plus <strong>idempotent</strong> or <strong>transactional</strong> writes at the sink." },
              { t: "note", variant: "tip", html: "End-to-end exactly-once isn\u2019t a free flag \u2014 it\u2019s an architecture: at-least-once + dedupe/idempotent sink = <em>effectively-once</em>. Design your sink to absorb duplicates and you\u2019ve solved it pragmatically." },
              { t: "note", variant: "trap", html: "Committing the offset <em>before</em> processing turns at-least-once into at-most-once \u2014 a crash then silently drops the in-flight message. Commit after the side effect is durable." },
              { t: "note", variant: "key", html: "<strong>The guarantee lives at the sink, not on the wire.</strong> Once retries exist, delivery can only promise <em>at least</em> once, so the thing that decides whether a crash costs you a duplicate, a gap, or nothing at all is the key your sink deduplicates on and whether applying the same record twice changes the stored answer. Name that key before you argue about the delivery mode." },
              { t: "quiz", id: "de-streaming-fundamentals" }
            ]
          }
        ]
      },
      {
        id: "kafka", name: "Kafka & Brokers", icon: "queue",
        lessons: [
          {
            id: "kafka-arch", title: "Kafka: topics, partitions, brokers",
            summary: "How Kafka scales a log horizontally and survives broker failures.",
            minutes: 7, tags: ["kafka", "partitions"],
            blocks: [
              { t: "p", html: "<strong>Apache Kafka</strong> is the de-facto streaming log. A <strong>topic</strong> is split into <strong>partitions</strong> (each an ordered log), spread across <strong>brokers</strong>. Partitioning is what lets a topic scale beyond one machine and one consumer." },
              { t: "ul", items: [
                "<strong>Replication factor</strong> \u2014 each partition has N copies on different brokers.",
                "<strong>Leader / followers</strong> \u2014 one replica leads; writes go to it, followers copy.",
                "<strong>ISR</strong> \u2014 the in-sync replica set; a leader can fail over to any ISR member.",
                "<strong>Retention</strong> \u2014 records persist for a time/size, enabling replay."
              ] },
              { t: "note", variant: "tip", html: "Partitions give Kafka both <strong>scale</strong> (more partitions = more parallelism) and <strong>ordering</strong> (within a partition). Replication gives <strong>durability</strong>. These three knobs define a topic." },
              { t: "note", variant: "tip", html: "Choose partition count deliberately: it caps consumer parallelism and is awkward to increase later (it changes key\u2192partition mapping). Plan for peak throughput." },
              { t: "note", variant: "tip", html: "The Pulse atlas (streaming systems) in this collection covers segments, the ISR and high watermark, KRaft and broker operations in <em>Kafka Internals \u203a Replication &amp; the Producer Path \u203a Replication, ISR and the high watermark</em>, with a simulator for acks and min.insync.replicas." },
              { t: "note", variant: "key", html: "<strong>Durability is decided at acknowledgement time, not by the replication factor.</strong> Extra copies only protect a write that actually reached them before the leader died. A producer that is acknowledged as soon as the leader has the record trades a shorter write path for a tail of records that disappear when failover promotes a follower which never received them \u2014 so the guarantee you have is whatever you required the ISR to confirm, not the number of replicas you configured." }
            ]
          },
          {
            id: "consumer-groups", title: "Producers, consumer groups & offsets",
            summary: "How a group of consumers shares partitions, and what rebalancing does.",
            minutes: 7, tags: ["consumer-groups", "offsets"],
            blocks: [
              { t: "p", html: "A <strong>consumer group</strong> shares the work of a topic: each partition is assigned to <em>exactly one</em> consumer in the group. Add consumers to scale out (up to the partition count); when membership changes, Kafka <strong>rebalances</strong> the assignments." },
              { t: "widget", id: "de-stream-consumers" },
              { t: "p", html: "Each consumer commits its <strong>offset</strong> \u2014 how far it has processed \u2014 so on restart it resumes from there. <strong>Consumer lag</strong> (log end offset minus committed offset) is the key health metric: rising lag means you\u2019re falling behind." },
              { t: "note", variant: "tip", html: "Partitions are the unit of parallelism and the cap on it: with 6 partitions, a 7th consumer in the group sits idle. Size partitions for your peak consumer parallelism." },
              { t: "note", variant: "trap", html: "Rebalances pause consumption while partitions are reassigned ('stop-the-world'). Frequent rebalances (from flapping consumers or long processing) hurt throughput \u2014 tune session timeouts and use cooperative rebalancing." },
              { t: "note", variant: "key", html: "<strong>Past the partition count, adding consumers does nothing for lag.</strong> Once every partition has an owner the remaining levers are faster per-record work, more partitions, or a different key scheme. Worse, a slow handler feeds both failure modes at once: it grows lag, and it invites the rebalance that reassigns its partitions \u2014 at which point the new owner resumes from the last committed offset and reprocesses everything the old one had already done but not committed." }
            ]
          },
          {
            id: "ordering-keys", title: "Ordering, keys & rebalancing",
            summary: "Order is per-partition; keys pin related events together.",
            minutes: 6, tags: ["ordering", "keys"],
            blocks: [
              { t: "p", html: "Kafka guarantees order <em>within</em> a partition, not across the topic. To keep a stream of related events ordered \u2014 all events for one " + tok("user_id") + " \u2014 give them the same <strong>key</strong>, so the producer hashes them to the same partition." },
              { t: "note", variant: "tip", html: "Key choice is a design decision: it sets both ordering (same key = ordered) and load balance (skewed keys = hot partitions). Pick a key with enough cardinality to spread evenly but that co-locates what must stay ordered." },
              { t: "note", variant: "trap", html: "Increasing partition count later re-maps keys to partitions, breaking the 'same key \u2192 same partition' history. If ordering by key matters, plan partition count up front." },
              { t: "note", variant: "key", html: "<strong>Ordering is a property of the key you chose, not of the topic you wrote to.</strong> Two events only stay in sequence if they share a key, that key still lands on the same partition, and the consumer applies that partition serially. Break any one of the three \u2014 repartition the topic, change the key, or fan a partition out across worker threads \u2014 and you have given the guarantee back without any error being raised." },
              { t: "quiz", id: "de-streaming-kafka" }
            ]
          }
        ]
      },
      {
        id: "processing", name: "Stream Processing", icon: "blocks",
        lessons: [
          {
            id: "windowing", title: "Windowing",
            summary: "Bound an unbounded stream into windows so aggregates can emit.",
            minutes: 7, tags: ["windows"],
            blocks: [
              { t: "p", html: "You can\u2019t " + tok("SUM") + " an infinite stream \u2014 there\u2019s no end. <strong>Windows</strong> slice the stream into finite chunks you can aggregate. The three shapes: <strong>tumbling</strong> (fixed, non-overlapping), <strong>sliding</strong> (fixed, overlapping), and <strong>session</strong> (bursts of activity separated by a gap)." },
              { t: "widget", id: "de-stream-window" },
              { t: "note", variant: "tip", html: "Tumbling for regular buckets ('hits per minute'), sliding for moving averages ('last 5 min, updated every 1'), session for user activity ('a visit ends after 30 min idle'). The window type encodes the question." },
              { t: "note", variant: "tip", html: "Windows imply <strong>state</strong>: the engine holds partial aggregates until a window closes. That state, and when to release it, is what the next two lessons are about." },
              { t: "note", variant: "key", html: "<strong>The window shape you choose sets how many partial aggregates you keep alive per key.</strong> Tumbling holds one open bucket; a sliding window holds every overlapping bucket an event falls into, so shortening the slide multiplies state rather than sharpening the answer; a session window holds a key open until its idle gap elapses, which means a key that never goes quiet never releases. Size the cluster for the state the shape implies, not for the event rate." }
            ]
          },
          {
            id: "time-watermarks", title: "Event time, processing time & watermarks",
            summary: "Use when things happened, not when they arrived \u2014 and decide how long to wait.",
            minutes: 7, tags: ["event-time", "watermarks"],
            blocks: [
              { t: "p", html: "<strong>Event time</strong> is when an event actually occurred; <strong>processing time</strong> is when your system saw it. They differ because of network delays, retries and offline devices \u2014 a mobile event can arrive hours late." },
              { t: "p", html: "Windowing on <strong>event time</strong> gives correct, reproducible results, but raises a question: how long do you wait for stragglers before closing a window? A <strong>watermark</strong> answers it \u2014 a moving assertion that 'events older than T probably won\u2019t arrive,' after which the window emits." },
              { t: "note", variant: "tip", html: "Watermarks trade <strong>latency</strong> against <strong>completeness</strong>: wait longer (looser watermark) to catch more late data, or emit sooner with a chance of missing stragglers. <em>Allowed lateness</em> lets late events update an already-emitted result." },
              { t: "note", variant: "trap", html: "Processing-time windows are easy but non-deterministic: replay the same stream and a delayed batch lands in different windows. Prefer event time whenever correctness or reproducibility matters." },
              { t: "note", variant: "key", html: "<strong>A watermark is a promise you make, not a fact the data respects.</strong> When it passes a window\u2019s end the engine is free to emit that window and release its state, so anything older that shows up afterwards is late by definition \u2014 and your only choices are to drop it, divert it to a side output, or let it revise a result someone has already read. Decide which of the three before you tune the delay, because that decision, not the watermark, is what a downstream consumer actually experiences as correctness." }
            ]
          },
          {
            id: "state-joins", title: "Stateful processing & stream joins",
            summary: "Keyed state, state stores, and joining streams to streams or tables.",
            minutes: 7, tags: ["state", "joins"],
            blocks: [
              { t: "p", html: "Anything beyond mapping one event needs <strong>state</strong>: counts, windows, dedupe sets, last-seen values. Engines keep <strong>keyed state</strong> in an embedded <strong>state store</strong> (often <strong>RocksDB</strong>), partitioned by key alongside the data." },
              { t: "ul", items: [
                "<strong>Stream\u2013stream join</strong> \u2014 join two streams within a time window (e.g. clicks to impressions).",
                "<strong>Stream\u2013table join</strong> \u2014 enrich events with a changing reference table (a 'changelog' stream).",
                "<strong>Dedup / sessionization</strong> \u2014 remember keys seen, or group events into sessions."
              ] },
              { t: "note", variant: "tip", html: "State is the hard, valuable part of streaming \u2014 and it must survive failures. That\u2019s why state is checkpointed, which is exactly the next lesson." },
              { t: "note", variant: "trap", html: "Unbounded state is a memory leak: a stream-stream join or dedup must bound its state with time-to-live or a window, or it grows forever." },
              { t: "note", variant: "key", html: "<strong>Every stateful operator owes an answer to one question: when may I forget this key?</strong> A stream\u2013stream join has to decide how long to wait for the other side, a dedupe set has to decide when an id can no longer recur, and a stream\u2013table join has to decide which version of the reference row applied at the time of the event. Answer too eagerly and you silently lose matches; answer too late and state grows with the uptime of the job instead of with the size of the working set." }
            ]
          },
          {
            id: "flink-stateful-ops", title: "Flink stateful operations",
            summary: "How production Flink jobs manage keyed state, checkpoints, savepoints, TTL, backpressure and exactly-once sinks.",
            minutes: 9, tags: ["flink", "state", "checkpointing"],
            blocks: [
              { t: "p", html: "<strong>Apache Flink</strong> treats state as a managed, fault-tolerant part of the job rather than an accidental in-memory cache. After " + tok("keyBy") + ", each key belongs to a key group owned by one parallel subtask, and that subtask reads and writes the key\u2019s <strong>keyed state</strong> locally." },
              { t: "table", headers: ["Concept", "Use it for", "Production concern"], rows: [
                ["Keyed state", "Counts, dedupe sets, last-seen values per key", "Choose a key with enough cardinality; hot keys become hot subtasks"],
                ["State backend", "Where state physically lives: heap for small/fast state, RocksDB-style embedded storage for large state", "Large state increases checkpoint time and recovery time"],
                ["Checkpoint", "Automatic recovery point containing state plus source positions", "Tune interval, timeout and storage; monitor duration"],
                ["Savepoint", "Manual, durable point for upgrades, rollback and rescaling", "Take one before risky deployments"],
                ["State TTL", "Expire stale keyed entries after a correctness window", "TTL must match business semantics, not just memory pressure"]
              ] },
              { t: "widget", id: "de-stream-flink-state" },
              { t: "p", html: "A checkpoint is Flink\u2019s normal failure boundary: sources mark positions, operators snapshot state, and sinks commit only when the checkpoint completes. A <strong>savepoint</strong> uses the same idea but is operator-triggered and intended for controlled lifecycle operations such as changing code, moving clusters or adjusting parallelism." },
              { t: "p", html: "<strong>Backpressure</strong> means a downstream operator or sink cannot keep up, so upstream tasks slow down. In Flink that shows up as rising input lag, high busy time, full network buffers and slower checkpoints. Restart strategies handle transient failures, but sustained backpressure is a capacity, skew or sink problem." },
              { t: "compare",
                bad: { title: "Fragile stateful job", items: ["Global mutable maps", "No TTL on dedupe/join state", "Offsets committed before output", "Restarts without bounded retries", "Blind append sink"] },
                good: { title: "Recoverable Flink job", items: ["State keyed by business id", "Backend sized for state volume", "Checkpoints to durable storage", "Savepoints before upgrades", "Idempotent or transactional sink"] }
              },
              { t: "note", variant: "tip", html: "Production stateful streaming is a contract: <strong>keyed state + durable checkpoints + bounded state + a cooperative sink</strong>. The engine can restore the computation only if your state and output protocol are designed for recovery." },
              { t: "note", variant: "trap", html: "A restart strategy is not a data guarantee. It decides <em>when</em> to retry; checkpoints and sink commits decide <em>what data state</em> the retry resumes from." },
              { t: "note", variant: "key", html: "<strong>The checkpoint is the only moment where state, source position and output all agree.</strong> Recovery rewinds sources to the last completed one and replays everything after it, so anything the job already emitted in that interval is emitted again \u2014 which is fine for a sink that commits transactionally on the same boundary or absorbs a repeat idempotently, and silently wrong for anything else. Side effects that sit outside that boundary, such as a call out to an external service or an unversioned append, simply happen twice." },
              { t: "quiz", id: "de-streaming-flink-state" }
            ]
          },
          {
            id: "exactly-once", title: "Exactly-once & checkpointing",
            summary: "Checkpoint state and offsets together so a restart resumes consistently.",
            minutes: 6, tags: ["exactly-once", "checkpoints"],
            blocks: [
              { t: "p", html: "Streaming jobs run forever, so failure is normal. <strong>Checkpointing</strong> periodically snapshots the operator <strong>state</strong> together with the source <strong>offsets</strong>. On restart, the job restores the snapshot and resumes from those offsets \u2014 no gaps, no double-applied state." },
              { t: "p", html: "For end-to-end exactly-once, the <strong>sink</strong> must cooperate: either be <strong>idempotent</strong> (writing the same record twice is harmless) or <strong>transactional</strong> (commit output and offset together via two-phase commit, as Kafka transactions and Flink do)." },
              { t: "note", variant: "tip", html: "Exactly-once = consistent checkpoints (state + offsets) + an idempotent or transactional sink. Miss either half and a crash either loses or duplicates data." },
              { t: "note", variant: "tip", html: "Checkpoint frequency trades recovery time against overhead: frequent checkpoints mean less reprocessing after a crash but more steady-state cost. Tune to your latency budget." },
              { t: "note", variant: "tip", html: "The Pulse atlas (streaming systems) in this collection covers Kafka transactions, read_committed and two-phase commit sinks end to end in <em>Exactly-Once &amp; Transactions \u203a End to End \u203a Two-phase commit sinks in Flink</em>, with a checkpoint and failure-injection simulator." },
              { t: "note", variant: "key", html: "<strong>A transactional sink pushes your visibility latency up to the checkpoint interval.</strong> Output stays uncommitted until the snapshot it belongs to completes, so readers see results in checkpoint-sized steps and shortening the interval to publish sooner raises steady-state overhead instead. An idempotent sink sidesteps the trade completely \u2014 which is why an upsert keyed on a natural business id is usually the cheaper route to the same end-to-end guarantee." },
              { t: "quiz", id: "de-streaming-processing" }
            ]
          }
        ]
      },
      {
        id: "architecture", name: "Streaming Architectures", icon: "share",
        lessons: [
          {
            id: "lambda-kappa", title: "Lambda vs Kappa",
            summary: "Two architectures for combining real-time speed with historical correctness.",
            minutes: 6, tags: ["lambda", "kappa"],
            blocks: [
              { t: "p", html: "<strong>Lambda</strong> runs two layers: a <em>batch</em> layer for accurate historical views and a <em>speed</em> layer for low-latency approximate ones, merged at query time. <strong>Kappa</strong> drops the batch layer \u2014 there\u2019s just a streaming pipeline, and you reprocess history by <em>replaying the log</em>." },
              { t: "compare",
                bad: { title: "Lambda", items: ["Batch + speed layers", "Two codebases for the same logic", "Must keep them in sync", "Complex to operate"] },
                good: { title: "Kappa", items: ["One streaming pipeline", "Reprocess by replaying the log", "Single codebase", "Relies on durable, replayable log"] }
              },
              { t: "note", variant: "key", html: "Kappa works precisely because the log is durable and replayable: to fix history, deploy new stream logic and replay from offset 0. It\u2019s the architectural payoff of the log abstraction." }
            ]
          },
          {
            id: "streaming-etl-cdc", title: "Streaming ETL & CDC",
            summary: "Turn database changes into streams, enrich them, and land them downstream.",
            minutes: 6, tags: ["cdc", "etl"],
            blocks: [
              { t: "p", html: "Streaming ETL connects the storage track\u2019s <strong>CDC</strong> to a processing engine: database changes become a stream, get cleaned/enriched/joined in flight, and land in a lake, warehouse, or search index \u2014 continuously, not nightly." },
              { t: "code", lang: "sql", code:
                "-- A streaming SQL job enriching CDC orders with a customer table\n" +
                "SELECT o.order_id, o.amount, c.segment\n" +
                "FROM orders_cdc o\n" +
                "JOIN customers FOR SYSTEM_TIME AS OF o.proc_time c\n" +
                "  ON o.customer_id = c.id;" },
              { t: "note", variant: "tip", html: "CDC + stream processing is how you keep a warehouse or search index seconds-fresh from an OLTP source without batch reloads \u2014 the real-time companion to the storage track\u2019s ingestion patterns." },
              { t: "note", variant: "tip", html: "Mind ordering and idempotency: CDC carries inserts, updates <em>and</em> deletes, so the sink must apply them as upserts/tombstones keyed by primary key." },
              { t: "note", variant: "key", html: "<strong>A change stream carries transitions; the sink is the thing that has to reconstruct the row.</strong> Apply two updates in the wrong order, or drop a tombstone, and the target settles into a state the source never held \u2014 with every job still green, because nothing failed. That is the cost of replacing a nightly reload: a batch job is wrong for one run and right on the next, while a continuous pipeline stays wrong until someone reconciles it. Key each write by primary key and a monotonic version so a replay converges instead of accumulating." }
            ]
          },
          {
            id: "materialized-views", title: "Streaming materialized views",
            summary: "Incrementally maintained query results that are always fresh.",
            minutes: 6, tags: ["materialized-views"],
            blocks: [
              { t: "p", html: "A <strong>streaming materialized view</strong> keeps the result of a query continuously up to date as new events arrive \u2014 incremental view maintenance. Systems like <strong>Materialize</strong>, <strong>ksqlDB</strong> and <strong>Flink SQL</strong> let you " + tok("CREATE MATERIALIZED VIEW") + " over streams and read instant, current answers." },
              { t: "note", variant: "tip", html: "Instead of re-running an expensive aggregate on every read, the engine updates the result on every <em>write</em>. Reads become trivially fast and always current \u2014 ideal for live dashboards and real-time features." },
              { t: "note", variant: "trap", html: "The cost moves to the engine: maintaining many complex views incrementally consumes state and CPU continuously. Materialize the views the business actually watches, not everything." },
              { t: "note", variant: "key", html: "<strong>An incremental view converts an unpredictable read cost into a permanent write cost.</strong> The answer is instant because the engine is paying to maintain it on every input event, whether or not anyone opened the dashboard today \u2014 so a view earns its keep only when reads are frequent and the definition is stable. Every redefinition means rebuilding its state from history, which makes 'just tweak the metric' an operation, not an edit." },
              { t: "quiz", id: "de-streaming-architecture" }
            ]
          }
        ]
      }
    ]
  };
})();
