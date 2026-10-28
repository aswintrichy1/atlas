/* =====================================================================
   GLACIER · Architecture & Storage
   window.TRACKS.arch — modules: layers / storage / protect

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data.
   ===================================================================== */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";

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
  function svgEl(tag, attrs, text) {
    var el = document.createElementNS(SVG_NS, tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, String(attrs[k]));
    }
    if (text != null) el.textContent = String(text);
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
  function slider(label, min, max, value, onChange) {
    var out = h("b", {}, String(value));
    var input = h("input", { type: "range", min: String(min), max: String(max), step: "1", value: String(value) });
    input.value = String(value);
    input.addEventListener("input", function () {
      var v = parseInt(input.value, 10);
      if (isNaN(v)) v = min;
      out.textContent = String(v);
      onChange(v);
    });
    return h("label", { class: "w-field" }, label + " ", out, input);
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function pct(n) { return (Math.round(n * 10) / 10) + "%"; }

  var Widgets = {};

  /* pruningLab — 16 micro-partitions with min/max of order_day; a WHERE range prunes them */
  Widgets.pruningLab = function (mount) {
    shell(mount, "simulator", "Micro-partition pruning lab",
      "Sixteen micro-partitions each carry min/max metadata for order_day (day 1 to 64). Move the WHERE range and switch the physical layout. Partitions whose [min, max] cannot overlap the predicate are pruned before any bytes are read.");
    var layout = "clustered", lo = 20, hi = 27;
    var N = 16, DAYS = 64;
    function parts() {
      var out = [];
      for (var i = 0; i < N; i++) {
        var mn, mx, rows;
        if (layout === "clustered") {
          mn = i * 4 + 1; mx = i * 4 + 4;
        } else {
          var centre = ((i * 37 + 11) % 60) + 3;
          var span = 18 + ((i * 23) % 40);
          mn = Math.max(1, centre - Math.floor(span / 2));
          mx = Math.min(DAYS, mn + span);
        }
        rows = 90 + ((i * 53) % 40);
        out.push({ id: i + 1, min: mn, max: mx, mb: rows });
      }
      return out;
    }
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var a = Math.min(lo, hi), b = Math.max(lo, hi);
      var ps = parts();
      var W = 640, rowH = 15, top = 22, left = 44, plotW = W - left - 12;
      var Hh = top + N * rowH + 10;
      function x(d) { return left + ((d - 1) / (DAYS - 1)) * plotW; }
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + Hh, width: "100%", role: "img", "aria-label": "Micro-partition min/max ranges against the predicate" });
      svg.appendChild(svgEl("rect", { x: x(a), y: top - 6, width: Math.max(2, x(b) - x(a)), height: N * rowH + 6,
        style: "fill:color-mix(in srgb, #67e8f9 18%, transparent);stroke:var(--accent-ink);stroke-dasharray:4 3" }));
      svg.appendChild(svgEl("text", { x: x(a), y: 12, style: "fill:var(--text);font-size:11px" }, "WHERE order_day BETWEEN " + a + " AND " + b));
      var scanned = 0, scannedMb = 0, totalMb = 0;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        var hit = p.max >= a && p.min <= b;
        totalMb += p.mb;
        if (hit) { scanned++; scannedMb += p.mb; }
        var y = top + i * rowH;
        svg.appendChild(svgEl("text", { x: 4, y: y + 10, style: "fill:var(--text-dim);font-size:10px" }, "MP" + p.id));
        svg.appendChild(svgEl("line", { x1: left, x2: left + plotW, y1: y + 6, y2: y + 6, style: "stroke:var(--line)" }));
        svg.appendChild(svgEl("rect", { x: x(p.min), y: y + 1, width: Math.max(3, x(p.max) - x(p.min)), height: 10, rx: 2,
          style: hit ? "fill:color-mix(in srgb, #67e8f9 55%, transparent);stroke:var(--accent-ink)" : "fill:var(--surface-2);stroke:var(--line)" }));
      }
      clear(stage);
      stage.appendChild(svg);
      stage.appendChild(h("p", { style: "font-size:0.85rem;margin:0.4rem 0 0;color:var(--text-dim)" },
        layout === "clustered"
          ? "Loaded in date order: each partition covers a narrow, non-overlapping slice, so a range touches only the slices it needs."
          : "Loaded from many interleaved sources: every partition spans a wide range of days, so most of them might contain a match and must be read."));
      clear(readout);
      readout.appendChild(ro("partitions scanned", scanned + " / " + N));
      readout.appendChild(ro("pruned", (N - scanned)));
      readout.appendChild(ro("bytes scanned", pct(totalMb ? (scannedMb / totalMb) * 100 : 0)));
      readout.appendChild(ro("layout", layout));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["clustered", "Clustered by order_day"], ["unclustered", "Unclustered (interleaved loads)"]], 0, function (v) { layout = v; paint(); }),
      slider("range start", 1, 64, lo, function (v) { lo = v; paint(); }),
      slider("range end", 1, 64, hi, function (v) { hi = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* clusterDepthLab — ingestion order + reclustering → overlaps and depth */
  Widgets.clusterDepthLab = function (mount) {
    shell(mount, "simulator", "Clustering depth lab",
      "Eight micro-partitions hold values of a clustering key from 0 to 100. Pick how data arrived and how far reclustering has progressed, then read the same two numbers SYSTEM$CLUSTERING_INFORMATION reports.");
    var order = "random", recluster = "none", probe = 50;
    var N = 8;
    function messy(i) {
      if (order === "ordered") return [i * 12.5 - 3, i * 12.5 + 15.5];
      if (order === "interleaved") {
        var c = ((i * 29 + 7) % 8) * 12.5 + 6;
        return [c - 22, c + 22];
      }
      var s = (i * 41 + 3) % 30;
      var e = 60 + ((i * 17) % 40);
      return [s, e];
    }
    function ranges() {
      var f = recluster === "none" ? 0 : recluster === "partial" ? 0.6 : 1;
      var out = [];
      for (var i = 0; i < N; i++) {
        var m = messy(i), t = [i * 12.5, i * 12.5 + 12];
        var lo = m[0] + (t[0] - m[0]) * f, hi = m[1] + (t[1] - m[1]) * f;
        out.push([Math.max(0, Math.round(lo)), Math.min(100, Math.round(hi))]);
      }
      return out;
    }
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var rs = ranges();
      var overlaps = 0;
      for (var i = 0; i < N; i++) {
        for (var j = 0; j < N; j++) {
          if (i !== j && rs[i][1] >= rs[j][0] && rs[i][0] <= rs[j][1]) overlaps++;
        }
      }
      var avgOverlaps = overlaps / N;
      var depthSum = 0, covered = 0, maxDepth = 0;
      for (var v = 0; v <= 100; v++) {
        var d = 0;
        for (var k = 0; k < N; k++) if (rs[k][0] <= v && rs[k][1] >= v) d++;
        if (d > 0) { depthSum += d; covered++; if (d > maxDepth) maxDepth = d; }
      }
      var avgDepth = covered ? depthSum / covered : 0;
      var probeHits = 0;
      for (var q = 0; q < N; q++) if (rs[q][0] <= probe && rs[q][1] >= probe) probeHits++;

      var W = 620, top = 16, rowH = 20, left = 40, plotW = W - left - 12;
      var Hh = top + N * rowH + 22;
      function x(val) { return left + (val / 100) * plotW; }
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + Hh, width: "100%", role: "img", "aria-label": "Clustering key ranges per micro-partition" });
      for (var r = 0; r < N; r++) {
        var y = top + r * rowH;
        var hit = rs[r][0] <= probe && rs[r][1] >= probe;
        svg.appendChild(svgEl("text", { x: 4, y: y + 12, style: "fill:var(--text-dim);font-size:10px" }, "MP" + (r + 1)));
        svg.appendChild(svgEl("rect", { x: x(rs[r][0]), y: y + 2, width: Math.max(3, x(rs[r][1]) - x(rs[r][0])), height: 12, rx: 2,
          style: hit ? "fill:color-mix(in srgb, #67e8f9 55%, transparent);stroke:var(--accent-ink)" : "fill:var(--surface-2);stroke:var(--line)" }));
      }
      svg.appendChild(svgEl("line", { x1: x(probe), x2: x(probe), y1: top - 4, y2: top + N * rowH, style: "stroke:var(--accent-ink);stroke-width:2" }));
      svg.appendChild(svgEl("text", { x: Math.min(W - 120, x(probe) + 4), y: Hh - 4, style: "fill:var(--text);font-size:11px" }, "WHERE key = " + probe));
      clear(stage);
      stage.appendChild(svg);
      clear(readout);
      readout.appendChild(ro("average_overlaps", avgOverlaps.toFixed(2)));
      readout.appendChild(ro("average_depth", avgDepth.toFixed(2)));
      readout.appendChild(ro("max depth", maxDepth));
      readout.appendChild(ro("partitions read for key = " + probe, probeHits + " / " + N));
      readout.appendChild(ro("verdict", avgDepth <= 1.5 ? "well clustered" : avgDepth <= 3 ? "drifting — watch it" : "poorly clustered for this key"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["ordered", "Arrives in key order"], ["interleaved", "Interleaved sources"], ["random", "Random / backfills"]], 2, function (v) { order = v; paint(); }),
      segment([["none", "No reclustering"], ["partial", "Partially reclustered"], ["full", "Fully reclustered"]], 0, function (v) { recluster = v; paint(); }),
      slider("point lookup key", 0, 100, probe, function (v) { probe = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* retentionLab — table type + edition + retention → Time Travel, Fail-safe, UNDROP */
  Widgets.retentionLab = function (mount) {
    shell(mount, "timeline", "Retention timeline lab",
      "Choose a table type, edition and DATA_RETENTION_TIME_IN_DAYS, then slide how many days ago the table was dropped. The timeline shows which recovery path still exists and how long changed data keeps costing storage.");
    var type = "permanent", edition = "enterprise", retention = 1, since = 3;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var cap = (type === "permanent" && edition !== "standard") ? 90 : 1;
      var tt = Math.min(retention, cap);
      var fs = type === "permanent" ? 7 : 0;
      var undrop, path;
      if (type === "temporary") {
        undrop = since <= tt && tt > 0 ? "yes, within the same session only" : "no";
        path = "Temporary tables vanish when the session ends; there is never Fail-safe.";
      } else if (tt > 0 && since <= tt) {
        undrop = "yes — UNDROP TABLE";
        path = "Inside Time Travel: UNDROP, AT/BEFORE queries and point-in-time clones all work.";
      } else if (since <= tt + fs && fs > 0) {
        undrop = "no — Fail-safe only";
        path = "Past Time Travel but inside Fail-safe: only Snowflake support can attempt recovery, best effort.";
      } else {
        undrop = "no";
        path = "Past every retention window: the data is gone.";
      }
      var SPAN = 100, W = 620, left = 10, plotW = W - 20;
      function x(d) { return left + (Math.min(d, SPAN) / SPAN) * plotW; }
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " 92", width: "100%", role: "img", "aria-label": "Retention timeline after drop" });
      svg.appendChild(svgEl("line", { x1: left, x2: left + plotW, y1: 40, y2: 40, style: "stroke:var(--line);stroke-width:2" }));
      if (tt > 0) svg.appendChild(svgEl("rect", { x: x(0), y: 28, width: Math.max(3, x(tt) - x(0)), height: 24, rx: 3,
        style: "fill:color-mix(in srgb, #67e8f9 45%, transparent);stroke:var(--accent-ink)" }));
      if (fs > 0) svg.appendChild(svgEl("rect", { x: x(tt), y: 28, width: Math.max(3, x(tt + fs) - x(tt)), height: 24, rx: 3,
        style: "fill:color-mix(in srgb, #fbbf24 35%, transparent);stroke:var(--line)" }));
      svg.appendChild(svgEl("text", { x: left, y: 18, style: "fill:var(--text);font-size:11px" }, "drop (day 0)"));
      svg.appendChild(svgEl("text", { x: left, y: 72, style: "fill:var(--text-dim);font-size:10px" },
        "Time Travel " + tt + "d" + (fs ? "  ·  Fail-safe " + fs + "d" : "  ·  no Fail-safe")));
      svg.appendChild(svgEl("line", { x1: x(since), x2: x(since), y1: 22, y2: 58, style: "stroke:var(--text);stroke-width:2" }));
      svg.appendChild(svgEl("text", { x: Math.min(W - 90, x(since) + 4), y: 86, style: "fill:var(--text);font-size:11px" }, "now: day " + since));
      clear(stage);
      stage.appendChild(svg);
      stage.appendChild(h("p", { style: "font-size:0.85rem;margin:0.3rem 0 0;color:var(--text-dim)" },
        (retention > cap ? "Requested " + retention + " days, but this table type/edition caps Time Travel at " + cap + ". " : "") + path));
      clear(readout);
      readout.appendChild(ro("Time Travel window", tt + " day(s)"));
      readout.appendChild(ro("Fail-safe window", fs + " day(s)"));
      readout.appendChild(ro("days changed data stays billed", (tt + fs)));
      readout.appendChild(ro("UNDROP works", undrop));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["permanent", "Permanent"], ["transient", "Transient"], ["temporary", "Temporary"]], 0, function (v) { type = v; paint(); }),
      segment([["standard", "Standard edition"], ["enterprise", "Enterprise or higher"]], 1, function (v) { edition = v; paint(); }),
      slider("DATA_RETENTION_TIME_IN_DAYS", 0, 90, retention, function (v) { retention = v; paint(); }),
      slider("days since DROP", 0, 100, since, function (v) { since = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- quizzes ---------- */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "arch-layers": {
      title: "Three-layer architecture checkpoint",
      sub: "Storage, compute, cloud services, accounts and editions.",
      questions: [
        { q: "Where does the 24-hour query result cache live?", options: ["On the local SSD of the warehouse that ran the query", "In the cloud services layer", "Inside the micro-partitions of the queried table", "In the client driver's memory"], answer: 1,
          explain: "Result reuse is a cloud services feature: it is keyed on the query text and the state of the underlying data, and it can answer a repeated query without any warehouse running. The local disk cache on a warehouse is a different layer that holds raw micro-partition data and is lost on suspend." },
        { q: "A loading warehouse writes into a table while two other warehouses run reports on it. Why don't the readers fight the loader for storage?", options: ["Storage is shared object storage and micro-partitions are immutable, so readers see a committed snapshot while each warehouse uses its own compute", "Each warehouse receives a private physical copy of the table", "Snowflake queues every query against a table onto a single cluster", "Reports automatically read from a replica in another region"], answer: 0,
          explain: "Compute is separated from storage: every warehouse reads the same micro-partitions from shared storage. New writes create new micro-partitions and only become visible on commit, so readers keep a consistent view without contending for CPU or memory with the loader." },
        { q: "Which account identifier format is the preferred, region-independent form?", options: ["The account locator alone, for example xy12345", "The warehouse name plus region", "orgname-accountname", "The user's email address"], answer: 2,
          explain: "The organization-name / account-name form is stable even if the account is moved and does not require you to know the cloud region. Locator-style identifiers such as xy12345.us-east-1 still work but are tied to a region and are harder to read." },
        { q: "Which feature requires Enterprise edition or higher?", options: ["Per-second warehouse billing", "Zero-copy cloning", "Automatic result caching", "Multi-cluster warehouses"], answer: 3,
          explain: "Multi-cluster warehouses, along with extended Time Travel, masking and row access policies, search optimization and materialized views, are Enterprise-and-above features. Cloning, result caching and per-second billing are available in every edition." },
        { q: "SELECT COUNT(*) FROM events with no WHERE clause returns instantly even though the warehouse is suspended. What answered it?", options: ["The warehouse's local disk cache", "The search optimization service", "Micro-partition metadata kept by the cloud services layer", "A background materialized view"], answer: 2,
          explain: "Cloud services stores row counts and per-column min/max per micro-partition, so exact COUNT(*), MIN and MAX on whole tables can be answered from metadata alone. No partition data needs to be scanned, so the warehouse does not have to resume." },
        { q: "On a day your warehouses burn 100 credits and cloud services use 14 credits, how many cloud services credits are billed?", options: ["14", "0", "10", "4"], answer: 3,
          explain: "Cloud services usage is free up to 10% of that day's warehouse compute. Here the allowance is 10 credits, so only the 4 credits above it are billed. Workloads with many tiny metadata-heavy queries are the usual way teams exceed the allowance." }
      ]
    },
    "arch-storage": {
      title: "Micro-partitions & pruning checkpoint",
      sub: "Columnar storage, pruning predicates, clustering keys and depth.",
      questions: [
        { q: "Roughly how much uncompressed data does a single micro-partition hold?", options: ["About 50–500 MB", "About 1–4 MB", "About 16 GB", "Exactly 128 MB compressed, always"], answer: 0,
          explain: "Micro-partitions are contiguous units of roughly 50 to 500 MB before compression, stored compressed and columnar. Snowflake sizes them automatically; you never declare partitions the way you would in a Hive-style layout." },
        { q: "You UPDATE a single row in a large table. What happens physically?", options: ["The row is modified in place on disk", "The micro-partition containing that row is rewritten as a new micro-partition; the old one is retained for Time Travel", "The change is appended to a delta log that is merged nightly", "The whole table is rewritten under an exclusive lock"], answer: 1,
          explain: "Micro-partitions are immutable, so DML is copy-on-write at partition granularity. The new partition replaces the old one in the table's metadata, and the old one stays around as Time Travel (and later Fail-safe) storage, which is why high-churn tables accumulate retained bytes." },
        { q: "The table is well clustered on order_date. Which predicate is most likely to defeat pruning?", options: ["WHERE order_date >= '2026-01-01'", "WHERE order_date BETWEEN '2026-01-01' AND '2026-01-31'", "WHERE TO_CHAR(order_date, 'YYYYMM') = '202601'", "WHERE order_date = '2026-01-15'"], answer: 2,
          explain: "Pruning compares the predicate against per-partition min/max of the raw column. Wrapping the column in a formatting function produces a value the optimizer often cannot map back onto those ranges, so it may have to scan everything. Rewrite as a range on the bare column." },
        { q: "SYSTEM$CLUSTERING_INFORMATION reports a high average_depth for your key. What does that tell you?", options: ["The table has too few rows to cluster", "Automatic Clustering is suspended", "The clustering key has too few distinct values", "Many micro-partitions overlap for the same key values, so filters on that key prune poorly"], answer: 3,
          explain: "Depth is how many partitions overlap at a given value; a perfectly clustered table has depth close to 1. High depth means a filter on that key must read many partitions that each might contain the value, which is exactly what pruning is supposed to avoid." },
        { q: "Your events table is filtered by day but event_ts has microsecond precision. Which clustering key is the better choice?", options: ["CLUSTER BY (event_ts)", "CLUSTER BY (TO_DATE(event_ts))", "CLUSTER BY (event_id)", "CLUSTER BY (HASH(event_ts))"], answer: 1,
          explain: "A raw high-cardinality timestamp makes reclustering expensive because nearly every value is distinct. Truncating to the grain you filter on keeps cardinality moderate, still lines up with day-range predicates, and costs far less to maintain." },
        { q: "How is Automatic Clustering billed?", options: ["It is free on every edition", "To whichever warehouse ran the last DML", "Only when you call SYSTEM$CLUSTERING_DEPTH", "As serverless credits, visible in AUTOMATIC_CLUSTERING_HISTORY and not governed by resource monitors"], answer: 3,
          explain: "Reclustering runs on Snowflake-managed compute and is billed as serverless credits. Resource monitors only govern warehouses, so you watch this cost through AUTOMATIC_CLUSTERING_HISTORY and suspend reclustering on tables where it is not paying for itself." }
      ]
    },
    "arch-protect": {
      title: "Time Travel, Fail-safe & cloning checkpoint",
      sub: "Retention windows, table types, UNDROP and zero-copy clones.",
      questions: [
        { q: "What is the maximum Time Travel retention for a permanent table on Enterprise edition?", options: ["1 day", "7 days", "90 days", "365 days"], answer: 2,
          explain: "Enterprise and higher allow DATA_RETENTION_TIME_IN_DAYS up to 90 for permanent objects. Standard edition caps at 1 day, and transient or temporary objects cap at 1 day on every edition." },
        { q: "How much Fail-safe does a transient table get?", options: ["7 days", "None", "1 day", "The same as its Time Travel retention"], answer: 1,
          explain: "Fail-safe applies only to permanent objects. Transient and temporary tables skip it entirely, which is why they are the right choice for reproducible staging data whose churn would otherwise be billed for an extra seven days." },
        { q: "A permanent table with 1-day retention was dropped three days ago. What recovery path remains?", options: ["UNDROP TABLE", "SELECT ... AT(OFFSET => -259200)", "Ask Snowflake support to attempt recovery from Fail-safe", "None, the data is already purged"], answer: 2,
          explain: "Time Travel ended after one day, so UNDROP and AT/BEFORE no longer work. The table is now in its seven-day Fail-safe period, which only Snowflake support can access, on a best-effort basis and not as a self-service restore." },
        { q: "UNDROP TABLE orders fails because a new table named orders already exists. What do you do?", options: ["Rename the current orders table, then run UNDROP TABLE orders", "Run UNDROP TABLE orders REPLACE", "Drop the database and undrop it", "Increase DATA_RETENTION_TIME_IN_DAYS first"], answer: 0,
          explain: "UNDROP restores an object under its original name and refuses if that name is taken. Renaming the current object frees the name; afterwards you can compare both versions and keep whichever is right." },
        { q: "You clone a 5 TB table. What happens to storage?", options: ["Storage doubles immediately", "The clone is billed as a full copy after 24 hours", "Clones are free forever regardless of changes", "No new storage at first; only micro-partitions that either side later changes become new billed storage"], answer: 3,
          explain: "A clone is a metadata operation that points at the same immutable micro-partitions as its source. Storage grows only as either object modifies data and writes new partitions; shared partitions the source drops can remain billed as retained-for-clone bytes." },
        { q: "Someone ran a DELETE without a WHERE clause. You have its query id. What is the most precise way to see the data as it was just before that statement?", options: ["AT(TIMESTAMP => CURRENT_TIMESTAMP())", "BEFORE(STATEMENT => '<query_id>')", "AT(OFFSET => 0)", "UNDROP TABLE"], answer: 1,
          explain: "BEFORE(STATEMENT => ...) resolves to the table state immediately before the given statement committed, with no guessing about timestamps. You can SELECT from it, or clone it into a recovery table and swap or re-insert the missing rows." }
      ]
    }
  });

  /* ---------- track ---------- */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.arch = {
    id: "arch",
    name: "Architecture & Storage",
    short: "ARCH",
    tagline: "How Snowflake actually stores and serves your data",
    color: "#67e8f9",
    blurb: "Every performance, cost and recovery decision traces back to how the platform is built. Learn the three layers and what each one owns, the account and object hierarchy, the metadata engine in cloud services, immutable micro-partitions and pruning, clustering keys and depth, and the retention machinery behind Time Travel, Fail-safe and zero-copy cloning.",
    modules: [
      {
        id: "layers",
        name: "Three-Layer Architecture",
        icon: "blocks",
        lessons: [
          {
            id: "three-layers",
            title: "The three layers: storage, compute, cloud services",
            summary: "Shared storage, independent compute and a central brain — and why that split explains most Snowflake behaviour.",
            minutes: 10,
            tags: ["architecture", "warehouses", "cloud-services"],
            blocks: [
              { t: "p", html: "Hold this picture: <strong>one copy of the data, many independent engines reading it, and a coordinator that knows where everything is.</strong> Snowflake splits the classic database into three layers that scale and bill separately, and almost every question about speed, cost or concurrency is really a question about which layer is doing the work." },
              { t: "diagram", id: "sf-three-layers", caption: "Database storage, virtual warehouses and cloud services scale independently; only the middle layer is sized by you." },
              { t: "table", headers: ["Layer", "What it owns", "How you pay", "What you control"], rows: [
                ["Database storage", "Compressed, columnar micro-partitions in cloud object storage; Time Travel and Fail-safe versions", "Per TB per month (average compressed bytes)", "Table type, retention, what you keep"],
                ["Compute (virtual warehouses)", "MPP clusters that scan, join and aggregate; local SSD cache of recently read partitions", "Credits per second while running, 60 s minimum per resume", "Size, cluster count, auto-suspend, which workload uses which warehouse"],
                ["Cloud services", "Authentication, access control, metadata, optimizer, transactions, result cache", "Free up to 10% of daily warehouse credits, billed above", "Indirectly: query patterns that hammer metadata"]
              ] },
              { t: "h", text: "Why the split matters" },
              { t: "ul", items: [
                "<strong>Concurrency without contention.</strong> A loading warehouse and a BI warehouse read the same tables but never share CPU or memory.",
                "<strong>Elastic compute.</strong> Resizing or adding clusters changes nothing about the data; a new warehouse sees every table immediately.",
                "<strong>Storage is cheap and passive.</strong> Data at rest costs storage only; there is no idle server holding it hostage.",
                "<strong>No customer-visible files.</strong> You cannot reach the underlying objects directly; everything goes through SQL and the metadata layer."
              ] },
              { t: "code", lang: "sql", code:
                "-- One dataset, two isolated engines: sizing one never slows the other\n" +
                "CREATE WAREHOUSE IF NOT EXISTS load_wh  WAREHOUSE_SIZE = 'MEDIUM' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;\n" +
                "CREATE WAREHOUSE IF NOT EXISTS bi_wh    WAREHOUSE_SIZE = 'SMALL'  AUTO_SUSPEND = 300 AUTO_RESUME = TRUE;\n\n" +
                "USE WAREHOUSE load_wh;\n" +
                "COPY INTO sales.raw.orders FROM @sales.raw.orders_stage FILE_FORMAT = (FORMAT_NAME = 'sales.raw.csv_fmt');\n\n" +
                "USE WAREHOUSE bi_wh;\n" +
                "SELECT order_date, SUM(amount) FROM sales.raw.orders GROUP BY 1;   -- sees committed loads, no lock wait"
              },
              { t: "stat", items: [
                { v: "1 → 512", k: "credits/hour, XS → 6XL" },
                { v: "60 s", k: "minimum billed per resume" },
                { v: "10%", k: "free cloud-services allowance" },
                { v: "24 h", k: "result cache validity (renewed on reuse)" }
              ] },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Separation is not free. Every query that misses the warehouse's local cache reads from remote object storage, which is slower than local disk. A freshly resumed warehouse starts cold. Splitting workloads across many warehouses buys isolation but multiplies the 60-second minimums and idle tails you pay for." },
              { t: "compare",
                bad: { title: "One giant shared warehouse", items: ["ETL spikes starve dashboards", "Hard to attribute cost", "Sized for the worst job all day"] },
                good: { title: "Warehouse per workload", items: ["Isolated performance and cost lines", "Each sized and suspended for its pattern", "More warehouses to govern and monitor"] } },
              { t: "note", variant: "tip", html: "When someone says \"Snowflake is slow\", ask which layer first: compilation time is cloud services, queued time is warehouse capacity, and scan time is storage and pruning. The Query Profile separates all three." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"ETL is slowing down our dashboards\", \"can two teams query the same data without stepping on each other\", \"why did a query run with no warehouse\", \"why is the first query after lunch slow\" — all of these are answered by naming the layer involved." },
              { t: "note", variant: "key", html: "<strong>Storage is shared, compute is private, cloud services coordinates.</strong> Isolate workloads with warehouses, fix scans with storage layout, and remember that metadata answers some queries with no compute at all." }
            ]
          },
          {
            id: "object-model",
            title: "Organizations, accounts, editions and the object hierarchy",
            summary: "Where every object lives, which edition unlocks what, and how to address an account correctly.",
            minutes: 9,
            tags: ["accounts", "editions", "object-model"],
            blocks: [
              { t: "p", html: "Think of Snowflake as nested containers: an <strong>organization</strong> owns <strong>accounts</strong>; an account owns account-level objects and <strong>databases</strong>; databases own <strong>schemas</strong>; schemas own the objects you query. Grants, cloning, replication and naming all follow this tree." },
              { t: "code", lang: "text", code:
                "ORGANIZATION  acme\n" +
                "└── ACCOUNT  acme-prod   (edition, region, cloud)\n" +
                "    ├── account-level: USERS, ROLES, WAREHOUSES, RESOURCE MONITORS,\n" +
                "    │                  NETWORK POLICIES, INTEGRATIONS, SHARES\n" +
                "    └── DATABASE  SALES\n" +
                "        └── SCHEMA  SALES.CORE\n" +
                "            ├── TABLES / VIEWS / DYNAMIC TABLES\n" +
                "            ├── STAGES / FILE FORMATS / PIPES\n" +
                "            ├── STREAMS / TASKS\n" +
                "            └── FUNCTIONS / PROCEDURES / POLICIES / TAGS"
              },
              { t: "h", text: "Addressing an account" },
              { t: "table", headers: ["Form", "Example", "Notes"], rows: [
                ["Organization + account name", "<code class='tok'>acme-prod</code>", "Preferred; stable and region-independent"],
                ["Account locator", "<code class='tok'>xy12345.us-east-1</code>", "Legacy style; tied to region and cloud, still common in older configs"],
                ["Connection host", "<code class='tok'>acme-prod.snowflakecomputing.com</code>", "Drivers usually build this from the identifier for you"]
              ] },
              { t: "code", lang: "python", code:
                "import os\n" +
                "import snowflake.connector\n\n" +
                "# Interactive SSO: the user must match the IdP login (often the email form)\n" +
                "conn = snowflake.connector.connect(\n" +
                "    account=os.environ[\"SNOWFLAKE_ACCOUNT\"],      # e.g. acme-prod\n" +
                "    user=os.environ[\"SNOWFLAKE_USER\"],            # e.g. jdoe@acme.example\n" +
                "    authenticator=\"externalbrowser\",\n" +
                "    role=os.environ.get(\"SNOWFLAKE_ROLE\"),\n" +
                "    warehouse=os.environ.get(\"SNOWFLAKE_WAREHOUSE\"),\n" +
                "    database=os.environ.get(\"SNOWFLAKE_DATABASE\"),\n" +
                ")"
              },
              { t: "note", variant: "trap", html: "Two classic connection failures: an account string with the wrong separator or region gives a not-found error, and an SSO login with a short username when the identity provider knows the user by email fails with a user-mismatch error. Keep both values in environment config, never in code." },
              { t: "h", text: "Editions: what you are actually buying" },
              { t: "table", headers: ["Edition", "Adds (highlights)"], rows: [
                ["Standard", "Core platform, 1-day Time Travel, cloning, result cache, Snowpipe, data sharing"],
                ["Enterprise", "Up to 90-day Time Travel, multi-cluster warehouses, masking and row access policies, search optimization, materialized views"],
                ["Business Critical", "Enterprise plus stronger compliance support, customer-managed keys with Tri-Secret Secure, private connectivity, failover/failback"],
                ["Virtual Private Snowflake", "A dedicated, isolated deployment for the most sensitive workloads"]
              ] },
              { t: "h", text: "Databases as environments" },
              { t: "p", html: "Many teams run DEV, test and STG as <em>databases</em> in one non-production account and keep PRD in its own account. That keeps cloning between lower environments instant, while the account boundary protects production. Either way, environment names belong in variables: <code class='tok'>USE DATABASE IDENTIFIER($target_db)</code>, not literals scattered through scripts." },
              { t: "code", lang: "sql", code:
                "SET target_db = 'SALES_STG';                 -- injected by the deploy tool\n" +
                "USE DATABASE IDENTIFIER($target_db);\n" +
                "SELECT CURRENT_ORGANIZATION_NAME(), CURRENT_ACCOUNT_NAME(), CURRENT_REGION(), CURRENT_DATABASE();"
              },
              { t: "table", headers: ["Tier", "Environment layout", "Consequence"], rows: [
                ["Naive", "Everything, including PRD, as databases in one account", "One mis-scoped grant or script reaches production"],
                ["Solid", "PRD in its own account; lower envs as databases in a shared account", "Clean blast radius; clone-based test data in lower envs"],
                ["Standout", "Solid, plus parameterised database names and a read-only analysis role in PRD", "Same scripts run everywhere; production is never written by hand"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"which edition do we need for masking\", \"the connector says account not found\", \"SSO says the user differs from the IdP user\", \"should TEST be a separate account or a database\"." },
              { t: "note", variant: "key", html: "<strong>Organization → account → database → schema → object.</strong> Address accounts as <code class='tok'>orgname-accountname</code>, check the edition before promising a feature, and parameterise every environment name." }
            ]
          },
          {
            id: "services-metadata",
            title: "The cloud services layer: metadata, optimizer, transactions",
            summary: "What the always-on brain does for every query, and when it shows up on your bill.",
            minutes: 10,
            tags: ["metadata", "optimizer", "transactions"],
            blocks: [
              { t: "p", html: "Before a warehouse reads a single byte, cloud services has already authenticated you, checked privileges, parsed and optimized the SQL, decided which micro-partitions can possibly match, and checked whether an identical earlier result can be reused. <strong>The warehouse only executes the plan it is handed.</strong>" },
              { t: "ol", items: [
                "<strong>Authenticate and authorize</strong> the session and role.",
                "<strong>Parse and compile</strong>: resolve names, expand views, apply masking and row access policies.",
                "<strong>Check the result cache</strong>: same text, same role context, unchanged data, no volatile functions.",
                "<strong>Prune</strong> using per-partition metadata, then build the physical plan.",
                "<strong>Dispatch</strong> to the warehouse; commit any writes atomically through the metadata store."
              ] },
              { t: "h", text: "Metadata Snowflake keeps for you" },
              { t: "table", headers: ["Per micro-partition", "Used for"], rows: [
                ["Row count", "Exact COUNT(*) without scanning"],
                ["Min / max per column", "Pruning and metadata-only MIN/MAX"],
                ["Distinct and null counts", "Optimizer estimates and join ordering"],
                ["File location and version", "Snapshot reads, Time Travel and cloning"]
              ] },
              { t: "code", lang: "sql", code:
                "-- These can be answered from metadata without resuming a warehouse\n" +
                "SELECT COUNT(*)        FROM sales.core.orders;\n" +
                "SELECT MIN(order_date) FROM sales.core.orders;\n" +
                "SHOW TABLES IN SCHEMA sales.core;\n\n" +
                "-- This one cannot: it needs to read column data\n" +
                "SELECT COUNT(DISTINCT customer_id) FROM sales.core.orders;"
              },
              { t: "h", text: "Transactions and locking" },
              { t: "ul", items: [
                "Each statement is atomic; explicit <code class='tok'>BEGIN … COMMIT</code> groups DML into one unit.",
                "Tables use <strong>READ COMMITTED</strong> isolation: a statement sees data committed before it started.",
                "<strong>DDL commits implicitly</strong>, so a CREATE inside an open transaction also commits the work before it.",
                "UPDATE, DELETE and MERGE on the same table generally serialize behind a table lock; concurrent INSERTs into a table typically do not block each other.",
                "Waiters give up after <code class='tok'>LOCK_TIMEOUT</code> (default 43,200 seconds); <code class='tok'>SHOW LOCKS</code> and <code class='tok'>SHOW TRANSACTIONS</code> show who is holding what."
              ] },
              { t: "code", lang: "sql", code:
                "ALTER SESSION SET LOCK_TIMEOUT = 600;   -- fail fast instead of waiting 12 hours\n" +
                "BEGIN;\n" +
                "  DELETE FROM sales.core.orders WHERE load_id = 'L-2026-10-28';\n" +
                "  INSERT INTO sales.core.orders SELECT * FROM sales.stage.orders_new;\n" +
                "COMMIT;\n\n" +
                "SHOW TRANSACTIONS;\n" +
                "SHOW LOCKS IN ACCOUNT;"
              },
              { t: "note", variant: "warn", html: "A forgotten open transaction in a worksheet or a crashed client can hold a lock that blocks every MERGE behind it. Short LOCK_TIMEOUT values on pipeline sessions turn silent hangs into visible errors." },
              { t: "h", text: "When cloud services costs real money" },
              { t: "p", html: "Cloud services credits are only billed for the part that exceeds 10% of the day's warehouse credits. You cross that line with patterns that are heavy on compilation and metadata but light on scanning: thousands of tiny single-row INSERTs, very frequent <code class='tok'>SHOW</code> or INFORMATION_SCHEMA polling, enormous generated SQL, or massive numbers of COPY file listings." },
              { t: "code", lang: "sql", code:
                "SELECT usage_date,\n" +
                "       SUM(credits_used_compute)        AS wh_credits,\n" +
                "       SUM(credits_used_cloud_services) AS cs_credits,\n" +
                "       SUM(credits_adjustment_cloud_services) AS cs_adjustment,\n" +
                "       SUM(credits_billed)              AS billed\n" +
                "FROM snowflake.account_usage.metering_daily_history\n" +
                "WHERE usage_date >= DATEADD(day, -30, CURRENT_DATE())\n" +
                "GROUP BY 1 ORDER BY 1;"
              },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"COUNT(*) came back with no warehouse\", \"MERGE is stuck waiting\", \"our cloud services line is above zero\", \"compilation time is longer than execution time\"." },
              { t: "quiz", id: "arch-layers" },
              { t: "note", variant: "key", html: "<strong>Cloud services plans, prunes, caches and commits; warehouses only execute.</strong> Lean on metadata where you can, keep transactions short, and treat chatty metadata-heavy patterns as a cost smell." }
            ]
          }
        ]
      },
      {
        id: "storage",
        name: "Micro-partitions & Pruning",
        icon: "grid",
        lessons: [
          {
            id: "micro-partitions",
            title: "Micro-partitions and columnar storage",
            summary: "Immutable, compressed, columnar chunks with rich metadata — the unit behind pruning, DML cost and Time Travel.",
            minutes: 9,
            tags: ["micro-partitions", "columnar", "storage"],
            blocks: [
              { t: "p", html: "Every table is a set of <strong>micro-partitions</strong>: immutable files of roughly 50–500 MB of uncompressed data, stored column by column and compressed per column. Snowflake creates them automatically in the order rows arrive. You never declare them, but you live with their consequences every day." },
              { t: "diagram", id: "sf-micro-partitions", caption: "Rows are grouped into micro-partitions; within each, values are stored by column with min/max metadata kept separately." },
              { t: "h", text: "Four properties to remember" },
              { t: "table", headers: ["Property", "Consequence"], rows: [
                ["Columnar", "A query reads only the columns it references; SELECT * on a wide table pays for every column"],
                ["Compressed per column", "Low-cardinality and sorted columns compress extremely well; storage is billed on compressed bytes"],
                ["Immutable", "DML rewrites whole partitions (copy-on-write); old versions become Time Travel storage"],
                ["Metadata-rich", "Min/max, counts and nulls per column per partition drive pruning and the optimizer"]
              ] },
              { t: "h", text: "What DML really costs" },
              { t: "p", html: "Updating one row rewrites the partition that holds it. A MERGE that touches a few rows spread across thousands of partitions rewrites thousands of partitions — and your Time Travel bytes grow by the same amount. Batching changes and keeping update targets physically close is how you keep that bounded." },
              { t: "code", lang: "sql", code:
                "-- See how much of a table's footprint is history rather than live data\n" +
                "SELECT table_catalog, table_schema, table_name,\n" +
                "       active_bytes / POWER(1024, 3)            AS active_gb,\n" +
                "       time_travel_bytes / POWER(1024, 3)       AS time_travel_gb,\n" +
                "       failsafe_bytes / POWER(1024, 3)          AS failsafe_gb,\n" +
                "       retained_for_clone_bytes / POWER(1024, 3) AS clone_retained_gb\n" +
                "FROM snowflake.account_usage.table_storage_metrics\n" +
                "WHERE table_catalog = 'SALES' AND deleted = FALSE\n" +
                "ORDER BY time_travel_bytes + failsafe_bytes DESC\n" +
                "LIMIT 20;"
              },
              { t: "note", variant: "tip", html: "A table whose Fail-safe bytes dwarf its active bytes is usually a truncate-and-reload staging table. Making it transient removes the seven-day Fail-safe tail on every reload." },
              { t: "h", text: "Natural clustering" },
              { t: "p", html: "Because partitions are cut in arrival order, a table loaded daily is naturally clustered by load date for free. That locality erodes when loads arrive out of order, when backfills land years of history at once, or when frequent MERGEs scatter rewritten rows." },
              { t: "code", lang: "sql", code:
                "-- Peek at how a column's values are distributed across partitions\n" +
                "SELECT SYSTEM$CLUSTERING_INFORMATION('sales.core.orders', '(order_date)');"
              },
              { t: "compare",
                bad: { title: "Row-at-a-time writes", items: ["Thousands of tiny partitions or constant rewrites", "Cloud services overhead per statement", "Time Travel bytes balloon"] },
                good: { title: "Set-based batch writes", items: ["Fewer, fuller partitions", "One rewrite per touched partition per batch", "Predictable storage growth"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"storage keeps growing but row count is flat\", \"why is SELECT * so expensive\", \"a tiny UPDATE took minutes\", \"how are tables partitioned in Snowflake\"." },
              { t: "note", variant: "key", html: "<strong>Micro-partitions are immutable columnar chunks with metadata.</strong> Read fewer columns, write in batches, and remember every rewrite becomes retained history." }
            ]
          },
          {
            id: "pruning",
            title: "How partition pruning works",
            summary: "Min/max metadata lets Snowflake skip partitions before reading them — if your predicates let it.",
            minutes: 10,
            tags: ["pruning", "query-performance", "metadata"],
            blocks: [
              { t: "p", html: "Pruning is the cheapest optimization in Snowflake: <strong>the fastest byte is the one you never read.</strong> At compile time, cloud services compares each predicate against the min/max of that column in every partition and drops any partition that cannot contain a match." },
              { t: "widget", id: "pruningLab" },
              { t: "h", text: "Static and dynamic pruning" },
              { t: "ul", items: [
                "<strong>Static (compile-time)</strong>: literal filters like <code class='tok'>order_date &gt;= '2026-01-01'</code> are checked against metadata before execution.",
                "<strong>Dynamic (runtime)</strong>: in a join, the values found on the small build side are used to skip partitions of the large probe side as it is scanned.",
                "<strong>Top-K / LIMIT</strong>: ordered limits can stop early once enough candidate partitions are processed."
              ] },
              { t: "code", lang: "sql", code:
                "-- Prunes well: a range on the bare column\n" +
                "SELECT SUM(amount)\n" +
                "FROM sales.core.orders\n" +
                "WHERE order_date >= '2026-01-01' AND order_date < '2026-02-01';\n\n" +
                "-- Often prunes poorly: function wrapped around the column\n" +
                "SELECT SUM(amount)\n" +
                "FROM sales.core.orders\n" +
                "WHERE TO_CHAR(order_date, 'YYYY-MM') = '2026-01';\n\n" +
                "-- Dynamic pruning: small dimension filter drives skipping on the fact table\n" +
                "SELECT f.*\n" +
                "FROM sales.core.orders f\n" +
                "JOIN sales.core.dim_store s ON s.store_id = f.store_id\n" +
                "WHERE s.region = 'EMEA';"
              },
              { t: "h", text: "Predicates that defeat pruning" },
              { t: "table", headers: ["Pattern", "Why it hurts", "Rewrite"], rows: [
                ["<code class='tok'>WHERE UPPER(sku) = 'AB-1'</code>", "Metadata is on raw values, not transformed ones", "Store a normalized column and filter on it"],
                ["<code class='tok'>WHERE id_str = 12345</code>", "Implicit cast on the column side", "Compare like types: <code class='tok'>id_str = '12345'</code>"],
                ["<code class='tok'>WHERE col LIKE '%abc'</code>", "Leading wildcard has no usable range", "Search optimization, or restructure the data"],
                ["Filter only on a column with random layout", "Every partition's min/max spans the whole domain", "Cluster on the filter column or add a better one"]
              ] },
              { t: "h", text: "Measuring it" },
              { t: "code", lang: "sql", code:
                "SELECT query_id, partitions_scanned, partitions_total,\n" +
                "       ROUND(100 * partitions_scanned / NULLIF(partitions_total, 0), 1) AS pct_scanned,\n" +
                "       bytes_scanned / POWER(1024, 3) AS gb_scanned\n" +
                "FROM snowflake.account_usage.query_history\n" +
                "WHERE warehouse_name = 'BI_WH'\n" +
                "  AND start_time >= DATEADD(day, -1, CURRENT_TIMESTAMP())\n" +
                "  AND partitions_total > 1000\n" +
                "ORDER BY pct_scanned DESC\n" +
                "LIMIT 25;"
              },
              { t: "note", variant: "trap", html: "ACCOUNT_USAGE lags by tens of minutes to a few hours. When you are tuning a query right now, read <em>Partitions scanned</em> and <em>Partitions total</em> off its Query Profile instead of waiting for the view." },
              { t: "stat", items: [
                { v: "~1%", k: "scanned on a well-pruned date filter" },
                { v: "100%", k: "scanned when layout is random for that key" },
                { v: "0", k: "warehouse cost of the pruning decision" }
              ] },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Pruning is only as good as the physical layout for <em>the column you filter on</em>. A table can prune perfectly by date and not at all by customer. Improving one access path (clustering, search optimization) costs credits to build and maintain, so pick the filters that dominate your workload." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the query scans the whole table even with a WHERE\", \"partitions scanned equals partitions total\", \"filtering by month is slow but by date is fast\", \"why did casting change performance\"." },
              { t: "note", variant: "key", html: "<strong>Pruning compares bare-column predicates against per-partition min/max.</strong> Keep the column naked in the WHERE, compare matching types, and check partitions scanned versus total." }
            ]
          },
          {
            id: "clustering",
            title: "Clustering keys, depth and automatic clustering",
            summary: "When a clustering key pays for itself, how to choose one, and how to read depth and overlap.",
            minutes: 11,
            tags: ["clustering", "automatic-clustering", "cost"],
            blocks: [
              { t: "p", html: "A <strong>clustering key</strong> tells Snowflake which columns to keep physically co-located. A serverless background service, <strong>Automatic Clustering</strong>, rewrites partitions so that each one covers a narrow range of the key. The goal is not perfect sorting; it is keeping depth low enough that your filters prune." },
              { t: "h", text: "Depth and overlap" },
              { t: "ul", items: [
                "<strong>Overlap</strong>: two partitions overlap when their [min, max] ranges for the key intersect.",
                "<strong>Depth</strong>: at a given value, how many partitions overlap. A perfectly clustered table has depth near 1.",
                "Rising average depth means a filter on that key reads more partitions than it needs to."
              ] },
              { t: "widget", id: "clusterDepthLab" },
              { t: "code", lang: "sql", code:
                "-- Inspect before deciding anything\n" +
                "SELECT SYSTEM$CLUSTERING_INFORMATION('sales.core.events', '(TO_DATE(event_ts), tenant_id)');\n" +
                "SELECT SYSTEM$CLUSTERING_DEPTH('sales.core.events', '(TO_DATE(event_ts))');\n\n" +
                "-- Define the key (low → higher cardinality), let the service maintain it\n" +
                "ALTER TABLE sales.core.events CLUSTER BY (TO_DATE(event_ts), tenant_id);\n\n" +
                "-- Pause or resume maintenance, e.g. during a huge backfill\n" +
                "ALTER TABLE sales.core.events SUSPEND RECLUSTER;\n" +
                "ALTER TABLE sales.core.events RESUME RECLUSTER;"
              },
              { t: "h", text: "Choosing a key" },
              { t: "table", headers: ["Tier", "Key choice", "Outcome"], rows: [
                ["Naive", "<code class='tok'>CLUSTER BY (event_id)</code> or raw microsecond timestamp", "Near-unique values: constant, expensive reclustering for little pruning gain"],
                ["Solid", "<code class='tok'>CLUSTER BY (TO_DATE(event_ts))</code> matching the dominant date filter", "Moderate cardinality, aligns with range predicates, cheap to maintain"],
                ["Standout", "Date plus one selective filter column, validated by query history and a before/after partitions-scanned check", "Pruning proven on the real workload, cost tracked per table"]
              ] },
              { t: "note", variant: "tip", html: "Clustering usually earns its cost on large tables (multi-terabyte, many thousands of partitions) that are queried far more often than they change. Small tables already prune or scan cheaply, and heavily updated tables can be reclustered almost continuously." },
              { t: "h", text: "What it costs" },
              { t: "p", html: "Reclustering consumes <strong>serverless credits</strong> and creates new partitions, which also grows Time Travel and Fail-safe storage for a while. Resource monitors do not govern it, so watch it directly." },
              { t: "code", lang: "sql", code:
                "SELECT table_name,\n" +
                "       SUM(credits_used)             AS recluster_credits,\n" +
                "       SUM(num_bytes_reclustered) / POWER(1024, 4) AS tb_rewritten\n" +
                "FROM snowflake.account_usage.automatic_clustering_history\n" +
                "WHERE start_time >= DATEADD(day, -30, CURRENT_TIMESTAMP())\n" +
                "GROUP BY 1\n" +
                "ORDER BY recluster_credits DESC;"
              },
              { t: "compare",
                bad: { title: "Cluster everything big", items: ["Credits burn on tables nobody filters", "Keys chosen by guess", "No before/after measurement"] },
                good: { title: "Cluster what the workload filters", items: ["Keys chosen from query history predicates", "Partitions-scanned measured before and after", "Monthly review of credits per table"] } },
              { t: "note", variant: "warn", html: "Sorting your load (<code class='tok'>INSERT … SELECT … ORDER BY</code>) gives good initial clustering at no ongoing cost. It is often enough on append-only tables, and it makes any later automatic clustering cheaper." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"average_depth keeps climbing\", \"queries got slower after the backfill\", \"should we add a clustering key\", \"what is this serverless line on the bill\"." },
              { t: "quiz", id: "arch-storage" },
              { t: "note", variant: "key", html: "<strong>Cluster on the moderate-cardinality expression your big queries filter by, then prove it.</strong> Depth near 1 means good pruning; serverless credits are the price, so measure both." }
            ]
          }
        ]
      },
      {
        id: "protect",
        name: "Time Travel, Fail-safe & Cloning",
        icon: "shield",
        lessons: [
          {
            id: "time-travel",
            title: "Time Travel: AT, BEFORE and UNDROP",
            summary: "Query, clone and restore data as it was — inside a retention window you choose and pay for.",
            minutes: 10,
            tags: ["time-travel", "recovery", "retention"],
            blocks: [
              { t: "p", html: "Because micro-partitions are immutable, the old versions are still there after an UPDATE, DELETE or DROP. <strong>Time Travel</strong> is simply the ability to point a query at an earlier set of partitions, for as long as the retention window keeps them." },
              { t: "diagram", id: "sf-time-travel", caption: "Current data, then the Time Travel window (self-service), then Fail-safe (support only), then gone." },
              { t: "h", text: "Three ways to point back" },
              { t: "code", lang: "sql", code:
                "-- 1. A timestamp\n" +
                "SELECT * FROM sales.core.orders AT(TIMESTAMP => '2026-10-28 09:00:00'::TIMESTAMP_LTZ);\n\n" +
                "-- 2. An offset in seconds from now\n" +
                "SELECT * FROM sales.core.orders AT(OFFSET => -60 * 30);\n\n" +
                "-- 3. Just before a specific statement (most precise after an accident)\n" +
                "SELECT * FROM sales.core.orders BEFORE(STATEMENT => '<query_id>');"
              },
              { t: "h", text: "Recovering from a bad DELETE" },
              { t: "code", lang: "sql", code:
                "-- Clone the pre-accident state, verify, then restore the missing rows\n" +
                "CREATE TABLE sales.core.orders_recover CLONE sales.core.orders\n" +
                "  BEFORE(STATEMENT => '<query_id>');\n\n" +
                "INSERT INTO sales.core.orders\n" +
                "SELECT r.* FROM sales.core.orders_recover r\n" +
                "WHERE NOT EXISTS (SELECT 1 FROM sales.core.orders o WHERE o.order_id = r.order_id);"
              },
              { t: "h", text: "UNDROP" },
              { t: "code", lang: "sql", code:
                "SHOW TABLES HISTORY LIKE 'orders' IN SCHEMA sales.core;  -- dropped versions appear with dropped_on\n\n" +
                "-- If a new 'orders' already exists, free the name first\n" +
                "ALTER TABLE sales.core.orders RENAME TO sales.core.orders_new;\n" +
                "UNDROP TABLE sales.core.orders;\n\n" +
                "UNDROP SCHEMA sales.core;    -- also works for schemas and databases\n" +
                "UNDROP DATABASE sales;"
              },
              { t: "h", text: "Setting retention" },
              { t: "table", headers: ["Object", "Default", "Maximum"], rows: [
                ["Permanent, Standard edition", "1 day", "1 day"],
                ["Permanent, Enterprise or higher", "1 day", "90 days"],
                ["Transient or temporary", "1 day", "1 day"],
                ["Any object with retention 0", "—", "Time Travel disabled"]
              ] },
              { t: "code", lang: "sql", code:
                "ALTER TABLE sales.core.orders SET DATA_RETENTION_TIME_IN_DAYS = 30;\n" +
                "ALTER SCHEMA sales.stage       SET DATA_RETENTION_TIME_IN_DAYS = 1;\n" +
                "-- Account floor that individual objects cannot go below\n" +
                "ALTER ACCOUNT SET MIN_DATA_RETENTION_TIME_IN_DAYS = 1;"
              },
              { t: "note", variant: "trap", html: "Longer retention is not free: every rewritten partition is billed for the whole window. Ninety days on a table that is fully rewritten nightly can mean paying for dozens of copies of it. Set long retention on tables that change slowly and matter most." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Time Travel is a safety net for recent mistakes, not a backup strategy. It is bounded, it vanishes with the account, and it costs storage proportional to churn. Pair it with deliberate backups for anything you must restore past the window, such as a named clone before a risky change." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"someone ran a DELETE without a WHERE\", \"we dropped the wrong table\", \"show me what the table looked like yesterday\", \"why is Time Travel storage so large\"." },
              { t: "note", variant: "key", html: "<strong>AT and BEFORE read old partitions; UNDROP restores dropped objects; retention sets the window and the bill.</strong> After an accident, reach for BEFORE(STATEMENT) plus a clone." }
            ]
          },
          {
            id: "fail-safe",
            title: "Fail-safe and table types",
            summary: "The seven-day support-only tail behind permanent tables, and how transient and temporary tables avoid it.",
            minutes: 9,
            tags: ["fail-safe", "transient", "storage-cost"],
            blocks: [
              { t: "p", html: "When Time Travel ends for a permanent object, its data enters <strong>Fail-safe</strong>: a fixed seven-day period during which Snowflake itself can attempt recovery after a disaster. You cannot query it, configure it, or restore from it on your own — and you pay storage for it." },
              { t: "table", headers: ["Table type", "Time Travel", "Fail-safe", "Lifetime", "Use for"], rows: [
                ["Permanent", "0–1 day (Standard), 0–90 (Enterprise+)", "7 days", "Until dropped", "Data you cannot recreate"],
                ["Transient", "0–1 day", "None", "Until dropped", "Reproducible staging, intermediate and scratch tables"],
                ["Temporary", "0–1 day", "None", "Ends with the session", "Per-session working sets in procedures and scripts"]
              ] },
              { t: "widget", id: "retentionLab" },
              { t: "code", lang: "sql", code:
                "-- Staging that is truncated and reloaded every run: no Fail-safe churn\n" +
                "CREATE TRANSIENT TABLE IF NOT EXISTS sales.stage.orders_load (\n" +
                "  order_id   NUMBER,\n" +
                "  payload    VARIANT,\n" +
                "  loaded_at  TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()\n" +
                ") DATA_RETENTION_TIME_IN_DAYS = 0;\n\n" +
                "-- A transient schema makes every table created in it transient\n" +
                "CREATE TRANSIENT SCHEMA IF NOT EXISTS sales.scratch;\n\n" +
                "-- Session-scoped working set inside a procedure or script\n" +
                "CREATE TEMPORARY TABLE tmp_changed_ids AS\n" +
                "SELECT DISTINCT order_id FROM sales.stage.orders_load;"
              },
              { t: "h", text: "Doing the storage math" },
              { t: "code", lang: "text", code:
                "Permanent table, 2 TB, fully rewritten nightly, retention 1 day\n" +
                "  active            2 TB\n" +
                "  time travel     ~ 2 TB  (yesterday's partitions)\n" +
                "  fail-safe       ~14 TB  (7 nightly versions)\n" +
                "  billed          ~18 TB\n\n" +
                "Same table as TRANSIENT, retention 0\n" +
                "  billed          ~ 2 TB"
              },
              { t: "note", variant: "warn", html: "You cannot ALTER a table between permanent and transient. Switching means <code class='tok'>CREATE TRANSIENT TABLE … AS SELECT</code> (or <code class='tok'>LIKE</code> plus insert), then swapping names and re-applying grants." },
              { t: "h", text: "The trade-off" },
              { t: "compare",
                bad: { title: "Everything permanent", items: ["Seven extra days of storage on every rewrite", "Staging churn dominates the storage bill", "Protection for data you could simply reload"] },
                good: { title: "Type by recoverability", items: ["Permanent for sources of truth", "Transient for anything a pipeline can rebuild", "Temporary for per-session scratch"] } },
              { t: "note", variant: "trap", html: "Transient means <em>no disaster tail</em>. If the only copy of a dataset lives in a transient table, a mistake discovered after a day is unrecoverable. Make that a conscious choice, not a default." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"Fail-safe bytes are bigger than the table\", \"can we restore something from two weeks ago\", \"what table type for staging\", \"why did our temp table disappear\"." },
              { t: "note", variant: "key", html: "<strong>Fail-safe is seven days, permanent only, support only, and billed.</strong> Use transient tables for anything a pipeline can rebuild and keep permanent tables for data you could never recreate." }
            ]
          },
          {
            id: "cloning",
            title: "Zero-copy cloning",
            summary: "Instant copies that share micro-partitions until they diverge — for test data, backups and safe deploys.",
            minutes: 10,
            tags: ["cloning", "environments", "backups"],
            blocks: [
              { t: "p", html: "A clone is a <strong>new metadata entry that points at the same immutable micro-partitions</strong> as its source. It is created in seconds regardless of size, and it costs nothing extra until one side changes data. From then on, each object pays for the partitions it alone references." },
              { t: "code", lang: "sql", code:
                "-- Table, schema or whole database\n" +
                "CREATE TABLE    sales.core.orders_dev   CLONE sales.core.orders;\n" +
                "CREATE SCHEMA   sales.core_test         CLONE sales.core;\n" +
                "CREATE DATABASE sales_ts1               CLONE sales_stg;\n\n" +
                "-- Point-in-time clone via Time Travel\n" +
                "CREATE TABLE sales.core.orders_asof CLONE sales.core.orders\n" +
                "  AT(TIMESTAMP => DATEADD(hour, -6, CURRENT_TIMESTAMP()));\n\n" +
                "-- Keep the source's grants on a table clone\n" +
                "CREATE OR REPLACE TABLE sales.core.orders_copy CLONE sales.core.orders COPY GRANTS;"
              },
              { t: "h", text: "Backup before you mutate" },
              { t: "p", html: "Before a risky UPDATE, a config-table edit or a deploy that rewrites a table, take a named clone. It is instant, costs nothing until the original changes, and survives beyond the Time Travel window. A predictable name like <code class='tok'>&lt;NAME&gt;_BKP_&lt;DDMON&gt;</code> makes the backup easy to find and easy to clean up." },
              { t: "code", lang: "sql", code:
                "SET tgt = 'SALES_STG.CORE.JOB_CONFIG';\n" +
                "SET bkp = $tgt || '_BKP_' || UPPER(TO_CHAR(CURRENT_DATE(), 'DDMON'));\n\n" +
                "CREATE TABLE IDENTIFIER($bkp) CLONE IDENTIFIER($tgt);\n\n" +
                "-- ... run the change, validate, and if it goes wrong:\n" +
                "ALTER TABLE IDENTIFIER($tgt) SWAP WITH IDENTIFIER($bkp);"
              },
              { t: "h", text: "What clones carry and what they do not" },
              { t: "table", headers: ["Item", "Behaviour"], rows: [
                ["Data", "Shared at creation; diverges as either side writes"],
                ["Child object grants (schema/database clone)", "Carried over to the cloned children"],
                ["Grants on the cloned object itself", "Not inherited unless you use COPY GRANTS (tables)"],
                ["Streams", "Cloned, but records not yet consumed in the source are not available in the clone"],
                ["Tasks", "Cloned in a suspended state; resume deliberately"],
                ["Internal named stages and some pipes", "Special rules apply; check before relying on them in an environment clone"]
              ] },
              { t: "note", variant: "warn", html: "Cloned tasks and pipes pointing at the same external sources can double-process data once resumed. After cloning a database for test, review every task and pipe before turning anything on." },
              { t: "h", text: "Storage after cloning" },
              { t: "stat", items: [
                { v: "~0", k: "bytes added at clone time" },
                { v: "seconds", k: "clone time, independent of size" },
                { v: "changed only", k: "partitions billed separately later" }
              ] },
              { t: "p", html: "If the source drops or rewrites partitions that a clone still references, those bytes move to <code class='tok'>RETAINED_FOR_CLONE_BYTES</code> on the source and stay billed. Long-lived clones of fast-changing tables slowly become full copies — clean up old backups on a schedule." },
              { t: "table", headers: ["Tier", "Test-data strategy", "Outcome"], rows: [
                ["Naive", "Full CTAS copies of production-sized tables into each env", "Hours of compute, full duplicate storage, stale quickly"],
                ["Solid", "Zero-copy clone of the STG database into test databases on demand", "Seconds to refresh, storage only for what tests change"],
                ["Standout", "Solid, plus masking policies that follow the data, suspended tasks reviewed, and clones expired automatically", "Realistic, safe and cheap test environments"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we need a copy of prod-like data for testing\", \"back up this table before the change\", \"refresh the test database\", \"why is a dropped table still costing storage\"." },
              { t: "quiz", id: "arch-protect" },
              { t: "note", variant: "key", html: "<strong>Clones share partitions until they diverge.</strong> Use them for instant test environments and named pre-change backups, review cloned tasks before resuming, and expire old clones so retained bytes do not pile up." }
            ]
          }
        ]
      }
    ]
  };
})();
