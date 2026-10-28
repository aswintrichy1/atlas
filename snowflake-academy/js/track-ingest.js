/* =====================================================================
   GLACIER · Ingestion & Pipelines
   window.TRACKS.ingest — modules: load / transform / open

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data.
   ===================================================================== */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function svg(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    }
    if (text != null) el.textContent = text;
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }
  function segment(pairs, initialIdx, onPick) {
    var seg = h("div", { class: "w-seg" });
    var btns = [];
    for (var i = 0; i < pairs.length; i++) {
      (function (pair, idx) {
        var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
        b.addEventListener("click", function () {
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
          b.classList.add("active");
          onPick(pair[0]);
        });
        btns.push(b);
        seg.appendChild(b);
      })(pairs[i], i);
    }
    return seg;
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function field(label, input, out) {
    return h("label", { class: "w-field" }, h("span", {}, label), input, out || null);
  }
  function btn(label, cls, onClick) {
    var b = h("button", { type: "button", class: "w-btn" + (cls ? " " + cls : "") }, label);
    b.addEventListener("click", onClick);
    return b;
  }
  function fmt(n) {
    if (!isFinite(n)) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 10000) return Math.round(n / 1000) + "k";
    return String(Math.round(n));
  }
  function L() { return Array.prototype.slice.call(arguments).join("\n"); }

  var Widgets = {};

  /* loadPathLab — COPY batch vs Snowpipe vs Snowpipe Streaming */
  Widgets.loadPathLab = function (mount) {
    shell(mount, "advisor", "Which load path?",
      "Pick how fresh the data must be, where it comes from, typical file size and daily volume. The advisor names a load path and the cost driver you will be paying for.");
    var latency = "minutes", source = "files", size = "ok", gb = 50;
    var SIZE_MB = { tiny: 0.5, ok: 150, huge: 4096 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var gbOut = h("b", {}, "50 GB/day");

    function paint() {
      var files = Math.max(1, Math.round(gb * 1024 / SIZE_MB[size]));
      var path, lat, driver, notes = [];
      if (source === "files") {
        if (latency === "hours") {
          path = "COPY INTO on a schedule";
          lat = "your schedule (e.g. hourly)";
          driver = "warehouse time: 60 s minimum per resume";
          notes.push("Run COPY from a task every hour on a small warehouse; load metadata makes reruns idempotent.");
        } else {
          path = "Snowpipe auto-ingest";
          lat = latency === "seconds" ? "typically under a minute, not seconds" : "typically under a minute";
          driver = "serverless compute plus per-file overhead";
          notes.push("Point bucket event notifications at the pipe's queue; no warehouse to size or suspend.");
          if (latency === "seconds") notes.push("Files cannot reliably deliver seconds: a producer has to write, close and notify each file. If seconds matter, move the producer to Snowpipe Streaming.");
        }
      } else {
        if (latency === "hours") {
          path = source === "kafka" ? "Sink to object storage, then COPY" : "Micro-batch files, then COPY";
          lat = "your schedule";
          driver = "warehouse time per batch";
          notes.push("Hourly freshness does not justify an always-on streaming client; write well-sized files and bulk load them.");
        } else {
          path = source === "kafka" ? "Snowpipe Streaming via the Kafka connector" : "Snowpipe Streaming SDK";
          lat = "typically a few seconds";
          driver = "streaming ingest throughput (no files)";
          notes.push("Rows go straight into the table through channels; offset tokens give you exactly-once resume.");
          if (source === "kafka") notes.push("Set the connector's ingestion method to streaming. The older file-based mode stages many small files and pays per file.");
        }
      }
      if (size === "tiny" && path.indexOf("Snowpipe auto") === 0) notes.push("At ~0.5 MB per file you pay per-file overhead " + fmt(files) + " times a day. Batch at the producer toward 100-250 MB compressed.");
      else if (size === "tiny" && path.indexOf("COPY") >= 0) notes.push("Many tiny files slow listing and metadata work; consolidate before landing where you can.");
      if (size === "huge") notes.push("Multi-GB files load on a single thread each. Split them into 100-250 MB chunks so the warehouse can load in parallel.");
      if (gb > 2000 && path.indexOf("COPY") >= 0) notes.push("At this volume, size the warehouse to the file count: each thread loads one file at a time, so more well-sized files means more parallelism.");

      clear(stage);
      stage.appendChild(h("p", { style: "margin:0 0 0.5rem;font-weight:600;color:var(--accent-ink)" }, path));
      var ul = h("ul", { style: "margin:0;padding-left:1.1rem;font-size:0.88rem;line-height:1.55;color:var(--text)" });
      for (var i = 0; i < notes.length; i++) ul.appendChild(h("li", {}, notes[i]));
      stage.appendChild(ul);

      clear(readout);
      readout.appendChild(ro("path", path));
      readout.appendChild(ro("files/day", source === "files" || path.indexOf("COPY") >= 0 ? fmt(files) : "none (rows)"));
      readout.appendChild(ro("latency", lat));
      readout.appendChild(ro("cost driver", driver));
    }

    var vol = h("input", { type: "range", min: "1", max: "5000", step: "1", value: "50", "aria-label": "Daily volume in GB" });
    vol.addEventListener("input", function () {
      var v = Number(vol.value);
      gb = isFinite(v) && v > 0 ? v : 50;
      gbOut.textContent = gb + " GB/day";
      paint();
    });

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["hours", "Hourly is fine"], ["minutes", "Within minutes"], ["seconds", "Within seconds"]], 1, function (v) { latency = v; paint(); }),
      segment([["files", "Files in a bucket"], ["kafka", "Kafka topic"], ["app", "App emitting rows"]], 0, function (v) { source = v; paint(); }),
      segment([["tiny", "Tiny files (<1 MB)"], ["ok", "100-250 MB files"], ["huge", "Multi-GB files"]], 1, function (v) { size = v; paint(); }),
      field("Volume", vol, gbOut)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* streamLab — watch a standard / append-only stream accumulate changes */
  Widgets.streamLab = function (mount) {
    shell(mount, "simulator", "Stream offset simulator",
      "Change the source table, then read the stream. A plain SELECT leaves the offset alone; consuming the stream in a committed DML statement moves it to the current table version.");
    var mode = "standard";
    var rows, snap, appendLog, nextId, version, offsetVersion, lastMsg, tick;
    function clone(a) { var o = []; for (var i = 0; i < a.length; i++) o.push({ id: a[i].id, v: a[i].v }); return o; }
    function reset() {
      rows = [{ id: 1, v: "open" }, { id: 2, v: "open" }, { id: 3, v: "paid" }];
      snap = clone(rows); appendLog = []; nextId = 4; version = 1; offsetVersion = 1; tick = 0;
      lastMsg = "stream created at table version 1";
    }
    reset();
    var STATES = ["open", "paid", "shipped", "refunded"];

    function changes() {
      var out = [], i;
      if (mode === "append") {
        for (i = 0; i < appendLog.length; i++) out.push({ id: appendLog[i].id, v: appendLog[i].v, act: "INSERT", upd: "FALSE" });
        return out;
      }
      var before = {};
      for (i = 0; i < snap.length; i++) before[snap[i].id] = snap[i];
      var now = {};
      for (i = 0; i < rows.length; i++) {
        var r = rows[i]; now[r.id] = true;
        var b = before[r.id];
        if (!b) out.push({ id: r.id, v: r.v, act: "INSERT", upd: "FALSE" });
        else if (b.v !== r.v) {
          out.push({ id: b.id, v: b.v, act: "DELETE", upd: "TRUE" });
          out.push({ id: r.id, v: r.v, act: "INSERT", upd: "TRUE" });
        }
      }
      for (i = 0; i < snap.length; i++) if (!now[snap[i].id]) out.push({ id: snap[i].id, v: snap[i].v, act: "DELETE", upd: "FALSE" });
      return out;
    }

    function table(title, headers, data) {
      var t = h("table", { style: "border-collapse:collapse;font-size:0.82rem;min-width:12rem" });
      var hr = h("tr", {});
      for (var i = 0; i < headers.length; i++) hr.appendChild(h("th", { style: "text-align:left;padding:3px 8px;border-bottom:1px solid var(--line);color:var(--text-dim)" }, headers[i]));
      t.appendChild(hr);
      if (!data.length) {
        t.appendChild(h("tr", {}, h("td", { colspan: String(headers.length), style: "padding:4px 8px;color:var(--text-dim)" }, "(no rows)")));
      }
      for (var r = 0; r < data.length; r++) {
        var tr = h("tr", {});
        for (var c = 0; c < data[r].length; c++) tr.appendChild(h("td", { style: "padding:3px 8px;border-bottom:1px solid var(--line);color:var(--text)" }, String(data[r][c])));
        t.appendChild(tr);
      }
      return h("div", { style: "flex:1 1 14rem" }, h("div", { style: "font-weight:600;margin-bottom:4px;color:var(--accent-ink)" }, title), t);
    }

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var ch = changes();
      clear(stage);
      var wrap = h("div", { style: "display:flex;flex-wrap:wrap;gap:1rem" });
      var src = [];
      for (var i = 0; i < rows.length; i++) src.push([rows[i].id, rows[i].v]);
      wrap.appendChild(table("orders (source)", ["id", "status"], src));
      var st = [];
      for (i = 0; i < ch.length; i++) st.push([ch[i].id, ch[i].v, ch[i].act, ch[i].upd]);
      wrap.appendChild(table(mode === "append" ? "orders_stream (append-only)" : "orders_stream (standard)", ["id", "status", "METADATA$ACTION", "METADATA$ISUPDATE"], st));
      stage.appendChild(wrap);
      stage.appendChild(h("p", { style: "margin:0.6rem 0 0;font-size:0.85rem;color:var(--text-dim)" }, lastMsg));
      clear(readout);
      readout.appendChild(ro("table version", version));
      readout.appendChild(ro("stream offset", offsetVersion));
      readout.appendChild(ro("stream rows", ch.length));
      readout.appendChild(ro("SYSTEM$STREAM_HAS_DATA", ch.length ? "TRUE" : "FALSE"));
    }
    function act(kind) {
      tick++;
      if (kind === "insert") {
        var r = { id: nextId++, v: "open" };
        rows.push(r); appendLog.push({ id: r.id, v: r.v }); version++;
        lastMsg = "INSERT id " + r.id + " -> table version " + version;
      } else if (kind === "update") {
        if (!rows.length) { lastMsg = "UPDATE matched 0 rows (table empty); version unchanged"; }
        else {
          var tgt = rows[0];
          var idx = STATES.indexOf(tgt.v);
          tgt.v = STATES[(idx + 1) % STATES.length];
          version++;
          lastMsg = "UPDATE id " + tgt.id + " to '" + tgt.v + "' -> version " + version + (mode === "append" ? " (append-only streams ignore updates)" : "");
        }
      } else if (kind === "delete") {
        if (!rows.length) { lastMsg = "DELETE matched 0 rows; version unchanged"; }
        else {
          var gone = rows.pop(); version++;
          lastMsg = "DELETE id " + gone.id + " -> version " + version + (mode === "append" ? " (append-only streams ignore deletes)" : "");
        }
      } else if (kind === "select") {
        lastMsg = "SELECT * FROM orders_stream returned " + changes().length + " row(s). Offset stays at " + offsetVersion + ".";
      } else if (kind === "consume") {
        var n = changes().length;
        snap = clone(rows); appendLog = []; offsetVersion = version;
        lastMsg = "INSERT INTO orders_history SELECT ... FROM orders_stream committed " + n + " row(s). Offset advanced to " + version + ".";
      } else if (kind === "reset") {
        reset();
      }
      paint();
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["standard", "Standard stream"], ["append", "Append-only stream"]], 0, function (v) {
        mode = v;
        lastMsg = "Stream type switched to " + (v === "append" ? "append-only" : "standard") + " (same offset).";
        paint();
      }),
      btn("INSERT", "", function () { act("insert"); }),
      btn("UPDATE", "", function () { act("update"); }),
      btn("DELETE", "", function () { act("delete"); }),
      btn("SELECT only", "ghost", function () { act("select"); }),
      btn("Consume in DML", "primary", function () { act("consume"); }),
      btn("Reset", "ghost", function () { act("reset"); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* lagLab — target lag, DOWNSTREAM and refresh cadence */
  Widgets.lagLab = function (mount) {
    shell(mount, "simulator", "Target lag planner",
      "A two-hop chain: raw table -> silver dynamic table -> gold dynamic table. Set gold's target lag, how silver is configured, and the upstream change rate. Cadence is illustrative: it assumes the scheduler refreshes at roughly half the target lag so each refresh fits inside the window.");
    var lag = 10, silver = "downstream", rate = 200;
    var lagOut = h("b", {}, "10 min");
    var rateOut = h("b", {}, "200 rows/min");
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var gEff = lag, warn = "";
      var sLag = silver === "fixed1" ? 1 : silver === "fixed30" ? 30 : null;
      if (sLag !== null && sLag > lag) { gEff = sLag; warn = "Gold cannot be fresher than silver: its effective lag is bounded by silver's 30 minutes. Fix the upstream lag or set silver to DOWNSTREAM."; }
      var gInt = Math.max(0.5, gEff / 2);
      var sInt = silver === "downstream" ? gInt : Math.max(0.5, sLag / 2);
      var gPerDay = Math.round(1440 / gInt);
      var sPerDay = Math.round(1440 / sInt);
      var rowsPer = Math.round(rate * gInt);

      clear(stage);
      var W = 600, H = 120;
      var s = svg("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "Refresh ticks over two hours" });
      s.appendChild(svg("rect", { x: "0", y: "0", width: String(W), height: String(H), rx: "8", fill: "var(--surface-2)", stroke: "var(--line)" }));
      var lanes = [["silver", sInt, 38], ["gold", gInt, 82]];
      for (var l = 0; l < lanes.length; l++) {
        var y = lanes[l][2];
        s.appendChild(svg("text", { x: "10", y: String(y + 4), fill: "var(--text)", "font-size": "12" }, lanes[l][0]));
        s.appendChild(svg("line", { x1: "60", y1: String(y), x2: String(W - 10), y2: String(y), stroke: "var(--line)" }));
        var step = lanes[l][1];
        var count = 0;
        for (var t = step; t <= 120 && count < 240; t += step, count++) {
          var x = 60 + (t / 120) * (W - 70);
          s.appendChild(svg("rect", { x: String(x - 1.5), y: String(y - 9), width: "3", height: "18", fill: l === 0 ? "color-mix(in srgb, #34d399 22%, transparent)" : "color-mix(in srgb, #818cf8 22%, transparent)", stroke: "var(--text-dim)", "stroke-width": "0.5" }));
        }
      }
      s.appendChild(svg("text", { x: "60", y: String(H - 6), fill: "var(--text-dim)", "font-size": "11" }, "0 min"));
      s.appendChild(svg("text", { x: String(W - 60), y: String(H - 6), fill: "var(--text-dim)", "font-size": "11" }, "120 min"));
      stage.appendChild(s);
      var msg = rate === 0
        ? "No upstream changes: scheduled refreshes find nothing to do and are typically skipped without doing real work."
        : silver === "downstream"
          ? "Silver uses TARGET_LAG = DOWNSTREAM, so it refreshes only when gold needs it. One cadence, one snapshot."
          : silver === "fixed1"
            ? "Silver has its own 1-minute lag, so it refreshes far more often than gold consumes it. Pay for that only if something else reads silver directly."
            : "Silver has its own 30-minute lag.";
      stage.appendChild(h("p", { style: "margin:0.6rem 0 0;font-size:0.86rem;color:var(--text)" }, msg));
      if (warn) stage.appendChild(h("p", { style: "margin:0.4rem 0 0;font-size:0.86rem;color:var(--accent-ink)" }, warn));

      clear(readout);
      readout.appendChild(ro("gold refreshes/day", fmt(gPerDay)));
      readout.appendChild(ro("silver refreshes/day", fmt(sPerDay)));
      readout.appendChild(ro("worst-case gold staleness", gEff + " min"));
      readout.appendChild(ro("rows per gold refresh", fmt(rowsPer)));
      readout.appendChild(ro("warehouse resumes/day (upper bound)", fmt(rate === 0 ? 0 : gPerDay + (silver === "downstream" ? 0 : sPerDay))));
    }

    var lagIn = h("input", { type: "range", min: "1", max: "120", step: "1", value: "10", "aria-label": "Gold target lag in minutes" });
    lagIn.addEventListener("input", function () {
      var v = Number(lagIn.value); lag = isFinite(v) && v >= 1 ? v : 10;
      lagOut.textContent = lag + " min"; paint();
    });
    var rateIn = h("input", { type: "range", min: "0", max: "5000", step: "50", value: "200", "aria-label": "Upstream change rate in rows per minute" });
    rateIn.addEventListener("input", function () {
      var v = Number(rateIn.value); rate = isFinite(v) && v >= 0 ? v : 200;
      rateOut.textContent = rate + " rows/min"; paint();
    });
    mount.appendChild(h("div", { class: "widget-controls" },
      field("Gold target lag", lagIn, lagOut),
      field("Upstream change rate", rateIn, rateOut),
      segment([["downstream", "Silver: DOWNSTREAM"], ["fixed1", "Silver: 1 minute"], ["fixed30", "Silver: 30 minutes"]], 0, function (v) { silver = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- quizzes ---------- */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "ingest-load": {
      title: "Loading data checkpoint",
      sub: "Stages, COPY options and load metadata, Snowpipe and Snowpipe Streaming.",
      questions: [
        { q: "A scheduled COPY INTO runs over a stage prefix holding yesterday's already-loaded files plus three new ones. FORCE is not set. What happens?",
          options: ["Every file reloads, duplicating yesterday's rows", "Only the three new files load; the others are skipped using the table's load metadata", "COPY fails because some files were already loaded", "Only files modified in the last 24 hours are considered"],
          answer: 1,
          explain: "Snowflake keeps per-table load metadata (file name plus checksum) for 64 days and skips files it has already loaded. That is what makes re-running COPY safe. FORCE = TRUE overrides it and is how you get duplicates on purpose or by accident." },
        { q: "A Snowpipe hits a malformed row in one file. With no ON_ERROR specified in the pipe's COPY, what is the default behaviour?",
          options: ["ABORT_STATEMENT: the pipe stops loading all files", "CONTINUE: bad rows are dropped, the rest of the file loads", "SKIP_FILE: the whole file is skipped and the error is recorded in load history", "The pipe pauses itself until an admin resumes it"],
          answer: 2,
          explain: "Bulk COPY defaults to ABORT_STATEMENT, but Snowpipe defaults to SKIP_FILE so one bad file cannot block a continuous stream. Check COPY_HISTORY for skipped files, or set ON_ERROR = CONTINUE if partial files are acceptable." },
        { q: "A vendor sends a new CSV layout. You want to see parse errors without loading a single row. Which statement does that?",
          options: ["COPY INTO ... VALIDATION_MODE = RETURN_ERRORS", "COPY INTO a temporary table with FORCE = TRUE", "LIST @vendor_stage PATTERN = '.*csv'", "SELECT * FROM TABLE(INFORMATION_SCHEMA.COPY_HISTORY(...))"],
          answer: 0,
          explain: "VALIDATION_MODE runs the parse and returns errors (or sample rows) without loading. LIST only shows files, and COPY_HISTORY only reports loads that already happened. Note that VALIDATION_MODE cannot be combined with a COPY that transforms columns." },
        { q: "Snowpipe cost jumped after an upstream team started writing about two million 5 KB JSON files a day. What is the most effective fix?",
          options: ["Give the pipe a larger warehouse", "Run ALTER PIPE ... REFRESH every hour", "Set ON_ERROR = CONTINUE so files load faster", "Batch at the producer into files of roughly 100-250 MB, or move the producer to Snowpipe Streaming"],
          answer: 3,
          explain: "Snowpipe is serverless, so there is no warehouse to resize. File-based ingestion carries per-file overhead, and two million tiny files pay it two million times. Fewer, well-sized files, or row-based streaming with no files at all, attacks the actual cost driver." },
        { q: "How does Snowpipe Streaming let a Kafka consumer restart without duplicating or losing rows?",
          options: ["Snowflake deduplicates rows on the table's primary key", "The connector gives every row a unique file name", "Each channel records the last committed offset token; on restart the client reads it and resumes from the next source offset", "It sets ON_ERROR = ABORT_STATEMENT on every insert"],
          answer: 2,
          explain: "Primary keys are not enforced in Snowflake, so they cannot dedupe anything. Exactly-once comes from the channel: you pass the source offset as the offset token with each batch, Snowflake persists the last committed one, and after a crash you resume from there. One channel per partition keeps ordering per partition." },
        { q: "You point a new COPY at a prefix holding files last modified 90 days ago that this table has no load metadata for. What happens by default?",
          options: ["They load normally like any new file", "COPY raises an error and stops", "They are skipped as load-status-uncertain unless you set LOAD_UNCERTAIN_FILES = TRUE (or FORCE = TRUE)", "Snowflake restores their metadata from Fail-safe"],
          answer: 2,
          explain: "Load metadata expires after 64 days. For files older than that, Snowflake cannot tell whether they were loaded before, so it skips them by default. LOAD_UNCERTAIN_FILES = TRUE tells it to load them, and you take responsibility for any duplicates." }
      ]
    },
    "ingest-transform": {
      title: "Streams, tasks & dynamic tables checkpoint",
      sub: "Offsets, change rows, task graphs, target lag and CDC MERGE.",
      questions: [
        { q: "One row is updated in a table that has a standard stream. What does the stream show before it is consumed?",
          options: ["One row with METADATA$ACTION = 'UPDATE'", "Two rows, a DELETE of the old image and an INSERT of the new one, both with METADATA$ISUPDATE = TRUE", "One INSERT row with METADATA$ISUPDATE = FALSE", "Nothing, because standard streams record inserts only"],
          answer: 1,
          explain: "Streams have no UPDATE action. An update is a DELETE/INSERT pair flagged ISUPDATE = TRUE, which is why CDC MERGE logic usually drops the DELETE half of update pairs and treats the INSERT half as an upsert." },
        { q: "An analyst runs SELECT * FROM orders_stream to debug. What happens to the stream offset?",
          options: ["Nothing; only a committed DML statement that reads the stream advances it", "It advances, and the pipeline loses those changes", "It advances only if the SELECT returns rows", "It resets to the table's creation version"],
          answer: 0,
          explain: "Querying a stream is safe. The offset moves only when the stream is consumed by a DML statement (INSERT, MERGE, CTAS and so on) whose transaction commits. That lets you inspect pending changes without disrupting the consumer." },
        { q: "A row is inserted and then deleted before anyone consumes the stream. What do a standard stream and an append-only stream show?",
          options: ["Both show an INSERT and a DELETE", "Both show nothing", "Standard shows the INSERT; append-only shows nothing", "Standard shows nothing (the net change is zero); append-only still shows the INSERT"],
          answer: 3,
          explain: "A standard stream returns the net delta between the offset and now, and an insert followed by a delete nets to nothing. An append-only stream tracks inserts only and ignores deletes, so the inserted row still appears. That makes append-only cheaper and right for insert-heavy feeds, but wrong when deletes matter." },
        { q: "A root task has WHEN SYSTEM$STREAM_HAS_DATA('raw.orders_stream') and the stream is empty at the scheduled time. What do you pay for?",
          options: ["A full warehouse resume with its 60-second minimum", "The WHEN condition is evaluated in cloud services; the run is skipped and no warehouse resumes", "Nothing is evaluated; the task never wakes up", "The child tasks still run against an empty stream"],
          answer: 1,
          explain: "WHEN conditions are checked by the cloud services layer, so an empty stream skips the run without resuming a warehouse. That is why a guarded one-minute task is cheap, while an unguarded one burns at least a minute of warehouse time on every run." },
        { q: "A silver dynamic table uses TARGET_LAG = DOWNSTREAM. Nothing downstream of it is a dynamic table; only dashboards query it. How often does it refresh on its own?",
          options: ["Every minute, the minimum lag", "Once a day by default", "It is never scheduled; it refreshes only when a downstream dynamic table needs it or someone runs a manual refresh", "Whenever a dashboard queries it"],
          answer: 2,
          explain: "DOWNSTREAM means the table's freshness is driven by its dynamic-table consumers. With none, nothing schedules it, and queries from dashboards do not trigger refreshes. Give a table that people read directly an explicit target lag." },
        { q: "A MERGE from a CDC feed fails with a duplicate-row error because a key was updated twice in the batch. What is the right fix?",
          options: ["Deduplicate the source to the latest event per key (for example QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY event_ts DESC) = 1) before merging", "Set ERROR_ON_NONDETERMINISTIC_MERGE = FALSE and move on", "Add a primary key constraint to the target", "Use INSERT OVERWRITE instead of MERGE"],
          answer: 0,
          explain: "When several source rows match one target row, the result depends on processing order, so Snowflake refuses. Turning the check off just picks an arbitrary winner. Collapsing the batch to one row per key, ordered by a trustworthy sequence, makes the MERGE deterministic and idempotent." }
      ]
    },
    "ingest-open": {
      title: "Semi-structured & open formats checkpoint",
      sub: "VARIANT, FLATTEN, insert gotchas, external tables and Iceberg.",
      questions: [
        { q: "INSERT INTO events (payload) VALUES (PARSE_JSON('{\"a\":1}')) fails with an invalid expression error. What is the fix?",
          options: ["Wrap the literal in TO_VARIANT inside VALUES", "Use INSERT INTO events (payload) SELECT PARSE_JSON('{\"a\":1}'), with UNION ALL for more rows", "Cast the column to VARCHAR first", "Escape the braces in the JSON string"],
          answer: 1,
          explain: "The VALUES clause takes constants only, so any function call, PARSE_JSON included, is rejected. Moving the expressions into a SELECT (one per row, joined by UNION ALL) is the standard workaround and works for any expression." },
        { q: "Someone runs INSERT INTO events (payload) SELECT '{\"a\":1}'. The insert succeeds, but payload:a returns NULL. Why?",
          options: ["The JSON is invalid", "VARIANT columns strip numeric values", "Path notation needs double quotes", "The string literal was stored as a VARIANT holding a string, not parsed into an object, so there is no key a"],
          answer: 3,
          explain: "A string literal types as VARCHAR, and casting VARCHAR to VARIANT wraps the text as a JSON string value. Nothing parses it, so payload is the string itself and has no fields. PARSE_JSON (or TRY_PARSE_JSON) turns the text into an object." },
        { q: "LATERAL FLATTEN(input => o.payload:items) silently drops orders whose items array is empty. How do you keep them?",
          options: ["Add OUTER => TRUE to FLATTEN", "Add RECURSIVE => TRUE", "Use a LEFT JOIN instead of LATERAL", "Cast items to ARRAY first"],
          answer: 0,
          explain: "FLATTEN produces no output rows for an empty or missing input, so the lateral join removes the parent row. OUTER => TRUE emits one row with NULL index and value, so the parent row survives. RECURSIVE does something else: it walks nested structures." },
        { q: "SELECT payload:customer.name FROM events returns \"Ann\" with the double quotes, and joining it to a VARCHAR column matches nothing. What is going on?",
          options: ["The data contains literal quote characters", "The path traversal returns VARIANT; cast it with ::STRING to get plain text", "Snowflake JSON paths are case-sensitive", "The column needs a collation"],
          answer: 1,
          explain: "Path access returns VARIANT, which displays JSON strings with quotes and compares differently from plain text. Casting with ::STRING (or ::VARCHAR) extracts the text. Always cast at the edge where semi-structured data meets typed columns." },
        { q: "Spark jobs and Snowflake must both use the same tables, with the data in open Parquet in your own bucket, and Snowflake doing the writes. Which table type fits?",
          options: ["An external table over the bucket", "A native Snowflake table, shared with Spark through a share", "A Snowflake-managed Iceberg table on an external volume, which Spark reads through an Iceberg catalog", "A transient table with Time Travel set to 0"],
          answer: 2,
          explain: "Snowflake-managed Iceberg tables write Parquet data files and Iceberg metadata to your external volume, with full Snowflake DML. Other engines read the same files through an Iceberg catalog. External tables are read-only, and native tables keep data in Snowflake's internal format." },
        { q: "Queries on an external table over s3 paths like .../dt=2026-10-01/... scan every file even with WHERE dt = '2026-10-01'. What is missing?",
          options: ["A clustering key on the external table", "AUTO_REFRESH = TRUE", "Search optimization", "A partition column computed from METADATA$FILENAME and declared in PARTITION BY"],
          answer: 3,
          explain: "External tables prune only on declared partition columns, which you derive from the file path. Without one, every file in the location is a candidate. AUTO_REFRESH keeps the file list current but does not prune anything." }
      ]
    }
  });

  /* ---------- track ---------- */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.ingest = {
    id: "ingest",
    name: "Ingestion & Pipelines",
    short: "PIPE",
    tagline: "Land it, stream it, transform it continuously",
    color: "#34d399",
    blurb: "Getting data in and keeping it moving. Stages and file formats, COPY INTO and its load metadata, Snowpipe auto-ingest and Snowpipe Streaming, streams and tasks, dynamic tables and target lag, CDC with MERGE, and the open edge: VARIANT, FLATTEN, external tables and Iceberg.",
    modules: [
      {
        id: "load",
        name: "Loading Data",
        icon: "database",
        lessons: [
          {
            id: "stages",
            title: "Stages and file formats",
            summary: "A stage is a named pointer to files plus parsing defaults; get the stage and format right and every load downstream gets simpler.",
            minutes: 9,
            tags: ["stages", "file-formats", "storage-integration"],
            blocks: [
              { t: "p", html: "Think of a <strong>stage</strong> as a mount point: a name that resolves to a file location (Snowflake-managed or your own bucket) plus optional defaults for how to parse what is there. COPY, Snowpipe, external tables and <code class='tok'>SELECT ... FROM @stage</code> all read through one. A <strong>file format</strong> is the parsing contract: delimiter, header, NULL markers, compression, date formats." },
              { t: "h", text: "Four kinds of stage" },
              { t: "table", headers: ["Stage", "Reference", "Where the files live", "Use it for"], rows: [
                ["User stage", "<code class='tok'>@~</code>", "Snowflake storage, one per user", "Ad-hoc personal uploads; cannot be shared or granted"],
                ["Table stage", "<code class='tok'>@%orders</code>", "Snowflake storage, one per table", "Quick single-table loads by the table owner"],
                ["Named internal", "<code class='tok'>@landing.int_stage</code>", "Snowflake storage, grantable object", "PUT from CI or apps, team pipelines, encryption handled for you"],
                ["Named external", "<code class='tok'>@landing.s3_events</code>", "Your S3 / GCS / Azure container", "Data-lake landing zones, Snowpipe auto-ingest, external tables"]
              ] },
              { t: "code", lang: "sql", code: L(
                "-- One-time, by an admin: trust an IAM role instead of embedding keys",
                "CREATE STORAGE INTEGRATION s3_landing_int",
                "  TYPE = EXTERNAL_STAGE",
                "  STORAGE_PROVIDER = 'S3'",
                "  ENABLED = TRUE",
                "  STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<aws_account_id>:role/<snowflake_load_role>'",
                "  STORAGE_ALLOWED_LOCATIONS = ('s3://acme-landing/events/', 's3://acme-landing/orders/');",
                "",
                "DESC INTEGRATION s3_landing_int;  -- copy STORAGE_AWS_IAM_USER_ARN + EXTERNAL_ID into the role trust policy",
                "",
                "USE DATABASE IDENTIFIER($raw_db);  -- set per environment, e.g. SET raw_db = 'RAW_STG';",
                "CREATE STAGE landing.s3_events",
                "  URL = 's3://acme-landing/events/'",
                "  STORAGE_INTEGRATION = s3_landing_int",
                "  FILE_FORMAT = landing.ff_json",
                "  DIRECTORY = (ENABLE = TRUE);") },
              { t: "note", variant: "warn", html: "Never put cloud access keys in a stage's <code class='tok'>CREDENTIALS = (...)</code>. They end up in DDL history, in scripts and in whoever runs <code class='tok'>GET_DDL</code>. A <strong>storage integration</strong> uses a role trust relationship, so there is no secret to leak or rotate, and <code class='tok'>STORAGE_ALLOWED_LOCATIONS</code> limits which prefixes any stage built on it can reach." },
              { t: "h", text: "File formats are contracts" },
              { t: "code", lang: "sql", code: L(
                "CREATE FILE FORMAT landing.ff_csv",
                "  TYPE = CSV",
                "  FIELD_DELIMITER = ','",
                "  SKIP_HEADER = 1",
                "  FIELD_OPTIONALLY_ENCLOSED_BY = '\"'",
                "  NULL_IF = ('', 'NULL', '\\\\N')",
                "  EMPTY_FIELD_AS_NULL = TRUE",
                "  ERROR_ON_COLUMN_COUNT_MISMATCH = TRUE",
                "  TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS'",
                "  COMPRESSION = AUTO;",
                "",
                "CREATE FILE FORMAT landing.ff_json",
                "  TYPE = JSON",
                "  STRIP_OUTER_ARRAY = TRUE   -- one row per array element, not one giant VARIANT",
                "  IGNORE_UTF8_ERRORS = FALSE;",
                "",
                "CREATE FILE FORMAT landing.ff_parquet TYPE = PARQUET;") },
              { t: "ul", items: [
                "<strong>Name file formats, do not inline them.</strong> A named format is versioned with your DDL and shared by COPY, pipes and external tables, so the parsing rules cannot drift between paths.",
                "<strong>NULL_IF and EMPTY_FIELD_AS_NULL</strong> decide whether an empty string becomes NULL. Getting this wrong shows up months later as <code class='tok'>COUNT(col)</code> disagreeing with the source.",
                "<strong>STRIP_OUTER_ARRAY</strong> matters for JSON exports that wrap every record in one top-level array; without it the whole file becomes one row and can hit the VARIANT size limit.",
                "<strong>Explicit timestamp formats</strong> beat <code class='tok'>AUTO</code> when sources mix <code class='tok'>MM/DD</code> and <code class='tok'>DD/MM</code>."
              ] },
              { t: "h", text: "Look before you load" },
              { t: "code", lang: "sql", code: L(
                "LIST @landing.s3_events PATTERN = '.*2026/10/28/.*[.]json[.]gz';",
                "",
                "-- Query staged files directly; nothing is loaded",
                "SELECT METADATA$FILENAME, METADATA$FILE_ROW_NUMBER, $1",
                "FROM @landing.s3_events (FILE_FORMAT => 'landing.ff_json', PATTERN => '.*2026/10/28/.*')",
                "LIMIT 20;",
                "",
                "-- Derive column definitions from Parquet/Avro/ORC (and CSV with PARSE_HEADER)",
                "SELECT * FROM TABLE(INFER_SCHEMA(",
                "  LOCATION => '@landing.s3_orders/2026/10/',",
                "  FILE_FORMAT => 'landing.ff_parquet'));") },
              { t: "stat", items: [
                { v: "100-250 MB", k: "compressed file size sweet spot" },
                { v: "gzip", k: "PUT compresses by default (AUTO_COMPRESS)" },
                { v: "64 days", k: "per-table load metadata retention" }
              ] },
              { t: "table", headers: ["Tier", "Landing design", "Why it scores that way"], rows: [
                ["Naive", "Table stages and inline CSV options in every COPY", "Parsing rules drift per script; nothing is grantable or reusable"],
                ["Solid", "Named external stage on a storage integration, named file formats, date-partitioned prefixes", "No secrets, reusable contracts, PATTERN can target a day"],
                ["Standout", "Solid, plus directory tables, environment database chosen through <code class='tok'>IDENTIFIER($raw_db)</code>, and an INFER_SCHEMA check in CI when a source changes", "Files are catalogued, scripts promote across environments unchanged, and schema drift is caught before production"]
              ] },
              { t: "note", variant: "tip", html: "<code class='tok'>DIRECTORY = (ENABLE = TRUE)</code> adds a queryable file catalog to the stage (<code class='tok'>SELECT * FROM DIRECTORY(@stage)</code>) with size, last-modified time and a file URL. It is handy for auditing what landed and for unstructured-file pipelines." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"vendor drops files in a bucket\", \"we keep AWS keys in the COPY script\", \"the same CSV parses differently in two jobs\", \"how do we read the file before loading it\". Reach for a storage integration, a named stage and a named file format." },
              { t: "note", variant: "key", html: "<strong>Stage = where; file format = how.</strong> Name both, build external stages on a storage integration (never inline keys), and query the files with <code class='tok'>SELECT ... FROM @stage</code> before you commit to a load." }
            ]
          },
          {
            id: "copy-into",
            title: "COPY INTO: options, validation and load history",
            summary: "COPY is an idempotent bulk loader keyed on per-table file metadata; its options decide what happens to bad rows, reloads and schema drift.",
            minutes: 11,
            tags: ["copy-into", "on-error", "load-history"],
            blocks: [
              { t: "p", html: "Mental model: <strong>COPY INTO is a set operation over files</strong>. It lists the candidate files, removes the ones this table has already loaded (according to its load metadata), parses the rest in parallel across the warehouse's threads, and commits them as one transaction. Re-running it is safe by design, and that one property is what most good ingestion jobs are built on." },
              { t: "code", lang: "sql", code: L(
                "COPY INTO raw.orders (order_id, customer_id, amount, ordered_at, _src_file, _src_row, _loaded_at)",
                "FROM (",
                "  SELECT $1, $2, $3::NUMBER(12,2), TO_TIMESTAMP_NTZ($4),",
                "         METADATA$FILENAME, METADATA$FILE_ROW_NUMBER, CURRENT_TIMESTAMP()",
                "  FROM @landing.s3_orders",
                ")",
                "PATTERN = '.*2026/10/28/.*[.]csv[.]gz'",
                "FILE_FORMAT = (FORMAT_NAME = 'landing.ff_csv')",
                "ON_ERROR = SKIP_FILE",
                "PURGE = FALSE;") },
              { t: "h", text: "ON_ERROR: what a bad row costs you" },
              { t: "table", headers: ["ON_ERROR", "Behaviour", "Use when"], rows: [
                ["<code class='tok'>ABORT_STATEMENT</code>", "Default for bulk COPY: the first error rolls back the whole statement", "Financial or contractual loads where partial data is worse than none"],
                ["<code class='tok'>SKIP_FILE</code>", "Default for Snowpipe: a file with any error is skipped whole", "Files are atomic units (one export per file) and can be replayed"],
                ["<code class='tok'>SKIP_FILE_10</code> / <code class='tok'>SKIP_FILE_5%</code>", "Skip a file only when its errors cross a count or percentage", "Noisy sources where a few bad rows per file are expected"],
                ["<code class='tok'>CONTINUE</code>", "Load good rows, drop bad ones", "Best-effort telemetry; always pair with VALIDATE to see what was dropped"]
              ] },
              { t: "h", text: "Validate without loading, inspect after loading" },
              { t: "code", lang: "sql", code: L(
                "-- Dry run: parse everything, load nothing, return the errors",
                "COPY INTO raw.orders",
                "FROM @landing.s3_orders",
                "PATTERN = '.*2026/10/28/.*'",
                "FILE_FORMAT = (FORMAT_NAME = 'landing.ff_csv')",
                "VALIDATION_MODE = RETURN_ERRORS;   -- or RETURN_10_ROWS / RETURN_ALL_ERRORS",
                "",
                "-- After a load with ON_ERROR = CONTINUE: what got dropped?",
                "SELECT * FROM TABLE(VALIDATE(raw.orders, JOB_ID => '_last'));") },
              { t: "note", variant: "trap", html: "<code class='tok'>VALIDATION_MODE</code> does not work with a COPY that transforms data (the <code class='tok'>FROM (SELECT ...)</code> form). Dry-run with the plain form against the same file format, then run the transforming COPY for real." },
              { t: "h", text: "Load metadata and the 64-day rule" },
              { t: "ul", items: [
                "Each table remembers which files it loaded (path, plus an ETag or checksum) for <strong>64 days</strong>. Already-loaded files are skipped unless you set <code class='tok'>FORCE = TRUE</code>.",
                "A file that changes content (new ETag) counts as new and loads again. So does a <strong>renamed or re-copied</strong> file. Moving files between prefixes is a classic way to get duplicates.",
                "Files whose LAST_MODIFIED is older than 64 days and that have no metadata are <strong>load-status uncertain</strong> and skipped, unless <code class='tok'>LOAD_UNCERTAIN_FILES = TRUE</code>.",
                "<code class='tok'>PURGE = TRUE</code> deletes files after a successful load, on a best-effort basis. Prefer bucket lifecycle rules if you need guarantees.",
                "Throughput comes from parallelism across files: each thread loads one file, so one 20 GB file is slower than eighty 250 MB files on the same warehouse."
              ] },
              { t: "code", lang: "sql", code: L(
                "-- Real time, last 14 days, per table",
                "SELECT file_name, status, row_count, row_parsed, first_error_message, last_load_time",
                "FROM TABLE(INFORMATION_SCHEMA.COPY_HISTORY(",
                "  TABLE_NAME => 'RAW.ORDERS',",
                "  START_TIME => DATEADD(hour, -24, CURRENT_TIMESTAMP())))",
                "ORDER BY last_load_time DESC;",
                "",
                "-- Account-wide, 365 days, with some latency: trend failures by table",
                "SELECT table_name, status, COUNT(*) AS files, SUM(row_count) AS rows_loaded",
                "FROM SNOWFLAKE.ACCOUNT_USAGE.COPY_HISTORY",
                "WHERE last_load_time >= DATEADD(day, -7, CURRENT_TIMESTAMP())",
                "GROUP BY 1, 2 ORDER BY files DESC;") },
              { t: "table", headers: ["Source", "Freshness", "Retention", "Includes Snowpipe?"], rows: [
                ["<code class='tok'>INFORMATION_SCHEMA.COPY_HISTORY()</code>", "Real time", "14 days", "Yes"],
                ["<code class='tok'>ACCOUNT_USAGE.COPY_HISTORY</code>", "Lags, typically up to ~2 hours", "365 days", "Yes"],
                ["<code class='tok'>INFORMATION_SCHEMA.LOAD_HISTORY</code> view", "Real time", "14 days", "No, bulk COPY only"]
              ] },
              { t: "h", text: "Schema drift" },
              { t: "code", lang: "sql", code: L(
                "ALTER TABLE raw.orders SET ENABLE_SCHEMA_EVOLUTION = TRUE;",
                "",
                "COPY INTO raw.orders",
                "FROM @landing.s3_orders_parquet",
                "FILE_FORMAT = (FORMAT_NAME = 'landing.ff_parquet')",
                "MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;  -- map by name, not position; new columns can be added") },
              { t: "table", headers: ["Tier", "Reload strategy", "Consequence"], rows: [
                ["Naive", "<code class='tok'>FORCE = TRUE</code> on every run \"to be safe\"", "Every rerun duplicates data; dedupe becomes a downstream tax"],
                ["Solid", "Default metadata skipping, ON_ERROR chosen per source, COPY_HISTORY checked after each run", "Reruns are no-ops; failures are visible"],
                ["Standout", "Solid, plus lineage columns (<code class='tok'>METADATA$FILENAME</code>, row number), an explicit replay procedure (delete by <code class='tok'>_src_file</code>, then FORCE just those files), and alerts on SKIP_FILE counts", "Any file can be replayed surgically, and bad loads are caught by monitoring rather than by users"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we got duplicates after re-running the job\", \"one bad row killed the nightly load\", \"how do we test a new file layout\", \"files moved to an archive folder got loaded again\". Talk about load metadata, ON_ERROR, VALIDATION_MODE and lineage columns." },
              { t: "note", variant: "key", html: "<strong>COPY is idempotent per file, for 64 days, per table.</strong> Let metadata do the deduping, choose ON_ERROR on purpose, dry-run with VALIDATION_MODE, and stamp every row with its source file so a replay is a delete plus a targeted FORCE." }
            ]
          },
          {
            id: "snowpipe",
            title: "Snowpipe auto-ingest",
            summary: "A pipe is a stored COPY statement triggered by storage events and run on serverless compute; file size and count drive what it costs.",
            minutes: 10,
            tags: ["snowpipe", "auto-ingest", "serverless"],
            blocks: [
              { t: "p", html: "A <strong>pipe</strong> wraps one COPY statement and attaches it to a queue. When a file lands in the bucket, the storage service sends an event, Snowflake queues the file, and serverless compute runs the COPY for it. You do not size or suspend a warehouse. In exchange you give up control over batching and ordering." },
              { t: "code", lang: "sql", code: L(
                "CREATE PIPE landing.orders_pipe",
                "  AUTO_INGEST = TRUE",
                "  COMMENT = 'orders CSVs from the order service'",
                "AS",
                "COPY INTO raw.orders (order_id, customer_id, amount, ordered_at, _src_file)",
                "FROM (SELECT $1, $2, $3, $4, METADATA$FILENAME FROM @landing.s3_orders)",
                "FILE_FORMAT = (FORMAT_NAME = 'landing.ff_csv');",
                "",
                "-- The notification_channel column is the queue ARN to target from the bucket's",
                "-- event notification (S3) -- Azure and GCS use a notification integration instead",
                "SHOW PIPES LIKE 'ORDERS_PIPE' IN SCHEMA landing;") },
              { t: "ol", items: [
                "The producer writes and closes a file under the stage's prefix.",
                "The bucket emits an object-created event to the pipe's queue.",
                "Snowflake checks the pipe's own load history (kept 14 days) and drops files already loaded.",
                "Serverless compute runs the COPY, typically within a minute of the event.",
                "Results appear in <code class='tok'>COPY_HISTORY</code> with the pipe name; errors follow ON_ERROR, which defaults to <code class='tok'>SKIP_FILE</code> for pipes."
              ] },
              { t: "stat", items: [
                { v: "< 1 min", k: "typical file-to-table latency" },
                { v: "14 days", k: "pipe load history (dedup window)" },
                { v: "SKIP_FILE", k: "default ON_ERROR for pipes" }
              ] },
              { t: "h", text: "The cost shape" },
              { t: "p", html: "Snowpipe bills serverless compute for the loading work and adds an overhead per file. The exact rate card has changed over time and a newer model prices by data volume, but under either one <strong>the number and size of files is the lever you control</strong>. A thousand 200 MB files are cheap and fast. Two million 5 KB files cost far more for the same bytes and can lag behind." },
              { t: "widget", id: "loadPathLab" },
              { t: "h", text: "Operating a pipe" },
              { t: "code", lang: "sql", code: L(
                "SELECT SYSTEM$PIPE_STATUS('landing.orders_pipe');  -- executionState, pendingFileCount, lastIngestedTimestamp",
                "",
                "-- Backfill files that landed before the notification was wired (last 7 days only)",
                "ALTER PIPE landing.orders_pipe REFRESH PREFIX = '2026/10/27/';",
                "",
                "-- Pause before changing anything upstream",
                "ALTER PIPE landing.orders_pipe SET PIPE_EXECUTION_PAUSED = TRUE;",
                "",
                "-- Credits by pipe, account-wide",
                "SELECT pipe_name, SUM(credits_used) AS credits, SUM(files_inserted) AS files, SUM(bytes_inserted) AS bytes",
                "FROM SNOWFLAKE.ACCOUNT_USAGE.PIPE_USAGE_HISTORY",
                "WHERE start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())",
                "GROUP BY 1 ORDER BY credits DESC;") },
              { t: "note", variant: "trap", html: "You cannot edit a pipe's COPY in place; you recreate the pipe. A recreated pipe starts with <strong>empty load history</strong>, so a careless <code class='tok'>REFRESH</code> afterwards can reload files the old pipe already ingested. Pause, recreate, then refresh only prefixes you know are new (the table's own COPY metadata may still catch some duplicates, but do not rely on it)." },
              { t: "ul", items: [
                "<strong>No ordering guarantee</strong> across files. If order matters, carry a sequence or event timestamp in the data and resolve it downstream.",
                "<strong>Deduplication is by file name</strong> within the history window. A producer that rewrites the same name with new content can be skipped; one that writes new names for the same content creates duplicates.",
                "<strong>One pipe per COPY target.</strong> Fanning one prefix into several tables means several pipes and an event fan-out (for example SNS) in front of the queues."
              ] },
              { t: "compare",
                bad: { title: "COPY from a task every minute", items: ["Warehouse resumes constantly, 60-second minimum each time", "Latency is your schedule plus queueing", "You own sizing and suspend"] },
                good: { title: "Snowpipe auto-ingest", items: ["Event-driven, no warehouse to manage", "Typically sub-minute latency", "Cost scales with file count: batch at the producer"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"files arrive all day and analysts want them within minutes\", \"we run COPY every five minutes and the warehouse never suspends\", \"Snowpipe bill doubled after a producer change\". Talk about pipes, notification channels and file sizing." },
              { t: "note", variant: "key", html: "<strong>Snowpipe = stored COPY + event queue + serverless compute.</strong> It removes warehouse management and gets latency under a minute, and its cost follows file count, so the most important tuning is upstream: fewer, larger files." }
            ]
          },
          {
            id: "snowpipe-streaming",
            title: "Snowpipe Streaming and the Kafka connector",
            summary: "Snowpipe Streaming writes rows straight into tables through channels with offset tokens, skipping files for seconds-level latency and exactly-once resume.",
            minutes: 11,
            tags: ["snowpipe-streaming", "kafka", "exactly-once"],
            blocks: [
              { t: "p", html: "File-based Snowpipe still makes a producer write, close and announce a file. <strong>Snowpipe Streaming</strong> drops the file entirely: a client opens a <strong>channel</strong> to a table and pushes rows; Snowflake makes them queryable typically within seconds. The client tags each batch with an <strong>offset token</strong> (your source position, such as a Kafka offset), and Snowflake persists the last committed token per channel. That token is how you get exactly-once delivery." },
              { t: "table", headers: ["", "Snowpipe (files)", "Snowpipe Streaming (rows)"], rows: [
                ["Unit of ingest", "A file in a stage", "Rows sent over a channel"],
                ["Typical latency", "Under a minute", "A few seconds"],
                ["Ordering", "None across files", "Preserved within a channel"],
                ["Dedup / resume", "File name in pipe history", "Offset token per channel"],
                ["Cost driver", "Files and bytes loaded", "Ingest throughput; no per-file overhead"],
                ["Typical producer", "Batch exports, CDC tools writing files", "Kafka, event services, IoT gateways"]
              ] },
              { t: "h", text: "Channels and offset tokens" },
              { t: "code", lang: "java", code: L(
                "// Connection properties come from the environment / a secrets mount, never from source code",
                "Properties props = new Properties();",
                "props.put(\"url\", System.getenv(\"SNOWFLAKE_URL\"));            // <orgname>-<account_name>.snowflakecomputing.com",
                "props.put(\"user\", System.getenv(\"SNOWFLAKE_USER\"));",
                "props.put(\"private_key\", readKey(System.getenv(\"SNOWFLAKE_PRIVATE_KEY_PATH\")));",
                "props.put(\"role\", \"INGEST_ORDERS_ROLE\");",
                "",
                "SnowflakeStreamingIngestClient client =",
                "    SnowflakeStreamingIngestClientFactory.builder(\"orders-ingest\").setProperties(props).build();",
                "",
                "OpenChannelRequest req = OpenChannelRequest.builder(\"orders-p\" + partition)",
                "    .setDBName(System.getenv(\"RAW_DB\")).setSchemaName(\"LANDING\").setTableName(\"ORDERS_STREAM_RAW\")",
                "    .setOnErrorOption(OpenChannelRequest.OnErrorOption.CONTINUE)",
                "    .build();",
                "SnowflakeStreamingIngestChannel channel = client.openChannel(req);",
                "",
                "String committed = channel.getLatestCommittedOffsetToken();   // null on first run",
                "consumer.seek(partition, committed == null ? 0 : Long.parseLong(committed) + 1);",
                "",
                "for (Record r : consumer.poll()) {",
                "  InsertValidationResponse resp = channel.insertRow(toMap(r), String.valueOf(r.offset()));",
                "  if (resp.hasErrors()) deadLetter(r, resp.getInsertErrors());",
                "}") },
              { t: "ul", items: [
                "<strong>One channel per source partition.</strong> Ordering and offsets are tracked per channel, so mapping Kafka partition N to channel N keeps resume logic trivial.",
                "<strong>Trust the committed token, not your own checkpoint.</strong> After a crash, rows sent but not yet committed are simply resent from the token onwards.",
                "<strong>Reopening a channel invalidates the old handle.</strong> Two writers on one channel name fight; the newest wins and the other gets errors. That is a feature for failover and a bug for misconfigured scaling.",
                "Primary keys are not enforced in Snowflake, so <strong>idempotency lives in the offset token</strong>, not in the table."
              ] },
              { t: "h", text: "The Kafka connector" },
              { t: "code", lang: "text", code: L(
                "name=orders-sink",
                "connector.class=com.snowflake.kafka.connector.SnowflakeSinkConnector",
                "topics=orders",
                "snowflake.ingestion.method=SNOWPIPE_STREAMING",
                "snowflake.url.name=<orgname>-<account_name>.snowflakecomputing.com:443",
                "snowflake.user.name=${env:SNOWFLAKE_USER}",
                "snowflake.private.key=${file:/opt/secrets/snowflake.properties:private_key}",
                "snowflake.role.name=INGEST_ORDERS_ROLE",
                "snowflake.database.name=${env:RAW_DB}",
                "snowflake.schema.name=LANDING",
                "snowflake.enable.schematization=true",
                "buffer.flush.time=10",
                "errors.tolerance=all",
                "errors.deadletterqueue.topic.name=orders-dlq") },
              { t: "note", variant: "warn", html: "The connector also has an older <strong>file-based mode</strong> (ingestion method <code class='tok'>SNOWPIPE</code>): it buffers records into files on an internal stage and calls Snowpipe. On busy topics with short flush times that is the tiny-file problem again. Check which mode a connector is in before tuning anything else." },
              { t: "h", text: "Cost and limits" },
              { t: "p", html: "Streaming is billed for ingest work rather than per file. Snowflake has revised the model over time: older pricing combined a client-connection charge with background compute that compacts streamed rows into regular micro-partitions, while the newer high-performance architecture prices mainly by data volume. Either way, a steady stream of small events is <em>much</em> cheaper this way than as tiny files. Watch for schema evolution needs (new fields) and for rows that fail validation, which should go to a dead-letter path rather than be dropped." },
              { t: "table", headers: ["Tier", "Kafka to Snowflake design", "Why"], rows: [
                ["Naive", "Sink to S3 every few seconds, Snowpipe per file", "Millions of tiny files: per-file overhead and lag"],
                ["Solid", "Kafka connector in streaming mode, one channel per partition, DLQ topic", "Seconds latency, exactly-once by offset token, bad records kept"],
                ["Standout", "Solid, plus a dynamic table or stream+task flattening the raw VARIANT downstream, lag and DLQ volume alerted, role and database injected per environment", "Raw landing stays append-only and replayable; modelling and freshness are declared, not hand-scheduled"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"sub-minute\" or \"seconds\" freshness, \"Kafka\", \"IoT\", \"clickstream\", \"we write a file per event\", \"no duplicates after the consumer restarts\". Reach for Snowpipe Streaming, channels and offset tokens." },
              { t: "quiz", id: "ingest-load" },
              { t: "note", variant: "key", html: "<strong>Rows, not files.</strong> Snowpipe Streaming pushes rows through channels; the offset token Snowflake commits per channel is your exactly-once resume point. Use it whenever the source is already a stream and freshness is measured in seconds." }
            ]
          }
        ]
      },
      {
        id: "transform",
        name: "Streams, Tasks & Dynamic Tables",
        icon: "queue",
        lessons: [
          {
            id: "streams",
            title: "Streams: offsets and change tracking",
            summary: "A stream is a bookmark on a table's change history that returns the net delta since it was last consumed, and it moves only when a DML consumes it.",
            minutes: 10,
            tags: ["streams", "cdc", "change-tracking"],
            blocks: [
              { t: "p", html: "A <strong>stream</strong> stores no data. It is an <strong>offset</strong>, a table version, plus the right to ask \"what changed between that version and now?\" Snowflake answers from the table's versioned micro-partitions and change-tracking metadata. Query it as often as you like; the offset only advances when a <strong>DML statement that reads the stream commits</strong>." },
              { t: "diagram", id: "sf-streams-tasks", caption: "A source table's changes accumulate behind a stream offset; a task consumes them with MERGE on a schedule, and the commit advances the offset." },
              { t: "code", lang: "sql", code: L(
                "CREATE STREAM raw.orders_stream ON TABLE raw.orders;  -- standard (delta) stream",
                "",
                "SELECT order_id, status,",
                "       METADATA$ACTION,    -- 'INSERT' or 'DELETE'",
                "       METADATA$ISUPDATE,  -- TRUE when the row is one half of an UPDATE",
                "       METADATA$ROW_ID     -- stable id for the row across changes",
                "FROM raw.orders_stream;") },
              { t: "table", headers: ["METADATA$ACTION", "METADATA$ISUPDATE", "Meaning"], rows: [
                ["INSERT", "FALSE", "A new row since the offset"],
                ["DELETE", "FALSE", "A row that existed at the offset and is now gone"],
                ["DELETE", "TRUE", "The old image of an updated row"],
                ["INSERT", "TRUE", "The new image of an updated row"]
              ] },
              { t: "h", text: "Stream types" },
              { t: "table", headers: ["Type", "Tracks", "Cost / behaviour", "Use for"], rows: [
                ["Standard", "Inserts, updates, deletes as a net delta", "Joins versions to compute the delta; insert-then-delete nets to nothing", "CDC into dimensions, anything where deletes matter"],
                ["Append-only", "Inserts only", "Cheaper: reads only added rows; ignores updates and deletes", "Event and log tables, landing tables that never change"],
                ["Insert-only", "New files' rows", "For external tables (and some Iceberg cases)", "Incrementally processing files in a lake"]
              ] },
              { t: "widget", id: "streamLab" },
              { t: "h", text: "When the offset moves" },
              { t: "ul", items: [
                "A <strong>SELECT</strong> never moves it, so debugging is safe.",
                "Any DML that reads the stream (INSERT ... SELECT, MERGE, CTAS) moves it to the version current at the start of that transaction <strong>when the transaction commits</strong>. A rollback leaves it alone.",
                "Inside an explicit transaction, every read of the stream sees the same delta, so you can feed two target tables from one stream with BEGIN ... COMMIT.",
                "Each consumer needs <strong>its own stream</strong>. Two jobs sharing one stream steal changes from each other."
              ] },
              { t: "code", lang: "sql", code: L(
                "BEGIN;",
                "  INSERT INTO curated.order_events  SELECT * EXCLUDE (METADATA$ROW_ID) FROM raw.orders_stream;",
                "  INSERT INTO audit.order_counts    SELECT CURRENT_TIMESTAMP(), COUNT(*) FROM raw.orders_stream;",
                "COMMIT;  -- both statements saw the same delta; the offset advances once",
                "",
                "-- Common idiom to skip pending changes on purpose (for example after a backfill)",
                "CREATE TEMPORARY TABLE _discard LIKE raw.orders;",
                "INSERT INTO _discard SELECT * EXCLUDE (METADATA$ACTION, METADATA$ISUPDATE, METADATA$ROW_ID)",
                "FROM raw.orders_stream WHERE FALSE;") },
              { t: "h", text: "Staleness" },
              { t: "p", html: "A stream can only reconstruct changes the table still retains. If the offset falls outside the source's Time Travel window, the stream goes <strong>stale</strong> and must be recreated (losing the pending delta). To soften this, Snowflake temporarily extends the source's retention for unconsumed streams, up to <code class='tok'>MAX_DATA_EXTENSION_TIME_IN_DAYS</code> (14 days by default). A stream on a table with 1-day retention that nobody consumes for three weeks is still lost." },
              { t: "code", lang: "sql", code: L(
                "SHOW STREAMS IN SCHEMA raw;            -- check the stale and stale_after columns",
                "SELECT SYSTEM$STREAM_HAS_DATA('raw.orders_stream');",
                "ALTER TABLE raw.orders SET MAX_DATA_EXTENSION_TIME_IN_DAYS = 30;  -- if consumers can pause longer") },
              { t: "note", variant: "trap", html: "<code class='tok'>CREATE OR REPLACE TABLE</code> on the source creates a new table, and every stream on the old one stops working. Deployment scripts that \"recreate for safety\" silently break CDC. Use <code class='tok'>ALTER TABLE</code> for schema changes on tables with streams." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"process only new or changed rows\", \"incremental without a watermark column\", \"capture deletes\", \"two jobs read the same changes\". Reach for a stream per consumer, and ask about retention and staleness." },
              { t: "note", variant: "key", html: "<strong>A stream is an offset, not a copy.</strong> SELECTs are free to repeat; only a committed DML consumes. Updates show up as DELETE/INSERT pairs with ISUPDATE = TRUE, every consumer needs its own stream, and an unconsumed stream goes stale when it outlives the source's retention." }
            ]
          },
          {
            id: "tasks",
            title: "Tasks, task graphs and serverless tasks",
            summary: "Tasks run SQL on a schedule or after other tasks, on a warehouse or on serverless compute; guarded by WHEN conditions they cost nothing when idle.",
            minutes: 10,
            tags: ["tasks", "dag", "orchestration"],
            blocks: [
              { t: "p", html: "A <strong>task</strong> is a scheduled SQL statement (often a <code class='tok'>CALL</code> or a MERGE) that runs inside Snowflake as its owner role. Tasks link into a <strong>task graph</strong>: one root task carries the schedule, and child tasks declare <code class='tok'>AFTER</code> dependencies. Think of it as in-database cron with a dependency graph, not a full orchestrator." },
              { t: "code", lang: "sql", code: L(
                "CREATE OR REPLACE TASK pipe.t_root_orders",
                "  WAREHOUSE = TRANSFORM_XS_WH",
                "  SCHEDULE = 'USING CRON */5 * * * * UTC'",
                "  WHEN SYSTEM$STREAM_HAS_DATA('raw.orders_stream')",
                "AS",
                "  CALL pipe.merge_orders();",
                "",
                "CREATE OR REPLACE TASK pipe.t_order_facts",
                "  WAREHOUSE = TRANSFORM_XS_WH",
                "  AFTER pipe.t_root_orders",
                "AS",
                "  CALL pipe.build_order_facts();",
                "",
                "CREATE OR REPLACE TASK pipe.t_finalize",
                "  WAREHOUSE = TRANSFORM_XS_WH",
                "  FINALIZE = pipe.t_root_orders      -- runs after the graph, success or failure",
                "AS",
                "  CALL ops.log_graph_run('orders');",
                "",
                "-- Tasks are created suspended: resume the children, then the root",
                "SELECT SYSTEM$TASK_DEPENDENTS_ENABLE('pipe.t_root_orders');") },
              { t: "ul", items: [
                "Only the <strong>root</strong> has a schedule; children run when all their predecessors succeed.",
                "Tasks are created <strong>suspended</strong>; nothing runs until you resume them.",
                "By default a graph does not overlap itself (<code class='tok'>ALLOW_OVERLAPPING_EXECUTION = FALSE</code>): if a run is still going at the next tick, that tick is skipped.",
                "<code class='tok'>EXECUTE TASK</code> triggers a run manually, which is the fastest way to test a graph."
              ] },
              { t: "h", text: "Warehouse or serverless" },
              { t: "table", headers: ["Compute", "Billing", "Good for", "Watch out for"], rows: [
                ["User-managed warehouse", "Warehouse credits, 60-second minimum per resume, idle until auto-suspend", "Heavy steps, sharing an already-running warehouse", "Short, frequent tasks pay the minimum and the idle tail every run"],
                ["Serverless (omit WAREHOUSE)", "Per-second serverless compute, sized by Snowflake from run history, at a rate above warehouse credits", "Short, frequent, predictable steps", "Not governed by resource monitors; track it in SERVERLESS_TASK_HISTORY"]
              ] },
              { t: "code", lang: "sql", code: L(
                "CREATE OR REPLACE TASK pipe.t_dedupe_events",
                "  USER_TASK_MANAGED_INITIAL_WAREHOUSE_SIZE = 'XSMALL'",
                "  SERVERLESS_TASK_MAX_STATEMENT_SIZE = 'MEDIUM'   -- cap auto-scaling",
                "  SCHEDULE = '2 MINUTE'",
                "  WHEN SYSTEM$STREAM_HAS_DATA('raw.events_stream')",
                "AS",
                "  CALL pipe.dedupe_events();") },
              { t: "note", variant: "tip", html: "The <code class='tok'>WHEN</code> condition is evaluated by cloud services, not by your warehouse. If <code class='tok'>SYSTEM$STREAM_HAS_DATA</code> is false, the run is skipped and no warehouse resumes. Guarding frequent tasks this way is the single biggest saving in most stream-and-task pipelines." },
              { t: "h", text: "Observability and failure" },
              { t: "code", lang: "sql", code: L(
                "SELECT name, state, scheduled_time, completed_time, error_code, error_message",
                "FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY(",
                "  SCHEDULED_TIME_RANGE_START => DATEADD(hour, -6, CURRENT_TIMESTAMP()),",
                "  RESULT_LIMIT => 200))",
                "WHERE state IN ('FAILED', 'SKIPPED', 'CANCELLED')",
                "ORDER BY scheduled_time DESC;",
                "",
                "ALTER TASK pipe.t_root_orders SET",
                "  SUSPEND_TASK_AFTER_NUM_FAILURES = 3,",
                "  TASK_AUTO_RETRY_ATTEMPTS = 2,",
                "  ERROR_INTEGRATION = ops_alerts_sns;  -- push failures to your alerting") },
              { t: "note", variant: "trap", html: "Tasks run as their <strong>owner role</strong>, not as whoever resumed them. That role needs the account-level <code class='tok'>EXECUTE TASK</code> privilege (plus <code class='tok'>EXECUTE MANAGED TASK</code> for serverless), usage on the warehouse, and every privilege the SQL needs. \"It works when I run the CALL by hand\" usually means your interactive role has more grants than the owner role." },
              { t: "table", headers: ["Tier", "Orchestration choice", "Why"], rows: [
                ["Naive", "External cron fires COPY and MERGE every minute on a big warehouse", "Warehouse never suspends; no dependency handling; failures are silent"],
                ["Solid", "Task graph with a guarded root, finalizer and failure suspension", "Idle runs are free, steps run in order, failures stop the graph"],
                ["Standout", "Solid, plus serverless for short steps, error integration to alerting, TASK_HISTORY in a dashboard, and an external orchestrator only where cross-system dependencies exist", "Compute matches step size, failures page someone, and the in-database scheduler handles in-database work"]
              ] },
              { t: "compare",
                bad: { title: "Unguarded 1-minute task on a warehouse", items: ["1,440 resumes a day", "At least 1,440 billed minutes even with no data", "Warehouse rarely gets to suspend"] },
                good: { title: "Guarded task (WHEN stream has data)", items: ["Runs only when there is a delta", "Empty ticks cost a little cloud services time", "Same freshness, a fraction of the credits"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"run this MERGE every few minutes\", \"step B must wait for step A\", \"the transform warehouse never suspends\", \"the task works manually but fails on schedule\". Reach for a guarded task graph and check the owner role." },
              { t: "note", variant: "key", html: "<strong>Tasks are in-database cron with dependencies.</strong> Put the schedule on a root guarded by <code class='tok'>SYSTEM$STREAM_HAS_DATA</code>, pick warehouse or serverless by step size, and remember the graph runs as its owner role." }
            ]
          },
          {
            id: "dynamic-tables",
            title: "Dynamic Tables and target lag",
            summary: "A dynamic table is a query plus a freshness target; Snowflake schedules incremental or full refreshes to keep it within that lag.",
            minutes: 11,
            tags: ["dynamic-tables", "target-lag", "declarative-pipelines"],
            blocks: [
              { t: "p", html: "With streams and tasks you say <em>how</em> to apply changes. With a <strong>dynamic table</strong> you say <em>what</em> the result is (a SELECT) and <em>how stale</em> it may be (<code class='tok'>TARGET_LAG</code>). Snowflake works out the dependency graph, decides when to refresh, and where it can, refreshes <strong>incrementally</strong> by processing only changed source rows." },
              { t: "code", lang: "sql", code: L(
                "CREATE OR REPLACE DYNAMIC TABLE silver.orders_clean",
                "  TARGET_LAG = DOWNSTREAM            -- refresh only when consumers need it",
                "  WAREHOUSE = TRANSFORM_S_WH",
                "  REFRESH_MODE = INCREMENTAL         -- fail loudly if the query cannot be incremental",
                "AS",
                "SELECT payload:order_id::NUMBER          AS order_id,",
                "       payload:customer_id::NUMBER       AS customer_id,",
                "       payload:amount::NUMBER(12,2)      AS amount,",
                "       payload:ts::TIMESTAMP_NTZ         AS ordered_at",
                "FROM raw.orders_stream_raw",
                "QUALIFY ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY ordered_at DESC) = 1;",
                "",
                "CREATE OR REPLACE DYNAMIC TABLE gold.daily_revenue",
                "  TARGET_LAG = '10 minutes'",
                "  WAREHOUSE = TRANSFORM_S_WH",
                "AS",
                "SELECT DATE_TRUNC('day', ordered_at) AS order_day, SUM(amount) AS revenue, COUNT(*) AS orders",
                "FROM silver.orders_clean",
                "GROUP BY 1;") },
              { t: "ul", items: [
                "<strong>Target lag</strong> is the maximum staleness relative to the base tables. The minimum is one minute.",
                "<strong>DOWNSTREAM</strong> means \"as fresh as my dynamic-table consumers require\". Intermediate tables should usually be DOWNSTREAM so the whole chain runs on one cadence.",
                "Refreshes across a graph read <strong>consistent snapshots</strong>: gold never mixes a newer silver with an older bronze.",
                "A downstream table cannot be fresher than its upstream dynamic tables; set lag at the consumer end."
              ] },
              { t: "widget", id: "lagLab" },
              { t: "h", text: "Incremental vs full refresh" },
              { t: "table", headers: ["REFRESH_MODE", "What it does", "Notes"], rows: [
                ["<code class='tok'>INCREMENTAL</code>", "Processes only changed source rows and merges the result", "Requires supported constructs; creation fails if the query cannot be incremental"],
                ["<code class='tok'>FULL</code>", "Recomputes the whole query each refresh", "Predictable and fine for small results; expensive on large ones"],
                ["<code class='tok'>AUTO</code> (default)", "Snowflake picks one at creation time", "Can silently pick FULL; check the chosen mode before production"]
              ] },
              { t: "note", variant: "warn", html: "Do not let <code class='tok'>AUTO</code> decide for a big table in production. Inspect <code class='tok'>SHOW DYNAMIC TABLES</code> (the refresh mode and its reason), then pin <code class='tok'>REFRESH_MODE = INCREMENTAL</code> so a later query change that breaks incrementality fails at deploy time, not as a quiet tenfold cost increase." },
              { t: "code", lang: "sql", code: L(
                "SELECT name, state, refresh_action, refresh_trigger,",
                "       DATEDIFF(second, refresh_start_time, refresh_end_time) AS secs",
                "FROM TABLE(INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY(NAME_PREFIX => 'ANALYTICS.GOLD.'))",
                "ORDER BY refresh_start_time DESC LIMIT 50;",
                "",
                "ALTER DYNAMIC TABLE gold.daily_revenue REFRESH;   -- on-demand",
                "ALTER DYNAMIC TABLE gold.daily_revenue SUSPEND;   -- stop scheduled refreshes",
                "ALTER DYNAMIC TABLE gold.daily_revenue SET TARGET_LAG = '30 minutes';") },
              { t: "h", text: "Streams and tasks, or dynamic tables?" },
              { t: "table", headers: ["Dimension", "Streams + tasks", "Dynamic tables"], rows: [
                ["You write", "Change-application logic (MERGE, SCD rules)", "The result query only"],
                ["Scheduling", "Cron or AFTER chains you maintain", "Derived from target lag across the graph"],
                ["Side effects", "Anything: procedures, external calls, multiple targets", "One table per definition, no side effects"],
                ["Best at", "SCD Type 2, custom error handling, fan-out to many targets", "Joins, aggregations, dedupe and flattening layers"],
                ["Cost control", "Explicit: WHEN guards, warehouse choice", "Lag is the knob: halving lag roughly doubles refreshes"]
              ] },
              { t: "note", variant: "trap", html: "Non-deterministic functions such as <code class='tok'>CURRENT_TIMESTAMP()</code> in the SELECT can block incremental refresh or change results from one refresh to the next. Push \"as of now\" logic into the query that reads the dynamic table, or carry event timestamps from the source." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we maintain twenty tasks that only rebuild aggregates\", \"keep this mart within 15 minutes of source\", \"declarative pipeline\", \"bronze/silver/gold\". Reach for dynamic tables with DOWNSTREAM in the middle and an explicit lag at the edge." },
              { t: "note", variant: "key", html: "<strong>Declare the result and the staleness, not the schedule.</strong> Set TARGET_LAG where people read, DOWNSTREAM everywhere else, pin INCREMENTAL for big tables, and treat lag as the cost dial: fresher means more refreshes." }
            ]
          },
          {
            id: "cdc-merge",
            title: "CDC patterns with MERGE",
            summary: "Applying change feeds correctly means handling update pairs, collapsing duplicates per key, ordering by a trustworthy sequence and keeping every step replayable.",
            minutes: 12,
            tags: ["cdc", "merge", "scd2"],
            blocks: [
              { t: "p", html: "Every CDC pipeline is the same three problems: <strong>shape</strong> (streams emit DELETE/INSERT pairs, tools such as Debezium emit an <code class='tok'>op</code> column), <strong>duplicates</strong> (several changes to one key in a batch) and <strong>order</strong> (the last change must win, according to the source, not the load). MERGE is the tool; the work is in the USING clause." },
              { t: "code", lang: "sql", code: L(
                "MERGE INTO curated.orders t",
                "USING (",
                "  SELECT *",
                "  FROM raw.orders_stream",
                "  -- drop the old-image half of update pairs; keep real deletes",
                "  WHERE NOT (METADATA$ACTION = 'DELETE' AND METADATA$ISUPDATE)",
                ") s",
                "ON t.order_id = s.order_id",
                "WHEN MATCHED AND s.METADATA$ACTION = 'DELETE' THEN DELETE",
                "WHEN MATCHED AND s.METADATA$ACTION = 'INSERT' THEN UPDATE SET",
                "  t.status = s.status, t.amount = s.amount, t.updated_at = s.updated_at",
                "WHEN NOT MATCHED AND s.METADATA$ACTION = 'INSERT' THEN INSERT",
                "  (order_id, status, amount, updated_at) VALUES (s.order_id, s.status, s.amount, s.updated_at);") },
              { t: "table", headers: ["Stream rows for a key", "After filtering", "MERGE action"], rows: [
                ["INSERT / FALSE", "INSERT", "Insert (or update if the target already has it)"],
                ["DELETE / TRUE + INSERT / TRUE", "INSERT / TRUE", "Update to the new image"],
                ["DELETE / FALSE", "DELETE / FALSE", "Delete (or soft-delete flag)"],
                ["INSERT then DELETE in one window", "(nothing: the net delta is empty)", "No-op"]
              ] },
              { t: "h", text: "Deduplicate before you merge" },
              { t: "code", lang: "sql", code: L(
                "-- Raw CDC from an external tool: one row per change event, op in ('c','u','d')",
                "MERGE INTO curated.customers t",
                "USING (",
                "  SELECT payload:id::NUMBER AS id, payload:email::STRING AS email,",
                "         payload:op::STRING AS op, payload:source_lsn::NUMBER AS lsn",
                "  FROM raw.customers_cdc_stream",
                "  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY lsn DESC) = 1",
                ") s",
                "ON t.id = s.id",
                "WHEN MATCHED AND s.op = 'd' THEN DELETE",
                "WHEN MATCHED AND s.lsn > t.lsn THEN UPDATE SET t.email = s.email, t.lsn = s.lsn",
                "WHEN NOT MATCHED AND s.op <> 'd' THEN INSERT (id, email, lsn) VALUES (s.id, s.email, s.lsn);") },
              { t: "note", variant: "trap", html: "If two source rows match one target row, MERGE fails with a duplicate-row error, because the result would depend on processing order (controlled by <code class='tok'>ERROR_ON_NONDETERMINISTIC_MERGE</code>, default TRUE). Turning the parameter off does not fix anything; it picks an arbitrary winner. Collapse to one row per key with <code class='tok'>QUALIFY ROW_NUMBER()</code>, ordered by a source sequence (LSN, SCN, version), not by load time." },
              { t: "h", text: "SCD Type 2 in one MERGE" },
              { t: "code", lang: "sql", code: L(
                "MERGE INTO dim.customer d",
                "USING (",
                "  -- every changed key twice: once to close the current row, once (merge_key NULL) to insert the new version",
                "  SELECT c.id AS merge_key, c.* FROM stg.customer_changes c",
                "  UNION ALL",
                "  SELECT NULL AS merge_key, c.* FROM stg.customer_changes c",
                "  JOIN dim.customer d ON d.id = c.id AND d.is_current",
                "  WHERE d.row_hash <> c.row_hash",
                ") s",
                "ON d.id = s.merge_key AND d.is_current",
                "WHEN MATCHED AND d.row_hash <> s.row_hash THEN UPDATE SET",
                "  d.is_current = FALSE, d.valid_to = s.changed_at",
                "WHEN NOT MATCHED THEN INSERT (id, email, tier, row_hash, valid_from, valid_to, is_current)",
                "  VALUES (s.id, s.email, s.tier, s.row_hash, s.changed_at, NULL, TRUE);") },
              { t: "ul", items: [
                "<strong>Idempotent by construction:</strong> a guard such as <code class='tok'>s.lsn &gt; t.lsn</code> or a row-hash comparison makes replaying a batch harmless.",
                "<strong>Soft deletes</strong> (<code class='tok'>is_deleted = TRUE</code>) keep history and make downstream incremental logic easier than hard deletes.",
                "<strong>Keep raw append-only.</strong> The landing table plus its stream is the replay log; curated tables are rebuildable.",
                "<strong>One stream per target.</strong> If two curated tables consume the same raw changes, give each its own stream or consume both in one transaction."
              ] },
              { t: "table", headers: ["Tier", "CDC apply strategy", "Failure mode avoided"], rows: [
                ["Naive", "INSERT every change row into the target", "None: duplicates and stale updates pile up"],
                ["Solid", "MERGE from a stream with update-pair filtering and QUALIFY dedupe", "Nondeterministic merges and double-applied updates"],
                ["Standout", "Solid, plus source-sequence guards, soft deletes, an append-only raw layer and a reconciliation count against the source each run", "Out-of-order replays, silent drift, unrecoverable deletes"]
              ] },
              { t: "stat", items: [
                { v: "2 rows", k: "per UPDATE in a standard stream" },
                { v: "1 row", k: "per key after QUALIFY, the only safe MERGE input" },
                { v: "0", k: "primary keys Snowflake enforces for you" }
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"Debezium\", \"GoldenGate\", \"keep the warehouse in sync with the OLTP database\", \"history of customer changes\", \"MERGE fails with duplicate row\". Talk about filtering update pairs, QUALIFY dedupe, sequence guards and SCD2." },
              { t: "quiz", id: "ingest-transform" },
              { t: "note", variant: "key", html: "<strong>Shape, dedupe, order, then MERGE.</strong> Drop the DELETE half of update pairs, collapse to one row per key by source sequence, guard updates so replays are harmless, and keep the raw layer append-only so you can always rebuild." }
            ]
          }
        ]
      },
      {
        id: "open",
        name: "Open Formats & Semi-structured",
        icon: "globe",
        lessons: [
          {
            id: "semi-structured",
            title: "VARIANT, FLATTEN and semi-structured data",
            summary: "VARIANT stores JSON-like data with columnar optimisations underneath; path access, casting and FLATTEN turn it into rows, and two insert gotchas trip up nearly everyone.",
            minutes: 11,
            tags: ["variant", "json", "flatten"],
            blocks: [
              { t: "p", html: "A <strong>VARIANT</strong> column holds any JSON-like value: object, array, string, number, boolean or JSON null. Under the hood Snowflake does not store one opaque blob per row. When paths recur with consistent types it extracts them into hidden columns (often called subcolumnarization), so <code class='tok'>payload:customer_id</code> can be scanned and pruned almost like a real column." },
              { t: "code", lang: "sql", code: L(
                "CREATE TABLE raw.events (payload VARIANT, _src_file STRING, _loaded_at TIMESTAMP_LTZ);",
                "",
                "COPY INTO raw.events (payload, _src_file, _loaded_at)",
                "FROM (SELECT $1, METADATA$FILENAME, CURRENT_TIMESTAMP() FROM @landing.s3_events)",
                "FILE_FORMAT = (FORMAT_NAME = 'landing.ff_json');",
                "",
                "SELECT payload:event_id::STRING              AS event_id,",
                "       payload:customer.name::STRING         AS customer_name,",
                "       payload:items[0].sku::STRING          AS first_sku,",
                "       payload:\"Order-Total\"::NUMBER(12,2)  AS order_total,   -- quote keys with odd characters",
                "       TRY_TO_TIMESTAMP_NTZ(payload:ts::STRING) AS event_ts",
                "FROM raw.events;") },
              { t: "table", headers: ["Expression", "Returns", "Note"], rows: [
                ["<code class='tok'>payload:customer.name</code>", "VARIANT", "Displays as <code class='tok'>\"Ann\"</code> with quotes"],
                ["<code class='tok'>payload:customer.name::STRING</code>", "VARCHAR", "Plain text, safe to join and compare"],
                ["<code class='tok'>payload:missing_key</code>", "SQL NULL", "Path does not exist"],
                ["<code class='tok'>payload:explicit_null</code>", "VARIANT null", "<code class='tok'>IS NULL</code> is false; use <code class='tok'>IS_NULL_VALUE()</code>"],
                ["<code class='tok'>payload:Customer</code>", "SQL NULL if the key is <code class='tok'>customer</code>", "Key names are case-sensitive"]
              ] },
              { t: "h", text: "FLATTEN: arrays into rows" },
              { t: "code", lang: "sql", code: L(
                "SELECT e.payload:order_id::NUMBER AS order_id,",
                "       i.index                     AS line_no,",
                "       i.value:sku::STRING         AS sku,",
                "       i.value:qty::NUMBER         AS qty",
                "FROM raw.events e,",
                "     LATERAL FLATTEN(INPUT => e.payload:items, OUTER => TRUE) i;  -- OUTER keeps orders with no items") },
              { t: "table", headers: ["FLATTEN column", "Contains"], rows: [
                ["<code class='tok'>SEQ</code>", "A number identifying the input row"],
                ["<code class='tok'>KEY</code>", "The key, when flattening an object"],
                ["<code class='tok'>PATH</code>", "Path to the element inside the input"],
                ["<code class='tok'>INDEX</code>", "Array position, when flattening an array"],
                ["<code class='tok'>VALUE</code>", "The element itself (VARIANT)"],
                ["<code class='tok'>THIS</code>", "The element being flattened (useful with RECURSIVE)"]
              ] },
              { t: "h", text: "Two insert gotchas" },
              { t: "code", lang: "sql", code: L(
                "-- FAILS: VALUES accepts constants only; PARSE_JSON is a function call",
                "INSERT INTO raw.events (payload) VALUES (PARSE_JSON('{\"event_id\":\"e1\"}'));",
                "",
                "-- SUCCEEDS but is wrong: the literal is VARCHAR, so payload becomes a JSON *string*",
                "INSERT INTO raw.events (payload) SELECT '{\"event_id\":\"e1\"}';",
                "SELECT payload:event_id FROM raw.events;   -- NULL: a string has no keys",
                "",
                "-- RIGHT: expressions live in SELECT; UNION ALL for multiple rows",
                "INSERT INTO raw.events (payload)",
                "SELECT PARSE_JSON('{\"event_id\":\"e1\",\"items\":[]}')",
                "UNION ALL",
                "SELECT PARSE_JSON('{\"event_id\":\"e2\",\"items\":[{\"sku\":\"A-1\",\"qty\":2}]}');") },
              { t: "note", variant: "trap", html: "Two separate traps that look like one. <strong>VALUES takes constants only</strong>, so <code class='tok'>PARSE_JSON()</code>, <code class='tok'>OBJECT_CONSTRUCT()</code> or <code class='tok'>ARRAY_CONSTRUCT()</code> inside VALUES is rejected. <strong>A bare string literal is VARCHAR</strong>, and casting it to VARIANT stores a string, not an object. Use <code class='tok'>INSERT ... SELECT PARSE_JSON(...)</code>, joined with UNION ALL for several rows, and <code class='tok'>TRY_PARSE_JSON</code> when the input might be malformed." },
              { t: "h", text: "Performance and modelling" },
              { t: "ul", items: [
                "<strong>Cast at the edge.</strong> Comparing VARIANT to VARCHAR works by accident or not at all; <code class='tok'>::STRING</code>, <code class='tok'>::NUMBER</code> and <code class='tok'>::TIMESTAMP_NTZ</code> make types explicit.",
                "<strong>Promote hot paths to typed columns</strong> (in a view, dynamic table or at COPY time) when they drive filters and joins. Paths with mixed types or very sparse keys may not be extracted for pruning.",
                "<strong><code class='tok'>OBJECT_CONSTRUCT</code> drops keys whose value is SQL NULL</strong>; use <code class='tok'>OBJECT_CONSTRUCT_KEEP_NULL</code> when absence and null must differ.",
                "A single VARIANT value has a size cap (historically 16 MB, raised in newer releases). Huge single-document files need <code class='tok'>STRIP_OUTER_ARRAY</code> or splitting.",
                "<code class='tok'>INFER_SCHEMA</code> with <code class='tok'>CREATE TABLE ... USING TEMPLATE</code> bootstraps typed tables from Parquet, Avro and ORC."
              ] },
              { t: "compare",
                bad: { title: "Everything stays VARIANT forever", items: ["Every query re-casts and re-parses paths", "Type errors appear at query time, per analyst", "Mixed-type paths defeat pruning"] },
                good: { title: "VARIANT landing, typed serving layer", items: ["Raw keeps every field for replay and new needs", "A view or dynamic table casts the hot paths once", "Analysts see real types and get pruning"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"JSON from an API\", \"nested arrays of line items\", \"payload:x returns NULL but the data is there\", \"seed a test row with JSON\", \"values show up with quotes\". Talk about casting, FLATTEN OUTER, PARSE_JSON in SELECT and VARIANT null." },
              { t: "note", variant: "key", html: "<strong>Land as VARIANT, serve typed.</strong> Cast paths explicitly, FLATTEN with OUTER => TRUE when parents must survive, and build JSON rows with <code class='tok'>INSERT ... SELECT PARSE_JSON(...) UNION ALL ...</code>, never with VALUES or bare string literals." }
            ]
          },
          {
            id: "external-iceberg",
            title: "External tables and Iceberg tables",
            summary: "External tables query files in place, read-only; Iceberg tables keep open-format data in your bucket with Snowflake or another catalog in charge of the metadata.",
            minutes: 11,
            tags: ["iceberg", "external-tables", "lakehouse"],
            blocks: [
              { t: "p", html: "Native tables put data in Snowflake-managed storage in Snowflake's own format. Two options keep data <strong>in your bucket</strong>: <strong>external tables</strong> (a read-only SQL view over files, with a file list Snowflake keeps up to date) and <strong>Iceberg tables</strong> (Parquet data plus Apache Iceberg metadata, with full table semantics). The real question is who owns the catalog and who is allowed to write." },
              { t: "table", headers: ["", "Native", "External table", "Iceberg, Snowflake catalog", "Iceberg, external catalog"], rows: [
                ["Data lives in", "Snowflake storage", "Your bucket (any format)", "Your bucket (Parquet)", "Your bucket (Parquet)"],
                ["Snowflake writes", "Yes", "No", "Yes, full DML", "Limited; typically read-only from Snowflake"],
                ["Other engines", "Via sharing or export", "Read the raw files", "Read through an Iceberg catalog", "Write and read through their catalog"],
                ["Performance", "Best", "Slowest; pruning only on partition columns", "Close to native", "Close to native after metadata refresh"],
                ["Storage billed by", "Snowflake", "Your cloud provider", "Your cloud provider", "Your cloud provider"]
              ] },
              { t: "code", lang: "sql", code: L(
                "CREATE EXTERNAL TABLE lake.clicks_ext (",
                "  event_date DATE   AS TO_DATE(SPLIT_PART(SPLIT_PART(METADATA$FILENAME, 'dt=', 2), '/', 1)),",
                "  user_id    STRING AS (VALUE:user_id::STRING),",
                "  url_path   STRING AS (VALUE:path::STRING)",
                ")",
                "PARTITION BY (event_date)",
                "LOCATION = @landing.s3_clicks",
                "FILE_FORMAT = (FORMAT_NAME = 'landing.ff_parquet')",
                "AUTO_REFRESH = TRUE;      -- wire bucket notifications like a pipe",
                "",
                "SELECT COUNT(*) FROM lake.clicks_ext WHERE event_date = '2026-10-27';  -- prunes by path") },
              { t: "note", variant: "warn", html: "External tables prune <strong>only</strong> on declared partition columns derived from the file path; every other filter scans file contents. They are good for occasional queries over a lake, and poor as a serving layer. If people query them daily, put a materialized view on top or move to Iceberg." },
              { t: "h", text: "Iceberg tables" },
              { t: "code", lang: "sql", code: L(
                "-- Admin, once: where Iceberg data and metadata files may be written",
                "CREATE EXTERNAL VOLUME lake_vol",
                "  STORAGE_LOCATIONS = ((",
                "    NAME = 'lake-us-east-1'",
                "    STORAGE_PROVIDER = 'S3'",
                "    STORAGE_BASE_URL = 's3://acme-lake/iceberg/'",
                "    STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<aws_account_id>:role/<snowflake_iceberg_role>'",
                "  ));",
                "",
                "-- Snowflake is the catalog: full DML, clustering, Time Travel via snapshots",
                "CREATE ICEBERG TABLE lake.orders_ice (",
                "  order_id NUMBER(38,0), customer_id NUMBER(38,0), amount NUMBER(12,2), ordered_at TIMESTAMP_NTZ(6))",
                "  CATALOG = 'SNOWFLAKE'",
                "  EXTERNAL_VOLUME = 'lake_vol'",
                "  BASE_LOCATION = 'orders/';",
                "",
                "INSERT INTO lake.orders_ice SELECT order_id, customer_id, amount, ordered_at FROM curated.orders;") },
              { t: "code", lang: "sql", code: L(
                "-- Another system (for example AWS Glue) is the catalog; Snowflake reads its tables",
                "CREATE CATALOG INTEGRATION glue_cat",
                "  CATALOG_SOURCE = GLUE",
                "  CATALOG_NAMESPACE = 'lake'",
                "  TABLE_FORMAT = ICEBERG",
                "  GLUE_AWS_ROLE_ARN = 'arn:aws:iam::<aws_account_id>:role/<snowflake_glue_role>'",
                "  GLUE_CATALOG_ID = '<aws_account_id>'",
                "  ENABLED = TRUE;",
                "",
                "CREATE ICEBERG TABLE lake.sessions_ice",
                "  EXTERNAL_VOLUME = 'lake_vol'",
                "  CATALOG = 'glue_cat'",
                "  CATALOG_TABLE_NAME = 'sessions';",
                "",
                "ALTER ICEBERG TABLE lake.sessions_ice REFRESH;   -- pick up snapshots committed by Spark") },
              { t: "ul", items: [
                "<strong>Snowflake-managed</strong> Iceberg tables behave almost like native tables, but the files are open Parquet in your bucket, readable by Spark, Trino and others through an Iceberg catalog.",
                "<strong>Externally managed</strong> tables follow the other engine's commits. Snowflake sees new data after a metadata refresh, automatic or manual, and write support from Snowflake depends on the catalog type and feature level.",
                "Storage is billed by your cloud provider, and <strong>protection is yours too</strong>: bucket versioning, lifecycle rules and IAM matter, because Snowflake's Fail-safe does not cover files it does not own.",
                "Keep account ids, role ARNs and bucket names in per-environment variables or Terraform, not baked into shared scripts."
              ] },
              { t: "table", headers: ["Tier", "Sharing a lake with Spark", "Why"], rows: [
                ["Naive", "Export CSVs from Snowflake nightly for Spark", "Copies drift, double storage, a day of lag"],
                ["Solid", "External tables over Spark's Parquet output, partitioned by path", "No copies, but slow and read-only"],
                ["Standout", "Iceberg tables with one agreed catalog owner per table (Snowflake-managed for tables Snowflake writes, external catalog for tables Spark writes)", "One copy of the data, open format, clear write ownership, near-native performance"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the data must stay in our bucket\", \"Spark and Snowflake on the same tables\", \"avoid vendor lock-in\", \"query the lake without loading\", \"Glue catalog\". Ask who writes each table, then choose external table, Snowflake-managed Iceberg or externally managed Iceberg." },
              { t: "quiz", id: "ingest-open" },
              { t: "note", variant: "key", html: "<strong>Decide by catalog and writer.</strong> External tables are read-only and prune only on path partitions. Snowflake-managed Iceberg gives full DML on open files in your bucket. Externally managed Iceberg follows another engine's commits. Give each table exactly one writer." }
            ]
          }
        ]
      }
    ]
  };
})();
